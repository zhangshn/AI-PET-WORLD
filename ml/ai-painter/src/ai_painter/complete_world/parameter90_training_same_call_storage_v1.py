"""Bounded same-Run sidecar writer; original failure capture remains independent.

No execution admission, training activation, model forward or gradient creation.
Only the existing capture-execution and immutable quality plan establish scope.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import stat
import struct
import zlib

import torch
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world import parameter90_training_same_call_capture_v1 as component

FAILURE_MAXIMUM = 67108864
EXECUTION_MAXIMUM = 134217728
SIDECAR_MAXIMUM = 2097152
JSON_MAXIMUM = 2097152
RESERVE = 65536
# Two independently stored small manifests, plus an incomplete-result record.
MANIFEST_MAXIMUM = 65536
NEW_RESERVE = SIDECAR_MAXIMUM + 3*MANIFEST_MAXIMUM


def _require(value, message):
    if not value:
        raise ValueError(message)


def _json(raw):
    def pairs(items):
        result = {}
        for key,value in items:
            _require(key not in result,"duplicate metadata key")
            result[key] = value
        return result
    return json.loads(raw,object_pairs_hook=pairs,
        parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def _binding(value):
    _require(type(value) is dict and set(value) == {"path","sha256"},"exact path/SHA binding required")
    return value


def _document(mapping,binding):
    return _json(mapping.binding(_binding(binding),maximum=JSON_MAXIMUM))


def _identity(mapping,execution_binding,plan_binding,context,output):
    ticket,graph = capture._bound_context(mapping,execution_binding,context,output)
    plan = _document(mapping,plan_binding)
    root = plan.get("outputRoot")
    _require(plan.get("schema") == "object-support-structure-quality-plan-v1" and
        type(root) is str and plan_binding["path"] == root+"/quality-plan.json" and
        execution_binding["path"] == root+"/capture-execution.json" and output == root+"/gradient-failure" and
        ticket.get("outputRoot") == root and plan.get("runId") == context.get("runId") == ticket.get("runId"),
        "same Run/plan/capture ticket required")
    _require(plan.get("modelBinding") == context.get("modelBinding") and
        plan.get("programBindings") == context.get("programBindings"),"plan model/program identity differs")
    package_binding = context.get("executionPackage")
    _require(ticket.get("executionPackage") == package_binding,"capture ticket package differs")
    package = _document(mapping,package_binding)
    _require(package.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1" and
        package.get("packageIdentity") == plan.get("packageId") and type(plan.get("packageId")) is str and
        package.get("outputRoot") == root and package.get("capabilityVersion") == plan.get("capabilityVersion") and
        package.get("programLineage") == {role:b["sha256"] for role,b in plan["programBindings"].items()},
        "actual package/plan/program lineage differs")
    inputs = package.get("inputEvidence")
    _require(type(inputs) is list and sum(b == plan_binding for b in inputs) == 1 and
        sum(b.get("path") == plan_binding["path"] for b in inputs) == 1,"package must bind one exact quality plan")
    split = _document(mapping,plan["trainSplit"])
    ids = split.get("sampleIds")
    index = context["failurePosition"]["trainIndex"]
    _require(split.get("split") == "train" and type(ids) is list and len(ids) == len(set(ids)) == 48 and
        index < len(ids) and ids[index] == context["sampleId"],"actual train sample/index differs")
    dataset = _document(mapping,plan["datasetManifest"])
    source_index = _document(mapping,dataset["sourceIndex"])
    records = source_index.get("samples")
    _require(type(records) is list and len(records) <= 256,"bounded source index required")
    records = [r for r in records if r.get("sampleId") == context["sampleId"]]
    _require(len(records) == 1 and records[0].get("split") == "train" and
        context["sampleBindings"] == dict(source=records[0].get("image"),condition=records[0].get("conditionPack")),
        "actual source/condition sample binding differs")
    if "sampleIdentity" in context:
        identity = context["sampleIdentity"]
        _require(type(identity) is dict and all(identity.get(k) == records[0].get(k)
            for k in ("sampleId","split","image","conditionPack")),"actual sample identity differs")
        if "ordinal" in identity and "ordinal" in records[0]:
            _require(identity["ordinal"] == records[0]["ordinal"],"actual sample ordinal differs")
    _require(graph[90] == dict(name=component.TARGET_NAME,shape=[3,48,1,1],dtype="torch.float32",elements=144),
        "actual model target90 differs")
    programs = list(plan["programBindings"].values())
    _require(len({b["path"] for b in programs}) == len(programs),"duplicate program source path")
    for required in component.required_source_bindings():
        _require(required in programs,"actual original gate/operator program binding omitted")
    return plan,graph


def _scan(mapping,roots,original_output):
    """Count logical bytes, including both old pending/manifest hardlink names."""
    total,files,identities = 0,{},{}
    pending = original_output+"/manifest.pending.json"
    committed = original_output+"/manifest.json"
    for logical_root in roots:
        root = mapping.path(logical_root)
        if not root.exists():
            continue
        before = capture._directory_identity(root)
        stack = [(logical_root,0)]
        while stack:
            logical,depth = stack.pop()
            _require(depth <= 64 and len(files)+len(identities) <= 16384,"bounded output traversal exceeded")
            directory = mapping.path(logical)
            identity = capture._directory_identity(directory)
            _require(identity not in identities,"output directory alias")
            identities[identity] = logical
            for entry in directory.iterdir():
                child = logical+"/"+entry.name
                path = mapping.path(child)
                info = path.lstat()
                if stat.S_ISDIR(info.st_mode):
                    stack.append((child,depth+1))
                else:
                    _require(stat.S_ISREG(info.st_mode),"output special file")
                    _require(info.st_nlink == 1 or child in (pending,committed) and info.st_nlink == 2,
                             "unapproved output hardlink")
                    files[child] = info
                    total += info.st_size
                    _require(total <= EXECUTION_MAXIMUM,"actual output files exceed 128MiB")
            _require(capture._directory_identity(directory) == identity,"output directory replaced during scan")
        _require(capture._directory_identity(mapping.path(logical_root)) == before,"output root replaced during scan")
    linked = [name for name,info in files.items() if info.st_nlink > 1]
    if linked or committed in files:
        _require(set(linked) == {pending,committed} and
            capture._file_identity(files[pending]) == capture._file_identity(files[committed]),
            "only original pending/manifest pair may share an inode")
    mapping.check()
    return total,files


def _read(mapping,logical,maximum):
    path = mapping.path(logical)
    before = path.lstat()
    _require(stat.S_ISREG(before.st_mode) and before.st_size <= maximum,"bounded regular file required")
    with path.open("rb") as handle:
        opened = os.fstat(handle.fileno())
        _require(capture._file_identity(opened,include_ctime=False) ==
                 capture._file_identity(before,include_ctime=False),"read handle/path changed")
        raw = handle.read(maximum+1)
        _require(len(raw) == before.st_size and capture._file_identity(os.fstat(handle.fileno())) ==
                 capture._file_identity(opened),"file changed during read")
    _require(mapping.path(logical) == path and capture._file_identity(path.lstat()) == capture._file_identity(before),
             "file replaced after read")
    return raw


def _expanded_size(raw,maximum=FAILURE_MAXIMUM):
    """Count the real gzip stream, bounded before allocating its expanded bytes."""
    decoder,total = zlib.decompressobj(31),0
    for offset in range(0,len(raw),65536):
        pending = raw[offset:offset+65536]
        while pending:
            part = decoder.decompress(pending,min(65536,maximum-total+1))
            total += len(part)
            _require(total <= maximum,"archive expansion exceeds aggregate reserve")
            _require(not decoder.unused_data,"extra gzip member rejected")
            pending = decoder.unconsumed_tail
    _require(decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail,"incomplete/extra gzip member")
    return total


def _decode(raw):
    _require(type(raw) is bytes and 12 <= len(raw) <= SIDECAR_MAXIMUM and raw[:8] == b"P90SC1\0\0",
             "invalid sidecar envelope")
    length = struct.unpack("<I",raw[8:12])[0]
    _require(0 < length <= MANIFEST_MAXIMUM and 12+length <= len(raw),"bounded sidecar metadata required")
    metadata = _json(raw[12:12+length])
    descriptors = metadata.get("tensors")
    shapes = {"input":[1,1,192,256],"weightWitness":[3,48,1,1],
        **{"adjoint."+label:[1,1,192,256] for label in component.LABELS},
        **{"gradient."+label:[3,48,1,1] for label in component.LABELS}}
    _require(type(descriptors) is dict and set(descriptors) == set(shapes),"twelve sealed tensors required")
    offset = 0
    for name,descriptor in sorted(descriptors.items(),key=lambda pair:pair[1].get("offset",-1)):
        _require(descriptor.get("offset") == offset and descriptor.get("dtype") == "torch.float32" and
            descriptor.get("shape") == shapes[name] and type(descriptor.get("bytes")) is int and
            descriptor["bytes"] == 4*math.prod(shapes[name]),"sidecar tensor layout differs")
        piece = raw[12+length+offset:12+length+offset+descriptor["bytes"]]
        _require(len(piece) == descriptor["bytes"] and capture.digest(piece) == descriptor.get("sha256"),
                 "sidecar tensor digest differs")
        _require(bool(torch.isfinite(torch.frombuffer(bytearray(piece),dtype=torch.float32)).all()),
                 "sidecar tensor nonfinite")
        offset += len(piece)
    _require(12+length+offset == len(raw),"sidecar trailing/missing tensor bytes")
    return metadata


def _match_packet(metadata,plan,context,manifest,tensors,error):
    position = context["failurePosition"]
    identity = dict(runId=plan["runId"],packageId=plan["packageId"],sampleId=context["sampleId"],
        epoch=position["epoch"],zeroBasedEpochPosition=position["zeroBasedEpochPosition"],trainIndex=position["trainIndex"],
        optimizerSteps=context["optimizerSteps"],modelBinding=plan["modelBinding"])
    _require(metadata.get("identity") == identity,"sealed identity differs from actual plan/failure")
    _require(metadata.get("schemaVersion") == "parameter90-training-same-call-capture-v1" and
        metadata.get("productionGeometryVerified") is True and
        metadata.get("target") == dict(parameterIndex=90,parameterName=component.TARGET_NAME,shape=[3,48,1,1],
            coordinate=[0,1,0,0],inputChannel=1,outputChannel=0),"sealed target differs")
    primary = capture.primary_error(error)
    original = metadata.get("originalFailure",{})
    _require(original.get("type") == primary["type"] == "ValueError" and original.get("message") == primary["message"] ==
        "actual four-term total gradient identity differs at parameter 90" and
        original.get("sourceBindings") == component.required_source_bindings(),"original sealed gate/source differs")
    descriptors = metadata["tensors"]
    for label in component.LABELS:
        key = "gradient."+label+".90"
        _require(key in tensors and capture.tensor_sha(tensors[key]) == descriptors["gradient."+label]["sha256"],
                 "sealed gradient differs from original captured gradient")
    weight = tensors["generator.parameter.90"]
    _require(capture.tensor_sha(weight) == descriptors["weightWitness"]["sha256"],"sealed weight witness differs")
    _require(metadata.get("graphSha256") == capture.digest(component._json(manifest["graph"])),"sealed graph differs")


def save_same_call_failure(error, *, packet, model, critic, context, mapping, output, execution_binding,
                           plan_binding, output_roots, maximum_output_bytes=EXECUTION_MAXIMUM):
    """Never raise a secondary save failure over the original training exception.

    Return the unmodified original receipt under originalCapture. The combined
    status is incomplete if supplied same-call evidence could not be verified.
    Sidecar availability is independent of original snapshot completeness.
    """
    secondary,plan,graph = [],None,None
    remaining = 0
    original = dict(status="capture_incomplete",primaryError=capture.primary_error(error),artifacts={},missing=[])
    new = dict(status="not_captured",reason="no sealed same-call packet supplied",artifacts={})
    roots,side_root,side_identity = None,None,None
    owned_writes = {}
    maximum = maximum_output_bytes
    try:
        _require(type(mapping) is capture.RuntimeMap,"existing concrete RuntimeMap required")
        _require(type(maximum) is int and RESERVE <= maximum <= EXECUTION_MAXIMUM,"execution byte limit invalid")
        ticket,_ = capture._bound_context(mapping,execution_binding,context,output)
        original_root = ticket["outputRoot"]
        _require(type(output_roots) in (tuple,list) and 1 <= len(output_roots) <= 16 and
            all(type(r) is str for r in output_roots) and original_root in output_roots,"actual output roots required")
        roots = list(output_roots)
        paths = [mapping.path(r) for r in roots]
        _require(all(a != b and a not in b.parents and b not in a.parents for i,a in enumerate(paths) for b in paths[i+1:]),
                 "duplicate/overlapping output roots")
        existing,_ = _scan(mapping,roots,output)
        reserve = NEW_RESERVE if packet is not None else 3*MANIFEST_MAXIMUM
        remaining = max(0,min(FAILURE_MAXIMUM-reserve,maximum-existing-reserve-RESERVE))
    except BaseException as failure:
        secondary.append(capture.primary_error(failure))
    # Always delegate original persistence, even if new identity/preflight failed.
    try:
        original = capture.capture_failure(error,model=model,critic=critic,context=context,mapping=mapping,
            output=output,execution_binding=execution_binding,remaining_output_bytes=remaining)
    except BaseException as failure:
        secondary.append(capture.primary_error(failure))
    manifest,tensors = None,None
    try:
        manifest,tensors = capture.verify_capture(original,mapping)
    except BaseException as failure:
        secondary.append(capture.primary_error(failure))
    result = {**original,"originalCapture":original,"sameCallCapture":new,"secondaryStorageFailures":secondary,
              "productionActivated":False,"qualificationGranted":False,"rootCauseProven":False}
    try:
        _require(not secondary and original.get("status") == "captured" and manifest is not None,"original capture/identity not complete")
        plan,graph = _identity(mapping,execution_binding,plan_binding,context,output)
        side_root = plan["outputRoot"]+"/parameter90-same-call"
        _require(manifest["context"] == context and manifest["executionBinding"] == execution_binding,
                 "original capture current context/ticket differs")
        archive = _read(mapping,original["artifacts"]["tensors"]["path"],FAILURE_MAXIMUM)
        _require(capture.digest(archive) == original["artifacts"]["tensors"]["sha256"],"stored archive digest changed")
        compressed,expanded = len(archive),_expanded_size(archive)
        del archive
        def accounting(extra=0):
            total,files = _scan(mapping,roots,output)
            failure_files = sum(info.st_size for name,info in files.items()
                if name.startswith(output+"/") or name.startswith(side_root+"/"))
            _require(failure_files+extra+RESERVE <= FAILURE_MAXIMUM,"actual disk-view failure exceeds 64MiB")
            _require(failure_files-compressed+expanded+extra+RESERVE <= FAILURE_MAXIMUM,"actual expanded-view failure exceeds 64MiB")
            _require(total+extra+RESERVE <= maximum and total-compressed+expanded+extra+RESERVE <= maximum,
                     "actual execution disk/expanded view exceeds total limit")
            return dict(failureLogicalFileBytes=failure_files,archiveExpandedBytes=expanded,
                archiveCompressedBytes=compressed,executionLogicalFileBytes=total,terminalReserveBytes=RESERVE,
                failureDiskViewBytesIncludingReserve=failure_files+RESERVE,
                failureExpandedViewBytesIncludingReserve=failure_files-compressed+expanded+RESERVE,
                executionDiskViewBytesIncludingReserve=total+RESERVE,
                executionExpandedViewBytesIncludingReserve=total-compressed+expanded+RESERVE)
        result["storageAccounting"] = accounting()
        _require(not mapping.path(side_root).exists(),"same-call directory already consumed")
        mapping.path(side_root).mkdir(exist_ok=False)
        side_identity = capture._directory_identity(mapping.path(side_root))
        def put(name,raw):
            _require(type(raw) is bytes and len(raw) <= (SIDECAR_MAXIMUM if name == "target.bin" else MANIFEST_MAXIMUM),
                     "bounded sidecar/manifest bytes required")
            accounting(len(raw))
            directory = mapping.path(side_root)
            _require(capture._directory_identity(directory) == side_identity,"same-call output directory replaced")
            path = mapping.path(side_root+"/"+name)
            with path.open("xb") as handle:
                created = os.fstat(handle.fileno())
                owned_writes[name] = (created.st_dev,created.st_ino)
                _require(handle.write(raw) == len(raw),"short sidecar write")
                handle.flush(); os.fsync(handle.fileno())
                observed = os.fstat(handle.fileno())
                _require(stat.S_ISREG(observed.st_mode) and observed.st_nlink == 1 and observed.st_size == len(raw),
                         "sidecar handle type/size/link differs")
            _require(capture._directory_identity(mapping.path(side_root)) == side_identity and
                capture._file_identity(mapping.path(side_root+"/"+name).lstat(),include_ctime=False) ==
                capture._file_identity(observed,include_ctime=False),"sidecar path/handle identity changed")
            _require(_read(mapping,side_root+"/"+name,len(raw)) == raw,"sidecar readback differs")
            accounting()
            return dict(path=side_root+"/"+name,sha256=capture.digest(raw),bytes=len(raw))
        if packet is not None:
            total,files = _scan(mapping,roots,output)
            failure_parts = tuple(_read(mapping,name,FAILURE_MAXIMUM) for name in files if name.startswith(output+"/"))
            # Codec measures the immutable real failure file bytes. Global files,
            # expanded archive and manifests are independently measured above.
            encoded = component.encode_capture(packet,original_failure_parts=failure_parts,execution_parts=())
            raw = encoded["bytes"]
            _require(capture.digest(raw) == encoded["sha256"] and _decode(raw) == encoded["metadata"],"encoded sidecar metadata/digest differs")
            _match_packet(encoded["metadata"],plan,context,manifest,tensors,error)
            accounting(len(raw)+2*MANIFEST_MAXIMUM)
            new.update(status="captured",reason=None,artifacts=dict(target=put("target.bin",raw)))
        failure_identity = {k:context[k] for k in ("runId","sampleId","failurePosition","optimizerSteps",
                                                  "sampleBindings","modelBinding","executionPackage")}
        new_manifest = dict(schemaVersion="parameter90-training-same-call-storage-v1",status=new["status"],
            reason=new["reason"],originalFailure=capture.primary_error(error),failureIdentity=failure_identity,
            planBinding=plan_binding,executionBinding=execution_binding,originalArtifacts=original["artifacts"],
            artifacts=new["artifacts"],qualificationGranted=False,rootCauseProven=False,productionActivated=False)
        raw = capture.json_bytes(new_manifest)
        _require(len(raw) <= MANIFEST_MAXIMUM,"same-call manifest exceeds private reservation")
        # Both names are independent exclusive files. No new hardlink exception;
        # a partial final file is never accepted without complete byte readback.
        put("manifest.pending.json",raw)
        committed = put("manifest.json",raw)
        _require(_json(_read(mapping,committed["path"],MANIFEST_MAXIMUM)) == new_manifest,"new manifest readback differs")
        _identity(mapping,execution_binding,plan_binding,context,output)
        capture.verify_capture(original,mapping)
        new["artifacts"]["manifest"] = committed
        result["storageAccounting"] = accounting()
    except BaseException as failure:
        secondary.append(capture.primary_error(failure))
        result["status"] = "capture_incomplete"
        new.update(status="capture_incomplete",reason="new storage validation/save unavailable")
        if "manifest.json" in owned_writes:
            try:
                _require(capture._directory_identity(mapping.path(side_root)) == side_identity,"late manifest owner changed")
                source = mapping.path(side_root+"/manifest.json")
                info = source.lstat()
                _require((info.st_dev,info.st_ino) == owned_writes["manifest.json"] and info.st_nlink == 1,
                         "late manifest identity changed")
                rejected = mapping.path(side_root+"/manifest.not-accepted.json")
                _require(not rejected.exists(),"late manifest revocation already consumed")
                source.rename(rejected)  # Preserve late success-shaped bytes, revoke accepted name.
            except BaseException as final:
                result["secondaryManifestRevocationFailure"] = capture.primary_error(final)
        # Preserve all old bytes and the first error; record only in the already
        # owned new directory and within the remaining real aggregate allowance.
        if side_identity is not None:
            try:
                detail = capture.json_bytes(dict(status="capture_incomplete",primaryError=capture.primary_error(error),
                    secondaryStorageFailures=secondary,qualificationGranted=False))
                put("storage-error.json",detail)
            except BaseException as final:
                result["secondaryStorageRecordFailure"] = capture.primary_error(final)
    return result

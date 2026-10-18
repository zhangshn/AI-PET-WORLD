"""108-parameter diagnostic snapshots. No replay, model loading or admission.

Only exception-attached independent gradients are copied. Every state is labelled
after_exception; a complete snapshot is evidence, never numerical qualification.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import gzip
import io
import json
import math
import os
from pathlib import Path
import random
import re
import stat
import zipfile
import zlib

import numpy as np
import torch

SCHEMA = "object-support-structure-gradient-failure-capture-v1"
LABELS = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
PARAMETERS, ELEMENTS = 108, 2242687
MAX_CAPTURE = 64 * 1024**2
MAX_EXECUTION = 128 * 1024**2
MAX_JSON = 2 * 1024**2
METADATA_RESERVE, PRIMARY_RESERVE = 1024**2, 65536
FILES = ("primary.json", "tensors.pt", "manifest.pending.json", "manifest.json", "capture-error.json")
DTYPES = {"torch.float32", "torch.float64", "torch.uint8", "torch.int32", "torch.int64", "torch.bool"}


def require(value, message):
    if not value:
        raise ValueError(message)


def utc():
    return datetime.now(timezone.utc).isoformat()


def json_bytes(value):
    raw = (json.dumps(value, sort_keys=True, allow_nan=False, ensure_ascii=False) + "\n").encode()
    require(len(raw) <= MAX_JSON, "metadata JSON ceiling exceeded")
    return raw


def primary_error(error):
    try:
        text = str(error)
    except BaseException:
        text = "<message unavailable>"
    return {"type": type(error).__name__, "message": text[:4096],
            "messageSha256": hashlib.sha256(text.encode()).hexdigest()}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def tensor_sha(value):
    return digest(value.reshape(-1).view(torch.uint8).numpy().tobytes())


_CONCRETE_PATH_TYPE = type(Path())


@lru_cache(maxsize=2048)
def _plain_ancestors(path_type, spelling):
    """Bounded lexical reuse only: no stat, resolution, bytes or trust results.

    Keep exact spelling in the key: Windows Path equality folds case, while a
    filesystem directory may be case-sensitive. Relative ancestors stay relative.
    """
    return tuple(path_type(spelling).parents)


def _plain(path):
    """No links/reparse points in a physical path, including its ancestors."""
    ancestors = (_plain_ancestors(type(path), str(path))
                 if type(path) is _CONCRETE_PATH_TYPE else path.parents)
    # Never reuse an observation: the original leaf and every ancestor retain
    # their fresh lstat, original order, redirection checks and error handling.
    for item in (path, *ancestors):
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue  # Missing components remain allowed for new private output paths.
        require(not stat.S_ISLNK(info.st_mode) and
                not (getattr(info, "st_file_attributes", 0) & 0x400), "physical path redirection")


def _directory_identity(path):
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_dev > 0 and info.st_ino > 0,
            "directory identity unavailable")
    return (info.st_dev, info.st_ino)


def _link_identity(path):
    if not path.exists() and not path.is_symlink():
        return None
    info = path.lstat()
    require(info.st_dev > 0 and info.st_ino > 0, "logical mapping identity unavailable")
    redirected = bool(stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400)
    return (info.st_dev, info.st_ino, redirected, os.readlink(path) if redirected else None)


def _file_identity(info, *, include_ctime=True):
    shared = (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)
    return (*shared, info.st_ctime_ns) if include_ctime else shared


@dataclass(frozen=True)
class RuntimeMap:
    project: Path
    physical_runtime: Path
    storage_environment: object
    project_identity: tuple
    physical_identity: tuple
    logical_identity: object

    @classmethod
    def current(cls, project):
        project = Path(os.path.abspath(project))
        _plain(project)
        environment = os.environ.get("AI_PET_WORLD_DATA_ROOT")
        # Existing ai-pet-world-storage.mjs configuration, no additional config.
        default = "D:/AI-PET-WORLD-DATA" if os.name == "nt" else str(project / ".ai-pet-world-data")
        data = Path(environment if environment is not None else default)
        require(data.is_absolute(), "storage data root must be absolute")
        physical = Path(os.path.abspath(data / "hot/runtime"))
        _plain(physical)
        logical = project / ".runtime"
        if logical.exists() or logical.is_symlink():
            require(logical.resolve() == physical, "formal runtime mapping differs")
        result = cls(project, physical, environment, _directory_identity(project),
                     _directory_identity(physical), _link_identity(logical))
        result.check()
        return result

    def check(self):
        require(os.environ.get("AI_PET_WORLD_DATA_ROOT") == self.storage_environment,
                "storage configuration changed")
        _plain(self.project)
        _plain(self.physical_runtime)
        require(_directory_identity(self.project) == self.project_identity and
                _directory_identity(self.physical_runtime) == self.physical_identity,
                "project/physical root identity changed")
        logical = self.project / ".runtime"
        require(_link_identity(logical) == self.logical_identity, "logical mapping identity changed")
        if self.logical_identity is not None:
            require(logical.resolve() == self.physical_runtime and
                    _directory_identity(self.physical_runtime) == self.physical_identity,
                    "formal runtime mapping changed")

    def path(self, logical):
        require(type(logical) is str and logical and len(logical) <= 4096 and
                "\\" not in logical and ":" not in logical and not re.search(r"[\x00-\x1f\x7f]", logical) and
                not logical.startswith("/") and
                all(part not in ("", ".", "..") for part in logical.split("/")), "unsafe logical path")
        self.check()
        parts = logical.split("/")
        result = (self.physical_runtime.joinpath(*parts[1:]) if parts[0] == ".runtime"
                  else self.project.joinpath(*parts))
        _plain(result)
        self.check()
        return result

    def binding(self, binding, *, maximum=MAX_JSON):
        require(type(binding) is dict and set(binding) == {"path", "sha256"} and
                type(binding["sha256"]) is str and re.fullmatch("[0-9a-f]{64}", binding["sha256"]),
                "binding members/SHA invalid")
        path = self.path(binding["path"])
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= maximum, "binding absent/oversized")
        with path.open("rb") as stream:
            handle_before = os.fstat(stream.fileno())
            # Windows ctime differs between APIs; each API remains independently stable.
            require(_file_identity(handle_before, include_ctime=False) == _file_identity(before, include_ctime=False),
                    "binding identity changed before open")
            raw = stream.read(maximum + 1)
            require(len(raw) == before.st_size and len(raw) <= maximum and
                    _file_identity(os.fstat(stream.fileno())) == _file_identity(handle_before),
                    "binding changed during read")
        _plain(path)
        require(_file_identity(path.lstat()) == _file_identity(before), "binding file identity changed")
        self.check()
        require(digest(raw) == binding["sha256"], "binding SHA differs")
        return raw


def directory_bytes(root):
    _plain(root)
    total = 0
    if root.exists():
        for path in root.rglob("*"):
            _plain(path)
            if path.is_file():
                total += path.stat().st_size
    return total


def validate_graph(named, graph):
    require(type(graph) is list and len(graph) == PARAMETERS and len(named) == PARAMETERS,
            "complete108 parameter graph required")
    require(len({name for name, _ in named}) == PARAMETERS and len({id(p) for _, p in named}) == PARAMETERS,
            "parameter names/identity alias")
    require(len({p.untyped_storage().data_ptr() for _, p in named}) == PARAMETERS, "parameter storage alias")
    require(sum(p.numel() for _, p in named) == ELEMENTS, "parameter element count differs")
    for (name, parameter), row in zip(named, graph):
        require(type(row) is dict and name == row.get("name") and list(parameter.shape) == row.get("shape") and
                str(parameter.dtype) == row.get("dtype") == "torch.float32" and
                parameter.numel() == row.get("elements"), "parameter name/order/shape/dtype differs")


def _copy(value):
    require(isinstance(value, torch.Tensor) and value.layout == torch.strided and not value.is_meta and
            value.device.type in ("cpu", "cuda") and str(value.dtype) in DTYPES,
            "unsupported snapshot tensor")
    if value.device.type == "cuda":
        require(torch.cuda.is_initialized(), "capture cannot initialize CUDA")
    return value.detach().to("cpu").clone(memory_format=torch.contiguous_format)


def collect_snapshot(error, *, model, critic, graph, context):
    """Copy available real references, never recompute a gradient or mutate state."""
    require(isinstance(model, torch.nn.Module), "generator module unavailable")
    named = tuple(model.named_parameters(remove_duplicate=False))
    validate_graph(named, graph)
    captured_at = utc()
    payload, descriptors, missing = {}, {}, []
    metadata = {"schema": SCHEMA, "capturedAtUtc": captured_at, "stateTiming": "after_exception",
                "context": context, "graph": graph, "labels": list(LABELS), "networks": {}, "gradients": [],
                "archiveEncoding": "gzip-torch-flat-cpu-v1"}
    raw_bytes = 0
    observed_versions = []

    def add(key, value):
        nonlocal raw_bytes
        require(key not in payload and len(payload) < 2048, "duplicate/oversized tensor members")
        size = value.numel() * value.element_size()
        require(raw_bytes + size + METADATA_RESERVE + PRIMARY_RESERVE <= MAX_CAPTURE, "decompressed tensor budget exceeded")
        versions = value._version
        tensor = _copy(value)
        require(value._version == versions, "source tensor changed during capture")
        observed_versions.append((value, versions))
        raw_bytes += size
        payload[key] = tensor
        descriptors[key] = {"shape": list(tensor.shape), "dtype": str(tensor.dtype), "bytes": size,
                            "sha256": tensor_sha(tensor), "sourceDevice": str(value.device),
                            "sourceVersion": versions, "capturedAtUtc": captured_at,
                            "allFinite": bool(torch.isfinite(tensor).all())}

    for prefix, network in (("generator", model), ("discriminator", critic)):
        if not isinstance(network, torch.nn.Module):
            missing.append(prefix + " state/modes unavailable")
            continue
        rows = []
        for kind, values in (("parameter", network.named_parameters(remove_duplicate=False)),
                             ("buffer", network.named_buffers(remove_duplicate=False))):
            for i, (name, value) in enumerate(values):
                require(len(name) <= 2048, "state name too long")
                key = prefix + "." + kind + "." + str(i)
                add(key, value)
                rows.append({"kind": kind, "name": name, "key": key})
                if kind == "parameter" and value.grad is not None:
                    grad_key = key + ".grad"
                    add(grad_key, value.grad)
                    rows[-1]["gradientKey"] = grad_key
        metadata["networks"][prefix] = {"state": rows,
            "modes": {name: bool(module.training) for name, module in network.named_modules()},
            "capturedAtUtc": captured_at, "timing": "after_exception"}
    attachment = getattr(error, "object_support_gradient_evidence", None)
    raw = []
    if type(attachment) is not dict:
        missing.append("exception gradient attachment absent")
    else:
        require(attachment.get("parameterNames") == [name for name, _ in named], "attachment108 names/order differs")
        require(attachment.get("componentsInOrder") == list(LABELS), "unknown gradient labels")
        raw = attachment.get("rawGradients")
        require(type(raw) in (tuple, list) and len(raw) <= 5 and
                type(attachment.get("gradientSetsAvailable")) is int and
                attachment["gradientSetsAvailable"] == len(raw), "gradient set count differs")
    if len(raw) != 5:
        missing.append("five independent gradient sets incomplete")
    gradient_storages = {(str(p.device), p.untyped_storage().data_ptr()) for _, p in named}
    for label, values in zip(LABELS, raw):
        require(type(values) in (tuple, list) and len(values) == PARAMETERS, "gradient set108 shape differs")
        rows = []
        for index, ((name, parameter), value) in enumerate(zip(named, values)):
            row = {"index": index, "name": name, "unused": value is None, "key": None}
            if value is not None:
                require(isinstance(value, torch.Tensor) and value.shape == parameter.shape and
                        value.dtype == torch.float32 and value.device == parameter.device, "gradient shape/dtype/device differs")
                storage_identity = (str(value.device), value.untyped_storage().data_ptr())
                require(storage_identity not in gradient_storages, "independent gradient storage alias")
                gradient_storages.add(storage_identity)
                row["key"] = "gradient." + label + "." + str(index)
                add(row["key"], value)
            rows.append(row)
        metadata["gradients"].append({"label": label, "parameters": rows})
    add("rng.torch_cpu", torch.random.get_rng_state())
    metadata["rng"] = {"python": random.getstate(), "numpy": None, "cudaDevices": [],
                       "capturedAtUtc": captured_at, "timing": "after_exception"}
    numpy_state = np.random.get_state()
    if np.isfinite(numpy_state[4]):
        metadata["rng"]["numpy"] = [numpy_state[0], numpy_state[1].tolist(), *numpy_state[2:]]
    else:
        missing.append("numpy cached Gaussian nonfinite")
    devices = sorted({str(p.device) for n in (model, critic) if isinstance(n, torch.nn.Module)
                      for p in n.parameters() if p.device.type == "cuda"})
    for device in devices:
        require(torch.cuda.is_initialized(), "capture cannot initialize CUDA RNG")
        add("rng." + device, torch.cuda.get_rng_state(torch.device(device)))
        metadata["rng"]["cudaDevices"].append(device)
    require(type(context) is dict, "failure context required")
    for key in ("failurePosition", "optimizerSteps", "sampleBindings", "programBindings", "modelBinding"):
        if key not in context:
            missing.append("context missing " + key)
    require(all(value._version == version for value, version in observed_versions),
            "source changed across snapshot")
    for prefix, network in (("generator", model), ("discriminator", critic)):
        if isinstance(network, torch.nn.Module):
            require(metadata["networks"][prefix]["modes"] ==
                    {name: bool(module.training) for name, module in network.named_modules()},
                    "network modes changed across snapshot")
    metadata.update(tensorDescriptors=descriptors, decompressedBytes=raw_bytes, missing=missing,
                    status="capture_incomplete" if missing else "captured",
                    nonfiniteTensorKeys=[k for k, d in descriptors.items() if not d["allFinite"]],
                    qualificationAllowed=False, replayAllowed=False)
    json_bytes(metadata)
    return payload, metadata


def archive_bytes(payload):
    require(type(payload) is dict and len(payload) <= 2048 and all(type(k) is str and type(v) is torch.Tensor
            and v.device.type == "cpu" and v.layout == torch.strided and v.is_contiguous() and
            not v.requires_grad for k, v in payload.items()), "flat detached CPU dictionary required")
    stream = io.BytesIO()
    torch.save(payload, stream)
    require(stream.tell() + METADATA_RESERVE + PRIMARY_RESERVE <= MAX_CAPTURE, "archive capture budget exceeded")
    encoded = gzip.compress(stream.getvalue(), compresslevel=1, mtime=0)
    require(len(encoded) + METADATA_RESERVE + PRIMARY_RESERVE <= MAX_CAPTURE, "compressed archive budget exceeded")
    return encoded


def safe_load_bytes(raw, expected_sha, metadata):
    """Immutable bytes, pre-load ZIP budget, weights_only, no installing weights."""
    require(type(raw) is bytes and len(raw) <= MAX_CAPTURE and digest(raw) == expected_sha, "archive bytes/SHA differs")
    require(metadata.get("archiveEncoding") == "gzip-torch-flat-cpu-v1" and raw[:8] == b"\x1f\x8b\x08\x00\x00\x00\x00\x00",
            "fixed gzip encoding required")
    decompressor = zlib.decompressobj(wbits=31)
    decoded = decompressor.decompress(raw, MAX_CAPTURE + 1)
    require(len(decoded) + METADATA_RESERVE + PRIMARY_RESERVE <= MAX_CAPTURE and decompressor.eof and
            not decompressor.unused_data and not decompressor.unconsumed_tail, "gzip expansion/extra member rejected")
    descriptors = metadata["tensorDescriptors"]
    require(type(descriptors) is dict and len(descriptors) <= 2048, "bounded descriptors required")
    widths = {"torch.float32": 4, "torch.float64": 8, "torch.uint8": 1,
              "torch.int32": 4, "torch.int64": 8, "torch.bool": 1}
    for key, descriptor in descriptors.items():
        require(type(key) is str and re.fullmatch(r"[A-Za-z0-9_.:]{1,128}", key) and
                type(descriptor) is dict, "invalid tensor descriptor")
        shape = descriptor.get("shape")
        require(type(shape) is list and len(shape) <= 16 and
                all(type(n) is int and 0 <= n <= MAX_CAPTURE for n in shape) and
                descriptor.get("dtype") in widths and type(descriptor.get("bytes")) is int and
                descriptor["bytes"] == math.prod(shape) * widths[descriptor["dtype"]] and
                type(descriptor.get("sha256")) is str and re.fullmatch("[0-9a-f]{64}", descriptor["sha256"]) and
                type(descriptor.get("allFinite")) is bool, "tensor descriptor shape/dtype/bytes/SHA invalid")
    expected_bytes = sum(d["bytes"] for d in descriptors.values())
    require(type(expected_bytes) is int and 0 <= expected_bytes <= MAX_CAPTURE - METADATA_RESERVE - PRIMARY_RESERVE,
            "declared decompressed budget exceeded")
    with zipfile.ZipFile(io.BytesIO(decoded)) as archive:
        entries = archive.infolist()
        require(len(entries) <= 2056 and len({i.filename for i in entries}) == len(entries), "ZIP duplicate/member count")
        for entry in entries:
            require(entry.compress_type == zipfile.ZIP_STORED and not entry.flag_bits & 1 and
                    re.fullmatch(r"archive/(?:data/[0-9]+|data\.pkl|byteorder|version|\.data/serialization_id|\.format_version|\.storage_alignment)", entry.filename) and
                    (not entry.filename.endswith("data.pkl") or entry.file_size <= MAX_JSON),
                    "unsafe/compressed archive member")
        require(sum(e.file_size for e in entries) <= MAX_CAPTURE and
                sum(e.file_size for e in entries if "/data/" in e.filename) == expected_bytes,
                "ZIP decompressed bytes differ")
    tensors = torch.load(io.BytesIO(decoded), weights_only=True, map_location="cpu")
    require(type(tensors) is dict and set(tensors) == set(descriptors), "archive members differ")
    for key, tensor in tensors.items():
        d = descriptors[key]
        require(type(tensor) is torch.Tensor and tensor.device.type == "cpu" and tensor.layout == torch.strided and
                tensor.is_contiguous() and not tensor.requires_grad and str(tensor.dtype) in DTYPES and
                list(tensor.shape) == d["shape"] and str(tensor.dtype) == d["dtype"] and
                tensor.numel() * tensor.element_size() == tensor.untyped_storage().nbytes() == d["bytes"] and
                tensor_sha(tensor) == d["sha256"] and bool(torch.isfinite(tensor).all()) == d["allFinite"],
                "loaded tensor descriptor/SHA/finite flag differs")
    require(sum(v.numel() * v.element_size() for v in tensors.values()) == metadata["decompressedBytes"],
            "loaded total bytes differ")
    return tensors


def _joint_program_limit(mapping, package, context, output, programs):
    """Only the authentic joint v2 package may exceed the former 256 roles."""
    require(type(programs) is dict and 257 <= len(programs) <= 260, "bounded joint program roles required")
    from ai_painter.complete_world import joint_object_priority_quality_checkpoint_v1 as execution
    bound = context.get("executionPackage")
    require(package.get("executionPackage") == bound, "capture execution package binding differs")
    actual = json.loads(mapping.binding(bound, maximum=2 * 1024**2))
    require(actual.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1"
            and actual.get("capabilityVersion") == execution.CAPABILITY, "joint execution package required for260")
    inputs = actual.get("inputEvidence", [])
    require(execution.POLICY in inputs, "trusted joint execution policy v2 omitted")
    plans = [item for item in inputs if item["path"].endswith("/quality-plan.json")]
    require(len(plans) == 1, "one bound joint plan required")
    plan = json.loads(mapping.binding(plans[0], maximum=2 * 1024**2))
    require(plan.get("capabilityVersion") == execution.CAPABILITY and plan.get("runId") == context.get("runId")
            and plan.get("programBindings") == programs and plan.get("modelBinding") == context.get("modelBinding")
            and plan.get("executionPolicy") == execution.POLICY
            and output == plan.get("outputRoot", "") + "/gradient-failure"
            and actual.get("outputRoot") == plan.get("outputRoot")
            and actual.get("programLineage") == {role: item["sha256"] for role, item in programs.items()},
            "joint capture plan/source identity differs")
    policy = json.loads(mapping.binding(execution.POLICY, maximum=1024**2))
    execution.validate_execution_policy(policy, plan["configuration"])
    return 260


def _bound_context(mapping, execution_binding, context, output):
    package = json.loads(mapping.binding(execution_binding))
    require(package.get("schema") == "object-support-structure-failure-capture-execution-v1" and
            package.get("runId") == context.get("runId") and
            output == package.get("outputRoot", "") + "/gradient-failure", "diagnostic execution/root identity differs")
    require(package.get("modelBinding") == context.get("modelBinding") and
            package.get("programBindings") == context.get("programBindings"), "capture model/program binding differs")
    graph = json.loads(mapping.binding(context["modelBinding"]))["graph"]
    programs = context["programBindings"]
    limit = _joint_program_limit(mapping, package, context, output, programs) if type(programs) is dict and len(programs) > 256 else 256
    require(type(programs) is dict and 1 <= len(programs) <= limit, "bounded program roles required")
    for value in programs.values():
        mapping.binding(value, maximum=1024**2)
    samples = context["sampleBindings"]
    require(type(samples) is dict and samples, "source sample/condition bindings required")
    require(set(samples) == {"source", "condition"} and context.get("split") == "train" and
            type(context.get("sampleId")) is str and context["sampleId"], "train source/condition identity required")
    for value in samples.values():
        mapping.binding(value, maximum=MAX_CAPTURE)
    counts = context["optimizerSteps"]
    require(type(counts) is dict and set(counts) == {"generator", "discriminator"} and
            all(type(v) is int and 0 <= v <= 1152 for v in counts.values()), "actual partial counts invalid")
    position = context["failurePosition"]
    require(type(position) is dict and set(position) == {"epoch", "zeroBasedEpochPosition", "trainIndex", "sampleId"} and
            position["sampleId"] == context["sampleId"] and type(position["epoch"]) is int and 1 <= position["epoch"] <= 24 and
            all(type(position[k]) is int and 0 <= position[k] < 48 for k in ("zeroBasedEpochPosition", "trainIndex")),
            "failure position/sample identity differs")
    return package, graph


def validate_manifest(manifest):
    """Validate graph references and completeness independently of tensor loading."""
    graph, descriptors = manifest["graph"], manifest["tensorDescriptors"]
    require(type(graph) is list and len(graph) == PARAMETERS and
            len({r["name"] for r in graph}) == PARAMETERS and
            sum(r["elements"] for r in graph) == ELEMENTS, "manifest108 graph differs")
    referenced = {"rng.torch_cpu"}
    for prefix, network in manifest["networks"].items():
        require(prefix in ("generator", "discriminator") and network["timing"] == "after_exception" and
                type(network["modes"]) is dict and all(type(v) is bool for v in network["modes"].values()),
                "network mode metadata differs")
        parameters, buffers, names = [], [], set()
        for row in network["state"]:
            kind = row["kind"]
            require(kind in ("parameter", "buffer") and row["name"] not in names, "network state alias/kind differs")
            names.add(row["name"])
            rows = parameters if kind == "parameter" else buffers
            require(row["key"] == prefix + "." + kind + "." + str(len(rows)), "state order/key differs")
            rows.append(row)
            referenced.add(row["key"])
            if "gradientKey" in row:
                require(row["gradientKey"] == row["key"] + ".grad", "state gradient key differs")
                referenced.add(row["gradientKey"])
        if prefix == "generator":
            require(len(parameters) == PARAMETERS, "generator108 state required")
            for row, specification in zip(parameters, graph):
                descriptor = descriptors[row["key"]]
                require(row["name"] == specification["name"] and descriptor["shape"] == specification["shape"] and
                        descriptor["dtype"] == specification["dtype"] == "torch.float32" and
                        descriptor["bytes"] == specification["elements"] * 4, "generator graph/state differs")
    require(len(manifest["gradients"]) <= 5, "gradient label count differs")
    for label, gradient in zip(LABELS, manifest["gradients"]):
        require(gradient["label"] == label and len(gradient["parameters"]) == PARAMETERS, "gradient labels/count differ")
        for i, (row, specification) in enumerate(zip(gradient["parameters"], graph)):
            require(row["index"] == i and row["name"] == specification["name"] and type(row["unused"]) is bool,
                    "gradient name/order/unused differs")
            if row["unused"]:
                require(row["key"] is None, "unused gradient must have no tensor")
            else:
                require(row["key"] == "gradient." + label + "." + str(i), "gradient key differs")
                descriptor = descriptors[row["key"]]
                require(descriptor["shape"] == specification["shape"] and descriptor["dtype"] == "torch.float32",
                        "gradient descriptor graph differs")
                referenced.add(row["key"])
    referenced.update("rng." + d for d in manifest["rng"]["cudaDevices"])
    require(referenced == set(descriptors) and manifest["rng"]["timing"] == "after_exception" and
            manifest["qualificationAllowed"] is False and manifest["replayAllowed"] is False and
            len(set(manifest["nonfiniteTensorKeys"])) == len(manifest["nonfiniteTensorKeys"]) and
            set(manifest["nonfiniteTensorKeys"]) == {k for k, d in descriptors.items() if not d["allFinite"]},
            "manifest members/timing/qualification differ")
    require(manifest["status"] != "captured" or (not manifest["missing"] and len(manifest["gradients"]) == 5 and
            set(manifest["networks"]) == {"generator", "discriminator"} and manifest["rng"]["numpy"] is not None),
            "captured completeness differs")


def capture_failure(error, *, model, critic, context, mapping, output, execution_binding,
                    remaining_output_bytes=MAX_CAPTURE):
    """Return incomplete secondary evidence on error; never replace primary error."""
    receipt = {"schema": SCHEMA, "status": "capture_incomplete", "primaryError": primary_error(error),
               "secondaryCaptureFailure": None, "artifacts": {}, "qualificationAllowed": False,
               "replayAllowed": False, "capturedAtUtc": utc(),
               "missing": ["verified tensor snapshot unavailable"],
               "impact": "no complete numerical failure scene; original execution remains failed"}
    root = owned = None
    consumed = False
    ceiling = min(MAX_CAPTURE, remaining_output_bytes) if type(remaining_output_bytes) is int else 0
    try:
        require(PRIMARY_RESERVE + METADATA_RESERVE <= ceiling <= MAX_CAPTURE, "capture budget/reserve exhausted")
        package, graph = _bound_context(mapping, execution_binding, context, output)
        owned, root = mapping.path(package["outputRoot"]), mapping.path(output)
        require(not root.exists(), "capture already consumed; no overwrite/retry")
        root.mkdir(parents=True, exist_ok=False)
        consumed = True
        owned_identity, root_identity = _directory_identity(owned), _directory_identity(root)

        def stable_output():
            mapping.check()
            _plain(root)
            require(_directory_identity(root) == root_identity and _directory_identity(owned) == owned_identity,
                    "capture output directory identity changed")

        def put(name, raw, *, reserve=PRIMARY_RESERVE):
            require(name in FILES, "unknown capture filename")
            stable_output()
            require(directory_bytes(root) + len(raw) + reserve <= ceiling and
                    directory_bytes(owned) + len(raw) + reserve <= MAX_EXECUTION, "actual capture/execution budget exceeded")
            with (root / name).open("xb") as stream:
                require(stream.write(raw) == len(raw), "short capture write")
                stream.flush()
                os.fsync(stream.fileno())
                handle_info = os.fstat(stream.fileno())
                require(stat.S_ISREG(handle_info.st_mode) and handle_info.st_size == len(raw), "capture file type/size differs")
            stable_output()
            require(_file_identity((root / name).lstat(), include_ctime=False) ==
                    _file_identity(handle_info, include_ctime=False), "capture file identity changed")
            return {"path": output + "/" + name, "sha256": digest(raw), "bytes": len(raw)}

        primary = {"primaryError": receipt["primaryError"], "context": context, "timing": "after_exception"}
        primary_raw = json_bytes(primary)
        require(len(primary_raw) <= PRIMARY_RESERVE, "primary error reserve exceeded")
        receipt["artifacts"]["primary"] = put("primary.json", primary_raw, reserve=METADATA_RESERVE)
        payload, metadata = collect_snapshot(error, model=model, critic=critic, graph=graph, context=context)
        validate_manifest(metadata)
        raw = archive_bytes(payload)
        require(directory_bytes(root) + len(raw) + METADATA_RESERVE + PRIMARY_RESERVE <= ceiling,
                "archive would consume metadata/primary reserve")
        safe_load_bytes(raw, digest(raw), metadata)
        receipt["artifacts"]["tensors"] = put("tensors.pt", raw, reserve=METADATA_RESERVE + PRIMARY_RESERVE)
        metadata.update(executionBinding=execution_binding, artifacts=dict(receipt["artifacts"]))
        manifest = json_bytes(metadata)
        require(len(manifest) * 2 <= METADATA_RESERVE and directory_bytes(root) + len(manifest) * 2 + PRIMARY_RESERVE <= ceiling and
                directory_bytes(owned) + len(manifest) * 2 + PRIMARY_RESERVE <= MAX_EXECUTION, "atomic manifest budget exceeded")
        put("manifest.pending.json", manifest)
        stable_output()
        os.link(root / "manifest.pending.json", root / "manifest.json")
        stable_output()
        receipt["artifacts"]["manifest"] = {"path": output + "/manifest.json", "sha256": digest(manifest), "bytes": len(manifest)}
        receipt["status"], receipt["missing"] = metadata["status"], metadata["missing"]
        receipt["impact"] = "diagnostic evidence only; original execution remains failed"
        _bound_context(mapping, execution_binding, context, output)
        return receipt
    except BaseException as secondary:
        receipt["status"] = "capture_incomplete"
        receipt["secondaryCaptureFailure"] = primary_error(secondary)
        receipt["missing"] = [*receipt["missing"], "capture operation failed: " + type(secondary).__name__]
        receipt["impact"] = "capture not independently complete; original execution remains failed"
        if root is not None and consumed:
            try:
                stable_output()
                raw = json_bytes(receipt)
                require(len(raw) <= PRIMARY_RESERVE and directory_bytes(root) + len(raw) <= ceiling and
                        directory_bytes(owned) + len(raw) <= MAX_EXECUTION, "secondary error reserve exhausted")
                with (root / "capture-error.json").open("xb") as stream:
                    stream.write(raw)
                    stream.flush()
                    os.fsync(stream.fileno())
            except BaseException as final:
                receipt["secondaryRecordFailure"] = primary_error(final)
        return receipt


def verify_capture(receipt, mapping):
    require(receipt.get("status") in ("captured", "capture_incomplete") and "manifest" in receipt.get("artifacts", {}),
            "committed capture manifest required")
    manifest_binding = receipt["artifacts"]["manifest"]
    logical = manifest_binding["path"]
    require(logical.endswith("/gradient-failure/manifest.json"), "manifest path differs")
    manifest_raw = mapping.binding({k: manifest_binding[k] for k in ("path", "sha256")})
    require(len(manifest_raw) == manifest_binding["bytes"], "manifest size differs")
    manifest = json.loads(manifest_raw)
    output = logical.rsplit("/", 1)[0]
    _package, graph = _bound_context(mapping, manifest["executionBinding"], manifest["context"], output)
    require(manifest["schema"] == SCHEMA and manifest["status"] == receipt["status"] and manifest["graph"] == graph and
            manifest["labels"] == list(LABELS) and manifest["stateTiming"] == "after_exception", "manifest identity differs")
    validate_manifest(manifest)
    for kind, name in (("primary", "primary.json"), ("tensors", "tensors.pt")):
        b = manifest["artifacts"][kind]
        require(b["path"] == output + "/" + name, "artifact path escaped")
        raw = mapping.binding({k: b[k] for k in ("path", "sha256")}, maximum=MAX_CAPTURE)
        require(len(raw) == b["bytes"], "artifact size differs")
        require(b == receipt["artifacts"][kind], "receipt artifact binding differs")
        if kind == "primary":
            primary = json.loads(raw)
            require(primary["primaryError"] == receipt["primaryError"] and primary["context"] == manifest["context"] and
                    primary["timing"] == "after_exception", "primary error/context differs")
    tensors = safe_load_bytes(raw, manifest["artifacts"]["tensors"]["sha256"], manifest)
    require(manifest["status"] != "captured" or (not manifest["missing"] and len(manifest["gradients"]) == 5 and
            set(manifest["networks"]) == {"generator", "discriminator"}), "captured completeness differs")
    return manifest, tensors

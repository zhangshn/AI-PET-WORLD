"""Standalone, bounded CPU analysis of an explicitly bound closed failure.

No model construction, source pixels, qualification, repair or execution replay.
The supervisor owns a Windows Job before the CPU worker is resumed.
"""
from __future__ import annotations
import argparse
import ctypes
from contextlib import contextmanager
from ctypes import wintypes
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import pickletools
import re
import subprocess
import sys
import time
import uuid
import zipfile

ROOT = Path(os.path.abspath(__file__)).parents[3]
ENTRY = "ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py"
TEST = "ml/ai-painter/tests/test_analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py"
CAPTURE = "ml/ai-painter/src/ai_painter/complete_world/appearance_regime_gradient_failure_capture.py"
CAPTURE_SHA = "20dfbcd0fe87b26c7b56043dd792624d82d6ab2840cad90b13525acc9b933eef"
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/post-capture-t-q4-38"
SCHEMA = "appearance-regime-gradient-failure-snapshot-cpu-analysis-v1"
VERSION = "appearance_regime_gradient_failure_capture_v1"
CAPABILITY = "stage4_mvp256_dry_appearance_regime_bias_precision_v1"
PRODUCTION_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-cpu-analyses-v1"
DISPATCH_SCHEMA = "appearance-regime-gradient-failure-analysis-dispatch-v1"
PRODUCTION_MODE = "closed-failure-cpu-analysis-v1"
FORMAL = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
FORMAL_SHA = "7eb9495572ff0b908297f1773e1fb724196287d59cf86dd6a5878fb4b6ccee3a"
IMPLEMENTATION_PARENT = OUTPUT_PARENT + "/next-t-q4-39/migration-implementation"
PRODUCTION_PROGRAMS = (ENTRY, TEST, CAPTURE,
    "scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
    "scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs",
    "scripts/lib/ai-painter-owned-worker-v1.mjs",
    "scripts/lib/ai-painter-owned-worker-native-v1.mjs",
    "scripts/windows/ai-painter-owned-worker-owner.cs",
    "scripts/tests/test-ai-painter-owned-worker.mjs",
    "scripts/tests/test-ai-painter-owned-worker-native.mjs",
    "scripts/fixtures/ai-painter-owned-worker.mjs")
LIMITS = {"cpuThreads": 2, "wallSeconds": 120, "outputBytes": 8 * 1024 * 1024,
          "jsonBytes": 2 * 1024 * 1024, "captureBytes": 64 * 1024 * 1024,
          "failureReserveBytes": 65536, "automaticRetries": 0}
BOUNDARY = {"diagnosticOnly": True, "trainingAllowed": False,
            "checkpointPromotion": False, "qualificationGranted": False,
            "runtimePublication": False, "automaticRetries": 0,
            "modelForwards": 0, "autogradCalls": 0, "optimizerSteps": 0,
            "sourcePixelReads": 0, "rootCause": "unknown"}


def require(value, message):
    if not value:
        raise ValueError(message)


def encoded(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2,
                       allow_nan=False) + "\n").encode("utf-8")


def digest(value):
    return hashlib.sha256(value).hexdigest()


def deadline_check(deadline):
    require(time.monotonic() < deadline, "analysis deadline exhausted")


def file_hash(file, deadline):
    result = hashlib.sha256()
    with file.open("rb") as stream:
        while True:
            deadline_check(deadline)
            chunk = stream.read(1024 * 1024)
            if not chunk:
                return result.hexdigest()
            result.update(chunk)


def logical_path(root, logical):
    require(type(logical) is str and logical and len(logical) <= 4096
            and not re.search(r"[:\\\x00]", logical)
            and not logical.startswith("/")
            and all(part not in ("", ".", "..", "latest", "latest.json")
                    for part in logical.split("/")), "unsafe logical path")
    file = root / logical
    runtime = (root / ".runtime").resolve()
    expected = runtime.joinpath(*Path(logical).parts[1:]) if logical.startswith(".runtime/") else root.resolve() / logical
    require(file.resolve() == expected, "unregistered path redirect")
    return file


class Reader:
    def __init__(self, root, deadline):
        self.root, self.deadline, self.observed = root, deadline, {}

    def bound(self, binding, *, json_data=True, maximum=None):
        require(type(binding) is dict and set(binding) in ({"path", "sha256"}, {"path", "sha256", "bytes"})
                and re.fullmatch(r"[a-f0-9]{64}", binding.get("sha256", "")), "invalid evidence binding")
        file = logical_path(self.root, binding["path"])
        limit = maximum if maximum is not None else LIMITS["jsonBytes"]
        require(file.is_file() and file.stat().st_size <= limit, "input file/size differs")
        if "bytes" in binding:
            require(type(binding["bytes"]) is int and file.stat().st_size == binding["bytes"], "input bytes differ")
        sha = file_hash(file, self.deadline)
        require(sha == binding["sha256"], "input SHA differs: " + binding["path"])
        require(binding["path"] not in self.observed or self.observed[binding["path"]] == sha, "input binding conflict")
        self.observed[binding["path"]] = sha
        if not json_data:
            return file
        raw = file.read_bytes()
        require(digest(raw) == sha and len(raw) <= limit, "input changed while reading")
        return json.loads(raw)

    def absolute_artifact(self, binding, run, filename, *, json_data):
        require(type(binding) is dict and set(binding) == {"path", "sha256", "bytes"}, "artifact binding fields differ")
        file = Path(binding["path"])
        target = run / "failure-capture" / filename
        require(file.is_absolute() and not any(p in (".", "..") for p in re.split(r"[/\\]", binding["path"]))
                and file.resolve() == run.resolve() / "failure-capture" / filename
                and file.absolute() in (target.absolute(), target.resolve()),
                "capture artifact outside exact bound Run")
        logical = str((run / "failure-capture" / filename).relative_to(self.root)).replace("\\", "/")
        return self.bound({**binding, "path": logical}, json_data=json_data,
                          maximum=LIMITS["jsonBytes"] if json_data else LIMITS["captureBytes"])

    def unchanged(self):
        for logical, sha in self.observed.items():
            require(file_hash(logical_path(self.root, logical), self.deadline) == sha, "input changed after verification")


def program_bindings(root, deadline):
    result = [{"path": p, "sha256": file_hash(logical_path(root, p), deadline)}
              for p in (ENTRY, TEST, CAPTURE)]
    require(result[-1]["sha256"] == CAPTURE_SHA, "frozen capture module differs")
    return result


def load_capture(root):
    file = logical_path(root, CAPTURE)
    require(file_hash(file, time.monotonic() + LIMITS["wallSeconds"]) == CAPTURE_SHA, "frozen capture module differs")
    spec = importlib.util.spec_from_file_location("snapshot_frozen_capture", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_metadata(manifest, graph):
    require(manifest["status"] == "failure_evidence_captured", "incomplete capture; evidence unknown")
    require(manifest.get("gradientEvidenceComplete") is True, "incomplete gradient evidence; evidence unknown")
    model = manifest["networks"]["model"]["parameters"]
    canonical = graph["parameters"]
    require(graph["tensors"] == 107 and len(model) == len(canonical) == 107,
            "canonical parameter count differs")
    require(len({p["name"] for p in model}) == 107 and len({p["key"] for p in model}) == 107,
            "duplicate canonical parameter")
    descriptors = manifest["tensorDescriptors"]
    require(type(descriptors) is dict and 0 < len(descriptors) <= 1024,
            "tensor descriptor count differs")
    total_bytes = 0
    allowed_dtypes = {"torch.float32": 4, "torch.float64": 8, "torch.int64": 8,
                      "torch.int32": 4, "torch.uint8": 1, "torch.bool": 1}
    for key, descriptor in descriptors.items():
        shape = descriptor["shape"]
        require(type(key) is str and len(key) <= 256 and type(shape) is list and len(shape) <= 8
                and all(type(n) is int and 0 <= n <= LIMITS["captureBytes"] for n in shape)
                and descriptor["dtype"] in allowed_dtypes, "invalid tensor descriptor")
        size = math.prod(shape) * allowed_dtypes[descriptor["dtype"]]
        require(type(descriptor["bytes"]) is int and descriptor["bytes"] == size
                and re.fullmatch(r"[a-f0-9]{64}", descriptor["sha256"]), "descriptor bytes/hash differs")
        total_bytes += size
    require(total_bytes <= LIMITS["captureBytes"], "tensor descriptor bytes exceed capture budget")
    groups = manifest["gradientSets"]
    require(type(groups) is list and len(groups) == 4 and all(type(g) is list and len(g) == 107 for g in groups),
            "four complete gradient sets required")
    for i, (actual, expected) in enumerate(zip(model, canonical)):
        require(actual["name"] == expected["name"] and actual["shape"] == expected["shape"]
                and actual["key"] == "model.parameter." + str(i)
                and actual["dtype"] == "torch.float32", "canonical graph/order/shape differs")
        require(actual["key"] in descriptors and descriptors[actual["key"]]["shape"] == actual["shape"]
                and descriptors[actual["key"]]["dtype"] == actual["dtype"], "model tensor descriptor differs")
        for group_index, group in enumerate(groups):
            item = group[i]
            require(type(item) is dict, "gradient record differs")
            if item.get("key") is None:
                require(item == {"key": None, "unused": True}, "None gradient semantic differs")
            else:
                key = "gradient." + str(group_index) + "." + str(i)
                require(item.get("key") == key and item.get("unused") is False
                        and item.get("shape") == actual["shape"] and item.get("dtype") == "torch.float32"
                        and key in descriptors and descriptors[key]["shape"] == actual["shape"]
                        and descriptors[key]["dtype"] == "torch.float32", "gradient reference/shape/dtype differs")
    match = re.fullmatch(r"actual total gradient identity differs at parameter (\d+)", manifest["originalError"]["message"])
    require(manifest["originalError"]["type"] == "builtins.ValueError" and match
            and 0 <= int(match.group(1)) < 107, "unknown original failure; root cause unknown")
    require(manifest["executionQualified"] is False, "capture cannot grant qualification")
    return model


def preflight(reader, terminal_binding):
    terminal = reader.bound(terminal_binding)
    require(terminal.get("status") == "experiment_failed_closed" and terminal.get("executionState") == "failed_closed"
            and terminal.get("executionVersion") == VERSION and terminal.get("capabilityVersion") == CAPABILITY,
            "unsupported closed failure identity")
    run = logical_path(reader.root, terminal_binding["path"]).parent
    require(terminal_binding["path"].endswith("/failure.json"), "explicit failure terminal required")
    for binding, filename in ((terminal["workerTerminal"], "phase-terminal.json"),
                              (terminal["executionPackage"], "execution-package.json"),
                              (terminal["progress"], "progress.json"),
                              (terminal["diagnosticEvidence"]["captureStarted"], "failure-capture-started.json")):
        require(logical_path(reader.root, binding["path"]) == run / filename, "cross-Run terminal path differs")
    phase = reader.bound(terminal["workerTerminal"])
    require(logical_path(reader.root, phase["failureCaptureReceipt"]["path"]) == run / "failure-capture-diagnostic.json",
            "cross-Run capture diagnostic path differs")
    package = reader.bound(phase["executionPackage"])
    policy = reader.bound(phase["candidateContract"])
    progress = reader.bound(terminal["progress"])
    started = reader.bound(terminal["diagnosticEvidence"]["captureStarted"])
    diagnostic = reader.bound(phase["failureCaptureReceipt"])
    for record in (phase, package, progress, started):
        require(all(record.get(k) == terminal[k] for k in ("runId", "packageId", "capabilityVersion")), "cross-Run identity differs")
    require(package["executionVersion"] == policy["executionVersion"] == phase["executionVersion"] == VERSION
            and package["outputRoot"] == str(run.relative_to(reader.root)).replace("\\", "/")
            and package["candidateContract"] == phase["candidateContract"]
            and terminal["executionPackage"] == phase["executionPackage"], "base/policy identity differs")
    require(phase["status"] == "experiment_failed_closed" and phase["executionState"] == "failed_closed", "worker not failed closed")
    capture = phase["failureCapture"]
    require(terminal["failureCapture"] == capture and diagnostic == capture, "capture diagnostic/terminal differs")
    receipt = capture["captureReceipt"]
    require(receipt["status"] == "failure_evidence_captured" and receipt["executionQualified"] is False, "incomplete capture; evidence unknown")
    manifest = reader.absolute_artifact(receipt["artifacts"]["manifest"], run, "gradient-failure-manifest.json", json_data=True)
    primary = reader.absolute_artifact(receipt["artifacts"]["primary"], run, "gradient-failure-primary.json", json_data=True)
    require(receipt["artifacts"]["primary"] == manifest["artifacts"]["primary"]
            and receipt["artifacts"]["tensors"] == manifest["artifacts"]["tensors"]
            and manifest["executionBinding"] == phase["executionPackage"], "capture artifact/base bindings differ")
    counts = {"generator": phase["optimizerStepsGenerator"], "discriminator": phase["optimizerStepsDiscriminator"]}
    require(all(type(v) is int and 0 <= v <= 2304 for v in counts.values()), "actual counts invalid")
    for record in (terminal, progress, started):
        require(record["optimizerStepsGenerator"] == counts["generator"] and record["optimizerStepsDiscriminator"] == counts["discriminator"], "actual counts conflict")
    require(receipt["counts"] == manifest["counts"] == primary["counts"] == capture["optimizerSteps"] == counts, "capture counts conflict")
    location = receipt["location"]
    require(location == manifest["location"] == primary["location"] and location["origin"] == "explicit_capture_call"
            and location["inferredSample"] is False and location["split"] == "train"
            and type(location["epoch"]) is int and 1 <= location["epoch"] <= 48
            and type(location["trainPosition"]) is int and 1 <= location["trainPosition"] <= 48
            and all(started[k] == location[k] == capture[k] for k in ("epoch", "trainPosition", "sampleId")), "explicit sample/location conflict")
    original = receipt["originalError"]
    require(original == manifest["originalError"] == primary["originalError"] and phase["error"] == original["message"]
            and started["originalError"] == capture["originalError"] == original["message"], "original error conflict")
    split = reader.bound(package["trainSplit"])
    require(split.get("split") == "train" and len(split["sampleIds"]) == len(set(split["sampleIds"])) == 48
            and location["sampleId"] in split["sampleIds"], "sample not in exact train membership")
    proof = reader.bound(policy["modelCpuEvidence"])
    require(proof["status"] == "cpu_execution_bridge_checked_not_gpu_qualified" and proof["capabilityVersion"] == CAPABILITY
            and proof["optimizerSteps"] == 0 and proof["gpuInitialized"] is False, "canonical graph evidence differs")
    require(type(proof.get("synthetic")) is bool, "graph evidence synthetic scope absent")
    if proof["synthetic"]:
        logical_run = str(run.relative_to(reader.root)).replace("\\", "/")
        require(logical_run.startswith(OUTPUT_PARENT + "/lifecycle-implementation/synthetic-")
                or logical_run.startswith(IMPLEMENTATION_PARENT + "/synthetic-"),
                "synthetic graph outside isolated test namespace")
    validate_metadata(manifest, proof["actualGraph"])
    # File-byte identity only here; deserialization is confined to the owned worker.
    reader.absolute_artifact(receipt["artifacts"]["tensors"], run, "gradient-failure-tensors.pt", json_data=False)
    for binding in package["programBindings"].values():
        reader.bound(binding, json_data=False)
    return {"terminal": terminal, "phase": phase, "package": package, "policy": policy,
            "receipt": receipt, "manifest": manifest,
            "graph": proof["actualGraph"], "synthetic": proof.get("synthetic", False),
            "counts": counts, "location": location, "originalError": original,
            "bindings": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())]}


def production_program_bindings(root, deadline):
    rows = [{"path": p, "sha256": file_hash(logical_path(root, p), deadline)} for p in PRODUCTION_PROGRAMS]
    require(rows[2]["sha256"] == CAPTURE_SHA, "frozen capture module differs")
    return rows


def dispatch_identity(request):
    # Output is derived, never authorized by a caller-supplied path/boolean.
    return digest(encoded({k: v for k, v in request.items() if k not in ("dispatchIdentity", "outputRoot")}))


def production_preflight(reader, dispatch_binding):
    request = reader.bound(dispatch_binding)
    fields = {"schemaVersion", "mode", "sourceFailure", "sourceExecutionPackage", "sourceCapture",
              "runId", "packageId", "capabilityVersion", "executionVersion", "programBindings",
              "formalSpecification", "algorithm", "limits", "dispatchIdentity", "outputRoot"}
    require(type(request) is dict and set(request) == fields, "production dispatch fields differ")
    require(request["schemaVersion"] == DISPATCH_SCHEMA and request["mode"] == PRODUCTION_MODE
            and request["algorithm"] == SCHEMA and request["limits"] == LIMITS,
            "production algorithm/resource contract differs")
    require(request["capabilityVersion"] == CAPABILITY and request["executionVersion"] == VERSION,
            "production capability/version differs")
    identity = dispatch_identity(request)
    require(request["dispatchIdentity"] == identity and request["outputRoot"] == PRODUCTION_PARENT + "/" + identity,
            "production deterministic output identity differs")
    require(dispatch_binding["path"] == request["outputRoot"] + "/dispatch-request.json",
            "production request outside exact derived namespace")
    require(request["formalSpecification"] == {"path": FORMAL, "sha256": FORMAL_SHA},
            "production formal adoption differs")
    reader.bound(request["formalSpecification"], json_data=False)
    programs = production_program_bindings(reader.root, reader.deadline)
    require(request["programBindings"] == programs, "production program closure differs")
    for binding in programs:
        reader.bound(binding, json_data=False)
    context = preflight(reader, request["sourceFailure"])
    require(all(context["terminal"][k] == request[k] for k in ("runId", "packageId", "capabilityVersion", "executionVersion"))
            and context["terminal"]["executionPackage"] == request["sourceExecutionPackage"],
            "production source Run/package identity differs")
    require(request["sourceCapture"] == context["receipt"]["artifacts"], "production capture bindings differ")
    adoption = {"schemaVersion": DISPATCH_SCHEMA, "mode": PRODUCTION_MODE,
                "namespace": PRODUCTION_PARENT, "algorithm": SCHEMA, "limits": LIMITS,
                "programBindings": programs, "formalSpecification": request["formalSpecification"]}
    require(context["policy"].get("failureSnapshotAnalysis") == adoption,
            "future policy production mode not adopted")
    require(context["policy"].get("formalSpecification") == request["formalSpecification"],
            "future policy formal binding differs")
    context["bindings"] = [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())]
    return request, context, programs


def production_deadline(parent_deadline_unix_ms, *, started=None):
    require(type(parent_deadline_unix_ms) is int and 0 < parent_deadline_unix_ms < 10**15,
            "explicit parent deadline required")
    now = time.monotonic()
    deadline = min((now if started is None else started) + LIMITS["wallSeconds"],
                   now + (parent_deadline_unix_ms / 1000 - time.time()))
    require(deadline - now >= 1, "parent deadline insufficient; dispatch unavailable")
    return deadline


def analyze_production_dispatch(*, dispatch_binding, parent_deadline_unix_ms, root=ROOT, started=None):
    deadline = production_deadline(parent_deadline_unix_ms, started=started)
    reader = Reader(Path(os.path.abspath(root)), deadline)
    request, _, _ = production_preflight(reader, dispatch_binding)
    return _analyze_failure_snapshot(terminal_binding=request["sourceFailure"],
        output_root=request["outputRoot"], root=root, deadline=deadline, dispatch_binding=dispatch_binding)


def output_bytes(root):
    total = 0
    for file in root.rglob("*"):
        require(file.resolve().is_relative_to(root.resolve()) and not file.is_symlink(), "output redirect detected")
        if file.is_file():
            total += file.stat().st_size
    return total


def write_exclusive(root, name, value, *, failure=False):
    raw = encoded(value)
    # Worker error and unique final terminal each retain a pending witness.
    maximum = LIMITS["failureReserveBytes"] // 4 if failure else LIMITS["jsonBytes"]
    available = LIMITS["outputBytes"] - (0 if failure else LIMITS["failureReserveBytes"])
    require(len(raw) <= maximum and output_bytes(root) + 2 * len(raw) <= available, "analysis output budget exceeded")
    file = root / name
    require(not file.exists() and not file.is_symlink(), "immutable output already exists")
    pending = root / (name + ".pending-" + uuid.uuid4().hex)
    with pending.open("xb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    require(pending.read_bytes() == raw, "pending output readback differs")
    require(output_bytes(root) + len(raw) <= available, "analysis commit budget exceeded")
    # Atomic no-overwrite publication. Retain pending witness and charge BOTH
    # directory entries. No fallible operation follows the commit point.
    os.link(pending, file)
    return {"path": str(file), "sha256": digest(raw)}


def compare_snapshot(context, capture, tensors):
    model = validate_metadata(context["manifest"], context["graph"])
    named = [(item["name"], tensors[item["key"]]) for item in model]
    actual = capture._comparison(named, context["manifest"]["gradientSets"], tensors, [],
                                 ValueError(context["originalError"]["message"]))
    if actual != context["manifest"]["comparison"]:
        error = ValueError("saved comparison conflicts with independently recomputed statistics")
        error.comparison_conflict = {"saved": context["manifest"]["comparison"], "recomputed": actual}
        raise error
    return actual


@contextmanager
def locked_capture_archive(file):
    """Permit shared reads, deny writes/deletion until frozen verifier finishes."""
    require(os.name == "nt", "Windows read lock required")
    dll = ctypes.WinDLL("kernel32", use_last_error=True)
    dll.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                               wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    dll.CreateFileW.restype = wintypes.HANDLE
    dll.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = dll.CreateFileW(str(file.resolve()), 0x80000000, 1, None, 3, 0x80, None)
    if handle == ctypes.c_void_p(-1).value:
        raise OSError(ctypes.get_last_error(), "capture read lock failed")
    try:
        yield
    finally:
        dll.CloseHandle(handle)


def inspect_tensor_archive(file, descriptors, *, expected_sha=None):
    """Inspect ZIP and a NON-EXECUTING, restricted protocol-2 pickle grammar.

    Bound referenced storages before torch.load. This bounds archive/storage
    expansion, not the Python/PyTorch process working set or temporary copies.
    Unsupported serialization variants fail closed, without a loader fallback.
    """
    require(file.stat().st_size <= LIMITS["captureBytes"], "archive file over budget")
    with file.open("rb") as stream:
        archive_raw = stream.read(LIMITS["captureBytes"] + 1)
    require(len(archive_raw) <= LIMITS["captureBytes"], "archive file grew over budget")
    if expected_sha is not None:
        require(digest(archive_raw) == expected_sha, "archive preflight SHA differs")
    with zipfile.ZipFile(io.BytesIO(archive_raw)) as archive:
        members = archive.infolist()
        require(0 < len(members) <= 2048, "archive member count differs")
        names, roots, storages = set(), set(), {}
        total = 0
        pickle_name = None
        for item in members:
            parts = item.filename.split("/")
            require(len(parts) >= 2 and all(p and p not in (".", "..") for p in parts)
                    and not any(c in item.filename for c in ("\\", ":", "\x00"))
                    and item.filename not in names, "duplicate/unsafe ZIP member")
            names.add(item.filename)
            roots.add(parts[0])
            require(not item.flag_bits & 1 and item.compress_type == zipfile.ZIP_STORED
                    and item.compress_size == item.file_size, "compressed/encrypted ZIP refused")
            require(0 <= item.file_size <= LIMITS["captureBytes"], "ZIP member over budget")
            total += item.file_size
            require(total <= LIMITS["captureBytes"], "ZIP total uncompressed bytes over budget")
            suffix = "/".join(parts[1:])
            if suffix == "data.pkl":
                require(item.file_size <= LIMITS["jsonBytes"], "pickle member over budget")
                pickle_name = item.filename
            elif re.fullmatch(r"data/[0-9]+", suffix):
                storages[parts[-1]] = item.file_size
            else:
                require(suffix in ("version", "byteorder", ".data/serialization_id", ".format_version", ".storage_alignment")
                        and item.file_size <= 65536, "unsupported archive member")
        require(len(roots) == 1 and pickle_name is not None and len(storages) <= 1024,
                "archive root/pickle/storage structure differs")
        raw = archive.read(pickle_name)
    stack, memo, marker = [], {}, object()
    storage_refs = {}
    storage_types = {"FloatStorage": ("torch.float32", 4), "DoubleStorage": ("torch.float64", 8),
                     "LongStorage": ("torch.int64", 8), "IntStorage": ("torch.int32", 4),
                     "ByteStorage": ("torch.uint8", 1), "BoolStorage": ("torch.bool", 1)}
    def marked():
        i = len(stack) - 1
        while i >= 0 and stack[i] is not marker:
            i -= 1
        require(i >= 0, "pickle MARK absent")
        values = stack[i + 1:]
        del stack[i:]
        return values
    final = None
    for step, (op, arg, position) in enumerate(pickletools.genops(raw)):
        require(step < 200000 and len(stack) <= 8192 and len(memo) <= 20000, "pickle complexity budget")
        name = op.name
        if name == "PROTO":
            require(step == 0 and arg == 2, "only frozen protocol-2 tensor pickle supported")
        elif name == "EMPTY_DICT":
            stack.append({})
        elif name == "MARK":
            stack.append(marker)
        elif name in ("BINUNICODE", "SHORT_BINUNICODE", "UNICODE"):
            require(len(arg) <= 4096, "pickle string over budget")
            stack.append(arg)
        elif name in ("BININT", "BININT1", "BININT2", "LONG1", "LONG4", "INT", "LONG"):
            require(type(arg) is int and abs(arg) <= LIMITS["captureBytes"], "pickle integer over budget")
            stack.append(arg)
        elif name in ("NEWFALSE", "NEWTRUE", "NONE"):
            stack.append({"NEWFALSE": False, "NEWTRUE": True, "NONE": None}[name])
        elif name == "GLOBAL":
            module, symbol = arg.split(" ", 1)
            require((module == "torch" and symbol in storage_types)
                    or (module, symbol) in (("torch._utils", "_rebuild_tensor_v2"), ("collections", "OrderedDict")),
                    "unsupported pickle GLOBAL")
            stack.append(("global", module, symbol))
        elif name in ("BINPUT", "LONG_BINPUT"):
            require(stack and arg not in memo, "pickle memo collision")
            memo[arg] = stack[-1]
        elif name in ("BINGET", "LONG_BINGET"):
            require(arg in memo, "pickle memo missing")
            stack.append(memo[arg])
        elif name == "EMPTY_TUPLE":
            stack.append(())
        elif name == "TUPLE":
            stack.append(tuple(marked()))
        elif name in ("TUPLE1", "TUPLE2", "TUPLE3"):
            count = int(name[-1])
            require(len(stack) >= count, "pickle tuple stack differs")
            values = tuple(stack[-count:])
            del stack[-count:]
            stack.append(values)
        elif name == "BINPERSID":
            value = stack.pop()
            require(type(value) is tuple and len(value) == 5 and value[0] == "storage"
                    and type(value[1]) is tuple and value[1][:2] == ("global", "torch")
                    and value[1][2] in storage_types and value[3] == "cpu"
                    and type(value[2]) is str and value[2] in storages
                    and type(value[4]) is int and value[4] >= 0, "unsafe storage declaration")
            dtype, item_size = storage_types[value[1][2]]
            require(value[4] * item_size == storages[value[2]], "pickle storage size differs from ZIP record")
            ref = ("storage", value[2], dtype, value[4])
            require(value[2] not in storage_refs or storage_refs[value[2]] == ref, "storage alias metadata conflict")
            storage_refs[value[2]] = ref
            stack.append(ref)
        elif name == "REDUCE":
            args, function = stack.pop(), stack.pop()
            require(type(args) is tuple, "unsafe pickle REDUCE arguments")
            if function == ("global", "collections", "OrderedDict"):
                require(args == (), "nonempty OrderedDict reduction refused")
                stack.append({})
            else:
                require(function == ("global", "torch._utils", "_rebuild_tensor_v2")
                        and len(args) == 6 and type(args[0]) is tuple and args[0][0] == "storage"
                        and type(args[1]) is int and args[1] >= 0 and args[4] is False
                        and args[5] == {} and type(args[2]) is tuple and type(args[3]) is tuple
                        and len(args[2]) == len(args[3]) <= 8
                        and all(type(v) is int and v >= 0 for v in args[2] + args[3]), "unsafe tensor reduction")
                storage, offset, shape, stride = args[:4]
                maximum = offset + sum((n - 1) * s for n, s in zip(shape, stride)) if math.prod(shape) else offset
                require(maximum < storage[3] if math.prod(shape) else maximum <= storage[3], "tensor view outside storage")
                stack.append(("tensor", storage[1], storage[2], shape))
        elif name in ("SETITEM", "SETITEMS"):
            values = marked() if name == "SETITEMS" else [stack.pop(-2), stack.pop()]
            require(stack and type(stack[-1]) is dict and len(values) % 2 == 0, "pickle dictionary differs")
            for key, value in zip(values[::2], values[1::2]):
                require(type(key) is str and key not in stack[-1], "duplicate/invalid tensor key")
                stack[-1][key] = value
        elif name == "STOP":
            require(len(stack) == 1 and type(stack[0]) is dict and position + 1 == len(raw), "tensor pickle root/trailing bytes differ")
            final = stack[0]
        else:
            raise ValueError("unsupported pickle opcode: " + name)
    require(final is not None and set(final) == set(descriptors) and set(storage_refs) == set(storages),
            "archive tensor/storage identities differ")
    for key, value in final.items():
        descriptor = descriptors[key]
        require(type(value) is tuple and value[0] == "tensor" and value[2] == descriptor["dtype"]
                and list(value[3]) == descriptor["shape"], "pickle tensor descriptor differs")
    return {"zipMembers": len(members), "uncompressedBytes": total,
            "storageBytes": sum(storages.values()), "storages": len(storages),
            "pickleProtocol": 2, "processMemoryBound": False}


def worker(root, terminal_binding, output, identity, *, deadline, dispatch_binding=None):
    started = time.monotonic()
    deadline_check(deadline)
    verify_owned_worker()
    claim = json.loads((output / "analysis-inputs.json").read_bytes())
    require(claim["identity"] == identity and claim["terminalBinding"] == terminal_binding, "owned worker input identity differs")
    # This process only runs after supervisor Job assignment; no work before it.
    capture = load_capture(root)
    torch = capture.torch
    require(not torch.cuda.is_initialized(), "CUDA already initialized")
    old_threads = torch.get_num_threads()
    rng = torch.random.get_rng_state().clone()
    try:
        torch.set_num_threads(2)
        reader = Reader(root, deadline)
        if dispatch_binding is None:
            context = preflight(reader, terminal_binding)
            current_programs = program_bindings(root, deadline)
        else:
            _, context, current_programs = production_preflight(reader, dispatch_binding)
        require(claim.get("dispatchBinding") == dispatch_binding, "worker dispatch binding differs")
        require(context["bindings"] == claim["inputBindings"] and digest(encoded({"inputs": context["bindings"],
                "programs": current_programs, "algorithm": SCHEMA, "limits": LIMITS})) == identity,
                "worker immutable analysis inputs changed")
        artifact = context["receipt"]["artifacts"]["tensors"]
        with locked_capture_archive(Path(artifact["path"])):
            archive_guard = inspect_tensor_archive(Path(artifact["path"]), context["manifest"]["tensorDescriptors"],
                                                  expected_sha=artifact["sha256"])
            _, tensors = capture.verify_gradient_failure_capture(context["receipt"])
        comparison = compare_snapshot(context, capture, tensors)
        reader.unchanged()
        require(torch.equal(rng, torch.random.get_rng_state()) and not torch.cuda.is_initialized(), "analysis changed RNG/CUDA state")
        deadline_check(deadline)
        report = {"schemaVersion": SCHEMA, "status": "worker_snapshot_verified_pending_supervisor_commit",
                  "identity": identity, "terminalBinding": terminal_binding,
                  "inputBindings": context["bindings"], "programBindings": current_programs,
                  "counts": context["counts"], "location": context["location"], "originalError": context["originalError"],
                  "comparison": comparison, "savedStatisticsMatch": True, "synthetic": context["synthetic"],
                  "boundary": BOUNDARY, "limits": LIMITS, "gpuInitialized": False,
                  "snapshotDeserializations": 1, "archivePreflight": archive_guard,
                  "elapsedSeconds": time.monotonic() - started}
        return write_exclusive(output, "worker-result.json", report)
    except BaseException as error:
        conflict = getattr(error, "comparison_conflict", None)
        conflict_binding = None
        publication_error = None
        try:
            if conflict is not None:
                conflict_binding = write_exclusive(output, "comparison-conflict.json", conflict)
        except BaseException as secondary:
            publication_error = str(secondary)[:4096]
        failure = {"schemaVersion": SCHEMA, "status": "worker_analysis_failed_uncommitted", "identity": identity,
                   "errorType": type(error).__name__, "error": str(error)[:4096],
                   "comparisonConflict": conflict_binding, "publicationError": publication_error, "boundary": BOUNDARY}
        try:
            write_exclusive(output, "worker-error.json", failure, failure=True)
        except BaseException as secondary:
            error.analysis_publication_error = str(secondary)
        raise
    finally:
        torch.random.set_rng_state(rng)
        torch.set_num_threads(old_threads)


def verify_owned_worker():
    require(os.name == "nt", "Windows owned worker required")
    name = os.environ.get("AI_PAINTER_SNAPSHOT_JOB", "")
    require(re.fullmatch(r"Local\\ai-painter-snapshot-[a-f0-9]{32}", name), "worker must be launched by owned supervisor")
    dll = ctypes.WinDLL("kernel32", use_last_error=True)
    dll.OpenJobObjectW.argtypes, dll.OpenJobObjectW.restype = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR], wintypes.HANDLE
    dll.GetCurrentProcess.restype = wintypes.HANDLE
    dll.IsProcessInJob.argtypes, dll.IsProcessInJob.restype = [wintypes.HANDLE, wintypes.HANDLE, ctypes.POINTER(wintypes.BOOL)], wintypes.BOOL
    dll.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = dll.OpenJobObjectW(0x0004, False, name)  # QUERY only, never termination
    require(handle, "owned supervisor Job absent")
    try:
        belongs = wintypes.BOOL()
        require(dll.IsProcessInJob(dll.GetCurrentProcess(), handle, ctypes.byref(belongs)) and belongs.value,
                "worker is outside its exact owned Job")
    finally:
        dll.CloseHandle(handle)  # do not retain a handle across analysis/parent loss


def run_owned_process(argv, *, cwd, deadline, evidence_root):
    """Only kill a private Job handle, or our never-resumed process handle.

    Never take over a named Job, recover a PID, or launch through a shell.
    """
    require(os.name == "nt", "Windows owned process boundary required")
    import _winapi
    from ctypes import wintypes as wt

    class Basic(ctypes.Structure):
        _fields_ = [("user", ctypes.c_longlong), ("job", ctypes.c_longlong), ("flags", wt.DWORD),
                    ("minimum", ctypes.c_size_t), ("maximum", ctypes.c_size_t), ("count", wt.DWORD),
                    ("affinity", ctypes.c_size_t), ("priority", wt.DWORD), ("scheduling", wt.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(key, ctypes.c_ulonglong) for key in ("a", "b", "c", "d", "e", "f")]
    class Extended(ctypes.Structure):
        _fields_ = [("basic", Basic), ("io", IO), ("pm", ctypes.c_size_t), ("jm", ctypes.c_size_t),
                    ("ppm", ctypes.c_size_t), ("pjm", ctypes.c_size_t)]
    class Accounting(ctypes.Structure):
        _fields_ = [(key, ctypes.c_longlong) for key in ("a", "b", "c", "d")] + [(key, wt.DWORD) for key in ("faults", "total", "active", "terminated")]
    dll = ctypes.WinDLL("kernel32", use_last_error=True)
    for name, args, result in (
        ("CreateJobObjectW", [wt.LPVOID, wt.LPCWSTR], wt.HANDLE),
        ("SetInformationJobObject", [wt.HANDLE, ctypes.c_int, wt.LPVOID, wt.DWORD], wt.BOOL),
        ("AssignProcessToJobObject", [wt.HANDLE, wt.HANDLE], wt.BOOL),
        ("QueryInformationJobObject", [wt.HANDLE, ctypes.c_int, wt.LPVOID, wt.DWORD, wt.LPVOID], wt.BOOL),
        ("TerminateJobObject", [wt.HANDLE, wt.UINT], wt.BOOL),
        ("GetProcessTimes", [wt.HANDLE] + [ctypes.POINTER(wt.FILETIME)] * 4, wt.BOOL),
        ("ResumeThread", [wt.HANDLE], wt.DWORD),
        ("CloseHandle", [wt.HANDLE], wt.BOOL)):
        function = getattr(dll, name)
        function.argtypes, function.restype = args, result
    def checked(value, label):
        if not value:
            raise OSError(ctypes.get_last_error(), label)
    def accounting():
        value = Accounting()
        checked(dll.QueryInformationJobObject(job, 1, ctypes.byref(value), ctypes.sizeof(value), None), "query owned Job")
        return value
    job_name = "Local\\ai-painter-snapshot-" + uuid.uuid4().hex
    job = dll.CreateJobObjectW(None, job_name)
    checked(job, "create private Job")
    if ctypes.get_last_error() == 183:
        dll.CloseHandle(job)
        raise ValueError("refuse existing Job ownership")
    process = thread = None
    assigned = False
    started = time.monotonic()
    cleanup_budget = min(2, max(.025, (deadline - started) / 3))
    termination_deadline = deadline - cleanup_budget
    receipt = {"argv": argv, "jobName": job_name, "assignedBeforeResume": False, "killOnJobClose": False,
               "timedOut": False, "cleanupConfirmed": False}
    try:
        deadline_check(deadline)
        limits = Extended()
        limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        checked(dll.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)), "Job kill-on-close")
        receipt["killOnJobClose"] = True
        environment = {**os.environ, "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2",
                       "OPENBLAS_NUM_THREADS": "2", "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1",
                       "AI_PAINTER_SNAPSHOT_JOB": job_name}
        # No inherited handles, no unbounded child output transport. Child writes
        # only budgeted files; console stdout/stderr are discarded by this mode.
        startup = subprocess.STARTUPINFO()
        startup.dwFlags = subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = subprocess.SW_HIDE
        process, thread, pid, _ = _winapi.CreateProcess(argv[0], subprocess.list2cmdline(argv), None, None,
                                                      False, 0x08000004, environment,
                                                      str(cwd) if len(str(cwd)) < 250 else str(Path(argv[0]).parent), startup)
        receipt["pid"] = pid
        times = [wt.FILETIME() for _ in range(4)]
        checked(dll.GetProcessTimes(int(process), *(ctypes.byref(value) for value in times)), "owned process creation identity")
        receipt["processCreationFileTime"] = (times[0].dwHighDateTime << 32) | times[0].dwLowDateTime
        checked(dll.AssignProcessToJobObject(job, int(process)), "assign Job before resume")
        assigned = True
        receipt["assignedBeforeResume"] = True
        require(dll.ResumeThread(int(thread)) != 0xffffffff, "resume owned process failed")
        while True:
            remaining = termination_deadline - time.monotonic()
            if remaining <= 0:
                receipt["timedOut"] = True
                break
            if _winapi.WaitForSingleObject(process, max(1, min(25, int(remaining * 1000)))) == _winapi.WAIT_OBJECT_0:
                break
            require(output_bytes(evidence_root) <= LIMITS["outputBytes"] - LIMITS["failureReserveBytes"], "child output budget exhausted")
        stats = accounting()
        receipt["totalProcesses"] = stats.total
        if stats.active:
            checked(dll.TerminateJobObject(job, 124 if receipt["timedOut"] else 1), "terminate owned Job")
        cleanup_until = min(deadline, time.monotonic() + cleanup_budget)
        while accounting().active and time.monotonic() < cleanup_until:
            time.sleep(.01)
        receipt["activeProcessesAfterCleanup"] = accounting().active
        receipt["cleanupConfirmed"] = receipt["activeProcessesAfterCleanup"] == 0
        require(receipt["cleanupConfirmed"], "owned Job cleanup unconfirmed")
        receipt["exitCode"] = _winapi.GetExitCodeProcess(process)
        receipt["elapsedSeconds"] = time.monotonic() - started
        return receipt
    except BaseException as error:
        # Preserve the primary error, and attempt confirmation using ONLY the
        # private owned Job. Finally closing its handle also enforces kill-on-close.
        if assigned:
            try:
                stats = accounting()
                receipt["totalProcesses"] = stats.total
                if stats.active:
                    checked(dll.TerminateJobObject(job, 1), "cleanup failed owned Job")
                cleanup_until = min(deadline, time.monotonic() + cleanup_budget)
                while accounting().active and time.monotonic() < cleanup_until:
                    time.sleep(.01)
                receipt["activeProcessesAfterCleanup"] = accounting().active
                receipt["cleanupConfirmed"] = receipt["activeProcessesAfterCleanup"] == 0
            except BaseException as cleanup_error:
                receipt["cleanupError"] = str(cleanup_error)[:4096]
        receipt["elapsedSeconds"] = time.monotonic() - started
        error.owned_process_receipt = receipt
        raise
    finally:
        if process is not None and not assigned:
            _winapi.TerminateProcess(process, 1)  # owned, still-suspended handle
        dll.CloseHandle(job)  # kills only this private Job, including descendants
        if thread is not None:
            _winapi.CloseHandle(thread)
        if process is not None:
            _winapi.CloseHandle(process)


def analyze_failure_snapshot(*, terminal_binding, output_root, root=ROOT):
    return _analyze_failure_snapshot(terminal_binding=terminal_binding, output_root=output_root,
                                    root=root, deadline=time.monotonic() + LIMITS["wallSeconds"])


def _analyze_failure_snapshot(*, terminal_binding, output_root, root, deadline, dispatch_binding=None):
    root = Path(os.path.abspath(root))
    output = logical_path(root, str(output_root).replace("\\", "/"))
    initial_reader = Reader(root, deadline)
    if dispatch_binding is None:
        require(str(output.relative_to(root)).replace("\\", "/").startswith(OUTPUT_PARENT + "/"), "analysis output outside current task evidence")
        programs = program_bindings(root, deadline)
    else:
        dispatch_request, _, programs = production_preflight(initial_reader, dispatch_binding)
        require(output_root == dispatch_request["outputRoot"] and terminal_binding == dispatch_request["sourceFailure"],
                "production invocation differs from request")
    require(not output.resolve().is_relative_to(logical_path(root, terminal_binding["path"]).parent.resolve()), "source Run must remain read-only")
    request_data = {"terminal": terminal_binding, "programs": programs, "algorithm": SCHEMA, "limits": LIMITS}
    if dispatch_binding is not None:
        request_data["dispatchBinding"] = dispatch_binding
    request = digest(encoded(request_data))
    if dispatch_binding is not None and output.exists():
        allowed = {"dispatch-request.json", "analysis-claim.json", "analysis-inputs.json", "analysis-terminal.json",
                   "analysis-commit-intent.json", "worker-result.json", "worker-error.json", "comparison-conflict.json",
                   "owned-process.json", "production-launch-owned.json"}
        for file in output.iterdir():
            base = file.name.split(".pending-", 1)[0]
            require(base in allowed and file.is_file() and not file.is_symlink()
                    and (file.name == base or re.fullmatch(re.escape(base) + r"\.pending-[a-f0-9]{32}", file.name)),
                    "unknown production output/lock; no takeover")
    prepared = dispatch_binding is not None and output.is_dir() and not (output / "analysis-claim.json").exists()
    if prepared:
        require(output_bytes(output) <= LIMITS["outputBytes"] - LIMITS["failureReserveBytes"], "production request budget exceeded")
        for file in output.iterdir():
            require(file.name == "dispatch-request.json" or re.fullmatch(r"dispatch-request\.json\.pending-[a-f0-9]{32}", file.name),
                    "unknown production output/lock; no takeover")
            require(file.is_file() and not file.is_symlink() and file_hash(file, deadline) == dispatch_binding["sha256"],
                    "production request witness differs")
    if output.exists() and not prepared:
        require(output_bytes(output) <= LIMITS["outputBytes"], "cached evidence budget exceeded")
        claim_file = output / "analysis-claim.json"
        receipt_file = output / "analysis-terminal.json"
        require(claim_file.is_file() and receipt_file.is_file()
                and max(claim_file.stat().st_size, receipt_file.stat().st_size) <= LIMITS["jsonBytes"],
                "incomplete or unknown analysis identity; no retry")
        claim = json.loads(claim_file.read_bytes())
        receipt = json.loads(receipt_file.read_bytes())
        require(claim["requestIdentity"] == request, "analysis identity conflict")
        require(receipt["status"] == "snapshot_analysis_complete_diagnostic_only", "previous analysis failed; no retry")
        reader = Reader(root, deadline)
        if dispatch_binding is None:
            context = preflight(reader, terminal_binding)
        else:
            _, context, _ = production_preflight(reader, dispatch_binding)
        identity = digest(encoded({"inputs": context["bindings"], "programs": programs, "algorithm": SCHEMA, "limits": LIMITS}))
        require(receipt["identity"] == identity, "analysis identity conflict")
        intent_file = output / "analysis-commit-intent.json"
        require(intent_file.is_file() and intent_file.stat().st_size <= LIMITS["jsonBytes"], "cached commit intent absent")
        intent = json.loads(intent_file.read_bytes())
        binding = intent["terminal"]
        require(intent["identity"] == identity and Path(binding["path"]).resolve() == receipt_file.resolve()
                and file_hash(receipt_file, deadline) == binding["sha256"], "cached report binding differs")
        report = receipt
        require(report["identity"] == identity and report["boundary"] == BOUNDARY
                and report["inputBindings"] == context["bindings"] and report["programBindings"] == programs,
                "cached report content differs")
        require(report["comparison"] == context["manifest"]["comparison"] and report["counts"] == context["counts"]
                and report["location"] == context["location"] and report["originalError"] == context["originalError"],
                "cached statistics/source summary differs")
        if dispatch_binding is not None:
            require(report.get("dispatchSummary") == {"status": "diagnostic_complete_original_training_failed",
                "dispatchBinding": dispatch_binding, "sourceFailure": terminal_binding,
                "originalTrainingError": context["originalError"], "counts": context["counts"], "boundary": BOUNDARY},
                "cached production summary differs")
        reader.unchanged()
        return binding
    if not prepared:
        output.mkdir(parents=True, exist_ok=False)
    context, identity = None, None
    try:
        write_exclusive(output, "analysis-claim.json", {"schemaVersion": SCHEMA, "requestIdentity": request,
                        "terminalBinding": terminal_binding, "programBindings": programs,
                        "limits": LIMITS, "boundary": BOUNDARY})
        reader = Reader(root, deadline)
        if dispatch_binding is None:
            context = preflight(reader, terminal_binding)
        else:
            _, context, _ = production_preflight(reader, dispatch_binding)
        identity = digest(encoded({"inputs": context["bindings"], "programs": programs, "algorithm": SCHEMA, "limits": LIMITS}))
        write_exclusive(output, "analysis-inputs.json", {"schemaVersion": SCHEMA, "identity": identity,
                        "terminalBinding": terminal_binding, "inputBindings": context["bindings"],
                        "dispatchBinding": dispatch_binding})
        argv = [sys.executable, "-B", str(logical_path(root, ENTRY)), "--worker",
                "--terminal", terminal_binding["path"], "--sha256", terminal_binding["sha256"],
                "--output", str(output_root), "--identity", identity, "--deadline-monotonic", str(deadline)]
        if dispatch_binding is not None:
            argv += ["--dispatch", dispatch_binding["path"], "--dispatch-sha256", dispatch_binding["sha256"]]
        owned = run_owned_process(argv, cwd=root, deadline=deadline - .1, evidence_root=output)
        write_exclusive(output, "owned-process.json", owned)
        require(not owned["timedOut"] and owned["exitCode"] == 0, "CPU worker hard timeout" if owned["timedOut"] else "CPU worker failed")
        worker_file = output / "worker-result.json"
        require(worker_file.stat().st_size <= LIMITS["jsonBytes"], "worker result too large")
        report = json.loads(worker_file.read_bytes())
        require(report["identity"] == identity and report["inputBindings"] == context["bindings"]
                and report["programBindings"] == programs and report["boundary"] == BOUNDARY
                and report["status"] == "worker_snapshot_verified_pending_supervisor_commit", "worker result identity differs")
        reader.unchanged()
        deadline_check(deadline)
        report["ownedProcess"] = owned
        report["status"] = "snapshot_analysis_complete_diagnostic_only"
        if dispatch_binding is not None:
            report["dispatchSummary"] = {"status": "diagnostic_complete_original_training_failed",
                "dispatchBinding": dispatch_binding, "sourceFailure": terminal_binding,
                "originalTrainingError": context["originalError"], "counts": context["counts"], "boundary": BOUNDARY}
        prospective = {"path": str(output / "analysis-terminal.json"), "sha256": digest(encoded(report))}
        write_exclusive(output, "analysis-commit-intent.json", {"schemaVersion": SCHEMA, "identity": identity, "terminal": prospective})
        return write_exclusive(output, "analysis-terminal.json", report)
    except BaseException as error:
        original = {"schemaVersion": SCHEMA, "status": "snapshot_analysis_failed_closed", "identity": identity,
                    "requestIdentity": request,
                    "originalTrainingError": context["originalError"] if context else None,
                    "counts": context["counts"] if context else None,
                    "errorType": type(error).__name__, "error": str(error)[:4096],
                    "ownedProcess": getattr(error, "owned_process_receipt", None), "boundary": BOUNDARY}
        if dispatch_binding is not None:
            original["dispatchSummary"] = {"status": "diagnostic_failed_closed_original_training_failed",
                "dispatchBinding": dispatch_binding, "sourceFailure": terminal_binding,
                "originalTrainingError": context["originalError"] if context else None,
                "counts": context["counts"] if context else None, "boundary": BOUNDARY}
        try:
            write_exclusive(output, "analysis-terminal.json", original, failure=True)
        except BaseException as publication_error:
            error.analysis_publication_error = str(publication_error)
        raise


def main():
    invocation_started = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terminal")
    parser.add_argument("--sha256")
    parser.add_argument("--output")
    parser.add_argument("--dispatch")
    parser.add_argument("--dispatch-sha256")
    parser.add_argument("--parent-deadline-unix-ms", type=int)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--identity", help=argparse.SUPPRESS)
    parser.add_argument("--deadline-monotonic", type=float, help=argparse.SUPPRESS)
    parser.add_argument("--production-owned", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    dispatch = {"path": args.dispatch, "sha256": args.dispatch_sha256} if args.dispatch else None
    if dispatch is not None and not args.worker:
        require(not args.terminal and not args.sha256 and not args.output and not args.identity,
                "production mode rejects standalone/root overrides")
        deadline = production_deadline(args.parent_deadline_unix_ms, started=invocation_started)
        if args.production_owned:
            verify_owned_worker()
            require(args.deadline_monotonic is not None, "owned production deadline absent")
            deadline = min(deadline, args.deadline_monotonic)
            reader = Reader(ROOT, deadline)
            request, _, _ = production_preflight(reader, dispatch)
            print(json.dumps(_analyze_failure_snapshot(terminal_binding=request["sourceFailure"],
                output_root=request["outputRoot"], root=ROOT, deadline=deadline, dispatch_binding=dispatch)))
            return
        require(re.fullmatch(re.escape(PRODUCTION_PARENT) + r"/[a-f0-9]{64}/dispatch-request\.json", args.dispatch),
                "production request path outside derived namespace")
        output = logical_path(ROOT, args.dispatch).parent
        if (output / "analysis-terminal.json").exists():
            # A lost CLI receipt is a metadata-only readback, never a new worker.
            print(json.dumps(analyze_production_dispatch(dispatch_binding=dispatch,
                parent_deadline_unix_ms=args.parent_deadline_unix_ms, started=invocation_started)))
            return
        argv = [sys.executable, "-B", str(ROOT / ENTRY), "--dispatch", args.dispatch,
                "--dispatch-sha256", args.dispatch_sha256, "--parent-deadline-unix-ms",
                str(args.parent_deadline_unix_ms), "--production-owned", "--deadline-monotonic", str(deadline)]
        # Entire production computation, metadata and tensor loading belong to
        # this Job. Native ownership wraps the CLI before any preflight load.
        owned = run_owned_process(argv, cwd=ROOT, deadline=deadline, evidence_root=output)
        require(not owned["timedOut"] and owned["exitCode"] == 0, "owned production invocation failed")
        write_exclusive(output, "production-launch-owned.json", owned, failure=True)
        print(json.dumps(analyze_production_dispatch(dispatch_binding=dispatch,
            parent_deadline_unix_ms=args.parent_deadline_unix_ms, started=invocation_started)))
        return
    require(not args.production_owned and args.terminal and args.sha256 and args.output,
            "explicit standalone bindings required")
    require(args.worker or (not args.dispatch_sha256 and not args.parent_deadline_unix_ms), "mixed CLI modes")
    binding = {"path": args.terminal, "sha256": args.sha256}
    if args.worker:
        require(args.identity and re.fullmatch(r"[a-f0-9]{64}", args.identity), "worker identity absent")
        require(args.deadline_monotonic is not None and math.isfinite(args.deadline_monotonic)
                and args.deadline_monotonic <= time.monotonic() + LIMITS["wallSeconds"], "inherited worker deadline differs")
        worker(ROOT, binding, logical_path(ROOT, args.output), args.identity,
               deadline=args.deadline_monotonic, dispatch_binding=dispatch)
    else:
        print(json.dumps(analyze_failure_snapshot(terminal_binding=binding, output_root=args.output)))


if __name__ == "__main__":
    try:
        main()
    except BaseException as failure:
        # Child uses no console transport; immutable error files hold details.
        if "--worker" not in sys.argv:
            print(json.dumps({"status": "snapshot_analysis_failed_closed", "error": str(failure)[:4096]}), file=sys.stderr)
        sys.exit(1)

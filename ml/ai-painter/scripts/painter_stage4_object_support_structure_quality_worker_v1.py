# TD-TRAIN-ENTRY-01-PY: independent terrain-detail identity, inherited frozen algorithms.
"""Authenticated quality24 worker: midpoint observation and one final checkpoint."""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
from importlib.machinery import SourceFileLoader
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import time
import types

ROOT = Path(__file__).absolute().parents[3]
for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    sys.path.insert(0, str(directory))
import object_support_structure_quality_auth_v1 as auth
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as checkpoint

CAPABILITY, EXECUTION_PROFILE = auth.CAPABILITY, auth.PROFILE
MODEL_CAPABILITY = auth.MODEL_CAPABILITY
TERMINAL_SCHEMA = "object-support-structure-quality-worker-terminal-v1"
GPU_SCHEMA = "object-support-structure-quality-all-train-gpu-gate-v1"
CPU_SCHEMA = "object-support-structure-quality-entry-cpu-report-v1"
PATH, GPU_PATH = auth.ROLES["worker"], auth.ROLES["gpuQualifier"]
require = auth.require
import torch as _torch_provider
import torch._ops as _torch_ops_provider
import torch._classes as _torch_classes_provider

# Identity anchors from the actual imported provider, never caller filenames.
_TORCH_OPS = _torch_ops_provider.ops
_TORCH_CLASSES = _torch_classes_provider.classes
_TORCH_HIGHER_ORDER = vars(_TORCH_OPS)["higher_order"]
_CUDA_UUID_TYPE = vars(_torch_provider._C).get("_CUuuid")
_TORCH_DYNAMIC = ((_TORCH_OPS, _torch_ops_provider._Ops, "_Ops", "_ops.py", _torch_ops_provider),
    (_TORCH_CLASSES, _torch_classes_provider._Classes, "_Classes", "_classes.py", _torch_classes_provider),
    (_TORCH_HIGHER_ORDER, _torch_ops_provider._HigherOrderNamespace, "_HigherOrderNamespace", "torch.ops", _torch_ops_provider))
_TORCH_SOURCE_BINDINGS = {
    "torch": {"path": "ml/ai-painter/.venv/Lib/site-packages/torch/__init__.py", "sha256": "9805fe98af34a65b1ab758c7909cc7b9906f40777257e513968545b19e319aa1"},
    "torch._ops": {"path": "ml/ai-painter/.venv/Lib/site-packages/torch/_ops.py", "sha256": "4850bc4310865c7ae596e5b23a2b49829f7ef75f6af7fc6ff577445fe65792ef"},
    "torch._classes": {"path": "ml/ai-painter/.venv/Lib/site-packages/torch/_classes.py", "sha256": "3ea58190980b19fdc478b60cf157ab74472c44b20cc4d53164cdcea98648b321"}}


def runtime(capability_version=CAPABILITY):
    import torch
    profile=auth.profile_components(capability_version)
    import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
    return torch, profile, shared


def runtime_for_plan(plan):
    capability_version=auth.execution_route(plan.get("capabilityVersion",CAPABILITY)).capability
    return runtime() if capability_version == CAPABILITY else runtime(capability_version)


def codec_for_plan(plan):
    return auth.checkpoint_components(plan.get("capabilityVersion",CAPABILITY))


def verify_owned_release(reader, binding, *, phase, output_root, args, programs):
    """Tie the retained native Job receipt to this exact command, not a boolean."""
    owned = auth.read_json(reader, binding)
    proof = owned.get("proof", {})
    require(owned.get("schema") == "detail-weight-live-native-owner-receipt-v1"
            and owned.get("phase") == phase and owned.get("ownerClosed") is True
            and owned.get("cleanupConfirmed") is True and proof.get("assignedBeforeResume") is True
            and proof.get("killOnJobClose") is True
            and type(proof.get("exitCode")) is int and proof["exitCode"] == 0
            and type(proof.get("activeProcessesAfterCleanup")) is int
            and proof["activeProcessesAfterCleanup"] == 0
            and proof.get("stopReason") is None and owned.get("stopReason") is None
            and proof.get("cleanupError") is None and proof.get("observationError") is None
            and owned.get("protocolError") is None,
            "owned Job successful empty release required")
    require(proof.get("streamClosureVersion") == "bounded-stream-capture-v2"
            and proof.get("stdoutClosed") is True and proof.get("stderrClosed") is True
            and proof.get("transportCompleted") is True
            and "streamCaptureError" in proof and proof["streamCaptureError"] is None
            and "streamTransportError" in proof and proof["streamTransportError"] is None,
            "owned bounded streams fully closed and transported required")
    payload = auth.decode(base64.b64decode(proof["bindingBase64"], validate=True))
    guard = payload["guard"]
    require(binding["path"] == output_root + "/owned-" + phase + "-" + guard["identity"] + "/release-receipt.json"
            and owned.get("guard", {}).get("identity") == guard["identity"]
            and owned["guard"].get("state") == "released_after_live_empty_job"
            and guard.get("commandSha256") == hashlib.sha256(json.dumps(args,
                ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(),
            "receipt belongs to a different owned command")
    executable = reader.root / "ml/ai-painter/.venv/Scripts/python.exe"
    require(Path(guard["executable"]).absolute() == executable.absolute()
            and guard["executableSha256"] == hashlib.sha256(executable.read_bytes()).hexdigest(),
            "owned Python executable identity differs")
    native = payload["nativeBuild"]
    expected = {}
    for role in ("nativeOwnerBuilder", "nativeOwnerSource", "nativeRunner"):
        value = auth.exact_binding(programs.get(role))
        require(value["path"] == auth.ROLES[role], "owned exact native role path differs: " + role)
        # Actual immutable bytes establish these identities, never formatted SHA strings.
        reader.read(value, auth.PROGRAM_MAX)
        expected[role] = value
    source_path = reader.path(expected["nativeOwnerSource"]["path"]).absolute()
    require(type(native["source"].get("path")) is str and Path(native["source"]["path"]).is_absolute()
            and type(guard["nativeOwnerSource"].get("path")) is str and Path(guard["nativeOwnerSource"]["path"]).is_absolute()
            and Path(native["source"]["path"]).absolute() == Path(guard["nativeOwnerSource"]["path"]).absolute() == source_path
            and expected["nativeOwnerSource"]["sha256"] == native["source"]["sha256"] == guard["nativeOwnerSource"]["sha256"]
            and guard["helperSha256"] == expected["nativeRunner"]["sha256"], "owned exact native/helper source differs")
    namespace = owned["guard"]["nativeEvidenceRoot"]
    require(namespace.startswith(".runtime/ai-painter/owned-worker-guards/"), "owned namespace differs")
    for name, digest in ((native["snapshot"], native["source"]["sha256"]),
                         (native["binary"], native["binarySha256"])):
        artifact = Path(name).absolute()
        if artifact.is_relative_to(reader.mapping.physical_runtime):
            logical = ".runtime/" + artifact.relative_to(reader.mapping.physical_runtime).as_posix()
        else:
            logical = artifact.relative_to(reader.root.absolute()).as_posix()
        require(logical.startswith(namespace + "/"), "owned native artifact outside its namespace")
        reader.read({"path": logical, "sha256": digest})
    return owned


def verify_cpu_report(raw, request, plan):
    require(raw.get("schema") == CPU_SCHEMA and raw.get("status") == "passed" and
            type(raw.get("passed")) is int and raw["passed"] >= 20 and raw.get("failed") == 0 and
            raw.get("errors") == 0 and raw.get("skipped") == 0 and raw.get("synthetic") is True and
            raw.get("gpuInitialized") is False and
            auth.same_json(raw.get("actualCalls"), {k: 0 for k in ("moduleForwardCalls", "autogradCalls",
                "optimizerConstructionAttempts", "optimizerUpdates", "cudaInitializationAttempts")}), "own CPU raw tests required")
    for key in ("programBindings", "configuration", "runtimeIdentity"):
        require(auth.same_json(raw.get(key), plan.get(key)) and auth.same_json(request.get(key), plan.get(key)), "CPU source/model/config mismatch: " + key)
    require(auth.same_json(raw.get("modelBinding"), plan.get("modelBinding")) and
        request.get("modelIdentityOutput") == raw["modelBinding"]["path"] == plan["outputRoot"] + "/model-identity.json" and
        request.get("modelCapabilityVersion") == raw.get("initialModel", {}).get("modelCapabilityVersion") ==
            auth.execution_route(plan.get("capabilityVersion",CAPABILITY)).model_capability, "CPU new actual model output differs")
    require(request.get("schema") == "object-support-structure-quality-cpu-request-v1" and
            request.get("runId") == plan["runId"] and request.get("packageId") == plan["packageId"] and
            request.get("outputRoot") == plan["outputRoot"] + "/cpu-entry" and
            len(raw.get("items", [])) == raw["passed"] and all(x.get("status") == "passed" for x in raw["items"]), "CPU request/items/Run differ")


def verify_final_cpu(reader, plan):
    acceptance = auth.read_json(reader, plan["finalCpuAcceptance"])
    require(acceptance.get("schema") == "object-support-structure-quality-final-cpu-acceptance-v1" and
            acceptance.get("status") == "passed" and auth.same_json(acceptance.get("programBindings"), plan["programBindings"]), "own final CPU acceptance required")
    raw = auth.read_json(reader, acceptance["report"])
    require(acceptance["report"]["path"] == plan["outputRoot"] + "/cpu-entry/cpu-report.json", "exact CPU report ABI required")
    request = auth.read_json(reader, raw["request"])
    verify_cpu_report(raw, request, plan)
    require(auth.same_json(raw.get("initialModel"), auth.read_json(reader, plan["modelBinding"])), "actual CPU initial model binding differs")
    require(auth.same_json(raw.get("dataClosure"), plan["dataClosure"]), "CPU source data closure differs")
    require(raw.get("nodeExitCode") == 0 and "legacyCaptureFixture" not in raw, "actual Node entry regression/new-only CPU fixtures required")
    verify_validation_loader_regression(reader, raw.get("validationLoaderRegression"), plan)
    verify_owned_release(reader, acceptance["ownedReceipt"], phase="cpu", output_root=plan["outputRoot"],
        args=["-B", str(reader.root / auth.ROLES["cpuHarness"]), "--cpu-request", raw["request"]["path"],
              "--sha256", raw["request"]["sha256"]], programs=plan["programBindings"])
    return acceptance


def verify_validation_loader_regression(reader, binding, plan):
    """Consume the retained CPU loader evidence without loading holdout tensors."""
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
    binding = auth.exact_binding(binding)
    require(binding["path"] == plan["outputRoot"] + "/cpu-entry/validation-loader-regression.json", "same Run validation loader evidence required")
    proof = auth.read_json(reader, binding)
    closure = auth.read_json(reader, plan["dataClosure"])
    rows = sorted((row for row in auth.read_json(reader, DIAGNOSTIC)["rows"] if row["split"] == "validation"),
        key=lambda row: row["ordinal"])
    require(proof.get("schema") == "quality-validation-loader-regression-v1" and proof.get("status") == "actual8_validation_loaded_cpu"
        and len(rows) == 8 and proof.get("sampleIds") == [row["sampleId"] for row in rows] == closure["splitSampleIds"]["validation"]
        and auth.same_json(proof.get("originalRgb"), [row["identity"]["image"] for row in rows])
        and type(proof.get("closureBindings")) is int and proof["closureBindings"] == len(closure["bindings"])
        and proof.get("sourceReader") == "actual_recomputed_Reader" and proof.get("validationRgbReadByLoaderTest") is True,
        "actual original8 validation loader evidence differs")
    require(all(proof.get(key) is False for key in ("validationRgbReadByClosure", "validationRgbInSnapshotClosure",
        "trainRgbReadByLoaderTest", "challengeContentRead", "regressionContentRead", "weightOptimization",
        "checkpointSelection", "gpuQualification", "qualified")), "CPU validation loader evidence cannot grant qualification")
    visuals = proof.get("visualManifests")
    require(type(visuals) is list and len(visuals) == 8, "eight actual validation visual observations required")
    index = {value["path"]: value for value in closure["bindings"]}
    for observed, row in zip(visuals, rows):
        actual = auth.exact_binding(row["identity"]["visualFactManifestFile"])
        require(type(observed) is dict and set(observed) == {"path", "sha256", "bytes"}
            and auth.same_json({key: observed[key] for key in ("path", "sha256")}, actual)
            and auth.same_json(index.get(actual["path"]), actual)
            and type(observed["bytes"]) is int and observed["bytes"] == len(reader.read(actual, auth.SOURCE_JSON_MAX)),
            "actual validation visual observation/closure differs")
    return proof


def verify_torch_dynamic_namespace(reader, module):
    entry = next((item for item in _TORCH_DYNAMIC if module is item[0]), None)
    if entry is None:
        if isinstance(module, types.ModuleType):
            require(vars(module).get("__name__") not in ("torch.ops", "torch.classes", "torch.ops.higher_order"),
                    "unrecognized Torch dynamic namespace object")
        return None
    _, cls, class_name, placeholder, provider = entry
    require(type(module) is cls and vars(provider).get(class_name) is cls, "Torch dynamic object/type changed")
    expected_name = {"_Ops": "torch.ops", "_Classes": "torch.classes", "_HigherOrderNamespace": "torch.ops.higher_order"}[class_name]
    require(vars(module).get("__name__") == expected_name and cls.__module__ == vars(provider)["__name__"],
            "Torch dynamic name/code provider changed")
    require("__file__" not in vars(module) and vars(cls).get("__file__") == placeholder and
            getattr(module, "__file__") == placeholder, "Torch dynamic file carrier changed")
    require(sys.modules.get("torch") is _torch_provider and sys.modules.get("torch._ops") is _torch_ops_provider and
            sys.modules.get("torch._classes") is _torch_classes_provider and
            vars(_torch_provider).get("ops") is _TORCH_OPS and vars(_torch_provider).get("classes") is _TORCH_CLASSES and
            vars(_torch_ops_provider).get("ops") is _TORCH_OPS and vars(_torch_classes_provider).get("classes") is _TORCH_CLASSES and
            vars(_TORCH_OPS).get("higher_order") is _TORCH_HIGHER_ORDER and
            sys.modules.get("torch.ops") is _TORCH_OPS and sys.modules.get("torch.classes") is _TORCH_CLASSES,
            "Torch dynamic provider identity changed")
    for provider_name, actual in (("torch", _torch_provider), (vars(provider)["__name__"], provider)):
        expected = _TORCH_SOURCE_BINDINGS[provider_name]
        source = reader.path(expected["path"])
        spec = vars(actual).get("__spec__")
        require(type(actual) is types.ModuleType and vars(actual).get("__file__") == str(source) and spec is not None and
                spec.origin == str(source) and type(spec.loader) is SourceFileLoader and
                spec.loader.name == provider_name and spec.loader.path == str(source), "Torch provider source/loader changed")
        reader.read(expected)  # Actual stable source bytes and SHA on each check.
    constructor = vars(cls).get("__init__")
    require(type(constructor) is types.FunctionType and constructor.__globals__ is vars(provider) and
            Path(constructor.__code__.co_filename) == reader.path(_TORCH_SOURCE_BINDINGS[vars(provider)["__name__"]]["path"]),
            "Torch dynamic class code carrier changed")
    return {"module": vars(module)["__name__"], "class": class_name, "placeholder": placeholder,
            "provider": _TORCH_SOURCE_BINDINGS[vars(provider)["__name__"]]}


def verify_loaded_sources(reader, plan):
    auth.validate_program_count(plan["programBindings"], plan.get("capabilityVersion", CAPABILITY))
    paths = {b["path"]: b for b in plan["programBindings"].values()}
    dynamic, project_sources = [], []
    for module in tuple(sys.modules.values()):
        verified = verify_torch_dynamic_namespace(reader, module)
        if verified is not None:
            dynamic.append(verified)
            continue
        filename = getattr(module, "__file__", None)
        if not filename:
            continue
        require(type(filename) is str and Path(filename).is_absolute(), "unrecognized relative loaded-source carrier")
        source = Path(filename)
        if source.is_relative_to(reader.root) and not source.is_relative_to(reader.root / "ml/ai-painter/.venv"):
            logical = source.relative_to(reader.root).as_posix()
            require(logical in paths, "loaded project source outside closure: " + logical)
            reader.read(paths[logical])
            project_sources.append(logical)
    return {"dynamicNamespaces": dynamic, "projectSources": sorted(set(project_sources)), "qualified": False}


def load_package(binding, *, root=ROOT):
    reader = auth.Reader(root)
    context = auth.load_execution_package(reader, binding)
    verify_final_cpu(reader, context.plan)
    verify_loaded_sources(reader, context.plan)
    reader.unchanged()
    return context


def authenticate_live(binding, *, root=ROOT, phase="training"):
    context = load_package(binding, root=root)
    auth.verify_live_context(context, expected_phase=phase)
    return context


def load_samples(reader, plan, *, splits=None):
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC, CONDITION
    torch, profile, shared = runtime_for_plan(plan)
    requested = ("train",) if splits is None else splits
    require(type(requested) in (tuple, list) and requested and len(set(requested)) == len(requested)
        and all(split in ("train", "validation") for split in requested), "explicit train/validation content only")
    metadata = profile.prepare_metadata(reader, DIAGNOSTIC, CONDITION)
    cpu = shared.v24.core.cpu
    manifest, order, continuous, _rows, _membership = cpu.select_rows(reader)
    require(auth.same_json(reader.json(plan["datasetManifest"]), manifest), "original dataset differs")
    source_index = reader.json(manifest["sourceIndex"])
    rows = {row["sampleId"]: row for row in source_index["samples"]}
    require(len(rows) == len(source_index["samples"]), "duplicate source sample")
    loaded = {}
    for split in requested:
        ids = reader.json(plan[split + "Split"])["sampleIds"]
        require(len(ids) == len(set(ids)) == (48 if split == "train" else 8)
            and ids == metadata["splitSampleIds"][split], "source split/order differs")
        loaded[split] = []
        for ordinal, sample_id in enumerate(ids):
            row = rows[sample_id]
            require(row["split"] == split, "cross-split source")
            sample, identity = cpu.load_sample(reader, row, order, continuous)
            record = metadata["records"][(split, ordinal)]
            require(auth.same_json({key: value for key, value in identity.items() if key != "ordinal"},
                {key: value for key, value in record["identity"].items() if key != "ordinal"}), "decoded source identity differs")
            loaded[split].append(profile.bind_sample_ecology(reader, sample, record["identity"], record["regimeRecord"]))
    reader.unchanged()
    return (loaded["train"] if splits is None else loaded), order


def write(root, logical, value, *, terminal=False):
    reader = auth.Reader(root)
    path = reader.path(logical)
    raw = value if type(value) is bytes else capture.json_bytes(value)
    limit = 65536 if terminal else checkpoint.MAX_BYTES if type(value) is bytes else capture.MAX_JSON
    require(len(raw) <= limit, "artifact byte ceiling")
    roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]"))
    if roots:
        require(type(roots) is list and 1 <= len(roots) <= 32 and len(roots) == len(set(roots)), "output roots invalid")
        maximum = int(os.environ["DETAIL_WEIGHT_OUTPUT_MAX"])
        require(0 < maximum <= capture.MAX_EXECUTION and any(logical.startswith(r + "/") for r in roots), "write outside owned accounting")
        used = sum(capture.directory_bytes(reader.path(r)) for r in roots)
        require(used + len(raw) <= maximum - (0 if terminal else 65536), "owned terminal reserve exhausted")
    path.parent.mkdir(parents=True, exist_ok=True)
    parent_identity = capture._directory_identity(path.parent)
    reader.mapping.check()
    with path.open("xb") as stream:
        require(stream.write(raw) == len(raw), "short artifact write")
        stream.flush()
        os.fsync(stream.fileno())
    binding = {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}
    require(capture._directory_identity(path.parent) == parent_identity, "output parent identity changed")
    reader.mapping.binding(binding, maximum=limit)
    return binding


def _gpu_uuid(value):
    """Only the two standard textual forms of one 128-bit GPU identity."""
    require(type(value) is str and re.fullmatch(
        r"(?:GPU-)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", value) is not None,
        "GPU UUID requires standard 128-bit string")
    bare = value[4:] if value.startswith("GPU-") else value
    return bytes.fromhex(bare.replace("-", "")), "GPU-" + bare.lower()


def _cuda_uuid_text(value):
    # PyTorch2.11 exposes its actual CUuuid provider type, not an arbitrary
    # object with a caller-controlled __str__. The stub's str annotation differs.
    if type(value) is str:
        return value
    require(_CUDA_UUID_TYPE is not None and type(value) is _CUDA_UUID_TYPE,
        "CUDA UUID missing or unsupported provider type")
    return str(value)


def _driver_device_zero(raw):
    require(type(raw) is str and raw, "GPU driver query empty/nontext output")
    indices, uuids, zero = set(), set(), None
    for line in raw.splitlines():
        parts = line.split(",")
        require(len(parts) == 3, "GPU driver query malformed row")
        # csv,noheader,nounits uses one optional delimiter space. Preserve
        # UUID field whitespace otherwise so malformed identities cannot trim in.
        index, text, temperature = [part[1:] if position and part.startswith(" ") else part
            for position, part in enumerate(parts)]
        require(re.fullmatch(r"0|[1-9][0-9]*", index) is not None and
            re.fullmatch(r"[0-9]{1,3}", temperature) is not None, "GPU driver query malformed index/temperature")
        identity, canonical = _gpu_uuid(text)
        require(index not in indices and identity not in uuids, "GPU driver query duplicate index/UUID")
        indices.add(index)
        uuids.add(identity)
        if index == "0":
            zero = (identity, canonical, int(temperature))
    require(zero is not None, "GPU driver query device0 absent")
    require(zero[2] <= 85, "device0 temperature exceeds85C: " + str(zero[2]))
    return zero


def verify_gpu_gate(reader, plan, package_binding, gate_binding):
    require(gate_binding["path"] == plan["outputRoot"] + "/gpu-gate.json", "same Run own GPU gate required")
    gate = auth.read_json(reader, gate_binding)
    expected = {kind + suffix: count for kind, count in (("forward", 48), ("generator", 240), ("discriminator", 48))
                for suffix in ("Attempted", "Completed")}
    require(gate.get("schema") == GPU_SCHEMA and gate.get("status") == "passed" and
            gate.get("capabilityVersion") == plan["capabilityVersion"] and gate.get("executionProfile") == auth.execution_route(plan["capabilityVersion"]).profile and
            gate.get("runId") == plan["runId"] and gate.get("packageId") == plan["packageId"] and
            auth.same_json(gate.get("executionPackage"), package_binding) and
            auth.same_json(gate.get("programBindings"), plan["programBindings"]) and
            auth.same_json(gate.get("actualCounts"), expected) and
            type(gate.get("deviceIdentity")) is dict and gate["deviceIdentity"].get("ordinal") == 0 and
            type(gate["deviceIdentity"].get("uuid")) is str and
            gate["deviceIdentity"]["uuid"] == _gpu_uuid(gate["deviceIdentity"]["uuid"])[1] and
            [r["sampleId"] for r in gate.get("cases", [])] == auth.read_json(reader, plan["trainSplit"])["sampleIds"] and
            all(r.get("passed") is True and auth.same_json(r.get("proof", {}).get("callCounts"),
                {"generatorForwards": 1, "generatorForwardCompleted": 1, "generatorAutograd": 5, "discriminatorAutograd": 1}) and
                r["proof"].get("optimizerCreated") is False and r["proof"].get("optimizerUpdates") == 0 for r in gate["cases"]) and
            type(gate.get("optimizerSteps")) is int and gate["optimizerSteps"] == 0 and
            gate.get("checkpointLoaded") is False and gate.get("checkpointWritten") is False and
            auth.same_json(gate.get("initialState"), gate.get("finalState")) and
            auth.same_json(gate.get("initialCpuState"), auth.read_json(reader, plan["modelBinding"])["initialState"]), "own full48 zero-update GPU proof differs")
    return gate


def verify_owned_gpu(reader, plan, package_binding, binding):
    require(binding["path"] == plan["outputRoot"] + "/gpu-acceptance.json", "own GPU release path differs")
    admission = auth.read_json(reader, binding)
    require(admission.get("schema") == "object-support-structure-quality-owned-gpu-acceptance-v1" and
            admission.get("status") == "passed" and auth.same_json(admission.get("executionPackage"), package_binding) and
            auth.same_json(admission.get("programBindings"), plan["programBindings"]), "own same-package admission required")
    gate = verify_gpu_gate(reader, plan, package_binding, admission["report"])
    verify_owned_release(reader, admission["ownedReceipt"], phase="qualification", output_root=plan["outputRoot"],
        args=["-B", str(reader.root / GPU_PATH), "--package", package_binding["path"], "--sha256", package_binding["sha256"]],
        programs=plan["programBindings"])
    return gate


class ResourceGuard:
    def __init__(self, binding, plan, *, root=ROOT, started=None, gpu_gate=False):
        self.binding, self.plan, self.root = binding, plan, Path(root)
        self.started = time.monotonic() if started is None else started
        self.seconds = (720 if auth.execution_route(plan["capabilityVersion"]).capability in (auth.FINAL_RGB_CAPABILITY, auth.JOINT_CAPABILITY) else 600) if gpu_gate else 8400
        if gpu_gate:
            require(type(plan["configuration"]["gpuAdmissionSeconds"]) is int
                and plan["configuration"]["gpuAdmissionSeconds"] == self.seconds, "own GPU admission budget differs")
        self.execution_phase = None if gpu_gate else "training"
        self.last = None
        self.device_identity = None
        self.__live_context = None

    def __call__(self):
        torch, _, shared = runtime_for_plan(self.plan)
        require(time.monotonic() - self.started < self.seconds and torch.get_num_threads() <= 2, "own wall/CPU deadline exceeded")
        reader = auth.Reader(self.root)
        directory = reader.path(self.plan["outputRoot"])
        require(shutil.disk_usage(directory).free >= 2048 * 1024**2, "disk safety floor")
        roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]")) or [self.plan["outputRoot"]]
        maximum = min(capture.MAX_EXECUTION, int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX", capture.MAX_EXECUTION)))
        require(sum(capture.directory_bytes(reader.path(r)) for r in roots) <= maximum - 65536, "owned evidence/terminal reserve exhausted")
        require(torch.cuda.is_initialized(), "guard cannot initialize CUDA")
        require(torch.cuda.current_device() == 0, "current CUDA ordinal differs")
        torch.cuda.synchronize()
        free, total = torch.cuda.mem_get_info()
        require(free >= 2048 * 1024**2, "VRAM safety floor")
        shared.v24.core.gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved()),
            allocated=int(torch.cuda.max_memory_allocated()), device_used=int(total - free), fraction=.7)
        if self.last is None or time.monotonic() - self.last >= 10:
            try:
                thermal = subprocess.run(["nvidia-smi", "--query-gpu=index,uuid,temperature.gpu", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            except (OSError, subprocess.TimeoutExpired) as error:
                raise ValueError("GPU driver identity query failed: " + type(error).__name__) from error
            require(thermal.returncode == 0, "GPU driver identity query exit: " + str(thermal.returncode))
            driver_bits, driver_uuid, _ = _driver_device_zero(thermal.stdout)
            cuda_text = _cuda_uuid_text(getattr(torch.cuda.get_device_properties(0), "uuid", None))
            cuda_bits, cuda_uuid = _gpu_uuid(cuda_text)
            require(cuda_bits == driver_bits, "device0 UUID mismatch: CUDA=" + cuda_uuid + " driver=" + driver_uuid)
            actual = {"ordinal": 0, "uuid": driver_uuid}
            require(self.device_identity is None or auth.same_json(self.device_identity, actual), "GPU identity changed")
            self.device_identity = actual
            initial = self.__live_context is None
            context = authenticate_live(self.binding, root=self.root, phase=self.execution_phase) if initial else self.__live_context
            require(type(context) is auth.Context, "resource Context type differs")
            require(context.reader.root == self.root.absolute(), "resource Context root differs")
            require(auth.same_json(context.package_binding, self.binding), "resource Context package binding differs")
            require(auth.same_json(context.plan, self.plan), "resource Context plan differs")
            if initial:
                self.__live_context = context
            else:
                auth.verify_live_context(context, expected_phase=self.execution_phase)
                verify_loaded_sources(context.reader, context.plan)
            self.last = time.monotonic()


def _legacy_progress_publisher(reader, plan, guard):
    from painter_stage4_detail_weight_capture_execution_worker import replace_progress_file
    last = [None]
    def publish(value, *, state="executing", force=False):
        if not force and last[0] is not None and time.monotonic() - last[0] < 5:
            return
        counts = value["optimizerSteps"]
        record = {"schemaVersion": "ai-painter-current-training-progress-v1", "status": "bounded_training_progress_not_formal_qualified",
            "capabilityVersion": plan["capabilityVersion"], "runId": plan["runId"], "packageId": plan["packageId"],
            "actualEpoch": value["epoch"], "completedEpochs": value["completedEpochs"], "executionState": state,
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "selectedCheckpoint": value.get("selectedCheckpoint"), "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
        if value.get("latestTrainingPreview") is not None:
            record["latestTrainingPreview"] = value["latestTrainingPreview"]
        path = reader.path(plan["outputRoot"] + "/progress.json")
        pending = path.with_name("progress.json.staged-" + os.urandom(8).hex())
        raw = capture.json_bytes(record)
        require(capture.directory_bytes(path.parent) + len(raw) + 65536 <= capture.MAX_EXECUTION, "progress evidence reserve")
        with pending.open("xb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        replace_progress_file(pending, path, deadline=guard.started + guard.seconds)
        reader.mapping.check()
        last[0] = time.monotonic()
    return publish


def _replace_joint_progress_file(pending, target, *, deadline):
    """The frozen five-attempt replacement, without importing its whole worker."""
    pending, target = Path(pending), Path(target)
    require(pending.parent == target.parent and target.name == "progress.json"
            and re.fullmatch(r"progress\.json\.staged-[a-f0-9]{16}", pending.name),
            "exact same-directory staged progress publication required")

    def regular(file, *, may_be_missing=False):
        try:
            info = file.lstat()
        except FileNotFoundError:
            if may_be_missing:
                return
            raise
        require(stat.S_ISREG(info.st_mode) and not stat.S_ISLNK(info.st_mode)
                and not getattr(info, "st_file_attributes", 0)
                & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400),
                "progress publication paths must be regular files")

    regular(pending)
    regular(target, may_be_missing=True)
    operation_deadline = min(deadline, time.monotonic() + .250)
    first_error = None
    for attempt in range(5):
        if time.monotonic() >= operation_deadline:
            if first_error is not None:
                raise first_error
            raise TimeoutError("progress publication deadline exhausted")
        try:
            os.replace(pending, target)
            return
        except OSError as error:
            if sys.platform != "win32" or getattr(error, "winerror", None) not in (5, 32, 33):
                if first_error is not None:
                    raise first_error from error
                raise
            if first_error is None:
                first_error = error
            if attempt == 4:
                raise first_error
            try:
                regular(pending)
                regular(target)
            except (OSError, ValueError):
                raise first_error
            delay = .010 * (2 ** attempt)
            if time.monotonic() + delay >= operation_deadline:
                raise first_error
            time.sleep(delay)


def progress_publisher(reader, plan, guard):
    if plan.get("capabilityVersion") != auth.JOINT_CAPABILITY:
        return _legacy_progress_publisher(reader, plan, guard)
    source = auth.verify_progress_publication(reader, plan)
    from ai_painter.complete_world import bounded_progress_publication_cpu_v1 as component
    require(Path(component.__file__).absolute() == reader.path(source["path"]).absolute()
        and hashlib.sha256(Path(component.__file__).read_bytes()).hexdigest() == source["sha256"],
        "actual imported progress component differs")
    logical = plan["outputRoot"] + "/progress.json"
    path = reader.path(logical)
    parent_identity = capture._directory_identity(path.parent)
    deadline = guard.started + guard.seconds
    last = [None]

    def check_budget(extra):
        reader.mapping.check()
        require(reader.path(logical) == path and capture._directory_identity(path.parent) == parent_identity,
            "progress output mapping/parent changed")
        roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]")) or [plan["outputRoot"]]
        require(type(roots) is list and 1 <= len(roots) <= 32 and len(roots) == len(set(roots))
            and plan["outputRoot"] in roots, "progress owned accounting roots differ")
        maximum = int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX", capture.MAX_EXECUTION))
        require(0 < maximum <= capture.MAX_EXECUTION, "progress output ceiling differs")
        used = sum(capture.directory_bytes(reader.path(root)) for root in roots)
        require(used + extra + 65536 <= maximum, "progress evidence reserve")

    publisher = component.BoundedProgressPublisher(path, replace_snapshot=_replace_joint_progress_file,
        check_budget=check_budget, clock=time.monotonic)

    def publish(value, *, state="executing", force=False):
        if guard.started + guard.seconds != deadline:
            error = ValueError("original progress execution deadline changed")
            publisher.closed = True
            if publisher.first_error is not None:
                raise publisher.first_error from error
            raise error
        now = time.monotonic()
        if (not force and last[0] is not None and 0 <= now - last[0] < 5 and now < deadline
                and publisher.last_published_capture is not None
                and now < publisher.last_published_capture + component.FRESHNESS_SECONDS):
            return
        counts = value["optimizerSteps"]
        record = {"schemaVersion": "ai-painter-current-training-progress-v1", "status": "bounded_training_progress_not_formal_qualified",
            "capabilityVersion": plan["capabilityVersion"], "runId": plan["runId"], "packageId": plan["packageId"],
            "actualEpoch": value["epoch"], "completedEpochs": value["completedEpochs"], "executionState": state,
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "selectedCheckpoint": value.get("selectedCheckpoint"), "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
        if value.get("latestTrainingPreview") is not None:
            record["latestTrainingPreview"] = value["latestTrainingPreview"]
        raw = capture.json_bytes(record)
        status = publisher.publish(raw, execution_deadline=deadline)
        if force and status == "published_retained_snapshot":
            status = publisher.publish(raw, execution_deadline=deadline)
        if force and status != "published":
            error = ValueError("current final progress snapshot was not published")
            publisher.closed = True
            if publisher.first_error is not None:
                raise publisher.first_error from error
            raise error
        reader.mapping.check()
        require(reader.path(logical) == path and capture._directory_identity(path.parent) == parent_identity,
            "progress output mapping/parent changed")
        last[0] = time.monotonic()
        return status
    return publish


def terminal(error, result, binding, plan, gpu_binding, *, training_preview_manifest=None):
    counts = result.get("optimizerSteps") if result is not None else getattr(error, "actual_optimizer_counts", None)
    if counts is not None:
        require(type(counts) is dict and set(counts) == {"generator", "discriminator"} and
                all(type(n) is int and 0 <= n <= 1152 for n in counts.values()), "terminal actual count boundary")
    receipt = getattr(error, "object_support_failure_capture_receipt", None) if error is not None else None
    body = {"schema": TERMINAL_SCHEMA, "status": "failed_closed" if error is not None else "training_completed_review_pending",
        "executionState": "failed_closed" if error is not None else "completed", "capabilityVersion": plan["capabilityVersion"],
        "executionProfile": auth.execution_route(plan["capabilityVersion"]).profile, "runId": plan["runId"], "packageId": plan["packageId"], "executionPackage": binding,
        "optimizerSteps": counts, "optimizerStepsGenerator": None if counts is None else counts["generator"],
        "optimizerStepsDiscriminator": None if counts is None else counts["discriminator"],
        "completedEpochs": result["completedEpochs"] if result is not None else getattr(error, "completed_epochs", None),
        "failurePosition": None if error is None else getattr(error, "failure_position", None),
        "captureStatus": receipt["status"] if receipt is not None else "capture_not_triggered" if error is None else "capture_incomplete",
        "captureReceipt": receipt, "originalError": None if error is None else capture.primary_error(error),
        "captureMissing": [] if error is None else receipt.get("missing", []) if receipt is not None else ["numerical failure scene unavailable"],
        "checkpoints": result["checkpoints"] if result is not None else getattr(error, "partial_checkpoint_records", []),
        "epochObservations": result.get("epochObservations", []) if result is not None else getattr(error, "epoch_observations", []),
        "selectedCheckpointRecord": result.get("selectedCheckpointRecord") if result is not None else None,
        "checkpointReloadVerified": result.get("checkpointReloadVerified", False) if result is not None else False,
        "checkpointSelectionExecuted": result is not None,
        "validationRgbRead": result is not None or bool(getattr(error, "quality_validation_rgb_read", False)),
        "challengeContentRead": False, "regressionContentRead": False, "automaticRetries": 0,
        "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False, "checkpointPromotable": False,
        "executionAuthentication": {"executionPackage": binding, "finalCpuAcceptance": plan["finalCpuAcceptance"], "ownedGpuAcceptance": gpu_binding},
        "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
    if training_preview_manifest is not None:
        body["trainingPreviewManifest"] = auth.exact_binding(training_preview_manifest)
    return body


def verify_capture_terminal(reader, body, plan):
    require(body["runId"] == plan["runId"] and body["executionProfile"] == auth.execution_route(plan["capabilityVersion"]).profile, "capture terminal Run/profile differs")
    if body["captureStatus"] == "captured":
        receipt = body.get("captureReceipt")
        require(type(receipt) is dict and receipt.get("status") == "captured" and
                auth.same_json(receipt.get("primaryError"), body["originalError"]), "captured primary/receipt differs")
        manifest, _ = capture.verify_capture(receipt, reader.mapping)
        require(auth.same_json(manifest["context"]["optimizerSteps"], body["optimizerSteps"]) and
                auth.same_json(manifest["context"]["failurePosition"], body["failurePosition"]) and
                auth.same_json(manifest["context"]["programBindings"], plan["programBindings"]) and
                auth.same_json(manifest["context"]["modelBinding"], plan["modelBinding"]), "captured metadata/terminal differs")
    return body


def observed_pair(pair, model, *args, observation_profile=None, **kwargs):
    """Retain only this pair's real VJP observations if a later commit fails."""
    from ai_painter.complete_world.object_support_structure_priority_update_device_v1 import (
        observe_generator_gradients, COMPONENTS_IN_ORDER)
    if observation_profile is not None:
        capability = getattr(observation_profile, "CAPABILITY", None)
        require(capability in (auth.FINAL_RGB_CAPABILITY, auth.JOINT_CAPABILITY)
            and observation_profile is auth.profile_components(capability), "exact registered observation profile required")
        observe_generator_gradients=observation_profile.observe_generator_gradients
        COMPONENTS_IN_ORDER=observation_profile.COMPONENTS_IN_ORDER
    raw = []
    def observed(stage, label, rows):
        if stage == "complete":
            require(len(raw) < 5 and label == COMPONENTS_IN_ORDER[len(raw)], "actual five-gradient order differs")
            raw.append(rows)
    try:
        with observe_generator_gradients(observed):
            return pair(*args, **kwargs)
    except BaseException as error:
        if not hasattr(error, "object_support_gradient_evidence"):
            try:
                error.object_support_gradient_evidence = {"gradientSetsAvailable": len(raw),
                    "rawGradients": tuple(raw), "componentsInOrder": list(COMPONENTS_IN_ORDER),
                    "parameterNames": [name for name, _ in model.named_parameters()]}
            except BaseException as secondary:
                try: error.secondary_gradient_evidence_error = str(secondary)[:2048]
                except BaseException: pass
        raise


class TrainingPreviewBridge:
    """Optional train-only bridge; live execution authority stays in authenticate_live.

    No guard is called within optional diagnostic exception handling. The original
    training resource() calls and control BaseExceptions retain their stop behavior.
    """
    def __init__(self, context, train, plan_binding):
        self.context, self.train, self.plan_binding = context, train, plan_binding
        self.storage = None
        self.latest = self.secondary_error = None
        self.disabled = False
        self.forward_sequence = 0
        try:
            from ai_painter.complete_world.training_preview_storage_v1 import TrainingPreviewStorage
            roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]")) or [context.plan["outputRoot"]]
            maximum = min(capture.MAX_EXECUTION, int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX", capture.MAX_EXECUTION)))
            self.storage = TrainingPreviewStorage(context.reader.root, policy=context.plan["trainingPreviewPolicy"],
                plan=plan_binding, execution_package=context.package_binding, output_roots=roots,
                maximum_output_bytes=maximum)
            self.train_indexes = {sample["sampleId"]: index for index, sample in enumerate(train)}
            require(len(self.train_indexes) == len(train) == 48, "preview train identity cardinality")
        except Exception as error:
            self._fail(error, "binding_mismatch")

    def _fail(self, error, code):
        self.disabled = True
        if self.secondary_error is None:
            try: message = str(error)[:256]
            except Exception: message = "preview exception formatting failed"
            self.secondary_error = {"errorType": type(error).__name__, "message": message,
                "availabilityCode": code, "impact": "preview_unavailable_training_first_error_unchanged"}
        if self.storage is not None and self.storage.secondary_error is None:
            self.storage.secondary_error = dict(self.secondary_error)

    def observe(self, prediction, sample, counts):
        if self.disabled or self.storage is None:
            return
        code = "binding_mismatch"
        try:
            self.forward_sequence += 1  # Actual G prediction callbacks, excluding D/validation.
            require(type(counts) is dict and all(type(counts.get(k)) is int for k in ("generator", "discriminator"))
                and 0 <= counts["generator"] < 1152 and counts["discriminator"] == counts["generator"] + 1,
                "preview actual pre-G counters")
            epoch, ordinal = counts["generator"] // 48 + 1, counts["generator"] % 48
            if ordinal != 0:
                return
            from ai_painter.complete_world.training_preview_observer_v1 import PreviewIdentity, Binding
            token = sample["_ecology_regime_binding"]
            require(token.reader is self.context.reader, "preview sample reader differs")
            source = json.loads(token.identity_json)
            require(sample["split"] == source["split"] == "train" and sample["sampleId"] == source["sampleId"],
                "preview actual train sample differs")
            task = self.context.reader.json(source["taskPackage"])
            facts = {"path": task["sourceBindings"]["naturalizedWorldFactsPath"],
                "sha256": task["sourceBindings"]["naturalizedWorldFactsSha256"]}
            require(facts["sha256"] == source["factHash"], "preview sample WorldFacts digest differs")
            def bound(value): return Binding(value["path"], value["sha256"])
            plan = self.context.plan
            identity = PreviewIdentity(run_id=plan["runId"], package_id=plan["packageId"],
                capability_version=plan["capabilityVersion"], model_capability_version=plan["configuration"]["modelCapabilityVersion"],
                epoch=epoch, train_ordinal=ordinal, train_index=self.train_indexes[sample["sampleId"]],
                sample_id=sample["sampleId"], generator_updates=counts["generator"], discriminator_updates=counts["discriminator"],
                forward_sequence=self.forward_sequence, execution_package=bound(self.context.package_binding),
                plan=bound(self.plan_binding), model=bound(plan["modelBinding"]), dataset_manifest=bound(plan["datasetManifest"]),
                source_rgb=bound(source["image"]), condition_pack=bound(source["conditionPack"]), world_facts=bound(facts),
                configuration_sha256=codec_for_plan(plan).configuration_digest(plan["configuration"]),
                program_bindings_sha256=codec_for_plan(plan).configuration_digest(plan["programBindings"]))
            if not self.storage.should_capture(identity):
                return
            code = "capture_failed"
            cpu_frame = prediction.detach().to(device="cpu", copy=True).contiguous()
            entry = self.storage.capture(cpu_frame, identity, world_id=source["worldId"], tick=source["tick"])
            if entry is not None:
                self.latest = entry
            if self.storage.secondary_error is not None:
                self.secondary_error, self.disabled = dict(self.storage.secondary_error), True
        except Exception as error:
            self._fail(error, code)

    def progress(self, value):
        if self.latest is not None:
            value = {**value, "latestTrainingPreview": self.latest}
        return value

    def finish(self, error=None):
        if self.storage is None:
            manifest = None
        else:
            try:
                manifest = self.storage.finish(training_error=error, failure_position=getattr(error, "failure_position", None))
                if self.storage.secondary_error is not None:
                    self.secondary_error = dict(self.storage.secondary_error)
            except Exception as secondary:
                self._fail(secondary, "capture_failed")
                manifest = None
        if error is not None and self.secondary_error is not None:
            try: error.training_preview_secondary_error = dict(self.secondary_error)
            except Exception: pass
        return manifest


def training_preview_bridge(context, train, plan_binding):
    if "trainingPreviewPolicy" not in context.plan and "trainingPreviewPolicy" not in context.plan["configuration"]:
        return None  # Legacy/qualification routes do not import storage or install a hook.
    return TrainingPreviewBridge(context, train, plan_binding)


def training_pair_runner(profile, model, preview):
    def actual_pair(*args, **kwargs):
        if preview is not None:
            kwargs["prediction_observer"] = preview.observe
        if getattr(profile,"CAPABILITY",CAPABILITY) in (auth.FINAL_RGB_CAPABILITY, auth.JOINT_CAPABILITY):
            kwargs["observation_profile"]=profile
        return observed_pair(profile.perform_pair, model, *args, **kwargs)
    return actual_pair


def run(binding, gpu_binding, *, root=ROOT):
    import painter_stage4_object_support_structure_lifecycle_v1 as loop
    started = time.monotonic()
    context = authenticate_live(binding, root=root)
    torch, profile, shared = runtime_for_plan(context.plan)
    torch.set_num_threads(2)
    reader, plan = context.reader, context.plan
    write(root, plan["outputRoot"] + "/training-consumed.json", {"executionPackage": binding, "attempt": 1, "automaticRetries": 0})
    result = None
    preview = None
    validation_read = False
    try:
        gate = verify_owned_gpu(reader, plan, binding, gpu_binding)
        loaded, order = load_samples(reader, plan, splits=("train", "validation"))
        validation_read = True
        train = loaded["train"]
        verify_loaded_sources(reader, plan)
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        torch.cuda.set_per_process_memory_fraction(.7)
        torch.cuda.init()
        torch.cuda.set_device(0)
        guard = ResourceGuard(binding, plan, root=root, started=started)
        guard()
        require(auth.same_json(guard.device_identity, gate.get("deviceIdentity")), "execution GPU differs from own gate")
        progress = progress_publisher(reader, plan, guard)
        ticket = write(root, plan["outputRoot"] + "/capture-execution.json", {
            "schema": "object-support-structure-failure-capture-execution-v1", "runId": plan["runId"], "outputRoot": plan["outputRoot"],
            "modelBinding": plan["modelBinding"], "programBindings": plan["programBindings"], "executionPackage": binding})
        def initial(model, critic):
            capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), auth.read_json(reader, plan["modelBinding"])["graph"])
            actual = {"generator": shared.v24.core.cpu.state_hash(model), "discriminator": shared.v24.core.cpu.state_hash(critic)}
            require(auth.same_json(actual, gate["initialCpuState"]), "actual fresh execution initial state differs")
            reader.unchanged()
        def sample_context(sample, position):
            require(sample is not None and position is not None, "failure occurred before a bound train sample")
            identity = json.loads(sample["_ecology_regime_binding"].identity_json)
            return {"runId": plan["runId"], "sampleId": sample["sampleId"], "split": "train", "sampleIdentity": identity,
                "sampleBindings": {"source": identity["image"], "condition": identity["conditionPack"]},
                "modelBinding": plan["modelBinding"], "programBindings": plan["programBindings"], "executionPackage": binding}
        def sink(error, **kwargs):
            roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]")) or [plan["outputRoot"]]
            maximum = min(capture.MAX_EXECUTION, int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX", capture.MAX_EXECUTION)))
            remaining = maximum - sum(capture.directory_bytes(reader.path(r)) for r in roots) - 65536
            receipt = capture.capture_failure(error, **kwargs, mapping=reader.mapping,
                output=plan["outputRoot"] + "/gradient-failure", execution_binding=ticket, remaining_output_bytes=min(capture.MAX_CAPTURE, remaining))
            if receipt["status"] == "captured":
                try:
                    capture.verify_capture(receipt, reader.mapping)
                except BaseException as secondary:
                    receipt = {**receipt, "status": "capture_incomplete", "secondaryCaptureFailure": capture.primary_error(secondary),
                        "missing": [*receipt.get("missing", []), "independent capture verification failed"]}
            return receipt
        model, critic = profile.fresh_networks(order)
        initial(model, critic)
        model, critic = model.to("cuda:0"), critic.to("cuda:0")
        plan_binding = next(b for b in context.package["inputEvidence"] if b["path"] == plan["outputRoot"] + "/quality-plan.json")
        preview = training_preview_bridge(context, train, plan_binding)
        def checkpoint_sink(epoch, value):
            if epoch is None:
                return reader.read(value)
            guard()
            return write(root, plan["outputRoot"] + f"/checkpoint-{epoch:02d}.pt", value)
        def progress_sink(epoch, counts, selected, *, completed_epochs=0):
            value = {"epoch": epoch, "completedEpochs": completed_epochs, "optimizerSteps": counts,
                "selectedCheckpoint": None if selected is None else selected["checkpoint"]}
            progress(value if preview is None else preview.progress(value))
        def observation_sink(epoch, value):
            require(epoch == 12 and value.get("checkpointSelectionEligible") is False and value.get("weightUpdates") == 0,
                "midpoint observation cannot authorize selection or updates")
            guard()
            return write(root, plan["outputRoot"] + "/epoch-observation-12.json", value)
        actual_pair = training_pair_runner(profile, model, preview)
        result = loop.training_loop(model=model, critic=critic, train=train, validation=loaded["validation"],
            order=order, configuration=plan["configuration"], package_binding=binding, plan=plan,
            plan_binding=plan_binding, resource=guard, checkpoint_sink=checkpoint_sink,
            progress_sink=progress_sink, capture_sink=sink, context_for_sample=sample_context,
            observation_sink=observation_sink, pair_runner=actual_pair)
        require(result["optimizerSteps"] == {"generator": 1152, "discriminator": 1152}
            and result["completedEpochs"] == 24, "quality fixed24 completion differs")
        authenticate_live(binding, root=root)
        reader.unchanged()
        manifest = None if preview is None else preview.finish()
        value = {"epoch": 24, "completedEpochs": result["completedEpochs"], "optimizerSteps": result["optimizerSteps"],
            "selectedCheckpoint": result["selectedCheckpointRecord"]["checkpoint"]}
        progress(value if preview is None else preview.progress(value), state="completed", force=True)
        return write(root, plan["outputRoot"] + "/worker-terminal.json", terminal(None, result, binding, plan, gpu_binding,
            training_preview_manifest=manifest), terminal=True)
    except BaseException as error:
        error.quality_validation_rgb_read = validation_read
        if result is not None:
            error.actual_optimizer_counts = result["optimizerSteps"]
            error.completed_epochs = result["completedEpochs"]
            error.partial_checkpoint_records = result["checkpoints"]
        manifest = None if preview is None else preview.finish(error)
        try:
            body = terminal(error, result, binding, plan, gpu_binding, training_preview_manifest=manifest)
            try:
                verify_capture_terminal(reader, body, plan)
            except BaseException as secondary:
                body["captureStatus"] = "capture_incomplete"
                body["captureVerificationError"] = capture.primary_error(secondary)
                body["captureMissing"] = [*body["captureMissing"], "terminal/capture metadata verification failed"]
            write(root, plan["outputRoot"] + "/worker-terminal.json", body, terminal=True)
        except BaseException as secondary:
            error.secondary_evidence_error = str(secondary)[:2048]
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    parser.add_argument("--model-metadata", action="store_true")
    parser.add_argument("--dataset-manifest")
    parser.add_argument("--dataset-sha256")
    parser.add_argument("--capability-version", default=CAPABILITY)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--gpu")
    parser.add_argument("--gpu-sha256")
    args = parser.parse_args()
    if args.model_metadata:
        require(args.dataset_manifest and args.dataset_sha256 and not args.package and not args.gpu
            and not args.preflight, "metadata-only CPU arguments required")
        runtime()[0].set_num_threads(2)
        if runtime()[0].get_num_interop_threads() != 2:
            runtime()[0].set_num_interop_threads(2)
        import psutil
        metadata_process = psutil.Process()
        metadata_process.cpu_affinity(metadata_process.cpu_affinity()[:2])
        metadata_reader = auth.Reader(ROOT)
        route=auth.execution_route(args.capability_version)
        auth.derive_configuration(metadata_reader,capability_version=route.capability)
        result = auth.derive_model_metadata(metadata_reader,
            {"path": args.dataset_manifest, "sha256": args.dataset_sha256},capability_version=route.capability)
        metadata_reader.unchanged()
        require(not runtime()[0].cuda.is_initialized(), "metadata must not initialize CUDA")
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
        raise SystemExit(0)
    require(args.capability_version == CAPABILITY, "route override only permitted for authenticated metadata preparation")
    require(args.package and args.sha256, "own package arguments required")
    binding = {"path": args.package, "sha256": args.sha256}
    if args.preflight:
        runtime()[0].set_num_threads(2)
        load_package(binding)
        print(json.dumps({"status": "own_quality_entry_preflight_passed_not_gpu_qualified", "gpuInitialized": runtime()[0].cuda.is_initialized()}))
    else:
        require(args.gpu and args.gpu_sha256, "own same-package GPU release required")
        print(json.dumps(run(binding, {"path": args.gpu, "sha256": args.gpu_sha256})))

"""Authenticated quality worker: 12 epochs, one checkpoint and retained failure capture."""
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
import subprocess
import sys
import time
import types

ROOT = Path(__file__).absolute().parents[3]
for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    sys.path.insert(0, str(directory))
import ecology_quality_auth_v1 as auth
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture
from ai_painter.complete_world import ecology_quality_checkpoint_v1 as checkpoint

CAPABILITY, EXECUTION_PROFILE = auth.CAPABILITY, auth.PROFILE
TERMINAL_SCHEMA = "ecology-regime-quality-worker-terminal-v1"
GPU_SCHEMA = "ecology-regime-quality-all-train-gpu-gate-v1"
CPU_SCHEMA = "ecology-regime-quality-entry-cpu-report-v1"
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


def runtime():
    import torch
    import painter_stage4_ecology_regime_training_profile as profile
    import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
    return torch, profile, shared


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
    sources = {b["path"]: b["sha256"] for b in programs.values()}
    native = payload["nativeBuild"]
    require(sources.get("scripts/windows/ai-painter-owned-worker-owner.cs")
            == native["source"]["sha256"] == guard["nativeOwnerSource"]["sha256"]
            and guard["helperSha256"] in sources.values(), "owned native/helper source differs")
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
    for key in ("programBindings", "configuration", "modelBinding", "runtimeIdentity"):
        require(auth.same_json(raw.get(key), plan.get(key)) and auth.same_json(request.get(key), plan.get(key)), "CPU source/model/config mismatch: " + key)
    require(request.get("schema") == "ecology-regime-quality-cpu-request-v1" and
            request.get("runId") == plan["runId"] and request.get("packageId") == plan["packageId"] and
            request.get("outputRoot") == plan["outputRoot"] + "/cpu-entry" and
            len(raw.get("items", [])) == raw["passed"] and all(x.get("status") == "passed" for x in raw["items"]), "CPU request/items/Run differ")


def verify_final_cpu(reader, plan):
    acceptance = auth.read_json(reader, plan["finalCpuAcceptance"])
    require(acceptance.get("schema") == "ecology-regime-quality-final-cpu-acceptance-v1" and
            acceptance.get("status") == "passed" and auth.same_json(acceptance.get("programBindings"), plan["programBindings"]), "own final CPU acceptance required")
    raw = auth.read_json(reader, acceptance["report"])
    request = auth.read_json(reader, raw["request"])
    verify_cpu_report(raw, request, plan)
    require(auth.same_json(raw.get("initialModel"), auth.read_json(reader, plan["modelBinding"])), "actual CPU initial model binding differs")
    require(auth.same_json(raw.get("dataClosure"), plan["dataClosure"]), "CPU source data closure differs")
    verify_owned_release(reader, acceptance["ownedReceipt"], phase="cpu", output_root=plan["outputRoot"],
        args=["-B", str(reader.root / auth.ROLES["cpuHarness"]), "--cpu-request", raw["request"]["path"],
              "--sha256", raw["request"]["sha256"]], programs=plan["programBindings"])
    return acceptance


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


def authenticate_live(binding, *, root=ROOT):
    context = load_package(binding, root=root)
    auth.verify_live_context(context)
    return context


def load_samples(reader, plan, *, splits=None):
    from painter_stage4_ecology_regime_execution_worker import load_samples as neutral_samples
    requested = ("train",) if splits is None else splits
    loaded, order = neutral_samples(reader, plan, splits=requested)
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
    expected = {kind + suffix: count for kind, count in (("forward", 48), ("generator", 192), ("discriminator", 48))
                for suffix in ("Attempted", "Completed")}
    require(gate.get("schema") == GPU_SCHEMA and gate.get("status") == "passed" and
            gate.get("capabilityVersion") == CAPABILITY and gate.get("executionProfile") == EXECUTION_PROFILE and
            gate.get("runId") == plan["runId"] and gate.get("packageId") == plan["packageId"] and
            auth.same_json(gate.get("executionPackage"), package_binding) and
            auth.same_json(gate.get("programBindings"), plan["programBindings"]) and
            auth.same_json(gate.get("actualCounts"), expected) and
            type(gate.get("deviceIdentity")) is dict and gate["deviceIdentity"].get("ordinal") == 0 and
            type(gate["deviceIdentity"].get("uuid")) is str and
            gate["deviceIdentity"]["uuid"] == _gpu_uuid(gate["deviceIdentity"]["uuid"])[1] and
            [r["sampleId"] for r in gate.get("cases", [])] == auth.read_json(reader, plan["trainSplit"])["sampleIds"] and
            all(r.get("passed") is True and auth.same_json(r.get("proof", {}).get("callCounts"),
                {"generatorForwards": 1, "generatorAutograd": 4, "discriminatorAutograd": 1}) and
                r["proof"].get("optimizerCreated") is False and r["proof"].get("optimizerUpdates") == 0 for r in gate["cases"]) and
            type(gate.get("optimizerSteps")) is int and gate["optimizerSteps"] == 0 and
            gate.get("checkpointLoaded") is False and gate.get("checkpointWritten") is False and
            auth.same_json(gate.get("initialState"), gate.get("finalState")) and
            auth.same_json(gate.get("initialCpuState"), auth.read_json(reader, plan["modelBinding"])["initialState"]), "own full48 zero-update GPU proof differs")
    return gate


def verify_owned_gpu(reader, plan, package_binding, binding):
    require(binding["path"] == plan["outputRoot"] + "/gpu-acceptance.json", "own GPU release path differs")
    admission = auth.read_json(reader, binding)
    require(admission.get("schema") == "ecology-regime-quality-owned-gpu-acceptance-v1" and
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
        self.seconds = 600 if gpu_gate else 2700
        self.last = None
        self.device_identity = None
        self.__live_context = None

    def __call__(self):
        torch, _, shared = runtime()
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
            context = authenticate_live(self.binding, root=self.root) if initial else self.__live_context
            require(type(context) is auth.Context, "resource Context type differs")
            require(context.reader.root == self.root.absolute(), "resource Context root differs")
            require(auth.same_json(context.package_binding, self.binding), "resource Context package binding differs")
            require(auth.same_json(context.plan, self.plan), "resource Context plan differs")
            if initial:
                self.__live_context = context
            else:
                auth.verify_live_context(context)
                verify_loaded_sources(context.reader, context.plan)
            self.last = time.monotonic()


def progress_publisher(reader, plan, guard):
    from painter_stage4_detail_weight_capture_execution_worker import replace_progress_file
    last = [None]
    def publish(value, *, state="executing", force=False):
        if not force and last[0] is not None and time.monotonic() - last[0] < 5:
            return
        counts = value["optimizerSteps"]
        record = {"schemaVersion": "ai-painter-current-training-progress-v1", "status": "bounded_training_progress_not_formal_qualified",
            "capabilityVersion": CAPABILITY, "runId": plan["runId"], "packageId": plan["packageId"],
            "actualEpoch": value["epoch"], "completedEpochs": value["completedEpochs"], "executionState": state,
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "selectedCheckpoint": value.get("selectedCheckpoint"), "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
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


def terminal(error, result, binding, plan, gpu_binding):
    counts = result.get("optimizerSteps") if result is not None else getattr(error, "actual_optimizer_counts", None)
    if counts is not None:
        require(type(counts) is dict and set(counts) == {"generator", "discriminator"} and
                all(type(n) is int and 0 <= n <= 576 for n in counts.values()), "terminal actual count boundary")
    receipt = getattr(error, "ecology_failure_capture_receipt", None) if error is not None else None
    return {"schema": TERMINAL_SCHEMA, "status": "failed_closed" if error is not None else "training_completed_review_pending",
        "executionState": "failed_closed" if error is not None else "completed", "capabilityVersion": CAPABILITY,
        "executionProfile": EXECUTION_PROFILE, "runId": plan["runId"], "packageId": plan["packageId"], "executionPackage": binding,
        "optimizerSteps": counts, "optimizerStepsGenerator": None if counts is None else counts["generator"],
        "optimizerStepsDiscriminator": None if counts is None else counts["discriminator"],
        "completedEpochs": result["completedEpochs"] if result is not None else getattr(error, "completed_epochs", None),
        "failurePosition": None if error is None else getattr(error, "failure_position", None),
        "captureStatus": receipt["status"] if receipt is not None else "capture_not_triggered" if error is None else "capture_incomplete",
        "captureReceipt": receipt, "originalError": None if error is None else capture.primary_error(error),
        "captureMissing": [] if error is None else receipt.get("missing", []) if receipt is not None else ["numerical failure scene unavailable"],
        "checkpoints": result["checkpoints"] if result is not None else getattr(error, "partial_checkpoint_records", []),
        "selectedCheckpointRecord": result.get("selectedCheckpointRecord") if result is not None else None,
        "checkpointReloadVerified": result.get("checkpointReloadVerified", False) if result is not None else False,
        "checkpointSelectionExecuted": result is not None,
        "validationRgbRead": result is not None or bool(getattr(error, "quality_validation_rgb_read", False)),
        "challengeContentRead": False, "regressionContentRead": False, "automaticRetries": 0,
        "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False, "checkpointPromotable": False,
        "executionAuthentication": {"executionPackage": binding, "finalCpuAcceptance": plan["finalCpuAcceptance"], "ownedGpuAcceptance": gpu_binding},
        "recordedAtUtc": datetime.now(timezone.utc).isoformat()}


def verify_capture_terminal(reader, body, plan):
    require(body["runId"] == plan["runId"] and body["executionProfile"] == EXECUTION_PROFILE, "capture terminal Run/profile differs")
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


def run(binding, gpu_binding, *, root=ROOT):
    import painter_stage4_ecology_quality_lifecycle_v1 as loop
    torch, profile, shared = runtime()
    torch.set_num_threads(2)
    started = time.monotonic()
    context = authenticate_live(binding, root=root)
    reader, plan = context.reader, context.plan
    write(root, plan["outputRoot"] + "/training-consumed.json", {"executionPackage": binding, "attempt": 1, "automaticRetries": 0})
    result = None
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
            "schema": "ecology-regime-failure-capture-execution-v1", "runId": plan["runId"], "outputRoot": plan["outputRoot"],
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
        def checkpoint_sink(epoch, value):
            if epoch is None:
                return reader.read(value)
            guard()
            return write(root, plan["outputRoot"] + f"/checkpoint-{epoch:02d}.pt", value)
        def progress_sink(epoch, counts, selected, *, completed_epochs=0):
            progress({"epoch": epoch, "completedEpochs": completed_epochs, "optimizerSteps": counts,
                "selectedCheckpoint": None if selected is None else selected["checkpoint"]})
        result = loop.training_loop(model=model, critic=critic, train=train, validation=loaded["validation"],
            order=order, configuration=plan["configuration"], package_binding=binding, plan=plan,
            plan_binding=plan_binding, resource=guard, checkpoint_sink=checkpoint_sink,
            progress_sink=progress_sink, capture_sink=sink, context_for_sample=sample_context)
        require(result["optimizerSteps"] == {"generator": 576, "discriminator": 576}
            and result["completedEpochs"] == 12, "quality fixed12 completion differs")
        authenticate_live(binding, root=root)
        reader.unchanged()
        progress({"epoch": 12, "completedEpochs": result["completedEpochs"], "optimizerSteps": result["optimizerSteps"],
            "selectedCheckpoint": result["selectedCheckpointRecord"]["checkpoint"]}, state="completed", force=True)
        return write(root, plan["outputRoot"] + "/worker-terminal.json", terminal(None, result, binding, plan, gpu_binding), terminal=True)
    except BaseException as error:
        error.quality_validation_rgb_read = validation_read
        if result is not None:
            error.actual_optimizer_counts = result["optimizerSteps"]
            error.completed_epochs = result["completedEpochs"]
            error.partial_checkpoint_records = result["checkpoints"]
        try:
            body = terminal(error, result, binding, plan, gpu_binding)
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
    parser.add_argument("--package", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--gpu")
    parser.add_argument("--gpu-sha256")
    args = parser.parse_args()
    binding = {"path": args.package, "sha256": args.sha256}
    if args.preflight:
        runtime()[0].set_num_threads(2)
        load_package(binding)
        print(json.dumps({"status": "own_quality_entry_preflight_passed_not_gpu_qualified", "gpuInitialized": runtime()[0].cuda.is_initialized()}))
    else:
        require(args.gpu and args.gpu_sha256, "own same-package GPU release required")
        print(json.dumps(run(binding, {"path": args.gpu, "sha256": args.gpu_sha256})))

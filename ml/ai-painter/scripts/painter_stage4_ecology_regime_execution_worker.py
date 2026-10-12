"""Own ecology managed execution adapter; no old-capability admission fallback.

The numerical lifecycle is a pure component. This adapter supplies immutable
source authentication, final-entry CPU evidence, live identity and GPU admission.
The existing supervisor must still own the process and its hard deadline.
"""
from datetime import datetime, timezone
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
for p in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
import ecology_regime_execution_auth as auth
from ai_painter.complete_world import ecology_regime_managed_checkpoint as checkpoint

CAPABILITY = auth.CAPABILITY
EXECUTION_PROFILE = auth.EXECUTION_PROFILE
TERMINAL_SCHEMA = "ecology-regime-managed-worker-terminal-v1"
GPU_SCHEMA = "ecology-regime-all-train-gpu-gate-v1"
PROGRESS_SCHEMA = "ai-painter-current-training-progress-v1"
PATH = "ml/ai-painter/scripts/painter_stage4_ecology_regime_execution_worker.py"
GPU_PATH = "ml/ai-painter/scripts/qualify_stage4_ecology_regime_execution_gpu.py"
REVIEW_PATH = "ml/ai-painter/scripts/review_stage4_ecology_regime_execution_cpu.py"
require = auth.require


def runtime():
    import torch
    import painter_stage4_ecology_regime_training_profile as profile
    import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
    import check_stage4_mvp256_dry_appearance_regime_cpu as source
    return torch, profile, shared, source


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
        logical = Path(name).absolute().relative_to(reader.root.absolute()).as_posix()
        require(logical.startswith(namespace + "/"), "owned native artifact outside its namespace")
        reader.read({"path": logical, "sha256": digest})
    return owned


def verify_final_cpu(reader, plan, configuration):
    """Rehash raw tests and actual owned release; component proof is insufficient."""
    acceptance = auth.read_json(reader, plan["lifecycleCpuAcceptance"])
    programs = plan["programBindings"]
    require(acceptance.get("schema") == "ecology-regime-final-entry-cpu-acceptance-v1"
            and acceptance.get("status") == "passed"
            and auth.same_json(acceptance.get("programBindings"), programs),
            "own final-entry CPU acceptance required")
    raw = auth.read_json(reader, acceptance["testResult"])
    request = auth.read_json(reader, raw["request"])
    calls = {name: 0 for name in ("cudaInitializationAttempts", "moduleForwardCalls",
        "autogradCalls", "optimizerConstructionAttempts", "optimizerUpdates")}
    require(raw.get("schema") == "ecology-regime-final-entry-cpu-report-v1"
            and raw.get("failed") == raw.get("errors") == raw.get("skipped") == 0
            and type(raw.get("passed")) is int and raw["passed"] > 0
            and len(raw.get("items", [])) == raw["passed"]
            and all(item.get("status") == "passed" for item in raw["items"])
            and raw.get("synthetic") is True and raw.get("gpuInitialized") is False
            and auth.same_json(raw.get("actualCalls"), calls)
            and auth.same_json(raw.get("configuration"), configuration)
            and auth.same_json(raw.get("programBindings"), programs)
            and auth.same_json(request.get("programBindings"), programs),
            "raw own-entry CPU tests/configuration/source identity differ")
    harness = programs["cpuHarness"]["path"]
    verify_owned_release(reader, acceptance["ownedReceipt"], phase="cpu", output_root=request["outputRoot"],
        args=["-B", str(reader.root / harness), raw["request"]["path"], raw["request"]["sha256"]], programs=programs)
    isolated = auth.read_json(reader, acceptance["isolatedRegistryProof"])
    require(isolated.get("status") == "isolated_registry_roundtrip_verified"
            and type(isolated.get("registryRevisionBefore")) is int
            and isolated["registryRevisionBefore"] + 1 == isolated.get("registryRevisionAfter")
            and isolated.get("productionRegistryChanged") is False
            and auth.same_json(isolated.get("programBindings"), programs),
            "own final-source isolated registry roundtrip required")
    reader.unchanged()
    return acceptance


def load_package(package_binding, *, root=ROOT):
    reader = runtime()[3].Reader(Path(root))
    context = auth.load_execution_package(reader, package_binding)
    plan, spec = context.plan, context.package
    for role, logical in (("worker", PATH), ("gpuQualifier", GPU_PATH), ("reviewWorker", REVIEW_PATH)):
        require(plan["programBindings"].get(role, {}).get("path") == logical,
                "own final execution adapter missing: " + role)
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
            == plan["programBindings"]["worker"]["sha256"], "loaded own worker bytes differ")
    require(any(auth.same_json(b, plan["lifecycleCpuAcceptance"]) for b in spec["inputEvidence"]),
            "final CPU acceptance omitted from immutable execution package")
    verify_final_cpu(reader, plan, context.configuration)
    closure = [b["path"] for b in plan["programBindings"].values() if b["path"].endswith(".py")]
    runtime()[3].verify_loaded_sources(reader, closure)
    reader.unchanged()
    return reader, spec, plan, context.configuration


def authenticate_live(package_binding, *, root=ROOT):
    reader, spec, plan, configuration = load_package(package_binding, root=root)
    context = auth.ExecutionContext(reader, dict(package_binding), spec, plan, configuration)
    auth.verify_live_context(context)
    return reader, spec, plan, configuration


def load_samples(reader, plan, *, splits=("train", "validation")):
    """Read only requested content, with independent ecology and season binding."""
    _torch, profile, shared, _source = runtime()
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC, CONDITION
    require(type(splits) in (tuple, list) and 0 < len(splits) <= 2
            and len(set(splits)) == len(splits)
            and all(split in ("train", "validation") for split in splits),
            "only explicit train/validation content permitted")
    metadata = profile.prepare_metadata(reader, DIAGNOSTIC, CONDITION)
    cpu = shared.v24.core.cpu
    manifest, order, continuous, _rows, _memberships = cpu.select_rows(reader)
    require(auth.same_json(reader.json(plan["datasetManifest"]), manifest), "original manifest differs")
    index = reader.json(manifest["sourceIndex"])
    rows = {row["sampleId"]: row for row in index["samples"]}
    require(len(rows) == len(index["samples"]), "duplicate original sample identity")
    loaded = {}
    for split in splits:
        ids = reader.json(plan[split + "Split"])["sampleIds"]
        require(len(ids) == len(set(ids)) == (48 if split == "train" else 8)
                and ids == metadata["splitSampleIds"][split], "original split order/count differs")
        loaded[split] = []
        for ordinal, sid in enumerate(ids):
            row = rows[sid]
            require(row["split"] == split, "cross-split source prohibited")
            sample, identity = cpu.load_sample(reader, row, order, continuous)
            record = metadata["records"][(split, ordinal)]
            # The old pure pixel loader's ordinal is a local placeholder (0),
            # not the frozen source ordinal. Preserve the latter, never relabel it.
            require(auth.same_json({k: v for k, v in identity.items() if k != "ordinal"},
                    {k: v for k, v in record["identity"].items() if k != "ordinal"}),
                    "loaded source/metadata identity differs")
            loaded[split].append(profile.bind_sample_ecology(reader, sample, record["identity"], record["regimeRecord"]))
    reader.unchanged()
    return loaded, order


def write(root, logical, value, *, terminal=False):
    """Exclusive durable artifact; terminal reserve is never used by a checkpoint."""
    import painter_stage4_detail_weight_capture_execution_worker as io
    reader = runtime()[3].Reader(Path(root))
    path = reader.path(logical)
    data = value if type(value) is bytes else (json.dumps(value, sort_keys=True,
        separators=(",", ":"), allow_nan=False) + "\n").encode()
    require(type(value) is bytes or len(data) <= (65536 if terminal else 2097152),
            "artifact JSON byte ceiling")
    roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]"))
    if roots:
        budget_reader = runtime()[3].Reader(Path(os.environ.get("DETAIL_WEIGHT_BUDGET_PROJECT_ROOT", str(root))))
        require(type(roots) is list and 1 <= len(roots) <= 4, "bounded owned output set required")
        maximum = int(os.environ["DETAIL_WEIGHT_OUTPUT_MAX"])
        require(0 < maximum <= 128 * 1024**2, "owned output ceiling differs")
        used = sum(io.directory_bytes(budget_reader.path(item)) for item in roots)
        require(used + len(data) <= maximum - (0 if terminal else 65536), "owned terminal reserve exhausted")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        require(stream.write(data) == len(data), "short artifact write")
        stream.flush()
        os.fsync(stream.fileno())
    return {"path": logical, "sha256": hashlib.sha256(data).hexdigest()}


def verify_gpu_gate(reader, plan, package_binding, gate_binding):
    require(gate_binding["path"] == plan["outputRoot"] + "/gpu-gate.json", "same-Run GPU gate path differs")
    gate = auth.read_json(reader, gate_binding)
    ids = reader.json(plan["trainSplit"])["sampleIds"]
    expected = {kind + suffix: limit for kind, limit in
        (("forward", 48), ("generator", 192), ("discriminator", 48))
        for suffix in ("Attempted", "Completed")}
    require(gate.get("schema") == GPU_SCHEMA and gate.get("status") == "passed"
            and gate.get("capabilityVersion") == CAPABILITY
            and gate.get("executionProfile") == EXECUTION_PROFILE
            and gate.get("runId") == plan["runId"] and gate.get("packageId") == plan["packageId"]
            and auth.same_json(gate.get("executionPackage"), package_binding)
            and auth.same_json(gate.get("programBindings"), plan["programBindings"])
            and auth.same_json(gate.get("actualCounts"), expected)
            and [row["sampleId"] for row in gate.get("cases", [])] == ids
            and all(row.get("passed") is True for row in gate["cases"])
            and type(gate.get("optimizerSteps")) is int and gate["optimizerSteps"] == 0
            and gate.get("checkpointLoaded") is False and gate.get("checkpointWritten") is False
            and auth.same_json(gate.get("initialState"), gate.get("finalState")),
            "own complete48 same-package GPU evidence required")
    model = auth.read_json(reader, plan["modelBinding"])
    require(auth.same_json(gate.get("initialCpuState"), model["initialState"]),
            "GPU gate fresh model identity differs")
    return gate


def verify_owned_gpu(reader, plan, package_binding, admission_binding):
    require(admission_binding["path"] == plan["outputRoot"] + "/gpu-acceptance.json",
            "same-Run owned GPU acceptance path differs")
    admission = auth.read_json(reader, admission_binding)
    require(admission.get("schema") == "ecology-regime-owned-gpu-acceptance-v1"
            and admission.get("status") == "passed"
            and auth.same_json(admission.get("executionPackage"), package_binding)
            and auth.same_json(admission.get("programBindings"), plan["programBindings"]),
            "own current-package GPU release required")
    gate = verify_gpu_gate(reader, plan, package_binding, admission["report"])
    verify_owned_release(reader, admission["ownedReceipt"], phase="qualification", output_root=plan["outputRoot"],
        args=["-B", str(reader.root / GPU_PATH), "--package", package_binding["path"],
              "--sha256", package_binding["sha256"]], programs=plan["programBindings"])
    reader.unchanged()
    return gate


class ResourceGuard:
    def __init__(self, package_binding, plan, configuration, *, root=ROOT,
                 started=None, gpu_gate=False):
        checkpoint.validate_configuration(configuration)
        self.package, self.plan, self.root = package_binding, plan, Path(root)
        self.ceiling = dict(configuration["executionCeiling"])
        self.started = time.monotonic() if started is None else started
        self.seconds = 600 if gpu_gate else self.ceiling["maxWallSeconds"]
        self.last_check = None

    def __call__(self):
        import painter_stage4_detail_weight_capture_execution_worker as io
        torch, _profile, shared, source = runtime()
        require(time.monotonic() - self.started < self.seconds and torch.get_num_threads() <= 2,
                "ecology execution time/CPU ceiling exceeded")
        directory = source.Reader(self.root).path(self.plan["outputRoot"])
        require(shutil.disk_usage(directory).free >= self.ceiling["minimumFreeDiskMiB"] * 1024**2,
                "disk safety floor")
        require(io.directory_bytes(directory) <= self.ceiling["maxOutputMiB"] * 1024**2,
                "total execution evidence ceiling")
        require(torch.cuda.is_initialized(), "resource guard cannot initialize CUDA")
        torch.cuda.synchronize()
        free, total = torch.cuda.mem_get_info()
        require(free >= self.ceiling["minimumFreeVramMiB"] * 1024**2, "VRAM safety floor")
        shared.v24.core.gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved()),
            allocated=int(torch.cuda.max_memory_allocated()), device_used=int(total - free), fraction=.7)
        if self.last_check is None or time.monotonic() - self.last_check >= 10:
            result = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(result.returncode == 0 and int(result.stdout.strip().splitlines()[0]) <= 85,
                    "GPU thermal ceiling/unavailable")
            authenticate_live(self.package, root=self.root)
            self.last_check = time.monotonic()


def progress_publisher(reader, plan, resource):
    import painter_stage4_detail_weight_capture_execution_worker as io
    last = [None]
    def publish(epoch, counts, selected, *, completed_epochs=0, state="executing", force=False):
        if not force and last[0] is not None and time.monotonic() - last[0] < 5:
            return
        value = {"schemaVersion": PROGRESS_SCHEMA, "status": "bounded_training_progress_not_formal_qualified",
            "capabilityVersion": CAPABILITY, "runId": plan["runId"], "packageId": plan["packageId"],
            "actualEpoch": epoch, "completedEpochs": completed_epochs, "executionState": state,
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "selectedCheckpoint": None if selected is None else selected["checkpoint"],
            "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
        path = reader.path(plan["outputRoot"] + "/progress.json")
        pending = path.with_name(path.name + ".staged-" + os.urandom(8).hex())
        raw = (json.dumps(value, sort_keys=True, allow_nan=False) + "\n").encode()
        require(io.directory_bytes(path.parent) + len(raw) <= resource.ceiling["maxOutputMiB"] * 1024**2 - 65536,
                "progress terminal reserve exhausted")
        with pending.open("xb") as stream:
            require(stream.write(raw) == len(raw), "short progress write")
            stream.flush()
            os.fsync(stream.fileno())
        io.replace_progress_file(pending, path, deadline=resource.started + resource.seconds)
        last[0] = time.monotonic()
    return publish


def failed_terminal(error, package_binding, plan):
    """Unknown pre-update counts stay unknown; never erase partial D success."""
    counts = getattr(error, "actual_optimizer_counts", None)
    secondary = {key: str(getattr(error, key))[:2048] for key in
        ("secondary_restore_error", "secondary_diagnostic_error", "secondary_evidence_error")
        if hasattr(error, key)}
    return {"schema": TERMINAL_SCHEMA, "status": "failed_closed", "executionState": "failed_closed",
        "capabilityVersion": CAPABILITY, "executionProfile": EXECUTION_PROFILE,
        "runId": plan["runId"], "packageId": plan["packageId"], "executionPackage": package_binding,
        "originalError": {"type": type(error).__name__, "message": str(error)[:4096]},
        "optimizerSteps": counts,
        "optimizerStepsGenerator": None if counts is None else counts["generator"],
        "optimizerStepsDiscriminator": None if counts is None else counts["discriminator"],
        "completedEpochs": getattr(error, "completed_epochs", None),
        "checkpoints": getattr(error, "partial_checkpoint_records", []),
        "secondaryErrors": secondary, "automaticRetries": 0,
        "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False}


def run(package_binding, gpu_binding, *, root=ROOT):
    import painter_stage4_ecology_regime_lifecycle as lifecycle
    torch, profile, shared, source = runtime()
    torch.set_num_threads(2)
    started = time.monotonic()
    reader, spec, plan, configuration = authenticate_live(package_binding, root=root)
    terminal_path = plan["outputRoot"] + "/worker-terminal.json"
    # Claim before the bounded execution; a consumed Run cannot be retried.
    write(root, plan["outputRoot"] + "/training-consumed.json",
        {"executionPackage": package_binding, "gpuAcceptance": gpu_binding, "automaticRetries": 0})
    result = None
    try:
        gate = verify_owned_gpu(reader, plan, package_binding, gpu_binding)
        loaded, order = load_samples(reader, plan)
        model, critic = profile.fresh_networks(order)
        actual = {"generator": shared.v24.core.cpu.state_hash(model),
                  "discriminator": shared.v24.core.cpu.state_hash(critic)}
        require(auth.same_json(actual, gate["initialCpuState"]), "qualified fresh CPU initialization differs")
        require(time.monotonic() - started < configuration["executionCeiling"]["maxWallSeconds"],
                "execution setup exhausted deadline")
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        torch.cuda.set_per_process_memory_fraction(.7)
        model.to("cuda:0")
        critic.to("cuda:0")
        resource = ResourceGuard(package_binding, plan, configuration, root=root, started=started)
        resource()
        progress = progress_publisher(reader, plan, resource)
        progress(0, {"generator": 0, "discriminator": 0}, None, force=True)
        def sink(epoch, value):
            if epoch is None:
                return reader.read(value)
            resource()
            return write(root, plan["outputRoot"] + f"/checkpoint-{epoch:02d}.pt", value)
        result = lifecycle.training_loop(model=model, critic=critic, train=loaded["train"],
            validation=loaded["validation"], order=order, configuration=configuration,
            package_binding=package_binding, plan=plan, resource=resource,
            checkpoint_sink=sink, progress_sink=progress)
        require(result.get("schema") == lifecycle.TERMINAL_SCHEMA
                and result.get("status") == "training_completed_review_pending"
                and result.get("completedEpochs") == 48
                and auth.same_json(result.get("optimizerSteps"), {"generator": 2304, "discriminator": 2304}),
                "own numerical lifecycle terminal differs")
        authenticate_live(package_binding, root=root)
        reader.unchanged()
        progress(48, result["optimizerSteps"], result["selectedCheckpointRecord"],
            completed_epochs=48, state="completed", force=True)
        terminal = {**{k: v for k, v in result.items() if k != "productionExecutionAuthenticated"},
            "schema": TERMINAL_SCHEMA, "executionProfile": EXECUTION_PROFILE,
            "lifecycleComponentSchema": result["schema"],
            "executionAuthentication": {"executionPackage": package_binding,
                "finalCpuAcceptance": plan["lifecycleCpuAcceptance"], "ownedGpuAcceptance": gpu_binding},
            "automaticRetries": 0}
        return write(root, terminal_path, terminal, terminal=True)
    except BaseException as error:
        if result is not None:
            # A late publication/authentication error cannot turn 2304 actual
            # updates into zero/unknown just because the loop already returned.
            error.actual_optimizer_counts = dict(result["optimizerSteps"])
            error.completed_epochs = result["completedEpochs"]
            error.partial_checkpoint_records = result["checkpoints"]
        try:
            if not reader.path(terminal_path).exists():
                error.failure_terminal_binding = write(root, terminal_path,
                    failed_terminal(error, package_binding, plan), terminal=True)
        except BaseException as other:
            error.secondary_evidence_error = str(other)[:2048]
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--gpu")
    parser.add_argument("--gpu-sha256")
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    package = {"path": args.package, "sha256": args.sha256}
    if args.preflight:
        runtime()[0].set_num_threads(2)
        load_package(package)
        print(json.dumps({"status": "own_ecology_entry_preflight_passed_not_gpu_qualified",
            "capabilityVersion": CAPABILITY, "gpuInitialized": runtime()[0].cuda.is_initialized()}))
    else:
        require(args.gpu is not None and args.gpu_sha256 is not None, "explicit owned GPU acceptance required")
        print(json.dumps(run(package, {"path": args.gpu, "sha256": args.gpu_sha256})))

"""Internal six-phase detail-weight worker; no default dispatch or old gate.

Execution authenticates the new immutable autonomous package, current registry,
live supervisor/heartbeat and full program bytes before any CUDA or optimization.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
from pathlib import Path
import random
import re
import shutil
import stat
import sys
import time
ROOT = Path(__file__).absolute().parents[3]
for p in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(p) not in sys.path: sys.path.insert(0, str(p))
from ai_painter.complete_world import detail_weight_managed_checkpoint as checkpoint
from ai_painter.complete_world import appearance_regime_gradient_failure_capture as capture
from painter_stage4_detail_weight_failure_capture_managed_worker import attach, secondary
CAPABILITY = checkpoint.CAPABILITY
EXECUTION_PROFILE = "detail_weight_failure_capture_execution_v1"
PLAN_SCHEMA = "detail-weight-capture-managed-plan-v1"
TERMINAL_SCHEMA = "detail-weight-managed-worker-terminal-v1"
GPU_SCHEMA = "detail-weight-all-train-gpu-gate-v1"
PROGRESS_SCHEMA = "ai-painter-current-training-progress-v1"
PATH = "ml/ai-painter/scripts/painter_stage4_detail_weight_capture_execution_worker.py"
MODEL_REPORT = {"path": ".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/training/final-source-model/real-cpu/report.json", "sha256": "52ba6294747a87e192c3b1787facc288d6d2c83499526596fd485b2b81f26e2b"}
MODEL_RECEIPT = {"path": ".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/training/final-source-model/real-cpu/owned-process.json", "sha256": "f570c0134bb7f3c8ab486d0ac6c1587fd6afdc12d8e12facac1bf263efb677d3"}
RESOURCE_POLICY = {"path": "data/ai-painter/system-governance/stage4-mvp256-dry-detail-weight-capture-resource-policy-v3.json",
                   "sha256": "edc444bd4b0fe1b9257103342a5cbe4b30794b907081cd80c8bf77b2cdffe63c"}


def require(value, message):
    if not value: raise ValueError(message)


def replace_progress_file(pending, target, *, deadline):
    """Publish one staged snapshot; never retry training or extend its deadline.

    Windows readers can temporarily deny replacement. Retry only that same
    operation (five attempts, at most 150 ms of sleep and a 250 ms time window).
    Persistent/unrelated failure retains the original error and staged bytes.
    """
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


def runtime():
    import torch
    import painter_stage4_appearance_regime_detail_weight_training_profile as profile
    import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
    import check_stage4_mvp256_dry_appearance_regime_cpu as source
    return torch, profile, shared, source


def binding(value):
    require(type(value) is dict and set(value) == {"path", "sha256"}, "exact immutable binding required")
    require(type(value["path"]) is str and value["path"] and "\\" not in value["path"] and ":" not in value["path"]
            and all(v not in ("", ".", "..") for v in value["path"].split("/")), "source path invalid")
    require(type(value["sha256"]) is str and len(value["sha256"]) == 64 and all(v in "0123456789abcdef" for v in value["sha256"]), "source SHA invalid")
    return dict(value)


def effective_execution_ceiling(reader, plan, configuration):
    """Resource-only successor; frozen numerical/checkpoint config is unchanged."""
    baseline = dict(configuration["executionCeiling"])
    if "resourcePolicy" not in plan:
        return baseline
    require(plan["resourcePolicy"] == RESOURCE_POLICY, "unknown execution resource version")
    policy = reader.json(binding(plan["resourcePolicy"]))
    expected = {"schemaVersion": "detail-weight-capture-resource-policy-v3",
        "resourceVersion": "detail_weight_capture_70_minute_v3", "capabilityVersion": CAPABILITY,
        "sourceCandidate": plan["sourceCandidate"], "formalSpecification": plan["formalSpecification"],
        "baselineConfiguration": configuration,
        "override": {"maxWallSeconds": 4200}, "baselineMaxWallSeconds": 2700,
        "clockScope": "one_training_native_call_including_setup_checkpoint_reload_and_terminal_persistence",
        "gpuQualificationMaxWallSeconds": 600, "cpuAndReviewMaxWallSeconds": 120,
        "freshRunAndPackageRequired": True, "historicalExecutionMutationAllowed": False,
        "automaticRetries": 0, "modelDataStepsSelectionAndReviewUnchanged": True}
    require(policy == expected and configuration == policy["baselineConfiguration"]
            and baseline["maxWallSeconds"] == policy["baselineMaxWallSeconds"],
            "execution resource policy/baseline configuration differs")
    return {**baseline, **policy["override"]}


def load_package(package_binding, *, root=ROOT, require_lifecycle=True, review_recovery=None):
    _torch, _profile, shared, source = runtime()
    recovery_live = None
    if review_recovery is not None:
        require(require_lifecycle and not _torch.cuda.is_initialized(), "recovery is only a CPU review")
        from detail_weight_review_recovery import recovery_readers
        reader, recovery_live, recovery_plan = recovery_readers(package_binding, review_recovery, root=root)
    else:
        reader = source.Reader(Path(root))
    spec = reader.json(binding(package_binding))
    require(spec.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1"
            and spec.get("capabilityVersion") == CAPABILITY and spec.get("maxInfrastructureRecoveryAttempts") == 0,
            "same immutable detail-weight autonomous package required")
    plans = [b for b in spec["inputEvidence"] if b["path"].endswith("/detail-weight-capture-plan.json")]
    require(len(plans) == 1, "one package-bound managed plan required")
    plan = reader.json(plans[0])
    require(plan.get("schema") == PLAN_SCHEMA and plan.get("executionProfile") == EXECUTION_PROFILE
            and plan.get("capabilityVersion") == CAPABILITY
            and plan.get("packageId") == spec["packageIdentity"] and plan.get("outputRoot") == spec["outputRoot"]
            and plan.get("historicalCheckpointMayInitialize") is False and plan.get("trainingRestartAllowed") is False,
            "managed plan identity/initialization boundary differs")
    if require_lifecycle:
        require(plan.get("executionMode") == "managed-training", "CPU bootstrap cannot authorize production")
    else:
        require(plan.get("executionMode") == "synthetic-cpu-bootstrap"
                and any(prefix in str(Path(root).absolute()).replace("\\", "/") for prefix in (
                    "/detail-weight-capture-bounded-repair-t-q4-51/training/",
                    "/native-startup-recovery-t-q4-55/cpu/training/",
                    "/post-reboot-current-source-t-q4-58/cpu/training/",
                    "/corrected-source-verification-t-q4-59/cpu/training/",
                    "/output-accounting-race-repair-t-q4-60/cpu/training/",
                    "/progress-publication-current-source-t-q4-61/cpu/training/",
                    "/progress-publication-binding-guard-t-q4-62/cpu/training/",
                    "/seventy-minute-resource-successor-t-q4-64/cpu/training/",
                    "/seventy-minute-config-binding-repair-t-q4-65/cpu/training/"))
                and not _torch.cuda.is_initialized(), "lifecycle bootstrap restricted to isolated CPU fixture")
    configuration = checkpoint.derive_configuration(reader, plan["sourceCandidate"], plan["formalSpecification"])
    require(plan.get("configuration") == configuration, "actual managed plan/configuration differs")
    effective_ceiling = effective_execution_ceiling(reader, plan, configuration)
    resource_inputs = [item for item in spec["inputEvidence"] if item["path"] == RESOURCE_POLICY["path"]]
    require(resource_inputs == ([RESOURCE_POLICY] if "resourcePolicy" in plan else []),
            "execution package resource version differs")
    candidate = reader.json(plan["sourceCandidate"])
    require(plan["datasetManifest"] == candidate["frozenBindings"]["datasetManifest"]
            and plan["trainSplit"] == candidate["frozenBindings"]["trainSplit"]
            and plan["validationSplit"] == candidate["frozenBindings"]["validationSplit"], "original dataset binding differs")
    for role, item in plan["programBindings"].items():
        reader.read(binding(item)); require(spec["programLineage"].get(role) == item["sha256"], "autonomous program lineage differs")
    require(plan["programBindings"]["worker"]["path"] == PATH, "actual worker path differs")
    require(plan["modelCpuReport"] == MODEL_REPORT and plan["modelCpuReceipt"] == MODEL_RECEIPT,
            "exact immutable original numerical evidence required")
    cpu = reader.json(plan["modelCpuReport"])
    require(cpu.get("status") == "own_four_season_cpu_passed_not_gpu_qualified" and cpu.get("capabilityVersion") == CAPABILITY
            and cpu.get("actualCounts") == {"forwardAttempted": 4, "forwardCompleted": 4, "generatorAttempted": 16,
                "generatorCompleted": 16, "discriminatorAttempted": 4, "discriminatorCompleted": 4}
            and cpu.get("optimizerSteps") == 0 and cpu.get("initialState") == cpu.get("finalState"), "own real four-season CPU proof required")
    verify_model_reuse(reader, plan, cpu)
    cpu_sources={item["path"]:item["sha256"] for item in cpu["inputBindings"]}
    task_path=".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/controller/workorder.json"
    require(task_path in cpu_sources, "real CPU compatibility input must bind the actual T47 workorder")
    actual_task=reader.json({"path":task_path,"sha256":cpu_sources[task_path]})
    require(actual_task.get("schema")=="detail-weight-lifecycle-completion-workorder-v1" and actual_task.get("training",{}).get("id")=="T-Q4-47", "real CPU task lineage differs")

    receipt = reader.json(plan["modelCpuReceipt"])
    require(receipt.get("cleanupConfirmed") is True and receipt.get("activeProcessesAfterCleanup") == 0 and receipt.get("exitCode") == 0, "CPU owned cleanup proof missing")
    if require_lifecycle:
        life = reader.json(plan["lifecycleCpuAcceptance"])
        require(life.get("schema") == "detail-weight-capture-lifecycle-cpu-acceptance-v1" and life.get("status") == "passed"
                and life.get("programBindings") == plan["programBindings"], "own final-source lifecycle CPU acceptance required")
        raw = reader.json(life["testResult"]); owned = reader.json(life["ownedReceipt"])
        require(raw.get("failed") == raw.get("errors") == raw.get("skipped") == 0 and raw.get("passed", 0) > 0
                and len(raw["items"]) == raw["passed"] and all(item["status"] == "passed" for item in raw["items"])
                and owned.get("cleanupConfirmed") is True and owned.get("proof", {}).get("assignedBeforeResume") is True
                and owned["proof"].get("activeProcessesAfterCleanup") == 0 and owned["proof"].get("exitCode") == 0
                and raw.get("synthetic") is True and raw.get("gpuInitialized") is False
                and raw.get("configuration") == configuration
                and raw.get("resourcePolicy") == plan.get("resourcePolicy")
                and ("resourcePolicy" not in plan or raw.get("effectiveExecutionCeiling") == effective_ceiling)
                and raw.get("programBindings") == plan["programBindings"]
                and all(type(raw["actualOptimizerSteps"][k]) is int and raw["actualOptimizerSteps"][k] == 0 for k in ("generator", "discriminator"))
                and all(type(raw["actualCalls"][k]) is int and raw["actualCalls"][k] == 0 for k in ("generatorForwardAttempted","generatorForwards","generatorGradientAttempted","generatorGradientCompleted","discriminatorGradientAttempted","discriminatorGradientCompleted")),
                "raw lifecycle tests or live-owned CPU receipt differ")
        isolated = reader.json(life["isolatedRegistryProof"])
        require(isolated.get("status") == "isolated_registry_roundtrip_verified" and isolated.get("registryRevisionBefore") + 1 == isolated.get("registryRevisionAfter")
                and isolated.get("programBindings") == plan["programBindings"] and isolated.get("productionRegistryChanged") is False,
                "actual isolated registry/readback proof required")
    closure = [b["path"] for b in plan["programBindings"].values() if b["path"].endswith(".py")]
    if recovery_live is None:
        source.verify_loaded_sources(reader, closure)
    else:
        current_closure = [b["path"] for b in recovery_plan["programBindings"].values() if b["path"].endswith(".py")]
        source.verify_loaded_sources(recovery_live, current_closure)
        recovery_live.unchanged()
    reader.unchanged()
    return reader, spec, plan, configuration


def verify_model_reuse(reader, plan, cpu):
    """Same numerical implementation, distinct lifecycle; no pixel decoding.

Original context bytes are explicitly snapshotted when the current path moved.
Pixel identity remains an actual data-reader/GPU-admission obligation; this
routine cannot qualify the new lifecycle or inherit a prior GPU receipt.
"""
    import math
    expected = [b for b in cpu["inputBindings"] if b["path"].endswith(".py")
                and b["path"].startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/"))]
    require(len(expected) == 97 and plan.get("numericalSourceBindings") == expected,
            "actual complete original numerical source closure differs")
    for item in expected:
        require(reader.path(item["path"]).stat().st_size <= 2097152, "numerical source byte ceiling")
        reader.read(binding(item))
    graph = cpu["graph"]
    require(plan.get("numericalIdentity") == {"graph": graph,
                "initialState": cpu["initialState"], "datasetManifest": cpu["datasetManifest"]},
            "original graph/init/data identity differs")
    require(len(graph["parameters"]) == 107 and graph["elements"] == 2240671
            and sum(math.prod(p["shape"]) for p in graph["parameters"]) == 2240671
            and graph["seasonalParameterIndex"] == 78
            and sum(len(v) for v in graph["headIndices"].values()) == 16
            and graph["architecture"] == runtime()[1].ARCHITECTURE
            and graph["numericRule"] == runtime()[1].NUMERIC_RULE
            and cpu["datasetManifest"] == plan["datasetManifest"], "frozen graph/profile identity differs")
    original_context = [b for b in cpu["inputBindings"] if b["path"] == "AGENTS.md" or b["path"].startswith("docs/")]
    snapshots = plan.get("modelContextSnapshots", [])
    require(type(snapshots) is list and len(snapshots) <= 16, "bounded original context snapshots required")
    by_original = {}
    for record in snapshots:
        original, saved = binding(record["originalBinding"]), binding(record["snapshotBinding"])
        require(original in original_context and original["path"] not in by_original,
                "original context snapshot identity differs")
        require(reader.path(saved["path"]).stat().st_size <= 2097152, "context snapshot byte ceiling")
        data = reader.read(saved)
        if record.get("field") is not None:
            require(record["field"] == "sourceText", "unsupported historical snapshot field")
            container = json.loads(data)
            require(type(container.get("sourceText")) is str and container.get("path") == original["path"]
                    and container.get("sha256") == original["sha256"], "historical context container differs")
            data = container["sourceText"].encode("utf-8")
            require(len(data) == container.get("byteLength"), "historical context byte length differs")
        require(hashlib.sha256(data).hexdigest() == original["sha256"], "historical context exact bytes differ")
        by_original[original["path"]] = saved
    for item in original_context:
        if item["path"] in by_original:
            reader.read(by_original[item["path"]])
        else:
            # A changed guide cannot be substituted for its historical bytes.
            require(reader.path(item["path"]).stat().st_size <= 2097152, "context input ceiling")
            reader.read(item)
    for item in (plan["datasetManifest"], plan["trainSplit"], plan["validationSplit"]):
        reader.read(item)
    return {"numericalSourcesRehashed": 97, "originalContextRehashed": len(original_context),
            "newLifecycleQualified": False, "priorGpuInherited": False, "sourcePixelsRead": False}


def authenticate_live(package_binding, *, root=ROOT):
    reader, spec, plan, configuration = load_package(package_binding, root=root)
    return verify_live_context(reader, spec, plan, configuration)


def verify_live_context(reader, spec, plan, configuration):
    """Pure live identity checks; this helper grants no GPU/data admission."""
    _torch, _profile, shared, _source = runtime()
    current = json.loads(reader.path(".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
    active = current.get("activeExecution")
    require(type(current.get("registryRevision")) is int and isinstance(active, dict)
            and current.get("capabilityVersion") == active.get("capabilityVersion") == CAPABILITY
            and current.get("packageId") == active.get("packageId") == spec["packageIdentity"]
            and current.get("runId") == active.get("runId") == plan["runId"]
            and active.get("programLineage") == plan["programBindings"] and active.get("executionState") == "executing", "current active registry identity differs")
    require(shared.managed_worker.process_identity(active["processId"]) == active["processStartIdentity"], "supervisor PID reused or exited")
    lock = reader.json(active["lock"])
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
            and all(lock.get(k) == active.get(k) for k in ("capabilityVersion", "runId", "packageId", "processId", "processStartIdentity")), "current immutable lock differs")
    heart = json.loads(reader.path(active["heartbeat"]["path"]).read_bytes())
    stamp = datetime.fromisoformat(heart["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp()
    require(heart.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1"
            and heart.get("ttlSeconds") == active["heartbeat"]["ttlSeconds"] == 120 and -300 <= time.time() - stamp < 120
            and all(heart.get(k) == active.get(k) for k in ("capabilityVersion", "runId", "packageId", "processId", "processStartIdentity")), "live heartbeat stale or rebound")
    return reader, spec, plan, configuration


class AtomicOutputReplacement(Exception):
    """A known atomic writer renamed a staged file during a directory scan."""


def directory_bytes(directory):
    directory = Path(directory)
    root_info = directory.lstat()
    require(stat.S_ISDIR(root_info.st_mode) and not stat.S_ISLNK(root_info.st_mode)
            and not getattr(root_info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400),
            "output root must be a regular directory")
    def walk(folder):
        total = 0
        for child in folder.iterdir():
            try:
                info = child.lstat()
            except FileNotFoundError:
                target = re.fullmatch(r"(progress\.json)\.staged-[a-f0-9]{16}", child.name) or re.fullmatch(
                    r"(heartbeat\.json)\.staged-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", child.name)
                if target is None:
                    raise
                replacement = child.with_name(target[1]).lstat()
                require(stat.S_ISREG(replacement.st_mode) and not getattr(replacement, "st_file_attributes", 0)
                        & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400), "atomic output replacement must be regular")
                raise AtomicOutputReplacement("atomic output changed during accounting")
            require(not stat.S_ISLNK(info.st_mode) and not getattr(info, "st_file_attributes", 0)
                    & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400), "output junction prohibited")
            if stat.S_ISDIR(info.st_mode):
                total += walk(child)
            elif stat.S_ISREG(info.st_mode):
                total += info.st_size
        return total
    for _attempt in range(3):
        try:
            return walk(directory)
        except AtomicOutputReplacement:
            pass
    raise ValueError("atomic output accounting did not settle within three scans")


def write(root, logical, value):
    _torch, _profile, _shared, source = runtime(); path = source.Reader(Path(root)).path(logical)
    data = value if isinstance(value, bytes) else (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
    require(isinstance(value,bytes) or len(data)<=2097152,"single JSON byte ceiling")
    roots=json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS","[]")); maximum=int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX","0"))
    if roots:
        used=sum(directory_bytes(source.Reader(Path(os.environ.get("DETAIL_WEIGHT_BUDGET_PROJECT_ROOT",str(root)))).path(logical_root)) for logical_root in roots)
        require(used+len(data)<=maximum-65536,"output failure reserve ceiling")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
    return {"path": logical, "sha256": hashlib.sha256(data).hexdigest()}


def load_samples(reader, plan, *, validation=True, splits=None):
    _torch, profile, shared, _source = runtime(); cpu = shared.v24.core.cpu
    manifest, order, continuous, _rows, _memberships = cpu.select_rows(reader)
    require(reader.json(plan["datasetManifest"]) == manifest, "actual selected dataset differs")
    source = reader.json(manifest["sourceIndex"]); by_id = {row["sampleId"]: row for row in source["samples"]}
    loaded = {}
    for split in (splits if splits is not None else (("train", "validation") if validation else ("train",))):
        require(split in ("train", "validation"), "challenge/regression content prohibited")
        ids = reader.json(plan[split + "Split"])["sampleIds"]
        require(len(ids) == len(set(ids)) == (48 if split == "train" else 8), "split counts differ")
        loaded[split] = []
        for sid in ids:
            row = by_id[sid]; require(row["split"] == split, "cross-split source prohibited")
            sample, _identity = cpu.load_sample(reader, row, order, continuous)
            pack = reader.json(row["conditionPack"]); _, task = reader.snapshot(pack["sourceBindings"]["taskPackagePath"])
            identity = {"sampleId": sid, "split": split, "conditionPack": row["conditionPack"], "taskPackage": task}
            record, _code, _facts = profile.predecessor.derive_regime_record(reader, identity)
            loaded[split].append(profile.bind_sample_season(reader, sample, identity, record))
    reader.unchanged(); return loaded, order


def validation_epoch(model, samples, order, *, epoch):
    torch, profile, shared, _source = runtime(); rows = []; before = shared.v24.core.cpu.state_hash(model)
    with shared._preserve_rng_and_mode(model), torch.no_grad():
        model.eval()
        for sample in samples:
            require(sample["split"] == "validation", "checkpoint selection requires validation")
            device = next(model.parameters()).device
            bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
            predicted = profile.sample_forward(model, bound)
            _, values = shared.original_object_class_spatial_loss(predicted, bound, order, split="validation")
            rows.append({"sampleId": sample["sampleId"], "split": "validation", "epoch": epoch,
                "fullRgbMae": float((predicted[0] - bound["image"]).abs().mean()),
                "objectCorrelations": {role: None if values.get(role) is None else float(values[role]) for role in shared.OBJECT_CHANNELS}})
    require(before == shared.v24.core.cpu.state_hash(model), "validation mutated model")
    return shared.rank_validation_epoch(rows, [s["sampleId"] for s in samples], epoch=epoch), rows


def verify_gpu_gate(reader, plan, package_binding):
    gate = reader.json({"path": plan["outputRoot"] + "/gpu-gate.json", "sha256": plan["gpuGateSha256"]})
    ids = reader.json(plan["trainSplit"])["sampleIds"]
    require(gate.get("schema") == GPU_SCHEMA and gate.get("executionProfile") == EXECUTION_PROFILE
            and gate.get("executionPackage") == package_binding
            and gate.get("programBindings") == plan["programBindings"] and gate.get("status") == "passed"
            and gate.get("actualCounts") == {"forwardAttempted": 48, "forwardCompleted": 48, "generatorAttempted": 192,
                "generatorCompleted": 192, "discriminatorAttempted": 48, "discriminatorCompleted": 48}
            and [row["sampleId"] for row in gate["cases"]] == ids and all(row["passed"] is True for row in gate["cases"])
            and gate.get("optimizerSteps") == 0 and gate.get("initialState") == gate.get("finalState"), "same-package complete48 GPU gate required")
    return gate


class ResourceGuard:
    def __init__(self, package_binding, plan, configuration, *, root=ROOT):
        self.package, self.plan, self.config, self.root = package_binding, plan, configuration, Path(root)
        self.ceiling = effective_execution_ceiling(runtime()[3].Reader(self.root), plan, configuration)
        self.started, self.last_check = time.monotonic(), 0
    def __call__(self):
        torch, _profile, shared, source = runtime(); ceiling = self.ceiling
        require(time.monotonic() - self.started < ceiling["maxWallSeconds"] and torch.get_num_threads() <= 2, "training time/CPU ceiling exceeded")
        directory = source.Reader(self.root).path(self.plan["outputRoot"])
        require(shutil.disk_usage(directory).free >= ceiling["minimumFreeDiskMiB"] * 1024**2, "disk safety floor")
        require(directory_bytes(directory) <= ceiling["maxOutputMiB"] * 1024**2, "total training evidence ceiling")
        torch.cuda.synchronize(); free, total = torch.cuda.mem_get_info()
        require(free >= ceiling["minimumFreeVramMiB"] * 1024**2, "VRAM safety floor")
        shared.v24.core.gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved()), allocated=int(torch.cuda.max_memory_allocated()), device_used=int(total-free), fraction=.7)
        if time.monotonic() - self.last_check >= 10:
            import subprocess
            result = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(result.returncode == 0 and int(result.stdout.strip().splitlines()[0]) <= 85, "GPU thermal ceiling/unavailable")
            authenticate_live(self.package, root=self.root); self.last_check = time.monotonic()


def device_guard(model, critic):
    torch = runtime()[0]
    require(torch.get_num_threads() <= 2, "capture CPU thread ceiling")
    devices = {str(value.device) for network in (model, critic)
               for value in list(network.parameters()) + list(network.buffers())}
    require(len(devices) == 1 and all(value == "cpu" or value.startswith("cuda:") for value in devices),
            "capture network device differs")
    if any(value.startswith("cuda:") for value in devices):
        require(torch.cuda.is_initialized(), "capture cannot initialize CUDA")


class FailureContext:
    """Same authenticated package/Run and real saved-byte accounting."""
    def __init__(self, reader, spec, plan, execution_binding, *, deadline):
        self.reader, self.spec, self.plan = reader, spec, plan
        self.execution_binding = dict(execution_binding)
        self.run_id, self.deadline = plan["runId"], deadline
        self.root = reader.path(plan["outputRoot"])
        self.package = {"outputRoot": plan["outputRoot"], "sourceBindings": list(plan["programBindings"].values())}
        self.claim_binding = None
        self.verify()

    def verify(self, *, finalizing=False):
        if not finalizing:
            require(time.monotonic() < self.deadline, "failure boundary deadline exceeded")
        require(self.reader.json(self.execution_binding) == self.spec, "same-Run package bytes changed")
        plans = [b for b in self.spec["inputEvidence"] if b["path"].endswith("/detail-weight-capture-plan.json")]
        require(len(plans) == 1 and self.reader.json(plans[0]) == self.plan
                and self.plan["schema"] == PLAN_SCHEMA and self.plan["executionProfile"] == EXECUTION_PROFILE
                and self.plan["packageId"] == self.spec["packageIdentity"]
                and self.plan["outputRoot"] == self.spec["outputRoot"]
                and self.spec["capabilityVersion"] == CAPABILITY
                and self.plan["programBindings"]["worker"]["path"] == PATH,
                "failure boundary independent package/Run identity differs")
        capture._no_redirect(self.root)
        require(self.root == self.reader.path(self.plan["outputRoot"]), "failure output root changed")

    def remaining(self):
        self.verify()
        self.reader.unchanged()
        used = capture._owned_bytes(self.root)["totalBytes"]
        require(used <= 128 * 1024**2, "actual training output exhausted")
        remaining = min(64 * 1024**2, max(0, 128 * 1024**2 - used - 65536))
        if os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS"):
            total = sum(capture._owned_bytes(p)["totalBytes"] for p in self.shared_roots())
            ceiling = int(os.environ["DETAIL_WEIGHT_OUTPUT_MAX"])
            require(0 < ceiling <= 128 * 1024**2 and total <= ceiling, "actual shared fixture output exhausted")
            remaining = min(remaining, max(0, ceiling - total - 65536))
        return remaining

    def write(self, name, value, *, terminal=False):
        self.verify(finalizing=terminal and value.get("status") == "failed_closed")
        require(name in ("failure-boundary-consumed.json", "worker-terminal.json"), "unknown failure artifact")
        if terminal:
            require(self.claim_binding is not None and capture._binding(self.root / "failure-boundary-consumed.json") == self.claim_binding,
                    "actual same-Run boundary claim missing")
        data = (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
        require(len(data) <= (65536 if terminal else 2097152), "failure artifact byte ceiling")
        used = capture._owned_bytes(self.root)["totalBytes"]
        require(used + len(data) <= 128 * 1024**2 - (0 if terminal else 65536), "actual training reserve exhausted")
        if os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS"):
            total = sum(capture._owned_bytes(p)["totalBytes"] for p in self.shared_roots())
            require(total + len(data) <= int(os.environ["DETAIL_WEIGHT_OUTPUT_MAX"]) - (0 if terminal else 65536),
                    "actual shared terminal reserve exhausted")
        self.root.mkdir(parents=True, exist_ok=True)
        with (self.root / name).open("xb") as stream:
            require(stream.write(data) == len(data), "short failure artifact write")
            stream.flush(); os.fsync(stream.fileno())
        return capture._binding(self.root / name)

    def shared_roots(self):
        source = runtime()[3]
        project = Path(os.environ.get("DETAIL_WEIGHT_BUDGET_PROJECT_ROOT", str(ROOT)))
        reader = source.Reader(project)
        values = json.loads(os.environ["DETAIL_WEIGHT_OUTPUT_ROOTS"])
        require(type(values) is list and 0 < len(values) <= 4, "bounded shared roots required")
        return [reader.path(p).resolve() for p in values]

    def claim(self):
        require(self.claim_binding is None, "failure boundary consumed; no retry")
        self.claim_binding = self.write("failure-boundary-consumed.json", {
            "executionPackage": self.execution_binding, "executionProfile": EXECUTION_PROFILE,
            "runId": self.run_id, "automaticRetries": 0})


class FailureCapturePair:
    def __init__(self, context, *, pair_runner, progress_sink, capture_runner=capture.capture_gradient_failure):
        self.context, self.pair_runner = context, pair_runner
        self.progress_sink, self.capture_runner = progress_sink, capture_runner
        self.failed = False

    def __call__(self, *, epoch, train_position, model, critic, sample, order, go, do,
                 counts, ledger, resource, selected, completed_epochs):
        require(not self.failed, "failed pair consumed; no retry")
        require(type(epoch) is int and 1 <= epoch <= 48 and type(train_position) is int
                and 1 <= train_position <= 48, "explicit loop location required")
        require(sample.get("split") == "train" and ledger.get("sampleId") == sample.get("sampleId"),
                "actual dispatch sample/ledger differs")
        self.context.verify()
        device_guard(model, critic)
        try:
            return self.pair_runner(model, critic, sample, order, go, do, counts, ledger, resource, None)
        except BaseException as error:
            self.failed = True
            actual = {"epoch": epoch, "trainPosition": train_position, "sampleId": sample["sampleId"],
                      "split": sample["split"], "ledger": dict(ledger), "counts": dict(counts),
                      "origin": "actual_loop_dispatch", "inferredSample": False}
            attach(error, "failure_capture_dispatch", actual)
            attach(error, "actual_optimizer_counts", dict(counts))
            try:
                self.progress_sink(epoch, dict(counts), selected, completed_epochs=completed_epochs,
                                   state="failed_closed", force=True)
            except BaseException as other:
                secondary(error, "failure_progress", other)
            try:
                remaining = self.context.remaining()
                receipt = self.capture_runner(error=error, model=model, critic=critic, sample=sample,
                    counts=dict(counts), epoch=epoch, train_position=train_position,
                    output_root=self.context.root / "failure-capture", execution_binding=self.context.execution_binding,
                    source_bindings=self.context.package["sourceBindings"], remaining_output_bytes=remaining)
                attach(error, "gradient_failure_capture", receipt)
                # Only rehashed, safely reloaded bytes justify a complete receipt.
                if receipt.get("status") in ("failure_evidence_captured", "partial_failure_evidence_captured"):
                    manifest, _tensors = capture.verify_gradient_failure_capture(receipt)
                    require(manifest["location"] == {key: actual[key] for key in
                            ("epoch", "trainPosition", "sampleId", "split", "inferredSample")} | {"origin": "explicit_capture_call"}
                            and manifest["counts"] == actual["counts"], "captured dispatch identity differs")
                self.context.remaining()
            except BaseException as other:
                secondary(error, "failure_capture", other)
                saved = getattr(error, "gradient_failure_capture", None)
                attach(error, "gradient_failure_capture", {"status": "capture_interrupted" if isinstance(other, (KeyboardInterrupt, SystemExit)) else "capture_failed",
                    "captureError": capture._error(other), "unverifiedCaptureReceipt": saved,
                    "executionQualified": False, "automaticRetries": 0})
            raise


def training_loop(*, context, model, critic, train, validation, order, configuration,
                  package_binding, plan, resource, checkpoint_sink, progress_sink,
                  profile=None, pair_runner=None, optimizer_factory=None, capture_runner=capture.capture_gradient_failure,
                  validation_runner=validation_epoch, checkpoint_encoder=checkpoint.encode,
                  checkpoint_reloader=checkpoint.reload, fresh_networks=None):
    """Frozen 48×48 schedule/ranking/codec, with actual dispatch coordinates."""
    torch, frozen_profile, shared, _source = runtime()
    profile = profile or frozen_profile
    context.verify()
    device_guard(model, critic)
    require(package_binding == context.execution_binding and plan["runId"] == context.run_id
            and plan["outputRoot"] == context.package["outputRoot"], "loop same-Run binding differs")
    shared._validate_samples(train, validation)
    context.claim()
    counts = {"generator": 0, "discriminator": 0}
    records, selected, completed_epochs = [], None, 0
    args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
    optimizer_factory = optimizer_factory or torch.optim.AdamW
    go = optimizer_factory(model.parameters(), **args)
    do = optimizer_factory(critic.parameters(), **args)
    pair = FailureCapturePair(context, pair_runner=pair_runner or profile.perform_pair,
                              progress_sink=progress_sink, capture_runner=capture_runner)
    try:
        for epoch in range(1, 49):
            order_indices = list(range(48))
            random.Random(20260929 + epoch).shuffle(order_indices)
            for position, i in enumerate(order_indices, 1):
                resource()
                ledger = {"sampleId": train[i]["sampleId"], "generator": 0, "discriminator": 0}
                pair(epoch=epoch, train_position=position, model=model, critic=critic, sample=train[i],
                     order=order, go=go, do=do, counts=counts, ledger=ledger, resource=resource,
                     selected=selected, completed_epochs=completed_epochs)
                require(ledger == {"sampleId": train[i]["sampleId"], "generator": 1, "discriminator": 1}, "actual pair ledger differs")
                progress_sink(epoch, counts, selected, completed_epochs=completed_epochs)
            require(counts == {"generator": epoch * 48, "discriminator": epoch * 48}, "actual epoch counts differ")
            completed_epochs = epoch
            if epoch in (24, 36, 48):
                selection, observations = validation_runner(model, validation, order, epoch=epoch)
                raw = checkpoint_encoder(model, critic, configuration=configuration, run_id=plan["runId"],
                    package_binding=package_binding, dataset_binding=plan["datasetManifest"], epoch=epoch,
                    selection=selection, counts=counts)
                bound = checkpoint_sink(epoch, raw)
                require(bound["sha256"] == hashlib.sha256(raw).hexdigest(), "checkpoint sink source SHA differs")
                record = {"epoch": epoch, "selection": selection, "validation": observations,
                          "checkpoint": bound, "counts": dict(counts)}
                records.append(record)
                if shared.prefer_checkpoint(selection, None if selected is None else selected["selection"]):
                    selected = record
            progress_sink(epoch, counts, selected, completed_epochs=completed_epochs)
        cpu_model, cpu_critic = (fresh_networks or frozen_profile.fresh_networks)(order)
        raw = checkpoint_sink(None, selected["checkpoint"])
        checkpoint_reloader(raw, model=cpu_model, critic=cpu_critic, configuration=configuration,
            run_id=plan["runId"], package_binding=package_binding, dataset_binding=plan["datasetManifest"],
            epoch=selected["epoch"], selection=selected["selection"], counts=selected["counts"])
        return {"schema": TERMINAL_SCHEMA, "status": "training_completed_review_pending",
            "capabilityVersion": CAPABILITY, "executionPackage": package_binding,
            "runId": plan["runId"], "packageId": plan["packageId"], "completedEpochs": 48,
            "executionState": "completed", "optimizerStepsGenerator": counts["generator"],
            "optimizerStepsDiscriminator": counts["discriminator"], "optimizerSteps": dict(counts),
            "checkpoints": records, "selectedCheckpointRecord": selected, "checkpointReloadVerified": True,
            "challengeContentRead": False, "regressionContentRead": False, "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
            "executionProfile": EXECUTION_PROFILE}
    except BaseException as error:
        attach(error, "actual_optimizer_counts", dict(counts))
        attach(error, "partial_checkpoint_records", records)
        attach(error, "completed_epochs", completed_epochs)
        raise


def run_captured_boundary(*, context, terminal_sink=None, **arguments):
    """Keep exact primary exception across late terminal IO/interruption."""
    try:
        terminal = training_loop(context=context, **arguments)
    except BaseException as error:
        terminal = {"schema": TERMINAL_SCHEMA, "status": "failed_closed", "executionState": "failed_closed",
            "runId": context.run_id, "executionPackage": context.execution_binding,
            "originalError": capture._error(error), "optimizerSteps": getattr(error, "actual_optimizer_counts", None),
            "optimizerStepsGenerator": getattr(error, "actual_optimizer_counts", {}).get("generator"),
            "optimizerStepsDiscriminator": getattr(error, "actual_optimizer_counts", {}).get("discriminator"),
            "completedEpochs": getattr(error, "completed_epochs", None),
            "checkpoints": getattr(error, "partial_checkpoint_records", []),
            "dispatch": getattr(error, "failure_capture_dispatch", None),
            "capture": getattr(error, "gradient_failure_capture", None),
            "secondaryErrors": getattr(error, "failure_capture_secondary_errors", []),
            "capabilityVersion": CAPABILITY, "packageId": context.plan["packageId"], "executionProfile": EXECUTION_PROFILE, "automaticRetries": 0}
        attach(error, "failure_capture_terminal", terminal)
        attach(error, "failure_capture_terminal_publication", {"status": "not_saved", "complete": False})
        try:
            bound = (terminal_sink or (lambda value: context.write("worker-terminal.json", value, terminal=True)))(terminal)
            attach(error, "failure_capture_terminal_publication", {"status": "saved" if terminal_sink is None else "external_sink_returned_unverified",
                "complete": terminal_sink is None, "binding": bound})
        except BaseException as other:
            secondary(error, "failure_terminal", other)
            attach(error, "failure_capture_terminal_publication", {"status": "not_saved", "complete": False,
                "error": capture._error(other)})
        raise
    (terminal_sink or (lambda value: context.write("worker-terminal.json", value, terminal=True)))(terminal)
    return terminal


def run(package_binding, gpu_binding, *, root=ROOT):
    torch, profile, shared, source = runtime(); torch.set_num_threads(2)
    reader, spec, plan, configuration = authenticate_live(package_binding, root=root)
    try:
        return run_authenticated(package_binding, gpu_binding, reader, spec, plan, configuration, root=root)
    except BaseException as error:
        target = reader.path(plan["outputRoot"] + "/worker-terminal.json")
        if not target.exists():
            try: write(root, plan["outputRoot"] + "/worker-terminal.json", {"schema": TERMINAL_SCHEMA, "status": "failed_closed", "executionState": "failed_closed", "capabilityVersion": CAPABILITY, "runId": plan["runId"], "packageId": plan["packageId"], "executionPackage": package_binding, "optimizerStepsGenerator": None, "optimizerStepsDiscriminator": None, "completedEpochs": None, "error": str(error)[:4096]})
            except BaseException as secondary: error.secondary_evidence_error = str(secondary)
        raise


def run_authenticated(package_binding, gpu_binding, reader, spec, plan, configuration, *, root):
    torch, profile, shared, source = runtime()
    gate = reader.json(gpu_binding); mutable = {**plan, "gpuGateSha256": gpu_binding["sha256"]}
    verified = verify_gpu_gate(reader, mutable, package_binding)
    require(gpu_binding["path"] == plan["outputRoot"] + "/gpu-gate.json", "same-package GPU gate path differs")
    write(root, plan["outputRoot"] + "/training-consumed.json", {"executionPackage": package_binding, "gpuGate": gpu_binding, "automaticRetries": 0})
    loaded, order = load_samples(reader, plan)
    model, critic = profile.fresh_networks(order)
    require({"model": source.state(model), "critic": source.state(critic)} == verified["initialCpuState"], "qualified fresh CPU initialization differs")
    require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
    torch.cuda.set_per_process_memory_fraction(.7); device = torch.device("cuda:0"); model.to(device); critic.to(device)
    resource = ResourceGuard(package_binding, plan, configuration, root=root)
    def sink(epoch, value):
        if epoch is None: return reader.read(value)
        resource(); return write(root, plan["outputRoot"] + f"/checkpoint-{epoch:02d}.pt", value)
    last_progress = [0.0]
    def progress(epoch, counts, selected, *, completed_epochs=0, state="executing", force=False):
        if not force and time.monotonic() - last_progress[0] < 5 and counts["generator"] < 2304: return
        value = {"schemaVersion": PROGRESS_SCHEMA, "status": "bounded_training_progress_not_formal_qualified", "capabilityVersion": CAPABILITY,
            "runId": plan["runId"], "packageId": plan["packageId"], "actualEpoch": epoch, "completedEpochs": completed_epochs,
            "executionState": state,
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "selectedCheckpoint": None if selected is None else selected["checkpoint"], "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00","Z")}
        path = reader.path(plan["outputRoot"] + "/progress.json"); pending = path.with_name(path.name + ".staged-" + os.urandom(8).hex())
        with pending.open("xb") as stream: stream.write(json.dumps(value).encode()); stream.flush(); os.fsync(stream.fileno())
        replace_progress_file(pending, path,
            deadline=resource.started + resource.ceiling["maxWallSeconds"])
        last_progress[0] = time.monotonic()
    context = FailureContext(reader, spec, plan, package_binding,
        deadline=resource.started + resource.ceiling["maxWallSeconds"])
    progress(0,{"generator":0,"discriminator":0},None,force=True)
    def terminal_sink(value):
        if value["status"] != "failed_closed":
            reader.unchanged()
            progress(48,value["optimizerSteps"],value["selectedCheckpointRecord"],completed_epochs=48,state="completed",force=True)
        return context.write("worker-terminal.json", value, terminal=True)
    result = run_captured_boundary(context=context, terminal_sink=terminal_sink,
        model=model, critic=critic, train=loaded["train"], validation=loaded["validation"], order=order,
        configuration=configuration, package_binding=package_binding, plan=plan, resource=resource,
        checkpoint_sink=sink, progress_sink=progress)
    return {"path": plan["outputRoot"] + "/worker-terminal.json",
            "sha256": capture._binding(context.root / "worker-terminal.json")["sha256"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--package", required=True); parser.add_argument("--sha256", required=True)
    parser.add_argument("--gpu"); parser.add_argument("--gpu-sha256"); parser.add_argument("--preflight", action="store_true")
    a = parser.parse_args(); pb = {"path": a.package, "sha256": a.sha256}
    if a.preflight:
        runtime()[0].set_num_threads(2)
        _r, _s, _p, _c = load_package(pb); print(json.dumps({"status": "own_managed_preflight_passed", "gpuInitialized": False}))
    else: print(json.dumps(run(pb, {"path": a.gpu, "sha256": a.gpu_sha256})))

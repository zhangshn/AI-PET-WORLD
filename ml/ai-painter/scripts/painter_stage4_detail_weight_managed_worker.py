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
import shutil
import sys
import time
ROOT = Path(__file__).absolute().parents[3]
for p in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(p) not in sys.path: sys.path.insert(0, str(p))
from ai_painter.complete_world import detail_weight_managed_checkpoint as checkpoint
CAPABILITY = checkpoint.CAPABILITY
PLAN_SCHEMA = "detail-weight-managed-plan-v1"
TERMINAL_SCHEMA = "detail-weight-managed-worker-terminal-v1"
GPU_SCHEMA = "detail-weight-all-train-gpu-gate-v1"
PROGRESS_SCHEMA = "ai-painter-current-training-progress-v1"
PATH = "ml/ai-painter/scripts/painter_stage4_detail_weight_managed_worker.py"


def require(value, message):
    if not value: raise ValueError(message)


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


def load_package(package_binding, *, root=ROOT, require_lifecycle=True):
    _torch, _profile, shared, source = runtime()
    reader = source.Reader(Path(root)); spec = reader.json(binding(package_binding))
    require(spec.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1"
            and spec.get("capabilityVersion") == CAPABILITY and spec.get("maxInfrastructureRecoveryAttempts") == 0,
            "same immutable detail-weight autonomous package required")
    plans = [b for b in spec["inputEvidence"] if b["path"].endswith("/detail-weight-plan.json")]
    require(len(plans) == 1, "one package-bound managed plan required")
    plan = reader.json(plans[0])
    require(plan.get("schema") == PLAN_SCHEMA and plan.get("capabilityVersion") == CAPABILITY
            and plan.get("packageId") == spec["packageIdentity"] and plan.get("outputRoot") == spec["outputRoot"]
            and plan.get("historicalCheckpointMayInitialize") is False and plan.get("trainingRestartAllowed") is False,
            "managed plan identity/initialization boundary differs")
    configuration = checkpoint.derive_configuration(reader, plan["sourceCandidate"], plan["formalSpecification"])
    require(plan.get("configuration") == configuration, "actual managed plan/configuration differs")
    candidate = reader.json(plan["sourceCandidate"])
    require(plan["datasetManifest"] == candidate["frozenBindings"]["datasetManifest"]
            and plan["trainSplit"] == candidate["frozenBindings"]["trainSplit"]
            and plan["validationSplit"] == candidate["frozenBindings"]["validationSplit"], "original dataset binding differs")
    for role, item in plan["programBindings"].items():
        reader.read(binding(item)); require(spec["programLineage"].get(role) == item["sha256"], "autonomous program lineage differs")
    require(plan["programBindings"]["worker"]["path"] == PATH, "actual worker path differs")
    require(plan["modelCpuReport"]["path"].startswith(".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/training/")
        and plan["modelCpuReceipt"]["path"].startswith(".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/training/"), "final T47 own-model CPU evidence required; historical CPU cannot qualify")
    cpu = reader.json(plan["modelCpuReport"])
    require(cpu.get("status") == "own_four_season_cpu_passed_not_gpu_qualified" and cpu.get("capabilityVersion") == CAPABILITY
            and cpu.get("actualCounts") == {"forwardAttempted": 4, "forwardCompleted": 4, "generatorAttempted": 16,
                "generatorCompleted": 16, "discriminatorAttempted": 4, "discriminatorCompleted": 4}
            and cpu.get("optimizerSteps") == 0 and cpu.get("initialState") == cpu.get("finalState"), "own real four-season CPU proof required")
    for item in cpu["inputBindings"]: reader.read(item)
    cpu_sources={item["path"]:item["sha256"] for item in cpu["inputBindings"]}
    for role,item in plan["programBindings"].items():
        if not role.startswith("frozen-"):
            require(cpu_sources.get(item["path"])==item["sha256"], "real CPU report must bind every final lifecycle source: "+item["path"])
    task_path=".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/controller/workorder.json"
    require(task_path in cpu_sources, "real CPU compatibility input must bind the actual T47 workorder")
    actual_task=reader.json({"path":task_path,"sha256":cpu_sources[task_path]})
    require(actual_task.get("schema")=="detail-weight-lifecycle-completion-workorder-v1" and actual_task.get("training",{}).get("id")=="T-Q4-47", "real CPU task lineage differs")

    receipt = reader.json(plan["modelCpuReceipt"])
    require(receipt.get("cleanupConfirmed") is True and receipt.get("activeProcessesAfterCleanup") == 0 and receipt.get("exitCode") == 0, "CPU owned cleanup proof missing")
    if require_lifecycle:
        life = reader.json(plan["lifecycleCpuAcceptance"])
        require(life.get("schema") == "detail-weight-lifecycle-cpu-acceptance-v1" and life.get("status") == "passed"
                and life.get("programBindings") == plan["programBindings"], "own final-source lifecycle CPU acceptance required")
        raw = reader.json(life["testResult"]); owned = reader.json(life["ownedReceipt"])
        require(raw.get("failed") == raw.get("errors") == raw.get("skipped") == 0 and raw.get("passed", 0) > 0
                and len(raw["items"]) == raw["passed"] and all(item["status"] == "passed" for item in raw["items"])
                and owned.get("cleanupConfirmed") is True and owned.get("proof", {}).get("assignedBeforeResume") is True
                and owned["proof"].get("activeProcessesAfterCleanup") == 0 and owned["proof"].get("exitCode") == 0
                and raw.get("synthetic") is True and raw.get("gpuInitialized") is False
                and raw.get("configuration") == configuration
                and all(type(raw["actualOptimizerSteps"][k]) is int and 0<=raw["actualOptimizerSteps"][k]<=limit for k,limit in (("generator",2),("discriminator",3)))
                and all(type(raw["actualCalls"][k]) is int and 0<=raw["actualCalls"][k]<=limit for k,limit in (("generatorForwardAttempted",12),("generatorForwards",12),("generatorGradientAttempted",24),("generatorGradientCompleted",24),("discriminatorGradientAttempted",6),("discriminatorGradientCompleted",6))),
                "raw lifecycle tests or live-owned CPU receipt differ")
        isolated = reader.json(life["isolatedRegistryProof"])
        require(isolated.get("status") == "isolated_registry_roundtrip_verified" and isolated.get("registryRevisionBefore") + 1 == isolated.get("registryRevisionAfter")
                and isolated.get("programBindings") == plan["programBindings"] and isolated.get("productionRegistryChanged") is False,
                "actual isolated registry/readback proof required")
    closure = [b["path"] for b in plan["programBindings"].values() if b["path"].endswith(".py")]
    source.verify_loaded_sources(reader, closure); reader.unchanged()
    return reader, spec, plan, configuration


def authenticate_live(package_binding, *, root=ROOT):
    reader, spec, plan, configuration = load_package(package_binding, root=root)
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


def write(root, logical, value):
    _torch, _profile, _shared, source = runtime(); path = source.Reader(Path(root)).path(logical)
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2, allow_nan=False) + "\n").encode()
    require(isinstance(value,bytes) or len(data)<=2097152,"single JSON byte ceiling")
    roots=json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS","[]")); maximum=int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX","0"))
    if roots:
        used=sum(p.stat().st_size for logical_root in roots for p in source.Reader(Path(os.environ.get("DETAIL_WEIGHT_BUDGET_PROJECT_ROOT",str(root)))).path(logical_root).rglob("*") if p.is_file())
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
    require(gate.get("schema") == GPU_SCHEMA and gate.get("executionPackage") == package_binding
            and gate.get("programBindings") == plan["programBindings"] and gate.get("status") == "passed"
            and gate.get("actualCounts") == {"forwardAttempted": 48, "forwardCompleted": 48, "generatorAttempted": 192,
                "generatorCompleted": 192, "discriminatorAttempted": 48, "discriminatorCompleted": 48}
            and [row["sampleId"] for row in gate["cases"]] == ids and all(row["passed"] is True for row in gate["cases"])
            and gate.get("optimizerSteps") == 0 and gate.get("initialState") == gate.get("finalState"), "same-package complete48 GPU gate required")
    return gate


class ResourceGuard:
    def __init__(self, package_binding, plan, configuration, *, root=ROOT):
        self.package, self.plan, self.config, self.root = package_binding, plan, configuration, Path(root)
        self.started, self.last_check = time.monotonic(), 0
    def __call__(self):
        torch, _profile, shared, source = runtime(); ceiling = self.config["executionCeiling"]
        require(time.monotonic() - self.started < ceiling["maxWallSeconds"] and torch.get_num_threads() <= 2, "training time/CPU ceiling exceeded")
        directory = source.Reader(self.root).path(self.plan["outputRoot"])
        require(shutil.disk_usage(directory).free >= ceiling["minimumFreeDiskMiB"] * 1024**2, "disk safety floor")
        require(sum(source.Reader(self.root).path(p.relative_to(self.root).as_posix()).stat().st_size for p in directory.rglob("*") if p.is_file()) <= ceiling["maxOutputMiB"] * 1024**2, "total training evidence ceiling")
        torch.cuda.synchronize(); free, total = torch.cuda.mem_get_info()
        require(free >= ceiling["minimumFreeVramMiB"] * 1024**2, "VRAM safety floor")
        shared.v24.core.gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved()), allocated=int(torch.cuda.max_memory_allocated()), device_used=int(total-free), fraction=.7)
        if time.monotonic() - self.last_check >= 10:
            import subprocess
            result = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(result.returncode == 0 and int(result.stdout.strip().splitlines()[0]) <= 85, "GPU thermal ceiling/unavailable")
            authenticate_live(self.package, root=self.root); self.last_check = time.monotonic()


def training_loop(*, model, critic, train, validation, order, configuration, package_binding, plan,
                  resource, checkpoint_sink, progress_sink, profile=None, validation_runner=validation_epoch,
                  checkpoint_encoder=checkpoint.encode, checkpoint_reloader=checkpoint.reload):
    """Explicit hooks; original numerical profile owns each actual D→G pair."""
    torch, frozen_profile, shared, _source = runtime(); profile = profile or frozen_profile
    shared._validate_samples(train, validation); counts = {"generator": 0, "discriminator": 0}; records = []
    args = dict(lr=.0001, betas=(.9,.999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
    go = torch.optim.AdamW(model.parameters(), **args); do = torch.optim.AdamW(critic.parameters(), **args)
    selected = None; completed_epochs = 0
    try:
        for epoch in range(1, 49):
            order_indices = list(range(48)); random.Random(20260929 + epoch).shuffle(order_indices)
            for i in order_indices:
                resource(); ledger = {"sampleId": train[i]["sampleId"], "generator": 0, "discriminator": 0}
                profile.perform_pair(model, critic, train[i], order, go, do, counts, ledger, resource, None)
                require(ledger == {"sampleId": train[i]["sampleId"], "generator": 1, "discriminator": 1}, "actual pair ledger differs")
                progress_sink(epoch, counts, selected, completed_epochs=completed_epochs)
            require(counts == {"generator": epoch*48, "discriminator": epoch*48}, "actual epoch counts differ")
            completed_epochs = epoch
            if epoch in (24, 36, 48):
                selection, observations = validation_runner(model, validation, order, epoch=epoch)
                raw = checkpoint_encoder(model, critic, configuration=configuration, run_id=plan["runId"], package_binding=package_binding,
                    dataset_binding=plan["datasetManifest"], epoch=epoch, selection=selection, counts=counts)
                bound = checkpoint_sink(epoch, raw)
                require(bound["sha256"] == hashlib.sha256(raw).hexdigest(), "checkpoint sink source SHA differs")
                record = {"epoch": epoch, "selection": selection, "validation": observations, "checkpoint": bound, "counts": dict(counts)}
                records.append(record)
                if shared.prefer_checkpoint(selection, None if selected is None else selected["selection"]): selected = record
            progress_sink(epoch, counts, selected, completed_epochs=completed_epochs)
        cpu_model, cpu_critic = frozen_profile.fresh_networks(order)
        raw = checkpoint_sink(None, selected["checkpoint"])
        checkpoint_reloader(raw, model=cpu_model, critic=cpu_critic, configuration=configuration, run_id=plan["runId"], package_binding=package_binding,
            dataset_binding=plan["datasetManifest"], epoch=selected["epoch"], selection=selected["selection"], counts=selected["counts"])
        return {"schema": TERMINAL_SCHEMA, "status": "training_completed_review_pending", "capabilityVersion": CAPABILITY,
                "executionPackage": package_binding, "runId": plan["runId"], "packageId": plan["packageId"], "completedEpochs": 48,
                "executionState": "completed", "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"], "optimizerSteps": dict(counts), "checkpoints": records, "selectedCheckpointRecord": selected,
                "checkpointReloadVerified": True, "challengeContentRead": False, "regressionContentRead": False,
                "checkpointPromotable": False, "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False}
    except BaseException as error:
        error.actual_optimizer_counts = dict(counts); error.partial_checkpoint_records = records
        error.completed_epochs = completed_epochs
        raise


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
        os.replace(pending, path)
        last_progress[0] = time.monotonic()
    progress(0,{"generator":0,"discriminator":0},None,force=True)
    try:
        result = training_loop(model=model, critic=critic, train=loaded["train"], validation=loaded["validation"], order=order,
            configuration=configuration, package_binding=package_binding, plan=plan, resource=resource, checkpoint_sink=sink, progress_sink=progress)
        reader.unchanged(); progress(48,result["optimizerSteps"],result["selectedCheckpointRecord"],completed_epochs=48,state="completed",force=True)
        return write(root, plan["outputRoot"] + "/worker-terminal.json", result)
    except BaseException as error:
        actual = getattr(error,"actual_optimizer_counts",{})
        try: progress(None,{"generator":actual.get("generator"),"discriminator":actual.get("discriminator")},None,completed_epochs=getattr(error,"completed_epochs",None),state="failed_closed",force=True)
        except BaseException as secondary: error.secondary_progress_error = str(secondary)
        write(root, plan["outputRoot"] + "/worker-terminal.json", {"schema": TERMINAL_SCHEMA, "status": "failed_closed", "error": str(error)[:4096],
            "executionPackage": package_binding, "capabilityVersion": CAPABILITY, "runId": plan["runId"], "packageId": plan["packageId"],
            "executionState": "failed_closed", "optimizerSteps": getattr(error, "actual_optimizer_counts", None),
            "optimizerStepsGenerator": getattr(error,"actual_optimizer_counts",{}).get("generator"),
            "optimizerStepsDiscriminator": getattr(error,"actual_optimizer_counts",{}).get("discriminator"),
            "completedEpochs": getattr(error,"completed_epochs",None),
            "checkpoints": getattr(error, "partial_checkpoint_records", []), "secondaryRestoreError": getattr(error, "secondary_restore_error", None)})
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--package", required=True); parser.add_argument("--sha256", required=True)
    parser.add_argument("--gpu"); parser.add_argument("--gpu-sha256"); parser.add_argument("--preflight", action="store_true")
    a = parser.parse_args(); pb = {"path": a.package, "sha256": a.sha256}
    if a.preflight:
        runtime()[0].set_num_threads(2)
        _r, _s, _p, _c = load_package(pb); print(json.dumps({"status": "own_managed_preflight_passed", "gpuInitialized": False}))
    else: print(json.dumps(run(pb, {"path": a.gpu, "sha256": a.gpu_sha256})))

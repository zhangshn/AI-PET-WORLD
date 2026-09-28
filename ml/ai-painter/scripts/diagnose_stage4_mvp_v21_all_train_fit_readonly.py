"""Single-use, registered V21 epoch-24 endpoint fit diagnostic on all 48 train rows.

inspect is CPU-only and writes nothing. prepare requires the separately frozen
policy; run additionally requires its live registry supervisor. The checkpoint
is an exact historical diagnostic input, never a training initialization asset.
No non-train pixels/metrics, optimizer, backward, checkpoint write or image output.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import io
import json
import math
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import train_stage4_mvp_object_residual_v21_dry_stage0 as training
import diagnose_stage4_mvp_v21_selected_fit_readonly as old_metrics

cpu, gpu = training.cpu, training.gpu
require = training.require
WORKER = "ml/ai-painter/scripts/diagnose_stage4_mvp_v21_all_train_fit_readonly.py"
TESTS = "ml/ai-painter/tests/test_diagnose_stage4_mvp_v21_all_train_fit_readonly.py"
CONTROLLER = "scripts/run-ai-painter-learning-capacity-experiment.mjs"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v21-all-train-fit-readonly-policy-v1.json"
POLICY_SCHEMA = "stage4-mvp-v21-all-train-fit-readonly-policy-v1"
PACKAGE_SCHEMA = "stage4-mvp-v21-all-train-fit-readonly-package-v1"
SCOPE = "all_train_endpoint_fit_readonly_no_generalization_claim"
TASK_KIND = "readonly_train_fit_diagnostic"
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp-v21-all-train-fit-readonly"
RUN_ID = "mvp-v21-dry-stage0-123c625425ce959dbc0a8d5065bf158ecf97c164b07aaa4e"
SOURCE_ROOT = (".runtime/ai-painter/stage4-mvp-object-residual-v21-dry-executions/"
    "mvp-v21-dry-batch-123c625425ce959dbc0a8d5065bf158ecf97c164/stages/" + RUN_ID)
SOURCE_INPUTS = {
    "executionPackage": {"path": SOURCE_ROOT + "/execution-package.json", "sha256": "2afbb87503a07049a085f8cb40f793ee6bb5ca984435f8f9f8a400f5f10f2d86"},
    "workerTerminal": {"path": SOURCE_ROOT + "/phase-terminal.json", "sha256": "9f6cfecc136a863beb6449dd0179e3924fe9408114f6fc0ca2da809ae567c8fb"},
    "trainingTerminal": {"path": SOURCE_ROOT + "/training-finalize.json", "sha256": "e4d981d2a3c197e878670dbefcc6076ae3bd0f161fbf960ad1cdebf126770e18"},
    "endpointMetadata": {"path": SOURCE_ROOT + "/epochs/epoch-24.json", "sha256": "90b62f0539480e1770c38f04ffb5d6230c6730ada073441840aac69b4baa2ec0"},
    "checkpoint": {"path": SOURCE_ROOT + "/epochs/epoch-24.pt", "sha256": "11fbf6d5a9100725c8b29db3d8c7d820e5d8556ad35f6a178171d50867f86626"},
}
MODEL_STATE_SHA = "49a8ad42195e6d50b880d7dcc30053860d90edf909882b9a97cf28e450be5cf7"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
RESOURCES = {"maxWallSeconds": 600, "maxGpuMemoryFraction": .7, "maximumTemperatureC": 85,
             "minimumFreeVramMiB": 2048, "minimumFreeDiskMiB": 2048, "maxOutputMiB": 128,
             "cpuThreads": 2, "automaticRetries": 0, "maxForwardCalls": 48}
BOUNDARY = {"trainingStarted": False, "optimizerCreated": False,
    "optimizerSteps": {"generator": 0, "discriminator": 0}, "checkpointWritten": False,
    "checkpointSelectionChanged": False, "validationPixelsRead": False,
    "validationMetricsRead": False, "challengePixelsRead": False, "regressionPixelsRead": False,
    "formalStage0QualificationGranted": False, "stage4ProgressIncreaseGranted": False,
    "runtimePublicationGranted": False, "registryWritten": False, "automaticRetryStarted": False}
IMPLEMENTATION_PATHS = sorted(set(cpu.PROGRAMS + list(training.gate.PROGRAM_PATHS.values()) + [
    WORKER, TESTS, old_metrics.PROGRAM, training.WORKER_PATH,
    "ml/ai-painter/scripts/v21_object_residual_admission.py",
    "ml/ai-painter/scripts/run_stage4_mvp_structured_object_v18_readonly_gpu_qualification.py",
    "ml/ai-painter/scripts/run_stage4_mvp_object_residual_v21_readonly_gpu_qualification.py",
    "ml/ai-painter/scripts/materialize_stage4_mvp_object_residual_v21_dry_review.py",
]))


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(path):
    return {"path": path, "sha256": cpu.sha(cpu.project_file(ROOT, path).read_bytes())}


def selected_bindings(rows):
    return [{"sampleId": row["sampleId"], "split": "train", "trainOrdinal": ordinal,
             "historicalSourceSplit": row["sourceSplit"],
             "image": row["image"], "conditionPack": row["conditionPack"],
             "sourceRecord": row["sourceRecord"], "contribution": row["contribution"],
             "regionSource": row["regionSource"]} for ordinal, row in enumerate(rows)]


def validate_membership(manifest, source, train, candidate, contract):
    from ai_painter.complete_world.split_release import canonical_bytes
    require(manifest.get("sampleCount") == 64 and manifest.get("splitCounts") == cpu.COUNTS
            and manifest.get("datasetReleaseIdentity") == candidate["datasetBinding"]["datasetReleaseIdentity"]
            and manifest["sourceIndex"] == candidate["datasetBinding"]["sourceIndex"]
            and manifest["splits"] == candidate["datasetBinding"]["splits"], "V21 release differs")
    all_rows = source["samples"]
    by_id = {row["sampleId"]: row for row in all_rows}
    ids = train.get("sampleIds")
    require(len(all_rows) == len(by_id) == source.get("sampleCount") == 64
            and train.get("split") == "train" and isinstance(ids, list)
            and len(ids) == len(set(ids)) == 48
            and all(sid in by_id and by_id[sid]["split"] == "train" for sid in ids),
            "exact 48 train membership required")
    rows = [by_id[sid] for sid in ids]
    selection_sha = cpu.sha(canonical_bytes(rows))
    require(selection_sha == candidate["datasetBinding"]["trainSelectionSha256"], "train row identity differs")
    order = contract["tensorContract"]["channelOrder"]
    continuous = contract["tensorContract"]["typePartitions"]["continuous"]
    require(order == manifest["identityPayload"]["channelOrder"] and len(order) == len(set(order)) == 23
            and continuous == manifest["identityPayload"]["continuousChannelIds"], "condition contract differs")
    # Identity metadata only: do not open non-train split or asset files.
    for key in ("sampleId", "worldId", "instance", "image", "conditionPack", "sourceRecord"):
        values = [row[key] if key == "sampleId" else row["grouping"][key]
                  if key in ("worldId", "instance") else row[key]["sha256"] for row in all_rows]
        require(len(values) == len(set(values)), "cross-split source identity collision: " + key)
    return order, continuous, rows, selection_sha


def verify_train_source(reader, row, order):
    require(row["split"] == "train", "non-train content prohibited")
    pack = reader.json(row["conditionPack"])
    cpu.validate_pack(row, pack, order)
    contribution, record = reader.json(row["contribution"]), reader.json(row["sourceRecord"])
    reader.read(row["regionSource"])
    require(record.get("recordId") == row["sampleId"] and record.get("blockReasons") == []
            and record.get("aiAssistedColdStartEligible") is True
            and record.get("trainingEligibility") == "ai_assisted_cold_start_eligible"
            and record.get("source", {}).get("thirdPartyContentUsed") is False
            and record.get("gameUseContract", {}).get("role") == "rgb_visual_training_original"
            and record["originalImage"]["sha256"] == contribution["imageSha256"] == row["image"]["sha256"]
            and contribution["conditionPackFileSha256"] == row["conditionPack"]["sha256"]
            and contribution["conditionPackPath"] == row["conditionPack"]["path"]
            and contribution["conditionWorldId"] == pack["worldId"], "original rights/source pairing differs")
    task_binding = {"path": contribution["taskPackagePath"], "sha256": contribution["taskPackageSha256"]}
    task_bytes = reader.read(task_binding)
    task = json.loads(task_bytes)
    cpu.verify_js_content_hash(task_bytes, "taskSha256", pack["taskSha256"])
    require(task_binding["path"] == pack["sourceBindings"]["taskPackagePath"]
            and task["worldId"] == pack["worldId"] and task["tick"] == pack["tick"]
            and task["taskId"] == pack["taskId"], "task/condition identity differs")
    visual_bytes, _ = reader.snapshot(task["sourceBindings"]["visualFactManifestPath"])
    cpu.verify_js_content_hash(visual_bytes, "manifestSha256", pack["visualFactManifestSha256"])
    visual = json.loads(visual_bytes)
    require(visual["worldId"] == pack["worldId"] and visual["tick"] == pack["tick"]
            and visual["manifestId"] == pack["visualFactManifestId"], "visual fact identity differs")
    facts = reader.json({"path": task["sourceBindings"]["naturalizedWorldFactsPath"],
                         "sha256": task["sourceBindings"]["naturalizedWorldFactsSha256"]})
    require(facts["v7SlotBinding"]["slotId"] == row["capacitySlotId"], "WorldFacts slot differs")
    objects = task["spatialLayers"]["objectFootprints"]
    require(len(objects) == len(pack["objectInstanceTable"]), "object source count differs")
    for ordinal, (item, source) in enumerate(zip(pack["objectInstanceTable"], objects), 1):
        require(item["value"] == ordinal and all(item[key] == source[key] for key in
                ("objectId", "kind", "footprint", "blocksMovement")), "object source identity differs")
    reader.read(row["image"])
    for channel in pack["channels"]:
        reader.read(channel)


def idle_registry():
    # Use the existing read-only transaction verifier; never scan old namespaces.
    code = ("import {readCurrentExecutionRegistry} from './src/server/ai-painter-current-execution-registry.mjs';"
            "const r=await readCurrentExecutionRegistry(process.cwd());if(!r.ok)throw Error(r.errorCode);"
            "process.stdout.write(JSON.stringify(r));")
    result = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT,
        capture_output=True, text=True, check=True, timeout=15,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    checked = json.loads(result.stdout)
    registry = checked["registry"]
    training.validate_idle_registry(registry)
    return {"registryRevision": registry["registryRevision"], "registrySha256": checked["registrySha256"],
            "activeExecution": None, "latestTrainingTerminal": registry.get("latestTrainingTerminal")}


def inspect_inputs():
    reader = cpu.BoundReader()
    old_package = reader.json(SOURCE_INPUTS["executionPackage"])
    ticket = reader.json(old_package["trainingExecutionTicket"])
    training.validate_package(old_package, ticket)
    require(old_package["runId"] == RUN_ID and old_package["datasetManifest"] == cpu.MANIFEST,
            "wrong historical source execution")
    for key in ("workerTerminal", "trainingTerminal", "endpointMetadata"):
        reader.read(SOURCE_INPUTS[key])  # Hash only; never parse historical validation metrics.
    cp = cpu.project_file(ROOT, SOURCE_INPUTS["checkpoint"]["path"])
    require(0 < cp.stat().st_size <= 128 * 1024**2, "missing/oversized actual epoch24 checkpoint")
    reader.read(SOURCE_INPUTS["checkpoint"])
    manifest = reader.json(cpu.MANIFEST)
    candidate = reader.json(training.CANDIDATE)
    contract = reader.json(cpu.CONDITION_CONTRACT)
    source = reader.json(manifest["sourceIndex"])
    train = reader.json(manifest["splits"]["train"])
    order, continuous, rows, selection_sha = validate_membership(manifest, source, train, candidate, contract)
    qualification = manifest["qualification"]
    require(all(qualification.get(key) is True for key in ("dataQualifiedForTraining",
            "aiAssistedColdStartRightsVerified", "projectControlledSourceIsolationVerified", "splitMembershipVerified")),
            "current release qualification differs")
    historical = reader.json(manifest["qualificationEvidence"])
    require(historical["verified"]["semanticAndAiAssistedRightsVerified"] is True
            and historical["verified"]["projectControlledSourcePairingVerified"] is True,
            "source rights evidence differs")
    moved = [r["sampleId"] for r in rows if r["sourceSplit"] != "train"]
    require(moved == historical["verified"]["recordedOptimizerExposureMovedToTrain"],
            "historical source-split migration lacks release evidence")
    for row in rows:
        verify_train_source(reader, row, order)
    programs = {"controller": bind(CONTROLLER), "worker": bind(WORKER)}
    implementations = [bind(path) for path in IMPLEMENTATION_PATHS]
    for value in implementations:
        reader.read(value)
    registry = idle_registry()
    reader.unchanged()
    inputs = {"sourceRunId": RUN_ID, "sourceInputs": SOURCE_INPUTS,
        "checkpointEpoch": 24, "modelStateSha256": MODEL_STATE_SHA,
        "historicalMetadataUse": "hash_only_no_validation_metrics_consumed",
        "candidateContract": training.CANDIDATE, "datasetManifest": cpu.MANIFEST,
        "sourceIndex": manifest["sourceIndex"], "trainSplit": manifest["splits"]["train"],
        "trainSelectionSha256": selection_sha, "selectedRows": selected_bindings(rows),
        "sourceQualification": {"release": qualification, "historicalEvidence": manifest["qualificationEvidence"],
            "historicalStatus": historical["status"], "sourceSplitMigration": moved,
            "originalRowUseQualification": [r["useQualification"] for r in rows]},
        "programBindings": programs, "implementationBindings": implementations,
        "registryBeforeStart": registry, "resources": RESOURCES, "scope": SCOPE,
        "outputParent": OUTPUT_PARENT, "boundary": BOUNDARY}
    return {"reader": reader, "inputs": inputs, "order": order, "continuous": continuous, "rows": rows}


def validate_policy(policy, inputs):
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "active_single_bounded_readonly_diagnostic_not_training"
            and policy.get("scope") == SCOPE and policy.get("inputs") == inputs,
            "exact frozen diagnostic policy required")
    require(policy.get("checkpointUse") == "weights_only_diagnostic_only_no_training_initialization"
            and policy.get("maxAttempts") == 1 and policy.get("automaticRetries") == 0,
            "checkpoint use/attempt policy differs")


def package_from_inputs(inputs, policy_binding):
    identity = "v21-all-train-fit-" + cpu.sha(json.dumps({"inputs": inputs, "policy": policy_binding},
        sort_keys=True, separators=(",", ":")).encode())[:48]
    return {"schemaVersion": PACKAGE_SCHEMA, "experimentIdentity": identity,
        "scope": SCOPE, "policy": policy_binding, "inputs": inputs,
        "resources": inputs["resources"], "selectedRows": inputs["selectedRows"],
        "programBindings": inputs["programBindings"],
        "outputRoot": OUTPUT_PARENT + "/" + identity}


def prepare(policy_path):
    require(policy_path == POLICY_PATH, "wrong diagnostic policy path")
    context = inspect_inputs()
    policy_binding = bind(policy_path)
    policy = context["reader"].json(policy_binding)
    validate_policy(policy, context["inputs"])
    package = package_from_inputs(context["inputs"], policy_binding)
    directory = cpu.project_file(ROOT, package["outputRoot"])
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "package.json"
    if target.exists():
        require(json.loads(target.read_bytes()) == package, "package identity collision")
    else:
        require(not any(directory.iterdir()), "diagnostic output already occupied")
        training.write_exclusive(target, package)
    return bind(package["outputRoot"] + "/package.json")


def active_execution(package, package_binding, reader):
    output = package["outputRoot"]
    started = reader.json(bind(output + "/controller-started.json"))
    baseline = package["inputs"]["registryBeforeStart"]
    require(started.get("package") == package_binding
            and started.get("previousRegistry") == {"revision": baseline["registryRevision"], "sha256": baseline["registrySha256"]},
            "controller/package baseline differs")
    registry = json.loads(cpu.project_file(ROOT, training.REGISTRY_PATH).read_bytes())
    active = registry.get("activeExecution") or {}
    require(registry.get("taskKind") == TASK_KIND
            and active.get("programLineage") == package["programBindings"]
            and active.get("lock", {}).get("path") == output + "/execution-lock.json"
            and active.get("heartbeat") == {"path": output + "/heartbeat.json", "ttlSeconds": 120}
            and registry.get("latestTrainingTerminal") == baseline["latestTrainingTerminal"],
            "active diagnostic boundary/latest training differs")
    lock = reader.json(active["lock"])
    heartbeat = json.loads(cpu.project_file(ROOT, active["heartbeat"]["path"]).read_bytes())
    chain = training.validate_active(registry, {"programBindings": package["programBindings"],
        "capabilityVersion": package["experimentIdentity"], "runId": package["experimentIdentity"],
        "packageId": package["experimentIdentity"]}, package_binding, baseline, lock, heartbeat)
    terminal, capsule = reader.json(registry["terminalEvidence"]), reader.json(registry["taskCapsule"])
    require(terminal.get("package") == package_binding
            and any(item.get("path") == package_binding["path"] and item.get("sha256") == package_binding["sha256"]
                    for item in capsule.get("evidence", [])), "active capsule does not bind diagnostic package")
    return chain, heartbeat["heartbeatAtUtc"]


def authenticate(package_binding):
    reader = cpu.BoundReader()
    package = reader.json(package_binding)
    require(package.get("schemaVersion") == PACKAGE_SCHEMA and package["scope"] == SCOPE
            and package["policy"]["path"] == POLICY_PATH, "wrong diagnostic package")
    policy = reader.json(package["policy"])
    validate_policy(policy, package["inputs"])
    require(package == package_from_inputs(package["inputs"], package["policy"])
            and package_binding["path"] == package["outputRoot"] + "/package.json"
            and package["inputs"]["sourceInputs"] == SOURCE_INPUTS
            and package["inputs"]["modelStateSha256"] == MODEL_STATE_SHA
            and package["resources"] == RESOURCES, "diagnostic input identity differs")
    for value in package["inputs"]["implementationBindings"] + list(package["programBindings"].values()):
        reader.read(value)
    manifest = reader.json(cpu.MANIFEST)
    candidate = reader.json(training.CANDIDATE)
    order, continuous, rows, selection_sha = validate_membership(manifest, reader.json(manifest["sourceIndex"]),
        reader.json(manifest["splits"]["train"]), candidate, reader.json(cpu.CONDITION_CONTRACT))
    require(package["selectedRows"] == selected_bindings(rows)
            and package["inputs"]["trainSelectionSha256"] == selection_sha, "selected train rows differ")
    for key, value in SOURCE_INPUTS.items():
        reader.read(value)  # Historical terminal/epoch summary are never JSON-decoded.
    for row in rows:
        verify_train_source(reader, row, order)
    chain, heartbeat = active_execution(package, package_binding, reader)
    reader.unchanged()
    return {"package": package, "reader": reader, "order": order, "continuous": continuous,
            "rows": rows, "processChain": chain, "heartbeatAtUtc": heartbeat}


def validate_checkpoint(saved):
    # Do not access checkpointSelection/validationScore: container metadata is
    # safely deserialized by torch but does not participate in this diagnosis.
    require(saved.get("schemaVersion") == training.CHECKPOINT_SCHEMA
            and saved.get("epoch") == 24 and saved.get("runId") == RUN_ID
            and saved.get("executionPackage") == SOURCE_INPUTS["executionPackage"]
            and saved.get("candidateContract") == training.CANDIDATE
            and saved.get("datasetManifest") == cpu.MANIFEST and saved.get("modelPlan") == training.MODEL_PLAN
            and saved.get("optimizerStepsGenerator") == saved.get("optimizerStepsDiscriminator") == 1152
            and saved.get("modelStateSha256") == MODEL_STATE_SHA
            and saved.get("formalInferenceEligible") is False
            and saved.get("checkpointPromotionEligible") is False
            and saved.get("automaticResumeAllowed") is False, "not the exact historical epoch24 endpoint")


def load_checkpoint_cpu(reader, order):
    import torch
    from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import build_fresh_native_rgb_object_residual_v21_cpu
    saved = torch.load(io.BytesIO(reader.read(SOURCE_INPUTS["checkpoint"])), map_location="cpu", weights_only=True)
    validate_checkpoint(saved)
    model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=order)
    model.load_state_dict(saved["modelState"], strict=True)
    model.eval().requires_grad_(False)
    require(cpu.state_hash(model) == MODEL_STATE_SHA and all(p.grad is None for p in model.parameters()),
            "epoch24 generator state hash differs")
    return model


def fit_metrics(predicted, sample, order):
    import torch
    from ai_painter.complete_world.object_instance_supervision_cpu import _crop, iter_train_object_supervision
    require(sample.get("split") == "train", "fit diagnostic accepts train only")
    require(predicted.shape == (1, 3, 192, 256) and bool(torch.isfinite(predicted).all()
            and ((predicted >= 0) & (predicted <= 1)).all()), "invalid predicted RGB")
    actual, target = predicted[0].float().cpu(), sample["image"].float().cpu()
    conditions = sample["conditions"].cpu()
    regions = old_metrics.region_metrics(actual[None], target[None], conditions, order)
    instances = []
    for item in iter_train_object_supervision(sample, sample["objectInstanceTable"], order):
        patch_rgb, _ = _crop(actual, item.top, item.left, 32)
        support = item.support_mask[0] > .5
        require(bool(support.any()), "empty bound instance support")
        instances.append({"instanceValue": item.instance_value, "kind": item.kind, "role": item.role,
            "supportPixelCount": int(support.sum()),
            "supportRgbMae": float((patch_rgb[:, support] - item.target_rgb[:, support]).abs().mean())})
    require(instances, "missing bound instance metrics")
    return {"rgbMae": float((actual - target).abs().mean()),
            "objects": {role: regions[role] for role in ROLES}, "instanceSupportErrors": instances}


@contextmanager
def readonly_guard():
    import torch
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         patch.object(torch.Tensor, "backward", side_effect=RuntimeError("backward prohibited")), \
         torch.inference_mode():
        yield


def validate_results(samples, selected):
    require(len(samples) == len(selected) == 48, "incomplete diagnostic; exactly 48 forwards required")
    require([(x.get("sampleId"), x.get("split"), x.get("trainOrdinal")) for x in samples]
            == [(x["sampleId"], "train", x["trainOrdinal"]) for x in selected], "result identity/order differs")


def summarize_correlations(samples):
    summary = {}
    for role in ROLES:
        values = [x["metrics"]["objects"][role]["centeredLumaCorrelation"] for x in samples]
        valid = [value for value in values if value is not None]
        summary[role] = {"positiveCorrelationCount": sum(value > 0 for value in valid),
            "validCorrelationCount": len(valid), "unavailableCorrelationCount": len(values) - len(valid),
            "medianCorrelation": statistics.median(valid) if valid else None,
            "correlationAvailability": "available" if valid else "unavailable_indeterminate"}
    return summary


def run(package_binding):
    context = authenticate(package_binding)
    package, reader = context["package"], context["reader"]
    directory = cpu.project_file(ROOT, package["outputRoot"])
    require(not any((directory / name).exists() for name in ("worker-started.json", "result.json", "worker-failure.json")),
            "diagnostic already consumed; retries prohibited")
    start = time.monotonic()
    state = {**BOUNDARY, "experimentIdentity": package["experimentIdentity"], "gpuStarted": False,
        "forwardCalls": 0, "processId": os.getpid(), "startedAtUtc": now(),
        "checkpoint": SOURCE_INPUTS["checkpoint"], "supervisorProcessChain": context["processChain"]}
    training.write_exclusive(directory / "worker-started.json", state)
    last_authority = 0.0
    resource_observations = []

    def resource(phase):
        nonlocal last_authority
        import torch
        require(time.monotonic() - start <= RESOURCES["maxWallSeconds"], "diagnostic wall time exhausted")
        if time.monotonic() - last_authority >= 10:
            _, context["heartbeatAtUtc"] = active_execution(package, package_binding, reader)
            last_authority = time.monotonic()
        require(shutil.disk_usage(directory).free >= RESOURCES["minimumFreeDiskMiB"] * 1024**2, "free disk below floor")
        require(sum(p.stat().st_size for p in directory.rglob("*") if p.is_file()) <= RESOURCES["maxOutputMiB"] * 1024**2,
                "diagnostic output budget exhausted")
        torch.cuda.synchronize(0)
        free, total = torch.cuda.mem_get_info(0)
        require(free >= RESOURCES["minimumFreeVramMiB"] * 1024**2, "free VRAM below floor")
        memory = gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved(0)),
            allocated=int(torch.cuda.max_memory_allocated(0)), device_used=int(total - free), fraction=.7)
        thermal = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        require(thermal.returncode == 0, "GPU temperature unavailable")
        temperature = int(thermal.stdout.strip().splitlines()[0])
        require(temperature <= RESOURCES["maximumTemperatureC"], "GPU temperature above ceiling")
        resource_observations.append({"phase": phase, "forwardCalls": state["forwardCalls"],
            "memory": memory, "temperatureC": temperature, "elapsedSeconds": time.monotonic() - start, "recordedAtUtc": now()})

    try:
        import torch
        torch.set_num_threads(2)
        with readonly_guard():
            model = load_checkpoint_cpu(reader, context["order"])
            require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
            torch.cuda.set_device(0)
            free, total = torch.cuda.mem_get_info(0)
            allocation = int(total * .7) - (total - free) - 64 * 1024**2
            require(allocation > 0 and free >= 2048 * 1024**2, "insufficient memory below 70 percent")
            torch.cuda.set_per_process_memory_fraction(allocation / total, 0)
            torch.cuda.reset_peak_memory_stats(0)
            state["gpuStarted"] = True
            model.to("cuda:0")
            resource("model_loaded")
            samples = []
            with patch.object(torch, "load", side_effect=RuntimeError("additional checkpoint load prohibited")):
                for ordinal, row in enumerate(context["rows"]):
                    resource("before_sample")
                    sample, identity = cpu.load_sample(reader, row, context["order"], context["continuous"])
                    require(sample["sampleId"] == row["sampleId"] and sample["split"] == identity["split"] == "train",
                            "loaded sample identity differs")
                    source_tensor_hash = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
                    require(state["forwardCalls"] < 48, "forward budget exhausted")
                    with torch.autocast("cuda", dtype=torch.bfloat16):
                        prediction = model(sample["conditions"][None].to("cuda:0"), sample["objectInstanceTable"])
                    state["forwardCalls"] += 1
                    metrics = fit_metrics(prediction, sample, context["order"])
                    require(source_tensor_hash == {key: cpu.tensor_hash(sample[key]) for key in source_tensor_hash},
                            "diagnostic mutated source tensors")
                    observation = {"sampleId": row["sampleId"], "split": "train", "trainOrdinal": ordinal,
                        "sourceImage": row["image"], "conditionPack": row["conditionPack"],
                        "sourceTensorSha256": source_tensor_hash, "sampleIdentity": identity,
                        "checkpoint": SOURCE_INPUTS["checkpoint"], "metrics": metrics, "recordedAtUtc": now()}
                    samples.append(observation)
                    training.write_exclusive(directory / f"sample-{ordinal:02d}.json", observation)
                    resource("after_sample")
                    print(json.dumps({"event": "readonly_train_fit_sample", "runId": package["experimentIdentity"],
                        "executionId": package["experimentIdentity"], "processId": os.getpid(),
                        "trainingStage": TASK_KIND, "epoch": None, "batchIndex": ordinal + 1, "batchCount": 48,
                        "optimizationStep": 0, "loss": None, "learningRate": None,
                        "throughputSamplesPerSecond": state["forwardCalls"] / max(time.monotonic() - start, 1e-9),
                        "estimatedCompletionAtUtc": None, "checkpointIdentity": SOURCE_INPUTS["checkpoint"]["sha256"],
                        "heartbeatAtUtc": context["heartbeatAtUtc"], "reporterIdentity": "v21_all_train_fit_readonly_worker",
                        "sampleId": row["sampleId"], "trainOrdinal": ordinal}), flush=True)
                    del sample, prediction
            validate_results(samples, package["selectedRows"])
            require(cpu.state_hash(model) == MODEL_STATE_SHA and all(p.grad is None and not p.requires_grad for p in model.parameters()),
                    "read-only model state/gradient boundary violated")
            reader.unchanged()
            resource("completed")
        summary = summarize_correlations(samples)
        training.write_exclusive(directory / "resource-observations.json", {"observations": resource_observations})
        artifacts = [bind(package["outputRoot"] + "/" + name) for name in
            ["worker-started.json", "resource-observations.json"] + [f"sample-{ordinal:02d}.json" for ordinal in range(48)]]
        result = {**state, "status": "readonly_train_fit_diagnostic_completed_no_qualification",
            "modelStateUnchanged": True, "sourceBytesUnchanged": True, "modelStateSha256": MODEL_STATE_SHA,
            "samples": samples, "trainOnlySummary": summary, "artifacts": artifacts,
            "programBindings": package["programBindings"], "resources": RESOURCES,
            "elapsedSeconds": time.monotonic() - start, "completedAtUtc": now()}
        training.write_exclusive(directory / "result.json", result)
        return result
    except BaseException as error:
        training.write_exclusive(directory / "worker-failure.json", {**state, "status": "readonly_train_fit_diagnostic_failed_closed",
            "error": repr(error), "failedAtUtc": now(), "resourceObservations": resource_observations})
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("inspect", "prepare", "run"))
    parser.add_argument("--policy")
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.mode == "inspect":
        require(not any((args.policy, args.package, args.sha256)), "inspect takes no execution inputs")
        context = inspect_inputs()
        print(json.dumps({"status": "cpu_inputs_verified_policy_not_frozen_gpu_not_started", "inputs": context["inputs"],
            "policyTemplate": {"schemaVersion": POLICY_SCHEMA, "status": "draft_not_executable", "scope": SCOPE,
                "inputs": context["inputs"], "checkpointUse": "weights_only_diagnostic_only_no_training_initialization",
                "maxAttempts": 1, "automaticRetries": 0}, "checkpointDeserialized": False,
            "samplePixelsDecoded": False, "gpuInitialized": False}, ensure_ascii=False))
    elif args.mode == "prepare":
        require(args.policy and not args.package and not args.sha256, "prepare requires only --policy")
        print(json.dumps(prepare(args.policy)))
    else:
        require(args.package and args.sha256 and not args.policy, "run requires bound package")
        run({"path": args.package, "sha256": args.sha256})


if __name__ == "__main__":
    main()

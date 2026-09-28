"""V21 two-original train-only capacity worker; never qualifies or publishes Stage4.

The existing capacity controller owns the registry transaction, lock, heartbeat,
timeout and terminal commit. This worker can only prepare a bound package or run
once beneath that controller's live registered process. No non-train split is
opened, no old checkpoint is loaded, and the only checkpoint is the final step.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import train_stage4_mvp_object_residual_v21_dry_stage0 as v21

cpu, gpu = v21.cpu, v21.gpu
require = v21.require
MANIFEST = cpu.MANIFEST
POLICY_SCHEMA = "stage4-mvp-v21-train-only-capacity-probe-v2"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v21-train-only-capacity-probe-v2.json"
PACKAGE_SCHEMA = "ai-painter-v21-train-only-capacity-package-v1"
SCOPE = "train_only_learning_capacity_no_generalization_claim"
WORKER = "ml/ai-painter/scripts/painter_stage4_v21_train_only_capacity_probe.py"
CONTROLLER = "scripts/run-ai-painter-learning-capacity-experiment.mjs"
OUTPUT_PARENT = ".runtime/ai-painter/learning-capacity-experiments"
SUBJECTS = (
    (0, "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"),
    (43, "ai-cold-start-v7-v7-capacity-slot-190-wet-season-drainage-hollow-v7"),
)
RESOURCE_CEILING = {"maxWallSeconds": 1800, "maxGpuMemoryFraction": .7,
                    "minimumFreeVramMiB": 2048, "maximumTemperatureC": 85,
                    "minimumFreeDiskMiB": 2048, "maxOutputMiB": 512,
                    "cpuThreads": 2, "automaticRetries": 0}
PRIOR_FAILURE = {"runId": "v21-train-only-capacity-8f57bcb2d4fc7a6b3dcb9e2b92931c3a056d204f205264b1",
    "terminal": {"path": ".runtime/ai-painter/learning-capacity-experiments/"
                 "v21-train-only-capacity-8f57bcb2d4fc7a6b3dcb9e2b92931c3a056d204f205264b1/terminal.json",
                 "sha256": "235219e297e94318780212076525dd70cb501e3dab752c9f148d6c0c7d640b38"},
    "workerFailure": {"path": ".runtime/ai-painter/learning-capacity-experiments/"
                      "v21-train-only-capacity-8f57bcb2d4fc7a6b3dcb9e2b92931c3a056d204f205264b1/worker-failure.json",
                      "sha256": "3a2fb3741a18c9a63ee4179b343412c7c6d163a1500ba72a2c9610079a4edac8"},
    "actualOptimizerSteps": {"generator": 0, "discriminator": 0},
    "cause": "zero_update_gpu_probe_critic_not_frozen", "oldIdentityMustNotBeReused": True}


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(path):
    return {"path": path, "sha256": cpu.sha(cpu.project_file(ROOT, path).read_bytes())}


def require_critic_mode(critic, *, trainable):
    parameters = tuple(critic.parameters())
    require(parameters and all(parameter.requires_grad is trainable for parameter in parameters),
            "critic requires_grad boundary differs")


def exact_resource_budget(resources):
    """The strict intersection of V21 and the old capacity resource ceilings."""
    require(isinstance(resources, dict) and set(resources) == set(RESOURCE_CEILING), "resource keys differ")
    for key in ("maxWallSeconds", "maxOutputMiB", "cpuThreads", "maximumTemperatureC"):
        require(type(resources[key]) is int and 0 < resources[key] <= RESOURCE_CEILING[key], "resource ceiling differs: " + key)
    require(type(resources["maxGpuMemoryFraction"]) in (int, float)
            and 0 < resources["maxGpuMemoryFraction"] <= .7, "VRAM fraction differs")
    for key in ("minimumFreeVramMiB", "minimumFreeDiskMiB"):
        require(type(resources[key]) is int and resources[key] >= RESOURCE_CEILING[key], "resource floor differs: " + key)
    require(resources["automaticRetries"] == 0, "automatic retry prohibited")


def validate_policy(policy):
    require(policy.get("schemaVersion") == POLICY_SCHEMA and policy.get("scope") == SCOPE,
            "independent V21 capacity policy required")
    require(policy.get("status") == "active_single_bounded_diagnostic_not_formal_training"
            and policy.get("parentCandidate") == v21.CANDIDATE
            and policy.get("datasetManifest") == MANIFEST
            and policy.get("resolution") == [256, 192]
            and policy.get("outputRoot") == OUTPUT_PARENT
            and policy.get("priorFailedExecution") == PRIOR_FAILURE
            and [(r.get("trainOrdinal"), r.get("sampleId")) for r in policy.get("selectedTrainRows", [])] == list(SUBJECTS),
            "V21 policy identity/scope differs")
    model, objective, training = policy.get("model", {}), policy.get("objective", {}), policy.get("training", {})
    require(model.get("initializationSeed") == v21.MODEL_PLAN["seed"]
            and model.get("freshInitializationOnly") is True
            and model.get("priorOrFailedCheckpointLoaded") is False
            and model.get("autoencoderInGraph") is False
            and bind(model.get("sourcePath")) == {"path": model.get("sourcePath"), "sha256": model.get("sourceSha256")}
            and bind(objective.get("sourcePath")) == {"path": objective.get("sourcePath"), "sha256": objective.get("sourceSha256")}
            and bind(objective.get("discriminatorSourcePath")) == {"path": objective.get("discriminatorSourcePath"), "sha256": objective.get("discriminatorSourceSha256")}
            and objective.get("architectureChangesAllowed") is False
            and objective.get("lossChangesAllowed") is False,
            "V21 architecture/objective bytes or fresh-init policy differ")
    require(training.get("sampleOrder") == "alternate_train_ordinal_0_then_43"
            and training.get("maxGeneratorOptimizerSteps") == 512
            and training.get("maxDiscriminatorOptimizerSteps") == 512
            and training.get("observationSteps") == [0, 128, 256, 512]
            and training.get("generatorLearningRate") == v21.OPTIMIZER_PLAN["generatorLearningRate"]
            and training.get("discriminatorLearningRate") == v21.OPTIMIZER_PLAN["discriminatorLearningRate"]
            and training.get("checkpointRule") == "final_step_only_no_selection"
            and training.get("automaticRetries") == 0 and training.get("maxTrainingAttempts") == 1,
            "step, loss or checkpoint policy differs")
    exact_resource_budget({**policy.get("resources", {}), "automaticRetries": training.get("automaticRetries")})
    execution = policy.get("execution", {})
    forbidden = ("validationReadAllowed", "challengeReadAllowed", "regressionReadAllowed",
                 "checkpointSelectionAllowed", "checkpointPromotionAllowed",
                 "formalStageAdvancementAllowed", "runtimeFrameAllowed", "failedCheckpointReuseAllowed",
                 "worldEntryAllowed", "shutdownAllowed")
    require(all(execution.get(key) is False for key in forbidden), "train-only policy boundary differs")
    require(all(execution.get(key) is True for key in
            ("cpuBehaviorTestsRequired", "noUpdateGpuProbeRequired", "currentExecutionRegistryRequired",
             "ownedLockProcessAndHeartbeatRequired", "oneExecutionIdentityOnly")),
            "capacity execution gates missing")


def validate_prior_failure(reader):
    terminal = reader.json(PRIOR_FAILURE["terminal"])
    failure = reader.json(PRIOR_FAILURE["workerFailure"])
    require(terminal.get("status") == "experiment_failed_closed"
            and terminal.get("executionState") == "failed_closed"
            and terminal.get("runId") == PRIOR_FAILURE["runId"]
            and terminal.get("checkpointPromotable") is False
            and failure.get("experimentIdentity") == PRIOR_FAILURE["runId"]
            and failure.get("gpuStarted") is True
            and failure.get("trainingStarted") is False
            and failure.get("optimizerSteps") == PRIOR_FAILURE["actualOptimizerSteps"]
            and failure.get("error") == "ValueError('generator step requires frozen critic parameters')",
            "prior zero-step failure evidence differs")


def fixed_rows(reader, policy):
    """Only manifest, source index and train membership are opened here."""
    manifest = reader.json(MANIFEST)
    candidate = reader.json(v21.CANDIDATE)
    contract = reader.json(cpu.CONDITION_CONTRACT)
    require(policy["sourceIndex"] == manifest["sourceIndex"]
            and policy["trainSplit"] == manifest["splits"]["train"], "policy source/train binding differs")
    require(manifest.get("sampleCount") == 64 and manifest.get("splitCounts") == cpu.COUNTS
            and manifest.get("qualification", {}).get("dataQualifiedForTraining") is True
            and manifest.get("qualification", {}).get("aiAssistedColdStartRightsVerified") is True
            and manifest.get("qualification", {}).get("projectControlledSourceIsolationVerified") is True
            and manifest.get("qualification", {}).get("splitMembershipVerified") is True
            and candidate["datasetBinding"]["sourceIndex"] == manifest["sourceIndex"]
            and candidate["datasetBinding"]["splits"] == manifest["splits"],
            "current V21 dataset release differs")
    source = reader.json(manifest["sourceIndex"])
    historical = reader.json(manifest["qualificationEvidence"])
    require(historical.get("verified", {}).get("semanticAndAiAssistedRightsVerified") is True
            and historical.get("verified", {}).get("projectControlledSourcePairingVerified") is True,
            "source rights/pairing evidence differs")
    members = reader.json(manifest["splits"]["train"])
    ids = members["sampleIds"]
    by_id = {row["sampleId"]: row for row in source["samples"]}
    require(len(source["samples"]) == len(by_id) == 64
            and members["split"] == "train" and len(ids) == len(set(ids)) == 48
            and all(by_id[sid]["split"] == "train" for sid in ids), "train membership differs")
    from ai_painter.complete_world.split_release import canonical_bytes
    require(cpu.sha(canonical_bytes([by_id[sid] for sid in ids]))
            == candidate["datasetBinding"]["trainSelectionSha256"], "V21 train selection differs")
    order = contract["tensorContract"]["channelOrder"]
    continuous = contract["tensorContract"]["typePartitions"]["continuous"]
    require(order == manifest["identityPayload"]["channelOrder"] and len(order) == 23
            and continuous == manifest["identityPayload"]["continuousChannelIds"], "condition order differs")
    rows = []
    for ordinal, sample_id in SUBJECTS:
        require(ids[ordinal] == sample_id, "train ordinal differs")
        row = by_id[sample_id]
        selected = policy["selectedTrainRows"][len(rows)]
        require(selected["imageSha256"] == row["image"]["sha256"]
                and selected["conditionPackSha256"] == row["conditionPack"]["sha256"],
                "selected original/condition differs")
        require(row["sourceSplit"] == row["split"] == "train", "non-train subject prohibited")
        record = reader.json(row["sourceRecord"])
        contribution = reader.json(row["contribution"])
        reader.read(row["regionSource"])
        require(record.get("recordId") == sample_id
                and record.get("originalImage", {}).get("sha256") == row["image"]["sha256"]
                and record.get("aiAssistedColdStartEligible") is True
                and record.get("trainingEligibility") == "ai_assisted_cold_start_eligible"
                and record.get("gameUseContract", {}).get("role") == "rgb_visual_training_original"
                and record.get("gameUseContract", {}).get("directRuntimeFrameUseAllowed") is False
                and record.get("source", {}).get("thirdPartyContentUsed") is False
                and contribution.get("imageSha256") == row["image"]["sha256"]
                and contribution.get("conditionPackFileSha256") == row["conditionPack"]["sha256"],
                "selected original rights/source pairing differs")
        pack = reader.json(row["conditionPack"])
        cpu.validate_pack(row, pack, order)
        # Rehash exact originals and all condition source bytes before CUDA.
        reader.read(row["image"])
        for channel in pack["channels"]:
            reader.read(channel)
        rows.append(row)
    qualification = {"releaseManifest": MANIFEST, "releaseQualification": manifest["qualification"],
        "historicalQualificationEvidence": manifest["qualificationEvidence"],
        "historicalQualificationStatus": historical["status"],
        "selectedOriginalRowUseQualification": [row["useQualification"] for row in rows],
        "selectedOriginalRecords": [row["sourceRecord"] for row in rows],
        "selectedContributions": [row["contribution"] for row in rows],
        "interpretation": "current_release_qualified_historical_rows_retained_not_formal_execution_qualified"}
    return order, continuous, rows, qualification


def policy_from_path(path):
    require(path == POLICY_PATH, "only the one replacement V21 capacity policy may prepare")
    reader = cpu.BoundReader()
    policy = reader.json(bind(path))
    validate_policy(policy)
    validate_prior_failure(reader)
    fixed_rows(reader, policy)
    reader.unchanged()
    return policy, reader


def prepare(policy_path):
    policy, _ = policy_from_path(policy_path)
    programs = {"controller": bind(CONTROLLER), "worker": bind(WORKER)}
    _, _, rows, qualification = fixed_rows(cpu.BoundReader(), policy)
    selected_rows = [{"sampleId": row["sampleId"], "split": "train", "trainOrdinal": ordinal,
                      "image": row["image"], "conditionPack": row["conditionPack"]}
                     for (ordinal, _), row in zip(SUBJECTS, rows)]
    identity = "v21-train-only-capacity-" + cpu.sha(json.dumps({
        "policy": bind(policy_path), "programs": programs,
        "subjects": policy["selectedTrainRows"]}, sort_keys=True, separators=(",", ":")).encode())[:48]
    require(identity != PRIOR_FAILURE["runId"], "consumed v1 identity reuse prohibited")
    output = f"{OUTPUT_PARENT}/{identity}"
    package = {"schemaVersion": PACKAGE_SCHEMA, "experimentIdentity": identity,
        "outputRoot": output, "scope": SCOPE, "policy": bind(policy_path),
        "programBindings": programs, "datasetManifest": MANIFEST,
        "subjects": policy["selectedTrainRows"], "selectedRows": selected_rows,
        "resources": policy["resources"],
        "epochs": 256, "maxOptimizerSteps": 512,
        "initializationSeed": policy["model"]["initializationSeed"],
        "sourceQualification": qualification,
        "priorFailedExecution": PRIOR_FAILURE,
        "candidateContract": v21.CANDIDATE}
    directory = cpu.project_file(ROOT, output)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "package.json"
    if target.exists():
        require(json.loads(target.read_bytes()) == package, "package identity collision")
    else:
        require(not any(directory.iterdir()), "output already occupied")
        v21.write_exclusive(target, package)
    return bind(f"{output}/package.json")


def active_execution(package, package_binding, reader):
    output = package["outputRoot"]
    started = reader.json(bind(output + "/controller-started.json"))
    require(started.get("package") == package_binding, "controller did not bind package")
    previous = started["previousRegistry"]
    baseline = {"registryRevision": previous["revision"], "registrySha256": previous["sha256"]}
    raw = cpu.project_file(ROOT, v21.REGISTRY_PATH).read_bytes()
    registry = json.loads(raw)
    active = registry.get("activeExecution") or {}
    require(active.get("lock", {}).get("path") == output + "/execution-lock.json"
            and active.get("heartbeat") == {"path": output + "/heartbeat.json", "ttlSeconds": 120}
            and active.get("programLineage") == package["programBindings"]
            and registry.get("taskKind") == "bounded_train_only_learning_capacity_experiment",
            "registered capacity execution differs")
    lock = reader.json(active["lock"])
    heartbeat = json.loads(cpu.project_file(ROOT, active["heartbeat"]["path"]).read_bytes())
    # V21's existing live lock, heartbeat and exact supervisor ancestry checks.
    chain = v21.validate_active(registry, {"programBindings": package["programBindings"],
        "capabilityVersion": package["experimentIdentity"],
        "runId": package["experimentIdentity"], "packageId": package["experimentIdentity"]},
        package_binding, baseline, lock, heartbeat)
    terminal = reader.json(registry["terminalEvidence"])
    capsule = reader.json(registry["taskCapsule"])
    require(terminal.get("package") == package_binding
            and any(item.get("path") == package_binding["path"]
                    and item.get("sha256") == package_binding["sha256"]
                    for item in capsule.get("evidence", [])), "registry capsule/package differs")
    return chain


def authenticate(package_binding):
    reader = cpu.BoundReader()
    package = reader.json(package_binding)
    require(package.get("schemaVersion") == PACKAGE_SCHEMA and package.get("scope") == SCOPE,
            "wrong V21 capacity package")
    policy_path = package["policy"]["path"]
    policy = reader.json(package["policy"])
    validate_policy(policy)
    validate_prior_failure(reader)
    require(package["policy"] == bind(policy_path)
            and package["programBindings"] == {"controller": bind(CONTROLLER), "worker": bind(WORKER)}
            and package["datasetManifest"] == MANIFEST
            and package["subjects"] == policy["selectedTrainRows"]
            and package["resources"] == policy["resources"]
            and package["epochs"] == 256
            and package["maxOptimizerSteps"] == 512
            and package["initializationSeed"] == policy["model"]["initializationSeed"]
            and package["priorFailedExecution"] == PRIOR_FAILURE
            and package["candidateContract"] == v21.CANDIDATE,
            "package/policy differs")
    require(package_binding["path"] == package["outputRoot"] + "/package.json"
            and package["outputRoot"].startswith(OUTPUT_PARENT + "/")
            and package["experimentIdentity"] != PRIOR_FAILURE["runId"]
            and package["outputRoot"].split("/")[-1] == package["experimentIdentity"],
            "package output escaped experiment")
    order, continuous, rows, qualification = fixed_rows(reader, policy)
    require(package["sourceQualification"] == qualification, "release/source qualification changed")
    require(package["selectedRows"] == [{"sampleId": row["sampleId"], "split": "train",
            "trainOrdinal": ordinal, "image": row["image"], "conditionPack": row["conditionPack"]}
            for (ordinal, _), row in zip(SUBJECTS, rows)], "selected source pairing changed")
    chain = active_execution(package, package_binding, reader)
    reader.unchanged()
    return package, reader, order, continuous, rows, chain


def run(package_binding):
    package, reader, order, continuous, rows, chain = authenticate(package_binding)
    directory = cpu.project_file(ROOT, package["outputRoot"])
    require(not any((directory / name).exists() for name in
                    ("worker-started.json", "progress.json", "result.json", "final-step.pt")),
            "single-use worker already consumed")
    start = time.monotonic()
    counts = {"generator": 0, "discriminator": 0}
    state = {"experimentIdentity": package["experimentIdentity"], "gpuStarted": False,
             "trainingStarted": False, "optimizerSteps": counts,
             "validationContentRead": False, "challengeContentRead": False,
             "regressionContentRead": False, "checkpointSelectionAllowed": False,
             "stage4QualificationGranted": False, "checkpointPromotable": False,
             "runtimeFrameAllowed": False, "supervisorProcessChain": chain,
             "startedAtUtc": now()}
    v21.write_exclusive(directory / "worker-started.json", state)
    last_authority_check = 0.0
    last_thermal_check = 0.0

    def resource():
        nonlocal last_authority_check, last_thermal_check
        import torch
        require(time.monotonic() - start < package["resources"]["maxWallSeconds"], "wall time exhausted")
        if time.monotonic() - last_authority_check >= 10:
            active_execution(package, package_binding, reader)
            last_authority_check = time.monotonic()
        require(shutil.disk_usage(directory).free >= package["resources"]["minimumFreeDiskMiB"] * 1024**2,
                "free disk below floor")
        output_size = sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())
        require(output_size <= package["resources"]["maxOutputMiB"] * 1024**2, "output budget exhausted")
        free, total = torch.cuda.mem_get_info(0)
        require(free >= package["resources"]["minimumFreeVramMiB"] * 1024**2, "free VRAM below floor")
        observation = {"total": int(total), "reserved": int(torch.cuda.max_memory_reserved(0)),
                       "allocated": int(torch.cuda.max_memory_allocated(0)), "device_used": int(total - free)}
        state["memory"] = gpu.check_memory(**observation, fraction=package["resources"]["maxGpuMemoryFraction"])
        if time.monotonic() - last_thermal_check >= 10:
            thermal = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(thermal.returncode == 0 and int(thermal.stdout.strip().splitlines()[0])
                    < package["resources"]["maximumTemperatureC"], "GPU temperature unavailable or above ceiling")
            last_thermal_check = time.monotonic()

    def progress(phase):
        v21.atomic_json(directory / "progress.json", {**state, "phase": phase,
            "optimizerSteps": counts.copy(), "updatedAtUtc": now()}, replace=True)

    try:
        import torch
        from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import build_fresh_native_rgb_object_residual_v21_cpu
        from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
        from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective
        torch.set_num_threads(package["resources"]["cpuThreads"])
        torch.manual_seed(package["initializationSeed"])
        model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
        acceptance = reader.json(v21.CPU_REPORT)
        initial = {"Model": cpu.state_hash(model), "Critic": cpu.state_hash(critic)}
        require(all(initial[name] == acceptance["initial" + name + "StateSha256"] for name in initial),
                "fresh V21 initialization differs")
        samples = []
        identities = []
        for ordinal, row in zip((0, 43), rows):
            sample, identity = cpu.load_sample(reader, row, order, continuous)
            require(sample["split"] == "train" and sample["sampleId"] == row["sampleId"], "non-train tensor")
            identity["ordinal"] = ordinal
            samples.append(sample); identities.append(identity)
        v21.atomic_json(directory / "sample-identities.json", identities)
        reader.unchanged()
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        device = torch.device("cuda:0")
        torch.cuda.set_device(device)
        state["gpuStarted"] = True
        torch.cuda.manual_seed_all(package["initializationSeed"])
        free, total = torch.cuda.mem_get_info(device)
        require(free >= package["resources"]["minimumFreeVramMiB"] * 1024**2, "free VRAM below floor")
        fraction = min(package["resources"]["maxGpuMemoryFraction"],
                       (int(total * .7) - (total - free) - 64 * 1024 * 1024) / total)
        require(fraction > 0, "no allocator room")
        torch.cuda.set_per_process_memory_fraction(fraction, device)
        model.to(device); critic.to(device)
        resource()
        bound = {**samples[0], "conditions": samples[0]["conditions"].to(device),
                 "image": samples[0]["image"].to(device)}
        model.eval(); critic.eval()
        critic.requires_grad_(False)
        require_critic_mode(critic, trainable=False)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            predicted = model(bound["conditions"][None], bound["objectInstanceTable"])
            probe_loss, _ = train_structured_object_objective(critic, predicted, bound,
                bound["objectInstanceTable"], order)
        probe_loss.backward()
        gpu.gradient_facts(model, "cuda")
        require(all(parameter.grad is None for parameter in critic.parameters()),
                "generator probe leaked gradients into frozen critic")
        model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
        critic.requires_grad_(True)
        require_critic_mode(critic, trainable=True)
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            detached = model(bound["conditions"][None], bound["objectInstanceTable"])
        with torch.autocast("cuda", dtype=torch.bfloat16):
            discriminator_probe, _ = gpu.detached_discriminator_objective(critic, detached, bound)
        discriminator_probe.backward()
        gpu.gradient_facts(critic, "cuda")
        require(all(parameter.grad is None for parameter in model.parameters()),
                "discriminator probe leaked gradients into generator")
        model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
        critic.requires_grad_(False)
        require(initial == {"Model": cpu.state_hash(model), "Critic": cpu.state_hash(critic)},
                "zero-update GPU probe changed state")
        resource()
        state["zeroUpdateGpuProbePassed"] = True
        observations = []
        image_artifacts = []

        def rgb_png(rgb):
            from PIL import Image
            import numpy as np
            array = (rgb.detach().float().cpu().clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
            buffer = io.BytesIO()
            Image.fromarray(array, mode="RGB").save(buffer, format="PNG")
            return buffer.getvalue()

        def observe(step):
            from PIL import Image
            from ai_painter.complete_world.object_instance_supervision_cpu import _crop, iter_train_object_supervision
            model.eval(); critic.eval()
            require_critic_mode(critic, trainable=False)
            records = []
            with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                for sample_index, sample in enumerate(samples):
                    train_bound = {**sample, "conditions": sample["conditions"].to(device),
                                   "image": sample["image"].to(device)}
                    prediction = model(train_bound["conditions"][None], sample["objectInstanceTable"])
                    loss, parts = train_structured_object_objective(critic, prediction, train_bound,
                        sample["objectInstanceTable"], order)
                    require(bool(torch.isfinite(loss)), "nonfinite train observation")
                    actual = prediction[0].float().cpu()
                    target = sample["image"]
                    masks = {role: sample["conditions"][order.index(role)] > .5 for role in
                             ("object_footprints", "object_tree", "object_rock", "object_vegetation")}
                    role_mae = {role: float((actual[:, mask] - target[:, mask]).abs().mean())
                                if bool(mask.any()) else None for role, mask in masks.items()}
                    correlations = {role: float(parts[role + "LumaCorrelation"])
                                    if role + "LumaCorrelation" in parts else None for role in masks}
                    instances = []
                    for supervision in iter_train_object_supervision(sample, sample["objectInstanceTable"], order):
                        patch, _ = _crop(actual, supervision.top, supervision.left, 32)
                        support = supervision.support_mask[0] > .5
                        require(bool(support.any()), "empty instance support")
                        instances.append({"value": supervision.instance_value, "kind": supervision.kind,
                            "role": supervision.role, "supportPixels": int(support.sum()),
                            "supportRgbMae": float((patch[:, support] - supervision.target_rgb[:, support]).abs().mean())})
                    record = {"sampleId": sample["sampleId"], "split": "train", "trainOrdinal": (0, 43)[sample_index],
                        "trainObjective": float(loss), "rgbMae": float((actual - target).abs().mean()),
                        "objectRoleRgbMae": role_mae, "objectRoleLumaCorrelation": correlations,
                        "instanceSupportErrors": instances,
                        "fixedSeedInferenceSha256": cpu.tensor_hash(actual)}
                    if step in (0, 512):
                        prefix = f"observation-step-{step:03d}-train-{(0, 43)[sample_index]:02d}"
                        prediction_path = package["outputRoot"] + "/" + prefix + "-prediction.png"
                        v21.atomic_bytes(cpu.project_file(ROOT, prediction_path), rgb_png(actual))
                        image_artifacts.append(prediction_path)
                        record["predictionPng"] = bind(prediction_path)
                        if step == 512:
                            target_image = Image.open(io.BytesIO(rgb_png(target)))
                            first_image = Image.open(io.BytesIO(cpu.project_file(ROOT,
                                package["outputRoot"] + f"/observation-step-000-train-{(0, 43)[sample_index]:02d}-prediction.png").read_bytes()))
                            last_image = Image.open(io.BytesIO(rgb_png(actual)))
                            sheet = Image.new("RGB", (768, 192))
                            sheet.paste(target_image, (0, 0)); sheet.paste(first_image, (256, 0)); sheet.paste(last_image, (512, 0))
                            sheet_path = package["outputRoot"] + f"/train-{(0, 43)[sample_index]:02d}-target-step0-step512.png"
                            stream = io.BytesIO(); sheet.save(stream, format="PNG")
                            v21.atomic_bytes(cpu.project_file(ROOT, sheet_path), stream.getvalue())
                            image_artifacts.append(sheet_path)
                            record["targetStep0FinalContactSheetPng"] = bind(sheet_path)
                    records.append(record)
            observations.append({"optimizerStep": step, "trainOnly": records})
            model.train(); critic.train()
            resource()

        observe(0)
        before = [row["fixedSeedInferenceSha256"] for row in observations[0]["trainOnly"]]
        args = {"betas": tuple(v21.OPTIMIZER_PLAN["betas"]), "eps": v21.OPTIMIZER_PLAN["eps"],
                "weight_decay": v21.OPTIMIZER_PLAN["weightDecay"], "foreach": False, "fused": False}
        generator_optimizer = torch.optim.AdamW(model.parameters(), lr=.0001, **args)
        critic_optimizer = torch.optim.AdamW(critic.parameters(), lr=.0001, **args)
        model.train(); critic.train()
        state["trainingStarted"] = True
        for epoch in range(package["epochs"]):
            for sample in samples:
                resource()
                bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
                generator_optimizer.zero_grad(set_to_none=True)
                critic.requires_grad_(True)
                require_critic_mode(critic, trainable=True)
                with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                    detached = model(bound["conditions"][None], sample["objectInstanceTable"])
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    d_loss, _ = gpu.detached_discriminator_objective(critic, detached, bound)
                v21.update_network(critic_optimizer, d_loss, critic, bound, "discriminator",
                                   counts, package["maxOptimizerSteps"], resource)
                require(all(parameter.grad is None for parameter in model.parameters()),
                        "discriminator update leaked generator gradients")
                critic_optimizer.zero_grad(set_to_none=True)
                critic.requires_grad_(False)
                require_critic_mode(critic, trainable=False)
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    predicted = model(bound["conditions"][None], sample["objectInstanceTable"])
                    g_loss, _ = train_structured_object_objective(critic, predicted, bound,
                        sample["objectInstanceTable"], order)
                v21.update_network(generator_optimizer, g_loss, model, bound, "generator",
                                   counts, package["maxOptimizerSteps"], resource)
                require(all(parameter.grad is None for parameter in critic.parameters()),
                        "generator update leaked frozen critic gradients")
                progress("training")
                if counts["generator"] in (128, 256, 512):
                    observe(counts["generator"])
        require(counts == {"generator": 2 * package["epochs"], "discriminator": 2 * package["epochs"]},
                "final optimizer counts differ")
        model.eval(); critic.eval()
        final = {"Model": cpu.state_hash(model), "Critic": cpu.state_hash(critic)}
        after = [row["fixedSeedInferenceSha256"] for row in observations[-1]["trainOnly"]]
        require([row["optimizerStep"] for row in observations] == [0, 128, 256, 512]
                and all(initial[name] != final[name] for name in initial),
                "learning observations or state updates differ")
        payload = {"schemaVersion": "ai-painter-v21-train-only-final-step-checkpoint-v1",
            "experimentIdentity": package["experimentIdentity"], "package": package_binding,
            "optimizerSteps": counts.copy(), "initialStateSha256": initial, "finalStateSha256": final,
            "modelState": {k: t.detach().cpu().clone() for k, t in model.state_dict().items()},
            "criticState": {k: t.detach().cpu().clone() for k, t in critic.state_dict().items()}}
        stream = io.BytesIO(); torch.save(payload, stream)
        v21.atomic_bytes(directory / "final-step.pt", stream.getvalue())
        saved = torch.load(io.BytesIO((directory / "final-step.pt").read_bytes()),
                           map_location="cpu", weights_only=True)
        reload_model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=order)
        reload_critic = build_conditional_texture_discriminator()
        reload_model.load_state_dict(saved["modelState"], strict=True)
        reload_critic.load_state_dict(saved["criticState"], strict=True)
        exact_reload = (cpu.state_hash(reload_model) == final["Model"]
                        and cpu.state_hash(reload_critic) == final["Critic"])
        require(exact_reload, "final checkpoint reload differs")
        resource()
        evidence = ["worker-started.json", "sample-identities.json", "final-step.pt"]
        result = {**state, "status": "experiment_executed_not_visual_qualified",
            "checkpointReloadExact": True, "optimizerSteps": counts.copy(),
            "initialStateSha256": initial, "finalStateSha256": final,
            "fixedSeedTrainInferenceBefore": before, "fixedSeedTrainInferenceAfter": after,
            "trainOnlyObservations": observations,
            "checkpoint": bind(package["outputRoot"] + "/final-step.pt"),
            "artifacts": [bind(package["outputRoot"] + "/" + name) for name in evidence]
                         + [bind(path) for path in image_artifacts],
            "completedAtUtc": now()}
        v21.atomic_json(directory / "result.json", result)
        return result
    except BaseException as error:
        v21.atomic_json(directory / "worker-failure.json", {**state, "status": "experiment_failed_closed",
            "optimizerSteps": counts.copy(), "error": repr(error), "failedAtUtc": now()})
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "run"))
    parser.add_argument("--policy")
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.mode == "prepare":
        require(args.policy and not args.package and not args.sha256, "prepare requires only --policy")
        print(json.dumps(prepare(args.policy)))
    else:
        require(args.package and args.sha256 and not args.policy, "run requires bound package")
        run({"path": args.package, "sha256": args.sha256})


if __name__ == "__main__":
    main()

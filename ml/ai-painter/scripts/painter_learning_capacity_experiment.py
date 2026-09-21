"""Bounded train-only experiment; never a formal Stage4 or publication entry.

The controller owns the registered execution, timeout and heartbeat. This worker
reuses V2 model/loss functions, but has its own immutable purpose and checkpoint
schema. It cannot load or select a failed Denoiser, consume holdouts, or publish.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from contextlib import contextmanager
from datetime import datetime, timezone
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time
import traceback

from ai_painter.complete_world.split_release import (
    SplitReleaseDataset, bound_json, canonical_bytes, digest, project_file, read_bound,
)

POLICY = "data/ai-painter/system-governance/ai-painter-learning-capacity-experiment-policy-v1.json"
FOLLOWUP_POLICY = "data/ai-painter/system-governance/ai-painter-learning-capacity-experiment-policy-v2.json"
BUDGET_POLICY = "data/ai-painter/system-governance/ai-painter-learning-capacity-experiment-policy-v3.json"
SCHEMA = "ai-painter-learning-capacity-experiment-package-v1"
CHECKPOINT_SCHEMA = "ai-painter-learning-capacity-experiment-checkpoint-v1"
PROGRAMS = (
    "ml/ai-painter/scripts/painter_learning_capacity_experiment.py",
    "scripts/run-ai-painter-learning-capacity-experiment.mjs",
    "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
    "ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py",
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
    "ml/ai-painter/src/ai_painter/complete_world/diffusion.py",
    "ml/ai-painter/tests/test_learning_capacity_experiment.py",
    "src/server/ai-painter-current-execution-registry.mjs",
    "ml/ai-painter/scripts/diagnose_learning_capacity_noise.py",
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@contextmanager
def exact_inference_runtime(torch):
    """Require deterministic inference, without changing the training objective."""
    enabled = torch.are_deterministic_algorithms_enabled()
    warn_only = torch.is_deterministic_algorithms_warn_only_enabled()
    benchmark = torch.backends.cudnn.benchmark
    deterministic = torch.backends.cudnn.deterministic
    try:
        torch.use_deterministic_algorithms(True, warn_only=False)
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
        yield
    finally:
        torch.use_deterministic_algorithms(enabled, warn_only=warn_only)
        torch.backends.cudnn.benchmark = benchmark
        torch.backends.cudnn.deterministic = deterministic


def file_binding(root, logical):
    return {"path": logical, "sha256": digest(project_file(root, logical).read_bytes())}


@contextmanager
def preserve_training_random_state():
    """Extra observations must not change future train noise or loader seeds."""
    import random
    import numpy as np
    import torch
    python_state, numpy_state = random.getstate(), np.random.get_state()
    devices = list(range(torch.cuda.device_count())) if torch.cuda.is_initialized() else []
    try:
        with torch.random.fork_rng(devices=devices):
            yield
    finally:
        random.setstate(python_state)
        np.random.set_state(numpy_state)


def validate_followup_policy(policy, parent):
    require(policy["schemaVersion"] == "ai-painter-learning-capacity-experiment-policy-v2", "followup policy schema mismatch")
    require(set(policy) == set(parent) | {"parentPolicy", "referenceExperiment", "diagnosisEvidence", "comparison"}, "followup policy fields changed")
    for key in parent:
        if key not in {"schemaVersion", "purpose", "training"}:
            require(policy[key] == parent[key], f"followup changed frozen boundary: {key}")
    require(policy["training"] == {**parent["training"], "epochs": 300, "timestepCoverageStride": 137,
            "observationSteps": [60, 300, 600], "preserveTrainingRandomStateDuringObservation": True}, "followup training budget changed")
    require(policy["comparison"]["formalQualificationAllowed"] is False, "comparison cannot grant qualification")


def timestep_coverage(config, epochs=30):
    from train_ai_assisted_conditional_denoiser import training_timesteps
    values = [[int(training_timesteps(config, epoch, index, 2, 1, int(config["diffusionSteps"]), "cpu").item())
               for epoch in range(epochs)] for index in range(2)]
    return [{"minimum": min(row), "maximum": max(row), "unique": len(set(row)),
             "decileCounts": [sum(t * 10 // int(config["diffusionSteps"]) == band for t in row) for band in range(10)]}
            for row in values]


def validate_budget_policy(policy, parent):
    require(policy["schemaVersion"] == "ai-painter-learning-capacity-experiment-policy-v3", "budget policy schema mismatch")
    require(parent["schemaVersion"] == "ai-painter-learning-capacity-experiment-policy-v2", "budget parent schema mismatch")
    require(set(policy) == set(parent), "budget policy fields changed")
    mutable = {"schemaVersion", "purpose", "training", "parentPolicy", "referenceExperiment", "diagnosisEvidence", "comparison"}
    for key in parent:
        if key not in mutable:
            require(policy[key] == parent[key], f"budget changed frozen boundary: {key}")
    require(policy["training"] == {**parent["training"], "epochs": 3000, "observationSteps": [600, 1800, 3600, 6000]}, "6000-step budget changed")
    require(policy["comparison"]["formalQualificationAllowed"] is False, "comparison cannot grant qualification")


def save_json(path, value, *, mutable=False):
    data = canonical_bytes(value) + b"\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    if mutable:
        temporary = path.with_name(path.name + ".tmp")
        with temporary.open("wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    else:
        with path.open("xb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())


def selected_rows(source, ids):
    require(len(ids) == 2 and len(set(ids)) == len(ids), "exactly two unique selected train samples required")
    rows = []
    for identity in ids:
        matches = [r for r in source["samples"] if r["sampleId"] == identity]
        require(len(matches) == 1 and matches[0]["split"] == "train", "non-train or missing sample")
        rows.append(deepcopy(matches[0]))
    return rows


def prepare(root, policy_path=POLICY):
    """Read metadata and selected train content only; do not import CUDA/model."""
    from ai_painter_stage4_semantic_transport_v2_trainer_support import (
        build_stage4_semantic_transport_v2_cpu_inactive_config,
        validate_stage4_semantic_transport_v2_trainer_contract,
        FORMAL_OBJECTIVE_CONTRACT_PATH,
    )
    require(policy_path in (POLICY, FOLLOWUP_POLICY, BUDGET_POLICY), "unregistered experiment policy")
    policy_binding = file_binding(root, policy_path)
    policy = bound_json(root, policy_binding)
    followup = policy_path != POLICY
    budget_followup = policy_path == BUDGET_POLICY
    if budget_followup:
        require(policy["parentPolicy"]["path"] == FOLLOWUP_POLICY, "budget parent policy mismatch")
        parent = bound_json(root, policy["parentPolicy"])
        require(parent["parentPolicy"]["path"] == POLICY, "budget ancestor policy mismatch")
        validate_followup_policy(parent, bound_json(root, parent["parentPolicy"]))
        validate_budget_policy(policy, parent)
    elif followup:
        require(policy["parentPolicy"]["path"] == POLICY, "followup parent policy mismatch")
        validate_followup_policy(policy, bound_json(root, policy["parentPolicy"]))
    require(policy["scope"] == "train_only_learning_capacity_no_generalization_claim", "experiment scope changed")
    require(policy["resolution"] == [256, 192], "experiment resolution changed")
    require(policy["nonTrainContentAllowed"] is False, "non-train content forbidden")
    require(not any(policy["qualification"][key] for key in (
        "formalDatasetQualified", "formalGpuQualified", "formalSmokePassed", "formalTrainingAllowed",
        "checkpointPromotable", "formalInferenceEligible", "runtimeFrameAllowed", "worldEntryAllowed",
    )), "experiment cannot grant formal qualification")
    manifest = bound_json(root, policy["sourceManifest"])
    source = bound_json(root, manifest["sourceIndex"])
    membership = bound_json(root, manifest["splits"]["train"])
    rows = selected_rows(source, policy["sampleIds"])
    require(all(r["sampleId"] in membership["sampleIds"] for r in rows), "selected train membership mismatch")
    review = bound_json(root, policy["sourceReview"])
    receipts = [policy_binding, policy["sourceManifest"], manifest["sourceIndex"], manifest["splits"]["train"], policy["sourceReview"]]
    if budget_followup:
        receipts.append(parent["parentPolicy"])
    import numpy as np
    from PIL import Image
    for row in rows:
        evidence = [r for r in review["retainedSampleMatrix"] if r["sampleId"] == row["sampleId"]]
        require(len(evidence) == 1 and evidence[0]["rgbProxyPassed"] is True
                and evidence[0]["ecologyReproducesCurrentRule"] is True, "known train sample rejection")
        for key in ("image", "conditionPack", "contribution", "regionSource", "sourceRecord"):
            read_bound(root, row[key])
            receipts.append(row[key])
        record = bound_json(root, row["sourceRecord"])
        require(record["recordId"] == row["sampleId"] and not record["blockReasons"], "source record blocked")
        require(record["aiAssistedColdStartEligible"] is True and record["independentTrainingEligible"] is False,
                "AI-assisted provenance must not be relabeled independent")
        require(record["originalImage"]["sha256"] == row["image"]["sha256"], "original RGB mismatch")
        require(record["conditionBinding"]["conditionPackPath"] == row["conditionPack"]["path"], "condition binding mismatch")
        require(record["conditionBinding"]["realEarthRegionId"] == "earth:thailand:sakaerat-wang-nam-khiao:mvp-v1", "region mismatch")
        rights = record.get("copiedArtifacts", {}).get("rights", [])
        require(len(rights) >= 2, "source rights and normalization evidence missing")
        for binding in rights:
            read_bound(root, binding)
            receipts.append({k: binding[k] for k in ("path", "sha256")})
        pack = bound_json(root, row["conditionPack"])
        require([c["id"] for c in pack["channels"]] == manifest["identityPayload"]["channelOrder"], "condition order mismatch")
        for binding, mode in [(row["image"], "RGB"), *[(c, "L") for c in pack["channels"]]]:
            data = read_bound(root, binding)
            with Image.open(io.BytesIO(data)) as image:
                require(image.size == (1024, 768) and image.mode == mode, "native image/condition shape or mode mismatch")
                require(np.asarray(image).dtype == np.uint8, "image dtype mismatch")
            receipts.append({k: binding[k] for k in ("path", "sha256")})
    foundation = bound_json(root, policy["foundationContract"])
    require(foundation["lineageInterpretation"]["failedDenoiserCheckpoint"] is False, "failed Denoiser asset forbidden")
    require(foundation["sourceManifest"]["denoiserTrained"] is False, "foundation includes Denoiser training")
    for binding in (policy["foundationContract"], foundation["checkpoint"], foundation["sourceManifest"]):
        read_bound(root, binding)
        receipts.append({k: binding[k] for k in ("path", "sha256")})
    config = build_stage4_semantic_transport_v2_cpu_inactive_config(root)
    validate_stage4_semantic_transport_v2_trainer_contract(config, root=root)
    # This is support/architecture reuse, NOT activation of the CPU-only parent.
    objective_binding = file_binding(root, FORMAL_OBJECTIVE_CONTRACT_PATH)
    objective = bound_json(root, objective_binding)
    receipts.append(objective_binding)
    model_boundary = objective["modelBoundary"]
    for key in ("autoencoderSourceModelId", "autoencoderSourceArchitectureVersion", "autoencoderRequiredCheckpointProvenance"):
        config[key] = model_boundary[key]
    config["predictionTarget"] = "velocity"
    config["training"]["batchSize"] = 1
    config["training"]["seed"] = policy["training"]["seed"]
    comparison_evidence = None
    if followup:
        reference = bound_json(root, policy["referenceExperiment"])
        diagnosis = bound_json(root, policy["diagnosisEvidence"])
        require(reference["status"] == "experiment_executed_not_visual_qualified"
                and reference["selectedSampleIds"] == policy["sampleIds"], "reference experiment mismatch")
        diagnosis_status = "cpu_timestep_diagnosis_completed_not_visual_qualified" if budget_followup else "cpu_noise_diagnosis_completed_not_visual_qualified"
        require(diagnosis["status"] == diagnosis_status
                and diagnosis["sourceResult"] == policy["referenceExperiment"], "diagnosis reference mismatch")
        reference_package = bound_json(root, diagnosis["sourcePackage"])
        require(reference_package["experimentIdentity"] == reference["experimentIdentity"], "reference package mismatch")
        reference_payload = {k: v for k, v in reference_package.items() if k != "experimentIdentity"}
        require(reference_package["experimentIdentity"] == "painter-learning-capacity-" + digest(canonical_bytes(reference_payload)), "reference payload mismatch")
        if budget_followup:
            require(reference["optimizerSteps"] == 600, "budget reference must be the completed 600-step experiment")
            config["training"]["timestepCoverageStride"] = policy["training"]["timestepCoverageStride"]
        require(reference_package["config"] == config and reference_package["selectedRows"] == rows
                and reference_package["foundation"] == foundation["checkpoint"], "comparison changed model, data, Loss or initialization config")
        original_coverage = timestep_coverage(config)
        config["training"]["timestepCoverageStride"] = policy["training"]["timestepCoverageStride"]
        corrected_coverage = timestep_coverage(config)
        require(all(all(count > 0 for count in row["decileCounts"]) for row in corrected_coverage), "short experiment misses timestep bands")
        comparison_evidence = {"previous60StepTimeCoverage": original_coverage, "current60StepTimeCoverage": corrected_coverage,
                               "modelLossLearningRateDataUnchanged": True, "previousCheckpointLoadedForTraining": False,
                               "referenceInitialDenoiserStateSha256": reference["initialDenoiserStateSha256"],
                               "limits": policy["comparison"]}
        receipts.extend([policy["parentPolicy"], policy["referenceExperiment"], policy["diagnosisEvidence"], diagnosis["sourcePackage"]])
    programs = [file_binding(root, logical) for logical in PROGRAMS]
    support = bound_json(root, config["training"]["stage4SemanticTransportV2TrainerSupport"] | {
        "path": config["training"]["stage4SemanticTransportV2TrainerSupport"]["contractPath"],
        "sha256": config["training"]["stage4SemanticTransportV2TrainerSupport"]["contractSha256"],
    })
    programs.extend(support["programBindings"].values())
    receipts.extend(programs)
    receipts.extend(file_binding(root, logical) for logical in (
        "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
        "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
        "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json",
    ))
    for receipt in receipts:
        require(all(other["sha256"] == receipt["sha256"] for other in receipts if other["path"] == receipt["path"]),
                "conflicting input identities")
    unique = {r["path"]: {k: r[k] for k in ("path", "sha256")} for r in receipts}
    for binding in unique.values():
        read_bound(root, binding)
    payload = {
        "schemaVersion": SCHEMA, "policy": policy_binding, "purpose": policy["scope"],
        "sourceDatasetIdentity": manifest["datasetReleaseIdentity"], "selectedRows": rows,
        "sourceManifest": policy["sourceManifest"], "inputIdentity": manifest["identityPayload"],
        "foundation": foundation["checkpoint"], "foundationLimitations": policy["foundationLimitations"],
        "config": config, "programBindings": programs, "inputReceipts": list(unique.values()),
        "training": policy["training"], "resources": policy["resources"], "resolution": policy["resolution"],
        "qualification": policy["qualification"],
    }
    if comparison_evidence is not None:
        payload["comparisonEvidence"] = comparison_evidence
    identity = "painter-learning-capacity-" + digest(canonical_bytes(payload))
    package = {**payload, "experimentIdentity": identity}
    output = project_file(root, policy["outputRoot"] + "/" + identity)
    output.mkdir(parents=True, exist_ok=True)
    target = output / "experiment.json"
    data = canonical_bytes(package) + b"\n"
    if target.exists():
        require(target.read_bytes() == data, "immutable experiment package conflict")
    else:
        save_json(target, package)
    return file_binding(root, policy["outputRoot"] + "/" + identity + "/experiment.json")


class ExperimentDataset(SplitReleaseDataset):
    """Selected train rows with a distinct, non-release experiment identity.

    Reuse the existing typed tensor reader, never its formal release qualification.
    No non-train image is opened and no full-train normalization is computed.
    """
    def __init__(self, root, package):
        require(package["schemaVersion"] == SCHEMA, "not an experiment package")
        require(package["resolution"] == [256, 192], "experiment resolution mismatch")
        self._rows = selected_rows({"samples": package["selectedRows"]}, [r["sampleId"] for r in package["selectedRows"]])
        self.root, self.split, self.image_size = root.resolve(), "train", (256, 192)
        self.manifest = {"datasetReleaseIdentity": package["experimentIdentity"], "identityPayload": package["inputIdentity"]}
        self.selection_sha256 = digest(canonical_bytes(self._rows))


def verify_package(root, binding):
    package = bound_json(root, binding)
    require(package["schemaVersion"] == SCHEMA, "experiment schema mismatch")
    payload = {k: v for k, v in package.items() if k != "experimentIdentity"}
    require(package["experimentIdentity"] == "painter-learning-capacity-" + digest(canonical_bytes(payload)), "experiment identity mismatch")
    policy = bound_json(root, package["policy"])
    require(binding["path"] == policy["outputRoot"] + "/" + package["experimentIdentity"] + "/experiment.json", "experiment output namespace mismatch")
    require(package["training"] == policy["training"] and package["resources"] == policy["resources"], "experiment budget mismatch")
    require([r["sampleId"] for r in package["selectedRows"]] == policy["sampleIds"], "experiment sample scope mismatch")
    for receipt in package["inputReceipts"]:
        read_bound(root, receipt)
    require(prepare(root, package["policy"]["path"]) == binding, "package does not reproduce the current experimental policy and inputs")
    return package


def validate_experiment_checkpoint(checkpoint, package):
    require(checkpoint.get("schemaVersion") == CHECKPOINT_SCHEMA, "not an experiment checkpoint")
    require(checkpoint.get("experimentIdentity") == package["experimentIdentity"], "checkpoint experiment mismatch")
    require(checkpoint.get("checkpointPromotable") is False and checkpoint.get("formalInferenceEligible") is False,
            "experiment checkpoint must not be promoted")
    require(checkpoint.get("selectedSampleIds") == [r["sampleId"] for r in package["selectedRows"]], "checkpoint selection mismatch")


def verify_controller_process(lease, registry, parent_pid):
    # Windows venv python.exe is a redirector: the interpreter may be its child.
    # Both allowed PIDs come from the controller's actual spawn, not discovery.
    require(parent_pid in {lease["workerParentPid"], lease["workerLauncherPid"]}, "worker needs its registered controller or exact venv launcher")
    require(registry["runId"] == lease["experimentIdentity"]
            and registry["activeExecution"]["processId"] == lease["workerParentPid"]
            and registry["registryRevision"] == lease["registryRevision"], "worker registry identity mismatch")


def execute(root, binding):
    package = verify_package(root, binding)
    output = project_file(root, binding["path"]).parent
    lease = json.loads((output / "controller-lease.json").read_text(encoding="utf-8"))
    require(lease["experimentIdentity"] == package["experimentIdentity"], "worker experiment identity mismatch")
    registry_bytes = project_file(root, ".runtime/ai-painter/current-execution-registry/current.json").read_bytes()
    require(digest(registry_bytes) == lease["registrySha256"], "registered controller lease is stale")
    registry = json.loads(registry_bytes)
    verify_controller_process(lease, registry, os.getppid())
    require(not (output / "worker-started.json").exists(), "experiment cannot restart or overwrite")
    save_json(output / "worker-started.json", {"startedAtUtc": now(), "processId": os.getpid(), "package": binding})
    started = time.perf_counter()
    gpu_started = False
    training_started = False
    steps = 0
    try:
        import torch
        from torch.utils.data import DataLoader
        from ai_painter.complete_world.model import build_complete_world_system
        from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
        from ai_painter_stage4_semantic_transport_v2_trainer_support import (
            validate_stage4_semantic_transport_v2_autoencoder_boundary as frozen,
            stage4_semantic_transport_v2_optimizer_parameters,
        )
        from train_ai_assisted_conditional_denoiser import (
            build_diffusion_schedule, compute_latent_normalization, train_epoch,
            evaluate_velocity_prediction, set_seed, normalize_latent, denormalize_latent,
            add_noise, velocity_target, predict_and_measure, inference_timesteps,
            deterministic_velocity_step, decode_final_visible_rgb, save_tensor_png, recover_from_velocity,
        )
        torch.set_num_threads(package["resources"]["cpuThreads"])
        config = package["config"]
        set_seed(package["training"]["seed"])
        dataset = ExperimentDataset(root, package)
        loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
        for item in dataset:
            require(tuple(item["image"].shape) == (3, 192, 256) and tuple(item["conditions"].shape) == (23, 192, 256), "tensor shape invalid")
            require(bool(torch.isfinite(item["image"]).all()) and bool(torch.isfinite(item["conditions"]).all()), "nonfinite input")
        require(shutil.disk_usage(output).free >= package["resources"]["minimumFreeDiskMiB"] * 1024**2, "insufficient output disk space")
        require(torch.cuda.is_available(), "real CUDA unavailable")
        device = torch.device("cuda")
        free, total = torch.cuda.mem_get_info()
        require(free >= package["resources"]["minimumFreeVramMiB"] * 1024**2, "insufficient free VRAM")
        torch.cuda.set_per_process_memory_fraction(package["resources"]["cudaMemoryFraction"])
        torch.cuda.reset_peak_memory_stats()
        gpu_started = True
        model = build_complete_world_system(config).to(device)
        # Exact owned source bytes are checked before safe state-dict loading.
        checkpoint = torch.load(io.BytesIO(read_bound(root, package["foundation"])), map_location="cpu", weights_only=True)
        require(checkpoint.get("denoiserTrained") is False and checkpoint.get("trainingStage") == "autoencoder_warmup_only", "foundation not AE-only")
        require(checkpoint.get("ownership") == "project_owned_architecture_ai_assisted_cold_start_weights"
                and checkpoint.get("thirdPartyWeightsLoaded") is False and checkpoint.get("upstreamModelIds") == [], "foundation role mismatch")
        require(checkpoint.get("schemaVersion") == config["autoencoderRequiredCheckpointProvenance"]
                and checkpoint.get("modelId") == config["autoencoderSourceModelId"]
                and checkpoint.get("architectureVersion") == config["autoencoderSourceArchitectureVersion"], "foundation identity mismatch")
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
        del checkpoint
        frozen_before = frozen(model, phase="loaded")
        initial_state = state_hash(model.denoiser.state_dict())
        if "comparisonEvidence" in package:
            require(initial_state == package["comparisonEvidence"]["referenceInitialDenoiserStateSha256"], "reference random initialization differs")
        normalization = compute_latent_normalization(model, dataset, device)
        diffusion = build_diffusion_schedule(config, device)

        def limits():
            require(time.perf_counter() - started < package["resources"]["maxWallSeconds"], "experiment timeout")
            require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < package["resources"]["maxOutputMiB"] * 1024**2, "output budget exceeded")
            temperature = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(temperature.returncode == 0 and int(temperature.stdout.strip().splitlines()[0]) < package["resources"]["maximumTemperatureC"], "GPU temperature unavailable or exceeds budget")

        def progress(phase, **details):
            value = {"experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(), "phase": phase,
                     "optimizerSteps": steps, "elapsedSeconds": time.perf_counter() - started,
                     "gpuStarted": gpu_started, "trainingStarted": training_started, **details}
            save_json(output / "progress.json", value, mutable=True)
            print(json.dumps(value), flush=True)

        def render(index, filename, *, conditions_override=None, base_filename=None, trajectory=None):
            item = dataset[index]
            conditions = item["conditions"].unsqueeze(0).to(device) if conditions_override is None else conditions_override
            generator = torch.Generator(device=device).manual_seed(package["training"]["seed"] + 3000 + index)
            latent = torch.randn((1, config["latentChannels"], 48, 64), device=device, generator=generator)
            with torch.no_grad(), exact_inference_runtime(torch):
                for step_index, timestep in enumerate(inference_timesteps(config["diffusionSteps"], config["inferenceSteps"], device)):
                    timestep_batch = torch.full((1,), int(timestep.item()), device=device, dtype=torch.long)
                    velocity = model.predict_velocity(latent, timestep_batch, conditions)
                    grid = inference_timesteps(config["diffusionSteps"], config["inferenceSteps"], device)
                    previous = int(grid[step_index + 1].item()) if step_index + 1 < len(grid) else -1
                    if trajectory is not None and step_index in (0, len(grid) // 4, len(grid) // 2, 3 * len(grid) // 4, len(grid) - 1):
                        from diagnose_learning_capacity_noise import image_metrics
                        predicted_clean, _ = recover_from_velocity(latent, velocity, int(timestep.item()), diffusion["alphasCumulative"])
                        prediction = decode_final_visible_rgb(model, denormalize_latent(predicted_clean, normalization), conditions, config).clamp(0, 1)
                        trajectory.append({"timestep": int(timestep.item()), "rgb": image_metrics(torch, prediction.cpu(), item["image"][None])})
                    latent = deterministic_velocity_step(latent, velocity, int(timestep.item()), previous, diffusion["alphasCumulative"])
                if base_filename is not None:
                    rgb, evidence = decode_final_visible_rgb(model, denormalize_latent(latent, normalization), conditions, config,
                        return_stage4_semantic_responsibility_evidence=True)
                    save_tensor_png(evidence["baseDecodedRgb"][0].clamp(0, 1), output / base_filename)
                    rgb = rgb.clamp(0, 1)
                else:
                    rgb = decode_final_visible_rgb(model, denormalize_latent(latent, normalization), conditions, config).clamp(0, 1)
            require(bool(torch.isfinite(rgb).all()), "nonfinite inference output")
            save_tensor_png(rgb[0], output / filename)
            return rgb.detach().cpu()

        progress("readonly_gpu_probe")
        limits()
        item = dataset[0]
        target = item["image"].unsqueeze(0).to(device)
        conditions = item["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            latent = normalize_latent(model.autoencoder.encode(target), normalization)
        timestep = torch.full((1,), 500, device=device, dtype=torch.long)
        noise = torch.randn_like(latent)
        metrics = predict_and_measure(model, add_noise(latent, noise, timestep, diffusion["alphasCumulative"]),
                                      velocity_target(latent, noise, timestep, diffusion["alphasCumulative"]), latent, timestep,
                                      diffusion["alphasCumulative"], conditions, config, target, normalization)
        loss = metrics["compositeLoss"]
        require(bool(torch.isfinite(loss)), "nonfinite GPU probe loss")
        loss.backward()
        trainable = stage4_semantic_transport_v2_optimizer_parameters(model)
        gradient_count = sum(p.grad is not None and bool(torch.isfinite(p.grad).all()) and bool(p.grad.abs().sum() > 0) for p in trainable)
        require(gradient_count > 0, "GPU probe has no finite nonzero gradients")
        require(all(p.grad is None or bool(torch.isfinite(p.grad).all()) for p in trainable), "nonfinite GPU probe gradient")
        require(state_hash(model.denoiser.state_dict()) == initial_state, "readonly GPU probe changed weights")
        frozen(model, phase="before_training", expected_state_sha256=frozen_before["stateSha256"])
        save_json(output / "gpu-probe.json", {"status": "experiment_no_update_gpu_probe_passed", "optimizerCreated": False,
                  "weightsChanged": False, "gradientParameterCount": gradient_count, "torch": torch.__version__,
                  "cuda": torch.version.cuda, "device": torch.cuda.get_device_name(), "totalVramBytes": total,
                  "peakAllocatedBytes": torch.cuda.max_memory_allocated(), "formalGpuQualificationGranted": False})
        model.zero_grad(set_to_none=True)
        del metrics, loss, target, conditions, latent, noise
        model.eval()
        baseline = evaluate_velocity_prediction(model, loader, diffusion, normalization, device, package["training"]["seed"] + 2000,
                                                config["training"]["fixedValidationTimesteps"], config)
        for index in range(len(dataset)):
            save_tensor_png(dataset[index]["image"], output / f"target-{index}.png")
            render(index, f"before-{index}.png")
        optimizer = torch.optim.AdamW(trainable, lr=float(config["training"]["denoiserLearningRate"]))
        epoch_metrics = []
        observation_records = []
        observation_steps = package["training"].get("observationSteps", [])

        def observe(step, boundary):
            from diagnose_learning_capacity_noise import image_metrics
            rows = []
            with preserve_training_random_state(), boundary.evaluation():
                for index in range(len(dataset)):
                    limits()
                    item = dataset[index]
                    target = item["image"][None]
                    conditions = item["conditions"][None].to(device)
                    trajectory = [] if package["policy"]["path"] == BUDGET_POLICY else None
                    sampled = render(index, f"step-{step}-{index}.png", base_filename=f"step-{step}-base-{index}.png", trajectory=trajectory)
                    with exact_inference_runtime(torch):
                        clean_latent = model.autoencoder.encode(target.to(device))
                        ae = model.autoencoder.decode(clean_latent)
                        oracle, evidence = decode_final_visible_rgb(model, clean_latent, conditions, config,
                            return_stage4_semantic_responsibility_evidence=True)
                    if step == observation_steps[0]:
                        save_tensor_png(ae[0], output / f"ae-reconstruction-{index}.png")
                    save_tensor_png(oracle[0].clamp(0, 1), output / f"step-{step}-target-latent-final-{index}.png")
                    coverage = torch.stack(evidence["responsibilityMasks"]).sum(dim=0).clamp(0, 1).cpu()
                    masks = {"uncovered_by_rgb_responsibility_masks": 1 - coverage}
                    order = package["inputIdentity"]["channelOrder"]
                    masks.update({key: conditions[:, order.index(key):order.index(key) + 1].cpu()
                                  for key in ("terrain_path_ground", "object_tree", "object_rock", "object_vegetation")})
                    regional = {}
                    for key, mask in masks.items():
                        count = float(mask.sum())
                        regional[key] = {"pixelWeight": count, "rgbMae": float(((sampled - target).abs() * mask).sum() / (3 * count)) if count > 0 else None}
                    rows.append({"sampleId": item["sampleId"], "split": "train",
                        "fullSampling": image_metrics(torch, sampled, target), "regions": regional,
                        "fullSamplingTrajectory": trajectory,
                        "aeReconstruction": image_metrics(torch, ae.cpu(), target),
                        "targetLatentFinal": image_metrics(torch, oracle.cpu(), target)})
            record = {"optimizerSteps": step, "rows": rows, "recordedAtUtc": now(),
                      "trainingRandomStatePreserved": True, "modelAndOptimizerUnchangedDuringObservation": True,
                      "checkpointSelected": False, "formalVisualQualification": False}
            save_json(output / f"observation-step-{step}.json", record)
            observation_records.append(record)
            progress("fixed_train_only_observation_completed", observedStep=step)

        training_clock = time.perf_counter()
        with TrainSplitBoundary(model, optimizer, dataset) as boundary:
            for epoch in range(package["training"]["epochs"]):
                limits()
                training_started = True
                values = train_epoch(model, boundary.wrap_loader(loader), optimizer, diffusion, normalization, device,
                                     config, epoch, enable_path_replay=False, enable_epoch_worst_replay=False)
                steps = boundary.evidence()["optimizerSteps"]
                require(all(math.isfinite(float(v)) for v in values.values() if isinstance(v, (int, float))), "nonfinite training metric")
                epoch_metrics.append(values)
                progress("training", epoch=epoch + 1, metrics=values)
                if steps in observation_steps:
                    observe(steps, boundary)
            with boundary.evaluation():
                final_metrics = evaluate_velocity_prediction(model, loader, diffusion, normalization, device,
                    package["training"]["seed"] + 2000, config["training"]["fixedValidationTimesteps"], config)
            step_evidence = boundary.evidence()
        training_seconds = time.perf_counter() - training_clock
        del boundary
        require(steps == package["training"]["epochs"] * len(dataset), "optimizer step count mismatch")
        require([r["optimizerSteps"] for r in observation_records] == observation_steps, "fixed observation coverage incomplete")
        final_state = state_hash(model.denoiser.state_dict())
        require(final_state != initial_state, "training did not update Denoiser")
        frozen_after = frozen(model, phase="after_training", expected_state_sha256=frozen_before["stateSha256"])
        model.eval()
        cp = {"schemaVersion": CHECKPOINT_SCHEMA, "experimentIdentity": package["experimentIdentity"],
              "checkpointPromotable": False, "formalInferenceEligible": False, "trainingLane": "ai_assisted_cold_start",
              "selectedSampleIds": [r["sampleId"] for r in package["selectedRows"]], "optimizerSteps": steps,
              "denoiserState": {k: v.detach().cpu() for k, v in model.denoiser.state_dict().items()},
              "denoiserStateSha256": final_state, "foundation": package["foundation"], "foundationStateSha256": frozen_after["stateSha256"],
              "latentNormalization": {k: v.cpu() if torch.is_tensor(v) else v for k, v in normalization.items()}, "config": config}
        cp_path = output / "experimental-checkpoint.pt"
        with cp_path.open("xb") as stream:
            torch.save(cp, stream)
            stream.flush()
            os.fsync(stream.fileno())
        validate_experiment_checkpoint(cp, package)
        progress("checkpoint_reload_verification")
        before_reload = render(0, "after-before-reload-0.png")
        reloaded = torch.load(cp_path, map_location="cpu", weights_only=True)
        validate_experiment_checkpoint(reloaded, package)
        # New object: equality cannot be satisfied by retaining the old model.
        del model, optimizer, trainable, cp
        torch.cuda.empty_cache()
        model = build_complete_world_system(config).to(device)
        foundation = torch.load(io.BytesIO(read_bound(root, package["foundation"])), map_location="cpu", weights_only=True)
        model.autoencoder.load_state_dict(foundation["autoencoderState"], strict=True)
        model.denoiser.load_state_dict(reloaded["denoiserState"], strict=True)
        require(state_hash(model.denoiser.state_dict()) == final_state, "checkpoint reload state mismatch")
        frozen(model, phase="loaded", expected_state_sha256=frozen_after["stateSha256"])
        normalization = {k: v.to(device) if torch.is_tensor(v) else v for k, v in reloaded["latentNormalization"].items()}
        model.eval()
        after_reload = render(0, "after-0.png")
        reload_max_difference = float((before_reload - after_reload).abs().max())
        require(torch.equal(before_reload, after_reload), f"fixed-seed checkpoint reload output mismatch: maxAbsDifference={reload_max_difference}")
        render(1, "after-1.png")
        # Diagnostic intervention only: never persisted as a WorldFact/target.
        swapped_conditions = dataset[1]["conditions"].unsqueeze(0).to(device)
        swapped_rgb = render(0, "condition-response-0.png", conditions_override=swapped_conditions)
        condition_response = float((after_reload - swapped_rgb).abs().mean())
        artifacts = [file_binding(root, str(p.relative_to(root)).replace("\\", "/")) for p in output.iterdir()
                     if p.is_file() and (p.suffix == ".png" or p.name.startswith("observation-step-") or p.name in {"experimental-checkpoint.pt", "gpu-probe.json"})]
        for receipt in package["inputReceipts"]:
            read_bound(root, receipt)
        result = {"status": "experiment_executed_not_visual_qualified", "executionState": "completed",
                  "experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(),
                  "gpuStarted": True, "trainingStarted": True, "optimizerSteps": steps,
                  "selectedSampleIds": [r["sampleId"] for r in package["selectedRows"]],
                  "trainOnlyBaselineMetrics": baseline, "trainOnlyFinalMetrics": final_metrics,
                  "epochMetrics": epoch_metrics, "stepEvidence": step_evidence,
                  "fixedTrainOnlyObservations": observation_records,
                  "comparisonEvidence": package.get("comparisonEvidence"),
                  "initialDenoiserStateSha256": initial_state, "finalDenoiserStateSha256": final_state,
                  "foundationBefore": frozen_before, "foundationAfter": frozen_after,
                  "checkpointReloadExact": True, "checkpointReloadMaxAbsoluteDifference": reload_max_difference,
                  "inferenceDeterministicAlgorithmsRequired": True, "conditionSwapRgbMeanAbsoluteDifference": condition_response,
                  "conditionResponseProvesSemanticCorrectness": False,
                  "trainingSecondsIncludingFinalEvaluation": training_seconds,
                  "elapsedSeconds": time.perf_counter() - started, "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
                  "peakReservedBytes": torch.cuda.max_memory_reserved(), "artifacts": artifacts,
                  "qualification": package["qualification"], "foundationLimitations": package["foundationLimitations"]}
        save_json(output / "result.json", result)
        progress("completed", resultStatus=result["status"])
        return 0
    except Exception as error:
        result = {"status": "experiment_failed_closed", "executionState": "failed_closed", "recordedAtUtc": now(),
                  "experimentIdentity": package["experimentIdentity"], "gpuStarted": gpu_started, "trainingStarted": training_started,
                  "optimizerSteps": steps, "elapsedSeconds": time.perf_counter() - started,
                  "error": str(error), "traceback": traceback.format_exc(), "qualification": package["qualification"]}
        save_json(output / "result.json", result)
        print(json.dumps(result), flush=True)
        return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["prepare", "run"])
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    parser.add_argument("--policy", choices=[POLICY, FOLLOWUP_POLICY, BUDGET_POLICY], default=POLICY)
    args = parser.parse_args()
    root = Path.cwd()
    if args.mode == "prepare":
        print(json.dumps(prepare(root, args.policy)))
        return 0
    require(args.package and args.sha256, "exact package binding required")
    return execute(root, {"path": args.package, "sha256": args.sha256})


if __name__ == "__main__":
    raise SystemExit(main())

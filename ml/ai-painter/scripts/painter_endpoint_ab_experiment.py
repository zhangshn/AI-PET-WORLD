"""Versioned 400-update train-only A/B; no selection or automatic retry.

The control keeps the original full single-step loss. The candidate alternates
whole two-image epochs between that loss and the existing RGB loss at a complete
target-free, ten-step endpoint. Equal updates do NOT mean equal compute.
The v2 candidate keeps the full loss on every update and additionally sums the
existing endpoint RGB objective on odd epochs; gradient scale also changes.
The v3 candidate changes only that frequency to epochs with epoch % 4 == 3.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time
import traceback

import painter_timestep_ab_experiment as prior
from ai_painter.complete_world.endpoint_rgb_experiment import pure_noise_endpoint, add_existing_objectives, phase4_residual_loss, isolated_phase4_gradient
from painter_learning_capacity_experiment import (
    bound_json, exact_inference_runtime, file_binding, now,
    project_file, read_bound, require, save_json,
)
from compare_decoder_adapted_sampling import png_matches

ARMS = ("single_step_control", "mixed_endpoint_candidate")
PARENT_ARM = "legacy_global_schedule_control"
TRAINING = {
    "optimizerStepsPerArm": 200, "totalOptimizerStepLimit": 400,
    "epochsPerArm": 100, "batchSize": 1, "learningRate": .0001, "weightDecay": .01,
    "optimizer": "AdamW", "optimizerState": "fresh_identical_per_arm_no_resume",
    "seedBase": 20260909, "seedRule": "seedBase_plus_2_epoch_plus_sample_index",
    "teacherEpochOffset": 500, "inferenceSteps": 10,
    "candidateRoute": "even_epoch_single_step_odd_epoch_endpoint_both_samples",
    "checkpointRule": "final_step_only_no_selection", "modelMode": "eval_with_denoiser_gradients",
    "equalComputeClaim": False, "formalQualificationAllowed": False,
}
RESOURCES = dict(prior.RESOURCES)
TRAINING_V2 = {**TRAINING, "candidateRoute": "every_step_full_single_step_plus_odd_epoch_existing_endpoint_rgb",
    "objectiveStrategy": "full18_every_step_plus_existing_rgb11_v2", "gradientScaleChanged": True}
TRAINING_V3 = {**TRAINING_V2, "candidateRoute": "every_step_full_single_step_plus_epoch_mod4_eq3_existing_endpoint_rgb",
    "objectiveStrategy": "full18_every_step_plus_existing_rgb11_every4_v3"}
TRAINING_V4 = {**TRAINING_V3,
    "candidateRoute": "both_full_plus_endpoint_every4_candidate_only_phase4",
    "objectiveStrategy": "full18_rgb11_every4_plus_candidate_phase4_v1",
    "phase4Coefficient": 1, "phase4EpsilonSquared": 1e-12}
TRAININGS = {"v1": TRAINING, "v2": TRAINING_V2, "v3": TRAINING_V3, "v4": TRAINING_V4}
PHASE4_POLICY = "data/ai-painter/system-governance/ai-painter-endpoint-phase4-experiment-policy-v1.json"
GPU_RECHECK_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-phase4-gpu-recheck-policy-v1.json",
    "sha256":"ec9bcce07c2c8f504be0272c6c4283ec6e6c33c10105456a447a11ab6fc3abab"}
CONTROLLED_TRAINING_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-phase4-controlled-training-policy-v1.json",
    "sha256":"3219110faaf2752a09d3b81ce64fc054c8f1daa31e2023ff9c2b56f5e3aaced4"}


def guard_execution_mode(request, probe_only):
    mode=request.get("executionMode")
    require(mode in (None,"gpu_qualification_only","bounded_training_after_gpu_recheck"), "unknown execution mode")
    require(mode != "gpu_qualification_only" or probe_only is True, "GPU-only request cannot create an optimizer or train")
    require(mode != "bounded_training_after_gpu_recheck" or probe_only is False, "controlled training request is not a reusable GPU-only ticket")


def probe_modes(version):
    return ("full_plus_endpoint", "full_plus_endpoint_phase4") if version == "v4" else ("single_step", "endpoint_rgb" if version == "v1" else "full_plus_endpoint")


def request_strategy(request):
    schema = request.get("schemaVersion")
    require(schema in tuple("ai-painter-endpoint-ab-request-" + v for v in TRAININGS), "unknown request strategy")
    version = schema.rsplit("-", 1)[1]
    require(request.get("training") == TRAININGS[version], "request strategy/training mismatch")
    if version != "v1":
        payload = {k:v for k,v in request.items() if k not in ("identity", "outputRoot")}
        identity = "painter-endpoint-ab-" + version + "-" + hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",", ":"),ensure_ascii=False).encode()).hexdigest()
        require(request.get("identity") == identity and request.get("outputRoot") == prior.previous.ROOT + "/" + identity,
                version + " request identity changed")
    return version


def route(arm, epoch, index, version="v1"):
    require(arm in ARMS and type(epoch) is int and 0 <= epoch < 100
            and type(index) is int and index in (0, 1), "outside fixed training matrix")
    require(version in TRAININGS, "unknown route strategy")
    if version == "v4":
        return ("full_plus_endpoint_phase4" if arm == ARMS[1] else "full_plus_endpoint") if epoch % 4 == 3 else "single_step"
    extra = epoch % 4 == 3 if version == "v3" else bool(epoch % 2)
    return ("endpoint_rgb" if version == "v1" else "full_plus_endpoint") if arm == ARMS[1] and extra else "single_step"


def objective_for_route(mode, single_step, endpoint):
    """Callbacks preserve the actual single-step and full-rollout implementations."""
    require(mode in ("single_step", "endpoint_rgb", "full_plus_endpoint", "full_plus_endpoint_phase4"), "unknown objective route")
    if mode == "endpoint_rgb":
        return endpoint()
    full, record = single_step()
    if mode == "single_step":
        return full, record
    extra, endpoint_record = endpoint()
    return add_existing_objectives(full, extra), {**record, **{k: v for k, v in endpoint_record.items() if k.startswith("phase4") or k == "existingEndpointObjectiveValue"}, "route": mode,
        "fullObjectiveValue": float(full.detach()), "endpointObjectiveValue": float(extra.detach()),
        "endpointNoiseSha256": endpoint_record["noiseSha256"]}


def seed_for(epoch, index):
    route(ARMS[0], epoch, index)
    seed = TRAINING["seedBase"] + 2 * epoch + index
    require(seed not in sum(prior.comparison.SETTINGS["seedsBySample"], []), "evaluation seed used for training")
    return seed


def validate_request(root, binding):
    request = bound_json(root, binding)
    version = request_strategy(request)
    if version == "v4":
        require(request["phase4Policy"] == {"path": PHASE4_POLICY, "sha256": "6aa0297ac06d1fb62682c6d51a0154061a563c6fe1a71ec32f8ad32425eb7446"}, "phase4 policy identity changed")
        policy = bound_json(root, request["phase4Policy"])
        require(request["phase4Policy"]["path"] == PHASE4_POLICY, "phase4 policy path")
        require(policy["allowedNewLoss"] == "target_residual_phase4_smoothed_rms_v1"
                and policy["coefficient"] == 1 and policy["epsilonSquared"] == 1e-12
                and policy["executionLimit"] == 1 and policy["automaticRetries"] == 0
                and policy["totalOptimizerStepLimit"] == 400 and policy["formalQualificationAllowed"] is False,
                "phase4 policy boundary changed")
        if request.get("executionMode") == "gpu_qualification_only":
            require(request["gpuRecheckPolicy"] == GPU_RECHECK_POLICY,"GPU recheck policy identity")
            policy = bound_json(root,GPU_RECHECK_POLICY)
            equivalence=bound_json(root,policy["cpuEquivalence"])
            require(equivalence["status"]=="cpu_equivalent" and equivalence["optimizerSteps"]==0,"CPU equivalence missing")
            predecessor=bound_json(root,request["gpuRecheckPredecessor"])
            require(predecessor["executionState"]=="failed_closed" and predecessor["optimizerSteps"]==0
                    and predecessor["trainingStarted"] is False,"nonzero predecessor")
        if request.get("executionMode") == "bounded_training_after_gpu_recheck":
            require(request["controlledTrainingPolicy"]==CONTROLLED_TRAINING_POLICY,"controlled training policy identity")
            policy=bound_json(root,CONTROLLED_TRAINING_POLICY)
            require(request["trainingPredecessor"]==policy["requiredPredecessor"],"training predecessor substituted")
            predecessor=bound_json(root,request["trainingPredecessor"])
            proof=bound_json(root,predecessor["workerResult"])
            require(predecessor["status"]=="gpu_recheck_completed_no_training"
                    and proof["status"]=="endpoint_ab_v4_zero_update_gpu_qualified"
                    and proof["optimizerCreated"] is False and proof["optimizerSteps"]==0
                    and proof["trainingStarted"] is False and proof["parentCheckpoint"]==request["parentCheckpoint"],"GPU predecessor invalid")
            require_probes(proof["gpuProbes"],"v4")
        attempt = bound_json(root, file_binding(root, policy["attemptPath"]))
        require(attempt["request"] == binding, "phase4 attempt identity mismatch")
    require(request["mode"] == "bounded_paired_endpoint_training" and request["resources"] == RESOURCES, "request scope changed")
    require(request["identity"].startswith("painter-endpoint-ab-")
            and request["outputRoot"] == prior.previous.ROOT + "/" + request["identity"]
            and binding["path"] == request["outputRoot"] + "/experiment-request.json", "namespace mismatch")
    for b in request["inputReceipts"]:
        read_bound(root, b)
    if version != "v1":
        required = ("ml/ai-painter/scripts/painter_endpoint_ab_experiment.py", "ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py",
                    "ml/ai-painter/tests/test_endpoint_ab_experiment.py", "ml/ai-painter/tests/test_endpoint_rgb_experiment.py",
                    "scripts/lib/ai-painter-endpoint-ab-v1.mjs", "scripts/tests/test-ai-painter-endpoint-ab.mjs")
        for path in required:
            matches = [b for b in request["inputReceipts"] if b["path"] == path]
            require(len(matches) == 1 and file_binding(root,path) == matches[0], version + " program binding missing or changed: " + path)
    source = bound_json(root, request["sourceCurrent"])
    require(source["schemaVersion"] == "ai-painter-endpoint-gradient-shadow-result-v1"
            and source["executionState"] == "completed"
            and source["summary"]["cpuCandidatePathVerified"] is True
            and source["parentCheckpoint"] == request["parentCheckpoint"], "current CPU candidate evidence missing")
    if version == "v4":
        # Historical packages retain their original document receipts. Only the
        # explicit newly versioned specification is rebound for this experiment;
        # never rebuild or rewrite a historical package with current documents.
        package = bound_json(root, request["sourcePackage"])
        replacements = request["documentRebindings"]
        spec_path = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
        require(len(replacements) == 1 and replacements[0]["historical"]["path"] == spec_path
                and replacements[0]["current"]["path"] == spec_path, "document rebound scope")
        current = replacements[0]["current"]
        read_bound(root,current)
        require(current in request["inputReceipts"], "current specification not bound")
        for receipt in package["inputReceipts"]:
            if receipt["path"] == spec_path:
                require(receipt == replacements[0]["historical"], "historical spec identity changed")
            else:
                read_bound(root,receipt)
        require(package["selectedRows"] == request["selectedRows"], "source train selection changed")
    else:
        package = prior.materialize(root)
        require(package == bound_json(root, request["sourcePackage"]), "source package changed")
    sampled = bound_json(root, request["sourceSampling"])["replay"]
    require(sampled["sourceResult"] == request["sourceResult"]
            and sampled["sourcePackage"] == request["sourcePackage"], "sampling source changed")
    source_result = bound_json(root, request["sourceResult"])
    parents = [a for a in source_result["arms"] if a["arm"] == PARENT_ARM]
    require(len(parents) == 1 and parents[0]["checkpoint"] == request["parentCheckpoint"], "parent selection changed")
    return request, package, sampled


def load_parent(root, request, package, device="cpu"):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    model, heads, normalization, _ = prior.comparison.load_frozen_pair(root, bound_json(root, package["sourceComparisonPlan"]))
    model.denoiser.rgb_responsibility_heads = heads
    head_hash = state_hash(heads.state_dict())
    cp = torch.load(io.BytesIO(read_bound(root, request["parentCheckpoint"])), map_location="cpu", weights_only=True)
    prior.validate_checkpoint(cp, package, PARENT_ARM)
    model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
    require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"]
            and state_hash(heads.state_dict()) == head_hash
            and prior.frozen_hash(model) == cp["frozenStateSha256"], "parent state/frozen binding mismatch")
    return model.to(device), prior.normalization_to_device(normalization, device)


def phase4_gradient_for(model, norm, image, conditions, alpha, seed, config, check):
    """Independent phase-only proof. No teacher/full-objective graph exists here."""
    import train_ai_assisted_conditional_denoiser as trainer
    parameter = next(p for n,p in model.named_parameters() if n.startswith("denoiser.base_output.") and n.endswith("weight"))
    def produce_rgb():
        _, latent = pure_noise_endpoint(model.predict_velocity, conditions, alpha, seed, check=check)
        return trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent,norm), conditions,config)
    return isolated_phase4_gradient(produce_rgb,image,parameter)


def validate_checkpoint(cp, request, arm):
    from ai_painter.complete_world.split_training import state_hash
    version = request_strategy(request) if "schemaVersion" in request else "v1"
    training = TRAININGS[version]
    require(cp.get("schemaVersion") == "ai-painter-endpoint-ab-checkpoint-" + version
            and cp.get("runId") == request["identity"] and cp.get("arm") == arm and arm in ARMS,
            "checkpoint identity mismatch")
    require(cp.get("optimizerSteps") == 200 and cp.get("parentCheckpoint") == request["parentCheckpoint"]
            and cp.get("training") == training, "checkpoint budget/parent mismatch")
    require(cp.get("checkpointPromotable") is False and cp.get("formalInferenceEligible") is False
            and cp.get("resumeSupported") is False, "checkpoint qualification/resume forbidden")
    require(cp.get("denoiserStateSha256") == state_hash(cp["denoiserState"]), "checkpoint tensor hash mismatch")


def require_probes(probes, version="v1"):
    require(version in TRAININGS, "unknown probe strategy")
    expected = [(mode, sample) for mode in probe_modes(version) for sample in prior.previous.SAMPLES]
    require([(p["route"], p["sampleId"]) for p in probes] == expected, "all four current GPU probes required")
    require(all(p["optimizerCreated"] is False and p["modelStateUnchanged"] is True
                and p["baseOutputReached"] is True and math.isfinite(p["gradientL2"]) and p["gradientL2"] > 0
                and p["frozenGradientCount"] == 0 for p in probes), "GPU gradient/frozen probe failed")
    if version == "v4":
        require(all(math.isfinite(p.get("phase4GradientL2",0)) and p.get("phase4GradientL2",0)>0
                    for p in probes if p["route"] == "full_plus_endpoint_phase4"), "current phase4 gradient proof missing")


def evaluate(root, request, package, sampled, arms, check, progress, *, verify=False):
    """Fresh CPU loads; all six predetermined seeds, no checkpoint selection."""
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    from ai_painter.complete_world.split_training import state_hash
    dataset = prior.dataset_for(root, {**package, "experimentIdentity": request["identity"]})
    baselines = [r for r in sampled["rows"] if r["arm"] == PARENT_ARM and r["steps"] == 10]
    require([(r["sampleId"], r["seed"]) for r in baselines] == [
        (s, seed) for i, s in enumerate(prior.previous.SAMPLES)
        for seed in prior.comparison.SETTINGS["seedsBySample"][i]], "baseline seed matrix changed")
    rows = []
    for arm in arms:
        model, normalization = load_parent(root, request, package)
        frozen = prior.frozen_hash(model)
        if arm is not None:
            cp = torch.load(io.BytesIO(read_bound(root, arm["checkpoint"])), map_location="cpu", weights_only=True)
            validate_checkpoint(cp, request, arm["arm"])
            model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
            require(prior.frozen_hash(model) == frozen == cp["frozenStateSha256"], "evaluation frozen state changed")
        model.eval().requires_grad_(False)
        before = state_hash((model.state_dict(), normalization))
        alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(prior.previous.SAMPLES):
                item = dataset[i]
                require(item["sampleId"] == sample and item["split"] == "train", "evaluation split mismatch")
                target, conditions = item["image"][None], item["conditions"][None]
                for j, seed in enumerate(prior.comparison.SETTINGS["seedsBySample"][i]):
                    check()
                    noise, latent = pure_noise_endpoint(model.predict_velocity, conditions, alpha, seed, check=check)
                    rgb, evidence = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent, normalization),
                        conditions, package["config"], return_stage4_semantic_responsibility_evidence=True)
                    measured = prior.comparison.measure(torch, rgb, evidence, target, conditions, package["config"])
                    baseline = baselines[i * 3 + j]
                    require(state_hash(noise) == baseline["noiseStateSha256"], "evaluation noise mismatch")
                    if arm is None:
                        require(measured == baseline["measurements"], "parent numerical replay mismatch")
                        png_matches(root, baseline["image"], rgb)
                        image = baseline["image"]
                    else:
                        image_path = request["outputRoot"] + f"/{arm['arm']}-{i}-{j}.png"
                        if verify:
                            image = file_binding(root, image_path)
                            png_matches(root, image, rgb)
                        else:
                            require(not project_file(root, image_path).exists(), "image overwrite forbidden")
                            trainer.save_tensor_png(rgb[0], project_file(root, image_path))
                            image = file_binding(root, image_path)
                    rows.append({"arm": PARENT_ARM if arm is None else arm["arm"], "sampleId": sample,
                        "split": "train", "seed": seed, "steps": 10, "fullEndpoint": True,
                        "targetUsedForInitialization": False, "noiseStateSha256": state_hash(noise), "image": image,
                        "measurements": measured, "baseline": baseline["measurements"], "baselineImage": baseline["image"]})
                    progress("cpu_parent_replay" if arm is None else "cpu_six_seed_evaluation", evaluated=len(rows))
        require(state_hash((model.state_dict(), normalization)) == before, "evaluation mutated model")
    return rows


def execute(root, binding, *, probe_only=False):
    import torch
    from torch.utils.data import DataLoader
    from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
    import train_ai_assisted_conditional_denoiser as trainer
    request, package, sampled = validate_request(root, binding)
    guard_execution_mode(request,probe_only)
    version = request_strategy(request)
    training = TRAININGS[version]
    require(type(probe_only) is bool and (not probe_only or version != "v1"), "probe-only requires the explicit v2/v3 strategy")
    output = project_file(root, request["outputRoot"])
    # Exclusive run claim prevents a second optimizer invocation, including after failure.
    save_json(output / ("gpu-qualification-start.json" if probe_only else "worker-start.json"),
              {"runId": request["identity"], "pid": os.getpid(), "startedAtUtc": now()})
    started, gpu_clock, gpu_seconds = time.monotonic(), None, 0.0
    state = {"runId": request["identity"], "gpuStarted": False, "trainingStarted": False,
        "optimizerSteps": 0, "stepInFlight": False, "finalStepCountKnown": True}
    arms, probes, traces = [], [], []
    result = {"schemaVersion": "ai-painter-endpoint-ab-result-" + version, "runId": request["identity"],
        "request": binding, "parentCheckpoint": request["parentCheckpoint"], "training": training, "resources": RESOURCES,
        "formalQualificationAllowed": False, "checkpointSelected": False, "worldEntryAllowed": False}

    def progress(phase, **details):
        state.update(phase=phase, recordedAtUtc=now(), **details)
        save_json(output / "training-progress.json", state, mutable=True)

    def check(temperature=False):
        require(time.monotonic() - started < RESOURCES["maxWallSeconds"], "worker wall-time limit")
        if gpu_clock is not None:
            require(time.monotonic() - gpu_clock < RESOURCES["maxGpuSeconds"], "GPU time limit")
        require(shutil.disk_usage(output).free >= RESOURCES["minimumFreeDiskMiB"] * 2**20, "disk space limit")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < RESOURCES["maxOutputMiB"] * 2**20,
                "output size limit")
        if temperature:
            probe = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(probe.returncode == 0 and len(probe.stdout.strip().splitlines()) == 1, "GPU temperature unavailable/ambiguous")
            value = int(probe.stdout.strip())
            require(value < RESOURCES["maximumTemperatureC"], "GPU temperature limit")
            traces.append({"optimizerSteps": state["optimizerSteps"], "temperatureC": value,
                "elapsedSeconds": time.monotonic() - started})

    def inputs_for(model, normalization, dataset):
        inputs = []
        for i, sample in enumerate(prior.previous.SAMPLES):
            item = dataset[i]
            require(item["sampleId"] == sample and item["split"] == "train", "non-train input")
            image, conditions = item["image"][None].to("cuda"), item["conditions"][None].to("cuda")
            require(tuple(image.shape) == (1, 3, 192, 256) and tuple(conditions.shape) == (1, 23, 192, 256), "input shape changed")
            with torch.no_grad():
                clean = trainer.normalize_latent(model.autoencoder.encode(image), normalization)
            inputs.append((image, conditions, clean))
        return inputs

    def loss_for(model, norm, inputs, mode, epoch, index, alpha):
        image, conditions, clean = inputs
        seed = seed_for(epoch, index)
        def endpoint():
            noise, latent = pure_noise_endpoint(model.predict_velocity, conditions, alpha, seed, check=check)
            rgb = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent, norm), conditions, package["config"])
            loss, _ = prior.previous.rgb_objective(rgb, image, conditions, package["config"])
            record = {"route":"endpoint_rgb", "seed":seed, "teacherTimestep":None, "noiseSha256":state_hash(noise)}
            if mode == "full_plus_endpoint_phase4":
                penalty = phase4_residual_loss(rgb, image)
                record.update(existingEndpointObjectiveValue=float(loss.detach()), phase4Loss=float(penalty.detach()),
                    phase4Coefficient=training["phase4Coefficient"])
                loss = loss + training["phase4Coefficient"] * penalty
            return loss, record
        def single_step():
            generator = torch.Generator(device="cuda").manual_seed(seed)
            noise = torch.randn(clean.shape, device="cuda", generator=generator)
            t = trainer.training_timesteps(package["config"], TRAINING["teacherEpochOffset"] + epoch, index, 2, 1, 1000, "cuda")
            measured = trainer.predict_and_measure(model, trainer.add_noise(clean, noise, t, alpha),
                trainer.velocity_target(clean, noise, t, alpha), clean, t, alpha, conditions,
                package["config"], target_image=image, latent_normalization=norm)
            loss, timestep = measured["compositeLossTensor"], int(t.item())
            return loss, {"route":"single_step", "seed":seed, "teacherTimestep":timestep, "noiseSha256":state_hash(noise)}
        loss, record = objective_for_route(mode, single_step, endpoint)
        require(bool(torch.isfinite(loss)), "nonfinite loss")
        if version != "v1":
            record.update(fullObjectiveTerms=18, endpointObjectiveTerms=11 if mode.startswith("full_plus_endpoint") else 0)
            if version == "v4":
                record["phase4ObjectiveTerms"] = int(mode == "full_plus_endpoint_phase4")
        return loss, record

    try:
        torch.set_num_threads(4)
        progress("validating_parent_cpu")
        result["parentReplay"] = evaluate(root, request, package, sampled, [None], check, progress)
        require(not torch.cuda.is_initialized(), "CUDA started before parent replay")
        require(os.environ.get("CUBLAS_WORKSPACE_CONFIG") == ":4096:8", "CUDA numeric environment mismatch")
        require(torch.cuda.is_available(), "CUDA unavailable")
        # Mark CUDA initialization conservatively before a call that may fail part-way.
        state["gpuStarted"] = True
        gpu_clock = time.monotonic()
        progress("gpu_resource_probe")
        torch.use_deterministic_algorithms(False)
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
        require(torch.cuda.mem_get_info()[0] >= RESOURCES["minimumFreeVramMiB"] * 2**20, "insufficient free VRAM")
        torch.cuda.set_per_process_memory_fraction(RESOURCES["cudaMemoryFraction"])
        torch.cuda.reset_peak_memory_stats()
        check(True)
        result["numericRuntime"] = {"torch": str(torch.__version__), "cuda": torch.version.cuda,
            "gpu": torch.cuda.get_device_name(), "strictDeterministicBackward": False,
            "cudnnDeterministic": True, "cudnnBenchmark": False, "cpuThreads": 4,
            "limitation": "Existing adaptive pooling CUDA backward is not bitwise deterministic."}
        dataset = prior.dataset_for(root, {**package, "experimentIdentity": request["identity"]})
        require(len(dataset) == 2, "dataset expanded")
        alpha = trainer.build_diffusion_schedule(package["config"], "cuda")["alphasCumulative"]
        model, norm = load_parent(root, request, package, "cuda")
        prior.trainable_parameters(model); model.eval()
        initial = state_hash(model.denoiser.state_dict())
        frozen = prior.frozen_hash(model)
        before = state_hash(model.state_dict())
        inputs = inputs_for(model, norm, dataset)
        for mode in probe_modes(version):
            for i, sample in enumerate(prior.previous.SAMPLES):
                check(True)
                model.zero_grad(set_to_none=True)
                phase_proof = {}
                if mode == "full_plus_endpoint_phase4":
                    phase_proof = phase4_gradient_for(model,norm,inputs[i][0],inputs[i][1],alpha,seed_for(0,i),package["config"],check)
                    require(state_hash(model.state_dict()) == before,"phase-only probe mutated model")
                loss, probe_record = loss_for(model, norm, inputs[i], mode, 0, i, alpha)
                if phase_proof:
                    require(math.isclose(phase_proof["phase4Loss"],probe_record["phase4Loss"],rel_tol=1e-5,abs_tol=1e-8),"phase-only and combined forward disagree")
                loss.backward()
                reachable = prior.check_gradients(model)
                require(state_hash(model.state_dict()) == before, "zero-update probe changed model")
                probes.append({"route": mode, "sampleId": sample, "optimizerCreated": False,
                    "modelStateUnchanged": True, "modelStateSha256": before, "loss": float(loss.detach()),
                    "baseOutputReached": any(n.startswith("denoiser.base_output.") for n in reachable),
                    "gradientL2": float(sum(p.grad.double().square().sum() for p in model.parameters() if p.grad is not None).sqrt()),
                    "frozenGradientCount": sum(p.grad is not None for p in model.parameters() if not p.requires_grad),
                    **({"phase4GradientL2":phase_proof["phase4GradientL2"]} if phase_proof else {})})
                # Do not retain even an already-backward graph into the next probe.
                del loss
                progress("gpu_zero_update_probe", probesCompleted=len(probes))
        require_probes(probes, version)
        save_json(output / ("gpu-qualification-probes.json" if probe_only else "gpu-probes.json"), {"probes": probes, "optimizerSteps": 0,
            "allFourPassedBeforeOptimizerCreation": True, "peakAllocatedMiB": torch.cuda.max_memory_allocated() / 2**20})
        del inputs, model, norm
        torch.cuda.empty_cache()
        if probe_only:
            for b in [*request["inputReceipts"], binding]:read_bound(root,b)
            check(True)
            result.update(schemaVersion="ai-painter-endpoint-ab-gpu-qualification-" + version,
                status="endpoint_ab_" + version + "_zero_update_gpu_qualified",executionState="completed",gpuProbes=probes,
                optimizerCreated=False,optimizerSteps=0,trainingStarted=False,gpuStarted=True,
                finalStepCountKnown=True,stepInFlight=False,gpuSeconds=time.monotonic()-gpu_clock,
                elapsedSeconds=time.monotonic()-started,recordedAtUtc=now(),arms=[],
                peakAllocatedMiB=torch.cuda.max_memory_allocated()/2**20,peakReservedMiB=torch.cuda.max_memory_reserved()/2**20)
            save_json(output / "gpu-qualification-result.json",result)
            progress("gpu_qualification_completed")
            return result  # No optimizer has been constructed; a separate dispatch is required.

        for arm in ARMS:
            require_probes(probes, version)
            model, norm = load_parent(root, request, package, "cuda")
            parameters = prior.trainable_parameters(model); model.eval()
            require(state_hash(model.denoiser.state_dict()) == initial and prior.frozen_hash(model) == frozen,
                    "arm did not reset to common parent")
            inputs = inputs_for(model, norm, dataset)
            inputs_hash = state_hash(inputs)
            optimizer = torch.optim.AdamW(parameters, lr=.0001, weight_decay=.01)
            records = []
            loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
            with TrainSplitBoundary(model, optimizer, dataset) as boundary:
                for epoch in range(100):
                    for i, batch in enumerate(boundary.wrap_loader(loader)):
                        check(len(records) % 20 == 0)
                        require(batch["sampleId"] == [prior.previous.SAMPLES[i]], "sample order changed")
                        # Cached tensors must actually match the source-bound loader batch.
                        require(torch.equal(batch["image"], inputs[i][0].cpu())
                                and torch.equal(batch["conditions"], inputs[i][1].cpu()), "cached batch mismatch")
                        optimizer.zero_grad(set_to_none=True)
                        loss, record = loss_for(model, norm, inputs[i], route(arm, epoch, i, version), epoch, i, alpha)
                        loss.backward(); prior.check_gradients(model)
                        progress("optimizer_step_pending", arm=arm, armOptimizerSteps=len(records), stepInFlight=True)
                        optimizer.step()
                        torch.cuda.synchronize()
                        state["optimizerSteps"] += 1
                        state["trainingStarted"] = True
                        state["stepInFlight"] = False
                        records.append({**record, "sampleId": prior.previous.SAMPLES[i], "epoch": epoch,
                            "optimizerStep": len(records) + 1, "loss": float(loss.detach())})
                        del loss
                        progress("training", arm=arm, armOptimizerSteps=len(records))
                ledger = boundary.evidence()
            require(len(records) == ledger["optimizerSteps"] == 200 and state["optimizerSteps"] <= 400, "step ledger mismatch")
            require(prior.frozen_hash(model) == frozen and state_hash(inputs) == inputs_hash, "frozen state/input changed")
            require(state_hash(model.denoiser.state_dict()) != initial, "denoiser did not change")
            model.eval().requires_grad_(False)
            cp = {"schemaVersion": "ai-painter-endpoint-ab-checkpoint-" + version, "runId": request["identity"],
                "arm": arm, "optimizerSteps": 200, "parentCheckpoint": request["parentCheckpoint"], "training": training,
                "denoiserState": {k: v.detach().cpu() for k, v in model.denoiser.state_dict().items()},
                "denoiserStateSha256": state_hash(model.denoiser.state_dict()), "frozenStateSha256": frozen,
                "checkpointPromotable": False, "formalInferenceEligible": False, "resumeSupported": False}
            validate_checkpoint(cp, request, arm)
            cp_path = output / (arm + ".pt")
            with cp_path.open("xb") as stream:
                torch.save(cp, stream); stream.flush(); os.fsync(stream.fileno())
            loaded = torch.load(cp_path, map_location="cpu", weights_only=True)
            validate_checkpoint(loaded, request, arm)
            restored, _ = load_parent(root, request, package, "cuda")
            restored.denoiser.load_state_dict(loaded["denoiserState"], strict=True)
            restored.eval().requires_grad_(False)
            require(prior.frozen_hash(restored) == frozen, "reloaded frozen state changed")
            with torch.inference_mode(), exact_inference_runtime(torch):
                for i in range(2):
                    seed = prior.comparison.SETTINGS["seedsBySample"][i][0]
                    _, a = pure_noise_endpoint(model.predict_velocity, inputs[i][1], alpha, seed, check=check)
                    _, b = pure_noise_endpoint(restored.predict_velocity, inputs[i][1], alpha, seed, check=check)
                    require(torch.equal(a, b), "fresh checkpoint endpoint mismatch")
                    ra = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(a, norm), inputs[i][1], package["config"])
                    rb = trainer.decode_final_visible_rgb(restored, trainer.denormalize_latent(b, norm), inputs[i][1], package["config"])
                    require(torch.equal(ra, rb), "fresh checkpoint RGB mismatch")
            save_json(output / (arm + "-steps.json"), {"ledger": ledger, "records": records})
            arms.append({"arm": arm, "optimizerSteps": 200, "initialDenoiserStateSha256": initial,
                "denoiserStateSha256": cp["denoiserStateSha256"], "frozenStateSha256": frozen, "frozenStateUnchanged": True,
                "checkpointReloadExact": True, "trainingInputStateSha256": inputs_hash,
                "checkpoint": file_binding(root, request["outputRoot"] + "/" + arm + ".pt"),
                "stepEvidence": file_binding(root, request["outputRoot"] + "/" + arm + "-steps.json")})
            save_json(output / (arm + "-training.json"), arms[-1])
            progress("arm_checkpoint_verified", arm=arm)
            del optimizer, parameters, model, restored, inputs, cp, loaded, a, b, ra, rb, norm
            torch.cuda.empty_cache()
        check(True)
        require(state["optimizerSteps"] == 400, "total updates mismatch")
        gpu_seconds = time.monotonic() - gpu_clock
        result["peakAllocatedMiB"] = torch.cuda.max_memory_allocated() / 2**20
        result["peakReservedMiB"] = torch.cuda.max_memory_reserved() / 2**20
        gpu_clock = None
        del alpha
        torch.cuda.empty_cache()
        result["rows"] = evaluate(root, request, package, sampled, arms, check, progress)
        for b in [*request["inputReceipts"], binding]:
            read_bound(root, b)
        check()
        result.update(status="endpoint_ab_completed_not_visual_qualified", executionState="completed",
            inputBindingsReverified=len(request["inputReceipts"]), checkpointReloadExact=True)
    except Exception as error:
        state["finalStepCountKnown"] = not state["stepInFlight"]
        if state["stepInFlight"]:
            state["trainingStarted"] = None if not state["trainingStarted"] else True
        result.update(status="endpoint_ab_failed_closed", executionState="failed_closed",
            error=str(error), traceback=traceback.format_exc(), checkpointReloadExact=False)
    if gpu_clock is not None:
        gpu_seconds = time.monotonic() - gpu_clock
    result.update(**{k: state[k] for k in ("gpuStarted", "trainingStarted", "optimizerSteps", "stepInFlight", "finalStepCountKnown")},
        arms=arms, gpuProbes=probes, temperatureTrace=traces, gpuSeconds=gpu_seconds,
        elapsedSeconds=time.monotonic() - started, recordedAtUtc=now())
    if probe_only:
        result["schemaVersion"] = "ai-painter-endpoint-ab-gpu-qualification-" + version
        result["optimizerCreated"] = False
    save_json(output / ("gpu-qualification-result.json" if probe_only else "result.json"), result)
    progress(result["executionState"])
    return result


def verify_result(root, binding):
    import torch
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "replay requires CPU isolation")
    torch.set_num_threads(4)
    request, package, sampled = validate_request(root, binding)
    result_binding = file_binding(root, request["outputRoot"] + "/result.json")
    result = bound_json(root, result_binding)
    require(result["executionState"] == "completed" and result["optimizerSteps"] == 400, "training incomplete")
    started = time.monotonic()
    def check():
        require(not torch.cuda.is_initialized() and time.monotonic() - started < 120, "CPU result replay budget")
    rows = evaluate(root, request, package, sampled, result["arms"], check, lambda *a, **k: None, verify=True)
    require(rows == result["rows"], "saved training result not exactly reproduced")
    for b in [*request["inputReceipts"], binding, result_binding]:
        read_bound(root, b)
    return {"schemaVersion": "ai-painter-endpoint-ab-replay-v1", "result": result_binding,
        "exactRows": len(rows), "exactPngs": len(rows), "optimizerSteps": 0,
        "cudaInitialized": torch.cuda.is_initialized(), "elapsedSeconds": time.monotonic() - started}


def cpu_phase4_probe(root, binding):
    """Real current-candidate CPU path before GPU; no optimizer or state write."""
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    from ai_painter.complete_world.split_training import state_hash
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "CPU isolation required")
    request, package, _ = validate_request(root, binding)
    require(request_strategy(request) == "v4", "CPU phase4 probe requires v4")
    torch.set_num_threads(4)
    started = time.monotonic()
    def check():
        require(not torch.cuda.is_initialized() and time.monotonic()-started < 150, "CPU probe resource limit")
    model, norm = load_parent(root, request, package)
    prior.trainable_parameters(model); model.eval()
    before = state_hash(model.state_dict())
    dataset = prior.dataset_for(root, {**package, "experimentIdentity": request["identity"]})
    alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
    probes = []
    with exact_inference_runtime(torch):
        for mode in probe_modes("v4"):
            for i, sample in enumerate(prior.previous.SAMPLES):
                check(); model.zero_grad(set_to_none=True)
                item = dataset[i]
                require(item["sampleId"] == sample and item["split"] == "train", "probe train boundary")
                target, conditions = item["image"][None], item["conditions"][None]
                with torch.no_grad():
                    clean = trainer.normalize_latent(model.autoencoder.encode(target), norm)
                seed = seed_for(3, i)
                phase_proof = phase4_gradient_for(model,norm,target,conditions,alpha,seed,package["config"],check)
                require(state_hash(model.state_dict())==before,"phase-only CPU probe mutated model")
                noise = torch.randn(clean.shape, generator=torch.Generator().manual_seed(seed))
                t = trainer.training_timesteps(package["config"], TRAINING["teacherEpochOffset"]+3,i,2,1,1000,"cpu")
                full = trainer.predict_and_measure(model,trainer.add_noise(clean,noise,t,alpha),
                    trainer.velocity_target(clean,noise,t,alpha),clean,t,alpha,conditions,package["config"],
                    target_image=target,latent_normalization=norm)["compositeLossTensor"]
                _, latent = pure_noise_endpoint(model.predict_velocity,conditions,alpha,seed,check=check)
                rgb = trainer.decode_final_visible_rgb(model,trainer.denormalize_latent(latent,norm),conditions,package["config"])
                endpoint,_ = prior.previous.rgb_objective(rgb,target,conditions,package["config"])
                penalty = phase4_residual_loss(rgb,target)
                require(math.isclose(phase_proof["phase4Loss"],float(penalty.detach()),rel_tol=1e-5,abs_tol=1e-8),"CPU phase forward changed")
                loss=full+endpoint+(penalty if mode.endswith("phase4") else 0)
                loss.backward(); reachable=prior.check_gradients(model)
                require(state_hash(model.state_dict())==before,"CPU probe mutated model")
                probes.append({"route":mode,"sampleId":sample,"optimizerCreated":False,"modelStateUnchanged":True,
                    "baseOutputReached":any(n.startswith("denoiser.base_output.") for n in reachable),
                    "gradientL2":float(sum(p.grad.double().square().sum() for p in model.parameters() if p.grad is not None).sqrt()),
                    "frozenGradientCount":sum(p.grad is not None for p in model.parameters() if not p.requires_grad),
                    "phase4Loss":float(penalty.detach()),"phase4GradientL2":phase_proof["phase4GradientL2"]})
                del full,endpoint,penalty,loss,latent,rgb
    require_probes(probes,"v4")
    for b in [binding,*request["inputReceipts"]]: read_bound(root,b)
    check()
    return {"status":"cpu_phase4_probe_passed","request":binding,"probes":probes,
        "modelStateSha256":before,"optimizerSteps":0,"gpuStarted":False,"elapsedSeconds":time.monotonic()-started}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument("--verify-result", action="store_true")
    modes.add_argument("--probe-only", action="store_true", help="v2/v3 only: return after current zero-update GPU qualification")
    modes.add_argument("--cpu-probe-only", action="store_true")
    args = parser.parse_args()
    binding = {"path": args.request, "sha256": args.request_sha256}
    result = cpu_phase4_probe(Path.cwd(), binding) if args.cpu_probe_only else verify_result(Path.cwd(), binding) if args.verify_result else execute(Path.cwd(), binding,probe_only=args.probe_only)
    print(json.dumps(result, allow_nan=False), flush=True)

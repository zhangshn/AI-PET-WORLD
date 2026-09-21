"""One paired train-only experiment: vary the frozen TRAINING decoder only.

Both arms start from the same experimental Denoiser and frozen RGB heads; both
are evaluated through the current decoder. No formal qualification or restart.
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
import sys
import time
import traceback

import compare_rgb_head_multiseed as comparison
import painter_rgb_head_adaptation_experiment as previous
import diagnose_learning_capacity_trajectory as trajectory
from painter_learning_capacity_experiment import (
    bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding,
    now, project_file, read_bound, require, save_json, verify_controller_process,
)

PROGRAM = "ml/ai-painter/scripts/painter_decoder_binding_ab_experiment.py"
TEST = "ml/ai-painter/tests/test_decoder_binding_ab_experiment.py"
POLICY = "data/ai-painter/system-governance/ai-painter-decoder-binding-ab-experiment-policy-v1.json"
ARMS = ("original_decoder_control", "reconstruction_decoder_adaptation")
PREFIX = "denoiser.rgb_responsibility_heads."
TRAINING = {"optimizerStepsPerArm": 1000, "totalOptimizerStepLimit": 2000, "batchSize": 1, "epochsPerArm": 500,
    "seed": 20260908, "optimizer": "AdamW", "learningRate": .0001, "weightDecay": .01,
    "optimizerState": "fresh_identical_per_arm_no_resume", "timestepSampling": "unchanged_deterministic_full_schedule_cover_v2",
    "target": "original_train_rgb", "objective": "unchanged_full_v6_predict_and_measure",
    "trainable": "existing_denoiser_except_all_rgb_responsibility_heads", "checkpointRule": "final_step_only_no_selection"}
RESOURCES = {"maxWallSeconds": 900, "maxGpuSeconds": 600, "cudaMemoryFraction": .7, "minimumFreeVramMiB": 2048,
    "maximumTemperatureC": 85, "minimumFreeDiskMiB": 2048, "maxOutputMiB": 128, "cpuThreads": 4, "automaticRetries": 0}
ZERO_STEP_FAILURE = {
    "path": ".runtime/ai-painter/learning-capacity-experiments/painter-decoder-binding-ab-5b4014c615f6bd7e2d6a91c78b9634070a2612030cbc123ff7c0f3ab4da9a08b/result.json",
    "sha256": "6d4f47794352bc4bda07bb3447dc651912e89cefa7bd0527eab622fde58b7e07"}
DETERMINISM_FAILURE = {
    "path": ".runtime/ai-painter/learning-capacity-experiments/painter-decoder-binding-ab-c90cdf691e52a35f1ab0ef6ba5c31fc0b07ac9a08ba0fd7930342e92a594713c/result.json",
    "sha256": "829318c69da2a53a2ecd3238ff1510343ae28facda816bd71c3eecf9857d8452"}


def validate_policy(value):
    require(value["schemaVersion"] == "ai-painter-decoder-binding-ab-experiment-policy-v1", "wrong policy")
    require(value["scope"] == "two_seen_train_images_decoder_binding_ab_no_formal_qualification", "scope changed")
    require(value["resolution"] == [256, 192] and value["sampleIds"] == previous.SAMPLES, "sample scope changed")
    require(value["arms"] == list(ARMS), "arm scope changed")
    require(value["training"] == TRAINING and value["resources"] == RESOURCES, "training/resource budget changed")
    require(value["comparison"] == {"seedsBySample": comparison.SETTINGS["seedsBySample"], "inferenceSteps": 50,
        "targetUsedForInitialization": False, "sameInitialDenoiser": True, "sameTrainingNoiseAndTimesteps": True,
        "measureBothArmsWithCurrentDecoder": True, "retainAllResults": True}, "comparison changed")
    require(value["frozen"] == ["both_autoencoders", "all_rgb_responsibility_heads", "normalization", "source_rgb_and_conditions",
        "architecture", "loss_formulas_and_weights", "formal_thresholds"], "freeze boundary changed")
    require(value["qualification"] == dict.fromkeys(("formalDatasetQualified", "formalGpuQualified", "formalTrainingAllowed",
        "checkpointPromotable", "formalInferenceEligible", "worldEntryAllowed"), False), "formal qualification forbidden")


def materialize(root):
    policy_binding = file_binding(root, POLICY)
    policy = bound_json(root, policy_binding)
    validate_policy(policy)
    source = bound_json(root, policy["sourceTrajectory"])
    tplan = bound_json(root, source["plan"])
    require(tplan == trajectory.materialize(root), "trajectory inputs no longer reproduce")
    require(source["status"] == "cpu_fixed_trajectory_completed_not_visual_qualified"
            and source["executionState"] == "completed" and source["modelStateUnchanged"] is True
            and source["summary"] == trajectory.summarize(source["rows"]), "trajectory evidence invalid")
    require(source["summary"]["lateLatentErrorIncreaseCount"] == 6, "paired hypothesis lacks frozen evidence")
    old_plan = bound_json(root, tplan["sourcePlan"])
    adaptation = bound_json(root, old_plan["adaptationPackage"])
    origin = bound_json(root, adaptation["sourcePackage"])
    require(adaptation["config"] == origin["config"], "config changed")
    failed = bound_json(root, ZERO_STEP_FAILURE)
    require(failed["executionState"] == "failed_closed" and failed["optimizerSteps"] == 0
            and failed["trainingStarted"] is False, "repair may only consume this zero-step failure")
    failed_dir = str(Path(ZERO_STEP_FAILURE["path"]).parent).replace("\\", "/")
    failed_package_binding = file_binding(root, failed_dir + "/experiment.json")
    failed_package = bound_json(root, failed_package_binding)
    require(failed_package["policy"] == policy_binding and failed_package["config"] == adaptation["config"], "repair expanded policy")
    snapshots = [{"path": failed_dir + "/source-snapshots/" + failed_package[k]["sha256"] + "/" + Path(failed_package[k]["path"]).name,
                  "sha256": failed_package[k]["sha256"]} for k in ("program", "testProgram")]
    second = bound_json(root, DETERMINISM_FAILURE)
    require(second["executionState"] == "failed_closed" and second["optimizerSteps"] == 0
            and second["trainingStarted"] is False, "second repair must also be zero-step")
    second_dir = str(Path(DETERMINISM_FAILURE["path"]).parent).replace("\\", "/")
    second_package_binding = file_binding(root, second_dir + "/experiment.json")
    second_package = bound_json(root, second_package_binding)
    require(second_package["policy"] == policy_binding and second_package["config"] == adaptation["config"], "second repair expanded policy")
    second_snapshots = [{"path": second_dir + "/source-snapshots/" + second_package[k]["sha256"] + "/" + Path(second_package[k]["path"]).name,
                        "sha256": second_package[k]["sha256"]} for k in ("program", "testProgram")]
    receipts = [*tplan["inputReceipts"], policy_binding, policy["sourceTrajectory"], source["plan"],
                ZERO_STEP_FAILURE, failed_package_binding, *snapshots, DETERMINISM_FAILURE, second_package_binding,
                *second_snapshots, file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for b in receipts:
        read_bound(root, b)
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "conflicting binding")
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-decoder-binding-ab-package-v1", "policy": policy_binding,
        "sourceTrajectory": policy["sourceTrajectory"], "sourceComparisonPlan": tplan["sourcePlan"],
        "sourceComparisonResult": tplan["sourceResult"], "adaptationPackage": old_plan["adaptationPackage"],
        "initialDenoiser": old_plan["adaptedCheckpoint"],
        "trainingDecoders": dict(zip(ARMS, (origin["foundation"], adaptation["decoderCheckpoint"]))),
        "inferenceDecoder": adaptation["decoderCheckpoint"], "config": adaptation["config"],
        "training": policy["training"], "resources": policy["resources"], "qualification": policy["qualification"],
        "comparison": policy["comparison"], "selectedRows": adaptation["selectedRows"],
        "supersededZeroStepFailure": ZERO_STEP_FAILURE,
        "supersededZeroStepDeterminismFailure": DETERMINISM_FAILURE,
        "numericRuntime": {"trainingDeterministicAlgorithms": False, "inferenceDeterministicAlgorithms": True,
            "reason": "Existing V6 adaptive-average-pooling CUDA backward has no deterministic implementation.",
            "limitation": "Matching inputs and noise does not make GPU optimizer updates bitwise reproducible; one paired result is diagnostic, not a unique causal proof."},
        "inputReceipts": list(unique.values()), "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST),
        "limits": [policy["interpretation"], "Both arms reset AdamW state and use identical explicitly seeded training noise.",
            "One two-scene experiment cannot establish a universal root cause or independent visual qualification.",
            "Intermediate diagnostics and final train metrics never grant checkpoint selection or publication."]}
    return {**payload, "experimentIdentity": "painter-decoder-binding-ab-" + digest(canonical_bytes(payload))}


def normalization_to_device(normalization, device):
    import torch
    return {key: value.to(device) if isinstance(value, torch.Tensor) else value for key, value in normalization.items()}


def load_arm(root, package, arm, device="cpu"):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    require(arm in ARMS, "unknown arm")
    source_plan = bound_json(root, package["sourceComparisonPlan"])
    model, heads, normalization, _ = comparison.load_frozen_pair(root, source_plan)
    model.denoiser.rgb_responsibility_heads = heads
    before_encoder = state_hash(model.autoencoder.encoder.state_dict())
    cp = torch.load(io.BytesIO(read_bound(root, package["trainingDecoders"][arm])), map_location="cpu", weights_only=True)
    model.autoencoder.load_state_dict(cp["autoencoderState"], strict=True)
    require(state_hash(model.autoencoder.encoder.state_dict()) == before_encoder, "encoder/latent definition changed")
    initial = torch.load(io.BytesIO(read_bound(root, package["initialDenoiser"])), map_location="cpu", weights_only=True)
    require(state_hash(model.denoiser.state_dict()) == initial["denoiserStateSha256"], "initial Denoiser differs")
    return model.to(device).eval().requires_grad_(False), normalization_to_device(normalization, device)


def trainable_parameters(model):
    model.eval().requires_grad_(False)
    model.denoiser.train().requires_grad_(True)
    model.denoiser.rgb_responsibility_heads.eval().requires_grad_(False)
    selected = [(n, p) for n, p in model.named_parameters() if p.requires_grad]
    require(selected and all(n.startswith("denoiser.") and not n.startswith(PREFIX) for n, _ in selected), "trainable boundary changed")
    require(not model.autoencoder.training and all(not p.requires_grad for p in model.autoencoder.parameters()), "AE unfrozen")
    return [p for _, p in selected]


def frozen_hash(model):
    from ai_painter.complete_world.split_training import state_hash
    return state_hash({n: t for n, t in model.state_dict().items() if not n.startswith("denoiser.") or n.startswith(PREFIX)})


def dataset_for(root, package):
    parent = bound_json(root, package["adaptationPackage"])
    dataset = previous.HeadDataset(root, parent)
    dataset.manifest = {"datasetReleaseIdentity": package["experimentIdentity"], "identityPayload": parent["inputIdentity"]}
    return dataset


def check_gradients(model):
    import torch
    reachable = []
    for name, p in model.named_parameters():
        if p.grad is not None:
            require(p.requires_grad and name.startswith("denoiser.") and not name.startswith(PREFIX)
                    and bool(torch.isfinite(p.grad).all()), "invalid or frozen gradient: " + name)
            if bool(p.grad.abs().sum() > 0):
                reachable.append(name)
    require(reachable, "no real Denoiser gradient")
    require(any(n.startswith("denoiser.base_output.") for n in reachable), "base velocity output has no gradient")
    return reachable


def validate_checkpoint(cp, package, arm):
    require(cp.get("schemaVersion") == "ai-painter-decoder-binding-ab-checkpoint-v1", "checkpoint schema")
    require(cp.get("experimentIdentity") == package["experimentIdentity"] and cp.get("arm") == arm, "checkpoint identity")
    require(cp.get("optimizerSteps") == 1000 and cp.get("parentDenoiser") == package["initialDenoiser"], "checkpoint parent/steps")
    require(cp.get("trainingDecoder") == package["trainingDecoders"][arm]
            and cp.get("inferenceDecoder") == package["inferenceDecoder"], "checkpoint decoder binding")
    require(cp.get("checkpointPromotable") is False and cp.get("formalInferenceEligible") is False, "checkpoint promotion")
    require("autoencoderState" not in cp and "optimizerState" not in cp, "unexpected checkpoint asset")


def summarize(rows):
    require([(r["arm"], r["sampleId"], r["seed"]) for r in rows] ==
            [(arm, sample, seed) for arm in ARMS for i, sample in enumerate(previous.SAMPLES)
             for seed in comparison.SETTINGS["seedsBySample"][i]], "incomplete/reordered comparison")
    output = {}
    for arm in ARMS:
        selected = [r for r in rows if r["arm"] == arm]
        output[arm] = {}
        for metric in ("rgbMae", "laplacianMae", "phase4ResidualRmsAfterGlobalBiasRemoval"):
            require(all(isinstance(r[group]["final"][metric], (int, float))
                        and not isinstance(r[group]["final"][metric], bool)
                        and math.isfinite(r[group]["final"][metric]) and r[group]["final"][metric] >= 0
                        for r in selected for group in ("measurements", "baseline")), "invalid comparison metric")
            deltas = [r["measurements"]["final"][metric] - r["baseline"]["final"][metric] for r in selected]
            output[arm][metric] = {"improvedCount": sum(v < 0 for v in deltas), "worseCount": sum(v > 0 for v in deltas),
                "equalCount": sum(v == 0 for v in deltas), "absoluteChangeRange": [min(deltas), max(deltas)]}
    return {"arms": output, "checkpointSelected": False, "formalVisualQualification": False}


def execute(root, package, output):
    import torch
    from torch.utils.data import DataLoader
    from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
    import train_ai_assisted_conditional_denoiser as trainer
    started = time.perf_counter()
    steps, gpu_started, training_started = 0, False, False
    gpu_clock = None
    arms, gpu_probes = [], []

    def progress(phase, **details):
        value = {"experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(), "phase": phase,
            "optimizerSteps": steps, "gpuStarted": gpu_started, "trainingStarted": training_started,
            "elapsedSeconds": time.perf_counter()-started, **details}
        save_json(output / "progress.json", value, mutable=True)
        print(json.dumps(value), flush=True)

    def limits(temperature=False):
        require(time.perf_counter()-started < RESOURCES["maxWallSeconds"], "experiment timeout")
        if gpu_clock is not None:
            require(time.perf_counter()-gpu_clock < RESOURCES["maxGpuSeconds"], "GPU time budget exhausted")
        require(shutil.disk_usage(output).free >= RESOURCES["minimumFreeDiskMiB"] * 2**20, "insufficient disk")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < RESOURCES["maxOutputMiB"] * 2**20, "output budget exceeded")
        if temperature:
            probe = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(probe.returncode == 0 and int(probe.stdout.strip().splitlines()[0]) < RESOURCES["maximumTemperatureC"], "GPU temperature unsafe/unavailable")

    result = {"experimentIdentity": package["experimentIdentity"], "runId": package["experimentIdentity"],
        "schemaVersion": "ai-painter-decoder-binding-ab-result-v1", "qualification": package["qualification"], "limits": package["limits"]}
    try:
        torch.set_num_threads(4)
        torch.use_deterministic_algorithms(False)
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
        require(torch.cuda.is_available(), "CUDA unavailable")
        require(torch.cuda.mem_get_info()[0] >= RESOURCES["minimumFreeVramMiB"] * 2**20, "insufficient VRAM")
        torch.cuda.set_per_process_memory_fraction(RESOURCES["cudaMemoryFraction"])
        torch.cuda.reset_peak_memory_stats()
        gpu_started = True
        result["runtime"] = {"torch": str(torch.__version__), "cuda": torch.version.cuda,
            "gpu": torch.cuda.get_device_name(), "deterministicAlgorithms": torch.are_deterministic_algorithms_enabled(),
            "cpuThreads": torch.get_num_threads()}
        gpu_clock = time.perf_counter()
        limits(True)
        dataset = dataset_for(root, package)
        require(len(dataset) == 2, "dataset expanded")
        alpha = trainer.build_diffusion_schedule(package["config"], "cuda")["alphasCumulative"]

        def batch_inputs(model, normalization, index):
            item = dataset[index]
            require(item["sampleId"] == previous.SAMPLES[index] and item["split"] == "train", "non-train input")
            image, conditions = item["image"][None].to("cuda"), item["conditions"][None].to("cuda")
            require(tuple(image.shape) == (1, 3, 192, 256) and tuple(conditions.shape) == (1, 23, 192, 256), "tensor scope changed")
            with torch.no_grad():
                clean = trainer.normalize_latent(model.autoencoder.encode(image), normalization)
            return image, conditions, clean

        def forward(model, normalization, inputs, timestep, noise):
            image, conditions, clean = inputs
            noisy = trainer.add_noise(clean, noise, timestep, alpha)
            target = trainer.velocity_target(clean, noise, timestep, alpha)
            return trainer.predict_and_measure(model, noisy, target, clean, timestep, alpha, conditions,
                package["config"], target_image=image, latent_normalization=normalization)

        # BOTH exact candidate configurations must pass before ANY optimizer exists.
        initial_denoiser = None
        for arm in ARMS:
            model, normalization = load_arm(root, package, arm, "cuda")
            trainable_parameters(model)
            before = state_hash(model.state_dict())
            initial = state_hash(model.denoiser.state_dict())
            require(initial_denoiser is None or initial == initial_denoiser, "unequal initial Denoisers")
            initial_denoiser = initial
            gradients = []
            generator = torch.Generator(device="cuda").manual_seed(TRAINING["seed"])
            for i in range(2):
                limits(True)
                inputs = batch_inputs(model, normalization, i)
                noise = torch.randn(inputs[2].shape, generator=generator, device="cuda")
                measured = forward(model, normalization, inputs, torch.tensor([489], device="cuda"), noise)
                require(bool(torch.isfinite(measured["compositeLossTensor"])), "nonfinite GPU probe")
                measured["compositeLossTensor"].backward()
                gradients.append(check_gradients(model))
                model.zero_grad(set_to_none=True)
            require(state_hash(model.state_dict()) == before, "zero-update probe changed weights")
            gpu_probes.append({"arm": arm, "status": "no_update_gpu_probe_passed", "optimizerCreated": False,
                "modelStateUnchanged": True, "stateSha256": before, "gradientParametersBySample": gradients,
                "device": torch.cuda.get_device_name(), "formalGpuQualified": False})
            progress("gpu_zero_update_probe_passed", arm=arm)
            del measured, inputs, model
            torch.cuda.empty_cache()
        save_json(output / "gpu-probes.json", {"probes": gpu_probes, "optimizerSteps": 0, "bothArmsPassedBeforeTraining": True})

        for arm in ARMS:
            model, normalization = load_arm(root, package, arm, "cuda")
            parameters = trainable_parameters(model)
            frozen_before = frozen_hash(model)
            require(state_hash(model.denoiser.state_dict()) == initial_denoiser, "training did not reset to common parent")
            inputs = [batch_inputs(model, normalization, i) for i in range(2)]
            input_hash = state_hash(inputs)
            optimizer = torch.optim.AdamW(parameters, lr=TRAINING["learningRate"], weight_decay=TRAINING["weightDecay"])
            generator = torch.Generator(device="cuda").manual_seed(TRAINING["seed"])
            sequence, losses, local_steps = hashlib.sha256(), [], 0
            loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
            with TrainSplitBoundary(model, optimizer, dataset) as boundary:
                for epoch in range(500):
                    for index, batch in enumerate(boundary.wrap_loader(loader)):
                        limits(local_steps % 50 == 0)
                        require(batch["sampleId"] == [previous.SAMPLES[index]], "training order changed")
                        t = trainer.training_timesteps(package["config"], epoch, index, 2, 1, 1000, "cuda")
                        noise = torch.randn(inputs[index][2].shape, generator=generator, device="cuda")
                        sequence.update(canonical_bytes({"sample": previous.SAMPLES[index], "t": int(t.item())}))
                        sequence.update(noise.detach().cpu().contiguous().numpy().tobytes())
                        optimizer.zero_grad(set_to_none=True)
                        measured = forward(model, normalization, inputs[index], t, noise)
                        loss = measured["compositeLossTensor"]
                        require(bool(torch.isfinite(loss)), "nonfinite training loss")
                        loss.backward()
                        check_gradients(model)
                        if not training_started:
                            training_started = True
                            progress("first_optimizer_step_starting", arm=arm)
                        optimizer.step()
                        steps += 1
                        local_steps += 1
                        losses.append(float(loss.detach()))
                        if local_steps % 50 == 0:
                            progress("training", arm=arm, armOptimizerSteps=local_steps)
                ledger = boundary.evidence()
            require(local_steps == ledger["optimizerSteps"] == 1000, "step ledger incomplete")
            require(frozen_hash(model) == frozen_before and state_hash(inputs) == input_hash, "frozen state/input changed")
            require(state_hash(model.denoiser.state_dict()) != initial_denoiser, "Denoiser did not change")
            save_json(output / (arm + "-steps.json"), ledger)
            model.eval().requires_grad_(False)
            cp = {"schemaVersion": "ai-painter-decoder-binding-ab-checkpoint-v1", "experimentIdentity": package["experimentIdentity"],
                "arm": arm, "optimizerSteps": 1000, "parentDenoiser": package["initialDenoiser"],
                "trainingDecoder": package["trainingDecoders"][arm], "inferenceDecoder": package["inferenceDecoder"],
                "checkpointPromotable": False, "formalInferenceEligible": False, "frozenStateSha256": frozen_before,
                "denoiserState": {k: v.detach().cpu() for k, v in model.denoiser.state_dict().items()},
                "denoiserStateSha256": state_hash(model.denoiser.state_dict())}
            validate_checkpoint(cp, package, arm)
            cp_path = output / (arm + ".pt")
            with cp_path.open("xb") as stream:
                torch.save(cp, stream)
                stream.flush()
                os.fsync(stream.fileno())
            reloaded, _ = load_arm(root, package, arm, "cuda")
            loaded = torch.load(cp_path, map_location="cpu", weights_only=True)
            validate_checkpoint(loaded, package, arm)
            reloaded.denoiser.load_state_dict(loaded["denoiserState"], strict=True)
            require(state_hash(reloaded.denoiser.state_dict()) == loaded["denoiserStateSha256"] and frozen_hash(reloaded) == frozen_before,
                    "checkpoint reload state mismatch")
            with torch.inference_mode(), exact_inference_runtime(torch):
                for i in range(2):
                    current = forward(model, normalization, inputs[i], torch.tensor([489], device="cuda"), noise)
                    restored = forward(reloaded, normalization, inputs[i], torch.tensor([489], device="cuda"), noise)
                    require(torch.equal(current["predictedRgbTensor"], restored["predictedRgbTensor"]), "fresh-object GPU RGB mismatch")
            arms.append({"arm": arm, "optimizerSteps": local_steps, "initialDenoiserStateSha256": initial_denoiser,
                "trainingInputStateSha256": input_hash, "noiseAndTimestepSequenceSha256": sequence.hexdigest(),
                "frozenStateUnchanged": True, "frozenStateSha256": frozen_before, "checkpointReloadExact": True,
                "checkpoint": file_binding(root, str(cp_path.relative_to(root)).replace("\\", "/")),
                "losses": losses, "stepEvidence": file_binding(root, str((output / (arm + "-steps.json")).relative_to(root)).replace("\\", "/"))})
            save_json(output / (arm + "-training.json"), arms[-1])
            progress("arm_training_and_reload_completed", arm=arm)
            del optimizer, model, reloaded, inputs, measured, loss, loaded, cp, current, restored, parameters
            torch.cuda.empty_cache()
        require(arms[0]["noiseAndTimestepSequenceSha256"] == arms[1]["noiseAndTimestepSequenceSha256"], "training random sequences differ")
        require(arms[0]["trainingInputStateSha256"] == arms[1]["trainingInputStateSha256"], "training tensors differ")
        result["gpuSeconds"] = time.perf_counter()-gpu_clock
        result["peakAllocatedMiB"] = torch.cuda.max_memory_allocated()/2**20
        gpu_clock = None
        rows = evaluate(root, package, output, arms, limits, progress)
        for b in package["inputReceipts"]:
            read_bound(root, b)
        limits()
        result.update(status="experiment_executed_not_visual_qualified", executionState="completed", arms=arms,
            rows=rows, summary=summarize(rows), checkpointReloadExact=True,
            inputBindingsReverified=len(package["inputReceipts"]))
    except Exception as error:
        result.update(status="decoder_binding_ab_failed_closed", executionState="failed_closed", arms=arms,
            error=str(error), traceback=traceback.format_exc(), checkpointReloadExact=False)
    result.update(recordedAtUtc=now(), elapsedSeconds=time.perf_counter()-started, gpuStarted=gpu_started,
        trainingStarted=training_started, optimizerSteps=steps,
        artifacts=[file_binding(root, str(p.relative_to(root)).replace("\\", "/")) for p in sorted(output.iterdir())
                   if p.suffix in (".pt", ".png") or p.name.endswith(("-steps.json", "-training.json")) or p.name == "gpu-probes.json"])
    save_json(output / "result.json", result)
    progress(result["executionState"])
    return 0 if result["executionState"] == "completed" else 1


def evaluate(root, package, output, arms, check, progress):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    import train_ai_assisted_conditional_denoiser as trainer
    previous_result = bound_json(root, package["sourceComparisonResult"])
    source_plan = bound_json(root, package["sourceComparisonPlan"])
    rows = []
    for arm in arms:
        # Both inference arms intentionally use the current decoder and unchanged RGB heads.
        model, heads, normalization, adaptation = comparison.load_frozen_pair(root, source_plan)
        model.denoiser.rgb_responsibility_heads = heads
        expected_heads = state_hash(heads.state_dict())
        cp = torch.load(io.BytesIO(read_bound(root, arm["checkpoint"])), map_location="cpu", weights_only=True)
        validate_checkpoint(cp, package, arm["arm"])
        model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "inference Denoiser hash mismatch")
        require(state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) == expected_heads, "inference heads changed")
        before = state_hash(model.state_dict())
        dataset = previous.HeadDataset(root, adaptation)
        alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(previous.SAMPLES):
                item = dataset[i]
                conditions = item["conditions"][None]
                for j, seed in enumerate(comparison.SETTINGS["seedsBySample"][i]):
                    _, latent, _ = comparison.paired.pure_noise_rollout(torch, model.predict_velocity, (1, 12, 48, 64), conditions, alpha, seed, check)
                    rgb, evidence = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent, normalization), conditions,
                        package["config"], return_stage4_semantic_responsibility_evidence=True)
                    baseline = previous_result["rows"][i*3+j]
                    require((baseline["sampleId"], baseline["seed"]) == (sample, seed), "baseline order mismatch")
                    measured = comparison.measure(torch, rgb, evidence, item["image"][None], conditions, package["config"])
                    trainer.save_tensor_png(rgb[0], output / f"{arm['arm']}-{i}-{j}.png")
                    rows.append({"arm": arm["arm"], "sampleId": sample, "split": "train", "seed": seed,
                        "targetUsedForInitialization": False, "measurements": measured, "baseline": baseline["measurements"]["adapted"]})
                    progress("fixed_seed_evaluation", arm=arm["arm"], completed=len(rows), total=12)
        require(state_hash(model.state_dict()) == before, "CPU evaluation mutated model")
    return rows


def registry(root, mode, directory):
    # Existing transactional registry only. Transient Windows IO retries finalize
    # the same prepared transaction; they never repeat training or preparation.
    bridge = previous.REGISTRY
    replacements = (("advanceCurrentExecutionRegistry} from", "prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from"),
        ("const done=await advanceCurrentExecutionRegistry(", "const prepared=await prepareCurrentExecutionRegistryAdvance("),
        ("bounded_rgb_head_adaptation_experiment", "bounded_decoder_binding_ab_experiment"),
        ("Adapt five existing road/object RGB heads with frozen AE and velocity path; no formal qualification",
         "Paired Denoiser training with two frozen decoder bindings; identical train inputs; no formal qualification"),
        ("rgb_head_experiment_", "decoder_binding_ab_"), ("head_experiment_", "decoder_binding_ab_"))
    for old, new in replacements:
        require(old in bridge, "registry bridge changed")
        bridge = bridge.replace(old, new)
    marker = "assert(done.ok,JSON.stringify(done));"
    require(marker in bridge, "registry completion marker changed")
    bridge = bridge.replace(marker, """
let done;for(let attempt=0;attempt<6;attempt++){try{
done=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:process.cwd(),transactionId:prepared.transactionId});break;
}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt===5)throw error;
await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));}}
assert(done.ok,JSON.stringify(done));""")
    run = subprocess.run(["node", "--input-type=module", "-e", bridge, mode, directory, str(os.getpid())],
        cwd=root, capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    require(run.returncode == 0, "registry update failed: " + run.stderr[-4000:])
    return json.loads(run.stdout.strip())


def controller(root):
    package = materialize(root)
    directory = previous.ROOT + "/" + package["experimentIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)  # No replay of an executed identity.
    save_json(output / "experiment.json", package)
    tests = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", Path(TEST).name, "-v"],
        cwd=root, env={**os.environ, "CUDA_VISIBLE_DEVICES": ""}, capture_output=True, text=True, timeout=120,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    save_json(output / "cpu-tests.json", {"status": "ab_cpu_tests_passed" if tests.returncode == 0 else "ab_cpu_tests_failed",
        "executionState": "completed" if tests.returncode == 0 else "failed_closed", "recordedAtUtc": now(),
        "exitCode": tests.returncode, "stdout": tests.stdout, "stderr": tests.stderr, "program": package["testProgram"]})
    require(tests.returncode == 0, "CPU tests failed: " + tests.stderr[-3000:])
    require(package == materialize(root), "inputs changed during tests")
    try:
        lease = registry(root, "begin", directory)
    except Exception as error:
        save_json(output / "launch-failure.json", {"status": "registry_begin_failed", "executionState": "failed_closed",
            "recordedAtUtc": now(), "error": str(error), "gpuStarted": False, "trainingStarted": False})
        raise
    save_json(output / "registry-start.json", lease)
    binding = file_binding(root, directory + "/experiment.json")
    child = None
    try:
        with (output / "worker.log").open("xb") as log:
            env = {**os.environ, "CUBLAS_WORKSPACE_CONFIG": ":4096:8", "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"}
            child = subprocess.Popen([sys.executable, str(root / PROGRAM), "worker", "--package", binding["path"], "--sha256", binding["sha256"]],
                cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            save_json(output / "controller-lease.json", {"experimentIdentity": package["experimentIdentity"], "workerParentPid": os.getpid(),
                "workerLauncherPid": child.pid, "registryRevision": lease["revision"], "registrySha256": lease["sha256"]})
            started = time.perf_counter()
            while True:
                try:
                    code = child.wait(timeout=5)
                    break
                except subprocess.TimeoutExpired:
                    previous.refresh_heartbeat(output / "heartbeat.json")
                    require(time.perf_counter()-started <= RESOURCES["maxWallSeconds"]+30, "controller hard timeout")
            result = json.loads((output / "result.json").read_text(encoding="utf-8"))
            require(result["experimentIdentity"] == package["experimentIdentity"], "worker result identity mismatch")
            require((code == 0) == (result["executionState"] == "completed"), "exit/terminal mismatch")
            if code == 0:
                require(result["optimizerSteps"] == 2000 and result["checkpointReloadExact"] is True, "incomplete execution")
                require(result["summary"] == summarize(result["rows"]), "summary mismatch")
                for b in result["artifacts"]:
                    read_bound(root, b)
    except Exception as error:
        previous.stop_owned(child)
        progress = json.loads((output / "progress.json").read_text(encoding="utf-8")) if (output / "progress.json").exists() else {}
        failure = {"status": "decoder_binding_ab_controller_failed_closed", "executionState": "failed_closed",
            "runId": package["experimentIdentity"], "experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(),
            "error": str(error), "gpuStarted": progress.get("gpuStarted"), "trainingStarted": progress.get("trainingStarted"),
            "lastConfirmedOptimizerSteps": progress.get("optimizerSteps"), "actualFinalOptimizerSteps": None,
            "qualification": package["qualification"]}
        save_json(output / "controller-failure.json", failure)
        if not (output / "result.json").exists():
            save_json(output / "result.json", failure)
        raise
    finally:
        try:
            previous.refresh_heartbeat(output / "heartbeat.json")
        except OSError as error:
            save_json(output / "final-heartbeat-warning.json", {"error": str(error), "recordedAtUtc": now()})
        save_json(output / "registry-finish.json", registry(root, "finish", directory))
    print(json.dumps({"status": result["status"], "result": file_binding(root, directory + "/result.json")}), flush=True)
    return code


def worker(root, binding):
    package = bound_json(root, binding)
    require(package == materialize(root), "worker package changed")
    require(binding["path"] == previous.ROOT + "/" + package["experimentIdentity"] + "/experiment.json", "worker namespace changed")
    output = project_file(root, binding["path"]).parent
    for _ in range(20):
        if (output / "controller-lease.json").exists():
            break
        time.sleep(.05)
    lease = json.loads((output / "controller-lease.json").read_text(encoding="utf-8"))
    registry_bytes = project_file(root, ".runtime/ai-painter/current-execution-registry/current.json").read_bytes()
    require(digest(registry_bytes) == lease["registrySha256"], "stale worker registry")
    verify_controller_process(lease, json.loads(registry_bytes), os.getppid())
    require(lease["experimentIdentity"] == package["experimentIdentity"], "worker identity mismatch")
    save_json(output / "worker-started.json", {"processId": os.getpid(), "recordedAtUtc": now(), "package": binding})
    return execute(root, package, output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("run", "worker"))
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.mode == "run":
        require(args.package is None and args.sha256 is None, "controller cannot accept arbitrary package")
        raise SystemExit(controller(Path.cwd()))
    require(args.package and args.sha256, "worker requires bound package")
    raise SystemExit(worker(Path.cwd(), {"path": args.package, "sha256": args.sha256}))

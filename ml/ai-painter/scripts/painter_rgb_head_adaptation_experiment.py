"""Bounded RGB-head adapter using the existing registry and train-step boundary.

All predecessor model programs stay byte-identical. Five existing RGB heads may learn;
the experimental AE and the Denoiser velocity/condition path remain frozen.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import traceback

from painter_learning_capacity_experiment import (
    ExperimentDataset, bound_json, canonical_bytes, digest, exact_inference_runtime,
    file_binding, now, project_file, read_bound, require, save_json, validate_experiment_checkpoint,
)
from painter_decoder_reconstruction_experiment import SAMPLES, RESOURCES, validate_checkpoint as validate_decoder_checkpoint
from compare_learning_capacity_decoders import materialize_plan, pure_noise_rollout, refresh_heartbeat

POLICY = "data/ai-painter/system-governance/ai-painter-rgb-head-adaptation-experiment-policy-v2.json"
PROGRAM = "ml/ai-painter/scripts/painter_rgb_head_adaptation_experiment.py"
TEST = "ml/ai-painter/tests/test_rgb_head_adaptation_experiment.py"
ROOT = ".runtime/ai-painter/learning-capacity-experiments"
HEADS = ("terrain_path_ground", "object_footprints", "object_tree", "object_rock", "object_vegetation")
PREFIXES = tuple("denoiser.rgb_responsibility_heads." + name + "." for name in HEADS)
TRAINING = {"epochs": 500, "batchSize": 1, "seed": 20260908, "optimizer": "AdamW", "learningRate": 0.0001,
    "weightDecay": 0.01, "observationSteps": [0, 100, 400, 1000], "checkpointRule": "final_step_only_no_selection",
    "cachedGeneratedLatents": "exact_bound_cpu_pure_noise_rollout_tensors_for_the_same_two_train_samples",
    "target": "original_train_rgb_not_reconstruction_or_model_output",
    "objective": "existing_v6_rgb_terms_and_weights_exact_gradient_equivalent_for_rgb_heads"}
RGB_KEYS = ("decodedRgb", "decodedRgbGradient", "decodedRgbLaplacian", "decodedRgbQuietRegionExcess",
    "sparseRegionDecodedRgb", "sparseRegionContrast", "spatialGridRgb", "pathBoundaryRgb", "objectSemanticRgb",
    "pathInteriorRgb", "pathForbiddenBoundaryRgb")


def validate_policy(policy):
    require(policy["schemaVersion"] == "ai-painter-rgb-head-adaptation-experiment-policy-v2", "policy schema mismatch")
    require(policy["scope"] == "two_seen_train_images_rgb_heads_only_no_formal_qualification", "scope changed")
    require(policy["sampleIds"] == SAMPLES and policy["resolution"] == [256, 192], "samples/resolution changed")
    require(policy["trainableHeads"] == list(HEADS), "head scope changed")
    require(policy["training"] == TRAINING and policy["resources"] == RESOURCES, "training/resource budget changed")
    require(policy["qualification"] == dict.fromkeys(("formalDatasetQualified", "formalGpuQualified", "formalTrainingAllowed",
            "checkpointPromotable", "formalInferenceEligible", "worldEntryAllowed"), False), "qualification forbidden")
    require(policy["frozen"] == ["autoencoder_encoder", "autoencoder_decoder", "denoiser_velocity_and_condition_path", "unused_rgb_heads", "architecture", "loss_formulas_and_weights", "source_files", "formal_thresholds"], "freeze policy changed")
    require(policy["prohibited"] == ["holdout_content", "source_overwrite", "whole_model_retraining", "head_bypass", "automatic_retry", "world_publication", "shutdown"], "prohibited actions changed")


def materialize(root):
    policy_binding = file_binding(root, POLICY)
    policy = bound_json(root, policy_binding)
    validate_policy(policy)
    result = bound_json(root, policy["comparisonResult"])
    require(result["status"] == "cpu_paired_decoder_comparison_completed_not_visual_qualified"
            and result["modelStatesUnchanged"] is True and result["optimizerSteps"] == 0, "completed frozen comparison required")
    plan = bound_json(root, result["plan"])
    require(plan == materialize_plan(root, plan["decoderResult"]), "comparison inputs no longer reproduce")
    artifacts = {Path(b["path"]).name: b for b in result["artifacts"]}
    tensors = [artifacts[f"sampling-tensors-{i}.pt"] for i in range(2)]
    source = bound_json(root, plan["sourcePackage"])
    config = source["config"]
    require(config["training"]["denoiserLearningRate"] == TRAINING["learningRate"], "original learning rate changed")
    from ai_painter_stage4_semantic_transport_v2_trainer_support import EXPECTED_DENOISER_LOSS_WEIGHTS
    require(config["training"]["denoiserLossWeights"] == EXPECTED_DENOISER_LOSS_WEIGHTS, "original Loss weights changed")
    for name in ("pathCoverageCalibration", "authorizedBoundaryTopology", "pathActivationMassCalibration", "stage4RequiredBoundaryContact"):
        require(config["training"].get(name, {}).get("enabled") is not True, "unhandled enabled optional objective")
    receipts = [*plan["inputReceipts"], policy_binding, policy["comparisonResult"], result["plan"], *tensors,
        file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for b in receipts:
        read_bound(root, b)
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "input binding conflict")
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-rgb-head-adaptation-package-v1", "policy": policy_binding,
        "comparisonResult": policy["comparisonResult"], "comparisonPlan": result["plan"], "sourcePackage": plan["sourcePackage"],
        "denoiserCheckpoint": plan["sourceCheckpoint"], "decoderCheckpoint": plan["decoderCheckpoint"],
        "decoderPackage": plan["decoderPackage"], "samplingTensors": tensors, "selectedRows": source["selectedRows"],
        "inputIdentity": source["inputIdentity"], "config": config, "training": policy["training"],
        "resources": policy["resources"], "qualification": policy["qualification"], "inputReceipts": list(unique.values()),
        "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST)}
    return {**payload, "experimentIdentity": "painter-rgb-head-adaptation-" + digest(canonical_bytes(payload))}


def head_parameters(model):
    model.eval().requires_grad_(False)
    for key in HEADS:
        model.denoiser.rgb_responsibility_heads[key].train().requires_grad_(True)
    parameters = [p for name, p in model.named_parameters() if p.requires_grad]
    require(parameters and all(name.startswith(PREFIXES) for name, p in model.named_parameters() if p.requires_grad), "non-head trainable parameter")
    return parameters


def frozen_state(model):
    from ai_painter.complete_world.split_training import state_hash
    return state_hash({name: value for name, value in model.state_dict().items() if not name.startswith(PREFIXES)})


def validate_coverage(model, conditions, config):
    coverage = {}
    for name in model.denoiser.rgb_responsibility_heads:
        weight = float(conditions[:, config["conditionChannelOrder"].index(name)].sum())
        require((name in HEADS) == (weight > 0), "unexpected head coverage: " + name)
        coverage[name] = weight
    return coverage


def rgb_objective(predicted, target, conditions, config):
    """Exact existing V6 RGB-dependent terms; frozen-path constants are omitted.

The test compares gradients against composite_denoiser_losses_v6. No invented
velocity/probe metrics are written as real training measurements.
"""
    import torch
    import train_ai_assisted_conditional_denoiser as original
    rgb_mae = torch.nn.functional.l1_loss(predicted, target)
    gradient, laplacian = original.multiscale_latent_hierarchy_losses(predicted, target, config)
    values = {"decodedRgb": rgb_mae, "decodedRgbGradient": gradient,
        "decodedRgbLaplacian": laplacian, "decodedRgbQuietRegionExcess": original.quiet_region_excess_loss(predicted, target, config),
        "sparseRegionDecodedRgb": original.sparse_region_rgb_loss(predicted, target, conditions, config),
        "sparseRegionContrast": original.sparse_region_contrast_loss(predicted, target, conditions, config),
        "spatialGridRgb": original.spatial_grid_rgb_loss(predicted, target),
        "pathBoundaryRgb": original.path_boundary_rgb_loss(predicted, target, conditions, config),
        "objectSemanticRgb": original.object_semantic_rgb_losses(predicted, target, conditions, config)["objectSemanticRgbMae"],
        "pathInteriorRgb": original.path_interior_rgb_loss(predicted, target, conditions, config),
        "pathForbiddenBoundaryRgb": original.path_forbidden_boundary_rgb_loss(predicted, target, conditions, config)}
    require(set(values) == set(RGB_KEYS), "missing existing RGB objective")
    return sum(values[key] * float(weight) for key, weight in config["training"]["denoiserLossWeights"].items() if key in values), values


class HeadDataset(ExperimentDataset):
    def __init__(self, root, package):
        super().__init__(root, bound_json(root, package["sourcePackage"]))
        self.manifest = {"datasetReleaseIdentity": package["experimentIdentity"], "identityPayload": package["inputIdentity"]}
        self._cache = {}

    def __getitem__(self, index):
        if index not in self._cache:
            self._cache[index] = super().__getitem__(index)
        return self._cache[index]


def load_models(root, package, device):
    import torch
    from ai_painter.complete_world.model import build_complete_world_system
    from ai_painter.complete_world.split_training import state_hash
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
    load = lambda b: torch.load(io.BytesIO(read_bound(root, b)), map_location="cpu", weights_only=True)
    cp, decoder = load(package["denoiserCheckpoint"]), load(package["decoderCheckpoint"])
    validate_experiment_checkpoint(cp, bound_json(root, package["sourcePackage"]))
    validate_decoder_checkpoint(decoder, bound_json(root, package["decoderPackage"]))
    require(cp["optimizerSteps"] == 6000 and cp["config"] == package["config"], "source Denoiser mismatch")
    model = build_complete_world_system(package["config"])
    model.autoencoder.load_state_dict(decoder["autoencoderState"], strict=True)
    model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
    require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "Denoiser hash mismatch")
    require(state_dict_sha256(model.autoencoder.state_dict()) == decoder["autoencoderStateSha256"], "decoder hash mismatch")
    require(state_hash(model.autoencoder.encoder.state_dict()) == decoder["encoderStateSha256"], "encoder hash mismatch")
    return model.to(device).eval().requires_grad_(False), cp["latentNormalization"]


def validate_checkpoint(cp, package):
    require(cp.get("schemaVersion") == "ai-painter-rgb-head-adaptation-checkpoint-v2", "checkpoint schema mismatch")
    require(cp.get("experimentIdentity") == package["experimentIdentity"] and cp.get("optimizerSteps") == 1000, "checkpoint identity/budget mismatch")
    require(cp.get("trainableHeads") == list(HEADS) and cp.get("selectedSampleIds") == SAMPLES, "checkpoint scope mismatch")
    require(cp.get("parentDenoiser") == package["denoiserCheckpoint"] and cp.get("frozenDecoder") == package["decoderCheckpoint"], "checkpoint lineage mismatch")
    require(cp.get("checkpointPromotable") is False and cp.get("formalInferenceEligible") is False, "checkpoint promotion forbidden")
    require("autoencoderState" not in cp and "optimizerState" not in cp, "unexpected checkpoint asset")


def train(root, package, output):
    import torch
    from torch.utils.data import DataLoader
    from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
    from train_ai_assisted_conditional_denoiser import decode_final_visible_rgb, denormalize_latent, save_tensor_png
    from diagnose_learning_capacity_timesteps import decomposition_metrics
    started, steps, gpu_started, training_started = time.perf_counter(), 0, False, False
    budget, observations, losses = package["resources"], [], []

    def progress(phase):
        save_json(output / "progress.json", {"experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(),
            "phase": phase, "optimizerSteps": steps, "gpuStarted": gpu_started, "trainingStarted": training_started,
            "elapsedSeconds": time.perf_counter() - started}, mutable=True)
        print(json.dumps({"phase": phase, "optimizerSteps": steps, "recordedAtUtc": now()}), flush=True)

    def limits(temperature=False):
        require(time.perf_counter() - started < budget["maxWallSeconds"], "head adaptation timeout")
        require(shutil.disk_usage(output).free >= budget["minimumFreeDiskMiB"] * 2**20, "insufficient disk")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < budget["maxOutputMiB"] * 2**20, "output budget exceeded")
        if temperature:
            probe = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"], capture_output=True,
                text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(probe.returncode == 0 and int(probe.stdout.strip().splitlines()[0]) < budget["maximumTemperatureC"], "GPU temperature unsafe/unavailable")

    try:
        torch.set_num_threads(4)
        torch.manual_seed(TRAINING["seed"])
        require(torch.cuda.is_available(), "CUDA unavailable")
        require(torch.cuda.mem_get_info()[0] >= budget["minimumFreeVramMiB"] * 2**20, "insufficient free VRAM")
        torch.cuda.set_per_process_memory_fraction(budget["cudaMemoryFraction"])
        torch.cuda.reset_peak_memory_stats()
        limits(True)
        gpu_started = True
        device = torch.device("cuda")
        model, normalization = load_models(root, package, device)
        parameters = head_parameters(model)
        frozen_before = frozen_state(model)
        heads_before = state_hash(model.denoiser.rgb_responsibility_heads.state_dict())
        dataset = HeadDataset(root, package)
        targets, conditions, latents = [], [], []
        comparison_plan = bound_json(root, package["comparisonPlan"])
        for i in range(2):
            item = dataset[i]
            tensor = torch.load(io.BytesIO(read_bound(root, package["samplingTensors"][i])), map_location="cpu", weights_only=True)
            require(tensor["comparisonIdentity"] == comparison_plan["comparisonIdentity"] and tensor["sampleId"] == item["sampleId"], "cached latent/sample mismatch")
            require(tensor["targetUsedForInitialization"] is False and tensor["seed"] == TRAINING["seed"] + 3000 + i, "invalid cached generation")
            require(state_hash(item["conditions"][None]) == tensor["conditionStateSha256"], "cached condition identity mismatch")
            raw = denormalize_latent(tensor["normalizedGeneratedLatent"], normalization)
            require(torch.equal(raw, tensor["denormalizedGeneratedLatent"]), "cached normalization mismatch")
            targets.append(item["image"][None].to(device))
            conditions.append(item["conditions"][None].to(device))
            latents.append(raw.to(device).detach())
        fixed_inputs = state_hash((targets, conditions, latents))

        def forward(index):
            return decode_final_visible_rgb(model, latents[index], conditions[index], package["config"],
                return_stage4_semantic_responsibility_evidence=True)

        def check_gradients():
            for name, p in model.named_parameters():
                require(p.grad is None or (name.startswith(PREFIXES) and bool(torch.isfinite(p.grad).all())), "invalid/non-head gradient")
            for head in HEADS:
                require(any(p.grad is not None and bool(p.grad.abs().sum() > 0) for p in model.denoiser.rgb_responsibility_heads[head].parameters()), "head missing real gradient: " + head)

        progress("no_update_gpu_probe")
        final, evidence = forward(0)
        coverage = [validate_coverage(model, c, package["config"]) for c in conditions]
        loss, _ = rgb_objective(final, targets[0], conditions[0], package["config"])
        require(bool(torch.isfinite(loss)), "nonfinite probe")
        loss.backward()
        check_gradients()
        require(frozen_state(model) == frozen_before and state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) == heads_before, "probe updated model")
        save_json(output / "gpu-probe.json", {"status": "head_only_no_update_gpu_probe_passed", "optimizerCreated": False,
            "weightsChanged": False, "gradientHeads": list(HEADS), "device": torch.cuda.get_device_name(),
            "formalGpuQualified": False, "torch": torch.__version__, "cuda": torch.version.cuda, "sampleHeadCoverage": coverage})
        model.zero_grad(set_to_none=True)
        del final, evidence, loss

        def observe(step):
            rows = []
            with torch.no_grad(), exact_inference_runtime(torch):
                for i in range(2):
                    rgb, evidence = forward(i)
                    measured = decomposition_metrics(torch, rgb, evidence, targets[i])
                    objective, values = rgb_objective(rgb, targets[i], conditions[i], package["config"])
                    measured["headDependentObjective"] = float(objective)
                    measured["objectiveTerms"] = {k: float(v) for k, v in values.items()}
                    measured["semanticRegions"] = {}
                    for name in HEADS:
                        mask = conditions[i][:, package["config"]["conditionChannelOrder"].index(name):][:, :1]
                        measured["semanticRegions"][name] = {"pixelWeight": float(mask.sum()),
                            "rgbMae": float(((rgb - targets[i]).abs() * mask).sum() / (3 * mask.sum()))}
                    rows.append({"sampleId": SAMPLES[i], "split": "train", "measurements": measured})
                    save_tensor_png(rgb[0], output / f"step-{step}-{i}.png")
                    if step == 0:
                        save_tensor_png(evidence["baseDecodedRgb"][0], output / f"base-{i}.png")
                        save_tensor_png(targets[i][0], output / f"target-{i}.png")
            record = {"optimizerSteps": step, "rows": rows, "checkpointSelected": False, "formalVisualQualification": False}
            observations.append(record)
            save_json(output / f"observation-{step}.json", record)

        observe(0)
        optimizer = torch.optim.AdamW(parameters, lr=TRAINING["learningRate"], weight_decay=TRAINING["weightDecay"])
        loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
        with TrainSplitBoundary(model, optimizer, dataset) as boundary:
            for epoch in range(500):
                for batch in boundary.wrap_loader(loader):
                    limits(steps % 50 == 0)
                    i = SAMPLES.index(batch["sampleId"][0])
                    optimizer.zero_grad(set_to_none=True)
                    rgb, _ = forward(i)
                    loss, _ = rgb_objective(rgb, targets[i], conditions[i], package["config"])
                    require(bool(torch.isfinite(loss)), "nonfinite training objective")
                    loss.backward()
                    check_gradients()
                    training_started = True
                    optimizer.step()
                    steps += 1
                    losses.append(float(loss.detach()))
                if steps % 50 == 0:
                    progress("training")
                if steps in TRAINING["observationSteps"]:
                    with boundary.evaluation():
                        observe(steps)
            ledger = boundary.evidence()
        require(steps == ledger["optimizerSteps"] == 1000, "optimizer ledger incomplete")
        require(frozen_state(model) == frozen_before, "frozen model paths changed")
        require(state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) != heads_before, "heads did not update")
        require(state_hash((targets, conditions, latents)) == fixed_inputs, "fixed inputs changed")
        result = finish(root, package, output, model, normalization, observations, ledger, losses, frozen_before,
            heads_before, started, limits, progress)
    except Exception as error:
        result = {"status": "rgb_head_adaptation_failed_closed", "executionState": "failed_closed", "experimentIdentity": package["experimentIdentity"],
            "runId": package["experimentIdentity"], "recordedAtUtc": now(), "error": str(error), "traceback": traceback.format_exc(),
            "gpuStarted": gpu_started, "trainingStarted": training_started, "optimizerSteps": steps, "qualification": package["qualification"]}
    save_json(output / "result.json", result)
    progress(result["executionState"])
    return 0 if result["executionState"] == "completed" else 1


def finish(root, package, output, model, normalization, observations, ledger, losses, frozen_before, heads_before, started, limits, progress):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    from train_ai_assisted_conditional_denoiser import decode_final_visible_rgb, denormalize_latent, save_tensor_png, build_diffusion_schedule
    from diagnose_learning_capacity_timesteps import decomposition_metrics
    model.eval()
    checkpoint = {"schemaVersion": "ai-painter-rgb-head-adaptation-checkpoint-v2", "experimentIdentity": package["experimentIdentity"],
        "optimizerSteps": 1000, "trainableHeads": list(HEADS), "selectedSampleIds": SAMPLES,
        "parentDenoiser": package["denoiserCheckpoint"], "frozenDecoder": package["decoderCheckpoint"],
        "checkpointPromotable": False, "formalInferenceEligible": False, "frozenPathsStateSha256": frozen_before,
        "denoiserState": {k: v.detach().cpu() for k, v in model.denoiser.state_dict().items()},
        "denoiserStateSha256": state_hash(model.denoiser.state_dict())}
    validate_checkpoint(checkpoint, package)
    with (output / "experimental-checkpoint.pt").open("xb") as stream:
        torch.save(checkpoint, stream)
        stream.flush()
        os.fsync(stream.fileno())
    progress("checkpoint_reload")
    loaded = torch.load(output / "experimental-checkpoint.pt", map_location="cpu", weights_only=True)
    validate_checkpoint(loaded, package)
    reloaded, _ = load_models(root, package, "cuda")
    reloaded.denoiser.load_state_dict(loaded["denoiserState"], strict=True)
    require(state_hash(reloaded.denoiser.state_dict()) == loaded["denoiserStateSha256"], "reloaded head state mismatch")
    require(frozen_state(reloaded) == frozen_before, "reloaded frozen state mismatch")
    dataset = HeadDataset(root, package)
    with torch.inference_mode(), exact_inference_runtime(torch):
        for i in range(2):
            raw = torch.load(io.BytesIO(read_bound(root, package["samplingTensors"][i])), map_location="cpu", weights_only=True)["denormalizedGeneratedLatent"].to("cuda")
            condition = dataset[i]["conditions"][None].to("cuda")
            before = decode_final_visible_rgb(model, raw, condition, package["config"])
            after = decode_final_visible_rgb(reloaded, raw, condition, package["config"])
            require(torch.equal(before, after), "fresh-object GPU decode mismatch")
            save_tensor_png(after[0], output / f"after-{i}.png")
            require(digest((output / f"after-{i}.png").read_bytes()) == digest((output / f"step-1000-{i}.png").read_bytes()), "reloaded PNG mismatch")
    reloaded.to("cpu")
    cpu_before = state_hash(reloaded.state_dict())
    alpha = build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
    generated = []
    progress("cpu_full_generation_recheck")
    with torch.inference_mode(), exact_inference_runtime(torch):
        for i in range(2):
            item = dataset[i]
            condition = item["conditions"][None]
            noise, latent, grid = pure_noise_rollout(torch, reloaded.predict_velocity, (1, 12, 48, 64), condition, alpha,
                TRAINING["seed"] + 3000 + i, limits)
            cached = torch.load(io.BytesIO(read_bound(root, package["samplingTensors"][i])), map_location="cpu", weights_only=True)
            require(torch.equal(noise, cached["noise"]) and torch.equal(latent, cached["normalizedGeneratedLatent"]), "head adaptation changed pure-noise generation trajectory")
            rgb, evidence = decode_final_visible_rgb(reloaded, denormalize_latent(latent, normalization), condition,
                package["config"], return_stage4_semantic_responsibility_evidence=True)
            target = item["image"][None]
            measured = decomposition_metrics(torch, rgb, evidence, target)
            measured["semanticRegions"] = {}
            for name in HEADS:
                mask = condition[:, package["config"]["conditionChannelOrder"].index(name):][:, :1]
                measured["semanticRegions"][name] = {"pixelWeight": float(mask.sum()),
                    "rgbMae": float(((rgb - target).abs() * mask).sum() / (3 * mask.sum()))}
            save_tensor_png(rgb[0], output / f"generated-final-{i}.png")
            save_tensor_png(evidence["baseDecodedRgb"][0], output / f"generated-base-{i}.png")
            generated.append({"sampleId": SAMPLES[i], "split": "train", "inferenceSteps": len(grid),
                "generatedLatentExactlyMatchesBeforeAdaptation": True, "targetUsedForInitialization": False, "measurements": measured})
            progress("cpu_generated_sample_" + str(i))
    require(state_hash(reloaded.state_dict()) == cpu_before, "read-only full generation changed weights")
    for b in package["inputReceipts"]:
        read_bound(root, b)
    limits()
    return {"status": "experiment_executed_not_visual_qualified", "executionState": "completed", "recordedAtUtc": now(),
        "experimentKind": "five_rgb_heads_adaptation_frozen_ae_and_velocity_path", "experimentIdentity": package["experimentIdentity"],
        "runId": package["experimentIdentity"], "optimizerSteps": 1000, "gpuStarted": True, "trainingStarted": True,
        "checkpointReloadExact": True, "checkpointReloadMaxAbsoluteDifference": 0, "frozenPathsUnchanged": True,
        "frozenPathsStateSha256BeforeAndAfter": frozen_before, "headsStateSha256Before": heads_before,
        "headsStateSha256After": state_hash(model.denoiser.rgb_responsibility_heads.state_dict()),
        "stepEvidence": ledger, "perStepHeadDependentObjective": losses, "observations": observations,
        "fullGeneratedRows": generated, "qualification": package["qualification"], "elapsedSeconds": time.perf_counter() - started,
        "peakAllocatedMiB": torch.cuda.max_memory_allocated() / 2**20,
        "artifacts": [file_binding(root, str(p.relative_to(root)).replace("\\", "/")) for p in output.iterdir()
            if p.suffix in (".pt", ".png") or p.name.startswith("observation-") or p.name == "gpu-probe.json"],
        "interpretationLimits": ["Two seen train samples and fixed seeds; no independent/generalization qualification.",
            "GPU cached-latent observations and fresh CPU generation use distinct numerical backends; compare each to its matching baseline.",
            "Execution completion and pixel error reduction do not grant VJ-2, formal Stage4 or Runtime qualification."]}


# The registered controller is this process; only the existing transactional
# registry writer performs state changes. No alternate registry or dispatch UI.
REGISTRY = r'''
import fs from "node:fs";import {createHash} from "node:crypto";import {spawnSync} from "node:child_process";import assert from "node:assert/strict";
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from "./src/server/ai-painter-current-execution-registry.mjs";
const [mode,d,pidText]=process.argv.slice(1),pid=Number(pidText),read=p=>JSON.parse(fs.readFileSync(p)),bind=p=>({path:p,sha256:createHash("sha256").update(fs.readFileSync(p)).digest("hex")});
const write=(p,v)=>{const fd=fs.openSync(p,"wx");try{fs.writeFileSync(fd,JSON.stringify(v,null,2)+"\n");fs.fsyncSync(fd)}finally{fs.closeSync(fd)}};
const pkg=read(d+"/experiment.json"),id=pkg.experimentIdentity,previous=await readCurrentExecutionRegistry(process.cwd());assert(previous.ok);
let active=null;
if(mode==="begin"){
 assert.equal(previous.registry.activeExecution,null);
 const probe=spawnSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; [pscustomobject]@{identity=([string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o'))}|ConvertTo-Json -Compress`],{encoding:"utf8",windowsHide:true,timeout:10000});assert.equal(probe.status,0);
 const identity={capabilityVersion:id,packageId:id,runId:id,processId:pid,processStartIdentity:JSON.parse(probe.stdout.replace(/^\uFEFF/u,"")).identity};
 write(d+"/execution-lock.json",{schemaVersion:"ai-painter-current-active-execution-lock-v1",...identity});
 write(d+"/heartbeat.json",{schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",...identity,executionState:"executing",heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
 active={schemaVersion:"ai-painter-current-active-execution-v1",...identity,executionState:"executing",programLineage:{controller:pkg.program,worker:pkg.program},lock:bind(d+"/execution-lock.json"),heartbeat:{path:d+"/heartbeat.json",ttlSeconds:120}};
}else{assert.equal(mode,"finish");assert.equal(previous.registry.runId,id);assert.equal(previous.registry.activeExecution?.processId,pid)}
const ep=d+(mode==="begin"?"/cpu-tests.json":fs.existsSync(d+"/controller-failure.json")?"/controller-failure.json":"/result.json"),ev=read(ep),capsule=d+"/"+mode+"-capsule.json";
write(capsule,{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:id,integrity:{status:"verified"},evidence:[bind(d+"/experiment.json"),bind(ep)].map((b,i)=>({...b,kind:"head_experiment_"+i,sha256Verified:true}))});
const state=mode==="begin"?"executing":ev.executionState;
const done=await advanceCurrentExecutionRegistry({projectRoot:process.cwd(),capabilityVersion:id,packageId:id,taskId:id,runId:id,taskKind:"bounded_rgb_head_adaptation_experiment",taskGoal:"Adapt five existing road/object RGB heads with frozen AE and velocity path; no formal qualification",queueStatus:mode==="begin"?"running":state,nextMachineAction:null,lifecycleStage:"isolated_implementation",executionState:state,activity:mode==="begin"?"rgb_head_experiment_running":"rgb_head_experiment_"+state,taskCapsulePath:capsule,terminalEvidencePath:ep,activeExecution:active,latestTrainingTerminal:mode==="finish"&&ev.trainingStarted===true?{runId:id,...bind(ep),status:ev.status,evidence:{manifest:bind(ep)}}:null,expectedPreviousRegistryRevision:previous.registry.registryRevision,expectedPreviousRegistrySha256:previous.registrySha256});
assert(done.ok,JSON.stringify(done));console.log(JSON.stringify({revision:done.registry.registryRevision,sha256:done.registrySha256,runId:id,active:done.registry.activeExecution!==null,latestTrainingRunId:done.registry.latestTrainingTerminal.runId}));
'''


def registry(root, mode, directory):
    r = subprocess.run(["node", "--input-type=module", "-e", REGISTRY, mode, directory, str(os.getpid())], cwd=root,
        capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    require(r.returncode == 0, "registry update failed: " + r.stderr[-4000:])
    return json.loads(r.stdout.strip())


def stop_owned(child):
    if child is None or child.poll() is not None:
        return
    if os.name == "nt":
        r = subprocess.run(["taskkill.exe", "/PID", str(child.pid), "/T", "/F"], capture_output=True,
            timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        require(r.returncode == 0 or child.poll() is not None, "owned worker termination failed")
    else:
        child.terminate()
    child.wait(timeout=10)


def controller(root):
    package = materialize(root)
    directory = ROOT + "/" + package["experimentIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "experiment.json", package)
    tests = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", Path(TEST).name, "-v"],
        cwd=root, env={**os.environ, "CUDA_VISIBLE_DEVICES": ""}, capture_output=True, text=True, timeout=120, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    save_json(output / "cpu-tests.json", {"status": "head_experiment_cpu_tests_passed" if tests.returncode == 0 else "head_experiment_cpu_tests_failed",
        "executionState": "completed" if tests.returncode == 0 else "failed_closed", "recordedAtUtc": now(),
        "exitCode": tests.returncode, "stdout": tests.stdout, "stderr": tests.stderr, "program": package["testProgram"]})
    require(tests.returncode == 0, "CPU head checks failed: " + tests.stderr[-4000:])
    require(package == materialize(root), "package changed during CPU checks")
    lease = registry(root, "begin", directory)
    save_json(output / "registry-start.json", lease)
    child = None
    binding = file_binding(root, directory + "/experiment.json")
    try:
        with (output / "worker.log").open("xb") as log:
            env = {**os.environ, "CUBLAS_WORKSPACE_CONFIG": ":4096:8", "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"}
            child = subprocess.Popen([sys.executable, str(root / PROGRAM), "worker", "--package", binding["path"], "--sha256", binding["sha256"]],
                cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            save_json(output / "controller-lease.json", {"experimentIdentity": package["experimentIdentity"],
                "workerParentPid": os.getpid(), "workerLauncherPid": child.pid, "registryRevision": lease["revision"], "registrySha256": lease["sha256"]})
            started = time.perf_counter()
            while True:
                try:
                    code = child.wait(timeout=5)
                    break
                except subprocess.TimeoutExpired:
                    refresh_heartbeat(output / "heartbeat.json")
                    require(time.perf_counter() - started <= RESOURCES["maxWallSeconds"] + 30, "controller hard timeout")
            result = json.loads((output / "result.json").read_text(encoding="utf-8"))
            require(result["experimentIdentity"] == package["experimentIdentity"], "worker result identity mismatch")
            require((code == 0) == (result["executionState"] == "completed"), "worker exit/terminal mismatch")
            if code == 0:
                require(result["checkpointReloadExact"] is True, "worker checkpoint reload incomplete")
                for b in result["artifacts"]:
                    read_bound(root, b)
    except Exception as error:
        stop_owned(child)
        progress = {}
        if (output / "progress.json").exists():
            progress = json.loads((output / "progress.json").read_text(encoding="utf-8"))
        failure = {"status": "rgb_head_controller_failed_closed", "executionState": "failed_closed", "runId": package["experimentIdentity"],
            "experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(), "error": str(error),
            "gpuStarted": progress.get("gpuStarted"), "trainingStarted": progress.get("trainingStarted"),
            "lastConfirmedOptimizerSteps": progress.get("optimizerSteps"), "actualFinalOptimizerSteps": None,
            "qualification": package["qualification"]}
        save_json(output / "controller-failure.json", failure)
        if not (output / "result.json").exists():
            save_json(output / "result.json", failure)
        raise
    finally:
        try:
            refresh_heartbeat(output / "heartbeat.json")
        except OSError as error:
            save_json(output / "final-heartbeat-warning.json", {"error": str(error), "recordedAtUtc": now(),
                "action": "attempt_terminal_commit_against_existing_unexpired_heartbeat"})
        save_json(output / "registry-finish.json", registry(root, "finish", directory))
    print(json.dumps({"status": result["status"], "result": file_binding(root, directory + "/result.json")}), flush=True)
    return code


def worker(root, binding):
    from painter_learning_capacity_experiment import verify_controller_process
    package = bound_json(root, binding)
    require(package == materialize(root), "worker package inputs changed")
    require(binding["path"] == ROOT + "/" + package["experimentIdentity"] + "/experiment.json", "worker output namespace mismatch")
    output = project_file(root, binding["path"]).parent
    # The parent records its actual child PID after spawn. Bounded lease wait only.
    for _ in range(20):
        if (output / "controller-lease.json").exists():
            break
        time.sleep(0.05)
    lease = json.loads((output / "controller-lease.json").read_text(encoding="utf-8"))
    registry_bytes = project_file(root, ".runtime/ai-painter/current-execution-registry/current.json").read_bytes()
    require(digest(registry_bytes) == lease["registrySha256"], "worker registry lease stale")
    verify_controller_process(lease, json.loads(registry_bytes), os.getppid())
    require(lease["experimentIdentity"] == package["experimentIdentity"], "worker identity mismatch")
    save_json(output / "worker-started.json", {"processId": os.getpid(), "recordedAtUtc": now(), "package": binding})
    return train(root, package, output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("run", "worker"))
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.mode == "run":
        raise SystemExit(controller(Path.cwd()))
    require(args.package and args.sha256, "worker requires exact package binding")
    raise SystemExit(worker(Path.cwd(), {"path": args.package, "sha256": args.sha256}))

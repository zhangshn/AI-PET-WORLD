"""Bounded CPU-only timestep/rollout diagnosis of one immutable experiment.

No optimizer, checkpoint selection, GPU, new data or formal qualification. The
forward-noised arms deliberately consume target RGB and are diagnostics only.
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
import time

from painter_learning_capacity_experiment import (
    ExperimentDataset, canonical_bytes, digest, file_binding, now, read_bound,
    require, save_json, validate_experiment_checkpoint,
)
from diagnose_learning_capacity_noise import image_metrics

TEACHER_TIMESTEPS = (0, 100, 200, 250, 300, 400, 500, 600, 700, 750, 800, 900, 999)
PROFILES = ("timestep-600", "residual-6000")


def profile_settings(profile):
    require(profile in PROFILES, "unknown bounded diagnosis profile")
    arms = [("pure_noise_50", 50, 0, False)]
    if profile == "timestep-600":
        arms.extend((("pure_noise_100", 100, 0, False), ("target_noised_999_50", 50, 0, True)))
    arms.append(("target_noised_midpoint_25", 50, 25, True))
    return (600 if profile == "timestep-600" else 6000), arms


def rgb_diagnostics(torch, actual, target):
    """Measure color and pixel-phase error; never filter an output image.

    Phase statistics concern residuals against the target, not texture in the
    target itself. A periodic residual is evidence of a pattern, not proof of
    which layer or training objective caused it.
    """
    require(actual.shape == target.shape and actual.ndim == 4 and actual.shape[1] == 3,
            "diagnostic RGB shape mismatch")
    require(all(n >= 4 and n % 4 == 0 for n in actual.shape[-2:]), "RGB dimensions must be divisible by four")
    require(bool(torch.isfinite(target).all()), "nonfinite diagnostic target")
    result = image_metrics(torch, actual, target)
    error = actual - target
    phases = torch.stack([error[..., y::4, x::4].mean(dim=(0, 2, 3))
                          for y in range(4) for x in range(4)])
    phase_centered = phases - phases.mean(dim=0, keepdim=True)
    result.update({"meanRgb": actual.mean(dim=(0, 2, 3)).tolist(),
                   "meanRgbBias": error.mean(dim=(0, 2, 3)).tolist(),
                   "channelRgbMae": error.abs().mean(dim=(0, 2, 3)).tolist(),
                   "phase4ResidualMeanRgb": phases.tolist(),
                   "phase4ResidualRmsAfterGlobalBiasRemoval": float(phase_centered.square().mean().sqrt()),
                   "phase4ResidualRangeRgb": (phases.max(dim=0).values - phases.min(dim=0).values).tolist()})
    return result


def decomposition_metrics(torch, final, evidence, target):
    base = evidence["baseDecodedRgb"]
    masks = evidence["responsibilityMasks"]
    require(bool(masks), "missing responsibility masks")
    require(all(tuple(m.shape) == (target.shape[0], 1, *target.shape[-2:])
                and bool(torch.isfinite(m).all()) and bool(((m >= 0) & (m <= 1)).all())
                for m in masks), "invalid responsibility mask")
    coverage = torch.stack(masks).sum(dim=0).clamp(0, 1)
    require(final.shape == base.shape == target.shape, "decomposition shape mismatch")
    delta = final - base
    outside = (coverage == 0).expand_as(delta)
    outside_max = float(delta[outside].abs().max()) if bool(outside.any()) else None
    require(outside_max is None or outside_max == 0, "compositor changed uncovered pixels")
    regions = {}
    for name, mask in (("covered", coverage), ("uncovered", 1 - coverage)):
        count = float(mask.sum())
        regions[name] = {"pixelWeight": count,
            "baseRgbMae": float(((base - target).abs() * mask).sum() / (3 * count)) if count else None,
            "finalRgbMae": float(((final - target).abs() * mask).sum() / (3 * count)) if count else None,
            "compositorRgbChangeMae": float((delta.abs() * mask).sum() / (3 * count)) if count else None}
    return {"base": rgb_diagnostics(torch, base, target), "final": rgb_diagnostics(torch, final, target),
            "coverageFraction": float(coverage.mean()), "outsideCoverageMaxAbsoluteChange": outside_max,
            "regions": regions}


def rollout_grid(torch, full_grid, start_index=0):
    require(0 <= start_index < len(full_grid), "rollout start outside grid")
    values = [int(t) for t in full_grid[start_index:]]
    require(values[-1] == 0 and all(a > b for a, b in zip(values, values[1:])), "invalid descending rollout grid")
    return [(t, values[i + 1] if i + 1 < len(values) else -1) for i, t in enumerate(values)]


def diagnose(root, source, profile="timestep-600"):
    import numpy as np
    from PIL import Image
    import torch
    from ai_painter.complete_world.model import build_complete_world_system
    from ai_painter.complete_world.split_training import state_hash
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
    from ai_painter.complete_world.diffusion import recover_from_velocity
    from train_ai_assisted_conditional_denoiser import (
        add_noise, build_diffusion_schedule, decode_final_visible_rgb, denormalize_latent,
        deterministic_velocity_step, inference_timesteps, normalize_latent, save_tensor_png, velocity_target,
    )

    expected_steps, rollout_arms = profile_settings(profile)
    residual_profile = profile == "residual-6000"
    started = time.perf_counter()
    require(not torch.cuda.is_initialized(), "diagnosis must remain CPU-only")
    torch.set_num_threads(4)
    source_result = json.loads(read_bound(root, source))
    require(source_result["status"] == "experiment_executed_not_visual_qualified", "source run incomplete")
    package_binding = file_binding(root, str(Path(source["path"]).parent / "experiment.json").replace("\\", "/"))
    package = json.loads(read_bound(root, package_binding))
    payload = {k: v for k, v in package.items() if k != "experimentIdentity"}
    require(package["experimentIdentity"] == source_result["experimentIdentity"]
            == "painter-learning-capacity-" + digest(canonical_bytes(payload)), "source package mismatch")
    for receipt in package["inputReceipts"]:
        read_bound(root, receipt)
    artifacts = {Path(b["path"]).name: b for b in source_result["artifacts"]}
    checkpoint_binding = artifacts["experimental-checkpoint.pt"]
    checkpoint = torch.load(io.BytesIO(read_bound(root, checkpoint_binding)), map_location="cpu", weights_only=True)
    validate_experiment_checkpoint(checkpoint, package)
    require(checkpoint["config"] == package["config"], "checkpoint config mismatch")
    require(checkpoint["optimizerSteps"] == source_result["optimizerSteps"] == expected_steps,
            "checkpoint optimizer steps do not match the bounded diagnosis profile")
    plan = {
        "schemaVersion": "ai-painter-learning-capacity-timestep-diagnosis-v2", "profile": profile,
        "sourceResult": source, "sourcePackage": package_binding, "checkpoint": checkpoint_binding,
        "program": file_binding(root, "ml/ai-painter/scripts/diagnose_learning_capacity_timesteps.py"),
        "testProgram": file_binding(root, "ml/ai-painter/tests/test_learning_capacity_timesteps.py"),
        "metricProgram": file_binding(root, "ml/ai-painter/scripts/diagnose_learning_capacity_noise.py"),
        "device": "cpu", "cpuThreads": 4, "maxWallSeconds": 180, "maxOutputMiB": 16,
        "optimizerUpdatesAllowed": False, "formalQualificationAllowed": False,
        "teacherTimesteps": list(TEACHER_TIMESTEPS),
        "rollouts": [arm[0] for arm in rollout_arms],
        "decomposition": residual_profile,
        "seed": package["training"]["seed"],
        "limits": ["Forward-noised target arms are not generative candidates.",
                   "CPU noise generator is not byte-equivalent to the previous GPU noise generator.",
                   "Compare rollout arms on CPU with identical noise; saved GPU images are descriptive references only.",
                   "One fixed seed per seen train image cannot establish generalization or checkpoint qualification.",
                   "Pixel-phase residuals measure periodic error, not a unique architectural root cause.",
                   "All base/target-latent intermediate images are diagnostic only, never selectable candidates."],
    }
    identity = "timestep-diagnosis-" + digest(canonical_bytes(plan))
    output = root / ".runtime/ai-painter/learning-capacity-experiments" / identity
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)

    def progress(phase, **details):
        value = {"diagnosisIdentity": identity, "recordedAtUtc": now(), "phase": phase,
                 "elapsedSeconds": time.perf_counter() - started, "gpuStarted": False, "optimizerSteps": 0, **details}
        save_json(output / "progress.json", value, mutable=True)
        print(json.dumps(value), flush=True)

    def limits():
        require(time.perf_counter() - started < plan["maxWallSeconds"], "CPU diagnosis timeout")
        require(not torch.cuda.is_initialized(), "diagnosis initialized CUDA")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < plan["maxOutputMiB"] * 2**20, "diagnosis output budget exceeded")

    try:
        config = checkpoint["config"]
        model = build_complete_world_system(config)
        foundation = torch.load(io.BytesIO(read_bound(root, package["foundation"])), map_location="cpu", weights_only=True)
        model.autoencoder.load_state_dict(foundation["autoencoderState"], strict=True)
        model.denoiser.load_state_dict(checkpoint["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        before = state_hash(model.state_dict())
        require(state_hash(model.denoiser.state_dict()) == checkpoint["denoiserStateSha256"], "denoiser state mismatch")
        require(state_dict_sha256(model.autoencoder.state_dict()) == checkpoint["foundationStateSha256"], "AE state mismatch")
        normalization = checkpoint["latentNormalization"]
        require(normalization["sampleCount"] == 2 and bool((normalization["standardDeviation"] > 0).all()), "normalization invalid")
        alpha = build_diffusion_schedule(config, "cpu")["alphasCumulative"]
        dataset = ExperimentDataset(root, package)
        rows = []
        with torch.inference_mode():
            for index in range(2):
                limits()
                item = dataset[index]
                target, conditions = item["image"][None], item["conditions"][None]
                clean_raw = model.autoencoder.encode(target)
                clean = normalize_latent(clean_raw, normalization)
                noise = torch.randn(clean.shape, generator=torch.Generator().manual_seed(plan["seed"] + 3000 + index))

                def decoded(latent):
                    return decode_final_visible_rgb(model, denormalize_latent(latent, normalization), conditions, config).clamp(0, 1)

                def decomposed(latent, label):
                    final, evidence = decode_final_visible_rgb(model, denormalize_latent(latent, normalization), conditions, config,
                        return_stage4_semantic_responsibility_evidence=True)
                    measured = decomposition_metrics(torch, final, evidence, target)
                    if label is not None:
                        save_tensor_png(evidence["baseDecodedRgb"][0], output / f"{label}-base-{index}.png")
                        save_tensor_png(final[0], output / f"{label}-final-{index}.png")
                    return measured

                ae = model.autoencoder.decode(clean_raw)
                oracle = decoded(clean)
                row = {"sampleId": item["sampleId"], "split": "train", "teacher": [], "rollouts": {},
                       "aeReconstruction": image_metrics(torch, ae, target), "targetLatentFinal": image_metrics(torch, oracle, target)}
                if residual_profile:
                    row["targetLatentDecomposition"] = decomposed(clean, "target-latent")
                for t in TEACHER_TIMESTEPS:
                    limits()
                    timestep = torch.tensor([t])
                    noisy = add_noise(clean, noise, timestep, alpha)
                    predicted = model.predict_velocity(noisy, timestep, conditions)
                    recovered, _ = recover_from_velocity(noisy, predicted, t, alpha)
                    rgb = decoded(recovered)
                    row["teacher"].append({"timestep": t,
                        "velocityMse": float((predicted - velocity_target(clean, noise, timestep, alpha)).square().mean()),
                        "cleanLatentMse": float((recovered - clean).square().mean()),
                        "rgb": rgb_diagnostics(torch, rgb, target) if residual_profile else image_metrics(torch, rgb, target)})
                    if t in (0, 500, 999):
                        save_tensor_png(rgb[0], output / f"teacher-{t}-{index}.png")
                progress("teacher_sweep_completed", sampleIndex=index)
                for name, count, start_index, target_start in rollout_arms:
                    grid = rollout_grid(torch, inference_timesteps(1000, count, "cpu"), start_index)
                    latent = add_noise(clean, noise, torch.tensor([grid[0][0]]), alpha) if target_start else noise.clone()
                    trajectory = []
                    for i, (t, previous) in enumerate(grid):
                        limits()
                        velocity = model.predict_velocity(latent, torch.tensor([t]), conditions)
                        recovered, _ = recover_from_velocity(latent, velocity, t, alpha)
                        require(bool(torch.isfinite(recovered).all()), "nonfinite rollout latent")
                        record = {"step": i, "timestep": t, "predictedCleanLatentMse": float((recovered - clean).square().mean()),
                                  "predictedCleanLatentStd": float(recovered.std())}
                        if i in (0, len(grid) // 4, len(grid) // 2, 3 * len(grid) // 4, len(grid) - 1):
                            record["rgb"] = image_metrics(torch, decoded(recovered), target)
                        if residual_profile and name == "pure_noise_50" and i in (0, len(grid) // 2, len(grid) - 1):
                            record["decomposition"] = decomposed(recovered, f"rollout-t{t}")
                        trajectory.append(record)
                        latent = deterministic_velocity_step(latent, velocity, t, previous, alpha)
                    final = decoded(latent)
                    save_tensor_png(final[0], output / f"{name}-{index}.png")
                    row["rollouts"][name] = {"targetUsedForInitialization": target_start, "trajectory": trajectory,
                        "inferenceSteps": len(grid), "finalLatentMse": float((latent - clean).square().mean()),
                        "finalRgb": image_metrics(torch, final, target)}
                    progress("rollout_completed", sampleIndex=index, arm=name)
                with Image.open(io.BytesIO(read_bound(root, artifacts[f"after-{index}.png"]))) as im:
                    saved = torch.from_numpy(np.array(im, copy=True)).permute(2, 0, 1)[None].float() / 255
                row["savedGpuSamplingRgb"] = image_metrics(torch, saved, target)
                if residual_profile:
                    row["savedGpuSamplingDiagnostics"] = rgb_diagnostics(torch, saved, target)
                rows.append(row)
                save_json(output / f"sample-{index}.json", row)
        limits()
        require(state_hash(model.state_dict()) == before, "diagnosis changed model")
        for binding in [source, package_binding, checkpoint_binding, plan["program"], plan["testProgram"], plan["metricProgram"], *package["inputReceipts"]]:
            read_bound(root, binding)
        result = {**plan, "diagnosisIdentity": identity, "status": "cpu_timestep_diagnosis_completed_not_visual_qualified",
                  "executionState": "completed", "recordedAtUtc": now(), "gpuStarted": False, "trainingStarted": False,
                  "optimizerSteps": 0, "modelStateUnchanged": True, "rows": rows, "elapsedSeconds": time.perf_counter() - started,
                  "images": [file_binding(root, str(p.relative_to(root)).replace("\\", "/")) for p in output.glob("*.png")]}
        save_json(output / "result.json", result)
        progress("completed")
        print(json.dumps(file_binding(root, str((output / "result.json").relative_to(root)).replace("\\", "/"))), flush=True)
    except Exception as error:
        save_json(output / "result.json", {"status": "cpu_timestep_diagnosis_failed_closed", "executionState": "failed_closed",
                  "recordedAtUtc": now(), "error": str(error), "plan": plan})
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-result", required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--profile", choices=PROFILES, default="timestep-600")
    args = parser.parse_args()
    diagnose(Path.cwd(), {"path": args.source_result, "sha256": args.source_sha256}, args.profile)

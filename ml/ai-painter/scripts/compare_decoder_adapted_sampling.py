"""Bounded CPU sampling-grid diagnosis of the existing decoder-adapted model.

All grids start at 999 and finish at the clean endpoint. Targets are measurement
inputs only. No checkpoint, sampler setting or output is selected for release.
"""
from __future__ import annotations

import io
import json
import math
import os
from pathlib import Path
import subprocess
import time
import traceback

import painter_decoder_binding_ab_experiment as source
import diagnose_learning_capacity_trajectory as trajectory
from painter_learning_capacity_experiment import (
    bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding,
    now, project_file, read_bound, require, save_json,
)

PROGRAM = "ml/ai-painter/scripts/compare_decoder_adapted_sampling.py"
TEST = "ml/ai-painter/tests/test_decoder_adapted_sampling.py"
SOURCE = {"path": ".runtime/ai-painter/learning-capacity-experiments/painter-decoder-binding-ab-664dfa9b37996b3e563eb4eaaa3a7ab3c8cb805281163546da356d7205114205/result.json",
          "sha256": "e283fc9a1e3f2567184cb6fca95fdcaaa24298c8a343acc19fb5da5c5bb0b620"}
ARM = "reconstruction_decoder_adaptation"
STEPS = (50, 25, 10)  # Replay the existing baseline first; retain every arm.
METRICS = ("rgbMae", "laplacianMae", "edgeMae", "phase4ResidualRmsAfterGlobalBiasRemoval")
SETTINGS = {"device": "cpu", "cpuThreads": 4, "maxWallSeconds": 300,
    "maxOutputMiB": 8, "resolution": [256, 192], "samplingSteps": list(STEPS),
    "seedsBySample": source.comparison.SETTINGS["seedsBySample"],
    "snapshotTimesteps50": list(trajectory.SNAPSHOTS), "automaticRetries": 0,
    "optimizerUpdatesAllowed": False, "checkpointSelectionAllowed": False,
    "formalQualificationAllowed": False, "targetUsedForInitialization": False}


def materialize(root):
    result = bound_json(root, SOURCE)
    package_binding = file_binding(root, str(Path(SOURCE["path"]).parent / "experiment.json").replace("\\", "/"))
    package = bound_json(root, package_binding)
    require(package == source.materialize(root), "source package no longer reproduces")
    require(result["executionState"] == "completed"
            and result["status"] == "experiment_executed_not_visual_qualified"
            and result["experimentIdentity"] == package["experimentIdentity"]
            and result["optimizerSteps"] == 2000 and result["checkpointReloadExact"] is True,
            "completed paired source required")
    require(result["summary"] == source.summarize(result["rows"]), "source matrix inconsistent")
    require(all(v is False for v in result["qualification"].values()), "source must remain unqualified")
    selected = [a for a in result["arms"] if a["arm"] == ARM]
    require(len(selected) == 1 and selected[0]["optimizerSteps"] == 1000
            and selected[0]["checkpointReloadExact"] is True, "adapted checkpoint missing")
    bindings = [*package["inputReceipts"], SOURCE, package_binding, *result["artifacts"],
                file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for b in bindings:
        read_bound(root, b)
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "conflicting receipt")
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-decoder-adapted-sampling-plan-v1",
        "sourceResult": SOURCE, "sourcePackage": package_binding, "checkpoint": selected[0]["checkpoint"],
        "arm": ARM, "settings": SETTINGS, "program": file_binding(root, PROGRAM),
        "testProgram": file_binding(root, TEST), "inputReceipts": list(unique.values()),
        "limits": ["Only two previously used train images and six existing seeds; no holdout or generalization claim.",
            "Only inference grid length changes: 50, 25 and 10 full-endpoint DDIM steps, no early stopping.",
            "The 50-step images and float measurements must exactly reproduce the source experiment.",
            "Laplacian error is a high-frequency difference metric, not a semantic approval or unique noise diagnosis.",
            "Fixed intermediate probes are not candidate images; no best image or sampler setting is selected.",
            "No GPU, optimizer, new checkpoint, dataset, condition, loss, threshold or Runtime change."]}
    return {**payload, "comparisonIdentity": "adapted-sampling-" + digest(canonical_bytes(payload))}


def rollout(torch, predict, conditions, alpha, seed, steps, check):
    """Target-free sampling; the 50-step branch reuses the exact existing path."""
    from train_ai_assisted_conditional_denoiser import deterministic_velocity_step, inference_timesteps
    from diagnose_learning_capacity_timesteps import rollout_grid
    require(type(steps) is int and steps in STEPS, "undeclared sampling grid")
    require(tuple(conditions.shape) == (1, 23, 192, 256) and conditions.device.type == "cpu"
            and bool(torch.isfinite(conditions).all()), "finite CPU conditions required")
    require(tuple(alpha.shape) == (1000,) and alpha.device.type == "cpu"
            and bool(torch.isfinite(alpha).all()) and bool(((alpha > 0) & (alpha <= 1)).all()), "invalid CPU schedule")
    if steps == 50:
        return trajectory.capture_rollout(torch, predict, conditions, alpha, seed, check)
    noise = torch.randn((1, 12, 48, 64), generator=torch.Generator(device="cpu").manual_seed(seed))
    latent = noise.clone()
    grid = rollout_grid(torch, inference_timesteps(1000, steps, "cpu"))
    require(len(grid) == steps and grid[0][0] == 999 and grid[-1] == (0, -1), "incomplete endpoint grid")
    for t, previous in grid:
        check()
        velocity = predict(latent, torch.tensor([t]), conditions)
        require(velocity.shape == latent.shape and velocity.device.type == "cpu", "prediction shape/device changed")
        latent = deterministic_velocity_step(latent, velocity, t, previous, alpha)
        require(bool(torch.isfinite(latent).all()), "nonfinite generated latent")
    return noise, latent, {}, grid


def png_matches(root, binding, rgb):
    import numpy as np
    from PIL import Image
    with Image.open(io.BytesIO(read_bound(root, binding))) as image:
        require(image.mode == "RGB" and image.size == (256, 192), "baseline image format changed")
        saved = np.array(image)
    actual = rgb[0].detach().clamp(0, 1).mul(255).byte().permute(1, 2, 0).cpu().numpy()
    require(np.array_equal(saved, actual), "50-step source pixels not exactly reproduced")


def summarize(rows):
    expected = [(sample, seed, steps) for i, sample in enumerate(source.previous.SAMPLES)
                for seed in SETTINGS["seedsBySample"][i] for steps in STEPS]
    require([(r["sampleId"], r["seed"], r["steps"]) for r in rows] == expected, "incomplete/reordered sampling matrix")
    require(all(r["split"] == "train" and r["targetUsedForInitialization"] is False for r in rows), "sample use changed")
    def finite(value):
        require(type(value) in (int, float) and math.isfinite(value) and value >= 0, "invalid metric")
        return value
    groups, late = {}, []
    for offset in range(0, len(rows), 3):
        baseline = rows[offset]
        require(baseline["baselinePixelsAndMeasurementsExact"] is True, "baseline replay missing")
        probes = baseline["probes"]
        require(tuple(p["timestep"] for p in probes) == trajectory.SNAPSHOTS, "probe matrix changed")
        for p in probes:
            finite(p["generatedCleanLatentMse"])
            for k in ("rgbMae", "laplacianMae"):
                finite(p["finalRgb"][k])
        late.append({"sampleId": baseline["sampleId"], "seed": baseline["seed"], "fixedInterval": [489, 0],
            "cleanLatentMseChange": probes[-1]["generatedCleanLatentMse"] - probes[2]["generatedCleanLatentMse"],
            **{k + "Change": probes[-1]["finalRgb"][k] - probes[2]["finalRgb"][k] for k in ("rgbMae", "laplacianMae")}})
    for steps in STEPS[1:]:
        groups[str(steps)] = {}
        for metric in METRICS:
            pairs = [(finite(rows[o]["measurements"]["final"][metric]),
                      finite(rows[o + STEPS.index(steps)]["measurements"]["final"][metric]))
                     for o in range(0, len(rows), 3)]
            delta = [b - a for a, b in pairs]
            pct = [(a-b)/a*100 for a, b in pairs] if all(a > 0 for a, b in pairs) else None
            groups[str(steps)][metric] = {"improvedCount": sum(d < 0 for d in delta),
                "worseCount": sum(d > 0 for d in delta), "equalCount": sum(d == 0 for d in delta),
                "absoluteChangeRange": [min(delta), max(delta)],
                "relativeReductionPercentRange": [min(pct), max(pct)] if pct else None}
    return {"comparedWith50Steps": groups, "fixed50StepLateChanges": late,
        "checkpointSelected": False, "samplerSelected": False, "rootCauseProven": False, "formalVisualQualification": False}


def registry(root, mode, directory):
    # Existing transactional writer: prepare once; only finalize IO may retry.
    bridge = source.comparison.paired.REGISTRY_BRIDGE
    replacements = (("advanceCurrentExecutionRegistry} from", "prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from"),
        ("const done=await advanceCurrentExecutionRegistry(", "const prepared=await prepareCurrentExecutionRegistryAdvance("),
        ("cpu_paired_decoder_comparison", "cpu_decoder_adapted_sampling_comparison"),
        ("cpu_decoder_comparison_", "cpu_decoder_adapted_sampling_"),
        ("Compare two frozen decoders on identical train-only generated latents; no training or publication",
         "Compare 50, 25 and 10 complete CPU sampling grids on six fixed train-only seeds; no selection or training"),
        ("assert(done.ok,JSON.stringify(done));", """
let done;for(let attempt=0;attempt<6;attempt++){try{
done=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:root,transactionId:prepared.transactionId});break;
}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt===5)throw error;
await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));}}
assert(done.ok,JSON.stringify(done));"""))
    for old, new in replacements:
        require(old in bridge, "registry bridge changed")
        bridge = bridge.replace(old, new)
    run = subprocess.run(["node", "--input-type=module", "-e", bridge, mode, directory, str(os.getpid())],
        cwd=root, capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    require(run.returncode == 0, "registry bridge failed: " + run.stderr[-4000:])
    return json.loads(run.stdout.strip())


def run(root):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    import train_ai_assisted_conditional_denoiser as trainer
    from diagnose_learning_capacity_timesteps import rgb_diagnostics
    require(not torch.cuda.is_initialized(), "CPU only")
    torch.set_num_threads(SETTINGS["cpuThreads"])
    plan = materialize(root)
    directory = source.comparison.paired.ROOT + "/" + plan["comparisonIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)
    tests = subprocess.run([os.sys.executable, "-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", Path(TEST).name, "-v"],
        cwd=root, capture_output=True, text=True, timeout=60, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    save_json(output / "cpu-tests.json", {"status": "sampling_cpu_tests_passed" if tests.returncode == 0 else "sampling_cpu_tests_failed",
        "executionState": "completed" if tests.returncode == 0 else "failed_closed", "exitCode": tests.returncode,
        "program": plan["testProgram"], "recordedAtUtc": now(), "stdout": tests.stdout, "stderr": tests.stderr})
    require(tests.returncode == 0, "sampling tests failed: " + tests.stderr[-3000:])
    try:
        begin = registry(root, "begin", directory)
    except Exception as error:
        save_json(output / "launch-failure.json", {"status": "registry_begin_failed", "executionState": "failed_closed",
            "recordedAtUtc": now(), "error": str(error), "gpuStarted": False, "trainingStarted": False})
        raise
    save_json(output / "registry-start.json", begin)
    started = heartbeat = time.perf_counter()
    def check():
        nonlocal heartbeat
        require(time.perf_counter()-started < SETTINGS["maxWallSeconds"], "CPU sampling timeout")
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < SETTINGS["maxOutputMiB"]*2**20, "output budget exceeded")
        if time.perf_counter()-heartbeat >= 8:
            source.comparison.paired.refresh_heartbeat(output / "heartbeat.json")
            heartbeat = time.perf_counter()
    rows = []
    result = {"schemaVersion": "ai-painter-decoder-adapted-sampling-result-v1", "runId": plan["comparisonIdentity"],
        "plan": file_binding(root, directory + "/plan.json"), "gpuStarted": False, "trainingStarted": False,
        "optimizerSteps": 0, "checkpointSelected": False, "formalQualificationAllowed": False, "limits": plan["limits"]}
    try:
        package, previous = bound_json(root, plan["sourcePackage"]), bound_json(root, SOURCE)
        model, heads, normalization, adaptation = source.comparison.load_frozen_pair(root, bound_json(root, package["sourceComparisonPlan"]))
        model.denoiser.rgb_responsibility_heads = heads
        expected_heads = state_hash(heads.state_dict())
        cp = torch.load(io.BytesIO(read_bound(root, plan["checkpoint"])), map_location="cpu", weights_only=True)
        source.validate_checkpoint(cp, package, ARM)
        model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "Denoiser state mismatch")
        require(state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) == expected_heads, "frozen heads changed")
        before = state_hash((model.state_dict(), normalization))
        dataset = source.previous.HeadDataset(root, adaptation)
        alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(source.previous.SAMPLES):
                item = dataset[i]
                require(len(dataset) == 2 and item["sampleId"] == sample, "sample scope mismatch")
                conditions = item["conditions"][None]
                condition_hash = state_hash(conditions)
                for j, seed in enumerate(SETTINGS["seedsBySample"][i]):
                    expected_noise = None
                    for steps in STEPS:
                        noise, final, probes, grid = rollout(torch, model.predict_velocity, conditions, alpha, seed, steps, check)
                        if expected_noise is None:
                            expected_noise = noise.clone()
                        require(torch.equal(noise, expected_noise), "paired noise differs")
                        require(state_hash(conditions) == condition_hash, "conditions changed")
                        rgb, evidence = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(final, normalization), conditions,
                            package["config"], return_stage4_semantic_responsibility_evidence=True)
                        target = item["image"][None]  # Only measured after the complete target-free rollout.
                        measured = source.comparison.measure(torch, rgb, evidence, target, conditions, package["config"])
                        clean = trainer.normalize_latent(model.autoencoder.encode(target), normalization)
                        row = {"sampleId": sample, "split": "train", "seed": seed, "steps": steps,
                            "targetUsedForInitialization": False, "noiseStateSha256": state_hash(noise),
                            "conditionStateSha256": condition_hash, "grid": grid, "measurements": measured,
                            "generatedCleanLatentMse": float((final-clean).square().mean()),
                            "oracleAlgebra": trajectory.oracle_error(torch, clean, noise, alpha, grid), "probes": []}
                        if steps == 50:
                            baseline = previous["rows"][6+i*3+j]
                            require((baseline["arm"], baseline["sampleId"], baseline["seed"]) == (ARM, sample, seed), "baseline identity mismatch")
                            require(measured == baseline["measurements"], "50-step source float metrics not exactly reproduced")
                            binding = source.comparison.paired.artifact(previous, f"{ARM}-{i}-{j}.png")
                            png_matches(root, binding, rgb)
                            row.update(baselinePixelsAndMeasurementsExact=True, image=binding)
                            for t, latent in probes.items():
                                check()
                                probe_rgb, probe_evidence = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent, normalization),
                                    conditions, package["config"], return_stage4_semantic_responsibility_evidence=True)
                                row["probes"].append({"timestep": t, "generatedCleanLatentMse": float((latent-clean).square().mean()),
                                    "baseRgb": rgb_diagnostics(torch, probe_evidence["baseDecodedRgb"], target),
                                    "finalRgb": rgb_diagnostics(torch, probe_rgb, target)})
                        else:
                            filename = f"steps-{steps}-{i}-{j}.png"
                            trainer.save_tensor_png(rgb[0], output / filename)
                            row["image"] = file_binding(root, directory + "/" + filename)
                        rows.append(row)
                        progress = {"recordedAtUtc": now(), "phase": "full_endpoint_sampling", "completed": len(rows), "total": 18,
                            "elapsedSeconds": time.perf_counter()-started, "gpuStarted": False, "trainingStarted": False}
                        save_json(output / "progress.json", progress, mutable=True)
                        print(json.dumps(progress), flush=True)
        require(state_hash((model.state_dict(), normalization)) == before, "weights or normalization changed")
        require(all(not p.requires_grad and p.grad is None for p in model.parameters()), "training state present")
        for b in plan["inputReceipts"]:
            read_bound(root, b)
        check()
        result.update(status="cpu_adapted_sampling_completed_not_visual_qualified", executionState="completed",
            summary=summarize(rows), modelAndNormalizationUnchanged=True, modelAndNormalizationStateSha256=before,
            inputBindingsReverified=len(plan["inputReceipts"]))
    except Exception as error:
        result.update(status="cpu_adapted_sampling_failed_closed", executionState="failed_closed", error=str(error), traceback=traceback.format_exc())
    result.update(rows=rows, recordedAtUtc=now(), elapsedSeconds=time.perf_counter()-started,
        artifacts=[file_binding(root, directory+"/"+p.name) for p in sorted(output.iterdir()) if p.suffix == ".png"])
    save_json(output / "result.json", result)
    finished = registry(root, "finish", directory)
    save_json(output / "registry-finish.json", finished)
    require(finished["latestTrainingRunId"] == begin["latestTrainingRunId"], "training pointer changed")
    print(json.dumps(file_binding(root, directory + "/result.json")), flush=True)
    require(result["executionState"] == "completed", "sampling diagnosis failed: " + result.get("error", "unknown"))


if __name__ == "__main__":
    run(Path.cwd())

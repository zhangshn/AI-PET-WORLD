"""Replay six existing CPU seeds with frozen weights; measure, never select.

Target RGB is read by measurement only after each complete pure-noise rollout.
Intermediate predicted-clean tensors are diagnostic probes, not candidates.
"""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import subprocess
import time
import traceback

import compare_rgb_head_multiseed as source
from painter_learning_capacity_experiment import (
    bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding,
    now, project_file, read_bound, require, save_json,
)

PROGRAM = "ml/ai-painter/scripts/diagnose_learning_capacity_trajectory.py"
TEST = "ml/ai-painter/tests/test_learning_capacity_trajectory.py"
SOURCE = {"path": ".runtime/ai-painter/learning-capacity-experiments/rgb-head-multiseed-b1a9f20fe0ef72ffbadaf6d1f88a967872fd958fdbc1ae5b61045a942f65695e/result.json",
          "sha256": "1897af22ee3aea5fcd2f74ab7178914fc1f3d7e0ac85e2d4b86bbadb01624597"}
SNAPSHOTS = (999, 754, 489, 245, 0)
SETTINGS = {"device": "cpu", "cpuThreads": 4, "maxWallSeconds": 180,
    "maxOutputMiB": 4, "inferenceSteps": 50, "resolution": [256, 192],
    "snapshotTimesteps": list(SNAPSHOTS), "seedsBySample": source.SETTINGS["seedsBySample"],
    "optimizerUpdatesAllowed": False, "checkpointSelectionAllowed": False,
    "formalQualificationAllowed": False, "automaticRetries": 0}


def materialize(root):
    result = bound_json(root, SOURCE)
    old_plan = bound_json(root, result["plan"])
    require(old_plan == source.materialize(root, old_plan["adaptationResult"]), "source no longer reproduces")
    require(result["executionState"] == "completed"
            and result["status"] == "cpu_multiseed_comparison_completed_not_visual_qualified"
            and result["comparisonIdentity"] == old_plan["comparisonIdentity"], "source not complete")
    require(result["summary"] == source.summarize(result["rows"]), "source matrix inconsistent")
    bindings = [*old_plan["inputReceipts"], SOURCE, result["plan"], *result["artifacts"],
                file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for b in bindings:
        read_bound(root, b)
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "conflicting receipt")
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-fixed-trajectory-diagnosis-plan-v1",
        "sourceResult": SOURCE, "sourcePlan": result["plan"], "settings": SETTINGS,
        "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST),
        "inputReceipts": list(unique.values()),
        "limits": ["Two previously used train images; no independent quality or generalization claim.",
            "Six previous noise seeds are replayed, not six new independent trials.",
            "Final generated tensors must exactly reproduce all six saved results.",
            "Teacher probes use forward-noised target latents and cannot be candidates.",
            "Fixed intermediate probes do not authorize early stopping or image selection.",
            "Oracle algebra tests do not prove that the trained model predicts the correct velocity.",
            "No images, datasets, checkpoints, training objectives or qualification gates are changed."]}
    return {**payload, "comparisonIdentity": "trajectory-diagnosis-" + digest(canonical_bytes(payload))}


def capture_rollout(torch, predict, conditions, alpha, seed, check):
    """Instrument the existing sampler without target input or sampler changes."""
    from ai_painter.complete_world.diffusion import recover_from_velocity
    probes = {}

    def capture(latent, timestep, supplied_conditions):
        velocity = predict(latent, timestep, supplied_conditions)
        t = int(timestep.item())
        if t in SNAPSHOTS:
            require(t not in probes, "duplicate trajectory probe")
            clean, _ = recover_from_velocity(latent, velocity, t, alpha)
            probes[t] = clean.clone()
        return velocity

    noise, final, grid = source.paired.pure_noise_rollout(
        torch, capture, (1, 12, 48, 64), conditions, alpha, seed, check)
    require(tuple(probes) == SNAPSHOTS, "incomplete or reordered trajectory probes")
    require(torch.equal(final, probes[0]), "final probe differs from terminal latent")
    return noise, final, probes, grid


def oracle_error(torch, clean, noise, alpha, grid):
    """Check all actual grid pairs with analytic target velocity, not model output."""
    from ai_painter.complete_world.diffusion import recover_from_velocity
    from train_ai_assisted_conditional_denoiser import add_noise, deterministic_velocity_step, velocity_target
    maximum = {"cleanRecoveryMaxAbs": 0.0, "noiseRecoveryMaxAbs": 0.0, "stepMaxAbs": 0.0}
    for t, previous in grid:
        step = torch.tensor([t])
        noisy = add_noise(clean, noise, step, alpha)
        velocity = velocity_target(clean, noise, step, alpha)
        recovered, estimated_noise = recover_from_velocity(noisy, velocity, t, alpha)
        actual = deterministic_velocity_step(noisy, velocity, t, previous, alpha)
        expected = add_noise(clean, noise, torch.tensor([previous]), alpha) if previous >= 0 else clean
        for key, error in (("cleanRecoveryMaxAbs", recovered - clean),
                           ("noiseRecoveryMaxAbs", estimated_noise - noise), ("stepMaxAbs", actual - expected)):
            maximum[key] = max(maximum[key], float(error.abs().max()))
    require(all(v <= 5e-6 for v in maximum.values()), "sampler algebra roundtrip exceeded float32 tolerance")
    return maximum


def summarize(rows):
    require([(r["sampleId"], r["seed"]) for r in rows] ==
            [(sample, seed) for i, sample in enumerate(source.adapter.SAMPLES)
             for seed in SETTINGS["seedsBySample"][i]], "incomplete or reordered six-seed matrix")
    changes = []
    for row in rows:
        require(tuple(p["timestep"] for p in row["probes"]) == SNAPSHOTS, "probe matrix changed")
        middle, last = row["probes"][2], row["probes"][-1]
        changes.append({"sampleId": row["sampleId"], "seed": row["seed"],
            "fixedInterval": [489, 0],
            "cleanLatentMseChange": last["generatedCleanLatentMse"] - middle["generatedCleanLatentMse"],
            "baseRgbMaeChange": last["baseRgb"]["rgbMae"] - middle["baseRgb"]["rgbMae"],
            "finalRgbMaeChange": last["finalRgb"]["rgbMae"] - middle["finalRgb"]["rgbMae"],
            "finalLaplacianMaeChange": last["finalRgb"]["laplacianMae"] - middle["finalRgb"]["laplacianMae"]})
    return {"fixedIntervalChanges": changes, "lateLatentErrorIncreaseCount": sum(r["cleanLatentMseChange"] > 0 for r in changes),
            "lateFinalLaplacianErrorIncreaseCount": sum(r["finalLaplacianMaeChange"] > 0 for r in changes),
            "rootCauseProven": False, "checkpointSelected": False}


def registry(root, mode, directory):
    # Reuse the authoritative writer and preserve latestTrainingTerminal.
    # Prepare once: a Windows sharing retry must finalize the SAME transaction.
    bridge = source.paired.REGISTRY_BRIDGE.replace(
        "advanceCurrentExecutionRegistry} from", "prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from")
    bridge = bridge.replace("const done=await advanceCurrentExecutionRegistry(", "const prepared=await prepareCurrentExecutionRegistryAdvance(")
    bridge = bridge.replace("assert(done.ok,JSON.stringify(done));", """
let done;for(let attempt=0;attempt<6;attempt++){try{
done=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:root,transactionId:prepared.transactionId});break;
}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt===5)throw error;
await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));}}
assert(done.ok,JSON.stringify(done));""")
    for old, new in (("cpu_paired_decoder_comparison", "cpu_fixed_trajectory_diagnosis"),
                     ("cpu_decoder_comparison_", "cpu_fixed_trajectory_"),
                     ("Compare two frozen decoders on identical train-only generated latents; no training or publication",
                      "Replay six fixed CPU seeds and measure trajectory drift; no training, selection or publication")):
        require(old in bridge, "registry bridge changed")
        bridge = bridge.replace(old, new)
    run = subprocess.run(["node", "--input-type=module", "-e", bridge, mode, directory, str(os.getpid())],
        cwd=root, capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    require(run.returncode == 0, "registry bridge failed: " + run.stderr[-4000:])
    return json.loads(run.stdout.strip())


def run(root):
    import torch
    from ai_painter.complete_world.diffusion import recover_from_velocity
    from ai_painter.complete_world.split_training import state_hash
    from train_ai_assisted_conditional_denoiser import (
        add_noise, build_diffusion_schedule, decode_final_visible_rgb, denormalize_latent, normalize_latent,
    )
    from diagnose_learning_capacity_timesteps import rgb_diagnostics
    require(not torch.cuda.is_initialized(), "CPU only")
    torch.set_num_threads(SETTINGS["cpuThreads"])
    plan = materialize(root)
    directory = source.paired.ROOT + "/" + plan["comparisonIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)
    tests = subprocess.run([os.sys.executable, "-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", Path(TEST).name, "-v"],
        cwd=root, capture_output=True, text=True, timeout=60, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    save_json(output / "cpu-tests.json", source.cpu_test_record(tests.returncode, plan["testProgram"], tests.stdout, tests.stderr))
    require(tests.returncode == 0, "trajectory tests failed: " + tests.stderr[-3000:])
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
        require(time.perf_counter() - started < SETTINGS["maxWallSeconds"], "trajectory diagnosis timeout")
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < SETTINGS["maxOutputMiB"] * 2**20, "output budget exceeded")
        if time.perf_counter() - heartbeat >= 8:
            source.paired.refresh_heartbeat(output / "heartbeat.json")
            heartbeat = time.perf_counter()

    result = {"schemaVersion": "ai-painter-fixed-trajectory-diagnosis-result-v1", "runId": plan["comparisonIdentity"],
        "plan": file_binding(root, directory + "/plan.json"), "gpuStarted": False, "trainingStarted": False,
        "optimizerSteps": 0, "checkpointSelected": False, "formalQualificationAllowed": False, "limits": plan["limits"]}
    try:
        old_plan = bound_json(root, plan["sourcePlan"])
        previous = bound_json(root, SOURCE)
        model, replacement, normalization, package = source.load_frozen_pair(root, old_plan)
        model.denoiser.rgb_responsibility_heads = replacement
        before = state_hash(model.state_dict())
        dataset = source.adapter.HeadDataset(root, package)
        alpha = build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        rows = []
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(source.adapter.SAMPLES):
                item = dataset[i]
                require(item["sampleId"] == sample and len(dataset) == 2, "sample scope mismatch")
                conditions = item["conditions"][None]
                condition_hash = state_hash(conditions)
                for j, seed in enumerate(SETTINGS["seedsBySample"][i]):
                    noise, final, probes, grid = capture_rollout(torch, model.predict_velocity, conditions, alpha, seed, check)
                    saved = torch.load(io.BytesIO(read_bound(root, source.paired.artifact(previous, f"sampling-{i}-{j}.pt"))), map_location="cpu", weights_only=True)
                    require(saved["sampleId"] == sample and saved["seed"] == seed and saved["targetUsedForInitialization"] is False,
                            "saved sample identity mismatch")
                    require(torch.equal(noise, saved["noise"]) and torch.equal(final, saved["normalizedGeneratedLatent"]), "saved rollout not exactly reproduced")
                    require(state_hash(conditions) == condition_hash == saved["conditionStateSha256"], "conditions changed")
                    target = item["image"][None]  # Measurement begins only after the complete target-free rollout.
                    clean_raw = model.autoencoder.encode(target)
                    clean = normalize_latent(clean_raw, normalization)
                    row = {"sampleId": sample, "split": "train", "seed": seed, "targetUsedForInitialization": False,
                        "savedFinalExactlyReproduced": True, "oracleAlgebra": oracle_error(torch, clean, noise, alpha, grid),
                        "aeTargetReconstruction": rgb_diagnostics(torch, model.autoencoder.decode(clean_raw), target), "probes": []}
                    for t, latent in probes.items():
                        check()
                        timestep = torch.tensor([t])
                        teacher_noisy = add_noise(clean, noise, timestep, alpha)
                        teacher_velocity = model.predict_velocity(teacher_noisy, timestep, conditions)
                        teacher_clean, _ = recover_from_velocity(teacher_noisy, teacher_velocity, t, alpha)
                        rgb, evidence = decode_final_visible_rgb(model, denormalize_latent(latent, normalization), conditions,
                            package["config"], return_stage4_semantic_responsibility_evidence=True)
                        row["probes"].append({"timestep": t, "generatedCleanLatentMse": float((latent-clean).square().mean()),
                            "teacherCleanLatentMse": float((teacher_clean-clean).square().mean()),
                            "baseRgb": rgb_diagnostics(torch, evidence["baseDecodedRgb"], target),
                            "finalRgb": rgb_diagnostics(torch, rgb, target)})
                    rows.append(row)
                    print(json.dumps({"recordedAtUtc": now(), "phase": "trajectory_seed_completed", "completed": len(rows),
                        "total": 6, "elapsedSeconds": time.perf_counter()-started, "gpuStarted": False}), flush=True)
        require(state_hash(model.state_dict()) == before, "weights changed")
        require(all(not p.requires_grad and p.grad is None for p in model.parameters()), "training state present")
        for b in plan["inputReceipts"]:
            read_bound(root, b)
        check()
        result.update(status="cpu_fixed_trajectory_completed_not_visual_qualified", executionState="completed", rows=rows,
            summary=summarize(rows), modelStateUnchanged=True, modelStateSha256BeforeAndAfter=before,
            inputBindingsReverified=len(plan["inputReceipts"]))
    except Exception as error:
        result.update(status="cpu_fixed_trajectory_failed_closed", executionState="failed_closed", error=str(error), traceback=traceback.format_exc())
    result.update(recordedAtUtc=now(), elapsedSeconds=time.perf_counter()-started)
    save_json(output / "result.json", result)
    finished = registry(root, "finish", directory)
    save_json(output / "registry-finish.json", finished)
    require(finished["latestTrainingRunId"] == begin["latestTrainingRunId"], "training pointer changed")
    print(json.dumps(file_binding(root, directory + "/result.json")), flush=True)
    require(result["executionState"] == "completed", "trajectory diagnosis failed: " + result.get("error", "unknown"))


if __name__ == "__main__":
    run(Path.cwd())

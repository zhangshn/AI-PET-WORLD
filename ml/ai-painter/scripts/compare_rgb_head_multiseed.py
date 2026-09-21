"""Bounded CPU comparison of frozen RGB heads on six predeclared train-only seeds.

No optimizer, target encoding, checkpoint selection, holdout reading or publication.
The existing inference path and transactional execution registry are reused.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import io
import json
import os
from pathlib import Path
import subprocess
import time
import traceback

import compare_learning_capacity_decoders as paired
import painter_rgb_head_adaptation_experiment as adapter
from painter_learning_capacity_experiment import (
    bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding,
    now, project_file, read_bound, require, save_json,
)
from diagnose_learning_capacity_timesteps import decomposition_metrics

PROGRAM = "ml/ai-painter/scripts/compare_rgb_head_multiseed.py"
TEST = "ml/ai-painter/tests/test_rgb_head_multiseed.py"
SETTINGS = {"device": "cpu", "cpuThreads": 4, "maxWallSeconds": 180, "maxOutputMiB": 16,
    "resolution": [256, 192], "inferenceSteps": 50,
    "seedsBySample": [[20264008, 20264108, 20264208], [20264009, 20264109, 20264209]],
    "optimizerUpdatesAllowed": False, "targetUsedForInitialization": False,
    "checkpointSelectionAllowed": False, "formalQualificationAllowed": False, "automaticRetries": 0}


def validate_settings(value):
    require(value == SETTINGS, "multiseed comparison boundary changed")


def cpu_test_record(returncode, program, stdout, stderr):
    return {"status": "multiseed_cpu_tests_passed" if returncode == 0 else "multiseed_cpu_tests_failed",
        "executionState": "completed" if returncode == 0 else "failed_closed", "exitCode": returncode,
        "recordedAtUtc": now(), "program": program, "stdout": stdout, "stderr": stderr}


def validate_terminal(value):
    require(value.get("executionState") in ("completed", "failed_closed"), "terminal state missing")
    require(isinstance(value.get("status"), str) and bool(value["status"]), "terminal status missing")


def materialize(root, result_binding):
    result = bound_json(root, result_binding)
    package_binding = file_binding(root, str(Path(result_binding["path"]).parent / "experiment.json").replace("\\", "/"))
    package = bound_json(root, package_binding)
    require(package == adapter.materialize(root), "adaptation sources no longer reproduce")
    require(result["experimentIdentity"] == package["experimentIdentity"]
            and result["executionState"] == "completed" and result["optimizerSteps"] == 1000
            and result["status"] == "experiment_executed_not_visual_qualified"
            and result["experimentKind"] == "five_rgb_heads_adaptation_frozen_ae_and_velocity_path"
            and result["frozenPathsUnchanged"] is True, "completed frozen-path adaptation required")
    require(result["qualification"] == package["qualification"]
            and all(v is False for v in result["qualification"].values()), "qualification forbidden")
    original_plan = bound_json(root, package["comparisonPlan"])
    used_seeds = {original_plan["seed"] + original_plan["settings"]["seedOffset"] + i for i in range(2)}
    seeds = [s for row in SETTINGS["seedsBySample"] for s in row]
    require(len(seeds) == len(set(seeds)) == 6 and not used_seeds.intersection(seeds), "seeds reused or duplicated")
    receipts = [*package["inputReceipts"], result_binding, package_binding, *result["artifacts"],
                file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for b in receipts:
        read_bound(root, b)
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "conflicting binding")
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-rgb-head-multiseed-plan-v1", "settings": deepcopy(SETTINGS),
        "adaptationResult": result_binding, "adaptationPackage": package_binding,
        "adaptedCheckpoint": paired.artifact(result, "experimental-checkpoint.pt"),
        "sampleIds": adapter.SAMPLES, "inputReceipts": list(unique.values()),
        "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST),
        "limits": ["Two already-seen train images only; seeds are new, scenes are not.",
            "This measures noise-seed sensitivity, not generalization or semantic correctness.",
            "All six predeclared results are retained; no checkpoint or best-image selection.",
            "Both arms share the same new AE, conditions, pure-noise rollout and generated latent.",
            "Only the five existing RGB heads differ; target RGB is used for metrics only.",
            "Formal Stage4, VJ-2, dataset, GPU, publication and world-entry gates remain unchanged."]}
    return {**payload, "comparisonIdentity": "rgb-head-multiseed-" + digest(canonical_bytes(payload))}


def load_frozen_pair(root, plan):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    package = bound_json(root, plan["adaptationPackage"])
    model, normalization = adapter.load_models(root, package, "cpu")
    cp = torch.load(io.BytesIO(read_bound(root, plan["adaptedCheckpoint"])), map_location="cpu", weights_only=True)
    adapter.validate_checkpoint(cp, package)
    require(state_hash(cp["denoiserState"]) == cp["denoiserStateSha256"], "adapted state hash mismatch")
    old_state, new_state = model.denoiser.state_dict(), cp["denoiserState"]
    require(old_state.keys() == new_state.keys(), "state keys changed")
    allowed = tuple("rgb_responsibility_heads." + name + "." for name in adapter.HEADS)
    changed = [name for name in old_state if not torch.equal(old_state[name], new_state[name])]
    require(changed and all(name.startswith(allowed) for name in changed), "adaptation changed non-head weights")
    require(adapter.frozen_state(model) == cp["frozenPathsStateSha256"], "frozen AE/velocity path mismatch")
    replacement = deepcopy(model.denoiser.rgb_responsibility_heads)
    prefix = "rgb_responsibility_heads."
    replacement.load_state_dict({k[len(prefix):]: v for k, v in new_state.items() if k.startswith(prefix)}, strict=True)
    replacement.eval().requires_grad_(False)
    require(normalization["sampleCount"] == 2
            and bool(torch.isfinite(normalization["standardDeviation"]).all())
            and bool((normalization["standardDeviation"] > 0).all()), "invalid latent normalization")
    return model, replacement, normalization, package


def decode_head_pair(torch, model, replacement, latent, conditions, config, decode):
    from ai_painter.complete_world.split_training import state_hash
    require(tuple(latent.shape) == (1, 12, 48, 64) and tuple(conditions.shape) == (1, 23, 192, 256), "paired input shape mismatch")
    require(latent.device.type == conditions.device.type == "cpu"
            and bool(torch.isfinite(latent).all()) and bool(torch.isfinite(conditions).all()), "CPU finite inputs required")
    original = model.denoiser.rgb_responsibility_heads
    before, values = state_hash((latent, conditions)), {}
    try:
        for name, heads in (("baseline", original), ("adapted", replacement)):
            model.denoiser.rgb_responsibility_heads = heads
            values[name] = decode(model, latent, conditions, config,
                return_stage4_semantic_responsibility_evidence=True)
            require(state_hash((latent, conditions)) == before, "head decode mutated shared inputs")
    finally:
        model.denoiser.rgb_responsibility_heads = original
    left, right = values["baseline"][1], values["adapted"][1]
    require(torch.equal(left["baseDecodedRgb"], right["baseDecodedRgb"]), "paired base RGB changed")
    require(len(left["responsibilityMasks"]) == len(right["responsibilityMasks"])
            and all(torch.equal(a, b) for a, b in zip(left["responsibilityMasks"], right["responsibilityMasks"])), "paired masks changed")
    return values


def measure(torch, final, evidence, target, conditions, config):
    from train_ai_assisted_complete_world import image_edge_loss
    result = decomposition_metrics(torch, final, evidence, target)
    result["final"]["edgeMae"] = float(image_edge_loss(final, target))
    result["semanticRegions"] = {}
    for name in adapter.HEADS:
        index = config["conditionChannelOrder"].index(name)
        mask = conditions[:, index:index + 1]
        count = float(mask.sum())
        require(count > 0, "missing expected region: " + name)
        result["semanticRegions"][name] = {"pixelWeight": count,
            "rgbMae": float(((final - target).abs() * mask).sum() / (3 * count))}
    return result


def summarize(rows):
    require([(r["sampleId"], r["seed"]) for r in rows] ==
            [(sample, seed) for i, sample in enumerate(adapter.SAMPLES) for seed in SETTINGS["seedsBySample"][i]], "incomplete or reordered seed matrix")
    result = []
    for sample in adapter.SAMPLES:
        selected = [r for r in rows if r["sampleId"] == sample]
        metrics = {}
        for label in ("wholeRgbMae", "laplacianMae", "edgeMae", "phase4ResidualRmsAfterGlobalBiasRemoval", *adapter.HEADS):
            key = "rgbMae" if label == "wholeRgbMae" else label
            def read(row, arm):
                m = row["measurements"][arm]
                return m["semanticRegions"][label]["rgbMae"] if label in adapter.HEADS else m["final"][key]
            left, right = ([read(r, arm) for r in selected] for arm in ("baseline", "adapted"))
            metrics[label] = {"baselineRange": [min(left), max(left)], "adaptedRange": [min(right), max(right)],
                "improvedCount": sum(b < a for a, b in zip(left, right)),
                "worseCount": sum(b > a for a, b in zip(left, right)), "equalCount": sum(a == b for a, b in zip(left, right)),
                "relativeReductionPercentRange": [min((a-b)/a*100 for a,b in zip(left,right)), max((a-b)/a*100 for a,b in zip(left,right))] if all(a > 0 for a in left) else None}
        result.append({"sampleId": sample, "seedCount": len(selected), "metrics": metrics})
    return result


def registry(root, mode, directory):
    # Only display/task labels differ. Ownership, CAS, locks and evidence use the existing writer.
    evidence_path = project_file(root, directory + ("/cpu-tests.json" if mode == "begin" else "/result.json"))
    validate_terminal(json.loads(evidence_path.read_text(encoding="utf-8")))
    bridge = paired.REGISTRY_BRIDGE
    for old, new in (("cpu_paired_decoder_comparison", "cpu_rgb_head_multiseed_comparison"),
                     ("cpu_decoder_comparison_", "cpu_rgb_head_multiseed_"),
                     ("Compare two frozen decoders on identical train-only generated latents; no training or publication",
                      "Compare frozen RGB heads on six fixed CPU train-only seeds; no training, selection or publication")):
        require(old in bridge, "registry display bridge changed")
        bridge = bridge.replace(old, new)
    run = subprocess.run(["node", "--input-type=module", "-e", bridge, mode, directory, str(os.getpid())],
        cwd=root, capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    require(run.returncode == 0, "registry bridge failed: " + run.stderr[-4000:])
    return json.loads(run.stdout.strip())


def run(root, binding):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    from train_ai_assisted_conditional_denoiser import (
        build_diffusion_schedule, decode_final_visible_rgb, denormalize_latent, save_tensor_png,
    )
    validate_settings(SETTINGS)
    require(not torch.cuda.is_initialized(), "CPU-only comparison required")
    torch.set_num_threads(SETTINGS["cpuThreads"])
    plan = materialize(root, binding)
    directory = paired.ROOT + "/" + plan["comparisonIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)
    tests = subprocess.run([os.sys.executable, "-m", "unittest", "discover", "-s", "ml/ai-painter/tests",
        "-p", Path(TEST).name, "-v"], cwd=root, capture_output=True, text=True, timeout=60,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    save_json(output / "cpu-tests.json", cpu_test_record(tests.returncode, plan["testProgram"], tests.stdout, tests.stderr))
    require(tests.returncode == 0, "multiseed CPU tests failed: " + tests.stderr[-4000:])
    try:
        begin = registry(root, "begin", directory)
    except Exception as error:
        save_json(output / "launch-failure.json", {"status": "registry_begin_failed", "executionState": "failed_closed",
            "runId": plan["comparisonIdentity"], "recordedAtUtc": now(), "error": str(error),
            "traceback": traceback.format_exc(), "comparisonRolloutsCompleted": 0, "gpuStarted": False,
            "trainingStarted": False, "optimizerSteps": 0, "formalQualificationAllowed": False})
        raise
    save_json(output / "registry-start.json", begin)
    started = last_heartbeat = time.perf_counter()

    def check():
        nonlocal last_heartbeat
        require(time.perf_counter() - started < SETTINGS["maxWallSeconds"], "multiseed inference timeout")
        require(not torch.cuda.is_initialized(), "comparison initialized CUDA")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < SETTINGS["maxOutputMiB"] * 2**20, "output budget exceeded")
        if time.perf_counter() - last_heartbeat >= 8:
            paired.refresh_heartbeat(output / "heartbeat.json")
            last_heartbeat = time.perf_counter()

    def progress(phase, **extra):
        value = {"comparisonIdentity": plan["comparisonIdentity"], "recordedAtUtc": now(), "phase": phase,
            "elapsedSeconds": time.perf_counter() - started, "gpuStarted": False, "trainingStarted": False,
            "optimizerSteps": 0, **extra}
        save_json(output / "progress.json", value, mutable=True)
        print(json.dumps(value), flush=True)

    result = {"schemaVersion": "ai-painter-rgb-head-multiseed-result-v1", "runId": plan["comparisonIdentity"],
        "comparisonIdentity": plan["comparisonIdentity"], "plan": file_binding(root, directory + "/plan.json"),
        "gpuStarted": False, "trainingStarted": False, "optimizerSteps": 0, "checkpointSelected": False,
        "formalQualificationAllowed": False, "limits": plan["limits"]}
    try:
        model, replacement, normalization, package = load_frozen_pair(root, plan)
        before = state_hash((model.state_dict(), replacement.state_dict()))
        dataset = adapter.HeadDataset(root, package)
        require(len(dataset) == 2, "dataset scope changed")
        alpha = build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        rows, variation = [], []
        progress("six_seed_inference_started")
        with torch.inference_mode(), exact_inference_runtime(torch):
            for index, sample in enumerate(adapter.SAMPLES):
                item = dataset[index]
                require(item["sampleId"] == sample, "sample order mismatch")
                conditions = item["conditions"][None]
                adapter.validate_coverage(model, conditions, package["config"])
                condition_hash, finals = state_hash(conditions), []
                for j, seed in enumerate(SETTINGS["seedsBySample"][index]):
                    noise, latent, grid = paired.pure_noise_rollout(torch, model.predict_velocity, (1, 12, 48, 64),
                        conditions, alpha, seed, check)
                    require(state_hash(conditions) == condition_hash, "sampling mutated conditions")
                    raw = denormalize_latent(latent, normalization)
                    arms = decode_head_pair(torch, model, replacement, raw, conditions, package["config"], decode_final_visible_rgb)
                    target = item["image"][None]  # First target use is after pure-noise generation and both decodes.
                    measured = {}
                    for name, (final, evidence) in arms.items():
                        measured[name] = measure(torch, final, evidence, target, conditions, package["config"])
                        save_tensor_png(final[0], output / f"{name}-{index}-{j}.png")
                    save_tensor_png(arms["baseline"][1]["baseDecodedRgb"][0], output / f"base-{index}-{j}.png")
                    if j == 0:
                        save_tensor_png(target[0], output / f"target-{index}.png")
                    finals.append(arms["adapted"][0].clone())
                    with (output / f"sampling-{index}-{j}.pt").open("xb") as stream:
                        torch.save({"schemaVersion": "ai-painter-multiseed-generated-tensors-v1",
                            "comparisonIdentity": plan["comparisonIdentity"], "sampleId": sample, "seed": seed,
                            "noise": noise, "normalizedGeneratedLatent": latent, "denormalizedGeneratedLatent": raw,
                            "conditionStateSha256": condition_hash, "targetUsedForInitialization": False}, stream)
                        stream.flush()
                        os.fsync(stream.fileno())
                    rows.append({"sampleId": sample, "split": "train", "seed": seed, "inferenceSteps": len(grid),
                        "targetEncoded": False, "targetUsedForInitialization": False, "pairedInputsIdentical": True,
                        "baseRgbExactlyIdentical": True, "responsibilityMasksExactlyIdentical": True,
                        "conditionStateSha256": condition_hash, "noiseStateSha256": state_hash(noise),
                        "generatedLatentStateSha256": state_hash(raw), "measurements": measured})
                    check()
                    progress("seed_completed", completed=len(rows), total=6, sampleId=sample, seed=seed)
                variation.append({"sampleId": sample, "adaptedPairwiseSeedDifferences": [
                    {"seedA": SETTINGS["seedsBySample"][index][a], "seedB": SETTINGS["seedsBySample"][index][b],
                     "rgbMaeBetweenOutputs": float((finals[a] - finals[b]).abs().mean()),
                     "maximumAbsoluteDifference": float((finals[a] - finals[b]).abs().max())}
                    for a in range(3) for b in range(a + 1, 3)]})
        require(state_hash((model.state_dict(), replacement.state_dict())) == before, "model weights changed")
        require(all(not p.requires_grad and p.grad is None for p in list(model.parameters()) + list(replacement.parameters())), "training state present")
        require(len({r["noiseStateSha256"] for r in rows}) == 6, "noise seeds not distinct")
        for b in plan["inputReceipts"]:
            read_bound(root, b)
        check()
        result.update(status="cpu_multiseed_comparison_completed_not_visual_qualified", executionState="completed",
            rows=rows, summary=summarize(rows), seedVariation=variation, modelStatesUnchanged=True,
            modelStateSha256BeforeAndAfter=before, inputBindingsReverified=len(plan["inputReceipts"]))
    except Exception as error:
        result.update(status="cpu_multiseed_comparison_failed_closed", executionState="failed_closed",
            error=str(error), traceback=traceback.format_exc())
    result.update(recordedAtUtc=now(), elapsedSeconds=time.perf_counter() - started,
        artifacts=[file_binding(root, directory + "/" + p.name) for p in sorted(output.iterdir()) if p.suffix in (".png", ".pt")])
    save_json(output / "result.json", result)
    try:
        paired.refresh_heartbeat(output / "heartbeat.json")
    except OSError as error:
        save_json(output / "heartbeat-final-warning.json", {"recordedAtUtc": now(), "error": str(error)})
    finished = registry(root, "finish", directory)
    save_json(output / "registry-finish.json", finished)
    require(finished["latestTrainingRunId"] == begin["latestTrainingRunId"], "comparison changed latest training pointer")
    progress(result["executionState"])
    print(json.dumps(file_binding(root, directory + "/result.json")), flush=True)
    require(result["executionState"] == "completed", "multiseed comparison failed: " + result.get("error", "unknown"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adaptation-result", required=True)
    parser.add_argument("--adaptation-sha256", required=True)
    args = parser.parse_args()
    run(Path.cwd(), {"path": args.adaptation_result, "sha256": args.adaptation_sha256})

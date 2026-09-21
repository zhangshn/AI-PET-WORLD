"""Thirty-six fixed CPU rollouts; sampler comparison, not model selection."""
from __future__ import annotations
import argparse
import io
import json
import math
import os
from pathlib import Path
import time

import painter_timestep_ab_experiment as trial
import compare_decoder_adapted_sampling as sampling
from painter_learning_capacity_experiment import bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding, project_file, read_bound, require
from verify_timestep_experiment_replay import verify_replay

STEPS = (50, 25, 10)
METRICS = sampling.METRICS
LIMITS = {"wallSeconds": 420, "cpuThreads": 4, "optimizerSteps": 0,
          "fixedSeedRollouts": 36, "automaticRetries": 0, "maxOutputMiB": 8}


def expected_matrix():
    return [(arm, sample, seed, steps) for arm in trial.ARMS for i, sample in enumerate(trial.previous.SAMPLES)
            for seed in trial.comparison.SETTINGS["seedsBySample"][i] for steps in STEPS]


def summarize(rows):
    require([(r["arm"], r["sampleId"], r["seed"], r["steps"]) for r in rows] == expected_matrix(), "incomplete or reordered sampling matrix")
    for r in rows:
        require(r["split"] == "train" and r["targetUsedForInitialization"] is False, "sample purpose changed")
        require(r["fullEndpoint"] is True, "incomplete diffusion endpoint")
        for k in METRICS:
            v = r["measurements"]["final"][k]
            require(type(v) in (int, float) and math.isfinite(v) and v >= 0, "invalid metric")
        for name in trial.previous.HEADS:
            v = r["measurements"]["semanticRegions"][name]["rgbMae"]
            require(type(v) in (int, float) and math.isfinite(v) and v >= 0, "invalid region metric")
    groups = {}
    for arm in trial.ARMS:
        selected = [r for r in rows if r["arm"] == arm]
        groups[arm] = {}
        for steps in STEPS[1:]:
            stats = {}
            for metric in (*METRICS, *trial.previous.HEADS):
                def value(r):
                    return r["measurements"]["final"][metric] if metric in METRICS else r["measurements"]["semanticRegions"][metric]["rgbMae"]
                pairs = [(value(selected[o]), value(selected[o+STEPS.index(steps)])) for o in range(0,18,3)]
                delta = [b-a for a,b in pairs]
                pct = [(a-b)/a*100 for a,b in pairs] if all(a > 0 for a,b in pairs) else None
                stats[metric] = {"improvedCount": sum(d < 0 for d in delta), "worseCount": sum(d > 0 for d in delta),
                    "equalCount": sum(d == 0 for d in delta), "absoluteChangeRange": [min(delta), max(delta)],
                    "relativeReductionPercentRange": [min(pct), max(pct)] if pct else None}
            groups[arm][str(steps)] = stats
    return {"comparedWithOwn50Steps": groups, "checkpointSelected": False, "samplerSelected": False,
            "rootCauseProven": False, "formalVisualQualification": False}


def compare(root, request_binding):
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    from ai_painter.complete_world.split_training import state_hash
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "explicit CPU isolation required")
    request = bound_json(root, request_binding)
    require(request["schemaVersion"] == "ai-painter-paired-sampling-shadow-request-v1" and request["limits"] == LIMITS,
            "sampling request boundary changed")
    require(request["outputRoot"] == trial.previous.ROOT+"/"+request["identity"]
            and request["identity"].startswith("paired-sampling-shadow-")
            and request_binding["path"] == request["outputRoot"]+"/diagnostic-request.json", "output identity mismatch")
    require(request["mode"] == "cpu_paired_sampling_grids_no_training_or_release", "wrong sampling mode")
    torch.set_num_threads(4)
    started = time.monotonic()
    output = project_file(root, request["outputRoot"])

    def check():
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(time.monotonic()-started < 330, "sampling CPU time limit")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < 8*2**20, "sampling output limit")

    source_binding = request["sourceResult"]
    source = bound_json(root, source_binding)
    package = trial.materialize(root)
    require(bound_json(root, request["sourcePackage"]) == package, "source package changed")
    require(source_binding["path"] == trial.previous.ROOT+"/"+package["experimentIdentity"]+"/result.json", "source namespace changed")
    verify_replay(source, source["rows"])
    require([a["arm"] for a in source["arms"]] == list(trial.ARMS), "checkpoint arm order changed")
    for b in request["inputReceipts"]: read_bound(root, b)
    artifacts = {Path(b["path"]).name:b for b in source["artifacts"]}
    plan = bound_json(root, package["sourceComparisonPlan"])
    rows, baseline_rows, images = [], [], []
    common_frozen = None
    for arm_index, arm in enumerate(source["arms"]):
        model, heads, normalization, adaptation = trial.comparison.load_frozen_pair(root, plan)
        model.denoiser.rgb_responsibility_heads = heads
        expected_heads = state_hash(heads.state_dict())
        cp = torch.load(io.BytesIO(read_bound(root, arm["checkpoint"])), map_location="cpu", weights_only=True)
        trial.validate_checkpoint(cp, package, arm["arm"])
        model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "checkpoint state mismatch")
        require(state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) == expected_heads, "heads changed")
        require(trial.frozen_hash(model) == cp["frozenStateSha256"] == arm["frozenStateSha256"], "frozen asset changed")
        frozen = state_hash((model.autoencoder.state_dict(), heads.state_dict(), normalization))
        require(common_frozen is None or frozen == common_frozen, "paired frozen assets differ")
        common_frozen = frozen
        before = state_hash((model.state_dict(), normalization))
        dataset = trial.previous.HeadDataset(root, adaptation)
        alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(trial.previous.SAMPLES):
                item = dataset[i]
                target, conditions = item["image"][None], item["conditions"][None]
                input_hash = state_hash((target, conditions))
                for j, seed in enumerate(trial.comparison.SETTINGS["seedsBySample"][i]):
                    noise_hash = None
                    for steps in STEPS:
                        check()
                        noise, latent, _, grid = sampling.rollout(torch, model.predict_velocity, conditions, alpha, seed, steps, check)
                        require(len(grid) == steps and grid[0][0] == 999 and grid[-1] == (0, -1), "incomplete endpoint")
                        actual_noise = state_hash(noise)
                        require(noise_hash is None or actual_noise == noise_hash, "sampling noise changed")
                        noise_hash = actual_noise
                        rgb, evidence = trainer.decode_final_visible_rgb(model, trainer.denormalize_latent(latent, normalization),
                            conditions, package["config"], return_stage4_semantic_responsibility_evidence=True)
                        measured = trial.comparison.measure(torch, rgb, evidence, target, conditions, package["config"])
                        if steps == 50:
                            saved = source["rows"][arm_index*6+i*3+j]
                            require(measured == saved["measurements"], "50-step source metrics differ")
                            image_binding = artifacts[f"{arm['arm']}-{i}-{j}.png"]
                            sampling.png_matches(root, image_binding, rgb)
                            baseline_rows.append({**saved, "measurements": measured})
                        else:
                            filename = f"{arm['arm']}-{steps}-{i}-{j}.png"
                            require(not (output/filename).exists(), "immutable image conflict")
                            trainer.save_tensor_png(rgb[0], output/filename)
                            image_binding = file_binding(root, request["outputRoot"]+"/"+filename)
                            images.append(image_binding)
                        rows.append({"arm":arm["arm"], "sampleId":sample, "split":"train", "seed":seed, "steps":steps,
                            "targetUsedForInitialization":False, "fullEndpoint":True, "noiseStateSha256":actual_noise,
                            "measurements":measured, "image":image_binding, "baselinePixelsAndMeasurementsExact":steps == 50})
                require(state_hash((target, conditions)) == input_hash, "input tensors changed")
        require(state_hash((model.state_dict(), normalization)) == before, "model or normalization changed")
        del model, heads, cp, dataset
    baseline_summary = verify_replay(source, baseline_rows)
    for b in [*request["inputReceipts"], *images, request_binding]: read_bound(root, b); check()
    return {"schemaVersion":"ai-painter-paired-sampling-comparison-v1", "status":"sampling_comparison_completed_not_qualified",
        "sourceResult":source_binding, "sourcePackage":request["sourcePackage"], "rows":rows, "summary":summarize(rows),
        "baselineReplay":{"status":"metrics_replayed_exactly", "cudaInitialized":False, "optimizerSteps":0,
            "fixedSeedRollouts":12,"imagesWritten":0,"checkpointsWritten":0,"rowsReplayed":12,"summary":baseline_summary},
        "baselineRowsSha256":digest(canonical_bytes(baseline_rows)), "sourcePngPixelsReproduced":12,
        "inputBindingsReverified":len(request["inputReceipts"]), "fixedSeedRollouts":36,"imagesWritten":24,"images":images,
        "modelAndNormalizationUnchanged":True,"cudaInitialized":torch.cuda.is_initialized(),"optimizerSteps":0,"checkpointsWritten":0,
        "limitations":["Two seen train scenes; no generalization or formal visual claim.",
            "Every grid ends at the clean endpoint; shorter grids are not early-stopped intermediate images.",
            "All 24 shorter-grid images are retained; no best-image or checkpoint selection.",
            "Only sampling grid length changes. Neither default configuration nor model weights are changed."],
        "elapsedSeconds":time.monotonic()-started}


if __name__ == "__main__":
    p=argparse.ArgumentParser();p.add_argument("--request",required=True);p.add_argument("--request-sha256",required=True)
    a=p.parse_args()
    print(json.dumps(compare(Path.cwd(),{"path":a.request,"sha256":a.request_sha256}),allow_nan=False),flush=True)

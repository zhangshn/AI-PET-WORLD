"""CPU-only parity/trajectory probes and a non-adopted schedule repair proposal."""
from __future__ import annotations

import io
import json
import math
import os
from pathlib import Path
import subprocess
import time
import traceback

import compare_decoder_adapted_sampling as sampling
from ai_painter.complete_world.sample_timestep_schedule import SCHEMA, sample_timestep, coverage_by_sample
from painter_learning_capacity_experiment import (
    bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding,
    now, project_file, read_bound, require, save_json,
)

PROGRAM = "ml/ai-painter/scripts/diagnose_training_sampling_alignment.py"
TEST = "ml/ai-painter/tests/test_training_sampling_alignment.py"
SCHEDULE = "ml/ai-painter/src/ai_painter/complete_world/sample_timestep_schedule.py"
SOURCE = {"path": ".runtime/ai-painter/learning-capacity-experiments/adapted-sampling-64654bf110067964d2ccaf7d8d74f04fcbb2e7e8c739e7943e9259161e17f44a/result.json",
          "sha256": "e1540bd1d33c97f8cec27c19122895893c4a5973d5c987f138a505063d579895"}
PAIRS = tuple((t, t+1) for t in range(0, 1000, 100))
SETTINGS = {"device": "cpu", "cpuThreads": 4, "maxWallSeconds": 300, "maxOutputMiB": 4,
    "resolution": [256, 192], "seedsBySample": sampling.SETTINGS["seedsBySample"],
    "trajectorySteps": 50, "snapshotTimesteps": list(sampling.trajectory.SNAPSHOTS),
    "adjacentParityPairs": [list(p) for p in PAIRS], "automaticRetries": 0,
    "optimizerUpdatesAllowed": False, "scheduleAdoptionAllowed": False, "formalQualificationAllowed": False}


def coverage_proposal(config):
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    require(config["diffusionSteps"] == 1000 and config["training"]["timestepCoverageStride"] == 137
            and config["training"]["timestepSampling"] == "deterministic_full_schedule_cover_v2", "source schedule changed")
    samples = sampling.source.previous.SAMPLES
    grid = trainer.inference_timesteps(1000, 50, "cpu").tolist()
    result = {}
    for count in (500, 1000):
        old = {s: [int(trainer.training_timesteps(config, e, i, 2, 1, 1000, "cpu").item())
                   for e in range(count)] for i,s in enumerate(samples)}
        new = {s: [sample_timestep(sample_ordinal=i, sample_count=2, presentation_index=e,
                                  diffusion_steps=1000, stride=137, seed=config["training"]["seed"])
                   for e in range(count)] for i,s in enumerate(samples)}
        result[str(count)] = {"legacy": coverage_by_sample(old, diffusion_steps=1000, inference_timesteps=grid),
            "proposed": coverage_by_sample(new, diffusion_steps=1000, inference_timesteps=grid),
            "legacySequenceSha256": digest(canonical_bytes(old)), "proposedSequenceSha256": digest(canonical_bytes(new))}
    require(result["500"]["legacy"]["globalUnionFullScheduleCovered"] is True
            and result["500"]["legacy"]["everySampleFullScheduleCovered"] is False, "legacy alias no longer reproduces")
    require(result["1000"]["legacy"]["everySampleFullScheduleCovered"] is False
            and result["1000"]["proposed"]["everySampleFullScheduleCovered"] is True, "proposed full-cycle guarantee failed")
    require(all(r["evenPresentations"] == r["oddPresentations"] == 250
                for r in result["500"]["proposed"]["samples"].values()), "proposed half-cycle parity unbalanced")
    return {"schemaVersion": SCHEMA, "implementationStatus": "cpu_implemented_not_adopted_not_trained",
        "boundaries": ["Stable ordinal in the exact two-sample list, not shuffled batch position.",
            "Advance each sample counter only when that sample is actually presented.",
            "500 presentations still cover only 500 distinct timesteps per sample, not all 1000.",
            "1000-presentation calculation is a CPU proof, not authorization or evidence of extra training."],
        "legacyPerSampleCycleLength": 1000 // math.gcd(2*137, 1000), "coverage": result}


def materialize(root):
    result = bound_json(root, SOURCE)
    plan = bound_json(root, result["plan"])
    require(plan == sampling.materialize(root), "source sampling inputs changed")
    require(result["executionState"] == "completed" and result["modelAndNormalizationUnchanged"] is True
            and result["summary"] == sampling.summarize(result["rows"]), "source sampling incomplete")
    package = bound_json(root, plan["sourcePackage"])
    bindings = [*plan["inputReceipts"], SOURCE, result["plan"], *result["artifacts"],
                file_binding(root, PROGRAM), file_binding(root, TEST), file_binding(root, SCHEDULE)]
    unique = {}
    for b in bindings:
        read_bound(root, b)
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "conflicting binding")
        unique[b["path"]] = {k:b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-training-sampling-alignment-plan-v1", "sourceResult": SOURCE,
        "sourcePlan": result["plan"], "settings": SETTINGS, "coverageProposal": coverage_proposal(package["config"]),
        "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST),
        "scheduleProgram": file_binding(root, SCHEDULE), "inputReceipts": list(unique.values()),
        "limits": ["Two already-used train scenes and six old seeds; no independent qualification.",
            "Adjacent even/odd timesteps differ in noise level, so their error ratio is not a causal A/B proof.",
            "Forward-noised targets are diagnostic teacher inputs only; never sampling initializers or candidates.",
            "Training on forward-noised targets is not itself a software bug; rollout distribution sensitivity is measured separately.",
            "The schedule proposal is CPU implemented and tested only, with no trainer/config/checkpoint adoption.",
            "No GPU, optimizer updates, new images/checkpoints, extra data, losses, thresholds or Runtime changes."]}
    return {**payload, "comparisonIdentity": "sampling-alignment-" + digest(canonical_bytes(payload))}


def capture(torch, predict, conditions, alpha, seed, check):
    """Capture real pre-prediction states without accepting a target."""
    raw = {}
    def wrapped(latent, timestep, supplied_conditions):
        t = int(timestep.item())
        if t in sampling.trajectory.SNAPSHOTS:
            raw[t] = latent.clone()
        return predict(latent, timestep, supplied_conditions)
    noise, final, probes, grid = sampling.trajectory.capture_rollout(torch, wrapped, conditions, alpha, seed, check)
    require(tuple(raw) == sampling.trajectory.SNAPSHOTS, "raw probe matrix incomplete")
    return noise, final, probes, raw, grid


def summarize(rows):
    expected = [(s, seed) for i,s in enumerate(sampling.source.previous.SAMPLES) for seed in SETTINGS["seedsBySample"][i]]
    require([(r["sampleId"], r["seed"]) for r in rows] == expected, "incomplete/reordered six-seed matrix")
    ratios, trajectory = [], []
    for i,row in enumerate(rows):
        require(row["split"] == "train" and row["baselinePixelsAndMeasurementsExact"] is True
                and row["targetUsedForInitialization"] is False, "sample/replay scope changed")
        require([tuple(p["timesteps"]) for p in row["parityPairs"]] == list(PAIRS), "parity pair matrix changed")
        for pair in row["parityPairs"]:
            seen = i // 3  # Source: sample 146 even, 147 odd, independently enumerated below.
            require(pair["sourceArmCoveredParity"] == seen, "source arm parity mismatch")
            values = pair["teacherCleanLatentMse"]
            require(len(values) == 2 and all(type(v) in (int,float) and math.isfinite(v) and v >= 0 for v in values), "invalid teacher metric")
            ratios.append({"sampleId": row["sampleId"], "seed": row["seed"], "timesteps": pair["timesteps"],
                "seenMse": values[seen], "unseenMse": values[1-seen],
                "unseenToSeenRatio": values[1-seen]/values[seen] if values[seen] > 0 else None})
        require(tuple(p["timestep"] for p in row["trajectory"]) == sampling.trajectory.SNAPSHOTS, "trajectory matrix changed")
        for p in row["trajectory"]:
            for key in ("freeCleanLatentMse", "teacherCleanLatentMse", "inputDistributionMse"):
                require(type(p[key]) in (int,float) and math.isfinite(p[key]) and p[key] >= 0, "invalid trajectory metric")
        trajectory.append({"sampleId":row["sampleId"], "seed":row["seed"], "probes":row["trajectory"]})
    return {"parityComparisons":ratios, "trajectoryComparisons":trajectory,
        "parityAloneProvesNoiseCause":False, "trainingInputFormulaIsBug":False,
        "scheduleAdopted":False, "checkpointSelected":False, "formalVisualQualification":False}


def run(root):
    import torch
    from ai_painter.complete_world.split_training import state_hash
    from ai_painter.complete_world.diffusion import recover_from_velocity
    import train_ai_assisted_conditional_denoiser as trainer
    require(not torch.cuda.is_initialized(), "CPU only")
    torch.set_num_threads(SETTINGS["cpuThreads"])
    plan = materialize(root)
    directory = sampling.source.comparison.paired.ROOT + "/" + plan["comparisonIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)
    tests = subprocess.run([os.sys.executable,"-m","unittest","discover","-s","ml/ai-painter/tests","-p",Path(TEST).name,"-v"],
        cwd=root,capture_output=True,text=True,timeout=60,creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
    save_json(output / "cpu-tests.json", {"status":"alignment_cpu_tests_passed" if tests.returncode == 0 else "alignment_cpu_tests_failed",
        "executionState":"completed" if tests.returncode == 0 else "failed_closed", "program":plan["testProgram"],
        "recordedAtUtc":now(),"exitCode":tests.returncode,"stdout":tests.stdout,"stderr":tests.stderr})
    require(tests.returncode == 0,"alignment CPU tests failed: "+tests.stderr[-3000:])
    try:
        begin = sampling.trajectory.registry(root,"begin",directory)
    except Exception as error:
        save_json(output / "launch-failure.json", {"executionState":"failed_closed","error":str(error),"recordedAtUtc":now(),
            "gpuStarted":False,"trainingStarted":False})
        raise
    save_json(output / "registry-start.json",begin)
    started = heartbeat = time.perf_counter()
    def check():
        nonlocal heartbeat
        require(time.perf_counter()-started < SETTINGS["maxWallSeconds"],"alignment CPU timeout")
        require(not torch.cuda.is_initialized(),"CUDA initialized")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < SETTINGS["maxOutputMiB"]*2**20,"output budget exceeded")
        if time.perf_counter()-heartbeat >= 8:
            sampling.source.comparison.paired.refresh_heartbeat(output / "heartbeat.json")
            heartbeat = time.perf_counter()
    rows = []
    result = {"schemaVersion":"ai-painter-training-sampling-alignment-result-v1","runId":plan["comparisonIdentity"],
        "plan":file_binding(root,directory+"/plan.json"),"gpuStarted":False,"trainingStarted":False,"optimizerSteps":0,
        "scheduleAdopted":False,"formalQualificationAllowed":False,"limits":plan["limits"]}
    try:
        prior = bound_json(root,SOURCE)
        splan = bound_json(root,plan["sourcePlan"])
        package = bound_json(root,splan["sourcePackage"])
        model,heads,normalization,adaptation = sampling.source.comparison.load_frozen_pair(root,bound_json(root,package["sourceComparisonPlan"]))
        model.denoiser.rgb_responsibility_heads = heads
        expected_heads = state_hash(heads.state_dict())
        cp = torch.load(io.BytesIO(read_bound(root,splan["checkpoint"])),map_location="cpu",weights_only=True)
        sampling.source.validate_checkpoint(cp,package,sampling.ARM)
        model.denoiser.load_state_dict(cp["denoiserState"],strict=True)
        model.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"]
                and state_hash(model.denoiser.rgb_responsibility_heads.state_dict()) == expected_heads,"model identity mismatch")
        before = state_hash((model.state_dict(),normalization))
        dataset = sampling.source.previous.HeadDataset(root,adaptation)
        alpha = trainer.build_diffusion_schedule(package["config"],"cpu")["alphasCumulative"]
        with torch.inference_mode(),exact_inference_runtime(torch):
            for i,sample in enumerate(sampling.source.previous.SAMPLES):
                item = dataset[i]
                require(len(dataset) == 2 and item["sampleId"] == sample,"sample scope changed")
                conditions = item["conditions"][None]
                condition_hash = state_hash(conditions)
                seen = {int(trainer.training_timesteps(package["config"],e,i,2,1,1000,"cpu").item()) for e in range(500)}
                require(len(seen) == 500 and all(t % 2 == i for t in seen),"history parity assumption changed")
                for j,seed in enumerate(SETTINGS["seedsBySample"][i]):
                    noise,final,probes,raw,grid = capture(torch,model.predict_velocity,conditions,alpha,seed,check)
                    target = item["image"][None]  # No target is accepted by capture or the sampling predictor.
                    clean = trainer.normalize_latent(model.autoencoder.encode(target),normalization)
                    baseline = prior["rows"][(i*3+j)*3]
                    require((baseline["sampleId"],baseline["seed"],baseline["steps"]) == (sample,seed,50),"baseline identity changed")
                    rgb,evidence = trainer.decode_final_visible_rgb(model,trainer.denormalize_latent(final,normalization),conditions,
                        package["config"],return_stage4_semantic_responsibility_evidence=True)
                    measured = sampling.source.comparison.measure(torch,rgb,evidence,target,conditions,package["config"])
                    require(measured == baseline["measurements"],"baseline metrics changed")
                    sampling.png_matches(root,baseline["image"],rgb)
                    require(state_hash(noise) == baseline["noiseStateSha256"],"baseline noise changed")
                    cache = {}
                    def teacher(t):
                        if t not in cache:
                            check()
                            step = torch.tensor([t])
                            noisy = trainer.add_noise(clean,noise,step,alpha)
                            velocity = model.predict_velocity(noisy,step,conditions)
                            predicted,_ = recover_from_velocity(noisy,velocity,t,alpha)
                            cache[t] = (float((predicted-clean).square().mean()),noisy)
                        return cache[t]
                    parity = [{"timesteps":list(pair),"sourceArmCoveredParity":i,
                               "teacherCleanLatentMse":[teacher(t)[0] for t in pair]} for pair in PAIRS]
                    points = []
                    for t,latent in probes.items():
                        mse,noisy = teacher(t)
                        require(float((latent-clean).square().mean()) == next(p for p in baseline["probes"] if p["timestep"] == t)["generatedCleanLatentMse"],
                                "baseline latent probe changed")
                        points.append({"timestep":t,"coveredBySource1000StepArm":t in seen,
                            "freeCleanLatentMse":float((latent-clean).square().mean()),"teacherCleanLatentMse":mse,
                            "inputDistributionMse":float((raw[t]-noisy).square().mean())})
                    require(state_hash(conditions) == condition_hash == baseline["conditionStateSha256"],"conditions changed")
                    rows.append({"sampleId":sample,"split":"train","seed":seed,"baselinePixelsAndMeasurementsExact":True,
                        "targetUsedForInitialization":False,"noiseStateSha256":state_hash(noise),"parityPairs":parity,"trajectory":points})
                    progress = {"phase":"alignment_seed_completed","recordedAtUtc":now(),"completed":len(rows),"total":6,
                        "elapsedSeconds":time.perf_counter()-started,"gpuStarted":False,"trainingStarted":False}
                    save_json(output / "progress.json",progress,mutable=True)
                    print(json.dumps(progress),flush=True)
        require(state_hash((model.state_dict(),normalization)) == before,"model/normalization changed")
        require(all(not p.requires_grad and p.grad is None for p in model.parameters()),"training state present")
        for b in plan["inputReceipts"]:
            read_bound(root,b)
        check()
        result.update(status="cpu_training_sampling_alignment_completed_not_visual_qualified",executionState="completed",
            summary=summarize(rows),coverageProposal=plan["coverageProposal"],modelAndNormalizationUnchanged=True,
            modelAndNormalizationStateSha256=before,inputBindingsReverified=len(plan["inputReceipts"]))
    except Exception as error:
        result.update(status="cpu_training_sampling_alignment_failed_closed",executionState="failed_closed",error=str(error),traceback=traceback.format_exc())
    result.update(rows=rows,recordedAtUtc=now(),elapsedSeconds=time.perf_counter()-started)
    save_json(output / "result.json",result)
    finished = sampling.trajectory.registry(root,"finish",directory)
    save_json(output / "registry-finish.json",finished)
    require(finished["latestTrainingRunId"] == begin["latestTrainingRunId"],"training pointer changed")
    print(json.dumps(file_binding(root,directory+"/result.json")),flush=True)
    require(result["executionState"] == "completed","alignment failed: "+result.get("error","unknown"))


if __name__ == "__main__":
    run(Path.cwd())

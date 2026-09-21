"""CPU-only paired decoder inference on two existing train conditions.

One pure-noise rollout per sample, two decoders on identical generated latents.
Uses the existing current-execution registry; never trains or publishes a model.
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

from painter_learning_capacity_experiment import (
    ExperimentDataset, bound_json, canonical_bytes, digest, exact_inference_runtime,
    file_binding, now, project_file, read_bound, require, save_json,
    validate_experiment_checkpoint,
)
from painter_decoder_reconstruction_experiment import materialize, validate_checkpoint, SAMPLES
from diagnose_learning_capacity_timesteps import decomposition_metrics, rollout_grid

PROGRAM = "ml/ai-painter/scripts/compare_learning_capacity_decoders.py"
TEST = "ml/ai-painter/tests/test_learning_capacity_decoder_comparison.py"
ROOT = ".runtime/ai-painter/learning-capacity-experiments"
SETTINGS = {"device": "cpu", "cpuThreads": 4, "maxWallSeconds": 180, "maxOutputMiB": 16,
    "resolution": [256, 192], "inferenceSteps": 50, "seedOffset": 3000,
    "optimizerUpdatesAllowed": False, "targetUsedForInitialization": False,
    "formalQualificationAllowed": False, "automaticRetries": 0}


def validate_settings(settings):
    require(settings == SETTINGS, "paired diagnosis boundary changed")


def artifact(result, name):
    matches = [b for b in result["artifacts"] if Path(b["path"]).name == name]
    require(len(matches) == 1, "unique source artifact required: " + name)
    return matches[0]


def materialize_plan(root, decoder_result_binding):
    result = bound_json(root, decoder_result_binding)
    package_binding = file_binding(root, str(Path(decoder_result_binding["path"]).parent / "experiment.json").replace("\\", "/"))
    package = bound_json(root, package_binding)
    require(package == materialize(root), "decoder package no longer reproduces exact sources")
    require(result["experimentIdentity"] == package["experimentIdentity"]
            and result["status"] == "experiment_executed_not_visual_qualified"
            and result["experimentKind"] == "decoder_only_reconstruction_not_denoiser_training"
            and result["optimizerSteps"] == 1000 and result["checkpointReloadExact"] is True,
            "completed reconstruction result required")
    require(result["encoderStateSha256Before"] == result["encoderStateSha256After"]
            and result["selectedSampleIds"] == SAMPLES and result["denoiserParticipated"] is False,
            "reconstruction scope mismatch")
    require(all(v is False for v in result["qualification"].values()), "no release qualifications allowed")
    policy = bound_json(root, package["policy"])
    source = bound_json(root, package["sourcePackage"])
    source_result = bound_json(root, policy["sourceResult"])
    require(source_result["experimentIdentity"] == source["experimentIdentity"]
            and source_result["optimizerSteps"] == 6000
            and source_result["status"] == "experiment_executed_not_visual_qualified", "completed source Denoiser required")
    receipts = [*package["inputReceipts"], decoder_result_binding, package_binding,
                artifact(result, "experimental-checkpoint.pt"), artifact(source_result, "experimental-checkpoint.pt"),
                file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for b in receipts:
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "conflicting source binding")
        read_bound(root, b)
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    payload = {"schemaVersion": "ai-painter-paired-decoder-comparison-v1", "settings": deepcopy(SETTINGS),
        "decoderResult": decoder_result_binding, "decoderPackage": package_binding,
        "decoderCheckpoint": artifact(result, "experimental-checkpoint.pt"),
        "sourcePackage": package["sourcePackage"], "sourceResult": policy["sourceResult"],
        "sourceCheckpoint": artifact(source_result, "experimental-checkpoint.pt"),
        "foundation": source["foundation"], "sampleIds": SAMPLES, "seed": source["training"]["seed"],
        "inputReceipts": list(unique.values()), "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST),
        "limits": ["Two seen train samples, no generalization or formal qualification.",
            "CPU random noise is not byte-identical to prior GPU noise; only paired CPU arms are controlled comparisons.",
            "Target RGB is read for metrics only, never encoded or supplied to the sampling path.",
            "Final RGB heads are frozen but may react differently to the changed base RGB.",
            "The experimental decoder is not a released replacement foundation."]}
    return {**payload, "comparisonIdentity": "decoder-comparison-" + digest(canonical_bytes(payload))}


def pure_noise_rollout(torch, predict, shape, conditions, alpha, seed, check):
    """No target argument: generation can only consume noise and conditions."""
    from train_ai_assisted_conditional_denoiser import deterministic_velocity_step, inference_timesteps
    require(tuple(shape) == (1, 12, 48, 64), "fixed experiment latent shape required")
    require(tuple(conditions.shape) == (1, 23, 192, 256), "fixed condition shape required")
    require(conditions.device.type == "cpu" and bool(torch.isfinite(conditions).all()), "CPU finite conditions required")
    noise = torch.randn(shape, generator=torch.Generator(device="cpu").manual_seed(seed))
    latent = noise.clone()
    pairs = rollout_grid(torch, inference_timesteps(1000, 50, "cpu"))
    for t, previous in pairs:
        check()
        velocity = predict(latent, torch.tensor([t]), conditions)
        latent = deterministic_velocity_step(latent, velocity, t, previous, alpha)
        require(bool(torch.isfinite(latent).all()), "nonfinite generated latent")
    return noise, latent, pairs


def paired_decode(torch, model, replacement, latent, conditions, config, decode):
    from ai_painter.complete_world.split_training import state_hash
    original = model.autoencoder
    before = state_hash((latent, conditions))
    values = {}
    try:
        for name, ae in (("original", original), ("reconstruction", replacement)):
            model.autoencoder = ae
            values[name] = decode(model, latent, conditions, config,
                return_stage4_semantic_responsibility_evidence=True)
            require(state_hash((latent, conditions)) == before, "decoder mutated shared latent or conditions")
    finally:
        model.autoencoder = original
    left, right = (values[k][1]["responsibilityMasks"] for k in ("original", "reconstruction"))
    require(len(left) == len(right) and all(torch.equal(a, b) for a, b in zip(left, right)), "paired masks changed")
    return values


# A thin bridge to the existing transactional writer, not a second state store.
REGISTRY_BRIDGE = r'''
import fs from "node:fs";import path from "node:path";import {createHash} from "node:crypto";import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from "./src/server/ai-painter-current-execution-registry.mjs";
const [mode,directory,pidText]=process.argv.slice(1),pid=Number(pidText),root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(p)),bind=p=>({path:p,sha256:createHash("sha256").update(fs.readFileSync(p)).digest("hex")});
const write=(p,v)=>{const fd=fs.openSync(p,"wx");try{fs.writeFileSync(fd,JSON.stringify(v,null,2)+"\n");fs.fsyncSync(fd)}finally{fs.closeSync(fd)}};
const plan=read(directory+"/plan.json"),id=plan.comparisonIdentity,previous=await readCurrentExecutionRegistry(root);assert(previous.ok);
let active=null;
if(mode==="begin"){
 assert.equal(previous.registry.activeExecution,null);
 const probe=spawnSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; [pscustomobject]@{identity=([string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o'))}|ConvertTo-Json -Compress`],{encoding:"utf8",windowsHide:true,timeout:10000});assert.equal(probe.status,0);
 const identity={capabilityVersion:id,packageId:id,runId:id,processId:pid,processStartIdentity:JSON.parse(probe.stdout.replace(/^\uFEFF/u,"")).identity};
 write(directory+"/execution-lock.json",{schemaVersion:"ai-painter-current-active-execution-lock-v1",...identity});
 write(directory+"/heartbeat.json",{schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",...identity,executionState:"executing",heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
 active={schemaVersion:"ai-painter-current-active-execution-v1",...identity,executionState:"executing",programLineage:{worker:plan.program},lock:bind(directory+"/execution-lock.json"),heartbeat:{path:directory+"/heartbeat.json",ttlSeconds:120}};
}else{assert.equal(mode,"finish");assert.equal(previous.registry.runId,id);assert.equal(previous.registry.activeExecution?.processId,pid)}
const evidencePath=directory+(mode==="begin"?"/cpu-tests.json":"/result.json"),evidence=read(evidencePath),capsulePath=directory+"/"+mode+"-capsule.json";
write(capsulePath,{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:id,integrity:{status:"verified"},evidence:[bind(directory+"/plan.json"),bind(evidencePath)].map((b,i)=>({...b,kind:"comparison_"+i,sha256Verified:true}))});
const state=mode==="begin"?"executing":evidence.executionState;
const done=await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion:id,packageId:id,taskId:id,runId:id,taskKind:"cpu_paired_decoder_comparison",taskGoal:"Compare two frozen decoders on identical train-only generated latents; no training or publication",queueStatus:mode==="begin"?"running":state,nextMachineAction:null,lifecycleStage:"isolated_implementation",executionState:state,activity:mode==="begin"?"cpu_decoder_comparison_running":"cpu_decoder_comparison_"+state,taskCapsulePath:capsulePath,terminalEvidencePath:evidencePath,activeExecution:active,expectedPreviousRegistryRevision:previous.registry.registryRevision,expectedPreviousRegistrySha256:previous.registrySha256});
assert(done.ok,JSON.stringify(done));console.log(JSON.stringify({revision:done.registry.registryRevision,sha256:done.registrySha256,runId:id,active:done.registry.activeExecution!==null,latestTrainingRunId:done.registry.latestTrainingTerminal.runId}));
'''


def registry(root, mode, directory):
    run = subprocess.run(["node", "--input-type=module", "-e", REGISTRY_BRIDGE, mode, directory, str(os.getpid())],
        cwd=root, capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    require(run.returncode == 0, "registry bridge failed: " + run.stderr[-4000:])
    return json.loads(run.stdout.strip())


def refresh_heartbeat(path):
    value = json.loads(path.read_text(encoding="utf-8"))
    value["heartbeatAtUtc"] = now()
    for attempt in range(6):
        try:
            save_json(path, value, mutable=True)
            return
        except PermissionError:
            if attempt == 5:
                raise
            time.sleep(0.025 * (attempt + 1))


def run(root, binding):
    plan = materialize_plan(root, binding)
    validate_settings(plan["settings"])
    directory = ROOT + "/" + plan["comparisonIdentity"]
    output = project_file(root, directory)
    output.mkdir(parents=True, exist_ok=False)
    save_json(output / "plan.json", plan)
    tests = subprocess.run([os.sys.executable, "-m", "unittest", "discover", "-s", "ml/ai-painter/tests",
        "-p", Path(TEST).name, "-v"], cwd=root, capture_output=True, text=True, timeout=60,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    cpu = {"status": "paired_decoder_cpu_tests_passed" if tests.returncode == 0 else "paired_decoder_cpu_tests_failed",
        "executionState": "completed" if tests.returncode == 0 else "failed_closed", "exitCode": tests.returncode,
        "recordedAtUtc": now(), "program": plan["testProgram"], "stdout": tests.stdout, "stderr": tests.stderr}
    save_json(output / "cpu-tests.json", cpu)
    require(tests.returncode == 0, "paired decoder CPU tests failed: " + tests.stderr[-4000:])
    lease = registry(root, "begin", directory)
    save_json(output / "registry-start.json", lease)
    started = time.perf_counter()
    last_heartbeat = started

    def check():
        nonlocal last_heartbeat
        require(time.perf_counter() - started < SETTINGS["maxWallSeconds"], "paired inference timeout")
        require(not torch.cuda.is_initialized(), "CPU comparison initialized CUDA")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < SETTINGS["maxOutputMiB"] * 2**20, "output budget exceeded")
        if time.perf_counter() - last_heartbeat >= 8:
            refresh_heartbeat(output / "heartbeat.json")
            last_heartbeat = time.perf_counter()

    def progress(phase, **extra):
        value = {"comparisonIdentity": plan["comparisonIdentity"], "recordedAtUtc": now(), "phase": phase,
            "elapsedSeconds": time.perf_counter() - started, "gpuStarted": False, "trainingStarted": False, "optimizerSteps": 0, **extra}
        save_json(output / "progress.json", value, mutable=True)
        print(json.dumps(value), flush=True)

    try:
        import torch
        from ai_painter.complete_world.model import build_complete_world_system
        from ai_painter.complete_world.split_training import state_hash
        from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
        from train_ai_assisted_conditional_denoiser import (
            build_diffusion_schedule, decode_final_visible_rgb, denormalize_latent, save_tensor_png,
        )
        from train_ai_assisted_complete_world import image_edge_loss
        torch.set_num_threads(4)
        check()
        load = lambda b: torch.load(io.BytesIO(read_bound(root, b)), map_location="cpu", weights_only=True)
        source = bound_json(root, plan["sourcePackage"])
        cp = load(plan["sourceCheckpoint"])
        replacement_cp = load(plan["decoderCheckpoint"])
        validate_experiment_checkpoint(cp, source)
        validate_checkpoint(replacement_cp, bound_json(root, plan["decoderPackage"]))
        require(cp["optimizerSteps"] == 6000 and cp["config"] == source["config"], "Denoiser checkpoint/config mismatch")
        model = build_complete_world_system(cp["config"])
        model.autoencoder.load_state_dict(load(plan["foundation"])["autoencoderState"], strict=True)
        model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        replacement = deepcopy(model.autoencoder)
        replacement.load_state_dict(replacement_cp["autoencoderState"], strict=True)
        replacement.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "Denoiser state identity mismatch")
        require(state_dict_sha256(model.autoencoder.state_dict()) == cp["foundationStateSha256"], "foundation state mismatch")
        require(state_dict_sha256(replacement.state_dict()) == replacement_cp["autoencoderStateSha256"], "replacement state mismatch")
        require(state_hash(model.autoencoder.encoder.state_dict()) == state_hash(replacement.encoder.state_dict())
                == replacement_cp["encoderStateSha256"], "encoder/latent definition changed")
        before = state_hash((model.state_dict(), replacement.state_dict()))
        normalization = cp["latentNormalization"]
        require(normalization["sampleCount"] == 2 and bool(torch.isfinite(normalization["standardDeviation"]).all())
                and bool((normalization["standardDeviation"] > 0).all()), "normalization invalid")
        alpha = build_diffusion_schedule(cp["config"], "cpu")["alphasCumulative"]
        dataset = ExperimentDataset(root, source)
        rows = []
        progress("paired_inference_started")
        with torch.inference_mode(), exact_inference_runtime(torch):
            for index in range(2):
                item = dataset[index]
                conditions = item["conditions"][None]
                condition_before = state_hash(conditions)
                noise, latent, grid = pure_noise_rollout(torch, model.predict_velocity, (1, 12, 48, 64), conditions,
                    alpha, plan["seed"] + SETTINGS["seedOffset"] + index, check)
                raw = denormalize_latent(latent, normalization)
                values = paired_decode(torch, model, replacement, raw, conditions, cp["config"], decode_final_visible_rgb)
                require(state_hash(conditions) == condition_before, "sampling mutated conditions")
                target = item["image"][None]  # First use of target: after generation and paired decoding.
                measured = {}
                for name, (final, evidence) in values.items():
                    measured[name] = decomposition_metrics(torch, final, evidence, target)
                    measured[name]["base"]["edgeMae"] = float(image_edge_loss(evidence["baseDecodedRgb"], target))
                    measured[name]["final"]["edgeMae"] = float(image_edge_loss(final, target))
                    measured[name]["semanticRegions"] = {}
                    for channel in ("terrain_path_ground", "object_tree", "object_rock", "object_vegetation"):
                        channel_index = cp["config"]["conditionChannelOrder"].index(channel)
                        mask = conditions[:, channel_index:channel_index + 1]
                        weight = float(mask.sum())
                        measured[name]["semanticRegions"][channel] = {"pixelWeight": weight,
                            "rgbMae": float(((final - target).abs() * mask).sum() / (3 * weight)) if weight else None}
                    save_tensor_png(evidence["baseDecodedRgb"][0], output / f"{name}-base-{index}.png")
                    save_tensor_png(final[0], output / f"{name}-final-{index}.png")
                save_tensor_png(target[0], output / f"target-{index}.png")
                with (output / f"sampling-tensors-{index}.pt").open("xb") as stream:
                    torch.save({"schemaVersion": "ai-painter-paired-inference-tensors-v1", "comparisonIdentity": plan["comparisonIdentity"],
                        "sampleId": item["sampleId"], "seed": plan["seed"] + SETTINGS["seedOffset"] + index,
                        "noise": noise, "normalizedGeneratedLatent": latent, "denormalizedGeneratedLatent": raw,
                        "conditionStateSha256": condition_before, "targetUsedForInitialization": False}, stream)
                    stream.flush()
                    os.fsync(stream.fileno())
                rows.append({"sampleId": item["sampleId"], "split": "train", "seed": plan["seed"] + SETTINGS["seedOffset"] + index,
                    "targetUsedForInitialization": False, "targetEncoded": False, "inferenceSteps": len(grid),
                    "noiseStateSha256": state_hash(noise), "generatedLatentStateSha256": state_hash(raw),
                    "conditionStateSha256": condition_before, "pairedInputTensorsIdentical": True, "measurements": measured})
                progress("sample_completed", sampleIndex=index)
        check()
        require(state_hash((model.state_dict(), replacement.state_dict())) == before, "comparison changed model weights")
        require(all(not p.requires_grad and p.grad is None for p in list(model.parameters()) + list(replacement.parameters())), "trainable parameters or gradients in comparison")
        for b in plan["inputReceipts"]:
            read_bound(root, b)
        result = {"schemaVersion": "ai-painter-paired-decoder-comparison-result-v1", "comparisonIdentity": plan["comparisonIdentity"],
            "runId": plan["comparisonIdentity"], "status": "cpu_paired_decoder_comparison_completed_not_visual_qualified",
            "executionState": "completed", "recordedAtUtc": now(), "gpuStarted": False, "trainingStarted": False,
            "optimizerSteps": 0, "modelStatesUnchanged": True, "modelStateSha256BeforeAndAfter": before,
            "encoderStatesIdentical": True, "generatedFromPureNoise": True, "targetEncoded": False,
            "rows": rows, "limits": plan["limits"], "formalQualificationAllowed": False,
            "elapsedSeconds": time.perf_counter() - started, "plan": file_binding(root, directory + "/plan.json"),
            "artifacts": [file_binding(root, directory + "/" + p.name) for p in output.iterdir() if p.suffix in (".png", ".pt")]}
    except Exception as error:
        result = {"status": "cpu_paired_decoder_comparison_failed_closed", "executionState": "failed_closed",
            "runId": plan["comparisonIdentity"], "comparisonIdentity": plan["comparisonIdentity"], "recordedAtUtc": now(),
            "error": str(error), "traceback": traceback.format_exc(), "gpuStarted": False, "trainingStarted": False,
            "optimizerSteps": 0, "formalQualificationAllowed": False}
    save_json(output / "result.json", result)
    # A comparison is not a training terminal: the existing latest training pointer is preserved.
    refresh_heartbeat(output / "heartbeat.json")
    save_json(output / "registry-finish.json", registry(root, "finish", directory))
    progress(result["executionState"])
    print(json.dumps(file_binding(root, directory + "/result.json")), flush=True)
    require(result["executionState"] == "completed", "paired comparison failed: " + result.get("error", "unknown"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--decoder-result", required=True)
    parser.add_argument("--decoder-sha256", required=True)
    args = parser.parse_args()
    run(Path.cwd(), {"path": args.decoder_result, "sha256": args.decoder_sha256})

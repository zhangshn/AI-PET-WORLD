"""Isolated decoder-only reconstruction experiment, not a released foundation.

Uses the existing experiment controller and train-step boundary. The encoder,
original assets, Denoiser experiments and all formal qualifications stay intact.
Reconstruction consumes target RGB; no output here is a generated Candidate.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import io
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import time
import traceback

from painter_learning_capacity_experiment import (
    ExperimentDataset, bound_json, canonical_bytes, digest, exact_inference_runtime,
    file_binding, now, project_file, read_bound, require, save_json, selected_rows,
    verify_controller_process,
)

POLICY = "data/ai-painter/system-governance/ai-painter-decoder-reconstruction-experiment-policy-v1.json"
SCHEMA = "ai-painter-decoder-reconstruction-experiment-package-v1"
CHECKPOINT_SCHEMA = "ai-painter-decoder-reconstruction-experiment-checkpoint-v1"
CONTROLLER = "scripts/run-ai-painter-learning-capacity-experiment.mjs"
WORKER = "ml/ai-painter/scripts/painter_decoder_reconstruction_experiment.py"
TEST = "ml/ai-painter/tests/test_decoder_reconstruction_experiment.py"
SAMPLES = ["ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
           "ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v4"]
TRAINING = {"epochs": 500, "batchSize": 1, "seed": 20260908, "optimizer": "AdamW",
    "learningRate": 0.0002, "weightDecay": 0.01, "observationSteps": [0, 100, 400, 1000],
    "checkpointRule": "final_step_only_no_selection", "updateScope": "autoencoder.decoder_only",
    "encoderFrozen": True, "denoiserParticipates": False, "lossVersion": "pixel_edge_laplacian_v2",
    "lossWeights": {"pixel": 1.0, "edge": 0.75, "laplacian": 0.25}}
RESOURCES = {"maxWallSeconds": 600, "cudaMemoryFraction": 0.7, "minimumFreeVramMiB": 2048,
    "maximumTemperatureC": 85, "minimumFreeDiskMiB": 2048, "maxOutputMiB": 128,
    "cpuThreads": 4, "automaticRetries": 0}
QUALIFICATIONS = ("formalDatasetQualified", "formalGpuQualified", "formalSmokePassed",
    "formalTrainingAllowed", "checkpointPromotable", "formalInferenceEligible", "runtimeFrameAllowed",
    "worldEntryAllowed", "usableAsReleasedFoundation")
PROHIBITED = ("nonTrainContent", "sourceOverwrite", "encoderUpdate", "denoiserUpdate",
    "modelArchitectureChange", "lossChange", "formalThresholdChange", "automaticRetry", "worldPublication", "shutdown")
PROGRAMS = (WORKER, TEST, CONTROLLER, "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
    "ml/ai-painter/scripts/painter_learning_capacity_experiment.py",
    "ml/ai-painter/scripts/diagnose_learning_capacity_timesteps.py",
    "ml/ai-painter/scripts/diagnose_learning_capacity_noise.py",
    "ml/ai-painter/scripts/train_ai_assisted_complete_world.py",
    "ml/ai-painter/src/ai_painter/complete_world/model.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "src/server/ai-painter-current-execution-registry.mjs")


def validate_policy(policy):
    require(policy["schemaVersion"] == "ai-painter-decoder-reconstruction-experiment-policy-v1", "policy schema mismatch")
    require(policy["scope"] == "train_only_decoder_reconstruction_no_generation_or_generalization_claim", "scope mismatch")
    require(policy["resolution"] == [256, 192] and policy["sampleIds"] == SAMPLES, "sample/resolution scope changed")
    require(policy["training"] == TRAINING, "decoder experiment training boundary changed")
    require(policy["resources"] == RESOURCES, "decoder experiment resources changed")
    require(policy["qualification"] == dict.fromkeys(QUALIFICATIONS, False), "formal qualification forbidden")
    require(policy["prohibited"] == dict.fromkeys(PROHIBITED, True), "prohibited behavior changed")
    require(policy["outputRoot"] == ".runtime/ai-painter/learning-capacity-experiments", "output root changed")


def historical_inputs(root, source_package, snapshot):
    """Only the versioned controller may resolve to its exact archived bytes.

    Data, model, reader, Loss and every other dependency still use their original
    explicit bindings; this is not a generic missing-file/hash fallback.
    """
    require(snapshot["originalPath"] == CONTROLLER, "only controller snapshot permitted")
    matches = [r for r in source_package["inputReceipts"] if r["path"] == CONTROLLER]
    require(len(matches) == 1 and matches[0]["sha256"] == snapshot["sha256"], "snapshot identity mismatch")
    expected = f".runtime/ai-painter/learning-capacity-experiments/source-snapshots/{snapshot['sha256']}/run-ai-painter-learning-capacity-experiment.mjs"
    require(snapshot["path"] == expected, "snapshot namespace mismatch")
    receipts = []
    for receipt in source_package["inputReceipts"]:
        binding = {k: snapshot[k] for k in ("path", "sha256")} if receipt["path"] == CONTROLLER else receipt
        read_bound(root, binding)
        receipts.append(binding)
    return receipts


def materialize(root, policy_path=POLICY):
    require(policy_path == POLICY, "unregistered decoder policy")
    policy_binding = file_binding(root, policy_path)
    policy = bound_json(root, policy_binding)
    validate_policy(policy)
    source = bound_json(root, policy["sourcePackage"])
    result = bound_json(root, policy["sourceResult"])
    diagnosis = bound_json(root, policy["diagnosis"])
    payload = {k: v for k, v in source.items() if k != "experimentIdentity"}
    require(source["experimentIdentity"] == "painter-learning-capacity-" + digest(canonical_bytes(payload)), "source identity mismatch")
    require(result["experimentIdentity"] == source["experimentIdentity"] and result["optimizerSteps"] == 6000
            and result["status"] == "experiment_executed_not_visual_qualified", "source must be completed 6000-step experiment")
    require(result["selectedSampleIds"] == SAMPLES and source["resolution"] == [256, 192], "source sample scope mismatch")
    require(diagnosis["status"] == "cpu_timestep_diagnosis_completed_not_visual_qualified"
            and diagnosis["profile"] == "residual-6000" and diagnosis["sourceResult"] == policy["sourceResult"]
            and diagnosis["sourcePackage"] == policy["sourcePackage"], "diagnosis/source mismatch")
    rows = selected_rows({"samples": source["selectedRows"]}, SAMPLES)
    receipts = historical_inputs(root, source, policy["historicalControllerSnapshot"])
    config = bound_json(root, policy["reconstructionConfig"])
    require(config["autoencoderArchitecture"] == "residual_4x_latent_pixel_detail_v2"
            and config["baseChannels"] == 48 and config["latentChannels"] == 12
            and config["latentDownsampleFactor"] == 4, "foundation architecture changed")
    require(config["training"]["autoencoderLearningRate"] == TRAINING["learningRate"]
            and config["training"]["autoencoderLossWeights"] == TRAINING["lossWeights"]
            and config["training"]["autoencoderLossVersion"] == TRAINING["lossVersion"], "original reconstruction objective changed")
    receipts.extend([policy_binding, policy["sourcePackage"], policy["sourceResult"], policy["diagnosis"], policy["reconstructionConfig"]])
    programs = [file_binding(root, p) for p in PROGRAMS]
    receipts.extend(programs)
    unique = {}
    for b in receipts:
        require(b["path"] not in unique or unique[b["path"]]["sha256"] == b["sha256"], "input identity conflict")
        read_bound(root, b)
        unique[b["path"]] = {k: b[k] for k in ("path", "sha256")}
    package = {"schemaVersion": SCHEMA, "policy": policy_binding, "sourcePackage": policy["sourcePackage"],
        "sourceDatasetIdentity": source["sourceDatasetIdentity"], "selectedRows": rows,
        "inputIdentity": source["inputIdentity"], "foundation": source["foundation"],
        "foundationLimitations": source["foundationLimitations"], "config": config,
        "training": deepcopy(TRAINING), "resources": deepcopy(RESOURCES), "resolution": [256, 192],
        "qualification": policy["qualification"], "programBindings": programs, "inputReceipts": list(unique.values()),
        "historicalControllerSnapshot": policy["historicalControllerSnapshot"], "purpose": policy["scope"]}
    return {**package, "experimentIdentity": "painter-ae-reconstruction-" + digest(canonical_bytes(package))}


def prepare(root, policy_path=POLICY):
    package = materialize(root, policy_path)
    relative = ".runtime/ai-painter/learning-capacity-experiments/" + package["experimentIdentity"] + "/experiment.json"
    target = project_file(root, relative)
    if target.exists():
        require(target.read_bytes() == canonical_bytes(package) + b"\n", "immutable package conflict")
    else:
        save_json(target, package)
    return file_binding(root, relative)


class ReconstructionDataset(ExperimentDataset):
    def __init__(self, root, package):
        super().__init__(root, bound_json(root, package["sourcePackage"]))
        require(self._rows == package["selectedRows"], "reconstruction dataset selection mismatch")
        self.manifest = {"datasetReleaseIdentity": package["experimentIdentity"], "identityPayload": package["inputIdentity"]}
        self._cache = {}

    def __getitem__(self, index):
        if index not in self._cache:
            self._cache[index] = super().__getitem__(index)
        return self._cache[index]


def decoder_parameters(autoencoder):
    autoencoder.requires_grad_(False).eval()
    autoencoder.decoder.requires_grad_(True).train()
    parameters = list(autoencoder.decoder.parameters())
    require(parameters and {id(p) for p in parameters} == {id(p) for p in autoencoder.parameters() if p.requires_grad},
            "optimizer must contain only the decoder")
    return parameters


def validate_checkpoint(checkpoint, package):
    require(checkpoint.get("schemaVersion") == CHECKPOINT_SCHEMA
            and checkpoint.get("experimentIdentity") == package["experimentIdentity"], "checkpoint identity mismatch")
    require(checkpoint.get("optimizerSteps") == 1000 and checkpoint.get("selectedSampleIds") == SAMPLES,
            "checkpoint budget/selection mismatch")
    require(checkpoint.get("encoderFrozen") is True and checkpoint.get("updateScope") == "autoencoder.decoder_only",
            "checkpoint update scope mismatch")
    require(all(checkpoint.get(k) is False for k in ("checkpointPromotable", "formalInferenceEligible", "usableAsReleasedFoundation")),
            "checkpoint cannot become a released foundation")
    require("denoiserState" not in checkpoint and "optimizerState" not in checkpoint, "forbidden checkpoint state")
    require(checkpoint.get("foundation") == package["foundation"] and checkpoint.get("config") == package["config"],
            "checkpoint foundation/config mismatch")


def execute(root, binding):
    package = bound_json(root, binding)
    require(package == materialize(root), "decoder package no longer reproduces exact inputs")
    expected = prepare(root)
    require(binding == expected, "decoder package namespace/hash mismatch")
    output = project_file(root, binding["path"]).parent
    lease = json.loads((output / "controller-lease.json").read_text(encoding="utf-8"))
    registry_bytes = project_file(root, ".runtime/ai-painter/current-execution-registry/current.json").read_bytes()
    require(digest(registry_bytes) == lease["registrySha256"], "controller registry lease is stale")
    verify_controller_process(lease, json.loads(registry_bytes), os.getppid())
    require(lease["experimentIdentity"] == package["experimentIdentity"], "controller experiment mismatch")
    require(not (output / "worker-started.json").exists(), "no decoder experiment restart")
    save_json(output / "worker-started.json", {"startedAtUtc": now(), "processId": os.getpid(), "package": binding})
    return train_bounded(root, package, output)


def train_bounded(root, package, output):
    import torch
    from torch.utils.data import DataLoader
    from ai_painter.complete_world.model import build_complete_world_system
    from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
    from diagnose_learning_capacity_timesteps import rgb_diagnostics
    from train_ai_assisted_complete_world import reconstruction_loss, image_edge_loss, set_seed
    from train_ai_assisted_conditional_denoiser import save_tensor_png

    started = time.perf_counter()
    gpu_started, training_started, steps = False, False, 0
    budget = package["resources"]

    def progress(phase, **details):
        value = {"experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(),
            "phase": phase, "optimizerSteps": steps, "elapsedSeconds": time.perf_counter() - started,
            "gpuStarted": gpu_started, "trainingStarted": training_started, **details}
        save_json(output / "progress.json", value, mutable=True)
        print(json.dumps(value), flush=True)

    def limits(check_temperature=False):
        require(time.perf_counter() - started < budget["maxWallSeconds"], "decoder experiment timeout")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) < budget["maxOutputMiB"] * 2**20,
                "decoder experiment output budget exceeded")
        require(shutil.disk_usage(output).free >= budget["minimumFreeDiskMiB"] * 2**20, "insufficient disk space")
        if check_temperature:
            query = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(query.returncode == 0 and int(query.stdout.strip().splitlines()[0]) < budget["maximumTemperatureC"],
                    "GPU temperature unavailable or above limit")

    try:
        torch.set_num_threads(budget["cpuThreads"])
        set_seed(TRAINING["seed"])
        dataset = ReconstructionDataset(root, package)
        for index in range(2):
            item = dataset[index]
            require(tuple(item["image"].shape) == (3, 192, 256) and bool(torch.isfinite(item["image"]).all()),
                    "invalid reconstruction input tensor")
        limits()
        require(torch.cuda.is_available(), "real CUDA unavailable")
        free, total = torch.cuda.mem_get_info()
        require(free >= budget["minimumFreeVramMiB"] * 2**20, "insufficient free VRAM")
        torch.cuda.set_per_process_memory_fraction(budget["cudaMemoryFraction"])
        torch.cuda.reset_peak_memory_stats()
        device = torch.device("cuda")
        gpu_started = True
        config = package["config"]
        # Use only the project Autoencoder; the factory's random Denoiser is discarded.
        ae = build_complete_world_system(config).autoencoder.to(device)
        original = torch.load(io.BytesIO(read_bound(root, package["foundation"])), map_location="cpu", weights_only=True)
        require(original.get("schemaVersion") == config["requiredCheckpointProvenance"]
                and original.get("ownership") == config["ownership"] and original.get("trainingLane") == "ai_assisted_cold_start",
                "foundation provenance mismatch")
        require(original.get("modelId") == config["modelId"] and original.get("architectureVersion") == config["architectureVersion"]
                and original.get("denoiserTrained") is False and original.get("trainingStage") == "autoencoder_warmup_only"
                and original.get("thirdPartyWeightsLoaded") is False and original.get("upstreamModelIds") == [], "foundation role mismatch")
        ae.load_state_dict(original["autoencoderState"], strict=True)
        del original
        initial_ae = state_dict_sha256(ae.state_dict())
        require(initial_ae == "b19ea785be33b9911832b1a12fe618e59c5cb37a27c48c903d9b015b0759b216", "foundation state identity mismatch")
        parameters = decoder_parameters(ae)
        encoder_before = state_hash(ae.encoder.state_dict())
        decoder_before = state_hash(ae.decoder.state_dict())
        parameter_names = [name for name, p in ae.named_parameters() if p.requires_grad]
        require(parameter_names and all(n.startswith("decoder.") for n in parameter_names), "non-decoder trainable parameter")
        targets = [dataset[i]["image"][None].to(device) for i in range(2)]
        with torch.no_grad(), exact_inference_runtime(torch):
            fixed_latents = [ae.encode(target).detach() for target in targets]
        require(all(not latent.requires_grad for latent in fixed_latents), "encoder latent must be detached")
        progress("readonly_gpu_probe")
        limits(True)
        probe = reconstruction_loss(ae.decode(fixed_latents[0]), targets[0], TRAINING["lossWeights"])
        require(bool(torch.isfinite(probe)), "nonfinite reconstruction probe")
        probe.backward()
        gradients = [p.grad for p in parameters if p.grad is not None]
        require(gradients and all(bool(torch.isfinite(g).all()) for g in gradients)
                and any(bool(g.abs().sum() > 0) for g in gradients), "invalid decoder probe gradient")
        require(all(p.grad is None for p in ae.encoder.parameters()), "encoder probe gradient forbidden")
        require(state_hash(ae.encoder.state_dict()) == encoder_before and state_hash(ae.decoder.state_dict()) == decoder_before,
                "no-update probe changed model state")
        save_json(output / "gpu-probe.json", {"status": "decoder_no_update_gpu_probe_passed", "optimizerCreated": False,
            "weightsChanged": False, "encoderGradientCount": 0, "decoderGradientParameterCount": len(gradients),
            "device": torch.cuda.get_device_name(), "torch": torch.__version__, "cuda": torch.version.cuda,
            "totalVramBytes": total, "formalGpuQualificationGranted": False})
        ae.zero_grad(set_to_none=True)
        del probe, gradients
        observations = []

        def observe(step):
            rows = []
            with torch.no_grad(), exact_inference_runtime(torch):
                for index, (latent, target) in enumerate(zip(fixed_latents, targets)):
                    rgb = ae.decode(latent)
                    metrics = rgb_diagnostics(torch, rgb, target)
                    metrics["edgeMae"] = float(image_edge_loss(rgb, target))
                    metrics["reconstructionLoss"] = float(reconstruction_loss(rgb, target, TRAINING["lossWeights"]))
                    order = package["inputIdentity"]["channelOrder"]
                    conditions = dataset[index]["conditions"][None].to(device)
                    regions = {}
                    for name in ("terrain_grass", "terrain_path_ground", "object_tree", "object_rock", "object_vegetation"):
                        mask = conditions[:, order.index(name):order.index(name) + 1]
                        count = float(mask.sum())
                        regions[name] = {"pixelWeight": count,
                            "rgbMae": float(((rgb - target).abs() * mask).sum() / (3 * count)) if count else None}
                    rows.append({"sampleId": SAMPLES[index], "split": "train", "metrics": metrics, "regions": regions})
                    save_tensor_png(rgb[0], output / f"step-{step}-{index}.png")
                    if step == 0:
                        save_tensor_png(target[0], output / f"target-{index}.png")
            record = {"optimizerSteps": step, "recordedAtUtc": now(), "rows": rows,
                "checkpointSelected": False, "formalVisualQualification": False, "targetRgbConsumed": True}
            save_json(output / f"observation-step-{step}.json", record)
            observations.append(record)
            progress("fixed_train_reconstruction_observation_completed", observedStep=step)

        observe(0)
        optimizer = torch.optim.AdamW(parameters, lr=TRAINING["learningRate"], weight_decay=TRAINING["weightDecay"])
        loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
        losses = []
        training_clock = time.perf_counter()
        with TrainSplitBoundary(ae, optimizer, dataset) as boundary:
            for epoch in range(TRAINING["epochs"]):
                for batch in boundary.wrap_loader(loader):
                    limits(steps % 20 == 0)
                    index = SAMPLES.index(batch["sampleId"][0])
                    training_started = True
                    optimizer.zero_grad(set_to_none=True)
                    loss = reconstruction_loss(ae.decode(fixed_latents[index]), targets[index], TRAINING["lossWeights"])
                    require(bool(torch.isfinite(loss)), "nonfinite decoder training loss")
                    loss.backward()
                    require(all(p.grad is None or bool(torch.isfinite(p.grad).all()) for p in parameters), "nonfinite decoder gradient")
                    require(all(p.grad is None for p in ae.encoder.parameters()), "encoder gradient during decoder training")
                    optimizer.step()
                    steps += 1
                    losses.append(float(loss.detach()))
                if steps % 20 == 0:
                    progress("training", epoch=epoch + 1, lastLoss=losses[-1])
                if steps in TRAINING["observationSteps"]:
                    with boundary.evaluation():
                        observe(steps)
            step_evidence = boundary.evidence()
        training_seconds = time.perf_counter() - training_clock
        del boundary, loss
        require(steps == step_evidence["optimizerSteps"] == 1000, "decoder step ledger mismatch")
        require([o["optimizerSteps"] for o in observations] == TRAINING["observationSteps"], "missing fixed observation")
        require(state_hash(ae.encoder.state_dict()) == encoder_before, "frozen encoder changed")
        require(state_hash(ae.decoder.state_dict()) != decoder_before, "decoder never updated")
        return finish_training(root, package, output, ae, optimizer, parameters, fixed_latents, targets,
            initial_ae, encoder_before, decoder_before, parameter_names, observations, losses, step_evidence,
            training_seconds, started, progress, limits)
    except Exception as error:
        result = {"status": "experiment_failed_closed", "executionState": "failed_closed",
            "experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(), "gpuStarted": gpu_started,
            "trainingStarted": training_started, "optimizerSteps": steps, "elapsedSeconds": time.perf_counter() - started,
            "error": str(error), "traceback": traceback.format_exc(), "qualification": package["qualification"]}
        save_json(output / "result.json", result)
        print(json.dumps(result), flush=True)
        return 1


def finish_training(root, package, output, ae, optimizer, parameters, fixed_latents, targets,
        initial_ae, encoder_before, decoder_before, parameter_names, observations, losses, step_evidence,
        training_seconds, started, progress, limits):
    import torch
    from ai_painter.complete_world.model import build_complete_world_system
    from ai_painter.complete_world.split_training import state_hash
    from ai_painter_stage4_semantic_transport_v2_trainer_support import state_dict_sha256
    from train_ai_assisted_conditional_denoiser import save_tensor_png

    limits(True)
    final_ae = state_dict_sha256(ae.state_dict())
    final_decoder = state_hash(ae.decoder.state_dict())
    checkpoint = {"schemaVersion": CHECKPOINT_SCHEMA, "experimentIdentity": package["experimentIdentity"],
        "checkpointPromotable": False, "formalInferenceEligible": False, "usableAsReleasedFoundation": False,
        "trainingLane": "ai_assisted_cold_start", "updateScope": "autoencoder.decoder_only", "encoderFrozen": True,
        "optimizerSteps": 1000, "selectedSampleIds": SAMPLES, "foundation": package["foundation"],
        "config": package["config"], "encoderStateSha256": encoder_before,
        "autoencoderStateSha256": final_ae, "autoencoderState": {k: v.detach().cpu() for k, v in ae.state_dict().items()}}
    validate_checkpoint(checkpoint, package)
    checkpoint_path = output / "experimental-checkpoint.pt"
    with checkpoint_path.open("xb") as stream:
        torch.save(checkpoint, stream)
        stream.flush()
        os.fsync(stream.fileno())
    progress("checkpoint_reload_verification")
    with torch.no_grad(), exact_inference_runtime(torch):
        before_reload = [ae.decode(latent).detach() for latent in fixed_latents]
    loaded = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    validate_checkpoint(loaded, package)
    reloaded_ae = build_complete_world_system(package["config"]).autoencoder.to(targets[0].device)
    reloaded_ae.load_state_dict(loaded["autoencoderState"], strict=True)
    reloaded_ae.eval().requires_grad_(False)
    require(state_dict_sha256(reloaded_ae.state_dict()) == final_ae, "reloaded Autoencoder state mismatch")
    require(state_hash(reloaded_ae.encoder.state_dict()) == encoder_before, "reloaded encoder state mismatch")
    with torch.no_grad(), exact_inference_runtime(torch):
        for index, target in enumerate(targets):
            latent = reloaded_ae.encode(target)
            require(torch.equal(latent, fixed_latents[index]), "encoder no longer reproduces original latent")
            rgb = reloaded_ae.decode(latent)
            require(torch.equal(rgb, before_reload[index]), "fresh-model checkpoint reload output differs")
            save_tensor_png(rgb[0], output / f"after-{index}.png")
            require(digest((output / f"after-{index}.png").read_bytes()) == digest((output / f"step-1000-{index}.png").read_bytes()),
                    "reloaded output differs from final observation")
    for b in package["inputReceipts"]:
        read_bound(root, b)
    limits()
    artifacts = [file_binding(root, str(p.relative_to(root)).replace("\\", "/")) for p in output.iterdir()
        if p.is_file() and (p.suffix == ".png" or p.name.startswith("observation-step-")
                           or p.name in {"experimental-checkpoint.pt", "gpu-probe.json"})]
    result = {"status": "experiment_executed_not_visual_qualified", "executionState": "completed",
        "experimentKind": "decoder_only_reconstruction_not_denoiser_training",
        "experimentIdentity": package["experimentIdentity"], "recordedAtUtc": now(),
        "gpuStarted": True, "trainingStarted": True, "optimizerSteps": 1000, "selectedSampleIds": SAMPLES,
        "targetRgbConsumed": True, "denoiserParticipated": False, "encoderFrozen": True,
        "encoderStateSha256Before": encoder_before, "encoderStateSha256After": state_hash(ae.encoder.state_dict()),
        "decoderStateSha256Before": decoder_before, "decoderStateSha256After": final_decoder,
        "autoencoderStateSha256Before": initial_ae, "autoencoderStateSha256After": final_ae,
        "trainableParameterNames": parameter_names, "frozenEncoderLatentsReproduced": True,
        "stepEvidence": step_evidence, "perStepReconstructionLoss": losses,
        "fixedTrainOnlyObservations": observations, "checkpointReloadExact": True,
        "checkpointReloadMaxAbsoluteDifference": 0, "trainingSecondsIncludingObservations": training_seconds,
        "elapsedSeconds": time.perf_counter() - started, "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
        "peakReservedBytes": torch.cuda.max_memory_reserved(), "qualification": package["qualification"],
        "foundationLimitations": package["foundationLimitations"], "artifacts": artifacts,
        "interpretationLimits": ["Reconstruction consumes the target, not a generative Candidate.",
            "Only two seen train images; no independent quality or generalization claim.",
            "A changed decoder is not automatically compatible with or released to the existing Denoiser/Runtime."]}
    save_json(output / "result.json", result)
    progress("completed", resultStatus=result["status"])
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "run"))
    parser.add_argument("--policy", choices=(POLICY,), default=POLICY)
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.mode == "prepare":
        print(json.dumps(prepare(Path.cwd(), args.policy)))
        return 0
    require(args.package and args.sha256, "exact decoder package binding required")
    return execute(Path.cwd(), {"path": args.package, "sha256": args.sha256})


if __name__ == "__main__":
    raise SystemExit(main())

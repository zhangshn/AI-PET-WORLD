from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import random
import sys
import time

import numpy as np
import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.isolated_foundation import (
    _loss,
    prepare_isolated_foundation_data,
    run_isolated_foundation_epoch,
)
from ai_painter.complete_world.split_release import SplitReleaseDataset
from ai_painter.complete_world.split_training import state_hash


QUALIFY_SCHEMA = "ai-painter-stage4-mvp-fresh-foundation-gpu-request-v1"
TRAIN_SCHEMA = "ai-painter-stage4-mvp-fresh-foundation-training-request-v1"
QUALIFICATION_SCHEMA = "ai-painter-stage4-mvp-fresh-foundation-gpu-qualification-v1"
TRAINING_SCHEMA = "ai-painter-stage4-mvp-fresh-foundation-training-terminal-v1"


def require(value, message):
    if not value:
        raise ValueError(message)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def project_file(root: Path, logical: str) -> Path:
    require(isinstance(logical, str) and logical and "\\" not in logical
            and not PureWindowsPath(logical).drive and not PurePosixPath(logical).is_absolute()
            and all(part not in {"", ".", "..", "latest", "latest.json"}
                    for part in logical.split("/")), "invalid project path")
    candidate = root.joinpath(*logical.split("/"))
    allowed = (root / ".runtime").resolve() if logical.startswith(".runtime/") else root.resolve()
    require(candidate.resolve().is_relative_to(allowed), "path escapes declared storage root")
    return candidate


def read_bound(root: Path, binding: dict) -> tuple[bytes, Path]:
    require(isinstance(binding, dict) and set(binding) == {"path", "sha256"}, "invalid file binding")
    target = project_file(root, binding["path"])
    data = target.read_bytes()
    require(sha256_bytes(data) == binding["sha256"], "bound file changed: " + binding["path"])
    return data, target


def read_json_bound(root: Path, binding: dict) -> tuple[dict, Path]:
    data, target = read_bound(root, binding)
    value = json.loads(data)
    require(isinstance(value, dict), "bound JSON is not an object")
    return value, target


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(path.name + ".staged")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def fresh_autoencoder(config: dict, seed: int):
    set_seed(seed)
    system = build_complete_world_system(config)
    autoencoder = system.autoencoder
    del system
    autoencoder.requires_grad_(True)
    autoencoder.train()
    return autoencoder


def validate_common(root: Path, request: dict, schema: str):
    require(request.get("schemaVersion") == schema, "request schema mismatch")
    require(request.get("freshRandomInitializationOnly") is True, "fresh initialization not required")
    require(request.get("resolution") == {"width": 256, "height": 192}, "resolution changed")
    require(request.get("permittedSplits") == ["train", "validation"], "split boundary changed")
    require(request.get("forbiddenSplits") == ["challenge", "regression"], "held-out boundary changed")
    require(request.get("denoiserTrainingAllowed") is False, "Denoiser must remain blocked")
    require(request.get("checkpointLoadAllowed") is False, "checkpoint loading must remain blocked")
    require(isinstance(request.get("runId"), str) and request["runId"], "run identity missing")
    for binding in request.get("programBindings", []):
        read_bound(root, binding)
    config, _ = read_json_bound(root, request["config"])
    dataset, _ = read_json_bound(root, request["datasetManifest"])
    require(config.get("initialization") == "random_initialization_only", "config initialization changed")
    require(config.get("thirdPartyWeightsAllowed") is False, "third-party weights are allowed")
    require(config.get("autoencoderArchitecture") == "residual_4x_latent_pixel_detail_v2",
            "foundation architecture changed")
    qualification = dataset.get("qualification", {})
    require(qualification.get("foundationTrainingAllowed") is True
            and qualification.get("foundationTrainingRole") == "fresh_foundation_autoencoder_only",
            "dataset does not permit fresh foundation training")
    require(qualification.get("denoiserTrainingAllowed") is False
            and qualification.get("trainingAllowed") is False,
            "dataset overclaims general training")
    budget = request.get("resourceBudget", {})
    require(budget.get("maxGpuMemoryFraction") == 0.70, "GPU memory budget changed")
    require(budget.get("maxEpochs") == 20 and budget.get("maxOptimizerSteps") == 960,
            "training bound changed")
    return config, dataset, budget


def datasets(root: Path, request: dict):
    binding = request["datasetManifest"]
    return (
        SplitReleaseDataset(root, binding, "train", (256, 192)),
        SplitReleaseDataset(root, binding, "validation", (256, 192)),
    )


def gpu_qualify(root: Path, request: dict) -> dict:
    config, dataset_manifest, budget = validate_common(root, request, QUALIFY_SCHEMA)
    require(torch.cuda.is_available(), "CUDA is unavailable")
    train_dataset, validation_dataset = datasets(root, request)
    prepared = prepare_isolated_foundation_data(
        train_dataset=train_dataset, validation_dataset=validation_dataset)
    seed = int(config["training"]["seed"])
    autoencoder = fresh_autoencoder(config, seed)
    initial_state = state_hash(autoencoder.state_dict())
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    free_before, total_memory = torch.cuda.mem_get_info()
    device = torch.device("cuda")
    autoencoder.to(device)
    image = prepared.train_images[0].to(device)
    reconstruction = autoencoder.decode(autoencoder.encode(image))
    loss = _loss(reconstruction, image, config["training"]["autoencoderLossWeights"])
    require(torch.isfinite(loss).item(), "GPU qualification loss is nonfinite")
    loss.backward()
    require(all(parameter.grad is None or torch.isfinite(parameter.grad).all().item()
                for parameter in autoencoder.parameters()), "GPU qualification gradient is nonfinite")
    peak_allocated = int(torch.cuda.max_memory_allocated())
    peak_reserved = int(torch.cuda.max_memory_reserved())
    state_after = state_hash(autoencoder.state_dict())
    require(state_after == initial_state, "GPU qualification changed model weights")
    require(peak_reserved / total_memory <= float(budget["maxGpuMemoryFraction"]),
            "GPU qualification exceeded memory budget")
    result = {
        "schemaVersion": QUALIFICATION_SCHEMA,
        "status": "passed_no_optimizer_step",
        "runId": request["runId"],
        "datasetManifest": request["datasetManifest"],
        "datasetReleaseIdentity": dataset_manifest["datasetReleaseIdentity"],
        "config": request["config"],
        "device": torch.cuda.get_device_name(0),
        "cudaDeviceIndex": 0,
        "inputShape": list(image.shape),
        "latentShape": list(autoencoder.encode(image).shape),
        "lossFinite": True,
        "gradientsFinite": True,
        "optimizerCreated": False,
        "optimizerSteps": 0,
        "modelStateSha256Before": initial_state,
        "modelStateSha256After": state_after,
        "modelStateUnchanged": True,
        "peakAllocatedBytes": peak_allocated,
        "peakReservedBytes": peak_reserved,
        "totalGpuMemoryBytes": int(total_memory),
        "freeGpuMemoryBytesBefore": int(free_before),
        "peakReservedFraction": peak_reserved / total_memory,
        "challengeRead": False,
        "regressionRead": False,
        "trainingStarted": False,
        "qualifiedAtUtc": utc_now(),
    }
    del image, reconstruction, loss, autoencoder
    torch.cuda.empty_cache()
    return result


def validation_loss(autoencoder, images, device, weights) -> float:
    autoencoder.eval()
    values = []
    with torch.no_grad():
        for image in images:
            image = image.to(device)
            values.append(float(_loss(autoencoder.decode(autoencoder.encode(image)), image, weights)))
    return sum(values) / len(values)


def run_training(root: Path, request: dict) -> dict:
    config, dataset_manifest, budget = validate_common(root, request, TRAIN_SCHEMA)
    qualification, _ = read_json_bound(root, request["gpuQualification"])
    require(qualification.get("schemaVersion") == QUALIFICATION_SCHEMA
            and qualification.get("status") == "passed_no_optimizer_step",
            "GPU qualification did not pass")
    require(qualification.get("runId") == request["qualificationRunId"],
            "GPU qualification run mismatch")
    require(qualification.get("datasetManifest") == request["datasetManifest"]
            and qualification.get("config") == request["config"],
            "GPU qualification inputs differ")
    require(qualification.get("optimizerSteps") == 0
            and qualification.get("modelStateUnchanged") is True,
            "GPU qualification mutated the model")
    require(torch.cuda.is_available(), "CUDA is unavailable")

    output_root = project_file(root, request["trainingOutputRoot"])
    output_root.mkdir(parents=True, exist_ok=False)
    started_at = utc_now()
    started = time.perf_counter()
    train_dataset, validation_dataset = datasets(root, request)
    prepared = prepare_isolated_foundation_data(
        train_dataset=train_dataset, validation_dataset=validation_dataset)
    seed = int(config["training"]["seed"])
    autoencoder = fresh_autoencoder(config, seed)
    initial_state = state_hash(autoencoder.state_dict())
    require(initial_state == qualification["modelStateSha256Before"],
            "fresh initialization differs from GPU qualification")
    device = torch.device("cuda")
    autoencoder.to(device)
    optimizer = torch.optim.AdamW(
        autoencoder.parameters(), lr=float(config["training"]["autoencoderLearningRate"]))
    epoch_count = int(config["training"]["autoencoderEpochs"])
    require(epoch_count == budget["maxEpochs"], "epoch count differs from bound")
    metrics = []
    best = None
    optimizer_steps = 0
    for epoch in range(epoch_count):
        row = run_isolated_foundation_epoch(
            autoencoder=autoencoder, optimizer=optimizer,
            train_dataset=train_dataset, validation_dataset=validation_dataset,
            device=device, loss_weights=config["training"]["autoencoderLossWeights"],
            prepared_data=prepared)
        optimizer_steps += row["optimizerSteps"]
        require(optimizer_steps <= budget["maxOptimizerSteps"], "optimizer-step budget exceeded")
        metric = {
            "epoch": epoch + 1,
            "trainLoss": row["trainLoss"],
            "validationLoss": row["validationLoss"],
            "optimizerStepsThisEpoch": row["optimizerSteps"],
            "optimizerStepsTotal": optimizer_steps,
        }
        metrics.append(metric)
        if best is None or metric["validationLoss"] < best["validationLoss"]:
            best = {
                "epoch": epoch + 1,
                "validationLoss": metric["validationLoss"],
                "state": {key: value.detach().cpu().clone()
                          for key, value in autoencoder.state_dict().items()},
            }
        atomic_json(output_root / "progress.json", {
            "schemaVersion": "ai-painter-stage4-mvp-fresh-foundation-progress-v1",
            "status": "running",
            "runId": request["runId"],
            "startedAtUtc": started_at,
            "updatedAtUtc": utc_now(),
            "currentEpoch": epoch + 1,
            "epochCount": epoch_count,
            "optimizerSteps": optimizer_steps,
            "bestEpoch": best["epoch"],
            "metrics": metrics,
            "challengeRead": False,
            "regressionRead": False,
        })
    require(optimizer_steps == budget["maxOptimizerSteps"], "bounded training did not finish all steps")
    autoencoder.load_state_dict(best["state"])
    selected_state = state_hash(autoencoder.state_dict())
    selected_validation_loss = validation_loss(
        autoencoder, prepared.validation_images, device,
        config["training"]["autoencoderLossWeights"])
    require(abs(selected_validation_loss - best["validationLoss"]) <= 1e-7,
            "selected checkpoint validation did not reproduce")

    checkpoint_path = output_root / "fresh-foundation-autoencoder.pt"
    staged_checkpoint = checkpoint_path.with_name(checkpoint_path.name + ".staged")
    torch.save({
        "schemaVersion": "ai-painter-stage4-mvp-fresh-foundation-checkpoint-v1",
        "runId": request["runId"],
        "datasetManifest": request["datasetManifest"],
        "datasetReleaseIdentity": dataset_manifest["datasetReleaseIdentity"],
        "config": request["config"],
        "initialization": "random_initialization_only",
        "upstreamCheckpoints": [],
        "thirdPartyWeightsLoaded": False,
        "resolution": request["resolution"],
        "trainingSplits": ["train"],
        "checkpointSelectionSplit": "validation",
        "bestEpoch": best["epoch"],
        "optimizerSteps": optimizer_steps,
        "nonTrainOptimizerSteps": 0,
        "autoencoderStateSha256": selected_state,
        "autoencoderState": best["state"],
        "denoiserState": None,
        "denoiserTrained": False,
        "formalDenoiserTrainingEligible": False,
    }, staged_checkpoint)
    os.replace(staged_checkpoint, checkpoint_path)

    reloaded = fresh_autoencoder(config, seed)
    saved = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    reloaded.load_state_dict(saved["autoencoderState"])
    require(state_hash(reloaded.state_dict()) == selected_state,
            "checkpoint reload state mismatch")
    reloaded.to(device)
    reload_validation_loss = validation_loss(
        reloaded, prepared.validation_images, device,
        config["training"]["autoencoderLossWeights"])
    require(abs(reload_validation_loss - selected_validation_loss) <= 1e-7,
            "checkpoint reload validation mismatch")

    checkpoint_binding = {
        "path": checkpoint_path.relative_to(root).as_posix(),
        "sha256": sha256_file(checkpoint_path),
    }
    result = {
        "schemaVersion": TRAINING_SCHEMA,
        "status": "completed_foundation_checkpoint_pending_denoiser_qualification",
        "executionState": "completed",
        "runId": request["runId"],
        "datasetManifest": request["datasetManifest"],
        "datasetReleaseIdentity": dataset_manifest["datasetReleaseIdentity"],
        "config": request["config"],
        "gpuQualification": request["gpuQualification"],
        "initialization": "random_initialization_only",
        "initialStateSha256": initial_state,
        "upstreamCheckpoints": [],
        "thirdPartyWeightsLoaded": False,
        "trainingStarted": True,
        "gpuStarted": True,
        "epochsCompleted": epoch_count,
        "optimizerSteps": optimizer_steps,
        "nonTrainOptimizerSteps": 0,
        "bestEpoch": best["epoch"],
        "selectedValidationLoss": selected_validation_loss,
        "reloadValidationLoss": reload_validation_loss,
        "selectedStateSha256": selected_state,
        "checkpoint": checkpoint_binding,
        "trainSampleIds": list(prepared.train_sample_ids),
        "validationSampleIds": list(prepared.validation_sample_ids),
        "challengeRead": False,
        "regressionRead": False,
        "denoiserTrained": False,
        "formalDenoiserTrainingEligible": False,
        "stage4ProgressRaised": False,
        "startedAtUtc": started_at,
        "completedAtUtc": utc_now(),
        "durationSeconds": round(time.perf_counter() - started, 3),
        "metrics": metrics,
    }
    atomic_json(output_root / "terminal.json", result)
    atomic_json(output_root / "progress.json", {
        "schemaVersion": "ai-painter-stage4-mvp-fresh-foundation-progress-v1",
        "status": "completed",
        "runId": request["runId"],
        "startedAtUtc": started_at,
        "updatedAtUtc": result["completedAtUtc"],
        "currentEpoch": epoch_count,
        "epochCount": epoch_count,
        "optimizerSteps": optimizer_steps,
        "bestEpoch": best["epoch"],
        "checkpoint": checkpoint_binding,
        "metrics": metrics,
        "challengeRead": False,
        "regressionRead": False,
    })
    return result


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--mode", choices=("gpu-qualify", "train"), required=True)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    root = Path.cwd().resolve()
    request_binding = {"path": args.request.replace("\\", "/"), "sha256": args.request_sha256}
    request, _ = read_json_bound(root, request_binding)
    result = gpu_qualify(root, request) if args.mode == "gpu-qualify" else run_training(root, request)
    output = project_file(root, args.output.replace("\\", "/"))
    atomic_json(output, result)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise

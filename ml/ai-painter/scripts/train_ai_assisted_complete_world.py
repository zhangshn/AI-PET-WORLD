from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import random
import time

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedColdStartRgbDataset


OWNERSHIP = "project_owned_architecture_ai_assisted_cold_start_weights"
POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"


def main() -> int:
    parser = ArgumentParser(description="Warm up the AI-PET-WORLD project-owned autoencoder with owner-approved AI-assisted RGB data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--resolution-stage", type=int, default=0)
    parser.add_argument("--initial-checkpoint", type=Path)
    args = parser.parse_args()

    config = read_json(args.config)
    package = read_json(args.dataset_package)
    validate_training_inputs(config, package)
    stage = config["training"]["resolutionStages"][args.resolution_stage]
    image_size = (int(stage["width"]), int(stage["height"]))
    loss_weights = config["training"].get("autoencoderLossWeights", {"pixel": 1.0, "edge": 0.25, "laplacian": 0.0})
    seed = int(config["training"]["seed"])
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    started_at = utc_now()
    started_at_shanghai = asia_shanghai_now()
    metrics = []

    datasets = {
        split: AiAssistedColdStartRgbDataset(args.dataset_package, split, image_size)
        for split in ("train", "validation", "challenge", "regression")
    }
    loaders = {
        split: torch.utils.data.DataLoader(
            dataset,
            batch_size=int(config["training"]["batchSize"]),
            shuffle=split == "train",
            num_workers=0,
        )
        for split, dataset in datasets.items()
    }
    loader = loaders["train"]
    model = build_complete_world_system(config).to(device)
    initialization = "random_initialization_only"
    parent_checkpoint = None
    if args.resolution_stage > 0:
        if args.initial_checkpoint is None:
            raise ValueError("progressive resolution stage requires the previous project checkpoint")
        parent_checkpoint = load_parent_checkpoint(
            args.initial_checkpoint,
            config,
            package,
            args.resolution_stage,
        )
        model.autoencoder.load_state_dict(parent_checkpoint["autoencoderState"])
        initialization = "project_checkpoint_resume"
    elif args.initial_checkpoint is not None:
        raise ValueError("resolution stage 0 must start from project random initialization")
    initialization_sha256 = state_dict_sha256(model.autoencoder.state_dict())
    started = time.perf_counter()
    optimizer = torch.optim.AdamW(model.autoencoder.parameters(), lr=float(config["training"]["autoencoderLearningRate"]))
    epoch_count = int(config["training"]["autoencoderEpochs"])
    model.train()

    for epoch in range(epoch_count):
        total = 0.0
        for batch in loader:
            image = batch["image"].to(device)
            optimizer.zero_grad(set_to_none=True)
            reconstruction = model.autoencoder.decode(model.autoencoder.encode(image))
            loss = reconstruction_loss(reconstruction, image, loss_weights)
            loss.backward()
            optimizer.step()
            total += float(loss.detach())
        train_loss = total / len(loader)
        validation_loss = evaluate_reconstruction(model, loaders["validation"], device, loss_weights)
        row = {
            "stage": "ai_assisted_autoencoder_warmup",
            "epoch": epoch + 1,
            "loss": train_loss,
            "trainLoss": train_loss,
            "validationLoss": validation_loss,
        }
        metrics.append(row)
        write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, "running")

    split_metrics = {
        split: {
            "sampleCount": len(datasets[split]),
            "reconstructionLoss": evaluate_reconstruction(model, loaders[split], device, loss_weights),
        }
        for split in datasets
    }
    reconstruction_records = save_reconstruction_evidence(
        model,
        datasets,
        args.output_dir / "reconstruction-evidence",
        device,
    )

    checkpoint_path = args.output_dir / "complete-world-ai-assisted-autoencoder.pt"
    checkpoint = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "ownership": OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": POLICY_VERSION,
        "initialization": initialization,
        "initializationStateSha256": initialization_sha256,
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "architectureVersion": config.get("architectureVersion"),
        "modelConfig": config,
        "datasetPackageId": package["packageId"],
        "trainingStage": "autoencoder_warmup_only",
        "denoiserTrained": False,
        "conditionBoundSampleCount": int(package.get("conditionBoundCompleteMapCount", 0)),
        "formalInferenceEligible": False,
        "resolutionStage": stage,
        "seed": seed,
        "splitMetrics": split_metrics,
        "autoencoderLossVersion": config["training"].get("autoencoderLossVersion", "pixel_edge_v1"),
        "autoencoderLossWeights": loss_weights,
        "parentCheckpointPath": project_path(args.initial_checkpoint) if args.initial_checkpoint else None,
        "parentCheckpointSha256": sha256_file(args.initial_checkpoint) if args.initial_checkpoint else None,
        "autoencoderState": {key: value.detach().cpu() for key, value in model.autoencoder.state_dict().items()},
    }
    torch.save(checkpoint, checkpoint_path)
    created_at = utc_now()
    manifest = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "status": "autoencoder_warmup_completed_conditioning_blocked",
        "createdAtUtc": created_at,
        "createdAtAsiaShanghai": asia_shanghai_now(),
        "ownership": OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": POLICY_VERSION,
        "initialization": initialization,
        "initializationStateSha256": initialization_sha256,
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "architectureVersion": config.get("architectureVersion"),
        "configPath": project_path(args.config),
        "configSha256": sha256_file(args.config),
        "datasetPackageId": package["packageId"],
        "datasetManifestPath": project_path(args.dataset_package),
        "datasetManifestSha256": sha256_file(args.dataset_package),
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": sha256_file(checkpoint_path),
        "parentCheckpointPath": project_path(args.initial_checkpoint) if args.initial_checkpoint else None,
        "parentCheckpointSha256": sha256_file(args.initial_checkpoint) if args.initial_checkpoint else None,
        "trainingStage": "autoencoder_warmup_only",
        "denoiserTrained": False,
        "formalInferenceEligible": False,
        "conditionBoundSampleCount": int(package.get("conditionBoundCompleteMapCount", 0)),
        "remainingBlockers": list(package.get("blockers", [])),
        "resolutionStage": stage,
        "sampleCount": len(datasets["train"]),
        "splitMetrics": split_metrics,
        "autoencoderLossVersion": config["training"].get("autoencoderLossVersion", "pixel_edge_v1"),
        "autoencoderLossWeights": loss_weights,
        "reconstructionEvidence": reconstruction_records,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "device": str(device),
        "metrics": metrics,
        "automaticStorage": True,
    }
    manifest_path = args.output_dir / "manifest.json"
    write_json(manifest_path, manifest)
    write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, None, metrics, "completed", manifest)
    print(json.dumps({**manifest, "manifestPath": project_path(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


def validate_training_inputs(config, package):
    if config.get("ownership") != OWNERSHIP or config.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("AI-assisted model ownership or lane contract failed")
    if config.get("initialization") != "random_initialization_only" or config.get("upstreamModelIds") != []:
        raise ValueError("AI-assisted model must use project initialization without upstream weights")
    if config.get("thirdPartyWeightsAllowed") is not False:
        raise ValueError("third-party weights are forbidden")
    if config.get("thirdPartyGeneratedTrainingOutputsAllowed") is not True:
        raise ValueError("AI-assisted data dependency is not declared by the model config")
    if package.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1":
        raise ValueError("AI-assisted dataset package schema is invalid")
    if package.get("policyVersion") != POLICY_VERSION or package.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("AI-assisted dataset policy or lane is invalid")
    if package.get("modelConfigId") != config.get("modelId"):
        raise ValueError("AI-assisted dataset package model config does not match")
    if package.get("modelArchitectureVersion") != config.get("architectureVersion"):
        raise ValueError("AI-assisted dataset package architecture version does not match")
    if package.get("canStartAutoencoderWarmup") is not True:
        raise ValueError("AI-assisted dataset package is not ready for autoencoder warmup")
    if package.get("canStartFormalTraining") is not False or package.get("formalInferenceEligible") is not False:
        raise ValueError("warmup package must not claim formal readiness")


def load_parent_checkpoint(path, config, package, resolution_stage):
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    expected_stage = config["training"]["resolutionStages"][resolution_stage - 1]
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("parent checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("parent checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("parent checkpoint contains forbidden upstream weights")
    if checkpoint.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("parent checkpoint dataset package does not match")
    if checkpoint.get("modelId") != config.get("modelId") or checkpoint.get("architectureVersion") != config.get("architectureVersion"):
        raise ValueError("parent checkpoint model architecture does not match")
    if checkpoint.get("resolutionStage") != expected_stage:
        raise ValueError("parent checkpoint is not the immediately preceding resolution stage")
    if not isinstance(checkpoint.get("autoencoderState"), dict):
        raise ValueError("parent checkpoint autoencoder state is missing")
    return checkpoint


def write_progress(output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, status, manifest=None):
    updated_at = utc_now()
    payload = {
        "schemaVersion": "project-owned-ai-assisted-cold-start-training-progress-v1",
        "status": status,
        "startedAtUtc": started_at,
        "startedAtAsiaShanghai": started_at_shanghai,
        "updatedAtUtc": updated_at,
        "updatedAtAsiaShanghai": asia_shanghai_now(),
        "modelId": config["modelId"],
        "datasetPackageId": package["packageId"],
        "trainingLane": "ai_assisted_cold_start",
        "resolutionStage": stage,
        "currentStage": row["stage"] if row else "completed",
        "currentEpoch": row["epoch"] if row else None,
        "metrics": metrics,
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "formalInferenceEligible": False,
        "automaticStorage": True,
    }
    if manifest:
        payload["checkpointPath"] = manifest["checkpointPath"]
        payload["checkpointSha256"] = manifest["checkpointSha256"]
        payload["remainingBlockers"] = manifest["remainingBlockers"]
    write_json(output_dir / "progress.json", payload)


def evaluate_reconstruction(model, loader, device, loss_weights):
    was_training = model.training
    model.eval()
    total = 0.0
    with torch.no_grad():
        for batch in loader:
            image = batch["image"].to(device)
            reconstruction = model.autoencoder.decode(model.autoencoder.encode(image))
            total += float(reconstruction_loss(reconstruction, image, loss_weights).detach())
    if was_training:
        model.train()
    return total / len(loader)


def save_reconstruction_evidence(model, datasets, output_dir, device):
    output_dir.mkdir(parents=True, exist_ok=False)
    was_training = model.training
    model.eval()
    records = []
    with torch.no_grad():
        for split in ("validation", "challenge", "regression"):
            for index in range(len(datasets[split])):
                row = datasets[split][index]
                image = row["image"].unsqueeze(0).to(device)
                reconstruction = model.autoencoder.decode(model.autoencoder.encode(image)).clamp(0.0, 1.0)
                original_array = tensor_to_uint8(image[0])
                reconstruction_array = tensor_to_uint8(reconstruction[0])
                comparison = np.concatenate((original_array, reconstruction_array), axis=1)
                file_path = output_dir / f"{split}-{index + 1:02d}-{row['sampleId']}.png"
                Image.fromarray(comparison, mode="RGB").save(file_path)
                records.append({
                    "split": split,
                    "sampleId": row["sampleId"],
                    "comparisonLayout": "left_original_right_model_reconstruction",
                    "imagePath": project_path(file_path),
                    "imageSha256": sha256_file(file_path),
                    "formalCandidate": False,
                })
    if was_training:
        model.train()
    return records


def tensor_to_uint8(value):
    return value.detach().cpu().permute(1, 2, 0).mul(255.0).round().byte().numpy()


def reconstruction_loss(reconstruction, image, weights):
    pixel_loss = torch.nn.functional.l1_loss(reconstruction, image)
    edge_loss = image_edge_loss(reconstruction, image)
    laplacian_loss = image_laplacian_loss(reconstruction, image)
    return (
        pixel_loss * float(weights.get("pixel", 1.0))
        + edge_loss * float(weights.get("edge", 0.25))
        + laplacian_loss * float(weights.get("laplacian", 0.0))
    )


def image_laplacian_loss(left, right):
    kernel = left.new_tensor([
        [0.0, -1.0, 0.0],
        [-1.0, 4.0, -1.0],
        [0.0, -1.0, 0.0],
    ]).view(1, 1, 3, 3).repeat(left.shape[1], 1, 1, 1)
    left_laplacian = torch.nn.functional.conv2d(left, kernel, padding=1, groups=left.shape[1])
    right_laplacian = torch.nn.functional.conv2d(right, kernel, padding=1, groups=right.shape[1])
    return torch.nn.functional.l1_loss(left_laplacian, right_laplacian)


def image_edge_loss(left, right):
    left_x = left[:, :, :, 1:] - left[:, :, :, :-1]
    right_x = right[:, :, :, 1:] - right[:, :, :, :-1]
    left_y = left[:, :, 1:, :] - left[:, :, :-1, :]
    right_y = right[:, :, 1:, :] - right[:, :, :-1, :]
    return torch.nn.functional.l1_loss(left_x, right_x) + torch.nn.functional.l1_loss(left_y, right_y)


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def state_dict_sha256(state):
    buffer = io.BytesIO()
    torch.save({key: value.detach().cpu() for key, value in state.items()}, buffer)
    return hashlib.sha256(buffer.getvalue()).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def asia_shanghai_now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")


def read_json(value):
    return json.loads(Path(value).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path):
    return Path(path).resolve().relative_to(Path.cwd().resolve()).as_posix()


if __name__ == "__main__":
    raise SystemExit(main())

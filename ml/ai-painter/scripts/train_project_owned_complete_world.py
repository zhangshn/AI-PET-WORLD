from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import random
import time

import numpy as np
import torch

from ai_painter.complete_world import add_noise, build_complete_world_system, build_schedule
from ai_painter.complete_world.dataset import IndependentCompleteWorldDataset


def main() -> int:
    parser = ArgumentParser(description="Train the independently initialized AI-PET-WORLD complete-map model.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--resolution-stage", type=int, default=0)
    args = parser.parse_args()

    config = read_json(args.config)
    package = read_json(args.dataset_package)
    validate_training_inputs(config, package)
    stage = config["training"]["resolutionStages"][args.resolution_stage]
    image_size = (int(stage["width"]), int(stage["height"]))
    seed = int(config["training"]["seed"])
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    metrics = []

    def persist_progress(row):
        metrics.append(row)
        write_json(args.output_dir / "progress.json", {
            "schemaVersion": "project-owned-complete-world-training-progress-v1",
            "status": "running",
            "startedAtUtc": started_at,
            "updatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "modelId": config["modelId"],
            "datasetPackageId": package["packageId"],
            "resolutionStage": stage,
            "currentStage": row["stage"],
            "currentEpoch": row["epoch"],
            "metrics": metrics,
            "thirdPartyWeightsLoaded": False,
            "automaticStorage": True,
        })

    dataset = IndependentCompleteWorldDataset(
        args.dataset_package,
        "train",
        list(config["conditionChannelOrder"]),
        image_size,
    )
    loader = torch.utils.data.DataLoader(dataset, batch_size=int(config["training"]["batchSize"]), shuffle=True, num_workers=0)
    model = build_complete_world_system(config).to(device)
    initialization_sha256 = state_dict_sha256(model.state_dict())
    started = time.perf_counter()

    train_autoencoder(model, loader, config, device, persist_progress)
    train_denoiser(model, loader, config, device, persist_progress)

    checkpoint_path = args.output_dir / "complete-world-independent.pt"
    checkpoint = {
        "schemaVersion": "project-owned-complete-world-checkpoint-v1",
        "ownership": "project_owned_independent_weights",
        "initialization": "random_initialization_only",
        "initializationStateSha256": initialization_sha256,
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": False,
        "modelId": config["modelId"],
        "modelConfig": config,
        "datasetPackageId": package["packageId"],
        "datasetAuditId": package["dataAuditId"],
        "resolutionStage": stage,
        "seed": seed,
        "modelState": {key: value.detach().cpu() for key, value in model.state_dict().items()},
    }
    torch.save(checkpoint, checkpoint_path)
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    manifest = {
        "schemaVersion": "project-owned-complete-world-checkpoint-v1",
        "status": "training_completed",
        "createdAtUtc": created_at,
        "ownership": checkpoint["ownership"],
        "initialization": checkpoint["initialization"],
        "initializationStateSha256": initialization_sha256,
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": False,
        "modelId": config["modelId"],
        "configPath": project_path(args.config),
        "configSha256": sha256_file(args.config),
        "datasetPackageId": package["packageId"],
        "datasetManifestPath": project_path(args.dataset_package),
        "datasetManifestSha256": sha256_file(args.dataset_package),
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": sha256_file(checkpoint_path),
        "resolutionStage": stage,
        "sampleCount": len(dataset),
        "durationSeconds": round(time.perf_counter() - started, 3),
        "metrics": metrics,
        "automaticStorage": True,
    }
    manifest_path = args.output_dir / "manifest.json"
    write_json(manifest_path, manifest)
    write_json(args.output_dir / "progress.json", {
        "schemaVersion": "project-owned-complete-world-training-progress-v1",
        "status": "completed",
        "startedAtUtc": started_at,
        "updatedAtUtc": created_at,
        "modelId": config["modelId"],
        "datasetPackageId": package["packageId"],
        "resolutionStage": stage,
        "currentStage": "completed",
        "currentEpoch": None,
        "metrics": metrics,
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": manifest["checkpointSha256"],
        "thirdPartyWeightsLoaded": False,
        "automaticStorage": True,
    })
    print(json.dumps({**manifest, "manifestPath": project_path(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


def train_autoencoder(model, loader, config, device, on_epoch):
    optimizer = torch.optim.AdamW(model.autoencoder.parameters(), lr=float(config["training"]["autoencoderLearningRate"]))
    epoch_count = int(config["training"]["autoencoderEpochs"])
    rows = []
    model.train()
    for epoch in range(epoch_count):
        total = 0.0
        for batch in loader:
            image = batch["image"].to(device)
            optimizer.zero_grad(set_to_none=True)
            reconstruction = model.autoencoder.decode(model.autoencoder.encode(image))
            pixel_loss = torch.nn.functional.l1_loss(reconstruction, image)
            edge_loss = image_edge_loss(reconstruction, image)
            loss = pixel_loss + edge_loss * 0.25
            loss.backward()
            optimizer.step()
            total += float(loss.detach())
        row = {"stage": "autoencoder", "epoch": epoch + 1, "loss": total / len(loader)}
        rows.append(row)
        on_epoch(row)
    return rows


def train_denoiser(model, loader, config, device, on_epoch):
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    optimizer = torch.optim.AdamW(model.denoiser.parameters(), lr=float(config["training"]["denoiserLearningRate"]))
    schedule = build_schedule(int(config["diffusionSteps"]), device)
    epoch_count = int(config["training"]["denoiserEpochs"])
    rows = []
    model.train()
    for epoch in range(epoch_count):
        total = 0.0
        for batch in loader:
            image = batch["image"].to(device)
            conditions = batch["conditions"].to(device)
            with torch.no_grad():
                clean_latent = model.autoencoder.encode(image)
            timesteps = torch.randint(0, int(config["diffusionSteps"]), (image.shape[0],), device=device)
            noise = torch.randn_like(clean_latent)
            noisy_latent = add_noise(clean_latent, noise, timesteps, schedule["alphaBars"])
            optimizer.zero_grad(set_to_none=True)
            predicted_noise = model.predict_noise(noisy_latent, timesteps, conditions)
            loss = torch.nn.functional.mse_loss(predicted_noise, noise)
            loss.backward()
            optimizer.step()
            total += float(loss.detach())
        row = {"stage": "denoiser", "epoch": epoch + 1, "loss": total / len(loader)}
        rows.append(row)
        on_epoch(row)
    return rows


def image_edge_loss(left, right):
    left_x = left[:, :, :, 1:] - left[:, :, :, :-1]
    right_x = right[:, :, :, 1:] - right[:, :, :, :-1]
    left_y = left[:, :, 1:, :] - left[:, :, :-1, :]
    right_y = right[:, :, 1:, :] - right[:, :, :-1, :]
    return torch.nn.functional.l1_loss(left_x, right_x) + torch.nn.functional.l1_loss(left_y, right_y)


def validate_training_inputs(config, package):
    if config.get("ownership") != "project_owned_independent_weights" or config.get("initialization") != "random_initialization_only":
        raise ValueError("project-owned model ownership contract failed")
    if config.get("upstreamModelIds") != [] or config.get("thirdPartyGeneratedTrainingOutputsAllowed") is not False:
        raise ValueError("project-owned model has an upstream dependency")
    if package.get("canStartFormalTraining") is not True or package.get("status") != "training_ready":
        raise ValueError("independent dataset package is not ready for formal training")


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


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


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

from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path

import torch

from ai_painter.complete_world import (
    build_complete_world_system,
    build_schedule,
    deterministic_velocity_step,
    inference_timesteps,
    recover_from_velocity,
    velocity_target,
)
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset


def main() -> int:
    parser = ArgumentParser(description="Diagnose one project-owned conditional denoiser without saving another RGB candidate.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--condition-label", required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    config = read_json(args.config)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    validate_checkpoint(config, checkpoint)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_complete_world_system(config).to(device)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.denoiser.load_state_dict(checkpoint["denoiserState"], strict=True)
    model.eval()

    image_size = (int(config["imageSize"]["width"]), int(config["imageSize"]["height"]))
    dataset, row = find_row(args.dataset_package, config, image_size, args.condition_label)
    image = row["image"].unsqueeze(0).to(device)
    conditions = row["conditions"].unsqueeze(0).to(device)
    schedule = build_schedule(int(config["diffusionSteps"]), device)
    normalization = load_latent_normalization(checkpoint, device)

    with torch.inference_mode():
        clean_latent = model.autoencoder.encode(image)
        reconstruction = model.autoencoder.decode(clean_latent)
        normalized_clean_latent = normalize_latent(clean_latent, normalization)
        fixed_timestep_diagnostics = diagnose_fixed_timesteps(
            model, normalized_clean_latent, image, conditions, schedule["alphaBars"], normalization, args.seed
        )
        trajectory = diagnose_sampler_trajectory(
            model, conditions, config, schedule["alphaBars"], normalization, args.seed, device
        )

    report = {
        "schemaVersion": "ai-assisted-conditional-sampling-diagnostic-v2",
        "status": "diagnostic_completed_no_candidate_generated",
        "createdAtUtc": utc_now(),
        "createdAtAsiaShanghai": shanghai_now(),
        "conditionLabel": args.condition_label,
        "sampleId": row["sampleId"],
        "sourceSplit": dataset,
        "seed": args.seed,
        "checkpointPath": project_path(args.checkpoint),
        "checkpointSha256": sha256_file(args.checkpoint),
        "conditionPackPath": row["conditionPackPath"],
        "conditionChannelCount": int(conditions.shape[1]),
        "autoencoder": {
            "rawCleanLatent": tensor_stats(clean_latent),
            "normalizedCleanLatent": tensor_stats(normalized_clean_latent),
            "reconstructionMae": scalar(torch.nn.functional.l1_loss(reconstruction, image)),
            "reconstructionMse": scalar(torch.nn.functional.mse_loss(reconstruction, image)),
        },
        "fixedTimesteps": fixed_timestep_diagnostics,
        "samplerTrajectory": trajectory,
        "generatedRgbSaved": False,
        "formalCandidate": False,
        "runtimeFrameEligible": False,
        "automaticStorage": True,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def diagnose_fixed_timesteps(model, clean_latent, image, conditions, alpha_bars, normalization, seed):
    rows = []
    for timestep_value in (0, 100, 250, 500, 750, 999):
        timestep = torch.tensor([timestep_value], device=clean_latent.device, dtype=torch.long)
        generator = torch.Generator(device=clean_latent.device).manual_seed(seed + timestep_value)
        noise = torch.randn(clean_latent.shape, generator=generator, device=clean_latent.device, dtype=clean_latent.dtype)
        alpha = alpha_bars[timestep_value]
        noisy = alpha.sqrt() * clean_latent + (1.0 - alpha).sqrt() * noise
        target_velocity = velocity_target(clean_latent, noise, timestep, alpha_bars)
        predicted_velocity = model.predict_velocity(noisy, timestep, conditions)
        predicted_clean, predicted_noise = recover_from_velocity(noisy, predicted_velocity, timestep_value, alpha_bars)
        decoded = model.autoencoder.decode(denormalize_latent(predicted_clean, normalization))
        rows.append({
            "timestep": timestep_value,
            "alphaBar": scalar(alpha),
            "velocityPredictionMse": scalar(torch.nn.functional.mse_loss(predicted_velocity, target_velocity)),
            "recoveredNoiseMse": scalar(torch.nn.functional.mse_loss(predicted_noise, noise)),
            "predictedCleanLatentMae": scalar(torch.nn.functional.l1_loss(predicted_clean, clean_latent)),
            "decodedRgbMae": scalar(torch.nn.functional.l1_loss(decoded, image)),
            "predictedCleanLatent": tensor_stats(predicted_clean),
        })
    return rows


def diagnose_sampler_trajectory(model, conditions, config, alpha_bars, normalization, seed, device):
    width = int(config["imageSize"]["width"])
    height = int(config["imageSize"]["height"])
    factor = int(config["latentDownsampleFactor"])
    generator = torch.Generator(device=device).manual_seed(seed)
    latent = torch.randn(
        (1, int(config["latentChannels"]), height // factor, width // factor),
        generator=generator,
        device=device,
    )
    timesteps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)
    rows = []
    for index, timestep in enumerate(timesteps):
        previous = int(timesteps[index + 1]) if index + 1 < len(timesteps) else -1
        predicted_velocity = model.predict_velocity(latent, timestep.view(1), conditions)
        alpha = alpha_bars[int(timestep)]
        predicted_clean, predicted_noise = recover_from_velocity(latent, predicted_velocity, int(timestep), alpha_bars)
        if index in {0, 1, 2, 5, 10, 20, 30, 40, len(timesteps) - 1}:
            rows.append({
                "index": index,
                "timestep": int(timestep),
                "previousTimestep": previous,
                "alphaBar": scalar(alpha),
                "latent": tensor_stats(latent),
                "predictedNoise": tensor_stats(predicted_noise),
                "predictedVelocity": tensor_stats(predicted_velocity),
                "predictedClean": tensor_stats(predicted_clean),
            })
        latent = deterministic_velocity_step(latent, predicted_velocity, int(timestep), previous, alpha_bars)
    decoded_latent = denormalize_latent(latent, normalization)
    decoded = model.autoencoder.decode(decoded_latent)
    return {
        "checkpoints": rows,
        "finalNormalizedLatent": tensor_stats(latent),
        "finalDecodedLatent": tensor_stats(decoded_latent),
        "decodedRgb": tensor_stats(decoded),
        "decodedSaturationRatio": scalar(((decoded < 0.02) | (decoded > 0.98)).float().mean()),
    }


def find_row(package_path, config, image_size, condition_label):
    matches = []
    for split in ("train", "validation", "challenge", "regression"):
        dataset = AiAssistedConditionalDenoiserDataset(
            package_path, split, list(config["conditionChannelOrder"]), image_size
        )
        for index in range(len(dataset)):
            row = dataset[index]
            if row["conditionLabel"] == condition_label:
                matches.append((split, row))
    if len(matches) != 1:
        raise ValueError(f"expected one diagnostic condition row, found {len(matches)}")
    return matches[0]


def validate_checkpoint(config, checkpoint):
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("checkpoint schema mismatch")
    if checkpoint.get("denoiserTrained") is not True or checkpoint.get("programValidated") is not True:
        raise ValueError("checkpoint training evidence is incomplete")
    if checkpoint.get("trainingStage") != "conditional_denoiser_training":
        raise ValueError("checkpoint is not a trained conditional denoiser")
    if checkpoint.get("resolutionStage") != config.get("imageSize"):
        raise ValueError("checkpoint is not the native 1024x768 stage")
    if checkpoint.get("upstreamModelIds") != [] or checkpoint.get("thirdPartyWeightsLoaded") is not False:
        raise ValueError("checkpoint has a forbidden upstream dependency")
    if checkpoint.get("predictionTarget") != "velocity_v1":
        raise ValueError("checkpoint does not use the V3 velocity target")
    if checkpoint.get("latentNormalization", {}).get("version") != "per_channel_train_split_v1":
        raise ValueError("checkpoint latent normalization is missing")


def load_latent_normalization(checkpoint, device):
    value = checkpoint["latentNormalization"]
    mean = torch.tensor(value["mean"], dtype=torch.float32, device=device).view(1, -1, 1, 1)
    standard_deviation = torch.tensor(value["standardDeviation"], dtype=torch.float32, device=device).view(1, -1, 1, 1)
    if torch.any(standard_deviation <= 0):
        raise ValueError("checkpoint latent normalization scale is invalid")
    return {"mean": mean, "standardDeviation": standard_deviation}


def normalize_latent(latent, normalization):
    return (latent - normalization["mean"]) / normalization["standardDeviation"]


def denormalize_latent(latent, normalization):
    return latent * normalization["standardDeviation"] + normalization["mean"]


def tensor_stats(value):
    detached = value.detach().float()
    return {
        "mean": scalar(detached.mean()),
        "std": scalar(detached.std()),
        "minimum": scalar(detached.min()),
        "maximum": scalar(detached.max()),
        "absoluteMaximum": scalar(detached.abs().max()),
    }


def scalar(value):
    return round(float(value.detach().cpu()), 8)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def project_path(path):
    return str(Path(path).resolve().relative_to(Path.cwd().resolve())).replace("\\", "/")


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def shanghai_now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat()


if __name__ == "__main__":
    raise SystemExit(main())

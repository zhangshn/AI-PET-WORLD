from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import math
import os
from pathlib import Path
import time

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import build_complete_world_system


def main() -> int:
    parser = ArgumentParser(description="Audit V7 challenge-target autoencoder roundtrips without changing weights.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--source-index", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    started = time.perf_counter()
    config = read_json(args.config)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    source_index = read_json(args.source_index)
    validate_inputs(config, checkpoint, source_index)
    challenge_rows = [
        row for row in source_index["samples"]
        if row.get("split") == "challenge"
        and row.get("v7CapacityContributionRegistered") is True
        and row.get("formalConditionalTrainingEligible") is True
    ]
    if len(challenge_rows) != 4:
        raise ValueError(f"expected exactly four V7 challenge rows, got {len(challenge_rows)}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_complete_world_system(config).to(device)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.eval()
    args.output_dir.mkdir(parents=True, exist_ok=False)
    rows = []
    with torch.inference_mode():
        for row in challenge_rows:
            source_path = resolve_project_path(row["imagePath"])
            source = load_rgb(source_path, config).to(device)
            latent = model.autoencoder.encode(source)
            reconstructed = model.autoencoder.decode(latent).clamp(0.0, 1.0)
            output_path = args.output_dir / f"{row['conditionLabel']}-roundtrip.png"
            save_rgb(reconstructed[0], output_path)
            metrics = measure(source, reconstructed, row, config)
            rows.append({
                "recordId": row["recordId"],
                "conditionLabel": row["conditionLabel"],
                "sourceImagePath": project_path(source_path),
                "sourceImageSha256": sha256_file(source_path),
                "roundtripImagePath": project_path(output_path),
                "roundtripImageSha256": sha256_file(output_path),
                "latentShape": list(latent.shape),
                "metrics": metrics,
            })

    mean_metrics = {
        key: round(sum(item["metrics"][key] for item in rows) / len(rows), 8)
        for key in rows[0]["metrics"]
    }
    report = {
        "schemaVersion": "ai-assisted-v7-autoencoder-roundtrip-diagnostic-v1",
        "status": "autoencoder_roundtrip_diagnostic_completed",
        "device": str(device),
        "configPath": project_path(args.config),
        "configSha256": sha256_file(args.config),
        "checkpointPath": project_path(args.checkpoint),
        "checkpointSha256": sha256_file(args.checkpoint),
        "sourceIndexPath": project_path(args.source_index),
        "sourceIndexSha256": sha256_file(args.source_index),
        "challengeRecordCount": len(rows),
        "rows": rows,
        "meanMetrics": mean_metrics,
        "diagnosis": {
            "autoencoderPrimaryBottleneck": mean_metrics["rgbMae"] > 0.1 or mean_metrics["spatialGridRgbMae"] > 0.08,
            "thresholds": {"maximumMeanRgbMae": 0.1, "maximumMeanSpatialGridRgbMae": 0.08},
            "interpretation": "roundtrip_only_does_not_test_denoiser_or_condition_usage",
        },
        "weightMutation": False,
        "formalCandidate": False,
        "formalInferenceEligible": False,
        "runtimeFrameEligible": False,
        "canEnterWorld": False,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "automaticStorage": True,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def validate_inputs(config, checkpoint, source_index):
    if config.get("modelId") != "ai-pet-world-complete-world-ai-assisted-cold-start-v7":
        raise ValueError("diagnostic is restricted to V7")
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("checkpoint provenance mismatch")
    if checkpoint.get("formalInferenceEligible") is not False:
        raise ValueError("diagnostic checkpoint must remain nonformal")
    if not isinstance(checkpoint.get("autoencoderState"), dict):
        raise ValueError("autoencoder state is missing")
    if source_index.get("v7CapacityContributionCount") != 64:
        raise ValueError("source index does not contain the locked V7 capacity")


def measure(source, reconstructed, row, config):
    rgb_mae = torch.nn.functional.l1_loss(reconstructed, source)
    mse = torch.nn.functional.mse_loss(reconstructed, source)
    gradient_mae = gradient_loss(reconstructed, source)
    laplacian_mae = torch.nn.functional.l1_loss(laplacian(reconstructed), laplacian(source))
    grid_mae = torch.nn.functional.l1_loss(
        torch.nn.functional.adaptive_avg_pool2d(reconstructed, (6, 8)),
        torch.nn.functional.adaptive_avg_pool2d(source, (6, 8)),
    )
    path_mask = load_path_mask(row, config, source.device)
    path_denominator = (path_mask.sum() * source.shape[1]).clamp_min(1.0)
    path_mae = ((reconstructed - source).abs() * path_mask).sum() / path_denominator
    return {
        "rgbMae": round(float(rgb_mae), 8),
        "rgbMse": round(float(mse), 8),
        "psnrDb": round(-10.0 * math.log10(max(float(mse), 1e-12)), 6),
        "gradientMae": round(float(gradient_mae), 8),
        "laplacianMae": round(float(laplacian_mae), 8),
        "spatialGridRgbMae": round(float(grid_mae), 8),
        "pathRegionRgbMae": round(float(path_mae), 8),
    }


def load_path_mask(row, config, device):
    condition_pack = read_json(resolve_project_path(row["conditionPackPath"]))
    channel = next(value for value in condition_pack["channels"] if value["id"] == "terrain_path_ground")
    width = int(config["imageSize"]["width"])
    height = int(config["imageSize"]["height"])
    with Image.open(resolve_project_path(channel["path"])) as image:
        values = np.asarray(image.convert("L").resize((width, height), Image.Resampling.NEAREST), dtype=np.uint8).copy()
    return torch.from_numpy(values).float().div(255.0).unsqueeze(0).unsqueeze(0).to(device)


def gradient_loss(predicted, target):
    horizontal = torch.nn.functional.l1_loss(predicted[:, :, :, 1:] - predicted[:, :, :, :-1], target[:, :, :, 1:] - target[:, :, :, :-1])
    vertical = torch.nn.functional.l1_loss(predicted[:, :, 1:, :] - predicted[:, :, :-1, :], target[:, :, 1:, :] - target[:, :, :-1, :])
    return (horizontal + vertical) * 0.5


def laplacian(value):
    padded = torch.nn.functional.pad(value, (1, 1, 1, 1), mode="replicate")
    return padded[:, :, 1:-1, :-2] + padded[:, :, 1:-1, 2:] + padded[:, :, :-2, 1:-1] + padded[:, :, 2:, 1:-1] - 4.0 * value


def load_rgb(image_path, config):
    width = int(config["imageSize"]["width"])
    height = int(config["imageSize"]["height"])
    with Image.open(image_path) as image:
        values = np.asarray(image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS), dtype=np.uint8).copy()
    return torch.from_numpy(values).permute(2, 0, 1).float().div(255.0).unsqueeze(0)


def save_rgb(tensor, output_path):
    pixels = tensor.mul(255).byte().permute(1, 2, 0).cpu().numpy()
    Image.fromarray(pixels, mode="RGB").save(output_path, format="PNG", optimize=True)


def resolve_project_path(value):
    root = os.path.abspath(Path.cwd())
    resolved = os.path.abspath(os.path.join(root, os.fspath(value)))
    if os.path.commonpath([root, resolved]) != root:
        raise ValueError(f"path escapes project: {value}")
    return Path(resolved)


def project_path(value):
    root = os.path.abspath(Path.cwd())
    resolved = os.path.abspath(value)
    if os.path.commonpath([root, resolved]) != root:
        raise ValueError(f"path escapes project: {value}")
    return Path(os.path.relpath(resolved, root)).as_posix()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())

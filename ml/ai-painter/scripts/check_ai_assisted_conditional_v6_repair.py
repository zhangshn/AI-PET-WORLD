from __future__ import annotations

import json
from pathlib import Path
import sys

import torch

PROJECT_ROOT = Path.cwd()
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "ai-painter" / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "ai-painter" / "scripts"))

from ai_painter.complete_world import build_complete_world_system
from train_ai_assisted_conditional_denoiser import predict_and_measure


def main() -> int:
    config_path = PROJECT_ROOT / "ml" / "ai-painter" / "config" / "complete-world-ai-assisted-cold-start-v6.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    model = build_complete_world_system(config).cpu()
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    model.denoiser.train()

    latent_height, latent_width = 12, 16
    image_height, image_width = latent_height * 4, latent_width * 4
    noisy = torch.randn(1, config["latentChannels"], latent_height, latent_width)
    clean = torch.randn_like(noisy)
    target_velocity = torch.randn_like(noisy)
    timestep = torch.tensor([750], dtype=torch.long)
    conditions = torch.zeros(1, config["conditionChannels"], image_height, image_width)
    order = config["conditionChannelOrder"]
    conditions[:, order.index("terrain_grass")] = 1.0
    conditions[:, order.index("terrain_path_ground"), :, image_width // 2 - 2:image_width // 2 + 2] = 1.0
    conditions[:, order.index("terrain_water"), :6, :] = 1.0
    conditions[:, order.index("terrain_shoreline"), 6:8, :] = 1.0
    conditions[:, order.index("object_footprints"), 20:25, 8:13] = 1.0
    conditions[:, order.index("focal_area"), 16:32, 20:44] = 1.0
    target_image = torch.rand(1, 3, image_height, image_width)
    alpha_bars = torch.cumprod(1.0 - torch.linspace(0.0001, 0.02, config["diffusionSteps"]), dim=0)
    normalization = {
        "mean": torch.zeros(1, config["latentChannels"], 1, 1),
        "standardDeviation": torch.ones(1, config["latentChannels"], 1, 1),
    }
    losses = predict_and_measure(
        model,
        noisy,
        target_velocity,
        clean,
        timestep,
        alpha_bars,
        conditions,
        config,
        target_image,
        normalization,
    )
    losses["compositeLossTensor"].backward()
    output_gradients = [
        parameter.grad
        for name, parameter in model.denoiser.named_parameters()
        if name.startswith("output") and parameter.requires_grad
    ]
    trainer_source = (PROJECT_ROOT / "ml" / "ai-painter" / "scripts" / "train_ai_assisted_conditional_denoiser.py").read_text(encoding="utf-8")
    checks = {
        "architectureContractIsV6": config["architectureVersion"] == "decoded-rgb-sparse-region-rollout-multiscale-unet-v6",
        "outputBindingIncludesDecodedRgb": config["conditionOutputBinding"] == "predicted_clean_latent_and_decoded_rgb_v1",
        "conditionChannelsRemain23": config["conditionChannels"] == 23,
        "decodedRgbLossFinite": bool(torch.isfinite(losses["decodedRgbMae"])),
        "sparseRegionLossFinite": bool(torch.isfinite(losses["sparseRegionDecodedRgbMae"])),
        "rolloutCheckpointContractPresent": config["training"]["bestCheckpointMetric"] == "fixed_grid_plus_deterministic_rollout_rgb_score_v6",
        "outputReceivesDecodedRgbGradient": bool(output_gradients) and all(value is not None and torch.isfinite(value).all() for value in output_gradients),
        "compositeLossFinite": bool(torch.isfinite(losses["compositeLossTensor"])),
        "strictHeldOutSplitIsChallenge": config["training"]["strictHeldOutInferenceSplit"] == "challenge",
        "challengeMetricsAreReserved": "reserved_for_post_training_held_out_inference" in trainer_source and "metricsReadDuringTraining" in trainer_source,
        "noThirdPartyWeights": config["thirdPartyWeightsAllowed"] is False and config["upstreamModelIds"] == [],
    }
    payload = {
        "status": "passed" if all(checks.values()) else "failed",
        "device": "cpu",
        "checks": checks,
        "metrics": {
            key: float(value.detach())
            for key, value in losses.items()
            if key not in {"compositeLossTensor"}
        },
        "gpuUsed": False,
        "imageGenerated": False,
        "trainingStarted": False,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import copy
import json
from pathlib import Path
import sys

import torch

PROJECT_ROOT = Path.cwd()
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "ai-painter" / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "ai-painter" / "scripts"))

from ai_painter.complete_world import build_complete_world_system
from train_ai_assisted_conditional_denoiser import (
    evaluate_deterministic_rollout_rgb_quality_v7,
    predict_and_measure,
)


class SyntheticValidationDataset:
    def __init__(self, rows: list[dict[str, torch.Tensor]]):
        self.rows = rows

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        return self.rows[index]


def build_conditions(config: dict, height: int, width: int, offset: int) -> torch.Tensor:
    conditions = torch.zeros(config["conditionChannels"], height, width)
    order = config["conditionChannelOrder"]
    conditions[order.index("terrain_grass")] = 1.0
    path_x = width // 2 + offset
    conditions[order.index("terrain_path_ground"), :, path_x - 2:path_x + 2] = 1.0
    conditions[order.index("terrain_water"), 2 + offset:8 + offset, :] = 1.0
    conditions[order.index("terrain_shoreline"), 8 + offset:10 + offset, :] = 1.0
    conditions[order.index("object_footprints"), 16:22, 8 + offset:14 + offset] = 1.0
    conditions[order.index("focal_area"), 14:34, 18:46] = 1.0
    return conditions


def main() -> int:
    config_path = PROJECT_ROOT / "ml" / "ai-painter" / "config" / "complete-world-ai-assisted-cold-start-v7.json"
    source_config = json.loads(config_path.read_text(encoding="utf-8"))
    config = copy.deepcopy(source_config)
    config["baseChannels"] = 8
    config["denoiserBaseChannels"] = 8
    config["diffusionSteps"] = 8
    config["inferenceSteps"] = 4
    config["training"]["textureHierarchyScales"] = [1.0, 0.5]

    model = build_complete_world_system(config).cpu()
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    model.denoiser.train()

    image_height, image_width = 48, 64
    target_image = torch.rand(1, 3, image_height, image_width)
    conditions = build_conditions(config, image_height, image_width, 0).unsqueeze(0)
    latent_shape = model.autoencoder.encode(target_image).shape
    noisy = torch.randn(latent_shape)
    clean = torch.randn_like(noisy)
    target_velocity = torch.randn_like(noisy)
    timestep = torch.tensor([6], dtype=torch.long)
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

    rows = [
        {
            "image": torch.rand(3, image_height, image_width),
            "conditions": build_conditions(config, image_height, image_width, offset),
        }
        for offset in (0, 2)
    ]
    rollout = evaluate_deterministic_rollout_rgb_quality_v7(
        model,
        SyntheticValidationDataset(rows),
        {"alphasCumulative": alpha_bars},
        normalization,
        torch.device("cpu"),
        20260722,
        config,
    )
    metric_names = [
        "rolloutRgbMae",
        "rolloutRgbGradientMae",
        "rolloutRgbLaplacianMae",
        "rolloutSparseRegionRgbMae",
        "rolloutRegionContrastMae",
        "rolloutSpatialGridRgbMae",
        "rolloutRgbQualityScore",
    ]
    checks = {
        "architectureContractIsV7": source_config["architectureVersion"] == "all-validation-multiseed-semantic-rollout-unet-v7",
        "conditionChannelsRemain23": source_config["conditionChannels"] == 23,
        "allValidationSamplesCovered": rollout["rolloutSampleCount"] == 2,
        "multipleSeedsCovered": rollout["rolloutSeedCountPerSample"] == 2,
        "allTrajectoriesCovered": rollout["rolloutTrajectoryCount"] == 4,
        "semanticRolloutMetricsFinite": all(torch.isfinite(torch.tensor(rollout[name])) for name in metric_names),
        "decodedRgbLossFinite": bool(torch.isfinite(losses["decodedRgbMae"])),
        "sparseRegionLossFinite": bool(torch.isfinite(losses["sparseRegionDecodedRgbMae"])),
        "outputReceivesDecodedRgbGradient": bool(output_gradients) and all(value is not None and torch.isfinite(value).all() for value in output_gradients),
        "compositeLossFinite": bool(torch.isfinite(losses["compositeLossTensor"])),
        "strictHeldOutSplitIsChallenge": source_config["training"]["strictHeldOutInferenceSplit"] == "challenge",
        "approvedCapacityIs128": source_config["training"]["dataCapacityDecision"]["totalCompleteMaps"] == 128,
        "approvedSplitIsFixed": source_config["training"]["dataCapacityDecision"]["splitCounts"] == {
            "train": 96,
            "validation": 16,
            "challenge": 8,
            "regression": 8,
        },
        "trainingRemainsBlocked": source_config["training"]["trainingAuthorizationStatus"] == "blocked_pending_approved_128_dataset_implementation",
        "noThirdPartyWeights": source_config["thirdPartyWeightsAllowed"] is False and source_config["upstreamModelIds"] == [],
    }
    payload = {
        "status": "passed" if all(checks.values()) else "failed",
        "device": "cpu",
        "checks": checks,
        "rolloutMetrics": rollout,
        "gpuUsed": False,
        "imageGenerated": False,
        "trainingStarted": False,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

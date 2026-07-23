from __future__ import annotations

import json
from pathlib import Path
import sys

import torch

PROJECT_ROOT = Path.cwd()
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "ai-painter" / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "ai-painter" / "scripts"))

from ai_painter.complete_world import build_complete_world_system
from train_ai_assisted_conditional_denoiser import (
    balanced_binary_condition_loss,
    composite_denoiser_losses_v5,
    training_timesteps,
)


def main() -> int:
    config_path = PROJECT_ROOT / "ml" / "ai-painter" / "config" / "complete-world-ai-assisted-cold-start-v5.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    model = build_complete_world_system(config).cpu()
    model.autoencoder.eval()
    model.denoiser.train()

    height, width = 12, 16
    noisy = torch.randn(1, config["latentChannels"], height, width)
    clean = torch.randn_like(noisy)
    target_velocity = torch.randn_like(noisy)
    timestep = torch.tensor([999], dtype=torch.long)
    conditions = torch.rand(1, config["conditionChannels"], height * 4, width * 4)
    alpha_bars = torch.cumprod(1.0 - torch.linspace(0.0001, 0.02, config["diffusionSteps"]), dim=0)

    predicted_velocity = model.predict_velocity(noisy, timestep, conditions)
    alpha = alpha_bars[timestep].view(-1, 1, 1, 1)
    predicted_clean = alpha.sqrt() * noisy - (1.0 - alpha).sqrt() * predicted_velocity
    predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
    target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
    losses = composite_denoiser_losses_v5(
        predicted_velocity,
        target_velocity,
        predicted_clean,
        clean,
        predicted_conditions,
        target_conditions,
        config,
    )
    losses["compositeLossTensor"].backward()

    probe_gradients = [
        parameter.grad for name, parameter in model.denoiser.named_parameters()
        if name.startswith("output_bound_condition_probe") and parameter.requires_grad
    ]
    output_gradients = [
        parameter.grad for name, parameter in model.denoiser.named_parameters()
        if name.startswith("output") and parameter.requires_grad
    ]
    empty_target = torch.zeros(1, 3, height, width)
    empty_prediction = torch.full_like(empty_target, 0.25, requires_grad=True)
    empty_loss = balanced_binary_condition_loss(empty_prediction, empty_target)
    empty_loss.backward()
    timesteps = [
        int(training_timesteps(config, 0, index, 16, 1, config["diffusionSteps"], torch.device("cpu"))[0])
        for index in range(16)
    ]

    checks = {
        "architectureContractIsV5": config["architectureVersion"] == "output-bound-condition-hierarchy-multiscale-unet-v5",
        "outputBindingUsesPredictedCleanLatent": config["conditionOutputBinding"] == "predicted_clean_latent_probe_v1",
        "typedConditionGroupsRemainLocked": (
            len(config["conditionChannelTypes"]["discrete"]) == 15
            and len(config["conditionChannelTypes"]["continuous"]) == 8
            and len(set(config["conditionChannelTypes"]["discrete"] + config["conditionChannelTypes"]["continuous"])) == 23
        ),
        "lossContractIsV5": config["training"]["denoiserLossVersion"] == "velocity_output_bound_condition_texture_hierarchy_v5",
        "checkpointMetricContractIsV5": config["training"]["bestCheckpointMetric"] == "fixed_grid_output_bound_hierarchy_score_v5",
        "conditionChannelsRemain23": predicted_conditions.shape == (1, 23, height, width),
        "conditionProbeReceivesGradient": bool(probe_gradients) and all(value is not None and torch.isfinite(value).all() for value in probe_gradients),
        "velocityOutputReceivesConditionBindingGradient": bool(output_gradients) and all(value is not None and torch.isfinite(value).all() for value in output_gradients),
        "compositeLossFinite": bool(torch.isfinite(losses["compositeLossTensor"])),
        "emptyDiscreteChannelLossFinite": bool(torch.isfinite(empty_loss)),
        "stratifiedTimestepsIncludeZero": min(timesteps) == 0,
        "stratifiedTimestepsIncludeMaximum": max(timesteps) == config["diffusionSteps"] - 1,
        "strictHeldOutSplitIsChallenge": config["training"]["strictHeldOutInferenceSplit"] == "challenge",
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
        "stratifiedTimesteps": timesteps,
        "gpuUsed": False,
        "imageGenerated": False,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

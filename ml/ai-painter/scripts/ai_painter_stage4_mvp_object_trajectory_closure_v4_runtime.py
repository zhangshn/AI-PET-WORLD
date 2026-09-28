from __future__ import annotations

"""Process-scoped V4 objective adapter for worst-class trajectory closure."""

from contextlib import contextmanager
import math

import torch

import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_stage4_mvp_object_semantic_closure_v3 import (
    CONFIG_BINDING_KEY as V3_CONFIG_BINDING_KEY,
)
from ai_painter_stage4_mvp_object_trajectory_closure_v4 import (
    CONFIG_BINDING_KEY,
    LOSS_VERSION,
    OBJECT_CHANNELS,
    PYRAMID_SCALES,
)


_V2_COMPOSITE = trainer.composite_denoiser_losses_stage4_semantic_transport_v2


def object_trajectory_closure_losses(
    predicted_rgb,
    target_rgb,
    full_conditions,
    config,
):
    training = config.get("training", {})
    binding = training.get(CONFIG_BINDING_KEY, {})
    v3_binding = training.get(V3_CONFIG_BINDING_KEY, {})
    channels = tuple(binding.get("objectChannels", ()))
    scales = tuple(float(value) for value in binding.get("pyramidScales", ()))
    weights = v3_binding.get("objectWeights")
    if (
        training.get("denoiserLossVersion") != LOSS_VERSION
        or channels != OBJECT_CHANNELS
        or scales != PYRAMID_SCALES
        or not isinstance(weights, dict)
        or set(weights) != set(channels)
    ):
        raise ValueError("Stage4 MVP object trajectory closure binding is invalid")
    order = list(config.get("conditionChannelOrder", ()))
    weighted_final = []
    weighted_luminance = []
    raw_final = []
    raw_luminance = []
    metrics = {}
    for channel in channels:
        if channel not in order:
            raise ValueError(f"Stage4 MVP object channel is missing: {channel}")
        weight = float(weights[channel])
        if not math.isfinite(weight) or weight <= 0.0:
            raise ValueError("Stage4 MVP object trajectory weight is invalid")
        final_rgb = trainer.masked_condition_rgb_loss(
            predicted_rgb, target_rgb, full_conditions, config, channel
        )
        mask = full_conditions[:, order.index(channel):order.index(channel) + 1]
        mask = torch.nn.functional.interpolate(
            mask, size=predicted_rgb.shape[-2:], mode="nearest"
        )
        pyramid = trainer._stage4_object_luminance_structure_pyramid(
            predicted_rgb, target_rgb, mask, scales
        )
        per_scale = [
            trainer._stage4_masked_luminance_correlation_from_mask(
                predicted_scale, target_scale, mask_scale
            )
            for predicted_scale, target_scale, mask_scale in pyramid
        ]
        cross_scale = trainer._stage4_masked_cross_scale_structure_consistency(pyramid)
        luminance = torch.stack([*per_scale, cross_scale]).mean()
        raw_final.append(final_rgb)
        raw_luminance.append(luminance)
        weighted_final.append(final_rgb * weight)
        weighted_luminance.append(luminance * weight)
        prefix = "".join(part.capitalize() for part in channel.split("_"))
        metrics[f"stage4MvpObjectTrajectoryV4{prefix}FinalVisibleRgbMae"] = final_rgb
        metrics[
            f"stage4MvpObjectTrajectoryV4{prefix}MultiscaleLuminanceStructureLoss"
        ] = luminance
    weighted_final_total = torch.stack(weighted_final).sum()
    weighted_luminance_total = torch.stack(weighted_luminance).sum()
    worst_final = torch.stack(raw_final).amax()
    worst_luminance = torch.stack(raw_luminance).amax()
    metrics.update({
        "stage4MvpObjectTrajectoryV4WeightedFinalVisibleRgbLoss": weighted_final_total,
        "stage4MvpObjectTrajectoryV4WeightedMultiscaleLuminanceStructureLoss": weighted_luminance_total,
        "stage4MvpObjectTrajectoryV4WorstClassFinalVisibleRgbLoss": worst_final,
        "stage4MvpObjectTrajectoryV4WorstClassMultiscaleLuminanceStructureLoss": worst_luminance,
    })
    return (
        weighted_final_total,
        weighted_luminance_total,
        worst_final,
        worst_luminance,
        metrics,
    )


def composite_denoiser_losses_stage4_mvp_object_trajectory_closure_v4(
    predicted_velocity,
    target_velocity,
    predicted_clean,
    clean_latent,
    predicted_conditions,
    target_conditions,
    predicted_rgb,
    target_rgb,
    full_conditions,
    latent_responsibility,
    rgb_responsibility,
    config,
):
    base = _V2_COMPOSITE(
        predicted_velocity,
        target_velocity,
        predicted_clean,
        clean_latent,
        predicted_conditions,
        target_conditions,
        predicted_rgb,
        target_rgb,
        full_conditions,
        latent_responsibility,
        rgb_responsibility,
        config,
    )
    weighted_final, weighted_luminance, worst_final, worst_luminance, metrics = (
        object_trajectory_closure_losses(
            predicted_rgb, target_rgb, full_conditions, config
        )
    )
    added = weighted_final + weighted_luminance + worst_final + worst_luminance
    composite = base["compositeLossTensor"] + added
    checkpoint = base["compositeConditionQualityScore"] + added
    return {
        **base,
        **metrics,
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        "compositeConditionQualityScore": checkpoint,
    }


@contextmanager
def activated_object_trajectory_closure_v4(config):
    if config.get("training", {}).get("denoiserLossVersion") != LOSS_VERSION:
        yield
        return
    current = trainer.composite_denoiser_losses_stage4_semantic_transport_v2
    if current is not _V2_COMPOSITE:
        raise RuntimeError("Stage4 semantic-transport objective is already overridden")
    trainer.composite_denoiser_losses_stage4_semantic_transport_v2 = (
        composite_denoiser_losses_stage4_mvp_object_trajectory_closure_v4
    )
    try:
        yield
    finally:
        trainer.composite_denoiser_losses_stage4_semantic_transport_v2 = _V2_COMPOSITE

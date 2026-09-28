from __future__ import annotations

"""Isolated V3 objective adapter that leaves the frozen V2 Trainer byte-exact."""

from contextlib import contextmanager
import math

import torch

import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_stage4_mvp_object_semantic_closure_v3 import (
    CONFIG_BINDING_KEY,
    LOSS_VERSION,
    OBJECT_CHANNELS,
)


_V2_COMPOSITE = trainer.composite_denoiser_losses_stage4_semantic_transport_v2


def object_semantic_closure_losses(
    predicted_rgb,
    target_rgb,
    full_conditions,
    config,
):
    training = config.get("training", {})
    binding = training.get(CONFIG_BINDING_KEY, {})
    channels = tuple(binding.get("objectChannels", ()))
    weights = binding.get("objectWeights")
    scales = tuple(float(value) for value in binding.get("pyramidScales", ()))
    if (
        training.get("denoiserLossVersion") != LOSS_VERSION
        or channels != OBJECT_CHANNELS
        or not isinstance(weights, dict)
        or set(weights) != set(channels)
        or scales != (1.0, 0.5, 0.25)
    ):
        raise ValueError("Stage4 MVP object semantic closure binding is invalid")
    order = list(config.get("conditionChannelOrder", ()))
    final_rgb_losses = []
    luminance_losses = []
    metrics = {}
    for channel in channels:
        if channel not in order:
            raise ValueError(f"Stage4 MVP object channel is missing: {channel}")
        weight = float(weights[channel])
        if not math.isfinite(weight) or weight <= 0.0:
            raise ValueError("Stage4 MVP object semantic closure weight is invalid")
        final_rgb = trainer.masked_condition_rgb_loss(
            predicted_rgb,
            target_rgb,
            full_conditions,
            config,
            channel,
        )
        mask = full_conditions[:, order.index(channel):order.index(channel) + 1]
        mask = torch.nn.functional.interpolate(
            mask, size=predicted_rgb.shape[-2:], mode="nearest"
        )
        pyramid = trainer._stage4_object_luminance_structure_pyramid(
            predicted_rgb,
            target_rgb,
            mask,
            scales,
        )
        per_scale = [
            trainer._stage4_masked_luminance_correlation_from_mask(
                predicted_scale,
                target_scale,
                mask_scale,
            )
            for predicted_scale, target_scale, mask_scale in pyramid
        ]
        cross_scale = trainer._stage4_masked_cross_scale_structure_consistency(pyramid)
        luminance = torch.stack([*per_scale, cross_scale]).mean()
        final_rgb_losses.append(final_rgb * weight)
        luminance_losses.append(luminance * weight)
        prefix = "".join(part.capitalize() for part in channel.split("_"))
        metrics[f"stage4MvpObjectClosureV3{prefix}FinalVisibleRgbMae"] = final_rgb
        metrics[
            f"stage4MvpObjectClosureV3{prefix}MultiscaleLuminanceStructureLoss"
        ] = luminance
    final_total = torch.stack(final_rgb_losses).sum()
    luminance_total = torch.stack(luminance_losses).sum()
    metrics.update({
        "stage4MvpObjectClosureV3FinalVisibleRgbLoss": final_total,
        "stage4MvpObjectClosureV3MultiscaleLuminanceStructureLoss": luminance_total,
    })
    return final_total, luminance_total, metrics


def composite_denoiser_losses_stage4_mvp_object_semantic_closure_v3(
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
    final_rgb, luminance, metrics = object_semantic_closure_losses(
        predicted_rgb, target_rgb, full_conditions, config
    )
    composite = base["compositeLossTensor"] + final_rgb + luminance
    checkpoint = base["compositeConditionQualityScore"] + final_rgb + luminance
    return {
        **base,
        **metrics,
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        "compositeConditionQualityScore": checkpoint,
    }


@contextmanager
def activated_object_semantic_closure_v3(config):
    """Temporarily route only this process' semantic-transport calls to V3."""

    if config.get("training", {}).get("denoiserLossVersion") != LOSS_VERSION:
        yield
        return
    current = trainer.composite_denoiser_losses_stage4_semantic_transport_v2
    if current is not _V2_COMPOSITE:
        raise RuntimeError("Stage4 semantic-transport objective is already overridden")
    trainer.composite_denoiser_losses_stage4_semantic_transport_v2 = (
        composite_denoiser_losses_stage4_mvp_object_semantic_closure_v3
    )
    try:
        yield
    finally:
        trainer.composite_denoiser_losses_stage4_semantic_transport_v2 = _V2_COMPOSITE

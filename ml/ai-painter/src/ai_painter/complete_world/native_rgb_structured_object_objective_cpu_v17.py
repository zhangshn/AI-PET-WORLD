from __future__ import annotations

"""Inactive CPU objective for fact-placed, learned natural objects.

Spatial supervision is computed only from the bound original RGB of the
specified split. Historical previews, review scores and challenge/regression
content are not accepted as optimization targets. This grants no GPU access.
"""

import torch

from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    generator_train_objective, validation_candidate_score,
)


OBJECT_CHANNELS = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)
SPATIAL_WEIGHT = 0.1
LUMA_WEIGHTS = (0.2126, 0.7152, 0.0722)


def original_object_class_spatial_loss(predicted, sample, channel_order, *, split):
    """Differentiable class-wise centered luma alignment at the 256x192 train scale."""
    if sample.get("split") != split or split not in ("train", "validation"):
        raise ValueError(f"structured object objective requires {split} split")
    conditions, target = sample.get("conditions"), sample.get("image")
    if (not isinstance(predicted, torch.Tensor) or predicted.shape != (1, 3, 192, 256)
            or not isinstance(target, torch.Tensor) or target.shape != (3, 192, 256)
            or not isinstance(conditions, torch.Tensor)
            or conditions.shape != (23, 192, 256)):
        raise ValueError("structured object objective requires complete bound RGB and conditions")
    if (len(channel_order) != 23 or len(set(channel_order)) != 23
            or any(channel not in channel_order for channel in OBJECT_CHANNELS)):
        raise ValueError("structured object channel order differs")
    if not all(bool(torch.isfinite(value).all() and ((value >= 0) & (value <= 1)).all())
               for value in (predicted, target, conditions)):
        raise ValueError("structured object objective requires finite values in [0,1]")
    target = target.to(device=predicted.device, dtype=torch.float32)
    conditions = conditions.to(device=predicted.device)
    weights = predicted.new_tensor(LUMA_WEIGHTS, dtype=torch.float32)[:, None, None]
    candidate_luma = (predicted[0].float() * weights).sum(dim=0)
    target_luma = (target * weights).sum(dim=0)
    losses, correlations = [], {}
    for channel in OBJECT_CHANNELS:
        mask = conditions[channel_order.index(channel)] > 0.5
        if int(mask.sum()) < 2:
            continue
        candidate = candidate_luma[mask]
        reference = target_luma[mask]
        candidate_centered = candidate - candidate.mean()
        reference_centered = reference - reference.mean()
        reference_energy = reference_centered.square().sum()
        if float(reference_energy) < 1e-8:
            # Constant original target has no spatial identity to supervise.
            continue
        numerator = (candidate_centered * reference_centered).sum()
        denominator = torch.sqrt(
            candidate_centered.square().sum() * reference_energy + 1e-8)
        correlation = (numerator / denominator).clamp(-1, 1)
        correlations[channel] = correlation
        losses.append(1 - correlation)
    if not losses:
        raise ValueError("no nonconstant original object class is available for spatial supervision")
    loss = torch.stack(losses).mean()
    if not bool(torch.isfinite(loss)):
        raise ValueError("non-finite structured object spatial objective")
    return loss, correlations


def train_structured_object_objective(discriminator, predicted, sample,
                                      instance_table, channel_order):
    """V16 landscape/texture objective plus train-original object structure."""
    if sample.get("split") != "train":
        raise ValueError("structured object training requires train split")
    base, parts = generator_train_objective(
        discriminator, predicted, sample, instance_table, channel_order)
    spatial, correlations = original_object_class_spatial_loss(
        predicted, sample, channel_order, split="train")
    total = base.float() + SPATIAL_WEIGHT * spatial
    if not bool(torch.isfinite(total)):
        raise ValueError("non-finite structured object generator objective")
    return total, {**parts, "objectClassSpatialLoss": spatial,
                   **{f"{channel}LumaCorrelation": value
                      for channel, value in correlations.items()}, "total": total}


def validation_structured_object_score(predicted, sample,
                                        instance_table, channel_order):
    """Validation may rank Checkpoints; it never creates optimizer gradients."""
    with torch.no_grad():
        if sample.get("split") != "validation":
            raise ValueError("structured object selection requires validation split")
        base, parts = validation_candidate_score(
            predicted, sample, instance_table, channel_order)
        spatial, correlations = original_object_class_spatial_loss(
            predicted, sample, channel_order, split="validation")
        total = base.float() + SPATIAL_WEIGHT * spatial
        if not bool(torch.isfinite(total)):
            raise ValueError("non-finite structured object validation score")
        return total, {**parts, "objectClassSpatialLoss": spatial,
                       **{f"{channel}LumaCorrelation": value
                          for channel, value in correlations.items()}, "total": total}

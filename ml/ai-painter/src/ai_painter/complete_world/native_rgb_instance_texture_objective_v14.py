"""CPU-only successor objective combining V13 instance alignment and V12 texture statistics.

This is a new, inactive candidate. It cannot authorize GPU, training, review,
Checkpoint promotion, or Runtime use. Original RGB is used only as a train
target or validation score; it is never an inference input.
"""

from __future__ import annotations

import torch

from ai_painter.complete_world.native_rgb_instance_object_prototype import (
    train_original_instance_objective,
    validation_instance_object_score,
)
from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (
    TEXTURE_WEIGHT,
    local_target_texture_moments_loss,
)


def _with_local_texture(predicted, sample, base, parts):
    target = sample["image"][None].to(device=predicted.device, dtype=predicted.dtype)
    texture = local_target_texture_moments_loss(predicted, target)
    total = base.float() + TEXTURE_WEIGHT * texture
    if not bool(torch.isfinite(total)):
        raise ValueError("V14 combined objective became non-finite")
    return total, {**parts, "v13Total": base, "localTextureMoments": texture,
                   "localTextureWeight": TEXTURE_WEIGHT, "total": total}


def train_original_instance_texture_objective(
    predicted, sample, instance_table, channel_order,
):
    """Only train originals may update weights; retain V13 object supervision."""
    base, parts = train_original_instance_objective(
        predicted, sample, instance_table, channel_order,
    )
    return _with_local_texture(predicted, sample, base, parts)


def validation_instance_texture_score(
    predicted, sample, instance_table, channel_order,
):
    """Validation is a no-gradient Checkpoint-selection score, never a target."""
    with torch.no_grad():
        base, parts = validation_instance_object_score(
            predicted, sample, instance_table, channel_order,
        )
        return _with_local_texture(predicted, sample, base, parts)

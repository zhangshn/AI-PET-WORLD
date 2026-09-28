"""Inactive CPU prototype: train-only conditional high-frequency discriminator.

The local discriminator is a training instrument, never a Runtime renderer.
This module has no optimizer, GPU entry point, Checkpoint or release authority.
"""

from __future__ import annotations

import torch
from torch.nn import functional as functional

from ai_painter.complete_world.native_rgb_instance_object_prototype import (
    train_original_instance_objective,
    validation_instance_object_score,
)
from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (
    TEXTURE_WEIGHT,
    local_target_texture_moments_loss,
)
from ai_painter.training.discriminator import build_patch_discriminator


COARSE_SCALE = 4
HIGHPASS_WINDOW = 5
ADVERSARIAL_WEIGHT = 0.08
FACT_REGION_WEIGHT = 0.25
FACT_REGION_CHANNELS = (
    "terrain_water", "terrain_path_ground", "terrain_shoreline", "object_footprints",
)
PROTOTYPE_ID = "stage4_mvp_native_rgb_conditional_texture_cpu_prototype_v1"
EXECUTION_QUALIFIED = False


def build_conditional_texture_discriminator():
    """Fresh 23-condition-channel patch critic; no old weights are loaded."""
    return build_patch_discriminator(condition_channels=23, base=24)


def _bound_tensors(sample, predicted, *, split):
    if sample.get("split") != split:
        raise ValueError(f"conditional texture objective requires {split} split")
    conditions, target = sample.get("conditions"), sample.get("image")
    if (not isinstance(conditions, torch.Tensor) or conditions.shape != (23, 192, 256)
            or not isinstance(target, torch.Tensor) or target.shape != (3, 192, 256)
            or not isinstance(predicted, torch.Tensor)
            or predicted.shape != (1, 3, 192, 256)):
        raise ValueError("conditional texture objective requires complete bound tensors")
    if not all(bool(torch.isfinite(tensor).all()) for tensor in
               (conditions, target, predicted)):
        raise ValueError("conditional texture objective requires finite tensors")
    if not all(bool(((tensor >= 0) & (tensor <= 1)).all()) for tensor in
               (conditions, target, predicted)):
        raise ValueError("conditional texture objective requires tensors in [0,1]")
    return (conditions[None].to(device=predicted.device, dtype=predicted.dtype),
            target[None].to(device=predicted.device, dtype=predicted.dtype))


def highpass_rgb(rgb):
    if rgb.ndim != 4 or rgb.shape[1:] != (3, 192, 256):
        raise ValueError("conditional texture highpass requires 256x192 RGB")
    local_mean = functional.avg_pool2d(
        rgb.float(), HIGHPASS_WINDOW, stride=1,
        padding=HIGHPASS_WINDOW // 2, count_include_pad=False,
    )
    return rgb.float() - local_mean


def fact_region_coarse_rgb_loss(predicted, target, conditions, channel_order):
    """Preserve declared water, path, shoreline and footprint positions."""
    if (len(channel_order) != 23 or len(set(channel_order)) != 23
            or any(identity not in channel_order for identity in FACT_REGION_CHANNELS)):
        raise ValueError("fact region channel order is invalid")
    local_predicted = functional.avg_pool2d(
        predicted.float(), 3, stride=1, padding=1, count_include_pad=False,
    )
    local_target = functional.avg_pool2d(
        target.float(), 3, stride=1, padding=1, count_include_pad=False,
    )
    terms = []
    for identity in FACT_REGION_CHANNELS:
        index = channel_order.index(identity)
        mask = (conditions[:, index:index + 1] > 0.5).float()
        if bool(mask.any()):
            support = functional.max_pool2d(mask, 3, stride=1, padding=1)
            terms.append(((local_predicted - local_target).abs() * support).sum()
                         / (support.sum() * 3).clamp_min(1))
    return torch.stack(terms).mean() if terms else predicted.sum() * 0


def discriminator_train_objective(discriminator, predicted, sample):
    """Real/fake highpass from train only; fake is detached from the renderer."""
    conditions, target = _bound_tensors(sample, predicted, split="train")
    if not all(parameter.requires_grad for parameter in discriminator.parameters()):
        raise ValueError("discriminator step requires trainable critic parameters")
    real = discriminator(torch.cat((conditions.float(), highpass_rgb(target)), dim=1))
    fake = discriminator(torch.cat((conditions.float(), highpass_rgb(predicted.detach())), dim=1))
    loss = (functional.binary_cross_entropy_with_logits(real, torch.full_like(real, 0.9))
            + functional.binary_cross_entropy_with_logits(fake, torch.zeros_like(fake))) / 2
    if not bool(torch.isfinite(loss)):
        raise ValueError("non-finite conditional discriminator objective")
    return loss, {"realScore": real.mean(), "fakeScore": fake.mean()}


def generator_train_objective(discriminator, predicted, sample, instance_table,
                              channel_order):
    """Preserve coarse facts and object color; adversarial signal targets texture."""
    conditions, target = _bound_tensors(sample, predicted, split="train")
    if any(parameter.requires_grad for parameter in discriminator.parameters()):
        raise ValueError("generator step requires frozen critic parameters")
    _, instance = train_original_instance_objective(
        predicted, sample, instance_table, channel_order,
    )
    coarse = functional.l1_loss(
        functional.avg_pool2d(predicted.float(), COARSE_SCALE),
        functional.avg_pool2d(target.float(), COARSE_SCALE),
    )
    texture = local_target_texture_moments_loss(predicted, target)
    fact_regions = fact_region_coarse_rgb_loss(
        predicted, target, conditions, channel_order,
    )
    fake = discriminator(torch.cat((conditions.float(), highpass_rgb(predicted)), dim=1))
    adversarial = functional.binary_cross_entropy_with_logits(fake, torch.ones_like(fake))
    total = (coarse + instance["instanceSupportRgbMae"].float()
             + FACT_REGION_WEIGHT * fact_regions
             + TEXTURE_WEIGHT * texture + ADVERSARIAL_WEIGHT * adversarial)
    if not bool(torch.isfinite(total)):
        raise ValueError("non-finite conditional generator objective")
    return total, {"coarseRgbMae": coarse,
                   "instanceSupportRgbMae": instance["instanceSupportRgbMae"],
                   "factRegionCoarseRgbMae": fact_regions,
                   "localTextureMoments": texture, "adversarial": adversarial,
                   "objectCount": instance["instanceCount"], "total": total}


def validation_candidate_score(predicted, sample, instance_table, channel_order):
    """Validation selects a Checkpoint; it never trains either network."""
    with torch.no_grad():
        _, target = _bound_tensors(sample, predicted, split="validation")
        _, instance = validation_instance_object_score(
            predicted, sample, instance_table, channel_order,
        )
        coarse = functional.l1_loss(
            functional.avg_pool2d(predicted.float(), COARSE_SCALE),
            functional.avg_pool2d(target.float(), COARSE_SCALE),
        )
        texture = local_target_texture_moments_loss(predicted, target)
        conditions = sample["conditions"][None].to(
            device=predicted.device, dtype=predicted.dtype,
        )
        fact_regions = fact_region_coarse_rgb_loss(
            predicted, target, conditions, channel_order,
        )
        score = (coarse + instance["instanceSupportRgbMae"].float()
                 + FACT_REGION_WEIGHT * fact_regions + TEXTURE_WEIGHT * texture)
        if not bool(torch.isfinite(score)):
            raise ValueError("non-finite conditional validation score")
        return score, {"coarseRgbMae": coarse,
                       "instanceSupportRgbMae": instance["instanceSupportRgbMae"],
                       "factRegionCoarseRgbMae": fact_regions,
                       "localTextureMoments": texture,
                       "objectCount": instance["instanceCount"], "total": score}

"""Inactive train-only RGB core objective; no execution or release authority.

The upstream loader must SHA-bind original RGB and authoritative conditions.
This formula validates tensors, not their provenance. It neither grows masks
nor changes the V21 renderer, discriminator or completed fidelity objective.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence

import torch

from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    OBJECT_CHANNELS,
)
from ai_painter.complete_world.native_rgb_whole_frame_fidelity_candidate_cpu import (
    train_whole_frame_fidelity_candidate_objective,
)

CANDIDATE_ID = "stage4_mvp_v21_object_core_fidelity_cpu_candidate_v1"
EXECUTION_QUALIFIED = False
OBJECT_CORE_RGB_WEIGHT = 1.0


def train_original_object_core_rgb(predicted, sample, channel_order):
    """Equal mean of original-RGB L1 over nonempty authoritative role cores.

    Each role is normalized by its own pixel count and three RGB channels.
    Empty roles are absent from the mean and diagnostics, not zero successes.
    A sample with no applicable cores fails closed, as does the inherited V21
    object objective. Only detached train originals provide supervision.
    """
    if not isinstance(sample, Mapping) or sample.get("split") != "train":
        raise ValueError("object core RGB requires train split")
    if (not isinstance(channel_order, Sequence) or isinstance(channel_order, (str, bytes))
            or len(channel_order) != 23
            or any(not isinstance(channel, str) for channel in channel_order)
            or len(set(channel_order)) != 23
            or any(role not in channel_order for role in OBJECT_CHANNELS)):
        raise ValueError("object core RGB requires the complete 23-channel order")
    target, conditions = sample.get("image"), sample.get("conditions")
    if (not isinstance(predicted, torch.Tensor) or predicted.shape != (1, 3, 192, 256)
            or not isinstance(target, torch.Tensor) or target.shape != (3, 192, 256)
            or not isinstance(conditions, torch.Tensor) or conditions.shape != (23, 192, 256)):
        raise ValueError("object core RGB requires complete bound 256x192 tensors")
    if not all(bool(torch.isfinite(value).all() and ((value >= 0) & (value <= 1)).all())
               for value in (predicted, target, conditions)):
        raise ValueError("object core RGB requires finite values in [0,1]")

    masks = {
        role: conditions[channel_order.index(role)].detach().to(device=predicted.device)
        for role in OBJECT_CHANNELS
    }
    if any(not bool(((mask == 0) | (mask == 1)).all()) for mask in masks.values()):
        raise ValueError("object core RGB requires discrete authoritative masks")
    footprint = masks["object_footprints"] > 0
    if any(bool(((mask > 0) & ~footprint).any())
           for role, mask in masks.items() if role != "object_footprints"):
        raise ValueError("typed object core escapes authoritative footprints")

    reference = target.detach().to(device=predicted.device, dtype=torch.float32)[None]
    error = (predicted.float() - reference).abs()
    terms, parts = [], {}
    for role, mask in masks.items():
        pixels = int(mask.sum().item())
        if not pixels:
            continue
        # Do not pool, dilate, resample, crop targets, or include background.
        value = (error * mask[None, None]).sum() / (3 * pixels)
        terms.append(value)
        parts[role + "CoreRgbMae"] = value
    if not terms:
        raise ValueError("object core RGB has no applicable authoritative cores")
    mean = torch.stack(terms).mean()
    if not bool(torch.isfinite(mean)):
        raise ValueError("nonfinite object core RGB objective")
    return OBJECT_CORE_RGB_WEIGHT * mean, {
        **parts, "objectCoreRgbMae": mean,
        "objectCoreApplicableRoleCount": mean.new_tensor(len(terms)),
    }


def train_object_core_fidelity_candidate_objective(
        discriminator, predicted, sample, instance_table, channel_order):
    """Retain exact completed fidelity objective and add one core RGB term."""
    core, core_parts = train_original_object_core_rgb(predicted, sample, channel_order)
    # The old formula is preserved; supervisory evidence is always constant.
    bound = {**sample, "image": sample["image"].detach(),
             "conditions": sample["conditions"].detach()}
    inherited, inherited_parts = train_whole_frame_fidelity_candidate_objective(
        discriminator, predicted, bound, instance_table, channel_order)
    total = inherited.float() + core
    if not bool(torch.isfinite(total)):
        raise ValueError("nonfinite object core fidelity candidate objective")
    return total, {**inherited_parts, **core_parts,
                   "wholeFrameFidelityUnchangedTotal": inherited,
                   "objectCoreRgbWeighted": core, "total": total}

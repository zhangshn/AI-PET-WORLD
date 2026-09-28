"""Inactive whole-frame fidelity candidate; no training/release entry point.

Keep the V21 structured objective unchanged and restore the inherited V13
full-frame RGB/edge terms in a separately named CPU candidate. Weights are a
comparison proposal, not evidence of improved images or active qualification.
"""
from __future__ import annotations

import torch
from torch.nn import functional as F

from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    train_structured_object_objective,
)

CANDIDATE_ID = "stage4_mvp_v21_whole_frame_fidelity_cpu_candidate_v1"
EXECUTION_QUALIFIED = False
FULL_RGB_WEIGHT = 1.0
FULL_EDGE_WEIGHT = 0.25


def train_original_whole_frame_fidelity(predicted, sample):
    """Per-channel full-frame L1 and signed adjacent-difference L1, train only."""
    target = sample.get("image")
    if sample.get("split") != "train":
        raise ValueError("whole-frame fidelity requires train split")
    if (not isinstance(predicted, torch.Tensor) or predicted.shape != (1, 3, 192, 256)
            or not isinstance(target, torch.Tensor) or target.shape != (3, 192, 256)):
        raise ValueError("whole-frame fidelity requires complete 256x192 RGB")
    if not all(bool(torch.isfinite(value).all() and ((value >= 0) & (value <= 1)).all())
               for value in (predicted, target)):
        raise ValueError("whole-frame fidelity requires finite RGB in [0,1]")
    # Targets are evidence, never optimized variables. Do not detach prediction.
    reference = target.detach().to(device=predicted.device, dtype=torch.float32)[None]
    actual = predicted.float()
    rgb = F.l1_loss(actual, reference)
    horizontal = F.l1_loss(actual[..., 1:] - actual[..., :-1],
                           reference[..., 1:] - reference[..., :-1])
    vertical = F.l1_loss(actual[..., 1:, :] - actual[..., :-1, :],
                         reference[..., 1:, :] - reference[..., :-1, :])
    edge = (horizontal + vertical) / 2
    total = FULL_RGB_WEIGHT * rgb + FULL_EDGE_WEIGHT * edge
    if not bool(torch.isfinite(total)):
        raise ValueError("nonfinite whole-frame fidelity")
    return total, {"wholeFrameRgbMae": rgb, "wholeFrameSignedEdgeMae": edge,
                   "wholeFrameFidelity": total}


def train_whole_frame_fidelity_candidate_objective(
        discriminator, predicted, sample, instance_table, channel_order):
    """One fixed additive comparison; retain every existing V21 objective term."""
    fidelity, fidelity_parts = train_original_whole_frame_fidelity(predicted, sample)
    base, base_parts = train_structured_object_objective(
        discriminator, predicted, sample, instance_table, channel_order)
    total = base.float() + fidelity
    if not bool(torch.isfinite(total)):
        raise ValueError("nonfinite whole-frame fidelity candidate objective")
    return total, {**base_parts, **fidelity_parts, "v21UnchangedTotal": base,
                   "total": total}

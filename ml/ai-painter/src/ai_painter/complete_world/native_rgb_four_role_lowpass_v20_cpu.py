"""Inactive V20 trial: one equal-four-role train-original 5x5 RGB loss."""
from __future__ import annotations

import torch
from torch.nn import functional as F


CAPABILITY = "stage4_mvp_native_rgb_four_role_lowpass_v20_trial"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
WEIGHT = 0.5
TRAIN_ORDINALS = (0, 43)
CPU_THREADS = 2
MAX_SECONDS = 120
MIN_ROLE_PIXELS = 1
MIN_ROLE_LOSS = 1e-5
MIN_AGGREGATE_GRADIENT_RATIO = 0.1
MIN_ROLE_FEATURE_GRADIENT_RATIO = 0.05
MIN_COSINE = 0.0
MIN_COMBINED_DESCENT = 1e-5
MIN_NEW_TERM_DESCENT = 1e-6
VIRTUAL_FEATURE_STEP = 0.01


def four_role_lowpass_rgb_loss(predicted, sample, channel_order):
    """Equal role means of absolute 5x5-smoothed RGB residual, including footprints."""
    if sample.get("split") != "train":
        raise ValueError("V20 trial requires bound train original RGB")
    target, conditions = sample.get("image"), sample.get("conditions")
    if (not isinstance(predicted, torch.Tensor) or predicted.shape != (1, 3, 192, 256)
            or not isinstance(target, torch.Tensor) or target.shape != (3, 192, 256)
            or not isinstance(conditions, torch.Tensor) or conditions.shape != (23, 192, 256)
            or len(channel_order) != 23 or len(set(channel_order)) != 23
            or any(role not in channel_order for role in ROLES)):
        raise ValueError("V20 trial requires complete 23-channel train tensors")
    if not all(bool(torch.isfinite(value).all() and ((value >= 0) & (value <= 1)).all())
               for value in (predicted, target, conditions)):
        raise ValueError("V20 trial input must be finite in [0,1]")
    residual = predicted.float() - target.to(predicted.device, dtype=torch.float32)[None]
    lowpass = F.avg_pool2d(residual, 5, stride=1, padding=2)[0]
    components, counts = {}, {}
    for role in ROLES:
        mask = conditions[channel_order.index(role)] > .5
        count = int(mask.sum())
        if count < MIN_ROLE_PIXELS:
            raise ValueError("V20 trial missing positive role: " + role)
        counts[role] = count
        components[role] = lowpass[:, mask].abs().mean()
    loss = torch.stack(tuple(components.values())).mean()
    if not bool(torch.isfinite(loss)):
        raise ValueError("nonfinite V20 role loss")
    return loss, components, counts

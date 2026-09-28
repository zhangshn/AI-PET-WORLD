"""Inactive V19 trial: one train-original, per-instance RGB high-pass term.

This does not change V18 weights, data, checkpoint selection or review rules.
"""
from __future__ import annotations

import torch
from torch.nn import functional as F

from ai_painter.complete_world.object_instance_supervision_cpu import ROLE_BY_KIND


CAPABILITY = "stage4_mvp_native_rgb_structured_object_v19_trial"
WEIGHT = 0.05
TRAIN_ORDINALS = (0, 43)
CPU_THREADS = 2
MAX_SECONDS = 120
MIN_LOSS = 1e-5
MIN_GRAD_ABS_SUM = 1e-9
MIN_DESCENT = 1e-6
FEATURE_STEP_SIZES = (0.01, 0.005, 0.0025)


def instance_rgb_highpass_loss(predicted, sample, channel_order):
    """Mean equal-weighted per-instance RGB residual after a fixed 3x3 blur."""
    if sample.get("split") != "train":
        raise ValueError("V19 trial target requires train original RGB")
    target, conditions, table = (sample.get("image"), sample.get("conditions"),
                                 sample.get("objectInstanceTable"))
    if (not isinstance(predicted, torch.Tensor) or predicted.shape != (1, 3, 192, 256)
            or not isinstance(target, torch.Tensor) or target.shape != (3, 192, 256)
            or not isinstance(conditions, torch.Tensor) or conditions.shape != (23, 192, 256)
            or not isinstance(table, list) or not table
            or len(channel_order) != 23 or len(set(channel_order)) != 23
            or "object_instance" not in channel_order):
        raise ValueError("V19 trial requires complete bound train tensors and table")
    if not all(bool(torch.isfinite(value).all() and ((value >= 0) & (value <= 1)).all())
               for value in (predicted, target, conditions)):
        raise ValueError("V19 trial RGB/conditions must be finite in [0,1]")
    labels = (conditions[channel_order.index("object_instance")] * 255).round().to(torch.int32)
    if not bool(((conditions[channel_order.index("object_instance")] * 255 - labels).abs() < 1e-3).all()):
        raise ValueError("object instance labels are not discrete")
    values = [item.get("value") for item in table]
    if (len(values) != len(set(values)) or
            any(type(value) is not int or not 1 <= value <= 254 for value in values) or
            set(torch.unique(labels).tolist()) - {0} != set(values)):
        raise ValueError("instance table and authoritative labels differ")
    residual = predicted.float() - target.to(predicted.device, dtype=torch.float32)[None]
    highpass = residual - F.avg_pool2d(residual, 3, stride=1, padding=1)
    per_instance, counts = [], {}
    for item in table:
        role = ROLE_BY_KIND.get(item.get("kind"))
        if role is None or role not in channel_order:
            raise ValueError("unknown object role in table")
        mask = labels == item["value"]
        if not bool(mask.any()) or not bool((conditions[channel_order.index(role)][mask] > .5).all()):
            raise ValueError("instance is absent from authoritative role mask")
        counts[role] = counts.get(role, 0) + int(mask.sum())
        per_instance.append(highpass[0, :, mask].abs().mean())
    loss = torch.stack(per_instance).mean()
    if not bool(torch.isfinite(loss)):
        raise ValueError("nonfinite V19 trial high-pass loss")
    return loss, {"instanceCount": len(per_instance), "rolePixels": counts}

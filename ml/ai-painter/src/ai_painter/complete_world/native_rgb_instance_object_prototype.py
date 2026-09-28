from __future__ import annotations

"""Inactive CPU prototype of a learned, instance-relative object RGB branch.

The full-frame substrate and every object residual are neural predictions from
the current condition pack. No original RGB, stored sprite, failed checkpoint,
or external image model enters inference. This is not a training qualification.
"""

from collections.abc import Mapping, Sequence

from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import (
    build_native_complete_rgb_aperiodic_detail_renderer,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (
    PATCH_SIZE, _crop, iter_object_views, iter_train_object_supervision,
)


OBJECT_ROLES = ("object_tree", "object_rock", "object_vegetation")
OBJECT_KINDS = ("tree", "rock", "shrub", "grass_detail")


def _instance_object_objective(predicted, sample, instance_table, channel_order,
                               *, expected_split):
    """Aligned original-RGB score, with the caller's split fixed at the boundary."""
    import torch
    from torch.nn import functional as functional

    if sample.get("split") != expected_split:
        raise ValueError(f"instance object objective requires {expected_split} split")
    target = sample.get("image")
    if (not isinstance(predicted, torch.Tensor) or not isinstance(target, torch.Tensor)
            or predicted.shape != (1, 3, 192, 256)
            or target.shape != (3, 192, 256)
            or not bool(torch.isfinite(predicted).all() and torch.isfinite(target).all())
            or not bool(((predicted >= 0) & (predicted <= 1)).all())
            or not bool(((target >= 0) & (target <= 1)).all())):
        raise ValueError("instance object objective requires finite aligned 256x192 RGB")
    reference = target[None].to(device=predicted.device, dtype=predicted.dtype)
    full_rgb = functional.l1_loss(predicted, reference)
    horizontal = functional.l1_loss(
        predicted[..., 1:] - predicted[..., :-1],
        reference[..., 1:] - reference[..., :-1],
    )
    vertical = functional.l1_loss(
        predicted[..., 1:, :] - predicted[..., :-1, :],
        reference[..., 1:, :] - reference[..., :-1, :],
    )
    full_edge = (horizontal + vertical) / 2
    object_terms = []
    if expected_split == "train":
        subjects = ((item.top, item.left, item.support_mask, item.target_rgb)
                    for item in iter_train_object_supervision(
                        sample, instance_table, channel_order))
    else:
        subjects = ((view.top, view.left, view.support_mask,
                     _crop(target, view.top, view.left, PATCH_SIZE)[0])
                    for view in iter_object_views(
                        sample.get("conditions"), instance_table, channel_order))
    for top, left, support_mask, target_rgb in subjects:
        actual, _ = _crop(predicted[0], top, left, PATCH_SIZE)
        support = support_mask.to(device=predicted.device, dtype=predicted.dtype)
        expected = target_rgb.to(device=predicted.device, dtype=predicted.dtype)
        object_terms.append(((actual - expected).abs() * support).sum()
                            / (support.sum() * 3).clamp_min(1))
    object_rgb = (torch.stack(object_terms).mean() if object_terms
                  else predicted.sum() * 0)
    total = full_rgb + 0.25 * full_edge + object_rgb
    if not bool(torch.isfinite(total)):
        raise ValueError("instance object objective became non-finite")
    return total, {"fullRgbMae": full_rgb, "fullRgbGradientMae": full_edge,
                   "instanceSupportRgbMae": object_rgb,
                   "instanceCount": len(object_terms), "total": total}


def train_original_instance_objective(predicted, sample, instance_table, channel_order):
    """Differentiable train-original objective; all non-train splits fail closed."""
    return _instance_object_objective(predicted, sample, instance_table,
                                      channel_order, expected_split="train")


def validation_instance_object_score(predicted, sample, instance_table, channel_order):
    """No-gradient validation-original score for Checkpoint selection only."""
    import torch

    with torch.no_grad():
        return _instance_object_objective(predicted, sample, instance_table,
                                          channel_order, expected_split="validation")


def build_native_rgb_instance_object_prototype(
    *, condition_channel_order: Sequence[str], base_channels: int = 48,
    patch_channels: int = 32,
):
    import torch
    from torch import nn

    if patch_channels < 16 or patch_channels % 8:
        raise ValueError("object patch width must be 8-aligned and >= 16")
    core = build_native_complete_rgb_aperiodic_detail_renderer(
        condition_channel_order=condition_channel_order,
        base_channels=base_channels,
    )
    for role in OBJECT_ROLES:
        core.responsibility_heads[role].requires_grad_(False)

    class InstancePatchHead(nn.Module):
        def __init__(self):
            super().__init__()
            # 23 source condition planes with only the subject's instance
            # channel binarized, plus support, local coordinates, base RGB,
            # and four type bits from the bound object-instance table.
            self.layers = nn.Sequential(
                nn.Conv2d(33, patch_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(patch_channels, patch_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(patch_channels, patch_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(patch_channels, 3, 1),
            )

        def forward(self, views, backgrounds):
            if not views or backgrounds.shape != (len(views), 3, PATCH_SIZE, PATCH_SIZE):
                raise ValueError("object patch batch does not match bound views")
            axis = torch.linspace(-1, 1, PATCH_SIZE, device=backgrounds.device,
                                  dtype=backgrounds.dtype)
            local_y, local_x = torch.meshgrid(axis, axis, indexing="ij")
            local_xy = torch.stack((local_x, local_y))[None].expand(len(views), -1, -1, -1)
            kind_planes = backgrounds.new_tensor([
                [float(view.kind == kind) for kind in OBJECT_KINDS] for view in views
            ])[:, :, None, None].expand(-1, -1, PATCH_SIZE, PATCH_SIZE)
            support = torch.stack([view.support_mask for view in views])
            features = torch.cat((
                torch.stack([view.subject_conditions for view in views]), support,
                local_xy, backgrounds, kind_planes,
            ), dim=1)
            return self.layers(features) * support

    class InstanceObjectRenderer(nn.Module):
        architecture_id = "stage4_native_rgb_instance_object_cpu_prototype_v3"
        execution_qualified = False

        def __init__(self):
            super().__init__()
            self.core = core
            self.object_head = InstancePatchHead()
            self.condition_channel_order = tuple(condition_channel_order)

        def forward(self, conditions, instance_table: Sequence[Mapping], *, return_evidence=False):
            if conditions.shape != (1, 23, 192, 256):
                raise ValueError("instance object prototype requires one complete 256x192 condition")
            _, evidence = self.core(conditions, return_evidence=True)
            base_logits = evidence["finalLogits"] - sum(
                evidence["responsibilityLogitContributions"][role]
                for role in OBJECT_ROLES
            )
            base_rgb = torch.sigmoid(base_logits)
            views = list(iter_object_views(conditions[0], instance_table,
                                           self.condition_channel_order))
            residuals = None
            if views:
                backgrounds = torch.stack([
                    _crop(base_rgb[0], view.top, view.left, PATCH_SIZE)[0]
                    for view in views
                ])
                residuals = self.object_head(views, backgrounds)
            pixel_indices = []
            pixel_residuals = []
            pixel_supports = []
            for view, residual in zip(views, residuals if residuals is not None else (), strict=True):
                # Collect only pixels covered by an object. Per-object full-frame
                # tensors would retain O(objects * canvas) GPU memory for backward.
                y0, y1 = max(0, view.top), min(192, view.top + PATCH_SIZE)
                x0, x1 = max(0, view.left), min(256, view.left + PATCH_SIZE)
                dy, dx = y0 - view.top, x0 - view.left
                ys = torch.arange(y0, y1, device=base_logits.device)
                xs = torch.arange(x0, x1, device=base_logits.device)
                pixel_indices.append((ys[:, None] * 256 + xs[None, :]).reshape(-1))
                pixel_residuals.append(residual[:, dy:dy + y1-y0,
                                                 dx:dx + x1-x0].reshape(3, -1).to(base_logits.dtype))
                pixel_supports.append(view.support_mask[:, dy:dy + y1-y0,
                                                         dx:dx + x1-x0].reshape(1, -1).to(base_logits.dtype))
            flat_indices = (torch.cat(pixel_indices) if pixel_indices
                            else torch.empty(0, dtype=torch.long, device=base_logits.device))
            accumulated = base_logits.new_zeros((3, 192 * 256)).index_add(
                1, flat_indices, torch.cat(pixel_residuals, dim=1)
                if pixel_residuals else base_logits.new_zeros((3, 0)))
            support_count = base_logits.new_zeros((1, 192 * 256)).index_add(
                1, flat_indices, torch.cat(pixel_supports, dim=1)
                if pixel_supports else base_logits.new_zeros((1, 0)))
            object_logit_residual = (accumulated / support_count.clamp_min(1)).reshape(1, 3, 192, 256)
            logits = base_logits + object_logit_residual
            rgb = torch.sigmoid(logits)
            if not return_evidence:
                return rgb
            return rgb, {"baseRgb": base_rgb, "objectCount": len(views),
                         "objectSupportCount": support_count.reshape(1, 1, 192, 256),
                         "objectLogitResidual": object_logit_residual}

    return InstanceObjectRenderer()

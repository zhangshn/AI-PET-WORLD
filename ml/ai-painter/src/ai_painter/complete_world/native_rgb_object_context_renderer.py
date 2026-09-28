from __future__ import annotations

"""CPU-prototype successor to V10: visible object support beyond fact footprints.

This module is not an execution-qualified capability. The original footprint
remains authoritative; a bounded visual support envelope lets learned RGB
represent a canopy, rock edge, or vegetation around that footprint. No image
or target pixels are read by the renderer.
"""

from collections.abc import Mapping, Sequence

from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import (
    build_native_complete_rgb_aperiodic_detail_renderer,
)


OBJECT_SUPPORT_RADII_256 = {
    "object_tree": 8,
    "object_rock": 4,
    "object_vegetation": 6,
}


def full_frame_object_context_objective(predicted, target, conditions, model):
    """CPU prototype objective; spatially align train RGB, never reward energy alone.

    This is deliberately full-frame only. V10's 64x64 crop loses external
    object support and cannot be reused without a separately qualified crop
    strategy. This function is not a training or execution authorization.
    """
    import torch
    from torch.nn import functional as functional

    if (predicted.shape != target.shape or predicted.ndim != 4
            or predicted.shape[1:] != (3, 192, 256)
            or conditions.shape != (predicted.shape[0], len(model.condition_channel_order), 192, 256)):
        raise ValueError("object context objective requires aligned 256x192 full frames")
    if not bool(torch.isfinite(predicted).all() and torch.isfinite(target).all()
                and torch.isfinite(conditions).all()):
        raise ValueError("object context objective requires finite tensors")

    rgb = functional.l1_loss(predicted, target)
    horizontal = functional.l1_loss(
        predicted[..., 1:] - predicted[..., :-1],
        target[..., 1:] - target[..., :-1],
    )
    vertical = functional.l1_loss(
        predicted[..., 1:, :] - predicted[..., :-1, :],
        target[..., 1:, :] - target[..., :-1, :],
    )
    gradient = (horizontal + vertical) / 2
    total = rgb + gradient * 0.25
    per_object = {}
    for identity, radius in model.support_radii.items():
        index = model.responsibility_indices[identity]
        mask = conditions[:, index:index + 1]
        support = functional.max_pool2d((mask > 0.5).to(mask.dtype), 2 * radius + 1, 1, radius)
        denominator = support.sum() * 3
        local_rgb = ((predicted - target).abs() * support).sum() / denominator.clamp_min(1)
        local_rgb = torch.where(denominator > 0, local_rgb, predicted.sum() * 0)
        per_object[identity] = local_rgb
        total = total + local_rgb
    return total, {"fullRgbMae": rgb, "fullRgbGradientMae": gradient,
                   "objectSupportRgbMae": per_object, "total": total}


def build_native_rgb_object_context_renderer(
    *, condition_channel_order: Sequence[str],
    support_radii: Mapping[str, int] = OBJECT_SUPPORT_RADII_256,
    base_channels: int = 48,
):
    import torch
    from torch import nn
    from torch.nn import functional as functional

    radii = dict(support_radii)
    if set(radii) != set(OBJECT_SUPPORT_RADII_256):
        raise ValueError("object context requires exactly three typed object responsibilities")
    if any(not isinstance(radius, int) or radius < 1 or radius > 16 for radius in radii.values()):
        raise ValueError("object visual support radius is outside CPU prototype bounds")

    core = build_native_complete_rgb_aperiodic_detail_renderer(
        condition_channel_order=condition_channel_order,
        base_channels=base_channels,
    )
    base_input_channels = len(core.base_condition_indices) + len(core.detail_scales) * 4 + 3 + 3

    class ObjectContextHead(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.layers = nn.Sequential(
                nn.Conv2d(base_input_channels, 32, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(32, 32, 3, padding=1),
                nn.SiLU(),
                nn.Conv2d(32, 3, 1),
            )

        def forward(self, value, support):
            return self.layers(value) * support

    class NativeRgbObjectContextRenderer(nn.Module):
        architecture_id = "stage4_native_rgb_object_context_cpu_prototype_v1"
        execution_qualified = False

        def __init__(self) -> None:
            super().__init__()
            self.core = core
            self.condition_channel_order = tuple(condition_channel_order)
            self.responsibility_indices = core.responsibility_indices
            self.support_radii = radii
            self.minimum_crop_valid_margin = max(radii.values())
            for identity in radii:
                self.core.responsibility_heads[identity].requires_grad_(False)
            self.context_heads = nn.ModuleDict({
                identity: ObjectContextHead() for identity in radii
            })

        def forward(self, conditions, *, return_evidence: bool = False):
            if conditions.ndim != 4 or conditions.shape[1] != len(self.condition_channel_order):
                raise ValueError("object context expects BCHW with the frozen condition order")
            _, core_evidence = self.core(conditions, return_evidence=True)
            shared = torch.cat((
                conditions[:, self.core.base_condition_indices],
                core_evidence["detailBasis"],
                core_evidence["baseRgb"],
            ), dim=1)
            # V10's typed heads use spatial GroupNorm. Keeping them would let
            # one tree change the logits of a distant tree, even though each
            # contribution is finally masked. Replace only these three heads.
            logits = core_evidence["finalLogits"] - sum(
                core_evidence["responsibilityLogitContributions"][identity]
                for identity in self.support_radii
            )
            supports = {}
            proximities = {}
            contributions = {}
            contribution_total = torch.zeros_like(logits)
            support_count = torch.zeros_like(logits[:, :1])
            for identity, radius in self.support_radii.items():
                index = self.responsibility_indices[identity]
                mask = conditions[:, index:index + 1]
                frontier = (mask > 0.5).to(mask.dtype)
                proximity = frontier
                for _ in range(radius):
                    frontier = functional.max_pool2d(frontier, 3, 1, 1)
                    proximity = proximity + frontier
                support = frontier
                proximity = proximity / (radius + 1)
                head_input = torch.cat((shared, mask, support, proximity), dim=1)
                contribution = self.context_heads[identity](head_input, support)
                supports[identity] = support
                proximities[identity] = proximity
                contributions[identity] = contribution
                contribution_total = contribution_total + contribution
                support_count = support_count + support
            # Multiple natural objects may legitimately share a visual
            # neighborhood. Average their residuals rather than summing an
            # arbitrary number of full-strength RGB logits there.
            logits = logits + contribution_total / support_count.clamp_min(1)
            rgb = torch.sigmoid(logits)
            if not return_evidence:
                return rgb
            return rgb, {
                "authoritativeMasks": core_evidence["responsibilityMasks"],
                "visualSupports": supports,
                "visualProximity": proximities,
                "contextLogitContributions": contributions,
                "finalLogits": logits,
            }

    return NativeRgbObjectContextRenderer()

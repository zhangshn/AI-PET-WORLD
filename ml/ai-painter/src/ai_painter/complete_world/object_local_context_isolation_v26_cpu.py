"""Inactive V26: isolate learned terrain context in the object appearance input.

No data, optimizer, checkpoint, GPU, training, review or publication entry.
The source conditions and terrain branch are untouched. This is an ablation
hypothesis, not proof that terrain context caused the previous visual failure.
"""
from __future__ import annotations

from collections.abc import Sequence
import torch
from torch import nn

from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    BASE_CHANNELS, build_fresh_native_rgb_complete_support_partition_v23_cpu,
)
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import coordinate_free_views
from ai_painter.complete_world.object_instance_supervision_cpu import PATCH_SIZE

CAPABILITY = "stage4_mvp256_dry_object_local_context_isolation_v26_cpu_candidate"
ARCHITECTURE = "stage4_native_rgb_complete_support_local_fact_appearance_v26"
CONTEXT_RULE = "zero_private_learned_terrain_patches_keep_local_facts_v1"


def isolated_terrain_context(terrain_patches, object_count):
    """Remove the private learned context, preserving its metadata but no gradient edge."""
    if (type(object_count) is not int or object_count <= 0
            or not isinstance(terrain_patches, torch.Tensor)
            or tuple(terrain_patches.shape) != (object_count, BASE_CHANNELS, PATCH_SIZE, PATCH_SIZE)
            or not terrain_patches.is_floating_point()
            or not bool(torch.isfinite(terrain_patches).all())):
        raise ValueError("V26 requires finite bound 48-channel object terrain patches")
    return torch.zeros_like(terrain_patches, requires_grad=False)


class LocalFactAppearance(nn.Module):
    """Keep the original .base parameter names, local facts, kinds and relative XY."""
    def __init__(self, appearance, order):
        super().__init__()
        if not isinstance(appearance, nn.Module):
            raise ValueError("V26 requires the existing learned appearance module")
        self.base = appearance
        self.order = tuple(order)

    def forward(self, views, terrain_patches):
        private = isolated_terrain_context(terrain_patches, len(views))
        return self.base(coordinate_free_views(views, self.order), private)


def build_fresh_object_local_context_isolation_v26_cpu(*,
                                                       condition_channel_order: Sequence[str]):
    """Fresh V24-shaped weights; only the appearance context path changes."""
    model = build_fresh_native_rgb_complete_support_partition_v23_cpu(
        condition_channel_order=condition_channel_order)
    appearance = model.core.core.appearance
    if not isinstance(getattr(appearance, "base", None), nn.Module):
        raise ValueError("V18 coordinate-free appearance graph differs")
    model.core.core.appearance = LocalFactAppearance(appearance.base, condition_channel_order)
    model.architecture_id = ARCHITECTURE
    model.capability_version = CAPABILITY
    model.object_context_rule = CONTEXT_RULE
    model.execution_qualified = False
    return model

"""Inactive numeric successor: deterministic object feature accumulation only.

The old V26 implementation remains immutable. This module has no execution,
optimizer, checkpoint, GPU-admission or publication entry. A managed successor
must bind its own CPU evidence and pass its own complete GPU admission.
"""
from __future__ import annotations

from contextlib import contextmanager

import torch
from torch import nn
from ai_painter.complete_world.native_stage_geometry_v1 import spatial_geometry

from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import (
    OBJECT_DEPENDENT_GROUND_CHANNELS, OBJECT_FEATURE_CHANNELS, OBJECT_ROLES,
    TERRAIN_ROLES, validate_bound_object_views,
)
from ai_painter.complete_world.object_instance_supervision_cpu import PATCH_SIZE, _crop
from ai_painter.complete_world.object_local_context_isolation_v26_cpu import (
    CONTEXT_RULE, build_fresh_object_local_context_isolation_v26_cpu,
)

CAPABILITY = "stage4_mvp256_dry_v26_deterministic_aggregation_v2_cpu_candidate"
ARCHITECTURE = "stage4_native_rgb_local_fact_deterministic_aggregation_v26_v2"
AGGREGATION_RULE = "strict_deterministic_index_add_scoped_to_object_assembly_v1"


@contextmanager
def deterministic_index_add_backend(*, backend=torch):
    """Select the supported deterministic kernel for these two calls only.

The setting is process-global, so managed workers must execute model calls
serially, as the existing worker does. It is deliberately NOT held across
terrain interpolation, convolutions, the critic or autograd: strict global
mode rejects CUDA bilinear-interpolation backward in the installed PyTorch.
Unsupported accumulation raises, rather than silently warning/falling back.
Restore both flags even if entry partially changes them and then raises.
"""
    before = (backend.are_deterministic_algorithms_enabled(),
              backend.is_deterministic_algorithms_warn_only_enabled())
    try:
        backend.use_deterministic_algorithms(True, warn_only=False)
        if (not backend.are_deterministic_algorithms_enabled()
                or backend.is_deterministic_algorithms_warn_only_enabled()):
            raise RuntimeError("strict deterministic index_add setting not applied")
        yield
    finally:
        backend.use_deterministic_algorithms(before[0], warn_only=before[1])


def assemble_object_features(reference, indices, features, supports, selection, *, geometry=None):
    """Keep the original ordered sum/count, clamp and canvas mapping exactly."""
    height, width, _ = spatial_geometry(geometry)
    if (not isinstance(reference, torch.Tensor) or not reference.is_floating_point()
            or len(indices) != len(features) or len(indices) != len(supports)
            or not isinstance(selection, (list, tuple))
            or any(type(i) is not int or not 0 <= i < len(indices) for i in selection)
            or len(set(selection)) != len(selection)):
        raise ValueError("bound object assembly selection differs")
    for i in selection:
        if (indices[i].ndim != 1 or indices[i].dtype != torch.long
                or indices[i].device != reference.device
                or features[i].shape != (OBJECT_FEATURE_CHANNELS, indices[i].numel())
                or supports[i].shape != (1, indices[i].numel())
                or any(value.dtype != torch.float32 or value.device != reference.device
                       for value in (features[i], supports[i]))):
            raise ValueError("bound object assembly tensors differ")
    selected_indices = (torch.cat([indices[i] for i in selection]) if selection
                        else torch.empty(0, dtype=torch.long, device=reference.device))
    # Do not enable strict mode over the caller's forward or backward graph.
    # Both FP32 sums use the installed deterministic index_add implementation.
    with deterministic_index_add_backend():
        summed = reference.new_zeros(
            (OBJECT_FEATURE_CHANNELS, height * width), dtype=torch.float32).index_add(
            1, selected_indices,
            torch.cat([features[i] for i in selection], dim=1) if selection
            else reference.new_zeros((OBJECT_FEATURE_CHANNELS, 0), dtype=torch.float32))
        count = reference.new_zeros(
            (1, height * width), dtype=torch.float32).index_add(
            1, selected_indices,
            torch.cat([supports[i] for i in selection], dim=1) if selection
            else reference.new_zeros((1, 0), dtype=torch.float32))
    return (summed / count.clamp_min(1)).reshape(
        1, OBJECT_FEATURE_CHANNELS, height, width), count.reshape(1, 1, height, width)


class DeterministicObjectAssemblyRenderer(nn.Module):
    """Independent adapter retaining the inherited modules/parameter names.

Only the nested assemble operation differs from the frozen V17 core's forward.
A structural regression checks that all other forward statements stay equal.
"""
    def __init__(self, source):
        super().__init__()
        order = tuple(source.condition_channel_order)
        if len(order) != 23 or len(set(order)) != 23:
            raise ValueError("complete 23-channel assembly order required")
        for name in ("terrain", "appearance", "footprint_head", "final_rgb_decoder"):
            value = getattr(source, name, None)
            if not isinstance(value, nn.Module):
                raise ValueError("inherited object assembly module differs: " + name)
            setattr(self, name, value)
        self.condition_channel_order = order

    def forward(self, conditions, instance_table, *, return_evidence=False):
        order = self.condition_channel_order
        blank_indices = tuple(order.index(name) for name in OBJECT_DEPENDENT_GROUND_CHANNELS)
        geometry = getattr(self, "native_stage_geometry", None)
        height, width, patch_size = spatial_geometry(geometry)
        if not isinstance(conditions, torch.Tensor) or conditions.shape != (1, 23, height, width):
            raise ValueError("structured object renderer requires one 256x192 condition")
        views = validate_bound_object_views(conditions[0], instance_table, order, geometry=geometry)
        for role in TERRAIN_ROLES:
            values = conditions[:, order.index(role)]
            if not bool(((values == 0) | (values == 1)).all()):
                raise ValueError(f"authoritative {role} mask is not discrete")
        ground_conditions = conditions.clone()
        ground_conditions[:, blank_indices] = 0
        terrain_features, terrain_roles = self.terrain(ground_conditions)
        indices, features, supports = [], [], []
        if views:
            patches = torch.stack([
                _crop(terrain_features[0], view.top, view.left, patch_size)[0]
                for view in views
            ])
            subject_features = self.appearance(views, patches)
            for index, view in enumerate(views):
                y0, y1 = max(0, view.top), min(height, view.top + patch_size)
                x0, x1 = max(0, view.left), min(width, view.left + patch_size)
                dy, dx = y0 - view.top, x0 - view.left
                ys = torch.arange(y0, y1, device=conditions.device)
                xs = torch.arange(x0, x1, device=conditions.device)
                indices.append((ys[:, None] * width + xs[None, :]).reshape(-1))
                features.append(subject_features[index, :, dy:dy + y1-y0,
                                                 dx:dx + x1-x0].reshape(
                    OBJECT_FEATURE_CHANNELS, -1).float())
                supports.append(view.support_mask[:, dy:dy + y1-y0,
                                                  dx:dx + x1-x0].reshape(1, -1).float())

        def assemble(selection):
            return assemble_object_features(terrain_features, indices, features, supports, selection, geometry=geometry)

        all_object_features, footprint_count = assemble(list(range(len(views))))
        footprint_mask = conditions[:, order.index("object_footprints"):
                                    order.index("object_footprints") + 1]
        footprint_features = self.footprint_head(torch.cat(
            (all_object_features, footprint_mask), dim=1)) * footprint_mask
        role_features, role_coverage = {}, {}
        for role in OBJECT_ROLES:
            role_features[role], count = assemble(
                [i for i, view in enumerate(views) if view.role == role])
            role_coverage[role] = count.clamp(0, 1)
        responsibility_conditions = {
            role: conditions[:, order.index(role):order.index(role) + 1]
            for role in (*TERRAIN_ROLES, "object_footprints", *OBJECT_ROLES)
        }
        rgb = self.final_rgb_decoder(
            terrain_features, tuple(terrain_roles[role] for role in TERRAIN_ROLES),
            (footprint_features, *(role_features[role] for role in OBJECT_ROLES)),
            responsibility_conditions,
        )
        if return_evidence:
            return rgb, {"objectCount": len(views),
                         "objectCoverage": footprint_count.clamp(0, 1),
                         "roleCoverage": role_coverage,
                         "terrainResponsibilityFeatures": terrain_roles,
                         "responsibilityConditions": responsibility_conditions,
                         "responsibilityFeatures": {
                             "object_footprints": footprint_features, **role_features}}
        return rgb


def build_fresh_object_feature_aggregation_v26_v2_cpu(*, condition_channel_order):
    model = build_fresh_object_local_context_isolation_v26_cpu(
        condition_channel_order=condition_channel_order)
    model.core.core = DeterministicObjectAssemblyRenderer(model.core.core)
    model.architecture_id = ARCHITECTURE
    model.capability_version = CAPABILITY
    model.object_aggregation_rule = AGGREGATION_RULE
    if model.object_context_rule != CONTEXT_RULE:
        raise ValueError("inherited private context isolation differs")
    model.execution_qualified = False
    return model

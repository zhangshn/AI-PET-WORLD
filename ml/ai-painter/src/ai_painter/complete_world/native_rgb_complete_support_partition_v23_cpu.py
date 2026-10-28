"""Inactive CPU V23 candidate: complete deterministic typed-support ownership.

The renderer keeps V21's fresh parameter graph, instance feature assembly,
terrain path, footprint residual, RGB heads and pointwise composition. Only the
three typed visible masks change. This module has no optimizer, checkpoint,
training, GPU, Runtime or publication entry point.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence

from ai_painter.complete_world.object_instance_supervision_cpu import SUPPORT_RADIUS
from ai_painter.complete_world.native_stage_geometry_v1 import spatial_geometry


CAPABILITY = "stage4_mvp_native_rgb_complete_support_partition_v23_cpu_candidate"
ARCHITECTURE = "stage4_native_rgb_terrain_plus_complete_typed_support_partition_v23"
OWNERSHIP_RULE = "complete_typed_support_partition_by_nearest_normalized_core_v1"
SEED = 20260929
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
TYPED_ROLES = ROLES[1:]
BASE_CHANNELS = 48
PATCH_CHANNELS = 32
MAX_EXTRA_PARAMETERS = 16_384
MAX_TOTAL_PARAMETER_BYTES = 16 * 1024 * 1024
MASK_SHAPE = (1, 1, 192, 256)


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _binary_mask(value, name, *, geometry=None):
    import torch
    height, width, _ = spatial_geometry(geometry)
    _require(isinstance(value, torch.Tensor) and tuple(value.shape) == (1, 1, height, width),
             name + " must be one complete 256x192 mask")
    _require(bool(torch.isfinite(value).all()), name + " must be finite")
    _require(bool(((value == 0) | (value == 1)).all()), name + " must be binary")
    return value.bool()


def _chebyshev_distance(core, radius):
    """Return exact integer distance to the nearest core, bounded by radius."""
    import torch
    from torch.nn import functional

    distance = torch.full(core.shape, radius + 1, dtype=torch.int16,
                          device=core.device)
    reached = core
    for step in range(radius + 1):
        newly_reached = reached & (distance == radius + 1)
        distance[newly_reached] = step
        if step != radius:
            reached = functional.max_pool2d(
                reached.float(), kernel_size=3, stride=1, padding=1).bool()
    return distance


def complete_typed_support_partition(responsibility_conditions: Mapping,
                                     role_coverage: Mapping, *, geometry=None):
    """Partition the existing typed-support union without growing any support.

    Normalized distances are compared as exact integer cross products. Strict
    improvement means exact ties retain TYPED_ROLES order: tree, rock, then
    vegetation.
    """
    import torch
    spatial_geometry(geometry)
    radii = SUPPORT_RADIUS if geometry is None else {
        role: geometry.support_radius(role) for role in TYPED_ROLES}

    _require(isinstance(responsibility_conditions, Mapping)
             and isinstance(role_coverage, Mapping), "typed support mappings required")
    _require(all(role in responsibility_conditions and role in role_coverage
                 and role in SUPPORT_RADIUS for role in TYPED_ROLES),
             "complete typed support mappings required")
    cores = {role: _binary_mask(responsibility_conditions[role], role + " core", geometry=geometry)
             for role in TYPED_ROLES}
    coverage = {role: _binary_mask(role_coverage[role], role + " coverage", geometry=geometry)
                for role in TYPED_ROLES}
    reference = cores[TYPED_ROLES[0]]
    _require(all(mask.device == reference.device for mask in (*cores.values(), *coverage.values())),
             "typed support masks must share one device")

    core_count = torch.zeros_like(reference, dtype=torch.int8)
    for role in TYPED_ROLES:
        _require(bool((~cores[role] | coverage[role]).all()),
                 role + " core escaped its existing coverage")
        _require(bool(cores[role].any()) or not bool(coverage[role].any()),
                 role + " has nonempty coverage with an empty core")
        core_count += cores[role].to(torch.int8)
    _require(not bool((core_count > 1).any()), "authoritative typed cores overlap")

    distances = {}
    for role in TYPED_ROLES:
        distance = _chebyshev_distance(cores[role], radii[role])
        _require(not bool((coverage[role]
                           & (distance > radii[role])).any()),
                 role + " coverage lacks a bounded core owner")
        distances[role] = distance

    core_union = core_count > 0
    support_union = torch.zeros_like(reference)
    owner = torch.full(reference.shape, -1, dtype=torch.int8, device=reference.device)
    for index, role in enumerate(TYPED_ROLES):
        support_union |= coverage[role]
        owner[cores[role]] = index

    best_role = torch.full_like(owner, -1)
    best_distance = torch.zeros_like(distances[TYPED_ROLES[0]])
    best_radius = torch.ones_like(distances[TYPED_ROLES[0]])
    noncore_support = support_union & ~core_union
    for index, role in enumerate(TYPED_ROLES):
        eligible = noncore_support & coverage[role]
        unset = best_role < 0
        # d/r < best_d/best_r iff d*best_r < best_d*r. Strict
        # comparison deliberately preserves the earlier role on exact ties.
        better = unset | (distances[role].to(torch.int32)
                          * best_radius.to(torch.int32)
                          < best_distance.to(torch.int32) * radii[role])
        selected = eligible & better
        best_role[selected] = index
        best_distance[selected] = distances[role][selected]
        best_radius[selected] = radii[role]
    owner[noncore_support] = best_role[noncore_support]
    _require(not bool((support_union & (owner < 0)).any()),
             "typed support pixel has no owner")

    owned = {role: owner == index for index, role in enumerate(TYPED_ROLES)}
    owned_count = torch.zeros_like(core_count)
    owned_union = torch.zeros_like(reference)
    for role in TYPED_ROLES:
        owned_count += owned[role].to(torch.int8)
        owned_union |= owned[role]
        _require(bool((~cores[role] | owned[role]).all()),
                 role + " core lost ownership")
        _require(bool((~owned[role] | coverage[role]).all()),
                 role + " owner escaped existing coverage")
    _require(torch.equal(owned_union, support_union),
             "owned union differs from typed support union")
    _require(not bool((owned_count > 1).any()), "typed support owner is not unique")
    return owned, distances


def build_native_rgb_complete_support_partition_v23_cpu(
        *, condition_channel_order: Sequence[str], base_channels=BASE_CHANNELS,
        patch_channels=PATCH_CHANNELS):
    import torch
    from torch import nn
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
        build_native_rgb_structured_object_v18_cpu,
    )

    order = tuple(condition_channel_order)
    _require(len(order) == 23 and len(set(order)) == 23
             and all(role in order for role in ROLES),
             "V23 requires complete 23-channel object contract")
    core = build_native_rgb_structured_object_v18_cpu(
        condition_channel_order=order, base_channels=base_channels,
        patch_channels=patch_channels)

    class TerrainOnlyDecoder(nn.Module):
        def __init__(self, decoder):
            super().__init__()
            self.base = decoder

        def forward(self, terrain_features, terrain_roles, object_roles,
                    responsibility_conditions):
            terrain_only_masks = dict(responsibility_conditions)
            for role in ROLES:
                terrain_only_masks[role] = torch.zeros_like(terrain_only_masks[role])
            return self.base(terrain_features, terrain_roles,
                             tuple(torch.zeros_like(value) for value in object_roles),
                             terrain_only_masks)

    core.core.final_rgb_decoder = TerrainOnlyDecoder(core.core.final_rgb_decoder)

    class Renderer(nn.Module):
        architecture_id = ARCHITECTURE
        capability_version = CAPABILITY
        execution_qualified = False
        parent_checkpoint_loaded = False
        responsibility_implementation_mode = "complete_exclusive_typed_support_partition"
        support_ownership_rule = OWNERSHIP_RULE

        def __init__(self):
            super().__init__()
            self.core = core
            self.condition_channel_order = order
            self.object_rgb_heads = nn.ModuleDict({role: nn.Sequential(
                nn.Conv2d(8, 16, 3, padding=1), nn.SiLU(),
                nn.Conv2d(16, 3, 1),
            ) for role in ROLES})

        def forward(self, conditions, instance_table, *, return_evidence=False):
            terrain_rgb, source = self.core(conditions, instance_table, return_evidence=True)
            typed_owned, typed_distances = complete_typed_support_partition(
                source["responsibilityConditions"], source["roleCoverage"],
                geometry=getattr(self, "native_stage_geometry", None))
            visible_masks = dict(typed_owned)
            visible_masks["object_footprints"] = (
                source["responsibilityConditions"]["object_footprints"] > .5)
            residuals = {}
            total = torch.zeros_like(terrain_rgb)
            for role in ROLES:
                mask = visible_masks[role]
                feature = source["responsibilityFeatures"][role]
                residual = torch.tanh(self.object_rgb_heads[role](feature.float())) * mask.float()
                residuals[role] = residual
                total = total + residual
            rgb = torch.sigmoid(torch.logit(terrain_rgb.float().clamp(1e-5, 1 - 1e-5)) + total)
            _require(bool(torch.isfinite(rgb).all()), "nonfinite V23 complete RGB")
            if return_evidence:
                return rgb, {**source, "terrainRgb": terrain_rgb,
                    "maskedObjectRgbResiduals": residuals,
                    "visibleObjectSupportMasks": visible_masks,
                    "typedSupportOwnerMasks": typed_owned,
                    "typedSupportDistancePixels": typed_distances,
                    "supportOwnershipRule": OWNERSHIP_RULE,
                    "objectResidualSum": total}
            return rgb

    return Renderer()


def build_fresh_native_rgb_complete_support_partition_v23_cpu(*,
                                                               condition_channel_order):
    import torch
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(SEED)
        return build_native_rgb_complete_support_partition_v23_cpu(
            condition_channel_order=condition_channel_order)

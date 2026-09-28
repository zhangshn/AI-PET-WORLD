"""Rejected CPU V22 prototype: decode object RGB per instance before assembly.

Inference uses only the 23 authoritative conditions and bound instance table.
The terrain path, visible support policy and complete-RGB composition match the
fresh V21 family; no source RGB, sprite, historical checkpoint or external model
is read here. This module grants no training or release qualification.
Equal-weight counterfactuals make its output equivalent to V21 for separated
objects; it is retained only for a regression test, not as a training candidate.
"""
from __future__ import annotations

from collections.abc import Sequence

from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import (
    OBJECT_DEPENDENT_GROUND_CHANNELS, OBJECT_FEATURE_CHANNELS, PATCH_SIZE,
    TERRAIN_ROLES, _crop, validate_bound_object_views,
)
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
    build_native_rgb_structured_object_v18_cpu,
)


CAPABILITY = "stage4_mvp_native_rgb_instance_first_v22_cpu_prototype"
ARCHITECTURE = "stage4_native_rgb_instance_first_object_residual_v22"
SEED = 20260930
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
TYPED_ROLES = ROLES[1:]
BASE_CHANNELS = 48
PATCH_CHANNELS = 32
MAX_EXTRA_PARAMETERS = 16_384
MAX_TOTAL_PARAMETER_BYTES = 16 * 1024 * 1024


def build_native_rgb_instance_first_v22_cpu(*, condition_channel_order: Sequence[str],
                                             base_channels=BASE_CHANNELS,
                                             patch_channels=PATCH_CHANNELS):
    import torch
    from torch import nn

    order = tuple(condition_channel_order)
    if (len(order) != 23 or len(set(order)) != 23
            or any(role not in order for role in (*ROLES, *TERRAIN_ROLES,
                                                  *OBJECT_DEPENDENT_GROUND_CHANNELS))):
        raise ValueError("V22 requires the complete 23-channel object contract")
    # Reuse newly initialized V18 submodules, never its forward or a checkpoint.
    inherited = build_native_rgb_structured_object_v18_cpu(
        condition_channel_order=order, base_channels=base_channels,
        patch_channels=patch_channels).core

    class Renderer(nn.Module):
        architecture_id = ARCHITECTURE
        capability_version = CAPABILITY
        responsibility_implementation_mode = "declared_shared_substrate"
        execution_qualified = False
        parent_checkpoint_loaded = False

        def __init__(self):
            super().__init__()
            self.condition_channel_order = order
            self.terrain = inherited.terrain
            self.appearance = inherited.appearance
            self.footprint_head = inherited.footprint_head
            self.terrain_rgb_decoder = inherited.final_rgb_decoder
            self.instance_rgb_heads = nn.ModuleDict({role: nn.Sequential(
                nn.Conv2d(OBJECT_FEATURE_CHANNELS, 16, 3, padding=1), nn.SiLU(),
                nn.Conv2d(16, 3, 1),
            ) for role in ROLES})

        def forward(self, conditions, instance_table, *, return_evidence=False):
            if (not isinstance(conditions, torch.Tensor)
                    or conditions.shape != (1, 23, 192, 256)
                    or not bool(torch.isfinite(conditions).all()
                                and ((conditions >= 0) & (conditions <= 1)).all())):
                raise ValueError("V22 requires one finite complete 23-channel condition")
            views = validate_bound_object_views(conditions[0], instance_table, order)
            ground = conditions.clone()
            ground[:, [order.index(role) for role in OBJECT_DEPENDENT_GROUND_CHANNELS]] = 0
            terrain_features, terrain_roles = self.terrain(ground)
            terrain_masks = {role: conditions[:, order.index(role):order.index(role) + 1]
                             for role in TERRAIN_ROLES}
            terrain_masks.update({role: torch.zeros_like(next(iter(terrain_masks.values())))
                                  for role in ROLES})
            zero_object = terrain_features.new_zeros(
                (1, OBJECT_FEATURE_CHANNELS, 192, 256))
            terrain_rgb = self.terrain_rgb_decoder(
                terrain_features, tuple(terrain_roles[role] for role in TERRAIN_ROLES),
                (zero_object,) * len(ROLES), terrain_masks)

            per_instance = []
            if views:
                terrain_patches = torch.stack([
                    _crop(terrain_features[0], view.top, view.left, PATCH_SIZE)[0]
                    for view in views])
                features = self.appearance(views, terrain_patches)
                for index, view in enumerate(views):
                    feature = features[index:index + 1]
                    footprint_feature = self.footprint_head(torch.cat(
                        (feature, view.subject_mask[None].to(feature.dtype)), dim=1))
                    footprint_feature = footprint_feature * view.subject_mask[None]
                    local = {}
                    for role, source, support in (
                        ("object_footprints", footprint_feature, view.subject_mask[None]),
                        (view.role, feature, view.support_mask[None]),
                    ):
                        local[role] = torch.tanh(self.instance_rgb_heads[role](
                            source.float())) * support.float()
                    per_instance.append({"instanceValue": view.instance_value,
                                         "role": view.role, "view": view,
                                         "localFeature": feature,
                                         "localRgbResiduals": local})

            def assemble(role):
                indices, pixels, supports = [], [], []
                for item in per_instance:
                    if role != "object_footprints" and item["role"] != role:
                        continue
                    view = item["view"]
                    mask = (view.subject_mask if role == "object_footprints"
                            else view.support_mask)
                    y0, y1 = max(0, view.top), min(192, view.top + PATCH_SIZE)
                    x0, x1 = max(0, view.left), min(256, view.left + PATCH_SIZE)
                    dy, dx = y0 - view.top, x0 - view.left
                    ys = torch.arange(y0, y1, device=conditions.device)
                    xs = torch.arange(x0, x1, device=conditions.device)
                    indices.append((ys[:, None] * 256 + xs[None, :]).reshape(-1))
                    pixels.append(item["localRgbResiduals"][role][0, :,
                        dy:dy + y1 - y0, dx:dx + x1 - x0].reshape(3, -1))
                    supports.append(mask[:, dy:dy + y1 - y0,
                                         dx:dx + x1 - x0].reshape(1, -1).float())
                base = terrain_rgb.new_zeros((3, 192 * 256), dtype=torch.float32)
                count = terrain_rgb.new_zeros((1, 192 * 256), dtype=torch.float32)
                if indices:
                    flat = torch.cat(indices)
                    base = base.index_add(1, flat, torch.cat(pixels, dim=1))
                    count = count.index_add(1, flat, torch.cat(supports, dim=1))
                return (base / count.clamp_min(1)).reshape(1, 3, 192, 256), \
                    count.reshape(1, 1, 192, 256)

            averaged, coverage = {}, {}
            for role in ROLES:
                averaged[role], coverage[role] = assemble(role)
            object_coverage = torch.zeros_like(coverage["object_footprints"], dtype=torch.bool)
            for role in TYPED_ROLES:
                object_coverage |= coverage[role] > 0
            visible = {"object_footprints":
                       conditions[:, order.index("object_footprints"):
                                  order.index("object_footprints") + 1] > .5}
            for role in TYPED_ROLES:
                core = conditions[:, order.index(role):order.index(role) + 1] > .5
                others = torch.zeros_like(core)
                for other in TYPED_ROLES:
                    if other != role:
                        others |= coverage[other] > 0
                visible[role] = core | ((coverage[role] > 0) & ~others)
                if not bool((~visible[role] | object_coverage).all()):
                    raise ValueError("V22 visible role escaped bound object coverage")
            residuals = {role: averaged[role] * visible[role].float()
                         for role in ROLES}
            total = sum(residuals.values())
            rgb = torch.sigmoid(torch.logit(terrain_rgb.float().clamp(1e-5, 1 - 1e-5)) + total)
            if not bool(torch.isfinite(rgb).all() and ((rgb >= 0) & (rgb <= 1)).all()):
                raise ValueError("V22 complete RGB invalid")
            if return_evidence:
                return rgb, {"terrainRgb": terrain_rgb,
                    "maskedObjectRgbResiduals": residuals,
                    "visibleObjectSupportMasks": visible,
                    "objectCoverage": object_coverage,
                    "roleCoverage": coverage,
                    "instanceRgbResiduals": tuple(per_instance),
                    "aggregationOrder": "per_instance_rgb_before_role_average_and_visibility",
                    "objectResidualSum": total}
            return rgb

    return Renderer()


def build_fresh_native_rgb_instance_first_v22_cpu(*, condition_channel_order):
    import torch
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(SEED)
        return build_native_rgb_instance_first_v22_cpu(
            condition_channel_order=condition_channel_order)

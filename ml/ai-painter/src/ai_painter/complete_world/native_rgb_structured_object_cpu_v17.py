from __future__ import annotations

"""Inactive CPU prototype: fact-placed features, full-frame learned RGB.

This is an architectural test, not a qualified trainer or visual capability.
It reads the existing 23-channel condition pack and bound instance table; it
does not read source RGB, a sprite library, or a historical checkpoint.
"""

from collections.abc import Mapping, Sequence

from ai_painter.complete_world.native_rgb_aperiodic_detail_renderer import (
    aperiodic_detail_basis, build_native_complete_rgb_aperiodic_detail_renderer,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (
    PATCH_SIZE, ROLE_BY_KIND, SUPPORT_RADIUS, _crop, iter_object_views,
)


OBJECT_KINDS = ("tree", "rock", "shrub", "grass_detail")
OBJECT_ROLES = ("object_tree", "object_rock", "object_vegetation")
OBJECT_FEATURE_CHANNELS = 8
TERRAIN_ROLES = ("terrain_path_ground", "terrain_water", "terrain_shoreline")
# These channels may change as a consequence of placing an object. They are
# intentionally unavailable to the ground network, preventing its global
# normalization from propagating one object's change across the entire map.
OBJECT_DEPENDENT_GROUND_CHANNELS = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
    "object_instance", "signed_distance_object_ground", "collision", "walkable",
)


def validate_bound_object_views(conditions, instance_table, order):
    """Return subject views only when their complete visible support fits."""
    import torch

    views = list(iter_object_views(conditions, instance_table, order))
    labels = (conditions[order.index("object_instance")] * 255).round().to(torch.int32)
    footprint_values = conditions[order.index("object_footprints")]
    footprint_mask = footprint_values > 0.5
    if not torch.equal(footprint_values, (labels > 0).to(footprint_values.dtype)):
        raise ValueError("authoritative footprint mask and instance labels differ")
    for role in OBJECT_ROLES:
        expected = torch.zeros_like(footprint_mask)
        for item in instance_table:
            if ROLE_BY_KIND[item["kind"]] == role:
                expected |= labels == item["value"]
        values = conditions[order.index(role)]
        if not torch.equal(values, expected.to(values.dtype)):
            raise ValueError(f"authoritative {role} mask and instance labels differ")
    for view in views:
        ys, xs = torch.where(labels == view.instance_value)
        if not bool(footprint_mask[ys, xs].all()):
            raise ValueError("object instance is absent from the authoritative footprint mask")
        radius = SUPPORT_RADIUS[view.role]
        if (view.top > max(0, int(ys.min()) - radius)
                or view.left > max(0, int(xs.min()) - radius)
                or view.top + PATCH_SIZE < min(192, int(ys.max()) + radius + 1)
                or view.left + PATCH_SIZE < min(256, int(xs.max()) + radius + 1)):
            raise ValueError("object support exceeds the learned local patch")
    return views


def build_native_rgb_structured_object_cpu_v17(
    *, condition_channel_order: Sequence[str], base_channels: int = 48,
    patch_channels: int = 32,
):
    import torch
    from torch import nn
    from torch.nn import functional as functional

    order = tuple(condition_channel_order)
    if (len(order) != 23 or len(set(order)) != 23
            or any(name not in order for name in (
                *OBJECT_DEPENDENT_GROUND_CHANNELS, *TERRAIN_ROLES,
                "coordinate_x", "coordinate_y"))):
        raise ValueError("structured object renderer requires the complete 23-channel contract")
    if patch_channels < 16 or patch_channels % 8:
        raise ValueError("object appearance width must be 8-aligned and >=16")
    template = build_native_complete_rgb_aperiodic_detail_renderer(
        condition_channel_order=order, base_channels=base_channels,
    )
    template_base_indices = template.base_condition_indices
    template_coordinate_indices = template.coordinate_indices
    template_scales = template.detail_scales
    backbone_blocks = {name: getattr(template, name) for name in (
        "base_stem", "down_1", "down_2", "bottleneck",
        "decode_3", "decode_2", "decode_1", "full_resolution_detail",
    )}
    del template
    blank_indices = tuple(order.index(name) for name in OBJECT_DEPENDENT_GROUND_CHANNELS)

    class TerrainFeatureBackbone(nn.Module):
        def __init__(self):
            super().__init__()
            self.base_indices = template_base_indices
            self.coordinate_indices = template_coordinate_indices
            self.scales = template_scales
            # New module owns newly initialized layers; no V16 weights or
            # completed RGB head enters this candidate.
            for name, block in backbone_blocks.items():
                setattr(self, name, block)
            self.responsibility_heads = nn.ModuleDict({role: nn.Sequential(
                nn.Conv2d(base_channels + 1, OBJECT_FEATURE_CHANNELS, 3, padding=1), nn.SiLU(),
                nn.Conv2d(OBJECT_FEATURE_CHANNELS, OBJECT_FEATURE_CHANNELS, 3, padding=1),
            ) for role in TERRAIN_ROLES})

        @staticmethod
        def _up(value, target):
            return functional.interpolate(value, size=target.shape[-2:],
                                          mode="bilinear", align_corners=False)

        def forward(self, conditions):
            detail = aperiodic_detail_basis(
                conditions, self.coordinate_indices, self.scales)
            base_input = torch.cat((conditions[:, self.base_indices], detail), dim=1)
            level_1 = self.base_stem(base_input)
            level_2 = self.down_1(functional.avg_pool2d(level_1, 2))
            level_3 = self.down_2(functional.avg_pool2d(level_2, 2))
            center = self.bottleneck(functional.avg_pool2d(level_3, 2))
            decoded_3 = self.decode_3(torch.cat((self._up(center, level_3), level_3), dim=1))
            decoded_2 = self.decode_2(torch.cat((self._up(decoded_3, level_2), level_2), dim=1))
            decoded_1 = self.decode_1(torch.cat((self._up(decoded_2, level_1), level_1), dim=1))
            features = self.full_resolution_detail(torch.cat((decoded_1, detail), dim=1))
            responsibilities = {}
            for role in TERRAIN_ROLES:
                mask = conditions[:, order.index(role):order.index(role) + 1]
                responsibilities[role] = self.responsibility_heads[role](
                    torch.cat((features, mask), dim=1)) * mask
            return features, responsibilities

    class LearnedObjectSemantics(nn.Module):
        def __init__(self):
            super().__init__()
            # 23 local facts, support, local XY, terrain features, four kind bits.
            self.layers = nn.Sequential(
                nn.Conv2d(30 + base_channels, patch_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(patch_channels, patch_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(patch_channels, OBJECT_FEATURE_CHANNELS, 1),
            )

        def forward(self, views, terrain_patches):
            if (not views or terrain_patches.shape
                    != (len(views), base_channels, PATCH_SIZE, PATCH_SIZE)):
                raise ValueError("object appearance batch does not match bound views")
            axis = torch.linspace(-1, 1, PATCH_SIZE, device=terrain_patches.device,
                                  dtype=terrain_patches.dtype)
            yy, xx = torch.meshgrid(axis, axis, indexing="ij")
            local_xy = torch.stack((xx, yy))[None].expand(len(views), -1, -1, -1)
            kinds = terrain_patches.new_tensor([
                [float(view.kind == kind) for kind in OBJECT_KINDS]
                for view in views
            ])[:, :, None, None].expand(-1, -1, PATCH_SIZE, PATCH_SIZE)
            support = torch.stack([view.support_mask for view in views])
            features = torch.cat((
                torch.stack([view.subject_conditions for view in views]),
                support, local_xy, terrain_patches, kinds,
            ), dim=1)
            return torch.tanh(self.layers(features)) * support

    class FullFrameRgbDecoder(nn.Module):
        """Only this full-canvas learned network produces final RGB pixels."""

        def __init__(self):
            super().__init__()
            input_channels = base_channels + 7 * OBJECT_FEATURE_CHANNELS
            self.layers = nn.Sequential(
                nn.Conv2d(input_channels + 7, base_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(base_channels, base_channels, 3, padding=1), nn.SiLU(),
                nn.Conv2d(base_channels, 3, 1),
            )

        def forward(self, terrain_features, terrain_roles, object_roles,
                    responsibility_conditions):
            identities = (*TERRAIN_ROLES, "object_footprints", *OBJECT_ROLES)
            if (terrain_features.shape != (1, base_channels, 192, 256)
                    or len(terrain_roles) != 3 or len(object_roles) != 4
                    or not isinstance(responsibility_conditions, Mapping)
                    or set(responsibility_conditions) != set(identities)
                    or any(value.shape != (1, OBJECT_FEATURE_CHANNELS, 192, 256)
                           for value in (*terrain_roles, *object_roles))
                    or any(responsibility_conditions[role].shape != (1, 1, 192, 256)
                           for role in identities)):
                raise ValueError("full-frame decoder responsibilities are incomplete")
            inputs = torch.cat((terrain_features.float(),
                                *(value.float() for value in terrain_roles),
                                *(value.float() for value in object_roles),
                                *(responsibility_conditions[role].float()
                                  for role in identities)), dim=1)
            return torch.sigmoid(self.layers(inputs))

    class StructuredObjectRenderer(nn.Module):
        architecture_id = "stage4_native_rgb_structured_object_cpu_v17"
        responsibility_implementation_mode = "declared_shared_substrate"
        execution_qualified = False

        def __init__(self):
            super().__init__()
            self.terrain = TerrainFeatureBackbone()
            self.appearance = LearnedObjectSemantics()
            self.footprint_head = nn.Conv2d(
                OBJECT_FEATURE_CHANNELS + 1, OBJECT_FEATURE_CHANNELS, 1)
            self.final_rgb_decoder = FullFrameRgbDecoder()
            self.condition_channel_order = order

        def forward(self, conditions, instance_table: Sequence[Mapping],
                    *, return_evidence=False):
            if not isinstance(conditions, torch.Tensor) or conditions.shape != (1, 23, 192, 256):
                raise ValueError("structured object renderer requires one 256x192 condition")
            # Validate the full bound table before any neural inference.
            views = validate_bound_object_views(conditions[0], instance_table, order)
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
                    _crop(terrain_features[0], view.top, view.left, PATCH_SIZE)[0]
                    for view in views
                ])
                subject_features = self.appearance(views, patches)
                for index, view in enumerate(views):
                    y0, y1 = max(0, view.top), min(192, view.top + PATCH_SIZE)
                    x0, x1 = max(0, view.left), min(256, view.left + PATCH_SIZE)
                    dy, dx = y0 - view.top, x0 - view.left
                    ys = torch.arange(y0, y1, device=conditions.device)
                    xs = torch.arange(x0, x1, device=conditions.device)
                    indices.append((ys[:, None] * 256 + xs[None, :]).reshape(-1))
                    features.append(subject_features[index, :, dy:dy + y1-y0,
                                                     dx:dx + x1-x0].reshape(
                        OBJECT_FEATURE_CHANNELS, -1).float())
                    supports.append(view.support_mask[:, dy:dy + y1-y0,
                                                      dx:dx + x1-x0].reshape(1, -1).float())

            def assemble(selection):
                selected_indices = (torch.cat([indices[i] for i in selection]) if selection
                                    else torch.empty(0, dtype=torch.long, device=conditions.device))
                summed = terrain_features.new_zeros(
                    (OBJECT_FEATURE_CHANNELS, 192 * 256), dtype=torch.float32).index_add(
                    1, selected_indices,
                    torch.cat([features[i] for i in selection], dim=1) if selection
                    else terrain_features.new_zeros(
                        (OBJECT_FEATURE_CHANNELS, 0), dtype=torch.float32))
                count = terrain_features.new_zeros(
                    (1, 192 * 256), dtype=torch.float32).index_add(
                    1, selected_indices,
                    torch.cat([supports[i] for i in selection], dim=1) if selection
                    else terrain_features.new_zeros((1, 0), dtype=torch.float32))
                return (summed / count.clamp_min(1)).reshape(
                    1, OBJECT_FEATURE_CHANNELS, 192, 256), count.reshape(1, 1, 192, 256)

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

    return StructuredObjectRenderer()

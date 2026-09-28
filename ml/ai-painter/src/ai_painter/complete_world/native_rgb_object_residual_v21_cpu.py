"""Inactive V21 CPU architecture: fresh local object RGB residual heads.

Only frozen WorldFacts/23-channel conditions and the bound object table are
inference inputs. No source RGB, sprite, historical weight or external model is
used by this renderer. Loss, review and checkpoint policy remain V18-shaped.
"""
from __future__ import annotations

from collections.abc import Sequence
from ai_painter.complete_world.object_instance_supervision_cpu import SUPPORT_RADIUS


CAPABILITY = "stage4_mvp_native_rgb_object_residual_v21_support_trial"
ARCHITECTURE = "stage4_native_rgb_terrain_plus_bound_support_object_residual_v21"
SEED = 20260929
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
TYPED_ROLES = ROLES[1:]
BASE_CHANNELS = 48
PATCH_CHANNELS = 32
MAX_EXTRA_PARAMETERS = 16_384
MAX_TOTAL_PARAMETER_BYTES = 16 * 1024 * 1024


def build_native_rgb_object_residual_v21_cpu(*, condition_channel_order: Sequence[str],
                                              base_channels=BASE_CHANNELS,
                                              patch_channels=PATCH_CHANNELS):
    import torch
    from torch import nn
    from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
        build_native_rgb_structured_object_v18_cpu,
    )
    order = tuple(condition_channel_order)
    if (len(order) != 23 or len(set(order)) != 23 or
            any(role not in order for role in ROLES)):
        raise ValueError("V21 requires complete 23-channel object contract")
    core = build_native_rgb_structured_object_v18_cpu(
        condition_channel_order=order, base_channels=base_channels,
        patch_channels=patch_channels)

    class TerrainOnlyDecoder(nn.Module):
        """Reuse fresh V18 decoder weights, omitting its old object RGB route."""
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
        responsibility_implementation_mode = "explicit_masked_role_rgb_residuals"

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
            residuals = {}
            total = torch.zeros_like(terrain_rgb)
            object_support = source["objectCoverage"] > 0
            visible_masks = {}
            for role in TYPED_ROLES:
                # V18's bound object views derive these exact local supports from
                # SUPPORT_RADIUS (tree=8, rock=4, vegetation=6). The role core
                # stays owned even when another class's ring crosses it; rings
                # shared by two classes are omitted rather than mixed.
                if role not in SUPPORT_RADIUS:
                    raise ValueError("unknown typed object support radius")
                coverage = source["roleCoverage"][role] > 0
                core_mask = source["responsibilityConditions"][role] > .5
                if not bool((~core_mask | coverage).all() and (~coverage | object_support).all()):
                    raise ValueError("role support escaped bound object coverage")
                other_coverage = torch.zeros_like(coverage)
                for other in TYPED_ROLES:
                    if other != role:
                        other_coverage |= source["roleCoverage"][other] > 0
                visible_masks[role] = core_mask | (coverage & ~other_coverage)
            visible_masks["object_footprints"] = (
                source["responsibilityConditions"]["object_footprints"] > .5)
            for role in ROLES:
                mask = visible_masks[role]
                feature = source["responsibilityFeatures"][role]
                residual = torch.tanh(self.object_rgb_heads[role](feature.float())) * mask.float()
                residuals[role] = residual
                total = total + residual
            rgb = torch.sigmoid(torch.logit(terrain_rgb.float().clamp(1e-5, 1 - 1e-5)) + total)
            if not bool(torch.isfinite(rgb).all()):
                raise ValueError("nonfinite V21 complete RGB")
            if return_evidence:
                return rgb, {**source, "terrainRgb": terrain_rgb,
                             "maskedObjectRgbResiduals": residuals,
                             "visibleObjectSupportMasks": visible_masks,
                             "objectResidualSum": total}
            return rgb

    return Renderer()


def build_fresh_native_rgb_object_residual_v21_cpu(*, condition_channel_order):
    import torch
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(SEED)
        return build_native_rgb_object_residual_v21_cpu(
            condition_channel_order=condition_channel_order)

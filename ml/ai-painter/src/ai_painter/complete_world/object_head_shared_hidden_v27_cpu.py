"""Inactive V27: one hidden block, four RGB adapters, full V23 context.

The eight input slots retain the existing learned feature order, not eight
named physical semantics. Typed features share V17's appearance output basis;
footprints retain V17's learned 9->8 projection. Sharing changes their coupling.
No historical state, optimizer, admission or publication is exposed here.
"""
from __future__ import annotations

import torch
from torch import nn
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    ROLES, OWNERSHIP_RULE, SEED, complete_typed_support_partition,
    build_fresh_native_rgb_complete_support_partition_v23_cpu,
)
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
    AGGREGATION_RULE, DeterministicObjectAssemblyRenderer,
)

CAPABILITY = "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_candidate"
ARCHITECTURE = "stage4_native_rgb_complete_support_shared_hidden_v27"
CONTEXT_RULE = "full_v23_terrain_context_private_global_xy_zero_v1"
SHARING_RULE = "one_registered_hidden_four_independent_rgb_adapters_v1"
FEATURE_RULE = "unchanged_eight_learned_slots_typed_appearance_and_footprint_projection_v1"


class SharedHiddenRenderer(nn.Module):
    architecture_id = ARCHITECTURE
    capability_version = CAPABILITY
    execution_qualified = False
    parent_checkpoint_loaded = False
    responsibility_implementation_mode = "declared_shared_substrate"
    support_ownership_rule = OWNERSHIP_RULE
    object_aggregation_rule = AGGREGATION_RULE
    object_context_rule = CONTEXT_RULE
    object_sharing_rule = SHARING_RULE
    object_feature_rule = FEATURE_RULE

    def __init__(self, baseline):
        super().__init__()
        self.core = baseline.core
        self.core.core = DeterministicObjectAssemblyRenderer(self.core.core)
        self.condition_channel_order = baseline.condition_channel_order
        # Transfer fresh modules, constructing no new randomly initialized layer.
        first = baseline.object_rgb_heads[ROLES[0]]
        self.object_shared_hidden = nn.Sequential(first[0], first[1])
        self.object_rgb_adapters = nn.ModuleDict({
            role: baseline.object_rgb_heads[role][2] for role in ROLES})

    def forward(self, conditions, instance_table, *, return_evidence=False):
        terrain_rgb, source = self.core(conditions, instance_table, return_evidence=True)
        typed_owned, distances = complete_typed_support_partition(
            source["responsibilityConditions"], source["roleCoverage"])
        masks = dict(typed_owned)
        masks[ROLES[0]] = source["responsibilityConditions"][ROLES[0]] > .5
        residuals = {}
        total = torch.zeros_like(terrain_rgb)
        for role in ROLES:
            feature = source["responsibilityFeatures"][role]
            if feature.shape != (1, 8, 192, 256):
                raise ValueError("unchanged complete eight-slot features required: " + role)
            residual = torch.tanh(self.object_rgb_adapters[role](
                self.object_shared_hidden(feature.float()))) * masks[role].float()
            residuals[role] = residual
            total = total + residual
        rgb = torch.sigmoid(torch.logit(terrain_rgb.float().clamp(1e-5, 1-1e-5)) + total)
        if not bool(torch.isfinite(rgb).all()):
            raise ValueError("nonfinite V27 complete RGB")
        if return_evidence:
            return rgb, {**source, "terrainRgb": terrain_rgb,
                "maskedObjectRgbResiduals": residuals,
                "visibleObjectSupportMasks": masks, "typedSupportOwnerMasks": typed_owned,
                "typedSupportDistancePixels": distances, "supportOwnershipRule": OWNERSHIP_RULE,
                "objectResidualSum": total, "objectSharingRule": SHARING_RULE,
                "objectFeatureRule": FEATURE_RULE}
        return rgb


def build_fresh_object_head_shared_hidden_v27_cpu(*, condition_channel_order):
    # V23's fork restores caller RNG exactly; transfers consume no additional RNG.
    return SharedHiddenRenderer(build_fresh_native_rgb_complete_support_partition_v23_cpu(
        condition_channel_order=condition_channel_order))

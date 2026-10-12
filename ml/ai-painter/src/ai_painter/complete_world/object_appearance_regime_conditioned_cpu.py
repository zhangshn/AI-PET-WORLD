"""Inactive fresh CPU candidate: zero seasonal branch before first activation."""
from __future__ import annotations
from contextvars import ContextVar
import hashlib
import torch
from torch import nn
from ai_painter.complete_world.object_appearance_regime_input_cpu import validate_regime, require
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    build_fresh_native_rgb_complete_support_partition_v23_cpu, ROLES, SEED, OWNERSHIP_RULE)
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
    DeterministicObjectAssemblyRenderer, AGGREGATION_RULE)

CAPABILITY = "stage4_object_appearance_regime_cpu_candidate_v1"
ARCHITECTURE = "fresh_v23_four_heads_zero_season_branch_4x32x3x3_v1"
_REGIME = ContextVar("object_appearance_regime_cpu", default=None)

class SeasonalFirstConv(nn.Conv2d):
    def __init__(self, original):
        require(isinstance(original, nn.Conv2d) and original.weight.shape == (32, 78, 3, 3), "fresh first conv differs")
        with torch.random.fork_rng(devices=[]):
            super().__init__(78, 32, 3, padding=1)
            self.weight, self.bias = original.weight, original.bias
            self.season_branch = nn.Conv2d(4, 32, 3, padding=1, bias=False)
            nn.init.zeros_(self.season_branch.weight)

    def forward(self, features):
        code = validate_regime(_REGIME.get())
        broadcast = code[None, :, None, None].expand(features.shape[0], -1, features.shape[2], features.shape[3])
        return super().forward(features) + self.season_branch(broadcast)

class RegimeRenderer(nn.Module):
    architecture_id = ARCHITECTURE
    capability_version = CAPABILITY
    execution_qualified = False
    parent_checkpoint_loaded = False
    support_ownership_rule = OWNERSHIP_RULE
    object_aggregation_rule = AGGREGATION_RULE

    def __init__(self, baseline):
        super().__init__()
        self.core, self.object_rgb_heads = baseline.core, baseline.object_rgb_heads
        self.condition_channel_order = baseline.condition_channel_order
        self._parent_forward = type(baseline).forward
        self.core.core = DeterministicObjectAssemblyRenderer(self.core.core)
        layers = self.core.core.appearance.base.layers
        layers[0] = SeasonalFirstConv(layers[0])
        self.register_buffer("regime_identity", torch.tensor(list(hashlib.sha256(ARCHITECTURE.encode()).digest()), dtype=torch.uint8))

    def forward(self, conditions, instance_table, *, appearance_regime, return_evidence=False):
        code = validate_regime(appearance_regime)
        token = _REGIME.set(code)
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            _REGIME.reset(token)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        require(strict is True and set(state_dict) == set(self.state_dict())
                and torch.equal(state_dict.get("regime_identity"), self.regime_identity), "old or incomplete candidate state rejected")
        return super().load_state_dict(state_dict, strict=True, assign=assign)

def build_fresh_object_appearance_regime_conditioned_cpu(*, condition_channel_order):
    with torch.random.fork_rng(devices=[]):
        baseline = build_fresh_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=condition_channel_order)
        model = RegimeRenderer(baseline)
    require(not torch.cuda.is_initialized(), "CPU candidate cannot inherit initialized CUDA")
    return model

def seasonal_parameter(model):
    require(getattr(model, "architecture_id", None) == ARCHITECTURE
        and getattr(model, "capability_version", None) == CAPABILITY, "old model identity rejected")
    parameter = model.core.core.appearance.base.layers[0].season_branch.weight
    require(parameter.shape == (32, 4, 3, 3) and parameter.numel() == 1152, "seasonal graph differs")
    return parameter

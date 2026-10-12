"""Fresh CPU-only ecological prototype; no training or production routing."""
from __future__ import annotations

from contextvars import ContextVar
from copy import copy
import hashlib
import torch
from torch import nn

from ai_painter.complete_world import object_appearance_regime_detail_weight_precision as predecessor
from ai_painter.complete_world import object_appearance_regime_bias_precision as seasonal
from ai_painter.complete_world.object_ecology_regime_input_cpu import (
    ECOLOGIES, require, validate_ecology, validate_regime,
)

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_cpu_prototype_v1"
ARCHITECTURE = "fresh_detail_precision_four_heads_independent_season_ecology_zero_v1"
NUMERIC_RULE = predecessor.NUMERIC_RULE
TARGET = "core.core.appearance.base.layers.0"
ECOLOGY_PARAMETER = TARGET + ".ecology_branch.weight"
_ECOLOGY = ContextVar("private_object_ecology_cpu_v1", default=None)


def identity_bytes(kind):
    require(kind in ("regime", "numeric", "ecology"), "unknown identity kind")
    if kind == "regime":
        return predecessor.identity_bytes("regime")
    text = "|".join((kind, CAPABILITY, ARCHITECTURE, NUMERIC_RULE, *ECOLOGIES))
    return torch.tensor(list(hashlib.sha256(text.encode()).digest()), dtype=torch.uint8, device="cpu")


class EcologyFirstConv(nn.Conv2d):
    def __init__(self, original):
        require(type(original) is seasonal.SeasonalFirstConv
                and tuple(original.weight.shape) == (32, 78, 3, 3), "prototype first convolution differs")
        with torch.device("cpu"), torch.random.fork_rng(devices=[]):
            super().__init__(78, 32, 3, padding=1, device="cpu", dtype=torch.float32)
            self.weight, self.bias = original.weight, original.bias
            self.season_branch = original.season_branch
            self.ecology_branch = nn.Conv2d(7, 32, 3, padding=1, bias=False,
                                            device="cpu", dtype=torch.float32)
            nn.init.zeros_(self.ecology_branch.weight)
        self.train(original.training)

    def forward(self, features):
        season = validate_regime(seasonal._REGIME.get())
        ecology = validate_ecology(_ECOLOGY.get())
        shape = (features.shape[0], -1, features.shape[2], features.shape[3])
        return (super().forward(features)
                + self.season_branch(season[None, :, None, None].expand(*shape))
                + self.ecology_branch(ecology[None, :, None, None].expand(*shape)))


def _fork_appearance(module, path):
    if not path:
        return EcologyFirstConv(module)
    result = copy(module)
    for attribute in ("_modules", "_parameters", "_buffers", "_forward_hooks",
                      "_forward_pre_hooks", "_backward_hooks", "_backward_pre_hooks"):
        setattr(result, attribute, getattr(module, attribute).copy())
    result._non_persistent_buffers_set = module._non_persistent_buffers_set.copy()
    key = path[0]
    result._modules[key] = _fork_appearance(module._modules[key], path[1:])
    return result


class EcologyRegimePrototypeRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_qualified = False
    parent_checkpoint_loaded = False
    support_ownership_rule = predecessor.old.OWNERSHIP_RULE
    object_aggregation_rule = predecessor.old.AGGREGATION_RULE

    def __init__(self, fresh):
        super().__init__()
        predecessor.validate_model_identity(fresh)
        require(next(fresh.parameters()).device.type == "cpu", "prototype construction must stay CPU")
        before = tuple(fresh.named_parameters(remove_duplicate=False))
        self.core = _fork_appearance(fresh.core, ("core", "appearance", "base", "layers", "0"))
        self.object_rgb_heads = fresh.object_rgb_heads
        self.condition_channel_order = fresh.condition_channel_order
        self._parent_forward = fresh._parent_forward
        for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"),
                           ("ecology_identity", "ecology")):
            self.register_buffer(name, identity_bytes(kind))
        after = tuple(self.named_parameters(remove_duplicate=False))
        retained = tuple((name, p) for name, p in after if name != ECOLOGY_PARAMETER)
        require(len(retained) == len(before) and all(n == m and p is q
                for (n, p), (m, q) in zip(before, retained)), "prototype changed original parameter identity/order")
        self._canonical = tuple((name, tuple(p.shape)) for name, p in after)
        self.training = fresh.training

    def forward(self, conditions, instance_table, *, appearance_regime, ecology_regime,
                return_evidence=False):
        validate_model_identity(self)
        require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"),
                "prototype autocast prohibited")
        require(type(conditions) is torch.Tensor and conditions.device.type == "cpu"
                and conditions.dtype == torch.float32, "prototype conditions CPU FP32 required")
        season = validate_regime(appearance_regime)
        ecology = validate_ecology(ecology_regime)
        season_token = seasonal._REGIME.set(season)
        ecology_token = _ECOLOGY.set(ecology)
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            _ECOLOGY.reset(ecology_token)
            seasonal._REGIME.reset(season_token)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        expected = self.state_dict()
        require(strict is True and assign is False and tuple(state_dict) == tuple(expected),
                "old/incomplete/non-strict prototype state rejected")
        for key, value in state_dict.items():
            require(type(value) is torch.Tensor and value.device.type == "cpu"
                    and value.shape == expected[key].shape and value.dtype == expected[key].dtype
                    and value.layout == torch.strided and value.is_contiguous()
                    and bool(torch.isfinite(value).all()), "prototype state tensor differs: " + key)
        for key, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"),
                           ("ecology_identity", "ecology")):
            require(torch.equal(state_dict[key], identity_bytes(kind)), "old/wrong prototype state identity rejected")
        saved = {key: value.detach().clone() for key, value in expected.items()}
        verified = {key: value.detach().clone() for key, value in state_dict.items()}
        try:
            result = nn.Module.load_state_dict(self, verified, strict=True, assign=False)
            validate_model_identity(self)
            installed = self.state_dict()
            require(tuple(installed) == tuple(verified)
                    and all(torch.equal(installed[key].reshape(-1).view(torch.uint8),
                                        value.reshape(-1).view(torch.uint8))
                            for key, value in verified.items()), "prototype installed state bytes differ")
            return result
        except BaseException:
            # Restore original storage directly; a failing load hook must not
            # be invoked again while recovering the pre-load state.
            with torch.no_grad():
                for key, value in expected.items():
                    value.copy_(saved[key])
            raise


def validate_model_identity(model):
    require(type(model) is EcologyRegimePrototypeRenderer and model.capability_version == CAPABILITY
            and model.architecture_id == ARCHITECTURE and model.numeric_rule == NUMERIC_RULE,
            "ecology prototype identity differs")
    named = tuple(model.named_parameters(remove_duplicate=False))
    parameters = tuple(model.parameters())
    require(tuple((name, tuple(p.shape)) for name, p in named) == model._canonical
            and len(named) == len(parameters) == 108
            and sum(p.numel() for p in parameters) == 2242687
            and len({id(p) for _, p in named}) == 108
            and len({p.untyped_storage().data_ptr() for p in parameters}) == 108
            and all(p.device.type == "cpu" and p.dtype == torch.float32
                    and p.layout == torch.strided and p.is_contiguous()
                    and bool(torch.isfinite(p.detach()).all()) for p in parameters),
            "prototype graph/finite/device/alias differs")
    for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric"),
                       ("ecology_identity", "ecology")):
        value = getattr(model, name, None)
        require(type(value) is torch.Tensor and value.device.type == "cpu" and value.dtype == torch.uint8
                and value.shape == (32,) and torch.equal(value, identity_bytes(kind)),
                "prototype identity buffer differs")
    require(type(model.get_submodule(TARGET)) is EcologyFirstConv
            and type(model.get_submodule(predecessor.TARGET)) is predecessor.PrecisionDetailWeightConv
            and type(model.get_submodule(seasonal.TARGET)) is seasonal.PrecisionFinalRGBConv,
            "prototype numerical operators differ")
    require(torch.get_num_threads() <= 2, "prototype CPU thread budget exceeded")
    return model


def build_fresh_object_ecology_regime_prototype_cpu(*, condition_channel_order):
    require(torch.get_num_threads() <= 2, "prototype CPU construction thread budget exceeded")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        fresh = predecessor.build_fresh_object_appearance_regime_detail_weight_precision(
            condition_channel_order=condition_channel_order)
        model = EcologyRegimePrototypeRenderer(fresh)
    return validate_model_identity(model)


def ecological_parameter(model):
    validate_model_identity(model)
    value = model.get_submodule(TARGET).ecology_branch.weight
    require(value.shape == (32, 7, 3, 3) and value.numel() == 2016, "prototype ecological graph differs")
    return value


def seasonal_parameter(model):
    validate_model_identity(model)
    value = model.get_submodule(TARGET).season_branch.weight
    require(value.shape == (32, 4, 3, 3) and value.numel() == 1152, "prototype seasonal graph differs")
    return value

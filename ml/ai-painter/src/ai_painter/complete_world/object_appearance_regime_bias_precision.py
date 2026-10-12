"""Explicit CPU-constructed device successor. No default or registry routing."""
from __future__ import annotations
from contextvars import ContextVar
import hashlib
import torch
from torch import nn
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    build_native_rgb_complete_support_partition_v23_cpu, SEED, OWNERSHIP_RULE)
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
    DeterministicObjectAssemblyRenderer, AGGREGATION_RULE)
from ai_painter.complete_world.object_appearance_regime_input_cpu import require, validate_regime
from ai_painter.complete_world.rgb_bias_reduction_precision import rgb_bias_reduction_precision, NUMERIC_RULE

CAPABILITY = "stage4_mvp256_dry_appearance_regime_bias_precision_v1"
ARCHITECTURE = "fresh_v23_four_heads_zero_season_branch_rgb_bias_fp64_device_v1"
TARGET = "core.core.final_rgb_decoder.base.layers.4"
_REGIME = ContextVar("object_appearance_regime_device_v1", default=None)


def identity_bytes(kind):
    text = ARCHITECTURE if kind == "regime" else "|".join((CAPABILITY, ARCHITECTURE, NUMERIC_RULE))
    return torch.tensor(list(hashlib.sha256(text.encode()).digest()), dtype=torch.uint8, device="cpu")


class SeasonalFirstConv(nn.Conv2d):
    def __init__(self, original):
        require(type(original) is nn.Conv2d and original.weight.shape == (32, 78, 3, 3), "fresh first conv differs")
        with torch.random.fork_rng(devices=[]):
            super().__init__(78, 32, 3, padding=1, device="cpu", dtype=torch.float32)
            self.weight, self.bias = original.weight, original.bias
            self.season_branch = nn.Conv2d(4, 32, 3, padding=1, bias=False, device="cpu", dtype=torch.float32)
            nn.init.zeros_(self.season_branch.weight)

    def forward(self, features):
        code = validate_regime(_REGIME.get()).to(device=features.device, dtype=torch.float32)
        broadcast = code[None, :, None, None].expand(features.shape[0], -1, features.shape[2], features.shape[3])
        return super().forward(features) + self.season_branch(broadcast)


class PrecisionFinalRGBConv(nn.Conv2d):
    def __init__(self, original):
        require(type(original) is nn.Conv2d and original.weight.shape == (3, 48, 1, 1)
            and original.bias is not None and original.stride == (1, 1) and original.padding == (0, 0)
            and original.dilation == (1, 1) and original.groups == 1 and original.padding_mode == "zeros", "RGB convolution differs")
        with torch.random.fork_rng(devices=[]):
            super().__init__(48, 3, 1, device="cpu", dtype=torch.float32)
        self.weight, self.bias = original.weight, original.bias
        self.train(original.training)

    def forward(self, features):
        return rgb_bias_reduction_precision(features, self.weight, self.bias)


class BiasPrecisionRegimeRenderer(nn.Module):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
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
        rgb_layers = self.core.core.final_rgb_decoder.base.layers
        rgb_layers[4] = PrecisionFinalRGBConv(rgb_layers[4])
        self.register_buffer("regime_identity", identity_bytes("regime"))
        self.register_buffer("numeric_identity", identity_bytes("numeric"))

    def forward(self, conditions, instance_table, *, appearance_regime, return_evidence=False):
        validate_model_identity(self)
        require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "generator autocast prohibited")
        device = next(self.parameters()).device
        require(isinstance(conditions, torch.Tensor) and conditions.device == device
            and conditions.dtype == torch.float32, "conditions FP32/device differs")
        if device.type == "cuda":
            require(torch.backends.cuda.matmul.fp32_precision == "ieee"
                and torch.backends.cudnn.conv.fp32_precision == "ieee", "generator CUDA IEEE FP32 required")
        token = _REGIME.set(validate_regime(appearance_regime))
        try:
            return self._parent_forward(self, conditions, instance_table, return_evidence=return_evidence)
        finally:
            _REGIME.reset(token)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        validate_model_identity(self)
        require(next(self.parameters()).device.type == "cpu", "load state must precede device migration")
        expected = self.state_dict()
        require(strict is True and assign is False and set(state_dict) == set(expected), "old/incomplete/non-strict state rejected")
        for key, value in state_dict.items():
            require(isinstance(value, torch.Tensor) and value.device.type == "cpu" and value.shape == expected[key].shape
                and value.dtype == expected[key].dtype and value.layout == torch.strided
                and bool(torch.isfinite(value).all()), "state tensor differs: " + key)
        for key, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric")):
            require(torch.equal(state_dict[key], identity_bytes(kind)), "old/wrong state identity rejected")
        return nn.Module.load_state_dict(self, state_dict, strict=True, assign=False)


def validate_model_identity(model):
    require(type(model) is BiasPrecisionRegimeRenderer and model.capability_version == CAPABILITY
        and model.architecture_id == ARCHITECTURE and model.numeric_rule == NUMERIC_RULE, "device successor identity differs")
    parameters = tuple(model.parameters())
    require(len(parameters) == 107 and sum(p.numel() for p in parameters) == 2240671
        and len({p.device for p in parameters}) == 1 and all(p.dtype == torch.float32 for p in parameters), "device successor graph differs")
    device = parameters[0].device
    require(device.type in ("cpu", "cuda"), "unsupported model device")
    for name, kind in (("regime_identity", "regime"), ("numeric_identity", "numeric")):
        value = getattr(model, name, None)
        require(isinstance(value, torch.Tensor) and value.device == device and value.dtype == torch.uint8
            and value.shape == (32,) and torch.equal(value.detach().cpu(), identity_bytes(kind)), "successor identity buffer differs")
    require(type(model.get_submodule(TARGET)) is PrecisionFinalRGBConv
        and type(model.core.core.appearance.base.layers[0]) is SeasonalFirstConv, "successor implementation differs")
    if device.type == "cpu":
        require(torch.get_num_threads() <= 2, "CPU thread budget exceeded")
    return model


def build_fresh_object_appearance_regime_bias_precision(*, condition_channel_order):
    # Managed callers may have initialized CUDA before requesting fresh CPU
    # parameters. This factory neither queries devices nor initializes CUDA.
    require(torch.get_num_threads() <= 2, "fresh CPU construction thread boundary")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        # torch.manual_seed also seeds initialized CUDA generators. Use the
        # original seed on the CPU generator alone and the same V23 builder.
        torch.random.default_generator.manual_seed(SEED)
        baseline = build_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=condition_channel_order)
        model = BiasPrecisionRegimeRenderer(baseline)
    return validate_model_identity(model)


def seasonal_parameter(model):
    validate_model_identity(model)
    value = model.core.core.appearance.base.layers[0].season_branch.weight
    require(value.shape == (32, 4, 3, 3) and value.numel() == 1152, "seasonal graph differs")
    return value


def parameter_initialization_digest(model):
    digest = hashlib.sha256()
    for name, value in model.named_parameters():
        digest.update(name.encode()); digest.update(str(value.shape).encode()); digest.update(str(value.dtype).encode())
        digest.update(value.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()

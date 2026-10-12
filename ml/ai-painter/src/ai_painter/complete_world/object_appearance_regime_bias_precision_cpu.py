"""Inactive versioned seasonal CPU successor; no production/default routing.

The fresh V23 parameters and seasonal branch initialization are retained.
Only the final RGB bias VJP accumulation precision and identity buffers differ.
"""
from __future__ import annotations
import hashlib
import torch
from torch import nn
from ai_painter.complete_world.object_appearance_regime_conditioned_cpu import RegimeRenderer
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import build_fresh_native_rgb_complete_support_partition_v23_cpu
from ai_painter.complete_world.object_appearance_regime_input_cpu import require
from ai_painter.complete_world.rgb_bias_reduction_precision_cpu import rgb_bias_reduction_precision_cpu

CAPABILITY = "stage4_object_appearance_regime_bias_precision_cpu_candidate_v1"
ARCHITECTURE = "fresh_v23_four_heads_zero_season_branch_rgb_bias_fp64_v1"
NUMERIC_RULE = "cpu_fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_v1"
OPERATOR_SHA256 = "958ece1e2bd967d9c0b7f9f99f183d2b496c6b23bb767702816aeed89c8c2cab"
TARGET = "core.core.final_rgb_decoder.base.layers.4"


def identity_bytes(kind):
    text = ARCHITECTURE if kind == "regime" else "|".join((CAPABILITY,ARCHITECTURE,NUMERIC_RULE,OPERATOR_SHA256))
    return torch.tensor(list(hashlib.sha256(text.encode()).digest()),dtype=torch.uint8,device="cpu")


class PrecisionFinalRGBConv(nn.Conv2d):
    def __init__(self, original):
        require(type(original) is nn.Conv2d and original.weight.shape == (3,48,1,1)
                and original.bias is not None and original.stride == (1,1) and original.padding == (0,0)
                and original.dilation == (1,1) and original.groups == 1 and original.padding_mode == "zeros", "original RGB convolution differs")
        with torch.random.fork_rng(devices=[]): super().__init__(48,3,1,bias=True,device="cpu",dtype=torch.float32)
        self.weight,self.bias = original.weight,original.bias
        self.train(original.training)
    def forward(self,features): return rgb_bias_reduction_precision_cpu(features,self.weight,self.bias)


class BiasPrecisionRegimeRenderer(RegimeRenderer):
    capability_version = CAPABILITY
    architecture_id = ARCHITECTURE
    numeric_rule = NUMERIC_RULE
    execution_qualified = False

    def __init__(self, baseline):
        super().__init__(baseline)
        # This is an explicit successor construction path, not a diagnostic
        # replacement of an already-built predecessor or a default factory edit.
        layers = self.core.core.final_rgb_decoder.base.layers
        layers[4] = PrecisionFinalRGBConv(layers[4])
        self.regime_identity.copy_(identity_bytes("regime"))
        self.register_buffer("numeric_identity",identity_bytes("numeric"))

    def forward(self,conditions,instance_table,*,appearance_regime,return_evidence=False):
        validate_model_identity(self)
        require(not torch.is_autocast_enabled("cpu"), "CPU autocast unsupported")
        require(isinstance(conditions,torch.Tensor) and conditions.device.type == "cpu"
                and conditions.dtype == torch.float32, "conditions must be CPU float32")
        return super().forward(conditions,instance_table,appearance_regime=appearance_regime,return_evidence=return_evidence)

    def load_state_dict(self,state_dict,strict=True,assign=False):
        validate_model_identity(self)
        expected = self.state_dict()
        require(strict is True and assign is False and set(state_dict) == set(expected), "old/incomplete/non-strict state rejected")
        for key,value in state_dict.items():
            require(isinstance(value,torch.Tensor) and value.device.type == "cpu"
                    and value.shape == expected[key].shape and value.dtype == expected[key].dtype
                    and value.layout == torch.strided and bool(torch.isfinite(value).all()), "state tensor differs: "+key)
        for key,kind in (("regime_identity","regime"),("numeric_identity","numeric")):
            require(torch.equal(state_dict[key],identity_bytes(kind)), "old/wrong numeric state identity rejected")
        return nn.Module.load_state_dict(self,state_dict,strict=True,assign=False)


def validate_model_identity(model):
    require(type(model) is BiasPrecisionRegimeRenderer and model.capability_version == CAPABILITY
            and model.architecture_id == ARCHITECTURE and model.numeric_rule == NUMERIC_RULE,
            "old/unbound CPU successor identity rejected")
    for name,kind in (("regime_identity","regime"),("numeric_identity","numeric")):
        value = getattr(model,name,None)
        require(isinstance(value,torch.Tensor) and value.device.type == "cpu" and value.dtype == torch.uint8
                and value.shape == (32,) and torch.equal(value,identity_bytes(kind)), "CPU successor identity buffer differs")
    require(type(model.get_submodule(TARGET)) is PrecisionFinalRGBConv, "numeric convolution implementation differs")
    require(not torch.cuda.is_initialized() and torch.get_num_threads() <= 2
            and all(p.device.type == "cpu" and p.dtype == torch.float32 for p in model.parameters()), "CPU float32/2-thread successor required")
    return model


def build_fresh_object_appearance_regime_bias_precision_cpu(*,condition_channel_order):
    require(not torch.cuda.is_initialized() and torch.get_num_threads() <= 2, "CPU successor construction boundary")
    with torch.device("cpu"),torch.random.fork_rng(devices=[]):
        baseline = build_fresh_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=condition_channel_order)
        model = BiasPrecisionRegimeRenderer(baseline)
    return validate_model_identity(model)


def seasonal_parameter(model):
    validate_model_identity(model)
    parameter = model.core.core.appearance.base.layers[0].season_branch.weight
    require(parameter.shape == (32,4,3,3) and parameter.numel() == 1152, "successor seasonal parameter differs")
    return parameter


def parameter_initialization_digest(model):
    digest = hashlib.sha256()
    for name,value in model.named_parameters():
        digest.update(name.encode()); digest.update(str(value.shape).encode()); digest.update(str(value.dtype).encode())
        digest.update(value.detach().contiguous().numpy().tobytes())
    return digest.hexdigest()

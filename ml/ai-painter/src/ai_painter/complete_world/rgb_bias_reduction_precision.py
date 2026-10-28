"""Versioned dense RGB bias reduction. CPU delegates the frozen CPU operator.

CUDA retains native biased convolution and native input/weight VJPs; only
the requested bias reduction accumulates in FP64. First-order FP32 only.
"""
from __future__ import annotations
import torch
from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from torch.nn import functional as F
from ai_painter.complete_world.rgb_bias_reduction_precision_cpu import rgb_bias_reduction_precision_cpu
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

NUMERIC_RULE = "fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_device_v1"


def _bounded_finite_compatible(value):
    if (type(value) in (torch.Tensor, torch.nn.Parameter)
            and value.layout == torch.strided and value.device.type in ("cpu", "cuda")
            and value.dtype in (torch.float32, torch.float64)):
        return bounded_all_finite(value)
    return bool(torch.isfinite(value).all())


def _validate(features, weight, bias):
    require(all(isinstance(v, torch.Tensor) for v in (features, weight, bias)), "RGB tensors required")
    require(features.device.type in ("cpu", "cuda") and all(v.device == features.device
        and v.dtype == torch.float32 and v.layout == torch.strided and v.is_contiguous()
        and _bounded_finite_compatible(v.detach()) for v in (features, weight, bias)), "RGB FP32/device/layout/finite boundary differs")
    require(features.ndim == 4 and tuple(features.shape[:2]) == (1, 48)
        and all(v > 0 for v in features.shape[2:]) and tuple(weight.shape) == (3, 48, 1, 1)
        and tuple(bias.shape) == (3,), "RGB shape differs")
    require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "RGB autocast prohibited")
    if features.is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision == "ieee"
            and torch.backends.cudnn.conv.fp32_precision == "ieee", "RGB CUDA IEEE FP32 required")


class _CudaRGBBiasReduction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias):
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 3, *features.shape[2:])
        result = F.conv2d(features, weight, bias, stride=1, padding=0, dilation=1, groups=1)
        require(_bounded_finite_compatible(result), "RGB forward nonfinite")
        return result

    @staticmethod
    def backward(ctx, grad_output):
        require(not torch.is_grad_enabled(), "higher-order gradients unsupported")
        features, weight, bias = ctx.saved_tensors
        require(isinstance(grad_output, torch.Tensor) and grad_output.device == features.device
            and grad_output.dtype == torch.float32 and tuple(grad_output.shape) == ctx.output_shape
            and _bounded_finite_compatible(grad_output.detach()), "RGB grad_output differs/nonfinite")
        mask = tuple(bool(v) for v in ctx.needs_input_grad)
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [0, 0], [1, 1],
            False, [0, 0], 1, mask)
        if mask[2]:
            grad_bias = grad_output.to(torch.float64).sum(dim=(0, 2, 3)).to(torch.float32)
        values = (grad_features, grad_weight, grad_bias)
        for needed, value in zip(mask, values):
            if needed:
                require(value is not None and value.device == features.device and value.dtype == torch.float32
                    and _bounded_finite_compatible(value), "RGB requested gradient differs/nonfinite")
        return tuple(v if needed else None for needed, v in zip(mask, values))


def rgb_bias_reduction_precision(features, weight, bias):
    _validate(features, weight, bias)
    if features.device.type == "cpu":
        return rgb_bias_reduction_precision_cpu(features, weight, bias)
    return _CudaRGBBiasReduction.apply(features, weight, bias)

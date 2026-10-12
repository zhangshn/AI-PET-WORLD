"""Single-target FP64 weight reduction; native FP32 forward/input/bias VJPs."""
from __future__ import annotations
import torch
from torch.nn import functional as F
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

NUMERIC_RULE = "fp32_native_biased_detail_conv_native_input_bias_vjp_fp64_unfold_matmul_weight_once_fp32_v1"


def _validate(features, weight, bias):
    values = (features, weight, bias)
    require(all(isinstance(v, torch.Tensor) for v in values), "detail tensors required")
    require(features.device.type in ("cpu", "cuda") and all(
        v.device == features.device and v.dtype == torch.float32
        and v.layout == torch.strided and v.is_contiguous()
        and bool(torch.isfinite(v.detach()).all()) for v in values),
        "detail FP32/device/layout/finite boundary differs")
    require(len({v.untyped_storage().data_ptr() for v in values}) == 3,
        "detail input/weight/bias storage aliases prohibited")
    require(features.ndim == 4 and tuple(features.shape[:2]) == (1, 68)
        and all(v > 0 for v in features.shape[2:])
        and tuple(weight.shape) == (48, 68, 3, 3) and tuple(bias.shape) == (48,),
        "detail shape differs")
    require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"),
        "detail autocast prohibited")
    if features.is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision == "ieee"
            and torch.backends.cudnn.conv.fp32_precision == "ieee", "detail CUDA IEEE FP32 required")


class _DetailWeightReduction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias):
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 48, *features.shape[2:])
        value = F.conv2d(features, weight, bias, stride=1, padding=1, dilation=1, groups=1)
        require(bool(torch.isfinite(value).all()), "detail forward nonfinite")
        return value

    @staticmethod
    def backward(ctx, grad_output):
        require(not torch.is_grad_enabled(), "higher-order gradients unsupported")
        features, weight, bias = ctx.saved_tensors
        require(isinstance(grad_output, torch.Tensor) and grad_output.device == features.device
            and grad_output.dtype == torch.float32 and grad_output.layout == torch.strided
            and tuple(grad_output.shape) == ctx.output_shape
            and bool(torch.isfinite(grad_output.detach()).all()), "detail grad_output differs/nonfinite")
        mask = tuple(bool(v) for v in ctx.needs_input_grad)
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [1, 1], [1, 1],
            False, [0, 0], 1, mask)
        if mask[1]:
            columns = F.unfold(features.to(torch.float64), kernel_size=(3, 3),
                dilation=(1, 1), padding=(1, 1), stride=(1, 1))
            upstream = grad_output.to(torch.float64).reshape(1, 48, -1)
            grad_weight = (upstream @ columns.transpose(1, 2)).reshape(48, 68, 3, 3).to(torch.float32)
        values = (grad_features, grad_weight, grad_bias)
        for needed, value, source in zip(mask, values, (features, weight, bias)):
            if needed:
                require(value is not None and value.shape == source.shape
                    and value.device == source.device and value.dtype == torch.float32
                    and bool(torch.isfinite(value).all()), "detail requested gradient differs/nonfinite")
        return tuple(value if needed else None for needed, value in zip(mask, values))


def detail_weight_reduction_precision(features, weight, bias):
    _validate(features, weight, bias)
    return _DetailWeightReduction.apply(features, weight, bias)

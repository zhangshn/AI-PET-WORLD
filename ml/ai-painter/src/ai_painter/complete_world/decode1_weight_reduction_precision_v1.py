"""NS-001: native FP32 decode1 convolution, only weight reduction uses FP64."""
import torch
from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from torch import nn
from torch.nn import functional as F
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

NUMERIC_RULE = "decode1_conv3_fp32_native_forward_native_input_bias_vjp_original_device_fp64_unfold_matmul_weight_once_fp32_v1"


def _validate(features, weight, bias):
    values = (features, weight, bias)
    require(all(type(value) is torch.Tensor or type(value) is nn.Parameter for value in values), "decode1 tensors required")
    require(features.device.type in ("cpu", "cuda") and all(value.device == features.device
        and value.dtype == torch.float32 and value.layout == torch.strided and value.is_contiguous()
        and bounded_all_finite(value.detach()) for value in values), "decode1 FP32/device/layout/finite differs")
    require(len({value.untyped_storage().data_ptr() for value in values}) == 3, "decode1 storage alias prohibited")
    require(features.ndim == 4 and tuple(features.shape[:2]) == (1, 48) and all(size > 0 for size in features.shape[2:])
        and tuple(weight.shape) == (48, 48, 3, 3) and tuple(bias.shape) == (48,), "decode1 shape differs")
    require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "decode1 autocast prohibited")
    if features.is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision == "ieee" and torch.backends.cudnn.conv.fp32_precision == "ieee",
                "decode1 IEEE FP32 required")


class _Decode1WeightReduction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias):
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 48, *features.shape[2:])
        result = F.conv2d(features, weight, bias, stride=1, padding=1, dilation=1, groups=1)
        require(bool(torch.isfinite(result).all()), "decode1 forward nonfinite")
        return result

    @staticmethod
    def backward(ctx, grad_output):
        require(not torch.is_grad_enabled(), "decode1 higher-order gradients prohibited")
        features, weight, bias = ctx.saved_tensors
        _validate(features, weight, bias)
        require(type(grad_output) is torch.Tensor and grad_output.device == features.device
            and grad_output.dtype == torch.float32 and grad_output.layout == torch.strided
            and tuple(grad_output.shape) == ctx.output_shape and bool(torch.isfinite(grad_output.detach()).all()),
            "decode1 grad_output shape/device/dtype/finite differs")
        mask = tuple(bool(needed) for needed in ctx.needs_input_grad)
        # Preserve the native full mask, including native weight work before replacing its result.
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [1, 1], [1, 1], False, [0, 0], 1, mask)
        if mask[1]:
            columns = F.unfold(features.to(torch.float64), (3, 3), dilation=1, padding=1, stride=1)
            upstream = grad_output.to(torch.float64).reshape(1, 48, -1)
            grad_weight = (upstream @ columns.transpose(1, 2)).reshape(48, 48, 3, 3).to(torch.float32)
        gradients = (grad_features, grad_weight, grad_bias)
        for needed, value, original in zip(mask, gradients, (features, weight, bias)):
            if needed:
                require(value is not None and value.shape == original.shape and value.device == original.device
                    and value.dtype == torch.float32 and bool(torch.isfinite(value).all()), "decode1 requested gradient differs/nonfinite")
        return tuple(value if needed else None for needed, value in zip(mask, gradients))


def decode1_weight_reduction_precision(features, weight, bias):
    _validate(features, weight, bias)
    return _Decode1WeightReduction.apply(features, weight, bias)


class Decode1WeightReductionConv(nn.Module):
    """Exact new type, holding the original two Parameter objects under unchanged names."""
    def __init__(self, original):
        super().__init__()
        require(type(original) is nn.Conv2d and original.weight.device.type == "cpu"
            and tuple(original.weight.shape) == (48, 48, 3, 3) and original.bias is not None
            and tuple(original.bias.shape) == (48,) and original.stride == (1, 1) and original.padding == (1, 1)
            and original.dilation == (1, 1) and original.groups == 1 and original.padding_mode == "zeros",
            "decode1 original convolution differs")
        self.weight, self.bias = original.weight, original.bias
        self.in_channels = self.out_channels = 48
        self.kernel_size = (3, 3)
        self.stride = self.padding = self.dilation = (1, 1)
        self.groups, self.padding_mode = 1, "zeros"
        self.training = original.training

    def forward(self, features):
        return decode1_weight_reduction_precision(features, self.weight, self.bias)

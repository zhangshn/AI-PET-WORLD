"""NS-001: native FP32 decode2 inner convolution, only weight reduction uses FP64."""
import torch
from ai_painter.complete_world.remaining_native_weight_vjp_v1 import bounded_remaining_weight_gradient
from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from torch import nn
from torch.nn import functional as F
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

NUMERIC_RULE = "decode2_inner_conv3_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_kernel_row_major_channel16_full_spatial_matmul_all_weights_once_fp32_v2"


def _validate(features, weight, bias):
    values = (features, weight, bias)
    require(all(type(value) is torch.Tensor or type(value) is nn.Parameter for value in values), "decode2 inner tensors required")
    require(features.device.type in ("cpu", "cuda") and all(value.device == features.device
        and value.dtype == torch.float32 and value.layout == torch.strided and value.is_contiguous()
        and bounded_all_finite(value.detach()) for value in values), "decode2 inner FP32/device/layout/finite differs")
    require(len({value.untyped_storage().data_ptr() for value in values}) == 3, "decode2 inner storage alias prohibited")
    require(features.ndim == 4 and tuple(features.shape[:2]) == (1, 96) and all(size > 0 for size in features.shape[2:])
        and tuple(weight.shape) == (96, 96, 3, 3) and tuple(bias.shape) == (96,), "decode2 inner shape differs")
    require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "decode2 inner autocast prohibited")
    if features.is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision == "ieee" and torch.backends.cudnn.conv.fp32_precision == "ieee",
                "decode2 inner IEEE FP32 required")


class _Decode2InnerWeightReduction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias):
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 96, *features.shape[2:])
        result = F.conv2d(features, weight, bias, stride=1, padding=1, dilation=1, groups=1)
        require(bounded_all_finite(result), "decode2 inner forward nonfinite")
        return result

    @staticmethod
    def backward(ctx, grad_output):
        require(not torch.is_grad_enabled(), "decode2 inner higher-order gradients prohibited")
        features, weight, bias = ctx.saved_tensors
        _validate(features, weight, bias)
        require(type(grad_output) is torch.Tensor and grad_output.device == features.device
            and grad_output.dtype == torch.float32 and grad_output.layout == torch.strided
            and tuple(grad_output.shape) == ctx.output_shape and bounded_all_finite(grad_output.detach()),
            "decode2 inner grad_output shape/device/dtype/finite differs")
        mask = tuple(bool(needed) for needed in ctx.needs_input_grad)
        # Preserve the native full mask, including native weight work before replacing its result.
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [1, 1], [1, 1], False, [0, 0], 1, mask)
        if mask[1]:
            grad_weight = bounded_remaining_weight_gradient(features, grad_output, target='core.core.terrain.decode_2.layers.3')
        gradients = (grad_features, grad_weight, grad_bias)
        for needed, value, original in zip(mask, gradients, (features, weight, bias)):
            if needed:
                require(value is not None and value.shape == original.shape and value.device == original.device
                    and value.dtype == torch.float32 and bounded_all_finite(value), "decode2 inner requested gradient differs/nonfinite")
        return tuple(value if needed else None for needed, value in zip(mask, gradients))


def decode2_inner_weight_reduction_precision(features, weight, bias):
    _validate(features, weight, bias)
    return _Decode2InnerWeightReduction.apply(features, weight, bias)


class Decode2InnerWeightReductionConv(nn.Module):
    """Exact new type, holding the original two Parameter objects under unchanged names."""
    def __init__(self, original):
        super().__init__()
        require(type(original) is nn.Conv2d and original.weight.device.type == "cpu"
            and tuple(original.weight.shape) == (96, 96, 3, 3) and original.bias is not None
            and tuple(original.bias.shape) == (96,) and original.stride == (1, 1) and original.padding == (1, 1)
            and original.dilation == (1, 1) and original.groups == 1 and original.padding_mode == "zeros",
            "decode2 inner original convolution differs")
        self.weight, self.bias = original.weight, original.bias
        self.in_channels, self.out_channels = 96, 96
        self.kernel_size = (3, 3)
        self.stride = self.padding = self.dilation = (1, 1)
        self.groups, self.padding_mode = 1, "zeros"
        self.training = original.training

    def forward(self, features):
        return decode2_inner_weight_reduction_precision(features, self.weight, self.bias)

"""Target 88: original-device FP64 weight reduction; frozen decode1 arithmetic."""
import torch
from torch import nn
from torch.nn import functional as F
from ai_painter.complete_world.object_appearance_regime_input_cpu import require
from ai_painter.complete_world.object_appearance_regime_bias_precision import PrecisionFinalRGBConv
from ai_painter.complete_world.decode1_weight_reduction_precision_v1 import decode1_weight_reduction_precision

NUMERIC_RULE = "final_rgb_base_conv2_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_unfold_matmul_weight_once_fp32_v1"
OUTPUT_NUMERIC_RULE = "final_rgb_output_conv4_fp32_native_forward_native_input_vjp_full_mask_original_device_fp64_weight_and_bias_reduce_once_fp32_v1"


def final_rgb_base_weight_reduction_precision(features, weight, bias):
    require(torch.get_num_threads() <= 2, "final RGB base CPU threads exceeded")
    return decode1_weight_reduction_precision(features, weight, bias)


class FinalRgbBaseWeightReductionConv(nn.Module):
    """Replace only the module type, retaining both original Parameter objects."""
    def __init__(self, original):
        super().__init__()
        require(type(original) is nn.Conv2d and original.weight.device.type == "cpu"
            and original.in_channels == original.out_channels == 48 and original.kernel_size == (3, 3)
            and tuple(original.weight.shape) == (48, 48, 3, 3) and original.bias is not None
            and tuple(original.bias.shape) == (48,) and original.stride == (1, 1) and original.padding == (1, 1)
            and original.dilation == (1, 1) and original.groups == 1 and original.padding_mode == "zeros",
            "final RGB base original convolution differs")
        self.weight, self.bias = original.weight, original.bias
        self.in_channels = self.out_channels = 48
        self.kernel_size = (3, 3)
        self.stride = self.padding = self.dilation = (1, 1)
        self.groups, self.padding_mode = 1, "zeros"
        self.training = original.training

    def forward(self, features):
        return final_rgb_base_weight_reduction_precision(features, self.weight, self.bias)


def _validate_output_tensors(features, weight, bias):
    require(torch.get_num_threads() <= 2, "final RGB output CPU threads exceeded")
    values = (features, weight, bias)
    require(all(type(value) in (torch.Tensor, nn.Parameter) for value in values), "final RGB output tensors required")
    require(features.device.type in ("cpu", "cuda") and all(value.device == features.device
        and value.dtype == torch.float32 and value.layout == torch.strided and value.is_contiguous()
        and bool(torch.isfinite(value.detach()).all()) for value in values), "final RGB output FP32/device/layout/finite differs")
    require(features.ndim == 4 and tuple(features.shape[:2]) == (1, 48)
        and all(size > 0 for size in features.shape[2:]) and tuple(weight.shape) == (3, 48, 1, 1)
        and tuple(bias.shape) == (3,), "final RGB output shape differs")
    require(len({value.untyped_storage()._cdata for value in values}) == 3, "final RGB output storage alias prohibited")
    require(not torch.is_autocast_enabled("cpu") and not torch.is_autocast_enabled("cuda"), "final RGB output autocast prohibited")
    if features.is_cuda:
        require(torch.backends.cuda.matmul.fp32_precision == "ieee" and torch.backends.cudnn.conv.fp32_precision == "ieee",
                "final RGB output IEEE FP32 required")


class _FinalRgbOutputWeightReduction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias):
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 3, *features.shape[2:])
        result = F.conv2d(features, weight, bias, stride=1, padding=0, dilation=1, groups=1)
        require(bool(torch.isfinite(result).all()), "final RGB output forward nonfinite")
        return result

    @staticmethod
    def backward(ctx, grad_output):
        require(not torch.is_grad_enabled(), "final RGB output higher-order gradients prohibited")
        features, weight, bias = ctx.saved_tensors
        _validate_output_tensors(features, weight, bias)
        require(type(grad_output) is torch.Tensor and grad_output.device == features.device
            and grad_output.dtype == torch.float32 and grad_output.layout == torch.strided
            and tuple(grad_output.shape) == ctx.output_shape and bool(torch.isfinite(grad_output.detach()).all()),
            "final RGB output grad_output shape/device/layout/dtype/finite differs")
        mask = tuple(bool(needed) for needed in ctx.needs_input_grad)
        # Keep the complete original native mask, including weight work that is replaced below.
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [0, 0], [1, 1], False, [0, 0], 1, mask)
        if mask[1]:
            upstream = grad_output.to(torch.float64).reshape(3, -1)
            columns = features.to(torch.float64).reshape(48, -1)
            grad_weight = (upstream @ columns.T).reshape(3, 48, 1, 1).to(torch.float32)
        if mask[2]:
            # The original PrecisionFinalRGBConv already uses this bias rule.
            grad_bias = grad_output.to(torch.float64).sum(dim=(0, 2, 3)).to(torch.float32)
        gradients = (grad_features, grad_weight, grad_bias)
        for needed, value, original in zip(mask, gradients, (features, weight, bias)):
            if needed:
                require(value is not None and value.shape == original.shape and value.device == original.device
                    and value.dtype == torch.float32 and bool(torch.isfinite(value).all()),
                    "final RGB output requested gradient differs/nonfinite")
        return tuple(value if needed else None for needed, value in zip(mask, gradients))


def final_rgb_output_weight_reduction_precision(features, weight, bias):
    """Unqualified target90 component only; no model factory or execution authority."""
    _validate_output_tensors(features, weight, bias)
    return _FinalRgbOutputWeightReduction.apply(features, weight, bias)


_OUTPUT_CONV_METADATA = ("in_channels", "out_channels", "kernel_size", "stride", "padding", "dilation",
                         "transposed", "output_padding", "groups", "padding_mode", "_reversed_padding_repeated_twice")


def _validate_output_convolution(module):
    require(type(module.in_channels) is type(module.out_channels) is type(module.groups) is int
        and module.in_channels == 48 and module.out_channels == 3 and module.kernel_size == (1, 1)
        and module.stride == module.dilation == (1, 1) and module.padding == module.output_padding == (0, 0)
        and module.groups == 1 and module.padding_mode == "zeros" and module.transposed is False
        and tuple(module._reversed_padding_repeated_twice) == (0, 0, 0, 0), "final RGB output convolution configuration differs")


class FinalRgbOutputWeightReductionConv(PrecisionFinalRGBConv):
    """Keep Conv2d semantics and original Parameters without random initialization."""
    def __init__(self, original):
        require(torch.get_num_threads() <= 2, "final RGB output CPU threads exceeded")
        require(type(original) is PrecisionFinalRGBConv, "exact original PrecisionFinalRGBConv required")
        _validate_output_convolution(original)
        require(type(original.weight) is nn.Parameter and type(original.bias) is nn.Parameter
            and tuple(original.weight.shape) == (3, 48, 1, 1) and tuple(original.bias.shape) == (3,),
            "final RGB output original parameters differ")
        require(original.weight.device.type in ("cpu", "cuda") and all(value.device == original.weight.device
            and value.dtype == torch.float32 and value.layout == torch.strided and value.is_contiguous()
            and bool(torch.isfinite(value.detach()).all()) for value in (original.weight, original.bias)),
            "final RGB output original FP32/device/layout/finite differs")
        require(original.weight.untyped_storage()._cdata != original.bias.untyped_storage()._cdata,
                "final RGB output original storage alias prohibited")
        nn.Module.__init__(self)
        self.weight, self.bias = original.weight, original.bias
        for name in _OUTPUT_CONV_METADATA:
            value = getattr(original, name)
            setattr(self, name, value.copy() if type(value) is list else value)
        self.training = original.training

    def forward(self, features):
        _validate_output_convolution(self)
        return final_rgb_output_weight_reduction_precision(features, self.weight, self.bias)

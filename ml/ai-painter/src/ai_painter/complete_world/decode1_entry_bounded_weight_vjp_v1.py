"""Isolated target48 numeric candidate; no model factory or qualification.

Native FP32 forward and requested native input/bias VJPs are retained.
Native weight work is not requested; the bounded FP64 helper supplies weight.
Only FP64 weight columns are materialized in kernel/channel groups. Each
weight still reduces all spatial positions in one matmul, on the input device.
"""
import torch
from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from torch import nn
from torch.nn import functional as F

from ai_painter.complete_world import decode1_entry_weight_reduction_precision_v1 as original
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

INPUT_CHANNEL_BLOCK = 16
NUMERIC_RULE = 'decode1_entry_conv0_fp32_native_forward_native_requested_input_bias_vjp_no_discarded_native_weight_original_device_fp64_kernel_row_major_channel16_full_spatial_matmul_all_weights_once_fp32_v2'
EXECUTION_QUALIFIED = False


def _bounded_weight_gradient(features, grad_output):
    height, width = features.shape[2:]
    upstream = grad_output.to(torch.float64).reshape(1, 48, height * width)
    weights64 = torch.empty((48, 144, 3, 3), device=features.device, dtype=torch.float64)
    for kernel_y in range(3):
        for kernel_x in range(3):
            for start in range(0, 144, INPUT_CHANNEL_BLOCK):
                stop = min(start + INPUT_CHANNEL_BLOCK, 144)
                # Padding and slicing only copy the original FP32 samples.
                # No spatial sums, partial-weight accumulators or host transfers.
                padded = F.pad(features[:, start:stop], (1, 1, 1, 1))
                columns = padded[:, :, kernel_y:kernel_y + height,
                                 kernel_x:kernel_x + width].contiguous().to(torch.float64)
                columns = columns.reshape(1, stop - start, height * width)
                reduced = upstream @ columns.transpose(1, 2)
                weights64[:, start:stop, kernel_y, kernel_x] = reduced[0]
                del padded, columns, reduced
    return weights64.to(torch.float32)


class _Decode1EntryBoundedWeightVjp(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias):
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 48, *features.shape[2:])
        result = F.conv2d(features, weight, bias, stride=1, padding=1, dilation=1, groups=1)
        require(bounded_all_finite(result), 'bounded entry forward nonfinite')
        return result

    @staticmethod
    def backward(ctx, grad_output):
        require(not torch.is_grad_enabled(), 'bounded entry higher-order gradients prohibited')
        features, weight, bias = ctx.saved_tensors
        original._validate(features, weight, bias)
        require(INPUT_CHANNEL_BLOCK == 16, 'registered channel block differs')
        require(type(grad_output) is torch.Tensor and grad_output.device == features.device
                and grad_output.dtype == torch.float32 and grad_output.layout == torch.strided
                and tuple(grad_output.shape) == ctx.output_shape
                and bounded_all_finite(grad_output.detach()),
                'bounded entry grad_output shape/device/dtype/finite differs')
        mask = tuple(bool(needed) for needed in ctx.needs_input_grad)
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [1, 1], [1, 1],
            False, [0, 0], 1, (mask[0], False, mask[2]))
        if mask[1]:
            grad_weight = _bounded_weight_gradient(features, grad_output)
        gradients = (grad_features, grad_weight, grad_bias)
        for needed, value, source in zip(mask, gradients, (features, weight, bias)):
            if needed:
                require(value is not None and value.shape == source.shape
                        and value.device == source.device and value.dtype == torch.float32
                        and bounded_all_finite(value),
                        'bounded entry requested gradient differs/nonfinite')
        return tuple(value if needed else None for needed, value in zip(mask, gradients))


def decode1_entry_bounded_weight_vjp(features, weight, bias):
    """Native convolution whose isolated weight VJP uses registered columns."""
    original._validate(features, weight, bias)
    require(INPUT_CHANNEL_BLOCK == 16, 'registered channel block differs')
    return _Decode1EntryBoundedWeightVjp.apply(features, weight, bias)


class Decode1EntryBoundedWeightVjpConv(nn.Module):
    """Explicit opt-in wrapper preserving the two source Parameter objects."""
    numeric_rule = NUMERIC_RULE
    execution_qualified = False

    def __init__(self, source):
        super().__init__()
        require(type(self) is Decode1EntryBoundedWeightVjpConv,
                'exact bounded entry wrapper required')
        require(type(source) in (nn.Conv2d, original.Decode1EntryWeightReductionConv)
                and source.weight.device.type == 'cpu'
                and source.in_channels == 144 and source.out_channels == 48
                and source.kernel_size == (3, 3) and source.bias is not None
                and tuple(source.weight.shape) == (48, 144, 3, 3)
                and tuple(source.bias.shape) == (48,)
                and source.stride == source.padding == source.dilation == (1, 1)
                and source.groups == 1 and source.padding_mode == 'zeros',
                'bounded entry source convolution differs')
        self.weight, self.bias = source.weight, source.bias
        for name in ('in_channels', 'out_channels', 'kernel_size', 'stride', 'padding',
                     'dilation', 'groups', 'padding_mode'):
            setattr(self, name, getattr(source, name))
        self.training = source.training

    def forward(self, features):
        return decode1_entry_bounded_weight_vjp(features, self.weight, self.bias)

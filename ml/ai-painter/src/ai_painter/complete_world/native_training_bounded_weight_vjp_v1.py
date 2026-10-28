"""Five registered native-training convolutions; bounded FP64 weight columns.

No model factory or execution qualification. Native FP32 forward and the full
native backward mask remain intact. Each kernel/channel group reduces all
spatial positions in one FP64 matmul on the original device.
"""
from types import MappingProxyType

import torch
from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from torch import nn
from torch.nn import functional as F

from ai_painter.complete_world import stem_inner_weight_reduction_precision_v1 as stem
from ai_painter.complete_world import decode1_weight_reduction_precision_v1 as decode
from ai_painter.complete_world import detail_weight_reduction_precision as detail
from ai_painter.complete_world import terrain_detail_weight_reduction_precision_v1 as terrain
from ai_painter.complete_world import final_rgb_base_weight_reduction_precision_v1 as final
from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import PrecisionDetailWeightConv
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

INPUT_CHANNEL_BLOCK = 16
NUMERIC_RULE = (
    'native_training_five_targets_fp32_native_forward_native_input_bias_vjp_full_mask_'
    'original_device_fp64_kernel_row_major_channel16_full_spatial_matmul_'
    'all_weights_once_fp32_v1'
)
EXECUTION_QUALIFIED = False

# path -> (parameter index, input channels, exact predecessor type, validator,
#          original error prefix, original backward revalidates saved inputs)
_SPECS = MappingProxyType({
    'core.core.terrain.base_stem.layers.3':
        (4, 48, stem.StemInnerWeightReductionConv, stem._validate, 'stem inner', True),
    'core.core.terrain.decode_1.layers.3':
        (52, 48, decode.Decode1WeightReductionConv, decode._validate, 'decode1', True),
    'core.core.terrain.full_resolution_detail.layers.0':
        (56, 68, PrecisionDetailWeightConv, detail._validate, 'detail', False),
    'core.core.terrain.full_resolution_detail.layers.3':
        (60, 48, terrain.TerrainDetailWeightReductionConv, decode._validate, 'decode1', True),
    'core.core.final_rgb_decoder.base.layers.2':
        (88, 48, final.FinalRgbBaseWeightReductionConv, decode._validate, 'decode1', True),
})
REGISTERED_TARGETS = tuple(_SPECS)
_CONFIG_FIELDS = ('in_channels', 'out_channels', 'kernel_size', 'stride', 'padding',
                  'dilation', 'groups', 'padding_mode')
_OPTIONAL_CONFIG = ('transposed', 'output_padding', '_reversed_padding_repeated_twice')


def _bounded_finite_compatible(value):
    if (type(value) in (torch.Tensor, torch.nn.Parameter)
            and value.layout == torch.strided and value.device.type in ("cpu", "cuda")
            and value.dtype in (torch.float32, torch.float64)):
        return bounded_all_finite(value)
    return bool(torch.isfinite(value).all())


def _spec(target):
    require(type(target) is str and target in _SPECS, 'unregistered native training target')
    return _SPECS[target]


def _validate_config(module, channels):
    require(all(hasattr(module, key) for key in _CONFIG_FIELDS), 'bounded convolution metadata missing')
    pairs = (module.kernel_size, module.stride, module.padding, module.dilation)
    require(type(module.in_channels) is type(module.out_channels) is type(module.groups) is int
            and module.in_channels == channels and module.out_channels == 48
            and all(type(pair) is tuple and all(type(v) is int for v in pair) for pair in pairs)
            and module.kernel_size == (3, 3)
            and module.stride == module.padding == module.dilation == (1, 1)
            and module.groups == 1 and module.padding_mode == 'zeros',
            'bounded convolution configuration differs')
    for key, expected in (('transposed', False), ('output_padding', (0, 0)),
                          ('_reversed_padding_repeated_twice', (1, 1, 1, 1))):
        if hasattr(module, key):
            value = getattr(module, key)
            require((type(value) is bool and value is expected) if key == 'transposed'
                    else type(value) in (tuple, list) and all(type(v) is int for v in value)
                    and tuple(value) == expected, 'bounded convolution optional configuration differs')
    values = (module.weight, module.bias)
    require(all(type(value) is nn.Parameter for value in values)
            and tuple(module.weight.shape) == (48, channels, 3, 3)
            and tuple(module.bias.shape) == (48,), 'bounded convolution parameters differ')
    require(module.weight.device.type in ('cpu', 'cuda') and all(
        value.device == module.weight.device and value.dtype == torch.float32
        and value.layout == torch.strided and value.is_contiguous()
        and bool(torch.isfinite(value.detach()).all()) for value in values),
        'bounded convolution parameters FP32/device/layout/finite differs')
    require(module.weight.untyped_storage()._cdata != module.bias.untyped_storage()._cdata,
            'bounded convolution parameter storage alias prohibited')


def _bounded_weight_gradient(features, grad_output):
    channels = features.shape[1]
    require(channels in (48, 68) and INPUT_CHANNEL_BLOCK == 16, 'bounded registered shape/block differs')
    height, width = features.shape[2:]
    upstream = grad_output.to(torch.float64).reshape(1, 48, height * width)
    weights64 = torch.empty((48, channels, 3, 3), device=features.device, dtype=torch.float64)
    for kernel_y in range(3):
        for kernel_x in range(3):
            for start in range(0, channels, INPUT_CHANNEL_BLOCK):
                stop = min(start + INPUT_CHANNEL_BLOCK, channels)
                padded = F.pad(features[:, start:stop], (1, 1, 1, 1))
                columns = padded[:, :, kernel_y:kernel_y + height,
                                 kernel_x:kernel_x + width].contiguous().to(torch.float64)
                columns = columns.reshape(1, stop - start, height * width)
                reduced = upstream @ columns.transpose(1, 2)
                weights64[:, start:stop, kernel_y, kernel_x] = reduced[0]
                del padded, columns, reduced
    return weights64.to(torch.float32)


class _NativeTrainingBoundedWeightVjp(torch.autograd.Function):
    @staticmethod
    def forward(ctx, features, weight, bias, target):
        spec = _spec(target)
        ctx.target = target
        ctx.save_for_backward(features, weight, bias)
        ctx.output_shape = (1, 48, *features.shape[2:])
        result = F.conv2d(features, weight, bias, stride=1, padding=1, dilation=1, groups=1)
        require(_bounded_finite_compatible(result), spec[4] + ' forward nonfinite')
        return result

    @staticmethod
    def backward(ctx, grad_output):
        spec = _spec(ctx.target)
        prefix = spec[4]
        require(not torch.is_grad_enabled(), prefix + ' higher-order gradients prohibited')
        features, weight, bias = ctx.saved_tensors
        if spec[5]:
            spec[3](features, weight, bias)
        require(type(grad_output) is torch.Tensor and grad_output.device == features.device
                and grad_output.dtype == torch.float32 and grad_output.layout == torch.strided
                and tuple(grad_output.shape) == ctx.output_shape
                and bounded_all_finite(grad_output.detach()),
                prefix + ' grad_output shape/device/dtype/finite differs')
        mask = tuple(bool(needed) for needed in ctx.needs_input_grad[:3])
        # Native weight work is deliberately retained before its result is replaced.
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [1, 1], [1, 1],
            False, [0, 0], 1, mask)
        if mask[1]:
            grad_weight = _bounded_weight_gradient(features, grad_output)
        gradients = (grad_features, grad_weight, grad_bias)
        for needed, value, source in zip(mask, gradients, (features, weight, bias)):
            if needed:
                require(value is not None and value.shape == source.shape
                        and value.device == source.device and value.dtype == torch.float32
                        and _bounded_finite_compatible(value), prefix + ' requested gradient differs/nonfinite')
        return tuple(value if needed else None for needed, value in zip(mask, gradients)) + (None,)


class NativeTrainingBoundedWeightConv(nn.Module):
    """Exact opt-in target wrapper, retaining original weight/bias objects."""
    numeric_rule = NUMERIC_RULE
    execution_qualified = False

    def __init__(self, source, *, target):
        super().__init__()
        require(type(self) is NativeTrainingBoundedWeightConv, 'exact bounded training wrapper required')
        spec = _spec(target)
        require(type(source) is spec[2], 'bounded training predecessor type/target differs')
        _validate_config(source, spec[1])
        self.weight, self.bias = source.weight, source.bias
        for key in _CONFIG_FIELDS + _OPTIONAL_CONFIG:
            if hasattr(source, key):
                value = getattr(source, key)
                setattr(self, key, value.copy() if type(value) is list else value)
        self.training = source.training
        self.bound_target = self._bound_target = target

    def forward(self, features):
        require(type(self) is NativeTrainingBoundedWeightConv
                and self.bound_target == self._bound_target, 'bounded training target binding differs')
        spec = _spec(self.bound_target)
        _validate_config(self, spec[1])
        if spec[0] in (60, 88):
            require(torch.get_num_threads() <= 2, 'bounded terrain/final CPU threads exceeded')
        spec[3](features, self.weight, self.bias)
        require(INPUT_CHANNEL_BLOCK == 16, 'registered input channel block differs')
        return _NativeTrainingBoundedWeightVjp.apply(features, self.weight, self.bias, self.bound_target)


def build_native_training_bounded_weight_conv(source, *, target):
    return NativeTrainingBoundedWeightConv(source, target=target)

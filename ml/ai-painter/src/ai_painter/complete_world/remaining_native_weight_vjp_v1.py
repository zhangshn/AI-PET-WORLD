"""Bounded FP64 weight reduction for the two remaining native convolutions.

Each kernel/channel block reduces the complete spatial domain in one matmul.
This helper confers no execution qualification and changes no model structure.
"""
from types import MappingProxyType

import torch
from torch import nn
from torch.nn import functional as F

from ai_painter.complete_world.bounded_finite_validation_v1 import bounded_all_finite
from ai_painter.complete_world.object_appearance_regime_input_cpu import require

INPUT_CHANNEL_BLOCK = 16
_SPECS = MappingProxyType({
    'core.core.terrain.base_stem.layers.0': (31, 48),
    'core.core.terrain.decode_2.layers.3': (96, 96),
})
REGISTERED_TARGETS = tuple(_SPECS)


def bounded_remaining_weight_gradient(features, grad_output, *, target):
    require(type(target) is str and target in _SPECS, 'unregistered remaining native target')
    channels, outputs = _SPECS[target]
    require(INPUT_CHANNEL_BLOCK == 16, 'remaining native fixed channel block differs')
    require(type(features) in (torch.Tensor, nn.Parameter) and type(grad_output) is torch.Tensor,
            'remaining native tensors required')
    require(features.device.type in ('cpu', 'cuda') and grad_output.device == features.device
            and all(value.dtype == torch.float32 and value.layout == torch.strided
                    for value in (features, grad_output)) and features.is_contiguous(),
            'remaining native FP32/device/layout differs')
    require(features.ndim == 4 and tuple(features.shape[:2]) == (1, channels)
            and all(size > 0 for size in features.shape[2:])
            and tuple(grad_output.shape) == (1, outputs, *features.shape[2:]),
            'remaining native shape differs')
    require(not torch.is_autocast_enabled('cpu') and not torch.is_autocast_enabled('cuda'),
            'remaining native autocast prohibited')
    require(all(bounded_all_finite(value.detach()) for value in (features, grad_output)),
            'remaining native nonfinite')
    height, width = features.shape[2:]
    with torch.no_grad():
        upstream = grad_output.to(torch.float64).reshape(1, outputs, height * width)
        weights64 = torch.empty((outputs, channels, 3, 3), device=features.device, dtype=torch.float64)
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

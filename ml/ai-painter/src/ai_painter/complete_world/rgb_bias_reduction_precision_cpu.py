"""Inactive, unqualified CPU RGB 1x1 bias-reduction experiment.

No factory, model replacement, training adapter or production registration.
Forward is the original biased F.conv2d. Backward calls the original native
convolution_backward with the original requires-grad mask; only its requested
bias result is replaced by FP64 spatial/batch accumulation returned as FP32.
This changes numerical backward behavior and does not establish a root cause.
"""
from __future__ import annotations

import torch
from torch.nn import functional as F

CANDIDATE_ID = "inactive_rgb_bias_fp64_reduction_cpu_proposal_t_q4_33"
STATUS = "inactive_not_qualified"


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _tensor(value, name):
    _require(isinstance(value, torch.Tensor), name + " tensor required")
    _require(value.device.type == "cpu", name + " must be CPU")
    _require(value.dtype == torch.float32, name + " must be float32")
    _require(value.layout == torch.strided and value.is_contiguous(),
             name + " must be contiguous strided")
    _require(bool(torch.isfinite(value.detach()).all()), name + " must be finite")


class _RGBBiasReduction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, image_features, weight, bias):
        ctx.save_for_backward(image_features, weight, bias)
        ctx.output_shape = (1, 3, *image_features.shape[2:])
        # Preserve the fused native bias path, including its forward rounding.
        result = F.conv2d(image_features, weight, bias, stride=1, padding=0,
                          dilation=1, groups=1)
        _require(bool(torch.isfinite(result).all()), "forward must be finite")
        return result

    @staticmethod
    def backward(ctx, grad_output):
        _require(not torch.is_grad_enabled(), "higher-order gradients unsupported")
        _require(isinstance(grad_output, torch.Tensor), "grad_output tensor required")
        _require(grad_output.device.type == "cpu" and grad_output.dtype == torch.float32,
                 "grad_output must be CPU float32")
        _require(tuple(grad_output.shape) == ctx.output_shape, "grad_output shape differs")
        _require(bool(torch.isfinite(grad_output.detach()).all()), "grad_output must be finite")
        features, weight, bias = ctx.saved_tensors
        mask = tuple(bool(value) for value in ctx.needs_input_grad)
        grad_features, grad_weight, grad_bias = torch.ops.aten.convolution_backward.default(
            grad_output, features, weight, list(bias.shape), [1, 1], [0, 0],
            [1, 1], False, [0, 0], 1, mask)
        if mask[2]:
            grad_bias = grad_output.to(torch.float64).sum(dim=(0, 2, 3)).to(torch.float32)
        values = (grad_features, grad_weight, grad_bias)
        for needed, value in zip(mask, values):
            if needed:
                _require(value is not None and bool(torch.isfinite(value).all()),
                         "requested gradient must be finite")
        return tuple(value if needed else None for needed, value in zip(mask, values))


def rgb_bias_reduction_precision_cpu(image_features, weight, bias):
    """Experimental first-order-only dense N=1, C=48 -> RGB 1x1 convolution.

The supported envelope is deliberately narrow, CPU float32 with <=2 threads.
It accepts ordinary requires_grad masks, including frozen weight or bias.
No global state, inputs or parameters are modified; no initialization occurs.
"""
    _require(torch.get_num_threads() <= 2, "CPU thread budget exceeded")
    _require(not torch.is_autocast_enabled("cpu"), "CPU autocast unsupported")
    for value, name in ((image_features, "image_features"), (weight, "weight"), (bias, "bias")):
        _tensor(value, name)
    _require(image_features.ndim == 4 and tuple(image_features.shape[:2]) == (1, 48)
             and all(size > 0 for size in image_features.shape[2:]), "feature shape differs")
    _require(tuple(weight.shape) == (3, 48, 1, 1), "RGB 1x1 weight shape differs")
    _require(tuple(bias.shape) == (3,), "RGB bias shape differs")
    return _RGBBiasReduction.apply(image_features, weight, bias)

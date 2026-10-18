"""Target 88: original-device FP64 weight reduction; frozen decode1 arithmetic."""
import torch
from torch import nn
from ai_painter.complete_world.object_appearance_regime_input_cpu import require
from ai_painter.complete_world.decode1_weight_reduction_precision_v1 import decode1_weight_reduction_precision

NUMERIC_RULE = "final_rgb_base_conv2_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_unfold_matmul_weight_once_fp32_v1"


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

"""CPU delegation and first-order numeric tests; CUDA implementation is not run."""
import inspect
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world import rgb_bias_reduction_precision as device
from ai_painter.complete_world.rgb_bias_reduction_precision_cpu import rgb_bias_reduction_precision_cpu
from test_rgb_bias_reduction_precision_cpu import small_values, same_bytes


class DeviceOperatorTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
    def tearDown(self):
        torch.set_num_threads(self.threads); self.assertFalse(torch.cuda.is_initialized())

    def test_all_seven_masks_cpu_frozen_delegation_and_bias_reference(self):
        for bits in range(1, 8):
            mask = tuple(bool(bits & (1 << i)) for i in range(3))
            a = small_values(mask); b = tuple(v.detach().clone().requires_grad_(m) for v, m in zip(a, mask))
            actual, expected = device.rgb_bias_reduction_precision(*a), rgb_bias_reduction_precision_cpu(*b)
            self.assertTrue(same_bytes(actual, expected))
            incoming = torch.arange(12, dtype=torch.float32).reshape(1, 3, 2, 2) * .125
            ag = torch.autograd.grad(actual, tuple(v for v, m in zip(a, mask) if m), grad_outputs=incoming)
            bg = torch.autograd.grad(expected, tuple(v for v, m in zip(b, mask) if m), grad_outputs=incoming)
            self.assertTrue(all(same_bytes(x, y) for x, y in zip(ag, bg)))
            if mask[2]: self.assertTrue(same_bytes(ag[-1], incoming.double().sum((0, 2, 3)).float()))

    def test_reject_bad_shape_dtype_nonfinite_autocast_and_higher_order(self):
        values = small_values()
        for index, replacement in ((0, values[0].double()), (1, values[1][:2]), (2, torch.full((3,), float("nan")))):
            invalid = list(values); invalid[index] = replacement
            with self.assertRaises(ValueError): device.rgb_bias_reduction_precision(*invalid)
        with torch.autocast("cpu", dtype=torch.bfloat16):
            with self.assertRaisesRegex(ValueError, "autocast"): device.rgb_bias_reduction_precision(*values)
        with self.assertRaisesRegex(ValueError, "higher-order"):
            torch.autograd.grad(device.rgb_bias_reduction_precision(*values).sum(), values, create_graph=True)

    def test_cpu_does_not_enter_cuda_even_if_process_initialized(self):
        with patch.object(torch.cuda, "is_initialized", return_value=True), patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA touched")), \
             patch.object(device._CudaRGBBiasReduction, "apply", side_effect=AssertionError("CUDA operator touched")):
            actual = device.rgb_bias_reduction_precision(*small_values())
            self.assertEqual(actual.device.type, "cpu")

    def test_cuda_source_native_mask_and_fp64_reduction_present_unexecuted(self):
        source = inspect.getsource(device._CudaRGBBiasReduction)
        self.assertIn("F.conv2d(features, weight, bias", source)
        self.assertIn("convolution_backward.default", source)
        self.assertIn("ctx.needs_input_grad", source)
        self.assertIn("to(torch.float64).sum(dim=(0, 2, 3)).to(torch.float32)", source)


if __name__ == "__main__": unittest.main()

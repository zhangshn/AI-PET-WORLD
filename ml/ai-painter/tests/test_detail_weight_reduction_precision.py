"""Artificial small tensors only; native masks and independent dense reference."""
import itertools
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import torch
from torch.nn import functional as F
from ai_painter.complete_world import detail_weight_reduction_precision as precision


def same_bytes(a, b):
    return torch.equal(a.detach().contiguous().reshape(-1).view(torch.uint8),
                       b.detach().contiguous().reshape(-1).view(torch.uint8))


def fixtures(height=2, width=3):
    x = (torch.arange(68 * height * width).reshape(1, 68, height, width) % 9 - 4).float() / 8
    w = (torch.arange(48 * 68 * 9).reshape(48, 68, 3, 3) % 5 - 2).float() / 32
    b = torch.arange(48).float() / 64
    g = (torch.arange(48 * height * width).reshape(1, 48, height, width) % 7 - 3).float() / 16
    return x, w, b, g


def dense_reference(x, g):
    # Independent padded spatial outer products, no unfold/matmul or native weight VJP.
    height, width = x.shape[2:]
    padded = F.pad(x.double(), (1, 1, 1, 1))
    result = torch.zeros(48, 68, 3, 3, dtype=torch.float64)
    for ky, kx, y, z in itertools.product(range(3), range(3), range(height), range(width)):
        result[:, :, ky, kx] += g[0, :, y, z].double()[:, None] * padded[0, :, y + ky, z + kx][None, :]
    return result.float()


class DetailWeightTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()

    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())
        torch.set_num_threads(self.threads)

    def test_native_forward_full_actual_masks_input_bias_bytes_and_dense_weight_reference(self):
        native = torch.ops.aten.convolution_backward.default
        for height, width in ((2, 3), (1, 1)):
            for mask in itertools.product((False, True), repeat=3):
                if not any(mask): continue
                with self.subTest(shape=(height, width), mask=mask):
                    x, w, b, g = fixtures(height, width)
                    values = [v.requires_grad_(need) for v, need in zip((x, w, b), mask)]
                    expected_forward = F.conv2d(x, w, b, padding=1)
                    expected = native(g, x, w, list(b.shape), [1, 1], [1, 1], [1, 1], False, [0, 0], 1, mask)
                    seen = []
                    def record(*args, **kwargs):
                        seen.append(args[-1]); return native(*args, **kwargs)
                    with patch.object(torch.ops.aten.convolution_backward, "default", record):
                        actual_forward = precision.detail_weight_reduction_precision(*values)
                        actual = torch.autograd.grad(actual_forward, tuple(v for v in values if v.requires_grad), g)
                    self.assertTrue(same_bytes(actual_forward, expected_forward))
                    self.assertEqual(seen, [mask])
                    index = 0
                    for component, needed in enumerate(mask):
                        if needed:
                            target = dense_reference(x, g) if component == 1 else expected[component]
                            if component == 1:
                                # The weight reduction intentionally changes. Require
                                # exact values, not identical signs of numerical zero.
                                self.assertTrue(torch.equal(actual[index], target), (mask, component))
                            else:
                                self.assertTrue(same_bytes(actual[index], target), (mask, component))
                            index += 1

    def test_weight_reference_signed_zero_is_exact_not_a_tolerance_exception(self):
        x, w, b, g = fixtures(1, 1); w.requires_grad_()
        actual, = torch.autograd.grad(
            precision.detail_weight_reduction_precision(x, w, b), (w,), g)
        reference = dense_reference(x, g)
        different_bits = actual.contiguous().view(torch.int32) != reference.contiguous().view(torch.int32)
        self.assertTrue(torch.equal(actual, reference))
        self.assertGreater(int(different_bits.count_nonzero()), 0)
        self.assertTrue(bool(((actual[different_bits] == 0) & (reference[different_bits] == 0)).all()))
        self.assertTrue(bool(torch.signbit(actual[different_bits]).all()))
        self.assertFalse(bool(torch.signbit(reference[different_bits]).any()))
        # Any nonzero change must still fail exact numerical equality.
        corrupted = actual.clone(); corrupted[0, 0, 1, 1] += 1e-7
        self.assertFalse(torch.equal(corrupted, reference))

    def test_signed_cancellation_and_once_cast_reference(self):
        x = torch.zeros(1, 68, 1, 3); x[0, 0, 0] = torch.tensor([16777216., 1., -16777216.])
        w = torch.zeros(48, 68, 3, 3, requires_grad=True); b = torch.zeros(48)
        g = torch.zeros(1, 48, 1, 3); g[0, 0, 0] = 1
        dw, = torch.autograd.grad(precision.detail_weight_reduction_precision(x, w, b), (w,), g)
        self.assertEqual(float(dw[0, 0, 1, 1]), 1.)
        self.assertTrue(same_bytes(dw, dense_reference(x, g)))

    def test_no_requested_gradients_and_unsupported_device(self):
        x, w, b, _ = fixtures()
        actual = precision.detail_weight_reduction_precision(x, w, b)
        self.assertFalse(actual.requires_grad)
        self.assertTrue(same_bytes(actual, F.conv2d(x, w, b, padding=1)))
        with self.assertRaisesRegex(ValueError, "device"):
            precision.detail_weight_reduction_precision(x.to("meta"), w, b)

    def test_backward_shape_dtype_and_device_guards(self):
        x, w, b, g = fixtures()
        context = SimpleNamespace(saved_tensors=(x, w, b), output_shape=tuple(g.shape),
                                  needs_input_grad=(True, True, True))
        with torch.no_grad():
            for bad in (g.double(), g[:, :47], g.to("meta")):
                with self.assertRaisesRegex(ValueError, "grad_output"):
                    precision._DetailWeightReduction.backward(context, bad)

    def test_independent_total_and_components_are_real_backwards(self):
        x, w, b, _ = fixtures(); w.requires_grad_()
        y = precision.detail_weight_reduction_precision(x, w, b)
        ls = y.sum() * .25; lf = y.sum() * .125; lc = y.sum() * -.5
        total = (ls.float() + lf).float() + lc
        calls = []; native = torch.ops.aten.convolution_backward.default
        def record(*args, **kwargs):
            calls.append(args[-1]); return native(*args, **kwargs)
        with patch.object(torch.ops.aten.convolution_backward, "default", record):
            gradients = [torch.autograd.grad(loss, (w,), retain_graph=i < 3, create_graph=False)[0]
                         for i, loss in enumerate((total, ls, lf, lc))]
        self.assertEqual(calls, [(False, True, False)] * 4)
        self.assertTrue(torch.equal(gradients[0], (gradients[1] + gradients[2]) + gradients[3]))
        self.assertIsNone(w.grad)

    def test_unsupported_shape_dtype_layout_nonfinite_and_autocast(self):
        x, w, b, _ = fixtures()
        invalid = [(x.expand(2, -1, -1, -1), w, b), (x[:, :67].contiguous(), w, b),
                   (x.double(), w, b), (x.transpose(2, 3), w, b), (x, w[:, :, :2].contiguous(), b),
                   (x, w, b[:47]), (None, w, b), (torch.full_like(x, float("nan")), w, b),
                   (x, torch.full_like(w, float("inf")), b), (x, w, torch.full_like(b, float("nan")))]
        for values in invalid:
            with self.subTest(values=str([getattr(v, "shape", None) for v in values])):
                with self.assertRaises(ValueError): precision.detail_weight_reduction_precision(*values)
        with torch.autocast("cpu", dtype=torch.bfloat16):
            with self.assertRaisesRegex(ValueError, "autocast"): precision.detail_weight_reduction_precision(x, w, b)

    def test_bad_upstream_and_higher_order_rejected(self):
        for bad in ("nonfinite", "higher"):
            x, w, b, g = fixtures(); w.requires_grad_()
            y = precision.detail_weight_reduction_precision(x, w, b)
            if bad == "nonfinite": g.fill_(float("nan"))
            with self.assertRaisesRegex(ValueError, "higher-order|grad_output"):
                torch.autograd.grad(y, (w,), g, create_graph=bad == "higher")

    def test_input_weight_bias_storage_alias_rejected(self):
        storage = torch.zeros(48 * 68 * 9)
        x = storage[:68 * 6].reshape(1, 68, 2, 3)
        w = storage.reshape(48, 68, 3, 3)
        b = torch.zeros(48)
        with self.assertRaisesRegex(ValueError, "aliases"):
            precision.detail_weight_reduction_precision(x, w, b)
        x = torch.zeros_like(x)
        with self.assertRaisesRegex(ValueError, "aliases"):
            precision.detail_weight_reduction_precision(x, w, storage[:48])


if __name__ == "__main__": unittest.main()

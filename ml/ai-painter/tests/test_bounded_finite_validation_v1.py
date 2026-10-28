"""CPU contract tests for the standalone bounded finite predicate."""
import random
import unittest
from unittest import mock

import numpy as np
import torch
from torch import nn

from ai_painter.complete_world.bounded_finite_validation_v1 import MAX_BLOCK_ELEMENTS, bounded_all_finite

ORIGINAL_ISFINITE = torch.isfinite
TEST_EVIDENCE = []


class BoundedFiniteValidationTests(unittest.TestCase):
    def check_predicate(self, value, label, *, full_coverage=False):
        expected = bool(ORIGINAL_ISFINITE(value).all())
        calls = []
        storage = value.untyped_storage().data_ptr()

        def real_spy(block):
            self.assertLessEqual(block.numel(), MAX_BLOCK_ELEMENTS)
            self.assertFalse(block.requires_grad)
            self.assertEqual(block.untyped_storage().data_ptr(), storage)
            calls.append({"numel": block.numel(), "shape": list(block.shape), "stride": list(block.stride()),
                          "storageOffset": block.storage_offset()})
            return ORIGINAL_ISFINITE(block)

        with mock.patch.object(torch, "isfinite", side_effect=real_spy):
            actual = bounded_all_finite(value)
        self.assertIs(torch.isfinite, ORIGINAL_ISFINITE)
        self.assertIs(type(actual), bool)
        self.assertEqual(actual, expected)
        if full_coverage:
            self.assertTrue(actual)
            self.assertEqual(sum(row["numel"] for row in calls), value.numel())
        TEST_EVIDENCE.append({"case": label, "dtype": str(value.dtype), "shape": list(value.shape),
                              "expected": expected, "actual": actual, "calls": calls,
                              "allBlocksAliasOriginalStorage": True, "logicalElements": value.numel()})
        return calls

    def test_finite_extremes_empty_scalar(self):
        for dtype in (torch.float32, torch.float64):
            info = torch.finfo(dtype)
            value = torch.tensor([info.max, -info.max, info.tiny, -info.tiny, 0.0, -0.0], dtype=dtype)
            self.check_predicate(value, "finite_extremes", full_coverage=True)
            self.check_predicate(torch.empty(0, 2, dtype=dtype), "empty", full_coverage=True)
            self.check_predicate(torch.tensor(-0.0, dtype=dtype), "scalar_finite", full_coverage=True)
            for bad in (float("nan"), float("inf"), -float("inf")):
                self.check_predicate(torch.tensor(bad, dtype=dtype), "scalar_nonfinite")

    def test_actual_default_block_boundaries_and_short_circuit(self):
        self.assertEqual(MAX_BLOCK_ELEMENTS, 4194304)
        value = torch.ones(MAX_BLOCK_ELEMENTS + 3, dtype=torch.float32)
        calls = self.check_predicate(value, "default_boundary_true", full_coverage=True)
        self.assertEqual([(v["storageOffset"], v["numel"]) for v in calls], [(0, MAX_BLOCK_ELEMENTS), (MAX_BLOCK_ELEMENTS, 3)])
        for index in (0, MAX_BLOCK_ELEMENTS - 1, MAX_BLOCK_ELEMENTS, value.numel() - 1):
            for bad in (float("nan"), float("inf"), -float("inf")):
                value[index] = bad
                calls = self.check_predicate(value, "default_boundary_nonfinite_" + str(index))
                self.assertEqual(len(calls), 1 if index < MAX_BLOCK_ELEMENTS else 2)
                value[index] = 1.0
        double = torch.ones(MAX_BLOCK_ELEMENTS + 1, dtype=torch.float64)
        self.check_predicate(double, "float64_over_default", full_coverage=True)
        double[MAX_BLOCK_ELEMENTS] = -float("inf")
        self.check_predicate(double, "float64_boundary_inf")

    def test_noncontiguous_and_expanded_views(self):
        base = torch.arange(120, dtype=torch.float64).view(4, 5, 6)
        for label, value in (("transpose", base.transpose(0, 2)), ("strided", base[:, ::2, ::2]),
                             ("narrow", base.narrow(1, 1, 3)),
                             ("expanded", torch.tensor([1.0], dtype=torch.float32).expand(2, 3, 4))):
            self.check_predicate(value, label, full_coverage=True)
        rows = MAX_BLOCK_ELEMENTS + 3
        large = torch.arange(2 * rows, dtype=torch.float32).view(2, rows).t()
        self.assertFalse(large.is_contiguous())
        calls = self.check_predicate(large, "large_transpose", full_coverage=True)
        block_rows = MAX_BLOCK_ELEMENTS // 2
        self.assertEqual([v["storageOffset"] for v in calls], [0, block_rows, 2 * block_rows])
        self.assertEqual([v["shape"] for v in calls], [[block_rows, 2], [block_rows, 2], [3, 2]])
        self.assertTrue(all(v["stride"] == [1, rows] for v in calls))
        large[block_rows, 1] = float("nan")
        self.check_predicate(large, "large_transpose_boundary_nan")
        expanded = torch.tensor([1.0], dtype=torch.float32).expand(MAX_BLOCK_ELEMENTS + 1)
        self.check_predicate(expanded, "large_expanded", full_coverage=True)
        # A high-rank view requires splitting more than one dimension.
        high_rank = torch.tensor([2.0], dtype=torch.float32).expand(*([2] * 24))
        self.check_predicate(high_rank, "high_rank_expanded", full_coverage=True)

    def test_data_gradient_version_rng_and_global_state_preserved(self):
        parameter = nn.Parameter(torch.tensor([1.0, -0.0, 3.0], dtype=torch.float64))
        parameter.grad = torch.tensor([4.0, 5.0, 6.0], dtype=torch.float64)
        data_bits = parameter.detach().view(torch.uint8).clone()
        grad_bits = parameter.grad.view(torch.uint8).clone()
        grad_object = parameter.grad
        version = parameter._version
        cpu_rng = torch.get_rng_state().clone()
        python_rng = random.getstate()
        numpy_rng = np.random.get_state()
        state = (torch.get_num_threads(), torch.get_num_interop_threads(), torch.get_default_dtype(), torch.get_default_device(), torch.is_grad_enabled())
        self.check_predicate(parameter, "parameter_state", full_coverage=True)
        self.assertTrue(parameter.requires_grad)
        self.assertEqual(parameter._version, version)
        self.assertIs(parameter.grad, grad_object)
        self.assertTrue(torch.equal(parameter.detach().view(torch.uint8), data_bits))
        self.assertTrue(torch.equal(parameter.grad.view(torch.uint8), grad_bits))
        self.assertTrue(torch.equal(torch.get_rng_state(), cpu_rng))
        self.assertEqual(random.getstate(), python_rng)
        after_numpy = np.random.get_state()
        self.assertEqual(numpy_rng[0], after_numpy[0])
        self.assertTrue(np.array_equal(numpy_rng[1], after_numpy[1]))
        self.assertEqual(numpy_rng[2:], after_numpy[2:])
        self.assertEqual(state, (torch.get_num_threads(), torch.get_num_interop_threads(), torch.get_default_dtype(), torch.get_default_device(), torch.is_grad_enabled()))
        unsupported = nn.Parameter(torch.tensor([2.0, -0.0], dtype=torch.float16))
        unsupported.grad = torch.ones_like(unsupported)
        unsupported_bits = unsupported.detach().view(torch.uint8).clone()
        unsupported_version = unsupported._version
        unsupported_grad = unsupported.grad
        with self.assertRaises(TypeError):
            bounded_all_finite(unsupported)
        self.assertIs(torch.isfinite, ORIGINAL_ISFINITE)
        self.assertEqual(unsupported._version, unsupported_version)
        self.assertIs(unsupported.grad, unsupported_grad)
        self.assertTrue(torch.equal(unsupported.detach().view(torch.uint8), unsupported_bits))
        self.assertEqual(parameter._version, version)
        self.assertIs(parameter.grad, grad_object)
        self.assertTrue(torch.equal(parameter.detach().view(torch.uint8), data_bits))
        self.assertTrue(torch.equal(torch.get_rng_state(), cpu_rng))

    def test_unsupported_inputs_rejected_without_math(self):
        invalid = [None, 1.0, [1.0], torch.ones(2, dtype=torch.int64), torch.ones(2, dtype=torch.bool),
                   torch.ones(2, dtype=torch.complex64), torch.ones(2, dtype=torch.float16),
                   torch.ones(2, dtype=torch.bfloat16), torch.sparse_coo_tensor([[0]], [1.0], [2]),
                   torch.empty(2, device="meta", dtype=torch.float32)]
        with mock.patch.object(torch, "isfinite", wraps=ORIGINAL_ISFINITE) as spy:
            for value in invalid:
                with self.subTest(type=type(value)):
                    with self.assertRaises((TypeError, ValueError)):
                        bounded_all_finite(value)
            spy.assert_not_called()
        self.assertIs(torch.isfinite, ORIGINAL_ISFINITE)
        with self.assertRaises(TypeError):
            bounded_all_finite(torch.ones(1), max_block_elements=MAX_BLOCK_ELEMENTS * 2)


if __name__ == "__main__":
    unittest.main()

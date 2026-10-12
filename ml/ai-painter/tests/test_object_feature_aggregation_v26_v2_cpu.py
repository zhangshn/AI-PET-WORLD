"""Numeric successor boundaries; no GPU, weights or training data are used."""
from __future__ import annotations

import ast
from copy import deepcopy
import inspect
import textwrap
import unittest
from unittest.mock import patch

import torch

from test_object_head_train_dropout_v25_cpu import ORDER, dry_scene
from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import (
    AGGREGATION_RULE, ARCHITECTURE, CAPABILITY, DeterministicObjectAssemblyRenderer,
    assemble_object_features, build_fresh_object_feature_aggregation_v26_v2_cpu,
    deterministic_index_add_backend,
)
from ai_painter.complete_world.object_local_context_isolation_v26_cpu import (
    CONTEXT_RULE, build_fresh_object_local_context_isolation_v26_cpu,
)
from ai_painter.complete_world.object_head_core_priority_update_v24 import (
    bind_v23_object_head_parameters,
)


class FakeBackend:
    def __init__(self, mode, warn):
        self.mode, self.warn = mode, warn
        self.calls = []
        self.partial_entry_failure = False
        self.ignore_entry = False

    def are_deterministic_algorithms_enabled(self):
        return self.mode

    def is_deterministic_algorithms_warn_only_enabled(self):
        return self.warn

    def use_deterministic_algorithms(self, mode, *, warn_only):
        self.calls.append((mode, warn_only))
        if self.ignore_entry and len(self.calls) == 1:
            return
        self.mode, self.warn = mode, warn_only
        if self.partial_entry_failure and len(self.calls) == 1:
            raise RuntimeError("partial setting failure")


class DeterministicObjectAssemblyV26V2CpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_all_entry_flags_restore_on_normal_and_exception_exit(self):
        for mode in (False, True):
            for warn in (False, True):
                for error in (False, True):
                    backend = FakeBackend(mode, warn)
                    try:
                        with deterministic_index_add_backend(backend=backend):
                            self.assertEqual((backend.mode, backend.warn), (True, False))
                            if error:
                                raise LookupError("operation failed")
                    except LookupError:
                        self.assertTrue(error)
                    self.assertEqual((backend.mode, backend.warn), (mode, warn))
                    self.assertEqual(backend.calls, [(True, False), (mode, warn)])

    def test_nested_scopes_restore_immediate_and_outer_state(self):
        backend = FakeBackend(False, True)
        with deterministic_index_add_backend(backend=backend):
            with deterministic_index_add_backend(backend=backend):
                self.assertEqual((backend.mode, backend.warn), (True, False))
            self.assertEqual((backend.mode, backend.warn), (True, False))
        self.assertEqual((backend.mode, backend.warn), (False, True))

    def test_partial_setter_failure_restores_both_flags(self):
        backend = FakeBackend(False, True)
        backend.partial_entry_failure = True
        with self.assertRaisesRegex(RuntimeError, "partial setting failure"):
            with deterministic_index_add_backend(backend=backend):
                self.fail("entry failure must not reach the kernel")
        self.assertEqual((backend.mode, backend.warn), (False, True))

    def test_silently_ignored_entry_is_rejected_and_restored(self):
        backend = FakeBackend(False, True)
        backend.ignore_entry = True
        with self.assertRaisesRegex(RuntimeError, "setting not applied"):
            with deterministic_index_add_backend(backend=backend):
                self.fail("strict setting was not applied")
        self.assertEqual((backend.mode, backend.warn), (False, True))

    def test_real_scope_does_not_change_precision_cudnn_rng_or_autocast(self):
        before = (torch.are_deterministic_algorithms_enabled(),
                  torch.is_deterministic_algorithms_warn_only_enabled(),
                  torch.backends.cuda.matmul.fp32_precision,
                  torch.backends.cudnn.conv.fp32_precision,
                  torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic,
                  torch.is_autocast_enabled("cpu"), torch.is_autocast_enabled("cuda"))
        rng = torch.get_rng_state().clone()
        with deterministic_index_add_backend():
            self.assertTrue(torch.are_deterministic_algorithms_enabled())
            self.assertFalse(torch.is_deterministic_algorithms_warn_only_enabled())
        after = (torch.are_deterministic_algorithms_enabled(),
                 torch.is_deterministic_algorithms_warn_only_enabled(),
                 torch.backends.cuda.matmul.fp32_precision,
                 torch.backends.cudnn.conv.fp32_precision,
                 torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic,
                 torch.is_autocast_enabled("cpu"), torch.is_autocast_enabled("cuda"))
        self.assertEqual(before, after)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized())

    def assembly_inputs(self):
        index = [torch.tensor([0, 1, 1]), torch.tensor([1, 2])]
        features = [torch.arange(24).reshape(8, 3).float().requires_grad_(),
                    torch.arange(16).reshape(8, 2).float().requires_grad_()]
        support = [torch.tensor([[1., 1., 0.]]), torch.tensor([[1., 1.]])]
        return torch.zeros(1), index, features, support

    def test_duplicate_indices_sum_count_clamp_and_gradients_are_exact(self):
        reference, index, features, support = self.assembly_inputs()
        source = [value.detach().clone() for value in features]
        actual, count = assemble_object_features(reference, index, features, support, [0, 1])
        expected = torch.zeros(8, 192 * 256).index_add(1, torch.cat(index), torch.cat(features, 1))
        expected_count = torch.zeros(1, 192 * 256).index_add(1, torch.cat(index), torch.cat(support, 1))
        expected = (expected / expected_count.clamp_min(1)).reshape(1, 8, 192, 256)
        self.assertTrue(torch.equal(actual, expected))
        self.assertTrue(torch.equal(count, expected_count.reshape(1, 1, 192, 256)))
        self.assertEqual(float(count[0, 0, 0, 1]), 2.)
        actual_grad = torch.autograd.grad(actual.square().sum(), features)
        expected_grad = torch.autograd.grad(expected.square().sum(), features)
        self.assertTrue(all(torch.equal(a, b) for a, b in zip(actual_grad, expected_grad)))
        self.assertTrue(all(torch.equal(a, b) for a, b in zip(source, features)))
        self.assertTrue(all(value.grad is None for value in features))

    def test_empty_assembly_preserves_original_shape_dtype_and_zero_coverage(self):
        result, count = assemble_object_features(torch.zeros(1), [], [], [], [])
        self.assertEqual(result.shape, (1, 8, 192, 256))
        self.assertEqual(count.shape, (1, 1, 192, 256))
        self.assertEqual(result.dtype, torch.float32)
        self.assertEqual(int(result.count_nonzero()) + int(count.count_nonzero()), 0)

    def test_two_index_adds_run_strictly_and_unsupported_kernel_fails_closed(self):
        inputs = self.assembly_inputs()
        before = (torch.are_deterministic_algorithms_enabled(),
                  torch.is_deterministic_algorithms_warn_only_enabled())
        kernel, observed = torch.Tensor.index_add, []
        def checked(tensor, *args, **kwargs):
            observed.append((torch.are_deterministic_algorithms_enabled(),
                             torch.is_deterministic_algorithms_warn_only_enabled()))
            return kernel(tensor, *args, **kwargs)
        with patch.object(torch.Tensor, "index_add", checked):
            assemble_object_features(*inputs, [0, 1])
        self.assertEqual(observed, [(True, False), (True, False)])
        with patch.object(torch.Tensor, "index_add", side_effect=RuntimeError("unsupported kernel")):
            with self.assertRaisesRegex(RuntimeError, "unsupported kernel"):
                assemble_object_features(*inputs, [0, 1])
        self.assertEqual(before, (torch.are_deterministic_algorithms_enabled(),
                                torch.is_deterministic_algorithms_warn_only_enabled()))

    def test_invalid_selection_or_tensor_metadata_is_rejected(self):
        inputs = self.assembly_inputs()
        for selection in ([True], [-1], [2], [0, 0], "0"):
            with self.assertRaisesRegex(ValueError, "selection differs"):
                assemble_object_features(*inputs, selection)
        reference, indices, features, supports = inputs
        with self.assertRaisesRegex(ValueError, "tensors differ"):
            assemble_object_features(reference, indices, [features[0].double(), features[1]], supports, [0])

    def test_fresh_model_identity_parameter_names_rng_and_historical_load_boundary(self):
        rng = torch.get_rng_state().clone()
        with patch.object(torch, "load", side_effect=AssertionError("historical load prohibited")):
            old = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
            new = build_fresh_object_feature_aggregation_v26_v2_cpu(condition_channel_order=ORDER)
        self.assertEqual(new.architecture_id, ARCHITECTURE)
        self.assertEqual(new.capability_version, CAPABILITY)
        self.assertEqual(new.object_aggregation_rule, AGGREGATION_RULE)
        self.assertEqual(new.object_context_rule, CONTEXT_RULE)
        self.assertFalse(new.execution_qualified)
        self.assertFalse(new.parent_checkpoint_loaded)
        self.assertEqual(tuple(old.state_dict()), tuple(new.state_dict()))
        self.assertTrue(all(torch.equal(old.state_dict()[key], value)
                            for key, value in new.state_dict().items()))
        parameters, groups = bind_v23_object_head_parameters(new)
        self.assertEqual(len(parameters), 106)
        self.assertEqual(sum(value.numel() for value in parameters), 2239519)
        self.assertEqual(len(groups), 4)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))

    def test_cpu_forward_all_evidence_and_sources_equal_in_eval_and_train(self):
        old = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
        new = build_fresh_object_feature_aggregation_v26_v2_cpu(condition_channel_order=ORDER)
        conditions, table = dry_scene()
        source, instances = conditions.clone(), deepcopy(table)
        def exact(a, b):
            if isinstance(a, torch.Tensor):
                self.assertTrue(torch.equal(a, b))
            elif isinstance(a, dict):
                self.assertEqual(set(a), set(b))
                for key in a:
                    exact(a[key], b[key])
            else:
                self.assertEqual(a, b)
        for training in (False, True):
            old.train(training); new.train(training)
            with torch.no_grad():
                a, evidence_a = old(conditions, table, return_evidence=True)
                b, evidence_b = new(conditions, table, return_evidence=True)
                exact(a, b); exact(evidence_a, evidence_b)
                exact(b, new(conditions, table))
        self.assertTrue(torch.equal(source, conditions))
        self.assertEqual(table, instances)

    def test_invalid_authoritative_instances_still_rejected_without_flag_leak(self):
        new = build_fresh_object_feature_aggregation_v26_v2_cpu(condition_channel_order=ORDER)
        conditions, table = dry_scene()
        conditions[:, ORDER.index("object_tree")] = 0
        before = torch.are_deterministic_algorithms_enabled()
        with self.assertRaisesRegex(ValueError, "authoritative role mask"):
            new(conditions, table)
        self.assertEqual(torch.are_deterministic_algorithms_enabled(), before)

    def test_forward_ast_diff_is_only_assembly_and_explicit_closure_inputs(self):
        old = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
        old_function = ast.parse(textwrap.dedent(inspect.getsource(type(old.core.core).forward))).body[0]
        new_function = ast.parse(textwrap.dedent(inspect.getsource(DeterministicObjectAssemblyRenderer.forward))).body[0]
        old_body = [node for node in old_function.body if not isinstance(node, ast.FunctionDef)]
        new_body = [node for node in new_function.body[2:] if not isinstance(node, ast.FunctionDef)]
        self.assertEqual([ast.dump(node) for node in old_body], [ast.dump(node) for node in new_body])
        self.assertEqual([node.name for node in new_function.body if isinstance(node, ast.FunctionDef)], ["assemble"])


if __name__ == "__main__":
    unittest.main()

"""CPU tests for the inactive V24 object-head core-priority candidate."""
from __future__ import annotations

from copy import deepcopy
import random
import unittest

import numpy as np
import torch
from torch import nn

from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    CANDIDATE_ID,
    OBJECT_HEAD_KEYS,
    apply_object_head_core_priority_update_v24_cpu,
)


class TinyCandidate(nn.Module):
    def __init__(self, width=2):
        super().__init__()
        self.backbone = nn.Linear(width, 1, bias=False)
        self.object_rgb_heads = nn.ModuleDict({
            key: nn.Linear(width, 1, bias=False) for key in OBJECT_HEAD_KEYS
        })


def tensors(model, fill=0.0):
    return tuple(torch.full_like(parameter, fill) for parameter in model.parameters())


def apply(model, core, whole, structured, total):
    return apply_object_head_core_priority_update_v24_cpu(
        model=model, parameters=tuple(model.parameters()), core_gradients=core,
        whole_frame_gradients=whole, structured_gradients=structured,
        total_gradients=total)


def set_head(values, model, key, vector):
    indexes = {id(parameter): index for index, parameter in enumerate(model.parameters())}
    result = list(values)
    for parameter in model.object_rgb_heads[key].parameters():
        result[indexes[id(parameter)]] = torch.tensor(vector, dtype=torch.float32).reshape_as(parameter)
    return tuple(result)


class ObjectHeadCorePriorityUpdateV24CpuTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.model = TinyCandidate()
        self.parameters = tuple(self.model.parameters())

    def gradient_case(self, core_vector, other_vector, key="object_tree"):
        core = set_head(tensors(self.model), self.model, key, core_vector)
        whole = set_head(tensors(self.model), self.model, key, other_vector)
        structured = tensors(self.model)
        total = tuple((s + w) + c for c, w, s in zip(core, whole, structured))
        return core, whole, structured, total

    def test_hand_computable_conflict_projection(self):
        core, whole, structured, total = self.gradient_case([1, 0], [-2, 1])
        candidate, facts = apply(self.model, core, whole, structured, total)
        index = {id(p): i for i, p in enumerate(self.parameters)}[
            id(self.model.object_rgb_heads["object_tree"].weight)]
        self.assertTrue(torch.equal(candidate[index], torch.tensor([[1.0, 1.0]])))
        head = facts["headDiagnostics"]["object_tree"]
        self.assertEqual(head["branch"], "conflict_projected")
        self.assertEqual(head["qCoreSquaredL2"], 1.0)
        self.assertEqual(head["dCoreDotOther"], -2.0)
        self.assertEqual(head["candidateCoreVsTotal"]["dot"], 1.0)

    def test_nonconflict_orthogonal_and_zero_core_preserve_total_bytes(self):
        cases = (([1, 0], [2, 1], "non_conflict_preserve_actual_total"),
                 ([1, 0], [0, 2], "non_conflict_preserve_actual_total"),
                 ([0, 0], [-2, 1], "core_zero_preserve_actual_total"))
        for core_vector, other_vector, branch in cases:
            with self.subTest(branch=branch, other=other_vector):
                core, whole, structured, total = self.gradient_case(core_vector, other_vector)
                candidate, facts = apply(self.model, core, whole, structured, total)
                self.assertTrue(all(torch.equal(x.view(torch.uint8), y.view(torch.uint8))
                                    for x, y in zip(candidate, total)))
                self.assertEqual(facts["headDiagnostics"]["object_tree"]["branch"], branch)

    def test_four_heads_are_independent_and_nonheads_stay_byte_identical(self):
        core = tensors(self.model); whole = tensors(self.model); structured = tensors(self.model)
        cases = {
            "object_footprints": ([1, 0], [-2, 1], [1, 1], "conflict_projected"),
            "object_tree": ([2, 0], [-1, 1], [2, 1], "conflict_projected"),
            "object_rock": ([1, 1], [-2, 0], [0, 2], "conflict_projected"),
            "object_vegetation": ([1, 0], [1, -1], [2, -1],
                                  "non_conflict_preserve_actual_total"),
        }
        for key, (core_value, other_value, _, _) in cases.items():
            core = set_head(core, self.model, key, core_value)
            whole = set_head(whole, self.model, key, other_value)
        structured = list(structured)
        backbone_index = {id(parameter): index for index, parameter in
                          enumerate(self.parameters)}[id(self.model.backbone.weight)]
        structured[backbone_index] = torch.tensor([[3.0, -0.0]])
        structured = tuple(structured)
        total = list((s + w) + c for c, w, s in zip(core, whole, structured))
        total[backbone_index] = torch.tensor([[3.0, -0.0]])
        total = tuple(total)
        before = tuple(value.clone() for value in total)
        candidate, facts = apply(self.model, core, whole, structured, total)
        indexes = {id(parameter): index for index, parameter in enumerate(self.parameters)}
        for key, (_, _, expected, branch) in cases.items():
            index = indexes[id(self.model.object_rgb_heads[key].weight)]
            self.assertTrue(torch.equal(candidate[index], torch.tensor([expected], dtype=torch.float32)))
            self.assertEqual(facts["headDiagnostics"][key]["branch"], branch)
        self.assertTrue(torch.equal(candidate[backbone_index].contiguous().view(torch.uint8),
                                    before[backbone_index].contiguous().view(torch.uint8)))
        self.assertTrue(torch.signbit(candidate[backbone_index][0, 1]))
        self.assertEqual(facts["nonHeadParameterTensorCount"], 1)

    def test_unused_gradients_are_zero_and_recorded(self):
        count = len(self.parameters)
        candidate, facts = apply(self.model, (None,) * count, (None,) * count,
                                 (None,) * count, (None,) * count)
        self.assertTrue(all(torch.count_nonzero(value) == 0 for value in candidate))
        for head in facts["headDiagnostics"].values():
            self.assertGreater(head["unusedGradientTensorCount"]["core"], 0)
            self.assertIsNone(head["rawCoreVsOther"]["cosine"])

    def test_illegal_mapping_parameter_alias_and_gradient_alias_rejected(self):
        core = tensors(self.model); zero = tensors(self.model)
        with self.assertRaisesRegex(ValueError, "complete model parameter"):
            apply_object_head_core_priority_update_v24_cpu(
                model=self.model, parameters=self.parameters[:-1], core_gradients=core[:-1],
                whole_frame_gradients=zero[:-1], structured_gradients=zero[:-1],
                total_gradients=core[:-1])
        missing = TinyCandidate(); del missing.object_rgb_heads["object_rock"]
        with self.assertRaisesRegex(ValueError, "exactly the four"):
            apply(missing, tensors(missing), tensors(missing), tensors(missing), tensors(missing))
        aliased = TinyCandidate()
        aliased.object_rgb_heads["object_rock"].weight = aliased.object_rgb_heads["object_tree"].weight
        with self.assertRaisesRegex(ValueError, "aliases"):
            apply(aliased, tensors(aliased), tensors(aliased), tensors(aliased), tensors(aliased))
        storage_aliased = TinyCandidate()
        shared = storage_aliased.object_rgb_heads["object_tree"].weight.detach()
        storage_aliased.object_rgb_heads["object_rock"].weight = nn.Parameter(shared)
        self.assertIsNot(storage_aliased.object_rgb_heads["object_tree"].weight,
                         storage_aliased.object_rgb_heads["object_rock"].weight)
        self.assertEqual(storage_aliased.object_rgb_heads["object_tree"].weight
                         .untyped_storage().data_ptr(),
                         storage_aliased.object_rgb_heads["object_rock"].weight
                         .untyped_storage().data_ptr())
        with self.assertRaisesRegex(ValueError, "storage aliases"):
            apply(storage_aliased, tensors(storage_aliased), tensors(storage_aliased),
                  tensors(storage_aliased), tensors(storage_aliased))
        repeated_gradient = list(zero)
        repeated_gradient[1] = repeated_gradient[0]
        with self.assertRaisesRegex(ValueError, "aliased gradient"):
            apply(self.model, tuple(repeated_gradient), zero, zero, tuple(repeated_gradient))

    def test_metadata_nonfinite_total_identity_and_output_overflow_rejected(self):
        core = tensors(self.model); zero = tensors(self.model)
        bad_shape = list(core); bad_shape[0] = torch.zeros(3)
        with self.assertRaisesRegex(ValueError, "shape differs"):
            apply(self.model, tuple(bad_shape), zero, zero, core)
        bad = list(core); bad[0] = torch.full_like(bad[0], float("nan"))
        with self.assertRaisesRegex(ValueError, "finite"):
            apply(self.model, tuple(bad), zero, zero, core)
        wrong_total = list(core); wrong_total[0] = torch.ones_like(wrong_total[0])
        with self.assertRaisesRegex(ValueError, "total gradient identity"):
            apply(self.model, core, zero, zero, tuple(wrong_total))

        core, whole, structured, total = self.gradient_case([1, 2], [3e38, -3e38])
        with self.assertRaisesRegex(ValueError, "overflowed float32"):
            apply(self.model, core, whole, structured, total)

    def test_extremely_small_nonzero_core_is_not_swallowed_by_epsilon(self):
        core, whole, structured, total = self.gradient_case(
            [1e-30, 0], [-1e-30, 1e-30])
        candidate, facts = apply(self.model, core, whole, structured, total)
        head = facts["headDiagnostics"]["object_tree"]
        self.assertGreater(head["qCoreSquaredL2"], 0)
        self.assertLess(head["dCoreDotOther"], 0)
        self.assertEqual(head["branch"], "conflict_projected")
        index = {id(p): i for i, p in enumerate(self.parameters)}[
            id(self.model.object_rgb_heads["object_tree"].weight)]
        self.assertTrue(torch.equal(candidate[index], torch.tensor([[1e-30, 1e-30]])))

    def test_inputs_parameters_grads_state_and_rng_are_unchanged(self):
        core, whole, structured, total = self.gradient_case([1, 0], [-2, 1])
        inputs = tuple(tuple(None if x is None else x.clone() for x in values)
                       for values in (core, whole, structured, total))
        state = deepcopy(self.model.state_dict())
        for parameter in self.parameters:
            parameter.grad = torch.ones_like(parameter)
        grads = tuple(parameter.grad.clone() for parameter in self.parameters)
        torch_rng = torch.get_rng_state().clone()
        python_rng = random.getstate()
        numpy_rng = np.random.get_state()
        candidate, facts = apply(self.model, core, whole, structured, total)
        self.assertEqual(facts["candidateId"], CANDIDATE_ID)
        self.assertTrue(all(torch.equal(a, b) for values, originals in
                            zip((core, whole, structured, total), inputs)
                            for a, b in zip(values, originals)))
        self.assertTrue(all(torch.equal(state[key], self.model.state_dict()[key]) for key in state))
        self.assertTrue(all(torch.equal(parameter.grad, before)
                            for parameter, before in zip(self.parameters, grads)))
        self.assertTrue(torch.equal(torch_rng, torch.get_rng_state()))
        self.assertEqual(python_rng, random.getstate())
        after_numpy = np.random.get_state()
        self.assertEqual(numpy_rng[0], after_numpy[0])
        self.assertTrue(np.array_equal(numpy_rng[1], after_numpy[1]))
        self.assertEqual(numpy_rng[2:], after_numpy[2:])
        self.assertTrue(all(value.grad_fn is None for value in candidate))

    def test_adamw_formula_counterexample_raw_geometry_is_not_learning_proof(self):
        model = TinyCandidate(width=1)
        count = len(tuple(model.parameters()))
        core = tuple(torch.zeros_like(p) for p in model.parameters())
        zero = tuple(torch.zeros_like(p) for p in model.parameters())
        core = set_head(core, model, "object_tree", [-1])
        total = tuple(c.clone() for c in core)
        candidate, facts = apply(model, core, zero, zero, total)
        # Deterministic first-step AdamW formula.  The candidate gradient is
        # aligned with the core gradient, while decoupled weight decay is large
        # enough to move the parameter in the opposite direction.  No optimizer
        # object or parameter mutation is needed to establish the counterexample.
        parameter_before = 1.0
        gradient = -1.0
        learning_rate = 0.1
        weight_decay = 20.0
        epsilon = 1e-8
        normalized_first_moment = gradient
        normalized_second_moment = gradient * gradient
        parameter_after = (parameter_before * (1 - learning_rate * weight_decay)
                           - learning_rate * normalized_first_moment
                           / (normalized_second_moment ** 0.5 + epsilon))
        old_core_loss = -parameter_before
        new_core_loss = -parameter_after
        self.assertGreater(facts["headDiagnostics"]["object_tree"]
                           ["rawCoreVsActualTotal"]["dot"], 0)
        self.assertGreater(new_core_loss, old_core_loss)


if __name__ == "__main__":
    unittest.main()

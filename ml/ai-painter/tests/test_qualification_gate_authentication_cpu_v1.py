"""Synthetic CPU checks for same-call gate authentication, not model evidence.

Only model binding/parameter graph validation are stubbed.  The arithmetic gate,
its require function, source checks and exception traceback are real.
"""
from contextlib import ExitStack
import hashlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]

import torch
import diagnose_parameter40_qualification_v1 as diagnostic
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate
from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target0Observation, Target40Observation


class GateAuthenticationCpuTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.tripwires = ExitStack()
        self.addCleanup(self.tripwires.close)
        for owner, attribute in ((torch.autograd, "grad"), (torch.autograd, "backward"),
                                 (torch.Tensor, "backward"), (torch.cuda, "_lazy_init"),
                                 (torch.nn.Module, "__init__"), (torch.nn.Module, "_call_impl"),
                                 (torch.nn.Module, "forward"),
                                 (Target0Observation, "compact"), (Target40Observation, "compact"),
                                 (Target40Observation, "_compact_ready")):
            tripwire = self.tripwires.enter_context(patch.object(
                owner, attribute, side_effect=AssertionError("forbidden execution: " + attribute)))
            self.addCleanup(tripwire.assert_not_called)

    def original_failure(self, observation_type=Target0Observation, *, noncontiguous=False, overflow=False):
        observation = observation_type.__new__(observation_type)
        index, shape = observation.index, observation.shape
        parameters = tuple(torch.zeros(shape if i == index else (1,), dtype=torch.float32) for i in range(108))
        rows = [[torch.zeros_like(p) for p in parameters] for _ in range(5)]
        scalars = (1.0e38,) * 5 if overflow else (99.0, 1.0, 2.0, 3.0, 4.0)
        for values, scalar in zip(rows, scalars):
            values[index].fill_(scalar)
            if noncontiguous:
                values[index] = values[index].transpose(-1, -2)
        observation.raw = [values[index].clone() for values in rows]
        groups = {}
        caught = None
        with patch.object(gate, "bind_parameters", return_value=(parameters, groups, (), ())), patch.object(
                gate, "_validate_model_and_parameters", return_value=(parameters, groups)):
            try:
                gate.apply_object_joint_rgb_structure_priority_update_cpu(
                    model=object(), parameters=parameters, total_gradients=rows[0],
                    structured_gradients=rows[1], whole_frame_gradients=rows[2],
                    core_gradients=rows[3], support_gradients=rows[4])
            except ValueError as error:
                caught = error
        self.assertIsNotNone(caught)
        self.assertEqual(str(caught), "actual four-term total gradient identity differs at parameter " + str(index))
        programs = {}
        for function in (gate.apply_object_joint_rgb_structure_priority_update_cpu, gate.require):
            path = Path(function.__code__.co_filename).absolute()
            programs[path.relative_to(ROOT).as_posix()] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        return caught, observation, programs, rows

    def test_rejects_empty_raw(self):
        error, observation, programs, _ = self.original_failure()
        observation.raw = []
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(error, observation, programs)

    def assert_authenticated(self, error, observation, programs):
        result = diagnostic.authenticate_gate(error, observation, programs)
        self.assertIs(result["sameCallInputsVerified"], True)
        self.assertEqual(result["verifiedGradientSets"], 5)
        self.assertEqual(result["parameterIndex"], observation.index)
        self.assertIs(result["historicalReplay"], False)
        self.assertEqual(result["message"], str(error))

    def test_authenticates_real_target0_with_all_five_groups(self):
        error, observation, programs, _ = self.original_failure()
        self.assert_authenticated(error, observation, programs)

    def test_authenticates_real_target40_with_all_five_groups(self):
        error, observation, programs, _ = self.original_failure(Target40Observation)
        self.assert_authenticated(error, observation, programs)

    def test_accepts_strided_noncontiguous_tensors(self):
        error, observation, programs, rows = self.original_failure(noncontiguous=True)
        self.assertTrue(all(not value.is_contiguous() for value in observation.raw))
        self.assertTrue(all(not values[0].is_contiguous() for values in rows))
        self.assert_authenticated(error, observation, programs)

    def test_accepts_finite_terms_with_overflowing_ordered_sum(self):
        error, observation, programs, _ = self.original_failure(overflow=True)
        self.assertTrue(all(bool(torch.isfinite(value).all()) for value in observation.raw))
        total = observation.raw[1] + observation.raw[2] + observation.raw[3] + observation.raw[4]
        self.assertTrue(bool(torch.isinf(total).all()))
        self.assert_authenticated(error, observation, programs)

    def test_accepts_tuple_of_five_captures(self):
        error, observation, programs, _ = self.original_failure()
        observation.raw = tuple(observation.raw)
        self.assert_authenticated(error, observation, programs)

    def test_rejects_one_through_four_or_six_raw_groups(self):
        for count in (1, 2, 3, 4, 6):
            with self.subTest(count=count):
                error, observation, programs, _ = self.original_failure()
                observation.raw = (observation.raw + [observation.raw[0].clone()])[:count]
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_generator_capture_container(self):
        error, observation, programs, _ = self.original_failure()
        observation.raw = (value for value in observation.raw)
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_reordered_distinct_captures(self):
        error, observation, programs, _ = self.original_failure()
        self.assertEqual(len(set(float(value.reshape(-1)[0]) for value in observation.raw)), 5)
        observation.raw[1], observation.raw[2] = observation.raw[2], observation.raw[1]
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_changed_bytes_in_each_capture(self):
        for index in range(5):
            with self.subTest(group=index):
                error, observation, programs, _ = self.original_failure()
                observation.raw[index].reshape(-1)[0] += 1
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_wrong_observation_type(self):
        for observation_type in (Target0Observation, Target40Observation):
            with self.subTest(target=observation_type.index):
                error, observation, programs, _ = self.original_failure(observation_type)
                impostor = types.SimpleNamespace(index=observation.index, name=observation.name,
                                                 shape=observation.shape, raw=observation.raw)
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, impostor, programs)

    def test_rejects_subclassed_observation(self):
        for observation_type in (Target0Observation, Target40Observation):
            with self.subTest(target=observation_type.index):
                error, observation, programs, _ = self.original_failure(observation_type)
                subtype = type("ObservationSubclass", (observation_type,), {})
                impostor = subtype.__new__(subtype)
                impostor.raw = observation.raw
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, impostor, programs)

    def test_rejects_wrong_observation_index(self):
        for index in (1, 40, True, 0.0):
            with self.subTest(index=repr(index)):
                error, observation, programs, _ = self.original_failure()
                observation.index = index
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_wrong_observation_name(self):
        error, observation, programs, _ = self.original_failure()
        observation.name = "core.core.terrain.decode_2.layers.0.weight"
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_wrong_observation_shape(self):
        error, observation, programs, _ = self.original_failure()
        observation.shape = (observation.raw[0].numel(),)
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(error, observation, programs)

    @staticmethod
    def malformed_tensor(value, kind):
        if kind == "type":
            return None
        if kind == "shape":
            return value.reshape(-1)
        if kind == "dtype":
            return value.view(torch.int32)
        if kind == "layout":
            return value.to_sparse()
        if kind == "device":
            return torch.empty(value.shape, dtype=torch.float32, device="meta")
        if kind == "requires_grad":
            return value.clone().requires_grad_(True)
        if kind == "nonfinite":
            return torch.full_like(value, float("nan"))
        raise AssertionError("unknown malformed tensor kind")

    def test_rejects_capture_tensor_metadata_before_hash(self):
        for kind in ("type", "shape", "dtype", "layout", "device", "requires_grad", "nonfinite"):
            with self.subTest(kind=kind):
                error, observation, programs, _ = self.original_failure()
                observation.raw[0] = self.malformed_tensor(observation.raw[0], kind)
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_mutated_gate_target_metadata_before_hash(self):
        for kind in ("type", "shape", "dtype", "layout", "device", "requires_grad", "nonfinite"):
            with self.subTest(kind=kind):
                error, observation, programs, rows = self.original_failure()
                rows[0][observation.index] = self.malformed_tensor(rows[0][observation.index], kind)
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_wrong_count_in_each_gate_input(self):
        for group in range(5):
            for count in (107, 109):
                with self.subTest(group=group, count=count):
                    error, observation, programs, rows = self.original_failure()
                    if count == 107:
                        rows[group].pop()
                    else:
                        rows[group].append(torch.zeros(1, dtype=torch.float32))
                    with self.assertRaises(ValueError):
                        diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_same_text_exception_without_gate_traceback(self):
        original, observation, programs, _ = self.original_failure()
        counterfeit = None
        try:
            raise ValueError(str(original))
        except ValueError as error:
            counterfeit = error
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(counterfeit, observation, programs)

    def test_rejects_exception_subclass(self):
        original, observation, programs, _ = self.original_failure()
        class DerivedValueError(ValueError):
            pass
        with self.assertRaises(ValueError):
            diagnostic.authenticate_gate(DerivedValueError(str(original)), observation, programs)

    def test_rejects_wrong_source_hash_for_gate_and_require(self):
        for function in (gate.apply_object_joint_rgb_structure_priority_update_cpu, gate.require):
            with self.subTest(function=function.__name__):
                error, observation, programs, _ = self.original_failure()
                logical = Path(function.__code__.co_filename).absolute().relative_to(ROOT).as_posix()
                programs[logical]["sha256"] = "0" * 64
                with self.assertRaises(ValueError):
                    diagnostic.authenticate_gate(error, observation, programs)

    def test_rejects_replaced_gate_or_require_code(self):
        for attribute in ("apply_object_joint_rgb_structure_priority_update_cpu", "require"):
            with self.subTest(function=attribute):
                error, observation, programs, _ = self.original_failure()
                original = getattr(gate, attribute)
                altered = original.__code__.replace(co_consts=original.__code__.co_consts + ("negative-test-replacement",))
                replacement = types.FunctionType(altered, original.__globals__, original.__name__,
                                                 original.__defaults__, original.__closure__)
                # The altered function is never executed. Authentication must reject it;
                # the error and its traceback still come from the original gate.
                with patch.object(gate, attribute, replacement):
                    with self.assertRaises(ValueError):
                        diagnostic.authenticate_gate(error, observation, programs)


if __name__ == "__main__":
    unittest.main(verbosity=2)

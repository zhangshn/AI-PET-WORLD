"""CPU synthetic hooks/arithmetic only: no model forward or autograd."""
from contextlib import ExitStack
import math
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

import torch
from torch import nn

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
from ai_painter.complete_world import parameter0_training_causal_observation_v1 as observed


class SyntheticGraph(nn.Module):
    def __init__(self):
        super().__init__()
        # Native type/attributes, manually allocated fixed values. No random
        # initializer or model factory; this layer is never called.
        self.layer = object.__new__(nn.Conv2d)
        nn.Module.__init__(self.layer)
        self.layer.weight = nn.Parameter(torch.zeros(observed.TARGET_SHAPE))
        self.layer.bias = nn.Parameter(torch.zeros(48))
        for key, value in dict(in_channels=31, out_channels=48, kernel_size=(3, 3),
                stride=(1, 1), padding=(1, 1), dilation=(1, 1), groups=1, padding_mode="zeros").items():
            setattr(self.layer, key, value)
        self.rows = [(observed.TARGET_NAME, self.layer.weight), ("synthetic.bias", self.layer.bias)]
        self.rows += [("synthetic." + str(i), nn.Parameter(torch.zeros(1))) for i in range(106)]

    def named_parameters(self, *args, **kwargs):
        return iter(self.rows)

    def parameters(self, *args, **kwargs):
        return (value for _, value in self.rows)

    def get_submodule(self, name):
        if name != observed.TARGET_MODULE:
            raise ValueError("wrong synthetic target")
        return self.layer


class CaptureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() > 2:
            torch.set_num_interop_threads(2)

    def setUp(self):
        self.stack = ExitStack()
        self.calls = {}
        for owner, name in ((torch.autograd, "grad"), (torch.autograd, "backward"),
                            (torch.Tensor, "backward"), (nn.Module, "_call_impl"),
                            (torch.cuda, "_lazy_init"), (torch.cuda, "init"),
                            (torch.optim.Optimizer, "__init__"), (torch.optim.Optimizer, "step")):
            key = str(owner) + "." + name
            self.calls[key] = 0
            def fail(*args, _key=key, **kwargs):
                self.calls[_key] += 1
                raise AssertionError("prohibited " + _key)
            self.stack.enter_context(patch.object(owner, name, side_effect=fail))

    def tearDown(self):
        self.stack.close()
        self.assertEqual(sum(self.calls.values()), 0)
        self.assertFalse(torch.cuda.is_initialized())

    def gradients(self, *, fixed=True):
        values = [torch.zeros(observed.TARGET_SHAPE) for _ in range(5)]
        values[0][observed.COORDINATES[0] if fixed else (0, 0, 0, 0)] = 1
        return values

    def arithmetic(self):
        x = torch.arange(12, dtype=torch.float32).reshape(1, 1, 3, 4).clone()
        adjoints = [(torch.arange(12, dtype=torch.float32).reshape(1, 1, 3, 4) + i + 1).clone()
                    for i in range(5)]
        config = dict(weight_shape=observed.TARGET_SHAPE, stride=(1, 1), padding=(1, 1), dilation=(1, 1), groups=1)
        return x, adjoints, self.gradients(), config

    def populated(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        gradients = self.gradients()
        with watcher:
            x = torch.zeros(1, 31, 192, 256)
            output = torch.zeros(1, 48, 192, 256, requires_grad=True)
            # Drive actual hook bodies without invoking Module.forward/autograd.
            self.assertIsNone(watcher.target_observation.forward(model.layer, (x,), output))
            for label, gradient in zip(observed.LABELS, gradients):
                watcher("attempt", label, None)
                self.assertIsNone(watcher.target_observation.adjoint(torch.zeros_like(output, requires_grad=False)))
                rows = [None] * 108
                rows[0] = gradient
                watcher("complete", label, rows)
        return model, watcher

    def test_fixed_padding_reference_matches_independent_scalar_loop(self):
        x, adjoints, gradients, config = self.arithmetic()
        events = []
        result = observed.decompose_target_gradients(x, adjoints, gradients, convolution=config,
                                                      on_reference=lambda *event: events.append(event))
        expected = [math.fsum(float(x[0, 0, h - 1, w - 1]) * float(dy[0, 0, h, w])
                              for h in range(1, 3) for w in range(1, 4)) for dy in adjoints]
        self.assertEqual([float(value[0]) for value in result["referenceGradients"]], expected)
        self.assertEqual(events, [(stage, label) for label in observed.LABELS for stage in ("attempt", "complete")])
        self.assertEqual(result["referenceVjpCount"], 5)
        self.assertFalse(result["spatialMatchesProduction"])
        self.assertLessEqual(result["maximumResidual"], 1e-12)

    def test_same_call_fixed_planes_and_raw_identity(self):
        model, watcher = self.populated()
        evidence = watcher.evidence()
        self.assertIs(type(watcher.target_observation), observed.Target0Observation)
        self.assertEqual(tuple(evidence["input_tensor"].shape), (1, 1, 192, 256))
        self.assertEqual(evidence["metadata"]["coordinates"], [[1, 13, 0, 0]])
        self.assertEqual(evidence["metadata"]["objectiveCaptures"], 5)
        self.assertLess(evidence["metadata"]["combinedWorkspaceBound"], 64 * 1024**2)
        self.assertLess(evidence["metadata"]["targetTensorPayloadIncludingRawDuplicate"] + 65536, 2 * 1024**2)
        self.assertFalse(model.layer._forward_hooks)
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))
        again = watcher.evidence()
        self.assertIs(again["input_tensor"], evidence["input_tensor"])
        self.assertIs(again["native_gradients"][0], watcher.target_observation.raw[0])

    def test_compact_evidence_tampering_rejected(self):
        _, watcher = self.populated()
        evidence = watcher.evidence()
        evidence["input_tensor"][0, 0, 0, 0] = 1
        with self.assertRaisesRegex(ValueError, "compact evidence bytes"):
            watcher.evidence()

    def test_fixed_coordinate_pass_does_not_follow_another_failure(self):
        gradients = self.gradients(fixed=False)
        result = observed.fixed_coordinate_failure(gradients)
        self.assertFalse(result["referenceAllowed"])
        self.assertEqual(result["classification"], "selected_coordinate_not_reproduced")
        x, dy, _, config = self.arithmetic()
        calls = []
        with self.assertRaisesRegex(ValueError, "not reproduced"):
            observed.decompose_target_gradients(x, dy, gradients, convolution=config, on_reference=lambda *v: calls.append(v))
        self.assertFalse(calls)

    def test_successful_original_comparison_has_zero_reference(self):
        gradients = [torch.zeros(observed.TARGET_SHAPE) for _ in range(5)]
        result = observed.fixed_coordinate_failure(gradients)
        self.assertFalse(result["selectedCoordinatesReproduced"])
        self.assertEqual(result["referenceVjpCount"], 0)

    def test_finite_components_with_overflow_have_zero_reference(self):
        gradients = self.gradients()
        gradients[1].fill_(3e38)
        gradients[2].fill_(3e38)
        result = observed.fixed_coordinate_failure(gradients)
        self.assertEqual(result["classification"], "ordered_component_sum_nonfinite")
        self.assertFalse(result["referenceAllowed"])
        self.assertIsNone(result["selectedExpected"]["value"])
        x, dy, _, config = self.arithmetic()
        calls = []
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            observed.decompose_target_gradients(x, dy, gradients, convolution=config, on_reference=lambda *v: calls.append(v))
        self.assertFalse(calls)

    def test_wrong_coordinate_rejected(self):
        for value in (((0, 13, 0, 0),), ((1, 13, 1, 0),), ((True, 13, 0, 0),), (), ((1, 13, 0, 0), (1, 13, 0, 0))):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "fixed"):
                observed.fixed_coordinate_failure(self.gradients(), coordinates=value)

    def test_missing_extra_and_wrong_target_gradients_rejected(self):
        for values in ([], self.gradients()[:4], self.gradients() + [torch.zeros(observed.TARGET_SHAPE)],
                       iter(self.gradients()), [torch.zeros(1)] * 5):
            with self.subTest(kind=type(values)), self.assertRaises(ValueError):
                observed.fixed_coordinate_failure(values)

    def test_dtype_device_and_nonfinite_rejected(self):
        for target in (torch.zeros(observed.TARGET_SHAPE, dtype=torch.float64),
                       torch.zeros(observed.TARGET_SHAPE, device="meta"),
                       torch.full(observed.TARGET_SHAPE, float("nan")),
                       torch.zeros(observed.TARGET_SHAPE, requires_grad=True)):
            values = self.gradients()
            values[0] = target
            with self.assertRaises(ValueError):
                observed.fixed_coordinate_failure(values)

    def test_aliased_planes_rejected(self):
        x, dy, gradients, config = self.arithmetic()
        dy[1] = dy[0]
        with self.assertRaisesRegex(ValueError, "alias"):
            observed.decompose_target_gradients(x, dy, gradients, convolution=config)

    def test_noncontiguous_planes_preserve_value_and_state(self):
        x, dy, gradients, config = self.arithmetic()
        x = x.transpose(2, 3)
        dy = [v.transpose(2, 3) for v in dy]
        before = observed.sha(x)
        result = observed.decompose_target_gradients(x, dy, gradients, convolution=config)
        self.assertEqual(observed.sha(x), before)
        self.assertEqual(result["referenceVjpCount"], 5)

    def test_wrong_convolution_geometry_rejected(self):
        x, dy, gradients, config = self.arithmetic()
        for key, value in (("padding", (0, 0)), ("groups", 2), ("stride", (2, 2))):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "convolution"):
                observed.decompose_target_gradients(x, dy, gradients, convolution=dict(config, **{key: value}))

    def test_incomplete_observer_preserves_original_and_removes_hook(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        primary = RuntimeError("primary exact")
        with self.assertRaises(RuntimeError) as result:
            with watcher:
                raise primary
        self.assertIs(result.exception, primary)
        self.assertIn("incomplete", primary.parameter0_observation_error)
        self.assertFalse(model.layer._forward_hooks)
        with self.assertRaisesRegex(ValueError, "closed complete"):
            watcher.evidence()

    def test_all_handles_attempted_when_one_removal_fails(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        bad, good = Mock(), Mock()
        bad.remove.side_effect = RuntimeError("synthetic remove failed")
        primary = RuntimeError("first error")
        with self.assertRaises(RuntimeError) as result:
            with watcher:
                watcher.target_observation.handles.extend((bad, good))
                raise primary
        self.assertIs(result.exception, primary)
        bad.remove.assert_called_once()
        good.remove.assert_called_once()
        self.assertFalse(watcher.target_observation.handles)
        self.assertFalse(model.layer._forward_hooks)
        self.assertIn("remove failed", watcher._observation_error)

    def test_cpu_reference_ignores_non_cpu_default_device(self):
        x, dy, gradients, config = self.arithmetic()
        with torch.device("meta"):
            result = observed.decompose_target_gradients(x, dy, gradients, convolution=config)
        self.assertTrue(all(value.device.type == "cpu" for value in result["referenceGradients"]))
        self.assertEqual(result["observedDifference"].device.type, "cpu")

    def test_state_mutation_is_detected_and_primary_preserved(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        primary = RuntimeError("original")
        with self.assertRaises(RuntimeError) as result:
            with watcher, torch.no_grad():
                model.layer.weight.add_(0)
                raise primary
        self.assertIs(result.exception, primary)
        self.assertIn("changed", watcher._observation_error)
        self.assertFalse(model.layer._forward_hooks)

    def test_mutation_without_version_change_is_detected(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        model.rows[20][1].data.fill_(1)
        with self.assertRaisesRegex(ValueError, "state/bytes"):
            watcher.__enter__()

    def test_rng_change_detected(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        before = torch.random.get_rng_state()
        try:
            torch.manual_seed(1234)
            with self.assertRaisesRegex(ValueError, "RNG changed"):
                watcher.__enter__()
        finally:
            torch.random.set_rng_state(before)

    def test_capture_budget_fails_before_hook_or_tensor_copy(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model, max_capture_bytes=60 * 1024**2)
        with self.assertRaisesRegex(ValueError, "budget"):
            watcher.__enter__()
        self.assertFalse(model.layer._forward_hooks)
        self.assertIsNone(watcher.target_observation.input)

    def test_wrong_graph_and_convolution_rejected(self):
        model = SyntheticGraph()
        model.rows[0] = ("wrong", model.layer.weight)
        with self.assertRaises(ValueError):
            observed.Parameter0Observer(model)
        model = SyntheticGraph()
        model.layer.padding = (0, 0)
        with self.assertRaises(ValueError):
            observed.Parameter0Observer(model)

    def test_out_of_order_attempt_rejected(self):
        model = SyntheticGraph()
        watcher = observed.Parameter0Observer(model)
        primary = RuntimeError("stop synthetic")
        with self.assertRaises(RuntimeError):
            with watcher:
                # Only satisfy the already-observed forward state to exercise
                # event ordering; this fixture is never accepted as evidence.
                watcher.target_observation.forward_count = 1
                with self.assertRaisesRegex(ValueError, "out-of-order"):
                    watcher("attempt", observed.LABELS[1], None)
                raise primary

    def test_reference_mutation_detected(self):
        x, dy, gradients, config = self.arithmetic()
        def mutate(stage, label):
            if stage == "complete" and label == observed.LABELS[-1]:
                x[0, 0, 0, 0] += 1
        with self.assertRaisesRegex(ValueError, "changed evidence"):
            observed.decompose_target_gradients(x, dy, gradients, convolution=config, on_reference=mutate)

    def test_resource_stop_precedes_reference_attempt(self):
        x, dy, gradients, config = self.arithmetic()
        calls = []
        def stop():
            raise RuntimeError("stop now")
        with self.assertRaisesRegex(RuntimeError, "stop now"):
            observed.decompose_target_gradients(x, dy, gradients, convolution=config, resource=stop,
                                              on_reference=lambda *v: calls.append(v))
        self.assertFalse(calls)


if __name__ == "__main__":
    unittest.main(verbosity=2)

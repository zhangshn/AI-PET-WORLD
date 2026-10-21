"""Unittest CPU preflight: small synthetic objects only; no renderer/archive."""
import gc
import importlib.util
import json
import math
import pathlib
import unittest
import weakref
from unittest.mock import patch

import torch
from torch import nn
from torch.nn import functional as F

# Load only this component, not the complete_world renderer package initializer.
_PATH = pathlib.Path(__file__).resolve().parents[1] / "src/ai_painter/complete_world/parameter48_causal_observation_v1.py"
_SPEC = importlib.util.spec_from_file_location("parameter48_component_cpu_fixture", _PATH)
component = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(component)
LABELS = component.LABELS
CONFIG = dict(weight_shape=component.TARGET_SHAPE, stride=(1, 1), padding=(1, 1), dilation=(1, 1), groups=1)


def setUpModule():
    if torch.cuda.is_initialized():
        raise RuntimeError("CPU preflight cannot run in a CUDA-initialized process")
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2:
        torch.set_num_interop_threads(2)


class SmallModel(nn.Module):
    """Actual 108-object/name graph; only spatial dimensions are synthetic."""
    def __init__(self):
        super().__init__()
        self.prefix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(48)])
        self.core = nn.Module()
        self.core.core = nn.Module()
        self.core.core.terrain = nn.Module()
        self.core.core.terrain.decode_1 = nn.Module()
        self.core.core.terrain.decode_1.layers = nn.ModuleList([nn.Conv2d(144, 48, 3, padding=1)])
        self.suffix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(58)])
        self.register_buffer("fixture_buffer", torch.zeros(1))

    def forward(self, value):
        return self.core.core.terrain.decode_1.layers[0](value)


class SmallObserver(component._PlaneObserver):
    """Separate fixture implementation, never a production geometry pass."""
    def _spatial(self):
        return (4, 5)


def fixture():
    torch.manual_seed(19)
    model = SmallModel()
    value = torch.randn(1, 144, 4, 5, requires_grad=True)
    # Generate all random values before the observer freezes RNG identity.
    coefficients = tuple(torch.randn(1, 48, 4, 5) * scale for scale in (.7, .2, .11, .031))
    assert tuple(model.named_parameters())[48][0] == component.TARGET_NAME
    return model, value, coefficients


def observe_five(observer, model, output, coefficients):
    terms = [(output * coefficient).sum() for coefficient in coefficients]
    losses = ((((terms[0] + terms[1]) + terms[2]) + terms[3]), *terms)
    rows = []
    for index, (label, loss) in enumerate(zip(LABELS, losses)):
        observer.gradient_event("attempt", label, None)
        raw = torch.autograd.grad(loss, tuple(model.parameters()), retain_graph=index < 4, allow_unused=True)
        observer("complete", label, raw)
        rows.append(raw)
    return rows


def arithmetic_fixture():
    value = torch.arange(1, 21, dtype=torch.float32).reshape(1, 1, 4, 5).clone()
    parts = tuple(torch.full_like(value, scale) for scale in (2., -.5, .25, .125))
    total = (((parts[0] + parts[1]) + parts[2]) + parts[3]).clone()
    adjoints = (total, *parts)
    native = tuple(torch.zeros(component.TARGET_SHAPE) for _ in LABELS)
    for gradient, adjoint in zip(native, adjoints):
        for coordinate, expected in zip(component.COORDINATES, direct_reference(value, adjoint)):
            gradient[coordinate] = expected
    return value, adjoints, native


def direct_reference(value, adjoint):
    height, width = value.shape[2:]
    results = []
    for _, _, ky, kx in component.COORDINATES:
        products = []
        for h in range(height):
            for w in range(width):
                ih, iw = h + ky - 1, w + kx - 1
                if 0 <= ih < height and 0 <= iw < width:
                    products.append(float(adjoint[0, 0, h, w]) * float(value[0, 0, ih, iw]))
        results.append(math.fsum(products))
    return results


class CpuTest(unittest.TestCase):
    def tearDown(self):
        self.assertFalse(torch.cuda.is_initialized())
        self.assertEqual(torch.get_num_threads(), 2)


class ObserverTests(CpuTest):
    def test_five_labels_selected_cpu_copies_hooks_rng_and_original_state_unchanged(self):
        model, value, coefficients = fixture()
        for parameter in model.parameters():
            parameter.grad = torch.ones_like(parameter)
        original = [(p, p.detach().clone(), p._version, p.grad, p.grad.clone()) for p in model.parameters()]
        input_before, input_version = value.detach().clone(), value._version
        rng_before = torch.random.get_rng_state().clone()
        observer = SmallObserver(model)
        seen = []
        external = observer.module.register_forward_hook(lambda m, args, result: seen.append((args[0], result)) or None)
        try:
            with observer:
                output = model(value)
                self.assertIs(seen[0][0], value)
                self.assertIs(seen[0][1], output)
                with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as calls:
                    rows = observe_five(observer, model, output, coefficients)
                self.assertEqual(calls.call_count, 5)
            evidence = observer.evidence()
            self.assertEqual(evidence["input_tensor"].shape, (1, 1, 4, 5))
            self.assertTrue(torch.equal(evidence["input_tensor"], value[:, 81:82]))
            expected_total = ((coefficients[0] + coefficients[1]) + coefficients[2]) + coefficients[3]
            for captured, expected in zip(evidence["adjoints"], (expected_total, *coefficients)):
                torch.testing.assert_close(captured, expected[:, 10:11], atol=1e-7, rtol=1e-6)
            captured_values = (evidence["input_tensor"], *evidence["adjoints"], *evidence["native_gradients"])
            self.assertEqual(len({v.untyped_storage().data_ptr() for v in captured_values}), 11)
            for captured in captured_values:
                self.assertEqual(captured.device.type, "cpu")
                self.assertFalse(captured.requires_grad)
                self.assertTrue(captured.is_contiguous())
                self.assertEqual(captured.untyped_storage().nbytes(), captured.numel() * 4)
            for captured, raw in zip(evidence["native_gradients"], rows):
                self.assertTrue(torch.equal(captured, raw[48]))
                self.assertNotEqual(captured.untyped_storage().data_ptr(), raw[48].untyped_storage().data_ptr())
            metadata = evidence["metadata"]
            self.assertEqual(metadata["labels"], list(LABELS))
            self.assertEqual((metadata["targetForwards"], metadata["objectiveCaptures"]), (1, 5))
            self.assertEqual(metadata["captureBytes"], component.METADATA_RESERVE + 6 * 20 * 4 + 5 * math.prod(component.TARGET_SHAPE) * 4)
            self.assertFalse(metadata["productionGeometryVerified"])
            self.assertNotIn("qualificationGranted", metadata)
            json.dumps(metadata, allow_nan=False)
            self.assertTrue(torch.equal(value, input_before))
            self.assertEqual(value._version, input_version)
            self.assertTrue(torch.equal(torch.random.get_rng_state(), rng_before))
            for parameter, before, version, grad, grad_before in original:
                self.assertTrue(torch.equal(parameter, before))
                self.assertEqual(parameter._version, version)
                self.assertIs(parameter.grad, grad)
                self.assertTrue(torch.equal(grad, grad_before))
            self.assertEqual(len(observer.module._forward_hooks), 1)
            self.assertFalse(output._backward_hooks)
        finally:
            external.remove()

    def test_production_geometry_cannot_be_relaxed_by_runtime_flag(self):
        model, value, _ = fixture()
        with self.assertRaises(TypeError):
            component.Parameter48Observer(model, testmode=True)
        observer = component.Parameter48Observer(model)
        with self.assertRaisesRegex(ValueError, "exact target N1"):
            with observer:
                model(value)
        self.assertFalse(observer.module._forward_hooks)

    def test_original_error_preserved_and_incomplete_capture_cannot_be_evidence(self):
        for complete in (False, True):
            model, value, coefficients = fixture()
            observer = SmallObserver(model)
            primary = RuntimeError("original unchanged 108 gate failure")
            with self.assertRaises(RuntimeError) as raised:
                with observer:
                    output = model(value)
                    if complete:
                        observe_five(observer, model, output, coefficients)
                    raise primary
            self.assertIs(raised.exception, primary)
            self.assertFalse(observer.module._forward_hooks)
            if complete:
                self.assertEqual(observer.evidence()["metadata"]["objectiveCaptures"], 5)
            else:
                self.assertIn("incomplete", primary.parameter48_observation_error)
                with self.assertRaisesRegex(ValueError, "closed complete"):
                    observer.evidence()

    def test_budget_rejected_before_first_copy(self):
        model, value, _ = fixture()
        observer = SmallObserver(model, max_capture_bytes=component.METADATA_RESERVE)
        with patch.object(observer, "_clone", side_effect=AssertionError("copy before budget")):
            with self.assertRaisesRegex(ValueError, "budget exceeded before first copy"):
                with observer:
                    model(value)
        self.assertEqual(observer.used, component.METADATA_RESERVE)

    def test_parameter_identity_geometry_alias_and_dtype_refuse(self):
        for mode in ("identity", "storage", "index", "stride", "padding", "dilation", "groups", "padding_mode", "dtype"):
            with self.subTest(mode=mode):
                model, _, _ = fixture()
                module = model.get_submodule(component.TARGET_MODULE)
                if mode == "identity": model.suffix[0] = model.prefix[0]
                elif mode == "storage": model.prefix[1] = nn.Parameter(model.prefix[0].detach())
                elif mode == "index":
                    model.prefix.append(nn.Parameter(torch.zeros(1)))
                    model.suffix = nn.ParameterList(list(model.suffix)[:-1])
                elif mode == "dtype": model.double()
                elif mode == "padding_mode": module.padding_mode = "reflect"
                else: setattr(module, mode, 2)
                with self.assertRaises(ValueError):
                    SmallObserver(model)

    def test_repeated_forward_duplicate_out_of_order_unlabelled_and_reentrant_refuse(self):
        for mode in ("forward", "duplicate", "order", "unknown", "unlabelled", "reentrant"):
            with self.subTest(mode=mode):
                model, value, coefficients = fixture()
                observer = SmallObserver(model)
                if mode == "reentrant": observer.resource = lambda: observer._check()
                with self.assertRaises(ValueError):
                    with observer:
                        output = model(value)
                        if mode == "forward": model(value)
                        elif mode == "duplicate":
                            observer("attempt", LABELS[0], None)
                            observer("attempt", LABELS[0], None)
                        elif mode == "order": observer("attempt", LABELS[1], None)
                        elif mode == "unknown": observer("attempt", "caller-claim", None)
                        elif mode == "unlabelled":
                            torch.autograd.grad((output * coefficients[0]).sum(), tuple(model.parameters()), allow_unused=True)
                self.assertFalse(observer.module._forward_hooks)

    def test_source_versions_bytes_module_grad_rng_and_buffer_changes_refuse(self):
        for mode in ("input", "input_data", "weight_data", "parameter", "buffer", "mode", "grad", "rng", "config", "output"):
            with self.subTest(mode=mode):
                model, value, _ = fixture()
                observer = SmallObserver(model)
                external = observer.module.register_forward_hook(lambda *args: None)
                try:
                    with self.assertRaises(ValueError):
                        with observer:
                            output = model(value)
                            with torch.no_grad():
                                if mode == "input": value.add_(1)
                                elif mode == "input_data": value.data = value.detach().clone() + 1
                                elif mode == "weight_data": observer.module.weight.data.add_(1)
                                elif mode == "parameter": model.prefix[0].add_(1)
                                elif mode == "buffer": model.fixture_buffer.add_(1)
                                elif mode == "mode": model.eval()
                                elif mode == "grad": model.prefix[0].grad = torch.ones(1)
                                elif mode == "rng": torch.rand(1)
                                elif mode == "config": observer.module.stride = (2, 2)
                                else: output.add_(1)
                            observer("attempt", LABELS[0], None)
                    self.assertEqual(len(observer.module._forward_hooks), 1)
                finally:
                    external.remove()

    def test_nonfinite_misbound_gradients_and_duplicate_adjoint_refuse(self):
        for mode in ("input", "adjoint", "native", "alias", "count", "shape", "duplicate"):
            with self.subTest(mode=mode):
                model, value, coefficients = fixture()
                if mode == "input":
                    with torch.no_grad(): value[0, 0, 0, 0] = float("nan")
                observer = SmallObserver(model)
                with self.assertRaises(ValueError):
                    with observer:
                        output = model(value)
                        observer("attempt", LABELS[0], None)
                        coefficient = coefficients[0].clone()
                        if mode == "adjoint": coefficient[0, 0, 0, 0] = float("nan")
                        loss = (output * coefficient).sum()
                        raw = list(torch.autograd.grad(loss, tuple(model.parameters()), allow_unused=True, retain_graph=True))
                        if mode == "native": raw[48][0, 0, 0, 0] = float("inf")
                        elif mode == "alias": raw[48] = observer.module.weight
                        elif mode == "count": raw.pop()
                        elif mode == "shape": raw[48] = torch.zeros(1)
                        elif mode == "duplicate":
                            torch.autograd.grad(loss, tuple(model.parameters()), allow_unused=True)
                        observer("complete", LABELS[0], raw)
                self.assertFalse(observer.module._forward_hooks)

    def test_capture_tamper_and_noncontiguous_input_refuse(self):
        model, value, coefficients = fixture()
        observer = SmallObserver(model)
        with observer:
            observe_five(observer, model, model(value), coefficients)
        evidence = observer.evidence()
        evidence["adjoints"][0].add_(1)
        with self.assertRaisesRegex(ValueError, "captured tensor bytes"):
            observer.evidence()
        model, value, _ = fixture()
        with self.assertRaisesRegex(ValueError, "contiguous"):
            with SmallObserver(model):
                model(value.transpose(2, 3))

    def test_full_adjoint_is_not_retained_by_selected_plane_capture(self):
        model, value, _ = fixture()
        observer = SmallObserver(model)
        with observer:
            output = model(value)
            for label in LABELS:
                observer("attempt", label, None)
                source = torch.ones_like(output)
                source_ref = weakref.ref(source)
                self.assertIsNone(observer._adjoint(source))
                del source
                gc.collect()
                self.assertIsNone(source_ref())
                raw = [None] * 108
                raw[48] = torch.zeros(component.TARGET_SHAPE)
                observer("complete", label, raw)
            del raw
        self.assertIn("adjoint.actualTotal", observer.evidence()["metadata"]["releasedSources"])


class MathematicsTests(CpuTest):
    def test_selected_reference_matches_independent_small_fp64_conv_autograd(self):
        value, adjoints, native = arithmetic_fixture()
        weight = torch.zeros(1, 1, 3, 3, dtype=torch.float64, requires_grad=True)
        expected = []
        for adjoint in adjoints:
            output = F.conv2d(value.double(), weight, padding=1)
            gradient, = torch.autograd.grad(output, weight, grad_outputs=adjoint.double())
            expected.append(torch.tensor([gradient[0, 0, 0, 0], gradient[0, 0, 1, 0]], dtype=torch.float64))
        events = []
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("reference must not autograd")), \
             patch.object(F, "unfold", side_effect=AssertionError("no full-channel unfold")), \
             patch.object(F, "conv2d", side_effect=AssertionError("no reference model forward")):
            report = component.decompose_target_gradients(value, adjoints, native, convolution=CONFIG,
                on_reference=lambda stage, label: events.append((stage, label)))
        self.assertEqual(events, [(stage, label) for label in LABELS for stage in ("attempt", "complete")])
        for actual, wanted in zip(report["referenceGradients"], expected):
            torch.testing.assert_close(actual, wanted, atol=1e-12, rtol=1e-12)
            self.assertEqual((actual.shape, actual.dtype, actual.device.type, actual.requires_grad), ((2,), torch.float64, "cpu", False))
        self.assertEqual(report["originalFp32Comparison"]["outsideToleranceElements"], 0)
        self.assertFalse(report["spatialMatchesProduction"])
        self.assertNotIn("gatePassed", report)
        self.assertNotIn("upstreamAdjointDifference", report)
        json.dumps(report["summary"], allow_nan=False)

    def test_two_coordinate_decomposition_difference_residual_and_inputs_unchanged(self):
        value, adjoints, native = arithmetic_fixture()
        adjoints[0][0, 0, 1, 1] += .25
        for coordinate in component.COORDINATES:
            native[0][coordinate] += .125
        originals = [v.clone() for v in (value, *adjoints, *native)]
        report = component.decompose_target_gradients(value, adjoints, native, convolution=CONFIG)
        terms = report["terms"]
        reconstructed = terms["upstream"] + terms["totalNativeReduction"] - terms["componentNativeReduction"] + terms["fp32ComponentSumRounding"]
        torch.testing.assert_close(report["observedDifference"], reconstructed + report["residual"], atol=1e-12, rtol=0)
        self.assertEqual(report["originalFp32Comparison"]["outsideToleranceElements"], 2)
        self.assertLessEqual(report["maximumResidual"], 1e-12)
        self.assertFalse(report["upstreamAdjointBytesEqual"])
        self.assertGreater(report["upstreamAdjointDifferenceSummary"]["maximumAbsolute"], 0)
        self.assertEqual(report["coordinates"], [[10, 81, 0, 0], [10, 81, 1, 0]])
        self.assertEqual(report["referenceVjpCount"], 5)
        for current, before in zip((value, *adjoints, *native), originals):
            self.assertTrue(torch.equal(current, before))

    def test_fsum_preserves_small_term_between_cancelling_large_products(self):
        value = torch.ones(1, 1, 1, 4)
        total = torch.tensor([0., 1e20, 1., -1e20]).reshape(1, 1, 1, 4)
        adjoints = (total, *(torch.zeros_like(total) for _ in range(4)))
        native = tuple(torch.zeros(component.TARGET_SHAPE) for _ in LABELS)
        report = component.decompose_target_gradients(value, adjoints, native, convolution=CONFIG)
        self.assertEqual(report["referenceGradients"][0].tolist(), [0., 1.])

    def test_bad_geometry_dtype_finiteness_alias_detachment_and_counts_refuse(self):
        for mode in ("stride", "padding", "dilation", "groups", "weight_shape", "extra", "dtype", "nonfinite", "alias", "count", "shape", "grad", "retained_view"):
            with self.subTest(mode=mode):
                value, adjoints, native = arithmetic_fixture()
                config = dict(CONFIG)
                if mode in ("stride", "padding", "dilation", "groups"): config[mode] = 2
                elif mode == "weight_shape": config[mode] = (48, 144, 1, 1)
                elif mode == "extra": config["testmode"] = True
                elif mode == "dtype": value = value.double()
                elif mode == "nonfinite": adjoints[1][0, 0, 0, 0] = float("inf")
                elif mode == "alias": adjoints = (adjoints[1], *adjoints[1:])
                elif mode == "count": native = native[:-1]
                elif mode == "shape": value = value[:, :, :3, :].clone()
                elif mode == "grad": value.requires_grad_()
                elif mode == "retained_view": value = torch.zeros(1, 2, 4, 5)[:, :1]
                with self.assertRaises(ValueError):
                    component.decompose_target_gradients(value, adjoints, native, convolution=config)

    def test_reference_budget_and_resource_failure_or_mutation_refuse(self):
        value, adjoints, native = arithmetic_fixture()
        with patch.object(component, "MAX_CAPTURE_BYTES", component.METADATA_RESERVE):
            with self.assertRaisesRegex(ValueError, "working budget"):
                component.decompose_target_gradients(value, adjoints, native, convolution=CONFIG)
        with self.assertRaisesRegex(RuntimeError, "resource exhausted"):
            component.decompose_target_gradients(value, adjoints, native, convolution=CONFIG,
                resource=lambda: (_ for _ in ()).throw(RuntimeError("resource exhausted")))
        def mutate(stage, label):
            if stage == "complete" and label == LABELS[-1]:
                value.add_(1)
        with self.assertRaisesRegex(ValueError, "input identity/version/bytes changed"):
            component.decompose_target_gradients(value, adjoints, native, convolution=CONFIG, on_reference=mutate)


if __name__ == "__main__":
    unittest.main()

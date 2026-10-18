"""Small CPU fixtures only. Never imports or forwards the real renderer."""
import pathlib
import sys
import unittest
from unittest.mock import patch

import torch
from torch import nn
from torch.nn import functional as F

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from ai_painter.complete_world.parameter60_causal_observation_v1 import (
    Parameter60Observer, LABELS, METADATA_RESERVE, TARGET_INDEX, TARGET_NAME,
    local_weight_vjp_fp64, decompose_target_gradients,
)

torch.set_num_threads(2)
if torch.get_num_interop_threads() != 2:
    torch.set_num_interop_threads(2)


class SmallModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.prefix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(60)])
        self.core = nn.Module()
        self.core.core = nn.Module()
        self.core.core.terrain = nn.Module()
        self.core.core.terrain.full_resolution_detail = nn.Module()
        self.core.core.terrain.full_resolution_detail.layers = nn.ModuleList(
            [nn.Identity(), nn.Identity(), nn.Identity(), nn.Conv2d(48, 48, 3, padding=1)])
        self.suffix = nn.ParameterList([nn.Parameter(torch.zeros(1)) for _ in range(46)])

    def forward(self, value):
        return self.core.core.terrain.full_resolution_detail.layers[3](value)


def fixture():
    torch.manual_seed(19)
    model = SmallModel()
    x = torch.randn(1, 48, 4, 5, requires_grad=True)
    assert tuple(model.named_parameters())[60][0] == TARGET_NAME
    return model, x


def objectives(y):
    coefficients = [torch.randn_like(y) for _ in range(3)]
    terms = [(y * value).sum() for value in coefficients]
    return (((terms[0].float() + terms[1]).float() + terms[2]), *terms)


def observe_four(observer, model, y):
    rows = []
    for index, (label, loss) in enumerate(zip(LABELS, objectives(y))):
        observer("attempt", label, None)
        gradients = torch.autograd.grad(loss, tuple(model.parameters()), retain_graph=index < 3, allow_unused=True)
        observer("complete", label, gradients)
        rows.append(gradients)
    return rows


class ObserverTests(unittest.TestCase):
    def tearDown(self):
        self.assertFalse(torch.cuda.is_initialized())

    def test_four_labels_identity_layout_versions_and_existing_grad_unchanged(self):
        model, x = fixture()
        module = model.get_submodule(TARGET_NAME.removesuffix(".weight"))
        for p in model.parameters():
            p.grad = torch.ones_like(p)
        before = [(p, p.detach().clone(), p._version, p.grad, p.grad.clone()) for p in model.parameters()]
        x_before, x_version, x_stride = x.detach().clone(), x._version, x.stride()
        observed = []
        external = module.register_forward_hook(lambda m, args, output: observed.append((args[0], output)) or None)
        resource_calls = []
        observer = Parameter60Observer(model, resource=lambda: resource_calls.append(1))
        try:
            with observer:
                y = model(x)
                self.assertIs(y, observed[0][1])
                self.assertIs(x, observed[0][0])
                self.assertEqual(y.stride(), (960, 20, 5, 1))
                self.assertNotEqual(y.untyped_storage().data_ptr(), x.untyped_storage().data_ptr())
                with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as calls:
                    rows = observe_four(observer, model, y)
                    self.assertEqual(calls.call_count, 4)
            evidence = observer.evidence()
            self.assertEqual(evidence["metadata"]["targetForwards"], 1)
            self.assertEqual(evidence["metadata"]["objectiveCaptures"], 4)
            self.assertEqual(evidence["metadata"]["labels"], list(LABELS))
            self.assertEqual(len(evidence["metadata"]["descriptors"]), 9)
            expected = METADATA_RESERVE + x.numel()*4 + 4*y.numel()*4 + 4*module.weight.numel()*4
            self.assertEqual(evidence["metadata"]["captureBytes"], expected)
            self.assertEqual(len(module._forward_hooks), 1)
            self.assertFalse(y._backward_hooks)
            for row, captured in zip(rows, evidence["native_gradients"]):
                self.assertTrue(torch.equal(captured, row[TARGET_INDEX]))
                self.assertFalse(captured.requires_grad)
                self.assertTrue(captured.is_contiguous())
                self.assertNotEqual(captured.untyped_storage().data_ptr(), row[TARGET_INDEX].untyped_storage().data_ptr())
            self.assertTrue(torch.equal(x, x_before))
            self.assertEqual((x._version, x.stride()), (x_version, x_stride))
            for p, original, version, grad, grad_bytes in before:
                self.assertTrue(torch.equal(p, original))
                self.assertEqual(p._version, version)
                self.assertIs(p.grad, grad)
                self.assertTrue(torch.equal(p.grad, grad_bytes))
            self.assertTrue(resource_calls)
        finally:
            external.remove()

    def test_exact_gate_exception_preserved_without_authorizing_contrast(self):
        model, x = fixture()
        observer = Parameter60Observer(model)
        error = ValueError("actual total gradient identity differs at parameter 60")
        with self.assertRaises(ValueError) as raised:
            with observer:
                observe_four(observer, model, model(x))
                raise error
        self.assertIs(raised.exception, error)
        self.assertEqual(observer.evidence()["metadata"]["objectiveCaptures"], 4)
        self.assertNotIn("qualificationGranted", observer.evidence()["metadata"])

    def test_missing_labels_primary_exception_and_cleanup(self):
        model, x = fixture()
        observer = Parameter60Observer(model)
        error = RuntimeError("primary failure")
        with self.assertRaises(RuntimeError) as raised:
            with observer:
                model(x)
                raise error
        self.assertIs(raised.exception, error)
        self.assertIn("incomplete", error.parameter60_observation_error)
        self.assertFalse(observer.module._forward_hooks)
        with self.assertRaisesRegex(ValueError, "closed complete"):
            observer.evidence()

    def test_budget_prechecked_before_any_clone(self):
        model, x = fixture()
        observer = Parameter60Observer(model, max_capture_bytes=METADATA_RESERVE)
        with patch.object(torch.Tensor, "clone", side_effect=AssertionError("clone before budget")):
            with self.assertRaisesRegex(ValueError, "budget exceeded before first clone"):
                with observer:
                    model(x)
        self.assertEqual(observer.used, METADATA_RESERVE)
        self.assertFalse(observer.module._forward_hooks)

    def test_repeated_forward_missing_and_duplicate_labels(self):
        for mode in ("forward", "missing", "duplicate", "order", "unknown"):
            with self.subTest(mode=mode):
                model, x = fixture()
                observer = Parameter60Observer(model)
                with self.assertRaises(ValueError):
                    with observer:
                        model(x)
                        if mode == "forward": model(x)
                        elif mode == "duplicate":
                            observer("attempt", LABELS[0], None)
                            observer("attempt", LABELS[0], None)
                        elif mode == "order": observer("attempt", LABELS[1], None)
                        elif mode == "unknown": observer("attempt", "unauthenticated", None)
                self.assertFalse(observer.module._forward_hooks)

    def test_nonfinite_input_and_parameter_graph_alias_refuse(self):
        model, x = fixture()
        with torch.no_grad(): x[0, 0, 0, 0] = float("nan")
        observer = Parameter60Observer(model)
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            with observer: model(x)
        self.assertFalse(observer.module._forward_hooks)
        model, _ = fixture()
        model.suffix[0] = model.prefix[0]
        with self.assertRaisesRegex(ValueError, "identities"):
            Parameter60Observer(model)

    def test_input_and_parameter_version_changes_refuse_without_clearing_other_hooks(self):
        for mode in ("input", "parameter", "mode"):
            with self.subTest(mode=mode):
                model, x = fixture()
                observer = Parameter60Observer(model)
                external = observer.module.register_forward_hook(lambda *args: None)
                try:
                    with self.assertRaises(ValueError):
                        with observer:
                            model(x)
                            with torch.no_grad():
                                if mode == "input": x.add_(1)
                                elif mode == "parameter": model.prefix[0].add_(1)
                                else: observer.module.eval()
                            observer("attempt", LABELS[0], None)
                    self.assertEqual(len(observer.module._forward_hooks), 1)
                finally:
                    external.remove()

    def test_nonfinite_adjoint_native_gradient_and_raw_alias_refuse(self):
        for mode in ("adjoint", "native", "alias"):
            with self.subTest(mode=mode):
                model, x = fixture()
                observer = Parameter60Observer(model)
                with self.assertRaisesRegex(ValueError, "nonfinite|aliases model"):
                    with observer:
                        y = model(x)
                        observer("attempt", LABELS[0], None)
                        coefficient = torch.randn_like(y)
                        if mode == "adjoint": coefficient[0, 0, 0, 0] = float("nan")
                        raw = list(torch.autograd.grad((y*coefficient).sum(), tuple(model.parameters()), allow_unused=True))
                        if mode == "native": raw[60][0, 0, 0, 0] = float("inf")
                        if mode == "alias": raw[60] = observer.module.weight
                        observer("complete", LABELS[0], raw)
                self.assertFalse(observer.module._forward_hooks)

    def test_duplicate_adjoint_from_unlabelled_extra_differentiation_refuses(self):
        model, x = fixture()
        observer = Parameter60Observer(model)
        with self.assertRaisesRegex(ValueError, "repeated adjoint"):
            with observer:
                y = model(x)
                loss = (y * torch.randn_like(y)).sum()
                observer("attempt", LABELS[0], None)
                torch.autograd.grad(loss, tuple(model.parameters()), allow_unused=True, retain_graph=True)
                torch.autograd.grad(loss, tuple(model.parameters()), allow_unused=True)
        self.assertFalse(observer.module._forward_hooks)

    def test_wrong_index_storage_alias_and_noncontiguous_input_refuse(self):
        model, _ = fixture()
        model.prefix[1] = nn.Parameter(model.prefix[0].detach())
        with self.assertRaisesRegex(ValueError, "storage alias"):
            Parameter60Observer(model)
        model, x = fixture()
        observer = Parameter60Observer(model)
        with self.assertRaisesRegex(ValueError, "contiguous"):
            with observer: model(x.transpose(2, 3))
        self.assertFalse(observer.module._forward_hooks)
        model, _ = fixture()
        model.prefix.append(nn.Parameter(torch.zeros(1)))
        model.suffix = nn.ParameterList(list(model.suffix)[:-1])
        with self.assertRaisesRegex(ValueError, "parameter60"):
            Parameter60Observer(model)

    def test_same_version_input_data_replacement_and_returned_capture_tamper_detected(self):
        model, x = fixture()
        observer = Parameter60Observer(model)
        with self.assertRaisesRegex(ValueError, "identity/layout/version|input bytes"):
            with observer:
                model(x)
                x.data = x.detach().clone() + 1
                observer("attempt", LABELS[0], None)
        model, x = fixture()
        observer = Parameter60Observer(model)
        with observer: observe_four(observer, model, model(x))
        evidence = observer.evidence()
        evidence["adjoints"][0][0, 0, 0, 0] += 1
        with self.assertRaisesRegex(ValueError, "captured tensor bytes"):
            observer.evidence()


class MathematicsTests(unittest.TestCase):
    def tearDown(self): self.assertFalse(torch.cuda.is_initialized())

    def test_group_stride_dilation_reference_matches_small_fp64_autograd(self):
        torch.manual_seed(23)
        x = torch.randn(2, 4, 5, 6)
        weight = torch.randn(6, 2, 2, 2, dtype=torch.float64, requires_grad=True)
        config = dict(weight_shape=tuple(weight.shape), stride=(2, 1), padding=(1, 0), dilation=(1, 2), groups=2)
        output = F.conv2d(x.double(), weight, stride=config["stride"], padding=config["padding"], dilation=config["dilation"], groups=2)
        adjoint = torch.randn(output.shape)
        expected, = torch.autograd.grad(output, weight, grad_outputs=adjoint.double())
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("production reference autograd")):
            actual = local_weight_vjp_fp64(x, adjoint, **config)
        torch.testing.assert_close(actual, expected, atol=1e-12, rtol=1e-12)
        self.assertEqual(actual.dtype, torch.float64)
        self.assertEqual(actual.device, x.device)
        self.assertFalse(actual.requires_grad)
        self.assertIsNone(weight.grad)

    def test_decomposition_algebra_and_original_gate_not_weakened(self):
        torch.manual_seed(29)
        x = torch.randn(1, 2, 3, 4)
        parts = [torch.randn(1, 3, 3, 4) for _ in range(3)]
        total = ((parts[0] + parts[1]) + parts[2]).clone()
        total[0, 0, 0, 0] += .03
        adjoints = (total, *parts)
        config = dict(weight_shape=(3, 2, 1, 1), stride=1, padding=0, dilation=1, groups=1)
        refs = [local_weight_vjp_fp64(x, a, **config).float() for a in adjoints]
        refs[0][0, 0, 0, 0] += .01
        originals = [v.clone() for v in (x, *adjoints, *refs)]
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("extra autograd")):
            report = decompose_target_gradients(x, adjoints, tuple(refs), convolution=config)
        terms = report["terms"]
        reconstructed = terms["upstream"] + terms["totalNativeReduction"] - terms["componentNativeReduction"] + terms["fp32ComponentSumRounding"]
        torch.testing.assert_close(report["observedDifference"], reconstructed + report["residual"], atol=1e-14, rtol=1e-14)
        self.assertLess(report["maximumResidual"], 1e-12)
        self.assertEqual(report["referenceVjpCount"], 4)
        self.assertEqual(len(report["referenceFp32Comparisons"]), 4)
        self.assertTrue(all(value["rounding"] == "single_fp64_to_fp32" for value in report["referenceFp32Comparisons"]))
        self.assertFalse(report["upstreamAdjointBytesEqual"])
        E = (refs[1].float()+refs[2].float()).float()+refs[3].float()
        outside = int((~torch.isclose(refs[0], E, atol=1e-6, rtol=1e-5)).count_nonzero())
        self.assertEqual(report["originalFp32Comparison"]["outsideToleranceElements"], outside)
        self.assertGreater(outside, 0)
        self.assertEqual((report["originalFp32Comparison"]["atol"], report["originalFp32Comparison"]["rtol"]), (1e-6, 1e-5))
        self.assertNotIn("gatePassed", report)
        for value, before in zip((x, *adjoints, *refs), originals): self.assertTrue(torch.equal(value, before))

    def test_reference_bad_shape_groups_nonfinite_and_incomplete_sets_refuse(self):
        x, adjoint = torch.ones(1, 2, 3, 3), torch.ones(1, 3, 3, 3)
        config = dict(weight_shape=(3, 2, 1, 1), stride=1, padding=0, dilation=1, groups=1)
        for change in ({"groups": 2}, {"stride": 0}, {"padding": -1}, {"weight_shape": (3, 2, 2, 2)}):
            with self.assertRaises(ValueError): local_weight_vjp_fp64(x, adjoint, **(config | change))
        with self.assertRaises(ValueError):
            decompose_target_gradients(x, (adjoint,), (), convolution=config)
        adjoint[0, 0, 0, 0] = float("inf")
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            local_weight_vjp_fp64(x, adjoint, **config)


if __name__ == "__main__":
    unittest.main()

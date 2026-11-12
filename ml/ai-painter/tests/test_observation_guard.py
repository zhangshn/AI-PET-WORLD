"""Exact observation guard with synthetic networks; no learned model or GPU."""
import ast
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from test_state_restoration import fixture

ROOT = Path(__file__).resolve().parents[3]


def observation_fixture(*, hash_failure=False):
    restore, model, modes, restore_calls, _, _ = fixture(
        "painter_stage4_v21_full_train_exposure_probe.py", "preserve_rng_and_modes", True, cuda=True)
    namespace = dict(restore.__wrapped__.__globals__)
    torch = namespace["torch"]
    torch.load = lambda *a, **k: "original load sentinel"
    parameter = SimpleNamespace(requires_grad=True, grad="original-gradient")
    model.state = "original-state"
    model.parameters = lambda: iter([parameter])
    model.eval = lambda: [setattr(module, "_training", False) for module in modes]
    trace = []
    body = {"entered": False}

    def state_hash(network):
        trace.append("state_hash")
        if body["entered"] and hash_failure:
            raise RuntimeError("state hash failed")
        return network.state

    def require(condition, message):
        trace.append(message)
        if not condition:
            raise ValueError(message)

    @contextmanager
    def readonly():
        trace.append("readonly_enter")
        try:
            yield
        finally:
            trace.append("readonly_exit")

    source = ROOT / "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"
    node = next(n for n in ast.parse(source.read_text(encoding="utf-8-sig")).body
                if isinstance(n, ast.FunctionDef) and n.name == "observation_guard")
    namespace.update(cpu=SimpleNamespace(state_hash=state_hash, tensor_hash=lambda value: value),
                     fit=SimpleNamespace(readonly_guard=readonly), patch=patch, require=require,
                     preserve_rng_and_modes=restore)
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), "exec"), namespace)
    return namespace["observation_guard"], model, parameter, modes, torch, trace, body, restore_calls


class ObservationGuardTests(unittest.TestCase):
    def test_normal_observation_restores_modes_and_checkpoint_guard(self):
        guard, model, _, modes, torch, trace, body, restores = observation_fixture()
        original_load = torch.load
        with guard(model):
            body["entered"] = True
            self.assertTrue(all(not module.training for module in modes))
            with self.assertRaisesRegex(RuntimeError, "checkpoint load prohibited"):
                torch.load("not-a-file")
        self.assertIs(torch.load, original_load)
        self.assertTrue(all(module.training for module in modes))
        self.assertEqual(trace.count("readonly_exit"), 1)
        self.assertIn("observation mutated model state", trace)
        self.assertIn("observation mutated gradient state", trace)
        self.assertEqual([name for name, _ in restores], ["torch_rng", "python_rng", "numpy_rng", "cuda_rng", "mode_0", "mode_1"])

    def test_invariant_failures_check_both_groups_and_do_not_claim_rollback(self):
        for mutations in (("state",), ("gradient",), ("state", "gradient")):
            with self.subTest(mutations=mutations):
                guard, model, parameter, modes, torch, trace, body, _ = observation_fixture()
                original_load = torch.load
                with self.assertRaises(ValueError) as caught:
                    with guard(model):
                        body["entered"] = True
                        if "state" in mutations:
                            model.state = "changed"
                        if "gradient" in mutations:
                            parameter.requires_grad = False
                self.assertIn("observation mutated model state", trace)
                self.assertIn("observation mutated gradient state", trace)
                expected = ["observation_" + name for name in mutations]
                self.assertEqual([row["step"] for row in caught.exception.state_restoration_errors], expected)
                self.assertIs(torch.load, original_load)
                self.assertTrue(all(module.training for module in modes))
                if "state" in mutations:
                    self.assertEqual(model.state, "changed")

    def test_primary_error_survives_check_failures_and_all_scopes_exit(self):
        for error_type in (ValueError, KeyboardInterrupt, SystemExit):
            for failed_hash in (False, True):
                with self.subTest(error=error_type.__name__, hash_failure=failed_hash):
                    guard, model, parameter, modes, torch, trace, body, _ = observation_fixture(hash_failure=failed_hash)
                    primary = error_type("original observation failed")
                    original_load = torch.load
                    with self.assertRaises(error_type) as caught:
                        with guard(model):
                            body["entered"] = True
                            model.state = "changed"
                            parameter.requires_grad = False
                            raise primary
                    self.assertIs(caught.exception, primary)
                    self.assertEqual([row["step"] for row in primary.state_restoration_errors], ["observation_state", "observation_gradient"])
                    self.assertIn("observation mutated gradient state", trace)
                    self.assertEqual(trace.count("readonly_exit"), 1)
                    self.assertIs(torch.load, original_load)
                    self.assertTrue(all(module.training for module in modes))

    def test_body_only_error_does_not_invent_invariant_failure(self):
        guard, model, _, _, _, _, body, _ = observation_fixture()
        primary = ValueError("body only")
        with self.assertRaises(ValueError) as caught:
            with guard(model):
                body["entered"] = True
                raise primary
        self.assertIs(caught.exception, primary)
        self.assertFalse(hasattr(primary, "state_restoration_errors"))

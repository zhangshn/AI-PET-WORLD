"""Synthetic checks only; actual148 fitting is controller-owned."""

import importlib.util
import io
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_comparison.py"
spec = importlib.util.spec_from_file_location("comparison148", PATH)
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)


class ComparisonChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = comparison.pilot.configure_torch()

    def test_boundary_transforms_are_finite_and_inverse_is_legal_without_clipping(self):
        t = self.torch
        values = t.tensor([[0, 0, -10, 0], [5, 100, 40, 2]], dtype=t.float64)
        transformed = comparison.transform_targets(values)
        self.assertTrue(bool(t.isfinite(transformed).all()))
        restored = comparison.inverse_targets(transformed)
        self.assertFalse(any(comparison.pilot.physical_violations(restored).values()))
        self.assertGreater(float(restored[0, 0]), 0)
        self.assertLess(float(restored[1, 1]), 100)
        self.assertTrue(t.allclose(restored[:, [0, 3]], values[:, [0, 3]] + 1e-6, atol=1e-14, rtol=1e-12))
        self.assertTrue(t.equal(restored[:, 2], values[:, 2]))

    def test_target_normalizer_only_uses_supplied_training_targets(self):
        t = self.torch
        targets = t.tensor([[0, 40, 20, 1], [1, 50, 21, 2], [2, 60, 22, 3]], dtype=t.float64)
        mean, std = comparison.target_normalizer(targets)
        transformed = comparison.transform_targets(targets)
        self.assertTrue(t.equal(mean, transformed.mean(0)))
        self.assertTrue(t.equal(std, transformed.std(0, unbiased=False).clamp_min(1e-6)))
        self.assertTrue(t.equal(mean, comparison.target_normalizer(targets.clone())[0]))

    def test_ridge_cpu_float64_unpenalized_intercept_and_reload(self):
        t = self.torch
        history = t.arange(8 * 7 * 4, dtype=t.float64).reshape(8, 7, 4) / 100
        target = t.tensor([[1, 50, 25, 2]] * 8, dtype=t.float64)
        model = comparison.fit_ridge(history, target, t.zeros(4, dtype=t.float64), t.ones(4, dtype=t.float64))
        self.assertEqual(model["weights"].shape, (29, 4))
        self.assertEqual(model["weights"].dtype, t.float64)
        self.assertEqual(str(model["weights"].device), "cpu")
        predicted = comparison.predict(model, history)
        self.assertTrue(t.allclose(predicted, comparison.inverse_targets(comparison.transform_targets(target)), atol=1e-12, rtol=1e-12))
        buffer = io.BytesIO()
        t.save(model, buffer)
        buffer.seek(0)
        loaded = t.load(buffer, map_location="cpu", weights_only=True)
        self.assertTrue(t.equal(predicted, comparison.predict(loaded, history)))

    def test_ridge_normal_equation_and_unpenalized_intercept(self):
        t = self.torch
        history = t.arange(12 * 7 * 4, dtype=t.float64).reshape(12, 7, 4) / 100
        target = t.tensor([[i + 1, 40 + i, 20 + i / 10, 1 + i / 10] for i in range(12)], dtype=t.float64)
        mean, std = t.zeros(4, dtype=t.float64), t.ones(4, dtype=t.float64)
        model = comparison.fit_ridge(history, target, mean, std)
        x = comparison.design(history, mean, std)
        y = (comparison.transform_targets(target) - model["targetMean"]) / model["targetStd"]
        penalty = t.eye(29, dtype=t.float64) * 10
        penalty[-1, -1] = 0
        self.assertTrue(t.allclose((x.T @ x + penalty) @ model["weights"], x.T @ y, atol=1e-10))

    def test_changed_contract_and_invalid_domain_rejected(self):
        with self.assertRaisesRegex(ValueError, "frozen148"):
            comparison.validate_contract({}, "0" * 64)
        with self.assertRaisesRegex(ValueError, "target domain"):
            comparison.transform_targets(self.torch.tensor([[-1, 50, 20, 1]], dtype=self.torch.float64))
        with self.assertRaisesRegex(ValueError, "dtype"):
            comparison.transform_targets(self.torch.tensor([[1, 50, 20, 1]], dtype=self.torch.float32))


if __name__ == "__main__":
    unittest.main()

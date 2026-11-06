"""150 synthetic-only checks: one variable changes, guards and evaluation do not."""

import importlib.util
import io
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_stability_wind.py"
spec = importlib.util.spec_from_file_location("wind150", PATH)
wind = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wind)


class WindStabilityChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = wind.pilot.configure_torch()

    def test_wind_inverse_softplus_is_stable_at_zero_and_large_values(self):
        t = self.torch
        target = t.tensor([[0, 0, -10, 0], [5, 100, 40, 1e6]], dtype=t.float64)
        transformed = wind.transform_targets(target)
        recovered = wind.inverse_targets(transformed)
        self.assertTrue(bool(t.isfinite(transformed).all()))
        self.assertTrue(bool(t.isfinite(recovered).all()))
        self.assertTrue(t.allclose(recovered[:, 3], target[:, 3] + 1e-6, atol=1e-12, rtol=1e-12))
        extreme = t.tensor([[0, 0, 25, -1000], [0, 0, 25, 1000]], dtype=t.float64)
        self.assertTrue(bool(t.isfinite(wind.inverse_targets(extreme)).all()))
        self.assertEqual(float(wind.inverse_targets(extreme)[1, 3]), 1000)

    def test_rain_rh_temperature_transforms_weights_and_predictions_unchanged(self):
        t = self.torch
        target = t.tensor([[i % 5, 30 + i, 20 + i / 10, 1 + i / 20] for i in range(12)], dtype=t.float64)
        history = t.arange(12 * 7 * 4, dtype=t.float64).reshape(12, 7, 4) / 100
        mean, std = t.zeros(4, dtype=t.float64), t.ones(4, dtype=t.float64)
        old = wind.parent.fit_ridge(history, target, mean, std)
        new = wind.fit_ridge(history, target, mean, std)
        self.assertTrue(t.equal(wind.transform_targets(target)[:, :3], wind.parent.transform_targets(target)[:, :3]))
        for key in ("targetMean", "targetStd"):
            self.assertTrue(t.equal(old[key][:3], new[key][:3]))
        self.assertTrue(t.equal(old["weights"][:, :3], new["weights"][:, :3]))
        self.assertTrue(t.equal(wind.predict(new, history)[:, :3], wind.parent.predict(old, history)[:, :3]))
        self.assertFalse(t.equal(old["weights"][:, 3], new["weights"][:, 3]))

    def test_checkpoint_strict_reload_is_identical(self):
        t = self.torch
        history = t.arange(8 * 7 * 4, dtype=t.float64).reshape(8, 7, 4) / 100
        target = t.tensor([[i, 40 + i, 20 + i / 10, 1 + i / 20] for i in range(8)], dtype=t.float64)
        model = wind.fit_ridge(history, target, t.zeros(4, dtype=t.float64), t.ones(4, dtype=t.float64))
        stream = io.BytesIO()
        t.save(model, stream)
        stream.seek(0)
        loaded = t.load(stream, map_location="cpu", weights_only=True)
        self.assertTrue(t.equal(wind.predict(model, history), wind.predict(loaded, history)))
        self.assertEqual(str(loaded["weights"].device), "cpu")
        self.assertEqual(loaded["weights"].dtype, t.float64)

    def test_149_guard_feedback_origin_and_scoring_functions_are_reused(self):
        for name in ("guard_bounds", "guard_counts", "trajectory", "origins", "score_trajectory", "aggregate_rollouts"):
            self.assertIs(getattr(wind, name), getattr(wind.parent, name))
        bounds = wind.guard_bounds([[0, 30, 20, 1], [10, 80, 30, 5]], self.torch.tensor([1, 1, 5, 1], dtype=self.torch.float64))
        self.assertEqual(bounds, [[0, 20], [0, 100], [5, 45], [0, 10]])

    def test_changed_contract_and_invalid_target_rejected(self):
        with self.assertRaisesRegex(ValueError, "frozen150"):
            wind.validate_contract({}, "0" * 64)
        with self.assertRaisesRegex(ValueError, "target domain"):
            wind.transform_targets(self.torch.tensor([[0, 50, 20, -1]], dtype=self.torch.float64))


if __name__ == "__main__":
    unittest.main()

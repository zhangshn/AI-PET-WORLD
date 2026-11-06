"""149 synthetic stability and causality tests; no real-data fitting."""

import importlib.util
import io
from pathlib import Path
import time
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_stability.py"
spec = importlib.util.spec_from_file_location("stability149", PATH)
stability = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stability)


class StabilityChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = stability.pilot.configure_torch()
        cls.bounds = [[0, 100], [0, 100], [-20, 60], [0, 30]]
        cls.history = [[1, 50, 25, 2]] * 7

    def test_softplus_stable_for_zero_and_large_precipitation(self):
        t = self.torch
        target = t.tensor([[0, 0, -10, 0], [1e6, 100, 40, 2]], dtype=t.float64)
        transformed = stability.transform_targets(target)
        self.assertTrue(bool(t.isfinite(transformed).all()))
        recovered = stability.inverse_targets(transformed)
        self.assertTrue(bool(t.isfinite(recovered).all()))
        self.assertTrue(t.allclose(recovered[:, 0], target[:, 0] + 1e-6, rtol=1e-12, atol=1e-12))
        extremes = t.tensor([[-1000, 0, 25, 0], [1000, 0, 25, 0]], dtype=t.float64)
        self.assertTrue(bool(t.isfinite(stability.inverse_targets(extremes)).all()))
        self.assertEqual(float(stability.inverse_targets(extremes)[1, 0]), 1000)

    def test_other_three_transforms_and_fitted_weights_stay_identical(self):
        t = self.torch
        target = t.tensor([[i % 5, 30 + i, 20 + i / 10, 1 + i / 20] for i in range(12)], dtype=t.float64)
        history = t.arange(12 * 7 * 4, dtype=t.float64).reshape(12, 7, 4) / 100
        mean, std = t.zeros(4, dtype=t.float64), t.ones(4, dtype=t.float64)
        old = stability.comparison.fit_ridge(history, target, mean, std)
        new = stability.fit_ridge(history, target, mean, std)
        self.assertTrue(t.equal(stability.transform_targets(target)[:, 1:], stability.comparison.transform_targets(target)[:, 1:]))
        self.assertTrue(t.equal(old["weights"][:, 1:], new["weights"][:, 1:]))
        self.assertTrue(t.equal(stability.predict(new, history)[:, 1:], stability.comparison.predict(old, history)[:, 1:]))

    def test_guard_rejection_is_preserved_and_never_fed_back(self):
        t = self.torch
        calls = []
        def predictor(history):
            calls.append(history.clone())
            return t.tensor([[101, 50, 25, 2]], dtype=t.float64)
        result = stability.trajectory(predictor, self.history, "20220108", self.bounds, time.monotonic() + 10)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["completedAcceptedSteps"], 0)
        self.assertFalse(result["completed30Days"])
        self.assertFalse(result["firstRejection"]["appendedToHistory"])
        self.assertEqual(result["firstRejection"]["rawPrediction"][0], 101)
        self.assertEqual(result["firstRejection"]["inputHistory"], self.history)

    def test_nonfinite_rejection_is_json_serializable(self):
        t = self.torch
        result = stability.trajectory(lambda _: t.tensor([[float("inf"), 50, 25, 2]], dtype=t.float64), self.history, "20220108", self.bounds, time.monotonic() + 10)
        self.assertEqual(result["firstRejection"]["failures"][0]["reason"], "nonfinite")
        self.assertIn(b'"inf"', stability.pilot.json_bytes(result))

    def test_future_truth_changes_scores_without_changing_predictions(self):
        t = self.torch
        predictor = lambda h: h[:, -1, :]
        result = stability.trajectory(predictor, self.history, "20220108", self.bounds, time.monotonic() + 10)
        before = stability.pilot.json_bytes(result)
        truth_a = {s["date"]: [1, 50, 25, 2] for s in result["steps"]}
        truth_b = {s["date"]: [2, 60, 27, 3] for s in result["steps"]}
        scores_a = stability.score_trajectory(result, truth_a, t.ones(4, dtype=t.float64), t.ones(4, dtype=t.float64))
        scores_b = stability.score_trajectory(result, truth_b, t.ones(4, dtype=t.float64), t.ones(4, dtype=t.float64))
        self.assertEqual(before, stability.pilot.json_bytes(result))
        self.assertEqual(scores_a["30"]["metrics"]["meanNormalizedMAE"], 0)
        self.assertGreater(scores_b["30"]["metrics"]["meanNormalizedMAE"], 0)
        self.assertTrue(result["completed30Days"])

    def test_monthly_origins_never_cross_split_but_can_cross_month(self):
        windows = [{"split": "test", "targetDate": d, "historyDates": [], "history": self.history} for d in ["20230201", "20230202", "20231201", "20231203"]]
        selected = stability.origins(windows)
        self.assertEqual([x["targetDate"] for x in selected], ["20230201", "20231201"])
        self.assertGreater((stability.pilot.parse_date("20230201") + stability.dt.timedelta(days=29)).month, 2)
        self.assertEqual(stability.origins(windows[-1:]), [])

    def test_empirical_guard_formulas_use_only_train_days(self):
        t = self.torch
        train = [[0, 30, 20, 1], [10, 80, 30, 5]]
        bounds = stability.guard_bounds(train, t.tensor([1, 1, 5, 1], dtype=t.float64))
        self.assertEqual(bounds, [[0, 20], [0, 100], [5, 45], [0, 10]])

    def test_checkpoint_reload_and_changed_contract_rejection(self):
        t = self.torch
        history = t.arange(8 * 7 * 4, dtype=t.float64).reshape(8, 7, 4) / 100
        target = t.tensor([[i, 40 + i, 20 + i / 10, 1 + i / 20] for i in range(8)], dtype=t.float64)
        model = stability.fit_ridge(history, target, t.zeros(4, dtype=t.float64), t.ones(4, dtype=t.float64))
        stream = io.BytesIO()
        t.save(model, stream)
        stream.seek(0)
        loaded = t.load(stream, map_location="cpu", weights_only=True)
        self.assertTrue(t.equal(stability.predict(model, history), stability.predict(loaded, history)))
        with self.assertRaisesRegex(ValueError, "frozen149"):
            stability.validate_contract({}, "0" * 64)


if __name__ == "__main__":
    unittest.main()

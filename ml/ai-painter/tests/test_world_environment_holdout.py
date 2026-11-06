"""Synthetic151 tests; neither 2024 model metrics nor actual checkpoint is read."""

import copy
import importlib.util
import io
from pathlib import Path
import time
import unittest
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_holdout.py"
spec = importlib.util.spec_from_file_location("holdout151", PATH)
holdout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(holdout)


def fixture():
    dates = holdout.pilot.date_range("20240101", "20241231")
    values = {date: [i % 10, 40 + i % 40, 25 + (i % 10) / 10, 1 + (i % 9) / 10] for i, date in enumerate(dates)}
    windows = [{"split": "holdout2024", "history": [values[d] for d in dates[i - 7:i]], "historyDates": dates[i - 7:i],
                "target": values[dates[i]], "targetDate": dates[i]} for i in range(7, len(dates))]
    return {"schemaVersion": "world-environment-holdout-dataset-v1", "contractSha256": holdout.CONTRACT_SHA256, "sourceBinding": {"synthetic": True},
            "fieldOrder": holdout.pilot.FIELDS, "units": holdout.pilot.UNITS, "sourceDays": 366, "windows": windows,
            "splitSummary": [{"name": "holdout2024", "windows": 359}], "productionReady": False}


class HoldoutDatasetChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = fixture()

    def test_complete_leap_year_and_359_windows(self):
        self.assertIs(holdout.validate_dataset(self.data), self.data)

    def test_future_history_cross_year_and_target_reordering_rejected(self):
        for field, value in [("historyDates", ["20240101"] * 6 + ["20240108"]), ("targetDate", "20231231"), ("split", "test")]:
            data = copy.deepcopy(self.data)
            data["windows"][0][field] = value
            with self.assertRaises(ValueError):
                holdout.validate_dataset(data)

    def test_normalizer_data_unknown_fields_wrong_units_and_nonfinite_rejected(self):
        data = copy.deepcopy(self.data)
        data["trainDays"] = [[1, 2, 3, 4]]
        with self.assertRaisesRegex(ValueError, "schema"):
            holdout.validate_dataset(data)
        data = copy.deepcopy(self.data)
        data["units"][0] = "m/day"
        with self.assertRaisesRegex(ValueError, "unit"):
            holdout.validate_dataset(data)
        data = copy.deepcopy(self.data)
        data["windows"][0]["target"][0] = float("nan")
        with self.assertRaisesRegex(ValueError, "numeric"):
            holdout.validate_dataset(data)

    def test_monthly_origins_are_jan8_then_month1_inside2024(self):
        origins = holdout.select_origins(self.data["windows"])
        self.assertEqual(len(origins), 12)
        self.assertEqual([x["targetDate"] for x in origins], ["20240108"] + [f"2024{month:02d}01" for month in range(2, 13)])
        self.assertEqual(holdout.select_origins(self.data["windows"][-5:]), [])

    def test_changed_contract_rejected(self):
        with self.assertRaisesRegex(ValueError, "frozen151"):
            holdout.validate_contract({}, "0" * 64)


class FrozenModelChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = holdout.pilot.configure_torch()

    def model(self):
        t = self.t
        return {"weights": t.zeros(29, 4, dtype=t.float64), "inputMean": t.tensor([1, 50, 25, 2], dtype=t.float64),
                "inputStd": t.tensor([1, 10, 5, 1], dtype=t.float64), "targetMean": t.tensor([0, 0, 25, 0], dtype=t.float64), "targetStd": t.ones(4, dtype=t.float64)}

    def test_two_checkpoint_loads_match_and_do_not_fit_normalization(self):
        t = self.t
        checkpoint = {"schemaVersion": "world-environment-wind-stability-checkpoint-v1", "model": self.model(), "contractSha256": "c" * 64,
                      "datasetSha256": "d" * 64, "targetTransform": "rain_and_wind_inverse_softplus_others149", "fitCount": 1}
        stream = io.BytesIO()
        t.save(checkpoint, stream)
        ref = {"trainingContractSha256": "c" * 64, "trainingDatasetSha256": "d" * 64}
        with patch.object(holdout.wind, "checkpoint_bytes", return_value=stream.getvalue()), patch.object(holdout.pilot, "fit_normalizer", side_effect=AssertionError("normalizer fit forbidden")), patch.object(holdout.wind, "fit_ridge", side_effect=AssertionError("fit forbidden")):
            first = holdout.frozen_checkpoint(ref)
            second = holdout.frozen_checkpoint(ref)
            history = t.ones(3, 7, 4, dtype=t.float64)
            self.assertTrue(t.equal(holdout.wind.predict(first, history), holdout.wind.predict(second, history)))
            self.assertTrue(t.equal(first["inputMean"], checkpoint["model"]["inputMean"]))

    def test_future_targets_only_change_scores_not_feedback(self):
        t = self.t
        model = self.model()
        bounds = [[0, 100], [0, 100], [0, 40], [0, 10]]
        trajectory = holdout.wind.trajectory(lambda h: holdout.wind.predict(model, h), [[1, 50, 25, 2]] * 7, "20240108", bounds, time.monotonic() + 10)
        before = holdout.pilot.json_bytes(trajectory)
        truth_a = {s["date"]: [1, 50, 25, 2] for s in trajectory["steps"]}
        truth_b = {s["date"]: [10, 90, 35, 8] for s in trajectory["steps"]}
        a = holdout.wind.score_trajectory(trajectory, truth_a, model["inputStd"], model["inputMean"])
        b = holdout.wind.score_trajectory(trajectory, truth_b, model["inputStd"], model["inputMean"])
        self.assertNotEqual(a["30"]["metrics"], b["30"]["metrics"])
        self.assertEqual(before, holdout.pilot.json_bytes(trajectory))

    def test_guard_rejection_keeps_input_and_prevents_feedback(self):
        t = self.t
        calls = []
        def predictor(history):
            calls.append(history)
            return t.tensor([[0, 50, 25, 99]], dtype=t.float64)
        result = holdout.wind.trajectory(predictor, [[1, 50, 25, 2]] * 7, "20240108", [[0, 100], [0, 100], [0, 40], [0, 8.6]], time.monotonic() + 10)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["firstRejection"]["rawPrediction"][3], 99)
        self.assertFalse(result["firstRejection"]["appendedToHistory"])
        self.assertEqual(result["completedAcceptedSteps"], 0)


if __name__ == "__main__":
    unittest.main()

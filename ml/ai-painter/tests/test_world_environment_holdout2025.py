"""Synthetic154 evaluation checks; no real2025 model inference."""

import copy
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_holdout2025.py"
spec = importlib.util.spec_from_file_location("holdout154", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    dates = module.pilot.date_range("20250101", "20251231")
    values = {d: [i % 10, 40 + i % 40, 25 + (i % 9) / 10, 1 + (i % 7) / 10] for i, d in enumerate(dates)}
    windows = [{"split": "holdout2025", "history": [values[d] for d in dates[i - 7:i]], "historyDates": dates[i - 7:i], "target": values[dates[i]], "targetDate": dates[i]} for i in range(7, len(dates))]
    return {"schemaVersion": "world-environment-holdout2025-dataset-v1", "contractSha256": module.CONTRACT_SHA256, "sourceBinding": {"synthetic": True},
            "fieldOrder": module.pilot.FIELDS, "units": module.pilot.UNITS, "sourceDays": 365, "windows": windows, "splitSummary": [{"name": "holdout2025", "parserRole": "test"}], "productionReady": False}


class Holdout2025Checks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = module.pilot.configure_torch()

    def test_year_calendar_358windows_and12_origins(self):
        data = fixture()
        self.assertIs(module.validate_dataset(data), data)
        self.assertEqual([o["targetDate"] for o in module.select_origins(data["windows"])], ["20250108"] + [f"2025{m:02d}01" for m in range(2, 13)])

    def test_future_crossyear_and_unknown_normalization_rejected(self):
        for field, value in [("targetDate", "20241231"), ("historyDates", ["20250101"] * 6 + ["20250108"]), ("split", "holdout2024")]:
            data = fixture()
            data["windows"][0][field] = value
            with self.assertRaises(ValueError):
                module.validate_dataset(data)
        data = fixture()
        data["trainDays"] = []
        with self.assertRaisesRegex(ValueError, "schema"):
            module.validate_dataset(data)

    def synthetic_checkpoint(self):
        t = self.t
        model = {"weights": t.zeros(29, 4, dtype=t.float64), "inputMean": t.tensor([1, 50, 25, 2], dtype=t.float64), "inputStd": t.tensor([1, 10, 5, 1], dtype=t.float64),
                 "targetMean": t.tensor([0, 50, 25, 0], dtype=t.float64), "targetStd": t.ones(4, dtype=t.float64)}
        return {"schemaVersion": "world-environment-humidity-checkpoint-v1", "model": model, "contractSha256": "c" * 64, "trainingDatasetSha256": "d" * 64,
                "parentCheckpointSha256": "p" * 64, "fitCount": 1, "onlyFittedColumn": "RH2M", "targetTransform": "raw_RH_other_columns150"}

    def test_candidate_double_load_identity_and_no_fit(self):
        t = self.t
        checkpoint = self.synthetic_checkpoint()
        stream = io.BytesIO()
        t.save(checkpoint, stream)
        ref = {"trainingContractSha256": "c" * 64, "trainingDatasetSha256": "d" * 64}
        with patch.object(module.wind, "checkpoint_bytes", return_value=stream.getvalue()), patch.object(module.humidity, "fit_rh_column", side_effect=AssertionError("fit forbidden")), patch.object(module.pilot, "fit_normalizer", side_effect=AssertionError("normalizer fit forbidden")):
            first, second = module.load_candidate(ref, "p" * 64), module.load_candidate(ref, "p" * 64)
            history = t.ones(2, 7, 4, dtype=t.float64)
            self.assertTrue(t.equal(module.humidity.predict(first, history), module.humidity.predict(second, history)))
            with self.assertRaisesRegex(ValueError, "lineage"):
                module.load_candidate(ref, "q" * 64)

    def test_invalid_candidate_dtype_or_target_identity_rejected(self):
        for mutation in ("dtype", "target"):
            checkpoint = self.synthetic_checkpoint()
            if mutation == "dtype":
                checkpoint["model"]["weights"] = checkpoint["model"]["weights"].float()
            else:
                checkpoint["targetTransform"] = "old_logit"
            stream = io.BytesIO()
            self.t.save(checkpoint, stream)
            with patch.object(module.wind, "checkpoint_bytes", return_value=stream.getvalue()), self.assertRaises(ValueError):
                module.load_candidate({"trainingContractSha256": "c" * 64, "trainingDatasetSha256": "d" * 64}, "p" * 64)

    def test_all_six_criteria_and_partial_coverage_fail(self):
        def metric(n, rh):
            return {"meanNormalizedMAE": n, "perField": {"RH2M": {"MAE": rh}}}
        evaluation = {"candidate153": {"metrics": metric(1, 1), "guardViolations": {"RH2M": 0}, "ablationGuardViolations": {"RH2M": 0}}, "persistence": metric(2, 2)}
        aggregates = {label: {str(h): {"fullCoverage": True, "metrics": metric(1 if label == "candidate153" else 2, 1 if label == "candidate153" else 2), "constantLastDay": metric(3, 3)} for h in (7, 30)} for label in ("candidate153", "parent150")}
        rollouts = [{"candidate153": {"completed30Days": True}} for _ in range(12)]
        self.assertEqual(len(module.criteria(evaluation, aggregates, rollouts)), 6)
        self.assertTrue(all(module.criteria(evaluation, aggregates, rollouts).values()))
        changed = copy.deepcopy(aggregates)
        changed["candidate153"]["30"]["fullCoverage"] = False
        result = module.criteria(evaluation, changed, rollouts)
        self.assertFalse(result["thirtyDayRhBetterThanParent"])
        self.assertFalse(result["thirtyDayBetterThanConstant"])
        changed = copy.deepcopy(aggregates)
        changed["parent150"]["30"]["fullCoverage"] = False
        self.assertFalse(module.criteria(evaluation, changed, rollouts)["thirtyDayRhBetterThanParent"])
        self.assertFalse(module.criteria(evaluation, aggregates, rollouts[:-1])["all12CandidateThirtyDayRolloutsComplete"])

    def test_changed_contract_rejected_and_rh_not_clipped(self):
        with self.assertRaisesRegex(ValueError, "frozen154"):
            module.validate_contract({}, "0" * 64)
        model = self.synthetic_checkpoint()["model"]
        model["targetMean"][1] = 150
        prediction = module.humidity.predict(model, self.t.zeros(1, 7, 4, dtype=self.t.float64))
        self.assertEqual(float(prediction[0, 1]), 150)
        self.assertEqual(module.wind.parent.guard_failures(prediction[0], [[0, 238], [0, 100], [0, 40], [0, 9]])[0]["field"], "RH2M")


if __name__ == "__main__":
    unittest.main()

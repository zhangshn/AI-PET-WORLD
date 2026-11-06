"""153 synthetic-only column repair and complete evaluation criteria checks."""

import copy
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts/world_environment_humidity.py"
spec = importlib.util.spec_from_file_location("humidity153", PATH)
humidity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(humidity)


class HumidityChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = humidity.pilot.configure_torch()

    def parent(self):
        t = self.t
        return {"weights": t.arange(116, dtype=t.float64).reshape(29, 4) / 1000, "inputMean": t.tensor([1, 50, 25, 2], dtype=t.float64),
                "inputStd": t.tensor([2, 10, 5, 1], dtype=t.float64), "targetMean": t.tensor([1, 0, 25, 1], dtype=t.float64), "targetStd": t.ones(4, dtype=t.float64)}

    def fit(self, parent):
        t = self.t
        history = t.arange(12 * 7 * 4, dtype=t.float64).reshape(12, 7, 4) / 10
        target = t.tensor([[i % 5, 30 + i, 20 + i / 10, 1 + i / 20] for i in range(12)], dtype=t.float64)
        return humidity.fit_rh_column(parent, history, target), history, target

    def test_only_rh_column_fitted_and_parent_not_mutated(self):
        t = self.t
        parent = self.parent()
        before = {k: v.clone() for k, v in parent.items()}
        model, history, target = self.fit(parent)
        self.assertTrue(humidity.verify_unchanged_columns(model, parent))
        self.assertTrue(all(t.equal(v, before[k]) for k, v in parent.items()))
        self.assertFalse(t.equal(model["weights"][:, 1], parent["weights"][:, 1]))
        self.assertEqual(float(model["targetMean"][1]), float(target[:, 1].mean()))
        self.assertEqual(float(model["targetStd"][1]), float(target[:, 1].std(unbiased=False)))
        self.assertTrue(t.equal(humidity.predict(model, history)[:, [0, 2, 3]], humidity.wind.predict(parent, history)[:, [0, 2, 3]]))

    def test_raw_rh_output_not_clipped_or_sigmoid_squashed(self):
        t = self.t
        model = self.parent()
        model["weights"].zero_()
        model["targetMean"][1] = 150
        prediction = humidity.predict(model, t.zeros(1, 7, 4, dtype=t.float64))
        self.assertEqual(float(prediction[0, 1]), 150)
        failures = humidity.wind.parent.guard_failures(prediction[0], [[0, 238], [0, 100], [0, 40], [0, 9]])
        self.assertEqual(failures[0]["field"], "RH2M")
        self.assertEqual(failures[0]["rawValue"], 150)

    def test_strict_checkpoint_reload_and_bad_rh_targets(self):
        t = self.t
        parent = self.parent()
        model, history, target = self.fit(parent)
        stream = io.BytesIO()
        t.save(model, stream)
        stream.seek(0)
        loaded = t.load(stream, map_location="cpu", weights_only=True)
        self.assertTrue(t.equal(humidity.predict(model, history), humidity.predict(loaded, history)))
        target[0, 1] = 101
        with self.assertRaisesRegex(ValueError, "RH training targets"):
            humidity.fit_rh_column(parent, history, target)

    def test_changed_contract_and_dataset_sha_rejected(self):
        with self.assertRaisesRegex(ValueError, "frozen153"):
            humidity.validate_contract({}, "0" * 64)
        evidence = humidity.EVIDENCE_ROOT / "model-delivery"
        evidence.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=evidence) as directory:
            path = Path(directory) / "synthetic.json"
            path.write_text('{"synthetic":true}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "SHA mismatch"):
                humidity.pilot.read_bound(path, "0" * 64)

    def test_future_history_rejected_by_reused_validator(self):
        test_path = Path(__file__).with_name("test_world_environment_holdout.py")
        spec = importlib.util.spec_from_file_location("holdout151_fixture_only", test_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        data = module.fixture()
        data["windows"][0]["historyDates"][-1] = data["windows"][0]["targetDate"]
        with self.assertRaisesRegex(ValueError, "future"):
            humidity.holdout.validate_dataset(data)

    def test_six_criteria_include_all_splits_horizons_and_failed_origins(self):
        def metric(n, rh):
            return {"meanNormalizedMAE": n, "perField": {"RH2M": {"MAE": rh}}}
        evaluations = {s: {"candidate153": {"metrics": metric(1, 1), "guardViolations": {"RH2M": 0}, "ablationGuardViolations": {"RH2M": 0}}, "persistence": metric(2, 2)} for s in humidity.SPLITS}
        aggregate = {label: {s: {str(h): {"fullCoverage": True, "metrics": metric(1 if label == "candidate153" else 2, 1 if label == "candidate153" else 2), "constantLastDay": metric(3, 3)} for h in (7, 30)} for s in humidity.SPLITS} for label in ("candidate153", "parent150")}
        rollouts = [{"candidate153": {"completed30Days": True}} for _ in range(60)]
        self.assertTrue(all(humidity.criteria(evaluations, aggregate, rollouts).values()))
        for split in humidity.EVALUATION_SPLITS:
            changed = copy.deepcopy(aggregate)
            changed["candidate153"][split]["30"]["metrics"]["perField"]["RH2M"]["MAE"] = 3
            self.assertFalse(humidity.criteria(evaluations, changed, rollouts)["thirtyDayRhBetterThanParentEachEvaluationSplit"])
            changed = copy.deepcopy(aggregate)
            changed["candidate153"][split]["7"]["fullCoverage"] = False
            self.assertFalse(humidity.criteria(evaluations, changed, rollouts)["sevenDayBetterEachEvaluationSplit"])
        broken = copy.deepcopy(rollouts)
        broken[0]["candidate153"]["completed30Days"] = False
        self.assertFalse(humidity.criteria(evaluations, aggregate, broken)["all60CandidateThirtyDayRolloutsComplete"])
        changed = copy.deepcopy(evaluations)
        changed["train"]["candidate153"]["ablationGuardViolations"]["RH2M"] = 1
        self.assertFalse(humidity.criteria(changed, aggregate, rollouts)["allSplitsOneStepAndAblationGuards"])


if __name__ == "__main__":
    unittest.main()

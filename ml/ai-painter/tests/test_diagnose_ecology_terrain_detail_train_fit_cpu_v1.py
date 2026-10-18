"""Pure diagnostic shape/metric regressions; no Torch or real inference."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest

FILE = Path(__file__).absolute().parents[1] / "scripts/diagnose_ecology_terrain_detail_train_fit_cpu_v1.py"
spec = importlib.util.spec_from_file_location("train_fit_readonly", FILE)
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)


class ReadonlyFitTests(unittest.TestCase):
    def request(self):
        value = {"schemaVersion": "terrain-train-fit-readonly-request-v1", "runId": subject.RUN,
                 "outputRoot": subject.OUTPUT, "limits": deepcopy(subject.LIMITS),
                 "trainingAllowed": False, "qualificationGranted": False}
        for key in ("qualityPlan", "workerTerminal", "cpuReview", "executionPackage", "checkpoint", "adapter"):
            value[key] = {"path": subject.SELF if key == "adapter" else "data/" + key,
                          "sha256": "a" * 64}
        return value

    def rows(self):
        return [{"sampleId": str(i), "split": "train", "fullRgbMae": 0.1,
                 "objectCorrelations": {key: i / 100 for key in subject.ROLES}} for i in range(48)]

    def test_exact_request(self):
        self.assertEqual(subject.validate_request(self.request())["limits"], subject.LIMITS)

    def test_no_other_run(self):
        r = self.request(); r["runId"] = "old"
        with self.assertRaises(ValueError): subject.validate_request(r)

    def test_no_other_output(self):
        r = self.request(); r["outputRoot"] += "/../old"
        with self.assertRaises(ValueError): subject.validate_request(r)

    def test_no_budget_expansion(self):
        for key in ("maxWallSeconds", "maxGeneratorForwards", "optimizerSteps", "autogradCalls"):
            r = self.request(); r["limits"][key] += 1
            with self.assertRaises(ValueError): subject.validate_request(r)

    def test_no_training_or_qualification(self):
        for key in ("trainingAllowed", "qualificationGranted"):
            r = self.request(); r[key] = True
            with self.assertRaises(ValueError): subject.validate_request(r)

    def test_no_bad_binding(self):
        r = self.request(); r["checkpoint"]["sha256"] = "z" * 64
        with self.assertRaises(ValueError): subject.validate_request(r)

    def test_complete_summary(self):
        result = subject.summarize(self.rows())
        self.assertAlmostEqual(result["meanRgbMae"], .1)
        self.assertAlmostEqual(result["roles"][subject.ROLES[0]]["medianCorrelation"], .235)
        self.assertEqual(result["roles"][subject.ROLES[0]]["negativeOrZeroCount"], 1)

    def test_no_missing_row(self):
        with self.assertRaises(ValueError): subject.summarize(self.rows()[:-1])

    def test_no_duplicate_row(self):
        rows = self.rows(); rows[-1] = rows[0]
        with self.assertRaises(ValueError): subject.summarize(rows)

    def test_no_validation_row(self):
        rows = self.rows(); rows[0]["split"] = "validation"
        with self.assertRaises(ValueError): subject.summarize(rows)

    def test_no_nonfinite_metric(self):
        rows = self.rows(); rows[0]["objectCorrelations"][subject.ROLES[0]] = float("nan")
        with self.assertRaises(ValueError): subject.summarize(rows)

    def test_missing_class_not_success(self):
        rows = self.rows()
        for row in rows: row["objectCorrelations"][subject.ROLES[0]] = None
        result = subject.summarize(rows)["roles"][subject.ROLES[0]]
        self.assertEqual(result["applicableCount"], 0)
        self.assertIsNone(result["meanCorrelation"])


if __name__ == "__main__": unittest.main()

"""Synthetic scalar-only tests, zero model/optimizer/GPU execution."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).absolute().parents[1] / "scripts"))
from painter_stage4_decode1_entry_weight_lifecycle_v1 import LearningObservations, existing_values


class LearningObservationTests(unittest.TestCase):
    def position(self, g):
        return {"epoch": (g - 1) // 48 + 1, "zeroBasedEpochPosition": (g - 1) % 48,
                "trainIndex": 0, "sampleId": "fixed-train"}

    def result(self, value):
        return {"generatorLoss": value, "discriminatorLoss": 2., "fiveGradientFacts": {
            "scalarValues": {"actualTotal": value, "objectCoreRgb": .25},
            "generatorGradientFacts": {"tensorCount": 108, "allFinite": True, "nonzeroTensorCount": 100,
                                       "headCandidateL2": {"object_tree": .5}},
            "rawGradients": [object()]}}

    def observe(self, observer, g, result):
        observer.observe(self.position(g), {"generator": g, "discriminator": g},
                         {"sampleId": "fixed-train", "generator": 1, "discriminator": 1}, result)

    def test_all_updates_aggregate_but_fixed_bounded_records(self):
        records = []
        observer = LearningObservations(run_id="fixture", write_record=lambda index, value: records.append(value) or {"index": index})
        for g in range(1, 1153):
            self.observe(observer, g, self.result(float(g)))
        manifest = observer.finish()
        self.assertEqual(len(records), 120)
        self.assertEqual(len(manifest["completedEpochs"]), 24)
        self.assertEqual(manifest["successfulPairCount"], 1152)
        self.assertEqual(manifest["completedEpochs"][0]["values"]["generatorLoss"]["mean"], 24.5)
        self.assertFalse(manifest["qualificationGranted"])
        self.assertNotIn("rawGradients", str(records))
        self.assertEqual(records[0]["additionalBackwardCalls"], 0)

    def test_partial_and_missing_are_not_zero_or_complete(self):
        observer = LearningObservations(run_id="fixture", write_record=lambda i, r: {"index": i})
        self.observe(observer, 1, None)
        manifest = observer.finish()
        self.assertEqual(manifest["status"], "partial")
        self.assertEqual(manifest["missingResultCount"], 1)
        self.assertEqual(manifest["partialEpochValues"], {})
        self.assertEqual(manifest["completedEpochs"], [])

    def test_no_claim_before_dual_update_and_no_duplicate(self):
        observer = LearningObservations(run_id="fixture", write_record=lambda i, r: {})
        with self.assertRaises(ValueError):
            observer.observe(self.position(1), {"generator": 0, "discriminator": 1},
                             {"sampleId": "fixed-train", "generator": 0, "discriminator": 1}, self.result(.1))
        self.observe(observer, 1, self.result(.1))
        with self.assertRaises(ValueError):
            self.observe(observer, 1, self.result(.1))

    def test_failure_retained_without_replaying_update_or_writer(self):
        calls = []
        def reject(i, record):
            calls.append(i)
            raise OSError("fixture unavailable")
        observer = LearningObservations(run_id="fixture", write_record=reject)
        for g in range(1, 49):
            self.observe(observer, g, self.result(.1))
        self.assertEqual(calls, [1])
        result = observer.finish()
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["successfulPairCount"], 48)
        self.assertEqual(result["recordingError"]["errorType"], "OSError")

    def test_nonfinite_and_tensorlike_never_converted(self):
        class TensorLike:
            def item(self):
                raise AssertionError("must not evaluate a tensor")
        values, reason = existing_values({"generatorLoss": float("nan"), "discriminatorLoss": TensorLike()})
        self.assertEqual(values, {})
        self.assertIsNotNone(reason)


if __name__ == "__main__":
    unittest.main()

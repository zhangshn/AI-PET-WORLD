from __future__ import annotations

import sys
from pathlib import Path
import unittest

import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from diagnose_stage4_v24_validation_shadow import validation_metrics  # noqa: E402


class ValidationShadowMetricTests(unittest.TestCase):
    def setUp(self):
        self.order = ["object_footprints", "object_tree", "object_rock",
                      "object_vegetation", *[f"other_{index}" for index in range(19)]]
        self.sample = {"split": "validation", "image": torch.zeros((3, 192, 256)),
                       "conditions": torch.zeros((23, 192, 256))}
        self.prediction = torch.zeros((1, 3, 192, 256))

    def test_validation_error_and_empty_role_are_explicit(self):
        self.sample["conditions"][0, 0, 0] = 1
        self.sample["conditions"][1, 0, 0] = 1
        self.prediction[0, :, 0, 0] = 0.5
        result = validation_metrics(self.prediction, self.sample, self.order)
        self.assertAlmostEqual(result["rgbMae"], 0.5 / (192 * 256))
        self.assertEqual(result["objects"]["object_tree"]["rgbMae"], 0.5)
        self.assertIsNone(result["objects"]["object_rock"]["rgbMae"])

    def test_train_and_nonbinary_masks_are_rejected(self):
        self.sample["split"] = "train"
        with self.assertRaisesRegex(ValueError, "rejects other splits"):
            validation_metrics(self.prediction, self.sample, self.order)
        self.sample["split"] = "validation"
        self.sample["conditions"][0, 0, 0] = 0.5
        with self.assertRaisesRegex(ValueError, "nonbinary"):
            validation_metrics(self.prediction, self.sample, self.order)

    def test_nonfinite_or_out_of_range_prediction_is_rejected(self):
        self.prediction[0, 0, 0, 0] = float("nan")
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            validation_metrics(self.prediction, self.sample, self.order)
        self.prediction[0, 0, 0, 0] = 1.1
        with self.assertRaisesRegex(ValueError, "outside RGB range"):
            validation_metrics(self.prediction, self.sample, self.order)


if __name__ == "__main__":
    unittest.main()

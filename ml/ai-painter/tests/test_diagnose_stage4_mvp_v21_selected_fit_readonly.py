"""Synthetic, CPU-only tests for fixed V21 diagnostic sample and metric boundaries."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import diagnose_stage4_mvp_v21_selected_fit_readonly as probe


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        import torch
        self.order = ["other_" + str(i) for i in range(18)] + list(probe.ROLES)
        self.conditions = torch.zeros((23, 192, 256))
        for index, role in enumerate(probe.ROLES):
            self.conditions[self.order.index(role), 32 + index, 40] = 1
        self.target = torch.full((1, 3, 192, 256), .5)

    def test_fixed_train_and_validation_plan_never_includes_heldout_split(self):
        self.assertEqual([(split, ordinal) for split, ordinal, _ in probe.SUBJECTS],
                         [("train", 0), ("train", 43), ("validation", 5)])
        self.assertEqual(len({sample for _, _, sample in probe.SUBJECTS}), 3)

    def test_masked_rgb_and_edge_error_excludes_foreign_pixels(self):
        exact = probe.region_metrics(self.target, self.target, self.conditions, self.order)
        for role in probe.ROLES:
            self.assertEqual(exact[role]["rgbMae"], 0)
            self.assertEqual(exact[role]["signedEdgeDifferenceMae"], 0)
            self.assertIsNone(exact[role]["centeredLumaCorrelation"])
        changed = self.target.clone()
        changed[:, :, 0, 0] += .25
        regions = probe.region_metrics(changed, self.target, self.conditions, self.order)
        for role in probe.ROLES:
            self.assertEqual(regions[role]["rgbMae"], 0)

    def test_luma_correlation_and_empty_role_applicability(self):
        import torch
        target = self.target.clone()
        predicted = self.target.clone()
        role = "object_tree"
        channel = self.order.index(role)
        self.conditions[channel, 50, 50:54] = 1
        for i in range(4):
            target[:, :, 50, 50 + i] = .2 + .1 * i
            predicted[:, :, 50, 50 + i] = .2 + .1 * i
        result = probe.region_metrics(predicted, target, self.conditions, self.order)
        self.assertAlmostEqual(result[role]["centeredLumaCorrelation"], 1, places=5)
        self.conditions[self.order.index("object_rock")] = 0
        result = probe.region_metrics(predicted, target, self.conditions, self.order)
        self.assertEqual(result["object_rock"]["applicability"], "empty_no_positive_evidence")
        self.assertIsNone(result["object_rock"]["rgbMae"])

    def test_preflight_never_deserializes_checkpoint_or_decodes_pixels(self):
        import torch
        with patch.object(torch, "load", side_effect=AssertionError("checkpoint decoded")), \
             patch.object(probe.cpu, "load_sample", side_effect=AssertionError("pixels decoded")):
            context = probe.preflight()
        self.assertEqual([(split, ordinal, row["sampleId"])
                          for split, ordinal, row in context["rows"]], list(probe.SUBJECTS))
        self.assertEqual(context["checkpoint"]["sha256"], probe.CHECKPOINT_SHA)


if __name__ == "__main__": unittest.main()

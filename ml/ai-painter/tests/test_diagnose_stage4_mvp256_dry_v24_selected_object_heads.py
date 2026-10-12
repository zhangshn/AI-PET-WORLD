"""CPU-only checks for the selected V24 object-head ablation."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp256_dry_v24_selected_object_heads as subject  # noqa: E402


class SelectedHeadAblationTests(unittest.TestCase):
    def test_current_candidate_preflight_or_consumed_evidence_is_immutable(self):
        report_path = subject.materialize.project_file(subject.REPORT)
        if report_path.exists():
            before = report_path.read_bytes()
            with self.assertRaisesRegex(ValueError, "already consumed"):
                subject.run(execute=False)
            self.assertEqual(report_path.read_bytes(), before)
            report = subject.materialize.bound_json(
                subject.materialize.bind(subject.REPORT))
            self.assertEqual(report["program"], subject.materialize.bind(
                "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v24_selected_object_heads.py"))
        else:
            result = subject.run(execute=False)
            self.assertEqual(result["status"], "cpu_preflight_passed_not_executed")
            self.assertFalse(report_path.exists())

    def test_head_effect_reports_signed_improvement(self):
        target = torch.zeros((1, 3, 192, 256))
        prediction = target.clone()
        without = target.clone()
        without[:, :, 3, 4] = 0.2
        residual = target.clone()
        residual[:, :, 3, 4] = 0.4
        mask = torch.zeros((1, 1, 192, 256), dtype=torch.bool)
        mask[:, :, 3, 4] = True
        result = subject.head_effect(prediction, target, without, residual, mask, mask)
        self.assertEqual(result["corePixels"], 1)
        self.assertAlmostEqual(result["coreRgbMaeImprovementFromHead"], 0.2)

    def test_residual_outside_support_fails_closed(self):
        rgb = torch.zeros((1, 3, 192, 256))
        residual = rgb.clone()
        residual[:, :, 3, 5] = 0.1
        mask = torch.zeros((1, 1, 192, 256), dtype=torch.bool)
        mask[:, :, 3, 4] = True
        with self.assertRaisesRegex(ValueError, "escaped visible support"):
            subject.head_effect(rgb, rgb, rgb, residual, mask, mask)


if __name__ == "__main__":
    unittest.main()

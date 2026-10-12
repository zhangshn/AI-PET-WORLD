"""CPU checks for the one-row V24 spatial-gradient diagnostic."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp256_dry_v24_spatial_gradient as subject  # noqa: E402


class SpatialGradientDiagnosticTests(unittest.TestCase):
    def test_orthogonal_gradients_have_zero_cosine(self):
        value = subject.gradient_relation(
            (torch.tensor([1.0, 0.0]),), (torch.tensor([0.0, 2.0]),))
        self.assertEqual(value["spatialToCoreL2Ratio"], 0.5)
        self.assertEqual(value["cosine"], 0.0)

    def test_missing_head_gradient_fails(self):
        with self.assertRaisesRegex(ValueError, "unused"):
            subject.gradient_relation((None,), (torch.tensor([1.0]),))

    def test_current_candidate_preflight_or_consumed_evidence(self):
        report = subject.materialize.project_file(subject.REPORT)
        if report.exists():
            before = report.read_bytes()
            with self.assertRaisesRegex(ValueError, "already consumed"):
                subject.run(execute=False)
            self.assertEqual(report.read_bytes(), before)
        else:
            value = subject.run(execute=False)
            self.assertEqual(value["status"], "cpu_preflight_passed_not_executed")
            self.assertFalse(report.exists())


if __name__ == "__main__":
    unittest.main()

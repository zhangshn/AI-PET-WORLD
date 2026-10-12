"""Boundary checks for the selected V24 48-train fit diagnostic."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp256_dry_v24_train_fit as subject  # noqa: E402


class TrainFitDiagnosticTests(unittest.TestCase):
    def test_complete_unique_train_rows_required(self):
        row = {"sampleId": "same", "correlations": {
            role: 0.5 for role in subject.OBJECT_CHANNELS}}
        with self.assertRaisesRegex(ValueError, "complete unique"):
            subject.summarize([row] * 48)

    def test_summary_counts_nonpositive_values(self):
        rows = [{"sampleId": str(i), "correlations": {
            role: -0.1 if i == 0 else 0.5 for role in subject.OBJECT_CHANNELS}}
            for i in range(48)]
        value = subject.summarize(rows)
        self.assertEqual(value["object_rock"]["applicableCount"], 48)
        self.assertEqual(value["object_rock"]["negativeOrZeroCount"], 1)

    def test_consumed_report_is_program_bound(self):
        report = subject.materialize.bound_json(
            subject.materialize.bind(subject.REPORT))
        self.assertEqual(report["program"], subject.materialize.bind(
            "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v24_train_fit.py"))
        self.assertEqual(report["boundary"]["optimizerSteps"], 0)


if __name__ == "__main__":
    unittest.main()

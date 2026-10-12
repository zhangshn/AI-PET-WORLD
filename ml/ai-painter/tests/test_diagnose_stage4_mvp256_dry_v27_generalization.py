"""Positive, negative and zero-update checks for standalone CPU diagnosis."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp256_dry_v27_generalization as subject


def rows(split, correlation=.5):
    return [{"sampleId": split + str(i), "split": split, "rgbMae": .1,
             "correlations": {role: correlation for role in subject.ROLES}}
            for i in range(subject.COUNTS[split])]


class GeneralizationTests(unittest.TestCase):
    def test_exact_membership_required(self):
        with self.assertRaisesRegex(ValueError, "complete unique"):
            subject.summarize(rows("train")[:-1], "train")

    def test_duplicate_sample_rejected(self):
        values = rows("train")
        values[-1] = values[0]
        with self.assertRaisesRegex(ValueError, "complete unique"):
            subject.summarize(values, "train")

    def test_split_substitution_rejected(self):
        values = rows("validation")
        values[0]["split"] = "train"
        with self.assertRaisesRegex(ValueError, "complete unique"):
            subject.summarize(values, "validation")

    def test_challenge_content_prohibited(self):
        with self.assertRaisesRegex(ValueError, "split prohibited"):
            subject.summarize([], "challenge")

    def test_nonfinite_measurement_rejected(self):
        values = rows("train")
        values[0]["rgbMae"] = float("nan")
        with self.assertRaisesRegex(ValueError, "RGB error"):
            subject.summarize(values, "train")

    def test_invalid_correlation_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid correlation"):
            subject.summarize(rows("train", 1.5), "train")

    def test_gap_not_root_cause_or_qualification(self):
        train, validation = subject.summarize(rows("train", .7), "train"), subject.summarize(rows("validation", .1), "validation")
        result = subject.compare_splits(train, validation)
        self.assertEqual(result["pattern"], "train_higher_on_all_applicable_roles")
        self.assertEqual(result["causalRootCause"], "not_identified_by_split_statistics")
        self.assertFalse(result["trainingRestartRecommended"])
        self.assertFalse(result["qualificationGranted"])

    def test_unavailable_correlation_remains_unknown(self):
        result = subject.compare_splits(subject.summarize(rows("train", None), "train"),
                                        subject.summarize(rows("validation"), "validation"))
        self.assertEqual(result["pattern"], "mixed_or_insufficient_evidence")
        self.assertIsNone(result["roles"]["object_rock"]["trainMeanMinusValidationMean"])

    def test_saved_validation_measurements_match(self):
        actual = rows("validation")
        saved = [{"sampleId": row["sampleId"], "observation": {
            "fullRgbMae": row["rgbMae"], "objectCorrelations": row["correlations"]}} for row in actual]
        subject.validate_saved_rows(actual, saved, [r["sampleId"] for r in actual])
        saved[0]["observation"]["fullRgbMae"] = .2
        with self.assertRaisesRegex(ValueError, "RGB measurement differs"):
            subject.validate_saved_rows(actual, saved, [r["sampleId"] for r in actual])

    def test_saved_validation_order_cannot_change(self):
        actual = rows("validation")
        with self.assertRaisesRegex(ValueError, "identity or order"):
            subject.validate_saved_rows(actual, [], [r["sampleId"] for r in actual])

    def test_distribution_is_descriptive_not_coverage_proof(self):
        def item(split, mean, condition_hash, rgb_hash):
            return {"sampleId": split, "split": split, "census": {
                "channelMeans": {"terrain_water": mean}, "objectKinds": {"rock": 1},
                "conditionTensorSha256": condition_hash, "rgbTargetTensorSha256": rgb_hash}}
        result = subject.distribution([item("train", .1, "same", "rgb1"),
                                       item("validation", .2, "same", "rgb2")], ["terrain_water"])
        self.assertEqual(len(result["validationChannelMeanOutsideTrainRange"]), 1)
        self.assertFalse(result["exactCrossSplitConditionTensorMatches"][0]["sameRgbTarget"])
        self.assertIn("do not prove coverage", result["limitation"])

    def test_preflight_rejects_wrong_evidence_before_inference(self):
        with patch.object(subject.review, "preflight", side_effect=ValueError("wrong terminal SHA")):
            with self.assertRaisesRegex(ValueError, "wrong terminal SHA"):
                subject.run({"path": "wrong", "sha256": "0" * 64}, execute=True)

    def test_existing_readonly_guard_blocks_training_mutations(self):
        import torch
        self.assertFalse(torch.cuda.is_initialized())
        with subject.review.core.fit.readonly_guard():
            with self.assertRaisesRegex(RuntimeError, "optimizer prohibited"):
                torch.optim.SGD([torch.nn.Parameter(torch.ones(1))], lr=.1)
            with self.assertRaisesRegex(RuntimeError, "checkpoint write prohibited"):
                torch.save({}, "must-not-be-written.pt")
            with self.assertRaisesRegex(RuntimeError, "backward prohibited"):
                torch.ones(1, requires_grad=True).sum().backward()
        self.assertFalse(torch.cuda.is_initialized())

    def test_cli_uses_bounded_argument_array_not_shell(self):
        with patch.object(sys, "argv", ["diagnose", "--training-terminal", "terminal.json",
                "--training-terminal-sha256", "0" * 64, "--execute"]), \
                patch.object(subject, "run", return_value={"outputRoot": "unused"}) as preflight, \
                patch.object(subject.subprocess, "run", return_value=SimpleNamespace(returncode=0)) as child:
            subject.main()
        preflight.assert_called_once_with({"path": "terminal.json", "sha256": "0" * 64}, execute=False)
        self.assertIsInstance(child.call_args.args[0], list)
        self.assertIn("--worker", child.call_args.args[0])
        self.assertEqual(child.call_args.kwargs["timeout"], 180)
        self.assertNotIn("shell", child.call_args.kwargs)

    def test_timeout_stops_without_retry(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            with patch.object(sys, "argv", ["diagnose", "--training-terminal", "terminal.json",
                    "--training-terminal-sha256", "0" * 64, "--execute"]), \
                    patch.object(subject, "run", return_value={"outputRoot": "diagnostic"}), \
                    patch.object(subject.subprocess, "run", side_effect=subprocess.TimeoutExpired("child", 180)) as child, \
                    patch.object(subject.review.files, "project_file", return_value=output), \
                    patch.object(subject.review.files, "write_exclusive") as record:
                with self.assertRaises(SystemExit) as failure:
                    subject.main()
                self.assertEqual(failure.exception.code, 124)
                self.assertEqual(child.call_count, 1)
                self.assertIn(b"cpu_wall_time_exceeded", record.call_args.args[1])


if __name__ == "__main__":
    unittest.main()

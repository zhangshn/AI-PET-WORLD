"""CPU-only boundary checks for V24 selected dry-world materialization."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import materialize_stage4_mvp256_dry_v24_candidate as subject  # noqa: E402


class MaterializationBoundaryTests(unittest.TestCase):
    def test_existing_frozen_candidate_binding_is_readable(self):
        binding = subject.bind(subject.worker.CANDIDATE_PATH)
        value = subject.bound_json(binding)
        self.assertEqual(value["status"], "cpu_candidate_not_execution_qualified")
        self.assertFalse(value["activation"]["trainingAllowed"])

    def test_paths_must_remain_exactly_inside_project(self):
        for name in ("../outside.json", "/absolute.json", "C:/absolute.json",
                     "evidence/../outside.json", "evidence/latest.json",
                     "evidence\\outside.json"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                subject.project_file(name)

    def test_registered_runtime_mount_is_accepted_but_changed_mount_is_rejected(self):
        logical = ".runtime/ai-painter/current-execution-registry/current.json"
        self.assertTrue(subject.project_file(logical).is_relative_to(
            subject.REGISTERED_HOT_RUNTIME_ROOT.resolve()))
        with patch.object(subject, "REGISTERED_HOT_RUNTIME_ROOT", ROOT):
            with self.assertRaisesRegex(ValueError, "registered runtime"):
                subject.project_file(logical)

    def test_preflight_rejects_missing_or_forged_request_without_training(self):
        for binding in ({"path": "data/no-such-request.json", "sha256": "a" * 64},
                        {"path": subject.worker.CANDIDATE_PATH, "sha256": "a" * 64}):
            with self.subTest(binding=binding["path"]), self.assertRaises(Exception):
                subject.check_request(binding)


if __name__ == "__main__":
    unittest.main()

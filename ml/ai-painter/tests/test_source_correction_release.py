"""CPU package mechanics; actual RGB/source replay is verified separately locally."""
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

from ai_painter.complete_world import source_correction_release as correction
from ai_painter.complete_world import split_release as release
from test_stage4_split_release import fixture_rows


class SourceCorrectionReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="source-release-unit-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.old = fixture_rows()
        for row in self.old:
            row["contribution"] = {"path": "original/contribution.json", "sha256": "c" * 64}
        self.parent = {"schemaVersion": correction.PARENT_SCHEMA,
            "qualification": {"dataQualifiedForTraining": True, "foundationQualified": True},
            "sourceIndex": {"path": "original/index.json", "sha256": "d" * 64},
            "splits": {s: self.put(f"original/{s}.json", {"sampleIds": [r["sampleId"]
                for r in self.old if r["split"] == s]}) for s in release.COUNTS},
            "requirements": ["unchanged"], "identityPayload": {"channelOrder": [f"c-{i}" for i in range(23)],
                "continuousChannelIds": ["c-0"]},
            "foundationQualification": {"path": "original/foundation.json", "sha256": "e" * 64},
            "foundationCheckpoint": {"path": "original/foundation.pt", "sha256": "f" * 64}}
        self.parent_binding = self.put("original/manifest.json", self.parent)
        record = {"recordId": "corrected", "relativeDirectory": "library/corrected",
            "originalImage": {"path": "source/original.png", "sha256": "a" * 64},
            "sourceCorrection": {"parentSampleId": self.old[0]["sampleId"],
                "intakeEvidence": {"path": "library/corrected/intake.json", "sha256": "b" * 64}}}
        record_binding = self.put("library/corrected/record.json", record)
        self.proposed = deepcopy(self.old)
        self.proposed[0].update({"sampleId": "corrected", "image": {"path": "library/corrected/source/original.png",
                "sha256": "a" * 64}, "sourceRecord": record_binding,
            "sourceCorrection": record["sourceCorrection"]["intakeEvidence"],
            "parentSampleId": self.old[0]["sampleId"],
            "parentContributionForLineageOnly": self.old[0]["contribution"], "useQualification": "draft_not_released"})
        self.proposed[0].pop("contribution")
        self.candidate = {"schemaVersion": correction.CANDIDATE_SCHEMA, "status": "draft_not_released",
            "datasetReleaseIdentity": None, "sampleCount": 64, "splitCounts": release.COUNTS,
            "parentDataset": self.parent_binding, "replacedSample": self.old[0]["sampleId"],
            "replacementRecord": record_binding,
            "sourceIndex": self.put("candidate/index.json", {"samples": self.proposed}),
            "splits": {s: self.put(f"candidate/{s}.json", {"sampleIds": [r["sampleId"]
                for r in self.proposed if r["split"] == s]}) for s in release.COUNTS}}
        self.request = {"schemaVersion": "source-correction-dataset-release-request-v1", "operation": "verify",
            "candidateManifest": self.put("candidate/manifest.json", self.candidate),
            "sourceReview": {"path": "library/corrected/review.json", "sha256": "a" * 64}}
        self.request_binding = self.put("request.json", self.request)
        self.verification = {"schemaVersion": "source-correction-publication-verification-v1",
            "candidateManifest": self.request["candidateManifest"], "sourceReview": self.request["sourceReview"],
            "parentDataset": self.parent_binding, "replacementRecord": record_binding,
            "imageSha256": "a" * 64, "inputBindings": [self.request["candidateManifest"], record_binding]}
        self.programs = [{"path": "verifier.py", "sha256": "a" * 64}]
        self.runtime = {"path": "unit-only-node", "sha256": "b" * 64}

    def put(self, logical, value):
        data = release.canonical_bytes(value) + b"\n"
        target = self.root / logical
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return {"path": logical, "sha256": release.digest(data)}

    def verify_rows(self):
        return correction.verify_rows(self.root, self.candidate, self.parent, self.old, self.proposed)

    def mock_build_inputs(self):
        # Synthetic fixtures isolate deterministic materialization from real source auditing.
        for target, kwargs in [("verify_with_node", {"return_value": (self.request, self.verification,
                self.programs, self.runtime)}), ("load_package", {"return_value": (self.parent, self.old)}),
                ("_verify_assets", {}), ("_programs", {"return_value": self.programs})]:
            item = patch.object(correction, target, **kwargs)
            item.start()
            self.addCleanup(item.stop)

    def test_exact_one_train_replacement_keeps_other_63_and_conditions(self):
        self.assertEqual(self.verify_rows(), 0)
        self.assertEqual(self.proposed[1:], self.old[1:])
        self.assertEqual(self.proposed[0]["conditionPack"], self.old[0]["conditionPack"])

    def test_any_other_row_change_is_rejected(self):
        for index in (1, 48, 56, 60):
            with self.subTest(index=index):
                self.proposed = deepcopy(self.proposed)
                self.proposed[index]["ordinal"] = 999
                with self.assertRaisesRegex(ValueError, "other 63"):
                    self.verify_rows()
                self.proposed[index] = deepcopy(self.old[index])

    def test_non_train_replacement_rejected(self):
        self.old[0]["split"] = self.proposed[0]["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "only a train"):
            self.verify_rows()

    def test_changed_condition_or_grouping_is_rejected(self):
        for key in ("conditionPack", "grouping"):
            original = deepcopy(self.proposed[0][key])
            self.proposed[0][key] = {}
            with self.assertRaisesRegex(ValueError, "condition, facts or lineage"):
                self.verify_rows()
            self.proposed[0][key] = original

    def test_forged_extra_qualification_is_rejected(self):
        self.proposed[0]["trainingAllowed"] = True
        with self.assertRaisesRegex(ValueError, "lineage"):
            self.verify_rows()

    def test_replacement_rgb_must_match_immutable_record(self):
        self.proposed[0]["image"]["sha256"] = "c" * 64
        with self.assertRaisesRegex(ValueError, "RGB differs"):
            self.verify_rows()

    def test_duplicate_original_rgb_cannot_count_as_new_capacity(self):
        self.proposed[0]["image"] = deepcopy(self.old[1]["image"])
        record = release.bound_json(self.root, self.candidate["replacementRecord"])
        record["relativeDirectory"] = "images"
        record["originalImage"] = {"path": "1.png", "sha256": self.old[1]["image"]["sha256"]}
        self.candidate["replacementRecord"] = self.put("library/corrected/record.json", record)
        self.proposed[0]["sourceRecord"] = self.candidate["replacementRecord"]
        with self.assertRaisesRegex(ValueError, "duplicate capacity asset"):
            self.verify_rows()

    def test_membership_reordering_rejected_even_when_hashes_updated(self):
        ids = release.bound_json(self.root, self.candidate["splits"]["train"])["sampleIds"]
        self.candidate["splits"]["train"] = self.put("candidate/train.json", {"sampleIds": list(reversed(ids))})
        with self.assertRaisesRegex(ValueError, "split order or membership"):
            self.verify_rows()

    def test_draft_or_unqualified_parent_cannot_be_relabelled(self):
        self.candidate["status"] = "published"
        with self.assertRaisesRegex(ValueError, "unreleased correction candidate"):
            self.verify_rows()
        self.candidate["status"] = "draft_not_released"
        self.parent["qualification"]["dataQualifiedForTraining"] = False
        with self.assertRaisesRegex(ValueError, "qualified parent"):
            self.verify_rows()

    def test_materialization_read_and_repeat_are_byte_idempotent(self):
        self.mock_build_inputs()
        binding = correction.materialize_release(self.root, self.request_binding)
        manifest, rows = release.load_package(self.root, binding)
        self.assertEqual(binding, correction.materialize_release(self.root, self.request_binding))
        self.assertEqual(rows[1:], self.old[1:])
        self.assertEqual(rows[0]["sourceReview"], self.request["sourceReview"])
        self.assertEqual(manifest["foundationQualificationOrigin"], self.parent_binding)
        self.assertEqual(manifest["foundationCheckpoint"], self.parent["foundationCheckpoint"])
        for key in ("executionQualified", "gpuQualified", "trainingAllowed", "foundationRetrainedOnCorrection"):
            self.assertFalse(manifest["qualification"][key])

    def test_published_bytes_cannot_be_overwritten_or_read_after_tamper(self):
        self.mock_build_inputs()
        binding = correction.materialize_release(self.root, self.request_binding)
        manifest = release.bound_json(self.root, binding)
        target = self.root / manifest["splits"]["validation"]["path"]
        target.write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "bytes mismatch"):
            release.load_package(self.root, binding)
        with self.assertRaisesRegex(ValueError, "immutable correction release conflict"):
            correction.materialize_release(self.root, self.request_binding)
        self.assertEqual(target.read_bytes(), b"tampered")

    def test_manifest_boolean_does_not_replace_reproduction(self):
        self.mock_build_inputs()
        binding = correction.materialize_release(self.root, self.request_binding)
        manifest = release.bound_json(self.root, binding)
        manifest["qualification"]["gpuQualified"] = True
        binding = self.put(binding["path"], manifest)
        with self.assertRaisesRegex(ValueError, "does not reproduce"):
            release.load_package(self.root, binding)

    def test_draft_still_cannot_be_loaded_as_training_release(self):
        with self.assertRaisesRegex(ValueError, "schema mismatch"):
            release.load_package(self.root, self.request["candidateManifest"])

    def test_old_or_edited_verifier_cannot_be_executed(self):
        with patch.object(correction, "_programs", return_value=self.programs), \
                patch.object(correction, "_node_runtime", return_value=self.runtime), \
                patch.object(correction.subprocess, "run") as process:
            with self.assertRaisesRegex(ValueError, "program bytes changed"):
                correction.verify_with_node(self.root, self.request_binding, expected_programs=[],
                                            expected_runtime=self.runtime)
            process.assert_not_called()

    def test_reader_cannot_dispatch_a_publish_operation(self):
        self.request["operation"] = "publish"
        binding = self.put("request.json", self.request)
        with patch.object(correction, "_programs", return_value=self.programs), \
                patch.object(correction, "_node_runtime", return_value=self.runtime), \
                patch.object(correction.subprocess, "run") as process:
            with self.assertRaisesRegex(ValueError, "read-only publication request required"):
                correction.verify_with_node(self.root, binding)
            process.assert_not_called()

    def test_retained_component_subprocess_failure_is_not_a_pass(self):
        with patch.object(correction, "_programs", return_value=self.programs), \
                patch.object(correction, "_node_runtime", return_value=self.runtime), \
                patch.object(correction.subprocess, "run", return_value=SimpleNamespace(
                    returncode=1, stdout="", stderr="component failure")):
            with self.assertRaisesRegex(ValueError, "component failure"):
                correction.verify_with_node(self.root, self.request_binding)

    def test_reverification_rejects_input_tamper_even_after_valid_reply(self):
        (self.root / self.request["candidateManifest"]["path"]).write_bytes(b"tampered")
        with patch.object(correction, "_programs", return_value=self.programs), \
                patch.object(correction, "_node_runtime", return_value=self.runtime), \
                patch.object(correction.subprocess, "run", return_value=SimpleNamespace(
                    returncode=0, stdout=json.dumps(self.verification), stderr="")):
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                correction.verify_with_node(self.root, self.request_binding)


if __name__ == "__main__":
    unittest.main()

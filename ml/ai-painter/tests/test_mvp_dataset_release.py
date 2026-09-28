from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ai_painter.complete_world import mvp_dataset_release as release
from ai_painter.complete_world import split_release
from test_stage4_split_release import fixture_rows


class MvpDatasetReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="mvp64-release-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.rows = fixture_rows()
        for index, row in enumerate(self.rows):
            row["capacitySlotId"] = f"v7-capacity-slot-{index + 146}"
            row["sourceSplit"] = row["split"]
            row["useQualification"] = "unverified_not_training_eligible"
        self.rows[43]["capacitySlotId"] = "v7-capacity-slot-189"
        self.rows[43]["split"] = "validation"
        self.rows[48]["capacitySlotId"] = "v7-capacity-slot-194"
        self.rows[48]["split"] = "train"
        split_release.validate_groups(self.rows)
        self.candidate = self.write("candidate.json", {
            "schemaVersion": "ai-painter-stage4-regrouped64-review-candidate-v1",
            "status": "immutable_regrouped_candidate_pending_qualification",
            "qualification": {"trainingAllowed": False},
        })
        pairing_rows = [{"sampleId": row["sampleId"], "split": row["split"],
                         "generationResultBound": True, "conditionContentMatchesPrompt": True,
                         "historicalSemanticAudit": {"passed": True}} for row in self.rows]
        self.pairing = self.write("pairing.json", {
            "schemaVersion": release.PAIRING_SCHEMA,
            "status": "per_sample_pairing_verified_source_qualification_pending",
            "manifest": self.candidate, "counts": split_release.COUNTS,
            "sampleCount": 64, "rows": pairing_rows,
            "qualifications": {"projectControlledCrossSampleFeedbackExcluded": True,
                               "trainingAllowed": False, "gpuAllowed": False},
        })
        semantic_rows = [{"sampleId": row["sampleId"], "split": row["split"],
                          "aiAssistedColdStartRightsVerified": True,
                          "independentTrainingClaimed": False, "ownerReviewVerified": True,
                          "machineSemanticPassed": True, "all23ConditionChannelsReplayed": True}
                         for row in self.rows]
        self.semantic = self.write("semantic.json", {
            "schemaVersion": release.SEMANTIC_SCHEMA,
            "status": "current64_mvp_semantic_and_ai_assisted_rights_verified_not_data_qualification",
            "candidate": self.candidate, "sourcePairing": self.pairing,
            "sampleCount": 64, "splitCounts": split_release.COUNTS, "rows": semantic_rows,
            "conclusions": {"exactRgbAndConditionBytesVerified": True,
                            "all23ConditionChannelsReplayed": True,
                            "existingMachineSemanticAuditsPassed": True,
                            "ownerDelegatedAiAssistedColdStartReviewsVerified": True,
                            "projectControlledCrossSampleFeedbackExcluded": True,
                            "independentTrainingRightsClaimed": False,
                            "aiAssistedColdStartLaneOnly": True},
            "trainingAllowed": False, "dataQualified": False,
        })
        history_rows = [{"sampleId": row["sampleId"], "evaluationRuns": 0,
                         "recordedOptimizerRuns": 0, "recordedOptimizerSteps": 0}
                        for row in self.rows]
        history_rows[48]["recordedOptimizerRuns"] = 1
        self.history = self.write("history.json", {
            "schemaVersion": release.HISTORY_SCHEMA,
            "status": "bounded_historical_use_audited_not_qualified",
            "perSample": history_rows, "limitations": ["bounded_inventory"],
            "trainingAllowed": False,
        })
        self.contract = self.write("contract.json", {
            "schemaVersion": release.SOURCE_ISOLATION_SCHEMA,
            "policyVersion": release.POLICY_VERSION,
            "scope": "single_primitive_natural_world_mvp",
        })
        self.policy = self.write("policy.md", (f"文档版本：`{release.POLICY_VERSION}`\n"
                                                "### 8.2 单世界MVP的公共地理输入与样本泄漏边界\n"
                                                "### 9.1 单世界先行MVP的阶段隔离\n").encode())
        self.bindings = dict(candidate_binding=self.candidate,
                             source_pairing_binding=self.pairing,
                             semantic_rights_binding=self.semantic,
                             historical_exposure_binding=self.history,
                             source_isolation_contract_binding=self.contract,
                             data_policy_binding=self.policy)
        self.loader = patch.object(release, "load_package", side_effect=lambda *_: (
            {"schemaVersion": "ai-painter-stage4-regrouped64-review-candidate-v1",
             "status": "immutable_regrouped_candidate_pending_qualification",
             "qualification": {"trainingAllowed": False},
             "identityPayload": {"channelOrder": [f"channel-{i}" for i in range(23)],
                                 "continuousChannelIds": ["channel-15"]}}, deepcopy(self.rows)))
        self.loader.start()
        self.addCleanup(self.loader.stop)

    def write(self, name, value):
        data = value if isinstance(value, bytes) else split_release.canonical_bytes(value) + b"\n"
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return {"path": name, "sha256": split_release.digest(data)}

    def test_materializes_release_without_granting_training(self):
        binding = release.materialize_release(self.root, **self.bindings)
        manifest = split_release.bound_json(self.root, binding)
        self.assertEqual(binding, release.materialize_release(self.root, **self.bindings))
        self.assertEqual(manifest["splitCounts"], split_release.COUNTS)
        self.assertTrue(manifest["qualification"]["datasetIdentityAndAssetsVerified"])
        self.assertTrue(manifest["qualification"]["foundationTrainingAllowed"])
        self.assertFalse(manifest["qualification"]["dataQualifiedForTraining"])
        self.assertFalse(manifest["qualification"]["trainingAllowed"])
        self.assertEqual(len(list((self.root / Path(binding["path"]).parent).rglob("*.json"))), 7)

    def test_non_train_optimizer_exposure_is_rejected(self):
        history = split_release.bound_json(self.root, self.history)
        history["perSample"][43]["recordedOptimizerRuns"] = 1
        bindings = {**self.bindings, "historical_exposure_binding": self.write("bad-history.json", history)}
        with self.assertRaisesRegex(ValueError, "optimizer exposure remains outside train"):
            release.build_release(self.root, **bindings)

    def test_challenge_observation_is_rejected(self):
        history = split_release.bound_json(self.root, self.history)
        challenge_id = next(row["sampleId"] for row in self.rows if row["split"] == "challenge")
        next(row for row in history["perSample"] if row["sampleId"] == challenge_id)["evaluationRuns"] = 1
        bindings = {**self.bindings, "historical_exposure_binding": self.write("seen-challenge.json", history)}
        with self.assertRaisesRegex(ValueError, "challenge exposure"):
            release.build_release(self.root, **bindings)

    def test_forged_qualification_and_wrong_split_are_rejected(self):
        semantic = split_release.bound_json(self.root, self.semantic)
        semantic["trainingAllowed"] = True
        with self.assertRaisesRegex(ValueError, "conclusion boundary"):
            release.build_release(self.root, **{**self.bindings,
                                  "semantic_rights_binding": self.write("forged-semantic.json", semantic)})
        rows = deepcopy(self.rows)
        next(row for row in rows if row["capacitySlotId"] == "v7-capacity-slot-194")["split"] = "validation"
        with patch.object(release, "load_package", return_value=(
                {"schemaVersion": "ai-painter-stage4-regrouped64-review-candidate-v1",
                 "status": "immutable_regrouped_candidate_pending_qualification",
                 "qualification": {"trainingAllowed": False},
                 "identityPayload": {"channelOrder": [f"channel-{i}" for i in range(23)],
                                     "continuousChannelIds": ["channel-15"]}}, rows)):
            with self.assertRaises(ValueError):
                release.build_release(self.root, **self.bindings)

    def test_tampering_is_not_overwritten(self):
        binding = release.materialize_release(self.root, **self.bindings)
        manifest = split_release.bound_json(self.root, binding)
        target = self.root / manifest["splits"]["train"]["path"]
        target.write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "immutable release conflict"):
            release.materialize_release(self.root, **self.bindings)
        self.assertEqual(target.read_bytes(), b"tampered")


if __name__ == "__main__":
    unittest.main()

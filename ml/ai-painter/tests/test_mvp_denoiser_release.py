import io
from pathlib import Path
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world import mvp_denoiser_release as release
from ai_painter.complete_world.split_training import state_hash


class MvpDenoiserReleaseTests(unittest.TestCase):
    def setUp(self):
        self.root = Path("C:/project")
        self.parent_binding = {"path": "data/parent/manifest.json", "sha256": "a" * 64}
        self.foundation_binding = {"path": ".runtime/foundation.json", "sha256": "b" * 64}
        self.checkpoint_binding = {"path": ".runtime/foundation.pt", "sha256": "c" * 64}
        self.rows = [{"sampleId": f"sample-{i}", "split": (
            "train" if i < 48 else "validation" if i < 56 else "challenge" if i < 60 else "regression")}
                     for i in range(64)]
        self.parent = {
            "schemaVersion": release.PARENT_SCHEMA, "immutable": True,
            "requirements": ["AP-TRAIN-001"], "splitCounts": release.COUNTS,
            "sourceIndex": {"path": "data/parent/source.json", "sha256": "d" * 64},
            "splits": {key: {"path": f"data/parent/{key}.json", "sha256": str(i) * 64}
                       for i, key in enumerate(release.COUNTS, 1)},
            "qualificationEvidence": {"path": "data/parent/evidence.json", "sha256": "e" * 64},
            "identityPayload": {"channelOrder": ["terrain_grass"], "continuousChannelIds": [],
                                "selectionReproductionSha256": "f" * 64},
            "qualification": {
                "datasetIdentityAndAssetsVerified": True, "splitMembershipVerified": True,
                "projectControlledSourceIsolationVerified": True,
                "aiAssistedColdStartRightsVerified": True,
                "recordedHistoricalOptimizerExposureResolvedBySplit": True,
                "fullHistoryCreativeNovelty": "deferred_out_of_current_mvp_scope",
                "foundationTrainingAllowed": True, "denoiserTrainingAllowed": False,
            },
        }
        self.state = {"weight": torch.ones(2, 2)}
        self.state_sha = state_hash(self.state)
        self.foundation = {
            "schemaVersion": release.FOUNDATION_SCHEMA,
            "status": "foundation_qualified_for_fresh_stage0_denoiser_preflight",
            "foundationQualified": True, "datasetManifest": self.parent_binding,
            "initialization": "random_initialization_only", "upstreamCheckpoints": [],
            "thirdPartyWeightsLoaded": False, "trainOptimizerSteps": 960,
            "nonTrainOptimizerSteps": 0, "challengeRead": False, "regressionRead": False,
            "checkpointReloadVerified": True, "checkpoint": self.checkpoint_binding,
            "runId": "fresh-foundation", "foundationStateSha256": self.state_sha,
        }
        checkpoint = {
            "schemaVersion": "ai-painter-stage4-mvp-fresh-foundation-checkpoint-v1",
            "runId": "fresh-foundation", "datasetManifest": self.parent_binding,
            "denoiserTrained": False, "denoiserState": None,
            "optimizerSteps": 960, "nonTrainOptimizerSteps": 0,
            "autoencoderState": self.state, "autoencoderStateSha256": self.state_sha,
        }
        stream = io.BytesIO()
        torch.save(checkpoint, stream)
        self.checkpoint_bytes = stream.getvalue()

    def build(self):
        with patch.object(release, "load_package", return_value=(self.parent, self.rows)), \
                patch.object(release, "bound_json", return_value=self.foundation), \
                patch.object(release, "read_bound", return_value=self.checkpoint_bytes):
            return release.build_release(
                self.root, parent_binding=self.parent_binding,
                foundation_qualification_binding=self.foundation_binding)

    def test_binds_foundation_without_overclaiming_execution(self):
        manifest, rows = self.build()
        self.assertEqual(rows, self.rows)
        self.assertTrue(manifest["qualification"]["dataQualifiedForTraining"])
        self.assertTrue(manifest["qualification"]["foundationQualified"])
        self.assertTrue(manifest["qualification"]["denoiserTrainingAllowed"])
        self.assertFalse(manifest["qualification"]["trainingAllowed"])
        self.assertFalse(manifest["qualification"]["gpuQualified"])
        self.assertEqual(manifest["foundationCheckpoint"], self.checkpoint_binding)

    def test_rejects_non_train_optimizer_exposure(self):
        self.foundation["nonTrainOptimizerSteps"] = 1
        with self.assertRaisesRegex(ValueError, "training boundary incomplete"):
            self.build()

    def test_rejects_checkpoint_tensor_identity_mismatch(self):
        self.foundation["foundationStateSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "tensor identity invalid"):
            self.build()


if __name__ == "__main__":
    unittest.main()

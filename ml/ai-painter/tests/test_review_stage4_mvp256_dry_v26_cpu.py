from copy import deepcopy
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import review_stage4_mvp256_dry_v26_cpu as subject


class ReviewBoundaryTests(unittest.TestCase):
    def fixture(self):
        package = {"runId": "run", "packageId": "package", "candidateContract": {"path": "policy"}}
        records = [{"epoch": epoch, "checkpoint": {"path": str(epoch)},
                    "selection": {"epoch": epoch, "worstApplicableObjectCorrelation": 0.1,
                        "meanValidationRgbMae": 0.2, "rank": [0.1, -0.2, -epoch],
                        "qualificationGranted": False, "checkpointPromotionEligible": False,
                        "applicableImageCounts": {role: 8 for role in subject.ROLES}}}
                   for epoch in (24, 36, 48)]
        worker = {**package, "status": "training_completed_review_pending", "completedEpochs": 48,
                  "optimizerStepsGenerator": 2304, "optimizerStepsDiscriminator": 2304,
                  "checkpointReloadVerified": True, "checkpointPromotable": False,
                  "executionPackage": {"path": "package"}, "checkpoints": records,
                  "selectedCheckpointRecord": records[0], "selectedEpoch": 24,
                  "selectedCheckpoint": records[0]["checkpoint"], "selectedRank": [0.1, -0.2, -24],
                  "challengeContentRead": False, "regressionContentRead": False}
        terminal = {**worker}
        return terminal, worker, package

    def test_completed_frozen_rank_winner(self):
        terminal, worker, package = self.fixture()
        self.assertEqual(subject.validate_completed(terminal, worker, package)["epoch"], 24)

    def test_incomplete_wrong_rank_and_exposure_fail_closed(self):
        for field, value in (("completedEpochs", 47), ("optimizerStepsGenerator", 2303),
                             ("checkpointPromotable", True), ("challengeContentRead", True),
                             ("selectedEpoch", 36), ("runId", "other")):
            terminal, worker, package = deepcopy(self.fixture())
            worker[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                subject.validate_completed(terminal, worker, package)

    def test_all_eligible_checkpoints_required(self):
        terminal, worker, package = self.fixture()
        worker["checkpoints"] = worker["checkpoints"][:2]
        with self.assertRaises(ValueError):
            subject.validate_completed(terminal, worker, package)


if __name__ == "__main__":
    unittest.main()

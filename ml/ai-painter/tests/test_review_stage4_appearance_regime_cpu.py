"""Synthetic selected-checkpoint and review-boundary checks."""
import copy
import unittest
import torch
import review_stage4_appearance_regime_cpu as review
from test_painter_stage4_appearance_regime_checkpoint_worker import selection

def fixture():
    package = {"runId":"fixture-run","packageId":"fixture-package",
        "candidateContract":{"path":"fixture/policy.json","sha256":"a"*64}}
    records = []
    for epoch in (24,36,48):
        rank = selection()
        rank["epoch"] = epoch
        rank["rank"][2] = -epoch
        records.append({"epoch":epoch,"selection":rank,
            "checkpoint":{"path":f"fixture/epoch-{epoch}.pt","sha256":str(epoch//12)*64}})
    worker = {**package, "status":"training_completed_review_pending",
        "completedEpochs":48,"optimizerStepsGenerator":2304,"optimizerStepsDiscriminator":2304,
        "checkpointReloadVerified":True,"checkpointPromotable":False,
        "checkpoints":records, "selectedCheckpointRecord":records[0], "selectedEpoch":24,
        "selectedCheckpoint":records[0]["checkpoint"],"selectedRank":records[0]["selection"]["rank"],
        "executionPackage":{"path":"fixture/package.json","sha256":"b"*64},
        "challengeContentRead":False,"regressionContentRead":False}
    terminal = {**package, "status":worker["status"], "executionPackage":worker["executionPackage"],
        "selectedCheckpoint":worker["selectedCheckpoint"]}
    return terminal, worker, package

class ReviewTests(unittest.TestCase):
    def test_frozen_rank_earliest_tie_without_updates(self):
        terminal, worker, package = fixture()
        self.assertEqual(review.validate_completed(terminal,worker,package)["epoch"],24)
        self.assertFalse(torch.cuda.is_initialized())

    def test_incomplete_foreign_publishable_or_wrong_winner_rejected(self):
        for change in (
            lambda t,w,p:w.update(completedEpochs=47),
            lambda t,w,p:w.update(optimizerStepsGenerator=2303),
            lambda t,w,p:w.update(checkpointPromotable=True),
            lambda t,w,p:w.update(packageId="foreign"),
            lambda t,w,p:w.update(selectedCheckpointRecord=w["checkpoints"][1]),
            lambda t,w,p:w.update(challengeContentRead=True),
            lambda t,w,p:w["checkpoints"].pop(),
        ):
            values = copy.deepcopy(fixture())
            change(*values)
            with self.assertRaises(ValueError):
                review.validate_completed(*values)

    def test_candidate_review_source_explicit_season_and_fixed_v24(self):
        from pathlib import Path
        source = Path(review.__file__).read_text(encoding="utf8")
        self.assertIn('v28.sample_forward(model, sample, return_evidence=True)', source)
        self.assertIn('base.v24.fresh_networks, base.V24_IDENTITY', source)
        self.assertNotIn("unittest.mock", source)
        self.assertEqual(review.SCHEMA, "ai-painter-mvp256-dry-v28-cpu-review-v1")

if __name__ == "__main__":
    unittest.main()


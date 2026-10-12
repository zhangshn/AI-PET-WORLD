"""Original rank winner and nonpromotable terminal requirements."""
from copy import deepcopy
import unittest
import review_stage4_detail_weight_cpu as review
import painter_stage4_detail_weight_managed_worker as worker
from test_detail_weight_managed_checkpoint import selection


def terminal():
    records=[{"epoch":e,"selection":selection(e),"counts":{"generator":e*48,"discriminator":e*48},"checkpoint":{"path":f".runtime/synthetic/{e}.pt","sha256":"a"*64}} for e in (24,36,48)]
    return {"schema":worker.TERMINAL_SCHEMA,"status":"training_completed_review_pending","capabilityVersion":worker.CAPABILITY,"completedEpochs":48,
        "optimizerSteps":{"generator":2304,"discriminator":2304},"checkpointReloadVerified":True,"checkpointPromotable":False,"challengeContentRead":False,"regressionContentRead":False,
        "checkpoints":records,"selectedCheckpointRecord":records[0]}


class ReviewTests(unittest.TestCase):
    def test_earliest_epoch_wins_tie_and_wrong_winner_rejected(self):
        t=terminal();self.assertEqual(review.selected_record(t)["epoch"],24)
        t["selectedCheckpointRecord"]=t["checkpoints"][2]
        with self.assertRaises(ValueError):review.selected_record(t)
    def test_incomplete_promotable_and_malformed_counts_fail(self):
        for key,value in (("completedEpochs",47),("challengeContentRead",True),("checkpointPromotable",True)):
            t=terminal();t[key]=value
            with self.assertRaises(ValueError):review.selected_record(t)
        t=terminal();t["checkpoints"][1]["counts"]["generator"]=1728.0
        with self.assertRaises(ValueError):review.selected_record(t)

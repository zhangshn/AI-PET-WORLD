"""Metric replay must retain failures, exact matrices, and nonqualification."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0,str(ROOT / "ml/ai-painter/src"))
import verify_timestep_experiment_replay as replay


class ReplayTests(unittest.TestCase):
    def fixture(self):
        t=replay.trial
        rows=[{"arm":arm,"sampleId":sample,"seed":seed,"split":"train","targetUsedForInitialization":False,
            "baseline":{"final":dict.fromkeys(("rgbMae","laplacianMae","phase4ResidualRmsAfterGlobalBiasRemoval"),2.)},
            "measurements":{"final":dict.fromkeys(("rgbMae","laplacianMae","phase4ResidualRmsAfterGlobalBiasRemoval"),1. if i else 1.5)}}
            for i,arm in enumerate(t.ARMS) for j,sample in enumerate(t.previous.SAMPLES) for seed in t.comparison.SETTINGS["seedsBySample"][j]]
        return {"schemaVersion":"ai-painter-timestep-ab-result-v1","status":"experiment_executed_not_visual_qualified",
            "executionState":"completed","optimizerSteps":2000,"checkpointReloadExact":True,"rows":rows,"summary":t.summarize(rows),
            "qualification":dict.fromkeys(("formalDatasetQualified","formalGpuQualified","formalTrainingAllowed","checkpointPromotable",
                "formalInferenceEligible","worldEntryAllowed"),False)}

    def test_exact_metrics_are_accepted_without_qualification(self):
        s=self.fixture();self.assertEqual(replay.verify_replay(s,deepcopy(s["rows"])),s["summary"])
        self.assertFalse(s["summary"]["formalVisualQualification"])

    def test_changed_metric_or_row_is_rejected(self):
        s=self.fixture();rows=deepcopy(s["rows"]);rows[0]["measurements"]["final"]["rgbMae"]+=1e-9
        with self.assertRaisesRegex(ValueError,"differs"):replay.verify_replay(s,rows)
        with self.assertRaises(ValueError):replay.verify_replay(s,s["rows"][:-1])

    def test_failed_or_incomplete_training_is_not_replayed_as_success(self):
        for key,value in (("executionState","failed_closed"),("optimizerSteps",1999),("checkpointReloadExact",False),
                          ("schemaVersion","other"),("status","failed")):
            s=self.fixture();s[key]=value
            with self.assertRaises(ValueError):replay.verify_replay(s,s["rows"])

    def test_forged_summary_or_qualification_is_rejected(self):
        s=self.fixture();s["summary"]["checkpointSelected"]=True
        with self.assertRaises(ValueError):replay.verify_replay(s,s["rows"])
        for value in ({},{"formalTrainingAllowed":False},{"formalTrainingAllowed":True}):
            s=self.fixture();s["qualification"]=value
            with self.assertRaises(ValueError):replay.verify_replay(s,s["rows"])

    def test_target_fed_or_holdout_rows_are_rejected(self):
        for key,value in (("split","challenge"),("targetUsedForInitialization",True)):
            s=self.fixture();s["rows"][0][key]=value
            with self.assertRaises(ValueError):replay.verify_replay(s,s["rows"])

    def test_negative_outcome_is_preserved(self):
        s=self.fixture();s["rows"][6]["measurements"]["final"]["rgbMae"]=3.
        s["summary"]=replay.trial.summarize(s["rows"])
        actual=replay.verify_replay(s,s["rows"])
        self.assertEqual(actual["pairedCandidateVersusControl"]["rgbMae"]["worseCount"],1)


if __name__=="__main__":unittest.main()

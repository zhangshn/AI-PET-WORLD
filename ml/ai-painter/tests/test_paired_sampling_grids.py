"""Fixed matrix, endpoint, unchanged noise and metric-regression tests."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
import torch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"));sys.path.insert(0,str(ROOT/"ml/ai-painter/src"))
import compare_paired_sampling_grids as comparison


class SamplingTests(unittest.TestCase):
    def fixture(self):
        return [{"arm":arm,"sampleId":sample,"seed":seed,"steps":steps,"split":"train",
            "fullEndpoint":True,"targetUsedForInitialization":False,
            "measurements":{"final":dict.fromkeys(comparison.METRICS,1. if steps==50 else 0.8),
                "semanticRegions":{name:{"rgbMae":1. if steps==50 else 0.9} for name in comparison.trial.previous.HEADS}}}
            for arm,sample,seed,steps in comparison.expected_matrix()]

    def test_complete_36_matrix_reports_every_model_and_grid(self):
        s=comparison.summarize(self.fixture())
        self.assertEqual(len(s["comparedWithOwn50Steps"]),2)
        for grids in s["comparedWithOwn50Steps"].values():
            self.assertEqual(set(grids),{"25","10"})
            for metrics in grids.values():
                self.assertTrue(all(v["improvedCount"]==6 for v in metrics.values()))
        self.assertFalse(s["samplerSelected"]);self.assertFalse(s["formalVisualQualification"])

    def test_one_regression_is_preserved_not_averaged_away(self):
        rows=self.fixture();rows[2]["measurements"]["final"]["rgbMae"]=2
        s=comparison.summarize(rows)
        self.assertEqual(s["comparedWithOwn50Steps"][comparison.trial.ARMS[0]]["10"]["rgbMae"]["worseCount"],1)

    def test_object_regression_is_preserved(self):
        rows=self.fixture();name=comparison.trial.previous.HEADS[0]
        rows[1]["measurements"]["semanticRegions"][name]["rgbMae"]=3
        s=comparison.summarize(rows)
        self.assertEqual(s["comparedWithOwn50Steps"][comparison.trial.ARMS[0]]["25"][name]["worseCount"],1)

    def test_missing_reordered_or_duplicate_rows_rejected(self):
        rows=self.fixture()
        for altered in (rows[:-1],list(reversed(rows)),[rows[1],*rows[1:]]):
            with self.assertRaises(ValueError):comparison.summarize(altered)

    def test_invalid_or_holdout_metric_rejected(self):
        for v in (float("nan"),float("inf"),-1,True,None):
            rows=self.fixture();rows[0]["measurements"]["final"]["rgbMae"]=v
            with self.assertRaises(ValueError):comparison.summarize(rows)
        for k,v in (("split","validation"),("fullEndpoint",False),("targetUsedForInitialization",True)):
            rows=self.fixture();rows[0][k]=v
            with self.assertRaises(ValueError):comparison.summarize(rows)

    def test_zero_baseline_is_not_divided(self):
        rows=self.fixture();rows[0]["measurements"]["final"]["rgbMae"]=0
        s=comparison.summarize(rows)
        self.assertIsNone(s["comparedWithOwn50Steps"][comparison.trial.ARMS[0]]["10"]["rgbMae"]["relativeReductionPercentRange"])

    def test_all_grids_share_noise_and_reach_clean_endpoint(self):
        torch.set_num_threads(1)
        conditions=torch.zeros(1,23,192,256)
        alpha=torch.cumprod(1-torch.linspace(0.0001,0.02,1000),dim=0)
        noises=[]
        for steps in comparison.STEPS:
            noise,latent,_,grid=comparison.sampling.rollout(torch,lambda x,t,c:torch.zeros_like(x),conditions,alpha,1,steps,lambda:None)
            noises.append(noise)
            self.assertEqual(len(grid),steps);self.assertEqual(grid[0][0],999);self.assertEqual(grid[-1],(0,-1))
            self.assertTrue(bool(torch.isfinite(latent).all()))
        self.assertTrue(all(torch.equal(noises[0],x) for x in noises[1:]))

    def test_undeclared_grid_rejected_before_prediction(self):
        for steps in (1,49,100,True):
            with self.assertRaises(ValueError):comparison.sampling.rollout(torch,None,None,None,1,steps,None)

    def test_summary_does_not_mutate_inputs(self):
        rows=self.fixture();before=deepcopy(rows);comparison.summarize(rows);self.assertEqual(rows,before)


if __name__=="__main__":unittest.main()

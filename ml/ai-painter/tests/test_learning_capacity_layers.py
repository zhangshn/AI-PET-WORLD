"""Tests for diagnostic attribution, including overlap and empty-region cases."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"))
sys.path.insert(0,str(ROOT/"ml/ai-painter/src"))
import diagnose_learning_capacity_layers as layers


class LayerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def test_geometry_uses_four_connectivity_and_xy_bounds(self):
        import numpy as np
        mask=np.zeros((6,8));mask[1:3,2:5]=1;mask[3,5]=1
        value=layers.mask_geometry(mask)
        self.assertEqual(value["pixels"],7)
        self.assertEqual(value["connectedComponents4"],[{"pixels":6,"bboxXYXYInclusive":[2,1,4,2]},
            {"pixels":1,"bboxXYXYInclusive":[5,3,5,3]}])
        self.assertEqual(layers.mask_geometry(np.zeros((2,3)))["pixels"],0)

    def test_invalid_mask_values_are_rejected(self):
        import numpy as np
        for mask in (np.zeros((2,3,4)),np.array([[.5]]),np.array([[float("nan")]])):
            with self.assertRaises(ValueError): layers.mask_geometry(mask)

    def test_empty_region_is_null_not_zero_error(self):
        import torch
        image=torch.zeros(1,3,16,16);mask=torch.zeros(1,1,16,16)
        result=layers.region_metrics(torch,image,image,mask)
        self.assertIsNone(result["rgbMae"]);self.assertIsNone(result["meanRgbBias"])

    def fixture(self):
        import torch
        base=torch.zeros(1,3,32,32);road=torch.zeros(1,1,32,32);road[...,8:24,8:24]=1
        masks=(road,torch.zeros_like(road),torch.zeros_like(road))
        proposals=(torch.ones_like(base),torch.zeros_like(base),torch.zeros_like(base))
        evidence={"baseDecodedRgb":base,"responsibilityMasks":masks,"responsibilityRgbProposals":proposals,
            "responsibilityIdentityOrder":("terrain_path_ground","object_footprints","object_tree")}
        return torch,road.expand_as(base).clone(),evidence,torch.zeros_like(base)

    def test_compositor_attribution_and_support_are_exact(self):
        torch,final,evidence,target=self.fixture()
        value=layers.error_attribution(torch,final,evidence,target)
        self.assertEqual(value["coverageFraction"],.25)
        self.assertEqual(value["uncoveredShareOfTotalAbsoluteRgbError"],0)
        self.assertEqual(value["uncoveredSupportShareOfTotalLaplacianError"],0)
        self.assertEqual(value["regions"]["road"]["final"]["rgbMae"],1)
        self.assertEqual(len(value["topRoadErrorTiles"]),4)
        self.assertEqual(value["topRoadErrorTiles"][0]["bboxXYXYExclusive"],[0,0,16,16])

    def test_overlap_averages_proposals_not_sum_of_branch_errors(self):
        torch,final,evidence,target=self.fixture()
        mask=evidence["responsibilityMasks"][0]
        evidence["responsibilityMasks"]=(torch.zeros_like(mask),mask,mask)
        evidence["responsibilityRgbProposals"]=(target.clone(),target+.25,target+.75)
        final=mask.expand_as(target)*.5
        value=layers.error_attribution(torch,final,evidence,target)
        self.assertEqual(value["regions"]["objects"]["final"]["rgbMae"],.5)
        self.assertIsNone(value["regions"]["road"]["final"]["rgbMae"])

    def test_uncovered_mutation_is_rejected(self):
        torch,final,evidence,target=self.fixture();final[...,0,0]=1
        with self.assertRaisesRegex(ValueError,"equation mismatch"):
            layers.error_attribution(torch,final,evidence,target)

    def test_zero_error_has_no_fabricated_error_share(self):
        torch,final,evidence,target=self.fixture()
        value=layers.error_attribution(torch,final,evidence,final.clone())
        self.assertIsNone(value["uncoveredShareOfTotalAbsoluteRgbError"])
        self.assertIsNone(value["uncoveredSupportShareOfTotalLaplacianError"])

    def test_region_shapes_and_nonfinite_are_rejected(self):
        import torch
        value=torch.zeros(1,3,16,16);mask=torch.ones(1,1,16,16)
        for x,m in ((value+float("nan"),mask),(value,mask*2),(value,mask[...,1:])):
            with self.assertRaises(ValueError): layers.region_metrics(torch,x,value,m)

    def test_plan_reproduces_without_executing_or_mutating_parent(self):
        a=layers.materialize(ROOT);b=layers.materialize(ROOT)
        self.assertEqual(a,b);self.assertEqual(a["settings"]["newRollouts"],0)
        self.assertFalse(a["settings"]["formalQualificationAllowed"])
        with patch.object(layers,"SOURCE",dict(layers.SOURCE,sha256="0"*64)):
            with self.assertRaises(ValueError): layers.materialize(ROOT)


if __name__=="__main__": unittest.main()

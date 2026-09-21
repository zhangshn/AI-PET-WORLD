"""Counterfactual, overlap, boundary and immutable-input regression tests."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
import torch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"));sys.path.insert(0,str(ROOT/"ml/ai-painter/src"))
import diagnose_paired_rgb_composition as diagnosis


class AttributionTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(1)

    def fixture(self):
        base=torch.full((1,3,8,8),0.2)
        masks=[]
        for i in range(5):
            mask=torch.zeros(1,1,8,8);mask[...,1:7,1+i:3+i]=1;masks.append(mask)
        proposals=[torch.full_like(base,0.3+0.03*i) for i in range(5)]
        total=torch.stack(masks).sum(0);coverage=total.clamp(0,1)
        final=base*(1-coverage)+torch.stack([p*m for p,m in zip(proposals,masks)]).sum(0)/total.clamp_min(torch.finfo(base.dtype).eps)*coverage
        evidence={"baseDecodedRgb":base,"responsibilityMasks":masks,"responsibilityRgbProposals":proposals,"responsibilityIdentityOrder":list(diagnosis.HEADS)}
        return final,evidence,base.clone()

    def test_complete_accounting_and_non_deployment(self):
        final,ev,target=self.fixture();a=diagnosis.attribute(torch,final,ev,target)
        self.assertTrue(a["compositorEquationExact"]);self.assertEqual(a["outsideChangeMax"],0)
        self.assertLess(a["mseAccountingError"],1e-8);self.assertLess(a["partitionError"],1e-8)
        self.assertFalse(a["counterfactualApplied"]);self.assertFalse(a["semanticQualification"])
        self.assertEqual(list(a["heads"]),list(diagnosis.HEADS))
        self.assertAlmostEqual(sum(v["symmetricMseChangeContribution"] for v in a["heads"].values()),a["mseChange"])

    def test_counterfactual_keeps_overlap_denominator(self):
        final,ev,target=self.fixture();a=diagnosis.attribute(torch,final,ev,target)
        heads=list(a["heads"].values());self.assertTrue(all(h["overlapPixelWeight"]>0 for h in heads))
        i=2;proposals=list(ev["responsibilityRgbProposals"]);proposals[i]=ev["baseDecodedRgb"]
        total=torch.stack(ev["responsibilityMasks"]).sum(0);coverage=total.clamp(0,1)
        expected=ev["baseDecodedRgb"]*(1-coverage)+torch.stack([p*m for p,m in zip(proposals,ev["responsibilityMasks"])]).sum(0)/total.clamp_min(torch.finfo(final.dtype).eps)*coverage
        self.assertEqual(heads[i]["replaceWithBase"],diagnosis.compact_metrics(torch,expected,target))

    def test_boundary_interior_and_outside_partition(self):
        final,ev,target=self.fixture();regions=diagnosis.attribute(torch,final,ev,target)["regions"]
        self.assertEqual(sum(regions[k]["base"]["pixelWeight"] for k in ("uncovered","coveredInterior","coveredBoundary")),64)
        self.assertGreater(regions["coveredInterior"]["base"]["pixelWeight"],0)
        self.assertGreater(regions["coveredBoundary"]["base"]["pixelWeight"],0)
        self.assertEqual(regions["uncovered"]["base"],regions["uncovered"]["final"])

    def test_signed_improvement_is_not_forced_positive(self):
        final,ev,target=self.fixture();target=final.clone();a=diagnosis.attribute(torch,final,ev,target)
        self.assertLess(a["mseChange"],0)
        self.assertTrue(all(h["symmetricMseChangeContribution"]<0 for h in a["heads"].values()))

    def test_unchanged_inputs(self):
        final,ev,target=self.fixture()
        from ai_painter.complete_world.split_training import state_hash
        before=state_hash((final,ev,target));diagnosis.attribute(torch,final,ev,target)
        self.assertEqual(state_hash((final,ev,target)),before)

    def test_tampered_compositor_or_outside_change_rejected(self):
        final,ev,target=self.fixture();final[...,0,0]=0.9
        with self.assertRaises(ValueError):diagnosis.attribute(torch,final,ev,target)

    def test_invalid_mask_rejected(self):
        for value in (float("nan"),-0.1,1.1):
            final,ev,target=self.fixture();ev["responsibilityMasks"][0][...,0,0]=value
            with self.assertRaises(ValueError):diagnosis.attribute(torch,final,ev,target)

    def test_duplicate_or_unexpected_responsibility_rejected(self):
        for value in (diagnosis.HEADS[0],"unexpected"):
            final,ev,target=self.fixture();ev["responsibilityIdentityOrder"][-1]=value
            with self.assertRaises(ValueError):diagnosis.attribute(torch,final,ev,target)

    def test_nonfinite_rgb_and_shape_rejected(self):
        final,ev,target=self.fixture();target[...,0,0]=float("inf")
        with self.assertRaises(ValueError):diagnosis.attribute(torch,final,ev,target)
        final,ev,target=self.fixture()
        with self.assertRaises(ValueError):diagnosis.attribute(torch,final,ev,target[...,1:,:])

    def test_fractional_mask_still_uses_production_equation(self):
        final,ev,target=self.fixture();ev["responsibilityMasks"]=[m*0.25 for m in ev["responsibilityMasks"]]
        total=torch.stack(ev["responsibilityMasks"]).sum(0);coverage=total.clamp(0,1)
        final=ev["baseDecodedRgb"]*(1-coverage)+torch.stack([p*m for p,m in zip(ev["responsibilityRgbProposals"],ev["responsibilityMasks"])]).sum(0)/total.clamp_min(torch.finfo(final.dtype).eps)*coverage
        self.assertLess(diagnosis.attribute(torch,final,ev,target)["mseAccountingError"],1e-8)


if __name__=="__main__":unittest.main()

import sys
from pathlib import Path
import unittest
import torch
ROOT=Path(__file__).absolute().parents[3]
sys.path.insert(0,str(ROOT/'ml/ai-painter/scripts'))
from ai_painter.complete_world.isolated_rock_background_proxy_v1 import auxiliary_loss, targets
import painter_stage4_decode1_entry_weight_training_profile_v1 as parent
import painter_stage4_rock_background_training_profile_v1 as profile

class BackgroundTests(unittest.TestCase):
 def test_explicit_component_and_same_forward_required(self):
  self.assertIs(parent._component_profile(profile),profile)
  self.assertIs(parent._component_profile(None),parent)
  with self.assertRaises(ValueError):parent._component_profile(object())
  with self.assertRaises(ValueError):profile._generator_candidate(None,None,{'sampleId':'bad'},[],torch.zeros(1))
 def test_auxiliary_gradient_only_on_declared_region(self):
  terrain=torch.full((1,3,192,256),.6,requires_grad=True);target=torch.full_like(terrain,.4);mask=torch.zeros((1,1,192,256),dtype=torch.bool);mask[:,:,20:24,30:35]=True
  loss=auxiliary_loss(terrain,target,mask);g=torch.autograd.grad(loss,terrain)[0]
  self.assertAlmostEqual(float(loss.detach()),.2,places=6);self.assertTrue(torch.equal(g[~mask.expand_as(g)],torch.zeros_like(g[~mask.expand_as(g)])))
  torch.testing.assert_close(g[mask.expand_as(g)],torch.full((60,),1/60))
  zero=auxiliary_loss(terrain,target,torch.zeros_like(mask));self.assertTrue(zero.requires_grad);self.assertEqual(float(zero.detach()),0);self.assertEqual(int(torch.autograd.grad(zero,terrain)[0].count_nonzero()),0)
 def test_train_only_and_detached_targets(self):
  sample={'split':'validation'}
  with self.assertRaises(ValueError):targets(sample,[],{})
  terrain=torch.ones((1,3,192,256),requires_grad=True)
  with self.assertRaises(ValueError):auxiliary_loss(terrain,terrain,torch.ones((1,1,192,256),dtype=torch.bool))
  sample={'split':'train','sampleId':'nonselected-train','image':torch.zeros(3,192,256)}
  target,mask,records=targets(sample,[],{});self.assertFalse(bool(mask.any()));self.assertFalse(target.requires_grad);self.assertEqual(records,[])

if __name__=='__main__':unittest.main()

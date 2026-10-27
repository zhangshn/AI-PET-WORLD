import unittest
import torch
from torch.nn import functional as F
from ai_painter.complete_world.stem_weight_reduction_precision_v1 import stem_weight_reduction_precision,StemWeightReductionConv
torch.set_num_threads(2)
class StemPrecisionTests(unittest.TestCase):
 def test_native_forward_input_bias_and_independent_double_weight_reference(self):
  torch.manual_seed(72)
  for input_trainable in (False,True):
   x=torch.randn(1,31,7,9).requires_grad_(input_trainable);w=torch.randn(48,31,3,3,requires_grad=True);b=torch.randn(48,requires_grad=True);dy=torch.randn(1,48,7,9)
   reference=F.conv2d(x,w,b,padding=1);candidate=stem_weight_reduction_precision(x,w,b)
   self.assertTrue(torch.equal(reference,candidate))
   variables=(x,w,b) if input_trainable else (w,b)
   native=torch.autograd.grad(reference,variables,dy);actual=torch.autograd.grad(candidate,variables,dy)
   self.assertTrue(torch.equal(actual[-1],native[-1]))
   if input_trainable:self.assertTrue(torch.equal(actual[0],native[0]))
   wd=w.detach().double().requires_grad_();double=F.conv2d(x.detach().double(),wd,b.detach().double(),padding=1)
   expected=torch.autograd.grad(double,wd,dy.double())[0].float()
   torch.testing.assert_close(actual[-2],expected,rtol=1e-6,atol=1e-6)
 def test_parameter_identity_is_preserved_and_wrong_geometry_rejected(self):
  conv=torch.nn.Conv2d(31,48,3,padding=1);wrapped=StemWeightReductionConv(conv)
  self.assertIs(wrapped.weight,conv.weight);self.assertIs(wrapped.bias,conv.bias)
  with self.assertRaises(ValueError):StemWeightReductionConv(torch.nn.Conv2d(48,48,3,padding=1))
  with self.assertRaises(ValueError):stem_weight_reduction_precision(torch.zeros(1,48,7,9),conv.weight,conv.bias)
if __name__=='__main__':unittest.main()

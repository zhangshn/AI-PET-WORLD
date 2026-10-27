"""Inactive draft tests; not imported by the running training source closure."""
import unittest
import sys
from pathlib import Path
sys.path[:0]=[str(Path(__file__).absolute().parents[3]/'ml/ai-painter/src')]
import torch
from ai_painter.complete_world.terrain_ecology_projection_v1 import TerrainEcologyProjection

torch.set_num_threads(2)

class TerrainEcologyProjectionTests(unittest.TestCase):
    def test_forward_and_weight_derivative_against_independent_native_reference(self):
        module=TerrainEcologyProjection();generator=torch.Generator().manual_seed(20261027)
        with torch.no_grad():module.weight.copy_(torch.randn((48,7),generator=generator)*.01)
        for index in (0,6):
            code=torch.zeros(7);code[index]=1
            actual=module(code)
            expected=(module.weight.detach() @ code).reshape(1,48,1,1).expand(1,48,192,256)
            self.assertTrue(torch.equal(actual,expected))
            upstream=torch.randn((1,48,192,256),generator=generator)*.001
            weight64=module.weight.detach().double().requires_grad_(True)
            oracle=(weight64 @ code.double()).reshape(1,48,1,1).expand(1,48,192,256)
            reference=torch.autograd.grad((oracle*upstream.double()).sum(),weight64)[0].float()
            gradient=torch.autograd.grad(actual,module.weight,grad_outputs=upstream)[0]
            self.assertTrue(torch.equal(gradient,reference))
            self.assertTrue(torch.equal(gradient[:,[i for i in range(7) if i!=index]],torch.zeros((48,6))))

    def test_zero_initialization_and_invalid_code(self):
        module=TerrainEcologyProjection();code=torch.zeros(7);code[2]=1
        self.assertEqual(int(module(code).count_nonzero()),0)
        for bad in (torch.zeros(7),torch.ones(7),code.double(),code.clone().requires_grad_(True)):
            with self.assertRaises(ValueError):module(bad)

if __name__=='__main__':unittest.main()

import unittest
import torch
from ai_painter.complete_world.object_support_terrain_gradient_probe_cpu_v1 import support_routed_prediction, ROLES


class RoutingTests(unittest.TestCase):
    def fixture(self):
        torch.set_num_threads(2)
        terrain=torch.full((1,3,192,256),.4,requires_grad=True)
        residual=torch.full_like(terrain,.1,requires_grad=True)
        masks={role:torch.zeros((1,1,192,256),dtype=torch.bool) for role in ROLES}
        masks['object_tree'][...,40:50,60:70]=True
        prediction=torch.sigmoid(torch.logit(terrain.clamp(1e-5,1-1e-5))+residual)
        return prediction,{'terrainRgb':terrain,'objectResidualSum':residual,'visibleObjectSupportMasks':masks}

    def test_forward_and_object_derivative_preserved_terrain_masked(self):
        p,e=self.fixture();q,mask=support_routed_prediction(p,e)
        self.assertTrue(torch.equal(p,q))
        a=torch.autograd.grad(p.sum(),(e['terrainRgb'],e['objectResidualSum']),retain_graph=True)
        b=torch.autograd.grad(q.sum(),(e['terrainRgb'],e['objectResidualSum']))
        m=mask.expand_as(p)
        self.assertEqual(int(b[0][m].count_nonzero()),0)
        self.assertTrue(torch.equal(a[0][~m],b[0][~m]))
        self.assertTrue(torch.equal(a[1],b[1]))

    def test_cannot_reinterpret_other_renderer_or_invalid_mask(self):
        p,e=self.fixture()
        with self.assertRaisesRegex(ValueError,'composition'):support_routed_prediction(p+.001,e)
        e['visibleObjectSupportMasks']['object_tree']=torch.full((1,1,192,256),.5)
        with self.assertRaisesRegex(ValueError,'binary'):support_routed_prediction(p,e)

    def test_empty_full_and_differentiable_support_refused(self):
        for value in (0.,1.):
            p,e=self.fixture();e['visibleObjectSupportMasks']={r:torch.full((1,1,192,256),value) for r in ROLES}
            with self.assertRaisesRegex(ValueError,'partial'):support_routed_prediction(p,e)
        p,e=self.fixture();e['visibleObjectSupportMasks']['object_tree']=e['visibleObjectSupportMasks']['object_tree'].float().requires_grad_()
        with self.assertRaisesRegex(ValueError,'detached'):support_routed_prediction(p,e)


if __name__=='__main__':unittest.main()

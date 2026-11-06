"""CPU synthetic regressions for the candidate; no checkpoint, train map or world data."""
from copy import deepcopy
import unittest

import torch
from torch import nn
from torch.nn import functional as F

from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world.seasonal_road_role_stage_v1 import (
    SeasonalRoadReadout,
    build_seasonal_road_role_stage,
)
from ai_painter.complete_world.terrain_ecology_native_recomputed_stage_v1 import (
    build_fresh_terrain_ecology_native_recomputed_stage,
)


def season(column):
    return torch.eye(4, dtype=torch.float32)[column]


def bitwise_equal(left, right):
    return torch.equal(left.contiguous().view(torch.uint8), right.contiguous().view(torch.uint8))


def known_decoder():
    """Carry road features from decoder slots 48:56 through two spatial convolutions."""
    decoder = nn.Sequential(
        nn.Conv2d(111, 48, 3, padding=1), nn.SiLU(),
        nn.Conv2d(48, 48, 3, padding=1), nn.SiLU(), nn.Conv2d(48, 3, 1),
    ).eval().requires_grad_(False)
    with torch.no_grad():
        for parameter in decoder.parameters():
            parameter.zero_()
        decoder[0].weight[0, 48:56, :, :] = 0.125
        decoder[2].weight[0, 0, :, :] = 0.25
        decoder[4].weight[:, 0, 0, 0] = torch.tensor([0.8, 0.5, 0.3])
    return decoder


class SeasonalRoadReadoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old_threads=torch.get_num_threads()
        torch.set_num_threads(1)
        cls.addClassCleanup(torch.set_num_threads, cls.old_threads)
        cls.decoder=known_decoder()
        cls.input=torch.zeros((1,111,192,256))
        cls.road=torch.zeros((1,1,192,256))
        cls.road[:,:,-3:,97:102]=1
        # Existing masked road features are genuine decoder inputs, not painted image pixels.
        cls.input[:,48:56]=0.2*cls.road
        cls.input[:,104:105]=cls.road
        cls.objects=torch.zeros((1,3,192,256))
        cls.objects[:,:,-1,98]=0.25

    def reference(self, data):
        terrain=self.decoder(data).sigmoid()
        return torch.sigmoid(torch.logit(terrain.clamp(1e-5,1-1e-5))+self.objects),terrain

    def test_zero_initialization_reproduces_independent_parent_rgb(self):
        readout=SeasonalRoadReadout()
        rgb0,terrain0=self.reference(self.input)
        self.assertEqual(tuple(readout.weight.shape),(8,4))
        self.assertEqual(int(readout.weight.count_nonzero()),0)
        for i in range(4):
            with self.subTest(season=i),torch.no_grad():
                rgb,terrain,road_features=readout(self.input,self.road,season(i),self.objects,self.decoder)
                self.assertTrue(bitwise_equal(rgb,rgb0))
                self.assertTrue(bitwise_equal(terrain,terrain0))
                self.assertTrue(bitwise_equal(road_features,self.input[:,48:56]))

    def test_dry_shift_traverses_two_convolutions_only_within_road_halo(self):
        readout=SeasonalRoadReadout()
        with torch.no_grad():
            readout.weight[0,0]=0.75
            expect=self.input.clone()
            expect[:,48:49]+=0.75*self.road
            ref,terrain_ref=self.reference(expect)
            dry,terrain,features=readout(self.input,self.road,season(0),self.objects,self.decoder)
            base,_=self.reference(self.input)
            self.assertTrue(bitwise_equal(dry,ref))
            self.assertTrue(bitwise_equal(terrain,terrain_ref))
            self.assertTrue(bitwise_equal(features,expect[:,48:56]))
            halo=F.max_pool2d(self.road,5,stride=1,padding=2).bool()[0,0]
            changed=(dry!=base).any(1)[0]
            self.assertTrue(bool((changed & halo & ~self.road[0,0].bool()).any()))
            self.assertTrue(bitwise_equal(dry[:,:,~halo],base[:,:,~halo]))
            self.assertTrue(bool(((dry*255).round()!=(base*255).round()).any()))
            for code in (1,2,3):
                self.assertTrue(bitwise_equal(readout(self.input,self.road,season(code),self.objects,self.decoder)[0],base))
            empty=self.input.clone()
            empty[:,48:56]=0
            empty[:,104:105]=0
            empty_ref,_=self.reference(empty)
            empty_out=readout(empty,torch.zeros_like(self.road),season(0),self.objects,self.decoder)[0]
            self.assertTrue(bitwise_equal(empty_ref,empty_out))

    def test_gradients_affect_only_the_selected_column_of_the_32_new_values(self):
        readout=SeasonalRoadReadout()
        rgb,_,_=readout(self.input,self.road,season(0),self.objects,self.decoder)
        rgb[:,:,-1,98].sum().backward()
        self.assertEqual(list(dict(readout.named_parameters())),["weight"])
        grad=readout.weight.grad
        self.assertEqual(grad.numel(),32)
        self.assertTrue(bool(torch.isfinite(grad).all()))
        self.assertTrue(bool((grad[:,0]!=0).all()))
        self.assertEqual(int(grad[:,1:].count_nonzero()),0)
        self.assertTrue(all(p.grad is None for p in self.decoder.parameters()))
        self.assertIsNone(self.objects.grad)

    def test_zero_delta_preserves_signed_parent_zeros_and_keeps_the_dry_gradient(self):
        readout = SeasonalRoadReadout()
        data = self.input.clone()
        road_features = data[:, 48:56]
        # Two signs both on and off the road. The numeric values are equal but
        # their bytes differ in the registered parent feature snapshot.
        for y, x in ((190, 98), (32, 17)):
            road_features[0, 0, y, x] = -0.0
            road_features[0, 1, y, x] = +0.0
        self.assertTrue(torch.signbit(road_features[0, 0, 190, 98]))
        self.assertFalse(torch.signbit(road_features[0, 1, 190, 98]))
        rgb, _, latent = readout(data, self.road, season(0), self.objects, self.decoder)
        self.assertTrue(bitwise_equal(latent, road_features))
        rgb[:, :, 190, 98].sum().backward()
        self.assertTrue(torch.isfinite(readout.weight.grad).all())
        self.assertTrue((readout.weight.grad[:, 0] != 0).all())
        self.assertEqual(int(torch.count_nonzero(readout.weight.grad[:, 1:])), 0)

    def test_unselected_season_and_off_road_keep_original_bits_after_dry_change(self):
        readout = SeasonalRoadReadout()
        data = self.input.clone()
        role = data[:, 48:56]
        role[0, 0, 190, 98] = -0.0
        role[0, 0, 189, 97] = +0.0
        role[0, 2, 190, 98] = -0.0
        role[0, 0, 32, 17] = -0.0
        role[0, 0, 33, 17] = +0.0
        with torch.no_grad():
            readout.weight[0, 0] = 0.5
            for code in (1, 2, 3):
                with self.subTest(code=code):
                    _, _, latent = readout(data, self.road, season(code), self.objects, self.decoder)
                    self.assertTrue(bitwise_equal(latent, role))
            _, _, dry = readout(data, self.road, season(0), self.objects, self.decoder)
            outside = ~self.road[0, 0].bool()
            self.assertTrue(bitwise_equal(dry[:, :, outside], role[:, :, outside]))
            self.assertTrue(bitwise_equal(dry[:, 1:], role[:, 1:]))
            self.assertEqual(dry[0, 0, 190, 98].item(), 0.5)

    def test_invalid_road_or_season_is_rejected(self):
        readout=SeasonalRoadReadout()
        wrong_road=self.road.clone()
        wrong_road[0,0,0,0]=0.5
        for road,code in ((wrong_road,season(0)),(self.road,torch.zeros(4)),(self.road,torch.ones(4)),(self.road,season(0).double())):
            with self.subTest(dtype=code.dtype, sum=float(code.sum())), self.assertRaises(ValueError):
                readout(self.input,road,code,self.objects,self.decoder)


class SeasonalRoadStateTests(unittest.TestCase):
    def test_state_is_bound_to_parent_and_exact_projection_bytes(self):
        readout=SeasonalRoadReadout()
        parent_sha="a"*64
        with torch.no_grad():
            readout.weight[:,0]=torch.arange(8)/8
        state=readout.export_projection_state(parent_sha)
        expected=readout.weight.detach().clone()
        with torch.no_grad(): readout.weight.zero_()
        readout.load_projection_state(deepcopy(state),parent_sha)
        self.assertTrue(bitwise_equal(readout.weight,expected))
        bad=deepcopy(state)
        bad["projection"][0,0]+=1
        for value,parent in (({},parent_sha),(state,"b"*64),(bad,parent_sha)):
            with self.subTest(parent=parent),self.assertRaises(ValueError):
                readout.load_projection_state(value,parent)
            self.assertTrue(bitwise_equal(readout.weight,expected))

    def test_untrained_native_stage0_parent_cannot_impersonate_registered_parent(self):
        old_threads=torch.get_num_threads()
        torch.set_num_threads(1)
        self.addCleanup(torch.set_num_threads,old_threads)
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(127)
            parent=build_fresh_terrain_ecology_native_recomputed_stage(geometry=NativeStageGeometry(0))
        parent.eval().requires_grad_(False)
        with self.assertRaises(ValueError):
            build_seasonal_road_role_stage(parent)


if __name__=="__main__":
    unittest.main()

"""Tiny synthetic CPU tensors only; no real renderer, data, prepare or GPU."""
from contextlib import contextmanager
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).absolute().parents[3]/'ml/ai-painter/src'))
import torch
from torch.nn import functional as F
from ai_painter.complete_world.road_attribution_observation_v1 import (
    RoadObservation, measurement_targets, projected_boundary_mask, vector_summary, MEASUREMENTS)
torch.set_num_threads(2)


class Generator(torch.nn.Module):
    def __init__(self):
        super().__init__();self.a=torch.nn.Parameter(torch.tensor(.1));self.b=torch.nn.Parameter(torch.tensor(.2))
        self.condition_channel_order=['terrain_water','terrain_path_ground','terrain_shoreline','object_footprints']
    def forward(self):
        return torch.sigmoid(self.a+self.b).expand(1,3,192,256)


class Critic(torch.nn.Module):
    def __init__(self):super().__init__();self.a=torch.nn.Parameter(torch.tensor(.3))
    def forward(self,x):return self.a*x.mean()


class Fixture:
    def __init__(self):
        self.model,self.critic=Generator(),Critic();self.expected=torch.zeros((768,1024),dtype=torch.bool)
        self.expected[-6:,100:120]=True;self.reference=torch.full((1,3,768,1024),.4)
        conditions=torch.zeros((4,192,256));conditions[1,:,25:30]=1
        self.sample={'conditions':conditions,'image':torch.full((3,192,256),.4)}
        self.evidence={'visibleObjectSupportMasks':{'object_rock':torch.zeros((1,1,192,256),dtype=torch.bool)}}
        self.parent=SimpleNamespace(bind_parameters=lambda m:(tuple(m.parameters()),{'object_rock':(0,)},1,1),
            train_object_support_structure_candidate_objective=self.objective,compute_generator_candidate_gradients=self.compute)
        self.background=SimpleNamespace(parent=self.parent,sample_forward=self.forward,targets=lambda *a:(None,torch.zeros((1,1,192,256),dtype=torch.bool),[]),
            auxiliary_loss=lambda terrain,*args:terrain.sum()*0,_FORWARD=SimpleNamespace(get=lambda:None))
        self.observer=None;self.fail_compute=False
    def forward(self,model,sample,return_evidence=False):
        value=model();return (value,self.evidence) if return_evidence else value
    def objective(self,critic,prediction,sample,order):
        local=F.avg_pool2d(prediction.float(),3,1,1,count_include_pad=False)
        target=F.avg_pool2d(sample['image'][None].float(),3,1,1,count_include_pad=False)
        support=F.max_pool2d((sample['conditions'][None,1:2]>.5).float(),3,1,1)
        fact=((local-target).abs()*support).sum()/(support.sum()*3).clamp_min(1)
        base=(prediction-.4).abs().mean()+.08*critic(prediction)
        return base,{'factRegionCoarseRgbMae':fact}
    def compute(self,**kwargs):
        if self.fail_compute:raise RuntimeError('original gate sentinel')
        params=tuple(self.model.parameters());rows=[]
        for i,key in enumerate(('actual_total','structured_objective','whole_frame_fidelity','object_core_rgb','object_support_structure')):
            self.observer.event('attempt','generator')
            gradient=torch.autograd.grad(kwargs[key],params,retain_graph=i<4,create_graph=False,allow_unused=True)
            rows.append(gradient);self.observer.event('complete','generator',gradient)
        return rows[0],{'unchangedOriginalSentinel':True}
    def run(self,*,mutate=False):
        ob=RoadObservation(self.model,self.critic,self.background,self.reference,self.expected,lambda:None,enforce_identity=False)
        self.observer=ob
        with ob:
            pred,_=self.background.sample_forward(self.model,self.sample,return_evidence=True)
            d=self.critic(pred.detach())+self.critic(torch.zeros_like(pred))
            torch.autograd.grad(d,tuple(self.critic.parameters()),create_graph=False,allow_unused=True)
            try:
                self.critic.requires_grad_(False)
                base,parts=self.parent.train_object_support_structure_candidate_objective(self.critic,pred,self.sample,self.model.condition_channel_order)
                _,mask,_=self.background.targets();bg=self.background.auxiliary_loss(pred,None,mask)
                whole=(pred-.4).square().mean();core=(pred-.4).abs().mean();support=(pred-.4).square().mean()*.1
                structured=base+bg;total=((structured+whole)+core)+support
                self.parent.compute_generator_candidate_gradients(model=self.model,critic=self.critic,sample=self.sample,
                    actual_total=total,structured_objective=structured,whole_frame_fidelity=whole,object_core_rgb=core,object_support_structure=support)
                if mutate:
                    with torch.no_grad():self.model.a.add_(1)
            finally:self.critic.requires_grad_(True)
        return ob


class GeometryTests(unittest.TestCase):
    def test_projected6_is_fractional_native_two_rows_not_native6(self):
        expected=torch.zeros((768,1024),dtype=torch.bool);expected[:6,:]=True
        mask,counts,sides=projected_boundary_mask(expected)
        self.assertEqual(int(mask.sum()),6*1024);self.assertEqual(sides,['north','east','west'])
        self.assertTrue(bool((counts[0]==16).all()));self.assertTrue(bool((counts[1]==8).all()))
        self.assertEqual(int(counts[2:].sum()),0)
    def test_four_boundaries_and_corner_union_no_double_count(self):
        expected=torch.ones((768,1024),dtype=torch.bool);mask,counts,sides=projected_boundary_mask(expected)
        self.assertEqual(int(mask.sum()),1024*768-(1024-12)*(768-12))
        self.assertEqual(int(counts.sum()),int(mask.sum()));self.assertEqual(len(sides),4)
    def test_empty_boundary_is_not_applicable(self):
        mask,counts,sides=projected_boundary_mask(torch.zeros((768,1024),dtype=torch.bool))
        self.assertEqual(int(mask.sum()),0);self.assertEqual(sides,[])
    def test_bad_native_geometry_rejected(self):
        with self.assertRaisesRegex(ValueError,'geometry'):projected_boundary_mask(torch.ones((192,256),dtype=torch.bool))
    def test_repeat_gradient_is_exact_four_by_four_scatter(self):
        x=torch.tensor([[.2,.6]],requires_grad=True);up=x.repeat_interleave(4,0).repeat_interleave(4,1)
        target=torch.arange(32,dtype=torch.float32).reshape(4,8)/40
        loss=(up-target).abs().sum();gradient=torch.autograd.grad(loss,x)[0]
        expected=torch.sign(up.detach()-target).reshape(1,4,2,4).sum((1,3))
        self.assertTrue(torch.equal(gradient,expected))
    def test_mean_target_shortcut_changes_l1(self):
        x=torch.tensor(.5);reference=torch.tensor([0.,1.])
        self.assertNotEqual(float((x-reference).abs().mean()),float((x-reference.mean()).abs()))
    def test_png_quantization_is_separate_from_raw_target(self):
        x=torch.tensor(.5,requires_grad=True);q=(x*255).round().to(torch.uint8)
        self.assertEqual(int(q),128);self.assertGreater(float((x.detach()-q.float()/255).abs()),0)
        self.assertEqual(float(torch.autograd.grad((x-.4).abs(),x)[0]),1)


class ObservationTests(unittest.TestCase):
    def test_one_graph_three_diagnostic_then_original_five_and_full_counts(self):
        fixture=Fixture();ob=fixture.run();s=ob.summary()
        self.assertEqual(s['counts'],{'generatorForwards':1,'generatorForwardCompleted':1,'criticForwards':3,'criticForwardCompleted':3,
            'originalGeneratorVjpAttempted':5,'originalGeneratorVjps':5,'diagnosticGeneratorVjpAttempted':3,'diagnosticGeneratorVjps':3,
            'discriminatorVjpAttempted':1,'discriminatorVjps':1,'autogradAttempted':9,'allAutogradGradCalls':9})
        self.assertEqual([x['kind'] for x in s['callSequence']],['discriminator']+['diagnosticGenerator']*3+['originalGenerator']*5)
        self.assertEqual([x['retainGraph'] for x in s['callSequence']],[False]+[True]*7+[False])
        self.assertTrue(s['stateUnchanged']);self.assertTrue(s['cleanupVerified'])
        self.assertEqual(s['stateBeforeDigest'],s['stateAfterDigest']);self.assertEqual(set(s['measurementScalars']),set(MEASUREMENTS))
        self.assertEqual(s['measurementScalars']['original_background_auxiliary'],0)
        self.assertIsNone(s['gradientComparisons']['actualCandidate']['original_background_auxiliary']['all']['cosine'])
        self.assertTrue(all(p.grad is None for p in fixture.model.parameters()))
    def test_original_failure_is_not_converted_to_success_and_delegates_restored(self):
        f=Fixture();f.fail_compute=True;original=f.parent.compute_generator_candidate_gradients
        with self.assertRaisesRegex(RuntimeError,'original gate sentinel'):f.run()
        self.assertIs(f.parent.compute_generator_candidate_gradients,original)
        self.assertTrue(f.observer.summary()['cleanupVerified']);self.assertTrue(f.observer.summary()['stateUnchanged'])
        self.assertEqual(f.observer.counts['diagnosticGeneratorVjps'],3);self.assertEqual(f.observer.counts['originalGeneratorVjps'],0)
    def test_state_mutation_cannot_be_hidden_by_cleanup(self):
        with self.assertRaisesRegex(ValueError,'state/RNG'):Fixture().run(mutate=True)
    def test_dirty_grad_rejected_without_clearing_it(self):
        f=Fixture();f.model.a.grad=torch.tensor(3.)
        with self.assertRaisesRegex(ValueError,'clean .grad'):f.run()
        self.assertEqual(float(f.model.a.grad),3)
    def test_optimizer_creation_and_backward_are_blocked(self):
        for action in ('optimizer','backward'):
            f=Fixture();ob=RoadObservation(f.model,f.critic,f.background,f.reference,f.expected,lambda:None,enforce_identity=False)
            with self.assertRaisesRegex(RuntimeError,'prohibited'):
                with ob:
                    if action=='optimizer':torch.optim.AdamW(f.model.parameters())
                    else:(f.model.a*2).backward()
    def test_mismatched_original_fact_aggregate_fails_closed(self):
        f=Fixture();pred=f.model();parts={'factRegionCoarseRgbMae':torch.tensor(9.)}
        with self.assertRaisesRegex(ValueError,'fact aggregate'):
            measurement_targets(pred,f.sample,f.model.condition_channel_order,parts,pred.sum()*0,f.evidence,f.reference,f.expected)
    def test_zero_norm_is_null_not_fake_pass(self):
        result=vector_summary((torch.zeros(1),),(torch.ones(1),),{'all':(0,)})
        self.assertIsNone(result['all']['cosine']);self.assertEqual(result['all']['status'],'unknown_zero_norm')
    def test_unused_and_connected_zero_have_distinct_counts(self):
        unused=vector_summary((None,),(torch.zeros(1),),{'all':(0,)})['all']
        connected=vector_summary((torch.zeros(1),),(torch.zeros(1),),{'all':(0,)})['all']
        self.assertEqual(unused['leftUnusedTensorCount'],1);self.assertEqual(unused['leftConnectedZeroTensorCount'],0)
        self.assertEqual(connected['leftUnusedTensorCount'],0);self.assertEqual(connected['leftConnectedZeroTensorCount'],1)
        self.assertIsNone(unused['cosine']);self.assertIsNone(connected['cosine'])
        with self.assertRaisesRegex(ValueError,'nonfinite'):
            vector_summary((torch.tensor(float('nan')),),(torch.ones(1),),{'all':(0,)})
    def test_mask_na_is_distinct_from_applicable_zero_norm(self):
        s=Fixture().run().summary()
        item=s['gradientComparisons']['actualCandidate']['original_background_auxiliary']['all']
        self.assertEqual(item['status'],'not_applicable_mask');self.assertEqual(item['measurementApplicability'],'not_applicable')
    def test_extra_vjp_failure_preserves_attempt_prefix_and_original_function(self):
        original=torch.autograd.grad;calls=[]
        def failing(*args,**kwargs):
            calls.append(kwargs.get('retain_graph',False))
            if len(calls)==2:raise RuntimeError('extra VJP sentinel')
            return original(*args,**kwargs)
        f=Fixture()
        with patch.object(torch.autograd,'grad',failing),self.assertRaisesRegex(RuntimeError,'extra VJP sentinel'):f.run()
        self.assertIs(torch.autograd.grad,original)
        s=f.observer.summary();self.assertEqual(s['counts']['diagnosticGeneratorVjpAttempted'],1)
        self.assertEqual(s['counts']['diagnosticGeneratorVjps'],0);self.assertEqual(s['counts']['allAutogradGradCalls'],1)
        self.assertTrue(s['cleanupVerified']);self.assertTrue(s['stateUnchanged'])
    def test_rng_mutation_detected_without_erasing_original_error(self):
        f=Fixture()
        with torch.random.fork_rng(devices=[]):
            ob=RoadObservation(f.model,f.critic,f.background,f.reference,f.expected,lambda:None,enforce_identity=False)
            with self.assertRaisesRegex(ValueError,'state/RNG'):
                with ob:torch.rand(1)
    def test_empty_road_and_boundary_still_define_connected_zero_measurements(self):
        f=Fixture();f.sample['conditions'].zero_();f.expected.zero_();pred=f.model()
        values,facts,q=measurement_targets(pred,f.sample,f.model.condition_channel_order,
            {'factRegionCoarseRgbMae':pred.sum()*0},pred.sum()*0,f.evidence,f.reference,f.expected)
        self.assertFalse(facts['nativeRoadApplicable']);self.assertEqual(facts['projectedBoundaryPixels'],0)
        for key in MEASUREMENTS:
            gradients=torch.autograd.grad(values[key],tuple(f.model.parameters()),retain_graph=True,allow_unused=True)
            self.assertEqual(float(values[key].detach()),0)
            self.assertTrue(all(v is None or not bool(v.count_nonzero()) for v in gradients))


if __name__=='__main__':unittest.main()

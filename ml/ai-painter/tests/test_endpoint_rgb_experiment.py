"""Exact forward/gradient equivalence and target-free endpoint boundaries."""
from pathlib import Path
import sys
import unittest
import torch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"ml/ai-painter/src"));sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"))
from ai_painter.complete_world.endpoint_rgb_experiment import pure_noise_endpoint, add_existing_objectives
from ai_painter.complete_world.diffusion import build_schedule
from compare_decoder_adapted_sampling import rollout


class EndpointTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(1)
        self.conditions=torch.zeros(1,23,192,256)
        self.alpha=build_schedule(1000,"cpu")["alphaBars"]

    def test_no_grad_forward_matches_existing_10_step_sampler_exactly(self):
        def predict(x,t,c): return x*.13+float(t.item())*.0001
        with torch.no_grad():
            n,z=pure_noise_endpoint(predict,self.conditions,self.alpha,7)
            oldn,oldz,_,_=rollout(torch,predict,self.conditions,self.alpha,7,10,lambda:None)
        self.assertTrue(torch.equal(n,oldn));self.assertTrue(torch.equal(z,oldz))

    def test_checkpoint_and_direct_forward_and_parameter_gradients_are_equal(self):
        outputs=[]
        for enabled in (False,True):
            weight=torch.nn.Parameter(torch.tensor(.13))
            def predict(x,t,c): return x*weight+weight.square()*(t.to(x.dtype).view(1,1,1,1)/1000)
            n,z=pure_noise_endpoint(predict,self.conditions,self.alpha,8,activation_checkpointing=enabled)
            z.square().mean().backward()
            outputs.append((n,z.detach(),weight.grad.clone()))
        self.assertTrue(all(torch.equal(a,b) for a,b in zip(*outputs)))
        self.assertTrue(bool(outputs[0][2].abs()>0))

    def test_gradients_reach_all_ten_distinct_timestep_parameters(self):
        parameters=torch.nn.Parameter(torch.linspace(.1,.2,10))
        grid=[999,888,777,666,555,444,333,222,111,0]
        def predict(x,t,c):return x*parameters[grid.index(int(t.item()))]
        _,z=pure_noise_endpoint(predict,self.conditions,self.alpha,9)
        z.square().mean().backward()
        self.assertTrue(bool(torch.isfinite(parameters.grad).all()))
        self.assertTrue(bool((parameters.grad.abs()>0).all()))

    def test_frozen_decoder_still_passes_gradient_to_generator(self):
        weight=torch.nn.Parameter(torch.tensor(.1));decoder=torch.nn.Conv2d(12,3,1).requires_grad_(False)
        before={k:v.clone() for k,v in decoder.state_dict().items()}
        _,z=pure_noise_endpoint(lambda x,t,c:x*weight,self.conditions,self.alpha,9)
        decoder(z).square().mean().backward()
        self.assertGreater(float(weight.grad.abs()),0)
        self.assertTrue(all(p.grad is None for p in decoder.parameters()))
        self.assertTrue(all(torch.equal(v,before[k]) for k,v in decoder.state_dict().items()))

    def test_api_cannot_receive_target_or_initial_latent(self):
        for key in ("target","target_image","clean_latent","initial_latent","steps"):
            with self.assertRaises(TypeError):pure_noise_endpoint(None,self.conditions,self.alpha,0,**{key:None})

    def test_invalid_seed_and_checkpoint_flag_rejected(self):
        for seed in (True,-1,2**63,"1",1.5):
            with self.assertRaises(ValueError):pure_noise_endpoint(None,self.conditions,self.alpha,seed)
        with self.assertRaises(ValueError):pure_noise_endpoint(None,self.conditions,self.alpha,1,activation_checkpointing=1)

    def test_invalid_condition_shape_or_trainable_input_rejected(self):
        for c in (self.conditions[:,:,:,:128],self.conditions.double(),self.conditions.clone().requires_grad_()):
            with self.assertRaises(ValueError):pure_noise_endpoint(None,c,self.alpha,0)

    def test_invalid_schedule_rejected(self):
        for alpha in (self.alpha[:-1],self.alpha.flip(0),torch.ones_like(self.alpha),self.alpha.double(),self.alpha.clone().requires_grad_()):
            with self.assertRaises(ValueError):pure_noise_endpoint(None,self.conditions,alpha,0)

    def test_nonfinite_velocity_fails_before_output(self):
        with self.assertRaises(ValueError):pure_noise_endpoint(lambda x,t,c:x*float("nan"),self.conditions,self.alpha,0)

    def test_wrong_velocity_shape_rejected(self):
        with self.assertRaises(ValueError):pure_noise_endpoint(lambda x,t,c:x[:,:1],self.conditions,self.alpha,0)

    def test_inputs_and_global_rng_unchanged(self):
        c=self.conditions.clone();a=self.alpha.clone();rng=torch.get_rng_state().clone()
        pure_noise_endpoint(lambda x,t,c:x*.1,self.conditions,self.alpha,7)
        self.assertTrue(torch.equal(c,self.conditions));self.assertTrue(torch.equal(a,self.alpha))
        self.assertTrue(torch.equal(rng,torch.get_rng_state()))

    def test_resource_guard_propagates_in_forward_and_recomputation(self):
        def fail():raise TimeoutError("budget")
        with self.assertRaises(TimeoutError):pure_noise_endpoint(lambda x,t,c:x,self.conditions,self.alpha,0,check=fail)
        weight=torch.nn.Parameter(torch.tensor(.1));backward=False
        def guard():
            if backward:raise TimeoutError("backward budget")
        _,z=pure_noise_endpoint(lambda x,t,c:x*weight,self.conditions,self.alpha,0,check=guard)
        backward=True
        with self.assertRaises(TimeoutError):z.square().mean().backward()


class ExistingObjectiveSumTests(unittest.TestCase):
    def test_sum_matches_two_backward_paths_and_full_only_is_unchanged(self):
        a=torch.tensor(2.,requires_grad=True);b=torch.tensor(3.,requires_grad=True)
        full=a.square();extra=b.square()
        self.assertIs(add_existing_objectives(full),full)
        add_existing_objectives(full,extra).backward()
        self.assertEqual(float(a.grad),4.);self.assertEqual(float(b.grad),6.)

    def test_missing_non_scalar_nonfinite_and_dtype_mismatch_rejected(self):
        for full,extra in [(None,torch.tensor(1.)),(1.,None),(torch.ones(2),None),
                           (torch.tensor(float('nan')),None),(torch.tensor(1.),torch.tensor(float('inf'))),
                           (torch.tensor(1.),torch.tensor(2.,dtype=torch.float64))]:
            with self.assertRaises(ValueError):add_existing_objectives(full,extra)


if __name__=="__main__":unittest.main()

"""CPU counterexamples for the finite endpoint A/B entry point."""
import copy
import hashlib
import json
import unittest
from unittest import mock

import painter_endpoint_ab_experiment as run


class EndpointAbTests(unittest.TestCase):
    def test_exact_balanced_update_matrix(self):
        for arm in run.ARMS:
            rows = [(i, run.route(arm, e, i)) for e in range(100) for i in range(2)]
            self.assertEqual(len(rows), 200)
            for i in range(2):
                self.assertEqual(rows.count((i, "endpoint_rgb")), 50 if arm == run.ARMS[1] else 0)
                self.assertEqual(rows.count((i, "single_step")), 50 if arm == run.ARMS[1] else 100)

    def test_route_alternates_whole_epochs_not_image_parity(self):
        for epoch in range(100):
            self.assertEqual(run.route(run.ARMS[1], epoch, 0), run.route(run.ARMS[1], epoch, 1))
            self.assertEqual(run.route(run.ARMS[1], epoch, 0), "endpoint_rgb" if epoch % 2 else "single_step")

    def test_out_of_budget_and_noninteger_inputs_rejected(self):
        for args in [("unknown", 0, 0), (run.ARMS[0], -1, 0), (run.ARMS[0], 100, 0),
                     (run.ARMS[0], True, 0), (run.ARMS[0], 0.0, 0), (run.ARMS[0], 0, 2), (run.ARMS[0], 0, False)]:
            with self.assertRaises((ValueError, AssertionError)):
                run.route(*args)

    def test_unique_training_seeds_exclude_all_six_evaluation_seeds(self):
        seeds = [run.seed_for(e, i) for e in range(100) for i in range(2)]
        self.assertEqual(seeds, list(range(20260909, 20261109)))
        self.assertFalse(set(seeds) & set(sum(run.prior.comparison.SETTINGS["seedsBySample"], [])))

    def test_resource_limits_are_the_existing_limits(self):
        self.assertEqual(run.RESOURCES, run.prior.base.RESOURCES)
        self.assertEqual(run.RESOURCES["maxGpuSeconds"], 600)
        self.assertEqual(run.RESOURCES["automaticRetries"], 0)
        self.assertFalse(run.TRAINING["equalComputeClaim"])

    def probes(self):
        return [{"route": route, "sampleId": sample, "optimizerCreated": False,
                 "modelStateUnchanged": True, "baseOutputReached": True, "gradientL2": 1., "frozenGradientCount": 0}
                for route in ("single_step", "endpoint_rgb") for sample in run.prior.previous.SAMPLES]

    def test_all_four_current_probes_required(self):
        run.require_probes(self.probes())
        for mutate in (lambda p: p.pop(), lambda p: p.reverse(), lambda p: p.__setitem__(1, p[0])):
            probes = self.probes(); mutate(probes)
            with self.assertRaises((ValueError, AssertionError)):
                run.require_probes(probes)

    def test_gpu_probe_cannot_claim_frozen_gradients_or_created_optimizer(self):
        for key, value in [("optimizerCreated", True), ("modelStateUnchanged", False),
                           ("baseOutputReached", False), ("gradientL2", 0), ("gradientL2", float("nan")), ("gradientL2", float("inf")),
                           ("frozenGradientCount", 1)]:
            probes = self.probes(); probes[0][key] = value
            with self.assertRaises((ValueError, AssertionError)):
                run.require_probes(probes)

    def checkpoint(self):
        import torch
        from ai_painter.complete_world.split_training import state_hash
        state = {"toy": torch.tensor([1.])}
        request = {"identity": "test", "parentCheckpoint": {"path": "parent.pt", "sha256": "a" * 64}}
        return request, {"schemaVersion": "ai-painter-endpoint-ab-checkpoint-v1", "runId": "test", "arm": run.ARMS[0],
            "optimizerSteps": 200, "parentCheckpoint": request["parentCheckpoint"], "training": run.TRAINING,
            "checkpointPromotable": False, "formalInferenceEligible": False, "resumeSupported": False,
            "denoiserState": state, "denoiserStateSha256": state_hash(state)}

    def test_checkpoint_identity_budget_qualification_and_bytes(self):
        request, cp = self.checkpoint()
        run.validate_checkpoint(cp, request, run.ARMS[0])
        for patch in ({"optimizerSteps": 199}, {"runId": "old"}, {"arm": run.ARMS[1]},
                      {"parentCheckpoint": {}}, {"training": {}}, {"checkpointPromotable": True},
                      {"formalInferenceEligible": True}, {"resumeSupported": True}, {"denoiserStateSha256": "0" * 64}):
            with self.assertRaises((ValueError, AssertionError)):
                run.validate_checkpoint({**cp, **patch}, request, run.ARMS[0])

    def test_checkpoint_tensor_tamper_does_not_pass_metadata_hash(self):
        request, cp = self.checkpoint()
        changed = copy.deepcopy(cp); changed["denoiserState"]["toy"][0] = 2
        with self.assertRaises((ValueError, AssertionError)):
            run.validate_checkpoint(changed, request, run.ARMS[0])


class EndpointV2Tests(unittest.TestCase):
    def request(self):
        payload={"schemaVersion":"ai-painter-endpoint-ab-request-v2","training":run.TRAINING_V2,
                 "parentCheckpoint":{"path":"fixture.pt","sha256":"a"*64}}
        identity="painter-endpoint-ab-v2-"+hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",", ":"),ensure_ascii=False).encode()).hexdigest()
        return {**payload,"identity":identity,"outputRoot":run.prior.previous.ROOT+"/"+identity}

    def test_v2_executes_full_callback_on_every_update_and_adds_exactly_100_endpoints(self):
        import torch
        counts={"full":0,"endpoint":0}
        def full():counts['full']+=1;return torch.tensor(2.),{'route':'single_step','noiseSha256':'a'*64}
        def endpoint():counts['endpoint']+=1;return torch.tensor(3.),{'route':'endpoint_rgb','noiseSha256':'a'*64}
        for arm in run.ARMS:
            for epoch in range(100):
                for index in range(2):
                    mode=run.route(arm,epoch,index,'v2')
                    loss,record=run.objective_for_route(mode,full,endpoint)
                    self.assertEqual(float(loss),5. if arm==run.ARMS[1] and epoch%2 else 2.)
                    self.assertEqual(record['route'],mode)
        self.assertEqual(counts,{'full':400,'endpoint':100})

    def test_v2_has_both_gradient_paths_and_preserves_five_heads_and_autoencoder(self):
        import torch
        model=torch.nn.Module();model.autoencoder=torch.nn.Linear(1,1,bias=False)
        model.denoiser=torch.nn.Module();model.denoiser.base_output=torch.nn.Linear(1,1,bias=False)
        model.denoiser.rgb_responsibility_heads=torch.nn.ModuleList([torch.nn.Linear(1,1,bias=False) for _ in range(5)])
        selected=run.prior.trainable_parameters(model);model.eval()
        frozen={n:p.detach().clone() for n,p in model.named_parameters() if not p.requires_grad}
        self.assertEqual(len(frozen),6);self.assertEqual(len(selected),1)
        x=torch.ones(1,1);weight=model.denoiser.base_output.weight
        with torch.no_grad():weight.fill_(1.)
        def full():return model.denoiser.base_output(x).sum()*2,{'route':'single_step','noiseSha256':'a'*64}
        def endpoint():return model.denoiser.base_output(x).sum()*3,{'route':'endpoint_rgb','noiseSha256':'a'*64}
        loss,_=run.objective_for_route('full_plus_endpoint',full,endpoint);loss.backward()
        self.assertEqual(float(weight.grad),5.)
        self.assertTrue(all(p.grad is None and torch.equal(p,frozen[n]) for n,p in model.named_parameters() if n in frozen))
        self.assertFalse(model.training);self.assertTrue(weight.requires_grad)
        calls=[]
        with self.assertRaises(ValueError):run.objective_for_route('unknown',lambda:calls.append('full'),lambda:calls.append('endpoint'))
        self.assertEqual(calls,[])

    def test_v2_identity_cannot_reuse_v1_or_changed_strategy(self):
        request=self.request();self.assertEqual(run.request_strategy(request),'v2')
        for patch in ({'schemaVersion':'ai-painter-endpoint-ab-request-v1'},{'training':run.TRAINING},
                      {'identity':'painter-endpoint-ab-v2-'+'a'*64},{'parentCheckpoint':{}}):
            with self.assertRaises(ValueError):run.request_strategy({**request,**patch})
        self.assertEqual(run.request_strategy({'schemaVersion':'ai-painter-endpoint-ab-request-v1','training':run.TRAINING}),'v1')

    def test_v2_probe_requires_combined_route_not_old_rgb_only_route(self):
        probes=EndpointAbTests().probes()
        with self.assertRaises(ValueError):run.require_probes(probes,'v2')
        for p in probes:
            if p['route']=='endpoint_rgb':p['route']='full_plus_endpoint'
        run.require_probes(probes,'v2')

    def test_v2_checkpoint_rejects_v1_schema_and_old_training(self):
        request=self.request();_,cp=EndpointAbTests().checkpoint()
        cp.update(schemaVersion='ai-painter-endpoint-ab-checkpoint-v2',runId=request['identity'],training=run.TRAINING_V2,
                  parentCheckpoint=request['parentCheckpoint'])
        run.validate_checkpoint(cp,request,run.ARMS[0])
        for patch in ({'schemaVersion':'ai-painter-endpoint-ab-checkpoint-v1'},{'training':run.TRAINING}):
            with self.assertRaises(ValueError):run.validate_checkpoint({**cp,**patch},request,run.ARMS[0])

    def test_probe_only_rejects_legacy_before_output_or_optimizer(self):
        from pathlib import Path
        import torch
        request={'schemaVersion':'ai-painter-endpoint-ab-request-v1','training':run.TRAINING}
        with mock.patch.object(run,'validate_request',return_value=(request,{},{})), mock.patch.object(run,'save_json') as save:
            with self.assertRaisesRegex(ValueError,'probe-only'):
                run.execute(Path.cwd(),{},probe_only=True)
            save.assert_not_called()
        self.assertFalse(torch.cuda.is_initialized())


class EndpointV3Tests(unittest.TestCase):
    def request(self):
        payload={'schemaVersion':'ai-painter-endpoint-ab-request-v3','training':run.TRAINING_V3,
                 'parentCheckpoint':{'path':'legacy-parent.pt','sha256':'a'*64}}
        identity='painter-endpoint-ab-v3-'+hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',', ':'),ensure_ascii=False).encode()).hexdigest()
        return {**payload,'identity':identity,'outputRoot':run.prior.previous.ROOT+'/'+identity}

    def test_all_updates_keep_full_loss_and_only_epoch_mod4_eq3_adds_endpoint(self):
        import torch
        counts={'full':0,'endpoint':0};by_sample=[0,0]
        def full():counts['full']+=1;return torch.tensor(2.),{'route':'single_step','noiseSha256':'a'*64}
        def endpoint():counts['endpoint']+=1;return torch.tensor(3.),{'route':'endpoint_rgb','noiseSha256':'a'*64}
        for arm in run.ARMS:
            for epoch in range(100):
                for index in range(2):
                    extra=arm==run.ARMS[1] and epoch%4==3
                    mode=run.route(arm,epoch,index,'v3')
                    self.assertEqual(mode,'full_plus_endpoint' if extra else 'single_step')
                    value,_=run.objective_for_route(mode,full,endpoint)
                    self.assertEqual(float(value),5. if extra else 2.)
                    by_sample[index]+=int(extra)
        self.assertEqual(counts,{'full':400,'endpoint':50});self.assertEqual(by_sample,[25,25])
        changed={k for k in run.TRAINING_V3 if run.TRAINING_V3[k]!=run.TRAINING_V2[k]}
        self.assertEqual(changed,{'candidateRoute','objectiveStrategy'})

    def test_v3_identity_rejects_old_version_frequency_and_parent_substitution(self):
        request=self.request();self.assertEqual(run.request_strategy(request),'v3')
        for patch in ({'schemaVersion':'ai-painter-endpoint-ab-request-v2'}, {'training':run.TRAINING_V2},
                      {'training':run.TRAINING}, {'parentCheckpoint':{'path':'failed-v2-candidate.pt','sha256':'b'*64}},
                      {'identity':'painter-endpoint-ab-v3-'+'a'*64}):
            with self.assertRaises(ValueError):run.request_strategy({**request,**patch})

    def test_v3_checkpoint_schema_and_four_current_probes_are_required(self):
        request=self.request();_,cp=EndpointAbTests().checkpoint()
        cp.update(schemaVersion='ai-painter-endpoint-ab-checkpoint-v3',runId=request['identity'],training=run.TRAINING_V3,
                  parentCheckpoint=request['parentCheckpoint'])
        run.validate_checkpoint(cp,request,run.ARMS[0])
        for patch in ({'schemaVersion':'ai-painter-endpoint-ab-checkpoint-v2'},{'training':run.TRAINING_V2}):
            with self.assertRaises(ValueError):run.validate_checkpoint({**cp,**patch},request,run.ARMS[0])
        probes=EndpointAbTests().probes()
        for p in probes:
            if p['route']=='endpoint_rgb':p['route']='full_plus_endpoint'
        run.require_probes(probes,'v3')
        with self.assertRaises(ValueError):run.require_probes(probes[:-1],'v3')
        probes[0]['frozenGradientCount']=1
        with self.assertRaises(ValueError):run.require_probes(probes,'v3')


class EndpointV4Tests(unittest.TestCase):
    def test_gpu_only_cannot_enter_training_or_write_worker_start(self):
        from pathlib import Path
        run.guard_execution_mode({'executionMode':'gpu_qualification_only'},True)
        for mode in ('gpu_qualification_only','unknown'):
            with mock.patch.object(run,'validate_request',return_value=({'executionMode':mode},{},{})), mock.patch.object(run,'save_json') as save:
                with self.assertRaises(ValueError):run.execute(Path.cwd(),{},probe_only=False)
                save.assert_not_called()
        run.guard_execution_mode({},False)
        run.guard_execution_mode({'executionMode':'bounded_training_after_gpu_recheck'},False)
        with self.assertRaises(ValueError):run.guard_execution_mode({'executionMode':'bounded_training_after_gpu_recheck'},True)

    def test_isolated_phase_proof_releases_graph_and_preserves_combined_gradient(self):
        import gc
        import weakref
        import torch
        from ai_painter.complete_world.endpoint_rgb_experiment import isolated_phase4_gradient, phase4_residual_loss
        weight=torch.tensor(.1,requires_grad=True)
        target=torch.full((1,3,192,256),.5)
        pattern=torch.zeros_like(target);pattern[:,:,::4,::4]=1
        refs=[]
        def produce():
            rgb=target+weight*pattern;refs.append(weakref.ref(rgb));return rgb
        reference_rgb=produce()
        reference_phase=phase4_residual_loss(reference_rgb,target)
        phase_gradient=torch.autograd.grad(reference_phase,weight,retain_graph=True)[0]
        reference=weight.square()+reference_rgb.abs().mean()+reference_phase
        expected=torch.autograd.grad(reference,weight)[0]
        del reference,reference_rgb,reference_phase
        proof=isolated_phase4_gradient(produce,target,weight)
        gc.collect()
        self.assertTrue(all(r() is None for r in refs))
        self.assertIsNone(weight.grad)
        self.assertAlmostEqual(proof['phase4GradientL2'],float(phase_gradient.abs()),places=7)
        rgb=produce();combined=weight.square()+rgb.abs().mean()+phase4_residual_loss(rgb,target)
        actual=torch.autograd.grad(combined,weight)[0]
        self.assertTrue(torch.equal(actual,expected))
        self.assertEqual(float(weight.detach()),float(torch.tensor(.1)))

    def test_isolated_proof_rejects_zero_frozen_or_nonfinite_gradient(self):
        import torch
        from ai_painter.complete_world.endpoint_rgb_experiment import isolated_phase4_gradient
        target=torch.zeros((1,3,192,256));w=torch.tensor(1.,requires_grad=True)
        for producer,parameter in [(lambda:target+w,w),(lambda:target,w.detach()),(lambda:target+w*float('nan'),w)]:
            with self.assertRaises(ValueError):isolated_phase4_gradient(producer,target,parameter)

    def test_balanced_single_variable_matrix(self):
        counts = {}
        for arm in run.ARMS:
            rows = [run.route(arm,e,i,'v4') for e in range(100) for i in range(2)]
            counts[arm] = {k:rows.count(k) for k in set(rows)}
        self.assertEqual(counts[run.ARMS[0]], {'single_step':150,'full_plus_endpoint':50})
        self.assertEqual(counts[run.ARMS[1]], {'single_step':150,'full_plus_endpoint_phase4':50})
        self.assertEqual(run.probe_modes('v4'),('full_plus_endpoint','full_plus_endpoint_phase4'))

    def test_phase_loss_independent_formula_and_gradient(self):
        import torch
        from ai_painter.complete_world.endpoint_rgb_experiment import phase4_residual_loss
        target = torch.full((1,3,192,256), .5)
        x = target.clone(); x[:,:,::4,::4] += .1; x.requires_grad_()
        loss = phase4_residual_loss(x,target)
        r = x-target
        phases=torch.stack([r[:,:,a::4,b::4].mean((-2,-1)) for a in range(4) for b in range(4)])
        oracle=((phases-phases.mean(0)).square().mean()+1e-12).sqrt()-1e-6
        self.assertTrue(torch.allclose(loss,oracle,rtol=1e-6,atol=1e-9))
        actual=torch.autograd.grad(loss,x,retain_graph=True)[0]
        expected=torch.autograd.grad(oracle,x)[0]
        self.assertTrue(torch.allclose(actual,expected,rtol=1e-5,atol=1e-9))
        self.assertGreater(float(actual.abs().sum()),0)

    def test_exact_target_global_bias_and_natural_texture_not_penalized(self):
        import torch
        from ai_painter.complete_world.endpoint_rgb_experiment import phase4_residual_loss
        target=torch.rand((1,3,192,256),generator=torch.Generator().manual_seed(17))
        for x in (target.clone(),target+.2):
            x.requires_grad_();value=phase4_residual_loss(x,target)
            self.assertLess(abs(float(value.detach())),1e-8)
            value.backward();self.assertTrue(bool(torch.isfinite(x.grad).all()))

    def test_phase_contract_rejects_bad_shape_dtype_finite_target_gradient(self):
        import torch
        from ai_painter.complete_world.endpoint_rgb_experiment import phase4_residual_loss as loss
        t=torch.zeros((1,3,192,256))
        for a,b in [(t.double(),t),(t,t.double()),(t[:,:,:190],t),(t*float('nan'),t),
                    (t,t+2),(t,t.clone().requires_grad_()),(t*float('inf'),t)]:
            with self.assertRaises(ValueError):loss(a,b)

    def test_combined_objective_keeps_all_paths_and_phase_record(self):
        import torch
        x=torch.tensor(1.,requires_grad=True)
        loss,record=run.objective_for_route('full_plus_endpoint_phase4',
            lambda:(2*x,{'route':'single_step','noiseSha256':'a'*64}),
            lambda:(3*x+5*x,{'noiseSha256':'a'*64,'existingEndpointObjectiveValue':3.,'phase4Loss':5.,'phase4Coefficient':1}))
        loss.backward();self.assertEqual(float(x.grad),10.)
        self.assertEqual(record['phase4Loss'],5.)
        self.assertEqual(record['endpointObjectiveValue'],8.)

    def test_old_probes_cannot_qualify_v4(self):
        probes=EndpointAbTests().probes()
        with self.assertRaises(ValueError):run.require_probes(probes,'v4')
        for i,p in enumerate(probes):
            p['route']=run.probe_modes('v4')[i//2];p['phase4GradientL2']=1.
        run.require_probes(probes,'v4')
        probes[0]['frozenGradientCount']=1
        with self.assertRaises(ValueError):run.require_probes(probes,'v4')


if __name__ == "__main__":
    unittest.main()

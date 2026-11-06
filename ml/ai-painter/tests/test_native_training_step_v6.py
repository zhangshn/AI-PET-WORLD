import hashlib
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import torch
from ai_painter.complete_world import native_training_step_v6 as native

ROOT=Path(__file__).resolve().parents[3]


class PairCheckpointTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        self.nets=[torch.nn.Linear(4,3),torch.nn.Linear(3,2)]
        self.opts=native.adamw_pair(*self.nets)
        self.lineage={"fixture":"CPU simulated one-pair, no map training","policy":native.POLICY_SHA}

    def update(self):
        for n,o in zip(self.nets,self.opts):
            n(torch.ones(1,n.in_features)).sum().backward();o.step();o.zero_grad(set_to_none=True)

    def test_halved_pair_rejected(self):
        self.nets[1](torch.ones(1,3)).sum().backward();self.opts[1].step()
        with self.assertRaisesRegex(ValueError,"missing AdamW"):native.encode_pair_checkpoint(self.nets,self.opts,self.lineage)

    def test_authentic_complete_pair_strict_reload(self):
        self.update()
        raw=native.encode_pair_checkpoint(self.nets,self.opts,self.lineage);sha=hashlib.sha256(raw).hexdigest()
        g,d=torch.nn.Linear(4,3),torch.nn.Linear(3,2);go,do=native.adamw_pair(g,d)
        self.assertEqual(native.reload_pair_checkpoint(raw,sha,(g,d),(go,do),self.lineage),{"generator":1,"discriminator":1})
        self.assertEqual([native.parameter_digests(n) for n in (g,d)],[native.parameter_digests(n) for n in self.nets])
        self.assertEqual([native.state_fingerprints(o.state_dict()) for o in (go,do)],[native.state_fingerprints(o.state_dict()) for o in self.opts])
        with self.assertRaisesRegex(ValueError,"bytes changed"):native.reload_pair_checkpoint(raw,"0"*64,(g,d),(go,do),self.lineage)
        with self.assertRaisesRegex(ValueError,"lineage"):native.reload_pair_checkpoint(raw,sha,(g,d),(go,do),{})
        saved=torch.load(io.BytesIO(raw),map_location="cpu",weights_only=True);saved["optimizers"][0]["state"][0]["step"].fill_(2)
        stream=io.BytesIO();torch.save(saved,stream);bad=stream.getvalue()
        with self.assertRaisesRegex(ValueError,"step state"):native.reload_pair_checkpoint(bad,hashlib.sha256(bad).hexdigest(),(g,d),(go,do),self.lineage)


class NativeRouteTests(unittest.TestCase):
    def test_actual_native_stage2_strict_cpu_checkpoint(self):
        import prepare_native_training_step_v6 as smoke
        torch.set_num_threads(2)
        _,_,order,g,d,lineage=smoke.initialize()
        opts=native.adamw_pair(g,d)
        for net,opt in zip((g,d),opts):
            # Tiny fixed CPU gradients exercise the original concrete CPU-only loader;
            # these values are not a map objective or evidence of map training.
            for p in net.parameters():p.grad=torch.full_like(p,1e-7)
            opt.step();opt.zero_grad(set_to_none=True)
        raw=native.encode_pair_checkpoint((g,d),opts,lineage)
        restored=smoke.background.fresh_networks(order,model_capability=smoke.family.CAPABILITY,geometry=smoke.NativeStageGeometry(2))
        reload_opts=native.adamw_pair(*restored)
        native.reload_pair_checkpoint(raw,hashlib.sha256(raw).hexdigest(),restored,reload_opts,lineage)
        self.assertEqual([native.parameter_digests(n) for n in restored],[native.parameter_digests(n) for n in (g,d)])
        self.assertEqual([native.state_fingerprints(o.state_dict()) for o in opts],[native.state_fingerprints(o.state_dict()) for o in reload_opts])
        self.assertFalse(torch.cuda.is_initialized())

    def test_registered_v6_and_original_step_api(self):
        policy=native.load_policy(ROOT)
        self.assertEqual([s["parameterIndex"] for s in policy["namedFullGradientSites"]["sites"]],[52,86])
        self.assertEqual(tuple(policy["namedFullGradientSites"]["requiredPhases"]),native.PHASES)
        self.assertFalse(policy["optimizerSmoke"]["qualificationOfFormalStage"])

    def check_route(self,slot,failure):
        policy=native.load_policy(ROOT)
        sites={s["parameterIndex"]:s for s in policy["namedFullGradientSites"]["sites"]}
        weights=[(sites[i]["parameterName"],torch.empty(48,sites[i]["inChannels"],3,3)) if i in sites else
                 ("unregistered."+str(i),torch.empty(1)) for i in range(109)]
        class Fake:
            def named_parameters(self):return iter(weights)
        name,w=weights[slot];ci=sites[slot]["inChannels"]
        x=torch.empty(1).expand(1,ci,768,1024);dy=torch.empty(1).expand(1,48,768,1024)
        events=[];live=[512,512]
        def resource(tag):
            label=tag.split("/")[-2:];events.append("/".join(label))
            if events[-1]==failure:raise RuntimeError("resource cutoff")
        scope=native.NativeMemoryScope(Fake(),policy,resource)
        op=torch.ops.aten.convolution_backward.default
        args=(dy,x,w,[48],[1,1],[1,1],[1,1],False,[0,0],1,(True,True,True))
        out=[object() for _ in range(3)]
        def kernel(unused,*a,**k):
            mask=tuple(a[-1]);events.append(str(mask))
            if mask==(False,True,True):live[1]=2**29
            return tuple(v if flag else None for v,flag in zip(out,mask))
        def trim():events.append("empty_cache");live[1]=live[0]
        scope.phase=native.PHASES[0]
        with patch.object(type(op),"__call__",kernel),patch.object(torch.cuda,"memory_allocated",side_effect=lambda:live[0]),\
             patch.object(torch.cuda,"memory_reserved",side_effect=lambda:live[1]),patch.object(torch.cuda,"synchronize"),patch.object(torch.cuda,"empty_cache",side_effect=trim):
            if failure:
                with self.assertRaisesRegex(RuntimeError,"cutoff"):scope.__torch_dispatch__(op,(),args)
                self.assertNotIn("empty_cache",events);self.assertFalse(scope.site_calls)
            else:
                self.assertEqual(scope.__torch_dispatch__(op,(),args),tuple(out))
                self.assertEqual(events,["weight_bias/before","(False, True, True)","weight_bias/after","midpoint/before",
                    "safe_midpoint/before_reclaim","empty_cache","safe_midpoint/after_reclaim","midpoint/after",
                    "input/before","(True, False, False)","input/after"])
                self.assertEqual(scope.reclaims[native.PHASES[0]],1)
        self.assertFalse(torch.cuda.is_initialized())

    def test_both_safe_midpoints_and_no_cleanup_after_refusal(self):
        for slot in (52,86):
            for failure in (None,"weight_bias/after","safe_midpoint/before_reclaim"):
                with self.subTest(slot=slot,failure=failure):self.check_route(slot,failure)

if __name__=="__main__":unittest.main()

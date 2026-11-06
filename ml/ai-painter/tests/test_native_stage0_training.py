import hashlib
import random
import unittest
from unittest.mock import patch

import torch
from ai_painter.complete_world import native_stage0_training as stage
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as family
import painter_stage4_rock_background_training_profile_v1 as profile


class Stage0RestartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.ids=tuple("train-"+str(i) for i in range(48))
        def make():
            channels=family.parent.FORMAL_CONDITION_CHANNEL_ORDER
            g,d=profile.fresh_networks(channels,model_capability=family.CAPABILITY,geometry=NativeStageGeometry(0))
            g.train();d.eval().requires_grad_(False)
            def decode(sid):
                return {"sampleId":sid,"split":"train","native_stage_geometry":g.native_stage_geometry},{"sampleId":sid,"image":"unit"}
            return stage.Stage0Training((g,d),channels,cls.ids,{"source":"synthetic CPU unit only"},decode,lambda:None)
        cls.make=staticmethod(make)
        m=make()
        for net,opt in ((m.g,m.go),(m.d,m.do)):
            for p in net.parameters():p.grad=torch.full_like(p,1e-7)
            opt.step();opt.zero_grad(set_to_none=True)
        m.counts={"generator":1,"discriminator":1}
        m.history_hash=m.next_hash(m.history_hash,stage.position(cls.ids,0))
        cls.raw=m.save_bytes();cls.sha=hashlib.sha256(cls.raw).hexdigest()

    def test_training_order_matches_existing_epoch_shuffle(self):
        for e in range(1,25):
            ids=list(self.ids);random.Random(20260929+e).shuffle(ids)
            self.assertEqual([stage.position(self.ids,(e-1)*48+i)["sampleId"] for i in range(48)],ids)
        for n in (-1,1152,True):
            with self.assertRaises(ValueError):stage.position(self.ids,n)

    def test_half_updated_or_failed_object_cannot_be_saved_or_reused(self):
        m=self.make();m.counts["discriminator"]=1
        with self.assertRaises(ValueError):m.save_bytes()
        with self.assertRaises(ValueError):m.train_one(lambda:None)
        m=self.make()
        def fail(*args,**kwargs):
            args[6]["discriminator"]+=1
            raise RuntimeError("injected post-D failure")
        with patch.object(profile,"perform_pair",fail),self.assertRaisesRegex(RuntimeError,"post-D"):m.train_one(lambda:None)
        with self.assertRaises(ValueError):m.save_bytes()

    def test_wrong_runtime_bytes_root_cursor_history_and_optimizer_step_rejected(self):
        m=self.make()
        with self.assertRaisesRegex(ValueError,"bytes"):m.restore(self.raw,"0"*64,1)
        with self.assertRaisesRegex(ValueError,"cursor"):m.restore(self.raw,self.sha,2)
        for kind in ("lineage","history","moment"):
            with self.subTest(kind=kind):
                m=self.make()
                data=stage.deserialize_checkpoint(self.raw)
                if kind=="lineage":data["lineage"]["source"]="other dataset or stage"
                elif kind=="history":data["historySha256"]="0"*64
                else:data["optimizers"][1]["state"][0]["step"].fill_(2)
                raw=stage.serialize_checkpoint(data)
                pre=stage.state_fingerprints(stage.rng())
                with self.assertRaises(ValueError):m.restore(raw,hashlib.sha256(raw).hexdigest(),1)
                self.assertEqual(pre,stage.state_fingerprints(stage.rng()))
                if kind=="moment":
                    self.assertFalse(m.healthy)
                    with self.assertRaises(ValueError):m.save_bytes()

    def test_validation_cannot_update(self):
        m=self.make()
        m.decode=lambda sid:({"split":"validation","sampleId":sid,"native_stage_geometry":m.g.native_stage_geometry},{"sampleId":sid})
        with self.assertRaisesRegex(ValueError,"wrong source"):m.train_one(lambda:None)
        self.assertEqual(m.counts,{"generator":0,"discriminator":0})

    def test_cpu_checkpoint_cannot_claim_cuda_rng_or_device_identity(self):
        m=self.make()
        with self.assertRaisesRegex(ValueError,"unsupported target device"):
            m.restore(self.raw,self.sha,1,device=torch.device("cuda:0"))
        m.lineage["executionDevice"]="cuda:0"
        with self.assertRaisesRegex(ValueError,"lineage or cursor"):
            m.restore(self.raw,self.sha,1,device=torch.device("cuda:0"))
        self.assertFalse(torch.cuda.is_initialized())

if __name__=="__main__":unittest.main()

from pathlib import Path
import os
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"ml/ai-painter/scripts"))
import prepare_native_stage0_gate as gate


class Stage0PreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["CUDA_VISIBLE_DEVICES"]=""
        import psutil
        proc=psutil.Process()
        proc.cpu_affinity(proc.cpu_affinity()[:2])
        import torch
        import check_stage4_mvp_structured_object_v18_cpu_acceptance as original
        torch.set_num_threads(2)
        cls.reader=original.BoundReader(ROOT)
        cls.manifest,cls.rows,cls.expected,cls.order,cls.plan=gate.source(cls.reader)
        cls.ready=gate.read(ROOT/gate.CASE/"cpu-ready.json")

    def test_membership_failures_and_fixed_first_case(self):
        ids=self.ready["historicalTrainOrder"]
        self.assertEqual(self.order,[gate.FIRST]+[x for x in ids if x!=gate.FIRST])
        for v in (ids[:-1],ids[:-1]+[ids[0]],["unbound" if x==gate.FIRST else x for x in ids]):
            with self.assertRaises(ValueError):gate.fixed_order(v)
        self.assertTrue(all(r["split"]=="train" for r in self.rows.values()))

    def test_corrected_164_and_train_157_load_actual_expected_tensors(self):
        channels=self.ready["channels"]
        for sid in [gate.FIRST,"mvp64-slot164-objects-v5-20261020"]:
            sample,_=gate.decode(self.reader,self.rows[sid],self.expected[sid],channels,self.manifest["identityPayload"]["continuousChannelIds"])
            self.assertEqual(gate.sample_facts(sample),next(x["input"] for x in self.ready["inputs"] if x["id"]==sid))
            self.assertEqual(sample["native_stage_geometry"].stage,0)
        bad=dict(self.rows[gate.FIRST],split="validation")
        with self.assertRaisesRegex(ValueError,"wrong_split"):gate.decode(self.reader,bad,self.expected[gate.FIRST],channels,[])

    def test_current_fresh_native_state_rejects_old_roots_and_foreign_geometry(self):
        reference=self.reader.json(gate.R113)
        with self.assertRaisesRegex(ValueError,"wrong_model_or_origin"):
            gate.fresh_networks(self.ready["channels"],{**reference,"nativeCapability":"stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1"})
        with self.assertRaisesRegex(ValueError,"wrong_model_or_origin"):
            gate.fresh_networks(self.ready["channels"],{**reference,"stage":2})
        with self.assertRaisesRegex(ValueError,"wrong_model_or_origin"):
            gate.fresh_networks(self.ready["channels"],{**reference,"checkpointLoads":1})
        model,critic,state=gate.fresh_networks(self.ready["channels"],reference)
        self.assertEqual(state,self.ready["state"])
        self.assertEqual([len(list(n.parameters())) for n in (model,critic)],[109,14])
        import torch
        with self.assertRaises((ValueError,RuntimeError,AssertionError)):
            cp=model.state_dict();cp["regime_identity"]=torch.zeros_like(cp["regime_identity"]);model.load_state_dict(cp)
        self.assertFalse(torch.cuda.is_initialized())

    def test_unregistered_or_changed_contract_refuses_worker_before_device(self):
        import torch
        altered={**gate.contract(self.ready),"optimizerUpdates":1}
        with patch.object(gate,"read",side_effect=[self.ready,altered]):
            with self.assertRaisesRegex(ValueError,"formal_contract"):gate.verify_worker()
        self.assertFalse(torch.cuda.is_initialized())
        candidate=gate.read(ROOT/gate.CASE/"contract-candidate.json")
        self.assertEqual(candidate,gate.contract(self.ready))
        for p in candidate["programs"]:gate.check_ref(p)
        self.assertEqual(candidate["limits"]["generatorGradients"],240)

if __name__=="__main__":
    unittest.main()

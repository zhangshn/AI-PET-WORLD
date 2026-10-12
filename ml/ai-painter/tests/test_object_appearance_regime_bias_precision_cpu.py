"""Full architecture synthetic tensors only; no real data or saved checkpoints."""
from copy import deepcopy
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world import object_appearance_regime_bias_precision_cpu as successor
from ai_painter.complete_world.object_appearance_regime_conditioned_cpu import build_fresh_object_appearance_regime_conditioned_cpu as predecessor, seasonal_parameter as old_seasonal, _REGIME
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS,encode_season
from test_object_appearance_regime_conditioned_cpu import ORDER,scene
from test_rgb_bias_reduction_precision_cpu import small_values,same_bytes


class SuccessorModelTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.flags = (torch.are_deterministic_algorithms_enabled(),torch.is_deterministic_algorithms_warn_only_enabled())
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng,torch.random.get_rng_state()))
        self.assertEqual(self.flags,(torch.are_deterministic_algorithms_enabled(),torch.is_deterministic_algorithms_warn_only_enabled()))
        self.assertIsNone(_REGIME.get()); torch.set_num_threads(self.threads)

    def test_all_parameter_initialization_and_four_season_forward_bytes(self):
        old,new = predecessor(condition_channel_order=ORDER).eval(),successor.build_fresh_object_appearance_regime_bias_precision_cpu(condition_channel_order=ORDER).eval()
        op,np = tuple(old.named_parameters()),tuple(new.named_parameters())
        self.assertEqual(len(np),107); self.assertEqual(sum(p.numel() for _,p in np),2240671)
        self.assertTrue(all(n==m and same_bytes(p,q) for (n,p),(m,q) in zip(op,np)))
        self.assertEqual(successor.parameter_initialization_digest(old),successor.parameter_initialization_digest(new))
        self.assertNotEqual(old.capability_version,new.capability_version); self.assertNotEqual(old.architecture_id,new.architecture_id)
        self.assertIn("numeric_identity",new.state_dict()); self.assertNotIn("numeric_identity",dict(new.named_parameters()))
        self.assertFalse(torch.equal(old.regime_identity,new.regime_identity))
        conditions,table = scene(); saved = conditions.clone(); facts = deepcopy(table)
        with torch.no_grad():
            for season in SEASONS:
                expected = old(conditions,table,appearance_regime=encode_season(season))
                actual = new(conditions,table,appearance_regime=encode_season(season))
                self.assertTrue(same_bytes(expected,actual),season)
        self.assertTrue(same_bytes(saved,conditions)); self.assertEqual(table,facts)
        with self.assertRaisesRegex(ValueError,"old model identity"): old_seasonal(new)

    def test_strict_roundtrip_old_missing_wrong_dtype_and_nonfinite_rejection_atomic(self):
        model = successor.build_fresh_object_appearance_regime_bias_precision_cpu(condition_channel_order=ORDER)
        saved = deepcopy(model.state_dict()); model.load_state_dict(saved)
        old = predecessor(condition_channel_order=ORDER).state_dict()
        cases = [old,{k:v for k,v in saved.items() if k != "numeric_identity"}]
        wrong = deepcopy(saved); wrong["numeric_identity"][0] ^= 1; cases.append(wrong)
        wrong = deepcopy(saved); wrong["numeric_identity"] = wrong["numeric_identity"].float(); cases.append(wrong)
        wrong = deepcopy(saved); next(v for v in wrong.values() if v.dtype == torch.float32).reshape(-1)[0] = float("nan"); cases.append(wrong)
        for state in cases:
            with self.assertRaises(ValueError): model.load_state_dict(state)
            self.assertTrue(all(same_bytes(v,model.state_dict()[k]) for k,v in saved.items()))
        for options in ({"strict":False},{"assign":True}):
            with self.assertRaises(ValueError): model.load_state_dict(saved,**options)

    def test_numeric_operator_bias_reference_and_other_vjp_parity(self):
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(20260929); original = torch.nn.Conv2d(48,3,1)
        precision = successor.PrecisionFinalRGBConv(original)
        native = small_values(); other = tuple(v.detach().clone().requires_grad_(True) for v in native)
        original.weight = torch.nn.Parameter(native[1]); original.bias = torch.nn.Parameter(native[2])
        precision.weight = torch.nn.Parameter(other[1]); precision.bias = torch.nn.Parameter(other[2])
        no,po = original(native[0]),precision(other[0]); self.assertTrue(same_bytes(no,po))
        incoming = torch.arange(12,dtype=torch.float32).reshape(1,3,2,2)*0.125
        ng = torch.autograd.grad(no,(native[0],original.weight,original.bias),grad_outputs=incoming)
        pg = torch.autograd.grad(po,(other[0],precision.weight,precision.bias),grad_outputs=incoming)
        self.assertTrue(same_bytes(ng[0],pg[0])); self.assertTrue(same_bytes(ng[1],pg[1]))
        self.assertTrue(same_bytes(pg[2],incoming.double().sum((0,2,3)).float()))

    def test_nonzero_season_branch_four_regime_forward_terrain_support_bytes(self):
        old,new = predecessor(condition_channel_order=ORDER).eval(),successor.build_fresh_object_appearance_regime_bias_precision_cpu(condition_channel_order=ORDER).eval()
        conditions,table = scene(); saved = conditions.clone(); facts = deepcopy(table)
        with torch.no_grad():
            for index in range(4):
                old_seasonal(old)[:,index].fill_((index+1)*0.005)
                successor.seasonal_parameter(new)[:,index].fill_((index+1)*0.005)
            predictions = []
            for season in SEASONS:
                a,ea = old(conditions,table,appearance_regime=encode_season(season),return_evidence=True)
                b,eb = new(conditions,table,appearance_regime=encode_season(season),return_evidence=True)
                self.assertTrue(same_bytes(a,b),season); self.assertTrue(same_bytes(ea["terrainRgb"],eb["terrainRgb"]))
                for role in ea["visibleObjectSupportMasks"]:
                    self.assertTrue(same_bytes(ea["visibleObjectSupportMasks"][role],eb["visibleObjectSupportMasks"][role]))
                predictions.append(b.clone())
            self.assertTrue(any(not same_bytes(predictions[0],value) for value in predictions[1:]))
        self.assertTrue(same_bytes(saved,conditions)); self.assertEqual(table,facts)

    def test_cpu_autocast_higher_order_and_context_exception_restore(self):
        model = successor.build_fresh_object_appearance_regime_bias_precision_cpu(condition_channel_order=ORDER)
        conditions,table = scene()
        with torch.autocast("cpu",dtype=torch.bfloat16):
            with self.assertRaisesRegex(ValueError,"autocast"): model(conditions,table,appearance_regime=encode_season(SEASONS[0]))
        with self.assertRaises(ValueError): model(conditions,[],appearance_regime=encode_season(SEASONS[0]))
        self.assertIsNone(_REGIME.get())
        values = small_values(); output = model.get_submodule(successor.TARGET)(values[0])
        with self.assertRaisesRegex(ValueError,"higher-order"):
            torch.autograd.grad(output.sum(),tuple(model.get_submodule(successor.TARGET).parameters()),create_graph=True)
        with patch.object(torch.cuda,"is_initialized",return_value=True):
            with self.assertRaises(ValueError): successor.validate_model_identity(model)
        with torch.no_grad(): model.numeric_identity[0] ^= 1
        with self.assertRaisesRegex(ValueError,"buffer"): successor.seasonal_parameter(model)


if __name__ == "__main__": unittest.main()

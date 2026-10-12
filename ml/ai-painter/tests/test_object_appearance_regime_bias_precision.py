"""Device model compatibility on artificial tensors only."""
from copy import deepcopy
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world import object_appearance_regime_bias_precision as successor
from ai_painter.complete_world.object_appearance_regime_bias_precision_cpu import (
    build_fresh_object_appearance_regime_bias_precision_cpu as predecessor, seasonal_parameter as old_seasonal)
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS, encode_season
from test_object_appearance_regime_conditioned_cpu import ORDER, scene
from test_rgb_bias_reduction_precision_cpu import same_bytes


class DeviceModelTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertIsNone(successor._REGIME.get()); torch.set_num_threads(self.threads)
        self.assertFalse(torch.cuda.is_initialized())

    def test_parameters_zero_and_nonzero_four_season_forward_bytes(self):
        old = predecessor(condition_channel_order=ORDER).eval()
        new = successor.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER).eval()
        self.assertEqual(successor.parameter_initialization_digest(old), successor.parameter_initialization_digest(new))
        self.assertEqual(len(tuple(new.parameters())), 107)
        self.assertEqual(sum(p.numel() for p in new.parameters()), 2240671)
        self.assertNotEqual(old.architecture_id, new.architecture_id)
        self.assertFalse(torch.equal(old.numeric_identity, new.numeric_identity))
        c, table = scene(); saved = c.clone(); facts = deepcopy(table)
        with torch.no_grad():
            for nonzero in (False, True):
                if nonzero:
                    for i in range(4):
                        old_seasonal(old)[:, i].fill_((i + 1) * .005)
                        successor.seasonal_parameter(new)[:, i].fill_((i + 1) * .005)
                predictions = []
                for season in SEASONS:
                    a, ea = old(c, table, appearance_regime=encode_season(season), return_evidence=True)
                    b, eb = new(c, table, appearance_regime=encode_season(season), return_evidence=True)
                    self.assertTrue(same_bytes(a, b), season)
                    self.assertTrue(same_bytes(ea["terrainRgb"], eb["terrainRgb"]))
                    self.assertTrue(all(same_bytes(v, eb["visibleObjectSupportMasks"][k]) for k, v in ea["visibleObjectSupportMasks"].items()))
                    predictions.append(b)
                if nonzero: self.assertTrue(any(not same_bytes(predictions[0], p) for p in predictions[1:]))
        self.assertTrue(same_bytes(saved, c)); self.assertEqual(facts, table)

    def test_strict_load_atomic_reject_old_missing_identity_shape_dtype_nonfinite(self):
        new = successor.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER)
        saved = deepcopy(new.state_dict()); new.load_state_dict(saved)
        invalid = [predecessor(condition_channel_order=ORDER).state_dict(), {k: v for k, v in saved.items() if k != "numeric_identity"}]
        for name, value in (("numeric_identity", torch.zeros(32, dtype=torch.uint8)),
                            ("numeric_identity", saved["numeric_identity"].float())):
            bad = deepcopy(saved); bad[name] = value; invalid.append(bad)
        key = next(k for k, v in saved.items() if v.dtype == torch.float32)
        for value in (saved[key].double(), torch.zeros(1), torch.full_like(saved[key], float("nan"))):
            bad = deepcopy(saved); bad[key] = value; invalid.append(bad)
        for bad in invalid:
            with self.assertRaises(ValueError): new.load_state_dict(bad)
            self.assertTrue(all(same_bytes(v, new.state_dict()[k]) for k, v in saved.items()))
        for options in ({"strict": False}, {"assign": True}):
            with self.assertRaises(ValueError): new.load_state_dict(saved, **options)

    def test_factory_and_cpu_load_after_managed_cuda_initialization_no_cuda_calls(self):
        with patch.object(torch.cuda, "is_initialized", return_value=True), patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("factory touched CUDA")), \
             patch.object(torch.cuda, "manual_seed_all", side_effect=AssertionError("CPU factory seeded CUDA")):
            new = successor.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER)
            self.assertTrue(all(p.device.type == "cpu" for p in new.parameters()))
            new.load_state_dict(deepcopy(new.state_dict()))

    def test_context_nested_and_exception_restore_and_missing_season(self):
        new = successor.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER)
        c, table = scene(); outer = encode_season(SEASONS[3]); token = successor._REGIME.set(outer)
        try:
            with torch.no_grad(): new(c, table, appearance_regime=encode_season(SEASONS[0]))
            self.assertIs(successor._REGIME.get(), outer)
            with self.assertRaises(ValueError): new(c, [], appearance_regime=encode_season(SEASONS[1]))
            self.assertIs(successor._REGIME.get(), outer)
        finally: successor._REGIME.reset(token)
        with self.assertRaises(TypeError): new(c, table)
        with torch.autocast("cpu", dtype=torch.bfloat16):
            with self.assertRaisesRegex(ValueError, "autocast"): new(c, table, appearance_regime=encode_season(SEASONS[0]))


if __name__ == "__main__": unittest.main()

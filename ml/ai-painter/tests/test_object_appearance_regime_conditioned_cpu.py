"""Synthetic-only model boundaries; no project sample access."""
from copy import deepcopy
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world.object_appearance_regime_input_cpu import SEASONS, encode_season, validate_regime
from ai_painter.complete_world.object_appearance_regime_conditioned_cpu import (
    build_fresh_object_appearance_regime_conditioned_cpu as build, seasonal_parameter, _REGIME)
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import build_fresh_native_rgb_complete_support_partition_v23_cpu as baseline, ROLES
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import _validate_model_and_parameters

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())

def scene():
    conditions = torch.zeros(1, 23, 192, 256)
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("walkable")] = 1
    conditions[:, ORDER.index("coordinate_x")] = torch.arange(256)[None, None, None, :] / 255
    conditions[:, ORDER.index("coordinate_y")] = torch.arange(192)[None, None, :, None] / 191
    table = []
    for value, (x, y, kind, role) in enumerate(((40, 40, "tree", "object_tree"),
            (100, 70, "rock", "object_rock"), (160, 120, "shrub", "object_vegetation")), 1):
        for channel in (role, "object_footprints", "collision"):
            conditions[:, ORDER.index(channel), y:y+4, x:x+4] = 1
        conditions[:, ORDER.index("walkable"), y:y+4, x:x+4] = 0
        conditions[:, ORDER.index("object_instance"), y:y+4, x:x+4] = value / 255
        table.append({"value": value, "kind": kind, "footprint": {"x": x*4, "y": y*4, "width": 16, "height": 16}})
    return conditions, table

class RegimeModelTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads()
        torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()

    def tearDown(self):
        torch.random.set_rng_state(self.rng)
        torch.set_num_threads(self.threads)

    def test_encoding_and_rejections(self):
        for index, season in enumerate(SEASONS):
            self.assertTrue(torch.equal(encode_season(season), torch.eye(4)[index]))
        for value in (None, "spring", "", 0):
            with self.assertRaises(ValueError): encode_season(value)
        for value in (torch.zeros(4), torch.ones(4), torch.eye(4), torch.eye(4)[0].double(), torch.eye(4)[0].requires_grad_()):
            with self.assertRaises(ValueError): validate_regime(value)

    def test_fresh_graph_rng_all_regimes_baseline_byte_equality(self):
        rng = torch.random.get_rng_state().clone()
        old, new = baseline(condition_channel_order=ORDER).eval(), build(condition_channel_order=ORDER).eval()
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        old_state, new_state = old.state_dict(), new.state_dict()
        for key in old_state: self.assertTrue(torch.equal(old_state[key], new_state[key]), key)
        self.assertEqual(sum(p.numel() for p in new.parameters()) - sum(p.numel() for p in old.parameters()), 1152)
        params, groups = _validate_model_and_parameters(new, tuple(new.parameters()))
        self.assertEqual(set(groups), set(ROLES))
        self.assertNotIn(id(seasonal_parameter(new)), {id(params[i]) for group in groups.values() for i in group})
        self.assertEqual(len(tuple(new.named_parameters(remove_duplicate=False))), len(params))
        c, table = scene(); saved, facts = c.clone(), deepcopy(table)
        captures = []
        hook = new.core.core.appearance.register_forward_pre_hook(lambda module, args: captures.append(args[1].detach().clone()))
        flags = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
        try:
            with torch.no_grad():
                expected = old(c, table)
                for season in SEASONS:
                    actual = new(c, table, appearance_regime=encode_season(season))
                    self.assertTrue(torch.equal(actual, expected), season)
        finally: hook.remove()
        self.assertTrue(captures and all(bool(value.count_nonzero()) for value in captures))
        self.assertTrue(torch.equal(saved, c)); self.assertEqual(facts, table)
        self.assertEqual(flags, (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled()))
        self.assertIsNone(_REGIME.get()); self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))

    def test_controlled_response_terrain_support_and_repeat(self):
        model = build(condition_channel_order=ORDER).eval(); c, table = scene()
        with torch.no_grad():
            seasonal_parameter(model)[:, 0].fill_(0.02)
            a, ea = model(c, table, appearance_regime=encode_season(SEASONS[0]), return_evidence=True)
            b, eb = model(c, table, appearance_regime=encode_season(SEASONS[1]), return_evidence=True)
            repeat = model(c, table, appearance_regime=encode_season(SEASONS[0]))
        self.assertTrue(torch.equal(a, repeat)); self.assertFalse(torch.equal(a, b))
        self.assertTrue(torch.equal(ea["terrainRgb"], eb["terrainRgb"]))
        outside = torch.ones(1, 1, 192, 256, dtype=torch.bool)
        for role in ROLES:
            self.assertTrue(torch.equal(ea["visibleObjectSupportMasks"][role], eb["visibleObjectSupportMasks"][role]))
            outside &= ~ea["visibleObjectSupportMasks"][role]
        self.assertTrue(torch.equal(a[outside.expand_as(a)], b[outside.expand_as(b)]))

    def test_private_global_xy_zero_local_xy_and_full_terrain_retained(self):
        model = build(condition_channel_order=ORDER).eval(); c, table = scene(); saved = c.clone()
        inputs = []
        hook = model.core.core.appearance.base.layers[0].register_forward_pre_hook(
            lambda module, args: inputs.append(args[0].detach().clone()))
        try:
            with torch.no_grad(): model(c, table, appearance_regime=encode_season(SEASONS[0]))
        finally: hook.remove()
        features = inputs[0]
        for channel in ("coordinate_x", "coordinate_y"):
            self.assertEqual(int(features[:, ORDER.index(channel)].count_nonzero()), 0)
        self.assertGreater(int(features[:, 24:26].count_nonzero()), 0)
        self.assertGreater(int(features[:, 26:74].count_nonzero()), 0)
        self.assertTrue(torch.equal(c, saved))

    def test_invalid_instance_exception_restoration_and_old_state_rejection(self):
        model = build(condition_channel_order=ORDER); c, table = scene()
        saved = deepcopy(model.state_dict())
        with self.assertRaises(ValueError): model(c, [], appearance_regime=encode_season(SEASONS[0]))
        self.assertIsNone(_REGIME.get())
        with self.assertRaises(ValueError): model.load_state_dict(baseline(condition_channel_order=ORDER).state_dict())
        with self.assertRaises(ValueError): model.load_state_dict(saved, strict=False)
        model.load_state_dict(saved)
        self.assertTrue(all(torch.equal(value, model.state_dict()[key]) for key, value in saved.items()))

if __name__ == "__main__": unittest.main()

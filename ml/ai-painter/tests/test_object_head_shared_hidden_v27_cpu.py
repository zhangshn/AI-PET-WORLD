"""Synthetic-only V27 structure and fact boundaries; no dataset access."""
from copy import deepcopy
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import (
    ROLES, CAPABILITY, CONTEXT_RULE, build_fresh_object_head_shared_hidden_v27_cpu,
)
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    build_fresh_native_rgb_complete_support_partition_v23_cpu,
)
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import bind_parameter_groups

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())


def scene(objects=((40, 40, 7, "tree"), (100, 70, 13, "rock"), (160, 120, 21, "shrub"))):
    conditions = torch.zeros(1, 23, 192, 256)
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("walkable")] = 1
    conditions[:, ORDER.index("coordinate_x")] = torch.arange(256)[None, None, None, :] / 255
    conditions[:, ORDER.index("coordinate_y")] = torch.arange(192)[None, None, :, None] / 191
    table = []
    for x, y, value, kind in objects:
        role = {"tree": "object_tree", "rock": "object_rock", "shrub": "object_vegetation"}[kind]
        for channel in (role, "object_footprints", "collision"):
            conditions[:, ORDER.index(channel), y:y+4, x:x+4] = 1
        conditions[:, ORDER.index("walkable"), y:y+4, x:x+4] = 0
        conditions[:, ORDER.index("object_instance"), y:y+4, x:x+4] = value / 255
        table.append({"value": value, "kind": kind, "footprint":
            {"x": x*4, "y": y*4, "width": 16, "height": 16}})
    return conditions, table


class SharedHiddenV27Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.baseline = build_fresh_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=ORDER).eval()
        cls.model = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=ORDER).eval()

    def test_actual_parameter_identity_initial_bytes_and_rng(self):
        rng = torch.random.get_rng_state().clone()
        with patch.object(torch, "load", side_effect=AssertionError("historical load")):
            model = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=ORDER)
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertEqual(model.capability_version, CAPABILITY)
        self.assertFalse(model.execution_qualified)
        self.assertFalse(model.parent_checkpoint_loaded)
        params, groups = bind_parameter_groups(model)
        self.assertEqual((sum(p.numel() for p in params), len(params)), (2236015, 100))
        selected = [params[i] for indexes in groups.values() for i in indexes]
        self.assertEqual((sum(p.numel() for p in selected), len(selected)), (1372, 10))
        self.assertEqual(len({id(p) for p in selected}), 10)
        self.assertEqual(model.object_context_rule, CONTEXT_RULE)
        self.assertFalse(hasattr(model, "object_rgb_heads"))
        for name, value in self.baseline.core.state_dict().items():
            self.assertTrue(torch.equal(value, model.core.state_dict()[name]), name)
        self.assertTrue(torch.equal(model.object_shared_hidden[0].weight,
                                   self.baseline.object_rgb_heads[ROLES[0]][0].weight))
        self.assertTrue(torch.equal(model.object_shared_hidden[0].bias,
                                   self.baseline.object_rgb_heads[ROLES[0]][0].bias))
        for role in ROLES:
            for name, value in model.object_rgb_adapters[role].state_dict().items():
                self.assertTrue(torch.equal(value, self.baseline.object_rgb_heads[role][2].state_dict()[name]))

    def test_context_evidence_masks_outside_and_determinism(self):
        conditions, table = scene()
        source, facts = conditions.clone(), deepcopy(table)
        captured = []
        def capture(_module, args):
            captured.append(args[1].detach().clone())
        handle = self.model.core.core.appearance.register_forward_pre_hook(capture)
        try:
            with torch.no_grad():
                old, before = self.baseline(conditions, table, return_evidence=True)
                new, after = self.model(conditions, table, return_evidence=True)
                again = self.model(conditions, table)
        finally:
            handle.remove()
        self.assertTrue(torch.equal(new, again))
        self.assertTrue(torch.equal(before["terrainRgb"], after["terrainRgb"]))
        self.assertTrue(captured and all(v.shape[1] == 48 and bool(v.count_nonzero()) for v in captured))
        outside = torch.ones(1, 1, 192, 256, dtype=torch.bool)
        for role in ROLES:
            self.assertTrue(torch.equal(before["responsibilityFeatures"][role], after["responsibilityFeatures"][role]))
            self.assertTrue(torch.equal(before["visibleObjectSupportMasks"][role], after["visibleObjectSupportMasks"][role]))
            outside &= ~after["visibleObjectSupportMasks"][role]
            self.assertEqual(after["responsibilityFeatures"][role].shape[1], 8)
            self.assertEqual(int(after["maskedObjectRgbResiduals"][role].masked_select(
                ~after["visibleObjectSupportMasks"][role].expand_as(new)).count_nonzero()), 0)
        self.assertTrue(torch.equal(old[outside.expand_as(old)], new[outside.expand_as(new)]))
        self.assertFalse(torch.equal(old, new))
        self.assertTrue(torch.equal(source, conditions))
        self.assertEqual(facts, table)

    def test_role_removal_and_adapter_counterfactuals(self):
        conditions, table = scene()
        with torch.no_grad():
            original, before = self.model(conditions, table, return_evidence=True)
            for role in ROLES:
                adapter = self.model.object_rgb_adapters[role]
                saved = adapter.bias.clone()
                try:
                    adapter.bias.add_(.5)
                    changed, after = self.model(conditions, table, return_evidence=True)
                finally:
                    adapter.bias.copy_(saved)
                mask = before["visibleObjectSupportMasks"][role].expand_as(original)
                self.assertGreater(int((original[mask] != changed[mask]).count_nonzero()), 0)
                self.assertTrue(torch.equal(original[~mask], changed[~mask]))
                for other in ROLES:
                    if other != role:
                        self.assertTrue(torch.equal(before["maskedObjectRgbResiduals"][other], after["maskedObjectRgbResiduals"][other]))
            for omitted, role in enumerate(ROLES[1:]):
                objs = ((40, 40, 7, "tree"), (100, 70, 13, "rock"), (160, 120, 21, "shrub"))
                bound, rows = scene(tuple(o for i, o in enumerate(objs) if i != omitted))
                _, evidence = self.model(bound, rows, return_evidence=True)
                self.assertEqual(int(evidence["visibleObjectSupportMasks"][role].count_nonzero()), 0)
                self.assertEqual(int(evidence["maskedObjectRgbResiduals"][role].count_nonzero()), 0)
            blank, rows = scene(())
            _, evidence = self.model(blank, rows, return_evidence=True)
            self.assertTrue(all(not bool(v.count_nonzero()) for v in evidence["maskedObjectRgbResiduals"].values()))

    def test_invalid_instance_and_backend_exception_restoration(self):
        conditions, table = scene()
        corrupted = deepcopy(table); corrupted[0]["kind"] = "rock"
        flags = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
        with self.assertRaises(ValueError):
            self.model(conditions, corrupted)
        from ai_painter.complete_world.object_feature_aggregation_v26_v2_cpu import deterministic_index_add_backend
        with self.assertRaisesRegex(RuntimeError, "injected"):
            with deterministic_index_add_backend():
                with deterministic_index_add_backend():
                    raise RuntimeError("injected")
        self.assertEqual(flags, (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled()))
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

"""CPU-only V22 instance-first RGB structure, support and gradient controls."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import time
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world.native_rgb_instance_first_v22_cpu import (
    ARCHITECTURE, CAPABILITY, MAX_EXTRA_PARAMETERS, MAX_TOTAL_PARAMETER_BYTES,
    ROLES, SEED, build_fresh_native_rgb_instance_first_v22_cpu,
    build_native_rgb_instance_first_v22_cpu,
)
from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
    build_native_rgb_object_residual_v21_cpu,
)
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
    build_native_rgb_structured_object_v18_cpu,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    train_structured_object_objective,
)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    build_conditional_texture_discriminator,
)
from ai_painter.complete_world.split_training import state_hash


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                    .read_text(encoding="utf8"))["tensorContract"]["channelOrder"])
OBJECTS = ((40, 40, 7, "tree"), (100, 70, 13, "rock"), (160, 120, 21, "shrub"))


def scene(objects=OBJECTS):
    conditions = torch.zeros((1, 23, 192, 256))
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("walkable")] = 1
    conditions[:, ORDER.index("coordinate_x")] = torch.arange(256)[None, None, None, :] / 255
    conditions[:, ORDER.index("coordinate_y")] = torch.arange(192)[None, None, :, None] / 191
    table = []
    for x, y, value, kind in objects:
        role = {"tree": "object_tree", "rock": "object_rock", "shrub": "object_vegetation"}[kind]
        for channel in (role, "object_footprints", "collision"):
            conditions[:, ORDER.index(channel), y:y + 4, x:x + 4] = 1
        conditions[:, ORDER.index("walkable"), y:y + 4, x:x + 4] = 0
        conditions[:, ORDER.index("object_instance"), y:y + 4, x:x + 4] = value / 255
        table.append({"value": value, "kind": kind,
                      "footprint": {"x": x * 4, "y": y * 4, "width": 16, "height": 16}})
    return conditions, table


class V22InstanceFirstCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(SEED)
            cls.model = build_native_rgb_instance_first_v22_cpu(
                condition_channel_order=ORDER, base_channels=32, patch_channels=16)

    def test_fresh_model_identity_and_resource_ceiling_without_old_weight_load(self):
        with patch.object(torch, "load", side_effect=AssertionError("old checkpoint loaded")):
            first = build_fresh_native_rgb_instance_first_v22_cpu(condition_channel_order=ORDER)
            second = build_fresh_native_rgb_instance_first_v22_cpu(condition_channel_order=ORDER)
        baseline = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=48, patch_channels=32)
        count = lambda model: sum(parameter.numel() for parameter in model.parameters())
        total_bytes = sum(p.numel() * p.element_size() for p in first.parameters())
        self.assertEqual(state_hash(first.state_dict()), state_hash(second.state_dict()))
        self.assertEqual(first.architecture_id, ARCHITECTURE)
        self.assertEqual(first.capability_version, CAPABILITY)
        self.assertEqual(SEED, 20260930)
        self.assertFalse(first.parent_checkpoint_loaded)
        self.assertFalse(first.execution_qualified)
        self.assertLessEqual(count(first) - count(baseline), MAX_EXTRA_PARAMETERS)
        self.assertLessEqual(total_bytes, MAX_TOTAL_PARAMETER_BYTES)
        self.assertFalse(torch.cuda.is_initialized())

    def test_complete_conditions_bound_instances_and_masked_residuals(self):
        conditions, table = scene()
        before, table_before = conditions.clone(), deepcopy(table)
        start = time.monotonic()
        with torch.no_grad(), patch.object(torch, "load", side_effect=AssertionError("old weights")):
            rgb, evidence = self.model(conditions, table, return_evidence=True)
        self.assertLess(time.monotonic() - start, 30)
        self.assertEqual(tuple(rgb.shape), (1, 3, 192, 256))
        self.assertTrue(bool(torch.isfinite(rgb).all() and ((rgb >= 0) & (rgb <= 1)).all()))
        self.assertTrue(torch.equal(conditions, before))
        self.assertEqual(table, table_before)
        self.assertEqual(evidence["aggregationOrder"],
                         "per_instance_rgb_before_role_average_and_visibility")
        self.assertEqual(len(evidence["instanceRgbResiduals"]), 3)
        for item in evidence["instanceRgbResiduals"]:
            for local in item["localRgbResiduals"].values():
                self.assertEqual(tuple(local.shape), (1, 3, 32, 32))
                self.assertTrue(bool(torch.isfinite(local).all()))
        for role in ROLES:
            mask = evidence["visibleObjectSupportMasks"][role]
            residual = evidence["maskedObjectRgbResiduals"][role]
            self.assertEqual(float(residual[~mask.expand_as(residual)].abs().sum()), 0)
            self.assertGreater(float(residual[mask.expand_as(residual)].abs().sum()), 0)
        self.assertFalse(torch.cuda.is_initialized())

    def test_instance_rgb_is_decoded_before_same_role_overlap_average(self):
        conditions, table = scene(((40, 40, 7, "tree"), (46, 40, 13, "tree")))
        with torch.no_grad():
            _, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(len(evidence["instanceRgbResiduals"]), 2)
        y, x = 42, 45  # The two tree support rings overlap here.
        local = []
        for item in evidence["instanceRgbResiduals"]:
            view = item["view"]
            ly, lx = y - view.top, x - view.left
            self.assertEqual(float(view.support_mask[0, ly, lx]), 1)
            local.append(item["localRgbResiduals"]["object_tree"][0, :, ly, lx])
        expected = torch.stack(local).mean(0)
        observed = evidence["maskedObjectRgbResiduals"]["object_tree"][0, :, y, x]
        self.assertTrue(torch.allclose(observed, expected, atol=1e-7, rtol=0))
        self.assertTrue(bool(evidence["roleCoverage"]["object_tree"][0, 0, y, x] == 2))
        # The V21 order would average eight-channel features before this head.
        patches = []
        for item in evidence["instanceRgbResiduals"]:
            view = item["view"]
            patches.append(item["localFeature"][:, :,
                y - view.top - 1:y - view.top + 2,
                x - view.left - 1:x - view.left + 2])
        with torch.no_grad():
            post_aggregation = torch.tanh(self.model.instance_rgb_heads["object_tree"](
                torch.stack(patches).mean(0)))[0, :, 1, 1]
        self.assertGreater(float((observed - post_aggregation).abs().max()), 1e-8)

    def test_no_go_isolated_objects_are_equivalent_to_v21(self):
        """The proposed order change cannot fix isolated-object appearance."""
        old = build_native_rgb_object_residual_v21_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)
        original = old.core.core
        original.terrain.load_state_dict(self.model.terrain.state_dict())
        original.appearance.load_state_dict(self.model.appearance.state_dict())
        original.footprint_head.load_state_dict(self.model.footprint_head.state_dict())
        original.final_rgb_decoder.base.load_state_dict(
            self.model.terrain_rgb_decoder.state_dict())
        old.object_rgb_heads.load_state_dict(self.model.instance_rgb_heads.state_dict())
        old.eval()
        self.model.eval()
        conditions, table = scene()  # Three well-separated real object roles.
        with torch.no_grad():
            before = old(conditions, table)
            after = self.model(conditions, table)
        self.assertLessEqual(float((before - after).abs().max()), 1e-6)

    def test_empty_objects_leave_terrain_rgb_and_remote_pixels_unchanged(self):
        empty, no_table = scene(())
        occupied, table = scene()
        with torch.no_grad():
            empty_rgb, zero = self.model(empty, no_table, return_evidence=True)
            occupied_rgb, full = self.model(occupied, table, return_evidence=True)
        self.assertEqual(len(zero["instanceRgbResiduals"]), 0)
        self.assertEqual(float(zero["objectResidualSum"].abs().sum()), 0)
        self.assertTrue(torch.allclose(empty_rgb, zero["terrainRgb"], atol=1e-6))
        self.assertTrue(torch.equal(zero["terrainRgb"], full["terrainRgb"]))
        outside = ~full["objectCoverage"].expand_as(empty_rgb)
        self.assertTrue(torch.equal(empty_rgb[outside], occupied_rgb[outside]))

    def test_cross_class_overlap_preserves_cores_and_excludes_shared_ring(self):
        conditions, table = scene(((40, 40, 7, "tree"), (48, 40, 13, "rock")))
        with torch.no_grad():
            _, evidence = self.model(conditions, table, return_evidence=True)
        tree = evidence["visibleObjectSupportMasks"]["object_tree"]
        rock = evidence["visibleObjectSupportMasks"]["object_rock"]
        tree_core = conditions[:, ORDER.index("object_tree"):ORDER.index("object_tree") + 1].bool()
        rock_core = conditions[:, ORDER.index("object_rock"):ORDER.index("object_rock") + 1].bool()
        self.assertTrue(bool(tree[tree_core].all() and rock[rock_core].all()))
        self.assertFalse(bool((tree & rock).any()))
        for role in ("object_tree", "object_rock"):
            mask = evidence["visibleObjectSupportMasks"][role]
            residual = evidence["maskedObjectRgbResiduals"][role]
            self.assertEqual(float(residual[~mask.expand_as(residual)].abs().sum()), 0)

    def test_existing_train_objective_reaches_four_local_rgb_heads(self):
        conditions, table = scene()
        sample = {"sampleId": "synthetic-train-only", "split": "train",
                  "conditions": conditions[0], "image": torch.rand((3, 192, 256)),
                  "objectInstanceTable": table}
        critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
        self.model.zero_grad(set_to_none=True)
        predicted = self.model(conditions, table)
        loss, _ = train_structured_object_objective(critic, predicted, sample, table, ORDER)
        self.assertTrue(bool(torch.isfinite(loss)))
        loss.backward()
        for role in ROLES:
            gradient = self.model.instance_rgb_heads[role][-1].weight.grad
            self.assertIsNotNone(gradient, role)
            self.assertTrue(bool(torch.isfinite(gradient).all()), role)
            self.assertGreater(float(gradient.abs().sum()), 0, role)
        appearance = self.model.appearance.base.layers[-1].weight.grad
        self.assertIsNotNone(appearance)
        self.assertGreater(float(appearance.abs().sum()), 0)
        self.assertTrue(all(parameter.grad is None for parameter in critic.parameters()))

    def test_wrong_table_or_missing_channel_fails_before_inference(self):
        conditions, table = scene()
        foreign = deepcopy(table)
        foreign[0]["value"] = 99
        with self.assertRaises(ValueError):
            self.model(conditions, foreign)
        with self.assertRaises(ValueError):
            build_native_rgb_instance_first_v22_cpu(condition_channel_order=ORDER[:-1])


if __name__ == "__main__": unittest.main()

"""CPU-only V21 shape, responsibility, locality, gradient and resource controls."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import time
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
    ARCHITECTURE, CAPABILITY, MAX_EXTRA_PARAMETERS, MAX_TOTAL_PARAMETER_BYTES,
    ROLES, SEED, build_fresh_native_rgb_object_residual_v21_cpu,
    build_native_rgb_object_residual_v21_cpu,
)
from ai_painter.complete_world.object_instance_supervision_cpu import SUPPORT_RADIUS
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
    build_native_rgb_structured_object_v18_cpu,
)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    build_conditional_texture_discriminator,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    train_structured_object_objective,
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
            conditions[:, ORDER.index(channel), y:y+4, x:x+4] = 1
        conditions[:, ORDER.index("walkable"), y:y+4, x:x+4] = 0
        conditions[:, ORDER.index("object_instance"), y:y+4, x:x+4] = value / 255
        table.append({"value": value, "kind": kind,
                      "footprint": {"x": x*4, "y": y*4, "width": 16, "height": 16}})
    return conditions, table


class NativeRgbObjectResidualV21CpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.model = build_native_rgb_object_residual_v21_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)

    def test_fresh_identity_and_parameter_resource_ceiling(self):
        with patch.object(torch, "load", side_effect=AssertionError("failed checkpoint load")):
            first = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=ORDER)
            second = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=ORDER)
        baseline = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=48, patch_channels=32)
        count = lambda model: sum(value.numel() for value in model.parameters())
        total_bytes = sum(value.numel() * value.element_size() for value in first.parameters())
        self.assertEqual(state_hash(first.state_dict()), state_hash(second.state_dict()))
        self.assertEqual(first.architecture_id, ARCHITECTURE)
        self.assertEqual(first.capability_version, CAPABILITY)
        self.assertEqual(CAPABILITY, "stage4_mvp_native_rgb_object_residual_v21_support_trial")
        self.assertFalse(first.execution_qualified)
        self.assertFalse(first.parent_checkpoint_loaded)
        self.assertEqual(SEED, 20260929)
        self.assertLessEqual(count(first) - count(baseline), MAX_EXTRA_PARAMETERS)
        self.assertLessEqual(total_bytes, MAX_TOTAL_PARAMETER_BYTES)
        self.assertFalse(torch.cuda.is_initialized())

    def test_four_role_masked_residuals_and_independent_local_effect(self):
        conditions, table = scene()
        before, table_before = conditions.clone(), deepcopy(table)
        self.model.eval()
        start = time.monotonic()
        with torch.no_grad():
            full, evidence = self.model(conditions, table, return_evidence=True)
        self.assertLess(time.monotonic() - start, 30)
        self.assertEqual(tuple(full.shape), (1, 3, 192, 256))
        self.assertTrue(bool(torch.isfinite(full).all() and ((full >= 0) & (full <= 1)).all()))
        self.assertEqual(set(evidence["maskedObjectRgbResiduals"]), set(ROLES))
        self.assertTrue(torch.equal(before, conditions))
        self.assertEqual(table_before, table)
        self.assertFalse(torch.cuda.is_initialized())
        for role in ROLES:
            mask = evidence["visibleObjectSupportMasks"][role]
            residual = evidence["maskedObjectRgbResiduals"][role]
            self.assertTrue(torch.equal(residual[~mask.expand_as(residual)],
                                        torch.zeros_like(residual[~mask.expand_as(residual)])))
            self.assertGreater(float(residual[:, :, mask[0, 0]].abs().sum()), 0)
            head = self.model.object_rgb_heads[role]
            with torch.no_grad(), patch.object(head, "forward", side_effect=lambda value:
                                                torch.zeros((1, 3, 192, 256), dtype=value.dtype)):
                removed = self.model(conditions, table)
            affected = mask.expand_as(full)
            self.assertTrue(torch.equal(full[~affected], removed[~affected]), role)
            self.assertGreater(float((full[affected] - removed[affected]).abs().max()), 1e-7, role)

    def test_zero_objects_has_zero_residual_and_same_terrain_rgb(self):
        empty, no_table = scene(())
        occupied, table = scene()
        with torch.no_grad():
            no_objects, zero_evidence = self.model(empty, no_table, return_evidence=True)
            with_objects, evidence = self.model(occupied, table, return_evidence=True)
        self.assertTrue(torch.equal(zero_evidence["objectResidualSum"],
                                    torch.zeros_like(zero_evidence["objectResidualSum"])))
        self.assertTrue(torch.allclose(no_objects, zero_evidence["terrainRgb"], atol=1e-6))
        self.assertTrue(torch.equal(zero_evidence["terrainRgb"], evidence["terrainRgb"]))
        support = evidence["objectCoverage"] > 0
        self.assertTrue(torch.equal(no_objects[~support.expand_as(no_objects)],
                                    with_objects[~support.expand_as(with_objects)]))
        self.assertGreater(float((no_objects - with_objects).abs().max()), 1e-7)

    def test_bound_support_rings_respond_without_cross_class_or_object_pollution(self):
        from torch.nn import functional as F
        occupied, table = scene()
        with torch.no_grad():
            _, evidence = self.model(occupied, table, return_evidence=True)
        visible = evidence["visibleObjectSupportMasks"]
        footprint = occupied[:, ORDER.index("object_footprints"):ORDER.index("object_footprints")+1].bool()
        self.assertTrue(torch.equal(visible["object_footprints"], footprint))
        for role in ROLES[1:]:
            core = occupied[:, ORDER.index(role):ORDER.index(role)+1].bool()
            ring = visible[role] & ~core
            self.assertGreater(int(ring.sum()), 0, role)
            radius = SUPPORT_RADIUS[role]
            expected = F.max_pool2d(core.float(), 2 * radius + 1,
                                    stride=1, padding=radius).bool()
            self.assertTrue(torch.equal(visible[role], expected), role)
            self.assertGreater(float(evidence["maskedObjectRgbResiduals"][role]
                                     [ring.expand(1, 3, 192, 256)].abs().sum()), 0, role)
        for index, role in enumerate(ROLES[1:]):
            for other in ROLES[index+2:]:
                self.assertFalse(bool((visible[role] & visible[other]).any()), (role, other))
        tree_only, tree_table = scene((OBJECTS[0],))
        with torch.no_grad():
            _, one = self.model(tree_only, tree_table, return_evidence=True)
        self.assertTrue(torch.allclose(one["maskedObjectRgbResiduals"]["object_tree"],
                                       evidence["maskedObjectRgbResiduals"]["object_tree"],
                                       atol=1e-6, rtol=0))
        two_trees, two_table = scene((OBJECTS[0], (170, 130, 29, "tree")))
        with torch.no_grad():
            _, twice = self.model(two_trees, two_table, return_evidence=True)
        first_region = one["visibleObjectSupportMasks"]["object_tree"]
        self.assertTrue(torch.allclose(
            one["maskedObjectRgbResiduals"]["object_tree"][first_region.expand(1, 3, 192, 256)],
            twice["maskedObjectRgbResiduals"]["object_tree"][first_region.expand(1, 3, 192, 256)],
            atol=1e-6, rtol=0))

    def test_overlapping_class_support_keeps_owned_cores_and_excludes_shared_ring(self):
        nearby, table = scene(((40, 40, 7, "tree"), (48, 40, 13, "rock")))
        with torch.no_grad():
            _, evidence = self.model(nearby, table, return_evidence=True)
        tree = evidence["visibleObjectSupportMasks"]["object_tree"]
        rock = evidence["visibleObjectSupportMasks"]["object_rock"]
        tree_core = nearby[:, ORDER.index("object_tree"):ORDER.index("object_tree")+1].bool()
        rock_core = nearby[:, ORDER.index("object_rock"):ORDER.index("object_rock")+1].bool()
        self.assertTrue(bool(tree[tree_core].all() and rock[rock_core].all()))
        self.assertFalse(bool((tree & rock).any()))
        for role in ("object_tree", "object_rock"):
            mask = evidence["visibleObjectSupportMasks"][role]
            residual = evidence["maskedObjectRgbResiduals"][role]
            self.assertEqual(float(residual[~mask.expand_as(residual)].abs().sum()), 0)

    def test_existing_train_objective_reaches_all_heads_and_appearance(self):
        conditions, table = scene()
        target = torch.rand((3, 192, 256))
        sample = {"sampleId": "synthetic-train-only", "split": "train",
                  "conditions": conditions[0], "image": target,
                  "objectInstanceTable": table}
        critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
        self.model.zero_grad(set_to_none=True)
        predicted = self.model(conditions, table)
        loss, _ = train_structured_object_objective(critic, predicted, sample, table, ORDER)
        self.assertTrue(bool(torch.isfinite(loss)))
        loss.backward()
        for role in ROLES:
            gradient = self.model.object_rgb_heads[role][-1].weight.grad
            self.assertIsNotNone(gradient, role)
            self.assertTrue(bool(torch.isfinite(gradient).all()), role)
            self.assertGreater(float(gradient.abs().sum()), 0, role)
        appearance = self.model.core.core.appearance.base.layers[-1].weight.grad
        self.assertIsNotNone(appearance)
        self.assertGreater(float(appearance.abs().sum()), 0)
        self.assertTrue(all(parameter.grad is None for parameter in critic.parameters()))


if __name__ == "__main__":
    unittest.main()

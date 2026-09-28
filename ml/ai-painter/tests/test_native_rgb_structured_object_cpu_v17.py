"""CPU-only structural tests; no training or visual qualification."""

import json
from pathlib import Path
import unittest
from unittest.mock import patch

import torch
from torch.nn import functional as functional

from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import (
    build_native_rgb_structured_object_cpu_v17,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (
    train_original_instance_objective,
)
from ai_painter.complete_world.object_instance_supervision_cpu import load_bound_object_sample
from ai_painter.complete_world.split_release import SplitReleaseDataset


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                         .read_text(encoding="utf-8"))["tensorContract"]["channelOrder"])


def scene(objects=()):
    conditions = torch.zeros((1, 23, 192, 256))
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("coordinate_x")] = torch.arange(256)[None, None, None, :] / 256
    conditions[:, ORDER.index("coordinate_y")] = torch.arange(192)[None, None, :, None] / 192
    # Model an object-dependent global condition change, not just object mask edits.
    conditions[:, ORDER.index("walkable")] = 1
    table = []
    for x, y, label, kind in objects:
        role = {"tree": "object_tree", "rock": "object_rock",
                "shrub": "object_vegetation", "grass_detail": "object_vegetation"}[kind]
        for channel in (role, "object_footprints", "collision"):
            conditions[:, ORDER.index(channel), y:y+4, x:x+4] = 1
        conditions[:, ORDER.index("walkable"), y:y+4, x:x+4] = 0
        conditions[:, ORDER.index("object_instance"), y:y+4, x:x+4] = label / 255
        table.append({"value": label, "kind": kind,
                      "footprint": {"x": x*4, "y": y*4, "width": 16, "height": 16}})
    return conditions, table


class StructuredObjectCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)
        torch.manual_seed(23)
        cls.model = build_native_rgb_structured_object_cpu_v17(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16).eval()

    def test_add_remove_and_move_change_only_declared_support(self):
        empty, no_objects = scene()
        first, first_table = scene(((40, 40, 7, "tree"),))
        moved, moved_table = scene(((120, 100, 7, "tree"),))
        with torch.no_grad():
            base = self.model(empty, no_objects)
            added, first_evidence = self.model(first, first_table, return_evidence=True)
            shifted, moved_evidence = self.model(moved, moved_table, return_evidence=True)
        self.assertEqual(tuple(added.shape), (1, 3, 192, 256))
        self.assertTrue(bool(torch.isfinite(added).all()))
        self.assertTrue(bool(((added >= 0) & (added <= 1)).all()))
        affected = functional.max_pool2d(
            ((first_evidence["objectCoverage"] > 0)
             | (moved_evidence["objectCoverage"] > 0)).float(),
            5, stride=1, padding=2).bool().expand_as(base)
        self.assertTrue(torch.equal(added[~affected], base[~affected]))
        self.assertTrue(torch.equal(shifted[~affected], base[~affected]))
        self.assertGreater(float((added[affected] - base[affected]).abs().max()), 1e-6)
        self.assertGreater(float((shifted[affected] - base[affected]).abs().max()), 1e-6)
        self.assertFalse(bool(((first_evidence["objectCoverage"] > 0)
                               & (moved_evidence["objectCoverage"] > 0)).any()))

    def test_multiple_object_kinds_and_gradient_reach_learned_appearance(self):
        conditions, table = scene(((40, 40, 7, "tree"), (120, 100, 13, "rock")))
        self.model.zero_grad(set_to_none=True)
        output, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(evidence["objectCount"], 2)
        self.assertGreater(float(evidence["objectCoverage"].detach().sum()), 0)
        self.assertGreater(float(evidence["roleCoverage"]["object_tree"].detach().sum()), 0)
        self.assertGreater(float(evidence["roleCoverage"]["object_rock"].detach().sum()), 0)
        self.assertEqual(float(evidence["roleCoverage"]["object_vegetation"].detach().sum()), 0)
        output[..., 35:65, 35:65].mean().backward()
        gradients = [parameter.grad for parameter in self.model.appearance.parameters()]
        self.assertTrue(all(grad is not None and bool(torch.isfinite(grad).all())
                            for grad in gradients))
        self.assertGreater(sum(float(grad.abs().sum()) for grad in gradients), 0)

    def test_table_mismatch_fails_before_ground_inference(self):
        conditions, table = scene(((40, 40, 7, "tree"),))
        table[0]["value"] = 8
        with self.assertRaisesRegex(ValueError, "labels differ"):
            self.model(conditions, table)

    def test_oversized_subject_cannot_be_silently_clipped(self):
        conditions, table = scene(((40, 40, 7, "tree"),))
        for channel in ("object_tree", "object_footprints"):
            conditions[:, ORDER.index(channel), 40:44, 44:80] = 1
        conditions[:, ORDER.index("object_instance"), 40:44, 44:80] = 7 / 255
        table[0]["footprint"]["width"] = 160
        with self.assertRaisesRegex(ValueError, "exceeds the learned local patch"):
            self.model(conditions, table)

    def test_instance_without_authoritative_footprint_fails_closed(self):
        conditions, table = scene(((40, 40, 7, "tree"),))
        conditions[:, ORDER.index("object_footprints"), 40:44, 40:44] = 0
        with self.assertRaisesRegex(ValueError, "footprint mask"):
            self.model(conditions, table)

    def test_unexplained_object_masks_and_wrong_class_fail_closed(self):
        empty, table = scene()
        for role in ("object_footprints", "object_tree", "object_rock",
                     "object_vegetation"):
            altered = empty.clone()
            altered[:, ORDER.index(role), 40:44, 40:44] = 1
            with self.subTest(orphan=role), self.assertRaisesRegex(ValueError, "mask and instance labels differ"):
                self.model(altered, table)
        conditions, table = scene(((40, 40, 7, "tree"),))
        conditions[:, ORDER.index("object_rock"), 40:44, 40:44] = 1
        with self.assertRaisesRegex(ValueError, "object_rock mask and instance labels differ"):
            self.model(conditions, table)
        fractional, table = scene(((40, 40, 7, "tree"),))
        fractional[:, ORDER.index("object_tree"), 40:44, 40:44] = 0.7
        with self.assertRaisesRegex(ValueError, "object_tree mask and instance labels differ"):
            self.model(fractional, table)
        fractional, table = scene()
        fractional[:, ORDER.index("terrain_water"), 40:44, 40:44] = 0.7
        with self.assertRaisesRegex(ValueError, "terrain_water mask is not discrete"):
            self.model(fractional, table)

    def test_empty_scene_matches_ground_and_renumber_is_invariant(self):
        empty, no_objects = scene()
        first, first_table = scene(((40, 40, 7, "shrub"),))
        renumbered, renumbered_table = scene(((40, 40, 31, "shrub"),))
        with torch.no_grad():
            base, evidence = self.model(empty, no_objects, return_evidence=True)
            a = self.model(first, first_table)
            b = self.model(renumbered, renumbered_table)
        self.assertEqual(evidence["objectCount"], 0)
        self.assertEqual(float(evidence["objectCoverage"].sum()), 0)
        self.assertTrue(bool(torch.isfinite(base).all()))
        self.assertTrue(torch.equal(a, b))

    def test_bound_kind_changes_local_appearance_without_changing_23_channels(self):
        shrub, shrub_table = scene(((40, 40, 7, "shrub"),))
        grass, grass_table = scene(((40, 40, 7, "grass_detail"),))
        self.assertTrue(torch.equal(shrub, grass))
        with torch.no_grad():
            first, evidence = self.model(shrub, shrub_table, return_evidence=True)
            second = self.model(grass, grass_table)
        support = functional.max_pool2d(
            (evidence["objectCoverage"] > 0).float(), 5, stride=1,
            padding=2).bool().expand_as(first)
        self.assertGreater(float((first[support] - second[support]).abs().max()), 1e-7)
        self.assertTrue(torch.equal(first[~support], second[~support]))

    def test_real_bound_train_condition_runs_without_rgb_target_at_inference(self):
        contract = json.loads((ROOT / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract.json")
                              .read_text(encoding="utf-8"))
        dataset = SplitReleaseDataset(ROOT, contract["datasetBinding"]["manifest"],
                                      "train", (256, 192))
        sample = load_bound_object_sample(dataset, 0)
        with torch.no_grad():
            output, evidence = self.model(sample["conditions"][None],
                                          sample["objectInstanceTable"], return_evidence=True)
        self.assertEqual(evidence["objectCount"], len(sample["objectInstanceTable"]))
        self.assertEqual(tuple(output.shape), (1, 3, 192, 256))
        self.assertTrue(bool(torch.isfinite(output).all()))
        self.assertGreater(float(evidence["objectCoverage"].sum()), 0)

        self.model.zero_grad(set_to_none=True)
        predicted = self.model(sample["conditions"][None], sample["objectInstanceTable"])
        loss, parts = train_original_instance_objective(
            predicted, sample, sample["objectInstanceTable"], ORDER)
        loss.backward()
        self.assertEqual(parts["instanceCount"], len(sample["objectInstanceTable"]))
        self.assertTrue(any(parameter.grad is not None
                            and float(parameter.grad.detach().abs().sum()) > 0
                            for parameter in self.model.appearance.parameters()))

    def test_feature_assembly_handles_border_overlap_and_mixed_precision(self):
        conditions, table = scene(((0, 0, 7, "tree"), (5, 0, 13, "rock")))
        base = torch.full((1, 32, 192, 256), 0.25, dtype=torch.bfloat16)
        terrain_roles = {role: torch.zeros((1, 8, 192, 256), dtype=torch.bfloat16)
                         for role in ("terrain_path_ground", "terrain_water", "terrain_shoreline")}
        with torch.no_grad(), patch.object(self.model.terrain, "forward",
                                          return_value=(base, terrain_roles)), \
                patch.object(self.model.appearance, "forward", side_effect=lambda views, patches: (
                    torch.full((len(views), 8, 32, 32), 0.1, dtype=torch.float32)
                    * torch.stack([view.support_mask for view in views]).float()
                )):
            output, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(output.dtype, torch.float32)
        self.assertTrue(bool(torch.isfinite(output).all()))
        self.assertGreater(float(evidence["objectCoverage"].max()), 0.75)
        self.assertEqual(float(evidence["objectCoverage"][..., -1, -1].max()), 0)
        self.assertEqual(set(evidence["responsibilityFeatures"]), {
            "object_footprints", "object_tree", "object_rock", "object_vegetation"})
        self.assertEqual(tuple(evidence["responsibilityFeatures"]["object_tree"].shape),
                         (1, 8, 192, 256))

    def test_final_rgb_is_produced_by_full_frame_decoder(self):
        conditions, table = scene(((40, 40, 7, "tree"),))
        self.assertEqual(self.model.responsibility_implementation_mode,
                         "declared_shared_substrate")
        self.assertFalse(self.model.execution_qualified)
        calls = []
        hook = self.model.final_rgb_decoder.register_forward_hook(
            lambda _module, inputs, output: calls.append((inputs, output)))
        try:
            with torch.no_grad():
                output = self.model(conditions, table)
        finally:
            hook.remove()
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(calls[0][0][2]), 4)
        self.assertEqual(set(calls[0][0][3]), {
            "terrain_path_ground", "terrain_water", "terrain_shoreline",
            "object_footprints", "object_tree", "object_rock", "object_vegetation"})
        self.assertEqual(tuple(calls[0][1].shape), (1, 3, 192, 256))
        self.assertTrue(torch.equal(output, calls[0][1]))

    def test_each_terrain_and_object_responsibility_reaches_final_rgb(self):
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (120, 100, 13, "rock"),
                                   (190, 140, 19, "shrub")))
        for role, (y, x) in {
            "terrain_path_ground": (20, 20),
            "terrain_water": (70, 70),
            "terrain_shoreline": (75, 70),
        }.items():
            conditions[:, ORDER.index(role), y:y+8, x:x+8] = 1
        self.model.zero_grad(set_to_none=True)
        output, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(set(evidence["terrainResponsibilityFeatures"]), {
            "terrain_path_ground", "terrain_water", "terrain_shoreline"})
        for value in (*evidence["terrainResponsibilityFeatures"].values(),
                      *evidence["responsibilityFeatures"].values()):
            value.retain_grad()
        output.mean().backward()
        for role, value in {**evidence["terrainResponsibilityFeatures"],
                            **evidence["responsibilityFeatures"]}.items():
            with self.subTest(role=role):
                self.assertIsNotNone(value.grad)
                self.assertGreater(float(value.grad.abs().sum()), 0)
        for role in ("terrain_path_ground", "terrain_water", "terrain_shoreline"):
            parameters = self.model.terrain.responsibility_heads[role].parameters()
            with self.subTest(parameterRole=role):
                self.assertTrue(any(parameter.grad is not None
                                    and float(parameter.grad.abs().sum()) > 0
                                    for parameter in parameters))
        self.assertTrue(any(parameter.grad is not None
                            and float(parameter.grad.abs().sum()) > 0
                            for parameter in self.model.footprint_head.parameters()))
        self.assertTrue(any(parameter.grad is not None
                            and float(parameter.grad.abs().sum()) > 0
                            for parameter in self.model.final_rgb_decoder.parameters()))

    def test_removing_each_required_feature_changes_only_its_bounded_region(self):
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (120, 100, 13, "rock"),
                                   (190, 140, 19, "shrub")))
        terrain_bounds = {
            "terrain_path_ground": (20, 20),
            "terrain_water": (70, 70),
            "terrain_shoreline": (75, 70),
        }
        for role, (y, x) in terrain_bounds.items():
            conditions[:, ORDER.index(role), y:y+8, x:x+8] = 1
        captured = []
        hook = self.model.final_rgb_decoder.register_forward_hook(
            lambda _module, inputs, _output: captured.append(inputs))
        try:
            with torch.no_grad():
                baseline, evidence = self.model(conditions, table, return_evidence=True)
        finally:
            hook.remove()
        self.assertEqual(len(captured), 1)
        base_features, terrain_roles, object_roles, role_conditions = captured[0]
        role_names = (*terrain_bounds, "object_footprints", "object_tree",
                      "object_rock", "object_vegetation")
        for index, role in enumerate(role_names):
            terrain_copy, object_copy = list(terrain_roles), list(object_roles)
            if index < 3:
                terrain_copy[index] = torch.zeros_like(terrain_copy[index])
                mask = conditions[:, ORDER.index(role):ORDER.index(role)+1] > 0.5
            else:
                object_copy[index-3] = torch.zeros_like(object_copy[index-3])
                mask = (evidence["objectCoverage"] if role == "object_footprints"
                        else evidence["roleCoverage"][role]) > 0
            with torch.no_grad():
                removed = self.model.final_rgb_decoder(
                    base_features, tuple(terrain_copy), tuple(object_copy), role_conditions)
            influenced = functional.max_pool2d(mask.float(), 5, stride=1,
                                               padding=2).bool().expand_as(baseline)
            with self.subTest(role=role):
                self.assertGreater(float((baseline[influenced]
                                          - removed[influenced]).abs().max()), 1e-8)
                self.assertTrue(torch.equal(baseline[~influenced], removed[~influenced]))

    def test_each_bound_condition_directly_reaches_full_frame_rgb(self):
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (120, 100, 13, "rock"),
                                   (190, 140, 19, "shrub")))
        for role, (y, x) in {
            "terrain_path_ground": (20, 20),
            "terrain_water": (70, 70),
            "terrain_shoreline": (75, 70),
        }.items():
            conditions[:, ORDER.index(role), y:y+8, x:x+8] = 1
        captured = []
        hook = self.model.final_rgb_decoder.register_forward_hook(
            lambda _module, inputs, _output: captured.append(inputs))
        try:
            with torch.no_grad():
                baseline = self.model(conditions, table)
        finally:
            hook.remove()
        base_features, terrain_roles, object_roles, role_conditions = captured[0]
        for role, bound in role_conditions.items():
            with self.subTest(role=role), torch.no_grad():
                changed = dict(role_conditions)
                changed[role] = torch.zeros_like(bound)
                removed = self.model.final_rgb_decoder(
                    base_features, terrain_roles, object_roles, changed)
                affected = functional.max_pool2d(bound, 5, stride=1,
                                                 padding=2).bool().expand_as(baseline)
                self.assertGreater(float((baseline[affected]
                                          - removed[affected]).abs().max()), 1e-8)
                self.assertTrue(torch.equal(baseline[~affected], removed[~affected]))
        with self.assertRaisesRegex(ValueError, "responsibilities are incomplete"):
            self.model.final_rgb_decoder(base_features, terrain_roles, object_roles,
                                         {"object_tree": role_conditions["object_tree"]})

    def test_terrain_fact_counterfactual_changes_only_its_local_region(self):
        baseline_conditions, table = scene()
        with torch.no_grad():
            baseline = self.model(baseline_conditions, table)
        for role in ("terrain_path_ground", "terrain_water", "terrain_shoreline"):
            changed_conditions = baseline_conditions.clone()
            changed_conditions[:, ORDER.index(role), 60:68, 90:98] = 1
            with self.subTest(role=role), torch.no_grad():
                changed = self.model(changed_conditions, table)
                affected = torch.zeros((1, 1, 192, 256), dtype=torch.float32)
                affected[..., 60:68, 90:98] = 1
                affected = functional.max_pool2d(affected, 9, stride=1,
                                                 padding=4).bool().expand_as(baseline)
                self.assertGreater(float((changed[affected]
                                          - baseline[affected]).abs().max()), 1e-8)
                self.assertTrue(torch.equal(changed[~affected], baseline[~affected]))


if __name__ == "__main__":
    unittest.main()

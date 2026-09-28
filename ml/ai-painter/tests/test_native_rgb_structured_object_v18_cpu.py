"""V18 CPU candidate checks: object coordinate shortcut and eight-image rank."""
from copy import deepcopy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
    ARCHITECTURE, CAPABILITY, OBJECT_CLASSES, PLAN, SEED,
    build_fresh_native_rgb_structured_object_v18_cpu,
    build_native_rgb_structured_object_v18_cpu,
    coordinate_free_views, prefer_checkpoint, rank_epoch,
    train_objective, validation_observation,
)
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views
from ai_painter.complete_world.object_instance_supervision_cpu import PATCH_SIZE
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    build_conditional_texture_discriminator,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    train_structured_object_objective,
)


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                    .read_text(encoding="utf8"))["tensorContract"]["channelOrder"])
IDS = tuple(f"frozen-validation-{i}" for i in range(8))


def source_scene():
    conditions = torch.zeros((23, 192, 256))
    conditions[ORDER.index("terrain_grass")] = 1
    conditions[ORDER.index("walkable")] = 1
    conditions[ORDER.index("coordinate_x")] = torch.arange(256)[None, :] / 255
    conditions[ORDER.index("coordinate_y")] = torch.arange(192)[:, None] / 191
    # Source facts are not rewritten: one tree has one exact native footprint.
    for name in ("object_instance", "object_footprints", "object_tree", "collision"):
        conditions[ORDER.index(name), 40:44, 40:44] = 7 / 255 if name == "object_instance" else 1
    conditions[ORDER.index("walkable"), 40:44, 40:44] = 0
    table = [{"value": 7, "kind": "tree", "footprint": {
        "x": 160, "y": 160, "width": 16, "height": 16}}]
    return conditions, table


def observations(epoch=8, *, worst=.05, objective=.7):
    rows = []
    for index, sample_id in enumerate(IDS):
        values = {role: worst + .1 for role in OBJECT_CLASSES}
        if index == 0:
            values["object_vegetation"] = None
            values["object_footprints"] = worst
        rows.append({"epoch": epoch, "sampleId": sample_id, "split": "validation",
            "existingValidationObjective": objective,
            "objectCorrelations": values})
    return rows


class StructuredObjectV18CpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_fresh_version_and_reproducible_state_without_checkpoint_loader(self):
        from ai_painter.complete_world.split_training import state_hash
        with patch.object(torch, "load", side_effect=AssertionError("historical checkpoint load")):
            first = build_fresh_native_rgb_structured_object_v18_cpu(condition_channel_order=ORDER)
            second = build_fresh_native_rgb_structured_object_v18_cpu(condition_channel_order=ORDER)
        self.assertEqual(state_hash(first.state_dict()), state_hash(second.state_dict()))
        self.assertEqual(first.architecture_id, ARCHITECTURE)
        self.assertEqual(first.capability_version, CAPABILITY)
        self.assertFalse(first.execution_qualified)
        self.assertEqual(PLAN["model"]["freshInitializationSeed"], SEED)
        self.assertFalse(PLAN["model"]["parentCheckpointLoaded"])
        self.assertEqual(PLAN["resourceBound"]["maxTrainingAttempts"], 1)
        self.assertEqual(PLAN["resourceBound"]["maxGeneratorSteps"], 1152)
        self.assertEqual(PLAN["resourceBound"]["maxDiscriminatorSteps"], 1152)

    def test_private_object_view_zeros_only_two_absolute_coordinate_channels(self):
        source, table = source_scene()
        views = validate_bound_object_views(source, table, ORDER)
        source_before = source.clone()
        table_before = deepcopy(table)
        view_before = views[0].subject_conditions.clone()
        private = coordinate_free_views(views, ORDER)
        self.assertEqual(len(private), 1)
        self.assertEqual(int(torch.count_nonzero(private[0].subject_conditions[ORDER.index("coordinate_x")])), 0)
        self.assertEqual(int(torch.count_nonzero(private[0].subject_conditions[ORDER.index("coordinate_y")])), 0)
        for index, name in enumerate(ORDER):
            if name not in ("coordinate_x", "coordinate_y"):
                self.assertTrue(torch.equal(private[0].subject_conditions[index], view_before[index]), name)
        self.assertTrue(torch.equal(source, source_before))
        self.assertTrue(torch.equal(views[0].subject_conditions, view_before))
        self.assertEqual(table, table_before)
        self.assertEqual((private[0].top, private[0].left, private[0].instance_value),
                         (views[0].top, views[0].left, views[0].instance_value))

    def test_appearance_direct_coordinate_shortcut_removed_but_relative_xy_remains(self):
        source, table = source_scene()
        first = validate_bound_object_views(source, table, ORDER)
        changed = source.clone()
        changed[ORDER.index("coordinate_x")].fill_(.87)
        changed[ORDER.index("coordinate_y")].fill_(.13)
        other = validate_bound_object_views(changed, table, ORDER)
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16).eval()
        patches = torch.randn((1, 32, PATCH_SIZE, PATCH_SIZE))
        with torch.no_grad():
            left = model.core.appearance(first, patches)
            right = model.core.appearance(other, patches)
        self.assertTrue(torch.equal(left, right))
        self.assertGreater(float(left.abs().sum()), 0)
        self.assertIs(model.core.appearance.base.layers[0].weight,
                      next(model.core.appearance.base.layers[0].parameters()))
        # Local relative XY is built inside the unchanged appearance base.
        self.assertIn("base.layers", next(k for k in model.state_dict() if "appearance" in k))

    def test_terrain_receives_original_coordinates_and_fact_masks(self):
        source, table = source_scene()
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16).eval()
        before = source.clone()
        with patch.object(model.core.terrain, "forward", wraps=model.core.terrain.forward) as terrain:
            with torch.no_grad():
                output, evidence = model(source[None], table, return_evidence=True)
        received = terrain.call_args.args[0][0]
        for role in ("coordinate_x", "coordinate_y", "terrain_water", "terrain_shoreline"):
            self.assertTrue(torch.equal(received[ORDER.index(role)], source[ORDER.index(role)]), role)
        self.assertEqual(tuple(output.shape), (1, 3, 192, 256))
        self.assertTrue(torch.equal(source, before))
        self.assertEqual({**evidence["terrainResponsibilityFeatures"],
                          **evidence["responsibilityFeatures"]}.keys(), {
            "terrain_path_ground", "terrain_water", "terrain_shoreline",
            "object_footprints", "object_tree", "object_rock", "object_vegetation"})
        self.assertEqual(int(torch.count_nonzero(evidence["terrainResponsibilityFeatures"]["terrain_water"])), 0)
        self.assertEqual(int(torch.count_nonzero(evidence["terrainResponsibilityFeatures"]["terrain_shoreline"])), 0)

    def test_invalid_world_fact_object_table_fails_before_appearance(self):
        source, table = source_scene()
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16).eval()
        for corrupt in (lambda s, t: t[0]["footprint"].update(x=900),
                        lambda s, t: s[ORDER.index("object_tree"), 40:44, 40:44].zero_(),
                        lambda s, t: s[ORDER.index("terrain_water"), 1, 1].fill_(.5)):
            data, source_table = source.clone(), deepcopy(table)
            corrupt(data, source_table)
            with patch.object(model.core.appearance, "forward", side_effect=AssertionError("appearance reached")):
                with self.assertRaises(ValueError):
                    model(data[None], source_table)

    def test_train_objective_preserves_original_source_and_rejects_validation(self):
        from test_native_rgb_structured_object_objective_cpu_v17 import sample
        data, table = sample("train")
        data["objectInstanceTable"] = table
        critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
        predicted = torch.rand((1, 3, 192, 256))
        with torch.no_grad():
            old, _ = train_structured_object_objective(critic, predicted, data, table, ORDER)
            new, _ = train_objective(critic, predicted, data, table, ORDER)
        self.assertEqual(float(old), float(new))
        with self.assertRaises(ValueError):
            train_objective(critic, predicted, {**data, "split": "validation"}, table, ORDER)

    def test_synthetic_train_backward_reaches_coordinate_free_object_branch(self):
        from test_native_rgb_structured_object_objective_cpu_v17 import sample
        data, table = sample("train")
        source, _ = source_scene()
        data.update(conditions=source, objectInstanceTable=table)
        original_image, original_conditions = data["image"].clone(), data["conditions"].clone()
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)
        critic = build_conditional_texture_discriminator().requires_grad_(False)
        predicted = model(source[None], table)
        loss, _ = train_objective(critic, predicted, data, table, ORDER)
        self.assertTrue(bool(torch.isfinite(loss)))
        loss.backward()
        appearance = model.core.appearance.base.layers[0].weight
        self.assertIsNotNone(appearance.grad)
        self.assertTrue(bool(torch.isfinite(appearance.grad).all()))
        self.assertGreater(float(appearance.grad.abs().sum()), 0)
        self.assertTrue(torch.equal(data["image"], original_image))
        self.assertTrue(torch.equal(data["conditions"], original_conditions))
        self.assertEqual(table, data["objectInstanceTable"])
        self.assertTrue(all(parameter.grad is None for parameter in critic.parameters()))

    def test_validation_observation_is_no_grad_and_never_changes_weights(self):
        from test_native_rgb_structured_object_objective_cpu_v17 import sample
        from ai_painter.complete_world.split_training import state_hash
        data, table = sample("validation")
        data.update(sampleId=IDS[0], objectInstanceTable=table)
        model = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16).eval()
        before = state_hash(model.state_dict())
        observation = validation_observation(model, data, ORDER, 8)
        self.assertEqual(observation["split"], "validation")
        self.assertEqual(observation["sampleId"], IDS[0])
        self.assertIsNone(observation["objectCorrelations"]["object_rock"])
        self.assertEqual(state_hash(model.state_dict()), before)
        self.assertTrue(all(parameter.grad is None for parameter in model.parameters()))
        with self.assertRaises(ValueError):
            validation_observation(model, {**data, "split": "challenge"}, ORDER, 8)
        model.train()
        with self.assertRaises(ValueError):
            validation_observation(model, data, ORDER, 8)

    def test_all_eight_unique_validation_rows_and_four_role_coverage_required(self):
        valid = rank_epoch(observations(), IDS, epoch=8)
        self.assertEqual(valid["worstApplicableObjectCorrelation"], .05)
        self.assertEqual(valid["applicableImageCounts"]["object_vegetation"], 7)
        self.assertFalse(valid["qualificationGranted"])
        for mutate in (lambda rows: rows.pop(),
                       lambda rows: rows[0].update(sampleId=IDS[1]),
                       lambda rows: rows[0].update(split="challenge"),
                       lambda rows: rows[0].update(epoch=9),
                       lambda rows: rows[0].update(existingValidationObjective=float("nan")),
                       lambda rows: [row["objectCorrelations"].update(object_vegetation=None) for row in rows],
                       lambda rows: rows[0]["objectCorrelations"].update(object_footprints=True)):
            rows = observations()
            mutate(rows)
            with self.assertRaises(ValueError):
                rank_epoch(rows, IDS, epoch=8)
        with self.assertRaises(ValueError):
            rank_epoch(observations(epoch=7), IDS, epoch=7)

    def test_worst_applicable_object_first_then_original_score_then_earlier_epoch(self):
        early = rank_epoch(observations(8, worst=.05, objective=.7), IDS, epoch=8)
        stronger = rank_epoch(observations(9, worst=.06, objective=.9), IDS, epoch=9)
        lower_base_score = rank_epoch(observations(10, worst=.06, objective=.5), IDS, epoch=10)
        equal_later = rank_epoch(observations(11, worst=.06, objective=.5), IDS, epoch=11)
        self.assertTrue(prefer_checkpoint(early, None))
        self.assertTrue(prefer_checkpoint(stronger, early))
        self.assertTrue(prefer_checkpoint(lower_base_score, stronger))
        self.assertFalse(prefer_checkpoint(equal_later, lower_base_score))
        with self.assertRaises(ValueError):
            prefer_checkpoint(early, stronger)
        forged = deepcopy(equal_later)
        forged["rank"][0] = 1
        with self.assertRaises(ValueError):
            prefer_checkpoint(forged, lower_base_score)

    def test_cpu_only_candidate_has_no_training_activation(self):
        self.assertEqual(PLAN["sourceSplitCounts"], {"train": 48, "validation": 8,
                                                        "challenge": 4, "regression": 4})
        self.assertEqual(PLAN["resourceBound"]["automaticRetries"], 0)
        self.assertFalse(PLAN["checkpointSelection"]["reviewThresholdsChanged"])
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

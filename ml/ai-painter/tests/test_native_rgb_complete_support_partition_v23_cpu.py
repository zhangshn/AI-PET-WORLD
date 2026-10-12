"""CPU-only V23 ownership, equivalence, gradient and fail-closed controls."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    ARCHITECTURE, CAPABILITY, MAX_EXTRA_PARAMETERS, MAX_TOTAL_PARAMETER_BYTES,
    OWNERSHIP_RULE, ROLES, SEED, TYPED_ROLES,
    build_fresh_native_rgb_complete_support_partition_v23_cpu,
    build_native_rgb_complete_support_partition_v23_cpu,
    complete_typed_support_partition,
)
from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
    build_fresh_native_rgb_object_residual_v21_cpu,
    build_native_rgb_object_residual_v21_cpu,
)
from ai_painter.complete_world.native_rgb_structured_object_v18_cpu import (
    build_native_rgb_structured_object_v18_cpu,
)
from ai_painter.complete_world.object_instance_supervision_cpu import SUPPORT_RADIUS
from ai_painter.complete_world.split_training import state_hash


ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                    .read_text(encoding="utf8"))["tensorContract"]["channelOrder"])
OBJECTS = ((40, 40, 7, "tree"), (100, 70, 13, "rock"),
           (160, 120, 21, "shrub"))


def scene(objects=OBJECTS):
    conditions = torch.zeros((1, 23, 192, 256))
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("walkable")] = 1
    conditions[:, ORDER.index("coordinate_x")] = (
        torch.arange(256)[None, None, None, :] / 255)
    conditions[:, ORDER.index("coordinate_y")] = (
        torch.arange(192)[None, None, :, None] / 191)
    table = []
    for x, y, value, kind in objects:
        role = {"tree": "object_tree", "rock": "object_rock",
                "shrub": "object_vegetation"}[kind]
        for channel in (role, "object_footprints", "collision"):
            conditions[:, ORDER.index(channel), y:y + 4, x:x + 4] = 1
        conditions[:, ORDER.index("walkable"), y:y + 4, x:x + 4] = 0
        conditions[:, ORDER.index("object_instance"), y:y + 4, x:x + 4] = value / 255
        table.append({"value": value, "kind": kind,
                      "footprint": {"x": x * 4, "y": y * 4,
                                    "width": 16, "height": 16}})
    return conditions, table


def blank_partition():
    cores = {role: torch.zeros((1, 1, 192, 256)) for role in TYPED_ROLES}
    coverage = {role: torch.zeros((1, 1, 192, 256)) for role in TYPED_ROLES}
    return cores, coverage


class CompleteSupportPartitionV23CpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.model = build_native_rgb_complete_support_partition_v23_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)

    def same_weight_models(self):
        old = build_native_rgb_object_residual_v21_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)
        new = build_native_rgb_complete_support_partition_v23_cpu(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)
        new.load_state_dict(old.state_dict(), strict=True)
        old.eval(); new.eval()
        return old, new

    def test_fresh_identity_parameter_graph_and_no_historical_load(self):
        with patch.object(torch, "load", side_effect=AssertionError("historical weight load")):
            first = build_fresh_native_rgb_complete_support_partition_v23_cpu(
                condition_channel_order=ORDER)
            second = build_fresh_native_rgb_complete_support_partition_v23_cpu(
                condition_channel_order=ORDER)
            old = build_fresh_native_rgb_object_residual_v21_cpu(
                condition_channel_order=ORDER)
        baseline = build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=ORDER, base_channels=48, patch_channels=32)
        count = lambda model: sum(parameter.numel() for parameter in model.parameters())
        total_bytes = sum(p.numel() * p.element_size() for p in first.parameters())
        self.assertEqual(first.architecture_id, ARCHITECTURE)
        self.assertEqual(first.capability_version, CAPABILITY)
        self.assertEqual(first.support_ownership_rule, OWNERSHIP_RULE)
        self.assertEqual(SEED, 20260929)
        self.assertFalse(first.execution_qualified)
        self.assertFalse(first.parent_checkpoint_loaded)
        self.assertNotEqual(first.architecture_id, old.architecture_id)
        self.assertNotEqual(first.capability_version, old.capability_version)
        self.assertEqual(tuple(first.state_dict()), tuple(old.state_dict()))
        self.assertEqual(count(first), count(old))
        self.assertEqual(state_hash(first.state_dict()), state_hash(second.state_dict()))
        self.assertEqual(state_hash(first.state_dict()), state_hash(old.state_dict()))
        self.assertLessEqual(count(first) - count(baseline), MAX_EXTRA_PARAMETERS)
        self.assertLessEqual(total_bytes, MAX_TOTAL_PARAMETER_BYTES)
        self.assertFalse(torch.cuda.is_initialized())

    def test_partition_preserves_cores_exact_union_uniqueness_and_bounds(self):
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (48, 40, 13, "rock"),
                                   (44, 48, 21, "shrub")))
        with torch.no_grad():
            _, evidence = self.model(conditions, table, return_evidence=True)
        owners = evidence["typedSupportOwnerMasks"]
        union = torch.zeros_like(next(iter(owners.values())))
        count = torch.zeros_like(union, dtype=torch.int8)
        coverage_union = torch.zeros_like(union)
        for role in TYPED_ROLES:
            core = conditions[:, ORDER.index(role):ORDER.index(role) + 1].bool()
            coverage = evidence["roleCoverage"][role] > 0
            self.assertTrue(bool((~core | owners[role]).all()), role)
            self.assertTrue(bool((~owners[role] | coverage).all()), role)
            union |= owners[role]
            count += owners[role].to(torch.int8)
            coverage_union |= coverage
        self.assertTrue(torch.equal(union, coverage_union))
        self.assertFalse(bool((count > 1).any()))
        self.assertEqual(evidence["supportOwnershipRule"], OWNERSHIP_RULE)
        self.assertEqual(evidence["visibleObjectSupportMasks"]["object_footprints"].dtype,
                         torch.bool)

    def test_core_conflict_and_core_coverage_relationships_fail_closed(self):
        cores, coverage = blank_partition()
        for role in ("object_tree", "object_rock"):
            cores[role][0, 0, 20, 20] = 1
            coverage[role][0, 0, 20, 20] = 1
        with self.assertRaisesRegex(ValueError, "cores overlap"):
            complete_typed_support_partition(cores, coverage)

        cores, coverage = blank_partition()
        cores["object_tree"][0, 0, 20, 20] = 1
        with self.assertRaisesRegex(ValueError, "core escaped"):
            complete_typed_support_partition(cores, coverage)

        cores, coverage = blank_partition()
        coverage["object_tree"][0, 0, 20, 20] = 1
        with self.assertRaisesRegex(ValueError, "empty core"):
            complete_typed_support_partition(cores, coverage)

        cores, coverage = blank_partition()
        cores["object_tree"][0, 0, 10, 10] = 1
        coverage["object_tree"][0, 0, 10, 10] = 1
        coverage["object_tree"][0, 0, 30, 30] = 1
        with self.assertRaisesRegex(ValueError, "bounded core owner"):
            complete_typed_support_partition(cores, coverage)

    def test_invalid_shape_nonfinite_nonbinary_and_missing_role_rejected(self):
        for kind in ("shape", "nonfinite", "nonbinary"):
            cores, coverage = blank_partition()
            if kind == "shape":
                cores["object_tree"] = torch.zeros((1, 1, 191, 256))
            elif kind == "nonfinite":
                cores["object_tree"][0, 0, 1, 1] = float("nan")
            else:
                coverage["object_tree"][0, 0, 1, 1] = .5
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                complete_typed_support_partition(cores, coverage)
        cores, coverage = blank_partition()
        del coverage["object_rock"]
        with self.assertRaisesRegex(ValueError, "complete typed"):
            complete_typed_support_partition(cores, coverage)

    def test_integer_normalized_distance_boundary_and_exact_tie_order(self):
        cores, coverage = blank_partition()
        cores["object_tree"][0, 0, 20, 20] = 1
        cores["object_rock"][0, 0, 20, 26] = 1
        for role in ("object_tree", "object_rock"):
            coverage[role].copy_(cores[role])
            coverage[role][0, 0, 20, 23:26] = 1
        owners, distances = complete_typed_support_partition(cores, coverage)
        # x=23: 3/8 < 3/4; x=24: 4/8 == 2/4 and tree wins tie;
        # x=25: 5/8 > 1/4 and rock wins.
        self.assertTrue(bool(owners["object_tree"][0, 0, 20, 23]))
        self.assertTrue(bool(owners["object_tree"][0, 0, 20, 24]))
        self.assertTrue(bool(owners["object_rock"][0, 0, 20, 25]))
        self.assertEqual(int(distances["object_tree"][0, 0, 20, 24]), 4)
        self.assertEqual(int(distances["object_rock"][0, 0, 20, 24]), 2)
        self.assertEqual(SUPPORT_RADIUS,
                         {"object_tree": 8, "object_rock": 4,
                          "object_vegetation": 6})

    def test_single_role_and_separated_scene_equal_v21_with_same_weights(self):
        old, new = self.same_weight_models()
        for objects in (((40, 40, 7, "tree"),), OBJECTS):
            conditions, table = scene(objects)
            with torch.no_grad():
                before = old(conditions, table)
                after = new(conditions, table)
            self.assertTrue(torch.equal(before, after))

    def test_overlap_changes_only_existing_union_and_keeps_footprint_residual(self):
        old, new = self.same_weight_models()
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (48, 40, 13, "rock")))
        with torch.no_grad():
            before, old_evidence = old(conditions, table, return_evidence=True)
            after, new_evidence = new(conditions, table, return_evidence=True)
        support = torch.zeros_like(new_evidence["objectCoverage"], dtype=torch.bool)
        for role in TYPED_ROLES:
            support |= new_evidence["roleCoverage"][role] > 0
        outside = ~support.expand_as(before)
        self.assertTrue(torch.equal(before[outside], after[outside]))
        self.assertTrue(torch.equal(
            old_evidence["maskedObjectRgbResiduals"]["object_footprints"],
            new_evidence["maskedObjectRgbResiduals"]["object_footprints"]))
        old_union = torch.zeros_like(support)
        new_union = torch.zeros_like(support)
        for role in TYPED_ROLES:
            old_union |= old_evidence["visibleObjectSupportMasks"][role]
            new_union |= new_evidence["visibleObjectSupportMasks"][role]
        self.assertGreater(int((support & ~old_union).sum()), 0)
        self.assertTrue(torch.equal(new_union, support))

    def test_instance_table_permutation_is_stable(self):
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (48, 40, 13, "rock"),
                                   (44, 48, 21, "shrub")))
        with torch.no_grad():
            first, a = self.model(conditions, table, return_evidence=True)
            second, b = self.model(conditions, list(reversed(table)), return_evidence=True)
        for role in TYPED_ROLES:
            self.assertTrue(torch.equal(a["typedSupportOwnerMasks"][role],
                                        b["typedSupportOwnerMasks"][role]))
        self.assertTrue(torch.allclose(first, second, atol=1e-7, rtol=0))

    def test_empty_objects_are_terrain_only(self):
        conditions, table = scene(())
        with torch.no_grad():
            rgb, evidence = self.model(conditions, table, return_evidence=True)
        self.assertEqual(float(evidence["objectResidualSum"].abs().sum()), 0)
        self.assertTrue(torch.allclose(rgb, evidence["terrainRgb"], atol=1e-6, rtol=0))
        self.assertFalse(any(bool(evidence["typedSupportOwnerMasks"][role].any())
                             for role in TYPED_ROLES))

    def test_former_hole_loss_reaches_only_winner_typed_head_and_shared_appearance(self):
        old, new = self.same_weight_models()
        conditions, table = scene(((40, 40, 7, "tree"),
                                   (48, 40, 13, "rock")))
        with torch.no_grad():
            _, old_evidence = old(conditions, table, return_evidence=True)
        new.zero_grad(set_to_none=True)
        predicted, evidence = new(conditions, table, return_evidence=True)
        support = torch.zeros_like(evidence["objectCoverage"], dtype=torch.bool)
        old_visible = torch.zeros_like(support)
        for role in TYPED_ROLES:
            support |= evidence["roleCoverage"][role] > 0
            old_visible |= old_evidence["visibleObjectSupportMasks"][role]
        former_hole = support & ~old_visible
        point = torch.nonzero(former_hole[0, 0], as_tuple=False)[0]
        y, x = (int(value) for value in point)
        winners = [role for role in TYPED_ROLES
                   if bool(evidence["typedSupportOwnerMasks"][role][0, 0, y, x])]
        self.assertEqual(len(winners), 1)
        winner = winners[0]
        loss = predicted[0, :, y, x].sum()
        loss.backward()
        gradients = {role: sum(float(parameter.grad.abs().sum())
            if parameter.grad is not None else 0
            for parameter in new.object_rgb_heads[role].parameters())
            for role in TYPED_ROLES}
        self.assertGreater(gradients[winner], 0)
        self.assertTrue(all(value == 0 for role, value in gradients.items()
                            if role != winner))
        appearance = sum(float(parameter.grad.abs().sum())
            if parameter.grad is not None else 0
            for parameter in new.core.core.appearance.parameters())
        self.assertGreater(appearance, 0)
        self.assertGreater(sum(float(parameter.detach().abs().sum())
            for parameter in new.object_rgb_heads[winner].parameters()), 0)

    def test_wrong_bound_table_and_incomplete_channel_contract_rejected(self):
        conditions, table = scene()
        foreign = deepcopy(table)
        foreign[0]["value"] = 99
        with self.assertRaises(ValueError):
            self.model(conditions, foreign)
        with self.assertRaisesRegex(ValueError, "23-channel"):
            build_native_rgb_complete_support_partition_v23_cpu(
                condition_channel_order=ORDER[:-1])

    def test_bound_train_ordinals_0_and_43_only_preserve_partition_invariants(self):
        import painter_stage4_v21_object_core_fidelity_probe as profile
        with profile.successor_profile(), \
             patch.object(torch, "load", side_effect=AssertionError("checkpoint load")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CUDA query")):
            context = profile.core.collect_inputs()
            model = build_fresh_native_rgb_complete_support_partition_v23_cpu(
                condition_channel_order=context["order"]).eval()
            before = state_hash(model.state_dict())
            started = time.monotonic()
            for ordinal in (0, 43):
                sample, _ = profile.core.cpu.load_sample(
                    context["reader"], context["rows"][ordinal], context["order"],
                    context["continuous"])
                with torch.no_grad():
                    _, evidence = model(sample["conditions"][None],
                                        sample["objectInstanceTable"],
                                        return_evidence=True)
                owners = evidence["typedSupportOwnerMasks"]
                count = sum(mask.to(torch.int8) for mask in owners.values())
                owned_union = torch.zeros_like(next(iter(owners.values())))
                support_union = torch.zeros_like(owned_union)
                for role in TYPED_ROLES:
                    owned_union |= owners[role]
                    support_union |= evidence["roleCoverage"][role] > 0
                    core = evidence["responsibilityConditions"][role] > .5
                    self.assertTrue(bool((~core | owners[role]).all()), (ordinal, role))
                    self.assertTrue(bool((~owners[role]
                                          | (evidence["roleCoverage"][role] > 0)).all()),
                                    (ordinal, role))
                self.assertTrue(torch.equal(owned_union, support_union), ordinal)
                self.assertFalse(bool((count > 1).any()), ordinal)
            self.assertLess(time.monotonic() - started, 120)
            self.assertEqual(state_hash(model.state_dict()), before)
            context["reader"].unchanged()
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

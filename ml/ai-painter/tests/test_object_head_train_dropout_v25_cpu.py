"""CPU-only behavioral boundaries for the inactive V25 train-only candidate."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    ROLES, build_fresh_native_rgb_complete_support_partition_v23_cpu,
)
from ai_painter.complete_world.object_head_train_dropout_v25_cpu import (
    ARCHITECTURE, CAPABILITY, DROPOUT_PROBABILITY,
    build_fresh_object_head_train_dropout_v25_cpu,
)
from ai_painter.complete_world.object_head_core_priority_update_v24 import (
    bind_v23_object_head_parameters,
)


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v24_dry_single_world_checkpoint_worker as v24_worker  # noqa: E402
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                    .read_text(encoding="utf8"))["tensorContract"]["channelOrder"])


def dry_scene():
    conditions = torch.zeros((1, 23, 192, 256))
    conditions[:, ORDER.index("terrain_grass")] = 1
    conditions[:, ORDER.index("walkable")] = 1
    conditions[:, ORDER.index("coordinate_x")] = (
        torch.arange(256)[None, None, None, :] / 255)
    conditions[:, ORDER.index("coordinate_y")] = (
        torch.arange(192)[None, None, :, None] / 191)
    table = []
    for x, y, value, kind in ((40, 40, 7, "tree"),
                              (100, 70, 13, "rock"),
                              (160, 120, 21, "shrub")):
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


class ObjectHeadTrainDropoutV25CpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_consumed_v24_worker_rejects_v25_candidate_identity(self):
        candidate = json.loads((ROOT / "data/ai-painter/system-governance/"
                                "stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1.json")
                               .read_text(encoding="utf8"))
        with self.assertRaisesRegex(ValueError, "candidate identity"):
            v24_worker.validate_candidate_contract(candidate)

    def test_fresh_parameter_graph_eval_identity_and_world_fact_boundaries(self):
        with patch.object(torch, "load", side_effect=AssertionError("historical load")):
            original = build_fresh_native_rgb_complete_support_partition_v23_cpu(
                condition_channel_order=ORDER)
            candidate = build_fresh_object_head_train_dropout_v25_cpu(
                condition_channel_order=ORDER)
        self.assertEqual(candidate.architecture_id, ARCHITECTURE)
        self.assertEqual(candidate.capability_version, CAPABILITY)
        self.assertFalse(candidate.execution_qualified)
        self.assertEqual(DROPOUT_PROBABILITY, 0.10)
        self.assertEqual(tuple(original.state_dict()), tuple(candidate.state_dict()))
        self.assertTrue(all(torch.equal(original.state_dict()[key], value)
                            for key, value in candidate.state_dict().items()))
        self.assertEqual(sum(p.numel() for p in original.parameters()),
                         sum(p.numel() for p in candidate.parameters()))
        parameters, indexes = bind_v23_object_head_parameters(candidate)
        self.assertEqual(len(parameters), 106)
        self.assertEqual(tuple(indexes), ROLES)
        conditions, table = dry_scene()
        before = conditions.clone()
        original.eval(); candidate.eval()
        with torch.no_grad():
            expected, expected_evidence = original(conditions, table, return_evidence=True)
            actual, actual_evidence = candidate(conditions, table, return_evidence=True)
        self.assertTrue(torch.equal(expected, actual))
        for role in ROLES:
            self.assertTrue(torch.equal(
                expected_evidence["visibleObjectSupportMasks"][role],
                actual_evidence["visibleObjectSupportMasks"][role]))
        self.assertTrue(torch.equal(conditions, before))
        self.assertFalse(bool(conditions[:, ORDER.index("terrain_water")].any()))
        self.assertFalse(torch.cuda.is_initialized())

    def test_training_only_stochasticity_and_object_head_gradient_reachability(self):
        candidate = build_fresh_object_head_train_dropout_v25_cpu(
            condition_channel_order=ORDER)
        conditions, table = dry_scene()
        candidate.train()
        state_before = {key: value.clone() for key, value in candidate.state_dict().items()}
        with patch.object(torch.cuda, "is_available",
                          side_effect=AssertionError("GPU prohibited")):
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(24680)
                first = candidate(conditions, table)
                torch.manual_seed(13579)
                second = candidate(conditions, table)
            self.assertTrue(bool(torch.isfinite(first).all()))
            self.assertFalse(torch.equal(first, second))
            _, evidence = candidate(conditions, table, return_evidence=True)
            outside = torch.ones((1, 1, 192, 256), dtype=torch.bool)
            for role in ROLES:
                outside &= ~evidence["visibleObjectSupportMasks"][role]
            self.assertTrue(torch.equal(first[outside.expand_as(first)],
                                        second[outside.expand_as(second)]))
            first.mean().backward()
        for role in ROLES:
            gradients = [p.grad for p in candidate.object_rgb_heads[role].parameters()]
            self.assertTrue(any(g is not None and bool(torch.count_nonzero(g))
                                for g in gradients), role)
        candidate.eval()
        with torch.no_grad():
            self.assertTrue(torch.equal(candidate(conditions, table),
                                        candidate(conditions, table)))
        self.assertTrue(all(torch.equal(state_before[key], value)
                            for key, value in candidate.state_dict().items()))
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

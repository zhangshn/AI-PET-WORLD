"""CPU boundaries for V26; no optimizer or source image is used in unit tests."""
from __future__ import annotations

from copy import deepcopy
import unittest
from unittest.mock import patch
import torch
from torch import nn

from test_object_head_train_dropout_v25_cpu import ORDER, dry_scene
import check_stage4_mvp256_dry_v26_cpu as checker
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    ROLES, build_fresh_native_rgb_complete_support_partition_v23_cpu,
)
from ai_painter.complete_world.object_head_core_priority_update_v24 import bind_v23_object_head_parameters
from ai_painter.complete_world.object_local_context_isolation_v26_cpu import (
    ARCHITECTURE, CAPABILITY, CONTEXT_RULE, LocalFactAppearance,
    build_fresh_object_local_context_isolation_v26_cpu, isolated_terrain_context,
)


class LocalContextIsolationV26CpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_context_is_private_finite_detached_and_metadata_preserving(self):
        context = torch.randn((2, 48, 32, 32), requires_grad=True)
        original = context.detach().clone()
        result = isolated_terrain_context(context, 2)
        self.assertEqual(result.shape, context.shape)
        self.assertEqual(result.dtype, context.dtype)
        self.assertEqual(result.device, context.device)
        self.assertFalse(result.requires_grad)
        self.assertEqual(int(torch.count_nonzero(result)), 0)
        self.assertNotEqual(result.data_ptr(), context.data_ptr())
        self.assertTrue(torch.equal(original, context))
        for bad, count in ((context, 1), (context[:, :47], 2),
                           (context.to(torch.int32), 2), (context, True),
                           (torch.full_like(context, float("nan")), 2)):
            with self.assertRaisesRegex(ValueError, "finite bound"):
                isolated_terrain_context(bad, count)

    def test_only_learned_context_and_existing_global_xy_are_erased(self):
        class Capture(nn.Module):
            def forward(self, views, context):
                self.views, self.context = views, context
                return context.sum()
        from dataclasses import dataclass
        @dataclass
        class View:
            subject_conditions: torch.Tensor
            kind: str = "tree"
        source = torch.rand((23, 32, 32))
        before = source.clone()
        capture = Capture()
        LocalFactAppearance(capture, ORDER)([View(source)], torch.ones((1, 48, 32, 32)))
        self.assertEqual(int(capture.context.count_nonzero()), 0)
        observed = capture.views[0].subject_conditions
        for index, name in enumerate(ORDER):
            if name in ("coordinate_x", "coordinate_y"):
                self.assertEqual(int(observed[index].count_nonzero()), 0)
            else:
                self.assertTrue(torch.equal(source[index], observed[index]), name)
        self.assertTrue(torch.equal(source, before))
        self.assertEqual(capture.views[0].kind, "tree")

    def test_fresh_graph_parameter_identity_rng_and_no_historical_loading(self):
        rng = torch.get_rng_state().clone()
        with patch.object(torch, "load", side_effect=AssertionError("checkpoint prohibited")):
            original = build_fresh_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=ORDER)
            candidate = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
        self.assertEqual(candidate.architecture_id, ARCHITECTURE)
        self.assertEqual(candidate.capability_version, CAPABILITY)
        self.assertEqual(candidate.object_context_rule, CONTEXT_RULE)
        self.assertFalse(candidate.execution_qualified)
        self.assertFalse(candidate.parent_checkpoint_loaded)
        self.assertEqual(tuple(original.state_dict()), tuple(candidate.state_dict()))
        self.assertTrue(all(torch.equal(original.state_dict()[key], value)
                            for key, value in candidate.state_dict().items()))
        parameters, groups = bind_v23_object_head_parameters(candidate)
        self.assertEqual(len(parameters), 106)
        self.assertEqual(sum(p.numel() for p in parameters), 2239519)
        self.assertEqual(tuple(groups), ROLES)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertFalse(any(isinstance(x, nn.Dropout) or isinstance(x, nn.Dropout2d)
                             for x in candidate.modules()))
        self.assertFalse(torch.cuda.is_initialized())

    def test_terrain_support_sources_and_determinism_remain_exact(self):
        baseline = build_fresh_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=ORDER)
        candidate = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
        conditions, table = dry_scene()
        source, instances = conditions.clone(), deepcopy(table)
        state = {key: value.clone() for key, value in candidate.state_dict().items()}
        baseline.eval(); candidate.eval()
        with torch.no_grad():
            expected, base_evidence = baseline(conditions, table, return_evidence=True)
            actual, evidence = candidate(conditions, table, return_evidence=True)
            repeated = candidate(conditions, table)
        self.assertTrue(torch.equal(actual, repeated))
        self.assertTrue(torch.equal(base_evidence["terrainRgb"], evidence["terrainRgb"]))
        outside = torch.ones((1, 1, 192, 256), dtype=torch.bool)
        for role in ROLES:
            self.assertTrue(torch.equal(base_evidence["visibleObjectSupportMasks"][role],
                                        evidence["visibleObjectSupportMasks"][role]))
            outside &= ~evidence["visibleObjectSupportMasks"][role]
        self.assertTrue(torch.equal(expected[outside.expand_as(expected)], actual[outside.expand_as(actual)]))
        self.assertFalse(torch.equal(expected, actual), "the intended input ablation must be observable")
        candidate.train()
        with torch.no_grad():
            self.assertTrue(torch.equal(candidate(conditions, table), candidate(conditions, table)))
        self.assertTrue(torch.equal(source, conditions))
        self.assertEqual(instances, table)
        self.assertTrue(all(torch.equal(state[key], value) for key, value in candidate.state_dict().items()))

    def test_authoritative_instance_mismatch_is_still_rejected(self):
        candidate = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
        conditions, table = dry_scene()
        conditions[:, ORDER.index("object_tree")] = 0
        with self.assertRaisesRegex(ValueError, "authoritative role mask"):
            candidate(conditions, table)

    def test_zero_update_guard_allows_gradients_but_blocks_optimizer_and_loading(self):
        parameter = nn.Parameter(torch.tensor([2.0]))
        with checker.cpu_zero_update_guard():
            gradient, = torch.autograd.grad(parameter.square().sum(), parameter)
            self.assertEqual(float(gradient[0]), 4.0)
            self.assertIsNone(parameter.grad)
            with self.assertRaisesRegex(RuntimeError, "optimizer prohibited"):
                torch.optim.AdamW([parameter])
            with self.assertRaisesRegex(RuntimeError, "checkpoint load prohibited"):
                torch.load("unused-checkpoint")
        self.assertEqual(float(parameter[0].detach()), 2.0)

    def test_candidate_gradient_scope_rejects_validation_and_wrong_identity(self):
        candidate = build_fresh_object_local_context_isolation_v26_cpu(condition_channel_order=ORDER)
        with self.assertRaisesRegex(ValueError, "only bound train"):
            checker.validate_cpu_scope(candidate, {"split": "validation"})
        candidate.execution_qualified = True
        with self.assertRaisesRegex(ValueError, "inactive V26"):
            checker.validate_cpu_scope(candidate, {"split": "train"})


if __name__ == "__main__":
    unittest.main()

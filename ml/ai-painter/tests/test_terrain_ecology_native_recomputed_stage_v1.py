"""Pending managed CPU tests; this module never forwards a complete G.

Construction/strict state checks and small tensor segment VJPs are separate
from the later authenticated RGB/loss/five-full-gradient comparison.
"""
from contextlib import contextmanager
import unittest
from unittest.mock import patch

import torch
from torch import nn

from ai_painter.complete_world import terrain_ecology_native_bounded_stage_v1 as parent
from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as candidate
from ai_painter.complete_world import native_training_bounded_weight_vjp_v1 as bounded
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world.object_instance_supervision_cpu import ObjectView


@contextmanager
def segment_scope():
    owner = nn.Module()
    projection = nn.Module()
    projection.register_parameter('weight', nn.Parameter(torch.tensor(0.7)))
    season = torch.tensor([0., 1., 0., 0.])
    ecology = torch.tensor([0., 0., 0., 0., 0., 1., 0.])
    counts = candidate._new_counts()
    token = candidate._LEDGER.set((owner, counts))
    try:
        with candidate._BoundContexts((season, ecology, projection)):
            yield counts, projection, season, ecology
    finally:
        candidate._LEDGER.reset(token)


class NativeRecomputedIdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_three_stage_graph_bytes_five_targets_and_strict_roundtrip(self):
        for stage in range(3):
            geometry = NativeStageGeometry(stage)
            source = parent.build_fresh_terrain_ecology_native_bounded_stage(geometry=geometry)
            model = candidate.NativeRecomputedStageTerrainEcologyRenderer(source, geometry)
            candidate.validate_model_identity(model)
            self.assertEqual(len(tuple(model.parameters())), 109)
            self.assertEqual(sum(p.numel() for p in model.parameters()), 2243023)
            for (n, p), (other, q) in zip(source.named_parameters(), model.named_parameters()):
                self.assertEqual(n, other)
                self.assertTrue(torch.equal(p.detach().view(torch.uint8), q.detach().view(torch.uint8)))
                self.assertNotEqual(p.untyped_storage()._cdata, q.untyped_storage()._cdata)
            self.assertIs(type(model.get_submodule(parent.BOUNDED_TARGET)),
                          type(source.get_submodule(parent.BOUNDED_TARGET)))
            for index, path, channels in candidate.TARGETS:
                module = model.get_submodule(path)
                self.assertIs(type(module), bounded.NativeTrainingBoundedWeightConv)
                self.assertEqual(module.bound_target, path)
                self.assertEqual(tuple(model.named_parameters())[index][0], path + '.weight')
                self.assertEqual(tuple(module.weight.shape), (48, channels, 3, 3))
            state = {k: v.detach().clone() for k, v in model.state_dict().items()}
            parameters = tuple(model.parameters())
            pointers = tuple(p.data_ptr() for p in parameters)
            model.load_state_dict(state, strict=True)
            self.assertTrue(all(a is b for a, b in zip(parameters, model.parameters())))
            self.assertEqual(pointers, tuple(p.data_ptr() for p in model.parameters()))
            self.assertTrue(all(torch.equal(v, model.state_dict()[k]) for k, v in state.items()))
            with self.assertRaises(ValueError):
                parent.validate_model_identity(model)
            with self.assertRaises(ValueError):
                model.load_state_dict({k: v.detach().clone() for k, v in source.state_dict().items()})
            with self.assertRaises(ValueError):
                source.load_state_dict(state)

    def test_exact_identity_targets_geometry_and_execution_rule_refusals(self):
        model = candidate.build_fresh_terrain_ecology_native_recomputed_stage(geometry=NativeStageGeometry(0))
        module = model.get_submodule(candidate.TARGETS[0][1])
        target = module.bound_target
        module.bound_target = candidate.TARGETS[1][1]
        with self.assertRaisesRegex(ValueError, 'target'):
            candidate.validate_model_identity(model)
        module.bound_target = target
        model.execution_rule = 'unknown'
        with self.assertRaisesRegex(ValueError, 'identity'):
            candidate.validate_model_identity(model)
        del model.execution_rule
        model.core.core.appearance.base.native_stage_geometry = NativeStageGeometry(1)
        with self.assertRaisesRegex(ValueError, 'geometry'):
            candidate.validate_model_identity(model)
        model.core.core.appearance.base.native_stage_geometry = model.native_stage_geometry
        model.core.core.terrain.forward = lambda x: x
        with self.assertRaisesRegex(ValueError, 'forward'):
            candidate.validate_model_identity(model)
        del model.core.core.terrain.forward
        candidate.validate_model_identity(model)

    def test_failed_install_restores_parameters_modes_storage_and_extra_metadata(self):
        model = candidate.build_fresh_terrain_ecology_native_recomputed_stage(geometry=NativeStageGeometry(0))
        original = {k: v.detach().clone() for k, v in model.state_dict().items()}
        state = {k: v.clone() for k, v in original.items()}
        state['terrain_ecology_projection.weight'].fill_(0.125)
        parameters = tuple(model.parameters())
        pointers = tuple(p.data_ptr() for p in parameters)
        modes = tuple(m.training for m in model.modules())
        def broken(module, *unused):
            module.get_submodule(candidate.TARGETS[0][1]).bound_target = 'foreign'
            module.eval()
            module.get_submodule(candidate.TARGETS[0][1]).weight = nn.Parameter(torch.ones(48, 48, 3, 3))
            raise RuntimeError('intentional recomputed install failure')
        handle = model.register_load_state_dict_post_hook(broken)
        try:
            with self.assertRaisesRegex(RuntimeError, 'intentional recomputed install failure'):
                model.load_state_dict(state)
        finally:
            handle.remove()
        candidate.validate_model_identity(model)
        self.assertTrue(all(a is b for a, b in zip(parameters, model.parameters())))
        self.assertEqual(pointers, tuple(p.data_ptr() for p in model.parameters()))
        self.assertEqual(modes, tuple(m.training for m in model.modules()))
        self.assertTrue(all(torch.equal(v, model.state_dict()[k]) for k, v in original.items()))
        for kwargs in ({'strict': False}, {'assign': True}):
            with self.assertRaises(ValueError):
                model.load_state_dict(state, **kwargs)
        partial = dict(state)
        partial.pop(next(iter(partial)))
        with self.assertRaises(ValueError):
            model.load_state_dict(partial)


class NativeSegmentRecomputationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_five_retain_graph_vjps_restore_changed_contexts_rng_and_count_physical_calls(self):
        module = nn.Module()
        module.register_parameter('weight', nn.Parameter(torch.tensor(0.4)))
        x = torch.tensor(0.3, requires_grad=True)
        with segment_scope() as (counts, projection, season, ecology):
            def body(value):
                st, et, pt = (v.get() for v in candidate._CONTEXTS)
                return value.sin()*module.weight.square()*st[1] + et[5]*pt.weight.sin() + torch.rand_like(value)*value
            rng_before = torch.get_rng_state().clone()
            direct = body(x)
            direct_gradient = torch.autograd.grad(direct, module.weight)[0]
            torch.set_rng_state(rng_before)
            with candidate.set_checkpoint_early_stop(True):
                output = candidate._segment('base_stem', module, body, x)
            self.assertTrue(torch.equal(direct, output))
            saved_rng = torch.get_rng_state().clone()
            outside = (torch.tensor([1., 0., 0., 0.]), torch.tensor([1., 0., 0., 0., 0., 0., 0.]), nn.Module())
            observer = object()
            from ai_painter.complete_world import terrain_ecology_native_joint_priority_device_v1 as joint
            observer_token = joint._OBSERVER.set(observer)
            try:
                with candidate._BoundContexts(outside):
                    for i in range(5):
                        value, = torch.autograd.grad(output, (module.weight,), retain_graph=i < 4)
                        self.assertTrue(torch.equal(value, direct_gradient))
                        self.assertTrue(all(v.get() is expected for v, expected in zip(candidate._CONTEXTS, outside)))
                        self.assertIs(joint._OBSERVER.get(), observer)
                        self.assertTrue(torch.equal(saved_rng, torch.get_rng_state()))
            finally:
                joint._OBSERVER.reset(observer_token)
            self.assertTrue(all(v.get() is expected for v, expected in zip(candidate._CONTEXTS, (season, ecology, projection))))
            self.assertEqual(counts['segments']['base_stem'], dict(originalAttempts=1, originalCompleted=1,
                recomputeAttempts=5, recomputeCompleted=5, directAttempts=0, directCompleted=0))
        self.assertFalse(candidate._SEGMENT_RUNNING.get())

    def test_recomputation_exception_restores_context_rng_and_running_guard(self):
        module = nn.Module()
        module.register_parameter('weight', nn.Parameter(torch.tensor(0.5)))
        x = torch.tensor(0.2, requires_grad=True)
        fail = [False]
        with segment_scope() as (counts, projection, season, ecology):
            def body(value):
                result = value.sin()*module.weight.sin()
                if fail[0]:
                    raise RuntimeError('intentional recompute failure')
                return result
            output = candidate._segment('decoder', module, body, x)
            fail[0] = True
            outside = tuple(v.get() for v in candidate._CONTEXTS)
            rng = torch.get_rng_state().clone()
            with self.assertRaisesRegex(RuntimeError, 'intentional recompute failure'):
                torch.autograd.grad(output, module.weight)
            self.assertTrue(all(v.get() is expected for v, expected in zip(candidate._CONTEXTS, outside)))
            self.assertTrue(torch.equal(rng, torch.get_rng_state()))
            self.assertFalse(candidate._SEGMENT_RUNNING.get())
            self.assertEqual(counts['segments']['decoder']['recomputeAttempts'], 1)
            self.assertEqual(counts['segments']['decoder']['recomputeCompleted'], 0)

    def test_no_grad_eval_direct_and_unknown_or_recursive_dispatch_refused(self):
        module = nn.Module()
        x = torch.tensor(0.2)
        with segment_scope() as (counts, *unused):
            with torch.no_grad(), patch.object(candidate, 'checkpoint', side_effect=AssertionError('checkpoint in no_grad')):
                self.assertTrue(torch.equal(candidate._segment('decoder', module, lambda v: v.sin(), x), x.sin()))
            module.eval()
            with patch.object(candidate, 'checkpoint', side_effect=AssertionError('checkpoint in eval')):
                candidate._segment('decoder', module, lambda v: v.sin(), x)
            self.assertEqual(counts['segments']['decoder']['directCompleted'], 2)
            with self.assertRaisesRegex(ValueError, 'unknown'):
                candidate._segment('unknown', module, lambda v: v, x)
            with self.assertRaisesRegex(ValueError, 'recursive'):
                candidate._segment('decoder', module,
                    lambda v: candidate._segment('appearance', module, lambda q: q, v), x)
        self.assertFalse(candidate._SEGMENT_RUNNING.get())

    def test_parameter_and_non_gradient_dataclass_bindings_cannot_change_before_recompute(self):
        module = nn.Module()
        module.register_parameter('weight', nn.Parameter(torch.tensor(0.2)))
        x = torch.tensor(0.3, requires_grad=True)
        view = ObjectView(1, 'rock', 'object_rock', 0, 0,
                          torch.zeros(23, 2, 2), *(torch.ones(1, 2, 2) for _ in range(3)))
        with segment_scope():
            output = candidate._segment('appearance', module,
                lambda v, value: value.sin()*module.weight.square() + v.subject_conditions.sum()*value, view, x)
            object.__setattr__(view, 'left', 1)
            with self.assertRaisesRegex(ValueError, 'binding changed'):
                torch.autograd.grad(output, module.weight)
            object.__setattr__(view, 'left', 0)
            output = candidate._segment('appearance', module, lambda value: value.sin()*module.weight.square(), x)
            module.eval()
            with self.assertRaisesRegex(ValueError, 'binding changed'):
                torch.autograd.grad(output, module.weight)
            module.train()
            output = candidate._segment('appearance', module, lambda value: value.sin()*module.weight.square(), x)
            original = module.weight
            module.weight = nn.Parameter(original.detach().clone())
            try:
                with self.assertRaisesRegex(ValueError, 'binding changed'):
                    torch.autograd.grad(output, original)
            finally:
                module.weight = original

    def test_position_regularization_retains_real_terrain_patch_and_original_formula(self):
        source = parent.build_fresh_terrain_ecology_native_bounded_stage(geometry=NativeStageGeometry(0))
        appearance = candidate.RecomputedPositionRegularizedAppearance(source.core.core.appearance, source.condition_channel_order)
        patches = torch.ones(1, 48, 32, 32)
        view = ObjectView(1, 'rock', 'object_rock', 0, 0,
                          torch.zeros(23, 32, 32), *(torch.ones(1, 32, 32) for _ in range(3)))
        original_private = candidate.coordinate_free_views([view], source.condition_channel_order)
        seen = []
        def base_stub(views, values):
            self.assertIs(values, patches)
            self.assertEqual(float(values.sum()), 48*32*32)
            self.assertTrue(torch.equal(views[0].subject_conditions, original_private[0].subject_conditions))
            seen.append(True)
            return values.sum()
        with segment_scope(), torch.no_grad(), patch.object(appearance.base, 'forward', side_effect=base_stub):
            result = appearance([view], patches)
        self.assertEqual(len(seen), 1)
        self.assertEqual(float(result), 48*32*32)


if __name__ == '__main__':
    unittest.main()

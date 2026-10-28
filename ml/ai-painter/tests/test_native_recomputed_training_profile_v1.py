"""Pending CPU routing/protocol checks; no complete G/D forward or real VJP."""
import unittest
from unittest.mock import patch

import torch

import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
import painter_stage4_rock_background_training_profile_v1 as background
from ai_painter.complete_world import terrain_ecology_native_recomputed_stage_v1 as identity
from ai_painter.complete_world import terrain_ecology_native_bounded_stage_v1 as old_identity
from ai_painter.complete_world import terrain_ecology_native_joint_priority_device_v1 as joint
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER


class NativeRecomputedProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_default_old_family_is_unchanged_and_native_requires_registered_geometry(self):
        old, _ = profile.fresh_networks(ORDER)
        self.assertEqual(old.capability_version, profile.MODEL_CAPABILITY)
        self.assertIsNone(profile._recomputed_identity(old))
        self.assertEqual(profile._geometry_kwargs(old), {})
        native_old, _ = profile.fresh_networks(ORDER, model_capability=old_identity.CAPABILITY, geometry=NativeStageGeometry(0))
        self.assertIs(type(native_old), old_identity.NativeBoundedStageTerrainEcologyRenderer)
        self.assertEqual(profile._geometry_kwargs(native_old), {'geometry': NativeStageGeometry(0)})
        for wrong in (None, True, (256, 192), {'stage': 0}):
            with self.assertRaises(ValueError):
                profile.fresh_networks(ORDER, model_capability=identity.CAPABILITY, geometry=wrong)
        with self.assertRaises(ValueError):
            profile.fresh_networks(ORDER, model_capability='unknown', geometry=NativeStageGeometry(0))

    def test_three_geometry_routes_heads_and_forward_scope_rejections(self):
        for stage in range(3):
            geometry = NativeStageGeometry(stage)
            model, _ = profile.fresh_networks(ORDER, model_capability=identity.CAPABILITY, geometry=geometry)
            self.assertIs(type(model), identity.NativeRecomputedStageTerrainEcologyRenderer)
            self.assertEqual(profile._geometry_kwargs(model), {'geometry': geometry})
            parameters, groups, season, ecology = profile.bind_parameters(model)
            self.assertEqual(len(parameters), 109)
            self.assertEqual(sum(len(v) for v in groups.values()), 16)
            self.assertEqual(sum(parameters[i].numel() for v in groups.values() for i in v), 4876)
            self.assertEqual((season, ecology), (78, 79))
            with self.assertRaisesRegex(ValueError, 'train/validation'):
                profile.sample_forward(model, {'split': 'challenge'})
            with self.assertRaisesRegex(ValueError, 'read-only'):
                profile.sample_forward(model, {'split': 'validation'})
            with self.assertRaisesRegex(ValueError, 'support weight0.1'):
                profile._generator_candidate(model, None, {}, ORDER, None, support_structure_weight=1.0)
            token = background._BOUNDARY.set({'synthetic': True})
            try:
                with self.assertRaisesRegex(ValueError, 'boundary'):
                    background.sample_forward(model, {})
                with self.assertRaisesRegex(ValueError, 'boundary'):
                    background._generator_candidate(model, None, {}, ORDER, None)
            finally:
                background._BOUNDARY.reset(token)

    def test_new_family_uses_original108_arithmetic_carrier_and109th_gate(self):
        model = identity.build_fresh_terrain_ecology_native_recomputed_stage(geometry=NativeStageGeometry(0))
        saved = {n: p.detach().clone() for n, p in model.named_parameters()}
        carrier = joint._cpu_carrier(model)
        joint._verify_carrier(model, carrier)
        self.assertNotEqual(carrier.capability_version, model.capability_version)
        self.assertEqual(len(tuple(carrier.parameters())), 108)
        for (n, p), (other, q) in zip(tuple(model.named_parameters())[:108], carrier.named_parameters()):
            self.assertEqual(n, other)
            self.assertTrue(torch.equal(p.detach().view(torch.uint8), q.detach().view(torch.uint8)))
            self.assertNotEqual(p.untyped_storage()._cdata, q.untyped_storage()._cdata)
        rows = [torch.ones(48, 7)*4, *(torch.ones(48, 7) for _ in range(4))]
        joint._additional_nonhead_gate(rows)
        rows[0][0, 0] += 0.01
        with self.assertRaisesRegex(ValueError, 'parameter 108'):
            joint._additional_nonhead_gate(rows)
        self.assertTrue(all(torch.equal(v, dict(model.named_parameters())[n]) for n, v in saved.items()))

    def test_original_five_grad_call_order_masks_observer_and_full_nonhead_provenance(self):
        model = identity.build_fresh_terrain_ecology_native_recomputed_stage(geometry=NativeStageGeometry(0))
        parameters = tuple(model.parameters())
        critic = torch.nn.Module().eval()
        sample = dict(split='train', image=torch.zeros(3, 192, 256), conditions=torch.zeros(23, 192, 256))
        one = torch.tensor(1., requires_grad=True)
        total = (((one + one) + one) + one)
        calls, events = [], []
        def fake_grad(loss, actual_parameters, **kwargs):
            calls.append((loss, actual_parameters, kwargs))
            coefficient = 4 if len(calls) == 1 else 1
            return tuple(torch.ones_like(p)*coefficient for p in actual_parameters)
        def observer(stage, label, values):
            events.append((stage, label))
        with patch.object(joint.torch.autograd, 'grad', side_effect=fake_grad), joint.observe_generator_gradients(observer):
            result, facts = profile.compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
                actual_total=total, structured_objective=one, whole_frame_fidelity=one,
                object_core_rgb=one, object_support_structure=one)
        self.assertEqual(len(calls), 5)
        for i, (_, bound, kwargs) in enumerate(calls):
            self.assertTrue(all(a is b for a, b in zip(bound, parameters)))
            self.assertEqual(kwargs, dict(retain_graph=i < 4, create_graph=False, allow_unused=True))
        self.assertEqual(events, [(stage, label) for label in joint.COMPONENTS_IN_ORDER for stage in ('attempt', 'complete')])
        self.assertEqual(facts['independentFullParameterGradientTensorCounts'], [109]*5)
        self.assertTrue(facts['additionalNonheadGradientGatePassed'])
        self.assertTrue(facts['carrierOriginal108ParameterNamesShapesBytesVerified'])
        self.assertEqual(len(result), 109)
        self.assertTrue(all(p.grad is None for p in model.parameters()))

    def test_profile_counters_are_external_and_preserved_on_failure(self):
        model = identity.build_fresh_terrain_ecology_native_recomputed_stage(geometry=NativeStageGeometry(0))
        before = tuple(model.__dict__)
        @profile._record_native_execution
        def fake_success(model):
            with identity.execution_call_scope(model) as ledger:
                ledger['logicalGeneratorAttempts'] += 1
                ledger['logicalGeneratorCompleted'] += 1
            return {'passed': True}
        result = fake_success(model)
        self.assertEqual(result['nativeExecutionCalls']['logicalGeneratorCompleted'], 1)
        self.assertEqual(tuple(model.__dict__), before)
        self.assertIsNone(identity._LEDGER.get())
        @profile._record_native_execution
        def fake_failure(model, *, failure_evidence):
            raise RuntimeError('intentional native profile failure')
        evidence = {}
        with self.assertRaisesRegex(RuntimeError, 'intentional native profile failure') as caught:
            fake_failure(model, failure_evidence=evidence)
        self.assertEqual(caught.exception.native_execution_calls, evidence['nativeExecutionCalls'])
        self.assertIsNone(identity._LEDGER.get())
        self.assertEqual(tuple(model.__dict__), before)


if __name__ == '__main__':
    unittest.main()

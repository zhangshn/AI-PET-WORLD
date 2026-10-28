"""Synthetic routing and original D math only; model forwards are not called."""
import unittest
from unittest.mock import patch
import torch
import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
import painter_stage4_rock_background_training_profile_v1 as background
from ai_painter.complete_world import terrain_ecology_native_bounded_stage_v1 as identity
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER


class TensorCritic(torch.nn.Module):
    def __init__(self):
        super().__init__(); self.coefficient = torch.tensor(0.7, requires_grad=True)
    def forward(self, value):
        return self.coefficient * value.mean(1, keepdim=True)


def sample(g):
    generator = torch.Generator().manual_seed(105)
    return dict(sampleId='synthetic', split='train', conditions=torch.rand(23, g.height, g.width, generator=generator),
        image=torch.rand(3, g.height, g.width, generator=generator), objectInstanceTable=[],
        appearance_regime=torch.tensor([1., 0., 0., 0.]), ecology_regime=torch.tensor([1., 0., 0., 0., 0., 0., 0.]))


class NativeProfileRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_legacy_factory_default_and_native_required_geometry(self):
        model, _ = profile.fresh_networks(ORDER)
        self.assertEqual(model.capability_version, profile.MODEL_CAPABILITY)
        self.assertEqual(profile._geometry_kwargs(model), {})
        for wrong in (None, True, (256, 192), {'stage': 0}):
            with self.assertRaises(ValueError):
                profile.fresh_networks(ORDER, model_capability=identity.CAPABILITY, geometry=wrong)
        with self.assertRaises(ValueError):
            profile.fresh_networks(ORDER, geometry=NativeStageGeometry(0))

    def test_three_stage_shapes_and_mismatch_no_full_forward(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            model, critic = profile.fresh_networks(ORDER, model_capability=identity.CAPABILITY, geometry=g)
            self.assertIs(type(model), identity.NativeBoundedStageTerrainEcologyRenderer)
            self.assertEqual(profile._geometry_kwargs(model), {'geometry': g})
            data = sample(g)
            with patch.object(profile, 'validate_sample_ecology', return_value=(data['appearance_regime'], None)):
                bound = profile._bound_device(model, data)
                self.assertEqual(bound['conditions'].shape, (23, g.height, g.width))
                data['native_stage_geometry'] = NativeStageGeometry((stage+1) % 3)
                with self.assertRaises(ValueError):
                    profile._bound_device(model, data)
                del data['native_stage_geometry']
                data['image'] = data['image'][:, :-1]
                with self.assertRaises(ValueError):
                    profile._bound_device(model, data)
            data['split'] = 'challenge'
            with self.assertRaises(ValueError):
                profile.sample_forward(model, data)
            data['split'] = 'validation'
            with self.assertRaisesRegex(ValueError, 'read-only'):
                profile.sample_forward(model, data)

    def test_native_boundary_scope_and_support_weight_refusal_before_forward(self):
        model, _ = profile.fresh_networks(ORDER, model_capability=identity.CAPABILITY, geometry=NativeStageGeometry(0))
        token = background._BOUNDARY.set({'synthetic': True})
        try:
            with self.assertRaisesRegex(ValueError, 'boundary'):
                background.sample_forward(model, sample(NativeStageGeometry(0)))
            with self.assertRaisesRegex(ValueError, 'boundary'):
                background._generator_candidate(model, None, {}, ORDER, None)
        finally:
            background._BOUNDARY.reset(token)
        with self.assertRaisesRegex(ValueError, 'support weight0.1'):
            profile._generator_candidate(model, None, {}, ORDER, None, support_structure_weight=1.0)

    def test_d_original_cpu_math_and_detachment_geometry_routes(self):
        for stage in range(3):
            g = NativeStageGeometry(stage)
            data = sample(g)
            prediction = (data['image'][None]*0.7).requires_grad_()
            critic = TensorCritic()
            value, parts = profile.inherited._d_objective(critic, prediction, data, torch.device('cpu'), geometry=g)
            gradient = torch.autograd.grad(value, (prediction, critic.coefficient), allow_unused=True)
            self.assertIsNone(gradient[0]); self.assertTrue(torch.isfinite(gradient[1]))
            if stage == 0:
                old_critic = TensorCritic()
                old, old_parts = profile.inherited._d_objective(old_critic, prediction, data, torch.device('cpu'))
                old_gradient, = torch.autograd.grad(old, (old_critic.coefficient,))
                self.assertTrue(torch.equal(value, old) and torch.equal(gradient[1], old_gradient))
                self.assertTrue(all(torch.equal(parts[k], old_parts[k]) for k in parts))


if __name__ == '__main__':
    unittest.main()

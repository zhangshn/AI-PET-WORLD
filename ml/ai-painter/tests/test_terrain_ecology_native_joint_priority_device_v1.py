"""Native identity/carrier/gate components only; no full-model autograd."""
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world import terrain_ecology_native_bounded_stage_v1 as identity
from ai_painter.complete_world import terrain_ecology_native_joint_priority_device_v1 as candidate
from ai_painter.complete_world.native_stage_geometry_v1 import NativeStageGeometry


class NativeJointComponents(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_three_stage_parameter_groups_and_byte_verified_arithmetic_carrier(self):
        for stage in range(3):
            model = identity.build_fresh_terrain_ecology_native_bounded_stage(geometry=NativeStageGeometry(stage))
            parameters, groups, season, ecology = candidate.bind_parameters(model)
            self.assertEqual(len(parameters), 109)
            self.assertEqual(sum(p.numel() for p in parameters), 2243023)
            self.assertEqual(sum(len(v) for v in groups.values()), 16)
            self.assertEqual(sum(parameters[i].numel() for rows in groups.values() for i in rows), 4876)
            self.assertIs(parameters[season], candidate.seasonal_parameter(model))
            self.assertIs(parameters[ecology], candidate.ecological_parameter(model))
            import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
            callback = lambda *unused: None
            with profile.observe_generator_gradients(callback):
                self.assertIs(candidate._OBSERVER.get(), callback)
            carrier = candidate._cpu_carrier(model)
            candidate._verify_carrier(model, carrier)
            self.assertEqual(len(tuple(carrier.parameters())), 108)
            with torch.no_grad():
                next(carrier.parameters()).add_(0.1)
            with self.assertRaisesRegex(ValueError, 'carrier full parameter'):
                candidate._verify_carrier(model, carrier)

    def test_original109th_total_gradient_gate_and_metadata_refusal(self):
        parts = [torch.full((48, 7), v) for v in (0.125, -0.0625, 0.03125, 0.015625)]
        total = ((parts[0]+parts[1])+parts[2])+parts[3]
        candidate._additional_nonhead_gate((total, *parts))
        wrong = total.clone(); wrong[0, 0] += 0.01
        with self.assertRaisesRegex(ValueError, 'parameter 108'):
            candidate._additional_nonhead_gate((wrong, *parts))
        with self.assertRaises(ValueError):
            candidate._additional_nonhead_gate((total.double(), *parts))
        self.assertEqual(candidate.frozen.TOTAL_GRADIENT_ATOL, 1e-6)
        self.assertEqual(candidate.frozen.TOTAL_GRADIENT_RTOL, 1e-5)

    def test_original108_arithmetic_gate_rejects_nonmatching_total(self):
        model = identity.build_fresh_terrain_ecology_native_bounded_stage(geometry=NativeStageGeometry(0))
        carrier = candidate._cpu_carrier(model)
        parameters = tuple(carrier.parameters())
        zero = tuple(torch.zeros_like(p) for p in parameters)
        wrong = list(zero); wrong[0] = wrong[0].clone(); wrong[0].view(-1)[0] = 1
        with self.assertRaisesRegex(ValueError, 'parameter 0'):
            candidate.frozen.apply_object_joint_rgb_structure_priority_update_cpu(
                model=carrier, parameters=parameters, total_gradients=wrong,
                structured_gradients=zero, whole_frame_gradients=zero,
                core_gradients=zero, support_gradients=zero)

    def test_wrong_scalar_order_rejected_before_autograd(self):
        model = identity.build_fresh_terrain_ecology_native_bounded_stage(geometry=NativeStageGeometry(0))
        critic = torch.nn.Linear(1, 1).eval().requires_grad_(False)
        sample = dict(split='train', image=torch.zeros(3, 192, 256), conditions=torch.zeros(23, 192, 256))
        terms = [torch.tensor(v, requires_grad=True) for v in (0.1, 0.2, 0.3, 0.4)]
        with patch.object(torch.autograd, 'grad', side_effect=AssertionError('component must not differentiate model')):
            with self.assertRaisesRegex(ValueError, 'ordered four-term scalar'):
                candidate.compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
                    actual_total=sum(terms)+1, structured_objective=terms[0], whole_frame_fidelity=terms[1],
                    object_core_rgb=terms[2], object_support_structure=terms[3])


if __name__ == '__main__':
    unittest.main()

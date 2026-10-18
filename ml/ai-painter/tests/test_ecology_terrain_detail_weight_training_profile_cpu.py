"""Actual four independent CPU VJPs over the full graph; no model forward/update."""
import ast
import inspect
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
import torch

ROOT = Path(__file__).absolute().parents[3]
for part in ("ml/ai-painter/scripts", "ml/ai-painter/src"):
    sys.path.insert(0, str(ROOT / part))
import painter_stage4_ecology_terrain_detail_weight_training_profile_v1 as profile
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as model_type
from ai_painter.complete_world import object_ecology_terrain_detail_weight_priority_update_v1 as bridge
from ai_painter.complete_world import object_ecology_regime_conditioned as old

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())


class Decode1ProfileCpuTests(unittest.TestCase):
    def test_factory_is_exact_new_model_and_deterministic(self):
        rng = torch.get_rng_state().clone()
        model, critic = profile.fresh_networks(ORDER)
        self.assertIs(type(model), model_type.TerrainDetailWeightPrecisionEcologyRenderer)
        self.assertEqual(len(tuple(model.parameters())), 108)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertEqual(profile.MODEL_CAPABILITY, model_type.CAPABILITY)
        self.assertEqual(profile.CAPABILITY, model_type.CAPABILITY.removesuffix("_v1") + "_quality24_v1")
        self.assertIs(profile.compute_generator_candidate_gradients, bridge.compute_generator_candidate_gradients)

    def test_actual_four_full_graph_vjps_same_total_and_head_gate(self):
        model, critic = profile.fresh_networks(ORDER)
        critic.eval().requires_grad_(False)
        parameters = tuple(model.parameters())
        self.assertEqual(bridge.bind_parameters(model)[0], parameters)
        value = sum(parameter.sum() for parameter in parameters)
        structured, whole, core = value, value * .5, value * .25
        total = (structured + whole) + core
        completed = []
        original = torch.autograd.grad
        def observe(event, label, raw):
            if event == "complete":
                completed.append((label, len(raw)))
        with patch.object(torch.nn.Module, "_call_impl", side_effect=AssertionError("no model forward")), \
             patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("no optimizer")), \
             patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("no CUDA")), \
             patch.object(torch.autograd, "grad", wraps=original) as gradients, bridge.observe_generator_gradients(observe):
            candidate, facts = bridge.compute_generator_candidate_gradients(model=model, critic=critic,
                sample={"split": "train", "conditions": torch.zeros(23, 1, 1), "image": torch.zeros(3, 1, 1)},
                actual_total=total, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)
        self.assertEqual(gradients.call_count, 4)
        self.assertEqual(completed, [(label, 108) for label in ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb")])
        self.assertTrue(all(torch.equal(value, torch.full_like(value, 1.75)) for value in candidate))
        self.assertEqual(facts["candidateId"], model_type.CAPABILITY)
        self.assertTrue(all(parameter.grad is None for parameter in parameters))
        self.assertTrue(all(parameter.grad is None for parameter in critic.parameters()))

    def test_old_exact_model_is_refused_by_bridge(self):
        with torch.random.fork_rng(devices=[]):
            model = old.build_fresh_object_ecology_regime_conditioned(condition_channel_order=ORDER)
        with self.assertRaises(ValueError):
            bridge.bind_parameters(model)

    def test_fake_ecology_binding_and_nontrain_sources_refused(self):
        with self.assertRaises(ValueError):
            profile.validate_sample_ecology({"split": "train", "sampleId": "synthetic"})
        model, critic = profile.fresh_networks(ORDER)
        critic.eval().requires_grad_(False)
        scalar = sum(parameter.sum() for parameter in model.parameters())
        with self.assertRaisesRegex(ValueError, "non-train"):
            bridge.compute_generator_candidate_gradients(model=model, critic=critic, sample={"split": "validation"},
                actual_total=scalar, structured_objective=scalar, whole_frame_fidelity=scalar, object_core_rgb=scalar)

    def test_pair_has576_bounds_and_unmodified_loss_source(self):
        source = inspect.getsource(profile.perform_pair)
        self.assertEqual(inspect.signature(profile.perform_pair).parameters["update_limit"].default, 576)
        self.assertIn('counts, update_limit, resource', source)
        self.assertIn('limit=update_limit', source)
        self.assertIs(profile.train_object_core_fidelity_candidate_objective,
            __import__('ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu', fromlist=['train_object_core_fidelity_candidate_objective']).train_object_core_fidelity_candidate_objective)
        self.assertFalse(any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "backward"
                             for node in ast.walk(ast.parse(inspect.getsource(bridge.compute_generator_candidate_gradients)))))

    def test_explicit_update_limit_reaches_both_original_commit_paths(self):
        from types import SimpleNamespace
        model, critic = profile.fresh_networks(ORDER)
        sample = {"split": "train", "sampleId": "synthetic", "conditions": torch.zeros(23, 1, 1), "image": torch.zeros(3, 1, 1)}
        optimizer = SimpleNamespace(zero_grad=lambda **kwargs: None)
        loss = torch.tensor(.25)
        for limit in (576, 1152):
            counts = {"generator": 0, "discriminator": 0}; ledger = {"sampleId": "synthetic", "generator": 0, "discriminator": 0}
            def d_commit(opt, loss, network, bound, kind, actual, actual_limit, resource):
                self.assertEqual(actual_limit, limit); actual[kind] += 1
            def g_commit(**kwargs):
                self.assertEqual(kwargs["limit"], limit); kwargs["counts"]["generator"] += 1
            with patch.object(profile, "_bound_device", return_value=sample), patch.object(profile, "sample_forward", return_value=loss), \
                patch.object(profile, "_d_objective", return_value=(loss, {})), patch.object(profile, "_phase"), \
                patch.object(profile, "_critic_state", return_value="unchanged"), patch.object(profile.v24, "_require_critic_phase"), \
                patch.object(profile, "_generator_candidate", return_value=(loss, (), {})), \
                patch.object(profile.core.v21, "update_network", side_effect=d_commit), patch.object(profile, "commit_generator_step", side_effect=g_commit):
                profile.perform_pair(model, critic, sample, ORDER, optimizer, optimizer, counts, ledger, lambda: None, None, update_limit=limit)
            self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        for invalid in (True, 1152.0, 577, 1153, None):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                profile.perform_pair(None, None, {}, (), None, None, {}, {}, None, None, update_limit=invalid)


if __name__ == "__main__":
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    import psutil
    process = psutil.Process()
    process.cpu_affinity(process.cpu_affinity()[:2])
    unittest.main()

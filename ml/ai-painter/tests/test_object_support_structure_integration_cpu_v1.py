"""Synthetic CPU only: real 108-parameter VJPs, never renderer forwards/data."""
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import random
import sys
import time
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = os.environ["MKL_NUM_THREADS"] = "2"
ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
import numpy as np
import torch
from ai_painter.complete_world import object_support_structure_priority_update_cpu_v1 as bridge
import painter_stage4_object_support_structure_training_profile_cpu_v1 as profile

ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())
STARTED = time.monotonic()


class IntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2:
            torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process()
        process.cpu_affinity(process.cpu_affinity()[:2])
        cls.model, cls.critic = profile.fresh_networks(ORDER)
        cls.parameters, cls.groups, cls.season, cls.ecology = bridge.bind_parameters(cls.model)
        cls.sample = {"split": "train", "image": torch.zeros(3, 192, 256),
            "conditions": torch.zeros(23, 192, 256), "objectInstanceTable": {}}

    def setUp(self):
        self.assertLess(time.monotonic() - STARTED, 120)
        self.critic.eval().requires_grad_(False)
        self.guards = ExitStack()
        self.addCleanup(self.guards.close)
        for owner, key in ((torch, "load"), (torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__")):
            self.guards.enter_context(patch.object(owner, key, side_effect=AssertionError("prohibited operation")))
        # No test may accidentally invoke the actual renderer or critic.
        self.guards.enter_context(patch.object(torch.nn.Module, "_call_impl", side_effect=AssertionError("real forward prohibited")))

    def components(self, factors=(1., .5, .25, .125), *, unused=False):
        base = self.parameters[0].sum() if unused else sum(p.sum() for p in self.parameters)
        s, w, c, support = (base * v for v in factors)
        total = (((s.float() + w).float() + c).float() + support)
        return dict(actual_total=total, structured_objective=s, whole_frame_fidelity=w,
            object_core_rgb=c, object_support_structure=support)

    def compute(self, values=None, **kwargs):
        return bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic,
            sample=self.sample, **(self.components() if values is None else values), **kwargs)

    def rows(self, value):
        return tuple(torch.full_like(p, value) for p in self.parameters)

    def apply(self, actual=1.875, s=1., w=.5, c=.25, support=.125, **overrides):
        fields = dict(model=self.model, parameters=self.parameters, total_gradients=self.rows(actual),
            structured_gradients=self.rows(s), whole_frame_gradients=self.rows(w),
            core_gradients=self.rows(c), support_gradients=self.rows(support))
        fields.update(overrides)
        return bridge.apply_object_support_structure_priority_update_cpu(**fields)

    def test_real_five_full_vjps_identity_and_no_updates(self):
        raw = []
        before = profile._network_snapshot(self.model)
        with bridge.observe_generator_gradients(lambda stage, label, rows: raw.append((label, rows)) if stage == "complete" else None):
            with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
                candidate, facts = self.compute()
        self.assertEqual(grad.call_count, 5)
        self.assertEqual([label for label, _ in raw], list(bridge.COMPONENTS_IN_ORDER))
        self.assertEqual([len(rows) for _, rows in raw], [108] * 5)
        self.assertTrue(all(a is b for a, b in zip(candidate, raw[0][1])))
        self.assertIs(candidate[self.season], raw[0][1][self.season])
        self.assertIs(candidate[self.ecology], raw[0][1][self.ecology])
        self.assertEqual(before, profile._network_snapshot(self.model))
        self.assertTrue(facts["actualTotalProvenanceVerified"])
        self.assertEqual(facts["independentFullParameterGradientTensorCounts"], [108] * 5)
        json.dumps(facts, allow_nan=False)

    def test_support_independently_changes_conflict_only_heads(self):
        raw = []
        with bridge.observe_generator_gradients(lambda stage, label, rows: raw.append(rows) if stage == "complete" else None):
            candidate, facts = self.compute(self.components((.5, .5, 1., -3.)))
        owned = {i for indexes in self.groups.values() for i in indexes}
        for i in range(108):
            if i in owned:
                self.assertTrue(torch.equal(candidate[i], torch.ones_like(candidate[i])))
            else:
                self.assertIs(candidate[i], raw[0][i])
        for value in facts["headDiagnostics"].values():
            self.assertEqual(value["branch"], "conflict_projected")
            self.assertGreater(value["supportL2"], 0)

    def test_na_support_still_real_fifth_vjp(self):
        candidate, facts = self.compute(self.components((1., .5, .25, 0.)))
        self.assertEqual(facts["autogradGradCalls"], 5)
        self.assertTrue(all(v["supportL2"] == 0 for v in facts["headDiagnostics"].values()))
        self.assertEqual(len(candidate), 108)

    def test_unused_components_normalize_to_explicit_zero(self):
        _, facts = self.compute(self.components(unused=True))
        self.assertEqual(facts["unusedGradientIndexes"]["actualTotal"], list(range(1, 108)))

    def test_core_zero_preserves_actual_bytes(self):
        _, facts = self.apply(actual=1.625, c=0.)
        self.assertTrue(all(v["branch"] == "core_zero_preserve_actual_total" for v in facts["headDiagnostics"].values()))

    def test_wrong_total_and_missing_support_rejected(self):
        for total in (2., 1.75):
            with self.subTest(total=total), self.assertRaisesRegex(ValueError, "total gradient identity"):
                self.apply(actual=total)

    def test_ordered_fp32_sum_not_reassociated(self):
        self.apply(actual=2., s=1e8, w=-1e8, c=1., support=1.)
        with self.assertRaisesRegex(ValueError, "total gradient identity"):
            self.apply(actual=0., s=1e8, w=-1e8, c=1., support=1.)

    def test_nan_gradient_shape_and_missing_component_rejected(self):
        bad = list(self.rows(.125)); bad[60] = bad[60].clone(); bad[60].flatten()[0] = float("nan")
        for rows in (bad, self.rows(.125)[:-1], (torch.tensor(0.),) + self.rows(.125)[1:]):
            with self.subTest(kind=len(rows)), self.assertRaises(ValueError):
                self.apply(support_gradients=rows)

    def test_wrong_scalar_nan_detached_and_dtype_before_autograd(self):
        for change in (lambda v: v + 1, lambda v: v * float("nan"), lambda v: v.detach(), lambda v: v.double()):
            values = self.components(); values["actual_total"] = change(values["actual_total"])
            with patch.object(torch.autograd, "grad") as grad, self.assertRaises(ValueError):
                self.compute(values)
            grad.assert_not_called()

    def test_nontrain_and_attached_source_rejected(self):
        for sample in ({**self.sample, "split": "validation"},
                {**self.sample, "conditions": self.sample["conditions"].clone().requires_grad_()}):
            with patch.object(torch.autograd, "grad") as grad, self.assertRaises(ValueError):
                bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic,
                    sample=sample, **self.components())
            grad.assert_not_called()

    def test_critic_eval_and_frozen_required(self):
        self.critic.train()
        with self.assertRaisesRegex(ValueError, "frozen eval"): self.compute()
        self.critic.eval(); next(self.critic.parameters()).requires_grad_(True)
        try:
            with self.assertRaisesRegex(ValueError, "frozen eval"): self.compute()
        finally: self.critic.requires_grad_(False)

    def test_wrong_parameter_order_fake_model_and_alias_rejected(self):
        with self.assertRaises(ValueError): self.apply(parameters=self.parameters[::-1])
        with self.assertRaises(ValueError): bridge.bind_parameters(torch.nn.Linear(2, 2))
        self.model.register_parameter("synthetic_alias", self.parameters[0])
        try:
            with self.assertRaises(ValueError): bridge.bind_parameters(self.model)
        finally: del self.model._parameters["synthetic_alias"]

    def test_profile_objective_passes_frozen_four_parts_to_real_bridge(self):
        values = self.components()
        parts = {"v21UnchangedTotal": values["structured_objective"], "wholeFrameFidelity": values["whole_frame_fidelity"],
            "objectCoreRgbWeighted": values["object_core_rgb"], "objectSupportStructureWeighted": values["object_support_structure"],
            "objectCoreFidelityUnchangedParts": {"sentinel": 17}}
        # This fixture replaces only the RGB objective/source authentication; all five VJPs are real.
        with patch.object(profile, "validate_sample_ecology"), patch.object(profile,
                "train_object_support_structure_candidate_objective", return_value=(values["actual_total"], parts)) as objective:
            total, actual_parts, candidate, facts = profile.generator_objective_and_gradients(
                self.model, self.critic, self.sample, ORDER, torch.zeros(1))
        self.assertIs(total, values["actual_total"]); self.assertIs(actual_parts, parts)
        self.assertEqual(facts["scalarValues"]["objectSupportStructure"], float(values["object_support_structure"].detach()))
        self.assertEqual(facts["autogradGradCalls"], 5)
        self.assertEqual(len(candidate), 108)
        self.assertIs(objective.call_args.args[2], self.sample)

    def test_profile_objective_nan_fails_before_grad(self):
        values = self.components(); values["object_support_structure"] = values["object_support_structure"] * float("nan")
        parts = dict(zip(("v21UnchangedTotal", "wholeFrameFidelity", "objectCoreRgbWeighted", "objectSupportStructureWeighted"),
            (values[k] for k in ("structured_objective", "whole_frame_fidelity", "object_core_rgb", "object_support_structure"))))
        with patch.object(profile, "validate_sample_ecology"), patch.object(profile,
                "train_object_support_structure_candidate_objective", return_value=(values["actual_total"], parts)), \
                patch.object(torch.autograd, "grad") as grad, self.assertRaises(ValueError):
            profile.generator_objective_and_gradients(self.model, self.critic, self.sample, ORDER, torch.zeros(1))
        grad.assert_not_called()

    def test_actual_frozen_objective_to_bridge_with_synthetic_rgb_and_critic(self):
        # Synthetic RGB expression only; never invokes the renderer or any real data reader.
        class SyntheticCritic(torch.nn.Module):
            def __call__(self, values):
                return values[:, -3:].mean((1, 2, 3), keepdim=True)
        yy, xx = torch.meshgrid(torch.arange(192, dtype=torch.float32), torch.arange(256, dtype=torch.float32), indexing="ij")
        image = torch.stack([.5 + .15 * torch.sin(xx * (.13 + i*.03)) + .15 * torch.cos(yy * (.17 + i*.02)) for i in range(3)])
        conditions = torch.zeros(23, 192, 256); conditions[ORDER.index("terrain_grass")] = 1
        table = []
        for x, y, label, kind, role in ((40, 40, 7, "tree", "object_tree"),
                (100, 70, 13, "rock", "object_rock"), (160, 120, 21, "shrub", "object_vegetation")):
            for key in ("object_footprints", role): conditions[ORDER.index(key), y:y+4, x:x+4] = 1
            conditions[ORDER.index("object_instance"), y:y+4, x:x+4] = label / 255
            table.append({"value": label, "kind": kind, "footprint": {"x": x*4, "y": y*4, "width": 16, "height": 16}})
        sample = {"sampleId": "synthetic-only", "split": "train", "image": image,
            "conditions": conditions, "objectInstanceTable": table}
        prediction = (.25 + .4 * image.flip(-1) + .01 * self.parameters[0].mean().tanh())[None]
        critic = SyntheticCritic().eval()
        with patch.object(profile, "validate_sample_ecology"), patch.object(profile,
                "compute_generator_candidate_gradients", wraps=bridge.compute_generator_candidate_gradients) as differentiated:
            total, parts, _, facts = profile.generator_objective_and_gradients(self.model, critic, sample, ORDER, prediction)
        for argument, part in (("structured_objective", "v21UnchangedTotal"),
                ("whole_frame_fidelity", "wholeFrameFidelity"), ("object_core_rgb", "objectCoreRgbWeighted"),
                ("object_support_structure", "objectSupportStructureWeighted")):
            self.assertIs(differentiated.call_args.kwargs[argument], parts[part])
        self.assertIs(differentiated.call_args.kwargs["actual_total"], total)
        self.assertEqual(facts["autogradGradCalls"], 5)
        self.assertEqual(parts["objectSupportStructureStatus"], "applicable")
        self.assertEqual(parts["objectSupportStructureApplicableRoleCount"], 3)
        old = parts["objectCoreFidelityUnchangedParts"]
        self.assertTrue(all(parts[key] is value for key, value in old.items() if key != "total"))
        self.assertIs(parts["objectCoreFidelityUnchangedTotal"], old["total"])
        json.dumps(profile._plain(parts), allow_nan=False)

    def test_state_guard_restores_modes_flags_on_success(self):
        model, critic = torch.nn.Linear(2, 2), torch.nn.Linear(2, 2)
        model.eval(); critic.train()
        with profile._preserve_probe_state(model, critic):
            model.train(); critic.eval().requires_grad_(False)
        self.assertFalse(model.training); self.assertTrue(critic.training)
        self.assertTrue(all(p.requires_grad for p in critic.parameters()))

    def test_rng_mutation_fails_and_restores_all_cpu_rng(self):
        a, b = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        py, npstate, rng = random.getstate(), np.random.get_state(), torch.get_rng_state().clone()
        with self.assertRaisesRegex(ValueError, "RNG changed"):
            with profile._preserve_probe_state(a, b):
                random.random(); np.random.random(); torch.rand(1)
        self.assertEqual(random.getstate(), py); self.assertTrue(np.array_equal(np.random.get_state()[1], npstate[1]))
        self.assertTrue(torch.equal(torch.get_rng_state(), rng))

    def test_primary_preserved_with_rng_secondary(self):
        primary = RuntimeError("synthetic primary")
        a, b = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        rng = torch.get_rng_state().clone()
        with self.assertRaises(RuntimeError) as raised:
            with profile._preserve_probe_state(a, b):
                torch.rand(1); b.eval().requires_grad_(False); raise primary
        self.assertIs(raised.exception, primary)
        self.assertTrue(primary.secondary_probe_errors)
        self.assertTrue(torch.equal(torch.get_rng_state(), rng))
        self.assertTrue(b.training); self.assertTrue(all(p.requires_grad for p in b.parameters()))

    def test_grad_mutation_not_silently_accepted(self):
        a, b = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        with self.assertRaisesRegex(ValueError, "state/grad/identity"):
            with profile._preserve_probe_state(a, b): next(a.parameters()).grad = torch.ones_like(next(a.parameters()))

    def test_probe_failure_json_and_critic_rng_restored(self):
        primary = RuntimeError("synthetic forward failure")
        self.critic.train().requires_grad_(True)
        before = profile._network_snapshot(self.critic)
        rng = torch.get_rng_state().clone(); failure = {}
        with patch.object(profile, "validate_sample_ecology"), patch.object(profile, "sample_forward", side_effect=primary), \
                self.assertRaises(RuntimeError) as raised:
            profile.zero_update_probe(self.model, self.critic, self.sample, ORDER, lambda: None, failure_evidence=failure)
        self.assertIs(raised.exception, primary)
        self.assertEqual(before, profile._network_snapshot(self.critic))
        self.assertTrue(self.critic.training); self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertEqual(failure["callCounts"]["generatorAutograd"], 0)
        json.dumps(failure, allow_nan=False)

    def test_failure_evidence_write_cannot_mask_primary(self):
        class Broken(dict):
            def update(self, *args): raise OSError("synthetic evidence write")
        primary = RuntimeError("first failure")
        with patch.object(profile, "validate_sample_ecology"), patch.object(profile, "sample_forward", side_effect=primary), \
                self.assertRaises(RuntimeError) as raised:
            profile.zero_update_probe(self.model, self.critic, self.sample, ORDER, lambda: None, failure_evidence=Broken())
        self.assertIs(raised.exception, primary)
        self.assertIn("evidence write", primary.secondary_failure_evidence_error)

    def test_frozen_sources_and_inactive_identity(self):
        expected = {
            "src/ai_painter/complete_world/native_rgb_object_support_structure_candidate_cpu_v1.py": "3aa3c4e8a0a75799f64a4e8cca9bcc65652cf67f057f15f955130a459bd2859a",
            "src/ai_painter/complete_world/object_ecology_terrain_detail_weight_priority_update_v1.py": "a1b176263a381273da345b4875ec3d4cd7d926297c5465b6b3685517c94e44b2",
            "scripts/painter_stage4_ecology_terrain_detail_weight_training_profile_v1.py": "becb6fdabda3a5a7bf9d34011dd29b872204eab6aa39ab7daf2129d0fb1086d2"}
        for path, digest in expected.items():
            self.assertEqual(hashlib.sha256((ROOT / "ml/ai-painter" / path).read_bytes()).hexdigest(), digest)
        self.assertFalse(profile.EXECUTION_QUALIFIED); self.assertFalse(bridge.EXECUTION_QUALIFIED)
        self.assertFalse(hasattr(profile, "perform_pair")); self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__": unittest.main()

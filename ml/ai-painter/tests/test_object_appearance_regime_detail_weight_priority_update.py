"""Synthetic graph, identity, original gate and explicit zero-update boundaries."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world import object_appearance_regime_bias_precision as old
from ai_painter.complete_world import object_appearance_regime_detail_weight_precision as model_api
from ai_painter.complete_world import object_appearance_regime_detail_weight_priority_update as bridge
from ai_painter.complete_world.object_appearance_regime_input_cpu import encode_season, SEASONS
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL
from test_object_appearance_regime_conditioned_cpu import ORDER, scene
from test_detail_weight_reduction_precision import same_bytes


def losses(model):
    parameters, groups, _ = bridge.bind_parameters(model)
    owned = {i for rows in groups.values() for i in rows}
    core = sum(p.sum() * (.25 if i in owned else .125) for i, p in enumerate(parameters))
    structured = sum(p.sum() * (-.5 if i in owned else .25) for i, p in enumerate(parameters))
    whole = sum(p.sum() * .125 for p in parameters)
    return (structured.float() + whole).float() + core, structured, whole, core


class DetailModelTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.model = model_api.build_fresh_object_appearance_regime_detail_weight_precision(condition_channel_order=ORDER)

    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertIsNone(old._REGIME.get())
        self.assertFalse(torch.cuda.is_initialized())
        torch.set_num_threads(self.threads)

    def test_constructor_preserves_old_object_and_all_parameter_identity_order_initialization(self):
        predecessor = old.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER)
        before = tuple(predecessor.named_parameters())
        digest = old.parameter_initialization_digest(predecessor)
        old_op = predecessor.get_submodule(model_api.TARGET)
        old_modes = [m.training for m in predecessor.modules()]
        new = model_api.DetailWeightPrecisionRegimeRenderer(predecessor)
        old.validate_model_identity(predecessor)
        self.assertIs(predecessor.get_submodule(model_api.TARGET), old_op)
        self.assertIs(type(old_op), torch.nn.Conv2d)
        self.assertEqual(old_modes, [m.training for m in predecessor.modules()])
        after = tuple(new.named_parameters())
        self.assertTrue(all(n == m and p is q for (n, p), (m, q) in zip(before, after)))
        self.assertEqual(digest, old.parameter_initialization_digest(new))
        self.assertEqual(len(after), 107); self.assertEqual(sum(p.numel() for _, p in after), 2240671)
        self.assertEqual(after[56][0], model_api.TARGET_PARAMETER)
        self.assertTrue(same_bytes(predecessor.regime_identity, new.regime_identity))
        self.assertFalse(same_bytes(predecessor.numeric_identity, new.numeric_identity))
        self.assertNotEqual(old.ARCHITECTURE, model_api.ARCHITECTURE)
        with self.assertRaisesRegex(ValueError, "identity"): old.validate_model_identity(new)
        with self.assertRaisesRegex(ValueError, "identity"): model_api.validate_model_identity(predecessor)

    def test_forward_bytes_season_scope_exception_and_autocast(self):
        predecessor = old.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER).eval()
        new = self.model.eval(); conditions, table = scene()
        before = conditions.clone(); facts = deepcopy(table)
        with torch.no_grad():
            predecessor.core.core.appearance.base.layers[0].season_branch.weight[:, 0].fill_(.01)
            model_api.seasonal_parameter(new)[:, 0].fill_(.01)
            for season in (SEASONS[0], SEASONS[1]):
                a, ea = predecessor(conditions, table, appearance_regime=encode_season(season), return_evidence=True)
                b, eb = new(conditions, table, appearance_regime=encode_season(season), return_evidence=True)
                self.assertTrue(same_bytes(a, b)); self.assertTrue(same_bytes(ea["terrainRgb"], eb["terrainRgb"]))
                self.assertTrue(all(same_bytes(v, eb["visibleObjectSupportMasks"][k])
                    for k, v in ea["visibleObjectSupportMasks"].items()))
        outer = encode_season(SEASONS[3]); token = old._REGIME.set(outer)
        try:
            with self.assertRaises(ValueError): new(conditions, [], appearance_regime=encode_season(SEASONS[0]))
            self.assertIs(old._REGIME.get(), outer)
            with torch.no_grad(): new(conditions, table, appearance_regime=encode_season(SEASONS[1]))
            self.assertIs(old._REGIME.get(), outer)
        finally: old._REGIME.reset(token)
        with torch.autocast("cpu", dtype=torch.bfloat16):
            with self.assertRaisesRegex(ValueError, "autocast"): new(conditions, table, appearance_regime=encode_season(SEASONS[0]))
        self.assertTrue(same_bytes(before, conditions)); self.assertEqual(facts, table)

    def test_strict_load_rejects_old_identity_and_metadata_atomically(self):
        saved = deepcopy(self.model.state_dict()); self.model.load_state_dict(saved)
        invalid = [old.build_fresh_object_appearance_regime_bias_precision(condition_channel_order=ORDER).state_dict(),
                   {k: v for k, v in saved.items() if k != "numeric_identity"}]
        parameter = model_api.TARGET_PARAMETER
        for key, value in (("numeric_identity", torch.zeros(32, dtype=torch.uint8)),
            ("numeric_identity", saved["numeric_identity"].float()), (parameter, saved[parameter].double()),
            (parameter, torch.zeros(1)), (parameter, torch.full_like(saved[parameter], float("nan")))):
            bad = dict(saved); bad[key] = value; invalid.append(bad)
        for bad in invalid:
            with self.assertRaises(ValueError): self.model.load_state_dict(bad)
            self.assertTrue(all(same_bytes(v, self.model.state_dict()[k]) for k, v in saved.items()))
        for options in ({"strict": False}, {"assign": True}):
            with self.assertRaises(ValueError): self.model.load_state_dict(saved, **options)
        # Public importer accepts only authenticated failure/history inputs,
        # never an arbitrary state or a caller-supplied verification boolean.
        with self.assertRaises(TypeError):
            model_api.import_diagnostic_failure_state(state=saved, verified=True)

    def test_wrong_operator_alias_policy_buffer_and_shape_rejected(self):
        target = self.model.core.core.terrain.full_resolution_detail.layers
        op = target[0]
        with torch.random.fork_rng(devices=[]): target[0] = torch.nn.Conv2d(68, 48, 3, padding=1)
        with self.assertRaises(ValueError): model_api.validate_model_identity(self.model)
        target[0] = op
        self.model.register_parameter("alias", next(self.model.parameters()))
        with self.assertRaisesRegex(ValueError, "graph"): model_api.validate_model_identity(self.model)
        del self.model._parameters["alias"]
        self.model.numeric_identity.zero_()
        with self.assertRaisesRegex(ValueError, "buffer"): model_api.validate_model_identity(self.model)

    def test_cpu_factory_never_seeds_or_initializes_cuda(self):
        with patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA init")), \
             patch.object(torch.cuda, "manual_seed_all", side_effect=AssertionError("CUDA seed")):
            new = model_api.build_fresh_object_appearance_regime_detail_weight_precision(condition_channel_order=ORDER)
            self.assertTrue(all(p.device.type == "cpu" for p in new.parameters()))


class DetailBridgeTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.model = model_api.build_fresh_object_appearance_regime_detail_weight_precision(condition_channel_order=ORDER)
        with torch.random.fork_rng(devices=[]):
            self.critic = torch.nn.Linear(1, 1).eval().requires_grad_(False)
        self.sample = {"split": "train", "image": torch.zeros(3, 2, 2), "conditions": torch.zeros(23, 2, 2)}

    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state()))
        self.assertFalse(torch.cuda.is_initialized()); torch.set_num_threads(self.threads)

    def compute(self):
        total, structured, whole, core = losses(self.model)
        return bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic, sample=self.sample,
            actual_total=total, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)

    def test_independent_four_full_calls_and_original_projection_nonhead_identity(self):
        observed = []; native = torch.autograd.grad
        def record(loss, parameters, **kwargs):
            self.assertEqual(len(parameters), 107)
            observed.append((loss, kwargs, native(loss, parameters, **kwargs))); return observed[-1][2]
        with patch.object(torch.autograd, "grad", record): candidate, facts = self.compute()
        self.assertEqual(len(observed), 4)
        self.assertEqual([v[1]["retain_graph"] for v in observed], [True, True, True, False])
        self.assertTrue(all(v[1]["create_graph"] is False for v in observed))
        self.assertEqual(len({id(v[0]) for v in observed}), 4)
        parameters, groups, season = bridge.bind_parameters(self.model)
        owned = {i for rows in groups.values() for i in rows}
        self.assertEqual(len(owned), 16); self.assertEqual(sum(parameters[i].numel() for i in owned), 4876)
        self.assertNotIn(56, owned)
        for index in range(107):
            if index not in owned:
                self.assertEqual(candidate[index].data_ptr(), observed[0][2][index].data_ptr())
                self.assertTrue(same_bytes(candidate[index], observed[0][2][index]))
        self.assertEqual(candidate[season].data_ptr(), observed[0][2][season].data_ptr())
        self.assertTrue(all(v["branch"] == "conflict_projected" for v in facts["headDiagnostics"].values()))
        self.assertTrue(all(p.grad is None for p in self.model.parameters()))
        self.assertEqual((TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL), (1e-6, 1e-5))

    def test_original_gate_real_counterexample_keeps_all_completed_gradients(self):
        native = torch.autograd.grad; calls = []
        def corrupt(*args, **kwargs):
            values = list(native(*args, **kwargs)); calls.append(1)
            if len(calls) == 1: values[56] = values[56] + .001
            return tuple(values)
        with patch.object(torch.autograd, "grad", corrupt):
            with self.assertRaisesRegex(ValueError, "identity differs at parameter 56") as failure: self.compute()
        self.assertEqual(len(calls), 4)
        self.assertEqual(failure.exception.appearance_regime_gradient_evidence["gradientSetsAvailable"], 4)

    def test_late_nonfinite_fourth_gradient_keeps_receipt_and_observer_restores(self):
        native = torch.autograd.grad; calls = []; observed = []
        def corrupt(*args, **kwargs):
            values = list(native(*args, **kwargs)); calls.append(1)
            if len(calls) == 4: values[56] = torch.full_like(values[56], float("nan"))
            return tuple(values)
        with patch.object(torch.autograd, "grad", corrupt), bridge.observe_generator_gradients(lambda *v: observed.append(v)):
            with self.assertRaisesRegex(ValueError, "nonfinite") as error: self.compute()
        self.assertEqual(sum(v[0] == "complete" for v in observed), 4)
        self.assertEqual(error.exception.appearance_regime_gradient_evidence["gradientSetsAvailable"], 4)
        self.assertIsNone(bridge._OBSERVER.get())

    def test_scalar_wrong_formula_nontrain_and_critic_rejected_before_grad(self):
        total, structured, whole, core = losses(self.model)
        with patch.object(torch.autograd, "grad", side_effect=AssertionError("unexpected grad")):
            with self.assertRaisesRegex(ValueError, "formula"):
                bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic, sample=self.sample,
                    actual_total=total + 1, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)
            self.sample["split"] = "validation"
            with self.assertRaisesRegex(ValueError, "non-train"): self.compute()
            self.sample["split"] = "train"; self.critic.train()
            with self.assertRaisesRegex(ValueError, "frozen eval"): self.compute()

    def test_zero_update_profile_one_shared_forward_four_gradients_and_exception_receipt(self):
        path = Path(__file__).resolve().parents[1] / "scripts/painter_stage4_appearance_regime_detail_weight_probe.py"
        spec = importlib.util.spec_from_file_location("detail_weight_zero_update_profile", path)
        profile = importlib.util.module_from_spec(spec); spec.loader.exec_module(profile)
        conditions, table = scene()
        sample = {"split": "train", "conditions": conditions, "image": torch.zeros(1, 3, 192, 256),
                  "instanceTable": table}
        def objective(prediction, critic, source):
            mean = prediction.mean()
            return mean * .25, mean * .125, mean * .25
        candidate, facts = profile.zero_update_profile(model=self.model, critic=self.critic, sample=sample,
            appearance_regime=encode_season(SEASONS[0]), objective_builder=objective)
        self.assertEqual(len(candidate), 107)
        self.assertEqual(facts["actualCalls"]["generatorForwardsCompleted"], 1)
        self.assertEqual(facts["actualCalls"]["gradientsCompleted"], 4)
        self.assertTrue(all(p.grad is None for p in self.model.parameters()))
        def failed(prediction, critic, source): raise ValueError("synthetic objective failure")
        with self.assertRaisesRegex(ValueError, "synthetic objective failure") as error:
            profile.zero_update_profile(model=self.model, critic=self.critic, sample=sample,
                appearance_regime=encode_season(SEASONS[0]), objective_builder=failed)
        self.assertEqual(error.exception.detail_weight_profile_calls["generatorForwardsCompleted"], 1)
        self.assertEqual(error.exception.detail_weight_profile_calls["gradientsCompleted"], 0)
        self.assertIsNone(old._REGIME.get())

    def test_profile_rejects_state_input_and_rng_mutation_with_synthetic_guard_stub(self):
        # This cheap stub tests the guard only. The previous test exercises the
        # actual unmodified parent forward and new convolution through four VJPs.
        path = Path(__file__).resolve().parents[1] / "scripts/painter_stage4_appearance_regime_detail_weight_probe.py"
        spec = importlib.util.spec_from_file_location("detail_weight_guard_profile", path)
        profile = importlib.util.module_from_spec(spec); spec.loader.exec_module(profile)
        saved = deepcopy(self.model.state_dict())
        for mutation in ("state", "input", "rng"):
            sample = {"split": "train", "conditions": torch.zeros(1, 23, 2, 2),
                      "image": torch.zeros(1, 3, 2, 2), "instanceTable": []}
            def parent(model, conditions, table, return_evidence=False):
                return next(model.parameters()).sum()
            def objective(prediction, critic, source):
                if mutation == "state":
                    with torch.no_grad(): next(self.model.parameters()).add_(1)
                elif mutation == "input": source["image"].add_(1)
                else: torch.random.default_generator.manual_seed(55)
                return prediction * .25, prediction * .125, prediction * .25
            try:
                with torch.random.fork_rng(devices=[]), patch.object(self.model, "_parent_forward", parent):
                    with self.assertRaisesRegex(ValueError, "state/input/mode/gradient/RNG changed"):
                        profile.zero_update_profile(model=self.model, critic=self.critic, sample=sample,
                            appearance_regime=encode_season(SEASONS[0]), objective_builder=objective)
            finally: self.model.load_state_dict(saved)


if __name__ == "__main__": unittest.main()

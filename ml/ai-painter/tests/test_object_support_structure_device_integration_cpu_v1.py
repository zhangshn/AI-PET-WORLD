"""Synthetic CPU device/profile integration; never real renderer/data/CUDA/optimizer."""
from contextlib import ExitStack
import ast
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
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/tests")]
import numpy as np
import torch
from ai_painter.complete_world import native_rgb_object_support_structure_device_v1 as objective
from ai_painter.complete_world import native_rgb_object_support_structure_candidate_cpu_v1 as cpu_objective
from ai_painter.complete_world import object_support_structure_priority_update_device_v1 as bridge
from ai_painter.complete_world import object_support_structure_priority_update_cpu_v1 as cpu_bridge
from ai_painter.complete_world.stage4_semantic_transport_v2 import FORMAL_CONDITION_CHANNEL_ORDER as ORDER
import painter_stage4_object_support_structure_training_profile_v1 as profile
from test_native_rgb_object_support_structure_candidate_cpu_v1 import scene, SyntheticCritic

STARTED = time.monotonic()


class FakeAdamW(torch.optim.AdamW):
    """No real optimizer constructor/state/update; exercise the existing commit code."""
    def __init__(self, parameters):
        self.parameters = tuple(parameters)
        self.param_groups = [{"params": self.parameters, "lr": .0001, "betas": (.9, .999), "eps": 1e-8,
            "weight_decay": .01, "foreach": False, "fused": False}]
        self.state = {}; self.steps = 0

    def zero_grad(self, set_to_none=True):
        assert set_to_none
        for p in self.parameters: p.grad = None

    def step(self):
        self.steps += 1  # Intentionally no weight update.


class DeviceIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
        import psutil
        p = psutil.Process(); p.cpu_affinity(p.cpu_affinity()[:2])
        cls.model, cls.critic = profile.fresh_networks(ORDER)
        cls.parameters, cls.groups, cls.season, cls.ecology = bridge.bind_parameters(cls.model)

    def setUp(self):
        self.assertLess(time.monotonic() - STARTED, 120)
        for n in (self.model, self.critic):
            for p in n.parameters(): p.grad = None
        self.critic.eval().requires_grad_(False)
        self.sample, table = scene(); self.sample["objectInstanceTable"] = table
        self.guards = ExitStack(); self.addCleanup(self.guards.close)
        for owner, name in ((torch, "load"), (torch.cuda, "_lazy_init"), (torch.optim.Optimizer, "__init__")):
            self.guards.enter_context(patch.object(owner, name, side_effect=AssertionError("prohibited operation")))
        # A synthetic critic uses __call__ below; actual G/D module forwards cannot run.
        self.guards.enter_context(patch.object(self.model, "forward", side_effect=AssertionError("renderer forward prohibited")))
        self.guards.enter_context(patch.object(self.critic, "forward", side_effect=AssertionError("real critic forward prohibited")))

    def values(self, factors=(1., .5, .25, .125)):
        base = sum(p.sum() for p in self.parameters)
        s, w, c, support = (base * factor for factor in factors)
        total = (((s.float() + w).float() + c).float() + support)
        return dict(actual_total=total, structured_objective=s, whole_frame_fidelity=w,
            object_core_rgb=c, object_support_structure=support)

    def compute(self, values=None, **kwargs):
        return bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic,
            sample=self.sample, **(self.values() if values is None else values), **kwargs)

    def fake_parts(self):
        v = self.values()
        return v["actual_total"], {"v21UnchangedTotal": v["structured_objective"],
            "wholeFrameFidelity": v["whole_frame_fidelity"], "objectCoreRgbWeighted": v["object_core_rgb"],
            "objectSupportStructureWeighted": v["object_support_structure"]}

    def pair(self, counts=None, resource=lambda: None, after_update=lambda name, loss: None, limit=1152,
            prediction_observer=None):
        counts = {"generator": 0, "discriminator": 0} if counts is None else counts
        ledger = {"sampleId": self.sample["sampleId"], "generator": 0, "discriminator": 0}
        g, d = FakeAdamW(self.parameters), FakeAdamW(self.critic.parameters())
        self.pair_facts = counts, ledger, g, d
        self.pair_predictions = []
        def forward(*args, **kwargs):
            value = torch.zeros(1, 3, 192, 256)
            self.pair_predictions.append(value)
            return value
        def d_loss(*args): return sum(p.sum() for p in self.critic.parameters()) * .001, {}
        with patch.object(profile, "validate_sample_ecology"), \
                patch.object(profile, "sample_forward", side_effect=forward), \
                patch.object(profile, "_d_objective", side_effect=d_loss), \
                patch.object(profile, "train_object_support_structure_candidate_objective", side_effect=lambda *args: self.fake_parts()):
            result = profile.perform_pair(self.model, self.critic, self.sample, ORDER, g, d, counts, ledger,
                resource, None, after_update, update_limit=limit, prediction_observer=prediction_observer)
        return result

    def test_preview_observes_only_existing_g_prediction_after_d_before_g(self):
        seen = []
        def observe(prediction, sample, counts):
            _, _, g, d = self.pair_facts
            self.assertIs(prediction, self.pair_predictions[1])
            self.assertEqual((g.steps, d.steps), (0, 1))
            self.assertEqual(counts, {"generator": 0, "discriminator": 1})
            self.assertEqual(sample["sampleId"], self.sample["sampleId"])
            seen.append(prediction)
            counts["generator"] = 999  # Observer receives a snapshot, not the live ledger.
        rng = torch.get_rng_state().clone()
        result = self.pair(prediction_observer=observe)
        self.assertEqual(len(seen), 1)
        self.assertEqual(len(self.pair_predictions), 2)
        self.assertEqual(self.pair_facts[0], {"generator": 1, "discriminator": 1})
        self.assertNotIn("trainingPreviewSecondaryError", result)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))

    def test_preview_exception_does_not_prevent_original_g_five_vjps_or_commits(self):
        def fail(*args): raise OSError("secondary preview failure")
        with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
            result = self.pair(prediction_observer=fail)
        self.assertEqual(grad.call_count, 5)
        self.assertEqual(self.pair_facts[0], {"generator": 1, "discriminator": 1})
        self.assertEqual(result["trainingPreviewSecondaryError"]["availabilityCode"], "capture_failed")

    def test_optional_preview_matches_legacy_result_rng_and_model_bytes(self):
        parameters = tuple(p for n in (self.model, self.critic) for p in n.parameters())
        before = tuple((p.detach().clone(), p._version) for p in parameters)
        rng, python_rng = torch.get_rng_state().clone(), random.getstate()
        legacy = self.pair()
        legacy_gradients = tuple(None if p.grad is None else p.grad.detach().clone() for p in parameters)
        observed = self.pair(prediction_observer=lambda prediction, sample, counts: None)
        self.assertEqual(legacy, observed)
        for p, (value, version), gradient in zip(parameters, before, legacy_gradients):
            self.assertTrue(torch.equal(p.detach(), value))
            self.assertEqual(p._version, version)
            if gradient is None:
                self.assertIsNone(p.grad)
            else:
                self.assertTrue(torch.equal(p.grad, gradient))
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertEqual(python_rng, random.getstate())

    def test_training_first_exception_after_preview_error_remains_same_object(self):
        primary = RuntimeError("original G failure")
        def fail(*args): raise OSError("secondary preview failure")
        with patch.object(profile, "_generator_candidate", side_effect=primary):
            with self.assertRaises(RuntimeError) as raised:
                self.pair(prediction_observer=fail)
        self.assertIs(raised.exception, primary)
        self.assertEqual(self.pair_facts[0], {"generator": 0, "discriminator": 1})
        self.assertEqual(primary.training_preview_secondary_error["errorType"], "OSError")

    def test_preview_control_interrupt_propagates_after_actual_d_count(self):
        def stop(*args): raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            self.pair(prediction_observer=stop)
        self.assertEqual(self.pair_facts[0], {"generator": 0, "discriminator": 1})

    def test_resource_guard_after_preview_is_not_an_optional_diagnostic_error(self):
        primary = RuntimeError("original safety resource stop")
        observed = []
        def observer(*args): observed.append(True)
        def resource():
            if observed: raise primary
        with self.assertRaises(RuntimeError) as raised:
            self.pair(resource=resource, prediction_observer=observer)
        self.assertIs(raised.exception, primary)
        self.assertEqual(len(observed), 1)
        self.assertEqual(self.pair_facts[0], {"generator": 0, "discriminator": 1})

    def test_qualification_probe_has_no_preview_callback_route(self):
        import inspect
        self.assertNotIn("prediction_observer", inspect.signature(profile.zero_update_probe).parameters)
        self.assertNotIn("prediction_observer", inspect.getsource(profile.zero_update_probe))

    def test_cpu_term_dispatch_exact_value_parts_and_gradient(self):
        p = (.2 + .5 * self.sample["image"].flip(-1))[None].requires_grad_()
        a, ap = objective.train_original_object_support_structure(p, self.sample, self.sample["objectInstanceTable"], ORDER)
        b, bp = cpu_objective.train_original_object_support_structure(p, self.sample, self.sample["objectInstanceTable"], ORDER)
        self.assertTrue(torch.equal(a, b)); self.assertEqual(ap.keys(), bp.keys())
        ga, = torch.autograd.grad(a, (p,)); gb, = torch.autograd.grad(b, (p,))
        self.assertTrue(torch.equal(ga, gb))

    def test_cpu_complete_objective_direct_frozen_dispatch(self):
        p = (.2 + .5 * self.sample["image"].flip(-1))[None].requires_grad_()
        with patch.object(cpu_objective, "train_object_support_structure_candidate_objective",
                wraps=cpu_objective.train_object_support_structure_candidate_objective) as frozen:
            total, parts = objective.train_object_support_structure_candidate_objective(
                SyntheticCritic().eval(), p, self.sample, self.sample["objectInstanceTable"], ORDER)
        frozen.assert_called_once()
        self.assertTrue(torch.equal(total, parts["objectCoreFidelityUnchangedTotal"].float() + parts["objectSupportStructureWeighted"]))

    def test_wrong_device_dtype_nan_nontrain_objective_rejected(self):
        p = self.sample["image"][None]
        for predicted, sample in ((torch.empty_like(p, device="meta"), self.sample), (p.double(), self.sample),
                (p * float("nan"), self.sample), (p, {**self.sample, "split": "validation"}),
                (p, {**self.sample, "conditions": torch.empty(23, 192, 256, device="meta")})):
            with self.subTest(device=predicted.device), self.assertRaises(ValueError):
                objective.train_original_object_support_structure(predicted, sample, self.sample["objectInstanceTable"], ORDER)

    def test_cpu_five_vjps_direct_reference_and_identity(self):
        observed = []
        with patch.object(cpu_bridge, "compute_generator_candidate_gradients", wraps=cpu_bridge.compute_generator_candidate_gradients) as frozen:
            with bridge.observe_generator_gradients(lambda stage, label, rows: observed.append((label, rows)) if stage == "complete" else None):
                with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
                    candidate, facts = self.compute()
        frozen.assert_called_once(); self.assertEqual(grad.call_count, 5)
        self.assertEqual([label for label, _ in observed], list(bridge.COMPONENTS_IN_ORDER))
        self.assertEqual([len(rows) for _, rows in observed], [108] * 5)
        self.assertTrue(all(a is b for a, b in zip(candidate, observed[0][1])))
        self.assertEqual(facts["autogradGradCalls"], 5)

    def test_support_conflict_and_nonhead_season_ecology_identity(self):
        raw = []
        with bridge.observe_generator_gradients(lambda stage, label, rows: raw.append(rows) if stage == "complete" else None):
            candidate, facts = self.compute(self.values((.5, .5, 1., -3.)))
        owned = {i for indexes in self.groups.values() for i in indexes}
        self.assertTrue(all(candidate[i] is raw[0][i] for i in range(108) if i not in owned))
        self.assertIs(candidate[self.season], raw[0][self.season]); self.assertIs(candidate[self.ecology], raw[0][self.ecology])
        self.assertTrue(all(v["branch"] == "conflict_projected" for v in facts["headDiagnostics"].values()))

    def test_na_fifth_vjp_retained(self):
        _, facts = self.compute(self.values((1., .5, .25, 0.)))
        self.assertEqual(facts["autogradGradCalls"], 5)
        self.assertTrue(all(v["supportL2"] == 0 for v in facts["headDiagnostics"].values()))

    def test_gpu_facts_scalar_values_source_and_pure_data_without_cuda(self):
        tree = ast.parse(Path(bridge.__file__).read_text(encoding="utf-8"))
        compute = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
            and node.name == "compute_generator_candidate_gradients")
        updates = [node for node in ast.walk(compute) if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "facts" and node.func.attr == "update"]
        self.assertEqual(len(updates), 1)
        expressions = [kw.value for kw in updates[0].keywords if kw.arg == "scalarValues"]
        self.assertEqual(len(expressions), 1, "GPU facts must retain actual total plus all four scalar components")
        expected = ast.parse("{label: float(loss.detach()) for label, loss in zip(COMPONENTS_IN_ORDER, losses)}", mode="eval").body
        self.assertEqual(ast.dump(expressions[0]), ast.dump(expected))
        class Scalar:
            def __init__(self, value): self.value, self.detach_calls = value, 0
            def detach(self): self.detach_calls += 1; return self
            def __float__(self): return self.value
        numbers = (1.25, .25, .5, .125, .375)
        losses = tuple(Scalar(value) for value in numbers)
        # Evaluate only the recorded scalar expression on plain Python objects, never the CUDA branch.
        actual = eval(compile(ast.Expression(expressions[0]), "<GPU scalar facts expression>", "eval"),
            {"__builtins__": {}, "float": float, "zip": zip, "COMPONENTS_IN_ORDER": bridge.COMPONENTS_IN_ORDER, "losses": losses})
        self.assertEqual(actual, dict(zip(bridge.COMPONENTS_IN_ORDER, numbers)))
        self.assertTrue(all(value.detach_calls == 1 for value in losses))
        json.dumps(actual, allow_nan=False)
        self.assertFalse(torch.cuda.is_initialized())

    def test_bad_total_nan_and_frozen_critic_rejected(self):
        for kind in ("total", "nan", "critic", "nontrain", "scalar_device"):
            v = self.values(); sample = self.sample
            if kind == "total": v["actual_total"] = v["actual_total"] + 1
            if kind == "nan": v["object_support_structure"] = v["object_support_structure"] * float("nan")
            if kind == "critic": self.critic.train()
            if kind == "nontrain": sample = {**sample, "split": "validation"}
            if kind == "scalar_device": v["actual_total"] = torch.empty((), device="meta", requires_grad=True)
            with self.subTest(kind=kind), patch.object(torch.autograd, "grad") as grad, self.assertRaises(ValueError):
                bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic, sample=sample, **v)
            grad.assert_not_called(); self.critic.eval()

    def test_exact_carrier_state_order_alias_and_rng(self):
        rng = torch.get_rng_state().clone()
        carrier = bridge._cpu_carrier(self.model)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertEqual(list(carrier.state_dict()), list(self.model.state_dict()))
        self.assertTrue(all(torch.equal(v, carrier.state_dict()[k]) for k, v in self.model.state_dict().items()))
        self.assertTrue(all(a.untyped_storage().data_ptr() != b.untyped_storage().data_ptr()
            for a, b in zip(self.parameters, carrier.parameters())))
        cpu_bridge.bind_parameters(carrier)

    def test_dispatcher_fake_meta_and_storage_alias_rejected(self):
        with self.assertRaises(ValueError): bridge.bind_parameters(torch.nn.Linear(2, 2, device="meta"))
        with self.assertRaises(ValueError): bridge.bind_parameters(torch.nn.Linear(2, 2))
        self.model.register_parameter("synthetic_alias", self.parameters[0])
        try:
            with self.assertRaises(ValueError): bridge.bind_parameters(self.model)
        finally: del self.model._parameters["synthetic_alias"]

    def test_partial_five_gradient_raw_evidence_keeps_primary(self):
        primary = RuntimeError("third VJP boundary")
        def stop(stage, label, rows):
            if stage == "attempt" and label == "wholeFrameFidelity": raise primary
        with bridge.observe_generator_gradients(stop), self.assertRaises(RuntimeError) as raised: self.compute()
        self.assertIs(raised.exception, primary)
        evidence = primary.object_support_gradient_evidence
        self.assertEqual(evidence["gradientSetsAvailable"], 2)
        self.assertEqual(evidence["componentsInOrder"], list(bridge.COMPONENTS_IN_ORDER))

    def test_profile_frozen_objective_to_five_bridge(self):
        p = (.25 + .4 * self.sample["image"].flip(-1) + .01 * self.parameters[0].mean().tanh())[None]
        with patch.object(profile, "compute_generator_candidate_gradients", wraps=bridge.compute_generator_candidate_gradients) as differentiated:
            total, candidate, facts = profile._generator_candidate(self.model, SyntheticCritic().eval(), self.sample, ORDER, p)
        self.assertIs(differentiated.call_args.kwargs["actual_total"], total)
        self.assertIn("object_support_structure", differentiated.call_args.kwargs)
        self.assertEqual(facts["autogradGradCalls"], 5); self.assertEqual(len(candidate), 108)

    def test_perform_pair_real_helpers_two_fake_commits_and_ledgers(self):
        before = profile.cpu_reference._network_snapshot(self.critic)
        with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
            result = self.pair()
        counts, ledger, g, d = self.pair_facts
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertEqual((ledger["generator"], ledger["discriminator"], g.steps, d.steps), (1, 1, 1, 1))
        self.assertEqual(grad.call_count, 5); self.assertIn("fiveGradientFacts", result)
        self.assertEqual(before, profile.cpu_reference._network_snapshot(self.critic))

    def test_perform_pair_fixed_limit_and_either_exhausted_before_commit(self):
        for limit, counts in ((576, {"generator": 0, "discriminator": 0}),
                (1152, {"generator": 1152, "discriminator": 0}), (1152, {"generator": 0, "discriminator": 1152})):
            with self.subTest(limit=limit, counts=counts), self.assertRaises(ValueError): self.pair(counts=counts, limit=limit)
            _, ledger, g, d = self.pair_facts
            self.assertEqual((g.steps, d.steps, ledger["generator"], ledger["discriminator"]), (0, 0, 0, 0))

    def test_perform_pair_last_allowed_commits(self):
        self.pair(counts={"generator": 1151, "discriminator": 1151})
        counts, ledger, g, d = self.pair_facts
        self.assertEqual(counts, {"generator": 1152, "discriminator": 1152})
        self.assertEqual((ledger["generator"], ledger["discriminator"], g.steps, d.steps), (1, 1, 1, 1))

    def test_post_d_commit_resource_failure_keeps_real_count_and_mode(self):
        primary = RuntimeError("post-D resource failure"); observed = []
        def resource():
            observed.append(1)
            if len(observed) == 3: raise primary
        with self.assertRaises(RuntimeError) as raised: self.pair(resource=resource)
        self.assertIs(raised.exception, primary)
        counts, ledger, g, d = self.pair_facts
        self.assertEqual((counts["generator"], counts["discriminator"], ledger["discriminator"], g.steps, d.steps), (0, 1, 1, 0, 1))
        self.assertTrue(all(not m.training for m in self.critic.modules()))
        self.assertTrue(all(not p.requires_grad for p in self.critic.parameters()))

    def test_post_g_callback_failure_keeps_both_commits(self):
        primary = RuntimeError("post-G callback failure")
        def after(name, loss):
            if name == "generator": raise primary
        with self.assertRaises(RuntimeError) as raised: self.pair(after_update=after)
        self.assertIs(raised.exception, primary)
        counts, ledger, g, d = self.pair_facts
        self.assertEqual((counts["generator"], counts["discriminator"], ledger["generator"], ledger["discriminator"]), (1, 1, 1, 1))

    def test_validation_forward_has_no_loss_or_gradient_route(self):
        sample = {**self.sample, "split": "validation"}
        with self.assertRaisesRegex(ValueError, "read-only"): profile.sample_forward(self.model, sample)
        with patch.object(profile, "_bound_device", return_value=sample), patch.object(profile.inherited,
                "sample_forward", return_value="synthetic-forward-only") as forward, \
                patch.object(profile, "train_object_support_structure_candidate_objective") as loss:
            with torch.no_grad(): self.assertEqual(profile.sample_forward(self.model, sample), "synthetic-forward-only")
        forward.assert_called_once(); loss.assert_not_called()

    def test_probe_failure_after_synthetic_forward_has_completed_count_and_d_vjp(self):
        # Lightweight fixture only; no real renderer forward or 108-model replacement/qualification.
        class Tiny(torch.nn.Module):
            def __init__(self):
                super().__init__(); self.p = torch.nn.Parameter(torch.ones(())); self.condition_channel_order = ORDER
            def forward(self): return self.p * .5
        model, critic = Tiny(), torch.nn.Linear(1, 1)
        primary = RuntimeError("G objective failure after forward")
        failure = {}; rng = torch.get_rng_state().clone()
        with patch.object(profile, "_bound_device", return_value=self.sample), \
                patch.object(profile, "bind_parameters", return_value=((model.p,), {}, 0, 0)), \
                patch.object(profile, "sample_forward", side_effect=lambda *args, **kwargs: (model(), {"objectCount": 3})), \
                patch.object(profile, "_d_objective", side_effect=lambda *args: (critic.weight.sum(), {})), \
                patch.object(profile, "_generator_candidate", side_effect=primary), self.assertRaises(RuntimeError) as raised:
            profile.zero_update_probe(model, critic, self.sample, ORDER, lambda: None, failure_evidence=failure)
        self.assertIs(raised.exception, primary)
        self.assertEqual(failure["callCounts"], {"generatorForwards": 1, "generatorForwardCompleted": 1,
            "generatorAutograd": 0, "discriminatorAutograd": 1})
        self.assertTrue(critic.training); self.assertTrue(all(p.requires_grad for p in critic.parameters()))
        self.assertTrue(torch.equal(rng, torch.get_rng_state())); json.dumps(failure, allow_nan=False)

    def scalar_probe(self, resource=lambda: None, failure=None):
        # Replace the renderer method with a scalar parameter expression, not a real G forward.
        # The root Module call/hook and all six VJPs remain real, complete and independently observed.
        def arithmetic_forward():
            return sum((p[:, 0].sum() if i in (self.season, self.ecology) else p.sum())
                for i, p in enumerate(self.parameters))
        def scalar_objective(critic, prediction, sample, table, order):
            s, w, c, support = (prediction * v for v in (1., .5, .25, .125))
            return (((s.float() + w).float() + c).float() + support), {"v21UnchangedTotal": s,
                "wholeFrameFidelity": w, "objectCoreRgbWeighted": c, "objectSupportStructureWeighted": support}
        sample = {**self.sample, "appearance_regime": torch.tensor([1., 0., 0., 0.]),
            "ecology_regime": torch.tensor([1., 0., 0., 0., 0., 0., 0.])}
        with patch.object(profile, "validate_sample_ecology"), patch.object(self.model, "forward", side_effect=arithmetic_forward), \
                patch.object(profile, "sample_forward", side_effect=lambda *a, **kw: (self.model(), {"objectCount": 3})), \
                patch.object(profile, "_d_objective", side_effect=lambda *a: (sum(p.sum() for p in self.critic.parameters()) * .001, {})), \
                patch.object(profile, "train_object_support_structure_candidate_objective", side_effect=scalar_objective):
            return profile.zero_update_probe(self.model, self.critic, sample, ORDER, resource, failure_evidence=failure)

    def test_probe_success_real_complete_108_five_g_one_d_arithmetic_vjps(self):
        before = tuple(profile.cpu_reference._network_snapshot(n) for n in (self.model, self.critic))
        with patch.object(torch.autograd, "grad", wraps=torch.autograd.grad) as grad:
            result = self.scalar_probe()
        self.assertEqual(grad.call_count, 6)
        self.assertEqual(result["callCounts"], {"generatorForwards": 1, "generatorForwardCompleted": 1,
            "generatorAutograd": 5, "discriminatorAutograd": 1})
        self.assertTrue(result["passed"]); self.assertFalse(result["gpuQualificationGranted"])
        self.assertEqual(result["fiveGradientFacts"]["independentFullParameterGradientTensorCounts"], [108]*5)
        self.assertEqual(before, tuple(profile.cpu_reference._network_snapshot(n) for n in (self.model, self.critic)))
        self.assertFalse(result["trainingGranted"]); json.dumps(result, allow_nan=False)

    def test_probe_post_fifth_g_error_keeps_five_raw_sets_and_json_counts(self):
        primary = RuntimeError("post fifth G VJP"); failure = {}; seen = []
        def event(stage, kind, gradients):
            if stage == "complete" and kind == "generator":
                seen.append(gradients)
                if len(seen) == 5: raise primary
        original = profile.zero_update_probe
        def with_event(*args, **kwargs): return original(*args, **kwargs, event=event)
        with patch.object(profile, "zero_update_probe", side_effect=with_event), self.assertRaises(RuntimeError) as raised:
            self.scalar_probe(failure=failure)
        self.assertIs(raised.exception, primary)
        self.assertEqual(primary.object_support_gradient_evidence["gradientSetsAvailable"], 5)
        self.assertTrue(all(a is b for a, b in zip(seen, primary.object_support_gradient_evidence["rawGradients"])))
        self.assertEqual(failure["callCounts"]["generatorForwardCompleted"], 1)
        self.assertEqual(failure["callCounts"]["generatorAutograd"], 5)
        self.assertEqual(failure["callCounts"]["discriminatorAutograd"], 1)
        self.assertEqual(len(failure["rawGradientSummaries"]), 5); json.dumps(failure, allow_nan=False)

    def test_failure_summary_json_only_preserves_five_raw_on_exception(self):
        primary = RuntimeError("primary"); rows = [(torch.ones(1), None)] * 5; failure = {}
        profile._failure_summary(primary, failure, rows, {"generatorAutograd": 5}, bridge.COMPONENTS_IN_ORDER)
        self.assertIs(primary.object_support_gradient_evidence["rawGradients"], rows)
        self.assertEqual(failure["gradientSetsAvailable"], 5); json.dumps(failure, allow_nan=False)
        class Broken(dict):
            def update(self, *args): raise OSError("evidence secondary")
        profile._failure_summary(primary, Broken(), rows, {}, [])
        self.assertIn("evidence secondary", primary.secondary_failure_evidence_error)

    def test_probe_state_primary_rng_secondary_and_restore(self):
        a, b = torch.nn.Linear(1, 1), torch.nn.Linear(1, 1)
        primary = RuntimeError("first"); rng = torch.get_rng_state().clone()
        with self.assertRaises(RuntimeError) as raised:
            with profile._probe_state(a, b, torch.device("cpu")):
                torch.rand(1); b.eval().requires_grad_(False); raise primary
        self.assertIs(raised.exception, primary); self.assertTrue(primary.secondary_probe_errors)
        self.assertTrue(torch.equal(rng, torch.get_rng_state())); self.assertTrue(b.training)
        self.assertTrue(all(p.requires_grad for p in b.parameters()))

    def test_identity_and_frozen_byte_boundaries(self):
        expected = {
            "src/ai_painter/complete_world/native_rgb_object_support_structure_candidate_cpu_v1.py": "3aa3c4e8a0a75799f64a4e8cca9bcc65652cf67f057f15f955130a459bd2859a",
            "src/ai_painter/complete_world/object_support_structure_priority_update_cpu_v1.py": "d2d3238be5e3baab321dce0d697d70723cc69c622c361cc8fe215560f8e1e67c",
            "scripts/painter_stage4_object_support_structure_training_profile_cpu_v1.py": "90af49f58e5a1749f4586c9017657c331f66a7f47f9041e2c7d236de57ee9b07",
            "tests/test_object_support_structure_integration_cpu_v1.py": "d590cfbab8685e85ce8c6fd417a13da31ea8443779d8ffd2e7e2a3b7aa816ac9"}
        for name, digest in expected.items(): self.assertEqual(hashlib.sha256((ROOT / "ml/ai-painter" / name).read_bytes()).hexdigest(), digest)
        self.assertEqual(profile.CAPABILITY, "stage4_mvp256_dry_object_support_structure_quality24_v1")
        self.assertEqual(profile.MODEL_CAPABILITY, cpu_bridge.MODEL_CAPABILITY)
        self.assertEqual(profile.UPDATE_LIMIT, 1152)
        self.assertFalse(profile.EXECUTION_QUALIFIED); self.assertFalse(bridge.EXECUTION_QUALIFIED)
        self.assertFalse(objective.EXECUTION_QUALIFIED); self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__": unittest.main()

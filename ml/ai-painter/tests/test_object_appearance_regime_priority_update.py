"""Independent full-graph gradients and original CPU tolerance/projection gates."""
import unittest
from unittest.mock import patch
import torch
from ai_painter.complete_world.object_appearance_regime_bias_precision import build_fresh_object_appearance_regime_bias_precision as build
from ai_painter.complete_world import object_appearance_regime_priority_update as bridge
from test_object_appearance_regime_conditioned_cpu import ORDER


def losses(model):
    parameters, groups, _ = bridge.bind_parameters(model)
    head_indexes = {i for rows in groups.values() for i in rows}
    core = sum(p.sum() * (.25 if i in head_indexes else .125) for i, p in enumerate(parameters))
    structured = sum(p.sum() * (-.5 if i in head_indexes else .25) for i, p in enumerate(parameters))
    whole = sum(p.sum() * .125 for p in parameters)
    return (structured.float() + whole).float() + core, structured, whole, core


class FullGradientTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.model = build(condition_channel_order=ORDER)
        with torch.random.fork_rng(devices=[]): self.critic = torch.nn.Linear(1, 1).eval().requires_grad_(False)
        self.sample = {"split": "train", "image": torch.zeros(3, 2, 2), "conditions": torch.zeros(23, 2, 2)}
    def tearDown(self): torch.set_num_threads(self.threads)
    def compute(self):
        total, structured, whole, core = losses(self.model)
        return bridge.compute_generator_candidate_gradients(model=self.model, critic=self.critic, sample=self.sample,
            actual_total=total, structured_objective=structured, whole_frame_fidelity=whole, object_core_rgb=core)

    def test_four_full_differentiations_canonical_carrier_original_projection_nonhead_identity(self):
        raw = []; original = torch.autograd.grad
        def record(loss, parameters, **kwargs):
            self.assertEqual(len(parameters), 107)
            values = original(loss, parameters, **kwargs); raw.append(values); return values
        with patch.object(torch.autograd, "grad", record): candidate, facts = self.compute()
        self.assertEqual(len(raw), 4); self.assertEqual(facts["independentFullParameterGradientTensorCounts"], [107] * 4)
        parameters, groups, seasonal = bridge.bind_parameters(self.model)
        owned = {i for rows in groups.values() for i in rows}
        self.assertEqual(len(owned), 16); self.assertEqual(sum(parameters[i].numel() for i in owned), 4876)
        for i in range(107):
            if i not in owned: self.assertEqual(candidate[i].data_ptr(), raw[0][i].data_ptr())
        self.assertEqual(candidate[seasonal].data_ptr(), raw[0][seasonal].data_ptr())
        self.assertTrue(all(d["branch"] == "conflict_projected" for d in facts["headDiagnostics"].values()))
        self.assertTrue(all(p.grad is None for p in self.model.parameters()))

    def test_nonhead_identity_failure_after_four_independent_calls(self):
        original = torch.autograd.grad; calls = []
        def wrong(*args, **kwargs):
            values = list(original(*args, **kwargs)); calls.append(1)
            if len(calls) == 1: values[0] = values[0] + .001
            return tuple(values)
        with patch.object(torch.autograd, "grad", wrong):
            with self.assertRaisesRegex(ValueError, "identity differs at parameter 0") as context: self.compute()
        self.assertEqual(len(calls), 4); self.assertEqual(context.exception.appearance_regime_gradient_evidence["gradientSetsAvailable"], 4)

    def test_nonfinite_fourth_gradient_preserved_before_guard_and_observer_context_restored(self):
        original = torch.autograd.grad; calls = []; observed = []
        def wrong(*args, **kwargs):
            values = list(original(*args, **kwargs)); calls.append(1)
            if len(calls) == 4: values[0] = torch.full_like(values[0], float("nan"))
            return tuple(values)
        with patch.object(torch.autograd, "grad", wrong), bridge.observe_generator_gradients(lambda *event: observed.append(event)):
            with self.assertRaisesRegex(ValueError, "nonfinite") as context: self.compute()
        self.assertEqual(sum(event[0] == "complete" for event in observed), 4)
        self.assertEqual(context.exception.appearance_regime_gradient_evidence["gradientSetsAvailable"], 4)
        self.assertIsNone(bridge._OBSERVER.get())

    def test_nontrain_critic_mode_and_alias_rejected_before_grad(self):
        self.sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "non-train"): self.compute()
        self.sample["split"] = "train"; self.critic.train()
        with self.assertRaisesRegex(ValueError, "frozen eval"): self.compute()
        self.critic.eval(); self.model.register_parameter("alias", next(self.model.parameters()))
        with self.assertRaisesRegex(ValueError, "alias"): bridge.bind_parameters(self.model)


if __name__ == "__main__": unittest.main()

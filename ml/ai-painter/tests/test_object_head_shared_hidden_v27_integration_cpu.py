"""Real network, synthetic scene and original V24 loss: zero updates."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "ml/ai-painter/scripts"))
from test_object_head_shared_hidden_v27_cpu import ORDER, scene
from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import build_fresh_object_head_shared_hidden_v27_cpu
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import (
    bind_parameter_groups, compute_shared_hidden_priority_gradients_v27_cpu,
)
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator


class IntegrationTests(unittest.TestCase):
    def test_original_loss_four_grad_calls_reach_shared_and_all_adapters(self):
        torch.set_num_threads(2)
        model = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=ORDER).train()
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(20260929)
            critic = build_conditional_texture_discriminator()
        critic.eval().requires_grad_(False)
        conditions, table = scene()
        x = torch.linspace(0, 1, 256)[None, None, :].expand(3, 192, 256)
        sample = {"split": "train", "sampleId": "synthetic-v27", "conditions": conditions[0],
                  "image": x.contiguous(), "objectInstanceTable": table}
        saved = deepcopy(model.state_dict()); saved_table = deepcopy(table)
        source = conditions.clone(); rng = torch.random.get_rng_state().clone(); counter = {}
        with patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("optimizer")), \
             patch.object(torch, "load", side_effect=AssertionError("checkpoint")), \
             patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward")):
            prediction = model(conditions, table)
            total, parts = train_object_core_fidelity_candidate_objective(critic, prediction, sample, table, ORDER)
            candidate, facts = compute_shared_hidden_priority_gradients_v27_cpu(model=model, critic=critic,
                sample=sample, actual_total=total, structured_objective=parts["v21UnchangedTotal"],
                whole_frame_fidelity=parts["wholeFrameFidelity"], object_core_rgb=parts["objectCoreRgbWeighted"], counter=counter)
        self.assertEqual(counter, {"autogradGradCallsAttempted": 4, "autogradGradCallsCompleted": 4})
        self.assertEqual(len(candidate), 100)
        for group in facts["groupDiagnostics"].values():
            self.assertGreater(group["coreL2"], 0)
            self.assertGreater(group["candidateL2"], 0)
        self.assertTrue(all(bool(torch.isfinite(v).all()) for v in candidate))
        self.assertTrue(all(torch.equal(saved[k], v) for k, v in model.state_dict().items()))
        self.assertEqual(table, saved_table)
        self.assertTrue(torch.equal(conditions, source))
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertTrue(all(p.grad is None for network in (model, critic) for p in network.parameters()))
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

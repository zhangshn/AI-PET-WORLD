"""Bounded artificial-data profile tests; run once in an owned CPU batch."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch
ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_appearance_regime_detail_weight_training_profile as profile
from test_painter_stage4_appearance_regime_probe import bound_fixture, ORDER
from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import validate_model_identity


class TrainingProfileTests(unittest.TestCase):
    def test_fresh_identity_rng_and_missing_season_rejected(self):
        rng = torch.random.get_rng_state().clone()
        with patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA forbidden")):
            model, critic = profile.fresh_networks(ORDER)
        validate_model_identity(model)
        self.assertEqual(len(tuple(model.parameters())), 107)
        self.assertEqual(sum(p.numel() for p in model.parameters()), 2240671)
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        sample = bound_fixture()
        with self.assertRaises(ValueError):
            profile.sample_forward(model, {k: v for k, v in sample.items() if k != "_appearance_regime_binding"})
        self.assertFalse(torch.cuda.is_initialized())

    def test_real_pair_partial_failure_zero_update_and_resource_failure(self):
        sample = bound_fixture(); model, critic = profile.fresh_networks(ORDER)
        args = dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)
        go = torch.optim.AdamW(model.parameters(), **args)
        do = torch.optim.AdamW(critic.parameters(), **args)
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": sample["sampleId"], **counts}
        critic.eval().requires_grad_(False)
        entry = profile.v24._critic_mode_snapshot(critic)
        calls = []; stages = []; forward = profile.sample_forward
        def checked(*a, **kw):
            calls.append((critic.training, all(p.requires_grad for p in critic.parameters()), torch.is_grad_enabled()))
            self.assertFalse(torch.is_autocast_enabled("cpu"))
            return forward(*a, **kw)
        def resource(): stages.append("resource")
        with patch.object(profile, "sample_forward", checked):
            result = profile.perform_pair(model, critic, sample, ORDER, go, do, counts, ledger, resource, None)
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertEqual(calls, [(True, True, False), (False, False, True)])
        self.assertGreater(len(stages), 3)
        self.assertEqual(profile.v24._critic_mode_snapshot(critic), entry)
        self.assertTrue(result)
        with patch.object(go, "step", side_effect=RuntimeError("injected G optimizer failure")):
            with self.assertRaisesRegex(RuntimeError, "injected G optimizer failure"):
                profile.perform_pair(model, critic, sample, ORDER, go, do, counts, ledger, resource, None)
        self.assertEqual(counts, {"generator": 1, "discriminator": 2})
        self.assertEqual({k: ledger[k] for k in counts}, counts)
        self.assertEqual(profile.v24._critic_mode_snapshot(critic), entry)
        go.zero_grad(set_to_none=True); do.zero_grad(set_to_none=True)
        rng = torch.random.get_rng_state().clone(); backend = profile._backend_snapshot()
        proof = profile.zero_update_probe(model, critic, sample, ORDER, resource)
        self.assertTrue(proof["passed"])
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state()))
        self.assertEqual(profile._backend_snapshot(), backend)
        self.assertEqual(counts, {"generator": 1, "discriminator": 2})
        with self.assertRaisesRegex(RuntimeError, "resource exhausted"):
            profile.perform_pair(model, critic, sample, ORDER, go, do, counts, ledger,
                                 lambda: (_ for _ in ()).throw(RuntimeError("resource exhausted")), None)
        self.assertEqual(counts, {"generator": 1, "discriminator": 2})
        self.assertEqual(profile.v24._critic_mode_snapshot(critic), entry)

    def test_validation_and_ledger_mismatch_fail_before_compute(self):
        model, critic = profile.fresh_networks(ORDER); sample = bound_fixture()
        counts = {"generator": 0, "discriminator": 0}
        for changed, ledger in (({**sample, "split": "validation"}, {"sampleId": sample["sampleId"], **counts}),
                                (sample, {"sampleId": "wrong", **counts})):
            with self.assertRaises(ValueError):
                profile.perform_pair(model, critic, changed, ORDER, None, None, counts, ledger, lambda: None, None)


if __name__ == "__main__": unittest.main()

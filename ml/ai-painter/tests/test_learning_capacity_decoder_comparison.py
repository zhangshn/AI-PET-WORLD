"""Behavior tests for frozen, target-free, paired CPU generation."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import compare_learning_capacity_decoders as comparison

SOURCE = {"path": ".runtime/ai-painter/learning-capacity-experiments/painter-ae-reconstruction-bd142c28c92d576eff6c5c389daedefa5d244e6c4b77cd2b2689d2245a2275dd/result.json",
          "sha256": "f2d358d60acae09b608d9709a801e8f5150748f932fd0d1e8f4b055ffd199d7b"}


class PairedDecoderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def test_settings_are_exact_and_cannot_expand(self):
        comparison.validate_settings(comparison.SETTINGS)
        for key in comparison.SETTINGS:
            invalid = deepcopy(comparison.SETTINGS)
            invalid[key] = None
            with self.subTest(key=key), self.assertRaises(ValueError):
                comparison.validate_settings(invalid)

    def test_artifact_must_be_unique(self):
        b = {"path": "run/checkpoint.pt", "sha256": "a" * 64}
        self.assertEqual(comparison.artifact({"artifacts": [b]}, "checkpoint.pt"), b)
        for rows in ([], [b, b]):
            with self.assertRaises(ValueError):
                comparison.artifact({"artifacts": rows}, "checkpoint.pt")

    def test_plan_reproduces_existing_bindings_without_execution(self):
        a = comparison.materialize_plan(ROOT, SOURCE)
        output = ROOT / comparison.ROOT / a["comparisonIdentity"]
        before = sorted(p.name for p in output.iterdir()) if output.exists() else None
        b = comparison.materialize_plan(ROOT, SOURCE)
        self.assertEqual(a, b)
        self.assertEqual(a["sampleIds"], comparison.SAMPLES)
        self.assertEqual(a["settings"], comparison.SETTINGS)
        self.assertEqual(before, sorted(p.name for p in output.iterdir()) if output.exists() else None)

    def test_tampered_result_is_rejected_before_model_loading(self):
        with self.assertRaises(ValueError):
            comparison.materialize_plan(ROOT, dict(SOURCE, sha256="0" * 64))

    def rollout(self, predict=None, shape=(1, 12, 48, 64), conditions=None):
        import torch
        from ai_painter.complete_world.diffusion import build_schedule
        if conditions is None:
            conditions = torch.zeros(1, 23, 192, 256)
        return comparison.pure_noise_rollout(torch, predict or (lambda x, t, c: torch.zeros_like(x)), shape,
            conditions, build_schedule(1000, "cpu")["alphaBars"], 20263908, lambda: None)

    def test_pure_noise_is_reproducible_and_has_exact_50_step_grid(self):
        import torch
        calls = []
        def predict(x, t, c):
            calls.append(int(t.item()))
            return torch.zeros_like(x)
        noise, latent, grid = self.rollout(predict)
        noise2, latent2, _ = self.rollout()
        self.assertTrue(torch.equal(noise, noise2))
        self.assertTrue(torch.equal(latent, latent2))
        self.assertEqual(len(calls), 50)
        self.assertEqual(calls, [t for t, _ in grid])
        self.assertEqual(grid[0][0], 999)
        self.assertEqual(grid[-1], (0, -1))
        self.assertFalse(torch.cuda.is_initialized())

    def test_rollout_refuses_wrong_shape_and_nonfinite_conditions(self):
        import torch
        for kwargs in ({"shape": (1, 12, 96, 128)}, {"conditions": torch.zeros(1, 22, 192, 256)},
                       {"conditions": torch.full((1, 23, 192, 256), float("nan"))}):
            with self.subTest(keys=list(kwargs)), self.assertRaises(ValueError):
                self.rollout(**kwargs)

    def test_nonfinite_prediction_fails_closed(self):
        import torch
        with self.assertRaisesRegex(ValueError, "nonfinite generated"):
            self.rollout(lambda x, t, c: torch.full_like(x, float("nan")))

    def pair_fixture(self):
        import torch
        from types import SimpleNamespace
        original, replacement = object(), object()
        model = SimpleNamespace(autoencoder=original)
        latent = torch.zeros(1, 3, 8, 8)
        conditions = torch.zeros(1, 1, 8, 8)
        return torch, model, original, replacement, latent, conditions

    def test_pair_uses_same_tensors_and_restores_original_decoder(self):
        torch, model, original, replacement, latent, conditions = self.pair_fixture()
        calls = []
        def decode(m, x, c, cfg, **kwargs):
            calls.append((m.autoencoder, id(x), id(c)))
            return x + (0.25 if m.autoencoder is original else 0.5), {"responsibilityMasks": (c,)}
        values = comparison.paired_decode(torch, model, replacement, latent, conditions, {}, decode)
        self.assertIs(model.autoencoder, original)
        self.assertEqual(calls, [(original, id(latent), id(conditions)), (replacement, id(latent), id(conditions))])
        self.assertFalse(torch.equal(values["original"][0], values["reconstruction"][0]))

    def test_pair_restores_original_on_decoder_exception(self):
        torch, model, original, replacement, latent, conditions = self.pair_fixture()
        def decode(m, x, c, cfg, **kwargs):
            if m.autoencoder is replacement:
                raise RuntimeError("decoder failure")
            return x, {"responsibilityMasks": (c,)}
        with self.assertRaisesRegex(RuntimeError, "decoder failure"):
            comparison.paired_decode(torch, model, replacement, latent, conditions, {}, decode)
        self.assertIs(model.autoencoder, original)

    def test_mutating_pair_input_is_rejected(self):
        torch, model, original, replacement, latent, conditions = self.pair_fixture()
        def decode(m, x, c, cfg, **kwargs):
            x.add_(1)
            return x, {"responsibilityMasks": (c,)}
        with self.assertRaisesRegex(ValueError, "mutated"):
            comparison.paired_decode(torch, model, replacement, latent, conditions, {}, decode)
        self.assertIs(model.autoencoder, original)

    def test_changed_responsibility_masks_are_rejected(self):
        torch, model, original, replacement, latent, conditions = self.pair_fixture()
        def decode(m, x, c, cfg, **kwargs):
            return x, {"responsibilityMasks": (c + (m.autoencoder is replacement),)}
        with self.assertRaisesRegex(ValueError, "masks changed"):
            comparison.paired_decode(torch, model, replacement, latent, conditions, {}, decode)

    def test_heartbeat_retries_are_bounded_and_do_not_delete_previous_file(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "heartbeat.json"
            p.write_text(json.dumps({"heartbeatAtUtc": "old"}), encoding="utf-8")
            original = p.read_bytes()
            with patch.object(comparison, "save_json", side_effect=PermissionError("locked")) as save, patch.object(comparison.time, "sleep") as sleep:
                with self.assertRaises(PermissionError):
                    comparison.refresh_heartbeat(p)
                self.assertEqual(save.call_count, 6)
                self.assertEqual(sleep.call_count, 5)
                self.assertEqual(p.read_bytes(), original)

    def test_heartbeat_transient_error_recovers_and_other_errors_do_not_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "heartbeat.json"
            p.write_text(json.dumps({"heartbeatAtUtc": "old"}), encoding="utf-8")
            with patch.object(comparison, "save_json", side_effect=[PermissionError("locked"), None]) as save, patch.object(comparison.time, "sleep"):
                comparison.refresh_heartbeat(p)
                self.assertEqual(save.call_count, 2)
            with patch.object(comparison, "save_json", side_effect=OSError("disk failure")) as save:
                with self.assertRaises(OSError):
                    comparison.refresh_heartbeat(p)
                self.assertEqual(save.call_count, 1)


if __name__ == "__main__":
    unittest.main()

"""CPU behavior tests; no GPU, source edits or production parameter updates."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import painter_rgb_head_adaptation_experiment as experiment


class HeadAdaptationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def policy(self):
        return json.loads((ROOT / experiment.POLICY).read_text(encoding="utf-8"))

    def test_exact_policy_and_budget(self):
        p = self.policy()
        experiment.validate_policy(p)
        self.assertEqual(p["training"]["epochs"] * 2, 1000)

    def test_each_training_or_resource_change_is_refused(self):
        for section in ("training", "resources"):
            for key in self.policy()[section]:
                p = self.policy()
                p[section][key] = None
                with self.subTest(section=section, key=key), self.assertRaises(ValueError):
                    experiment.validate_policy(p)

    def test_head_scope_and_other_boundaries_cannot_expand(self):
        for key, value in (("trainableHeads", [*experiment.HEADS, "terrain_water"]), ("resolution", [512, 384]),
                           ("sampleIds", ["challenge", "validation"]), ("frozen", []), ("prohibited", [])):
            p = self.policy()
            p[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                experiment.validate_policy(p)

    def test_no_qualification_can_be_enabled(self):
        for key in self.policy()["qualification"]:
            p = self.policy()
            p["qualification"][key] = True
            with self.subTest(key=key), self.assertRaises(ValueError):
                experiment.validate_policy(p)

    def test_materialization_is_deterministic_read_only(self):
        a = experiment.materialize(ROOT)
        out = ROOT / experiment.ROOT / a["experimentIdentity"]
        before = sorted(p.name for p in out.iterdir()) if out.exists() else None
        self.assertEqual(a, experiment.materialize(ROOT))
        self.assertEqual(before, sorted(p.name for p in out.iterdir()) if out.exists() else None)

    def test_actual_cpu_head_gradients_match_original_full_v6_objective(self):
        import torch
        from train_ai_assisted_conditional_denoiser import composite_denoiser_losses_v6
        p = experiment.materialize(ROOT)
        config = p["config"]
        generator = torch.Generator().manual_seed(71)
        rgb = torch.rand(1, 3, 32, 32, generator=generator, requires_grad=True)
        target = torch.rand(1, 3, 32, 32, generator=generator)
        conditions = torch.rand(1, 23, 32, 32, generator=generator)
        latent = torch.rand(1, 12, 8, 8, generator=generator)
        probe = torch.full((1, 23, 8, 8), 0.5)
        # Synthetic frozen terms are only a derivative-equivalence fixture,
        # never logged as production velocity/condition measurements.
        original = composite_denoiser_losses_v6(latent, latent * 0.9, latent, latent * 0.8,
            probe, probe * 0.9, rgb, target, conditions, config)["compositeLossTensor"]
        subset, values = experiment.rgb_objective(rgb, target, conditions, config)
        a = torch.autograd.grad(original, rgb, retain_graph=True)[0]
        b = torch.autograd.grad(subset, rgb)[0]
        torch.testing.assert_close(a, b, rtol=0, atol=0)
        self.assertEqual(set(values), set(experiment.RGB_KEYS))
        self.assertTrue(torch.isfinite(b).all())
        self.assertGreater(float(b.abs().sum()), 0)

    def test_real_model_update_changes_only_five_rgb_heads(self):
        import torch
        from ai_painter.complete_world.split_training import state_hash
        from train_ai_assisted_conditional_denoiser import decode_final_visible_rgb
        p = experiment.materialize(ROOT)
        model, _ = experiment.load_models(ROOT, p, "cpu")
        dataset = experiment.HeadDataset(ROOT, p)
        item = dataset[0]
        for i in range(2):
            coverage = experiment.validate_coverage(model, dataset[i]["conditions"][None], p["config"])
            self.assertGreater(coverage["object_footprints"], 0)
            self.assertEqual(coverage["terrain_water"], 0)
            self.assertEqual(coverage["terrain_shoreline"], 0)
        for name, fill in (("object_footprints", 0), ("terrain_water", 1)):
            invalid = item["conditions"][None].clone()
            invalid[:, p["config"]["conditionChannelOrder"].index(name)].fill_(fill)
            with self.subTest(channel=name), self.assertRaisesRegex(ValueError, name):
                experiment.validate_coverage(model, invalid, p["config"])
        cached = torch.load(ROOT / p["samplingTensors"][0]["path"], map_location="cpu", weights_only=True)
        parameters = experiment.head_parameters(model)
        before = experiment.frozen_state(model)
        heads = {k: state_hash(v.state_dict()) for k, v in model.denoiser.rgb_responsibility_heads.items()}
        rgb = decode_final_visible_rgb(model, cached["denormalizedGeneratedLatent"], item["conditions"][None], p["config"])
        loss, _ = experiment.rgb_objective(rgb, item["image"][None], item["conditions"][None], p["config"])
        loss.backward()
        for name, param in model.named_parameters():
            self.assertTrue(param.grad is None or name.startswith(experiment.PREFIXES), name)
        for name in experiment.HEADS:
            self.assertTrue(any(v.grad is not None and bool(v.grad.abs().sum() > 0) for v in model.denoiser.rgb_responsibility_heads[name].parameters()))
        torch.optim.AdamW(parameters, lr=0.0001).step()
        self.assertEqual(experiment.frozen_state(model), before)
        for k, module in model.denoiser.rgb_responsibility_heads.items():
            self.assertEqual(state_hash(module.state_dict()) != heads[k], k in experiment.HEADS)
        self.assertFalse(torch.cuda.is_initialized())

    def test_checkpoint_cannot_expand_or_publish(self):
        p = {"experimentIdentity": "test", "denoiserCheckpoint": {"sha256": "a" * 64}, "decoderCheckpoint": {"sha256": "b" * 64}}
        cp = {"schemaVersion": "ai-painter-rgb-head-adaptation-checkpoint-v2", "experimentIdentity": "test", "optimizerSteps": 1000,
            "trainableHeads": list(experiment.HEADS), "selectedSampleIds": experiment.SAMPLES,
            "parentDenoiser": p["denoiserCheckpoint"], "frozenDecoder": p["decoderCheckpoint"], "checkpointPromotable": False, "formalInferenceEligible": False}
        experiment.validate_checkpoint(cp, p)
        for key, value in (("schemaVersion", "formal"), ("optimizerSteps", 1001), ("experimentIdentity", "other"),
                           ("trainableHeads", []), ("selectedSampleIds", []), ("parentDenoiser", {}), ("frozenDecoder", {}),
                           ("checkpointPromotable", True), ("formalInferenceEligible", True), ("autoencoderState", {}), ("optimizerState", {})):
            with self.subTest(key=key), self.assertRaises(ValueError):
                experiment.validate_checkpoint(dict(cp, **{key: value}), p)

    def test_stopped_child_is_never_targeted(self):
        child = Mock()
        child.poll.return_value = 0
        with patch.object(experiment.subprocess, "run") as run:
            experiment.stop_owned(child)
            run.assert_not_called()
        child.wait.assert_not_called()

    def test_only_exact_owned_live_child_can_be_stopped(self):
        child = Mock(pid=12345)
        child.poll.return_value = None
        with patch.object(experiment.os, "name", "nt"), patch.object(experiment.subprocess, "run", return_value=Mock(returncode=0)) as run:
            experiment.stop_owned(child)
            self.assertEqual(run.call_args.args[0], ["taskkill.exe", "/PID", "12345", "/T", "/F"])
        child.wait.assert_called_once_with(timeout=10)


if __name__ == "__main__":
    unittest.main()

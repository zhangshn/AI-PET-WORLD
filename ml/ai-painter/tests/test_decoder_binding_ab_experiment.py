"""Real CPU gradient/freeze checks and negative tests for the paired experiment."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import painter_decoder_binding_ab_experiment as ab


class DecoderBindingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)
        cls.package = ab.materialize(ROOT)
        cls.policy = ab.bound_json(ROOT, cls.package["policy"])

    def test_policy_freezes_all_safety_and_experiment_boundaries(self):
        ab.validate_policy(self.policy)
        for key in ("schemaVersion", "scope", "resolution", "sampleIds", "arms", "training", "resources", "comparison", "frozen", "qualification"):
            value = deepcopy(self.policy)
            value[key] = None
            with self.subTest(key=key), self.assertRaises(ValueError):
                ab.validate_policy(value)

    def test_policy_rejects_added_steps_or_loss_and_threshold_changes(self):
        for section, key, value in (("training", "optimizerStepsPerArm", 1001), ("training", "learningRate", .001),
                ("training", "objective", "new_loss"), ("resources", "cudaMemoryFraction", .8),
                ("resources", "automaticRetries", 1), ("qualification", "checkpointPromotable", True),
                ("comparison", "targetUsedForInitialization", True), ("comparison", "measureBothArmsWithCurrentDecoder", False)):
            invalid = deepcopy(self.policy)
            invalid[section][key] = value
            with self.subTest(section=section, key=key), self.assertRaises(ValueError):
                ab.validate_policy(invalid)

    def test_materialization_repeats_without_creating_an_execution(self):
        output = ROOT / ab.previous.ROOT / self.package["experimentIdentity"]
        before = sorted(p.name for p in output.iterdir()) if output.exists() else None
        self.assertEqual(self.package, ab.materialize(ROOT))
        self.assertEqual(before, sorted(p.name for p in output.iterdir()) if output.exists() else None)
        self.assertGreater(len(self.package["inputReceipts"]), 173)

    def test_source_tamper_fails_closed(self):
        binding = dict(self.package["sourceTrajectory"], sha256="0"*64)
        with self.assertRaises(ValueError):
            ab.bound_json(ROOT, binding)

    def test_dataset_is_two_original_train_images_with_new_experiment_identity(self):
        data = ab.dataset_for(ROOT, self.package)
        self.assertEqual(len(data), 2)
        for i, sample in enumerate(ab.previous.SAMPLES):
            item = data[i]
            self.assertEqual(item["sampleId"], sample)
            self.assertEqual(item["split"], "train")
            self.assertEqual(item["datasetReleaseIdentity"], self.package["experimentIdentity"])
            self.assertEqual(tuple(item["image"].shape), (3, 192, 256))
            self.assertEqual(tuple(item["conditions"].shape), (23, 192, 256))

    def test_models_share_denoiser_encoder_heads_and_normalization(self):
        import torch
        from ai_painter.complete_world.split_training import state_hash
        left, ln = ab.load_arm(ROOT, self.package, ab.ARMS[0])
        right, rn = ab.load_arm(ROOT, self.package, ab.ARMS[1])
        self.assertEqual(state_hash(left.denoiser.state_dict()), state_hash(right.denoiser.state_dict()))
        self.assertEqual(state_hash(left.autoencoder.encoder.state_dict()), state_hash(right.autoencoder.encoder.state_dict()))
        self.assertEqual(state_hash(ln), state_hash(rn))
        self.assertNotEqual(state_hash(left.autoencoder.decoder.state_dict()), state_hash(right.autoencoder.decoder.state_dict()))
        self.assertFalse(torch.cuda.is_initialized())
        with self.assertRaises(ValueError):
            ab.load_arm(ROOT, self.package, "invented_arm")

    def test_normalization_follows_requested_device_without_mutating_source(self):
        import torch
        source = {"mean": torch.ones(1, 12, 1, 1), "standardDeviation": torch.ones(1, 12, 1, 1)*2, "sampleCount": 2}
        # Meta tensors exercise a non-CPU destination without initializing CUDA.
        moved = ab.normalization_to_device(source, "meta")
        self.assertEqual(moved["mean"].device.type, "meta")
        self.assertEqual(moved["standardDeviation"].device.type, "meta")
        self.assertEqual(tuple(moved["mean"].shape), (1, 12, 1, 1))
        self.assertEqual(moved["sampleCount"], 2)
        self.assertEqual(source["mean"].device.type, "cpu")
        self.assertTrue(torch.equal(source["standardDeviation"], torch.ones(1, 12, 1, 1)*2))
        self.assertFalse(torch.cuda.is_initialized())

    def test_repair_preserves_zero_step_failure_and_unchanged_total_budget(self):
        failure = ab.bound_json(ROOT, self.package["supersededZeroStepFailure"])
        self.assertFalse(failure["trainingStarted"])
        self.assertEqual(failure["optimizerSteps"], 0)
        self.assertEqual(self.package["training"]["totalOptimizerStepLimit"], 2000)
        second = ab.bound_json(ROOT, self.package["supersededZeroStepDeterminismFailure"])
        self.assertEqual(second["optimizerSteps"], 0)
        self.assertFalse(second["trainingStarted"])
        self.assertFalse(self.package["numericRuntime"]["trainingDeterministicAlgorithms"])
        self.assertTrue(self.package["numericRuntime"]["inferenceDeterministicAlgorithms"])

    def test_actual_v6_backward_and_cpu_step_preserve_ae_and_all_rgb_heads(self):
        import torch
        import train_ai_assisted_conditional_denoiser as trainer
        from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash
        from torch.utils.data import DataLoader
        for arm in ab.ARMS:
            model, norm = ab.load_arm(ROOT, self.package, arm)
            parameters = ab.trainable_parameters(model)
            frozen, initial = ab.frozen_hash(model), state_hash(model.denoiser.state_dict())
            dataset = ab.dataset_for(ROOT, self.package)
            optimizer = torch.optim.AdamW(parameters, lr=.0001)
            alpha = trainer.build_diffusion_schedule(self.package["config"], "cpu")["alphasCumulative"]
            with TrainSplitBoundary(model, optimizer, dataset) as boundary:
                for batch in boundary.wrap_loader(DataLoader(dataset, batch_size=1, shuffle=False)):
                    target, conditions = batch["image"], batch["conditions"]
                    with torch.no_grad():
                        clean = trainer.normalize_latent(model.autoencoder.encode(target), norm)
                    noise = torch.randn(clean.shape, generator=torch.Generator().manual_seed(17))
                    t = torch.tensor([489])
                    noisy = trainer.add_noise(clean, noise, t, alpha)
                    target_velocity = trainer.velocity_target(clean, noise, t, alpha)
                    loss = trainer.predict_and_measure(model, noisy, target_velocity, clean, t, alpha, conditions,
                        self.package["config"], target_image=target, latent_normalization=norm)["compositeLossTensor"]
                    loss.backward()
                    self.assertTrue(ab.check_gradients(model))
                    self.assertTrue(all(p.grad is None for p in model.autoencoder.parameters()))
                    self.assertTrue(all(p.grad is None for p in model.denoiser.rgb_responsibility_heads.parameters()))
                    optimizer.step()
                    break
                self.assertEqual(boundary.evidence()["optimizerSteps"], 1)
                with self.assertRaises(ValueError):
                    optimizer.step()
            self.assertEqual(ab.frozen_hash(model), frozen)
            self.assertNotEqual(state_hash(model.denoiser.state_dict()), initial)

    def test_injected_frozen_gradient_is_rejected(self):
        import torch
        model, _ = ab.load_arm(ROOT, self.package, ab.ARMS[1])
        ab.trainable_parameters(model)
        parameter = next(model.autoencoder.parameters())
        parameter.grad = torch.ones_like(parameter)
        with self.assertRaisesRegex(ValueError, "frozen gradient"):
            ab.check_gradients(model)

    def checkpoint(self):
        return {"schemaVersion": "ai-painter-decoder-binding-ab-checkpoint-v1", "experimentIdentity": self.package["experimentIdentity"],
            "arm": ab.ARMS[0], "optimizerSteps": 1000, "parentDenoiser": self.package["initialDenoiser"],
            "trainingDecoder": self.package["trainingDecoders"][ab.ARMS[0]], "inferenceDecoder": self.package["inferenceDecoder"],
            "checkpointPromotable": False, "formalInferenceEligible": False}

    def test_checkpoint_identity_decoder_steps_and_nonpromotion(self):
        cp = self.checkpoint()
        ab.validate_checkpoint(cp, self.package, ab.ARMS[0])
        for key in cp:
            invalid = deepcopy(cp)
            invalid[key] = None
            with self.subTest(key=key), self.assertRaises(ValueError):
                ab.validate_checkpoint(invalid, self.package, ab.ARMS[0])
        for key in ("autoencoderState", "optimizerState"):
            with self.assertRaises(ValueError):
                ab.validate_checkpoint(dict(cp, **{key: {}}), self.package, ab.ARMS[0])

    def fixture(self):
        rows = []
        for arm in ab.ARMS:
            for i, sample in enumerate(ab.previous.SAMPLES):
                for j, seed in enumerate(ab.comparison.SETTINGS["seedsBySample"][i]):
                    rows.append({"arm": arm, "sampleId": sample, "seed": seed,
                        "baseline": {"final": dict.fromkeys(("rgbMae", "laplacianMae", "phase4ResidualRmsAfterGlobalBiasRemoval"), 2.)},
                        "measurements": {"final": dict.fromkeys(("rgbMae", "laplacianMae", "phase4ResidualRmsAfterGlobalBiasRemoval"), [1., 2., 3.][j])}})
        return rows

    def test_summary_retains_all_ties_improvements_and_regressions(self):
        result = ab.summarize(self.fixture())
        for arm in result["arms"].values():
            for metric in arm.values():
                self.assertEqual((metric["improvedCount"], metric["equalCount"], metric["worseCount"]), (2, 2, 2))
        self.assertFalse(result["checkpointSelected"])
        self.assertFalse(result["formalVisualQualification"])

    def test_incomplete_reordered_and_invalid_metrics_are_rejected(self):
        rows = self.fixture()
        for invalid in (rows[:-1], rows + [rows[0]], list(reversed(rows))):
            with self.assertRaises(ValueError):
                ab.summarize(invalid)
        for value in (float("nan"), float("inf"), -1, True):
            invalid = deepcopy(rows)
            invalid[0]["measurements"]["final"]["rgbMae"] = value
            with self.assertRaises(ValueError):
                ab.summarize(invalid)

    def test_controller_stop_only_targets_its_owned_child(self):
        class Child:
            pid = 7123
            def poll(self): return 0
        with patch.object(ab.previous.subprocess, "run") as run:
            ab.previous.stop_owned(None)
            ab.previous.stop_owned(Child())
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()

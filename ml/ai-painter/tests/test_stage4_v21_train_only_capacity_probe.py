"""CPU-only boundaries for the V21 train-only capacity experiment."""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
import unittest

import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v21_train_only_capacity_probe as worker

POLICY = worker.POLICY_PATH


class V21TrainOnlyCapacityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy, cls.reader = worker.policy_from_path(POLICY)

    def test_frozen_policy_and_two_train_originals(self):
        self.assertEqual(self.policy["priorFailedExecution"], worker.PRIOR_FAILURE)
        worker.validate_prior_failure(worker.cpu.BoundReader())
        self.assertEqual(self.policy["training"]["maxGeneratorOptimizerSteps"], 512)
        self.assertEqual(self.policy["training"]["maxDiscriminatorOptimizerSteps"], 512)
        self.assertEqual([row["trainOrdinal"] for row in self.policy["selectedTrainRows"]], [0, 43])
        self.assertEqual([row["sampleId"] for row in self.policy["selectedTrainRows"]],
                         [sample_id for _, sample_id in worker.SUBJECTS])
        _, _, rows, qualification = worker.fixed_rows(worker.cpu.BoundReader(), self.policy)
        self.assertTrue(all(row["split"] == "train" for row in rows))
        self.assertEqual(qualification["selectedOriginalRowUseQualification"],
                         ["unverified_not_training_eligible"] * 2)
        self.assertTrue(qualification["releaseQualification"]["dataQualifiedForTraining"])
        self.assertFalse(qualification["releaseQualification"]["trainingAllowed"])

    def test_no_non_train_split_file_or_pixels_read(self):
        observed = self.reader.observed
        manifest = self.reader.json(worker.MANIFEST)
        for split in ("validation", "challenge", "regression"):
            self.assertNotIn(manifest["splits"][split]["path"], observed)
        self.assertNotIn("validation", " ".join(observed).lower())

    def test_counterexamples_fail_closed(self):
        cases = (
            (lambda p: p["selectedTrainRows"][1].update(sampleId="wrong"), "identity"),
            (lambda p: p["selectedTrainRows"][1].update(imageSha256="0" * 64), "identity"),
            (lambda p: p["execution"].update(validationReadAllowed=True), "boundary"),
            (lambda p: p["training"].update(maxGeneratorOptimizerSteps=513), "step"),
            (lambda p: p["resources"].update(maxOutputMiB=513), "resource"),
            (lambda p: p["model"].update(priorOrFailedCheckpointLoaded=True), "fresh"),
            (lambda p: p["priorFailedExecution"].update(oldIdentityMustNotBeReused=False), "prior"),
        )
        for mutate, _ in cases:
            with self.subTest(mutate=mutate):
                candidate = deepcopy(self.policy)
                mutate(candidate)
                with self.assertRaises((ValueError, TypeError, KeyError)):
                    worker.validate_policy(candidate)
                    worker.fixed_rows(worker.cpu.BoundReader(), candidate)

    def test_consumed_v1_policy_rejected(self):
        old = "data/ai-painter/system-governance/stage4-mvp-v21-train-only-capacity-probe-v1.json"
        with self.assertRaisesRegex(ValueError, "replacement V21 capacity policy"):
            worker.policy_from_path(old)

    def test_optimizer_rejects_non_train_sample_before_step(self):
        counts = {"generator": 0, "discriminator": 0}
        with self.assertRaisesRegex(ValueError, "validation/held-out"):
            worker.v21.update_network(None, None, None, {"split": "validation"},
                                      "generator", counts, 512, lambda: None)
        self.assertEqual(counts, {"generator": 0, "discriminator": 0})

    def test_real_cpu_losses_enforce_probe_gradient_isolation(self):
        from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
            build_conditional_texture_discriminator,
        )
        from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
            train_structured_object_objective,
        )
        torch.set_num_threads(2)
        reader = worker.cpu.BoundReader()
        order, continuous, rows, _ = worker.fixed_rows(reader, self.policy)
        sample, _ = worker.cpu.load_sample(reader, rows[0], order, continuous)
        critic = build_conditional_texture_discriminator()
        prediction = sample["image"][None].clone().requires_grad_(True)

        with self.assertRaisesRegex(ValueError, "frozen critic"):
            train_structured_object_objective(critic, prediction, sample,
                                              sample["objectInstanceTable"], order)
        critic.requires_grad_(False)
        worker.require_critic_mode(critic, trainable=False)
        loss, _ = train_structured_object_objective(critic, prediction, sample,
                                                    sample["objectInstanceTable"], order)
        loss.backward()
        self.assertIsNotNone(prediction.grad)
        self.assertGreater(float(prediction.grad.abs().sum()), 0)
        self.assertTrue(all(parameter.grad is None for parameter in critic.parameters()))

        prediction.grad = None
        critic.requires_grad_(True)
        worker.require_critic_mode(critic, trainable=True)
        with self.assertRaisesRegex(ValueError, "critic requires_grad"):
            worker.require_critic_mode(critic, trainable=False)
        detached = prediction.detach()
        discriminator_loss, _ = worker.gpu.detached_discriminator_objective(critic, detached, sample)
        discriminator_loss.backward()
        self.assertIsNone(prediction.grad)
        self.assertTrue(any(parameter.grad is not None and float(parameter.grad.abs().sum()) > 0
                            for parameter in critic.parameters()))
        critic.zero_grad(set_to_none=True)
        critic.requires_grad_(False)
        with self.assertRaisesRegex(ValueError, "trainable critic"):
            worker.gpu.detached_discriminator_objective(critic, detached, sample)


if __name__ == "__main__":
    unittest.main()

"""CPU counterexamples for the inactive, train-only texture candidate."""

import json
from pathlib import Path
import unittest

import torch

from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    EXECUTION_QUALIFIED,
    FACT_REGION_CHANNELS,
    PROTOTYPE_ID,
    build_conditional_texture_discriminator,
    discriminator_train_objective,
    fact_region_coarse_rgb_loss,
    generator_train_objective,
    highpass_rgb,
    validation_candidate_score,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (
    build_native_rgb_instance_object_prototype,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import SplitReleaseDataset


class ConditionalTextureCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-instance-object-v13-contract.json")
                              .read_text(encoding="utf-8"))
        cls.dataset = SplitReleaseDataset(
            root, contract["datasetBinding"]["manifest"], "train", (256, 192),
        )
        cls.validation_dataset = SplitReleaseDataset(
            root, contract["datasetBinding"]["manifest"], "validation", (256, 192),
        )
        cls.order = tuple(cls.dataset.manifest["identityPayload"]["channelOrder"])

    def test_real_bound_train_has_finite_generator_and_critic_gradients(self):
        self.assertFalse(EXECUTION_QUALIFIED)
        self.assertEqual(PROTOTYPE_ID,
                         "stage4_mvp_native_rgb_conditional_texture_cpu_prototype_v1")
        sample = load_bound_object_sample(self.dataset, 0)
        torch.manual_seed(29)
        model = build_native_rgb_instance_object_prototype(
            condition_channel_order=self.order, base_channels=32, patch_channels=16,
        )
        discriminator = build_conditional_texture_discriminator()
        predicted = model(sample["conditions"][None], sample["objectInstanceTable"])
        predicted.retain_grad()
        critic_loss, scores = discriminator_train_objective(
            discriminator, predicted, sample,
        )
        self.assertTrue(torch.isfinite(critic_loss))
        self.assertTrue(torch.isfinite(scores["realScore"]))
        critic_loss.backward(retain_graph=True)
        self.assertIsNone(predicted.grad)
        self.assertTrue(any(parameter.grad is not None and bool(parameter.grad.abs().sum())
                            for parameter in discriminator.parameters()))
        discriminator.zero_grad(set_to_none=True)
        discriminator.requires_grad_(False)
        total, parts = generator_train_objective(
            discriminator, predicted, sample, sample["objectInstanceTable"],
            self.order,
        )
        self.assertEqual(parts["objectCount"], len(sample["objectInstanceTable"]))
        self.assertGreater(float(parts["factRegionCoarseRgbMae"].detach()), 0)
        self.assertGreater(float(parts["localTextureMoments"].detach()), 0)
        self.assertTrue(torch.isfinite(total))
        total.backward()
        self.assertIsNotNone(predicted.grad)
        self.assertGreater(float(predicted.grad.abs().sum()), 0)
        self.assertTrue(all(parameter.grad is None
                            for parameter in discriminator.parameters()))
        self.assertTrue(any(parameter.grad is not None and bool(parameter.grad.abs().sum())
                            for parameter in model.object_head.parameters()))
        self.assertTrue(any(parameter.grad is not None and bool(parameter.grad.abs().sum())
                            for parameter in model.core.parameters() if parameter.requires_grad))

    def test_non_train_splits_cannot_update_critic_or_generator(self):
        sample = load_bound_object_sample(self.dataset, 0)
        predicted = sample["image"][None].clone().requires_grad_(True)
        discriminator = build_conditional_texture_discriminator()
        for split in ("validation", "challenge", "regression"):
            other = {**sample, "split": split}
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "train split"):
                discriminator_train_objective(discriminator, predicted, other)
            discriminator.requires_grad_(False)
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "train split"):
                generator_train_objective(discriminator, predicted, other,
                                          sample["objectInstanceTable"], self.order)
            discriminator.requires_grad_(True)

    def test_validation_score_has_no_gradient_or_critic_input(self):
        sample = load_bound_object_sample(self.validation_dataset, 0)
        predicted = sample["image"][None].clone().requires_grad_(True)
        score, parts = validation_candidate_score(
            predicted, sample, sample["objectInstanceTable"], self.order,
        )
        self.assertFalse(score.requires_grad)
        self.assertIsNone(predicted.grad)
        self.assertEqual(parts["objectCount"], len(sample["objectInstanceTable"]))
        for split in ("train", "challenge", "regression"):
            with self.subTest(split=split), self.assertRaisesRegex(
                ValueError, "validation split",
            ):
                validation_candidate_score(predicted, {**sample, "split": split},
                                           sample["objectInstanceTable"], self.order)

    def test_highpass_removes_constant_color_offset(self):
        rgb = torch.full((1, 3, 192, 256), 0.3)
        self.assertLess(float(highpass_rgb(rgb).abs().max()), 1e-6)
        self.assertLess(float(highpass_rgb(rgb + 0.2).abs().max()), 1e-6)

    def test_each_declared_fact_region_has_original_rgb_supervision(self):
        target = torch.zeros((1, 3, 192, 256))
        for role in FACT_REGION_CHANNELS:
            with self.subTest(role=role):
                conditions = torch.zeros((1, 23, 192, 256))
                conditions[:, self.order.index(role), 50:56, 70:77] = 1
                predicted = target.clone().requires_grad_(True)
                with torch.no_grad():
                    predicted[:, :, 50:56, 70:77] = 0.4
                loss = fact_region_coarse_rgb_loss(
                    predicted, target, conditions, self.order,
                )
                self.assertGreater(float(loss.detach()), 0)
                gradient = torch.autograd.grad(loss, predicted)[0]
                self.assertGreater(float(gradient[:, :, 50:56, 70:77].abs().sum()), 0)
        blank = torch.zeros((1, 23, 192, 256))
        self.assertEqual(float(fact_region_coarse_rgb_loss(
            target, target, blank, self.order,
        )), 0)

    def test_generator_requires_frozen_critic(self):
        sample = load_bound_object_sample(self.dataset, 0)
        predicted = sample["image"][None].clone()
        discriminator = build_conditional_texture_discriminator()
        with self.assertRaisesRegex(ValueError, "frozen critic"):
            generator_train_objective(discriminator, predicted, sample,
                                      sample["objectInstanceTable"], self.order)

    def test_each_natural_object_kind_has_train_rgb_gradient_and_role_guard(self):
        roles = {"tree": "object_tree", "rock": "object_rock",
                 "shrub": "object_vegetation"}
        critic = build_conditional_texture_discriminator()
        critic.requires_grad_(False)
        for kind, role in roles.items():
            with self.subTest(kind=kind):
                conditions = torch.zeros((23, 192, 256))
                conditions[self.order.index("terrain_grass")] = 1
                conditions[self.order.index(role), 40:44, 40:44] = 1
                conditions[self.order.index("object_instance"), 40:44, 40:44] = 7 / 255
                table = [{"value": 7, "kind": kind, "footprint": {
                    "x": 160, "y": 160, "width": 16, "height": 16,
                }}]
                sample = {"sampleId": f"synthetic-{kind}", "split": "train",
                          "conditions": conditions, "image": torch.zeros((3, 192, 256))}
                predicted = torch.full((1, 3, 192, 256), 0.3,
                                       requires_grad=True)
                _, parts = generator_train_objective(
                    critic, predicted, sample, table, self.order,
                )
                self.assertGreater(float(parts["instanceSupportRgbMae"].detach()), 0)
                gradient = torch.autograd.grad(
                    parts["instanceSupportRgbMae"], predicted,
                )[0]
                self.assertGreater(float(gradient[..., 35:65, 35:65].abs().sum()), 0)
                rejected = {**sample, "conditions": conditions.clone()}
                rejected["conditions"][self.order.index(role)] = 0
                with self.assertRaisesRegex(ValueError, "authoritative role mask"):
                    generator_train_objective(
                        critic, predicted, rejected, table, self.order,
                    )


if __name__ == "__main__":
    unittest.main()

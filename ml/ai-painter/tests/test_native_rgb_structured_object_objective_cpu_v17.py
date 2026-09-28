"""Split isolation and gradient checks for the inactive V17 CPU objective."""

import json
from pathlib import Path
import unittest

import torch

from ai_painter.complete_world.native_rgb_conditional_texture_cpu import (
    build_conditional_texture_discriminator,
)
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
    original_object_class_spatial_loss, train_structured_object_objective,
    validation_structured_object_score,
)
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import (
    build_native_rgb_structured_object_cpu_v17,
)
from ai_painter.complete_world.object_instance_supervision_cpu import load_bound_object_sample
from ai_painter.complete_world.split_release import SplitReleaseDataset


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                         .read_text(encoding="utf-8"))["tensorContract"]["channelOrder"])


def sample(split="train"):
    conditions = torch.zeros((23, 192, 256))
    conditions[ORDER.index("terrain_grass")] = 1
    for channel in ("object_footprints", "object_tree"):
        conditions[ORDER.index(channel), 40:44, 40:44] = 1
    conditions[ORDER.index("object_instance"), 40:44, 40:44] = 7 / 255
    target = torch.zeros((3, 192, 256))
    pattern = torch.arange(16, dtype=torch.float32).reshape(4, 4) / 15
    target[:, 40:44, 40:44] = pattern
    table = [{"value": 7, "kind": "tree", "footprint": {
        "x": 160, "y": 160, "width": 16, "height": 16,
    }}]
    return {"sampleId": "source-original", "split": split,
            "conditions": conditions, "image": target}, table


class StructuredObjectObjectiveCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)

    def test_aligned_object_beats_inverted_and_uniform(self):
        bound, _ = sample()
        aligned = bound["image"][None].clone()
        inverted = aligned.clone()
        inverted[..., 40:44, 40:44] = 1 - inverted[..., 40:44, 40:44]
        uniform = torch.full_like(aligned, 0.2, requires_grad=True)
        aligned_loss, _ = original_object_class_spatial_loss(aligned, bound, ORDER, split="train")
        inverted_loss, _ = original_object_class_spatial_loss(inverted, bound, ORDER, split="train")
        uniform_loss, correlations = original_object_class_spatial_loss(
            uniform, bound, ORDER, split="train")
        self.assertLess(float(aligned_loss.detach()), float(uniform_loss.detach()))
        self.assertLess(float(uniform_loss.detach()), float(inverted_loss.detach()))
        self.assertEqual(set(correlations), {"object_footprints", "object_tree"})
        uniform_loss.backward()
        self.assertTrue(bool(torch.isfinite(uniform.grad).all()))
        self.assertGreater(float(uniform.grad[..., 40:44, 40:44].abs().sum()), 0)
        self.assertEqual(float(uniform.grad[..., :10, :10].abs().sum()), 0)

    def test_train_and_validation_are_distinct_and_challenge_fails_closed(self):
        bound, table = sample("train")
        predicted = torch.full((1, 3, 192, 256), 0.2, requires_grad=True)
        critic = build_conditional_texture_discriminator().eval()
        critic.requires_grad_(False)
        score, parts = train_structured_object_objective(
            critic, predicted, bound, table, ORDER)
        self.assertTrue(bool(torch.isfinite(score)))
        self.assertIn("objectClassSpatialLoss", parts)
        score.backward()
        self.assertGreater(float(predicted.grad.abs().sum()), 0)
        bound["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "train split"):
            train_structured_object_objective(critic, predicted, bound, table, ORDER)
        validation_score, _ = validation_structured_object_score(
            predicted, bound, table, ORDER)
        self.assertFalse(validation_score.requires_grad)
        for split in ("train", "challenge", "regression"):
            bound["split"] = split
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "validation split"):
                validation_structured_object_score(predicted, bound, table, ORDER)

    def test_missing_original_structure_and_nonfinite_output_fail_closed(self):
        bound, _ = sample()
        bound["image"].zero_()
        with self.assertRaisesRegex(ValueError, "no nonconstant original"):
            original_object_class_spatial_loss(
                torch.zeros((1, 3, 192, 256)), bound, ORDER, split="train")
        bound, _ = sample()
        predicted = torch.zeros((1, 3, 192, 256))
        predicted[..., 40, 40] = float("nan")
        with self.assertRaisesRegex(ValueError, "finite values"):
            original_object_class_spatial_loss(predicted, bound, ORDER, split="train")

    def test_real_bound_train_sample_reaches_new_model_and_objective(self):
        contract = json.loads((ROOT / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract.json")
                              .read_text(encoding="utf-8"))
        dataset = SplitReleaseDataset(ROOT, contract["datasetBinding"]["manifest"],
                                      "train", (256, 192))
        bound = load_bound_object_sample(dataset, 0)
        model = build_native_rgb_structured_object_cpu_v17(
            condition_channel_order=ORDER, base_channels=32, patch_channels=16)
        critic = build_conditional_texture_discriminator().eval()
        critic.requires_grad_(False)
        predicted = model(bound["conditions"][None], bound["objectInstanceTable"])
        score, parts = train_structured_object_objective(
            critic, predicted, bound, bound["objectInstanceTable"], ORDER)
        self.assertTrue(bool(torch.isfinite(score)))
        self.assertGreater(float(parts["objectClassSpatialLoss"].detach()), 0)
        self.assertEqual(parts["objectCount"], len(bound["objectInstanceTable"]))
        score.backward()
        self.assertTrue(any(parameter.grad is not None
                            and float(parameter.grad.detach().abs().sum()) > 0
                            for parameter in model.appearance.parameters()))

    def test_all_bound_train_originals_have_four_object_structure_targets(self):
        contract = json.loads((ROOT / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract.json")
                              .read_text(encoding="utf-8"))
        dataset = SplitReleaseDataset(ROOT, contract["datasetBinding"]["manifest"],
                                      "train", (256, 192))
        self.assertEqual(len(dataset), 48)
        for index in range(len(dataset)):
            bound = load_bound_object_sample(dataset, index)
            with self.subTest(sampleId=bound["sampleId"]):
                loss, correlations = original_object_class_spatial_loss(
                    bound["image"][None], bound, ORDER, split="train")
                self.assertTrue(bool(torch.isfinite(loss)))
                self.assertEqual(set(correlations), {
                    "object_footprints", "object_tree", "object_rock", "object_vegetation",
                })

if __name__ == "__main__":
    unittest.main()

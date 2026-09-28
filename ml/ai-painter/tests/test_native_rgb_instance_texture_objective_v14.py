"""Split and gradient counterexamples for the inactive V14 objective."""

import json
from pathlib import Path
import unittest

import torch

from ai_painter.complete_world.native_rgb_instance_texture_objective_v14 import (
    TEXTURE_WEIGHT,
    train_original_instance_texture_objective,
    validation_instance_texture_score,
)
from ai_painter.complete_world.native_rgb_instance_object_prototype import (
    build_native_rgb_instance_object_prototype,
    train_original_instance_objective,
)
from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (
    local_target_texture_moments_loss,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import SplitReleaseDataset


class InstanceTextureObjectiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "ai-painter-complete-map-condition-contract-v1.json")
                              .read_text(encoding="utf-8"))
        cls.order = tuple(contract["tensorContract"]["channelOrder"])
        cls.conditions = torch.zeros((23, 192, 256))
        cls.conditions[cls.order.index("object_tree"), 55:59, 70:74] = 1
        cls.conditions[cls.order.index("object_instance"), 55:59, 70:74] = 7 / 255
        cls.target = torch.full((3, 192, 256), 0.36)
        cls.target[:, 52:65, 66:78] = 0.18
        cls.table = [{"value": 7, "kind": "tree", "footprint": {
            "x": 280, "y": 220, "width": 16, "height": 16,
        }}]

    def sample(self, split):
        return {"sampleId": "synthetic", "split": split,
                "conditions": self.conditions,
                "image": self.target}

    def test_train_combines_unchanged_v13_and_v12_terms(self):
        predicted = torch.full((1, 3, 192, 256), 0.31, requires_grad=True)
        sample = self.sample("train")
        base, _ = train_original_instance_objective(
            predicted, sample, self.table, self.order,
        )
        texture = local_target_texture_moments_loss(predicted, self.target[None])
        total, parts = train_original_instance_texture_objective(
            predicted, sample, self.table, self.order,
        )
        self.assertTrue(torch.allclose(total, base + TEXTURE_WEIGHT * texture))
        self.assertEqual(parts["instanceCount"], 1)
        self.assertEqual(parts["localTextureWeight"], TEXTURE_WEIGHT)
        total.backward()
        self.assertGreater(float(predicted.grad.abs().sum()), 0)

    def test_validation_cannot_backpropagate_or_accept_other_splits(self):
        predicted = torch.full((1, 3, 192, 256), 0.31, requires_grad=True)
        score, parts = validation_instance_texture_score(
            predicted, self.sample("validation"), self.table, self.order,
        )
        self.assertFalse(score.requires_grad)
        self.assertEqual(parts["instanceCount"], 1)
        self.assertIsNone(predicted.grad)
        for split in ("train", "challenge", "regression"):
            with self.subTest(split=split), self.assertRaisesRegex(
                ValueError, "validation split",
            ):
                validation_instance_texture_score(
                    predicted, self.sample(split), self.table, self.order,
                )

    def test_train_rejects_validation_as_weight_target(self):
        predicted = torch.full((1, 3, 192, 256), 0.31, requires_grad=True)
        with self.assertRaisesRegex(ValueError, "train split"):
            train_original_instance_texture_objective(
                predicted, self.sample("validation"), self.table, self.order,
            )

    def test_bound_train_original_updates_instance_branch_without_validation(self):
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-instance-object-v13-contract.json")
                              .read_text(encoding="utf-8"))
        dataset = SplitReleaseDataset(root, contract["datasetBinding"]["manifest"],
                                      "train", (256, 192))
        sample = load_bound_object_sample(dataset, 0)
        torch.manual_seed(19)
        model = build_native_rgb_instance_object_prototype(
            condition_channel_order=self.order, base_channels=32,
            patch_channels=16,
        )
        predicted = model(sample["conditions"][None],
                          sample["objectInstanceTable"])
        total, parts = train_original_instance_texture_objective(
            predicted, sample, sample["objectInstanceTable"], self.order,
        )
        texture_gradients = torch.autograd.grad(
            parts["localTextureMoments"],
            tuple(model.object_head.parameters()),
            retain_graph=True, allow_unused=True,
        )
        total.backward()
        gradients = [parameter.grad for parameter in model.object_head.parameters()]
        self.assertEqual(parts["instanceCount"],
                         len(sample["objectInstanceTable"]))
        self.assertGreater(float(parts["localTextureMoments"].detach()), 0)
        self.assertGreater(sum(float(gradient.detach().abs().sum())
                               for gradient in texture_gradients
                               if gradient is not None), 0)
        self.assertTrue(all(gradient is not None and torch.isfinite(gradient).all()
                            for gradient in gradients))
        self.assertGreater(sum(float(gradient.abs().sum())
                               for gradient in gradients), 0)



if __name__ == "__main__":
    unittest.main()

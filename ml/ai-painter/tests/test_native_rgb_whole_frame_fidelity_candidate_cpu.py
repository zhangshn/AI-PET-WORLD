"""CPU numerical/split counterexamples; no optimizer, checkpoints or GPU."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import torch
from torch.nn import functional as F

from ai_painter.complete_world import native_rgb_whole_frame_fidelity_candidate_cpu as candidate
from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import local_target_texture_moments_loss
from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import original_object_class_spatial_loss


ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                         "ai-painter-complete-map-condition-contract-v1.json").read_text(
                             encoding="utf-8"))["tensorContract"]["channelOrder"])


def bound_sample():
    conditions = torch.zeros((23, 192, 256))
    conditions[ORDER.index("terrain_grass")] = 1
    for role in ("object_footprints", "object_tree"):
        conditions[ORDER.index(role), 40:44, 40:44] = 1
    conditions[ORDER.index("object_instance"), 40:44, 40:44] = 7 / 255
    target = torch.full((3, 192, 256), .4)
    target[:, 40:44, 40:44] = torch.arange(16).reshape(4, 4) / 20
    table = [{"value": 7, "kind": "tree", "footprint": {
        "x": 160, "y": 160, "width": 16, "height": 16}}]
    return {"sampleId": "synthetic-train", "split": "train", "image": target,
            "conditions": conditions}, table


class FixedCritic(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.scale = torch.nn.Parameter(torch.tensor(1.0), requires_grad=False)

    def forward(self, values):
        return values[:, -3:].mean((1, 2, 3), keepdim=True) * self.scale


class WholeFrameFidelityCandidateCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_candidate_is_inactive_and_reuses_inherited_coefficients(self):
        self.assertFalse(candidate.EXECUTION_QUALIFIED)
        self.assertEqual(candidate.FULL_RGB_WEIGHT, 1.0)
        self.assertEqual(candidate.FULL_EDGE_WEIGHT, .25)

    def test_exact_original_has_zero_fidelity(self):
        sample, _ = bound_sample()
        value, parts = candidate.train_original_whole_frame_fidelity(sample["image"][None], sample)
        self.assertEqual(float(value), 0)
        self.assertEqual(float(parts["wholeFrameSignedEdgeMae"]), 0)

    def test_texture_phase_counterexample_is_now_penalized(self):
        yy, xx = torch.meshgrid(torch.arange(192), torch.arange(256), indexing="ij")
        pattern = ((xx + yy) % 2).float() * 2 - 1
        target = (.5 + .08 * pattern)[None].expand(3, -1, -1).clone()
        predicted = (.5 - .08 * pattern)[None, None].expand(1, 3, -1, -1).clone()
        sample = {"split": "train", "image": target}
        self.assertLess(float(F.l1_loss(F.avg_pool2d(predicted, 4),
                                      F.avg_pool2d(target[None], 4))), 1e-6)
        self.assertLess(float(local_target_texture_moments_loss(predicted, target[None])), 1e-6)
        total, parts = candidate.train_original_whole_frame_fidelity(predicted, sample)
        self.assertAlmostEqual(float(parts["wholeFrameRgbMae"]), .16, places=6)
        self.assertAlmostEqual(float(parts["wholeFrameSignedEdgeMae"]), .32, places=6)
        self.assertAlmostEqual(float(total), .24, places=6)

    def test_contrast_compression_is_not_mistaken_for_exact_original(self):
        sample, _ = bound_sample()
        compressed = .45 + .1 * sample["image"][None]
        spatial, _ = original_object_class_spatial_loss(compressed, sample, ORDER, split="train")
        fidelity, _ = candidate.train_original_whole_frame_fidelity(compressed, sample)
        self.assertLess(float(spatial), 1e-5)
        self.assertGreater(float(fidelity), .01)

    def test_background_has_direct_rgb_gradient(self):
        sample, _ = bound_sample()
        predicted = sample["image"][None].clone()
        predicted[..., 100:104, 100:104] += .1
        predicted.requires_grad_(True)
        _, parts = candidate.train_original_whole_frame_fidelity(predicted, sample)
        gradient = torch.autograd.grad(parts["wholeFrameRgbMae"], predicted)[0]
        self.assertGreater(float(gradient[..., 100:104, 100:104].abs().sum()), 0)
        self.assertEqual(float(gradient[..., :10, :10].abs().sum()), 0)

    def test_signed_edges_reject_direction_reversal(self):
        sample, _ = bound_sample()
        predicted = sample["image"][None].clone()
        predicted[..., 40:44, 40:44] = .75 - predicted[..., 40:44, 40:44]
        _, parts = candidate.train_original_whole_frame_fidelity(predicted, sample)
        self.assertGreater(float(parts["wholeFrameSignedEdgeMae"]), 0)

    def test_non_train_splits_fail_before_inherited_objective(self):
        sample, table = bound_sample()
        for split in ("validation", "challenge", "regression", None):
            with self.subTest(split=split), patch.object(candidate, "train_structured_object_objective") as base:
                with self.assertRaisesRegex(ValueError, "train split"):
                    candidate.train_whole_frame_fidelity_candidate_objective(
                        FixedCritic(), sample["image"][None], {**sample, "split": split}, table, ORDER)
                base.assert_not_called()

    def test_malformed_and_nonfinite_rgb_rejected(self):
        sample, _ = bound_sample()
        for actual in (torch.zeros((1, 3, 96, 128)),
                       torch.full((1, 3, 192, 256), float("nan")),
                       torch.full((1, 3, 192, 256), 1.1)):
            with self.subTest(shape=actual.shape), self.assertRaises(ValueError):
                candidate.train_original_whole_frame_fidelity(actual, sample)
        for target in (torch.zeros((3, 96, 128)), torch.full((3, 192, 256), float("inf"))):
            with self.assertRaises(ValueError):
                candidate.train_original_whole_frame_fidelity(sample["image"][None], {**sample, "image": target})

    def test_targets_receive_no_gradient_and_inputs_are_unchanged(self):
        sample, _ = bound_sample()
        sample["image"].requires_grad_(True)
        image, conditions = sample["image"].detach().clone(), sample["conditions"].clone()
        predicted = torch.full((1, 3, 192, 256), .3, requires_grad=True)
        total, _ = candidate.train_original_whole_frame_fidelity(predicted, sample)
        total.backward()
        self.assertIsNone(sample["image"].grad)
        self.assertTrue(torch.equal(image, sample["image"].detach()))
        self.assertTrue(torch.equal(conditions, sample["conditions"]))
        self.assertTrue(bool(torch.isfinite(predicted.grad).all()))

    def test_inherited_objective_is_preserved_exactly_and_added_once(self):
        sample, table = bound_sample()
        actual = torch.full((1, 3, 192, 256), .3, requires_grad=True)
        old = actual.sum() * .001
        with patch.object(candidate, "train_structured_object_objective",
                          return_value=(old, {"objectCount": 1, "total": old})) as base:
            total, parts = candidate.train_whole_frame_fidelity_candidate_objective(
                FixedCritic(), actual, sample, table, ORDER)
        base.assert_called_once()
        self.assertEqual(parts["objectCount"], 1)
        self.assertTrue(torch.equal(parts["v21UnchangedTotal"], old))
        self.assertTrue(torch.equal(total, old.float() + parts["wholeFrameFidelity"]))

    def test_full_combination_has_finite_gradients_without_critic_updates(self):
        sample, table = bound_sample()
        actual = torch.full((1, 3, 192, 256), .3, requires_grad=True)
        critic = FixedCritic()
        state = {key: value.clone() for key, value in critic.state_dict().items()}
        total, parts = candidate.train_whole_frame_fidelity_candidate_objective(
            critic, actual, sample, table, ORDER)
        gradient = torch.autograd.grad(total, actual)[0]
        self.assertTrue(bool(torch.isfinite(total) and torch.isfinite(gradient).all()))
        self.assertGreater(float(gradient.abs().sum()), 0)
        self.assertGreater(float(parts["wholeFrameFidelity"].detach()), 0)
        self.assertTrue(all(value.grad is None for value in critic.parameters()))
        self.assertTrue(all(torch.equal(value, state[key]) for key, value in critic.state_dict().items()))

    def test_trainable_critic_is_still_rejected(self):
        sample, table = bound_sample()
        critic = FixedCritic().requires_grad_(True)
        with self.assertRaisesRegex(ValueError, "frozen critic"):
            candidate.train_whole_frame_fidelity_candidate_objective(
                critic, sample["image"][None], sample, table, ORDER)

    def test_fresh_v21_terrain_and_object_parameters_have_finite_gradients(self):
        from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import (
            build_fresh_native_rgb_object_residual_v21_cpu,
        )
        sample, table = bound_sample()
        model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=ORDER)
        before = {key: value.clone() for key, value in model.state_dict().items()}
        predicted = model(sample["conditions"][None], table)
        total, _ = candidate.train_whole_frame_fidelity_candidate_objective(
            FixedCritic(), predicted, sample, table, ORDER)
        named = [(key, value) for key, value in model.named_parameters() if value.requires_grad]
        gradients = torch.autograd.grad(total, [value for _, value in named], allow_unused=True)
        reached = {"terrain": False, "object": False}
        for (name, _), gradient in zip(named, gradients):
            if gradient is None:
                continue
            self.assertTrue(bool(torch.isfinite(gradient).all()), name)
            if float(gradient.detach().abs().sum()) > 0:
                if ".terrain." in name:
                    reached["terrain"] = True
                if "object_rgb_heads." in name:
                    reached["object"] = True
        self.assertEqual(reached, {"terrain": True, "object": True})
        self.assertTrue(all(torch.equal(value, before[key])
                            for key, value in model.state_dict().items()))
        self.assertTrue(all(value.grad is None for value in model.parameters()))


if __name__ == "__main__":
    unittest.main()

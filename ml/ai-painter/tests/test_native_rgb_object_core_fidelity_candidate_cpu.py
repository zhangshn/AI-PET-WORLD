"""CPU-only formula, isolation and small-object gradient counterexamples."""
from copy import deepcopy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import torch

from ai_painter.complete_world import native_rgb_object_core_fidelity_candidate_cpu as candidate
from ai_painter.complete_world import native_rgb_whole_frame_fidelity_candidate_cpu as inherited

ROOT = Path(__file__).resolve().parents[3]
ORDER = tuple(json.loads((ROOT / "data/ai-painter/system-governance/"
                          "ai-painter-complete-map-condition-contract-v1.json")
                         .read_text(encoding="utf8"))["tensorContract"]["channelOrder"])


def scene():
    conditions = torch.zeros((23, 192, 256))
    conditions[ORDER.index("terrain_grass")] = 1
    target = torch.full((3, 192, 256), .4)
    table = []
    for x, y, size, value, kind, role in (
        (40, 40, 4, 7, "tree", "object_tree"),
        (100, 70, 2, 13, "rock", "object_rock"),
        (160, 120, 8, 21, "shrub", "object_vegetation"),
    ):
        for channel in (role, "object_footprints"):
            conditions[ORDER.index(channel), y:y+size, x:x+size] = 1
        conditions[ORDER.index("object_instance"), y:y+size, x:x+size] = value / 255
        target[:, y:y+size, x:x+size] = .2 + .2 * torch.arange(size*size).reshape(size, size) / (size*size)
        table.append({"value": value, "kind": kind, "footprint": {
            "x": x*4, "y": y*4, "width": size*4, "height": size*4}})
    return {"sampleId": "synthetic-train", "split": "train", "image": target,
            "conditions": conditions}, table


class FixedCritic(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.scale = torch.nn.Parameter(torch.tensor(1.), requires_grad=False)

    def forward(self, values):
        return values[:, -3:].mean((1, 2, 3), keepdim=True) * self.scale


class ObjectCoreFidelityCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_distinct_inactive_identity_and_fixed_one_coefficient(self):
        self.assertFalse(candidate.EXECUTION_QUALIFIED)
        self.assertNotEqual(candidate.CANDIDATE_ID, inherited.CANDIDATE_ID)
        self.assertEqual(candidate.OBJECT_CORE_RGB_WEIGHT, 1.)

    def test_exact_original_zero(self):
        sample, _ = scene()
        total, parts = candidate.train_original_object_core_rgb(sample["image"][None], sample, ORDER)
        self.assertEqual(float(total), 0.)
        self.assertEqual(float(parts["objectCoreApplicableRoleCount"]), 4)

    def test_exact_role_normalized_three_channel_mean(self):
        sample, _ = scene()
        actual = sample["image"][None].clone()
        biases = {"object_tree": .1, "object_rock": .3, "object_vegetation": .2}
        for role, bias in biases.items():
            mask = sample["conditions"][ORDER.index(role)] > 0
            actual[0, :, mask] += bias
        total, parts = candidate.train_original_object_core_rgb(actual, sample, ORDER)
        footprint = (16*.1 + 4*.3 + 64*.2) / 84
        self.assertAlmostEqual(float(parts["object_footprintsCoreRgbMae"]), footprint, places=6)
        self.assertAlmostEqual(float(total), (footprint + .1 + .3 + .2) / 4, places=6)
        for role, bias in biases.items():
            self.assertAlmostEqual(float(parts[role + "CoreRgbMae"]), bias, places=6)

    def test_background_and_support_ring_errors_do_not_dilute_core(self):
        sample, _ = scene()
        actual = sample["image"][None].clone()
        actual[..., 40:44, 40:44] += .1
        value, _ = candidate.train_original_object_core_rgb(actual, sample, ORDER)
        other = actual.clone()
        outside = sample["conditions"][ORDER.index("object_footprints")] == 0
        other[0, :, outside] = .95
        other_value, _ = candidate.train_original_object_core_rgb(other, sample, ORDER)
        self.assertTrue(torch.equal(value, other_value))

    def test_single_pixel_core_is_not_discarded(self):
        sample, _ = scene()
        conditions = torch.zeros_like(sample["conditions"])
        for role in ("object_footprints", "object_rock"):
            conditions[ORDER.index(role), 1, 1] = 1
        sample = {**sample, "conditions": conditions}
        actual = sample["image"][None].clone()
        actual[..., 1, 1] += .2
        total, parts = candidate.train_original_object_core_rgb(actual, sample, ORDER)
        self.assertAlmostEqual(float(total), .2, places=6)
        self.assertEqual(float(parts["objectCoreApplicableRoleCount"]), 2)
        self.assertNotIn("object_treeCoreRgbMae", parts)
        self.assertNotIn("object_vegetationCoreRgbMae", parts)

    def test_empty_cores_fail_closed(self):
        sample, _ = scene()
        with self.assertRaisesRegex(ValueError, "no applicable"):
            candidate.train_original_object_core_rgb(sample["image"][None],
                {**sample, "conditions": torch.zeros_like(sample["conditions"])}, ORDER)

    def test_core_gradient_nonzero_and_exactly_zero_outside(self):
        sample, _ = scene()
        actual = torch.full((1, 3, 192, 256), .6, requires_grad=True)
        total, _ = candidate.train_original_object_core_rgb(actual, sample, ORDER)
        gradient = torch.autograd.grad(total, actual)[0]
        mask = sample["conditions"][ORDER.index("object_footprints")] > 0
        self.assertGreater(float(gradient[0, :, mask].abs().sum()), 0)
        self.assertEqual(float(gradient[0, :, ~mask].abs().sum()), 0)
        self.assertTrue(bool(torch.isfinite(gradient).all()))

    def test_contrast_compression_is_penalized_directly(self):
        sample, _ = scene()
        compressed = .45 + .1 * sample["image"][None]
        total, _ = candidate.train_original_object_core_rgb(compressed, sample, ORDER)
        self.assertGreater(float(total), .1)

    def test_non_train_fails_before_inherited_objective(self):
        sample, table = scene()
        for split in ("validation", "challenge", "regression", None):
            with self.subTest(split=split), patch.object(candidate, "train_whole_frame_fidelity_candidate_objective") as old:
                with self.assertRaisesRegex(ValueError, "train split"):
                    candidate.train_object_core_fidelity_candidate_objective(FixedCritic(),
                        sample["image"][None], {**sample, "split": split}, table, ORDER)
                old.assert_not_called()

    def test_bad_order_rejected(self):
        sample, _ = scene()
        for order in (ORDER[:22], ORDER[:-1] + (ORDER[0],), "x"*23,
                      tuple("missing" if role == "object_tree" else role for role in ORDER),
                      ORDER[:-1] + ([],)):
            with self.subTest(order=repr(order)), self.assertRaisesRegex(ValueError, "channel order"):
                candidate.train_original_object_core_rgb(sample["image"][None], sample, order)

    def test_fractional_masks_rejected_without_changing_continuous_channels(self):
        sample, _ = scene()
        conditions = sample["conditions"].clone()
        conditions[ORDER.index("coordinate_x")] = .37
        candidate.train_original_object_core_rgb(sample["image"][None], {**sample, "conditions": conditions}, ORDER)
        conditions[ORDER.index("object_tree"), 40, 40] = .9
        with self.assertRaisesRegex(ValueError, "discrete authoritative"):
            candidate.train_original_object_core_rgb(sample["image"][None], {**sample, "conditions": conditions}, ORDER)

    def test_typed_mask_cannot_escape_footprint(self):
        sample, _ = scene()
        conditions = sample["conditions"].clone()
        conditions[ORDER.index("object_footprints"), 40, 40] = 0
        with self.assertRaisesRegex(ValueError, "escapes authoritative"):
            candidate.train_original_object_core_rgb(sample["image"][None], {**sample, "conditions": conditions}, ORDER)

    def test_invalid_shapes_values_and_non_mapping_rejected(self):
        sample, _ = scene()
        with self.assertRaisesRegex(ValueError, "train split"):
            candidate.train_original_object_core_rgb(sample["image"][None], None, ORDER)
        for key, value in (("image", torch.zeros((3, 96, 128))),
                           ("conditions", torch.zeros((22, 192, 256))),
                           ("image", torch.full((3, 192, 256), float("nan"))),
                           ("conditions", torch.full((23, 192, 256), float("inf"))),
                           ("image", torch.full((3, 192, 256), -.1)),
                           ("conditions", torch.full((23, 192, 256), 1.1))):
            with self.subTest(key=key), self.assertRaises(ValueError):
                candidate.train_original_object_core_rgb(sample["image"][None], {**sample, key: value}, ORDER)
        for actual in (torch.zeros((1, 3, 96, 128)), torch.full((1, 3, 192, 256), float("nan")),
                       torch.full((1, 3, 192, 256), 1.1)):
            with self.assertRaises(ValueError):
                candidate.train_original_object_core_rgb(actual, sample, ORDER)

    def test_combination_preserves_entire_inherited_objective_once(self):
        sample, table = scene()
        actual = torch.full((1, 3, 192, 256), .6, requires_grad=True)
        old = actual.sum() * .001
        with patch.object(candidate, "train_whole_frame_fidelity_candidate_objective",
                          return_value=(old, {"originalPart": old, "total": old})) as base:
            total, parts = candidate.train_object_core_fidelity_candidate_objective(
                FixedCritic(), actual, sample, table, ORDER)
        base.assert_called_once()
        self.assertTrue(torch.equal(parts["wholeFrameFidelityUnchangedTotal"], old))
        self.assertTrue(torch.equal(parts["originalPart"], old))
        self.assertTrue(torch.equal(total, old.float() + parts["objectCoreRgbWeighted"]))

    def test_real_inherited_formula_preserved_exactly(self):
        sample, table = scene()
        actual = torch.full((1, 3, 192, 256), .6, requires_grad=True)
        critic = FixedCritic()
        old, old_parts = inherited.train_whole_frame_fidelity_candidate_objective(critic, actual, sample, table, ORDER)
        total, parts = candidate.train_object_core_fidelity_candidate_objective(critic, actual, sample, table, ORDER)
        self.assertTrue(torch.equal(parts["wholeFrameFidelityUnchangedTotal"], old))
        for key, value in old_parts.items():
            if key != "total":
                self.assertTrue(torch.equal(value, parts[key]) if isinstance(value, torch.Tensor) else value == parts[key])
        self.assertTrue(torch.equal(total, old + parts["objectCoreRgbWeighted"]))

    def test_targets_masks_and_table_unchanged_and_not_optimized(self):
        sample, table = scene()
        sample["image"].requires_grad_(True)
        sample["conditions"].requires_grad_(True)
        before = {key: sample[key].detach().clone() for key in ("image", "conditions")}
        table_before = deepcopy(table)
        actual = torch.full((1, 3, 192, 256), .6, requires_grad=True)
        critic = FixedCritic()
        critic_before = {key: value.clone() for key, value in critic.state_dict().items()}
        total, _ = candidate.train_object_core_fidelity_candidate_objective(critic, actual, sample, table, ORDER)
        total.backward()
        self.assertTrue(bool(torch.isfinite(actual.grad).all()))
        self.assertIsNone(sample["image"].grad)
        self.assertIsNone(sample["conditions"].grad)
        self.assertEqual(table, table_before)
        for key in before:
            self.assertTrue(torch.equal(before[key], sample[key]))
        self.assertTrue(all(value.grad is None for value in critic.parameters()))
        self.assertTrue(all(torch.equal(value, critic_before[key]) for key, value in critic.state_dict().items()))

    def test_trainable_critic_still_rejected(self):
        sample, table = scene()
        with self.assertRaisesRegex(ValueError, "frozen critic"):
            candidate.train_object_core_fidelity_candidate_objective(FixedCritic().requires_grad_(True),
                sample["image"][None], sample, table, ORDER)

    def test_core_term_reaches_each_fresh_v21_object_head_without_updates(self):
        from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import build_fresh_native_rgb_object_residual_v21_cpu
        sample, table = scene()
        with patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("GPU prohibited")), \
             patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("optimizer prohibited")), \
             patch.object(torch, "save", side_effect=AssertionError("checkpoint write prohibited")):
            model = build_fresh_native_rgb_object_residual_v21_cpu(condition_channel_order=ORDER)
            state = {key: value.clone() for key, value in model.state_dict().items()}
            predicted = model(sample["conditions"][None], table)
            core, _ = candidate.train_original_object_core_rgb(predicted, sample, ORDER)
            named = [(name, value) for name, value in model.named_parameters() if value.requires_grad]
            gradients = torch.autograd.grad(core, [value for _, value in named], allow_unused=True)
            reached = set()
            for (name, _), gradient in zip(named, gradients):
                if gradient is None:
                    continue
                self.assertTrue(bool(torch.isfinite(gradient).all()), name)
                if bool(gradient.abs().sum() > 0):
                    for role in candidate.OBJECT_CHANNELS:
                        if "object_rgb_heads." + role + "." in name:
                            reached.add(role)
            self.assertEqual(reached, set(candidate.OBJECT_CHANNELS))
            self.assertTrue(all(torch.equal(value, state[key]) for key, value in model.state_dict().items()))
            self.assertTrue(all(value.grad is None for value in model.parameters()))
            self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

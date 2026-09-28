"""Four-role coverage and frozen go/no-go controls for the V20 trial."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
from ai_painter.complete_world.native_rgb_four_role_lowpass_v20_cpu import (
    ROLES, WEIGHT, four_role_lowpass_rgb_loss,
)
from check_stage4_mvp_v20_four_role_lowpass_cpu import decide_gate


class FourRoleLowpassTests(unittest.TestCase):
    def setUp(self):
        import torch
        self.order = ["other_" + str(index) for index in range(19)] + list(ROLES)
        conditions = torch.zeros(23, 192, 256)
        for index, role in enumerate(ROLES):
            conditions[self.order.index(role), 50, 50 + index] = 1
        self.sample = {"split": "train", "image": torch.full((3, 192, 256), .5),
                       "conditions": conditions}

    def test_all_four_roles_are_directly_measured(self):
        import torch
        exact, components, counts = four_role_lowpass_rgb_loss(
            self.sample["image"][None], self.sample, self.order)
        self.assertEqual(float(exact), 0)
        self.assertEqual(set(components), set(ROLES))
        self.assertEqual(counts, {role: 1 for role in ROLES})
        changed = self.sample["image"].clone()[None]
        changed[:, 0, 50, 50] += .1
        loss, components, _ = four_role_lowpass_rgb_loss(changed, self.sample, self.order)
        self.assertGreater(float(loss), 0)
        self.assertGreater(float(components["object_footprints"]), 0)
        self.assertEqual(WEIGHT, .5)

    def test_train_only_and_missing_footprints_fail_closed(self):
        rgb = self.sample["image"][None]
        self.sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "train original RGB"):
            four_role_lowpass_rgb_loss(rgb, self.sample, self.order)
        self.sample["split"] = "train"
        self.sample["conditions"][self.order.index("object_footprints")] = 0
        with self.assertRaisesRegex(ValueError, "object_footprints"):
            four_role_lowpass_rgb_loss(rgb, self.sample, self.order)

    def test_gate_requires_all_roles_strength_direction_and_descent(self):
        comparison = {"weightedNewToV18NormRatio": .2, "cosine": .5}
        good = {"rolePixelCounts": {role: 1 for role in ROLES},
                "roleLosses": {role: .01 for role in ROLES},
                "directRoleFeatureGradientAbsSum": {role: .01 for role in ROLES},
                "gradientComparisons": {key: comparison for key in
                    ("appearanceLastConv", "aggregateObjectFeatures", *ROLES)},
                "virtualCombinedFeatureStep": {"actualCombinedChange": -.001,
                                               "actualNewTermChange": -.0001}}
        self.assertEqual(decide_gate([good, good]),
                         "go_cpu_signal_only_total_control_review_required")
        self.assertTrue(decide_gate([good]).startswith("no_go"))
        absent = {**good, "rolePixelCounts": {role: 1 for role in ROLES if role != "object_footprints"}}
        self.assertTrue(decide_gate([good, absent]).startswith("no_go_role"))
        weak = {**good, "gradientComparisons": {**good["gradientComparisons"],
                "aggregateObjectFeatures": {"weightedNewToV18NormRatio": .01, "cosine": .5}}}
        self.assertTrue(decide_gate([good, weak]).startswith("no_go_new_gradient"))
        opposed = {**good, "gradientComparisons": {**good["gradientComparisons"],
                "appearanceLastConv": {"weightedNewToV18NormRatio": .2, "cosine": -.1}}}
        self.assertTrue(decide_gate([good, opposed]).startswith("no_go_new_gradient"))


if __name__ == "__main__":
    unittest.main()

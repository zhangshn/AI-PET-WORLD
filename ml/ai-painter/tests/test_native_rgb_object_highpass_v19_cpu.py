"""Train-only guards and a chroma failure case for the single V19 trial term."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
from ai_painter.complete_world.native_rgb_object_highpass_v19_cpu import (
    instance_rgb_highpass_loss,
)
from check_stage4_mvp_v19_object_highpass_cpu import decide_gate


class ObjectHighpassTrialTests(unittest.TestCase):
    def setUp(self):
        import torch
        self.order = ["other_" + str(index) for index in range(21)] + ["object_instance", "object_tree"]
        conditions = torch.zeros(23, 192, 256)
        conditions[self.order.index("object_instance"), 50, 50] = 1 / 255
        conditions[self.order.index("object_tree"), 50, 50] = 1
        image = torch.full((3, 192, 256), .5)
        self.sample = {"split": "train", "image": image, "conditions": conditions,
                       "objectInstanceTable": [{"value": 1, "kind": "tree"}]}

    def test_exact_rgb_zero_and_equal_luma_chroma_edge_detected(self):
        exact, _ = instance_rgb_highpass_loss(self.sample["image"][None], self.sample, self.order)
        self.assertEqual(float(exact), 0)
        predicted = self.sample["image"].clone()[None].requires_grad_(True)
        changed = predicted.clone()
        changed[0, 0, 50, 50] += .1
        changed[0, 1, 50, 50] -= .1 * .2126 / .7152
        loss, support = instance_rgb_highpass_loss(changed, self.sample, self.order)
        self.assertGreater(float(loss.detach()), .01)
        self.assertEqual(support["instanceCount"], 1)
        self.assertEqual(support["rolePixels"]["object_tree"], 1)
        self.assertGreater(float(loss.detach()), 0)

    def test_non_train_or_foreign_instance_rejected(self):
        rgb = self.sample["image"][None]
        self.sample["split"] = "validation"
        with self.assertRaisesRegex(ValueError, "train original RGB"):
            instance_rgb_highpass_loss(rgb, self.sample, self.order)
        self.sample["split"] = "train"
        self.sample["objectInstanceTable"][0]["value"] = 2
        with self.assertRaisesRegex(ValueError, "authoritative labels differ"):
            instance_rgb_highpass_loss(rgb, self.sample, self.order)

    def test_gate_requires_all_fixed_train_signals(self):
        good = {"highpassLoss": .01, "appearanceGradientAbsSum": .1,
                "objectFeatureGradientAbsSum": {key: .1 for key in (
                    "object_footprints", "object_tree", "object_rock", "object_vegetation")},
                "bestVirtualDescent": .001}
        self.assertEqual(decide_gate([good, good]), "go_cpu_signal_only_not_gpu_qualified")
        self.assertTrue(decide_gate([good]).startswith("no_go"))
        weak = {**good, "bestVirtualDescent": 0}
        self.assertTrue(decide_gate([good, weak]).startswith("no_go"))


if __name__ == "__main__":
    unittest.main()

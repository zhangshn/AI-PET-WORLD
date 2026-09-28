"""Metric and panel controls for the frozen train-only fit fork."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
from diagnose_stage4_mvp_v18_train_fit_fork_cpu import (
    EPOCHS, ROLES, region_metrics, side_by_side,
)


class TrainFitForkTests(unittest.TestCase):
    def setUp(self):
        import torch
        self.order = ["other_" + str(index) for index in range(19)] + list(ROLES)
        self.conditions = torch.zeros(23, 192, 256)
        for index, role in enumerate(ROLES):
            self.conditions[self.order.index(role), 60 + index, 60] = 1
        self.target = torch.full((1, 3, 192, 256), .5)

    def test_exact_rgb_has_zero_role_errors_and_foreign_pixel_does_not_count(self):
        import torch
        exact = region_metrics(self.target, self.target, self.conditions, self.order)
        for role in ROLES:
            self.assertEqual(exact[role]["rgbMae"], 0)
            self.assertEqual(exact[role]["lowpass5RgbMae"], 0)
            self.assertEqual(exact[role]["signedEdgeDifferenceMae"], 0)
        foreign = self.target.clone()
        foreign[:, :, 0, 0] += .1
        result = region_metrics(foreign, self.target, self.conditions, self.order)
        for role in ROLES:
            self.assertEqual(result[role]["rgbMae"], 0)

    def test_train_only_panel_keeps_exact_rgb_pixels_and_labels_outside_images(self):
        import torch
        sample = {"image": torch.zeros(3, 192, 256)}
        outputs = {9: torch.ones(3, 192, 256) * .25,
                   20: torch.ones(3, 192, 256) * .75}
        self.assertEqual(EPOCHS, (9, 20))
        panel = side_by_side(sample, outputs)
        self.assertEqual(panel.size, (768, 244))
        self.assertEqual(panel.getpixel((10, 50)), (0, 0, 0))
        self.assertEqual(panel.getpixel((266, 50)), (64, 64, 64))
        self.assertEqual(panel.getpixel((522, 50)), (191, 191, 191))

    def test_missing_role_fails_closed(self):
        self.conditions[self.order.index("object_footprints")] = 0
        with self.assertRaisesRegex(ValueError, "object_footprints"):
            region_metrics(self.target, self.target, self.conditions, self.order)


if __name__ == "__main__":
    unittest.main()

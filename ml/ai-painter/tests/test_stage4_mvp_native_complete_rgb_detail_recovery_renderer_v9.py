from __future__ import annotations

from pathlib import Path
import sys
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
SRC = ROOT / "ml" / "ai-painter" / "src"
for value in (SRC, SCRIPTS):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.native_rgb_detail_recovery_renderer import (  # noqa: E402
    build_native_complete_rgb_detail_recovery_renderer,
)
from ai_painter_stage4_mvp_native_rgb_detail_recovery_renderer_v9 import (  # noqa: E402
    detail_recovery_objective,
)


ORDER = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
    "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
    "focal_area", "object_instance", "coordinate_x", "coordinate_y", "signed_distance_path",
    "signed_distance_water", "signed_distance_shoreline", "signed_distance_object_ground",
    "signed_distance_boundary", "moisture_proximity",
)


class NativeRgbDetailRecoveryV9Test(unittest.TestCase):
    def conditions(self):
        value = torch.zeros(1, 23, 64, 64)
        x = torch.linspace(0, 1, 64).view(1, 1, 1, 64).expand(1, 1, 64, 64)
        y = torch.linspace(0, 1, 64).view(1, 1, 64, 1).expand(1, 1, 64, 64)
        value[:, ORDER.index("coordinate_x"):ORDER.index("coordinate_x") + 1] = x
        value[:, ORDER.index("coordinate_y"):ORDER.index("coordinate_y") + 1] = y
        value[:, ORDER.index("terrain_grass")] = 1
        value[:, ORDER.index("object_tree"), 16:32, 16:32] = 1
        return value

    def objective(self):
        return {
            "fullRgbMaeWeight": 0.75, "fullRgbGradientWeight": 0.35,
            "fullRgbLaplacianWeight": 0.15, "responsibilityGradientWeight": 0.5,
            "responsibilityLumaStructureWeight": 0.15,
            "responsibilityRgbMaeWeights": {
                identity: 1.0 for identity in (
                    "terrain_water", "terrain_path_ground", "terrain_shoreline",
                    "object_footprints", "object_tree", "object_rock", "object_vegetation",
                )
            },
            "detailStatistics": {
                "highPassKernel": 5, "localVarianceKernel": 9,
                "textureEnergyWeight": 2.0, "gradientEnergyWeight": 1.5,
                "localVarianceWeight": 1.0,
            },
        }

    def test_deterministic_fourier_detail_basis_and_mask_boundary(self):
        torch.manual_seed(7)
        model = build_native_complete_rgb_detail_recovery_renderer(
            condition_channel_order=ORDER,
        )
        conditions = self.conditions()
        first, evidence = model(conditions, return_evidence=True)
        second = model(conditions)
        self.assertTrue(torch.equal(first, second))
        self.assertEqual(tuple(first.shape), (1, 3, 64, 64))
        self.assertEqual(tuple(evidence["detailBasis"].shape), (1, 20, 64, 64))
        self.assertGreater(float(evidence["detailBasis"].std()), 0.1)
        mask = evidence["responsibilityMasks"]["object_tree"]
        contribution = evidence["responsibilityLogitContributions"]["object_tree"]
        self.assertEqual(float((contribution * (1.0 - mask)).abs().max()), 0.0)

    def test_detail_statistic_loss_rejects_flat_mean_solution(self):
        model = build_native_complete_rgb_detail_recovery_renderer(
            condition_channel_order=ORDER,
        )
        conditions = self.conditions()
        target = torch.zeros(1, 3, 64, 64)
        target[..., ::2, ::2] = 1
        target[..., 1::2, 1::2] = 1
        flat = torch.full_like(target, 0.5)
        exact_total, exact = detail_recovery_objective(
            target, target, conditions, model, self.objective(),
        )
        flat_total, flat_components = detail_recovery_objective(
            flat, target, conditions, model, self.objective(),
        )
        self.assertLess(float(exact_total), float(flat_total))
        self.assertEqual(float(exact["detailTextureEnergyLoss"]), 0.0)
        self.assertGreater(float(flat_components["detailTextureEnergyLoss"]), 0.1)
        self.assertGreater(float(flat_components["detailGradientEnergyLoss"]), 0.1)


if __name__ == "__main__":
    unittest.main()

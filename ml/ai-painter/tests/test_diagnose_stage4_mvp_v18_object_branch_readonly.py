"""Small metric controls for the read-only V18 object-feature counterfactual."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
from diagnose_stage4_mvp_v18_object_branch_readonly import region_metrics


class RegionMetricTests(unittest.TestCase):
    def test_mask_and_ring_measure_only_their_own_pixels(self):
        import torch
        normal = torch.zeros(1, 3, 192, 256)
        zeroed = normal.clone()
        original = normal.clone()
        mask = torch.zeros(192, 256, dtype=torch.bool)
        mask[50, 50] = True
        zeroed[:, :, 50, 50] = 0.3
        zeroed[:, :, 50, 51] = 0.6
        original[:, :, 50, 50] = 0.2
        result = region_metrics(normal, zeroed, original, {"object_tree": mask})["object_tree"]
        self.assertEqual(result["mask"]["pixels"], 1)
        self.assertAlmostEqual(result["mask"]["normalVsZeroObjectRgbMae"], 0.3)
        self.assertAlmostEqual(result["mask"]["normalVsOriginalRgbMae"], 0.2)
        self.assertEqual(result["ring12px"]["pixels"], 624)
        self.assertAlmostEqual(result["ring12px"]["normalVsZeroObjectRgbMae"], 0.6 / 624)

    def test_empty_mask_fails_closed(self):
        import torch
        rgb = torch.zeros(1, 3, 192, 256)
        with self.assertRaisesRegex(ValueError, "fixed train role absent"):
            region_metrics(rgb, rgb, rgb, {"object_tree": torch.zeros(192, 256, dtype=torch.bool)})


if __name__ == "__main__":
    unittest.main()

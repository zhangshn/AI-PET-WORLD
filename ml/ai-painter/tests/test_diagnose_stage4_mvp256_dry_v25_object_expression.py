from pathlib import Path
import sys
import unittest
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp256_dry_v25_object_expression as subject


class EnvelopeTests(unittest.TestCase):
    def test_optimistic_envelope_distinguishes_in_range_and_unreachable_at_fixed_terrain(self):
        terrain = torch.full((1, 3, 192, 256), .2)
        core = torch.ones((1, 1, 192, 256), dtype=torch.bool)
        empty = torch.zeros_like(core)
        in_range = subject.envelope_measurement(terrain, torch.full_like(terrain, .3), [core, empty, empty, empty], core)
        self.assertEqual(in_range["conditionalRgbMaeLowerBound"], 0)
        out = subject.envelope_measurement(terrain, torch.full_like(terrain, .8), [core, empty, empty, empty], core)
        self.assertEqual(out["targetRgbComponentFractionOutsideEnvelope"], 1)
        self.assertGreater(out["conditionalRgbMaeLowerBound"], .39)
        two = subject.envelope_measurement(terrain, torch.full_like(terrain, .8), [core, core, empty, empty], core)
        self.assertLess(two["conditionalRgbMaeLowerBound"], out["conditionalRgbMaeLowerBound"])

    def test_missing_owner_and_invalid_target_fail_closed(self):
        terrain = torch.full((1, 3, 192, 256), .2)
        core = torch.ones((1, 1, 192, 256), dtype=torch.bool)
        empty = torch.zeros_like(core)
        with self.assertRaises(ValueError):
            subject.envelope_measurement(terrain, terrain, [empty] * 4, core)
        with self.assertRaises(ValueError):
            subject.envelope_measurement(terrain, torch.full_like(terrain, float("nan")), [core] * 4, core)


if __name__ == "__main__":
    unittest.main()

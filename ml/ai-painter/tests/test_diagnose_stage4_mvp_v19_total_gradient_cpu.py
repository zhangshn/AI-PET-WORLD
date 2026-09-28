"""Numerical checks for the read-only weighted-gradient comparison."""
from __future__ import annotations

from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
from diagnose_stage4_mvp_v19_total_gradient_cpu import gradient_comparison


class GradientComparisonTests(unittest.TestCase):
    def test_magnitude_and_opposition(self):
        import torch
        result = gradient_comparison(torch.tensor([3., 4.]), torch.tensor([-.3, -.4]))
        self.assertAlmostEqual(result["weightedNewToV18NormRatio"], .1)
        self.assertAlmostEqual(result["cosine"], -1.)

    def test_orthogonality_and_missing_base(self):
        import torch
        result = gradient_comparison(torch.tensor([1., 0.]), torch.tensor([0., 2.]))
        self.assertAlmostEqual(result["cosine"], 0.)
        result = gradient_comparison(torch.zeros(2), torch.ones(2))
        self.assertIsNone(result["weightedNewToV18NormRatio"])
        self.assertIsNone(result["cosine"])


if __name__ == "__main__":
    unittest.main()

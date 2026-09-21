"""Phase algebra and CPU scope negatives; no project data or weights loaded."""
from pathlib import Path
import sys
import unittest
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import diagnose_paired_periodic_layers as diagnostic


class PeriodicLayerTests(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(1)
        self.target = torch.rand((1, 3, 16, 20), generator=torch.Generator().manual_seed(10))
        self.pattern = torch.zeros_like(self.target)
        self.pattern[..., ::4, ::4] = 0.04

    def test_identical_layers_have_zero_error(self):
        d = diagnostic.phase_decomposition(torch, *([self.target]*4))
        self.assertTrue(all(v == 0 for v in d["energies"].values()))

    def test_constant_bias_is_not_periodicity(self):
        self.assertEqual(float(diagnostic.phase_vector(torch, torch.ones_like(self.target)*0.02).abs().max()), 0)

    def test_pattern_is_detected(self):
        v = diagnostic.phase_vector(torch, self.pattern)
        self.assertGreater(float(v.square().mean()), 0)
        self.assertLess(float(v.mean(dim=0).abs().max()), 1e-12)

    def test_cancellation_cross_terms_are_preserved(self):
        d = diagnostic.phase_decomposition(torch, self.target, self.target+self.pattern, self.target, self.target)
        self.assertGreater(d["energies"]["reconstruction"], 0)
        self.assertLess(d["crossTerms"]["reconstruction__generatedDecodeIncrement"], 0)
        self.assertAlmostEqual(d["summedEnergy"], 0, places=12)

    def test_composition_is_not_attributed_to_reconstruction(self):
        d = diagnostic.phase_decomposition(torch, self.target, self.target, self.target, self.target+self.pattern)
        self.assertEqual(d["energies"]["reconstruction"], 0)
        self.assertGreater(d["energies"]["compositionIncrement"], 0)

    def test_random_layers_telescope_without_mutation(self):
        values = [torch.rand(self.target.shape, generator=torch.Generator().manual_seed(i)) for i in range(4)]
        copies = [x.clone() for x in values]
        d = diagnostic.phase_decomposition(torch, *values)
        self.assertLess(d["telescopingMaxError"], 1e-10)
        self.assertAlmostEqual(d["summedEnergy"], d["energies"]["finalResidual"], places=12)
        self.assertTrue(all(torch.equal(a, b) for a, b in zip(values, copies)))

    def test_nonfinite_wrong_channels_batch_or_size_rejected(self):
        for value in (torch.full_like(self.target, float("nan")), torch.zeros(1, 1, 16, 20),
                      torch.zeros(2, 3, 16, 20), torch.zeros(1, 3, 15, 20)):
            with self.assertRaises(ValueError): diagnostic.phase_vector(torch, value)

    def test_layer_shape_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            diagnostic.phase_decomposition(torch, self.target, self.target, self.target, self.target[..., :-1])

    def test_generation_does_not_accept_target_argument(self):
        import inspect
        self.assertNotIn("target", inspect.signature(diagnostic.trial.comparison.paired.pure_noise_rollout).parameters)


if __name__ == "__main__": unittest.main()

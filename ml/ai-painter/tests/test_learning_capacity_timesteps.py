"""CPU regression for the read-only rollout diagnosis grid and oracle reference."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from diagnose_learning_capacity_timesteps import (
    rollout_grid, TEACHER_TIMESTEPS, profile_settings, rgb_diagnostics, decomposition_metrics,
)


class TimestepDiagnosisTests(unittest.TestCase):
    def test_profiles_bind_exact_checkpoint_steps_and_bounded_rollouts(self):
        self.assertEqual(profile_settings("timestep-600")[0], 600)
        self.assertEqual(len(profile_settings("timestep-600")[1]), 4)
        steps, arms = profile_settings("residual-6000")
        self.assertEqual(steps, 6000)
        self.assertEqual(arms, [("pure_noise_50", 50, 0, False), ("target_noised_midpoint_25", 50, 25, True)])
        with self.assertRaises(ValueError):
            profile_settings("unlimited")

    def test_color_bias_does_not_become_periodic_error(self):
        import torch
        target = torch.full((1, 3, 8, 8), 0.25)
        actual = target + torch.tensor([0.125, -0.125, 0.0])[None, :, None, None]
        measured = rgb_diagnostics(torch, actual, target)
        self.assertEqual(measured["meanRgbBias"], [0.125, -0.125, 0.0])
        self.assertEqual(measured["phase4ResidualRmsAfterGlobalBiasRemoval"], 0)

    def test_periodic_residual_is_detected_but_target_texture_is_not(self):
        import torch
        target = torch.rand((1, 3, 8, 8), generator=torch.Generator().manual_seed(8)) * 0.5
        actual = target.clone()
        actual[..., ::2, ::2] += 0.125
        self.assertEqual(rgb_diagnostics(torch, target, target)["phase4ResidualRmsAfterGlobalBiasRemoval"], 0)
        self.assertGreater(rgb_diagnostics(torch, actual, target)["phase4ResidualRmsAfterGlobalBiasRemoval"], 0.04)
        self.assertTrue(torch.equal(actual[..., 1::2, :], target[..., 1::2, :]))

    def test_metrics_reject_invalid_shapes_and_nonfinite_inputs(self):
        import torch
        valid = torch.zeros(1, 3, 8, 8)
        for actual, target in ((valid[:, :1], valid[:, :1]), (valid[..., :7, :], valid[..., :7, :]),
                               (valid + float("nan"), valid), (valid, valid + float("nan"))):
            with self.subTest(shape=actual.shape), self.assertRaises(ValueError):
                rgb_diagnostics(torch, actual, target)

    def test_decomposition_distinguishes_covered_and_untouched_pixels(self):
        import torch
        target = torch.zeros(1, 3, 8, 8)
        base = torch.full_like(target, 0.25)
        mask = torch.zeros(1, 1, 8, 8)
        mask[..., :4, :] = 1
        final = base * (1 - mask)
        measured = decomposition_metrics(torch, final, {"baseDecodedRgb": base, "responsibilityMasks": (mask, mask)}, target)
        self.assertEqual(measured["coverageFraction"], 0.5)
        self.assertEqual(measured["outsideCoverageMaxAbsoluteChange"], 0)
        self.assertEqual(measured["regions"]["covered"]["finalRgbMae"], 0)
        self.assertEqual(measured["regions"]["uncovered"]["finalRgbMae"], 0.25)

    def test_decomposition_empty_regions_are_null_not_perfect_scores(self):
        import torch
        target = torch.zeros(1, 3, 8, 8)
        for fill, empty in ((0, "covered"), (1, "uncovered")):
            mask = torch.full((1, 1, 8, 8), float(fill))
            measured = decomposition_metrics(torch, target, {"baseDecodedRgb": target, "responsibilityMasks": (mask,)}, target)
            self.assertIsNone(measured["regions"][empty]["finalRgbMae"])

    def test_decomposition_rejects_mask_leak_and_bad_masks(self):
        import torch
        base = torch.zeros(1, 3, 8, 8)
        empty = torch.zeros(1, 1, 8, 8)
        with self.assertRaisesRegex(ValueError, "uncovered"):
            decomposition_metrics(torch, base + 0.1, {"baseDecodedRgb": base, "responsibilityMasks": (empty,)}, base)
        for masks in ((), (empty + float("nan"),), (empty - 1,), (empty[:, :, :4],)):
            with self.subTest(count=len(masks)), self.assertRaises(ValueError):
                decomposition_metrics(torch, base, {"baseDecodedRgb": base, "responsibilityMasks": masks}, base)

    def test_grid_includes_clean_endpoint_and_exact_suffix(self):
        import torch
        from ai_painter.complete_world.diffusion import inference_timesteps
        full = inference_timesteps(1000, 50, "cpu")
        self.assertEqual(len(rollout_grid(torch, full)), 50)
        self.assertEqual(rollout_grid(torch, full)[-1], (0, -1))
        self.assertEqual(rollout_grid(torch, full, 25), rollout_grid(torch, full)[25:])

    def test_invalid_grid_and_start_are_rejected(self):
        import torch
        for grid, start in (([9, 3], 0), ([9, 9, 0], 0), ([0, 9, 0], 0), ([9, 0], -1), ([9, 0], 2)):
            with self.subTest(grid=grid, start=start), self.assertRaises(ValueError):
                rollout_grid(torch, grid, start)

    def test_teacher_covers_all_time_deciles_and_original_fixed_tests(self):
        self.assertEqual(set(t // 100 for t in TEACHER_TIMESTEPS), set(range(10)))
        self.assertTrue(set((0, 100, 250, 500, 750, 999)).issubset(TEACHER_TIMESTEPS))

    def test_oracle_velocity_rollout_recovers_target_from_noised_start(self):
        import torch
        from ai_painter.complete_world.diffusion import add_noise, build_schedule, deterministic_velocity_step, inference_timesteps, velocity_target
        alpha = build_schedule(1000, "cpu")["alphaBars"]
        clean = torch.linspace(-1, 1, 96).reshape(1, 3, 8, 4)
        noise = clean.flip(-1)
        grid = inference_timesteps(1000, 50, "cpu")
        for start in (0, 25):
            pairs = rollout_grid(torch, grid, start)
            latent = add_noise(clean, noise, torch.tensor([pairs[0][0]]), alpha)
            for t, previous in pairs:
                velocity = velocity_target(clean, noise, torch.tensor([t]), alpha)
                latent = deterministic_velocity_step(latent, velocity, t, previous, alpha)
            torch.testing.assert_close(latent, clean, atol=1e-5, rtol=1e-5)
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()

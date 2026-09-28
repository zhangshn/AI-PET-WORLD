"""CPU-only counterexamples for the proposed, inactive V12 objective."""

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

import torch
from torch.nn import functional as functional

from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (
    TEXTURE_WEIGHT,
    full_frame_local_texture_objective,
    local_target_texture_moments_loss,
)
from ai_painter.complete_world.native_rgb_object_context_renderer import (
    full_frame_object_context_objective,
)


class LocalTextureObjectiveTests(unittest.TestCase):
    def test_inactive_contract_is_bound_to_the_cpu_objective(self):
        root = Path(__file__).resolve().parents[3]
        contract = json.loads((root / "data/ai-painter/system-governance/"
                               "stage4-mvp-native-rgb-local-texture-v12-contract.json")
                              .read_text(encoding="utf-8"))
        self.assertEqual(contract["status"], "cpu_candidate_not_execution_qualified")
        self.assertEqual(contract["trainingObjective"]["auxiliaryWeight"], TEXTURE_WEIGHT)
        self.assertEqual(contract["trainingObjective"]["scaleFactors"], [1, 2, 4])
        self.assertEqual(contract["trainingObjective"]["localMomentWindow"], 9)
        self.assertFalse(contract["activationGates"]["gpuQualificationNow"])
        self.assertFalse(contract["activationGates"]["trainingNow"])
        program = contract["programBindings"][1]
        self.assertEqual(
            hashlib.sha256((root / program["path"]).read_bytes()).hexdigest(),
            program["sha256"],
        )

    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)
        y, x = torch.meshgrid(torch.arange(192), torch.arange(256), indexing="ij")
        x, y = x.float(), y.float()
        fine = (0.06 * torch.sin(x / 3.7) * torch.cos(y / 5.3)
                + 0.035 * torch.sin((x + y) / 2.2))
        ground = 0.34 + 0.08 * torch.sin(x / 39) + 0.04 * torch.cos(y / 27)
        cls.target = torch.stack((ground + fine * 0.8, ground + fine,
                                  ground * 0.65 + fine * 0.55))[None].clamp(0, 1)
        cls.blur = functional.avg_pool2d(
            functional.avg_pool2d(cls.target, 5, 1, 2), 5, 1, 2,
        )
        cls.conditions = torch.zeros(1, 23, 192, 256)
        cls.model = SimpleNamespace(
            condition_channel_order=tuple(f"channel_{i}" for i in range(23)),
            support_radii={"object_tree": 8, "object_rock": 4,
                           "object_vegetation": 6},
            responsibility_indices={"object_tree": 10, "object_rock": 11,
                                    "object_vegetation": 12},
        )

    @staticmethod
    def gradient_mean(value):
        return ((value[..., 1:] - value[..., :-1]).abs().mean()
                + (value[..., 1:, :] - value[..., :-1, :]).abs().mean()) / 2

    def test_exact_target_has_zero_auxiliary_and_base_loss(self):
        total, parts = full_frame_local_texture_objective(
            self.target, self.target, self.conditions, self.model,
        )
        self.assertEqual(float(total), 0)
        self.assertEqual(float(parts["localTextureMoments"]), 0)

    def test_gradient_matched_white_noise_does_not_count_as_detail(self):
        noise = torch.randn(self.blur.shape, generator=torch.Generator().manual_seed(47))
        lower, upper = 0.0, 0.5
        for _ in range(20):
            midpoint = (lower + upper) / 2
            candidate = (self.blur + midpoint * noise).clamp(0, 1)
            if self.gradient_mean(candidate) < self.gradient_mean(self.target):
                lower = midpoint
            else:
                upper = midpoint
        noisy = (self.blur + upper * noise).clamp(0, 1)
        self.assertAlmostEqual(
            float(self.gradient_mean(noisy) / self.gradient_mean(self.target)),
            1.0, delta=1e-3,
        )
        self.assertGreater(
            float(local_target_texture_moments_loss(noisy, self.target)),
            float(local_target_texture_moments_loss(self.blur, self.target)),
        )

    def test_combination_keeps_v11_alignment_and_finite_gradient(self):
        predicted = self.blur.clone().requires_grad_(True)
        base, _ = full_frame_object_context_objective(
            predicted, self.target, self.conditions, self.model,
        )
        total, parts = full_frame_local_texture_objective(
            predicted, self.target, self.conditions, self.model,
        )
        self.assertTrue(torch.allclose(
            total, base + TEXTURE_WEIGHT * parts["localTextureMoments"],
        ))
        gradient = torch.autograd.grad(total, predicted)[0]
        self.assertTrue(torch.isfinite(gradient).all())
        self.assertGreater(float(gradient.abs().sum()), 0)

    def test_misaligned_rgb_and_invalid_inputs_fail_closed(self):
        shifted = torch.roll(self.target, 12, dims=-1)
        total, _ = full_frame_local_texture_objective(
            shifted, self.target, self.conditions, self.model,
        )
        self.assertGreater(float(total), 0.01)
        with self.assertRaisesRegex(ValueError, "aligned 256x192"):
            local_target_texture_moments_loss(self.target[..., :-1], self.target)
        with self.assertRaisesRegex(ValueError, "RGB in \\[0,1\\]"):
            local_target_texture_moments_loss(self.target + 1, self.target)


if __name__ == "__main__":
    unittest.main()

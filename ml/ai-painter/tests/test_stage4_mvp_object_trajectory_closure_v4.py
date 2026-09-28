from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "ml" / "ai-painter" / "scripts"
SOURCE_DIR = ROOT / "ml" / "ai-painter" / "src"
for value in (SCRIPT_DIR, SOURCE_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import train_ai_assisted_conditional_denoiser as trainer  # noqa: E402
from ai_painter_stage4_mvp_object_trajectory_closure_v4 import (  # noqa: E402
    CONFIG_BINDING_KEY,
    build_stage4_mvp_object_trajectory_closure_v4_config,
    validate_stage4_mvp_object_trajectory_closure_v4_config,
)
from ai_painter_stage4_mvp_object_trajectory_closure_v4_runtime import (  # noqa: E402
    activated_object_trajectory_closure_v4,
    composite_denoiser_losses_stage4_mvp_object_trajectory_closure_v4,
    object_trajectory_closure_losses,
)


class Stage4MvpObjectTrajectoryClosureV4Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = build_stage4_mvp_object_trajectory_closure_v4_config(ROOT)

    def test_exact_config_is_valid_and_unbound_mutation_is_rejected(self):
        evidence = validate_stage4_mvp_object_trajectory_closure_v4_config(
            self.config, root=ROOT
        )
        self.assertEqual(
            evidence["status"],
            "stage4_mvp_object_trajectory_closure_v4_config_valid",
        )
        changed = deepcopy(self.config)
        changed["training"][CONFIG_BINDING_KEY]["pyramidScales"] = [1.0, 0.5]
        with self.assertRaisesRegex(ValueError, "binding changed"):
            validate_stage4_mvp_object_trajectory_closure_v4_config(
                changed, root=ROOT
            )

    def test_worst_class_terms_are_exact_unweighted_maxima_and_enter_gradient(self):
        torch.manual_seed(19)
        predicted = torch.rand(1, 3, 32, 32, requires_grad=True)
        target = torch.rand(1, 3, 32, 32)
        conditions = torch.zeros(1, 23, 32, 32)
        order = self.config["conditionChannelOrder"]
        regions = {
            "object_footprints": (slice(0, 16), slice(0, 16)),
            "object_tree": (slice(0, 16), slice(16, 32)),
            "object_rock": (slice(16, 32), slice(0, 16)),
            "object_vegetation": (slice(16, 32), slice(16, 32)),
        }
        for name, (ys, xs) in regions.items():
            conditions[:, order.index(name), ys, xs] = 1.0
        weighted_rgb, weighted_luma, worst_rgb, worst_luma, metrics = (
            object_trajectory_closure_losses(
                predicted, target, conditions, self.config
            )
        )
        rgb_values = [
            metrics[
                f"stage4MvpObjectTrajectoryV4{''.join(part.capitalize() for part in name.split('_'))}FinalVisibleRgbMae"
            ]
            for name in regions
        ]
        luma_values = [
            metrics[
                f"stage4MvpObjectTrajectoryV4{''.join(part.capitalize() for part in name.split('_'))}MultiscaleLuminanceStructureLoss"
            ]
            for name in regions
        ]
        self.assertTrue(torch.equal(worst_rgb, torch.stack(rgb_values).amax()))
        self.assertTrue(torch.equal(worst_luma, torch.stack(luma_values).amax()))
        loss = weighted_rgb + weighted_luma + worst_rgb + worst_luma
        loss.backward()
        self.assertIsNotNone(predicted.grad)
        self.assertGreater(float(predicted.grad.abs().sum()), 0.0)

    def test_runtime_adapter_is_process_scoped_and_restored(self):
        original = trainer.composite_denoiser_losses_stage4_semantic_transport_v2
        with activated_object_trajectory_closure_v4(self.config):
            self.assertIs(
                trainer.composite_denoiser_losses_stage4_semantic_transport_v2,
                composite_denoiser_losses_stage4_mvp_object_trajectory_closure_v4,
            )
        self.assertIs(
            trainer.composite_denoiser_losses_stage4_semantic_transport_v2,
            original,
        )


if __name__ == "__main__":
    unittest.main()

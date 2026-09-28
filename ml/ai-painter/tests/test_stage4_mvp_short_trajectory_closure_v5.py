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
from ai_painter_stage4_mvp_short_trajectory_closure_v5 import (  # noqa: E402
    CONFIG_BINDING_KEY,
    build_stage4_mvp_short_trajectory_closure_v5_config,
    validate_stage4_mvp_short_trajectory_closure_v5_config,
)
from ai_painter_stage4_mvp_short_trajectory_closure_v5_runtime import (  # noqa: E402
    activated_short_trajectory_closure_v5,
    composite_denoiser_losses_stage4_mvp_short_trajectory_closure_v5,
    object_short_trajectory_closure_losses,
)


class Stage4MvpShortTrajectoryClosureV5Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = build_stage4_mvp_short_trajectory_closure_v5_config(ROOT)

    def test_exact_config_is_valid_and_short_trajectory_is_frozen(self):
        evidence = validate_stage4_mvp_short_trajectory_closure_v5_config(
            self.config, root=ROOT
        )
        self.assertEqual(
            evidence["status"],
            "stage4_mvp_short_trajectory_closure_v5_config_valid",
        )
        self.assertEqual(
            self.config["training"]["shortTrajectorySupervision"],
            {
                "enabled": True,
                "steps": 2,
                "stepGap": 20,
                "weight": 0.35,
                "cleanLatentWeight": 1.0,
                "decodedRgbWeight": 0.75,
                "decodedRgbGradientWeight": 0.35,
            },
        )
        changed = deepcopy(self.config)
        changed["training"]["shortTrajectorySupervision"]["steps"] = 3
        with self.assertRaisesRegex(ValueError, "supervision binding changed"):
            validate_stage4_mvp_short_trajectory_closure_v5_config(
                changed, root=ROOT
            )

    def test_v4_object_terms_remain_differentiable(self):
        torch.manual_seed(29)
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
        values = object_short_trajectory_closure_losses(
            predicted, target, conditions, self.config
        )
        loss = sum(values[:4])
        loss.backward()
        self.assertIsNotNone(predicted.grad)
        self.assertGreater(float(predicted.grad.abs().sum()), 0.0)

    def test_runtime_adapter_is_process_scoped_and_restored(self):
        original = trainer.composite_denoiser_losses_stage4_semantic_transport_v2
        with activated_short_trajectory_closure_v5(self.config):
            self.assertIs(
                trainer.composite_denoiser_losses_stage4_semantic_transport_v2,
                composite_denoiser_losses_stage4_mvp_short_trajectory_closure_v5,
            )
        self.assertIs(
            trainer.composite_denoiser_losses_stage4_semantic_transport_v2,
            original,
        )

    def test_contract_binding_is_present(self):
        self.assertIn(CONFIG_BINDING_KEY, self.config["training"])


if __name__ == "__main__":
    unittest.main()

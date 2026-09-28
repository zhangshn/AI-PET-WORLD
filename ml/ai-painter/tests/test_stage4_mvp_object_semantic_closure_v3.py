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
from ai_painter_stage4_mvp_object_semantic_closure_v3 import (  # noqa: E402
    CONFIG_BINDING_KEY,
    build_stage4_mvp_object_semantic_closure_v3_config,
    validate_stage4_mvp_object_semantic_closure_v3_config,
)
from ai_painter_stage4_mvp_object_semantic_closure_v3_runtime import (  # noqa: E402
    activated_object_semantic_closure_v3,
    composite_denoiser_losses_stage4_mvp_object_semantic_closure_v3,
    object_semantic_closure_losses,
)


class Stage4MvpObjectSemanticClosureV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = build_stage4_mvp_object_semantic_closure_v3_config(ROOT)

    def test_exact_config_is_valid_and_unbound_mutation_is_rejected(self):
        evidence = validate_stage4_mvp_object_semantic_closure_v3_config(
            self.config, root=ROOT
        )
        self.assertEqual(
            evidence["status"],
            "stage4_mvp_object_semantic_closure_v3_config_valid",
        )
        changed = deepcopy(self.config)
        changed["training"][CONFIG_BINDING_KEY]["objectWeights"]["object_tree"] += 0.01
        with self.assertRaisesRegex(ValueError, "binding changed"):
            validate_stage4_mvp_object_semantic_closure_v3_config(changed, root=ROOT)

    def test_object_rgb_and_multiscale_structure_enter_gradient(self):
        torch.manual_seed(11)
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
        final_rgb, luminance, metrics = object_semantic_closure_losses(
            predicted, target, conditions, self.config
        )
        loss = final_rgb + luminance
        loss.backward()
        self.assertTrue(torch.isfinite(loss).item())
        self.assertIsNotNone(predicted.grad)
        self.assertTrue(torch.isfinite(predicted.grad).all().item())
        self.assertGreater(float(predicted.grad.abs().sum()), 0.0)
        self.assertIn("stage4MvpObjectClosureV3ObjectTreeFinalVisibleRgbMae", metrics)
        self.assertIn(
            "stage4MvpObjectClosureV3ObjectVegetationMultiscaleLuminanceStructureLoss",
            metrics,
        )

    def test_runtime_adapter_is_process_scoped_and_restored(self):
        original = trainer.composite_denoiser_losses_stage4_semantic_transport_v2
        with activated_object_semantic_closure_v3(self.config):
            self.assertIs(
                trainer.composite_denoiser_losses_stage4_semantic_transport_v2,
                composite_denoiser_losses_stage4_mvp_object_semantic_closure_v3,
            )
        self.assertIs(
            trainer.composite_denoiser_losses_stage4_semantic_transport_v2,
            original,
        )


if __name__ == "__main__":
    unittest.main()

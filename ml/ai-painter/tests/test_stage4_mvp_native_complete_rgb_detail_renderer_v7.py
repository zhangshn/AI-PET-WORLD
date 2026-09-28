from __future__ import annotations

import sys
from pathlib import Path
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world.native_rgb_detail_renderer import (  # noqa: E402
    DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES,
    RESPONSIBILITY_IDENTITIES,
    build_native_complete_rgb_detail_renderer,
)


ORDER = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
    "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
    "focal_area", "object_instance", "coordinate_x", "coordinate_y",
    "signed_distance_path", "signed_distance_water", "signed_distance_shoreline",
    "signed_distance_object_ground", "signed_distance_boundary", "moisture_proximity",
)


class NativeCompleteRgbDetailRendererV7Test(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(20260924)
        self.model = build_native_complete_rgb_detail_renderer(
            condition_channel_order=ORDER, base_channels=16,
        )

    def test_complete_rgb_shape_and_range(self):
        output = self.model(torch.rand(2, 23, 48, 64))
        self.assertEqual(tuple(output.shape), (2, 3, 48, 64))
        self.assertGreaterEqual(float(output.min()), 0.0)
        self.assertLessEqual(float(output.max()), 1.0)

    def test_multiscale_decoder_includes_half_resolution_stage(self):
        names = set(dict(self.model.named_modules()))
        self.assertIn("decode_3", names)
        self.assertIn("decode_2", names)
        self.assertIn("decode_1", names)
        self.assertIn("full_resolution_detail", names)

    def test_responsibility_namespaces_and_local_shape_encoders_are_isolated(self):
        parameter_names = [name for name, _ in self.model.named_parameters()]
        for identity in RESPONSIBILITY_IDENTITIES:
            prefix = f"responsibility_heads.{identity}."
            owned = [name for name in parameter_names if name.startswith(prefix)]
            self.assertTrue(owned)
            self.assertTrue(any("local_shape" in name for name in owned))
            self.assertFalse(any(
                name.startswith(f"responsibility_heads.{other}.")
                for name in owned for other in RESPONSIBILITY_IDENTITIES if other != identity
            ))

    def test_zero_masks_have_zero_responsibility_contribution(self):
        conditions = torch.rand(1, 23, 48, 64)
        for identity in RESPONSIBILITY_IDENTITIES:
            conditions[:, ORDER.index(identity)] = 0
        _, evidence = self.model(conditions, return_evidence=True)
        for value in evidence["responsibilityLogitContributions"].values():
            self.assertEqual(float(value.abs().max()), 0.0)

    def test_each_responsibility_head_receives_gradient(self):
        conditions = torch.rand(1, 23, 32, 48)
        _, evidence = self.model(conditions, return_evidence=True)
        for identity in RESPONSIBILITY_IDENTITIES:
            parameters = tuple(self.model.responsibility_heads[identity].parameters())
            gradients = torch.autograd.grad(
                evidence["responsibilityLogitContributions"][identity].sum(),
                parameters, retain_graph=True,
            )
            self.assertTrue(all(bool(torch.isfinite(value).all()) for value in gradients))
            self.assertGreater(sum(float(value.abs().sum()) for value in gradients), 0.0)

    def test_base_excludes_direct_and_derived_responsibility_channels(self):
        excluded = set(RESPONSIBILITY_IDENTITIES) | set(DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES)
        actual = {ORDER[index] for index in self.model.base_condition_indices}
        self.assertFalse(actual & excluded)


if __name__ == "__main__":
    unittest.main()

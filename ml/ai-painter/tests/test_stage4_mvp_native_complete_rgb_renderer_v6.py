from __future__ import annotations

import sys
from pathlib import Path
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world.native_rgb_renderer import (  # noqa: E402
    DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES,
    RESPONSIBILITY_IDENTITIES,
    build_native_complete_rgb_renderer,
)


ORDER = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
    "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
    "focal_area", "object_instance", "coordinate_x", "coordinate_y",
    "signed_distance_path", "signed_distance_water", "signed_distance_shoreline",
    "signed_distance_object_ground", "signed_distance_boundary", "moisture_proximity",
)


class NativeCompleteRgbRendererV6Test(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(20260924)
        self.model = build_native_complete_rgb_renderer(
            condition_channel_order=ORDER, base_channels=16
        )

    def test_complete_rgb_shape_and_range(self):
        conditions = torch.rand(2, 23, 48, 64)
        rgb, evidence = self.model(conditions, return_evidence=True)
        self.assertEqual(tuple(rgb.shape), (2, 3, 48, 64))
        self.assertTrue(torch.isfinite(rgb).all())
        self.assertGreaterEqual(float(rgb.detach().min()), 0.0)
        self.assertLessEqual(float(rgb.detach().max()), 1.0)
        self.assertEqual(set(evidence["responsibilityMasks"]), set(RESPONSIBILITY_IDENTITIES))

    def test_responsibility_parameters_are_isolated(self):
        namespaces = {
            identity: {id(parameter) for parameter in self.model.responsibility_heads[identity].parameters()}
            for identity in RESPONSIBILITY_IDENTITIES
        }
        for index, left in enumerate(RESPONSIBILITY_IDENTITIES):
            for right in RESPONSIBILITY_IDENTITIES[index + 1:]:
                self.assertFalse(namespaces[left].intersection(namespaces[right]))

    def test_base_cannot_read_direct_or_derived_responsibility_channels(self):
        excluded = set(RESPONSIBILITY_IDENTITIES) | set(DERIVED_RESPONSIBILITY_CONTEXT_IDENTITIES)
        included = {ORDER[index] for index in self.model.base_condition_indices}
        self.assertFalse(excluded.intersection(included))
        self.assertEqual(included | excluded, set(ORDER))

    def test_zero_masks_have_exactly_zero_responsibility_contribution(self):
        conditions = torch.rand(1, 23, 32, 40)
        for identity in RESPONSIBILITY_IDENTITIES:
            conditions[:, ORDER.index(identity)] = 0
        _, evidence = self.model(conditions, return_evidence=True)
        for identity in RESPONSIBILITY_IDENTITIES:
            contribution = evidence["responsibilityLogitContributions"][identity]
            self.assertEqual(float(contribution.detach().abs().max()), 0.0)

    def test_one_mask_change_cannot_enter_other_responsibility_heads(self):
        conditions = torch.zeros(1, 23, 32, 40)
        conditions[:, ORDER.index("coordinate_x")] = torch.linspace(0, 1, 40)[None, None, :]
        before_rgb, before = self.model(conditions, return_evidence=True)
        conditions[:, ORDER.index("object_tree"), 8:16, 10:20] = 1
        after_rgb, after = self.model(conditions, return_evidence=True)
        self.assertFalse(torch.equal(before_rgb, after_rgb))
        self.assertGreater(
            float(after["responsibilityLogitContributions"]["object_tree"].detach().abs().sum()), 0.0
        )
        for identity in RESPONSIBILITY_IDENTITIES:
            if identity != "object_tree":
                self.assertTrue(torch.equal(
                    before["responsibilityLogitContributions"][identity],
                    after["responsibilityLogitContributions"][identity],
                ))

    def test_each_responsibility_head_has_own_gradient(self):
        conditions = torch.rand(1, 23, 32, 40)
        for identity in RESPONSIBILITY_IDENTITIES:
            conditions[:, ORDER.index(identity)] = 0
            conditions[:, ORDER.index(identity), 4:20, 6:28] = 1
        _, evidence = self.model(conditions, return_evidence=True)
        for identity in RESPONSIBILITY_IDENTITIES:
            contribution = evidence["responsibilityLogitContributions"][identity]
            parameters = tuple(self.model.responsibility_heads[identity].parameters())
            gradients = torch.autograd.grad(
                contribution.sum(), parameters, retain_graph=True, allow_unused=False
            )
            self.assertTrue(all(torch.isfinite(gradient).all() for gradient in gradients))
            self.assertTrue(any(float(gradient.abs().sum()) > 0 for gradient in gradients))


if __name__ == "__main__":
    unittest.main()

"""CPU checks for visual support beyond immutable object footprints."""

import unittest

import torch
from torch.nn import functional as functional

from ai_painter.complete_world.native_rgb_object_context_renderer import (
    OBJECT_SUPPORT_RADII_256,
    build_native_rgb_object_context_renderer,
    full_frame_object_context_objective,
)


ORDER = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass",
    "walkable", "collision", "object_footprints", "object_tree",
    "object_rock", "object_vegetation", "focal_area", "object_instance",
    "coordinate_x", "coordinate_y", "signed_distance_path",
    "signed_distance_water", "signed_distance_shoreline",
    "signed_distance_object_ground", "signed_distance_boundary",
    "moisture_proximity",
)


def conditions():
    value = torch.zeros(1, 23, 64, 64)
    value[:, ORDER.index("coordinate_x")] = torch.linspace(0, 1, 64)[None, None, :]
    value[:, ORDER.index("coordinate_y")] = torch.linspace(0, 1, 64)[None, :, None]
    value[:, ORDER.index("terrain_grass")] = 1
    return value


class ObjectContextCpuPrototypeTests(unittest.TestCase):
    def test_overlapping_object_contexts_are_averaged(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER).eval()
        source = conditions()
        for identity in OBJECT_SUPPORT_RADII_256:
            source[:, ORDER.index(identity), 32, 32] = 1
        with torch.no_grad():
            _, evidence = model(source, return_evidence=True)
            _, core = model.core(source, return_evidence=True)
        base = core["finalLogits"] - sum(
            core["responsibilityLogitContributions"][identity]
            for identity in OBJECT_SUPPORT_RADII_256
        )
        actual = evidence["finalLogits"] - base
        expected = sum(evidence["contextLogitContributions"].values()) / 3
        self.assertTrue(torch.allclose(actual[:, :, 32, 32], expected[:, :, 32, 32], atol=1e-6))

    def test_one_tree_does_not_change_distant_tree_context(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER).eval()
        source = conditions()
        tree_index = ORDER.index("object_tree")
        source[:, tree_index, 16, 16] = 1
        source[:, tree_index, 48, 48] = 1
        with torch.no_grad():
            both = model(source)
            one_tree = source.clone()
            one_tree[:, tree_index, 16, 16] = 0
            remaining = model(one_tree)
        self.assertLessEqual(
            float((both[:, :, 40:57, 40:57] - remaining[:, :, 40:57, 40:57]).abs().max()),
            1e-6,
        )

    def test_full_frame_objective_rejects_old_crop_and_spatially_wrong_noise(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER)
        source = torch.zeros(1, 23, 192, 256)
        source[:, ORDER.index("object_tree"), 96, 128] = 1
        reference = torch.full((1, 3, 192, 256), 0.5)
        good = reference.clone()
        noisy = reference.clone()
        noisy[:, :, 80:112, 112:144:2] += 0.2
        good_loss, _ = full_frame_object_context_objective(good, reference, source, model)
        noise_loss, parts = full_frame_object_context_objective(noisy, reference, source, model)
        self.assertEqual(float(good_loss), 0)
        self.assertGreater(float(noise_loss), 0)
        self.assertGreater(float(parts["objectSupportRgbMae"]["object_tree"]), 0)
        with self.assertRaisesRegex(ValueError, "full frames"):
            full_frame_object_context_objective(
                noisy[:, :, :64, :64], reference[:, :, :64, :64],
                source[:, :, :64, :64], model,
            )

    def test_full_frame_objective_backpropagates_to_object_region(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER)
        source = torch.zeros(1, 23, 192, 256)
        source[:, ORDER.index("object_tree"), 96, 128] = 1
        reference = torch.zeros(1, 3, 192, 256)
        predicted = torch.full_like(reference, 0.5, requires_grad=True)
        loss, _ = full_frame_object_context_objective(predicted, reference, source, model)
        loss.backward()
        self.assertGreater(float(predicted.grad[:, :, 96, 128].abs().sum()), 0)

    def test_tree_can_change_visual_ring_but_not_outside_support(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER).eval()
        source = conditions()
        tree_index = ORDER.index("object_tree")
        source[:, tree_index, 32, 32] = 1
        source[:, ORDER.index("object_footprints"), 32, 32] = 1
        before = source.clone()
        rng = torch.get_rng_state().clone()
        state = {name: value.clone() for name, value in model.state_dict().items()}
        with torch.no_grad():
            tree_rgb, evidence = model(source, return_evidence=True)
            absent = source.clone()
            absent[:, tree_index] = 0
            no_tree_rgb = model(absent)
            no_footprints = source.clone()
            no_footprints[:, ORDER.index("object_footprints")] = 0
            no_footprints_rgb = model(no_footprints)
        support = evidence["visualSupports"]["object_tree"]
        footprint = evidence["authoritativeMasks"]["object_tree"]
        delta = (tree_rgb - no_tree_rgb).abs().mean(dim=1, keepdim=True)
        self.assertEqual(tuple(tree_rgb.shape), (1, 3, 64, 64))
        self.assertGreater(int(support.count_nonzero()), int(footprint.count_nonzero()))
        self.assertGreater(float((delta * (support - footprint)).max()), 0)
        self.assertEqual(float((delta * (1 - support)).max()), 0)
        footprint_delta = (tree_rgb - no_footprints_rgb).abs().mean(dim=1, keepdim=True)
        self.assertEqual(float((footprint_delta * (1 - footprint)).max()), 0)
        self.assertTrue(torch.equal(source, before))
        self.assertTrue(torch.equal(torch.get_rng_state(), rng))
        self.assertTrue(all(torch.equal(value, state[name]) for name, value in model.state_dict().items()))

    def test_empty_objects_have_no_context_contribution(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER).eval()
        with torch.no_grad():
            _, evidence = model(conditions(), return_evidence=True)
        for identity in OBJECT_SUPPORT_RADII_256:
            self.assertEqual(float(evidence["visualSupports"][identity].max()), 0)
            self.assertEqual(float(evidence["contextLogitContributions"][identity].abs().max()), 0)

    def test_tree_proximity_encodes_distance_from_authoritative_footprint(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER).eval()
        source = conditions()
        source[:, ORDER.index("object_tree"), 32, 32] = 1
        with torch.no_grad():
            _, evidence = model(source, return_evidence=True)
        proximity = evidence["visualProximity"]["object_tree"][0, 0, 32]
        self.assertEqual(float(proximity[32]), 1)
        self.assertGreater(float(proximity[33]), float(proximity[40]))
        self.assertGreater(float(proximity[40]), 0)
        self.assertEqual(float(proximity[41]), 0)

    def test_support_contract_rejects_missing_or_excessive_responsibility(self):
        for radii in ({"object_tree": 8}, {**OBJECT_SUPPORT_RADII_256, "object_tree": 32}):
            with self.assertRaises(ValueError):
                build_native_rgb_object_context_renderer(
                    condition_channel_order=ORDER, support_radii=radii,
                )

    def test_crop_border_needs_an_eight_pixel_valid_interior(self):
        model = build_native_rgb_object_context_renderer(condition_channel_order=ORDER)
        margin = model.minimum_crop_valid_margin
        self.assertEqual(margin, 8)
        full_mask = torch.zeros(1, 1, 128, 128)
        full_mask[:, :, 64, 31] = 1  # Outside the crop, but within tree visual support.
        cropped_mask = full_mask[:, :, 32:96, 32:96]
        full_support = functional.max_pool2d(full_mask, 2 * margin + 1, 1, margin)
        full_support = full_support[:, :, 32:96, 32:96]
        cropped_support = functional.max_pool2d(cropped_mask, 2 * margin + 1, 1, margin)
        difference = (full_support - cropped_support).abs()
        self.assertGreater(float(difference.max()), 0)
        self.assertEqual(float(difference[:, :, margin:-margin, margin:-margin].max()), 0)


if __name__ == "__main__":
    unittest.main()

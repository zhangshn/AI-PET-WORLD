from __future__ import annotations

import unittest

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.complete_world.stage4_semantic_transport_v2 import (
    ARCHITECTURE_ID,
    AUTOENCODER_BASE_CHANNELS,
    PREDECESSOR_ARCHITECTURE_ID,
    RESPONSIBILITY_CHANNELS,
    RESPONSIBILITY_GROUPS,
)
from ai_painter.training.torch_runtime import require_torch


CONDITION_ORDER = (
    "terrain_grass",
    "terrain_water",
    "terrain_path_ground",
    "terrain_shoreline",
    "terrain_natural_boundary",
    "terrain_mud_patch",
    "terrain_tall_grass",
    "walkable",
    "collision",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
    "focal_area",
    "object_instance",
    "coordinate_x",
    "coordinate_y",
    "signed_distance_path",
    "signed_distance_water",
    "signed_distance_shoreline",
    "signed_distance_object_ground",
    "signed_distance_boundary",
    "moisture_proximity",
)
DISCRETE = CONDITION_ORDER[:15]
CONTINUOUS = CONDITION_ORDER[15:]


def model_config(architecture: str = ARCHITECTURE_ID) -> dict[str, object]:
    return {
        "baseChannels": AUTOENCODER_BASE_CHANNELS,
        "denoiserBaseChannels": 64,
        "latentChannels": 12,
        "conditionChannels": 23,
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "latentDownsampleFactor": 4,
        "denoiserArchitecture": architecture,
        "conditionChannelOrder": list(CONDITION_ORDER),
        "conditionChannelTypes": {
            "discrete": list(DISCRETE),
            "continuous": list(CONTINUOUS),
        },
        "diffusionSteps": 1000,
    }


class Stage4SemanticTransportV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()

    def build(self, architecture: str = ARCHITECTURE_ID):
        self.torch.manual_seed(20263722)
        return build_complete_world_system(model_config(architecture))

    def test_versioned_successor_does_not_relabel_predecessor(self):
        successor = self.build()
        predecessor = self.build(PREDECESSOR_ARCHITECTURE_ID)
        self.assertEqual(successor.denoiser.architecture_id, ARCHITECTURE_ID)
        self.assertEqual(
            successor.denoiser.predecessor_architecture_id,
            PREDECESSOR_ARCHITECTURE_ID,
        )
        self.assertFalse(hasattr(predecessor.denoiser, "architecture_id"))
        self.assertFalse(hasattr(predecessor.denoiser, "responsibility_paths"))
        latent = self.torch.zeros(1, 12, 4, 4)
        conditions = self.torch.zeros(1, 23, 16, 16)
        with self.assertRaisesRegex(ValueError, "only available"):
            predecessor.decode_stage4_semantic_responsibility_rgb(latent, conditions)

    def test_typed_resize_uses_nearest_and_bilinear_by_declared_type(self):
        torch = self.torch
        model = self.build().eval()
        conditions = torch.zeros(1, 23, 2, 2)
        discrete_index = CONDITION_ORDER.index("object_tree")
        continuous_index = CONDITION_ORDER.index("coordinate_x")
        conditions[:, discrete_index] = torch.tensor([[0.0, 1.0], [1.0, 0.0]])
        conditions[:, continuous_index] = torch.tensor([[0.0, 1.0], [1.0, 0.0]])
        resized = model.denoiser.prepare_typed_conditions(conditions, (3, 3))
        expected_discrete = torch.nn.functional.interpolate(
            conditions[:, discrete_index:discrete_index + 1],
            size=(3, 3),
            mode="nearest",
        )
        expected_continuous = torch.nn.functional.interpolate(
            conditions[:, continuous_index:continuous_index + 1],
            size=(3, 3),
            mode="bilinear",
            align_corners=False,
        )
        self.assertTrue(torch.equal(
            resized[:, discrete_index:discrete_index + 1], expected_discrete
        ))
        self.assertTrue(torch.equal(
            resized[:, continuous_index:continuous_index + 1], expected_continuous
        ))
        self.assertFalse(torch.equal(expected_discrete, expected_continuous))

    def test_one_pixel_discrete_identity_survives_native_first_encoding(self):
        torch = self.torch
        model = self.build().eval()
        conditions = torch.zeros(1, 23, 32, 32)
        tree_index = CONDITION_ORDER.index("object_tree")
        conditions[:, tree_index, 17, 19] = 1.0
        latent = torch.zeros(1, 12, 8, 8)
        timestep = torch.tensor([37])
        with torch.no_grad():
            output, evidence = model.predict_velocity_with_stage4_semantic_responsibility(
                latent, timestep, conditions
            )
        tree_mask = evidence["responsibilityEvidence"]["object_tree"]["preservedMask"]
        self.assertEqual(tuple(output.shape), (1, 12, 8, 8))
        self.assertEqual(float(tree_mask.max()), 1.0)
        self.assertEqual(float(tree_mask.sum()), 1.0)
        self.assertTrue(evidence["nativeConditionEncodingBeforeReduction"])

    def test_responsibility_paths_have_disjoint_parameter_and_transport_identities(self):
        model = self.build()
        paths = model.denoiser.responsibility_paths
        self.assertEqual(tuple(paths.keys()), RESPONSIBILITY_CHANNELS)
        self.assertEqual(
            RESPONSIBILITY_GROUPS["terrain_route_hydrology_spatial_realization"],
            ("terrain_path_ground", "terrain_water", "terrain_shoreline"),
        )
        self.assertEqual(
            RESPONSIBILITY_GROUPS["per_class_object_semantic_realization"],
            ("object_footprints", "object_tree", "object_rock", "object_vegetation"),
        )
        parameter_ids: dict[str, set[int]] = {}
        transport_ids = []
        for identity in RESPONSIBILITY_CHANNELS:
            parameter_ids[identity] = {
                id(parameter) for parameter in paths[identity].parameters()
            }
            transport_ids.append(id(paths[identity].transport_logits.weight))
        self.assertEqual(len(set(transport_ids)), len(RESPONSIBILITY_CHANNELS))
        for index, left in enumerate(RESPONSIBILITY_CHANNELS):
            for right in RESPONSIBILITY_CHANNELS[index + 1:]:
                self.assertFalse(parameter_ids[left] & parameter_ids[right])
        names = tuple(name for name, _ in model.named_parameters())
        for identity in RESPONSIBILITY_CHANNELS:
            prefix = f"denoiser.responsibility_paths.{identity}."
            self.assertTrue(any(name.startswith(prefix) for name in names), identity)

    def test_each_responsibility_transport_is_reached_by_its_formal_output(self):
        torch = self.torch
        model = self.build().eval()
        conditions = torch.zeros(1, 23, 16, 16, requires_grad=True)
        with torch.no_grad():
            for offset, identity in enumerate(RESPONSIBILITY_CHANNELS):
                index = CONDITION_ORDER.index(identity)
                conditions[:, index, offset:offset + 4, offset:offset + 4] = 1.0
        output = model.predict_velocity(
            torch.randn(1, 12, 4, 4), torch.tensor([37]), conditions
        )
        transport_parameters = tuple(
            model.denoiser.responsibility_paths[identity].transport_logits.weight
            for identity in RESPONSIBILITY_CHANNELS
        )
        gradients = torch.autograd.grad(
            output.square().mean(),
            (conditions, *transport_parameters),
            allow_unused=True,
        )
        for identity, gradient in zip(
            ("conditions", *RESPONSIBILITY_CHANNELS), gradients, strict=True
        ):
            self.assertIsNotNone(gradient, identity)
            self.assertTrue(bool(torch.isfinite(gradient).all()), identity)
            self.assertGreater(float(gradient.abs().max().detach()), 0.0, identity)

    def test_final_rgb_layer_is_condition_aware_and_mask_bounded(self):
        torch = self.torch
        model = self.build().eval()
        latent = torch.zeros(1, 12, 4, 4)
        conditions = torch.zeros(1, 23, 16, 16)
        base_rgb = model.autoencoder.decode(latent)
        empty_rgb, empty_evidence = model.decode_stage4_semantic_responsibility_rgb(
            latent, conditions, return_evidence=True
        )
        self.assertTrue(torch.equal(empty_rgb, base_rgb))
        self.assertEqual(
            empty_evidence["responsibilityIdentityOrder"], RESPONSIBILITY_CHANNELS
        )

        tree_index = CONDITION_ORDER.index("object_tree")
        conditions[:, tree_index, 5:9, 6:10] = 1.0
        composed, evidence = model.decode_stage4_semantic_responsibility_rgb(
            latent, conditions, return_evidence=True
        )
        mask = evidence["responsibilityMasks"][RESPONSIBILITY_CHANNELS.index("object_tree")]
        inside = mask.expand_as(composed).bool()
        outside = ~inside
        self.assertGreater(
            float((composed[inside] - base_rgb[inside]).abs().max().detach()), 0.0
        )
        self.assertTrue(torch.equal(composed[outside], base_rgb[outside]))
        self.assertFalse(evidence["maskOutsideMutationAllowed"])

    def test_autoencoder_is_permanently_frozen_across_parent_train_transition(self):
        model = self.build()
        model.train()
        self.assertTrue(model.training)
        self.assertFalse(model.autoencoder.training)
        self.assertTrue(all(
            not parameter.requires_grad for parameter in model.autoencoder.parameters()
        ))
        self.assertTrue(any(
            parameter.requires_grad for parameter in model.denoiser.parameters()
        ))

    def test_successor_rejects_free_or_incomplete_dimensions(self):
        for key, value in (
            ("baseChannels", 8),
            ("conditionChannels", 24),
            ("latentChannels", 4),
            ("denoiserBaseChannels", 128),
            ("latentDownsampleFactor", 8),
        ):
            config = model_config()
            config[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                build_complete_world_system(config)

        wrong_order = model_config()
        wrong_order["conditionChannelOrder"][0], wrong_order["conditionChannelOrder"][1] = (
            wrong_order["conditionChannelOrder"][1], wrong_order["conditionChannelOrder"][0]
        )
        with self.assertRaisesRegex(ValueError, "authoritative 23-channel"):
            build_complete_world_system(wrong_order)

        wrong_types = model_config()
        wrong_types["conditionChannelTypes"]["discrete"][-1], wrong_types["conditionChannelTypes"]["continuous"][0] = (
            wrong_types["conditionChannelTypes"]["continuous"][0],
            wrong_types["conditionChannelTypes"]["discrete"][-1],
        )
        with self.assertRaisesRegex(ValueError, "discrete condition order"):
            build_complete_world_system(wrong_types)

        unknown_channel = model_config()
        unknown_channel["conditionChannelOrder"][-1] = "unknown_condition"
        with self.assertRaisesRegex(ValueError, "authoritative 23-channel"):
            build_complete_world_system(unknown_channel)

        model = self.build().eval()
        with self.assertRaisesRegex(ValueError, "four times"):
            model.predict_velocity(
                self.torch.zeros(1, 12, 8, 8),
                self.torch.tensor([1]),
                self.torch.zeros(1, 23, 16, 16),
            )


if __name__ == "__main__":
    unittest.main()

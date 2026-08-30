from __future__ import annotations

import unittest

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch


ARCHITECTURE = "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
BASELINE_ARCHITECTURE = "multiscale_condition_unet_v7"
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
DISCRETE_CONDITIONS = CONDITION_ORDER[:15]
CONTINUOUS_CONDITIONS = CONDITION_ORDER[15:]
EXPECTED_SPATIAL_AFFINE_PARAMETERS = {
    "denoiser.up_block1.spatial_affine_norm1.weight": (256, 23, 3, 3),
    "denoiser.up_block1.spatial_affine_norm1.bias": (256,),
    "denoiser.up_block1.spatial_affine_norm2.weight": (256, 23, 3, 3),
    "denoiser.up_block1.spatial_affine_norm2.bias": (256,),
    "denoiser.up_block0.spatial_affine_norm1.weight": (128, 23, 3, 3),
    "denoiser.up_block0.spatial_affine_norm1.bias": (128,),
    "denoiser.up_block0.spatial_affine_norm2.weight": (128, 23, 3, 3),
    "denoiser.up_block0.spatial_affine_norm2.bias": (128,),
}


def model_config(architecture: str = ARCHITECTURE) -> dict[str, object]:
    return {
        "baseChannels": 8,
        "denoiserBaseChannels": 64,
        "latentChannels": 12,
        "conditionChannels": 23,
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "latentDownsampleFactor": 4,
        "denoiserArchitecture": architecture,
        "conditionChannelOrder": list(CONDITION_ORDER),
        "conditionChannelTypes": {
            "discrete": list(DISCRETE_CONDITIONS),
            "continuous": list(CONTINUOUS_CONDITIONS),
        },
        "diffusionSteps": 1000,
    }


class Stage4SpatialAffineConditionedDecoderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()

    def test_parameter_contract_is_exact_and_output_shape_is_unchanged(self):
        torch = self.torch
        torch.manual_seed(20263722)
        model = build_complete_world_system(model_config()).eval()

        spatial_parameters = {
            name: parameter
            for name, parameter in model.named_parameters()
            if ".spatial_affine_" in name
        }
        self.assertEqual(
            {name: tuple(parameter.shape) for name, parameter in spatial_parameters.items()},
            EXPECTED_SPATIAL_AFFINE_PARAMETERS,
        )
        self.assertEqual(len(spatial_parameters), 8)
        self.assertEqual(sum(parameter.numel() for parameter in spatial_parameters.values()), 159_744)
        self.assertEqual(
            sum(
                1
                for module in model.modules()
                if isinstance(module, torch.nn.Conv2d)
                and any(module is candidate for candidate in (
                    model.denoiser.up_block1.spatial_affine_norm1,
                    model.denoiser.up_block1.spatial_affine_norm2,
                    model.denoiser.up_block0.spatial_affine_norm1,
                    model.denoiser.up_block0.spatial_affine_norm2,
                ))
            ),
            4,
        )

        noisy_latent = torch.randn(1, 12, 48, 64)
        timestep = torch.tensor([37])
        conditions = torch.randn(1, 23, 192, 256)
        with torch.no_grad():
            predicted_velocity = model.predict_velocity(noisy_latent, timestep, conditions)
        self.assertEqual(tuple(predicted_velocity.shape), (1, 12, 48, 64))

    def test_spatial_affine_formula_and_gradients_are_finite_and_nonzero(self):
        torch = self.torch
        torch.manual_seed(20263722)
        model = build_complete_world_system(model_config()).eval()
        block = model.denoiser.up_block1
        normalized = torch.randn(1, 128, 4, 5)
        resized_conditions = torch.randn(1, 23, 4, 5)
        projection = block.spatial_affine_norm1
        gamma, beta = projection(resized_conditions).chunk(2, dim=1)
        expected = normalized * (1 + gamma) + beta
        actual = block.apply_spatial_affine(normalized, resized_conditions, projection)
        self.assertTrue(torch.equal(actual, expected))

        noisy_latent = torch.randn(1, 12, 8, 8)
        timestep = torch.tensor([11])
        conditions = torch.randn(1, 23, 32, 32, requires_grad=True)
        output = model.predict_velocity(noisy_latent, timestep, conditions)
        spatial_parameters = [
            parameter
            for name, parameter in model.named_parameters()
            if ".spatial_affine_" in name
        ]
        gradients = torch.autograd.grad(
            output.square().mean(),
            [conditions, *spatial_parameters],
        )
        for gradient in gradients:
            self.assertTrue(bool(torch.isfinite(gradient).all()))
            self.assertGreater(float(gradient.abs().max()), 0.0)

    def test_zero_modulation_preserves_the_existing_v7_forward_bytes(self):
        torch = self.torch
        torch.manual_seed(20263722)
        baseline = build_complete_world_system(model_config(BASELINE_ARCHITECTURE)).eval()
        torch.manual_seed(20263722)
        spatial = build_complete_world_system(model_config()).eval()

        baseline_state = baseline.state_dict()
        spatial_state = spatial.state_dict()
        extra_keys = set(spatial_state) - set(baseline_state)
        self.assertEqual(extra_keys, set(EXPECTED_SPATIAL_AFFINE_PARAMETERS))
        self.assertEqual(set(baseline_state) - set(spatial_state), set())
        for name, value in baseline_state.items():
            spatial_state[name] = value.clone()
        for name in extra_keys:
            spatial_state[name] = torch.zeros_like(spatial_state[name])
        spatial.load_state_dict(spatial_state, strict=True)

        noisy_latent = torch.randn(1, 12, 8, 8)
        timestep = torch.tensor([19])
        conditions = torch.randn(1, 23, 32, 32)
        with torch.no_grad():
            baseline_output = baseline.predict_velocity(noisy_latent, timestep, conditions)
            spatial_output = spatial.predict_velocity(noisy_latent, timestep, conditions)
        self.assertTrue(torch.equal(spatial_output, baseline_output))

    def test_new_architecture_rejects_old_modes_and_non_derived_dimensions(self):
        invalid_configs = []
        with_controlled_arm = model_config()
        with_controlled_arm["stage4ControlledStructureArm"] = "baseline_current_formal_structure"
        invalid_configs.append(with_controlled_arm)
        with_responsibility_component = model_config()
        with_responsibility_component["stage4ResponsibilityComponentRole"] = (
            "terrain_route_hydrology_spatial_realization"
        )
        invalid_configs.append(with_responsibility_component)
        wrong_width = model_config()
        wrong_width["denoiserBaseChannels"] = 128
        invalid_configs.append(wrong_width)
        wrong_condition_channels = model_config()
        wrong_condition_channels["conditionChannels"] = 24
        invalid_configs.append(wrong_condition_channels)
        wrong_latent_channels = model_config()
        wrong_latent_channels["latentChannels"] = 8
        invalid_configs.append(wrong_latent_channels)
        wrong_autoencoder = model_config()
        wrong_autoencoder["autoencoderArchitecture"] = "legacy_8x_latent_v1"
        invalid_configs.append(wrong_autoencoder)

        for invalid_config in invalid_configs:
            with self.subTest(invalid_config=invalid_config):
                with self.assertRaises(ValueError):
                    build_complete_world_system(invalid_config)


if __name__ == "__main__":
    unittest.main()

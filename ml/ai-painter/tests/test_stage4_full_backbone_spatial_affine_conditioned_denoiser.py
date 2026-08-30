from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS_ROOT = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter_full_backbone_spatial_affine_contract import (
    CAPABILITY_VERSION,
    CONDITION_RESIZE_CONTRACT,
    compile_full_backbone_spatial_affine_cpu_inactive_config,
    derive_formal_condition_identity,
    validate_full_backbone_spatial_affine_cpu_inactive_config,
)
import train_ai_assisted_conditional_denoiser as trainer_module

validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary = (
    trainer_module.validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary
)


ARCHITECTURE = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
DECODER_ONLY_ARCHITECTURE = "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
BASELINE_ARCHITECTURE = "multiscale_condition_unet_v7"
SEED = 20263722
CONDITION_CHANNELS = 23
LATENT_CHANNELS = 12
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
BLOCK_CHANNELS = (
    ("block0", 64),
    ("block1", 128),
    ("middle1", 256),
    ("middle2", 256),
    ("up_block1", 128),
    ("up_block0", 64),
)
BLOCK_SPATIAL_SIZES = {
    "block0": (8, 8),
    "block1": (4, 4),
    "middle1": (2, 2),
    "middle2": (2, 2),
    "up_block1": (4, 4),
    "up_block0": (8, 8),
}


def expected_spatial_affine_parameters(
    block_channels: tuple[tuple[str, int], ...],
) -> dict[str, tuple[int, ...]]:
    expected: dict[str, tuple[int, ...]] = {}
    for block_name, channels in block_channels:
        for norm_position in ("norm1", "norm2"):
            prefix = f"denoiser.{block_name}.spatial_affine_{norm_position}"
            expected[f"{prefix}.weight"] = (
                channels * 2,
                CONDITION_CHANNELS,
                3,
                3,
            )
            expected[f"{prefix}.bias"] = (channels * 2,)
    return expected


EXPECTED_FULL_BACKBONE_PARAMETERS = expected_spatial_affine_parameters(BLOCK_CHANNELS)
EXPECTED_DECODER_ONLY_PARAMETERS = expected_spatial_affine_parameters(BLOCK_CHANNELS[-2:])
EXPECTED_NET_NEW_PARAMETERS = expected_spatial_affine_parameters(BLOCK_CHANNELS[:4])


def typed_resize(torch, conditions, size):
    functional = torch.nn.functional
    order = list(CONDITION_ORDER)
    discrete_indices = [order.index(value) for value in DISCRETE_CONDITIONS]
    continuous_indices = [order.index(value) for value in CONTINUOUS_CONDITIONS]
    discrete = functional.interpolate(
        conditions[:, discrete_indices],
        size=size,
        mode="nearest",
    )
    continuous = functional.interpolate(
        conditions[:, continuous_indices],
        size=size,
        mode="bilinear",
        align_corners=False,
    )
    grouped_indices = discrete_indices + continuous_indices
    combined = torch.cat((discrete, continuous), dim=1)
    restore_order = [grouped_indices.index(index) for index in range(len(order))]
    return combined[:, restore_order]


def model_config(architecture: str = ARCHITECTURE) -> dict[str, object]:
    return {
        "baseChannels": 8,
        "denoiserBaseChannels": 64,
        "latentChannels": LATENT_CHANNELS,
        "conditionChannels": CONDITION_CHANNELS,
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


def spatial_affine_parameters(model) -> dict[str, object]:
    return {
        name: parameter
        for name, parameter in model.named_parameters()
        if ".spatial_affine_" in name
    }


def state_shapes(model) -> dict[str, tuple[int, ...]]:
    return {
        name: tuple(value.shape)
        for name, value in model.state_dict().items()
    }


class Stage4FullBackboneSpatialAffineConditionedDenoiserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()

    def build(self, architecture: str = ARCHITECTURE):
        self.torch.manual_seed(SEED)
        return build_complete_world_system(model_config(architecture)).eval()

    def assert_full_backbone_parameter_contract(self, model) -> None:
        torch = self.torch
        parameters = spatial_affine_parameters(model)
        self.assertEqual(
            {name: tuple(parameter.shape) for name, parameter in parameters.items()},
            EXPECTED_FULL_BACKBONE_PARAMETERS,
        )
        self.assertEqual(len(parameters), 24)
        self.assertEqual(
            sum(parameter.numel() for parameter in parameters.values()),
            745_472,
        )
        self.assertEqual(len({id(parameter) for parameter in parameters.values()}), 24)

        projections = []
        for block_name, channels in BLOCK_CHANNELS:
            block = getattr(model.denoiser, block_name)
            self.assertIsInstance(block.norm1, torch.nn.GroupNorm)
            self.assertIsInstance(block.norm2, torch.nn.GroupNorm)
            for norm_position in ("norm1", "norm2"):
                projection = getattr(block, f"spatial_affine_{norm_position}")
                self.assertIsInstance(projection, torch.nn.Conv2d)
                self.assertEqual(projection.in_channels, CONDITION_CHANNELS)
                self.assertEqual(projection.out_channels, channels * 2)
                self.assertEqual(projection.kernel_size, (3, 3))
                self.assertEqual(projection.padding, (1, 1))
                self.assertIsNotNone(projection.bias)
                projections.append(projection)
        self.assertEqual(len(projections), 12)
        self.assertEqual(len({id(projection) for projection in projections}), 12)

    def test_exact_six_block_twelve_projection_parameter_contract(self):
        model = self.build()
        decoder_only = self.build(DECODER_ONLY_ARCHITECTURE)
        self.assert_full_backbone_parameter_contract(model)
        self.assertEqual(next(model.parameters()).device.type, "cpu")

        candidate_parameters = dict(model.named_parameters())
        decoder_parameters = dict(decoder_only.named_parameters())
        self.assertEqual(
            set(candidate_parameters) - set(decoder_parameters),
            set(EXPECTED_NET_NEW_PARAMETERS),
        )
        self.assertEqual(set(decoder_parameters) - set(candidate_parameters), set())
        common_names = set(candidate_parameters) & set(decoder_parameters)
        for name in common_names:
            self.assertEqual(
                tuple(candidate_parameters[name].shape),
                tuple(decoder_parameters[name].shape),
                name,
            )
        net_new = {
            name: candidate_parameters[name]
            for name in set(candidate_parameters) - set(decoder_parameters)
        }
        self.assertEqual(len(net_new), 16)
        self.assertEqual(sum(value.numel() for value in net_new.values()), 585_728)
        self.assertEqual(
            sum(value.numel() for value in candidate_parameters.values())
            - sum(value.numel() for value in decoder_parameters.values()),
            585_728,
        )

    def test_all_six_blocks_apply_both_norm_projections_and_preserve_shape(self):
        torch = self.torch
        model = self.build()
        self.assert_full_backbone_parameter_contract(model)

        calls: dict[str, list[tuple[tuple[int, ...], tuple[int, ...]]]] = {
            f"{block_name}.{norm_position}": []
            for block_name, _channels in BLOCK_CHANNELS
            for norm_position in ("norm1", "norm2")
        }
        projection_inputs: dict[str, list[object]] = {
            name: [] for name in calls
        }
        call_order: list[str] = []
        handles = []

        def capture(name):
            def hook(_module, inputs, output):
                call_order.append(name)
                calls[name].append((tuple(inputs[0].shape), tuple(output.shape)))
                projection_inputs[name].append(inputs[0].detach().clone())

            return hook

        for block_name, _channels in BLOCK_CHANNELS:
            block = getattr(model.denoiser, block_name)
            for norm_position in ("norm1", "norm2"):
                projection = getattr(block, f"spatial_affine_{norm_position}")
                handles.append(projection.register_forward_hook(
                    capture(f"{block_name}.{norm_position}")
                ))

        noisy_latent = torch.randn(1, LATENT_CHANNELS, 8, 8)
        timestep = torch.tensor([37])
        conditions = torch.randn(1, CONDITION_CHANNELS, 32, 32)
        try:
            with torch.no_grad():
                predicted_velocity = model.predict_velocity(
                    noisy_latent,
                    timestep,
                    conditions,
                )
        finally:
            for handle in handles:
                handle.remove()

        self.assertEqual(tuple(predicted_velocity.shape), (1, LATENT_CHANNELS, 8, 8))
        expected_order = [
            f"{block_name}.{norm_position}"
            for block_name, _channels in BLOCK_CHANNELS
            for norm_position in ("norm1", "norm2")
        ]
        self.assertEqual(call_order, expected_order)
        for block_name, channels in BLOCK_CHANNELS:
            height, width = BLOCK_SPATIAL_SIZES[block_name]
            expected_conditions = typed_resize(
                torch,
                conditions,
                (height, width),
            )
            for norm_position in ("norm1", "norm2"):
                name = f"{block_name}.{norm_position}"
                self.assertEqual(
                    calls[name],
                    [(
                        (1, CONDITION_CHANNELS, height, width),
                        (1, channels * 2, height, width),
                    )],
                )
                self.assertEqual(len(projection_inputs[name]), 1)
                self.assertTrue(
                    torch.equal(projection_inputs[name][0], expected_conditions),
                    name,
                )

        block = model.denoiser.block0
        block_conditions = typed_resize(torch, conditions, (8, 8))
        normalized = torch.randn(1, 64, 8, 8)
        with torch.no_grad():
            gamma, beta = block.spatial_affine_norm1(block_conditions).chunk(2, dim=1)
            expected_affine = normalized * (1 + gamma) + beta
            actual_affine = block.apply_spatial_affine(
                normalized,
                block_conditions,
                block.spatial_affine_norm1,
            )
        self.assertTrue(torch.equal(actual_affine, expected_affine))

    def test_cpu_autograd_grad_reaches_every_affine_tensor(self):
        torch = self.torch
        model = self.build()
        self.assert_full_backbone_parameter_contract(model)
        parameters = spatial_affine_parameters(model)

        noisy_latent = torch.randn(1, LATENT_CHANNELS, 8, 8)
        timestep = torch.tensor([11])
        conditions = torch.randn(
            1,
            CONDITION_CHANNELS,
            32,
            32,
            requires_grad=True,
        )
        output = model.predict_velocity(noisy_latent, timestep, conditions)
        gradients = torch.autograd.grad(
            output.square().mean(),
            [conditions, *parameters.values()],
            allow_unused=True,
        )

        for name, gradient in zip(
            ("conditions", *parameters.keys()),
            gradients,
            strict=True,
        ):
            self.assertIsNotNone(gradient, f"{name} is not reachable from the output")
            self.assertTrue(bool(torch.isfinite(gradient).all()), name)
            self.assertGreater(float(gradient.abs().max()), 0.0, name)

    def test_fixed_seed_initialization_is_byte_deterministic(self):
        first = self.build()
        second = self.build()
        self.assert_full_backbone_parameter_contract(first)
        self.assert_full_backbone_parameter_contract(second)

        first_state = first.state_dict()
        second_state = second.state_dict()
        self.assertEqual(tuple(first_state), tuple(second_state))
        for name in first_state:
            self.assertTrue(
                self.torch.equal(first_state[name], second_state[name]),
                name,
            )

    def test_existing_baseline_and_decoder_only_contracts_are_unchanged(self):
        torch = self.torch
        baseline = self.build(BASELINE_ARCHITECTURE)
        decoder_only = self.build(DECODER_ONLY_ARCHITECTURE)

        baseline_shapes = state_shapes(baseline)
        decoder_shapes = state_shapes(decoder_only)
        self.assertFalse(any(".spatial_affine_" in name for name in baseline_shapes))
        self.assertEqual(
            {
                name: shape
                for name, shape in decoder_shapes.items()
                if ".spatial_affine_" in name
            },
            EXPECTED_DECODER_ONLY_PARAMETERS,
        )
        self.assertEqual(
            set(decoder_shapes) - set(baseline_shapes),
            set(EXPECTED_DECODER_ONLY_PARAMETERS),
        )
        self.assertEqual(set(baseline_shapes) - set(decoder_shapes), set())
        for name, shape in baseline_shapes.items():
            self.assertEqual(decoder_shapes[name], shape, name)

        baseline_state = baseline.state_dict()
        decoder_state = decoder_only.state_dict()
        for name, value in baseline_state.items():
            decoder_state[name] = value.clone()
        for name in EXPECTED_DECODER_ONLY_PARAMETERS:
            decoder_state[name] = torch.zeros_like(decoder_state[name])
        decoder_only.load_state_dict(decoder_state, strict=True)

        noisy_latent = torch.randn(1, LATENT_CHANNELS, 8, 8)
        timestep = torch.tensor([19])
        conditions = torch.randn(1, CONDITION_CHANNELS, 32, 32)
        with torch.no_grad():
            baseline_output = baseline.predict_velocity(
                noisy_latent,
                timestep,
                conditions,
            )
            decoder_output = decoder_only.predict_velocity(
                noisy_latent,
                timestep,
                conditions,
            )
        self.assertTrue(torch.equal(decoder_output, baseline_output))

    def test_new_architecture_rejects_non_derived_dimensions_and_old_modes(self):
        invalid_configs: list[dict[str, object]] = []

        with_controlled_arm = model_config()
        with_controlled_arm["stage4ControlledStructureArm"] = (
            "baseline_current_formal_structure"
        )
        invalid_configs.append(with_controlled_arm)

        with_responsibility_component = model_config()
        with_responsibility_component["stage4ResponsibilityComponentRole"] = (
            "terrain_route_hydrology_spatial_realization"
        )
        invalid_configs.append(with_responsibility_component)

        for key, value in (
            ("denoiserBaseChannels", 128),
            ("conditionChannels", 24),
            ("latentChannels", 8),
            ("autoencoderArchitecture", "legacy_8x_latent_v1"),
            ("latentDownsampleFactor", 8),
        ):
            candidate = model_config()
            candidate[key] = value
            invalid_configs.append(candidate)

        for invalid_config in invalid_configs:
            with self.subTest(invalid_config=invalid_config):
                with self.assertRaises(ValueError):
                    build_complete_world_system(invalid_config)

        formal_identity = derive_formal_condition_identity()
        inactive = compile_full_backbone_spatial_affine_cpu_inactive_config()
        self.assertEqual(CAPABILITY_VERSION, ARCHITECTURE)
        self.assertEqual(inactive["capabilityVersion"], ARCHITECTURE)
        self.assertEqual(
            inactive["conditionChannelOrder"],
            formal_identity["conditionChannelOrder"],
        )
        self.assertEqual(
            inactive["conditionChannelTypes"],
            formal_identity["conditionChannelTypes"],
        )
        self.assertEqual(
            inactive["conditionResizeContract"],
            CONDITION_RESIZE_CONTRACT,
        )
        source_contract = formal_identity["sourceContractIdentity"]
        self.assertEqual(
            source_contract["schemaVersion"],
            "ai-painter-stage4-formal-diffusion-objective-and-checkpoint-contract-v1",
        )
        self.assertFalse(
            source_contract["historicalRuntimeArtifactIsExecutionSource"]
        )
        self.assertNotIn(
            "conditionSourceArchitectureId",
            inactive["fullBackboneSpatialAffineContract"],
        )

        contract_mutations = []
        reversed_order = deepcopy(inactive)
        reversed_order["conditionChannelOrder"] = list(
            reversed(reversed_order["conditionChannelOrder"])
        )
        contract_mutations.append(reversed_order)
        wrong_types = deepcopy(inactive)
        wrong_types["conditionChannelTypes"]["discrete"].pop()
        contract_mutations.append(wrong_types)
        wrong_resize = deepcopy(inactive)
        wrong_resize["conditionResizeContract"] = "bilinear_all_channels"
        contract_mutations.append(wrong_resize)
        wrong_capability = deepcopy(inactive)
        wrong_capability["capabilityVersion"] = ARCHITECTURE.replace("_", "-")
        contract_mutations.append(wrong_capability)
        for invalid_contract in contract_mutations:
            with self.subTest(invalid_contract=invalid_contract):
                with self.assertRaises(ValueError):
                    validate_full_backbone_spatial_affine_cpu_inactive_config(
                        invalid_contract
                    )

        boundary_config = {"denoiserArchitecture": ARCHITECTURE}
        with self.assertRaises(ValueError):
            validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
                boundary_config,
                preflight_only=False,
            )
        result = validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
            boundary_config,
            preflight_only=True,
        )
        self.assertTrue(result["preflightOnly"])

        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_root = Path(temporary_directory)
            config_path = temporary_root / "config.json"
            package_path = temporary_root / "package.json"
            config_path.write_text(
                json.dumps(boundary_config),
                encoding="utf-8",
            )
            package_path.write_text("{}", encoding="utf-8")
            argv = [
                "train_ai_assisted_conditional_denoiser.py",
                "--config",
                str(config_path),
                "--dataset-package",
                str(package_path),
                "--autoencoder-checkpoint",
                str(temporary_root / "not-read.ckpt"),
                "--output-dir",
                str(temporary_root / "must-not-be-created"),
            ]
            with patch.object(sys, "argv", argv):
                with patch.object(
                    trainer_module,
                    "validate_training_inputs",
                ) as generic_validator:
                    with self.assertRaisesRegex(
                        ValueError,
                        "requires --preflight-only",
                    ):
                        trainer_module.main()
                    generic_validator.assert_not_called()
            self.assertFalse((temporary_root / "must-not-be-created").exists())


if __name__ == "__main__":
    unittest.main()

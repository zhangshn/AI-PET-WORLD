from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
import unittest

SCRIPTS_ROOT = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter_joint_condition_local_transport_contract import (
    ARCHITECTURE_ID,
    READONLY_GPU_OUTPUT_ROOT,
    build_joint_condition_local_transport_readonly_gpu_config_template,
    compile_joint_condition_local_transport_cpu_inactive_config,
    validate_joint_condition_local_transport_readonly_gpu_config,
    validate_joint_condition_local_transport_cpu_inactive_config,
)


BASELINE_ARCHITECTURE = "multiscale_condition_unet_v7"
FULL_BACKBONE_AFFINE_ARCHITECTURE = (
    "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
)
BLOCKS = (
    ("block0", 64),
    ("block1", 128),
    ("middle1", 256),
    ("middle2", 256),
    ("up_block1", 128),
    ("up_block0", 64),
)


def model_config(architecture: str = ARCHITECTURE_ID) -> dict:
    config = compile_joint_condition_local_transport_cpu_inactive_config()
    config["baseChannels"] = 8
    config["denoiserArchitecture"] = architecture
    return config


def local_transport_parameters(model) -> dict[str, object]:
    return {
        name: parameter
        for name, parameter in model.named_parameters()
        if ".local_transport_" in name
    }


class Stage4JointConditionLocalTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.torch = require_torch()

    def build(self, architecture: str = ARCHITECTURE_ID):
        self.torch.manual_seed(20263722)
        return build_complete_world_system(model_config(architecture)).eval()

    def test_exact_parameter_and_namespace_contract(self):
        model = self.build()
        parameters = local_transport_parameters(model)
        self.assertEqual(len(parameters), 24)
        self.assertEqual(
            sum(parameter.numel() for parameter in parameters.values()),
            22_464,
        )
        self.assertEqual(len({id(value) for value in parameters.values()}), 24)
        for block_name, _channels in BLOCKS:
            block = getattr(model.denoiser, block_name)
            self.assertIsNone(block.spatial_affine_norm1)
            self.assertIsNone(block.spatial_affine_norm2)
            for norm_name in ("norm1", "norm2"):
                projection = getattr(block, f"local_transport_{norm_name}")
                self.assertIsInstance(projection, self.torch.nn.Conv2d)
                self.assertEqual(projection.in_channels, 23)
                self.assertEqual(projection.out_channels, 9)
                self.assertEqual(projection.kernel_size, (3, 3))
                self.assertEqual(projection.padding, (1, 1))
                self.assertIsNotNone(projection.bias)

    def test_candidate_replaces_affine_and_preserves_all_common_shapes(self):
        candidate = self.build()
        baseline = self.build(BASELINE_ARCHITECTURE)
        affine = self.build(FULL_BACKBONE_AFFINE_ARCHITECTURE)
        candidate_shapes = {
            name: tuple(value.shape)
            for name, value in candidate.state_dict().items()
        }
        baseline_shapes = {
            name: tuple(value.shape)
            for name, value in baseline.state_dict().items()
        }
        affine_shapes = {
            name: tuple(value.shape)
            for name, value in affine.state_dict().items()
        }
        self.assertEqual(
            set(candidate_shapes) - set(baseline_shapes),
            set(local_transport_parameters(candidate)),
        )
        self.assertTrue(all(
            ".spatial_affine_" in name
            for name in set(affine_shapes) - set(baseline_shapes)
        ))
        self.assertFalse(any(
            ".spatial_affine_" in name for name in candidate_shapes
        ))
        for name, shape in baseline_shapes.items():
            self.assertEqual(candidate_shapes[name], shape, name)

    def test_weights_are_simplex_and_off_canvas_is_strictly_zero(self):
        torch = self.torch
        model = self.build()
        block = model.denoiser.block0
        normalized = torch.randn(1, 64, 5, 6)
        conditions = torch.randn(1, 23, 5, 6)
        with torch.no_grad():
            weights = block.joint_condition_local_transport_weights(
                normalized,
                conditions,
                block.local_transport_norm1,
            )
        self.assertTrue(torch.all(weights >= 0))
        self.assertTrue(torch.allclose(
            weights.sum(dim=1),
            torch.ones_like(weights[:, 0]),
            atol=1e-6,
            rtol=0,
        ))
        self.assertEqual(float(weights[0, 0, 0, 0]), 0.0)
        self.assertEqual(float(weights[0, 1, 0, 0]), 0.0)
        self.assertEqual(float(weights[0, 3, 0, 0]), 0.0)
        self.assertGreater(float(weights[0, 4, 0, 0]), 0.0)

    def test_constant_world_feature_remains_constant_at_canvas_boundary(self):
        torch = self.torch
        model = self.build()
        block = model.denoiser.block0
        normalized = torch.full((1, 64, 5, 6), 3.25)
        conditions = torch.randn(1, 23, 5, 6)
        with torch.no_grad():
            transported = block.apply_joint_condition_local_transport(
                normalized,
                conditions,
                block.local_transport_norm1,
            )
        self.assertTrue(torch.allclose(
            transported,
            normalized,
            atol=1e-6,
            rtol=0,
        ))

    def test_condition_changes_weights_and_neighbor_impulse_changes_output(self):
        torch = self.torch
        model = self.build()
        block = model.denoiser.block0
        normalized = torch.zeros(1, 64, 5, 5)
        normalized[:, :, 1, 1] = 1
        first_conditions = torch.zeros(1, 23, 5, 5)
        second_conditions = first_conditions.clone()
        second_conditions[:, 0, 2, 2] = 1
        with torch.no_grad():
            first_weights = block.joint_condition_local_transport_weights(
                normalized,
                first_conditions,
                block.local_transport_norm1,
            )
            second_weights = block.joint_condition_local_transport_weights(
                normalized,
                second_conditions,
                block.local_transport_norm1,
            )
            first_output = block.apply_joint_condition_local_transport(
                normalized,
                first_conditions,
                block.local_transport_norm1,
            )
        self.assertGreater(
            float((first_weights - second_weights).abs().max()),
            0.0,
        )
        self.assertGreater(float(first_output[:, :, 2, 2].abs().max()), 0.0)
        self.assertTrue(torch.equal(first_output[:, 0], first_output[:, 1]))

    def test_cpu_forward_and_autograd_reach_all_transport_parameters(self):
        torch = self.torch
        model = self.build()
        parameters = local_transport_parameters(model)
        noisy_latent = torch.randn(1, 12, 8, 8)
        timestep = torch.tensor([37])
        conditions = torch.randn(1, 23, 32, 32, requires_grad=True)
        output = model.predict_velocity(noisy_latent, timestep, conditions)
        self.assertEqual(tuple(output.shape), (1, 12, 8, 8))
        self.assertTrue(bool(torch.isfinite(output).all()))
        gradients = torch.autograd.grad(
            output.square().mean(),
            [conditions, *parameters.values()],
            allow_unused=True,
        )
        for name, gradient in zip(
            ("conditions", *parameters),
            gradients,
            strict=True,
        ):
            self.assertIsNotNone(gradient, name)
            self.assertTrue(bool(torch.isfinite(gradient).all()), name)
            self.assertGreater(float(gradient.abs().max()), 0.0, name)

    def test_inactive_config_and_negative_mutations(self):
        config = compile_joint_condition_local_transport_cpu_inactive_config()
        result = validate_joint_condition_local_transport_cpu_inactive_config(
            config
        )
        self.assertEqual(result["parameterCount"], 22_464)
        self.assertFalse(result["gpuAllowed"])
        self.assertFalse(result["trainingAllowed"])

        mutations = []
        for mutate in (
            lambda value: value.__setitem__("conditionChannels", 24),
            lambda value: value.__setitem__("denoiserBaseChannels", 128),
            lambda value: value["jointConditionLocalTransportContract"].__setitem__(
                "siteCount", 10
            ),
            lambda value: value["jointConditionLocalTransportContract"].__setitem__(
                "softmaxTemperature", 0.5
            ),
            lambda value: value["jointConditionLocalTransportContract"].__setitem__(
                "spatialAffineCoexistenceAllowed", True
            ),
            lambda value: value["activationGates"].__setitem__(
                "gpuNow", True
            ),
            lambda value: value["activationGates"].__setitem__(
                "trainingNow", True
            ),
        ):
            invalid = deepcopy(config)
            mutate(invalid)
            mutations.append(invalid)
        for invalid in mutations:
            with self.assertRaises(ValueError):
                validate_joint_condition_local_transport_cpu_inactive_config(
                    invalid
                )

    def test_readonly_gpu_template_and_negative_mutations(self):
        run_id = "stage4-joint-transport-readonly-unit-0001"
        output_namespace = f"{READONLY_GPU_OUTPUT_ROOT}/{run_id}"
        config = build_joint_condition_local_transport_readonly_gpu_config_template(
            run_id=run_id,
            output_namespace=output_namespace,
        )
        result = validate_joint_condition_local_transport_readonly_gpu_config(
            config,
            require_execution_ticket=False,
        )
        self.assertEqual(
            result["modeId"],
            "joint_condition_local_transport_stage4_readonly_gpu",
        )
        self.assertFalse(result["ownerAuthorizationRequired"])
        self.assertFalse(result["trainingAllowed"])
        self.assertEqual(
            {key for key, value in config["activationGates"].items() if value},
            {"gpuNow", "readonlyGpuQualificationNow"},
        )

        for mutate in (
            lambda value: value["executionIdentity"].__setitem__(
                "outputNamespace", f"{READONLY_GPU_OUTPUT_ROOT}/another-run"
            ),
            lambda value: value["activationGates"].__setitem__(
                "trainingNow", True
            ),
            lambda value: value["readOnlyGpuBoundary"].__setitem__(
                "optimizerCreationAllowed", True
            ),
            lambda value: value["evidenceBindings"]["qualificationSamples"][
                "fixedValidation"
            ].__setitem__("split", "train"),
        ):
            invalid = deepcopy(config)
            mutate(invalid)
            with self.assertRaises(ValueError):
                validate_joint_condition_local_transport_readonly_gpu_config(
                    invalid,
                    require_execution_ticket=False,
                )


if __name__ == "__main__":
    unittest.main()

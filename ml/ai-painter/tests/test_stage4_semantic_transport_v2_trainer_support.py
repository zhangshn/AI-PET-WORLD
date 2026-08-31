from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import unittest

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
SOURCE = ROOT / "ml" / "ai-painter" / "src"
for path in (SCRIPTS, SOURCE):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import train_ai_assisted_conditional_denoiser as trainer  # noqa: E402
from ai_painter.complete_world.model import build_complete_world_system  # noqa: E402
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    ARCHITECTURE_ID,
    CPU_INACTIVE_STATUS,
    FORMAL_CONDITION_CHANNEL_ORDER,
    FORMAL_CONTINUOUS_CONDITION_ORDER,
    FORMAL_DISCRETE_CONDITION_ORDER,
    OBJECTIVE_MAPPING_ID,
    OBJECT_SEMANTIC_CHANNELS,
    OBJECT_SEMANTIC_CHANNEL_WEIGHTS,
    RESPONSIBILITY_IDENTITIES,
    SPARSE_RGB_CONDITION_CHANNELS,
    TRAINER_SUPPORT_BINDING_KEY,
    TRAINER_SUPPORT_CONTRACT_ID,
    TRAINER_SUPPORT_CONTRACT_PATH,
    CPU_CHECKER_PATH,
    build_stage4_semantic_transport_v2_cpu_inactive_config,
    file_sha256,
    stage4_semantic_transport_v2_optimizer_parameters,
    validate_stage4_semantic_transport_v2_autoencoder_boundary,
    validate_stage4_semantic_transport_v2_trainer_contract,
)


FORMAL_OBJECTIVE_PATH = (
    ROOT
    / "data"
    / "ai-painter"
    / "system-governance"
    / "stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json"
)
SUPPORT_CONTRACT_PATH = ROOT / TRAINER_SUPPORT_CONTRACT_PATH


def _formal_objective() -> dict:
    return json.loads(FORMAL_OBJECTIVE_PATH.read_text(encoding="utf-8"))


def _config() -> dict:
    formal = _formal_objective()
    return {
        "baseChannels": 48,
        "denoiserBaseChannels": 64,
        "latentChannels": 12,
        "latentDownsampleFactor": 4,
        "conditionChannels": 23,
        "conditionChannelOrder": list(FORMAL_CONDITION_CHANNEL_ORDER),
        "conditionChannelTypes": {
            "discrete": list(FORMAL_DISCRETE_CONDITION_ORDER),
            "continuous": list(FORMAL_CONTINUOUS_CONDITION_ORDER),
        },
        "conditionResizeContract": "discrete_nearest_continuous_bilinear_v1",
        "conditionOutputBinding": "predicted_clean_latent_and_decoded_rgb_v1",
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "denoiserArchitecture": ARCHITECTURE_ID,
        "diffusionSteps": 1000,
        "inferenceSteps": 50,
        "training": {
            "denoiserLossVersion": "velocity_decoded_rgb_sparse_region_rollout_v6",
            "bestCheckpointMetric": "fixed_grid_plus_deterministic_rollout_rgb_score_v6",
            "strictHeldOutInferenceSplit": "challenge",
            "textureHierarchyScales": list(formal["training"]["textureHierarchyScales"]),
            "quietRegionQuantile": formal["training"]["quietRegionQuantile"],
            "quietRegionMargin": formal["training"]["quietRegionMargin"],
            "sparseRgbConditionChannels": list(SPARSE_RGB_CONDITION_CHANNELS),
            "semanticRgbConditionChannels": list(OBJECT_SEMANTIC_CHANNELS),
            "objectSemanticChannelWeights": dict(OBJECT_SEMANTIC_CHANNEL_WEIGHTS),
            "pathBoundaryBandRatio": formal["training"]["pathBoundaryBandRatio"],
            "denoiserLossWeights": deepcopy(formal["denoiserLossWeights"]),
            "bestCheckpointMetricWeights": deepcopy(
                formal["bestCheckpointMetricWeights"]
            ),
            TRAINER_SUPPORT_BINDING_KEY: {
                "contractId": TRAINER_SUPPORT_CONTRACT_ID,
                "contractPath": TRAINER_SUPPORT_CONTRACT_PATH,
                "contractSha256": file_sha256(SUPPORT_CONTRACT_PATH),
                "status": CPU_INACTIVE_STATUS,
                "objectiveMappingId": OBJECTIVE_MAPPING_ID,
                "responsibilityIdentityOrder": list(RESPONSIBILITY_IDENTITIES),
                "machineReviewThresholdsUsedAsTrainingTargets": False,
                "failedPreviewPixelsUsedAsTrainingTargets": False,
            },
        },
    }


class Stage4SemanticTransportV2TrainerSupportTests(unittest.TestCase):
    def test_exact_cpu_inactive_support_contract_is_accepted(self):
        evidence = validate_stage4_semantic_transport_v2_trainer_contract(
            _config(), root=ROOT
        )
        self.assertEqual(
            evidence["status"],
            "stage4_semantic_transport_v2_trainer_contract_valid_cpu_inactive",
        )
        self.assertEqual(
            tuple(evidence["responsibilityIdentityOrder"]),
            RESPONSIBILITY_IDENTITIES,
        )
        self.assertFalse(evidence["gpuActivated"])

    def test_stale_or_mutated_contract_inputs_fail_closed(self):
        mutations = []

        changed_weight = _config()
        changed_weight["training"]["denoiserLossWeights"]["velocity"] = 0.99
        mutations.append(changed_weight)

        stale_sha = _config()
        stale_sha["training"][TRAINER_SUPPORT_BINDING_KEY][
            "contractSha256"
        ] = "0" * 64
        mutations.append(stale_sha)

        threshold_target = _config()
        threshold_target["training"][TRAINER_SUPPORT_BINDING_KEY][
            "machineReviewThresholdsUsedAsTrainingTargets"
        ] = True
        mutations.append(threshold_target)

        reordered = _config()
        order = reordered["training"][TRAINER_SUPPORT_BINDING_KEY][
            "responsibilityIdentityOrder"
        ]
        order[0], order[1] = order[1], order[0]
        mutations.append(reordered)

        extra_free_field = _config()
        extra_free_field["training"][TRAINER_SUPPORT_BINDING_KEY][
            "freeResponsibilityWeight"
        ] = 1.0
        mutations.append(extra_free_field)

        changed_checkpoint_weight = _config()
        changed_checkpoint_weight["training"]["bestCheckpointMetricWeights"][
            "objectRockRgbMae"
        ] = 0.5
        mutations.append(changed_checkpoint_weight)

        activated_route_loss = _config()
        activated_route_loss["training"]["pathCoverageCalibration"] = {
            "enabled": True,
            "weight": 1.0,
        }
        mutations.append(activated_route_loss)

        review_threshold_target = _config()
        review_threshold_target["training"]["machineReviewThresholdAsTarget"] = 0.1
        mutations.append(review_threshold_target)

        for config in mutations:
            with self.subTest(config=config), self.assertRaises(ValueError):
                validate_stage4_semantic_transport_v2_trainer_contract(
                    config, root=ROOT
                )

    def test_cpu_only_checker_accepts_its_derived_inactive_config(self):
        derived = build_stage4_semantic_transport_v2_cpu_inactive_config(ROOT)
        self.assertEqual(derived["training"][TRAINER_SUPPORT_BINDING_KEY]["status"], CPU_INACTIVE_STATUS)
        result = subprocess.run(
            [sys.executable, str(ROOT / CPU_CHECKER_PATH)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        evidence = json.loads(result.stdout)
        self.assertEqual(
            evidence["status"],
            "stage4_semantic_transport_v2_trainer_contract_valid_cpu_inactive",
        )
        self.assertFalse(evidence["gpuActivated"])

    def test_cpu_checker_never_imports_the_trainer_or_torch_runtime(self):
        checker = (ROOT / CPU_CHECKER_PATH).read_text(encoding="utf-8")
        self.assertNotIn("train_ai_assisted_conditional_denoiser", checker)
        self.assertNotIn("torch", checker)
        self.assertNotIn("load_state_dict", checker)

    def test_auxiliary_condition_probe_exactly_preserves_the_v5_plus_shape(self):
        torch.manual_seed(20263722)
        model = build_complete_world_system(_config())
        probe = model.denoiser.output_bound_condition_probe
        self.assertEqual(probe[0].in_channels, 12)
        self.assertEqual(probe[0].out_channels, 64)
        self.assertEqual(probe[3].in_channels, 64)
        self.assertEqual(probe[3].out_channels, 23)
        self.assertEqual(type(probe[2]).__name__, "OutputBoundResidualBlock")
        predicted = model.reconstruct_conditions_from_clean_latent(
            torch.randn(1, 12, 4, 4)
        )
        self.assertEqual(tuple(predicted.shape), (1, 23, 4, 4))
        self.assertGreaterEqual(float(predicted.min().detach()), 0.0)
        self.assertLessEqual(float(predicted.max().detach()), 1.0)
        responsibility_ids = {
            id(parameter)
            for identity in RESPONSIBILITY_IDENTITIES
            for parameter in model.denoiser.responsibility_paths[identity].parameters()
        }
        responsibility_ids.update(
            id(parameter)
            for identity in RESPONSIBILITY_IDENTITIES
            for parameter in model.denoiser.rgb_responsibility_heads[identity].parameters()
        )
        self.assertFalse(
            responsibility_ids
            & {id(parameter) for parameter in probe.parameters()}
        )

    def test_responsibility_parameter_namespaces_are_pairwise_isolated(self):
        model = build_complete_world_system(_config())
        namespaces = {}
        for identity in RESPONSIBILITY_IDENTITIES:
            namespaces[f"latent:{identity}"] = {
                id(parameter)
                for parameter in model.denoiser.responsibility_paths[identity].parameters()
            }
            namespaces[f"rgb:{identity}"] = {
                id(parameter)
                for parameter in model.denoiser.rgb_responsibility_heads[identity].parameters()
            }
        names = tuple(namespaces)
        for index, left in enumerate(names):
            for right in names[index + 1:]:
                self.assertFalse(
                    namespaces[left] & namespaces[right],
                    f"{left} shares a parameter with {right}",
                )

    def test_formal_v6_loss_reaches_every_responsibility_without_state_change(self):
        torch.manual_seed(20263722)
        config = _config()
        model = build_complete_world_system(config)
        model.train()
        self.assertFalse(model.autoencoder.training)
        self.assertTrue(
            all(not parameter.requires_grad for parameter in model.autoencoder.parameters())
        )
        loaded = validate_stage4_semantic_transport_v2_autoencoder_boundary(
            model,
            phase="loaded",
        )
        before_training = (
            validate_stage4_semantic_transport_v2_autoencoder_boundary(
                model,
                phase="before_training",
                expected_state_sha256=loaded["stateSha256"],
            )
        )
        optimizer_parameters = (
            stage4_semantic_transport_v2_optimizer_parameters(model)
        )
        self.assertFalse(before_training["optimizerContainsAutoencoder"])
        self.assertEqual(
            {id(parameter) for parameter in optimizer_parameters},
            {
                id(parameter)
                for parameter in model.denoiser.parameters()
                if parameter.requires_grad
            },
        )

        clean_latent = torch.randn(1, 12, 4, 4)
        noise = torch.randn_like(clean_latent)
        conditions = torch.rand(1, 23, 16, 16)
        conditions[:, :15] = 0.0
        for identity in RESPONSIBILITY_IDENTITIES:
            index = FORMAL_CONDITION_CHANNEL_ORDER.index(identity)
            conditions[:, index] = 1.0
        target_rgb = torch.sigmoid(torch.randn(1, 3, 16, 16))
        diffusion = trainer.build_diffusion_schedule(config, torch.device("cpu"))
        timestep = torch.tensor([37], dtype=torch.long)
        noisy_latent = trainer.add_noise(
            clean_latent,
            noise,
            timestep,
            diffusion["alphasCumulative"],
        )
        target_velocity = trainer.velocity_target(
            clean_latent,
            noise,
            timestep,
            diffusion["alphasCumulative"],
        )
        normalization = {
            "mean": torch.zeros(1, 12, 1, 1),
            "standardDeviation": torch.ones(1, 12, 1, 1),
        }
        metrics = trainer.predict_and_measure(
            model,
            noisy_latent,
            target_velocity,
            clean_latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            config,
            target_rgb,
            normalization,
        )
        self.assertTrue(trainer.is_stage4_semantic_transport_v2(config))
        self.assertTrue(trainer.is_v6_or_later(config))
        self.assertEqual(
            float(
                metrics[
                    "stage4SemanticTransportV2FormalV6ObjectiveReused"
                ].detach()
            ),
            1.0,
        )
        named_parameters = tuple(
            (name, parameter)
            for name, parameter in model.denoiser.named_parameters()
            if name.startswith("responsibility_paths.")
            or name.startswith("rgb_responsibility_heads.")
        )
        gradients = torch.autograd.grad(
            metrics["compositeLossTensor"],
            tuple(parameter for _, parameter in named_parameters),
            allow_unused=True,
        )
        for (name, _), gradient in zip(named_parameters, gradients, strict=True):
            self.assertIsNotNone(gradient, name)
            self.assertTrue(bool(torch.isfinite(gradient).all()), name)
            self.assertGreater(float(gradient.abs().max().detach()), 0.0, name)
        after_training = (
            validate_stage4_semantic_transport_v2_autoencoder_boundary(
                model,
                phase="after_training",
                expected_state_sha256=loaded["stateSha256"],
            )
        )
        self.assertEqual(
            loaded["stateSha256"],
            before_training["stateSha256"],
        )
        self.assertEqual(
            loaded["stateSha256"],
            after_training["stateSha256"],
        )

    def test_legacy_rgb_decode_does_not_enter_the_v2_path(self):
        class Autoencoder:
            @staticmethod
            def decode(latent):
                return latent[:, :3]

        class LegacyModel:
            autoencoder = Autoencoder()

            @staticmethod
            def decode_stage4_semantic_responsibility_rgb(*_args, **_kwargs):
                raise AssertionError("legacy mode entered the V2 RGB path")

        latent = torch.randn(1, 12, 4, 4)
        decoded = trainer.decode_final_visible_rgb(
            LegacyModel(),
            latent,
            torch.zeros(1, 23, 16, 16),
            {"denoiserArchitecture": "multiscale_condition_unet_v6"},
        )
        self.assertTrue(torch.equal(decoded, latent[:, :3]))
        self.assertFalse(trainer.is_stage4_semantic_transport_v2(
            {"denoiserArchitecture": "multiscale_condition_unet_v6"}
        ))


if __name__ == "__main__":
    unittest.main()

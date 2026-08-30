from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import hashlib
import os
import sys
import tempfile
import unittest
from unittest import mock

import torch


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
PACKAGE_DIR = SCRIPT_DIR.parent
for path in (SCRIPT_DIR, PACKAGE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import train_ai_assisted_conditional_denoiser as trainer


SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-"
    "wet-season-drainage-hollow-v6"
)


class _RowsDataset(torch.utils.data.Dataset):
    def __init__(self, rows):
        self.rows = list(rows)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        return self.rows[index]


def _config():
    return {
        "denoiserArchitecture": (
            trainer.STAGE4_JOINT_CONDITION_LOCAL_TRANSPORT_DENOISER_ARCHITECTURE
        ),
        "conditionChannels": 23,
        "conditionChannelOrder": list(
            trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        ),
        "latentChannels": 12,
        "latentDownsampleFactor": 4,
        "denoiserBaseChannels": 64,
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "diffusionSteps": 1000,
        "inferenceSteps": 50,
        "ownerAuthorizationRequired": False,
        "ownerResponseRequired": False,
        "formalLossSourceEvidence": {"path": "formal-loss.json", "sha256": "a" * 64},
        "executionIdentity": {
            "runId": "joint-local-transport-smoke-test-run",
            "outputNamespace": (
                ".runtime/ai-painter/"
                "stage4-joint-condition-local-transport-controlled-smokes/"
                "joint-local-transport-smoke-test-run"
            ),
        },
        "jointConditionLocalTransportContract": {
            "architectureId": (
                trainer.STAGE4_JOINT_CONDITION_LOCAL_TRANSPORT_DENOISER_ARCHITECTURE
            ),
            "siteCount": 12,
            "parameterTensorCount": 24,
            "parameterCount": 22_464,
            "spatialAffineCoexistenceAllowed": False,
            "objectiveReviewAlignmentClaimed": False,
        },
        "training": {
            "trainingAuthorizationStatus": (
                trainer.STAGE4_JOINT_CONDITION_LOCAL_TRANSPORT_SMOKE_STATUS
            ),
            "denoiserEpochs": 30,
            "seed": 20263722,
            "fixedEpochPreviewPolicy": {"smoke": [1, 5, 10, 20, 30]},
            "denoiserLossVersion": "frozen_existing_loss_v1",
            "denoiserLossWeights": {"velocity": 1.0},
            "bestCheckpointMetricWeights": {"validation": 1.0},
            "stage4JointConditionLocalTransportSmokeContract": {
                "compiledContract": {
                    "path": "compiled-contract.json",
                    "sha256": "b" * 64,
                },
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "topology": "west",
                "requiredBoundarySides": ["west"],
                "resolutionStage": 0,
                "resolution": {"width": 256, "height": 192},
                "latentResolution": {"width": 64, "height": 48},
                "epochCount": 30,
                "previewEpochs": [1, 5, 10, 20, 30],
                "initialization": (
                    "fixed_random_denoiser_initialization_without_checkpoint"
                ),
                "autoencoderFrozen": True,
                "denoiserCheckpointReadAllowed": False,
                "historicalCheckpointAllowed": False,
                "failedCheckpointAllowed": False,
                "crossRunArtifactAllowed": False,
                "automaticTrainingRetryAllowed": False,
            },
        },
    }


def _mode():
    return SimpleNamespace(
        mode_id="joint_condition_local_transport_stage4_smoke",
        execution_kind="single_sample_smoke",
        sample_split="validation",
        adapter_binding="joint_condition_local_transport_stage4_adapter",
    )


class JointConditionLocalTransportTrainerIntegrationTest(unittest.TestCase):
    def test_joint_candidate_preserves_registered_v7_dataset_and_rollout_contracts(self):
        config = _config()
        self.assertTrue(trainer.uses_registered_v7_capacity_dataset(config))
        self.assertEqual(
            trainer.conditional_dataset_selection_contract(config),
            "registered_v7_capacity_contribution_v1",
        )
        self.assertTrue(trainer.uses_v7_rollout_validation(config))
        self.assertTrue(trainer.is_v6_or_later(config))

    def test_dedicated_trainer_contract_accepts_only_new_identity(self):
        config = _config()
        with (
            mock.patch.object(
                trainer,
                "validate_joint_condition_local_transport_controlled_smoke_config",
            ) as shared_validator,
            mock.patch.object(trainer, "resolve_stage_mode", return_value=_mode()),
        ):
            result = trainer.validate_stage4_joint_condition_local_transport_trainer_contract(
                config,
                {"packageId": "approved-64-record-package"},
            )
        self.assertEqual(
            result["status"],
            "joint_condition_local_transport_controlled_smoke_trainer_contract_valid",
        )
        self.assertFalse(result["legacySpatialAffineIdentityReused"])
        shared_validator.assert_called_once_with(
            config,
            project_root=Path.cwd(),
            require_execution_ticket=False,
        )

    def test_old_candidate_identity_and_transport_mutation_fail_closed(self):
        mutations = []
        old_field = _config()
        old_field["training"]["stage4FullBackboneSpatialAffineSmokeContract"] = {}
        mutations.append(old_field)
        old_model = _config()
        old_model["fullBackboneSpatialAffineContract"] = {}
        mutations.append(old_model)
        wrong_transport = _config()
        wrong_transport["jointConditionLocalTransportContract"]["parameterCount"] += 1
        mutations.append(wrong_transport)
        wrong_schedule = _config()
        wrong_schedule["training"]["stage4JointConditionLocalTransportSmokeContract"][
            "previewEpochs"
        ] = [1, 5, 10, 20]
        mutations.append(wrong_schedule)

        for config in mutations:
            with self.subTest(config=config):
                with mock.patch.object(
                    trainer,
                    "validate_joint_condition_local_transport_controlled_smoke_config",
                ), mock.patch.object(
                    trainer,
                    "resolve_stage_mode",
                    return_value=_mode(),
                ):
                    with self.assertRaises(ValueError):
                        trainer.validate_stage4_joint_condition_local_transport_trainer_contract(
                            config,
                            {"packageId": "approved-64-record-package"},
                        )

    def test_bound_validation_sample_and_preview_schedule_use_new_contract(self):
        config = _config()
        datasets = {
            "train": _RowsDataset([{"sampleId": "train-only"}]),
            "validation": _RowsDataset([
                {
                    "sampleId": SAMPLE_ID,
                    "conditionLabel": "sample-194",
                    "conditionPackPath": "sample-194-condition-pack.json",
                }
            ]),
            "challenge": _RowsDataset([]),
            "regression": _RowsDataset([]),
        }
        args = SimpleNamespace(
            single_sample_overfit_smoke=True,
            smoke_test=False,
            overfit_sample_id=SAMPLE_ID,
        )
        with mock.patch.object(trainer, "resolve_stage_mode", return_value=_mode()):
            evidence = trainer.build_single_sample_overfit_evidence(
                datasets,
                args,
                config,
                execution_grant=None,
            )
            selected = trainer.build_optimization_datasets(
                datasets,
                evidence,
                config=config,
            )
            schedule = [
                epoch
                for epoch in range(1, 31)
                if trainer.should_save_epoch_preview(config, epoch)
            ]
        self.assertEqual(evidence["selectedSplit"], "validation")
        self.assertEqual(evidence["sampleId"], SAMPLE_ID)
        self.assertTrue(all(len(dataset) == 1 for dataset in selected.values()))
        self.assertEqual(schedule, [1, 5, 10, 20, 30])

    def test_source_binding_requires_isolated_training_output_child(self):
        config = _config()
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            dataset = root / "dataset.json"
            source = root / "source-index.json"
            autoencoder = root / "autoencoder.pt"
            for path, value in (
                (dataset, b"dataset"),
                (source, b"source"),
                (autoencoder, b"autoencoder"),
            ):
                path.write_bytes(value)
            run_root = root / config["executionIdentity"]["outputNamespace"]
            training_output = run_root / "training-output"
            formal = {
                "data": {
                    "datasetManifestPath": "dataset.json",
                    "datasetManifestSha256": hashlib.sha256(b"dataset").hexdigest(),
                    "datasetPackageId": "approved-64-record-package",
                    "sourceIndexPath": "source-index.json",
                    "sourceIndexSha256": hashlib.sha256(b"source").hexdigest(),
                },
                "modelBoundary": {
                    "autoencoderCheckpointPath": "autoencoder.pt",
                    "autoencoderCheckpointSha256": hashlib.sha256(b"autoencoder").hexdigest(),
                },
            }
            package = {
                "packageId": "approved-64-record-package",
                "sourceIndexPath": "source-index.json",
            }
            previous = Path.cwd()
            os.chdir(root)
            try:
                with (
                    mock.patch.object(
                        trainer,
                        "load_spatial_affine_formal_objective_contract",
                        return_value=formal,
                    ),
                    mock.patch.object(
                        trainer,
                        "resolve_stage_mode",
                        return_value=_mode(),
                    ),
                ):
                    result = trainer.validate_stage4_joint_condition_local_transport_cli_source_bindings(
                        config,
                        package,
                        dataset_package_path=dataset,
                        autoencoder_checkpoint_path=autoencoder,
                        output_dir=training_output,
                    )
                    with self.assertRaises(ValueError):
                        trainer.validate_stage4_joint_condition_local_transport_cli_source_bindings(
                            config,
                            package,
                            dataset_package_path=dataset,
                            autoencoder_checkpoint_path=autoencoder,
                            output_dir=run_root,
                        )
            finally:
                os.chdir(previous)
        self.assertFalse(result["historicalRunSourceAccepted"])
        self.assertFalse(result["historicalDenoiserCheckpointAccepted"])

    def test_trainer_source_exposes_dedicated_cli_without_old_mode_alias(self):
        source = Path(trainer.__file__).read_text(encoding="utf-8")
        self.assertIn("--stage4-joint-condition-local-transport-smoke", source)
        self.assertIn(
            "--stage4-joint-condition-local-transport-smoke-contract",
            source,
        )
        self.assertIn(
            '== "joint_condition_local_transport_stage4_adapter"',
            source,
        )
        self.assertNotIn(
            '== "full_backbone_spatial_affine_denoiser_stage4_adapter"\n'
            '        and stage_mode.execution_kind == "single_sample_smoke"',
            source,
        )


if __name__ == "__main__":
    unittest.main()

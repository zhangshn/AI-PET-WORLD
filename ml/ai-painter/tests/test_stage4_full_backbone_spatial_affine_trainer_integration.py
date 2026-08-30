from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = PROJECT_ROOT / "ml" / "ai-painter" / "scripts"
SOURCE = PROJECT_ROOT / "ml" / "ai-painter" / "src"
for entry in (str(SCRIPTS), str(SOURCE)):
    if entry not in sys.path:
        sys.path.insert(0, entry)

from ai_painter_stage_mode_registry import (  # noqa: E402
    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_SMOKE_STATUS,
)
from train_ai_assisted_conditional_denoiser import (  # noqa: E402
    STAGE4_FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_ARCHITECTURE,
    build_full_backbone_spatial_affine_fixed_preview_manifest,
    build_optimization_datasets,
    dataset_source_rows,
    record_full_backbone_spatial_affine_training_resource_telemetry,
    should_reproduce_stage4_fixed_epoch_preview,
    should_save_epoch_preview,
    stage4_spatial_affine_expected_boundary_validation_count,
    validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary,
)


class FullBackboneSpatialAffineTrainerIntegrationTests(unittest.TestCase):
    def _controlled_smoke(self) -> dict:
        return {
            "denoiserArchitecture": (
                STAGE4_FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_ARCHITECTURE
            ),
            "training": {
                "trainingAuthorizationStatus": (
                    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_SMOKE_STATUS
                ),
                "stage4FullBackboneSpatialAffineSmokeContract": {
                    "previewEpochs": [1, 5, 10, 20, 30],
                },
            },
        }

    def test_only_controlled_smoke_can_cross_inactive_training_boundary(self) -> None:
        result = validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
            self._controlled_smoke(),
            preflight_only=False,
        )
        self.assertTrue(result["controlledSmoke"])

        inactive = self._controlled_smoke()
        inactive["training"]["trainingAuthorizationStatus"] = (
            "local_ai_stage4_full_backbone_spatial_affine_cpu_supported_inactive"
        )
        with self.assertRaisesRegex(ValueError, "requires --preflight-only"):
            validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
                inactive,
                preflight_only=False,
            )
        validate_stage4_full_backbone_spatial_affine_inactive_cli_boundary(
            inactive,
            preflight_only=True,
        )

    def test_fixed_preview_contract_is_exact(self) -> None:
        config = self._controlled_smoke()
        selected = {
            epoch
            for epoch in range(1, 31)
            if should_save_epoch_preview(config, epoch)
        }
        reproduced = {
            epoch
            for epoch in range(1, 31)
            if should_reproduce_stage4_fixed_epoch_preview(config, epoch)
        }
        self.assertEqual(selected, {1, 5, 10, 20, 30})
        self.assertEqual(reproduced, selected)

    def test_bound_smoke_uses_one_validation_row_while_formal_keeps_eight(self) -> None:
        config = self._controlled_smoke()
        config["training"][
            "stage4FullBackboneSpatialAffineSmokeContract"
        ].update({
            "sampleId": "sample-194",
            "sampleSplit": "validation",
        })

        class FixtureDataset:
            def __init__(self, split):
                self.rows = [
                    {"sampleId": "other"},
                    {"sampleId": "sample-194"},
                ] if split == "validation" else [{"sampleId": split}]

            def __len__(self):
                return len(self.rows)

            def __getitem__(self, index):
                return self.rows[index]

        datasets = {
            split: FixtureDataset(split)
            for split in ("train", "validation", "challenge", "regression")
        }
        selected = build_optimization_datasets(
            datasets,
            {
                "enabled": True,
                "selectedSplit": "validation",
                "selectedIndex": 1,
                "sampleId": "sample-194",
            },
            config=config,
        )
        self.assertEqual(dataset_source_rows(selected["validation"]), [
            {"sampleId": "sample-194"},
        ])
        self.assertEqual(
            stage4_spatial_affine_expected_boundary_validation_count(config),
            1,
        )
        formal = {
            "denoiserArchitecture": "stage4_multiscale_spatial_affine_conditioned_decoder_v1",
            "training": {
                "dataCapacityDecision": {
                    "splitCounts": {"validation": 8},
                },
            },
        }
        self.assertEqual(
            stage4_spatial_affine_expected_boundary_validation_count(formal),
            8,
        )
        future_full_backbone_formal = {
            "denoiserArchitecture": (
                STAGE4_FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_ARCHITECTURE
            ),
            "training": {
                "trainingAuthorizationStatus": (
                    "future_full_backbone_formal_stage0_active"
                ),
                "dataCapacityDecision": {
                    "splitCounts": {"validation": 8},
                },
            },
        }
        self.assertEqual(
            stage4_spatial_affine_expected_boundary_validation_count(
                future_full_backbone_formal
            ),
            8,
        )
        formal["training"]["dataCapacityDecision"]["splitCounts"][
            "validation"
        ] = 1
        with self.assertRaisesRegex(ValueError, "all 8 validation rows"):
            stage4_spatial_affine_expected_boundary_validation_count(formal)

    def test_fixed_preview_and_resource_telemetry_projection_is_complete(self) -> None:
        config = self._controlled_smoke()
        metrics = []
        for epoch in (1, 5, 10, 20, 30):
            source = {
                "epoch": epoch,
                "previewPath": f"preview-{epoch}.png",
                "previewSha256": f"sha-{epoch}",
            }
            repeated = {
                "epoch": epoch,
                "previewPath": f"reproduction-{epoch}.png",
                "previewSha256": f"sha-{epoch}",
            }
            metrics.append({
                "epoch": epoch,
                "validationPreviewArtifact": source,
                "validationPreviewReproductionArtifact": {
                    "epoch": epoch,
                    "scheduled": True,
                    "sourcePreview": source,
                    "repeatedPreview": repeated,
                    "modelStateSha256Matches": True,
                    "conditionTensorSha256Matches": True,
                    "rgbTensorSha256Matches": True,
                    "pngByteSha256Matches": True,
                },
            })
        projection = build_full_backbone_spatial_affine_fixed_preview_manifest(
            metrics,
            config,
        )
        self.assertEqual(projection["previewEpochs"], [1, 5, 10, 20, 30])
        self.assertEqual(len(projection["fixedPreviews"]), 5)
        self.assertTrue(all(
            row["byteExactReproduced"]
            and set(row) == {
                "epoch", "path", "sha256", "reproductionPath",
                "reproductionSha256", "byteExactReproduced",
            }
            for row in projection["fixedPreviews"]
        ))

        persisted = []
        cuda = "train_ai_assisted_conditional_denoiser.torch.cuda"
        with (
            patch(f"{cuda}.is_available", return_value=True),
            patch(f"{cuda}.current_device", return_value=0),
            patch(f"{cuda}.synchronize"),
            patch(f"{cuda}.get_device_name", return_value="fixture-gpu"),
            patch(f"{cuda}.memory_allocated", return_value=100),
            patch(f"{cuda}.memory_reserved", return_value=200),
            patch(f"{cuda}.max_memory_allocated", return_value=300),
            patch(f"{cuda}.max_memory_reserved", return_value=400),
            patch(
                "train_ai_assisted_conditional_denoiser."
                "query_nvidia_smi_training_snapshot",
                return_value={
                    "gpuUtilizationPercent": 55,
                    "gpuMemoryUsedBytes": 500,
                },
            ),
            patch(
                "train_ai_assisted_conditional_denoiser.write_json_atomic",
                side_effect=lambda path, value: persisted.append((path, value)),
            ),
        ):
            telemetry = (
                record_full_backbone_spatial_affine_training_resource_telemetry(
                    Path("resource-telemetry.json"),
                    [],
                    run_id="fixture-run",
                    epoch=1,
                    phase="epoch_completed_with_validation",
                )
            )
        self.assertEqual(telemetry["peakGpuMemoryBytes"], 500)
        self.assertEqual(telemetry["rows"][0]["gpuUtilizationPercent"], 55)
        self.assertEqual(len(persisted), 1)

    def test_entry_keeps_ticket_free_preflight_and_consumed_training_distinct(self) -> None:
        trainer_source = (
            SCRIPTS / "train_ai_assisted_conditional_denoiser.py"
        ).read_text(encoding="utf-8")
        self.assertIn(
            '"--stage4-full-backbone-spatial-affine-smoke"',
            trainer_source,
        )
        self.assertIn(
            '"--stage4-full-backbone-spatial-affine-smoke-contract"',
            trainer_source,
        )
        self.assertIn(
            "require_execution_ticket=args.preflight_only is not True",
            trainer_source,
        )
        self.assertIn(
            "full-backbone preflight must precede internal ticket consumption",
            trainer_source,
        )
        self.assertIn(
            "full-backbone controlled Smoke training requires one consumed",
            trainer_source,
        )
        self.assertIn(
            "full-backbone controlled Smoke formal training requires CUDA",
            trainer_source,
        )
        self.assertIn(
            "full_backbone_spatial_affine_controlled_smoke_trainer_",
            trainer_source,
        )


if __name__ == "__main__":
    unittest.main()

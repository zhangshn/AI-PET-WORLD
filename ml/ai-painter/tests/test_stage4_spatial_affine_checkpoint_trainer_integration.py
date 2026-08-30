from __future__ import annotations

import inspect
import json
from pathlib import Path
import unittest

from ai_painter.complete_world.stage4_checkpoint_boundary_gate import (
    audit_boundary_contacts,
    build_boundary_validation_ledger,
)
import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_spatial_affine_decoder_contract import (
    compile_spatial_affine_decoder_cpu_inactive_config,
    load_spatial_affine_formal_objective_contract,
)
from check_stage4_spatial_affine_decoder_cpu import (
    ROOT,
    _materialize_with_real_ticket,
)


def west_mask(width: int, height: int, count: int) -> list[int]:
    result = [0] * (width * height)
    written = 0
    for y in range(height):
        for x in range(6):
            if written >= count:
                return result
            result[y * width + x] = 1
            written += 1
    return result


class Stage4SpatialAffineCheckpointTrainerIntegrationTests(unittest.TestCase):
    def test_actual_cli_sources_are_bound_to_formal_files(self):
        config = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        formal = load_spatial_affine_formal_objective_contract(ROOT)
        dataset_path = ROOT / formal["data"]["datasetManifestPath"]
        autoencoder_path = (
            ROOT / formal["modelBoundary"]["autoencoderCheckpointPath"]
        )
        package = json.loads(dataset_path.read_text(encoding="utf-8"))
        evidence = trainer.validate_stage4_spatial_affine_cli_source_bindings(
            config,
            package,
            dataset_package_path=dataset_path,
            autoencoder_checkpoint_path=autoencoder_path,
            output_dir=ROOT / ".test-output" / "inactive-preflight",
        )
        self.assertEqual(
            evidence["datasetManifestSha256"],
            formal["data"]["datasetManifestSha256"],
        )
        self.assertEqual(
            config["requiredCheckpointProvenance"],
            "project-owned-ai-assisted-cold-start-checkpoint-v7",
        )

        with self.assertRaisesRegex(ValueError, "actual dataset source"):
            trainer.validate_stage4_spatial_affine_cli_source_bindings(
                config,
                package,
                dataset_package_path=ROOT / formal["data"]["sourceIndexPath"],
                autoencoder_checkpoint_path=autoencoder_path,
                output_dir=ROOT / ".test-output" / "inactive-preflight",
            )
        with self.assertRaisesRegex(ValueError, "actual Autoencoder source"):
            trainer.validate_stage4_spatial_affine_cli_source_bindings(
                config,
                package,
                dataset_package_path=dataset_path,
                autoencoder_checkpoint_path=dataset_path,
                output_dir=ROOT / ".test-output" / "inactive-preflight",
            )

    def test_active_ticket_rejects_trainer_output_namespace_replacement(self):
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        active = _materialize_with_real_ticket(inactive, "full_data_screen")
        formal = load_spatial_affine_formal_objective_contract(ROOT)
        dataset_path = ROOT / formal["data"]["datasetManifestPath"]
        autoencoder_path = (
            ROOT / formal["modelBoundary"]["autoencoderCheckpointPath"]
        )
        package = json.loads(dataset_path.read_text(encoding="utf-8"))
        with self.assertRaisesRegex(ValueError, "execution namespace binding"):
            trainer.validate_stage4_spatial_affine_cli_source_bindings(
                active,
                package,
                dataset_package_path=dataset_path,
                autoencoder_checkpoint_path=autoencoder_path,
                output_dir=ROOT / ".runtime" / "ai-painter" / "wrong-run-id",
            )

    def test_old_architecture_has_no_new_checkpoint_gate(self):
        self.assertIsNone(
            trainer.stage4_spatial_affine_boundary_gate_contract(
                {"denoiserArchitecture": "multiscale_condition_unet_v7"}
            )
        )

    def test_screen_and_stage0_use_disjoint_fixed_preview_schedules_with_byte_reproduction(self):
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        screen = _materialize_with_real_ticket(inactive, "full_data_screen")
        self.assertEqual(
            [
                epoch
                for epoch in range(1, 25)
                if trainer.should_save_epoch_preview(screen, epoch)
            ],
            [5, 10, 15, 20, 24],
        )
        self.assertTrue(
            all(
                trainer.should_reproduce_stage4_fixed_epoch_preview(
                    screen, epoch
                )
                for epoch in [5, 10, 15, 20, 24]
            )
        )

        stage0 = _materialize_with_real_ticket(inactive, "stage0")
        self.assertEqual(
            [
                epoch
                for epoch in range(1, 41)
                if trainer.should_save_epoch_preview(stage0, epoch)
            ],
            [1, 5, 10, 20, 30, 40],
        )
        self.assertTrue(
            all(
                trainer.should_reproduce_stage4_fixed_epoch_preview(
                    stage0, epoch
                )
                for epoch in [1, 5, 10, 20, 30, 40]
            )
        )

    def test_formal_review_identity_is_reduced_to_the_immutable_ledger_schema(self):
        width = 64
        height = 64
        expected = west_mask(width, height, 120)
        audit = audit_boundary_contacts(
            expected,
            west_mask(width, height, 100),
            west_mask(width, height, 100),
            width,
            height,
        )
        review_inputs = {
            "width": 1024,
            "height": 768,
            "season": "wet_season",
            "identity": {
                "sampleId": "validation-194",
                "conditionPackPath": "data/condition-pack-194.json",
                "conditionPackSha256": "1" * 64,
                "conditionMaskPath": "data/terrain-path-194.png",
                "conditionMaskSha256": "2" * 64,
                "sourcePreviewSha256": "3" * 64,
                "normalizedReviewRgbSha256": "4" * 64,
                "normalization": {
                    "width": 1024,
                    "height": 768,
                    "resizeKernel": "nearest",
                    "sourceQuantization": "uint8_png_rgb",
                    "normalizer": "formal_sharp_identity",
                    "sourceWidth": 256,
                    "sourceHeight": 192,
                },
            },
        }
        entry = trainer.stage4_spatial_affine_boundary_ledger_entry(
            review_inputs,
            audit,
            seed_index=0,
            seed=20266722,
        )
        self.assertEqual(
            entry["normalization"],
            {
                "width": 1024,
                "height": 768,
                "resizeKernel": "nearest",
                "sourceQuantization": "uint8_png_rgb",
            },
        )
        ledger = build_boundary_validation_ledger([entry])
        self.assertEqual(ledger["entryCount"], 1)
        self.assertEqual(ledger["entries"][0]["sampleId"], "validation-194")

    def test_rollout_and_restore_paths_bind_formal_post_step_evidence(self):
        rollout_source = inspect.getsource(
            trainer.evaluate_deterministic_rollout_rgb_quality_v7
        )
        main_source = inspect.getsource(trainer.main)
        for required in (
            "formal_review_boundary_inputs",
            "audit_route_boundary_from_rgb",
            "build_boundary_validation_ledger",
            "expected_validation_count != 8",
            "checkpoint_boundary_state_sha256",
            "checkpointCandidateFormalPreviewArtifact",
        ):
            self.assertIn(required, rollout_source)
        for required in (
            "post_step_state_sha256",
            "build_stage4_boundary_checkpoint_candidate",
            "decide_stage4_boundary_checkpoint_replacement",
            "best_spatial_affine_checkpoint_candidate",
            "selected post-step state was not restored",
            "restored Checkpoint evidence is not byte-identical",
        ):
            self.assertIn(required, main_source)


if __name__ == "__main__":
    unittest.main(verbosity=2)

import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ai_painter_authorization_policy import resolve_stage_execution_grant
from ai_painter_execution_grant import ExecutionAction
from ai_painter_joint_condition_local_transport_contract import (
    FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE,
    FULL_DATA_SCREEN_OUTPUT_ROOT,
    build_joint_condition_local_transport_full_data_screen_config_template,
    issue_and_consume_joint_condition_local_transport_full_data_screen_ticket,
    validate_joint_condition_local_transport_full_data_screen_config,
)
from ai_painter_stage_mode_registry import resolve_stage_mode
import train_ai_assisted_conditional_denoiser as trainer


class JointConditionLocalTransportFullDataScreenContractTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / FULL_DATA_SCREEN_OUTPUT_ROOT
        parent.mkdir(parents=True, exist_ok=True)
        self.output_root = Path(tempfile.mkdtemp(prefix="cpu-test-screen-", dir=parent))
        self.run_id = self.output_root.name
        self.output_namespace = self.output_root.relative_to(ROOT).as_posix()

    def tearDown(self):
        shutil.rmtree(self.output_root, ignore_errors=True)

    def template(self):
        return build_joint_condition_local_transport_full_data_screen_config_template(
            run_id=self.run_id,
            output_namespace=self.output_namespace,
            project_root=ROOT,
        )

    def active(self):
        template = self.template()
        report = {
            "schemaVersion": (
                "stage4-joint-condition-local-transport-full-data-screen-preflight-v1"
            ),
            "status": "all_preflight_checks_passed",
            "runId": self.run_id,
            "outputNamespace": self.output_namespace,
            "checks": {
                "cpuContract": True,
                "activeConfigAudit": True,
                "trainerReadonlyPreflight": True,
                "cudaResource": True,
                "diskCapacity": True,
                "trainingOutputAbsent": True,
            },
            "gpuStarted": False,
            "trainingStarted": False,
        }
        (self.output_root / "preflight-report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        dataset_id = template["evidenceBindings"]["approvedDataset"][
            "datasetPackageId"
        ]
        return issue_and_consume_joint_condition_local_transport_full_data_screen_ticket(
            dataset_package_id=dataset_id,
            run_id=self.run_id,
            output_namespace=self.output_namespace,
            project_root=ROOT,
        )[0]

    def test_template_has_unique_fixed_identity(self):
        config = self.template()
        mode = resolve_stage_mode(config)
        self.assertEqual(
            mode.mode_id,
            "joint_condition_local_transport_stage4_full_data_screen",
        )
        self.assertEqual(
            mode.adapter_binding,
            "joint_condition_local_transport_stage4_full_data_screen_adapter",
        )
        self.assertEqual(mode.execution_kind, "full_data_screen")
        self.assertIsNone(mode.sample_split)
        screen = config["training"][
            "stage4JointConditionLocalTransportFullDataScreenContract"
        ]
        self.assertEqual(screen["epochCount"], 24)
        self.assertEqual(screen["optimizerStepCount"], 1152)
        self.assertEqual(screen["requiredUniqueTrainingTimestepCount"], 1000)
        self.assertEqual(screen["requiredExactInferenceOverlapCount"], 50)
        self.assertEqual(screen["previewEpochs"], [5, 10, 15, 20, 24])
        self.assertFalse(screen["checkpointPromotionAllowed"])
        self.assertFalse(screen["stage0Allowed"])
        result = validate_joint_condition_local_transport_full_data_screen_config(
            config, project_root=ROOT, require_execution_ticket=False
        )
        self.assertEqual(result["optimizerStepCount"], 1152)
        self.assertFalse(any(config["activationGates"].values()))
        self.assertFalse(any(config["training"]["activationGates"].values()))
        self.assertFalse(any(config["executionBoundary"].values()))

    def test_one_time_ticket_grant_is_full_data_only(self):
        active = self.active()
        grant = resolve_stage_execution_grant(active, project_root=ROOT)
        self.assertEqual(grant.dataset_constraints["epochCount"], 24)
        self.assertEqual(grant.dataset_constraints["trainSampleCountPerEpoch"], 48)
        self.assertEqual(grant.dataset_constraints["validationSampleCount"], 8)
        self.assertEqual(grant.dataset_constraints["challengeSampleCount"], 4)
        self.assertEqual(grant.dataset_constraints["regressionSampleCount"], 4)
        self.assertEqual(grant.dataset_constraints["optimizerStepCount"], 1152)
        self.assertFalse(grant.checkpoint_constraints["parentDenoiserAllowed"])
        self.assertNotIn(ExecutionAction.SELECT_BOUND_SAMPLE, grant.allowed_actions)
        self.assertIn(
            ExecutionAction.SELECT_BOUND_SAMPLE,
            grant.explicitly_denied_actions,
        )
        self.assertTrue(
            active["training"]["localAiCapabilityTicket"]["ticketId"].startswith(
                "local-ai-joint-local-transport-full-data-screen-"
            )
        )
        self.assertTrue(active["activationGates"]["fullDataScreenNow"])
        with self.assertRaises(ValueError):
            issue_and_consume_joint_condition_local_transport_full_data_screen_ticket(
                dataset_package_id=active["evidenceBindings"]["approvedDataset"][
                    "datasetPackageId"
                ],
                run_id=self.run_id,
                output_namespace=self.output_namespace,
                project_root=ROOT,
            )

    def test_trainer_contract_accepts_screen_without_starting_training(self):
        config = self.template()
        result = trainer.validate_stage4_joint_condition_local_transport_trainer_contract(
            config, {"packageId": "fixture"}
        )
        self.assertEqual(
            result["status"],
            "joint_condition_local_transport_full_data_screen_trainer_contract_valid",
        )
        self.assertFalse(result["checkpointStage0Eligible"])
        self.assertTrue(
            trainer.is_stage4_joint_condition_local_transport_full_data_screen(config)
        )
        self.assertFalse(
            trainer.is_stage4_joint_condition_local_transport_controlled_smoke(config)
        )

    def test_trainer_readonly_preflight_is_ticket_free_and_output_free(self):
        config = self.template()
        training_output = self.output_root / "training-output"
        result = (
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                config,
                preflight_only=True,
                output_dir=training_output,
            )
        )
        self.assertEqual(
            result,
            {
                "preflightOnly": True,
                "ticketConsumed": False,
                "trainingOutputAbsent": True,
            },
        )
        self.assertFalse(training_output.exists())
        provenance = trainer.validate_stage4_sample_bound_boundary_provenance(
            config,
            {"enabled": False},
            execution_grant=None,
            allow_ticket_free_full_data_preflight=True,
        )
        self.assertEqual(
            provenance["status"],
            "not_applicable_full_data_screen_readonly_preflight",
        )
        self.assertFalse(provenance["executionGrantResolved"])

        changed = copy.deepcopy(config)
        changed["activationGates"]["gpuNow"] = True
        with self.assertRaises(ValueError):
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                changed,
                preflight_only=True,
                output_dir=training_output,
            )

        active = self.active()
        with self.assertRaises(ValueError):
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                active,
                preflight_only=True,
                output_dir=training_output,
            )

        training_output.mkdir()
        with self.assertRaises(ValueError):
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                config,
                preflight_only=True,
                output_dir=training_output,
            )

    def test_activated_trainer_requires_ticket_and_exact_gates(self):
        training_output = self.output_root / "training-output"
        with self.assertRaises(ValueError):
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                self.template(),
                preflight_only=False,
                output_dir=training_output,
            )
        active = self.active()
        result = (
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                active,
                preflight_only=False,
                output_dir=training_output,
            )
        )
        self.assertTrue(result["ticketConsumed"])
        active_provenance = trainer.validate_stage4_sample_bound_boundary_provenance(
            active,
            {"enabled": False},
            execution_grant=resolve_stage_execution_grant(active, project_root=ROOT),
        )
        self.assertEqual(
            active_provenance["status"],
            "not_applicable_non_stage4_bounded_smoke",
        )
        changed = copy.deepcopy(active)
        changed["training"]["activationGates"]["gpuNow"] = False
        with self.assertRaises(ValueError):
            trainer.validate_stage4_joint_condition_local_transport_full_data_screen_cli_boundary(
                changed,
                preflight_only=False,
                output_dir=training_output,
            )

    def test_cuda_telemetry_and_fixed_preview_boundaries_are_full_data_owned(self):
        config = self.template()
        self.assertTrue(trainer.stage4_formal_training_requires_cuda(config))
        self.assertEqual(
            [epoch for epoch in range(1, 25) if trainer.should_save_epoch_preview(config, epoch)],
            [5, 10, 15, 20, 24],
        )
        self.assertEqual(
            [
                epoch
                for epoch in range(1, 25)
                if trainer.should_reproduce_stage4_fixed_epoch_preview(config, epoch)
            ],
            [5, 10, 15, 20, 24],
        )
        with mock.patch.object(
            trainer,
            "record_controlled_smoke_training_resource_telemetry",
            return_value={"status": "running"},
        ) as recorder:
            result = trainer.record_joint_condition_local_transport_full_data_screen_training_resource_telemetry(
                self.output_root / "resource-telemetry.json",
                [],
                run_id=self.run_id,
                epoch=5,
                phase="epoch_completed",
            )
        self.assertEqual(result, {"status": "running"})
        self.assertEqual(
            recorder.call_args.kwargs["schema_version"],
            "stage4-joint-condition-local-transport-full-data-screen-training-resource-telemetry-v1",
        )

    def test_full_data_preview_manifest_rejects_extra_or_missing_nodes(self):
        config = self.template()

        def metric(epoch):
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
            return {
                "epoch": epoch,
                "validationPreviewArtifact": source,
                "validationPreviewReproductionArtifact": {
                    "epoch": epoch,
                    "scheduled": True,
                    "modelStateSha256Matches": True,
                    "conditionTensorSha256Matches": True,
                    "rgbTensorSha256Matches": True,
                    "pngByteSha256Matches": True,
                    "repeatedPreview": repeated,
                },
            }

        metrics = [metric(epoch) for epoch in [5, 10, 15, 20, 24]]
        metrics_with_unscheduled_placeholders = []
        for epoch in range(1, 25):
            if epoch in {5, 10, 15, 20, 24}:
                metrics_with_unscheduled_placeholders.append(metric(epoch))
            else:
                metrics_with_unscheduled_placeholders.append({
                    "epoch": epoch,
                    "validationPreviewReproductionArtifact": {
                        "epoch": epoch,
                        "scheduled": False,
                    },
                })
        manifest = trainer.build_joint_condition_local_transport_full_data_screen_fixed_preview_manifest(
            metrics_with_unscheduled_placeholders, config
        )
        self.assertEqual(manifest["previewEpochs"], [5, 10, 15, 20, 24])
        self.assertEqual(
            [row["epoch"] for row in manifest["fixedPreviews"]],
            [5, 10, 15, 20, 24],
        )
        with self.assertRaises(ValueError):
            trainer.build_joint_condition_local_transport_full_data_screen_fixed_preview_manifest(
                metrics[:-1], config
            )
        with self.assertRaises(ValueError):
            trainer.build_joint_condition_local_transport_full_data_screen_fixed_preview_manifest(
                [metric(1), *metrics], config
            )

    def test_full_data_timestep_and_optimizer_boundaries_are_exact(self):
        evidence = trainer.build_timestep_coverage_evidence(
            self.template(),
            24,
            48,
            1,
        )
        self.assertEqual(evidence["trainingPresentationCount"], 1152)
        self.assertEqual(evidence["uniqueTrainingTimestepCount"], 1000)
        self.assertEqual(evidence["exactInferenceOverlapCount"], 50)
        self.assertTrue(evidence["fullScheduleCovered"])

    def test_rejects_schedule_coverage_retry_stage0_and_old_identities(self):
        base = self.template()
        mutations = []
        for field, value in (
            ("epochCount", 30),
            ("optimizerStepCount", 1151),
            ("requiredUniqueTrainingTimestepCount", 999),
            ("requiredExactInferenceOverlapCount", 49),
            ("automaticTrainingRetryAllowed", True),
            ("stage0Allowed", True),
            ("checkpointPromotionAllowed", True),
        ):
            changed = copy.deepcopy(base)
            changed["training"][
                "stage4JointConditionLocalTransportFullDataScreenContract"
            ][field] = value
            mutations.append(changed)
        changed = copy.deepcopy(base)
        changed["training"]["stage4JointConditionLocalTransportSmokeContract"] = {}
        mutations.append(changed)
        changed = copy.deepcopy(base)
        changed["stage4SpatialAffineConditioningContract"] = {}
        mutations.append(changed)
        for changed in mutations:
            with self.subTest(keys=set(changed) - set(base)):
                with self.assertRaises(ValueError):
                    validate_joint_condition_local_transport_full_data_screen_config(
                        changed,
                        project_root=ROOT,
                        require_execution_ticket=False,
                    )

    def test_rejects_old_inactive_contract_and_reused_namespace(self):
        with self.assertRaises(ValueError):
            build_joint_condition_local_transport_full_data_screen_config_template(
                run_id=self.run_id,
                output_namespace=(
                    ".runtime/ai-painter/"
                    "stage4-joint-condition-local-transport-controlled-smokes/"
                    f"{self.run_id}"
                ),
                project_root=ROOT,
            )
        with self.assertRaises(ValueError):
            build_joint_condition_local_transport_full_data_screen_config_template(
                run_id=self.run_id,
                output_namespace=self.output_namespace,
                inactive_contract_path=(
                    ".runtime/ai-painter/"
                    "stage4-joint-condition-local-transport-smoke-contract-compilations/"
                    "old/controlled-smoke-contract.json"
                ),
                inactive_contract_sha256=FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE[
                    "sha256"
                ],
                project_root=ROOT,
            )


if __name__ == "__main__":
    unittest.main()

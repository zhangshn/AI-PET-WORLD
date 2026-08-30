from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from ai_painter_authorization_policy import resolve_stage_execution_grant
import ai_painter_authorization_policy as authorization_policy
from ai_painter_full_backbone_spatial_affine_contract import (
    ARCHITECTURE_ID,
    CONTROLLED_SMOKE_OUTPUT_ROOT,
    FIXED_VALIDATION_SAMPLE_ID,
    build_full_backbone_spatial_affine_controlled_smoke_config_template,
    derive_readonly_gpu_evidence_bindings,
    issue_and_consume_full_backbone_spatial_affine_controlled_smoke_ticket,
    validate_full_backbone_spatial_affine_controlled_smoke_config,
)
import ai_painter_full_backbone_spatial_affine_contract as contract_module
from ai_painter_stage_mode_registry import (
    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_SMOKE_STATUS,
    FORMAL_MODE_REGISTRY,
)
from ai_painter_spatial_affine_decoder_contract import (
    compile_spatial_affine_decoder_cpu_inactive_config,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOURCE_CONTRACT = (
    PROJECT_ROOT
    / ".runtime/ai-painter/"
    "stage4-full-backbone-spatial-affine-smoke-contract-compilations/"
    "stage4-full-backbone-spatial-affine-smoke-contract-"
    "20260829-054007039-15b18c6e/controlled-smoke-contract.json"
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


class FullBackboneControlledSmokeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source_contract = json.loads(
            SOURCE_CONTRACT.read_text(encoding="utf-8")
        )
        cls.source_evidence = derive_readonly_gpu_evidence_bindings(PROJECT_ROOT)
        cls.trainer_baseline = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=PROJECT_ROOT
        )

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.run_id = "full-backbone-controlled-smoke-test-00000001"
        self.output_namespace = (
            f"{CONTROLLED_SMOKE_OUTPUT_ROOT}/{self.run_id}"
        )
        self.compiled_contract_path = (
            ".runtime/ai-painter/test-controlled-smoke-contracts/"
            f"{self.run_id}/controlled-smoke-contract.json"
        )
        self.contract = deepcopy(self.source_contract)
        old_output = self.contract["futureEvidenceNamespace"]["outputDirectory"]
        self.contract["executionIdentity"]["runId"] = self.run_id
        for key, value in list(
            self.contract["futureEvidenceNamespace"].items()
        ):
            self.contract["futureEvidenceNamespace"][key] = value.replace(
                old_output,
                self.output_namespace,
            )
        compiled_path = self.root / self.compiled_contract_path
        _write_json(compiled_path, self.contract)
        self.compiled_contract_sha256 = _sha256(compiled_path)

        self.evidence = deepcopy(self.source_evidence)
        self._copy_policy_evidence_files()
        output = self.root / self.output_namespace
        output.mkdir(parents=True)
        _write_json(
            output / "preflight-report.json",
            {
                "schemaVersion": (
                    "stage4-full-backbone-spatial-affine-controlled-smoke-"
                    "preflight-report-v1"
                ),
                "status": "all_preflight_checks_passed",
                "runId": self.run_id,
                "outputNamespace": self.output_namespace,
                "compiledContract": {
                    "path": self.compiled_contract_path,
                    "sha256": self.compiled_contract_sha256,
                    "schemaVersion": self.contract["schemaVersion"],
                    "status": self.contract["status"],
                    "compilationRunId": self.contract["compilationRunId"],
                },
                "checks": {
                    "cpuPositiveNegativeGate": True,
                    "activeConfigAudit": True,
                    "nodeTrainerReadonlyPreflight": True,
                    "pythonCudaResource": True,
                    "diskCapacity": True,
                    "trainingOutputAbsent": True,
                },
                "ownerAuthorizationRequired": False,
                "gpuStarted": False,
                "trainingStarted": False,
            },
        )
        self.dataset_package_id = self.evidence["approved64Selection"][
            "datasetPackageId"
        ]

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _copy_policy_evidence_files(self) -> None:
        selection = self.evidence["approved64Selection"]
        qualification = self.evidence["qualificationSamples"]
        relative_paths = [selection["sourceIndexPath"]]
        for role in ("firstTrain", "fixedValidation"):
            sample = qualification[role]
            relative_paths.extend(
                [sample["sourceRecordPath"], sample["conditionPackPath"]]
            )
        for relative in relative_paths:
            source = PROJECT_ROOT / relative
            destination = self.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

    def _patches(self):
        return (
            patch.object(
                contract_module,
                "derive_readonly_gpu_evidence_bindings",
                return_value=deepcopy(self.evidence),
            ),
            patch.object(
                contract_module,
                "compile_spatial_affine_decoder_cpu_inactive_config",
                return_value=deepcopy(self.trainer_baseline),
            ),
            patch.object(
                authorization_policy,
                "REGISTERED_HOT_RUNTIME_ROOT",
                self.root / ".runtime",
            ),
        )

    def _issue(self):
        evidence_patch, baseline_patch, runtime_patch = self._patches()
        with evidence_patch, baseline_patch, runtime_patch:
            return (
                issue_and_consume_full_backbone_spatial_affine_controlled_smoke_ticket(
                    dataset_package_id=self.dataset_package_id,
                    run_id=self.run_id,
                    output_namespace=self.output_namespace,
                    compiled_contract_path=self.compiled_contract_path,
                    compiled_contract_sha256=self.compiled_contract_sha256,
                    project_root=self.root,
                )
            )

    def test_mode_registry_exposes_only_fixed_validation_smoke_mode(self) -> None:
        spec = FORMAL_MODE_REGISTRY.resolve(
            FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_SMOKE_STATUS,
            ARCHITECTURE_ID,
        )
        self.assertEqual(
            spec.mode_id,
            "full_backbone_spatial_affine_denoiser_stage4_smoke",
        )
        self.assertEqual(spec.execution_kind, "single_sample_smoke")
        self.assertEqual(spec.sample_split, "validation")
        self.assertTrue(spec.active_execution)

    def test_ticket_free_template_is_complete_and_fixed(self) -> None:
        evidence_patch, baseline_patch, _ = self._patches()
        with evidence_patch, baseline_patch:
            config = (
                build_full_backbone_spatial_affine_controlled_smoke_config_template(
                    run_id=self.run_id,
                    output_namespace=self.output_namespace,
                    compiled_contract_path=self.compiled_contract_path,
                    compiled_contract_sha256=self.compiled_contract_sha256,
                    project_root=self.root,
                )
            )
            result = validate_full_backbone_spatial_affine_controlled_smoke_config(
                config,
                project_root=self.root,
                require_execution_ticket=False,
            )
        self.assertEqual(result["sampleId"], FIXED_VALIDATION_SAMPLE_ID)
        self.assertEqual(result["epochCount"], 30)
        self.assertEqual(result["previewEpochs"], [1, 5, 10, 20, 30])
        self.assertNotIn("localAiCapabilityTicket", config["training"])
        for field in (
            "ownership",
            "trainingLane",
            "datasetPackageModelId",
            "autoencoderArchitecture",
            "conditionOutputBinding",
            "diffusionSteps",
            "inferenceSteps",
            "latentNormalization",
            "requiredCheckpointProvenance",
        ):
            self.assertIn(field, config)
        self.assertNotIn("stage4SpatialAffineConditioningContract", config)

    def test_issue_consumes_ticket_and_policy_grant_is_bounded(self) -> None:
        active, identity = self._issue()
        evidence_patch, baseline_patch, runtime_patch = self._patches()
        with evidence_patch, baseline_patch, runtime_patch:
            result = validate_full_backbone_spatial_affine_controlled_smoke_config(
                active,
                project_root=self.root,
            )
            grant = resolve_stage_execution_grant(active, project_root=self.root)
        self.assertEqual(identity["executionState"], "consumed")
        self.assertFalse(result["ownerAuthorizationRequired"])
        self.assertEqual(
            sorted(action.value for action in grant.allowed_actions),
            result["allowedExecutionActions"],
        )
        self.assertFalse(grant.checkpoint_constraints["parentDenoiserAllowed"])
        self.assertEqual(grant.dataset_constraints["seed"], 20263722)

    def test_half_ticket_is_recovered_without_new_identity(self) -> None:
        active, identity = self._issue()
        output = self.root / self.output_namespace
        consumption = output / "internal-ticket-consumption.json"
        expected_consumption = consumption.read_bytes()
        consumption.unlink()

        recovered_active, recovered_identity = self._issue()
        self.assertEqual(recovered_identity, identity)
        self.assertEqual(recovered_active, active)
        self.assertEqual(consumption.read_bytes(), expected_consumption)

    def test_forged_half_ticket_is_rejected(self) -> None:
        _, _ = self._issue()
        output = self.root / self.output_namespace
        consumption = output / "internal-ticket-consumption.json"
        ticket = output / "internal-ticket.json"
        consumption.unlink()
        forged = json.loads(ticket.read_text(encoding="utf-8"))
        forged["binding"]["runId"] = "forged-run-identity-00000000"
        _write_json(ticket, forged)
        with self.assertRaisesRegex(ValueError, "immutable bytes are invalid"):
            self._issue()

    def test_consumed_replay_is_idempotent(self) -> None:
        first_active, first_identity = self._issue()
        output = self.root / self.output_namespace
        before = {
            path.name: (path.stat().st_mtime_ns, path.read_bytes())
            for path in output.iterdir()
        }
        second_active, second_identity = self._issue()
        after = {
            path.name: (path.stat().st_mtime_ns, path.read_bytes())
            for path in output.iterdir()
        }
        self.assertEqual(second_identity, first_identity)
        self.assertEqual(second_active, first_active)
        self.assertEqual(after, before)

    def test_injected_or_cross_run_preflight_state_is_rejected(self) -> None:
        output = self.root / self.output_namespace
        (output / "historical-checkpoint.pt").write_bytes(b"forbidden")
        with self.assertRaisesRegex(ValueError, "reused or injected"):
            self._issue()

        evidence_patch, baseline_patch, _ = self._patches()
        with evidence_patch, baseline_patch, self.assertRaisesRegex(
            ValueError,
            "does not match the run",
        ):
            build_full_backbone_spatial_affine_controlled_smoke_config_template(
                run_id="different-full-backbone-smoke-run-00000001",
                output_namespace=(
                    f"{CONTROLLED_SMOKE_OUTPUT_ROOT}/"
                    "different-full-backbone-smoke-run-00000001"
                ),
                compiled_contract_path=self.compiled_contract_path,
                compiled_contract_sha256=self.compiled_contract_sha256,
                project_root=self.root,
            )

    def test_unpassed_preflight_cannot_issue_ticket(self) -> None:
        report_path = self.root / self.output_namespace / "preflight-report.json"
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["checks"]["nodeTrainerReadonlyPreflight"] = False
        _write_json(report_path, report)
        with self.assertRaisesRegex(ValueError, "did not prove every gate"):
            self._issue()

    def test_contract_or_training_identity_mutation_is_rejected(self) -> None:
        evidence_patch, baseline_patch, _ = self._patches()
        with evidence_patch, baseline_patch:
            config = (
                build_full_backbone_spatial_affine_controlled_smoke_config_template(
                    run_id=self.run_id,
                    output_namespace=self.output_namespace,
                    compiled_contract_path=self.compiled_contract_path,
                    compiled_contract_sha256=self.compiled_contract_sha256,
                    project_root=self.root,
                )
            )
            config["training"]["denoiserLossWeights"]["velocity"] = 0.5
            with self.assertRaisesRegex(ValueError, "immutable identity changed"):
                validate_full_backbone_spatial_affine_controlled_smoke_config(
                    config,
                    project_root=self.root,
                    require_execution_ticket=False,
                )


if __name__ == "__main__":
    unittest.main()

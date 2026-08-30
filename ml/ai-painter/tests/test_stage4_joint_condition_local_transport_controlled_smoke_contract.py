from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPTS_ROOT = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

import ai_painter_authorization_policy as authorization_policy
from ai_painter_authorization_policy import resolve_stage_execution_grant
import ai_painter_joint_condition_local_transport_contract as contract_module
from ai_painter_joint_condition_local_transport_contract import (
    ARCHITECTURE_ID,
    CONTROLLED_SMOKE_CONTRACT_ROOT,
    CONTROLLED_SMOKE_OUTPUT_ROOT,
    FIXED_VALIDATION_SAMPLE_ID,
    build_joint_condition_local_transport_controlled_smoke_config_template,
    issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket,
    validate_joint_condition_local_transport_controlled_smoke_config,
)
from ai_painter_stage_mode_registry import (
    FORMAL_MODE_REGISTRY,
    JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_SMOKE_STATUS,
)


def _write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class JointConditionLocalTransportControlledSmokeContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.run_id = "joint-local-transport-controlled-smoke-test-0001"
        self.output_namespace = f"{CONTROLLED_SMOKE_OUTPUT_ROOT}/{self.run_id}"
        self.compilation_run_id = "joint-local-transport-contract-fixture-0001"
        self.compiled_contract_path = (
            f"{CONTROLLED_SMOKE_CONTRACT_ROOT}/{self.compilation_run_id}/"
            "controlled-smoke-contract.json"
        )
        self.compiled_contract = self._compiled_contract()
        compiled_path = self.root / self.compiled_contract_path
        _write_json(compiled_path, self.compiled_contract)
        self.compiled_contract_sha256 = _sha256(compiled_path)
        self.compiled_contract_binding = {
            "path": self.compiled_contract_path,
            "sha256": self.compiled_contract_sha256,
            "schemaVersion": self.compiled_contract["schemaVersion"],
            "status": self.compiled_contract["status"],
            "compilationRunId": self.compiled_contract["compilationRunId"],
        }
        self.baseline = self._baseline_config()
        self.evidence = self._evidence_bindings()
        output = self.root / self.output_namespace
        output.mkdir(parents=True)
        _write_json(
            output / "preflight-report.json",
            {
                "schemaVersion": (
                    "stage4-joint-condition-local-transport-controlled-smoke-"
                    "preflight-v1"
                ),
                "status": "all_preflight_checks_passed",
                "runId": self.run_id,
                "outputNamespace": self.output_namespace,
                "compiledContract": self.compiled_contract_binding,
                "checks": {
                    "cpuContract": True,
                    "activeConfigAudit": True,
                    "trainerReadonlyPreflight": True,
                    "cudaResource": True,
                    "diskCapacity": True,
                    "trainingOutputAbsent": True,
                },
                "ownerAuthorizationRequired": False,
                "ownerResponseRequired": False,
                "gpuStarted": False,
                "trainingStarted": False,
            },
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def _baseline_config() -> dict:
        return {
            "schemaVersion": "trainer-baseline-fixture-v1",
            "modelId": "baseline-fixture",
            "architectureVersion": "baseline-fixture",
            "status": "cpu_supported_inactive",
            "denoiserArchitecture": "stage4_multiscale_spatial_affine_conditioned_decoder_v1",
            "conditionChannels": 23,
            "latentChannels": 12,
            "denoiserBaseChannels": 64,
            "stage4SpatialAffineConditioningContract": {"fixture": True},
            "training": {
                "trainingAuthorizationStatus": "fixture_inactive",
                "denoiserEpochs": 24,
                "seed": 20263722,
                "denoiserLossVersion": "existing_formal_velocity_decoded_rgb_supervision_v1",
                "denoiserLossWeights": {"velocity": 1.0, "objectSemanticRgb": 1.0},
                "fixedEpochPreviewPolicy": {
                    "smoke": [1, 5, 10, 20, 24],
                    "formalStage": [1, 10, 20, 30, 40],
                },
                "activationGates": {},
            },
        }

    def _compiled_contract(self) -> dict:
        namespace = self.output_namespace
        return {
            "schemaVersion": (
                "stage4-joint-condition-local-transport-controlled-smoke-"
                "contract-v1"
            ),
            "status": "compiled_not_started",
            "authority": "local_ai_pet_world_program",
            "capabilityVersion": ARCHITECTURE_ID,
            "architectureId": ARCHITECTURE_ID,
            "compilationRunId": self.compilation_run_id,
            "executionIdentity": {
                "kind": "controlled_single_validation_sample_model_smoke",
                "runId": self.run_id,
                "sampleId": FIXED_VALIDATION_SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "topology": "west",
                "resolutionStage": 0,
                "resolution": {"width": 256, "height": 192},
                "latentResolution": {"width": 64, "height": 48},
                "epochCount": 30,
                "previewEpochs": [1, 5, 10, 20, 30],
                "initialization": (
                    "fixed_random_denoiser_initialization_without_checkpoint"
                ),
                "autoencoderFrozen": True,
            },
            "modelBoundary": {
                "conditionChannels": 23,
                "latentChannels": 12,
                "widths": [64, 128, 256],
                "timeEmbeddingChannels": 256,
                "transportSiteCount": 12,
                "transportParameterTensorCount": 24,
                "transportParameterCount": 22_464,
                "existingConditionFusionPreserved": True,
                "existingDiffusionObjectivePreserved": True,
                "newLossTermAdded": False,
                "freeArchitectureParameterChosen": False,
                "objectiveReviewAlignmentClaimed": False,
            },
            "frozenBoundaries": {
                "approvedSampleCount": 64,
                "splitCounts": {
                    "train": 48,
                    "validation": 8,
                    "challenge": 4,
                    "regression": 4,
                },
                "autoencoderIdentityFrozen": True,
                "lossValuesAndWeightsUnchanged": True,
                "checkpointFormatUnchanged": True,
                "machineReviewThresholdsUnchanged": True,
            },
            "internalCapability": {
                "issueAuthority": "local_ai_pet_world_program",
                "singleUse": True,
                "persistedReplayProtection": True,
                "cannotExpandContract": True,
                "ownerAuthorizationRequired": False,
                "ownerResponseRequired": False,
                "issueOnlyAfterAllPreflightChecksPass": True,
            },
            "futureEvidenceNamespace": {
                "outputDirectory": namespace,
                "activeConfig": f"{namespace}/active-config.json",
                "internalTicket": f"{namespace}/internal-ticket.json",
                "ticketConsumption": f"{namespace}/internal-ticket-consumption.json",
                "preflightReport": f"{namespace}/preflight-report.json",
                "trainingOutput": f"{namespace}/training-output",
                "progress": f"{namespace}/training-output/progress.json",
                "resourceTelemetry": f"{namespace}/training-output/resource-telemetry.json",
                "fixedPreviews": f"{namespace}/training-output/fixed-epoch-previews",
                "machineReviewTimeline": f"{namespace}/machine-review-timeline.json",
                "lateStabilityQualification": f"{namespace}/late-stability-qualification.json",
                "manifest": f"{namespace}/manifest.json",
                "finalization": f"{namespace}/finalization/finalization.json",
                "phaseTerminal": f"{namespace}/phase-terminal.json",
            },
            "outputOwnership": {
                "preflightCreatesRootAndPreflightOnly": True,
                "preflightMustNotCreateTrainingOutput": True,
                "trainerCreatesTrainingOutputExactlyOnce": True,
                "trainingOutputMustBeAbsentBeforeTrainerStart": True,
            },
            "evidenceIsolation": {
                "outputDirectoryMustNotExistBeforeExecution": True,
                "historicalDenoiserAccepted": False,
                "historicalCheckpointAccepted": False,
                "failedCheckpointAccepted": False,
                "historicalRunAccepted": False,
                "historicalOutputDirectoryAccepted": False,
                "partialTrainingArtifactAccepted": False,
                "crossCapabilityArtifactAccepted": False,
            },
            "prohibited": [
                "automatic_training_retry",
                "historical_or_failed_checkpoint_read",
                "reuse_exited_spatial_affine_candidate_identity",
            ],
        }

    def _bound_json(self, relative: str, value: dict) -> dict:
        path = self.root / relative
        _write_json(path, value)
        return {"path": relative, "sha256": _sha256(path)}

    def _bound_bytes(self, relative: str, value: bytes) -> dict:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)
        return {"path": relative, "sha256": _sha256(path)}

    def _evidence_bindings(self) -> dict:
        source = self._bound_json(
            "data/test/source-index.json",
            {"sampleCount": 1, "samples": [{"recordId": FIXED_VALIDATION_SAMPLE_ID}]},
        )
        manifest = self._bound_json("data/test/manifest.json", {"dataset": "fixed64"})
        condition = self._bound_json("data/test/condition-pack.json", {"sample": 194})
        reference = self._bound_bytes("data/test/reference.png", b"not-a-checkpoint")
        terminal_binding = self._bound_json(
            ".runtime/ai-painter/test-joint-readonly/phase-terminal.json",
            {
                "status": (
                    "stage4_joint_condition_local_transport_readonly_gpu_"
                    "qualification_succeeded"
                ),
                "capabilityVersion": ARCHITECTURE_ID,
                "nextLegalAction": (
                    "compile_and_execute_stage4_joint_condition_local_transport_"
                    "controlled_smoke"
                ),
                "ownerAuthorizationRequired": False,
                "ownerResponseRequired": False,
                "trainingStarted": False,
                "runId": "joint-readonly-fixture-0001",
            },
        )
        report_binding = self._bound_json(
            ".runtime/ai-painter/test-joint-readonly/report.json",
            {
                "status": "passed",
                "runId": "joint-readonly-fixture-0001",
                "capabilityVersion": ARCHITECTURE_ID,
            },
        )
        terminal_path = self.root / terminal_binding["path"]
        terminal = json.loads(terminal_path.read_text(encoding="utf-8"))
        terminal["qualificationReport"] = report_binding
        _write_json(terminal_path, terminal)
        terminal_binding["sha256"] = _sha256(terminal_path)
        return {
            "cpuSupportTerminal": {"path": "cpu-terminal.json", "sha256": "0" * 64},
            "formalObjectiveContract": {"path": "formal.json", "sha256": "1" * 64},
            "approvedDataset": {
                "datasetPackageId": "fixed-approved-64-fixture",
                "splitCounts": {
                    "train": 48,
                    "validation": 8,
                    "challenge": 4,
                    "regression": 4,
                },
                "manifest": manifest,
                "sourceIndex": source,
            },
            "qualificationSamples": {
                "firstTrain": {
                    "sampleId": "train-fixture",
                    "split": "train",
                    "conditionPack": condition,
                    "approvedReferenceRgb": reference,
                },
                "fixedValidation": {
                    "sampleId": FIXED_VALIDATION_SAMPLE_ID,
                    "split": "validation",
                    "conditionPack": condition,
                    "approvedReferenceRgb": reference,
                },
            },
            "autoencoderCheckpoint": {
                "path": "checkpoint-not-read.pt",
                "sha256": "2" * 64,
                "loadAllowed": True,
                "stateMutationAllowed": False,
            },
            "readonlyGpuQualification": {
                "terminal": terminal_binding,
                "report": report_binding,
                "runId": "joint-readonly-fixture-0001",
                "status": (
                    "stage4_joint_condition_local_transport_readonly_gpu_"
                    "qualification_succeeded"
                ),
            },
        }

    def _patches(self):
        return (
            patch.object(
                contract_module,
                "derive_joint_condition_local_transport_controlled_smoke_evidence_bindings",
                return_value=deepcopy(self.evidence),
            ),
            patch.object(
                contract_module,
                "compile_spatial_affine_decoder_cpu_inactive_config",
                return_value=deepcopy(self.baseline),
            ),
            patch.object(
                authorization_policy,
                "REGISTERED_HOT_RUNTIME_ROOT",
                self.root / ".runtime",
            ),
        )

    def _template(self) -> dict:
        evidence_patch, baseline_patch, _ = self._patches()
        with evidence_patch, baseline_patch:
            return build_joint_condition_local_transport_controlled_smoke_config_template(
                run_id=self.run_id,
                output_namespace=self.output_namespace,
                compiled_contract_path=self.compiled_contract_path,
                compiled_contract_sha256=self.compiled_contract_sha256,
                project_root=self.root,
            )

    def _issue(self):
        evidence_patch, baseline_patch, runtime_patch = self._patches()
        with evidence_patch, baseline_patch, runtime_patch:
            return issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket(
                dataset_package_id="fixed-approved-64-fixture",
                run_id=self.run_id,
                output_namespace=self.output_namespace,
                compiled_contract_path=self.compiled_contract_path,
                compiled_contract_sha256=self.compiled_contract_sha256,
                project_root=self.root,
            )

    def test_registry_exposes_new_fixed_validation_smoke_mode(self) -> None:
        spec = FORMAL_MODE_REGISTRY.resolve(
            JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_SMOKE_STATUS,
            ARCHITECTURE_ID,
        )
        self.assertEqual(spec.mode_id, "joint_condition_local_transport_stage4_smoke")
        self.assertEqual(spec.execution_kind, "single_sample_smoke")
        self.assertEqual(
            spec.adapter_binding,
            "joint_condition_local_transport_stage4_adapter",
        )
        self.assertEqual(spec.sample_split, "validation")
        self.assertTrue(spec.active_execution)

    def test_ticket_free_template_is_fixed_and_does_not_reuse_exited_identity(self) -> None:
        config = self._template()
        smoke = config["training"]["stage4JointConditionLocalTransportSmokeContract"]
        self.assertEqual(smoke["sampleId"], FIXED_VALIDATION_SAMPLE_ID)
        self.assertEqual(smoke["epochCount"], 30)
        self.assertEqual(smoke["optimizerStepCount"], 30)
        self.assertEqual(smoke["previewEpochs"], [1, 5, 10, 20, 30])
        self.assertFalse(smoke["objectiveReviewAlignmentClaimed"])
        self.assertTrue(smoke["formalMachineReviewRemainsAuthoritative"])
        self.assertNotIn("localAiCapabilityTicket", config["training"])
        self.assertNotIn("stage4FullBackboneSpatialAffineSmokeContract", config["training"])
        self.assertNotIn("stage4SpatialAffineConditioningContract", config)
        self.assertNotIn("fullBackboneSpatialAffineContract", config)
        self.assertEqual(
            config["training"]["denoiserLossWeights"],
            self.baseline["training"]["denoiserLossWeights"],
        )
        self.assertFalse(config["ownerAuthorizationRequired"])
        self.assertFalse(config["ownerResponseRequired"])
        self.assertNotIn("owner_wait", json.dumps(config).casefold())

    def test_one_time_ticket_and_policy_grant_are_bounded(self) -> None:
        active, identity = self._issue()
        evidence_patch, baseline_patch, runtime_patch = self._patches()
        with evidence_patch, baseline_patch, runtime_patch:
            result = validate_joint_condition_local_transport_controlled_smoke_config(
                active,
                project_root=self.root,
            )
            grant = resolve_stage_execution_grant(active, project_root=self.root)
        self.assertEqual(identity["executionState"], "consumed")
        self.assertTrue(identity["ticketId"].startswith("local-ai-joint-local-transport-smoke-"))
        self.assertEqual(result["epochCount"], 30)
        self.assertFalse(result["ownerAuthorizationRequired"])
        self.assertFalse(result["ownerResponseRequired"])
        self.assertEqual(
            sorted(action.value for action in grant.allowed_actions),
            result["allowedExecutionActions"],
        )
        self.assertFalse(grant.checkpoint_constraints["parentDenoiserAllowed"])
        self.assertEqual(grant.dataset_constraints["seed"], 20263722)
        self.assertEqual(grant.dataset_constraints["topology"], "west")
        output = self.root / self.output_namespace
        self.assertEqual(Path(identity["ticketPath"]).parent.as_posix(), self.output_namespace)
        self.assertTrue((output / "internal-ticket.json").is_file())
        self.assertTrue((output / "internal-ticket-consumption.json").is_file())

    def test_consumed_replay_is_idempotent_and_half_write_recovers(self) -> None:
        first_active, first_identity = self._issue()
        output = self.root / self.output_namespace
        consumption = output / "internal-ticket-consumption.json"
        expected_consumption = consumption.read_bytes()
        consumption.unlink()
        recovered_active, recovered_identity = self._issue()
        self.assertEqual(recovered_active, first_active)
        self.assertEqual(recovered_identity, first_identity)
        self.assertEqual(consumption.read_bytes(), expected_consumption)
        before = {
            path.name: (path.stat().st_mtime_ns, path.read_bytes())
            for path in output.iterdir()
        }
        replay_active, replay_identity = self._issue()
        after = {
            path.name: (path.stat().st_mtime_ns, path.read_bytes())
            for path in output.iterdir()
        }
        self.assertEqual(replay_active, first_active)
        self.assertEqual(replay_identity, first_identity)
        self.assertEqual(after, before)

    def test_forged_half_ticket_is_rejected(self) -> None:
        self._issue()
        output = self.root / self.output_namespace
        (output / "internal-ticket-consumption.json").unlink()
        ticket_path = output / "internal-ticket.json"
        ticket = json.loads(ticket_path.read_text(encoding="utf-8"))
        ticket["binding"]["runId"] = "forged-joint-local-transport-smoke-0001"
        _write_json(ticket_path, ticket)
        with self.assertRaisesRegex(ValueError, "immutable bytes are invalid"):
            self._issue()

    def test_exited_affine_compiled_contract_schema_is_rejected(self) -> None:
        compiled_path = self.root / self.compiled_contract_path
        old = deepcopy(self.compiled_contract)
        old["schemaVersion"] = (
            "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1"
        )
        _write_json(compiled_path, old)
        old_sha256 = _sha256(compiled_path)
        evidence_patch, baseline_patch, _ = self._patches()
        with evidence_patch, baseline_patch, self.assertRaisesRegex(
            ValueError,
            "compiled Smoke identity is invalid",
        ):
            build_joint_condition_local_transport_controlled_smoke_config_template(
                run_id=self.run_id,
                output_namespace=self.output_namespace,
                compiled_contract_path=self.compiled_contract_path,
                compiled_contract_sha256=old_sha256,
                project_root=self.root,
            )

    def test_identity_owner_wait_loss_and_old_candidate_mutations_fail_closed(self) -> None:
        mutations = (
            lambda value: value["training"][
                "stage4JointConditionLocalTransportSmokeContract"
            ].__setitem__("epochCount", 31),
            lambda value: value.__setitem__("ownerResponseRequired", True),
            lambda value: value["training"]["denoiserLossWeights"].__setitem__(
                "velocity", 0.5
            ),
            lambda value: value["training"].__setitem__(
                "stage4FullBackboneSpatialAffineSmokeContract", {}
            ),
            lambda value: value["executionIdentity"].__setitem__(
                "outputNamespace",
                f"{CONTROLLED_SMOKE_OUTPUT_ROOT}/another-joint-smoke-run-0001",
            ),
        )
        for mutate in mutations:
            config = self._template()
            mutate(config)
            evidence_patch, baseline_patch, _ = self._patches()
            with evidence_patch, baseline_patch, self.assertRaises(ValueError):
                validate_joint_condition_local_transport_controlled_smoke_config(
                    config,
                    project_root=self.root,
                    require_execution_ticket=False,
                )

    def test_preflight_failure_or_injected_output_cannot_issue_ticket(self) -> None:
        report_path = self.root / self.output_namespace / "preflight-report.json"
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["checks"]["trainerReadonlyPreflight"] = False
        _write_json(report_path, report)
        with self.assertRaisesRegex(ValueError, "did not prove every gate"):
            self._issue()

        report["checks"]["trainerReadonlyPreflight"] = True
        _write_json(report_path, report)
        (self.root / self.output_namespace / "old-candidate.pt").write_bytes(b"forbidden")
        with self.assertRaisesRegex(ValueError, "reused or injected"):
            self._issue()


if __name__ == "__main__":
    unittest.main()

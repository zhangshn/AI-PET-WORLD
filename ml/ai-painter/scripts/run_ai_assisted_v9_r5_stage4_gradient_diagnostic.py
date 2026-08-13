from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import time
import traceback

import torch

from ai_painter.complete_world import add_noise, build_complete_world_system, velocity_target
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v9-stage4-readonly-gpu-gradient-diagnostic-20260809.json"
)
IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v9-stage4-readonly-gpu-gradient-diagnostic-20260809/"
    "implementation-consumption.json"
)
RUNNER_PATH = Path("ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py")
CPU_CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py")
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SAMPLE_SPLIT = "validation"
SEED = 20263722
TIMESTEP = 999
IMAGE_SIZE = (256, 192)
OBJECT_CHANNELS = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
REQUEST_ID = "owner-authorized-v9-stage4-readonly-gpu-gradient-diagnostic-20260809"
SCOPE = "one_v9_sample194_readonly_gpu_forward_autograd_gradient_routing_diagnostic_only"
AUTHORIZATION_SHA256 = "95d8dc1ef85d9af42618c43d74e7661d62e58acbca0365c02f4f789c2a07aee2"
STRUCTURE_FACT_IMPLEMENTATION_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-structure-fact-first-loss-registry-correction-20260810-230203646/"
    "implementation-authorization.json"
)
STRUCTURE_FACT_IMPLEMENTATION_CONSUMPTION_PATH = (
    STRUCTURE_FACT_IMPLEMENTATION_AUTHORIZATION_PATH.parent / "implementation-consumption.json"
)
STRUCTURE_FACT_AUTHORIZATION_PATH = (
    STRUCTURE_FACT_IMPLEMENTATION_AUTHORIZATION_PATH.parent / "gpu-execution-authorization.json"
)
STRUCTURE_FACT_REQUEST_ID = (
    "owner-authorized-stage4-structure-fact-first-loss-registry-correction-20260810-230203646"
)
STRUCTURE_FACT_SCOPE = (
    "one_structure_fact_first_sample194_readonly_gpu_forward_autograd_gradient_routing_diagnostic_only"
)
STRUCTURE_FACT_ARCHITECTURE = "stage4_structure_fact_first_dual_stage_generator_v1"
STRUCTURE_FACT_CHANNELS = (
    "terrain_path_ground", "route_required_boundary", "object_footprints",
    "object_tree", "object_rock", "object_vegetation",
)
STRUCTURE_FACT_STAGE_B_SCALES = ("level0", "level1", "middle", "up1", "up0")
SEMANTIC_MIXTURE_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-fact-conditioned-semantic-mixture-readonly-gpu-diagnostic-20260812-010708248/"
    "authorization.json"
)
SEMANTIC_MIXTURE_IMPLEMENTATION_CONSUMPTION_PATH = (
    SEMANTIC_MIXTURE_AUTHORIZATION_PATH.parent / "implementation-consumption.json"
)
SEMANTIC_MIXTURE_REQUEST_ID = (
    "owner-authorized-stage4-fact-conditioned-semantic-mixture-readonly-gpu-diagnostic-"
    "20260812-010708248"
)
SEMANTIC_MIXTURE_COMMAND_REF = (
    "stage4-fact-conditioned-semantic-mixture-readonly-gpu-diagnostic-20260812-010708248"
)
SEMANTIC_MIXTURE_SCOPE = (
    "implement_support_preflight_and_execute_one_fact_conditioned_semantic_mixture_"
    "readonly_gpu_causal_gradient_diagnostic_only"
)
SEMANTIC_MIXTURE_ARCHITECTURE = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
SEMANTIC_MIXTURE_IDENTITIES = ("route", "footprints", "tree", "rock", "vegetation")
FINAL_VISIBLE_RGB_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-final-visible-rgb-readonly-gpu-qualification-20260812-232610475/"
    "gpu-execution-authorization.json"
)
FINAL_VISIBLE_RGB_IMPLEMENTATION_CONSUMPTION_PATH = (
    FINAL_VISIBLE_RGB_AUTHORIZATION_PATH.parent / "implementation-consumption.json"
)
FINAL_VISIBLE_RGB_REQUEST_ID = (
    "owner-authorized-stage4-final-visible-rgb-readonly-gpu-qualification-20260812-232610475"
)
FINAL_VISIBLE_RGB_SCOPE = (
    "one_stage4_per_class_final_visible_rgb_obligation_readonly_gpu_gradient_qualification_only"
)
FINAL_VISIBLE_RGB_CONTRACT_ID = "stage4_per_class_final_visible_rgb_obligation_v1"
VEGETATION_REPAIR_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-vegetation-final-visible-readonly-gpu-qualification-"
    "20260813-031000000/gpu-execution-authorization.json"
)
VEGETATION_REPAIR_IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-vegetation-final-visible-semantic-repair-"
    "20260813-025311970/implementation-consumption-corrected.json"
)
VEGETATION_REPAIR_REQUEST_ID = (
    "owner-authorized-stage4-vegetation-final-visible-readonly-gpu-qualification-"
    "20260813-031000000"
)
VEGETATION_REPAIR_SCOPE = (
    "one_stage4_vegetation_final_visible_semantic_repair_readonly_gpu_gradient_"
    "qualification_only"
)
VEGETATION_REPAIR_CONTRACT_ID = "stage4_vegetation_final_visible_semantic_repair_v1"
VEGETATION_LUMINANCE_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-vegetation-luminance-spatial-readonly-gpu-qualification-"
    "20260813-035000000/gpu-execution-authorization.json"
)
VEGETATION_LUMINANCE_IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-"
    "20260813-034000000/implementation-consumption.json"
)
VEGETATION_LUMINANCE_REQUEST_ID = (
    "owner-authorized-stage4-vegetation-luminance-spatial-readonly-gpu-qualification-"
    "20260813-035000000"
)
VEGETATION_LUMINANCE_SCOPE = (
    "one_stage4_vegetation_luminance_spatial_structure_readonly_gpu_gradient_"
    "qualification_only"
)
VEGETATION_LUMINANCE_CONTRACT_ID = (
    "stage4_vegetation_luminance_spatial_structure_supervision_v1"
)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--implementation-attestation", type=Path)
    parser.add_argument("--cpu-contract-only", action="store_true")
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--python-report", type=Path)
    parser.add_argument("--resource-report", type=Path)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    authorization = validate_authorization(args.authorization)
    if args.cpu_contract_only:
        if any((args.implementation_attestation, args.python_report, args.resource_report, args.output_dir)):
            raise ValueError("cpu_contract_check_must_not_receive_execution_paths")
        print(json.dumps({
            "status": (
                "stage4_vegetation_luminance_spatial_gpu_diagnostic_authorization_contract_valid_cpu_only"
                if is_vegetation_luminance_authorization(authorization)
                else (
                "stage4_vegetation_final_visible_gpu_diagnostic_authorization_contract_valid_cpu_only"
                if is_vegetation_repair_authorization(authorization)
                else (
                "stage4_final_visible_rgb_gpu_diagnostic_authorization_contract_valid_cpu_only"
                if is_final_visible_rgb_authorization(authorization)
                else (
                    "fact_conditioned_semantic_mixture_gpu_diagnostic_authorization_contract_valid_cpu_only"
                    if is_semantic_mixture_authorization(authorization)
                    else (
                        "structure_fact_first_gpu_diagnostic_authorization_contract_valid_cpu_only"
                        if is_structure_fact_authorization(authorization)
                        else "v9_gpu_diagnostic_authorization_contract_valid_cpu_only"
                    )
                )))
            ),
            "requestId": authorization_request_id(authorization),
            "sampleId": SAMPLE_ID,
            "gpuUsed": False,
        }, ensure_ascii=False, indent=2))
        return 0
    attestation = validate_implementation_attestation(args.implementation_attestation, authorization)
    if args.preflight_only:
        if args.output_dir is not None or args.python_report is None or args.resource_report is None:
            raise ValueError("preflight_paths_invalid")
        return write_preflight_reports(authorization, attestation, args.python_report, args.resource_report)
    if args.output_dir is None or args.python_report is not None or args.resource_report is not None:
        raise ValueError("gpu_execution_arguments_invalid")
    return consume_and_run(args.authorization, authorization, attestation, args.output_dir)


def validate_authorization(path: Path) -> dict:
    resolved = resolve(path)
    if resolved == resolve(VEGETATION_LUMINANCE_AUTHORIZATION_PATH):
        authorization = read_json(resolved)
        validate_authorization_document(authorization, verify_bindings=True)
        consumption = read_json(resolve(VEGETATION_LUMINANCE_IMPLEMENTATION_CONSUMPTION_PATH))
        if (
            consumption.get("status") != "implementation_authorization_atomically_consumed"
            or consumption.get("requestId")
            != "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-20260813-034000000"
            or consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("vegetation_luminance_diagnostic_implementation_consumption_invalid")
        authorization["_diagnosticMode"] = "vegetation_luminance_spatial_structure"
        authorization["_authorizationPath"] = project_path(resolved)
        authorization["_authorizationSha256"] = sha256_file(resolved)
        return authorization
    if resolved == resolve(VEGETATION_REPAIR_AUTHORIZATION_PATH):
        authorization = read_json(resolved)
        validate_authorization_document(authorization, verify_bindings=True)
        consumption = read_json(resolve(VEGETATION_REPAIR_IMPLEMENTATION_CONSUMPTION_PATH))
        if (
            consumption.get("status")
            != "implementation_authorization_atomically_consumed_corrected_record"
            or consumption.get("requestId")
            != "owner-authorized-stage4-vegetation-final-visible-semantic-repair-20260813-025311970"
            or consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("vegetation_repair_diagnostic_implementation_consumption_invalid")
        authorization["_diagnosticMode"] = "vegetation_final_visible_semantic_repair"
        authorization["_authorizationPath"] = project_path(resolved)
        authorization["_authorizationSha256"] = sha256_file(resolved)
        return authorization
    if resolved == resolve(FINAL_VISIBLE_RGB_AUTHORIZATION_PATH):
        authorization = read_json(resolved)
        validate_authorization_document(authorization, verify_bindings=True)
        consumption = read_json(resolve(FINAL_VISIBLE_RGB_IMPLEMENTATION_CONSUMPTION_PATH))
        if (
            consumption.get("status")
            != "stage4_final_visible_rgb_readonly_gpu_qualification_implementation_authorization_atomically_consumed"
            or consumption.get("requestId") != FINAL_VISIBLE_RGB_REQUEST_ID
            or consumption.get("commandRef") != FINAL_VISIBLE_RGB_REQUEST_ID
            or consumption.get("scope")
            != "extend_existing_v9_readonly_gpu_diagnostic_for_per_class_final_visible_rgb_obligation_only"
            or consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("final_visible_rgb_diagnostic_implementation_consumption_invalid")
        authorization["_diagnosticMode"] = "final_visible_rgb_obligation"
        authorization["_authorizationPath"] = project_path(resolved)
        authorization["_authorizationSha256"] = sha256_file(resolved)
        return authorization
    if resolved == resolve(SEMANTIC_MIXTURE_AUTHORIZATION_PATH):
        authorization = read_json(resolved)
        validate_authorization_document(authorization, verify_bindings=True)
        consumption = read_json(resolve(SEMANTIC_MIXTURE_IMPLEMENTATION_CONSUMPTION_PATH))
        if (
            consumption.get("status")
            != "stage4_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_implementation_authorization_atomically_consumed"
            or consumption.get("requestId") != SEMANTIC_MIXTURE_REQUEST_ID
            or consumption.get("commandRef") != SEMANTIC_MIXTURE_COMMAND_REF
            or consumption.get("scope") != SEMANTIC_MIXTURE_SCOPE
            or consumption.get("authorizationSha256") != sha256_file(resolved)
            or consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("semantic_mixture_diagnostic_implementation_consumption_invalid")
        authorization["_diagnosticMode"] = "fact_conditioned_semantic_mixture"
        authorization["_authorizationPath"] = project_path(resolved)
        authorization["_authorizationSha256"] = sha256_file(resolved)
        return authorization
    if resolved == resolve(STRUCTURE_FACT_AUTHORIZATION_PATH):
        authorization = read_json(resolved)
        validate_authorization_document(authorization, verify_bindings=True)
        implementation_authorization_sha = sha256_file(
            resolve(STRUCTURE_FACT_IMPLEMENTATION_AUTHORIZATION_PATH)
        )
        consumption = read_json(resolve(STRUCTURE_FACT_IMPLEMENTATION_CONSUMPTION_PATH))
        if (
            consumption.get("status")
            != "structure_fact_first_loss_registry_correction_atomically_consumed"
            or consumption.get("requestId") != STRUCTURE_FACT_REQUEST_ID
            or consumption.get("commandRef") != STRUCTURE_FACT_REQUEST_ID
            or consumption.get("authorizationSha256") != implementation_authorization_sha
            or consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("structure_fact_diagnostic_implementation_consumption_invalid")
        authorization["_diagnosticMode"] = "structure_fact_first"
        authorization["_authorizationPath"] = project_path(resolved)
        authorization["_authorizationSha256"] = sha256_file(resolved)
        return authorization
    if resolved != resolve(AUTHORIZATION_PATH) or sha256_file(resolved) != AUTHORIZATION_SHA256:
        raise ValueError("v9_diagnostic_owner_authorization_identity_invalid")
    authorization = read_json(resolved)
    validate_authorization_document(authorization, verify_bindings=True)
    consumption = read_json(resolve(IMPLEMENTATION_CONSUMPTION_PATH))
    if (
        consumption.get("status") != "v9_readonly_gpu_diagnostic_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != REQUEST_ID
        or consumption.get("commandRef") != REQUEST_ID
        or consumption.get("scope") != SCOPE
        or consumption.get("authorizationSha256") != AUTHORIZATION_SHA256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("v9_diagnostic_implementation_consumption_invalid")
    authorization["_diagnosticMode"] = "legacy_v9"
    authorization["_authorizationPath"] = project_path(resolved)
    authorization["_authorizationSha256"] = AUTHORIZATION_SHA256
    return authorization


def validate_authorization_document(authorization: dict, verify_bindings: bool) -> None:
    if authorization.get("schemaVersion") == (
        "ai-painter-owner-stage4-vegetation-luminance-spatial-readonly-gpu-qualification-v1"
    ):
        validate_vegetation_luminance_authorization_document(authorization, verify_bindings)
        return
    if authorization.get("schemaVersion") == (
        "ai-painter-owner-stage4-vegetation-final-visible-readonly-gpu-qualification-v1"
    ):
        validate_vegetation_repair_authorization_document(authorization, verify_bindings)
        return
    if authorization.get("schemaVersion") == (
        "ai-painter-owner-stage4-final-visible-rgb-readonly-gpu-qualification-v1"
    ):
        validate_final_visible_rgb_authorization_document(authorization, verify_bindings)
        return
    if authorization.get("schemaVersion") == (
        "ai-painter-owner-stage4-fact-conditioned-semantic-mixture-readonly-gpu-diagnostic-v1"
    ):
        validate_semantic_mixture_authorization_document(authorization, verify_bindings)
        return
    if authorization.get("schemaVersion") == "ai-painter-owner-stage4-structure-fact-first-gradient-diagnostic-gpu-authorization-v1":
        validate_structure_fact_authorization_document(authorization, verify_bindings)
        return
    if (
        authorization.get("schemaVersion") != "ai-painter-owner-action-request-v1"
        or authorization.get("requestId") != REQUEST_ID
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != REQUEST_ID
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("v9_diagnostic_owner_command_contract_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "architectureId": "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "objectSemanticChannels": list(OBJECT_CHANNELS),
        "diagnosticManifestMetricCount": 17,
        "denoiserInitialization": "fixed_random_v9_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"v9_diagnostic_task_identity_invalid:{key}")
    expected_actions = {
        "v9DiagnosticRunnerImplementation": True,
        "v9DiagnosticCpuCheckerImplementation": True,
        "cpuPositiveNegativeAuthorizationRegression": True,
        "pythonPreflight": True,
        "cudaResourcePreflight": True,
        "diskBudgetPreflight": True,
        "projectAutoencoderCheckpointReadAndLoad": True,
        "v9FixedRandomInitialization": True,
        "singleSampleValidationRead": True,
        "singleGpuForward": True,
        "torchAutogradGradInspection": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "uniquePlanUpdate": True,
        "oldV7OrV8DenoiserCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage1OrStage2": False,
        "strictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }
    if authorization.get("authorizedActions") != expected_actions:
        raise ValueError("v9_diagnostic_action_boundary_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("v9_diagnostic_failure_policy_invalid")
    if not verify_bindings:
        return
    for key in (
        "v9CpuTerminal", "v9InactiveConfig", "v9CpuReport", "v9SupportContract",
        "model", "trainer", "datasetImplementation", "datasetManifest",
        "datasetSourceIndex", "projectAutoencoderCheckpoint",
    ):
        binding_value = authorization.get("bindings", {}).get(key, {})
        if binding_value.get("sha256") != sha256_file(resolve(Path(binding_value.get("path", "missing")))):
            raise ValueError(f"v9_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["v9CpuTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["v9CpuReport"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["v9SupportContract"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
    if (
        terminal.get("status") != "v9_stage4_cpu_support_and_manifest_registry_completed_closed"
        or report.get("status") != "passed_cpu_only_v9_object_semantic_alignment_not_active"
        or support.get("status") != "v9_cpu_support_verified_inactive_gpu_not_started"
        or config.get("denoiserArchitecture") != expected_identity["architectureId"]
    ):
        raise ValueError("v9_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))


def validate_final_visible_rgb_authorization_document(
    authorization: dict, verify_bindings: bool,
) -> None:
    if (
        authorization.get("status") != "owner_authorized_unconsumed"
        or authorization.get("requestId") != FINAL_VISIBLE_RGB_REQUEST_ID
        or authorization.get("commandRef") != FINAL_VISIBLE_RGB_REQUEST_ID
        or authorization.get("scope") != FINAL_VISIBLE_RGB_SCOPE
    ):
        raise ValueError("final_visible_rgb_diagnostic_owner_identity_invalid")
    expected_identity = {
        "architectureId": SEMANTIC_MIXTURE_ARCHITECTURE,
        "trainingObjectiveContractId": FINAL_VISIBLE_RGB_CONTRACT_ID,
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "obligationIdentities": list(SEMANTIC_MIXTURE_IDENTITIES),
        "diagnosticManifestMetricCount": 27,
        "denoiserInitialization": "fixed_random_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    if authorization.get("taskIdentity") != expected_identity:
        raise ValueError("final_visible_rgb_diagnostic_task_identity_invalid")
    if authorization.get("executionActions") != {
        "projectAutoencoderCheckpointReadAndLoadFrozen": True,
        "fixedRandomDenoiserInitialization": True,
        "singleSampleValidationRead": True,
        "singleReadonlyCudaForward": True,
        "torchAutogradGradInspection": True,
        "fiveFinalVisibleRgbObligationVerification": True,
        "exactTwentySevenDiagnosticManifestExport": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "uniquePlanAndTaskCapsuleSync": True,
        "oldDenoiserOrDiagnosticCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage5StrictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }:
        raise ValueError("final_visible_rgb_diagnostic_execution_actions_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("final_visible_rgb_diagnostic_failure_policy_invalid")
    if not verify_bindings:
        return
    required_bindings = (
        "cpuTerminal", "cpuReport", "configurationAudit", "supportContract",
        "inactiveConfig", "model", "trainer", "compiler", "modeRegistry",
        "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint",
        "implementationAuthorization", "implementationConsumption", "runner", "cpuChecker",
    )
    for key in required_bindings:
        binding_value = authorization.get("bindings", {}).get(key, {})
        path = Path(binding_value.get("path", "missing"))
        if binding_value.get("sha256") != sha256_file(resolve(path)):
            raise ValueError(f"final_visible_rgb_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["cpuTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["cpuReport"]["path"])))
    audit = read_json(resolve(Path(authorization["bindings"]["configurationAudit"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["supportContract"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
    if (
        terminal.get("status")
        != "stage4_per_class_final_visible_rgb_obligation_cpu_succeeded_closed"
        or report.get("status")
        != "stage4_per_class_final_visible_rgb_obligation_cpu_regression_passed"
        or audit.get("status")
        != "stage4_per_class_final_visible_rgb_obligation_configuration_audit_passed"
        or support.get("status")
        != "stage4_per_class_final_visible_rgb_obligation_cpu_support_verified_inactive"
        or config.get("denoiserArchitecture") != SEMANTIC_MIXTURE_ARCHITECTURE
    ):
        raise ValueError("final_visible_rgb_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))
    objective = trainer.validate_stage4_per_class_final_visible_rgb_obligation(config)
    if objective.get("status") != (
        "stage4_per_class_final_visible_rgb_obligation_cpu_contract_valid_inactive"
    ):
        raise ValueError("final_visible_rgb_diagnostic_objective_contract_invalid")


def validate_vegetation_repair_authorization_document(
    authorization: dict, verify_bindings: bool,
) -> None:
    if (
        authorization.get("status") != "owner_authorized_unconsumed"
        or authorization.get("requestId") != VEGETATION_REPAIR_REQUEST_ID
        or authorization.get("commandRef") != VEGETATION_REPAIR_REQUEST_ID
        or authorization.get("scope") != VEGETATION_REPAIR_SCOPE
    ):
        raise ValueError("vegetation_repair_diagnostic_owner_identity_invalid")
    expected_identity = {
        "architectureId": SEMANTIC_MIXTURE_ARCHITECTURE,
        "trainingObjectiveContractId": VEGETATION_REPAIR_CONTRACT_ID,
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "sourceChannel": "object_vegetation",
        "diagnosticManifestMetricCount": 28,
        "denoiserInitialization": "fixed_random_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    if authorization.get("taskIdentity") != expected_identity:
        raise ValueError("vegetation_repair_diagnostic_task_identity_invalid")
    if authorization.get("executionActions") != {
        "projectAutoencoderCheckpointReadAndLoadFrozen": True,
        "fixedRandomDenoiserInitialization": True,
        "singleSampleValidationRead": True,
        "singleReadonlyCudaForward": True,
        "torchAutogradGradInspection": True,
        "fiveFinalVisibleRgbObligationVerification": True,
        "vegetationFinalVisibleEdgeStructureVerification": True,
        "exactTwentyEightDiagnosticManifestExport": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "localTaskCapsuleEventLedgerSqliteSync": True,
        "oldDenoiserOrDiagnosticCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage5StrictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }:
        raise ValueError("vegetation_repair_diagnostic_execution_actions_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("vegetation_repair_diagnostic_failure_policy_invalid")
    if not verify_bindings:
        return
    required_bindings = (
        "cpuTerminal", "cpuReport", "supportContract", "inactiveConfig", "model",
        "trainer", "compiler", "modeRegistry", "datasetManifest", "datasetSourceIndex",
        "projectAutoencoderCheckpoint", "implementationAuthorization",
        "implementationConsumption", "runner", "cpuChecker",
    )
    for key in required_bindings:
        value = authorization.get("bindings", {}).get(key, {})
        if value.get("sha256") != sha256_file(resolve(Path(value.get("path", "missing")))):
            raise ValueError(f"vegetation_repair_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["cpuTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["cpuReport"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["supportContract"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
    if (
        terminal.get("status")
        != "stage4_vegetation_final_visible_semantic_repair_cpu_succeeded_closed"
        or report.get("status")
        != "stage4_vegetation_final_visible_semantic_repair_cpu_regression_passed"
        or support.get("status")
        != "stage4_vegetation_final_visible_semantic_repair_cpu_support_verified_inactive"
        or config.get("denoiserArchitecture") != SEMANTIC_MIXTURE_ARCHITECTURE
    ):
        raise ValueError("vegetation_repair_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))
    trainer.validate_stage4_vegetation_final_visible_semantic_repair(config)


def validate_vegetation_luminance_authorization_document(
    authorization: dict, verify_bindings: bool,
) -> None:
    if (
        authorization.get("status") != "owner_authorized_unconsumed"
        or authorization.get("requestId") != VEGETATION_LUMINANCE_REQUEST_ID
        or authorization.get("commandRef") != VEGETATION_LUMINANCE_REQUEST_ID
        or authorization.get("scope") != VEGETATION_LUMINANCE_SCOPE
    ):
        raise ValueError("vegetation_luminance_diagnostic_owner_identity_invalid")
    expected_identity = {
        "architectureId": SEMANTIC_MIXTURE_ARCHITECTURE,
        "trainingObjectiveContractId": VEGETATION_LUMINANCE_CONTRACT_ID,
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "sourceChannel": "object_vegetation",
        "diagnosticManifestMetricCount": 29,
        "denoiserInitialization": "fixed_random_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    if authorization.get("taskIdentity") != expected_identity:
        raise ValueError("vegetation_luminance_diagnostic_task_identity_invalid")
    if authorization.get("executionActions") != {
        "projectAutoencoderCheckpointReadAndLoadFrozen": True,
        "fixedRandomDenoiserInitialization": True,
        "singleSampleValidationRead": True,
        "singleReadonlyCudaForward": True,
        "torchAutogradGradInspection": True,
        "fiveFinalVisibleRgbObligationVerification": True,
        "vegetationFinalVisibleLuminanceSpatialVerification": True,
        "exactTwentyNineDiagnosticManifestExport": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "localTaskCapsuleEventLedgerSqliteSync": True,
        "oldDenoiserOrDiagnosticCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage5StrictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }:
        raise ValueError("vegetation_luminance_diagnostic_execution_actions_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("vegetation_luminance_diagnostic_failure_policy_invalid")
    if not verify_bindings:
        return
    required_bindings = (
        "cpuTerminal", "cpuReport", "supportContract", "inactiveConfig", "model",
        "trainer", "compiler", "modeRegistry", "datasetManifest", "datasetSourceIndex",
        "projectAutoencoderCheckpoint", "implementationAuthorization",
        "implementationConsumption", "runner", "cpuChecker",
    )
    for key in required_bindings:
        value = authorization.get("bindings", {}).get(key, {})
        if value.get("sha256") != sha256_file(resolve(Path(value.get("path", "missing")))):
            raise ValueError(f"vegetation_luminance_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["cpuTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["cpuReport"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["supportContract"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
    if (
        terminal.get("status")
        != "stage4_vegetation_luminance_spatial_structure_cpu_succeeded_closed"
        or report.get("status")
        != "stage4_vegetation_luminance_spatial_structure_cpu_regression_passed"
        or support.get("status")
        != "stage4_vegetation_luminance_spatial_structure_cpu_support_verified_inactive"
        or config.get("denoiserArchitecture") != SEMANTIC_MIXTURE_ARCHITECTURE
    ):
        raise ValueError("vegetation_luminance_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))
    trainer.validate_stage4_vegetation_luminance_spatial_structure_supervision(config)


def validate_semantic_mixture_authorization_document(
    authorization: dict, verify_bindings: bool,
) -> None:
    if (
        authorization.get("status") != "owner_authorized_unconsumed"
        or authorization.get("requestId") != SEMANTIC_MIXTURE_REQUEST_ID
        or authorization.get("commandRef") != SEMANTIC_MIXTURE_COMMAND_REF
        or authorization.get("scope") != SEMANTIC_MIXTURE_SCOPE
    ):
        raise ValueError("semantic_mixture_diagnostic_owner_identity_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "architectureId": SEMANTIC_MIXTURE_ARCHITECTURE,
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "expertIdentities": list(SEMANTIC_MIXTURE_IDENTITIES),
        "diagnosticManifestMetricCount": 17,
        "denoiserInitialization": "fixed_random_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    if identity != expected_identity:
        raise ValueError("semantic_mixture_diagnostic_task_identity_invalid")
    if authorization.get("implementationActions") != {
        "extendExistingGradientDiagnosticRunner": True,
        "extendExistingCpuChecker": True,
        "cpuPositiveNegativeRegression": True,
        "realPythonPreflight": True,
        "cudaResourceAndDiskPreflight": True,
    }:
        raise ValueError("semantic_mixture_diagnostic_implementation_actions_invalid")
    if authorization.get("executionActions") != {
        "projectAutoencoderCheckpointReadAndLoadFrozen": True,
        "fixedRandomDenoiserInitialization": True,
        "singleSampleValidationRead": True,
        "singleReadonlyCudaForward": True,
        "torchAutogradGradInspection": True,
        "fiveExpertCausalAndGradientVerification": True,
        "exactSeventeenDiagnosticManifestExport": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "uniquePlanAndTaskCapsuleSync": True,
        "oldDenoiserCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage5StrictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }:
        raise ValueError("semantic_mixture_diagnostic_execution_actions_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("semantic_mixture_diagnostic_failure_policy_invalid")
    if authorization.get("implementationBefore") != {
        "runner": {
            "path": "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
            "sha256": "cec40d45ae5b3874d1a9e39ba153a303bbcbcff485ad22a9c12bc52de95b45fc",
        },
        "cpuChecker": {
            "path": "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
            "sha256": "645e972999178705749284f800f2cb415787587a1d798d2625ea84c52d299b82",
        },
    }:
        raise ValueError("semantic_mixture_diagnostic_implementation_before_invalid")
    if not verify_bindings:
        return
    required_bindings = (
        "cpuTerminal", "inactiveConfig", "cpuReport", "supportContract",
        "ownerActionRequest", "model", "trainer", "modeRegistry", "datasetManifest",
        "datasetSourceIndex", "projectAutoencoderCheckpoint",
    )
    for key in required_bindings:
        binding_value = authorization.get("bindings", {}).get(key, {})
        path = Path(binding_value.get("path", "missing"))
        if binding_value.get("sha256") != sha256_file(resolve(path)):
            raise ValueError(f"semantic_mixture_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["cpuTerminal"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["cpuReport"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["supportContract"]["path"])))
    if (
        terminal.get("status")
        != "stage4_fact_conditioned_semantic_mixture_decoder_cpu_support_completed_inactive_closed"
        or config.get("denoiserArchitecture") != SEMANTIC_MIXTURE_ARCHITECTURE
        or report.get("status")
        != "stage4_fact_conditioned_semantic_mixture_cpu_regression_passed"
        or support.get("status")
        != "cpu_support_verified_inactive_not_authorized_for_gpu_or_training"
    ):
        raise ValueError("semantic_mixture_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))


def validate_structure_fact_authorization_document(authorization: dict, verify_bindings: bool) -> None:
    if (
        authorization.get("requestId") != STRUCTURE_FACT_REQUEST_ID
        or authorization.get("commandRef") != STRUCTURE_FACT_REQUEST_ID
        or authorization.get("scope") != STRUCTURE_FACT_SCOPE
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
    ):
        raise ValueError("structure_fact_diagnostic_owner_command_contract_invalid")
    expected_identity = {
        "architectureId": STRUCTURE_FACT_ARCHITECTURE,
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "structureChannels": list(STRUCTURE_FACT_CHANNELS),
        "stageBInjectionScales": list(STRUCTURE_FACT_STAGE_B_SCALES),
        "conditionChannelCount": 23,
        "diagnosticManifestMetricCount": 17,
        "denoiserInitialization": "fixed_random_structure_fact_first_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    identity = authorization.get("taskIdentity", {})
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"structure_fact_diagnostic_task_identity_invalid:{key}")
    expected_actions = {
        "cpuRegressionVerification": True,
        "pythonPreflight": True,
        "cudaResourcePreflight": True,
        "diskBudgetPreflight": True,
        "projectAutoencoderCheckpointReadAndLoad": True,
        "structureFactFirstFixedRandomInitialization": True,
        "singleSampleValidationRead": True,
        "singleGpuForward": True,
        "torchAutogradGradInspection": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "localTaskCapsuleWrite": True,
        "uniquePlanUpdate": True,
        "codeModification": False,
        "oldV7V8V9DenoiserCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage1OrStage2": False,
        "strictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }
    if authorization.get("authorizedActions") != expected_actions:
        raise ValueError("structure_fact_diagnostic_action_boundary_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("structure_fact_diagnostic_failure_policy_invalid")
    if not verify_bindings:
        return
    binding_keys = (
        "cpuTerminal", "inactiveConfig", "cpuReport", "supportContract", "ownerActionRequest",
        "projectAutoencoderCheckpoint", "model", "trainer", "modeRegistry", "runner",
        "cpuChecker", "datasetManifest", "datasetSourceIndex",
        "implementationAuthorization", "implementationConsumption",
    )
    for key in binding_keys:
        value = authorization.get("bindings", {}).get(key, {})
        if value.get("sha256") != sha256_file(resolve(Path(value.get("path", "missing")))):
            raise ValueError(f"structure_fact_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["cpuTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["cpuReport"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["supportContract"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
    if (
        terminal.get("status") != "stage4_structure_fact_first_dual_stage_cpu_support_completed_closed"
        or report.get("status") != "passed_cpu_only_structure_fact_first_dual_stage_inactive"
        or support.get("status") != "structure_fact_first_dual_stage_cpu_supported_inactive"
        or config.get("denoiserArchitecture") != STRUCTURE_FACT_ARCHITECTURE
    ):
        raise ValueError("structure_fact_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))


def validate_implementation_attestation(path: Path | None, authorization: dict) -> dict:
    expected = resolve(Path(authorization["implementation"]["implementationAttestationPath"]))
    if path is None or resolve(path) != expected or not expected.is_file():
        raise ValueError("v9_diagnostic_implementation_attestation_missing")
    attestation = read_json(expected)
    cpu_report_path = resolve(Path(authorization["implementation"]["cpuReportPath"]))
    structure_mode = is_structure_fact_authorization(authorization)
    semantic_mixture_mode = is_semantic_mixture_authorization(authorization)
    final_visible_rgb_mode = is_final_visible_rgb_authorization(authorization)
    vegetation_repair_mode = is_vegetation_repair_authorization(authorization)
    vegetation_luminance_mode = is_vegetation_luminance_authorization(authorization)
    expected_values = {
        "status": (
            "stage4_vegetation_luminance_spatial_gpu_diagnostic_implementation_cpu_verified"
            if vegetation_luminance_mode
            else (
            "stage4_vegetation_final_visible_gpu_diagnostic_implementation_cpu_verified"
            if vegetation_repair_mode
            else (
            "stage4_final_visible_rgb_gpu_diagnostic_implementation_cpu_verified"
            if final_visible_rgb_mode
            else (
                "fact_conditioned_semantic_mixture_gpu_diagnostic_implementation_cpu_verified"
                if semantic_mixture_mode
                else (
                    "structure_fact_first_gpu_diagnostic_implementation_cpu_verified"
                    if structure_mode else "v9_gpu_diagnostic_implementation_cpu_verified"
                )
            )))
        ),
        "requestId": authorization_request_id(authorization),
        "authorizationSha256": authorization_sha256(authorization),
        "runnerSha256": sha256_file(resolve(RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "cpuReportSha256": sha256_file(cpu_report_path),
    }
    for key, expected_value in expected_values.items():
        if attestation.get(key) != expected_value:
            raise ValueError(f"v9_diagnostic_implementation_attestation_invalid:{key}")
    cpu_report = read_json(cpu_report_path)
    if (
        cpu_report.get("status") != (
            "passed_stage4_vegetation_luminance_spatial_readonly_gpu_diagnostic_cpu_authorization_regression"
            if vegetation_luminance_mode
            else (
            "passed_stage4_vegetation_final_visible_readonly_gpu_diagnostic_cpu_authorization_regression"
            if vegetation_repair_mode
            else (
            "passed_stage4_final_visible_rgb_readonly_gpu_diagnostic_cpu_authorization_regression"
            if final_visible_rgb_mode
            else (
                "passed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
                if semantic_mixture_mode
                else (
                    "passed_structure_fact_first_readonly_gpu_diagnostic_cpu_authorization_regression"
                    if structure_mode else "passed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
                )
            )))
        )
        or cpu_report.get("failedPositiveKeys") != []
        or cpu_report.get("failedNegativeKeys") != []
    ):
        raise ValueError("v9_diagnostic_cpu_regression_not_successful")
    return attestation


def write_preflight_reports(authorization: dict, attestation: dict, python_path: Path, resource_path: Path) -> int:
    if resolve(python_path) != resolve(Path(authorization["implementation"]["pythonPreflightPath"])):
        raise ValueError("v9_diagnostic_python_preflight_output_invalid")
    if resolve(resource_path) != resolve(Path(authorization["implementation"]["resourcePreflightPath"])):
        raise ValueError("v9_diagnostic_resource_preflight_output_invalid")
    if resolve(python_path).exists() or resolve(resource_path).exists():
        raise FileExistsError("v9_diagnostic_preflight_output_already_exists")
    structure_mode = is_structure_fact_authorization(authorization)
    semantic_mixture_mode = is_semantic_mixture_authorization(authorization)
    final_visible_rgb_mode = is_final_visible_rgb_authorization(authorization)
    vegetation_repair_mode = is_vegetation_repair_authorization(authorization)
    config_binding_key = (
        "inactiveConfig"
        if (structure_mode or semantic_mixture_mode or final_visible_rgb_mode)
        else "v9InactiveConfig"
    )
    config = read_json(resolve(Path(authorization["bindings"][config_binding_key]["path"])))
    package = read_json(resolve(DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    python_report = {
        "schemaVersion": (
            "ai-painter-r5-stage4-vegetation-final-visible-gradient-diagnostic-python-preflight-v1"
            if vegetation_repair_mode
            else (
            "ai-painter-r5-stage4-final-visible-rgb-gradient-diagnostic-python-preflight-v1"
            if final_visible_rgb_mode
            else (
                "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-python-preflight-v1"
                if semantic_mixture_mode
                else (
                    "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-python-preflight-v1"
                    if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-python-preflight-v1"
                )
            ))
        ),
        "status": "passed_python_preflight_gpu_not_consumed",
        **timestamps("recordedAt"),
        "pythonExecutable": str(Path(sys.executable).resolve()),
        "pythonVersion": sys.version,
        "torchVersion": torch.__version__,
        "configSha256": authorization["bindings"][config_binding_key]["sha256"],
        "implementationAttestationSha256": sha256_file(resolve(Path(authorization["implementation"]["implementationAttestationPath"]))),
        "checkpointRead": False,
        "gpuExecutionConsumed": False,
    }
    write_json_exclusive(python_path, python_report)
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("v9_diagnostic_cuda_device_zero_unavailable")
    free_bytes = disk_free_bytes(resolve(Path(authorization["execution"]["outputDirectory"])).parent)
    required_disk_bytes = 2 * 1024**3
    if free_bytes < required_disk_bytes:
        raise ValueError("v9_diagnostic_disk_budget_insufficient")
    resource_report = {
        "schemaVersion": (
            "ai-painter-r5-stage4-vegetation-final-visible-gradient-diagnostic-resource-preflight-v1"
            if vegetation_repair_mode
            else (
            "ai-painter-r5-stage4-final-visible-rgb-gradient-diagnostic-resource-preflight-v1"
            if final_visible_rgb_mode
            else (
                "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-resource-preflight-v1"
                if semantic_mixture_mode
                else (
                    "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-resource-preflight-v1"
                    if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-resource-preflight-v1"
                )
            ))
        ),
        "status": "passed_cuda_resource_and_disk_preflight_gpu_not_consumed",
        **timestamps("recordedAt"),
        "cuda": {
            "available": True,
            "deviceCount": torch.cuda.device_count(),
            "device0Name": torch.cuda.get_device_name(0),
            "device0TotalMemoryBytes": int(torch.cuda.get_device_properties(0).total_memory),
        },
        "diskFreeBytes": free_bytes,
        "requiredDiskBytes": required_disk_bytes,
        "checkpointRead": False,
        "gpuExecutionConsumed": False,
    }
    write_json_exclusive(resource_path, resource_report)
    print(json.dumps({
        "status": (
            "stage4_vegetation_final_visible_gradient_diagnostic_all_preflights_passed_gpu_not_consumed"
            if vegetation_repair_mode
            else (
            "stage4_final_visible_rgb_gradient_diagnostic_all_preflights_passed_gpu_not_consumed"
            if final_visible_rgb_mode
            else (
                "fact_conditioned_semantic_mixture_gradient_diagnostic_all_preflights_passed_gpu_not_consumed"
                if semantic_mixture_mode
                else (
                    "structure_fact_first_gradient_diagnostic_all_preflights_passed_gpu_not_consumed"
                    if structure_mode else "v9_gradient_diagnostic_all_preflights_passed_gpu_not_consumed"
                )
            ))
        ),
        "pythonReport": binding(python_path),
        "resourceReport": binding(resource_path),
    }, ensure_ascii=False, indent=2))
    return 0


def consume_and_run(authorization_path: Path, authorization: dict, attestation: dict, output_dir: Path) -> int:
    output = resolve(output_dir)
    if output != resolve(Path(authorization["execution"]["outputDirectory"])) or output.exists():
        raise ValueError("v9_diagnostic_output_identity_invalid_or_exists")
    python_path = resolve(Path(authorization["implementation"]["pythonPreflightPath"]))
    resource_path = resolve(Path(authorization["implementation"]["resourcePreflightPath"]))
    python_report = read_json(python_path)
    resource_report = read_json(resource_path)
    if (
        python_report.get("status") != "passed_python_preflight_gpu_not_consumed"
        or resource_report.get("status") != "passed_cuda_resource_and_disk_preflight_gpu_not_consumed"
    ):
        raise ValueError("v9_diagnostic_saved_preflight_not_successful")
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("v9_diagnostic_cuda_changed_after_preflight")
    consumption_path = resolve(Path(authorization["execution"]["gpuConsumptionPath"]))
    if consumption_path.exists():
        raise FileExistsError("v9_diagnostic_gpu_authorization_already_consumed")
    structure_mode = is_structure_fact_authorization(authorization)
    semantic_mixture_mode = is_semantic_mixture_authorization(authorization)
    final_visible_rgb_mode = is_final_visible_rgb_authorization(authorization)
    vegetation_repair_mode = is_vegetation_repair_authorization(authorization)
    vegetation_luminance_mode = is_vegetation_luminance_authorization(authorization)
    consumption = {
        "schemaVersion": (
            "ai-painter-r5-stage4-vegetation-luminance-spatial-gradient-diagnostic-gpu-consumption-v1"
            if vegetation_luminance_mode
            else (
            "ai-painter-r5-stage4-vegetation-final-visible-gradient-diagnostic-gpu-consumption-v1"
            if vegetation_repair_mode
            else (
            "ai-painter-r5-stage4-final-visible-rgb-gradient-diagnostic-gpu-consumption-v1"
            if final_visible_rgb_mode
            else (
                "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-gpu-consumption-v1"
                if semantic_mixture_mode
                else (
                    "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-gpu-consumption-v1"
                    if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-gpu-consumption-v1"
                )
            )))
        ),
        "status": (
            "stage4_vegetation_luminance_spatial_readonly_gpu_diagnostic_authorization_atomically_consumed"
            if vegetation_luminance_mode
            else (
            "stage4_vegetation_final_visible_readonly_gpu_diagnostic_authorization_atomically_consumed"
            if vegetation_repair_mode
            else (
            "stage4_final_visible_rgb_readonly_gpu_diagnostic_authorization_atomically_consumed"
            if final_visible_rgb_mode
            else (
                "fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_authorization_atomically_consumed"
                if semantic_mixture_mode
                else (
                    "structure_fact_first_readonly_gpu_diagnostic_authorization_atomically_consumed"
                    if structure_mode else "v9_readonly_gpu_diagnostic_authorization_atomically_consumed"
                )
            )))
        ),
        "requestId": authorization_request_id(authorization),
        "commandRef": authorization_request_id(authorization),
        "scope": authorization_scope(authorization),
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": authorization_sha256(authorization),
        "implementationAttestationPath": project_path(Path(authorization["implementation"]["implementationAttestationPath"])),
        "implementationAttestationSha256": sha256_file(resolve(Path(authorization["implementation"]["implementationAttestationPath"]))),
        "pythonPreflightSha256": sha256_file(python_path),
        "resourcePreflightSha256": sha256_file(resource_path),
        **timestamps("consumedAt"),
        "oneTimeConsumption": True,
        "optimizerAuthorized": False,
        "backwardMethodAuthorized": False,
        "modelWeightModificationAuthorized": False,
        "checkpointWriteAuthorized": False,
        "trainingAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    write_json_exclusive(consumption_path, consumption)
    return run_gpu(authorization, output, consumption_path, python_report, resource_report)


def run_gpu(authorization: dict, output: Path, consumption_path: Path, python_report: dict, resource_report: dict) -> int:
    if is_final_visible_rgb_authorization(authorization) or is_semantic_mixture_authorization(authorization):
        return run_semantic_mixture_gpu(
            authorization, output, consumption_path, python_report, resource_report
        )
    if is_structure_fact_authorization(authorization):
        return run_structure_fact_gpu(
            authorization, output, consumption_path, python_report, resource_report
        )
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    steps = []
    state = {
        "autoencoderCheckpointRead": False,
        "oldDenoiserCheckpointRead": False,
        "gpuUsed": False,
        "forwardCompleted": False,
        "autogradGradCompleted": False,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    try:
        def step(code: str, details=None):
            steps.append({"index": len(steps) + 1, "code": code, "details": details or {}, **timestamps("completedAt")})
            write_json_atomic(output / "step-telemetry.json", {"completedSteps": steps, **state})

        step("gpu_authorization_consumption_validated", {"sha256": sha256_file(consumption_path)})
        torch.cuda.init()
        torch.cuda.set_device(0)
        if torch.cuda.current_device() != 0:
            raise ValueError("v9_diagnostic_cuda_device_zero_not_active")
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        step("cuda_context_initialized_device_zero_confirmed")

        config = read_json(resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
        package = read_json(resolve(DATASET_PATH))
        trainer.validate_training_inputs(config, package)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH, SAMPLE_SPLIT, list(config["conditionChannelOrder"]), IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("v9_diagnostic_sample194_not_unique_validation")
        sample = dataset[matches[0]]
        step("fixed_validation_sample194_loaded", {"sampleId": sample["sampleId"]})

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        denoiser_hash_before = state_dict_sha256(model.denoiser.state_dict())
        if sha256_file(resolve(AUTOENCODER_PATH)) != authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"]:
            raise ValueError("v9_diagnostic_autoencoder_checkpoint_hash_changed_before_read")
        checkpoint = load_project_autoencoder_checkpoint(config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        autoencoder_hash_before = state_dict_sha256(model.autoencoder.state_dict())
        device = torch.device("cuda:0")
        model.to(device).eval()
        step("project_autoencoder_loaded_frozen_v9_random_initialized")

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            raw_latent = model.autoencoder.encode(image)
            mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
            std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
            clean_latent = (raw_latent - mean) / std
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([TIMESTEP], dtype=torch.long, device=device)
        noise = torch.randn(clean_latent.shape, device=device, dtype=clean_latent.dtype)
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        predicted_velocity, alignment = model.predict_velocity_with_stage4_object_alignment(
            noisy_latent, timestep, conditions,
        )
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        predicted_rgb = model.autoencoder.decode(predicted_clean * std + mean)
        losses = trainer.composite_denoiser_losses_v9_stage4(
            predicted_velocity, target_velocity, predicted_clean, clean_latent,
            predicted_conditions, target_conditions, predicted_rgb, image, conditions,
            alignment, config,
        )
        state["forwardCompleted"] = True
        step("single_v9_denoiser_forward_and_17_diagnostics_completed")

        named = [(name, parameter) for name, parameter in model.denoiser.named_parameters() if parameter.requires_grad]
        parameters = [parameter for _, parameter in named]
        gradient_routes = {}
        prefix = {
            "object_footprints": "ObjectFootprints",
            "object_tree": "ObjectTree",
            "object_rock": "ObjectRock",
            "object_vegetation": "ObjectVegetation",
        }
        for object_name in OBJECT_CHANNELS:
            object_loss = (
                losses[f"stage4V9{prefix[object_name]}Up1ReadoutBce"]
                + losses[f"stage4V9{prefix[object_name]}Up0ReadoutBce"]
            ) * 0.5
            gradients = torch.autograd.grad(object_loss, parameters, retain_graph=True, allow_unused=True)
            norms = gradient_group_norms(named, gradients)
            if norms[object_name] <= 0.0 or any(
                norms[other] > 0.0 for other in OBJECT_CHANNELS if other != object_name
            ):
                raise ValueError(f"v9_diagnostic_object_gradient_isolation_failed:{object_name}")
            gradient_routes[object_name] = norms
        route_gradients = torch.autograd.grad(
            losses["stage4V9PreservedRouteTopologyReadoutBce"], parameters,
            retain_graph=True, allow_unused=True,
        )
        route_norms = gradient_group_norms(named, route_gradients)
        if route_norms["routeTopology"] <= 0.0 or route_norms["baseDenoiser"] <= 0.0:
            raise ValueError("v9_diagnostic_route_gradient_path_missing")
        decoded_gradients = torch.autograd.grad(
            losses["decodedRgbMae"], parameters, retain_graph=False, allow_unused=True,
        )
        decoded_norms = gradient_group_norms(named, decoded_gradients)
        if decoded_norms["typedAdapters"] <= 0.0 or decoded_norms["baseDenoiser"] <= 0.0:
            raise ValueError("v9_diagnostic_decoded_rgb_base_gradient_path_missing")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("v9_diagnostic_parameter_grad_fields_populated")
        state["autogradGradCompleted"] = True
        step("torch_autograd_grad_object_route_and_base_routes_verified")

        diagnostic_metrics = {
            key: float(losses[key].detach().cpu())
            for key in trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
        }
        if (
            set(diagnostic_metrics) != set(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
            or any(not math.isfinite(value) or value < 0.0 for value in diagnostic_metrics.values())
            or diagnostic_metrics["stage4DiagnosticObjectGradientAvailable"] != 1.0
        ):
            raise ValueError("v9_diagnostic_exact_17_metric_values_invalid")
        manifest_row = trainer.register_v9_stage4_diagnostic_manifest_fields(
            {"epoch": 1}, diagnostic_metrics, 1, config,
        )
        step("exact_17_diagnostic_manifest_fields_registered")

        torch.cuda.synchronize(0)
        cuda_telemetry = {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-r5-stage4-v9-cuda-telemetry-v1",
            "status": "collected_after_readonly_forward_and_autograd_grad",
            **timestamps("recordedAt"),
            **cuda_telemetry,
        })
        step("cuda_telemetry_saved")

        model.to("cpu")
        denoiser_hash_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_hash_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_hash_before != denoiser_hash_after or autoencoder_hash_before != autoencoder_hash_after:
            raise ValueError("v9_diagnostic_model_state_changed")
        step("denoiser_and_autoencoder_state_hashes_unchanged")

        report = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-report-v1",
            "status": "passed_readonly_v9_gpu_forward_and_gradient_routing_weights_unchanged",
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "identity": {
                "sampleId": SAMPLE_ID,
                "sampleSplit": SAMPLE_SPLIT,
                "seed": SEED,
                "timestep": TIMESTEP,
                "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
                "requiredBoundarySides": ["west"],
            },
            "tensorShapes": {
                "image": list(image.shape),
                "conditions": list(conditions.shape),
                "latent": list(clean_latent.shape),
                "predictedVelocity": list(predicted_velocity.shape),
                "objectReadoutUp1": list(alignment["objectReadoutUp1"].shape),
                "objectReadoutUp0": list(alignment["objectReadoutUp0"].shape),
                "routeReadout": list(alignment["routeReadout"].shape),
            },
            "losses": {
                "composite": float(losses["compositeLossTensor"].detach().cpu()),
                "decodedRgbMae": float(losses["decodedRgbMae"].detach().cpu()),
                "routeTopologyBce": float(losses["stage4V9PreservedRouteTopologyReadoutBce"].detach().cpu()),
            },
            "gradientRoutes": {
                "independentObjects": gradient_routes,
                "routeTopology": route_norms,
                "decodedRgbBase": decoded_norms,
            },
            "diagnosticManifest": {
                "fieldCount": 17,
                "fields": list(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
                "epoch1Row": manifest_row,
            },
            "cuda": cuda_telemetry,
            "integrity": {
                "denoiserStateSha256Before": denoiser_hash_before,
                "denoiserStateSha256After": denoiser_hash_after,
                "autoencoderStateSha256Before": autoencoder_hash_before,
                "autoencoderStateSha256After": autoencoder_hash_after,
                "parameterGradFieldsAbsent": True,
            },
            "pythonPreflight": python_report,
            "resourcePreflight": resource_report,
            "authorizationConsumption": binding(consumption_path),
            "completedSteps": steps,
            **state,
        }
        report_path = output / "diagnostic-report.json"
        write_json_exclusive(report_path, report)
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-terminal-v1",
            "status": "v9_gradient_diagnostic_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "cudaTelemetryPath": project_path(output / "cuda-telemetry.json"),
            "cudaTelemetrySha256": sha256_file(output / "cuda-telemetry.json"),
            "nextAction": "separately_authorized_v9_fixed_sample194_30_epoch_gpu_smoke",
            "blockers": [],
            **state,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-terminal-v1",
            "status": "v9_gradient_diagnostic_failed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "failureType": type(error).__name__,
            "failureMessage": str(error),
            "traceback": traceback.format_exc(),
            "completedSteps": steps,
            **state,
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 1


def run_semantic_mixture_gpu(
    authorization: dict,
    output: Path,
    consumption_path: Path,
    python_report: dict,
    resource_report: dict,
) -> int:
    final_visible_rgb_mode = is_final_visible_rgb_authorization(authorization)
    vegetation_repair_mode = is_vegetation_repair_authorization(authorization)
    vegetation_luminance_mode = is_vegetation_luminance_authorization(authorization)
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    steps = []
    state = {
        "autoencoderCheckpointRead": False,
        "oldDenoiserCheckpointRead": False,
        "gpuUsed": False,
        "forwardCompleted": False,
        "autogradGradCompleted": False,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    try:
        def step(code: str, details=None):
            steps.append({
                "index": len(steps) + 1,
                "code": code,
                "details": details or {},
                **timestamps("completedAt"),
            })
            write_json_atomic(output / "step-telemetry.json", {"completedSteps": steps, **state})

        step("gpu_authorization_consumption_validated", {"sha256": sha256_file(consumption_path)})
        torch.cuda.init()
        torch.cuda.set_device(0)
        if torch.cuda.current_device() != 0:
            raise ValueError("semantic_mixture_diagnostic_cuda_device_zero_not_active")
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        step("cuda_context_initialized_device_zero_confirmed")

        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        package = read_json(resolve(DATASET_PATH))
        trainer.validate_training_inputs(config, package)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH, SAMPLE_SPLIT, list(config["conditionChannelOrder"]), IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("semantic_mixture_diagnostic_sample194_not_unique_validation")
        sample = dataset[matches[0]]
        step("fixed_validation_sample194_loaded", {"sampleId": sample["sampleId"]})

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        denoiser_hash_before = state_dict_sha256(model.denoiser.state_dict())
        expected_autoencoder_sha = authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"]
        if sha256_file(resolve(AUTOENCODER_PATH)) != expected_autoencoder_sha:
            raise ValueError("semantic_mixture_diagnostic_autoencoder_hash_changed_before_read")
        checkpoint = load_project_autoencoder_checkpoint(config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        autoencoder_hash_before = state_dict_sha256(model.autoencoder.state_dict())
        device = torch.device("cuda:0")
        model.to(device).eval()
        step("project_autoencoder_loaded_frozen_semantic_mixture_random_initialized")

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            raw_latent = model.autoencoder.encode(image)
            mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
            std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
            clean_latent = (raw_latent - mean) / std
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([TIMESTEP], dtype=torch.long, device=device)
        generator = torch.Generator(device=device).manual_seed(SEED)
        noise = torch.randn(
            clean_latent.shape, device=device, dtype=clean_latent.dtype, generator=generator,
        )
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(
            clean_latent, noise, timestep, diffusion["alphasCumulative"],
        )
        predicted_velocity, mixture = model.predict_velocity_with_stage4_semantic_mixture(
            noisy_latent, timestep, conditions,
        )
        identities = tuple(mixture.get("expertIdentityOrder", ()))
        contributions = tuple(mixture.get("expertContributions", ()))
        gated = tuple(mixture.get("gatedContributions", ()))
        participation = mixture.get("participation")
        base_velocity = mixture.get("baseVelocity")
        if (
            identities != SEMANTIC_MIXTURE_IDENTITIES
            or len(contributions) != 5
            or len(gated) != 5
            or participation is None
            or participation.shape[1] != 5
            or base_velocity is None
            or mixture.get("typedIdentityCollapsedBeforeOutput") is not False
        ):
            raise ValueError("semantic_mixture_diagnostic_forward_identity_invalid")
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        base_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * base_velocity
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        predicted_rgb = model.autoencoder.decode(predicted_clean * std + mean)
        base_rgb = model.autoencoder.decode(base_clean * std + mean)
        typed_counterfactual_rgb = {}
        causal_evidence = {}
        channel_order = list(config["conditionChannelOrder"])
        source_channels = tuple(mixture.get("sourceConditionChannels", ()))
        for index, identity in enumerate(identities):
            counterfactual_velocity = base_velocity + gated[index]
            counterfactual_clean = (
                alpha.sqrt() * noisy_latent
                - (1.0 - alpha).sqrt() * counterfactual_velocity
            )
            counterfactual_rgb = model.autoencoder.decode(counterfactual_clean * std + mean)
            typed_counterfactual_rgb[identity] = counterfactual_rgb
            ablated_conditions = conditions.clone()
            ablated_conditions[:, channel_order.index(source_channels[index])] = 0.0
            _, ablated = model.predict_velocity_with_stage4_semantic_mixture(
                noisy_latent, timestep, ablated_conditions,
            )
            causal_evidence[identity] = {
                "contributionAbsMean": float(contributions[index].abs().mean().detach().cpu()),
                "gatedContributionAbsMean": float(gated[index].abs().mean().detach().cpu()),
                "decodedRgbVsBaseAbsMean": float(
                    (counterfactual_rgb - base_rgb).abs().mean().detach().cpu()
                ),
                "sourceChannelAblationContributionResponse": float(
                    (contributions[index] - ablated["expertContributions"][index])
                    .abs().mean().detach().cpu()
                ),
            }
            if any(
                not math.isfinite(value) or value <= 0.0
                for value in causal_evidence[identity].values()
            ):
                raise ValueError(f"semantic_mixture_diagnostic_causal_response_missing:{identity}")
        state["forwardCompleted"] = True
        step("single_semantic_mixture_forward_and_five_causal_routes_completed")

        losses = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
            predicted_velocity, target_velocity, predicted_clean, clean_latent,
            predicted_conditions, target_conditions, predicted_rgb, image, conditions,
            mixture, typed_counterfactual_rgb, config,
        )
        final_visible_rgb_evidence = {}
        vegetation_edge_evidence = {}
        vegetation_luminance_evidence = {}
        if final_visible_rgb_mode:
            objective = trainer.validate_stage4_per_class_final_visible_rgb_obligation(config)
            expected_terms = list(trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS)
            if objective.get("terms") != expected_terms:
                raise ValueError("final_visible_rgb_diagnostic_term_registry_invalid")
            for term in expected_terms:
                identity = term["identity"]
                source_channel = term["sourceChannel"]
                loss = losses[term["metric"]]
                predicted_gradient = torch.autograd.grad(
                    loss, predicted_rgb, retain_graph=True, allow_unused=False,
                )[0]
                denoiser_gradients = torch.autograd.grad(
                    loss,
                    tuple(parameter for parameter in model.denoiser.parameters() if parameter.requires_grad),
                    retain_graph=True,
                    allow_unused=True,
                )
                source_index = channel_order.index(source_channel)
                mask = conditions[:, source_index:source_index + 1]
                mask = torch.nn.functional.interpolate(
                    mask, size=predicted_rgb.shape[-2:], mode="nearest",
                )
                inside = float((predicted_gradient.abs() * mask).sum().detach().cpu())
                outside = float(
                    (predicted_gradient.abs() * (1.0 - mask)).sum().detach().cpu()
                )
                denoiser_norm = sum(gradient_norm(value) for value in denoiser_gradients)
                value = float(loss.detach().cpu())
                weight = float(objective["derivedWeights"][identity])
                if (
                    not math.isfinite(value)
                    or value <= 0.0
                    or inside <= 0.0
                    or outside != 0.0
                    or denoiser_norm <= 0.0
                    or not math.isfinite(weight)
                    or weight <= 0.0
                ):
                    raise ValueError(
                        f"final_visible_rgb_diagnostic_gradient_or_mask_failed:{identity}"
                    )
                final_visible_rgb_evidence[identity] = {
                    "sourceChannel": source_channel,
                    "metric": term["metric"],
                    "lossValue": value,
                    "derivedWeight": weight,
                    "decodedRgbInsideMaskGradientAbsSum": inside,
                    "decodedRgbOutsideMaskGradientAbsSum": outside,
                    "denoiserGradientNorm": denoiser_norm,
                    "reachesFinalDenoiserRgbPath": True,
                    "reachesFrozenAutoencoderDecodedRgb": True,
                }
            step("five_final_visible_rgb_obligations_gradient_and_mask_isolation_verified")
        if vegetation_repair_mode:
            repair = trainer.validate_stage4_vegetation_final_visible_semantic_repair(config)
            edge_loss = losses["stage4SemanticMixtureVegetationFinalTypedEdgeMae"]
            edge_gradient = torch.autograd.grad(
                edge_loss, predicted_rgb, retain_graph=True, allow_unused=False,
            )[0]
            denoiser_gradients = torch.autograd.grad(
                edge_loss,
                tuple(parameter for parameter in model.denoiser.parameters() if parameter.requires_grad),
                retain_graph=True, allow_unused=True,
            )
            source_index = channel_order.index("object_vegetation")
            mask = conditions[:, source_index:source_index + 1]
            mask = torch.nn.functional.interpolate(
                mask, size=predicted_rgb.shape[-2:], mode="nearest",
            )
            support = torch.nn.functional.max_pool2d(
                mask, kernel_size=3, stride=1, padding=1,
            )
            inside = float((edge_gradient.abs() * mask).sum().detach().cpu())
            adjacent = float(
                (edge_gradient.abs() * (support - mask)).sum().detach().cpu()
            )
            outside = float(
                (edge_gradient.abs() * (1.0 - support)).sum().detach().cpu()
            )
            denoiser_norm = sum(gradient_norm(value) for value in denoiser_gradients)
            value = float(edge_loss.detach().cpu())
            weight = float(repair["derivedWeight"])
            if (
                not math.isfinite(value) or value <= 0.0
                or inside <= 0.0 or adjacent <= 0.0 or outside != 0.0
                or denoiser_norm <= 0.0 or not math.isfinite(weight) or weight <= 0.0
            ):
                raise ValueError("vegetation_final_visible_edge_gradient_or_support_failed")
            vegetation_edge_evidence = {
                "sourceChannel": "object_vegetation",
                "metric": "stage4SemanticMixtureVegetationFinalTypedEdgeMae",
                "lossValue": value,
                "derivedWeight": weight,
                "decodedRgbInsideMaskGradientAbsSum": inside,
                "decodedRgbAdjacentBoundaryGradientAbsSum": adjacent,
                "decodedRgbOutsideOnePixelBoundarySupportGradientAbsSum": outside,
                "denoiserGradientNorm": denoiser_norm,
                "reachesFinalDenoiserRgbPath": True,
                "reachesFrozenAutoencoderDecodedRgb": True,
            }
            step("vegetation_final_visible_edge_structure_gradient_verified")
        if vegetation_luminance_mode:
            luminance_contract = (
                trainer.validate_stage4_vegetation_luminance_spatial_structure_supervision(
                    config
                )
            )
            luminance_loss = losses[
                "stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss"
            ]
            luminance_gradient = torch.autograd.grad(
                luminance_loss, predicted_rgb, retain_graph=True, allow_unused=False,
            )[0]
            denoiser_gradients = torch.autograd.grad(
                luminance_loss,
                tuple(parameter for parameter in model.denoiser.parameters() if parameter.requires_grad),
                retain_graph=True, allow_unused=True,
            )
            source_index = channel_order.index("object_vegetation")
            mask = conditions[:, source_index:source_index + 1]
            mask = torch.nn.functional.interpolate(
                mask, size=predicted_rgb.shape[-2:], mode="nearest",
            )
            inside = float((luminance_gradient.abs() * mask).sum().detach().cpu())
            outside = float(
                (luminance_gradient.abs() * (1.0 - mask)).sum().detach().cpu()
            )
            denoiser_norm = sum(gradient_norm(value) for value in denoiser_gradients)
            value = float(luminance_loss.detach().cpu())
            weight = float(luminance_contract["derivedWeight"])
            if (
                not math.isfinite(value) or value < 0.0
                or inside <= 0.0 or outside != 0.0
                or denoiser_norm <= 0.0 or not math.isfinite(weight) or weight <= 0.0
            ):
                raise ValueError(
                    "vegetation_luminance_spatial_gradient_or_support_failed"
                )
            vegetation_luminance_evidence = {
                "sourceChannel": "object_vegetation",
                "metric": "stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss",
                "lossValue": value,
                "derivedWeight": weight,
                "decodedRgbInsideMaskGradientAbsSum": inside,
                "decodedRgbOutsideMaskGradientAbsSum": outside,
                "denoiserGradientNorm": denoiser_norm,
                "reachesFinalDenoiserRgbPath": True,
                "reachesFrozenAutoencoderDecodedRgb": True,
            }
            step("vegetation_luminance_spatial_structure_gradient_verified")
        named = [
            (name, parameter) for name, parameter in model.denoiser.named_parameters()
            if parameter.requires_grad
        ]
        expert_gradient_evidence = {}
        for index, identity in enumerate(identities):
            own_parameters = tuple(model.denoiser.semantic_mixture_experts[identity].parameters())
            other_parameters = tuple(
                parameter
                for other_identity in identities if other_identity != identity
                for parameter in model.denoiser.semantic_mixture_experts[other_identity].parameters()
            )
            gate_parameters = tuple(
                model.denoiser.semantic_mixture_participation[identity].parameters()
            )
            own = torch.autograd.grad(
                contributions[index].mean(), own_parameters,
                retain_graph=True, allow_unused=True,
            )
            cross = torch.autograd.grad(
                contributions[index].mean(), other_parameters,
                retain_graph=True, allow_unused=True,
            )
            gate = torch.autograd.grad(
                gated[index].mean(), gate_parameters,
                retain_graph=True, allow_unused=True,
            )
            own_norm = sum(gradient_norm(value) for value in own)
            cross_norm = sum(gradient_norm(value) for value in cross)
            gate_norm = sum(gradient_norm(value) for value in gate)
            if own_norm <= 0.0 or cross_norm != 0.0 or gate_norm <= 0.0:
                raise ValueError(f"semantic_mixture_diagnostic_private_gradient_failed:{identity}")
            expert_gradient_evidence[identity] = {
                "ownExpertGradientNorm": own_norm,
                "otherPrivateExpertGradientNorm": cross_norm,
                "participationGateGradientNorm": gate_norm,
            }
        final_gradients = torch.autograd.grad(
            predicted_velocity.mean(), gated, retain_graph=True, allow_unused=True,
        )
        if any(gradient_norm(value) <= 0.0 for value in final_gradients):
            raise ValueError("semantic_mixture_diagnostic_final_velocity_gradient_missing")
        base_parameters = tuple(
            parameter for name, parameter in named if "semantic_mixture_" not in name
        )
        base_gradients = torch.autograd.grad(
            base_velocity.mean(), base_parameters, retain_graph=True, allow_unused=True,
        )
        if sum(gradient_norm(value) for value in base_gradients) <= 0.0:
            raise ValueError("semantic_mixture_diagnostic_base_denoiser_gradient_missing")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("semantic_mixture_diagnostic_parameter_grad_fields_populated")
        state["autogradGradCompleted"] = True
        step("torch_autograd_grad_five_private_experts_gates_final_and_base_verified")

        expected_diagnostic_fields = trainer.fact_conditioned_semantic_mixture_diagnostic_fields(
            config
        )
        diagnostic_metrics = {
            key: float(losses[key].detach().cpu())
            for key in expected_diagnostic_fields
        }
        if (
            len(diagnostic_metrics) != len(expected_diagnostic_fields)
            or any(not math.isfinite(value) or value < 0.0 for value in diagnostic_metrics.values())
        ):
            raise ValueError("semantic_mixture_diagnostic_exact_field_values_invalid")
        step("exact_semantic_mixture_diagnostic_fields_exported", {
            "fieldCount": len(diagnostic_metrics),
        })

        torch.cuda.synchronize(0)
        cuda_telemetry = {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-stage4-fact-conditioned-semantic-mixture-cuda-telemetry-v1",
            "status": "collected_after_readonly_forward_and_autograd_grad",
            **timestamps("recordedAt"),
            **cuda_telemetry,
        })
        step("cuda_telemetry_saved")

        model.to("cpu")
        denoiser_hash_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_hash_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_hash_before != denoiser_hash_after or autoencoder_hash_before != autoencoder_hash_after:
            raise ValueError("semantic_mixture_diagnostic_model_state_changed")
        step("denoiser_and_autoencoder_state_hashes_unchanged")

        report = {
            "schemaVersion": (
                "ai-painter-stage4-vegetation-final-visible-gradient-diagnostic-report-v1"
                if vegetation_repair_mode
                else (
                "ai-painter-stage4-final-visible-rgb-gradient-diagnostic-report-v1"
                if final_visible_rgb_mode
                else "ai-painter-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-report-v1"
                )
            ),
            "status": (
                "passed_readonly_stage4_vegetation_final_visible_gpu_gradient_qualification"
                if vegetation_repair_mode
                else (
                "passed_readonly_stage4_per_class_final_visible_rgb_gpu_gradient_qualification"
                if final_visible_rgb_mode
                else "passed_readonly_fact_conditioned_semantic_mixture_gpu_causal_and_gradient_diagnostic"
                )
            ),
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "identity": authorization["taskIdentity"],
            "tensorShapes": {
                "image": list(image.shape),
                "conditions": list(conditions.shape),
                "latent": list(clean_latent.shape),
                "predictedVelocity": list(predicted_velocity.shape),
                "participation": list(participation.shape),
            },
            "causalEvidence": causal_evidence,
            "gradientEvidence": {
                "typedExperts": expert_gradient_evidence,
                "finalVisibleRgbObligations": final_visible_rgb_evidence,
                "vegetationFinalVisibleEdgeStructure": vegetation_edge_evidence,
                "vegetationLuminanceSpatialStructure": vegetation_luminance_evidence,
                "finalVelocityGatedContributionGradientNorms": [
                    gradient_norm(value) for value in final_gradients
                ],
                "baseDenoiserGradientNorm": sum(
                    gradient_norm(value) for value in base_gradients
                ),
            },
            "diagnosticManifest": {
                "fieldCount": len(expected_diagnostic_fields),
                "fields": list(expected_diagnostic_fields),
                "values": diagnostic_metrics,
            },
            "cuda": cuda_telemetry,
            "integrity": {
                "denoiserStateSha256Before": denoiser_hash_before,
                "denoiserStateSha256After": denoiser_hash_after,
                "autoencoderStateSha256Before": autoencoder_hash_before,
                "autoencoderStateSha256After": autoencoder_hash_after,
                "parameterGradFieldsAbsent": True,
            },
            "pythonPreflight": python_report,
            "resourcePreflight": resource_report,
            "authorizationConsumption": binding(consumption_path),
            "completedSteps": steps,
            **state,
        }
        report_path = output / "diagnostic-report.json"
        write_json_exclusive(report_path, report)
        terminal = {
            "schemaVersion": (
                "ai-painter-stage4-vegetation-final-visible-gradient-diagnostic-terminal-v1"
                if vegetation_repair_mode
                else (
                "ai-painter-stage4-final-visible-rgb-gradient-diagnostic-terminal-v1"
                if final_visible_rgb_mode
                else "ai-painter-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-terminal-v1"
                )
            ),
            "status": (
                "stage4_vegetation_final_visible_gpu_qualification_passed_closed"
                if vegetation_repair_mode
                else (
                "stage4_per_class_final_visible_rgb_gpu_qualification_passed_closed"
                if final_visible_rgb_mode
                else "fact_conditioned_semantic_mixture_gradient_diagnostic_passed_closed"
                )
            ),
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "cudaTelemetryPath": project_path(output / "cuda-telemetry.json"),
            "cudaTelemetrySha256": sha256_file(output / "cuda-telemetry.json"),
            "nextAction": "separately_authorized_fixed_sample194_30_epoch_model_smoke",
            "blockers": [],
            **state,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal = {
            "schemaVersion": (
                "ai-painter-stage4-vegetation-final-visible-gradient-diagnostic-terminal-v1"
                if vegetation_repair_mode
                else (
                "ai-painter-stage4-final-visible-rgb-gradient-diagnostic-terminal-v1"
                if final_visible_rgb_mode
                else "ai-painter-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-terminal-v1"
                )
            ),
            "status": (
                "stage4_vegetation_final_visible_gpu_qualification_failed_closed"
                if vegetation_repair_mode
                else (
                "stage4_per_class_final_visible_rgb_gpu_qualification_failed_closed"
                if final_visible_rgb_mode
                else "fact_conditioned_semantic_mixture_gradient_diagnostic_failed_closed"
                )
            ),
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "failureType": type(error).__name__,
            "failureMessage": str(error),
            "traceback": traceback.format_exc(),
            "completedSteps": steps,
            **state,
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 1


def run_structure_fact_gpu(
    authorization: dict,
    output: Path,
    consumption_path: Path,
    python_report: dict,
    resource_report: dict,
) -> int:
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    steps = []
    state = {
        "autoencoderCheckpointRead": False,
        "oldDenoiserCheckpointRead": False,
        "gpuUsed": False,
        "forwardCompleted": False,
        "autogradGradCompleted": False,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    try:
        def step(code: str, details=None):
            steps.append({
                "index": len(steps) + 1,
                "code": code,
                "details": details or {},
                **timestamps("completedAt"),
            })
            write_json_atomic(output / "step-telemetry.json", {"completedSteps": steps, **state})

        step("gpu_authorization_consumption_validated", {"sha256": sha256_file(consumption_path)})
        torch.cuda.init()
        torch.cuda.set_device(0)
        if torch.cuda.current_device() != 0:
            raise ValueError("structure_fact_diagnostic_cuda_device_zero_not_active")
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        step("cuda_context_initialized_device_zero_confirmed")

        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        package = read_json(resolve(DATASET_PATH))
        trainer.validate_training_inputs(config, package)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            SAMPLE_SPLIT,
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("structure_fact_diagnostic_sample194_not_unique_validation")
        sample = dataset[matches[0]]
        step("fixed_validation_sample194_loaded", {"sampleId": sample["sampleId"]})

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        denoiser_hash_before = state_dict_sha256(model.denoiser.state_dict())
        if sha256_file(resolve(AUTOENCODER_PATH)) != authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"]:
            raise ValueError("structure_fact_diagnostic_autoencoder_checkpoint_hash_changed_before_read")
        checkpoint = load_project_autoencoder_checkpoint(config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        autoencoder_hash_before = state_dict_sha256(model.autoencoder.state_dict())
        device = torch.device("cuda:0")
        model.to(device).eval()
        step("project_autoencoder_loaded_frozen_structure_fact_first_random_initialized")

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
        with torch.no_grad():
            raw_latent = model.autoencoder.encode(image)
            mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
            std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
            clean_latent = (raw_latent - mean) / std
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([TIMESTEP], dtype=torch.long, device=device)
        noise = torch.randn(clean_latent.shape, device=device, dtype=clean_latent.dtype)
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        predicted_velocity, alignment = model.predict_velocity_with_stage4_structure_fact(
            noisy_latent, timestep, conditions,
        )
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        predicted_rgb = model.autoencoder.decode(predicted_clean * std + mean)
        losses = trainer.composite_denoiser_losses_structure_fact_first_stage4(
            predicted_velocity,
            target_velocity,
            predicted_clean,
            clean_latent,
            predicted_conditions,
            target_conditions,
            predicted_rgb,
            image,
            conditions,
            alignment,
            config,
        )
        layout = alignment["structureLayout"]
        head_outputs = tuple(alignment["structureHeadOutputs"])
        if (
            list(alignment["structureChannelOrder"]) != list(STRUCTURE_FACT_CHANNELS)
            or list(alignment["stageBInjectionScales"]) != list(STRUCTURE_FACT_STAGE_B_SCALES)
            or layout.shape[1] != len(STRUCTURE_FACT_CHANNELS)
            or len(head_outputs) != len(STRUCTURE_FACT_CHANNELS)
        ):
            raise ValueError("structure_fact_diagnostic_stage_a_or_stage_b_identity_invalid")
        state["forwardCompleted"] = True
        step("single_structure_fact_first_forward_and_17_diagnostics_completed")

        all_head_parameters = []
        head_slices = {}
        for name in STRUCTURE_FACT_CHANNELS:
            start = len(all_head_parameters)
            all_head_parameters.extend(model.denoiser.structure_fact_heads[name].parameters())
            head_slices[name] = slice(start, len(all_head_parameters))
        independent_head_routes = {}
        for name in STRUCTURE_FACT_CHANNELS:
            gradients = torch.autograd.grad(
                losses[trainer.STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS[name]],
                tuple(all_head_parameters),
                retain_graph=True,
                create_graph=False,
                allow_unused=True,
            )
            selected = gradients[head_slices[name]]
            other = [
                gradient
                for other_name in STRUCTURE_FACT_CHANNELS
                if other_name != name
                for gradient in gradients[head_slices[other_name]]
            ]
            selected_norm = sum(gradient_norm(value) for value in selected)
            other_norm = sum(gradient_norm(value) for value in other)
            if selected_norm <= 0.0 or other_norm != 0.0:
                raise ValueError(f"structure_fact_diagnostic_typed_head_isolation_failed:{name}")
            independent_head_routes[name] = {
                "selectedHeadGradientNorm": selected_norm,
                "otherHeadGradientNorm": other_norm,
            }

        stage_a_parameter = next(model.denoiser.structure_fact_shared_trunk.parameters())
        stage_b_parameters = [
            next(model.denoiser.structure_fact_stage_b_adapters[name].parameters())
            for name in STRUCTURE_FACT_STAGE_B_SCALES
        ]
        base_parameter = model.denoiser.latent_stem.weight
        coupling_gradients = torch.autograd.grad(
            predicted_velocity.square().mean(),
            (stage_a_parameter, *stage_b_parameters, base_parameter),
            retain_graph=True,
            create_graph=False,
            allow_unused=True,
        )
        stage_a_norm = gradient_norm(coupling_gradients[0])
        stage_b_norms = {
            name: gradient_norm(coupling_gradients[index + 1])
            for index, name in enumerate(STRUCTURE_FACT_STAGE_B_SCALES)
        }
        base_norm = gradient_norm(coupling_gradients[-1])
        if stage_a_norm <= 0.0 or base_norm <= 0.0 or any(
            value <= 0.0 for value in stage_b_norms.values()
        ):
            raise ValueError("structure_fact_diagnostic_stage_a_to_stage_b_gradient_path_missing")

        condition_gradient = torch.autograd.grad(
            predicted_velocity.square().mean(),
            conditions,
            retain_graph=True,
            create_graph=False,
            allow_unused=False,
        )[0]
        condition_channel_norms = {
            name: float(condition_gradient[:, index:index + 1].abs().mean().detach().cpu())
            for index, name in enumerate(config["conditionChannelOrder"])
        }
        if len(condition_channel_norms) != 23 or any(
            not math.isfinite(value) or value <= 0.0 for value in condition_channel_norms.values()
        ):
            raise ValueError("structure_fact_diagnostic_original_23_condition_gradient_path_missing")

        diagnostic_fields = trainer.STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
        diagnostic_metrics = {
            key: float(losses[key].detach().cpu())
            for key in diagnostic_fields
        }
        if (
            set(diagnostic_metrics) != set(diagnostic_fields)
            or any(not math.isfinite(value) or value < 0.0 for value in diagnostic_metrics.values())
            or diagnostic_metrics["stage4DiagnosticObjectGradientAvailable"] != 1.0
        ):
            raise ValueError("structure_fact_diagnostic_exact_17_metric_values_invalid")
        manifest_row = trainer.register_v9_stage4_diagnostic_manifest_fields(
            {"epoch": 1}, diagnostic_metrics, 1, config,
        )
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("structure_fact_diagnostic_parameter_grad_fields_populated")
        state["autogradGradCompleted"] = True
        step("torch_autograd_grad_six_heads_stage_a_stage_b_23_conditions_and_base_verified")
        step("exact_17_diagnostic_manifest_fields_registered")

        torch.cuda.synchronize(0)
        cuda_telemetry = {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-r5-stage4-structure-fact-first-cuda-telemetry-v1",
            "status": "collected_after_readonly_forward_and_autograd_grad",
            **timestamps("recordedAt"),
            **cuda_telemetry,
        })
        step("cuda_telemetry_saved")

        model.to("cpu")
        denoiser_hash_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_hash_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_hash_before != denoiser_hash_after or autoencoder_hash_before != autoencoder_hash_after:
            raise ValueError("structure_fact_diagnostic_model_state_changed")
        step("denoiser_and_autoencoder_state_hashes_unchanged")

        report = {
            "schemaVersion": "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-report-v1",
            "status": "passed_readonly_structure_fact_first_gpu_forward_and_gradient_routing_weights_unchanged",
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "identity": {
                "architectureId": STRUCTURE_FACT_ARCHITECTURE,
                "sampleId": SAMPLE_ID,
                "sampleSplit": SAMPLE_SPLIT,
                "seed": SEED,
                "timestep": TIMESTEP,
                "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
                "requiredBoundarySides": ["west"],
            },
            "tensorShapes": {
                "image": list(image.shape),
                "conditions": list(conditions.shape),
                "latent": list(clean_latent.shape),
                "predictedVelocity": list(predicted_velocity.shape),
                "stageAStructureLayout": list(layout.shape),
                "stageAHeadOutputs": [list(value.shape) for value in head_outputs],
                "stageBInjectionScales": list(STRUCTURE_FACT_STAGE_B_SCALES),
            },
            "losses": {
                "composite": float(losses["compositeLossTensor"].detach().cpu()),
                "decodedRgbMae": float(losses["decodedRgbMae"].detach().cpu()),
                "structureLayoutBce": float(losses["stage4StructureFactLayoutBce"].detach().cpu()),
            },
            "gradientRoutes": {
                "independentStageAHeads": independent_head_routes,
                "stageAToStageB": {
                    "stageASharedTrunkGradientNorm": stage_a_norm,
                    "stageBAdapterGradientNorms": stage_b_norms,
                    "baseDenoiserGradientNorm": base_norm,
                },
                "original23ConditionChannelGradientNorms": condition_channel_norms,
            },
            "diagnosticManifest": {
                "fieldCount": 17,
                "fields": list(diagnostic_fields),
                "epoch1Row": manifest_row,
            },
            "cuda": cuda_telemetry,
            "integrity": {
                "denoiserStateSha256Before": denoiser_hash_before,
                "denoiserStateSha256After": denoiser_hash_after,
                "autoencoderStateSha256Before": autoencoder_hash_before,
                "autoencoderStateSha256After": autoencoder_hash_after,
                "parameterGradFieldsAbsent": True,
            },
            "pythonPreflight": python_report,
            "resourcePreflight": resource_report,
            "authorizationConsumption": binding(consumption_path),
            "completedSteps": steps,
            **state,
        }
        report_path = output / "diagnostic-report.json"
        write_json_exclusive(report_path, report)
        capsule = {
            "schemaVersion": "ai-painter-local-task-capsule-v1",
            "capsuleId": f"ai-painter-stage4-structure-fact-first-gradient-diagnostic-{output.name}",
            "module": "AI Painter R5",
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "currentStage": 4,
            "candidateTerminal": "stage4_structure_fact_first_gradient_diagnostic_passed_closed",
            "latestBlocker": "phase0_engineering_qualification_not_yet_authorized",
            "nextLegalAction": "owner_may_authorize_structure_fact_first_phase0_engineering_qualification",
            "forbiddenActions": [
                "automatic_retry", "optimizer_creation", "backward_method_execution",
                "model_weight_update", "checkpoint_write", "smoke", "stage4_full_training",
                "stage5_strict_revalidation", "formal_inference", "checkpoint_promotion",
                "runtime_frame", "world_entry",
            ],
            "evidence": {"diagnosticReport": binding(report_path)},
            "planPath": "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
            **timestamps("recordedAt"),
        }
        write_json_exclusive(output / "local-task-capsule.json", capsule)
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-terminal-v1",
            "status": "stage4_structure_fact_first_gradient_diagnostic_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "cudaTelemetryPath": project_path(output / "cuda-telemetry.json"),
            "cudaTelemetrySha256": sha256_file(output / "cuda-telemetry.json"),
            "localTaskCapsule": binding(output / "local-task-capsule.json"),
            "nextAction": "separately_authorized_structure_fact_first_phase0_engineering_qualification",
            "blockers": [],
            **state,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-terminal-v1",
            "status": "stage4_structure_fact_first_gradient_diagnostic_failed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "failureType": type(error).__name__,
            "failureMessage": str(error),
            "traceback": traceback.format_exc(),
            "completedSteps": steps,
            **state,
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 1


def load_project_autoencoder_checkpoint(config: dict) -> dict:
    return trainer.load_autoencoder_checkpoint(AUTOENCODER_PATH, config)


def gradient_norm(value) -> float:
    if value is None:
        return 0.0
    return float(value.detach().norm().cpu())


def is_structure_fact_authorization(authorization: dict) -> bool:
    return authorization.get("_diagnosticMode") == "structure_fact_first" or authorization.get(
        "schemaVersion"
    ) == "ai-painter-owner-stage4-structure-fact-first-gradient-diagnostic-gpu-authorization-v1"


def is_semantic_mixture_authorization(authorization: dict) -> bool:
    return authorization.get("_diagnosticMode") == "fact_conditioned_semantic_mixture" or (
        authorization.get("schemaVersion")
        == "ai-painter-owner-stage4-fact-conditioned-semantic-mixture-readonly-gpu-diagnostic-v1"
    )


def is_final_visible_rgb_authorization(authorization: dict) -> bool:
    return is_vegetation_luminance_authorization(authorization) or is_vegetation_repair_authorization(authorization) or authorization.get(
        "_diagnosticMode"
    ) == "final_visible_rgb_obligation" or (
        authorization.get("schemaVersion")
        == "ai-painter-owner-stage4-final-visible-rgb-readonly-gpu-qualification-v1"
    )


def is_vegetation_repair_authorization(authorization: dict) -> bool:
    return authorization.get("_diagnosticMode") == (
        "vegetation_final_visible_semantic_repair"
    ) or authorization.get("schemaVersion") == (
        "ai-painter-owner-stage4-vegetation-final-visible-readonly-gpu-qualification-v1"
    )


def is_vegetation_luminance_authorization(authorization: dict) -> bool:
    return authorization.get("_diagnosticMode") == (
        "vegetation_luminance_spatial_structure"
    ) or authorization.get("schemaVersion") == (
        "ai-painter-owner-stage4-vegetation-luminance-spatial-readonly-gpu-qualification-v1"
    )


def authorization_request_id(authorization: dict) -> str:
    if is_vegetation_luminance_authorization(authorization):
        return VEGETATION_LUMINANCE_REQUEST_ID
    if is_vegetation_repair_authorization(authorization):
        return VEGETATION_REPAIR_REQUEST_ID
    if is_final_visible_rgb_authorization(authorization):
        return FINAL_VISIBLE_RGB_REQUEST_ID
    if is_semantic_mixture_authorization(authorization):
        return SEMANTIC_MIXTURE_REQUEST_ID
    return STRUCTURE_FACT_REQUEST_ID if is_structure_fact_authorization(authorization) else REQUEST_ID


def authorization_scope(authorization: dict) -> str:
    if is_vegetation_luminance_authorization(authorization):
        return VEGETATION_LUMINANCE_SCOPE
    if is_vegetation_repair_authorization(authorization):
        return VEGETATION_REPAIR_SCOPE
    if is_final_visible_rgb_authorization(authorization):
        return FINAL_VISIBLE_RGB_SCOPE
    if is_semantic_mixture_authorization(authorization):
        return SEMANTIC_MIXTURE_SCOPE
    return STRUCTURE_FACT_SCOPE if is_structure_fact_authorization(authorization) else SCOPE


def authorization_sha256(authorization: dict) -> str:
    if is_vegetation_luminance_authorization(authorization):
        return authorization.get("_authorizationSha256") or sha256_file(
            resolve(VEGETATION_LUMINANCE_AUTHORIZATION_PATH)
        )
    if is_vegetation_repair_authorization(authorization):
        return authorization.get("_authorizationSha256") or sha256_file(
            resolve(VEGETATION_REPAIR_AUTHORIZATION_PATH)
        )
    if is_final_visible_rgb_authorization(authorization):
        return authorization.get("_authorizationSha256") or sha256_file(
            resolve(FINAL_VISIBLE_RGB_AUTHORIZATION_PATH)
        )
    if is_semantic_mixture_authorization(authorization):
        return authorization.get("_authorizationSha256") or sha256_file(
            resolve(SEMANTIC_MIXTURE_AUTHORIZATION_PATH)
        )
    if is_structure_fact_authorization(authorization):
        return authorization.get("_authorizationSha256") or sha256_file(resolve(STRUCTURE_FACT_AUTHORIZATION_PATH))
    return AUTHORIZATION_SHA256


def gradient_group_norms(named_parameters, gradients) -> dict:
    totals = {
        **{name: 0.0 for name in OBJECT_CHANNELS},
        "typedAdapters": 0.0,
        "routeTopology": 0.0,
        "baseDenoiser": 0.0,
    }
    for (parameter_name, _), gradient in zip(named_parameters, gradients):
        if gradient is None:
            continue
        value = float(gradient.detach().float().pow(2).sum().sqrt().cpu())
        matched = next((name for name in OBJECT_CHANNELS if name in parameter_name and (
            "v9_object_projection" in parameter_name or "v9_object_readout" in parameter_name
        )), None)
        if matched is not None:
            totals[matched] += value
        elif "typed_condition_adapter" in parameter_name:
            totals["typedAdapters"] += value
        elif "v9_route_topology_readout" in parameter_name:
            totals["routeTopology"] += value
        else:
            totals["baseDenoiser"] += value
    return totals


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def disk_free_bytes(path: Path) -> int:
    probe = path.resolve()
    while not probe.exists() and probe.parent != probe:
        probe = probe.parent
    return int(shutil.disk_usage(probe).free)


def resolve(path: Path) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value.resolve()
    local = (ROOT / value).resolve()
    if local.exists() or not str(value).replace("\\", "/").startswith(".runtime/"):
        return local
    return (Path("D:/AI-PET-WORLD-DATA/hot/runtime") / Path(*value.parts[1:])).resolve()


def project_path(path: Path) -> str:
    resolved = resolve(path)
    try:
        return str(resolved.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        runtime = Path("D:/AI-PET-WORLD-DATA/hot/runtime").resolve()
        return str(Path(".runtime") / resolved.relative_to(runtime)).replace("\\", "/")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(resolve(path).read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(resolve(path).read_text(encoding="utf-8"))


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(resolve(path))}


def write_json_exclusive(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_json_atomic(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())

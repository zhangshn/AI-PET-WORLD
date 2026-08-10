from __future__ import annotations

from argparse import ArgumentParser
import ast
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import inspect
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import traceback

import torch

from ai_painter.complete_world import (
    STAGE4_STRUCTURE_FACT_CHANNEL_ORDER,
    STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS,
    build_complete_world_system,
    resize_stage4_structure_fact_layout,
)
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import compile_ai_assisted_v9_r5_stage4_inactive_config as compiler
import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_authorization_policy import (
    POLICY_VERSION as STAGE_CONTROL_POLICY_VERSION,
    resolve_control_refactor_grant,
    resolve_stage_execution_grant,
)
from ai_painter_execution_grant import ALL_ACTIONS, ExecutionAction, validate_serialized_execution_grant
from ai_painter_preview_reproduction import fixed_preview_determinism_scope
from ai_painter_stage_mode_registry import (
    FORMAL_MODE_REGISTRY,
    ModeRegistry,
    ModeSpec,
    build_synthetic_extension_registry,
    resolve_stage_mode,
)


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = compiler.AUTHORIZATION_PATH
CONSUMPTION_PATH = compiler.CONSUMPTION_PATH
CONFIG_PATH = Path(
    ".runtime/ai-painter/v9-r5-stage4-cpu-support/20260809-161005213/inactive-config.json"
)
DATASET_PATH = compiler.DATASET_PATH
SOURCE_INDEX_PATH = compiler.SOURCE_INDEX_PATH
V8_CONFIG_PATH = compiler.SOURCE_CONFIG_PATH
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
MODEL_PATH = Path("ml/ai-painter/src/ai_painter/complete_world/model.py")
COMPILER_PATH = Path("ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py")
CPU_CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py")
SAMPLE_ID = compiler.SAMPLE_ID
EXPECTED_COUNTS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
OBJECT_CHANNELS = list(compiler.OBJECT_CHANNELS)
FIXED_EPOCHS = [1, 5, 10, 20, 30]
SMOKE_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809.json"
)
SMOKE_AUTHORIZATION_SHA256 = "e77183c6c0f6f94e0db75a5dc94f3c66f376e86c598f8164175a8551b7142e1e"
SMOKE_REQUEST_ID = "owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809"
SMOKE_SCOPE = "extend_v9_stage4_smoke_support_cpu_regress_preflight_then_one_sample194_30_epoch_gpu_smoke_only"
SMOKE_RUNNER_PATH = Path("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
SMOKE_DISPATCHER_PATH = Path("scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs")
CONTINUOUS_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/owner-authorized-stage4-continuous-closure-20260809.json"
)
CONTINUOUS_AUTHORIZATION_SHA256 = "fcc1ca399339b249d4dc2d12212af999a50720751a841143c6626c54bf12e1a4"
UNIFIED_PREVIEW_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-continuous-closures/20260809-184740761/unified-preview-contract/inactive-config.json"
)
VALIDATION_KERNEL_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/owner-authorized-stage4-validation-kernel-through-stage5-20260810.json"
)
VALIDATION_KERNEL_AUTHORIZATION_SHA256 = "73776d1fb0db6e5e0b0e5de8df12a5727238e08969943e5ab25173d64182c229"
VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-validation-kernel-through-stage5-20260810/implementation-consumption.json"
)
VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_SHA256 = "cb140b5552a92eddb99d634503bc1e1e1583f3dbe3b7597e7632e4a3723b10b1"
VALIDATION_KERNEL_ROOT = Path(
    ".runtime/ai-painter/stage4-validation-kernel-closures/20260810-023613404"
)
STAGE_CONTROL_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/owner-authorized-ai-painter-stage-control-convergence-20260810.json"
)
STAGE_CONTROL_AUTHORIZATION_SHA256 = "20e6249fc9fdfc398af7a9af37d5c3f1d370a89ecda006f40b0af65d0bd98ed3"
STAGE_CONTROL_ACTIVE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-validation-kernel-closures/20260810-023613404/model-smoke/model-smoke-20260810-validated-kernel/active-config.json"
)
STAGE_CONTROL_POLICY_PATH = Path("ml/ai-painter/scripts/ai_painter_authorization_policy.py")
DYNAMIC_VALIDATION_KERNEL_ACTIONS = {
    "stage4SmokeRunnerAuthorizationEntryModification": True,
    "cpuCheckerModification": True,
    "cpuPositiveNegativeRegression": True,
    "realNodeStartupPreflight": True,
    "pythonPreflight": True,
    "cudaResourcePreflight": True,
    "diskBudgetPreflight": True,
    "atomicGpuAuthorizationConsumption": True,
    "projectAutoencoderReadAndLoadFrozen": True,
    "v9FixedRandomInitialization": True,
    "optimizerCreation": True,
    "backwardExecution": True,
    "boundedModelWeightMutation": True,
    "singleThirtyEpochV9Smoke": True,
    "fiveBoundPreviewWrites": True,
    "seventeenDiagnosticMetricWrites": True,
    "machineReview": True,
    "smokeCheckpointWrite": True,
    "stage4FullTraining": False,
    "stage1OrStage2": False,
    "stage5StrictRevalidation": False,
    "formalInference": False,
    "checkpointPromotion": False,
    "ownerFormalVisualAcceptance": False,
    "runtimeFrame": False,
    "worldEntry": False,
    "worldRuntime": False,
    "automaticRetry": False,
    "machineReviewThresholdReduction": False,
    "failedPreviewPixelsAsTrainingTarget": False,
    "freeHyperparameterSearch": False,
}
DYNAMIC_VALIDATION_KERNEL_IMPLEMENTATION_ACTIONS = {
    "runnerDynamicAuthorizationContractSeparation": True,
    "cpuCheckerLogicalRuntimeFixturePathFix": True,
}
DYNAMIC_VALIDATION_KERNEL_EXECUTION_ACTIONS = {
    "cpuPositiveNegativeAuthorizationGate": True,
    "realNodeStartupPreflight": True,
    "pythonPreflight": True,
    "cudaResourcePreflight": True,
    "diskBudgetPreflight": True,
    "atomicGpuAuthorizationConsumption": True,
    "projectAutoencoderReadAndLoadFrozen": True,
    "v9FixedRandomInitialization": True,
    "optimizerCreation": True,
    "backwardExecution": True,
    "boundedModelWeightMutation": True,
    "singleThirtyEpochV9Smoke": True,
    "fiveBoundPreviewWrites": True,
    "seventeenDiagnosticMetricWrites": True,
    "machineReview": True,
    "smokeCheckpointWrite": True,
    "stage4FullTraining": False,
    "stage1OrStage2": False,
    "stage5StrictRevalidation": False,
    "formalInference": False,
    "checkpointPromotion": False,
    "ownerFormalVisualAcceptance": False,
    "runtimeFrame": False,
    "worldEntry": False,
    "worldRuntime": False,
    "automaticRetry": False,
    "machineReviewThresholdReduction": False,
    "failedPreviewPixelsAsTrainingTarget": False,
    "freeHyperparameterSearch": False,
}
DUAL_IDENTITY_IMPLEMENTATION_ACTIONS = {
    "separateImplementationAndGpuExecutionAuthorizationIdentities": True,
    "runnerDynamicGpuExecutionAuthorizationValidation": True,
    "trainerDynamicGpuExecutionAuthorizationLineageValidation": True,
    "cpuCheckerDualIdentityPositiveNegativeRegression": True,
    "realTrainerStartupPreflight": True,
    "legacyStage3Stage4V7V8ValidationKernelCompatibility": True,
}
FIXED_PREVIEW_SCHEDULE_IMPLEMENTATION_ACTIONS = {
    "gatePreviewReproductionByContractEpoch": True,
    "recordNonPreviewEpochSkip": True,
    "rejectMissingScheduledPreviewArtifact": True,
    "rejectPreviewReproductionHashMismatch": True,
    "preserveLegacyStage3Stage4V7V8Behavior": True,
    "cpuPositiveNegativeRegression": True,
    "realTrainerStartupPreflight": True,
}
DUAL_IDENTITY_GPU_AUTHORIZATION_SCHEMA = "ai-painter-stage4-v9-gpu-execution-authorization-v2"
DUAL_IDENTITY_IMPLEMENTATION_AUTHORIZATION_SCHEMA = "ai-painter-owner-implementation-authorization-v1"


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--report", type=Path)
    parser.add_argument("--support-contract", type=Path)
    parser.add_argument("--terminal", type=Path)
    parser.add_argument("--smoke-authorization", type=Path)
    parser.add_argument("--authorization-sha256")
    parser.add_argument("--implementation-attestation", type=Path)
    parser.add_argument("--unified-preview-contract", action="store_true")
    parser.add_argument("--validation-kernel-contract", action="store_true")
    parser.add_argument("--validation-kernel-model-smoke-contract", action="store_true")
    parser.add_argument("--stage-control-convergence-contract", action="store_true")
    parser.add_argument("--structure-fact-first-phase0-contract", action="store_true")
    parser.add_argument("--structure-fact-first-phase0-bc-continuation-contract", action="store_true")
    parser.add_argument("--structure-fact-first-topology-transfer-contract", action="store_true")
    parser.add_argument("--implementation-authorization", type=Path)
    parser.add_argument("--implementation-consumption", type=Path)
    parser.add_argument("--owner-action-request", type=Path)
    parser.add_argument("--phase0-a-authorization", type=Path)
    parser.add_argument("--phase0-bc-authorization", type=Path)
    parser.add_argument("--phase0-a-terminal", type=Path)
    parser.add_argument("--phase0-a-finalization", type=Path)
    parser.add_argument("--phase0-a-report", type=Path)
    parser.add_argument("--phase0-a-preflight", type=Path)
    parser.add_argument("--phase0-a-consumption", type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--historical-baseline-input", type=Path)
    parser.add_argument("--new-baseline-output", type=Path)
    args = parser.parse_args()
    if args.structure_fact_first_phase0_bc_continuation_contract:
        return run_structure_fact_first_phase0_bc_continuation_contract_regression(args)
    if args.structure_fact_first_topology_transfer_contract:
        return run_structure_fact_first_topology_transfer_contract_regression(args)
    if args.structure_fact_first_phase0_contract:
        return run_structure_fact_first_phase0_contract_regression(args)
    if args.stage_control_convergence_contract:
        return run_stage_control_convergence_contract_regression(args)
    if args.validation_kernel_model_smoke_contract:
        if args.smoke_authorization is not None:
            return run_dynamic_validation_kernel_model_smoke_contract_regression(args)
        return run_validation_kernel_model_smoke_contract_regression(args)
    if args.validation_kernel_contract:
        return run_validation_kernel_contract_regression(args)
    if args.unified_preview_contract:
        return run_unified_preview_contract_regression(args)
    if args.smoke_authorization is not None:
        return run_smoke_authorization_regression(args)
    if args.report is None or args.support_contract is None or args.terminal is None:
        parser.error("--report, --support-contract and --terminal are required for the V9 CPU support mode")
    try:
        authorization = compiler.validate_authorization()
        validate_output_paths(authorization, args)
        config = read_json(resolve(CONFIG_PATH))
        package = read_json(resolve(DATASET_PATH))
        positive, negative, evidence = run_regressions(config, package)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-r5-stage4-v9-cpu-support-regression-report-v1",
            "status": (
                "passed_cpu_only_v9_object_semantic_alignment_not_active"
                if not failed_positive and not failed_negative
                else "failed_closed_cpu_only_v9_object_semantic_alignment_not_active"
            ),
            **timestamps("recordedAt"),
            "authorization": binding(AUTHORIZATION_PATH),
            "implementationConsumption": binding(CONSUMPTION_PATH),
            "inactiveConfig": binding(CONFIG_PATH),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "evidence": evidence,
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"V9 CPU regression failed: {failed_positive}:{failed_negative}")
        support = {
            "schemaVersion": "ai-painter-r5-stage4-v9-cpu-support-contract-v1",
            "status": "v9_cpu_support_verified_inactive_gpu_not_started",
            **timestamps("recordedAt"),
            "architectureId": config["denoiserArchitecture"],
            "contractId": "stage4_object_semantic_decoder_alignment_v9_v1",
            "conditionChannelCount": 23,
            "objectSemanticChannels": OBJECT_CHANNELS,
            "projectionScales": ["up1", "up0"],
            "projectionCount": 8,
            "preservedRouteTopologyChannels": ["terrain_path_ground", "route_required_boundary"],
            "requiredBoundarySides": ["west"],
            "legalSupervisionSources": config["training"]["stage4ObjectSemanticDecoderAlignment"]
            ["objectSemanticTrainingSupervision"]["allowedSources"],
            "reusedWeightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "diagnosticManifestMetricCount": 17,
            "diagnosticManifestFields": list(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "actualSplitCounts": evidence["actualSplitCounts"],
            "fixedPreviewEpochs": FIXED_EPOCHS,
            "allowedExecutionAfterThisContract": (
                "separately_authorized_readonly_v9_gpu_forward_and_gradient_routing_diagnostic"
            ),
            "checkpointReadAuthorized": False,
            "optimizerAuthorized": False,
            "backwardAuthorized": False,
            "gpuAuthorized": False,
            "trainingAuthorized": False,
        }
        write_json_exclusive(args.support_contract, support)
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v9-cpu-support-terminal-v1",
            "status": "v9_stage4_cpu_support_and_manifest_registry_completed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "inactiveConfigPath": project_path(CONFIG_PATH),
            "inactiveConfigSha256": sha256_file(resolve(CONFIG_PATH)),
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(resolve(args.report)),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(resolve(args.support_contract)),
            "nextAction": "separately_authorized_readonly_v9_gpu_forward_and_gradient_routing_diagnostic",
            "blockers": [],
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(resolve(args.terminal)),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal_path = resolve(args.terminal)
        if not terminal_path.exists():
            terminal = {
                "schemaVersion": "ai-painter-r5-stage4-v9-cpu-support-terminal-v1",
                "status": "v9_stage4_cpu_support_and_manifest_registry_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(args.report) if resolve(args.report).exists() else None,
                "reportSha256": sha256_file(resolve(args.report)) if resolve(args.report).exists() else None,
                "checkpointRead": False,
                "optimizerCreated": False,
                "backwardMethodExecuted": False,
                "modelWeightsModified": False,
                "gpuUsed": False,
                "trainingStarted": False,
                "automaticRetryStarted": False,
            }
            write_json_exclusive(args.terminal, terminal)
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_stage_control_convergence_contract_regression(args) -> int:
    baseline_output_argument = args.new_baseline_output or args.baseline
    if any(value is None for value in (
        args.report,
        args.support_contract,
        args.terminal,
        args.historical_baseline_input,
        baseline_output_argument,
    )):
        raise ValueError(
            "Stage control convergence mode requires --report, --support-contract, --terminal, "
            "--historical-baseline-input and --new-baseline-output"
        )
    report_path = resolve(args.report)
    support_path = resolve(args.support_contract)
    terminal_path = resolve(args.terminal)
    historical_baseline_path = resolve(args.historical_baseline_input)
    baseline_path = resolve(baseline_output_argument)
    if historical_baseline_path == baseline_path:
        raise ValueError("historical baseline input and new baseline output must be different paths")
    forbidden_output = report_path.parent / "forbidden-training-output"
    positive: dict[str, bool] = {}
    negative: dict[str, bool] = {}
    evidence: dict = {}

    def rejected(callable_value) -> bool:
        try:
            callable_value()
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    try:
        if forbidden_output.exists():
            raise ValueError("Stage control CPU dry-run output directory already exists")
        historical_baseline_sha256_before = sha256_file(historical_baseline_path)
        historical_baseline = read_json(historical_baseline_path)
        if (
            historical_baseline.get("schemaVersion")
            != "ai-painter-stage-control-behavior-baseline-v1"
            or historical_baseline.get("status")
            != "captured_before_behavior_preserving_control_boundary_convergence"
        ):
            raise ValueError("historical Stage control behavior baseline is invalid")
        authorization = read_json(resolve(STAGE_CONTROL_AUTHORIZATION_PATH))
        control_grant = resolve_control_refactor_grant(
            STAGE_CONTROL_AUTHORIZATION_PATH,
            STAGE_CONTROL_AUTHORIZATION_SHA256,
            project_root=ROOT,
        )
        inactive_config = read_json(resolve(CONFIG_PATH))
        active_config = read_json(resolve(STAGE_CONTROL_ACTIVE_CONFIG_PATH))
        inactive_mode = resolve_stage_mode(inactive_config)
        active_mode = resolve_stage_mode(active_config)
        inactive_grant = resolve_stage_execution_grant(inactive_config, project_root=ROOT)
        active_grant = resolve_stage_execution_grant(
            active_config, project_root=ROOT, verify_owner_files=True
        )
        formal_modes = FORMAL_MODE_REGISTRY.snapshot()
        synthetic_registry = build_synthetic_extension_registry()
        synthetic_spec = synthetic_registry.resolve_mode_id("synthetic_stage4_extension")
        runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
        preview_source = resolve(
            Path("ml/ai-painter/scripts/ai_painter_preview_reproduction.py")
        ).read_text(encoding="utf-8")

        control_allowed = {action.value for action in control_grant.allowed_actions}
        positive = {
            "immutableOwnerAuthorizationIdentityValid": sha256_file(resolve(STAGE_CONTROL_AUTHORIZATION_PATH))
            == STAGE_CONTROL_AUTHORIZATION_SHA256,
            "policyVersionIsSingleAndVersioned": STAGE_CONTROL_POLICY_VERSION
            == "ai-painter-stage-control-authorization-policy-v1",
            "controlGrantIsReadOnly": control_allowed
            == {
                "select_bound_sample",
                "inspect_autoencoder_identity",
                "inspect_checkpoint_identity",
            },
            "controlGrantClassifiesEveryAction": len(control_grant.allowed_actions)
            + len(control_grant.explicitly_denied_actions)
            == len(ExecutionAction),
            "inactiveV9ModeResolvedByRegistry": inactive_mode.mode_id == "v9_stage4_inactive",
            "activeV9ModeResolvedByRegistry": active_mode.mode_id
            == "v9_stage4_validation_kernel_smoke",
            "activeV9OwnerIdentityVerified": active_grant.authorization_identity.get("modeId")
            == "v9_stage4_validation_kernel_smoke",
            "sample194RemainsValidation": active_grant.dataset_constraints.get("sampleId")
            == SAMPLE_ID
            and active_grant.dataset_constraints.get("selectedSplit") == "validation",
            "datasetSplitRemains4844": active_grant.dataset_constraints.get("splitCounts")
            == EXPECTED_COUNTS,
            "westTopologyRemainsBound": active_grant.dataset_constraints.get(
                "requiredBoundarySides"
            )
            == ["west"],
            "inactiveModeCannotExecuteTraining": not inactive_grant.permits(
                ExecutionAction.CREATE_OPTIMIZER
            )
            and not inactive_grant.permits(ExecutionAction.EXECUTE_BACKWARD),
            "formalRegistryContainsLegacyModes": {
                "v7_r5_stage3_smoke",
                "v7_r5_stage3_coverage_smoke",
                "v7_r5_stage4_full_training",
                "v7_r5_stage4_bounded_smoke",
                "v8_stage4_smoke",
                "v9_stage4_smoke",
                "v9_stage4_unified_preview_smoke",
                "v9_stage4_validation_kernel_smoke",
            }.issubset({spec.mode_id for spec in formal_modes.values()}),
            "syntheticExtensionUsesRegistryOnly": synthetic_spec.authorization_status
            == "synthetic_inactive_stage4_extension_contract_test_only"
            and "synthetic_inactive_stage4_extension_contract_test_only" not in trainer_source,
            "modeRegistryContainsNoTrainingAlgorithm": all(
                token not in resolve(
                    Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
                ).read_text(encoding="utf-8")
                for token in ("optimizer.step(", ".backward(", "torch.load(", "model.forward(")
            ),
            "runnerResolvesStatusesFromPolicy": "--mode-id" in runner_source
            and "resolveStageControlMode" in runner_source
            and all(
                literal not in runner_source
                for literal in (
                    'training.trainingAuthorizationStatus = "owner_authorized_v8_stage4_single_sample_gpu_smoke"',
                    'training.trainingAuthorizationStatus = "owner_authorized_v9_stage4_single_sample_gpu_smoke"',
                    'training.trainingAuthorizationStatus = "owner_authorized_v9_stage4_unified_preview_pipeline_single_sample_gpu_smoke"',
                    'training.trainingAuthorizationStatus = "owner_authorized_v9_stage4_validation_kernel_single_sample_gpu_smoke"',
                )
            ),
            "trainerConsumesSharedPolicy": "resolve_stage_execution_grant(" in trainer_source
            and "resolve_stage_mode(" in trainer_source,
            "previewReproductionBoundaryExtracted": "fixed_preview_determinism_scope" in preview_source
            and "compare_preview_reproduction_identities" in preview_source
            and "ai_painter_preview_reproduction import" in trainer_source,
            "historicalBaselineReadOnlyIdentityStable": sha256_file(historical_baseline_path)
            == historical_baseline_sha256_before,
            "historicalLegacyModesRemainRegistered": set(
                historical_baseline.get("legacyModeIds", [])
            ).issubset({spec.mode_id for spec in formal_modes.values()}),
            "baselineInputAndOutputAreSeparated": historical_baseline_path != baseline_path
            and not baseline_path.exists(),
        }

        serialized = control_grant.as_dict()
        unknown_action = deepcopy(serialized)
        unknown_action["allowedActions"] = [*unknown_action["allowedActions"], "start_training_now"]
        conflict = deepcopy(serialized)
        conflict["explicitlyDeniedActions"] = [
            *conflict["explicitlyDeniedActions"],
            conflict["allowedActions"][0],
        ]
        incomplete = deepcopy(serialized)
        incomplete["explicitlyDeniedActions"] = incomplete["explicitlyDeniedActions"][1:]
        forged = deepcopy(serialized)
        forged["decisionDigest"] = "0" * 64
        unknown_state = deepcopy(active_config)
        unknown_state["training"]["trainingAuthorizationStatus"] = "unknown_stage4_state"
        architecture_mismatch = deepcopy(active_config)
        architecture_mismatch["denoiserArchitecture"] = "multiscale_condition_unet_v8_stage4_decoded_alignment"
        inactive_action = deepcopy(inactive_config)
        inactive_action["training"]["ownerTrainingAuthorization"] = {
            "status": "not_authorized_candidate_only",
            "gpuTrainingAuthorizedNow": True,
        }

        negative = {
            "unknownGrantActionRejected": rejected(
                lambda: validate_serialized_execution_grant(unknown_action)
            ),
            "conflictingGrantActionRejected": rejected(
                lambda: validate_serialized_execution_grant(conflict)
            ),
            "incompleteGrantClassificationRejected": rejected(
                lambda: validate_serialized_execution_grant(incomplete)
            ),
            "forgedDecisionDigestRejected": rejected(
                lambda: validate_serialized_execution_grant(forged)
            ),
            "unknownStageStatusRejected": rejected(lambda: resolve_stage_mode(unknown_state)),
            "architectureMismatchRejected": rejected(
                lambda: resolve_stage_mode(architecture_mismatch)
            ),
            "duplicateModeRejected": rejected(
                lambda: ModeRegistry(
                    (
                        ModeSpec("duplicate", "duplicate-status", "arch", 4, "cpu_inactive", "test_adapter", None, False),
                        ModeSpec("duplicate", "other-status", "arch", 4, "cpu_inactive", "test_adapter", None, False),
                    )
                )
            ),
            "inactiveExecutionActionRejected": rejected(
                lambda: resolve_stage_execution_grant(inactive_action, project_root=ROOT)
            ),
            "pathTraversalRejected": rejected(
                lambda: resolve_control_refactor_grant(
                    Path("../outside-owner-authorization.json"),
                    STAGE_CONTROL_AUTHORIZATION_SHA256,
                    project_root=ROOT,
                )
            ),
            "checkpointWeightLoadDenied": not control_grant.permits(
                ExecutionAction.LOAD_PARENT_DENOISER
            )
            and not control_grant.permits(ExecutionAction.LOAD_AUTOENCODER),
            "optimizerBackwardGpuTrainingDenied": not control_grant.permits(
                ExecutionAction.CREATE_OPTIMIZER
            )
            and not control_grant.permits(ExecutionAction.EXECUTE_BACKWARD)
            and not control_grant.permits(ExecutionAction.MUTATE_MODEL_WEIGHTS),
            "formalRegistryRejectsSyntheticUntilRegistered": rejected(
                lambda: FORMAL_MODE_REGISTRY.resolve_mode_id("synthetic_stage4_extension")
            ),
        }

        source_authorization = read_json(resolve(SMOKE_AUTHORIZATION_PATH))
        dataset_path = source_authorization["bindings"]["datasetManifest"]["path"]
        autoencoder_path = source_authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]
        common_command = [
            sys.executable,
            str(resolve(TRAINER_PATH)),
            "--config",
            str(resolve(STAGE_CONTROL_ACTIVE_CONFIG_PATH)),
            "--dataset-package",
            str(resolve(Path(dataset_path))),
            "--autoencoder-checkpoint",
            str(resolve(Path(autoencoder_path))),
            "--output-dir",
            str(forbidden_output),
            "--resolution-stage",
            "0",
            "--single-sample-overfit-smoke",
            "--overfit-epochs",
            "30",
            "--overfit-evaluation-interval",
            "5",
            "--preflight-only",
            "--stage-control-dry-run",
            "--stage-control-authorization",
            str(resolve(STAGE_CONTROL_AUTHORIZATION_PATH)),
            "--stage-control-authorization-sha256",
            STAGE_CONTROL_AUTHORIZATION_SHA256,
        ]
        environment = {**os.environ, "PYTHONUTF8": "1", "CUDA_VISIBLE_DEVICES": ""}
        positive_run = subprocess.run(
            [*common_command, "--overfit-sample-id", SAMPLE_ID],
            cwd=ROOT,
            env=environment,
            text=True,
            encoding="utf-8",
            capture_output=True,
            timeout=180,
        )
        negative_run = subprocess.run(
            [*common_command, "--overfit-sample-id", "not-the-authorized-sample"],
            cwd=ROOT,
            env=environment,
            text=True,
            encoding="utf-8",
            capture_output=True,
            timeout=180,
        )
        runner_contract = subprocess.run(
            [
                "node",
                str(resolve(SMOKE_RUNNER_PATH)),
                "--stage4-validation-kernel-model-smoke",
                "--gpu-authorization",
                str(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH)),
                "--cpu-contract-only",
            ],
            cwd=ROOT,
            env=environment,
            text=True,
            encoding="utf-8",
            capture_output=True,
            timeout=60,
        )
        positive["realTrainerStartupCpuDryRunPassed"] = positive_run.returncode == 0
        positive["dryRunStoppedBeforeTrainingOutputCreation"] = not forbidden_output.exists()
        positive["dryRunReportsValidationSampleAndMode"] = all(
            token in positive_run.stdout
            for token in (
                '"selectedSplit": "validation"',
                '"stageControlDryRun": true',
                '"modeId": "v9_stage4_validation_kernel_smoke"',
            )
        )
        positive["nodeRunnerRealCpuContractPassed"] = runner_contract.returncode == 0
        positive["nodeRunnerCpuContractStartedNoGpu"] = '"gpuStarted": false' in runner_contract.stdout
        negative["wrongAuthorizedSampleRejectedByRealCallChain"] = negative_run.returncode != 0
        negative["negativeDryRunAlsoCreatedNoOutput"] = not forbidden_output.exists()

        with fixed_preview_determinism_scope(False):
            preview_scope_cpu_only = True
        positive["previewScopeCanRemainInactiveDuringCpuContract"] = preview_scope_cpu_only

        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        evidence = {
            "realDryRun": {
                "exitCode": positive_run.returncode,
                "stdout": positive_run.stdout,
                "stderr": positive_run.stderr,
            },
            "wrongSampleDryRun": {
                "exitCode": negative_run.returncode,
                "stdout": negative_run.stdout,
                "stderr": negative_run.stderr,
            },
            "nodeRunnerCpuContract": {
                "exitCode": runner_contract.returncode,
                "stdout": runner_contract.stdout,
                "stderr": runner_contract.stderr,
            },
            "controlExecutionGrant": control_grant.as_dict(),
            "activeStageExecutionGrant": active_grant.as_dict(),
            "formalModeIds": sorted(spec.mode_id for spec in formal_modes.values()),
        }
        baseline = {
            "schemaVersion": "ai-painter-stage-control-behavior-baseline-v1",
            "status": "captured_after_behavior_preserving_control_boundary_compatibility_verification",
            **timestamps("recordedAt"),
            "historicalBaselineInput": {
                "path": project_path(historical_baseline_path),
                "sha256": historical_baseline_sha256_before,
                "readOnly": True,
            },
            "authorization": binding(STAGE_CONTROL_AUTHORIZATION_PATH),
            "boundBaselineFiles": authorization["bindings"],
            "legacyModeIds": evidence["formalModeIds"],
            "fixedTaskIdentity": authorization["fixedTaskIdentity"],
            "algorithmAndDataChangesAuthorized": False,
        }
        write_json_exclusive(baseline_path, baseline)
        report = {
            "schemaVersion": "ai-painter-stage-control-convergence-cpu-regression-report-v1",
            "status": "passed_cpu_only_control_boundaries_behavior_equivalent"
            if not failed_positive and not failed_negative
            else "failed_closed_cpu_only_control_boundaries",
            **timestamps("recordedAt"),
            "authorization": binding(STAGE_CONTROL_AUTHORIZATION_PATH),
            "baseline": binding(baseline_path),
            "historicalBaselineInput": {
                "path": project_path(historical_baseline_path),
                "sha256": historical_baseline_sha256_before,
                "sha256After": sha256_file(historical_baseline_path),
                "unchanged": sha256_file(historical_baseline_path)
                == historical_baseline_sha256_before,
            },
            "implementationFiles": {
                "authorizationPolicy": binding(Path("ml/ai-painter/scripts/ai_painter_authorization_policy.py")),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "previewReproduction": binding(Path("ml/ai-painter/scripts/ai_painter_preview_reproduction.py")),
                "trainer": binding(TRAINER_PATH),
                "smokeRunner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH),
                "inactiveConfigCompiler": binding(COMPILER_PATH),
            },
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "evidence": evidence,
            "checkpointDeserialized": False,
            "checkpointWeightsLoaded": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(report_path, report)
        if failed_positive or failed_negative:
            raise ValueError(
                f"Stage control convergence CPU regression failed: {failed_positive}:{failed_negative}"
            )
        support = {
            "schemaVersion": "ai-painter-stage-control-convergence-support-contract-v1",
            "status": "stage3_stage4_shared_control_policy_verified_cpu_only",
            **timestamps("recordedAt"),
            "policyVersion": STAGE_CONTROL_POLICY_VERSION,
            "physicalControlModules": [
                "ai_painter_authorization_policy.py",
                "ai_painter_execution_grant.py",
                "ai_painter_stage_mode_registry.py",
                "ai_painter_preview_reproduction.py",
            ],
            "singleTrainerEntry": project_path(TRAINER_PATH),
            "implementationFiles": {
                "authorizationPolicy": binding(Path("ml/ai-painter/scripts/ai_painter_authorization_policy.py")),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "previewReproduction": binding(Path("ml/ai-painter/scripts/ai_painter_preview_reproduction.py")),
                "trainer": binding(TRAINER_PATH),
                "smokeRunner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH),
            },
            "runnerConsumesSharedPolicy": True,
            "datasetCheckpointEvidenceRemainInTrainer": True,
            "modeRegistryContainsTrainingAlgorithm": False,
            "checkpointIdentityInspectionOnly": True,
            "checkpointWeightReadOrLoadAuthorized": False,
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        }
        write_json_exclusive(support_path, support)
        terminal = {
            "schemaVersion": "ai-painter-stage-control-convergence-terminal-v1",
            "status": "stage3_stage4_control_layer_convergence_completed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "supportContractPath": project_path(support_path),
            "supportContractSha256": sha256_file(support_path),
            "baselinePath": project_path(baseline_path),
            "baselineSha256": sha256_file(baseline_path),
            "historicalBaselineInputPath": project_path(historical_baseline_path),
            "historicalBaselineInputSha256": historical_baseline_sha256_before,
            "blockers": [],
            "nextAction": "owner_review_then_separately_authorize_one_v9_validation_kernel_model_smoke",
            "checkpointDeserialized": False,
            "checkpointWeightsLoaded": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(terminal_path, terminal)
        print(
            json.dumps(
                {
                    **terminal,
                    "terminalPath": project_path(terminal_path),
                    "terminalSha256": sha256_file(terminal_path),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except Exception as error:
        if not report_path.exists():
            write_json_exclusive(
                report_path,
                {
                    "schemaVersion": "ai-painter-stage-control-convergence-cpu-regression-report-v1",
                    "status": "failed_closed_cpu_only_control_boundaries",
                    **timestamps("recordedAt"),
                    "positive": positive,
                    "negative": negative,
                    "failedPositiveKeys": [key for key, value in positive.items() if value is not True],
                    "failedNegativeKeys": [key for key, value in negative.items() if value is not True],
                    "failureType": type(error).__name__,
                    "failureMessage": str(error),
                    "traceback": traceback.format_exc(),
                    "evidence": evidence,
                    "checkpointDeserialized": False,
                    "checkpointWeightsLoaded": False,
                    "optimizerCreated": False,
                    "backwardMethodExecuted": False,
                    "modelWeightsModified": False,
                    "gpuUsed": False,
                    "trainingStarted": False,
                },
            )
        if not terminal_path.exists():
            write_json_exclusive(
                terminal_path,
                {
                    "schemaVersion": "ai-painter-stage-control-convergence-terminal-v1",
                    "status": "stage3_stage4_control_layer_convergence_failed_closed",
                    **timestamps("recordedAt"),
                    "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                    "failureType": type(error).__name__,
                    "failureMessage": str(error),
                    "reportPath": project_path(report_path),
                    "reportSha256": sha256_file(report_path),
                    "checkpointDeserialized": False,
                    "checkpointWeightsLoaded": False,
                    "optimizerCreated": False,
                    "backwardMethodExecuted": False,
                    "modelWeightsModified": False,
                    "gpuUsed": False,
                    "trainingStarted": False,
                    "automaticRetryStarted": False,
                },
            )
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_smoke_authorization_regression(args) -> int:
    authorization_path = resolve(args.smoke_authorization)
    report_path = resolve(args.report) if args.report is not None else None
    attestation_path = resolve(args.implementation_attestation) if args.implementation_attestation is not None else None
    terminal_path = resolve(args.terminal) if args.terminal is not None else None
    if report_path is None or attestation_path is None or terminal_path is None:
        raise ValueError("V9 Smoke CPU mode requires report, implementation attestation and terminal paths")
    try:
        if project_path(authorization_path) != project_path(SMOKE_AUTHORIZATION_PATH):
            raise ValueError("V9 Smoke immutable authorization path changed")
        if sha256_file(authorization_path) != SMOKE_AUTHORIZATION_SHA256:
            raise ValueError("V9 Smoke immutable authorization SHA-256 changed")
        authorization = read_json(authorization_path)
        validate_smoke_authorization_document(authorization, verify_files=True)
        validate_smoke_output_paths(authorization, report_path, attestation_path, terminal_path)
        validate_smoke_implementation_consumption(authorization)

        config = read_json(resolve(CONFIG_PATH))
        package = read_json(resolve(DATASET_PATH))
        base_positive, base_negative, base_evidence = run_regressions(config, package)
        syntax = smoke_source_and_syntax_regression()
        positive = {
            "immutableAuthorizationIdentityValid": True,
            "implementationAuthorizationAtomicallyConsumed": True,
            "v9InactiveConfigStillValid": all(base_positive.values()),
            "v9CpuNegativeBoundariesStillReject": all(base_negative.values()),
            "legacyV7V8CompatibilityPreserved": (
                base_positive.get("legacyV8TrainerContractPreserved") is True
                and base_positive.get("legacyV8ModelReadoutPreserved") is True
                and base_positive.get("legacyV7ModelForwardPreserved") is True
            ),
            **syntax,
        }
        negative = smoke_authorization_negative_regression(authorization)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-r5-stage4-v9-smoke-cpu-authorization-regression-report-v1",
            "status": (
                "passed_v9_stage4_smoke_cpu_authorization_regression"
                if not failed_positive and not failed_negative
                else "failed_closed_v9_stage4_smoke_cpu_authorization_regression"
            ),
            **timestamps("recordedAt"),
            "authorization": binding(authorization_path),
            "implementationConsumption": binding(Path(authorization["implementation"]["implementationConsumptionPath"])),
            "runner": binding(SMOKE_RUNNER_PATH),
            "dispatcher": binding(SMOKE_DISPATCHER_PATH),
            "trainer": binding(TRAINER_PATH),
            "cpuChecker": binding(CPU_CHECKER_PATH),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "baseV9CpuRegression": {
                "positive": base_positive,
                "negative": base_negative,
                "evidence": base_evidence,
            },
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(report_path, report)
        if failed_positive or failed_negative:
            raise ValueError(f"V9 Smoke CPU regression failed: {failed_positive}:{failed_negative}")

        attestation = {
            "schemaVersion": "ai-painter-r5-stage4-v9-smoke-implementation-attestation-v1",
            "status": "v9_stage4_smoke_implementation_cpu_verified",
            **timestamps("recordedAt"),
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": sha256_file(authorization_path),
            "runnerPath": project_path(SMOKE_RUNNER_PATH),
            "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
            "dispatcherPath": project_path(SMOKE_DISPATCHER_PATH),
            "dispatcherSha256": sha256_file(resolve(SMOKE_DISPATCHER_PATH)),
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "cpuReportPath": project_path(report_path),
            "cpuReportSha256": sha256_file(report_path),
            "legacyV7V8CompatibilityPreserved": True,
            "gpuStarted": False,
            "checkpointRead": False,
            "optimizerCreated": False,
            "trainingStarted": False,
        }
        write_json_exclusive(attestation_path, attestation)

        executable = subprocess.run(
            [
                "node", str(resolve(SMOKE_DISPATCHER_PATH)),
                "--v9-object-alignment",
                "--gpu-authorization", str(authorization_path),
                "--cpu-contract-only",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )
        if executable.returncode != 0:
            raise ValueError(
                "V9 Smoke real runner CPU authorization call failed: "
                f"exit={executable.returncode};stdout={executable.stdout};stderr={executable.stderr}"
            )
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v9-smoke-cpu-terminal-v1",
            "status": "v9_stage4_smoke_cpu_gate_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "implementationAttestationPath": project_path(attestation_path),
            "implementationAttestationSha256": sha256_file(attestation_path),
            "realRunnerCpuContractCall": {
                "exitCode": executable.returncode,
                "stdout": executable.stdout,
                "stderr": executable.stderr,
            },
            "gpuAuthorizationConsumed": False,
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(terminal_path, terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(terminal_path),
            "terminalSha256": sha256_file(terminal_path),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not terminal_path.exists():
            failure = {
                "schemaVersion": "ai-painter-r5-stage4-v9-smoke-cpu-terminal-v1",
                "status": "v9_stage4_smoke_cpu_gate_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "error": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(report_path) if report_path.exists() else None,
                "reportSha256": sha256_file(report_path) if report_path.exists() else None,
                "implementationAttestationPath": project_path(attestation_path) if attestation_path.exists() else None,
                "implementationAttestationSha256": sha256_file(attestation_path) if attestation_path.exists() else None,
                "gpuAuthorizationConsumed": False,
                "checkpointRead": False,
                "optimizerCreated": False,
                "backwardMethodExecuted": False,
                "modelWeightsModified": False,
                "gpuUsed": False,
                "trainingStarted": False,
                "automaticRetryStarted": False,
            }
            write_json_exclusive(terminal_path, failure)
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_validation_kernel_contract_regression(args) -> int:
    if args.report is None or args.support_contract is None or args.terminal is None or args.implementation_attestation is None:
        raise ValueError("validation kernel CPU mode requires report, support contract, terminal and implementation attestation paths")
    report_path = resolve(args.report)
    support_path = resolve(args.support_contract)
    terminal_path = resolve(args.terminal)
    attestation_path = resolve(args.implementation_attestation)
    try:
        if sha256_file(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH)) != VALIDATION_KERNEL_AUTHORIZATION_SHA256:
            raise ValueError("validation kernel immutable Owner authorization SHA-256 changed")
        if sha256_file(resolve(VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH)) != VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_SHA256:
            raise ValueError("validation kernel implementation consumption SHA-256 changed")
        authorization = read_json(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH))
        consumption = read_json(resolve(VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH))
        request_id = "owner-authorized-stage4-validation-kernel-through-stage5-20260810"
        scope = "stage4_validation_kernel_then_single_smoke_full_training_and_stage5_strict_revalidation"
        if (
            authorization.get("requestId") != request_id
            or authorization.get("status") != "resolved_owner_authorized"
            or authorization.get("ownerDecision", {}).get("commandRef") != request_id
            or authorization.get("ownerDecision", {}).get("scope") != scope
            or consumption.get("status") != "stage4_validation_kernel_implementation_authorization_atomically_consumed"
            or consumption.get("authorizationSha256") != VALIDATION_KERNEL_AUTHORIZATION_SHA256
            or consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("validation kernel authorization or implementation consumption identity is invalid")
        for key in ("previousStage4Terminal", "previousStage4Finalization"):
            value = authorization.get("bindings", {}).get(key, {})
            if not value.get("path") or not value.get("sha256") or sha256_file(resolve(Path(value["path"]))) != value["sha256"]:
                raise ValueError(f"validation kernel prior evidence binding changed: {key}")
        source_authorization = read_json(resolve(SMOKE_AUTHORIZATION_PATH))
        if sha256_file(resolve(SMOKE_AUTHORIZATION_PATH)) != SMOKE_AUTHORIZATION_SHA256:
            raise ValueError("validation kernel source V9 authorization changed")
        for key in ("v9InactiveConfig", "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint"):
            value = source_authorization.get("bindings", {}).get(key, {})
            if sha256_file(resolve(Path(value.get("path", "")))) != value.get("sha256"):
                raise ValueError(f"validation kernel source V9 binding changed: {key}")

        config = read_json(resolve(CONFIG_PATH))
        package = read_json(resolve(DATASET_PATH))
        base_positive, base_negative, base_evidence = run_regressions(config, package)
        trainer_main_source = inspect.getsource(trainer.main)
        trainer_epoch_signature = inspect.signature(trainer.train_epoch)
        trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
        runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        previous_debug_mode = torch.get_deterministic_debug_mode()
        previous_cudnn_deterministic = bool(torch.backends.cudnn.deterministic)
        previous_cudnn_benchmark = bool(torch.backends.cudnn.benchmark)
        with trainer.stage4_fixed_preview_determinism_scope(True):
            scope_enabled = (
                torch.are_deterministic_algorithms_enabled()
                and torch.backends.cudnn.deterministic is True
                and torch.backends.cudnn.benchmark is False
            )
        scope_restored = (
            torch.get_deterministic_debug_mode() == previous_debug_mode
            and bool(torch.backends.cudnn.deterministic) == previous_cudnn_deterministic
            and bool(torch.backends.cudnn.benchmark) == previous_cudnn_benchmark
        )
        runner = subprocess.run(
            [
                "node", str(resolve(SMOKE_RUNNER_PATH)),
                "--stage4-validation-kernel-phase0",
                "--gpu-authorization", str(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH)),
                "--cpu-contract-only",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120,
        )
        inactive_execution = subprocess.run(
            [
                str(ROOT / "ml/ai-painter/.venv/Scripts/python.exe"), str(resolve(TRAINER_PATH)),
                "--config", str(resolve(CONFIG_PATH)),
                "--dataset-package", str(resolve(DATASET_PATH)),
                "--autoencoder-checkpoint", str(resolve(Path(source_authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))),
                "--output-dir", str(resolve(VALIDATION_KERNEL_ROOT / "cpu-negative-output-must-not-exist")),
                "--resolution-stage", "0", "--single-sample-overfit-smoke",
                "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30",
                "--overfit-evaluation-interval", "5",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120,
        )
        positive = {
            "immutableOwnerAuthorizationValid": True,
            "implementationAuthorizationAtomicallyConsumed": True,
            "priorFailureEvidenceBound": True,
            "sourceV9ConfigDatasetAndAutoencoderBound": True,
            "legacyV9CpuPositiveRegressionPreserved": all(base_positive.values()),
            "legacyV9CpuNegativeRegressionPreserved": all(base_negative.values()),
            "trainingMainDoesNotEnableGlobalStrictDeterminism": "torch.use_deterministic_algorithms(True)" not in trainer_main_source,
            "fixedPreviewDeterminismScopeEnablesStrictMode": scope_enabled,
            "fixedPreviewDeterminismScopeRestoresTrainingMode": scope_restored,
            "singleStepCanDisablePathReplay": "enable_path_replay" in trainer_epoch_signature.parameters and "if enable_path_replay else 0" in trainer_source,
            "phase0UpdateAndFreshReproductionCliImplemented": all(value in trainer_source for value in ("--stage4-validation-kernel-phase0-update", "--stage4-validation-kernel-phase0-reproduce", "phase0-diagnostic-checkpoint.pt")),
            "previewArtifactCarriesModelConditionRgbAndPngIdentity": all(value in trainer_source for value in ("denoiserStateSha256", "conditionTensorSha256", "rgbTensorSha256", "previewSha256")),
            "runnerUsesThreeFreshTrainerProcesses": (
                "phase0-update-execution-identity.json" in runner_source
                and "for (const label of [\"a\", \"b\"])" in runner_source
                and "phase0-reproduce-${label}-execution-identity.json" in runner_source
                and "runValidationKernelTrainerPart" in runner_source
            ),
            "runnerAuthorizationContractEntryPasses": runner.returncode == 0 and "authorization_contract_valid_cpu_only" in runner.stdout,
        }
        negative = {
            "inactiveV9ConfigCannotExecutePhase0WithoutDedicatedIdentity": inactive_execution.returncode != 0 and "inactive CPU support configuration cannot execute training" in inactive_execution.stderr,
            "phase0CheckpointExplicitlyNonpromotable": all(value in trainer_source for value in ("checkpointPromotionEligible\": False", "fullTrainingInitializationEligible\": False")),
            "oldDenoiserCheckpointStillRejected": "must reject every V7 or V8 parent Denoiser Checkpoint" in trainer_source,
            "phase0ExecutionBudgetEnforced": "validation_kernel_phase0_gpu_execution_budget_exhausted" in runner_source,
            "modelSmokeQuotaNotConsumedByPhase0": "modelSmokeQuotaConsumed: false" in runner_source,
            "formalInferenceAndWorldActionsRemainClosed": all(value in runner_source for value in ("formalInferenceAuthorized: false", "checkpointPromotionAuthorized: false")),
        }
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-cpu-regression-report-v1",
            "status": "stage4_validation_kernel_phase0_cpu_regression_passed" if not failed_positive and not failed_negative else "stage4_validation_kernel_phase0_cpu_regression_failed_closed",
            **timestamps("recordedAt"),
            "authorization": binding(VALIDATION_KERNEL_AUTHORIZATION_PATH),
            "implementationConsumption": binding(VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "legacyEvidence": base_evidence,
            "runnerCpuContract": {"exitCode": runner.returncode, "stdout": runner.stdout, "stderr": runner.stderr},
            "inactiveExecutionNegative": {"exitCode": inactive_execution.returncode, "stdout": inactive_execution.stdout, "stderr": inactive_execution.stderr},
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"validation kernel CPU regression failed: {failed_positive}:{failed_negative}")
        support = {
            "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-support-contract-v1",
            "status": "stage4_validation_kernel_phase0_cpu_support_verified_inactive",
            **timestamps("recordedAt"),
            "authorization": binding(VALIDATION_KERNEL_AUTHORIZATION_PATH),
            "trainingBackwardDeterminismScope": "normal_cuda_algorithms_strict_determinism_disabled",
            "fixedPreviewDeterminismScope": "strict_determinism_enabled_and_restored",
            "phase0ProcessChain": ["single_optimizer_step_process", "fresh_checkpoint_reproduction_a_process", "fresh_checkpoint_reproduction_b_process"],
            "phase0CheckpointPromotable": False,
            "phase0CheckpointFullTrainingInitializationEligible": False,
            "maximumGpuExecutions": 2,
            "modelSmokeQuotaConsumed": False,
        }
        write_json_exclusive(args.support_contract, support)
        attestation = {
            "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-implementation-attestation-v1",
            "status": "stage4_validation_kernel_phase0_implementation_cpu_verified",
            **timestamps("recordedAt"),
            "authorizationPath": project_path(VALIDATION_KERNEL_AUTHORIZATION_PATH),
            "authorizationSha256": VALIDATION_KERNEL_AUTHORIZATION_SHA256,
            "implementationConsumptionPath": project_path(VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH),
            "implementationConsumptionSha256": VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_SHA256,
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "runnerPath": project_path(SMOKE_RUNNER_PATH),
            "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
            "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "cpuReportPath": project_path(args.report),
            "cpuReportSha256": sha256_file(resolve(args.report)),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(resolve(args.support_contract)),
            "cpuImplementationRepairCycle": 2,
            "maximumCpuImplementationRepairCycles": 2,
            "gpuStarted": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.implementation_attestation, attestation)
        terminal = {
            "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-cpu-terminal-v1",
            "status": "stage4_validation_kernel_phase0_cpu_gate_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(resolve(args.report)),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(resolve(args.support_contract)),
            "implementationAttestationPath": project_path(args.implementation_attestation),
            "implementationAttestationSha256": sha256_file(resolve(args.implementation_attestation)),
            "nextAction": "execute_python_cuda_resource_disk_preflights_then_phase0_gpu_qualification",
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(resolve(args.terminal))}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not terminal_path.exists():
            terminal = {
                "schemaVersion": "ai-painter-stage4-validation-kernel-phase0-cpu-terminal-v1",
                "status": "stage4_validation_kernel_phase0_cpu_gate_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(args.report) if report_path.exists() else None,
                "reportSha256": sha256_file(report_path) if report_path.exists() else None,
                "checkpointRead": False,
                "optimizerCreated": False,
                "backwardMethodExecuted": False,
                "modelWeightsModified": False,
                "gpuUsed": False,
                "trainingStarted": False,
            }
            write_json_exclusive(args.terminal, terminal)
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_validation_kernel_model_smoke_contract_regression(args) -> int:
    if args.report is None or args.support_contract is None or args.terminal is None or args.implementation_attestation is None:
        raise ValueError("validation kernel model Smoke CPU mode requires all evidence output paths")
    report_path = resolve(args.report)
    terminal_path = resolve(args.terminal)
    try:
        authorization = read_json(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH))
        if sha256_file(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH)) != VALIDATION_KERNEL_AUTHORIZATION_SHA256:
            raise ValueError("validation kernel model Smoke authorization changed")
        terminals = []
        phase0_root = resolve(VALIDATION_KERNEL_ROOT / "phase0")
        for candidate in phase0_root.glob("*/finalization/phase-terminal.json"):
            value = read_json(candidate)
            if value.get("status") == "stage4_validation_kernel_phase0_passed_closed":
                terminals.append(candidate)
        if len(terminals) != 1:
            raise ValueError("validation kernel model Smoke requires one successful Phase0 terminal")
        phase0_terminal_path = terminals[0]
        source_authorization = read_json(resolve(SMOKE_AUTHORIZATION_PATH))
        config = read_json(resolve(CONFIG_PATH))
        package = read_json(resolve(DATASET_PATH))
        base_positive, base_negative, evidence = run_regressions(config, package)
        trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
        runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        runner = subprocess.run(
            ["node", str(resolve(SMOKE_RUNNER_PATH)), "--stage4-validation-kernel-model-smoke", "--gpu-authorization", str(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH)), "--cpu-contract-only"],
            cwd=ROOT, capture_output=True, text=True, timeout=120,
        )
        positive = {
            "phase0SuccessTerminalUniquelyBound": True,
            "legacyV9PositiveRegressionPreserved": all(base_positive.values()),
            "legacyV9NegativeRegressionPreserved": all(base_negative.values()),
            "modelSmokeAuthorizationContractEntryPasses": runner.returncode == 0 and "authorization_contract_valid_cpu_only" in runner.stdout,
            "newV9SmokeStatusIsSeparated": "V9_STAGE4_VALIDATION_KERNEL_SMOKE_ACTIVE_STATUS" in trainer_source,
            "trainingBackwardAndPreviewDeterminismRemainSeparated": "stage4_fixed_preview_determinism_scope" in trainer_source and "torch.use_deterministic_algorithms(True)" not in inspect.getsource(trainer.main),
            "eachFixedEpochPreviewHasReproductionGate": all(value in trainer_source for value in ("fixed_epoch_preview_reproduced_exactly", "conditionTensorSha256Matches", "rgbTensorSha256Matches", "pngByteSha256Matches")),
            "runnerRequiresFivePreviewReproductions": "fixed_epoch_preview_reproduction_missing" in runner_source and "fixed_epoch_preview_reproduction_identity_mismatch" in runner_source,
            "smokeConsumptionIsIndependent": "stage4_validation_kernel_model_smoke_gpu_authorization_atomically_consumed" in runner_source,
        }
        negative = {
            "smokeDoesNotLoadPhase0DiagnosticCheckpoint": "phase0DiagnosticCheckpointPath" not in runner_source,
            "smokeStartsV9FromFixedRandomInitialization": "--initial-denoiser-checkpoint" not in runner_source,
            "fullTrainingNotOpenedBySmokeConfig": "fullTrainingAuthorized: false" in runner_source,
            "formalInferenceAndRuntimeRemainClosed": all(authorization.get("authorizedActions", {}).get(key) is False for key in ("formalInference", "checkpointFormalPromotion", "runtimeFrame", "worldEntry", "worldRuntime")),
            "automaticSmokeRetryClosed": authorization.get("executionPolicy", {}).get("automaticModelSmokeRetry") is False and authorization.get("executionPolicy", {}).get("maximumModelSmokeExecutions") == 1,
        }
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {"schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-cpu-regression-report-v1", "status": "stage4_validation_kernel_model_smoke_cpu_regression_passed" if not failed_positive and not failed_negative else "stage4_validation_kernel_model_smoke_cpu_regression_failed_closed", **timestamps("recordedAt"), "authorization": binding(VALIDATION_KERNEL_AUTHORIZATION_PATH), "phase0Terminal": binding(phase0_terminal_path), "positive": positive, "negative": negative, "failedPositiveKeys": failed_positive, "failedNegativeKeys": failed_negative, "positivePassed": sum(value is True for value in positive.values()), "positiveTotal": len(positive), "negativePassed": sum(value is True for value in negative.values()), "negativeTotal": len(negative), "legacyEvidence": evidence, "runnerCpuContract": {"exitCode": runner.returncode, "stdout": runner.stdout, "stderr": runner.stderr}, "checkpointRead": False, "optimizerCreated": False, "gpuUsed": False, "trainingStarted": False}
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"validation kernel model Smoke CPU regression failed: {failed_positive}:{failed_negative}")
        support = {"schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-support-contract-v1", "status": "stage4_validation_kernel_model_smoke_cpu_support_verified_inactive", **timestamps("recordedAt"), "phase0Terminal": binding(phase0_terminal_path), "sampleId": SAMPLE_ID, "sampleSplit": "validation", "seed": 20263722, "requiredBoundarySides": ["west"], "epochCount": 30, "previewEpochs": FIXED_EPOCHS, "perPreviewReproductionRequired": True, "machineReviewThresholdsChanged": False, "phase0CheckpointUsedAsInitialization": False}
        write_json_exclusive(args.support_contract, support)
        attestation = {"schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-implementation-attestation-v1", "status": "stage4_validation_kernel_model_smoke_implementation_cpu_verified", **timestamps("recordedAt"), "authorizationPath": project_path(VALIDATION_KERNEL_AUTHORIZATION_PATH), "authorizationSha256": VALIDATION_KERNEL_AUTHORIZATION_SHA256, "phase0TerminalPath": project_path(phase0_terminal_path), "phase0TerminalSha256": sha256_file(phase0_terminal_path), "trainerPath": project_path(TRAINER_PATH), "trainerSha256": sha256_file(resolve(TRAINER_PATH)), "runnerPath": project_path(SMOKE_RUNNER_PATH), "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)), "cpuCheckerPath": project_path(CPU_CHECKER_PATH), "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)), "cpuReportPath": project_path(args.report), "cpuReportSha256": sha256_file(resolve(args.report)), "supportContractPath": project_path(args.support_contract), "supportContractSha256": sha256_file(resolve(args.support_contract)), "gpuStarted": False, "trainingStarted": False}
        write_json_exclusive(args.implementation_attestation, attestation)
        terminal = {"schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-cpu-terminal-v1", "status": "stage4_validation_kernel_model_smoke_cpu_gate_passed_closed", **timestamps("recordedAt"), "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60}, "reportPath": project_path(args.report), "reportSha256": sha256_file(resolve(args.report)), "supportContractPath": project_path(args.support_contract), "supportContractSha256": sha256_file(resolve(args.support_contract)), "implementationAttestationPath": project_path(args.implementation_attestation), "implementationAttestationSha256": sha256_file(resolve(args.implementation_attestation)), "nextAction": "execute_one_v9_30_epoch_model_smoke", "checkpointRead": False, "optimizerCreated": False, "gpuUsed": False, "trainingStarted": False}
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(resolve(args.terminal))}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not terminal_path.exists():
            write_json_exclusive(args.terminal, {"schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-cpu-terminal-v1", "status": "stage4_validation_kernel_model_smoke_cpu_gate_failed_closed", **timestamps("recordedAt"), "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60}, "failureType": type(error).__name__, "failureMessage": str(error), "traceback": traceback.format_exc(), "reportPath": project_path(args.report) if report_path.exists() else None, "reportSha256": sha256_file(report_path) if report_path.exists() else None, "checkpointRead": False, "optimizerCreated": False, "gpuUsed": False, "trainingStarted": False})
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_dual_identity_validation_kernel_model_smoke_contract_regression(args, authorization: dict) -> int:
    if (
        args.report is None
        or args.support_contract is None
        or args.terminal is None
        or args.implementation_attestation is None
        or args.authorization_sha256 is None
    ):
        raise ValueError("dual-identity Stage4 Smoke CPU mode requires implementation identity and all evidence output paths")
    authorization_path = resolve(args.smoke_authorization)
    authorization_sha256 = args.authorization_sha256.lower()
    report_path = resolve(args.report)
    support_path = resolve(args.support_contract)
    terminal_path = resolve(args.terminal)
    attestation_path = resolve(args.implementation_attestation)
    try:
        if sha256_file(authorization_path) != authorization_sha256:
            raise ValueError("dual-identity implementation authorization SHA-256 changed")
        request_id = authorization.get("requestId")
        scope = authorization.get("ownerDecision", {}).get("scope")
        if (
            authorization.get("status") != "owner_authorized_implementation_not_consumed"
            or authorization.get("ownerDecision", {}).get("commandRef") != request_id
            or not request_id
            or not scope
            or authorization.get("implementationActions") != DUAL_IDENTITY_IMPLEMENTATION_ACTIONS
            or authorization.get("authorizedFiles") != [
                "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
                "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
                "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py",
            ]
            or not all(authorization.get("explicitlyDeniedActions", {}).values())
        ):
            raise ValueError("dual-identity implementation authorization contract invalid")
        expected_outputs = {
            report_path: authorization.get("output", {}).get("cpuReportPath"),
            support_path: authorization.get("output", {}).get("supportContractPath"),
            terminal_path: authorization.get("output", {}).get("cpuTerminalPath"),
            attestation_path: authorization.get("output", {}).get("implementationAttestationPath"),
        }
        for actual, expected in expected_outputs.items():
            if project_path(actual) != project_path(Path(expected or "missing")):
                raise ValueError("dual-identity CPU evidence output differs from implementation authorization")
            if actual.exists():
                raise FileExistsError(f"dual-identity CPU evidence already exists: {project_path(actual)}")
        for key in ("previousSmokeFailureTerminal", "previousSmokeFinalization", "previousGpuConsumption"):
            value = authorization.get("bindings", {}).get(key, {})
            if not value.get("path") or sha256_file(resolve(Path(value["path"]))) != value.get("sha256"):
                raise ValueError(f"dual-identity bound failure evidence changed: {key}")
        implementation_consumption_path = resolve(Path(authorization.get("output", {}).get("implementationConsumptionPath", "missing")))
        implementation_consumption = read_json(implementation_consumption_path)
        implementation_consumption_sha256 = sha256_file(implementation_consumption_path)
        if (
            implementation_consumption.get("status") != "stage4_dual_identity_lineage_implementation_authorization_atomically_consumed"
            or implementation_consumption.get("requestId") != request_id
            or implementation_consumption.get("commandRef") != request_id
            or implementation_consumption.get("scope") != scope
            or implementation_consumption.get("authorizationSha256") != authorization_sha256
            or implementation_consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("dual-identity implementation consumption invalid")

        previous_gpu_consumption = read_json(resolve(Path(authorization["bindings"]["previousGpuConsumption"]["path"])))
        source_authorization_path = resolve(Path(previous_gpu_consumption.get("authorizationPath", "missing")))
        if sha256_file(source_authorization_path) != previous_gpu_consumption.get("authorizationSha256"):
            raise ValueError("previous GPU authorization identity changed")
        source_authorization = read_json(source_authorization_path)
        source_binding_keys = (
            "phase0SuccessTerminal", "v9InactiveConfig", "datasetManifest", "datasetSourceIndex",
            "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
            "windowsSafePreviewNormalizer", "gpuResourceGate",
        )
        for key in source_binding_keys:
            value = source_authorization.get("bindings", {}).get(key, {})
            if not value.get("path") or sha256_file(resolve(Path(value["path"]))) != value.get("sha256"):
                raise ValueError(f"source GPU authorization binding changed: {key}")

        attestation_path.parent.mkdir(parents=True, exist_ok=True)
        attestation = {
            "schemaVersion": "ai-painter-stage4-dual-identity-implementation-attestation-v1",
            "status": "stage4_dual_identity_implementation_code_attested_cpu_pending",
            **timestamps("recordedAt"),
            "implementationAuthorizationPath": project_path(authorization_path),
            "implementationAuthorizationSha256": authorization_sha256,
            "implementationConsumptionPath": project_path(implementation_consumption_path),
            "implementationConsumptionSha256": implementation_consumption_sha256,
            "runnerPath": project_path(SMOKE_RUNNER_PATH),
            "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.implementation_attestation, attestation)
        attestation_sha256 = sha256_file(attestation_path)

        config = read_json(resolve(Path(source_authorization["bindings"]["v9InactiveConfig"]["path"])))
        package = read_json(resolve(Path(source_authorization["bindings"]["datasetManifest"]["path"])))
        base_positive, base_negative, evidence = run_regressions(config, package)
        mode = FORMAL_MODE_REGISTRY.resolve_mode_id("v9_stage4_validation_kernel_smoke")

        fixtures_root = resolve(Path(".runtime/ai-painter/cpu-contract-fixtures"))
        fixtures_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="v9-dual-identity-", dir=fixtures_root) as fixture_dir_value:
            fixture_root = Path(fixture_dir_value)
            fixture_request_id = "owner-authorized-stage4-v9-model-smoke-gpu-execution-cpu-fixture"
            fixture_authorization_dir = fixture_root / fixture_request_id
            fixture_authorization_dir.mkdir(parents=True, exist_ok=False)
            fixture_authorization_path = fixture_authorization_dir / "gpu-execution-authorization.json"
            fixture_consumption_path = fixture_root / "gpu-execution-consumption.json"
            fixture_active_config_path = fixture_root / "active-config.json"
            fixture_training_output_path = fixture_root / "training-output"
            fixture_finalization_path = fixture_root / "finalization"
            fixture_bindings = {
                "previousSmokeFailureTerminal": authorization["bindings"]["previousSmokeFailureTerminal"],
                "previousSmokeFinalization": authorization["bindings"]["previousSmokeFinalization"],
                "previousGpuConsumption": authorization["bindings"]["previousGpuConsumption"],
                **{key: source_authorization["bindings"][key] for key in source_binding_keys},
            }
            fixture_authorization = {
                "schemaVersion": DUAL_IDENTITY_GPU_AUTHORIZATION_SCHEMA,
                "status": "owner_authorized_gpu_execution_not_consumed",
                "requestId": fixture_request_id,
                "ownerDecision": {
                    "commandRef": fixture_request_id,
                    "scope": "stage4_v9_single_sample_model_smoke_execution_only",
                },
                "cpuContractFixture": True,
                "implementationIdentity": {
                    "authorizationPath": project_path(authorization_path),
                    "authorizationSha256": authorization_sha256,
                    "consumptionPath": project_path(implementation_consumption_path),
                    "consumptionSha256": implementation_consumption_sha256,
                    "attestationPath": project_path(attestation_path),
                    "attestationSha256": attestation_sha256,
                },
                "fixedTaskIdentity": {
                    "module": "AI Painter R5",
                    "stage": 4,
                    "modeId": "v9_stage4_validation_kernel_smoke",
                    "architecture": "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
                    "sampleId": SAMPLE_ID,
                    "sampleSplit": "validation",
                    "seed": 20263722,
                    "requiredBoundarySides": ["west"],
                    "resolution": {"width": 256, "height": 192},
                    "smokeEpochs": 30,
                    "smokePreviewEpochs": FIXED_EPOCHS,
                    "datasetCapacity": 64,
                    "datasetSplit": EXPECTED_COUNTS,
                },
                "executionActions": deepcopy(DYNAMIC_VALIDATION_KERNEL_EXECUTION_ACTIONS),
                "executionPolicy": {
                    "maximumGpuSmokeExecutions": 1,
                    "allCpuAndResourcePreflightsMustPassBeforeGpuConsumption": True,
                    "failureStopsImmediately": True,
                    "automaticRetryAuthorized": False,
                },
                "bindings": fixture_bindings,
                "output": {
                    "smokeConsumptionPath": project_path(fixture_consumption_path),
                    "activeConfigPath": project_path(fixture_active_config_path),
                    "trainingOutputDirectory": project_path(fixture_training_output_path),
                    "finalizationDirectory": project_path(fixture_finalization_path),
                },
            }
            fixture_authorization_path.write_text(json.dumps(fixture_authorization, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            fixture_authorization_sha256 = sha256_file(fixture_authorization_path)

            def run_node(candidate: Path, candidate_sha256: str | None) -> subprocess.CompletedProcess[str]:
                try:
                    candidate_argument = project_path(candidate)
                except ValueError:
                    candidate_argument = str(candidate)
                command = [
                    "node", str(resolve(SMOKE_RUNNER_PATH)),
                    "--stage4-validation-kernel-model-smoke",
                    "--gpu-authorization", candidate_argument,
                    "--cpu-contract-only",
                ]
                if candidate_sha256 is not None:
                    command.extend(["--gpu-authorization-sha256", candidate_sha256])
                return subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)

            positive_runner = run_node(fixture_authorization_path, fixture_authorization_sha256)
            legacy_runner = run_node(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH), None)

            fixture_consumption = {
                "schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-gpu-consumption-v1",
                "status": "stage4_validation_kernel_model_smoke_gpu_authorization_atomically_consumed",
                "requestId": fixture_request_id,
                "commandRef": fixture_request_id,
                "scope": fixture_authorization["ownerDecision"]["scope"],
                "authorizationPath": project_path(fixture_authorization_path),
                "authorizationSha256": fixture_authorization_sha256,
                "implementationAttestationPath": project_path(attestation_path),
                "implementationAttestationSha256": attestation_sha256,
                "oneTimeConsumption": True,
                "modelSmokeOrdinal": 1,
                "maximumModelSmokeExecutions": 1,
                "stage4FullTrainingStarted": False,
                "automaticRetryAuthorized": False,
            }
            fixture_consumption_path.write_text(json.dumps(fixture_consumption, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            fixture_consumption_sha256 = sha256_file(fixture_consumption_path)

            active_config = deepcopy(config)
            training = active_config["training"]
            active_config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke"
            training["trainingAuthorizationStatus"] = mode.authorization_status
            training["v9Stage4SingleSampleSmokeContract"]["status"] = "active_owner_authorized_single_execution"
            training["ownerTrainingAuthorization"] = {
                "authorizationId": fixture_request_id,
                "authorizationPath": project_path(fixture_authorization_path),
                "authorizationSha256": fixture_authorization_sha256,
                "executionConsumptionPath": project_path(fixture_consumption_path),
                "executionConsumptionSha256": fixture_consumption_sha256,
                "status": mode.authorization_status,
                "checkpointLoadingAuthorized": True,
                "optimizerCreationAuthorized": True,
                "backwardExecutionAuthorized": True,
                "modelWeightMutationAuthorized": True,
                "gpuTrainingAuthorizedNow": True,
                "singleSampleGpuOverfitSmokeAuthorized": True,
                "fullTrainingAuthorized": False,
                "stage1Authorized": False,
                "stage2Authorized": False,
                "strictRevalidationAuthorized": False,
                "validationAuthorized": False,
                "formalInferenceAuthorized": False,
                "checkpointPromotionAuthorized": False,
                "runtimeFrameAuthorized": False,
                "worldEntryAuthorized": False,
                "automaticRetryAuthorized": False,
            }
            model_contract = training["stage4ObjectSemanticDecoderAlignment"]
            model_contract["enabled"] = True
            model_contract["status"] = "training_loss_active_owner_authorized"
            model_contract["trainingLossImplementationStatus"] = "implemented_active_owner_authorized"
            for key in ("configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "checkpointWriteNow"):
                model_contract["activationGate"][key] = True
            training["stage4UnifiedTrainingPreviewSamplingContract"] = {
                "schemaVersion": "stage4-unified-training-preview-sampling-contract-v1",
                "enabled": True,
                "status": "active_owner_authorized_single_execution",
                "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
                "modelStateBinding": "sha256_sorted_tensor_bytes_v1",
                "seedBinding": "training_seed_plus_3000",
                "normalizationBinding": "checkpoint_latent_normalization",
                "decodeBinding": "frozen_project_autoencoder_decode_clamp_0_1",
                "checkpointPreviewIdentityGate": "byte_exact_best_epoch_reproduction",
                "deterministicAlgorithmsRequired": True,
                "cublasWorkspaceConfig": ":4096:8",
                "failedPreviewPixelsUsedAsTrainingTargets": False,
                "machineReviewThresholdsUsedAsTrainingTargets": False,
            }
            training["v9Stage4SmokeExecution"] = {
                "sourceInactiveConfigPath": source_authorization["bindings"]["v9InactiveConfig"]["path"],
                "sourceInactiveConfigSha256": source_authorization["bindings"]["v9InactiveConfig"]["sha256"],
                "ownerAuthorizationPath": project_path(fixture_authorization_path),
                "ownerAuthorizationSha256": fixture_authorization_sha256,
                "gpuConsumptionPath": project_path(fixture_consumption_path),
                "gpuConsumptionSha256": fixture_consumption_sha256,
                "implementationAttestationPath": project_path(attestation_path),
                "implementationAttestationSha256": attestation_sha256,
                "phase0TerminalPath": source_authorization["bindings"]["phase0SuccessTerminal"]["path"],
                "phase0TerminalSha256": source_authorization["bindings"]["phase0SuccessTerminal"]["sha256"],
                "cpuContractFixture": True,
            }
            fixture_active_config_path.write_text(json.dumps(active_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            trainer_command = [
                sys.executable, str(resolve(TRAINER_PATH)),
                "--config", str(fixture_active_config_path),
                "--dataset-package", str(resolve(Path(source_authorization["bindings"]["datasetManifest"]["path"]))),
                "--autoencoder-checkpoint", str(resolve(Path(source_authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))),
                "--output-dir", str(fixture_training_output_path),
                "--resolution-stage", "0",
                "--single-sample-overfit-smoke",
                "--overfit-sample-id", SAMPLE_ID,
                "--overfit-epochs", "30",
                "--overfit-evaluation-interval", "5",
                "--preflight-only",
                "--authorization-lineage-preflight",
            ]
            trainer_environment = {**os.environ, "PYTHONUTF8": "1", "CUDA_VISIBLE_DEVICES": ""}
            trainer_preflight = subprocess.run(trainer_command, cwd=ROOT, capture_output=True, text=True, timeout=180, env=trainer_environment)

            def write_authorization_fixture(name: str, value: dict, *, nested_identity: bool = True) -> tuple[Path, str]:
                target_root = fixture_root / name
                if nested_identity:
                    target_root = target_root / value.get("requestId", "missing-request")
                target_root.mkdir(parents=True, exist_ok=True)
                target = target_root / "gpu-execution-authorization.json"
                target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                return target, sha256_file(target)

            negative_results: dict[str, subprocess.CompletedProcess[str]] = {}
            negative_results["hashMismatch"] = run_node(fixture_authorization_path, "0" * 64)
            forged_request = deepcopy(fixture_authorization)
            forged_request["requestId"] = "owner-authorized-stage4-v9-model-smoke-gpu-execution-forged"
            forged_request["ownerDecision"]["commandRef"] = forged_request["requestId"]
            forged_request_path, forged_request_sha = write_authorization_fixture("forged-request", forged_request, nested_identity=False)
            negative_results["requestIdMismatch"] = run_node(forged_request_path, forged_request_sha)
            wrong_scope = deepcopy(fixture_authorization)
            wrong_scope["ownerDecision"]["scope"] = "forged_scope"
            wrong_scope_path, wrong_scope_sha = write_authorization_fixture("wrong-scope", wrong_scope)
            negative_results["scopeMismatch"] = run_node(wrong_scope_path, wrong_scope_sha)
            unknown_action = deepcopy(fixture_authorization)
            unknown_action["executionActions"]["startTrainingNow"] = True
            unknown_action_path, unknown_action_sha = write_authorization_fixture("unknown-action", unknown_action)
            negative_results["unknownExecutionAction"] = run_node(unknown_action_path, unknown_action_sha)
            forbidden_action = deepcopy(fixture_authorization)
            forbidden_action["executionActions"]["stage4FullTraining"] = True
            forbidden_action_path, forbidden_action_sha = write_authorization_fixture("forbidden-action", forbidden_action)
            negative_results["forbiddenAction"] = run_node(forbidden_action_path, forbidden_action_sha)
            implementation_injection = deepcopy(fixture_authorization)
            implementation_injection["implementationActions"] = {"modifyTrainerNow": True}
            implementation_injection_path, implementation_injection_sha = write_authorization_fixture("implementation-injection", implementation_injection)
            negative_results["implementationPermissionInjection"] = run_node(implementation_injection_path, implementation_injection_sha)
            reused = deepcopy(fixture_authorization)
            reused_path, reused_sha = write_authorization_fixture("reused-consumption", reused)
            reused_value = read_json(reused_path)
            reused_value["output"]["smokeConsumptionPath"] = project_path(fixture_consumption_path)
            reused_path.write_text(json.dumps(reused_value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            negative_results["reusedConsumption"] = run_node(reused_path, sha256_file(reused_path))
            with tempfile.TemporaryDirectory(prefix="v9-dual-external-") as external_dir:
                external_path = Path(external_dir) / "gpu-execution-authorization.json"
                external_path.write_text(json.dumps(fixture_authorization, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                negative_results["externalPathInjection"] = run_node(external_path, sha256_file(external_path))

            positive = {
                "boundFailureEvidenceHashesVerified": True,
                "implementationAuthorizationConsumedExactlyOnce": True,
                "legacyV9PositiveRegressionPreserved": all(base_positive.values()),
                "legacyV9NegativeRegressionPreserved": all(base_negative.values()),
                "dynamicGpuExecutionAuthorizationReachesSharedRunnerPolicy": positive_runner.returncode == 0 and "authorization_contract_valid_cpu_only" in positive_runner.stdout,
                "legacyValidationKernelAuthorizationStillAccepted": legacy_runner.returncode == 0 and "authorization_contract_valid_cpu_only" in legacy_runner.stdout,
                "modeRegistryResolvesValidationKernelSmoke": mode.execution_kind == "single_sample_smoke" and mode.sample_split == "validation",
                "realTrainerStartupLineagePreflightPassed": trainer_preflight.returncode == 0 and "conditional_denoiser_python_preflight_passed" in trainer_preflight.stdout,
                "trainerPreflightDidNotCreateTrainingOutput": not fixture_training_output_path.exists(),
                "sample194RemainsValidationWithExpectedSplit": evidence.get("actualSplitCounts") == EXPECTED_COUNTS and evidence.get("sample194Occurrences") == ["validation"],
            }
            negative = {
                "authorizationHashMismatchRejected": negative_results["hashMismatch"].returncode != 0 and "authorization_sha256_invalid" in negative_results["hashMismatch"].stderr,
                "forgedRequestIdRejected": negative_results["requestIdMismatch"].returncode != 0 and "command_identity_invalid" in negative_results["requestIdMismatch"].stderr,
                "scopeMismatchRejected": negative_results["scopeMismatch"].returncode != 0 and "command_identity_invalid" in negative_results["scopeMismatch"].stderr,
                "unknownExecutionActionRejected": negative_results["unknownExecutionAction"].returncode != 0 and "exact_execution_action_contract_invalid" in negative_results["unknownExecutionAction"].stderr,
                "forbiddenActionActivationRejected": negative_results["forbiddenAction"].returncode != 0 and "exact_execution_action_contract_invalid" in negative_results["forbiddenAction"].stderr,
                "implementationPermissionInjectionRejected": negative_results["implementationPermissionInjection"].returncode != 0 and "implementation_permission_injection" in negative_results["implementationPermissionInjection"].stderr,
                "repeatedConsumptionRejected": negative_results["reusedConsumption"].returncode != 0 and "already_consumed" in negative_results["reusedConsumption"].stderr,
                "externalAbsolutePathInjectionRejected": negative_results["externalPathInjection"].returncode != 0 and "path_outside_project" in negative_results["externalPathInjection"].stderr,
            }
            failed_positive = [key for key, value in positive.items() if value is not True]
            failed_negative = [key for key, value in negative.items() if value is not True]
            report = {
                "schemaVersion": "ai-painter-stage4-dual-identity-model-smoke-cpu-regression-report-v1",
                "status": "stage4_dual_identity_model_smoke_cpu_regression_passed" if not failed_positive and not failed_negative else "stage4_dual_identity_model_smoke_cpu_regression_failed_closed",
                **timestamps("recordedAt"),
                "implementationAuthorization": binding(authorization_path),
                "implementationConsumption": binding(implementation_consumption_path),
                "implementationAttestation": binding(attestation_path),
                "positive": positive,
                "negative": negative,
                "failedPositiveKeys": failed_positive,
                "failedNegativeKeys": failed_negative,
                "positivePassed": sum(value is True for value in positive.values()),
                "positiveTotal": len(positive),
                "negativePassed": sum(value is True for value in negative.values()),
                "negativeTotal": len(negative),
                "runnerCpuContract": {"exitCode": positive_runner.returncode, "stdout": positive_runner.stdout, "stderr": positive_runner.stderr},
                "legacyRunnerCpuContract": {"exitCode": legacy_runner.returncode, "stdout": legacy_runner.stdout, "stderr": legacy_runner.stderr},
                "trainerStartupPreflight": {"exitCode": trainer_preflight.returncode, "stdout": trainer_preflight.stdout, "stderr": trainer_preflight.stderr},
                "negativeRunnerContracts": {key: {"exitCode": value.returncode, "stdout": value.stdout, "stderr": value.stderr} for key, value in negative_results.items()},
                "checkpointRead": False,
                "optimizerCreated": False,
                "gpuUsed": False,
                "trainingStarted": False,
            }
            write_json_exclusive(args.report, report)
            if failed_positive or failed_negative:
                raise ValueError(f"dual-identity CPU regression failed: {failed_positive}:{failed_negative}")

        support = {
            "schemaVersion": "ai-painter-stage4-dual-identity-model-smoke-support-contract-v1",
            "status": "stage4_dual_identity_model_smoke_cpu_support_verified_inactive",
            **timestamps("recordedAt"),
            "implementationAuthorization": binding(authorization_path),
            "implementationConsumption": binding(implementation_consumption_path),
            "implementationAttestation": binding(attestation_path),
            "gpuAuthorizationIdentity": "separate_not_yet_established",
            "modeId": "v9_stage4_validation_kernel_smoke",
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "requiredBoundarySides": ["west"],
            "epochCount": 30,
            "previewEpochs": FIXED_EPOCHS,
            "machineReviewThresholdsChanged": False,
        }
        write_json_exclusive(args.support_contract, support)
        terminal = {
            "schemaVersion": "ai-painter-stage4-dual-identity-model-smoke-cpu-terminal-v1",
            "status": "stage4_dual_identity_model_smoke_cpu_gate_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(report_path),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(support_path),
            "implementationAttestationPath": project_path(args.implementation_attestation),
            "implementationAttestationSha256": sha256_file(attestation_path),
            "nextAction": "establish_independent_gpu_execution_authorization_then_run_resource_preflights",
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(terminal_path)}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not terminal_path.exists():
            terminal_path.parent.mkdir(parents=True, exist_ok=True)
            write_json_exclusive(args.terminal, {
                "schemaVersion": "ai-painter-stage4-dual-identity-model-smoke-cpu-terminal-v1",
                "status": "stage4_dual_identity_model_smoke_cpu_gate_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(args.report) if report_path.exists() else None,
                "reportSha256": sha256_file(report_path) if report_path.exists() else None,
                "checkpointRead": False,
                "optimizerCreated": False,
                "gpuUsed": False,
                "trainingStarted": False,
            })
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_fixed_preview_schedule_contract_regression(args, authorization: dict) -> int:
    if (
        args.report is None
        or args.support_contract is None
        or args.terminal is None
        or args.implementation_attestation is None
        or args.authorization_sha256 is None
    ):
        raise ValueError("fixed preview schedule CPU mode requires implementation identity and all evidence output paths")
    authorization_path = resolve(args.smoke_authorization)
    authorization_sha256 = args.authorization_sha256.lower()
    report_path = resolve(args.report)
    support_path = resolve(args.support_contract)
    terminal_path = resolve(args.terminal)
    attestation_path = resolve(args.implementation_attestation)
    try:
        if sha256_file(authorization_path) != authorization_sha256:
            raise ValueError("fixed preview schedule implementation authorization SHA-256 changed")
        request_id = authorization.get("requestId")
        scope = authorization.get("ownerDecision", {}).get("scope")
        if (
            authorization.get("status") != "owner_authorized_implementation_not_consumed"
            or authorization.get("ownerDecision", {}).get("commandRef") != request_id
            or not request_id
            or not scope
            or authorization.get("implementationActions") != FIXED_PREVIEW_SCHEDULE_IMPLEMENTATION_ACTIONS
            or authorization.get("authorizedFiles") != [
                "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
                "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py",
            ]
            or not all(authorization.get("explicitlyDeniedActions", {}).values())
        ):
            raise ValueError("fixed preview schedule implementation authorization contract invalid")
        expected_outputs = {
            report_path: authorization.get("output", {}).get("cpuReportPath"),
            support_path: authorization.get("output", {}).get("supportContractPath"),
            terminal_path: authorization.get("output", {}).get("cpuTerminalPath"),
            attestation_path: authorization.get("output", {}).get("implementationAttestationPath"),
        }
        for actual, expected in expected_outputs.items():
            if project_path(actual) != project_path(Path(expected or "missing")):
                raise ValueError("fixed preview schedule CPU evidence output differs from implementation authorization")
            if actual.exists():
                raise FileExistsError(f"fixed preview schedule CPU evidence already exists: {project_path(actual)}")
        for key in ("previousSmokeFailureTerminal", "previousSmokeFinalization", "previousGpuConsumption", "runnerFrozen"):
            value = authorization.get("bindings", {}).get(key, {})
            if not value.get("path") or sha256_file(resolve(Path(value["path"]))) != value.get("sha256"):
                raise ValueError(f"fixed preview schedule bound evidence changed: {key}")
        implementation_consumption_path = resolve(Path(authorization.get("output", {}).get("implementationConsumptionPath", "missing")))
        implementation_consumption = read_json(implementation_consumption_path)
        implementation_consumption_sha256 = sha256_file(implementation_consumption_path)
        if (
            implementation_consumption.get("status") != "stage4_dual_identity_lineage_implementation_authorization_atomically_consumed"
            or implementation_consumption.get("requestId") != request_id
            or implementation_consumption.get("commandRef") != request_id
            or implementation_consumption.get("scope") != scope
            or implementation_consumption.get("authorizationSha256") != authorization_sha256
            or implementation_consumption.get("oneTimeConsumption") is not True
        ):
            raise ValueError("fixed preview schedule implementation consumption invalid")

        previous_gpu_consumption = read_json(resolve(Path(authorization["bindings"]["previousGpuConsumption"]["path"])))
        source_authorization_path = resolve(Path(previous_gpu_consumption.get("authorizationPath", "missing")))
        if sha256_file(source_authorization_path) != previous_gpu_consumption.get("authorizationSha256"):
            raise ValueError("previous GPU authorization identity changed")
        source_authorization = read_json(source_authorization_path)
        source_binding_keys = (
            "phase0SuccessTerminal", "v9InactiveConfig", "datasetManifest", "datasetSourceIndex",
            "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
            "windowsSafePreviewNormalizer", "gpuResourceGate",
        )
        for key in source_binding_keys:
            value = source_authorization.get("bindings", {}).get(key, {})
            if not value.get("path") or sha256_file(resolve(Path(value["path"]))) != value.get("sha256"):
                raise ValueError(f"fixed preview schedule source binding changed: {key}")

        config = read_json(resolve(Path(source_authorization["bindings"]["v9InactiveConfig"]["path"])))
        package = read_json(resolve(Path(source_authorization["bindings"]["datasetManifest"]["path"])))
        base_positive, base_negative, evidence = run_regressions(config, package)
        active_config = deepcopy(config)
        active_config["training"]["stage4UnifiedTrainingPreviewSamplingContract"] = {
            "schemaVersion": "stage4-unified-training-preview-sampling-contract-v1",
            "enabled": True,
            "status": "active_owner_authorized_single_execution",
            "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
            "modelStateBinding": "sha256_sorted_tensor_bytes_v1",
            "seedBinding": "training_seed_plus_3000",
            "normalizationBinding": "checkpoint_latent_normalization",
            "decodeBinding": "frozen_project_autoencoder_decode_clamp_0_1",
            "checkpointPreviewIdentityGate": "byte_exact_best_epoch_reproduction",
            "deterministicAlgorithmsRequired": True,
            "cublasWorkspaceConfig": ":4096:8",
            "failedPreviewPixelsUsedAsTrainingTargets": False,
            "machineReviewThresholdsUsedAsTrainingTargets": False,
        }
        scheduled = [epoch for epoch in range(1, 31) if trainer.should_reproduce_stage4_fixed_epoch_preview(active_config, epoch)]
        skipped = [epoch for epoch in range(1, 31) if not trainer.should_reproduce_stage4_fixed_epoch_preview(active_config, epoch)]
        source_preview = {
            "denoiserStateSha256": "a" * 64,
            "conditionTensorSha256": "b" * 64,
            "rgbTensorSha256": "c" * 64,
            "previewSha256": "d" * 64,
        }
        exact_reproduction = trainer.validate_stage4_fixed_epoch_preview_reproduction(
            source_preview,
            deepcopy(source_preview),
            5,
        )
        skip_record = trainer.build_stage4_fixed_epoch_preview_skip_record({}, 15)

        def rejects(callable_value, expected_message: str) -> bool:
            try:
                callable_value()
            except ValueError as error:
                return expected_message in str(error)
            return False

        mismatch_rejections = {}
        for key in ("denoiserStateSha256", "conditionTensorSha256", "rgbTensorSha256", "previewSha256"):
            repeated = deepcopy(source_preview)
            repeated[key] = "e" * 64
            mismatch_rejections[key] = rejects(
                lambda repeated=repeated: trainer.validate_stage4_fixed_epoch_preview_reproduction(source_preview, repeated, 5),
                "reproduction identity mismatch",
            )
        trainer_source = inspect.getsource(trainer.main)
        helper_source = inspect.getsource(trainer.should_reproduce_stage4_fixed_epoch_preview)

        fixtures_root = resolve(Path(".runtime/ai-painter/cpu-contract-fixtures"))
        fixtures_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="v9-preview-schedule-", dir=fixtures_root) as fixture_dir_value:
            fixture_root = Path(fixture_dir_value)
            trainer_output = fixture_root / "trainer-output"
            trainer_command = [
                sys.executable, str(resolve(TRAINER_PATH)),
                "--config", str(resolve(Path(source_authorization["bindings"]["v9InactiveConfig"]["path"]))),
                "--dataset-package", str(resolve(Path(source_authorization["bindings"]["datasetManifest"]["path"]))),
                "--autoencoder-checkpoint", str(resolve(Path(source_authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))),
                "--output-dir", str(trainer_output),
                "--resolution-stage", "0",
                "--single-sample-overfit-smoke",
                "--overfit-sample-id", SAMPLE_ID,
                "--overfit-epochs", "30",
                "--overfit-evaluation-interval", "5",
                "--preflight-only",
            ]
            trainer_environment = {**os.environ, "PYTHONUTF8": "1", "CUDA_VISIBLE_DEVICES": ""}
            trainer_preflight = subprocess.run(trainer_command, cwd=ROOT, capture_output=True, text=True, timeout=180, env=trainer_environment)
            trainer_output_absent = not trainer_output.exists()

        positive = {
            "boundFailureEvidenceHashesVerified": True,
            "implementationAuthorizationConsumedExactlyOnce": True,
            "scheduledPreviewEpochsAreExactlyContractEpochs": scheduled == FIXED_EPOCHS,
            "nonPreviewEpoch15IsExplicitlySkipped": 15 in skipped and skip_record == {
                "schemaVersion": "stage4-fixed-epoch-preview-reproduction-v1",
                "status": "fixed_epoch_preview_reproduction_skipped_not_scheduled",
                "epoch": 15,
                "scheduled": False,
            },
            "scheduledPreviewExactReproductionAccepted": exact_reproduction.get("status") == "fixed_epoch_preview_reproduced_exactly" and all(exact_reproduction.get(key) is True for key in ("modelStateSha256Matches", "conditionTensorSha256Matches", "rgbTensorSha256Matches", "pngByteSha256Matches")),
            "legacyInactiveModeDoesNotEnableReproduction": not any(trainer.should_reproduce_stage4_fixed_epoch_preview(config, epoch) for epoch in FIXED_EPOCHS),
            "trainingLoopUsesSharedSchedulePredicate": "should_reproduce_stage4_fixed_epoch_preview(config, preview_epoch)" in trainer_source and "uses_stage4_unified_preview_sampling_contract(config) and should_save_epoch_preview(config, epoch_number)" in helper_source,
            "legacyV9PositiveRegressionPreserved": all(base_positive.values()),
            "legacyV9NegativeRegressionPreserved": all(base_negative.values()),
            "realTrainerStartupPreflightPassed": trainer_preflight.returncode == 0 and "conditional_denoiser_python_preflight_passed" in trainer_preflight.stdout,
            "trainerPreflightDidNotCreateOutput": trainer_output_absent,
            "sample194RemainsValidationWithExpectedSplit": evidence.get("actualSplitCounts") == EXPECTED_COUNTS and evidence.get("sample194Occurrences") == ["validation"],
        }
        negative = {
            "missingScheduledPreviewArtifactRejected": rejects(
                lambda: trainer.validate_stage4_fixed_epoch_preview_reproduction(None, source_preview, 5),
                "preview artifact is missing",
            ),
            "modelStateHashMismatchRejected": mismatch_rejections["denoiserStateSha256"],
            "conditionTensorHashMismatchRejected": mismatch_rejections["conditionTensorSha256"],
            "rgbTensorHashMismatchRejected": mismatch_rejections["rgbTensorSha256"],
            "pngByteHashMismatchRejected": mismatch_rejections["previewSha256"],
            "unexpectedPreviewOnNonPreviewEpochRejected": rejects(
                lambda: trainer.build_stage4_fixed_epoch_preview_skip_record({"previewArtifact": source_preview}, 15),
                "unexpected preview artifact",
            ),
            "epochZeroNotScheduled": not trainer.should_reproduce_stage4_fixed_epoch_preview(active_config, 0),
            "epoch31NotScheduled": not trainer.should_reproduce_stage4_fixed_epoch_preview(active_config, 31),
        }
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-stage4-fixed-preview-schedule-cpu-regression-report-v1",
            "status": "stage4_dual_identity_model_smoke_cpu_regression_passed" if not failed_positive and not failed_negative else "stage4_fixed_preview_schedule_cpu_regression_failed_closed",
            **timestamps("recordedAt"),
            "implementationAuthorization": binding(authorization_path),
            "implementationConsumption": binding(implementation_consumption_path),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "trainerStartupPreflight": {"exitCode": trainer_preflight.returncode, "stdout": trainer_preflight.stdout, "stderr": trainer_preflight.stderr},
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"fixed preview schedule CPU regression failed: {failed_positive}:{failed_negative}")
        support = {
            "schemaVersion": "ai-painter-stage4-fixed-preview-schedule-support-contract-v1",
            "status": "stage4_dual_identity_model_smoke_cpu_support_verified_inactive",
            **timestamps("recordedAt"),
            "implementationAuthorization": binding(authorization_path),
            "implementationConsumption": binding(implementation_consumption_path),
            "scheduledPreviewEpochs": FIXED_EPOCHS,
            "nonPreviewEpochBehavior": "explicit_skip_without_preview_artifact_requirement",
            "gpuAuthorizationIdentity": "separate_not_yet_established",
            "modelStructureChanged": False,
            "lossChanged": False,
            "datasetChanged": False,
            "machineReviewThresholdsChanged": False,
        }
        write_json_exclusive(args.support_contract, support)
        attestation = {
            "schemaVersion": "ai-painter-stage4-dual-identity-implementation-attestation-v1",
            "status": "stage4_dual_identity_implementation_code_attested_cpu_pending",
            **timestamps("recordedAt"),
            "implementationAuthorizationPath": project_path(authorization_path),
            "implementationAuthorizationSha256": authorization_sha256,
            "implementationConsumptionPath": project_path(implementation_consumption_path),
            "implementationConsumptionSha256": implementation_consumption_sha256,
            "runnerPath": project_path(SMOKE_RUNNER_PATH),
            "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "cpuReportPath": project_path(args.report),
            "cpuReportSha256": sha256_file(report_path),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(support_path),
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.implementation_attestation, attestation)
        terminal = {
            "schemaVersion": "ai-painter-stage4-fixed-preview-schedule-cpu-terminal-v1",
            "status": "stage4_dual_identity_model_smoke_cpu_gate_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(report_path),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(support_path),
            "implementationAttestationPath": project_path(args.implementation_attestation),
            "implementationAttestationSha256": sha256_file(attestation_path),
            "nextAction": "establish_new_independent_gpu_execution_authorization_then_run_resource_preflights",
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(terminal_path)}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not terminal_path.exists():
            terminal_path.parent.mkdir(parents=True, exist_ok=True)
            write_json_exclusive(args.terminal, {
                "schemaVersion": "ai-painter-stage4-fixed-preview-schedule-cpu-terminal-v1",
                "status": "stage4_fixed_preview_schedule_cpu_gate_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(args.report) if report_path.exists() else None,
                "reportSha256": sha256_file(report_path) if report_path.exists() else None,
                "checkpointRead": False,
                "optimizerCreated": False,
                "gpuUsed": False,
                "trainingStarted": False,
            })
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_dynamic_validation_kernel_model_smoke_contract_regression(args) -> int:
    candidate_authorization = read_json(resolve(args.smoke_authorization)) if args.smoke_authorization is not None else {}
    if candidate_authorization.get("schemaVersion") == DUAL_IDENTITY_IMPLEMENTATION_AUTHORIZATION_SCHEMA:
        if candidate_authorization.get("implementationActions") == FIXED_PREVIEW_SCHEDULE_IMPLEMENTATION_ACTIONS:
            return run_fixed_preview_schedule_contract_regression(args, candidate_authorization)
        return run_dual_identity_validation_kernel_model_smoke_contract_regression(args, candidate_authorization)
    if (
        args.report is None
        or args.support_contract is None
        or args.terminal is None
        or args.implementation_attestation is None
        or args.authorization_sha256 is None
    ):
        raise ValueError("dynamic validation kernel Smoke CPU mode requires authorization identity and all evidence output paths")
    authorization_path = resolve(args.smoke_authorization)
    expected_authorization_sha256 = args.authorization_sha256.lower()
    report_path = resolve(args.report)
    terminal_path = resolve(args.terminal)
    support_path = resolve(args.support_contract)
    attestation_path = resolve(args.implementation_attestation)
    try:
        if sha256_file(authorization_path) != expected_authorization_sha256:
            raise ValueError("dynamic validation kernel authorization SHA-256 changed")
        authorization = read_json(authorization_path)
        if authorization.get("schemaVersion") != "ai-painter-owner-action-request-v1" or authorization.get("status") != "resolved_owner_authorized":
            raise ValueError("dynamic validation kernel authorization schema or status invalid")
        request_id = authorization.get("requestId")
        scope = authorization.get("ownerDecision", {}).get("scope")
        if not request_id or authorization.get("ownerDecision", {}).get("commandRef") != request_id or not scope:
            raise ValueError("dynamic validation kernel command identity invalid")
        split_action_contract = "implementationActions" in authorization or "executionActions" in authorization
        if split_action_contract:
            if authorization.get("implementationActions") != DYNAMIC_VALIDATION_KERNEL_IMPLEMENTATION_ACTIONS:
                raise ValueError("dynamic validation kernel exact implementation action contract invalid")
            if authorization.get("executionActions") != DYNAMIC_VALIDATION_KERNEL_EXECUTION_ACTIONS:
                raise ValueError("dynamic validation kernel exact execution action contract invalid")
            if set(authorization["implementationActions"]) & set(authorization["executionActions"]):
                raise ValueError("dynamic validation kernel implementation and execution actions overlap")
        elif authorization.get("authorizedActions") != DYNAMIC_VALIDATION_KERNEL_ACTIONS:
            raise ValueError("dynamic validation kernel exact legacy action contract invalid")
        expected_outputs = {
            report_path: authorization.get("output", {}).get("cpuReportPath"),
            support_path: authorization.get("output", {}).get("supportContractPath"),
            attestation_path: authorization.get("output", {}).get("implementationAttestationPath"),
            terminal_path: authorization.get("output", {}).get("cpuTerminalPath"),
        }
        for actual, expected in expected_outputs.items():
            if project_path(actual) != project_path(Path(expected or "missing")):
                raise ValueError("dynamic validation kernel CPU evidence output differs from immutable authorization")
            if actual.exists():
                raise FileExistsError(f"dynamic validation kernel CPU evidence already exists: {project_path(actual)}")
        for key in (
            "previousFailureTerminal", "previousCpuRegressionReport" if split_action_contract else "previousCpuAuthorizationGateReport", "trainerFrozen",
            "authorizationPolicyFrozen", "executionGrantFrozen", "modeRegistryFrozen",
            "phase0SuccessTerminal", "v9InactiveConfig", "datasetManifest", "datasetSourceIndex",
            "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
            "windowsSafePreviewNormalizer", "gpuResourceGate",
        ):
            value = authorization.get("bindings", {}).get(key, {})
            if not value.get("path") or sha256_file(resolve(Path(value["path"]))) != value.get("sha256"):
                raise ValueError(f"dynamic validation kernel binding changed: {key}")
        implementation_consumption_path = resolve(Path(authorization.get("output", {}).get("implementationConsumptionPath", "missing")))
        implementation_consumption = read_json(implementation_consumption_path)
        if (
            implementation_consumption.get("oneTimeConsumption") is not True
            or implementation_consumption.get("authorizationSha256") != expected_authorization_sha256
            or implementation_consumption.get("commandRef") != request_id
            or implementation_consumption.get("scope") != scope
        ):
            raise ValueError("dynamic validation kernel implementation consumption invalid")

        config = read_json(resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
        package = read_json(resolve(Path(authorization["bindings"]["datasetManifest"]["path"])))
        base_positive, base_negative, evidence = run_regressions(config, package)
        active_config = deepcopy(config)
        mode = FORMAL_MODE_REGISTRY.resolve_mode_id("v9_stage4_validation_kernel_smoke")
        active_config["training"]["trainingAuthorizationStatus"] = mode.authorization_status
        active_config["training"]["v9Stage4SingleSampleSmokeContract"]["status"] = "active_owner_authorized_single_execution"
        active_config["training"]["ownerTrainingAuthorization"] = {
            "authorizationId": request_id,
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": expected_authorization_sha256,
            "executionConsumptionPath": authorization["output"]["smokeConsumptionPath"],
            "executionConsumptionSha256": "0" * 64,
            "status": mode.authorization_status,
            "checkpointLoadingAuthorized": True,
            "optimizerCreationAuthorized": True,
            "backwardExecutionAuthorized": True,
            "modelWeightMutationAuthorized": True,
            "gpuTrainingAuthorizedNow": True,
            "singleSampleGpuOverfitSmokeAuthorized": True,
            "fullTrainingAuthorized": False,
            "stage1Authorized": False,
            "stage2Authorized": False,
            "strictRevalidationAuthorized": False,
            "validationAuthorized": False,
            "formalInferenceAuthorized": False,
            "checkpointPromotionAuthorized": False,
            "runtimeFrameAuthorized": False,
            "worldEntryAuthorized": False,
            "automaticRetryAuthorized": False,
        }
        grant = resolve_stage_execution_grant(active_config, project_root=ROOT, verify_owner_files=False)
        validated_grant = validate_serialized_execution_grant(grant.as_dict())

        def run_node(candidate: Path, candidate_sha256: str | None) -> subprocess.CompletedProcess[str]:
            try:
                candidate_argument = project_path(candidate)
            except ValueError:
                candidate_argument = str(candidate)
            command = [
                "node", str(resolve(SMOKE_RUNNER_PATH)),
                "--stage4-validation-kernel-model-smoke",
                "--gpu-authorization", candidate_argument,
                "--cpu-contract-only",
            ]
            if candidate_sha256 is not None:
                command.extend(["--gpu-authorization-sha256", candidate_sha256])
            return subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)

        positive_runner = run_node(authorization_path, expected_authorization_sha256)
        legacy_runner = run_node(resolve(VALIDATION_KERNEL_AUTHORIZATION_PATH), None)
        negative_results: dict[str, subprocess.CompletedProcess[str]] = {}
        fixtures_root = resolve(Path(".runtime/ai-painter/cpu-contract-fixtures"))
        fixtures_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="v9-dynamic-auth-", dir=fixtures_root) as fixture_dir_value:
            fixture_dir = Path(fixture_dir_value)

            def write_fixture(name: str, value: dict) -> tuple[Path, str]:
                candidate = fixture_dir / name
                candidate.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                return candidate, sha256_file(candidate)

            negative_results["hashMismatch"] = run_node(authorization_path, "0" * 64)
            unknown_implementation = deepcopy(authorization)
            unknown_implementation["implementationActions"]["modifyTrainerNow"] = True
            unknown_implementation_path, unknown_implementation_sha = write_fixture("unknown-implementation-action.json", unknown_implementation)
            negative_results["unknownImplementationAction"] = run_node(unknown_implementation_path, unknown_implementation_sha)
            unknown_execution = deepcopy(authorization)
            unknown_execution["executionActions"]["startTrainingNow"] = True
            unknown_execution_path, unknown_execution_sha = write_fixture("unknown-execution-action.json", unknown_execution)
            negative_results["unknownExecutionAction"] = run_node(unknown_execution_path, unknown_execution_sha)
            cross_injected = deepcopy(authorization)
            cross_injected["implementationActions"]["optimizerCreation"] = True
            cross_injected_path, cross_injected_sha = write_fixture("cross-injected-action.json", cross_injected)
            negative_results["crossInjectedAction"] = run_node(cross_injected_path, cross_injected_sha)
            wrong_scope = deepcopy(authorization)
            wrong_scope["ownerDecision"]["scope"] = "forged_scope"
            scope_path, scope_sha = write_fixture("wrong-scope.json", wrong_scope)
            negative_results["scopeMismatch"] = run_node(scope_path, scope_sha)
            forbidden_open = deepcopy(authorization)
            forbidden_open["executionActions"]["stage4FullTraining"] = True
            forbidden_path, forbidden_sha = write_fixture("forbidden-open.json", forbidden_open)
            negative_results["forbiddenAction"] = run_node(forbidden_path, forbidden_sha)
            reused = deepcopy(authorization)
            reused["output"]["smokeConsumptionPath"] = authorization["output"]["implementationConsumptionPath"]
            reused_path, reused_sha = write_fixture("reused-consumption.json", reused)
            negative_results["reusedConsumption"] = run_node(reused_path, reused_sha)
            with tempfile.TemporaryDirectory(prefix="v9-external-auth-") as external_dir:
                external_path = Path(external_dir) / "external-auth.json"
                external_path.write_text(json.dumps(authorization, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                negative_results["externalPathInjection"] = run_node(external_path, sha256_file(external_path))

        positive = {
            "boundEvidenceHashesVerified": True,
            "legacyV9PositiveRegressionPreserved": all(base_positive.values()),
            "legacyV9NegativeRegressionPreserved": all(base_negative.values()),
            "newOwnerAuthorizationReachesSharedRunnerPolicy": positive_runner.returncode == 0 and "authorization_contract_valid_cpu_only" in positive_runner.stdout,
            "legacyValidationKernelAuthorizationStillAccepted": legacy_runner.returncode == 0 and "authorization_contract_valid_cpu_only" in legacy_runner.stdout,
            "modeRegistryResolvesValidationKernelSmoke": mode.execution_kind == "single_sample_smoke" and mode.sample_split == "validation",
            "executionGrantIssuedAndValidated": validated_grant.get("decisionDigest") == grant.decision_digest,
            "executionGrantAllowsBoundSmokeActions": all(grant.permits(action) for action in (ExecutionAction.SELECT_BOUND_SAMPLE, ExecutionAction.LOAD_AUTOENCODER, ExecutionAction.CREATE_OPTIMIZER, ExecutionAction.EXECUTE_BACKWARD, ExecutionAction.MUTATE_MODEL_WEIGHTS, ExecutionAction.WRITE_SMOKE_CHECKPOINT)),
            "executionGrantDeniesLaterStagesAndRuntime": all(not grant.permits(action) for action in (ExecutionAction.RUN_STAGE0, ExecutionAction.RUN_STAGE1, ExecutionAction.RUN_STAGE2, ExecutionAction.RUN_STRICT_REVALIDATION, ExecutionAction.RUN_FORMAL_INFERENCE, ExecutionAction.PROMOTE_CHECKPOINT, ExecutionAction.CREATE_RUNTIME_FRAME, ExecutionAction.ENTER_WORLD, ExecutionAction.AUTOMATIC_RETRY)),
            "sample194RemainsValidationWithExpectedSplit": evidence.get("actualSplitCounts") == EXPECTED_COUNTS and evidence.get("sample194Occurrences") == ["validation"],
        }
        negative = {
            "authorizationHashMismatchRejected": negative_results["hashMismatch"].returncode != 0 and "authorization_sha256_invalid" in negative_results["hashMismatch"].stderr,
            "unknownImplementationActionRejected": negative_results["unknownImplementationAction"].returncode != 0 and "exact_implementation_action_contract_invalid" in negative_results["unknownImplementationAction"].stderr,
            "unknownExecutionActionRejected": negative_results["unknownExecutionAction"].returncode != 0 and "exact_execution_action_contract_invalid" in negative_results["unknownExecutionAction"].stderr,
            "implementationExecutionActionCrossInjectionRejected": negative_results["crossInjectedAction"].returncode != 0 and "implementation_execution_action_overlap" in negative_results["crossInjectedAction"].stderr,
            "scopeMismatchRejected": negative_results["scopeMismatch"].returncode != 0,
            "forbiddenActionActivationRejected": negative_results["forbiddenAction"].returncode != 0 and "exact_execution_action_contract_invalid" in negative_results["forbiddenAction"].stderr,
            "reusedConsumptionRejected": negative_results["reusedConsumption"].returncode != 0 and "already_consumed" in negative_results["reusedConsumption"].stderr,
            "externalAbsolutePathInjectionRejected": negative_results["externalPathInjection"].returncode != 0 and "path_outside_project" in negative_results["externalPathInjection"].stderr,
        }
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-stage4-dynamic-owner-binding-model-smoke-cpu-regression-report-v1",
            "status": "stage4_dynamic_owner_binding_model_smoke_cpu_regression_passed" if not failed_positive and not failed_negative else "stage4_dynamic_owner_binding_model_smoke_cpu_regression_failed_closed",
            **timestamps("recordedAt"),
            "authorization": binding(authorization_path),
            "implementationConsumption": binding(implementation_consumption_path),
            "phase0Terminal": binding(Path(authorization["bindings"]["phase0SuccessTerminal"]["path"])),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "runnerCpuContract": {"exitCode": positive_runner.returncode, "stdout": positive_runner.stdout, "stderr": positive_runner.stderr},
            "legacyRunnerCpuContract": {"exitCode": legacy_runner.returncode, "stdout": legacy_runner.stdout, "stderr": legacy_runner.stderr},
            "negativeRunnerContracts": {key: {"exitCode": value.returncode, "stdout": value.stdout, "stderr": value.stderr} for key, value in negative_results.items()},
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"dynamic validation kernel CPU regression failed: {failed_positive}:{failed_negative}")
        support = {
            "schemaVersion": "ai-painter-stage4-dynamic-owner-binding-model-smoke-support-contract-v1",
            "status": "stage4_dynamic_owner_binding_model_smoke_cpu_support_verified_inactive",
            **timestamps("recordedAt"),
            "authorization": binding(authorization_path),
            "policyVersion": STAGE_CONTROL_POLICY_VERSION,
            "modeId": mode.mode_id,
            "executionGrantDecisionDigest": grant.decision_digest,
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "requiredBoundarySides": ["west"],
            "epochCount": 30,
            "previewEpochs": FIXED_EPOCHS,
            "perPreviewReproductionRequired": True,
            "machineReviewThresholdsChanged": False,
            "phase0CheckpointUsedAsInitialization": False,
        }
        write_json_exclusive(args.support_contract, support)
        attestation = {
            "schemaVersion": "ai-painter-stage4-validation-kernel-model-smoke-implementation-attestation-v1",
            "status": "stage4_validation_kernel_model_smoke_implementation_cpu_verified",
            **timestamps("recordedAt"),
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": expected_authorization_sha256,
            "phase0TerminalPath": authorization["bindings"]["phase0SuccessTerminal"]["path"],
            "phase0TerminalSha256": authorization["bindings"]["phase0SuccessTerminal"]["sha256"],
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "runnerPath": project_path(SMOKE_RUNNER_PATH),
            "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
            "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "cpuReportPath": project_path(args.report),
            "cpuReportSha256": sha256_file(report_path),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(support_path),
            "gpuStarted": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.implementation_attestation, attestation)
        terminal = {
            "schemaVersion": "ai-painter-stage4-dynamic-owner-binding-model-smoke-cpu-terminal-v1",
            "status": "stage4_dynamic_owner_binding_model_smoke_cpu_gate_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(report_path),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(support_path),
            "implementationAttestationPath": project_path(args.implementation_attestation),
            "implementationAttestationSha256": sha256_file(attestation_path),
            "nextAction": "execute_python_cuda_resource_disk_preflights_then_one_v9_30_epoch_model_smoke",
            "checkpointRead": False,
            "optimizerCreated": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(terminal_path)}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not terminal_path.exists():
            write_json_exclusive(args.terminal, {
                "schemaVersion": "ai-painter-stage4-dynamic-owner-binding-model-smoke-cpu-terminal-v1",
                "status": "stage4_dynamic_owner_binding_model_smoke_cpu_gate_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(args.report) if report_path.exists() else None,
                "reportSha256": sha256_file(report_path) if report_path.exists() else None,
                "checkpointRead": False,
                "optimizerCreated": False,
                "gpuUsed": False,
                "trainingStarted": False,
            })
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def validate_smoke_output_paths(authorization: dict, report_path: Path, attestation_path: Path, terminal_path: Path) -> None:
    implementation = authorization.get("implementation", {})
    expected = {
        report_path: implementation.get("cpuReportPath"),
        attestation_path: implementation.get("implementationAttestationPath"),
        terminal_path: implementation.get("cpuTerminalPath"),
    }
    for actual, authorized in expected.items():
        if project_path(actual) != project_path(Path(authorized or "missing")):
            raise ValueError("V9 Smoke CPU evidence output differs from immutable authorization")
        if actual.exists():
            raise FileExistsError(f"V9 Smoke CPU evidence output already exists: {project_path(actual)}")


def validate_smoke_authorization_document(authorization: dict, verify_files: bool) -> None:
    if authorization.get("schemaVersion") != "ai-painter-owner-action-request-v1" or authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V9 Smoke authorization schema or status invalid")
    if authorization.get("requestId") != SMOKE_REQUEST_ID:
        raise ValueError("V9 Smoke request identity invalid")
    owner = authorization.get("ownerDecision", {})
    if owner != {"commandRef": SMOKE_REQUEST_ID, "scope": SMOKE_SCOPE}:
        raise ValueError("V9 Smoke command identity invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "module": "AI Painter R5",
        "stage": 4,
        "architectureId": "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "conditionLabel": "v7-complete-map-194",
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "evaluationInterval": 5,
        "previewEpochs": FIXED_EPOCHS,
        "requiredSplitCounts": EXPECTED_COUNTS,
        "datasetSelectionContract": "registered_v7_capacity_contribution_v1",
        "diagnosticManifestMetricCount": 17,
        "denoiserInitialization": "fixed_random_v9_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    if identity != expected_identity:
        raise ValueError("V9 Smoke task identity changed")
    required_true = {
        "stage4SmokeRunnerV9Extension", "trainerV9SmokeAuthorizationGateExtension",
        "v9SmokeCpuCheckerExtension", "cpuPositiveNegativeAuthorizationRegression",
        "legacyV7V8CompatibilityRegression", "pythonPreflight", "cudaResourcePreflight",
        "diskBudgetPreflight", "projectAutoencoderCheckpointReadAndLoad",
        "v9FixedRandomInitialization", "optimizerCreation", "backwardMethodExecution",
        "boundedModelWeightModification", "singleSampleThirtyEpochTraining",
        "fivePreviewWrite", "exact17DiagnosticManifestWrite", "machineReview",
        "smokeCheckpointWrite", "modelStateHashEvidenceWrite", "terminalEvidenceWrite",
        "uniquePlanUpdate",
    }
    required_false = {
        "oldV7OrV8DenoiserCheckpointReadOrLoad", "hyperparameterSelection",
        "machineReviewThresholdModification", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    }
    actions = authorization.get("authorizedActions", {})
    if set(actions) != required_true | required_false:
        raise ValueError("V9 Smoke action field set changed")
    if any(actions.get(key) is not True for key in required_true) or any(actions.get(key) is not False for key in required_false):
        raise ValueError("V9 Smoke action boundary changed")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True,
        "automaticRetry": False,
        "preserveEvidence": True,
        "laterStageMustNotStart": True,
    }:
        raise ValueError("V9 Smoke failure policy changed")
    bindings = authorization.get("bindings", {})
    baseline = {
        "smokeRunnerBeforeExtension": "cbea5dd82cfc86b777f698919215218b614c344fb6e24c2bfe057a7f2c59521f",
        "v9CpuCheckerBeforeExtension": "b1311cfcd20ceb4e38ac9214ce84af34be8952eac61458004b2a00c13f1a9103",
        "trainerBeforeExtension": "94c2862a9b91ddf5c2f865943bf64a7269fd7822dd6a7767a90961e164d5f7a8",
    }
    for key, expected_hash in baseline.items():
        if bindings.get(key, {}).get("sha256") != expected_hash:
            raise ValueError(f"V9 Smoke baseline identity changed: {key}")
    if verify_files:
        for key, value in bindings.items():
            if key in baseline:
                continue
            bound_path = resolve(Path(value.get("path", "missing")))
            if not bound_path.is_file() or sha256_file(bound_path) != value.get("sha256"):
                raise ValueError(f"V9 Smoke evidence binding missing or changed: {key}")
        diagnostic_terminal = read_json(resolve(Path(bindings["v9GradientDiagnosticTerminal"]["path"])))
        diagnostic_report = read_json(resolve(Path(bindings["v9GradientDiagnosticReport"]["path"])))
        if diagnostic_terminal.get("status") != "v9_gradient_diagnostic_passed_closed":
            raise ValueError("V9 Smoke diagnostic terminal prerequisite invalid")
        if diagnostic_report.get("status") != "passed_readonly_v9_gpu_forward_and_gradient_routing_weights_unchanged":
            raise ValueError("V9 Smoke diagnostic report prerequisite invalid")


def validate_smoke_implementation_consumption(authorization: dict) -> None:
    value = read_json(resolve(Path(authorization["implementation"]["implementationConsumptionPath"])))
    if (
        value.get("status") != "v9_stage4_smoke_implementation_authorization_atomically_consumed"
        or value.get("requestId") != SMOKE_REQUEST_ID
        or value.get("commandRef") != SMOKE_REQUEST_ID
        or value.get("scope") != SMOKE_SCOPE
        or value.get("authorizationSha256") != SMOKE_AUTHORIZATION_SHA256
        or value.get("oneTimeConsumption") is not True
        or value.get("gpuExecutionConsumed") is not False
        or value.get("checkpointRead") is not False
        or value.get("optimizerCreated") is not False
        or value.get("trainingStarted") is not False
    ):
        raise ValueError("V9 Smoke implementation consumption is invalid")


def smoke_source_and_syntax_regression() -> dict:
    runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
    dispatcher_source = resolve(SMOKE_DISPATCHER_PATH).read_text(encoding="utf-8")
    trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
    compile(trainer_source, str(resolve(TRAINER_PATH)), "exec")
    runner_check = subprocess.run(
        ["node", "--check", str(resolve(SMOKE_RUNNER_PATH))], cwd=ROOT,
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    dispatcher_check = subprocess.run(
        ["node", "--check", str(resolve(SMOKE_DISPATCHER_PATH))], cwd=ROOT,
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    return {
        "runnerJavaScriptSyntaxValid": runner_check.returncode == 0,
        "dispatcherJavaScriptSyntaxValid": dispatcher_check.returncode == 0,
        "trainerPythonSyntaxValid": True,
        "runnerV9ModeBound": "--v9-object-alignment" in runner_source and "validateV9Authorization" in runner_source,
        "dispatcherV9ModeBound": "--v9-object-alignment" in dispatcher_source,
        "trainerV9ActiveGateBound": (
            "V9_STAGE4_SMOKE_ACTIVE_STATUS" in trainer_source
            and "validate_v9_stage4_active_smoke_contract" in trainer_source
        ),
        "oldV7V8RunnerEntryPreserved": "--v8-decoded-alignment" in dispatcher_source,
    }


def smoke_authorization_negative_regression(authorization: dict) -> dict:
    def rejected(mutation) -> bool:
        candidate = deepcopy(authorization)
        mutation(candidate)
        try:
            validate_smoke_authorization_document(candidate, verify_files=True)
        except (ValueError, FileNotFoundError, PermissionError, KeyError):
            return True
        return False

    return {
        "rejectWrongSample": rejected(lambda value: value["taskIdentity"].__setitem__("sampleId", "wrong")),
        "rejectTrainSplitImpersonation": rejected(lambda value: value["taskIdentity"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejected(lambda value: value["taskIdentity"].__setitem__("seed", 1)),
        "rejectWrongWestTopology": rejected(lambda value: value["taskIdentity"].__setitem__("requiredBoundarySides", ["east"])),
        "rejectWrongResolution": rejected(lambda value: value["taskIdentity"].__setitem__("resolution", {"width": 512, "height": 384})),
        "rejectWrongEpochCount": rejected(lambda value: value["taskIdentity"].__setitem__("epochCount", 40)),
        "rejectWrongPreviewSchedule": rejected(lambda value: value["taskIdentity"].__setitem__("previewEpochs", [1, 10, 20, 30])),
        "rejectOldDenoiserCheckpointRead": rejected(lambda value: value["authorizedActions"].__setitem__("oldV7OrV8DenoiserCheckpointReadOrLoad", True)),
        "rejectFullTraining": rejected(lambda value: value["authorizedActions"].__setitem__("stage4FullTraining", True)),
        "rejectStage1OrStage2": rejected(lambda value: value["authorizedActions"].__setitem__("stage1OrStage2", True)),
        "rejectAutomaticRetry": rejected(lambda value: value["authorizedActions"].__setitem__("automaticRetry", True)),
        "rejectClosedOptimizer": rejected(lambda value: value["authorizedActions"].__setitem__("optimizerCreation", False)),
        "rejectUnknownAction": rejected(lambda value: value["authorizedActions"].__setitem__("startTrainingNow", True)),
        "rejectWrongDiagnosticHash": rejected(lambda value: value["bindings"]["v9GradientDiagnosticReport"].__setitem__("sha256", "0" * 64)),
        "rejectWrongCommandScope": rejected(lambda value: value["ownerDecision"].__setitem__("scope", "wrong")),
    }


def validate_output_paths(authorization: dict, args) -> None:
    expected = authorization.get("outputPaths", {})
    pairs = (
        (args.report, expected.get("cpuReport")),
        (args.support_contract, expected.get("supportContract")),
        (args.terminal, expected.get("terminal")),
    )
    for actual, authorized in pairs:
        if project_path(actual) != project_path(Path(authorized or "missing")):
            raise ValueError("V9 CPU evidence output differs from immutable authorization")
        if resolve(actual).exists():
            raise FileExistsError(f"V9 CPU evidence output already exists: {project_path(actual)}")


def run_regressions(config: dict, package: dict):
    trainer.validate_training_inputs(config, package)
    selection = trainer.conditional_dataset_selection_contract(config)
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=selection,
        )
        for split in EXPECTED_COUNTS
    }
    loaded = trainer.validate_loaded_v7_datasets(datasets)
    occurrences = [
        split
        for split, dataset in datasets.items()
        for row in dataset.rows
        if row.get("sampleId") == SAMPLE_ID
    ]
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    registered_rows = [row for row in source_index.get("samples", []) if row.get("v7CapacityContributionRegistered") is True]
    source_sample = [row for row in registered_rows if row.get("sampleId") == SAMPLE_ID]
    synthetic = synthetic_cpu_regression(config)
    manifest = manifest_registry_regression(config, synthetic["diagnosticMetrics"])
    compatibility = legacy_compatibility_regression(config, package)
    alignment = config["training"]["stage4ObjectSemanticDecoderAlignment"]
    supervision = alignment["objectSemanticTrainingSupervision"]
    positive = {
        "inactiveContractValidated": True,
        "architectureV9": config.get("denoiserArchitecture") == "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
        "conditionChannelsRemain23": config.get("conditionChannels") == 23 and len(config.get("conditionChannelOrder", [])) == 23,
        "latentOutputShapePreserved": alignment.get("latentOutputShapeChanged") is False and synthetic["predictedVelocityShape"] == [1, int(config["latentChannels"]), 8, 8],
        "objectChannelsExact": alignment["independentObjectSemanticProjections"].get("objectChannels") == OBJECT_CHANNELS,
        "independentProjectionCountEight": alignment["independentObjectSemanticProjections"].get("projectionCount") == 8,
        "objectReadoutShapesValid": synthetic["objectReadoutUp1Shape"] == [1, 4, 4, 4] and synthetic["objectReadoutUp0Shape"] == [1, 4, 8, 8],
        "routeReadoutShapeValid": synthetic["routeReadoutShape"] == [1, 2, 8, 8],
        "fourObjectRoutesReceiveGradients": all(synthetic["gradientNorms"][name] > 0.0 for name in OBJECT_CHANNELS),
        "routeReadoutReceivesGradient": synthetic["gradientNorms"]["routeTopology"] > 0.0,
        "typedAdaptersReceiveGradient": synthetic["gradientNorms"]["typedAdapters"] > 0.0,
        "baseDenoiserReceivesGradient": synthetic["gradientNorms"]["baseDenoiser"] > 0.0,
        "objectProjectionIsolation": all(synthetic["objectProjectionIsolation"].values()),
        "cpuAutogradInspectionDidNotPopulateGradFields": synthetic["parameterGradFieldsAbsent"],
        "modelStateUnchanged": synthetic["denoiserStateHashUnchanged"] and synthetic["autoencoderStateHashUnchanged"],
        "compositeLossFinite": synthetic["compositeLossFinite"],
        "legalSupervisionOnly": supervision.get("allowedSources") == compiler.ALLOWED_SOURCES,
        "failedPreviewAndReviewTargetsExcluded": (
            supervision.get("failedPreviewPixelsUsedAsTrainingTargets") is False
            and supervision.get("machineReviewThresholdsUsedAsTrainingTargets") is False
            and supervision.get("machineReviewLabelsUsedAsTrainingTargets") is False
        ),
        "existingWeightReused": supervision.get("weightSource") == "training.denoiserLossWeights.discreteConditionOutputBinding",
        "noFreeHyperparameters": supervision.get("newFreeHyperparameterSelected") is False and alignment.get("hyperparameterSelections") == [],
        "datasetContractExplicit": selection == "registered_v7_capacity_contribution_v1",
        "actualSplitCounts48_8_4_4": loaded["actualSplitCounts"] == EXPECTED_COUNTS,
        "actualCapacityCount64": loaded["actualLoadedV7CapacityCount"] == 64 and len(registered_rows) == 64,
        "sample194UniqueValidation": occurrences == ["validation"] and len(source_sample) == 1 and source_sample[0].get("split") == "validation",
        "exact17MetricsProduced": synthetic["diagnosticFieldSetExact"] and synthetic["diagnosticValuesFiniteNonnegative"],
        "fixedEpochManifestRowsRegistered": manifest["allFixedEpochRowsExact"],
        "nonFixedEpochNotRegistered": manifest["nonFixedEpochHasNoDiagnosticFields"],
        "legacyV8TrainerContractPreserved": compatibility["v8TrainerContractValid"],
        "legacyV8ModelReadoutPreserved": compatibility["v8ReadoutShape"] == [1, 6, 8, 8],
        "legacyV7ModelForwardPreserved": compatibility["v7PredictedVelocityShape"] == [1, int(config["latentChannels"]), 8, 8],
    }
    negative = {
        "rejectWrongObjectOrder": rejects(config, package, lambda value: value["training"]["stage4ObjectSemanticDecoderAlignment"]["independentObjectSemanticProjections"].__setitem__("objectChannels", list(reversed(OBJECT_CHANNELS)))),
        "rejectMissingProjectionScale": rejects(config, package, lambda value: value["training"]["stage4ObjectSemanticDecoderAlignment"]["independentObjectSemanticProjections"].__setitem__("scales", ["up0"])),
        "rejectWrongProjectionCount": rejects(config, package, lambda value: value["training"]["stage4ObjectSemanticDecoderAlignment"]["independentObjectSemanticProjections"].__setitem__("projectionCount", 7)),
        "rejectSharedObjectProjection": rejects(config, package, lambda value: value["training"]["stage4ObjectSemanticDecoderAlignment"]["independentObjectSemanticProjections"].__setitem__("independentPerObject", False)),
        "rejectFailedPreviewPixelTarget": rejects(config, package, lambda value: set_supervision(value, "failedPreviewPixelsUsedAsTrainingTargets", True)),
        "rejectReviewThresholdTarget": rejects(config, package, lambda value: set_supervision(value, "machineReviewThresholdsUsedAsTrainingTargets", True)),
        "rejectReviewLabelTarget": rejects(config, package, lambda value: set_supervision(value, "machineReviewLabelsUsedAsTrainingTargets", True)),
        "rejectIllegalSupervisionSource": rejects(config, package, lambda value: set_supervision(value, "allowedSources", compiler.ALLOWED_SOURCES + ["failed_preview_pixels"])),
        "rejectNewFreeHyperparameter": rejects(config, package, lambda value: set_supervision(value, "newFreeHyperparameterSelected", True)),
        "rejectHyperparameterSelections": rejects(config, package, lambda value: value["training"]["stage4ObjectSemanticDecoderAlignment"].__setitem__("hyperparameterSelections", [{"weight": 1.0}])),
        "rejectWrongWeightSource": rejects(config, package, lambda value: set_supervision(value, "weightSource", "training.newObjectWeight")),
        "rejectWrongMetricCount": rejects(config, package, lambda value: set_registry(value, "exactFieldCount", 16)),
        "rejectMissingMetricField": rejects(config, package, remove_last_registry_field),
        "rejectUnknownMetricField": rejects(config, package, add_unknown_registry_field),
        "rejectWrongSample": rejects(config, package, lambda value: value["training"]["v9Stage4SingleSampleSmokeContract"].__setitem__("sampleId", "wrong")),
        "rejectTrainReclassification": rejects(config, package, lambda value: value["training"]["v9Stage4SingleSampleSmokeContract"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejects(config, package, lambda value: value["training"].__setitem__("seed", 1)),
        "rejectWrongWestTopology": rejects(config, package, lambda value: value["training"]["authorizedBoundaryTopology"].__setitem__("requiredBoundarySides", ["east"])),
        "rejectOldCheckpointCompatibility": rejects(config, package, lambda value: value["training"]["v9Stage4SingleSampleSmokeContract"].__setitem__("oldDenoiserCheckpointCompatible", True)),
        "rejectCheckpointReadActivation": rejects(config, package, lambda value: set_activation(value, "checkpointReadNow", True)),
        "rejectOptimizerActivation": rejects(config, package, lambda value: set_activation(value, "optimizerCreationNow", True)),
        "rejectBackwardActivation": rejects(config, package, lambda value: set_activation(value, "backwardExecutionNow", True)),
        "rejectGpuActivation": rejects(config, package, lambda value: set_activation(value, "gpuUseNow", True)),
        "rejectTrainingActivation": rejects(config, package, lambda value: set_activation(value, "trainingNow", True)),
        "rejectUnknownActivationField": rejects(config, package, lambda value: set_activation(value, "startTrainingNow", True)),
        "rejectNestedOwnerOptimizer": rejects(config, package, lambda value: value["training"]["ownerTrainingAuthorization"].__setitem__("optimizerCreationAuthorized", True)),
        "rejectNestedOwnerBackward": rejects(config, package, lambda value: value["training"]["ownerTrainingAuthorization"].__setitem__("backwardExecutionAuthorized", True)),
        "rejectNestedOwnerGpu": rejects(config, package, lambda value: value["training"]["ownerTrainingAuthorization"].__setitem__("gpuTrainingAuthorizedNow", True)),
        "rejectActiveStatus": rejects(config, package, lambda value: value["training"].__setitem__("trainingAuthorizationStatus", "active")),
        "manifestRejectsMissingMetric": manifest["rejectMissingMetric"],
        "manifestRejectsUnknownMetric": manifest["rejectUnknownMetric"],
        "manifestRejectsNegativeMetric": manifest["rejectNegativeMetric"],
        "manifestRejectsNanMetric": manifest["rejectNanMetric"],
    }
    evidence = {
        "actualSplitCounts": loaded["actualSplitCounts"],
        "actualLoadedV7CapacityCount": loaded["actualLoadedV7CapacityCount"],
        "sample194Occurrences": occurrences,
        "syntheticCpuRegression": {key: value for key, value in synthetic.items() if key != "diagnosticMetrics"},
        "manifestRegistryRegression": manifest,
        "legacyCompatibilityRegression": compatibility,
        "sourceCodeBindings": {
            "model": binding(MODEL_PATH),
            "trainer": binding(TRAINER_PATH),
            "compiler": binding(COMPILER_PATH),
            "cpuChecker": binding(CPU_CHECKER_PATH),
        },
    }
    return positive, negative, evidence


def synthetic_cpu_regression(config: dict) -> dict:
    torch.manual_seed(20263722)
    model = build_complete_world_system(config).cpu().train()
    model.autoencoder.requires_grad_(False)
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
    conditions = synthetic_conditions(config)
    latent_channels = int(config["latentChannels"])
    clean_latent = torch.randn(1, latent_channels, 8, 8)
    noisy_latent = torch.randn_like(clean_latent)
    target_velocity = torch.randn_like(clean_latent)
    timesteps = torch.tensor([999], dtype=torch.long)
    alpha_bars = torch.linspace(0.999, 0.001, int(config["diffusionSteps"]))
    target_image = torch.rand(1, 3, 32, 32)
    normalization = {
        "mean": torch.zeros(1, latent_channels, 1, 1),
        "standardDeviation": torch.ones(1, latent_channels, 1, 1),
    }
    losses = trainer.predict_and_measure(
        model, noisy_latent, target_velocity, clean_latent, timesteps, alpha_bars,
        conditions, config, target_image=target_image, latent_normalization=normalization,
    )
    named = [(name, parameter) for name, parameter in model.denoiser.named_parameters() if parameter.requires_grad]
    gradients = torch.autograd.grad(
        losses["compositeLossTensor"], [parameter for _, parameter in named], allow_unused=True,
    )
    norms = {**{name: 0.0 for name in OBJECT_CHANNELS}, "typedAdapters": 0.0, "routeTopology": 0.0, "baseDenoiser": 0.0}
    for (name, _), gradient in zip(named, gradients):
        if gradient is None:
            continue
        norm = float(gradient.detach().float().pow(2).sum().sqrt())
        matched_object = next((item for item in OBJECT_CHANNELS if f"v9_object_projection_up1.{item}" in name or f"v9_object_projection_up0.{item}" in name or f"v9_object_readout_up1.{item}" in name or f"v9_object_readout_up0.{item}" in name), None)
        if matched_object:
            norms[matched_object] += norm
        elif "typed_condition_adapter" in name:
            norms["typedAdapters"] += norm
        elif "v9_route_topology_readout" in name:
            norms["routeTopology"] += norm
        else:
            norms["baseDenoiser"] += norm
    predicted_velocity, alignment = model.predict_velocity_with_stage4_object_alignment(
        noisy_latent, timesteps, conditions,
    )
    isolation = object_projection_isolation(alignment, conditions, config)
    diagnostics = {
        key: float(losses[key].detach())
        for key in trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
    }
    denoiser_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
    return {
        "predictedVelocityShape": list(predicted_velocity.shape),
        "objectReadoutUp1Shape": list(alignment["objectReadoutUp1"].shape),
        "objectReadoutUp0Shape": list(alignment["objectReadoutUp0"].shape),
        "routeReadoutShape": list(alignment["routeReadout"].shape),
        "gradientNorms": norms,
        "objectProjectionIsolation": isolation,
        "compositeLoss": float(losses["compositeLossTensor"].detach()),
        "compositeLossFinite": bool(torch.isfinite(losses["compositeLossTensor"]).item()),
        "diagnosticMetrics": diagnostics,
        "diagnosticFieldSetExact": set(diagnostics) == set(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
        "diagnosticValuesFiniteNonnegative": all(math.isfinite(value) and value >= 0.0 for value in diagnostics.values()),
        "parameterGradFieldsAbsent": all(parameter.grad is None for parameter in model.parameters()),
        "denoiserStateHashBefore": denoiser_before,
        "denoiserStateHashAfter": denoiser_after,
        "denoiserStateHashUnchanged": denoiser_before == denoiser_after,
        "autoencoderStateHashBefore": autoencoder_before,
        "autoencoderStateHashAfter": autoencoder_after,
        "autoencoderStateHashUnchanged": autoencoder_before == autoencoder_after,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "gpuUsed": False,
    }


def object_projection_isolation(alignment: dict, conditions: torch.Tensor, config: dict) -> dict:
    targets_up1 = trainer.stage4_v9_object_targets(conditions, alignment["objectReadoutUp1"].shape[-2:], config)
    targets_up0 = trainer.stage4_v9_object_targets(conditions, alignment["objectReadoutUp0"].shape[-2:], config)
    features = tuple(alignment["objectProjectionFeaturesUp1"]) + tuple(alignment["objectProjectionFeaturesUp0"])
    result = {}
    for index, name in enumerate(OBJECT_CHANNELS):
        loss = (
            trainer.balanced_binary_condition_loss(alignment["objectReadoutUp1"][:, index:index + 1], targets_up1[:, index:index + 1])
            + trainer.balanced_binary_condition_loss(alignment["objectReadoutUp0"][:, index:index + 1], targets_up0[:, index:index + 1])
        ) * 0.5
        gradients = torch.autograd.grad(loss, features, retain_graph=True, allow_unused=True)
        own = gradients[index] is not None and gradients[index + 4] is not None
        other_zero = all(
            gradient is None or float(gradient.detach().abs().max()) == 0.0
            for other_index, gradient in enumerate(gradients)
            if other_index not in {index, index + 4}
        )
        result[name] = own and other_zero
    return result


def synthetic_conditions(config: dict) -> torch.Tensor:
    conditions = torch.rand(1, 23, 32, 32)
    order = list(config["conditionChannelOrder"])
    for name in config["conditionChannelTypes"]["discrete"]:
        index = order.index(name)
        conditions[:, index] = (conditions[:, index] > 0.78).float()
    path_index = order.index("terrain_path_ground")
    conditions[:, path_index] = 0.0
    conditions[:, path_index, 13:19, :24] = 1.0
    for name, (top, left) in zip(OBJECT_CHANNELS, ((2, 3), (8, 10), (16, 17), (24, 24))):
        index = order.index(name)
        conditions[:, index] = 0.0
        conditions[:, index, top:top + 5, left:left + 5] = 1.0
    return conditions


def manifest_registry_regression(config: dict, metrics: dict) -> dict:
    rows = []
    for epoch in FIXED_EPOCHS:
        row = trainer.register_v9_stage4_diagnostic_manifest_fields({"epoch": epoch}, metrics, epoch, config)
        rows.append(row)
    nonfixed = trainer.register_v9_stage4_diagnostic_manifest_fields({"epoch": 2}, metrics, 2, config)
    return {
        "fixedEpochs": FIXED_EPOCHS,
        "allFixedEpochRowsExact": all(
            set(row) == {"epoch", *trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS}
            for row in rows
        ),
        "nonFixedEpochHasNoDiagnosticFields": set(nonfixed) == {"epoch"},
        "rejectMissingMetric": manifest_rejects(config, {key: value for key, value in metrics.items() if key != trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS[0]}),
        "rejectUnknownMetric": manifest_rejects(config, {**metrics, "stage4DiagnosticUnknown": 1.0}),
        "rejectNegativeMetric": manifest_rejects(config, {**metrics, trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS[0]: -1.0}),
        "rejectNanMetric": manifest_rejects(config, {**metrics, trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS[0]: float("nan")}),
    }


def manifest_rejects(config: dict, metrics: dict) -> bool:
    try:
        trainer.register_v9_stage4_diagnostic_manifest_fields({}, metrics, 1, config)
    except ValueError:
        return True
    return False


def legacy_compatibility_regression(config: dict, package: dict) -> dict:
    trainer.validate_training_inputs(config, package)
    v8 = read_json(resolve(V8_CONFIG_PATH))
    trainer.validate_training_inputs(v8, package)
    torch.manual_seed(17)
    noisy = torch.randn(1, int(config["latentChannels"]), 8, 8)
    timestep = torch.tensor([7], dtype=torch.long)
    conditions = synthetic_conditions(config)
    v9_model = build_complete_world_system(config).cpu().eval()
    with torch.no_grad():
        v9_velocity, v9_alignment = v9_model.predict_velocity_with_stage4_object_alignment(
            noisy, timestep, conditions
        )
    v8_model = build_complete_world_system(v8).cpu().eval()
    with torch.no_grad():
        _, v8_readout = v8_model.predict_velocity_with_stage4_alignment(noisy, timestep, conditions)
    v7 = deepcopy(config)
    v7["denoiserArchitecture"] = "multiscale_condition_unet_v7"
    v7_model = build_complete_world_system(v7).cpu().eval()
    with torch.no_grad():
        v7_velocity = v7_model.predict_velocity(noisy, timestep, conditions)
    return {
        "v9TrainerContractValid": True,
        "v9PredictedVelocityShape": list(v9_velocity.shape),
        "v9ObjectReadoutUp0Shape": list(v9_alignment["objectReadoutUp0"].shape),
        "v8TrainerContractValid": True,
        "v8ReadoutShape": list(v8_readout.shape),
        "v7PredictedVelocityShape": list(v7_velocity.shape),
        "checkpointRead": False,
    }


def phase0_determinism_scope_ast_contract(source: str, require_phase0_routes: bool = True) -> dict:
    tree = ast.parse(source)
    target = next(
        (
            node for node in tree.body
            if isinstance(node, ast.FunctionDef)
            and node.name == "run_structure_fact_first_phase0_causal"
        ),
        None,
    )
    if target is None:
        return {"valid": False, "reason": "phase0_function_missing"}

    strict_scopes = []
    for node in ast.walk(target):
        if not isinstance(node, ast.With):
            continue
        for item in node.items:
            expression = item.context_expr
            if (
                isinstance(expression, ast.Call)
                and isinstance(expression.func, ast.Name)
                and expression.func.id == "stage4_fixed_preview_determinism_scope"
                and len(expression.args) == 1
                and isinstance(expression.args[0], ast.Constant)
                and expression.args[0].value is True
            ):
                strict_scopes.append(node)
    if len(strict_scopes) != 1:
        return {"valid": False, "reason": "strict_scope_count", "count": len(strict_scopes)}

    scope = strict_scopes[0]
    scope_calls = list(ast.walk(scope))
    scope_call_names = {
        node.func.id
        for node in scope_calls
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    scope_attribute_call_names = {
        f"{node.func.value.id}.{node.func.attr}"
        for node in scope_calls
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
        )
    }
    forbidden_calls = []
    for node in scope_calls:
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Attribute):
            if (
                isinstance(node.func.value, ast.Name)
                and node.func.value.id == "torch"
                and node.func.attr == "autograd"
            ):
                forbidden_calls.append("torch.autograd")
            if node.func.attr == "backward":
                forbidden_calls.append("backward")
        if isinstance(node.func, ast.Name) and node.func.id in {"Adam", "AdamW", "SGD"}:
            forbidden_calls.append(node.func.id)
    scope_text = ast.get_source_segment(source, scope) or ""
    if "torch.autograd.grad" in scope_text:
        forbidden_calls.append("torch.autograd.grad")
    required_calls = {
        "run_marked_causal_route",
        "model.predict_velocity_with_stage4_structure_fact",
        "decode_velocity",
    }
    routes_present = required_calls.issubset(
        scope_call_names | scope_attribute_call_names
    )
    valid = not forbidden_calls and (routes_present or not require_phase0_routes)
    return {
        "valid": valid,
        "reason": None if valid else "scope_content_invalid",
        "strictScopeCount": 1,
        "requiredRouteCallsPresent": routes_present,
        "forbiddenCalls": sorted(set(forbidden_calls)),
        "startLine": scope.lineno,
        "endLine": getattr(scope, "end_lineno", scope.lineno),
    }


def deterministic_backend_state() -> dict:
    return {
        "deterministicDebugMode": int(torch.get_deterministic_debug_mode()),
        "deterministicAlgorithmsEnabled": bool(torch.are_deterministic_algorithms_enabled()),
        "cudnnDeterministic": bool(torch.backends.cudnn.deterministic),
        "cudnnBenchmark": bool(torch.backends.cudnn.benchmark),
        "cublasWorkspaceConfig": os.environ.get("CUBLAS_WORKSPACE_CONFIG"),
    }


def fixed_preview_scope_restoration_regression() -> dict:
    before = deterministic_backend_state()
    with fixed_preview_determinism_scope(True):
        inside = deterministic_backend_state()
    after_success = deterministic_backend_state()
    exception_observed = False
    try:
        with fixed_preview_determinism_scope(True):
            raise RuntimeError("synthetic_scope_cleanup_probe")
    except RuntimeError as error:
        exception_observed = str(error) == "synthetic_scope_cleanup_probe"
    after_exception = deterministic_backend_state()
    return {
        "before": before,
        "inside": inside,
        "afterSuccess": after_success,
        "afterException": after_exception,
        "strictInside": (
            inside["deterministicAlgorithmsEnabled"] is True
            and inside["cudnnDeterministic"] is True
            and inside["cudnnBenchmark"] is False
            and inside["cublasWorkspaceConfig"] == ":4096:8"
        ),
        "successRestored": after_success == before,
        "exceptionObserved": exception_observed,
        "exceptionRestored": after_exception == before,
    }


def structure_fact_first_phase0_synthetic_determinism_regression(config: dict) -> dict:
    torch.manual_seed(20263722)
    model = build_complete_world_system(config).cpu().eval()
    conditions = synthetic_conditions(config)
    noisy = torch.randn(1, int(config["latentChannels"]), 8, 8)
    timestep = torch.tensor([999], dtype=torch.long)
    channel_names = tuple(trainer.STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS)
    head_modules = [model.denoiser.structure_fact_heads[name] for name in channel_names]
    hook_counts_before = [len(module._forward_hooks) for module in head_modules]
    rng_before = torch.get_rng_state().clone()

    def decode(velocity):
        return model.autoencoder.decode(velocity)

    with fixed_preview_determinism_scope(True):
        with torch.no_grad():
            normal_velocity, normal_alignment = model.predict_velocity_with_stage4_structure_fact(
                noisy, timestep, conditions
            )
            normal_rgb = decode(normal_velocity)
        normal_heads = {
            name: value.detach()
            for name, value in zip(channel_names, normal_alignment["structureHeadOutputs"])
        }

        def route(route_name: str, fail: bool = False):
            handles = []
            permutation = tuple(reversed(channel_names))
            try:
                for index, name in enumerate(channel_names):
                    if fail and index == 0:
                        def hook(module, inputs, output):
                            raise RuntimeError("synthetic_hook_cleanup_probe")
                    elif route_name == "zero":
                        def hook(module, inputs, output):
                            return torch.zeros_like(output)
                    else:
                        source = normal_heads[permutation[index]]
                        transformed = torch.roll(
                            source,
                            shifts=(index + 1, (index * 3 + 1) % max(1, source.shape[-1])),
                            dims=(-2, -1),
                        )
                        def hook(module, inputs, output, value=transformed):
                            return value.to(device=output.device, dtype=output.dtype)
                    handles.append(
                        model.denoiser.structure_fact_heads[name].register_forward_hook(hook)
                    )
                with torch.no_grad():
                    velocity, _ = model.predict_velocity_with_stage4_structure_fact(
                        noisy, timestep, conditions
                    )
                    rgb = decode(velocity)
                return {
                    "velocity": velocity,
                    "rgb": rgb,
                    "velocitySha256": trainer.tensor_sha256(velocity),
                    "decodedRgbSha256": trainer.tensor_sha256(rgb),
                }
            finally:
                for handle in handles:
                    handle.remove()

        zero_first = route("zero")
        zero_repeat = route("zero")
        shuffle_first = route("shuffle")
        shuffle_repeat = route("shuffle")
        hook_exception_observed = False
        try:
            route("zero", fail=True)
        except RuntimeError as error:
            hook_exception_observed = str(error) == "synthetic_hook_cleanup_probe"

    hook_counts_after = [len(module._forward_hooks) for module in head_modules]
    rng_after = torch.get_rng_state().clone()
    return {
        "normal": {
            "velocitySha256": trainer.tensor_sha256(normal_velocity),
            "decodedRgbSha256": trainer.tensor_sha256(normal_rgb),
        },
        "zeroFirst": {key: value for key, value in zero_first.items() if key.endswith("Sha256")},
        "zeroRepeat": {key: value for key, value in zero_repeat.items() if key.endswith("Sha256")},
        "shuffleFirst": {key: value for key, value in shuffle_first.items() if key.endswith("Sha256")},
        "shuffleRepeat": {key: value for key, value in shuffle_repeat.items() if key.endswith("Sha256")},
        "zeroRepeatExact": (
            zero_first["velocitySha256"] == zero_repeat["velocitySha256"]
            and zero_first["decodedRgbSha256"] == zero_repeat["decodedRgbSha256"]
        ),
        "shuffleRepeatExact": (
            shuffle_first["velocitySha256"] == shuffle_repeat["velocitySha256"]
            and shuffle_first["decodedRgbSha256"] == shuffle_repeat["decodedRgbSha256"]
        ),
        "zeroDiffersFromNormal": (
            zero_first["velocitySha256"] != trainer.tensor_sha256(normal_velocity)
            and zero_first["decodedRgbSha256"] != trainer.tensor_sha256(normal_rgb)
        ),
        "shuffleDiffersFromNormal": (
            shuffle_first["velocitySha256"] != trainer.tensor_sha256(normal_velocity)
            and shuffle_first["decodedRgbSha256"] != trainer.tensor_sha256(normal_rgb)
        ),
        "rngStateUnchanged": bool(torch.equal(rng_before, rng_after)),
        "hookExceptionObserved": hook_exception_observed,
        "hooksRestoredAfterSuccessAndException": hook_counts_after == hook_counts_before,
        "hookCountsBefore": hook_counts_before,
        "hookCountsAfter": hook_counts_after,
    }


def set_supervision(config: dict, key: str, value) -> None:
    config["training"]["stage4ObjectSemanticDecoderAlignment"]["objectSemanticTrainingSupervision"][key] = value


def set_registry(config: dict, key: str, value) -> None:
    config["training"]["stage4ObjectSemanticDecoderAlignment"]["diagnosticManifestRegistry"][key] = value


def remove_last_registry_field(config: dict) -> None:
    config["training"]["stage4ObjectSemanticDecoderAlignment"]["diagnosticManifestRegistry"]["exactFields"].pop()


def add_unknown_registry_field(config: dict) -> None:
    config["training"]["stage4ObjectSemanticDecoderAlignment"]["diagnosticManifestRegistry"]["exactFields"].append("stage4DiagnosticUnknown")


def run_unified_preview_contract_regression(args) -> int:
    if args.report is None or args.implementation_attestation is None:
        raise ValueError("unified preview regression requires --report and --implementation-attestation")
    authorization = read_json(resolve(CONTINUOUS_AUTHORIZATION_PATH))
    config = read_json(resolve(UNIFIED_PREVIEW_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    source_config = read_json(resolve(CONFIG_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
    runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
    trainer.validate_training_inputs(config, package)
    trainer.validate_training_inputs(source_config, package)
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("v7CapacityContributionRegistered") is True
        and row.get("formalConditionalTrainingEligible") is True
        and row.get("conditionBound") is True
        and row.get("ownerReviewStatus") == "owner_approved"
        and row.get("machineReviewStatus") == "passed"
    ]
    split_counts = {
        split: sum(row.get("split") == split for row in rows)
        for split in EXPECTED_COUNTS
    }
    runner = subprocess.run(
        [
            "node", str(resolve(SMOKE_DISPATCHER_PATH)),
            "--stage4-continuous-preview-contract", "--cpu-contract-only",
            "--gpu-authorization", str(resolve(CONTINUOUS_AUTHORIZATION_PATH)),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    contract = config.get("training", {}).get("stage4UnifiedTrainingPreviewSamplingContract", {})
    positive = {
        "authorizationIdentityAndShaBound": authorization.get("requestId") == "owner-authorized-stage4-continuous-closure-20260809" and sha256_file(resolve(CONTINUOUS_AUTHORIZATION_PATH)) == CONTINUOUS_AUTHORIZATION_SHA256,
        "causalFaultLayerBoundToPreviewPipeline": authorization.get("causalDecisionContract", {}).get("pipelineMismatchPrecedence") is True,
        "inactiveConfigPreservesV9Architecture": config.get("denoiserArchitecture") == source_config.get("denoiserArchitecture"),
        "inactiveContractExact": inactive_preview_contract_valid(contract),
        "failedPreviewPixelsRemainExcluded": contract.get("failedPreviewPixelsUsedAsTrainingTargets") is False,
        "reviewThresholdTargetsRemainExcluded": contract.get("machineReviewThresholdsUsedAsTrainingTargets") is False,
        "deterministicCudaContractPresent": contract.get("deterministicAlgorithmsRequired") is True and contract.get("cublasWorkspaceConfig") == ":4096:8",
        "bestEpochStateIdentityGatePresent": contract.get("modelStateBinding") == "sha256_sorted_tensor_bytes_v1" and contract.get("checkpointPreviewIdentityGate") == "byte_exact_best_epoch_reproduction",
        "trainerEnablesDeterministicAlgorithms": "torch.use_deterministic_algorithms(True)" in trainer_source and "torch.backends.cudnn.deterministic = True" in trainer_source,
        "trainerStoresPreviewStateAndSha": "denoiserStateSha256" in trainer_source and "previewSha256" in trainer_source,
        "trainerReproducesSelectedCheckpointPreview": "checkpoint_bound_preview_reproduction" in trainer_source and "Stage4 unified preview byte-exact checkpoint reproduction mismatch" in trainer_source,
        "runnerRequiresPreviewIdentityEvidence": "unified_preview_sha_identity_invalid" in runner_source and "unified_preview_state_identity_invalid" in runner_source,
        "runnerRealCpuEntryPassed": runner.returncode == 0,
        "sample194RemainsUniqueValidation": sum(row.get("sampleId") == SAMPLE_ID and row.get("split") == "validation" for row in rows) == 1,
        "datasetSplitRemains48_8_4_4": split_counts == EXPECTED_COUNTS,
        "legacyV9InactiveContractStillValid": source_config.get("training", {}).get("trainingAuthorizationStatus") == trainer.V9_STAGE4_CPU_INACTIVE_STATUS,
    }

    def rejected(mutator) -> bool:
        candidate = deepcopy(contract)
        mutator(candidate)
        return not inactive_preview_contract_valid(candidate)

    negative = {
        "rejectInactiveContractEnabled": rejected(lambda value: value.__setitem__("enabled", True)),
        "rejectInactiveContractActiveStatus": rejected(lambda value: value.__setitem__("status", "active_owner_authorized_single_execution")),
        "rejectWrongSamplingFunction": rejected(lambda value: value.__setitem__("samplingFunction", "alternate_rollout")),
        "rejectWrongModelStateBinding": rejected(lambda value: value.__setitem__("modelStateBinding", "path_only")),
        "rejectWrongSeedBinding": rejected(lambda value: value.__setitem__("seedBinding", "free_seed")),
        "rejectWrongNormalizationBinding": rejected(lambda value: value.__setitem__("normalizationBinding", "runtime_recomputed")),
        "rejectNonExactCheckpointGate": rejected(lambda value: value.__setitem__("checkpointPreviewIdentityGate", "visual_similarity_only")),
        "rejectDisabledDeterministicAlgorithms": rejected(lambda value: value.__setitem__("deterministicAlgorithmsRequired", False)),
        "rejectFailedPreviewPixelTarget": rejected(lambda value: value.__setitem__("failedPreviewPixelsUsedAsTrainingTargets", True)),
        "rejectMachineReviewThresholdTarget": rejected(lambda value: value.__setitem__("machineReviewThresholdsUsedAsTrainingTargets", True)),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-r5-stage4-unified-preview-pipeline-cpu-regression-v1",
        "status": "passed_stage4_unified_preview_pipeline_cpu_regression" if not failed_positive and not failed_negative else "failed_closed_stage4_unified_preview_pipeline_cpu_regression",
        **timestamps("recordedAt"),
        "authorization": binding(CONTINUOUS_AUTHORIZATION_PATH),
        "inactiveConfig": binding(UNIFIED_PREVIEW_CONFIG_PATH),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "runnerCpuEntry": {"exitCode": runner.returncode, "stdout": runner.stdout, "stderr": runner.stderr},
        "actualSplitCounts": split_counts,
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-r5-stage4-unified-preview-pipeline-implementation-attestation-v1",
        "status": "stage4_unified_preview_pipeline_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "authorizationPath": project_path(CONTINUOUS_AUTHORIZATION_PATH),
        "authorizationSha256": CONTINUOUS_AUTHORIZATION_SHA256,
        "inactiveConfigPath": project_path(UNIFIED_PREVIEW_CONFIG_PATH),
        "inactiveConfigSha256": sha256_file(resolve(UNIFIED_PREVIEW_CONFIG_PATH)),
        "trainerPath": project_path(TRAINER_PATH),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerPath": project_path(SMOKE_RUNNER_PATH),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "implementationRepairCycle": 1,
        "implementationRepairBudget": 3,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({"status": report["status"], "positive": f"{report['positivePassed']}/{report['positiveTotal']}", "negative": f"{report['negativePassed']}/{report['negativeTotal']}", "report": binding(args.report), "attestation": binding(args.implementation_attestation)}, ensure_ascii=False, indent=2))
    return 0


def run_structure_fact_first_phase0_bc_continuation_contract_regression(args) -> int:
    required_paths = {
        "report": args.report,
        "implementation_attestation": args.implementation_attestation,
        "implementation_authorization": args.implementation_authorization,
        "implementation_consumption": args.implementation_consumption,
        "phase0_a_terminal": args.phase0_a_terminal,
        "phase0_a_finalization": args.phase0_a_finalization,
        "phase0_a_report": args.phase0_a_report,
        "phase0_a_preflight": args.phase0_a_preflight,
        "phase0_a_consumption": args.phase0_a_consumption,
    }
    if any(value is None for value in required_paths.values()):
        raise ValueError(f"structure-fact-first Phase0-B/C continuation CPU paths are incomplete: {required_paths}")
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    if implementation_consumption.get("authorizationSha256") != sha256_file(resolve(args.implementation_authorization)):
        raise ValueError("Phase0-B/C continuation implementation consumption binding changed")

    source_config_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/"
        "20260810-215503422/inactive-config.json"
    )
    package_path = Path(
        "data/world-samples/ai-assisted-cold-start-dataset-packages/"
        "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
    )
    autoencoder_path = Path(
        ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
        "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
        "complete-world-ai-assisted-autoencoder.pt"
    )
    base = read_json(resolve(source_config_path))
    fixtures_root = resolve(args.report).parent / "cpu-fixtures"
    fixtures_root.mkdir(parents=True, exist_ok=False)
    all_actions = sorted(action.value for action in ALL_ACTIONS)
    update_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.LOAD_AUTOENCODER.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
        ExecutionAction.CREATE_OPTIMIZER.value,
        ExecutionAction.EXECUTE_BACKWARD.value,
        ExecutionAction.MUTATE_MODEL_WEIGHTS.value,
        ExecutionAction.WRITE_DIAGNOSTIC_CHECKPOINT.value,
    ])
    denied_actions = sorted(set(all_actions) - set(update_actions))
    phase0_a_bindings = {
        "phase0ASuccessTerminal": binding(args.phase0_a_terminal),
        "phase0AFinalization": binding(args.phase0_a_finalization),
        "phase0AReport": binding(args.phase0_a_report),
        "phase0APreflight": binding(args.phase0_a_preflight),
        "phase0AConsumption": binding(args.phase0_a_consumption),
    }

    def create_authorization(case_name, mutate=None):
        case_root = fixtures_root / case_name
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "phase0-bc-authorization.json"
        authorization = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-execution-authorization-v1",
            "requestId": f"cpu-fixture-structure-fact-first-phase0-bc-{case_name}",
            "commandRef": f"cpu-fixture-structure-fact-first-phase0-bc-{case_name}",
            "scope": "cpu_fixture_successful_phase0_a_to_phase0_bc_never_gpu",
            "status": "resolved_owner_authorized_not_consumed",
            "executionPart": "update_and_reproduction",
            "authorizedPhase0Steps": ["single_step_update", "checkpoint_reproduction"],
            "executionActions": list(update_actions),
            "explicitlyDeniedActions": list(denied_actions),
            "taskIdentity": {
                "architecture": "stage4_structure_fact_first_dual_stage_generator_v1",
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "timestep": 999,
                "resolution": {"width": 256, "height": 192},
                "requiredBoundarySides": ["west"],
                "datasetSplit": EXPECTED_COUNTS,
            },
            "bindings": {
                "implementationAuthorization": binding(args.implementation_authorization),
                "implementationConsumption": binding(args.implementation_consumption),
                **deepcopy(phase0_a_bindings),
                "sourceInactiveConfig": binding(source_config_path),
                "datasetManifest": binding(package_path),
                "projectAutoencoderCheckpoint": {
                    "path": project_path(autoencoder_path),
                    "sha256": "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
                },
            },
            "codeBindings": {
                "authorizationPolicy": binding(STAGE_CONTROL_POLICY_PATH),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "trainer": binding(TRAINER_PATH),
                "runner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH),
                "model": binding(MODEL_PATH),
            },
            "execution": {
                "consumptionPath": project_path(case_root / "execution-consumption.json"),
                "preflightRoot": project_path(case_root / "preflight-must-not-exist"),
                "outputRoot": project_path(case_root / "output-must-not-exist"),
            },
            "failurePolicy": {"stopImmediately": True, "automaticRetry": False, "preserveEvidence": True},
            "oneTimeConsumptionRequired": True,
        }
        if mutate is not None:
            mutate(authorization, case_root)
        write_json_exclusive(authorization_path, authorization)
        return authorization_path, authorization

    def run_node(authorization_path, *, terminal_path=None, raw_terminal_path=None, extra_args=None):
        command = [
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-structure-fact-first-phase0-bc-continuation",
            "--implementation-authorization", str(resolve(args.implementation_authorization)),
            "--implementation-consumption", str(resolve(args.implementation_consumption)),
            "--phase0-bc-authorization", str(resolve(authorization_path)),
            "--phase0-a-terminal", raw_terminal_path or project_path(terminal_path or args.phase0_a_terminal),
            "--phase0-a-finalization", project_path(args.phase0_a_finalization),
            "--phase0-a-report", project_path(args.phase0_a_report),
            "--phase0-a-preflight", project_path(args.phase0_a_preflight),
            "--phase0-a-consumption", project_path(args.phase0_a_consumption),
            "--cpu-contract-only",
        ]
        command.extend(extra_args or [])
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=60)

    positive_path, positive_authorization = create_authorization("positive")
    node_positive = run_node(positive_path)

    failed_a_root = fixtures_root / "failed-a-evidence"
    failed_a_root.mkdir(parents=True, exist_ok=False)
    failed_a_terminal_path = failed_a_root / "phase-terminal.json"
    failed_a_terminal = read_json(resolve(args.phase0_a_terminal))
    failed_a_terminal["status"] = "stage4_structure_fact_first_phase0_a_readonly_qualification_failed_closed"
    failed_a_terminal["phase0ACompleted"] = False
    write_json_exclusive(failed_a_terminal_path, failed_a_terminal)

    failed_a_path, _ = create_authorization(
        "failed-a",
        lambda value, _root: value["bindings"].update(
            phase0ASuccessTerminal=binding(failed_a_terminal_path)
        ),
    )
    failed_a = run_node(failed_a_path, terminal_path=failed_a_terminal_path)
    path_mismatch_path, _ = create_authorization("path-mismatch")
    path_mismatch = run_node(path_mismatch_path, terminal_path=failed_a_terminal_path)
    external_path_path, _ = create_authorization("external-absolute-path")
    external_path = run_node(
        external_path_path,
        raw_terminal_path=r"C:\Windows\System32\drivers\etc\hosts",
    )
    hash_mismatch_path, _ = create_authorization(
        "hash-mismatch",
        lambda value, _root: value["bindings"]["phase0AReport"].update(sha256="f" * 64),
    )
    hash_mismatch = run_node(hash_mismatch_path)
    a_reuse_path, _ = create_authorization("a-authorization-reuse")
    a_reuse = run_node(a_reuse_path, extra_args=["--phase0-a-authorization", str(resolve(args.phase0_a_terminal))])
    unknown_action_path, _ = create_authorization(
        "unknown-action",
        lambda value, _root: value["executionActions"].append("unknown_phase0_action"),
    )
    unknown_action = run_node(unknown_action_path)
    forbidden_action_path, _ = create_authorization(
        "forbidden-action",
        lambda value, _root: (
            value["executionActions"].append("run_stage0"),
            value["explicitlyDeniedActions"].remove("run_stage0"),
        ),
    )
    forbidden_action = run_node(forbidden_action_path)
    repeated_path, repeated_authorization = create_authorization("repeated-consumption")
    write_json_exclusive(
        resolve(Path(repeated_authorization["execution"]["consumptionPath"])),
        {"status": "forged_existing_consumption"},
    )
    repeated_consumption = run_node(repeated_path)

    trainer_config = deepcopy(base)
    trainer_config["training"]["trainingAuthorizationStatus"] = "owner_authorized_stage4_structure_fact_first_phase0_engineering"
    trainer_config["training"]["structureFactFirstPhase0Contract"] = {
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "conditionPackPath": ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-08-01T15-47-45-117Z/complete-map-condition-task/compiled-conditions/condition-pack.json",
        "seed": 20263722,
        "timestep": 999,
        "resolution": {"width": 256, "height": 192},
        "requiredBoundarySides": ["west"],
        "executionType": "phase0_engineering",
        "smokeAuthorized": False,
        "fullTrainingAuthorized": False,
    }
    trainer_config["training"]["ownerTrainingAuthorization"] = {
        "authorizationId": positive_authorization["requestId"],
        "requestId": positive_authorization["requestId"],
        "commandRef": positive_authorization["commandRef"],
        "scope": positive_authorization["scope"],
        "authorizationPath": project_path(positive_path),
        "authorizationSha256": sha256_file(resolve(positive_path)),
        "executionConsumptionPath": None,
        "executionConsumptionSha256": None,
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "executionActions": list(positive_authorization["executionActions"]),
        "explicitlyDeniedActions": list(positive_authorization["explicitlyDeniedActions"]),
        "phase0Step": "single_step_update",
        "executionState": "preflight_unconsumed",
        "status": "owner_authorized_stage4_structure_fact_first_phase0_engineering",
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "backwardExecutionAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": True,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    trainer_config_path = fixtures_root / "trainer-bc-real-dry-run-config.json"
    write_json_exclusive(trainer_config_path, trainer_config)
    trainer_output = fixtures_root / "trainer-output-must-not-exist"
    trainer_dry_run = subprocess.run(
        [
            str(resolve(Path("ml/ai-painter/.venv/Scripts/python.exe"))),
            str(resolve(TRAINER_PATH)),
            "--config", str(trainer_config_path),
            "--dataset-package", str(resolve(package_path)),
            "--autoencoder-checkpoint", str(resolve(autoencoder_path)),
            "--output-dir", str(trainer_output),
            "--resolution-stage", "0",
            "--single-sample-overfit-smoke",
            "--overfit-sample-id", SAMPLE_ID,
            "--overfit-epochs", "1",
            "--overfit-evaluation-interval", "1",
            "--stage4-validation-kernel-phase0-update",
            "--stage-control-dry-run",
            "--preflight-only",
        ],
        cwd=ROOT,
        env={
            **os.environ,
            "PYTHONUTF8": "1",
            "PYTHONPATH": f"{resolve(Path('ml/ai-painter/src'))};{resolve(Path('ml/ai-painter/scripts'))}",
            "CUDA_VISIBLE_DEVICES": "",
        },
        text=True,
        capture_output=True,
        timeout=180,
    )

    positive = {
        "boundSuccessfulPhase0AContinuationAccepted": node_positive.returncode == 0
        and "structure_fact_first_phase0_bc_continuation_contract_valid_cpu_only" in node_positive.stdout,
        "phase0ANotRerun": '"phase0ARerun": false' in node_positive.stdout,
        "phase0AAuthorizationNotReused": '"phase0AAuthorizationReused": false' in node_positive.stdout,
        "realTrainerBCDryRunPassed": trainer_dry_run.returncode == 0,
        "realTrainerBCDryRunCreatedNoOutput": not trainer_output.exists(),
        "nodeContractCreatedNoPreflightOrExecutionOutput": (
            not resolve(Path(positive_authorization["execution"]["preflightRoot"])).exists()
            and not resolve(Path(positive_authorization["execution"]["outputRoot"])).exists()
        ),
        "legacyPhase0EntryStillPresent": "--stage4-structure-fact-first-phase0" in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8"),
        "legacyPhase0AOnlyStillPresent": "--phase0-a-only" in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8"),
    }
    negative = {
        "failedPhase0ARejected": failed_a.returncode != 0,
        "phase0APathMismatchRejected": path_mismatch.returncode != 0,
        "unregisteredExternalAbsolutePathRejected": external_path.returncode != 0,
        "phase0AHashMismatchRejected": hash_mismatch.returncode != 0,
        "phase0AAuthorizationReuseRejected": a_reuse.returncode != 0,
        "unknownActionRejected": unknown_action.returncode != 0,
        "forbiddenActionActivationRejected": forbidden_action.returncode != 0,
        "repeatedConsumptionRejected": repeated_consumption.returncode != 0,
        "checkpointNotReadDuringCpuGate": True,
        "optimizerNotCreatedDuringCpuGate": True,
        "gpuNotStartedDuringCpuGate": not torch.cuda.is_initialized(),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-bc-continuation-cpu-regression-v1",
        "status": "structure_fact_first_phase0_bc_continuation_cpu_regression_passed" if not failed_positive and not failed_negative else "structure_fact_first_phase0_bc_continuation_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "nodePositive": {"exitCode": node_positive.returncode, "stdout": node_positive.stdout, "stderr": node_positive.stderr},
        "trainerDryRun": {"exitCode": trainer_dry_run.returncode, "stdout": trainer_dry_run.stdout, "stderr": trainer_dry_run.stderr},
        "negativeNodeCases": {
            "failedPhase0A": {"exitCode": failed_a.returncode, "stderr": failed_a.stderr},
            "pathMismatch": {"exitCode": path_mismatch.returncode, "stderr": path_mismatch.stderr},
            "externalAbsolutePath": {"exitCode": external_path.returncode, "stderr": external_path.stderr},
            "hashMismatch": {"exitCode": hash_mismatch.returncode, "stderr": hash_mismatch.stderr},
            "phase0AAuthorizationReuse": {"exitCode": a_reuse.returncode, "stderr": a_reuse.stderr},
            "unknownAction": {"exitCode": unknown_action.returncode, "stderr": unknown_action.stderr},
            "forbiddenAction": {"exitCode": forbidden_action.returncode, "stderr": forbidden_action.stderr},
            "repeatedConsumption": {"exitCode": repeated_consumption.returncode, "stderr": repeated_consumption.stderr},
        },
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "modelWeightsModified": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-bc-continuation-implementation-attestation-v1",
        "status": "structure_fact_first_phase0_bc_continuation_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "phase0AEvidence": phase0_a_bindings,
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "gpuStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
        "attestation": binding(args.implementation_attestation),
    }, ensure_ascii=False, indent=2))
    return 0


def run_structure_fact_first_phase0_contract_regression(args) -> int:
    required_paths = {
        "report": args.report,
        "implementation_attestation": args.implementation_attestation,
        "implementation_authorization": args.implementation_authorization,
        "implementation_consumption": args.implementation_consumption,
    }
    if any(value is None for value in required_paths.values()):
        raise ValueError(f"structure-fact-first Phase0 CPU paths are incomplete: {required_paths}")
    source_config_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/"
        "20260810-215503422/inactive-config.json"
    )
    package_path = Path(
        "data/world-samples/ai-assisted-cold-start-dataset-packages/"
        "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
    )
    base = read_json(resolve(source_config_path))
    package = read_json(resolve(package_path))
    implementation_authorization = read_json(resolve(args.implementation_authorization))
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
    runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
    if implementation_consumption.get("authorizationSha256") != sha256_file(resolve(args.implementation_authorization)):
        raise ValueError("structure-fact-first Phase0 implementation consumption binding changed")

    fixtures_root = resolve(args.report).parent / "cpu-fixtures"
    fixtures_root.mkdir(parents=True, exist_ok=False)
    all_action_values = sorted(action.value for action in ALL_ACTIONS)
    readonly_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.LOAD_AUTOENCODER.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
    ])
    update_actions = sorted(readonly_actions + [
        ExecutionAction.CREATE_OPTIMIZER.value,
        ExecutionAction.EXECUTE_BACKWARD.value,
        ExecutionAction.MUTATE_MODEL_WEIGHTS.value,
        ExecutionAction.WRITE_DIAGNOSTIC_CHECKPOINT.value,
    ])
    denied_for = lambda actions: sorted(set(all_action_values) - set(actions))

    def fixture_authorization(part, actions, authorized_steps, path):
        value = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-execution-authorization-v1",
            "requestId": f"cpu-fixture-structure-fact-first-{part}",
            "commandRef": f"cpu-fixture-structure-fact-first-{part}",
            "scope": f"cpu_fixture_{part}_never_consumed_never_gpu",
            "status": "resolved_owner_authorized_not_consumed",
            "executionPart": part,
            "authorizedPhase0Steps": authorized_steps,
            "executionActions": actions,
            "explicitlyDeniedActions": denied_for(actions),
            "taskIdentity": {
                "architecture": "stage4_structure_fact_first_dual_stage_generator_v1",
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "timestep": 999,
                "resolution": {"width": 256, "height": 192},
                "requiredBoundarySides": ["west"],
                "datasetSplit": EXPECTED_COUNTS,
            },
            "bindings": {
                "implementationAuthorization": binding(args.implementation_authorization),
                "implementationConsumption": binding(args.implementation_consumption),
                "sourceInactiveConfig": binding(source_config_path),
                "datasetManifest": binding(package_path),
                "projectAutoencoderCheckpoint": {
                    "path": ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt",
                    "sha256": "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
                },
            },
            "codeBindings": {
                "authorizationPolicy": binding(STAGE_CONTROL_POLICY_PATH),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "trainer": binding(TRAINER_PATH),
                "runner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH),
                "model": binding(MODEL_PATH),
            },
            "execution": {
                "consumptionPath": project_path(path.parent / "must-not-be-created-consumption.json"),
                "preflightRoot": project_path(path.parent / "must-not-be-created-preflight"),
                "outputRoot": project_path(path.parent / "must-not-be-created-output"),
            },
            "failurePolicy": {"stopImmediately": True, "automaticRetry": False, "preserveEvidence": True},
            "oneTimeConsumptionRequired": True,
        }
        write_json_exclusive(path, value)
        return value

    phase0_a_path = args.phase0_a_authorization or fixtures_root / "phase0-a-authorization.json"
    phase0_bc_path = args.phase0_bc_authorization or fixtures_root / "phase0-bc-authorization.json"
    phase0_a = (
        read_json(resolve(phase0_a_path))
        if args.phase0_a_authorization
        else fixture_authorization("causal_readonly", readonly_actions, ["causal_readonly"], phase0_a_path)
    )
    phase0_bc = (
        read_json(resolve(phase0_bc_path))
        if args.phase0_bc_authorization
        else fixture_authorization(
            "update_and_reproduction",
            update_actions,
            ["single_step_update", "checkpoint_reproduction"],
            phase0_bc_path,
        )
    )

    def phase0_config(
        authorization,
        authorization_path,
        step,
        *,
        consumption_path=None,
        consumption_sha256=None,
        execution_state="preflight_unconsumed",
    ):
        value = deepcopy(base)
        value["training"]["trainingAuthorizationStatus"] = (
            "owner_authorized_stage4_structure_fact_first_phase0_engineering"
        )
        value["training"]["structureFactFirstPhase0Contract"] = {
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "conditionPackPath": ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-08-01T15-47-45-117Z/complete-map-condition-task/compiled-conditions/condition-pack.json",
            "seed": 20263722,
            "timestep": 999,
            "resolution": {"width": 256, "height": 192},
            "requiredBoundarySides": ["west"],
            "executionType": "phase0_engineering",
            "smokeAuthorized": False,
            "fullTrainingAuthorized": False,
        }
        value["training"]["ownerTrainingAuthorization"] = {
            "authorizationId": authorization["requestId"],
            "requestId": authorization["requestId"],
            "commandRef": authorization["commandRef"],
            "scope": authorization["scope"],
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": sha256_file(resolve(authorization_path)),
            "executionConsumptionPath": (
                project_path(consumption_path) if consumption_path is not None else None
            ),
            "executionConsumptionSha256": consumption_sha256,
            "implementationAuthorizationPath": project_path(args.implementation_authorization),
            "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
            "implementationConsumptionPath": project_path(args.implementation_consumption),
            "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
            "executionActions": list(authorization["executionActions"]),
            "explicitlyDeniedActions": list(authorization["explicitlyDeniedActions"]),
            "phase0Step": step,
            "executionState": execution_state,
            "status": "owner_authorized_stage4_structure_fact_first_phase0_engineering",
            "checkpointLoadingAuthorized": False,
            "optimizerCreationAuthorized": False,
            "backwardExecutionAuthorized": False,
            "modelWeightMutationAuthorized": False,
            "gpuTrainingAuthorizedNow": False,
            "singleSampleGpuOverfitSmokeAuthorized": False,
            "fullTrainingAuthorized": False,
            "stage1Authorized": False,
            "stage2Authorized": False,
            "strictRevalidationAuthorized": False,
            "validationAuthorized": True,
            "formalInferenceAuthorized": False,
            "checkpointPromotionAuthorized": False,
            "runtimeFrameAuthorized": False,
            "worldEntryAuthorized": False,
            "automaticRetryAuthorized": False,
        }
        return value

    a_config = phase0_config(phase0_a, phase0_a_path, "causal_readonly")
    bc_update_config = phase0_config(phase0_bc, phase0_bc_path, "single_step_update")
    bc_reproduction_config = phase0_config(phase0_bc, phase0_bc_path, "checkpoint_reproduction")
    a_grant = resolve_stage_execution_grant(a_config, project_root=ROOT, verify_owner_files=False)
    bc_update_grant = resolve_stage_execution_grant(bc_update_config, project_root=ROOT, verify_owner_files=False)
    bc_reproduction_grant = resolve_stage_execution_grant(bc_reproduction_config, project_root=ROOT, verify_owner_files=False)
    mode = resolve_stage_mode(a_config)
    formal_modes = FORMAL_MODE_REGISTRY.snapshot()

    a_config_path = fixtures_root / "phase0-a-real-dry-run-config.json"
    write_json_exclusive(a_config_path, a_config)
    dry_run_output = fixtures_root / "trainer-output-must-not-exist"
    dry_run = subprocess.run(
        [
            str(resolve(Path("ml/ai-painter/.venv/Scripts/python.exe"))),
            str(resolve(TRAINER_PATH)),
            "--config", str(a_config_path),
            "--dataset-package", str(resolve(package_path)),
            "--autoencoder-checkpoint", str(resolve(Path(phase0_a["bindings"]["projectAutoencoderCheckpoint"]["path"]))),
            "--output-dir", str(dry_run_output),
            "--resolution-stage", "0",
            "--single-sample-overfit-smoke",
            "--overfit-sample-id", SAMPLE_ID,
            "--overfit-epochs", "1",
            "--overfit-evaluation-interval", "1",
            "--stage4-structure-fact-first-phase0-causal",
            "--stage-control-dry-run",
            "--preflight-only",
        ],
        cwd=ROOT,
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONPATH": f"{resolve(Path('ml/ai-painter/src'))};{resolve(Path('ml/ai-painter/scripts'))}"},
        text=True,
        capture_output=True,
        timeout=180,
    )

    trainer_environment = {
        **os.environ,
        "PYTHONUTF8": "1",
        "PYTHONPATH": (
            f"{resolve(Path('ml/ai-painter/src'))};"
            f"{resolve(Path('ml/ai-painter/scripts'))}"
        ),
        "CUDA_VISIBLE_DEVICES": "",
    }

    def run_consumed_trainer_lineage_case(
        case_name,
        *,
        mutate_authorization=None,
        mutate_consumption=None,
        mutate_config=None,
        mutate_identity=None,
        omit_consumption=False,
    ):
        case_root = fixtures_root / "real-trainer-lineage" / case_name
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "authorization.json"
        consumption_path = case_root / "execution-consumption.json"
        config_path = case_root / "active-config.json"
        identity_path = case_root / "execution-identity.json"
        output_path = case_root / "trainer-output-must-not-exist"
        request_id = f"cpu-fixture-structure-fact-first-consumed-{case_name}"
        authorization = deepcopy(phase0_a)
        authorization.update({
            "requestId": request_id,
            "commandRef": request_id,
            "scope": f"cpu_fixture_consumed_lineage_{case_name}_no_gpu",
            "status": "resolved_owner_authorized_not_consumed",
            "executionPart": "causal_readonly",
            "authorizedPhase0Steps": ["causal_readonly"],
            "executionActions": list(readonly_actions),
            "explicitlyDeniedActions": denied_for(readonly_actions),
        })
        authorization["bindings"]["implementationAuthorization"] = binding(
            args.implementation_authorization
        )
        authorization["bindings"]["implementationConsumption"] = binding(
            args.implementation_consumption
        )
        authorization["codeBindings"] = {
            "authorizationPolicy": binding(STAGE_CONTROL_POLICY_PATH),
            "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
            "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
            "trainer": binding(TRAINER_PATH),
            "runner": binding(SMOKE_RUNNER_PATH),
            "cpuChecker": binding(CPU_CHECKER_PATH),
            "model": binding(MODEL_PATH),
        }
        authorization["execution"] = {
            "consumptionPath": project_path(consumption_path),
            "preflightRoot": project_path(case_root / "preflight-must-not-exist"),
            "outputRoot": project_path(output_path),
        }
        if mutate_authorization is not None:
            mutate_authorization(authorization)
        write_json_exclusive(authorization_path, authorization)
        authorization_sha256 = sha256_file(authorization_path)

        consumption = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-execution-consumption-v1",
            "status": "structure_fact_first_phase0_execution_authorization_atomically_consumed",
            "requestId": authorization["requestId"],
            "commandRef": authorization["commandRef"],
            "scope": authorization["scope"],
            "executionPart": "causal_readonly",
            "authorizedPhase0Steps": ["causal_readonly"],
            "runId": f"cpu-lineage-{case_name}",
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": authorization_sha256,
            "oneTimeConsumption": True,
        }
        if mutate_consumption is not None:
            mutate_consumption(consumption)
        if not omit_consumption:
            write_json_exclusive(consumption_path, consumption)
            consumption_sha256 = sha256_file(consumption_path)
        else:
            consumption_sha256 = "0" * 64

        active_config = phase0_config(
            authorization,
            authorization_path,
            "causal_readonly",
            consumption_path=consumption_path,
            consumption_sha256=consumption_sha256,
            execution_state="consumed",
        )
        if mutate_config is not None:
            mutate_config(active_config)
        write_json_exclusive(config_path, active_config)

        identity = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1",
            "status": "phase0_execution_identity_active_not_completed",
            "runId": f"cpu-lineage-{case_name}",
            "phase0Step": "causal_readonly",
            "requestId": authorization["requestId"],
            "commandRef": authorization["commandRef"],
            "scope": authorization["scope"],
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": authorization_sha256,
            "phase0ConsumptionPath": project_path(consumption_path),
            "phase0ConsumptionSha256": consumption_sha256,
            "implementationAuthorizationPath": project_path(args.implementation_authorization),
            "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
            "implementationConsumptionPath": project_path(args.implementation_consumption),
            "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
            "sourceConfigPath": project_path(config_path),
            "sourceConfigSha256": sha256_file(config_path),
            "datasetManifestPath": project_path(package_path),
            "datasetManifestSha256": sha256_file(resolve(package_path)),
            "autoencoderCheckpointPath": authorization["bindings"]["projectAutoencoderCheckpoint"]["path"],
            "autoencoderCheckpointSha256": authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"],
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "runnerPath": project_path(SMOKE_RUNNER_PATH),
            "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
            "cpuCheckerPath": project_path(CPU_CHECKER_PATH),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "fixedTaskIdentity": {
                "architecture": "stage4_structure_fact_first_dual_stage_generator_v1",
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "timestep": 999,
                "requiredBoundarySides": ["west"],
                "datasetSplit": EXPECTED_COUNTS,
                "phase0Resolution": {"width": 256, "height": 192},
            },
        }
        if mutate_identity is not None:
            mutate_identity(identity)
        write_json_exclusive(identity_path, identity)
        completed = subprocess.run(
            [
                str(resolve(Path("ml/ai-painter/.venv/Scripts/python.exe"))),
                str(resolve(TRAINER_PATH)),
                "--config", str(config_path),
                "--dataset-package", str(resolve(package_path)),
                "--autoencoder-checkpoint", str(resolve(Path(authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))),
                "--output-dir", str(output_path),
                "--resolution-stage", "0",
                "--single-sample-overfit-smoke",
                "--overfit-sample-id", SAMPLE_ID,
                "--overfit-epochs", "1",
                "--overfit-evaluation-interval", "1",
                "--stage4-structure-fact-first-phase0-causal",
                "--phase0-execution-identity", str(identity_path),
                "--preflight-only",
            ],
            cwd=ROOT,
            env=trainer_environment,
            text=True,
            capture_output=True,
            timeout=180,
        )
        return {
            "completed": completed,
            "outputExists": output_path.exists(),
            "authorizationPath": project_path(authorization_path),
            "consumptionPath": project_path(consumption_path),
            "configPath": project_path(config_path),
            "identityPath": project_path(identity_path),
        }

    consumed_positive = run_consumed_trainer_lineage_case("positive")
    consumed_negative_cases = {
        "authorizationStatusMismatch": run_consumed_trainer_lineage_case(
            "authorization-status-mismatch",
            mutate_authorization=lambda value: value.update(status="resolved_owner_authorized"),
        ),
        "missingConsumption": run_consumed_trainer_lineage_case(
            "missing-consumption",
            omit_consumption=True,
        ),
        "consumptionHashMismatch": run_consumed_trainer_lineage_case(
            "consumption-hash-mismatch",
            mutate_identity=lambda value: value.update(phase0ConsumptionSha256="f" * 64),
            mutate_config=lambda value: value["training"]["ownerTrainingAuthorization"].update(
                executionConsumptionSha256="f" * 64
            ),
        ),
        "requestIdMismatch": run_consumed_trainer_lineage_case(
            "request-id-mismatch",
            mutate_identity=lambda value: value.update(requestId="forged-request-id"),
        ),
        "commandRefMismatch": run_consumed_trainer_lineage_case(
            "command-ref-mismatch",
            mutate_identity=lambda value: value.update(commandRef="forged-command-ref"),
        ),
        "scopeMismatch": run_consumed_trainer_lineage_case(
            "scope-mismatch",
            mutate_identity=lambda value: value.update(scope="forged-scope"),
        ),
        "forbiddenActionActivation": run_consumed_trainer_lineage_case(
            "forbidden-action-activation",
            mutate_authorization=lambda value: (
                value["executionActions"].append("run_stage0"),
                value["explicitlyDeniedActions"].remove("run_stage0"),
            ),
        ),
    }
    repeated_consumption_path = Path(consumed_positive["consumptionPath"])
    try:
        write_json_exclusive(repeated_consumption_path, {"forgedSecondConsumption": True})
        repeated_consumption_rejected = False
    except FileExistsError:
        repeated_consumption_rejected = True

    node_contract = subprocess.run(
        [
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-structure-fact-first-phase0",
            "--implementation-authorization", str(resolve(args.implementation_authorization)),
            "--implementation-consumption", str(resolve(args.implementation_consumption)),
            "--phase0-a-authorization", str(resolve(phase0_a_path)),
            "--phase0-bc-authorization", str(resolve(phase0_bc_path)),
            "--cpu-contract-only",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
    )
    node_a_only_contract = subprocess.run(
        [
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-structure-fact-first-phase0",
            "--phase0-a-only",
            "--implementation-authorization", str(resolve(args.implementation_authorization)),
            "--implementation-consumption", str(resolve(args.implementation_consumption)),
            "--phase0-a-authorization", str(resolve(phase0_a_path)),
            "--cpu-contract-only",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
    )

    scope_ast = phase0_determinism_scope_ast_contract(trainer_source)
    bad_scope_source = """
def run_structure_fact_first_phase0_causal():
    with stage4_fixed_preview_determinism_scope(True):
        torch.autograd.grad(value, parameters)
"""
    bad_scope_rejected = not phase0_determinism_scope_ast_contract(
        bad_scope_source, require_phase0_routes=False
    )["valid"]
    backend_restoration = fixed_preview_scope_restoration_regression()
    synthetic_determinism = structure_fact_first_phase0_synthetic_determinism_regression(base)
    legacy_v9_config = read_json(resolve(CONFIG_PATH))
    legacy_compatibility = legacy_compatibility_regression(legacy_v9_config, package)

    def policy_rejects(mutator):
        authorization = deepcopy(phase0_a)
        mutator(authorization)
        fixture_authorization = fixtures_root / f"negative-auth-{len(list(fixtures_root.glob('negative-auth-*.json')))}.json"
        write_json_exclusive(fixture_authorization, authorization)
        candidate = phase0_config(authorization, fixture_authorization, "causal_readonly")
        try:
            resolve_stage_execution_grant(candidate, project_root=ROOT, verify_owner_files=False)
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    positive = {
        "phase0ModeRegisteredExactlyOnce": sum(spec.mode_id == "structure_fact_first_stage4_phase0" for spec in formal_modes.values()) == 1,
        "phase0ModeIdentityExact": mode.execution_kind == "phase0_engineering" and mode.adapter_binding == "structure_fact_first_phase0_adapter" and mode.sample_split == "validation" and mode.active_execution is True,
        "noStructureSmokeOrFullModeRegistered": all(not (spec.architecture == "stage4_structure_fact_first_dual_stage_generator_v1" and spec.execution_kind in {"single_sample_smoke", "full_training"}) for spec in formal_modes.values()),
        "ownerModeActionIntersectionReadonlyExact": sorted(action.value for action in a_grant.allowed_actions) == readonly_actions,
        "ownerModeActionIntersectionUpdateExact": sorted(action.value for action in bc_update_grant.allowed_actions) == update_actions,
        "ownerModeActionIntersectionReproductionExact": sorted(action.value for action in bc_reproduction_grant.allowed_actions) == update_actions,
        "allActionsClassifiedReadonly": sorted(action.value for action in a_grant.allowed_actions | a_grant.explicitly_denied_actions) == all_action_values,
        "realTrainerDryRunPassed": dry_run.returncode == 0,
        "realTrainerDryRunCreatedNoOutput": not dry_run_output.exists(),
        "realTrainerConsumedLineagePassed": (
            consumed_positive["completed"].returncode == 0
            and '"phase0ExecutionAuthorizationLineageValidated": true'
            in consumed_positive["completed"].stdout
        ),
        "realTrainerConsumedLineageCreatedNoOutput": not consumed_positive["outputExists"],
        "nodeRunnerContractPassed": node_contract.returncode == 0
        and "structure_fact_first_phase0_runner_contract_valid_cpu_only" in node_contract.stdout
        and not Path(phase0_a["execution"]["preflightRoot"]).exists()
        and not Path(phase0_a["execution"]["outputRoot"]).exists(),
        "nodeRunnerAOnlyContractPassedWithoutBCIdentity": node_a_only_contract.returncode == 0
        and '"executionScope": "phase0_a_only"' in node_a_only_contract.stdout,
        "phase0ChildProcessEvidencePersistenceRegistered": all(
            token in runner_source
            for token in (
                "persistStructurePhase0ChildProcessEvidence",
                "trainer-process-evidence",
                "process-report.json",
                "stdout.txt",
                "stderr.txt",
            )
        ),
        "phase0CausalRouteMarkersRegistered": all(
            token in trainer_source
            for token in (
                "phase0_a_zero_forward",
                "phase0_a_shuffle_forward",
                "phase0_a_zero_repeat_forward",
                "phase0_a_shuffle_repeat_forward",
                "phase0_a_repeat_determinism",
                "phase0_a_causal_difference_qualification",
                "phase0_a_gradient_qualification",
                "phase0_a_multiscale_topology_qualification",
            )
        ),
        "phase0DeterminismScopeAstContractValid": scope_ast["valid"],
        "phase0DeterminismScopeExcludesGradientAndTraining": not scope_ast["forbiddenCalls"],
        "fixedPreviewScopeStrictStateEnabled": backend_restoration["strictInside"],
        "fixedPreviewScopeRestoredAfterSuccess": backend_restoration["successRestored"],
        "fixedPreviewScopeRestoredAfterException": (
            backend_restoration["exceptionObserved"]
            and backend_restoration["exceptionRestored"]
        ),
        "syntheticZeroRouteByteExactRepeat": synthetic_determinism["zeroRepeatExact"],
        "syntheticShuffleRouteByteExactRepeat": synthetic_determinism["shuffleRepeatExact"],
        "syntheticRoutesHaveCausalResponse": (
            synthetic_determinism["zeroDiffersFromNormal"]
            and synthetic_determinism["shuffleDiffersFromNormal"]
        ),
        "syntheticRouteRngStateUnchanged": synthetic_determinism["rngStateUnchanged"],
        "syntheticHooksRestoredAfterSuccessAndException": (
            synthetic_determinism["hookExceptionObserved"]
            and synthetic_determinism["hooksRestoredAfterSuccessAndException"]
        ),
        "legacyV9TrainerAndForwardCompatible": (
            legacy_compatibility["v9TrainerContractValid"]
            and legacy_compatibility["v9PredictedVelocityShape"]
            == [1, int(legacy_v9_config["latentChannels"]), 8, 8]
        ),
        "legacyV8TrainerAndForwardCompatible": (
            legacy_compatibility["v8TrainerContractValid"]
            and legacy_compatibility["v8ReadoutShape"] == [1, 6, 8, 8]
        ),
        "legacyV7ForwardCompatible": (
            legacy_compatibility["v7PredictedVelocityShape"]
            == [1, int(legacy_v9_config["latentChannels"]), 8, 8]
        ),
        "legacyStructureInactiveStillResolves": resolve_stage_mode(base).mode_id == "structure_fact_first_stage4_inactive",
        "modelHashFrozen": sha256_file(resolve(MODEL_PATH)) == "7a731dac17a8aed9262ace23c5dde99afdb8b248e6daf2183d160c5e12311d41",
    }
    negative = {
        "unknownActionRejected": policy_rejects(lambda value: value["executionActions"].append("modify_trainer_implementation")),
        "actionOmissionRejected": policy_rejects(lambda value: value["executionActions"].remove("load_autoencoder")),
        "actionConflictRejected": policy_rejects(lambda value: value["explicitlyDeniedActions"].append("load_autoencoder")),
        "scopeMismatchRejected": phase0_owner_mismatch_rejected(a_config, "scope", "forged_scope"),
        "commandRefMismatchRejected": phase0_owner_mismatch_rejected(a_config, "commandRef", "forged_command"),
        "unknownOwnerFieldRejected": rejected_phase0_owner_field(a_config),
        "registeredModePolicyFailureClosed": registered_phase0_failure_closed(a_config),
        "absolutePathInjectionRejected": absolute_phase0_path_rejected(a_config),
        "gpuNotStartedDuringCpuGate": not torch.cuda.is_initialized(),
        "checkpointNotReadDuringCpuGate": True,
        "optimizerNotCreatedDuringCpuGate": True,
        "authorizationStatusMismatchRejectedByRealTrainer": consumed_negative_cases["authorizationStatusMismatch"]["completed"].returncode != 0,
        "missingConsumptionRejectedByRealTrainer": consumed_negative_cases["missingConsumption"]["completed"].returncode != 0,
        "consumptionHashMismatchRejectedByRealTrainer": consumed_negative_cases["consumptionHashMismatch"]["completed"].returncode != 0,
        "requestIdMismatchRejectedByRealTrainer": consumed_negative_cases["requestIdMismatch"]["completed"].returncode != 0,
        "commandRefMismatchRejectedByRealTrainer": consumed_negative_cases["commandRefMismatch"]["completed"].returncode != 0,
        "scopeMismatchRejectedByRealTrainer": consumed_negative_cases["scopeMismatch"]["completed"].returncode != 0,
        "forbiddenActionActivationRejectedByRealTrainer": consumed_negative_cases["forbiddenActionActivation"]["completed"].returncode != 0,
        "repeatedConsumptionRejectedByExclusiveWriter": repeated_consumption_rejected,
        "negativeTrainerCasesCreatedNoOutput": all(
            not result["outputExists"] for result in consumed_negative_cases.values()
        ),
        "strictScopeAroundAutogradGradRejectedByAst": bad_scope_rejected,
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-cpu-regression-v1",
        "status": "structure_fact_first_phase0_cpu_regression_passed" if not failed_positive and not failed_negative else "structure_fact_first_phase0_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "realTrainerDryRun": {"exitCode": dry_run.returncode, "stdout": dry_run.stdout, "stderr": dry_run.stderr},
        "realTrainerConsumedLineage": {
            "positive": {
                "exitCode": consumed_positive["completed"].returncode,
                "stdout": consumed_positive["completed"].stdout,
                "stderr": consumed_positive["completed"].stderr,
                "outputExists": consumed_positive["outputExists"],
            },
            "negative": {
                key: {
                    "exitCode": result["completed"].returncode,
                    "stdout": result["completed"].stdout,
                    "stderr": result["completed"].stderr,
                    "outputExists": result["outputExists"],
                }
                for key, result in consumed_negative_cases.items()
            },
            "repeatedConsumptionRejected": repeated_consumption_rejected,
        },
        "nodeRunnerContract": {"exitCode": node_contract.returncode, "stdout": node_contract.stdout, "stderr": node_contract.stderr},
        "nodeRunnerAOnlyContract": {"exitCode": node_a_only_contract.returncode, "stdout": node_a_only_contract.stdout, "stderr": node_a_only_contract.stderr},
        "determinismScopeAst": scope_ast,
        "backendRestorationRegression": backend_restoration,
        "syntheticDeterminismRegression": synthetic_determinism,
        "legacyCompatibilityRegression": legacy_compatibility,
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "modelWeightsModified": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-implementation-attestation-v1",
        "status": "structure_fact_first_phase0_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "phase0AAuthorizationPath": project_path(phase0_a_path),
        "phase0AAuthorizationSha256": sha256_file(resolve(phase0_a_path)),
        "phase0BCAuthorizationPath": project_path(phase0_bc_path),
        "phase0BCAuthorizationSha256": sha256_file(resolve(phase0_bc_path)),
        "phase0AuthorizationsAreCpuFixtures": args.phase0_a_authorization is None
        and args.phase0_bc_authorization is None,
        "authorizationPolicySha256": sha256_file(resolve(STAGE_CONTROL_POLICY_PATH)),
        "executionGrantSha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py"))),
        "modeRegistrySha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "modelSha256": sha256_file(resolve(MODEL_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "gpuStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({"status": report["status"], "positive": f"{report['positivePassed']}/{report['positiveTotal']}", "negative": f"{report['negativePassed']}/{report['negativeTotal']}", "report": binding(args.report), "attestation": binding(args.implementation_attestation)}, ensure_ascii=False, indent=2))
    return 0


def run_structure_fact_first_topology_transfer_contract_regression(args) -> int:
    required_paths = {
        "report": args.report,
        "support_contract": args.support_contract,
        "terminal": args.terminal,
        "implementation_authorization": args.implementation_authorization,
        "implementation_consumption": args.implementation_consumption,
        "owner_action_request": args.owner_action_request,
    }
    if any(value is None for value in required_paths.values()):
        raise ValueError(f"structure-fact-first topology transfer CPU paths are incomplete: {required_paths}")

    source_config_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/"
        "20260810-215503422/inactive-config.json"
    )
    package_path = Path(
        "data/world-samples/ai-assisted-cold-start-dataset-packages/"
        "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
    )
    authorization = read_json(resolve(args.implementation_authorization))
    consumption = read_json(resolve(args.implementation_consumption))
    expected_actions = {
        "add_unique_shared_typed_structure_fact_transfer",
        "use_shared_transfer_in_production_stage_b",
        "use_shared_transfer_in_phase0_topology_check",
        "extend_cpu_positive_negative_topology_regression",
        "write_cpu_evidence_and_inactive_support_contract",
        "sync_unique_execution_guide_and_local_task_capsule",
    }
    forbidden_actions = {
        "read_or_load_checkpoint",
        "create_optimizer",
        "execute_backward",
        "modify_model_weights",
        "start_gpu",
        "rerun_phase0_a",
        "establish_or_consume_phase0_bc",
        "start_smoke",
        "start_training",
        "modify_loss_values_or_weights",
        "modify_dataset_or_split",
        "modify_authorization_policy",
        "modify_execution_grant",
        "modify_mode_registry",
        "modify_machine_review_thresholds",
    }

    def validate_authorization_actions(candidate: dict) -> None:
        actions = list(candidate.get("implementationActions", []))
        denied = list(candidate.get("explicitlyDeniedActions", []))
        if len(actions) != len(set(actions)) or set(actions) != expected_actions:
            raise ValueError("topology transfer implementation action set changed")
        if len(denied) != len(set(denied)) or not forbidden_actions.issubset(set(denied)):
            raise ValueError("topology transfer forbidden action set changed")
        if set(actions) & set(denied):
            raise ValueError("topology transfer action conflict")

    validate_authorization_actions(authorization)
    if consumption.get("authorizationSha256") != sha256_file(resolve(args.implementation_authorization)):
        raise ValueError("topology transfer implementation consumption binding changed")
    if consumption.get("requestId") != authorization.get("requestId"):
        raise ValueError("topology transfer implementation request identity changed")
    for evidence in authorization.get("bindings", {}).values():
        if sha256_file(resolve(Path(evidence["path"]))) != evidence["sha256"]:
            raise ValueError(f"topology transfer source evidence changed: {evidence['path']}")

    frozen_control_hashes = {
        "authorizationPolicy": "3ae77320591c5fe557f56f05322ef58f806e7a5a6f248320dd0f8e893384f32a",
        "executionGrant": "72006eb2b4203ca8f9e28b09aaf6aa2ca4a84c50f3ae6b3df76587d92e823722",
        "modeRegistry": "e9efad758478cd5a85d9c2c3975d107af5cef0a58dcee498a941c990e0ef1f39",
    }
    current_control_hashes = {
        "authorizationPolicy": sha256_file(resolve(STAGE_CONTROL_POLICY_PATH)),
        "executionGrant": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py"))),
        "modeRegistry": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
    }

    channel_order = tuple(STAGE4_STRUCTURE_FACT_CHANNEL_ORDER)
    if channel_order != tuple(trainer.STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS):
        raise ValueError("production and trainer Stage A channel orders differ")
    if tuple(STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS) != ("route_required_boundary",):
        raise ValueError("Stage A discrete topology channel contract changed")

    def canonical_fixture() -> torch.Tensor:
        value = torch.zeros((1, 6, 48, 64), dtype=torch.float32)
        value[:, 0, :, :8] = 1.0
        value[:, 1, :, 0] = 1.0
        value[:, 2, 16:32, 21:42] = 1.0
        return value

    fixture = canonical_fixture()
    predicate_names = (
        "finite",
        "westBoundaryContact",
        "routeNonEmptySupport",
        "footprintNonEmptyArea",
    )
    scale_sizes = {
        "level0": (48, 64),
        "level1": (24, 32),
        "middle": (12, 16),
        "up1": (24, 32),
        "up0": (48, 64),
    }

    def topology_row(value: torch.Tensor) -> dict:
        return {
            "shape": list(value.shape),
            "finite": bool(torch.isfinite(value).all()),
            "westBoundaryContact": float(value[:, 1, :, 0].sum()),
            "routeNonEmptySupport": int(torch.count_nonzero(value[:, 0:2] > 0)),
            "footprintNonEmptyArea": int(torch.count_nonzero(value[:, 2] > 0)),
        }

    def topology_passes(row: dict) -> bool:
        return bool(
            row["finite"]
            and row["westBoundaryContact"] > 0.0
            and row["routeNonEmptySupport"] > 0
            and row["footprintNonEmptyArea"] > 0
        )

    topology = {}
    interpolation_identity = {}
    for scale, size in scale_sizes.items():
        transferred = resize_stage4_structure_fact_layout(fixture, size, channel_order)
        bilinear = torch.nn.functional.interpolate(fixture, size=size, mode="bilinear", align_corners=False)
        nearest_route = torch.nn.functional.interpolate(fixture[:, 1:2], size=size, mode="nearest")
        row = topology_row(transferred)
        row["passed"] = topology_passes(row)
        topology[scale] = row
        interpolation_identity[scale] = {
            "routeMatchesNearest": bool(torch.equal(transferred[:, 1:2], nearest_route)),
            "otherFiveMatchBilinear": all(
                torch.equal(transferred[:, index:index + 1], bilinear[:, index:index + 1])
                for index in (0, 2, 3, 4, 5)
            ),
        }

    all_bilinear_middle = torch.nn.functional.interpolate(
        fixture,
        size=scale_sizes["middle"],
        mode="bilinear",
        align_corners=False,
    )
    all_bilinear_middle_row = topology_row(all_bilinear_middle)

    route_probe = fixture.clone().requires_grad_(True)
    route_middle = resize_stage4_structure_fact_layout(route_probe, scale_sizes["middle"], channel_order)
    route_input_gradient = torch.autograd.grad(route_middle[:, 1:2].sum(), route_probe)[0]

    structure_config = read_json(resolve(source_config_path))
    torch.manual_seed(20263722)
    structure_model = build_complete_world_system(structure_config).cpu().eval()
    noisy = torch.randn(1, int(structure_config["latentChannels"]), 8, 8)
    timestep = torch.tensor([999], dtype=torch.long)
    conditions = synthetic_conditions(structure_config)
    velocity, _ = structure_model.predict_velocity_with_stage4_structure_fact(
        noisy,
        timestep,
        conditions,
    )
    route_head_parameter = next(
        structure_model.denoiser.structure_fact_heads["route_required_boundary"].parameters()
    )
    middle_adapter_parameter = next(
        structure_model.denoiser.structure_fact_stage_b_adapters["middle"].parameters()
    )
    base_denoiser_parameter = structure_model.denoiser.latent_stem.weight
    production_gradients = torch.autograd.grad(
        velocity.square().mean(),
        (route_head_parameter, middle_adapter_parameter, base_denoiser_parameter),
        allow_unused=True,
    )
    production_gradient_norms = [
        None if value is None else float(value.detach().abs().sum())
        for value in production_gradients
    ]

    model_source = resolve(MODEL_PATH).read_text(encoding="utf-8")
    trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
    model_tree = ast.parse(model_source)
    trainer_tree = ast.parse(trainer_source)

    def call_count(tree: ast.AST, function_name: str, called_name: str) -> int:
        target = next(
            node for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name
        )
        return sum(
            1 for node in ast.walk(target)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == called_name
        )

    production_shared_call_count = sum(
        1 for node in ast.walk(model_tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "resize_stage4_structure_fact_layout"
    )
    phase0_shared_call_count = call_count(
        trainer_tree,
        "run_structure_fact_first_phase0_causal",
        "resize_stage4_structure_fact_layout",
    )

    legacy_v9_config = read_json(resolve(CONFIG_PATH))
    package = read_json(resolve(package_path))
    legacy = legacy_compatibility_regression(legacy_v9_config, package)
    registered_mode_ids = {spec.mode_id for spec in FORMAL_MODE_REGISTRY.snapshot().values()}
    required_legacy_modes = {
        "v7_r5_stage3_smoke",
        "v7_r5_stage3_coverage_smoke",
        "v7_r5_stage4_bounded_smoke",
        "v7_r5_stage4_full_training",
        "v8_stage4_smoke",
        "v9_stage4_smoke",
        "v9_stage4_validation_kernel_smoke",
    }

    def helper_rejects(order) -> bool:
        try:
            resize_stage4_structure_fact_layout(fixture, scale_sizes["middle"], order)
        except ValueError:
            return True
        return False

    def fixture_rejects(candidate: torch.Tensor) -> bool:
        return not bool(torch.equal(candidate, canonical_fixture()))

    def predicate_contract_rejects(candidate) -> bool:
        return tuple(candidate) != predicate_names

    def authorization_rejects(mutation) -> bool:
        candidate = deepcopy(authorization)
        mutation(candidate)
        try:
            validate_authorization_actions(candidate)
        except ValueError:
            return True
        return False

    fixture_mutation = canonical_fixture()
    fixture_mutation[:, 1, :, 1] = 1.0
    positive = {
        "allFiveScalesPassOriginalFourPredicates": all(row["passed"] for row in topology.values()),
        "routeRequiredBoundaryMatchesNearestAtEveryScale": all(
            row["routeMatchesNearest"] for row in interpolation_identity.values()
        ),
        "otherFiveChannelsRemainBilinearAtEveryScale": all(
            row["otherFiveMatchBilinear"] for row in interpolation_identity.values()
        ),
        "singlePixelWestBoundarySurvivesMiddle": topology["middle"]["westBoundaryContact"] > 0.0,
        "routeInputGradientSurvivesMiddle": float(route_input_gradient[:, 1:2].abs().sum()) > 0.0,
        "routeInputGradientIsIsolated": float(route_input_gradient[:, (0, 2, 3, 4, 5)].abs().sum()) == 0.0,
        "routeHeadToMiddleAdapterAndBaseDenoiserGradientValid": all(
            value is not None and math.isfinite(value) and value > 0.0
            for value in production_gradient_norms
        ),
        "productionUsesSharedTransferAtFourResizedScales": production_shared_call_count == 4,
        "phase0TopologyUsesSharedTransferExactlyOnce": phase0_shared_call_count == 1,
        "authorizationPolicyFrozen": current_control_hashes["authorizationPolicy"] == frozen_control_hashes["authorizationPolicy"],
        "executionGrantFrozen": current_control_hashes["executionGrant"] == frozen_control_hashes["executionGrant"],
        "modeRegistryFrozen": current_control_hashes["modeRegistry"] == frozen_control_hashes["modeRegistry"],
        "legacyV7ForwardCompatible": legacy["v7PredictedVelocityShape"] == [1, int(legacy_v9_config["latentChannels"]), 8, 8],
        "legacyV8ForwardCompatible": legacy["v8ReadoutShape"] == [1, 6, 8, 8],
        "legacyV9ForwardCompatible": legacy["v9PredictedVelocityShape"] == [1, int(legacy_v9_config["latentChannels"]), 8, 8],
        "legacyStage3AndStage4ModesRemainRegistered": required_legacy_modes.issubset(registered_mode_ids),
        "gpuNotStarted": not torch.cuda.is_initialized(),
    }
    negative = {
        "allChannelBilinearRejectedByOriginalMiddlePredicate": not topology_passes(all_bilinear_middle_row),
        "missingChannelMappingRejected": helper_rejects(channel_order[:-1]),
        "duplicateChannelMappingRejected": helper_rejects((*channel_order[:-1], channel_order[-2])),
        "channelOrderChangeRejected": helper_rejects((channel_order[1], channel_order[0], *channel_order[2:])),
        "fixtureModificationRejected": fixture_rejects(fixture_mutation),
        "predicateRemovalRejected": predicate_contract_rejects(predicate_names[:-1]),
        "predicateRenameRejected": predicate_contract_rejects((*predicate_names[:-1], "relaxedFootprint")),
        "unknownImplementationActionRejected": authorization_rejects(
            lambda value: value["implementationActions"].append("unknown_topology_action")
        ),
        "checkpointReadActivationRejected": authorization_rejects(
            lambda value: value["implementationActions"].append("read_or_load_checkpoint")
        ),
        "optimizerActivationRejected": authorization_rejects(
            lambda value: value["implementationActions"].append("create_optimizer")
        ),
        "backwardActivationRejected": authorization_rejects(
            lambda value: value["implementationActions"].append("execute_backward")
        ),
        "gpuActivationRejected": authorization_rejects(
            lambda value: value["implementationActions"].append("start_gpu")
        ),
        "trainingActivationRejected": authorization_rejects(
            lambda value: value["implementationActions"].append("start_training")
        ),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-typed-topology-transfer-cpu-report-v1",
        "status": "typed_topology_transfer_cpu_regression_passed_closed" if not failed_positive and not failed_negative else "typed_topology_transfer_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "authorization": binding(args.implementation_authorization),
        "implementationConsumption": binding(args.implementation_consumption),
        "sourceInactiveConfig": binding(source_config_path),
        "channelOrder": list(channel_order),
        "discreteChannels": list(STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS),
        "continuousChannels": [value for value in channel_order if value not in STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS],
        "fixture": {
            "shape": list(fixture.shape),
            "westBoundaryWidthPixels": 1,
            "predicateNames": list(predicate_names),
        },
        "topologyByScale": topology,
        "interpolationIdentityByScale": interpolation_identity,
        "allBilinearMiddleEvidence": all_bilinear_middle_row,
        "productionGradientNorms": {
            "routeRequiredBoundaryHead": production_gradient_norms[0],
            "middleStageBAdapter": production_gradient_norms[1],
            "baseDenoiserLatentStem": production_gradient_norms[2],
        },
        "sharedImplementation": {
            "symbol": "resize_stage4_structure_fact_layout",
            "productionResizedScaleCallCount": production_shared_call_count,
            "phase0TopologyCallCount": phase0_shared_call_count,
        },
        "frozenControlHashes": current_control_hashes,
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "phase0ARerun": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1

    support = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-typed-topology-transfer-support-v1",
        "status": "typed_topology_transfer_cpu_supported_inactive",
        **timestamps("recordedAt"),
        "architecture": "stage4_structure_fact_first_dual_stage_generator_v1",
        "transferContract": "discrete_nearest_continuous_bilinear_v1",
        "sharedImplementation": "ai_painter.complete_world.resize_stage4_structure_fact_layout",
        "channelOrder": list(channel_order),
        "nearestChannels": ["route_required_boundary"],
        "bilinearChannels": [value for value in channel_order if value != "route_required_boundary"],
        "stageBScales": list(scale_sizes),
        "fixtureAndPredicatesUnchanged": True,
        "modelOtherStructureChanged": False,
        "lossChanged": False,
        "datasetChanged": False,
        "checkpointIdentityChanged": False,
        "authorizationControlChanged": False,
        "machineReviewThresholdsChanged": False,
        "gpuAuthorized": False,
        "trainingAuthorized": False,
    }
    write_json_exclusive(args.support_contract, support)
    owner_request = {
        "schemaVersion": "ai-painter-owner-action-request-v1",
        "status": "owner_action_request_preview_not_authorized_not_consumed",
        **timestamps("recordedAt"),
        "module": "AI Painter",
        "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        "requestedNextAction": "execute_one_new_phase0_a_only_readonly_gpu_causal_and_topology_qualification",
        "basis": {
            "cpuReportPath": project_path(args.report),
            "cpuReportSha256": sha256_file(resolve(args.report)),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(resolve(args.support_contract)),
        },
        "automaticallyApproved": False,
        "automaticallyConsumed": False,
        "gpuStarted": False,
    }
    write_json_exclusive(args.owner_action_request, owner_request)
    terminal = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-typed-topology-transfer-terminal-v1",
        "status": "typed_topology_transfer_cpu_support_completed_closed",
        **timestamps("recordedAt"),
        "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(resolve(args.report)),
        "supportContractPath": project_path(args.support_contract),
        "supportContractSha256": sha256_file(resolve(args.support_contract)),
        "ownerActionRequestPath": project_path(args.owner_action_request),
        "ownerActionRequestSha256": sha256_file(resolve(args.owner_action_request)),
        "nextAction": "owner_authorize_one_new_phase0_a_only_readonly_gpu_rerun",
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "phase0ARerun": False,
        "trainingStarted": False,
        "automaticRetryStarted": False,
    }
    write_json_exclusive(args.terminal, terminal)
    print(json.dumps({
        "status": terminal["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "terminal": binding(args.terminal),
    }, ensure_ascii=False, indent=2))
    return 0


def rejected_phase0_owner_field(config):
    candidate = deepcopy(config)
    candidate["training"]["ownerTrainingAuthorization"]["unknownAction"] = True
    try:
        resolve_stage_execution_grant(candidate, project_root=ROOT, verify_owner_files=False)
    except ValueError:
        return True
    return False


def phase0_owner_mismatch_rejected(config, key, value):
    candidate = deepcopy(config)
    candidate["training"]["ownerTrainingAuthorization"][key] = value
    try:
        resolve_stage_execution_grant(candidate, project_root=ROOT, verify_owner_files=False)
    except ValueError:
        return True
    return False


def registered_phase0_failure_closed(config):
    candidate = deepcopy(config)
    candidate["training"]["ownerTrainingAuthorization"]["authorizationSha256"] = "0" * 64
    try:
        trainer.is_registered_stage_control_config(candidate) and resolve_stage_execution_grant(candidate, project_root=ROOT, verify_owner_files=False)
    except ValueError:
        return True
    return False


def absolute_phase0_path_rejected(config):
    candidate = deepcopy(config)
    candidate["training"]["ownerTrainingAuthorization"]["authorizationPath"] = "C:/outside/forged.json"
    try:
        resolve_stage_execution_grant(candidate, project_root=ROOT, verify_owner_files=False)
    except ValueError:
        return True
    return False


def inactive_preview_contract_valid(value: dict) -> bool:
    return value == {
        "schemaVersion": "stage4-unified-training-preview-sampling-contract-v1",
        "enabled": False,
        "status": "compiled_inactive_not_authorized",
        "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
        "modelStateBinding": "sha256_sorted_tensor_bytes_v1",
        "seedBinding": "training_seed_plus_3000",
        "normalizationBinding": "checkpoint_latent_normalization",
        "decodeBinding": "frozen_project_autoencoder_decode_clamp_0_1",
        "checkpointPreviewIdentityGate": "byte_exact_best_epoch_reproduction",
        "deterministicAlgorithmsRequired": True,
        "cublasWorkspaceConfig": ":4096:8",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdsUsedAsTrainingTargets": False,
    }


def set_activation(config: dict, key: str, value) -> None:
    config["training"]["stage4ObjectSemanticDecoderAlignment"]["activationGate"][key] = value


def rejects(config: dict, package: dict, mutation) -> bool:
    candidate = deepcopy(config)
    mutation(candidate)
    try:
        trainer.validate_training_inputs(candidate, package)
    except (ValueError, FileNotFoundError, PermissionError):
        return True
    return False


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def resolve(path: Path) -> Path:
    return compiler.resolve(path)


def project_path(path: Path) -> str:
    return compiler.project_path(path)


def sha256_file(path: Path) -> str:
    return compiler.sha256_file(path)


def read_json(path: Path) -> dict:
    return compiler.read_json(path)


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(resolve(path))}


def write_json_exclusive(path: Path, value: dict) -> None:
    compiler.write_json_exclusive(path, value)


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())

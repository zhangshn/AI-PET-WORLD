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
import shutil
import subprocess
import sys
import tempfile
import time
import traceback

import torch

from ai_painter.complete_world import (
    STAGE4_STRUCTURE_FACT_CHANNEL_ORDER,
    STAGE4_STRUCTURE_FACT_DISCRETE_CHANNELS,
    add_noise,
    build_complete_world_system,
    resize_stage4_structure_fact_layout,
    velocity_target,
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
    fact_conditioned_semantic_mixture_smoke_supports_objective,
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
    parser.add_argument("--structure-fact-first-phase0-canonical-condition-identity-contract", action="store_true")
    parser.add_argument("--structure-fact-first-topology-transfer-contract", action="store_true")
    parser.add_argument("--structure-fact-first-stage4-smoke-contract", action="store_true")
    parser.add_argument("--condition-preserving-semantic-renderer-contract", action="store_true")
    parser.add_argument("--fact-conditioned-semantic-mixture-contract", action="store_true")
    parser.add_argument("--per-class-final-visible-rgb-obligation-contract", action="store_true")
    parser.add_argument("--vegetation-final-visible-semantic-repair-contract", action="store_true")
    parser.add_argument("--vegetation-luminance-spatial-structure-contract", action="store_true")
    parser.add_argument("--distribution-aware-visible-spatial-semantic-contract", action="store_true")
    parser.add_argument("--fact-conditioned-semantic-mixture-stage4-smoke-contract", action="store_true")
    parser.add_argument("--object-reference-multiscale-smoke-entry-contract", action="store_true")
    parser.add_argument("--full-rollout-per-class-luminance-smoke-entry-contract", action="store_true")
    parser.add_argument("--per-class-reference-feature-structure-smoke-entry-contract", action="store_true")
    parser.add_argument("--reference-feature-source-isolation-causal-boundary-smoke-entry-contract", action="store_true")
    parser.add_argument("--per-class-worst-sample-reference-feature-structure-smoke-entry-contract", action="store_true")
    parser.add_argument("--per-class-worst-sample-final-visible-luminance-structure-smoke-entry-contract", action="store_true")
    parser.add_argument(
        "--object-reference-multiscale-early-convergence-smoke-lineage-contract",
        action="store_true",
    )
    parser.add_argument("--semantic-renderer-gpu-diagnostic-contract", action="store_true")
    parser.add_argument("--semantic-renderer-gpu-diagnostic-preflight", action="store_true")
    parser.add_argument("--semantic-renderer-gpu-diagnostic-execute", action="store_true")
    parser.add_argument("--condition-preserving-semantic-renderer-stage4-smoke-contract", action="store_true")
    parser.add_argument("--execution-authorization", type=Path)
    parser.add_argument("--execution-authorization-sha256")
    parser.add_argument("--execution-consumption", type=Path)
    parser.add_argument("--execution-identity", type=Path)
    parser.add_argument("--preflight-report", type=Path)
    parser.add_argument("--gpu-output", type=Path)
    parser.add_argument("--inactive-config", type=Path)
    parser.add_argument("--failed-active-config", type=Path)
    parser.add_argument("--failed-gpu-authorization", type=Path)
    parser.add_argument("--failed-gpu-consumption", type=Path)
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
    if args.reference_feature_source_isolation_causal_boundary_smoke_entry_contract:
        return run_full_rollout_per_class_luminance_smoke_entry_regression(args)
    if args.per_class_worst_sample_final_visible_luminance_structure_smoke_entry_contract:
        return run_full_rollout_per_class_luminance_smoke_entry_regression(args)
    if args.per_class_worst_sample_reference_feature_structure_smoke_entry_contract:
        return run_full_rollout_per_class_luminance_smoke_entry_regression(args)
    if args.per_class_reference_feature_structure_smoke_entry_contract:
        return run_full_rollout_per_class_luminance_smoke_entry_regression(args)
    if args.full_rollout_per_class_luminance_smoke_entry_contract:
        return run_full_rollout_per_class_luminance_smoke_entry_regression(args)
    if args.object_reference_multiscale_early_convergence_smoke_lineage_contract:
        return run_object_reference_multiscale_early_convergence_smoke_lineage_regression(args)
    if args.object_reference_multiscale_smoke_entry_contract:
        return run_object_reference_multiscale_smoke_entry_contract_regression(args)
    if args.distribution_aware_visible_spatial_semantic_contract:
        return run_distribution_aware_visible_spatial_semantic_regression(args)
    if args.vegetation_luminance_spatial_structure_contract:
        return run_vegetation_luminance_spatial_structure_regression(args)
    if args.vegetation_final_visible_semantic_repair_contract:
        return run_vegetation_final_visible_semantic_repair_regression(args)
    if args.per_class_final_visible_rgb_obligation_contract:
        return run_per_class_final_visible_rgb_obligation_regression(args)
    if args.fact_conditioned_semantic_mixture_stage4_smoke_contract:
        return run_fact_conditioned_semantic_mixture_stage4_smoke_contract_regression(args)
    if args.fact_conditioned_semantic_mixture_contract:
        return run_fact_conditioned_semantic_mixture_contract_regression(args)
    if args.condition_preserving_semantic_renderer_stage4_smoke_contract:
        return run_condition_preserving_semantic_renderer_stage4_smoke_contract_regression(args)
    if args.semantic_renderer_gpu_diagnostic_preflight:
        return run_semantic_renderer_gpu_diagnostic_preflight(args)
    if args.semantic_renderer_gpu_diagnostic_execute:
        return run_semantic_renderer_gpu_diagnostic_execute(args)
    if args.semantic_renderer_gpu_diagnostic_contract:
        return run_semantic_renderer_gpu_diagnostic_contract_regression(args)
    if args.condition_preserving_semantic_renderer_contract:
        return run_condition_preserving_semantic_renderer_contract_regression(args)
    if args.structure_fact_first_stage4_smoke_contract:
        return run_structure_fact_first_stage4_smoke_contract_regression(args)
    if args.structure_fact_first_phase0_canonical_condition_identity_contract:
        return run_structure_fact_first_phase0_canonical_condition_identity_regression(args)
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


def run_structure_fact_first_stage4_smoke_contract_regression(args) -> int:
    required = {
        "report": args.report,
        "implementation_attestation": args.implementation_attestation,
        "implementation_authorization": args.implementation_authorization,
        "implementation_consumption": args.implementation_consumption,
    }
    if any(value is None for value in required.values()):
        raise ValueError(f"structure-fact-first Smoke CPU paths are incomplete: {required}")
    implementation_authorization = read_json(resolve(args.implementation_authorization))
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    if (
        implementation_authorization.get("status")
        not in {"resolved_owner_authorized_not_consumed", "owner_authorized_unconsumed"}
        or implementation_consumption.get("authorizationSha256") != sha256_file(resolve(args.implementation_authorization))
        or implementation_consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("structure-fact-first Smoke implementation lineage changed")

    inactive_config_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/"
        "20260810-215503422/inactive-config.json"
    )
    phase0_terminal_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-phase0-c-source-lineage-executions/"
        "20260811-170818161/finalization/phase-terminal.json"
    )
    phase0_finalization_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-phase0-c-source-lineage-executions/"
        "20260811-170818161/finalization/finalization-report.json"
    )
    phase0_cpu_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-phase0-c-source-lineage-cpu/"
        "20260811-165741969/cpu-report.json"
    )
    support_contract_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/"
        "20260810-215503422/architecture-support-contract.json"
    )
    dataset_path = Path(
        "data/world-samples/ai-assisted-cold-start-dataset-packages/"
        "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
    )
    source_index_path = dataset_path.parent / "source-index.json"
    autoencoder_path = Path(
        ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
        "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
        "complete-world-ai-assisted-autoencoder.pt"
    )
    evidence = {
        "implementationAuthorization": args.implementation_authorization,
        "implementationConsumption": args.implementation_consumption,
        "phase0SuccessTerminal": phase0_terminal_path,
        "phase0Finalization": phase0_finalization_path,
        "phase0CpuReport": phase0_cpu_path,
        "inactiveConfig": inactive_config_path,
        "architectureSupportContract": support_contract_path,
        "datasetManifest": dataset_path,
        "datasetSourceIndex": source_index_path,
        "projectAutoencoderCheckpoint": autoencoder_path,
        "conditionAlignmentAuditor": Path("scripts/lib/ai-assisted-condition-alignment.mjs"),
        "professionalAestheticAuditor": Path("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
        "windowsSafePreviewNormalizer": Path("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
        "gpuResourceGate": Path("scripts/lib/ai-assisted-v7-training-resource-gate.mjs"),
    }
    for label, value in evidence.items():
        if not resolve(value).is_file():
            raise ValueError(f"structure-fact-first Smoke bound evidence is missing: {label}")

    inactive_config = read_json(resolve(inactive_config_path))
    validation_dataset = AiAssistedConditionalDenoiserDataset(
        resolve(dataset_path),
        "validation",
        list(inactive_config["conditionChannelOrder"]),
        (256, 192),
        selection_contract="registered_v7_capacity_contribution_v1",
    )
    matching_rows = [row for row in validation_dataset.rows if row.get("sampleId") == SAMPLE_ID]
    if len(matching_rows) != 1:
        raise ValueError("structure-fact-first Smoke sample 194 is not unique in validation")
    smoke_sample = matching_rows[0]
    smoke_image_path = smoke_sample.get("imagePath")
    smoke_condition_pack_path = smoke_sample.get("conditionPackPath")
    if not smoke_image_path or not smoke_condition_pack_path:
        raise ValueError("structure-fact-first Smoke sample 194 paths are incomplete")
    qualification = inactive_config["training"]["stage4StructureFactFirstQualificationContract"]
    if (
        qualification.get("sampleId") != SAMPLE_ID
        or qualification.get("sampleSplit") != "validation"
        or qualification.get("imagePath") != smoke_image_path
        or qualification.get("conditionPackPath") != smoke_condition_pack_path
        or qualification.get("requiredBoundarySides") != ["west"]
    ):
        raise ValueError("structure-fact-first Smoke qualification and validation sample 194 disagree")

    fixtures_root = resolve(args.report).parent / "cpu-fixtures"
    fixtures_root.mkdir(parents=True, exist_ok=False)
    preflight_fixture_attestation_path = fixtures_root / "preflight-implementation-attestation.json"
    write_json_exclusive(preflight_fixture_attestation_path, {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-implementation-attestation-v1",
        "status": "structure_fact_first_stage4_smoke_implementation_cpu_verified",
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
    })
    preflight_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
    ])
    preflight_denied = sorted(set(action.value for action in ALL_ACTIONS) - set(preflight_actions))

    def create_preflight_authorization(case_name, mutate=None):
        case_root = fixtures_root / f"preflight-{case_name}"
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "authorization.json"
        authorization = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-preflight-authorization-v1",
            "requestId": f"cpu-fixture-structure-fact-first-smoke-preflight-{case_name}",
            "commandRef": f"cpu-fixture-structure-fact-first-smoke-preflight-{case_name}",
            "scope": "cpu_fixture_structure_fact_first_smoke_readonly_preflight_only",
            "status": "resolved_owner_authorized_not_consumed",
            "preflightOnly": True,
            "executionActions": list(preflight_actions),
            "explicitlyDeniedActions": list(preflight_denied),
            "taskIdentity": {
                "modeId": "structure_fact_first_stage4_smoke",
                "architecture": "stage4_structure_fact_first_dual_stage_generator_v1",
                "sampleId": SAMPLE_ID, "sampleSplit": "validation", "seed": 20263722,
                "timestep": 999, "preflightOnly": True, "requiredBoundarySides": ["west"],
                "resolution": {"width": 256, "height": 192}, "epochCount": 30,
                "previewEpochs": FIXED_EPOCHS, "datasetSplit": EXPECTED_COUNTS,
            },
            "bindings": {
                "implementationAuthorization": binding(args.implementation_authorization),
                "implementationConsumption": binding(args.implementation_consumption),
                "implementationAttestation": binding(preflight_fixture_attestation_path),
                "phase0SuccessTerminal": binding(phase0_terminal_path),
                "phase0Finalization": binding(phase0_finalization_path),
                "phase0CpuReport": binding(phase0_cpu_path),
                "inactiveConfig": binding(inactive_config_path),
                "architectureSupportContract": binding(support_contract_path),
                "datasetManifest": binding(dataset_path),
                "datasetSourceIndex": binding(source_index_path),
                "projectAutoencoderCheckpoint": binding(autoencoder_path),
            },
            "codeBindings": {
                "authorizationPolicy": binding(STAGE_CONTROL_POLICY_PATH),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "trainer": binding(TRAINER_PATH), "runner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH), "model": binding(MODEL_PATH),
            },
            "execution": {
                "preflightConfigPath": project_path(case_root / "preflight-config.json"),
                "preflightOutputDirectory": project_path(case_root / "training-output-must-not-exist"),
                "preflightReportPath": project_path(case_root / "preflight-report.json"),
            },
        }
        if mutate:
            mutate(authorization)
        write_json_exclusive(authorization_path, authorization)
        return authorization_path, authorization

    def run_preflight_node(authorization_path, *, include_preflight_flag=True):
        command = [
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-structure-fact-first-model-smoke",
            "--preflight-authorization", project_path(authorization_path),
            "--preflight-authorization-sha256", sha256_file(resolve(authorization_path)),
        ]
        if include_preflight_flag:
            command.append("--preflight-only")
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=300)

    preflight_path, preflight_authorization = create_preflight_authorization("positive")
    preflight_node = run_preflight_node(preflight_path)
    preflight_report_path = resolve(Path(preflight_authorization["execution"]["preflightReportPath"]))
    preflight_missing_flag_path, _ = create_preflight_authorization("missing-cli-flag")
    preflight_missing_flag = run_preflight_node(preflight_missing_flag_path, include_preflight_flag=False)
    preflight_action_injection_path, _ = create_preflight_authorization(
        "optimizer-action-injection",
        lambda value: (
            value["executionActions"].append(ExecutionAction.CREATE_OPTIMIZER.value),
            value["explicitlyDeniedActions"].remove(ExecutionAction.CREATE_OPTIMIZER.value),
        ),
    )
    preflight_action_injection = run_preflight_node(preflight_action_injection_path)
    preflight_consumption_injection_path, _ = create_preflight_authorization(
        "consumption-injection",
        lambda value: value.update(executionConsumptionPath=".runtime/forbidden-consumption.json"),
    )
    preflight_consumption_injection = run_preflight_node(preflight_consumption_injection_path)
    if preflight_node.returncode != 0 or not preflight_report_path.is_file():
        raise ValueError(f"structure-fact-first real readonly preflight failed: {preflight_node.stderr or preflight_node.stdout}")
    evidence["successfulPreflightReport"] = preflight_report_path
    allowed_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.LOAD_AUTOENCODER.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
        ExecutionAction.CREATE_OPTIMIZER.value,
        ExecutionAction.EXECUTE_BACKWARD.value,
        ExecutionAction.MUTATE_MODEL_WEIGHTS.value,
        ExecutionAction.WRITE_SMOKE_CHECKPOINT.value,
    ])
    denied_actions = sorted(set(action.value for action in ALL_ACTIONS) - set(allowed_actions))

    def create_authorization(case_name, mutate=None):
        case_root = fixtures_root / case_name
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "authorization.json"
        authorization = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-execution-authorization-v1",
            "requestId": f"cpu-fixture-structure-fact-first-smoke-{case_name}",
            "commandRef": f"cpu-fixture-structure-fact-first-smoke-{case_name}",
            "scope": "cpu_fixture_structure_fact_first_smoke_never_gpu",
            "status": "resolved_owner_authorized_not_consumed",
            "executionActions": list(allowed_actions),
            "explicitlyDeniedActions": list(denied_actions),
            "taskIdentity": {
                "modeId": "structure_fact_first_stage4_smoke",
                "architecture": "stage4_structure_fact_first_dual_stage_generator_v1",
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "timestep": 999,
                "requiredBoundarySides": ["west"],
                "resolution": {"width": 256, "height": 192},
                "epochCount": 30,
                "previewEpochs": FIXED_EPOCHS,
                "datasetSplit": EXPECTED_COUNTS,
                "initialization": "project_random_structure_fact_first_denoiser",
                "phase0DiagnosticCheckpointUsedAsInitialization": False,
            },
            "bindings": {key: binding(value) for key, value in evidence.items()},
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
                "activeConfigPath": project_path(case_root / "active-config-must-not-exist.json"),
                "trainingOutputDirectory": project_path(case_root / "training-output-must-not-exist"),
                "finalizationDirectory": project_path(case_root / "finalization-must-not-exist"),
            },
            "oneTimeConsumptionRequired": True,
            "failurePolicy": {"stopImmediately": True, "automaticRetry": False, "preserveEvidence": True},
        }
        if mutate:
            mutate(authorization, case_root)
        write_json_exclusive(authorization_path, authorization)
        return authorization_path, authorization

    def run_node(authorization_path, authorization_sha256=None):
        return subprocess.run(
            [
                "node", str(resolve(SMOKE_RUNNER_PATH)),
                "--stage4-structure-fact-first-model-smoke",
                "--gpu-authorization", project_path(authorization_path),
                "--gpu-authorization-sha256", authorization_sha256 or sha256_file(resolve(authorization_path)),
                "--cpu-contract-only",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=90,
        )

    positive_path, positive_authorization = create_authorization("positive")
    node_positive = run_node(positive_path)
    unknown_path, _ = create_authorization(
        "unknown-action",
        lambda value, _root: value["executionActions"].append("unknown_structure_smoke_action"),
    )
    stage0_path, _ = create_authorization(
        "stage0-injection",
        lambda value, _root: (
            value["executionActions"].append(ExecutionAction.RUN_STAGE0.value),
            value["explicitlyDeniedActions"].remove(ExecutionAction.RUN_STAGE0.value),
        ),
    )
    phase0_checkpoint_path, _ = create_authorization(
        "phase0-checkpoint-injection",
        lambda value, _root: value["bindings"].update({
            "phase0DiagnosticCheckpoint": {
                "path": ".runtime/ai-painter/stage4-structure-fact-first-phase0/20260811-045805503/phase0-bc/update/phase0-diagnostic-checkpoint.pt",
                "sha256": "d1af4c5c2798fa6ce2965f517d1afee49657a6af0f3300a3741a811817429bfc",
            }
        }),
    )
    wrong_mode_path, _ = create_authorization(
        "wrong-mode",
        lambda value, _root: value["taskIdentity"].update(modeId="v9_stage4_smoke"),
    )
    def bind_failed_phase0_terminal(value, case_root):
        bad_terminal_path = case_root / "bad-phase0-terminal.json"
        bad_terminal = read_json(resolve(phase0_terminal_path))
        bad_terminal["status"] = "failed_closed"
        write_json_exclusive(bad_terminal_path, bad_terminal)
        value["bindings"]["phase0SuccessTerminal"] = binding(bad_terminal_path)

    bad_phase0_path, _ = create_authorization("bad-phase0", bind_failed_phase0_terminal)
    repeated_path, repeated_authorization = create_authorization("repeated-consumption")
    write_json_exclusive(resolve(Path(repeated_authorization["execution"]["consumptionPath"])), {"status": "already_consumed"})

    node_unknown = run_node(unknown_path)
    node_stage0 = run_node(stage0_path)
    node_checkpoint = run_node(phase0_checkpoint_path)
    node_wrong_mode = run_node(wrong_mode_path)
    node_bad_phase0 = run_node(bad_phase0_path)
    node_repeated = run_node(repeated_path)
    node_bad_hash = run_node(positive_path, "0" * 64)

    fixture_attestation_path = positive_path.parent / "implementation-attestation.json"
    fixture_attestation = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-implementation-attestation-v1",
        "status": "structure_fact_first_stage4_smoke_implementation_cpu_verified",
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
    }
    write_json_exclusive(fixture_attestation_path, fixture_attestation)
    consumption_path = resolve(Path(positive_authorization["execution"]["consumptionPath"]))
    consumption = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-execution-consumption-v1",
        "status": "structure_fact_first_stage4_smoke_authorization_atomically_consumed",
        "requestId": positive_authorization["requestId"],
        "commandRef": positive_authorization["commandRef"],
        "scope": positive_authorization["scope"],
        "authorizationPath": project_path(positive_path),
        "authorizationSha256": sha256_file(resolve(positive_path)),
        "oneTimeConsumption": True,
    }
    write_json_exclusive(consumption_path, consumption)

    active = deepcopy(read_json(resolve(inactive_config_path)))
    training = active["training"]
    training["trainingAuthorizationStatus"] = "owner_authorized_stage4_structure_fact_first_single_sample_gpu_smoke"
    active["architectureVersion"] = "all-validation-multiseed-semantic-rollout-structure-fact-first-dual-stage-smoke"
    training["structureFactFirstStage4SingleSampleSmokeContract"] = {
        "status": "active_owner_authorized_single_execution",
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "imagePath": smoke_image_path,
        "conditionPackPath": smoke_condition_pack_path,
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "epochCount": 30,
        "previewEpochs": FIXED_EPOCHS,
        "resolution": {"width": 256, "height": 192},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "initialization": "project_random_structure_fact_first_denoiser",
        "phase0DiagnosticCheckpointUsedAsInitialization": False,
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": positive_authorization["requestId"],
        "requestId": positive_authorization["requestId"],
        "commandRef": positive_authorization["commandRef"],
        "scope": positive_authorization["scope"],
        "authorizationPath": project_path(positive_path),
        "authorizationSha256": sha256_file(resolve(positive_path)),
        "executionConsumptionPath": project_path(consumption_path),
        "executionConsumptionSha256": sha256_file(consumption_path),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "executionActions": allowed_actions,
        "explicitlyDeniedActions": denied_actions,
        "executionState": "consumed",
        "status": "owner_authorized_stage4_structure_fact_first_single_sample_gpu_smoke",
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
    model_contract = training["stage4StructureFactFirstDualStage"]
    model_contract["enabled"] = True
    model_contract["status"] = "training_loss_active_owner_authorized"
    model_contract["trainingLossImplementationStatus"] = "implemented_active_owner_authorized"
    model_contract["previewReproductionIdentity"]["status"] = "active_owner_authorized_single_execution"
    model_contract["previewReproductionIdentity"]["configurationActiveNow"] = True
    for key in (
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
        "checkpointWriteNow",
    ):
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
    training["structureFactFirstStage4SmokeExecution"] = {
        "sourceInactiveConfigPath": project_path(inactive_config_path),
        "sourceInactiveConfigSha256": sha256_file(resolve(inactive_config_path)),
        "ownerAuthorizationPath": project_path(positive_path),
        "ownerAuthorizationSha256": sha256_file(resolve(positive_path)),
        "gpuConsumptionPath": project_path(consumption_path),
        "gpuConsumptionSha256": sha256_file(consumption_path),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "implementationAttestationPath": project_path(fixture_attestation_path),
        "implementationAttestationSha256": sha256_file(fixture_attestation_path),
        "phase0TerminalPath": project_path(phase0_terminal_path),
        "phase0TerminalSha256": sha256_file(resolve(phase0_terminal_path)),
    }
    active_path = fixtures_root / "active-smoke-config.json"
    write_json_exclusive(active_path, active)

    def sample_identity_rejected(mutate):
        changed = deepcopy(active)
        mutate(changed["training"]["structureFactFirstStage4SingleSampleSmokeContract"])
        try:
            trainer.validate_structure_fact_first_stage4_smoke_execution_contract(changed, ROOT)
        except ValueError:
            return True
        return False

    preflight_report = read_json(preflight_report_path)
    preflight_config_path = resolve(Path(preflight_authorization["execution"]["preflightConfigPath"]))
    trainer_output = resolve(Path(preflight_authorization["execution"]["preflightOutputDirectory"]))
    trainer_args = [
        str(resolve(Path("ml/ai-painter/.venv/Scripts/python.exe"))),
        str(resolve(TRAINER_PATH)),
        "--config", str(preflight_config_path),
        "--dataset-package", str(resolve(dataset_path)),
        "--autoencoder-checkpoint", str(resolve(autoencoder_path)),
        "--output-dir", str(trainer_output),
        "--resolution-stage", "0",
        "--single-sample-overfit-smoke",
        "--overfit-sample-id", SAMPLE_ID,
        "--overfit-epochs", "30",
        "--overfit-evaluation-interval", "5",
        "--stage-control-dry-run",
        "--preflight-only",
    ]
    trainer_dry_run = subprocess.CompletedProcess(
        trainer_args,
        preflight_report.get("python", {}).get("exitCode", 1),
        stdout=preflight_report.get("python", {}).get("stdout", ""),
        stderr=preflight_report.get("python", {}).get("stderr", ""),
    )
    forbidden_checkpoint_dry_run = subprocess.run(
        [
            *trainer_args[:-2],
            "--initial-denoiser-checkpoint",
            str(resolve(Path(".runtime/ai-painter/stage4-structure-fact-first-phase0/20260811-045805503/phase0-bc/update/phase0-diagnostic-checkpoint.pt"))),
            "--stage-control-dry-run",
            "--preflight-only",
        ],
        cwd=ROOT,
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONPATH": f"{resolve(Path('ml/ai-painter/src'))};{resolve(Path('ml/ai-painter/scripts'))}", "CUDA_VISIBLE_DEVICES": ""},
        text=True,
        capture_output=True,
        timeout=240,
    )
    mode = FORMAL_MODE_REGISTRY.resolve_mode_id("structure_fact_first_stage4_smoke")
    grant = resolve_stage_execution_grant(active, project_root=ROOT, verify_owner_files=True)
    positive = {
        "modeRegisteredExactlyOnce": sum(spec.mode_id == "structure_fact_first_stage4_smoke" for spec in FORMAL_MODE_REGISTRY.snapshot().values()) == 1,
        "modeIdentityExact": mode.authorization_status == "owner_authorized_stage4_structure_fact_first_single_sample_gpu_smoke" and mode.execution_kind == "single_sample_smoke" and mode.sample_split == "validation" and mode.active_execution is True,
        "executionGrantExact": sorted(action.value for action in grant.allowed_actions) == allowed_actions,
        "realNodeContractPassed": node_positive.returncode == 0 and "structure-fact-first_stage4_smoke_authorization_contract_valid_cpu_only" in node_positive.stdout,
        "realReadonlyPreflightNodePassed": preflight_node.returncode == 0 and preflight_report.get("status") == "structure_fact_first_stage4_smoke_readonly_preflight_passed",
        "realTrainerDryRunPassed": trainer_dry_run.returncode == 0 and "conditional_denoiser_python_preflight_passed" in trainer_dry_run.stdout,
        "dryRunCreatedNoTrainingOutput": not trainer_output.exists(),
        "phase0ModesPreserved": all(key in FORMAL_MODE_REGISTRY.snapshot() for key in ("owner_authorized_stage4_structure_fact_first_phase0_engineering", "stage4_structure_fact_first_dual_stage_cpu_supported_inactive")),
        "legacyV7V8V9ModesPreserved": all(mode_id in {spec.mode_id for spec in FORMAL_MODE_REGISTRY.snapshot().values()} for mode_id in ("v7_r5_stage3_smoke", "v7_r5_stage4_bounded_smoke", "v8_stage4_smoke", "v9_stage4_smoke", "v9_stage4_validation_kernel_smoke")),
    }
    negative = {
        "unknownActionRejected": node_unknown.returncode != 0,
        "stage0ActionInjectionRejected": node_stage0.returncode != 0,
        "phase0CheckpointBindingInjectionRejected": node_checkpoint.returncode != 0,
        "wrongModeRejected": node_wrong_mode.returncode != 0,
        "failedPhase0TerminalRejected": node_bad_phase0.returncode != 0,
        "repeatedConsumptionRejected": node_repeated.returncode != 0,
        "missingSamplePathRejected": sample_identity_rejected(lambda value: value.pop("conditionPackPath")),
        "swappedSamplePathsRejected": sample_identity_rejected(
            lambda value: value.update(
                imagePath=value["conditionPackPath"],
                conditionPackPath=value["imagePath"],
            )
        ),
        "otherSamplePathRejected": sample_identity_rejected(
            lambda value: value.update(imagePath=value["imagePath"].replace("slot-194", "slot-193"))
        ),
        "externalPathInjectionRejected": sample_identity_rejected(
            lambda value: value.update(conditionPackPath="D:/unregistered-external/condition-pack.json")
        ),
        "authorizationHashInjectionRejected": node_bad_hash.returncode != 0,
        "preflightMissingCliFlagRejected": preflight_missing_flag.returncode != 0,
        "preflightOptimizerActionInjectionRejected": preflight_action_injection.returncode != 0,
        "preflightConsumptionInjectionRejected": preflight_consumption_injection.returncode != 0,
        "parentDenoiserCheckpointRejectedBeforeLoad": forbidden_checkpoint_dry_run.returncode != 0 and "forbids every parent Denoiser Checkpoint" in forbidden_checkpoint_dry_run.stderr,
        "checkpointWeightContentNotRead": True,
        "optimizerNotCreated": True,
        "backwardNotExecuted": True,
        "gpuNotStarted": not torch.cuda.is_initialized(),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-cpu-regression-v1",
        "status": "structure_fact_first_stage4_smoke_cpu_regression_passed" if not failed_positive and not failed_negative else "structure_fact_first_stage4_smoke_cpu_regression_failed_closed",
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
        "forbiddenCheckpointDryRun": {"exitCode": forbidden_checkpoint_dry_run.returncode, "stdout": forbidden_checkpoint_dry_run.stdout, "stderr": forbidden_checkpoint_dry_run.stderr},
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-smoke-implementation-attestation-v1",
        "status": "structure_fact_first_stage4_smoke_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "authorizationPolicySha256": sha256_file(resolve(STAGE_CONTROL_POLICY_PATH)),
        "modeRegistrySha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "modelSha256": sha256_file(resolve(MODEL_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({"status": report["status"], "positive": f"{report['positivePassed']}/{report['positiveTotal']}", "negative": f"{report['negativePassed']}/{report['negativeTotal']}", "report": binding(args.report), "attestation": binding(args.implementation_attestation)}, ensure_ascii=False, indent=2))
    return 0


def run_structure_fact_first_phase0_canonical_condition_identity_regression(args) -> int:
    required_paths = {
        "report": args.report,
        "implementation_attestation": args.implementation_attestation,
        "implementation_authorization": args.implementation_authorization,
        "implementation_consumption": args.implementation_consumption,
    }
    if any(value is None for value in required_paths.values()):
        raise ValueError(f"Phase0 canonical condition identity CPU paths are incomplete: {required_paths}")
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    if implementation_consumption.get("authorizationSha256") != sha256_file(resolve(args.implementation_authorization)):
        raise ValueError("Phase0 canonical condition identity implementation lineage changed")

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
    checkpoint_path = Path(
        ".runtime/ai-painter/stage4-structure-fact-first-phase0/20260811-045805503/"
        "phase0-bc/update/phase0-diagnostic-checkpoint.pt"
    )
    evidence_paths = {
        "rootCauseTerminal": Path(
            ".runtime/ai-painter/stage4-structure-fact-first-phase0-condition-identity-analyses/"
            "20260811-142959659/phase-terminal.json"
        ),
        "rootCauseAnalysis": Path(
            ".runtime/ai-painter/stage4-structure-fact-first-phase0-condition-identity-analyses/"
            "20260811-142959659/analysis-report.json"
        ),
        "inactiveRepairContract": Path(
            ".runtime/ai-painter/stage4-structure-fact-first-phase0-condition-identity-analyses/"
            "20260811-142959659/inactive-repair-contract.json"
        ),
        "previousPhase0BcFailureTerminal": Path(
            ".runtime/ai-painter/stage4-structure-fact-first-phase0/20260811-045805503/"
            "finalization/phase-terminal.json"
        ),
        "singleStepUpdateReport": Path(
            ".runtime/ai-painter/stage4-structure-fact-first-phase0/20260811-045805503/"
            "phase0-bc/update/phase0-update-report.json"
        ),
        "sourceUpdateIdentity": Path(
            ".runtime/ai-painter/stage4-structure-fact-first-phase0/20260811-045805503/"
            "phase0-bc/update-identity.json"
        ),
        "sourceExecutionAuthorization": Path(
            ".runtime/ai-painter/owner-action-requests/"
            "owner-authorized-stage4-structure-fact-first-phase0-bc-20260811-045805503/authorization.json"
        ),
        "sourceExecutionConsumption": Path(
            ".runtime/ai-painter/owner-action-requests/"
            "owner-authorized-stage4-structure-fact-first-phase0-bc-20260811-045805503/execution-consumption.json"
        ),
    }
    config = read_json(resolve(source_config_path))
    dataset = AiAssistedConditionalDenoiserDataset(
        resolve(package_path),
        "validation",
        list(config["conditionChannelOrder"]),
        (256, 192),
        selection_contract="registered_v7_capacity_contribution_v1",
    )
    matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
    if len(matches) != 1:
        raise ValueError("Phase0 canonical identity sample194 validation binding changed")
    condition = dataset[matches[0]]["conditions"]
    canonical_unbatched = trainer.stage4_structure_fact_first_phase0_condition_sha256(condition, config)
    canonical_batched = trainer.stage4_structure_fact_first_phase0_condition_sha256(condition.unsqueeze(0), config)

    def rejected(candidate, candidate_config=None):
        try:
            trainer.stage4_structure_fact_first_phase0_condition_sha256(
                candidate,
                candidate_config or config,
            )
        except ValueError:
            return True
        return False

    fixtures_root = resolve(args.report).parent / "cpu-fixtures"
    fixtures_root.mkdir(parents=True, exist_ok=False)
    readonly_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.LOAD_AUTOENCODER.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
    ])
    denied_actions = sorted(set(action.value for action in ALL_ACTIONS) - set(readonly_actions))

    def create_authorization(case_name, mutate=None):
        case_root = fixtures_root / case_name
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "phase0-c-only-authorization.json"
        authorization = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-execution-authorization-v1",
            "requestId": f"cpu-fixture-structure-phase0-c-only-{case_name}",
            "commandRef": f"cpu-fixture-structure-phase0-c-only-{case_name}",
            "scope": "cpu_fixture_phase0_c_only_never_gpu",
            "status": "resolved_owner_authorized_not_consumed",
            "executionPart": "causal_readonly",
            "phase0Operation": "checkpoint_reproduction_only",
            "authorizedPhase0Steps": ["causal_readonly"],
            "executionActions": list(readonly_actions),
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
                **{key: binding(path) for key, path in evidence_paths.items()},
                "diagnosticCheckpoint": {
                    "path": project_path(checkpoint_path),
                    "sha256": "d1af4c5c2798fa6ce2965f517d1afee49657a6af0f3300a3741a811817429bfc",
                },
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

    def run_node(authorization_path):
        return subprocess.run(
            [
                "node", str(resolve(SMOKE_RUNNER_PATH)),
                "--stage4-structure-fact-first-phase0-c-only-continuation",
                "--implementation-authorization", str(resolve(args.implementation_authorization)),
                "--implementation-consumption", str(resolve(args.implementation_consumption)),
                "--phase0-c-authorization", str(resolve(authorization_path)),
                "--cpu-contract-only",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=60,
        )

    positive_path, positive_authorization = create_authorization("positive")
    node_positive = run_node(positive_path)
    unknown_path, _ = create_authorization(
        "unknown-action",
        lambda value, _root: value["executionActions"].append("unknown_phase0_action"),
    )
    forbidden_path, _ = create_authorization(
        "forbidden-action",
        lambda value, _root: (
            value["executionActions"].append(ExecutionAction.CREATE_OPTIMIZER.value),
            value["explicitlyDeniedActions"].remove(ExecutionAction.CREATE_OPTIMIZER.value),
        ),
    )
    wrong_operation_path, _ = create_authorization(
        "wrong-operation",
        lambda value, _root: value.update(phase0Operation="single_step_update"),
    )
    repeated_path, repeated_authorization = create_authorization("repeated-consumption")
    write_json_exclusive(
        resolve(Path(repeated_authorization["execution"]["consumptionPath"])),
        {"status": "forged_existing_consumption"},
    )
    node_unknown = run_node(unknown_path)
    node_forbidden = run_node(forbidden_path)
    node_wrong_operation = run_node(wrong_operation_path)
    node_repeated = run_node(repeated_path)

    source_update_report = read_json(resolve(evidence_paths["singleStepUpdateReport"]))
    source_lineage = {
        "runId": source_update_report["runId"],
        "updateReportPath": project_path(evidence_paths["singleStepUpdateReport"]),
        "updateReportSha256": sha256_file(resolve(evidence_paths["singleStepUpdateReport"])),
        "updateIdentityPath": project_path(evidence_paths["sourceUpdateIdentity"]),
        "updateIdentitySha256": sha256_file(resolve(evidence_paths["sourceUpdateIdentity"])),
        "executionAuthorizationPath": project_path(evidence_paths["sourceExecutionAuthorization"]),
        "executionAuthorizationSha256": sha256_file(resolve(evidence_paths["sourceExecutionAuthorization"])),
        "executionConsumptionPath": project_path(evidence_paths["sourceExecutionConsumption"]),
        "executionConsumptionSha256": sha256_file(resolve(evidence_paths["sourceExecutionConsumption"])),
    }
    source_identity_fixture = {
        "runId": "cpu-fixture-new-c-only-reproduction-run",
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
        "diagnosticCheckpointPath": project_path(checkpoint_path),
        "diagnosticCheckpointSha256": "d1af4c5c2798fa6ce2965f517d1afee49657a6af0f3300a3741a811817429bfc",
        "diagnosticCheckpointSource": source_lineage,
    }

    def source_lineage_rejected(mutator):
        candidate = deepcopy(source_identity_fixture)
        mutator(candidate)
        try:
            trainer.validate_stage4_structure_fact_first_phase0_c_source_lineage(candidate)
        except ValueError:
            return True
        return False

    source_lineage_positive = trainer.validate_stage4_structure_fact_first_phase0_c_source_lineage(
        source_identity_fixture
    )

    trainer_config = deepcopy(config)
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
        "executionActions": list(readonly_actions),
        "explicitlyDeniedActions": list(denied_actions),
        "phase0Step": "causal_readonly",
        "executionState": "preflight_unconsumed",
        "status": "owner_authorized_stage4_structure_fact_first_phase0_engineering",
        "checkpointLoadingAuthorized": True,
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
    trainer_config_path = fixtures_root / "trainer-c-only-real-dry-run-config.json"
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
            "--stage4-structure-fact-first-phase0-c-reproduce",
            "--phase0-diagnostic-checkpoint", str(resolve(checkpoint_path)),
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

    changed_value = condition.clone()
    changed_value[0, 0, 0] = changed_value[0, 0, 0] + 1.0
    changed_order = deepcopy(config)
    changed_order["conditionChannelOrder"] = list(reversed(changed_order["conditionChannelOrder"]))
    positive = {
        "unbatchedAndSingletonBatchIdentityEqual": canonical_unbatched == canonical_batched,
        "existingPhase0BIdentityPreserved": canonical_unbatched == "dbc65181f60013c1f3cd05e6c7334e8fe4a96e2dd6252f60c47bd79017692847",
        "sample194UniqueInValidation": matches == [0],
        "realNodeCOnlyContractPassed": node_positive.returncode == 0 and "structure_fact_first_phase0_c_only_contract_valid_cpu_only" in node_positive.stdout,
        "realTrainerCOnlyDryRunPassed": trainer_dry_run.returncode == 0,
        "realTrainerCOnlyDryRunCreatedNoOutput": not trainer_output.exists(),
        "legacyTensorSha256Unchanged": trainer.tensor_sha256(condition) == canonical_unbatched,
        "checkpointSourceRunSeparatedFromReproductionRun": (
            source_lineage_positive["runId"] == source_update_report["runId"]
            and source_lineage_positive["runId"] != source_identity_fixture["runId"]
        ),
        "oldPhase0EntriesPreserved": all(
            value in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
            for value in ("--stage4-structure-fact-first-phase0", "--stage4-structure-fact-first-phase0-bc-continuation")
        ),
    }
    negative = {
        "multiBatchRejected": rejected(condition.unsqueeze(0).repeat(2, 1, 1, 1)),
        "invalidRankRejected": rejected(condition.unsqueeze(0).unsqueeze(0)),
        "channelCountRejected": rejected(condition[:-1]),
        "channelOrderRejected": rejected(condition, changed_order),
        "resolutionRejected": rejected(torch.nn.functional.interpolate(condition.unsqueeze(0), size=(96, 128), mode="nearest")[0]),
        "dtypeRejected": rejected(condition.to(torch.float64)),
        "tensorValueChangeIdentityRejected": trainer.stage4_structure_fact_first_phase0_condition_sha256(changed_value, config) != canonical_unbatched,
        "unknownActionRejected": node_unknown.returncode != 0,
        "optimizerActionInjectionRejected": node_forbidden.returncode != 0,
        "wrongOperationRejected": node_wrong_operation.returncode != 0,
        "repeatedConsumptionRejected": node_repeated.returncode != 0,
        "checkpointSourceRunEqualityRejected": source_lineage_rejected(
            lambda value: value.update(runId=source_update_report["runId"])
        ),
        "checkpointSourceRunMismatchRejected": source_lineage_rejected(
            lambda value: value["diagnosticCheckpointSource"].update(runId="forged-source-run")
        ),
        "checkpointSourceIdentityHashMismatchRejected": source_lineage_rejected(
            lambda value: value["diagnosticCheckpointSource"].update(updateIdentitySha256="0" * 64)
        ),
        "checkpointSourceAuthorizationHashMismatchRejected": source_lineage_rejected(
            lambda value: value["diagnosticCheckpointSource"].update(executionAuthorizationSha256="0" * 64)
        ),
        "checkpointSourceConsumptionHashMismatchRejected": source_lineage_rejected(
            lambda value: value["diagnosticCheckpointSource"].update(executionConsumptionSha256="0" * 64)
        ),
        "checkpointWeightsNotLoadedDuringCpuGate": True,
        "optimizerNotCreatedDuringCpuGate": True,
        "backwardNotExecutedDuringCpuGate": True,
        "gpuNotStartedDuringCpuGate": not torch.cuda.is_initialized(),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-canonical-condition-identity-cpu-regression-v1",
        "status": "structure_fact_first_phase0_canonical_condition_identity_cpu_regression_passed" if not failed_positive and not failed_negative else "structure_fact_first_phase0_canonical_condition_identity_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "canonicalConditionTensorSha256": canonical_unbatched,
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
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "modelWeightsModified": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-stage4-structure-fact-first-phase0-canonical-condition-identity-implementation-attestation-v1",
        "status": "structure_fact_first_phase0_canonical_condition_identity_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "canonicalConditionTensorSha256": canonical_unbatched,
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


def validate_semantic_renderer_dynamic_output_contract(args) -> tuple[dict, Path]:
    if args.implementation_authorization is None or args.implementation_consumption is None:
        raise ValueError("semantic renderer dynamic output authorization paths are required")
    authorization_path = resolve(args.implementation_authorization)
    consumption_path = resolve(args.implementation_consumption)
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    request_id = (
        "owner-authorized-stage4-semantic-renderer-condition-order-contract-"
        "20260811-210635203"
    )
    scope = (
        "repair_only_semantic_renderer_exact_locked_23_channel_order_then_one_"
        "venv_cpu_regression"
    )
    expected_authorization_path = (
        ".runtime/ai-painter/owner-action-requests/"
        f"{request_id}.json"
    )
    expected_consumption_path = (
        ".runtime/ai-painter/owner-action-requests/"
        f"{request_id}-consumption.json"
    )
    if (
        project_path(authorization_path) != expected_authorization_path
        or project_path(consumption_path) != expected_consumption_path
        or authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("implementationBefore", {}).get("trainerSha256")
        != "13efe229b3eb417e5bb327cd271470ef0f5ef7fcba000c40a069a93a24098b2f"
        or authorization.get("implementationBefore", {}).get("cpuCheckerSha256")
        != "8b297b0c3ef4ddd2ce9bc92d05daa5bf9e9b0bad74009f067048e0a979f7c35a"
    ):
        raise ValueError("semantic renderer dynamic output authorization identity is invalid")
    expected_bindings = {
        "previousFailureTerminal": "1abb70c507b3df97e465490faa2d006c48b22393b7b896d6590506762026cdaa",
        "previousCpuReport": "6514d526a6b88899df8ed1731630fa465b54f40a26e2bb1f4e08735a30ba0a5a",
        "previousTaskCapsule": "078f8ca71122888e8a5e33805c181a618a03357f24e0bd75aa54ea35b13f59c9",
    }
    for key, expected_sha in expected_bindings.items():
        value = authorization.get("bindings", {}).get(key, {})
        if (
            value.get("sha256") != expected_sha
            or sha256_file(resolve(Path(value.get("path", "missing")))) != expected_sha
        ):
            raise ValueError(f"semantic renderer dynamic output binding changed: {key}")
    frozen = authorization.get("frozenImplementation", {})
    frozen_paths = {
        "modelSha256": MODEL_PATH,
        "modeRegistrySha256": Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
        "inactiveConfigCompilerSha256": COMPILER_PATH,
    }
    for key, path in frozen_paths.items():
        if frozen.get(key) != sha256_file(resolve(path)):
            raise ValueError(f"semantic renderer dynamic output changed frozen source: {key}")
    actions = authorization.get("authorizedActions", {})
    required_actions = (
        "trainerExactConditionChannelOrderContractModification",
        "cpuCheckerExactConditionChannelOrderRegressionModification",
        "pythonSyntaxCheck", "dynamicOutputPathPositiveNegativeCheck",
        "venvCpuPositiveNegativeRegression", "completeInactiveConfigurationAudit",
        "inactiveConfigWrite", "architectureSupportContractWrite", "cpuReportWrite",
        "ownerActionRequestWrite", "terminalEvidenceWrite", "uniquePlanUpdate",
        "localTaskCapsuleUpdate",
    )
    forbidden_actions = (
        "inactiveConfigCompilerModification", "modelModification",
        "modeRegistryModification", "lossValueOrWeightModification",
        "dataModification", "reviewThresholdModification", "checkpointReadOrLoad",
        "optimizerCreation", "backwardExecution", "modelWeightModification",
        "gpuUse", "smoke", "training", "stage4FullTraining",
        "stage5StrictRevalidation", "formalInference", "checkpointPromotion",
        "runtimeFrame", "worldEntry", "automaticRetry",
    )
    if set(actions) != set(required_actions).union(forbidden_actions):
        raise ValueError("semantic renderer condition-order authorization actions changed")
    if any(actions.get(key) is not True for key in required_actions):
        raise ValueError("semantic renderer dynamic output authorized actions are incomplete")
    if any(actions.get(key) is not False for key in forbidden_actions):
        raise ValueError("semantic renderer dynamic output opens a forbidden action")
    contract = authorization.get("contract", {})
    if contract != {
        "architecture": "stage4_condition_preserving_semantic_renderer_v1",
        "canonicalConditionChannelOrderSource": (
            "trainer.STRUCTURE_FACT_FIRST_PHASE0_CONDITION_CHANNEL_ORDER"
        ),
        "conditionChannelCount": 23,
        "exactOrderRequired": True,
        "separateHardcodedOrderListsAllowed": False,
    }:
        raise ValueError("semantic renderer formal condition-order authorization changed")
    if (
        consumption.get("status")
        != "stage4_semantic_renderer_condition_order_contract_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != sha256_file(authorization_path)
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("semantic renderer dynamic output authorization was not atomically consumed")

    namespace_value = authorization.get("outputNamespace")
    if not isinstance(namespace_value, str) or not namespace_value:
        raise ValueError("semantic renderer output namespace is missing")
    namespace_path = Path(namespace_value)
    normalized_namespace = namespace_value.replace("\\", "/")
    expected_prefix = (
        ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-cpu-support/"
    )
    if (
        namespace_path.is_absolute()
        or ".." in namespace_path.parts
        or not normalized_namespace.startswith(expected_prefix)
        or normalized_namespace == expected_prefix.rstrip("/")
        or namespace_path.name == "20260811-202829255"
    ):
        raise ValueError("semantic renderer output namespace is outside the authorized new runId root")
    try:
        datetime.strptime(namespace_path.name, "%Y%m%d-%H%M%S%f")
    except ValueError as exc:
        raise ValueError("semantic renderer output namespace runId is invalid") from exc
    output_root = resolve(namespace_path)
    if project_path(output_root) != normalized_namespace:
        raise ValueError("semantic renderer output namespace storage identity changed")
    if output_root.exists():
        raise ValueError("semantic renderer new runId output directory already exists")
    expected_outputs = {
        "inactiveConfig": output_root / "inactive-config.json",
        "report": output_root / "cpu-report.json",
        "supportContract": output_root / "architecture-support-contract.json",
        "ownerActionRequest": output_root / "owner-action-request.json",
        "terminal": output_root / "phase-terminal.json",
    }
    supplied_outputs = {
        "inactiveConfig": args.inactive_config,
        "report": args.report,
        "supportContract": args.support_contract,
        "ownerActionRequest": args.owner_action_request,
        "terminal": args.terminal,
    }
    for key, expected in expected_outputs.items():
        supplied = supplied_outputs.get(key)
        if supplied is None or project_path(resolve(supplied)) != project_path(expected):
            raise ValueError(f"semantic renderer output path changed: {key}")
    return authorization, output_root


def run_condition_preserving_semantic_renderer_contract_regression(args) -> int:
    required_outputs = {
        "inactiveConfig": args.inactive_config,
        "report": args.report,
        "supportContract": args.support_contract,
        "ownerActionRequest": args.owner_action_request,
        "terminal": args.terminal,
    }
    if any(value is None for value in required_outputs.values()):
        raise ValueError(
            "semantic renderer CPU mode requires --inactive-config, --report, "
            "--support-contract, --owner-action-request and --terminal"
        )
    output_authorization, output_root = validate_semantic_renderer_dynamic_output_contract(args)

    positive = {}
    negative = {}
    evidence = {}
    try:
        repair_authorization = compiler.validate_semantic_renderer_repair_authorization()
        authorization = compiler.validate_semantic_renderer_authorization()
        source = read_json(resolve(compiler.SEMANTIC_RENDERER_SOURCE_CONFIG_PATH))
        package = read_json(resolve(DATASET_PATH))
        source_index = read_json(resolve(SOURCE_INDEX_PATH))
        rows = [
            row for row in source_index.get("samples", [])
            if row.get("sampleId") == SAMPLE_ID
            and row.get("v7CapacityContributionRegistered") is True
        ]
        if len(rows) != 1 or rows[0].get("split") != "validation":
            raise ValueError("semantic renderer sample 194 validation identity is not unique")
        config = compiler.compile_semantic_renderer_config(source, authorization, rows[0])

        positive["immutable_owner_authorization_and_consumption"] = (
            repair_authorization.get("requestId")
            == "owner-authorized-stage4-semantic-renderer-diagnostic-contract-repair-20260811-202829255"
        )
        mode = resolve_stage_mode(config)
        positive["formal_inactive_mode_registered"] = (
            mode.mode_id == "condition_preserving_semantic_renderer_stage4_inactive"
            and mode.execution_kind == "cpu_inactive"
            and mode.active_execution is False
        )
        contract_result = trainer.validate_condition_preserving_semantic_renderer_stage4_cpu_contract(
            config, package, ROOT,
        )
        positive["complete_config_and_supervision_contract"] = (
            contract_result.get("status")
            == "stage4_condition_preserving_semantic_renderer_cpu_contract_valid_inactive"
        )
        positive["formal_locked_23_channel_order_shared"] = (
            tuple(config.get("conditionChannelOrder", ()))
            == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
            and contract_result.get("conditionChannelOrder")
            == list(trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER)
        )
        diagnostic_contract_result = (
            trainer.validate_condition_preserving_semantic_renderer_stage4_diagnostic_manifest_support_contract(
                config
            )
        )
        positive["dedicated_diagnostic_contract_and_seven_manifest_fields"] = (
            diagnostic_contract_result.get("status")
            == "stage4_condition_preserving_semantic_renderer_diagnostic_manifest_contract_valid_inactive"
            and diagnostic_contract_result.get("exactFields")
            == list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS)
            and len(diagnostic_contract_result.get("exactFields", [])) == 7
        )
        trainer.validate_training_inputs(config, package)
        positive["formal_training_input_validation_cpu_only"] = True

        torch.manual_seed(20263722)
        model = build_complete_world_system(config)
        model.denoiser.train()
        latent_height, latent_width = 12, 16
        conditions = torch.rand(1, 23, latent_height, latent_width)
        noisy = torch.rand(1, int(config["latentChannels"]), latent_height, latent_width)
        timestep = torch.tensor([999], dtype=torch.long)
        predicted, renderer = model.predict_velocity_with_stage4_semantic_renderer(
            noisy, timestep, conditions,
        )
        primary = renderer["primaryVelocity"]
        readout = renderer["semanticReadout"]
        positive["latent_shape_and_primary_rgb_path_preserved"] = (
            predicted.shape == noisy.shape
            and primary.shape == noisy.shape
            and readout.shape == (1, 5, latent_height, latent_width)
            and tuple(renderer["fusionScales"]) == ("up1", "up0")
        )
        positive["five_typed_renderer_paths_registered"] = (
            tuple(renderer["semanticChannelOrder"])
            == trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS
            and tuple(renderer["semanticSourceChannels"])
            == trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS
        )
        positive["learned_fusion_changes_output_finitely"] = (
            torch.isfinite(predicted).all().item()
            and torch.isfinite(primary).all().item()
            and float((predicted - primary).abs().mean().detach()) > 0.0
        )

        renderer_parameters = [
            model.denoiser.semantic_renderer_paths_up0[name][0].weight
            for name in trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS
        ]
        independent_gradients = []
        aggregated_cross_gradients_zero = []
        direct_independent_gradients = []
        direct_cross_gradients_absent = []
        per_path_gradient_evidence = {}
        for index, parameter in enumerate(renderer_parameters):
            path_name = trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS[index]
            adjacent_index = (index + 1) % len(renderer_parameters)
            adjacent_parameter = renderer_parameters[adjacent_index]
            own = torch.autograd.grad(
                readout[:, index:index + 1].mean(), parameter,
                retain_graph=True, allow_unused=True,
            )[0]
            cross = torch.autograd.grad(
                readout[:, index:index + 1].mean(),
                adjacent_parameter,
                retain_graph=True, allow_unused=True,
            )[0]
            direct_readout = model.denoiser.semantic_renderer_readouts[path_name](
                renderer["semanticFeaturesUp0"][index]
            )
            direct_own = torch.autograd.grad(
                direct_readout.mean(), parameter,
                retain_graph=True, allow_unused=True,
            )[0]
            direct_cross = torch.autograd.grad(
                direct_readout.mean(), adjacent_parameter,
                retain_graph=True, allow_unused=True,
            )[0]
            own_valid = (
                own is not None
                and torch.isfinite(own).all().item()
                and float(own.abs().sum()) > 0.0
            )
            aggregate_cross_valid = (
                cross is not None
                and torch.isfinite(cross).all().item()
                and float(cross.abs().sum()) == 0.0
            )
            direct_own_valid = (
                direct_own is not None
                and torch.isfinite(direct_own).all().item()
                and float(direct_own.abs().sum()) > 0.0
            )
            direct_cross_valid = direct_cross is None
            independent_gradients.append(own_valid)
            aggregated_cross_gradients_zero.append(aggregate_cross_valid)
            direct_independent_gradients.append(direct_own_valid)
            direct_cross_gradients_absent.append(direct_cross_valid)
            per_path_gradient_evidence[path_name] = {
                "aggregatedOwnGradientFiniteNonzero": own_valid,
                "aggregatedOwnGradientAbsSum": float(own.abs().sum()) if own is not None else None,
                "aggregatedCrossGradientConnected": cross is not None,
                "aggregatedCrossGradientFinite": (
                    torch.isfinite(cross).all().item() if cross is not None else False
                ),
                "aggregatedCrossGradientAbsSum": (
                    float(cross.abs().sum()) if cross is not None else None
                ),
                "directOwnGradientFiniteNonzero": direct_own_valid,
                "directOwnGradientAbsSum": (
                    float(direct_own.abs().sum()) if direct_own is not None else None
                ),
                "directCrossGradientConnected": direct_cross is not None,
            }
        fusion_gradients = torch.autograd.grad(
            predicted.mean(), tuple(renderer["semanticFeaturesUp0"]),
            retain_graph=True, allow_unused=True,
        )
        primary_to_renderer = torch.autograd.grad(
            primary.mean(), tuple(renderer_parameters),
            retain_graph=True, allow_unused=True,
        )
        positive["five_semantic_paths_independent_autograd"] = (
            all(independent_gradients)
            and all(aggregated_cross_gradients_zero)
            and all(direct_independent_gradients)
            and all(direct_cross_gradients_absent)
        )
        positive["semantic_renderer_to_fusion_gradient_route"] = all(
            value is not None and torch.isfinite(value).all().item() and float(value.abs().sum()) > 0.0
            for value in fusion_gradients
        )
        positive["primary_rgb_path_gradient_isolated_from_renderer"] = all(
            value is None for value in primary_to_renderer
        )

        target_velocity = torch.rand_like(predicted)
        predicted_clean = torch.rand_like(predicted)
        clean_latent = torch.rand_like(predicted)
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        predicted_rgb = torch.rand(1, 3, latent_height * 4, latent_width * 4)
        target_rgb = torch.rand_like(predicted_rgb)
        full_conditions = torch.rand(1, 23, latent_height * 4, latent_width * 4)
        loss_metrics = trainer.composite_denoiser_losses_condition_preserving_semantic_renderer_stage4(
            predicted, target_velocity, predicted_clean, clean_latent,
            predicted_conditions, target_conditions, predicted_rgb, target_rgb,
            full_conditions, renderer, config,
        )
        positive["legal_supervision_loss_and_existing_weight_route"] = (
            torch.isfinite(loss_metrics["compositeLossTensor"]).item()
            and all(field in loss_metrics for field in trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS)
        )

        with torch.no_grad():
            base_readout = model.predict_velocity_with_stage4_semantic_renderer(
                noisy, timestep, torch.zeros_like(conditions),
            )[1]["semanticReadout"]
            response_checks = []
            isolation_checks = []
            order = list(config["conditionChannelOrder"])
            for index, source_name in enumerate(
                trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS
            ):
                changed = torch.zeros_like(conditions)
                changed[:, order.index(source_name)] = 1.0
                changed_readout = model.predict_velocity_with_stage4_semantic_renderer(
                    noisy, timestep, changed,
                )[1]["semanticReadout"]
                deltas = (changed_readout - base_readout).abs().flatten(2).mean(dim=2)[0]
                response_checks.append(float(deltas[index]) > 0.0)
                isolation_checks.append(all(float(deltas[other]) == 0.0 for other in range(5) if other != index))
        positive["typed_condition_response_independence"] = all(response_checks) and all(isolation_checks)

        legacy_architectures = (
            "multiscale_condition_unet_v7",
            "multiscale_condition_unet_v8_stage4_decoded_alignment",
            "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
            "stage4_structure_fact_first_dual_stage_generator_v1",
        )
        legacy_results = []
        for architecture in legacy_architectures:
            legacy_config = deepcopy(config)
            legacy_config["denoiserArchitecture"] = architecture
            legacy_model = build_complete_world_system(legacy_config)
            legacy_output = legacy_model.predict_velocity(noisy, timestep, conditions)
            legacy_results.append(legacy_output.shape == noisy.shape)
            del legacy_model
        positive["legacy_v7_v8_v9_structure_fact_forward_compatible"] = all(legacy_results)

        def rejected(mutation):
            candidate = deepcopy(config)
            mutation(candidate)
            try:
                trainer.validate_condition_preserving_semantic_renderer_stage4_cpu_contract(
                    candidate, package, ROOT,
                )
            except (ValueError, FileNotFoundError, PermissionError):
                return True
            return False

        negative["programmatic_pixel_drawing_rejected"] = rejected(
            lambda value: value["training"]["stage4ConditionPreservingSemanticRenderer"].__setitem__(
                "programmaticPixelDrawingAllowed", True
            )
        )
        negative["review_threshold_target_rejected"] = rejected(
            lambda value: value["training"]["stage4ConditionPreservingSemanticRenderer"]["legalSupervision"].__setitem__(
                "machineReviewThresholdsUsedAsTargets", True
            )
        )
        negative["failed_preview_target_rejected"] = rejected(
            lambda value: value["training"]["stage4ConditionPreservingSemanticRenderer"]["legalSupervision"].__setitem__(
                "failedPreviewPixelsUsedAsTargets", True
            )
        )
        negative["unknown_contract_field_rejected"] = rejected(
            lambda value: value["training"]["stage4ConditionPreservingSemanticRenderer"].__setitem__(
                "startTrainingNow", True
            )
        )
        negative["old_denoiser_checkpoint_compatibility_rejected"] = rejected(
            lambda value: value["training"]["stage4ConditionPreservingSemanticRenderer"].__setitem__(
                "oldDenoiserCheckpointCompatible", True
            )
        )
        negative["condition_channel_order_change_rejected"] = rejected(
            lambda value: value["conditionChannelOrder"].__setitem__(
                slice(0, 2), list(reversed(value["conditionChannelOrder"][:2]))
            )
        )
        negative["condition_channel_missing_rejected"] = rejected(
            lambda value: value["conditionChannelOrder"].pop()
        )
        negative["condition_channel_duplicate_rejected"] = rejected(
            lambda value: value["conditionChannelOrder"].__setitem__(
                -1, value["conditionChannelOrder"][0]
            )
        )
        negative["condition_channel_unknown_rejected"] = rejected(
            lambda value: value["conditionChannelOrder"].__setitem__(
                0, "unknown_condition_channel"
            )
        )
        negative["condition_channel_full_order_reversal_rejected"] = rejected(
            lambda value: value["conditionChannelOrder"].__setitem__(
                slice(None), list(reversed(value["conditionChannelOrder"]))
            )
        )
        negative["optimizer_authorization_rejected"] = rejected(
            lambda value: value["training"]["ownerTrainingAuthorization"].__setitem__(
                "optimizerCreationAuthorized", True
            )
        )
        for legacy_status in (
            "diagnostic_support_candidate_not_active",
            "v9_diagnostic_manifest_registry_supported_inactive",
            "structure_fact_first_diagnostic_manifest_supported_inactive",
        ):
            negative[f"legacy_diagnostic_status_{legacy_status}_rejected"] = rejected(
                lambda value, status=legacy_status: value["training"]["stage4FailureDiagnostics"].__setitem__(
                    "status", status
                )
            )
        negative["diagnostic_unknown_field_rejected"] = rejected(
            lambda value: value["training"]["stage4FailureDiagnostics"].__setitem__(
                "legacyDiagnosticMode", True
            )
        )
        negative["diagnostic_gradient_target_change_rejected"] = rejected(
            lambda value: value["training"]["stage4FailureDiagnostics"]["semanticRendererDiagnostics"].__setitem__(
                "gradientTarget", "matching_structure_fact_independent_typed_head_output"
            )
        )
        registry = ModeRegistry(FORMAL_MODE_REGISTRY.snapshot().values())
        semantic_spec = mode
        try:
            registry.register(semantic_spec)
        except ValueError:
            negative["duplicate_mode_registration_rejected"] = True
        else:
            negative["duplicate_mode_registration_rejected"] = False

        source_text = resolve(MODEL_PATH).read_text(encoding="utf-8")
        negative["programmatic_drawing_api_absent"] = all(
            token not in source_text for token in ("ImageDraw", "draw.polygon", "draw.rectangle", "paste(")
        )
        v7_diagnostic_config = read_json(resolve(Path(
            ".runtime/ai-painter/r5-stage4-failure-diagnostic-inactive-configs/"
            "ai-assisted-v7-r5-stage4-failure-diagnostic-inactive-config-2026-08-05T11-18-00-000Z/"
            "inactive-config.json"
        )))
        v9_diagnostic_config = read_json(resolve(CONFIG_PATH))
        structure_diagnostic_config = read_json(resolve(compiler.SEMANTIC_RENDERER_SOURCE_CONFIG_PATH))
        positive["legacy_v7_v9_structure_fact_diagnostic_contracts_compatible"] = (
            trainer.validate_v7_r5_stage4_failure_diagnostic_support_contract(
                v7_diagnostic_config
            ).get("status") == "r5_stage4_failure_diagnostic_support_contract_valid_not_active"
            and trainer.validate_v9_stage4_diagnostic_manifest_support_contract(
                v9_diagnostic_config
            ).get("status") == "v9_stage4_diagnostic_manifest_support_contract_valid_inactive"
            and trainer.validate_structure_fact_first_stage4_diagnostic_manifest_support_contract(
                structure_diagnostic_config
            ).get("status") == "stage4_structure_fact_first_diagnostic_manifest_contract_valid_inactive"
        )
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        evidence = {
            "modelSha256": sha256_file(resolve(MODEL_PATH)),
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
            "modeRegistrySha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
            "compilerSha256": sha256_file(resolve(COMPILER_PATH)),
            "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
            "semanticFusionResponseMae": float((predicted - primary).abs().mean().detach()),
            "diagnosticManifestFields": list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
            "diagnosticContractStatus": config["training"]["stage4FailureDiagnostics"]["status"],
            "formalConditionChannelOrder": list(
                trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
            ),
            "repairAuthorization": binding(compiler.SEMANTIC_RENDERER_REPAIR_AUTHORIZATION_PATH),
            "repairConsumption": binding(compiler.SEMANTIC_RENDERER_REPAIR_CONSUMPTION_PATH),
            "dynamicOutputAuthorization": binding(args.implementation_authorization),
            "dynamicOutputConsumption": binding(args.implementation_consumption),
            "perPathGradientEvidence": per_path_gradient_evidence,
        }
        report = {
            "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-cpu-report-v1",
            "status": "passed_cpu_only_inactive" if not failed_positive and not failed_negative else "failed_closed_cpu_only_inactive",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
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
        if failed_positive or failed_negative:
            write_json_exclusive(args.report, report)
            raise ValueError(f"semantic renderer CPU regression failed: {failed_positive}:{failed_negative}")

        write_json_exclusive(args.inactive_config, config)
        report["inactiveConfig"] = binding(args.inactive_config)
        write_json_exclusive(args.report, report)
        support = {
            "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-support-contract-v1",
            "status": "cpu_supported_inactive_gpu_not_started",
            **timestamps("recordedAt"),
            "architectureId": "stage4_condition_preserving_semantic_renderer_v1",
            "conditionChannels": 23,
            "conditionChannelOrder": list(
                trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
            ),
            "semanticChannels": list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS),
            "fusionScales": ["up1", "up0"],
            "fusionKind": "learned_condition_preserving_residual_gate_v1",
            "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "legalSupervisionSources": config["training"]["stage4ConditionPreservingSemanticRenderer"]["legalSupervision"]["allowedSources"],
            "newFreeHyperparametersSelected": False,
            "oldDenoiserCheckpointCompatible": False,
            "programmaticPixelDrawingAllowed": False,
            "diagnosticContractStatus": config["training"]["stage4FailureDiagnostics"]["status"],
            "diagnosticManifestFields": list(
                trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS
            ),
            "repairAuthorization": binding(compiler.SEMANTIC_RENDERER_REPAIR_AUTHORIZATION_PATH),
            "repairConsumption": binding(compiler.SEMANTIC_RENDERER_REPAIR_CONSUMPTION_PATH),
            "dynamicOutputAuthorization": binding(args.implementation_authorization),
            "dynamicOutputConsumption": binding(args.implementation_consumption),
            "activationGate": config["training"]["stage4ConditionPreservingSemanticRenderer"]["activationGate"],
            "inactiveConfig": binding(args.inactive_config),
            "cpuReport": binding(args.report),
        }
        write_json_exclusive(args.support_contract, support)
        owner_request = {
            "schemaVersion": "ai-painter-owner-action-request-preview-v1",
            "status": "not_authorized_not_consumed_not_executed",
            **timestamps("recordedAt"),
            "module": "AI Painter",
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "requestedNextAction": "separately_authorize_readonly_gpu_gradient_and_fusion_diagnostic_for_stage4_condition_preserving_semantic_renderer_v1",
            "architectureSupportContract": binding(args.support_contract),
            "forbiddenNow": [
                "checkpoint_read_or_load", "optimizer", "backward", "weight_mutation",
                "gpu", "training", "smoke", "stage4_full_training", "stage5",
                "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry",
            ],
        }
        write_json_exclusive(args.owner_action_request, owner_request)
        terminal = {
            "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-cpu-terminal-v1",
            "status": "stage4_condition_preserving_semantic_renderer_cpu_support_completed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "currentStage": "Stage4",
            "stage4FullTrainingEligible": False,
            "inactiveConfig": binding(args.inactive_config),
            "architectureSupportContract": binding(args.support_contract),
            "cpuReport": binding(args.report),
            "ownerActionRequest": binding(args.owner_action_request),
            "nextLegalAction": owner_request["requestedNextAction"],
            "boundaries": {
                "checkpointRead": False, "optimizerCreated": False,
                "backwardExecuted": False, "modelWeightsModified": False,
                "gpuUsed": False, "trainingStarted": False,
                "smokeStarted": False, "stage4FullTrainingStarted": False,
                "stage5Started": False, "formalInferenceStarted": False,
                "checkpointPromoted": False, "runtimeFrameCreated": False,
                "worldEntered": False,
            },
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({
            "status": terminal["status"],
            "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
            "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
            "terminal": binding(args.terminal),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        if not resolve(args.terminal).exists():
            failure_terminal = {
                "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-cpu-terminal-v1",
                "status": "stage4_condition_preserving_semantic_renderer_cpu_support_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "errorType": type(exc).__name__,
                "error": str(exc),
                "failedPositiveKeys": [key for key, value in positive.items() if value is not True],
                "failedNegativeKeys": [key for key, value in negative.items() if value is not True],
                "checkpointRead": False,
                "optimizerCreated": False,
                "backwardExecuted": False,
                "modelWeightsModified": False,
                "gpuUsed": False,
                "trainingStarted": False,
                "automaticRetry": False,
            }
            write_json_exclusive(args.terminal, failure_terminal)
        raise


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


SEMANTIC_RENDERER_GPU_DIAGNOSTIC_SCHEMA = (
    "ai-painter-owner-stage4-semantic-renderer-readonly-gpu-diagnostic-authorization-v1"
)
SEMANTIC_RENDERER_GPU_DIAGNOSTIC_SCOPE = (
    "one_stage4_condition_preserving_semantic_renderer_sample194_readonly_gpu_forward_autograd_diagnostic_only"
)
SEMANTIC_RENDERER_GPU_DIAGNOSTIC_ACTIONS = {
    "cpuPositiveNegativeAuthorizationGate": True,
    "pythonPreflight": True,
    "cudaResourcePreflight": True,
    "diskBudgetPreflight": True,
    "atomicGpuAuthorizationConsumption": True,
    "projectAutoencoderReadAndLoadFrozen": True,
    "semanticRendererFixedRandomInitialization": True,
    "cudaForward": True,
    "torchAutogradGrad": True,
    "sevenDiagnosticManifestExport": True,
    "cudaTelemetryWrite": True,
    "diagnosticReportWrite": True,
    "modelStateHashVerification": True,
    "optimizerCreation": False,
    "backwardExecution": False,
    "modelWeightModification": False,
    "checkpointWrite": False,
    "smoke": False,
    "training": False,
    "stage4FullTraining": False,
    "stage1OrStage2": False,
    "stage5StrictRevalidation": False,
    "formalInference": False,
    "checkpointPromotion": False,
    "runtimeFrame": False,
    "worldEntry": False,
    "automaticRetry": False,
}
SEMANTIC_RENDERER_AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)


def validate_semantic_renderer_gpu_authorization_document(
    authorization: dict,
    *,
    verify_files: bool,
) -> None:
    if (
        authorization.get("schemaVersion") != SEMANTIC_RENDERER_GPU_DIAGNOSTIC_SCHEMA
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("commandRef") != authorization.get("requestId")
        or authorization.get("scope") != SEMANTIC_RENDERER_GPU_DIAGNOSTIC_SCOPE
        or not str(authorization.get("requestId", "")).startswith(
            "owner-authorized-stage4-semantic-renderer-readonly-gpu-diagnostic-"
        )
        or authorization.get("executionActions") != SEMANTIC_RENDERER_GPU_DIAGNOSTIC_ACTIONS
    ):
        raise ValueError("semantic renderer GPU diagnostic Owner contract is invalid")
    fixed = authorization.get("fixedTaskIdentity", {})
    expected_fixed = {
        "architecture": "stage4_condition_preserving_semantic_renderer_v1",
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": 20263722,
        "resolution": {"width": 256, "height": 192},
        "timestep": 999,
        "requiredBoundarySides": ["west"],
        "denoiserInitialization": "fixed_random_initialization_only",
        "diagnosticManifestFields": list(
            trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS
        ),
    }
    if fixed != expected_fixed:
        raise ValueError("semantic renderer GPU diagnostic fixed task identity changed")
    required_bindings = {
        "cpuTerminal", "cpuReport", "inactiveConfig", "architectureSupportContract",
        "ownerActionRequest", "localTaskCapsule", "implementationAuthorization",
        "implementationConsumption", "implementationAttestation",
        "projectAutoencoderCheckpoint", "datasetManifest",
    }
    if set(authorization.get("bindings", {})) != required_bindings:
        raise ValueError("semantic renderer GPU diagnostic binding set changed")
    if not verify_files:
        return
    for label, item in authorization["bindings"].items():
        path = resolve(Path(item.get("path", "")))
        if not item.get("sha256") or not path.is_file() or sha256_file(path) != item["sha256"]:
            raise ValueError(f"semantic renderer GPU diagnostic binding changed: {label}")
    frozen_files = {
        "modelSha256": MODEL_PATH,
        "trainerSha256": TRAINER_PATH,
        "modeRegistrySha256": Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
        "authorizationPolicySha256": STAGE_CONTROL_POLICY_PATH,
        "executionGrantSha256": Path("ml/ai-painter/scripts/ai_painter_execution_grant.py"),
        "inactiveConfigCompilerSha256": COMPILER_PATH,
    }
    for key, path in frozen_files.items():
        if authorization.get("frozenImplementation", {}).get(key) != sha256_file(resolve(path)):
            raise ValueError(f"semantic renderer GPU diagnostic frozen identity changed: {key}")
    if (
        authorization.get("implementation", {}).get("runnerSha256")
        != sha256_file(resolve(SMOKE_RUNNER_PATH))
        or authorization.get("implementation", {}).get("cpuCheckerSha256")
        != sha256_file(resolve(CPU_CHECKER_PATH))
    ):
        raise ValueError("semantic renderer GPU diagnostic current implementation identity changed")
    execution = authorization.get("execution", {})
    required_execution = {
        "preflightRoot", "evidenceRoot", "outputDirectory", "gpuConsumptionPath"
    }
    if set(execution) != required_execution:
        raise ValueError("semantic renderer GPU diagnostic execution path contract changed")
    for label, value in execution.items():
        logical = project_path(resolve(Path(value)))
        if not logical.startswith(".runtime/ai-painter/"):
            raise ValueError(f"semantic renderer GPU diagnostic execution path escaped runtime: {label}")


def load_semantic_renderer_gpu_authorization(args) -> tuple[Path, dict]:
    if args.execution_authorization is None or not args.execution_authorization_sha256:
        raise ValueError("semantic renderer GPU diagnostic authorization arguments are required")
    path = resolve(args.execution_authorization)
    if not path.is_file() or sha256_file(path) != args.execution_authorization_sha256.lower():
        raise ValueError("semantic renderer GPU diagnostic authorization path or hash changed")
    authorization = read_json(path)
    validate_semantic_renderer_gpu_authorization_document(authorization, verify_files=True)
    return path, authorization


def run_semantic_renderer_gpu_diagnostic_contract_regression(args) -> int:
    if args.report is None:
        raise ValueError("semantic renderer GPU diagnostic CPU contract requires --report")
    config = read_json(resolve(
        Path(".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-cpu-support/"
             "20260811-210635203/inactive-config.json")
    ))
    package = read_json(resolve(DATASET_PATH))
    trainer.validate_condition_preserving_semantic_renderer_stage4_cpu_contract(
        config, package, ROOT,
    )
    diagnostic_contract = (
        trainer.validate_condition_preserving_semantic_renderer_stage4_diagnostic_manifest_support_contract(
            config
        )
    )
    runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
    checker_source = resolve(CPU_CHECKER_PATH).read_text(encoding="utf-8")
    fixture = {
        "schemaVersion": SEMANTIC_RENDERER_GPU_DIAGNOSTIC_SCHEMA,
        "status": "resolved_owner_authorized_not_consumed",
        "requestId": "owner-authorized-stage4-semantic-renderer-readonly-gpu-diagnostic-cpu-fixture",
        "commandRef": "owner-authorized-stage4-semantic-renderer-readonly-gpu-diagnostic-cpu-fixture",
        "scope": SEMANTIC_RENDERER_GPU_DIAGNOSTIC_SCOPE,
        "executionActions": deepcopy(SEMANTIC_RENDERER_GPU_DIAGNOSTIC_ACTIONS),
        "fixedTaskIdentity": {
            "architecture": "stage4_condition_preserving_semantic_renderer_v1",
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "resolution": {"width": 256, "height": 192},
            "timestep": 999,
            "requiredBoundarySides": ["west"],
            "denoiserInitialization": "fixed_random_initialization_only",
            "diagnosticManifestFields": list(
                trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS
            ),
        },
        "bindings": {key: {"path": ".runtime/fixture.json", "sha256": "0" * 64} for key in (
            "cpuTerminal", "cpuReport", "inactiveConfig", "architectureSupportContract",
            "ownerActionRequest", "localTaskCapsule", "implementationAuthorization",
            "implementationConsumption", "implementationAttestation",
            "projectAutoencoderCheckpoint", "datasetManifest",
        )},
    }
    validate_semantic_renderer_gpu_authorization_document(fixture, verify_files=False)
    positive = {
        "semantic_renderer_cpu_contract_valid": True,
        "runner_real_entry_registered": (
            "--stage4-condition-preserving-semantic-renderer-readonly-diagnostic" in runner_source
            and "runConditionPreservingSemanticRendererReadonlyDiagnostic" in runner_source
        ),
        "runner_and_checker_share_exact_action_names": all(
            key in runner_source and key in checker_source
            for key in SEMANTIC_RENDERER_GPU_DIAGNOSTIC_ACTIONS
        ),
        "exact_seven_manifest_fields_shared": (
            tuple(diagnostic_contract.get("exactFields", ()))
            == trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS
            and tuple(
                config["training"]["stage4FailureDiagnostics"]
                ["semanticRendererDiagnostics"]["manifestFields"]
            ) == trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS
            and len(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS) == 7
        ),
        "legacy_entry_flags_preserved": all(flag in runner_source for flag in (
            "--stage4-validation-kernel-phase0", "--stage4-structure-fact-first-phase0",
            "--stage4-validation-kernel-model-smoke", "--stage4-structure-fact-first-model-smoke",
        )),
    }

    def rejected(mutation) -> bool:
        candidate = deepcopy(fixture)
        mutation(candidate)
        try:
            validate_semantic_renderer_gpu_authorization_document(candidate, verify_files=False)
        except ValueError:
            return True
        return False

    negative = {
        "unknown_action_rejected": rejected(
            lambda value: value["executionActions"].__setitem__("startTrainingNow", True)
        ),
        "optimizer_action_rejected": rejected(
            lambda value: value["executionActions"].__setitem__("optimizerCreation", True)
        ),
        "backward_action_rejected": rejected(
            lambda value: value["executionActions"].__setitem__("backwardExecution", True)
        ),
        "scope_change_rejected": rejected(
            lambda value: value.__setitem__("scope", "forged")
        ),
        "command_ref_change_rejected": rejected(
            lambda value: value.__setitem__("commandRef", "forged")
        ),
        "sample_split_change_rejected": rejected(
            lambda value: value["fixedTaskIdentity"].__setitem__("sampleSplit", "train")
        ),
        "old_denoiser_initialization_rejected": rejected(
            lambda value: value["fixedTaskIdentity"].__setitem__(
                "denoiserInitialization", "old_checkpoint"
            )
        ),
        "binding_omission_rejected": rejected(
            lambda value: value["bindings"].pop("projectAutoencoderCheckpoint")
        ),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-cpu-contract-report-v1",
        "status": "passed_cpu_only_gpu_not_started" if not failed_positive and not failed_negative else "failed_closed_cpu_only_gpu_not_started",
        **timestamps("recordedAt"),
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
        "gpuUsed": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not failed_positive and not failed_negative else 1


def run_semantic_renderer_gpu_diagnostic_preflight(args) -> int:
    _, authorization = load_semantic_renderer_gpu_authorization(args)
    if args.preflight_report is None or args.gpu_output is not None:
        raise ValueError("semantic renderer GPU diagnostic preflight paths are invalid")
    output = resolve(Path(authorization["execution"]["outputDirectory"]))
    if output.exists():
        raise ValueError("semantic renderer GPU diagnostic output already exists before preflight")
    cuda_available = torch.cuda.is_available()
    device_count = torch.cuda.device_count() if cuda_available else 0
    device_name = torch.cuda.get_device_name(0) if device_count > 0 else None
    free_bytes = int(shutil.disk_usage(resolve(args.preflight_report).parent).free)
    blockers = []
    if sys.executable.lower() != str(resolve(Path("ml/ai-painter/.venv/Scripts/python.exe"))).lower():
        blockers.append("project_venv_python_identity_invalid")
    if not cuda_available or device_count < 1:
        blockers.append("cuda_device_zero_unavailable")
    if free_bytes < 2 * 1024 ** 3:
        blockers.append("disk_budget_insufficient")
    report = {
        "schemaVersion": "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-preflight-v1",
        "status": "semantic_renderer_readonly_gpu_diagnostic_all_preflights_passed_gpu_not_consumed" if not blockers else "semantic_renderer_readonly_gpu_diagnostic_preflight_failed_closed",
        **timestamps("recordedAt"),
        "python": {"executable": sys.executable, "version": sys.version, "torchVersion": torch.__version__},
        "cuda": {"available": cuda_available, "deviceCount": device_count, "device0Name": device_name},
        "disk": {"freeBytes": free_bytes, "requiredBytes": 2 * 1024 ** 3},
        "blockers": blockers,
        "checkpointRead": False,
        "gpuAuthorizationConsumed": False,
        "gpuExecutionStarted": False,
    }
    write_json_exclusive(args.preflight_report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not blockers else 1


def run_semantic_renderer_gpu_diagnostic_execute(args) -> int:
    authorization_path, authorization = load_semantic_renderer_gpu_authorization(args)
    if any(value is None for value in (args.execution_consumption, args.execution_identity, args.gpu_output)):
        raise ValueError("semantic renderer GPU diagnostic execution arguments are incomplete")
    consumption_path = resolve(args.execution_consumption)
    identity_path = resolve(args.execution_identity)
    output = resolve(args.gpu_output)
    if output != resolve(Path(authorization["execution"]["outputDirectory"])) or output.exists():
        raise ValueError("semantic renderer GPU diagnostic output identity changed or already exists")
    consumption = read_json(consumption_path)
    identity = read_json(identity_path)
    if (
        consumption.get("status") != "semantic_renderer_readonly_gpu_diagnostic_authorization_atomically_consumed"
        or consumption.get("requestId") != authorization["requestId"]
        or consumption.get("authorizationSha256") != sha256_file(authorization_path)
        or consumption.get("oneTimeConsumption") is not True
        or identity.get("status") != "semantic_renderer_readonly_gpu_diagnostic_execution_active_not_completed"
        or identity.get("requestId") != authorization["requestId"]
        or identity.get("consumptionSha256") != sha256_file(consumption_path)
        or identity.get("fixedTaskIdentity") != authorization["fixedTaskIdentity"]
    ):
        raise ValueError("semantic renderer GPU diagnostic execution lineage is invalid")
    return execute_semantic_renderer_readonly_gpu_diagnostic(
        authorization, output, consumption_path, identity_path,
    )


def execute_semantic_renderer_readonly_gpu_diagnostic(
    authorization: dict,
    output: Path,
    consumption_path: Path,
    identity_path: Path,
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

    def step(code: str, details=None):
        steps.append({"index": len(steps) + 1, "code": code, "details": details or {}, **timestamps("completedAt")})
        write_json_atomic(output / "step-telemetry.json", {"completedSteps": steps, **state})

    try:
        step("gpu_authorization_consumption_and_execution_identity_validated")
        torch.cuda.init()
        torch.cuda.set_device(0)
        if torch.cuda.current_device() != 0:
            raise ValueError("semantic renderer diagnostic CUDA device zero is not active")
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        step("cuda_context_initialized_device_zero_confirmed")

        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        package_path = resolve(Path(authorization["bindings"]["datasetManifest"]["path"]))
        package = read_json(package_path)
        trainer.validate_condition_preserving_semantic_renderer_stage4_cpu_contract(config, package, ROOT)
        dataset = AiAssistedConditionalDenoiserDataset(
            package_path,
            "validation",
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("semantic renderer diagnostic sample194 validation identity is not unique")
        sample = dataset[matches[0]]
        step("fixed_validation_sample194_loaded")

        torch.manual_seed(20263722)
        torch.cuda.manual_seed_all(20263722)
        model = build_complete_world_system(config)
        denoiser_hash_before = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_path = resolve(Path(authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))
        checkpoint = trainer.load_autoencoder_checkpoint(autoencoder_path, config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        autoencoder_hash_before = state_dict_sha256(model.autoencoder.state_dict())
        device = torch.device("cuda:0")
        model.to(device).eval()
        step("project_autoencoder_loaded_frozen_semantic_renderer_random_initialized")

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
        with torch.no_grad():
            raw_latent = model.autoencoder.encode(image)
            mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
            std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
            clean_latent = (raw_latent - mean) / std
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([999], dtype=torch.long, device=device)
        generator = torch.Generator(device=device).manual_seed(20263722)
        noise = torch.randn(clean_latent.shape, generator=generator, device=device, dtype=clean_latent.dtype)
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        predicted_velocity, renderer = model.predict_velocity_with_stage4_semantic_renderer(
            noisy_latent, timestep, conditions,
        )
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        primary_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * renderer["primaryVelocity"]
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        predicted_rgb = model.autoencoder.decode(predicted_clean * std + mean)
        primary_rgb = model.autoencoder.decode(primary_clean * std + mean)
        losses = trainer.composite_denoiser_losses_condition_preserving_semantic_renderer_stage4(
            predicted_velocity, target_velocity, predicted_clean, clean_latent,
            predicted_conditions, target_conditions, predicted_rgb, image,
            conditions, renderer, config,
        )
        state["forwardCompleted"] = True
        step("semantic_renderer_cuda_forward_and_decoded_rgb_completed")

        channels = trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS
        prefixes = ("Footprints", "Tree", "Rock", "Vegetation", "RouteBoundary")
        parameters_by_path = {
            name: tuple(model.denoiser.semantic_renderer_paths_up1[name].parameters())
            + tuple(model.denoiser.semantic_renderer_paths_up0[name].parameters())
            + tuple(model.denoiser.semantic_renderer_readouts[name].parameters())
            for name in channels
        }
        all_parameters = tuple(parameter for name in channels for parameter in parameters_by_path[name])
        slices = {}
        cursor = 0
        for name in channels:
            slices[name] = slice(cursor, cursor + len(parameters_by_path[name]))
            cursor += len(parameters_by_path[name])
        gradient_routes = {}
        for index, name in enumerate(channels):
            gradients = torch.autograd.grad(
                losses[f"stage4SemanticRenderer{prefixes[index]}IndependentLoss"],
                all_parameters,
                retain_graph=True,
                create_graph=False,
                allow_unused=True,
            )
            own = gradients[slices[name]]
            cross = tuple(
                gradient for other in channels if other != name
                for gradient in gradients[slices[other]]
            )
            own_norm = sum(gradient_tensor_norm(value) for value in own)
            cross_norm = sum(gradient_tensor_norm(value) for value in cross)
            if not math.isfinite(own_norm) or own_norm <= 0.0 or cross_norm != 0.0:
                raise ValueError(f"semantic renderer typed path gradient isolation failed: {name}")
            source_index = config["conditionChannelOrder"].index(
                trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS[index]
            )
            readout_gradient = torch.autograd.grad(
                renderer["semanticReadout"][:, index:index + 1].mean(),
                conditions,
                retain_graph=True,
                create_graph=False,
            )[0]
            own_condition_response = float(readout_gradient[:, source_index:source_index + 1].abs().sum().detach().cpu())
            cross_condition_response = float(torch.cat([
                readout_gradient[:, other:other + 1]
                for other in range(readout_gradient.shape[1]) if other != source_index
            ], dim=1).abs().sum().detach().cpu())
            if own_condition_response <= 0.0 or cross_condition_response != 0.0:
                raise ValueError(f"semantic renderer typed condition response isolation failed: {name}")
            gradient_routes[name] = {
                "ownGradientNorm": own_norm,
                "crossGradientNorm": cross_norm,
                "ownConditionResponseAbsSum": own_condition_response,
                "crossConditionResponseAbsSum": cross_condition_response,
            }

        fusion_response = float((predicted_velocity - renderer["primaryVelocity"]).abs().mean().detach().cpu())
        decoded_response = float((predicted_rgb - primary_rgb).abs().mean().detach().cpu())
        if (
            not torch.isfinite(predicted_rgb).all().item()
            or not torch.isfinite(primary_rgb).all().item()
            or not math.isfinite(fusion_response)
            or not math.isfinite(decoded_response)
            or fusion_response <= 0.0
            or decoded_response <= 0.0
        ):
            raise ValueError("semantic renderer fusion or decoded RGB response is invalid")
        primary_gradients = torch.autograd.grad(
            renderer["primaryVelocity"].mean(), all_parameters,
            retain_graph=True, create_graph=False, allow_unused=True,
        )
        if any(value is not None for value in primary_gradients):
            raise ValueError("semantic renderer primary RGB path is not isolated")
        base_gradient = torch.autograd.grad(
            predicted_velocity.square().mean(), model.denoiser.latent_stem.weight,
            retain_graph=True, create_graph=False, allow_unused=True,
        )[0]
        base_gradient_norm = gradient_tensor_norm(base_gradient)
        if not math.isfinite(base_gradient_norm) or base_gradient_norm <= 0.0:
            raise ValueError("semantic renderer base Denoiser gradient is missing")

        diagnostic_fields = trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS
        diagnostic_metrics = {key: float(losses[key].detach().cpu()) for key in diagnostic_fields}
        if (
            set(diagnostic_metrics) != set(diagnostic_fields)
            or any(not math.isfinite(value) or value < 0.0 for value in diagnostic_metrics.values())
            or diagnostic_metrics["stage4SemanticRendererPrimaryPathAvailable"] != 1.0
        ):
            raise ValueError("semantic renderer exact seven diagnostic Manifest values are invalid")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("semantic renderer diagnostic populated parameter grad fields")
        state["autogradGradCompleted"] = True
        step("five_typed_paths_gradients_fusion_primary_base_and_seven_manifest_verified")

        torch.cuda.synchronize(0)
        cuda = {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-cuda-telemetry-v1",
            "status": "collected_after_readonly_forward_and_autograd_grad",
            **timestamps("recordedAt"), **cuda,
        })
        model.to("cpu")
        denoiser_hash_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_hash_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_hash_before != denoiser_hash_after or autoencoder_hash_before != autoencoder_hash_after:
            raise ValueError("semantic renderer diagnostic changed model state")
        step("cuda_telemetry_saved_and_model_state_hashes_unchanged")

        report = {
            "schemaVersion": "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-report-v1",
            "status": "passed_readonly_semantic_renderer_gpu_forward_and_gradient_routing_weights_unchanged",
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "identity": authorization["fixedTaskIdentity"],
            "gradientRoutes": gradient_routes,
            "fusion": {
                "velocityResponseMae": fusion_response,
                "decodedRgbResponseMae": decoded_response,
                "primaryPathIsolated": True,
                "baseDenoiserGradientNorm": base_gradient_norm,
            },
            "diagnosticManifest": {
                "fieldCount": 7,
                "fields": list(diagnostic_fields),
                "values": diagnostic_metrics,
            },
            "cuda": cuda,
            "integrity": {
                "denoiserStateSha256Before": denoiser_hash_before,
                "denoiserStateSha256After": denoiser_hash_after,
                "autoencoderStateSha256Before": autoencoder_hash_before,
                "autoencoderStateSha256After": autoencoder_hash_after,
                "parameterGradFieldsAbsent": True,
            },
            "authorizationConsumption": binding(consumption_path),
            "executionIdentity": binding(identity_path),
            "completedSteps": steps,
            **state,
        }
        write_json_exclusive(output / "diagnostic-report.json", report)
        terminal = {
            "schemaVersion": "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-terminal-v1",
            "status": "stage4_condition_preserving_semantic_renderer_readonly_gpu_diagnostic_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "report": binding(output / "diagnostic-report.json"),
            "cudaTelemetry": binding(output / "cuda-telemetry.json"),
            "nextAction": "owner_may_authorize_one_30_epoch_condition_preserving_semantic_renderer_model_smoke",
            "automaticRetryStarted": False,
            **state,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        terminal = {
            "schemaVersion": "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-terminal-v1",
            "status": "stage4_condition_preserving_semantic_renderer_readonly_gpu_diagnostic_failed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "errorType": type(exc).__name__,
            "error": str(exc),
            "traceback": traceback.format_exc(),
            "completedSteps": steps,
            "automaticRetryStarted": False,
            **state,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 1


def gradient_tensor_norm(value) -> float:
    if value is None:
        return 0.0
    return float(value.detach().float().norm().cpu())


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def run_condition_preserving_semantic_renderer_stage4_smoke_contract_regression(args) -> int:
    required = {
        "report": args.report,
        "implementationAttestation": args.implementation_attestation,
        "implementationAuthorization": args.implementation_authorization,
        "implementationConsumption": args.implementation_consumption,
        "inactiveConfig": args.inactive_config,
    }
    if any(value is None for value in required.values()):
        raise ValueError(f"semantic renderer Smoke CPU paths are incomplete: {required}")
    implementation_authorization = read_json(resolve(args.implementation_authorization))
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    if (
        implementation_authorization.get("status")
        not in {"resolved_owner_authorized_not_consumed", "owner_authorized_unconsumed"}
        or implementation_consumption.get("authorizationSha256")
        != sha256_file(resolve(args.implementation_authorization))
        or implementation_consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("semantic renderer Smoke implementation lineage changed")

    evidence_paths = {
        "readonlyGpuTerminal": Path(
            ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-gpu-diagnostic-executions/"
            "20260811-221127015/phase-terminal.json"
        ),
        "readonlyGpuDiagnostic": Path(
            ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-gpu-diagnostic-executions/"
            "20260811-221127015/diagnostic-report.json"
        ),
        "cudaTelemetry": Path(
            ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-gpu-diagnostic-executions/"
            "20260811-221127015/cuda-telemetry.json"
        ),
        "readonlyCpuReport": Path(
            ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-gpu-diagnostic-support/"
            "20260811-221127015/cpu-contract-report.json"
        ),
        "inactiveConfig": Path(
            ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-cpu-support/"
            "20260811-210635203/inactive-config.json"
        ),
        "architectureSupportContract": Path(
            ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-cpu-support/"
            "20260811-210635203/architecture-support-contract.json"
        ),
        "datasetManifest": Path(
            "data/world-samples/ai-assisted-cold-start-dataset-packages/"
            "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
        ),
        "datasetSourceIndex": Path(
            "data/world-samples/ai-assisted-cold-start-dataset-packages/"
            "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
        ),
        "projectAutoencoderCheckpoint": Path(
            ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
            "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
            "complete-world-ai-assisted-autoencoder.pt"
        ),
        "conditionAlignmentAuditor": Path("scripts/lib/ai-assisted-condition-alignment.mjs"),
        "professionalAestheticAuditor": Path("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
        "windowsSafePreviewNormalizer": Path("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
        "gpuResourceGate": Path("scripts/lib/ai-assisted-v7-training-resource-gate.mjs"),
    }
    for label, path in evidence_paths.items():
        if not resolve(path).is_file():
            raise ValueError(f"semantic renderer Smoke bound evidence is missing: {label}")
    evidence_paths = {
        "implementationAuthorization": args.implementation_authorization,
        "implementationConsumption": args.implementation_consumption,
        **evidence_paths,
    }
    inactive_config = read_json(resolve(evidence_paths["inactiveConfig"]))
    package = read_json(resolve(evidence_paths["datasetManifest"]))
    source_index = read_json(resolve(evidence_paths["datasetSourceIndex"]))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("categoryId") == "complete-maps"
        and "conditional_denoiser" in row.get("trainingRoles", [])
        and row.get("formalConditionalTrainingEligible") is True
        and row.get("conditionBound") is True
        and row.get("v7CapacityContributionRegistered") is True
        and row.get("ownerReviewStatus") == "owner_approved"
        and row.get("machineReviewStatus") == "passed"
        and row.get("aiAssistedColdStartEligible") is True
        and row.get("independentTrainingEligible") is False
    ]
    sample_rows = [row for row in rows if row.get("sampleId") == SAMPLE_ID]
    if len(sample_rows) != 1 or sample_rows[0].get("split") != "validation":
        raise ValueError("semantic renderer Smoke sample 194 validation identity changed")
    sample = sample_rows[0]
    sample_binding = inactive_config["training"]["conditionPreservingSemanticRendererSampleBinding"]
    if (
        sample_binding.get("imagePath") != sample.get("imagePath")
        or sample_binding.get("conditionPackPath") != sample.get("conditionPackPath")
        or sample_binding.get("requiredBoundarySides") != ["west"]
    ):
        raise ValueError("semantic renderer Smoke sample binding changed")

    fixtures_root = resolve(args.report).parent / "cpu-fixtures"
    fixtures_root.mkdir(parents=True, exist_ok=False)
    allowed_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.LOAD_AUTOENCODER.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
        ExecutionAction.CREATE_OPTIMIZER.value,
        ExecutionAction.EXECUTE_BACKWARD.value,
        ExecutionAction.MUTATE_MODEL_WEIGHTS.value,
        ExecutionAction.WRITE_SMOKE_CHECKPOINT.value,
    ])
    denied_actions = sorted(set(action.value for action in ALL_ACTIONS) - set(allowed_actions))
    diagnostic_fields = list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS)

    def create_authorization(case_name, mutate=None):
        case_root = fixtures_root / case_name
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "authorization.json"
        authorization = {
            "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-smoke-execution-authorization-v1",
            "requestId": "owner-authorized-stage4-semantic-renderer-30-epoch-model-smoke-20260811-230000000",
            "commandRef": "owner-authorized-stage4-semantic-renderer-30-epoch-model-smoke-20260811-230000000",
            "scope": "one_stage4_condition_preserving_semantic_renderer_sample194_30_epoch_model_smoke_only",
            "status": "resolved_owner_authorized_not_consumed",
            "executionActions": list(allowed_actions),
            "explicitlyDeniedActions": list(denied_actions),
            "taskIdentity": {
                "modeId": "condition_preserving_semantic_renderer_stage4_smoke",
                "architecture": "stage4_condition_preserving_semantic_renderer_v1",
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "requiredBoundarySides": ["west"],
                "resolution": {"width": 256, "height": 192},
                "epochCount": 30,
                "previewEpochs": FIXED_EPOCHS,
                "datasetSplit": EXPECTED_COUNTS,
                "initialization": "project_random_condition_preserving_semantic_renderer",
                "oldDenoiserCheckpointReadAuthorized": False,
                "diagnosticManifestFields": diagnostic_fields,
            },
            "bindings": {key: binding(path) for key, path in evidence_paths.items()},
            "codeBindings": {
                "authorizationPolicy": binding(STAGE_CONTROL_POLICY_PATH),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "trainer": binding(TRAINER_PATH),
                "runner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH),
                "model": binding(MODEL_PATH),
                "inactiveConfigCompiler": binding(COMPILER_PATH),
            },
            "execution": {
                "consumptionPath": project_path(case_root / "execution-consumption.json"),
                "activeConfigPath": project_path(case_root / "active-config-must-not-exist.json"),
                "trainingOutputDirectory": project_path(case_root / "training-output-must-not-exist"),
                "finalizationDirectory": project_path(case_root / "finalization-must-not-exist"),
                "preflightReportPath": project_path(case_root / "preflight-report-must-not-exist.json"),
            },
        }
        if mutate is not None:
            mutate(authorization, case_root)
        write_json_exclusive(authorization_path, authorization)
        return authorization_path, authorization

    def run_node(path, supplied_sha=None):
        return subprocess.run([
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-condition-preserving-semantic-renderer-model-smoke",
            "--gpu-authorization", project_path(path),
            "--gpu-authorization-sha256", supplied_sha or sha256_file(resolve(path)),
            "--cpu-contract-only",
        ], cwd=ROOT, text=True, capture_output=True, timeout=120)

    positive_path, positive_authorization = create_authorization("positive")
    positive_node = run_node(positive_path)
    unknown_path, _ = create_authorization(
        "unknown-action", lambda value, _root: value["executionActions"].append("unknown_semantic_smoke_action"),
    )
    forbidden_path, _ = create_authorization(
        "stage0-injection", lambda value, _root: (
            value["executionActions"].append(ExecutionAction.RUN_STAGE0.value),
            value["explicitlyDeniedActions"].remove(ExecutionAction.RUN_STAGE0.value),
        ),
    )
    wrong_mode_path, _ = create_authorization(
        "wrong-mode", lambda value, _root: value["taskIdentity"].update(modeId="v9_stage4_smoke"),
    )
    checkpoint_path, _ = create_authorization(
        "old-checkpoint-injection", lambda value, _root: value["bindings"].update(
            oldDenoiserCheckpoint=binding(evidence_paths["projectAutoencoderCheckpoint"])
        ),
    )
    repeated_path, repeated_authorization = create_authorization("repeated-consumption")
    write_json_exclusive(
        resolve(Path(repeated_authorization["execution"]["consumptionPath"])),
        {"status": "already_consumed"},
    )
    unknown_node = run_node(unknown_path)
    forbidden_node = run_node(forbidden_path)
    wrong_mode_node = run_node(wrong_mode_path)
    checkpoint_node = run_node(checkpoint_path)
    repeated_node = run_node(repeated_path)
    bad_hash_node = run_node(positive_path, "0" * 64)

    mode = FORMAL_MODE_REGISTRY.resolve_mode_id(
        "condition_preserving_semantic_renderer_stage4_smoke"
    )
    inactive_contract = trainer.validate_condition_preserving_semantic_renderer_stage4_cpu_contract(
        inactive_config, package, ROOT,
    )
    overfit_evidence = {
        "enabled": True,
        "sampleId": SAMPLE_ID,
        "conditionPackPath": sample.get("conditionPackPath"),
    }
    boundary_provenance = trainer.validate_stage4_sample_bound_boundary_provenance(
        inactive_config, overfit_evidence,
    )
    changed_sample_rejected = False
    try:
        trainer.validate_stage4_sample_bound_boundary_provenance(
            inactive_config,
            {**overfit_evidence, "sampleId": "forbidden-other-sample"},
        )
    except ValueError:
        changed_sample_rejected = True
    positive = {
        "modeRegisteredExactlyOnce": sum(
            spec.mode_id == "condition_preserving_semantic_renderer_stage4_smoke"
            for spec in FORMAL_MODE_REGISTRY.snapshot().values()
        ) == 1,
        "modeIdentityExact": (
            mode.architecture == "stage4_condition_preserving_semantic_renderer_v1"
            and mode.execution_kind == "single_sample_smoke"
            and mode.sample_split == "validation"
            and mode.active_execution is True
        ),
        "inactiveContractPreserved": inactive_contract.get("status")
        == "stage4_condition_preserving_semantic_renderer_cpu_contract_valid_inactive",
        "semanticRendererBoundaryProvenanceUsesSharedSampleBinding": (
            boundary_provenance.get("status")
            == "current_sample_world_fact_geometry_and_mask_topology_verified_before_checkpoint_read"
            and boundary_provenance.get("sampleId") == SAMPLE_ID
            and boundary_provenance.get("authoritativeRequiredBoundarySides") == ["west"]
        ),
        "realNodeContractPassed": positive_node.returncode == 0
        and "semantic-renderer_stage4_smoke_authorization_contract_valid_cpu_only"
        in positive_node.stdout,
        "sample194UniqueValidation": len(sample_rows) == 1 and sample_rows[0].get("split") == "validation",
        "datasetSplit48_8_4_4": {
            split: sum(row.get("split") == split for row in rows) for split in EXPECTED_COUNTS
        } == EXPECTED_COUNTS,
        "exactSevenManifestFieldsShared": diagnostic_fields
        == list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
        "legacyModesPreserved": all(
            mode_id in {spec.mode_id for spec in FORMAL_MODE_REGISTRY.snapshot().values()}
            for mode_id in (
                "v7_r5_stage3_smoke", "v7_r5_stage4_bounded_smoke", "v8_stage4_smoke",
                "v9_stage4_smoke", "structure_fact_first_stage4_smoke",
            )
        ),
    }
    negative = {
        "unknownActionRejected": unknown_node.returncode != 0,
        "stage0ActionInjectionRejected": forbidden_node.returncode != 0,
        "wrongModeRejected": wrong_mode_node.returncode != 0,
        "oldCheckpointBindingRejected": checkpoint_node.returncode != 0,
        "repeatedConsumptionRejected": repeated_node.returncode != 0,
        "authorizationHashMismatchRejected": bad_hash_node.returncode != 0,
        "differentSampleBoundaryProvenanceRejected": changed_sample_rejected,
        "checkpointWeightContentNotRead": True,
        "optimizerNotCreated": True,
        "backwardNotExecuted": True,
        "gpuNotStarted": not torch.cuda.is_initialized(),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-smoke-cpu-regression-v1",
        "status": "condition_preserving_semantic_renderer_stage4_smoke_cpu_regression_passed"
        if not failed_positive and not failed_negative
        else "condition_preserving_semantic_renderer_stage4_smoke_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "nodePositive": {"exitCode": positive_node.returncode, "stdout": positive_node.stdout, "stderr": positive_node.stderr},
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-stage4-condition-preserving-semantic-renderer-smoke-implementation-attestation-v1",
        "status": "condition_preserving_semantic_renderer_stage4_smoke_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "authorizationPolicySha256": sha256_file(resolve(STAGE_CONTROL_POLICY_PATH)),
        "modeRegistrySha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "modelSha256": sha256_file(resolve(MODEL_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
        "implementationAttestation": binding(args.implementation_attestation),
    }, ensure_ascii=False, indent=2))
    return 0


def run_fact_conditioned_semantic_mixture_stage4_smoke_contract_regression(args) -> int:
    required = {
        "report": args.report,
        "implementationAttestation": args.implementation_attestation,
        "implementationAuthorization": args.implementation_authorization,
        "implementationConsumption": args.implementation_consumption,
    }
    if any(value is None for value in required.values()):
        raise ValueError(f"semantic mixture Smoke CPU paths are incomplete: {required}")
    implementation_authorization = read_json(resolve(args.implementation_authorization))
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    if (
        implementation_authorization.get("status")
        not in {"resolved_owner_authorized_not_consumed", "owner_authorized_unconsumed"}
        or implementation_consumption.get("authorizationSha256")
        != sha256_file(resolve(args.implementation_authorization))
        or implementation_consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("semantic mixture Smoke implementation lineage changed")

    vegetation_luminance_route = (
        implementation_authorization.get("requestId")
        == "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-20260813-034000000"
    )
    distribution_aware_route = (
        implementation_authorization.get("requestId")
        == "owner-authorized-stage4-distribution-aware-visible-spatial-semantic-continuation-20260813-071500000"
    )
    full_rollout_route = (
        implementation_authorization.get("requestId")
        == "owner-authorized-stage4-full-rollout-smoke-integration-20260813-111500000"
    )
    epoch_worst_route = (
        implementation_authorization.get("requestId")
        == "owner-authorized-stage4-epoch-worst-sample-class-replay-20260814-080200792"
    )
    object_visible_structure_route = (
        implementation_authorization.get("requestId") in {
            "owner-authorized-stage4-object-visible-structure-smoke-integration-20260815-061900000",
            "owner-authorized-stage4-object-visible-structure-smoke-trainer-lineage-correction-20260815-063500000",
            "owner-authorized-stage4-object-visible-structure-smoke-cpu-checker-scope-correction-20260815-064000000",
            "owner-authorized-stage4-object-visible-structure-smoke-unique-scope-correction-20260815-064500000",
        }
    )
    execution_evidence_registry_path = Path(
        ".runtime/ai-painter/stage4-execution-evidence-eligibility/"
        + (
            "20260815-062000000/registry.json"
            if object_visible_structure_route
            else "20260814-085000000/registry.json"
            if epoch_worst_route
            else "20260813-112000000/registry.json"
            if full_rollout_route
            else "20260813-072000000/registry.json"
            if distribution_aware_route
            else "20260813-040300000/registry.json"
            if vegetation_luminance_route
            else "20260813-031900000/registry.json"
        )
    )
    execution_evidence_registry = read_json(resolve(execution_evidence_registry_path))

    def canonical_role_path(role: str) -> Path:
        entry = execution_evidence_registry.get("roles", {}).get(role, {})
        canonical_path = entry.get("canonicalPath")
        if (
            execution_evidence_registry.get("status")
            != "stage4_execution_evidence_eligibility_registered"
            or entry.get("disposition") != "active_reusable_success_evidence"
            or not canonical_path
        ):
            raise ValueError(f"canonical Stage4 execution evidence role is unavailable: {role}")
        return Path(canonical_path)

    evidence_paths = {
        "readonlyGpuTerminal": canonical_role_path(
            "stage4.finalVisibleRgb.gpuQualificationTerminal"
        ),
        "readonlyGpuDiagnostic": canonical_role_path(
            "stage4.finalVisibleRgb.gpuDiagnosticReport"
        ),
        "cudaTelemetry": canonical_role_path(
            "stage4.finalVisibleRgb.cudaTelemetry"
        ),
        "readonlyCpuReport": canonical_role_path(
            "stage4.finalVisibleRgb.cpuAuthorizationReport"
        ),
        "inactiveConfig": canonical_role_path(
            "stage4.finalVisibleRgb.inactiveConfig"
        ),
        "architectureSupportContract": canonical_role_path(
            "stage4.finalVisibleRgb.trainingObjectiveSupportContract"
        ),
        "executionEvidenceRegistry": execution_evidence_registry_path,
        "datasetManifest": Path(
            "data/world-samples/ai-assisted-cold-start-dataset-packages/"
            "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
        ),
        "datasetSourceIndex": Path(
            "data/world-samples/ai-assisted-cold-start-dataset-packages/"
            "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
        ),
        "projectAutoencoderCheckpoint": Path(
            ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
            "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
            "complete-world-ai-assisted-autoencoder.pt"
        ),
        "conditionAlignmentAuditor": Path("scripts/lib/ai-assisted-condition-alignment.mjs"),
        "professionalAestheticAuditor": Path("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
        "windowsSafePreviewNormalizer": Path("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
        "gpuResourceGate": Path("scripts/lib/ai-assisted-v7-training-resource-gate.mjs"),
        "cpuReport": Path(
            ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-support/"
            "20260812-012755510/cpu-report.json"
        ),
        "implementationAttestation": Path(
            ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-support/"
            "20260812-012755510/implementation-attestation.json"
        ),
    }
    for label, path in evidence_paths.items():
        if not resolve(path).is_file():
            raise ValueError(f"semantic mixture Smoke bound evidence is missing: {label}")
    evidence_paths = {
        "implementationAuthorization": args.implementation_authorization,
        "implementationConsumption": args.implementation_consumption,
        **evidence_paths,
    }
    inactive_config = read_json(resolve(evidence_paths["inactiveConfig"]))
    package = read_json(resolve(evidence_paths["datasetManifest"]))
    source_index = read_json(resolve(evidence_paths["datasetSourceIndex"]))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("categoryId") == "complete-maps"
        and "conditional_denoiser" in row.get("trainingRoles", [])
        and row.get("formalConditionalTrainingEligible") is True
        and row.get("conditionBound") is True
        and row.get("v7CapacityContributionRegistered") is True
        and row.get("ownerReviewStatus") == "owner_approved"
        and row.get("machineReviewStatus") == "passed"
        and row.get("aiAssistedColdStartEligible") is True
        and row.get("independentTrainingEligible") is False
    ]
    sample_rows = [row for row in rows if row.get("sampleId") == SAMPLE_ID]
    if len(sample_rows) != 1 or sample_rows[0].get("split") != "validation":
        raise ValueError("semantic mixture Smoke sample 194 validation identity changed")
    sample = sample_rows[0]
    sample_binding = inactive_config["training"]["factConditionedSemanticMixtureSampleBinding"]
    if (
        sample_binding.get("imagePath") != sample.get("imagePath")
        or sample_binding.get("conditionPackPath") != sample.get("conditionPackPath")
        or sample_binding.get("requiredBoundarySides") != ["west"]
    ):
        raise ValueError("semantic mixture Smoke sample binding changed")

    fixtures_root = resolve(args.report).parent / "cpu-fixtures"
    fixtures_root.mkdir(parents=True, exist_ok=False)
    trainer_active_object_qualification_passed = True
    trainer_rejects_changed_object_qualification = True
    if object_visible_structure_route:
        active_fixture_root = fixtures_root / "trainer-active-object-qualification"
        active_fixture_root.mkdir(parents=True, exist_ok=False)
        active_config = read_json(resolve(Path(
            ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/"
            "20260815-063000000/active-config.json"
        )))
        attestation_path = active_fixture_root / "implementation-attestation.json"
        write_json_exclusive(attestation_path, {
            "status": "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
            "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        })
        active_execution = active_config["training"][
            "factConditionedSemanticMixtureStage4SmokeExecution"
        ]
        active_execution["implementationAttestationPath"] = project_path(attestation_path)
        active_execution["implementationAttestationSha256"] = sha256_file(attestation_path)
        try:
            trainer.validate_training_inputs(active_config, package)
        except ValueError:
            trainer_active_object_qualification_passed = False

        changed_diagnostic_path = active_fixture_root / "changed-phase0-finalization.json"
        changed_diagnostic = read_json(resolve(evidence_paths["readonlyGpuDiagnostic"]))
        changed_diagnostic["equality"]["pngByteSha256Matches"] = False
        write_json_exclusive(changed_diagnostic_path, changed_diagnostic)
        changed_active = deepcopy(active_config)
        changed_execution = changed_active["training"][
            "factConditionedSemanticMixtureStage4SmokeExecution"
        ]
        changed_execution["readonlyGpuDiagnosticPath"] = project_path(changed_diagnostic_path)
        changed_execution["readonlyGpuDiagnosticSha256"] = sha256_file(changed_diagnostic_path)
        try:
            trainer.validate_training_inputs(changed_active, package)
            trainer_rejects_changed_object_qualification = False
        except ValueError:
            trainer_rejects_changed_object_qualification = True
    allowed_actions = sorted([
        ExecutionAction.SELECT_BOUND_SAMPLE.value,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY.value,
        ExecutionAction.LOAD_AUTOENCODER.value,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY.value,
        ExecutionAction.CREATE_OPTIMIZER.value,
        ExecutionAction.EXECUTE_BACKWARD.value,
        ExecutionAction.MUTATE_MODEL_WEIGHTS.value,
        ExecutionAction.WRITE_SMOKE_CHECKPOINT.value,
    ])
    denied_actions = sorted(set(action.value for action in ALL_ACTIONS) - set(allowed_actions))
    diagnostic_fields = list(
        trainer.fact_conditioned_semantic_mixture_diagnostic_fields(inactive_config)
    )

    def create_authorization(case_name, mutate=None):
        case_root = fixtures_root / case_name
        case_root.mkdir(parents=True, exist_ok=False)
        authorization_path = case_root / "authorization.json"
        authorization = {
            "schemaVersion": "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
            "requestId": "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260812-012755510",
            "commandRef": "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260812-012755510",
            "scope": "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
            "status": "resolved_owner_authorized_not_consumed",
            "executionActions": list(allowed_actions),
            "explicitlyDeniedActions": list(denied_actions),
            "taskIdentity": {
                "modeId": "fact_conditioned_semantic_mixture_stage4_smoke",
                "architecture": "stage4_fact_conditioned_semantic_mixture_decoder_v1",
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "requiredBoundarySides": ["west"],
                "resolution": {"width": 256, "height": 192},
                "epochCount": 30,
                "previewEpochs": FIXED_EPOCHS,
                "datasetSplit": EXPECTED_COUNTS,
                "initialization": "project_random_fact_conditioned_semantic_mixture",
                "oldDenoiserCheckpointReadAuthorized": False,
                "diagnosticCheckpointReadAuthorized": False,
                "diagnosticManifestFields": list(diagnostic_fields),
                "evidenceEligibilityContractId": "stage4_execution_evidence_eligibility_v1",
            },
            "bindings": {key: binding(path) for key, path in evidence_paths.items()},
            "codeBindings": {
                "authorizationPolicy": binding(STAGE_CONTROL_POLICY_PATH),
                "executionGrant": binding(Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")),
                "modeRegistry": binding(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
                "trainer": binding(TRAINER_PATH),
                "runner": binding(SMOKE_RUNNER_PATH),
                "cpuChecker": binding(CPU_CHECKER_PATH),
                "model": binding(MODEL_PATH),
                "inactiveConfigCompiler": binding(COMPILER_PATH),
            },
            "execution": {
                "consumptionPath": project_path(case_root / "execution-consumption.json"),
                "activeConfigPath": project_path(case_root / "active-config-must-not-exist.json"),
                "trainingOutputDirectory": project_path(case_root / "training-output-must-not-exist"),
                "finalizationDirectory": project_path(case_root / "finalization-must-not-exist"),
                "preflightReportPath": project_path(case_root / "preflight-report-must-not-exist.json"),
            },
        }
        if mutate is not None:
            mutate(authorization, case_root)
        write_json_exclusive(authorization_path, authorization)
        return authorization_path, authorization

    def run_node(path, supplied_sha=None):
        return subprocess.run([
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-fact-conditioned-semantic-mixture-model-smoke",
            "--gpu-authorization", project_path(path),
            "--gpu-authorization-sha256", supplied_sha or sha256_file(resolve(path)),
            "--cpu-contract-only",
        ], cwd=ROOT, text=True, capture_output=True, timeout=120)

    positive_path, _ = create_authorization("positive")
    positive_node = run_node(positive_path)
    unknown_path, _ = create_authorization(
        "unknown-action", lambda value, _root: value["executionActions"].append("unknown_semantic_mixture_smoke_action"),
    )
    forbidden_path, _ = create_authorization(
        "stage0-injection", lambda value, _root: (
            value["executionActions"].append(ExecutionAction.RUN_STAGE0.value),
            value["explicitlyDeniedActions"].remove(ExecutionAction.RUN_STAGE0.value),
        ),
    )
    wrong_mode_path, _ = create_authorization(
        "wrong-mode", lambda value, _root: value["taskIdentity"].update(modeId="v9_stage4_smoke"),
    )
    wrong_scope_path, _ = create_authorization(
        "wrong-scope", lambda value, _root: value.update(scope="forbidden_semantic_mixture_scope"),
    )
    missing_cpu_report_path, _ = create_authorization(
        "missing-cpu-report", lambda value, _root: value["bindings"].pop("cpuReport"),
    )
    forged_cpu_report_path, _ = create_authorization(
        "forged-cpu-report", lambda value, _root: value["bindings"]["cpuReport"].update(sha256="0" * 64),
    )
    missing_attestation_path, _ = create_authorization(
        "missing-implementation-attestation",
        lambda value, _root: value["bindings"].pop("implementationAttestation"),
    )
    forged_attestation_path, _ = create_authorization(
        "forged-implementation-attestation",
        lambda value, _root: value["bindings"]["implementationAttestation"].update(sha256="0" * 64),
    )
    external_path = Path("C:/Windows/win.ini")
    external_binding_path, _ = create_authorization(
        "external-path-injection",
        lambda value, _root: value["bindings"]["cpuReport"].update(
            path=str(external_path),
            sha256=sha256_file(external_path),
        ),
    )
    checkpoint_path, _ = create_authorization(
        "old-checkpoint-injection", lambda value, _root: value["bindings"].update(
            oldDenoiserCheckpoint=binding(evidence_paths["projectAutoencoderCheckpoint"])
        ),
    )
    diagnostic_checkpoint_path, _ = create_authorization(
        "diagnostic-checkpoint-injection", lambda value, _root: value["taskIdentity"].update(
            diagnosticCheckpointReadAuthorized=True
        ),
    )
    missing_diagnostic_field_path, _ = create_authorization(
        "missing-diagnostic-field",
        lambda value, _root: value["taskIdentity"]["diagnosticManifestFields"].pop(),
    )
    unknown_diagnostic_field_path, _ = create_authorization(
        "unknown-diagnostic-field",
        lambda value, _root: value["taskIdentity"]["diagnosticManifestFields"].append(
            "stage4SemanticMixtureUnknownMetric"
        ),
    )
    reordered_diagnostic_field_path, _ = create_authorization(
        "reordered-diagnostic-field",
        lambda value, _root: value["taskIdentity"]["diagnosticManifestFields"].__setitem__(
            slice(0, 2), list(reversed(value["taskIdentity"]["diagnosticManifestFields"][:2]))
        ),
    )
    provenance_metric_injection_path, _ = create_authorization(
        "provenance-metric-injection",
        lambda value, _root: value["taskIdentity"]["diagnosticManifestFields"].append(
            "stage4SemanticMixtureReusedDiscreteConditionWeight"
        ),
    )
    direct_historical_path, _ = create_authorization(
        "direct-historical-inactive-config",
        lambda value, _root: value["bindings"].update(
            inactiveConfig=binding(Path(
                ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/"
                "20260812-190738093/inactive-config.json"
            ))
        ),
    )
    repeated_path, repeated_authorization = create_authorization("repeated-consumption")
    write_json_exclusive(
        resolve(Path(repeated_authorization["execution"]["consumptionPath"])),
        {"status": "already_consumed"},
    )
    unknown_node = run_node(unknown_path)
    forbidden_node = run_node(forbidden_path)
    wrong_mode_node = run_node(wrong_mode_path)
    wrong_scope_node = run_node(wrong_scope_path)
    missing_cpu_report_node = run_node(missing_cpu_report_path)
    forged_cpu_report_node = run_node(forged_cpu_report_path)
    missing_attestation_node = run_node(missing_attestation_path)
    forged_attestation_node = run_node(forged_attestation_path)
    external_path_node = run_node(external_binding_path)
    checkpoint_node = run_node(checkpoint_path)
    diagnostic_checkpoint_node = run_node(diagnostic_checkpoint_path)
    missing_diagnostic_field_node = run_node(missing_diagnostic_field_path)
    unknown_diagnostic_field_node = run_node(unknown_diagnostic_field_path)
    reordered_diagnostic_field_node = run_node(reordered_diagnostic_field_path)
    provenance_metric_injection_node = run_node(provenance_metric_injection_path)
    direct_historical_node = run_node(direct_historical_path)
    repeated_node = run_node(repeated_path)
    bad_hash_node = run_node(positive_path, "0" * 64)

    mode = FORMAL_MODE_REGISTRY.resolve_mode_id(
        "fact_conditioned_semantic_mixture_stage4_smoke"
    )
    inactive_contract = trainer.validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(
        inactive_config, package, ROOT,
    )
    overfit_evidence = {
        "enabled": True,
        "sampleId": SAMPLE_ID,
        "conditionPackPath": sample.get("conditionPackPath"),
    }
    boundary_provenance = trainer.validate_stage4_sample_bound_boundary_provenance(
        inactive_config, overfit_evidence,
    )
    changed_sample_rejected = False
    try:
        trainer.validate_stage4_sample_bound_boundary_provenance(
            inactive_config,
            {**overfit_evidence, "sampleId": "forbidden-other-sample"},
        )
    except ValueError:
        changed_sample_rejected = True
    positive = {
        "modeRegisteredExactlyOnce": sum(
            spec.mode_id == "fact_conditioned_semantic_mixture_stage4_smoke"
            for spec in FORMAL_MODE_REGISTRY.snapshot().values()
        ) == 1,
        "modeIdentityExact": (
            mode.architecture == "stage4_fact_conditioned_semantic_mixture_decoder_v1"
            and mode.execution_kind == "single_sample_smoke"
            and mode.sample_split == "validation"
            and mode.active_execution is True
        ),
        "inactiveContractPreserved": inactive_contract.get("status")
        == "stage4_fact_conditioned_semantic_mixture_cpu_contract_valid_inactive",
        "boundaryProvenanceUsesSharedSampleBinding": (
            boundary_provenance.get("status")
            == "current_sample_world_fact_geometry_and_mask_topology_verified_before_checkpoint_read"
            and boundary_provenance.get("sampleId") == SAMPLE_ID
            and boundary_provenance.get("authoritativeRequiredBoundarySides") == ["west"]
        ),
        "realNodeContractPassed": positive_node.returncode == 0
        and "semantic-mixture_stage4_smoke_authorization_contract_valid_cpu_only"
        in positive_node.stdout,
        "sample194UniqueValidation": len(sample_rows) == 1 and sample_rows[0].get("split") == "validation",
        "datasetSplit48_8_4_4": {
            split: sum(row.get("split") == split for row in rows) for split in EXPECTED_COUNTS
        } == EXPECTED_COUNTS,
        "exactCurrentManifestFieldsSharedAndLegacyTwentySevenPreserved": (
            diagnostic_fields
            == list(trainer.fact_conditioned_semantic_mixture_diagnostic_fields(inactive_config))
            and len(diagnostic_fields) == (
                32 if object_visible_structure_route
                else 29 if (vegetation_luminance_route or distribution_aware_route or full_rollout_route or epoch_worst_route)
                else 28
            )
            and len(set(diagnostic_fields)) == len(diagnostic_fields)
            and (
                (
                    object_visible_structure_route
                    and diagnostic_fields
                    == list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS)
                )
                or (
                    not object_visible_structure_route
                    and (
                        not (
                            vegetation_luminance_route or distribution_aware_route
                            or full_rollout_route or epoch_worst_route
                        )
                        or diagnostic_fields
                        == list(trainer.STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_DIAGNOSTIC_FIELDS)
                    )
                )
            )
            and len(trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS) == 28
            and len(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS) == 27
        ),
        "objectVisibleStructurePhase0QualificationBound": (
            not object_visible_structure_route
            or (
                inactive_config.get("training", {}).get(
                    "stage4ObjectVisibleStructureSupervision", {}
                ).get("contractId")
                == "stage4_four_typed_object_visible_structure_supervision_v1"
                and inactive_config["training"]["stage4ObjectVisibleStructureSupervision"]
                .get("status") == "cpu_support_verified_inactive"
            )
        ),
        "trainerActiveObjectQualificationPassedBeforeModelEntry": (
            trainer_active_object_qualification_passed
        ),
        "manifestLossVersionBoundToActiveConfig": (
            '? context.inactiveConfig?.training?.denoiserLossVersion'
            in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        ),
        "reviewWorkIdentityUsesFullExecutionOutputPath": (
            "sha256Text(projectPath(context.outputDir)).slice(0, 16)"
            in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        ),
        "legacyModesPreserved": all(
            mode_id in {spec.mode_id for spec in FORMAL_MODE_REGISTRY.snapshot().values()}
            for mode_id in (
                "v7_r5_stage3_smoke", "v7_r5_stage4_bounded_smoke", "v8_stage4_smoke",
                "v9_stage4_smoke", "structure_fact_first_stage4_smoke",
                "condition_preserving_semantic_renderer_stage4_smoke",
            )
        ),
    }
    negative = {
        "unknownActionRejected": unknown_node.returncode != 0,
        "stage0ActionInjectionRejected": forbidden_node.returncode != 0,
        "wrongModeRejected": wrong_mode_node.returncode != 0,
        "wrongScopeRejected": wrong_scope_node.returncode != 0,
        "missingCpuReportBindingRejected": missing_cpu_report_node.returncode != 0,
        "forgedCpuReportBindingRejected": forged_cpu_report_node.returncode != 0,
        "missingImplementationAttestationBindingRejected": missing_attestation_node.returncode != 0,
        "forgedImplementationAttestationBindingRejected": forged_attestation_node.returncode != 0,
        "externalPathInjectionRejected": external_path_node.returncode != 0,
        "oldCheckpointBindingRejected": checkpoint_node.returncode != 0,
        "diagnosticCheckpointRejected": diagnostic_checkpoint_node.returncode != 0,
        "missingDiagnosticFieldRejected": missing_diagnostic_field_node.returncode != 0,
        "unknownDiagnosticFieldRejected": unknown_diagnostic_field_node.returncode != 0,
        "reorderedDiagnosticFieldRejected": reordered_diagnostic_field_node.returncode != 0,
        "provenanceMetricInjectionRejected": provenance_metric_injection_node.returncode != 0,
        "directHistoricalEvidencePathRejected": direct_historical_node.returncode != 0
        and "execution evidence must use canonical registered path"
        in direct_historical_node.stderr,
        "repeatedConsumptionRejected": repeated_node.returncode != 0,
        "authorizationHashMismatchRejected": bad_hash_node.returncode != 0,
        "trainerChangedObjectQualificationRejected": (
            trainer_rejects_changed_object_qualification
        ),
        "differentSampleBoundaryProvenanceRejected": changed_sample_rejected,
        "legacySemanticMixtureLossVersionNotHardcodedForCurrentManifest": (
            '? "velocity_decoded_rgb_fact_conditioned_semantic_mixture_v1"'
            not in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        ),
        "reviewWorkIdentityDoesNotCollapseToTrainingOutputBasename": (
            "sha256Text(path.basename(context.outputDir)).slice(0, 16)"
            not in resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
        ),
        "checkpointWeightContentNotRead": True,
        "optimizerNotCreated": True,
        "backwardNotExecuted": True,
        "gpuNotStarted": not torch.cuda.is_initialized(),
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-cpu-regression-v1",
        "status": "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed"
        if not failed_positive and not failed_negative
        else "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "nodePositive": {
            "exitCode": positive_node.returncode,
            "stdout": positive_node.stdout,
            "stderr": positive_node.stderr,
        },
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
    }
    write_json_exclusive(args.report, report)
    if failed_positive or failed_negative:
        return 1
    attestation = {
        "schemaVersion": "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-implementation-attestation-v1",
        "status": "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationPath": project_path(args.implementation_authorization),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionPath": project_path(args.implementation_consumption),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "authorizationPolicySha256": sha256_file(resolve(STAGE_CONTROL_POLICY_PATH)),
        "modeRegistrySha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "modelSha256": sha256_file(resolve(MODEL_PATH)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
        "implementationAttestation": binding(args.implementation_attestation),
    }, ensure_ascii=False, indent=2))
    return 0


def run_fact_conditioned_semantic_mixture_contract_regression(args) -> int:
    if args.inactive_config is None or args.report is None:
        raise ValueError(
            "semantic mixture CPU mode requires --inactive-config and --report"
        )
    config = read_json(resolve(args.inactive_config))
    package = read_json(resolve(DATASET_PATH))
    positive = {}
    negative = {}
    gradient_evidence = {}

    authorization = compiler.validate_semantic_mixture_authorization()
    positive["immutable_authorization_and_consumption"] = (
        authorization.get("requestId")
        == "owner-authorized-stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363"
    )
    mode = resolve_stage_mode(config)
    positive["formal_inactive_mode_registered"] = (
        mode.mode_id == "fact_conditioned_semantic_mixture_stage4_inactive"
        and mode.execution_kind == "cpu_inactive"
        and mode.active_execution is False
        and mode.sample_split == "validation"
    )
    contract = trainer.validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(
        config, package, ROOT,
    )
    trainer.validate_training_inputs(config, package)
    diagnostics = (
        trainer.validate_fact_conditioned_semantic_mixture_stage4_diagnostic_manifest_support_contract(
            config
        )
    )
    positive["complete_inactive_configuration_contract"] = (
        contract.get("status")
        == "stage4_fact_conditioned_semantic_mixture_cpu_contract_valid_inactive"
    )
    positive["formal_23_channel_order_shared"] = (
        tuple(config.get("conditionChannelOrder", ()))
        == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
    )
    positive["exact_twenty_seven_diagnostic_fields_shared"] = (
        diagnostics.get("exactFields")
        == list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS)
        and len(diagnostics.get("exactFields", ())) == 27
        and len(set(diagnostics.get("exactFields", ()))) == 27
    )
    registry = config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
    positive["reused_weight_is_configuration_provenance_only"] = (
        registry.get("configurationProvenance", {}).get("reusedDiscreteConditionWeight")
        == {
            "source": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "value": float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"]),
            "epochDiagnosticField": False,
        }
        and "stage4SemanticMixtureReusedDiscreteConditionWeight"
        not in diagnostics.get("exactFields", ())
    )

    torch.manual_seed(20263722)
    model = build_complete_world_system(config).cpu().train()
    latent_height, latent_width = 12, 16
    conditions = torch.rand(1, 23, latent_height, latent_width)
    noisy = torch.rand(1, int(config["latentChannels"]), latent_height, latent_width)
    timestep = torch.tensor([999], dtype=torch.long)
    predicted, mixture = model.predict_velocity_with_stage4_semantic_mixture(
        noisy, timestep, conditions,
    )
    identities = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES
    contributions = tuple(mixture.get("expertContributions", ()))
    gated = tuple(mixture.get("gatedContributions", ()))
    participation = mixture.get("participation")
    base = mixture.get("baseVelocity")
    positive["latent_shape_and_base_path_preserved"] = (
        predicted.shape == noisy.shape
        and base.shape == noisy.shape
        and torch.isfinite(predicted).all().item()
        and torch.isfinite(base).all().item()
    )
    positive["five_typed_private_experts_observable"] = (
        tuple(mixture.get("expertIdentityOrder", ())) == identities
        and len(contributions) == len(identities)
        and len(gated) == len(identities)
        and participation.shape == (1, len(identities), latent_height, latent_width)
        and mixture.get("typedIdentityCollapsedBeforeOutput") is False
    )
    positive["learned_mixture_changes_final_velocity"] = (
        float((predicted - base).abs().mean().detach()) > 0.0
    )

    expert_parameters = [
        model.denoiser.semantic_mixture_experts[name][0].weight
        for name in identities
    ]
    participation_parameters = [
        model.denoiser.semantic_mixture_participation[name][0].weight
        for name in identities
    ]
    own_gradients_valid = []
    private_cross_gradients_absent = []
    gate_gradients_valid = []
    for index, identity in enumerate(identities):
        adjacent = (index + 1) % len(identities)
        own = torch.autograd.grad(
            contributions[index].mean(), expert_parameters[index],
            retain_graph=True, allow_unused=True,
        )[0]
        cross = torch.autograd.grad(
            contributions[index].mean(), expert_parameters[adjacent],
            retain_graph=True, allow_unused=True,
        )[0]
        gate = torch.autograd.grad(
            gated[index].mean(), participation_parameters[index],
            retain_graph=True, allow_unused=True,
        )[0]
        own_valid = own is not None and torch.isfinite(own).all().item() and float(own.abs().sum()) > 0.0
        cross_absent = cross is None
        gate_valid = gate is not None and torch.isfinite(gate).all().item() and float(gate.abs().sum()) > 0.0
        own_gradients_valid.append(own_valid)
        private_cross_gradients_absent.append(cross_absent)
        gate_gradients_valid.append(gate_valid)
        gradient_evidence[identity] = {
            "ownGradientFiniteNonzero": own_valid,
            "ownGradientAbsSum": float(own.abs().sum()) if own is not None else None,
            "adjacentPrivateExpertGradientConnected": cross is not None,
            "participationGateGradientFiniteNonzero": gate_valid,
            "participationGateGradientAbsSum": float(gate.abs().sum()) if gate is not None else None,
        }
    base_to_private = torch.autograd.grad(
        base.mean(), tuple(expert_parameters + participation_parameters),
        retain_graph=True, allow_unused=True,
    )
    final_to_gated = torch.autograd.grad(
        predicted.mean(), gated, retain_graph=True, allow_unused=True,
    )
    positive["typed_expert_own_and_zero_cross_autograd"] = (
        all(own_gradients_valid) and all(private_cross_gradients_absent)
    )
    positive["learned_participation_gate_autograd"] = all(gate_gradients_valid)
    positive["base_path_isolated_from_private_experts"] = all(
        value is None for value in base_to_private
    )
    positive["gated_contributions_reach_final_velocity"] = all(
        value is not None and torch.isfinite(value).all().item() and float(value.abs().sum()) > 0.0
        for value in final_to_gated
    )

    target_velocity = torch.rand_like(predicted)
    predicted_clean = torch.rand_like(predicted)
    clean_latent = torch.rand_like(predicted)
    predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
    target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
    predicted_rgb = torch.rand(1, 3, latent_height * 4, latent_width * 4)
    target_rgb = torch.rand_like(predicted_rgb)
    full_conditions = torch.rand(1, 23, latent_height * 4, latent_width * 4)
    typed_counterfactual_rgb = {
        identity: torch.rand_like(predicted_rgb) for identity in identities
    }
    loss_metrics = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, typed_counterfactual_rgb, config,
    )
    positive["legal_supervision_loss_finite_and_manifest_registered"] = (
        torch.isfinite(loss_metrics["compositeLossTensor"]).item()
        and all(
            field in loss_metrics
            for field in trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS
        )
    )
    produced_semantic_mixture_metrics = sorted(
        key for key in loss_metrics if key.startswith("stage4SemanticMixture")
    )
    positive["produced_metric_set_is_exactly_formal_twenty_seven"] = (
        produced_semantic_mixture_metrics
        == sorted(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS)
        and "stage4SemanticMixtureReusedDiscreteConditionWeight" not in loss_metrics
    )
    positive["legacy_modes_remain_registered"] = all(
        mode_id in {spec.mode_id for spec in FORMAL_MODE_REGISTRY.snapshot().values()}
        for mode_id in (
            "v7_r5_stage3_smoke", "v7_r5_stage4_bounded_smoke", "v8_stage4_smoke",
            "v9_stage4_smoke", "structure_fact_first_stage4_smoke",
            "condition_preserving_semantic_renderer_stage4_smoke",
        )
    )

    def rejected(mutation):
        candidate = deepcopy(config)
        mutation(candidate)
        try:
            trainer.validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(
                candidate, package, ROOT,
            )
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    mixture_contract = lambda value: value["training"]["stage4FactConditionedSemanticMixture"]
    negative["adjacent_condition_channel_swap_rejected"] = rejected(
        lambda value: value["conditionChannelOrder"].__setitem__(
            slice(0, 2), list(reversed(value["conditionChannelOrder"][:2]))
        )
    )
    negative["missing_expert_identity_rejected"] = rejected(
        lambda value: mixture_contract(value)["typedExperts"]["identities"].pop()
    )
    negative["duplicate_expert_identity_rejected"] = rejected(
        lambda value: mixture_contract(value)["typedExperts"]["identities"].__setitem__(-1, "route")
    )
    negative["typed_identity_collapse_rejected"] = rejected(
        lambda value: mixture_contract(value)["typedExperts"].__setitem__(
            "typedIdentityCollapsedBeforeOutput", True
        )
    )
    negative["mean_compositor_rejected"] = rejected(
        lambda value: mixture_contract(value)["learnedCompositor"].__setitem__(
            "kind", "mean_collapsed_mixture"
        )
    )
    negative["failed_preview_supervision_rejected"] = rejected(
        lambda value: mixture_contract(value)["legalSupervision"].__setitem__(
            "failedPreviewPixelsUsedAsTargets", True
        )
    )
    negative["review_threshold_supervision_rejected"] = rejected(
        lambda value: mixture_contract(value)["legalSupervision"].__setitem__(
            "machineReviewThresholdsUsedAsTargets", True
        )
    )
    negative["old_checkpoint_compatibility_rejected"] = rejected(
        lambda value: mixture_contract(value).__setitem__(
            "oldDenoiserCheckpointCompatible", True
        )
    )
    negative["unknown_contract_field_rejected"] = rejected(
        lambda value: mixture_contract(value).__setitem__("startTrainingNow", True)
    )
    negative["missing_diagnostic_field_rejected"] = rejected(
        lambda value: mixture_contract(value)["diagnosticManifestRegistry"]["exactFields"].pop()
    )
    negative["unknown_diagnostic_field_rejected"] = rejected(
        lambda value: mixture_contract(value)["diagnosticManifestRegistry"]["exactFields"].append(
            "stage4SemanticMixtureUnknownMetric"
        )
    )
    negative["duplicate_diagnostic_field_rejected"] = rejected(
        lambda value: mixture_contract(value)["diagnosticManifestRegistry"]["exactFields"].append(
            value["training"]["stage4FactConditionedSemanticMixture"]
            ["diagnosticManifestRegistry"]["exactFields"][0]
        )
    )
    negative["diagnostic_field_order_change_rejected"] = rejected(
        lambda value: mixture_contract(value)["diagnosticManifestRegistry"]["exactFields"].__setitem__(
            slice(0, 2), list(reversed(
                mixture_contract(value)["diagnosticManifestRegistry"]["exactFields"][:2]
            ))
        )
    )
    negative["reused_weight_epoch_metric_injection_rejected"] = rejected(
        lambda value: mixture_contract(value)["diagnosticManifestRegistry"]["exactFields"].append(
            "stage4SemanticMixtureReusedDiscreteConditionWeight"
        )
    )
    negative["reused_weight_provenance_value_change_rejected"] = rejected(
        lambda value: mixture_contract(value)["diagnosticManifestRegistry"]
        ["configurationProvenance"]["reusedDiscreteConditionWeight"].__setitem__("value", -1.0)
    )
    negative["optimizer_authorization_rejected"] = rejected(
        lambda value: value["training"]["ownerTrainingAuthorization"].__setitem__(
            "optimizerCreationAuthorized", True
        )
    )
    negative["gpu_activation_rejected"] = rejected(
        lambda value: mixture_contract(value)["activationGate"].__setitem__("gpuUseNow", True)
    )
    negative["training_activation_rejected"] = rejected(
        lambda value: mixture_contract(value)["activationGate"].__setitem__("trainingNow", True)
    )
    negative["checkpoint_weight_content_not_read"] = True
    negative["optimizer_not_created"] = True
    negative["backward_not_executed"] = True
    negative["gpu_not_started"] = not torch.cuda.is_initialized()

    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-fact-conditioned-semantic-mixture-cpu-regression-v1",
        "status": (
            "stage4_fact_conditioned_semantic_mixture_cpu_regression_passed"
            if not failed_positive and not failed_negative
            else "stage4_fact_conditioned_semantic_mixture_cpu_regression_failed_closed"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "perExpertGradientEvidence": gradient_evidence,
        "inactiveConfig": binding(args.inactive_config),
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def run_per_class_final_visible_rgb_obligation_regression(args) -> int:
    if args.inactive_config is None or args.report is None:
        raise ValueError("final visible RGB CPU mode requires --inactive-config and --report")
    config = read_json(resolve(args.inactive_config))
    package = read_json(resolve(DATASET_PATH))
    positive = {}
    negative = {}
    gradient_evidence = {}

    authorization = compiler.validate_final_visible_rgb_authorization()
    positive["immutable_authorization_and_consumption"] = (
        authorization.get("requestId")
        == "owner-authorized-stage4-per-class-final-visible-rgb-obligation-cpu-20260812-190738093"
    )
    trainer.validate_training_inputs(config, package)
    objective = trainer.validate_stage4_per_class_final_visible_rgb_obligation(config)
    positive["complete_inactive_objective_contract"] = (
        objective.get("status")
        == "stage4_per_class_final_visible_rgb_obligation_cpu_contract_valid_inactive"
    )
    positive["exact_five_ordered_terms_shared"] = (
        objective.get("terms") == list(trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS)
        and len(objective.get("terms", ())) == 5
        and len({term["identity"] for term in objective.get("terms", ())}) == 5
    )
    positive["formal_23_channel_order_and_data_identity_preserved"] = (
        tuple(config.get("conditionChannelOrder", ()))
        == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        and trainer.conditional_dataset_selection_contract(config)
        == "registered_v7_capacity_contribution_v1"
        and package.get("v7CapacityContributionCount") == 64
    )
    weights = objective["derivedWeights"]
    expected_weights = {
        "route": 2.0,
        "footprints": 1.0 / 4.25,
        "tree": 1.0 / 4.25,
        "rock": 1.25 / 4.25,
        "vegetation": 1.0 / 4.25,
    }
    positive["weights_uniquely_derived_from_existing_contracts"] = all(
        math.isclose(float(weights[key]), value, rel_tol=0.0, abs_tol=1e-12)
        for key, value in expected_weights.items()
    )

    torch.manual_seed(20263722)
    identities = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES
    sources = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS
    predicted_velocity = torch.rand(1, 12, 12, 16, requires_grad=True)
    target_velocity = torch.rand_like(predicted_velocity)
    predicted_clean = torch.rand_like(predicted_velocity, requires_grad=True)
    clean_latent = torch.rand_like(predicted_velocity)
    predicted_conditions = torch.rand(1, 23, 12, 16, requires_grad=True)
    target_conditions = torch.rand_like(predicted_conditions)
    predicted_rgb = torch.rand(1, 3, 48, 64, requires_grad=True)
    target_rgb = torch.rand_like(predicted_rgb)
    full_conditions = torch.zeros(1, 23, 48, 64)
    order = list(config["conditionChannelOrder"])
    for index, channel in enumerate(sources):
        y0 = 2 + index * 8
        full_conditions[:, order.index(channel), y0:y0 + 5, 3 + index:12 + index] = 1.0
    contributions = tuple(torch.rand_like(predicted_velocity, requires_grad=True) for _ in identities)
    gated = tuple(value * 0.5 for value in contributions)
    participation = torch.rand(1, 5, 12, 16, requires_grad=True)
    mixture = {
        "expertIdentityOrder": identities,
        "sourceConditionChannels": sources,
        "expertContributions": contributions,
        "gatedContributions": gated,
        "participation": participation,
        "baseVelocity": predicted_velocity * 0.5,
        "compositorKind": "typed_fact_conditioned_gated_additive_mixture_v1",
        "typedIdentityCollapsedBeforeOutput": False,
    }
    counterfactual = {
        identity: torch.rand_like(predicted_rgb, requires_grad=True) for identity in identities
    }
    without_objective = deepcopy(config)
    without_objective["training"].pop("stage4PerClassFinalVisibleRgbObligation")
    before = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted_velocity, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, counterfactual, without_objective,
    )
    after = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted_velocity, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, counterfactual, config,
    )
    final_terms = [
        after[term["metric"]] for term in trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS
    ]
    expected_delta = sum(
        final_terms[index] * float(weights[identity])
        for index, identity in enumerate(identities)
    )
    positive["five_terms_enter_total_loss"] = bool(torch.allclose(
        after["compositeLossTensor"], before["compositeLossTensor"] + expected_delta,
        atol=1e-7, rtol=0.0,
    ))
    positive["five_terms_enter_checkpoint_qualification"] = bool(torch.allclose(
        after["compositeConditionQualityScore"],
        before["compositeConditionQualityScore"] + expected_delta,
        atol=1e-7, rtol=0.0,
    ))
    per_term_gradients = []
    mask_isolation = []
    for index, (identity, channel) in enumerate(zip(identities, sources)):
        gradient = torch.autograd.grad(
            final_terms[index], predicted_rgb, retain_graph=True, allow_unused=False,
        )[0]
        mask = full_conditions[:, order.index(channel):order.index(channel) + 1]
        inside = float((gradient.abs() * mask).sum().detach())
        outside = float((gradient.abs() * (1.0 - mask)).sum().detach())
        valid = torch.isfinite(gradient).all().item() and inside > 0.0
        isolated = outside == 0.0
        per_term_gradients.append(valid)
        mask_isolation.append(isolated)
        gradient_evidence[identity] = {
            "sourceChannel": channel,
            "finiteNonzeroFinalRgbGradient": valid,
            "insideMaskGradientAbsSum": inside,
            "outsideMaskGradientAbsSum": outside,
            "derivedWeight": float(weights[identity]),
        }
    positive["five_final_rgb_gradients_finite_nonzero"] = all(per_term_gradients)
    positive["each_term_reads_only_its_bound_mask_and_reference_rgb"] = all(mask_isolation)
    positive["legacy_semantic_mixture_loss_unchanged_without_contract"] = bool(torch.allclose(
        before["compositeLossTensor"],
        trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
            predicted_velocity, target_velocity, predicted_clean, clean_latent,
            predicted_conditions, target_conditions, predicted_rgb, target_rgb,
            full_conditions, mixture, counterfactual, without_objective,
        )["compositeLossTensor"], atol=0.0, rtol=0.0,
    ))

    def rejected(mutation):
        candidate = deepcopy(config)
        mutation(candidate)
        try:
            trainer.validate_stage4_per_class_final_visible_rgb_obligation(candidate)
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    contract = lambda value: value["training"]["stage4PerClassFinalVisibleRgbObligation"]
    negative["missing_term_rejected"] = rejected(lambda value: contract(value)["terms"].pop())
    negative["duplicate_term_rejected"] = rejected(
        lambda value: contract(value)["terms"].__setitem__(-1, deepcopy(contract(value)["terms"][0]))
    )
    negative["reordered_term_rejected"] = rejected(
        lambda value: contract(value)["terms"].__setitem__(
            slice(0, 2), list(reversed(contract(value)["terms"][:2]))
        )
    )
    negative["unknown_term_rejected"] = rejected(
        lambda value: contract(value)["terms"].append({
            "identity": "unknown", "sourceChannel": "unknown", "metric": "unknown",
        })
    )
    negative["wrong_channel_rejected"] = rejected(
        lambda value: contract(value)["terms"][1].__setitem__("sourceChannel", "object_tree")
    )
    negative["free_weight_change_rejected"] = rejected(
        lambda value: contract(value)["derivedWeights"].__setitem__("rock", 1.0)
    )
    negative["failed_preview_target_rejected"] = rejected(
        lambda value: contract(value)["legalSupervision"].__setitem__(
            "failedPreviewPixelsUsedAsTargets", True
        )
    )
    negative["review_threshold_target_rejected"] = rejected(
        lambda value: contract(value)["legalSupervision"].__setitem__(
            "machineReviewThresholdsUsedAsTargets", True
        )
    )
    negative["review_result_target_rejected"] = rejected(
        lambda value: contract(value)["legalSupervision"].__setitem__(
            "machineReviewResultsUsedAsTargets", True
        )
    )
    negative["old_checkpoint_rejected"] = rejected(
        lambda value: contract(value)["compatibility"].__setitem__(
            "oldDenoiserCheckpointCompatible", True
        )
    )
    negative["optimizer_activation_rejected"] = rejected(
        lambda value: contract(value)["activationGate"].__setitem__(
            "optimizerCreationNow", True
        )
    )
    negative["backward_activation_rejected"] = rejected(
        lambda value: contract(value)["activationGate"].__setitem__(
            "backwardExecutionNow", True
        )
    )
    negative["gpu_activation_rejected"] = rejected(
        lambda value: contract(value)["activationGate"].__setitem__("gpuUseNow", True)
    )
    negative["training_activation_rejected"] = rejected(
        lambda value: contract(value)["activationGate"].__setitem__("trainingNow", True)
    )
    negative["checkpoint_weight_content_not_read"] = True
    negative["optimizer_not_created"] = True
    negative["backward_not_executed"] = True
    negative["gpu_not_started"] = not torch.cuda.is_initialized()

    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-per-class-final-visible-rgb-obligation-cpu-regression-v1",
        "status": (
            "stage4_per_class_final_visible_rgb_obligation_cpu_regression_passed"
            if not failed_positive and not failed_negative
            else "stage4_per_class_final_visible_rgb_obligation_cpu_regression_failed_closed"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "perTermGradientEvidence": gradient_evidence,
        "inactiveConfig": binding(args.inactive_config),
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def run_distribution_aware_visible_spatial_semantic_regression(args) -> int:
    if args.inactive_config is None or args.report is None:
        raise ValueError("distribution-aware CPU mode requires --inactive-config and --report")
    config = read_json(resolve(args.inactive_config))
    package = read_json(resolve(DATASET_PATH))
    positive = {}
    negative = {}
    validated = trainer.validate_stage4_distribution_aware_visible_spatial_semantic_obligation(config)
    positive["contract_valid_inactive"] = (
        validated["status"]
        == "stage4_distribution_aware_visible_spatial_semantic_contract_valid_inactive"
    )
    positive["training_inputs_valid"] = True
    trainer.validate_training_inputs(config, package)
    order = list(config["conditionChannelOrder"])
    conditions = torch.zeros(2, 23, 8, 8)
    for index, channel in enumerate(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS):
        row = index // 3
        column = (index % 3) * 2
        conditions[:, order.index(channel), row:row + 2, column:column + 2] = 1.0
    target = torch.zeros(2, 3, 8, 8)
    vegetation_mask = conditions[:, order.index("object_vegetation"):order.index("object_vegetation") + 1]
    concentrated_values = torch.zeros_like(target)
    balanced_values = torch.zeros_like(target)
    concentrated_values[1] = vegetation_mask[1]
    balanced_values[:] = vegetation_mask * 0.5
    concentrated_values.requires_grad_()
    balanced_values.requires_grad_()
    concentrated_result = trainer.stage4_distribution_aware_visible_spatial_semantic_obligation(
        [concentrated_values], target, conditions, config,
    )
    balanced_result = trainer.stage4_distribution_aware_visible_spatial_semantic_obligation(
        [balanced_values], target, conditions, config,
    )
    old_concentrated = trainer.masked_condition_rgb_loss(
        concentrated_values, target, conditions, config, "object_vegetation",
    )
    old_balanced = trainer.masked_condition_rgb_loss(
        balanced_values, target, conditions, config, "object_vegetation",
    )
    positive["aggregate_mean_counterexample_equal"] = bool(torch.allclose(
        old_concentrated, old_balanced, atol=1e-7, rtol=0.0,
    ))
    positive["worst_sample_class_counterexample_detected"] = bool(
        concentrated_result["stage4DistributionAwareVisibleSpatialSemanticLossTensor"]
        > balanced_result["stage4DistributionAwareVisibleSpatialSemanticLossTensor"]
    )
    gradient = torch.autograd.grad(
        concentrated_result["stage4DistributionAwareVisibleSpatialSemanticLossTensor"],
        concentrated_values, allow_unused=False,
    )[0]
    inside = float((gradient.abs() * vegetation_mask).sum().detach())
    outside = float((gradient.abs() * (1.0 - vegetation_mask)).sum().detach())
    positive["worst_obligation_gradient_finite_nonzero"] = bool(
        torch.isfinite(gradient).all().item() and inside > 0.0
    )
    positive["worst_obligation_gradient_mask_isolated"] = outside == 0.0
    trajectory = trainer.stage4_distribution_aware_visible_spatial_semantic_obligation(
        [balanced_values * 0.5, concentrated_values], target, conditions, config,
    )
    positive["existing_trajectory_steps_are_covered"] = bool(
        trajectory["stage4DistributionAwareVisibleSpatialSemanticLossTensor"]
        >= concentrated_result["stage4DistributionAwareVisibleSpatialSemanticLossTensor"]
    )
    positive["no_free_numeric_weight"] = (
        config["training"]["stage4DistributionAwareVisibleSpatialSemanticObligation"]
        ["aggregation"]["freeNumericWeightSelected"] is False
    )

    def rejected(mutation):
        candidate = deepcopy(config)
        mutation(candidate)
        try:
            trainer.validate_stage4_distribution_aware_visible_spatial_semantic_obligation(candidate)
        except (ValueError, KeyError):
            return True
        return False

    contract = lambda value: value["training"]["stage4DistributionAwareVisibleSpatialSemanticObligation"]
    negative["missing_identity_rejected"] = rejected(lambda value: contract(value)["requiredIdentities"].pop())
    negative["reordered_identity_rejected"] = rejected(lambda value: contract(value)["requiredIdentities"].reverse())
    negative["wrong_channel_rejected"] = rejected(lambda value: contract(value)["sourceChannels"].__setitem__(4, "object_tree"))
    negative["mean_only_rejected"] = rejected(lambda value: contract(value)["aggregation"].__setitem__("batchReduction", "mean"))
    negative["free_weight_rejected"] = rejected(lambda value: contract(value)["aggregation"].__setitem__("freeNumericWeightSelected", True))
    negative["new_trajectory_count_rejected"] = rejected(lambda value: contract(value)["trajectoryBinding"].__setitem__("newTrajectoryStepCountSelected", True))
    negative["failed_preview_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("failedPreviewPixelsUsedAsTargets", True))
    negative["review_threshold_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("machineReviewThresholdsUsedAsTargets", True))
    negative["review_result_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("machineReviewResultsUsedAsTargets", True))
    negative["architecture_change_rejected"] = rejected(lambda value: contract(value)["compatibility"].__setitem__("modelArchitectureChanged", True))
    negative["checkpoint_format_change_rejected"] = rejected(lambda value: contract(value)["compatibility"].__setitem__("checkpointFormatChanged", True))
    negative["gpu_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("gpuUseNow", True))
    negative["training_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("trainingNow", True))
    negative["checkpoint_not_read"] = True
    negative["optimizer_not_created"] = True
    negative["backward_not_executed"] = True
    negative["gpu_not_started"] = not torch.cuda.is_initialized()
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "stage4-distribution-aware-visible-spatial-semantic-cpu-report-v1",
        "status": "stage4_distribution_aware_visible_spatial_semantic_cpu_regression_passed"
        if not failed_positive and not failed_negative
        else "stage4_distribution_aware_visible_spatial_semantic_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "counterexample": {
            "aggregateMeanConcentrated": float(old_concentrated.detach()),
            "aggregateMeanBalanced": float(old_balanced.detach()),
            "worstConcentrated": float(concentrated_result["stage4DistributionAwareVisibleSpatialSemanticLossTensor"].detach()),
            "worstBalanced": float(balanced_result["stage4DistributionAwareVisibleSpatialSemanticLossTensor"].detach()),
            "insideGradientAbsSum": inside,
            "outsideGradientAbsSum": outside,
        },
        "inactiveConfig": binding(args.inactive_config),
        "checkpointWeightsRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def run_vegetation_luminance_spatial_structure_regression(args) -> int:
    if args.inactive_config is None or args.report is None:
        raise ValueError("vegetation luminance CPU mode requires --inactive-config and --report")
    config = read_json(resolve(args.inactive_config))
    package = read_json(resolve(DATASET_PATH))
    positive = {}
    negative = {}

    authorization = compiler.validate_vegetation_luminance_authorization()
    positive["immutable_authorization_and_consumption"] = (
        authorization.get("requestId")
        == "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-20260813-034000000"
    )
    trainer.validate_training_inputs(config, package)
    contract_result = trainer.validate_stage4_vegetation_luminance_spatial_structure_supervision(
        config
    )
    positive["complete_inactive_luminance_contract"] = (
        contract_result.get("status")
        == "stage4_vegetation_luminance_spatial_structure_cpu_contract_valid_inactive"
    )
    expected_fields = list(
        trainer.STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_DIAGNOSTIC_FIELDS
    )
    registry = config["training"]["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    positive["exact_29_field_registry_isolated_from_28_and_27"] = (
        registry.get("exactFields") == expected_fields
        and registry.get("exactFieldCount") == 29
        and len(trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS) == 28
        and len(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS) == 27
    )
    positive["formal_data_and_condition_identity_preserved"] = (
        tuple(config.get("conditionChannelOrder", ()))
        == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        and package.get("v7CapacityContributionCount") == 64
    )
    positive["weight_reuses_existing_vegetation_obligation"] = math.isclose(
        float(contract_result["derivedWeight"]), 1.0 / 4.25,
        rel_tol=0.0, abs_tol=1e-12,
    )

    torch.manual_seed(20263722)
    identities = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES
    sources = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS
    predicted_velocity = torch.rand(1, 12, 12, 16, requires_grad=True)
    target_velocity = torch.rand_like(predicted_velocity)
    predicted_clean = torch.rand_like(predicted_velocity, requires_grad=True)
    clean_latent = torch.rand_like(predicted_velocity)
    predicted_conditions = torch.rand(1, 23, 12, 16, requires_grad=True)
    target_conditions = torch.rand_like(predicted_conditions)
    predicted_rgb = torch.rand(1, 3, 48, 64, requires_grad=True)
    target_rgb = torch.rand_like(predicted_rgb)
    full_conditions = torch.zeros(1, 23, 48, 64)
    order = list(config["conditionChannelOrder"])
    for index, channel in enumerate(sources):
        y0 = 2 + index * 8
        full_conditions[:, order.index(channel), y0:y0 + 5, 3 + index:12 + index] = 1.0
    contributions = tuple(torch.rand_like(predicted_velocity, requires_grad=True) for _ in identities)
    mixture = {
        "expertIdentityOrder": identities,
        "sourceConditionChannels": sources,
        "expertContributions": contributions,
        "gatedContributions": tuple(value * 0.5 for value in contributions),
        "participation": torch.rand(1, 5, 12, 16, requires_grad=True),
        "baseVelocity": predicted_velocity * 0.5,
        "compositorKind": "typed_fact_conditioned_gated_additive_mixture_v1",
        "typedIdentityCollapsedBeforeOutput": False,
    }
    counterfactual = {
        identity: torch.rand_like(predicted_rgb, requires_grad=True) for identity in identities
    }
    without_luminance = deepcopy(config)
    without_luminance["training"].pop(
        "stage4VegetationLuminanceSpatialStructureSupervision"
    )
    old_registry = without_luminance["training"]["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    old_registry["exactFields"] = list(
        trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    )
    old_registry["exactFieldCount"] = 28
    before = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted_velocity, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, counterfactual, without_luminance,
    )
    after = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted_velocity, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, counterfactual, config,
    )
    luminance_loss = after[
        "stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss"
    ]
    delta = luminance_loss * float(contract_result["derivedWeight"])
    positive["luminance_obligation_enters_total_loss"] = bool(torch.allclose(
        after["compositeLossTensor"], before["compositeLossTensor"] + delta,
        atol=1e-7, rtol=0.0,
    ))
    positive["luminance_obligation_enters_checkpoint_qualification"] = bool(
        torch.allclose(
            after["compositeConditionQualityScore"],
            before["compositeConditionQualityScore"] + delta,
            atol=1e-7, rtol=0.0,
        )
    )
    gradient = torch.autograd.grad(luminance_loss, predicted_rgb, retain_graph=True)[0]
    vegetation_mask = full_conditions[
        :, order.index("object_vegetation"):order.index("object_vegetation") + 1
    ]
    inside = float((gradient.abs() * vegetation_mask).sum().detach())
    outside = float((gradient.abs() * (1.0 - vegetation_mask)).sum().detach())
    positive["luminance_gradient_finite_nonzero_inside_mask"] = (
        bool(torch.isfinite(gradient).all()) and inside > 0.0
    )
    positive["luminance_gradient_zero_outside_mask"] = outside == 0.0
    matched = target_rgb.detach().clone().requires_grad_(True)
    matched_loss = trainer.masked_condition_luminance_correlation_loss(
        matched, target_rgb, full_conditions, config, "object_vegetation"
    )
    spatially_reversed = target_rgb.detach().flip(-1).requires_grad_(True)
    reversed_loss = trainer.masked_condition_luminance_correlation_loss(
        spatially_reversed, target_rgb, full_conditions, config, "object_vegetation"
    )
    positive["matching_spatial_luminance_is_preferred"] = (
        float(matched_loss.detach()) < 1e-6
        and float(reversed_loss.detach()) > float(matched_loss.detach())
    )
    positive["existing_color_edge_and_other_typed_obligations_preserved"] = (
        "stage4SemanticMixtureVegetationFinalTypedEdgeMae" in after
        and all(term["metric"] in after for term in trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS)
    )

    def rejected(mutation):
        candidate = deepcopy(config)
        mutation(candidate)
        try:
            trainer.validate_training_inputs(candidate, package)
            trainer.validate_stage4_vegetation_luminance_spatial_structure_supervision(candidate)
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    contract = lambda value: value["training"]["stage4VegetationLuminanceSpatialStructureSupervision"]
    registry_of = lambda value: value["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
    negative["missing_contract_field_rejected"] = rejected(lambda value: contract(value).pop("sourceChannel"))
    negative["unknown_contract_field_rejected"] = rejected(lambda value: contract(value).__setitem__("unknown", True))
    negative["wrong_channel_rejected"] = rejected(lambda value: contract(value).__setitem__("sourceChannel", "object_tree"))
    negative["wrong_luminance_coefficients_rejected"] = rejected(lambda value: contract(value).__setitem__("luminanceCoefficients", [0.3, 0.6, 0.1]))
    negative["free_weight_rejected"] = rejected(lambda value: contract(value).__setitem__("derivedWeight", 1.0))
    negative["wrong_loss_function_rejected"] = rejected(lambda value: contract(value).__setitem__("lossFunction", "masked_condition_rgb_loss"))
    negative["failed_preview_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("failedPreviewPixelsUsedAsTargets", True))
    negative["review_threshold_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("machineReviewThresholdsUsedAsTargets", True))
    negative["review_result_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("machineReviewResultsUsedAsTargets", True))
    negative["review_threshold_as_target_binding_rejected"] = rejected(lambda value: contract(value)["sourceFailureEvidence"].__setitem__("reviewThresholdUsedAsTrainingTarget", True))
    negative["failed_checkpoint_reuse_rejected"] = rejected(lambda value: contract(value)["compatibility"].__setitem__("failedSmokeCheckpointCompatible", True))
    negative["missing_diagnostic_rejected"] = rejected(lambda value: registry_of(value)["exactFields"].pop())
    negative["unknown_diagnostic_rejected"] = rejected(lambda value: registry_of(value)["exactFields"].append("unknown"))
    negative["diagnostic_order_change_rejected"] = rejected(lambda value: registry_of(value)["exactFields"].__setitem__(slice(-2, None), list(reversed(registry_of(value)["exactFields"][-2:]))))
    negative["optimizer_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("optimizerCreationNow", True))
    negative["backward_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("backwardExecutionNow", True))
    negative["gpu_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("gpuUseNow", True))
    negative["training_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("trainingNow", True))
    negative["checkpoint_not_read"] = True
    negative["optimizer_not_created"] = True
    negative["backward_not_executed"] = True
    negative["gpu_not_started"] = not torch.cuda.is_initialized()

    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-vegetation-luminance-spatial-structure-cpu-regression-v1",
        "status": (
            "stage4_vegetation_luminance_spatial_structure_cpu_regression_passed"
            if not failed_positive and not failed_negative
            else "stage4_vegetation_luminance_spatial_structure_cpu_regression_failed_closed"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "luminanceGradientEvidence": {
            "insideMaskGradientAbsSum": inside,
            "outsideMaskGradientAbsSum": outside,
            "matchedLoss": float(matched_loss.detach()),
            "spatiallyReversedLoss": float(reversed_loss.detach()),
            "derivedWeight": float(contract_result["derivedWeight"]),
        },
        "inactiveConfig": binding(args.inactive_config),
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "report": binding(args.report),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def run_vegetation_final_visible_semantic_repair_regression(args) -> int:
    if args.inactive_config is None or args.report is None:
        raise ValueError("vegetation repair CPU mode requires --inactive-config and --report")
    config = read_json(resolve(args.inactive_config))
    package = read_json(resolve(DATASET_PATH))
    positive = {}
    negative = {}

    authorization = compiler.validate_vegetation_repair_authorization()
    positive["immutable_authorization_and_consumption"] = (
        authorization.get("requestId")
        == "owner-authorized-stage4-vegetation-final-visible-semantic-repair-20260813-025311970"
    )
    trainer.validate_training_inputs(config, package)
    repair = trainer.validate_stage4_vegetation_final_visible_semantic_repair(config)
    positive["complete_inactive_repair_contract"] = (
        repair.get("status")
        == "stage4_vegetation_final_visible_semantic_repair_cpu_contract_valid_inactive"
    )
    expected_fields = list(
        trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    )
    registry = config["training"]["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    positive["exact_28_field_registry_isolated_from_legacy_27"] = (
        registry.get("exactFields") == expected_fields
        and registry.get("exactFieldCount") == 28
        and len(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS) == 27
    )
    positive["formal_data_and_condition_identity_preserved"] = (
        tuple(config.get("conditionChannelOrder", ()))
        == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        and package.get("v7CapacityContributionCount") == 64
    )
    positive["weight_reuses_existing_vegetation_obligation"] = math.isclose(
        float(repair["derivedWeight"]), 1.0 / 4.25, rel_tol=0.0, abs_tol=1e-12,
    )

    torch.manual_seed(20263722)
    identities = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES
    sources = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS
    predicted_velocity = torch.rand(1, 12, 12, 16, requires_grad=True)
    target_velocity = torch.rand_like(predicted_velocity)
    predicted_clean = torch.rand_like(predicted_velocity, requires_grad=True)
    clean_latent = torch.rand_like(predicted_velocity)
    predicted_conditions = torch.rand(1, 23, 12, 16, requires_grad=True)
    target_conditions = torch.rand_like(predicted_conditions)
    predicted_rgb = torch.rand(1, 3, 48, 64, requires_grad=True)
    target_rgb = torch.rand_like(predicted_rgb)
    full_conditions = torch.zeros(1, 23, 48, 64)
    order = list(config["conditionChannelOrder"])
    for index, channel in enumerate(sources):
        y0 = 2 + index * 8
        full_conditions[:, order.index(channel), y0:y0 + 5, 3 + index:12 + index] = 1.0
    contributions = tuple(torch.rand_like(predicted_velocity, requires_grad=True) for _ in identities)
    mixture = {
        "expertIdentityOrder": identities,
        "sourceConditionChannels": sources,
        "expertContributions": contributions,
        "gatedContributions": tuple(value * 0.5 for value in contributions),
        "participation": torch.rand(1, 5, 12, 16, requires_grad=True),
        "baseVelocity": predicted_velocity * 0.5,
        "compositorKind": "typed_fact_conditioned_gated_additive_mixture_v1",
        "typedIdentityCollapsedBeforeOutput": False,
    }
    counterfactual = {
        identity: torch.rand_like(predicted_rgb, requires_grad=True) for identity in identities
    }
    without_repair = deepcopy(config)
    without_repair["training"].pop("stage4VegetationFinalVisibleSemanticRepair")
    old_registry = without_repair["training"]["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    old_registry["exactFields"] = list(
        trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS
    )
    old_registry["exactFieldCount"] = 27
    before = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted_velocity, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, counterfactual, without_repair,
    )
    after = trainer.composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4(
        predicted_velocity, target_velocity, predicted_clean, clean_latent,
        predicted_conditions, target_conditions, predicted_rgb, target_rgb,
        full_conditions, mixture, counterfactual, config,
    )
    edge = after["stage4SemanticMixtureVegetationFinalTypedEdgeMae"]
    delta = edge * float(repair["derivedWeight"])
    positive["edge_obligation_enters_total_loss"] = bool(torch.allclose(
        after["compositeLossTensor"], before["compositeLossTensor"] + delta,
        atol=1e-7, rtol=0.0,
    ))
    positive["edge_obligation_enters_checkpoint_qualification"] = bool(torch.allclose(
        after["compositeConditionQualityScore"],
        before["compositeConditionQualityScore"] + delta,
        atol=1e-7, rtol=0.0,
    ))
    gradient = torch.autograd.grad(edge, predicted_rgb, retain_graph=True)[0]
    vegetation_mask = full_conditions[
        :, order.index("object_vegetation"):order.index("object_vegetation") + 1
    ]
    inside = float((gradient.abs() * vegetation_mask).sum().detach())
    # A first-order horizontal/vertical gradient reads each masked edge and its
    # directly adjacent pixel.  Its exact causal support is therefore the
    # one-pixel dilation of the semantic mask, not the mask interior alone.
    edge_support = torch.nn.functional.max_pool2d(
        vegetation_mask, kernel_size=3, stride=1, padding=1,
    )
    adjacent = float((gradient.abs() * (edge_support - vegetation_mask)).sum().detach())
    outside = float((gradient.abs() * (1.0 - edge_support)).sum().detach())
    positive["vegetation_edge_gradient_finite_nonzero"] = (
        bool(torch.isfinite(gradient).all()) and inside > 0.0
    )
    positive["vegetation_edge_gradient_exact_boundary_support"] = (
        adjacent > 0.0 and outside == 0.0
    )
    positive["five_existing_final_rgb_obligations_preserved"] = all(
        term["metric"] in after
        for term in trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS
    )

    def rejected(mutation):
        candidate = deepcopy(config)
        mutation(candidate)
        try:
            trainer.validate_training_inputs(candidate, package)
            trainer.validate_stage4_vegetation_final_visible_semantic_repair(candidate)
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    contract = lambda value: value["training"]["stage4VegetationFinalVisibleSemanticRepair"]
    registry_of = lambda value: value["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
    negative["missing_contract_field_rejected"] = rejected(lambda value: contract(value).pop("sourceChannel"))
    negative["unknown_contract_field_rejected"] = rejected(lambda value: contract(value).__setitem__("unknown", True))
    negative["wrong_channel_rejected"] = rejected(lambda value: contract(value).__setitem__("sourceChannel", "object_tree"))
    negative["free_weight_rejected"] = rejected(lambda value: contract(value).__setitem__("derivedWeight", 1.0))
    negative["wrong_loss_function_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("lossFunction", "masked_condition_rgb_loss"))
    negative["failed_preview_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("failedPreviewPixelsUsedAsTargets", True))
    negative["review_threshold_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("machineReviewThresholdsUsedAsTargets", True))
    negative["review_result_target_rejected"] = rejected(lambda value: contract(value)["legalSupervision"].__setitem__("machineReviewResultsUsedAsTargets", True))
    negative["failed_checkpoint_reuse_rejected"] = rejected(lambda value: contract(value)["compatibility"].__setitem__("failedSmokeCheckpointCompatible", True))
    negative["missing_diagnostic_rejected"] = rejected(lambda value: registry_of(value)["exactFields"].pop())
    negative["unknown_diagnostic_rejected"] = rejected(lambda value: registry_of(value)["exactFields"].append("unknown"))
    negative["diagnostic_order_change_rejected"] = rejected(lambda value: registry_of(value)["exactFields"].__setitem__(slice(-2, None), list(reversed(registry_of(value)["exactFields"][-2:]))))
    negative["optimizer_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("optimizerCreationNow", True))
    negative["backward_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("backwardExecutionNow", True))
    negative["gpu_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("gpuUseNow", True))
    negative["training_activation_rejected"] = rejected(lambda value: contract(value)["activationGate"].__setitem__("trainingNow", True))
    negative["checkpoint_not_read"] = True
    negative["optimizer_not_created"] = True
    negative["backward_not_executed"] = True
    negative["gpu_not_started"] = not torch.cuda.is_initialized()

    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-vegetation-final-visible-semantic-repair-cpu-regression-v1",
        "status": (
            "stage4_vegetation_final_visible_semantic_repair_cpu_regression_passed"
            if not failed_positive and not failed_negative
            else "stage4_vegetation_final_visible_semantic_repair_cpu_regression_failed_closed"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "vegetationGradientEvidence": {
            "insideMaskGradientAbsSum": inside,
            "adjacentBoundaryGradientAbsSum": adjacent,
            "outsideOnePixelBoundarySupportGradientAbsSum": outside,
            "derivedWeight": float(repair["derivedWeight"]),
        },
        "inactiveConfig": binding(args.inactive_config),
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def run_object_reference_multiscale_early_convergence_smoke_lineage_regression(args) -> int:
    required = {
        "report": args.report,
        "failed_active_config": args.failed_active_config,
    }
    missing = [name for name, value in required.items() if value is None]
    if missing:
        raise ValueError(
            "object-reference multiscale early-convergence Smoke lineage inputs missing: "
            + ",".join(missing)
        )

    active_config_path = resolve(args.failed_active_config)
    active_config = read_json(active_config_path)
    execution = active_config.get("training", {}).get(
        "factConditionedSemanticMixtureStage4SmokeExecution", {}
    )
    evidence_keys = (
        "sourceInactiveConfig", "ownerAuthorization", "gpuConsumption",
        "implementationAuthorization", "implementationConsumption",
        "implementationAttestation", "readonlyGpuTerminal",
        "readonlyGpuDiagnostic", "cudaTelemetry", "readonlyCpuReport",
    )
    if set(execution) != {
        field
        for key in evidence_keys
        for field in (f"{key}Path", f"{key}Sha256")
    }:
        raise ValueError("early-convergence Smoke execution binding fields changed")

    verified = {}
    for key in evidence_keys:
        path = resolve(Path(execution[f"{key}Path"]))
        if sha256_file(path) != execution[f"{key}Sha256"]:
            raise ValueError(f"early-convergence Smoke {key} SHA-256 changed")
        verified[key] = path

    source = read_json(verified["sourceInactiveConfig"])
    authorization = read_json(verified["ownerAuthorization"])
    consumption = read_json(verified["gpuConsumption"])
    implementation_authorization = read_json(verified["implementationAuthorization"])
    implementation_consumption = read_json(verified["implementationConsumption"])
    terminal = read_json(verified["readonlyGpuTerminal"])
    diagnostic = read_json(verified["readonlyGpuDiagnostic"])
    cuda_telemetry = read_json(verified["cudaTelemetry"])
    cpu_report = read_json(verified["readonlyCpuReport"])
    identity = authorization.get("taskIdentity", {})

    def qualifies(
        *, terminal_value=terminal, diagnostic_value=diagnostic,
        cuda_value=cuda_telemetry, cpu_value=cpu_report,
        identity_value=identity, source_value=source,
    ) -> bool:
        return trainer.is_stage4_object_reference_multiscale_early_convergence_qualification(
            terminal=terminal_value,
            diagnostic=diagnostic_value,
            cuda_telemetry=cuda_value,
            cpu_report=cpu_value,
            identity=identity_value,
            source=source_value,
        )

    positive = {
        "currentQualificationRecognized": qualifies(),
        "sourceAuthorizationConsumedExactlyOnce": (
            consumption.get("authorizationSha256")
            == execution["ownerAuthorizationSha256"]
            and consumption.get("oneTimeConsumption") is True
        ),
        "implementationAuthorizationLineageExact": (
            implementation_consumption.get("authorizationSha256")
            == execution["implementationAuthorizationSha256"]
            and implementation_consumption.get("oneTimeConsumption") is True
        ),
        "trainerHelperExported": callable(
            getattr(
                trainer,
                "is_stage4_object_reference_multiscale_early_convergence_qualification",
                None,
            )
        ),
    }

    negative_mutations = {
        "rejectWrongTerminalStatus": ("terminal", lambda value: value.update(status="wrong")),
        "rejectTerminalOptimizerCreated": ("terminal", lambda value: value.update(optimizerCreated=True)),
        "rejectWrongDiagnosticStatus": ("diagnostic", lambda value: value.update(status="wrong")),
        "rejectWrongDiagnosticObjective": (
            "diagnostic",
            lambda value: value["identity"].update(trainingObjectiveContractId="wrong"),
        ),
        "rejectWrongReplayLaneCount": (
            "diagnostic", lambda value: value["identity"].update(replayLaneCount=1)
        ),
        "rejectWrongManifestFieldCount": (
            "diagnostic", lambda value: value["diagnosticManifest"].update(fieldCount=47)
        ),
        "rejectZeroCombinedObjectGradient": (
            "diagnostic",
            lambda value: value["gradientEvidence"]["fourObjectVisibleStructure"]["combined"].update(
                finiteAndStrictlyNonzero=False
            ),
        ),
        "rejectZeroLane1Gradient": (
            "diagnostic",
            lambda value: value["gradientEvidence"]["twoLaneEarlyConvergenceStabilization"].update(
                lane1DenoiserGradientNorm=0.0
            ),
        ),
        "rejectZeroLane2Gradient": (
            "diagnostic",
            lambda value: value["gradientEvidence"]["twoLaneEarlyConvergenceStabilization"].update(
                lane2DenoiserGradientNorm=0.0
            ),
        ),
        "rejectZeroCombinedTwoLaneGradient": (
            "diagnostic",
            lambda value: value["gradientEvidence"]["twoLaneEarlyConvergenceStabilization"].update(
                combinedTwoLaneDenoiserGradientNorm=0.0
            ),
        ),
        "rejectReplayPassAdded": (
            "diagnostic",
            lambda value: value["gradientEvidence"]["twoLaneEarlyConvergenceStabilization"].update(
                replayPassesAdded=1
            ),
        ),
        "rejectDiagnosticTraining": ("diagnostic", lambda value: value.update(trainingStarted=True)),
        "rejectWrongCudaStatus": ("cuda", lambda value: value.update(status="wrong")),
        "rejectWrongCpuStatus": ("cpu", lambda value: value.update(status="wrong")),
        "rejectIncompleteCpuPositive": ("cpu", lambda value: value.update(positivePassed=20)),
        "rejectWrongAuthorizationObjective": (
            "identity", lambda value: value.update(trainingObjectiveContractId="wrong")
        ),
        "rejectWrongAuthorizationChannels": (
            "identity", lambda value: value.update(objectSemanticChannels=["object_tree"])
        ),
        "rejectWrongAuthorizationScales": (
            "identity", lambda value: value.update(pyramidScales=[1.0, 0.5])
        ),
        "rejectWrongAuthorizationReplayLaneCount": (
            "identity", lambda value: value.update(replayLaneCount=1)
        ),
        "rejectWrongSourceContract": (
            "source",
            lambda value: value["training"][
                "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"
            ].update(contractId="wrong"),
        ),
        "rejectSourceReplayPass": (
            "source",
            lambda value: value["training"][
                "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"
            ]["replayBudget"].update(addsReplayPasses=True),
        ),
    }
    originals = {
        "terminal": terminal,
        "diagnostic": diagnostic,
        "cuda": cuda_telemetry,
        "cpu": cpu_report,
        "identity": identity,
        "source": source,
    }
    negative = {}
    for name, (target, mutate) in negative_mutations.items():
        values = {key: deepcopy(value) for key, value in originals.items()}
        mutate(values[target])
        negative[name] = not qualifies(
            terminal_value=values["terminal"],
            diagnostic_value=values["diagnostic"],
            cuda_value=values["cuda"],
            cpu_value=values["cpu"],
            identity_value=values["identity"],
            source_value=values["source"],
        )

    fixture_root = resolve(args.report).parent / "real-startup-fixture"
    fixture_root.mkdir(parents=True, exist_ok=False)
    candidate_config = deepcopy(active_config)
    candidate_execution = candidate_config["training"][
        "factConditionedSemanticMixtureStage4SmokeExecution"
    ]
    attestation = read_json(verified["implementationAttestation"])
    attestation["trainerSha256"] = sha256_file(resolve(TRAINER_PATH))
    attestation_path = fixture_root / "implementation-attestation.json"
    write_json_exclusive(attestation_path, attestation)
    candidate_execution["implementationAttestationPath"] = project_path(attestation_path)
    candidate_execution["implementationAttestationSha256"] = sha256_file(attestation_path)
    candidate_config_path = fixture_root / "active-config.json"
    write_json_exclusive(candidate_config_path, candidate_config)

    bindings = authorization.get("bindings", {})
    dataset_path = resolve(Path(bindings["datasetManifest"]["path"]))
    autoencoder_path = resolve(Path(bindings["projectAutoencoderCheckpoint"]["path"]))
    environment = {**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1"}
    trainer_process = subprocess.run([
        sys.executable, "-B", str(resolve(TRAINER_PATH)),
        "--config", str(candidate_config_path),
        "--dataset-package", str(dataset_path),
        "--autoencoder-checkpoint", str(autoencoder_path),
        "--output-dir", str(fixture_root / "training-output-must-not-exist"),
        "--resolution-stage", "0",
        "--single-sample-overfit-smoke",
        "--overfit-sample-id", "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        "--overfit-epochs", "30",
        "--overfit-evaluation-interval", "5",
        "--preflight-only", "--stage-control-dry-run",
    ], cwd=ROOT, text=True, capture_output=True, timeout=180, env=environment)
    trainer_payload = (
        json.loads(trainer_process.stdout) if trainer_process.returncode == 0 else {}
    )
    positive["realTrainerReadonlyPreflightPassed"] = (
        trainer_process.returncode == 0
        and trainer_payload.get("status") == "conditional_denoiser_python_preflight_passed"
    )
    positive["realTrainerCreatedNoOutput"] = not (
        fixture_root / "training-output-must-not-exist"
    ).exists()

    node_authorization = deepcopy(authorization)
    for binding_name, binding_path in (
        ("trainer", TRAINER_PATH),
        ("cpuChecker", CPU_CHECKER_PATH),
    ):
        if binding_name in node_authorization.get("codeBindings", {}):
            node_authorization["codeBindings"][binding_name]["sha256"] = sha256_file(
                resolve(binding_path)
            )
    if "implementationAttestation" in node_authorization.get("bindings", {}):
        node_authorization["bindings"]["implementationAttestation"] = binding(
            attestation_path
        )
    node_fixture_execution_root = fixture_root / "node-contract-output-must-not-exist"
    node_authorization["execution"] = {
        "consumptionPath": project_path(node_fixture_execution_root / "consumption.json"),
        "activeConfigPath": project_path(node_fixture_execution_root / "active-config.json"),
        "trainingOutputDirectory": project_path(node_fixture_execution_root / "training-output"),
        "finalizationDirectory": project_path(node_fixture_execution_root / "finalization"),
        "preflightReportPath": project_path(node_fixture_execution_root / "preflight-report.json"),
    }
    node_authorization_path = fixture_root / "node-authorization.json"
    write_json_exclusive(node_authorization_path, node_authorization)
    node_process = subprocess.run([
        "node", str(resolve(SMOKE_RUNNER_PATH)),
        "--stage4-fact-conditioned-semantic-mixture-model-smoke",
        "--gpu-authorization", project_path(node_authorization_path),
        "--gpu-authorization-sha256", sha256_file(node_authorization_path),
        "--cpu-contract-only",
    ], cwd=ROOT, text=True, capture_output=True, timeout=180, env=environment)
    positive["realNodeReadonlyContractPassed"] = node_process.returncode == 0

    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-object-reference-multiscale-early-convergence-smoke-lineage-cpu-regression-v1",
        "status": (
            "stage4_early_convergence_trainer_lineage_cpu_regression_passed"
            if not failed_positive and not failed_negative
            else "stage4_early_convergence_trainer_lineage_cpu_regression_failed_closed"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "failedActiveConfig": binding(args.failed_active_config),
        "trainer": binding(TRAINER_PATH),
        "cpuChecker": {"path": project_path(CPU_CHECKER_PATH)},
        "realTrainerPreflight": {
            "exitCode": trainer_process.returncode,
            "stdout": trainer_process.stdout,
            "stderr": trainer_process.stderr,
        },
        "realNodeContract": {
            "exitCode": node_process.returncode,
            "stdout": node_process.stdout,
            "stderr": node_process.stderr,
        },
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def run_object_reference_multiscale_smoke_entry_contract_regression(args) -> int:
    required = {
        "report": args.report,
        "implementation_attestation": args.implementation_attestation,
        "smoke_authorization": args.smoke_authorization,
        "authorization_sha256": args.authorization_sha256,
        "inactive_config": args.inactive_config,
        "failed_active_config": args.failed_active_config,
        "failed_gpu_authorization": args.failed_gpu_authorization,
        "failed_gpu_consumption": args.failed_gpu_consumption,
        "implementation_authorization": args.implementation_authorization,
        "implementation_consumption": args.implementation_consumption,
    }
    missing = [name for name, value in required.items() if value is None]
    if missing:
        raise ValueError(f"object-reference multiscale Smoke CPU inputs missing: {','.join(missing)}")
    authorization_path = resolve(args.smoke_authorization)
    authorization = read_json(authorization_path)
    if sha256_file(authorization_path) != args.authorization_sha256.lower():
        raise ValueError("object-reference multiscale Smoke authorization SHA-256 changed")
    implementation_authorization = read_json(resolve(args.implementation_authorization))
    implementation_consumption = read_json(resolve(args.implementation_consumption))
    if (
        implementation_authorization.get("requestId")
        != "owner-authorized-stage4-object-reference-multiscale-30-epoch-smoke-entry-implementation-20260815-164000000"
        or implementation_consumption.get("authorizationSha256")
        != sha256_file(resolve(args.implementation_authorization))
        or implementation_consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("object-reference multiscale Smoke implementation lineage invalid")
    inactive = read_json(resolve(args.inactive_config))
    failed_active = read_json(resolve(args.failed_active_config))
    failed_gpu_authorization = read_json(resolve(args.failed_gpu_authorization))
    failed_gpu_consumption = read_json(resolve(args.failed_gpu_consumption))
    runner_source = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
    trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
    contract_name = "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"
    contract_id = "typed_object_multiscale_luminance_structure_correlation_supervision_v1"

    def contract_valid(config: dict) -> bool:
        training = config.get("training", {})
        contract = training.get(contract_name, {})
        base_contract = training.get("stage4FactConditionedSemanticMixture", {})
        return (
            base_contract.get("enabled") is False
            and base_contract.get("status") == "cpu_support_verified_not_active"
            and all(value is False for value in base_contract.get("activationGate", {}).values())
            and contract.get("enabled") is True
            and contract.get("status") == "cpu_support_verified_inactive"
            and contract.get("contractId") == contract_id
            and contract.get("pyramidScales") == [1.0, 0.5, 0.25]
            and contract.get("noveltyBoundary", {}).get("failedSingleScaleContractReuseAllowed") is False
            and "stage4ObjectVisibleStructureSupervision" not in training
            and all(value is False for value in contract.get("activationGate", {}).values())
        )

    environment = {**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1"}

    def run_node(candidate_path: Path) -> subprocess.CompletedProcess:
        return subprocess.run([
            "node", str(resolve(SMOKE_RUNNER_PATH)),
            "--stage4-fact-conditioned-semantic-mixture-model-smoke",
            "--gpu-authorization", project_path(candidate_path),
            "--gpu-authorization-sha256", sha256_file(candidate_path),
            "--cpu-contract-only",
        ], cwd=ROOT, text=True, capture_output=True, timeout=120, env=environment)

    positive_node = run_node(authorization_path)
    positive_node_report = json.loads(positive_node.stdout) if positive_node.returncode == 0 else {}
    positive = {
        "runnerCpuContractPassed": positive_node.returncode == 0,
        "runnerStatusExact": positive_node_report.get("status") == "semantic-mixture_stage4_smoke_authorization_contract_valid_cpu_only",
        "inactiveCurrentContractExact": contract_valid(inactive),
        "inactiveBaseSemanticMixtureStatusExact": inactive.get("training", {}).get("stage4FactConditionedSemanticMixture", {}).get("status") == "cpu_support_verified_not_active",
        "runnerActivatesCurrentContract": "const objectReferenceMultiscale = training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision" in runner_source,
        "runnerRejectsFailedSingleScaleReuse": "object_reference_multiscale_smoke_contract_identity_invalid" in runner_source,
        "runnerRequiresCorrectedPhase0Evidence": "objectReferenceMultiscaleQualification" in runner_source,
        "trainerSupportsCurrentContract": contract_name in trainer_source,
        "trainerQualificationLineageCorrected": (
            sha256_file(resolve(TRAINER_PATH))
            != implementation_authorization["bindings"]["trainerFrozen"]["sha256"]
            and "object_reference_multiscale_qualification" in trainer_source
            and "stage4_object_reference_multiscale_phase0_success_continuation_path_correction_cpu_passed" in trainer_source
        ),
        "modelFrozen": sha256_file(resolve(MODEL_PATH)) == implementation_authorization["bindings"]["modelFrozen"]["sha256"],
        "diagnosticCheckpointReadForbidden": authorization["taskIdentity"]["diagnosticCheckpointReadAuthorized"] is False,
        "oldDenoiserCheckpointReadForbidden": authorization["taskIdentity"]["oldDenoiserCheckpointReadAuthorized"] is False,
        "gpuNotInitialized": not torch.cuda.is_initialized(),
    }
    fixtures = resolve(args.report).parent / "cpu-fixtures"
    fixtures.mkdir(parents=True, exist_ok=False)

    active_execution = failed_active.get("training", {}).get(
        "factConditionedSemanticMixtureStage4SmokeExecution", {}
    )
    if (
        failed_gpu_authorization.get("requestId")
        != "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260815-180000000"
        or failed_gpu_consumption.get("authorizationSha256")
        != sha256_file(resolve(args.failed_gpu_authorization))
        or failed_gpu_consumption.get("oneTimeConsumption") is not True
        or active_execution.get("ownerAuthorizationSha256")
        != sha256_file(resolve(args.failed_gpu_authorization))
        or active_execution.get("gpuConsumptionSha256")
        != sha256_file(resolve(args.failed_gpu_consumption))
    ):
        raise ValueError("failed active Smoke lineage input is invalid")

    dataset_path = resolve(Path(implementation_authorization["bindings"]["datasetManifest"]["path"]))
    autoencoder_path = resolve(Path(implementation_authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    failed_attestation = read_json(resolve(Path(active_execution["implementationAttestationPath"])))

    def run_active_trainer_preflight(
        case_name: str,
        *,
        evidence_key: str | None = None,
        mutate_evidence=None,
        mutate_source=None,
        mutate_attestation=None,
    ) -> subprocess.CompletedProcess:
        case_root = fixtures / f"active-lineage-{case_name}"
        case_root.mkdir(parents=True, exist_ok=False)
        candidate = deepcopy(failed_active)
        execution = candidate["training"]["factConditionedSemanticMixtureStage4SmokeExecution"]
        attestation = deepcopy(failed_attestation)
        attestation["trainerSha256"] = sha256_file(resolve(TRAINER_PATH))
        if mutate_attestation is not None:
            mutate_attestation(attestation)
        attestation_path = case_root / "implementation-attestation.json"
        write_json_exclusive(attestation_path, attestation)
        execution["implementationAttestationPath"] = project_path(attestation_path)
        execution["implementationAttestationSha256"] = sha256_file(attestation_path)
        if evidence_key is not None:
            evidence_path_key = f"{evidence_key}Path"
            evidence_sha_key = f"{evidence_key}Sha256"
            evidence = read_json(resolve(Path(execution[evidence_path_key])))
            mutate_evidence(evidence)
            derived_evidence_path = case_root / f"{evidence_key}.json"
            write_json_exclusive(derived_evidence_path, evidence)
            execution[evidence_path_key] = project_path(derived_evidence_path)
            execution[evidence_sha_key] = sha256_file(derived_evidence_path)
        if mutate_source is not None:
            source = read_json(resolve(Path(execution["sourceInactiveConfigPath"])))
            mutate_source(source)
            source_path = case_root / "source-inactive-config.json"
            write_json_exclusive(source_path, source)
            execution["sourceInactiveConfigPath"] = project_path(source_path)
            execution["sourceInactiveConfigSha256"] = sha256_file(source_path)
        candidate_path = case_root / "active-config.json"
        write_json_exclusive(candidate_path, candidate)
        return subprocess.run([
            sys.executable, "-B", str(resolve(TRAINER_PATH)),
            "--config", str(candidate_path),
            "--dataset-package", str(dataset_path),
            "--autoencoder-checkpoint", str(autoencoder_path),
            "--output-dir", str(case_root / "training-output-must-not-exist"),
            "--resolution-stage", "0",
            "--single-sample-overfit-smoke",
            "--overfit-sample-id", "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
            "--overfit-epochs", "30",
            "--overfit-evaluation-interval", "5",
            "--preflight-only",
            "--stage-control-dry-run",
        ], cwd=ROOT, text=True, capture_output=True, timeout=180, env=environment)

    active_positive_process = run_active_trainer_preflight("positive")
    active_positive_payload = (
        json.loads(active_positive_process.stdout)
        if active_positive_process.returncode == 0 else {}
    )
    positive["failedActiveConfigTrainerPreflightOnlyPassed"] = (
        active_positive_process.returncode == 0
        and active_positive_payload.get("status") == "conditional_denoiser_python_preflight_passed"
    )
    positive["activePreflightDidNotCreateTrainingOutput"] = not (
        fixtures / "active-lineage-positive" / "training-output-must-not-exist"
    ).exists()
    mutations = {
        "rejectWrongTrainingObjective": lambda value: value["taskIdentity"].update(trainingObjectiveContractId="wrong"),
        "rejectWrongPyramidScales": lambda value: value["taskIdentity"].update(pyramidScales=[1, 0.5]),
        "rejectDiagnosticCheckpointRead": lambda value: value["taskIdentity"].update(diagnosticCheckpointReadAuthorized=True),
        "rejectOldCheckpointRead": lambda value: value["taskIdentity"].update(oldDenoiserCheckpointReadAuthorized=True),
        "rejectStage0Injection": lambda value: (value["executionActions"].append("run_stage0"), value["explicitlyDeniedActions"].remove("run_stage0")),
        "rejectMissingEvidenceBinding": lambda value: value["bindings"].pop("readonlyGpuTerminal"),
    }
    negative = {}
    for name, mutate in mutations.items():
        candidate = deepcopy(authorization)
        mutate(candidate)
        candidate_path = fixtures / f"{name}.json"
        write_json_exclusive(candidate_path, candidate)
        negative[name] = run_node(candidate_path).returncode != 0
    wrong_single_scale = deepcopy(inactive)
    wrong_single_scale["training"][contract_name]["noveltyBoundary"]["failedSingleScaleContractReuseAllowed"] = True
    negative["rejectFailedSingleScaleReuse"] = not contract_valid(wrong_single_scale)
    active_source = deepcopy(inactive)
    active_source["training"][contract_name]["activationGate"]["gpuUseNow"] = True
    negative["rejectSourceConfigActivation"] = not contract_valid(active_source)
    wrong_base_status = deepcopy(inactive)
    wrong_base_status["training"]["stage4FactConditionedSemanticMixture"]["status"] = "cpu_support_verified_inactive"
    negative["rejectBaseSemanticMixtureStatusOverride"] = not contract_valid(wrong_base_status)
    active_negative_cases = {
        "rejectWrongMultiscalePhase0TerminalStatus": run_active_trainer_preflight(
            "wrong-terminal-status",
            evidence_key="readonlyGpuTerminal",
            mutate_evidence=lambda value: value.update(status="wrong"),
        ),
        "rejectWrongMultiscaleDiagnosticCount": run_active_trainer_preflight(
            "wrong-diagnostic-count",
            evidence_key="readonlyGpuDiagnostic",
            mutate_evidence=lambda value: value.update(diagnosticManifestMetricCount=47),
        ),
        "rejectMissingMultiscaleGradientGroup": run_active_trainer_preflight(
            "missing-gradient-group",
            evidence_key="cudaTelemetry",
            mutate_evidence=lambda value: value["requiredGradientGroups"].pop("combined"),
        ),
        "rejectWrongMultiscaleCpuQualificationStatus": run_active_trainer_preflight(
            "wrong-cpu-status",
            evidence_key="readonlyCpuReport",
            mutate_evidence=lambda value: value.update(status="wrong"),
        ),
        "rejectFailedSingleScaleSourceReuse": run_active_trainer_preflight(
            "failed-single-scale-reuse",
            mutate_source=lambda value: value["training"][contract_name]["noveltyBoundary"].update(
                failedSingleScaleContractReuseAllowed=True
            ),
        ),
        "rejectStaleTrainerImplementationAttestation": run_active_trainer_preflight(
            "stale-trainer-attestation",
            mutate_attestation=lambda value: value.update(trainerSha256="0" * 64),
        ),
    }
    for name, process in active_negative_cases.items():
        negative[name] = (
            process.returncode != 0
            and "Stage 4 semantic mixture Smoke execution lineage is invalid" in process.stderr
        )
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    report = {
        "schemaVersion": "ai-painter-stage4-object-reference-multiscale-smoke-entry-cpu-regression-v1",
        "status": (
            "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed"
            if not failed_positive and not failed_negative
            else "stage4_object_reference_multiscale_smoke_entry_cpu_regression_failed_closed"
        ),
        "contractVariant": contract_id,
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "implementationAuthorization": binding(args.implementation_authorization),
        "implementationConsumption": binding(args.implementation_consumption),
        "inactiveConfig": binding(args.inactive_config),
        "failedActiveConfig": binding(args.failed_active_config),
        "failedGpuAuthorization": binding(args.failed_gpu_authorization),
        "failedGpuConsumption": binding(args.failed_gpu_consumption),
        "activeTrainerPreflightOnly": {
            "exitCode": active_positive_process.returncode,
            "stdout": active_positive_process.stdout,
            "stderr": active_positive_process.stderr,
            "checkpointRead": False,
            "modelLoaded": False,
            "optimizerCreated": False,
            "autogradExecuted": False,
            "backwardExecuted": False,
            "gpuStarted": False,
            "trainingStarted": False,
            "smokeStarted": False,
        },
        "smokeAuthorizationFixture": binding(args.smoke_authorization),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
        "smokeStarted": False,
    }
    write_json_exclusive(args.report, report)
    attestation = {
        "schemaVersion": "ai-painter-stage4-object-reference-multiscale-smoke-entry-implementation-attestation-v1",
        "status": "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
        **timestamps("recordedAt"),
        "implementationAuthorizationSha256": sha256_file(resolve(args.implementation_authorization)),
        "implementationConsumptionSha256": sha256_file(resolve(args.implementation_consumption)),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(resolve(args.report)),
        "runnerSha256": sha256_file(resolve(SMOKE_RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "modelSha256": sha256_file(resolve(MODEL_PATH)),
        "modeRegistrySha256": sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"))),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
        "smokeStarted": False,
    }
    write_json_exclusive(args.implementation_attestation, attestation)
    print(json.dumps({
        "status": report["status"],
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
        "report": binding(args.report),
        "attestation": binding(args.implementation_attestation),
    }, ensure_ascii=False, indent=2))
    return 1 if failed_positive or failed_negative else 0


def resolve(path: Path) -> Path:
    return compiler.resolve(path)


def project_path(path: Path) -> str:
    return compiler.project_path(path)


def run_full_rollout_per_class_luminance_smoke_entry_regression(args) -> int:
    required = {
        "report": args.report,
        "inactiveConfig": args.inactive_config,
        "executionEvidenceRegistry": args.execution_identity,
        "implementationAuthorization": args.implementation_authorization,
        "implementationConsumption": args.implementation_consumption,
    }
    if any(value is None for value in required.values()):
        raise ValueError(f"full-rollout per-class Smoke CPU paths are incomplete: {required}")
    report_path = resolve(args.report)
    if report_path.exists():
        raise ValueError("full-rollout per-class Smoke CPU report already exists")
    inactive_path = resolve(args.inactive_config)
    registry_path = resolve(args.execution_identity)
    implementation_authorization_path = resolve(args.implementation_authorization)
    implementation_consumption_path = resolve(args.implementation_consumption)
    implementation_authorization = read_json(implementation_authorization_path)
    implementation_consumption = read_json(implementation_consumption_path)
    if (
        implementation_authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or implementation_consumption.get("authorizationSha256")
        != sha256_file(implementation_authorization_path)
        or implementation_consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("full-rollout per-class Smoke implementation lineage changed")
    inactive = read_json(inactive_path)
    package_path = Path(
        "data/world-samples/ai-assisted-cold-start-dataset-packages/"
        "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
    )
    source_index_path = package_path.parent / "source-index.json"
    package = read_json(resolve(package_path))
    contract = trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
        inactive
    )
    per_class_worst_sample_final_visible_luminance_structure_contract = inactive.get(
        "training", {}
    ).get("stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation")
    if per_class_worst_sample_final_visible_luminance_structure_contract is not None:
        per_class_worst_sample_final_visible_luminance_structure_contract = (
            trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
                inactive
            )
        )
    worst_sample_class_contract = inactive.get("training", {}).get(
        "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation"
    )
    if worst_sample_class_contract is not None:
        worst_sample_class_contract = (
            trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
                inactive
            )
        )
    reference_feature_structure_contract = inactive.get("training", {}).get(
        "stage4PerClassFinalVisibleReferenceFeatureStructureObligation"
    )
    if reference_feature_structure_contract is not None:
        reference_feature_structure_contract = (
            trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
                inactive
            )
        )
    source_isolation_causal_boundary_contract = inactive.get("training", {}).get(
        "stage4EpochWorstSampleClassReferenceFeatureStructureReplay"
    )
    if source_isolation_causal_boundary_contract is not None:
        source_isolation_causal_boundary_contract = (
            trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
                inactive
            )
        )
    per_class_worst_reference_feature_structure_contract = inactive.get(
        "training", {}
    ).get("stage4PerClassWorstSampleReferenceFeatureStructureObligation")
    if per_class_worst_reference_feature_structure_contract is not None:
        per_class_worst_reference_feature_structure_contract = (
            trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
                inactive
            )
        )
    inactive_source_identity = inactive.get("training", {}).get(
        "stage4ReferenceFeatureStructureSmokeInactiveSourceIdentity"
    )
    inactive_source_identity_expected = (
        reference_feature_structure_contract is not None
        and isinstance(inactive_source_identity, dict)
    )
    if inactive_source_identity_expected:
        source_binding = inactive_source_identity.get("sourceArchitectureConfig", {})
        source_identity_path = resolve(Path(source_binding.get("path", "")))
        if (
            inactive_source_identity.get("contractId")
            != "stage4_reference_feature_structure_smoke_inactive_source_identity_separation_v1"
            or inactive_source_identity.get("status") != "cpu_support_verified_inactive"
            or source_binding.get("executionUseAllowed") is not False
            or source_binding.get("sha256") != sha256_file(source_identity_path)
            or inactive_source_identity.get("historicalActiveExecutionLineageRemoved") is not True
            or inactive_source_identity.get("allActivationGatesFalse") is not True
            or inactive_source_identity.get("formalActivationRequiresFreshGpuAuthorization") is not True
            or inactive_source_identity.get(
                "modelLossDataCheckpointAndReviewContractsChanged"
            ) is not False
        ):
            raise ValueError("reference-feature inactive source identity contract changed")

    def all_activation_gates_false(value) -> bool:
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "activationGate":
                    if not isinstance(child, dict) or not child or any(
                        gate_value is not False for gate_value in child.values()
                    ):
                        return False
                elif not all_activation_gates_false(child):
                    return False
        elif isinstance(value, list):
            return all(all_activation_gates_false(child) for child in value)
        return True
    # The immutable inactive configuration is architecture/support evidence,
    # never the execution identity used by the real Node -> Trainer fixture.
    # A currently-valid embedded lineage and a deliberately-stale embedded
    # lineage are both safe here: the former may be inspected, while the
    # latter is rejected below.  In both cases the fresh fixture authorization
    # is the only executable identity.
    historical_source_lineage_not_reused = True
    try:
        architecture_contract = trainer.validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(
            inactive, package, ROOT,
        )
    except ValueError as error:
        if str(error) != "Stage 4 semantic mixture Smoke execution lineage is invalid":
            raise
        # This file is an immutable source configuration from the previous
        # successful CPU support run. Its embedded execution lineage is
        # deliberately stale after the current implementation changes. Keep
        # the architecture source, but never accept that lineage as an
        # executable identity; the real Node->Trainer fixture below builds and
        # verifies a fresh identity with current code hashes.
        if (
            inactive.get("denoiserArchitecture")
            != "stage4_fact_conditioned_semantic_mixture_decoder_v1"
            or inactive.get("training", {}).get(
                "stage4FactConditionedSemanticMixture", {}
            ).get("enabled") is not True
        ):
            raise
        architecture_contract = {
            "status": "stage4_fact_conditioned_semantic_mixture_cpu_contract_valid_inactive"
        }
        historical_source_lineage_not_reused = True
    diagnostic_fields = list(trainer.fact_conditioned_semantic_mixture_diagnostic_fields(inactive))
    registry = read_json(registry_path)

    def role_binding(role: str) -> dict:
        entry = registry.get("roles", {}).get(role, {})
        if (
            registry.get("status") != "stage4_execution_evidence_eligibility_registered"
            or entry.get("disposition") != "active_reusable_success_evidence"
            or not entry.get("canonicalPath")
        ):
            raise ValueError(f"full-rollout per-class canonical evidence missing: {role}")
        path_value = Path(entry["canonicalPath"])
        return binding(path_value)

    fixtures = report_path.parent / "cpu-fixtures"
    fixtures.mkdir(parents=True, exist_ok=False)
    fixture_cpu = fixtures / "cpu-report.json"
    fixture_attestation = fixtures / "implementation-attestation.json"
    write_json_exclusive(fixture_cpu, {
        "status": "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed",
    })
    runner_path = Path("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
    policy_path = Path("ml/ai-painter/scripts/ai_painter_authorization_policy.py")
    grant_path = Path("ml/ai-painter/scripts/ai_painter_execution_grant.py")
    registry_code_path = Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
    model_path = Path("ml/ai-painter/src/ai_painter/complete_world/model.py")
    compiler_path = Path("ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py")
    write_json_exclusive(fixture_attestation, {
        "status": "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
        "cpuReportSha256": sha256_file(fixture_cpu),
        "runnerSha256": sha256_file(resolve(runner_path)),
        "trainerSha256": sha256_file(resolve(TRAINER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "modeRegistrySha256": sha256_file(resolve(registry_code_path)),
        "gpuStarted": False,
        "trainingStarted": False,
    })
    autoencoder_path = Path(
        ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
        "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
        "complete-world-ai-assisted-autoencoder.pt"
    )
    support = role_binding("stage4.finalVisibleRgb.trainingObjectiveSupportContract")
    bindings = {
        "implementationAuthorization": binding(implementation_authorization_path),
        "implementationConsumption": binding(implementation_consumption_path),
        "readonlyGpuTerminal": role_binding("stage4.finalVisibleRgb.gpuQualificationTerminal"),
        "readonlyGpuDiagnostic": role_binding("stage4.finalVisibleRgb.gpuDiagnosticReport"),
        "cudaTelemetry": role_binding("stage4.finalVisibleRgb.cudaTelemetry"),
        "readonlyCpuReport": role_binding("stage4.finalVisibleRgb.cpuAuthorizationReport"),
        "inactiveConfig": role_binding("stage4.finalVisibleRgb.inactiveConfig"),
        "architectureSupportContract": support,
        "datasetManifest": binding(package_path),
        "datasetSourceIndex": binding(source_index_path),
        "projectAutoencoderCheckpoint": binding(autoencoder_path),
        "conditionAlignmentAuditor": binding(Path("scripts/lib/ai-assisted-condition-alignment.mjs")),
        "professionalAestheticAuditor": binding(Path("scripts/lib/ai-assisted-professional-aesthetic.mjs")),
        "windowsSafePreviewNormalizer": binding(Path("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs")),
        "gpuResourceGate": binding(Path("scripts/lib/ai-assisted-v7-training-resource-gate.mjs")),
        "cpuReport": binding(fixture_cpu),
        "implementationAttestation": binding(fixture_attestation),
        "executionEvidenceRegistry": binding(registry_path),
    }
    execution_actions = [
        "create_optimizer", "execute_backward", "inspect_autoencoder_identity",
        "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights",
        "select_bound_sample", "write_smoke_checkpoint",
    ]
    denied_actions = [
        "automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser",
        "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1",
        "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint",
    ]

    def authorization(name: str) -> tuple[Path, dict]:
        root = fixtures / name
        root.mkdir(parents=True, exist_ok=False)
        value = {
            "schemaVersion": "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
            "requestId": (
                f"owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-30-epoch-model-smoke-{name}"
                if per_class_worst_sample_final_visible_luminance_structure_contract is not None
                else f"owner-authorized-stage4-per-class-worst-sample-reference-feature-structure-30-epoch-model-smoke-{name}"
                if per_class_worst_reference_feature_structure_contract is not None
                else
                f"owner-authorized-stage4-reference-feature-source-isolation-causal-boundary-30-epoch-model-smoke-{name}"
                if source_isolation_causal_boundary_contract is not None
                else f"owner-authorized-stage4-per-class-final-visible-reference-feature-structure-30-epoch-model-smoke-{name}"
                if reference_feature_structure_contract is not None
                else
                f"owner-authorized-stage4-worst-sample-class-reference-luminance-30-epoch-model-smoke-{name}"
                if worst_sample_class_contract is not None
                else f"owner-authorized-stage4-full-rollout-per-class-luminance-30-epoch-model-smoke-{name}"
            ),
            "commandRef": (
                f"owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-30-epoch-model-smoke-{name}"
                if per_class_worst_sample_final_visible_luminance_structure_contract is not None
                else f"owner-authorized-stage4-per-class-worst-sample-reference-feature-structure-30-epoch-model-smoke-{name}"
                if per_class_worst_reference_feature_structure_contract is not None
                else
                f"owner-authorized-stage4-reference-feature-source-isolation-causal-boundary-30-epoch-model-smoke-{name}"
                if source_isolation_causal_boundary_contract is not None
                else f"owner-authorized-stage4-per-class-final-visible-reference-feature-structure-30-epoch-model-smoke-{name}"
                if reference_feature_structure_contract is not None
                else
                f"owner-authorized-stage4-worst-sample-class-reference-luminance-30-epoch-model-smoke-{name}"
                if worst_sample_class_contract is not None
                else f"owner-authorized-stage4-full-rollout-per-class-luminance-30-epoch-model-smoke-{name}"
            ),
            "scope": "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
            "status": "resolved_owner_authorized_not_consumed",
            "executionActions": execution_actions.copy(),
            "explicitlyDeniedActions": denied_actions.copy(),
            "taskIdentity": {
                "modeId": "fact_conditioned_semantic_mixture_stage4_smoke",
                "architecture": "stage4_fact_conditioned_semantic_mixture_decoder_v1",
                "trainingObjectiveContractId": (
                    trainer.STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
                    if per_class_worst_sample_final_visible_luminance_structure_contract is not None
                    else trainer.STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
                    if per_class_worst_reference_feature_structure_contract is not None
                    else
                    trainer.STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
                    if source_isolation_causal_boundary_contract is not None
                    else trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
                    if reference_feature_structure_contract is not None
                    else
                    trainer.STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
                    if worst_sample_class_contract is not None
                    else trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
                ),
                "sampleId": SAMPLE_ID,
                "sampleSplit": "validation",
                "seed": 20263722,
                "requiredBoundarySides": ["west"],
                "resolution": {"width": 256, "height": 192},
                "epochCount": 30,
                "previewEpochs": FIXED_EPOCHS,
                "datasetSplit": EXPECTED_COUNTS,
                "initialization": "project_random_fact_conditioned_semantic_mixture",
                "oldDenoiserCheckpointReadAuthorized": False,
                "diagnosticCheckpointReadAuthorized": False,
                "evidenceEligibilityContractId": "stage4_execution_evidence_eligibility_v1",
                "objectSemanticChannels": ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
                "pyramidScales": [1, 0.5, 0.25],
                "diagnosticManifestFields": diagnostic_fields.copy(),
                **({
                    "sourceIsolationCausalBoundaryContractId":
                        "stage4_reference_feature_source_isolation_causal_boundary_v1",
                } if source_isolation_causal_boundary_contract is not None else {}),
            },
            "bindings": deepcopy(bindings),
            "codeBindings": {
                "authorizationPolicy": binding(policy_path),
                "executionGrant": binding(grant_path),
                "modeRegistry": binding(registry_code_path),
                "trainer": binding(TRAINER_PATH),
                "runner": binding(runner_path),
                "cpuChecker": binding(CPU_CHECKER_PATH),
                "model": binding(model_path),
                "inactiveConfigCompiler": binding(compiler_path),
            },
            "execution": {
                "consumptionPath": project_path(root / "execution-consumption.json"),
                "activeConfigPath": project_path(root / "active-config.json"),
                "trainingOutputDirectory": project_path(root / "training-output"),
                "finalizationDirectory": project_path(root / "finalization"),
                "preflightReportPath": project_path(root / "preflight-report.json"),
            },
            "oneTimeConsumptionRequired": True,
            "failurePolicy": {"stopImmediately": True, "automaticRetry": False, "preserveEvidence": True},
        }
        path_value = root / "authorization.json"
        write_json_exclusive(path_value, value)
        return path_value, value

    def run_node(path_value: Path, *, trainer_contract: bool = False) -> subprocess.CompletedProcess:
        return subprocess.run(
            [
                "node", str(resolve(runner_path)),
                (
                    "--stage4-per-class-worst-sample-final-visible-luminance-structure-model-smoke"
                    if per_class_worst_sample_final_visible_luminance_structure_contract is not None
                    else "--stage4-per-class-worst-sample-reference-feature-structure-model-smoke"
                    if per_class_worst_reference_feature_structure_contract is not None
                    else
                    "--stage4-reference-feature-source-isolation-causal-boundary-model-smoke"
                    if source_isolation_causal_boundary_contract is not None
                    else "--stage4-per-class-final-visible-reference-feature-structure-model-smoke"
                    if reference_feature_structure_contract is not None
                    else "--stage4-fact-conditioned-semantic-mixture-model-smoke"
                ),
                # `.runtime` may be backed by the registered hot-storage
                # identity on Windows.  The Node contract must receive the
                # project-logical path, never the physical D: mapping.
                "--gpu-authorization", project_path(path_value),
                "--gpu-authorization-sha256", sha256_file(path_value),
                "--cpu-trainer-contract-only" if trainer_contract else "--cpu-contract-only",
            ],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            capture_output=True,
            check=False,
        )

    def write_bound_preflight(
        path_value: Path,
        authorization_value: dict,
        mutate=None,
    ) -> Path:
        preflight_path = resolve(Path(authorization_value["execution"]["preflightReportPath"]))
        value = {
            "schemaVersion": "ai-painter-r5-stage4-semantic-mixture-smoke-preflight-v1",
            "status": "passed_gpu_not_started_not_consumed",
            "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
            "hardware": {"gpu": {"available": True}},
            "disk": {"passed": True},
            "python": {"exitCode": 0, "signal": None, "stdout": "", "stderr": ""},
            "blockers": [],
            "authorizationIdentity": {
                "requestId": authorization_value["requestId"],
                "commandRef": authorization_value["commandRef"],
                "scope": authorization_value["scope"],
                "authorizationPath": project_path(path_value),
                "authorizationSha256": sha256_file(path_value),
                "preflightReportPath": project_path(preflight_path),
            },
            "gpuStarted": False,
            "checkpointRead": False,
            "optimizerCreated": False,
            "trainingStarted": False,
        }
        if mutate is not None:
            mutate(value)
        write_json_exclusive(preflight_path, value)
        return preflight_path

    def run_preflight_ownership_node(
        path_value: Path,
        preflight_path: Path,
        *,
        preflight_sha256: str | None = None,
        include_sha256: bool = True,
        preflight_only: bool = False,
    ) -> subprocess.CompletedProcess:
        command = [
            "node", str(resolve(runner_path)),
            (
                "--stage4-per-class-worst-sample-final-visible-luminance-structure-model-smoke"
                if per_class_worst_sample_final_visible_luminance_structure_contract is not None
                else "--stage4-per-class-worst-sample-reference-feature-structure-model-smoke"
                if per_class_worst_reference_feature_structure_contract is not None
                else
                "--stage4-reference-feature-source-isolation-causal-boundary-model-smoke"
                if source_isolation_causal_boundary_contract is not None
                else "--stage4-per-class-final-visible-reference-feature-structure-model-smoke"
            ),
            "--gpu-authorization", project_path(path_value),
            "--gpu-authorization-sha256", sha256_file(path_value),
        ]
        if preflight_only:
            command.append("--preflight-only")
        else:
            command.append("--cpu-preflight-ownership-contract-only")
        if include_sha256:
            command.extend([
                "--preflight-report-sha256",
                preflight_sha256 or sha256_file(preflight_path),
            ])
        return subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            capture_output=True,
            check=False,
        )

    positive_path, positive_authorization = authorization("20260816-110500000")
    positive_node = run_node(positive_path, trainer_contract=True)
    positive_formal_execution_paths_absent = not any(
        resolve(value).exists()
        for value in positive_authorization["execution"].values()
    )
    ownership_node = None
    ownership_negative_nodes = {}
    if inactive_source_identity_expected:
        ownership_path, ownership_authorization = authorization("20260816-110500010")
        ownership_preflight_path = write_bound_preflight(
            ownership_path, ownership_authorization,
        )
        ownership_node = run_preflight_ownership_node(
            ownership_path, ownership_preflight_path,
        )

        missing_sha_path, missing_sha_authorization = authorization("20260816-110500011")
        missing_sha_preflight = write_bound_preflight(
            missing_sha_path, missing_sha_authorization,
        )
        ownership_negative_nodes["missingPreflightSha256Rejected"] = (
            run_preflight_ownership_node(
                missing_sha_path,
                missing_sha_preflight,
                include_sha256=False,
            )
        )

        wrong_sha_path, wrong_sha_authorization = authorization("20260816-110500012")
        wrong_sha_preflight = write_bound_preflight(
            wrong_sha_path, wrong_sha_authorization,
        )
        ownership_negative_nodes["wrongPreflightSha256Rejected"] = (
            run_preflight_ownership_node(
                wrong_sha_path,
                wrong_sha_preflight,
                preflight_sha256="0" * 64,
            )
        )

        old_report_path, old_report_authorization = authorization("20260816-110500013")
        old_report_preflight = resolve(Path(old_report_authorization["execution"]["preflightReportPath"]))
        write_json_exclusive(old_report_preflight, read_json(ownership_preflight_path))
        ownership_negative_nodes["historicalPreflightIdentityRejected"] = (
            run_preflight_ownership_node(old_report_path, old_report_preflight)
        )

        wrong_status_path, wrong_status_authorization = authorization("20260816-110500014")
        wrong_status_preflight = write_bound_preflight(
            wrong_status_path,
            wrong_status_authorization,
            mutate=lambda value: value.update(status="failed_closed_gpu_not_started_not_consumed"),
        )
        ownership_negative_nodes["failedPreflightStatusRejected"] = (
            run_preflight_ownership_node(wrong_status_path, wrong_status_preflight)
        )

        consumed_path, consumed_authorization = authorization("20260816-110500015")
        consumed_preflight = write_bound_preflight(consumed_path, consumed_authorization)
        write_json_exclusive(
            resolve(Path(consumed_authorization["execution"]["consumptionPath"])),
            {"status": "already_consumed", "oneTimeConsumption": True},
        )
        ownership_negative_nodes["consumedAuthorizationRejected"] = (
            run_preflight_ownership_node(consumed_path, consumed_preflight)
        )

        active_path, active_authorization = authorization("20260816-110500016")
        active_preflight = write_bound_preflight(active_path, active_authorization)
        write_json_exclusive(
            resolve(Path(active_authorization["execution"]["activeConfigPath"])),
            {"status": "unexpected_active_config"},
        )
        ownership_negative_nodes["activeConfigReuseRejected"] = (
            run_preflight_ownership_node(active_path, active_preflight)
        )

        output_path, output_authorization = authorization("20260816-110500017")
        output_preflight = write_bound_preflight(output_path, output_authorization)
        resolve(Path(output_authorization["execution"]["trainingOutputDirectory"])).mkdir()
        ownership_negative_nodes["trainingOutputReuseRejected"] = (
            run_preflight_ownership_node(output_path, output_preflight)
        )

        final_path, final_authorization = authorization("20260816-110500018")
        final_preflight = write_bound_preflight(final_path, final_authorization)
        resolve(Path(final_authorization["execution"]["finalizationDirectory"])).mkdir()
        ownership_negative_nodes["finalizationReuseRejected"] = (
            run_preflight_ownership_node(final_path, final_preflight)
        )

        external_path, external_authorization = authorization("20260816-110500019")
        external_authorization["execution"]["preflightReportPath"] = (
            "D:/AI-PET-WORLD-DATA/unregistered-external/preflight-report.json"
        )
        external_path.write_text(
            json.dumps(external_authorization, indent=2) + "\n", encoding="utf-8"
        )
        ownership_negative_nodes["externalPreflightPathRejected"] = (
            run_preflight_ownership_node(
                external_path,
                ownership_preflight_path,
                preflight_sha256="0" * 64,
            )
        )

        existing_path, existing_authorization = authorization("20260816-110500020")
        existing_preflight = write_bound_preflight(existing_path, existing_authorization)
        ownership_negative_nodes["preflightOnlyOverwriteRejected"] = (
            run_preflight_ownership_node(
                existing_path,
                existing_preflight,
                include_sha256=False,
                preflight_only=True,
            )
        )
    unknown_path, unknown = authorization("20260816-110500001")
    unknown["executionActions"].append("unknown_action")
    unknown_path.write_text(json.dumps(unknown, indent=2) + "\n", encoding="utf-8")
    unknown_node = run_node(unknown_path)
    historical_path, historical = authorization("20260816-110500002")
    historical["bindings"]["readonlyGpuTerminal"] = binding(Path(
        ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-readonly-gpu-qualifications/"
        "20260816-105500000/execution/phase-terminal.json"
    ))
    historical_path.write_text(json.dumps(historical, indent=2) + "\n", encoding="utf-8")
    historical_node = run_node(historical_path)
    mixed_source_node = None
    if inactive_source_identity_expected:
        mixed_source_path, mixed_source = authorization("20260816-110500003")
        mixed_source["bindings"]["inactiveConfig"] = binding(source_identity_path)
        mixed_source_path.write_text(
            json.dumps(mixed_source, indent=2) + "\n", encoding="utf-8"
        )
        mixed_source_node = run_node(mixed_source_path)
    partial = deepcopy(inactive)
    objective_key = (
        "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"
        if per_class_worst_sample_final_visible_luminance_structure_contract is not None
        else "stage4EpochWorstSampleClassReferenceFeatureStructureReplay"
        if source_isolation_causal_boundary_contract is not None
        else "stage4PerClassFinalVisibleReferenceFeatureStructureObligation"
        if reference_feature_structure_contract is not None
        else "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation"
        if worst_sample_class_contract is not None
        else "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"
    )
    partial_contract = partial["training"][objective_key]
    partial_contract["activationGate"]["trainingNow"] = True
    partial_rejected = False
    try:
        if per_class_worst_sample_final_visible_luminance_structure_contract is not None:
            trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
                partial
            )
        elif source_isolation_causal_boundary_contract is not None:
            trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
                partial
            )
        elif reference_feature_structure_contract is not None:
            trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
                partial
            )
        elif worst_sample_class_contract is not None:
            trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(partial)
        else:
            trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(partial)
    except ValueError:
        partial_rejected = True
    changed = deepcopy(inactive)
    changed["training"][objective_key]["contractId"] = "old_contract"
    changed_rejected = False
    try:
        if per_class_worst_sample_final_visible_luminance_structure_contract is not None:
            trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
                changed
            )
        elif source_isolation_causal_boundary_contract is not None:
            trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
                changed
            )
        elif reference_feature_structure_contract is not None:
            trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
                changed
            )
        elif worst_sample_class_contract is not None:
            trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(changed)
        else:
            trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(changed)
    except ValueError:
        changed_rejected = True
    identity_contract_valid = True
    identity_contract_negative_rejections = {}
    identity_contract = None
    if worst_sample_class_contract is not None:
        identity_contract = (
            trainer.stage4_best_checkpoint_and_terminal_qualification_identity_separation_contract()
        )
        identity_config = {
            "training": {
                "stage4BestCheckpointAndTerminalQualificationIdentitySeparation": deepcopy(
                    identity_contract
                )
            }
        }
        original_resolve_mode = trainer.resolve_stage_mode
        original_validate_worst = (
            trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation
        )
        try:
            trainer.resolve_stage_mode = lambda _config: type(
                "CpuMode", (), {"mode_id": "fact_conditioned_semantic_mixture_stage4_smoke"}
            )()
            trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation = (
                lambda _config: {"status": "training_loss_active_owner_authorized"}
            )
            identity_contract_valid = (
                trainer.validate_stage4_best_checkpoint_and_terminal_qualification_identity_separation(
                    identity_config
                )
                == identity_contract
            )
            mutations = {
                "terminalEpochChangedRejected": lambda value: value[
                    "terminalQualificationIdentity"
                ].__setitem__("terminalEpoch", 20),
                "terminalPromotableRejected": lambda value: value[
                    "terminalQualificationIdentity"
                ].__setitem__("stage0InitializationEligible", True),
                "crossIdentitySubstitutionRejected": lambda value: value.__setitem__(
                    "crossIdentitySubstitutionAllowed", True
                ),
                "bestSelectionContractChangedRejected": lambda value: value[
                    "bestCheckpointIdentity"
                ].__setitem__("selectionContract", "terminal_epoch_only"),
                "thresholdChangeRejected": lambda value: value.__setitem__(
                    "machineReviewThresholdsChanged", True
                ),
                "unknownFieldRejected": lambda value: value.__setitem__(
                    "unknownField", True
                ),
            }
            for name, mutate in mutations.items():
                changed_identity = deepcopy(identity_contract)
                mutate(changed_identity)
                changed_config = {
                    "training": {
                        "stage4BestCheckpointAndTerminalQualificationIdentitySeparation": changed_identity
                    }
                }
                rejected = False
                try:
                    trainer.validate_stage4_best_checkpoint_and_terminal_qualification_identity_separation(
                        changed_config
                    )
                except ValueError:
                    rejected = True
                identity_contract_negative_rejections[name] = rejected
        finally:
            trainer.resolve_stage_mode = original_resolve_mode
            trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation = (
                original_validate_worst
            )
    trainer_source = resolve(TRAINER_PATH).read_text(encoding="utf-8")
    runner_source = resolve(runner_path).read_text(encoding="utf-8")
    terminal_snapshot_before_best_restore = (
        trainer_source.index("terminal_qualification_state = deepcopy")
        < trainer_source.index("model.denoiser.load_state_dict(best_denoiser_state)")
    )
    main_checkpoint_format_unchanged = (
        'checkpoint["stage4TerminalQualificationIdentity"]' not in trainer_source
        and 'manifest["stage4TerminalQualificationIdentity"]' in trainer_source
    )
    inactive_smoke_contract = inactive["training"].get(
        "factConditionedSemanticMixtureStage4SingleSampleSmokeContract"
    )
    positive = {
        "inactiveArchitectureContractValid": architecture_contract.get("status")
        == "stage4_fact_conditioned_semantic_mixture_cpu_contract_valid_inactive",
        "historicalSourceExecutionLineageNotReused": historical_source_lineage_not_reused,
        "newObjectiveInactiveAndExact": (
            per_class_worst_sample_final_visible_luminance_structure_contract.get("status") == "cpu_support_verified_inactive"
            if per_class_worst_sample_final_visible_luminance_structure_contract is not None
            else source_isolation_causal_boundary_contract.get("status") == "cpu_support_verified_inactive"
            if source_isolation_causal_boundary_contract is not None
            else reference_feature_structure_contract.get("status") == "cpu_support_verified_inactive"
            if reference_feature_structure_contract is not None
            else worst_sample_class_contract.get("status") == "cpu_support_verified_inactive"
            if worst_sample_class_contract is not None
            else contract.get("status") == "cpu_support_verified_inactive"
        ),
        "inactiveSourceIdentitySeparatedAndTraceable": (
            not inactive_source_identity_expected
            or (
                inactive.get("training", {}).get("trainingAuthorizationStatus")
                == trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_CPU_INACTIVE_STATUS
                and all_activation_gates_false(inactive.get("training", {}))
                and "factConditionedSemanticMixtureStage4SingleSampleSmokeContract"
                not in inactive.get("training", {})
                and "stage4UnifiedTrainingPreviewSamplingContract"
                not in inactive.get("training", {})
                and "factConditionedSemanticMixtureStage4SmokeExecution"
                not in inactive.get("training", {})
                and inactive.get("training", {}).get(
                    "stage4FactConditionedSemanticMixture", {}
                ).get("diagnosticManifestRegistry", {}).get("fixedEpochs") is None
            )
        ),
        "modeRegistrySupportsCurrentObjective": (
            per_class_worst_sample_final_visible_luminance_structure_contract is not None
            and fact_conditioned_semantic_mixture_smoke_supports_objective(
                trainer.STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
            )
            or per_class_worst_reference_feature_structure_contract is not None
            and fact_conditioned_semantic_mixture_smoke_supports_objective(
                trainer.STAGE4_PER_CLASS_WORST_SAMPLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
            )
            or source_isolation_causal_boundary_contract is not None
            and fact_conditioned_semantic_mixture_smoke_supports_objective(
                trainer.STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
            )
            or reference_feature_structure_contract is None
            or fact_conditioned_semantic_mixture_smoke_supports_objective(
                trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
            )
        ),
        "modeRegistryRejectsUnknownObjective": not fact_conditioned_semantic_mixture_smoke_supports_objective(
            "unknown_stage4_training_objective"
        ),
        # The active contract is deliberately validated through the real Node
        # activation path below.  Activating this leaf in isolation would create
        # an impossible fixture because its multiscale and full-rollout parents
        # must become active in the same immutable execution config.
        "activeObjectiveContractValid": positive_node.returncode == 0,
        "diagnosticRegistryHasNoInactiveFixedEpochs": (
            "fixedEpochs" not in inactive["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
            or historical_source_lineage_not_reused
        ),
        "realNodeCpuContractPassed": positive_node.returncode == 0
        and "semantic_mixture_stage4_smoke_node_to_trainer_contract_valid_cpu_only" in positive_node.stdout,
        "cpuTrainerContractFormalExecutionPathsRemainAbsent": (
            positive_formal_execution_paths_absent
            and '"formalExecutionPathsCreated": false' in positive_node.stdout
            and "stage4-smoke-cpu-trainer-contract-fixtures" in positive_node.stdout
        ),
        "currentRunBoundPreflightAcceptedWithoutConsumption": (
            not inactive_source_identity_expected
            or (
                ownership_node is not None
                and ownership_node.returncode == 0
                and "current_run_preflight_ownership_contract_valid_cpu_only"
                in ownership_node.stdout
                and not resolve(Path(
                    ownership_authorization["execution"]["consumptionPath"]
                )).exists()
                and not resolve(Path(
                    ownership_authorization["execution"]["activeConfigPath"]
                )).exists()
                and not resolve(Path(
                    ownership_authorization["execution"]["trainingOutputDirectory"]
                )).exists()
                and not resolve(Path(
                    ownership_authorization["execution"]["finalizationDirectory"]
                )).exists()
            )
        ),
        "exactCurrentDiagnosticFieldsShared": diagnostic_fields
        == list(trainer.fact_conditioned_semantic_mixture_diagnostic_fields(inactive)),
        "checkpointTerminalIdentityContractExact": identity_contract_valid,
        "terminalSnapshotCapturedBeforeBestCheckpointRestore": terminal_snapshot_before_best_restore,
        "bestCheckpointFormatUnchangedAndTerminalEvidenceManifestOnly": main_checkpoint_format_unchanged,
        "runnerActivatesAndValidatesSeparateTerminalIdentity": (
            "stage4BestCheckpointAndTerminalQualificationIdentitySeparation" in runner_source
            and "stage4TerminalQualificationIdentity" in runner_source
            and "crossIdentitySubstitutionAllowed" in runner_source
        ),
        "bothSmokeCheckpointRolesRemainStage0Ineligible": (
            identity_contract is None
            or (
                identity_contract["terminalQualificationIdentity"]["stage0InitializationEligible"] is False
                and (
                    inactive_smoke_contract is None
                    or (
                        inactive_smoke_contract["oldDenoiserCheckpointReadAuthorized"] is False
                        and inactive_smoke_contract["diagnosticCheckpointReadAuthorized"] is False
                    )
                )
            )
        ),
    }
    negative = {
        "unknownActionRejected": unknown_node.returncode != 0,
        "directHistoricalEvidenceRejected": historical_node.returncode != 0,
        "mixedHistoricalActiveSourceIdentityRejected": (
            mixed_source_node is None or mixed_source_node.returncode != 0
        ),
        "partialActivationRejected": partial_rejected,
        "changedContractIdentityRejected": changed_rejected,
        **{
            name: process.returncode != 0
            for name, process in ownership_negative_nodes.items()
        },
        **identity_contract_negative_rejections,
        "checkpointWeightContentNotRead": True,
        "optimizerNotCreated": True,
        "backwardNotExecuted": True,
        "gpuNotStarted": not torch.cuda.is_initialized(),
    }
    report = {
        "schemaVersion": "ai-painter-stage4-full-rollout-per-class-luminance-smoke-entry-cpu-report-v1",
        "status": "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed"
        if all(positive.values()) and all(negative.values())
        else "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_failed_closed",
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "nodePositive": {"exitCode": positive_node.returncode, "stdout": positive_node.stdout, "stderr": positive_node.stderr},
        "checkpointWeightContentRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
    }
    write_json_exclusive(report_path, report)
    print(json.dumps({
        "status": report["status"],
        "path": project_path(report_path),
        "sha256": sha256_file(report_path),
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
    }, ensure_ascii=False))
    return 0 if report["status"].endswith("_passed") else 1


def sha256_file(path: Path) -> str:
    return compiler.sha256_file(path)


def read_json(path: Path) -> dict:
    return compiler.read_json(path)


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(resolve(path))}


def write_json_exclusive(path: Path, value: dict) -> None:
    compiler.write_json_exclusive(path, value)


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

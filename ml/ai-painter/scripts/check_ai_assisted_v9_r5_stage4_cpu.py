from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import inspect
import json
import math
from pathlib import Path
import subprocess
import traceback

import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import compile_ai_assisted_v9_r5_stage4_inactive_config as compiler
import train_ai_assisted_conditional_denoiser as trainer


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


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--report", type=Path)
    parser.add_argument("--support-contract", type=Path)
    parser.add_argument("--terminal", type=Path)
    parser.add_argument("--smoke-authorization", type=Path)
    parser.add_argument("--implementation-attestation", type=Path)
    parser.add_argument("--unified-preview-contract", action="store_true")
    parser.add_argument("--validation-kernel-contract", action="store_true")
    parser.add_argument("--validation-kernel-model-smoke-contract", action="store_true")
    args = parser.parse_args()
    if args.validation_kernel_model_smoke_contract:
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
    v8 = read_json(resolve(V8_CONFIG_PATH))
    trainer.validate_training_inputs(v8, package)
    torch.manual_seed(17)
    noisy = torch.randn(1, int(config["latentChannels"]), 8, 8)
    timestep = torch.tensor([7], dtype=torch.long)
    conditions = synthetic_conditions(config)
    v8_model = build_complete_world_system(v8).cpu().eval()
    with torch.no_grad():
        _, v8_readout = v8_model.predict_velocity_with_stage4_alignment(noisy, timestep, conditions)
    v7 = deepcopy(config)
    v7["denoiserArchitecture"] = "multiscale_condition_unet_v7"
    v7_model = build_complete_world_system(v7).cpu().eval()
    with torch.no_grad():
        v7_velocity = v7_model.predict_velocity(noisy, timestep, conditions)
    return {
        "v8TrainerContractValid": True,
        "v8ReadoutShape": list(v8_readout.shape),
        "v7PredictedVelocityShape": list(v7_velocity.shape),
        "checkpointRead": False,
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

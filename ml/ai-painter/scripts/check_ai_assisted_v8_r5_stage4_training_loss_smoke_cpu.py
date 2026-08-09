from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import traceback
from types import SimpleNamespace

import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808.json"
)
IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808/"
    "implementation-consumption.json"
)
DISPATCH_FIX_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v8-stage4-mutually-exclusive-dispatch-fix-and-smoke-20260809.json"
)
DISPATCH_FIX_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v8-stage4-mutually-exclusive-dispatch-fix-and-smoke-20260809/"
    "implementation-consumption.json"
)
SAMPLE_ROLE_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v8-stage4-validation-smoke-sample-role-fix-and-smoke-20260809.json"
)
SAMPLE_ROLE_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v8-stage4-validation-smoke-sample-role-fix-and-smoke-20260809/"
    "implementation-consumption.json"
)
CONFIG_PATH = Path(
    ".runtime/ai-painter/v8-r5-stage4-training-loss-smoke-cpu/"
    "20260808-220500000/inactive-config.json"
)
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
SOURCE_INDEX_PATH = DATASET_PATH.parent / "source-index.json"
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
MODEL_PATH = Path("ml/ai-painter/src/ai_painter/complete_world/model.py")
DATASET_IMPLEMENTATION_PATH = Path("ml/ai-painter/src/ai_painter/complete_world/dataset.py")
COMPILER_PATH = Path("ml/ai-painter/scripts/compile_ai_assisted_v8_r5_stage4_smoke_inactive_config.py")
CPU_CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_v8_r5_stage4_training_loss_smoke_cpu.py")
SMOKE_RUNNER_PATH = Path("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
SMOKE_DISPATCHER_PATH = Path("scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs")
AUTOENCODER_CHECKPOINT_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
LEGACY_V7_CONFIG_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-coverage-convergence/"
    "derived-configs/ai-assisted-v7-r5-stage3-coverage-convergence-checkpoint-continuation-overfit-smoke-"
    "2026-08-05T08-37-03-827Z.json"
)
LEGACY_V7_PARENT_CHECKPOINT_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-internal/"
    "ai-assisted-v7-r5-stage3-internal-checkpoint-continuation-overfit-smoke-2026-08-04T13-23-54-684Z/"
    "complete-world-ai-assisted-conditional-denoiser.pt"
)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
EXPECTED_COUNTS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
READOUT_CHANNELS = [
    "terrain_path_ground",
    "route_required_boundary",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--support-contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    report = None
    try:
        authorization = validate_authorization()
        dispatch_authorization = validate_dispatch_fix_authorization()
        sample_role_authorization = validate_sample_role_authorization()
        config = read_json(resolve(CONFIG_PATH))
        package = read_json(resolve(DATASET_PATH))
        positive, negative, evidence = run_regressions(config, package)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-r5-stage4-v8-training-loss-smoke-cpu-report-v1",
            "status": (
                "passed_cpu_only_v8_training_loss_smoke_not_active"
                if not failed_positive and not failed_negative
                else "failed_closed_cpu_only_v8_training_loss_smoke_not_active"
            ),
            **timestamps("recordedAt"),
            "authorization": binding(AUTHORIZATION_PATH),
            "implementationConsumption": binding(IMPLEMENTATION_CONSUMPTION_PATH),
            "dispatchFixAuthorization": binding(DISPATCH_FIX_AUTHORIZATION_PATH),
            "dispatchFixConsumption": binding(DISPATCH_FIX_CONSUMPTION_PATH),
            "sampleRoleAuthorization": binding(SAMPLE_ROLE_AUTHORIZATION_PATH),
            "sampleRoleConsumption": binding(SAMPLE_ROLE_CONSUMPTION_PATH),
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
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"V8 training Loss CPU regression failed: {failed_positive}:{failed_negative}")
        support = {
            "schemaVersion": "ai-painter-r5-stage4-v8-training-loss-smoke-support-contract-v1",
            "status": "supported_inactive_cpu_verified_gpu_not_started",
            **timestamps("recordedAt"),
            "architectureId": config["denoiserArchitecture"],
            "lossVersion": config["training"]["denoiserLossVersion"],
            "sharedReadoutChannels": READOUT_CHANNELS,
            "loss": "balanced_binary_cross_entropy_v1",
            "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "reusedWeight": config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"],
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "requiredBoundarySides": ["west"],
            "epochCount": 30,
            "previewEpochs": [1, 5, 10, 20, 30],
            "actualSplitCounts": evidence["actualSplitCounts"],
            "allowedExecutionAfterThisContract": "one_separately_authorized_v8_gpu_smoke_after_all_preflights",
            "stage4FullTrainingAuthorized": False,
            "strictRevalidationAuthorized": False,
        }
        write_json_exclusive(args.support_contract, support)
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v8-training-loss-smoke-cpu-terminal-v1",
            "status": "v8_stage4_training_loss_smoke_cpu_passed_closed",
            **timestamps("recordedAt"),
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(resolve(args.report)),
            "supportContractPath": project_path(args.support_contract),
            "supportContractSha256": sha256_file(resolve(args.support_contract)),
            "nextAction": "create_independent_gpu_smoke_authorization_then_run_preflights",
            "blockers": [],
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(resolve(args.terminal)),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not resolve(args.terminal).exists():
            terminal = {
                "schemaVersion": "ai-painter-r5-stage4-v8-training-loss-smoke-cpu-terminal-v1",
                "status": "v8_stage4_training_loss_smoke_cpu_failed_closed",
                **timestamps("recordedAt"),
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "reportPath": project_path(args.report) if resolve(args.report).exists() else None,
                "reportSha256": sha256_file(resolve(args.report)) if resolve(args.report).exists() else None,
                "automaticRetryStarted": False,
                "gpuUsed": False,
                "trainingStarted": False,
            }
            write_json_exclusive(args.terminal, terminal)
        print(json.dumps(read_json(resolve(args.terminal)), ensure_ascii=False, indent=2))
        return 1


def validate_authorization() -> dict:
    authorization = read_json(resolve(AUTHORIZATION_PATH))
    if authorization.get("requestId") != "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808":
        raise ValueError("V8 training Loss authorization identity is invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V8 training Loss authorization is not resolved")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != authorization.get("requestId"):
        raise ValueError("V8 training Loss command identity is invalid")
    if decision.get("scope") != "implement_v8_shared_semantic_topology_training_loss_compile_sample194_inactive_config_cpu_regress_then_one_30_epoch_gpu_smoke_only":
        raise ValueError("V8 training Loss scope is invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "trainerLossImplementation", "inactiveConfigCompilerExtension", "gpuSmokeRunnerExtension",
        "cpuCheckerExtension", "cpuPositiveNegativeRegression", "inactiveConfigWrite",
        "supportContractWrite", "cpuEvidenceWrite",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"V8 implementation action is closed: {key}")
    for key in (
        "oldDenoiserCheckpointReadOrLoad", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    ):
        if actions.get(key) is not False:
            raise ValueError(f"V8 forbidden action is open: {key}")
    for key in ("gradientDiagnosticTerminal", "gradientDiagnosticReport", "datasetManifest", "sourceIndex"):
        value = authorization.get("bindings", {}).get(key, {})
        if value.get("sha256") != sha256_file(resolve(Path(value.get("path", "missing")))):
            raise ValueError(f"V8 prerequisite binding changed: {key}")
    diagnostic_terminal = read_json(resolve(Path(authorization["bindings"]["gradientDiagnosticTerminal"]["path"])))
    diagnostic_report = read_json(resolve(Path(authorization["bindings"]["gradientDiagnosticReport"]["path"])))
    if diagnostic_terminal.get("status") != "v8_gradient_diagnostic_passed_closed":
        raise ValueError("V8 gradient diagnostic terminal is not successful")
    if diagnostic_report.get("status") != "passed_readonly_gpu_forward_and_gradient_routing_weights_unchanged":
        raise ValueError("V8 gradient diagnostic report is not successful")
    consumption = read_json(resolve(IMPLEMENTATION_CONSUMPTION_PATH))
    if consumption.get("status") != "implementation_authorization_atomically_consumed":
        raise ValueError("V8 implementation authorization was not consumed")
    if consumption.get("authorizationSha256") != sha256_file(resolve(AUTHORIZATION_PATH)):
        raise ValueError("V8 implementation consumption authorization hash changed")
    return authorization


def validate_dispatch_fix_authorization() -> dict:
    authorization = read_json(resolve(DISPATCH_FIX_AUTHORIZATION_PATH))
    if authorization.get("requestId") != "owner-authorized-v8-stage4-mutually-exclusive-dispatch-fix-and-smoke-20260809":
        raise ValueError("V8 dispatch-fix authorization identity is invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V8 dispatch-fix authorization is not resolved")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != authorization.get("requestId"):
        raise ValueError("V8 dispatch-fix command identity is invalid")
    if decision.get("scope") != "fix_v7_r5_v8_stage4_mutually_exclusive_dispatch_cpu_regress_preflight_then_one_v8_30_epoch_gpu_smoke_only":
        raise ValueError("V8 dispatch-fix scope is invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "trainerDispatchMutualExclusionFix", "cpuCheckerDispatchRegressionExtension",
        "cpuPositiveNegativeRegression",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"V8 dispatch-fix action is closed: {key}")
    for key in (
        "oldDenoiserCheckpointReadOrLoad", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    ):
        if actions.get(key) is not False:
            raise ValueError(f"V8 dispatch-fix forbidden action is open: {key}")
    immutable_bindings = (
        "previousPythonPreflightFailureTerminal", "previousPythonPreflightReport",
        "previousRootCauseReport", "previousCpuTerminal", "previousCpuReport",
        "previousSupportContract", "sourceOwnerAuthorization", "inactiveConfig",
        "smokeRunnerFrozen", "smokeDispatcherFrozen", "modelFrozen",
        "datasetImplementationFrozen", "legacyV7Stage3Config", "legacyV7Stage3ParentCheckpoint",
    )
    for key in immutable_bindings:
        value = authorization.get("bindings", {}).get(key, {})
        path = Path(value.get("path", "missing"))
        if value.get("sha256") != sha256_file(resolve(path)):
            raise ValueError(f"V8 dispatch-fix prerequisite binding changed: {key}")
    consumption = read_json(resolve(DISPATCH_FIX_CONSUMPTION_PATH))
    if consumption.get("status") != "implementation_authorization_atomically_consumed":
        raise ValueError("V8 dispatch-fix implementation authorization was not consumed")
    if consumption.get("authorizationSha256") != sha256_file(resolve(DISPATCH_FIX_AUTHORIZATION_PATH)):
        raise ValueError("V8 dispatch-fix consumption authorization hash changed")
    return authorization


def validate_sample_role_authorization() -> dict:
    authorization = read_json(resolve(SAMPLE_ROLE_AUTHORIZATION_PATH))
    if authorization.get("requestId") != "owner-authorized-v8-stage4-validation-smoke-sample-role-fix-and-smoke-20260809":
        raise ValueError("V8 sample-role authorization identity is invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V8 sample-role authorization is not resolved")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != authorization.get("requestId"):
        raise ValueError("V8 sample-role command identity is invalid")
    if decision.get("scope") != "separate_formal_train_selection_from_authorized_v8_validation_smoke_sample_cpu_regress_then_one_v8_30_epoch_gpu_smoke_only":
        raise ValueError("V8 sample-role scope is invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "trainerSingleSampleRoleSeparation", "cpuCheckerSampleRoleRegressionExtension",
        "cpuPositiveNegativeRegression",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"V8 sample-role action is closed: {key}")
    for key in (
        "datasetSplitMutation", "validationSampleReclassificationAsTrain",
        "oldDenoiserCheckpointReadOrLoad", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    ):
        if actions.get(key) is not False:
            raise ValueError(f"V8 sample-role forbidden action is open: {key}")
    immutable_bindings = (
        "previousCpuFailureTerminal", "previousCpuFailureReport", "previousDispatchAuthorization",
        "sourceOwnerAuthorization", "inactiveConfig", "smokeRunnerFrozen",
        "smokeDispatcherFrozen", "modelFrozen", "datasetImplementationFrozen",
    )
    for key in immutable_bindings:
        value = authorization.get("bindings", {}).get(key, {})
        if value.get("sha256") != sha256_file(resolve(Path(value.get("path", "missing")))):
            raise ValueError(f"V8 sample-role prerequisite binding changed: {key}")
    consumption = read_json(resolve(SAMPLE_ROLE_CONSUMPTION_PATH))
    if consumption.get("status") != "implementation_authorization_atomically_consumed":
        raise ValueError("V8 sample-role implementation authorization was not consumed")
    if consumption.get("authorizationSha256") != sha256_file(resolve(SAMPLE_ROLE_AUTHORIZATION_PATH)):
        raise ValueError("V8 sample-role consumption authorization hash changed")
    return authorization


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
    sample_occurrences = [
        split
        for split, dataset in datasets.items()
        for row in dataset.rows
        if row.get("sampleId") == SAMPLE_ID
    ]
    gradient_evidence = synthetic_gradient_regression(config)
    supervision = config["training"]["stage4DecodedDomainAlignment"]["sharedReadoutTrainingSupervision"]
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    source_rows = [row for row in source_index.get("samples", []) if row.get("v7CapacityContributionRegistered") is True]
    source_sample = [row for row in source_rows if row.get("sampleId") == SAMPLE_ID]
    runner_text = resolve(SMOKE_RUNNER_PATH).read_text(encoding="utf-8")
    dispatcher_text = resolve(SMOKE_DISPATCHER_PATH).read_text(encoding="utf-8")
    dispatch_evidence = dispatch_preflight_regression()
    sample_role_evidence = sample_role_regression(config, datasets)
    positive = {
        "inactiveContractValidated": True,
        "architectureV8": config.get("denoiserArchitecture") == "multiscale_condition_unet_v8_stage4_decoded_alignment",
        "conditionChannelsRemain23": config.get("conditionChannels") == 23 and len(config.get("conditionChannelOrder", [])) == 23,
        "readoutChannelsExact": supervision.get("targetChannels") == READOUT_CHANNELS,
        "existingWeightSourceReused": supervision.get("weightSource") == "training.denoiserLossWeights.discreteConditionOutputBinding",
        "existingWeightIsPositive": float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"]) > 0,
        "noNewFreeHyperparameter": supervision.get("newFreeHyperparameterSelected") is False and config["training"]["stage4DecodedDomainAlignment"].get("hyperparameterSelections") == [],
        "failurePreviewPixelsExcluded": supervision.get("failedPreviewPixelsUsedAsTrainingTargets") is False,
        "reviewThresholdsExcluded": supervision.get("machineReviewThresholdsUsedAsTrainingTargets") is False,
        "datasetContractExplicit": selection == "registered_v7_capacity_contribution_v1",
        "actualSplitCounts48_8_4_4": loaded["actualSplitCounts"] == EXPECTED_COUNTS,
        "actualCapacityCount64": loaded["actualLoadedV7CapacityCount"] == 64,
        "sample194UniqueValidation": sample_occurrences == ["validation"] and len(source_sample) == 1 and source_sample[0].get("split") == "validation",
        "fixedSmokeIdentity": config["training"]["v8Stage4SingleSampleSmokeContract"] == {
            **config["training"]["v8Stage4SingleSampleSmokeContract"],
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "requiredBoundarySides": ["west"],
            "epochCount": 30,
            "previewEpochs": [1, 5, 10, 20, 30],
        },
        "sharedReadoutLossInComposite": gradient_evidence["sharedReadoutLossFinite"] and gradient_evidence["compositeLossFinite"],
        "sharedReadoutGradientRoute": gradient_evidence["gradientNorms"]["sharedReadout"] > 0,
        "typedAdapterGradientRoute": gradient_evidence["gradientNorms"]["typedAdapters"] > 0,
        "baseDenoiserGradientRoute": gradient_evidence["gradientNorms"]["baseDenoiser"] > 0,
        "cpuGradientIsolationPreserved": gradient_evidence["parameterGradFieldsAbsent"] and gradient_evidence["stateHashUnchanged"],
        "v8RunnerHasDedicatedMode": "ai-painter-r5-stage4-v8-smoke-gpu-execution-authorization-v1" in runner_text,
        "v8RunnerRejectsOldDenoiser": "oldDenoiserCheckpointReadAuthorized" in runner_text and "parentDenoiserCheckpointPath === null" in runner_text,
        "legacyStage4DispatcherPreserved": "--v8-decoded-alignment" in dispatcher_text and "runV8Stage4Smoke" in dispatcher_text,
        "v8BypassesLegacyParentRequirement": dispatch_evidence["v8WithoutParent"]["exitCode"] == 0,
        "legacyV7AcceptsBoundParentCheckpoint": dispatch_evidence["legacyV7WithBoundParent"]["exitCode"] == 0,
        "v8SmokeReadsRealValidationSample": (
            sample_role_evidence["v8SmokeEvidence"]["selectedSplit"] == "validation"
            and sample_role_evidence["v8SmokeEvidence"]["sampleId"] == SAMPLE_ID
        ),
        "formalTrainingSplitRemains48Train": sample_role_evidence["formalTrainCount"] == 48,
        "legacyV7SmokeStillReadsTrain": (
            sample_role_evidence["legacyV7SmokeEvidence"]["selectedSplit"] == "train"
            and sample_role_evidence["legacyV7SmokeEvidence"]["sampleId"]
            == "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
        ),
    }

    negative = {
        "rejectFailedPreviewPixelsAsTargets": rejects(config, package, lambda value: set_supervision(value, "failedPreviewPixelsUsedAsTrainingTargets", True)),
        "rejectReviewThresholdsAsTargets": rejects(config, package, lambda value: set_supervision(value, "machineReviewThresholdsUsedAsTrainingTargets", True)),
        "rejectNewFreeHyperparameter": rejects(config, package, lambda value: set_supervision(value, "newFreeHyperparameterSelected", True)),
        "rejectWrongWeightSource": rejects(config, package, lambda value: set_supervision(value, "weightSource", "newWeight")),
        "rejectHyperparameterSelection": rejects(config, package, lambda value: value["training"]["stage4DecodedDomainAlignment"].__setitem__("hyperparameterSelections", [{"weight": 1.1}])),
        "rejectWrongSample": rejects(config, package, lambda value: value["training"]["v8Stage4SingleSampleSmokeContract"].__setitem__("sampleId", "wrong")),
        "rejectWrongSeed": rejects(config, package, lambda value: value["training"].__setitem__("seed", 1)),
        "rejectWrongTopology": rejects(config, package, lambda value: value["training"]["authorizedBoundaryTopology"].__setitem__("requiredBoundarySides", ["east"])),
        "rejectWrongEpochCount": rejects(config, package, lambda value: value["training"]["v8Stage4SingleSampleSmokeContract"].__setitem__("epochCount", 31)),
        "rejectWrongPreviewEpochs": rejects(config, package, lambda value: value["training"]["fixedEpochPreviewPolicy"].__setitem__("smoke", [1, 30])),
        "rejectInactiveOptimizerAuthorization": rejects(config, package, lambda value: value["training"]["ownerTrainingAuthorization"].__setitem__("optimizerCreationAuthorized", True)),
        "rejectOldDenoiserReadGate": rejects(config, package, lambda value: value["training"]["stage4DecodedDomainAlignment"]["activationGate"].__setitem__("oldDenoiserCheckpointReadNow", True)),
        "rejectUnknownActionField": rejects(config, package, lambda value: value["training"]["stage4DecodedDomainAlignment"]["activationGate"].__setitem__("startTrainingNow", True)),
        "rejectActiveWithoutConsumption": rejects(config, package, activate_without_consumption),
        "v8RejectsParentCheckpoint": (
            dispatch_evidence["v8WithParent"]["exitCode"] != 0
            and "V8 Stage 4 Smoke must start from project random V8 initialization"
            in dispatch_evidence["v8WithParent"]["stderr"]
        ),
        "legacyV7StillRequiresParentCheckpoint": (
            dispatch_evidence["legacyV7WithoutParent"]["exitCode"] != 0
            and "V7 R5 Smoke requires the bound parent checkpoint"
            in dispatch_evidence["legacyV7WithoutParent"]["stderr"]
        ),
        "rejectV8SmokeTrainReclassification": sample_role_evidence["rejectV8TrainReclassification"],
    }
    evidence = {
        "actualSplitCounts": loaded["actualSplitCounts"],
        "actualLoadedV7CapacityCount": loaded["actualLoadedV7CapacityCount"],
        "sample194Occurrences": sample_occurrences,
        "sharedReadoutChannels": READOUT_CHANNELS,
        "reusedWeight": float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"]),
        "gradientRegression": gradient_evidence,
        "dispatchPreflightRegression": dispatch_evidence,
        "sampleRoleRegression": sample_role_evidence,
        "sourceCodeBindings": {
            "trainer": binding(TRAINER_PATH),
            "model": binding(MODEL_PATH),
            "dataset": binding(DATASET_IMPLEMENTATION_PATH),
            "compiler": binding(COMPILER_PATH),
            "cpuChecker": binding(CPU_CHECKER_PATH),
            "smokeRunner": binding(SMOKE_RUNNER_PATH),
            "smokeDispatcher": binding(SMOKE_DISPATCHER_PATH),
        },
    }
    return positive, negative, evidence


def dispatch_preflight_regression() -> dict:
    base_v8 = [
        "--config", str(resolve(CONFIG_PATH)),
        "--dataset-package", str(resolve(DATASET_PATH)),
        "--autoencoder-checkpoint", str(resolve(AUTOENCODER_CHECKPOINT_PATH)),
        "--output-dir", str(resolve(Path(".runtime/ai-painter/v8-r5-stage4-sample-role-fix-cpu/20260809-152420477/v8-preflight-output"))),
        "--resolution-stage", "0", "--single-sample-overfit-smoke",
        "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30",
        "--overfit-evaluation-interval", "5", "--preflight-only",
    ]
    base_v7 = [
        "--config", str(resolve(LEGACY_V7_CONFIG_PATH)),
        "--dataset-package", str(resolve(DATASET_PATH)),
        "--autoencoder-checkpoint", str(resolve(AUTOENCODER_CHECKPOINT_PATH)),
        "--output-dir", str(resolve(Path(".runtime/ai-painter/v8-r5-stage4-sample-role-fix-cpu/20260809-152420477/v7-preflight-output"))),
        "--resolution-stage", "0", "--single-sample-overfit-smoke",
        "--overfit-sample-id", "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
        "--overfit-epochs", "30", "--overfit-evaluation-interval", "10", "--preflight-only",
    ]
    return {
        "v8WithoutParent": run_trainer_preflight(base_v8),
        "v8WithParent": run_trainer_preflight(base_v8 + ["--initial-denoiser-checkpoint", str(resolve(LEGACY_V7_PARENT_CHECKPOINT_PATH))]),
        "legacyV7WithoutParent": run_trainer_preflight(base_v7),
        "legacyV7WithBoundParent": run_trainer_preflight(base_v7 + ["--initial-denoiser-checkpoint", str(resolve(LEGACY_V7_PARENT_CHECKPOINT_PATH))]),
    }


def run_trainer_preflight(arguments: list[str]) -> dict:
    environment = os.environ.copy()
    source_root = str(resolve(Path("ml/ai-painter/src")))
    environment["PYTHONPATH"] = source_root + (os.pathsep + environment["PYTHONPATH"] if environment.get("PYTHONPATH") else "")
    completed = subprocess.run(
        [sys.executable, str(resolve(TRAINER_PATH)), *arguments],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    return {
        "exitCode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def sample_role_regression(config: dict, datasets: dict) -> dict:
    v8_args = SimpleNamespace(
        single_sample_overfit_smoke=True,
        smoke_test=False,
        overfit_sample_id=SAMPLE_ID,
    )
    v8_evidence = trainer.build_single_sample_overfit_evidence(datasets, v8_args, config)
    legacy_config = read_json(resolve(LEGACY_V7_CONFIG_PATH))
    legacy_args = SimpleNamespace(
        single_sample_overfit_smoke=True,
        smoke_test=False,
        overfit_sample_id="ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
    )
    legacy_evidence = trainer.build_single_sample_overfit_evidence(datasets, legacy_args, legacy_config)
    formal_args = SimpleNamespace(
        single_sample_overfit_smoke=False,
        smoke_test=False,
        overfit_sample_id=None,
    )
    formal_evidence = trainer.build_single_sample_overfit_evidence(datasets, formal_args, config)
    formal_datasets = trainer.build_optimization_datasets(datasets, formal_evidence)
    candidate = deepcopy(config)
    candidate["training"]["v8Stage4SingleSampleSmokeContract"]["sampleSplit"] = "train"
    rejected = False
    try:
        trainer.build_single_sample_overfit_evidence(datasets, v8_args, candidate)
    except ValueError as error:
        rejected = "bound validation diagnostic sample" in str(error)
    return {
        "v8SmokeEvidence": v8_evidence,
        "legacyV7SmokeEvidence": legacy_evidence,
        "formalTrainingDisabledOverfitEvidence": formal_evidence,
        "formalTrainCount": len(formal_datasets["train"]),
        "actualSplitCounts": {split: len(dataset) for split, dataset in datasets.items()},
        "rejectV8TrainReclassification": rejected,
        "datasetRowsMutated": False,
    }


def synthetic_gradient_regression(config: dict) -> dict:
    torch.manual_seed(20263722)
    model = build_complete_world_system(config).cpu().train()
    before = state_dict_sha256(model.denoiser.state_dict())
    conditions = torch.rand(1, 23, 32, 32)
    order = list(config["conditionChannelOrder"])
    for name in config["conditionChannelTypes"]["discrete"]:
        index = order.index(name)
        conditions[:, index] = (conditions[:, index] > 0.7).float()
    path_index = order.index("terrain_path_ground")
    conditions[:, path_index, 12:20, :8] = 1.0
    for name, offset in (("object_footprints", 4), ("object_tree", 8), ("object_rock", 12), ("object_vegetation", 16)):
        index = order.index(name)
        conditions[:, index, offset:offset + 4, offset:offset + 4] = 1.0
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
        model,
        noisy_latent,
        target_velocity,
        clean_latent,
        timesteps,
        alpha_bars,
        conditions,
        config,
        target_image=target_image,
        latent_normalization=normalization,
    )
    named = [(name, parameter) for name, parameter in model.denoiser.named_parameters() if parameter.requires_grad]
    gradients = torch.autograd.grad(losses["compositeLossTensor"], [parameter for _, parameter in named], allow_unused=True)
    norms = {"typedAdapters": 0.0, "sharedReadout": 0.0, "baseDenoiser": 0.0}
    for (name, _), gradient in zip(named, gradients):
        if gradient is None:
            continue
        norm = float(gradient.detach().float().pow(2).sum().sqrt())
        if "typed_condition_adapter" in name:
            norms["typedAdapters"] += norm
        elif "shared_semantic_topology_readout" in name:
            norms["sharedReadout"] += norm
        else:
            norms["baseDenoiser"] += norm
    after = state_dict_sha256(model.denoiser.state_dict())
    return {
        "syntheticTensorShape": {"conditions": list(conditions.shape), "latent": list(clean_latent.shape), "image": list(target_image.shape)},
        "sharedReadoutLoss": float(losses["stage4DecodedAlignmentSharedReadoutBce"].detach()),
        "sharedReadoutLossFinite": bool(torch.isfinite(losses["stage4DecodedAlignmentSharedReadoutBce"]).item()),
        "compositeLoss": float(losses["compositeLossTensor"].detach()),
        "compositeLossFinite": bool(torch.isfinite(losses["compositeLossTensor"]).item()),
        "gradientNorms": norms,
        "parameterGradFieldsAbsent": all(parameter.grad is None for parameter in model.parameters()),
        "stateHashBefore": before,
        "stateHashAfter": after,
        "stateHashUnchanged": before == after,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuUsed": False,
    }


def set_supervision(config: dict, key: str, value) -> None:
    config["training"]["stage4DecodedDomainAlignment"]["sharedReadoutTrainingSupervision"][key] = value


def activate_without_consumption(config: dict) -> None:
    config["training"]["trainingAuthorizationStatus"] = trainer.V8_STAGE4_SMOKE_ACTIVE_STATUS


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


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())

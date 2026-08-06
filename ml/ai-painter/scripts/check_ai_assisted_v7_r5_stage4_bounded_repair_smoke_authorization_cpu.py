from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806/request.json"
)
AUTHORIZATION_SHA256 = "1c497e6802da24bd6e16e3b981b7ff5438639047d04f3d9afa677bb33937efed"
IMPLEMENTATION_PATH = AUTHORIZATION_PATH.parent / "implementation-authorization-consumption.json"
IMPLEMENTATION_SHA256 = "7ed86af0f3fb94ef3585c83cb5511fbd72273da94fbb69bb594ab6f683f5ab7f"
COMMAND_REF = "owner-authorized-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806"
SCOPE = (
    "fix_only_two_diagnostic_success_status_bindings_sync_related_hashes_then_one_"
    "cpu_gate_preflights_and_one_30_epoch_bounded_gpu_smoke"
)
PREVIOUS_FAILURE_TERMINAL_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations/"
    "ai-assisted-v7-r5-stage4-bounded-repair-smoke-2026-08-05T15-36-34-038Z-finalization/"
    "phase-terminal.json"
)
PREVIOUS_FAILURE_TERMINAL_SHA256 = "c9804cd03a5ca706a0230a695a440c57adfe0d6d125e3a3495db1e109eb3cbc7"
INACTIVE_CONFIG_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/"
    "ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/"
    "inactive-config.json"
)
INACTIVE_CONFIG_SHA256 = "6bcc1a6f49b4e9fd5a7ac1eca5f25783445894097b22cf349e15b365cad07332"
SELECTION_PATH = INACTIVE_CONFIG_PATH.parent / "selection-contract.json"
SELECTION_SHA256 = "6b4b6c9e23836b2d483625594b254f725c1e0ebc799c54f20507210a9db8e228"
SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/"
    "v7-r5-stage4-diagnostic-evidence-bounded-repair-trainer-support-contract.json"
)
SUPPORT_SHA256 = "8b0bbd53283af7faff236797d51d418170e520da63522c2e91d07331432ac1b4"
BOUNDED_CPU_PATH = INACTIVE_CONFIG_PATH.parent / "cpu-positive-negative-regression.json"
BOUNDED_CPU_SHA256 = "975332317a237b7da5ad96c131d6420c5a9d8033790fcb113976e96544a7e05c"
BOUNDED_TERMINAL_PATH = INACTIVE_CONFIG_PATH.parent / "phase-terminal.json"
BOUNDED_TERMINAL_SHA256 = "7d602540466eb08a44985357508bd9f9fbcb981935dd031a3d1a2acafd3c6643"
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
TRAINER_SHA256 = "f9a6b6d6a7c7a4b5e5f98178ad5b2ec1696a33354fbf294b56d5ff1e90ee7ccc"
RUNNER_PATH = Path("scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs")
RUNNER_SHA256 = "4ca34148e3a6055ecc86049c7c93b3601755918db8b5790337da465154493a4b"
DATASET_MANIFEST_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
SOURCE_INDEX_PATH = DATASET_MANIFEST_PATH.parent / "source-index.json"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
STAGE0_MANIFEST_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/"
    "ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z-stage-0/manifest.json"
)
STAGE0_MANIFEST_SHA256 = "2dfcfd016734ef7d88e33d6f75b23b9d043df7d075b280827b304e1c89ede5ef"
STAGE0_CHECKPOINT_PATH = STAGE0_MANIFEST_PATH.parent / "complete-world-ai-assisted-conditional-denoiser.pt"
STAGE0_CHECKPOINT_SHA256 = "17c1d4e34e8e738bc042c0f99dad27afcc3bfd9337e3e220bc0e172c6e634453"
AUTOENCODER_CHECKPOINT_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
AUTOENCODER_CHECKPOINT_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_bounded_repair_smoke_preflight_only"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
CONDITION_LABEL = "v7-complete-map-194"
PREVIEWS = [1, 5, 10, 20, 30]


def main() -> int:
    parser = ArgumentParser(description="CPU-check the Stage 4 bounded-repair Smoke authorization gate.")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    try:
        validate_immutable_inputs()
        trainer = load_trainer()
        source = read_json(INACTIVE_CONFIG_PATH)
        package = read_json(DATASET_MANIFEST_PATH)
        config = preflight_config(source)
        trainer.validate_training_inputs(config, package)
        positive, negative = run_assertions(trainer, source, config, package)
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        report = build_report(positive, negative, failures)
        write_json_exclusive(args.report, report)
        if failures:
            write_json_exclusive(args.terminal, terminal_record(
                "stage4_bounded_repair_smoke_cpu_gate_failed_closed", failures, args
            ))
            return 1
        contract = support_contract(args, report)
        write_json_exclusive(args.contract, contract)
        write_json_exclusive(args.terminal, terminal_record(
            "stage4_bounded_repair_smoke_cpu_gate_passed_gpu_not_started", [], args
        ))
        print(json.dumps({
            "status": report["status"],
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(args.report),
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(args.terminal),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not resolved(args.terminal).exists():
            write_json_exclusive(args.terminal, {
                "schemaVersion": "stage4-bounded-repair-smoke-authorization-cpu-terminal-v1",
                "status": "stage4_bounded_repair_smoke_cpu_gate_execution_failed_closed",
                "blockers": [f"{type(error).__name__}: {error}"],
                **inactive_boundaries(),
            })
        raise


def validate_immutable_inputs() -> None:
    for path, expected, code in (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (IMPLEMENTATION_PATH, IMPLEMENTATION_SHA256, "implementation"),
        (PREVIOUS_FAILURE_TERMINAL_PATH, PREVIOUS_FAILURE_TERMINAL_SHA256, "previous_failure_terminal"),
        (INACTIVE_CONFIG_PATH, INACTIVE_CONFIG_SHA256, "inactive_config"),
        (SELECTION_PATH, SELECTION_SHA256, "selection"),
        (SUPPORT_PATH, SUPPORT_SHA256, "support"),
        (BOUNDED_CPU_PATH, BOUNDED_CPU_SHA256, "bounded_cpu"),
        (BOUNDED_TERMINAL_PATH, BOUNDED_TERMINAL_SHA256, "bounded_terminal"),
        (TRAINER_PATH, TRAINER_SHA256, "trainer"),
        (RUNNER_PATH, RUNNER_SHA256, "runner"),
        (DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"),
        (SOURCE_INDEX_PATH, SOURCE_INDEX_SHA256, "source_index"),
        (STAGE0_MANIFEST_PATH, STAGE0_MANIFEST_SHA256, "stage0_manifest"),
    ):
        if not resolved(path).is_file() or sha256_file(path) != expected:
            raise ValueError(f"stage4_bounded_smoke_{code}_missing_or_changed")
    authorization = read_json(AUTHORIZATION_PATH)
    implementation = read_json(IMPLEMENTATION_PATH)
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("stage4_bounded_smoke_authorization_identity_invalid")
    if (
        implementation.get("status") != "consumed_before_seed_fix_authorization_binding_and_new_cpu_gate_writes"
        or implementation.get("authorizationSha256") != AUTHORIZATION_SHA256
        or implementation.get("commandRef") != COMMAND_REF
        or implementation.get("scope") != SCOPE
        or int(implementation.get("cpuRegressionExecutionCount", 0)) != 1
        or implementation.get("gpuExecutionConsumed") is not False
    ):
        raise ValueError("stage4_bounded_smoke_implementation_identity_invalid")
    previous_failure = read_json(PREVIOUS_FAILURE_TERMINAL_PATH)
    previous_binding = authorization.get("previousFailedExecution", {})
    if (
        previous_failure.get("status") != "stage4_bounded_repair_smoke_preflight_failed_closed"
        or previous_binding.get("failureTerminalPath") != project_path(PREVIOUS_FAILURE_TERMINAL_PATH)
        or previous_binding.get("failureTerminalSha256") != PREVIOUS_FAILURE_TERMINAL_SHA256
        or previous_binding.get("closedNoRetry") is not True
        or previous_binding.get("gpuExecutionAuthorizationConsumed") is not False
    ):
        raise ValueError("stage4_bounded_smoke_previous_failure_binding_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "inactiveConfigPath": project_path(INACTIVE_CONFIG_PATH),
        "inactiveConfigSha256": INACTIVE_CONFIG_SHA256,
        "selectionContractPath": project_path(SELECTION_PATH),
        "selectionContractSha256": SELECTION_SHA256,
        "trainerSupportContractPath": project_path(SUPPORT_PATH),
        "trainerSupportContractSha256": SUPPORT_SHA256,
        "trainerPath": project_path(TRAINER_PATH),
        "trainerBeforeSha256": "20da44f6365eacfcdeb41a01473f4557790ea8974c382927c044f1fc65448e85",
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "sourceIndexPath": project_path(SOURCE_INDEX_PATH),
        "sourceIndexSha256": SOURCE_INDEX_SHA256,
        "stage0ManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "stage0ManifestSha256": STAGE0_MANIFEST_SHA256,
        "stage0CheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
        "stage0CheckpointSha256": STAGE0_CHECKPOINT_SHA256,
        "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
        "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
        "sampleId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "sampleSplit": "validation",
        "epochCount": 30,
        "evaluationInterval": 5,
        "requiredPreviewEpochs": PREVIEWS,
        "requiredDiagnosticMetricCount": 17,
        "seed": 20263722,
        "derivedTrainingSeed": 20263722,
        "sourceInactiveConfigSeed": 20260722,
        "requiredImplementationConsumptionStatus": "consumed_before_seed_fix_authorization_binding_and_new_cpu_gate_writes",
        "requiredSmokeStage1Authorized": False,
        "requiredSmokeStage2Authorized": False,
        "requiredStage1OrStage2InitializationAuthorized": False,
        "requiredDiagnosticReportStatus": "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged",
        "requiredDiagnosticTerminalStatus": "r5_stage4_readonly_single_sample_gpu_diagnostic_completed_closed",
        "runnerPath": project_path(RUNNER_PATH),
        "runnerBeforeSha256": "037b8f728cbfd721306bc07d9b5ff09e69232ddaa3cc85b5e7a46baf6a913e84",
        "cpuCheckerPath": project_path(Path(__file__)),
        "cpuCheckerBeforeSha256": "f201dcba9dd80ea368a2ae9937453f736e25972252e9f7797d63f677730bd721",
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_bounded_smoke_identity_{key}_invalid")


def preflight_config(source: dict) -> dict:
    config = deepcopy(source)
    config["status"] = "stage4_bounded_repair_smoke_preflight_only"
    config["architectureVersion"] = (
        "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-"
        "stage4-diagnostic-evidence-bounded-smoke"
    )
    training = config["training"]
    training["seed"] = 20263722
    training["trainingAuthorizationStatus"] = PREFLIGHT_STATUS
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedOverfitConditionLabel"] = CONDITION_LABEL
    training["authorizedOverfitSampleSplit"] = "validation"
    training["authorizedInitialization"] = (
        "project_stage4_failed_stage0_checkpoint_continuation_nonformal_smoke"
    )
    training["fixedEpochPreviewPolicy"]["smoke"] = list(PREVIEWS)
    training["stage4FullTrainingContract"]["status"] = "bounded_repair_smoke_preflight_only"
    training["r5Stage4BoundedRepairCheckpointContinuation"] = {
        "sourceManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "sourceManifestSha256": STAGE0_MANIFEST_SHA256,
        "sourceCheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
        "sourceCheckpointSha256": STAGE0_CHECKPOINT_SHA256,
        "sourceArchitectureVersion": (
            "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-"
            "stage4-coverage-convergence-full-training"
        ),
        "loadingAuthorizedNow": False,
        "stage1OrStage2InitializationAuthorized": False,
    }
    training["r5Stage4BoundedRepairSmokeContract"] = {
        "status": "preflight_only",
        "stageIndex": 0,
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "evaluationInterval": 5,
        "requiredPreviewEpochs": list(PREVIEWS),
        "requiredDiagnosticMetricCount": 17,
        "sampleId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "sampleSplit": "validation",
        "nonFormalValidationSampleOverfit": True,
        "checkpointPromotionEligible": False,
        "automaticRetryAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "diagnostic_support_candidate_not_active",
        "objectSemanticDiagnostics": {
            "channels": ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
            "measurements": ["independent_loss", "gradient_contribution", "decoded_response"],
            "gradientTarget": "predicted_rgb_only",
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "conditionChannel": "terrain_path_ground",
            "measurements": ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"],
            "requiredBoundarySidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
            "preserveExistingPathLossWeights": True,
            "spatialGridSize": 4,
        },
        "reviewThresholdsModified": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "executionValuesSelected": False,
        "trainingConfigApplied": False,
        "checkpointFileReadAuthorized": False,
        "gpuUseAuthorized": False,
        "trainingAuthorized": False,
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": AUTHORIZATION_PATH.parent.name,
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "implementationConsumptionPath": project_path(IMPLEMENTATION_PATH),
        "implementationConsumptionSha256": IMPLEMENTATION_SHA256,
        "executionConsumptionPath": None,
        "executionConsumptionSha256": None,
        "sourceConfigPath": project_path(INACTIVE_CONFIG_PATH),
        "sourceConfigSha256": INACTIVE_CONFIG_SHA256,
        "selectionContractPath": project_path(SELECTION_PATH),
        "selectionContractSha256": SELECTION_SHA256,
        "trainerSupportContractPath": project_path(SUPPORT_PATH),
        "trainerSupportContractSha256": SUPPORT_SHA256,
        "boundedRepairCpuReportPath": project_path(BOUNDED_CPU_PATH),
        "boundedRepairCpuReportSha256": BOUNDED_CPU_SHA256,
        "boundedRepairTerminalPath": project_path(BOUNDED_TERMINAL_PATH),
        "boundedRepairTerminalSha256": BOUNDED_TERMINAL_SHA256,
        "stage0ManifestPath": project_path(STAGE0_MANIFEST_PATH),
        "stage0ManifestSha256": STAGE0_MANIFEST_SHA256,
        "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
        "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "sourceIndexPath": project_path(SOURCE_INDEX_PATH),
        "sourceIndexSha256": SOURCE_INDEX_SHA256,
        "status": PREFLIGHT_STATUS,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    return config


def run_assertions(trainer, source, config, package):
    contract = trainer.validate_v7_r5_candidate_contract(config)
    positive = {
        "preflightTrainingInputsAccepted": accepted(lambda: trainer.validate_training_inputs(config, package)),
        "candidateContractAccepted": contract.get("status") == "r5_candidate_contract_valid_for_stage4_bounded_repair_not_active",
        "fixedValidationSampleBound": config["training"]["authorizedOverfitSampleId"] == SAMPLE_ID and config["training"]["authorizedOverfitSampleSplit"] == "validation",
        "epochCountBound": config["training"]["r5Stage4BoundedRepairSmokeContract"]["epochCount"] == 30,
        "previewEpochsBound": config["training"]["fixedEpochPreviewPolicy"]["smoke"] == PREVIEWS,
        "stage0OnlyBound": config["training"]["r5Stage4BoundedRepairSmokeContract"]["stageIndex"] == 0,
        "checkpointIdentityBoundWithoutRead": config["training"]["r5Stage4BoundedRepairCheckpointContinuation"]["sourceCheckpointSha256"] == STAGE0_CHECKPOINT_SHA256,
        "checkpointLoadingClosedDuringPreflight": config["training"]["r5Stage4BoundedRepairCheckpointContinuation"]["loadingAuthorizedNow"] is False,
        "optimizerClosedDuringPreflight": config["training"]["ownerTrainingAuthorization"]["optimizerCreationAuthorized"] is False,
        "gpuClosedDuringPreflight": config["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] is False,
        "fullTrainingClosed": config["training"]["ownerTrainingAuthorization"]["fullTrainingAuthorized"] is False,
        "stage1AndStage2Closed": config["training"]["r5Stage4BoundedRepairSmokeContract"]["stage1Authorized"] is False and config["training"]["r5Stage4BoundedRepairSmokeContract"]["stage2Authorized"] is False,
        "diagnosticMetricsConfigured": config["training"]["r5Stage4BoundedRepairSmokeContract"]["requiredDiagnosticMetricCount"] == 17,
        "reviewThresholdsPreserved": config["training"]["stage4FailureDiagnostics"]["reviewThresholdsModified"] is False,
        "legacyInactiveCandidateStillAccepted": accepted(lambda: trainer.validate_v7_r5_candidate_contract(source)),
    }
    mutations = {
        "activeStatusBeforeConsumptionRejected": lambda value: value["training"].update(trainingAuthorizationStatus="owner_authorized_v7_r5_stage4_bounded_repair_single_sample_gpu_smoke"),
        "checkpointLoadingDuringPreflightRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(loadingAuthorizedNow=True),
        "optimizerDuringPreflightRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True),
        "gpuDuringPreflightRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True),
        "wrongSampleRejected": lambda value: value["training"].update(authorizedOverfitSampleId="wrong-sample"),
        "trainSplitSubstitutionRejected": lambda value: value["training"].update(authorizedOverfitSampleSplit="train"),
        "epochMutationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(epochCount=31),
        "previewMutationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(requiredPreviewEpochs=[1, 10, 20, 30]),
        "stage1AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage1Authorized=True),
        "stage2AuthorizationRejected": lambda value: value["training"]["r5Stage4BoundedRepairSmokeContract"].update(stage2Authorized=True),
        "stage1OrStage2InitializationRejected": lambda value: value["training"]["r5Stage4BoundedRepairCheckpointContinuation"].update(stage1OrStage2InitializationAuthorized=True),
        "fullTrainingAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(fullTrainingAuthorized=True),
        "retryAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(automaticRetryAuthorized=True),
        "formalInferenceAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(formalInferenceAuthorized=True),
        "checkpointPromotionRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointPromotionAuthorized=True),
        "reviewThresholdMutationRejected": lambda value: value["training"]["stage4FailureDiagnostics"].update(reviewThresholdsModified=True),
        "failedPreviewTrainingTargetRejected": lambda value: value["training"]["stage4FailureDiagnostics"].update(failedPreviewPixelsUsedAsTrainingTargets=True),
    }
    negative = {
        name: rejected(trainer, config, package, mutate)
        for name, mutate in mutations.items()
    }
    return positive, negative


def rejected(trainer, config, package, mutate):
    value = deepcopy(config)
    mutate(value)
    try:
        trainer.validate_training_inputs(value, package)
    except ValueError:
        return True
    return False


def accepted(call):
    try:
        call()
    except ValueError:
        return False
    return True


def build_report(positive, negative, failures):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-bounded-repair-smoke-authorization-cpu-regression-v1",
        "status": (
            "passed_cpu_only_stage4_bounded_repair_smoke_authorization_gate_gpu_not_started"
            if not failures
            else "failed_cpu_only_stage4_bounded_repair_smoke_authorization_gate_closed"
        ),
        "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "generatedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "device": "cpu",
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "inputs": {
            "authorizationPath": project_path(AUTHORIZATION_PATH),
            "authorizationSha256": AUTHORIZATION_SHA256,
            "implementationConsumptionPath": project_path(IMPLEMENTATION_PATH),
            "implementationConsumptionSha256": IMPLEMENTATION_SHA256,
            "inactiveConfigPath": project_path(INACTIVE_CONFIG_PATH),
            "inactiveConfigSha256": INACTIVE_CONFIG_SHA256,
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": TRAINER_SHA256,
            "runnerPath": project_path(RUNNER_PATH),
            "runnerSha256": RUNNER_SHA256,
            "checkerPath": project_path(Path(__file__)),
            "checkerSha256": sha256_file(Path(__file__)),
        },
        **inactive_boundaries(),
    }


def support_contract(args, report):
    return {
        "schemaVersion": "stage4-bounded-repair-smoke-support-contract-v1",
        "status": "cpu_verified_preflight_gate_gpu_execution_not_consumed",
        "trainer": {"path": project_path(TRAINER_PATH), "sha256": TRAINER_SHA256},
        "runner": {"path": project_path(RUNNER_PATH), "sha256": RUNNER_SHA256},
        "cpuRegression": {"path": project_path(args.report), "sha256": sha256_file(args.report)},
        "fixedExecution": {
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "resolution": {"width": 256, "height": 192},
            "epochCount": 30,
            "previewEpochs": PREVIEWS,
            "diagnosticMetricCount": 17,
        },
        **inactive_boundaries(),
    }


def terminal_record(status, blockers, args):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "stage4-bounded-repair-smoke-authorization-cpu-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(args.report),
        "contractPath": project_path(args.contract) if resolved(args.contract).exists() else None,
        "contractSha256": sha256_file(args.contract) if resolved(args.contract).exists() else None,
        "blockers": blockers,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def inactive_boundaries():
    return {
        "gpuExecutionAuthorizationConsumed": False,
        "checkpointFileRead": False,
        "checkpointLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
        "automaticRetryStarted": False,
        "stage4FullTrainingStarted": False,
        "stage1Started": False,
        "stage2Started": False,
        "strictRevalidationStarted": False,
        "formalInferenceStarted": False,
        "checkpointPromoted": False,
        "runtimeFrameStarted": False,
        "worldEntryStarted": False,
    }


def load_trainer():
    spec = importlib.util.spec_from_file_location("stage4_bounded_smoke_trainer", resolved(TRAINER_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("stage4_bounded_smoke_trainer_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resolved(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def read_json(path: Path) -> dict:
    return json.loads(resolved(path).read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with resolved(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path: Path) -> str:
    return resolved(path).absolute().relative_to(ROOT.absolute()).as_posix()


def write_json_exclusive(path: Path, value: dict) -> None:
    output = resolved(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

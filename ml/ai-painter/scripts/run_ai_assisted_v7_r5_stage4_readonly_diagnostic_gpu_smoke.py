from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import time
import traceback

import torch

from ai_painter.complete_world import add_noise, build_complete_world_system, velocity_target
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-action-request-v7-r5-stage4-readonly-diagnostic-object-metric-prefix-fix-retry-20260805/request.json"
)
AUTHORIZATION_SHA256 = "8a3e4d3e624a5fef11c867c7075658115692fbe6ee2cb503a19e8fb45c8973be"
IMPLEMENTATION_CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "implementation-authorization-consumption.json"
IMPLEMENTATION_CONSUMPTION_SHA256 = "ca16e9c6e6fbed73a40e038d3b0c040ed458dc829e6461543fc6b46a2bb1f45c"
GPU_EXECUTION_CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "gpu-object-metric-prefix-fix-retry-execution-authorization-consumption.json"
COMMAND_REF = "owner-authorized-v7-r5-stage4-readonly-diagnostic-object-metric-prefix-fix-one-retry-20260805"
SCOPE = "fix_four_stage4_object_diagnostic_metric_prefixes_preserve_legacy_aliases_cpu_regression_and_one_same_readonly_gpu_diagnostic_only"
PREVIOUS_FAILURE_TERMINAL_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-readonly-diagnostic-gpu-smoke-cpu-order-checker-fix-retries/"
    "ai-assisted-v7-r5-stage4-readonly-diagnostic-gpu-smoke-2026-08-05T12-09-00-000Z/phase-terminal.json"
)
PREVIOUS_FAILURE_TERMINAL_SHA256 = "ee0f752d8e9d343207de3c91b20bc9c59ead6d63d77153a1aecb33d8eb1e5588"
CONFIG_PATH = Path(
    ".runtime/ai-painter/r5-stage4-failure-diagnostic-inactive-configs/"
    "ai-assisted-v7-r5-stage4-failure-diagnostic-inactive-config-2026-08-05T11-18-00-000Z/"
    "inactive-config.json"
)
CONFIG_SHA256 = "c86067e15f2df0a57882b911f13f2202c5b50ff9eb4445582391b6395347dbc6"
SELECTION_CONTRACT_PATH = Path(
    "data/ai-painter/system-governance/"
    "v7-r5-stage4-failure-diagnostic-inactive-config-selection-contract.json"
)
SELECTION_CONTRACT_SHA256 = "ccf6953c83a4220134d711ff432eea52b5c5ae589d3e00382dd2adcafc8f68d5"
CONFIG_CPU_REPORT_PATH = Path(
    ".runtime/ai-painter/v7-r5-stage4-failure-diagnostic-config-cpu-regressions/"
    "ai-assisted-v7-r5-stage4-failure-diagnostic-config-cpu-2026-08-05T11-23-00-000Z/report.json"
)
CONFIG_CPU_REPORT_SHA256 = "a913b7e33853c27004eaa5ecc7180bfa3efb096a519e5e009c77acd28ae0464f"
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
TRAINER_SHA256 = "8a83a5750faaedb0dcc5459693b61933e20be3e5ea144b8ff3a6baa8bd4c3b1d"
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
DATASET_MANIFEST_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
SOURCE_INDEX_PATH = DATASET_MANIFEST_PATH.parent / "source-index.json"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
CONDITION_LABEL = "v7-complete-map-194"
SAMPLE_IMAGE_PATH = DATASET_MANIFEST_PATH.parent / "images/complete-maps/ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6.png"
SAMPLE_IMAGE_SHA256 = "13caf53dce064afdd0bc1318f4c5b5bb9b3c63631679d84ccd3ed3ab992688be"
CONDITION_PACK_PATH = Path(
    ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/"
    "earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-08-01T15-47-45-117Z/"
    "complete-map-condition-task/compiled-conditions/condition-pack.json"
)
CONDITION_PACK_SHA256 = "2db536def8a3b7d3049b7cae673942edd77aa1151f432dc5774f2b3a33579ca9"
DIAGNOSTIC_TIMESTEP = 999
DIAGNOSTIC_SEED = 20263722
IMAGE_SIZE = (256, 192)
DIAGNOSTIC_KEYS = (
    "stage4DiagnosticObjectFootprintsIndependentLoss",
    "stage4DiagnosticObjectFootprintsGradientContribution",
    "stage4DiagnosticObjectFootprintsDecodedResponsePrototypeMae",
    "stage4DiagnosticObjectTreeIndependentLoss",
    "stage4DiagnosticObjectTreeGradientContribution",
    "stage4DiagnosticObjectTreeDecodedResponsePrototypeMae",
    "stage4DiagnosticObjectRockIndependentLoss",
    "stage4DiagnosticObjectRockGradientContribution",
    "stage4DiagnosticObjectRockDecodedResponsePrototypeMae",
    "stage4DiagnosticObjectVegetationIndependentLoss",
    "stage4DiagnosticObjectVegetationGradientContribution",
    "stage4DiagnosticObjectVegetationDecodedResponsePrototypeMae",
    "stage4DiagnosticObjectGradientAvailable",
    "stage4DiagnosticRouteActivationMassRatio",
    "stage4DiagnosticRouteSpatialDistributionL1",
    "stage4DiagnosticRouteCentroidDrift",
    "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
)


def main() -> int:
    parser = ArgumentParser(description="Run one read-only Stage 4 single-sample GPU diagnostic forward pass.")
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--preflight-report", type=Path)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()

    preflight = validate_read_only_preflight()
    if args.preflight_only:
        if args.preflight_report is None or args.output_dir is not None:
            raise ValueError("preflight mode requires only --preflight-report")
        write_json_exclusive(args.preflight_report, preflight)
        print(json.dumps(preflight, ensure_ascii=False, indent=2))
        return 0
    if args.output_dir is None or args.preflight_report is not None:
        raise ValueError("GPU diagnostic mode requires only --output-dir")
    return run_gpu_diagnostic(args.output_dir, preflight)


def validate_read_only_preflight() -> dict:
    bindings = (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (IMPLEMENTATION_CONSUMPTION_PATH, IMPLEMENTATION_CONSUMPTION_SHA256, "implementation_consumption"),
        (CONFIG_PATH, CONFIG_SHA256, "config"),
        (SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256, "selection_contract"),
        (CONFIG_CPU_REPORT_PATH, CONFIG_CPU_REPORT_SHA256, "config_cpu_report"),
        (TRAINER_PATH, TRAINER_SHA256, "trainer"),
        (STAGE0_MANIFEST_PATH, STAGE0_MANIFEST_SHA256, "stage0_manifest"),
        (PREVIOUS_FAILURE_TERMINAL_PATH, PREVIOUS_FAILURE_TERMINAL_SHA256, "previous_failure_terminal"),
        (DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"),
        (SOURCE_INDEX_PATH, SOURCE_INDEX_SHA256, "source_index"),
        (SAMPLE_IMAGE_PATH, SAMPLE_IMAGE_SHA256, "sample_image"),
        (CONDITION_PACK_PATH, CONDITION_PACK_SHA256, "condition_pack"),
    )
    for path, expected_hash, code in bindings:
        if not resolve(path).is_file() or sha256_file(resolve(path)) != expected_hash:
            raise ValueError(f"stage4_readonly_diagnostic_{code}_missing_or_changed")
    authorization = read_json(resolve(AUTHORIZATION_PATH))
    implementation = read_json(resolve(IMPLEMENTATION_CONSUMPTION_PATH))
    config = read_json(resolve(CONFIG_PATH))
    selection = read_json(resolve(SELECTION_CONTRACT_PATH))
    cpu_report = read_json(resolve(CONFIG_CPU_REPORT_PATH))
    manifest = read_json(resolve(STAGE0_MANIFEST_PATH))
    dataset_manifest = read_json(resolve(DATASET_MANIFEST_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    validate_authorization(authorization, implementation)
    validate_bound_config(config, selection, cpu_report)
    validate_manifest_bindings(manifest, dataset_manifest)
    sample_row = validate_sample_binding(source_index)
    return {
        "schemaVersion": "v7-r5-stage4-readonly-diagnostic-gpu-smoke-preflight-v1",
        "status": "all_readonly_diagnostic_object_metric_prefix_fix_retry_preflights_passed_checkpoint_not_read_gpu_not_started",
        **timestamps("recordedAt"),
        "authorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": AUTHORIZATION_SHA256},
        "implementationConsumption": {"path": project_path(IMPLEMENTATION_CONSUMPTION_PATH), "sha256": IMPLEMENTATION_CONSUMPTION_SHA256},
        "config": {"path": project_path(CONFIG_PATH), "sha256": CONFIG_SHA256},
        "selectionContract": {"path": project_path(SELECTION_CONTRACT_PATH), "sha256": SELECTION_CONTRACT_SHA256},
        "trainer": {"path": project_path(TRAINER_PATH), "sha256": TRAINER_SHA256},
        "previousFailure": {
            "terminalPath": project_path(PREVIOUS_FAILURE_TERMINAL_PATH),
            "terminalSha256": PREVIOUS_FAILURE_TERMINAL_SHA256,
            "failureType": "ValueError",
            "lastCompletedStep": "single_denoiser_forward_and_diagnostic_measurement_completed",
            "failureCode": "formal_object_diagnostic_metric_keys_missing_due_to_prefix_case_mismatch",
        },
        "sample": {
            "sampleId": SAMPLE_ID,
            "conditionLabel": CONDITION_LABEL,
            "split": "validation",
            "imagePath": project_path(SAMPLE_IMAGE_PATH),
            "imageSha256": SAMPLE_IMAGE_SHA256,
            "conditionPackPath": project_path(CONDITION_PACK_PATH),
            "conditionPackSha256": CONDITION_PACK_SHA256,
            "v7CapacitySlotId": sample_row["v7CapacitySlotId"],
        },
        "checkpointBindingsFromImmutableManifestOnly": {
            "stage0Path": project_path(STAGE0_CHECKPOINT_PATH),
            "stage0Sha256": STAGE0_CHECKPOINT_SHA256,
            "autoencoderPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
            "autoencoderSha256": AUTOENCODER_CHECKPOINT_SHA256,
        },
        "diagnostic": {
            "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
            "timestep": DIAGNOSTIC_TIMESTEP,
            "seed": DIAGNOSTIC_SEED,
            "denoiserForwardPasses": 1,
            "lossBackwardPasses": 0,
            "optimizerSteps": 0,
        },
        **closed_boundaries(checkpoint_read=False, checkpoint_loaded=False, gpu_used=False),
    }


def validate_authorization(authorization: dict, implementation: dict) -> None:
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("stage4 read-only diagnostic authorization identity is invalid")
    if (
        implementation.get("status") != "object_metric_prefix_fix_implementation_scope_consumed_before_authorized_write"
        or implementation.get("authorizationSha256") != AUTHORIZATION_SHA256
        or implementation.get("commandRef") != COMMAND_REF
        or implementation.get("scope") != SCOPE
    ):
        raise ValueError("stage4 read-only diagnostic implementation consumption is invalid")
    identity = authorization.get("taskIdentity", {})
    required_identity = {
        "modelId": "ai-pet-world-complete-world-ai-assisted-cold-start-v7",
        "trainerPath": project_path(TRAINER_PATH),
        "trainerBeforeSha256": "836899f6cc596d6555fd5fb7aa18c94ade8ed324b1a4a058d982ecc4412996da",
        "runnerPath": project_path(Path("ml/ai-painter/scripts/run_ai_assisted_v7_r5_stage4_readonly_diagnostic_gpu_smoke.py")),
        "runnerBeforeSha256": "0b4e7120b5926263ec68ac5a3f5f11e509ae1f5f37443019f144edc4a4132900",
        "previousGpuFailureTerminalPath": project_path(PREVIOUS_FAILURE_TERMINAL_PATH),
        "previousGpuFailureTerminalSha256": PREVIOUS_FAILURE_TERMINAL_SHA256,
        "previousFailureType": "ValueError",
        "previousFailureLastCompletedStep": "single_denoiser_forward_and_diagnostic_measurement_completed",
        "sampleId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "sampleSplit": "validation",
        "inactiveConfigPath": project_path(CONFIG_PATH),
        "inactiveConfigSha256": CONFIG_SHA256,
        "stage0CheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
        "stage0CheckpointSha256": STAGE0_CHECKPOINT_SHA256,
        "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
        "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
        "diagnosticTimestep": DIAGNOSTIC_TIMESTEP,
        "diagnosticSeed": DIAGNOSTIC_SEED,
        "forwardPassCount": 1,
        "backwardPassCount": 0,
    }
    for key, expected in required_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4 read-only diagnostic identity is invalid: {key}")
    if identity.get("resolutionStage") != {"index": 0, "width": 256, "height": 192}:
        raise ValueError("stage4 read-only diagnostic retry resolution identity is invalid")
    if int(identity.get("requiredFormalDiagnosticMetricCount", 0)) != len(DIAGNOSTIC_KEYS):
        raise ValueError("stage4 read-only diagnostic formal metric count identity is invalid")
    if identity.get("authorizedCodeChange") != {
        "formalPrefixes": ["ObjectFootprints", "ObjectTree", "ObjectRock", "ObjectVegetation"],
        "legacyPrefixes": ["objectFootprints", "objectTree", "objectRock", "objectVegetation"],
        "legacyAliasesMustRemain": True,
        "trainerLogicBeyondMetricKeysAuthorized": False,
        "runnerChange": "update immutable authorization and trainer SHA-256 bindings only",
        "cpuCheckerChange": "verify formal keys, legacy aliases, alias value identity, and unchanged execution boundaries",
    }:
        raise ValueError("stage4 read-only diagnostic retry code-change identity is invalid")
    resolution = authorization.get("resolution", {})
    for key in (
        "trainerObjectMetricPrefixFixAuthorized",
        "legacyLowercaseMetricAliasesAuthorized",
        "runnerBindingUpdateAuthorized",
        "cpuCheckerUpdateAuthorized",
        "cpuPositiveNegativeRegressionAuthorized",
        "pythonPreflightAuthorized",
        "gpuResourcePreflightAuthorized",
        "diskBudgetPreflightAuthorized",
        "atomicGpuExecutionConsumptionRequired",
        "sameCheckpointHashVerificationAuthorizedAfterPreflight",
        "sameCheckpointReadAndLoadAuthorizedAfterPreflight",
        "sameSingleSampleGpuForwardAuthorized",
        "samePredictedRgbDiagnosticAutogradAuthorized",
        "diagnosticAndTerminalEvidenceStorageAuthorized",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"stage4 read-only diagnostic authorization is missing: {key}")
    for key in (
        "trainingConfigModificationAuthorized",
        "checkpointMutationAuthorized",
        "optimizerCreationAuthorized",
        "lossBackwardAuthorized",
        "modelWeightMutationAuthorized",
        "checkpointWriteAuthorized",
        "trainingAuthorized",
        "fullTrainingAuthorized",
        "additionalAutomaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"stage4 read-only diagnostic boundary is open: {key}")


def validate_bound_config(config, selection, cpu_report) -> None:
    if config.get("status") != "r5_stage4_diagnostic_parameters_selected_inactive":
        raise ValueError("stage4 read-only diagnostic config is not inactive")
    training = config.get("training", {})
    if (
        training.get("trainingAuthorizationStatus") != "not_authorized_diagnostic_candidate_only"
        or training.get("stage4FullTrainingContract", {}).get("status") != "diagnostic_candidate_inactive"
        or selection.get("status") != "cpu_verified_bounded_diagnostic_parameters_selected_inactive"
        or cpu_report.get("status") != "passed_cpu_only_inactive_diagnostic_config_not_active"
        or cpu_report.get("failures") != []
    ):
        raise ValueError("stage4 read-only diagnostic source gates are not closed")
    trainer.validate_v7_r5_stage4_failure_diagnostic_support_contract(config)
    if tuple(training.get("stage4FailureDiagnostics", {}).get("parameterSelection", {}).get("diagnosticEpochs", [])) != (1, 5, 10, 20, 30, 40):
        raise ValueError("stage4 read-only diagnostic epoch evidence is invalid")


def validate_manifest_bindings(manifest, dataset_manifest) -> None:
    if (
        manifest.get("status") != "conditional_denoiser_training_completed_pending_validation"
        or manifest.get("checkpointPath") != project_path(STAGE0_CHECKPOINT_PATH)
        or manifest.get("checkpointSha256") != STAGE0_CHECKPOINT_SHA256
        or manifest.get("autoencoderCheckpointPath") != project_path(AUTOENCODER_CHECKPOINT_PATH)
        or manifest.get("autoencoderCheckpointSha256") != AUTOENCODER_CHECKPOINT_SHA256
        or manifest.get("datasetManifestPath") != project_path(DATASET_MANIFEST_PATH)
        or manifest.get("datasetManifestSha256") != DATASET_MANIFEST_SHA256
        or manifest.get("sourceIndexPath") != project_path(SOURCE_INDEX_PATH)
        or manifest.get("sourceIndexSha256") != SOURCE_INDEX_SHA256
        or manifest.get("resolutionStage") != {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]}
        or manifest.get("denoiserTrained") is not True
        or manifest.get("formalInferenceEligible") is not False
    ):
        raise ValueError("stage4 read-only diagnostic Stage 0 manifest binding is invalid")
    if (
        dataset_manifest.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1"
        or dataset_manifest.get("sourceIndexPath") != project_path(SOURCE_INDEX_PATH)
        or dataset_manifest.get("canTrainConditionalDenoiser") is not True
        or dataset_manifest.get("formalInferenceEligible") is not False
    ):
        raise ValueError("stage4 read-only diagnostic dataset manifest is invalid")


def validate_sample_binding(source_index):
    rows = [row for row in source_index.get("samples", []) if row.get("sampleId") == SAMPLE_ID]
    if len(rows) != 1:
        raise ValueError("stage4 read-only diagnostic sample identity is not unique")
    row = rows[0]
    required = {
        "recordId": SAMPLE_ID,
        "conditionLabel": CONDITION_LABEL,
        "split": "validation",
        "imagePath": project_path(SAMPLE_IMAGE_PATH),
        "imageSha256": SAMPLE_IMAGE_SHA256,
        "conditionPackPath": project_path(CONDITION_PACK_PATH),
        "v7CapacitySlotId": "v7-capacity-slot-194",
        "v7CapacityContributionRegistered": True,
        "formalConditionalTrainingEligible": True,
        "conditionBound": True,
        "ownerReviewStatus": "owner_approved",
        "machineReviewStatus": "passed",
    }
    for key, expected in required.items():
        if row.get(key) != expected:
            raise ValueError(f"stage4 read-only diagnostic sample binding is invalid: {key}")
    return row


def validate_gpu_execution_consumption(preflight: dict) -> dict:
    if not resolve(GPU_EXECUTION_CONSUMPTION_PATH).is_file():
        raise ValueError("stage4 read-only diagnostic GPU execution consumption is missing")
    consumption = read_json(resolve(GPU_EXECUTION_CONSUMPTION_PATH))
    if (
        consumption.get("status") != "gpu_diagnostic_object_metric_prefix_fix_retry_execution_scope_consumed_after_all_preflights_passed"
        or consumption.get("authorizationSha256") != AUTHORIZATION_SHA256
        or consumption.get("commandRef") != COMMAND_REF
        or consumption.get("scope") != SCOPE
        or int(consumption.get("allowedGpuRetryExecutionCount", 0)) != 1
        or consumption.get("preflightStatus") != preflight["status"]
        or consumption.get("sameStage0CheckpointFileReadAuthorizedNow") is not True
        or consumption.get("sameAutoencoderCheckpointFileReadAuthorizedNow") is not True
        or consumption.get("sameGpuDiagnosticForwardAuthorizedNow") is not True
    ):
        raise ValueError("stage4 read-only diagnostic GPU execution consumption is invalid")
    for key in (
        "optimizerCreationAuthorized",
        "lossBackwardAuthorized",
        "modelWeightMutationAuthorized",
        "checkpointWriteAuthorized",
        "trainingAuthorized",
        "additionalAutomaticRetryAuthorized",
    ):
        if consumption.get(key) is not False:
            raise ValueError(f"stage4 read-only diagnostic execution boundary is open: {key}")
    return consumption


def run_gpu_diagnostic(output_dir: Path, preflight: dict) -> int:
    full_output = resolve(output_dir)
    full_output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    execution_state = {
        "completedSteps": [],
        "lastCompletedStep": None,
        "checkpointFileRead": False,
        "checkpointDeserialized": False,
        "checkpointModelLoaded": False,
        "gpuUsed": False,
        "diagnosticForwardCompleted": False,
        "diagnosticAutogradCompleted": False,
    }

    def complete_step(number: int, code: str, details=None):
        marker = record_execution_step(full_output, number, code, details or {})
        execution_state["completedSteps"].append(marker)
        execution_state["lastCompletedStep"] = code

    try:
        consumption = validate_gpu_execution_consumption(preflight)
        complete_step(1, "gpu_retry_execution_consumption_validated", {
            "consumptionPath": project_path(GPU_EXECUTION_CONSUMPTION_PATH),
            "consumptionSha256": sha256_file(resolve(GPU_EXECUTION_CONSUMPTION_PATH)),
        })
        if not torch.cuda.is_available():
            raise ValueError("CUDA is unavailable for the authorized GPU diagnostic")
        complete_step(2, "cuda_availability_verified", {"deviceCount": torch.cuda.device_count()})
        if sha256_file(resolve(STAGE0_CHECKPOINT_PATH)) != STAGE0_CHECKPOINT_SHA256:
            raise ValueError("bound Stage 0 checkpoint SHA-256 changed")
        execution_state["checkpointFileRead"] = True
        complete_step(3, "stage0_checkpoint_hash_verified", {"sha256": STAGE0_CHECKPOINT_SHA256})
        if sha256_file(resolve(AUTOENCODER_CHECKPOINT_PATH)) != AUTOENCODER_CHECKPOINT_SHA256:
            raise ValueError("bound autoencoder checkpoint SHA-256 changed")
        complete_step(4, "autoencoder_checkpoint_hash_verified", {"sha256": AUTOENCODER_CHECKPOINT_SHA256})

        config = read_json(resolve(CONFIG_PATH))
        package = read_json(resolve(DATASET_MANIFEST_PATH))
        device = torch.device("cuda:0")
        torch.manual_seed(DIAGNOSTIC_SEED)
        torch.cuda.init()
        execution_state["gpuUsed"] = True
        current_device_index = int(torch.cuda.current_device())
        if current_device_index != 0:
            raise ValueError(f"authorized CUDA device index is not active: {current_device_index}")
        complete_step(5, "cuda_context_initialized_and_device_zero_confirmed", {
            "deviceIndex": current_device_index,
            "initialized": bool(torch.cuda.is_initialized()),
        })
        torch.cuda.manual_seed_all(DIAGNOSTIC_SEED)
        torch.cuda.reset_peak_memory_stats(0)
        complete_step(6, "cuda_memory_telemetry_reset_with_integer_device_index", {"deviceIndex": 0})

        dataset = AiAssistedConditionalDenoiserDataset(
            resolve(DATASET_MANIFEST_PATH),
            "validation",
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            require_v7_capacity_contribution=True,
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("bound diagnostic sample is absent from the loaded validation split")
        sample = dataset[matches[0]]
        complete_step(7, "bound_validation_sample_loaded", {"sampleId": SAMPLE_ID, "conditionLabel": CONDITION_LABEL})

        autoencoder_checkpoint = trainer.load_autoencoder_checkpoint(resolve(AUTOENCODER_CHECKPOINT_PATH), config)
        execution_state["checkpointDeserialized"] = True
        complete_step(8, "autoencoder_checkpoint_deserialized_and_validated", {"sha256": AUTOENCODER_CHECKPOINT_SHA256})
        stage0_checkpoint = torch.load(resolve(STAGE0_CHECKPOINT_PATH), map_location="cpu", weights_only=False)
        validate_stage0_checkpoint(stage0_checkpoint, config, package)
        complete_step(9, "stage0_checkpoint_deserialized_and_validated", {"sha256": STAGE0_CHECKPOINT_SHA256})
        model = build_complete_world_system(config)
        model.autoencoder.load_state_dict(autoencoder_checkpoint["autoencoderState"])
        model.denoiser.load_state_dict(stage0_checkpoint["denoiserState"])
        execution_state["checkpointModelLoaded"] = True
        complete_step(10, "bound_model_states_loaded", {"optimizerCreated": False})
        autoencoder_state_before = state_dict_sha256(model.autoencoder.state_dict())
        denoiser_state_before = state_dict_sha256(model.denoiser.state_dict())
        model = model.to(device)
        model.eval()
        complete_step(11, "model_moved_to_bound_gpu", {"device": "cuda:0"})

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        latent_normalization = trainer.load_latent_normalization(stage0_checkpoint, device)
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([DIAGNOSTIC_TIMESTEP], dtype=torch.long, device=device)
        with torch.no_grad():
            clean_latent = trainer.normalize_latent(model.autoencoder.encode(image), latent_normalization)
        noise = torch.randn_like(clean_latent)
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        metrics = trainer.predict_and_measure(
            model,
            noisy_latent,
            target_velocity,
            clean_latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            config,
            image,
            latent_normalization,
        )
        execution_state["diagnosticForwardCompleted"] = True
        complete_step(12, "single_denoiser_forward_and_diagnostic_measurement_completed", {"timestep": DIAGNOSTIC_TIMESTEP})
        missing = [key for key in DIAGNOSTIC_KEYS if key not in metrics]
        if missing:
            raise ValueError(f"Stage 4 diagnostic metrics are missing: {missing}")
        diagnostic_metrics = {key: float(metrics[key].detach().cpu()) for key in DIAGNOSTIC_KEYS}
        if diagnostic_metrics["stage4DiagnosticObjectGradientAvailable"] != 1.0:
            raise ValueError("Stage 4 object diagnostic gradient was unavailable")
        execution_state["diagnosticAutogradCompleted"] = True
        complete_step(13, "predicted_rgb_diagnostic_autograd_verified", {"diagnosticMetricCount": len(diagnostic_metrics)})
        parameter_gradients_absent = all(parameter.grad is None for parameter in model.parameters())
        if not parameter_gradients_absent:
            raise ValueError("model parameter gradients were unexpectedly populated")
        torch.cuda.synchronize(0)
        peak_memory = int(torch.cuda.max_memory_allocated(0))
        complete_step(14, "cuda_memory_telemetry_collected_with_integer_device_index", {"deviceIndex": 0, "peakMemoryAllocatedBytes": peak_memory})
        model = model.to("cpu")
        autoencoder_state_after = state_dict_sha256(model.autoencoder.state_dict())
        denoiser_state_after = state_dict_sha256(model.denoiser.state_dict())
        if autoencoder_state_before != autoencoder_state_after or denoiser_state_before != denoiser_state_after:
            raise ValueError("model state changed during the read-only diagnostic")
        complete_step(15, "model_state_hashes_verified_unchanged", {
            "autoencoderStateSha256": autoencoder_state_after,
            "denoiserStateSha256": denoiser_state_after,
        })

        report = {
            "schemaVersion": "v7-r5-stage4-readonly-single-sample-gpu-diagnostic-report-v1",
            "status": "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged",
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "device": {
                "type": "cuda",
                "index": 0,
                "name": torch.cuda.get_device_name(0),
                "peakMemoryAllocatedBytes": peak_memory,
            },
            "authorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": AUTHORIZATION_SHA256},
            "executionConsumption": {
                "path": project_path(GPU_EXECUTION_CONSUMPTION_PATH),
                "sha256": sha256_file(resolve(GPU_EXECUTION_CONSUMPTION_PATH)),
                "status": consumption["status"],
            },
            "inputs": {
                "configPath": project_path(CONFIG_PATH),
                "configSha256": CONFIG_SHA256,
                "sampleId": SAMPLE_ID,
                "conditionLabel": CONDITION_LABEL,
                "sampleSplit": "validation",
                "imageSha256": SAMPLE_IMAGE_SHA256,
                "conditionPackSha256": CONDITION_PACK_SHA256,
                "stage0CheckpointPath": project_path(STAGE0_CHECKPOINT_PATH),
                "stage0CheckpointSha256": STAGE0_CHECKPOINT_SHA256,
                "autoencoderCheckpointPath": project_path(AUTOENCODER_CHECKPOINT_PATH),
                "autoencoderCheckpointSha256": AUTOENCODER_CHECKPOINT_SHA256,
                "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
                "timestep": DIAGNOSTIC_TIMESTEP,
                "seed": DIAGNOSTIC_SEED,
            },
            "diagnosticMetrics": diagnostic_metrics,
            "integrity": {
                "autoencoderStateSha256Before": autoencoder_state_before,
                "autoencoderStateSha256After": autoencoder_state_after,
                "denoiserStateSha256Before": denoiser_state_before,
                "denoiserStateSha256After": denoiser_state_after,
                "parameterGradientsAbsentAfterDiagnostic": parameter_gradients_absent,
                "completedSteps": execution_state["completedSteps"],
                "lastCompletedStep": execution_state["lastCompletedStep"],
            },
            **closed_boundaries(checkpoint_read=True, checkpoint_loaded=True, gpu_used=True),
        }
        report_path = full_output / "diagnostic-report.json"
        write_json_exclusive(report_path, report)
        complete_step(16, "diagnostic_report_written", {"reportPath": project_path(report_path), "reportSha256": sha256_file(report_path)})
        terminal = {
            "schemaVersion": "v7-r5-stage4-readonly-diagnostic-gpu-smoke-terminal-v1",
            "status": "r5_stage4_readonly_single_sample_gpu_diagnostic_completed_closed",
            **timestamps("recordedAt"),
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "blockers": [],
            "nextIndependentAuthorization": "local_failure_analyzer_readonly_diagnostic_evidence_interpretation_only",
            "completedSteps": execution_state["completedSteps"],
            "lastCompletedStep": execution_state["lastCompletedStep"],
            **closed_boundaries(checkpoint_read=True, checkpoint_loaded=True, gpu_used=True),
        }
        terminal_path = full_output / "phase-terminal.json"
        write_json_exclusive(terminal_path, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(terminal_path), "terminalSha256": sha256_file(terminal_path)}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        failure = {
            "schemaVersion": "v7-r5-stage4-readonly-diagnostic-gpu-smoke-terminal-v1",
            "status": "r5_stage4_readonly_single_sample_gpu_diagnostic_failed_closed",
            **timestamps("recordedAt"),
            "failureType": type(error).__name__,
            "failureMessage": str(error),
            "traceback": traceback.format_exc(),
            "completedSteps": execution_state["completedSteps"],
            "lastCompletedStep": execution_state["lastCompletedStep"],
            "checkpointFileRead": execution_state["checkpointFileRead"],
            "checkpointDeserialized": execution_state["checkpointDeserialized"],
            "checkpointModelLoaded": execution_state["checkpointModelLoaded"],
            "gpuUsed": execution_state["gpuUsed"],
            "diagnosticForwardCompleted": execution_state["diagnosticForwardCompleted"],
            "diagnosticAutogradCompleted": execution_state["diagnosticAutogradCompleted"],
            "automaticRetryStarted": False,
            "optimizerCreated": False,
            "lossBackwardExecuted": False,
            "modelWeightsModified": False,
            "checkpointWritten": False,
            "trainingStarted": False,
            "fullTrainingStarted": False,
            "strictRevalidationStarted": False,
            "formalInferenceStarted": False,
            "checkpointFormallyPromoted": False,
            "runtimeFrameStarted": False,
            "worldEntryStarted": False,
        }
        failure_path = full_output / "phase-terminal.json"
        write_json_exclusive(failure_path, failure)
        print(json.dumps({**failure, "terminalPath": project_path(failure_path), "terminalSha256": sha256_file(failure_path)}, ensure_ascii=False, indent=2))
        return 1


def validate_stage0_checkpoint(checkpoint, config, package):
    required = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "ownership": trainer.OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "modelId": config["modelId"],
        "architectureVersion": config["architectureVersion"],
        "datasetPackageId": package["packageId"],
        "actualLoadedConditionalSampleCount": 64,
        "actualLoadedV7CapacityCount": 64,
        "actualLoadedSplitCounts": trainer.V7_MVP64_SPLIT_COUNTS,
        "resolutionStage": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "trainingStage": "conditional_denoiser_training",
        "denoiserTrained": True,
        "formalInferenceEligible": False,
        "thirdPartyWeightsLoaded": False,
        "upstreamModelIds": [],
    }
    for key, expected in required.items():
        if checkpoint.get(key) != expected:
            raise ValueError(f"bound Stage 0 checkpoint identity is invalid: {key}")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("bound Stage 0 checkpoint denoiser state is missing")


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def record_execution_step(output_dir: Path, number: int, code: str, details: dict):
    payload = {
        "schemaVersion": "v7-r5-stage4-readonly-diagnostic-execution-step-v1",
        "stepNumber": number,
        "stepCode": code,
        "status": "completed",
        **timestamps("recordedAt"),
        "details": details,
    }
    path = output_dir / "execution-steps" / f"{number:03d}-{code}.json"
    write_json_exclusive(path, payload)
    return {
        "stepNumber": number,
        "stepCode": code,
        "path": project_path(path),
        "sha256": sha256_file(path),
    }


def closed_boundaries(*, checkpoint_read: bool, checkpoint_loaded: bool, gpu_used: bool):
    return {
        "checkpointFileRead": checkpoint_read,
        "checkpointLoaded": checkpoint_loaded,
        "optimizerCreated": False,
        "lossBackwardExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "gpuUsed": gpu_used,
        "trainingStarted": False,
        "fullTrainingStarted": False,
        "automaticRetryStarted": False,
        "strictRevalidationStarted": False,
        "formalInferenceStarted": False,
        "checkpointFormallyPromoted": False,
        "runtimeFrameStarted": False,
        "worldEntryStarted": False,
    }


def timestamps(prefix: str):
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
    }


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, payload):
    full_path = resolve(path)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with full_path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve(path: Path):
    return path if path.is_absolute() else ROOT / path


def project_path(path: Path):
    full_path = resolve(path)
    try:
        return full_path.relative_to(ROOT).as_posix()
    except ValueError:
        return full_path.resolve().relative_to(ROOT.resolve()).as_posix()


if __name__ == "__main__":
    raise SystemExit(main())

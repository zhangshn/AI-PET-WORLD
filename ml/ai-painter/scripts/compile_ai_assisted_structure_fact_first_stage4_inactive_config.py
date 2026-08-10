from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-structure-fact-first-dual-stage-cpu-support-20260810-212419895/"
    "implementation-authorization.json"
)
CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "implementation-consumption.json"
SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/v9-r5-stage4-cpu-support/20260809-161005213/inactive-config.json"
)
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
SOURCE_INDEX_PATH = DATASET_PATH.parent / "source-index.json"
ARCHITECTURE_ID = "stage4_structure_fact_first_dual_stage_generator_v1"
CONTRACT_ID = ARCHITECTURE_ID
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
STRUCTURE_CHANNELS = [
    "terrain_path_ground",
    "route_required_boundary",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
]
STAGE_B_INJECTION_SCALES = ["level0", "level1", "middle", "up1", "up0"]
LEGAL_SUPERVISION_SOURCES = [
    "original_owner_approved_reference_rgb",
    "original_compiled_23_channel_condition_pack",
    "approved_world_facts_visual_fact_manifest_region_graph_and_edge_ports",
    "project_generated_game_coordinate_route_geometry",
    "original_object_identity_and_semantic_masks",
    "frozen_project_autoencoder_encoder_and_decoder_features",
    "current_model_prediction_derived_without_failed_preview_targets",
]
PROHIBITED_TRAINING_SOURCES = [
    "failed_preview_pixels",
    "machine_review_thresholds",
    "machine_review_pass_fail_labels_as_loss_targets",
    "checkpoint_selected_from_failed_smoke",
    "unapproved_external_rgb",
]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    authorization = validate_authorization()
    expected_output = Path(authorization["execution"]["inactiveConfigPath"])
    if project_path(args.output) != project_path(expected_output):
        raise ValueError("Stage 4 structure-fact-first output path is not authorized")
    source = read_json(resolve(SOURCE_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == SAMPLE_ID and row.get("v7CapacityContributionRegistered") is True
    ]
    if len(rows) != 1 or rows[0].get("split") != "validation":
        raise ValueError("Stage 4 structure-fact-first fixed qualification sample is not unique validation")
    config = compile_config(source, authorization, rows[0])
    trainer.validate_training_inputs(config, package)
    write_json_exclusive(args.output, config)
    print(json.dumps({
        "status": "stage4_structure_fact_first_inactive_config_compiled_cpu_validated",
        "configPath": project_path(args.output),
        "configSha256": sha256_file(resolve(args.output)),
        "architectureId": ARCHITECTURE_ID,
        "conditionChannelCount": 23,
        "datasetCapacity": package.get("v7CapacityContributionCount"),
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "checkpointReadOrLoaded": False,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def validate_authorization() -> dict:
    authorization = read_json(resolve(AUTHORIZATION_PATH))
    request_id = "owner-authorized-stage4-structure-fact-first-dual-stage-cpu-support-20260810-212419895"
    scope = "implement_stage4_structure_fact_first_dual_stage_generator_v1_cpu_support_inactive_only"
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
    ):
        raise ValueError("Stage 4 structure-fact-first implementation authorization identity is invalid")
    required_true = (
        "modelArchitectureRegistryImplementation", "stageALayoutPredictorCpuImplementation",
        "stageBConditionPreservingDenoiserCpuImplementation", "trainerLegalSupervisionCpuImplementation",
        "checkpointSourceIsolationImplementation", "modeRegistryImplementation",
        "inactiveConfigCompilerImplementation", "diagnosticManifestImplementation",
        "previewReproductionIdentityContractImplementation", "syntheticCpuTensorForward",
        "syntheticCpuAutogradGrad", "cpuPositiveNegativeRegression", "fullInactiveConfigAudit",
        "legacyV7V8V9CompatibilityRegression", "inactiveConfigWrite", "supportContractWrite",
        "cpuReportWrite", "ownerActionRequestWrite", "terminalEvidenceWrite",
        "uniquePlanUpdate", "localTaskCapsuleWrite",
    )
    required_false = (
        "freeHyperparameterSelection", "checkpointReadOrLoad", "optimizerCreation",
        "backwardMethodExecution", "modelWeightModification", "gpuUse", "training",
        "reviewThresholdModification", "stage4FullTraining", "stage5StrictRevalidation",
        "formalInference", "checkpointPromotion", "runtimeFrame", "worldEntry", "automaticRetry",
    )
    actions = authorization.get("authorizedActions", {})
    if any(actions.get(key) is not True for key in required_true):
        raise ValueError("Stage 4 structure-fact-first implementation actions are incomplete")
    if any(actions.get(key) is not False for key in required_false):
        raise ValueError("Stage 4 structure-fact-first forbidden implementation action is open")
    for key in (
        "designTerminal", "architectureComparison", "inactiveImplementationContract",
        "designCpuRegression", "modelBefore", "trainerBefore", "modeRegistryBefore",
        "v9CompilerBaseline", "v9CpuCheckerBaseline",
    ):
        binding = authorization.get("bindings", {}).get(key, {})
        if binding.get("sha256") != sha256_file(resolve(Path(binding.get("path", "missing")))):
            raise ValueError(f"Stage 4 structure-fact-first immutable binding changed: {key}")
    design_terminal = read_json(resolve(Path(authorization["bindings"]["designTerminal"]["path"])))
    design_contract = read_json(resolve(Path(authorization["bindings"]["inactiveImplementationContract"]["path"])))
    if (
        design_terminal.get("status")
        != "stage4_new_model_route_design_converged_recommended_contract_inactive_closed"
        or design_terminal.get("recommendedContractId") != CONTRACT_ID
        or design_contract.get("status") != "owner_implementation_authorization_required_not_activated"
        or design_contract.get("architectureId") != ARCHITECTURE_ID
    ):
        raise ValueError("Stage 4 structure-fact-first design prerequisite is not valid and inactive")
    consumption = read_json(resolve(CONSUMPTION_PATH))
    if (
        consumption.get("status") != "consumed_once_before_cpu_implementation"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != sha256_file(resolve(AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("Stage 4 structure-fact-first authorization was not atomically consumed")
    return authorization


def compile_config(source: dict, authorization: dict, sample: dict) -> dict:
    config = deepcopy(source)
    config["architectureVersion"] = "structure-fact-first-dual-stage-generator-v1-cpu"
    config["denoiserArchitecture"] = ARCHITECTURE_ID
    config["status"] = "stage4_structure_fact_first_dual_stage_cpu_supported_inactive"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training.pop("stage4ObjectSemanticDecoderAlignment", None)
    training.pop("v9Stage4SingleSampleSmokeContract", None)
    training.pop("v9Stage4SmokeExecution", None)
    training["trainingAuthorizationStatus"] = trainer.STRUCTURE_FACT_FIRST_STAGE4_CPU_INACTIVE_STATUS
    training["authorizedInitialization"] = "project_random_structure_fact_first_denoiser"
    training["denoiserLossVersion"] = "velocity_structure_fact_layout_condition_preserving_rgb_v1"
    training["bestCheckpointMetric"] = "fixed_grid_structure_fact_and_rgb_semantic_score_v1"
    training["stage4StructureFactFirstQualificationContract"] = {
        "status": "compiled_inactive_not_authorized",
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "conditionLabel": sample["conditionLabel"],
        "imagePath": sample["imagePath"],
        "imageSha256": sample["imageSha256"],
        "conditionPackPath": sample["conditionPackPath"],
        "conditionPackSha256": sha256_file(resolve(Path(sample["conditionPackPath"]))),
        "seed": int(training.get("seed", 20263722)),
        "requiredBoundarySides": ["west"],
        "resolution": {"width": 256, "height": 192},
        "epochCount": int(training.get("denoiserEpochs", 30)),
        "previewEpochs": [1, 5, 10, 20, 30],
        "datasetSelectionContract": "registered_v7_capacity_contribution_v1",
        "requiredSplitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "stage0Initialization": "project_random_structure_fact_first_denoiser",
        "configurationActiveNow": False,
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "structure_fact_first_diagnostic_manifest_supported_inactive",
        "objectSemanticDiagnostics": {
            "channels": ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
            "measurements": ["independent_loss", "gradient_contribution", "decoded_response"],
            "gradientTarget": "matching_structure_fact_independent_typed_head_output",
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "measurements": ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"],
            "conditionChannel": "terrain_path_ground",
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
    authorization_binding = binding(AUTHORIZATION_PATH)
    consumption_binding = binding(CONSUMPTION_PATH)
    training["stage4StructureFactFirstDualStage"] = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": CONTRACT_ID,
        "architectureId": ARCHITECTURE_ID,
        "conditionChannelCount": 23,
        "conditionSchemaChanged": False,
        "latentOutputShapeChanged": False,
        "autoencoderWeightsChanged": False,
        "datasetCapacityOrSplitChanged": False,
        "legacyV7V8V9ModesPreserved": True,
        "oldDenoiserCheckpointCompatible": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
        "trainingLossImplementationStatus": "implemented_cpu_verified_not_active",
        "stageA": {
            "component": "typed_semantic_topology_layout_predictor",
            "inputChannels": deepcopy(config["conditionChannelOrder"]),
            "outputChannels": deepcopy(STRUCTURE_CHANNELS),
            "independentTypedHeads": True,
            "auditableIntermediate": True,
            "hiddenDimensionsSource": "existing_denoiserBaseChannels",
        },
        "stageB": {
            "component": "condition_preserving_rgb_latent_denoiser",
            "originalConditionChannels": deepcopy(config["conditionChannelOrder"]),
            "structureInputChannels": deepcopy(STRUCTURE_CHANNELS),
            "injectionScales": deepcopy(STAGE_B_INJECTION_SCALES),
            "originalConditionsPreservedAtEveryScale": True,
            "latentChannelsSource": "existing_latentChannels",
        },
        "legalSupervision": {
            "allowedSources": deepcopy(LEGAL_SUPERVISION_SOURCES),
            "prohibitedSources": deepcopy(PROHIBITED_TRAINING_SOURCES),
            "layoutLoss": "balanced_binary_condition_loss_over_six_typed_structure_channels",
            "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "failedPreviewPixelsUsedAsTrainingTargets": False,
            "machineReviewThresholdsUsedAsTrainingTargets": False,
            "machineReviewLabelsUsedAsTrainingTargets": False,
            "newFreeHyperparameterSelected": False,
        },
        "checkpointIsolation": {
            "v7V8V9DenoiserReadOrLoadAuthorized": False,
            "newRouteCheckpointReadOrLoadAuthorized": False,
            "fixedRandomInitializationRequiredForFutureQualification": True,
            "checkpointSchema": "stage4_structure_fact_first_dual_stage_generator_v1_only",
        },
        "previewReproductionIdentity": {
            "status": "contract_supported_inactive",
            "fixedEpochs": [1, 5, 10, 20, 30],
            "requiredIdentityFields": [
                "modelStateSha256", "seed", "sampler", "timestepSequence",
                "conditionTensorSha256", "autoencoderSha256", "decodeConfigSha256",
                "rgbTensorSha256", "pngSha256",
            ],
            "dynamicMetadataForbidden": True,
            "configurationActiveNow": False,
        },
        "diagnosticManifestRegistry": {
            "contractId": "stage4_structure_fact_first_diagnostic_manifest_v1",
            "recordLocation": "manifest.metrics[*]",
            "fixedEpochs": [1, 5, 10, 20, 30],
            "exactFieldCount": len(trainer.STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
            "exactFields": list(trainer.STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
            "rejectUnknownDiagnosticFields": True,
            "finiteNonnegativeNumbersRequired": True,
            "visualReviewIndependent": True,
        },
        "hyperparameterSelections": [],
        "evidenceBindings": {
            "designTerminal": deepcopy(authorization["bindings"]["designTerminal"]),
            "architectureComparison": deepcopy(authorization["bindings"]["architectureComparison"]),
            "inactiveImplementationContract": deepcopy(authorization["bindings"]["inactiveImplementationContract"]),
            "designCpuRegression": deepcopy(authorization["bindings"]["designCpuRegression"]),
        },
        "ownerImplementationAuthorization": {
            "authorizationPath": authorization_binding["path"],
            "authorizationSha256": authorization_binding["sha256"],
            "implementationConsumptionPath": consumption_binding["path"],
            "implementationConsumptionSha256": consumption_binding["sha256"],
            "commandRef": authorization["commandRef"],
            "scope": authorization["scope"],
        },
        "activationGate": {
            "configurationActiveNow": False,
            "checkpointReadNow": False,
            "optimizerCreationNow": False,
            "backwardExecutionNow": False,
            "modelParameterUpdateNow": False,
            "gpuUseNow": False,
            "trainingNow": False,
            "checkpointWriteNow": False,
            "stage4FullTrainingNow": False,
            "stage5StrictRevalidationNow": False,
            "formalInferenceNow": False,
            "checkpointPromotionNow": False,
            "runtimeFrameNow": False,
            "worldEntryNow": False,
        },
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "authorizationPath": authorization_binding["path"],
        "authorizationSha256": authorization_binding["sha256"],
        "implementationConsumptionPath": consumption_binding["path"],
        "implementationConsumptionSha256": consumption_binding["sha256"],
        "status": "not_authorized_cpu_support_only",
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "backwardExecutionAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "fullTrainingAuthorized": False,
        "strictRevalidationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    return config


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


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(resolve(path))}


def read_json(path: Path) -> dict:
    return json.loads(resolve(path).read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

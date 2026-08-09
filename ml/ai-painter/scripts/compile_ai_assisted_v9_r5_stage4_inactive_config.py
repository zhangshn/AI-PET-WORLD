from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v9-stage4-cpu-support-and-manifest-registry-20260809.json"
)
CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v9-stage4-cpu-support-and-manifest-registry-20260809/"
    "implementation-consumption.json"
)
SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/v8-r5-stage4-training-loss-smoke-cpu/"
    "20260808-220500000/inactive-config.json"
)
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
SOURCE_INDEX_PATH = DATASET_PATH.parent / "source-index.json"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
OBJECT_CHANNELS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
ALLOWED_SOURCES = [
    "original_owner_approved_reference_rgb",
    "original_compiled_23_channel_condition_pack",
    "approved_world_facts",
    "original_object_semantic_and_identity_masks",
    "current_training_prediction_decoded_by_frozen_project_autoencoder",
    "frozen_project_autoencoder_decoded_features",
    "approved_project_route_geometry_and_region_graph_for_west_topology_consistency",
]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    authorization = validate_authorization()
    expected_output = Path(authorization["outputPaths"]["inactiveConfig"])
    if project_path(args.output) != project_path(expected_output):
        raise ValueError("V9 inactive config output path is not the authorized immutable target")
    source = read_json(resolve(SOURCE_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == SAMPLE_ID and row.get("v7CapacityContributionRegistered") is True
    ]
    if len(rows) != 1 or rows[0].get("split") != "validation":
        raise ValueError("V9 fixed sample identity is not unique validation in approved capacity rows")
    design_contract = read_json(resolve(Path(authorization["bindings"]["v9InactiveDesignContract"]["path"])))
    config = compile_config(source, authorization, design_contract, rows[0])
    trainer.validate_training_inputs(config, package)
    write_json_exclusive(args.output, config)
    print(json.dumps({
        "status": "v9_stage4_inactive_config_compiled_cpu_validated_not_active",
        "configPath": project_path(args.output),
        "configSha256": sha256_file(resolve(args.output)),
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "diagnosticManifestMetricCount": 17,
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def validate_authorization() -> dict:
    authorization = read_json(resolve(AUTHORIZATION_PATH))
    request_id = "owner-authorized-v9-stage4-cpu-support-and-manifest-registry-20260809"
    scope = "implement_v9_cpu_architecture_object_semantic_supervision_exact_17_manifest_registry_inactive_config_and_regressions_only"
    if (
        authorization.get("requestId") != request_id
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != request_id
        or authorization.get("ownerDecision", {}).get("scope") != scope
    ):
        raise ValueError("V9 CPU implementation authorization identity is invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "modelV9ArchitectureBranchImplementation", "trainerV9AuthorizationAndLegalSupervisionImplementation",
        "exact17DiagnosticManifestRegistryImplementation", "v9InactiveConfigCompilerImplementation",
        "v9CpuCheckerImplementation", "syntheticCpuTensorForward", "syntheticCpuAutogradInspection",
        "cpuPositiveNegativeRegression", "legacyV7V8CompatibilityRegression", "inactiveConfigWrite",
        "supportContractWrite", "cpuReportWrite", "terminalEvidenceWrite", "uniquePlanUpdate",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"V9 CPU implementation action is closed: {key}")
    for key in (
        "hyperparameterSelection", "checkpointFileReadOrLoad", "optimizerCreation",
        "backwardMethodExecution", "modelWeightModification", "gpuUse", "training",
        "reviewThresholdModification", "stage4FullTraining", "stage1OrStage2",
        "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
        "worldEntry", "automaticRetry",
    ):
        if actions.get(key) is not False:
            raise ValueError(f"V9 CPU implementation forbidden action is open: {key}")
    for key in (
        "v9DesignTerminal", "v9DesignReport", "v9InactiveDesignContract",
        "v8CompilerCompatibilityBaseline", "v8CpuCheckerCompatibilityBaseline",
        "v8InactiveConfigSource", "datasetManifest", "datasetSourceIndex", "formalSpecification",
    ):
        binding = authorization.get("bindings", {}).get(key, {})
        if binding.get("sha256") != sha256_file(resolve(Path(binding.get("path", "missing")))):
            raise ValueError(f"V9 CPU implementation immutable binding changed: {key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["v9DesignTerminal"]["path"])))
    design = read_json(resolve(Path(authorization["bindings"]["v9InactiveDesignContract"]["path"])))
    if (
        terminal.get("status") != "v9_stage4_architecture_design_and_diagnostic_manifest_contract_completed_closed"
        or design.get("status") != "designed_inactive_not_implemented"
        or design.get("contractId") != "stage4_object_semantic_decoder_alignment_v9_v1"
    ):
        raise ValueError("V9 design prerequisite is not successful and inactive")
    consumption = read_json(resolve(CONSUMPTION_PATH))
    if (
        consumption.get("status") != "v9_cpu_support_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != sha256_file(resolve(AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("V9 CPU implementation authorization was not atomically consumed")
    return authorization


def compile_config(source: dict, authorization: dict, design_contract: dict, sample: dict) -> dict:
    metric_fields = [row.get("manifestField") for row in design_contract.get("diagnosticManifestFields", [])]
    if metric_fields != list(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS):
        raise ValueError("V9 design diagnostic Manifest field mapping changed")
    config = deepcopy(source)
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-cpu"
    config["denoiserArchitecture"] = "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"
    config["status"] = "v9_stage4_object_semantic_decoder_alignment_cpu_supported_inactive"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training.pop("stage4DecodedDomainAlignment", None)
    training.pop("v8Stage4SingleSampleSmokeContract", None)
    training["trainingAuthorizationStatus"] = trainer.V9_STAGE4_CPU_INACTIVE_STATUS
    training["authorizedInitialization"] = "project_random_v9_denoiser"
    training["seed"] = 20263722
    training["denoiserEpochs"] = 30
    training["denoiserLossVersion"] = "velocity_decoded_rgb_independent_object_semantic_topology_alignment_v9_stage4"
    training["bestCheckpointMetric"] = "fixed_grid_plus_independent_object_semantic_topology_rollout_score_v9_stage4"
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedOverfitConditionLabel"] = sample["conditionLabel"]
    training["fixedEpochPreviewPolicy"] = {
        **deepcopy(training.get("fixedEpochPreviewPolicy", {})),
        "smoke": [1, 5, 10, 20, 30],
    }
    training["authorizedBoundaryTopology"] = {
        **deepcopy(training.get("authorizedBoundaryTopology", {})),
        "enabled": True,
        "requiredBoundarySides": ["west"],
    }
    training["v9Stage4SingleSampleSmokeContract"] = {
        "status": "compiled_inactive_not_authorized",
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "conditionLabel": sample["conditionLabel"],
        "imagePath": sample["imagePath"],
        "imageSha256": sample["imageSha256"],
        "conditionPackPath": sample["conditionPackPath"],
        "conditionPackSha256": sha256_file(resolve(Path(sample["conditionPackPath"]))),
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "evaluationInterval": 5,
        "previewEpochs": [1, 5, 10, 20, 30],
        "datasetSelectionContract": "registered_v7_capacity_contribution_v1",
        "requiredSplitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "stage0Initialization": "project_random_v9_denoiser",
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "v9_diagnostic_manifest_registry_supported_inactive",
        "objectSemanticDiagnostics": {
            "channels": deepcopy(OBJECT_CHANNELS),
            "measurements": ["independent_loss", "gradient_contribution", "decoded_response"],
            "gradientTarget": "matching_v9_object_projection_features_up1_and_up0",
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
    authorization_binding = {
        "path": project_path(AUTHORIZATION_PATH),
        "sha256": sha256_file(resolve(AUTHORIZATION_PATH)),
    }
    consumption_binding = {
        "path": project_path(CONSUMPTION_PATH),
        "sha256": sha256_file(resolve(CONSUMPTION_PATH)),
    }
    training["stage4ObjectSemanticDecoderAlignment"] = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": "stage4_object_semantic_decoder_alignment_v9_v1",
        "architectureId": config["denoiserArchitecture"],
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "legacyStage3Stage4AndV8ModesPreserved": True,
        "v7OrV8DenoiserCheckpointCompatible": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
        "trainingLossImplementationStatus": "implemented_cpu_verified_not_active",
        "typedConditionDecoderAdapters": {
            "scales": ["up1", "up0"],
            "source": "original_compiled_23_channel_condition_pack",
            "channelOrder": deepcopy(config["conditionChannelOrder"]),
            "resizeContract": config["conditionResizeContract"],
        },
        "independentObjectSemanticProjections": {
            "objectChannels": deepcopy(OBJECT_CHANNELS),
            "scales": ["up1", "up0"],
            "projectionCount": 8,
            "independentPerObject": True,
            "independentReadoutPerObject": True,
            "source": "matching_original_object_semantic_condition_channel_only",
            "changesLatentOutputShape": False,
        },
        "preservedRouteTopologyReadout": {
            "channels": ["terrain_path_ground", "route_required_boundary"],
            "requiredBoundarySides": ["west"],
            "worldFactAuthority": "approved_world_facts_and_project_route_geometry",
            "conditionMaskRole": "consistency_projection_only_not_world_fact_authority",
        },
        "frozenAutoencoderDecodedConsistencyPath": {
            "status": "cpu_support_only_not_active",
            "autoencoderParametersFrozen": True,
            "gradientMayFlowToDenoiserPrediction": True,
            "autoencoderCheckpointReadRequiresSeparateAuthorization": True,
        },
        "objectSemanticTrainingSupervision": {
            "loss": "independent_two_scale_balanced_binary_cross_entropy_plus_existing_masked_decoded_rgb_alignment_v1",
            "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "targetChannels": deepcopy(OBJECT_CHANNELS),
            "allowedSources": deepcopy(ALLOWED_SOURCES),
            "failedPreviewPixelsUsedAsTrainingTargets": False,
            "machineReviewThresholdsUsedAsTrainingTargets": False,
            "machineReviewLabelsUsedAsTrainingTargets": False,
            "newFreeHyperparameterSelected": False,
        },
        "diagnosticManifestRegistry": {
            "contractId": "stage4_diagnostic_manifest_registration_contract_v1",
            "recordLocation": "manifest.metrics[*]",
            "fixedEpochs": [1, 5, 10, 20, 30],
            "exactFieldCount": 17,
            "exactFields": metric_fields,
            "fieldDefinitions": deepcopy(design_contract["diagnosticManifestFields"]),
            "rejectUnknownDiagnosticFields": True,
            "finiteNonnegativeNumbersRequired": True,
            "visualReviewIndependent": True,
        },
        "hyperparameterSelections": [],
        "evidenceBindings": {
            "v9DesignTerminal": deepcopy(authorization["bindings"]["v9DesignTerminal"]),
            "v9DesignReport": deepcopy(authorization["bindings"]["v9DesignReport"]),
            "v9InactiveDesignContract": deepcopy(authorization["bindings"]["v9InactiveDesignContract"]),
        },
        "ownerImplementationAuthorization": {
            "authorizationPath": authorization_binding["path"],
            "authorizationSha256": authorization_binding["sha256"],
            "implementationConsumptionPath": consumption_binding["path"],
            "implementationConsumptionSha256": consumption_binding["sha256"],
            "commandRef": authorization["requestId"],
            "scope": authorization["ownerDecision"]["scope"],
        },
        "activationGate": {
            "configurationActiveNow": False,
            "checkpointReadNow": False,
            "optimizerCreationNow": False,
            "backwardExecutionNow": False,
            "modelParameterUpdateNow": False,
            "gpuUseNow": False,
            "trainingNow": False,
            "validationNow": False,
            "checkpointWriteNow": False,
            "stage4FullTrainingNow": False,
            "stage1OrStage2Now": False,
            "strictRevalidationNow": False,
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
        "singleSampleGpuOverfitSmokeAuthorized": False,
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

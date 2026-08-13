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
SEMANTIC_RENDERER_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-condition-preserving-semantic-renderer-cpu-support-20260811-195316458.json"
)
SEMANTIC_RENDERER_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-condition-preserving-semantic-renderer-cpu-support-20260811-195316458-consumption.json"
)
SEMANTIC_RENDERER_REPAIR_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-semantic-renderer-diagnostic-contract-repair-20260811-202829255.json"
)
SEMANTIC_RENDERER_REPAIR_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-semantic-renderer-diagnostic-contract-repair-20260811-202829255-consumption.json"
)
SEMANTIC_RENDERER_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/"
    "20260810-215503422/inactive-config.json"
)
SEMANTIC_RENDERER_OUTPUT_PATH = Path(
    ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-cpu-support/"
    "20260811-202829255/inactive-config.json"
)
SEMANTIC_MIXTURE_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363/"
    "authorization.json"
)
SEMANTIC_MIXTURE_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363/"
    "consumption.json"
)
SEMANTIC_MIXTURE_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-condition-preserving-semantic-renderer-cpu-support/"
    "20260811-210635203/inactive-config.json"
)
SEMANTIC_MIXTURE_OUTPUT_PATH = Path(
    ".runtime/ai-painter/stage4-semantic-mixture-exact-27-field-registry-implementations/"
    "20260812-111838457/inactive-config.json"
)
SEMANTIC_MIXTURE_HISTORICAL_OUTPUT_NAMESPACE = Path(
    ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-decoder-cpu-support/"
    "20260812-003946363"
)
FINAL_VISIBLE_RGB_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-per-class-final-visible-rgb-obligation-cpu-20260812-190738093/"
    "implementation-authorization.json"
)
FINAL_VISIBLE_RGB_CONSUMPTION_PATH = FINAL_VISIBLE_RGB_AUTHORIZATION_PATH.parent / "implementation-consumption.json"
FINAL_VISIBLE_RGB_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-semantic-mixture-exact-27-field-registry-implementations/"
    "20260812-111838457/inactive-config.json"
)
VEGETATION_REPAIR_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-vegetation-final-visible-semantic-repair-20260813-025311970/"
    "implementation-authorization.json"
)
VEGETATION_REPAIR_CONSUMPTION_PATH = (
    VEGETATION_REPAIR_AUTHORIZATION_PATH.parent / "implementation-consumption-corrected.json"
)
VEGETATION_REPAIR_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/"
    "20260812-190738093/inactive-config.json"
)
VEGETATION_LUMINANCE_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-20260813-034000000/"
    "implementation-authorization.json"
)
VEGETATION_LUMINANCE_CONSUMPTION_PATH = (
    VEGETATION_LUMINANCE_AUTHORIZATION_PATH.parent / "implementation-consumption.json"
)
VEGETATION_LUMINANCE_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-vegetation-final-visible-semantic-repairs/"
    "20260813-025311970/inactive-config.json"
)
DISTRIBUTION_AWARE_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/stage4-vegetation-luminance-spatial-structure-supervision/"
    "20260813-034000000/inactive-config.json"
)
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
    parser.add_argument("--condition-preserving-semantic-renderer", action="store_true")
    parser.add_argument("--fact-conditioned-semantic-mixture", action="store_true")
    parser.add_argument("--per-class-final-visible-rgb-obligation", action="store_true")
    parser.add_argument("--vegetation-final-visible-semantic-repair", action="store_true")
    parser.add_argument("--vegetation-luminance-spatial-structure-supervision", action="store_true")
    parser.add_argument("--distribution-aware-visible-spatial-semantic-obligation", action="store_true")
    args = parser.parse_args()
    if args.distribution_aware_visible_spatial_semantic_obligation:
        return compile_distribution_aware_visible_spatial_semantic_obligation(args.output)
    if args.vegetation_luminance_spatial_structure_supervision:
        return compile_vegetation_luminance_spatial_structure_supervision(args.output)
    if args.vegetation_final_visible_semantic_repair:
        return compile_vegetation_final_visible_semantic_repair(args.output)
    if args.per_class_final_visible_rgb_obligation:
        return compile_per_class_final_visible_rgb_obligation(args.output)
    if args.fact_conditioned_semantic_mixture:
        return compile_fact_conditioned_semantic_mixture(args.output)
    if args.condition_preserving_semantic_renderer:
        return compile_condition_preserving_semantic_renderer(args.output)
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


def compile_per_class_final_visible_rgb_obligation(output: Path) -> int:
    authorization = validate_final_visible_rgb_authorization()
    expected_output = Path(authorization["outputNamespace"]) / "inactive-config.json"
    if project_path(output) != project_path(expected_output):
        raise ValueError("final visible RGB inactive config output is not the authorized target")
    source = read_json(resolve(FINAL_VISIBLE_RGB_SOURCE_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    config = deepcopy(source)
    config["architectureVersion"] = "fact-conditioned-semantic-mixture-decoder-v1-final-visible-rgb-obligation-cpu"
    training = config["training"]
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_fact_conditioned_semantic_mixture_per_class_final_visible_rgb_v1"
    )
    derived = trainer.derive_stage4_per_class_final_visible_rgb_weights(config)
    training["stage4PerClassFinalVisibleRgbObligation"] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_OBLIGATION_ID,
        "terms": list(trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS),
        "derivedWeights": derived["weights"],
        "weightDerivation": {
            **derived["sources"],
            "sourceValues": derived["sourceValues"],
            "freeValueSelectionAllowed": False,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
            "lossFunction": "masked_condition_rgb_loss",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "checkpointQualification": {
            "explicitTerms": [
                term["metric"] for term in trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS
            ],
            "usesSameDerivedWeightsAsTraining": True,
            "aggregateObjectSemanticRgbCannotReplaceExplicitTerms": True,
        },
        "compatibility": {
            "oldV7V8V9AndHistoricalStage4BehaviorPreserved": True,
            "oldDenoiserCheckpointCompatible": False,
            "newModelArchitectureCreated": False,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_EVIDENCE_BINDINGS
        ),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {key: False for key in (
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
            "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
            "worldEntryNow",
        )},
    }
    trainer.validate_stage4_per_class_final_visible_rgb_obligation(config)
    trainer.validate_training_inputs(config, package)
    write_json_exclusive(output, config)
    print(json.dumps({
        "status": "stage4_per_class_final_visible_rgb_obligation_inactive_config_compiled",
        "configPath": project_path(output),
        "configSha256": sha256_file(resolve(output)),
        "derivedWeights": derived["weights"],
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def compile_distribution_aware_visible_spatial_semantic_obligation(output: Path) -> int:
    authorization_path = Path(
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-distribution-aware-visible-spatial-semantic-obligation-"
        "20260813-062820868/implementation-authorization.json"
    )
    consumption_path = authorization_path.parent / "implementation-consumption.json"
    authorization = read_json(resolve(authorization_path))
    consumption = read_json(resolve(consumption_path))
    if (
        authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("scope")
        != "implement_stage4_distribution_aware_visible_spatial_semantic_obligation_v1_cpu_inactive_support_and_qualification"
        or consumption.get("status")
        != "stage4_distribution_aware_visible_spatial_semantic_obligation_cpu_implementation_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != sha256_file(resolve(authorization_path))
    ):
        raise ValueError("distribution-aware implementation authorization lineage invalid")
    expected_output = Path(authorization["outputNamespace"]) / "inactive-config.json"
    if project_path(output) != project_path(expected_output):
        raise ValueError("distribution-aware inactive config output is not authorized")
    config = deepcopy(read_json(resolve(DISTRIBUTION_AWARE_SOURCE_CONFIG_PATH)))
    training = config["training"]
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_fact_conditioned_semantic_mixture_"
        "per_class_final_visible_rgb_distribution_aware_v1"
    )
    training["stage4DistributionAwareVisibleSpatialSemanticObligation"] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_OBLIGATION_ID,
        "requiredIdentities": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES),
        "sourceChannels": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
        "aggregation": {
            "perSamplePerClass": True,
            "classReduction": "maximum_of_existing_derived_weighted_class_obligations",
            "batchReduction": "maximum_of_per_sample_worst_class_obligations",
            "freeNumericWeightSelected": False,
        },
        "trajectoryBinding": {
            "source": "existing_short_trajectory_current_training_predictions",
            "stepReduction": "maximum_across_existing_fixed_trajectory_steps",
            "newTrajectoryStepCountSelected": False,
        },
        "checkpointQualification": {
            "includeWorstValidationSampleClassObligation": True,
            "aggregateMeanCannotReplaceWorstSampleClass": True,
            "usesExistingDerivedClassWeights": True,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS),
            "decode": "current_training_prediction_decoded_by_frozen_project_autoencoder",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "checkpointFormatChanged": False,
            "datasetSplitChanged": False,
            "oldModesPreserved": True,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_EVIDENCE_BINDINGS
        ),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_DISTRIBUTION_AWARE_VISIBLE_SPATIAL_SEMANTIC_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {key: False for key in (
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
            "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
            "worldEntryNow",
        )},
    }
    trainer.validate_stage4_distribution_aware_visible_spatial_semantic_obligation(config)
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))
    write_json_exclusive(output, config)
    print(json.dumps({
        "status": "stage4_distribution_aware_visible_spatial_semantic_inactive_config_compiled",
        "configPath": project_path(output),
        "configSha256": sha256_file(resolve(output)),
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def compile_vegetation_final_visible_semantic_repair(output: Path) -> int:
    authorization = validate_vegetation_repair_authorization()
    expected_output = Path(authorization["outputNamespace"]) / "inactive-config.json"
    if project_path(output) != project_path(expected_output):
        raise ValueError("vegetation semantic repair output is not the authorized target")
    config = deepcopy(read_json(resolve(VEGETATION_REPAIR_SOURCE_CONFIG_PATH)))
    config["architectureVersion"] = "fact-conditioned-semantic-mixture-vegetation-final-visible-repair-cpu"
    training = config["training"]
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_fact_conditioned_semantic_mixture_"
        "vegetation_final_visible_edge_v1"
    )
    derived = trainer.derive_stage4_vegetation_final_visible_semantic_repair_weight(config)
    training["stage4VegetationFinalVisibleSemanticRepair"] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_ID,
        "sourceChannel": "object_vegetation",
        "finalRgbColorTerm": "stage4SemanticMixtureVegetationFinalTypedRgbMae",
        "finalRgbEdgeStructureTerm": "stage4SemanticMixtureVegetationFinalTypedEdgeMae",
        "derivedWeight": derived["weight"],
        "weightDerivation": derived,
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannel": "object_vegetation",
            "lossFunction": "masked_condition_gradient_rgb_loss",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "existingColorObligationPreserved": True,
            "otherFourTypedObligationsPreserved": True,
            "oldV7V8V9AndHistoricalStage4BehaviorPreserved": True,
            "newModelArchitectureCreated": False,
            "failedSmokeCheckpointCompatible": False,
        },
        "sourceFailureEvidence": {
            "smokeTerminalSha256": "2550750455a2b1587ad4916a0ef27cd2e82654bf3c8468c1f96ef772bd8bc32c",
            "manifestSha256": "e9a16f8b085802dab6beb1ef2679c2c0ebd74bc906d9edace7fc54583dd64edc",
            "machineReviewSha256": "253d183f882cb33b105f3ffc7cc5bfca5d687921a8a01fd19b5e96b99ff1369f",
            "epoch30OnlyIssue": "condition_object_vegetation_reference_semantic_mismatch",
            "reviewThresholdsChanged": False,
        },
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_AUTHORIZATION
        ),
        "activationGate": {key: False for key in (
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
            "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
            "worldEntryNow",
        )},
    }
    diagnostic_fields = list(
        trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS
    )
    registry = training["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    registry["exactFields"] = diagnostic_fields
    registry["exactFieldCount"] = len(diagnostic_fields)
    trainer.validate_stage4_vegetation_final_visible_semantic_repair(config)
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))
    write_json_exclusive(output, config)
    print(json.dumps({
        "status": "stage4_vegetation_final_visible_semantic_repair_inactive_config_compiled",
        "configPath": project_path(output),
        "configSha256": sha256_file(resolve(output)),
        "derivedWeight": derived["weight"],
        "failedPreviewPixelsUsedAsTargets": False,
        "reviewThresholdsChanged": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def compile_vegetation_luminance_spatial_structure_supervision(output: Path) -> int:
    authorization = validate_vegetation_luminance_authorization()
    expected_output = Path(authorization["outputNamespace"]) / "inactive-config.json"
    if project_path(output) != project_path(expected_output):
        raise ValueError("vegetation luminance supervision output is not the authorized target")
    config = deepcopy(read_json(resolve(VEGETATION_LUMINANCE_SOURCE_CONFIG_PATH)))
    config["architectureVersion"] = (
        "fact-conditioned-semantic-mixture-vegetation-luminance-spatial-structure-cpu"
    )
    training = config["training"]
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_fact_conditioned_semantic_mixture_"
        "vegetation_final_visible_edge_and_luminance_spatial_structure_v1"
    )
    derived = trainer.derive_stage4_vegetation_final_visible_semantic_repair_weight(config)
    training["stage4VegetationLuminanceSpatialStructureSupervision"] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_SUPERVISION_ID,
        "sourceChannel": "object_vegetation",
        "luminanceCoefficients": [0.2126, 0.7152, 0.0722],
        "lossFunction": "one_minus_masked_zero_mean_normalized_luminance_correlation",
        "derivedWeight": derived["weight"],
        "weightDerivation": derived,
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannel": "object_vegetation",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "existingColorAndEdgeObligationsPreserved": True,
            "otherFourTypedObligationsPreserved": True,
            "oldV7V8V9AndHistoricalStage4BehaviorPreserved": True,
            "newModelArchitectureCreated": False,
            "failedSmokeCheckpointCompatible": False,
        },
        "sourceFailureEvidence": {
            "smokeTerminalSha256": "4da637c83543e7b0c43a033231b22c854f74bc7f0583e0321263e42b31f0ab97",
            "manifestSha256": "b5460272d2864cec3bba6f7d7bbdcb3f43d075d27ee00930b5c6e1065cdf99b6",
            "machineReviewSha256": "72aac2ba1a1ce23d90e0d46c091ba1ba775666b174cb2526bb0cbe186b00a40b",
            "epoch30OnlyIssue": "condition_object_vegetation_reference_semantic_mismatch",
            "reviewThresholdsChanged": False,
            "reviewThresholdUsedAsTrainingTarget": False,
        },
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_AUTHORIZATION
        ),
        "activationGate": {key: False for key in (
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
            "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
            "worldEntryNow",
        )},
    }
    registry = training["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    fields = list(trainer.STAGE4_VEGETATION_LUMINANCE_SPATIAL_STRUCTURE_DIAGNOSTIC_FIELDS)
    registry["exactFields"] = fields
    registry["exactFieldCount"] = len(fields)
    trainer.validate_stage4_vegetation_luminance_spatial_structure_supervision(config)
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))
    write_json_exclusive(output, config)
    print(json.dumps({
        "status": "stage4_vegetation_luminance_spatial_structure_supervision_inactive_config_compiled",
        "configPath": project_path(output),
        "configSha256": sha256_file(resolve(output)),
        "derivedWeight": derived["weight"],
        "diagnosticManifestFieldCount": len(fields),
        "failedPreviewPixelsUsedAsTargets": False,
        "reviewThresholdUsedAsTrainingTarget": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def validate_vegetation_luminance_authorization() -> dict:
    authorization = read_json(resolve(VEGETATION_LUMINANCE_AUTHORIZATION_PATH))
    consumption = read_json(resolve(VEGETATION_LUMINANCE_CONSUMPTION_PATH))
    request_id = (
        "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-"
        "20260813-034000000"
    )
    scope = (
        "implement_cpu_inactive_stage4_vegetation_luminance_spatial_structure_"
        "supervision_then_readonly_gpu_qualification_then_one_new_smoke_and_if_"
        "passed_stage0_stage1_stage2"
    )
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("status") != "owner_authorized_unconsumed"
        or consumption.get("status") != "implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256")
        != sha256_file(resolve(VEGETATION_LUMINANCE_AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("vegetation luminance implementation authorization identity is invalid")
    for binding in authorization.get("sourceEvidence", {}).values():
        if sha256_file(resolve(Path(binding["path"]))) != binding["sha256"]:
            raise ValueError("vegetation luminance source evidence changed")
    return authorization


def validate_vegetation_repair_authorization() -> dict:
    authorization = read_json(resolve(VEGETATION_REPAIR_AUTHORIZATION_PATH))
    consumption = read_json(resolve(VEGETATION_REPAIR_CONSUMPTION_PATH))
    request_id = "owner-authorized-stage4-vegetation-final-visible-semantic-repair-20260813-025311970"
    scope = "diagnose_and_implement_bounded_vegetation_final_visible_rgb_edge_structure_obligation_then_cpu_and_readonly_gpu_qualification"
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or consumption.get("status")
        != "implementation_authorization_atomically_consumed_corrected_record"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != sha256_file(resolve(VEGETATION_REPAIR_AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
        or consumption.get("supersedesUnparseableConsumptionSha256")
        != "c1255c7cc1e9263915bfd3170e1caaddbe75d0526c58026b3fe0dde471654a43"
    ):
        raise ValueError("vegetation repair implementation authorization identity is invalid")
    for binding in authorization.get("sourceEvidence", {}).values():
        if sha256_file(resolve(Path(binding["path"]))) != binding["sha256"]:
            raise ValueError("vegetation repair source evidence changed")
    return authorization


def validate_final_visible_rgb_authorization() -> dict:
    authorization = read_json(resolve(FINAL_VISIBLE_RGB_AUTHORIZATION_PATH))
    consumption = read_json(resolve(FINAL_VISIBLE_RGB_CONSUMPTION_PATH))
    expected_request = "owner-authorized-stage4-per-class-final-visible-rgb-obligation-cpu-20260812-190738093"
    expected_scope = "implement_stage4_per_class_final_visible_rgb_obligation_v1_cpu_inactive_support_only"
    if (
        authorization.get("requestId") != expected_request
        or authorization.get("commandRef") != expected_request
        or authorization.get("scope") != expected_scope
        or authorization.get("status") != "owner_authorized_unconsumed"
        or consumption.get("status")
        != "stage4_per_class_final_visible_rgb_obligation_cpu_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != expected_request
        or consumption.get("commandRef") != expected_request
        or consumption.get("scope") != expected_scope
        or consumption.get("authorizationSha256")
        != sha256_file(resolve(FINAL_VISIBLE_RGB_AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
        or consumption.get("gpuAuthorized") is not False
        or consumption.get("trainingAuthorized") is not False
    ):
        raise ValueError("final visible RGB implementation authorization identity is invalid")
    for key, binding in authorization.get("bindings", {}).items():
        if key.endswith("Before"):
            continue
        if sha256_file(resolve(Path(binding.get("path", "missing")))) != binding.get("sha256"):
            raise ValueError(f"final visible RGB immutable binding changed: {key}")
    allowed = set(authorization.get("allowedActions", ()))
    required = {
        "modify_existing_trainer_objective_contract",
        "modify_existing_inactive_config_compiler",
        "modify_existing_cpu_checker",
        "execute_cpu_positive_negative_regression_with_torch_autograd_grad",
        "execute_complete_inactive_configuration_audit",
        "write_inactive_config",
    }
    denied = set(authorization.get("deniedActions", ()))
    required_denied = {
        "read_or_load_checkpoint", "create_optimizer", "execute_backward",
        "modify_model_weights", "start_gpu", "start_smoke", "start_stage4_full_training",
    }
    if not required.issubset(allowed) or not required_denied.issubset(denied):
        raise ValueError("final visible RGB implementation action boundary is incomplete")
    return authorization


def compile_condition_preserving_semantic_renderer(output: Path) -> int:
    validate_semantic_renderer_repair_authorization()
    authorization = validate_semantic_renderer_authorization()
    if project_path(output) != project_path(SEMANTIC_RENDERER_OUTPUT_PATH):
        raise ValueError("semantic renderer inactive config output is not the fixed target")
    source = read_json(resolve(SEMANTIC_RENDERER_SOURCE_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == SAMPLE_ID
        and row.get("v7CapacityContributionRegistered") is True
    ]
    if len(rows) != 1 or rows[0].get("split") != "validation":
        raise ValueError("semantic renderer sample 194 is not unique validation")
    config = compile_semantic_renderer_config(source, authorization, rows[0])
    trainer.validate_training_inputs(config, package)
    write_json_exclusive(output, config)
    print(json.dumps({
        "status": "stage4_condition_preserving_semantic_renderer_inactive_config_compiled_cpu_validated",
        "configPath": project_path(output),
        "configSha256": sha256_file(resolve(output)),
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "requiredBoundarySides": ["west"],
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def compile_fact_conditioned_semantic_mixture(output: Path) -> int:
    authorization = validate_semantic_mixture_authorization()
    if project_path(output) != project_path(SEMANTIC_MIXTURE_OUTPUT_PATH):
        raise ValueError("semantic mixture inactive config is not the immutable output target")
    source = read_json(resolve(SEMANTIC_MIXTURE_SOURCE_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == SAMPLE_ID
        and row.get("v7CapacityContributionRegistered") is True
    ]
    if len(rows) != 1 or rows[0].get("split") != "validation":
        raise ValueError("semantic mixture sample 194 is not unique validation")
    config = compile_semantic_mixture_config(source, authorization, rows[0])
    trainer.validate_training_inputs(config, package)
    write_json_exclusive(output, config)
    print(json.dumps({
        "status": "stage4_fact_conditioned_semantic_mixture_inactive_config_compiled_cpu_validated",
        "configPath": project_path(output),
        "configSha256": sha256_file(resolve(output)),
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "requiredBoundarySides": ["west"],
        "diagnosticManifestMetricCount": len(
            trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS
        ),
        "checkpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def validate_semantic_mixture_authorization() -> dict:
    authorization = read_json(resolve(SEMANTIC_MIXTURE_AUTHORIZATION_PATH))
    request_id = (
        "owner-authorized-stage4-fact-conditioned-semantic-mixture-decoder-"
        "cpu-support-20260812-003946363"
    )
    command_ref = "stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363"
    scope = (
        "implement_stage4_fact_conditioned_semantic_mixture_decoder_v1_cpu_support_"
        "compile_inactive_config_and_regressions_only"
    )
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != command_ref
        or authorization.get("scope") != scope
        or authorization.get("status") != "owner_authorized_unconsumed"
        or authorization.get("outputNamespace")
        != project_path(SEMANTIC_MIXTURE_HISTORICAL_OUTPUT_NAMESPACE)
    ):
        raise ValueError("semantic mixture implementation authorization identity is invalid")
    expected_bindings = {
        "designTerminal": "18d8791ab39998e023bbfdb87359225441a0b83bef2a0299157ad148d998ada3",
        "designReport": "e8be3bf92e094d5552f5d699be6b4664fa99b945e1df73db27059aba56aa08aa",
        "inactiveDesignContract": "93b34d56f2ed90922e2600d42923bdc28978bc0c29880456172af7d32f46da32",
        "designCpuRegression": "84fa31bb5d7f77df6e51a20f01ff75207e4af995486d7675bc1f28cf3bc42af2",
    }
    for key, expected_sha in expected_bindings.items():
        binding = authorization.get("bindings", {}).get(key, {})
        if (
            binding.get("sha256") != expected_sha
            or sha256_file(resolve(Path(binding.get("path", "missing")))) != expected_sha
        ):
            raise ValueError(f"semantic mixture immutable binding changed: {key}")
    actions = authorization.get("authorizedActions", {})
    required = (
        "modelArchitectureBranchCpuImplementation",
        "trainerLegalSupervisionAndInactiveAuthorizationImplementation",
        "modeRegistryInactiveModeImplementation", "inactiveConfigCompilerImplementation",
        "cpuCheckerImplementation", "syntheticCpuForward", "torchAutogradGradInspection",
        "cpuPositiveNegativeRegression", "inactiveConfigWrite", "supportContractWrite",
        "cpuReportWrite", "ownerActionRequestWrite", "terminalEvidenceWrite",
        "uniquePlanAndTaskCapsuleSync",
    )
    forbidden = (
        "freeHyperparameterSelection", "checkpointReadOrLoad", "optimizerCreation",
        "backwardExecution", "modelWeightModification", "gpuUse", "smoke",
        "fullTraining", "stage5StrictRevalidation", "formalInference",
        "checkpointPromotion", "runtimeFrame", "worldEntry",
    )
    if any(actions.get(key) is not True for key in required):
        raise ValueError("semantic mixture authorized implementation actions are incomplete")
    if any(actions.get(key) is not False for key in forbidden):
        raise ValueError("semantic mixture authorization opens a forbidden action")
    consumption = read_json(resolve(SEMANTIC_MIXTURE_CONSUMPTION_PATH))
    if (
        consumption.get("status")
        != "stage4_fact_conditioned_semantic_mixture_decoder_cpu_support_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != command_ref
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256")
        != sha256_file(resolve(SEMANTIC_MIXTURE_AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("semantic mixture implementation authorization was not atomically consumed")
    return authorization


def compile_semantic_mixture_config(source: dict, authorization: dict, sample: dict) -> dict:
    config = deepcopy(source)
    architecture = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
    config["architectureVersion"] = "fact-conditioned-semantic-mixture-decoder-v1-cpu"
    config["denoiserArchitecture"] = architecture
    config["status"] = trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_CPU_INACTIVE_STATUS
    config["formalInferenceEligible"] = False
    training = config["training"]
    for key in (
        "stage4ConditionPreservingSemanticRenderer",
        "conditionPreservingSemanticRendererSampleBinding",
        "conditionPreservingSemanticRendererStage4SingleSampleSmokeContract",
    ):
        training.pop(key, None)
    training["trainingAuthorizationStatus"] = (
        trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_CPU_INACTIVE_STATUS
    )
    training["authorizedInitialization"] = "project_random_fact_conditioned_semantic_mixture"
    training["seed"] = 20263722
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_fact_conditioned_semantic_mixture_v1"
    )
    training["bestCheckpointMetric"] = (
        "fixed_grid_plus_fact_conditioned_semantic_mixture_score_stage4"
    )
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedBoundaryTopology"] = {
        **deepcopy(training.get("authorizedBoundaryTopology", {})),
        "enabled": True,
        "requiredBoundarySides": ["west"],
    }
    training["factConditionedSemanticMixtureSampleBinding"] = {
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
        "requiredSplitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
    }
    identities = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES)
    sources = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_SOURCE_CHANNELS)
    auth_binding = {
        "path": project_path(SEMANTIC_MIXTURE_AUTHORIZATION_PATH),
        "sha256": sha256_file(resolve(SEMANTIC_MIXTURE_AUTHORIZATION_PATH)),
    }
    consumption_binding = {
        "path": project_path(SEMANTIC_MIXTURE_CONSUMPTION_PATH),
        "sha256": sha256_file(resolve(SEMANTIC_MIXTURE_CONSUMPTION_PATH)),
    }
    training["stage4FactConditionedSemanticMixture"] = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": architecture,
        "architectureId": architecture,
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "autoencoderFrozen": True,
        "newCheckpointIdentityRequired": True,
        "oldDenoiserCheckpointCompatible": False,
        "newRandomInitializationRequired": True,
        "singleFormalMainline": True,
        "parallelBackendCreated": False,
        "programmaticPixelRenderingAllowed": False,
        "freeHyperparametersSelected": False,
        "typedExperts": {
            "identities": identities,
            "sourceConditionChannels": sources,
            "count": len(identities),
            "privateContributionBranches": True,
            "velocityChannelsDerivedFromExistingOutput": True,
            "typedIdentityCollapsedBeforeOutput": False,
            "otherExpertPrivateGradientAllowed": False,
        },
        "learnedCompositor": {
            "kind": "typed_fact_conditioned_gated_additive_mixture_v1",
            "baseContributionPreserved": True,
            "typedContributionsIndividuallyObservable": True,
            "meanCollapseBeforeOutputAllowed": False,
            "ruleDrawnPixelsAllowed": False,
        },
        "legalSupervision": {
            "allowedSources": [
                "original_owner_approved_reference_rgb",
                "original_compiled_23_channel_condition_pack",
                "approved_world_facts", "visual_fact_manifest", "project_route_geometry",
                "original_object_semantic_masks", "frozen_project_autoencoder_features",
            ],
            "participationTargetChannels": sources,
            "typedDecodedCounterfactualRequired": True,
            "finalTypedRegionMetricsSeparate": True,
            "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "reviewResultsUsedAsTargets": False,
            "failedSmokeCheckpointUsedAsTargetOrInitialization": False,
        },
        "diagnosticManifestRegistry": {
            "exactFieldCount": len(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS),
            "exactFields": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS),
            "rejectUnknownFields": True,
            "configurationProvenance": {
                "reusedDiscreteConditionWeight": {
                    "source": "training.denoiserLossWeights.discreteConditionOutputBinding",
                    "value": float(training["denoiserLossWeights"]["discreteConditionOutputBinding"]),
                    "epochDiagnosticField": False,
                },
            },
            "registrationDecisionBindings": deepcopy(
                trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_REGISTRATION_DECISION_BINDINGS
            ),
        },
        "evidenceBindings": deepcopy(authorization["bindings"]),
        "ownerImplementationAuthorization": {
            "authorizationPath": auth_binding["path"],
            "authorizationSha256": auth_binding["sha256"],
            "implementationConsumptionPath": consumption_binding["path"],
            "implementationConsumptionSha256": consumption_binding["sha256"],
        },
        "activationGate": {key: False for key in (
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "smoke30EpochNow", "stage4FullTrainingNow",
            "strictRevalidationNow", "formalInferenceNow", "checkpointPromotionNow",
            "runtimeFrameNow", "worldEntryNow",
        )},
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive",
        "semanticMixtureDiagnostics": {
            "identities": identities,
            "sourceConditionChannels": sources,
            "measurements": [
                "participation_bce", "contribution_abs_mean",
                "gated_contribution_abs_mean", "counterfactual_rgb_mae",
                "final_typed_rgb_mae", "final_response",
            ],
            "gradientTarget": "matching_fact_conditioned_semantic_mixture_private_expert_contributions",
            "manifestFields": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS),
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "measurements": list(trainer.V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS),
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
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "authorizationPath": auth_binding["path"],
        "authorizationSha256": auth_binding["sha256"],
        "implementationConsumptionPath": consumption_binding["path"],
        "implementationConsumptionSha256": consumption_binding["sha256"],
        "status": "not_authorized_cpu_support_only",
        **{key: False for key in (
            "checkpointLoadingAuthorized", "optimizerCreationAuthorized",
            "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
            "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
            "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized",
            "strictRevalidationAuthorized", "validationAuthorized",
            "formalInferenceAuthorized", "checkpointPromotionAuthorized",
            "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized",
        )},
    }
    return config


def validate_semantic_renderer_authorization() -> dict:
    authorization = read_json(resolve(SEMANTIC_RENDERER_AUTHORIZATION_PATH))
    request_id = "owner-authorized-stage4-condition-preserving-semantic-renderer-cpu-support-20260811-195316458"
    scope = "implement_stage4_condition_preserving_semantic_renderer_v1_cpu_support_inactive_only"
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
    ):
        raise ValueError("semantic renderer implementation authorization identity is invalid")
    for key, binding in authorization.get("bindings", {}).items():
        if binding.get("sha256") != sha256_file(resolve(Path(binding.get("path", "missing")))):
            raise ValueError(f"semantic renderer immutable binding changed: {key}")
    consumption = read_json(resolve(SEMANTIC_RENDERER_CONSUMPTION_PATH))
    if (
        consumption.get("status")
        != "stage4_condition_preserving_semantic_renderer_cpu_support_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256")
        != sha256_file(resolve(SEMANTIC_RENDERER_AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("semantic renderer implementation authorization was not atomically consumed")
    return authorization


def validate_semantic_renderer_repair_authorization() -> dict:
    authorization = read_json(resolve(SEMANTIC_RENDERER_REPAIR_AUTHORIZATION_PATH))
    request_id = "owner-authorized-stage4-semantic-renderer-diagnostic-contract-repair-20260811-202829255"
    scope = (
        "implement_stage4_condition_preserving_semantic_renderer_diagnostic_contract_"
        "and_autograd_assertion_repair_once"
    )
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
    ):
        raise ValueError("semantic renderer repair authorization identity is invalid")
    expected_bindings = {
        "attributionTerminal": "7c9302d1933eb6a51e33caa783be16df4d70350b71f1eabf6d62554d84520fef",
        "attributionReport": "23d9804dedf08f040d55826babc64f89efa64a56d6881891f0528f7e4e043cbc",
        "inactiveRepairContract": "68eddca82378fd8fda822fec9d85f402861b580dab151e130f8242003de97db8",
    }
    for key, expected_sha in expected_bindings.items():
        binding = authorization.get("bindings", {}).get(key, {})
        if (
            binding.get("sha256") != expected_sha
            or sha256_file(resolve(Path(binding.get("path", "missing")))) != expected_sha
        ):
            raise ValueError(f"semantic renderer repair immutable binding changed: {key}")
    frozen = authorization.get("frozenImplementation", {})
    if (
        frozen.get("modelSha256")
        != "0c4c7031fb6bcbfe76d35157efaaecac707691706ec871c59b064b679d7c16cc"
        or frozen.get("modeRegistrySha256")
        != "efa421b1670db32c98df86aa477eb150d1a5c14673ac78880b2dd07cd019633d"
        or sha256_file(resolve(Path("ml/ai-painter/src/ai_painter/complete_world/model.py")))
        != frozen.get("modelSha256")
        or sha256_file(resolve(Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")))
        != frozen.get("modeRegistrySha256")
    ):
        raise ValueError("semantic renderer repair changed a frozen implementation")
    actions = authorization.get("authorizedActions", {})
    required = (
        "trainerDiagnosticDispatchImplementation",
        "trainerDiagnosticContractValidationImplementation",
        "inactiveConfigCompilerDiagnosticContractImplementation",
        "cpuCheckerAutogradAssertionImplementation",
        "cpuCheckerLegacyDiagnosticNegativeCoverage",
        "cpuPositiveNegativeRegression",
        "completeInactiveConfigurationAudit",
        "inactiveConfigWrite",
        "architectureSupportContractWrite",
        "cpuReportWrite",
        "ownerActionRequestWrite",
        "terminalEvidenceWrite",
        "uniquePlanUpdate",
        "localTaskCapsuleUpdate",
    )
    forbidden = (
        "modelModification", "modeRegistryModification", "lossValueOrWeightModification",
        "toleranceRelaxation", "checkpointReadOrLoad", "optimizerCreation",
        "backwardExecution", "modelWeightModification", "gpuUse", "smoke", "training",
        "stage4FullTraining", "stage5StrictRevalidation", "formalInference",
        "checkpointPromotion", "runtimeFrame", "worldEntry", "automaticRetry",
    )
    if any(actions.get(key) is not True for key in required):
        raise ValueError("semantic renderer repair implementation actions are incomplete")
    if any(actions.get(key) is not False for key in forbidden):
        raise ValueError("semantic renderer repair opens a forbidden action")
    consumption = read_json(resolve(SEMANTIC_RENDERER_REPAIR_CONSUMPTION_PATH))
    if (
        consumption.get("status")
        != "stage4_semantic_renderer_diagnostic_contract_repair_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256")
        != sha256_file(resolve(SEMANTIC_RENDERER_REPAIR_AUTHORIZATION_PATH))
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("semantic renderer repair authorization was not atomically consumed")
    return authorization


def compile_semantic_renderer_config(source: dict, authorization: dict, sample: dict) -> dict:
    config = deepcopy(source)
    architecture = "stage4_condition_preserving_semantic_renderer_v1"
    config["architectureVersion"] = "condition-preserving-semantic-renderer-v1-cpu"
    config["denoiserArchitecture"] = architecture
    config["status"] = "stage4_condition_preserving_semantic_renderer_cpu_supported_inactive"
    config["formalInferenceEligible"] = False
    training = config["training"]
    for key in (
        "stage4StructureFactFirstDualStage", "structureFactFirstPhase0Contract",
        "structureFactFirstStage4SingleSampleSmokeContract",
    ):
        training.pop(key, None)
    training["trainingAuthorizationStatus"] = (
        trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_STAGE4_CPU_INACTIVE_STATUS
    )
    training["authorizedInitialization"] = "project_random_condition_preserving_semantic_renderer"
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_condition_preserving_learned_semantic_renderer_stage4"
    )
    training["bestCheckpointMetric"] = (
        "fixed_grid_plus_condition_preserving_semantic_renderer_score_stage4"
    )
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedBoundaryTopology"] = {
        **deepcopy(training.get("authorizedBoundaryTopology", {})),
        "enabled": True,
        "requiredBoundarySides": ["west"],
    }
    training["conditionPreservingSemanticRendererSampleBinding"] = {
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
        "requiredSplitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
    }
    semantic_channels = list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_CHANNELS)
    source_channels = list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_SOURCE_CHANNELS)
    allowed_sources = [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts_visual_fact_manifest_region_graph_and_edge_ports",
        "project_generated_game_coordinate_route_geometry",
        "original_object_identity_and_semantic_masks",
        "frozen_project_autoencoder_encoder_and_decoder_features",
        "current_model_prediction_derived_without_failed_preview_targets",
    ]
    auth_binding = {
        "path": project_path(SEMANTIC_RENDERER_AUTHORIZATION_PATH),
        "sha256": sha256_file(resolve(SEMANTIC_RENDERER_AUTHORIZATION_PATH)),
    }
    consumption_binding = {
        "path": project_path(SEMANTIC_RENDERER_CONSUMPTION_PATH),
        "sha256": sha256_file(resolve(SEMANTIC_RENDERER_CONSUMPTION_PATH)),
    }
    activation_gate = {
        key: False for key in (
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "smoke30EpochNow", "stage4FullTrainingNow",
            "strictRevalidationNow", "formalInferenceNow", "checkpointPromotionNow",
            "runtimeFrameNow", "worldEntryNow",
        )
    }
    training["stage4ConditionPreservingSemanticRenderer"] = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": architecture,
        "architectureId": architecture,
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "autoencoderFrozen": True,
        "newCheckpointSchemaRequired": True,
        "oldDenoiserCheckpointCompatible": False,
        "newRandomInitializationRequired": True,
        "programmaticPixelDrawingAllowed": False,
        "ruleTexturePastingAllowed": False,
        "reviewThresholdDrivenRenderingAllowed": False,
        "newFreeHyperparameterSelected": False,
        "learnedSemanticRenderer": {
            "channels": semantic_channels,
            "sourceConditionChannels": source_channels,
            "fusionScales": ["up1", "up0"],
            "fusionKind": "learned_condition_preserving_residual_gate_v1",
            "independentPerSemanticType": True,
            "primaryRgbPathPreserved": True,
            "dimensionsDerivedFromExistingModelScales": True,
        },
        "legalSupervision": {
            "allowedSources": allowed_sources,
            "semanticTargetChannels": semantic_channels,
            "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "reviewPassFailUsedAsLossTarget": False,
            "failedSmokeCheckpointUsedAsTarget": False,
        },
        "diagnosticManifestRegistry": {
            "exactFieldCount": len(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
            "exactFields": list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
            "rejectUnknownFields": True,
        },
        "evidenceBindings": deepcopy(authorization["bindings"]),
        "ownerImplementationAuthorization": {
            "authorizationPath": auth_binding["path"],
            "authorizationSha256": auth_binding["sha256"],
            "implementationConsumptionPath": consumption_binding["path"],
            "implementationConsumptionSha256": consumption_binding["sha256"],
        },
        "activationGate": activation_gate,
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_STATUS,
        "semanticRendererDiagnostics": {
            "channels": semantic_channels,
            "measurements": [
                "independent_loss",
                "fusion_response",
                "primary_path_availability",
            ],
            "gradientTarget": trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_GRADIENT_TARGET,
            "manifestFields": list(trainer.CONDITION_PRESERVING_SEMANTIC_RENDERER_DIAGNOSTIC_FIELDS),
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "measurements": list(trainer.V7_R5_STAGE4_ROUTE_DIAGNOSTIC_MEASUREMENTS),
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
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "authorizationPath": auth_binding["path"],
        "authorizationSha256": auth_binding["sha256"],
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

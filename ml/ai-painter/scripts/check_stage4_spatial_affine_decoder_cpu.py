from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Mapping
from uuid import uuid4

from ai_painter_spatial_affine_decoder_contract import (
    ACTIVATION_GATE_KEYS,
    ARCHITECTURE_ID,
    FORMAL_LOSS_SOURCE_EVIDENCE,
    FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS,
    FROZEN_DENOISER_LOSS_WEIGHTS,
    FROZEN_RESOLUTION_STAGES,
    FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS,
    FROZEN_SPLIT_COUNTS,
    SCREEN_REVIEW_EPOCHS,
    STAGE0_REVIEW_EPOCHS,
    compile_spatial_affine_decoder_cpu_inactive_config,
    issue_and_consume_spatial_affine_internal_ticket,
    validate_spatial_affine_decoder_config,
)
from ai_painter_authorization_policy import (
    execution_action_values_for_stage_config,
    local_ai_ticket_bound_config_sha256,
)


ROOT = Path(__file__).resolve().parents[3]


FORMAL_CONDITION_ORDER = (
    "terrain_grass",
    "terrain_water",
    "terrain_path_ground",
    "terrain_shoreline",
    "terrain_natural_boundary",
    "terrain_mud_patch",
    "terrain_tall_grass",
    "walkable",
    "collision",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
    "focal_area",
    "object_instance",
    "coordinate_x",
    "coordinate_y",
    "signed_distance_path",
    "signed_distance_water",
    "signed_distance_shoreline",
    "signed_distance_object_ground",
    "signed_distance_boundary",
    "moisture_proximity",
)
FORMAL_CONDITION_TYPES = {
    "discrete": list(FORMAL_CONDITION_ORDER[:15]),
    "continuous": list(FORMAL_CONDITION_ORDER[15:]),
}
EXPECTED_ARCHITECTURE_CONTRACT = {
    "schemaVersion": "stage4-spatial-affine-conditioning-contract-v1",
    "capabilityVersion": "stage4-multiscale-spatial-affine-conditioned-decoder-v1",
    "architectureId": ARCHITECTURE_ID,
    "conditionInputIdentity": "same_formal_typed_23_channel_conditions",
    "mergeFormula": "normalized_feature_times_one_plus_gamma_plus_beta",
    "decoderStages": [
        {
            "stage": "up1",
            "featureChannels": 128,
            "stage0SpatialWidth": 32,
            "stage0SpatialHeight": 24,
            "normalizationPoints": 2,
            "conditionProjection": "conv2d_23_to_256_kernel3_padding1_bias_true",
        },
        {
            "stage": "up0",
            "featureChannels": 64,
            "stage0SpatialWidth": 64,
            "stage0SpatialHeight": 48,
            "normalizationPoints": 2,
            "conditionProjection": "conv2d_23_to_128_kernel3_padding1_bias_true",
        },
    ],
    "parameterCount": 159744,
    "parameterTensorCount": 8,
    "existingEncoderConditionFusionPreserved": True,
    "legacyAdditiveDecoderAdaptersEnabled": False,
    "newLossTermAdded": False,
    "freeArchitectureParameterChosen": False,
    "historicalDenoiserCheckpointAllowed": False,
}
EXPECTED_CHECKPOINT_GATE = {
    "schemaVersion": "stage4-final-rgb-boundary-checkpoint-non-regression-gate-v1",
    "contractVersion": "stage4-final-rgb-boundary-checkpoint-non-regression-v1",
    "enabled": True,
    "role": "checkpoint_eligibility_gate_only",
    "reviewContractId": "condition-semantic-boundary-contact-v3",
    "source": "normalized_final_rgb_and_same_record_formal_condition_mask",
    "metricOnly": True,
    "trainingLossContribution": False,
    "bestCheckpointMetricWeight": False,
    "bestCheckpointMetricWeightAdded": False,
    "auditBandPixels": 6,
    "minimumContactFormula": "max_6_round_expected_times_0_1",
    "missingContractDisposition": "fail_closed_not_numeric_zero",
    "selectionRule": (
        "scalar_improves_and_required_contacts_non_regressing_and_"
        "no_new_missing_or_unexpected_side"
    ),
    "modelStateTiming": (
        "post_optimizer_step_same_state_for_score_rgb_preview_and_checkpoint"
    ),
    "failedPreviewPixelsUsedAsTrainingTargets": False,
    "machineReviewThresholdUsedAsTrainingTarget": False,
}
BASE_TOP_LEVEL_KEYS = {
    "schemaVersion",
    "modelId",
    "architectureVersion",
    "status",
    "ownership",
    "trainingLane",
    "trainingDataPolicyVersion",
    "initialization",
    "upstreamModelIds",
    "thirdPartyWeightsAllowed",
    "thirdPartyGeneratedTrainingOutputsAllowed",
    "thirdPartyGeneratedTrainingOutputDependencyMustBeDeclared",
    "datasetPackageModelId",
    "autoencoderSourceModelId",
    "autoencoderSourceArchitectureVersion",
    "autoencoderRequiredCheckpointProvenance",
    "conditionChannels",
    "conditionChannelOrder",
    "conditionChannelTypes",
    "conditionResizeContract",
    "imageSize",
    "autoencoderArchitecture",
    "denoiserArchitecture",
    "conditionOutputBinding",
    "predictionTarget",
    "latentNormalization",
    "latentChannels",
    "latentDownsampleFactor",
    "baseChannels",
    "denoiserBaseChannels",
    "diffusionSteps",
    "inferenceSteps",
    "formalInferenceEligible",
    "capabilityCandidateOnly",
    "ownerAuthorizationRequired",
    "ownerResponseRequired",
    "formalLossSourceEvidence",
    "stage4SpatialAffineConditioningContract",
    "training",
    "requiredCheckpointProvenance",
}
BASE_TRAINING_KEYS = {
    "trainingAuthorizationStatus",
    "dataCapacityDecision",
    "resolutionStages",
    "batchSize",
    "denoiserEpochs",
    "denoiserLearningRate",
    "denoiserLossVersion",
    "denoiserLossWeights",
    "fixedValidationTimesteps",
    "timestepSampling",
    "quietRegionQuantile",
    "quietRegionMargin",
    "textureHierarchyScales",
    "sparseRgbConditionChannels",
    "semanticRgbConditionChannels",
    "objectSemanticChannelWeights",
    "pathBoundaryBandRatio",
    "bestCheckpointMetric",
    "bestCheckpointMetricWeights",
    "rolloutCheckpointMetricWeights",
    "checkpointRolloutWeight",
    "checkpointRolloutCoverage",
    "checkpointRolloutSeedsPerSample",
    "checkpointWorstTrajectoryWeight",
    "checkpointSelectionSplit",
    "strictHeldOutInferenceSplit",
    "seed",
    "fixedEpochPreviewPolicy",
    "activationGates",
    "finalRgbBoundaryCheckpointNonRegressionGate",
}
EXPECTED_PHASES = {
    "inactive": {
        "modeId": "spatial_affine_decoder_stage4_inactive",
        "status": "cpu_supported_inactive",
        "epochs": 24,
        "activeGates": set(),
        "architectureContractStatus": "cpu_supported_inactive",
        "checkpointGateStatus": "metric_only_supported_inactive",
        "extraTrainingKey": None,
    },
    "readonly_gpu": {
        "modeId": "spatial_affine_decoder_stage4_readonly_gpu",
        "status": "readonly_gpu_qualification_active",
        "epochs": 24,
        "activeGates": {"gpuNow", "readonlyGpuQualificationNow"},
        "architectureContractStatus": "active_local_ai_internal_capability",
        "checkpointGateStatus": "active_metric_only_checkpoint_gate",
        "extraTrainingKey": None,
    },
    "full_data_screen": {
        "modeId": "spatial_affine_decoder_stage4_full_data_screen",
        "status": "full_data_screen_active",
        "epochs": 24,
        "activeGates": {
            "optimizerNow",
            "backwardNow",
            "weightModificationNow",
            "gpuNow",
            "fullDataScreenNow",
            "trainingNow",
        },
        "architectureContractStatus": "active_local_ai_internal_capability",
        "checkpointGateStatus": "active_metric_only_checkpoint_gate",
        "extraTrainingKey": "fullDataScreenContract",
    },
    "stage0": {
        "modeId": "spatial_affine_decoder_stage0_full_training",
        "status": "formal_stage0_training_active",
        "epochs": 40,
        "activeGates": {
            "optimizerNow",
            "backwardNow",
            "weightModificationNow",
            "gpuNow",
            "trainingNow",
            "stage0Now",
        },
        "architectureContractStatus": "active_local_ai_internal_capability",
        "checkpointGateStatus": "active_metric_only_checkpoint_gate",
        "extraTrainingKey": "formalStage0Contract",
    },
}


def _without_status(value: Mapping[str, Any]) -> dict[str, Any]:
    result = deepcopy(dict(value))
    result.pop("status", None)
    return result


def _assert_equal(actual: Any, expected: Any, code: str) -> None:
    if actual != expected:
        raise ValueError(code)


def _load_formal_objective_contract(
    project_root: Path = ROOT,
) -> dict[str, Any]:
    """Read the active machine contract; historical runs are never consulted."""

    contract_path = project_root / FORMAL_LOSS_SOURCE_EVIDENCE["path"]
    if not contract_path.is_file():
        raise ValueError("formal_objective_contract_missing")
    if _sha256(contract_path) != FORMAL_LOSS_SOURCE_EVIDENCE["sha256"]:
        raise ValueError("formal_objective_contract_sha256_mismatch")
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    if (
        contract.get("schemaVersion")
        != "ai-painter-stage4-formal-diffusion-objective-and-checkpoint-contract-v1"
        or contract.get("status") != "active_machine_contract"
        or contract.get("historicalRuntimeArtifactIsExecutionSource") is not False
    ):
        raise ValueError("formal_objective_contract_inactive_or_historical")
    _assert_equal(
        contract.get("denoiserLossWeights"),
        FROZEN_DENOISER_LOSS_WEIGHTS,
        "formal_contract_loss_weights_changed",
    )
    _assert_equal(
        contract.get("bestCheckpointMetricWeights"),
        FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS,
        "formal_contract_checkpoint_weights_changed",
    )
    _assert_equal(
        contract.get("rolloutCheckpointMetricWeights"),
        FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS,
        "formal_contract_rollout_weights_changed",
    )
    return contract


def _audit_internal_ticket_identity(
    config: Mapping[str, Any],
    *,
    project_root: Path,
) -> dict[str, Any]:
    identity = config.get("training", {}).get("localAiCapabilityTicket")
    if not isinstance(identity, Mapping):
        raise ValueError("internal_ticket_identity_missing")
    actions = execution_action_values_for_stage_config(config)
    formal = _load_formal_objective_contract(project_root)
    binding = {
        "boundConfigSha256": identity.get("boundConfigSha256"),
        "datasetPackageId": identity.get("datasetPackageId"),
        "runId": identity.get("runId"),
        "outputNamespace": identity.get("outputNamespace"),
    }
    _assert_equal(
        binding["boundConfigSha256"],
        local_ai_ticket_bound_config_sha256(config),
        "internal_ticket_config_digest_mismatch",
    )
    _assert_equal(
        binding["datasetPackageId"],
        formal["data"]["datasetPackageId"],
        "internal_ticket_dataset_package_mismatch",
    )
    output = Path(str(binding["outputNamespace"]))
    _assert_equal(
        output.name,
        binding["runId"],
        "internal_ticket_output_run_mismatch",
    )
    _assert_equal(
        sorted(identity.get("executionActions", [])),
        actions,
        "internal_ticket_actions_not_registry_derived",
    )
    ticket_path = project_root / str(identity.get("ticketPath", ""))
    consumption_path = project_root / str(identity.get("consumptionPath", ""))
    if not ticket_path.is_file() or not consumption_path.is_file():
        raise ValueError("internal_ticket_bound_file_missing")
    _assert_equal(
        _sha256(ticket_path),
        identity.get("ticketSha256"),
        "internal_ticket_sha256_mismatch",
    )
    _assert_equal(
        _sha256(consumption_path),
        identity.get("consumptionSha256"),
        "internal_ticket_consumption_sha256_mismatch",
    )
    ticket = json.loads(ticket_path.read_text(encoding="utf-8"))
    consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
    _assert_equal(
        ticket.get("schemaVersion"),
        "ai-painter-local-internal-capability-ticket-v2",
        "internal_ticket_schema_is_not_v2",
    )
    _assert_equal(
        consumption.get("schemaVersion"),
        "ai-painter-local-internal-capability-ticket-consumption-v2",
        "internal_ticket_consumption_schema_is_not_v2",
    )
    _assert_equal(
        sorted(ticket.get("executionActions", [])),
        actions,
        "internal_ticket_file_actions_not_registry_derived",
    )
    _assert_equal(
        ticket.get("binding"),
        binding,
        "internal_ticket_file_binding_mismatch",
    )
    _assert_equal(
        consumption.get("binding"),
        binding,
        "internal_ticket_consumption_scope_mismatch",
    )
    _assert_equal(
        consumption.get("ticketSha256"),
        identity.get("ticketSha256"),
        "internal_ticket_consumption_binding_mismatch",
    )
    _assert_equal(
        consumption.get("oneTimeConsumption"),
        True,
        "internal_ticket_not_one_time",
    )
    _assert_equal(
        consumption.get("state"),
        "consumed",
        "internal_ticket_not_consumed",
    )
    _assert_equal(
        identity.get("executionState"),
        "consumed",
        "internal_ticket_identity_not_consumed",
    )
    return {
        "ticketId": identity.get("ticketId"),
        "oneTimeConsumption": True,
        "executionActions": actions,
        "boundConfigSha256": binding["boundConfigSha256"],
        "datasetPackageId": binding["datasetPackageId"],
        "runId": binding["runId"],
        "outputNamespace": binding["outputNamespace"],
    }


def audit_spatial_affine_config(
    config: dict[str, Any],
    *,
    phase: str,
    project_root: Path = ROOT,
) -> dict[str, Any]:
    """Apply a strict, independent audit over the compiled candidate contract."""

    if phase not in EXPECTED_PHASES:
        raise ValueError("spatial_affine_phase_unknown")
    expected = EXPECTED_PHASES[phase]
    formal = _load_formal_objective_contract(project_root)
    formal_data = formal["data"]
    formal_model = formal["modelBoundary"]
    formal_training = formal["training"]
    resolved = validate_spatial_affine_decoder_config(
        config, project_root=project_root
    )
    _assert_equal(resolved["modeId"], expected["modeId"], "mode_identity_mismatch")
    _assert_equal(set(config), BASE_TOP_LEVEL_KEYS, "top_level_free_field_detected")
    _assert_equal(config.get("status"), expected["status"], "status_identity_mismatch")
    _assert_equal(config.get("conditionChannels"), 23, "condition_channel_count_changed")
    _assert_equal(
        tuple(config.get("conditionChannelOrder", ())),
        FORMAL_CONDITION_ORDER,
        "condition_channel_order_changed",
    )
    _assert_equal(
        config.get("conditionChannelTypes"),
        FORMAL_CONDITION_TYPES,
        "condition_channel_types_changed",
    )
    _assert_equal(config.get("latentChannels"), 12, "latent_channel_count_changed")
    _assert_equal(config.get("latentDownsampleFactor"), 4, "latent_scale_changed")
    _assert_equal(
        config.get("baseChannels"),
        formal_model.get("autoencoderBaseChannels"),
        "autoencoder_base_width_changed",
    )
    _assert_equal(config.get("denoiserBaseChannels"), 64, "denoiser_base_width_changed")
    _assert_equal(config.get("diffusionSteps"), 1000, "diffusion_steps_changed")
    _assert_equal(config.get("inferenceSteps"), 50, "rollout_steps_changed")
    _assert_equal(
        config.get("ownerAuthorizationRequired"),
        False,
        "owner_authorization_reintroduced",
    )
    _assert_equal(
        config.get("ownerResponseRequired"),
        False,
        "owner_response_reintroduced",
    )
    _assert_equal(
        config.get("formalLossSourceEvidence"),
        FORMAL_LOSS_SOURCE_EVIDENCE,
        "formal_loss_source_binding_changed",
    )
    if "stage4ControlledStructureArm" in config:
        raise ValueError("exited_controlled_arm_injected")
    if "stage4ResponsibilityComponentRole" in config:
        raise ValueError("exited_responsibility_component_injected")

    architecture_contract = config.get(
        "stage4SpatialAffineConditioningContract", {}
    )
    _assert_equal(
        _without_status(architecture_contract),
        EXPECTED_ARCHITECTURE_CONTRACT,
        "spatial_affine_structure_or_free_parameter_changed",
    )
    _assert_equal(
        architecture_contract.get("status"),
        expected["architectureContractStatus"],
        "spatial_affine_architecture_status_mismatch",
    )

    training = config.get("training", {})
    expected_training_keys = set(BASE_TRAINING_KEYS)
    if phase != "inactive":
        expected_training_keys.add("localAiCapabilityTicket")
    if expected["extraTrainingKey"]:
        expected_training_keys.add(expected["extraTrainingKey"])
    _assert_equal(
        set(training), expected_training_keys, "training_free_field_detected"
    )
    _assert_equal(
        training.get("dataCapacityDecision", {}).get("splitCounts"),
        FROZEN_SPLIT_COUNTS,
        "formal_data_split_changed",
    )
    _assert_equal(
        training.get("resolutionStages"),
        FROZEN_RESOLUTION_STAGES,
        "formal_resolution_stages_changed",
    )
    _assert_equal(training.get("seed"), 20263722, "formal_seed_changed")
    _assert_equal(
        training.get("fixedEpochPreviewPolicy"),
        {"smoke": SCREEN_REVIEW_EPOCHS, "formalStage": STAGE0_REVIEW_EPOCHS},
        "fixed_preview_policy_changed",
    )
    _assert_equal(
        training.get("denoiserEpochs"), expected["epochs"], "epoch_count_changed"
    )
    gates = training.get("activationGates", {})
    _assert_equal(set(gates), set(ACTIVATION_GATE_KEYS), "activation_gate_schema_changed")
    _assert_equal(
        {name for name, enabled in gates.items() if enabled},
        expected["activeGates"],
        "activation_gate_scope_changed",
    )

    checkpoint_gate = training.get(
        "finalRgbBoundaryCheckpointNonRegressionGate", {}
    )
    _assert_equal(
        _without_status(checkpoint_gate),
        EXPECTED_CHECKPOINT_GATE,
        "checkpoint_boundary_gate_semantics_changed",
    )
    _assert_equal(
        checkpoint_gate.get("status"),
        expected["checkpointGateStatus"],
        "checkpoint_boundary_gate_status_mismatch",
    )
    _assert_equal(
        training.get("denoiserLossWeights"),
        FROZEN_DENOISER_LOSS_WEIGHTS,
        "existing_loss_weights_changed",
    )
    _assert_equal(
        training.get("bestCheckpointMetricWeights"),
        FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS,
        "existing_checkpoint_weights_changed",
    )
    _assert_equal(
        training.get("rolloutCheckpointMetricWeights"),
        FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS,
        "existing_rollout_checkpoint_weights_changed",
    )
    for key in (
        "batchSize",
        "denoiserLearningRate",
        "fixedValidationTimesteps",
        "timestepSampling",
        "quietRegionQuantile",
        "quietRegionMargin",
        "textureHierarchyScales",
        "sparseRgbConditionChannels",
        "semanticRgbConditionChannels",
        "objectSemanticChannelWeights",
        "pathBoundaryBandRatio",
        "checkpointRolloutWeight",
        "checkpointRolloutSeedsPerSample",
        "checkpointWorstTrajectoryWeight",
    ):
        _assert_equal(
            training.get(key),
            formal_training.get(key),
            f"formal_training_field_changed:{key}",
        )
    forbidden_gate_keys = {
        "finalRgbBoundaryCheckpointNonRegressionGate",
        "finalRgbBoundaryNonRegression",
        "boundaryCheckpointGate",
    }
    if forbidden_gate_keys.intersection(training.get("denoiserLossWeights", {})):
        raise ValueError("checkpoint_boundary_gate_injected_into_loss")
    if forbidden_gate_keys.intersection(
        training.get("bestCheckpointMetricWeights", {})
    ):
        raise ValueError("checkpoint_boundary_gate_injected_as_metric_weight")
    formal_identity = {
        "datasetPackageModelId": formal_data["datasetPackageModelId"],
        "trainingDataPolicyVersion": formal_model["trainingDataPolicyVersion"],
        "autoencoderSourceModelId": formal_model["autoencoderSourceModelId"],
        "autoencoderSourceArchitectureVersion": formal_model[
            "autoencoderSourceArchitectureVersion"
        ],
        "autoencoderRequiredCheckpointProvenance": formal_model[
            "autoencoderRequiredCheckpointProvenance"
        ],
    }
    for key, value in formal_identity.items():
        _assert_equal(config.get(key), value, f"formal_identity_changed:{key}")

    if phase == "full_data_screen":
        _assert_equal(
            training.get("fullDataScreenContract"),
            {
                "status": "active_local_ai_internal_capability",
                "reviewEpochs": SCREEN_REVIEW_EPOCHS,
                "trainWeightUpdateCount": 48,
                "validationReadOnlyCount": 8,
                "challengeHeldOutCount": 4,
                "regressionHeldOutCount": 4,
                "heldOutAccess": "after_screen_training_natural_completion_only",
                "screenCheckpointStage0InitializationEligible": False,
                "automaticSecondCandidateAllowed": False,
                "fixedPreviewByteReproductionRequired": True,
            },
            "full_data_screen_contract_changed",
        )
    if phase == "stage0":
        _assert_equal(
            training.get("formalStage0Contract"),
            {
                "status": "active_local_ai_internal_capability",
                "resolution": {"width": 256, "height": 192},
                "epochCount": 40,
                "previewEpochs": STAGE0_REVIEW_EPOCHS,
                "initialization": "fixed_project_random_initialization_only",
                "screenCheckpointAllowed": False,
                "historicalCheckpointAllowed": False,
                "automaticRetryAllowed": False,
                "fixedPreviewByteReproductionRequired": True,
            },
            "formal_stage0_contract_changed",
        )
    ticket_audit = None
    if phase != "inactive":
        ticket_audit = _audit_internal_ticket_identity(
            config, project_root=project_root
        )
    return {
        "phase": phase,
        "modeId": resolved["modeId"],
        "epochCount": training["denoiserEpochs"],
        "activeGates": sorted(expected["activeGates"]),
        "parameterCount": architecture_contract["parameterCount"],
        "parameterTensorCount": architecture_contract["parameterTensorCount"],
        "ownerAuthorizationRequired": False,
        "checkpointBoundaryGateIsMetricOnly": True,
        "historicalRuntimeArtifactIsExecutionSource": False,
        "internalTicket": ticket_audit,
    }


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _materialize_with_real_ticket(inactive: dict, phase: str) -> dict:
    run_id = f"spatial-affine-cpu-{phase}-{uuid4().hex}"
    formal = _load_formal_objective_contract(ROOT)
    active, _ = issue_and_consume_spatial_affine_internal_ticket(
        inactive,
        phase=phase,
        dataset_package_id=formal["data"]["datasetPackageId"],
        run_id=run_id,
        output_namespace=(
            ".runtime/ai-painter/stage4-spatial-affine-cpu-contract-fixtures/"
            f"{run_id}"
        ),
        project_root=ROOT,
        ticket_namespace=".test-output/stage4-spatial-affine-capability-tickets",
    )
    return active


def build_and_audit_all_modes() -> dict[str, dict[str, Any]]:
    inactive = compile_spatial_affine_decoder_cpu_inactive_config(
        project_root=ROOT
    )
    configs = {
        "inactive": inactive,
        "readonly_gpu": _materialize_with_real_ticket(inactive, "readonly_gpu"),
        "full_data_screen": _materialize_with_real_ticket(inactive, "full_data_screen"),
        "stage0": _materialize_with_real_ticket(inactive, "stage0"),
    }
    return {
        phase: audit_spatial_affine_config(config, phase=phase, project_root=ROOT)
        for phase, config in configs.items()
    }


def run_negative_cases() -> list[dict[str, Any]]:
    inactive = compile_spatial_affine_decoder_cpu_inactive_config(
        project_root=ROOT
    )
    screen = _materialize_with_real_ticket(inactive, "full_data_screen")
    stage0 = _materialize_with_real_ticket(inactive, "stage0")
    cases: list[tuple[str, dict[str, Any], str]] = []

    def add(name: str, base: dict[str, Any], mutate: Callable[[dict[str, Any]], None], phase: str) -> None:
        value = deepcopy(base)
        mutate(value)
        cases.append((name, value, phase))

    add("owner_authorization_rejected", inactive, lambda value: value.__setitem__("ownerAuthorizationRequired", True), "inactive")
    add("old_controlled_arm_rejected", inactive, lambda value: value.__setitem__("stage4ControlledStructureArm", "capacity_only_base_width_64_to_existing_level1_128"), "inactive")
    add("old_responsibility_component_rejected", inactive, lambda value: value.__setitem__("stage4ResponsibilityComponentRole", "terrain_route_hydrology_spatial_realization"), "inactive")
    add("free_top_level_width_rejected", inactive, lambda value: value.__setitem__("freeProjectionWidth", 96), "inactive")
    add("free_structure_field_rejected", inactive, lambda value: value["stage4SpatialAffineConditioningContract"].__setitem__("extraHiddenWidth", 96), "inactive")
    add("parameter_count_change_rejected", inactive, lambda value: value["stage4SpatialAffineConditioningContract"].__setitem__("parameterCount", 159745), "inactive")
    add("decoder_stage_change_rejected", inactive, lambda value: value["stage4SpatialAffineConditioningContract"]["decoderStages"][0].__setitem__("featureChannels", 96), "inactive")
    add("condition_order_change_rejected", inactive, lambda value: value["conditionChannelOrder"].reverse(), "inactive")
    add("data_split_change_rejected", inactive, lambda value: value["training"]["dataCapacityDecision"]["splitCounts"].__setitem__("train", 47), "inactive")
    add("dataset_identity_change_rejected", inactive, lambda value: value.__setitem__("datasetPackageModelId", "foreign-dataset"), "inactive")
    add("seed_change_rejected", inactive, lambda value: value["training"].__setitem__("seed", 1), "inactive")
    add("unknown_status_rejected", inactive, lambda value: value["training"].__setitem__("trainingAuthorizationStatus", "unknown_status"), "inactive")
    add("screen_epoch_change_rejected", screen, lambda value: value["training"].__setitem__("denoiserEpochs", 25), "full_data_screen")
    add("stage0_epoch_change_rejected", stage0, lambda value: value["training"].__setitem__("denoiserEpochs", 39), "stage0")
    add("screen_gate_scope_change_rejected", screen, lambda value: value["training"]["activationGates"].__setitem__("stage0Now", True), "full_data_screen")
    add("boundary_gate_loss_injection_rejected", inactive, lambda value: value["training"]["denoiserLossWeights"].__setitem__("finalRgbBoundaryCheckpointNonRegressionGate", 1.0), "inactive")
    add("boundary_gate_metric_weight_injection_rejected", inactive, lambda value: value["training"]["bestCheckpointMetricWeights"].__setitem__("boundaryCheckpointGate", 1.0), "inactive")
    add("boundary_gate_role_change_rejected", inactive, lambda value: value["training"]["finalRgbBoundaryCheckpointNonRegressionGate"].__setitem__("trainingLossContribution", True), "inactive")
    add("ticket_action_injection_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"]["executionActions"].append("select_bound_sample"), "full_data_screen")
    add("ticket_unconsumed_identity_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"].__setitem__("executionState", "issued_not_consumed"), "full_data_screen")
    add("ticket_consumption_sha_replacement_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"].__setitem__("consumptionSha256", "0" * 64), "full_data_screen")
    add("ticket_bound_config_replacement_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"].__setitem__("boundConfigSha256", "0" * 64), "full_data_screen")
    add("ticket_dataset_package_replacement_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"].__setitem__("datasetPackageId", "foreign-package"), "full_data_screen")
    add("ticket_run_identity_replacement_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"].__setitem__("runId", "foreign-run-identity"), "full_data_screen")
    add("ticket_output_namespace_escape_rejected", screen, lambda value: value["training"]["localAiCapabilityTicket"].__setitem__("outputNamespace", "../outside"), "full_data_screen")
    add("rollout_weight_change_rejected", inactive, lambda value: value["training"]["rolloutCheckpointMetricWeights"].__setitem__("rolloutRgbMae", 0.5), "inactive")

    results = []
    for name, config, phase in cases:
        rejected = False
        error = None
        try:
            audit_spatial_affine_config(config, phase=phase, project_root=ROOT)
        except (KeyError, TypeError, ValueError) as exc:
            rejected = True
            error = str(exc)
        results.append({"name": name, "passed": rejected, "error": error})

    replay_run_id = f"spatial-affine-replay-{uuid4().hex}"
    replay_namespace = (
        ".runtime/ai-painter/stage4-spatial-affine-cpu-contract-fixtures/"
        f"{replay_run_id}"
    )
    formal = _load_formal_objective_contract(ROOT)
    replay_rejected = False
    replay_error = None
    try:
        issue_and_consume_spatial_affine_internal_ticket(
            inactive,
            phase="readonly_gpu",
            dataset_package_id=formal["data"]["datasetPackageId"],
            run_id=replay_run_id,
            output_namespace=replay_namespace,
            project_root=ROOT,
            ticket_namespace=".test-output/stage4-spatial-affine-capability-tickets",
        )
        issue_and_consume_spatial_affine_internal_ticket(
            inactive,
            phase="readonly_gpu",
            dataset_package_id=formal["data"]["datasetPackageId"],
            run_id=replay_run_id,
            output_namespace=replay_namespace,
            project_root=ROOT,
            ticket_namespace=".test-output/stage4-spatial-affine-capability-tickets",
        )
    except (FileExistsError, ValueError) as exc:
        replay_rejected = True
        replay_error = str(exc)
    results.append(
        {
            "name": "internal_ticket_replay_rejected",
            "passed": replay_rejected,
            "error": replay_error,
        }
    )
    return results


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=ROOT)
    args = parser.parse_args()
    if args.project_root.resolve() != ROOT.resolve():
        raise ValueError("spatial_affine_cpu_checker_project_root_mismatch")
    positive = build_and_audit_all_modes()
    negative = run_negative_cases()
    passed = all(case["passed"] for case in negative)
    report = {
        "schemaVersion": "stage4-spatial-affine-decoder-cpu-contract-report-v1",
        "status": "passed" if passed else "failed",
        "architectureId": ARCHITECTURE_ID,
        "positive": {
            "passed": len(positive),
            "total": 4,
            "modes": positive,
        },
        "negative": {
            "passed": sum(case["passed"] for case in negative),
            "total": len(negative),
            "cases": negative,
        },
        "checkpointRead": False,
        "gpuStarted": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

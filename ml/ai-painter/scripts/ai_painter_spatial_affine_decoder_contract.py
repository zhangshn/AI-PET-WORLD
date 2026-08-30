from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

from ai_painter_authorization_policy import (
    execution_action_values_for_stage_config,
    local_ai_ticket_bound_config_sha256,
    resolve_stage_execution_grant,
)
from ai_painter_stage_mode_registry import (
    SPATIAL_AFFINE_DECODER_STAGE0_FULL_TRAINING_STATUS,
    SPATIAL_AFFINE_DECODER_STAGE4_FULL_DATA_SCREEN_STATUS,
    SPATIAL_AFFINE_DECODER_STAGE4_INACTIVE_STATUS,
    SPATIAL_AFFINE_DECODER_STAGE4_READONLY_GPU_STATUS,
    resolve_stage_mode,
)


ARCHITECTURE_ID = "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
CAPABILITY_VERSION = "stage4-multiscale-spatial-affine-conditioned-decoder-v1"
FROZEN_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
FROZEN_RESOLUTION_STAGES = [
    {"width": 256, "height": 192},
    {"width": 512, "height": 384},
    {"width": 1024, "height": 768},
]
ACTIVATION_GATE_KEYS = (
    "checkpointReadNow",
    "optimizerNow",
    "backwardNow",
    "weightModificationNow",
    "gpuNow",
    "readonlyGpuQualificationNow",
    "fullDataScreenNow",
    "trainingNow",
    "stage0Now",
    "stage1Now",
    "stage2Now",
    "formalInferenceNow",
    "checkpointPromotionNow",
    "runtimeFrameNow",
    "worldEntryNow",
)
SCREEN_REVIEW_EPOCHS = [5, 10, 15, 20, 24]
STAGE0_REVIEW_EPOCHS = [1, 5, 10, 20, 30, 40]
FORMAL_LOSS_SOURCE_EVIDENCE = {
    "path": "data/ai-painter/system-governance/stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json",
    "sha256": "779027a5fe2a58d80be4519d7df17a5dc39ffd58307a627eef09620adaf42059",
    "role": "active_formal_loss_and_metric_machine_contract",
    "checkpointOrWeightExecutionSource": False,
}
FROZEN_DENOISER_LOSS_WEIGHTS = {
    "velocity": 1, "cleanLatent": 0.75,
    "multiscaleLatentGradient": 0.35, "multiscaleLatentLaplacian": 0.2,
    "quietRegionExcess": 0.8, "discreteConditionOutputBinding": 0.9,
    "continuousConditionOutputBinding": 0.35, "decodedRgb": 0.75,
    "decodedRgbGradient": 0.35, "decodedRgbLaplacian": 0.15,
    "decodedRgbQuietRegionExcess": 1, "sparseRegionDecodedRgb": 1,
    "sparseRegionContrast": 1.25, "spatialGridRgb": 1.25,
    "pathBoundaryRgb": 1.5, "objectSemanticRgb": 1,
    "pathInteriorRgb": 2, "pathForbiddenBoundaryRgb": 2,
}
FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS = {
    "velocityPredictionMse": 1, "cleanLatentMae": 0.75,
    "multiscaleLatentGradientMae": 0.35,
    "multiscaleLatentLaplacianMae": 0.2, "quietRegionExcess": 0.8,
    "discreteConditionOutputBindingBce": 0.9,
    "continuousConditionOutputBindingMae": 0.35, "decodedRgbMae": 0.75,
    "decodedRgbGradientMae": 0.35, "decodedRgbLaplacianMae": 0.15,
    "decodedRgbQuietRegionExcess": 1, "sparseRegionDecodedRgbMae": 1,
    "sparseRegionContrastMae": 1.25, "spatialGridRgbMae": 1.25,
    "pathBoundaryRgbMae": 1.5, "objectFootprintsRgbMae": 0.25,
    "objectTreeRgbMae": 0.25, "objectRockRgbMae": 0.375,
    "objectVegetationRgbMae": 0.25, "objectSemanticRgbMae": 1,
    "pathInteriorRgbMae": 1.5, "pathForbiddenBoundaryRgbMae": 1.75,
}
FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS = {
    "rolloutRgbMae": 0.75, "rolloutRgbGradientMae": 0.5,
    "rolloutRgbLaplacianMae": 0.25, "rolloutSparseRegionRgbMae": 1,
    "rolloutRegionContrastMae": 1.5, "rolloutSpatialGridRgbMae": 1.5,
    "rolloutPathBoundaryRgbMae": 1.5, "rolloutObjectSemanticRgbMae": 1,
    "rolloutPathInteriorRgbMae": 1.5,
    "rolloutPathForbiddenBoundaryRgbMae": 1.75,
}
SPATIAL_AFFINE_TOP_LEVEL_FIELDS = frozenset({
    "schemaVersion", "modelId", "architectureVersion", "status", "ownership",
    "trainingLane", "trainingDataPolicyVersion", "initialization",
    "upstreamModelIds", "thirdPartyWeightsAllowed",
    "thirdPartyGeneratedTrainingOutputsAllowed",
    "thirdPartyGeneratedTrainingOutputDependencyMustBeDeclared",
    "datasetPackageModelId", "autoencoderSourceModelId",
    "autoencoderSourceArchitectureVersion",
    "autoencoderRequiredCheckpointProvenance", "conditionChannels",
    "conditionChannelOrder", "conditionChannelTypes", "conditionResizeContract",
    "imageSize", "autoencoderArchitecture", "denoiserArchitecture",
    "conditionOutputBinding", "predictionTarget", "latentNormalization",
    "latentChannels", "latentDownsampleFactor", "baseChannels",
    "denoiserBaseChannels", "diffusionSteps", "inferenceSteps",
    "formalInferenceEligible", "capabilityCandidateOnly",
    "ownerAuthorizationRequired", "ownerResponseRequired",
    "formalLossSourceEvidence", "stage4SpatialAffineConditioningContract",
    "training", "requiredCheckpointProvenance",
})
SPATIAL_AFFINE_BASE_TRAINING_FIELDS = frozenset({
    "trainingAuthorizationStatus", "dataCapacityDecision", "resolutionStages",
    "batchSize", "denoiserEpochs", "denoiserLearningRate",
    "denoiserLossVersion", "denoiserLossWeights", "fixedValidationTimesteps",
    "timestepSampling", "quietRegionQuantile", "quietRegionMargin",
    "textureHierarchyScales", "sparseRgbConditionChannels",
    "semanticRgbConditionChannels", "objectSemanticChannelWeights",
    "pathBoundaryBandRatio", "bestCheckpointMetric",
    "bestCheckpointMetricWeights", "rolloutCheckpointMetricWeights",
    "checkpointRolloutWeight", "checkpointRolloutCoverage",
    "checkpointRolloutSeedsPerSample", "checkpointWorstTrajectoryWeight",
    "checkpointSelectionSplit", "strictHeldOutInferenceSplit", "seed",
    "fixedEpochPreviewPolicy", "activationGates",
    "finalRgbBoundaryCheckpointNonRegressionGate",
})


def _activation_gates(*enabled: str) -> dict[str, bool]:
    enabled_set = set(enabled)
    if not enabled_set.issubset(ACTIVATION_GATE_KEYS):
        raise ValueError("unknown spatial-affine activation gate")
    return {key: key in enabled_set for key in ACTIVATION_GATE_KEYS}


def _architecture_contract() -> dict:
    return {
        "schemaVersion": "stage4-spatial-affine-conditioning-contract-v1",
        "status": "cpu_supported_inactive",
        "capabilityVersion": CAPABILITY_VERSION,
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


def _checkpoint_gate() -> dict:
    return {
        "schemaVersion": "stage4-final-rgb-boundary-checkpoint-non-regression-gate-v1",
        "contractVersion": "stage4-final-rgb-boundary-checkpoint-non-regression-v1",
        "status": "metric_only_supported_inactive",
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


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _load_formal_objective_contract(project_root: Path) -> dict:
    root = project_root.resolve()
    contract_path = root / FORMAL_LOSS_SOURCE_EVIDENCE["path"]
    if (
        not contract_path.is_file()
        or _sha256_file(contract_path) != FORMAL_LOSS_SOURCE_EVIDENCE["sha256"]
    ):
        raise ValueError("spatial-affine formal objective contract identity is invalid")
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    if (
        contract.get("schemaVersion")
        != "ai-painter-stage4-formal-diffusion-objective-and-checkpoint-contract-v1"
        or contract.get("status") != "active_machine_contract"
        or contract.get("historicalRuntimeArtifactIsExecutionSource") is not False
    ):
        raise ValueError("spatial-affine formal objective contract is inactive")
    bindings = (
        ("datasetManifestPath", "datasetManifestSha256"),
        ("sourceIndexPath", "sourceIndexSha256"),
    )
    data = contract.get("data", {})
    for path_key, hash_key in bindings:
        bound = root / str(data.get(path_key, ""))
        if not bound.is_file() or _sha256_file(bound) != data.get(hash_key):
            raise ValueError(f"spatial-affine bound data identity is invalid:{path_key}")
    manifest = json.loads(
        (root / str(data["datasetManifestPath"])).read_text(encoding="utf-8")
    )
    if (
        manifest.get("packageId") != data.get("datasetPackageId")
        or manifest.get("modelConfigId") != data.get("datasetPackageModelId")
        or manifest.get("sourceIndexPath") != data.get("sourceIndexPath")
    ):
        raise ValueError("spatial-affine dataset package identity is invalid")
    model = contract.get("modelBoundary", {})
    if (
        model.get("checkpointSchemaVersion")
        != "project-owned-ai-assisted-cold-start-checkpoint-v7"
        or model.get("parentDenoiserInitializationAllowed") is not False
    ):
        raise ValueError("spatial-affine checkpoint format boundary is invalid")
    autoencoder = root / str(model.get("autoencoderCheckpointPath", ""))
    if (
        not autoencoder.is_file()
        or _sha256_file(autoencoder) != model.get("autoencoderCheckpointSha256")
    ):
        raise ValueError("spatial-affine project Autoencoder identity is invalid")
    if contract.get("denoiserLossWeights") != FROZEN_DENOISER_LOSS_WEIGHTS:
        raise ValueError("spatial-affine formal objective contract changes Loss weights")
    if (
        contract.get("bestCheckpointMetricWeights")
        != FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS
    ):
        raise ValueError("spatial-affine formal objective contract changes checkpoint weights")
    if (
        contract.get("rolloutCheckpointMetricWeights")
        != FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS
    ):
        raise ValueError("spatial-affine formal objective contract changes rollout weights")
    return contract


def load_spatial_affine_formal_objective_contract(
    project_root: Path,
) -> dict:
    """Return the verified immutable formal objective/data binding."""

    return deepcopy(_load_formal_objective_contract(project_root))


def compile_spatial_affine_decoder_cpu_inactive_config(
    *,
    project_root: Path,
) -> dict:
    """Compile the one isolated successor from a qualified diffusion Loss source."""
    formal = _load_formal_objective_contract(project_root)
    training = formal["training"]
    model = formal["modelBoundary"]
    data = formal["data"]
    loss_weights = deepcopy(formal["denoiserLossWeights"])
    checkpoint_weights = deepcopy(formal["bestCheckpointMetricWeights"])
    rollout_weights = deepcopy(formal["rolloutCheckpointMetricWeights"])
    split_counts = deepcopy(data["splitCounts"])
    if split_counts != FROZEN_SPLIT_COUNTS:
        raise ValueError("spatial-affine source does not bind the formal 48/8/4/4 split")

    config = {
        "schemaVersion": "ai-painter-stage4-spatial-affine-cpu-inactive-config-v1",
        "modelId": "ai-painter-stage4-multiscale-spatial-affine-decoder-v1",
        "architectureVersion": "multiscale-spatial-affine-conditioned-decoder-v1",
        "status": "cpu_supported_inactive",
        "ownership": model["ownership"],
        "trainingLane": model["trainingLane"],
        "trainingDataPolicyVersion": model["trainingDataPolicyVersion"],
        "initialization": "random_initialization_only",
        "upstreamModelIds": [],
        "thirdPartyWeightsAllowed": False,
        "thirdPartyGeneratedTrainingOutputsAllowed": True,
        "thirdPartyGeneratedTrainingOutputDependencyMustBeDeclared": True,
        "datasetPackageModelId": data["datasetPackageModelId"],
        "autoencoderSourceModelId": model["autoencoderSourceModelId"],
        "autoencoderSourceArchitectureVersion": model[
            "autoencoderSourceArchitectureVersion"
        ],
        "autoencoderRequiredCheckpointProvenance": model[
            "autoencoderRequiredCheckpointProvenance"
        ],
        "conditionChannels": 23,
        "conditionChannelOrder": deepcopy(formal["conditionChannelOrder"]),
        "conditionChannelTypes": deepcopy(formal["conditionChannelTypes"]),
        "conditionResizeContract": "discrete_nearest_continuous_bilinear_v1",
        "imageSize": {"width": 1024, "height": 768},
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "denoiserArchitecture": ARCHITECTURE_ID,
        "conditionOutputBinding": "predicted_clean_latent_and_decoded_rgb_v1",
        "predictionTarget": "velocity_v1",
        "latentNormalization": model["latentNormalization"],
        "latentChannels": 12,
        "latentDownsampleFactor": 4,
        "baseChannels": int(model["autoencoderBaseChannels"]),
        "denoiserBaseChannels": 64,
        "diffusionSteps": 1000,
        "inferenceSteps": 50,
        "formalInferenceEligible": False,
        "capabilityCandidateOnly": True,
        "ownerAuthorizationRequired": False,
        "ownerResponseRequired": False,
        "formalLossSourceEvidence": deepcopy(FORMAL_LOSS_SOURCE_EVIDENCE),
        "stage4SpatialAffineConditioningContract": _architecture_contract(),
        "training": {
            "trainingAuthorizationStatus": SPATIAL_AFFINE_DECODER_STAGE4_INACTIVE_STATUS,
            "dataCapacityDecision": {
                "schemaVersion": "ai-painter-fixed-approved-dataset-split-v1",
                "status": "active_immutable_64_record_split",
                "totalCompleteMaps": 64,
                "splitCounts": deepcopy(FROZEN_SPLIT_COUNTS),
                "trainingRecordsMayUpdateWeights": ["train"],
                "validationRecordsReadOnly": True,
                "heldOutRecordsReadOnly": ["challenge", "regression"],
            },
            "resolutionStages": deepcopy(FROZEN_RESOLUTION_STAGES),
            "batchSize": int(training.get("batchSize", 1)),
            "denoiserEpochs": 24,
            "denoiserLearningRate": float(training.get("denoiserLearningRate")),
            "denoiserLossVersion": "existing_formal_velocity_decoded_rgb_supervision_v1",
            "denoiserLossWeights": loss_weights,
            "fixedValidationTimesteps": deepcopy(
                training.get("fixedValidationTimesteps")
            ),
            "timestepSampling": deepcopy(training.get("timestepSampling")),
            "quietRegionQuantile": float(training.get("quietRegionQuantile")),
            "quietRegionMargin": float(training.get("quietRegionMargin")),
            "textureHierarchyScales": deepcopy(training.get("textureHierarchyScales")),
            "sparseRgbConditionChannels": deepcopy(
                training.get("sparseRgbConditionChannels")
            ),
            "semanticRgbConditionChannels": deepcopy(
                training.get("semanticRgbConditionChannels")
            ),
            "objectSemanticChannelWeights": deepcopy(
                training.get("objectSemanticChannelWeights")
            ),
            "pathBoundaryBandRatio": float(training.get("pathBoundaryBandRatio", 0.04)),
            "bestCheckpointMetric": "existing_formal_score_with_final_rgb_boundary_non_regression_v1",
            "bestCheckpointMetricWeights": checkpoint_weights,
            "rolloutCheckpointMetricWeights": rollout_weights,
            "checkpointRolloutWeight": float(
                training.get("checkpointRolloutWeight", 1.0)
            ),
            "checkpointRolloutCoverage": "all_validation_samples",
            "checkpointRolloutSeedsPerSample": int(
                training.get("checkpointRolloutSeedsPerSample", 2)
            ),
            "checkpointWorstTrajectoryWeight": float(
                training.get("checkpointWorstTrajectoryWeight", 1.0)
            ),
            "checkpointSelectionSplit": "validation",
            "strictHeldOutInferenceSplit": "challenge",
            "seed": 20263722,
            "fixedEpochPreviewPolicy": {
                "smoke": deepcopy(SCREEN_REVIEW_EPOCHS),
                "formalStage": deepcopy(STAGE0_REVIEW_EPOCHS),
            },
            "activationGates": _activation_gates(),
            "finalRgbBoundaryCheckpointNonRegressionGate": _checkpoint_gate(),
        },
        "requiredCheckpointProvenance": model["checkpointSchemaVersion"],
    }
    validate_spatial_affine_decoder_config(config, project_root=project_root)
    return config


def build_spatial_affine_active_config_template(
    inactive: dict,
    *,
    phase: str,
    project_root: Path,
) -> dict:
    validate_spatial_affine_decoder_config(inactive, project_root=project_root)
    active = deepcopy(inactive)
    training = active["training"]
    active["stage4SpatialAffineConditioningContract"]["status"] = (
        "active_local_ai_internal_capability"
    )
    training["finalRgbBoundaryCheckpointNonRegressionGate"]["status"] = (
        "active_metric_only_checkpoint_gate"
    )
    if phase == "readonly_gpu":
        active["schemaVersion"] = (
            "ai-painter-stage4-spatial-affine-readonly-gpu-config-v1"
        )
        active["status"] = "readonly_gpu_qualification_active"
        training["trainingAuthorizationStatus"] = (
            SPATIAL_AFFINE_DECODER_STAGE4_READONLY_GPU_STATUS
        )
        training["activationGates"] = _activation_gates(
            "gpuNow", "readonlyGpuQualificationNow"
        )
    elif phase == "full_data_screen":
        active["schemaVersion"] = (
            "ai-painter-stage4-spatial-affine-full-data-screen-config-v1"
        )
        active["status"] = "full_data_screen_active"
        training["trainingAuthorizationStatus"] = (
            SPATIAL_AFFINE_DECODER_STAGE4_FULL_DATA_SCREEN_STATUS
        )
        training["denoiserEpochs"] = 24
        training["activationGates"] = _activation_gates(
            "optimizerNow",
            "backwardNow",
            "weightModificationNow",
            "gpuNow",
            "fullDataScreenNow",
            "trainingNow",
        )
        training["fullDataScreenContract"] = {
            "status": "active_local_ai_internal_capability",
            "reviewEpochs": deepcopy(SCREEN_REVIEW_EPOCHS),
            "trainWeightUpdateCount": 48,
            "validationReadOnlyCount": 8,
            "challengeHeldOutCount": 4,
            "regressionHeldOutCount": 4,
            "heldOutAccess": "after_screen_training_natural_completion_only",
            "screenCheckpointStage0InitializationEligible": False,
            "fixedPreviewByteReproductionRequired": True,
            "automaticSecondCandidateAllowed": False,
        }
    elif phase == "stage0":
        active["schemaVersion"] = (
            "ai-painter-stage4-spatial-affine-stage0-active-config-v1"
        )
        active["status"] = "formal_stage0_training_active"
        training["trainingAuthorizationStatus"] = (
            SPATIAL_AFFINE_DECODER_STAGE0_FULL_TRAINING_STATUS
        )
        training["denoiserEpochs"] = 40
        training["activationGates"] = _activation_gates(
            "optimizerNow",
            "backwardNow",
            "weightModificationNow",
            "gpuNow",
            "trainingNow",
            "stage0Now",
        )
        training["formalStage0Contract"] = {
            "status": "active_local_ai_internal_capability",
            "resolution": {"width": 256, "height": 192},
            "epochCount": 40,
            "previewEpochs": deepcopy(STAGE0_REVIEW_EPOCHS),
            "initialization": "fixed_project_random_initialization_only",
            "screenCheckpointAllowed": False,
            "historicalCheckpointAllowed": False,
            "fixedPreviewByteReproductionRequired": True,
            "automaticRetryAllowed": False,
        }
    else:
        raise ValueError("unknown spatial-affine active phase")
    validate_spatial_affine_decoder_config(
        active,
        project_root=project_root,
        require_execution_ticket=False,
    )
    return active


def materialize_spatial_affine_active_config(
    inactive: dict,
    *,
    phase: str,
    local_ai_capability_ticket: dict,
    project_root: Path,
) -> dict:
    active = build_spatial_affine_active_config_template(
        inactive,
        phase=phase,
        project_root=project_root,
    )
    active["training"]["localAiCapabilityTicket"] = deepcopy(
        local_ai_capability_ticket
    )
    validate_spatial_affine_decoder_config(active, project_root=project_root)
    resolve_stage_execution_grant(active, project_root=project_root)
    return active


def _write_json_exclusive(path: Path, value: dict) -> None:
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()


def issue_and_consume_spatial_affine_internal_ticket(
    inactive: dict,
    *,
    phase: str,
    dataset_package_id: str,
    run_id: str,
    output_namespace: str,
    project_root: Path,
    ticket_namespace: str = (
        ".runtime/ai-painter/stage4-spatial-affine-capability-tickets"
    ),
) -> tuple[dict, dict]:
    """Atomically establish one bounded local execution identity.

    This is an internal idempotency and anti-replay mechanism, not an Owner
    approval.  Callers must complete all read-only preflight checks before
    invoking it.
    """

    root = project_root.resolve()
    formal = _load_formal_objective_contract(root)
    if dataset_package_id != formal["data"]["datasetPackageId"]:
        raise ValueError("spatial-affine ticket dataset package identity changed")
    if not isinstance(run_id, str) or re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9._-]{7,127}", run_id
    ) is None:
        raise ValueError("spatial-affine run identity is invalid")
    template = build_spatial_affine_active_config_template(
        inactive,
        phase=phase,
        project_root=root,
    )
    output = Path(output_namespace)
    if (
        output.is_absolute()
        or not output.parts
        or any(part in {"", ".", ".."} for part in output.parts)
        or tuple(part.casefold() for part in output.parts[:2])
        != (".runtime", "ai-painter")
        or output.name != run_id
    ):
        raise ValueError("spatial-affine output namespace is invalid")
    if (root / output).exists():
        raise ValueError("spatial-affine output namespace reuse is forbidden")
    ticket_namespace_path = Path(ticket_namespace)
    if (
        ticket_namespace_path.is_absolute()
        or not ticket_namespace_path.parts
        or any(
            part in {"", ".", ".."} for part in ticket_namespace_path.parts
        )
    ):
        raise ValueError("spatial-affine ticket namespace is invalid")
    ticket_directory_relative = ticket_namespace_path / run_id
    ticket_directory = root / ticket_directory_relative
    ticket_directory.parent.mkdir(parents=True, exist_ok=True)
    ticket_directory.mkdir(exist_ok=False)
    ticket_path = ticket_directory / "ticket.json"
    consumption_path = ticket_directory / "consumption.json"
    ticket_id = f"local-ai-{phase}-{run_id}"
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(template),
        "datasetPackageId": dataset_package_id,
        "runId": run_id,
        "outputNamespace": output.as_posix(),
    }
    actions = execution_action_values_for_stage_config(template)
    ticket = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-v2",
        "status": "issued_not_consumed",
        "ticketId": ticket_id,
        "modeId": resolve_stage_mode(template).mode_id,
        "capabilityAuthority": "local_ai_pet_world_program",
        "ownerAuthorizationRequired": False,
        "executionActions": actions,
        "binding": binding,
    }
    _write_json_exclusive(ticket_path, ticket)
    ticket_sha256 = _sha256_file(ticket_path)
    consumption = {
        "schemaVersion": (
            "ai-painter-local-internal-capability-ticket-consumption-v2"
        ),
        "ticketId": ticket_id,
        "ticketSha256": ticket_sha256,
        "oneTimeConsumption": True,
        "state": "consumed",
        "binding": binding,
    }
    _write_json_exclusive(consumption_path, consumption)
    identity = {
        "ticketId": ticket_id,
        "ticketPath": ticket_path.relative_to(root).as_posix(),
        "ticketSha256": ticket_sha256,
        "consumptionPath": consumption_path.relative_to(root).as_posix(),
        "consumptionSha256": _sha256_file(consumption_path),
        "executionState": "consumed",
        "status": template["training"]["trainingAuthorizationStatus"],
        "executionActions": actions,
        **binding,
    }
    active = materialize_spatial_affine_active_config(
        inactive,
        phase=phase,
        local_ai_capability_ticket=identity,
        project_root=root,
    )
    return active, identity


def validate_spatial_affine_decoder_config(
    config: dict,
    *,
    project_root: Path | None = None,
    require_execution_ticket: bool = True,
) -> dict:
    formal = (
        _load_formal_objective_contract(project_root)
        if project_root is not None
        else None
    )
    if set(config) != set(SPATIAL_AFFINE_TOP_LEVEL_FIELDS):
        raise ValueError("spatial-affine top-level fields are invalid")
    if config.get("denoiserArchitecture") != ARCHITECTURE_ID:
        raise ValueError("spatial-affine architecture identity is invalid")
    if (
        config.get("conditionChannels") != 23
        or len(config.get("conditionChannelOrder", [])) != 23
        or config.get("latentChannels") != 12
        or config.get("latentDownsampleFactor") != 4
        or config.get("denoiserBaseChannels") != 64
        or config.get("autoencoderArchitecture")
        != "residual_4x_latent_pixel_detail_v2"
    ):
        raise ValueError("spatial-affine fixed model boundary is invalid")
    if formal is not None:
        model = formal["modelBoundary"]
        data = formal["data"]
        exact_top_level = {
            "ownership": model["ownership"],
            "trainingLane": model["trainingLane"],
            "trainingDataPolicyVersion": model["trainingDataPolicyVersion"],
            "datasetPackageModelId": data["datasetPackageModelId"],
            "autoencoderSourceModelId": model["autoencoderSourceModelId"],
            "autoencoderSourceArchitectureVersion": model[
                "autoencoderSourceArchitectureVersion"
            ],
            "autoencoderRequiredCheckpointProvenance": model[
                "autoencoderRequiredCheckpointProvenance"
            ],
            "conditionChannelOrder": formal["conditionChannelOrder"],
            "conditionChannelTypes": formal["conditionChannelTypes"],
            "latentNormalization": model["latentNormalization"],
            "baseChannels": int(model["autoencoderBaseChannels"]),
            "requiredCheckpointProvenance": model["checkpointSchemaVersion"],
        }
        for key, expected in exact_top_level.items():
            if config.get(key) != expected:
                raise ValueError(f"spatial-affine formal identity changed:{key}")
    if config.get("diffusionSteps") != 1000 or config.get("inferenceSteps") != 50:
        raise ValueError("spatial-affine formal rollout boundary is invalid")
    if config.get("ownerAuthorizationRequired") is not False:
        raise ValueError("spatial-affine capability cannot require Owner authorization")
    if config.get("ownerResponseRequired") is not False:
        raise ValueError("spatial-affine capability cannot wait for Owner response")
    if config.get("formalLossSourceEvidence") != FORMAL_LOSS_SOURCE_EVIDENCE:
        raise ValueError("spatial-affine formal Loss source binding is invalid")
    if "stage4ControlledStructureArm" in config or "stage4ResponsibilityComponentRole" in config:
        raise ValueError("spatial-affine config contains an exited route")
    contract = config.get("stage4SpatialAffineConditioningContract", {})
    if (
        contract.get("architectureId") != ARCHITECTURE_ID
        or contract.get("parameterCount") != 159744
        or contract.get("parameterTensorCount") != 8
        or contract.get("newLossTermAdded") is not False
        or contract.get("freeArchitectureParameterChosen") is not False
    ):
        raise ValueError("spatial-affine architecture contract is invalid")
    training = config.get("training", {})
    if training.get("denoiserLossWeights") != FROZEN_DENOISER_LOSS_WEIGHTS:
        raise ValueError("spatial-affine existing Loss weights changed")
    if (
        training.get("bestCheckpointMetricWeights")
        != FROZEN_BEST_CHECKPOINT_METRIC_WEIGHTS
    ):
        raise ValueError("spatial-affine existing checkpoint weights changed")
    if (
        training.get("rolloutCheckpointMetricWeights")
        != FROZEN_ROLLOUT_CHECKPOINT_METRIC_WEIGHTS
    ):
        raise ValueError("spatial-affine existing rollout weights changed")
    if training.get("dataCapacityDecision", {}).get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("spatial-affine data split is invalid")
    if training.get("resolutionStages") != FROZEN_RESOLUTION_STAGES:
        raise ValueError("spatial-affine resolution stages are invalid")
    if training.get("seed") != 20263722:
        raise ValueError("spatial-affine seed is invalid")
    if formal is not None:
        formal_training = formal["training"]
        exact_training = {
            "batchSize": int(formal_training["batchSize"]),
            "denoiserLearningRate": float(
                formal_training["denoiserLearningRate"]
            ),
            "fixedValidationTimesteps": formal_training[
                "fixedValidationTimesteps"
            ],
            "timestepSampling": formal_training["timestepSampling"],
            "quietRegionQuantile": float(
                formal_training["quietRegionQuantile"]
            ),
            "quietRegionMargin": float(formal_training["quietRegionMargin"]),
            "textureHierarchyScales": formal_training[
                "textureHierarchyScales"
            ],
            "sparseRgbConditionChannels": formal_training[
                "sparseRgbConditionChannels"
            ],
            "semanticRgbConditionChannels": formal_training[
                "semanticRgbConditionChannels"
            ],
            "objectSemanticChannelWeights": formal_training[
                "objectSemanticChannelWeights"
            ],
            "pathBoundaryBandRatio": float(
                formal_training["pathBoundaryBandRatio"]
            ),
            "checkpointRolloutWeight": float(
                formal_training["checkpointRolloutWeight"]
            ),
            "checkpointRolloutCoverage": "all_validation_samples",
            "checkpointRolloutSeedsPerSample": int(
                formal_training["checkpointRolloutSeedsPerSample"]
            ),
            "checkpointWorstTrajectoryWeight": float(
                formal_training["checkpointWorstTrajectoryWeight"]
            ),
            "checkpointSelectionSplit": "validation",
            "strictHeldOutInferenceSplit": "challenge",
        }
        for key, expected in exact_training.items():
            if training.get(key) != expected:
                raise ValueError(f"spatial-affine formal training identity changed:{key}")
    checkpoint_gate = training.get("finalRgbBoundaryCheckpointNonRegressionGate", {})
    if (
        checkpoint_gate.get("contractVersion")
        != "stage4-final-rgb-boundary-checkpoint-non-regression-v1"
        or checkpoint_gate.get("enabled") is not True
        or checkpoint_gate.get("role") != "checkpoint_eligibility_gate_only"
        or checkpoint_gate.get("metricOnly") is not True
        or checkpoint_gate.get("trainingLossContribution") is not False
        or checkpoint_gate.get("bestCheckpointMetricWeight") is not False
        or checkpoint_gate.get("bestCheckpointMetricWeightAdded") is not False
        or checkpoint_gate.get("auditBandPixels") != 6
        or checkpoint_gate.get("missingContractDisposition")
        != "fail_closed_not_numeric_zero"
    ):
        raise ValueError("spatial-affine checkpoint gate is invalid")
    mode = resolve_stage_mode(config)
    expected_mode_identity = {
        "spatial_affine_decoder_stage4_inactive": (
            "ai-painter-stage4-spatial-affine-cpu-inactive-config-v1",
            "cpu_supported_inactive",
            "cpu_supported_inactive",
            "metric_only_supported_inactive",
        ),
        "spatial_affine_decoder_stage4_readonly_gpu": (
            "ai-painter-stage4-spatial-affine-readonly-gpu-config-v1",
            "readonly_gpu_qualification_active",
            "active_local_ai_internal_capability",
            "active_metric_only_checkpoint_gate",
        ),
        "spatial_affine_decoder_stage4_full_data_screen": (
            "ai-painter-stage4-spatial-affine-full-data-screen-config-v1",
            "full_data_screen_active",
            "active_local_ai_internal_capability",
            "active_metric_only_checkpoint_gate",
        ),
        "spatial_affine_decoder_stage0_full_training": (
            "ai-painter-stage4-spatial-affine-stage0-active-config-v1",
            "formal_stage0_training_active",
            "active_local_ai_internal_capability",
            "active_metric_only_checkpoint_gate",
        ),
    }.get(mode.mode_id)
    if expected_mode_identity is None:
        raise ValueError("spatial-affine Mode Registry identity is invalid")
    schema, status, architecture_status, checkpoint_status = expected_mode_identity
    if config.get("schemaVersion") != schema or config.get("status") != status:
        raise ValueError("spatial-affine mode document identity is invalid")
    expected_architecture_contract = _architecture_contract()
    expected_architecture_contract["status"] = architecture_status
    if contract != expected_architecture_contract:
        raise ValueError("spatial-affine exact architecture contract is invalid")
    expected_checkpoint_gate = _checkpoint_gate()
    expected_checkpoint_gate["status"] = checkpoint_status
    if checkpoint_gate != expected_checkpoint_gate:
        raise ValueError("spatial-affine exact checkpoint gate is invalid")
    if training.get("fixedEpochPreviewPolicy") != {
        "smoke": SCREEN_REVIEW_EPOCHS,
        "formalStage": STAGE0_REVIEW_EPOCHS,
    }:
        raise ValueError("spatial-affine fixed preview identity is invalid")
    expected_training_fields = set(SPATIAL_AFFINE_BASE_TRAINING_FIELDS)
    if mode.active_execution and require_execution_ticket:
        expected_training_fields.add("localAiCapabilityTicket")
    if mode.mode_id == "spatial_affine_decoder_stage4_full_data_screen":
        expected_training_fields.add("fullDataScreenContract")
    elif mode.mode_id == "spatial_affine_decoder_stage0_full_training":
        expected_training_fields.add("formalStage0Contract")
    if set(training) != expected_training_fields:
        raise ValueError("spatial-affine training fields are invalid")
    if formal is not None and require_execution_ticket and mode.active_execution:
        if training["localAiCapabilityTicket"].get("datasetPackageId") != formal[
            "data"
        ]["datasetPackageId"]:
            raise ValueError("spatial-affine ticket dataset binding is invalid")
    gates = training.get("activationGates", {})
    if set(gates) != set(ACTIVATION_GATE_KEYS):
        raise ValueError("spatial-affine activation gate fields are invalid")
    if mode.mode_id == "spatial_affine_decoder_stage4_inactive":
        if any(gates.values()) or config.get("status") != "cpu_supported_inactive":
            raise ValueError("spatial-affine inactive config opens execution")
    elif mode.mode_id == "spatial_affine_decoder_stage4_readonly_gpu":
        if {key for key, value in gates.items() if value} != {
            "gpuNow", "readonlyGpuQualificationNow"
        }:
            raise ValueError("spatial-affine read-only GPU gates are invalid")
    elif mode.mode_id == "spatial_affine_decoder_stage4_full_data_screen":
        screen = training.get("fullDataScreenContract", {})
        if (
            int(training.get("denoiserEpochs", 0)) != 24
            or screen.get("reviewEpochs") != SCREEN_REVIEW_EPOCHS
            or screen.get("trainWeightUpdateCount") != 48
            or screen.get("validationReadOnlyCount") != 8
            or screen.get("challengeHeldOutCount") != 4
            or screen.get("regressionHeldOutCount") != 4
            or screen.get("screenCheckpointStage0InitializationEligible") is not False
            or screen.get("fixedPreviewByteReproductionRequired") is not True
            or {key for key, value in gates.items() if value}
            != {
                "optimizerNow",
                "backwardNow",
                "weightModificationNow",
                "gpuNow",
                "fullDataScreenNow",
                "trainingNow",
            }
        ):
            raise ValueError("spatial-affine screen Epoch count is invalid")
    elif mode.mode_id == "spatial_affine_decoder_stage0_full_training":
        formal = training.get("formalStage0Contract", {})
        if (
            int(training.get("denoiserEpochs", 0)) != 40
            or formal.get("resolution") != {"width": 256, "height": 192}
            or formal.get("epochCount") != 40
            or formal.get("previewEpochs") != STAGE0_REVIEW_EPOCHS
            or formal.get("initialization")
            != "fixed_project_random_initialization_only"
            or formal.get("screenCheckpointAllowed") is not False
            or formal.get("historicalCheckpointAllowed") is not False
            or formal.get("fixedPreviewByteReproductionRequired") is not True
            or {key for key, value in gates.items() if value}
            != {
                "optimizerNow",
                "backwardNow",
                "weightModificationNow",
                "gpuNow",
                "trainingNow",
                "stage0Now",
            }
        ):
            raise ValueError("spatial-affine Stage 0 Epoch count is invalid")
    else:
        raise ValueError("spatial-affine Mode Registry identity is invalid")
    return {
        "status": "stage4_spatial_affine_decoder_config_valid",
        "modeId": mode.mode_id,
        "activationGate": mode.active_execution,
    }

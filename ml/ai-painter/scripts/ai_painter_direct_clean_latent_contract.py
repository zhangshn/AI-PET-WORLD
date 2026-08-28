from __future__ import annotations

from copy import deepcopy

from ai_painter_stage_mode_registry import (
    DIRECT_CLEAN_LATENT_STAGE0_FULL_TRAINING_STATUS,
    DIRECT_CLEAN_LATENT_STAGE4_INACTIVE_STATUS,
    DIRECT_CLEAN_LATENT_STAGE4_SMOKE_STATUS,
    resolve_stage_mode,
)


DIRECT_CLEAN_LATENT_ARCHITECTURE = (
    "stage4_direct_condition_clean_latent_generator_v1"
)
DIRECT_CLEAN_LATENT_MODE_ID = "direct_clean_latent_stage4_inactive"
DIRECT_CLEAN_LATENT_SMOKE_MODE_ID = "direct_clean_latent_stage4_smoke"
DIRECT_CLEAN_LATENT_STAGE0_MODE_ID = "direct_clean_latent_stage0_full_training"
DIRECT_CLEAN_LATENT_WIDTHS = (64, 128, 256)
FROZEN_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
FROZEN_RESOLUTION_STAGES = (
    {"width": 256, "height": 192},
    {"width": 512, "height": 384},
    {"width": 1024, "height": 768},
)
INACTIVE_GATE_KEYS = (
    "checkpointReadNow",
    "optimizerNow",
    "backwardNow",
    "weightModificationNow",
    "gpuNow",
    "smokeNow",
    "trainingNow",
    "stage0Now",
    "stage1Now",
    "stage2Now",
    "formalInferenceNow",
    "checkpointPromotionNow",
    "runtimeFrameNow",
    "worldEntryNow",
)
SMOKE_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
)
SMOKE_PREVIEW_EPOCHS = (1, 5, 10, 20, 30)
SMOKE_SEED = 20263722
SMOKE_RESOLUTION = {"width": 256, "height": 192}
STAGE0_PREVIEW_EPOCHS = (1, 5, 10, 20, 30, 40)
STAGE0_EPOCHS = 40
STAGE0_RESOLUTION = {"width": 256, "height": 192}
SMOKE_ACTIVE_GATES = {
    "optimizerNow",
    "backwardNow",
    "weightModificationNow",
    "gpuNow",
    "smokeNow",
    "trainingNow",
}
STAGE0_ACTIVE_GATES = {
    "checkpointReadNow",
    "optimizerNow",
    "backwardNow",
    "weightModificationNow",
    "gpuNow",
    "trainingNow",
    "stage0Now",
}
FROZEN_LOSS_SUPPORT = {
    "quietRegionQuantile": 0.3,
    "quietRegionMargin": 0.02,
    "textureHierarchyScales": [1.0, 0.5, 0.25],
    "sparseRgbConditionChannels": [
        "terrain_water",
        "terrain_path_ground",
        "terrain_shoreline",
        "object_footprints",
        "focal_area",
    ],
    "semanticRgbConditionChannels": [
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
    ],
    "objectSemanticChannelWeights": {
        "object_footprints": 1.0,
        "object_tree": 1.0,
        "object_rock": 1.25,
        "object_vegetation": 1.0,
    },
    "pathBoundaryBandRatio": 0.04,
}


def compile_direct_clean_latent_cpu_inactive_config(source: dict) -> dict:
    """Compile only values uniquely inherited from the current formal contract."""
    training = source["training"]
    loss_weights = deepcopy(training["denoiserLossWeights"])
    checkpoint_weights = deepcopy(training["bestCheckpointMetricWeights"])
    if "velocity" not in loss_weights:
        raise ValueError("source contract is missing the diffusion-only velocity term")
    if "velocityPredictionMse" not in checkpoint_weights:
        raise ValueError(
            "source contract is missing the diffusion-only checkpoint metric"
        )
    loss_weights.pop("velocity")
    checkpoint_weights.pop("velocityPredictionMse")
    config = {
        "schemaVersion": "ai-painter-direct-clean-latent-cpu-inactive-config-v1",
        "modelId": "ai-painter-stage4-direct-condition-clean-latent-generator-v1",
        "architectureVersion": "direct-condition-clean-latent-generator-v1",
        "status": "cpu_supported_inactive",
        "conditionChannels": int(source["conditionChannels"]),
        "conditionChannelOrder": deepcopy(source["conditionChannelOrder"]),
        "conditionChannelTypes": deepcopy(source["conditionChannelTypes"]),
        "conditionResizeContract": deepcopy(source["conditionResizeContract"]),
        "autoencoderArchitecture": str(source["autoencoderArchitecture"]),
        "autoencoderSourceModelId": str(source["autoencoderSourceModelId"]),
        "autoencoderSourceArchitectureVersion": str(
            source["autoencoderSourceArchitectureVersion"]
        ),
        "autoencoderRequiredCheckpointProvenance": str(
            source["autoencoderRequiredCheckpointProvenance"]
        ),
        "latentChannels": int(source["latentChannels"]),
        "latentDownsampleFactor": int(source["latentDownsampleFactor"]),
        "baseChannels": int(source["baseChannels"]),
        "denoiserBaseChannels": int(source["denoiserBaseChannels"]),
        "denoiserArchitecture": DIRECT_CLEAN_LATENT_ARCHITECTURE,
        "predictionTarget": "clean_autoencoder_latent",
        "formalInferenceEligible": False,
        "capabilityCandidateOnly": True,
        "ownerAuthorizationRequired": False,
        "ownerResponseRequired": False,
        "training": {
            "trainingAuthorizationStatus": DIRECT_CLEAN_LATENT_STAGE4_INACTIVE_STATUS,
            "dataCapacityDecision": deepcopy(training["dataCapacityDecision"]),
            "splitCounts": deepcopy(FROZEN_SPLIT_COUNTS),
            "resolutionStages": deepcopy(list(FROZEN_RESOLUTION_STAGES)),
            "seed": int(training["seed"]),
            "denoiserLossWeights": loss_weights,
            "bestCheckpointMetricWeights": checkpoint_weights,
            "activationGates": {key: False for key in INACTIVE_GATE_KEYS},
        },
        "directCleanLatentContract": {
            "inputIdentity": "formal_typed_23_channel_conditions",
            "outputIdentity": "predicted_clean_12_channel_autoencoder_latent",
            "widths": list(DIRECT_CLEAN_LATENT_WIDTHS),
            "widthDerivation": "existing_base_64_and_existing_x2_hierarchy",
            "sampler": "single_condition_forward_no_diffusion_rollout",
            "randomNoisyLatentInputAllowed": False,
            "diffusionTimestepAllowed": False,
            "timeEmbeddingAllowed": False,
            "velocityPredictionAllowed": False,
            "historicalCheckpointAllowed": False,
            "newLossTermAdded": False,
            "freeArchitectureParameterChosen": False,
        },
    }
    validate_direct_clean_latent_cpu_inactive_config(config)
    return config


def validate_direct_clean_latent_cpu_inactive_config(config: dict) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-direct-clean-latent-cpu-inactive-config-v1"
    ):
        raise ValueError("direct clean-latent config schema is invalid")
    if config.get("status") != "cpu_supported_inactive":
        raise ValueError("direct clean-latent config must remain inactive")
    if config.get("autoencoderSourceArchitectureVersion") != (
        "pixel-detail-residual-autoencoder-v2"
    ):
        raise ValueError("project Autoencoder source architecture identity is invalid")
    if config.get("denoiserArchitecture") != DIRECT_CLEAN_LATENT_ARCHITECTURE:
        raise ValueError("direct clean-latent architecture identity is invalid")
    if config.get("conditionChannels") != 23 or config.get("latentChannels") != 12:
        raise ValueError("direct clean-latent channel boundary is invalid")
    if config.get("latentDownsampleFactor") != 4:
        raise ValueError("direct clean-latent spatial boundary is invalid")
    if config.get("autoencoderArchitecture") != "residual_4x_latent_pixel_detail_v2":
        raise ValueError("direct clean-latent Autoencoder boundary is invalid")
    if config.get("denoiserBaseChannels") != 64:
        raise ValueError("direct clean-latent base width is invalid")
    if config.get("directCleanLatentContract", {}).get("widths") != [64, 128, 256]:
        raise ValueError("direct clean-latent width derivation is invalid")
    forbidden = {
        "diffusionSteps",
        "inferenceSteps",
        "stage4ControlledStructureArm",
        "stage4ResponsibilityComponentRole",
        "postDecodeResponsibilityIdentityOrder",
        "postDecodeResponsibilityInputIdentity",
        "postDecodeResponsibilityInputChannels",
        "postDecodeResponsibilityBranchWidth",
        "postDecodeResponsibilityOutputChannels",
        "postDecodeResponsibilityMerge",
    }
    if forbidden.intersection(config):
        raise ValueError("direct clean-latent config contains an exited-route field")
    training = config.get("training", {})
    if training.get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("direct clean-latent split identity is invalid")
    if training.get("resolutionStages") != list(FROZEN_RESOLUTION_STAGES):
        raise ValueError("direct clean-latent resolution stages are invalid")
    if "velocity" in training.get("denoiserLossWeights", {}):
        raise ValueError("diffusion-only velocity Loss must be absent")
    if "velocityPredictionMse" in training.get("bestCheckpointMetricWeights", {}):
        raise ValueError("diffusion-only checkpoint metric must be absent")
    if not {"cleanLatent", "decodedRgb"}.issubset(
        training.get("denoiserLossWeights", {})
    ):
        raise ValueError("existing clean-latent and decoded-RGB supervision is missing")
    if not {"cleanLatentMae", "decodedRgbMae"}.issubset(
        training.get("bestCheckpointMetricWeights", {})
    ):
        raise ValueError("existing checkpoint supervision is missing")
    gates = training.get("activationGates", {})
    if set(gates) != set(INACTIVE_GATE_KEYS) or any(gates.values()):
        raise ValueError("direct clean-latent activation gates must all be false")
    contract = config.get("directCleanLatentContract", {})
    if any(
        contract.get(key) is not False
        for key in (
            "randomNoisyLatentInputAllowed",
            "diffusionTimestepAllowed",
            "timeEmbeddingAllowed",
            "velocityPredictionAllowed",
            "historicalCheckpointAllowed",
            "newLossTermAdded",
            "freeArchitectureParameterChosen",
        )
    ):
        raise ValueError("direct clean-latent forbidden capability gate is open")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != DIRECT_CLEAN_LATENT_MODE_ID
        or mode.execution_kind != "cpu_inactive"
        or mode.active_execution
    ):
        raise ValueError("direct clean-latent Mode Registry binding is invalid")
    return {
        "status": "direct_clean_latent_cpu_inactive_contract_valid",
        "modeId": mode.mode_id,
        "architecture": mode.architecture,
        "activationGate": False,
    }


def compile_direct_clean_latent_smoke_active_config(
    inactive: dict,
    smoke_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    """Materialize the qualified candidate without inheriting an exited trainer route."""
    validate_direct_clean_latent_cpu_inactive_config(inactive)
    execution = smoke_contract.get("executionIdentity", {})
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("direct clean-latent internal ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = (
        "ai-painter-direct-clean-latent-controlled-smoke-active-config-v1"
    )
    active["status"] = "active_local_ai_internal_capability"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    active["ownerAuthorizationRequired"] = False
    active["ownerResponseRequired"] = False
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        DIRECT_CLEAN_LATENT_STAGE4_SMOKE_STATUS
    )
    training["batchSize"] = 1
    training["denoiserEpochs"] = 30
    training["denoiserLearningRate"] = 0.0001
    training["denoiserLossVersion"] = (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    )
    training["bestCheckpointMetric"] = (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    )
    training.update(deepcopy(FROZEN_LOSS_SUPPORT))
    training["directCleanLatentControlledSmoke"] = {
        "status": "active",
        "authority": "local_ai_pet_world_program",
        "runId": str(execution.get("runId", "")),
        "sampleId": str(execution.get("sampleId", "")),
        "sampleSplit": str(execution.get("sampleSplit", "")),
        "seed": int(execution.get("seed", -1)),
        "topology": str(execution.get("topology", "")),
        "resolutionStage": int(execution.get("resolutionStage", -1)),
        "resolution": deepcopy(execution.get("resolution")),
        "epochCount": int(execution.get("epochCount", -1)),
        "previewEpochs": deepcopy(execution.get("previewEpochs")),
        "initialization": str(execution.get("initialization", "")),
        "autoencoderFrozen": execution.get("autoencoderFrozen"),
        "contractCompilationRunId": str(
            smoke_contract.get("compilationRunId", "")
        ),
        "ticketState": ticket_state,
        "automaticReviewAfterTraining": True,
        "automaticTerminalRecording": True,
        "automaticRetry": False,
    }
    training["activationGates"] = {
        key: ticket_state == "consumed" and key in SMOKE_ACTIVE_GATES
        for key in INACTIVE_GATE_KEYS
    }
    validate_direct_clean_latent_smoke_active_config(active, smoke_contract)
    return active


def validate_direct_clean_latent_smoke_active_config(
    config: dict,
    smoke_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-direct-clean-latent-controlled-smoke-active-config-v1"
    ):
        raise ValueError("direct clean-latent active config schema is invalid")
    if config.get("status") != "active_local_ai_internal_capability":
        raise ValueError("direct clean-latent active config status is invalid")
    if config.get("denoiserArchitecture") != DIRECT_CLEAN_LATENT_ARCHITECTURE:
        raise ValueError("direct clean-latent active architecture is invalid")
    if config.get("ownerAuthorizationRequired") is not False or config.get(
        "ownerResponseRequired"
    ) is not False:
        raise ValueError("direct clean-latent Smoke cannot require Owner approval")
    if smoke_contract.get("schemaVersion") != (
        "stage4-direct-clean-latent-controlled-smoke-contract-v1"
    ) or smoke_contract.get("status") != "compiled_not_started":
        raise ValueError("direct clean-latent Smoke contract identity is invalid")
    execution = smoke_contract.get("executionIdentity", {})
    training = config.get("training", {})
    smoke = training.get("directCleanLatentControlledSmoke", {})
    expected = {
        "runId": execution.get("runId"),
        "sampleId": SMOKE_SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SMOKE_SEED,
        "topology": "west",
        "resolutionStage": 0,
        "resolution": SMOKE_RESOLUTION,
        "epochCount": 30,
        "previewEpochs": list(SMOKE_PREVIEW_EPOCHS),
        "initialization": "fixed_random_denoiser_initialization_only",
        "autoencoderFrozen": True,
        "contractCompilationRunId": smoke_contract.get("compilationRunId"),
    }
    if any(smoke.get(key) != value for key, value in expected.items()):
        raise ValueError("direct clean-latent Smoke execution identity is invalid")
    if training.get("batchSize") != 1 or training.get("denoiserEpochs") != 30:
        raise ValueError("direct clean-latent Smoke training schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("direct clean-latent Smoke learning rate is invalid")
    if config.get("requiredCheckpointProvenance") != (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    ):
        raise ValueError("direct clean-latent checkpoint format is invalid")
    if training.get("denoiserLossVersion") != (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    ) or training.get("bestCheckpointMetric") != (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    ):
        raise ValueError("direct clean-latent Loss identity is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"direct clean-latent frozen Loss support changed: {key}")
    if "velocity" in training.get("denoiserLossWeights", {}) or (
        "velocityPredictionMse" in training.get("bestCheckpointMetricWeights", {})
    ):
        raise ValueError("direct clean-latent active config reintroduced diffusion Loss")
    ticket_state = smoke.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("direct clean-latent active ticket state is invalid")
    gates = training.get("activationGates", {})
    expected_true = SMOKE_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true or any(not isinstance(value, bool) for value in gates.values()):
        raise ValueError("direct clean-latent active gates are invalid")
    if smoke.get("automaticReviewAfterTraining") is not True or smoke.get(
        "automaticTerminalRecording"
    ) is not True or smoke.get("automaticRetry") is not False:
        raise ValueError("direct clean-latent autonomous closure contract is invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != DIRECT_CLEAN_LATENT_SMOKE_MODE_ID
        or mode.execution_kind != "single_sample_smoke"
        or mode.adapter_binding != "direct_clean_latent_stage4_smoke_adapter"
        or mode.active_execution is not True
    ):
        raise ValueError("direct clean-latent active Mode Registry binding is invalid")
    return {
        "status": "direct_clean_latent_controlled_smoke_active_contract_valid",
        "modeId": mode.mode_id,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }


def compile_direct_clean_latent_stage0_active_config(
    inactive: dict,
    stage0_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    """Compile the qualified direct model into one autonomous formal Stage 0 run."""
    validate_direct_clean_latent_cpu_inactive_config(inactive)
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("direct clean-latent Stage 0 internal ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = "ai-painter-direct-clean-latent-stage0-active-config-v1"
    active["status"] = "active_local_ai_stage0_full_training"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    active["ownerAuthorizationRequired"] = False
    active["ownerResponseRequired"] = False
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        DIRECT_CLEAN_LATENT_STAGE0_FULL_TRAINING_STATUS
    )
    training["batchSize"] = 1
    training["denoiserEpochs"] = STAGE0_EPOCHS
    training["denoiserLearningRate"] = 0.0001
    training["denoiserLossVersion"] = (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    )
    training["bestCheckpointMetric"] = (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    )
    training.update(deepcopy(FROZEN_LOSS_SUPPORT))
    execution = stage0_contract.get("executionIdentity", {})
    training["directCleanLatentFormalStage0"] = {
        "status": "active_local_ai_internal_capability",
        "authority": "local_ai_pet_world_program",
        "runId": str(execution.get("runId", "")),
        "stage": int(execution.get("stage", -1)),
        "seed": int(execution.get("seed", -1)),
        "resolution": deepcopy(execution.get("resolution")),
        "epochCount": int(execution.get("epochCount", -1)),
        "previewEpochs": deepcopy(execution.get("previewEpochs")),
        "splitCounts": deepcopy(execution.get("splitCounts")),
        "initialization": str(execution.get("initialization", "")),
        "autoencoderFrozen": execution.get("autoencoderFrozen"),
        "ticketState": ticket_state,
        "trainSplitOnlyUpdatesWeights": True,
        "validationSplitOnlySelectsCheckpoint": True,
        "automaticReviewAfterTraining": True,
        "automaticFailureClassification": True,
        "automaticTerminalRecording": True,
        "automaticRetry": False,
    }
    training["activationGates"] = {
        key: ticket_state == "consumed" and key in STAGE0_ACTIVE_GATES
        for key in INACTIVE_GATE_KEYS
    }
    validate_direct_clean_latent_stage0_active_config(active, stage0_contract)
    return active


def validate_direct_clean_latent_stage0_active_config(
    config: dict,
    stage0_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-direct-clean-latent-stage0-active-config-v1"
    ):
        raise ValueError("direct clean-latent Stage 0 config schema is invalid")
    if config.get("status") != "active_local_ai_stage0_full_training":
        raise ValueError("direct clean-latent Stage 0 status is invalid")
    if config.get("denoiserArchitecture") != DIRECT_CLEAN_LATENT_ARCHITECTURE:
        raise ValueError("direct clean-latent Stage 0 architecture is invalid")
    if config.get("ownerAuthorizationRequired") is not False or config.get(
        "ownerResponseRequired"
    ) is not False:
        raise ValueError("direct clean-latent Stage 0 cannot require Owner approval")
    if stage0_contract.get("schemaVersion") != (
        "stage4-direct-clean-latent-formal-stage0-contract-v1"
    ) or stage0_contract.get("status") != "compiled_not_started":
        raise ValueError("direct clean-latent Stage 0 contract identity is invalid")
    execution = stage0_contract.get("executionIdentity", {})
    training = config.get("training", {})
    formal_stage0 = training.get("directCleanLatentFormalStage0", {})
    expected = {
        "runId": execution.get("runId"),
        "stage": 0,
        "seed": SMOKE_SEED,
        "resolution": STAGE0_RESOLUTION,
        "epochCount": STAGE0_EPOCHS,
        "previewEpochs": list(STAGE0_PREVIEW_EPOCHS),
        "splitCounts": FROZEN_SPLIT_COUNTS,
        "initialization": "fixed_random_denoiser_initialization_only",
        "autoencoderFrozen": True,
    }
    if any(formal_stage0.get(key) != value for key, value in expected.items()):
        raise ValueError("direct clean-latent Stage 0 execution identity is invalid")
    if training.get("batchSize") != 1 or training.get("denoiserEpochs") != 40:
        raise ValueError("direct clean-latent Stage 0 schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("direct clean-latent Stage 0 learning rate is invalid")
    if training.get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("direct clean-latent Stage 0 split identity is invalid")
    if training.get("denoiserLossVersion") != (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    ) or training.get("bestCheckpointMetric") != (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    ):
        raise ValueError("direct clean-latent Stage 0 Loss identity is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"direct clean-latent Stage 0 frozen Loss support changed: {key}")
    if "velocity" in training.get("denoiserLossWeights", {}) or (
        "velocityPredictionMse" in training.get("bestCheckpointMetricWeights", {})
    ):
        raise ValueError("direct clean-latent Stage 0 reintroduced diffusion Loss")
    direct_contract = config.get("directCleanLatentContract", {})
    if any(
        direct_contract.get(key) is not False
        for key in (
            "randomNoisyLatentInputAllowed",
            "diffusionTimestepAllowed",
            "timeEmbeddingAllowed",
            "velocityPredictionAllowed",
            "historicalCheckpointAllowed",
            "newLossTermAdded",
            "freeArchitectureParameterChosen",
        )
    ):
        raise ValueError("direct clean-latent Stage 0 forbidden capability gate is open")
    if any(
        formal_stage0.get(key) is not expected_value
        for key, expected_value in (
            ("trainSplitOnlyUpdatesWeights", True),
            ("validationSplitOnlySelectsCheckpoint", True),
            ("automaticReviewAfterTraining", True),
            ("automaticFailureClassification", True),
            ("automaticTerminalRecording", True),
            ("automaticRetry", False),
        )
    ):
        raise ValueError("direct clean-latent Stage 0 autonomous closure contract is invalid")
    ticket_state = formal_stage0.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("direct clean-latent Stage 0 ticket state is invalid")
    gates = training.get("activationGates", {})
    expected_true = STAGE0_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true or any(not isinstance(value, bool) for value in gates.values()):
        raise ValueError("direct clean-latent Stage 0 activation gates are invalid")
    if config.get("requiredCheckpointProvenance") != (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    ):
        raise ValueError("direct clean-latent Stage 0 checkpoint format is invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != DIRECT_CLEAN_LATENT_STAGE0_MODE_ID
        or mode.execution_kind != "full_training_stage0"
        or mode.adapter_binding != "direct_clean_latent_full_training_adapter"
        or mode.active_execution is not True
    ):
        raise ValueError("direct clean-latent Stage 0 Mode Registry binding is invalid")
    return {
        "status": "direct_clean_latent_stage0_active_contract_valid",
        "modeId": mode.mode_id,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }

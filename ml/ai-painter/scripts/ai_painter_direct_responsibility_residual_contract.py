from __future__ import annotations

from copy import deepcopy

from ai_painter_direct_clean_latent_contract import (
    DIRECT_CLEAN_LATENT_ARCHITECTURE,
    FROZEN_SPLIT_COUNTS,
    FROZEN_LOSS_SUPPORT,
    INACTIVE_GATE_KEYS,
    SMOKE_ACTIVE_GATES,
    SMOKE_PREVIEW_EPOCHS,
    SMOKE_RESOLUTION,
    SMOKE_SAMPLE_ID,
    SMOKE_SEED,
    STAGE0_ACTIVE_GATES,
    STAGE0_EPOCHS,
    STAGE0_PREVIEW_EPOCHS,
    STAGE0_RESOLUTION,
    compile_direct_clean_latent_cpu_inactive_config,
)
from ai_painter_stage_mode_registry import (
    DIRECT_RESPONSIBILITY_RESIDUAL_STAGE0_FULL_TRAINING_STATUS,
    DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS,
    DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS,
    resolve_stage_mode,
)


DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE = (
    "stage4_direct_condition_clean_latent_responsibility_residual_v1"
)
DIRECT_RESPONSIBILITY_RESIDUAL_MODE_ID = (
    "direct_responsibility_residual_stage4_inactive"
)
RESPONSIBILITY_ORDER = (
    "terrain_path_ground",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
PARAMETERS_PER_HEAD = 64 * 12 * 3 * 3 + 12
TOTAL_ADDED_PARAMETERS = len(RESPONSIBILITY_ORDER) * PARAMETERS_PER_HEAD
DIRECT_RESPONSIBILITY_RESIDUAL_SMOKE_MODE_ID = (
    "direct_responsibility_residual_stage4_smoke"
)
DIRECT_RESPONSIBILITY_RESIDUAL_STAGE0_MODE_ID = (
    "direct_responsibility_residual_stage0_full_training"
)


def compile_direct_responsibility_residual_cpu_inactive_config(source: dict) -> dict:
    config = compile_direct_clean_latent_cpu_inactive_config(source)
    config["schemaVersion"] = (
        "ai-painter-direct-responsibility-residual-cpu-inactive-config-v1"
    )
    config["modelId"] = (
        "ai-painter-stage4-direct-clean-latent-responsibility-residual-v1"
    )
    config["architectureVersion"] = (
        "direct-clean-latent-responsibility-residual-v1"
    )
    config["denoiserArchitecture"] = DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE
    config["training"]["trainingAuthorizationStatus"] = (
        DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS
    )
    config["directResponsibilityResidualContract"] = {
        "baseArchitecture": DIRECT_CLEAN_LATENT_ARCHITECTURE,
        "responsibilityIdentityOrder": list(RESPONSIBILITY_ORDER),
        "maskSourceIdentityOrder": list(RESPONSIBILITY_ORDER),
        "headInputChannels": 64,
        "headOutputChannels": 12,
        "headKernelSize": 3,
        "headPadding": 1,
        "headBias": True,
        "parameterCountPerHead": PARAMETERS_PER_HEAD,
        "headCount": len(RESPONSIBILITY_ORDER),
        "totalAddedParameterCount": TOTAL_ADDED_PARAMETERS,
        "merge": "base_clean_latent_plus_sum_of_mask_gated_residuals",
        "outsideMaskMutationAllowed": False,
        "trainableParametersSharedAcrossResponsibilities": False,
        "waterSpecificHeadPresent": False,
        "freeBlendWeightsPresent": False,
        "newLossTermAdded": False,
        "activationGate": False,
    }
    validate_direct_responsibility_residual_cpu_inactive_config(config)
    return config


def validate_direct_responsibility_residual_cpu_inactive_config(config: dict) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-direct-responsibility-residual-cpu-inactive-config-v1"
    ):
        raise ValueError("responsibility residual config schema is invalid")
    if config.get("status") != "cpu_supported_inactive":
        raise ValueError("responsibility residual config must remain inactive")
    if config.get("denoiserArchitecture") != DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE:
        raise ValueError("responsibility residual architecture identity is invalid")
    if config.get("conditionChannels") != 23 or config.get("latentChannels") != 12:
        raise ValueError("responsibility residual channel boundary is invalid")
    if config.get("latentDownsampleFactor") != 4 or config.get("denoiserBaseChannels") != 64:
        raise ValueError("responsibility residual spatial or width boundary is invalid")
    training = config.get("training", {})
    gates = training.get("activationGates", {})
    if set(gates) != set(INACTIVE_GATE_KEYS) or any(gates.values()):
        raise ValueError("responsibility residual activation gates must all be false")
    if "velocity" in training.get("denoiserLossWeights", {}) or (
        "velocityPredictionMse" in training.get("bestCheckpointMetricWeights", {})
    ):
        raise ValueError("responsibility residual config reintroduced diffusion Loss")
    if not {"cleanLatent", "decodedRgb"}.issubset(training.get("denoiserLossWeights", {})):
        raise ValueError("existing direct supervision is missing")
    contract = config.get("directResponsibilityResidualContract", {})
    expected = {
        "baseArchitecture": DIRECT_CLEAN_LATENT_ARCHITECTURE,
        "responsibilityIdentityOrder": list(RESPONSIBILITY_ORDER),
        "maskSourceIdentityOrder": list(RESPONSIBILITY_ORDER),
        "headInputChannels": 64,
        "headOutputChannels": 12,
        "headKernelSize": 3,
        "headPadding": 1,
        "headBias": True,
        "parameterCountPerHead": PARAMETERS_PER_HEAD,
        "headCount": 5,
        "totalAddedParameterCount": TOTAL_ADDED_PARAMETERS,
        "merge": "base_clean_latent_plus_sum_of_mask_gated_residuals",
        "outsideMaskMutationAllowed": False,
        "trainableParametersSharedAcrossResponsibilities": False,
        "waterSpecificHeadPresent": False,
        "freeBlendWeightsPresent": False,
        "newLossTermAdded": False,
        "activationGate": False,
    }
    if contract != expected:
        raise ValueError("responsibility residual structure contract is invalid")
    if "terrain_water" in contract["responsibilityIdentityOrder"]:
        raise ValueError("water must remain a learned base responsibility")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != DIRECT_RESPONSIBILITY_RESIDUAL_MODE_ID
        or mode.execution_kind != "cpu_inactive"
        or mode.active_execution
    ):
        raise ValueError("responsibility residual Mode Registry binding is invalid")
    return {
        "status": "direct_responsibility_residual_cpu_inactive_contract_valid",
        "modeId": mode.mode_id,
        "architecture": mode.architecture,
        "activationGate": False,
    }


def compile_direct_responsibility_residual_smoke_active_config(
    inactive: dict,
    smoke_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    validate_direct_responsibility_residual_cpu_inactive_config(inactive)
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("responsibility residual Smoke ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = (
        "ai-painter-direct-responsibility-residual-smoke-active-config-v1"
    )
    active["status"] = "active_local_ai_internal_capability"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        DIRECT_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS
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
    execution = smoke_contract.get("executionIdentity", {})
    training["directResponsibilityResidualControlledSmoke"] = {
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
        "ticketState": ticket_state,
        "automaticReviewAfterTraining": True,
        "automaticFailureClassification": True,
        "automaticTerminalRecording": True,
        "automaticRetry": False,
    }
    training["activationGates"] = {
        key: ticket_state == "consumed" and key in SMOKE_ACTIVE_GATES
        for key in INACTIVE_GATE_KEYS
    }
    validate_direct_responsibility_residual_smoke_active_config(
        active, smoke_contract
    )
    return active


def validate_direct_responsibility_residual_smoke_active_config(
    config: dict,
    smoke_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-direct-responsibility-residual-smoke-active-config-v1"
    ):
        raise ValueError("responsibility residual Smoke schema is invalid")
    if config.get("status") != "active_local_ai_internal_capability":
        raise ValueError("responsibility residual Smoke status is invalid")
    if config.get("denoiserArchitecture") != DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE:
        raise ValueError("responsibility residual Smoke architecture is invalid")
    if smoke_contract.get("schemaVersion") != (
        "stage4-direct-responsibility-residual-controlled-smoke-contract-v1"
    ) or smoke_contract.get("status") != "compiled_not_started":
        raise ValueError("responsibility residual Smoke contract identity is invalid")
    execution = smoke_contract.get("executionIdentity", {})
    training = config.get("training", {})
    smoke = training.get("directResponsibilityResidualControlledSmoke", {})
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
    }
    if any(smoke.get(key) != value for key, value in expected.items()):
        raise ValueError("responsibility residual Smoke execution identity is invalid")
    if training.get("batchSize") != 1 or training.get("denoiserEpochs") != 30:
        raise ValueError("responsibility residual Smoke schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("responsibility residual Smoke learning rate is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"responsibility residual frozen Loss support changed: {key}")
    contract = config.get("directResponsibilityResidualContract", {})
    if contract.get("totalAddedParameterCount") != TOTAL_ADDED_PARAMETERS:
        raise ValueError("responsibility residual parameter contract changed")
    ticket_state = smoke.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("responsibility residual Smoke ticket state is invalid")
    gates = training.get("activationGates", {})
    expected_true = SMOKE_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true:
        raise ValueError("responsibility residual Smoke activation gates are invalid")
    if any(
        smoke.get(key) is not expected_value
        for key, expected_value in (
            ("automaticReviewAfterTraining", True),
            ("automaticFailureClassification", True),
            ("automaticTerminalRecording", True),
            ("automaticRetry", False),
        )
    ):
        raise ValueError("responsibility residual autonomous closure is invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != DIRECT_RESPONSIBILITY_RESIDUAL_SMOKE_MODE_ID
        or mode.execution_kind != "single_sample_smoke"
        or mode.active_execution is not True
    ):
        raise ValueError("responsibility residual Smoke Mode Registry binding is invalid")
    return {
        "status": "direct_responsibility_residual_smoke_active_contract_valid",
        "modeId": mode.mode_id,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }


def compile_direct_responsibility_residual_stage0_active_config(
    inactive: dict,
    stage0_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    validate_direct_responsibility_residual_cpu_inactive_config(inactive)
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("responsibility residual Stage 0 ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = (
        "ai-painter-direct-responsibility-residual-stage0-active-config-v1"
    )
    active["status"] = "active_local_ai_stage0_full_training"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    active["ownerAuthorizationRequired"] = False
    active["ownerResponseRequired"] = False
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        DIRECT_RESPONSIBILITY_RESIDUAL_STAGE0_FULL_TRAINING_STATUS
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
    training["directResponsibilityResidualFormalStage0"] = {
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
    validate_direct_responsibility_residual_stage0_active_config(
        active, stage0_contract
    )
    return active


def validate_direct_responsibility_residual_stage0_active_config(
    config: dict,
    stage0_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-direct-responsibility-residual-stage0-active-config-v1"
    ):
        raise ValueError("responsibility residual Stage 0 schema is invalid")
    if config.get("status") != "active_local_ai_stage0_full_training":
        raise ValueError("responsibility residual Stage 0 status is invalid")
    if config.get("denoiserArchitecture") != DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE:
        raise ValueError("responsibility residual Stage 0 architecture is invalid")
    if config.get("ownerAuthorizationRequired") is not False or config.get(
        "ownerResponseRequired"
    ) is not False:
        raise ValueError("responsibility residual Stage 0 cannot require Owner")
    if stage0_contract.get("schemaVersion") != (
        "stage4-direct-responsibility-residual-formal-stage0-contract-v1"
    ) or stage0_contract.get("status") != "compiled_not_started":
        raise ValueError("responsibility residual Stage 0 contract is invalid")
    execution = stage0_contract.get("executionIdentity", {})
    training = config.get("training", {})
    formal_stage0 = training.get("directResponsibilityResidualFormalStage0", {})
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
        raise ValueError("responsibility residual Stage 0 identity is invalid")
    if training.get("batchSize") != 1 or training.get("denoiserEpochs") != 40:
        raise ValueError("responsibility residual Stage 0 schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("responsibility residual Stage 0 learning rate is invalid")
    if training.get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("responsibility residual Stage 0 split identity is invalid")
    if training.get("denoiserLossVersion") != (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    ) or training.get("bestCheckpointMetric") != (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    ):
        raise ValueError("responsibility residual Stage 0 Loss identity is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"responsibility residual Stage 0 Loss changed: {key}")
    if "velocity" in training.get("denoiserLossWeights", {}) or (
        "velocityPredictionMse" in training.get("bestCheckpointMetricWeights", {})
    ):
        raise ValueError("responsibility residual Stage 0 reintroduced diffusion Loss")
    structure = config.get("directResponsibilityResidualContract", {})
    if (
        structure.get("responsibilityIdentityOrder") != list(RESPONSIBILITY_ORDER)
        or structure.get("maskSourceIdentityOrder") != list(RESPONSIBILITY_ORDER)
        or structure.get("totalAddedParameterCount") != TOTAL_ADDED_PARAMETERS
        or structure.get("trainableParametersSharedAcrossResponsibilities") is not False
        or structure.get("outsideMaskMutationAllowed") is not False
        or structure.get("newLossTermAdded") is not False
        or structure.get("historicalCheckpointAllowed", False) is not False
    ):
        raise ValueError("responsibility residual Stage 0 structure contract changed")
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
        raise ValueError("responsibility residual Stage 0 closure is invalid")
    ticket_state = formal_stage0.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("responsibility residual Stage 0 ticket is invalid")
    gates = training.get("activationGates", {})
    expected_true = STAGE0_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true:
        raise ValueError("responsibility residual Stage 0 gates are invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != DIRECT_RESPONSIBILITY_RESIDUAL_STAGE0_MODE_ID
        or mode.execution_kind != "full_training_stage0"
        or mode.adapter_binding
        != "direct_responsibility_residual_full_training_adapter"
        or mode.active_execution is not True
    ):
        raise ValueError("responsibility residual Stage 0 Mode Registry is invalid")
    return {
        "status": "direct_responsibility_residual_stage0_active_contract_valid",
        "modeId": mode.mode_id,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }

from __future__ import annotations

from copy import deepcopy

from ai_painter_direct_clean_latent_contract import (
    FROZEN_RESOLUTION_STAGES,
    FROZEN_SPLIT_COUNTS,
    FROZEN_LOSS_SUPPORT,
    INACTIVE_GATE_KEYS,
    SMOKE_ACTIVE_GATES,
    SMOKE_PREVIEW_EPOCHS,
    SMOKE_RESOLUTION,
    SMOKE_SAMPLE_ID,
    SMOKE_SEED,
    compile_direct_clean_latent_cpu_inactive_config,
)
from ai_painter_stage_mode_registry import (
    NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS,
    NATIVE_CONDITION_ENCODER_STAGE4_SMOKE_STATUS,
    resolve_stage_mode,
)


NATIVE_CONDITION_ENCODER_ARCHITECTURE = (
    "stage4_native_condition_encoder_clean_latent_generator_v1"
)
NATIVE_CONDITION_ENCODER_MODE_ID = "native_condition_encoder_stage4_inactive"
NATIVE_CONDITION_ENCODER_SMOKE_MODE_ID = "native_condition_encoder_stage4_smoke"
NATIVE_ENCODER_STRUCTURE = {
    "inputIdentity": "formal_typed_23_channel_conditions_at_native_stage_resolution",
    "stem": "Conv2d(23,64,3,padding=1,bias=true)->SiLU->ResidualBlock(64)",
    "down1": "Conv2d(64,128,4,stride=2,padding=1,bias=true)->ResidualBlock(128)",
    "down2": "Conv2d(128,256,4,stride=2,padding=1,bias=true)->ResidualBlock(256)",
    "middle": "ResidualBlock(256)->ResidualBlock(256)",
    "output": "GroupNorm(256)->SiLU->Conv2d(256,12,3,padding=1,bias=true)",
    "widths": [64, 128, 256],
    "strideSequence": [1, 2, 2],
    "rawConditionResizeBeforeStem": False,
    "outputIdentity": "predicted_clean_12_channel_autoencoder_latent",
    "postDecodeRgbMutation": False,
    "newLossTermAdded": False,
    "freeArchitectureParameterChosen": False,
    "activationGate": False,
}


def compile_native_condition_encoder_cpu_inactive_config(source: dict) -> dict:
    if source.get("denoiserArchitecture") == (
        "stage4_direct_condition_clean_latent_responsibility_residual_v1"
    ):
        training = source["training"]
        config = {
            "conditionChannels": int(source["conditionChannels"]),
            "conditionChannelOrder": deepcopy(source["conditionChannelOrder"]),
            "conditionChannelTypes": deepcopy(source["conditionChannelTypes"]),
            "conditionResizeContract": deepcopy(source["conditionResizeContract"]),
            "autoencoderArchitecture": str(source["autoencoderArchitecture"]),
            "autoencoderSourceModelId": str(source["autoencoderSourceModelId"]),
            "autoencoderSourceArchitectureVersion": str(source["autoencoderSourceArchitectureVersion"]),
            "autoencoderRequiredCheckpointProvenance": str(source["autoencoderRequiredCheckpointProvenance"]),
            "latentChannels": int(source["latentChannels"]),
            "latentDownsampleFactor": int(source["latentDownsampleFactor"]),
            "baseChannels": int(source["baseChannels"]),
            "denoiserBaseChannels": int(source["denoiserBaseChannels"]),
            "predictionTarget": "clean_autoencoder_latent",
            "formalInferenceEligible": False,
            "capabilityCandidateOnly": True,
            "ownerAuthorizationRequired": False,
            "ownerResponseRequired": False,
            "training": {
                "dataCapacityDecision": deepcopy(training["dataCapacityDecision"]),
                "splitCounts": deepcopy(FROZEN_SPLIT_COUNTS),
                "resolutionStages": deepcopy(list(FROZEN_RESOLUTION_STAGES)),
                "seed": int(training["seed"]),
                "denoiserLossWeights": deepcopy(training["denoiserLossWeights"]),
                "bestCheckpointMetricWeights": deepcopy(training["bestCheckpointMetricWeights"]),
                "activationGates": {key: False for key in INACTIVE_GATE_KEYS},
            },
        }
    else:
        config = compile_direct_clean_latent_cpu_inactive_config(source)
    config["schemaVersion"] = (
        "ai-painter-native-condition-encoder-cpu-inactive-config-v1"
    )
    config["status"] = "cpu_supported_inactive"
    config["modelId"] = (
        "ai-painter-stage4-native-condition-encoder-clean-latent-v1"
    )
    config["architectureVersion"] = (
        "native-condition-encoder-clean-latent-v1"
    )
    config["denoiserArchitecture"] = NATIVE_CONDITION_ENCODER_ARCHITECTURE
    config["training"]["trainingAuthorizationStatus"] = (
        NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS
    )
    config.pop("directCleanLatentContract", None)
    config["nativeConditionEncoderContract"] = dict(NATIVE_ENCODER_STRUCTURE)
    validate_native_condition_encoder_cpu_inactive_config(config)
    return config


def validate_native_condition_encoder_cpu_inactive_config(config: dict) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-native-condition-encoder-cpu-inactive-config-v1"
    ):
        raise ValueError("native condition encoder config schema is invalid")
    if config.get("status") != "cpu_supported_inactive":
        raise ValueError("native condition encoder config must remain inactive")
    if config.get("denoiserArchitecture") != NATIVE_CONDITION_ENCODER_ARCHITECTURE:
        raise ValueError("native condition encoder architecture identity is invalid")
    if config.get("conditionChannels") != 23 or config.get("latentChannels") != 12:
        raise ValueError("native condition encoder channel boundary is invalid")
    if config.get("latentDownsampleFactor") != 4:
        raise ValueError("native condition encoder spatial boundary is invalid")
    if config.get("denoiserBaseChannels") != 64:
        raise ValueError("native condition encoder base width is invalid")
    if config.get("autoencoderArchitecture") != "residual_4x_latent_pixel_detail_v2":
        raise ValueError("native condition encoder Autoencoder boundary is invalid")
    if config.get("training", {}).get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("native condition encoder split identity is invalid")
    gates = config.get("training", {}).get("activationGates", {})
    if set(gates) != set(INACTIVE_GATE_KEYS) or any(gates.values()):
        raise ValueError("native condition encoder activation gates must all be false")
    loss_weights = config.get("training", {}).get("denoiserLossWeights", {})
    checkpoint_weights = config.get("training", {}).get(
        "bestCheckpointMetricWeights", {}
    )
    if "velocity" in loss_weights or "velocityPredictionMse" in checkpoint_weights:
        raise ValueError("native condition encoder reintroduced diffusion supervision")
    if not {"cleanLatent", "decodedRgb"}.issubset(loss_weights):
        raise ValueError("native condition encoder existing Loss identity is incomplete")
    if config.get("nativeConditionEncoderContract") != NATIVE_ENCODER_STRUCTURE:
        raise ValueError("native condition encoder structure contract is invalid")
    if "directResponsibilityResidualContract" in config:
        raise ValueError("native condition encoder cannot retain the rejected residual route")
    forbidden = {
        "diffusionSteps",
        "inferenceSteps",
        "stage4ControlledStructureArm",
        "stage4ResponsibilityComponentRole",
        "postDecodeResponsibilityIdentityOrder",
    }
    if forbidden.intersection(config):
        raise ValueError("native condition encoder contains an exited-route field")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != NATIVE_CONDITION_ENCODER_MODE_ID
        or mode.execution_kind != "cpu_inactive"
        or mode.active_execution
    ):
        raise ValueError("native condition encoder Mode Registry binding is invalid")
    return {
        "status": "native_condition_encoder_cpu_inactive_contract_valid",
        "modeId": mode.mode_id,
        "architecture": mode.architecture,
        "activationGate": False,
    }


def compile_native_condition_encoder_smoke_active_config(
    inactive: dict,
    smoke_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    validate_native_condition_encoder_cpu_inactive_config(inactive)
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("native condition encoder Smoke ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = (
        "ai-painter-native-condition-encoder-smoke-active-config-v1"
    )
    active["status"] = "active_local_ai_internal_capability"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        NATIVE_CONDITION_ENCODER_STAGE4_SMOKE_STATUS
    )
    execution = smoke_contract.get("executionIdentity", {})
    epoch_count = int(execution.get("epochCount", -1))
    training["batchSize"] = 1
    training["denoiserEpochs"] = epoch_count
    training["denoiserLearningRate"] = 0.0001
    training["denoiserLossVersion"] = (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    )
    training["bestCheckpointMetric"] = (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    )
    training.update(deepcopy(FROZEN_LOSS_SUPPORT))
    training["nativeConditionEncoderControlledSmoke"] = {
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
    validate_native_condition_encoder_smoke_active_config(active, smoke_contract)
    return active


def validate_native_condition_encoder_smoke_active_config(
    config: dict,
    smoke_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-native-condition-encoder-smoke-active-config-v1"
    ):
        raise ValueError("native condition encoder Smoke schema is invalid")
    if config.get("status") != "active_local_ai_internal_capability":
        raise ValueError("native condition encoder Smoke status is invalid")
    if config.get("denoiserArchitecture") != NATIVE_CONDITION_ENCODER_ARCHITECTURE:
        raise ValueError("native condition encoder Smoke architecture is invalid")
    if config.get("nativeConditionEncoderContract") != NATIVE_ENCODER_STRUCTURE:
        raise ValueError("native condition encoder Smoke structure contract is invalid")
    contract_schema = smoke_contract.get("schemaVersion")
    if contract_schema not in {
        "stage4-native-condition-encoder-controlled-smoke-contract-v1",
        "stage4-native-condition-encoder-fixed-40-epoch-qualification-contract-v1",
    } or smoke_contract.get("status") != "compiled_not_started":
        raise ValueError("native condition encoder Smoke contract identity is invalid")
    execution = smoke_contract.get("executionIdentity", {})
    fixed_40_epoch_qualification = contract_schema == (
        "stage4-native-condition-encoder-fixed-40-epoch-qualification-contract-v1"
    )
    expected_epoch_count = 40 if fixed_40_epoch_qualification else 30
    expected_preview_epochs = (
        [1, 5, 10, 20, 30, 40]
        if fixed_40_epoch_qualification
        else list(SMOKE_PREVIEW_EPOCHS)
    )
    training = config.get("training", {})
    smoke = training.get("nativeConditionEncoderControlledSmoke", {})
    expected = {
        "runId": execution.get("runId"),
        "sampleId": SMOKE_SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SMOKE_SEED,
        "topology": "west",
        "resolutionStage": 0,
        "resolution": SMOKE_RESOLUTION,
        "epochCount": expected_epoch_count,
        "previewEpochs": expected_preview_epochs,
        "initialization": "fixed_random_denoiser_initialization_only",
        "autoencoderFrozen": True,
    }
    if any(smoke.get(key) != value for key, value in expected.items()):
        raise ValueError("native condition encoder Smoke execution identity is invalid")
    if (
        training.get("batchSize") != 1
        or training.get("denoiserEpochs") != expected_epoch_count
    ):
        raise ValueError("native condition encoder Smoke schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("native condition encoder Smoke learning rate is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"native condition encoder frozen Loss support changed: {key}")
    ticket_state = smoke.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("native condition encoder Smoke ticket state is invalid")
    gates = training.get("activationGates", {})
    expected_true = SMOKE_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true:
        raise ValueError("native condition encoder Smoke activation gates are invalid")
    if any(
        smoke.get(key) is not expected_value
        for key, expected_value in (
            ("automaticReviewAfterTraining", True),
            ("automaticFailureClassification", True),
            ("automaticTerminalRecording", True),
            ("automaticRetry", False),
        )
    ):
        raise ValueError("native condition encoder autonomous closure is invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != NATIVE_CONDITION_ENCODER_SMOKE_MODE_ID
        or mode.execution_kind != "single_sample_smoke"
        or mode.active_execution is not True
    ):
        raise ValueError("native condition encoder Smoke Mode Registry binding is invalid")
    return {
        "status": "native_condition_encoder_smoke_active_contract_valid",
        "modeId": mode.mode_id,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }

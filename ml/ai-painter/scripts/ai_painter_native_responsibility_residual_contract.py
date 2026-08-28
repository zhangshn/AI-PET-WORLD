from __future__ import annotations

from copy import deepcopy
import hashlib
import json

from ai_painter_native_condition_encoder_contract import (
    NATIVE_CONDITION_ENCODER_ARCHITECTURE,
    NATIVE_CONDITION_ENCODER_MODE_ID,
    NATIVE_ENCODER_STRUCTURE,
    compile_native_condition_encoder_cpu_inactive_config,
    validate_native_condition_encoder_cpu_inactive_config,
)
from ai_painter_direct_clean_latent_contract import (
    FROZEN_LOSS_SUPPORT,
    INACTIVE_GATE_KEYS,
    SMOKE_ACTIVE_GATES,
    SMOKE_PREVIEW_EPOCHS,
    SMOKE_RESOLUTION,
    SMOKE_SAMPLE_ID,
    SMOKE_SEED,
)
from ai_painter_stage_mode_registry import (
    NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS,
    NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS,
    NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS,
    resolve_stage_mode,
)


NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE = (
    "stage4_native_condition_encoder_masked_responsibility_residual_v1"
)
NATIVE_RESPONSIBILITY_RESIDUAL_MODE_ID = (
    "native_responsibility_residual_stage4_inactive"
)
NATIVE_RESPONSIBILITY_RESIDUAL_SMOKE_MODE_ID = (
    "native_responsibility_residual_stage4_smoke"
)
RESPONSIBILITY_IDENTITY_ORDER = [
    "terrain_path_ground",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
]
RESPONSIBILITY_RESIDUAL_STRUCTURE = {
    "nativeEncoder": deepcopy(NATIVE_ENCODER_STRUCTURE),
    "identityOrder": list(RESPONSIBILITY_IDENTITY_ORDER),
    "eachHead": "Conv2d(256,12,3,padding=1,bias=true)",
    "maskSource": "same_formal_identity_condition_channel_resized_by_existing_typed_condition_contract_to_latent_resolution",
    "merge": "base_clean_latent_plus_sum_of_identity_masked_residuals",
    "parameterNamespace": "clean_latent_generator.responsibility_residual_heads",
    "outsideMaskMutationAllowed": False,
    "freeBlendWeightsPresent": False,
    "postDecodeRgbMutation": False,
    "newLossTermAdded": False,
    "activationGate": False,
}
FROZEN_DENOISER_LOSS_WEIGHTS_SHA256 = (
    "09fcf6fe21440e4cc28a51b1d7309163732dadf01a78f62d6e1af7a7f54c4f97"
)
FROZEN_CHECKPOINT_METRIC_WEIGHTS_SHA256 = (
    "245c9c70ce8a0967e7a4fcac9f210ff42873d70adc620d985b26a41b44a06deb"
)


def _canonical_sha256(value: dict) -> str:
    payload = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def compile_native_responsibility_residual_cpu_inactive_config(
    source: dict,
) -> dict:
    config = compile_native_condition_encoder_cpu_inactive_config(source)
    config["schemaVersion"] = (
        "ai-painter-native-responsibility-residual-cpu-inactive-config-v1"
    )
    config["modelId"] = (
        "ai-painter-stage4-native-condition-encoder-responsibility-residual-v1"
    )
    config["architectureVersion"] = (
        "native-condition-encoder-responsibility-residual-v1"
    )
    config["denoiserArchitecture"] = NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE
    config["training"]["trainingAuthorizationStatus"] = (
        NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_INACTIVE_STATUS
    )
    config["nativeResponsibilityResidualContract"] = deepcopy(
        RESPONSIBILITY_RESIDUAL_STRUCTURE
    )
    validate_native_responsibility_residual_cpu_inactive_config(config)
    return config


def validate_native_responsibility_residual_cpu_inactive_config(
    config: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-native-responsibility-residual-cpu-inactive-config-v1"
    ):
        raise ValueError("native responsibility residual schema is invalid")
    if config.get("status") != "cpu_supported_inactive":
        raise ValueError("native responsibility residual config must remain inactive")
    if config.get("denoiserArchitecture") != (
        NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE
    ):
        raise ValueError("native responsibility residual architecture is invalid")
    if config.get("nativeResponsibilityResidualContract") != (
        RESPONSIBILITY_RESIDUAL_STRUCTURE
    ):
        raise ValueError("native responsibility residual structure is invalid")
    training = config.get("training", {})
    if _canonical_sha256(training.get("denoiserLossWeights", {})) != (
        FROZEN_DENOISER_LOSS_WEIGHTS_SHA256
    ):
        raise ValueError("native responsibility residual Loss identity changed")
    if _canonical_sha256(training.get("bestCheckpointMetricWeights", {})) != (
        FROZEN_CHECKPOINT_METRIC_WEIGHTS_SHA256
    ):
        raise ValueError("native responsibility residual checkpoint identity changed")
    base = deepcopy(config)
    base["schemaVersion"] = (
        "ai-painter-native-condition-encoder-cpu-inactive-config-v1"
    )
    base["modelId"] = "ai-painter-stage4-native-condition-encoder-clean-latent-v1"
    base["architectureVersion"] = "native-condition-encoder-clean-latent-v1"
    base["denoiserArchitecture"] = NATIVE_CONDITION_ENCODER_ARCHITECTURE
    base["training"]["trainingAuthorizationStatus"] = (
        NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS
    )
    base.pop("nativeResponsibilityResidualContract", None)
    validate_native_condition_encoder_cpu_inactive_config(base)
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != NATIVE_RESPONSIBILITY_RESIDUAL_MODE_ID
        or mode.execution_kind != "cpu_inactive"
        or mode.active_execution
    ):
        raise ValueError("native responsibility residual Mode Registry binding is invalid")
    return {
        "status": "native_responsibility_residual_cpu_inactive_contract_valid",
        "modeId": mode.mode_id,
        "architecture": mode.architecture,
        "activationGate": False,
    }


def compile_native_responsibility_residual_smoke_active_config(
    inactive: dict,
    smoke_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    validate_native_responsibility_residual_cpu_inactive_config(inactive)
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("native responsibility residual Smoke ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = (
        "ai-painter-native-responsibility-residual-smoke-active-config-v1"
    )
    active["status"] = "active_local_ai_internal_capability"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        NATIVE_RESPONSIBILITY_RESIDUAL_STAGE4_SMOKE_STATUS
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
    training["nativeResponsibilityResidualControlledSmoke"] = {
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
    validate_native_responsibility_residual_smoke_active_config(
        active, smoke_contract
    )
    return active


def validate_native_responsibility_residual_smoke_active_config(
    config: dict,
    smoke_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-native-responsibility-residual-smoke-active-config-v1"
    ):
        raise ValueError("native responsibility residual Smoke schema is invalid")
    if config.get("status") != "active_local_ai_internal_capability":
        raise ValueError("native responsibility residual Smoke status is invalid")
    if config.get("denoiserArchitecture") != NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE:
        raise ValueError("native responsibility residual Smoke architecture is invalid")
    if config.get("nativeConditionEncoderContract") != NATIVE_ENCODER_STRUCTURE:
        raise ValueError("native responsibility residual native encoder changed")
    if config.get("nativeResponsibilityResidualContract") != RESPONSIBILITY_RESIDUAL_STRUCTURE:
        raise ValueError("native responsibility residual structure changed")
    if smoke_contract.get("schemaVersion") != (
        "stage4-native-responsibility-residual-controlled-smoke-contract-v1"
    ) or smoke_contract.get("status") != "compiled_not_started":
        raise ValueError("native responsibility residual Smoke contract is invalid")
    execution = smoke_contract.get("executionIdentity", {})
    training = config.get("training", {})
    smoke = training.get("nativeResponsibilityResidualControlledSmoke", {})
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
        raise ValueError("native responsibility residual Smoke identity is invalid")
    if training.get("batchSize") != 1 or training.get("denoiserEpochs") != 30:
        raise ValueError("native responsibility residual Smoke schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("native responsibility residual Smoke learning rate is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"native responsibility residual frozen Loss changed: {key}")
    if _canonical_sha256(training.get("denoiserLossWeights", {})) != FROZEN_DENOISER_LOSS_WEIGHTS_SHA256:
        raise ValueError("native responsibility residual Smoke Loss identity changed")
    if _canonical_sha256(training.get("bestCheckpointMetricWeights", {})) != FROZEN_CHECKPOINT_METRIC_WEIGHTS_SHA256:
        raise ValueError("native responsibility residual Smoke checkpoint identity changed")
    ticket_state = smoke.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("native responsibility residual Smoke ticket state is invalid")
    gates = training.get("activationGates", {})
    expected_true = SMOKE_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true:
        raise ValueError("native responsibility residual Smoke gates are invalid")
    if any(
        smoke.get(key) is not expected_value
        for key, expected_value in (
            ("automaticReviewAfterTraining", True),
            ("automaticFailureClassification", True),
            ("automaticTerminalRecording", True),
            ("automaticRetry", False),
        )
    ):
        raise ValueError("native responsibility residual autonomous closure is invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != NATIVE_RESPONSIBILITY_RESIDUAL_SMOKE_MODE_ID
        or mode.execution_kind != "single_sample_smoke"
        or mode.active_execution is not True
    ):
        raise ValueError("native responsibility residual Smoke Mode Registry binding is invalid")
    return {
        "status": "native_responsibility_residual_smoke_active_contract_valid",
        "modeId": mode.mode_id,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }

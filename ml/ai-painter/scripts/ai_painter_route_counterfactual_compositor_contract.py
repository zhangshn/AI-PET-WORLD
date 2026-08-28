from __future__ import annotations

from copy import deepcopy
import hashlib
import json

from ai_painter_direct_clean_latent_contract import (
    FROZEN_LOSS_SUPPORT,
    INACTIVE_GATE_KEYS,
    SMOKE_ACTIVE_GATES,
    SMOKE_PREVIEW_EPOCHS,
    SMOKE_RESOLUTION,
    SMOKE_SAMPLE_ID,
    SMOKE_SEED,
)
from ai_painter_native_condition_encoder_contract import (
    NATIVE_CONDITION_ENCODER_ARCHITECTURE,
    NATIVE_ENCODER_STRUCTURE,
    compile_native_condition_encoder_cpu_inactive_config,
    validate_native_condition_encoder_cpu_inactive_config,
)
from ai_painter_stage_mode_registry import (
    NATIVE_CONDITION_ENCODER_STAGE4_INACTIVE_STATUS,
    ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_INACTIVE_STATUS,
    ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_SMOKE_STATUS,
    resolve_stage_mode,
)


ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE = (
    "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
)
ROUTE_COUNTERFACTUAL_COMPOSITOR_CAPABILITY_VERSION = (
    "stage4-native-route-counterfactual-compositor-change-candidate-v1"
)
ROUTE_COUNTERFACTUAL_COMPOSITOR_FIXED_40_CAPABILITY_VERSION = (
    "stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1"
)
ROUTE_COUNTERFACTUAL_COMPOSITOR_MODE_ID = (
    "route_counterfactual_compositor_stage4_inactive"
)
ROUTE_COUNTERFACTUAL_COMPOSITOR_SMOKE_MODE_ID = (
    "route_counterfactual_compositor_stage4_smoke"
)
COUNTERFACTUAL_DERIVED_CHANNELS = (
    "terrain_grass",
    "terrain_path_ground",
    "signed_distance_path",
)
ROUTE_COUNTERFACTUAL_CONTROLLED_SMOKE_SCHEMA = (
    "stage4-route-counterfactual-compositor-controlled-smoke-contract-v1"
)
ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA = (
    "stage4-route-counterfactual-compositor-fixed-40-epoch-qualification-contract-v1"
)
ROUTE_COUNTERFACTUAL_FIXED_40_PREVIEW_EPOCHS = (1, 5, 10, 20, 30, 40)
ROUTE_COUNTERFACTUAL_STRUCTURE = {
    "nativeEncoder": deepcopy(NATIVE_ENCODER_STRUCTURE),
    "parameterCopies": 1,
    "additionalTrainableParameters": 0,
    "fullRouteLatent": "F(original_conditions)",
    "noRouteLatent": "F(formally_derived_no_route_conditions)",
    "routeMaskSource": (
        "terrain_path_ground_resized_by_existing_typed_condition_contract_and_detached"
    ),
    "merge": "no_route_latent_plus_route_mask_times_full_route_latent_minus_no_route_latent",
    "noRouteDerivation": {
        "terrain_path_ground": "strict_zero",
        "signed_distance_path": "one_divided_by_255",
        "terrain_grass": "elementwise_max_original_grass_original_path",
        "otherChannels": "strict_identity",
    },
    "routeBundleContributionOutsideMask": "strict_zero",
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


def compile_route_counterfactual_compositor_cpu_inactive_config(
    source: dict,
) -> dict:
    config = compile_native_condition_encoder_cpu_inactive_config(source)
    config["schemaVersion"] = (
        "ai-painter-route-counterfactual-compositor-cpu-inactive-config-v1"
    )
    config["modelId"] = (
        "ai-painter-stage4-native-route-counterfactual-compositor-v1"
    )
    config["architectureVersion"] = (
        "native-shared-weight-route-counterfactual-compositor-v1"
    )
    config["denoiserArchitecture"] = (
        ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE
    )
    config["training"]["trainingAuthorizationStatus"] = (
        ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_INACTIVE_STATUS
    )
    config["routeCounterfactualCompositorContract"] = deepcopy(
        ROUTE_COUNTERFACTUAL_STRUCTURE
    )
    validate_route_counterfactual_compositor_cpu_inactive_config(config)
    return config


def validate_route_counterfactual_compositor_cpu_inactive_config(
    config: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-route-counterfactual-compositor-cpu-inactive-config-v1"
    ):
        raise ValueError("route counterfactual compositor schema is invalid")
    if config.get("status") != "cpu_supported_inactive":
        raise ValueError("route counterfactual compositor must remain inactive")
    if config.get("denoiserArchitecture") != (
        ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE
    ):
        raise ValueError("route counterfactual compositor architecture is invalid")
    if config.get("routeCounterfactualCompositorContract") != (
        ROUTE_COUNTERFACTUAL_STRUCTURE
    ):
        raise ValueError("route counterfactual compositor structure is invalid")
    if config.get("nativeConditionEncoderContract") != NATIVE_ENCODER_STRUCTURE:
        raise ValueError("route counterfactual compositor native encoder changed")
    if config.get("conditionChannels") != 23 or config.get("latentChannels") != 12:
        raise ValueError("route counterfactual compositor channel boundary changed")
    if config.get("latentDownsampleFactor") != 4:
        raise ValueError("route counterfactual compositor spatial boundary changed")
    training = config.get("training", {})
    if _canonical_sha256(training.get("denoiserLossWeights", {})) != (
        FROZEN_DENOISER_LOSS_WEIGHTS_SHA256
    ):
        raise ValueError("route counterfactual compositor Loss identity changed")
    if _canonical_sha256(training.get("bestCheckpointMetricWeights", {})) != (
        FROZEN_CHECKPOINT_METRIC_WEIGHTS_SHA256
    ):
        raise ValueError("route counterfactual checkpoint identity changed")
    forbidden = {
        "nativeResponsibilityResidualContract",
        "directResponsibilityResidualContract",
        "postDecodeResponsibilityIdentityOrder",
        "stage4ControlledStructureArm",
    }
    if forbidden.intersection(config):
        raise ValueError("route counterfactual compositor retained an exited route")
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
    base.pop("routeCounterfactualCompositorContract", None)
    validate_native_condition_encoder_cpu_inactive_config(base)
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != ROUTE_COUNTERFACTUAL_COMPOSITOR_MODE_ID
        or mode.execution_kind != "cpu_inactive"
        or mode.active_execution
    ):
        raise ValueError("route counterfactual compositor Mode Registry binding is invalid")
    return {
        "status": "route_counterfactual_compositor_cpu_inactive_contract_valid",
        "modeId": mode.mode_id,
        "architecture": mode.architecture,
        "activationGate": False,
    }


def compile_route_counterfactual_compositor_smoke_active_config(
    inactive: dict,
    smoke_contract: dict,
    *,
    ticket_state: str,
) -> dict:
    validate_route_counterfactual_compositor_cpu_inactive_config(inactive)
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("route counterfactual Smoke ticket state is invalid")
    active = deepcopy(inactive)
    active["schemaVersion"] = (
        "ai-painter-route-counterfactual-compositor-smoke-active-config-v1"
    )
    active["status"] = "active_local_ai_internal_capability"
    active["requiredCheckpointProvenance"] = (
        "project-owned-ai-assisted-cold-start-checkpoint-v7"
    )
    training = active["training"]
    training["trainingAuthorizationStatus"] = (
        ROUTE_COUNTERFACTUAL_COMPOSITOR_STAGE4_SMOKE_STATUS
    )
    training["batchSize"] = 1
    execution = smoke_contract.get("executionIdentity", {})
    training["denoiserEpochs"] = int(execution.get("epochCount", -1))
    training["denoiserLearningRate"] = 0.0001
    training["denoiserLossVersion"] = (
        "direct_clean_latent_existing_non_diffusion_losses_v1"
    )
    training["bestCheckpointMetric"] = (
        "direct_clean_latent_existing_non_diffusion_checkpoint_score_v1"
    )
    training.update(deepcopy(FROZEN_LOSS_SUPPORT))
    training["routeCounterfactualCompositorControlledSmoke"] = {
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
    validate_route_counterfactual_compositor_smoke_active_config(
        active, smoke_contract
    )
    return active


def validate_route_counterfactual_compositor_smoke_active_config(
    config: dict,
    smoke_contract: dict,
) -> dict:
    if config.get("schemaVersion") != (
        "ai-painter-route-counterfactual-compositor-smoke-active-config-v1"
    ):
        raise ValueError("route counterfactual Smoke schema is invalid")
    if config.get("status") != "active_local_ai_internal_capability":
        raise ValueError("route counterfactual Smoke status is invalid")
    if config.get("denoiserArchitecture") != (
        ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE
    ):
        raise ValueError("route counterfactual Smoke architecture is invalid")
    if config.get("routeCounterfactualCompositorContract") != (
        ROUTE_COUNTERFACTUAL_STRUCTURE
    ):
        raise ValueError("route counterfactual Smoke structure changed")
    contract_schema = smoke_contract.get("schemaVersion")
    if contract_schema not in {
        ROUTE_COUNTERFACTUAL_CONTROLLED_SMOKE_SCHEMA,
        ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA,
    } or smoke_contract.get("status") != "compiled_not_started":
        raise ValueError("route counterfactual Smoke contract is invalid")
    fixed_40_epoch_qualification = (
        contract_schema == ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA
    )
    expected_capability_version = (
        ROUTE_COUNTERFACTUAL_COMPOSITOR_FIXED_40_CAPABILITY_VERSION
        if fixed_40_epoch_qualification
        else ROUTE_COUNTERFACTUAL_COMPOSITOR_CAPABILITY_VERSION
    )
    expected_epoch_count = 40 if fixed_40_epoch_qualification else 30
    expected_preview_epochs = (
        list(ROUTE_COUNTERFACTUAL_FIXED_40_PREVIEW_EPOCHS)
        if fixed_40_epoch_qualification
        else list(SMOKE_PREVIEW_EPOCHS)
    )
    if (
        smoke_contract.get("capabilityVersion")
        != expected_capability_version
        or smoke_contract.get("architecture")
        != ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE
    ):
        raise ValueError("route counterfactual Smoke capability identity is invalid")
    if smoke_contract.get("dataIdentity") != {
        "approvedRecordCount": 64,
        "splitCounts": {
            "train": 48,
            "validation": 8,
            "challenge": 4,
            "regression": 4,
        },
    }:
        raise ValueError("route counterfactual Smoke data identity is invalid")
    if smoke_contract.get("closure") != {
        "automaticMachineReview": True,
        "automaticLateStabilityQualification": True,
        "automaticTerminalRecording": True,
        "automaticRetry": False,
    } or smoke_contract.get("ownerAuthorizationRequired") is not False:
        raise ValueError("route counterfactual Smoke closure identity is invalid")
    execution = smoke_contract.get("executionIdentity", {})
    smoke = config.get("training", {}).get(
        "routeCounterfactualCompositorControlledSmoke", {}
    )
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
        raise ValueError("route counterfactual Smoke identity is invalid")
    training = config.get("training", {})
    if _canonical_sha256(training.get("denoiserLossWeights", {})) != (
        FROZEN_DENOISER_LOSS_WEIGHTS_SHA256
    ):
        raise ValueError("route counterfactual Smoke Loss identity changed")
    if _canonical_sha256(training.get("bestCheckpointMetricWeights", {})) != (
        FROZEN_CHECKPOINT_METRIC_WEIGHTS_SHA256
    ):
        raise ValueError("route counterfactual Smoke checkpoint identity changed")
    if (
        training.get("batchSize") != 1
        or training.get("denoiserEpochs") != expected_epoch_count
    ):
        raise ValueError("route counterfactual Smoke schedule is invalid")
    if training.get("denoiserLearningRate") != 0.0001:
        raise ValueError("route counterfactual Smoke learning rate is invalid")
    for key, value in FROZEN_LOSS_SUPPORT.items():
        if training.get(key) != value:
            raise ValueError(f"route counterfactual frozen Loss changed: {key}")
    ticket_state = smoke.get("ticketState")
    if ticket_state not in {"preflight_unconsumed", "consumed"}:
        raise ValueError("route counterfactual Smoke ticket state is invalid")
    gates = training.get("activationGates", {})
    expected_true = SMOKE_ACTIVE_GATES if ticket_state == "consumed" else set()
    if set(gates) != set(INACTIVE_GATE_KEYS) or {
        key for key, value in gates.items() if value is True
    } != expected_true:
        raise ValueError("route counterfactual Smoke gates are invalid")
    if any(
        smoke.get(key) is not expected
        for key, expected in (
            ("automaticReviewAfterTraining", True),
            ("automaticFailureClassification", True),
            ("automaticTerminalRecording", True),
            ("automaticRetry", False),
        )
    ):
        raise ValueError("route counterfactual autonomous closure is invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != ROUTE_COUNTERFACTUAL_COMPOSITOR_SMOKE_MODE_ID
        or mode.execution_kind != "single_sample_smoke"
        or mode.active_execution is not True
    ):
        raise ValueError("route counterfactual Smoke Mode Registry binding is invalid")
    return {
        "status": "route_counterfactual_compositor_smoke_active_contract_valid",
        "modeId": mode.mode_id,
        "contractSchema": contract_schema,
        "capabilityVersion": expected_capability_version,
        "epochCount": expected_epoch_count,
        "previewEpochs": expected_preview_epochs,
        "ticketState": ticket_state,
        "activationGate": ticket_state == "consumed",
    }

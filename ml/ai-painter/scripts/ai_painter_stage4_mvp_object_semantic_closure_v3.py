from __future__ import annotations

"""Immutable config support for the bounded Stage4 MVP object-closure candidate."""

from copy import deepcopy
from hashlib import sha256
import json
import math
from pathlib import Path
from typing import Any

from ai_painter_stage4_semantic_transport_v2_trainer_support import (
    ARCHITECTURE_ID,
    TRAINER_SUPPORT_BINDING_KEY,
    build_stage4_semantic_transport_v2_cpu_inactive_config,
)


CAPABILITY_VERSION = "stage4_mvp_object_semantic_closure_v3"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-object-semantic-closure-v3-contract.json"
)
CONTRACT_ID = "stage4-mvp-object-semantic-closure-v3-contract-v1"
CONFIG_BINDING_KEY = "stage4MvpObjectSemanticClosureV3"
LOSS_VERSION = "velocity_decoded_rgb_sparse_region_rollout_object_semantic_closure_v3"
CHECKPOINT_METRIC = "fixed_grid_plus_deterministic_rollout_object_semantic_closure_v3"
OBJECT_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
PYRAMID_SCALES = (1.0, 0.5, 0.25)


def _digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_bytes())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is unreadable") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _project_file(root: Path, logical: str) -> Path:
    if not isinstance(logical, str) or not logical or logical.startswith("/"):
        raise ValueError("project-relative contract path is invalid")
    parts = logical.replace("\\", "/").split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("project-relative contract path is invalid")
    path = root.joinpath(*parts).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("contract path escapes project root")
    return path


def _load_contract(root: Path) -> tuple[dict[str, Any], str]:
    path = _project_file(root, CONTRACT_PATH)
    data = path.read_bytes()
    contract = _read_json(path, "Stage4 MVP object-closure contract")
    if contract.get("schemaVersion") != CONTRACT_ID or contract.get("contractId") != CONTRACT_ID:
        raise ValueError("Stage4 MVP object-closure contract identity changed")
    if contract.get("status") != "active_bounded_mvp_candidate":
        raise ValueError("Stage4 MVP object-closure contract is not active")
    if contract.get("capabilityVersion") != CAPABILITY_VERSION:
        raise ValueError("Stage4 MVP object-closure capability changed")
    if contract.get("parentArchitecture") != ARCHITECTURE_ID:
        raise ValueError("Stage4 MVP object-closure parent architecture changed")
    return contract, _digest(data)


def _derived_object_weights(base: dict[str, Any]) -> dict[str, float]:
    training = base["training"]
    channel_weights = training["objectSemanticChannelWeights"]
    total = sum(float(channel_weights[channel]) for channel in OBJECT_CHANNELS)
    authority = float(training["denoiserLossWeights"]["objectSemanticRgb"])
    if not math.isfinite(total) or total <= 0.0 or not math.isfinite(authority) or authority <= 0.0:
        raise ValueError("Stage4 MVP object-closure source weights are invalid")
    return {
        channel: authority * float(channel_weights[channel]) / total
        for channel in OBJECT_CHANNELS
    }


def _validate_parent_bindings(root: Path, contract: dict[str, Any]) -> None:
    parents = contract.get("parentContracts")
    if not isinstance(parents, dict) or set(parents) != {
        "formalObjective", "semanticTransportV2Support"
    }:
        raise ValueError("Stage4 MVP object-closure parent bindings changed")
    for label, binding in parents.items():
        if not isinstance(binding, dict) or set(binding) != {"path", "sha256"}:
            raise ValueError(f"Stage4 MVP object-closure {label} binding is invalid")
        path = _project_file(root, binding["path"])
        if _digest(path.read_bytes()) != binding["sha256"]:
            raise ValueError(f"Stage4 MVP object-closure {label} binding is stale")


def build_stage4_mvp_object_semantic_closure_v3_config(
    root: Path | None = None,
) -> dict[str, Any]:
    root = (root or Path(__file__).resolve().parents[3]).resolve()
    base = build_stage4_semantic_transport_v2_cpu_inactive_config(root)
    contract, contract_sha = _load_contract(root)
    _validate_parent_bindings(root, contract)
    derived_weights = _derived_object_weights(base)
    if tuple(contract.get("objectChannels", ())) != OBJECT_CHANNELS:
        raise ValueError("Stage4 MVP object-closure channel order changed")
    if contract.get("objectWeights") != derived_weights:
        raise ValueError("Stage4 MVP object-closure weights are not derived from the formal objective")
    if tuple(contract.get("trainingTerms", {}).get(
        "perClassMultiscaleLuminanceStructure", {}
    ).get("scales", ())) != PYRAMID_SCALES:
        raise ValueError("Stage4 MVP object-closure pyramid changed")

    config = deepcopy(base)
    parent_support = config["training"].pop(TRAINER_SUPPORT_BINDING_KEY)
    config["training"]["denoiserLossVersion"] = LOSS_VERSION
    config["training"]["bestCheckpointMetric"] = CHECKPOINT_METRIC
    config["training"][CONFIG_BINDING_KEY] = {
        "contractId": CONTRACT_ID,
        "contractPath": CONTRACT_PATH,
        "contractSha256": contract_sha,
        "capabilityVersion": CAPABILITY_VERSION,
        "parentArchitectureSupport": parent_support,
        "objectChannels": list(OBJECT_CHANNELS),
        "objectWeights": derived_weights,
        "pyramidScales": list(PYRAMID_SCALES),
        "legalSupervision": deepcopy(contract["legalSupervision"]),
        "preservedBoundaries": deepcopy(contract["preservedBoundaries"]),
    }
    validate_stage4_mvp_object_semantic_closure_v3_config(config, root=root)
    return config


def validate_stage4_mvp_object_semantic_closure_v3_config(
    config: dict[str, Any], *, root: Path | None = None
) -> dict[str, Any]:
    root = (root or Path(__file__).resolve().parents[3]).resolve()
    contract, contract_sha = _load_contract(root)
    _validate_parent_bindings(root, contract)
    if config.get("denoiserArchitecture") != ARCHITECTURE_ID:
        raise ValueError("Stage4 MVP object-closure architecture changed")
    training = config.get("training")
    if not isinstance(training, dict):
        raise ValueError("Stage4 MVP object-closure training config is missing")
    if training.get("denoiserLossVersion") != LOSS_VERSION:
        raise ValueError("Stage4 MVP object-closure Loss identity changed")
    if training.get("bestCheckpointMetric") != CHECKPOINT_METRIC:
        raise ValueError("Stage4 MVP object-closure checkpoint metric changed")
    binding = training.get(CONFIG_BINDING_KEY)
    if not isinstance(binding, dict):
        raise ValueError("Stage4 MVP object-closure binding is missing")

    base = build_stage4_semantic_transport_v2_cpu_inactive_config(root)
    parent_support = base["training"].pop(TRAINER_SUPPORT_BINDING_KEY)
    derived_weights = _derived_object_weights(base)
    expected_binding = {
        "contractId": CONTRACT_ID,
        "contractPath": CONTRACT_PATH,
        "contractSha256": contract_sha,
        "capabilityVersion": CAPABILITY_VERSION,
        "parentArchitectureSupport": parent_support,
        "objectChannels": list(OBJECT_CHANNELS),
        "objectWeights": derived_weights,
        "pyramidScales": list(PYRAMID_SCALES),
        "legalSupervision": deepcopy(contract["legalSupervision"]),
        "preservedBoundaries": deepcopy(contract["preservedBoundaries"]),
    }
    if binding != expected_binding:
        raise ValueError("Stage4 MVP object-closure binding changed")
    expected = deepcopy(base)
    expected["training"]["denoiserLossVersion"] = LOSS_VERSION
    expected["training"]["bestCheckpointMetric"] = CHECKPOINT_METRIC
    expected["training"][CONFIG_BINDING_KEY] = expected_binding
    if "rolloutCheckpointMetricWeights" in training:
        formal_binding = contract["parentContracts"]["formalObjective"]
        formal = _read_json(
            _project_file(root, formal_binding["path"]),
            "formal Stage4 objective contract",
        )
        expected["training"]["rolloutCheckpointMetricWeights"] = deepcopy(
            formal["rolloutCheckpointMetricWeights"]
        )
    if config != expected:
        raise ValueError("Stage4 MVP object-closure config contains an unbound change")
    return {
        "status": "stage4_mvp_object_semantic_closure_v3_config_valid",
        "contractId": CONTRACT_ID,
        "contractSha256": contract_sha,
        "capabilityVersion": CAPABILITY_VERSION,
        "objectChannels": list(OBJECT_CHANNELS),
        "objectWeights": derived_weights,
        "pyramidScales": list(PYRAMID_SCALES),
    }

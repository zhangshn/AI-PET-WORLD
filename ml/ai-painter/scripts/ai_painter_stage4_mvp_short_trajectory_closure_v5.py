from __future__ import annotations

"""Immutable config support for bounded MVP short-trajectory closure V5."""

from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from ai_painter_stage4_mvp_object_trajectory_closure_v4 import (
    CAPABILITY_VERSION as V4_CAPABILITY_VERSION,
    CONFIG_BINDING_KEY as V4_CONFIG_BINDING_KEY,
    build_stage4_mvp_object_trajectory_closure_v4_config,
)
from ai_painter_stage4_semantic_transport_v2_trainer_support import (
    FORMAL_OBJECTIVE_CONTRACT_PATH,
)


CAPABILITY_VERSION = "stage4_mvp_short_trajectory_closure_v5"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-short-trajectory-closure-v5-contract.json"
)
CONTRACT_ID = "stage4-mvp-short-trajectory-closure-v5-contract-v1"
CONFIG_BINDING_KEY = "stage4MvpShortTrajectoryClosureV5"
LOSS_VERSION = "velocity_decoded_rgb_sparse_region_short_trajectory_object_closure_v5"
CHECKPOINT_METRIC = "fixed_grid_worst_object_plus_existing_deterministic_rollout_v5"


def _digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def _project_file(root: Path, logical: str) -> Path:
    if not isinstance(logical, str) or not logical or logical.startswith("/"):
        raise ValueError("project-relative contract path is invalid")
    parts = logical.replace("\\", "/").split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("project-relative contract path is invalid")
    path = root.joinpath(*parts).resolve()
    allowed = (root / ".runtime").resolve() if logical.startswith(".runtime/") else root.resolve()
    if not path.is_relative_to(allowed):
        raise ValueError("contract path escapes project root")
    return path


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_bytes())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is unreadable") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _load_contract(root: Path) -> tuple[dict[str, Any], str]:
    path = _project_file(root, CONTRACT_PATH)
    data = path.read_bytes()
    contract = _read_json(path, "Stage4 MVP short-trajectory contract")
    if contract.get("schemaVersion") != CONTRACT_ID or contract.get("contractId") != CONTRACT_ID:
        raise ValueError("Stage4 MVP short-trajectory contract identity changed")
    if contract.get("status") != "active_bounded_mvp_candidate":
        raise ValueError("Stage4 MVP short-trajectory contract is not active")
    if contract.get("capabilityVersion") != CAPABILITY_VERSION:
        raise ValueError("Stage4 MVP short-trajectory capability changed")
    if contract.get("parentCapabilityVersion") != V4_CAPABILITY_VERSION:
        raise ValueError("Stage4 MVP short-trajectory parent capability changed")
    return contract, _digest(data)


def _validate_binding(root: Path, binding: dict[str, Any], label: str) -> None:
    if not isinstance(binding, dict) or set(binding) != {"path", "sha256"}:
        raise ValueError(f"{label} binding is invalid")
    if _digest(_project_file(root, binding["path"]).read_bytes()) != binding["sha256"]:
        raise ValueError(f"{label} binding is stale")


def _binding_from_contract(contract: dict[str, Any], contract_sha: str) -> dict[str, Any]:
    return {
        "contractId": CONTRACT_ID,
        "contractPath": CONTRACT_PATH,
        "contractSha256": contract_sha,
        "capabilityVersion": CAPABILITY_VERSION,
        "parentCapabilityVersion": V4_CAPABILITY_VERSION,
        "shortTrajectorySupervision": deepcopy(contract["shortTrajectorySupervision"]),
        "trainingIntervention": deepcopy(contract["trainingIntervention"]),
        "checkpointIntervention": deepcopy(contract["checkpointIntervention"]),
        "legalSupervision": deepcopy(contract["legalSupervision"]),
        "preservedBoundaries": deepcopy(contract["preservedBoundaries"]),
        "failureEvidence": deepcopy(contract["failureEvidence"]),
    }


def build_stage4_mvp_short_trajectory_closure_v5_config(
    root: Path | None = None,
) -> dict[str, Any]:
    root = (root or Path(__file__).resolve().parents[3]).resolve()
    base = build_stage4_mvp_object_trajectory_closure_v4_config(root)
    contract, contract_sha = _load_contract(root)
    _validate_binding(root, contract["parentContract"], "V4 parent contract")
    for label, binding in contract["failureEvidence"].items():
        _validate_binding(root, binding, f"V5 {label}")
    short = contract.get("shortTrajectorySupervision", {})
    _validate_binding(root, short.get("parameterSource"), "V5 parameter source")
    config = deepcopy(base)
    config["training"]["denoiserLossVersion"] = LOSS_VERSION
    config["training"]["bestCheckpointMetric"] = CHECKPOINT_METRIC
    config["training"]["shortTrajectorySupervision"] = {
        key: deepcopy(short[key])
        for key in (
            "enabled", "steps", "stepGap", "weight", "cleanLatentWeight",
            "decodedRgbWeight", "decodedRgbGradientWeight",
        )
    }
    config["training"][CONFIG_BINDING_KEY] = _binding_from_contract(
        contract, contract_sha
    )
    validate_stage4_mvp_short_trajectory_closure_v5_config(config, root=root)
    return config


def validate_stage4_mvp_short_trajectory_closure_v5_config(
    config: dict[str, Any], *, root: Path | None = None
) -> dict[str, Any]:
    root = (root or Path(__file__).resolve().parents[3]).resolve()
    contract, contract_sha = _load_contract(root)
    _validate_binding(root, contract["parentContract"], "V4 parent contract")
    for label, evidence_binding in contract["failureEvidence"].items():
        _validate_binding(root, evidence_binding, f"V5 {label}")
    short = contract.get("shortTrajectorySupervision", {})
    _validate_binding(root, short.get("parameterSource"), "V5 parameter source")
    training = config.get("training")
    if not isinstance(training, dict):
        raise ValueError("Stage4 MVP short-trajectory training config is missing")
    if training.get("denoiserLossVersion") != LOSS_VERSION:
        raise ValueError("Stage4 MVP short-trajectory Loss identity changed")
    if training.get("bestCheckpointMetric") != CHECKPOINT_METRIC:
        raise ValueError("Stage4 MVP short-trajectory checkpoint metric changed")
    expected_short = {
        key: deepcopy(short[key])
        for key in (
            "enabled", "steps", "stepGap", "weight", "cleanLatentWeight",
            "decodedRgbWeight", "decodedRgbGradientWeight",
        )
    }
    if training.get("shortTrajectorySupervision") != expected_short:
        raise ValueError("Stage4 MVP short-trajectory supervision binding changed")
    expected_binding = _binding_from_contract(contract, contract_sha)
    if training.get(CONFIG_BINDING_KEY) != expected_binding:
        raise ValueError("Stage4 MVP short-trajectory binding changed")
    base = build_stage4_mvp_object_trajectory_closure_v4_config(root)
    expected = deepcopy(base)
    expected["training"]["denoiserLossVersion"] = LOSS_VERSION
    expected["training"]["bestCheckpointMetric"] = CHECKPOINT_METRIC
    expected["training"]["shortTrajectorySupervision"] = expected_short
    expected["training"][CONFIG_BINDING_KEY] = expected_binding
    if "rolloutCheckpointMetricWeights" in training:
        formal = _read_json(
            _project_file(root, FORMAL_OBJECTIVE_CONTRACT_PATH),
            "formal Stage4 objective contract",
        )
        expected["training"]["rolloutCheckpointMetricWeights"] = deepcopy(
            formal["rolloutCheckpointMetricWeights"]
        )
    if config != expected:
        raise ValueError("Stage4 MVP short-trajectory config contains an unbound change")
    if V4_CONFIG_BINDING_KEY not in training:
        raise ValueError("Stage4 MVP short-trajectory lost its V4 parent binding")
    return {
        "status": "stage4_mvp_short_trajectory_closure_v5_config_valid",
        "contractId": CONTRACT_ID,
        "contractSha256": contract_sha,
        "capabilityVersion": CAPABILITY_VERSION,
        "shortTrajectorySupervision": expected_short,
    }

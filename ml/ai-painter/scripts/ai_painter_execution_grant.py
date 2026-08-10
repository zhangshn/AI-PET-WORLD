from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import hashlib
import json
from types import MappingProxyType
from typing import Any, Mapping


POLICY_ISSUER = "ai-painter-stage-control-policy-v1"


class ExecutionAction(str, Enum):
    SELECT_BOUND_SAMPLE = "select_bound_sample"
    INSPECT_AUTOENCODER_IDENTITY = "inspect_autoencoder_identity"
    LOAD_AUTOENCODER = "load_autoencoder"
    INSPECT_CHECKPOINT_IDENTITY = "inspect_checkpoint_identity"
    LOAD_PARENT_DENOISER = "load_parent_denoiser"
    CREATE_OPTIMIZER = "create_optimizer"
    EXECUTE_BACKWARD = "execute_backward"
    MUTATE_MODEL_WEIGHTS = "mutate_model_weights"
    WRITE_DIAGNOSTIC_CHECKPOINT = "write_diagnostic_checkpoint"
    WRITE_SMOKE_CHECKPOINT = "write_smoke_checkpoint"
    RUN_STAGE0 = "run_stage0"
    RUN_STAGE1 = "run_stage1"
    RUN_STAGE2 = "run_stage2"
    RUN_STRICT_REVALIDATION = "run_strict_revalidation"
    RUN_FORMAL_INFERENCE = "run_formal_inference"
    PROMOTE_CHECKPOINT = "promote_checkpoint"
    CREATE_RUNTIME_FRAME = "create_runtime_frame"
    ENTER_WORLD = "enter_world"
    AUTOMATIC_RETRY = "automatic_retry"


ALL_ACTIONS = frozenset(ExecutionAction)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _freeze_mapping(value: Mapping[str, Any]) -> Mapping[str, Any]:
    return MappingProxyType(json.loads(canonical_json(dict(value))))


@dataclass(frozen=True)
class ExecutionGrant:
    allowed_actions: frozenset[ExecutionAction]
    explicitly_denied_actions: frozenset[ExecutionAction]
    dataset_constraints: Mapping[str, Any]
    checkpoint_constraints: Mapping[str, Any]
    preview_constraints: Mapping[str, Any]
    authorization_identity: Mapping[str, Any]
    policy_version: str
    input_digest: str
    decision_digest: str
    _issuer: str

    def __post_init__(self) -> None:
        if self._issuer != POLICY_ISSUER:
            raise ValueError("ExecutionGrant issuer is not the formal authorization policy")
        if self.allowed_actions & self.explicitly_denied_actions:
            raise ValueError("ExecutionGrant action cannot be both allowed and explicitly denied")
        if self.allowed_actions | self.explicitly_denied_actions != ALL_ACTIONS:
            raise ValueError("ExecutionGrant must classify every fixed action")
        if self.decision_digest != self.expected_decision_digest():
            raise ValueError("ExecutionGrant decisionDigest is invalid")

    def permits(self, action: ExecutionAction | str) -> bool:
        try:
            normalized = action if isinstance(action, ExecutionAction) else ExecutionAction(action)
        except ValueError as error:
            raise ValueError(f"unknown ExecutionGrant action: {action}") from error
        return normalized in self.allowed_actions

    def require(self, action: ExecutionAction | str) -> None:
        normalized = action if isinstance(action, ExecutionAction) else ExecutionAction(action)
        if normalized not in self.allowed_actions:
            raise ValueError(f"ExecutionGrant action is denied: {normalized.value}")

    def decision_payload(self) -> dict[str, Any]:
        return {
            "allowedActions": sorted(action.value for action in self.allowed_actions),
            "explicitlyDeniedActions": sorted(
                action.value for action in self.explicitly_denied_actions
            ),
            "datasetConstraints": dict(self.dataset_constraints),
            "checkpointConstraints": dict(self.checkpoint_constraints),
            "previewConstraints": dict(self.preview_constraints),
            "authorizationIdentity": dict(self.authorization_identity),
            "policyVersion": self.policy_version,
            "inputDigest": self.input_digest,
        }

    def expected_decision_digest(self) -> str:
        return sha256_json(self.decision_payload())

    def as_dict(self) -> dict[str, Any]:
        return {**self.decision_payload(), "decisionDigest": self.decision_digest}


def issue_execution_grant(
    *,
    allowed_actions: set[ExecutionAction] | frozenset[ExecutionAction],
    dataset_constraints: Mapping[str, Any],
    checkpoint_constraints: Mapping[str, Any],
    preview_constraints: Mapping[str, Any],
    authorization_identity: Mapping[str, Any],
    policy_version: str,
    input_digest: str,
) -> ExecutionGrant:
    allowed = frozenset(allowed_actions)
    unknown = allowed - ALL_ACTIONS
    if unknown:
        raise ValueError(f"unknown ExecutionGrant actions: {sorted(unknown)}")
    denied = ALL_ACTIONS - allowed
    payload = {
        "allowedActions": sorted(action.value for action in allowed),
        "explicitlyDeniedActions": sorted(action.value for action in denied),
        "datasetConstraints": dict(dataset_constraints),
        "checkpointConstraints": dict(checkpoint_constraints),
        "previewConstraints": dict(preview_constraints),
        "authorizationIdentity": dict(authorization_identity),
        "policyVersion": policy_version,
        "inputDigest": input_digest,
    }
    return ExecutionGrant(
        allowed_actions=allowed,
        explicitly_denied_actions=denied,
        dataset_constraints=_freeze_mapping(dataset_constraints),
        checkpoint_constraints=_freeze_mapping(checkpoint_constraints),
        preview_constraints=_freeze_mapping(preview_constraints),
        authorization_identity=_freeze_mapping(authorization_identity),
        policy_version=policy_version,
        input_digest=input_digest,
        decision_digest=sha256_json(payload),
        _issuer=POLICY_ISSUER,
    )


def validate_serialized_execution_grant(value: Mapping[str, Any]) -> dict[str, Any]:
    required = {
        "allowedActions",
        "explicitlyDeniedActions",
        "datasetConstraints",
        "checkpointConstraints",
        "previewConstraints",
        "authorizationIdentity",
        "policyVersion",
        "inputDigest",
        "decisionDigest",
    }
    if set(value) != required:
        raise ValueError("serialized ExecutionGrant fields are invalid")
    allowed = frozenset(ExecutionAction(item) for item in value["allowedActions"])
    denied = frozenset(ExecutionAction(item) for item in value["explicitlyDeniedActions"])
    grant = ExecutionGrant(
        allowed_actions=allowed,
        explicitly_denied_actions=denied,
        dataset_constraints=_freeze_mapping(value["datasetConstraints"]),
        checkpoint_constraints=_freeze_mapping(value["checkpointConstraints"]),
        preview_constraints=_freeze_mapping(value["previewConstraints"]),
        authorization_identity=_freeze_mapping(value["authorizationIdentity"]),
        policy_version=str(value["policyVersion"]),
        input_digest=str(value["inputDigest"]),
        decision_digest=str(value["decisionDigest"]),
        _issuer=POLICY_ISSUER,
    )
    return grant.as_dict()

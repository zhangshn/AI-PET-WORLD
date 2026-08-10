from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

from ai_painter_execution_grant import (
    ALL_ACTIONS,
    ExecutionAction,
    ExecutionGrant,
    issue_execution_grant,
    sha256_json,
    validate_serialized_execution_grant,
)
from ai_painter_stage_mode_registry import FORMAL_MODE_REGISTRY, ModeSpec, resolve_stage_mode


POLICY_VERSION = "ai-painter-stage-control-authorization-policy-v1"
CONTROL_REFACTOR_REQUEST_ID = "owner-authorized-ai-painter-stage-control-convergence-20260810"
CONTROL_REFACTOR_SCOPE = (
    "ai_painter_stage3_stage4_control_layer_conditional_complexity_convergence_cpu_only"
)
EXPECTED_SPLIT = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
PROJECT_RUNTIME_LOGICAL_ENTRY = ".runtime"
REGISTERED_HOT_RUNTIME_ROOT = Path("D:/AI-PET-WORLD-DATA/hot/runtime")


_OWNER_FIELDS = {
    "authorizationId",
    "authorizationPath",
    "authorizationSha256",
    "executionConsumptionPath",
    "executionConsumptionSha256",
    "implementationConsumptionPath",
    "implementationConsumptionSha256",
    "implementationAuthorizationPath",
    "implementationAuthorizationSha256",
    "requestId",
    "commandRef",
    "scope",
    "executionActions",
    "explicitlyDeniedActions",
    "phase0Step",
    "executionState",
    "status",
    "checkpointLoadingAuthorized",
    "optimizerCreationAuthorized",
    "backwardExecutionAuthorized",
    "modelWeightMutationAuthorized",
    "gpuTrainingAuthorizedNow",
    "singleSampleGpuOverfitSmokeAuthorized",
    "fullTrainingAuthorized",
    "stage1Authorized",
    "stage2Authorized",
    "strictRevalidationAuthorized",
    "validationAuthorized",
    "formalInferenceAuthorized",
    "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized",
    "worldEntryAuthorized",
    "automaticRetryAuthorized",
}

_PHASE0_MODE_ID = "structure_fact_first_stage4_phase0"
_PHASE0_ALLOWED_ACTIONS = frozenset(
    {
        ExecutionAction.SELECT_BOUND_SAMPLE,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
        ExecutionAction.LOAD_AUTOENCODER,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
        ExecutionAction.CREATE_OPTIMIZER,
        ExecutionAction.EXECUTE_BACKWARD,
        ExecutionAction.MUTATE_MODEL_WEIGHTS,
        ExecutionAction.WRITE_DIAGNOSTIC_CHECKPOINT,
    }
)
_PHASE0_REQUIRED_ACTIONS = {
    "causal_readonly": frozenset(
        {
            ExecutionAction.SELECT_BOUND_SAMPLE,
            ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
            ExecutionAction.LOAD_AUTOENCODER,
            ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
        }
    ),
    "single_step_update": frozenset(_PHASE0_ALLOWED_ACTIONS),
    "checkpoint_reproduction": frozenset(_PHASE0_ALLOWED_ACTIONS),
}


def _canonical_file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_project_file(project_root: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        try:
            candidate.resolve().relative_to(project_root)
        except ValueError as error:
            raise ValueError("absolute path injection is not allowed") from error
        return candidate.resolve()
    if not candidate.parts or any(part == ".." for part in candidate.parts):
        raise ValueError("project path traversal is not allowed")
    resolved = (project_root / candidate).resolve()
    if candidate.parts[0].casefold() == PROJECT_RUNTIME_LOGICAL_ENTRY.casefold():
        logical_runtime = (project_root / PROJECT_RUNTIME_LOGICAL_ENTRY).resolve()
        registered_runtime = REGISTERED_HOT_RUNTIME_ROOT.resolve()
        if logical_runtime != registered_runtime:
            raise ValueError("logical .runtime entry does not match the registered hot runtime")
        if resolved != registered_runtime and registered_runtime not in resolved.parents:
            raise ValueError("registered hot runtime path traversal is not allowed")
        return resolved
    try:
        resolved.relative_to(project_root)
    except ValueError as error:
        raise ValueError("project path traversal is not allowed") from error
    return resolved


def _verify_bound_file(project_root: Path, value: str, expected_sha256: str, label: str) -> Path:
    path = _resolve_project_file(project_root, value)
    if not path.is_file():
        raise ValueError(f"{label} is missing")
    if _canonical_file_hash(path) != expected_sha256:
        raise ValueError(f"{label} SHA-256 is invalid")
    return path


def _actions_for_mode(spec: ModeSpec) -> set[ExecutionAction]:
    allowed = {
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
    }
    if spec.sample_split is not None:
        allowed.add(ExecutionAction.SELECT_BOUND_SAMPLE)
    if spec.execution_kind == "full_training":
        allowed.update(
            {
                ExecutionAction.LOAD_AUTOENCODER,
                ExecutionAction.CREATE_OPTIMIZER,
                ExecutionAction.EXECUTE_BACKWARD,
                ExecutionAction.MUTATE_MODEL_WEIGHTS,
                ExecutionAction.RUN_STAGE0,
                ExecutionAction.RUN_STAGE1,
                ExecutionAction.RUN_STAGE2,
            }
        )
    elif spec.execution_kind == "single_sample_smoke":
        allowed.update(
            {
                ExecutionAction.LOAD_AUTOENCODER,
                ExecutionAction.CREATE_OPTIMIZER,
                ExecutionAction.EXECUTE_BACKWARD,
                ExecutionAction.MUTATE_MODEL_WEIGHTS,
                ExecutionAction.WRITE_SMOKE_CHECKPOINT,
            }
        )
    elif spec.execution_kind == "phase0_engineering":
        allowed.update(_PHASE0_ALLOWED_ACTIONS)
    if spec.architecture == "multiscale_condition_unet_v7" and spec.execution_kind == "single_sample_smoke":
        allowed.add(ExecutionAction.LOAD_PARENT_DENOISER)
    return allowed


def _validate_owner_training_authorization(
    training: Mapping[str, Any],
    spec: ModeSpec,
    project_root: Path,
    verify_files: bool,
) -> Mapping[str, Any]:
    owner = training.get("ownerTrainingAuthorization")
    if not isinstance(owner, Mapping):
        if spec.active_execution:
            raise ValueError("active Stage3/Stage4 mode requires Owner authorization identity")
        return {"status": spec.authorization_status, "inactive": True}
    unknown = set(owner) - _OWNER_FIELDS
    if unknown:
        raise ValueError(f"unknown Owner authorization action fields: {sorted(unknown)}")
    if spec.active_execution:
        if owner.get("status") != spec.authorization_status:
            raise ValueError("Owner authorization status and registered mode are inconsistent")
    else:
        if not str(owner.get("status", "")).startswith("not_authorized"):
            raise ValueError("inactive Stage3/Stage4 mode has an active Owner authorization status")
        if any(value is True for key, value in owner.items() if key.endswith("Authorized") or key.endswith("AuthorizedNow")):
            raise ValueError("inactive Stage3/Stage4 mode opens an execution action")
    verify_files = bool(verify_files or spec.active_execution)
    if verify_files:
        authorization_path = _verify_bound_file(
            project_root,
            str(owner.get("authorizationPath")),
            str(owner.get("authorizationSha256")),
            "Owner authorization",
        )
        authorization = json.loads(authorization_path.read_text(encoding="utf-8"))
        command_ref = owner.get("commandRef") or owner.get("authorizationId")
        scope = owner.get("scope")
        authorization_command_ref = authorization.get("commandRef") or authorization.get(
            "ownerDecision", {}
        ).get("commandRef")
        authorization_scope = authorization.get("scope") or authorization.get(
            "ownerDecision", {}
        ).get("scope")
        if (
            authorization.get("status") not in {
                "resolved_owner_authorized",
                "resolved_owner_authorized_not_consumed",
            }
            or authorization.get("requestId") != (owner.get("requestId") or owner.get("authorizationId"))
            or authorization_command_ref != command_ref
            or (scope is not None and authorization_scope != scope)
        ):
            raise ValueError("Owner authorization immutable identity is invalid")
        execution_state = owner.get("executionState", "consumed")
        if spec.mode_id == _PHASE0_MODE_ID and execution_state == "preflight_unconsumed":
            if owner.get("executionConsumptionPath") is not None or owner.get("executionConsumptionSha256") is not None:
                raise ValueError("unconsumed Phase0 preflight cannot carry an execution consumption")
            if authorization.get("status") != "resolved_owner_authorized_not_consumed":
                raise ValueError("unconsumed Phase0 preflight authorization state is invalid")
        else:
            if execution_state != "consumed":
                raise ValueError("active execution consumption state is invalid")
            consumption_path = _verify_bound_file(
                project_root,
                str(owner.get("executionConsumptionPath")),
                str(owner.get("executionConsumptionSha256")),
                "execution consumption",
            )
            consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
            if (
                consumption.get("oneTimeConsumption") is not True
                or consumption.get("authorizationSha256") != owner.get("authorizationSha256")
                or consumption.get("requestId") != (owner.get("requestId") or owner.get("authorizationId"))
                or consumption.get("commandRef") != command_ref
                or (scope is not None and consumption.get("scope") != scope)
            ):
                raise ValueError("execution consumption immutable identity is invalid")
        if spec.mode_id == _PHASE0_MODE_ID:
            implementation_authorization_path = _verify_bound_file(
                project_root,
                str(owner.get("implementationAuthorizationPath")),
                str(owner.get("implementationAuthorizationSha256")),
                "implementation authorization",
            )
            implementation_consumption_path = _verify_bound_file(
                project_root,
                str(owner.get("implementationConsumptionPath")),
                str(owner.get("implementationConsumptionSha256")),
                "implementation consumption",
            )
            implementation_authorization = json.loads(
                implementation_authorization_path.read_text(encoding="utf-8")
            )
            implementation_consumption = json.loads(
                implementation_consumption_path.read_text(encoding="utf-8")
            )
            if (
                implementation_authorization.get("status") != "resolved_owner_authorized_not_consumed"
                or implementation_consumption.get("requestId") != implementation_authorization.get("requestId")
                or implementation_consumption.get("commandRef") != implementation_authorization.get("commandRef")
                or implementation_consumption.get("scope") != implementation_authorization.get("scope")
                or implementation_consumption.get("authorizationSha256")
                != owner.get("implementationAuthorizationSha256")
                or implementation_consumption.get("oneTimeConsumption") is not True
            ):
                raise ValueError("implementation authorization lineage is invalid")
            auth_actions = authorization.get("executionActions")
            owner_actions = owner.get("executionActions")
            if not isinstance(auth_actions, list) or auth_actions != owner_actions:
                raise ValueError("Owner execution action identity is invalid")
            try:
                normalized_actions = frozenset(ExecutionAction(value) for value in auth_actions)
            except ValueError as error:
                raise ValueError("Owner execution authorization contains an unknown action") from error
            phase0_step = str(owner.get("phase0Step", ""))
            required_actions = _PHASE0_REQUIRED_ACTIONS.get(phase0_step)
            if required_actions is None:
                raise ValueError("Owner Phase0 step is unknown")
            if normalized_actions != required_actions:
                raise ValueError("Owner Phase0 actions are incomplete, excessive, or crossed")
            if normalized_actions - _PHASE0_ALLOWED_ACTIONS:
                raise ValueError("Owner Phase0 action is outside the ModeSpec")
            denied_values = owner.get("explicitlyDeniedActions")
            if not isinstance(denied_values, list):
                raise ValueError("Owner denied action classification is missing")
            try:
                normalized_denied = frozenset(ExecutionAction(value) for value in denied_values)
            except ValueError as error:
                raise ValueError("Owner denied action contains an unknown action") from error
            if normalized_actions & normalized_denied or normalized_actions | normalized_denied != ALL_ACTIONS:
                raise ValueError("Owner action classification is conflicting or incomplete")
    return {
        "authorizationId": owner.get("authorizationId"),
        "authorizationPath": owner.get("authorizationPath"),
        "authorizationSha256": owner.get("authorizationSha256"),
        "executionConsumptionPath": owner.get("executionConsumptionPath"),
        "executionConsumptionSha256": owner.get("executionConsumptionSha256"),
        "implementationAuthorizationPath": owner.get("implementationAuthorizationPath"),
        "implementationAuthorizationSha256": owner.get("implementationAuthorizationSha256"),
        "implementationConsumptionPath": owner.get("implementationConsumptionPath"),
        "implementationConsumptionSha256": owner.get("implementationConsumptionSha256"),
        "requestId": owner.get("requestId") or owner.get("authorizationId"),
        "commandRef": owner.get("commandRef") or owner.get("authorizationId"),
        "scope": owner.get("scope"),
        "phase0Step": owner.get("phase0Step"),
        "executionState": owner.get("executionState", "consumed"),
        "executionActions": owner.get("executionActions"),
        "status": owner.get("status"),
    }


def resolve_stage_execution_grant(
    config: Mapping[str, Any],
    *,
    project_root: Path | None = None,
    verify_owner_files: bool = False,
) -> ExecutionGrant:
    root = Path(project_root or Path.cwd()).resolve()
    spec = resolve_stage_mode(config)
    training = config.get("training", {})
    owner_identity = _validate_owner_training_authorization(
        training, spec, root, verify_owner_files
    )
    smoke = training.get("v9Stage4SingleSampleSmokeContract") or training.get(
        "v8Stage4SingleSampleSmokeContract"
    ) or training.get("r5Stage4BoundedRepairSmokeContract") or {}
    sample_id = smoke.get("sampleId") or training.get("authorizedOverfitSampleId")
    required_boundary_sides = (
        smoke.get("requiredBoundarySides")
        or training.get("requiredBoundarySides")
        or (["west"] if spec.architecture.endswith("object_semantic_decoded_alignment") else [])
    )
    dataset_constraints = {
        "capacity": 64,
        "splitCounts": EXPECTED_SPLIT,
        "selectedSplit": spec.sample_split,
        "sampleId": sample_id,
        "requiredBoundarySides": required_boundary_sides,
        "sampleMustRemainInRegisteredSplit": True,
    }
    checkpoint_constraints = {
        "identityInspectionOnlyDuringCpuDryRun": True,
        "parentDenoiserAllowed": spec.architecture == "multiscale_condition_unet_v7"
        and spec.execution_kind == "single_sample_smoke",
        "checkpointDeserializationDuringCpuDryRun": False,
        "checkpointWeightLoadDuringCpuDryRun": False,
    }
    preview = training.get("stage4UnifiedTrainingPreviewSamplingContract", {})
    preview_constraints = {
        "enabled": bool(preview.get("enabled")),
        "samplingFunction": preview.get("samplingFunction"),
        "modelStateBinding": preview.get("modelStateBinding"),
        "seedBinding": preview.get("seedBinding"),
        "normalizationBinding": preview.get("normalizationBinding"),
        "decodeBinding": preview.get("decodeBinding"),
        "checkpointPreviewIdentityGate": preview.get("checkpointPreviewIdentityGate"),
    }
    input_payload = {
        "mode": spec.mode_id,
        "authorizationStatus": spec.authorization_status,
        "architecture": spec.architecture,
        "datasetConstraints": dataset_constraints,
        "checkpointConstraints": checkpoint_constraints,
        "previewConstraints": preview_constraints,
        "authorizationIdentity": dict(owner_identity),
    }
    mode_actions = _actions_for_mode(spec)
    owner_actions = owner_identity.get("executionActions")
    if spec.mode_id == _PHASE0_MODE_ID:
        explicit_owner_actions = {ExecutionAction(value) for value in owner_actions or []}
        allowed_actions = mode_actions & explicit_owner_actions
    else:
        allowed_actions = mode_actions
    return issue_execution_grant(
        allowed_actions=allowed_actions,
        dataset_constraints=dataset_constraints,
        checkpoint_constraints=checkpoint_constraints,
        preview_constraints=preview_constraints,
        authorization_identity={**dict(owner_identity), "modeId": spec.mode_id},
        policy_version=POLICY_VERSION,
        input_digest=sha256_json(input_payload),
    )


def resolve_control_refactor_grant(
    authorization_path: Path,
    expected_sha256: str,
    *,
    project_root: Path | None = None,
) -> ExecutionGrant:
    root = Path(project_root or Path.cwd()).resolve()
    path = _verify_bound_file(root, str(authorization_path), expected_sha256, "control refactor authorization")
    authorization = json.loads(path.read_text(encoding="utf-8"))
    if (
        authorization.get("requestId") != CONTROL_REFACTOR_REQUEST_ID
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != CONTROL_REFACTOR_REQUEST_ID
        or authorization.get("ownerDecision", {}).get("scope") != CONTROL_REFACTOR_SCOPE
    ):
        raise ValueError("control refactor authorization identity is invalid")
    actions = authorization.get("authorizedActions", {})
    forbidden = {
        "checkpointDeserialization",
        "checkpointWeightContentReadOrLoad",
        "optimizerCreation",
        "backwardExecution",
        "modelWeightMutation",
        "gpuExecution",
        "smokeExecution",
        "stage4FullTraining",
        "stage5StrictRevalidation",
        "formalInference",
        "checkpointPromotion",
        "runtimeFrame",
        "worldEntry",
        "worldRuntime",
    }
    if any(actions.get(name) is not False for name in forbidden):
        raise ValueError("control refactor authorization opens a forbidden action")
    allowed = {
        ExecutionAction.SELECT_BOUND_SAMPLE,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
    }
    identity = {
        "requestId": authorization["requestId"],
        "authorizationPath": str(authorization_path).replace("\\", "/"),
        "authorizationSha256": expected_sha256,
        "commandRef": authorization["ownerDecision"]["commandRef"],
        "scope": authorization["ownerDecision"]["scope"],
    }
    return issue_execution_grant(
        allowed_actions=allowed,
        dataset_constraints={
            "capacity": 64,
            "splitCounts": EXPECTED_SPLIT,
            "selectedSplit": "validation",
            "sampleId": authorization["fixedTaskIdentity"]["sampleId"],
            "requiredBoundarySides": ["west"],
        },
        checkpoint_constraints={
            "identityInspectionOnly": True,
            "deserializationAllowed": False,
            "weightLoadAllowed": False,
        },
        preview_constraints={"identityContractInspectionOnly": True},
        authorization_identity=identity,
        policy_version=POLICY_VERSION,
        input_digest=sha256_json({"authorizationIdentity": identity, "fixedTaskIdentity": authorization["fixedTaskIdentity"]}),
    )


def main() -> int:
    parser = ArgumentParser(description="Resolve the unique AI Painter Stage3/Stage4 execution policy.")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--authorization", type=Path)
    parser.add_argument("--authorization-sha256")
    parser.add_argument("--mode-id")
    parser.add_argument("--verify-owner-files", action="store_true")
    parser.add_argument("--validate-grant", type=Path)
    args = parser.parse_args()
    if args.mode_id:
        spec = FORMAL_MODE_REGISTRY.resolve_mode_id(args.mode_id)
        result = {
            "schemaVersion": "ai-painter-stage-control-mode-resolution-v1",
            "policyVersion": POLICY_VERSION,
            "modeId": spec.mode_id,
            "authorizationStatus": spec.authorization_status,
            "architecture": spec.architecture,
            "stage": spec.stage,
            "executionKind": spec.execution_kind,
            "adapterBinding": spec.adapter_binding,
        }
    elif args.validate_grant:
        value = json.loads(args.validate_grant.read_text(encoding="utf-8"))
        result = validate_serialized_execution_grant(value)
    elif args.config:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        result = resolve_stage_execution_grant(
            config,
            verify_owner_files=args.verify_owner_files,
        ).as_dict()
    elif args.authorization and args.authorization_sha256:
        result = resolve_control_refactor_grant(
            args.authorization,
            args.authorization_sha256,
        ).as_dict()
    else:
        parser.error("provide --config, --validate-grant, or authorization identity")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

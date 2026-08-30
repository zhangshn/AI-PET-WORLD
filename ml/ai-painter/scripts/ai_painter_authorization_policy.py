from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import re
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
    "preflightOnly",
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
_STRUCTURE_SMOKE_MODE_ID = "structure_fact_first_stage4_smoke"
_SEMANTIC_MIXTURE_FULL_TRAINING_MODE_IDS = frozenset({
    "fact_conditioned_semantic_mixture_stage0_full_training",
    "fact_conditioned_semantic_mixture_stage1_full_training",
    "fact_conditioned_semantic_mixture_stage2_full_training",
})
_AUTHORITATIVE_SEMANTIC_CARRIER_SMOKE_MODE_ID = (
    "authoritative_semantic_carrier_stage4_smoke"
)
_AUTHORITATIVE_SEMANTIC_CARRIER_LOCAL_MODE_IDS = frozenset({
    _AUTHORITATIVE_SEMANTIC_CARRIER_SMOKE_MODE_ID,
    "authoritative_semantic_carrier_stage0_full_training",
    "post_decode_object_rgb_stage4_smoke",
    "post_decode_object_rgb_stage0_full_training",
    "post_decode_full_condition_responsibility_stage4_smoke",
    "post_decode_full_condition_responsibility_stage0_full_training",
    "spatial_affine_decoder_stage4_readonly_gpu",
    "spatial_affine_decoder_stage4_full_data_screen",
    "spatial_affine_decoder_stage0_full_training",
})
_SPATIAL_AFFINE_LOCAL_MODE_IDS = frozenset({
    "spatial_affine_decoder_stage4_inactive",
    "spatial_affine_decoder_stage4_readonly_gpu",
    "spatial_affine_decoder_stage4_full_data_screen",
    "spatial_affine_decoder_stage0_full_training",
    "full_backbone_spatial_affine_denoiser_stage4_inactive",
    "full_backbone_spatial_affine_denoiser_stage4_readonly_gpu",
    "full_backbone_spatial_affine_denoiser_stage4_smoke",
    "joint_condition_local_transport_stage4_readonly_gpu",
    "joint_condition_local_transport_stage4_smoke",
    "joint_condition_local_transport_stage4_full_data_screen",
})
_LOCAL_CPU_INACTIVE_MODE_IDS = frozenset({
    "spatial_affine_decoder_stage4_inactive",
    "full_backbone_spatial_affine_denoiser_stage4_inactive",
    "joint_condition_local_transport_stage4_inactive",
})
_LOCAL_TICKET_V2_IDENTITY_FIELDS = frozenset({
    "ticketId", "ticketPath", "ticketSha256", "consumptionPath",
    "consumptionSha256", "executionState", "status", "executionActions",
    "boundConfigSha256", "datasetPackageId", "runId", "outputNamespace",
})
_FULL_BACKBONE_READONLY_GPU_MODE_ID = (
    "full_backbone_spatial_affine_denoiser_stage4_readonly_gpu"
)
_FULL_BACKBONE_CONTROLLED_SMOKE_MODE_ID = (
    "full_backbone_spatial_affine_denoiser_stage4_smoke"
)
_JOINT_CONDITION_LOCAL_TRANSPORT_CONTROLLED_SMOKE_MODE_ID = (
    "joint_condition_local_transport_stage4_smoke"
)
_JOINT_CONDITION_LOCAL_TRANSPORT_FULL_DATA_SCREEN_MODE_ID = (
    "joint_condition_local_transport_stage4_full_data_screen"
)
_SAFE_RUN_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{7,127}")
_STRUCTURE_SMOKE_PREFLIGHT_ACTIONS = frozenset(
    {
        ExecutionAction.SELECT_BOUND_SAMPLE,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
    }
)
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
    elif spec.execution_kind in {
        "full_training_stage0", "full_training_stage1", "full_training_stage2",
    }:
        allowed.update({
            ExecutionAction.LOAD_AUTOENCODER,
            ExecutionAction.CREATE_OPTIMIZER,
            ExecutionAction.EXECUTE_BACKWARD,
            ExecutionAction.MUTATE_MODEL_WEIGHTS,
            {
                "full_training_stage0": ExecutionAction.RUN_STAGE0,
                "full_training_stage1": ExecutionAction.RUN_STAGE1,
                "full_training_stage2": ExecutionAction.RUN_STAGE2,
            }[spec.execution_kind],
        })
        if spec.execution_kind != "full_training_stage0":
            allowed.add(ExecutionAction.LOAD_PARENT_DENOISER)
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
    elif spec.execution_kind == "readonly_gpu_qualification":
        allowed.add(ExecutionAction.LOAD_AUTOENCODER)
    elif spec.execution_kind == "full_data_screen":
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


def execution_action_values_for_stage_config(
    config: Mapping[str, Any],
) -> list[str]:
    """Return the canonical internal capability actions for a registered mode.

    Ticket issuers and CPU fixtures must use this function instead of copying
    action lists.  The returned values are deterministic and do not grant or
    consume any capability by themselves.
    """

    spec = resolve_stage_mode(config)
    return sorted(action.value for action in _actions_for_mode(spec))


def local_ai_ticket_bound_config_sha256(config: Mapping[str, Any]) -> str:
    """Hash the immutable active config without its self-referential ticket."""

    normalized = json.loads(json.dumps(dict(config), ensure_ascii=False))
    training = normalized.get("training")
    if not isinstance(training, dict):
        raise ValueError("local AI capability config training identity is missing")
    training.pop("localAiCapabilityTicket", None)
    return sha256_json(normalized)


def _validate_local_execution_binding(
    project_root: Path,
    *,
    dataset_package_id: Any,
    run_id: Any,
    output_namespace: Any,
) -> None:
    if not isinstance(dataset_package_id, str) or not dataset_package_id:
        raise ValueError("local AI ticket dataset package identity is invalid")
    if not isinstance(run_id, str) or not _SAFE_RUN_ID.fullmatch(run_id):
        raise ValueError("local AI ticket run identity is invalid")
    if not isinstance(output_namespace, str):
        raise ValueError("local AI ticket output namespace is invalid")
    relative = Path(output_namespace)
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in {"", ".", ".."} for part in relative.parts)
        or tuple(part.casefold() for part in relative.parts[:2])
        != (".runtime", "ai-painter")
        or relative.name != run_id
    ):
        raise ValueError("local AI ticket output namespace is outside the run boundary")
    _resolve_project_file(project_root, output_namespace)


def _validate_full_backbone_readonly_qualification_samples(
    config: Mapping[str, Any],
    project_root: Path,
) -> dict[str, Any]:
    evidence = config.get("evidenceBindings")
    if not isinstance(evidence, Mapping):
        raise ValueError("readonly GPU evidence bindings are missing")
    selection = evidence.get("approved64Selection")
    qualification = evidence.get("qualificationSamples")
    if not isinstance(selection, Mapping) or not isinstance(
        qualification, Mapping
    ):
        raise ValueError("readonly GPU fixed qualification samples are missing")
    required_qualification_fields = {
        "schemaVersion",
        "selectionContract",
        "preboundReadOnlySamples",
        "freeSelectionAllowed",
        "selectBoundSampleActionRequired",
        "firstTrain",
        "fixedValidation",
        "identitySha256",
    }
    if (
        set(qualification) != required_qualification_fields
        or qualification.get("schemaVersion")
        != (
            "stage4-full-backbone-spatial-affine-readonly-gpu-"
            "qualification-samples-v1"
        )
        or qualification.get("selectionContract")
        != selection.get("selectionContract")
        or qualification.get("preboundReadOnlySamples") is not True
        or qualification.get("freeSelectionAllowed") is not False
        or qualification.get("selectBoundSampleActionRequired") is not False
    ):
        raise ValueError("readonly GPU fixed-sample policy identity is invalid")
    qualification_payload = {
        key: json.loads(json.dumps(value, ensure_ascii=False))
        for key, value in qualification.items()
        if key != "identitySha256"
    }
    if sha256_json(qualification_payload) != qualification.get(
        "identitySha256"
    ):
        raise ValueError("readonly GPU qualification sample digest is invalid")

    source_index_path = _verify_bound_file(
        project_root,
        str(selection.get("sourceIndexPath", "")),
        str(selection.get("sourceIndexSha256", "")),
        "readonly GPU formal source index",
    )
    source_index = json.loads(source_index_path.read_text(encoding="utf-8"))
    all_rows = source_index.get("samples")
    if not isinstance(all_rows, list):
        raise ValueError("readonly GPU formal source-index samples are missing")
    selected_rows = [
        row
        for row in all_rows
        if isinstance(row, Mapping)
        and row.get("v7CapacityContributionRegistered") is True
    ]
    split_counts = {
        split: sum(1 for row in selected_rows if row.get("split") == split)
        for split in EXPECTED_SPLIT
    }
    if (
        len(selected_rows) != 64
        or split_counts != EXPECTED_SPLIT
        or selection.get("selectedRecordCount") != 64
        or selection.get("splitCounts") != EXPECTED_SPLIT
    ):
        raise ValueError("readonly GPU approved 64-record selection changed")

    sample_fields = {
        "role",
        "sampleId",
        "recordId",
        "split",
        "sourceIndexOrdinal",
        "selectionOrdinal",
        "splitOrdinal",
        "v7CapacitySlotId",
        "sourceRecordPath",
        "sourceRecordSha256",
        "conditionPackPath",
        "conditionPackSha256",
    }
    role_contracts = (
        ("firstTrain", "train", 0, 0, None),
        ("fixedValidation", "validation", 48, 0, "v7-capacity-slot-194"),
    )
    for role, split, selection_ordinal, split_ordinal, slot_id in role_contracts:
        sample = qualification.get(role)
        if (
            not isinstance(sample, Mapping)
            or set(sample) != sample_fields
            or sample.get("role") != role
            or sample.get("split") != split
            or sample.get("selectionOrdinal") != selection_ordinal
            or sample.get("splitOrdinal") != split_ordinal
            or sample.get("recordId") != sample.get("sampleId")
            or (slot_id is not None and sample.get("v7CapacitySlotId") != slot_id)
        ):
            raise ValueError(f"readonly GPU {role} fixed identity is invalid")
        source_ordinal = sample.get("sourceIndexOrdinal")
        if (
            not isinstance(source_ordinal, int)
            or source_ordinal < 0
            or source_ordinal >= len(all_rows)
            or selected_rows[selection_ordinal] != all_rows[source_ordinal]
        ):
            raise ValueError(f"readonly GPU {role} source-index position changed")
        split_rows = [row for row in selected_rows if row.get("split") == split]
        row = all_rows[source_ordinal]
        if split_rows[split_ordinal] != row:
            raise ValueError(f"readonly GPU {role} split position changed")
        for field in (
            "sampleId",
            "recordId",
            "split",
            "v7CapacitySlotId",
            "sourceRecordPath",
            "sourceRecordSha256",
            "conditionPackPath",
        ):
            if sample.get(field) != row.get(field):
                raise ValueError(f"readonly GPU {role} {field} changed")
        _verify_bound_file(
            project_root,
            str(sample.get("sourceRecordPath", "")),
            str(sample.get("sourceRecordSha256", "")),
            f"readonly GPU {role} source record",
        )
        _verify_bound_file(
            project_root,
            str(sample.get("conditionPackPath", "")),
            str(sample.get("conditionPackSha256", "")),
            f"readonly GPU {role} condition pack",
        )
    return json.loads(json.dumps(dict(qualification), ensure_ascii=False))


def _validate_full_backbone_controlled_smoke_identity(
    config: Mapping[str, Any],
    project_root: Path,
) -> dict[str, Any]:
    """Validate the fixed sample-194 Smoke boundary independently of callers."""

    training = config.get("training")
    evidence = config.get("evidenceBindings")
    if not isinstance(training, Mapping) or not isinstance(evidence, Mapping):
        raise ValueError("full-backbone controlled Smoke identity is missing")
    smoke = training.get("stage4FullBackboneSpatialAffineSmokeContract")
    if not isinstance(smoke, Mapping):
        raise ValueError("full-backbone controlled Smoke contract is missing")
    required_fields = {
        "schemaVersion",
        "status",
        "compiledContract",
        "sampleId",
        "sampleSplit",
        "seed",
        "topology",
        "requiredBoundarySides",
        "resolutionStage",
        "resolution",
        "latentResolution",
        "epochCount",
        "previewEpochs",
        "initialization",
        "autoencoderFrozen",
        "denoiserCheckpointPath",
        "denoiserCheckpointReadAllowed",
        "historicalCheckpointAllowed",
        "failedCheckpointAllowed",
        "crossRunArtifactAllowed",
        "automaticTrainingRetryAllowed",
    }
    compiled = smoke.get("compiledContract")
    if (
        set(smoke) != required_fields
        or smoke.get("schemaVersion")
        != "stage4-full-backbone-spatial-affine-controlled-smoke-execution-contract-v1"
        or smoke.get("status") != "active_bound_to_compiled_contract"
        or not isinstance(compiled, Mapping)
        or set(compiled)
        != {"path", "sha256", "schemaVersion", "status", "compilationRunId"}
        or not isinstance(compiled.get("path"), str)
        or not isinstance(compiled.get("sha256"), str)
        or re.fullmatch(r"[0-9a-f]{64}", compiled.get("sha256", "")) is None
        or compiled.get("schemaVersion")
        != "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1"
        or compiled.get("status") != "compiled_not_started"
        or not isinstance(compiled.get("compilationRunId"), str)
        or smoke.get("sampleId")
        != "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        or smoke.get("sampleSplit") != "validation"
        or smoke.get("seed") != 20263722
        or smoke.get("topology") != "west"
        or smoke.get("requiredBoundarySides") != ["west"]
        or smoke.get("resolutionStage") != 0
        or smoke.get("resolution") != {"width": 256, "height": 192}
        or smoke.get("latentResolution") != {"width": 64, "height": 48}
        or smoke.get("epochCount") != 30
        or smoke.get("previewEpochs") != [1, 5, 10, 20, 30]
        or smoke.get("initialization")
        != "fixed_random_denoiser_initialization_without_checkpoint"
        or smoke.get("autoencoderFrozen") is not True
        or smoke.get("denoiserCheckpointPath") is not None
        or smoke.get("denoiserCheckpointReadAllowed") is not False
        or smoke.get("historicalCheckpointAllowed") is not False
        or smoke.get("failedCheckpointAllowed") is not False
        or smoke.get("crossRunArtifactAllowed") is not False
        or smoke.get("automaticTrainingRetryAllowed") is not False
    ):
        raise ValueError("full-backbone controlled Smoke immutable identity changed")
    _verify_bound_file(
        project_root,
        str(compiled["path"]),
        str(compiled["sha256"]),
        "full-backbone compiled controlled Smoke contract",
    )
    qualification = _validate_full_backbone_readonly_qualification_samples(
        config,
        project_root,
    )
    fixed_validation = qualification["fixedValidation"]
    if (
        fixed_validation.get("sampleId") != smoke.get("sampleId")
        or fixed_validation.get("split") != smoke.get("sampleSplit")
    ):
        raise ValueError("full-backbone controlled Smoke sample binding changed")
    return json.loads(json.dumps(dict(smoke), ensure_ascii=False))


def _validate_joint_condition_local_transport_controlled_smoke_identity(
    config: Mapping[str, Any],
    project_root: Path,
) -> dict[str, Any]:
    """Recompute the fixed joint-transport Smoke identity from bound evidence."""

    training = config.get("training")
    evidence = config.get("evidenceBindings")
    if not isinstance(training, Mapping) or not isinstance(evidence, Mapping):
        raise ValueError("joint local-transport controlled Smoke identity is missing")
    smoke = training.get("stage4JointConditionLocalTransportSmokeContract")
    required_fields = {
        "schemaVersion", "status", "compiledContract", "capabilityVersion", "architectureId",
        "sampleId", "sampleSplit", "seed", "topology",
        "requiredBoundarySides", "resolutionStage", "resolution",
        "latentResolution", "epochCount", "optimizerStepCount",
        "previewEpochs", "initialization", "autoencoderFrozen",
        "denoiserCheckpointPath", "denoiserCheckpointReadAllowed",
        "historicalCheckpointAllowed", "failedCheckpointAllowed",
        "crossRunArtifactAllowed", "crossCapabilityArtifactAllowed",
        "automaticTrainingRetryAllowed", "objectiveReviewAlignmentClaimed",
        "formalMachineReviewRemainsAuthoritative", "failureCanPromoteCheckpoint",
    }
    compiled = smoke.get("compiledContract") if isinstance(smoke, Mapping) else None
    if (
        not isinstance(smoke, Mapping)
        or set(smoke) != required_fields
        or smoke.get("schemaVersion")
        != "stage4-joint-condition-local-transport-controlled-smoke-execution-contract-v1"
        or smoke.get("status") != "active_fixed_identity_not_started"
        or not isinstance(compiled, Mapping)
        or set(compiled)
        != {"path", "sha256", "schemaVersion", "status", "compilationRunId"}
        or compiled.get("schemaVersion")
        != "stage4-joint-condition-local-transport-controlled-smoke-contract-v1"
        or compiled.get("status") != "compiled_not_started"
        or re.fullmatch(r"[0-9a-f]{64}", str(compiled.get("sha256", ""))) is None
        or smoke.get("capabilityVersion")
        != "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
        or smoke.get("architectureId")
        != "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
        or smoke.get("sampleId")
        != "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
        or smoke.get("sampleSplit") != "validation"
        or smoke.get("seed") != 20263722
        or smoke.get("topology") != "west"
        or smoke.get("requiredBoundarySides") != ["west"]
        or smoke.get("resolutionStage") != 0
        or smoke.get("resolution") != {"width": 256, "height": 192}
        or smoke.get("latentResolution") != {"width": 64, "height": 48}
        or smoke.get("epochCount") != 30
        or smoke.get("optimizerStepCount") != 30
        or smoke.get("previewEpochs") != [1, 5, 10, 20, 30]
        or smoke.get("initialization")
        != "fixed_random_denoiser_initialization_without_checkpoint"
        or smoke.get("autoencoderFrozen") is not True
        or smoke.get("denoiserCheckpointPath") is not None
        or smoke.get("denoiserCheckpointReadAllowed") is not False
        or smoke.get("historicalCheckpointAllowed") is not False
        or smoke.get("failedCheckpointAllowed") is not False
        or smoke.get("crossRunArtifactAllowed") is not False
        or smoke.get("crossCapabilityArtifactAllowed") is not False
        or smoke.get("automaticTrainingRetryAllowed") is not False
        or smoke.get("objectiveReviewAlignmentClaimed") is not False
        or smoke.get("formalMachineReviewRemainsAuthoritative") is not True
        or smoke.get("failureCanPromoteCheckpoint") is not False
    ):
        raise ValueError("joint local-transport controlled Smoke identity changed")
    _verify_bound_file(
        project_root,
        str(compiled["path"]),
        str(compiled["sha256"]),
        "joint local-transport compiled controlled Smoke contract",
    )
    if evidence.get("compiledControlledSmokeContract") != dict(compiled):
        raise ValueError("joint local-transport compiled Smoke binding changed")

    approved = evidence.get("approvedDataset")
    qualification = evidence.get("qualificationSamples")
    readonly = evidence.get("readonlyGpuQualification")
    if (
        not isinstance(approved, Mapping)
        or approved.get("splitCounts") != EXPECTED_SPLIT
        or not isinstance(qualification, Mapping)
        or not isinstance(readonly, Mapping)
    ):
        raise ValueError("joint local-transport Smoke evidence binding is incomplete")
    source = approved.get("sourceIndex")
    fixed = qualification.get("fixedValidation")
    condition = fixed.get("conditionPack") if isinstance(fixed, Mapping) else None
    reference = fixed.get("approvedReferenceRgb") if isinstance(fixed, Mapping) else None
    if (
        not isinstance(source, Mapping)
        or not isinstance(fixed, Mapping)
        or fixed.get("sampleId") != smoke.get("sampleId")
        or fixed.get("split") != "validation"
        or not isinstance(condition, Mapping)
        or not isinstance(reference, Mapping)
    ):
        raise ValueError("joint local-transport Smoke sample binding changed")
    _verify_bound_file(
        project_root,
        str(source.get("path", "")),
        str(source.get("sha256", "")),
        "joint local-transport approved source index",
    )
    _verify_bound_file(
        project_root,
        str(condition.get("path", "")),
        str(condition.get("sha256", "")),
        "joint local-transport fixed condition pack",
    )
    _verify_bound_file(
        project_root,
        str(reference.get("path", "")),
        str(reference.get("sha256", "")),
        "joint local-transport fixed reference RGB",
    )
    terminal_binding = readonly.get("terminal")
    report_binding = readonly.get("report")
    if not isinstance(terminal_binding, Mapping) or not isinstance(report_binding, Mapping):
        raise ValueError("joint local-transport readonly GPU evidence is missing")
    terminal_path = _verify_bound_file(
        project_root,
        str(terminal_binding.get("path", "")),
        str(terminal_binding.get("sha256", "")),
        "joint local-transport readonly GPU terminal",
    )
    report_path = _verify_bound_file(
        project_root,
        str(report_binding.get("path", "")),
        str(report_binding.get("sha256", "")),
        "joint local-transport readonly GPU report",
    )
    terminal = json.loads(terminal_path.read_text(encoding="utf-8"))
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if (
        terminal.get("status")
        != "stage4_joint_condition_local_transport_readonly_gpu_qualification_succeeded"
        or terminal.get("capabilityVersion") != smoke.get("capabilityVersion")
        or terminal.get("nextLegalAction")
        != "compile_and_execute_stage4_joint_condition_local_transport_controlled_smoke"
        or terminal.get("ownerAuthorizationRequired") is not False
        or terminal.get("ownerResponseRequired") is not False
        or terminal.get("trainingStarted") is not False
        or terminal.get("qualificationReport") != dict(report_binding)
        or report.get("status") != "passed"
        or report.get("runId") != terminal.get("runId")
        or report.get("capabilityVersion") != smoke.get("capabilityVersion")
    ):
        raise ValueError("joint local-transport readonly GPU evidence identity changed")
    return json.loads(json.dumps(dict(smoke), ensure_ascii=False))


def _validate_joint_condition_local_transport_full_data_screen_identity(
    config: Mapping[str, Any],
    project_root: Path,
) -> dict[str, Any]:
    """Recompute the fixed 24-Epoch joint-transport screen identity."""

    training = config.get("training")
    evidence = config.get("evidenceBindings")
    screen = (
        training.get("stage4JointConditionLocalTransportFullDataScreenContract")
        if isinstance(training, Mapping)
        else None
    )
    required_fields = {
        "schemaVersion", "status", "inactiveContract", "capabilityVersion",
        "architectureId", "seed", "resolutionStage", "resolution",
        "latentResolution", "epochCount", "trainSampleCountPerEpoch",
        "validationSampleCount", "challengeSampleCount", "regressionSampleCount",
        "optimizerStepsPerEpoch", "optimizerStepCount", "diffusionStepCount",
        "requiredUniqueTrainingTimestepCount", "inferenceTimestepCount",
        "requiredExactInferenceOverlapCount", "previewEpochs", "initialization",
        "autoencoderFrozen", "denoiserCheckpointPath",
        "denoiserCheckpointReadAllowed", "historicalCheckpointAllowed",
        "failedCheckpointAllowed", "crossRunArtifactAllowed",
        "crossCapabilityArtifactAllowed", "automaticTrainingRetryAllowed",
        "stage0Allowed", "formalMachineReviewRemainsAuthoritative",
        "checkpointPromotionAllowed", "screenCheckpointStage0Eligible",
    }
    inactive = screen.get("inactiveContract") if isinstance(screen, Mapping) else None
    if (
        not isinstance(evidence, Mapping)
        or not isinstance(screen, Mapping)
        or set(screen) != required_fields
        or screen.get("schemaVersion")
        != "stage4-joint-condition-local-transport-24-epoch-full-data-screen-execution-contract-v1"
        or screen.get("status") != "active_fixed_identity_not_started"
        or not isinstance(inactive, Mapping)
        or set(inactive) != {"path", "sha256", "schemaVersion", "status"}
        or evidence.get("inactiveFullDataScreenContract") != dict(inactive)
        or inactive.get("schemaVersion")
        != "stage4-joint-condition-local-transport-24-epoch-full-data-screen-contract-v1"
        or inactive.get("status")
        != "cpu_compiled_inactive_not_authorized_for_gpu_or_training"
        or re.fullmatch(r"[0-9a-f]{64}", str(inactive.get("sha256", ""))) is None
        or screen.get("capabilityVersion")
        != "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
        or screen.get("architectureId")
        != "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
        or screen.get("seed") != 20263722
        or screen.get("resolutionStage") != 0
        or screen.get("resolution") != {"width": 256, "height": 192}
        or screen.get("latentResolution") != {"width": 64, "height": 48}
        or screen.get("epochCount") != 24
        or screen.get("trainSampleCountPerEpoch") != 48
        or screen.get("validationSampleCount") != 8
        or screen.get("challengeSampleCount") != 4
        or screen.get("regressionSampleCount") != 4
        or screen.get("optimizerStepsPerEpoch") != 48
        or screen.get("optimizerStepCount") != 1152
        or screen.get("diffusionStepCount") != 1000
        or screen.get("requiredUniqueTrainingTimestepCount") != 1000
        or screen.get("inferenceTimestepCount") != 50
        or screen.get("requiredExactInferenceOverlapCount") != 50
        or screen.get("previewEpochs") != [5, 10, 15, 20, 24]
        or screen.get("initialization")
        != "fixed_random_denoiser_initialization_without_checkpoint"
        or screen.get("autoencoderFrozen") is not True
        or screen.get("denoiserCheckpointPath") is not None
        or screen.get("denoiserCheckpointReadAllowed") is not False
        or screen.get("historicalCheckpointAllowed") is not False
        or screen.get("failedCheckpointAllowed") is not False
        or screen.get("crossRunArtifactAllowed") is not False
        or screen.get("crossCapabilityArtifactAllowed") is not False
        or screen.get("automaticTrainingRetryAllowed") is not False
        or screen.get("stage0Allowed") is not False
        or screen.get("formalMachineReviewRemainsAuthoritative") is not True
        or screen.get("checkpointPromotionAllowed") is not False
        or screen.get("screenCheckpointStage0Eligible") is not False
    ):
        raise ValueError("joint local-transport full-data screen identity changed")
    contract_path = _verify_bound_file(
        project_root,
        str(inactive.get("path", "")),
        str(inactive.get("sha256", "")),
        "joint local-transport inactive full-data screen contract",
    )
    contract = json.loads(contract_path.read_text(encoding="utf-8-sig"))
    fixed = contract.get("fixedExecutionIdentity")
    if (
        contract.get("schemaVersion") != inactive.get("schemaVersion")
        or contract.get("status") != inactive.get("status")
        or contract.get("architectureId") != screen.get("architectureId")
        or contract.get("capabilityVersion") != screen.get("capabilityVersion")
        or not isinstance(fixed, Mapping)
        or fixed.get("seed") != screen.get("seed")
        or fixed.get("epochCount") != screen.get("epochCount")
        or fixed.get("optimizerStepCount") != screen.get("optimizerStepCount")
        or fixed.get("requiredUniqueTrainingTimestepCount")
        != screen.get("requiredUniqueTrainingTimestepCount")
        or fixed.get("requiredExactInferenceOverlapCount")
        != screen.get("requiredExactInferenceOverlapCount")
        or fixed.get("previewEpochs") != screen.get("previewEpochs")
    ):
        raise ValueError("joint local-transport inactive screen evidence changed")
    return json.loads(json.dumps(dict(screen), ensure_ascii=False))


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
        structure_smoke_preflight = (
            spec.mode_id == _STRUCTURE_SMOKE_MODE_ID
            and execution_state == "preflight_unconsumed"
        )
        phase0_preflight = (
            spec.mode_id == _PHASE0_MODE_ID
            and execution_state == "preflight_unconsumed"
        )
        if phase0_preflight or structure_smoke_preflight:
            if owner.get("executionConsumptionPath") is not None or owner.get("executionConsumptionSha256") is not None:
                raise ValueError("unconsumed preflight cannot carry an execution consumption")
            if authorization.get("status") != "resolved_owner_authorized_not_consumed":
                raise ValueError("unconsumed preflight authorization state is invalid")
            if structure_smoke_preflight:
                if owner.get("preflightOnly") is not True or authorization.get("preflightOnly") is not True:
                    raise ValueError("structure-fact-first Smoke preflight requires preflightOnly=true")
                if any(
                    owner.get(key) is not False
                    for key in (
                        "checkpointLoadingAuthorized", "optimizerCreationAuthorized",
                        "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
                        "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
                        "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized",
                        "strictRevalidationAuthorized", "validationAuthorized",
                        "formalInferenceAuthorized", "checkpointPromotionAuthorized",
                        "runtimeFrameAuthorized", "worldEntryAuthorized",
                        "automaticRetryAuthorized",
                    )
                ):
                    raise ValueError("structure-fact-first Smoke preflight opens a forbidden action")
        else:
            if owner.get("preflightOnly") is True:
                raise ValueError("non-preflight execution cannot carry preflightOnly=true")
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
        if spec.mode_id in {
            _PHASE0_MODE_ID, _STRUCTURE_SMOKE_MODE_ID,
            *_SEMANTIC_MIXTURE_FULL_TRAINING_MODE_IDS,
        }:
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
            required_actions = (
                _PHASE0_REQUIRED_ACTIONS.get(phase0_step)
                if spec.mode_id == _PHASE0_MODE_ID
                else _STRUCTURE_SMOKE_PREFLIGHT_ACTIONS
                if structure_smoke_preflight
                else frozenset(_actions_for_mode(spec))
            )
            if required_actions is None:
                raise ValueError("Owner Phase0 step is unknown")
            if normalized_actions != required_actions:
                raise ValueError("Owner Phase0 actions are incomplete, excessive, or crossed")
            if spec.mode_id == _PHASE0_MODE_ID and normalized_actions - _PHASE0_ALLOWED_ACTIONS:
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
        "preflightOnly": owner.get("preflightOnly", False),
        "executionActions": owner.get("executionActions"),
        "status": owner.get("status"),
    }


def _validate_local_ai_capability_ticket(
    config: Mapping[str, Any],
    spec: ModeSpec,
    project_root: Path,
) -> Mapping[str, Any]:
    training = config.get("training", {})
    ticket_identity = training.get("localAiCapabilityTicket")
    if spec.mode_id in _LOCAL_CPU_INACTIVE_MODE_IDS:
        if ticket_identity is not None:
            raise ValueError(
                "spatial-affine inactive CPU support cannot carry an execution ticket"
            )
        return {
            "requestId": f"local-ai-{spec.mode_id}-cpu-inactive-preflight",
            "commandRef": f"local-ai-{spec.mode_id}-cpu-inactive-preflight",
            "scope": "cpu_readonly_preflight",
            "executionState": "cpu_supported_inactive",
            "preflightOnly": True,
            "executionActions": sorted(
                action.value for action in _actions_for_mode(spec)
            ),
            "status": spec.authorization_status,
            "authority": "local_ai_pet_world_program",
        }
    if not isinstance(ticket_identity, Mapping):
        raise ValueError("local AI capability execution requires an internal capability ticket")
    if spec.mode_id in _SPATIAL_AFFINE_LOCAL_MODE_IDS:
        if set(ticket_identity) != set(_LOCAL_TICKET_V2_IDENTITY_FIELDS):
            raise ValueError("local AI capability ticket v2 identity fields are invalid")
        if (
            ticket_identity.get("status") != spec.authorization_status
            or ticket_identity.get("executionState") != "consumed"
        ):
            raise ValueError("local AI capability ticket v2 mode or state is invalid")
        ticket_path = _verify_bound_file(
            project_root,
            str(ticket_identity.get("ticketPath")),
            str(ticket_identity.get("ticketSha256")),
            "local AI capability ticket v2",
        )
        consumption_path = _verify_bound_file(
            project_root,
            str(ticket_identity.get("consumptionPath")),
            str(ticket_identity.get("consumptionSha256")),
            "local AI capability ticket v2 consumption",
        )
        if ticket_path == consumption_path:
            raise ValueError("local AI capability ticket v2 files are not isolated")
        ticket = json.loads(ticket_path.read_text(encoding="utf-8"))
        consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
        ticket_id = ticket_identity.get("ticketId")
        actions = sorted(action.value for action in _actions_for_mode(spec))
        binding = {
            "boundConfigSha256": ticket_identity.get("boundConfigSha256"),
            "datasetPackageId": ticket_identity.get("datasetPackageId"),
            "runId": ticket_identity.get("runId"),
            "outputNamespace": ticket_identity.get("outputNamespace"),
        }
        _validate_local_execution_binding(
            project_root,
            dataset_package_id=binding["datasetPackageId"],
            run_id=binding["runId"],
            output_namespace=binding["outputNamespace"],
        )
        if binding["boundConfigSha256"] != local_ai_ticket_bound_config_sha256(config):
            raise ValueError("local AI capability ticket v2 config binding is invalid")
        if (
            set(ticket)
            != {
                "schemaVersion", "status", "ticketId", "modeId",
                "capabilityAuthority", "ownerAuthorizationRequired",
                "executionActions", "binding",
            }
            or ticket.get("schemaVersion")
            != "ai-painter-local-internal-capability-ticket-v2"
            or ticket.get("status") != "issued_not_consumed"
            or ticket.get("ticketId") != ticket_id
            or ticket.get("modeId") != spec.mode_id
            or ticket.get("capabilityAuthority") != "local_ai_pet_world_program"
            or ticket.get("ownerAuthorizationRequired") is not False
            or sorted(ticket.get("executionActions", [])) != actions
            or ticket.get("binding") != binding
            or sorted(ticket_identity.get("executionActions", [])) != actions
        ):
            raise ValueError("local AI capability ticket v2 immutable identity is invalid")
        if (
            set(consumption)
            != {
                "schemaVersion", "ticketId", "ticketSha256",
                "oneTimeConsumption", "state", "binding",
            }
            or consumption.get("schemaVersion")
            != "ai-painter-local-internal-capability-ticket-consumption-v2"
            or consumption.get("ticketId") != ticket_id
            or consumption.get("ticketSha256")
            != ticket_identity.get("ticketSha256")
            or consumption.get("oneTimeConsumption") is not True
            or consumption.get("state") != "consumed"
            or consumption.get("binding") != binding
        ):
            raise ValueError("local AI capability ticket v2 consumption is invalid")
        return {
            **binding,
            "ticketId": ticket_id,
            "ticketPath": ticket_identity.get("ticketPath"),
            "ticketSha256": ticket_identity.get("ticketSha256"),
            "consumptionPath": ticket_identity.get("consumptionPath"),
            "consumptionSha256": ticket_identity.get("consumptionSha256"),
            "executionState": "consumed",
            "status": spec.authorization_status,
            "executionActions": actions,
            "authority": "local_ai_pet_world_program",
        }
    required = {
        "ticketId", "ticketPath", "ticketSha256", "consumptionPath",
        "consumptionSha256", "executionState", "status", "executionActions",
    }
    if set(ticket_identity) != required:
        raise ValueError("local AI capability ticket identity fields are invalid")
    if (
        spec.mode_id not in _AUTHORITATIVE_SEMANTIC_CARRIER_LOCAL_MODE_IDS
        or ticket_identity.get("status") != spec.authorization_status
        or ticket_identity.get("executionState") != "consumed"
    ):
        raise ValueError("local AI capability ticket mode or state is invalid")
    ticket_path = _verify_bound_file(
        project_root, str(ticket_identity.get("ticketPath")),
        str(ticket_identity.get("ticketSha256")), "local AI capability ticket",
    )
    consumption_path = _verify_bound_file(
        project_root, str(ticket_identity.get("consumptionPath")),
        str(ticket_identity.get("consumptionSha256")), "local AI capability ticket consumption",
    )
    ticket = json.loads(ticket_path.read_text(encoding="utf-8"))
    consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
    ticket_id = ticket_identity.get("ticketId")
    actions = sorted(action.value for action in _actions_for_mode(spec))
    if (
        ticket.get("schemaVersion") != "ai-painter-local-internal-capability-ticket-v1"
        or ticket.get("status") != "issued_not_consumed"
        or ticket.get("ticketId") != ticket_id
        or ticket.get("modeId") != spec.mode_id
        or ticket.get("capabilityAuthority") != "local_ai_pet_world_program"
        or ticket.get("ownerAuthorizationRequired") is not False
        or sorted(ticket.get("executionActions", [])) != actions
        or sorted(ticket_identity.get("executionActions", [])) != actions
    ):
        raise ValueError("local AI capability ticket immutable identity is invalid")
    if (
        consumption.get("schemaVersion") != "ai-painter-local-internal-capability-ticket-consumption-v1"
        or consumption.get("ticketId") != ticket_id
        or consumption.get("ticketSha256") != ticket_identity.get("ticketSha256")
        or consumption.get("oneTimeConsumption") is not True
        or consumption.get("state") != "consumed"
    ):
        raise ValueError("local AI capability ticket consumption is invalid")
    return {
        "ticketId": ticket_id,
        "ticketPath": ticket_identity.get("ticketPath"),
        "ticketSha256": ticket_identity.get("ticketSha256"),
        "consumptionPath": ticket_identity.get("consumptionPath"),
        "consumptionSha256": ticket_identity.get("consumptionSha256"),
        "executionState": "consumed",
        "status": spec.authorization_status,
        "executionActions": actions,
        "authority": "local_ai_pet_world_program",
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
    owner_identity = (
        _validate_local_ai_capability_ticket(config, spec, root)
        if spec.mode_id in (
            _AUTHORITATIVE_SEMANTIC_CARRIER_LOCAL_MODE_IDS
            | _SPATIAL_AFFINE_LOCAL_MODE_IDS
        )
        else _validate_owner_training_authorization(training, spec, root, verify_owner_files)
    )
    smoke = training.get("stage4JointConditionLocalTransportFullDataScreenContract") or training.get("stage4JointConditionLocalTransportSmokeContract") or training.get("stage4FullBackboneSpatialAffineSmokeContract") or training.get("stage4PostDecodeFullConditionResponsibilitySmokeContract") or training.get("stage4PostDecodeObjectRgbSmokeContract") or training.get("stage4AuthoritativeSemanticCarrierSmokeContract") or training.get("structureFactFirstStage4SingleSampleSmokeContract") or training.get("v9Stage4SingleSampleSmokeContract") or training.get(
        "v8Stage4SingleSampleSmokeContract"
    ) or training.get("r5Stage4BoundedRepairSmokeContract") or {}
    sample_id = smoke.get("sampleId") or training.get("authorizedOverfitSampleId")
    required_boundary_sides = (
        smoke.get("requiredBoundarySides")
        or training.get("requiredBoundarySides")
        or (["west"] if spec.architecture.endswith("object_semantic_decoded_alignment") else [])
    )
    qualification_samples = (
        _validate_full_backbone_readonly_qualification_samples(config, root)
        if spec.mode_id == _FULL_BACKBONE_READONLY_GPU_MODE_ID
        else None
    )
    controlled_smoke = (
        _validate_full_backbone_controlled_smoke_identity(config, root)
        if spec.mode_id == _FULL_BACKBONE_CONTROLLED_SMOKE_MODE_ID
        else _validate_joint_condition_local_transport_controlled_smoke_identity(
            config, root
        )
        if spec.mode_id
        == _JOINT_CONDITION_LOCAL_TRANSPORT_CONTROLLED_SMOKE_MODE_ID
        else None
    )
    full_data_screen = (
        _validate_joint_condition_local_transport_full_data_screen_identity(
            config, root
        )
        if spec.mode_id
        == _JOINT_CONDITION_LOCAL_TRANSPORT_FULL_DATA_SCREEN_MODE_ID
        else None
    )
    dataset_constraints = {
        "capacity": 64,
        "splitCounts": EXPECTED_SPLIT,
        "selectedSplit": spec.sample_split,
        "sampleId": sample_id,
        "requiredBoundarySides": required_boundary_sides,
        "sampleMustRemainInRegisteredSplit": True,
    }
    if qualification_samples is not None:
        dataset_constraints.update({
            "preboundReadOnlySamples": True,
            "freeSampleSelectionAllowed": False,
            "selectBoundSampleActionRequired": False,
            "qualificationSamples": qualification_samples,
        })
    if controlled_smoke is not None:
        dataset_constraints.update({
            "fixedControlledSmoke": True,
            "seed": controlled_smoke["seed"],
            "topology": controlled_smoke["topology"],
            "resolutionStage": controlled_smoke["resolutionStage"],
            "resolution": controlled_smoke["resolution"],
            "epochCount": controlled_smoke["epochCount"],
            "previewEpochs": controlled_smoke["previewEpochs"],
            "automaticTrainingRetryAllowed": False,
        })
    if full_data_screen is not None:
        dataset_constraints.update({
            "fixedFullDataScreen": True,
            "seed": full_data_screen["seed"],
            "resolutionStage": full_data_screen["resolutionStage"],
            "resolution": full_data_screen["resolution"],
            "epochCount": full_data_screen["epochCount"],
            "trainSampleCountPerEpoch": full_data_screen["trainSampleCountPerEpoch"],
            "validationSampleCount": full_data_screen["validationSampleCount"],
            "challengeSampleCount": full_data_screen["challengeSampleCount"],
            "regressionSampleCount": full_data_screen["regressionSampleCount"],
            "optimizerStepsPerEpoch": full_data_screen["optimizerStepsPerEpoch"],
            "optimizerStepCount": full_data_screen["optimizerStepCount"],
            "diffusionStepCount": full_data_screen["diffusionStepCount"],
            "requiredUniqueTrainingTimestepCount": (
                full_data_screen["requiredUniqueTrainingTimestepCount"]
            ),
            "inferenceTimestepCount": full_data_screen["inferenceTimestepCount"],
            "requiredExactInferenceOverlapCount": (
                full_data_screen["requiredExactInferenceOverlapCount"]
            ),
            "previewEpochs": full_data_screen["previewEpochs"],
            "automaticTrainingRetryAllowed": False,
        })
    checkpoint_constraints = {
        "identityInspectionOnlyDuringCpuDryRun": True,
        "parentDenoiserAllowed": (
            spec.architecture == "multiscale_condition_unet_v7"
            and spec.execution_kind == "single_sample_smoke"
        ) or spec.execution_kind in {"full_training_stage1", "full_training_stage2"},
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
    if (
        qualification_samples is not None
        and ExecutionAction.SELECT_BOUND_SAMPLE in mode_actions
    ):
        raise ValueError(
            "readonly GPU prebound samples cannot open free sample selection"
        )
    owner_actions = owner_identity.get("executionActions")
    if spec.mode_id in {
        _PHASE0_MODE_ID, _STRUCTURE_SMOKE_MODE_ID,
        *_SEMANTIC_MIXTURE_FULL_TRAINING_MODE_IDS,
    }:
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

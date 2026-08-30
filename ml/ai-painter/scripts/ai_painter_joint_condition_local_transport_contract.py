from __future__ import annotations

from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re
from typing import Any, Mapping

from ai_painter_authorization_policy import (
    execution_action_values_for_stage_config,
    local_ai_ticket_bound_config_sha256,
    resolve_stage_execution_grant,
)

from ai_painter_full_backbone_spatial_affine_contract import (
    ACTIVATION_GATE_KEYS,
    CONDITION_RESIZE_CONTRACT,
    derive_formal_condition_identity,
)
from ai_painter_stage_mode_registry import (
    JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_INACTIVE_STATUS,
    JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_READONLY_GPU_STATUS,
    JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_SMOKE_STATUS,
    JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_FULL_DATA_SCREEN_STATUS,
    resolve_stage_mode,
)
from ai_painter_spatial_affine_decoder_contract import (
    FORMAL_LOSS_SOURCE_EVIDENCE,
    compile_spatial_affine_decoder_cpu_inactive_config,
    load_spatial_affine_formal_objective_contract,
)


ARCHITECTURE_ID = (
    "stage4_full_backbone_joint_condition_local_transport_denoiser_v1"
)
CAPABILITY_VERSION = ARCHITECTURE_ID
CONDITION_CHANNELS = 23
LATENT_CHANNELS = 12
AUTOENCODER_BASE_CHANNELS = 48
DENOISER_BASE_CHANNELS = 64
TIME_EMBEDDING_CHANNELS = 256
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DESIGN_TERMINAL_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/stage4-joint-condition-local-transport-designs/"
        "stage4-joint-condition-local-transport-design-20260829T164714133Z-"
        "de2af4b2/phase-terminal.json"
    ),
    "sha256": "e190cdb48f516eca2427e3554add5a8d3ff15fa19662660baf9e68ef3cdd24dd",
}
DESIGN_CONTRACT_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/stage4-joint-condition-local-transport-designs/"
        "stage4-joint-condition-local-transport-design-20260829T164714133Z-"
        "de2af4b2/inactive-model-family-contract.json"
    ),
    "sha256": "d1b82dba39a617abdbbd998057e30c24ea976477a8db5ef8835d70d095d0da1a",
}
CPU_SUPPORT_TERMINAL_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/"
        "stage4-joint-condition-local-transport-cpu-supports/"
        "stage4-joint-condition-local-transport-cpu-support-"
        "20260829T172108835Z-b8f9a501/phase-terminal.json"
    ),
    "sha256": "2ee822859a2ad3aa6420c8ce8a04b9a186aafc6240b278e2bbb93c8d350115bf",
}
READONLY_GPU_OUTPUT_ROOT = (
    ".runtime/ai-painter/"
    "stage4-joint-condition-local-transport-readonly-gpu-qualifications"
)
READONLY_GPU_TICKET_ROOT = (
    ".runtime/ai-painter/"
    "stage4-joint-condition-local-transport-readonly-gpu-tickets"
)
CONTROLLED_SMOKE_OUTPUT_ROOT = (
    ".runtime/ai-painter/"
    "stage4-joint-condition-local-transport-controlled-smokes"
)
CONTROLLED_SMOKE_CONTRACT_ROOT = (
    ".runtime/ai-painter/"
    "stage4-joint-condition-local-transport-smoke-contract-compilations"
)
# Ticket and consumption evidence live inside the one immutable Smoke run root.
# A parallel ticket namespace would allow an old candidate/run to be substituted.
CONTROLLED_SMOKE_TICKET_ROOT = CONTROLLED_SMOKE_OUTPUT_ROOT
FULL_DATA_SCREEN_OUTPUT_ROOT = (
    ".runtime/ai-painter/"
    "stage4-joint-condition-local-transport-full-data-screens"
)
# The screen owns its ticket and consumption evidence.  Keeping them below the
# run root makes replay of a Smoke or exited-candidate ticket impossible.
FULL_DATA_SCREEN_TICKET_ROOT = FULL_DATA_SCREEN_OUTPUT_ROOT
FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/"
        "stage4-joint-condition-local-transport-smoke-training-coverage-"
        "adjudications/stage4-joint-condition-local-transport-smoke-coverage-"
        "adjudication-20260830012309779/"
        "inactive-24-epoch-full-data-screen-contract.json"
    ),
    "sha256": "8f39498fe6618b0b5be268fe908637c1929ee3fe6233bbaf5981c414505f700b",
}
FULL_DATA_SCREEN_COVERAGE_DECISION_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/"
        "stage4-joint-condition-local-transport-smoke-training-coverage-"
        "adjudications/stage4-joint-condition-local-transport-smoke-coverage-"
        "adjudication-20260830012309779/unique-decision.json"
    ),
    "sha256": "ab47e08c51ad37f155c0075a6f0e078a876c4fc652b12564938b70fcd08e6b39",
}
READONLY_GPU_TERMINAL_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/"
        "stage4-joint-condition-local-transport-readonly-gpu-qualifications/"
        "stage4-joint-condition-local-transport-readonly-gpu-"
        "20260829T174021481Z-3518e67b/phase-terminal.json"
    ),
    "sha256": "1d90720201d71d52a1a58445b9abd1c3ea15e4c869772c08a8e12baf09325b6a",
}
READONLY_GPU_REPORT_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/"
        "stage4-joint-condition-local-transport-readonly-gpu-qualifications/"
        "stage4-joint-condition-local-transport-readonly-gpu-"
        "20260829T174021481Z-3518e67b/readonly-gpu-qualification-report.json"
    ),
    "sha256": "d8ba165373fedb687a32287c1a9f8ec39e2f37f884aab2c63f5bd70ba76f8234",
}
FIRST_TRAIN_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
)
FIXED_VALIDATION_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
)
FROZEN_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
_FIXED_CONDITION_PACK_SHA256 = {
    "firstTrain": "05ff62ecdce5a4d545af0dc4652e64fe580d272f032049a8b464924bb751e3aa",
    "fixedValidation": "2db536def8a3b7d3049b7cae673942edd77aa1151f432dc5774f2b3a33579ca9",
}
_SAFE_RUN_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{7,127}")
_READONLY_ALLOWED_ACTIONS = [
    "inspect_autoencoder_identity",
    "inspect_checkpoint_identity",
    "load_autoencoder",
]
_READONLY_FORBIDDEN_ACTIONS = [
    "automatic_retry",
    "create_optimizer",
    "create_runtime_frame",
    "enter_world",
    "execute_backward",
    "load_parent_denoiser",
    "mutate_model_weights",
    "promote_checkpoint",
    "run_formal_inference",
    "run_stage0",
    "run_stage1",
    "run_stage2",
    "run_strict_revalidation",
    "select_bound_sample",
    "write_diagnostic_checkpoint",
    "write_smoke_checkpoint",
]
_CONTROLLED_SMOKE_ALLOWED_ACTIONS = [
    "create_optimizer",
    "execute_backward",
    "inspect_autoencoder_identity",
    "inspect_checkpoint_identity",
    "load_autoencoder",
    "mutate_model_weights",
    "select_bound_sample",
    "write_smoke_checkpoint",
]
_CONTROLLED_SMOKE_FORBIDDEN_ACTIONS = [
    "automatic_retry",
    "create_runtime_frame",
    "enter_world",
    "load_parent_denoiser",
    "promote_checkpoint",
    "run_formal_inference",
    "run_stage0",
    "run_stage1",
    "run_stage2",
    "run_strict_revalidation",
    "write_diagnostic_checkpoint",
]
_FULL_DATA_SCREEN_ALLOWED_ACTIONS = [
    action for action in _CONTROLLED_SMOKE_ALLOWED_ACTIONS
    if action != "select_bound_sample"
]
_FULL_DATA_SCREEN_FORBIDDEN_ACTIONS = sorted({
    *_CONTROLLED_SMOKE_FORBIDDEN_ACTIONS,
    "select_bound_sample",
})

_BLOCK_BOUNDARIES = (
    ("block0", "encoder_level0", 64, 64, 48),
    ("block1", "encoder_level1", 128, 32, 24),
    ("middle1", "bottleneck_first", 256, 16, 12),
    ("middle2", "bottleneck_second", 256, 16, 12),
    ("up_block1", "decoder_level1", 128, 32, 24),
    ("up_block0", "decoder_level0", 64, 64, 48),
)

_NEIGHBOR_OFFSETS = (
    (-1, -1), (-1, 0), (-1, 1),
    (0, -1), (0, 0), (0, 1),
    (1, -1), (1, 0), (1, 1),
)


def _sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_bound_json(binding: dict) -> dict:
    relative_path = Path(binding["path"])
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError(
            "joint-condition local-transport evidence path escapes the project namespace"
        )
    file_path = PROJECT_ROOT / relative_path
    if (
        not file_path.is_file()
        or _sha256_file(file_path) != binding["sha256"]
    ):
        raise ValueError("joint-condition local-transport design evidence mismatch")
    value = json.loads(file_path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("joint-condition local-transport evidence must be an object")
    return value


def derive_local_transport_block_contracts() -> list[dict]:
    blocks = []
    for block_id, role, channels, width, height in _BLOCK_BOUNDARIES:
        projections = []
        for norm_position in ("norm1", "norm2"):
            projections.append({
                "normPosition": norm_position,
                "parameterNamespace": (
                    f"denoiser.{block_id}.local_transport_{norm_position}"
                ),
                "module": "Conv2d",
                "inputChannels": CONDITION_CHANNELS,
                "outputChannels": 9,
                "kernelSize": 3,
                "padding": 1,
                "bias": True,
                "parameterTensorCount": 2,
                "parameterCount": 9 * CONDITION_CHANNELS * 3 * 3 + 9,
            })
        blocks.append({
            "blockId": block_id,
            "module": "TimeResidualBlock",
            "role": role,
            "featureChannels": channels,
            "stage0SpatialWidth": width,
            "stage0SpatialHeight": height,
            "normalizationPointCount": 2,
            "transportPlacement": (
                "replace_group_norm_output_before_existing_silu_and_convolution"
            ),
            "projectionCount": 2,
            "parameterTensorCount": 4,
            "parameterCount": sum(
                projection["parameterCount"] for projection in projections
            ),
            "projections": projections,
        })
    return blocks


def _transport_contract() -> dict:
    design_terminal = _load_bound_json(DESIGN_TERMINAL_EVIDENCE)
    design_contract = _load_bound_json(DESIGN_CONTRACT_EVIDENCE)
    if (
        design_terminal.get("status")
        != "stage4_joint_condition_local_transport_cpu_design_succeeded_inactive"
        or design_terminal.get("candidateCapabilityVersion")
        != CAPABILITY_VERSION
        or design_contract.get("status")
        != "cpu_design_supported_implementation_inactive"
        or design_contract.get("capabilityVersion") != CAPABILITY_VERSION
        or design_contract.get("objectiveReviewAlignmentClaimed") is not False
    ):
        raise ValueError("joint-condition local-transport design identity is invalid")
    blocks = derive_local_transport_block_contracts()
    parameter_count = sum(block["parameterCount"] for block in blocks)
    parameter_tensor_count = sum(
        block["parameterTensorCount"] for block in blocks
    )
    return {
        "schemaVersion": "stage4-joint-condition-local-transport-contract-v1",
        "status": "cpu_supported_inactive",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "conditionChannels": CONDITION_CHANNELS,
        "latentChannels": LATENT_CHANNELS,
        "timeEmbeddingChannels": TIME_EMBEDDING_CHANNELS,
        "blockCount": len(blocks),
        "siteCount": sum(block["projectionCount"] for block in blocks),
        "parameterTensorCount": parameter_tensor_count,
        "parameterCount": parameter_count,
        "parametersPerSite": 9 * CONDITION_CHANNELS * 3 * 3 + 9,
        "neighborOffsets": [list(value) for value in _NEIGHBOR_OFFSETS],
        "neighborOrder": "row_major_top_left_to_bottom_right",
        "offCanvasPolicy": "mask_invalid_then_renormalize_valid_neighbors",
        "softmaxAxis": "nine_neighbor_offsets",
        "softmaxTemperature": 1,
        "featureChannelSharedStencil": True,
        "siteProjectionSharingAllowed": False,
        "spatialAffineCoexistenceAllowed": False,
        "residualTransportBlendAllowed": False,
        "blocks": blocks,
        "objectiveReviewAlignmentClaimed": False,
        "sufficientSemanticRepairClaimed": False,
        "sufficientTopologyRepairClaimed": False,
        "designEvidence": {
            "terminal": deepcopy(DESIGN_TERMINAL_EVIDENCE),
            "contract": deepcopy(DESIGN_CONTRACT_EVIDENCE),
        },
    }


def _inactive_gates() -> dict[str, bool]:
    return {key: False for key in ACTIVATION_GATE_KEYS}


def _execution_boundary() -> dict[str, bool]:
    return {
        "checkpointWeightsRead": False,
        "gpuStarted": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "smokeStarted": False,
        "trainingStarted": False,
        "formalInferenceStarted": False,
        "checkpointPromoted": False,
        "runtimeFrameCreated": False,
        "worldEntered": False,
    }


def _expected_config() -> dict:
    condition_identity = derive_formal_condition_identity()
    return {
        "schemaVersion": (
            "ai-painter-stage4-joint-condition-local-transport-cpu-inactive-config-v1"
        ),
        "status": "cpu_supported_inactive",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "baseChannels": AUTOENCODER_BASE_CHANNELS,
        "denoiserBaseChannels": DENOISER_BASE_CHANNELS,
        "latentChannels": LATENT_CHANNELS,
        "conditionChannels": CONDITION_CHANNELS,
        "timeEmbeddingChannels": TIME_EMBEDDING_CHANNELS,
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "latentDownsampleFactor": 4,
        "denoiserArchitecture": ARCHITECTURE_ID,
        "conditionChannelOrder": deepcopy(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": deepcopy(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": CONDITION_RESIZE_CONTRACT,
        "diffusionSteps": 1000,
        "stage0Resolution": {"width": 256, "height": 192},
        "stage0LatentResolution": {"width": 64, "height": 48},
        "widthHierarchy": [64, 128, 256],
        "jointConditionLocalTransportContract": _transport_contract(),
        "training": {
            "trainingAuthorizationStatus": (
                JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_INACTIVE_STATUS
            ),
        },
        "activationGates": _inactive_gates(),
        "executionBoundary": _execution_boundary(),
    }


def compile_joint_condition_local_transport_cpu_inactive_config() -> dict:
    config = _expected_config()
    validate_joint_condition_local_transport_cpu_inactive_config(config)
    return deepcopy(config)


def validate_joint_condition_local_transport_cpu_inactive_config(
    config: dict,
) -> dict:
    if not isinstance(config, dict) or config != _expected_config():
        raise ValueError(
            "joint-condition local-transport inactive contract identity changed"
        )
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != "joint_condition_local_transport_stage4_inactive"
        or mode.architecture != ARCHITECTURE_ID
        or mode.execution_kind != "cpu_inactive"
        or mode.active_execution is not False
    ):
        raise ValueError(
            "joint-condition local-transport inactive Mode Registry binding changed"
        )
    if any(config["activationGates"].values()):
        raise ValueError("inactive local-transport config opened an activation gate")
    if any(config["executionBoundary"].values()):
        raise ValueError("inactive local-transport config recorded an execution side effect")
    return {
        "status": "valid_cpu_supported_inactive",
        "modeId": mode.mode_id,
        "architectureId": ARCHITECTURE_ID,
        "parameterCount": config[
            "jointConditionLocalTransportContract"
        ]["parameterCount"],
        "ownerAuthorizationRequired": False,
        "gpuAllowed": False,
        "trainingAllowed": False,
    }


def _validate_readonly_execution_identity(
    run_id: Any,
    output_namespace: Any,
) -> tuple[str, str]:
    if not isinstance(run_id, str) or _SAFE_RUN_ID.fullmatch(run_id) is None:
        raise ValueError("joint-condition local-transport readonly GPU run identity is invalid")
    if not isinstance(output_namespace, str):
        raise ValueError("joint-condition local-transport readonly GPU namespace is invalid")
    relative = Path(output_namespace)
    expected_parent = Path(READONLY_GPU_OUTPUT_ROOT)
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.parent.as_posix() != expected_parent.as_posix()
        or relative.name != run_id
    ):
        raise ValueError(
            "joint-condition local-transport readonly GPU namespace is not isolated"
        )
    return run_id, relative.as_posix()


def _binding_for_project_file(relative_path: str, expected_sha256: str) -> dict:
    logical = Path(relative_path)
    if logical.is_absolute() or ".." in logical.parts:
        raise ValueError("readonly GPU evidence path escapes the project namespace")
    file_path = PROJECT_ROOT / logical
    if not file_path.is_file() or _sha256_file(file_path) != expected_sha256:
        raise ValueError("readonly GPU evidence binding changed")
    return {"path": logical.as_posix(), "sha256": expected_sha256}


def _derive_readonly_gpu_evidence_bindings() -> dict:
    cpu_terminal = _load_bound_json(CPU_SUPPORT_TERMINAL_EVIDENCE)
    if (
        cpu_terminal.get("executionState") != "completed"
        or cpu_terminal.get("status")
        != "stage4_joint_condition_local_transport_cpu_support_succeeded_inactive"
        or cpu_terminal.get("capabilityVersion") != CAPABILITY_VERSION
        or cpu_terminal.get("nextLegalAction")
        != "qualify_stage4_joint_condition_local_transport_readonly_gpu"
        or cpu_terminal.get("ownerAuthorizationRequired") is not False
        or cpu_terminal.get("gpuStarted") is not False
        or cpu_terminal.get("trainingStarted") is not False
    ):
        raise ValueError("joint-condition local-transport CPU terminal identity is invalid")

    formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
    data = formal.get("data", {})
    model = formal.get("modelBoundary", {})
    if data.get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("formal approved 64-record split identity changed")
    source_binding = _binding_for_project_file(
        str(data.get("sourceIndexPath", "")),
        str(data.get("sourceIndexSha256", "")),
    )
    manifest_binding = _binding_for_project_file(
        str(data.get("datasetManifestPath", "")),
        str(data.get("datasetManifestSha256", "")),
    )
    source_index = json.loads(
        (PROJECT_ROOT / Path(source_binding["path"])).read_text(encoding="utf-8-sig")
    )
    all_samples = source_index.get("samples")
    if (
        not isinstance(all_samples, list)
        or source_index.get("sampleCount") != len(all_samples)
    ):
        raise ValueError("formal source index identity changed")
    samples = [
        row for row in all_samples
        if row.get("v7CapacityContributionRegistered") is True
    ]
    selected_split_counts = {
        split: sum(1 for row in samples if row.get("split") == split)
        for split in FROZEN_SPLIT_COUNTS
    }
    if (
        len(samples) != 64
        or len({row.get("recordId") for row in samples}) != 64
        or selected_split_counts != FROZEN_SPLIT_COUNTS
    ):
        raise ValueError("formal approved 64-record selection identity changed")

    identities = {}
    for role, sample_id, split in (
        ("firstTrain", FIRST_TRAIN_SAMPLE_ID, "train"),
        ("fixedValidation", FIXED_VALIDATION_SAMPLE_ID, "validation"),
    ):
        matches = [row for row in samples if row.get("recordId") == sample_id]
        if (
            len(matches) != 1
            or matches[0].get("split") != split
            or matches[0].get("formalConditionalTrainingEligible") is not True
            or matches[0].get("conditionBound") is not True
        ):
            raise ValueError(f"formal {role} qualification sample identity changed")
        row = matches[0]
        condition_binding = _binding_for_project_file(
            str(row.get("conditionPackPath", "")),
            _FIXED_CONDITION_PACK_SHA256[role],
        )
        image_binding = _binding_for_project_file(
            str(row.get("imagePath", "")),
            str(row.get("imageSha256", "")),
        )
        identities[role] = {
            "sampleId": sample_id,
            "split": split,
            "conditionPack": condition_binding,
            "approvedReferenceRgb": image_binding,
        }

    autoencoder_binding = _binding_for_project_file(
        str(model.get("autoencoderCheckpointPath", "")),
        str(model.get("autoencoderCheckpointSha256", "")),
    )
    return {
        "cpuSupportTerminal": deepcopy(CPU_SUPPORT_TERMINAL_EVIDENCE),
        "formalObjectiveContract": deepcopy(FORMAL_LOSS_SOURCE_EVIDENCE),
        "approvedDataset": {
            "datasetPackageId": data.get("datasetPackageId"),
            "splitCounts": deepcopy(FROZEN_SPLIT_COUNTS),
            "manifest": manifest_binding,
            "sourceIndex": source_binding,
        },
        "qualificationSamples": identities,
        "autoencoderCheckpoint": {
            **autoencoder_binding,
            "provenance": model.get("autoencoderRequiredCheckpointProvenance"),
            "loadAllowed": True,
            "stateMutationAllowed": False,
        },
    }


def _readonly_gpu_gates() -> dict[str, bool]:
    return {
        key: key in {"gpuNow", "readonlyGpuQualificationNow"}
        for key in ACTIVATION_GATE_KEYS
    }


def _readonly_gpu_boundary() -> dict:
    return {
        "allowedExecutionActions": deepcopy(_READONLY_ALLOWED_ACTIONS),
        "forbiddenExecutionActions": deepcopy(_READONLY_FORBIDDEN_ACTIONS),
        "autoencoderLoadAllowed": True,
        "denoiserCheckpointReadAllowed": False,
        "optimizerCreationAllowed": False,
        "backwardExecutionAllowed": False,
        "modelWeightMutationAllowed": False,
        "checkpointWriteAllowed": False,
        "trainingAllowed": False,
        "formalInferenceAllowed": False,
        "runtimeFrameAllowed": False,
        "worldEntryAllowed": False,
    }


def _compile_readonly_gpu_config_template(
    *,
    run_id: str,
    output_namespace: str,
) -> dict:
    normalized_run_id, normalized_output = _validate_readonly_execution_identity(
        run_id, output_namespace
    )
    config = compile_joint_condition_local_transport_cpu_inactive_config()
    config["schemaVersion"] = (
        "ai-painter-stage4-joint-condition-local-transport-readonly-gpu-config-v1"
    )
    config["status"] = "readonly_gpu_qualification_active"
    config["ownerAuthorizationRequired"] = False
    config["ownerResponseRequired"] = False
    config["executionIdentity"] = {
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
        "namespaceReuseAllowed": False,
        "crossRunEvidenceAllowed": False,
    }
    config["evidenceBindings"] = _derive_readonly_gpu_evidence_bindings()
    config["jointConditionLocalTransportContract"]["status"] = (
        "active_local_ai_internal_readonly_gpu_qualification"
    )
    config["activationGates"] = _readonly_gpu_gates()
    config["readOnlyGpuBoundary"] = _readonly_gpu_boundary()
    config["training"] = {
        "trainingAuthorizationStatus": (
            JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_READONLY_GPU_STATUS
        ),
    }
    return config


def build_joint_condition_local_transport_readonly_gpu_config_template(
    *,
    run_id: str,
    output_namespace: str,
) -> dict:
    config = _compile_readonly_gpu_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
    )
    validate_joint_condition_local_transport_readonly_gpu_config(
        config, require_execution_ticket=False
    )
    return deepcopy(config)


def materialize_joint_condition_local_transport_readonly_gpu_config(
    template: dict,
    *,
    local_ai_capability_ticket: dict,
) -> dict:
    active = deepcopy(template)
    training = active.get("training")
    if not isinstance(training, dict) or "localAiCapabilityTicket" in training:
        raise ValueError("readonly GPU template is not pristine")
    training["localAiCapabilityTicket"] = deepcopy(local_ai_capability_ticket)
    validate_joint_condition_local_transport_readonly_gpu_config(
        active, require_execution_ticket=True
    )
    return active


def _write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def _expected_json_bytes(value: Mapping[str, Any]) -> bytes:
    return (
        json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")


def _verify_exact_json_file(
    path: Path,
    expected: Mapping[str, Any],
    *,
    label: str,
) -> str:
    expected_bytes = _expected_json_bytes(expected)
    if not path.is_file() or path.read_bytes() != expected_bytes:
        raise ValueError(f"{label} immutable bytes are invalid")
    expected_sha256 = hashlib.sha256(expected_bytes).hexdigest()
    if _sha256_file(path) != expected_sha256:
        raise ValueError(f"{label} SHA-256 is invalid")
    if json.loads(path.read_text(encoding="utf-8")) != dict(expected):
        raise ValueError(f"{label} fields are invalid")
    return expected_sha256


def _resolve_project_relative_file(
    project_root: Path,
    relative_path: str,
    *,
    label: str,
) -> Path:
    candidate = Path(relative_path)
    if (
        candidate.is_absolute()
        or not candidate.parts
        or any(part in {"", ".", ".."} for part in candidate.parts)
    ):
        raise ValueError(f"{label} path is not project relative")
    root = project_root.resolve()
    lexical_root = Path(os.path.abspath(project_root))
    lexical_path = Path(os.path.abspath(lexical_root / candidate))
    try:
        lexical_path.relative_to(lexical_root)
    except ValueError as error:
        raise ValueError(f"{label} path escapes the project") from error
    resolved = lexical_path.resolve()
    allowed_physical_roots = [root]
    if candidate.parts[0] == ".runtime":
        runtime_root = (lexical_root / ".runtime").resolve()
        allowed_physical_roots.append(runtime_root)
    if not any(
        resolved == allowed_root
        or allowed_root in resolved.parents
        for allowed_root in allowed_physical_roots
    ):
        raise ValueError(f"{label} path escapes the registered project storage")
    if not resolved.is_file():
        raise ValueError(f"{label} file is missing")
    return resolved


def issue_and_consume_joint_condition_local_transport_readonly_gpu_ticket(
    *,
    dataset_package_id: str,
    run_id: str,
    output_namespace: str,
) -> tuple[dict, dict]:
    normalized_run_id, normalized_output = _validate_readonly_execution_identity(
        run_id, output_namespace
    )
    template = build_joint_condition_local_transport_readonly_gpu_config_template(
        run_id=normalized_run_id,
        output_namespace=normalized_output,
    )
    expected_dataset = template["evidenceBindings"]["approvedDataset"][
        "datasetPackageId"
    ]
    if dataset_package_id != expected_dataset:
        raise ValueError("readonly GPU dataset package identity changed")
    if (PROJECT_ROOT / Path(normalized_output)).exists():
        raise ValueError("readonly GPU output namespace reuse is forbidden")

    ticket_directory = (
        PROJECT_ROOT / Path(READONLY_GPU_TICKET_ROOT) / normalized_run_id
    )
    ticket_directory.parent.mkdir(parents=True, exist_ok=True)
    ticket_directory.mkdir(exist_ok=False)
    ticket_path = ticket_directory / "ticket.json"
    consumption_path = ticket_directory / "consumption.json"
    ticket_id = f"local-ai-joint-transport-readonly-gpu-{normalized_run_id}"
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(template),
        "datasetPackageId": dataset_package_id,
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
    }
    actions = execution_action_values_for_stage_config(template)
    if actions != _READONLY_ALLOWED_ACTIONS:
        raise ValueError("readonly GPU action policy changed")
    ticket = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-v2",
        "status": "issued_not_consumed",
        "ticketId": ticket_id,
        "modeId": resolve_stage_mode(template).mode_id,
        "capabilityAuthority": "local_ai_pet_world_program",
        "ownerAuthorizationRequired": False,
        "executionActions": actions,
        "binding": binding,
    }
    _write_json_exclusive(ticket_path, ticket)
    ticket_sha256 = _sha256_file(ticket_path)
    consumption = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-consumption-v2",
        "ticketId": ticket_id,
        "ticketSha256": ticket_sha256,
        "oneTimeConsumption": True,
        "state": "consumed",
        "binding": binding,
    }
    _write_json_exclusive(consumption_path, consumption)
    identity = {
        "ticketId": ticket_id,
        "ticketPath": ticket_path.relative_to(PROJECT_ROOT).as_posix(),
        "ticketSha256": ticket_sha256,
        "consumptionPath": consumption_path.relative_to(PROJECT_ROOT).as_posix(),
        "consumptionSha256": _sha256_file(consumption_path),
        "executionState": "consumed",
        "status": template["training"]["trainingAuthorizationStatus"],
        "executionActions": actions,
        **binding,
    }
    active = materialize_joint_condition_local_transport_readonly_gpu_config(
        template,
        local_ai_capability_ticket=identity,
    )
    return active, identity


def validate_joint_condition_local_transport_readonly_gpu_config(
    config: dict,
    *,
    require_execution_ticket: bool = True,
) -> dict:
    if not isinstance(config, dict):
        raise ValueError("readonly GPU config must be an object")
    execution = config.get("executionIdentity")
    if not isinstance(execution, dict):
        raise ValueError("readonly GPU execution identity is missing")
    run_id, output_namespace = _validate_readonly_execution_identity(
        execution.get("runId"), execution.get("outputNamespace")
    )
    expected = _compile_readonly_gpu_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
    )
    training = config.get("training")
    ticket = training.get("localAiCapabilityTicket") if isinstance(training, dict) else None
    if require_execution_ticket:
        if not isinstance(ticket, dict):
            raise ValueError("readonly GPU requires one consumed internal ticket")
        expected["training"]["localAiCapabilityTicket"] = deepcopy(ticket)
    elif ticket is not None:
        raise ValueError("readonly GPU template cannot carry a consumed ticket")
    if config != expected:
        raise ValueError("readonly GPU immutable config identity changed")

    spec = resolve_stage_mode(config)
    if (
        spec.mode_id != "joint_condition_local_transport_stage4_readonly_gpu"
        or spec.architecture != ARCHITECTURE_ID
        or spec.stage != 4
        or spec.execution_kind != "readonly_gpu_qualification"
        or spec.active_execution is not True
        or spec.sample_split is not None
    ):
        raise ValueError("readonly GPU Mode Registry binding changed")
    if execution_action_values_for_stage_config(config) != _READONLY_ALLOWED_ACTIONS:
        raise ValueError("readonly GPU execution actions changed")
    if {key for key, value in config["activationGates"].items() if value} != {
        "gpuNow", "readonlyGpuQualificationNow"
    }:
        raise ValueError("readonly GPU activation gates changed")
    if any(config["executionBoundary"].values()):
        raise ValueError("readonly GPU pre-execution boundary changed")
    if (
        config.get("ownerAuthorizationRequired") is not False
        or config.get("ownerResponseRequired") is not False
    ):
        raise ValueError("readonly GPU cannot require Owner approval")

    if require_execution_ticket:
        grant = resolve_stage_execution_grant(config, project_root=PROJECT_ROOT)
        if sorted(action.value for action in grant.allowed_actions) != _READONLY_ALLOWED_ACTIONS:
            raise ValueError("readonly GPU local capability grant widened")
        if sorted(action.value for action in grant.explicitly_denied_actions) != _READONLY_FORBIDDEN_ACTIONS:
            raise ValueError("readonly GPU deny boundary changed")
        if grant.authorization_identity.get("authority") != "local_ai_pet_world_program":
            raise ValueError("readonly GPU local capability authority changed")
    return {
        "status": "joint_condition_local_transport_readonly_gpu_config_valid",
        "modeId": spec.mode_id,
        "runId": run_id,
        "outputNamespace": output_namespace,
        "allowedExecutionActions": deepcopy(_READONLY_ALLOWED_ACTIONS),
        "ownerAuthorizationRequired": False,
        "trainingAllowed": False,
    }


def _validate_controlled_smoke_execution_identity(
    run_id: Any,
    output_namespace: Any,
) -> tuple[str, str]:
    if not isinstance(run_id, str) or _SAFE_RUN_ID.fullmatch(run_id) is None:
        raise ValueError("joint local-transport controlled Smoke run identity is invalid")
    if not isinstance(output_namespace, str):
        raise ValueError("joint local-transport controlled Smoke namespace is invalid")
    relative = Path(output_namespace)
    expected_parent = Path(CONTROLLED_SMOKE_OUTPUT_ROOT)
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.parent.as_posix() != expected_parent.as_posix()
        or relative.name != run_id
    ):
        raise ValueError(
            "joint local-transport controlled Smoke namespace is not isolated"
        )
    return run_id, relative.as_posix()


def _verified_binding(
    project_root: Path,
    binding: Mapping[str, Any],
    *,
    label: str,
) -> tuple[dict, dict]:
    path = _resolve_project_relative_file(
        project_root,
        str(binding.get("path", "")),
        label=label,
    )
    expected_sha256 = str(binding.get("sha256", ""))
    if (
        re.fullmatch(r"[0-9a-f]{64}", expected_sha256) is None
        or _sha256_file(path) != expected_sha256
    ):
        raise ValueError(f"{label} SHA-256 is invalid")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value, {"path": Path(binding["path"]).as_posix(), "sha256": expected_sha256}


def derive_joint_condition_local_transport_controlled_smoke_evidence_bindings(
    project_root: Path = PROJECT_ROOT,
) -> dict:
    """Bind the qualified joint candidate without accepting an older model family."""

    root = project_root.resolve()
    terminal, terminal_binding = _verified_binding(
        root,
        READONLY_GPU_TERMINAL_EVIDENCE,
        label="joint local-transport readonly GPU terminal",
    )
    report, report_binding = _verified_binding(
        root,
        READONLY_GPU_REPORT_EVIDENCE,
        label="joint local-transport readonly GPU report",
    )
    safety = report.get("safety")
    measured = report.get("measured")
    if (
        terminal.get("schemaVersion")
        != "stage4-joint-condition-local-transport-readonly-gpu-terminal-v1"
        or terminal.get("executionState") != "completed"
        or terminal.get("status")
        != "stage4_joint_condition_local_transport_readonly_gpu_qualification_succeeded"
        or terminal.get("capabilityVersion") != CAPABILITY_VERSION
        or terminal.get("nextLegalAction")
        != "compile_and_execute_stage4_joint_condition_local_transport_controlled_smoke"
        or terminal.get("ownerAuthorizationRequired") is not False
        or terminal.get("ownerResponseRequired") is not False
        or terminal.get("trainingStarted") is not False
        or terminal.get("optimizerCreated") is not False
        or terminal.get("modelWeightsModified") is not False
        or terminal.get("checkpointWritten") is not False
        or terminal.get("qualificationReport") != report_binding
        or report.get("schemaVersion")
        != "stage4-joint-condition-local-transport-readonly-gpu-qualification-report-v1"
        or report.get("status") != "passed"
        or report.get("runId") != terminal.get("runId")
        or report.get("capabilityVersion") != CAPABILITY_VERSION
        or not isinstance(measured, dict)
        or measured.get("conditionChannelsFiniteNonzero") != CONDITION_CHANNELS
        or measured.get("transportParameterTensorsFiniteNonzero") != 24
        or measured.get("transportParameterCount") != 22_464
        or measured.get("firstFormalTrainRecordQualified") is not True
        or measured.get("fixedValidationSample194Qualified") is not True
        or not isinstance(safety, dict)
        or safety.get("denoiserCheckpointRead") is not False
        or safety.get("historicalDenoiserCheckpointRead") is not False
        or safety.get("failedDenoiserCheckpointRead") is not False
        or safety.get("optimizerCreated") is not False
        or safety.get("backwardExecuted") is not False
        or safety.get("weightsModified") is not False
        or safety.get("checkpointWritten") is not False
        or safety.get("trainingStarted") is not False
    ):
        raise ValueError(
            "joint local-transport readonly GPU qualification identity is invalid"
        )
    evidence = _derive_readonly_gpu_evidence_bindings()
    evidence["readonlyGpuQualification"] = {
        "terminal": terminal_binding,
        "report": report_binding,
        "runId": terminal["runId"],
        "status": terminal["status"],
    }
    return evidence


def _load_compiled_controlled_smoke_contract(
    *,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path,
) -> tuple[dict, dict]:
    if re.fullmatch(r"[0-9a-f]{64}", compiled_contract_sha256) is None:
        raise ValueError("joint local-transport compiled Smoke SHA-256 is invalid")
    relative_contract_path = Path(compiled_contract_path)
    if (
        relative_contract_path.name != "controlled-smoke-contract.json"
        or relative_contract_path.parent.parent.as_posix()
        != Path(CONTROLLED_SMOKE_CONTRACT_ROOT).as_posix()
    ):
        raise ValueError("joint local-transport compiled Smoke path is not isolated")
    path = _resolve_project_relative_file(
        project_root,
        compiled_contract_path,
        label="joint local-transport compiled Smoke contract",
    )
    if _sha256_file(path) != compiled_contract_sha256:
        raise ValueError("joint local-transport compiled Smoke SHA-256 changed")
    contract = json.loads(path.read_text(encoding="utf-8"))
    execution = contract.get("executionIdentity")
    model = contract.get("modelBoundary")
    frozen = contract.get("frozenBoundaries")
    internal = contract.get("internalCapability")
    namespace = contract.get("futureEvidenceNamespace")
    ownership = contract.get("outputOwnership")
    isolation = contract.get("evidenceIsolation")
    if (
        contract.get("schemaVersion")
        != "stage4-joint-condition-local-transport-controlled-smoke-contract-v1"
        or contract.get("status") != "compiled_not_started"
        or contract.get("authority") != "local_ai_pet_world_program"
        or contract.get("capabilityVersion") != CAPABILITY_VERSION
        or contract.get("architectureId") != ARCHITECTURE_ID
        or not isinstance(contract.get("compilationRunId"), str)
        or relative_contract_path.parent.name != contract.get("compilationRunId")
        or not isinstance(execution, dict)
        or execution.get("kind")
        != "controlled_single_validation_sample_model_smoke"
        or execution.get("sampleId") != FIXED_VALIDATION_SAMPLE_ID
        or execution.get("sampleSplit") != "validation"
        or execution.get("seed") != 20263722
        or execution.get("topology") != "west"
        or execution.get("resolutionStage") != 0
        or execution.get("resolution") != {"width": 256, "height": 192}
        or execution.get("latentResolution") != {"width": 64, "height": 48}
        or execution.get("epochCount") != 30
        or execution.get("previewEpochs") != [1, 5, 10, 20, 30]
        or execution.get("initialization")
        != "fixed_random_denoiser_initialization_without_checkpoint"
        or execution.get("autoencoderFrozen") is not True
        or not isinstance(model, dict)
        or model.get("conditionChannels") != CONDITION_CHANNELS
        or model.get("latentChannels") != LATENT_CHANNELS
        or model.get("widths") != [64, 128, 256]
        or model.get("timeEmbeddingChannels") != TIME_EMBEDDING_CHANNELS
        or model.get("transportSiteCount") != 12
        or model.get("transportParameterTensorCount") != 24
        or model.get("transportParameterCount") != 22_464
        or model.get("existingConditionFusionPreserved") is not True
        or model.get("existingDiffusionObjectivePreserved") is not True
        or model.get("newLossTermAdded") is not False
        or model.get("freeArchitectureParameterChosen") is not False
        or model.get("objectiveReviewAlignmentClaimed") is not False
        or not isinstance(frozen, dict)
        or frozen.get("approvedSampleCount") != 64
        or frozen.get("splitCounts") != FROZEN_SPLIT_COUNTS
        or frozen.get("autoencoderIdentityFrozen") is not True
        or frozen.get("lossValuesAndWeightsUnchanged") is not True
        or frozen.get("checkpointFormatUnchanged") is not True
        or frozen.get("machineReviewThresholdsUnchanged") is not True
        or not isinstance(internal, dict)
        or internal.get("issueAuthority") != "local_ai_pet_world_program"
        or internal.get("singleUse") is not True
        or internal.get("persistedReplayProtection") is not True
        or internal.get("cannotExpandContract") is not True
        or internal.get("ownerAuthorizationRequired") is not False
        or internal.get("ownerResponseRequired") is not False
        or internal.get("issueOnlyAfterAllPreflightChecksPass") is not True
        or not isinstance(namespace, dict)
        or not isinstance(ownership, dict)
        or ownership.get("preflightCreatesRootAndPreflightOnly") is not True
        or ownership.get("preflightMustNotCreateTrainingOutput") is not True
        or ownership.get("trainerCreatesTrainingOutputExactlyOnce") is not True
        or ownership.get("trainingOutputMustBeAbsentBeforeTrainerStart") is not True
        or not isinstance(isolation, dict)
        or isolation.get("outputDirectoryMustNotExistBeforeExecution") is not True
        or isolation.get("historicalDenoiserAccepted") is not False
        or isolation.get("historicalCheckpointAccepted") is not False
        or isolation.get("failedCheckpointAccepted") is not False
        or isolation.get("historicalRunAccepted") is not False
        or isolation.get("historicalOutputDirectoryAccepted") is not False
        or isolation.get("partialTrainingArtifactAccepted") is not False
        or isolation.get("crossCapabilityArtifactAccepted") is not False
        or "automatic_training_retry" not in contract.get("prohibited", [])
        or "historical_or_failed_checkpoint_read"
        not in contract.get("prohibited", [])
        or "reuse_exited_spatial_affine_candidate_identity"
        not in contract.get("prohibited", [])
    ):
        raise ValueError("joint local-transport compiled Smoke identity is invalid")
    run_id, output_namespace = _validate_controlled_smoke_execution_identity(
        execution.get("runId"), namespace.get("outputDirectory")
    )
    expected_paths = {
        "activeConfig": f"{output_namespace}/active-config.json",
        "internalTicket": f"{output_namespace}/internal-ticket.json",
        "ticketConsumption": f"{output_namespace}/internal-ticket-consumption.json",
        "preflightReport": f"{output_namespace}/preflight-report.json",
        "trainingOutput": f"{output_namespace}/training-output",
        "progress": f"{output_namespace}/training-output/progress.json",
        "resourceTelemetry": f"{output_namespace}/training-output/resource-telemetry.json",
        "fixedPreviews": f"{output_namespace}/training-output/fixed-epoch-previews",
        "machineReviewTimeline": f"{output_namespace}/machine-review-timeline.json",
        "lateStabilityQualification": f"{output_namespace}/late-stability-qualification.json",
        "manifest": f"{output_namespace}/manifest.json",
        "finalization": f"{output_namespace}/finalization/finalization.json",
        "phaseTerminal": f"{output_namespace}/phase-terminal.json",
    }
    if any(namespace.get(key) != value for key, value in expected_paths.items()):
        raise ValueError("joint local-transport compiled evidence namespace changed")
    return contract, {
        "path": Path(compiled_contract_path).as_posix(),
        "sha256": compiled_contract_sha256,
        "schemaVersion": contract["schemaVersion"],
        "status": contract["status"],
        "compilationRunId": contract["compilationRunId"],
    }


def _controlled_smoke_gates() -> dict[str, bool]:
    active = {
        "optimizerNow",
        "backwardNow",
        "weightModificationNow",
        "gpuNow",
        "smokeNow",
        "trainingNow",
    }
    return {key: key in active for key in ACTIVATION_GATE_KEYS}


def _controlled_smoke_boundary() -> dict:
    return {
        "allowedExecutionActions": deepcopy(_CONTROLLED_SMOKE_ALLOWED_ACTIONS),
        "forbiddenExecutionActions": deepcopy(_CONTROLLED_SMOKE_FORBIDDEN_ACTIONS),
        "autoencoderIdentityInspectionAllowed": True,
        "checkpointIdentityInspectionAllowed": True,
        "autoencoderLoadAllowed": True,
        "parentDenoiserLoadAllowed": False,
        "optimizerCreationAllowed": True,
        "backwardExecutionAllowed": True,
        "modelWeightMutationAllowed": True,
        "smokeCheckpointWriteAllowed": True,
        "automaticRetryAllowed": False,
        "stageExecutionAllowed": False,
        "formalInferenceAllowed": False,
        "checkpointPromotionAllowed": False,
        "runtimeFrameAllowed": False,
        "worldEntryAllowed": False,
    }


def _joint_controlled_smoke_contract(compiled_contract_binding: dict) -> dict:
    return {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-controlled-smoke-"
            "execution-contract-v1"
        ),
        "status": "active_fixed_identity_not_started",
        "compiledContract": deepcopy(compiled_contract_binding),
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": ARCHITECTURE_ID,
        "sampleId": FIXED_VALIDATION_SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": 20263722,
        "topology": "west",
        "requiredBoundarySides": ["west"],
        "resolutionStage": 0,
        "resolution": {"width": 256, "height": 192},
        "latentResolution": {"width": 64, "height": 48},
        "epochCount": 30,
        "optimizerStepCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "initialization": "fixed_random_denoiser_initialization_without_checkpoint",
        "autoencoderFrozen": True,
        "denoiserCheckpointPath": None,
        "denoiserCheckpointReadAllowed": False,
        "historicalCheckpointAllowed": False,
        "failedCheckpointAllowed": False,
        "crossRunArtifactAllowed": False,
        "crossCapabilityArtifactAllowed": False,
        "automaticTrainingRetryAllowed": False,
        "objectiveReviewAlignmentClaimed": False,
        "formalMachineReviewRemainsAuthoritative": True,
        "failureCanPromoteCheckpoint": False,
    }


def _compile_controlled_smoke_config_template(
    *,
    run_id: str,
    output_namespace: str,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path,
) -> dict:
    normalized_run_id, normalized_output = _validate_controlled_smoke_execution_identity(
        run_id, output_namespace
    )
    root = project_root.resolve()
    compiled_contract, compiled_binding = _load_compiled_controlled_smoke_contract(
        compiled_contract_path=compiled_contract_path,
        compiled_contract_sha256=compiled_contract_sha256,
        project_root=root,
    )
    if (
        compiled_contract["executionIdentity"]["runId"] != normalized_run_id
        or compiled_contract["futureEvidenceNamespace"]["outputDirectory"]
        != normalized_output
    ):
        raise ValueError(
            "joint local-transport compiled Smoke identity does not match the run"
        )
    config = compile_spatial_affine_decoder_cpu_inactive_config(project_root=root)
    config["schemaVersion"] = (
        "ai-painter-stage4-joint-condition-local-transport-controlled-smoke-config-v1"
    )
    config["modelId"] = "ai-painter-stage4-joint-condition-local-transport-denoiser-v1"
    config["architectureVersion"] = "joint-condition-local-transport-denoiser-v1"
    config["status"] = "controlled_smoke_active_not_started"
    config["denoiserArchitecture"] = ARCHITECTURE_ID
    config["ownerAuthorizationRequired"] = False
    config["ownerResponseRequired"] = False
    config["executionIdentity"] = {
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
        "namespaceReuseAllowed": False,
        "crossRunEvidenceAllowed": False,
    }
    config["evidenceBindings"] = (
        derive_joint_condition_local_transport_controlled_smoke_evidence_bindings(
            root
        )
    )
    config["evidenceBindings"]["compiledControlledSmokeContract"] = deepcopy(
        compiled_binding
    )
    config.pop("stage4SpatialAffineConditioningContract", None)
    config.pop("fullBackboneSpatialAffineContract", None)
    config["jointConditionLocalTransportContract"] = _transport_contract()
    config["jointConditionLocalTransportContract"]["status"] = (
        "active_local_ai_internal_controlled_smoke"
    )
    config["activationGates"] = _controlled_smoke_gates()
    config["executionBoundary"] = _execution_boundary()
    config["controlledSmokeBoundary"] = _controlled_smoke_boundary()
    training = config["training"]
    training["trainingAuthorizationStatus"] = (
        JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_SMOKE_STATUS
    )
    training["denoiserEpochs"] = 30
    training["seed"] = 20263722
    training["fixedEpochPreviewPolicy"]["smoke"] = [1, 5, 10, 20, 30]
    training["activationGates"] = _controlled_smoke_gates()
    training["stage4JointConditionLocalTransportSmokeContract"] = (
        _joint_controlled_smoke_contract(compiled_binding)
    )
    return config


def build_joint_condition_local_transport_controlled_smoke_config_template(
    *,
    run_id: str,
    output_namespace: str,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    """Build the immutable ticket-free 30-Epoch Smoke config."""

    config = _compile_controlled_smoke_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        compiled_contract_path=compiled_contract_path,
        compiled_contract_sha256=compiled_contract_sha256,
        project_root=project_root,
    )
    validate_joint_condition_local_transport_controlled_smoke_config(
        config,
        project_root=project_root,
        require_execution_ticket=False,
    )
    return deepcopy(config)


def materialize_joint_condition_local_transport_controlled_smoke_config(
    template: dict,
    *,
    local_ai_capability_ticket: dict,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    active = deepcopy(template)
    training = active.get("training")
    if not isinstance(training, dict) or "localAiCapabilityTicket" in training:
        raise ValueError("joint local-transport Smoke template is not pristine")
    training["localAiCapabilityTicket"] = deepcopy(local_ai_capability_ticket)
    validate_joint_condition_local_transport_controlled_smoke_config(
        active,
        project_root=project_root,
        require_execution_ticket=True,
    )
    return active


def _validate_controlled_smoke_preflight_report(
    *,
    report_path: Path,
    run_id: str,
    output_namespace: str,
    compiled_contract_binding: Mapping[str, Any],
) -> None:
    if not report_path.is_file() or report_path.is_symlink():
        raise ValueError("joint local-transport Smoke preflight report is missing")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    checks = report.get("checks")
    required_checks = {
        "cpuContract",
        "activeConfigAudit",
        "trainerReadonlyPreflight",
        "cudaResource",
        "diskCapacity",
        "trainingOutputAbsent",
    }
    if (
        report.get("schemaVersion")
        != "stage4-joint-condition-local-transport-controlled-smoke-preflight-v1"
        or report.get("status") != "all_preflight_checks_passed"
        or report.get("runId") != run_id
        or report.get("outputNamespace") != output_namespace
        or report.get("compiledContract") != dict(compiled_contract_binding)
        or not isinstance(checks, dict)
        or not required_checks.issubset(checks)
        or any(checks.get(key) is not True for key in required_checks)
        or report.get("ownerAuthorizationRequired") is not False
        or report.get("ownerResponseRequired") is not False
        or report.get("gpuStarted") is not False
        or report.get("trainingStarted") is not False
    ):
        raise ValueError(
            "joint local-transport Smoke preflight did not prove every gate"
        )


def issue_and_consume_joint_condition_local_transport_controlled_smoke_ticket(
    *,
    dataset_package_id: str,
    run_id: str,
    output_namespace: str,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path = PROJECT_ROOT,
) -> tuple[dict, dict]:
    """Issue/consume exactly one local ticket after the isolated preflight."""

    root = project_root.resolve()
    normalized_run_id, normalized_output = _validate_controlled_smoke_execution_identity(
        run_id, output_namespace
    )
    template = build_joint_condition_local_transport_controlled_smoke_config_template(
        run_id=normalized_run_id,
        output_namespace=normalized_output,
        compiled_contract_path=compiled_contract_path,
        compiled_contract_sha256=compiled_contract_sha256,
        project_root=root,
    )
    expected_dataset = template["evidenceBindings"]["approvedDataset"][
        "datasetPackageId"
    ]
    if dataset_package_id != expected_dataset:
        raise ValueError("joint local-transport Smoke dataset identity changed")
    output_path = root / Path(normalized_output)
    registered_parent = (root / CONTROLLED_SMOKE_OUTPUT_ROOT).resolve()
    if (
        not output_path.is_dir()
        or output_path.is_symlink()
        or output_path.resolve().parent != registered_parent
    ):
        raise ValueError("joint local-transport Smoke preflight root is invalid")
    existing = {item.name for item in output_path.iterdir()}
    allowed_states = {
        frozenset({"preflight-report.json"}),
        frozenset({"preflight-report.json", "internal-ticket.json"}),
        frozenset({
            "preflight-report.json",
            "internal-ticket.json",
            "internal-ticket-consumption.json",
        }),
    }
    if frozenset(existing) not in allowed_states:
        raise ValueError("joint local-transport Smoke output was reused or injected")
    if (output_path / "training-output").exists():
        raise ValueError("joint local-transport Smoke training output already exists")
    _validate_controlled_smoke_preflight_report(
        report_path=output_path / "preflight-report.json",
        run_id=normalized_run_id,
        output_namespace=normalized_output,
        compiled_contract_binding=template["evidenceBindings"][
            "compiledControlledSmokeContract"
        ],
    )

    ticket_path = output_path / "internal-ticket.json"
    consumption_path = output_path / "internal-ticket-consumption.json"
    ticket_id = f"local-ai-joint-local-transport-smoke-{normalized_run_id}"
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(template),
        "datasetPackageId": dataset_package_id,
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
    }
    actions = execution_action_values_for_stage_config(template)
    if actions != _CONTROLLED_SMOKE_ALLOWED_ACTIONS:
        raise ValueError("joint local-transport Smoke action policy changed")
    ticket = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-v2",
        "status": "issued_not_consumed",
        "ticketId": ticket_id,
        "modeId": resolve_stage_mode(template).mode_id,
        "capabilityAuthority": "local_ai_pet_world_program",
        "ownerAuthorizationRequired": False,
        "executionActions": actions,
        "binding": binding,
    }
    if not ticket_path.exists():
        _write_json_exclusive(ticket_path, ticket)
    ticket_sha256 = _verify_exact_json_file(
        ticket_path,
        ticket,
        label="joint local-transport Smoke internal ticket",
    )
    consumption = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-consumption-v2",
        "ticketId": ticket_id,
        "ticketSha256": ticket_sha256,
        "oneTimeConsumption": True,
        "state": "consumed",
        "binding": binding,
    }
    if not consumption_path.exists():
        _write_json_exclusive(consumption_path, consumption)
    consumption_sha256 = _verify_exact_json_file(
        consumption_path,
        consumption,
        label="joint local-transport Smoke ticket consumption",
    )
    identity = {
        "ticketId": ticket_id,
        "ticketPath": ticket_path.relative_to(root).as_posix(),
        "ticketSha256": ticket_sha256,
        "consumptionPath": consumption_path.relative_to(root).as_posix(),
        "consumptionSha256": consumption_sha256,
        "executionState": "consumed",
        "status": template["training"]["trainingAuthorizationStatus"],
        "executionActions": actions,
        **binding,
    }
    active = materialize_joint_condition_local_transport_controlled_smoke_config(
        template,
        local_ai_capability_ticket=identity,
        project_root=root,
    )
    return active, identity


def validate_joint_condition_local_transport_controlled_smoke_config(
    config: dict,
    *,
    project_root: Path = PROJECT_ROOT,
    require_execution_ticket: bool = True,
) -> dict:
    if not isinstance(config, dict):
        raise ValueError("joint local-transport Smoke config must be an object")
    execution = config.get("executionIdentity")
    if not isinstance(execution, dict):
        raise ValueError("joint local-transport Smoke execution identity is missing")
    evidence = config.get("evidenceBindings")
    compiled_binding = (
        evidence.get("compiledControlledSmokeContract")
        if isinstance(evidence, dict)
        else None
    )
    if not isinstance(compiled_binding, dict):
        raise ValueError("joint local-transport compiled Smoke binding is missing")
    run_id, output_namespace = _validate_controlled_smoke_execution_identity(
        execution.get("runId"), execution.get("outputNamespace")
    )
    expected = _compile_controlled_smoke_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        compiled_contract_path=str(compiled_binding.get("path", "")),
        compiled_contract_sha256=str(compiled_binding.get("sha256", "")),
        project_root=project_root.resolve(),
    )
    training = config.get("training")
    ticket = training.get("localAiCapabilityTicket") if isinstance(training, dict) else None
    if require_execution_ticket:
        if not isinstance(ticket, dict):
            raise ValueError("joint local-transport Smoke requires one consumed ticket")
        expected["training"]["localAiCapabilityTicket"] = deepcopy(ticket)
    elif ticket is not None:
        raise ValueError("joint local-transport Smoke template cannot carry a ticket")
    if config != expected:
        raise ValueError("joint local-transport Smoke immutable identity changed")

    spec = resolve_stage_mode(config)
    if (
        spec.mode_id != "joint_condition_local_transport_stage4_smoke"
        or spec.architecture != ARCHITECTURE_ID
        or spec.stage != 4
        or spec.execution_kind != "single_sample_smoke"
        or spec.active_execution is not True
        or spec.sample_split != "validation"
    ):
        raise ValueError("joint local-transport Smoke Mode Registry binding changed")
    if execution_action_values_for_stage_config(config) != _CONTROLLED_SMOKE_ALLOWED_ACTIONS:
        raise ValueError("joint local-transport Smoke execution actions changed")
    if {key for key, value in config["activationGates"].items() if value} != {
        "optimizerNow",
        "backwardNow",
        "weightModificationNow",
        "gpuNow",
        "smokeNow",
        "trainingNow",
    }:
        raise ValueError("joint local-transport Smoke activation gates changed")
    if any(config["executionBoundary"].values()):
        raise ValueError("joint local-transport Smoke pre-execution state changed")
    if (
        config.get("ownerAuthorizationRequired") is not False
        or config.get("ownerResponseRequired") is not False
    ):
        raise ValueError("joint local-transport Smoke cannot wait for Owner")
    if (
        "stage4FullBackboneSpatialAffineSmokeContract" in config["training"]
        or "fullBackboneSpatialAffineContract" in config
        or "stage4SpatialAffineConditioningContract" in config
    ):
        raise ValueError("joint local-transport Smoke reused an exited candidate identity")

    if require_execution_ticket:
        grant = resolve_stage_execution_grant(config, project_root=project_root)
        allowed = sorted(action.value for action in grant.allowed_actions)
        denied = sorted(action.value for action in grant.explicitly_denied_actions)
        if allowed != _CONTROLLED_SMOKE_ALLOWED_ACTIONS:
            raise ValueError("joint local-transport Smoke grant widened")
        if denied != _CONTROLLED_SMOKE_FORBIDDEN_ACTIONS:
            raise ValueError("joint local-transport Smoke deny boundary changed")
        if grant.authorization_identity.get("authority") != "local_ai_pet_world_program":
            raise ValueError("joint local-transport Smoke authority changed")
        if (
            grant.dataset_constraints.get("sampleId") != FIXED_VALIDATION_SAMPLE_ID
            or grant.dataset_constraints.get("selectedSplit") != "validation"
            or grant.dataset_constraints.get("seed") != 20263722
            or grant.dataset_constraints.get("topology") != "west"
            or grant.dataset_constraints.get("resolution")
            != {"width": 256, "height": 192}
            or grant.dataset_constraints.get("epochCount") != 30
            or grant.dataset_constraints.get("previewEpochs")
            != [1, 5, 10, 20, 30]
            or grant.checkpoint_constraints.get("parentDenoiserAllowed") is not False
        ):
            raise ValueError("joint local-transport Smoke grant identity changed")
    return {
        "status": "joint_condition_local_transport_controlled_smoke_config_valid",
        "modeId": spec.mode_id,
        "runId": run_id,
        "outputNamespace": output_namespace,
        "sampleId": FIXED_VALIDATION_SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": 20263722,
        "topology": "west",
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "ownerAuthorizationRequired": False,
        "ownerResponseRequired": False,
        "allowedExecutionActions": deepcopy(_CONTROLLED_SMOKE_ALLOWED_ACTIONS),
        "internalExecutionTicketRequired": require_execution_ticket,
        "executionStartedByValidation": False,
    }


def _validate_full_data_screen_execution_identity(
    run_id: Any,
    output_namespace: Any,
) -> tuple[str, str]:
    if not isinstance(run_id, str) or _SAFE_RUN_ID.fullmatch(run_id) is None:
        raise ValueError("joint local-transport full-data screen run identity is invalid")
    if not isinstance(output_namespace, str):
        raise ValueError("joint local-transport full-data screen namespace is invalid")
    relative = Path(output_namespace)
    expected_parent = Path(FULL_DATA_SCREEN_OUTPUT_ROOT)
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.parent.as_posix() != expected_parent.as_posix()
        or relative.name != run_id
    ):
        raise ValueError("joint local-transport full-data screen namespace is not isolated")
    return run_id, relative.as_posix()


def _load_full_data_screen_inactive_contract(
    *,
    inactive_contract_path: str,
    inactive_contract_sha256: str,
    project_root: Path,
) -> tuple[dict, dict]:
    value, binding = _verified_binding(
        project_root,
        {"path": inactive_contract_path, "sha256": inactive_contract_sha256},
        label="joint local-transport inactive full-data screen contract",
    )
    fixed = value.get("fixedExecutionIdentity")
    model = value.get("frozenModelBoundary")
    data = value.get("frozenDataBoundary")
    objective = value.get("frozenObjectiveBoundary")
    review = value.get("frozenReviewBoundary")
    checkpoint = value.get("checkpointBoundary")
    retry = value.get("retryBoundary")
    source_decision = value.get("sourceCoverageDecision")
    if (
        value.get("schemaVersion")
        != "stage4-joint-condition-local-transport-24-epoch-full-data-screen-contract-v1"
        or value.get("status") != "cpu_compiled_inactive_not_authorized_for_gpu_or_training"
        or value.get("authority") != "local_ai_pet_world_program"
        or value.get("architectureId") != ARCHITECTURE_ID
        or value.get("capabilityVersion") != CAPABILITY_VERSION
        or value.get("purpose")
        != "bounded_full_data_model_family_screen_after_coverage_insufficient_smoke"
        or not isinstance(fixed, dict)
        or fixed.get("seed") != 20263722
        or fixed.get("epochCount") != 24
        or fixed.get("trainSampleCountPerEpoch") != 48
        or fixed.get("optimizerStepsPerEpoch") != 48
        or fixed.get("optimizerStepCount") != 1152
        or fixed.get("diffusionStepCount") != 1000
        or fixed.get("requiredUniqueTrainingTimestepCount") != 1000
        or fixed.get("inferenceTimestepCount") != 50
        or fixed.get("requiredExactInferenceOverlapCount") != 50
        or fixed.get("initialization")
        != "fixed_random_denoiser_initialization_without_checkpoint"
        or fixed.get("previewEpochs") != [5, 10, 15, 20, 24]
        or not isinstance(model, dict)
        or model.get("conditionChannels") != CONDITION_CHANNELS
        or model.get("latentChannels") != LATENT_CHANNELS
        or model.get("timeEmbeddingChannels") != TIME_EMBEDDING_CHANNELS
        or model.get("widths") != [64, 128, 256]
        or model.get("transportSiteCount") != 12
        or model.get("transportParameterTensorCount") != 24
        or model.get("transportParameterCount") != 22464
        or model.get("modelChangedFromSmoke") is not False
        or not isinstance(data, dict)
        or data.get("splitCounts") != FROZEN_SPLIT_COUNTS
        or not isinstance(objective, dict)
        or objective.get("lossValuesChanged") is not False
        or objective.get("lossWeightsChanged") is not False
        or not isinstance(review, dict)
        or review.get("formalMachineReviewRemainsAuthoritative") is not True
        or review.get("thresholdsChanged") is not False
        or not isinstance(checkpoint, dict)
        or checkpoint.get("parentDenoiserCheckpoint") is not None
        or checkpoint.get("sourceSmokeCheckpointReadAllowed") is not False
        or checkpoint.get("historicalCheckpointReadAllowed") is not False
        or checkpoint.get("failedCheckpointReadAllowed") is not False
        or checkpoint.get("checkpointPromotionAllowed") is not False
        or not isinstance(retry, dict)
        or retry.get("sameThirtyStepSmokeRerunAllowed") is not False
        or retry.get("automaticRetryAllowed") is not False
        or retry.get("onlyNextExecutionKind")
        != "joint_condition_local_transport_24_epoch_full_data_screen"
        or value.get("ownerAuthorizationRequired") is not False
        or value.get("ownerResponseRequired") is not False
        or value.get("activationAuthorized") is not False
        or value.get("gpuStarted") is not False
        or value.get("trainingStarted") is not False
        or not isinstance(source_decision, dict)
    ):
        raise ValueError("joint local-transport inactive full-data screen identity changed")
    decision, decision_binding = _verified_binding(
        project_root,
        source_decision,
        label="joint local-transport coverage decision",
    )
    if (
        decision_binding != FULL_DATA_SCREEN_COVERAGE_DECISION_EVIDENCE
        or decision.get("decision")
        != "controlled_smoke_training_coverage_insufficient_for_model_family_rejection"
        or decision.get("candidateRejected") is not False
        or decision.get("sameThirtyStepSmokeRerunAllowed") is not False
        or decision.get("nextLegalAction")
        != "compile_joint_condition_local_transport_24_epoch_full_data_screen"
    ):
        raise ValueError("joint local-transport source coverage decision changed")
    return value, {
        **binding,
        "schemaVersion": value["schemaVersion"],
        "status": value["status"],
    }


def _full_data_screen_gates() -> dict[str, bool]:
    active = {
        "optimizerNow", "backwardNow", "weightModificationNow", "gpuNow",
        "fullDataScreenNow", "trainingNow",
    }
    return {key: key in active for key in ACTIVATION_GATE_KEYS}


def _joint_full_data_screen_contract(inactive_binding: dict) -> dict:
    return {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-24-epoch-full-data-screen-"
            "execution-contract-v1"
        ),
        "status": "active_fixed_identity_not_started",
        "inactiveContract": deepcopy(inactive_binding),
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": ARCHITECTURE_ID,
        "seed": 20263722,
        "resolutionStage": 0,
        "resolution": {"width": 256, "height": 192},
        "latentResolution": {"width": 64, "height": 48},
        "epochCount": 24,
        "trainSampleCountPerEpoch": 48,
        "validationSampleCount": 8,
        "challengeSampleCount": 4,
        "regressionSampleCount": 4,
        "optimizerStepsPerEpoch": 48,
        "optimizerStepCount": 1152,
        "diffusionStepCount": 1000,
        "requiredUniqueTrainingTimestepCount": 1000,
        "inferenceTimestepCount": 50,
        "requiredExactInferenceOverlapCount": 50,
        "previewEpochs": [5, 10, 15, 20, 24],
        "initialization": "fixed_random_denoiser_initialization_without_checkpoint",
        "autoencoderFrozen": True,
        "denoiserCheckpointPath": None,
        "denoiserCheckpointReadAllowed": False,
        "historicalCheckpointAllowed": False,
        "failedCheckpointAllowed": False,
        "crossRunArtifactAllowed": False,
        "crossCapabilityArtifactAllowed": False,
        "automaticTrainingRetryAllowed": False,
        "stage0Allowed": False,
        "formalMachineReviewRemainsAuthoritative": True,
        "checkpointPromotionAllowed": False,
        "screenCheckpointStage0Eligible": False,
    }


def _compile_full_data_screen_config_template(
    *,
    run_id: str,
    output_namespace: str,
    inactive_contract_path: str,
    inactive_contract_sha256: str,
    project_root: Path,
) -> dict:
    normalized_run_id, normalized_output = _validate_full_data_screen_execution_identity(
        run_id, output_namespace
    )
    _, inactive_binding = _load_full_data_screen_inactive_contract(
        inactive_contract_path=inactive_contract_path,
        inactive_contract_sha256=inactive_contract_sha256,
        project_root=project_root,
    )
    config = compile_spatial_affine_decoder_cpu_inactive_config(project_root=project_root)
    config["schemaVersion"] = (
        "ai-painter-stage4-joint-condition-local-transport-full-data-screen-config-v1"
    )
    config["modelId"] = "ai-painter-stage4-joint-condition-local-transport-denoiser-v1"
    config["architectureVersion"] = "joint-condition-local-transport-denoiser-v1"
    config["status"] = "full_data_screen_active_not_started"
    config["denoiserArchitecture"] = ARCHITECTURE_ID
    config["ownerAuthorizationRequired"] = False
    config["ownerResponseRequired"] = False
    config["executionIdentity"] = {
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
        "namespaceReuseAllowed": False,
        "crossRunEvidenceAllowed": False,
    }
    config.pop("stage4SpatialAffineConditioningContract", None)
    config.pop("fullBackboneSpatialAffineContract", None)
    config["jointConditionLocalTransportContract"] = _transport_contract()
    config["jointConditionLocalTransportContract"]["status"] = (
        "active_local_ai_internal_full_data_screen"
    )
    config["evidenceBindings"] = (
        derive_joint_condition_local_transport_controlled_smoke_evidence_bindings(project_root)
    )
    config["evidenceBindings"]["inactiveFullDataScreenContract"] = deepcopy(
        inactive_binding
    )
    config["evidenceBindings"]["sourceCoverageDecision"] = deepcopy(
        FULL_DATA_SCREEN_COVERAGE_DECISION_EVIDENCE
    )
    # A ticket-free template is inspectable CPU state, not an activated GPU
    # capability.  The same exact gates open only while materializing the
    # consumed, config-bound ticket below.
    config["activationGates"] = _inactive_gates()
    config["executionBoundary"] = _execution_boundary()
    training = config["training"]
    training["trainingAuthorizationStatus"] = (
        JOINT_CONDITION_LOCAL_TRANSPORT_STAGE4_FULL_DATA_SCREEN_STATUS
    )
    training["denoiserEpochs"] = 24
    training["seed"] = 20263722
    training["fixedEpochPreviewPolicy"]["smoke"] = [5, 10, 15, 20, 24]
    training["activationGates"] = _inactive_gates()
    training["stage4JointConditionLocalTransportFullDataScreenContract"] = (
        _joint_full_data_screen_contract(inactive_binding)
    )
    return config


def build_joint_condition_local_transport_full_data_screen_config_template(
    *,
    run_id: str,
    output_namespace: str,
    inactive_contract_path: str = FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE["path"],
    inactive_contract_sha256: str = FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE["sha256"],
    project_root: Path = PROJECT_ROOT,
) -> dict:
    config = _compile_full_data_screen_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        inactive_contract_path=inactive_contract_path,
        inactive_contract_sha256=inactive_contract_sha256,
        project_root=project_root.resolve(),
    )
    validate_joint_condition_local_transport_full_data_screen_config(
        config, project_root=project_root, require_execution_ticket=False
    )
    return deepcopy(config)


def materialize_joint_condition_local_transport_full_data_screen_config(
    template: dict,
    *,
    local_ai_capability_ticket: dict,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    active = deepcopy(template)
    training = active.get("training")
    if not isinstance(training, dict) or "localAiCapabilityTicket" in training:
        raise ValueError("joint local-transport full-data screen template is not pristine")
    active["activationGates"] = _full_data_screen_gates()
    training["activationGates"] = _full_data_screen_gates()
    training["localAiCapabilityTicket"] = deepcopy(local_ai_capability_ticket)
    validate_joint_condition_local_transport_full_data_screen_config(
        active, project_root=project_root, require_execution_ticket=True
    )
    return active


def issue_and_consume_joint_condition_local_transport_full_data_screen_ticket(
    *,
    dataset_package_id: str,
    run_id: str,
    output_namespace: str,
    inactive_contract_path: str = FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE["path"],
    inactive_contract_sha256: str = FULL_DATA_SCREEN_INACTIVE_CONTRACT_EVIDENCE["sha256"],
    project_root: Path = PROJECT_ROOT,
) -> tuple[dict, dict]:
    root = project_root.resolve()
    template = build_joint_condition_local_transport_full_data_screen_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        inactive_contract_path=inactive_contract_path,
        inactive_contract_sha256=inactive_contract_sha256,
        project_root=root,
    )
    expected_dataset = template["evidenceBindings"]["approvedDataset"]["datasetPackageId"]
    if dataset_package_id != expected_dataset:
        raise ValueError("joint local-transport full-data screen dataset identity changed")
    normalized_run_id, normalized_output = _validate_full_data_screen_execution_identity(
        run_id, output_namespace
    )
    output_path = root / normalized_output
    if (
        not output_path.is_dir()
        or output_path.is_symlink()
        or output_path.resolve().parent != (root / FULL_DATA_SCREEN_OUTPUT_ROOT).resolve()
    ):
        raise ValueError("joint local-transport full-data screen preflight root is invalid")
    existing = {item.name for item in output_path.iterdir()}
    if (
        frozenset(existing) != frozenset({"preflight-report.json"})
        or (output_path / "training-output").exists()
    ):
        raise ValueError("joint local-transport full-data screen output was reused or injected")
    report_path = output_path / "preflight-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {}
    checks = report.get("checks")
    if (
        report.get("schemaVersion")
        != "stage4-joint-condition-local-transport-full-data-screen-preflight-v1"
        or report.get("status") != "all_preflight_checks_passed"
        or report.get("runId") != normalized_run_id
        or report.get("outputNamespace") != normalized_output
        or not isinstance(checks, dict)
        or any(checks.get(key) is not True for key in {
            "cpuContract", "activeConfigAudit", "trainerReadonlyPreflight",
            "cudaResource", "diskCapacity", "trainingOutputAbsent",
        })
        or report.get("gpuStarted") is not False
        or report.get("trainingStarted") is not False
    ):
        raise ValueError("joint local-transport full-data screen preflight is incomplete")
    ticket_bound_template = deepcopy(template)
    ticket_bound_template["activationGates"] = _full_data_screen_gates()
    ticket_bound_template["training"]["activationGates"] = _full_data_screen_gates()
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(ticket_bound_template),
        "datasetPackageId": dataset_package_id,
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
    }
    actions = execution_action_values_for_stage_config(template)
    if actions != _FULL_DATA_SCREEN_ALLOWED_ACTIONS:
        raise ValueError("joint local-transport full-data screen action policy changed")
    ticket_id = f"local-ai-joint-local-transport-full-data-screen-{normalized_run_id}"
    ticket = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-v2",
        "status": "issued_not_consumed",
        "ticketId": ticket_id,
        "modeId": resolve_stage_mode(template).mode_id,
        "capabilityAuthority": "local_ai_pet_world_program",
        "ownerAuthorizationRequired": False,
        "executionActions": actions,
        "binding": binding,
    }
    ticket_path = output_path / "internal-ticket.json"
    consumption_path = output_path / "internal-ticket-consumption.json"
    if not ticket_path.exists():
        _write_json_exclusive(ticket_path, ticket)
    ticket_sha256 = _verify_exact_json_file(ticket_path, ticket, label="full-data screen ticket")
    consumption = {
        "schemaVersion": "ai-painter-local-internal-capability-ticket-consumption-v2",
        "ticketId": ticket_id,
        "ticketSha256": ticket_sha256,
        "oneTimeConsumption": True,
        "state": "consumed",
        "binding": binding,
    }
    if not consumption_path.exists():
        _write_json_exclusive(consumption_path, consumption)
    consumption_sha256 = _verify_exact_json_file(
        consumption_path, consumption, label="full-data screen ticket consumption"
    )
    identity = {
        "ticketId": ticket_id,
        "ticketPath": ticket_path.relative_to(root).as_posix(),
        "ticketSha256": ticket_sha256,
        "consumptionPath": consumption_path.relative_to(root).as_posix(),
        "consumptionSha256": consumption_sha256,
        "executionState": "consumed",
        "status": template["training"]["trainingAuthorizationStatus"],
        "executionActions": actions,
        **binding,
    }
    return materialize_joint_condition_local_transport_full_data_screen_config(
        template, local_ai_capability_ticket=identity, project_root=root
    ), identity


def validate_joint_condition_local_transport_full_data_screen_config(
    config: dict,
    *,
    project_root: Path = PROJECT_ROOT,
    require_execution_ticket: bool = True,
) -> dict:
    if not isinstance(config, dict):
        raise ValueError("joint local-transport full-data screen config must be an object")
    execution = config.get("executionIdentity")
    evidence = config.get("evidenceBindings")
    binding = evidence.get("inactiveFullDataScreenContract") if isinstance(evidence, dict) else None
    if not isinstance(execution, dict) or not isinstance(binding, dict):
        raise ValueError("joint local-transport full-data screen identity is missing")
    run_id, output_namespace = _validate_full_data_screen_execution_identity(
        execution.get("runId"), execution.get("outputNamespace")
    )
    expected = _compile_full_data_screen_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        inactive_contract_path=str(binding.get("path", "")),
        inactive_contract_sha256=str(binding.get("sha256", "")),
        project_root=project_root.resolve(),
    )
    training = config.get("training")
    ticket = training.get("localAiCapabilityTicket") if isinstance(training, dict) else None
    if require_execution_ticket:
        if not isinstance(ticket, dict):
            raise ValueError("joint local-transport full-data screen requires one consumed ticket")
        expected["activationGates"] = _full_data_screen_gates()
        expected["training"]["activationGates"] = _full_data_screen_gates()
        expected["training"]["localAiCapabilityTicket"] = deepcopy(ticket)
    elif ticket is not None:
        raise ValueError("joint local-transport full-data screen template cannot carry a ticket")
    if config != expected:
        raise ValueError("joint local-transport full-data screen immutable identity changed")
    spec = resolve_stage_mode(config)
    if (
        spec.mode_id != "joint_condition_local_transport_stage4_full_data_screen"
        or spec.architecture != ARCHITECTURE_ID
        or spec.stage != 4
        or spec.execution_kind != "full_data_screen"
        or spec.adapter_binding
        != "joint_condition_local_transport_stage4_full_data_screen_adapter"
        or spec.sample_split is not None
        or spec.active_execution is not True
    ):
        raise ValueError("joint local-transport full-data screen Mode Registry binding changed")
    if any(config["executionBoundary"].values()):
        raise ValueError("joint local-transport full-data screen execution already started")
    if (
        config.get("ownerAuthorizationRequired") is not False
        or config.get("ownerResponseRequired") is not False
        or any(key in config["training"] for key in {
            "stage4JointConditionLocalTransportSmokeContract",
            "stage4FullBackboneSpatialAffineSmokeContract",
            "stage4SpatialAffineFullDataScreenContract",
        })
        or "stage4SpatialAffineConditioningContract" in config
        or "fullBackboneSpatialAffineContract" in config
    ):
        raise ValueError("joint local-transport full-data screen reused a forbidden identity")
    if require_execution_ticket:
        grant = resolve_stage_execution_grant(config, project_root=project_root)
        screen = config["training"]["stage4JointConditionLocalTransportFullDataScreenContract"]
        if (
            sorted(action.value for action in grant.allowed_actions)
            != _FULL_DATA_SCREEN_ALLOWED_ACTIONS
            or sorted(action.value for action in grant.explicitly_denied_actions)
            != _FULL_DATA_SCREEN_FORBIDDEN_ACTIONS
            or grant.dataset_constraints.get("seed") != 20263722
            or grant.dataset_constraints.get("epochCount") != 24
            or grant.dataset_constraints.get("optimizerStepCount") != 1152
            or grant.dataset_constraints.get("requiredUniqueTrainingTimestepCount") != 1000
            or grant.dataset_constraints.get("requiredExactInferenceOverlapCount") != 50
            or grant.checkpoint_constraints.get("parentDenoiserAllowed") is not False
            or screen.get("stage0Allowed") is not False
            or screen.get("checkpointPromotionAllowed") is not False
        ):
            raise ValueError("joint local-transport full-data screen grant changed")
    return {
        "status": "joint_condition_local_transport_full_data_screen_config_valid",
        "modeId": spec.mode_id,
        "runId": run_id,
        "outputNamespace": output_namespace,
        "epochCount": 24,
        "optimizerStepCount": 1152,
        "previewEpochs": [5, 10, 15, 20, 24],
        "ownerAuthorizationRequired": False,
        "ownerResponseRequired": False,
        "allowedExecutionActions": deepcopy(_FULL_DATA_SCREEN_ALLOWED_ACTIONS),
        "internalExecutionTicketRequired": require_execution_ticket,
        "executionStartedByValidation": False,
    }

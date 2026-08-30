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
from ai_painter_spatial_affine_decoder_contract import (
    FORMAL_LOSS_SOURCE_EVIDENCE,
    compile_spatial_affine_decoder_cpu_inactive_config,
    load_spatial_affine_formal_objective_contract,
)
from ai_painter_stage_mode_registry import (
    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_READONLY_GPU_STATUS,
    FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_SMOKE_STATUS,
    resolve_stage_mode,
)


ARCHITECTURE_ID = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
CAPABILITY_VERSION = ARCHITECTURE_ID
CONDITION_CHANNELS = 23
LATENT_CHANNELS = 12
BASE_CHANNELS = 64
AFFINE_FORMULA = "normalized * (1 + gamma) + beta"
CONDITION_RESIZE_CONTRACT = "discrete_nearest_continuous_bilinear_v1"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
FROZEN_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
CPU_SUPPORT_TERMINAL_EVIDENCE = {
    "path": (
        ".runtime/ai-painter/stage4-full-backbone-spatial-affine-cpu-supports/"
        "stage4-full-backbone-spatial-affine-cpu-support-20260829002039-"
        "4237acc7-b88f-49e3-b043-95aeeaf6cd9c/phase-terminal.json"
    ),
    "sha256": "d872eae0b03b0be8742d4aa7ad5a75163224f07de291086ce47eb0561cfd2d7d",
}
APPROVED_64_SELECTION_CONTRACT = "registered_v7_capacity_contribution_v1"
APPROVED_64_SELECTION_SHA256 = (
    "17f85a91d0d684ac234870997e574ceb5451a979e7a9cebab85cde5464b62796"
)
FIRST_TRAIN_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
)
FIXED_VALIDATION_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
)
_FIXED_CONDITION_PACK_SHA256 = {
    "firstTrain": (
        "05ff62ecdce5a4d545af0dc4652e64fe580d272f032049a8b464924bb751e3aa"
    ),
    "fixedValidation": (
        "2db536def8a3b7d3049b7cae673942edd77aa1151f432dc5774f2b3a33579ca9"
    ),
}
READONLY_GPU_OUTPUT_ROOT = (
    ".runtime/ai-painter/"
    "stage4-full-backbone-spatial-affine-readonly-gpu-qualifications"
)
READONLY_GPU_TICKET_ROOT = (
    ".runtime/ai-painter/"
    "stage4-full-backbone-spatial-affine-readonly-gpu-tickets"
)
CONTROLLED_SMOKE_OUTPUT_ROOT = (
    ".runtime/ai-painter/"
    "stage4-full-backbone-spatial-affine-controlled-smokes"
)
# The compiled contract places ticket and consumption evidence inside the
# immutable run root; there is deliberately no parallel ticket namespace.
CONTROLLED_SMOKE_TICKET_ROOT = CONTROLLED_SMOKE_OUTPUT_ROOT
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

ACTIVATION_GATE_KEYS = (
    "checkpointReadNow",
    "optimizerNow",
    "backwardNow",
    "weightModificationNow",
    "gpuNow",
    "readonlyGpuQualificationNow",
    "smokeNow",
    "fullDataScreenNow",
    "trainingNow",
    "stage0Now",
    "stage1Now",
    "stage2Now",
    "formalInferenceNow",
    "checkpointPromotionNow",
    "runtimeFrameNow",
    "worldEntryNow",
)

_BLOCK_BOUNDARIES = (
    ("block0", "encoder_level0", 64, 64, 48),
    ("block1", "encoder_level1", 128, 32, 24),
    ("middle1", "bottleneck_first", 256, 16, 12),
    ("middle2", "bottleneck_second", 256, 16, 12),
    ("up_block1", "decoder_level1", 128, 32, 24),
    ("up_block0", "decoder_level0", 64, 64, 48),
)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_json(value: Any) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


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
    resolved = (root / candidate).resolve()
    if candidate.parts[0].casefold() == ".runtime":
        runtime_root = (root / ".runtime").resolve()
        if resolved != runtime_root and runtime_root not in resolved.parents:
            raise ValueError(f"{label} path escapes the registered runtime")
    else:
        try:
            resolved.relative_to(root)
        except ValueError as error:
            raise ValueError(f"{label} path escapes the project") from error
    if not resolved.is_file():
        raise ValueError(f"{label} file is missing")
    return resolved


def _derive_fixed_qualification_sample(
    *,
    project_root: Path,
    all_samples: list[dict],
    selected_samples: list[dict],
    role: str,
    sample_id: str,
    expected_split: str,
    expected_selection_ordinal: int,
) -> dict:
    matching = [
        (index, row)
        for index, row in enumerate(all_samples)
        if row.get("sampleId") == sample_id
    ]
    if len(matching) != 1:
        raise ValueError(f"{role} source-index identity is not unique")
    source_index_ordinal, row = matching[0]
    selected_matching = [
        (index, candidate)
        for index, candidate in enumerate(selected_samples)
        if candidate.get("sampleId") == sample_id
    ]
    if len(selected_matching) != 1:
        raise ValueError(f"{role} approved-selection identity is not unique")
    selection_ordinal, selected_row = selected_matching[0]
    split_rows = [
        candidate
        for candidate in selected_samples
        if candidate.get("split") == expected_split
    ]
    split_matching = [
        index
        for index, candidate in enumerate(split_rows)
        if candidate.get("sampleId") == sample_id
    ]
    if (
        row != selected_row
        or selection_ordinal != expected_selection_ordinal
        or split_matching != [0]
        or row.get("recordId") != sample_id
        or row.get("split") != expected_split
        or not isinstance(row.get("v7CapacitySlotId"), str)
        or not row.get("v7CapacitySlotId")
    ):
        raise ValueError(f"{role} fixed selection position changed")

    source_record_path = _resolve_project_relative_file(
        project_root,
        str(row.get("sourceRecordPath", "")),
        label=f"{role} source record",
    )
    if _sha256_file(source_record_path) != row.get("sourceRecordSha256"):
        raise ValueError(f"{role} source record SHA-256 changed")
    condition_pack_path = _resolve_project_relative_file(
        project_root,
        str(row.get("conditionPackPath", "")),
        label=f"{role} condition pack",
    )
    condition_pack_sha256 = _sha256_file(condition_pack_path)
    if condition_pack_sha256 != _FIXED_CONDITION_PACK_SHA256[role]:
        raise ValueError(f"{role} condition pack SHA-256 changed")

    return {
        "role": role,
        "sampleId": sample_id,
        "recordId": row["recordId"],
        "split": expected_split,
        "sourceIndexOrdinal": source_index_ordinal,
        "selectionOrdinal": selection_ordinal,
        "splitOrdinal": 0,
        "v7CapacitySlotId": row["v7CapacitySlotId"],
        "sourceRecordPath": row["sourceRecordPath"],
        "sourceRecordSha256": row["sourceRecordSha256"],
        "conditionPackPath": row["conditionPackPath"],
        "conditionPackSha256": condition_pack_sha256,
    }


def _derive_qualification_samples_identity(
    *,
    project_root: Path,
    all_samples: list[dict],
    selected_samples: list[dict],
) -> dict:
    identity = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-"
            "qualification-samples-v1"
        ),
        "selectionContract": APPROVED_64_SELECTION_CONTRACT,
        "preboundReadOnlySamples": True,
        "freeSelectionAllowed": False,
        "selectBoundSampleActionRequired": False,
        "firstTrain": _derive_fixed_qualification_sample(
            project_root=project_root,
            all_samples=all_samples,
            selected_samples=selected_samples,
            role="firstTrain",
            sample_id=FIRST_TRAIN_SAMPLE_ID,
            expected_split="train",
            expected_selection_ordinal=0,
        ),
        "fixedValidation": _derive_fixed_qualification_sample(
            project_root=project_root,
            all_samples=all_samples,
            selected_samples=selected_samples,
            role="fixedValidation",
            sample_id=FIXED_VALIDATION_SAMPLE_ID,
            expected_split="validation",
            expected_selection_ordinal=48,
        ),
    }
    identity["identitySha256"] = _sha256_json(identity)
    return identity


def derive_readonly_gpu_evidence_bindings(
    project_root: Path = PROJECT_ROOT,
) -> dict:
    """Recompute the immutable CPU, formal-data and Autoencoder identities."""

    root = project_root.resolve()
    terminal_path = _resolve_project_relative_file(
        root,
        CPU_SUPPORT_TERMINAL_EVIDENCE["path"],
        label="full-backbone CPU support terminal",
    )
    if _sha256_file(terminal_path) != CPU_SUPPORT_TERMINAL_EVIDENCE["sha256"]:
        raise ValueError("full-backbone CPU support terminal SHA-256 changed")
    terminal = json.loads(terminal_path.read_text(encoding="utf-8"))
    if (
        terminal.get("schemaVersion")
        != "stage4-full-backbone-spatial-affine-cpu-support-terminal-v1"
        or terminal.get("executionState") != "completed"
        or terminal.get("status")
        != "stage4_full_backbone_spatial_affine_cpu_support_succeeded_inactive"
        or terminal.get("capabilityVersion") != CAPABILITY_VERSION
        or terminal.get("nextLegalAction")
        != "qualify_stage4_full_backbone_spatial_affine_readonly_gpu"
        or terminal.get("ownerAuthorizationRequired") is not False
        or terminal.get("ownerResponseRequired") is not False
        or any(
            terminal.get(key) is not False
            for key in (
                "checkpointWeightsRead",
                "optimizerCreated",
                "backwardExecuted",
                "gpuStarted",
                "trainingStarted",
            )
        )
    ):
        raise ValueError("full-backbone CPU support terminal identity is invalid")

    formal = load_spatial_affine_formal_objective_contract(root)
    data = formal.get("data", {})
    if data.get("splitCounts") != FROZEN_SPLIT_COUNTS:
        raise ValueError("formal 64-record split identity changed")
    source_index_path = _resolve_project_relative_file(
        root,
        str(data.get("sourceIndexPath", "")),
        label="formal source index",
    )
    if _sha256_file(source_index_path) != data.get("sourceIndexSha256"):
        raise ValueError("formal source index SHA-256 changed")
    source_index = json.loads(source_index_path.read_text(encoding="utf-8"))
    samples = source_index.get("samples")
    if not isinstance(samples, list):
        raise ValueError("formal source index samples are missing")
    selected = [
        row
        for row in samples
        if row.get("v7CapacityContributionRegistered") is True
    ]
    selection_payload = [
        {
            "recordId": row.get("recordId"),
            "split": row.get("split"),
            "v7CapacitySlotId": row.get("v7CapacitySlotId"),
        }
        for row in selected
    ]
    split_counts = {
        split: sum(1 for row in selected if row.get("split") == split)
        for split in FROZEN_SPLIT_COUNTS
    }
    if (
        len(selected) != 64
        or split_counts != FROZEN_SPLIT_COUNTS
        or len({row.get("recordId") for row in selected}) != 64
        or len({row.get("v7CapacitySlotId") for row in selected}) != 64
        or any(
            not isinstance(row.get("recordId"), str)
            or not row.get("recordId")
            or not isinstance(row.get("v7CapacitySlotId"), str)
            or not row.get("v7CapacitySlotId")
            or row.get("formalConditionalTrainingEligible") is not True
            or row.get("conditionBound") is not True
            for row in selected
        )
        or _sha256_json(selection_payload) != APPROVED_64_SELECTION_SHA256
    ):
        raise ValueError("formal approved 64-record selection identity changed")

    model = formal.get("modelBoundary", {})
    qualification_samples = _derive_qualification_samples_identity(
        project_root=root,
        all_samples=samples,
        selected_samples=selected,
    )
    return {
        "cpuSupportTerminal": {
            **deepcopy(CPU_SUPPORT_TERMINAL_EVIDENCE),
            "runId": terminal["runId"],
            "status": terminal["status"],
        },
        "formalObjectiveContract": deepcopy(FORMAL_LOSS_SOURCE_EVIDENCE),
        "approved64Selection": {
            "selectionContract": APPROVED_64_SELECTION_CONTRACT,
            "datasetPackageId": data.get("datasetPackageId"),
            "datasetManifestPath": data.get("datasetManifestPath"),
            "datasetManifestSha256": data.get("datasetManifestSha256"),
            "sourceIndexPath": data.get("sourceIndexPath"),
            "sourceIndexSha256": data.get("sourceIndexSha256"),
            "selectedRecordCount": 64,
            "splitCounts": deepcopy(FROZEN_SPLIT_COUNTS),
            "selectedRecordIdentitySha256": APPROVED_64_SELECTION_SHA256,
        },
        "qualificationSamples": qualification_samples,
        "autoencoderCheckpointIdentity": {
            "path": model.get("autoencoderCheckpointPath"),
            "sha256": model.get("autoencoderCheckpointSha256"),
            "provenance": model.get("autoencoderRequiredCheckpointProvenance"),
            "loadAllowedForReadonlyGpuQualification": True,
            "stateMutationAllowed": False,
        },
    }


def derive_formal_condition_identity() -> dict:
    """Inherit the immutable typed-condition identity from the predecessor."""

    formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
    order = list(formal.get("conditionChannelOrder", []))
    types = deepcopy(formal.get("conditionChannelTypes", {}))
    discrete = list(types.get("discrete", []))
    continuous = list(types.get("continuous", []))
    source_contract_identity = {
        "schemaVersion": formal.get("schemaVersion"),
        "path": FORMAL_LOSS_SOURCE_EVIDENCE["path"],
        "sha256": FORMAL_LOSS_SOURCE_EVIDENCE["sha256"],
        "status": formal.get("status"),
        "historicalRuntimeArtifactIsExecutionSource": formal.get(
            "historicalRuntimeArtifactIsExecutionSource"
        ),
    }
    if (
        len(order) != CONDITION_CHANNELS
        or len(set(order)) != CONDITION_CHANNELS
        or set(types) != {"discrete", "continuous"}
        or discrete + continuous != order
        or set(discrete) & set(continuous)
        or source_contract_identity["schemaVersion"]
        != "ai-painter-stage4-formal-diffusion-objective-and-checkpoint-contract-v1"
        or source_contract_identity["status"] != "active_machine_contract"
        or source_contract_identity[
            "historicalRuntimeArtifactIsExecutionSource"
        ] is not False
    ):
        raise ValueError(
            "formal spatial-affine typed-condition source identity is invalid"
        )
    return {
        "sourceContractIdentity": source_contract_identity,
        "conditionChannels": CONDITION_CHANNELS,
        "conditionChannelOrder": order,
        "conditionChannelTypes": {
            "discrete": discrete,
            "continuous": continuous,
        },
        "conditionResizeContract": CONDITION_RESIZE_CONTRACT,
    }


def _projection_contract(feature_channels: int, projection_index: int) -> dict:
    output_channels = feature_channels * 2
    weight_parameter_count = (
        output_channels * CONDITION_CHANNELS * 3 * 3
    )
    bias_parameter_count = output_channels
    return {
        "projectionIndex": projection_index,
        "module": "Conv2d",
        "inputChannels": CONDITION_CHANNELS,
        "outputChannels": output_channels,
        "outputChannelsFormula": "2 * featureChannels",
        "kernelSize": 3,
        "padding": 1,
        "bias": True,
        "parameterTensorCount": 2,
        "weightParameterCount": weight_parameter_count,
        "biasParameterCount": bias_parameter_count,
        "parameterCount": weight_parameter_count + bias_parameter_count,
    }


def derive_full_backbone_block_contracts() -> list[dict]:
    blocks: list[dict] = []
    for block_id, role, channels, spatial_width, spatial_height in _BLOCK_BOUNDARIES:
        projections = [
            _projection_contract(channels, projection_index)
            for projection_index in (1, 2)
        ]
        blocks.append({
            "blockId": block_id,
            "module": "TimeResidualBlock",
            "role": role,
            "featureChannels": channels,
            "stage0SpatialWidth": spatial_width,
            "stage0SpatialHeight": spatial_height,
            "normalizationPointCount": 2,
            "affineFormula": AFFINE_FORMULA,
            "projectionCount": len(projections),
            "parameterTensorCount": sum(
                item["parameterTensorCount"] for item in projections
            ),
            "parameterCount": sum(
                item["parameterCount"] for item in projections
            ),
            "projections": projections,
        })
    return blocks


def _architecture_contract() -> dict:
    blocks = derive_full_backbone_block_contracts()
    condition_identity = derive_formal_condition_identity()
    parameter_count = sum(block["parameterCount"] for block in blocks)
    parameter_tensor_count = sum(
        block["parameterTensorCount"] for block in blocks
    )
    projection_count = sum(block["projectionCount"] for block in blocks)
    current_decoder_only_parameter_count = sum(
        block["parameterCount"]
        for block in blocks
        if block["blockId"] in {"up_block1", "up_block0"}
    )
    return {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-conditioning-contract-v1"
        ),
        "status": "cpu_supported_inactive",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "conditionInputIdentity": "same_formal_typed_23_channel_conditions",
        "conditionChannels": CONDITION_CHANNELS,
        "conditionIdentitySourceContract": deepcopy(
            condition_identity["sourceContractIdentity"]
        ),
        "conditionChannelOrder": deepcopy(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": deepcopy(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": condition_identity[
            "conditionResizeContract"
        ],
        "blockCount": len(blocks),
        "projectionCount": projection_count,
        "parameterTensorCount": parameter_tensor_count,
        "parameterCount": parameter_count,
        "currentDecoderOnlyParameterCount": current_decoder_only_parameter_count,
        "netNewParameterCount": parameter_count - current_decoder_only_parameter_count,
        "blocks": blocks,
        "existingConditionFusionPreserved": True,
        "newLossTermAdded": False,
        "lossWeightChanged": False,
        "freeArchitectureParameterChosen": False,
        "historicalCheckpointAllowed": False,
        "failedCheckpointAllowed": False,
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


def compile_full_backbone_spatial_affine_cpu_inactive_config() -> dict:
    condition_identity = derive_formal_condition_identity()
    config = {
        "schemaVersion": (
            "ai-painter-stage4-full-backbone-spatial-affine-cpu-inactive-config-v1"
        ),
        "status": "cpu_supported_inactive",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "conditionChannels": CONDITION_CHANNELS,
        "conditionChannelOrder": deepcopy(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": deepcopy(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": condition_identity[
            "conditionResizeContract"
        ],
        "latentChannels": LATENT_CHANNELS,
        "baseChannels": BASE_CHANNELS,
        "widthHierarchy": [64, 128, 256],
        "stage0Resolution": {"width": 256, "height": 192},
        "stage0LatentResolution": {"width": 64, "height": 48},
        "fullBackboneSpatialAffineContract": _architecture_contract(),
        "activationGates": _inactive_gates(),
        "executionBoundary": _execution_boundary(),
    }
    validate_full_backbone_spatial_affine_cpu_inactive_config(config)
    return deepcopy(config)


def validate_full_backbone_spatial_affine_cpu_inactive_config(
    config: dict,
) -> dict:
    if not isinstance(config, dict):
        raise ValueError("full-backbone spatial-affine config must be an object")

    condition_identity = derive_formal_condition_identity()
    expected = {
        "schemaVersion": (
            "ai-painter-stage4-full-backbone-spatial-affine-cpu-inactive-config-v1"
        ),
        "status": "cpu_supported_inactive",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "conditionChannels": CONDITION_CHANNELS,
        "conditionChannelOrder": deepcopy(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": deepcopy(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": condition_identity[
            "conditionResizeContract"
        ],
        "latentChannels": LATENT_CHANNELS,
        "baseChannels": BASE_CHANNELS,
        "widthHierarchy": [64, 128, 256],
        "stage0Resolution": {"width": 256, "height": 192},
        "stage0LatentResolution": {"width": 64, "height": 48},
        "fullBackboneSpatialAffineContract": _architecture_contract(),
        "activationGates": _inactive_gates(),
        "executionBoundary": _execution_boundary(),
    }
    if config != expected:
        raise ValueError(
            "full-backbone spatial-affine inactive contract identity changed"
        )

    contract = config["fullBackboneSpatialAffineContract"]
    if (
        contract["blockCount"] != 6
        or contract["projectionCount"] != 12
        or contract["parameterTensorCount"] != 24
        or contract["parameterCount"] != 745472
        or contract["currentDecoderOnlyParameterCount"] != 159744
        or contract["netNewParameterCount"] != 585728
    ):
        raise ValueError(
            "full-backbone spatial-affine derived parameter identity changed"
        )
    if any(config["activationGates"].values()):
        raise ValueError("full-backbone spatial-affine execution gate opened")
    if any(config["executionBoundary"].values()):
        raise ValueError("full-backbone spatial-affine CPU boundary was violated")

    return {
        "status": "full_backbone_spatial_affine_cpu_inactive_config_valid",
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": CAPABILITY_VERSION,
        "conditionChannelOrder": deepcopy(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": deepcopy(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": condition_identity[
            "conditionResizeContract"
        ],
        "blockCount": 6,
        "projectionCount": 12,
        "parameterTensorCount": 24,
        "parameterCount": 745472,
        "activationGate": False,
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
        "autoencoderIdentityInspectionAllowed": True,
        "checkpointIdentityInspectionAllowed": True,
        "autoencoderLoadAllowed": True,
        "parentDenoiserLoadAllowed": False,
        "optimizerCreationAllowed": False,
        "backwardExecutionAllowed": False,
        "modelWeightMutationAllowed": False,
        "checkpointWriteAllowed": False,
        "stageExecutionAllowed": False,
        "trainingAllowed": False,
        "formalInferenceAllowed": False,
        "runtimeFrameAllowed": False,
        "worldEntryAllowed": False,
    }


def _validate_readonly_execution_identity(
    run_id: Any,
    output_namespace: Any,
) -> tuple[str, str]:
    if not isinstance(run_id, str) or _SAFE_RUN_ID.fullmatch(run_id) is None:
        raise ValueError("full-backbone readonly GPU run identity is invalid")
    if not isinstance(output_namespace, str):
        raise ValueError("full-backbone readonly GPU output namespace is invalid")
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
            "full-backbone readonly GPU output namespace is not isolated"
        )
    return run_id, relative.as_posix()


def _compile_readonly_gpu_config_template(
    *,
    run_id: str,
    output_namespace: str,
    project_root: Path,
) -> dict:
    normalized_run_id, normalized_output = _validate_readonly_execution_identity(
        run_id,
        output_namespace,
    )
    config = compile_full_backbone_spatial_affine_cpu_inactive_config()
    config["schemaVersion"] = (
        "ai-painter-stage4-full-backbone-spatial-affine-readonly-gpu-config-v1"
    )
    config["status"] = "readonly_gpu_qualification_active"
    config["denoiserArchitecture"] = ARCHITECTURE_ID
    config["ownerAuthorizationRequired"] = False
    config["ownerResponseRequired"] = False
    config["executionIdentity"] = {
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
        "namespaceReuseAllowed": False,
        "crossRunEvidenceAllowed": False,
    }
    config["evidenceBindings"] = derive_readonly_gpu_evidence_bindings(
        project_root
    )
    config["fullBackboneSpatialAffineContract"]["status"] = (
        "active_local_ai_internal_readonly_gpu_qualification"
    )
    config["activationGates"] = _readonly_gpu_gates()
    config["readOnlyGpuBoundary"] = _readonly_gpu_boundary()
    config["training"] = {
        "trainingAuthorizationStatus": (
            FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_READONLY_GPU_STATUS
        ),
    }
    return config


def build_full_backbone_spatial_affine_readonly_gpu_config_template(
    *,
    run_id: str,
    output_namespace: str,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    """Build a ticket-free template; this function never starts CUDA."""

    config = _compile_readonly_gpu_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        project_root=project_root.resolve(),
    )
    validate_full_backbone_spatial_affine_readonly_gpu_config(
        config,
        project_root=project_root,
        require_execution_ticket=False,
    )
    return deepcopy(config)


def materialize_full_backbone_spatial_affine_readonly_gpu_config(
    template: dict,
    *,
    local_ai_capability_ticket: dict,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    active = deepcopy(template)
    training = active.get("training")
    if not isinstance(training, dict) or "localAiCapabilityTicket" in training:
        raise ValueError("full-backbone readonly GPU template is not pristine")
    training["localAiCapabilityTicket"] = deepcopy(local_ai_capability_ticket)
    validate_full_backbone_spatial_affine_readonly_gpu_config(
        active,
        project_root=project_root,
        require_execution_ticket=True,
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
    loaded = json.loads(path.read_text(encoding="utf-8"))
    if loaded != dict(expected):
        raise ValueError(f"{label} fields are invalid")
    return expected_sha256


def issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket(
    *,
    dataset_package_id: str,
    run_id: str,
    output_namespace: str,
    project_root: Path = PROJECT_ROOT,
) -> tuple[dict, dict]:
    """Exclusively consume one local ticket without executing any GPU action."""

    root = project_root.resolve()
    normalized_run_id, normalized_output = _validate_readonly_execution_identity(
        run_id,
        output_namespace,
    )
    template = build_full_backbone_spatial_affine_readonly_gpu_config_template(
        run_id=normalized_run_id,
        output_namespace=normalized_output,
        project_root=root,
    )
    selection = template["evidenceBindings"]["approved64Selection"]
    if dataset_package_id != selection["datasetPackageId"]:
        raise ValueError(
            "full-backbone readonly GPU dataset package identity changed"
        )
    output_path = (root / Path(normalized_output)).resolve()
    if output_path.exists():
        raise ValueError("full-backbone readonly GPU output namespace reuse is forbidden")

    ticket_directory_relative = Path(READONLY_GPU_TICKET_ROOT) / normalized_run_id
    ticket_directory = root / ticket_directory_relative
    ticket_directory.parent.mkdir(parents=True, exist_ok=True)
    ticket_directory.mkdir(exist_ok=False)
    ticket_path = ticket_directory / "ticket.json"
    consumption_path = ticket_directory / "consumption.json"
    ticket_id = f"local-ai-full-backbone-readonly-gpu-{normalized_run_id}"
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(template),
        "datasetPackageId": dataset_package_id,
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
    }
    actions = execution_action_values_for_stage_config(template)
    if actions != _READONLY_ALLOWED_ACTIONS:
        raise ValueError("full-backbone readonly GPU action policy changed")
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
        "schemaVersion": (
            "ai-painter-local-internal-capability-ticket-consumption-v2"
        ),
        "ticketId": ticket_id,
        "ticketSha256": ticket_sha256,
        "oneTimeConsumption": True,
        "state": "consumed",
        "binding": binding,
    }
    _write_json_exclusive(consumption_path, consumption)
    identity = {
        "ticketId": ticket_id,
        "ticketPath": ticket_path.relative_to(root).as_posix(),
        "ticketSha256": ticket_sha256,
        "consumptionPath": consumption_path.relative_to(root).as_posix(),
        "consumptionSha256": _sha256_file(consumption_path),
        "executionState": "consumed",
        "status": template["training"]["trainingAuthorizationStatus"],
        "executionActions": actions,
        **binding,
    }
    active = materialize_full_backbone_spatial_affine_readonly_gpu_config(
        template,
        local_ai_capability_ticket=identity,
        project_root=root,
    )
    return active, identity


def validate_full_backbone_spatial_affine_readonly_gpu_config(
    config: dict,
    *,
    project_root: Path = PROJECT_ROOT,
    require_execution_ticket: bool = True,
) -> dict:
    if not isinstance(config, dict):
        raise ValueError("full-backbone readonly GPU config must be an object")
    execution_identity = config.get("executionIdentity")
    if not isinstance(execution_identity, dict):
        raise ValueError("full-backbone readonly GPU execution identity is missing")
    run_id, output_namespace = _validate_readonly_execution_identity(
        execution_identity.get("runId"),
        execution_identity.get("outputNamespace"),
    )
    expected = _compile_readonly_gpu_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        project_root=project_root.resolve(),
    )
    training = config.get("training")
    ticket_identity = (
        training.get("localAiCapabilityTicket")
        if isinstance(training, dict)
        else None
    )
    if require_execution_ticket:
        if not isinstance(ticket_identity, dict):
            raise ValueError(
                "full-backbone readonly GPU requires one consumed internal ticket"
            )
        expected["training"]["localAiCapabilityTicket"] = deepcopy(
            ticket_identity
        )
    elif ticket_identity is not None:
        raise ValueError(
            "full-backbone readonly GPU template cannot carry a consumed ticket"
        )
    if config != expected:
        raise ValueError("full-backbone readonly GPU immutable identity changed")

    spec = resolve_stage_mode(config)
    if (
        spec.mode_id
        != "full_backbone_spatial_affine_denoiser_stage4_readonly_gpu"
        or spec.architecture != ARCHITECTURE_ID
        or spec.stage != 4
        or spec.execution_kind != "readonly_gpu_qualification"
        or spec.active_execution is not True
        or spec.sample_split is not None
    ):
        raise ValueError("full-backbone readonly GPU ModeSpec is invalid")
    if execution_action_values_for_stage_config(config) != _READONLY_ALLOWED_ACTIONS:
        raise ValueError("full-backbone readonly GPU execution actions changed")
    if {key for key, value in config["activationGates"].items() if value} != {
        "gpuNow",
        "readonlyGpuQualificationNow",
    }:
        raise ValueError("full-backbone readonly GPU activation gates changed")
    if any(config["executionBoundary"].values()):
        raise ValueError("full-backbone readonly GPU pre-execution state changed")
    if (
        config.get("ownerAuthorizationRequired") is not False
        or config.get("ownerResponseRequired") is not False
    ):
        raise ValueError("full-backbone readonly GPU cannot require Owner approval")

    if require_execution_ticket:
        grant = resolve_stage_execution_grant(config, project_root=project_root)
        allowed = sorted(action.value for action in grant.allowed_actions)
        denied = sorted(action.value for action in grant.explicitly_denied_actions)
        if allowed != _READONLY_ALLOWED_ACTIONS:
            raise ValueError("full-backbone readonly GPU grant widened")
        if denied != _READONLY_FORBIDDEN_ACTIONS:
            raise ValueError("full-backbone readonly GPU deny boundary changed")
        if grant.authorization_identity.get("authority") != (
            "local_ai_pet_world_program"
        ):
            raise ValueError("full-backbone readonly GPU authority changed")
    return {
        "status": "full_backbone_spatial_affine_readonly_gpu_config_valid",
        "modeId": spec.mode_id,
        "runId": run_id,
        "outputNamespace": output_namespace,
        "ownerAuthorizationRequired": False,
        "allowedExecutionActions": deepcopy(_READONLY_ALLOWED_ACTIONS),
        "internalExecutionTicketRequired": require_execution_ticket,
        "gpuExecutedByValidation": False,
    }


def _validate_controlled_smoke_execution_identity(
    run_id: Any,
    output_namespace: Any,
) -> tuple[str, str]:
    if not isinstance(run_id, str) or _SAFE_RUN_ID.fullmatch(run_id) is None:
        raise ValueError("full-backbone controlled Smoke run identity is invalid")
    if not isinstance(output_namespace, str):
        raise ValueError(
            "full-backbone controlled Smoke output namespace is invalid"
        )
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
            "full-backbone controlled Smoke output namespace is not isolated"
        )
    return run_id, relative.as_posix()


def _load_compiled_controlled_smoke_contract(
    *,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path,
) -> tuple[dict, dict]:
    if re.fullmatch(r"[0-9a-f]{64}", compiled_contract_sha256) is None:
        raise ValueError("compiled controlled Smoke SHA-256 is invalid")
    path = _resolve_project_relative_file(
        project_root,
        compiled_contract_path,
        label="compiled full-backbone controlled Smoke contract",
    )
    if _sha256_file(path) != compiled_contract_sha256:
        raise ValueError("compiled controlled Smoke contract SHA-256 changed")
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
        != "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1"
        or contract.get("status") != "compiled_not_started"
        or contract.get("authority") != "local_ai_pet_world_program"
        or contract.get("capabilityVersion") != CAPABILITY_VERSION
        or contract.get("architectureId") != ARCHITECTURE_ID
        or not isinstance(contract.get("compilationRunId"), str)
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
        or model.get("conditionChannelOrder")
        != derive_formal_condition_identity()["conditionChannelOrder"]
        or model.get("conditionResizeContract") != CONDITION_RESIZE_CONTRACT
        or model.get("latentChannels") != LATENT_CHANNELS
        or model.get("widths") != [64, 128, 256]
        or model.get("timeEmbeddingChannels") != 256
        or model.get("existingConditionFusionPreserved") is not True
        or model.get("existingDiffusionObjectivePreserved") is not True
        or model.get("newLossTermAdded") is not False
        or model.get("freeArchitectureParameterChosen") is not False
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
    ):
        raise ValueError("compiled controlled Smoke contract identity is invalid")

    run_id, output_namespace = _validate_controlled_smoke_execution_identity(
        execution.get("runId"),
        namespace.get("outputDirectory"),
    )
    expected_paths = {
        "activeConfig": f"{output_namespace}/active-config.json",
        "internalTicket": f"{output_namespace}/internal-ticket.json",
        "ticketConsumption": (
            f"{output_namespace}/internal-ticket-consumption.json"
        ),
        "preflightReport": f"{output_namespace}/preflight-report.json",
        "trainingOutput": f"{output_namespace}/training-output",
        "progress": f"{output_namespace}/training-output/progress.json",
        "resourceTelemetry": (
            f"{output_namespace}/training-output/resource-telemetry.json"
        ),
        "fixedPreviews": (
            f"{output_namespace}/training-output/fixed-epoch-previews"
        ),
        "machineReviewTimeline": (
            f"{output_namespace}/machine-review-timeline.json"
        ),
        "lateStabilityQualification": (
            f"{output_namespace}/late-stability-qualification.json"
        ),
        "manifest": f"{output_namespace}/manifest.json",
        "finalization": f"{output_namespace}/finalization/finalization.json",
        "phaseTerminal": f"{output_namespace}/phase-terminal.json",
    }
    if any(namespace.get(key) != value for key, value in expected_paths.items()):
        raise ValueError("compiled controlled Smoke evidence namespace changed")
    binding = {
        "path": Path(compiled_contract_path).as_posix(),
        "sha256": compiled_contract_sha256,
        "schemaVersion": contract["schemaVersion"],
        "status": contract["status"],
        "compilationRunId": contract["compilationRunId"],
    }
    return contract, binding


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
        "forbiddenExecutionActions": deepcopy(
            _CONTROLLED_SMOKE_FORBIDDEN_ACTIONS
        ),
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


def _validate_controlled_smoke_preflight_report(
    *,
    report_path: Path,
    run_id: str,
    output_namespace: str,
    compiled_contract_binding: Mapping[str, Any],
) -> None:
    if not report_path.is_file() or report_path.is_symlink():
        raise ValueError("full-backbone controlled Smoke preflight report is missing")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    checks = report.get("checks")
    required_checks = {
        "cpuPositiveNegativeGate",
        "activeConfigAudit",
        "nodeTrainerReadonlyPreflight",
        "pythonCudaResource",
        "diskCapacity",
        "trainingOutputAbsent",
    }
    if (
        report.get("schemaVersion")
        != (
            "stage4-full-backbone-spatial-affine-controlled-smoke-"
            "preflight-report-v1"
        )
        or report.get("status") != "all_preflight_checks_passed"
        or report.get("runId") != run_id
        or report.get("outputNamespace") != output_namespace
        or report.get("compiledContract") != dict(compiled_contract_binding)
        or not isinstance(checks, dict)
        or not required_checks.issubset(checks)
        or any(checks.get(key) is not True for key in required_checks)
        or report.get("ownerAuthorizationRequired") is not False
        or report.get("gpuStarted") is not False
        or report.get("trainingStarted") is not False
    ):
        raise ValueError(
            "full-backbone controlled Smoke preflight did not prove every gate"
        )


def _compile_controlled_smoke_config_template(
    *,
    run_id: str,
    output_namespace: str,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path,
) -> dict:
    normalized_run_id, normalized_output = (
        _validate_controlled_smoke_execution_identity(run_id, output_namespace)
    )
    contract, contract_binding = _load_compiled_controlled_smoke_contract(
        compiled_contract_path=compiled_contract_path,
        compiled_contract_sha256=compiled_contract_sha256,
        project_root=project_root,
    )
    if (
        contract["executionIdentity"]["runId"] != normalized_run_id
        or contract["futureEvidenceNamespace"]["outputDirectory"]
        != normalized_output
    ):
        raise ValueError(
            "compiled controlled Smoke execution identity does not match the run"
        )
    evidence = derive_readonly_gpu_evidence_bindings(project_root)
    evidence["compiledControlledSmokeContract"] = contract_binding
    execution = contract["executionIdentity"]
    # The execution config must be a complete Trainer contract.  Derive it
    # from the verified formal spatial-affine training baseline, then replace
    # only the candidate architecture identity and the bounded Smoke fields.
    # Trainer-side hydration is forbidden because it would split the ticket's
    # config digest from the config that actually reaches training.
    config = compile_spatial_affine_decoder_cpu_inactive_config(
        project_root=project_root,
    )
    config["schemaVersion"] = (
        "ai-painter-stage4-full-backbone-spatial-affine-controlled-smoke-config-v1"
    )
    config["modelId"] = "ai-painter-stage4-full-backbone-spatial-affine-denoiser-v1"
    config["architectureVersion"] = (
        "full-backbone-spatial-affine-conditioned-denoiser-v1"
    )
    config["status"] = "controlled_smoke_active"
    config["denoiserArchitecture"] = ARCHITECTURE_ID
    config["ownerAuthorizationRequired"] = False
    config["ownerResponseRequired"] = False
    config["executionIdentity"] = {
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
        "namespaceReuseAllowed": False,
        "crossRunEvidenceAllowed": False,
    }
    config["evidenceBindings"] = evidence
    config.pop("stage4SpatialAffineConditioningContract", None)
    config["fullBackboneSpatialAffineContract"] = _architecture_contract()
    config["fullBackboneSpatialAffineContract"]["status"] = (
        "active_local_ai_internal_controlled_smoke"
    )
    config["activationGates"] = _controlled_smoke_gates()
    config["executionBoundary"] = _execution_boundary()
    config["controlledSmokeBoundary"] = _controlled_smoke_boundary()
    training = config["training"]
    training["trainingAuthorizationStatus"] = (
        FULL_BACKBONE_SPATIAL_AFFINE_DENOISER_STAGE4_SMOKE_STATUS
    )
    training["denoiserEpochs"] = execution["epochCount"]
    training["seed"] = execution["seed"]
    training["fixedEpochPreviewPolicy"]["smoke"] = deepcopy(
        execution["previewEpochs"]
    )
    training["activationGates"] = _controlled_smoke_gates()
    training["stage4FullBackboneSpatialAffineSmokeContract"] = {
            "schemaVersion": (
                "stage4-full-backbone-spatial-affine-controlled-smoke-"
                "execution-contract-v1"
            ),
            "status": "active_bound_to_compiled_contract",
            "compiledContract": contract_binding,
            "sampleId": execution["sampleId"],
            "sampleSplit": execution["sampleSplit"],
            "seed": execution["seed"],
            "topology": execution["topology"],
            "requiredBoundarySides": [execution["topology"]],
            "resolutionStage": execution["resolutionStage"],
            "resolution": deepcopy(execution["resolution"]),
            "latentResolution": deepcopy(execution["latentResolution"]),
            "epochCount": execution["epochCount"],
            "previewEpochs": deepcopy(execution["previewEpochs"]),
            "initialization": execution["initialization"],
            "autoencoderFrozen": execution["autoencoderFrozen"],
            "denoiserCheckpointPath": None,
            "denoiserCheckpointReadAllowed": False,
            "historicalCheckpointAllowed": False,
            "failedCheckpointAllowed": False,
            "crossRunArtifactAllowed": False,
            "automaticTrainingRetryAllowed": False,
    }
    return config


def build_full_backbone_spatial_affine_controlled_smoke_config_template(
    *,
    run_id: str,
    output_namespace: str,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    """Build a ticket-free immutable template without starting execution."""

    config = _compile_controlled_smoke_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        compiled_contract_path=compiled_contract_path,
        compiled_contract_sha256=compiled_contract_sha256,
        project_root=project_root.resolve(),
    )
    validate_full_backbone_spatial_affine_controlled_smoke_config(
        config,
        project_root=project_root,
        require_execution_ticket=False,
    )
    return deepcopy(config)


def materialize_full_backbone_spatial_affine_controlled_smoke_config(
    template: dict,
    *,
    local_ai_capability_ticket: dict,
    project_root: Path = PROJECT_ROOT,
) -> dict:
    active = deepcopy(template)
    training = active.get("training")
    if not isinstance(training, dict) or "localAiCapabilityTicket" in training:
        raise ValueError("full-backbone controlled Smoke template is not pristine")
    training["localAiCapabilityTicket"] = deepcopy(local_ai_capability_ticket)
    validate_full_backbone_spatial_affine_controlled_smoke_config(
        active,
        project_root=project_root,
        require_execution_ticket=True,
    )
    return active


def issue_and_consume_full_backbone_spatial_affine_controlled_smoke_ticket(
    *,
    dataset_package_id: str,
    run_id: str,
    output_namespace: str,
    compiled_contract_path: str,
    compiled_contract_sha256: str,
    project_root: Path = PROJECT_ROOT,
) -> tuple[dict, dict]:
    """Atomically issue/consume one local ticket after preflight has passed."""

    root = project_root.resolve()
    normalized_run_id, normalized_output = (
        _validate_controlled_smoke_execution_identity(run_id, output_namespace)
    )
    template = build_full_backbone_spatial_affine_controlled_smoke_config_template(
        run_id=normalized_run_id,
        output_namespace=normalized_output,
        compiled_contract_path=compiled_contract_path,
        compiled_contract_sha256=compiled_contract_sha256,
        project_root=root,
    )
    selection = template["evidenceBindings"]["approved64Selection"]
    if dataset_package_id != selection["datasetPackageId"]:
        raise ValueError("full-backbone controlled Smoke dataset identity changed")
    output_path = root / Path(normalized_output)
    registered_parent = (root / CONTROLLED_SMOKE_OUTPUT_ROOT).resolve()
    if (
        not output_path.is_dir()
        or output_path.is_symlink()
        or output_path.resolve().parent != registered_parent
    ):
        raise ValueError(
            "full-backbone controlled Smoke preflight run root is invalid"
        )
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
        raise ValueError(
            "full-backbone controlled Smoke preflight output was reused or injected"
        )
    if (output_path / "training-output").exists():
        raise ValueError(
            "full-backbone controlled Smoke training output exists before Trainer"
        )
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
    ticket_id = f"local-ai-full-backbone-controlled-smoke-{normalized_run_id}"
    binding = {
        "boundConfigSha256": local_ai_ticket_bound_config_sha256(template),
        "datasetPackageId": dataset_package_id,
        "runId": normalized_run_id,
        "outputNamespace": normalized_output,
    }
    actions = execution_action_values_for_stage_config(template)
    if actions != _CONTROLLED_SMOKE_ALLOWED_ACTIONS:
        raise ValueError("full-backbone controlled Smoke action policy changed")
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
        label="full-backbone controlled Smoke internal ticket",
    )
    consumption = {
        "schemaVersion": (
            "ai-painter-local-internal-capability-ticket-consumption-v2"
        ),
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
        label="full-backbone controlled Smoke ticket consumption",
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
    active = materialize_full_backbone_spatial_affine_controlled_smoke_config(
        template,
        local_ai_capability_ticket=identity,
        project_root=root,
    )
    return active, identity


def validate_full_backbone_spatial_affine_controlled_smoke_config(
    config: dict,
    *,
    project_root: Path = PROJECT_ROOT,
    require_execution_ticket: bool = True,
) -> dict:
    if not isinstance(config, dict):
        raise ValueError("full-backbone controlled Smoke config must be an object")
    execution_identity = config.get("executionIdentity")
    evidence = config.get("evidenceBindings")
    if not isinstance(execution_identity, dict) or not isinstance(evidence, dict):
        raise ValueError("full-backbone controlled Smoke identity is missing")
    run_id, output_namespace = _validate_controlled_smoke_execution_identity(
        execution_identity.get("runId"),
        execution_identity.get("outputNamespace"),
    )
    contract_binding = evidence.get("compiledControlledSmokeContract")
    if not isinstance(contract_binding, dict):
        raise ValueError("compiled controlled Smoke binding is missing")
    expected = _compile_controlled_smoke_config_template(
        run_id=run_id,
        output_namespace=output_namespace,
        compiled_contract_path=str(contract_binding.get("path", "")),
        compiled_contract_sha256=str(contract_binding.get("sha256", "")),
        project_root=project_root.resolve(),
    )
    training = config.get("training")
    ticket_identity = (
        training.get("localAiCapabilityTicket")
        if isinstance(training, dict)
        else None
    )
    if require_execution_ticket:
        if not isinstance(ticket_identity, dict):
            raise ValueError(
                "full-backbone controlled Smoke requires one consumed internal ticket"
            )
        expected["training"]["localAiCapabilityTicket"] = deepcopy(
            ticket_identity
        )
    elif ticket_identity is not None:
        raise ValueError(
            "full-backbone controlled Smoke template cannot carry a ticket"
        )
    if config != expected:
        raise ValueError("full-backbone controlled Smoke immutable identity changed")

    spec = resolve_stage_mode(config)
    if (
        spec.mode_id != "full_backbone_spatial_affine_denoiser_stage4_smoke"
        or spec.architecture != ARCHITECTURE_ID
        or spec.stage != 4
        or spec.execution_kind != "single_sample_smoke"
        or spec.active_execution is not True
        or spec.sample_split != "validation"
    ):
        raise ValueError("full-backbone controlled Smoke ModeSpec is invalid")
    if (
        execution_action_values_for_stage_config(config)
        != _CONTROLLED_SMOKE_ALLOWED_ACTIONS
    ):
        raise ValueError("full-backbone controlled Smoke actions changed")
    if {key for key, value in config["activationGates"].items() if value} != {
        "optimizerNow",
        "backwardNow",
        "weightModificationNow",
        "gpuNow",
        "smokeNow",
        "trainingNow",
    }:
        raise ValueError("full-backbone controlled Smoke activation gates changed")
    if any(config["executionBoundary"].values()):
        raise ValueError(
            "full-backbone controlled Smoke pre-execution state changed"
        )
    if (
        config.get("ownerAuthorizationRequired") is not False
        or config.get("ownerResponseRequired") is not False
    ):
        raise ValueError("full-backbone controlled Smoke cannot require Owner")

    if require_execution_ticket:
        grant = resolve_stage_execution_grant(config, project_root=project_root)
        allowed = sorted(action.value for action in grant.allowed_actions)
        denied = sorted(action.value for action in grant.explicitly_denied_actions)
        if allowed != _CONTROLLED_SMOKE_ALLOWED_ACTIONS:
            raise ValueError("full-backbone controlled Smoke grant widened")
        if denied != _CONTROLLED_SMOKE_FORBIDDEN_ACTIONS:
            raise ValueError("full-backbone controlled Smoke deny boundary changed")
        if grant.authorization_identity.get("authority") != (
            "local_ai_pet_world_program"
        ):
            raise ValueError("full-backbone controlled Smoke authority changed")
        if (
            grant.dataset_constraints.get("sampleId")
            != FIXED_VALIDATION_SAMPLE_ID
            or grant.dataset_constraints.get("selectedSplit") != "validation"
            or grant.dataset_constraints.get("seed") != 20263722
            or grant.dataset_constraints.get("resolution")
            != {"width": 256, "height": 192}
            or grant.dataset_constraints.get("epochCount") != 30
            or grant.dataset_constraints.get("previewEpochs")
            != [1, 5, 10, 20, 30]
            or grant.checkpoint_constraints.get("parentDenoiserAllowed") is not False
        ):
            raise ValueError("full-backbone controlled Smoke grant identity changed")
    return {
        "status": "full_backbone_spatial_affine_controlled_smoke_config_valid",
        "modeId": spec.mode_id,
        "runId": run_id,
        "outputNamespace": output_namespace,
        "sampleId": FIXED_VALIDATION_SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": 20263722,
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "ownerAuthorizationRequired": False,
        "allowedExecutionActions": deepcopy(_CONTROLLED_SMOKE_ALLOWED_ACTIONS),
        "internalExecutionTicketRequired": require_execution_ticket,
        "executionStartedByValidation": False,
    }


__all__ = [
    "ACTIVATION_GATE_KEYS",
    "AFFINE_FORMULA",
    "ARCHITECTURE_ID",
    "CAPABILITY_VERSION",
    "CONDITION_RESIZE_CONTRACT",
    "CPU_SUPPORT_TERMINAL_EVIDENCE",
    "FIRST_TRAIN_SAMPLE_ID",
    "FIXED_VALIDATION_SAMPLE_ID",
    "APPROVED_64_SELECTION_CONTRACT",
    "APPROVED_64_SELECTION_SHA256",
    "READONLY_GPU_OUTPUT_ROOT",
    "READONLY_GPU_TICKET_ROOT",
    "CONTROLLED_SMOKE_OUTPUT_ROOT",
    "CONTROLLED_SMOKE_TICKET_ROOT",
    "build_full_backbone_spatial_affine_controlled_smoke_config_template",
    "build_full_backbone_spatial_affine_readonly_gpu_config_template",
    "compile_full_backbone_spatial_affine_cpu_inactive_config",
    "derive_formal_condition_identity",
    "derive_full_backbone_block_contracts",
    "derive_readonly_gpu_evidence_bindings",
    "issue_and_consume_full_backbone_spatial_affine_readonly_gpu_ticket",
    "issue_and_consume_full_backbone_spatial_affine_controlled_smoke_ticket",
    "materialize_full_backbone_spatial_affine_controlled_smoke_config",
    "materialize_full_backbone_spatial_affine_readonly_gpu_config",
    "validate_full_backbone_spatial_affine_cpu_inactive_config",
    "validate_full_backbone_spatial_affine_readonly_gpu_config",
    "validate_full_backbone_spatial_affine_controlled_smoke_config",
]

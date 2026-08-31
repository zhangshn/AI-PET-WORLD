from __future__ import annotations

"""Read-only CUDA qualification for the versioned Stage 4 semantic transport.

The formal entry point deliberately has no optimizer, ``Tensor.backward`` call,
Denoiser checkpoint loader, or checkpoint writer.  It reuses the released data,
the frozen project Autoencoder, the existing Trainer normalization and formal V6
objective, and ``torch.autograd.grad`` to prove the real CUDA graph without
changing model state.

Most validators in this module are device-independent so the authorization,
identity, parameter-set and negative-path contracts can be regression-tested on
CPU.  ``run_readonly_gpu_qualification`` itself always fails closed without CUDA.
"""

from argparse import ArgumentParser
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
import time
from typing import Any, Mapping, Sequence

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SOURCE_ROOT = PROJECT_ROOT / "ml" / "ai-painter" / "src"
for import_root in (SOURCE_ROOT, SCRIPT_DIR):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

from ai_painter.complete_world import build_complete_world_system  # noqa: E402
from ai_painter.complete_world.dataset import (  # noqa: E402
    AiAssistedConditionalDenoiserDataset,
)
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    ARCHITECTURE_ID,
    FORMAL_CONDITION_CHANNEL_ORDER,
    FORMAL_CONTINUOUS_CONDITION_ORDER,
    FORMAL_DISCRETE_CONDITION_ORDER,
    RESPONSIBILITY_IDENTITIES,
    build_stage4_semantic_transport_v2_cpu_inactive_config,
    stage4_semantic_transport_v2_optimizer_parameters,
    state_dict_sha256,
    validate_stage4_semantic_transport_v2_autoencoder_boundary,
    validate_stage4_semantic_transport_v2_trainer_contract,
)
import train_ai_assisted_conditional_denoiser as trainer  # noqa: E402


ACTIVE_CONFIG_SCHEMA = "ai-painter-stage4-v2-readonly-gpu-active-config-v1"
QUALIFICATION_SCHEMA = "ai-painter-stage4-v2-readonly-gpu-qualification-v1"
DATASET_RELEASE_SCHEMA = "ai-painter-stage4-v2-dataset-release-contract-v1"
DATASET_RELEASE_IDENTITY = (
    "ai-painter-stage4-v2-mvp64-"
    "fc8807d3501380ea3b9c43a895e711d94e40e14df97d805c52361d8a05a9fb16"
)
SELECTION_CONTRACT = "registered_v7_capacity_contribution_v1"
SEED = 20263722
IMAGE_SIZE = (256, 192)
LATENT_SIZE = (64, 48)
CONDITION_SHAPE = (1, 23, 192, 256)
LATENT_SHAPE = (1, 12, 48, 64)
DIFFUSION_TIMESTEP = 500
FIRST_TRAIN_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
)
VALIDATION_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
)
EXPECTED_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
EXPECTED_PARAMETER_TENSOR_COUNT = 210
EXPECTED_PARAMETER_SCALAR_COUNT = 4_743_755
EXPECTED_SHARED_PARAMETER_TENSOR_COUNT = 98
EXPECTED_RESPONSIBILITY_PATH_TENSORS = 12
EXPECTED_RGB_HEAD_TENSORS = 4
EXPECTED_AUTOENCODER_PARAMETER_TENSOR_COUNT = 64
EXPECTED_AUTOENCODER_PARAMETER_SCALAR_COUNT = 2_527_887
AUTOENCODER_SHA256 = (
    "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
)

PARENT_CONTRACT_PATH = Path(
    "data/ai-painter/system-governance/"
    "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json"
)
DATASET_RELEASE_PATH = Path(
    "data/ai-painter/system-governance/"
    "ai-painter-stage4-v2-mvp64-dataset-release-v1.json"
)
TRAINER_SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/"
    "stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json"
)
FOUNDATION_CONTRACT_PATH = Path(
    "data/ai-painter/system-governance/"
    "ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1.json"
)
FORMAL_OBJECTIVE_PATH = Path(
    "data/ai-painter/system-governance/"
    "stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json"
)
RUNNER_PATH = Path(
    "ml/ai-painter/scripts/"
    "run_stage4_semantic_transport_v2_readonly_gpu_qualification.py"
)
MODEL_FACTORY_PATH = Path(
    "ml/ai-painter/src/ai_painter/complete_world/model.py"
)
SUCCESSOR_MODULE_PATH = Path(
    "ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py"
)
TRAINER_PATH = Path(
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
)
TRAINER_SUPPORT_PROGRAM_PATH = Path(
    "ml/ai-painter/scripts/"
    "ai_painter_stage4_semantic_transport_v2_trainer_support.py"
)

REQUIRED_TRUE_SAFETY_FIELDS = (
    "gpuForwardAllowed",
    "autogradGradAllowed",
    "autoencoderCheckpointReadAllowed",
)
REQUIRED_FALSE_SAFETY_FIELDS = (
    "optimizerAllowed",
    "backwardAllowed",
    "denoiserCheckpointReadAllowed",
    "checkpointWriteAllowed",
    "weightMutationAllowed",
    "trainingAllowed",
    "smokeAllowed",
    "stage0Allowed",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_unreadable") from error
    if not isinstance(value, dict):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_not_object")
    return value


def _inside(path: Path, parent: Path) -> bool:
    resolved = path.resolve()
    root = parent.resolve()
    return resolved == root or root in resolved.parents


def resolve_project_path(
    value: str | Path,
    *,
    project_root: Path = PROJECT_ROOT,
    must_exist: bool,
    expect_file: bool = False,
) -> Path:
    candidate = Path(value)
    resolved = (
        candidate.resolve()
        if candidate.is_absolute()
        else (project_root / candidate).resolve()
    )
    runtime_root = (project_root / ".runtime").resolve()
    if not _inside(resolved, project_root) and not _inside(resolved, runtime_root):
        raise ValueError("stage4_v2_readonly_gpu_path_escape")
    if must_exist and not resolved.exists():
        raise ValueError("stage4_v2_readonly_gpu_bound_path_missing")
    if expect_file and not resolved.is_file():
        raise ValueError("stage4_v2_readonly_gpu_bound_file_missing")
    return resolved


def project_path(path: Path, *, project_root: Path = PROJECT_ROOT) -> str:
    resolved = path.resolve()
    runtime_root = (project_root / ".runtime").resolve()
    if _inside(resolved, runtime_root):
        return (Path(".runtime") / resolved.relative_to(runtime_root)).as_posix()
    if not _inside(resolved, project_root):
        raise ValueError("stage4_v2_readonly_gpu_path_escape")
    return resolved.relative_to(project_root.resolve()).as_posix()


def binding(path: Path, *, project_root: Path = PROJECT_ROOT) -> dict[str, str]:
    return {
        "path": project_path(path, project_root=project_root),
        "sha256": file_sha256(path),
    }


def verify_binding(
    value: Any,
    *,
    label: str,
    project_root: Path = PROJECT_ROOT,
    expected_path: Path | None = None,
) -> tuple[Path, dict[str, str]]:
    if not isinstance(value, Mapping):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_binding_missing")
    if not {"path", "sha256"}.issubset(value):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_binding_fields_invalid")
    path = resolve_project_path(
        str(value.get("path", "")),
        project_root=project_root,
        must_exist=True,
        expect_file=True,
    )
    if expected_path is not None and path != (project_root / expected_path).resolve():
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_path_invalid")
    observed = binding(path, project_root=project_root)
    if {"path": value.get("path"), "sha256": value.get("sha256")} != observed:
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_sha256_changed")
    return path, observed


def _write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())


def _require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_invalid")
    return value


def _validate_ticket(
    value: Any,
    *,
    package_id: str,
    run_id: str,
    project_root: Path,
) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_ticket_missing")
    ticket_id = _require_string(value.get("ticketId"), "ticket_id")
    status = value.get("status", value.get("executionState"))
    if status not in {"consumed_once", "consumed"}:
        raise ValueError("stage4_v2_readonly_gpu_ticket_not_consumed_once")
    ticket_path = resolve_project_path(
        _require_string(value.get("ticketPath"), "ticket_path"),
        project_root=project_root,
        must_exist=True,
        expect_file=True,
    )
    consumption_path = resolve_project_path(
        _require_string(value.get("consumptionPath"), "ticket_consumption_path"),
        project_root=project_root,
        must_exist=True,
        expect_file=True,
    )
    if file_sha256(ticket_path) != value.get("ticketSha256"):
        raise ValueError("stage4_v2_readonly_gpu_ticket_sha256_changed")
    if file_sha256(consumption_path) != value.get("consumptionSha256"):
        raise ValueError("stage4_v2_readonly_gpu_ticket_consumption_sha256_changed")
    ticket_record = _read_json(ticket_path, "ticket")
    consumption_record = _read_json(consumption_path, "ticket_consumption")
    for record, label in (
        (ticket_record, "ticket"),
        (consumption_record, "ticket_consumption"),
    ):
        if record.get("ticketId") not in {None, ticket_id}:
            raise ValueError(f"stage4_v2_readonly_gpu_{label}_identity_changed")
        if record.get("packageId") not in {None, package_id}:
            raise ValueError(f"stage4_v2_readonly_gpu_{label}_package_changed")
        if record.get("runId") not in {None, run_id}:
            raise ValueError(f"stage4_v2_readonly_gpu_{label}_run_changed")
    if consumption_record.get("status") not in {"consumed", "consumed_once"}:
        raise ValueError("stage4_v2_readonly_gpu_consumption_not_consumed_once")
    return {
        "ticketId": ticket_id,
        "ticket": binding(ticket_path, project_root=project_root),
        "consumption": binding(consumption_path, project_root=project_root),
        "status": "consumed_once",
    }


def validate_active_config_value(
    active: Mapping[str, Any],
    *,
    config_path: Path,
    config_sha256: str,
    output_dir: Path,
    project_root: Path = PROJECT_ROOT,
) -> dict[str, Any]:
    """Validate the immutable child execution boundary without touching CUDA."""

    if active.get("schemaVersion") != ACTIVE_CONFIG_SCHEMA:
        raise ValueError("stage4_v2_readonly_gpu_active_config_schema_invalid")
    if active.get("status") not in {
        "active",
        "active_not_consumed",
        "readonly_gpu_qualification_active",
    }:
        raise ValueError("stage4_v2_readonly_gpu_active_config_status_invalid")
    package_id = _require_string(active.get("packageId"), "package_id")
    run_id = _require_string(active.get("runId"), "run_id")
    if any(character in run_id for character in ("/", "\\", ":")):
        raise ValueError("stage4_v2_readonly_gpu_run_id_invalid")
    if file_sha256(config_path) != config_sha256:
        raise ValueError("stage4_v2_readonly_gpu_active_config_sha256_changed")
    expected_output = resolve_project_path(
        _require_string(active.get("outputDirectory"), "output_directory"),
        project_root=project_root,
        must_exist=False,
    )
    runtime_root = (project_root / ".runtime" / "ai-painter").resolve()
    if output_dir.resolve() != expected_output or not _inside(output_dir, runtime_root):
        raise ValueError("stage4_v2_readonly_gpu_output_directory_invalid")
    if output_dir.exists():
        raise ValueError("stage4_v2_readonly_gpu_output_reuse_forbidden")

    fixed = active.get("fixedInputs")
    if not isinstance(fixed, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_fixed_inputs_missing")
    resolution = fixed.get("resolution")
    expected_fixed = {
        "seed": SEED,
        "batchSize": 1,
        "diffusionTimestep": DIFFUSION_TIMESTEP,
        "firstTrainSampleId": FIRST_TRAIN_SAMPLE_ID,
        "fixedValidationSampleId": VALIDATION_SAMPLE_ID,
        "conditionChannels": 23,
        "latentChannels": 12,
    }
    for key, expected in expected_fixed.items():
        if fixed.get(key) != expected:
            raise ValueError(f"stage4_v2_readonly_gpu_fixed_{key}_changed")
    if resolution != {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]}:
        raise ValueError("stage4_v2_readonly_gpu_resolution_changed")

    safety = active.get("safety")
    if not isinstance(safety, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_safety_missing")
    for key in REQUIRED_TRUE_SAFETY_FIELDS:
        if safety.get(key) is not True:
            raise ValueError(f"stage4_v2_readonly_gpu_safety_{key}_closed")
    for key in REQUIRED_FALSE_SAFETY_FIELDS:
        if safety.get(key) is not False:
            raise ValueError(f"stage4_v2_readonly_gpu_safety_{key}_open")

    expected_bindings = {
        "parentContract": PARENT_CONTRACT_PATH,
        "datasetRelease": DATASET_RELEASE_PATH,
        "trainerSupport": TRAINER_SUPPORT_PATH,
        "foundationAutoencoder": FOUNDATION_CONTRACT_PATH,
    }
    declared_bindings = active.get("bindings")
    if not isinstance(declared_bindings, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_parent_bindings_missing")
    verified_bindings = {}
    for key, expected_path in expected_bindings.items():
        _, verified_bindings[key] = verify_binding(
            declared_bindings.get(key),
            label=key,
            project_root=project_root,
            expected_path=expected_path,
        )

    expected_programs = {
        "runner": RUNNER_PATH,
        "modelFactory": MODEL_FACTORY_PATH,
        "successorModule": SUCCESSOR_MODULE_PATH,
        "trainer": TRAINER_PATH,
        "trainerSupport": TRAINER_SUPPORT_PROGRAM_PATH,
    }
    declared_programs = active.get("programLineage")
    if not isinstance(declared_programs, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_program_lineage_missing")
    verified_programs = {}
    for key, expected_path in expected_programs.items():
        _, verified_programs[key] = verify_binding(
            declared_programs.get(key),
            label=f"program_{key}",
            project_root=project_root,
            expected_path=expected_path,
        )

    autoencoder = active.get("autoencoderBinding")
    autoencoder_path, autoencoder_binding = verify_binding(
        autoencoder,
        label="autoencoder_checkpoint",
        project_root=project_root,
    )
    if autoencoder_binding["sha256"] != AUTOENCODER_SHA256:
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_sha256_invalid")
    ticket = _validate_ticket(
        active.get("ticket"),
        package_id=package_id,
        run_id=run_id,
        project_root=project_root,
    )
    return {
        "packageId": package_id,
        "runId": run_id,
        "outputDir": output_dir.resolve(),
        "config": binding(config_path, project_root=project_root),
        "ticket": ticket,
        "bindings": verified_bindings,
        "programLineage": verified_programs,
        "autoencoderCheckpoint": autoencoder_path,
        "autoencoderBinding": autoencoder_binding,
        "fixedInputs": dict(fixed),
        "safety": dict(safety),
    }


def _validate_governance_chain(
    audit: Mapping[str, Any], *, project_root: Path
) -> dict[str, Any]:
    parent_path = project_root / PARENT_CONTRACT_PATH
    parent = _read_json(parent_path, "parent_contract")
    if (
        parent.get("contractId") != PARENT_CONTRACT_PATH.stem
        or parent.get("architectureId") != ARCHITECTURE_ID
        or parent.get("status") != "cpu_supported_inactive"
    ):
        raise ValueError("stage4_v2_readonly_gpu_parent_contract_invalid")
    declared = audit["bindings"]
    if declared["parentContract"] != binding(parent_path, project_root=project_root):
        raise ValueError("stage4_v2_readonly_gpu_parent_contract_changed")

    chain = {
        "datasetRelease": ("datasetBinding", DATASET_RELEASE_PATH),
        "trainerSupport": ("lossContract", TRAINER_SUPPORT_PATH),
        "foundationAutoencoder": (
            "foundationAssetBinding",
            FOUNDATION_CONTRACT_PATH,
        ),
    }
    values: dict[str, Any] = {"parent": parent}
    for active_key, (parent_key, expected_path) in chain.items():
        parent_binding = parent.get(parent_key)
        if not isinstance(parent_binding, Mapping):
            raise ValueError(f"stage4_v2_readonly_gpu_parent_{parent_key}_missing")
        expected = binding(project_root / expected_path, project_root=project_root)
        if (
            parent_binding.get("path") != expected["path"]
            or parent_binding.get("sha256") != expected["sha256"]
            or declared[active_key] != expected
        ):
            raise ValueError(f"stage4_v2_readonly_gpu_{active_key}_lineage_changed")
        values[active_key] = _read_json(
            project_root / expected_path,
            active_key,
        )

    release = values["datasetRelease"]
    if (
        release.get("schemaVersion") != DATASET_RELEASE_SCHEMA
        or release.get("datasetReleaseIdentity") != DATASET_RELEASE_IDENTITY
        or release.get("status") != "verified_dataset_release"
        or release.get("immutable") is not True
    ):
        raise ValueError("stage4_v2_readonly_gpu_dataset_release_invalid")
    foundation = values["foundationAutoencoder"]
    checkpoint = foundation.get("checkpoint")
    if (
        foundation.get("architectureId") != ARCHITECTURE_ID
        or not isinstance(checkpoint, Mapping)
        or checkpoint.get("sha256") != AUTOENCODER_SHA256
        or audit["autoencoderBinding"].get("path") != checkpoint.get("path")
        or audit["autoencoderBinding"].get("sha256") != checkpoint.get("sha256")
    ):
        raise ValueError("stage4_v2_readonly_gpu_foundation_lineage_invalid")
    return values


def build_qualification_model_config(
    *, project_root: Path = PROJECT_ROOT
) -> dict[str, Any]:
    config = build_stage4_semantic_transport_v2_cpu_inactive_config(project_root)
    formal = _read_json(project_root / FORMAL_OBJECTIVE_PATH, "formal_objective")
    boundary = formal.get("modelBoundary")
    if not isinstance(boundary, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_formal_model_boundary_missing")
    config.update(
        {
            "ownership": boundary["ownership"],
            "trainingLane": boundary["trainingLane"],
            "autoencoderSourceModelId": boundary["autoencoderSourceModelId"],
            "autoencoderSourceArchitectureVersion": boundary[
                "autoencoderSourceArchitectureVersion"
            ],
            "autoencoderRequiredCheckpointProvenance": boundary[
                "autoencoderRequiredCheckpointProvenance"
            ],
        }
    )
    validate_stage4_semantic_transport_v2_trainer_contract(
        config,
        root=project_root,
    )
    return config


def _release_row_binding(row: Mapping[str, Any], key: str) -> dict[str, str]:
    value = row.get(key)
    if not isinstance(value, Mapping) or set(value) != {"path", "sha256"}:
        raise ValueError(f"stage4_v2_readonly_gpu_release_{key}_binding_invalid")
    return {"path": str(value["path"]), "sha256": str(value["sha256"])}


def _validate_selected_sample_assets(
    release_row: Mapping[str, Any],
    source_row: Mapping[str, Any],
    *,
    project_root: Path,
) -> dict[str, Any]:
    image = _release_row_binding(release_row, "image")
    condition_pack = _release_row_binding(release_row, "conditionPack")
    contribution = _release_row_binding(release_row, "contribution")
    cross_checks = {
        "sampleId": release_row.get("sampleId"),
        "split": release_row.get("split"),
        "imageSha256": image["sha256"],
        "conditionPackPath": condition_pack["path"],
        "capacitySlotId": release_row.get("capacitySlotId"),
        "contributionPath": contribution["path"],
        "contributionSha256": contribution["sha256"],
    }
    observed = {
        "sampleId": source_row.get("sampleId"),
        "split": source_row.get("split"),
        "imageSha256": source_row.get("imageSha256"),
        "conditionPackPath": source_row.get("conditionPackPath"),
        "capacitySlotId": source_row.get("v7CapacitySlotId"),
        "contributionPath": source_row.get("v7CapacityContributionPath"),
        "contributionSha256": source_row.get("v7CapacityContributionSha256"),
    }
    if cross_checks != observed or source_row.get("imagePath") != image["path"]:
        raise ValueError("stage4_v2_readonly_gpu_selected_sample_identity_changed")

    verified = {}
    for key, declared in (
        ("image", image),
        ("conditionPack", condition_pack),
        ("contribution", contribution),
    ):
        path = resolve_project_path(
            declared["path"],
            project_root=project_root,
            must_exist=True,
            expect_file=True,
        )
        observed_binding = binding(path, project_root=project_root)
        if observed_binding != declared:
            raise ValueError(f"stage4_v2_readonly_gpu_selected_{key}_changed")
        verified[key] = observed_binding

    pack_path = resolve_project_path(
        condition_pack["path"],
        project_root=project_root,
        must_exist=True,
        expect_file=True,
    )
    pack = _read_json(pack_path, "condition_pack")
    channels = pack.get("channels")
    if not isinstance(channels, list) or len(channels) != 23:
        raise ValueError("stage4_v2_readonly_gpu_condition_pack_count_invalid")
    if tuple(channel.get("id") for channel in channels) != FORMAL_CONDITION_CHANNEL_ORDER:
        raise ValueError("stage4_v2_readonly_gpu_condition_pack_order_changed")
    channel_bindings = []
    for index, channel in enumerate(channels):
        identity = FORMAL_CONDITION_CHANNEL_ORDER[index]
        if (
            channel.get("dtype") != "uint8"
            or channel.get("valueRange") != [0, 255]
            or channel.get("shape") != [1, 768, 1024]
        ):
            raise ValueError(
                f"stage4_v2_readonly_gpu_condition_channel_metadata_changed:{identity}"
            )
        path = resolve_project_path(
            str(channel.get("path", "")),
            project_root=project_root,
            must_exist=True,
            expect_file=True,
        )
        observed_binding = binding(path, project_root=project_root)
        if observed_binding["sha256"] != channel.get("sha256"):
            raise ValueError(
                f"stage4_v2_readonly_gpu_condition_channel_sha_changed:{identity}"
            )
        kind = str(channel.get("kind", ""))
        is_continuous = kind in {
            "distance",
            "coordinate",
            "continuous",
            "continuous_map",
        }
        if identity in FORMAL_CONTINUOUS_CONDITION_ORDER and not is_continuous:
            raise ValueError(
                f"stage4_v2_readonly_gpu_continuous_channel_kind_changed:{identity}"
            )
        if identity in FORMAL_DISCRETE_CONDITION_ORDER and is_continuous:
            raise ValueError(
                f"stage4_v2_readonly_gpu_discrete_channel_kind_changed:{identity}"
            )
        channel_bindings.append({"id": identity, **observed_binding})
    return {**verified, "channels": channel_bindings}


def resolve_formal_inputs(
    model_config: Mapping[str, Any],
    governance: Mapping[str, Any],
    *,
    project_root: Path = PROJECT_ROOT,
) -> dict[str, Any]:
    release = governance["datasetRelease"]
    source_package = release.get("sourcePackage")
    if not isinstance(source_package, Mapping):
        raise ValueError("stage4_v2_readonly_gpu_source_package_missing")
    manifest_path, manifest_binding = verify_binding(
        source_package.get("manifest"),
        label="source_manifest",
        project_root=project_root,
    )
    source_index_path, source_index_binding = verify_binding(
        source_package.get("sourceIndex"),
        label="source_index",
        project_root=project_root,
    )
    rows = release.get("samples")
    if not isinstance(rows, list) or len(rows) != 64:
        raise ValueError("stage4_v2_readonly_gpu_release_sample_count_invalid")
    if [row.get("ordinal") for row in rows] != list(range(1, 65)):
        raise ValueError("stage4_v2_readonly_gpu_release_ordinal_order_changed")
    split_counts = {
        split: sum(row.get("split") == split for row in rows)
        for split in EXPECTED_SPLIT_COUNTS
    }
    if split_counts != EXPECTED_SPLIT_COUNTS:
        raise ValueError("stage4_v2_readonly_gpu_release_split_counts_changed")
    source_index = _read_json(source_index_path, "source_index")
    source_rows = source_index.get("samples")
    if (
        source_index.get("schemaVersion")
        != "ai-assisted-cold-start-dataset-source-index-v1"
        or not isinstance(source_rows, list)
        or len(source_rows) != 116
    ):
        raise ValueError("stage4_v2_readonly_gpu_source_index_invalid")
    source_by_id = {str(row.get("sampleId")): row for row in source_rows}
    if len(source_by_id) != len(source_rows):
        raise ValueError("stage4_v2_readonly_gpu_source_index_duplicate_sample")
    for row in rows:
        source_row = source_by_id.get(str(row.get("sampleId")))
        if not isinstance(source_row, Mapping):
            raise ValueError("stage4_v2_readonly_gpu_release_sample_not_in_source")
        if (
            row.get("split") != source_row.get("split")
            or row.get("image", {}).get("sha256") != source_row.get("imageSha256")
            or row.get("conditionPack", {}).get("path")
            != source_row.get("conditionPackPath")
        ):
            raise ValueError("stage4_v2_readonly_gpu_release_source_crosscheck_failed")

    train_row = rows[0]
    validation_matches = [
        row for row in rows if row.get("sampleId") == VALIDATION_SAMPLE_ID
    ]
    if (
        train_row.get("ordinal") != 1
        or train_row.get("sampleId") != FIRST_TRAIN_SAMPLE_ID
        or train_row.get("split") != "train"
        or len(validation_matches) != 1
        or validation_matches[0].get("ordinal") != 49
        or validation_matches[0].get("split") != "validation"
    ):
        raise ValueError("stage4_v2_readonly_gpu_fixed_sample_identity_changed")

    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            manifest_path,
            split,
            list(model_config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=SELECTION_CONTRACT,
        )
        for split in EXPECTED_SPLIT_COUNTS
    }
    observed_counts = {split: len(dataset) for split, dataset in datasets.items()}
    if observed_counts != EXPECTED_SPLIT_COUNTS:
        raise ValueError("stage4_v2_readonly_gpu_dataset_split_counts_changed")
    for split, dataset in datasets.items():
        released_ids = [row["sampleId"] for row in rows if row["split"] == split]
        dataset_ids = [row["sampleId"] for row in dataset.rows]
        if dataset_ids != released_ids:
            raise ValueError(
                f"stage4_v2_readonly_gpu_dataset_release_order_changed:{split}"
            )
    validation_index = next(
        index
        for index, row in enumerate(datasets["validation"].rows)
        if row["sampleId"] == VALIDATION_SAMPLE_ID
    )
    train_sample = datasets["train"][0]
    validation_sample = datasets["validation"][validation_index]
    if tuple(train_sample["conditions"].shape) != CONDITION_SHAPE[1:]:
        raise ValueError("stage4_v2_readonly_gpu_train_condition_shape_invalid")
    if tuple(validation_sample["conditions"].shape) != CONDITION_SHAPE[1:]:
        raise ValueError("stage4_v2_readonly_gpu_validation_condition_shape_invalid")

    train_assets = _validate_selected_sample_assets(
        train_row,
        source_by_id[FIRST_TRAIN_SAMPLE_ID],
        project_root=project_root,
    )
    validation_assets = _validate_selected_sample_assets(
        validation_matches[0],
        source_by_id[VALIDATION_SAMPLE_ID],
        project_root=project_root,
    )
    train_occupancy = responsibility_occupancy(
        train_sample["conditions"].unsqueeze(0)
    )
    validation_occupancy = responsibility_occupancy(
        validation_sample["conditions"].unsqueeze(0)
    )
    if train_occupancy["terrain_water"] or train_occupancy["terrain_shoreline"]:
        raise ValueError("stage4_v2_readonly_gpu_train_sample_absence_boundary_changed")
    expected_train_present = set(RESPONSIBILITY_IDENTITIES) - {
        "terrain_water",
        "terrain_shoreline",
    }
    if {name for name, present in train_occupancy.items() if present} != expected_train_present:
        raise ValueError("stage4_v2_readonly_gpu_train_sample_occupancy_changed")
    if not all(validation_occupancy.values()):
        raise ValueError("stage4_v2_readonly_gpu_validation_sample_not_full_coverage")
    return {
        "datasetRelease": binding(
            project_root / DATASET_RELEASE_PATH,
            project_root=project_root,
        ),
        "datasetReleaseIdentity": DATASET_RELEASE_IDENTITY,
        "sourceManifest": manifest_binding,
        "sourceIndex": source_index_binding,
        "splitCounts": observed_counts,
        "datasets": datasets,
        "trainSample": train_sample,
        "validationSample": validation_sample,
        "trainAssets": train_assets,
        "validationAssets": validation_assets,
        "trainOccupancy": train_occupancy,
        "validationOccupancy": validation_occupancy,
    }


def validate_parameter_inventory(model: torch.nn.Module) -> dict[str, Any]:
    named = tuple(
        (name, parameter)
        for name, parameter in model.denoiser.named_parameters()
        if parameter.requires_grad
    )
    optimizer_parameters = stage4_semantic_transport_v2_optimizer_parameters(model)
    if tuple(id(parameter) for _, parameter in named) != tuple(
        id(parameter) for parameter in optimizer_parameters
    ):
        raise ValueError("stage4_v2_readonly_gpu_optimizer_parameter_order_changed")
    if len(named) != EXPECTED_PARAMETER_TENSOR_COUNT:
        raise ValueError("stage4_v2_readonly_gpu_parameter_tensor_count_changed")
    if sum(parameter.numel() for _, parameter in named) != EXPECTED_PARAMETER_SCALAR_COUNT:
        raise ValueError("stage4_v2_readonly_gpu_parameter_scalar_count_changed")
    if len({id(parameter) for _, parameter in named}) != len(named):
        raise ValueError("stage4_v2_readonly_gpu_parameter_alias_detected")
    autoencoder_parameters = tuple(model.autoencoder.parameters())
    if (
        len(autoencoder_parameters) != EXPECTED_AUTOENCODER_PARAMETER_TENSOR_COUNT
        or sum(parameter.numel() for parameter in autoencoder_parameters)
        != EXPECTED_AUTOENCODER_PARAMETER_SCALAR_COUNT
    ):
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_parameter_identity_changed")
    if {id(parameter) for _, parameter in named} & {
        id(parameter) for parameter in autoencoder_parameters
    }:
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_parameter_overlap")

    namespace_counts = {}
    private_parameter_ids: dict[str, set[int]] = {}
    for identity in RESPONSIBILITY_IDENTITIES:
        path_prefix = f"responsibility_paths.{identity}."
        head_prefix = f"rgb_responsibility_heads.{identity}."
        path_items = tuple(item for item in named if item[0].startswith(path_prefix))
        head_items = tuple(item for item in named if item[0].startswith(head_prefix))
        if len(path_items) != EXPECTED_RESPONSIBILITY_PATH_TENSORS:
            raise ValueError(
                f"stage4_v2_readonly_gpu_responsibility_path_count_changed:{identity}"
            )
        if len(head_items) != EXPECTED_RGB_HEAD_TENSORS:
            raise ValueError(
                f"stage4_v2_readonly_gpu_rgb_head_count_changed:{identity}"
            )
        private_parameter_ids[f"path:{identity}"] = {
            id(parameter) for _, parameter in path_items
        }
        private_parameter_ids[f"rgb:{identity}"] = {
            id(parameter) for _, parameter in head_items
        }
        namespace_counts[identity] = {
            "responsibilityPathTensorCount": len(path_items),
            "rgbHeadTensorCount": len(head_items),
        }
    namespace_names = tuple(private_parameter_ids)
    for index, left in enumerate(namespace_names):
        for right in namespace_names[index + 1 :]:
            if private_parameter_ids[left] & private_parameter_ids[right]:
                raise ValueError(
                    f"stage4_v2_readonly_gpu_private_parameter_shared:{left}:{right}"
                )
    private_ids = set().union(*private_parameter_ids.values())
    shared_items = tuple(item for item in named if id(item[1]) not in private_ids)
    if len(shared_items) != EXPECTED_SHARED_PARAMETER_TENSOR_COUNT:
        raise ValueError("stage4_v2_readonly_gpu_shared_parameter_count_changed")
    return {
        "namedParameters": named,
        "parameterTensorCount": len(named),
        "parameterScalarCount": sum(parameter.numel() for _, parameter in named),
        "sharedParameterTensorCount": len(shared_items),
        "responsibilityNamespaces": namespace_counts,
        "autoencoderParameterTensorCount": len(autoencoder_parameters),
        "autoencoderParameterScalarCount": sum(
            parameter.numel() for parameter in autoencoder_parameters
        ),
        "optimizerParameterIdentityExact": True,
        "autoencoderExcluded": True,
        "privateParameterNamespacesPairwiseDisjoint": True,
    }


def responsibility_occupancy(conditions: torch.Tensor) -> dict[str, bool]:
    if tuple(conditions.shape) != CONDITION_SHAPE:
        raise ValueError("stage4_v2_readonly_gpu_condition_shape_invalid")
    return {
        identity: bool(
            conditions[
                :, FORMAL_CONDITION_CHANNEL_ORDER.index(identity)
            ].detach().max()
            > 0
        )
        for identity in RESPONSIBILITY_IDENTITIES
    }


def _private_parameter_identity(name: str) -> str | None:
    for identity in RESPONSIBILITY_IDENTITIES:
        if name.startswith(f"responsibility_paths.{identity}.") or name.startswith(
            f"rgb_responsibility_heads.{identity}."
        ):
            return identity
    return None


def summarize_tensor_gradient(
    gradient: torch.Tensor | None,
    *,
    expected_shape: Sequence[int],
    label: str,
    require_each_channel: bool,
) -> dict[str, Any]:
    if gradient is None or tuple(gradient.shape) != tuple(expected_shape):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_gradient_shape_invalid")
    detached = gradient.detach()
    if not bool(torch.isfinite(detached).all()):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_gradient_nonfinite")
    per_channel = detached.abs().flatten(2).amax(dim=2)[0]
    if require_each_channel and not bool((per_channel > 0).all()):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_channel_gradient_zero")
    if not bool((per_channel > 0).any()):
        raise ValueError(f"stage4_v2_readonly_gpu_{label}_gradient_zero")
    return {
        "shape": list(detached.shape),
        "finite": True,
        "nonzero": True,
        "allChannelsNonzero": bool((per_channel > 0).all()),
        "perChannelMaximumAbsoluteGradient": [
            float(value) for value in per_channel.cpu()
        ],
    }


def summarize_parameter_gradients(
    named_parameters: Sequence[tuple[str, torch.Tensor]],
    gradients: Sequence[torch.Tensor | None],
    *,
    occupancy: Mapping[str, bool],
    require_all: bool,
) -> dict[str, Any]:
    if len(named_parameters) != EXPECTED_PARAMETER_TENSOR_COUNT or len(gradients) != len(
        named_parameters
    ):
        raise ValueError("stage4_v2_readonly_gpu_gradient_parameter_count_invalid")
    rows = []
    nonzero_names = []
    permitted_absent = []
    for (name, parameter), gradient in zip(named_parameters, gradients, strict=True):
        private_identity = _private_parameter_identity(name)
        required = require_all or private_identity is None or bool(
            occupancy.get(private_identity)
        )
        if gradient is None:
            if required:
                raise ValueError(
                    f"stage4_v2_readonly_gpu_required_parameter_unreachable:{name}"
                )
            permitted_absent.append(name)
            rows.append(
                {
                    "parameterName": name,
                    "shape": list(parameter.shape),
                    "requiredForSample": False,
                    "gradientPresent": False,
                    "finite": True,
                    "nonzero": False,
                    "privateResponsibility": private_identity,
                }
            )
            continue
        if tuple(gradient.shape) != tuple(parameter.shape):
            raise ValueError(
                f"stage4_v2_readonly_gpu_parameter_gradient_shape_changed:{name}"
            )
        detached = gradient.detach()
        if not bool(torch.isfinite(detached).all()):
            raise ValueError(
                f"stage4_v2_readonly_gpu_parameter_gradient_nonfinite:{name}"
            )
        maximum = float(detached.abs().max().cpu())
        nonzero = maximum > 0.0
        if required and not nonzero:
            raise ValueError(
                f"stage4_v2_readonly_gpu_required_parameter_gradient_zero:{name}"
            )
        if nonzero:
            nonzero_names.append(name)
        elif not required:
            permitted_absent.append(name)
        rows.append(
            {
                "parameterName": name,
                "shape": list(parameter.shape),
                "requiredForSample": required,
                "gradientPresent": True,
                "finite": True,
                "nonzero": nonzero,
                "maximumAbsoluteGradient": maximum,
                "privateResponsibility": private_identity,
            }
        )
    return {
        "parameterTensorCount": len(named_parameters),
        "nonzeroParameterTensorCount": len(nonzero_names),
        "nonzeroParameterNames": nonzero_names,
        "permittedAbsentOrZeroParameterNames": permitted_absent,
        "allRequiredParametersFiniteNonzero": True,
        "parameters": rows,
    }


def validate_typed_resize(
    model: torch.nn.Module,
    conditions: torch.Tensor,
) -> dict[str, Any]:
    functional = torch.nn.functional
    observed = model.prepare_typed_conditions(conditions, (48, 64))
    discrete_indices = [
        FORMAL_CONDITION_CHANNEL_ORDER.index(name)
        for name in FORMAL_DISCRETE_CONDITION_ORDER
    ]
    continuous_indices = [
        FORMAL_CONDITION_CHANNEL_ORDER.index(name)
        for name in FORMAL_CONTINUOUS_CONDITION_ORDER
    ]
    expected = torch.empty_like(observed)
    expected[:, discrete_indices] = functional.interpolate(
        conditions[:, discrete_indices],
        size=(48, 64),
        mode="nearest",
    )
    expected[:, continuous_indices] = functional.interpolate(
        conditions[:, continuous_indices],
        size=(48, 64),
        mode="bilinear",
        align_corners=False,
    )
    if not torch.equal(observed, expected):
        raise ValueError("stage4_v2_readonly_gpu_typed_resize_behavior_changed")
    return {
        "status": "exact_reference_match",
        "shape": list(observed.shape),
        "discreteMode": "nearest",
        "continuousMode": "bilinear_align_corners_false",
        "maximumAbsoluteDifference": 0.0,
    }


def validate_forward_evidence(
    model: torch.nn.Module,
    noisy_latent: torch.Tensor,
    timestep: torch.Tensor,
    conditions: torch.Tensor,
    latent_normalization: Mapping[str, Any],
) -> dict[str, Any]:
    with torch.no_grad():
        velocity, latent_evidence = (
            model.predict_velocity_with_stage4_semantic_responsibility(
                noisy_latent,
                timestep,
                conditions,
            )
        )
        diffusion = trainer.build_diffusion_schedule(
            {"diffusionSteps": 1000},
            noisy_latent.device,
        )
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = (
            alpha.sqrt() * noisy_latent
            - (1.0 - alpha).sqrt() * velocity
        )
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(
            predicted_clean
        )
        rgb, rgb_evidence = model.decode_stage4_semantic_responsibility_rgb(
            trainer.denormalize_latent(predicted_clean, latent_normalization),
            conditions,
            return_evidence=True,
        )
    if tuple(velocity.shape) != LATENT_SHAPE or not bool(torch.isfinite(velocity).all()):
        raise ValueError("stage4_v2_readonly_gpu_velocity_output_invalid")
    if tuple(predicted_conditions.shape) != (1, 23, 48, 64):
        raise ValueError("stage4_v2_readonly_gpu_condition_probe_shape_invalid")
    if (
        not bool(torch.isfinite(predicted_conditions).all())
        or float(predicted_conditions.min()) < 0.0
        or float(predicted_conditions.max()) > 1.0
    ):
        raise ValueError("stage4_v2_readonly_gpu_condition_probe_range_invalid")
    if tuple(rgb.shape) != (1, 3, 192, 256) or not bool(torch.isfinite(rgb).all()):
        raise ValueError("stage4_v2_readonly_gpu_rgb_output_invalid")
    if float(rgb.min()) < 0.0 or float(rgb.max()) > 1.0:
        raise ValueError("stage4_v2_readonly_gpu_rgb_range_invalid")

    identity_order = tuple(latent_evidence.get("responsibilityIdentityOrder", ()))
    if identity_order != RESPONSIBILITY_IDENTITIES:
        raise ValueError("stage4_v2_readonly_gpu_latent_evidence_order_changed")
    dtype_tolerance = 32 * torch.finfo(velocity.dtype).eps
    latent_rows = []
    for identity in RESPONSIBILITY_IDENTITIES:
        evidence = latent_evidence["responsibilityEvidence"][identity]
        source_index = FORMAL_CONDITION_CHANNEL_ORDER.index(identity)
        source_mask = conditions[:, source_index : source_index + 1]
        expected_mask = torch.nn.functional.adaptive_max_pool2d(
            source_mask,
            (48, 64),
        )
        if not torch.equal(evidence["preservedMask"], expected_mask):
            raise ValueError(
                f"stage4_v2_readonly_gpu_preserved_mask_changed:{identity}"
            )
        weights = evidence["transportWeights"]
        if (
            tuple(weights.shape) != (1, 9, 48, 64)
            or not bool(torch.isfinite(weights).all())
            or bool((weights < 0).any())
            or not bool(
                torch.allclose(
                    weights.sum(dim=1),
                    torch.ones_like(weights[:, 0]),
                    atol=dtype_tolerance,
                    rtol=dtype_tolerance,
                )
            )
        ):
            raise ValueError(
                f"stage4_v2_readonly_gpu_transport_weights_invalid:{identity}"
            )
        latent_rows.append(
            {
                "identity": identity,
                "preservedMaskNonzero": bool(expected_mask.max() > 0),
                "transportWeightsShape": list(weights.shape),
                "transportWeightSumTolerance": dtype_tolerance,
            }
        )

    rgb_order = tuple(rgb_evidence.get("responsibilityIdentityOrder", ()))
    if rgb_order != RESPONSIBILITY_IDENTITIES:
        raise ValueError("stage4_v2_readonly_gpu_rgb_evidence_order_changed")
    masks = tuple(rgb_evidence["responsibilityMasks"])
    proposals = tuple(rgb_evidence["responsibilityRgbProposals"])
    gated = tuple(rgb_evidence["authoritativelyGatedResponsibilityRgb"])
    for index, identity in enumerate(RESPONSIBILITY_IDENTITIES):
        source_index = FORMAL_CONDITION_CHANNEL_ORDER.index(identity)
        source_mask = conditions[:, source_index : source_index + 1]
        if not torch.equal(masks[index], source_mask):
            raise ValueError(f"stage4_v2_readonly_gpu_rgb_mask_changed:{identity}")
        if not torch.equal(gated[index], proposals[index] * masks[index]):
            raise ValueError(f"stage4_v2_readonly_gpu_rgb_gating_changed:{identity}")
    union = torch.stack(masks, dim=0).sum(dim=0).clamp(0.0, 1.0)
    outside = union == 0
    base = rgb_evidence["baseDecodedRgb"]
    if not torch.equal(rgb.masked_select(outside.expand_as(rgb)), base.masked_select(outside.expand_as(base))):
        raise ValueError("stage4_v2_readonly_gpu_rgb_outside_mask_changed")
    return {
        "velocityShape": list(velocity.shape),
        "conditionProbeShape": list(predicted_conditions.shape),
        "rgbShape": list(rgb.shape),
        "responsibilities": latent_rows,
        "rgbMasksExact": True,
        "rgbGatingExact": True,
        "outsideResponsibilityUnionEqualsBaseRgb": True,
    }


def _sample_gradient_evidence(
    model: torch.nn.Module,
    sample: Mapping[str, Any],
    *,
    role: str,
    device: torch.device,
    model_config: Mapping[str, Any],
    latent_normalization: Mapping[str, Any],
    parameter_inventory: Mapping[str, Any],
    require_all_parameters: bool,
) -> dict[str, Any]:
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
    if tuple(image.shape) != (1, 3, 192, 256):
        raise ValueError("stage4_v2_readonly_gpu_image_shape_invalid")
    if tuple(conditions.shape) != CONDITION_SHAPE:
        raise ValueError("stage4_v2_readonly_gpu_condition_shape_invalid")
    typed_resize = validate_typed_resize(model, conditions)
    with torch.no_grad():
        clean_latent = trainer.normalize_latent(
            model.autoencoder.encode(image),
            latent_normalization,
        )
    if tuple(clean_latent.shape) != LATENT_SHAPE:
        raise ValueError("stage4_v2_readonly_gpu_clean_latent_shape_invalid")
    timestep = torch.tensor([DIFFUSION_TIMESTEP], dtype=torch.long, device=device)
    generator = torch.Generator(device=device).manual_seed(SEED)
    noise = torch.randn(clean_latent.shape, device=device, generator=generator)
    diffusion = trainer.build_diffusion_schedule(model_config, device)
    noisy_latent = trainer.add_noise(
        clean_latent,
        noise,
        timestep,
        diffusion["alphasCumulative"],
    ).requires_grad_(True)
    target_velocity = trainer.velocity_target(
        clean_latent,
        noise,
        timestep,
        diffusion["alphasCumulative"],
    )
    metrics = trainer.predict_and_measure(
        model,
        noisy_latent,
        target_velocity,
        clean_latent,
        timestep,
        diffusion["alphasCumulative"],
        conditions,
        model_config,
        image,
        latent_normalization,
    )
    loss = metrics.get("compositeLossTensor")
    if not isinstance(loss, torch.Tensor) or loss.ndim != 0 or not bool(torch.isfinite(loss)):
        raise ValueError("stage4_v2_readonly_gpu_formal_composite_loss_invalid")
    if float(metrics["stage4SemanticTransportV2FormalV6ObjectiveReused"].detach()) != 1.0:
        raise ValueError("stage4_v2_readonly_gpu_formal_v6_dispatch_changed")
    named_parameters = parameter_inventory["namedParameters"]
    gradients = torch.autograd.grad(
        loss,
        tuple(parameter for _, parameter in named_parameters)
        + (noisy_latent, conditions),
        allow_unused=True,
        materialize_grads=False,
    )
    parameter_gradients = gradients[: len(named_parameters)]
    noisy_gradient = gradients[-2]
    condition_gradient = gradients[-1]
    occupancy = responsibility_occupancy(conditions)
    parameter_summary = summarize_parameter_gradients(
        named_parameters,
        parameter_gradients,
        occupancy=occupancy,
        require_all=require_all_parameters,
    )
    noisy_summary = summarize_tensor_gradient(
        noisy_gradient,
        expected_shape=LATENT_SHAPE,
        label="noisy_latent",
        require_each_channel=True,
    )
    condition_summary = summarize_tensor_gradient(
        condition_gradient,
        expected_shape=CONDITION_SHAPE,
        label="conditions",
        require_each_channel=True,
    )
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("stage4_v2_readonly_gpu_parameter_grad_field_populated")
    forward_evidence = validate_forward_evidence(
        model,
        noisy_latent.detach(),
        timestep,
        conditions.detach(),
        latent_normalization,
    )
    return {
        "role": role,
        "sampleId": sample["sampleId"],
        "split": "train" if role == "first_formal_train_record" else "validation",
        "timestep": DIFFUSION_TIMESTEP,
        "formalObjective": "formal_v6_composite_exact_reuse_v1",
        "compositeLoss": float(loss.detach().cpu()),
        "responsibilityOccupancy": occupancy,
        "parameterGradients": parameter_summary,
        "noisyLatentGradient": noisy_summary,
        "conditionGradient": condition_summary,
        "typedResize": typed_resize,
        "forwardEvidence": forward_evidence,
        "allParameterGradFieldsRemainNone": True,
    }


def validate_state_integrity(
    *,
    autoencoder_hashes: Mapping[str, str],
    denoiser_hashes: Mapping[str, str],
    model: torch.nn.Module,
) -> dict[str, Any]:
    if len(set(autoencoder_hashes.values())) != 1:
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_state_changed")
    if len(set(denoiser_hashes.values())) != 1:
        raise ValueError("stage4_v2_readonly_gpu_denoiser_state_changed")
    if model.autoencoder.training:
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_training_mode_changed")
    if any(parameter.requires_grad for parameter in model.autoencoder.parameters()):
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_requires_grad_changed")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("stage4_v2_readonly_gpu_parameter_grad_field_populated")
    return {
        "schemaVersion": "ai-painter-stage4-v2-readonly-gpu-state-integrity-v1",
        "status": "verified_unchanged",
        "stateIdentityAlgorithm": "sha256_sorted_tensor_bytes_v1",
        "autoencoder": dict(autoencoder_hashes),
        "denoiser": dict(denoiser_hashes),
        "autoencoderUnchanged": True,
        "denoiserUnchanged": True,
        "autoencoderTraining": False,
        "autoencoderRequiresGradParameterCount": 0,
        "allParameterGradFieldsRemainNone": True,
    }


def require_formal_cuda() -> torch.device:
    if not torch.cuda.is_available():
        raise RuntimeError("stage4_v2_readonly_gpu_cuda_required")
    torch.cuda.init()
    torch.cuda.set_device(0)
    return torch.device("cuda:0")


def _cuda_phase_snapshot(label: str, started: float) -> dict[str, Any]:
    torch.cuda.synchronize(0)
    free_bytes, total_bytes = torch.cuda.mem_get_info(0)
    return {
        "phase": label,
        "recordedAtUtc": utc_now(),
        "durationSeconds": round(time.perf_counter() - started, 6),
        "allocatedBytes": int(torch.cuda.memory_allocated(0)),
        "reservedBytes": int(torch.cuda.memory_reserved(0)),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "driverFreeBytes": int(free_bytes),
        "driverTotalBytes": int(total_bytes),
    }


def validate_readonly_gpu_inputs(
    active_config_path_value: Path,
    active_config_sha256: str,
    output_dir_value: Path,
    *,
    project_root: Path = PROJECT_ROOT,
) -> dict[str, Any]:
    if Path.cwd().resolve() != project_root.resolve():
        raise ValueError("stage4_v2_readonly_gpu_project_root_mismatch")
    config_path = resolve_project_path(
        active_config_path_value,
        project_root=project_root,
        must_exist=True,
        expect_file=True,
    )
    output_dir = resolve_project_path(
        output_dir_value,
        project_root=project_root,
        must_exist=False,
    )
    active = _read_json(config_path, "active_config")
    audit = validate_active_config_value(
        active,
        config_path=config_path,
        config_sha256=active_config_sha256,
        output_dir=output_dir,
        project_root=project_root,
    )
    governance = _validate_governance_chain(audit, project_root=project_root)
    model_config = build_qualification_model_config(project_root=project_root)
    formal_inputs = resolve_formal_inputs(
        model_config,
        governance,
        project_root=project_root,
    )
    return {
        "activeConfig": active,
        "activeAudit": audit,
        "governance": governance,
        "modelConfig": model_config,
        "formalInputs": formal_inputs,
        "outputDir": output_dir,
    }


def run_readonly_gpu_qualification(inputs: Mapping[str, Any]) -> dict[str, Any]:
    """Execute one real CUDA graph qualification and write immutable evidence."""

    output_dir = Path(inputs["outputDir"])
    if output_dir.exists():
        raise ValueError("stage4_v2_readonly_gpu_output_reuse_forbidden")
    device = require_formal_cuda()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(exist_ok=False)

    active_audit = inputs["activeAudit"]
    model_config = inputs["modelConfig"]
    formal_inputs = inputs["formalInputs"]
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    torch.cuda.synchronize(0)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    execution_started = time.perf_counter()
    free_before, total_before = torch.cuda.mem_get_info(0)

    model = build_complete_world_system(model_config)
    inventory = validate_parameter_inventory(model)
    checkpoint_path = active_audit["autoencoderCheckpoint"]
    if file_sha256(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("stage4_v2_readonly_gpu_autoencoder_file_changed")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, model_config)
    checkpoint_state_hash = state_dict_sha256(checkpoint["autoencoderState"])
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    del checkpoint
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.train()
    loaded_boundary = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model,
        phase="loaded",
    )
    if loaded_boundary["stateSha256"] != checkpoint_state_hash:
        raise ValueError("stage4_v2_readonly_gpu_loaded_autoencoder_state_mismatch")
    denoiser_initialized_hash = state_dict_sha256(model.denoiser.state_dict())
    model.to(device)
    before_boundary = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model,
        phase="before_training",
        expected_state_sha256=loaded_boundary["stateSha256"],
    )
    denoiser_before_hash = state_dict_sha256(model.denoiser.state_dict())
    if denoiser_initialized_hash != denoiser_before_hash:
        raise ValueError("stage4_v2_readonly_gpu_denoiser_transfer_changed_state")

    telemetry_rows = []
    torch.cuda.reset_peak_memory_stats(0)
    phase_started = time.perf_counter()
    telemetry_rows.append(_cuda_phase_snapshot("model_loaded", phase_started))

    torch.cuda.reset_peak_memory_stats(0)
    phase_started = time.perf_counter()
    latent_normalization = trainer.compute_latent_normalization(
        model,
        formal_inputs["datasets"]["train"],
        device,
    )
    if (
        latent_normalization.get("version") != "per_channel_train_split_v1"
        or latent_normalization.get("sampleCount") != 48
        or tuple(latent_normalization["mean"].shape) != (1, 12, 1, 1)
        or tuple(latent_normalization["standardDeviation"].shape)
        != (1, 12, 1, 1)
        or not bool(torch.isfinite(latent_normalization["mean"]).all())
        or not bool(
            torch.isfinite(latent_normalization["standardDeviation"]).all()
        )
        or not bool((latent_normalization["standardDeviation"] > 0).all())
    ):
        raise ValueError("stage4_v2_readonly_gpu_latent_normalization_invalid")
    telemetry_rows.append(
        _cuda_phase_snapshot("formal_train_latent_normalization", phase_started)
    )

    sample_results = []
    for role, sample, require_all in (
        (
            "first_formal_train_record",
            formal_inputs["trainSample"],
            False,
        ),
        (
            "fixed_validation_sample_194",
            formal_inputs["validationSample"],
            True,
        ),
    ):
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats(0)
        phase_started = time.perf_counter()
        sample_results.append(
            _sample_gradient_evidence(
                model,
                sample,
                role=role,
                device=device,
                model_config=model_config,
                latent_normalization=latent_normalization,
                parameter_inventory=inventory,
                require_all_parameters=require_all,
            )
        )
        telemetry_rows.append(_cuda_phase_snapshot(role, phase_started))

    all_parameter_names = {
        name for name, _ in inventory["namedParameters"]
    }
    aggregate_nonzero = set().union(
        *(
            set(sample["parameterGradients"]["nonzeroParameterNames"])
            for sample in sample_results
        )
    )
    if aggregate_nonzero != all_parameter_names:
        missing = sorted(all_parameter_names - aggregate_nonzero)
        raise ValueError(
            "stage4_v2_readonly_gpu_aggregate_parameter_reachability_incomplete:"
            + ",".join(missing)
        )
    if sample_results[1]["parameterGradients"]["nonzeroParameterTensorCount"] != 210:
        raise ValueError("stage4_v2_readonly_gpu_sample194_not_full_graph")

    model.to("cpu")
    after_boundary = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model,
        phase="after_training",
        expected_state_sha256=loaded_boundary["stateSha256"],
    )
    denoiser_after_hash = state_dict_sha256(model.denoiser.state_dict())
    state_integrity = validate_state_integrity(
        autoencoder_hashes={
            "checkpointState": checkpoint_state_hash,
            "loaded": loaded_boundary["stateSha256"],
            "beforeQualification": before_boundary["stateSha256"],
            "afterQualification": after_boundary["stateSha256"],
        },
        denoiser_hashes={
            "fixedInitialization": denoiser_initialized_hash,
            "beforeQualification": denoiser_before_hash,
            "afterQualification": denoiser_after_hash,
        },
        model=model,
    )
    torch.cuda.synchronize(0)
    free_after, total_after = torch.cuda.mem_get_info(0)
    cuda_telemetry = {
        "schemaVersion": "ai-painter-stage4-v2-readonly-gpu-cuda-telemetry-v1",
        "status": "measured",
        "deviceIndex": 0,
        "deviceName": torch.cuda.get_device_name(0),
        "deviceCapability": list(torch.cuda.get_device_capability(0)),
        "torchVersion": torch.__version__,
        "cudaRuntimeVersion": torch.version.cuda,
        "pythonVersion": sys.version.split()[0],
        "measuredResolution": {"width": 256, "height": 192},
        "driverFreeBytesBefore": int(free_before),
        "driverTotalBytesBefore": int(total_before),
        "driverFreeBytesAfter": int(free_after),
        "driverTotalBytesAfter": int(total_after),
        "phases": telemetry_rows,
        "peakGpuMemoryBytes": max(
            row["peakAllocatedBytes"] for row in telemetry_rows
        ),
        "peakReservedBytes": max(
            row["peakReservedBytes"] for row in telemetry_rows
        ),
        "durationSeconds": round(time.perf_counter() - execution_started, 6),
        "preflightMemoryUsedAsDiagnosticPeak": False,
        "native1024x768PeakClaimed": False,
    }
    diagnostic = {
        "schemaVersion": "ai-painter-stage4-v2-readonly-gpu-diagnostic-v1",
        "status": "passed",
        "packageId": active_audit["packageId"],
        "runId": active_audit["runId"],
        "architectureId": ARCHITECTURE_ID,
        "datasetReleaseIdentity": DATASET_RELEASE_IDENTITY,
        "seed": SEED,
        "resolution": {"width": 256, "height": 192},
        "latentShape": list(LATENT_SHAPE),
        "conditionShape": list(CONDITION_SHAPE),
        "diffusionTimestep": DIFFUSION_TIMESTEP,
        "formalObjective": "formal_v6_composite_exact_reuse_v1",
        "latentNormalization": trainer.serialize_latent_normalization(
            latent_normalization
        ),
        "parameterInventory": {
            key: value
            for key, value in inventory.items()
            if key != "namedParameters"
        },
        "samples": sample_results,
        "all210ParametersReached": True,
        "sample194All210ParametersReached": True,
        "sourceBindings": {
            key: formal_inputs[key]
            for key in (
                "datasetRelease",
                "sourceManifest",
                "sourceIndex",
                "trainAssets",
                "validationAssets",
            )
        },
        "safety": {
            "autoencoderCheckpointRead": True,
            "autoencoderFrozen": True,
            "denoiserCheckpointRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightsModified": False,
            "checkpointWritten": False,
            "smokeStarted": False,
            "trainingStarted": False,
        },
        "recordedAtUtc": utc_now(),
    }
    diagnostic_path = output_dir / "gpu-diagnostic.json"
    telemetry_path = output_dir / "cuda-telemetry.json"
    state_path = output_dir / "state-integrity.json"
    _write_json_exclusive(diagnostic_path, diagnostic)
    _write_json_exclusive(telemetry_path, cuda_telemetry)
    _write_json_exclusive(state_path, state_integrity)
    result = {
        "schemaVersion": QUALIFICATION_SCHEMA,
        "status": "stage4_v2_readonly_gpu_qualification_passed",
        "executionState": "completed",
        "packageId": active_audit["packageId"],
        "runId": active_audit["runId"],
        "architectureId": ARCHITECTURE_ID,
        "activeConfig": active_audit["config"],
        "ticket": active_audit["ticket"],
        "gpuDiagnostic": binding(diagnostic_path),
        "cudaTelemetry": binding(telemetry_path),
        "stateIntegrity": binding(state_path),
        "ownerAuthorizationRequired": False,
        "automaticSmokeStarted": False,
        "recordedAtUtc": utc_now(),
    }
    result_path = output_dir / "qualification-result.json"
    _write_json_exclusive(result_path, result)
    return {**result, "qualificationResult": binding(result_path)}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--active-config", type=Path, required=True)
    parser.add_argument("--active-config-sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        inputs = validate_readonly_gpu_inputs(
            args.active_config,
            args.active_config_sha256,
            args.output_dir,
        )
        result = run_readonly_gpu_qualification(inputs)
    except Exception as error:  # The Node lifecycle owns immutable failure finalization.
        print(
            json.dumps(
                {
                    "schemaVersion": QUALIFICATION_SCHEMA,
                    "status": "stage4_v2_readonly_gpu_qualification_failed_closed",
                    "errorType": type(error).__name__,
                    "error": str(error),
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
            flush=True,
        )
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

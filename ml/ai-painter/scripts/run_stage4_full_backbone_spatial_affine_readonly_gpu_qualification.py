from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from typing import Any, Mapping

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SOURCE_ROOT = PROJECT_ROOT / "ml" / "ai-painter" / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import (
    AiAssistedConditionalDenoiserDataset,
    is_ai_assisted_conditional_row,
)
from ai_painter_preview_reproduction import state_dict_sha256
from ai_painter_full_backbone_spatial_affine_contract import (
    ARCHITECTURE_ID,
    CAPABILITY_VERSION,
    READONLY_GPU_OUTPUT_ROOT,
    derive_formal_condition_identity,
    validate_full_backbone_spatial_affine_readonly_gpu_config,
)
from ai_painter_authorization_policy import resolve_stage_execution_grant
from ai_painter_spatial_affine_decoder_contract import (
    load_spatial_affine_formal_objective_contract,
)
import train_ai_assisted_conditional_denoiser as trainer


SEED = 20263722
IMAGE_SIZE = (256, 192)
LATENT_SHAPE = (1, 12, 48, 64)
CONDITION_SHAPE = (1, 23, 192, 256)
SELECTION_CONTRACT = "registered_v7_capacity_contribution_v1"
VALIDATION_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
)
FIRST_TRAIN_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
)
AUTOENCODER_SHA256 = (
    "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
)
EXPECTED_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
OUTPUT_NAMESPACE = Path(READONLY_GPU_OUTPUT_ROOT)
ATTEMPT_NAMESPACE = Path(
    ".runtime/ai-painter/"
    "stage4-full-backbone-spatial-affine-readonly-gpu-attempts"
)
BLOCK_CHANNELS = (
    ("block0", 64),
    ("block1", 128),
    ("middle1", 256),
    ("middle2", 256),
    ("up_block1", 128),
    ("up_block0", 64),
)


def _expected_affine_parameter_shapes() -> dict[str, tuple[int, ...]]:
    expected: dict[str, tuple[int, ...]] = {}
    for block_name, channels in BLOCK_CHANNELS:
        for norm_name in ("norm1", "norm2"):
            prefix = f"{block_name}.spatial_affine_{norm_name}"
            expected[f"{prefix}.weight"] = (channels * 2, 23, 3, 3)
            expected[f"{prefix}.bias"] = (channels * 2,)
    return expected


EXPECTED_AFFINE_PARAMETER_SHAPES = _expected_affine_parameter_shapes()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_project_relative(
    value: Path,
    *,
    must_exist: bool,
    expect_file: bool = False,
) -> Path:
    if (
        value.is_absolute()
        or not value.parts
        or any(part in {"", ".", ".."} for part in value.parts)
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_project_relative_path_required"
        )
    root = PROJECT_ROOT.resolve()
    resolved = PROJECT_ROOT.joinpath(value).resolve()
    if value.parts[0].casefold() == ".runtime":
        runtime_root = (PROJECT_ROOT / ".runtime").resolve()
        if resolved != runtime_root and runtime_root not in resolved.parents:
            raise ValueError(
                "full_backbone_spatial_affine_readonly_gpu_runtime_path_escape"
            )
    elif resolved != root and root not in resolved.parents:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_project_path_escape"
        )
    if must_exist and not resolved.exists():
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_bound_path_missing"
        )
    if expect_file and not resolved.is_file():
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_bound_file_missing"
        )
    return resolved


def _project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime_root = (PROJECT_ROOT / ".runtime").resolve()
    if resolved == runtime_root or runtime_root in resolved.parents:
        return (
            Path(".runtime") / resolved.relative_to(runtime_root)
        ).as_posix()
    return resolved.relative_to(PROJECT_ROOT.resolve()).as_posix()


def _binding(path: Path) -> dict[str, str]:
    return {"path": _project_path(path), "sha256": sha256_file(path)}


def _write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def _verify_binding(value: Any, *, label: str) -> tuple[Path, dict[str, str]]:
    if not isinstance(value, Mapping):
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_{label}_binding_missing"
        )
    path = _resolve_project_relative(
        Path(str(value.get("path", ""))),
        must_exist=True,
        expect_file=True,
    )
    observed = _binding(path)
    if observed != dict(value):
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_{label}_binding_changed"
        )
    return path, observed


def validate_and_consume_execution_claim(
    *,
    claim_path_value: Path,
    claim_sha256: str,
    active_config: Mapping[str, Any],
    config_path: Path,
    config_sha256: str,
    output_dir: Path,
) -> dict[str, Any]:
    claim_path = _resolve_project_relative(
        claim_path_value,
        must_exist=True,
        expect_file=True,
    )
    claim_binding = _binding(claim_path)
    if claim_binding["sha256"] != claim_sha256:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_execution_claim_sha256_mismatch"
        )
    claim = json.loads(claim_path.read_text(encoding="utf-8"))
    execution = active_config["executionIdentity"]
    run_id = execution["runId"]
    expected_claim_path = (
        PROJECT_ROOT / ATTEMPT_NAMESPACE / run_id / "execution-started.json"
    ).resolve()
    expected_consumption_path = (
        expected_claim_path.parent / "execution-claim-consumption.json"
    ).resolve()
    ticket = active_config["training"]["localAiCapabilityTicket"]
    expected_ticket = {
        "path": ticket["ticketPath"],
        "sha256": ticket["ticketSha256"],
    }
    expected_consumption = {
        "path": ticket["consumptionPath"],
        "sha256": ticket["consumptionSha256"],
    }
    claim_bindings = claim.get("bindings")
    frozen_inputs = claim.get("frozenInputs")
    declared_runner = claim.get("gpuRunner")
    if (
        claim_path.resolve() != expected_claim_path
        or claim.get("schemaVersion")
        != (
            "stage4-full-backbone-spatial-affine-readonly-gpu-"
            "execution-started-v1"
        )
        or claim.get("status") != "runner_claimed_not_replayable"
        or claim.get("runId") != run_id
        or claim.get("outputNamespace") != execution["outputNamespace"]
        or claim.get("outputNamespace") != _project_path(output_dir)
        or claim.get("ticketId") != ticket["ticketId"]
        or not isinstance(declared_runner, Mapping)
        or declared_runner.get("path") != _project_path(Path(__file__).resolve())
        or not isinstance(declared_runner.get("sha256"), str)
        or re.fullmatch(r"[0-9a-f]{64}", declared_runner["sha256"]) is None
        or claim.get("claimConsumptionPath")
        != _project_path(expected_consumption_path)
        or claim.get("ownerAuthorizationRequired") is not False
        or claim.get("automaticRetryAllowed") is not False
        or not isinstance(claim_bindings, Mapping)
        or claim_bindings.get("activeConfig")
        != {"path": _project_path(config_path), "sha256": config_sha256}
        or claim_bindings.get("ticket") != expected_ticket
        or claim_bindings.get("consumption") != expected_consumption
        or not isinstance(frozen_inputs, Mapping)
        or frozen_inputs.get("gpuRunnerProgram")
        != declared_runner
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_execution_claim_invalid"
        )
    consumption = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-"
            "execution-claim-consumption-v1"
        ),
        "status": "consumed_once",
        "runId": run_id,
        "outputNamespace": execution["outputNamespace"],
        "executionClaim": claim_binding,
        "activeConfig": {"path": _project_path(config_path), "sha256": config_sha256},
        "internalCapabilityTicket": {
            key: ticket[key]
            for key in (
                "ticketId",
                "ticketPath",
                "ticketSha256",
                "consumptionPath",
                "consumptionSha256",
            )
        },
        "consumerProgram": dict(declared_runner),
        "processId": os.getpid(),
        "consumedAtUtc": utc_now(),
    }
    _write_json_exclusive(expected_consumption_path, consumption)
    # The once-only claim is now consumed. All fallible re-hashing happens
    # afterwards so a transient/mutated input can only fail closed, never make
    # the same execution-started claim replayable.
    for label, frozen_binding in frozen_inputs.items():
        _verify_binding(frozen_binding, label=f"frozen_{label}")
    _verify_binding(expected_ticket, label="ticket")
    _verify_binding(expected_consumption, label="ticket_consumption")
    return {
        "claim": claim,
        "claimPath": claim_path,
        "claimBinding": claim_binding,
        "claimConsumptionPath": expected_consumption_path,
        "claimConsumptionBinding": _binding(expected_consumption_path),
    }


def _finite_nonzero(value: torch.Tensor | None) -> bool:
    return (
        value is not None
        and bool(torch.isfinite(value).all())
        and bool(torch.any(value != 0))
    )


def build_qualification_model_config(active_config: Mapping[str, Any]) -> dict:
    validate_full_backbone_spatial_affine_readonly_gpu_config(
        dict(active_config),
        project_root=PROJECT_ROOT,
        require_execution_ticket=True,
    )
    formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
    model = formal["modelBoundary"]
    condition_identity = derive_formal_condition_identity()
    return {
        "ownership": model["ownership"],
        "trainingLane": model["trainingLane"],
        "autoencoderSourceModelId": model["autoencoderSourceModelId"],
        "autoencoderSourceArchitectureVersion": model[
            "autoencoderSourceArchitectureVersion"
        ],
        "autoencoderRequiredCheckpointProvenance": model[
            "autoencoderRequiredCheckpointProvenance"
        ],
        "baseChannels": int(model["autoencoderBaseChannels"]),
        "denoiserBaseChannels": 64,
        "latentChannels": 12,
        "conditionChannels": 23,
        "autoencoderArchitecture": "residual_4x_latent_pixel_detail_v2",
        "latentDownsampleFactor": 4,
        "denoiserArchitecture": ARCHITECTURE_ID,
        "conditionChannelOrder": list(
            condition_identity["conditionChannelOrder"]
        ),
        "conditionChannelTypes": dict(
            condition_identity["conditionChannelTypes"]
        ),
        "conditionResizeContract": condition_identity[
            "conditionResizeContract"
        ],
        "diffusionSteps": 1000,
    }


def validate_affine_parameter_identity(
    denoiser: torch.nn.Module,
) -> dict[str, Any]:
    parameters = {
        name: parameter
        for name, parameter in denoiser.named_parameters()
        if ".spatial_affine_" in name
    }
    shapes = {
        name: tuple(parameter.shape) for name, parameter in parameters.items()
    }
    if shapes != EXPECTED_AFFINE_PARAMETER_SHAPES:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_parameter_identity_invalid"
        )
    if len(parameters) != 24 or len({id(value) for value in parameters.values()}) != 24:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_parameter_sharing_invalid"
        )
    parameter_count = sum(value.numel() for value in parameters.values())
    if parameter_count != 745472:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_parameter_count_invalid"
        )
    return {
        "parameters": parameters,
        "parameterTensorCount": len(parameters),
        "parameterObjectIdentityCount": len(
            {id(value) for value in parameters.values()}
        ),
        "parameterCount": parameter_count,
        "parameterShapes": {
            name: list(shape) for name, shape in shapes.items()
        },
    }


def summarize_condition_gradient(gradient: torch.Tensor | None) -> dict[str, Any]:
    if gradient is None or tuple(gradient.shape) != CONDITION_SHAPE:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_condition_gradient_shape_invalid"
        )
    per_channel_maximum = gradient.detach().abs().flatten(2).amax(dim=2)[0]
    if (
        not _finite_nonzero(gradient)
        or not bool(torch.isfinite(per_channel_maximum).all())
        or not bool((per_channel_maximum > 0).all())
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_condition_gradient_invalid"
        )
    return {
        "shape": list(gradient.shape),
        "finite": True,
        "nonzero": True,
        "all23ChannelsFiniteNonzero": True,
        "perChannelMaximumAbsoluteGradient": [
            float(value) for value in per_channel_maximum.cpu()
        ],
    }


def summarize_affine_parameter_gradient(
    name: str,
    gradient: torch.Tensor | None,
) -> dict[str, Any]:
    expected_shape = EXPECTED_AFFINE_PARAMETER_SHAPES.get(name)
    if expected_shape is None:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_unknown_parameter"
        )
    if gradient is None or tuple(gradient.shape) != expected_shape:
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_gradient_shape_invalid:{name}"
        )
    if not _finite_nonzero(gradient):
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_gradient_invalid:{name}"
        )
    if gradient.shape[0] % 2 != 0:
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_gradient_affine_split_invalid:{name}"
        )
    gamma_gradient, beta_gradient = gradient.chunk(2, dim=0)
    if not _finite_nonzero(gamma_gradient):
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_gamma_gradient_invalid:{name}"
        )
    if not _finite_nonzero(beta_gradient):
        raise ValueError(
            f"full_backbone_spatial_affine_readonly_gpu_beta_gradient_invalid:{name}"
        )
    return {
        "parameterName": name,
        "shape": list(gradient.shape),
        "finite": True,
        "nonzero": True,
        "maximumAbsoluteGradient": float(gradient.detach().abs().max().cpu()),
        "gammaFiniteNonzero": True,
        "gammaMaximumAbsoluteGradient": float(
            gamma_gradient.detach().abs().max().cpu()
        ),
        "betaFiniteNonzero": True,
        "betaMaximumAbsoluteGradient": float(
            beta_gradient.detach().abs().max().cpu()
        ),
    }


def resolve_formal_sample_identities(
    model_config: Mapping[str, Any],
    dataset_manifest_path: Path,
    source_index_path: Path,
) -> dict[str, Any]:
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            dataset_manifest_path,
            split,
            list(model_config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=SELECTION_CONTRACT,
        )
        for split in EXPECTED_SPLIT_COUNTS
    }
    counts = {split: len(dataset) for split, dataset in datasets.items()}
    if counts != EXPECTED_SPLIT_COUNTS:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_split_identity_changed"
        )
    source_index = json.loads(source_index_path.read_text(encoding="utf-8"))
    source_rows = source_index.get("samples")
    if (
        source_index.get("schemaVersion")
        != "ai-assisted-cold-start-dataset-source-index-v1"
        or not isinstance(source_rows, list)
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_source_index_invalid"
        )
    for split, dataset in datasets.items():
        formal_ids = [
            row["sampleId"]
            for row in source_rows
            if is_ai_assisted_conditional_row(
                row,
                split,
                selection_contract=SELECTION_CONTRACT,
            )
        ]
        dataset_ids = [row["sampleId"] for row in dataset.rows]
        if dataset_ids != formal_ids:
            raise ValueError(
                "full_backbone_spatial_affine_readonly_gpu_source_order_changed:"
                f"{split}"
            )
    first_train_id = datasets["train"].rows[0].get("sampleId")
    if first_train_id != FIRST_TRAIN_SAMPLE_ID:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_first_train_identity_changed"
        )
    occurrences = [
        (split, index)
        for split, dataset in datasets.items()
        for index, row in enumerate(dataset.rows)
        if row.get("sampleId") == VALIDATION_SAMPLE_ID
    ]
    if len(occurrences) != 1 or occurrences[0][0] != "validation":
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_validation_sample_194_invalid"
        )
    validation_index = occurrences[0][1]
    return {
        "selectionContract": SELECTION_CONTRACT,
        "splitCounts": counts,
        "firstTrainSampleId": first_train_id,
        "validationSampleId": VALIDATION_SAMPLE_ID,
        "trainSample": datasets["train"][0],
        "validationSample": datasets["validation"][validation_index],
    }


def validate_readonly_gpu_inputs(
    config_path_value: Path,
    config_sha256: str,
    execution_claim_path_value: Path,
    execution_claim_sha256: str,
    output_dir_value: Path,
) -> dict[str, Any]:
    if Path.cwd().resolve() != PROJECT_ROOT.resolve():
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_project_root_mismatch"
        )
    config_path = _resolve_project_relative(
        config_path_value,
        must_exist=True,
        expect_file=True,
    )
    if sha256_file(config_path) != config_sha256:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_config_sha256_mismatch"
        )
    active_config = json.loads(config_path.read_text(encoding="utf-8"))
    execution_identity = active_config.get("executionIdentity")
    training_identity = active_config.get("training")
    if (
        not isinstance(execution_identity, Mapping)
        or not isinstance(training_identity, Mapping)
        or not isinstance(
            training_identity.get("localAiCapabilityTicket"), Mapping
        )
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_minimum_execution_identity_invalid"
        )
    output_dir = _resolve_project_relative(
        output_dir_value,
        must_exist=False,
    )
    output_root = (PROJECT_ROOT / OUTPUT_NAMESPACE).resolve()
    if (
        output_dir.parent != output_root
        or output_dir == output_root
        or output_dir.name != execution_identity.get("runId")
        or _project_path(output_dir) != execution_identity.get("outputNamespace")
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_output_namespace_invalid"
        )
    if output_dir.exists():
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_output_reuse_forbidden"
        )
    # Consume the outer launch claim before any fallible formal-data/model audit.
    # From this point the consumed internal ticket cannot be replayed, even when
    # a later read-only validation or CUDA availability check fails.
    execution_claim = validate_and_consume_execution_claim(
        claim_path_value=execution_claim_path_value,
        claim_sha256=execution_claim_sha256,
        active_config=active_config,
        config_path=config_path,
        config_sha256=config_sha256,
        output_dir=output_dir,
    )
    active_audit = validate_full_backbone_spatial_affine_readonly_gpu_config(
        active_config,
        project_root=PROJECT_ROOT,
        require_execution_ticket=True,
    )
    if active_config.get("capabilityVersion") != CAPABILITY_VERSION:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_capability_identity_invalid"
        )
    grant = resolve_stage_execution_grant(
        active_config,
        project_root=PROJECT_ROOT,
    )
    for action in (
        "inspect_autoencoder_identity",
        "inspect_checkpoint_identity",
        "load_autoencoder",
    ):
        grant.require(action)
    model_config = build_qualification_model_config(active_config)
    formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
    dataset_manifest = _resolve_project_relative(
        Path(formal["data"]["datasetManifestPath"]),
        must_exist=True,
        expect_file=True,
    )
    source_index = _resolve_project_relative(
        Path(formal["data"]["sourceIndexPath"]),
        must_exist=True,
        expect_file=True,
    )
    autoencoder_checkpoint = _resolve_project_relative(
        Path(formal["modelBoundary"]["autoencoderCheckpointPath"]),
        must_exist=True,
        expect_file=True,
    )
    if (
        sha256_file(dataset_manifest) != formal["data"]["datasetManifestSha256"]
        or sha256_file(source_index) != formal["data"]["sourceIndexSha256"]
        or sha256_file(autoencoder_checkpoint) != AUTOENCODER_SHA256
        or formal["modelBoundary"]["autoencoderCheckpointSha256"]
        != AUTOENCODER_SHA256
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_formal_source_changed"
        )
    if (
        output_dir.parent != output_root
        or output_dir == output_root
        or output_dir.name != active_audit["runId"]
        or _project_path(output_dir) != active_audit["outputNamespace"]
        or execution_identity["outputNamespace"] != active_audit["outputNamespace"]
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_output_namespace_invalid"
        )
    if output_dir.exists():
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_output_reuse_forbidden"
        )
    sample_identity = resolve_formal_sample_identities(
        model_config,
        dataset_manifest,
        source_index,
    )
    return {
        "activeConfig": active_config,
        "activeConfigAudit": active_audit,
        "modelConfig": model_config,
        "configPath": config_path,
        "configSha256": config_sha256,
        "datasetManifest": dataset_manifest,
        "sourceIndex": source_index,
        "autoencoderCheckpoint": autoencoder_checkpoint,
        "outputDir": output_dir,
        "sampleIdentity": sample_identity,
        "grant": grant,
        "executionClaim": execution_claim,
    }


def _sample_gradient_evidence(
    model: torch.nn.Module,
    sample: Mapping[str, Any],
    *,
    role: str,
    device: torch.device,
) -> dict[str, Any]:
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
    if tuple(conditions.shape) != CONDITION_SHAPE:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_condition_shape_invalid"
        )
    with torch.no_grad():
        clean_latent = model.autoencoder.encode(image)
    if tuple(clean_latent.shape) != LATENT_SHAPE:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_clean_latent_shape_invalid"
        )
    timestep = torch.tensor([500], dtype=torch.long, device=device)
    generator = torch.Generator(device=device).manual_seed(SEED)
    noise = torch.randn(clean_latent.shape, device=device, generator=generator)
    beta_schedule = torch.linspace(0.0001, 0.02, 1000, device=device)
    alpha_bar = torch.cumprod(1.0 - beta_schedule, dim=0)[timestep].view(
        1, 1, 1, 1
    )
    noisy_latent = (
        alpha_bar.sqrt() * clean_latent
        + (1.0 - alpha_bar).sqrt() * noise
    )
    predicted_velocity = model.predict_velocity(
        noisy_latent,
        timestep,
        conditions,
    )
    if tuple(predicted_velocity.shape) != LATENT_SHAPE:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_output_shape_invalid"
        )
    parameter_identity = validate_affine_parameter_identity(model.denoiser)
    parameters = parameter_identity["parameters"]
    objective = predicted_velocity.square().mean()
    gradients = torch.autograd.grad(
        objective,
        (conditions, *tuple(parameters.values())),
        allow_unused=False,
    )
    condition_gradient = summarize_condition_gradient(gradients[0])
    parameter_gradients = [
        summarize_affine_parameter_gradient(name, gradient)
        for name, gradient in zip(parameters, gradients[1:], strict=True)
    ]
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_parameter_grad_field_populated"
        )
    return {
        "role": role,
        "sampleId": sample["sampleId"],
        "selectionContract": SELECTION_CONTRACT,
        "inputConditionShape": list(conditions.shape),
        "outputShape": list(predicted_velocity.shape),
        "timestep": 500,
        "objective": float(objective.detach().cpu()),
        "conditionGradient": condition_gradient,
        "affineParameterTensorCount": parameter_identity[
            "parameterTensorCount"
        ],
        "affineParameterCount": parameter_identity["parameterCount"],
        "affineParameterObjectIdentityCount": parameter_identity[
            "parameterObjectIdentityCount"
        ],
        "affineParameterGradients": parameter_gradients,
        "allParameterGradFieldsRemainNone": True,
    }


def run_readonly_gpu_qualification(inputs: Mapping[str, Any]) -> dict[str, Any]:
    active_config = inputs["activeConfig"]
    active_audit = validate_full_backbone_spatial_affine_readonly_gpu_config(
        active_config,
        project_root=PROJECT_ROOT,
        require_execution_ticket=True,
    )
    grant = resolve_stage_execution_grant(
        active_config,
        project_root=PROJECT_ROOT,
    )
    for action in (
        "inspect_autoencoder_identity",
        "inspect_checkpoint_identity",
        "load_autoencoder",
    ):
        grant.require(action)
    output_dir = Path(inputs["outputDir"])
    execution_claim = inputs.get("executionClaim")
    if not isinstance(execution_claim, Mapping):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_execution_claim_not_consumed"
        )
    claim_consumption_path, claim_consumption_binding = _verify_binding(
        execution_claim.get("claimConsumptionBinding"),
        label="execution_claim_consumption",
    )
    claim_consumption = json.loads(
        claim_consumption_path.read_text(encoding="utf-8")
    )
    if (
        claim_consumption.get("status") != "consumed_once"
        or claim_consumption.get("runId") != active_audit["runId"]
        or claim_consumption.get("executionClaim")
        != execution_claim.get("claimBinding")
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_execution_claim_consumption_invalid"
        )
    if (
        output_dir.name != active_audit["runId"]
        or _project_path(output_dir) != active_audit["outputNamespace"]
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_execution_binding_changed"
        )
    if not torch.cuda.is_available():
        raise RuntimeError(
            "full_backbone_spatial_affine_readonly_gpu_cuda_unavailable"
        )
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(exist_ok=False)
    started = time.perf_counter()
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    device = torch.device("cuda:0")
    model_config = inputs["modelConfig"]
    model = build_complete_world_system(model_config)
    if sha256_file(inputs["autoencoderCheckpoint"]) != AUTOENCODER_SHA256:
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_autoencoder_identity_changed"
        )
    checkpoint = trainer.load_autoencoder_checkpoint(
        inputs["autoencoderCheckpoint"],
        model_config,
    )
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    validate_affine_parameter_identity(model.denoiser)
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
    model.to(device).eval()

    sample_identity = inputs["sampleIdentity"]
    gradient_evidence = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-gradient-evidence-v1"
        ),
        "status": "passed",
        "samples": [
            _sample_gradient_evidence(
                model,
                sample_identity["trainSample"],
                role="first_formal_train_record",
                device=device,
            ),
            _sample_gradient_evidence(
                model,
                sample_identity["validationSample"],
                role="fixed_validation_sample_194",
                device=device,
            ),
        ],
    }
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_parameter_grad_field_populated"
        )
    torch.cuda.synchronize(0)
    cuda_telemetry = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-cuda-telemetry-v1"
        ),
        "status": "completed",
        "deviceName": torch.cuda.get_device_name(0),
        "deviceCapability": list(torch.cuda.get_device_capability(0)),
        "torchVersion": torch.__version__,
        "cudaRuntimeVersion": torch.version.cuda,
        "peakGpuMemoryBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    model.to("cpu")
    denoiser_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
    state_hashes = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-state-hashes-v1"
        ),
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": denoiser_before == denoiser_after,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": autoencoder_before == autoencoder_after,
        "allParameterGradFieldsRemainNone": all(
            parameter.grad is None for parameter in model.parameters()
        ),
    }
    if not all(
        state_hashes[key]
        for key in (
            "denoiserUnchanged",
            "autoencoderUnchanged",
            "allParameterGradFieldsRemainNone",
        )
    ):
        raise ValueError(
            "full_backbone_spatial_affine_readonly_gpu_model_state_changed"
        )

    gradient_path = output_dir / "gradient-evidence.json"
    telemetry_path = output_dir / "cuda-telemetry.json"
    state_path = output_dir / "model-state-hashes.json"
    _write_json_exclusive(gradient_path, gradient_evidence)
    _write_json_exclusive(telemetry_path, cuda_telemetry)
    _write_json_exclusive(state_path, state_hashes)
    report = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-report-v1"
        ),
        "status": "passed",
        "runId": active_audit["runId"],
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": ARCHITECTURE_ID,
        "seed": SEED,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "latentShape": list(LATENT_SHAPE),
        "conditionChannels": 23,
        "latentChannels": 12,
        "datasetSelectionContract": SELECTION_CONTRACT,
        "firstFormalTrainSampleId": sample_identity["firstTrainSampleId"],
        "fixedValidationSampleId": sample_identity["validationSampleId"],
        "splitCounts": sample_identity["splitCounts"],
        "config": _binding(inputs["configPath"]),
        "executionClaim": dict(execution_claim["claimBinding"]),
        "executionClaimConsumption": claim_consumption_binding,
        "datasetManifest": _binding(inputs["datasetManifest"]),
        "sourceIndex": _binding(inputs["sourceIndex"]),
        "projectAutoencoderCheckpoint": _binding(
            inputs["autoencoderCheckpoint"]
        ),
        "internalCapabilityTicket": dict(
            active_config["training"]["localAiCapabilityTicket"]
        ),
        "executionGrant": grant.as_dict(),
        "denoiserInitialization": (
            "fixed_seed_random_initialization_without_checkpoint"
        ),
        "gradientEvidence": _binding(gradient_path),
        "modelStateHashes": _binding(state_path),
        "cudaTelemetry": _binding(telemetry_path),
        "safety": {
            "denoiserCheckpointRead": False,
            "historicalCheckpointRead": False,
            "failedCheckpointRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightsModified": False,
            "checkpointWritten": False,
            "smokeStarted": False,
            "trainingStarted": False,
        },
        "recordedAtUtc": utc_now(),
    }
    report_path = output_dir / "gpu-diagnostic-report.json"
    _write_json_exclusive(report_path, report)
    terminal = {
        "schemaVersion": (
            "stage4-full-backbone-spatial-affine-readonly-gpu-terminal-v1"
        ),
        "executionState": "completed",
        "status": (
            "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_passed"
        ),
        "runId": active_audit["runId"],
        "executionClaim": dict(execution_claim["claimBinding"]),
        "executionClaimConsumption": claim_consumption_binding,
        "activeConfig": _binding(inputs["configPath"]),
        "internalCapabilityTicket": {
            key: active_config["training"]["localAiCapabilityTicket"][key]
            for key in (
                "ticketId",
                "ticketPath",
                "ticketSha256",
                "consumptionPath",
                "consumptionSha256",
            )
        },
        "gpuDiagnosticReport": _binding(report_path),
        "gradientEvidence": _binding(gradient_path),
        "modelStateHashes": _binding(state_path),
        "cudaTelemetry": _binding(telemetry_path),
        "ownerAuthorizationRequired": False,
        "recordedAtUtc": utc_now(),
    }
    terminal_path = output_dir / "phase-terminal.json"
    _write_json_exclusive(terminal_path, terminal)
    return {"status": terminal["status"], "terminal": _binding(terminal_path)}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--config-sha256", required=True)
    parser.add_argument("--execution-claim", type=Path, required=True)
    parser.add_argument("--execution-claim-sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    inputs = validate_readonly_gpu_inputs(
        args.config,
        args.config_sha256,
        args.execution_claim,
        args.execution_claim_sha256,
        args.output_dir,
    )
    result = run_readonly_gpu_qualification(inputs)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

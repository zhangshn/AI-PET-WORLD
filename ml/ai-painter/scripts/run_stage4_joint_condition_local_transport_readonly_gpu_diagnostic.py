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
for source_path in (SOURCE_ROOT, SCRIPT_DIR):
    if str(source_path) not in sys.path:
        sys.path.insert(0, str(source_path))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import (
    AiAssistedConditionalDenoiserDataset,
    is_ai_assisted_conditional_row,
)
from ai_painter_joint_condition_local_transport_contract import (
    ARCHITECTURE_ID,
    compile_joint_condition_local_transport_cpu_inactive_config,
)
from ai_painter_preview_reproduction import state_dict_sha256
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
OUTPUT_NAMESPACE = Path(
    ".runtime/ai-painter/"
    "stage4-joint-condition-local-transport-readonly-gpu-qualifications"
)
BLOCK_NAMES = (
    "block0",
    "block1",
    "middle1",
    "middle2",
    "up_block1",
    "up_block0",
)


def _expected_transport_parameter_shapes() -> dict[str, tuple[int, ...]]:
    expected: dict[str, tuple[int, ...]] = {}
    for block_name in BLOCK_NAMES:
        for norm_name in ("norm1", "norm2"):
            prefix = f"{block_name}.local_transport_{norm_name}"
            expected[f"{prefix}.weight"] = (9, 23, 3, 3)
            expected[f"{prefix}.bias"] = (9,)
    return expected


EXPECTED_TRANSPORT_PARAMETER_SHAPES = _expected_transport_parameter_shapes()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_logical_relative_path(value: Path, *, label: str) -> None:
    if (
        value.is_absolute()
        or not value.parts
        or any(part in {"", ".", ".."} for part in value.parts)
    ):
        raise ValueError(f"joint_local_transport_{label}_project_relative_required")


def _resolve_project_relative(
    value: Path,
    *,
    must_exist: bool,
    expect_file: bool = False,
) -> Path:
    _validate_logical_relative_path(value, label="path")
    resolved = PROJECT_ROOT.joinpath(value).resolve()
    project_root = PROJECT_ROOT.resolve()
    runtime_root = (PROJECT_ROOT / ".runtime").resolve()
    if value.parts[0].casefold() == ".runtime":
        if resolved != runtime_root and runtime_root not in resolved.parents:
            raise ValueError("joint_local_transport_runtime_path_escape")
    elif resolved != project_root and project_root not in resolved.parents:
        raise ValueError("joint_local_transport_project_path_escape")
    if must_exist and not resolved.exists():
        raise ValueError("joint_local_transport_bound_path_missing")
    if expect_file and not resolved.is_file():
        raise ValueError("joint_local_transport_bound_file_missing")
    return resolved


def _project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime_root = (PROJECT_ROOT / ".runtime").resolve()
    if resolved == runtime_root or runtime_root in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime_root)).as_posix()
    return resolved.relative_to(PROJECT_ROOT.resolve()).as_posix()


def _binding(path: Path) -> dict[str, str]:
    return {"path": _project_path(path), "sha256": sha256_file(path)}


def _write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def validate_active_config_binding(
    config_path_value: Path,
    config_sha256: str,
    output_dir_value: Path,
) -> dict[str, Any]:
    if Path.cwd().resolve() != PROJECT_ROOT.resolve():
        raise ValueError("joint_local_transport_project_root_mismatch")
    if re.fullmatch(r"[0-9a-f]{64}", config_sha256) is None:
        raise ValueError("joint_local_transport_active_config_sha256_invalid")
    config_path = _resolve_project_relative(
        config_path_value,
        must_exist=True,
        expect_file=True,
    )
    if sha256_file(config_path) != config_sha256:
        raise ValueError("joint_local_transport_active_config_sha256_mismatch")
    active_config = json.loads(config_path.read_text(encoding="utf-8-sig"))
    execution_identity = active_config.get("executionIdentity")
    if not isinstance(execution_identity, Mapping):
        raise ValueError("joint_local_transport_execution_identity_missing")
    run_id = execution_identity.get("runId")
    output_namespace = execution_identity.get("outputNamespace")
    if (
        active_config.get("architectureId") != ARCHITECTURE_ID
        or active_config.get("denoiserArchitecture") != ARCHITECTURE_ID
        or active_config.get("capabilityVersion") != ARCHITECTURE_ID
        or not isinstance(run_id, str)
        or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{7,127}", run_id) is None
        or not isinstance(output_namespace, str)
    ):
        raise ValueError("joint_local_transport_active_config_identity_invalid")
    output_dir = _resolve_project_relative(output_dir_value, must_exist=False)
    output_root = (PROJECT_ROOT / OUTPUT_NAMESPACE).resolve()
    if (
        output_dir.parent != output_root
        or output_dir == output_root
        or output_dir.name != run_id
        or _project_path(output_dir) != output_namespace
        or output_dir_value.as_posix() != output_namespace
    ):
        raise ValueError("joint_local_transport_output_namespace_invalid")
    if output_dir.exists():
        raise ValueError("joint_local_transport_output_reuse_forbidden")
    return {
        "activeConfig": active_config,
        "activeConfigPath": config_path,
        "activeConfigBinding": _binding(config_path),
        "runId": run_id,
        "outputDir": output_dir,
        "outputNamespace": output_namespace,
    }


def build_qualification_model_config() -> dict[str, Any]:
    inactive = compile_joint_condition_local_transport_cpu_inactive_config()
    formal = load_spatial_affine_formal_objective_contract(PROJECT_ROOT)
    boundary = formal["modelBoundary"]
    return {
        "ownership": boundary["ownership"],
        "trainingLane": boundary["trainingLane"],
        "autoencoderSourceModelId": boundary["autoencoderSourceModelId"],
        "autoencoderSourceArchitectureVersion": boundary[
            "autoencoderSourceArchitectureVersion"
        ],
        "autoencoderRequiredCheckpointProvenance": boundary[
            "autoencoderRequiredCheckpointProvenance"
        ],
        "baseChannels": int(inactive["baseChannels"]),
        "denoiserBaseChannels": int(inactive["denoiserBaseChannels"]),
        "latentChannels": int(inactive["latentChannels"]),
        "conditionChannels": int(inactive["conditionChannels"]),
        "autoencoderArchitecture": inactive["autoencoderArchitecture"],
        "latentDownsampleFactor": int(inactive["latentDownsampleFactor"]),
        "denoiserArchitecture": ARCHITECTURE_ID,
        "conditionChannelOrder": list(inactive["conditionChannelOrder"]),
        "conditionChannelTypes": dict(inactive["conditionChannelTypes"]),
        "conditionResizeContract": inactive["conditionResizeContract"],
        "diffusionSteps": int(inactive["diffusionSteps"]),
    }


def validate_transport_parameter_identity(
    denoiser: torch.nn.Module,
) -> dict[str, Any]:
    parameters = {
        name: parameter
        for name, parameter in denoiser.named_parameters()
        if ".local_transport_" in name
    }
    shapes = {
        name: tuple(parameter.shape) for name, parameter in parameters.items()
    }
    if shapes != EXPECTED_TRANSPORT_PARAMETER_SHAPES:
        raise ValueError("joint_local_transport_parameter_identity_invalid")
    if len(parameters) != 24 or len({id(value) for value in parameters.values()}) != 24:
        raise ValueError("joint_local_transport_parameter_sharing_invalid")
    parameter_count = sum(value.numel() for value in parameters.values())
    if parameter_count != 22_464:
        raise ValueError("joint_local_transport_parameter_count_invalid")
    if any(
        ".spatial_affine_" in name
        for name, _parameter in denoiser.named_parameters()
    ):
        raise ValueError("joint_local_transport_affine_coexistence_forbidden")
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


def _finite_nonzero(value: torch.Tensor | None) -> bool:
    return (
        value is not None
        and bool(torch.isfinite(value).all())
        and bool(torch.any(value != 0))
    )


def summarize_condition_gradient(gradient: torch.Tensor | None) -> dict[str, Any]:
    if gradient is None or tuple(gradient.shape) != CONDITION_SHAPE:
        raise ValueError("joint_local_transport_condition_gradient_shape_invalid")
    per_channel_maximum = gradient.detach().abs().flatten(2).amax(dim=2)[0]
    if (
        not _finite_nonzero(gradient)
        or not bool(torch.isfinite(per_channel_maximum).all())
        or not bool((per_channel_maximum > 0).all())
    ):
        raise ValueError("joint_local_transport_condition_gradient_invalid")
    return {
        "shape": list(gradient.shape),
        "finite": True,
        "nonzero": True,
        "channelCount": 23,
        "all23ChannelsFiniteNonzero": True,
        "perChannelMaximumAbsoluteGradient": [
            float(value) for value in per_channel_maximum.cpu()
        ],
    }


def summarize_transport_parameter_gradient(
    name: str,
    gradient: torch.Tensor | None,
) -> dict[str, Any]:
    expected_shape = EXPECTED_TRANSPORT_PARAMETER_SHAPES.get(name)
    if expected_shape is None:
        raise ValueError("joint_local_transport_unknown_parameter")
    if gradient is None or tuple(gradient.shape) != expected_shape:
        raise ValueError(f"joint_local_transport_gradient_shape_invalid:{name}")
    if not _finite_nonzero(gradient):
        raise ValueError(f"joint_local_transport_gradient_invalid:{name}")
    return {
        "parameterName": name,
        "shape": list(gradient.shape),
        "finite": True,
        "nonzero": True,
        "maximumAbsoluteGradient": float(gradient.detach().abs().max().cpu()),
    }


def resolve_formal_inputs(
    model_config: Mapping[str, Any],
) -> dict[str, Any]:
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
        raise ValueError("joint_local_transport_formal_source_identity_changed")
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            dataset_manifest,
            split,
            list(model_config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=SELECTION_CONTRACT,
        )
        for split in EXPECTED_SPLIT_COUNTS
    }
    split_counts = {split: len(dataset) for split, dataset in datasets.items()}
    if split_counts != EXPECTED_SPLIT_COUNTS:
        raise ValueError("joint_local_transport_split_identity_changed")
    source_value = json.loads(source_index.read_text(encoding="utf-8-sig"))
    source_rows = source_value.get("samples")
    if (
        source_value.get("schemaVersion")
        != "ai-assisted-cold-start-dataset-source-index-v1"
        or not isinstance(source_rows, list)
    ):
        raise ValueError("joint_local_transport_source_index_invalid")
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
                f"joint_local_transport_source_order_changed:{split}"
            )
    if datasets["train"].rows[0].get("sampleId") != FIRST_TRAIN_SAMPLE_ID:
        raise ValueError("joint_local_transport_first_train_identity_changed")
    occurrences = [
        (split, index)
        for split, dataset in datasets.items()
        for index, row in enumerate(dataset.rows)
        if row.get("sampleId") == VALIDATION_SAMPLE_ID
    ]
    if len(occurrences) != 1 or occurrences[0][0] != "validation":
        raise ValueError("joint_local_transport_validation_sample_194_invalid")
    validation_index = occurrences[0][1]
    return {
        "datasetManifest": dataset_manifest,
        "sourceIndex": source_index,
        "autoencoderCheckpoint": autoencoder_checkpoint,
        "splitCounts": split_counts,
        "firstTrainSampleId": FIRST_TRAIN_SAMPLE_ID,
        "validationSampleId": VALIDATION_SAMPLE_ID,
        "trainSample": datasets["train"][0],
        "validationSample": datasets["validation"][validation_index],
    }


def derive_native_rgb_resource_boundary() -> dict[str, Any]:
    native_width = 1024
    native_height = 768
    native_latent_width = native_width // 4
    native_latent_height = native_height // 4
    condition_bytes = 23 * native_width * native_height * 4
    latent_bytes = 12 * native_latent_width * native_latent_height * 4
    rgb_bytes = 3 * native_width * native_height * 4
    return {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-native-rgb-"
            "readonly-resource-boundary-v1"
        ),
        "status": "dimension_and_static_tensor_boundary_verified",
        "stage0RgbShape": [1, 3, 192, 256],
        "stage0LatentShape": list(LATENT_SHAPE),
        "nativeRgbShape": [1, 3, native_height, native_width],
        "nativeLatentShape": [
            1,
            12,
            native_latent_height,
            native_latent_width,
        ],
        "frozenAutoencoderSpatialRelation": 4,
        "float32StaticTensorBytes": {
            "condition23Channels": condition_bytes,
            "latent12Channels": latent_bytes,
            "rgb3Channels": rgb_bytes,
            "combinedLowerBound": condition_bytes + latent_bytes + rgb_bytes,
        },
        "nativeDecodeExecuted": False,
        "nativeTrainingExecuted": False,
        "nativePeakGpuMemoryMeasured": False,
        "nativeRuntimeFeasibilityClaimed": False,
        "interpretation": (
            "The 1024x768 record is a read-only dimensional and static-tensor "
            "resource boundary. Only the required 256x192 Stage 0 diagnostic "
            "is executed and measured on CUDA."
        ),
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
        raise ValueError("joint_local_transport_condition_shape_invalid")
    with torch.no_grad():
        clean_latent = model.autoencoder.encode(image)
    if tuple(clean_latent.shape) != LATENT_SHAPE:
        raise ValueError("joint_local_transport_clean_latent_shape_invalid")
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
    predicted_velocity = model.predict_velocity(noisy_latent, timestep, conditions)
    if tuple(predicted_velocity.shape) != LATENT_SHAPE:
        raise ValueError("joint_local_transport_output_shape_invalid")
    parameter_identity = validate_transport_parameter_identity(model.denoiser)
    parameters = parameter_identity["parameters"]
    objective = predicted_velocity.square().mean()
    gradients = torch.autograd.grad(
        objective,
        (conditions, *tuple(parameters.values())),
        allow_unused=False,
    )
    condition_gradient = summarize_condition_gradient(gradients[0])
    parameter_gradients = [
        summarize_transport_parameter_gradient(name, gradient)
        for name, gradient in zip(parameters, gradients[1:], strict=True)
    ]
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("joint_local_transport_parameter_grad_field_populated")
    return {
        "role": role,
        "sampleId": sample["sampleId"],
        "selectionContract": SELECTION_CONTRACT,
        "inputConditionShape": list(conditions.shape),
        "outputShape": list(predicted_velocity.shape),
        "timestep": 500,
        "objective": float(objective.detach().cpu()),
        "conditionGradient": condition_gradient,
        "transportParameterTensorCount": parameter_identity[
            "parameterTensorCount"
        ],
        "transportParameterCount": parameter_identity["parameterCount"],
        "transportParameterObjectIdentityCount": parameter_identity[
            "parameterObjectIdentityCount"
        ],
        "transportParameterGradients": parameter_gradients,
        "allParameterGradFieldsRemainNone": True,
    }


def validate_readonly_gpu_inputs(
    config_path_value: Path,
    config_sha256: str,
    output_dir_value: Path,
) -> dict[str, Any]:
    active = validate_active_config_binding(
        config_path_value,
        config_sha256,
        output_dir_value,
    )
    model_config = build_qualification_model_config()
    formal_inputs = resolve_formal_inputs(model_config)
    return {**active, "modelConfig": model_config, **formal_inputs}


def run_readonly_gpu_diagnostic(inputs: Mapping[str, Any]) -> dict[str, Any]:
    output_dir = Path(inputs["outputDir"])
    if output_dir.exists():
        raise ValueError("joint_local_transport_output_reuse_forbidden")
    if not torch.cuda.is_available():
        raise RuntimeError("joint_local_transport_cuda_unavailable")

    started = time.perf_counter()
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    device = torch.device("cuda:0")
    device_properties = torch.cuda.get_device_properties(0)

    model_config = inputs["modelConfig"]
    model = build_complete_world_system(model_config)
    if sha256_file(inputs["autoencoderCheckpoint"]) != AUTOENCODER_SHA256:
        raise ValueError("joint_local_transport_autoencoder_identity_changed")
    checkpoint = trainer.load_autoencoder_checkpoint(
        inputs["autoencoderCheckpoint"],
        model_config,
    )
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    validate_transport_parameter_identity(model.denoiser)
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
    model.to(device).eval()
    allocated_after_model_load = int(torch.cuda.memory_allocated(0))
    reserved_after_model_load = int(torch.cuda.memory_reserved(0))

    gradient_evidence = {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-readonly-gpu-"
            "gradient-evidence-v1"
        ),
        "status": "passed",
        "architectureId": ARCHITECTURE_ID,
        "seed": SEED,
        "samples": [
            _sample_gradient_evidence(
                model,
                inputs["trainSample"],
                role="first_formal_train_record",
                device=device,
            ),
            _sample_gradient_evidence(
                model,
                inputs["validationSample"],
                role="fixed_validation_sample_194",
                device=device,
            ),
        ],
    }
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("joint_local_transport_parameter_grad_field_populated")
    torch.cuda.synchronize(0)
    cuda_telemetry = {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-readonly-gpu-"
            "cuda-telemetry-v1"
        ),
        "status": "completed",
        "measuredAtResolution": {"width": 256, "height": 192},
        "deviceIndex": 0,
        "deviceName": torch.cuda.get_device_name(0),
        "deviceCapability": list(torch.cuda.get_device_capability(0)),
        "deviceTotalMemoryBytes": int(device_properties.total_memory),
        "torchVersion": torch.__version__,
        "cudaRuntimeVersion": torch.version.cuda,
        "allocatedAfterModelLoadBytes": allocated_after_model_load,
        "reservedAfterModelLoadBytes": reserved_after_model_load,
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
            "stage4-joint-condition-local-transport-readonly-gpu-"
            "state-hashes-v1"
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
        raise ValueError("joint_local_transport_model_state_changed")

    resource_boundary = derive_native_rgb_resource_boundary()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(exist_ok=False)
    gradient_path = output_dir / "gradient-evidence.json"
    telemetry_path = output_dir / "cuda-telemetry.json"
    state_path = output_dir / "model-state-hashes.json"
    resource_path = output_dir / "native-rgb-resource-boundary.json"
    _write_json_exclusive(gradient_path, gradient_evidence)
    _write_json_exclusive(telemetry_path, cuda_telemetry)
    _write_json_exclusive(state_path, state_hashes)
    _write_json_exclusive(resource_path, resource_boundary)

    report = {
        "schemaVersion": (
            "stage4-joint-condition-local-transport-readonly-gpu-"
            "diagnostic-report-v1"
        ),
        "status": "passed",
        "runId": inputs["runId"],
        "architectureId": ARCHITECTURE_ID,
        "capabilityVersion": ARCHITECTURE_ID,
        "seed": SEED,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "latentShape": list(LATENT_SHAPE),
        "conditionShape": list(CONDITION_SHAPE),
        "conditionChannels": 23,
        "transportParameterTensorCount": 24,
        "transportParameterCount": 22_464,
        "activeConfig": dict(inputs["activeConfigBinding"]),
        "datasetManifest": _binding(inputs["datasetManifest"]),
        "sourceIndex": _binding(inputs["sourceIndex"]),
        "projectAutoencoderCheckpoint": _binding(
            inputs["autoencoderCheckpoint"]
        ),
        "datasetSelectionContract": SELECTION_CONTRACT,
        "splitCounts": inputs["splitCounts"],
        "firstFormalTrainSampleId": inputs["firstTrainSampleId"],
        "fixedValidationSampleId": inputs["validationSampleId"],
        "denoiserInitialization": (
            "fixed_seed_random_initialization_without_checkpoint"
        ),
        "gradientEvidence": _binding(gradient_path),
        "modelStateHashes": _binding(state_path),
        "cudaTelemetry": _binding(telemetry_path),
        "nativeRgbReadonlyResourceBoundary": _binding(resource_path),
        "safety": {
            "autoencoderCheckpointRead": True,
            "autoencoderFrozen": True,
            "denoiserCheckpointRead": False,
            "historicalDenoiserCheckpointRead": False,
            "failedDenoiserCheckpointRead": False,
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
    report_binding = _binding(report_path)
    return {
        "status": "passed",
        "runId": inputs["runId"],
        "architectureId": ARCHITECTURE_ID,
        "transportParameterTensorsQualified": 24,
        "conditionChannelsQualified": 23,
        "modelStateUnchanged": True,
        "report": report_binding,
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--active-config", type=Path, required=True)
    parser.add_argument("--active-config-sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    inputs = validate_readonly_gpu_inputs(
        args.active_config,
        args.active_config_sha256,
        args.output_dir,
    )
    result = run_readonly_gpu_diagnostic(inputs)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

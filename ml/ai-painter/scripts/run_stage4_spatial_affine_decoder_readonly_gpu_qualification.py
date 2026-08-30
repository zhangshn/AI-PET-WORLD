from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
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
from ai_painter_spatial_affine_decoder_contract import (
    ARCHITECTURE_ID,
    load_spatial_affine_formal_objective_contract,
    validate_spatial_affine_decoder_config,
)
from ai_painter_authorization_policy import resolve_stage_execution_grant
import train_ai_assisted_conditional_denoiser as trainer


SEED = 20263722
IMAGE_SIZE = (256, 192)
LATENT_SHAPE = (1, 12, 48, 64)
VALIDATION_SAMPLE_ID = (
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
)
SELECTION_CONTRACT = "registered_v7_capacity_contribution_v1"
EXPECTED_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}
EXPECTED_AFFINE_PARAMETER_SHAPES = {
    "up_block1.spatial_affine_norm1.weight": (256, 23, 3, 3),
    "up_block1.spatial_affine_norm1.bias": (256,),
    "up_block1.spatial_affine_norm2.weight": (256, 23, 3, 3),
    "up_block1.spatial_affine_norm2.bias": (256,),
    "up_block0.spatial_affine_norm1.weight": (128, 23, 3, 3),
    "up_block0.spatial_affine_norm1.bias": (128,),
    "up_block0.spatial_affine_norm2.weight": (128, 23, 3, 3),
    "up_block0.spatial_affine_norm2.bias": (128,),
}
FORBIDDEN_EXECUTION_ACTIONS = (
    "load_parent_denoiser",
    "create_optimizer",
    "execute_backward",
    "mutate_model_weights",
    "write_diagnostic_checkpoint",
    "write_smoke_checkpoint",
    "run_stage0",
    "run_stage1",
    "run_stage2",
    "run_strict_revalidation",
    "run_formal_inference",
    "promote_checkpoint",
    "create_runtime_frame",
    "enter_world",
    "automatic_retry",
)


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
        raise ValueError("spatial_affine_readonly_gpu_project_relative_path_required")
    root = PROJECT_ROOT.resolve()
    logical = PROJECT_ROOT.joinpath(value)
    resolved = logical.resolve()
    if value.parts[0].casefold() == ".runtime":
        runtime_root = (PROJECT_ROOT / ".runtime").resolve()
        if resolved != runtime_root and runtime_root not in resolved.parents:
            raise ValueError("spatial_affine_readonly_gpu_runtime_path_escape")
    elif resolved != root and root not in resolved.parents:
        raise ValueError("spatial_affine_readonly_gpu_project_path_escape")
    if must_exist and not resolved.exists():
        raise ValueError("spatial_affine_readonly_gpu_bound_path_missing")
    if expect_file and not resolved.is_file():
        raise ValueError("spatial_affine_readonly_gpu_bound_file_missing")
    return resolved


def _project_binding(path: Path) -> dict[str, str]:
    return {
        "path": trainer.project_path(path),
        "sha256": sha256_file(path),
    }


def _write_json_exclusive(path: Path, value: Mapping[str, Any]) -> None:
    payload = json.dumps(dict(value), ensure_ascii=False, indent=2) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def _finite_nonzero(value: torch.Tensor | None) -> bool:
    return (
        value is not None
        and bool(torch.isfinite(value).all())
        and bool(torch.any(value != 0))
    )


def summarize_spatial_affine_gradient(
    parameter_name: str,
    gradient: torch.Tensor | None,
) -> dict[str, Any]:
    expected_shape = EXPECTED_AFFINE_PARAMETER_SHAPES.get(parameter_name)
    if expected_shape is None:
        raise ValueError("spatial_affine_readonly_gpu_unknown_parameter")
    if gradient is None or tuple(gradient.shape) != expected_shape:
        raise ValueError(
            f"spatial_affine_readonly_gpu_gradient_shape_invalid:{parameter_name}"
        )
    channel_count = int(gradient.shape[0])
    if channel_count % 2 != 0:
        raise ValueError(
            f"spatial_affine_readonly_gpu_gradient_channel_identity_invalid:{parameter_name}"
        )
    gamma, beta = gradient.chunk(2, dim=0)
    result = {
        "parameterName": parameter_name,
        "shape": list(gradient.shape),
        "finite": bool(torch.isfinite(gradient).all()),
        "nonzero": bool(torch.any(gradient != 0)),
        "gammaFiniteNonzero": _finite_nonzero(gamma),
        "betaFiniteNonzero": _finite_nonzero(beta),
        "maximumAbsoluteGradient": float(gradient.detach().abs().max().cpu()),
    }
    if not all(
        result[key]
        for key in (
            "finite",
            "nonzero",
            "gammaFiniteNonzero",
            "betaFiniteNonzero",
        )
    ):
        raise ValueError(
            f"spatial_affine_readonly_gpu_gradient_invalid:{parameter_name}"
        )
    return result


def resolve_formal_sample_identities(
    config: Mapping[str, Any],
    dataset_manifest_path: Path,
    source_index_path: Path,
) -> dict[str, Any]:
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            dataset_manifest_path,
            split,
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=SELECTION_CONTRACT,
        )
        for split in EXPECTED_SPLIT_COUNTS
    }
    counts = {split: len(dataset) for split, dataset in datasets.items()}
    if counts != EXPECTED_SPLIT_COUNTS:
        raise ValueError("spatial_affine_readonly_gpu_split_identity_changed")
    source_index = json.loads(source_index_path.read_text(encoding="utf-8"))
    if not isinstance(source_index.get("samples"), list):
        raise ValueError("spatial_affine_readonly_gpu_source_index_samples_missing")
    for split, dataset in datasets.items():
        formal_ids = [
            row["sampleId"]
            for row in source_index["samples"]
            if is_ai_assisted_conditional_row(
                row,
                split,
                selection_contract=SELECTION_CONTRACT,
            )
        ]
        dataset_ids = [row["sampleId"] for row in dataset.rows]
        if dataset_ids != formal_ids:
            raise ValueError(
                f"spatial_affine_readonly_gpu_source_index_order_changed:{split}"
            )
    validation_matches = [
        index
        for index, row in enumerate(datasets["validation"].rows)
        if row.get("sampleId") == VALIDATION_SAMPLE_ID
    ]
    if len(validation_matches) != 1:
        raise ValueError(
            "spatial_affine_readonly_gpu_validation_sample_194_identity_invalid"
        )
    return {
        "splitCounts": counts,
        "firstTrainSampleId": datasets["train"].rows[0]["sampleId"],
        "validationSampleId": VALIDATION_SAMPLE_ID,
        "trainSample": datasets["train"][0],
        "validationSample": datasets["validation"][validation_matches[0]],
    }


def validate_readonly_gpu_inputs(
    config_path_value: Path,
    output_dir_value: Path,
) -> dict[str, Any]:
    if Path.cwd().resolve() != PROJECT_ROOT.resolve():
        raise ValueError("spatial_affine_readonly_gpu_project_root_mismatch")
    config_path = _resolve_project_relative(
        config_path_value,
        must_exist=True,
        expect_file=True,
    )
    config = json.loads(config_path.read_text(encoding="utf-8"))
    audit = validate_spatial_affine_decoder_config(
        config,
        project_root=PROJECT_ROOT,
    )
    if audit.get("modeId") != "spatial_affine_decoder_stage4_readonly_gpu":
        raise ValueError("spatial_affine_readonly_gpu_mode_identity_invalid")
    grant = resolve_stage_execution_grant(config, project_root=PROJECT_ROOT)
    grant.require("inspect_autoencoder_identity")
    grant.require("inspect_checkpoint_identity")
    grant.require("load_autoencoder")
    for action in FORBIDDEN_EXECUTION_ACTIONS:
        if grant.permits(action):
            raise ValueError(
                f"spatial_affine_readonly_gpu_forbidden_action_open:{action}"
            )
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
    output_dir = _resolve_project_relative(
        output_dir_value,
        must_exist=False,
    )
    if output_dir.exists():
        raise ValueError("spatial_affine_readonly_gpu_output_reuse_forbidden")
    package = json.loads(dataset_manifest.read_text(encoding="utf-8"))
    source_binding = trainer.validate_stage4_spatial_affine_cli_source_bindings(
        config,
        package,
        dataset_package_path=dataset_manifest,
        autoencoder_checkpoint_path=autoencoder_checkpoint,
        output_dir=output_dir,
    )
    sample_identity = resolve_formal_sample_identities(
        config,
        dataset_manifest,
        source_index,
    )
    return {
        "config": config,
        "configPath": config_path,
        "configSha256": sha256_file(config_path),
        "datasetManifest": dataset_manifest,
        "sourceIndex": source_index,
        "autoencoderCheckpoint": autoencoder_checkpoint,
        "outputDir": output_dir,
        "sourceBinding": source_binding,
        "sampleIdentity": sample_identity,
        "grant": grant,
    }


def _sample_gradient_evidence(
    model: torch.nn.Module,
    sample: Mapping[str, Any],
    *,
    role: str,
    diffusion_steps: int,
    device: torch.device,
) -> dict[str, Any]:
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
    with torch.no_grad():
        clean_latent = model.autoencoder.encode(image)
    if tuple(clean_latent.shape) != LATENT_SHAPE:
        raise ValueError("spatial_affine_readonly_gpu_clean_latent_shape_invalid")
    timestep = torch.tensor([500], dtype=torch.long, device=device)
    generator = torch.Generator(device=device).manual_seed(SEED)
    noise = torch.randn(clean_latent.shape, device=device, generator=generator)
    beta_schedule = torch.linspace(
        0.0001,
        0.02,
        diffusion_steps,
        device=device,
    )
    alpha_bar = torch.cumprod(1.0 - beta_schedule, dim=0)[timestep].view(
        1, 1, 1, 1
    )
    noisy_latent = alpha_bar.sqrt() * clean_latent + (1.0 - alpha_bar).sqrt() * noise
    predicted_velocity = model.predict_velocity(noisy_latent, timestep, conditions)
    if tuple(predicted_velocity.shape) != LATENT_SHAPE:
        raise ValueError("spatial_affine_readonly_gpu_output_shape_invalid")
    named_affine_parameters = {
        name: parameter
        for name, parameter in model.denoiser.named_parameters()
        if ".spatial_affine_" in name
    }
    if {
        name: tuple(parameter.shape)
        for name, parameter in named_affine_parameters.items()
    } != EXPECTED_AFFINE_PARAMETER_SHAPES:
        raise ValueError("spatial_affine_readonly_gpu_parameter_identity_invalid")
    objective = predicted_velocity.square().mean()
    gradients = torch.autograd.grad(
        objective,
        (conditions, *tuple(named_affine_parameters.values())),
        allow_unused=False,
    )
    condition_gradient = gradients[0]
    per_channel_nonzero = (
        condition_gradient.detach().abs().flatten(2).amax(dim=2) > 0
    )
    if (
        not _finite_nonzero(condition_gradient)
        or not bool(per_channel_nonzero.all())
        or tuple(condition_gradient.shape) != (1, 23, 192, 256)
    ):
        raise ValueError("spatial_affine_readonly_gpu_condition_gradient_invalid")
    parameter_evidence = [
        summarize_spatial_affine_gradient(name, gradient)
        for name, gradient in zip(named_affine_parameters, gradients[1:])
    ]
    stage_evidence = []
    for stage, prefix in (
        ("up1", "up_block1."),
        ("up0", "up_block0."),
    ):
        selected = [
            item
            for item in parameter_evidence
            if item["parameterName"].startswith(prefix)
        ]
        stage_evidence.append(
            {
                "stage": stage,
                "parameterTensorCount": len(selected),
                "allGammaGradientsFiniteNonzero": all(
                    item["gammaFiniteNonzero"] for item in selected
                ),
                "allBetaGradientsFiniteNonzero": all(
                    item["betaFiniteNonzero"] for item in selected
                ),
            }
        )
    if any(
        item["parameterTensorCount"] != 4
        or item["allGammaGradientsFiniteNonzero"] is not True
        or item["allBetaGradientsFiniteNonzero"] is not True
        for item in stage_evidence
    ):
        raise ValueError("spatial_affine_readonly_gpu_stage_gradient_invalid")
    return {
        "role": role,
        "sampleId": sample["sampleId"],
        "inputConditionShape": list(conditions.shape),
        "outputShape": list(predicted_velocity.shape),
        "timestep": 500,
        "conditionGradientFiniteNonzero": True,
        "all23ConditionChannelsReachOutput": True,
        "conditionGradientMaximumAbsoluteValue": float(
            condition_gradient.detach().abs().max().cpu()
        ),
        "parameterTensorCount": len(parameter_evidence),
        "parameterCount": sum(
            int(parameter.numel()) for parameter in named_affine_parameters.values()
        ),
        "parameterGradients": parameter_evidence,
        "stageGradients": stage_evidence,
        "objective": float(objective.detach().cpu()),
    }


def run_readonly_gpu_qualification(inputs: Mapping[str, Any]) -> dict[str, Any]:
    if not torch.cuda.is_available():
        raise RuntimeError("spatial_affine_readonly_gpu_cuda_unavailable")
    output_dir = Path(inputs["outputDir"])
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(exist_ok=False)
    started = time.perf_counter()
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    device = torch.device("cuda:0")
    config = inputs["config"]
    model = build_complete_world_system(config)
    checkpoint = trainer.load_autoencoder_checkpoint(
        inputs["autoencoderCheckpoint"],
        config,
    )
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.to(device).eval()
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())

    sample_identity = inputs["sampleIdentity"]
    gradient_evidence = {
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-gradient-evidence-v1",
        "status": "passed",
        "samples": [
            _sample_gradient_evidence(
                model,
                sample_identity["trainSample"],
                role="first_formal_train_record",
                diffusion_steps=int(config["diffusionSteps"]),
                device=device,
            ),
            _sample_gradient_evidence(
                model,
                sample_identity["validationSample"],
                role="fixed_validation_sample_194",
                diffusion_steps=int(config["diffusionSteps"]),
                device=device,
            ),
        ],
    }
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("spatial_affine_readonly_gpu_parameter_grad_field_populated")
    torch.cuda.synchronize(0)
    cuda_telemetry = {
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-cuda-telemetry-v1",
        "status": "completed",
        "deviceName": torch.cuda.get_device_name(0),
        "deviceCapability": list(torch.cuda.get_device_capability(0)),
        "torchVersion": torch.__version__,
        "cudaRuntimeVersion": torch.version.cuda,
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    model.to("cpu")
    denoiser_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
    state_hashes = {
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-state-hashes-v1",
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": denoiser_before == denoiser_after,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": autoencoder_before == autoencoder_after,
    }
    if (
        state_hashes["denoiserUnchanged"] is not True
        or state_hashes["autoencoderUnchanged"] is not True
    ):
        raise ValueError("spatial_affine_readonly_gpu_model_state_changed")

    gradient_path = output_dir / "gradient-evidence.json"
    telemetry_path = output_dir / "cuda-telemetry.json"
    state_path = output_dir / "model-state-hashes.json"
    _write_json_exclusive(gradient_path, gradient_evidence)
    _write_json_exclusive(telemetry_path, cuda_telemetry)
    _write_json_exclusive(state_path, state_hashes)
    report = {
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-report-v1",
        "status": "passed",
        "capabilityVersion": config["stage4SpatialAffineConditioningContract"][
            "capabilityVersion"
        ],
        "architectureId": ARCHITECTURE_ID,
        "seed": SEED,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "conditionChannels": 23,
        "latentChannels": 12,
        "firstFormalTrainSampleId": sample_identity["firstTrainSampleId"],
        "fixedValidationSampleId": sample_identity["validationSampleId"],
        "splitCounts": sample_identity["splitCounts"],
        "config": {
            "path": trainer.project_path(inputs["configPath"]),
            "sha256": inputs["configSha256"],
        },
        "datasetManifest": _project_binding(inputs["datasetManifest"]),
        "sourceIndex": _project_binding(inputs["sourceIndex"]),
        "projectAutoencoderCheckpoint": _project_binding(
            inputs["autoencoderCheckpoint"]
        ),
        "internalCapabilityTicket": dict(
            config["training"]["localAiCapabilityTicket"]
        ),
        "executionGrant": inputs["grant"].as_dict(),
        "gradientEvidence": _project_binding(gradient_path),
        "modelStateHashes": _project_binding(state_path),
        "cudaTelemetry": _project_binding(telemetry_path),
        "safety": {
            "historicalDenoiserCheckpointRead": False,
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
        "schemaVersion": "stage4-spatial-affine-readonly-gpu-terminal-v1",
        "executionState": "completed",
        "status": "stage4_spatial_affine_readonly_gpu_qualification_passed",
        "gpuDiagnosticReport": _project_binding(report_path),
        "gradientEvidence": _project_binding(gradient_path),
        "modelStateHashes": _project_binding(state_path),
        "cudaTelemetry": _project_binding(telemetry_path),
        "ownerAuthorizationRequired": False,
        "recordedAtUtc": utc_now(),
    }
    terminal_path = output_dir / "phase-terminal.json"
    _write_json_exclusive(terminal_path, terminal)
    return {
        "status": terminal["status"],
        "terminal": _project_binding(terminal_path),
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    inputs = validate_readonly_gpu_inputs(args.config, args.output_dir)
    result = run_readonly_gpu_qualification(inputs)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

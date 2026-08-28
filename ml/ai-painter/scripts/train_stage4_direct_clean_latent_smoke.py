from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import time

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter_preview_reproduction import (
    fixed_preview_determinism_scope,
    state_dict_sha256,
    tensor_sha256,
)
from ai_painter_direct_clean_latent_contract import (
    SMOKE_PREVIEW_EPOCHS,
    SMOKE_RESOLUTION,
    SMOKE_SAMPLE_ID,
    SMOKE_SEED,
    validate_direct_clean_latent_smoke_active_config,
)
from ai_painter_direct_responsibility_residual_contract import (
    DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
    validate_direct_responsibility_residual_smoke_active_config,
)
from ai_painter_native_condition_encoder_contract import (
    NATIVE_CONDITION_ENCODER_ARCHITECTURE,
    validate_native_condition_encoder_smoke_active_config,
)
from ai_painter_native_responsibility_residual_contract import (
    NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
    validate_native_responsibility_residual_smoke_active_config,
)
from ai_painter_route_counterfactual_compositor_contract import (
    ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE,
    ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA,
    validate_route_counterfactual_compositor_smoke_active_config,
)
import train_ai_assisted_conditional_denoiser as formal


SOURCE_INDEX_SHA256 = (
    "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
)
AUTOENCODER_SHA256 = (
    "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
)
EXPECTED_SPLITS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def _metric_scalars(metrics: dict) -> dict:
    result = {}
    for key, value in metrics.items():
        if key in {"compositeLossTensor", "compositeLoss", "predictedRgbTensor"}:
            continue
        if torch.is_tensor(value) and value.numel() == 1:
            result[key] = float(value.detach().cpu())
        elif isinstance(value, (str, bool)):
            result[key] = value
    return result


def _dataset(package_path: Path, split: str, config: dict):
    return AiAssistedConditionalDenoiserDataset(
        package_path,
        split,
        list(config["conditionChannelOrder"]),
        (SMOKE_RESOLUTION["width"], SMOKE_RESOLUTION["height"]),
        selection_contract=formal.conditional_dataset_selection_contract(config),
    )


def validate_trainer_entry(args, config: dict, package: dict) -> tuple[dict, dict]:
    if args.stage4_direct_clean_latent_smoke_contract is None:
        raise ValueError("direct_clean_latent_smoke_contract_required")
    contract_path = args.stage4_direct_clean_latent_smoke_contract
    if not contract_path.is_file():
        raise ValueError("direct_clean_latent_smoke_contract_missing")
    smoke_contract = formal.read_json(contract_path)
    validated = (
        validate_route_counterfactual_compositor_smoke_active_config(
            config, smoke_contract
        )
        if config.get("denoiserArchitecture")
        == ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE
        else validate_native_responsibility_residual_smoke_active_config(
            config, smoke_contract
        )
        if config.get("denoiserArchitecture")
        == NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE
        else validate_native_condition_encoder_smoke_active_config(
            config, smoke_contract
        )
        if config.get("denoiserArchitecture")
        == NATIVE_CONDITION_ENCODER_ARCHITECTURE
        else validate_direct_responsibility_residual_smoke_active_config(
            config, smoke_contract
        )
        if config.get("denoiserArchitecture")
        == DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE
        else validate_direct_clean_latent_smoke_active_config(
            config, smoke_contract
        )
    )
    expected_ticket_state = "preflight_unconsumed" if args.preflight_only else "consumed"
    if validated["ticketState"] != expected_ticket_state:
        raise ValueError("direct_clean_latent_smoke_ticket_state_mismatch")
    execution = smoke_contract.get("executionIdentity", {})
    epoch_count = int(execution.get("epochCount", -1))
    preview_epochs = list(execution.get("previewEpochs", []))
    fixed_40_qualification = (
        (
            config.get("denoiserArchitecture")
            == NATIVE_CONDITION_ENCODER_ARCHITECTURE
            and smoke_contract.get("schemaVersion")
            == "stage4-native-condition-encoder-fixed-40-epoch-qualification-contract-v1"
        )
        or (
            config.get("denoiserArchitecture")
            == ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE
            and smoke_contract.get("schemaVersion")
            == ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA
        )
    )
    if epoch_count != (40 if fixed_40_qualification else 30):
        raise ValueError("direct_clean_latent_smoke_epoch_contract_invalid")
    if preview_epochs != (
        [1, 5, 10, 20, 30, 40]
        if fixed_40_qualification
        else list(SMOKE_PREVIEW_EPOCHS)
    ):
        raise ValueError("direct_clean_latent_smoke_preview_contract_invalid")
    if (
        not args.single_sample_overfit_smoke
        or args.overfit_sample_id != SMOKE_SAMPLE_ID
        or args.overfit_epochs != epoch_count
        or args.overfit_evaluation_interval != 5
        or args.resolution_stage != 0
    ):
        raise ValueError("direct_clean_latent_smoke_cli_identity_invalid")
    if args.initial_denoiser_checkpoint is not None:
        raise ValueError("direct_clean_latent_historical_denoiser_forbidden")
    if args.output_dir.exists():
        raise ValueError("direct_clean_latent_training_output_must_not_exist")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("direct_clean_latent_dataset_capacity_invalid")
    source_index = Path.cwd() / str(package.get("sourceIndexPath", ""))
    if not source_index.is_file() or _sha(source_index) != SOURCE_INDEX_SHA256:
        raise ValueError("direct_clean_latent_source_index_identity_invalid")
    if not args.autoencoder_checkpoint.is_file() or _sha(args.autoencoder_checkpoint) != AUTOENCODER_SHA256:
        raise ValueError("direct_clean_latent_autoencoder_identity_invalid")
    split_counts = {
        split: len(_dataset(args.dataset_package, split, config))
        for split in EXPECTED_SPLITS
    }
    if split_counts != EXPECTED_SPLITS:
        raise ValueError("direct_clean_latent_dataset_split_identity_invalid")
    validation = _dataset(args.dataset_package, "validation", config)
    matches = [
        index
        for index, row in enumerate(validation.rows)
        if row["sampleId"] == SMOKE_SAMPLE_ID
    ]
    if len(matches) != 1:
        raise ValueError("direct_clean_latent_fixed_validation_sample_invalid")
    return smoke_contract, validation[matches[0]]


def _save_preview(path: Path, tensor: torch.Tensor) -> None:
    array = (tensor[0].detach().cpu().permute(1, 2, 0).numpy() * 255.0).round()
    Image.fromarray(array.clip(0, 255).astype(np.uint8), mode="RGB").save(
        path,
        format="PNG",
        optimize=True,
    )


def run(args, config: dict, package: dict) -> int:
    smoke_contract, sample = validate_trainer_entry(args, config, package)
    execution = smoke_contract["executionIdentity"]
    epoch_count = int(execution["epochCount"])
    preview_epochs = list(execution["previewEpochs"])
    if args.preflight_only:
        print(json.dumps({
            "status": "direct_clean_latent_smoke_trainer_preflight_passed",
            "runId": smoke_contract["executionIdentity"]["runId"],
            "sampleId": SMOKE_SAMPLE_ID,
            "sampleSplit": "validation",
            "splitCounts": EXPECTED_SPLITS,
            "gpuStarted": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "trainingStarted": False,
        }, ensure_ascii=False, indent=2))
        return 0

    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable_for_direct_clean_latent_smoke")
    formal.set_seed(SMOKE_SEED)
    device = torch.device("cuda:0")
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    args.output_dir.mkdir(parents=True, exist_ok=False)
    preview_dir = args.output_dir / "fixed-epoch-previews"
    preview_dir.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    model = build_complete_world_system(config).to(device)
    checkpoint = formal.load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    initial_denoiser = state_dict_sha256(model.denoiser.state_dict())
    initial_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device)
    optimizer = torch.optim.AdamW(
        model.denoiser.parameters(),
        lr=float(config["training"]["denoiserLearningRate"]),
    )
    metrics_rows = []
    preview_rows = []
    best_score = None
    best_epoch = None
    best_state = None
    for epoch in range(1, epoch_count + 1):
        epoch_started = time.perf_counter()
        model.denoiser.train()
        optimizer.zero_grad(set_to_none=True)
        metrics = formal.direct_clean_latent_loss_metrics(model, image, conditions, config)
        metrics["compositeLossTensor"].backward()
        optimizer.step()
        score = float(metrics["compositeConditionQualityScore"].detach().cpu())
        if best_score is None or score < best_score:
            best_score = score
            best_epoch = epoch
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.denoiser.state_dict().items()
            }
        row = {
            "epoch": epoch,
            "optimizerStep": epoch,
            "trainingCompositeLoss": float(metrics["compositeLossTensor"].detach().cpu()),
            "checkpointSelectionScore": score,
            "durationSeconds": round(time.perf_counter() - epoch_started, 3),
            "metrics": _metric_scalars(metrics),
            "recordedAtUtc": formal.utc_now(),
        }
        if epoch in preview_epochs:
            model.denoiser.eval()
            with fixed_preview_determinism_scope():
                with torch.no_grad():
                    rgb = model.decode_clean_latent(
                        model.predict_clean_latent(conditions)
                    ).clamp(0.0, 1.0)
                    repeated = model.decode_clean_latent(
                        model.predict_clean_latent(conditions)
                    ).clamp(0.0, 1.0)
                if tensor_sha256(rgb) != tensor_sha256(repeated):
                    raise ValueError("direct_clean_latent_preview_tensor_reproduction_mismatch")
                preview_path = preview_dir / (
                    f"epoch-{epoch:03d}-wet-season-drainage-hollow-v6.png"
                )
                repeat_path = preview_dir / (
                    f"epoch-{epoch:03d}-wet-season-drainage-hollow-v6-reproduction.png"
                )
                _save_preview(preview_path, rgb)
                _save_preview(repeat_path, repeated)
                if _sha(preview_path) != _sha(repeat_path):
                    raise ValueError("direct_clean_latent_preview_byte_reproduction_mismatch")
            artifact = {
                "epoch": epoch,
                "path": formal.project_path(preview_path),
                "sha256": _sha(preview_path),
                "reproductionPath": formal.project_path(repeat_path),
                "reproductionSha256": _sha(repeat_path),
                "byteExactReproduced": True,
                "rgbTensorSha256": tensor_sha256(rgb),
            }
            row["fixedPreview"] = artifact
            preview_rows.append(artifact)
        metrics_rows.append(row)
        elapsed = time.perf_counter() - started
        remaining = elapsed / epoch * (epoch_count - epoch)
        _write(args.output_dir / "progress.json", {
            "schemaVersion": "stage4-direct-clean-latent-controlled-smoke-progress-v1",
            "status": "running",
            "phase": "training",
            "runId": smoke_contract["executionIdentity"]["runId"],
            "sampleId": SMOKE_SAMPLE_ID,
            "currentEpoch": epoch,
            "epochTarget": epoch_count,
            "currentBatch": 1,
            "batchTarget": 1,
            "optimizerStep": epoch,
            "optimizerStepTarget": epoch_count,
            "percent": round(epoch / epoch_count * 100, 2),
            "etaSeconds": round(remaining, 1),
            "latestMetric": row,
            "updatedAtUtc": formal.utc_now(),
        })
    final_denoiser = state_dict_sha256(model.denoiser.state_dict())
    final_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
    if initial_denoiser == final_denoiser or initial_autoencoder != final_autoencoder:
        raise ValueError("direct_clean_latent_smoke_state_change_contract_invalid")
    checkpoint_path = args.output_dir / "non-promotable-smoke-checkpoint.pt"
    torch.save({
        "schemaVersion": config["requiredCheckpointProvenance"],
        "role": "non_promotable_direct_clean_latent_controlled_smoke_only",
        "runId": smoke_contract["executionIdentity"]["runId"],
        "stage0InitializationEligible": False,
        "formalPromotionEligible": False,
        "bestEpoch": best_epoch,
        "bestCheckpointSelectionScore": best_score,
        "denoiserState": best_state,
        "denoiserStateSha256": state_dict_sha256(best_state),
    }, checkpoint_path)
    telemetry = {
        "schemaVersion": "stage4-direct-clean-latent-smoke-resource-telemetry-v1",
        "status": "completed",
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    _write(args.output_dir / "resource-telemetry.json", telemetry)
    manifest = {
        "schemaVersion": "stage4-direct-clean-latent-controlled-smoke-manifest-v1",
        "status": "training_completed_pending_automatic_machine_review",
        "runId": smoke_contract["executionIdentity"]["runId"],
        "architecture": config["denoiserArchitecture"],
        "sampleId": SMOKE_SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SMOKE_SEED,
        "resolution": SMOKE_RESOLUTION,
        "epochCount": epoch_count,
        "previewEpochs": preview_epochs,
        "metrics": metrics_rows,
        "fixedPreviews": preview_rows,
        "bestEpoch": best_epoch,
        "bestCheckpointSelectionScore": best_score,
        "checkpoint": {
            "path": formal.project_path(checkpoint_path),
            "sha256": _sha(checkpoint_path),
            "promotable": False,
        },
        "modelStateHashes": {
            "before": initial_denoiser,
            "after": final_denoiser,
            "weightsChanged": True,
        },
        "autoencoderStateHashes": {
            "before": initial_autoencoder,
            "after": final_autoencoder,
            "unchanged": True,
        },
        "randomNoisyLatentUsed": False,
        "diffusionTimestepUsed": False,
        "velocityPredictionUsed": False,
        "diffusionRolloutUsed": False,
        "automaticMachineReviewRequired": True,
    }
    _write(args.output_dir / "manifest.json", manifest)
    _write(args.output_dir / "progress.json", {
        "schemaVersion": "stage4-direct-clean-latent-controlled-smoke-progress-v1",
        "status": "training_completed_pending_automatic_machine_review",
        "phase": "machine_review_pending_internal_transition",
        "runId": smoke_contract["executionIdentity"]["runId"],
        "sampleId": SMOKE_SAMPLE_ID,
        "currentEpoch": epoch_count,
        "epochTarget": epoch_count,
        "optimizerStep": epoch_count,
        "optimizerStepTarget": epoch_count,
        "percent": 100.0,
        "manifestPath": formal.project_path(args.output_dir / "manifest.json"),
        "manifestSha256": _sha(args.output_dir / "manifest.json"),
        "updatedAtUtc": formal.utc_now(),
    })
    print(json.dumps({
        "status": "direct_clean_latent_smoke_training_completed_pending_automatic_machine_review",
        "runId": smoke_contract["executionIdentity"]["runId"],
        "manifestPath": formal.project_path(args.output_dir / "manifest.json"),
        "manifestSha256": _sha(args.output_dir / "manifest.json"),
    }, ensure_ascii=False, indent=2))
    return 0

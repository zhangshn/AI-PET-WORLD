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
    FROZEN_SPLIT_COUNTS,
    SMOKE_SAMPLE_ID,
    SMOKE_SEED,
    STAGE0_EPOCHS,
    STAGE0_PREVIEW_EPOCHS,
    STAGE0_RESOLUTION,
    validate_direct_clean_latent_stage0_active_config,
)
from ai_painter_direct_responsibility_residual_contract import (
    DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
    validate_direct_responsibility_residual_stage0_active_config,
)
import train_ai_assisted_conditional_denoiser as formal


SOURCE_INDEX_SHA256 = (
    "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
)
AUTOENCODER_SHA256 = (
    "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
)


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


def _dataset(package_path: Path, split: str, config: dict):
    return AiAssistedConditionalDenoiserDataset(
        package_path,
        split,
        list(config["conditionChannelOrder"]),
        (STAGE0_RESOLUTION["width"], STAGE0_RESOLUTION["height"]),
        selection_contract=formal.conditional_dataset_selection_contract(config),
    )


def _metric_scalars(metrics: dict) -> dict[str, float | str | bool]:
    result: dict[str, float | str | bool] = {}
    for key, value in metrics.items():
        if key in {"compositeLossTensor", "compositeLoss", "predictedRgbTensor"}:
            continue
        if torch.is_tensor(value) and value.numel() == 1:
            result[key] = float(value.detach().cpu())
        elif isinstance(value, (str, bool)):
            result[key] = value
    return result


def _mean_metric_rows(rows: list[dict]) -> dict[str, float]:
    keys = sorted({key for row in rows for key, value in row.items() if isinstance(value, float)})
    return {
        key: sum(float(row[key]) for row in rows if key in row)
        / sum(1 for row in rows if key in row)
        for key in keys
    }


def _save_preview(path: Path, tensor: torch.Tensor) -> None:
    array = (tensor[0].detach().cpu().permute(1, 2, 0).numpy() * 255.0).round()
    Image.fromarray(array.clip(0, 255).astype(np.uint8), mode="RGB").save(
        path,
        format="PNG",
        optimize=True,
    )


def _preview_pair(model, conditions: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    with fixed_preview_determinism_scope():
        with torch.no_grad():
            first = model.decode_clean_latent(
                model.predict_clean_latent(conditions)
            ).clamp(0.0, 1.0)
            repeated = model.decode_clean_latent(
                model.predict_clean_latent(conditions)
            ).clamp(0.0, 1.0)
    if tensor_sha256(first) != tensor_sha256(repeated):
        raise ValueError("direct_clean_latent_stage0_preview_tensor_reproduction_mismatch")
    return first, repeated


def validate_trainer_entry(args, config: dict, package: dict) -> tuple[dict, object, object, dict]:
    contract_path = args.stage4_direct_clean_latent_stage0_contract
    if contract_path is None or not contract_path.is_file():
        raise ValueError("direct_clean_latent_stage0_contract_required")
    stage0_contract = formal.read_json(contract_path)
    validated = (
        validate_direct_responsibility_residual_stage0_active_config(
            config, stage0_contract
        )
        if config.get("denoiserArchitecture")
        == DIRECT_RESPONSIBILITY_RESIDUAL_ARCHITECTURE
        else validate_direct_clean_latent_stage0_active_config(config, stage0_contract)
    )
    expected_ticket_state = "preflight_unconsumed" if args.preflight_only else "consumed"
    if validated["ticketState"] != expected_ticket_state:
        raise ValueError("direct_clean_latent_stage0_ticket_state_mismatch")
    if args.resolution_stage != 0:
        raise ValueError("direct_clean_latent_stage0_resolution_stage_invalid")
    if args.initial_denoiser_checkpoint is not None:
        raise ValueError("direct_clean_latent_stage0_historical_denoiser_forbidden")
    if args.output_dir.exists():
        raise ValueError("direct_clean_latent_stage0_training_output_must_not_exist")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("direct_clean_latent_stage0_dataset_capacity_invalid")
    source_index = Path.cwd() / str(package.get("sourceIndexPath", ""))
    if not source_index.is_file() or _sha(source_index) != SOURCE_INDEX_SHA256:
        raise ValueError("direct_clean_latent_stage0_source_index_identity_invalid")
    if not args.autoencoder_checkpoint.is_file() or _sha(args.autoencoder_checkpoint) != AUTOENCODER_SHA256:
        raise ValueError("direct_clean_latent_stage0_autoencoder_identity_invalid")
    datasets = {
        split: _dataset(args.dataset_package, split, config)
        for split in FROZEN_SPLIT_COUNTS
    }
    split_counts = {split: len(dataset) for split, dataset in datasets.items()}
    if split_counts != FROZEN_SPLIT_COUNTS:
        raise ValueError("direct_clean_latent_stage0_dataset_split_identity_invalid")
    matches = [
        index
        for index, row in enumerate(datasets["validation"].rows)
        if row["sampleId"] == SMOKE_SAMPLE_ID
    ]
    if len(matches) != 1:
        raise ValueError("direct_clean_latent_stage0_fixed_validation_sample_invalid")
    source_rows = formal.read_json(source_index).get("samples", [])
    official_train_order = [
        row["sampleId"]
        for row in source_rows
        if row.get("split") == "train"
        and row.get("v7CapacityContributionRegistered") is True
    ]
    actual_train_order = [row["sampleId"] for row in datasets["train"].rows]
    if actual_train_order != official_train_order:
        raise ValueError("direct_clean_latent_stage0_train_source_order_invalid")
    return stage0_contract, datasets["train"], datasets["validation"], datasets["validation"][matches[0]]


def run(args, config: dict, package: dict) -> int:
    stage0_contract, train_dataset, validation_dataset, fixed_sample = validate_trainer_entry(
        args, config, package
    )
    run_id = stage0_contract["executionIdentity"]["runId"]
    if args.preflight_only:
        print(json.dumps({
            "status": "direct_clean_latent_stage0_trainer_preflight_passed",
            "runId": run_id,
            "stage": 0,
            "splitCounts": FROZEN_SPLIT_COUNTS,
            "epochCount": STAGE0_EPOCHS,
            "optimizerStepTarget": STAGE0_EPOCHS * FROZEN_SPLIT_COUNTS["train"],
            "gpuStarted": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "trainingStarted": False,
        }, ensure_ascii=False, indent=2))
        return 0

    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable_for_direct_clean_latent_stage0")
    formal.set_seed(SMOKE_SEED)
    device = torch.device("cuda:0")
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    args.output_dir.mkdir(parents=True, exist_ok=False)
    preview_dir = args.output_dir / "fixed-epoch-previews"
    preview_dir.mkdir(parents=True, exist_ok=False)
    best_preview_dir = args.output_dir / "best-checkpoint-preview"
    best_preview_dir.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    started_at_utc = formal.utc_now()
    model = build_complete_world_system(config).to(device)
    checkpoint = formal.load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    initial_denoiser = state_dict_sha256(model.denoiser.state_dict())
    initial_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
    optimizer = torch.optim.AdamW(
        model.denoiser.parameters(),
        lr=float(config["training"]["denoiserLearningRate"]),
    )
    optimizer_step = 0
    optimizer_step_target = STAGE0_EPOCHS * len(train_dataset)
    best_score: float | None = None
    best_epoch: int | None = None
    best_state: dict | None = None
    metrics_rows: list[dict] = []
    preview_rows: list[dict] = []
    fixed_conditions = fixed_sample["conditions"].unsqueeze(0).to(device)

    for epoch in range(1, STAGE0_EPOCHS + 1):
        epoch_started = time.perf_counter()
        train_metric_rows: list[dict] = []
        model.denoiser.train()
        for batch_index in range(len(train_dataset)):
            sample = train_dataset[batch_index]
            image = sample["image"].unsqueeze(0).to(device)
            conditions = sample["conditions"].unsqueeze(0).to(device)
            optimizer.zero_grad(set_to_none=True)
            metrics = formal.direct_clean_latent_loss_metrics(model, image, conditions, config)
            loss = metrics["compositeLossTensor"]
            if not bool(torch.isfinite(loss).all()):
                raise ValueError("direct_clean_latent_stage0_nonfinite_training_loss")
            loss.backward()
            optimizer.step()
            optimizer_step += 1
            scalar = _metric_scalars(metrics)
            scalar["compositeLoss"] = float(loss.detach().cpu())
            train_metric_rows.append(scalar)
            del image, conditions, metrics, loss

        model.denoiser.eval()
        validation_metric_rows: list[dict] = []
        with torch.no_grad():
            for validation_index in range(len(validation_dataset)):
                sample = validation_dataset[validation_index]
                image = sample["image"].unsqueeze(0).to(device)
                conditions = sample["conditions"].unsqueeze(0).to(device)
                metrics = formal.direct_clean_latent_loss_metrics(model, image, conditions, config)
                scalar = _metric_scalars(metrics)
                scalar["compositeLoss"] = float(metrics["compositeLossTensor"].detach().cpu())
                validation_metric_rows.append(scalar)
                del image, conditions, metrics
        train_metrics = _mean_metric_rows(train_metric_rows)
        validation_metrics = _mean_metric_rows(validation_metric_rows)
        validation_score = float(validation_metrics["compositeConditionQualityScore"])
        best_updated = best_score is None or validation_score < best_score
        if best_updated:
            best_score = validation_score
            best_epoch = epoch
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.denoiser.state_dict().items()
            }
        row = {
            "epoch": epoch,
            "optimizerStep": optimizer_step,
            "trainingCompositeLoss": train_metrics["compositeLoss"],
            "trainCompositeLoss": train_metrics["compositeLoss"],
            "validationCompositeLoss": validation_metrics["compositeLoss"],
            "validationFixedGridCompositeConditionQualityScore": validation_metrics[
                "compositeLoss"
            ],
            "validationCheckpointSelectionScore": validation_score,
            "bestCheckpointUpdated": best_updated,
            "bestEpoch": best_epoch,
            "trainingMetrics": train_metrics,
            "validationMetrics": validation_metrics,
            "durationSeconds": round(time.perf_counter() - epoch_started, 3),
            "recordedAtUtc": formal.utc_now(),
        }
        if epoch in STAGE0_PREVIEW_EPOCHS:
            first, repeated = _preview_pair(model, fixed_conditions)
            preview_path = preview_dir / f"epoch-{epoch:03d}-wet-season-drainage-hollow-v6.png"
            repeat_path = preview_dir / f"epoch-{epoch:03d}-wet-season-drainage-hollow-v6-reproduction.png"
            _save_preview(preview_path, first)
            _save_preview(repeat_path, repeated)
            if _sha(preview_path) != _sha(repeat_path):
                raise ValueError("direct_clean_latent_stage0_preview_byte_reproduction_mismatch")
            artifact = {
                "epoch": epoch,
                "path": formal.project_path(preview_path),
                "sha256": _sha(preview_path),
                "reproductionPath": formal.project_path(repeat_path),
                "reproductionSha256": _sha(repeat_path),
                "byteExactReproduced": True,
                "rgbTensorSha256": tensor_sha256(first),
            }
            row["fixedPreview"] = artifact
            preview_rows.append(artifact)
        metrics_rows.append(row)
        elapsed = time.perf_counter() - started
        remaining = elapsed / epoch * (STAGE0_EPOCHS - epoch)
        live_progress = {
            "schemaVersion": "ai-painter-training-live-progress-v1",
            "recordedAtUtc": formal.utc_now(),
            "phase": "training",
            "epoch": epoch,
            "epochTarget": STAGE0_EPOCHS,
            "batch": len(train_dataset),
            "batchTarget": len(train_dataset),
            "optimizerStep": optimizer_step,
            "optimizerStepTarget": optimizer_step_target,
            "percentage": round(epoch / STAGE0_EPOCHS * 100, 2),
            "elapsedSeconds": round(elapsed, 1),
            "etaSeconds": round(remaining, 1),
            "optimizerStepsPerSecond": round(optimizer_step / max(elapsed, 1e-9), 4),
            "rollingEpochLoss": train_metrics["compositeLoss"],
            "validationCompositeScore": validation_metrics["compositeLoss"],
            "checkpointSelectionScore": validation_score,
        }
        _write(args.output_dir / "progress.json", {
            "schemaVersion": "stage4-direct-clean-latent-stage0-progress-v1",
            "status": "running",
            "phase": "training",
            "runId": run_id,
            "stage": 0,
            "resolutionStage": STAGE0_RESOLUTION,
            "resolution": STAGE0_RESOLUTION,
            "startedAtUtc": started_at_utc,
            "currentEpoch": epoch,
            "epochTarget": STAGE0_EPOCHS,
            "currentBatch": len(train_dataset),
            "batchTarget": len(train_dataset),
            "optimizerStep": optimizer_step,
            "optimizerStepTarget": optimizer_step_target,
            "percent": round(epoch / STAGE0_EPOCHS * 100, 2),
            "etaSeconds": round(remaining, 1),
            "latestMetric": row,
            "metrics": metrics_rows,
            "liveProgress": live_progress,
            "conditionBoundSampleCount": 64,
            "actualLoadedConditionalSampleCount": 64,
            "actualLoadedV7CapacityCount": 64,
            "actualLoadedSplitCounts": FROZEN_SPLIT_COUNTS,
            "updatedAtUtc": formal.utc_now(),
        })

    final_denoiser = state_dict_sha256(model.denoiser.state_dict())
    final_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
    if initial_denoiser == final_denoiser or initial_autoencoder != final_autoencoder:
        raise ValueError("direct_clean_latent_stage0_state_change_contract_invalid")
    if best_state is None or best_epoch is None or best_score is None:
        raise ValueError("direct_clean_latent_stage0_best_checkpoint_missing")
    final_state = {
        key: value.detach().cpu().clone()
        for key, value in model.denoiser.state_dict().items()
    }
    model.denoiser.load_state_dict(best_state, strict=True)
    best_first, best_repeated = _preview_pair(model, fixed_conditions)
    best_path = best_preview_dir / f"epoch-{best_epoch:03d}-best.png"
    best_repeat_path = best_preview_dir / f"epoch-{best_epoch:03d}-best-reproduction.png"
    _save_preview(best_path, best_first)
    _save_preview(best_repeat_path, best_repeated)
    if _sha(best_path) != _sha(best_repeat_path):
        raise ValueError("direct_clean_latent_stage0_best_preview_byte_mismatch")
    best_state_sha = state_dict_sha256(best_state)
    checkpoint_path = args.output_dir / "stage0-checkpoint.pt"
    torch.save({
        "schemaVersion": config["requiredCheckpointProvenance"],
        "role": "direct_clean_latent_formal_stage0_checkpoint",
        "runId": run_id,
        "capabilityVersion": stage0_contract["capabilityVersion"],
        "stage": 0,
        "bestEpoch": best_epoch,
        "bestCheckpointSelectionScore": best_score,
        "denoiserArchitecture": config["denoiserArchitecture"],
        "denoiserState": best_state,
        "denoiserStateSha256": best_state_sha,
        "stage1ParentEligibilityPendingAutomaticMachineReview": True,
        "formalInferenceEligible": False,
    }, checkpoint_path)
    model.denoiser.load_state_dict(final_state, strict=True)
    telemetry = {
        "schemaVersion": "stage4-direct-clean-latent-stage0-resource-telemetry-v1",
        "status": "completed",
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    _write(args.output_dir / "resource-telemetry.json", telemetry)
    manifest = {
        "schemaVersion": "stage4-direct-clean-latent-stage0-manifest-v1",
        "status": "training_completed_pending_automatic_machine_review",
        "runId": run_id,
        "capabilityVersion": stage0_contract["capabilityVersion"],
        "architecture": config["denoiserArchitecture"],
        "stage": 0,
        "seed": SMOKE_SEED,
        "createdAtUtc": started_at_utc,
        "completedAtUtc": formal.utc_now(),
        "resolutionStage": STAGE0_RESOLUTION,
        "resolution": STAGE0_RESOLUTION,
        "epochCount": STAGE0_EPOCHS,
        "optimizerStepCount": optimizer_step,
        "optimizerStepTarget": optimizer_step_target,
        "splitCounts": FROZEN_SPLIT_COUNTS,
        "conditionBoundSampleCount": 64,
        "actualLoadedConditionalSampleCount": 64,
        "actualLoadedV7CapacityCount": 64,
        "actualLoadedSplitCounts": FROZEN_SPLIT_COUNTS,
        "trainSplitOnlyUpdatedWeights": True,
        "validationSplitOnlySelectedCheckpoint": True,
        "previewEpochs": list(STAGE0_PREVIEW_EPOCHS),
        "fixedPreviews": preview_rows,
        "metrics": metrics_rows,
        "bestEpoch": best_epoch,
        "bestCheckpointSelectionScore": best_score,
        "checkpointPath": formal.project_path(checkpoint_path),
        "checkpointSha256": _sha(checkpoint_path),
        "checkpoint": {
            "path": formal.project_path(checkpoint_path),
            "sha256": _sha(checkpoint_path),
            "promotableWithinCapabilityLifecyclePendingReview": True,
            "denoiserStateSha256": best_state_sha,
        },
        "bestCheckpointPreview": {
            "epoch": best_epoch,
            "path": formal.project_path(best_path),
            "sha256": _sha(best_path),
            "reproductionPath": formal.project_path(best_repeat_path),
            "reproductionSha256": _sha(best_repeat_path),
            "byteExactReproduced": True,
        },
        "modelStateHashEvidence": {
            "before": initial_denoiser,
            "after": final_denoiser,
            "weightsChanged": True,
        },
        "autoencoderStateHashEvidence": {
            "before": initial_autoencoder,
            "after": final_autoencoder,
            "unchanged": True,
        },
        "randomNoisyLatentUsed": False,
        "diffusionTimestepUsed": False,
        "velocityPredictionUsed": False,
        "diffusionRolloutUsed": False,
        "historicalDenoiserCheckpointRead": False,
        "automaticMachineReviewRequired": True,
    }
    _write(args.output_dir / "manifest.json", manifest)
    _write(args.output_dir / "progress.json", {
        "schemaVersion": "stage4-direct-clean-latent-stage0-progress-v1",
        "status": "training_completed_pending_automatic_machine_review",
        "phase": "machine_review_pending_internal_transition",
        "runId": run_id,
        "stage": 0,
        "resolutionStage": STAGE0_RESOLUTION,
        "resolution": STAGE0_RESOLUTION,
        "startedAtUtc": started_at_utc,
        "currentEpoch": STAGE0_EPOCHS,
        "epochTarget": STAGE0_EPOCHS,
        "optimizerStep": optimizer_step,
        "optimizerStepTarget": optimizer_step_target,
        "percent": 100.0,
        "metrics": metrics_rows,
        "conditionBoundSampleCount": 64,
        "actualLoadedConditionalSampleCount": 64,
        "actualLoadedV7CapacityCount": 64,
        "actualLoadedSplitCounts": FROZEN_SPLIT_COUNTS,
        "manifestPath": formal.project_path(args.output_dir / "manifest.json"),
        "manifestSha256": _sha(args.output_dir / "manifest.json"),
        "updatedAtUtc": formal.utc_now(),
    })
    print(json.dumps({
        "status": "direct_clean_latent_stage0_training_completed_pending_automatic_machine_review",
        "runId": run_id,
        "manifestPath": formal.project_path(args.output_dir / "manifest.json"),
        "manifestSha256": _sha(args.output_dir / "manifest.json"),
    }, ensure_ascii=False, indent=2))
    return 0

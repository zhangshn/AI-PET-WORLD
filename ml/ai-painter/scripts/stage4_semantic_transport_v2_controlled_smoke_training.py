"""Bounded Stage4 V2 controlled-Smoke training loop.

This adapter deliberately does not call the frozen Trainer CLI.  The CLI's
legacy single-sample branch is bound to retired R5 provenance.  Instead this
module reuses the frozen Trainer's public dataset, loss, optimizer-boundary,
evaluation, and preview functions while enforcing the V2 package identity.
"""

from __future__ import annotations

from copy import deepcopy
from contextlib import nullcontext
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import threading
import time
from typing import Any

import torch
from torch.utils.data import DataLoader, Subset

from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter.complete_world.model import build_complete_world_system
from ai_painter_preview_reproduction import (
    fixed_preview_determinism_scope,
    tensor_sha256,
)
from ai_painter_stage4_semantic_transport_v2_trainer_support import (
    ARCHITECTURE_ID,
    stage4_semantic_transport_v2_optimizer_parameters,
    state_dict_sha256,
    validate_stage4_semantic_transport_v2_autoencoder_boundary,
)
from train_ai_assisted_conditional_denoiser import (
    build_diffusion_schedule,
    compute_latent_normalization,
    evaluate_deterministic_rollout_rgb_quality_v7,
    evaluate_velocity_prediction,
    load_autoencoder_checkpoint,
    serialize_latent_normalization,
    set_seed,
    train_epoch,
    validate_loaded_v7_datasets,
    validate_stage4_fixed_epoch_preview_reproduction,
)


SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SEED = 20263722
EPOCH_COUNT = 30
PREVIEW_EPOCHS = (1, 5, 10, 20, 30)
RESOLUTION = (256, 192)
SELECTION_CONTRACT = "registered_v7_capacity_contribution_v1"


def execute_stage4_v2_controlled_smoke(
    *,
    config_path: Path,
    dataset_package_path: Path,
    autoencoder_checkpoint_path: Path,
    output_dir: Path,
    preflight_only: bool = False,
) -> int:
    root = Path.cwd().resolve()
    config_path = config_path.resolve()
    dataset_package_path = dataset_package_path.resolve()
    autoencoder_checkpoint_path = autoencoder_checkpoint_path.resolve()
    output_dir = output_dir.resolve()
    config = _read_object(config_path)
    execution = _validate_execution_config(config, output_dir, root)
    if _logical(root, dataset_package_path) != execution["datasetRelease"]["path"]:
        raise ValueError("V2 Smoke dataset release path differs from active binding")
    if _sha256_file(dataset_package_path) != execution["datasetRelease"]["sha256"]:
        raise ValueError("V2 Smoke dataset release changed before execution")
    release = _validate_dataset_release(dataset_package_path, root)
    source_manifest = _resolve_bound_file(root, release["sourcePackage"]["manifest"])
    _resolve_bound_file(root, release["sourcePackage"]["sourceIndex"])
    sample = _validate_fixed_release_sample(release, root)
    if execution["derivedConfigContract"]["datasetPackageId"] != release["datasetReleaseIdentity"]:
        raise ValueError("V2 Smoke dataset release identity mismatch")
    _validate_autoencoder_binding(autoencoder_checkpoint_path, config, root)
    if preflight_only:
        return 0
    if not torch.cuda.is_available():
        raise RuntimeError("Stage4 V2 controlled Smoke requires real CUDA")
    if output_dir.exists():
        raise FileExistsError("Stage4 V2 controlled Smoke output directory reuse is forbidden")
    output_dir.mkdir(parents=True, exist_ok=False)

    started_monotonic = time.perf_counter()
    started_at = _utc_now()
    progress_path = output_dir / "progress.json"
    _write_atomic_json(progress_path, _progress(
        execution, epoch=0, optimizer_step=0, started_monotonic=started_monotonic,
        phase="initializing", loss=None,
    ))

    datasets = _build_datasets(source_manifest, config)
    dataset_evidence = validate_loaded_v7_datasets(datasets)
    validation_indices = [
        index for index, row in enumerate(datasets["validation"].rows)
        if row.get("sampleId") == SAMPLE_ID
    ]
    if len(validation_indices) != 1:
        raise ValueError("fixed validation sample 194 is missing or duplicated")
    source_row = datasets["validation"].rows[validation_indices[0]]
    if source_row.get("split") != "validation":
        raise ValueError("fixed sample 194 is not in validation")
    if source_row.get("conditionPackPath") != sample["conditionPack"]["path"]:
        raise ValueError("fixed sample condition-pack path differs from dataset release")
    if source_row.get("imagePath") != sample["image"]["path"]:
        raise ValueError("fixed sample image path differs from dataset release")
    smoke_dataset = Subset(datasets["validation"], validation_indices)
    loader = DataLoader(smoke_dataset, batch_size=1, shuffle=False, num_workers=0)
    fixed_sample_condition_tensor_sha256 = tensor_sha256(
        smoke_dataset[0]["conditions"].unsqueeze(0)
    )

    device = torch.device("cuda")
    torch.cuda.reset_peak_memory_stats(device)
    telemetry = _ResourceTelemetry(
        output_dir / "resource-telemetry.json", execution, device,
    )
    telemetry.start()
    set_seed(SEED)
    model = build_complete_world_system(config).to(device)
    checkpoint = load_autoencoder_checkpoint(autoencoder_checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    autoencoder_loaded = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="loaded",
    )
    autoencoder_before = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="before_training", expected_state_sha256=autoencoder_loaded["stateSha256"],
    )
    initial_denoiser_sha = state_dict_sha256(model.denoiser.state_dict())
    latent_normalization = compute_latent_normalization(model, datasets["train"], device)
    diffusion = build_diffusion_schedule(config, device)
    training_token_accounting = _build_training_token_accounting(config)
    optimizer_parameters = stage4_semantic_transport_v2_optimizer_parameters(model)
    optimizer = torch.optim.AdamW(
        optimizer_parameters,
        lr=float(config["training"]["denoiserLearningRate"]),
    )

    metrics: list[dict[str, Any]] = []
    previews: list[dict[str, Any]] = []
    best_score = float("inf")
    best_epoch = 0
    best_state: dict[str, Any] | None = None
    for epoch_index in range(EPOCH_COUNT):
        epoch = epoch_index + 1
        telemetry.update(phase="training", epoch=epoch, optimizer_step=epoch_index)
        train_metrics = train_epoch(
            model, loader, optimizer, diffusion, latent_normalization, device,
            config, epoch_index, max_batches=None,
            enable_path_replay=False, enable_epoch_worst_replay=False,
        )
        validation = evaluate_velocity_prediction(
            model, loader, diffusion, latent_normalization, device,
            SEED + 2000, config["training"]["fixedValidationTimesteps"], config,
        )
        preview_scope = (
            fixed_preview_determinism_scope(True)
            if epoch in PREVIEW_EPOCHS else nullcontext()
        )
        with preview_scope:
            rollout = evaluate_deterministic_rollout_rgb_quality_v7(
                model, smoke_dataset, diffusion, latent_normalization, device,
                SEED + 3000, config, output_dir / "fixed-epoch-previews", epoch,
            )
        score = float(validation["compositeConditionQualityScore"]) + (
            float(rollout["rolloutRgbQualityScore"])
            * float(config["training"].get("checkpointRolloutWeight", 1.0))
        )
        row = {
            "epoch": epoch,
            "recordedAtUtc": _utc_now(),
            "trainMetrics": _json_scalars(train_metrics),
            "validationMetrics": _json_scalars(validation),
            "rolloutMetrics": _json_scalars({
                key: value for key, value in rollout.items() if key != "previewArtifact"
            }),
            "checkpointSelectionScore": score,
            "trainingTokenAccounting": training_token_accounting["perEpoch"][str(epoch)],
        }
        if score < best_score:
            best_score = score
            best_epoch = epoch
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.denoiser.state_dict().items()
            }
            row["bestCheckpointUpdated"] = True
        else:
            row["bestCheckpointUpdated"] = False
        if epoch in PREVIEW_EPOCHS:
            source_preview = rollout.get("previewArtifact")
            if not isinstance(source_preview, dict):
                raise ValueError(f"scheduled V2 Smoke preview is missing at Epoch {epoch}")
            with fixed_preview_determinism_scope(True):
                repeated = evaluate_deterministic_rollout_rgb_quality_v7(
                    model, smoke_dataset, diffusion, latent_normalization, device,
                    SEED + 3000, config,
                    output_dir / "fixed-epoch-preview-reproductions", epoch,
                )
            repeated_preview = repeated.get("previewArtifact")
            reproduction = validate_stage4_fixed_epoch_preview_reproduction(
                source_preview, repeated_preview, epoch,
            )
            if not all(reproduction[key] is True for key in (
                "modelStateSha256Matches", "conditionTensorSha256Matches",
                "rgbTensorSha256Matches", "pngByteSha256Matches",
            )):
                raise ValueError(f"V2 Smoke preview reproduction failed at Epoch {epoch}")
            previews.append({
                "epoch": epoch,
                "path": source_preview["previewPath"],
                "sha256": source_preview["previewSha256"],
                "byteSize": _project_file(root, source_preview["previewPath"]).stat().st_size,
                "reproduction": {
                    "path": repeated_preview["previewPath"],
                    "sha256": repeated_preview["previewSha256"],
                    "byteSize": _project_file(root, repeated_preview["previewPath"]).stat().st_size,
                    "byteExact": True,
                },
                "previewReproduction": reproduction,
                "modelStateSha256": source_preview["denoiserStateSha256"],
                "conditionTensorSha256": source_preview["conditionTensorSha256"],
                "rgbTensorSha256": source_preview["rgbTensorSha256"],
            })
            row["previewReproduction"] = reproduction
            row["modelStateSha256"] = source_preview["denoiserStateSha256"]
        metrics.append(row)
        telemetry.update(phase="epoch_completed", epoch=epoch, optimizer_step=epoch)
        telemetry.sample_now()
        _write_atomic_json(progress_path, _progress(
            execution, epoch=epoch, optimizer_step=epoch,
            started_monotonic=started_monotonic, phase="epoch_completed",
            loss=float(train_metrics["compositeLoss"]),
        ))

    if best_state is None or best_epoch < 1:
        raise RuntimeError("V2 Smoke did not produce a best Denoiser state")
    final_denoiser_sha = state_dict_sha256(model.denoiser.state_dict())
    if initial_denoiser_sha == final_denoiser_sha:
        raise RuntimeError("V2 Smoke Denoiser state did not change")
    autoencoder_after = validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="after_training", expected_state_sha256=autoencoder_before["stateSha256"],
    )
    telemetry.update(
        phase="training_completed", epoch=EPOCH_COUNT, optimizer_step=EPOCH_COUNT,
    )
    telemetry_binding = telemetry.stop(root)
    checkpoint_path = output_dir / "best-smoke-checkpoint.pt"
    best_denoiser_sha = state_dict_sha256(best_state)
    checkpoint_payload = {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-checkpoint-v1",
        "status": "controlled_smoke_non_promotable",
        "packageId": execution["packageId"],
        "runId": execution["runId"],
        "architectureId": ARCHITECTURE_ID,
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SEED,
        "resolution": {"width": RESOLUTION[0], "height": RESOLUTION[1]},
        "bestEpoch": best_epoch,
        "bestValidationScore": best_score,
        "denoiserState": best_state,
        "denoiserStateSha256": best_denoiser_sha,
        "autoencoderCheckpoint": {
            "path": _logical(root, autoencoder_checkpoint_path),
            "sha256": _sha256_file(autoencoder_checkpoint_path),
        },
        "autoencoderStateSha256": autoencoder_after["stateSha256"],
        "latentNormalization": serialize_latent_normalization(latent_normalization),
        "parentDenoiserCheckpoint": None,
        "trainingTokenAccounting": training_token_accounting,
        "promotable": False,
        "createdAtUtc": _utc_now(),
    }
    with checkpoint_path.open("xb") as stream:
        torch.save(checkpoint_payload, stream)
        stream.flush()
    checkpoint_binding = _binding(root, checkpoint_path)
    checkpoint_metadata_path = output_dir / "best-smoke-checkpoint.metadata.json"
    checkpoint_metadata = {
        "schemaVersion": (
            "ai-painter-stage4-v2-controlled-smoke-checkpoint-metadata-v1"
        ),
        "status": "controlled_smoke_non_promotable",
        "packageId": execution["packageId"],
        "runId": execution["runId"],
        "architectureId": ARCHITECTURE_ID,
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SEED,
        "resolution": {"width": RESOLUTION[0], "height": RESOLUTION[1]},
        "bestEpoch": best_epoch,
        "bestValidationScore": best_score,
        "checkpoint": checkpoint_binding,
        "denoiserStateSha256": best_denoiser_sha,
        "autoencoderCheckpoint": {
            "path": _logical(root, autoencoder_checkpoint_path),
            "sha256": _sha256_file(autoencoder_checkpoint_path),
        },
        "autoencoderStateSha256": autoencoder_after["stateSha256"],
        "parentDenoiserCheckpoint": None,
        "trainingTokenAccountingSha256": _canonical_sha256(
            training_token_accounting
        ),
        "promotable": False,
        "createdAtUtc": checkpoint_payload["createdAtUtc"],
    }
    _write_exclusive_json(checkpoint_metadata_path, checkpoint_metadata)
    metrics_path = output_dir / "epoch-metrics.json"
    _write_exclusive_json(metrics_path, {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-epoch-metrics-v1",
        "packageId": execution["packageId"], "runId": execution["runId"],
        "records": metrics,
    })
    completed_at = _utc_now()
    manifest = {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-training-manifest-v1",
        "status": "training_completed",
        "packageId": execution["packageId"],
        "runId": execution["runId"],
        "architectureId": ARCHITECTURE_ID,
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SEED,
        "resolution": {"width": RESOLUTION[0], "height": RESOLUTION[1]},
        "epochCount": EPOCH_COUNT,
        "previewEpochs": list(PREVIEW_EPOCHS),
        "previews": previews,
        "fixedSampleConditionTensorIdentity": {
            "schemaVersion": (
                "ai-painter-stage4-v2-fixed-sample-condition-tensor-identity-v1"
            ),
            "sampleId": SAMPLE_ID,
            "sampleSplit": "validation",
            "conditionPack": sample["conditionPack"],
            "conditionTensorSha256": fixed_sample_condition_tensor_sha256,
        },
        "checkpoint": {
            **checkpoint_binding,
            "promotable": False,
            "trainingTokenAccountingSha256": _canonical_sha256(
                training_token_accounting
            ),
        },
        "checkpointMetadata": _binding(root, checkpoint_metadata_path),
        "metrics": _binding(root, metrics_path),
        "resourceTelemetry": telemetry_binding,
        "trainingTokenAccounting": training_token_accounting,
        "bestEpoch": best_epoch,
        "bestValidationScore": best_score,
        "datasetReleaseIdentity": release["datasetReleaseIdentity"],
        "datasetEvidence": dataset_evidence,
        "historicalDenoiserCheckpointRead": False,
        "parentDenoiserCheckpoint": None,
        "modelState": {
            "initialSha256": initial_denoiser_sha,
            "finalSha256": best_denoiser_sha,
            "terminalEpochStateSha256": final_denoiser_sha,
            "changedByTraining": True,
        },
        "autoencoderState": {
            "frozen": True,
            "beforeSha256": autoencoder_before["stateSha256"],
            "afterSha256": autoencoder_after["stateSha256"],
        },
        "optimizerScope": "stage4_v2_denoiser_trainable_parameters_only",
        "startedAtUtc": started_at,
        "completedAtUtc": completed_at,
    }
    _write_exclusive_json(output_dir / "manifest.json", manifest)
    _write_atomic_json(progress_path, _progress(
        execution, epoch=EPOCH_COUNT, optimizer_step=EPOCH_COUNT,
        started_monotonic=started_monotonic, phase="training_completed",
        loss=float(metrics[-1]["trainMetrics"]["compositeLoss"]),
    ))
    return 0


def _validate_execution_config(
    config: dict[str, Any], output_dir: Path, root: Path,
) -> dict[str, Any]:
    if config.get("denoiserArchitecture") != ARCHITECTURE_ID:
        raise ValueError("V2 Smoke architecture mismatch")
    execution = config.get("training", {}).get("stage4V2ControlledSmokeExecution")
    if not isinstance(execution, dict):
        raise ValueError("V2 Smoke execution binding is missing")
    expected = {
        "sampleId": SAMPLE_ID, "sampleSplit": "validation", "seed": SEED,
        "resolution": {"width": RESOLUTION[0], "height": RESOLUTION[1]},
        "epochCount": EPOCH_COUNT, "previewEpochs": list(PREVIEW_EPOCHS),
        "historicalDenoiserCheckpointAllowed": False, "outputReuseAllowed": False,
        "ownerAuthorizationRequired": False,
        "oneTimeConsumptionInheritedFromParent": True,
        "independentAuthorizationAuthority": False,
    }
    for key, value in expected.items():
        if execution.get(key) != value:
            raise ValueError(f"V2 Smoke execution field changed: {key}")
    if _logical(root, output_dir) != execution["derivedConfigContract"]["outputDirectory"]:
        raise ValueError("V2 Smoke output does not match the parent-bound child output")
    ticket = config.get("training", {}).get("localAiCapabilityTicket", {})
    if ticket.get("executionState") != "consumed":
        raise ValueError("V2 Smoke derived Trainer ticket is not consumed")
    if ticket.get("ticketId") != execution.get("derivedTrainerTicketId"):
        raise ValueError("V2 Smoke derived Trainer ticket changed")
    for binding_name in ("ticketPath", "consumptionPath"):
        binding_path = _project_file(root, ticket[binding_name])
        expected_sha = ticket[binding_name.replace("Path", "Sha256")]
        if _sha256_file(binding_path) != expected_sha:
            raise ValueError(f"V2 Smoke derived Trainer {binding_name} changed")
    for parent_name in ("signedParentTicket", "signedParentTicketConsumption"):
        parent = execution.get(parent_name, {})
        if not isinstance(parent.get("path"), str) or not isinstance(parent.get("sha256"), str):
            raise ValueError(f"V2 Smoke {parent_name} binding is missing")
        if _sha256_file(_project_file(root, parent["path"])) != parent["sha256"]:
            raise ValueError(f"V2 Smoke {parent_name} binding changed")
    return execution


def _validate_dataset_release(path: Path, root: Path) -> dict[str, Any]:
    release = _read_object(path)
    if release.get("schemaVersion") != "ai-painter-stage4-v2-dataset-release-contract-v1":
        raise ValueError("V2 Smoke dataset release schema mismatch")
    if release.get("status") != "verified_dataset_release" or release.get("immutable") is not True:
        raise ValueError("V2 Smoke dataset release is not immutable and verified")
    scope = release.get("releaseScope", {})
    if scope.get("releasedSampleCount") != 64 or scope.get("splitCounts") != {
        "train": 48, "validation": 8, "challenge": 4, "regression": 4,
    }:
        raise ValueError("V2 Smoke dataset split contract changed")
    _logical(root, path)
    return release


def _validate_fixed_release_sample(release: dict[str, Any], root: Path) -> dict[str, Any]:
    rows = [row for row in release.get("samples", []) if row.get("sampleId") == SAMPLE_ID]
    if len(rows) != 1 or rows[0].get("split") != "validation":
        raise ValueError("fixed V2 Smoke sample 194 is missing, duplicated, or not validation")
    row = rows[0]
    _resolve_bound_file(root, row["image"])
    _resolve_bound_file(root, row["conditionPack"])
    return row


def _validate_autoencoder_binding(path: Path, config: dict[str, Any], root: Path) -> None:
    expected = config.get("training", {}).get("stage4V2ControlledSmokeExecution", {}).get(
        "autoencoderCheckpoint"
    )
    if isinstance(expected, dict):
        if _logical(root, path) != expected.get("path") or _sha256_file(path) != expected.get("sha256"):
            raise ValueError("V2 Smoke Autoencoder checkpoint binding changed")
    elif not path.is_file():
        raise FileNotFoundError("V2 Smoke Autoencoder checkpoint is missing")


def _build_datasets(manifest: Path, config: dict[str, Any]) -> dict[str, Any]:
    return {
        split: AiAssistedConditionalDenoiserDataset(
            manifest, split, list(config["conditionChannelOrder"]), RESOLUTION,
            require_v7_capacity_contribution=True,
            selection_contract=SELECTION_CONTRACT,
        )
        for split in ("train", "validation", "challenge", "regression")
    }


def _progress(
    execution: dict[str, Any], *, epoch: int, optimizer_step: int,
    started_monotonic: float, phase: str, loss: float | None,
) -> dict[str, Any]:
    elapsed = max(0.0, time.perf_counter() - started_monotonic)
    eta = None if epoch <= 0 else max(0.0, elapsed / epoch * (EPOCH_COUNT - epoch))
    return {
        "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-progress-v1",
        "status": "completed" if phase == "training_completed" else "running",
        "phase": phase, "packageId": execution["packageId"], "runId": execution["runId"],
        "stage": "controlled_smoke", "sampleId": SAMPLE_ID, "sampleSplit": "validation",
        "epoch": epoch, "epochTarget": EPOCH_COUNT, "batch": 1 if epoch else 0,
        "batchTarget": 1, "optimizerStep": optimizer_step,
        "optimizerStepTarget": EPOCH_COUNT,
        "percent": round(optimizer_step / EPOCH_COUNT * 100.0, 4),
        "loss": loss, "elapsedSeconds": round(elapsed, 3),
        "etaSeconds": None if eta is None else round(eta, 3),
        "updatedAtUtc": _utc_now(),
    }


def _json_scalars(value: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, item in value.items():
        if isinstance(item, bool) or item is None or isinstance(item, str):
            result[key] = item
        elif isinstance(item, torch.Tensor):
            if item.ndim != 0:
                raise ValueError(f"non-scalar metric tensor: {key}")
            number = float(item.detach().cpu())
            if not math.isfinite(number):
                raise ValueError(f"non-finite metric: {key}")
            result[key] = number
        elif isinstance(item, (int, float)):
            number = float(item)
            if not math.isfinite(number):
                raise ValueError(f"non-finite metric: {key}")
            result[key] = number
        elif isinstance(item, (list, tuple)):
            result[key] = list(item)
    return result


def _build_training_token_accounting(config: dict[str, Any]) -> dict[str, Any]:
    """Describe the exact bounded loop implemented above, not an NLP estimate."""
    width, height = RESOLUTION
    downsample = int(config["latentDownsampleFactor"])
    latent_width, latent_height = width // downsample, height // downsample
    latent_positions = latent_width * latent_height
    latent_channels = int(config["latentChannels"])
    condition_channels = int(config["conditionChannels"])
    fixed_validation_passes = len(config["training"]["fixedValidationTimesteps"])
    short = config["training"].get("shortTrajectorySupervision", {})
    short_steps = int(short.get("steps", 0)) if short.get("enabled") is True else 0
    cross = config["training"].get("stage4CrossDomainVisualConsistency", {})
    cross_steps = int(config["inferenceSteps"]) if cross.get("enabled") is True else 0
    rollout_seeds = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
    rollout_steps = rollout_seeds * int(config["inferenceSteps"])
    training_forwards = 1 + short_steps + cross_steps

    def row(epoch: int) -> dict[str, Any]:
        reproduction_rollout = rollout_steps if epoch in PREVIEW_EPOCHS else 0
        model_forwards = (
            training_forwards + fixed_validation_passes
            + rollout_steps + reproduction_rollout
        )
        decoded_frames = (
            1 + short_steps + (1 if cross_steps else 0)
            + fixed_validation_passes + rollout_seeds
            + (rollout_seeds if epoch in PREVIEW_EPOCHS else 0)
        )
        return {
            "latentSpatialTokens": model_forwards * latent_positions,
            "latentChannelValues": model_forwards * latent_positions * latent_channels,
            "conditionScalars": model_forwards * width * height * condition_channels,
            "rgbPredictionPixels": decoded_frames * width * height,
            "samplePresentations": 1,
            "optimizerSteps": 1,
            "modelForwardPasses": model_forwards,
            "validationTrajectories": 1 + rollout_seeds
            + (rollout_seeds if epoch in PREVIEW_EPOCHS else 0),
            "calculationVersion": "stage4_v2_controlled_smoke_exact_loop_v1",
        }

    per_epoch = {str(epoch): row(epoch) for epoch in range(1, EPOCH_COUNT + 1)}
    numeric_keys = (
        "latentSpatialTokens", "latentChannelValues", "conditionScalars",
        "rgbPredictionPixels", "samplePresentations", "optimizerSteps",
        "modelForwardPasses", "validationTrajectories",
    )
    totals = {
        key: sum(int(per_epoch[str(epoch)][key]) for epoch in range(1, EPOCH_COUNT + 1))
        for key in numeric_keys
    }
    totals["calculationVersion"] = "stage4_v2_controlled_smoke_exact_loop_v1"
    return {
        "schemaVersion": "ai-assisted-local-training-token-accounting-v1",
        "source": "stage4_v2_controlled_smoke_exact_program_loop",
        "localTrainingTokenUnit": (
            "one_latent_spatial_position_processed_by_one_model_sample_forward_pass"
        ),
        "isNlpToken": False,
        "externalApiUsageMeasured": False,
        "geometry": {
            "imageWidth": width, "imageHeight": height,
            "latentWidth": latent_width, "latentHeight": latent_height,
            "latentChannels": latent_channels, "conditionChannels": condition_channels,
        },
        "perEpoch": per_epoch,
        "runTotals": totals,
    }


def _canonical_sha256(value: Any) -> str:
    payload = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _resolve_bound_file(root: Path, binding: dict[str, Any]) -> Path:
    path = _project_file(root, binding["path"])
    if not path.is_file() or _sha256_file(path) != binding.get("sha256"):
        raise ValueError(f"bound file identity mismatch: {binding.get('path')}")
    return path


def _project_file(root: Path, logical_path: str) -> Path:
    candidate = (root / logical_path).resolve()
    candidate.relative_to(root)
    return candidate


def _logical(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def _binding(root: Path, path: Path) -> dict[str, Any]:
    return {
        "path": _logical(root, path), "sha256": _sha256_file(path),
        "byteSize": path.stat().st_size,
    }


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def _write_exclusive_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()


def _write_atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
    temporary.replace(path)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class _ResourceTelemetry:
    """Persist 10-second process/GPU telemetry without changing training math."""

    def __init__(self, path: Path, execution: dict[str, Any], device: torch.device):
        self.path = path
        self.execution = execution
        self.device = device
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.rows: list[dict[str, Any]] = []
        self.phase = "initializing"
        self.epoch = 0
        self.optimizer_step = 0
        self.thread = threading.Thread(target=self._run, name="stage4-v2-smoke-telemetry", daemon=True)

    def start(self) -> None:
        self.sample_now()
        self.thread.start()

    def update(self, *, phase: str, epoch: int, optimizer_step: int) -> None:
        with self.lock:
            self.phase = phase
            self.epoch = epoch
            self.optimizer_step = optimizer_step

    def sample_now(self) -> None:
        try:
            utilization, device_memory_used_mib = _nvidia_smi_sample()
            with self.lock:
                row = {
                    "recordedAtUtc": _utc_now(),
                    "phase": self.phase,
                    "epoch": self.epoch,
                    "optimizerStep": self.optimizer_step,
                    "gpuUtilizationPercent": utilization,
                    "deviceMemoryUsedMiB": device_memory_used_mib,
                    "deviceMemoryUsedBytes": (
                        None if device_memory_used_mib is None
                        else int(device_memory_used_mib) * 1024 * 1024
                    ),
                    "processMemoryAllocatedBytes": int(torch.cuda.memory_allocated(self.device)),
                    "processMemoryReservedBytes": int(torch.cuda.memory_reserved(self.device)),
                    "processPeakGpuMemoryBytes": int(torch.cuda.max_memory_allocated(self.device)),
                }
                self.rows.append(row)
                payload = self._payload("recording")
                _write_atomic_json(self.path, payload)
        except Exception as error:
            with self.lock:
                self.rows.append({
                    "recordedAtUtc": _utc_now(), "phase": self.phase,
                    "epoch": self.epoch, "optimizerStep": self.optimizer_step,
                    "telemetryError": str(error),
                })
                payload = self._payload("recording_with_sample_error")
                _write_atomic_json(self.path, payload)

    def stop(self, root: Path) -> dict[str, Any]:
        self.stop_event.set()
        self.thread.join(timeout=15.0)
        self.sample_now()
        with self.lock:
            payload = self._payload("completed")
        _write_atomic_json(self.path, payload)
        return _binding(root, self.path)

    def _run(self) -> None:
        while not self.stop_event.wait(10.0):
            self.sample_now()

    def _payload(self, status: str) -> dict[str, Any]:
        peaks = [
            int(row["processPeakGpuMemoryBytes"])
            for row in self.rows if "processPeakGpuMemoryBytes" in row
        ]
        return {
            "schemaVersion": "ai-painter-stage4-v2-controlled-smoke-resource-telemetry-v1",
            "status": status,
            "packageId": self.execution["packageId"],
            "runId": self.execution["runId"],
            "samplingIntervalSeconds": 10,
            "peakGpuMemoryBytes": max(peaks, default=0),
            "programPeakGpuMemoryBytes": max(peaks, default=0),
            "preflightMemoryClaimedAsTrainingPeak": False,
            "records": deepcopy(self.rows),
        }


def _nvidia_smi_sample() -> tuple[int | None, int | None]:
    result = subprocess.run(
        [
            "nvidia-smi", "--query-gpu=utilization.gpu,memory.used",
            "--format=csv,noheader,nounits", "--id=0",
        ],
        check=False, capture_output=True, text=True, timeout=5,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"nvidia-smi telemetry failed with exit code {result.returncode}: "
            f"{result.stderr.strip()}"
        )
    rows = result.stdout.strip().splitlines()
    if len(rows) != 1:
        raise RuntimeError("nvidia-smi telemetry did not return exactly one GPU row")
    first = rows[0].split(",")
    if len(first) != 2:
        raise RuntimeError("nvidia-smi telemetry row has an invalid field count")
    utilization = int(first[0].strip())
    device_memory_used_mib = int(first[1].strip())
    if not 0 <= utilization <= 100 or device_memory_used_mib < 0:
        raise RuntimeError("nvidia-smi telemetry values are outside the formal range")
    return utilization, device_memory_used_mib

from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import random
import time
from copy import deepcopy

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import (
    add_noise,
    build_complete_world_system,
    deterministic_velocity_step,
    inference_timesteps,
    recover_from_velocity,
    velocity_target,
)
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter.complete_world.live_progress import (
    build_live_progress,
    write_json_atomic,
)


OWNERSHIP = "project_owned_architecture_ai_assisted_cold_start_weights"
POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"
V7_ACTIVE_TRAINING_AUTHORIZATION_STATUS = "owner_authorized_active_mvp64_gpu_training"
V7_TRAINING_AUTHORIZATION_ID = "owner-approved-v7-mvp64-local-gpu-training-activation-20260802"
V7_TRAINING_AUTHORIZATION_REQUEST_ID = "owner-action-request-v7-mvp64-gpu-training-activation-resolution-20260802"
V7_TRAINING_AUTHORIZATION_COMMAND_REF = "owner-approved-v7-mvp64-local-gpu-training-activation-20260802"
V7_TRAINING_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-gpu-training-activation-resolution-20260802/request.json"
V7_DATASET_REPAIR_AUTHORIZATION_ID = "owner-action-request-v7-mvp64-training-sample-binding-repair-retrain-resolution-20260802"
V7_DATASET_REPAIR_AUTHORIZATION_COMMAND_REF = "owner-approved-v7-mvp64-training-sample-binding-repair-retrain-20260802"
V7_DATASET_REPAIR_AUTHORIZATION_SCOPE = "v7_dataset_binding_repair_cpu_regression_smoke_stage_0_1_2_only"
V7_DATASET_REPAIR_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-training-sample-binding-repair-retrain-resolution-20260802/request.json"
V7_DATASET_REPAIR_AUTHORIZATION_SHA256 = "3ecebd96908852b3888a7327a40b3cb38b2f0a5a6f9b3b6ddbd2f67aa4db554e"
V7_REPAIR_R1_AUTHORIZATION_STATUS = "owner_authorized_bounded_repair_r1_single_stage0_smoke"
V7_REPAIR_R1_AUTHORIZATION_ID = "owner-action-request-v7-bounded-repair-r1-resolution-20260802"
V7_REPAIR_R1_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-bounded-repair-r1-diagnostics-implementation-single-stage0-smoke-20260802"
V7_REPAIR_R1_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r1-resolution-20260802/request.json"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_STATUS = "owner_authorized_v7_repair_r1_full_training"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_ID = "owner-action-request-v7-repair-r1-full-training-resolution-20260802"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-repair-r1-full-stage0-stage1-stage2-training-20260802"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_SCOPE = "v7_repair_r1_full_stage0_stage1_stage2_training_only"
V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-repair-r1-full-training-resolution-20260802/request.json"
V7_REPAIR_R2_AUTHORIZATION_STATUS = "owner_authorized_v7_repair_r2_single_sample_overfit_smoke"
V7_REPAIR_R2_AUTHORIZATION_ID = "owner-action-request-v7-bounded-repair-r2-resolution-20260803"
V7_REPAIR_R2_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-bounded-repair-r2-single-sample-overfit-smoke-20260803"
V7_REPAIR_R2_AUTHORIZATION_SCOPE = "v7_r2_timestep_short_trajectory_preview_gate_object_audit_single_sample_overfit_smoke_only"
V7_REPAIR_R2_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r2-resolution-20260803/request.json"
V7_REPAIR_R2_AUTHORIZATION_SHA256 = "a57cb2fb67d561754fcd5ccf51d03ed6b29494f559c28b127b9197596cd7b311"
V7_REPAIR_R2_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r2-resolution-20260803/r2-authorization-consumption.json"
V7_REPAIR_R2_CONSUMPTION_SHA256 = "f8f9620483888cf405692918e289f655721dff1029067c6d75ab69d24c78f9e1"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r3_single_sample_overfit_smoke"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r3-run-registration-fix-retry-20260804"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r3-run-registration-fix-one-random-init-smoke-retry-20260804"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_SCOPE = "v7_r3_run_registration_directory_fix_and_one_random_init_smoke_retry_only"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r3-run-registration-fix-retry-20260804/request.json"
V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256 = "5aa799eeb314e2ac6352603233712ae595ddec81707fb71c5b2bdd0f03bee83b"
V7_REPAIR_R3_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r3-run-registration-fix-retry-20260804/authorization-consumption.json"
V7_REPAIR_R3_SMOKE_CONSUMPTION_SHA256 = "e4fa80e91dbc9897a49a3100b6f9629b61a20e723a74cbc20042388d4fccc3c2"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r4_single_sample_overfit_smoke"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r4-single-sample-gpu-smoke-20260804"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-one-v7-r4-single-sample-gpu-overfit-smoke-20260804"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_SCOPE = "one_v7_r4_random_init_single_sample_gpu_overfit_smoke_with_preview_review_and_terminal_only"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r4-single-sample-gpu-smoke-20260804/request.json"
V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256 = "02a147ab7c3f47595abcdd6f61456b5d7339914585b86fd5a37b405beff2b782"
V7_REPAIR_R4_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r4-single-sample-gpu-smoke-20260804/authorization-consumption.json"
V7_REPAIR_R4_SMOKE_CONSUMPTION_SHA256 = "62f3a190a04f01e2c75a55eec5c6fc6e70df151a55e217ddef8451a284f2a6de"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS = "owner_authorized_v7_r5_single_sample_overfit_smoke"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID = "owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF = "owner-authorized-v7-r5-stage3-condition-evidence-serialization-fix-and-one-checkpoint-smoke-retry-20260804"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE = "r5_stage3_condition_evidence_non_scalar_image_tensor_serialization_fix_cpu_regression_and_one_same_checkpoint_gpu_smoke_retry_only"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804/request.json"
V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256 = "df0de715098933533468668776573cfa88abc17ec0716e4883e005baf7782708"
V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804/authorization-consumption.json"
V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256 = "10873531ed7e9804b9cdc76fde78f7ecc4faf764a4626b277d70373a3f1aea6a"
V7_MVP64_SPLIT_COUNTS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}


def main() -> int:
    parser = ArgumentParser(description="Train the project-owned 23-channel conditional complete-world denoiser.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--autoencoder-checkpoint", type=Path, required=True)
    parser.add_argument("--initial-denoiser-checkpoint", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--resolution-stage", type=int, default=0)
    parser.add_argument("--smoke-test", action="store_true")
    parser.add_argument("--single-sample-overfit-smoke", action="store_true")
    parser.add_argument("--overfit-sample-id")
    parser.add_argument("--overfit-epochs", type=int)
    parser.add_argument("--overfit-evaluation-interval", type=int, default=10)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()

    config = read_json(args.config)
    package = read_json(args.dataset_package)
    validate_training_inputs(config, package)
    if config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r3_candidate":
        training = config["training"]
        if args.single_sample_overfit_smoke is not True:
            raise ValueError("V7 R3 authorization permits only single-sample overfit smoke")
        if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("V7 R3 authorized overfit sample identity does not match")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("V7 R3 random-initialization Smoke forbids a parent checkpoint")
        if training.get("authorizedInitialization") != "project_random_multiscale_denoiser":
            raise ValueError("V7 R3 authorized initialization contract is invalid")
    if config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r4_candidate":
        training = config["training"]
        if args.single_sample_overfit_smoke is not True:
            raise ValueError("V7 R4 authorization permits only single-sample overfit smoke")
        if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("V7 R4 authorized overfit sample identity does not match")
        if args.initial_denoiser_checkpoint is not None:
            raise ValueError("V7 R4 random-initialization Smoke forbids a parent checkpoint")
        if training.get("authorizedInitialization") != "project_random_multiscale_denoiser":
            raise ValueError("V7 R4 authorized initialization contract is invalid")
        smoke_contract = training.get("r4SmokeCandidateContract", {})
        if int(args.overfit_epochs or 0) != int(smoke_contract.get("plannedEpochs", 0)):
            raise ValueError("V7 R4 authorized Smoke epoch count does not match")
        if int(args.overfit_evaluation_interval) != int(smoke_contract.get("plannedEvaluationInterval", 0)):
            raise ValueError("V7 R4 authorized Smoke evaluation interval does not match")
    if config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate":
        training = config["training"]
        continuation = training.get("r5Stage3CheckpointContinuation") or training.get("r5CheckpointContinuation", {})
        if args.single_sample_overfit_smoke is not True:
            raise ValueError("V7 R5 authorization permits only single-sample overfit smoke")
        if args.overfit_sample_id != training.get("authorizedOverfitSampleId"):
            raise ValueError("V7 R5 authorized overfit sample identity does not match")
        if args.initial_denoiser_checkpoint is None:
            raise ValueError("V7 R5 Smoke requires the bound parent checkpoint")
        if project_path(args.initial_denoiser_checkpoint) != continuation.get("sourceCheckpointPath"):
            raise ValueError("V7 R5 parent checkpoint path does not match the bound source")
        expected_initialization = (
            "project_r5_single_sample_checkpoint_continuation"
            if training.get("r5Stage3CheckpointContinuation")
            else "project_r4_single_sample_checkpoint_continuation"
        )
        if training.get("authorizedInitialization") != expected_initialization:
            raise ValueError("V7 R5 authorized checkpoint continuation identity is invalid")
        if int(args.overfit_epochs or 0) != int(training.get("denoiserEpochs", 0)):
            raise ValueError("V7 R5 authorized Smoke epoch count does not match")
        if int(args.overfit_evaluation_interval) != int(training.get("smokeStabilityGate", {}).get("evaluationInterval", 0)):
            raise ValueError("V7 R5 authorized Smoke evaluation interval does not match")
    if args.resolution_stage < 0 or args.resolution_stage >= len(config["training"]["resolutionStages"]):
        raise ValueError("resolution stage is outside the configured progressive stages")
    stage = config["training"]["resolutionStages"][args.resolution_stage]
    image_size = (int(stage["width"]), int(stage["height"]))
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            args.dataset_package,
            split,
            list(config["conditionChannelOrder"]),
            image_size,
            require_v7_capacity_contribution=is_v7(config),
        )
        for split in ("train", "validation", "challenge", "regression")
    }
    dataset_binding_evidence = (
        validate_loaded_v7_datasets(datasets)
        if is_v7(config)
        else {
            "selectionMode": "current_condition_identity",
            "actualLoadedConditionalSampleCount": sum(len(dataset) for dataset in datasets.values()),
            "actualSplitCounts": {split: len(dataset) for split, dataset in datasets.items()},
        }
    )
    overfit_evidence = build_single_sample_overfit_evidence(datasets, args)
    if args.preflight_only:
        print(json.dumps({
            "status": "conditional_denoiser_python_preflight_passed",
            "modelId": config["modelId"],
            "architectureVersion": config["architectureVersion"],
            "resolutionStage": stage,
            "datasetPackageId": package["packageId"],
            **dataset_binding_evidence,
            "gpuStarted": False,
            "checkpointCreated": False,
            "formalInferenceEligible": False,
            "singleSampleOverfitSmoke": overfit_evidence,
        }, ensure_ascii=False, indent=2))
        return 0

    seed = int(config["training"]["seed"])
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    started_at = utc_now()
    started_at_shanghai = asia_shanghai_now()
    started = time.perf_counter()
    optimization_datasets = build_optimization_datasets(datasets, overfit_evidence)
    loaders = {
        split: torch.utils.data.DataLoader(
            dataset,
            batch_size=int(config["training"]["batchSize"]),
            shuffle=split == "train",
            num_workers=0,
        )
        for split, dataset in optimization_datasets.items()
    }

    model = build_complete_world_system(config).to(device)
    autoencoder_checkpoint = load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    model.autoencoder.load_state_dict(autoencoder_checkpoint["autoencoderState"])
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    denoiser_initialization = "project_random_multiscale_denoiser"
    parent_denoiser_checkpoint = None
    r5_checkpoint_continuation = config.get("training", {}).get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate"
    if r5_checkpoint_continuation:
        if args.resolution_stage != 0 or args.initial_denoiser_checkpoint is None:
            raise ValueError("V7 R5 checkpoint continuation is restricted to the Stage 0 single-sample Smoke")
        parent_denoiser_checkpoint = load_r5_continuation_checkpoint(args.initial_denoiser_checkpoint, config, package)
        model.denoiser.load_state_dict(parent_denoiser_checkpoint["denoiserState"])
        denoiser_initialization = (
            "project_r5_single_sample_checkpoint_continuation"
            if config.get("training", {}).get("r5Stage3CheckpointContinuation")
            else "project_r4_single_sample_checkpoint_continuation"
        )
    elif args.resolution_stage > 0:
        if args.initial_denoiser_checkpoint is None:
            raise ValueError("progressive denoiser stage requires the previous denoiser checkpoint")
        parent_denoiser_checkpoint = load_denoiser_checkpoint(args.initial_denoiser_checkpoint, config, package, args.resolution_stage)
        model.denoiser.load_state_dict(parent_denoiser_checkpoint["denoiserState"])
        denoiser_initialization = "project_denoiser_checkpoint_resume"
    elif args.initial_denoiser_checkpoint is not None:
        raise ValueError("conditional denoiser stage 0 must start from project random initialization")

    latent_normalization = (
        load_latent_normalization(parent_denoiser_checkpoint, device)
        if parent_denoiser_checkpoint
        else compute_latent_normalization(model, datasets["train"], device)
    )
    diffusion = build_diffusion_schedule(config, device)
    optimizer = torch.optim.AdamW(model.denoiser.parameters(), lr=float(config["training"]["denoiserLearningRate"]))
    epoch_count = (
        int(args.overfit_epochs)
        if args.single_sample_overfit_smoke
        else (1 if args.smoke_test else int(config["training"]["denoiserEpochs"]))
    )
    if epoch_count < 1:
        raise ValueError("overfit epoch count must be positive")
    run_is_smoke = args.smoke_test or args.single_sample_overfit_smoke
    max_train_batches = 1 if args.smoke_test else None
    timestep_coverage = build_timestep_coverage_evidence(
        config,
        epoch_count,
        len(loaders["train"]),
        int(config["training"]["batchSize"]),
    )
    evaluation_epoch_count = (
        len({1, epoch_count, *range(int(args.overfit_evaluation_interval), epoch_count + 1, int(args.overfit_evaluation_interval))})
        if args.single_sample_overfit_smoke
        else epoch_count
    )
    training_token_accounting = build_training_token_accounting(
        config,
        optimization_datasets,
        stage,
        epoch_count,
        run_is_smoke,
        parent_denoiser_checkpoint is None,
        evaluation_epoch_count,
    )
    metrics = []
    best_validation_loss = float("inf")
    best_epoch = None
    best_denoiser_state = None
    batch_target = min(len(loaders["train"]), max_train_batches) if max_train_batches is not None else len(loaders["train"])
    path_replay_passes = r5_path_replay_passes_per_epoch(config)
    optimizer_steps_per_batch = 1 + path_replay_passes
    optimizer_step_target = epoch_count * batch_target * optimizer_steps_per_batch
    train_samples_target_per_epoch = min(
        len(optimization_datasets["train"]),
        batch_target * int(config["training"]["batchSize"]),
    )
    trajectory_steps_per_sample = (
        int(config["training"].get("shortTrajectorySupervision", {}).get("steps", 0))
        if config["training"].get("shortTrajectorySupervision", {}).get("enabled") is True
        else 0
    )
    latent_spatial_positions = (
        int(stage["width"]) // int(config["latentDownsampleFactor"])
    ) * (
        int(stage["height"]) // int(config["latentDownsampleFactor"])
    )
    latest_live_progress = build_live_progress(
        phase="initializing",
        epoch=0,
        epoch_target=epoch_count,
        batch=0,
        batch_target=batch_target,
        optimizer_step=0,
        optimizer_step_target=optimizer_step_target,
        started_monotonic=started,
        local_denoiser_sample_forward_passes=0,
        local_training_token_count=0,
    )
    last_progress_write_monotonic = 0.0

    def persist_live_progress(progress, force=False):
        nonlocal latest_live_progress, last_progress_write_monotonic
        latest_live_progress = progress
        now_monotonic = time.perf_counter()
        if not force and now_monotonic - last_progress_write_monotonic < 0.5:
            return
        write_progress(
            args.output_dir,
            config,
            package,
            stage,
            started_at,
            started_at_shanghai,
            None,
            metrics,
            "running" if progress["phase"] != "initializing" else "starting",
            run_is_smoke,
            live_progress=progress,
        )
        last_progress_write_monotonic = now_monotonic

    persist_live_progress(latest_live_progress, force=True)

    model.denoiser.train()
    for epoch in range(epoch_count):
        def on_batch_progress(batch_progress):
            optimizer_step = (
                epoch * batch_target * optimizer_steps_per_batch
                + batch_progress["optimizerStepsCompletedInEpoch"]
            )
            completed_training_samples = (
                epoch * train_samples_target_per_epoch
                + batch_progress["samplesProcessedInEpoch"]
            )
            local_denoiser_sample_forward_passes = completed_training_samples * (
                1 + trajectory_steps_per_sample
            ) * optimizer_steps_per_batch
            persist_live_progress(build_live_progress(
                phase="training_batch",
                epoch=epoch + 1,
                epoch_target=epoch_count,
                batch=batch_progress["batch"],
                batch_target=batch_target,
                optimizer_step=optimizer_step,
                optimizer_step_target=optimizer_step_target,
                started_monotonic=started,
                batch_loss=batch_progress["batchLoss"],
                rolling_epoch_loss=batch_progress["rollingEpochLoss"],
                last_batch_duration_seconds=batch_progress["lastBatchDurationSeconds"],
                samples_in_batch=batch_progress["samplesInBatch"],
                local_denoiser_sample_forward_passes=local_denoiser_sample_forward_passes,
                local_training_token_count=local_denoiser_sample_forward_passes * latent_spatial_positions,
            ), force=batch_progress["batch"] == batch_target)

        train_metrics = train_epoch(
            model,
            loaders["train"],
            optimizer,
            diffusion,
            latent_normalization,
            device,
            config,
            epoch,
            max_train_batches,
            on_batch_progress,
        )
        evaluate_this_epoch = (
            not args.single_sample_overfit_smoke
            or epoch == 0
            or epoch + 1 == epoch_count
            or (epoch + 1) % int(args.overfit_evaluation_interval) == 0
        )
        if not evaluate_this_epoch:
            row = {
                "stage": "ai_assisted_23_channel_conditional_denoiser",
                "epoch": epoch + 1,
                "recordedAtUtc": utc_now(),
                "recordedAtAsiaShanghai": asia_shanghai_now(),
                "trainCompositeLoss": train_metrics["compositeLoss"],
                "trainVelocityPredictionLoss": train_metrics["velocityPredictionMse"],
                "trainCleanLatentMae": train_metrics["cleanLatentMae"],
                "validationSkippedForBoundedOverfitSmoke": True,
                "bestCheckpointUpdated": False,
                "tokenAccounting": training_token_accounting["perEpoch"],
            }
            for key, value in train_metrics.items():
                if key not in {"compositeLoss", "velocityPredictionMse", "cleanLatentMae"}:
                    row[f"train{upper_camel(key)}"] = value
            metrics.append(row)
            latest_live_progress = build_live_progress(
                phase="epoch_completed",
                epoch=epoch + 1,
                epoch_target=epoch_count,
                batch=batch_target,
                batch_target=batch_target,
                optimizer_step=(epoch + 1) * batch_target * optimizer_steps_per_batch,
                optimizer_step_target=optimizer_step_target,
                started_monotonic=started,
                batch_loss=latest_live_progress.get("batchLoss"),
                rolling_epoch_loss=train_metrics["compositeLoss"],
                local_denoiser_sample_forward_passes=latest_live_progress.get("localDenoiserSampleForwardPasses"),
                local_training_token_count=latest_live_progress.get("localTrainingTokenCount"),
            )
            write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, "running", True, live_progress=latest_live_progress)
            continue
        latest_live_progress = build_live_progress(
            phase="validating_epoch",
            epoch=epoch + 1,
            epoch_target=epoch_count,
            batch=batch_target,
            batch_target=batch_target,
            optimizer_step=(epoch + 1) * batch_target * optimizer_steps_per_batch,
            optimizer_step_target=optimizer_step_target,
            started_monotonic=started,
            batch_loss=latest_live_progress.get("batchLoss"),
            rolling_epoch_loss=train_metrics["compositeLoss"],
            local_denoiser_sample_forward_passes=latest_live_progress.get("localDenoiserSampleForwardPasses"),
            local_training_token_count=latest_live_progress.get("localTrainingTokenCount"),
        )
        persist_live_progress(latest_live_progress, force=True)
        validation = evaluate_velocity_prediction(
            model,
            loaders["validation"],
            diffusion,
            latent_normalization,
            device,
            seed + 1000,
            list(config["training"]["fixedValidationTimesteps"]),
            config,
        )
        validation_loss = validation["compositeConditionQualityScore"]
        rollout_validation = None
        if is_v7(config):
            rollout_validation = evaluate_deterministic_rollout_rgb_quality_v7(
                model,
                optimization_datasets["validation"],
                diffusion,
                latent_normalization,
                device,
                seed + 3000,
                config,
                args.output_dir / "fixed-epoch-previews",
                epoch + 1,
            )
            validation_loss += (
                rollout_validation["rolloutRgbQualityScore"]
                * float(config["training"].get("checkpointRolloutWeight", 1.0))
            )
        elif is_v6(config):
            rollout_validation = evaluate_deterministic_rollout_rgb_quality(
                model,
                datasets["validation"],
                diffusion,
                latent_normalization,
                device,
                seed + 3000,
                config,
            )
            validation_loss += (
                rollout_validation["rolloutRgbQualityScore"]
                * float(config["training"].get("checkpointRolloutWeight", 1.0))
            )
        row = {
            "stage": "ai_assisted_23_channel_conditional_denoiser",
            "epoch": epoch + 1,
            "recordedAtUtc": utc_now(),
            "recordedAtAsiaShanghai": asia_shanghai_now(),
            "trainCompositeLoss": train_metrics["compositeLoss"],
            "trainVelocityPredictionLoss": train_metrics["velocityPredictionMse"],
            "trainCleanLatentMae": train_metrics["cleanLatentMae"],
            "validationFixedGridCompositeConditionQualityScore": validation["compositeConditionQualityScore"],
            "validationFixedGridVelocityLoss": validation["velocityPredictionMse"],
            "validationFixedGridCleanLatentMae": validation["cleanLatentMae"],
            "validationCheckpointSelectionScore": validation_loss,
            "tokenAccounting": training_token_accounting["perEpoch"],
        }
        if rollout_validation:
            row.update({f"validation{upper_camel(key)}": value for key, value in rollout_validation.items()})
        for key, value in train_metrics.items():
            if key not in {"compositeLoss", "velocityPredictionMse", "cleanLatentMae"}:
                row[f"train{upper_camel(key)}"] = value
        for key, value in validation.items():
            if key not in {"compositeConditionQualityScore", "velocityPredictionMse", "cleanLatentMae", "fixedTimesteps"}:
                row[f"validationFixedGrid{upper_camel(key)}"] = value
        if validation_loss < best_validation_loss:
            best_validation_loss = validation_loss
            best_epoch = epoch + 1
            best_denoiser_state = deepcopy({key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()})
            row["bestCheckpointUpdated"] = True
        else:
            row["bestCheckpointUpdated"] = False
        metrics.append(row)
        latest_live_progress = build_live_progress(
            phase="epoch_completed",
            epoch=epoch + 1,
            epoch_target=epoch_count,
            batch=batch_target,
            batch_target=batch_target,
            optimizer_step=(epoch + 1) * batch_target * optimizer_steps_per_batch,
            optimizer_step_target=optimizer_step_target,
            started_monotonic=started,
            batch_loss=latest_live_progress.get("batchLoss"),
            rolling_epoch_loss=train_metrics["compositeLoss"],
            validation_score=validation["compositeConditionQualityScore"],
            checkpoint_score=validation_loss,
            local_denoiser_sample_forward_passes=latest_live_progress.get("localDenoiserSampleForwardPasses"),
            local_training_token_count=latest_live_progress.get("localTrainingTokenCount"),
        )
        write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, "running", run_is_smoke, live_progress=latest_live_progress)

    if best_denoiser_state is None:
        raise ValueError("fixed validation did not produce a selectable checkpoint")
    model.denoiser.load_state_dict(best_denoiser_state)

    split_metrics = {}
    for index, split in enumerate(datasets):
        if args.single_sample_overfit_smoke and split != "validation":
            split_metrics[split] = {
                "sampleCount": len(datasets[split]),
                "status": "not_read_by_nonformal_single_sample_overfit_smoke",
                "metricsReadDuringTraining": False,
            }
            continue
        if is_v6_or_later(config) and split == config["training"].get("strictHeldOutInferenceSplit"):
            split_metrics[split] = {
                "sampleCount": len(datasets[split]),
                "status": "reserved_for_post_training_held_out_inference",
                "metricsReadDuringTraining": False,
            }
            continue
        split_metrics[split] = {
            "sampleCount": len(optimization_datasets[split]),
            **evaluate_velocity_prediction(
                model,
                loaders[split],
                diffusion,
                latent_normalization,
                device,
                seed + 2000 + index,
                list(config["training"]["fixedValidationTimesteps"]),
                config,
            ),
        }
    condition_evidence = save_condition_evidence(
        model,
        optimization_datasets,
        diffusion,
        latent_normalization,
        device,
        seed,
        args.output_dir / "condition-evidence.json",
        config,
    )

    checkpoint_path = args.output_dir / "complete-world-ai-assisted-conditional-denoiser.pt"
    checkpoint = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "ownership": OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": POLICY_VERSION,
        "initialization": f"project_autoencoder_checkpoint_plus_{denoiser_initialization}",
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "architectureVersion": config.get("architectureVersion"),
        "modelConfig": config,
        "datasetPackageId": package["packageId"],
        "datasetBindingEvidence": dataset_binding_evidence,
        "actualLoadedConditionalSampleCount": dataset_binding_evidence["actualLoadedConditionalSampleCount"],
        "actualLoadedV7CapacityCount": dataset_binding_evidence.get("actualLoadedV7CapacityCount"),
        "actualLoadedSplitCounts": dataset_binding_evidence["actualSplitCounts"],
        "trainingTokenAccounting": training_token_accounting,
        "trainingStage": "conditional_denoiser_single_sample_overfit_smoke" if args.single_sample_overfit_smoke else ("conditional_denoiser_smoke_test" if args.smoke_test else "conditional_denoiser_training"),
        "denoiserTrained": not args.smoke_test and not args.single_sample_overfit_smoke,
        "programValidated": True,
        "formalInferenceEligible": False,
        "resolutionStage": stage,
        "seed": seed,
        "parentDenoiserCheckpointPath": project_path(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "parentDenoiserCheckpointSha256": sha256_file(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "predictionTarget": config["predictionTarget"],
        "latentNormalization": serialize_latent_normalization(latent_normalization),
        "bestCheckpointMetric": config["training"]["bestCheckpointMetric"],
        "bestEpoch": best_epoch,
        "bestValidationMetric": best_validation_loss,
        "denoiserLossVersion": config["training"]["denoiserLossVersion"],
        "denoiserLossWeights": config["training"]["denoiserLossWeights"],
        "bestCheckpointMetricWeights": config["training"]["bestCheckpointMetricWeights"],
        "singleSampleOverfitSmoke": overfit_evidence,
        "timestepCoverage": timestep_coverage,
        "conditionResizeContract": config["conditionResizeContract"],
        "autoencoderState": {key: value.detach().cpu() for key, value in model.autoencoder.state_dict().items()},
        "denoiserState": {key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()},
    }
    torch.save(checkpoint, checkpoint_path)

    created_at = utc_now()
    manifest = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "status": "conditional_denoiser_single_sample_overfit_smoke_completed" if args.single_sample_overfit_smoke else ("conditional_denoiser_program_smoke_test_passed" if args.smoke_test else "conditional_denoiser_training_completed_pending_validation"),
        "createdAtUtc": created_at,
        "createdAtAsiaShanghai": asia_shanghai_now(),
        "ownership": OWNERSHIP,
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": POLICY_VERSION,
        "initialization": f"project_autoencoder_checkpoint_plus_{denoiser_initialization}",
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "architectureVersion": config.get("architectureVersion"),
        "configPath": project_path(args.config),
        "configSha256": sha256_file(args.config),
        "datasetPackageId": package["packageId"],
        "datasetManifestPath": project_path(args.dataset_package),
        "datasetManifestSha256": sha256_file(args.dataset_package),
        "sourceIndexPath": package["sourceIndexPath"],
        "sourceIndexSha256": sha256_file(Path.cwd() / package["sourceIndexPath"]),
        "connectivityCoverage": package["connectivityCoverage"],
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": sha256_file(checkpoint_path),
        "autoencoderCheckpointPath": project_path(args.autoencoder_checkpoint),
        "autoencoderCheckpointSha256": sha256_file(args.autoencoder_checkpoint),
        "parentDenoiserCheckpointPath": project_path(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "parentDenoiserCheckpointSha256": sha256_file(args.initial_denoiser_checkpoint) if args.initial_denoiser_checkpoint else None,
        "trainingStage": checkpoint["trainingStage"],
        "denoiserTrained": checkpoint["denoiserTrained"],
        "programValidated": True,
        "formalInferenceEligible": False,
        "conditionChannels": int(config["conditionChannels"]),
        "conditionChannelOrder": list(config["conditionChannelOrder"]),
        "conditionBoundSampleCount": sum(len(dataset) for dataset in datasets.values()),
        "datasetBindingEvidence": dataset_binding_evidence,
        "actualLoadedConditionalSampleCount": dataset_binding_evidence["actualLoadedConditionalSampleCount"],
        "actualLoadedV7CapacityCount": dataset_binding_evidence.get("actualLoadedV7CapacityCount"),
        "actualLoadedSplitCounts": dataset_binding_evidence["actualSplitCounts"],
        "trainingTokenAccounting": training_token_accounting,
        "singleSampleOverfitSmoke": overfit_evidence,
        "timestepCoverage": timestep_coverage,
        "resolutionStage": stage,
        "seed": seed,
        "splitMetrics": split_metrics,
        "conditionEvidencePath": project_path(args.output_dir / "condition-evidence.json"),
        "conditionEvidenceSha256": sha256_file(args.output_dir / "condition-evidence.json"),
        "conditionEvidence": condition_evidence,
        "predictionTarget": config["predictionTarget"],
        "latentNormalization": checkpoint["latentNormalization"],
        "bestCheckpointMetric": checkpoint["bestCheckpointMetric"],
        "bestEpoch": best_epoch,
        "bestValidationMetric": best_validation_loss,
        "denoiserLossVersion": checkpoint["denoiserLossVersion"],
        "denoiserLossWeights": checkpoint["denoiserLossWeights"],
        "bestCheckpointMetricWeights": checkpoint["bestCheckpointMetricWeights"],
        "conditionResizeContract": checkpoint["conditionResizeContract"],
        "diffusionSchedule": {
            "type": "linear_beta_v1",
            "steps": int(config["diffusionSteps"]),
            "betaStart": diffusion["betaStart"],
            "betaEnd": diffusion["betaEnd"],
            "predictionTarget": "velocity_v1",
        },
        "remainingBlockers": [
            "conditional_denoiser_full_training_missing" if (args.smoke_test or args.single_sample_overfit_smoke) else "conditional_denoiser_validation_pending",
            "formal_inference_validation_missing",
            "owner_review_missing_identity",
        ],
        "durationSeconds": round(time.perf_counter() - started, 3),
        "device": str(device),
        "metrics": metrics,
        "automaticStorage": True,
    }
    manifest_path = args.output_dir / "manifest.json"
    write_json(manifest_path, manifest)
    completed_live_progress = build_live_progress(
        phase="completed",
        epoch=epoch_count,
        epoch_target=epoch_count,
        batch=batch_target,
        batch_target=batch_target,
        optimizer_step=optimizer_step_target,
        optimizer_step_target=optimizer_step_target,
        started_monotonic=started,
        rolling_epoch_loss=metrics[-1]["trainCompositeLoss"] if metrics else None,
        validation_score=metrics[-1].get("validationFixedGridCompositeConditionQualityScore") if metrics else None,
        checkpoint_score=metrics[-1].get("validationCheckpointSelectionScore") if metrics else None,
        local_denoiser_sample_forward_passes=epoch_count * train_samples_target_per_epoch * (1 + trajectory_steps_per_sample),
        local_training_token_count=epoch_count * train_samples_target_per_epoch * (1 + trajectory_steps_per_sample) * latent_spatial_positions,
    )
    write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, None, metrics, "completed", run_is_smoke, manifest, completed_live_progress)
    print(json.dumps({**manifest, "manifestPath": project_path(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


def build_single_sample_overfit_evidence(datasets, args):
    if not args.single_sample_overfit_smoke:
        return {
            "enabled": False,
            "nonFormal": False,
        }
    if args.smoke_test:
        raise ValueError("single-sample overfit smoke and program smoke-test are mutually exclusive")
    rows = datasets["train"].rows
    selected_index = 0
    if args.overfit_sample_id:
        matches = [index for index, row in enumerate(rows) if row.get("sampleId") == args.overfit_sample_id]
        if len(matches) != 1:
            raise ValueError("single-sample overfit sample id must match exactly one train row")
        selected_index = matches[0]
    row = rows[selected_index]
    return {
        "enabled": True,
        "nonFormal": True,
        "selectedSplit": "train",
        "selectedIndex": selected_index,
        "sampleId": row.get("sampleId"),
        "conditionLabel": row.get("conditionLabel"),
        "conditionPackPath": row.get("conditionPackPath"),
        "fullDatasetBindingStillRequired": True,
        "formalModelPromotionEligible": False,
    }


def build_optimization_datasets(datasets, overfit_evidence):
    if not overfit_evidence.get("enabled"):
        return datasets
    selected = torch.utils.data.Subset(datasets["train"], [int(overfit_evidence["selectedIndex"])])
    return {
        "train": selected,
        "validation": selected,
        "challenge": selected,
        "regression": selected,
    }


def build_timestep_coverage_evidence(config, epoch_count, batch_count, batch_size):
    diffusion_steps = int(config["diffusionSteps"])
    values = []
    for epoch_index in range(epoch_count):
        for batch_index in range(batch_count):
            values.extend(training_timesteps(
                config,
                epoch_index,
                batch_index,
                batch_count,
                batch_size,
                diffusion_steps,
                torch.device("cpu"),
            ).tolist())
    unique = sorted(set(int(value) for value in values))
    rollout = [int(value) for value in inference_timesteps(diffusion_steps, int(config["inferenceSteps"]), torch.device("cpu")).tolist()]
    exact_overlap = sorted(set(unique).intersection(rollout))
    nearest_gaps = [min(abs(value - trained) for trained in unique) for value in rollout] if unique else []
    return {
        "samplingContract": config.get("training", {}).get("timestepSampling", "legacy_bucket_grid"),
        "diffusionStepCount": diffusion_steps,
        "trainingPresentationCount": len(values),
        "uniqueTrainingTimestepCount": len(unique),
        "coverageRatio": len(unique) / diffusion_steps,
        "minimumTimestep": min(unique) if unique else None,
        "maximumTimestep": max(unique) if unique else None,
        "inferenceTimestepCount": len(rollout),
        "exactInferenceOverlapCount": len(exact_overlap),
        "maximumNearestInferenceGap": max(nearest_gaps) if nearest_gaps else None,
        "fullScheduleCovered": len(unique) == diffusion_steps,
    }


def validate_training_inputs(config, package):
    if config.get("ownership") != OWNERSHIP or config.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("AI-assisted model ownership or lane contract failed")
    if config.get("initialization") != "random_initialization_only" or config.get("upstreamModelIds") != []:
        raise ValueError("AI-assisted model must not declare upstream model weights")
    if config.get("thirdPartyWeightsAllowed") is not False:
        raise ValueError("third-party weights are forbidden")
    if config.get("conditionChannels") != 23 or len(config.get("conditionChannelOrder", [])) != 23:
        raise ValueError("locked 23-channel condition contract is invalid")
    channel_types = config.get("conditionChannelTypes", {})
    typed_channels = list(channel_types.get("discrete", [])) + list(channel_types.get("continuous", []))
    if config.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1":
        raise ValueError("typed condition resize contract is invalid")
    if len(typed_channels) != 23 or set(typed_channels) != set(config["conditionChannelOrder"]):
        raise ValueError("typed condition groups must cover the locked 23-channel order")
    architecture = config.get("denoiserArchitecture")
    if architecture == "multiscale_condition_unet_v4":
        if config.get("training", {}).get("denoiserLossVersion") != "velocity_clean_gradient_condition_reconstruction_v4":
            raise ValueError("V4 composite denoiser loss contract is invalid")
        if config.get("training", {}).get("bestCheckpointMetric") != "fixed_grid_composite_condition_quality_score_v4":
            raise ValueError("V4 composite checkpoint selection contract is invalid")
    elif architecture == "multiscale_condition_unet_v5":
        if config.get("conditionOutputBinding") != "predicted_clean_latent_probe_v1":
            raise ValueError("V5 output-bound condition contract is invalid")
        if config.get("training", {}).get("denoiserLossVersion") != "velocity_output_bound_condition_texture_hierarchy_v5":
            raise ValueError("V5 composite denoiser loss contract is invalid")
        if config.get("training", {}).get("bestCheckpointMetric") != "fixed_grid_output_bound_hierarchy_score_v5":
            raise ValueError("V5 checkpoint selection contract is invalid")
        if config.get("training", {}).get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V5 strict held-out split must be challenge")
    elif architecture == "multiscale_condition_unet_v6":
        training = config.get("training", {})
        if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
            raise ValueError("V6 decoded RGB output binding contract is invalid")
        if training.get("denoiserLossVersion") != "velocity_decoded_rgb_sparse_region_rollout_v6":
            raise ValueError("V6 composite denoiser loss contract is invalid")
        if training.get("bestCheckpointMetric") != "fixed_grid_plus_deterministic_rollout_rgb_score_v6":
            raise ValueError("V6 checkpoint selection contract is invalid")
        if training.get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V6 strict held-out split must be challenge")
        required_sparse = {"terrain_water", "terrain_path_ground", "terrain_shoreline", "object_footprints", "focal_area"}
        if set(training.get("sparseRgbConditionChannels", [])) != required_sparse:
            raise ValueError("V6 sparse RGB condition channels are incomplete")
        if int(training.get("checkpointRolloutSampleCount", 0)) < 1:
            raise ValueError("V6 rollout checkpoint validation must include at least one validation sample")
    elif architecture == "multiscale_condition_unet_v7":
        training = config.get("training", {})
        if config.get("conditionOutputBinding") != "predicted_clean_latent_and_decoded_rgb_v1":
            raise ValueError("V7 decoded RGB output binding contract is invalid")
        allowed_loss_versions = {"velocity_decoded_rgb_sparse_region_rollout_v7"}
        allowed_checkpoint_metrics = {"all_validation_multiseed_worst_case_semantic_rollout_score_v7"}
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r1":
            allowed_loss_versions.add("velocity_decoded_rgb_semantic_contrast_grid_boundary_v7_repair_r1")
            allowed_checkpoint_metrics.add("all_validation_multiseed_professional_semantic_rollout_score_v7_repair_r1")
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r2":
            allowed_loss_versions.add("velocity_decoded_rgb_semantic_contrast_grid_boundary_short_trajectory_v7_repair_r2")
            allowed_checkpoint_metrics.add("all_validation_multiseed_professional_semantic_rollout_score_v7_repair_r2")
            if training.get("timestepSampling") != "deterministic_full_schedule_cover_v2":
                raise ValueError("V7 R2 requires deterministic full diffusion schedule coverage")
            trajectory = training.get("shortTrajectorySupervision", {})
            if trajectory.get("enabled") is not True:
                raise ValueError("V7 R2 short trajectory supervision must be enabled")
            if int(trajectory.get("steps", 0)) < 2 or int(trajectory.get("stepGap", 0)) < 1:
                raise ValueError("V7 R2 short trajectory supervision contract is invalid")
            if float(trajectory.get("weight", 0.0)) <= 0.0:
                raise ValueError("V7 R2 short trajectory supervision weight must be positive")
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r3_candidate":
            allowed_loss_versions.add("velocity_decoded_rgb_object_channel_path_topology_short_trajectory_v7_repair_r3_candidate")
            allowed_checkpoint_metrics.add("all_validation_multiseed_object_channel_path_topology_score_v7_repair_r3_candidate")
            validate_v7_r3_candidate_contract(config)
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r4_candidate":
            allowed_loss_versions.add("velocity_decoded_rgb_object_channel_path_stability_short_trajectory_v7_repair_r4_candidate")
            allowed_checkpoint_metrics.add("all_validation_multiseed_object_channel_path_stability_score_v7_repair_r4_candidate")
            validate_v7_r4_candidate_contract(config)
        if training.get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate":
            allowed_loss_versions.add("velocity_decoded_rgb_path_replay_trajectory_stability_v7_repair_r5_candidate")
            allowed_checkpoint_metrics.add("all_validation_multiseed_path_replay_trajectory_stability_score_v7_repair_r5_candidate")
            validate_v7_r5_candidate_contract(config)
        if training.get("denoiserLossVersion") not in allowed_loss_versions:
            raise ValueError("V7 composite denoiser loss contract is invalid")
        if training.get("bestCheckpointMetric") not in allowed_checkpoint_metrics:
            raise ValueError("V7 checkpoint selection contract is invalid")
        if training.get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V7 strict held-out split must be challenge")
        if training.get("checkpointRolloutCoverage") != "all_validation_samples":
            raise ValueError("V7 checkpoint rollout must cover every validation sample")
        if int(training.get("checkpointRolloutSeedsPerSample", 0)) < 2:
            raise ValueError("V7 checkpoint rollout requires at least two deterministic seeds per validation sample")
        validate_v7_training_authorization(config, package)
        required_sparse = {"terrain_water", "terrain_path_ground", "terrain_shoreline", "object_footprints", "focal_area"}
        if set(training.get("sparseRgbConditionChannels", [])) != required_sparse:
            raise ValueError("V7 sparse RGB condition channels are incomplete")
    else:
        raise ValueError("unsupported conditional denoiser architecture")
    if package.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1":
        raise ValueError("AI-assisted dataset package schema is invalid")
    if package.get("policyVersion") != POLICY_VERSION or package.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("AI-assisted dataset policy or lane is invalid")
    if package.get("modelConfigId") != config.get("datasetPackageModelId", config.get("modelId")):
        raise ValueError("AI-assisted dataset package model config does not match")
    if package.get("canTrainConditionalDenoiser") is not True or package.get("currentConditionUnpairedCount") != 0:
        raise ValueError("AI-assisted dataset package conditional gate is not open")
    if package.get("currentConditionPairCount") != package.get("conditionOnlyBlueprintCount"):
        raise ValueError("AI-assisted dataset condition pair count is incomplete")
    coverage = package.get("connectivityCoverage", {})
    if coverage.get("thresholdMet") is not True or coverage.get("currentPositiveRecordCount") != 27 or coverage.get("currentNegativeRecordCount") != 27:
        raise ValueError("world connectivity coverage is not complete")
    if package.get("formalInferenceEligible") is not False:
        raise ValueError("conditional training package must not claim formal inference readiness")


def validate_v7_r3_candidate_contract(config):
    training = config.get("training", {})
    required_channels = {"object_footprints", "object_tree", "object_rock", "object_vegetation"}
    if set(training.get("semanticRgbConditionChannels", [])) != required_channels:
        raise ValueError("V7 R3 candidate semantic RGB condition channels are incomplete")
    channel_weights = training.get("objectSemanticChannelWeights", {})
    if set(channel_weights) != required_channels or any(float(channel_weights[name]) <= 0.0 for name in required_channels):
        raise ValueError("V7 R3 candidate object semantic channel weights are invalid")
    required_loss_weights = {"objectSemanticRgb", "pathInteriorRgb", "pathForbiddenBoundaryRgb"}
    loss_weights = training.get("denoiserLossWeights", {})
    if not required_loss_weights.issubset(loss_weights) or any(float(loss_weights[name]) <= 0.0 for name in required_loss_weights):
        raise ValueError("V7 R3 candidate topology loss weights are incomplete")
    required_rollout_weights = {
        "rolloutObjectSemanticRgbMae",
        "rolloutPathInteriorRgbMae",
        "rolloutPathForbiddenBoundaryRgbMae",
    }
    rollout_weights = training.get("rolloutCheckpointMetricWeights", {})
    if not required_rollout_weights.issubset(rollout_weights):
        raise ValueError("V7 R3 candidate rollout topology weights are incomplete")
    gate = training.get("smokeStabilityGate", {})
    if int(gate.get("requiredConsecutiveTailPasses", 0)) != 3:
        raise ValueError("V7 R3 candidate requires exactly three consecutive tail passes")
    if gate.get("requireAllMachineReviewsPassed") is not True or gate.get("preserveReviewThresholds") is not True:
        raise ValueError("V7 R3 candidate stability gate must preserve all machine review thresholds")
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    if len(tail_epochs) != 3 or tail_epochs != sorted(set(tail_epochs)):
        raise ValueError("V7 R3 candidate stability tail epochs are invalid")
    smoke_epochs = [int(value) for value in training.get("fixedEpochPreviewPolicy", {}).get("smoke", [])]
    if any(epoch not in smoke_epochs for epoch in tail_epochs):
        raise ValueError("V7 R3 candidate stability tail epochs are missing from the preview policy")
    authorization = training.get("ownerTrainingAuthorization", {})
    authorization_status = training.get("trainingAuthorizationStatus")
    if authorization_status not in {"not_authorized_candidate_only", V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS}:
        raise ValueError("V7 R3 candidate training authorization status is invalid")
    forbidden_true_flags = (
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if authorization_status == "not_authorized_candidate_only" and any(authorization.get(name) is True for name in forbidden_true_flags):
        raise ValueError("V7 R3 candidate cannot carry active execution authorization")
    return {
        "status": "r3_candidate_contract_valid",
        "semanticRgbConditionChannels": sorted(required_channels),
        "tailEpochs": tail_epochs,
        "requiredConsecutiveTailPasses": 3,
    }


def build_v7_r4_candidate_config(r3_config, candidate_proposal, path_interior_weight, path_forbidden_boundary_weight):
    if candidate_proposal.get("status") not in {
        "isolated_candidate_proposal_cpu_regression_pending_not_implemented_not_active",
        "isolated_candidate_proposal_cpu_verified_not_implemented_not_active",
    }:
        raise ValueError("V7 R4 candidate proposal status is invalid")
    proposal = candidate_proposal.get("proposal", {})
    if proposal.get("boundedRepairVersion") != "v7_bounded_repair_r4_candidate_proposal":
        raise ValueError("V7 R4 candidate proposal version is invalid")
    searches = proposal.get("pathStabilityWeightSearch", {})
    selected = {
        "pathInteriorRgb": float(path_interior_weight),
        "pathForbiddenBoundaryRgb": float(path_forbidden_boundary_weight),
    }
    for name, value in selected.items():
        contract = searches.get(name, {})
        minimum = float(contract.get("minimum", float("nan")))
        maximum = float(contract.get("maximum", float("nan")))
        if not math.isfinite(minimum) or not math.isfinite(maximum) or minimum > maximum:
            raise ValueError(f"V7 R4 candidate {name} search range is invalid")
        if not minimum <= value <= maximum:
            raise ValueError(f"V7 R4 candidate {name} selection is outside the authorized proposal range")
    config = deepcopy(r3_config)
    training = config.setdefault("training", {})
    training["boundedRepairVersion"] = "v7_bounded_repair_r4_candidate"
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["denoiserLossVersion"] = "velocity_decoded_rgb_object_channel_path_stability_short_trajectory_v7_repair_r4_candidate"
    training["bestCheckpointMetric"] = "all_validation_multiseed_object_channel_path_stability_score_v7_repair_r4_candidate"
    training["denoiserLossWeights"]["pathInteriorRgb"] = selected["pathInteriorRgb"]
    training["denoiserLossWeights"]["pathForbiddenBoundaryRgb"] = selected["pathForbiddenBoundaryRgb"]
    training["objectSemanticChannelWeights"] = deepcopy(
        proposal.get("objectSemanticStabilityProposal", {}).get("currentChannelWeights", {})
    )
    training["smokeStabilityGate"] = deepcopy(proposal.get("smokeStabilityGate", {}))
    training["r4BoundedSelectionEvidence"] = {
        "proposalVersion": proposal["boundedRepairVersion"],
        "proposalStatus": candidate_proposal["status"],
        "pathInteriorRgb": {
            "minimum": float(searches["pathInteriorRgb"]["minimum"]),
            "maximum": float(searches["pathInteriorRgb"]["maximum"]),
            "selected": selected["pathInteriorRgb"],
        },
        "pathForbiddenBoundaryRgb": {
            "minimum": float(searches["pathForbiddenBoundaryRgb"]["minimum"]),
            "maximum": float(searches["pathForbiddenBoundaryRgb"]["maximum"]),
            "selected": selected["pathForbiddenBoundaryRgb"],
        },
        "selectedObjectWeightChanges": proposal.get("objectSemanticStabilityProposal", {}).get("selectedWeightChanges"),
        "reviewThresholdPolicy": candidate_proposal.get("reviewThresholdPolicy"),
    }
    training["ownerTrainingAuthorization"] = deepcopy(proposal.get("ownerTrainingAuthorization", {}))
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r4-candidate"
    config["status"] = "isolated_r4_candidate_not_active"
    validate_v7_r4_candidate_contract(config)
    return config


def validate_v7_r4_candidate_contract(config):
    training = config.get("training", {})
    required_channels = {"object_footprints", "object_tree", "object_rock", "object_vegetation"}
    if set(training.get("semanticRgbConditionChannels", [])) != required_channels:
        raise ValueError("V7 R4 candidate semantic RGB condition channels are incomplete")
    channel_weights = training.get("objectSemanticChannelWeights", {})
    if set(channel_weights) != required_channels or any(float(channel_weights[name]) <= 0.0 for name in required_channels):
        raise ValueError("V7 R4 candidate object semantic channel weights are invalid")
    evidence = training.get("r4BoundedSelectionEvidence", {})
    if evidence.get("proposalVersion") != "v7_bounded_repair_r4_candidate_proposal":
        raise ValueError("V7 R4 bounded selection proposal identity is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged":
        raise ValueError("V7 R4 candidate cannot change machine review thresholds")
    if evidence.get("selectedObjectWeightChanges") is not None:
        raise ValueError("V7 R4 candidate cannot select object weight changes without separate authorization")
    loss_weights = training.get("denoiserLossWeights", {})
    for name in ("pathInteriorRgb", "pathForbiddenBoundaryRgb"):
        selection = evidence.get(name, {})
        minimum = float(selection.get("minimum", float("nan")))
        maximum = float(selection.get("maximum", float("nan")))
        selected = float(selection.get("selected", float("nan")))
        if not all(math.isfinite(value) for value in (minimum, maximum, selected)) or minimum > maximum:
            raise ValueError(f"V7 R4 candidate {name} bounded selection evidence is invalid")
        if not minimum <= selected <= maximum:
            raise ValueError(f"V7 R4 candidate {name} selection is outside the proposal range")
        if float(loss_weights.get(name, float("nan"))) != selected:
            raise ValueError(f"V7 R4 candidate {name} selected weight does not match the training loss")
    gate = training.get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    if tail_epochs != [100, 110, 120] or int(gate.get("requiredConsecutiveTailPasses", 0)) != 3:
        raise ValueError("V7 R4 candidate tail stability epochs are invalid")
    if any(gate.get(name) is not True for name in (
        "requireAllMachineReviewsPassed",
        "requireZeroPathBoundaryIssues",
        "requireZeroObjectSemanticIssues",
        "preserveReviewThresholds",
    )):
        raise ValueError("V7 R4 candidate stability gate is incomplete")
    authorization_status = training.get("trainingAuthorizationStatus")
    if authorization_status not in {"not_authorized_candidate_only", V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS}:
        raise ValueError("V7 R4 candidate training authorization status is invalid")
    authorization = training.get("ownerTrainingAuthorization", {})
    forbidden_true_flags = (
        "trainerImplementationAuthorized",
        "gpuTrainingAuthorizedNow",
        "fullTrainingAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if authorization_status == "not_authorized_candidate_only" and any(
        authorization.get(name) is True for name in forbidden_true_flags
    ):
        raise ValueError("V7 R4 candidate cannot carry active execution authorization")
    return {
        "status": "r4_candidate_contract_valid_not_authorized_for_training",
        "semanticRgbConditionChannels": sorted(required_channels),
        "tailEpochs": tail_epochs,
        "requiredConsecutiveTailPasses": 3,
        "pathInteriorRgbWeight": float(loss_weights["pathInteriorRgb"]),
        "pathForbiddenBoundaryRgbWeight": float(loss_weights["pathForbiddenBoundaryRgb"]),
    }


def summarize_v7_r4_tail_stability(review_rows, config):
    gate = config.get("training", {}).get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    rows_by_epoch = {int(row.get("epoch", 0)): row for row in review_rows}
    evaluated = []
    for epoch in tail_epochs:
        row = rows_by_epoch.get(epoch)
        issue_codes = list(row.get("issueCodes", [])) if isinstance(row, dict) else []
        path_issue_free = not any("terrain_path_ground" in code for code in issue_codes)
        object_issue_free = not any(code.startswith("condition_object_") for code in issue_codes)
        evaluated.append({
            "epoch": epoch,
            "recorded": row is not None,
            "passed": bool(row and row.get("passed") is True and not issue_codes),
            "pathBoundaryIssueFree": path_issue_free,
            "objectSemanticIssueFree": object_issue_free,
            "issueCodes": issue_codes,
        })
    passed = (
        len(evaluated) == 3
        and all(row["recorded"] and row["passed"] for row in evaluated)
        and all(row["pathBoundaryIssueFree"] for row in evaluated)
        and all(row["objectSemanticIssueFree"] for row in evaluated)
    )
    return {
        "status": "r4_tail_stability_gate_passed" if passed else "r4_tail_stability_gate_failed_closed",
        "passed": passed,
        "requiredConsecutiveTailPasses": 3,
        "evaluated": evaluated,
    }


def build_v7_r5_candidate_config(
    r4_config,
    candidate_proposal,
    continuation_epochs,
    replay_passes_per_epoch,
    path_short_trajectory_consistency_weight,
):
    if candidate_proposal.get("status") != "isolated_candidate_proposal_cpu_verified_not_implemented_not_active":
        raise ValueError("V7 R5 candidate proposal status is invalid")
    proposal = candidate_proposal.get("proposal", {})
    if proposal.get("boundedRepairVersion") != "v7_bounded_repair_r5_candidate_proposal":
        raise ValueError("V7 R5 candidate proposal version is invalid")
    if r4_config.get("training", {}).get("boundedRepairVersion") != "v7_bounded_repair_r4_candidate":
        raise ValueError("V7 R5 candidate must derive from the immutable R4 candidate configuration")

    selected = {
        "continuationEpochs": int(continuation_epochs),
        "replayPassesPerEpoch": int(replay_passes_per_epoch),
        "pathShortTrajectoryConsistencyWeight": float(path_short_trajectory_consistency_weight),
    }
    bounds = {
        "continuationEpochs": proposal.get("checkpointContinuationProposal", {}).get("continuationEpochs", {}),
        "replayPassesPerEpoch": proposal.get("pathHardExampleReplayProposal", {}).get("replayPassesPerEpoch", {}),
        "pathShortTrajectoryConsistencyWeight": proposal.get("pathShortTrajectoryConsistencyProposal", {}).get("weight", {}),
    }
    for name, value in selected.items():
        minimum = float(bounds[name].get("minimum", float("nan")))
        maximum = float(bounds[name].get("maximum", float("nan")))
        if not math.isfinite(minimum) or not math.isfinite(maximum) or minimum > maximum:
            raise ValueError(f"V7 R5 candidate {name} range is invalid")
        if not minimum <= float(value) <= maximum:
            raise ValueError(f"V7 R5 candidate {name} selection is outside the proposal range")

    if selected["continuationEpochs"] % int(proposal["checkpointContinuationProposal"]["evaluationInterval"]) != 0:
        raise ValueError("V7 R5 continuation epochs must align with the fixed evaluation interval")
    tail_epochs = [selected["continuationEpochs"] - 20, selected["continuationEpochs"] - 10, selected["continuationEpochs"]]
    if tail_epochs[0] <= 0:
        raise ValueError("V7 R5 continuation schedule cannot provide three positive tail epochs")

    config = deepcopy(r4_config)
    training = config.setdefault("training", {})
    training["boundedRepairVersion"] = "v7_bounded_repair_r5_candidate"
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["denoiserLossVersion"] = "velocity_decoded_rgb_path_replay_trajectory_stability_v7_repair_r5_candidate"
    training["bestCheckpointMetric"] = "all_validation_multiseed_path_replay_trajectory_stability_score_v7_repair_r5_candidate"
    training["denoiserEpochs"] = selected["continuationEpochs"]
    training["denoiserLossWeights"]["pathInteriorRgb"] = float(proposal["preserveR4PathLossWeights"]["pathInteriorRgb"])
    training["denoiserLossWeights"]["pathForbiddenBoundaryRgb"] = float(proposal["preserveR4PathLossWeights"]["pathForbiddenBoundaryRgb"])
    training["objectSemanticChannelWeights"] = deepcopy(proposal["objectSemanticStabilityProposal"]["currentChannelWeights"])
    training["pathHardExampleReplay"] = {
        "enabled": True,
        "targetSource": proposal["pathHardExampleReplayProposal"]["targetSource"],
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "passesPerEpoch": selected["replayPassesPerEpoch"],
        "evidenceEpochs": deepcopy(proposal["pathHardExampleReplayProposal"]["evidenceEpochs"]),
    }
    training["pathShortTrajectoryConsistency"] = {
        "enabled": True,
        "conditionChannel": proposal["pathShortTrajectoryConsistencyProposal"]["conditionChannel"],
        "objective": proposal["pathShortTrajectoryConsistencyProposal"]["objective"],
        "weight": selected["pathShortTrajectoryConsistencyWeight"],
    }
    training["r5CheckpointContinuation"] = {
        "sourceCheckpointPath": proposal["checkpointContinuationProposal"]["sourceCheckpointPath"],
        "sourceCheckpointSha256": proposal["checkpointContinuationProposal"]["sourceCheckpointSha256"],
        "sourceArchitectureVersion": r4_config.get("architectureVersion"),
        "sourceBoundedRepairVersion": r4_config.get("training", {}).get("boundedRepairVersion"),
        "loadingAuthorizedNow": False,
    }
    training["smokeStabilityGate"] = {
        **deepcopy(proposal["smokeStabilityGate"]),
        "tailEpochs": tail_epochs,
    }
    smoke_previews = sorted(set([1, *range(10, selected["continuationEpochs"] + 1, 10), *tail_epochs]))
    training["fixedEpochPreviewPolicy"] = {
        **deepcopy(training.get("fixedEpochPreviewPolicy", {})),
        "smoke": smoke_previews,
    }
    training["r5BoundedSelectionEvidence"] = {
        "proposalVersion": proposal["boundedRepairVersion"],
        "proposalStatus": candidate_proposal["status"],
        "continuationEpochs": {**deepcopy(bounds["continuationEpochs"]), "selectedValue": selected["continuationEpochs"]},
        "replayPassesPerEpoch": {**deepcopy(bounds["replayPassesPerEpoch"]), "selectedValue": selected["replayPassesPerEpoch"]},
        "pathShortTrajectoryConsistencyWeight": {
            **deepcopy(bounds["pathShortTrajectoryConsistencyWeight"]),
            "selectedValue": selected["pathShortTrajectoryConsistencyWeight"],
        },
        "reviewThresholdPolicy": candidate_proposal.get("reviewThresholdPolicy"),
        "selectedObjectWeightChanges": proposal["objectSemanticStabilityProposal"].get("selectedWeightChanges"),
        "sourceCheckpointPath": proposal["checkpointContinuationProposal"]["sourceCheckpointPath"],
        "sourceCheckpointSha256": proposal["checkpointContinuationProposal"]["sourceCheckpointSha256"],
    }
    training["ownerTrainingAuthorization"] = deepcopy(proposal["ownerTrainingAuthorization"])
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-candidate"
    config["status"] = "isolated_r5_candidate_not_active"
    validate_v7_r5_candidate_contract(config)
    return config


def validate_v7_r5_candidate_contract(config):
    training = config.get("training", {})
    evidence = training.get("r5BoundedSelectionEvidence", {})
    if evidence.get("proposalVersion") != "v7_bounded_repair_r5_candidate_proposal":
        raise ValueError("V7 R5 bounded selection proposal identity is invalid")
    if evidence.get("reviewThresholdPolicy") != "preserved_unchanged":
        raise ValueError("V7 R5 candidate cannot change machine review thresholds")
    if evidence.get("selectedObjectWeightChanges") is not None:
        raise ValueError("V7 R5 candidate cannot change object weights")

    selected_fields = {
        "continuationEpochs": int(training.get("denoiserEpochs", 0)),
        "replayPassesPerEpoch": int(training.get("pathHardExampleReplay", {}).get("passesPerEpoch", 0)),
        "pathShortTrajectoryConsistencyWeight": float(training.get("pathShortTrajectoryConsistency", {}).get("weight", float("nan"))),
    }
    for name, selected in selected_fields.items():
        selection = evidence.get(name, {})
        minimum = float(selection.get("minimum", float("nan")))
        maximum = float(selection.get("maximum", float("nan")))
        recorded = float(selection.get("selectedValue", float("nan")))
        if not all(math.isfinite(value) for value in (minimum, maximum, recorded)) or minimum > maximum:
            raise ValueError(f"V7 R5 candidate {name} bounded selection evidence is invalid")
        if not minimum <= float(selected) <= maximum or float(selected) != recorded:
            raise ValueError(f"V7 R5 candidate {name} selection does not match the bounded evidence")

    loss_weights = training.get("denoiserLossWeights", {})
    if float(loss_weights.get("pathInteriorRgb", float("nan"))) != 2.0 or float(loss_weights.get("pathForbiddenBoundaryRgb", float("nan"))) != 2.0:
        raise ValueError("V7 R5 candidate must preserve the R4 path loss weights")
    required_object_weights = {
        "object_footprints": 1.0,
        "object_tree": 1.0,
        "object_rock": 1.25,
        "object_vegetation": 1.0,
    }
    actual_object_weights = {name: float(value) for name, value in training.get("objectSemanticChannelWeights", {}).items()}
    if actual_object_weights != required_object_weights:
        raise ValueError("V7 R5 candidate must preserve the R4 object semantic weights")

    replay = training.get("pathHardExampleReplay", {})
    if replay.get("enabled") is not True or replay.get("targetSource") != "original_owner_approved_rgb_and_condition_pack_only":
        raise ValueError("V7 R5 path replay target source is invalid")
    if replay.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 failed preview pixels cannot be used as training targets")
    consistency = training.get("pathShortTrajectoryConsistency", {})
    if consistency.get("enabled") is not True or consistency.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 path short-trajectory consistency contract is invalid")
    if training.get("shortTrajectorySupervision", {}).get("enabled") is not True or int(training.get("shortTrajectorySupervision", {}).get("steps", 0)) < 2:
        raise ValueError("V7 R5 requires the existing short-trajectory supervision")
    if any(key in training for key in (
        "pathCoverageCalibration",
        "authorizedBoundaryTopology",
        "pathActivationMassCalibration",
        "shortTrajectoryCoverageDrift",
    )):
        validate_v7_r5_stage3_internal_trainer_contract(config)

    continuation = training.get("r5CheckpointContinuation", {})
    if continuation.get("sourceBoundedRepairVersion") != "v7_bounded_repair_r4_candidate":
        raise ValueError("V7 R5 checkpoint continuation source version is invalid")
    if not isinstance(continuation.get("sourceCheckpointSha256"), str) or len(continuation["sourceCheckpointSha256"]) != 64:
        raise ValueError("V7 R5 checkpoint continuation SHA-256 is invalid")
    if continuation.get("sourceCheckpointPath") != evidence.get("sourceCheckpointPath") or continuation.get("sourceCheckpointSha256") != evidence.get("sourceCheckpointSha256"):
        raise ValueError("V7 R5 checkpoint continuation identity does not match the proposal evidence")
    authorization_status = training.get("trainingAuthorizationStatus")
    smoke_authorized = authorization_status == V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS
    loading_continuation = training.get("r5Stage3CheckpointContinuation") or continuation
    if authorization_status not in {"not_authorized_candidate_only", V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS}:
        raise ValueError("V7 R5 candidate training authorization status is invalid")
    if smoke_authorized and loading_continuation.get("loadingAuthorizedNow") is not True:
        raise ValueError("V7 R5 authorized Smoke must enable checkpoint loading")
    if not smoke_authorized and loading_continuation.get("loadingAuthorizedNow") is not False:
        raise ValueError("V7 R5 isolated candidate cannot authorize checkpoint loading")

    gate = training.get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    continuation_epochs = selected_fields["continuationEpochs"]
    if tail_epochs != [continuation_epochs - 20, continuation_epochs - 10, continuation_epochs]:
        raise ValueError("V7 R5 candidate tail stability epochs are invalid")
    if int(gate.get("requiredConsecutiveTailPasses", 0)) != 3 or any(gate.get(name) is not True for name in (
        "requireAllMachineReviewsPassed",
        "requireZeroPathBoundaryIssues",
        "requireZeroObjectSemanticIssues",
        "preserveReviewThresholds",
    )):
        raise ValueError("V7 R5 candidate stability gate is incomplete")
    smoke_epochs = [int(value) for value in training.get("fixedEpochPreviewPolicy", {}).get("smoke", [])]
    if any(epoch not in smoke_epochs for epoch in tail_epochs):
        raise ValueError("V7 R5 tail epochs are missing from the fixed preview policy")

    authorization = training.get("ownerTrainingAuthorization", {})
    active_flags = (
        "checkpointLoadingAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    forbidden_flags = (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if smoke_authorized:
        if any(authorization.get(name) is not True for name in active_flags):
            raise ValueError("V7 R5 active Smoke is missing an execution flag")
        if any(authorization.get(name) is not False for name in forbidden_flags):
            raise ValueError("V7 R5 active Smoke improperly opens a forbidden execution boundary")
    elif any(authorization.get(name) is True for name in (*active_flags, *forbidden_flags)):
        raise ValueError("V7 R5 isolated candidate carries an active execution flag")
    return {
        "status": "r5_candidate_contract_valid_for_single_smoke" if smoke_authorized else "r5_candidate_contract_valid_not_authorized_for_training",
        "continuationEpochs": continuation_epochs,
        "replayPassesPerEpoch": selected_fields["replayPassesPerEpoch"],
        "pathShortTrajectoryConsistencyWeight": selected_fields["pathShortTrajectoryConsistencyWeight"],
        "tailEpochs": tail_epochs,
        "checkpointLoadingAuthorized": smoke_authorized,
    }


def validate_v7_r5_stage3_internal_trainer_contract(config):
    training = config.get("training", {})
    coverage = training.get("pathCoverageCalibration", {})
    boundary = training.get("authorizedBoundaryTopology", {})
    replay = training.get("pathHardExampleReplay", {})
    if coverage.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 path coverage calibration must be enabled")
    if coverage.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 stage-3 path coverage calibration requires terrain_path_ground")
    if coverage.get("targetSource") != "original_condition_mask_support_only":
        raise ValueError("V7 R5 stage-3 path coverage target source is invalid")
    if coverage.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 stage-3 cannot use a machine-review threshold as a training target")
    if boundary.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 authorized boundary topology must be enabled")
    if boundary.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 stage-3 authorized boundary topology requires terrain_path_ground")
    if boundary.get("allowedSidesSource") != "original_condition_channel_boundary_contact_only":
        raise ValueError("V7 R5 stage-3 authorized boundary source is invalid")
    for name, contract in (("path coverage calibration", coverage), ("authorized boundary topology", boundary)):
        weight = float(contract.get("weight", float("nan")))
        if not math.isfinite(weight) or not 0.25 <= weight <= 0.75:
            raise ValueError(f"V7 R5 stage-3 {name} weight is outside the authorized implementation bounds")
    if replay.get("targetSource") != "original_owner_approved_rgb_and_condition_pack_only":
        raise ValueError("V7 R5 stage-3 replay requires original Owner-approved RGB and conditions")
    if replay.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 stage-3 replay cannot use failed preview pixels as targets")
    if int(replay.get("passesPerEpoch", 0)) != 2:
        raise ValueError("V7 R5 stage-3 requires exactly two original-target replay passes per epoch")
    authorization = training.get("ownerTrainingAuthorization", {})
    smoke_authorized = training.get("trainingAuthorizationStatus") == V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS
    active_flags = (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
    )
    forbidden_flags = (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    )
    if smoke_authorized:
        if any(authorization.get(key) is not True for key in active_flags):
            raise ValueError("V7 R5 stage-3 active Smoke is missing an execution authorization")
        if any(authorization.get(key) is not False for key in forbidden_flags):
            raise ValueError("V7 R5 stage-3 active Smoke opens a forbidden execution boundary")
    elif any(authorization.get(key) is True for key in (*active_flags, *forbidden_flags)):
        raise ValueError("V7 R5 stage-3 inactive contract carries an active execution authorization")
    convergence = None
    if "pathActivationMassCalibration" in training or "shortTrajectoryCoverageDrift" in training:
        convergence = validate_v7_r5_stage3_coverage_convergence_trainer_contract(config)
    return {
        "status": "r5_stage3_internal_trainer_contract_valid_not_active",
        "pathCoverageCalibrationWeight": float(coverage["weight"]),
        "authorizedBoundaryTopologyWeight": float(boundary["weight"]),
        "replayPassesPerEpoch": 2,
        "coverageConvergence": convergence,
    }


def validate_v7_r5_stage3_coverage_convergence_trainer_contract(config):
    training = config.get("training", {})
    activation = training.get("pathActivationMassCalibration", {})
    drift = training.get("shortTrajectoryCoverageDrift", {})
    if activation.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 path activation-mass calibration must be enabled")
    if activation.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("V7 R5 stage-3 path activation-mass calibration requires terrain_path_ground")
    if activation.get("targetSource") != "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only":
        raise ValueError("V7 R5 stage-3 path activation-mass target source is invalid")
    if activation.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("V7 R5 stage-3 path activation-mass calibration cannot use failed preview pixels")
    if activation.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 stage-3 path activation-mass calibration cannot use machine-review thresholds")
    if activation.get("lossForm") != "symmetric_log_activation_mass_ratio_plus_outside_support_leakage":
        raise ValueError("V7 R5 stage-3 path activation-mass loss form is invalid")
    activation_weight = float(activation.get("weight", float("nan")))
    if not math.isfinite(activation_weight) or not 0.25 <= activation_weight <= 0.75:
        raise ValueError("V7 R5 stage-3 path activation-mass weight is outside the candidate bounds")

    if drift.get("enabled") is not True:
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift must be enabled")
    if drift.get("source") != "current_training_prediction_steps_against_original_target_activation_mass_only":
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift source is invalid")
    if drift.get("failedPreviewTrajectoryUsedAsTrainingTarget") is not False:
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift cannot use failed preview trajectories")
    drift_weight = float(drift.get("weight", float("nan")))
    if not math.isfinite(drift_weight) or not 0.1 <= drift_weight <= 0.35:
        raise ValueError("V7 R5 stage-3 short-trajectory coverage drift weight is outside the candidate bounds")
    return {
        "status": "r5_stage3_coverage_convergence_trainer_contract_valid_not_active",
        "pathActivationMassCalibrationWeight": activation_weight,
        "shortTrajectoryCoverageDriftWeight": drift_weight,
    }


def summarize_v7_r5_tail_stability(review_rows, config):
    gate = config.get("training", {}).get("smokeStabilityGate", {})
    tail_epochs = [int(value) for value in gate.get("tailEpochs", [])]
    rows_by_epoch = {int(row.get("epoch", 0)): row for row in review_rows}
    evaluated = []
    for epoch in tail_epochs:
        row = rows_by_epoch.get(epoch)
        issue_codes = list(row.get("issueCodes", [])) if isinstance(row, dict) else []
        evaluated.append({
            "epoch": epoch,
            "recorded": row is not None,
            "passed": bool(row and row.get("passed") is True and not issue_codes),
            "pathIssueFree": not any("terrain_path_ground" in code for code in issue_codes),
            "objectIssueFree": not any(code.startswith("condition_object_") for code in issue_codes),
            "issueCodes": issue_codes,
        })
    passed = (
        len(evaluated) == 3
        and all(row["recorded"] and row["passed"] for row in evaluated)
        and all(row["pathIssueFree"] and row["objectIssueFree"] for row in evaluated)
    )
    return {
        "status": "r5_tail_stability_gate_passed" if passed else "r5_tail_stability_gate_failed_closed",
        "passed": passed,
        "requiredConsecutiveTailPasses": 3,
        "evaluated": evaluated,
    }


def validate_v7_training_authorization(config, package, project_root=None):
    training = config.get("training", {})
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r5_candidate":
        validate_v7_r5_candidate_contract(config)
        if training.get("trainingAuthorizationStatus") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS:
            raise ValueError("V7 R5 candidate is isolated and is not authorized for training")
        validate_v7_repair_r5_smoke_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r4_candidate":
        validate_v7_r4_candidate_contract(config)
        if training.get("trainingAuthorizationStatus") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS:
            raise ValueError("V7 R4 candidate is isolated and is not authorized for training")
        validate_v7_repair_r4_smoke_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r3_candidate":
        if training.get("trainingAuthorizationStatus") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS:
            raise ValueError("V7 R3 candidate is isolated and is not authorized for training")
        validate_v7_repair_r3_smoke_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r2":
        validate_v7_repair_r2_authorization(config, package, project_root)
        return
    if training.get("boundedRepairVersion") == "v7_bounded_repair_r1":
        if training.get("trainingAuthorizationStatus") == V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_STATUS:
            validate_v7_repair_r1_full_training_authorization(config, package, project_root)
        else:
            validate_v7_repair_r1_authorization(config, package, project_root)
        return
    if training.get("trainingAuthorizationStatus") != V7_ACTIVE_TRAINING_AUTHORIZATION_STATUS:
        raise ValueError("V7 GPU training authorization status is not active")

    authorization = training.get("ownerTrainingAuthorization")
    if not isinstance(authorization, dict):
        raise ValueError("V7 owner training authorization is missing")
    if authorization.get("authorizationId") != V7_TRAINING_AUTHORIZATION_ID:
        raise ValueError("V7 owner training authorization identity is invalid")
    if authorization.get("status") != V7_ACTIVE_TRAINING_AUTHORIZATION_STATUS:
        raise ValueError("V7 nested owner training authorization status is not active")
    if authorization.get("gpuTrainingAuthorizedNow") is not True:
        raise ValueError("V7 GPU training is not authorized now")

    authorization_sha256 = authorization.get("authorizationSha256")
    if not isinstance(authorization_sha256, str) or len(authorization_sha256) != 64:
        raise ValueError("V7 owner training authorization SHA-256 is invalid")
    try:
        int(authorization_sha256, 16)
    except ValueError as error:
        raise ValueError("V7 owner training authorization SHA-256 is invalid") from error

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path_value = authorization.get("authorizationPath")
    if authorization_path_value != V7_TRAINING_AUTHORIZATION_PATH:
        raise ValueError("V7 owner training authorization path identity is invalid")
    # Keep the logical project path here. On Windows, .runtime is intentionally a
    # junction into the project-owned data root, so Path.resolve() would make the
    # valid immutable record appear to escape the workspace.
    authorization_path = root / Path(authorization_path_value)
    if not authorization_path.is_file():
        raise ValueError("V7 owner training authorization file is missing")
    if sha256_file(authorization_path) != authorization_sha256:
        raise ValueError("V7 owner training authorization SHA-256 does not match")

    authorization_record = read_json(authorization_path)
    if authorization_record.get("schemaVersion") != "ai-painter-owner-action-request-v1":
        raise ValueError("V7 owner training authorization record schema is invalid")
    if authorization_record.get("requestId") != V7_TRAINING_AUTHORIZATION_REQUEST_ID:
        raise ValueError("V7 owner training authorization request identity is invalid")
    if authorization_record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 owner training authorization record is not resolved and authorized")
    if authorization_record.get("ownerDecision", {}).get("commandRef") != V7_TRAINING_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 owner training authorization command is invalid")
    if authorization_record.get("ownerDecision", {}).get("scope") != "v7_smoke_and_stage_0_1_2_only":
        raise ValueError("V7 owner training authorization scope is invalid")

    resolution = authorization_record.get("resolution", {})
    if resolution.get("gpuTrainingActivated") is not True:
        raise ValueError("V7 owner training authorization did not activate GPU training")
    if resolution.get("formalInferenceAuthorized") is not False:
        raise ValueError("V7 authorization improperly opens formal inference")
    if resolution.get("runtimeFrameAuthorized") is not False:
        raise ValueError("V7 authorization improperly opens RuntimeFrame")
    if resolution.get("worldEntryAuthorized") is not False:
        raise ValueError("V7 authorization improperly opens world entry")

    task_identity = authorization_record.get("taskIdentity", {})
    if task_identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 owner training authorization model identity does not match")
    if task_identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 owner training authorization dataset identity does not match")
    if task_identity.get("qualifiedCompleteMapCount") != 64:
        raise ValueError("V7 owner training authorization capacity is not 64")
    if task_identity.get("splitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 owner training authorization split is not 48/8/4/4")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 dataset package does not contain 64 capacity contributions")
    validate_v7_dataset_repair_authorization(root, config, package)


def validate_v7_repair_r3_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_ID:
        raise ValueError("V7 repair R3 Smoke authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R3 Smoke authorization path is invalid")
    if authorization.get("authorizationSha256") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R3 Smoke authorization pinned hash is invalid")
    if authorization.get("authorizationConsumptionPath") != V7_REPAIR_R3_SMOKE_CONSUMPTION_PATH:
        raise ValueError("V7 repair R3 Smoke consumption path is invalid")
    if authorization.get("authorizationConsumptionSha256") != V7_REPAIR_R3_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R3 Smoke consumption pinned hash is invalid")
    if authorization.get("status") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R3 Smoke nested authorization status is invalid")
    if authorization.get("singleSampleGpuOverfitSmokeAuthorized") is not True:
        raise ValueError("V7 repair R3 single-sample GPU Smoke is not authorized")
    for key in ("fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if authorization.get(key) is not False:
            raise ValueError(f"V7 repair R3 improperly authorizes {key}")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R3_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R3_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R3 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R3_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R3 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R3 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R3 owner command mismatch")
    if record.get("ownerDecision", {}).get("scope") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R3 owner scope mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("singleSampleGpuOverfitSmokeAuthorized") is not True and resolution.get("singleSampleGpuOverfitSmokeRetryAuthorized") is not True:
        raise ValueError("V7 repair R3 bounded execution scope is incomplete")
    for key in ("fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R3 authorization improperly opens {key}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("authorizationSha256") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R3 authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R3_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R3 authorization consumption identity mismatch")
    identity = record.get("taskIdentity", {})
    authorized_dataset_package_id = identity.get("datasetPackageId")
    if authorized_dataset_package_id is None:
        failed_report_path_value = identity.get("failedRunReportPath")
        failed_report_sha256 = identity.get("failedRunReportSha256")
        failed_report_path = root / Path(failed_report_path_value or "")
        if not failed_report_path.is_file() or sha256_file(failed_report_path) != failed_report_sha256:
            raise ValueError("V7 repair R3 retry evidence chain is missing or changed")
        failed_report = read_json(failed_report_path)
        prior_authorization_path = root / Path(failed_report.get("authorizationPath", ""))
        if not prior_authorization_path.is_file() or sha256_file(prior_authorization_path) != failed_report.get("authorizationSha256"):
            raise ValueError("V7 repair R3 prior authorization evidence is missing or changed")
        authorized_dataset_package_id = read_json(prior_authorization_path).get("taskIdentity", {}).get("datasetPackageId")
    if identity.get("modelId") != config.get("modelId") or authorized_dataset_package_id != package.get("packageId"):
        raise ValueError("V7 repair R3 model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 repair R3 authorized sample identity mismatch")
    if identity.get("parentCheckpointPath") is not None or identity.get("parentCheckpointSha256") is not None:
        raise ValueError("V7 repair R3 random-initialization authorization cannot bind a parent checkpoint")
    if identity.get("initialization") != "project_random_multiscale_denoiser" or int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 repair R3 random initialization identity mismatch")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R3 dataset capacity is not 64")


def validate_v7_repair_r5_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    continuation = training.get("r5Stage3CheckpointContinuation") or training.get("r5CheckpointContinuation", {})
    expected_identity = {
        "authorizationId": V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID,
        "authorizationPath": V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH,
        "authorizationSha256": V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256,
        "authorizationConsumptionPath": V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH,
        "authorizationConsumptionSha256": V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256,
        "status": V7_REPAIR_R5_SMOKE_AUTHORIZATION_STATUS,
    }
    for name, expected in expected_identity.items():
        if authorization.get(name) != expected:
            raise ValueError(f"V7 repair R5 Smoke {name} identity is invalid")
    for name in ("checkpointLoadingAuthorized", "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized"):
        if authorization.get(name) is not True:
            raise ValueError(f"V7 repair R5 Smoke is missing {name}")
    for name in (
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if authorization.get(name) is not False:
            raise ValueError(f"V7 repair R5 Smoke improperly authorizes {name}")

    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R5_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R5_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R5 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R5_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R5 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R5 authorization record is not resolved")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF or decision.get("scope") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R5 owner authorization identity mismatch")
    resolution = record.get("resolution", {})
    for name in (
        "conditionEvidenceSerializationFixAuthorized",
        "knownPredictedRgbTensorExclusionAuthorized",
        "unknownNonScalarTensorFailureClosureRequired",
        "cpuPositiveRegressionAuthorized",
        "cpuNegativeRegressionAuthorized",
        "trainerAuthorizationGateRebindingAuthorized",
        "runnerAuthorizationGateRebindingAuthorized",
        "sameCheckpointReadAndLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "oneGpuSmokeRetryAuthorized",
        "fixedEpochPreviewGenerationAuthorized",
        "machinePreviewReviewAuthorized",
        "checkpointAndTokenEvidenceStorageAuthorized",
        "automaticTerminalStorageAuthorized",
    ):
        if resolution.get(name) is not True:
            raise ValueError(f"V7 repair R5 authorization is missing {name}")
    for name in (
        "automaticAdditionalRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(name) is not False:
            raise ValueError(f"V7 repair R5 authorization improperly opens {name}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("authorizationSha256") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R5 authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R5_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R5 authorization consumption identity mismatch")

    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId") or identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 repair R5 model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 repair R5 authorized sample identity mismatch")
    if int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 repair R5 seed identity mismatch")
    if int(identity.get("epochCount", 0)) != int(training.get("denoiserEpochs", -1)):
        raise ValueError("V7 repair R5 epoch count identity mismatch")
    if identity.get("requiredTailEpochs") != training.get("smokeStabilityGate", {}).get("tailEpochs"):
        raise ValueError("V7 repair R5 tail gate identity mismatch")
    if identity.get("parentCheckpointPath") != continuation.get("sourceCheckpointPath") or identity.get("parentCheckpointSha256") != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 repair R5 parent checkpoint binding mismatch")
    source_checkpoint = root / Path(continuation.get("sourceCheckpointPath", ""))
    if not source_checkpoint.is_file() or sha256_file(source_checkpoint) != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 repair R5 bound parent checkpoint is missing or changed")
    if continuation.get("loadingAuthorizedNow") is not True:
        raise ValueError("V7 repair R5 checkpoint loading is not active")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R5 dataset capacity is not 64")


def validate_v7_repair_r4_smoke_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_ID:
        raise ValueError("V7 repair R4 Smoke authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R4 Smoke authorization path is invalid")
    if authorization.get("authorizationSha256") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R4 Smoke authorization pinned hash is invalid")
    if authorization.get("authorizationConsumptionPath") != V7_REPAIR_R4_SMOKE_CONSUMPTION_PATH:
        raise ValueError("V7 repair R4 Smoke consumption path is invalid")
    if authorization.get("authorizationConsumptionSha256") != V7_REPAIR_R4_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R4 Smoke consumption pinned hash is invalid")
    if authorization.get("status") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R4 Smoke nested authorization status is invalid")
    if authorization.get("singleSampleGpuOverfitSmokeAuthorized") is not True:
        raise ValueError("V7 repair R4 single-sample GPU Smoke is not authorized")
    if authorization.get("automaticRetryAuthorized") is not False:
        raise ValueError("V7 repair R4 Smoke cannot authorize automatic retry")
    for key in (
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if authorization.get(key) is not False:
            raise ValueError(f"V7 repair R4 improperly authorizes {key}")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R4_SMOKE_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R4_SMOKE_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R4 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R4_SMOKE_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R4 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R4 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R4 owner command mismatch")
    if record.get("ownerDecision", {}).get("scope") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R4 owner scope mismatch")
    resolution = record.get("resolution", {})
    for key in (
        "singleSampleGpuOverfitSmokeAuthorized",
        "fixedEpochPreviewGenerationAuthorized",
        "machinePreviewReviewAuthorized",
        "checkpointAndTokenEvidenceStorageAuthorized",
        "automaticTerminalStorageAuthorized",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"V7 repair R4 authorization is missing {key}")
    for key in (
        "automaticRetryAuthorized",
        "parentCheckpointLoadingAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R4 authorization improperly opens {key}")
    if consumption.get("status") != "consumed_before_authorized_write":
        raise ValueError("V7 repair R4 authorization was not consumed before write")
    if consumption.get("authorizationSha256") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R4 consumed authorization hash mismatch")
    if consumption.get("commandRef") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R4_SMOKE_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R4 authorization consumption identity mismatch")
    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId") or identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 repair R4 model or dataset identity mismatch")
    if identity.get("sampleId") != training.get("authorizedOverfitSampleId"):
        raise ValueError("V7 repair R4 authorized sample identity mismatch")
    if identity.get("parentCheckpointPath") is not None or identity.get("parentCheckpointSha256") is not None:
        raise ValueError("V7 repair R4 random-initialization authorization cannot bind a parent checkpoint")
    if identity.get("initialization") != "project_random_multiscale_denoiser":
        raise ValueError("V7 repair R4 random initialization identity mismatch")
    if int(identity.get("seed", -1)) != int(training.get("seed", -2)):
        raise ValueError("V7 repair R4 random seed identity mismatch")
    smoke_contract = training.get("r4SmokeCandidateContract", {})
    if smoke_contract.get("status") != "owner_authorized_single_gpu_smoke_execution":
        raise ValueError("V7 repair R4 planned Smoke status is not active")
    if smoke_contract.get("gpuSmokeAuthorized") is not True:
        raise ValueError("V7 repair R4 planned Smoke GPU execution is not authorized")
    if identity.get("sampleId") != smoke_contract.get("plannedOverfitSampleId"):
        raise ValueError("V7 repair R4 planned Smoke sample mismatch")
    if int(identity.get("epochCount", 0)) != int(smoke_contract.get("plannedEpochs", -1)):
        raise ValueError("V7 repair R4 planned Smoke epoch count mismatch")
    if int(identity.get("evaluationInterval", 0)) != int(smoke_contract.get("plannedEvaluationInterval", -1)):
        raise ValueError("V7 repair R4 planned Smoke evaluation interval mismatch")
    if identity.get("requiredTailEpochs") != smoke_contract.get("requiredTailEpochs"):
        raise ValueError("V7 repair R4 planned Smoke tail gate mismatch")
    if smoke_contract.get("parentCheckpointAllowed") is not False:
        raise ValueError("V7 repair R4 Smoke parent checkpoint contract is invalid")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R4 dataset capacity is not 64")


def validate_v7_repair_r2_authorization(config, package, project_root=None):
    training = config.get("training", {})
    if training.get("trainingAuthorizationStatus") != V7_REPAIR_R2_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R2 authorization status is invalid")
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R2_AUTHORIZATION_ID:
        raise ValueError("V7 repair R2 authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R2_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R2 authorization path is invalid")
    if authorization.get("authorizationSha256") != V7_REPAIR_R2_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R2 authorization pinned hash is invalid")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R2_AUTHORIZATION_PATH)
    consumption_path = root / Path(V7_REPAIR_R2_CONSUMPTION_PATH)
    if not authorization_path.is_file() or sha256_file(authorization_path) != V7_REPAIR_R2_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R2 immutable authorization evidence is missing or changed")
    if not consumption_path.is_file() or sha256_file(consumption_path) != V7_REPAIR_R2_CONSUMPTION_SHA256:
        raise ValueError("V7 repair R2 atomic authorization consumption evidence is missing or changed")
    record = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if record.get("requestId") != V7_REPAIR_R2_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R2 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R2_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R2 owner command mismatch")
    if record.get("ownerDecision", {}).get("scope") != V7_REPAIR_R2_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R2 owner scope mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("repairImplementationAuthorized") is not True or resolution.get("singleSampleGpuOverfitSmokeAuthorized") is not True:
        raise ValueError("V7 repair R2 bounded execution scope is incomplete")
    for key in ("fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R2 improperly authorizes {key}")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("requestSha256") != V7_REPAIR_R2_AUTHORIZATION_SHA256:
        raise ValueError("V7 repair R2 authorization was not consumed before write")
    if consumption.get("commandRef") != V7_REPAIR_R2_AUTHORIZATION_COMMAND_REF or consumption.get("scope") != V7_REPAIR_R2_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R2 authorization consumption identity mismatch")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R2 dataset capacity is not 64")


def validate_v7_repair_r1_authorization(config, package, project_root=None):
    training = config.get("training", {})
    if training.get("trainingAuthorizationStatus") != V7_REPAIR_R1_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R1 authorization status is invalid")
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R1_AUTHORIZATION_ID:
        raise ValueError("V7 repair R1 authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R1_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R1 authorization path is invalid")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R1_AUTHORIZATION_PATH)
    if not authorization_path.is_file():
        raise ValueError("V7 repair R1 authorization record is missing")
    if sha256_file(authorization_path) != authorization.get("authorizationSha256"):
        raise ValueError("V7 repair R1 authorization hash mismatch")
    record = read_json(authorization_path)
    if record.get("requestId") != V7_REPAIR_R1_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R1 authorization record is not resolved")
    if record.get("ownerDecision", {}).get("commandRef") != V7_REPAIR_R1_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R1 owner command mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("boundedDiagnosticsAuthorized") is not True or resolution.get("repairImplementationAuthorized") is not True or resolution.get("singleStage0SmokeAuthorized") is not True:
        raise ValueError("V7 repair R1 bounded execution scope is incomplete")
    for key in ("fullTrainingAuthorized", "revalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R1 improperly authorizes {key}")
    task_identity = record.get("taskIdentity", {})
    if task_identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 repair R1 model identity mismatch")
    if task_identity.get("repairContractId") != training.get("repairContractId"):
        raise ValueError("V7 repair R1 contract identity mismatch")
    # package.splitCounts describes every dataset row (currently 112 rows), not
    # the V7 capacity subset.  The exact 48/8/4/4 contract is verified from the
    # rows the V7 Dataset actually selects in validate_loaded_v7_datasets().
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R1 dataset does not contain the locked 64 capacity rows")


def validate_v7_repair_r1_full_training_authorization(config, package, project_root=None):
    training = config.get("training", {})
    authorization = training.get("ownerTrainingAuthorization", {})
    if authorization.get("authorizationId") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_ID:
        raise ValueError("V7 repair R1 full-training authorization identity is invalid")
    if authorization.get("authorizationPath") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_PATH:
        raise ValueError("V7 repair R1 full-training authorization path is invalid")
    if authorization.get("status") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_STATUS:
        raise ValueError("V7 repair R1 full-training nested status is invalid")
    if authorization.get("gpuTrainingAuthorizedNow") is not True or authorization.get("fullTrainingAuthorized") is not True:
        raise ValueError("V7 repair R1 full GPU training is not active")
    if authorization.get("formalInferenceAuthorized") is not False:
        raise ValueError("V7 repair R1 full-training config improperly opens formal inference")
    root = Path(project_root or Path.cwd()).resolve()
    authorization_path = root / Path(V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_PATH)
    if not authorization_path.is_file():
        raise ValueError("V7 repair R1 full-training authorization record is missing")
    if sha256_file(authorization_path) != authorization.get("authorizationSha256"):
        raise ValueError("V7 repair R1 full-training authorization hash mismatch")
    record = read_json(authorization_path)
    if record.get("requestId") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_ID or record.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 repair R1 full-training authorization record is not resolved")
    decision = record.get("ownerDecision", {})
    if decision.get("commandRef") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 repair R1 full-training owner command mismatch")
    if decision.get("scope") != V7_REPAIR_R1_FULL_TRAINING_AUTHORIZATION_SCOPE:
        raise ValueError("V7 repair R1 full-training owner scope mismatch")
    resolution = record.get("resolution", {})
    if resolution.get("fullTrainingAuthorized") is not True or resolution.get("requiredStagesAuthorized") != [0, 1, 2]:
        raise ValueError("V7 repair R1 full Stage 0/1/2 training is not authorized")
    if resolution.get("strictStageOrderRequired") is not True or resolution.get("newRandomStage0Required") is not True:
        raise ValueError("V7 repair R1 full-training lineage contract is incomplete")
    for key in ("revalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"V7 repair R1 full-training authorization improperly opens {key}")
    identity = record.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 repair R1 full-training model identity mismatch")
    if identity.get("architectureVersion") != config.get("architectureVersion"):
        raise ValueError("V7 repair R1 full-training architecture identity mismatch")
    if identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 repair R1 full-training dataset identity mismatch")
    if identity.get("requiredSplitCounts") != V7_MVP64_SPLIT_COUNTS or identity.get("conditionChannelCount") != 23:
        raise ValueError("V7 repair R1 full-training data contract mismatch")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("V7 repair R1 full-training dataset does not contain 64 capacity rows")


def validate_v7_dataset_repair_authorization(root, config, package):
    authorization_path = root / Path(V7_DATASET_REPAIR_AUTHORIZATION_PATH)
    if not authorization_path.is_file():
        raise ValueError("V7 dataset repair authorization file is missing")
    if sha256_file(authorization_path) != V7_DATASET_REPAIR_AUTHORIZATION_SHA256:
        raise ValueError("V7 dataset repair authorization SHA-256 does not match")
    authorization = read_json(authorization_path)
    if authorization.get("schemaVersion") != "ai-painter-owner-action-request-v1":
        raise ValueError("V7 dataset repair authorization schema is invalid")
    if authorization.get("requestId") != V7_DATASET_REPAIR_AUTHORIZATION_ID:
        raise ValueError("V7 dataset repair authorization identity is invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V7 dataset repair authorization is not resolved")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != V7_DATASET_REPAIR_AUTHORIZATION_COMMAND_REF:
        raise ValueError("V7 dataset repair owner command is invalid")
    if decision.get("scope") != V7_DATASET_REPAIR_AUTHORIZATION_SCOPE:
        raise ValueError("V7 dataset repair authorization scope is invalid")
    identity = authorization.get("taskIdentity", {})
    if identity.get("modelId") != config.get("modelId"):
        raise ValueError("V7 dataset repair model identity does not match")
    if identity.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 dataset repair package identity does not match")
    if identity.get("requiredV7CapacityCount") != 64 or identity.get("requiredSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 dataset repair capacity or split authorization is invalid")
    resolution = authorization.get("resolution", {})
    if resolution.get("datasetBindingRepairAuthorized") is not True or resolution.get("gpuRetrainingAuthorized") is not True:
        raise ValueError("V7 dataset repair and retraining are not authorized")
    if resolution.get("postTrainingValidationAuthorized") is not False:
        raise ValueError("V7 dataset repair authorization improperly opens post-training validation")
    if resolution.get("formalInferenceAuthorized") is not False or resolution.get("runtimeFrameAuthorized") is not False or resolution.get("worldEntryAuthorized") is not False:
        raise ValueError("V7 dataset repair authorization improperly opens downstream execution")


def validate_loaded_v7_datasets(datasets):
    split_counts = {split: len(dataset) for split, dataset in datasets.items()}
    if split_counts != V7_MVP64_SPLIT_COUNTS:
        raise ValueError(f"V7 actual loaded split must be 48/8/4/4, got {split_counts}")
    rows = [row for dataset in datasets.values() for row in dataset.rows]
    if len(rows) != 64:
        raise ValueError(f"V7 actual loaded capacity count must be 64, got {len(rows)}")
    if any(row.get("v7CapacityContributionRegistered") is not True for row in rows):
        raise ValueError("V7 loaded rows contain a non-registered capacity contribution")
    record_ids = [row.get("recordId") for row in rows]
    slot_ids = [row.get("v7CapacitySlotId") for row in rows]
    if any(not isinstance(value, str) or not value for value in record_ids) or len(set(record_ids)) != 64:
        raise ValueError("V7 loaded record identities are missing or duplicated")
    if any(not isinstance(value, str) or not value for value in slot_ids) or len(set(slot_ids)) != 64:
        raise ValueError("V7 loaded capacity slot identities are missing or duplicated")
    return {
        "selectionMode": "v7_registered_capacity_contribution_only",
        "actualLoadedConditionalSampleCount": len(rows),
        "actualLoadedV7CapacityCount": len(rows),
        "actualSplitCounts": split_counts,
        "allRowsCapacityRegistered": True,
        "uniqueRecordIdCount": len(set(record_ids)),
        "uniqueCapacitySlotCount": len(set(slot_ids)),
        "legacyCurrentConditionIdentityRowCount": sum(row.get("currentConditionIdentityMatches") is True for row in rows),
        "loadedRecordIds": record_ids,
        "loadedCapacitySlotIds": slot_ids,
    }


def build_training_token_accounting(config, datasets, stage, epoch_count, smoke_test, computes_latent_normalization, evaluation_epoch_count=None):
    """Count real model work without pretending that image training uses NLP/API tokens."""
    training = config["training"]
    batch_size = int(training["batchSize"])
    width = int(stage["width"])
    height = int(stage["height"])
    downsample = int(config["latentDownsampleFactor"])
    latent_width = width // downsample
    latent_height = height // downsample
    latent_spatial_positions = latent_width * latent_height
    latent_channels = int(config["latentChannels"])
    condition_channels = int(config["conditionChannels"])
    fixed_timestep_count = len(training["fixedValidationTimesteps"])
    evaluation_epoch_count = epoch_count if evaluation_epoch_count is None else int(evaluation_epoch_count)
    trajectory_supervision_steps = int(training.get("shortTrajectorySupervision", {}).get("steps", 0)) if training.get("shortTrajectorySupervision", {}).get("enabled") is True else 0
    path_replay_passes = r5_path_replay_passes_per_epoch(config)
    train_samples_per_epoch = min(len(datasets["train"]), batch_size) if smoke_test else len(datasets["train"])
    effective_training_presentations_per_epoch = train_samples_per_epoch * (1 + path_replay_passes)
    optimizer_steps_per_epoch = ((train_samples_per_epoch + batch_size - 1) // batch_size) * (1 + path_replay_passes)
    validation_samples = len(datasets["validation"])
    fixed_validation_sample_passes = validation_samples * fixed_timestep_count
    rollout_seeds = int(training.get("checkpointRolloutSeedsPerSample", 2)) if is_v7(config) else 0
    rollout_steps = int(config["inferenceSteps"]) if is_v7(config) else 0
    rollout_trajectories = validation_samples * rollout_seeds
    rollout_sample_passes = rollout_trajectories * rollout_steps
    training_denoiser_passes_per_epoch = effective_training_presentations_per_epoch * (1 + trajectory_supervision_steps)
    evaluated_epoch_sample_passes = training_denoiser_passes_per_epoch + fixed_validation_sample_passes + rollout_sample_passes

    strict_held_out = training.get("strictHeldOutInferenceSplit")
    final_evaluation_samples = sum(
        len(dataset)
        for split, dataset in datasets.items()
        if split != strict_held_out
    )
    final_evaluation_sample_passes = final_evaluation_samples * fixed_timestep_count
    evidence_sample_passes = sum(
        len(datasets[split])
        for split in ("validation", "challenge", "regression")
        if split != strict_held_out
    )
    epoch_sample_passes = (
        training_denoiser_passes_per_epoch * epoch_count
        + (fixed_validation_sample_passes + rollout_sample_passes) * evaluation_epoch_count
    )
    total_sample_passes = epoch_sample_passes + final_evaluation_sample_passes + evidence_sample_passes
    decoded_rgb_training_frames_per_epoch = effective_training_presentations_per_epoch * (1 + trajectory_supervision_steps)
    decoded_rgb_frames_per_evaluated_epoch = decoded_rgb_training_frames_per_epoch + fixed_validation_sample_passes + rollout_trajectories
    decoded_rgb_frames_total = (
        decoded_rgb_training_frames_per_epoch * epoch_count
        + (fixed_validation_sample_passes + rollout_trajectories) * evaluation_epoch_count
        + final_evaluation_sample_passes
        + evidence_sample_passes
    )

    def token_values(sample_passes):
        return {
            "denoiserSampleForwardPasses": sample_passes,
            "latentSpatialTokens": sample_passes * latent_spatial_positions,
            "latentChannelValues": sample_passes * latent_spatial_positions * latent_channels,
            "conditionScalarValues": sample_passes * width * height * condition_channels,
        }

    return {
        "schemaVersion": "ai-assisted-local-training-token-accounting-v1",
        "source": "training_program_exact_loop_accounting",
        "terminology": {
            "localTrainingTokenUnit": "one_latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
            "isNlpToken": False,
            "tokenizerUsed": False,
            "noteZh": "本地V7是图像扩散模型，不使用文本Tokenizer；本账本中的Token是项目自定义的潜空间计算单位，不是API计费Token。",
        },
        "externalApi": {
            "providerCalls": 0,
            "promptTokens": 0,
            "completionTokens": 0,
            "totalTokens": 0,
            "costCny": 0,
            "measurementStatus": "not_applicable_local_pytorch_training",
            "externalAgentConversationTokensAvailableToLocalProgram": False,
        },
        "geometry": {
            "imageWidth": width,
            "imageHeight": height,
            "imagePixelsPerSample": width * height,
            "latentWidth": latent_width,
            "latentHeight": latent_height,
            "latentSpatialPositionsPerSample": latent_spatial_positions,
            "latentChannels": latent_channels,
            "conditionChannels": condition_channels,
            "latentDownsampleFactor": downsample,
        },
        "perEpoch": {
            "trainingSamplePresentations": effective_training_presentations_per_epoch,
            "primaryTrainingSamplePresentations": train_samples_per_epoch,
            "pathHardExampleReplayPassesPerEpoch": path_replay_passes,
            "optimizerSteps": optimizer_steps_per_epoch,
            "shortTrajectoryDenoiserStepsPerTrainingSample": trajectory_supervision_steps,
            "fixedValidationSamplePasses": fixed_validation_sample_passes,
            "rolloutTrajectories": rollout_trajectories,
            "rolloutDenoiserSteps": rollout_sample_passes,
            "decodedRgbFramesOnEvaluatedEpoch": decoded_rgb_frames_per_evaluated_epoch,
            **token_values(evaluated_epoch_sample_passes),
        },
        "postEpochEvaluation": {
            "fixedGridSamplePasses": final_evaluation_sample_passes,
            "conditionEvidenceSamplePasses": evidence_sample_passes,
            "latentNormalizationEncoderSamples": len(datasets["train"]) if computes_latent_normalization else 0,
            **token_values(final_evaluation_sample_passes + evidence_sample_passes),
        },
        "runTotals": {
            "epochCount": epoch_count,
            "evaluationEpochCount": evaluation_epoch_count,
            "trainingSamplePresentations": effective_training_presentations_per_epoch * epoch_count,
            "primaryTrainingSamplePresentations": train_samples_per_epoch * epoch_count,
            "pathHardExampleReplaySamplePresentations": train_samples_per_epoch * path_replay_passes * epoch_count,
            "optimizerSteps": optimizer_steps_per_epoch * epoch_count,
            "shortTrajectoryDenoiserSteps": train_samples_per_epoch * trajectory_supervision_steps * epoch_count,
            "fixedValidationSamplePasses": fixed_validation_sample_passes * evaluation_epoch_count,
            "rolloutTrajectories": rollout_trajectories * evaluation_epoch_count,
            "rolloutDenoiserSteps": rollout_sample_passes * evaluation_epoch_count,
            "decodedRgbFrames": decoded_rgb_frames_total,
            "decodedRgbPixelPredictions": decoded_rgb_frames_total * width * height,
            **token_values(total_sample_passes),
        },
        "scope": {
            "included": [
                "denoiser_training_forward_passes",
                "fixed_grid_validation_forward_passes",
                "checkpoint_rollout_denoiser_steps",
                "post_epoch_split_evaluation",
                "condition_evidence_forward_passes",
            ],
            "excluded": [
                "cpu_data_loading",
                "loss_scalar_arithmetic",
                "optimizer_internal_floating_point_operations",
                "external_agent_chat_tokens_not_exposed_to_local_program",
            ],
        },
    }


def load_autoencoder_checkpoint(path, config):
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    if checkpoint.get("schemaVersion") != config.get("autoencoderRequiredCheckpointProvenance", config.get("requiredCheckpointProvenance")):
        raise ValueError("autoencoder checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("autoencoder checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("autoencoder checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("autoencoderSourceModelId", config.get("modelId")) or checkpoint.get("architectureVersion") != config.get("autoencoderSourceArchitectureVersion", config.get("architectureVersion")):
        raise ValueError("autoencoder checkpoint model architecture does not match")
    if checkpoint.get("trainingStage") != "autoencoder_warmup_only" or checkpoint.get("denoiserTrained") is not False:
        raise ValueError("initial checkpoint is not the approved autoencoder-only checkpoint")
    if not isinstance(checkpoint.get("autoencoderState"), dict):
        raise ValueError("autoencoder checkpoint state is missing")
    return checkpoint


def load_denoiser_checkpoint(path, config, package, resolution_stage):
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    expected_stage = config["training"]["resolutionStages"][resolution_stage - 1]
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("parent denoiser checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("parent denoiser checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("parent denoiser checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("modelId") or checkpoint.get("architectureVersion") != config.get("architectureVersion"):
        raise ValueError("parent denoiser checkpoint model architecture does not match")
    if checkpoint.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("parent denoiser checkpoint dataset package does not match")
    if checkpoint.get("actualLoadedConditionalSampleCount") != 64 or checkpoint.get("actualLoadedV7CapacityCount") != 64:
        raise ValueError("parent denoiser checkpoint was not trained on the repaired V7 64-row dataset")
    if checkpoint.get("actualLoadedSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("parent denoiser checkpoint split is not the repaired V7 48/8/4/4 split")
    if checkpoint.get("resolutionStage") != expected_stage or checkpoint.get("denoiserTrained") is not True:
        raise ValueError("parent denoiser checkpoint is not the completed preceding resolution stage")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("parent denoiser state is missing")
    return checkpoint


def load_r5_continuation_checkpoint(path, config, package):
    continuation = config.get("training", {}).get("r5Stage3CheckpointContinuation") or config.get("training", {}).get("r5CheckpointContinuation", {})
    if project_path(path) != continuation.get("sourceCheckpointPath"):
        raise ValueError("V7 R5 continuation checkpoint path is invalid")
    if sha256_file(path) != continuation.get("sourceCheckpointSha256"):
        raise ValueError("V7 R5 continuation checkpoint SHA-256 is invalid")
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("V7 R5 continuation checkpoint schema is invalid")
    if checkpoint.get("ownership") != OWNERSHIP or checkpoint.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("V7 R5 continuation checkpoint ownership or lane is invalid")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("V7 R5 continuation checkpoint contains forbidden upstream weights")
    if checkpoint.get("modelId") != config.get("modelId"):
        raise ValueError("V7 R5 continuation checkpoint model identity is invalid")
    if checkpoint.get("architectureVersion") != continuation.get("sourceArchitectureVersion"):
        raise ValueError("V7 R5 continuation checkpoint source architecture is invalid")
    if checkpoint.get("datasetPackageId") != package.get("packageId"):
        raise ValueError("V7 R5 continuation checkpoint dataset package does not match")
    if checkpoint.get("actualLoadedConditionalSampleCount") != 64 or checkpoint.get("actualLoadedV7CapacityCount") != 64:
        raise ValueError("V7 R5 continuation checkpoint capacity is not 64")
    if checkpoint.get("actualLoadedSplitCounts") != V7_MVP64_SPLIT_COUNTS:
        raise ValueError("V7 R5 continuation checkpoint split is not 48/8/4/4")
    if checkpoint.get("resolutionStage") != config["training"]["resolutionStages"][0]:
        raise ValueError("V7 R5 continuation checkpoint is not a Stage 0 checkpoint")
    if checkpoint.get("trainingStage") != "conditional_denoiser_single_sample_overfit_smoke":
        raise ValueError("V7 R5 continuation source is not an authorized bounded Smoke checkpoint")
    if checkpoint.get("formalInferenceEligible") is not False:
        raise ValueError("V7 R5 continuation checkpoint improperly claims formal inference eligibility")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("V7 R5 continuation denoiser state is missing")
    return checkpoint


def build_diffusion_schedule(config, device):
    beta_start = 0.0001
    beta_end = 0.02
    betas = torch.linspace(beta_start, beta_end, int(config["diffusionSteps"]), device=device)
    alphas_cumulative = torch.cumprod(1.0 - betas, dim=0)
    return {
        "alphasCumulative": alphas_cumulative,
        "betaStart": beta_start,
        "betaEnd": beta_end,
    }


def train_epoch(
    model,
    loader,
    optimizer,
    diffusion,
    latent_normalization,
    device,
    config,
    epoch_index,
    max_batches=None,
    on_batch_progress=None,
):
    model.denoiser.train()
    totals = {}
    count = 0
    samples_processed = 0
    for batch_index, batch in enumerate(loader):
        if max_batches is not None and batch_index >= max_batches:
            break
        batch_started = time.perf_counter()
        image = batch["image"].to(device)
        conditions = batch["conditions"].to(device)
        with torch.no_grad():
            latent = model.autoencoder.encode(image)
            latent = normalize_latent(latent, latent_normalization)
        timestep = training_timesteps(
            config,
            epoch_index,
            batch_index,
            len(loader),
            image.shape[0],
            diffusion["alphasCumulative"].shape[0],
            device,
        )
        noise = torch.randn_like(latent)
        noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
        optimizer.zero_grad(set_to_none=True)
        loss_metrics = predict_and_measure(
            model,
            noisy_latent,
            target_velocity,
            latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            config,
            image,
            latent_normalization,
        )
        trajectory_metrics = short_trajectory_supervision(
            model,
            noisy_latent,
            latent,
            timestep,
            diffusion["alphasCumulative"],
            conditions,
            image,
            latent_normalization,
            config,
        )
        if trajectory_metrics is not None:
            loss_metrics["compositeLossTensor"] = (
                loss_metrics["compositeLossTensor"]
                + trajectory_metrics["shortTrajectoryLossTensor"]
            )
            loss_metrics["compositeLoss"] = loss_metrics["compositeLossTensor"]
            loss_metrics.update(trajectory_metrics)
        loss_metrics["compositeLossTensor"].backward()
        optimizer.step()
        replay_passes = r5_path_replay_passes_per_epoch(config)
        replay_totals = {}
        for replay_index in range(replay_passes):
            replay_timestep = training_timesteps(
                config,
                epoch_index,
                batch_index + (replay_index + 1) * len(loader),
                len(loader) * (1 + replay_passes),
                image.shape[0],
                diffusion["alphasCumulative"].shape[0],
                device,
            )
            replay_noise = torch.randn_like(latent)
            replay_noisy_latent = add_noise(
                latent,
                replay_noise,
                replay_timestep,
                diffusion["alphasCumulative"],
            )
            replay_target_velocity = velocity_target(
                latent,
                replay_noise,
                replay_timestep,
                diffusion["alphasCumulative"],
            )
            optimizer.zero_grad(set_to_none=True)
            replay_metrics = path_hard_example_replay_supervision(
                model,
                replay_noisy_latent,
                replay_target_velocity,
                latent,
                replay_timestep,
                diffusion["alphasCumulative"],
                conditions,
                image,
                latent_normalization,
                config,
            )
            replay_metrics["pathHardExampleReplayLossTensor"].backward()
            optimizer.step()
            for key, value in replay_metrics.items():
                if key.endswith("Tensor"):
                    continue
                replay_totals[key] = replay_totals.get(key, 0.0) + float(value.detach())
        if replay_passes:
            for key, value in replay_totals.items():
                loss_metrics[key] = loss_metrics["compositeLossTensor"].new_tensor(value / replay_passes)
            loss_metrics["pathHardExampleReplayPasses"] = loss_metrics["compositeLossTensor"].new_tensor(float(replay_passes))
        for key, value in loss_metrics.items():
            if key.endswith("Tensor"):
                continue
            totals[key] = totals.get(key, 0.0) + float(value.detach())
        count += 1
        samples_processed += int(image.shape[0])
        if on_batch_progress is not None:
            on_batch_progress({
                "batch": count,
                "batchTarget": min(len(loader), max_batches) if max_batches is not None else len(loader),
                "batchLoss": float(loss_metrics["compositeLoss"].detach()),
                "rollingEpochLoss": totals["compositeLoss"] / count,
                "lastBatchDurationSeconds": time.perf_counter() - batch_started,
                "samplesInBatch": int(image.shape[0]),
                "samplesProcessedInEpoch": samples_processed,
                "optimizerStepsCompletedInEpoch": count * (1 + replay_passes),
            })
    if count == 0:
        raise ValueError("conditional denoiser training loader produced no batches")
    return {key: value / count for key, value in totals.items()}


def r5_path_replay_passes_per_epoch(config):
    contract = config.get("training", {}).get("pathHardExampleReplay", {})
    if contract.get("enabled") is not True:
        return 0
    if contract.get("targetSource") != "original_owner_approved_rgb_and_condition_pack_only":
        raise ValueError("R5 path replay requires original Owner-approved RGB and bound conditions")
    if contract.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("R5 path replay cannot use failed preview pixels as targets")
    passes = int(contract.get("passesPerEpoch", 0))
    if passes not in {1, 2}:
        raise ValueError("R5 path replay passes per epoch must be one or two")
    return passes


def path_hard_example_replay_supervision(
    model,
    noisy_latent,
    target_velocity,
    clean_latent,
    timesteps,
    alpha_bars,
    conditions,
    target_image,
    latent_normalization,
    config,
):
    if r5_path_replay_passes_per_epoch(config) == 0:
        raise ValueError("path hard-example replay is not enabled")
    measured = predict_and_measure(
        model,
        noisy_latent,
        target_velocity,
        clean_latent,
        timesteps,
        alpha_bars,
        conditions,
        config,
        target_image,
        latent_normalization,
    )
    loss_weights = config["training"]["denoiserLossWeights"]
    replay_loss = (
        measured["pathInteriorRgbMae"] * float(loss_weights["pathInteriorRgb"])
        + measured["pathForbiddenBoundaryRgbMae"] * float(loss_weights["pathForbiddenBoundaryRgb"])
    )
    coverage_loss = path_coverage_calibration_loss(
        measured["predictedRgbTensor"],
        target_image,
        conditions,
        config,
    )
    boundary_topology_loss = authorized_boundary_topology_loss(
        measured["predictedRgbTensor"],
        target_image,
        conditions,
        config,
    )
    coverage_contract = config.get("training", {}).get("pathCoverageCalibration", {})
    boundary_contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    if coverage_contract.get("enabled") is True:
        replay_loss = replay_loss + coverage_loss * float(coverage_contract["weight"])
    if boundary_contract.get("enabled") is True:
        replay_loss = replay_loss + boundary_topology_loss * float(boundary_contract["weight"])
    trajectory = short_trajectory_supervision(
        model,
        noisy_latent,
        clean_latent,
        timesteps,
        alpha_bars,
        conditions,
        target_image,
        latent_normalization,
        config,
    )
    if trajectory is None or "pathShortTrajectoryConsistencyLossTensor" not in trajectory:
        raise ValueError("R5 path replay requires path short-trajectory consistency supervision")
    replay_loss = replay_loss + trajectory["pathShortTrajectoryConsistencyLossTensor"]
    return {
        "pathHardExampleReplayLossTensor": replay_loss,
        "pathHardExampleReplayWeightedLoss": replay_loss,
        "pathHardExampleReplayInteriorRgbMae": measured["pathInteriorRgbMae"],
        "pathHardExampleReplayForbiddenBoundaryRgbMae": measured["pathForbiddenBoundaryRgbMae"],
        "pathHardExampleReplayTrajectoryConsistencyLoss": trajectory["pathShortTrajectoryConsistencyWeightedLoss"],
        "pathHardExampleReplayCoverageCalibrationLoss": coverage_loss,
        "pathHardExampleReplayAuthorizedBoundaryTopologyLoss": boundary_topology_loss,
    }


def short_trajectory_supervision(model, noisy_latent, clean_latent, timesteps, alpha_bars, conditions, target_image, latent_normalization, config):
    contract = config.get("training", {}).get("shortTrajectorySupervision", {})
    if contract.get("enabled") is not True:
        return None
    steps = int(contract["steps"])
    step_gap = int(contract["stepGap"])
    current_latent = noisy_latent
    current_timesteps = timesteps
    predicted_clean = None
    predicted_rgb_steps = []
    for step_index in range(steps):
        velocity = model.predict_velocity(current_latent, current_timesteps, conditions)
        recovered = [
            recover_from_velocity(current_latent[index:index + 1], velocity[index:index + 1], int(current_timesteps[index].item()), alpha_bars)[0]
            for index in range(current_latent.shape[0])
        ]
        step_predicted_clean = torch.cat(recovered, dim=0)
        predicted_rgb_steps.append(
            model.autoencoder.decode(denormalize_latent(step_predicted_clean, latent_normalization))
        )
        if step_index + 1 == steps:
            predicted_clean = step_predicted_clean
            break
        previous_values = [max(0, int(value.item()) - step_gap) for value in current_timesteps]
        current_latent = torch.cat([
            deterministic_velocity_step(
                current_latent[index:index + 1],
                velocity[index:index + 1],
                int(current_timesteps[index].item()),
                previous_values[index],
                alpha_bars,
            )
            for index in range(current_latent.shape[0])
        ], dim=0)
        current_timesteps = torch.tensor(previous_values, device=current_latent.device, dtype=torch.long)
    if predicted_clean is None:
        raise ValueError("short trajectory supervision did not produce a clean latent prediction")
    predicted_rgb = predicted_rgb_steps[-1]
    latent_loss = torch.nn.functional.l1_loss(predicted_clean, clean_latent)
    rgb_loss = torch.nn.functional.l1_loss(predicted_rgb, target_image)
    rgb_gradient_loss, _ = multiscale_latent_hierarchy_losses(predicted_rgb, target_image, config)
    raw = (
        latent_loss * float(contract.get("cleanLatentWeight", 1.0))
        + rgb_loss * float(contract.get("decodedRgbWeight", 1.0))
        + rgb_gradient_loss * float(contract.get("decodedRgbGradientWeight", 0.5))
    )
    weighted = raw * float(contract["weight"])
    result = {
        "shortTrajectoryLossTensor": weighted,
        "shortTrajectoryWeightedLoss": weighted,
        "shortTrajectoryRawLoss": raw,
        "shortTrajectoryCleanLatentMae": latent_loss,
        "shortTrajectoryDecodedRgbMae": rgb_loss,
        "shortTrajectoryDecodedRgbGradientMae": rgb_gradient_loss,
        "shortTrajectoryStepCount": predicted_clean.new_tensor(float(steps)),
    }
    path_consistency = path_short_trajectory_consistency_loss(
        predicted_rgb_steps,
        target_image,
        conditions,
        config,
    )
    if path_consistency is not None:
        result["shortTrajectoryLossTensor"] = (
            result["shortTrajectoryLossTensor"]
            + path_consistency["pathShortTrajectoryConsistencyLossTensor"]
        )
        result["shortTrajectoryWeightedLoss"] = result["shortTrajectoryLossTensor"]
        result.update(path_consistency)
    coverage_boundary = path_coverage_boundary_short_trajectory_loss(
        predicted_rgb_steps,
        target_image,
        conditions,
        config,
    )
    if coverage_boundary is not None:
        result["shortTrajectoryLossTensor"] = (
            result["shortTrajectoryLossTensor"]
            + coverage_boundary["pathCoverageBoundaryShortTrajectoryLossTensor"]
        )
        result["shortTrajectoryWeightedLoss"] = result["shortTrajectoryLossTensor"]
        result.update(coverage_boundary)
    return result


def path_short_trajectory_consistency_loss(predicted_rgb_steps, target_rgb, conditions, config):
    contract = config.get("training", {}).get("pathShortTrajectoryConsistency", {})
    if contract.get("enabled") is not True:
        return None
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("path short-trajectory consistency requires terrain_path_ground")
    if len(predicted_rgb_steps) < 2:
        raise ValueError("path short-trajectory consistency requires at least two RGB predictions")

    path_target_losses = [
        path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config)
        for predicted_rgb in predicted_rgb_steps
    ]
    forbidden_target_losses = [
        path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config)
        for predicted_rgb in predicted_rgb_steps
    ]
    path_step_consistency = [
        masked_pair_rgb_l1(
            predicted_rgb_steps[index],
            predicted_rgb_steps[index - 1],
            conditions,
            config,
            "terrain_path_ground",
        )
        for index in range(1, len(predicted_rgb_steps))
    ]
    forbidden_step_consistency = [
        forbidden_boundary_pair_rgb_l1(
            predicted_rgb_steps[index],
            predicted_rgb_steps[index - 1],
            conditions,
            config,
        )
        for index in range(1, len(predicted_rgb_steps))
    ]
    path_target = torch.stack(path_target_losses).mean()
    forbidden_target = torch.stack(forbidden_target_losses).mean()
    path_temporal = torch.stack(path_step_consistency).mean()
    forbidden_temporal = torch.stack(forbidden_step_consistency).mean()
    raw = path_target + forbidden_target + path_temporal + forbidden_temporal
    weighted = raw * float(contract["weight"])
    return {
        "pathShortTrajectoryConsistencyLossTensor": weighted,
        "pathShortTrajectoryConsistencyWeightedLoss": weighted,
        "pathShortTrajectoryConsistencyRawLoss": raw,
        "pathShortTrajectoryTargetInteriorRgbMae": path_target,
        "pathShortTrajectoryTargetForbiddenBoundaryRgbMae": forbidden_target,
        "pathShortTrajectoryStepInteriorConsistencyMae": path_temporal,
        "pathShortTrajectoryStepForbiddenBoundaryConsistencyMae": forbidden_temporal,
    }


def path_coverage_boundary_short_trajectory_loss(predicted_rgb_steps, target_rgb, conditions, config):
    coverage_contract = config.get("training", {}).get("pathCoverageCalibration", {})
    boundary_contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    activation_mass_contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    coverage_drift_contract = config.get("training", {}).get("shortTrajectoryCoverageDrift", {})
    if not any(contract.get("enabled") is True for contract in (
        coverage_contract,
        boundary_contract,
        activation_mass_contract,
        coverage_drift_contract,
    )):
        return None
    reference = predicted_rgb_steps[0]
    coverage = reference.new_zeros(())
    boundary = reference.new_zeros(())
    activation_mass = reference.new_zeros(())
    coverage_drift = reference.new_zeros(())
    if coverage_contract.get("enabled") is True:
        coverage = torch.stack([
            path_coverage_calibration_loss(predicted_rgb, target_rgb, conditions, config)
            for predicted_rgb in predicted_rgb_steps
        ]).mean()
    if boundary_contract.get("enabled") is True:
        boundary = torch.stack([
            authorized_boundary_topology_loss(predicted_rgb, target_rgb, conditions, config)
            for predicted_rgb in predicted_rgb_steps
        ]).mean()
    if activation_mass_contract.get("enabled") is True:
        activation_mass = torch.stack([
            path_activation_mass_calibration_loss(predicted_rgb, target_rgb, conditions, config)
            for predicted_rgb in predicted_rgb_steps
        ]).mean()
    if coverage_drift_contract.get("enabled") is True:
        coverage_drift = short_trajectory_coverage_drift_loss(
            predicted_rgb_steps,
            target_rgb,
            conditions,
            config,
        )
    weighted = reference.new_zeros(())
    if coverage_contract.get("enabled") is True:
        weighted = weighted + coverage * float(coverage_contract["weight"])
    if boundary_contract.get("enabled") is True:
        weighted = weighted + boundary * float(boundary_contract["weight"])
    if activation_mass_contract.get("enabled") is True:
        weighted = weighted + activation_mass * float(activation_mass_contract["weight"])
    if coverage_drift_contract.get("enabled") is True:
        weighted = weighted + coverage_drift * float(coverage_drift_contract["weight"])
    return {
        "pathCoverageBoundaryShortTrajectoryLossTensor": weighted,
        "pathCoverageBoundaryShortTrajectoryWeightedLoss": weighted,
        "pathCoverageShortTrajectoryRawLoss": coverage,
        "authorizedBoundaryShortTrajectoryRawLoss": boundary,
        "pathActivationMassShortTrajectoryRawLoss": activation_mass,
        "shortTrajectoryCoverageDriftRawLoss": coverage_drift,
    }


def evaluate_velocity_prediction(model, loader, diffusion, latent_normalization, device, seed, timesteps, config):
    was_training = model.denoiser.training
    model.denoiser.eval()
    totals = {}
    count = 0
    with torch.no_grad():
        for batch_index, batch in enumerate(loader):
            image = batch["image"].to(device)
            conditions = batch["conditions"].to(device)
            latent = model.autoencoder.encode(image)
            latent = normalize_latent(latent, latent_normalization)
            for timestep_value in timesteps:
                timestep = torch.full((image.shape[0],), int(timestep_value), device=device, dtype=torch.long)
                generator = torch.Generator(device=device).manual_seed(seed + batch_index * 10007 + int(timestep_value))
                noise = torch.randn(latent.shape, device=device, dtype=latent.dtype, generator=generator)
                noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
                target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
                loss_metrics = predict_and_measure(
                    model,
                    noisy_latent,
                    target_velocity,
                    latent,
                    timestep,
                    diffusion["alphasCumulative"],
                    conditions,
                    config,
                    image,
                    latent_normalization,
                )
                for key, value in loss_metrics.items():
                    if key.endswith("Tensor") or key == "compositeLoss":
                        continue
                    totals[key] = totals.get(key, 0.0) + float(value.detach())
                count += 1
    if was_training:
        model.denoiser.train()
    if count == 0:
        raise ValueError("conditional denoiser evaluation loader produced no batches")
    return {
        **{key: value / count for key, value in totals.items()},
        "fixedTimesteps": [int(value) for value in timesteps],
    }


def predict_and_measure(model, noisy_latent, target_velocity, clean_latent, timesteps, alpha_bars, conditions, config, target_image=None, latent_normalization=None):
    alpha = alpha_bars[timesteps].view(-1, 1, 1, 1)
    if is_v5_or_later(config):
        predicted_velocity = model.predict_velocity(noisy_latent, timesteps, conditions)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        if is_v6_or_later(config):
            if target_image is None or latent_normalization is None:
                raise ValueError("V6 decoded RGB supervision requires target image and latent normalization")
            predicted_rgb = model.autoencoder.decode(denormalize_latent(predicted_clean, latent_normalization))
            return composite_denoiser_losses_v6(
                predicted_velocity,
                target_velocity,
                predicted_clean,
                clean_latent,
                predicted_conditions,
                target_conditions,
                predicted_rgb,
                target_image,
                conditions,
                config,
            )
        return composite_denoiser_losses_v5(
            predicted_velocity,
            target_velocity,
            predicted_clean,
            clean_latent,
            predicted_conditions,
            target_conditions,
            config,
        )
    predicted_velocity, predicted_conditions, target_conditions = model.predict_velocity_with_condition_reconstruction(
        noisy_latent,
        timesteps,
        conditions,
    )
    return composite_denoiser_losses(
        predicted_velocity,
        target_velocity,
        noisy_latent,
        clean_latent,
        timesteps,
        alpha_bars,
        predicted_conditions,
        target_conditions,
        config,
    )


def composite_denoiser_losses(predicted_velocity, target_velocity, noisy_latent, clean_latent, timesteps, alpha_bars, predicted_conditions, target_conditions, config):
    functional = torch.nn.functional
    alpha = alpha_bars[timesteps].view(-1, 1, 1, 1)
    predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
    velocity_loss = functional.mse_loss(predicted_velocity, target_velocity)
    clean_loss = functional.l1_loss(predicted_clean, clean_latent)
    gradient_loss = latent_gradient_mae(predicted_clean, clean_latent)
    discrete_indices, continuous_indices = condition_type_indices(config)
    discrete_condition_loss = functional.binary_cross_entropy(
        predicted_conditions[:, discrete_indices],
        target_conditions[:, discrete_indices],
    )
    continuous_condition_loss = functional.l1_loss(
        predicted_conditions[:, continuous_indices],
        target_conditions[:, continuous_indices],
    )
    weights = config["training"]["denoiserLossWeights"]
    composite_loss = (
        velocity_loss * float(weights["velocity"])
        + clean_loss * float(weights["cleanLatent"])
        + gradient_loss * float(weights["cleanLatentGradient"])
        + discrete_condition_loss * float(weights["discreteConditionReconstruction"])
        + continuous_condition_loss * float(weights["continuousConditionReconstruction"])
    )
    checkpoint_weights = config["training"]["bestCheckpointMetricWeights"]
    checkpoint_score = (
        velocity_loss * float(checkpoint_weights["velocityPredictionMse"])
        + clean_loss * float(checkpoint_weights["cleanLatentMae"])
        + gradient_loss * float(checkpoint_weights["cleanLatentGradientMae"])
        + discrete_condition_loss * float(checkpoint_weights["discreteConditionReconstructionBce"])
        + continuous_condition_loss * float(checkpoint_weights["continuousConditionReconstructionMae"])
    )
    return {
        "compositeLossTensor": composite_loss,
        "compositeLoss": composite_loss,
        "velocityPredictionMse": velocity_loss,
        "cleanLatentMae": clean_loss,
        "cleanLatentGradientMae": gradient_loss,
        "discreteConditionReconstructionBce": discrete_condition_loss,
        "continuousConditionReconstructionMae": continuous_condition_loss,
        "compositeConditionQualityScore": checkpoint_score,
    }


def composite_denoiser_losses_v5(predicted_velocity, target_velocity, predicted_clean, clean_latent, predicted_conditions, target_conditions, config):
    functional = torch.nn.functional
    velocity_loss = functional.mse_loss(predicted_velocity, target_velocity)
    clean_loss = functional.l1_loss(predicted_clean, clean_latent)
    gradient_loss, laplacian_loss = multiscale_latent_hierarchy_losses(predicted_clean, clean_latent, config)
    quiet_region_loss = quiet_region_excess_loss(predicted_clean, clean_latent, config)
    discrete_indices, continuous_indices = condition_type_indices(config)
    discrete_condition_loss = balanced_binary_condition_loss(
        predicted_conditions[:, discrete_indices],
        target_conditions[:, discrete_indices],
    )
    continuous_condition_loss = functional.l1_loss(
        predicted_conditions[:, continuous_indices],
        target_conditions[:, continuous_indices],
    )
    values = {
        "velocityPredictionMse": velocity_loss,
        "cleanLatentMae": clean_loss,
        "multiscaleLatentGradientMae": gradient_loss,
        "multiscaleLatentLaplacianMae": laplacian_loss,
        "quietRegionExcess": quiet_region_loss,
        "discreteConditionOutputBindingBce": discrete_condition_loss,
        "continuousConditionOutputBindingMae": continuous_condition_loss,
    }
    training_key_map = {
        "velocity": "velocityPredictionMse",
        "cleanLatent": "cleanLatentMae",
        "multiscaleLatentGradient": "multiscaleLatentGradientMae",
        "multiscaleLatentLaplacian": "multiscaleLatentLaplacianMae",
        "quietRegionExcess": "quietRegionExcess",
        "discreteConditionOutputBinding": "discreteConditionOutputBindingBce",
        "continuousConditionOutputBinding": "continuousConditionOutputBindingMae",
    }
    composite_loss = sum(
        values[training_key_map[key]] * float(weight)
        for key, weight in config["training"]["denoiserLossWeights"].items()
        if key in training_key_map
    )
    checkpoint_score = sum(
        values[key] * float(weight)
        for key, weight in config["training"]["bestCheckpointMetricWeights"].items()
        if key in values
    )
    return {
        "compositeLossTensor": composite_loss,
        "compositeLoss": composite_loss,
        **values,
        "compositeConditionQualityScore": checkpoint_score,
    }


def composite_denoiser_losses_v6(predicted_velocity, target_velocity, predicted_clean, clean_latent, predicted_conditions, target_conditions, predicted_rgb, target_rgb, full_conditions, config):
    base = composite_denoiser_losses_v5(
        predicted_velocity,
        target_velocity,
        predicted_clean,
        clean_latent,
        predicted_conditions,
        target_conditions,
        config,
    )
    rgb_mae = torch.nn.functional.l1_loss(predicted_rgb, target_rgb)
    rgb_gradient, rgb_laplacian = multiscale_latent_hierarchy_losses(predicted_rgb, target_rgb, config)
    rgb_quiet = quiet_region_excess_loss(predicted_rgb, target_rgb, config)
    sparse_region = sparse_region_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    sparse_contrast = sparse_region_contrast_loss(predicted_rgb, target_rgb, full_conditions, config)
    spatial_grid = spatial_grid_rgb_loss(predicted_rgb, target_rgb)
    path_boundary = path_boundary_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    object_semantic = object_semantic_rgb_losses(predicted_rgb, target_rgb, full_conditions, config)
    path_interior = path_interior_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    path_forbidden_boundary = path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, full_conditions, config)
    path_coverage_calibration = path_coverage_calibration_loss(predicted_rgb, target_rgb, full_conditions, config)
    authorized_boundary_topology = authorized_boundary_topology_loss(predicted_rgb, target_rgb, full_conditions, config)
    path_activation_mass_calibration = path_activation_mass_calibration_loss(
        predicted_rgb,
        target_rgb,
        full_conditions,
        config,
    )
    values = {
        key: value
        for key, value in base.items()
        if key not in {"compositeLossTensor", "compositeLoss", "compositeConditionQualityScore"}
    }
    values.update({
        "decodedRgbMae": rgb_mae,
        "decodedRgbGradientMae": rgb_gradient,
        "decodedRgbLaplacianMae": rgb_laplacian,
        "decodedRgbQuietRegionExcess": rgb_quiet,
        "sparseRegionDecodedRgbMae": sparse_region,
        "sparseRegionContrastMae": sparse_contrast,
        "spatialGridRgbMae": spatial_grid,
        "pathBoundaryRgbMae": path_boundary,
        **object_semantic,
        "pathInteriorRgbMae": path_interior,
        "pathForbiddenBoundaryRgbMae": path_forbidden_boundary,
        "pathCoverageCalibrationLoss": path_coverage_calibration,
        "authorizedBoundaryTopologyLoss": authorized_boundary_topology,
        "pathActivationMassCalibrationLoss": path_activation_mass_calibration,
        "predictedRgbTensor": predicted_rgb,
    })
    key_map = {
        "velocity": "velocityPredictionMse",
        "cleanLatent": "cleanLatentMae",
        "multiscaleLatentGradient": "multiscaleLatentGradientMae",
        "multiscaleLatentLaplacian": "multiscaleLatentLaplacianMae",
        "quietRegionExcess": "quietRegionExcess",
        "discreteConditionOutputBinding": "discreteConditionOutputBindingBce",
        "continuousConditionOutputBinding": "continuousConditionOutputBindingMae",
        "decodedRgb": "decodedRgbMae",
        "decodedRgbGradient": "decodedRgbGradientMae",
        "decodedRgbLaplacian": "decodedRgbLaplacianMae",
        "decodedRgbQuietRegionExcess": "decodedRgbQuietRegionExcess",
        "sparseRegionDecodedRgb": "sparseRegionDecodedRgbMae",
        "sparseRegionContrast": "sparseRegionContrastMae",
        "spatialGridRgb": "spatialGridRgbMae",
        "pathBoundaryRgb": "pathBoundaryRgbMae",
        "objectSemanticRgb": "objectSemanticRgbMae",
        "pathInteriorRgb": "pathInteriorRgbMae",
        "pathForbiddenBoundaryRgb": "pathForbiddenBoundaryRgbMae",
    }
    composite = sum(
        values[key_map[key]] * float(weight)
        for key, weight in config["training"]["denoiserLossWeights"].items()
        if key in key_map
    )
    coverage_contract = config.get("training", {}).get("pathCoverageCalibration", {})
    boundary_contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    activation_mass_contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    if coverage_contract.get("enabled") is True:
        composite = composite + path_coverage_calibration * float(coverage_contract["weight"])
    if boundary_contract.get("enabled") is True:
        composite = composite + authorized_boundary_topology * float(boundary_contract["weight"])
    if activation_mass_contract.get("enabled") is True:
        composite = composite + path_activation_mass_calibration * float(activation_mass_contract["weight"])
    checkpoint = sum(
        values[key] * float(weight)
        for key, weight in config["training"]["bestCheckpointMetricWeights"].items()
        if key in values
    )
    return {
        "compositeLossTensor": composite,
        "compositeLoss": composite,
        **values,
        "compositeConditionQualityScore": checkpoint,
    }


def sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    losses = []
    for name in config["training"].get("sparseRgbConditionChannels", []):
        mask = conditions[:, order.index(name):order.index(name) + 1]
        mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
        denominator = mask.sum() * predicted_rgb.shape[1]
        if float(denominator.detach()) > 0.0:
            losses.append(((predicted_rgb - target_rgb).abs() * mask).sum() / denominator)
    if not losses:
        return predicted_rgb.new_zeros(())
    return torch.stack(losses).mean()


def masked_condition_rgb_loss(predicted_rgb, target_rgb, conditions, config, channel_name):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
    denominator = mask.sum() * predicted_rgb.shape[1]
    if float(denominator.detach()) <= 0.0:
        return predicted_rgb.new_zeros(())
    return ((predicted_rgb - target_rgb).abs() * mask).sum() / denominator


def object_semantic_rgb_losses(predicted_rgb, target_rgb, conditions, config):
    training = config.get("training", {})
    channels = list(training.get("semanticRgbConditionChannels", []))
    if not channels:
        zero = predicted_rgb.new_zeros(())
        return {
            "objectFootprintsRgbMae": zero,
            "objectTreeRgbMae": zero,
            "objectRockRgbMae": zero,
            "objectVegetationRgbMae": zero,
            "objectSemanticRgbMae": zero,
        }
    weights = training.get("objectSemanticChannelWeights", {})
    losses = {
        name: masked_condition_rgb_loss(predicted_rgb, target_rgb, conditions, config, name)
        for name in channels
    }
    denominator = sum(float(weights.get(name, 1.0)) for name in channels)
    aggregate = sum(losses[name] * float(weights.get(name, 1.0)) for name in channels) / denominator
    zero = predicted_rgb.new_zeros(())
    return {
        "objectFootprintsRgbMae": losses.get("object_footprints", zero),
        "objectTreeRgbMae": losses.get("object_tree", zero),
        "objectRockRgbMae": losses.get("object_rock", zero),
        "objectVegetationRgbMae": losses.get("object_vegetation", zero),
        "objectSemanticRgbMae": aggregate,
    }


def path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    return masked_condition_rgb_loss(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
        "terrain_path_ground",
    )


def masked_pair_rgb_l1(left_rgb, right_rgb, conditions, config, channel_name):
    order = list(config["conditionChannelOrder"])
    if channel_name not in order:
        raise ValueError(f"condition channel is missing: {channel_name}")
    mask = conditions[:, order.index(channel_name):order.index(channel_name) + 1]
    mask = torch.nn.functional.interpolate(mask, size=left_rgb.shape[-2:], mode="nearest")
    denominator = (mask.sum() * left_rgb.shape[1]).clamp_min(1.0)
    return ((left_rgb - right_rgb).abs() * mask).sum() / denominator


def evaluate_deterministic_rollout_rgb_quality(model, dataset, diffusion, latent_normalization, device, seed, config):
    was_training = model.denoiser.training
    model.denoiser.eval()
    totals = {"rolloutRgbMae": 0.0, "rolloutRgbGradientMae": 0.0, "rolloutRgbLaplacianMae": 0.0, "rolloutSparseRegionRgbMae": 0.0}
    count = min(len(dataset), int(config["training"].get("checkpointRolloutSampleCount", 1)))
    if count == 0:
        raise ValueError("V6 rollout checkpoint validation has no validation samples")
    with torch.no_grad():
        for index in range(count):
            row = dataset[index]
            target_rgb = row["image"].unsqueeze(0).to(device)
            conditions = row["conditions"].unsqueeze(0).to(device)
            latent_shape = model.autoencoder.encode(target_rgb).shape
            generator = torch.Generator(device=device).manual_seed(seed + index)
            latent = torch.randn(latent_shape, device=device, generator=generator)
            steps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)
            for step_index, timestep in enumerate(steps):
                timestep_batch = torch.full((1,), int(timestep.item()), device=device, dtype=torch.long)
                velocity = model.predict_velocity(latent, timestep_batch, conditions)
                previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
                latent = deterministic_velocity_step(latent, velocity, int(timestep.item()), previous, diffusion["alphasCumulative"])
            predicted_rgb = model.autoencoder.decode(denormalize_latent(latent, latent_normalization))
            gradient, laplacian = multiscale_latent_hierarchy_losses(predicted_rgb, target_rgb, config)
            sparse = sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config)
            totals["rolloutRgbMae"] += float(torch.nn.functional.l1_loss(predicted_rgb, target_rgb))
            totals["rolloutRgbGradientMae"] += float(gradient)
            totals["rolloutRgbLaplacianMae"] += float(laplacian)
            totals["rolloutSparseRegionRgbMae"] += float(sparse)
    if was_training:
        model.denoiser.train()
    result = {key: value / count for key, value in totals.items()}
    weights = config["training"]["rolloutCheckpointMetricWeights"]
    result["rolloutRgbQualityScore"] = sum(result[key] * float(weight) for key, weight in weights.items())
    result["rolloutSampleCount"] = count
    return result


def evaluate_deterministic_rollout_rgb_quality_v7(model, dataset, diffusion, latent_normalization, device, seed, config, preview_output_dir=None, epoch_number=None):
    was_training = model.denoiser.training
    model.denoiser.eval()
    totals = {
        "rolloutRgbMae": 0.0,
        "rolloutRgbGradientMae": 0.0,
        "rolloutRgbLaplacianMae": 0.0,
        "rolloutSparseRegionRgbMae": 0.0,
        "rolloutRegionContrastMae": 0.0,
        "rolloutSpatialGridRgbMae": 0.0,
        "rolloutPathBoundaryRgbMae": 0.0,
        "rolloutObjectSemanticRgbMae": 0.0,
        "rolloutPathInteriorRgbMae": 0.0,
        "rolloutPathForbiddenBoundaryRgbMae": 0.0,
    }
    sample_count = len(dataset)
    seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
    if sample_count == 0:
        raise ValueError("V7 rollout checkpoint validation has no validation samples")
    trajectory_scores = []
    with torch.no_grad():
        for index in range(sample_count):
            row = dataset[index]
            target_rgb = row["image"].unsqueeze(0).to(device)
            conditions = row["conditions"].unsqueeze(0).to(device)
            latent_shape = model.autoencoder.encode(target_rgb).shape
            for seed_index in range(seed_count):
                generator = torch.Generator(device=device).manual_seed(seed + index * seed_count + seed_index)
                latent = torch.randn(latent_shape, device=device, generator=generator)
                steps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)
                for step_index, timestep in enumerate(steps):
                    timestep_batch = torch.full((1,), int(timestep.item()), device=device, dtype=torch.long)
                    velocity = model.predict_velocity(latent, timestep_batch, conditions)
                    previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
                    latent = deterministic_velocity_step(latent, velocity, int(timestep.item()), previous, diffusion["alphasCumulative"])
                predicted_rgb = model.autoencoder.decode(denormalize_latent(latent, latent_normalization)).clamp(0.0, 1.0)
                gradient, laplacian = multiscale_latent_hierarchy_losses(predicted_rgb, target_rgb, config)
                object_semantic = object_semantic_rgb_losses(predicted_rgb, target_rgb, conditions, config)
                values = {
                    "rolloutRgbMae": float(torch.nn.functional.l1_loss(predicted_rgb, target_rgb)),
                    "rolloutRgbGradientMae": float(gradient),
                    "rolloutRgbLaplacianMae": float(laplacian),
                    "rolloutSparseRegionRgbMae": float(sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutRegionContrastMae": float(sparse_region_contrast_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutSpatialGridRgbMae": float(spatial_grid_rgb_loss(predicted_rgb, target_rgb)),
                    "rolloutPathBoundaryRgbMae": float(path_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutObjectSemanticRgbMae": float(object_semantic["objectSemanticRgbMae"]),
                    "rolloutPathInteriorRgbMae": float(path_interior_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutPathForbiddenBoundaryRgbMae": float(path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                }
                for key, value in values.items():
                    totals[key] += value
                weights = config["training"]["rolloutCheckpointMetricWeights"]
                trajectory_scores.append(sum(values[key] * float(weight) for key, weight in weights.items()))
                if index == 0 and seed_index == 0 and should_save_epoch_preview(config, epoch_number):
                    preview_output_dir.mkdir(parents=True, exist_ok=True)
                    preview_path = preview_output_dir / f"epoch-{epoch_number:03d}-{row['conditionLabel']}-seed-{seed}.png"
                    save_tensor_png(predicted_rgb[0], preview_path)
    if was_training:
        model.denoiser.train()
    trajectory_count = sample_count * seed_count
    result = {key: value / trajectory_count for key, value in totals.items()}
    result["rolloutAverageQualityScore"] = sum(
        result[key] * float(weight)
        for key, weight in config["training"]["rolloutCheckpointMetricWeights"].items()
    )
    result["rolloutWorstTrajectoryQualityScore"] = max(trajectory_scores)
    result["rolloutRgbQualityScore"] = (
        result["rolloutAverageQualityScore"]
        + result["rolloutWorstTrajectoryQualityScore"] * float(config["training"].get("checkpointWorstTrajectoryWeight", 1.0))
    )
    result["rolloutSampleCount"] = sample_count
    result["rolloutSeedCountPerSample"] = seed_count
    result["rolloutTrajectoryCount"] = trajectory_count
    return result


def sparse_region_contrast_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    losses = []
    for name in config["training"].get("sparseRgbConditionChannels", []):
        mask = conditions[:, order.index(name):order.index(name) + 1]
        mask = torch.nn.functional.interpolate(mask, size=predicted_rgb.shape[-2:], mode="nearest")
        inside_count = mask.sum().clamp_min(1.0)
        outside = 1.0 - mask
        outside_count = outside.sum().clamp_min(1.0)
        predicted_contrast = (predicted_rgb * mask).sum(dim=(2, 3)) / inside_count - (predicted_rgb * outside).sum(dim=(2, 3)) / outside_count
        target_contrast = (target_rgb * mask).sum(dim=(2, 3)) / inside_count - (target_rgb * outside).sum(dim=(2, 3)) / outside_count
        losses.append(torch.nn.functional.l1_loss(predicted_contrast, target_contrast))
    if not losses:
        return predicted_rgb.new_zeros(())
    return torch.stack(losses).mean()


def spatial_grid_rgb_loss(predicted_rgb, target_rgb):
    predicted_grid = torch.nn.functional.adaptive_avg_pool2d(predicted_rgb, (6, 8))
    target_grid = torch.nn.functional.adaptive_avg_pool2d(target_rgb, (6, 8))
    return torch.nn.functional.l1_loss(predicted_grid, target_grid)


def path_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    path_mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    path_mask = torch.nn.functional.interpolate(path_mask, size=predicted_rgb.shape[-2:], mode="nearest")
    band = max(1, round(min(predicted_rgb.shape[-2:]) * float(config["training"].get("pathBoundaryBandRatio", 0.04))))
    boundary = torch.zeros_like(path_mask)
    boundary[:, :, :band, :] = 1.0
    boundary[:, :, -band:, :] = 1.0
    boundary[:, :, :, :band] = 1.0
    boundary[:, :, :, -band:] = 1.0
    mask = path_mask * boundary
    denominator = (mask.sum() * predicted_rgb.shape[1]).clamp_min(1.0)
    return ((predicted_rgb - target_rgb).abs() * mask).sum() / denominator


def path_forbidden_boundary_rgb_loss(predicted_rgb, target_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    path_mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    path_mask = torch.nn.functional.interpolate(path_mask, size=predicted_rgb.shape[-2:], mode="nearest")
    band = max(1, round(min(predicted_rgb.shape[-2:]) * float(config["training"].get("pathBoundaryBandRatio", 0.04))))
    boundary = torch.zeros_like(path_mask)
    boundary[:, :, :band, :] = 1.0
    boundary[:, :, -band:, :] = 1.0
    boundary[:, :, :, :band] = 1.0
    boundary[:, :, :, -band:] = 1.0
    forbidden = boundary * (1.0 - path_mask.clamp(0.0, 1.0))
    denominator = (forbidden.sum() * predicted_rgb.shape[1]).clamp_min(1.0)
    return ((predicted_rgb - target_rgb).abs() * forbidden).sum() / denominator


def original_path_condition_mask(conditions, config, output_size):
    order = list(config["conditionChannelOrder"])
    if "terrain_path_ground" not in order:
        raise ValueError("terrain_path_ground condition channel is missing")
    mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    return torch.nn.functional.interpolate(mask, size=output_size, mode="nearest").clamp(0.0, 1.0)


def path_visual_activation(rgb, target_rgb, path_mask, temperature):
    denominator = path_mask.sum(dim=(2, 3), keepdim=True).clamp_min(1.0)
    prototype = (target_rgb * path_mask).sum(dim=(2, 3), keepdim=True) / denominator
    distance = (rgb - prototype).abs().mean(dim=1, keepdim=True)
    return torch.exp(-distance / max(float(temperature), 1e-4))


def path_support_corridor(path_mask, config, contract):
    ratio = float(contract.get("supportBandRatio", config.get("training", {}).get("pathBoundaryBandRatio", 0.04)))
    radius = max(1, round(min(path_mask.shape[-2:]) * ratio))
    kernel = radius * 2 + 1
    return torch.nn.functional.max_pool2d(path_mask, kernel_size=kernel, stride=1, padding=radius).clamp(0.0, 1.0)


def path_coverage_calibration_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("pathCoverageCalibration", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("path coverage calibration requires terrain_path_ground")
    if contract.get("targetSource") != "original_condition_mask_support_only":
        raise ValueError("path coverage calibration target source is invalid")
    if contract.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("machine-review thresholds cannot be used as path coverage training targets")
    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, contract)
    temperature = float(contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    excess = torch.nn.functional.relu(predicted_activation - target_activation - float(contract.get("activationMargin", 0.0)))
    outside_support = 1.0 - support
    denominator = outside_support.sum().clamp_min(1.0)
    return (excess * outside_support).sum() / denominator


def path_activation_mass_calibration_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("path activation-mass calibration requires terrain_path_ground")
    if contract.get("targetSource") != "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only":
        raise ValueError("path activation-mass calibration target source is invalid")
    if contract.get("failedPreviewPixelsUsedAsTrainingTargets") is not False:
        raise ValueError("failed preview pixels cannot be used as path activation-mass targets")
    if contract.get("machineReviewThresholdUsedAsTrainingTarget") is not False:
        raise ValueError("machine-review thresholds cannot be used as path activation-mass targets")
    if contract.get("lossForm") != "symmetric_log_activation_mass_ratio_plus_outside_support_leakage":
        raise ValueError("path activation-mass calibration loss form is invalid")

    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, contract)
    temperature = float(contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    support_denominator = support.sum(dim=(2, 3)).clamp_min(1.0)
    predicted_mass = (predicted_activation * support).sum(dim=(2, 3)) / support_denominator
    target_mass = (target_activation * support).sum(dim=(2, 3)) / support_denominator
    epsilon = max(float(contract.get("epsilon", 1e-6)), 1e-8)
    symmetric_log_ratio = torch.abs(torch.log((predicted_mass + epsilon) / (target_mass + epsilon))).mean()

    outside_support = 1.0 - support
    excess = torch.nn.functional.relu(
        predicted_activation
        - target_activation
        - float(contract.get("activationMargin", 0.0))
    ) * outside_support
    outside_denominator = outside_support.sum(dim=(2, 3)).clamp_min(1.0)
    outside_support_leakage = (excess.sum(dim=(2, 3)) / outside_denominator).mean()
    return symmetric_log_ratio + outside_support_leakage


def short_trajectory_coverage_drift_loss(predicted_rgb_steps, target_rgb, conditions, config):
    contract = config.get("training", {}).get("shortTrajectoryCoverageDrift", {})
    if contract.get("enabled") is not True:
        return target_rgb.new_zeros(())
    if contract.get("source") != "current_training_prediction_steps_against_original_target_activation_mass_only":
        raise ValueError("short-trajectory coverage drift source is invalid")
    if contract.get("failedPreviewTrajectoryUsedAsTrainingTarget") is not False:
        raise ValueError("failed preview trajectories cannot be used as short-trajectory coverage targets")
    if len(predicted_rgb_steps) < 2:
        raise ValueError("short-trajectory coverage drift requires at least two current training predictions")

    activation_contract = config.get("training", {}).get("pathActivationMassCalibration", {})
    path_mask = original_path_condition_mask(conditions, config, target_rgb.shape[-2:])
    support = path_support_corridor(path_mask, config, activation_contract)
    temperature = float(activation_contract.get("appearanceTemperature", 0.2))
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    denominator = support.sum(dim=(2, 3)).clamp_min(1.0)
    target_mass = (target_activation * support).sum(dim=(2, 3)) / denominator
    epsilon = max(float(activation_contract.get("epsilon", 1e-6)), 1e-8)
    log_mass_ratios = []
    for predicted_rgb in predicted_rgb_steps:
        predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
        predicted_mass = (predicted_activation * support).sum(dim=(2, 3)) / denominator
        log_mass_ratios.append(torch.log((predicted_mass + epsilon) / (target_mass + epsilon)))
    adjacent_drift = [
        torch.abs(log_mass_ratios[index] - log_mass_ratios[index - 1]).mean()
        for index in range(1, len(log_mass_ratios))
    ]
    return torch.stack(adjacent_drift).mean()


def authorized_boundary_topology_loss(predicted_rgb, target_rgb, conditions, config):
    contract = config.get("training", {}).get("authorizedBoundaryTopology", {})
    if contract.get("enabled") is not True:
        return predicted_rgb.new_zeros(())
    if contract.get("conditionChannel") != "terrain_path_ground":
        raise ValueError("authorized boundary topology requires terrain_path_ground")
    if contract.get("allowedSidesSource") != "original_condition_channel_boundary_contact_only":
        raise ValueError("authorized boundary topology source is invalid")
    path_mask = original_path_condition_mask(conditions, config, predicted_rgb.shape[-2:])
    band = max(1, round(min(predicted_rgb.shape[-2:]) * float(contract.get("boundaryBandRatio", config.get("training", {}).get("pathBoundaryBandRatio", 0.04)))))
    side_masks = []
    for side in ("north", "south", "west", "east"):
        side_mask = torch.zeros_like(path_mask)
        if side == "north":
            side_mask[:, :, :band, :] = 1.0
        elif side == "south":
            side_mask[:, :, -band:, :] = 1.0
        elif side == "west":
            side_mask[:, :, :, :band] = 1.0
        else:
            side_mask[:, :, :, -band:] = 1.0
        side_masks.append(side_mask)
    forbidden = torch.zeros_like(path_mask)
    for side_mask in side_masks:
        authorized = (path_mask * side_mask).flatten(1).amax(dim=1).view(-1, 1, 1, 1)
        forbidden = torch.maximum(forbidden, side_mask * (1.0 - authorized))
    temperature = float(contract.get("appearanceTemperature", 0.2))
    predicted_activation = path_visual_activation(predicted_rgb, target_rgb, path_mask, temperature)
    target_activation = path_visual_activation(target_rgb, target_rgb, path_mask, temperature)
    excess = torch.nn.functional.relu(predicted_activation - target_activation - float(contract.get("activationMargin", 0.0)))
    denominator = forbidden.sum().clamp_min(1.0)
    return (excess * forbidden).sum() / denominator


def forbidden_boundary_pair_rgb_l1(left_rgb, right_rgb, conditions, config):
    order = list(config["conditionChannelOrder"])
    path_mask = conditions[:, order.index("terrain_path_ground"):order.index("terrain_path_ground") + 1]
    path_mask = torch.nn.functional.interpolate(path_mask, size=left_rgb.shape[-2:], mode="nearest")
    band = max(1, round(min(left_rgb.shape[-2:]) * float(config["training"].get("pathBoundaryBandRatio", 0.04))))
    boundary = torch.zeros_like(path_mask)
    boundary[:, :, :band, :] = 1.0
    boundary[:, :, -band:, :] = 1.0
    boundary[:, :, :, :band] = 1.0
    boundary[:, :, :, -band:] = 1.0
    forbidden = boundary * (1.0 - path_mask.clamp(0.0, 1.0))
    denominator = (forbidden.sum() * left_rgb.shape[1]).clamp_min(1.0)
    return ((left_rgb - right_rgb).abs() * forbidden).sum() / denominator


def should_save_epoch_preview(config, epoch_number):
    if epoch_number is None:
        return False
    policy = config.get("training", {}).get("fixedEpochPreviewPolicy", {})
    return int(epoch_number) in [int(value) for value in policy.get("smoke", []) + policy.get("formalStage", [])]


def save_tensor_png(tensor, output_path):
    pixels = tensor.detach().clamp(0.0, 1.0).mul(255).byte().permute(1, 2, 0).cpu().numpy()
    Image.fromarray(pixels).save(output_path, format="PNG", optimize=True)


def latent_gradient_mae(predicted, target):
    horizontal = torch.nn.functional.l1_loss(predicted[:, :, :, 1:] - predicted[:, :, :, :-1], target[:, :, :, 1:] - target[:, :, :, :-1])
    vertical = torch.nn.functional.l1_loss(predicted[:, :, 1:, :] - predicted[:, :, :-1, :], target[:, :, 1:, :] - target[:, :, :-1, :])
    return (horizontal + vertical) * 0.5


def multiscale_latent_hierarchy_losses(predicted, target, config):
    functional = torch.nn.functional
    gradient_losses = []
    laplacian_losses = []
    for scale in config["training"].get("textureHierarchyScales", [1.0, 0.5, 0.25]):
        if float(scale) == 1.0:
            predicted_level, target_level = predicted, target
        else:
            size = (
                max(2, round(predicted.shape[-2] * float(scale))),
                max(2, round(predicted.shape[-1] * float(scale))),
            )
            predicted_level = functional.interpolate(predicted, size=size, mode="area")
            target_level = functional.interpolate(target, size=size, mode="area")
        gradient_losses.append(latent_gradient_mae(predicted_level, target_level))
        laplacian_losses.append(functional.l1_loss(latent_laplacian(predicted_level), latent_laplacian(target_level)))
    return torch.stack(gradient_losses).mean(), torch.stack(laplacian_losses).mean()


def latent_laplacian(value):
    functional = torch.nn.functional
    padded = functional.pad(value, (1, 1, 1, 1), mode="replicate")
    return (
        padded[:, :, 1:-1, :-2]
        + padded[:, :, 1:-1, 2:]
        + padded[:, :, :-2, 1:-1]
        + padded[:, :, 2:, 1:-1]
        - 4.0 * value
    )


def latent_activity(value):
    horizontal = torch.nn.functional.pad((value[:, :, :, 1:] - value[:, :, :, :-1]).abs(), (0, 1, 0, 0))
    vertical = torch.nn.functional.pad((value[:, :, 1:, :] - value[:, :, :-1, :]).abs(), (0, 0, 0, 1))
    return (horizontal + vertical).mean(dim=1, keepdim=True) * 0.5


def quiet_region_excess_loss(predicted, target, config):
    target_activity = latent_activity(target)
    predicted_activity = latent_activity(predicted)
    quantile = float(config["training"].get("quietRegionQuantile", 0.3))
    margin = float(config["training"].get("quietRegionMargin", 0.02))
    thresholds = torch.quantile(target_activity.flatten(1), quantile, dim=1).view(-1, 1, 1, 1)
    quiet_mask = (target_activity <= thresholds).to(predicted.dtype)
    excess = torch.relu(predicted_activity - target_activity - margin) * quiet_mask
    return excess.sum() / quiet_mask.sum().clamp_min(1.0)


def balanced_binary_condition_loss(predicted, target):
    epsilon = 1e-6
    predicted = predicted.clamp(epsilon, 1.0 - epsilon)
    positive_mask = target >= 0.5
    negative_mask = ~positive_mask
    channel_losses = []
    for channel_index in range(target.shape[1]):
        channel_predicted = predicted[:, channel_index]
        channel_positive = positive_mask[:, channel_index]
        channel_negative = negative_mask[:, channel_index]
        parts = []
        if channel_positive.any():
            parts.append(-torch.log(channel_predicted[channel_positive]).mean())
        if channel_negative.any():
            parts.append(-torch.log1p(-channel_predicted[channel_negative]).mean())
        channel_losses.append(torch.stack(parts).mean())
    return torch.stack(channel_losses).mean()


def training_timesteps(config, epoch_index, batch_index, batch_count, batch_size, diffusion_steps, device):
    sampling = config.get("training", {}).get("timestepSampling")
    if sampling == "deterministic_full_schedule_cover_v2":
        stride = int(config.get("training", {}).get("timestepCoverageStride", 997))
        if math.gcd(stride, diffusion_steps) != 1:
            raise ValueError("timestep coverage stride must be coprime with diffusion step count")
        offset = int(config.get("training", {}).get("seed", 0)) % diffusion_steps
        epoch_width = batch_count * batch_size
        values = [
            (offset + (epoch_index * epoch_width + batch_index * batch_size + item_index) * stride) % diffusion_steps
            for item_index in range(batch_size)
        ]
        return torch.tensor(values, device=device, dtype=torch.long)
    if not is_v5_or_later(config):
        return torch.randint(0, diffusion_steps, (batch_size,), device=device)
    bucket_count = max(1, batch_count * batch_size)
    values = []
    for item_index in range(batch_size):
        bucket = (batch_index * batch_size + item_index + epoch_index) % bucket_count
        value = 0 if bucket_count == 1 else round((bucket / (bucket_count - 1)) * (diffusion_steps - 1))
        values.append(value)
    return torch.tensor(values, device=device, dtype=torch.long)


def is_v5(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v5"


def is_v6(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v6"


def is_v7(config):
    return config.get("denoiserArchitecture") == "multiscale_condition_unet_v7"


def is_v6_or_later(config):
    return is_v6(config) or is_v7(config)


def is_v5_or_later(config):
    return is_v5(config) or is_v6_or_later(config)


def upper_camel(value):
    return value[:1].upper() + value[1:]


def condition_type_indices(config):
    order = list(config["conditionChannelOrder"])
    channel_types = config["conditionChannelTypes"]
    return (
        [order.index(value) for value in channel_types["discrete"]],
        [order.index(value) for value in channel_types["continuous"]],
    )


def serialize_condition_evidence_metrics(loss_metrics):
    serialized = {}
    preset_scalar_keys = {
        "compositeLossTensor",
        "compositeLoss",
        "velocityPredictionMse",
        "cleanLatentMae",
        "compositeConditionQualityScore",
    }
    for key, value in loss_metrics.items():
        if key in preset_scalar_keys:
            continue
        if key == "predictedRgbTensor":
            if not isinstance(value, torch.Tensor) or value.ndim != 4 or value.shape[1] != 3:
                raise ValueError("condition evidence predictedRgbTensor must be a batched RGB image tensor")
            continue
        if isinstance(value, torch.Tensor):
            if value.numel() != 1:
                raise ValueError(f"condition evidence metric must be scalar: {key}")
            serialized[key] = float(value.detach())
            continue
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            serialized[key] = float(value)
            continue
        raise ValueError(f"condition evidence metric has unsupported type: {key}")
    return serialized


def save_condition_evidence(model, datasets, diffusion, latent_normalization, device, seed, output_path, config):
    records = []
    was_training = model.denoiser.training
    model.denoiser.eval()
    with torch.no_grad():
        for split_index, split in enumerate(("validation", "challenge", "regression")):
            dataset = datasets[split]
            if is_v6_or_later(config) and split == config["training"].get("strictHeldOutInferenceSplit"):
                records.append({
                    "split": split,
                    "sampleCount": len(dataset),
                    "status": "reserved_for_post_training_held_out_inference",
                    "metricsReadDuringTraining": False,
                })
                continue
            for sample_index in range(len(dataset)):
                row = dataset[sample_index]
                image = row["image"].unsqueeze(0).to(device)
                conditions = row["conditions"].unsqueeze(0).to(device)
                latent = model.autoencoder.encode(image)
                latent = normalize_latent(latent, latent_normalization)
                timestep_value = (seed + split_index * 97 + sample_index * 31) % diffusion["alphasCumulative"].shape[0]
                timestep = torch.tensor([timestep_value], device=device, dtype=torch.long)
                generator = torch.Generator(device=device).manual_seed(seed + split_index * 1000 + sample_index)
                noise = torch.randn(latent.shape, device=device, dtype=latent.dtype, generator=generator)
                noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
                target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
                loss_metrics = predict_and_measure(
                    model,
                    noisy_latent,
                    target_velocity,
                    latent,
                    timestep,
                    diffusion["alphasCumulative"],
                    conditions,
                    config,
                    image,
                    latent_normalization,
                )
                record = {
                    "split": split,
                    "sampleId": row["sampleId"],
                    "conditionLabel": row["conditionLabel"],
                    "conditionPackPath": row["conditionPackPath"],
                    "conditionChannelCount": int(conditions.shape[1]),
                    "timestep": int(timestep_value),
                    "velocityPredictionLoss": float(loss_metrics["velocityPredictionMse"].detach()),
                    "cleanLatentMae": float(loss_metrics["cleanLatentMae"].detach()),
                    "compositeConditionQualityScore": float(loss_metrics["compositeConditionQualityScore"].detach()),
                    "generatedRgb": False,
                    "formalCandidate": False,
                }
                record.update(serialize_condition_evidence_metrics(loss_metrics))
                records.append(record)
    if was_training:
        model.denoiser.train()
    payload = {
        "schemaVersion": "ai-assisted-conditional-denoiser-evidence-v4" if is_v7(config) else ("ai-assisted-conditional-denoiser-evidence-v3" if is_v6(config) else ("ai-assisted-conditional-denoiser-evidence-v2" if is_v5(config) else "ai-assisted-conditional-denoiser-evidence-v1")),
        "createdAtUtc": utc_now(),
        "createdAtAsiaShanghai": asia_shanghai_now(),
        "records": records,
        "automaticStorage": True,
    }
    write_json(output_path, payload)
    return records


def compute_latent_normalization(model, dataset, device):
    channel_sum = None
    channel_square_sum = None
    value_count = 0
    model.autoencoder.eval()
    with torch.no_grad():
        for index in range(len(dataset)):
            image = dataset[index]["image"].unsqueeze(0).to(device)
            latent = model.autoencoder.encode(image).double()
            current_sum = latent.sum(dim=(0, 2, 3))
            current_square_sum = latent.square().sum(dim=(0, 2, 3))
            channel_sum = current_sum if channel_sum is None else channel_sum + current_sum
            channel_square_sum = current_square_sum if channel_square_sum is None else channel_square_sum + current_square_sum
            value_count += latent.shape[0] * latent.shape[2] * latent.shape[3]
    if value_count == 0 or channel_sum is None or channel_square_sum is None:
        raise ValueError("training split produced no latent normalization values")
    mean = channel_sum / value_count
    variance = (channel_square_sum / value_count - mean.square()).clamp_min(1e-8)
    standard_deviation = variance.sqrt().clamp_min(1e-4)
    return {
        "version": "per_channel_train_split_v1",
        "mean": mean.float().view(1, -1, 1, 1).to(device),
        "standardDeviation": standard_deviation.float().view(1, -1, 1, 1).to(device),
        "sampleCount": len(dataset),
        "valueCountPerChannel": value_count,
    }


def load_latent_normalization(checkpoint, device):
    value = checkpoint.get("latentNormalization")
    if not isinstance(value, dict) or value.get("version") != "per_channel_train_split_v1":
        raise ValueError("parent checkpoint latent normalization is missing")
    mean = value.get("mean")
    standard_deviation = value.get("standardDeviation")
    if not isinstance(mean, list) or not isinstance(standard_deviation, list) or len(mean) != len(standard_deviation):
        raise ValueError("parent checkpoint latent normalization values are invalid")
    return {
        **value,
        "mean": torch.tensor(mean, dtype=torch.float32, device=device).view(1, -1, 1, 1),
        "standardDeviation": torch.tensor(standard_deviation, dtype=torch.float32, device=device).view(1, -1, 1, 1),
    }


def normalize_latent(latent, normalization):
    return (latent - normalization["mean"]) / normalization["standardDeviation"]


def denormalize_latent(latent, normalization):
    return latent * normalization["standardDeviation"] + normalization["mean"]


def serialize_latent_normalization(normalization):
    return {
        "version": normalization["version"],
        "mean": normalization["mean"].detach().cpu().reshape(-1).tolist(),
        "standardDeviation": normalization["standardDeviation"].detach().cpu().reshape(-1).tolist(),
        "sampleCount": normalization["sampleCount"],
        "valueCountPerChannel": normalization["valueCountPerChannel"],
    }


def write_progress(
    output_dir,
    config,
    package,
    stage,
    started_at,
    started_at_shanghai,
    row,
    metrics,
    status,
    smoke_test,
    manifest=None,
    live_progress=None,
):
    payload = {
        "schemaVersion": "project-owned-ai-assisted-conditional-denoiser-progress-v1",
        "status": status,
        "startedAtUtc": started_at,
        "startedAtAsiaShanghai": started_at_shanghai,
        "updatedAtUtc": utc_now(),
        "updatedAtAsiaShanghai": asia_shanghai_now(),
        "modelId": config["modelId"],
        "datasetPackageId": package["packageId"],
        "trainingLane": "ai_assisted_cold_start",
        "resolutionStage": stage,
        "currentStage": row["stage"] if row else ("completed" if status == "completed" else "initializing"),
        "currentEpoch": live_progress["epoch"] if live_progress else (row["epoch"] if row else None),
        "liveProgress": live_progress,
        "smokeTest": smoke_test,
        "metrics": metrics,
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "formalInferenceEligible": False,
        "automaticStorage": True,
    }
    if manifest:
        payload["checkpointPath"] = manifest["checkpointPath"]
        payload["checkpointSha256"] = manifest["checkpointSha256"]
        payload["remainingBlockers"] = manifest["remainingBlockers"]
    write_json_atomic(output_dir / "progress.json", payload)


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def asia_shanghai_now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat()


def project_path(path):
    resolved = Path(path).resolve()
    project_root = Path.cwd().resolve()
    try:
        relative = resolved.relative_to(project_root)
    except ValueError:
        default_data_root = Path("D:/AI-PET-WORLD-DATA") if os.name == "nt" else project_root / ".ai-pet-world-data"
        data_root = Path(os.environ.get("AI_PET_WORLD_DATA_ROOT", default_data_root)).resolve()
        physical_runtime_root = data_root / "hot" / "runtime"
        relative = Path(".runtime") / resolved.relative_to(physical_runtime_root)
    return str(relative).replace("\\", "/")


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

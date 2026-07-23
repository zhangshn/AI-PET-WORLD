from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import random
import time
from copy import deepcopy

import numpy as np
import torch

from ai_painter.complete_world import (
    add_noise,
    build_complete_world_system,
    deterministic_velocity_step,
    inference_timesteps,
    velocity_target,
)
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset


OWNERSHIP = "project_owned_architecture_ai_assisted_cold_start_weights"
POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"


def main() -> int:
    parser = ArgumentParser(description="Train the project-owned 23-channel conditional complete-world denoiser.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--autoencoder-checkpoint", type=Path, required=True)
    parser.add_argument("--initial-denoiser-checkpoint", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--resolution-stage", type=int, default=0)
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()

    config = read_json(args.config)
    package = read_json(args.dataset_package)
    validate_training_inputs(config, package)
    if args.resolution_stage < 0 or args.resolution_stage >= len(config["training"]["resolutionStages"]):
        raise ValueError("resolution stage is outside the configured progressive stages")
    stage = config["training"]["resolutionStages"][args.resolution_stage]
    image_size = (int(stage["width"]), int(stage["height"]))
    seed = int(config["training"]["seed"])
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    started_at = utc_now()
    started_at_shanghai = asia_shanghai_now()
    started = time.perf_counter()

    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            args.dataset_package,
            split,
            list(config["conditionChannelOrder"]),
            image_size,
        )
        for split in ("train", "validation", "challenge", "regression")
    }
    loaders = {
        split: torch.utils.data.DataLoader(
            dataset,
            batch_size=int(config["training"]["batchSize"]),
            shuffle=split == "train",
            num_workers=0,
        )
        for split, dataset in datasets.items()
    }

    model = build_complete_world_system(config).to(device)
    autoencoder_checkpoint = load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    model.autoencoder.load_state_dict(autoencoder_checkpoint["autoencoderState"])
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    denoiser_initialization = "project_random_multiscale_denoiser"
    parent_denoiser_checkpoint = None
    if args.resolution_stage > 0:
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
    epoch_count = 1 if args.smoke_test else int(config["training"]["denoiserEpochs"])
    max_train_batches = 1 if args.smoke_test else None
    metrics = []
    best_validation_loss = float("inf")
    best_epoch = None
    best_denoiser_state = None
    write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, None, metrics, "starting", args.smoke_test)

    model.denoiser.train()
    for epoch in range(epoch_count):
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
        )
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
            "trainCompositeLoss": train_metrics["compositeLoss"],
            "trainVelocityPredictionLoss": train_metrics["velocityPredictionMse"],
            "trainCleanLatentMae": train_metrics["cleanLatentMae"],
            "validationFixedGridCompositeConditionQualityScore": validation["compositeConditionQualityScore"],
            "validationFixedGridVelocityLoss": validation["velocityPredictionMse"],
            "validationFixedGridCleanLatentMae": validation["cleanLatentMae"],
            "validationCheckpointSelectionScore": validation_loss,
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
        write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, "running", args.smoke_test)

    if best_denoiser_state is None:
        raise ValueError("fixed validation did not produce a selectable checkpoint")
    model.denoiser.load_state_dict(best_denoiser_state)

    split_metrics = {}
    for index, split in enumerate(datasets):
        if is_v6_or_later(config) and split == config["training"].get("strictHeldOutInferenceSplit"):
            split_metrics[split] = {
                "sampleCount": len(datasets[split]),
                "status": "reserved_for_post_training_held_out_inference",
                "metricsReadDuringTraining": False,
            }
            continue
        split_metrics[split] = {
            "sampleCount": len(datasets[split]),
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
        datasets,
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
        "trainingStage": "conditional_denoiser_smoke_test" if args.smoke_test else "conditional_denoiser_training",
        "denoiserTrained": not args.smoke_test,
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
        "conditionResizeContract": config["conditionResizeContract"],
        "autoencoderState": {key: value.detach().cpu() for key, value in model.autoencoder.state_dict().items()},
        "denoiserState": {key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()},
    }
    torch.save(checkpoint, checkpoint_path)

    created_at = utc_now()
    manifest = {
        "schemaVersion": config["requiredCheckpointProvenance"],
        "status": "conditional_denoiser_program_smoke_test_passed" if args.smoke_test else "conditional_denoiser_training_completed_pending_validation",
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
            "conditional_denoiser_full_training_missing" if args.smoke_test else "conditional_denoiser_validation_pending",
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
    write_progress(args.output_dir, config, package, stage, started_at, started_at_shanghai, None, metrics, "completed", args.smoke_test, manifest)
    print(json.dumps({**manifest, "manifestPath": project_path(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


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
        if training.get("denoiserLossVersion") != "velocity_decoded_rgb_sparse_region_rollout_v7":
            raise ValueError("V7 composite denoiser loss contract is invalid")
        if training.get("bestCheckpointMetric") != "all_validation_multiseed_worst_case_semantic_rollout_score_v7":
            raise ValueError("V7 checkpoint selection contract is invalid")
        if training.get("strictHeldOutInferenceSplit") != "challenge":
            raise ValueError("V7 strict held-out split must be challenge")
        if training.get("checkpointRolloutCoverage") != "all_validation_samples":
            raise ValueError("V7 checkpoint rollout must cover every validation sample")
        if int(training.get("checkpointRolloutSeedsPerSample", 0)) < 2:
            raise ValueError("V7 checkpoint rollout requires at least two deterministic seeds per validation sample")
        if training.get("trainingAuthorizationStatus") != "owner_approved":
            raise ValueError("V7 GPU training is blocked pending a separate owner data-capacity and training decision")
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
    if checkpoint.get("resolutionStage") != expected_stage or checkpoint.get("denoiserTrained") is not True:
        raise ValueError("parent denoiser checkpoint is not the completed preceding resolution stage")
    if not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("parent denoiser state is missing")
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


def train_epoch(model, loader, optimizer, diffusion, latent_normalization, device, config, epoch_index, max_batches=None):
    model.denoiser.train()
    totals = {}
    count = 0
    for batch_index, batch in enumerate(loader):
        if max_batches is not None and batch_index >= max_batches:
            break
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
        loss_metrics["compositeLossTensor"].backward()
        optimizer.step()
        for key, value in loss_metrics.items():
            if key.endswith("Tensor"):
                continue
            totals[key] = totals.get(key, 0.0) + float(value.detach())
        count += 1
    if count == 0:
        raise ValueError("conditional denoiser training loader produced no batches")
    return {key: value / count for key, value in totals.items()}


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
    }
    composite = sum(values[key_map[key]] * float(weight) for key, weight in config["training"]["denoiserLossWeights"].items())
    checkpoint = sum(values[key] * float(weight) for key, weight in config["training"]["bestCheckpointMetricWeights"].items())
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


def evaluate_deterministic_rollout_rgb_quality_v7(model, dataset, diffusion, latent_normalization, device, seed, config):
    was_training = model.denoiser.training
    model.denoiser.eval()
    totals = {
        "rolloutRgbMae": 0.0,
        "rolloutRgbGradientMae": 0.0,
        "rolloutRgbLaplacianMae": 0.0,
        "rolloutSparseRegionRgbMae": 0.0,
        "rolloutRegionContrastMae": 0.0,
        "rolloutSpatialGridRgbMae": 0.0,
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
                values = {
                    "rolloutRgbMae": float(torch.nn.functional.l1_loss(predicted_rgb, target_rgb)),
                    "rolloutRgbGradientMae": float(gradient),
                    "rolloutRgbLaplacianMae": float(laplacian),
                    "rolloutSparseRegionRgbMae": float(sparse_region_rgb_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutRegionContrastMae": float(sparse_region_contrast_loss(predicted_rgb, target_rgb, conditions, config)),
                    "rolloutSpatialGridRgbMae": float(spatial_grid_rgb_loss(predicted_rgb, target_rgb)),
                }
                for key, value in values.items():
                    totals[key] += value
                weights = config["training"]["rolloutCheckpointMetricWeights"]
                trajectory_scores.append(sum(values[key] * float(weight) for key, weight in weights.items()))
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
                for key, value in loss_metrics.items():
                    if key in {"compositeLossTensor", "compositeLoss", "velocityPredictionMse", "cleanLatentMae", "compositeConditionQualityScore"}:
                        continue
                    record[key] = float(value.detach())
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


def write_progress(output_dir, config, package, stage, started_at, started_at_shanghai, row, metrics, status, smoke_test, manifest=None):
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
        "currentEpoch": row["epoch"] if row else None,
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
    write_json(output_dir / "progress.json", payload)


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

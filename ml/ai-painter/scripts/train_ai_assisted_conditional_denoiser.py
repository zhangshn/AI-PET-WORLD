from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import random
import time
from copy import deepcopy

import numpy as np
import torch

from ai_painter.complete_world import add_noise, build_complete_world_system, velocity_target
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
        row = {
            "stage": "ai_assisted_23_channel_conditional_denoiser",
            "epoch": epoch + 1,
            "trainCompositeLoss": train_metrics["compositeLoss"],
            "trainVelocityPredictionLoss": train_metrics["velocityPredictionMse"],
            "trainCleanLatentMae": train_metrics["cleanLatentMae"],
            "trainCleanLatentGradientMae": train_metrics["cleanLatentGradientMae"],
            "trainDiscreteConditionReconstructionBce": train_metrics["discreteConditionReconstructionBce"],
            "trainContinuousConditionReconstructionMae": train_metrics["continuousConditionReconstructionMae"],
            "validationFixedGridCompositeConditionQualityScore": validation_loss,
            "validationFixedGridVelocityLoss": validation["velocityPredictionMse"],
            "validationFixedGridCleanLatentMae": validation["cleanLatentMae"],
            "validationFixedGridCleanLatentGradientMae": validation["cleanLatentGradientMae"],
            "validationFixedGridDiscreteConditionReconstructionBce": validation["discreteConditionReconstructionBce"],
            "validationFixedGridContinuousConditionReconstructionMae": validation["continuousConditionReconstructionMae"],
        }
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

    split_metrics = {
        split: {
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
        for index, split in enumerate(datasets)
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
        raise ValueError("V4 typed condition resize contract is invalid")
    if len(typed_channels) != 23 or set(typed_channels) != set(config["conditionChannelOrder"]):
        raise ValueError("V4 typed condition groups must cover the locked 23-channel order")
    if config.get("training", {}).get("denoiserLossVersion") != "velocity_clean_gradient_condition_reconstruction_v4":
        raise ValueError("V4 composite denoiser loss contract is invalid")
    if config.get("training", {}).get("bestCheckpointMetric") != "fixed_grid_composite_condition_quality_score_v4":
        raise ValueError("V4 composite checkpoint selection contract is invalid")
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


def train_epoch(model, loader, optimizer, diffusion, latent_normalization, device, config, max_batches=None):
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
        timestep = torch.randint(0, diffusion["alphasCumulative"].shape[0], (image.shape[0],), device=device)
        noise = torch.randn_like(latent)
        noisy_latent = add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(latent, noise, timestep, diffusion["alphasCumulative"])
        optimizer.zero_grad(set_to_none=True)
        predicted_velocity, predicted_conditions, resized_conditions = model.predict_velocity_with_condition_reconstruction(
            noisy_latent,
            timestep,
            conditions,
        )
        loss_metrics = composite_denoiser_losses(
            predicted_velocity,
            target_velocity,
            noisy_latent,
            latent,
            timestep,
            diffusion["alphasCumulative"],
            predicted_conditions,
            resized_conditions,
            config,
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
    velocity_total = 0.0
    clean_total = 0.0
    gradient_total = 0.0
    discrete_condition_total = 0.0
    continuous_condition_total = 0.0
    composite_total = 0.0
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
                predicted_velocity, predicted_conditions, resized_conditions = model.predict_velocity_with_condition_reconstruction(
                    noisy_latent,
                    timestep,
                    conditions,
                )
                loss_metrics = composite_denoiser_losses(
                    predicted_velocity,
                    target_velocity,
                    noisy_latent,
                    latent,
                    timestep,
                    diffusion["alphasCumulative"],
                    predicted_conditions,
                    resized_conditions,
                    config,
                )
                velocity_total += float(loss_metrics["velocityPredictionMse"].detach())
                clean_total += float(loss_metrics["cleanLatentMae"].detach())
                gradient_total += float(loss_metrics["cleanLatentGradientMae"].detach())
                discrete_condition_total += float(loss_metrics["discreteConditionReconstructionBce"].detach())
                continuous_condition_total += float(loss_metrics["continuousConditionReconstructionMae"].detach())
                composite_total += float(loss_metrics["compositeConditionQualityScore"].detach())
                count += 1
    if was_training:
        model.denoiser.train()
    if count == 0:
        raise ValueError("conditional denoiser evaluation loader produced no batches")
    return {
        "velocityPredictionMse": velocity_total / count,
        "cleanLatentMae": clean_total / count,
        "cleanLatentGradientMae": gradient_total / count,
        "discreteConditionReconstructionBce": discrete_condition_total / count,
        "continuousConditionReconstructionMae": continuous_condition_total / count,
        "compositeConditionQualityScore": composite_total / count,
        "fixedTimesteps": [int(value) for value in timesteps],
    }


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


def latent_gradient_mae(predicted, target):
    horizontal = torch.nn.functional.l1_loss(predicted[:, :, :, 1:] - predicted[:, :, :, :-1], target[:, :, :, 1:] - target[:, :, :, :-1])
    vertical = torch.nn.functional.l1_loss(predicted[:, :, 1:, :] - predicted[:, :, :-1, :], target[:, :, 1:, :] - target[:, :, :-1, :])
    return (horizontal + vertical) * 0.5


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
                predicted_velocity, predicted_conditions, resized_conditions = model.predict_velocity_with_condition_reconstruction(
                    noisy_latent,
                    timestep,
                    conditions,
                )
                loss_metrics = composite_denoiser_losses(
                    predicted_velocity,
                    target_velocity,
                    noisy_latent,
                    latent,
                    timestep,
                    diffusion["alphasCumulative"],
                    predicted_conditions,
                    resized_conditions,
                    config,
                )
                records.append({
                    "split": split,
                    "sampleId": row["sampleId"],
                    "conditionLabel": row["conditionLabel"],
                    "conditionPackPath": row["conditionPackPath"],
                    "conditionChannelCount": int(conditions.shape[1]),
                    "timestep": int(timestep_value),
                    "velocityPredictionLoss": float(loss_metrics["velocityPredictionMse"].detach()),
                    "cleanLatentMae": float(loss_metrics["cleanLatentMae"].detach()),
                    "cleanLatentGradientMae": float(loss_metrics["cleanLatentGradientMae"].detach()),
                    "discreteConditionReconstructionBce": float(loss_metrics["discreteConditionReconstructionBce"].detach()),
                    "continuousConditionReconstructionMae": float(loss_metrics["continuousConditionReconstructionMae"].detach()),
                    "compositeConditionQualityScore": float(loss_metrics["compositeConditionQualityScore"].detach()),
                    "generatedRgb": False,
                    "formalCandidate": False,
                })
    if was_training:
        model.denoiser.train()
    payload = {
        "schemaVersion": "ai-assisted-conditional-denoiser-evidence-v1",
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
    return str(Path(path).resolve().relative_to(Path.cwd().resolve())).replace("\\", "/")


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

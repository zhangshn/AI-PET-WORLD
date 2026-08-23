from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import time

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import add_noise, build_complete_world_system, velocity_target
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter_preview_reproduction import fixed_preview_determinism_scope, state_dict_sha256, tensor_sha256
from ai_painter_stage_mode_registry import resolve_stage_mode
import train_ai_assisted_conditional_denoiser as formal


ROLES = (
    "terrain_route_hydrology_spatial_realization",
    "per_class_object_semantic_realization",
    "global_visual_harmonization_and_native_complete_rgb_decode",
)
EXPECTED_MODE_IDS = {
    ROLES[0]: "stage4_terrain_route_hydrology_component_smoke",
    ROLES[1]: "stage4_per_class_object_semantic_component_smoke",
    ROLES[2]: "stage4_global_visual_native_decode_component_smoke",
}
EXPECTED_EXPERTS = {
    ROLES[0]: ("route",),
    ROLES[1]: ("footprints", "tree", "rock", "vegetation"),
    ROLES[2]: (),
}
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
PREVIEW_EPOCHS = (1, 5, 10, 20, 30)
SEED = 20263722


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def _save_latent(path: Path, tensor: torch.Tensor) -> dict:
    array = tensor.detach().cpu().numpy()
    with path.open("xb") as handle:
        np.save(handle, array, allow_pickle=False)
    return {
        "path": formal.project_path(path),
        "sha256": _sha(path),
        "tensorSha256": tensor_sha256(tensor),
        "shape": list(array.shape),
        "dtype": str(array.dtype),
    }


def _load_predecessor(value: Path, package_id: str, role: str, device: torch.device) -> tuple[torch.Tensor, dict]:
    identity = formal.read_json(value)
    predecessor_index = ROLES.index(role) - 1
    expected_role = ROLES[predecessor_index]
    if (
        identity.get("schemaVersion") != "stage4-controlled-three-component-smoke-output-identity-v1"
        or identity.get("status") != "component_smoke_output_identity_completed"
        or identity.get("packageId") != package_id
        or identity.get("roleId") != expected_role
        or identity.get("sampleId") != SAMPLE_ID
    ):
        raise ValueError("component_predecessor_output_identity_invalid")
    artifact = identity.get("outputArtifact", {})
    artifact_path = Path.cwd() / str(artifact.get("path", ""))
    if not artifact_path.is_file() or _sha(artifact_path) != artifact.get("sha256"):
        raise ValueError("component_predecessor_output_artifact_missing_or_changed")
    array = np.load(artifact_path, allow_pickle=False)
    if list(array.shape) != [1, 12, 48, 64]:
        raise ValueError("component_predecessor_output_shape_invalid")
    tensor = torch.from_numpy(array).to(device)
    if tensor_sha256(tensor) != artifact.get("tensorSha256"):
        raise ValueError("component_predecessor_tensor_identity_invalid")
    return tensor, {
        "roleId": expected_role,
        "outputIdentityPath": formal.project_path(value),
        "outputIdentitySha256": _sha(value),
        "outputArtifact": artifact,
    }


def _component_loss(model, role, source, clean, target_velocity, timestep, diffusion, conditions, image, normalization, config):
    alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
    noisy = add_noise(clean, source, timestep, diffusion["alphasCumulative"])
    mixture = None
    if role == ROLES[2]:
        predicted_velocity = model.predict_velocity(noisy, timestep, conditions)
    else:
        predicted_velocity, mixture = model.predict_velocity_with_stage4_semantic_mixture(noisy, timestep, conditions)
    predicted_clean = alpha.sqrt() * noisy - (1.0 - alpha).sqrt() * predicted_velocity
    predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
    target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
    if role == ROLES[2]:
        predicted_rgb = model.decode_stage4_native_complete_rgb(
            formal.denormalize_latent(predicted_clean, normalization)
        )
        metrics = formal.composite_denoiser_losses_v6(
            predicted_velocity, target_velocity, predicted_clean, clean,
            predicted_conditions, target_conditions, predicted_rgb, image,
            conditions, config,
        )
        metrics["stage4ResponsibilityLossIdentity"] = "existing_global_rgb_rollout_and_visual_harmonization_losses_only"
        return metrics

    metrics = formal.composite_denoiser_losses_v5(
        predicted_velocity, target_velocity, predicted_clean, clean,
        predicted_conditions, target_conditions, config,
    )
    identities = tuple(mixture.get("expertIdentityOrder", ()))
    sources = tuple(mixture.get("sourceConditionChannels", ()))
    participation = mixture.get("participation")
    if identities != EXPECTED_EXPERTS[role] or participation is None or participation.shape[1] != len(identities):
        raise ValueError("component_responsibility_expert_identity_invalid")
    targets, target_order = formal.stage4_decoded_alignment_targets(
        conditions, participation.shape[-2:], config,
    )
    target_by_name = {
        name: targets[:, index:index + 1]
        for index, name in enumerate(target_order)
    }
    losses = []
    for index, source_name in enumerate(sources):
        if source_name not in target_by_name:
            raise ValueError("component_responsibility_target_missing")
        losses.append(formal.balanced_binary_condition_loss(
            participation[:, index:index + 1], target_by_name[source_name]
        ))
    participation_loss = torch.stack(losses).mean()
    reused_weight = float(config["training"]["denoiserLossWeights"]["discreteConditionOutputBinding"])
    checkpoint_weight = float(config["training"]["bestCheckpointMetricWeights"]["discreteConditionOutputBindingBce"])
    metrics["compositeLossTensor"] = metrics["compositeLossTensor"] + participation_loss * reused_weight
    metrics["compositeLoss"] = metrics["compositeLossTensor"]
    metrics["compositeConditionQualityScore"] = metrics["compositeConditionQualityScore"] + participation_loss * checkpoint_weight
    metrics["stage4ResponsibilityParticipationLoss"] = participation_loss
    metrics["stage4ResponsibilityLossIdentity"] = (
        "existing_terrain_route_hydrology_spatial_losses_only"
        if role == ROLES[0]
        else "existing_per_class_object_semantic_and_reference_losses_only"
    )
    return metrics


def _validate(args, config: dict, package: dict) -> tuple[str, dict]:
    role = str(config.get("stage4ResponsibilityComponentRole", ""))
    if role not in ROLES:
        raise ValueError("stage4_responsibility_component_role_invalid")
    mode = resolve_stage_mode(config)
    if (
        mode.mode_id != EXPECTED_MODE_IDS[role]
        or mode.adapter_binding != "stage4_isolated_responsibility_component_smoke_adapter"
        or mode.execution_kind != "single_sample_smoke"
        or mode.active_execution is not True
    ):
        raise ValueError("stage4_responsibility_component_smoke_mode_invalid")
    training = config.get("training", {})
    component = training.get("stage4IsolatedResponsibilityComponent", {})
    owner = training.get("ownerTrainingAuthorization", {})
    smoke = training.get("stage4ControlledThreeComponentStage0SmokeExecution", {})
    active_gate = component.get("activationGate", {})
    expected_active = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "smokeNow", "trainingNow", "stage0Now",
    }
    if (
        component.get("roleId") != role
        or component.get("status") != "smoke_active_owner_authorized"
        or {key for key, enabled in active_gate.items() if enabled is True} != expected_active
        or any(not isinstance(value, bool) for value in active_gate.values())
        or owner.get("executionState") not in ({"preflight_unconsumed"} if args.preflight_only else {"consumed"})
        or owner.get("optimizerCreationAuthorized") is not True
        or owner.get("backwardExecutionAuthorized") is not True
        or owner.get("modelWeightMutationAuthorized") is not True
        or owner.get("gpuTrainingAuthorizedNow") is not True
        or owner.get("stage1Authorized") is not False
        or owner.get("stage2Authorized") is not False
        or owner.get("automaticRetryAuthorized") is not False
        or smoke.get("packageId") is None
        or smoke.get("roleId") != role
        or smoke.get("sampleId") != SAMPLE_ID
        or smoke.get("seed") != SEED
        or smoke.get("epochCount") != 30
        or smoke.get("previewEpochs") != list(PREVIEW_EPOCHS)
        or smoke.get("resolution") != {"width": 256, "height": 192}
        or smoke.get("topology") != "west"
    ):
        raise ValueError("stage4_responsibility_component_smoke_active_contract_invalid")
    if args.overfit_sample_id != SAMPLE_ID or args.overfit_epochs != 30 or args.overfit_evaluation_interval != 5:
        raise ValueError("stage4_responsibility_component_smoke_cli_identity_invalid")
    if args.initial_denoiser_checkpoint is not None:
        raise ValueError("stage4_responsibility_component_smoke_historical_denoiser_forbidden")
    if package.get("v7CapacityContributionCount") != 64:
        raise ValueError("stage4_responsibility_component_dataset_capacity_invalid")
    return role, smoke


def run(args, config: dict, package: dict) -> int:
    role, smoke = _validate(args, config, package)
    image_size = (256, 192)
    validation = AiAssistedConditionalDenoiserDataset(
        args.dataset_package, "validation", list(config["conditionChannelOrder"]), image_size,
        selection_contract=formal.conditional_dataset_selection_contract(config),
    )
    matches = [index for index, row in enumerate(validation.rows) if row["sampleId"] == SAMPLE_ID]
    if len(matches) != 1:
        raise ValueError("stage4_responsibility_component_fixed_sample_invalid")
    if args.preflight_only:
        print(json.dumps({
            "status": "stage4_responsibility_component_smoke_trainer_preflight_passed",
            "roleId": role, "sampleId": SAMPLE_ID, "gpuStarted": False,
            "optimizerCreated": False, "trainingStarted": False,
        }, ensure_ascii=False, indent=2))
        return 0

    formal.set_seed(SEED)
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable_for_component_smoke")
    device = torch.device("cuda:0")
    args.output_dir.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    model = build_complete_world_system(config).to(device)
    checkpoint = formal.load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    initial_denoiser = state_dict_sha256(model.denoiser.state_dict())
    initial_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
    expected_prefix = f"stage4_responsibility_components.{role}."
    full_names = [name for name, _ in model.named_parameters() if name.startswith("stage4_responsibility_components.")]
    if not full_names or any(not name.startswith(expected_prefix) for name in full_names):
        raise ValueError("component_trainable_parameter_namespace_invalid")

    train_dataset = AiAssistedConditionalDenoiserDataset(
        args.dataset_package, "train", list(config["conditionChannelOrder"]), image_size,
        selection_contract=formal.conditional_dataset_selection_contract(config),
    )
    normalization = formal.compute_latent_normalization(model, train_dataset, device)
    sample = validation[matches[0]]
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device)
    object_indices = [config["conditionChannelOrder"].index(name) for name in (
        "object_footprints", "object_tree", "object_rock", "object_vegetation",
    )]
    masks_before = tensor_sha256(conditions[:, object_indices])
    with torch.no_grad():
        clean = formal.normalize_latent(model.autoencoder.encode(image), normalization)
    predecessor = None
    if role == ROLES[0]:
        generator = torch.Generator(device="cuda")
        generator.manual_seed(SEED)
        source = torch.randn(clean.shape, generator=generator, device=device, dtype=clean.dtype)
    else:
        if args.stage4_predecessor_output_identity is None:
            raise ValueError("component_predecessor_output_identity_required")
        source, predecessor = _load_predecessor(
            args.stage4_predecessor_output_identity, smoke["packageId"], role, device,
        )
    diffusion = formal.build_diffusion_schedule(config, device)
    optimizer = torch.optim.AdamW(model.denoiser.parameters(), lr=float(config["training"]["denoiserLearningRate"]))
    metrics_rows = []
    previews = []
    latest_output = None
    output_dir = args.output_dir / "component-outputs"
    output_dir.mkdir(parents=True, exist_ok=False)
    preview_dir = args.output_dir / "fixed-epoch-previews"
    if role == ROLES[2]:
        preview_dir.mkdir(parents=True, exist_ok=False)

    for epoch in range(1, 31):
        model.denoiser.train()
        timestep = formal.training_timesteps(config, epoch - 1, 0, 1, 1, int(config["diffusionSteps"]), device)
        target_velocity = velocity_target(clean, source, timestep, diffusion["alphasCumulative"])
        optimizer.zero_grad(set_to_none=True)
        loss = _component_loss(
            model, role, source, clean, target_velocity, timestep, diffusion,
            conditions, image, normalization, config,
        )
        loss["compositeLossTensor"].backward()
        optimizer.step()
        model.denoiser.eval()
        with torch.no_grad():
            terminal_timestep = torch.tensor([999.0], device=device)
            latest_output = model.predict_velocity(source, terminal_timestep, conditions)
        row = {
            "epoch": epoch,
            "responsibilityLossIdentity": loss["stage4ResponsibilityLossIdentity"],
            "trainingCompositeLoss": float(loss["compositeLossTensor"].detach()),
            "checkpointSelectionScore": float(loss["compositeConditionQualityScore"].detach()),
            "outputTensorSha256": tensor_sha256(latest_output),
            "recordedAtUtc": formal.utc_now(),
        }
        if "stage4ResponsibilityParticipationLoss" in loss:
            row["responsibilityParticipationLoss"] = float(loss["stage4ResponsibilityParticipationLoss"].detach())
        if epoch in PREVIEW_EPOCHS:
            epoch_artifact = _save_latent(output_dir / f"epoch-{epoch:03d}-validation-output-latent.npy", latest_output)
            row["outputArtifact"] = epoch_artifact
            if role == ROLES[2]:
                with fixed_preview_determinism_scope():
                    with torch.no_grad():
                        rgb = model.decode_stage4_native_complete_rgb(latest_output).clamp(0.0, 1.0)
                        repeated = model.decode_stage4_native_complete_rgb(latest_output).clamp(0.0, 1.0)
                    if tensor_sha256(rgb) != tensor_sha256(repeated):
                        raise ValueError("component_final_preview_tensor_reproduction_mismatch")
                    rgb_bytes = (rgb[0].detach().cpu().permute(1, 2, 0).numpy() * 255.0).round().astype(np.uint8)
                    preview_path = preview_dir / f"epoch-{epoch:03d}-wet-season-drainage-hollow-v6.png"
                    Image.fromarray(rgb_bytes, mode="RGB").save(preview_path, format="PNG", optimize=True)
                row["previewArtifact"] = {
                    "path": formal.project_path(preview_path), "sha256": _sha(preview_path),
                    "rgbTensorSha256": tensor_sha256(rgb), "byteExactReproduced": True,
                }
                previews.append(row["previewArtifact"])
        metrics_rows.append(row)
        _write(args.output_dir / "progress.json", {
            "schemaVersion": "stage4-controlled-three-component-smoke-progress-v1",
            "status": "running", "packageId": smoke["packageId"], "roleId": role,
            "sampleId": SAMPLE_ID, "currentEpoch": epoch, "epochTarget": 30,
            "optimizerStep": epoch, "optimizerStepTarget": 30,
            "percent": round(epoch / 30 * 100, 2), "latestMetric": row,
        })

    if latest_output is None:
        raise ValueError("component_smoke_output_missing")
    masks_after = tensor_sha256(conditions[:, object_indices])
    if masks_before != masks_after:
        raise ValueError("approved_object_masks_modified")
    final_denoiser = state_dict_sha256(model.denoiser.state_dict())
    final_autoencoder = state_dict_sha256(model.autoencoder.state_dict())
    if initial_denoiser == final_denoiser or initial_autoencoder != final_autoencoder:
        raise ValueError("component_smoke_state_change_contract_invalid")
    final_artifact = _save_latent(args.output_dir / "validation-output-latent.npy", latest_output)
    output_identity = {
        "schemaVersion": "stage4-controlled-three-component-smoke-output-identity-v1",
        "status": "component_smoke_output_identity_completed",
        "packageId": smoke["packageId"], "roleId": role, "sampleId": SAMPLE_ID,
        "outputArtifact": final_artifact, "predecessorConsumption": predecessor,
        "approvedObjectMasksBeforeSha256": masks_before,
        "approvedObjectMasksAfterSha256": masks_after,
        "approvedObjectMasksUnchanged": True,
    }
    _write(args.output_dir / "output-identity.json", output_identity)
    checkpoint_path = args.output_dir / "non-promotable-smoke-checkpoint.pt"
    torch.save({
        "schemaVersion": config["requiredCheckpointProvenance"],
        "role": "non_promotable_controlled_three_component_stage0_smoke_only",
        "packageId": smoke["packageId"], "roleId": role,
        "stage0InitializationEligible": False, "formalPromotionEligible": False,
        "denoiserState": {key: value.detach().cpu() for key, value in model.denoiser.state_dict().items()},
        "denoiserStateSha256": final_denoiser,
    }, checkpoint_path)
    telemetry = {
        "schemaVersion": "stage4-controlled-three-component-smoke-resource-telemetry-v1",
        "status": "completed", "roleId": role,
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    _write(args.output_dir / "resource-telemetry.json", telemetry)
    manifest = {
        "schemaVersion": "stage4-controlled-three-component-smoke-manifest-v1",
        "status": "component_smoke_training_completed",
        "packageId": smoke["packageId"], "roleId": role,
        "sampleId": SAMPLE_ID, "sampleSplit": "validation", "seed": SEED,
        "resolution": {"width": 256, "height": 192}, "epochCount": 30,
        "previewEpochs": list(PREVIEW_EPOCHS), "metrics": metrics_rows,
        "checkpoint": {"path": formal.project_path(checkpoint_path), "sha256": _sha(checkpoint_path), "promotable": False},
        "outputIdentity": {"path": formal.project_path(args.output_dir / "output-identity.json"), "sha256": _sha(args.output_dir / "output-identity.json")},
        "predecessorConsumption": predecessor,
        "parameterNamespace": expected_prefix[:-1],
        "modelStateHashes": {"before": initial_denoiser, "after": final_denoiser, "weightsChanged": True},
        "autoencoderStateHashes": {"before": initial_autoencoder, "after": final_autoencoder, "unchanged": True},
        "approvedObjectMasksUnchanged": True,
        "fixedPreviews": previews,
        "nativeCompleteFrame": role == ROLES[2],
        "tileUsed": False, "patchUsed": False, "spriteUsed": False,
        "lowResolutionUpscaleUsed": False, "ruleProgramRenderingUsed": False,
    }
    _write(args.output_dir / "manifest.json", manifest)
    _write(args.output_dir / "progress.json", {
        "schemaVersion": "stage4-controlled-three-component-smoke-progress-v1",
        "status": "completed", "packageId": smoke["packageId"], "roleId": role,
        "sampleId": SAMPLE_ID, "currentEpoch": 30, "epochTarget": 30,
        "optimizerStep": 30, "optimizerStepTarget": 30, "percent": 100.0,
        "manifestPath": formal.project_path(args.output_dir / "manifest.json"),
        "manifestSha256": _sha(args.output_dir / "manifest.json"),
    })
    print(json.dumps({
        "status": "stage4_responsibility_component_smoke_training_completed",
        "roleId": role, "manifestPath": formal.project_path(args.output_dir / "manifest.json"),
        "manifestSha256": _sha(args.output_dir / "manifest.json"),
    }, ensure_ascii=False, indent=2))
    return 0

from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import time
import traceback

import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = Path(__file__).resolve()
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
CONTRACT_KEY = "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"
WORST_SAMPLE_CLASS_CONTRACT_KEY = (
    "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation"
)
REFERENCE_FEATURE_STRUCTURE_CONTRACT_KEY = (
    "stage4PerClassFinalVisibleReferenceFeatureStructureObligation"
)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SAMPLE_SPLIT = "validation"
IMAGE_SIZE = (256, 192)
SEED = 20263722
EXPECTED_ACTIONS = (
    "read_bound_cpu_qualification_evidence",
    "read_bound_inactive_config",
    "read_project_autoencoder_checkpoint",
    "initialize_random_denoiser",
    "execute_cuda_50_step_forward",
    "execute_torch_autograd_grad",
    "write_readonly_gpu_qualification_evidence",
)
FORBIDDEN_ACTIONS = {
    "read_old_denoiser_checkpoint",
    "create_optimizer",
    "execute_backward",
    "modify_model_weights",
    "write_checkpoint",
    "start_smoke",
    "start_training",
    "checkpoint_promotion",
    "formal_inference",
}
CLASS_IDENTITIES = ("footprints", "tree", "rock", "vegetation")
CLASS_CHANNELS = tuple(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    authorization_path = resolve(args.authorization)
    output = resolve(args.output_dir)
    authorization = validate_authorization(authorization_path, output)
    if args.preflight_only:
        print(json.dumps(run_preflight(authorization), ensure_ascii=False, indent=2))
        return 0
    consumption_path = authorization_path.parent / "gpu-consumption.json"
    consume_authorization(authorization_path, authorization, consumption_path)
    return run_gpu(authorization, output, consumption_path)


def validate_authorization(path: Path, output: Path) -> dict:
    value = read_json(path)
    reference_feature_structure = value.get("schemaVersion") == (
        "ai-painter-stage4-per-class-final-visible-reference-feature-structure-"
        "readonly-gpu-authorization-v1"
    )
    worst_sample_class = value.get("schemaVersion") == (
        "ai-painter-stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-authorization-v1"
    )
    if not reference_feature_structure and not worst_sample_class and value.get("schemaVersion") != (
        "ai-painter-stage4-full-rollout-per-class-luminance-readonly-gpu-authorization-v1"
    ):
        raise ValueError("per_class_rollout_gpu_authorization_schema_invalid")
    if value.get("status") != "owner_authorized_pending_execution":
        raise ValueError("per_class_rollout_gpu_authorization_status_invalid")
    if value.get("requestId") != value.get("commandRef"):
        raise ValueError("per_class_rollout_gpu_authorization_identity_mismatch")
    expected_scope = (
        "stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_qualification"
        if reference_feature_structure
        else
        "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification"
        if worst_sample_class
        else "stage4_full_rollout_per_class_final_visible_luminance_structure_readonly_gpu_qualification"
    )
    if value.get("scope") != expected_scope:
        raise ValueError("per_class_rollout_gpu_authorization_scope_invalid")
    if tuple(value.get("allowedActions", ())) != EXPECTED_ACTIONS:
        raise ValueError("per_class_rollout_gpu_authorization_actions_invalid")
    denied = set(value.get("deniedActions", ()))
    if not FORBIDDEN_ACTIONS.issubset(denied) or denied.intersection(EXPECTED_ACTIONS):
        raise ValueError("per_class_rollout_gpu_authorization_denied_actions_invalid")
    if resolve(Path(value["outputNamespace"])) != output:
        raise ValueError("per_class_rollout_gpu_output_namespace_mismatch")
    if output.exists():
        raise ValueError("per_class_rollout_gpu_output_namespace_already_exists")
    required_bindings = [
        "cpuTerminal", "cpuReport", "supportContract", "inactiveConfig",
        "trainer", "runner", "cpuChecker", "datasetManifest",
        "projectAutoencoderCheckpoint", "implementationAuthorization",
        "implementationConsumption",
    ]
    if worst_sample_class or reference_feature_structure:
        required_bindings.append("configurationAudit")
    if reference_feature_structure:
        required_bindings.append("ownerActionRequest")
    if set(value.get("bindings", {})) != set(required_bindings):
        raise ValueError("per_class_rollout_gpu_binding_set_invalid")
    for name in required_bindings:
        binding_value = value["bindings"][name]
        bound_path = resolve(Path(binding_value["path"]))
        if not bound_path.is_file() or sha256_file(bound_path) != binding_value["sha256"]:
            raise ValueError(f"per_class_rollout_gpu_binding_invalid:{name}")
    if resolve(Path(value["bindings"]["runner"]["path"])) != RUNNER_PATH:
        raise ValueError("per_class_rollout_gpu_runner_identity_invalid")
    expected_contract_id = (
        trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        if reference_feature_structure
        else
        trainer.STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
        if worst_sample_class
        else trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
    )
    if value.get("taskIdentity") != {
        "contractId": expected_contract_id,
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "topology": "west",
        "rolloutSteps": 50,
        "gradientTailSteps": 5,
        "requiredClasses": list(CLASS_IDENTITIES),
    }:
        raise ValueError("per_class_rollout_gpu_task_identity_invalid")
    if value.get("consumptionState") != {"consumed": False, "consumptionPath": None}:
        raise ValueError("per_class_rollout_gpu_authorization_already_consumed")
    return value


def run_preflight(authorization: dict) -> dict:
    python = {
        "executable": sys.executable,
        "version": sys.version,
        "torchVersion": torch.__version__,
        "cudaAvailable": torch.cuda.is_available(),
        "cudaDeviceCount": torch.cuda.device_count(),
    }
    if not python["cudaAvailable"] or python["cudaDeviceCount"] < 1:
        raise ValueError("per_class_rollout_gpu_cuda_unavailable")
    device = torch.cuda.get_device_properties(0)
    disk_probe = resolve(Path(authorization["outputNamespace"])).parent
    while not disk_probe.exists() and disk_probe.parent != disk_probe:
        disk_probe = disk_probe.parent
    disk = shutil.disk_usage(disk_probe)
    if disk.free < 2 * 1024**3:
        raise ValueError("per_class_rollout_gpu_disk_budget_insufficient")
    return {
        "schemaVersion": "ai-painter-stage4-per-class-full-rollout-gpu-preflight-v1",
        "status": "passed_without_authorization_consumption_or_checkpoint_read",
        **timestamps(),
        "python": python,
        "cuda": {"deviceIndex": 0, "name": device.name, "totalMemoryBytes": device.total_memory},
        "disk": {"freeBytes": disk.free},
        "authorizationConsumed": False,
        "checkpointRead": False,
        "gpuInitializedByWorkload": False,
    }


def consume_authorization(path: Path, authorization: dict, consumption_path: Path) -> None:
    if consumption_path.exists():
        raise ValueError("per_class_rollout_gpu_consumption_already_exists")
    write_json_exclusive(consumption_path, {
        "schemaVersion": "ai-painter-stage4-per-class-full-rollout-readonly-gpu-consumption-v1",
        "status": "consumed_once_before_gpu_execution",
        **timestamps(),
        "requestId": authorization["requestId"],
        "authorizationPath": project_path(path),
        "authorizationSha256": sha256_file(path),
        "outputNamespace": authorization["outputNamespace"],
        "allowedActions": list(EXPECTED_ACTIONS),
        "oneTimeConsumption": True,
    })


def active_config(config: dict) -> dict:
    result = deepcopy(config)
    contract = result["training"][CONTRACT_KEY]
    contract["status"] = "training_loss_active_owner_authorized"
    active = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow",
    }
    contract["activationGate"] = {
        name: name in active for name in contract["activationGate"]
    }
    trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
        result
    )
    if WORST_SAMPLE_CLASS_CONTRACT_KEY in result.get("training", {}):
        worst = result["training"][WORST_SAMPLE_CLASS_CONTRACT_KEY]
        worst["status"] = "training_loss_active_owner_authorized"
        worst["activationGate"] = {
            name: name in active for name in worst["activationGate"]
        }
        trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            result
        )
    if REFERENCE_FEATURE_STRUCTURE_CONTRACT_KEY in result.get("training", {}):
        reference_feature = result["training"][REFERENCE_FEATURE_STRUCTURE_CONTRACT_KEY]
        reference_feature["status"] = "training_loss_active_owner_authorized"
        reference_feature["activationGate"] = {
            name: name in active for name in reference_feature["activationGate"]
        }
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            result
        )
    return result


def validate_readonly_diagnostic_inputs(config: dict, package: dict) -> dict:
    if config.get("denoiserArchitecture") != "stage4_fact_conditioned_semantic_mixture_decoder_v1":
        raise ValueError("per_class_rollout_gpu_architecture_invalid")
    if tuple(config.get("conditionChannelOrder", ())) != tuple(
        trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
    ):
        raise ValueError("per_class_rollout_gpu_condition_channel_order_invalid")
    if int(config.get("conditionChannels", -1)) != 23:
        raise ValueError("per_class_rollout_gpu_condition_channel_count_invalid")
    if package.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1":
        raise ValueError("per_class_rollout_gpu_dataset_schema_invalid")
    if package.get("trainingLane") != "ai_assisted_cold_start":
        raise ValueError("per_class_rollout_gpu_dataset_lane_invalid")
    if package.get("canTrainConditionalDenoiser") is not True:
        raise ValueError("per_class_rollout_gpu_dataset_conditional_gate_closed")
    if package.get("currentConditionUnpairedCount") != 0:
        raise ValueError("per_class_rollout_gpu_dataset_contains_unpaired_conditions")
    if package.get("formalInferenceEligible") is not False:
        raise ValueError("per_class_rollout_gpu_dataset_claims_formal_inference")
    trainer.validate_stage4_full_rollout_final_visible_consistency(config)
    trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(config)
    trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
        config
    )
    if WORST_SAMPLE_CLASS_CONTRACT_KEY in config.get("training", {}):
        trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            config
        )
    if REFERENCE_FEATURE_STRUCTURE_CONTRACT_KEY in config.get("training", {}):
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            config
        )
    selection = trainer.conditional_dataset_selection_contract(config)
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=selection,
        )
        for split in trainer.V7_MVP64_SPLIT_COUNTS
    }
    identity = trainer.validate_loaded_v7_datasets(datasets)
    return {"datasets": datasets, "identity": identity}


def run_gpu(authorization: dict, output: Path, consumption_path: Path) -> int:
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    state = {
        "autoencoderCheckpointRead": False,
        "oldDenoiserCheckpointRead": False,
        "gpuUsed": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    steps = []
    worst_sample_class_mode = (
        authorization.get("taskIdentity", {}).get("contractId")
        == trainer.STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
    )
    reference_feature_structure_mode = (
        authorization.get("taskIdentity", {}).get("contractId")
        == trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
    )

    def step(code: str, details=None):
        steps.append({"index": len(steps) + 1, "code": code, "details": details or {}, **timestamps()})
        write_json_atomic(output / "step-telemetry.json", {"completedSteps": steps, **state})

    try:
        step("authorization_consumed", {"consumptionSha256": sha256_file(consumption_path)})
        torch.cuda.init()
        torch.cuda.set_device(0)
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        device = torch.device("cuda:0")
        step("cuda_initialized", {"deviceName": torch.cuda.get_device_name(0)})

        config = active_config(read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"]))))
        package = read_json(resolve(DATASET_PATH))
        readonly_inputs = validate_readonly_diagnostic_inputs(config, package)
        dataset = readonly_inputs["datasets"][SAMPLE_SPLIT]
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("per_class_rollout_gpu_sample194_not_unique_validation")
        sample = dataset[matches[0]]
        step("sample194_loaded", {
            "split": SAMPLE_SPLIT,
            "datasetIdentity": readonly_inputs["identity"],
            "formalSmokeExecutionLineageUsed": False,
        })

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        denoiser_before = state_dict_sha256(model.denoiser.state_dict())
        checkpoint = trainer.load_autoencoder_checkpoint(AUTOENCODER_PATH, config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
        model.to(device).eval()
        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            latent = model.autoencoder.encode(image)
            latent_normalization = {
                "mean": latent.mean(dim=(0, 2, 3), keepdim=True),
                "standardDeviation": latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6),
            }
        diffusion = trainer.build_diffusion_schedule(config, device)
        decoded_outputs = []
        hook = model.autoencoder.decoder.register_forward_hook(
            lambda _module, _inputs, value: decoded_outputs.append(value)
        )
        try:
            result = trainer.stage4_full_rollout_final_visible_consistency(
                model,
                conditions,
                image,
                diffusion["alphasCumulative"],
                latent_normalization,
                config,
                0,
            )
        finally:
            hook.remove()
        if result is None or len(decoded_outputs) != 1:
            raise ValueError("per_class_rollout_gpu_final_decoded_rgb_capture_invalid")
        total_loss = result["stage4FullRolloutFinalVisibleConsistencyLossTensor"]
        if not bool(torch.isfinite(total_loss).all()) or float(total_loss.detach().cpu()) <= 0.0:
            raise ValueError("per_class_rollout_gpu_total_loss_nonfinite_or_zero")
        decoded_rgb = decoded_outputs[0]
        parameters = tuple(model.denoiser.parameters())
        parameter_names = tuple(name for name, _ in model.denoiser.named_parameters())
        class_evidence = {}
        order = list(config["conditionChannelOrder"])
        for class_index, (identity, channel) in enumerate(zip(CLASS_IDENTITIES, CLASS_CHANNELS)):
            prefix = identity.capitalize()
            class_loss = result[
                f"stage4FullRollout{prefix}FinalVisibleMultiscaleLuminanceStructureLoss"
            ]
            gradients = torch.autograd.grad(
                class_loss,
                (decoded_rgb, *parameters),
                retain_graph=(
                    worst_sample_class_mode
                    or reference_feature_structure_mode
                    or class_index < len(CLASS_IDENTITIES) - 1
                ),
                create_graph=False,
                allow_unused=True,
            )
            rgb_gradient = gradients[0]
            parameter_gradients = gradients[1:]
            mask = conditions[:, order.index(channel):order.index(channel) + 1]
            mask_rgb = mask.expand_as(rgb_gradient)
            inside = float((rgb_gradient.detach().abs() * mask_rgb).sum().cpu())
            outside = float((rgb_gradient.detach().abs() * (1.0 - mask_rgb)).sum().cpu())
            parameter_total = sum(
                0.0 if gradient is None else float(gradient.detach().abs().sum().cpu())
                for gradient in parameter_gradients
            )
            finite_parameters = all(
                gradient is None or bool(torch.isfinite(gradient).all())
                for gradient in parameter_gradients
            )
            own_expert = sum(
                0.0 if gradient is None else float(gradient.detach().abs().sum().cpu())
                for name, gradient in zip(parameter_names, parameter_gradients)
                if (
                    f"semantic_mixture_experts.{identity}." in name
                    or f"semantic_mixture_participation.{identity}." in name
                )
            )
            evidence = {
                "loss": float(class_loss.detach().cpu()),
                "lossFinite": bool(torch.isfinite(class_loss).all()),
                "decodedRgbGradientFinite": bool(torch.isfinite(rgb_gradient).all()),
                "insideMaskDecodedRgbGradientAbsSum": inside,
                "outsideMaskDecodedRgbGradientAbsSum": outside,
                "denoiserGradientFinite": finite_parameters,
                "denoiserGradientAbsSum": parameter_total,
                "ownSemanticExpertGradientAbsSum": own_expert,
            }
            if not (
                evidence["lossFinite"]
                and evidence["decodedRgbGradientFinite"]
                and inside > 0.0
                and outside == 0.0
                and finite_parameters
                and parameter_total > 0.0
            ):
                raise ValueError(f"per_class_rollout_gpu_gradient_qualification_failed:{identity}:{evidence}")
            class_evidence[identity] = evidence
        reference_feature_structure_evidence = None
        if reference_feature_structure_mode:
            feature_result = (
                trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                    model.autoencoder,
                    decoded_rgb.clamp(0.0, 1.0),
                    image,
                    conditions,
                    config,
                )
            )
            feature_class_evidence = {}
            for class_index, (identity, channel) in enumerate(
                zip(CLASS_IDENTITIES, CLASS_CHANNELS)
            ):
                class_loss = feature_result["perClassLossTensors"][identity]
                gradients = torch.autograd.grad(
                    class_loss,
                    (decoded_rgb, *parameters),
                    retain_graph=class_index < len(CLASS_IDENTITIES) - 1,
                    create_graph=False,
                    allow_unused=True,
                )
                rgb_gradient = gradients[0]
                parameter_gradients = gradients[1:]
                mask = conditions[:, order.index(channel):order.index(channel) + 1]
                mask_rgb = mask.expand_as(rgb_gradient)
                inside = float((rgb_gradient.detach().abs() * mask_rgb).sum().cpu())
                outside = float(
                    (rgb_gradient.detach().abs() * (1.0 - mask_rgb)).sum().cpu()
                )
                parameter_total = sum(
                    0.0 if gradient is None
                    else float(gradient.detach().abs().sum().cpu())
                    for gradient in parameter_gradients
                )
                finite_parameters = all(
                    gradient is None or bool(torch.isfinite(gradient).all())
                    for gradient in parameter_gradients
                )
                alternate_conditions = conditions.detach().clone()
                for other_channel in CLASS_CHANNELS:
                    if other_channel != channel:
                        other_index = order.index(other_channel)
                        alternate_conditions[:, other_index:other_index + 1].zero_()
                with torch.no_grad():
                    alternate = (
                        trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                            model.autoencoder,
                            decoded_rgb.detach().clamp(0.0, 1.0),
                            image,
                            alternate_conditions,
                            config,
                        )["perClassLossTensors"][identity]
                    )
                cross_class_sources_isolated = bool(
                    torch.equal(class_loss.detach(), alternate.detach())
                )
                evidence = {
                    "loss": float(class_loss.detach().cpu()),
                    "lossFinite": bool(torch.isfinite(class_loss).all()),
                    "decodedRgbGradientFinite": bool(torch.isfinite(rgb_gradient).all()),
                    "insideMaskDecodedRgbGradientAbsSum": inside,
                    "outsideMaskDecodedRgbGradientAbsSum": outside,
                    "denoiserGradientFinite": finite_parameters,
                    "denoiserGradientAbsSum": parameter_total,
                    "crossClassConditionSourcesIsolated": cross_class_sources_isolated,
                }
                if not (
                    evidence["lossFinite"]
                    and evidence["decodedRgbGradientFinite"]
                    and inside > 0.0
                    and outside == 0.0
                    and finite_parameters
                    and parameter_total > 0.0
                    and cross_class_sources_isolated
                ):
                    raise ValueError(
                        "reference_feature_structure_gpu_gradient_qualification_failed:"
                        f"{identity}:{evidence}"
                    )
                feature_class_evidence[identity] = evidence
            reference_feature_structure_evidence = {
                "featureStageCount": feature_result["featureStageCount"],
                "derivedClassWeights": feature_result["derivedClassWeights"],
                "rolloutWeight": config["training"][
                    REFERENCE_FEATURE_STRUCTURE_CONTRACT_KEY
                ]["aggregation"]["rolloutWeight"],
                "perClass": feature_class_evidence,
            }
        worst_sample_class_evidence = None
        if worst_sample_class_mode:
            worst_result = (
                trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
                    decoded_rgb.clamp(0.0, 1.0), image, conditions, config,
                )
            )
            matrix = worst_result["weightedPerSampleClassTensors"]
            worst = worst_result["worstWeightedSampleClassTensor"]
            winner_flat = int(matrix.detach().reshape(-1).argmax().cpu())
            winner_sample_index, winner_class_index = divmod(
                winner_flat, len(CLASS_IDENTITIES)
            )
            winner_identity = CLASS_IDENTITIES[winner_class_index]
            winner_channel = CLASS_CHANNELS[winner_class_index]
            worst_gradients = torch.autograd.grad(
                worst,
                (decoded_rgb, *parameters),
                retain_graph=False,
                create_graph=False,
                allow_unused=True,
            )
            worst_rgb_gradient = worst_gradients[0]
            winner_mask = conditions[
                winner_sample_index:winner_sample_index + 1,
                order.index(winner_channel):order.index(winner_channel) + 1,
            ].expand_as(worst_rgb_gradient)
            worst_inside = float(
                (worst_rgb_gradient.detach().abs() * winner_mask).sum().cpu()
            )
            worst_outside = float(
                (worst_rgb_gradient.detach().abs() * (1.0 - winner_mask)).sum().cpu()
            )
            worst_parameter_gradients = worst_gradients[1:]
            worst_parameter_total = sum(
                0.0 if gradient is None else float(gradient.detach().abs().sum().cpu())
                for gradient in worst_parameter_gradients
            )
            route_metrics = trainer.route_late_regression_diagnostic_metrics(
                decoded_rgb.clamp(0.0, 1.0), image, conditions, config,
            )
            west_contact = float(
                route_metrics[
                    "stage4DiagnosticRouteRequiredBoundaryContactMinimum"
                ].detach().cpu()
            )
            west_equal_passes = (
                trainer.stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(
                    config, west_contact, west_contact,
                )
            )
            west_regression_rejected = not (
                trainer.stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(
                    config, west_contact - 1.0, west_contact,
                )
            )
            worst_sample_class_evidence = {
                "weightedPerSampleClass": matrix.detach().cpu().tolist(),
                "worstWeightedSampleClass": float(worst.detach().cpu()),
                "winnerSampleIndex": winner_sample_index,
                "winnerClass": winner_identity,
                "decodedRgbGradientFinite": bool(torch.isfinite(worst_rgb_gradient).all()),
                "insideMaskDecodedRgbGradientAbsSum": worst_inside,
                "outsideMaskDecodedRgbGradientAbsSum": worst_outside,
                "denoiserGradientFinite": all(
                    gradient is None or bool(torch.isfinite(gradient).all())
                    for gradient in worst_parameter_gradients
                ),
                "denoiserGradientAbsSum": worst_parameter_total,
                "routeWestBoundary": {
                    "requiredSides": list(
                        config["training"]["authorizedBoundaryTopology"]["requiredBoundarySides"]
                    ),
                    "contactMinimum": west_contact,
                    "equalCandidatePasses": west_equal_passes,
                    "syntheticRegressionRejected": west_regression_rejected,
                    "freeThresholdSelected": False,
                },
            }
            if not (
                tuple(matrix.shape) == (1, len(CLASS_IDENTITIES))
                and bool(torch.isfinite(matrix).all())
                and bool(torch.equal(worst, matrix.reshape(-1).amax()))
                and worst_sample_class_evidence["decodedRgbGradientFinite"]
                and worst_inside > 0.0
                and worst_outside == 0.0
                and worst_sample_class_evidence["denoiserGradientFinite"]
                and worst_parameter_total > 0.0
                and list(config["training"]["authorizedBoundaryTopology"]["requiredBoundarySides"])
                == ["west"]
                and math.isfinite(west_contact)
                and west_equal_passes
                and west_regression_rejected
            ):
                raise ValueError(
                    "worst_sample_class_rollout_gpu_qualification_failed:"
                    f"{worst_sample_class_evidence}"
                )
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("per_class_rollout_gpu_parameter_grad_fields_populated")
        step("full_50_step_per_class_autograd_grad_passed", {
            "classes": class_evidence,
            "referenceFeatureStructure": reference_feature_structure_evidence,
            "worstSampleClass": worst_sample_class_evidence,
        })

        metrics = {
            name: float(value.detach().cpu())
            for name, value in result.items()
            if torch.is_tensor(value) and value.numel() == 1
        }
        if any(not math.isfinite(value) for value in metrics.values()):
            raise ValueError("per_class_rollout_gpu_metric_nonfinite")
        torch.cuda.synchronize(0)
        cuda = {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        model.to("cpu")
        denoiser_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
            raise ValueError("per_class_rollout_gpu_model_state_changed")
        step("model_states_unchanged")
        report = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-final-visible-reference-feature-structure-readonly-gpu-report-v1"
                if reference_feature_structure_mode
                else
                "ai-painter-stage4-worst-sample-class-reference-luminance-readonly-gpu-report-v1"
                if worst_sample_class_mode
                else "ai-painter-stage4-per-class-full-rollout-readonly-gpu-report-v1"
            ),
            "status": (
                "passed_readonly_50_step_per_class_final_visible_reference_feature_structure_gradient_qualification"
                if reference_feature_structure_mode
                else
                "passed_readonly_50_step_worst_sample_class_reference_luminance_gradient_qualification"
                if worst_sample_class_mode
                else "passed_readonly_50_step_per_class_final_visible_luminance_structure_gradient_qualification"
            ),
            **timestamps(),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "taskIdentity": authorization["taskIdentity"],
            "metrics": metrics,
            "perClassGradientEvidence": class_evidence,
            "referenceFeatureStructureEvidence": reference_feature_structure_evidence,
            "worstSampleClassEvidence": worst_sample_class_evidence,
            "stateHashes": {
                "denoiserBefore": denoiser_before,
                "denoiserAfter": denoiser_after,
                "autoencoderBefore": autoencoder_before,
                "autoencoderAfter": autoencoder_after,
            },
            "cuda": cuda,
            "safety": state,
        }
        write_json_exclusive(output / "gpu-qualification-report.json", report)
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-cuda-telemetry-v1", **timestamps(), **cuda,
        })
        terminal = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-final-visible-reference-feature-structure-readonly-gpu-terminal-v1"
                if reference_feature_structure_mode
                else
                "ai-painter-stage4-worst-sample-class-reference-luminance-readonly-gpu-terminal-v1"
                if worst_sample_class_mode
                else "ai-painter-stage4-per-class-full-rollout-readonly-gpu-terminal-v1"
            ),
            "status": (
                "stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_qualification_succeeded_closed"
                if reference_feature_structure_mode
                else
                "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification_succeeded_closed"
                if worst_sample_class_mode
                else "stage4_full_rollout_per_class_luminance_readonly_gpu_qualification_succeeded_closed"
            ),
            **timestamps(),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "nextLegalAction": "compile_new_candidate_smoke_entry_and_run_one_new_30_epoch_smoke_under_separate_authorization",
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
            "evidence": {
                "report": binding(output / "gpu-qualification-report.json"),
                "cudaTelemetry": binding(output / "cuda-telemetry.json"),
                "consumption": binding(consumption_path),
            },
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        write_json_exclusive(output / "local-task-capsule.json", {
            "schemaVersion": "ai-painter-local-task-capsule-v1",
            "module": "AI Painter R5",
            "fixedTotalProgress": terminal["fixedTotalProgress"],
            "currentStage": (
                "Stage4 per-class final-visible reference feature structure readonly GPU qualification complete"
                if reference_feature_structure_mode
                else
                "Stage4 worst sample-class final-visible reference luminance readonly GPU qualification complete"
                if worst_sample_class_mode
                else "Stage4 per-class 50-step final-visible luminance-structure readonly GPU qualification complete"
            ),
            "candidateTerminal": binding(output / "phase-terminal.json"),
            "latestBlocker": None,
            "nextLegalAction": terminal["nextLegalAction"],
            "evidence": terminal["evidence"],
            **timestamps(),
        })
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        failure = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-final-visible-reference-feature-structure-readonly-gpu-terminal-v1"
                if reference_feature_structure_mode
                else
                "ai-painter-stage4-worst-sample-class-reference-luminance-readonly-gpu-terminal-v1"
                if worst_sample_class_mode
                else "ai-painter-stage4-per-class-full-rollout-readonly-gpu-terminal-v1"
            ),
            "status": (
                "stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_qualification_failed_closed"
                if reference_feature_structure_mode
                else
                "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification_failed_closed"
                if worst_sample_class_mode
                else "stage4_full_rollout_per_class_luminance_readonly_gpu_qualification_failed_closed"
            ),
            **timestamps(),
            "errorType": type(error).__name__,
            "error": str(error),
            "traceback": traceback.format_exc(),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "safety": state,
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", failure)
        print(json.dumps({**failure, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 1


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def timestamps() -> dict:
    now = datetime.now(timezone.utc)
    shanghai = now.astimezone(timezone(timedelta(hours=8)))
    return {"recordedAtUtc": now.isoformat().replace("+00:00", "Z"), "recordedAtAsiaShanghai": shanghai.isoformat()}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{time.time_ns()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def resolve(path: Path) -> Path:
    if path.is_absolute():
        return path.resolve()
    return (ROOT / path).resolve()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        runtime_root = (ROOT / ".runtime").resolve()
        if resolved == runtime_root or runtime_root in resolved.parents:
            return str(Path(".runtime") / resolved.relative_to(runtime_root)).replace("\\", "/")
        return str(resolved).replace("\\", "/")


if __name__ == "__main__":
    raise SystemExit(main())

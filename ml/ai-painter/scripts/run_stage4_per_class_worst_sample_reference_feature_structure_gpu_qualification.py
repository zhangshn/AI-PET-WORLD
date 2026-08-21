from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import gc
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
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
CONTRACT_ID = "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1"
SEED = 20263722
IMAGE_SIZE = (256, 192)
ROLLOUT_STEPS = 50
GRADIENT_TAIL_STEPS = 5
CLASS_IDENTITIES = ("footprints", "tree", "rock", "vegetation")
EXPECTED_ACTIONS = (
    "read_bound_inactive_config",
    "read_project_autoencoder_checkpoint",
    "initialize_random_denoiser",
    "scan_approved_train_and_validation_reference_feature_obligations",
    "execute_cuda_forward",
    "execute_torch_autograd_grad",
    "write_readonly_gpu_qualification_evidence",
)


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
        report = run_preflight(authorization)
        preflight_path = resolve(Path(authorization["preflightReportPath"]))
        write_json_exclusive(preflight_path, report)
        print(json.dumps({**report, "preflightReport": binding(preflight_path)},
                         ensure_ascii=False, indent=2))
        return 0
    consumption_path = authorization_path.parent / "gpu-consumption.json"
    consume_authorization(authorization_path, authorization, consumption_path)
    return run_gpu(authorization, output, consumption_path)


def validate_authorization(path: Path, output: Path) -> dict:
    value = read_json(path)
    if value.get("schemaVersion") != (
        "ai-painter-stage4-per-class-worst-sample-reference-feature-structure-"
        "readonly-gpu-authorization-v1"
    ):
        raise ValueError("per_class_worst_reference_feature_gpu_authorization_schema_invalid")
    if value.get("status") != "owner_authorized_pending_execution":
        raise ValueError("per_class_worst_reference_feature_gpu_authorization_status_invalid")
    if value.get("requestId") != value.get("commandRef"):
        raise ValueError("per_class_worst_reference_feature_gpu_authorization_identity_mismatch")
    if tuple(value.get("allowedActions", ())) != EXPECTED_ACTIONS:
        raise ValueError("per_class_worst_reference_feature_gpu_authorization_actions_invalid")
    if any(action in set(value.get("deniedActions", ())) for action in EXPECTED_ACTIONS):
        raise ValueError("per_class_worst_reference_feature_gpu_authorization_action_conflict")
    if resolve(Path(value["outputNamespace"])) != output or output.exists():
        raise ValueError("per_class_worst_reference_feature_gpu_output_namespace_invalid")
    preflight_path = resolve(Path(value["preflightReportPath"]))
    if preflight_path.parent != path.parent:
        raise ValueError("per_class_worst_reference_feature_gpu_preflight_path_invalid")
    for name in (
        "cpuTerminal", "cpuReport", "configurationAudit", "inactiveConfig",
        "supportContract", "implementationAuthorization",
        "implementationConsumption", "trainer", "gpuRunner", "cpuChecker",
        "cpuGateReport", "projectAutoencoderCheckpoint",
    ):
        binding_value = value["bindings"][name]
        bound_path = resolve(Path(binding_value["path"]))
        if (
            not bound_path.is_file()
            or sha256_file(bound_path) != binding_value["sha256"]
        ):
            raise ValueError(
                f"per_class_worst_reference_feature_gpu_binding_invalid:{name}"
            )
    expected_identity = {
        "contractId": CONTRACT_ID,
        "trainSplitSampleCount": 48,
        "validationSplitSampleCount": 8,
        "seed": SEED,
        "imageSize": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "rolloutSteps": ROLLOUT_STEPS,
        "gradientTailSteps": GRADIENT_TAIL_STEPS,
        "classIdentities": list(CLASS_IDENTITIES),
        "perClassSelection": "maximum_over_samples_within_each_bound_object_class",
        "checkpointQualification": (
            "same_four_per_class_worst_obligations_on_validation"
        ),
    }
    if value.get("taskIdentity") != expected_identity:
        raise ValueError("per_class_worst_reference_feature_gpu_task_identity_invalid")
    if value.get("consumptionState") != {
        "consumed": False,
        "consumptionPath": None,
    }:
        raise ValueError("per_class_worst_reference_feature_gpu_already_consumed")
    if value.get("safetyBoundary") != {
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
        "oldDenoiserCheckpointRead": False,
    }:
        raise ValueError("per_class_worst_reference_feature_gpu_safety_invalid")
    return value


def run_preflight(authorization: dict) -> dict:
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("per_class_worst_reference_feature_gpu_cuda_unavailable")
    disk_probe = resolve(Path(authorization["outputNamespace"])).parent
    while not disk_probe.exists() and disk_probe.parent != disk_probe:
        disk_probe = disk_probe.parent
    disk = shutil.disk_usage(disk_probe)
    if disk.free < 4 * 1024**3:
        raise ValueError("per_class_worst_reference_feature_gpu_disk_budget_insufficient")
    properties = torch.cuda.get_device_properties(0)
    return {
        "schemaVersion": (
            "ai-painter-stage4-per-class-worst-sample-reference-feature-"
            "structure-gpu-preflight-v1"
        ),
        "status": "passed_gpu_not_started_not_consumed",
        **timestamps(),
        "python": {
            "executable": sys.executable,
            "version": sys.version,
            "torchVersion": torch.__version__,
            "cudaAvailable": True,
        },
        "cuda": {
            "deviceIndex": 0,
            "name": properties.name,
            "totalMemoryBytes": properties.total_memory,
        },
        "disk": {"freeBytes": disk.free},
        "authorizationConsumed": False,
        "checkpointRead": False,
        "gpuWorkloadStarted": False,
    }


def consume_authorization(path: Path, authorization: dict, consumption_path: Path) -> None:
    if consumption_path.exists():
        raise ValueError("per_class_worst_reference_feature_gpu_consumption_exists")
    preflight_path = resolve(Path(authorization["preflightReportPath"]))
    if not preflight_path.is_file():
        raise ValueError("per_class_worst_reference_feature_gpu_preflight_missing")
    preflight = read_json(preflight_path)
    if preflight.get("status") != "passed_gpu_not_started_not_consumed":
        raise ValueError("per_class_worst_reference_feature_gpu_preflight_invalid")
    write_json_exclusive(consumption_path, {
        "schemaVersion": (
            "ai-painter-stage4-per-class-worst-sample-reference-feature-"
            "structure-readonly-gpu-consumption-v1"
        ),
        "status": "consumed_once_before_gpu_execution",
        **timestamps(),
        "requestId": authorization["requestId"],
        "commandRef": authorization["commandRef"],
        "authorizationPath": project_path(path),
        "authorizationSha256": sha256_file(path),
        "preflightReport": binding(preflight_path),
        "outputNamespace": authorization["outputNamespace"],
        "allowedActions": list(EXPECTED_ACTIONS),
        "oneTimeConsumption": True,
    })


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

    def step(code: str, details=None):
        steps.append({
            "index": len(steps) + 1,
            "code": code,
            "details": details or {},
            **timestamps(),
        })
        write_json_atomic(output / "step-telemetry.json", {
            "completedSteps": steps,
            **state,
        })

    try:
        step("authorization_consumed", {
            "consumptionSha256": sha256_file(consumption_path),
        })
        torch.cuda.init()
        torch.cuda.set_device(0)
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        device = torch.device("cuda:0")
        config = read_json(
            resolve(Path(authorization["bindings"]["inactiveConfig"]["path"]))
        )
        contract = (
            trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
                config
            )
        )
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            config
        )
        if contract is None or contract.get("status") != "cpu_support_verified_inactive":
            raise ValueError("per_class_worst_reference_feature_gpu_contract_invalid")

        train_dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            "train",
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        validation_dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            "validation",
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        if (
            len(train_dataset) != 48
            or len(validation_dataset) != 8
            or len({str(row["sampleId"]) for row in train_dataset.rows}) != 48
            or len({str(row["sampleId"]) for row in validation_dataset.rows}) != 8
        ):
            raise ValueError("per_class_worst_reference_feature_gpu_split_invalid")
        step("approved_dataset_splits_loaded", {
            "trainSampleCount": len(train_dataset),
            "validationSampleCount": len(validation_dataset),
        })

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        checkpoint = trainer.load_autoencoder_checkpoint(
            resolve(AUTOENCODER_PATH), config
        )
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        model.to(device).eval()
        denoiser_before = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
        latent_normalization = trainer.compute_latent_normalization(
            model, train_dataset, device
        )
        diffusion = trainer.build_diffusion_schedule(config, device)
        step("frozen_autoencoder_loaded_and_random_denoiser_initialized", {
            "denoiserStateSha256": denoiser_before,
            "autoencoderStateSha256": autoencoder_before,
        })

        train_scan = scan_population(
            model,
            train_dataset,
            config,
            diffusion["alphasCumulative"],
            latent_normalization,
            device,
            split_name="train",
            progress=step,
        )
        train_selected = (
            trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
                train_scan["perSampleClassTensor"],
                train_scan["sampleIds"],
                config,
            )
        )
        step("train_per_class_worst_samples_selected", {
            "selections": json_safe_selections(train_selected["perClassSelections"]),
        })

        validation_scan = scan_population(
            model,
            validation_dataset,
            config,
            diffusion["alphasCumulative"],
            latent_normalization,
            device,
            split_name="validation",
            progress=step,
        )
        validation_selected = (
            trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
                validation_scan["perSampleClassTensor"],
                validation_scan["sampleIds"],
                config,
            )
        )
        step("validation_checkpoint_qualification_selected", {
            "selections": json_safe_selections(
                validation_selected["perClassSelections"]
            ),
            "checkpointQualification": float(
                validation_selected["checkpointQualificationTensor"].detach().cpu()
            ),
        })

        gradient_evidence = {}
        train_index_by_id = {
            str(row["sampleId"]): index
            for index, row in enumerate(train_dataset.rows)
        }
        condition_order = list(config["conditionChannelOrder"])
        parameters = tuple(model.denoiser.parameters())
        derived_weights = contract["sourceContracts"]["derivedClassWeights"]
        for class_index, identity in enumerate(CLASS_IDENTITIES):
            selected = train_selected["perClassSelections"][class_index]
            sample_id = str(selected["sampleId"])
            dataset_index = train_index_by_id[sample_id]
            sample = train_dataset[dataset_index]
            target = sample["image"].unsqueeze(0).to(device)
            conditions = sample["conditions"].unsqueeze(0).to(device)
            predicted = rollout_final_rgb(
                model,
                conditions,
                target,
                diffusion["alphasCumulative"],
                latent_normalization,
                config,
                dataset_index,
            )
            losses = (
                trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                    model.autoencoder,
                    predicted,
                    target,
                    conditions,
                    config,
                )
            )
            loss = losses["perSampleClassTensors"][0, class_index]
            decoded_gradient = torch.autograd.grad(
                loss, predicted, retain_graph=True, create_graph=False
            )[0]
            parameter_gradients = torch.autograd.grad(
                loss,
                parameters,
                retain_graph=False,
                create_graph=False,
                allow_unused=True,
            )
            mask = conditions[
                :,
                condition_order.index(f"object_{identity}"):
                condition_order.index(f"object_{identity}") + 1,
            ]
            mask = torch.nn.functional.interpolate(
                mask, size=predicted.shape[-2:], mode="nearest"
            ).clamp(0.0, 1.0)
            inside = float((decoded_gradient.abs() * mask).sum().detach().cpu())
            outside = float(
                (decoded_gradient.abs() * (1.0 - mask)).sum().detach().cpu()
            )
            parameter_total = sum(
                0.0
                if gradient is None
                else float(gradient.detach().abs().sum().cpu())
                for gradient in parameter_gradients
            )
            finite = bool(torch.isfinite(decoded_gradient).all()) and all(
                gradient is None or bool(torch.isfinite(gradient).all())
                for gradient in parameter_gradients
            )
            if (
                not finite
                or not math.isfinite(inside)
                or inside <= 0.0
                or outside != 0.0
                or not math.isfinite(parameter_total)
                or parameter_total <= 0.0
                or any(parameter.grad is not None for parameter in model.parameters())
            ):
                raise ValueError(
                    f"per_class_worst_reference_feature_gpu_gradient_invalid:{identity}"
                )
            gradient_evidence[identity] = {
                "selectedSampleId": sample_id,
                "selectedDatasetIndex": dataset_index,
                "rawLoss": float(loss.detach().cpu()),
                "derivedClassWeight": float(derived_weights[identity]),
                "finite": finite,
                "insideMaskDecodedRgbGradientAbsSum": inside,
                "outsideMaskDecodedRgbGradientAbsSum": outside,
                "denoiserParameterGradientAbsSum": parameter_total,
            }
            step("per_class_gradient_passed", {
                "classIdentity": identity,
                **gradient_evidence[identity],
            })
            del predicted, losses, loss, decoded_gradient, parameter_gradients
            gc.collect()
            torch.cuda.empty_cache()

        rollout_weight = float(contract["sourceContracts"]["rolloutWeight"])
        train_total = float(train_selected["weightedTotalTensor"].detach().cpu())
        train_checkpoint = float(
            train_selected["checkpointQualificationTensor"].detach().cpu()
        )
        validation_total = float(
            validation_selected["weightedTotalTensor"].detach().cpu()
        )
        validation_checkpoint = float(
            validation_selected["checkpointQualificationTensor"].detach().cpu()
        )
        if (
            not math.isclose(train_checkpoint, train_total * rollout_weight,
                             rel_tol=0.0, abs_tol=1e-7)
            or not math.isclose(
                validation_checkpoint,
                validation_total * rollout_weight,
                rel_tol=0.0,
                abs_tol=1e-7,
            )
        ):
            raise ValueError(
                "per_class_worst_reference_feature_gpu_checkpoint_weight_mismatch"
            )

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
            raise ValueError("per_class_worst_reference_feature_gpu_model_state_changed")

        report = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-worst-sample-reference-feature-"
                "structure-readonly-gpu-report-v1"
            ),
            "status": (
                "passed_stage4_per_class_worst_sample_reference_feature_"
                "structure_readonly_gpu_qualification"
            ),
            **timestamps(),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "taskIdentity": authorization["taskIdentity"],
            "train": population_report(train_scan, train_selected),
            "validationCheckpointQualification": population_report(
                validation_scan, validation_selected
            ),
            "gradientEvidence": gradient_evidence,
            "derivedClassWeights": dict(derived_weights),
            "rolloutWeight": rollout_weight,
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
            "schemaVersion": "ai-painter-cuda-telemetry-v1",
            **timestamps(),
            **cuda,
        })
        terminal = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-worst-sample-reference-feature-"
                "structure-readonly-gpu-terminal-v1"
            ),
            "status": (
                "stage4_per_class_worst_sample_reference_feature_structure_"
                "readonly_gpu_qualification_succeeded_closed"
            ),
            **timestamps(),
            "fixedTotalProgress": {
                "completedStages": 3,
                "totalStages": 5,
                "percent": 60,
            },
            "nextLegalAction": (
                "compile_one_new_30_epoch_smoke_entry_for_current_candidate"
            ),
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
            "evidence": {
                "report": binding(output / "gpu-qualification-report.json"),
                "cudaTelemetry": binding(output / "cuda-telemetry.json"),
                "consumption": binding(consumption_path),
                "stepTelemetry": binding(output / "step-telemetry.json"),
            },
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        write_json_exclusive(output / "local-task-capsule.json", {
            "schemaVersion": "ai-painter-local-task-capsule-v1",
            "module": "AI Painter R5",
            "fixedTotalProgress": terminal["fixedTotalProgress"],
            "currentStage": (
                "Stage4 per-class worst-sample reference feature structure "
                "readonly GPU qualification complete"
            ),
            "candidateTerminal": binding(output / "phase-terminal.json"),
            "latestBlocker": None,
            "nextLegalAction": terminal["nextLegalAction"],
            "evidence": terminal["evidence"],
            **timestamps(),
        })
        print(json.dumps(
            {**terminal, "terminal": binding(output / "phase-terminal.json")},
            ensure_ascii=False,
            indent=2,
        ))
        return 0
    except Exception as error:
        failure = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-worst-sample-reference-feature-"
                "structure-readonly-gpu-terminal-v1"
            ),
            "status": (
                "stage4_per_class_worst_sample_reference_feature_structure_"
                "readonly_gpu_qualification_failed_closed"
            ),
            **timestamps(),
            "errorType": type(error).__name__,
            "error": str(error),
            "traceback": traceback.format_exc(),
            "fixedTotalProgress": {
                "completedStages": 3,
                "totalStages": 5,
                "percent": 60,
            },
            "safety": state,
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", failure)
        print(json.dumps(
            {**failure, "terminal": binding(output / "phase-terminal.json")},
            ensure_ascii=False,
            indent=2,
        ))
        return 1


def scan_population(
    model,
    dataset,
    config,
    alpha_bars,
    latent_normalization,
    device,
    *,
    split_name: str,
    progress,
) -> dict:
    sample_ids = []
    rows = []
    with torch.no_grad():
        for index in range(len(dataset)):
            sample = dataset[index]
            target = sample["image"].unsqueeze(0).to(device)
            conditions = sample["conditions"].unsqueeze(0).to(device)
            predicted = rollout_final_rgb(
                model,
                conditions,
                target,
                alpha_bars,
                latent_normalization,
                config,
                index,
            )
            losses = (
                trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                    model.autoencoder,
                    predicted,
                    target,
                    conditions,
                    config,
                )
            )
            rows.append(losses["perSampleClassTensors"][0].detach().cpu())
            sample_ids.append(str(sample["sampleId"]))
            progress(f"{split_name}_sample_scanned", {
                "sampleIndex": index,
                "sampleCount": len(dataset),
                "sampleId": sample_ids[-1],
            })
    return {
        "sampleIds": sample_ids,
        "perSampleClassTensor": torch.stack(rows),
    }


def rollout_final_rgb(
    model,
    conditions,
    target,
    alpha_bars,
    latent_normalization,
    config,
    batch_index: int,
):
    steps = trainer.inference_timesteps(
        int(config["diffusionSteps"]),
        int(config["inferenceSteps"]),
        target.device,
    )
    if len(steps) != ROLLOUT_STEPS:
        raise ValueError("per_class_worst_reference_feature_gpu_rollout_steps_changed")
    gradient_tail = int(
        config["training"]["stage4FullRolloutFinalVisibleConsistency"][
            "gradientTailSteps"
        ]
    )
    if gradient_tail != GRADIENT_TAIL_STEPS:
        raise ValueError("per_class_worst_reference_feature_gpu_gradient_tail_changed")
    with torch.no_grad():
        latent_shape = model.autoencoder.encode(target).shape
    generator = torch.Generator(device=target.device).manual_seed(
        int(config["training"]["seed"]) + 3000 + int(batch_index)
    )
    latent = torch.randn(latent_shape, device=target.device, generator=generator)
    no_gradient_steps = len(steps) - gradient_tail
    for step_index, timestep in enumerate(steps):
        timestep_value = int(timestep.item())
        previous = (
            int(steps[step_index + 1].item())
            if step_index + 1 < len(steps)
            else -1
        )
        timestep_batch = torch.full(
            (latent.shape[0],),
            timestep_value,
            device=latent.device,
            dtype=torch.long,
        )
        if step_index < no_gradient_steps:
            with torch.no_grad():
                velocity = model.predict_velocity(latent, timestep_batch, conditions)
                latent = trainer.deterministic_velocity_step(
                    latent, velocity, timestep_value, previous, alpha_bars
                )
            latent = latent.detach()
        else:
            velocity = model.predict_velocity(latent, timestep_batch, conditions)
            latent = trainer.deterministic_velocity_step(
                latent, velocity, timestep_value, previous, alpha_bars
            )
    return model.autoencoder.decode(
        trainer.denormalize_latent(latent, latent_normalization)
    ).clamp(0.0, 1.0)


def population_report(scan: dict, selected: dict) -> dict:
    return {
        "sampleCount": len(scan["sampleIds"]),
        "sampleIds": list(scan["sampleIds"]),
        "perSampleClassValues": scan["perSampleClassTensor"].tolist(),
        "selections": json_safe_selections(selected["perClassSelections"]),
        "weightedTotal": float(selected["weightedTotalTensor"].detach().cpu()),
        "checkpointQualification": float(
            selected["checkpointQualificationTensor"].detach().cpu()
        ),
    }


def json_safe_selections(selections) -> list[dict]:
    return [
        {
            key: value
            for key, value in selection.items()
            if key != "selectionKey"
        }
        for selection in selections
    ]


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(
            json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii")
        )
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def timestamps() -> dict:
    now = datetime.now(timezone.utc)
    shanghai = now.astimezone(timezone(timedelta(hours=8)))
    return {
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": shanghai.isoformat(),
    }


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
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
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
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime_root = (ROOT / ".runtime").resolve()
    if resolved == runtime_root or runtime_root in resolved.parents:
        return str(
            Path(".runtime") / resolved.relative_to(runtime_root)
        ).replace("\\", "/")
    return str(resolved.relative_to(ROOT)).replace("\\", "/")


if __name__ == "__main__":
    raise SystemExit(main())

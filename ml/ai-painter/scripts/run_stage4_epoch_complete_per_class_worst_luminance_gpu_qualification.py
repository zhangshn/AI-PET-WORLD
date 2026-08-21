from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
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
CONTRACT_ID = (
    "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_"
    "selection_and_checkpoint_identity_v1"
)
AUTH_SCHEMA = (
    "ai-painter-stage4-epoch-complete-per-class-worst-luminance-readonly-"
    "gpu-authorization-v1"
)
SCOPE = (
    "one_stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_"
    "qualification_only"
)
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
SOURCE_INDEX_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
)
AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SEED = 20263722
IMAGE_SIZE = (256, 192)
CLASS_IDENTITIES = ("footprints", "tree", "rock", "vegetation")
CLASS_CHANNELS = tuple(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
ALLOWED_ACTIONS = (
    "read_bound_cpu_qualification_evidence",
    "inspect_python_cuda_and_disk_resources",
    "read_project_autoencoder_checkpoint",
    "initialize_fixed_random_denoiser",
    "read_all_48_train_and_8_validation_records",
    "execute_cuda_50_step_readonly_rollouts",
    "execute_torch_autograd_grad_for_four_selected_sample_classes",
    "write_readonly_gpu_qualification_evidence_and_local_records",
)
DENIED_ACTIONS = {
    "read_old_denoiser_checkpoint", "read_failed_checkpoint", "create_optimizer",
    "execute_backward", "modify_model_weights", "write_checkpoint", "start_smoke",
    "start_stage0", "start_stage1", "start_stage2", "start_training",
    "checkpoint_promotion", "formal_inference", "runtime_frame", "world_entry",
}


def resolve(path: Path) -> Path:
    value = path if path.is_absolute() else ROOT / path
    return value.resolve()


def resolve_project(path: Path) -> Path:
    if path.is_absolute():
        raise ValueError("epoch_complete_gpu_absolute_project_path_rejected")
    logical = Path(os.path.abspath(str(ROOT / path)))
    if logical != ROOT and ROOT not in logical.parents:
        raise ValueError("epoch_complete_gpu_project_path_escape_rejected")
    return logical.resolve()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def timestamps() -> dict:
    now = datetime.now(timezone.utc)
    shanghai = now.astimezone(timezone(timedelta(hours=8)))
    return {
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": shanghai.isoformat(),
    }


def write_json_exclusive(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.{time.time_ns()}.tmp")
    with temporary.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
    temporary.replace(path)


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def validate_authorization(path: Path, output: Path) -> dict:
    value = read_json(path)
    if (
        value.get("schemaVersion") != AUTH_SCHEMA
        or value.get("status") != "owner_authorized_pending_execution"
        or value.get("requestId") != value.get("commandRef")
        or value.get("scope") != SCOPE
        or value.get("contractId") != CONTRACT_ID
        or tuple(value.get("allowedActions", ())) != ALLOWED_ACTIONS
        or not DENIED_ACTIONS.issubset(set(value.get("deniedActions", ())))
        or value.get("oneTimeConsumptionRequired") is not True
        or value.get("automaticRetryAuthorized") is not False
        or value.get("checkpointReadAuthorized") is not True
        or value.get("oldDenoiserCheckpointReadAuthorized") is not False
        or value.get("optimizerCreationAuthorized") is not False
        or value.get("backwardExecutionAuthorized") is not False
        or value.get("modelWeightModificationAuthorized") is not False
        or value.get("gpuAuthorized") is not True
        or value.get("trainingAuthorized") is not False
    ):
        raise ValueError("epoch_complete_gpu_authorization_contract_invalid")
    if resolve_project(Path(value["outputNamespace"])) != output or output.exists():
        raise ValueError("epoch_complete_gpu_output_identity_invalid")
    expected_bindings = {
        "cpuTerminal", "cpuReport", "inactiveConfig", "supportContract",
        "ownerActionRequest", "trainer", "runner", "cpuChecker",
        "datasetManifest", "sourceIndex", "projectAutoencoderCheckpoint",
        "implementationAuthorization", "implementationConsumption",
    }
    if set(value.get("bindings", {})) != expected_bindings:
        raise ValueError("epoch_complete_gpu_binding_set_invalid")
    for name, source in value["bindings"].items():
        source_path = resolve_project(Path(source["path"]))
        if not source_path.is_file() or sha256_file(source_path) != source["sha256"]:
            raise ValueError(f"epoch_complete_gpu_binding_invalid:{name}")
    if resolve_project(Path(value["bindings"]["runner"]["path"])) != RUNNER_PATH:
        raise ValueError("epoch_complete_gpu_runner_identity_invalid")
    if value["bindings"]["projectAutoencoderCheckpoint"]["sha256"] != AUTOENCODER_SHA256:
        raise ValueError("epoch_complete_gpu_autoencoder_identity_invalid")
    terminal = read_json(resolve_project(Path(value["bindings"]["cpuTerminal"]["path"])))
    cpu = read_json(resolve_project(Path(value["bindings"]["cpuReport"]["path"])))
    support = read_json(resolve_project(Path(value["bindings"]["supportContract"]["path"])))
    owner = read_json(resolve_project(Path(value["bindings"]["ownerActionRequest"]["path"])))
    if (
        terminal.get("status")
        != "stage4_epoch_complete_per_class_worst_luminance_cpu_succeeded_closed"
        or cpu.get("status")
        != "passed_stage4_epoch_complete_per_class_worst_luminance_cpu_contract"
        or support.get("status") != "cpu_support_verified_inactive"
        or owner.get("status")
        != "owner_readonly_gpu_qualification_authorization_required_not_authorized"
    ):
        raise ValueError("epoch_complete_gpu_cpu_lineage_invalid")
    expected_identity = {
        "contractId": CONTRACT_ID,
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "rolloutSteps": 50,
        "gradientTailSteps": 5,
        "topology": "west",
        "trainPopulation": "all_48_train_records_in_source_index_order",
        "validationPopulation": "all_8_validation_records_all_existing_rollout_seeds",
        "requiredClasses": list(CLASS_IDENTITIES),
    }
    if value.get("taskIdentity") != expected_identity:
        raise ValueError("epoch_complete_gpu_task_identity_invalid")
    if value.get("consumptionState") != {"consumed": False, "consumptionPath": None}:
        raise ValueError("epoch_complete_gpu_authorization_already_consumed")
    if (
        resolve_project(Path(value.get("preflightReportPath", "")))
        != path.parent / "preflight-report.json"
        or resolve_project(Path(value.get("cpuEntryReportPath", "")))
        != path.parent / "cpu-entry-report.json"
    ):
        raise ValueError("epoch_complete_gpu_preflight_evidence_identity_invalid")
    return value


def preflight(authorization_path: Path, authorization: dict) -> dict:
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("epoch_complete_gpu_cuda_unavailable")
    device = torch.cuda.get_device_properties(0)
    disk_probe = resolve_project(Path(authorization["outputNamespace"])).parent
    while not disk_probe.exists() and disk_probe.parent != disk_probe:
        disk_probe = disk_probe.parent
    disk = shutil.disk_usage(disk_probe)
    if disk.free < 2 * 1024**3:
        raise ValueError("epoch_complete_gpu_disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-gpu-preflight-v1",
        "status": "passed_gpu_not_started_authorization_not_consumed_checkpoint_not_read",
        "requestId": authorization["requestId"],
        "authorization": binding(authorization_path),
        "python": {"executable": sys.executable, "version": sys.version},
        "torch": {"version": torch.__version__, "cudaAvailable": True, "deviceCount": torch.cuda.device_count()},
        "cuda": {"deviceIndex": 0, "name": device.name, "totalMemoryBytes": device.total_memory},
        "disk": {"freeBytes": disk.free},
        "authorizationConsumed": False,
        "checkpointRead": False,
        "gpuWorkloadStarted": False,
        **timestamps(),
    }


def consume_authorization(path: Path, authorization: dict) -> Path:
    consumption_path = path.parent / "gpu-consumption.json"
    if consumption_path.exists():
        raise ValueError("epoch_complete_gpu_authorization_already_consumed")
    write_json_exclusive(consumption_path, {
        "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-gpu-consumption-v1",
        "status": "consumed_once_before_checkpoint_read_and_gpu_workload",
        "requestId": authorization["requestId"],
        "commandRef": authorization["commandRef"],
        "scope": authorization["scope"],
        "authorization": binding(path),
        "oneTimeConsumption": True,
        **timestamps(),
    })
    return consumption_path


def load_datasets(config: dict) -> dict:
    selection = trainer.conditional_dataset_selection_contract(config)
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH, split, list(config["conditionChannelOrder"]),
            IMAGE_SIZE, selection_contract=selection,
        )
        for split in trainer.V7_MVP64_SPLIT_COUNTS
    }
    trainer.validate_loaded_v7_datasets(datasets)
    if len(datasets["train"]) != 48 or len(datasets["validation"]) != 8:
        raise ValueError("epoch_complete_gpu_dataset_split_identity_changed")
    source = read_json(resolve(SOURCE_INDEX_PATH))
    source_train = [
        row["sampleId"] for row in source.get("samples", [])
        if row.get("split") == "train"
        and row.get("v7CapacityContributionRegistered") is True
    ]
    source_validation = [
        row["sampleId"] for row in source.get("samples", [])
        if row.get("split") == "validation"
        and row.get("v7CapacityContributionRegistered") is True
    ]
    if (
        [row["sampleId"] for row in datasets["train"].rows] != source_train
        or [row["sampleId"] for row in datasets["validation"].rows]
        != source_validation
    ):
        raise ValueError("epoch_complete_gpu_source_index_order_changed")
    return datasets


def rollout_rgb(
    model, images, conditions, seeds, diffusion, normalization, config,
    *, gradient_tail_steps: int,
):
    with torch.no_grad():
        latent_shape = model.autoencoder.encode(images[:1]).shape[1:]
    initial = []
    for seed in seeds:
        generator = torch.Generator(device=images.device).manual_seed(int(seed))
        initial.append(torch.randn(latent_shape, device=images.device, generator=generator))
    latent = torch.stack(initial)
    steps = trainer.inference_timesteps(
        int(config["diffusionSteps"]), int(config["inferenceSteps"]), images.device,
    )
    no_gradient_steps = len(steps) - int(gradient_tail_steps)
    for step_index, timestep in enumerate(steps):
        value = int(timestep.item())
        previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
        timestep_batch = torch.full(
            (latent.shape[0],), value, device=images.device, dtype=torch.long,
        )
        if step_index < no_gradient_steps:
            with torch.no_grad():
                velocity = model.predict_velocity(latent, timestep_batch, conditions)
                latent = trainer.deterministic_velocity_step(
                    latent, velocity, value, previous, diffusion["alphasCumulative"],
                )
            latent = latent.detach()
        else:
            velocity = model.predict_velocity(latent, timestep_batch, conditions)
            latent = trainer.deterministic_velocity_step(
                latent, velocity, value, previous, diffusion["alphasCumulative"],
            )
    return model.autoencoder.decode(
        trainer.denormalize_latent(latent, normalization)
    ).clamp(0.0, 1.0)


def run_gpu(authorization_path: Path, authorization: dict, output: Path, preflight_path: Path) -> int:
    started = time.perf_counter()
    state = {
        "autoencoderCheckpointRead": False, "oldDenoiserCheckpointRead": False,
        "gpuUsed": False, "optimizerCreated": False, "backwardExecuted": False,
        "modelWeightsModified": False, "checkpointWritten": False,
        "trainingStarted": False,
    }
    progress_path = output / "progress.json"
    consumption_path = None

    def progress(phase: str, completed: int, total: int, detail=None):
        write_json_atomic(progress_path, {
            "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-gpu-progress-v1",
            "status": "running", "phase": phase, "completed": completed,
            "total": total, "percent": round(completed / total * 100.0, 3) if total else 0.0,
            "detail": detail or {}, **state, **timestamps(),
        })

    try:
        preflight_record = read_json(preflight_path)
        if (
            preflight_record.get("status")
            != "passed_gpu_not_started_authorization_not_consumed_checkpoint_not_read"
            or preflight_record.get("requestId") != authorization["requestId"]
            or preflight_record.get("authorization", {}).get("sha256")
            != sha256_file(authorization_path)
        ):
            raise ValueError("epoch_complete_gpu_preflight_identity_invalid")
        consumption_path = consume_authorization(authorization_path, authorization)
        output.mkdir(parents=True, exist_ok=False)
        progress("initializing", 0, 68, {"consumption": binding(consumption_path)})
        os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
        torch.use_deterministic_algorithms(True)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        torch.cuda.init()
        torch.cuda.set_device(0)
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        device = torch.device("cuda:0")

        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        contract = trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(config)
        if contract is None or contract.get("status") != "cpu_support_verified_inactive":
            raise ValueError("epoch_complete_gpu_inactive_contract_invalid")
        datasets = load_datasets(config)
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
        normalization = trainer.compute_latent_normalization(
            model, datasets["train"], device,
        )
        diffusion = trainer.build_diffusion_schedule(config, device)
        train_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
            config, "train", 48,
        )

        chunk_size = 4
        for start in range(0, 48, chunk_size):
            records = [datasets["train"][index] for index in range(start, min(start + chunk_size, 48))]
            images = torch.stack([row["image"] for row in records]).to(device)
            conditions = torch.stack([row["conditions"] for row in records]).to(device)
            sample_ids = [row["sampleId"] for row in records]
            with torch.no_grad():
                predicted = rollout_rgb(
                    model, images, conditions,
                    [SEED + index for index in range(start, start + len(records))],
                    diffusion, normalization, config, gradient_tail_steps=0,
                )
                losses = trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
                    predicted, images, conditions, config,
                )
            trainer.stage4_collect_epoch_complete_per_class_selection_scores(
                train_ledger, losses["weightedPerSampleClassTensors"],
                sample_ids, config,
            )
            progress("train_score_collection", start + len(records), 68, {
                "trainRecordsCompleted": start + len(records), "trainRecordsTotal": 48,
            })
            del predicted, losses, images, conditions
        train_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
            train_ledger, config,
        )

        train_index = {
            row["sampleId"]: index for index, row in enumerate(datasets["train"].rows)
        }
        parameters = tuple(model.denoiser.parameters())
        order = list(config["conditionChannelOrder"])
        gradient_evidence = {}
        for class_offset, selection in enumerate(train_result["perClassSelections"]):
            identity = selection["classIdentity"]
            sample_index = train_index[selection["sampleId"]]
            chunk_start = (sample_index // chunk_size) * chunk_size
            records = [
                datasets["train"][index]
                for index in range(chunk_start, min(chunk_start + chunk_size, 48))
            ]
            local_index = sample_index - chunk_start
            images = torch.stack([row["image"] for row in records]).to(device)
            conditions = torch.stack([row["conditions"] for row in records]).to(device)
            predicted = rollout_rgb(
                model, images, conditions,
                [SEED + index for index in range(chunk_start, chunk_start + len(records))],
                diffusion,
                normalization, config, gradient_tail_steps=5,
            )
            losses = trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
                predicted, images, conditions, config,
            )
            selected_loss = trainer.stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(
                losses["weightedPerSampleClassTensors"][local_index:local_index + 1],
                identity, config,
            )
            gradients = torch.autograd.grad(
                selected_loss, (predicted, *parameters), retain_graph=False,
                create_graph=False, allow_unused=True,
            )
            rgb_gradient = gradients[0]
            channel = f"object_{identity}"
            mask = conditions[:, order.index(channel):order.index(channel) + 1]
            selected_sample_mask = torch.zeros_like(mask)
            selected_sample_mask[local_index:local_index + 1] = mask[
                local_index:local_index + 1
            ]
            mask_rgb = selected_sample_mask.expand_as(rgb_gradient)
            inside = float((rgb_gradient.detach().abs() * mask_rgb).sum().cpu())
            outside = float((rgb_gradient.detach().abs() * (1.0 - mask_rgb)).sum().cpu())
            parameter_gradients = gradients[1:]
            parameter_abs_sum = sum(
                0.0 if gradient is None else float(gradient.detach().abs().sum().cpu())
                for gradient in parameter_gradients
            )
            finite = bool(torch.isfinite(rgb_gradient).all()) and all(
                gradient is None or bool(torch.isfinite(gradient).all())
                for gradient in parameter_gradients
            )
            rerun_weighted_score = float(
                losses["weightedPerSampleClassTensors"][
                    local_index, CLASS_IDENTITIES.index(identity)
                ].detach().cpu()
            )
            evidence = {
                **selection,
                "sourceIndex": sample_index,
                "sourceChunkStart": chunk_start,
                "sourceChunkSize": len(records),
                "sourceChunkLocalIndex": local_index,
                "rerunWeightedScore": rerun_weighted_score,
                "selectionScoreExactlyReproduced": rerun_weighted_score == selection["weightedScore"],
                "decodedRgbGradientFinite": finite,
                "insideMaskGradientAbsSum": inside,
                "outsideMaskGradientAbsSum": outside,
                "denoiserGradientAbsSum": parameter_abs_sum,
                "sourceReference": "original_owner_approved_reference_rgb",
                "sourceConditionChannel": channel,
            }
            if not (
                evidence["selectionScoreExactlyReproduced"] and finite
                and inside > 0.0 and outside == 0.0 and parameter_abs_sum > 0.0
            ):
                raise ValueError(f"epoch_complete_gpu_selected_gradient_failed:{identity}:{evidence}")
            gradient_evidence[identity] = evidence
            progress("selected_class_gradient_recomputation", 49 + class_offset, 68, {
                "classIdentity": identity, "sampleId": selection["sampleId"],
            })

        seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
        validation_total = 8 * seed_count
        validation_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
            config, "validation", validation_total,
        )
        validation_entries = [
            (sample_index, seed_index)
            for sample_index in range(8)
            for seed_index in range(seed_count)
        ]
        for start in range(0, validation_total, chunk_size):
            entries = validation_entries[start:start + chunk_size]
            records = [datasets["validation"][sample_index] for sample_index, _ in entries]
            images = torch.stack([row["image"] for row in records]).to(device)
            conditions = torch.stack([row["conditions"] for row in records]).to(device)
            sample_ids = [row["sampleId"] for row in records]
            seed_indices = [seed_index for _, seed_index in entries]
            seeds = [
                SEED + 3000 + sample_index * seed_count + seed_index
                for sample_index, seed_index in entries
            ]
            with torch.no_grad():
                predicted = rollout_rgb(
                    model, images, conditions, seeds, diffusion, normalization,
                    config, gradient_tail_steps=0,
                )
                losses = trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
                    predicted, images, conditions, config,
                )
            trainer.stage4_collect_epoch_complete_per_class_selection_scores(
                validation_ledger, losses["weightedPerSampleClassTensors"],
                sample_ids, config, seed_indices=seed_indices,
            )
            progress("validation_checkpoint_identity", 52 + start + len(entries), 68, {
                "validationTrajectoriesCompleted": start + len(entries),
                "validationTrajectoriesTotal": validation_total,
            })
            del predicted, losses, images, conditions
        validation_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
            validation_ledger, config,
        )
        expected_score = (
            sum(row["weightedScore"] for row in validation_result["perClassSelections"])
            * float(contract["sourceContracts"]["rolloutWeight"])
        )
        if validation_result["checkpointQualificationScore"] != expected_score:
            raise ValueError("epoch_complete_gpu_validation_checkpoint_score_mismatch")
        required_fields = {"classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore"}
        if any(set(row) != required_fields for row in validation_result["perClassSelections"]):
            raise ValueError("epoch_complete_gpu_validation_identity_fields_changed")

        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("epoch_complete_gpu_parameter_grad_fields_populated")
        torch.cuda.synchronize(0)
        cuda = {
            "deviceIndex": 0, "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        model.to("cpu")
        denoiser_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
            raise ValueError("epoch_complete_gpu_model_state_changed")
        progress("completed", 68, 68)
        report = {
            "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-report-v1",
            "status": "passed_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification",
            "durationSeconds": round(time.perf_counter() - started, 3),
            "taskIdentity": authorization["taskIdentity"],
            "trainSelection": train_result,
            "selectedGradientEvidence": gradient_evidence,
            "validationCheckpointIdentity": validation_result,
            "validationCheckpointSelectionScore": expected_score,
            "stateHashes": {
                "denoiserBefore": denoiser_before, "denoiserAfter": denoiser_after,
                "autoencoderBefore": autoencoder_before, "autoencoderAfter": autoencoder_after,
            },
            "cuda": cuda, "safety": state, **timestamps(),
        }
        write_json_exclusive(output / "gpu-qualification-report.json", report)
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-cuda-telemetry-v1", **cuda, **timestamps(),
        })
        terminal = {
            "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-terminal-v1",
            "status": "stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification_succeeded_closed",
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "nextLegalAction": "compile_and_execute_one_new_30_epoch_model_smoke_under_separate_authorization",
            "evidence": {
                "report": binding(output / "gpu-qualification-report.json"),
                "cudaTelemetry": binding(output / "cuda-telemetry.json"),
                "preflight": binding(preflight_path),
                "consumption": binding(consumption_path),
            },
            "automaticRetryStarted": False, "laterExecutionStarted": False,
            **timestamps(),
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not output.exists():
            output.mkdir(parents=True, exist_ok=False)
        failure = {
            "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-terminal-v1",
            "status": "stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification_failed_closed",
            "errorType": type(error).__name__, "error": str(error),
            "traceback": traceback.format_exc(), "safety": state,
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "automaticRetryStarted": False, "laterExecutionStarted": False,
            **timestamps(),
        }
        write_json_exclusive(output / "phase-terminal.json", failure)
        print(json.dumps({**failure, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 1


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--preflight-report", type=Path)
    args = parser.parse_args()
    authorization_path = resolve(args.authorization)
    output = resolve(args.output_dir)
    authorization = validate_authorization(authorization_path, output)
    if args.preflight_only:
        print(json.dumps(preflight(authorization_path, authorization), ensure_ascii=False, indent=2))
        return 0
    if args.preflight_report is None:
        raise ValueError("epoch_complete_gpu_preflight_report_required")
    return run_gpu(
        authorization_path, authorization, output, resolve(args.preflight_report),
    )


if __name__ == "__main__":
    raise SystemExit(main())

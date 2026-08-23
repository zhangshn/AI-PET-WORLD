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
import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification as base


ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = Path(__file__).resolve()
CONTRACT_ID = trainer.STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID
AUTH_SCHEMA = "ai-painter-stage4-reference-feature-shared-replay-readonly-gpu-authorization-v1"
SCOPE = "one_stage4_reference_feature_shared_replay_readonly_gpu_qualification_only"
SEED = 20263722
CLASS_IDENTITIES = ("footprints", "tree", "rock", "vegetation")
ALLOWED_ACTIONS = (
    "read_bound_cpu_qualification_evidence", "inspect_python_cuda_and_disk_resources",
    "read_project_autoencoder_checkpoint", "initialize_fixed_random_denoiser",
    "read_all_48_train_and_8_validation_records", "execute_cuda_50_step_readonly_rollouts",
    "execute_torch_autograd_grad_for_four_selected_sample_classes",
    "verify_shared_two_replay_schedule", "write_readonly_gpu_qualification_evidence_and_local_records",
)
DENIED_ACTIONS = {
    "read_old_denoiser_checkpoint", "read_failed_checkpoint", "create_optimizer",
    "execute_backward", "modify_model_weights", "write_checkpoint", "start_smoke",
    "start_stage0", "start_stage1", "start_stage2", "start_training",
    "checkpoint_promotion", "formal_inference", "runtime_frame", "world_entry",
}


def resolve_project(path: Path) -> Path:
    if path.is_absolute():
        raise ValueError("reference_feature_gpu_absolute_path_rejected")
    logical = Path(os.path.abspath(str(ROOT / path)))
    logical_root = Path(os.path.abspath(str(ROOT)))
    if logical != logical_root and logical_root not in logical.parents:
        raise ValueError("reference_feature_gpu_path_escape_rejected")
    resolved = logical.resolve()
    if resolved != logical_root and logical_root not in resolved.parents:
        logical_runtime = Path(os.path.abspath(str(ROOT / ".runtime")))
        physical_runtime = logical_runtime.resolve()
        logical_is_registered_runtime = (
            logical == logical_runtime or logical_runtime in logical.parents
        )
        physical_is_registered_runtime = (
            resolved == physical_runtime or physical_runtime in resolved.parents
        )
        if not (
            logical_is_registered_runtime and physical_is_registered_runtime
        ):
            raise ValueError("reference_feature_gpu_unregistered_physical_path_rejected")
    return resolved


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


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def timestamps() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
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
        os.fsync(handle.fileno())
    temporary.replace(path)


def state_dict_sha256(state_dict) -> str:
    return base.state_dict_sha256(state_dict)


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
        or value.get("checkpointReadAuthorized") is not True
        or value.get("oldDenoiserCheckpointReadAuthorized") is not False
        or value.get("optimizerCreationAuthorized") is not False
        or value.get("backwardExecutionAuthorized") is not False
        or value.get("modelWeightModificationAuthorized") is not False
        or value.get("gpuAuthorized") is not True
        or value.get("trainingAuthorized") is not False
        or value.get("oneTimeConsumptionRequired") is not True
        or value.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("reference_feature_gpu_authorization_invalid")
    if resolve_project(Path(value["outputNamespace"])) != output or output.exists():
        raise ValueError("reference_feature_gpu_output_identity_invalid")
    expected = {
        "cpuTerminal", "cpuReport", "configurationAudit", "inactiveConfig",
        "supportContract", "ownerActionRequest", "implementationAuthorization",
        "implementationConsumption", "trainer", "runner", "cpuChecker",
        "datasetManifest", "sourceIndex", "projectAutoencoderCheckpoint",
    }
    if set(value.get("bindings", {})) != expected:
        raise ValueError("reference_feature_gpu_binding_set_invalid")
    for name, source in value["bindings"].items():
        source_path = resolve_project(Path(source["path"]))
        if not source_path.is_file() or sha256_file(source_path) != source["sha256"]:
            raise ValueError(f"reference_feature_gpu_binding_invalid:{name}")
    if resolve_project(Path(value["bindings"]["runner"]["path"])) != RUNNER_PATH:
        raise ValueError("reference_feature_gpu_runner_identity_invalid")
    if value["bindings"]["projectAutoencoderCheckpoint"]["sha256"] != base.AUTOENCODER_SHA256:
        raise ValueError("reference_feature_gpu_autoencoder_identity_invalid")
    terminal = read_json(resolve_project(Path(value["bindings"]["cpuTerminal"]["path"])))
    cpu = read_json(resolve_project(Path(value["bindings"]["cpuReport"]["path"])))
    support = read_json(resolve_project(Path(value["bindings"]["supportContract"]["path"])))
    if (
        terminal.get("status") != "stage4_reference_feature_shared_replay_cpu_succeeded_closed"
        or cpu.get("status") != "passed_stage4_reference_feature_shared_replay_cpu_contract"
        or support.get("status") != "cpu_support_verified_inactive"
        or terminal.get("contractId") != CONTRACT_ID
    ):
        raise ValueError("reference_feature_gpu_cpu_lineage_invalid")
    expected_identity = {
        "contractId": CONTRACT_ID, "seed": SEED,
        "imageSize": {"width": 256, "height": 192}, "rolloutSteps": 50,
        "gradientTailSteps": 5, "topology": "west",
        "trainPopulation": "all_48_train_records_in_source_index_order",
        "validationPopulation": "all_8_validation_records_all_existing_rollout_seeds",
        "requiredClasses": list(CLASS_IDENTITIES),
        "objectiveOrder": ["luminance", "reference_feature_structure"],
        "existingReplayPasses": 2,
    }
    if value.get("taskIdentity") != expected_identity:
        raise ValueError("reference_feature_gpu_task_identity_invalid")
    if value.get("consumptionState") != {"consumed": False, "consumptionPath": None}:
        raise ValueError("reference_feature_gpu_authorization_already_consumed")
    return value


def preflight(authorization_path: Path, authorization: dict) -> dict:
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("reference_feature_gpu_cuda_unavailable")
    device = torch.cuda.get_device_properties(0)
    probe = resolve_project(Path(authorization["outputNamespace"])).parent
    while not probe.exists() and probe.parent != probe:
        probe = probe.parent
    disk = shutil.disk_usage(probe)
    if disk.free < 2 * 1024**3:
        raise ValueError("reference_feature_gpu_disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-reference-feature-shared-replay-gpu-preflight-v1",
        "status": "passed_gpu_not_started_authorization_not_consumed_checkpoint_not_read",
        "requestId": authorization["requestId"], "authorization": binding(authorization_path),
        "python": {"executable": sys.executable, "version": sys.version},
        "torch": {"version": torch.__version__, "cudaAvailable": True, "deviceCount": torch.cuda.device_count()},
        "cuda": {"deviceIndex": 0, "name": device.name, "totalMemoryBytes": device.total_memory},
        "disk": {"freeBytes": disk.free}, "authorizationConsumed": False,
        "checkpointRead": False, "gpuWorkloadStarted": False, **timestamps(),
    }


def weighted_reference_tensor(autoencoder, predicted, target, conditions, config):
    losses = trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
        autoencoder, predicted, target, conditions, config,
    )
    weights = trainer.validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(config)["sourceContracts"]["derivedClassWeights"]
    weight_tensor = losses["perSampleClassTensors"].new_tensor([weights[name] for name in CLASS_IDENTITIES])
    return losses, losses["perSampleClassTensors"] * weight_tensor.unsqueeze(0)


def reference_feature_score_identity_evidence(
    selection: dict,
    class_identity: str,
    sample_id: str,
    rerun_score: float,
    dtype: torch.dtype,
    rollout_steps: int,
) -> dict:
    """Validate identity exactly and score equivalence with a fully derived bound."""
    if (
        selection.get("classIdentity") != class_identity
        or selection.get("sampleId") != sample_id
    ):
        raise ValueError("reference_feature_gpu_selected_identity_changed")
    if rollout_steps != 50 or not isinstance(dtype, torch.dtype):
        raise ValueError("reference_feature_gpu_numeric_contract_changed")
    try:
        epsilon = float(torch.finfo(dtype).eps)
    except TypeError as error:
        raise ValueError("reference_feature_gpu_dtype_not_floating") from error
    scan_score = float(selection.get("weightedScore"))
    rerun_score = float(rerun_score)
    if not (math.isfinite(scan_score) and math.isfinite(rerun_score)):
        raise ValueError("reference_feature_gpu_score_not_finite")
    scale = max(1.0, abs(scan_score), abs(rerun_score))
    absolute_difference = abs(scan_score - rerun_score)
    relative_difference = absolute_difference / max(
        abs(scan_score), abs(rerun_score), epsilon
    )
    derived_tolerance = epsilon * int(rollout_steps) * scale
    equivalent = absolute_difference <= derived_tolerance
    evidence = {
        "scanWeightedScore": scan_score,
        "rerunWeightedScore": rerun_score,
        "absoluteDifference": absolute_difference,
        "relativeDifference": relative_difference,
        "derivedTolerance": derived_tolerance,
        "dtype": str(dtype),
        "dtypeEpsilon": epsilon,
        "rolloutSteps": int(rollout_steps),
        "numericallyEquivalent": equivalent,
    }
    if not equivalent:
        raise ValueError(
            f"reference_feature_gpu_score_not_equivalent:{evidence}"
        )
    return evidence


def run_gpu(authorization_path: Path, authorization: dict, output: Path, preflight_path: Path) -> int:
    started = time.perf_counter()
    state = {"autoencoderCheckpointRead": False, "oldDenoiserCheckpointRead": False, "gpuUsed": False, "optimizerCreated": False, "backwardExecuted": False, "modelWeightsModified": False, "checkpointWritten": False, "trainingStarted": False}
    progress_path = output / "progress.json"
    consumption_path = authorization_path.parent / "gpu-consumption.json"
    try:
        preflight_record = read_json(preflight_path)
        if preflight_record.get("status") != "passed_gpu_not_started_authorization_not_consumed_checkpoint_not_read" or preflight_record.get("authorization", {}).get("sha256") != sha256_file(authorization_path):
            raise ValueError("reference_feature_gpu_preflight_identity_invalid")
        write_json_exclusive(consumption_path, {
            "schemaVersion": "stage4-reference-feature-shared-replay-gpu-consumption-v1",
            "status": "consumed_once_before_checkpoint_read_and_gpu_workload",
            "requestId": authorization["requestId"], "commandRef": authorization["commandRef"],
            "scope": authorization["scope"], "authorization": binding(authorization_path),
            "oneTimeConsumption": True, **timestamps(),
        })
        output.mkdir(parents=True, exist_ok=False)
        def progress(phase, completed, total, detail=None):
            write_json_atomic(progress_path, {"schemaVersion": "stage4-reference-feature-shared-replay-gpu-progress-v1", "status": "running", "phase": phase, "completed": completed, "total": total, "percent": round(completed / total * 100, 3), "detail": detail or {}, **state, **timestamps()})
        progress("initializing", 0, 68)
        os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
        torch.use_deterministic_algorithms(True)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        torch.cuda.init(); torch.cuda.set_device(0); torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        device = torch.device("cuda:0")
        config = read_json(resolve_project(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        contract = trainer.validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(config)
        datasets = base.load_datasets(config)
        torch.manual_seed(SEED); torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        denoiser_before = state_dict_sha256(model.denoiser.state_dict())
        checkpoint = trainer.load_autoencoder_checkpoint(base.AUTOENCODER_PATH, config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters(): parameter.requires_grad_(False)
        autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
        model.to(device).eval()
        normalization = trainer.compute_latent_normalization(model, datasets["train"], device)
        diffusion = trainer.build_diffusion_schedule(config, device)
        ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(config, "train", 48, "reference_feature_structure")
        # Scan and differentiable rerun must share one execution identity.
        # Each score is formed with the same batch=1, 45 no-grad + 5 autograd
        # rollout used by the selected-sample gradient recomputation.  The score
        # is detached immediately so the scan does not retain CUDA graphs.
        chunk_size = 1
        for start in range(0, 48, chunk_size):
            records = [datasets["train"][index] for index in range(start, min(start + chunk_size, 48))]
            images = torch.stack([row["image"] for row in records]).to(device)
            conditions = torch.stack([row["conditions"] for row in records]).to(device)
            predicted = base.rollout_rgb(model, images, conditions, [SEED + index for index in range(start, start + len(records))], diffusion, normalization, config, gradient_tail_steps=5)
            scan_losses, weighted = weighted_reference_tensor(model.autoencoder, predicted, images, conditions, config)
            detached_weighted = weighted.detach()
            trainer.stage4_collect_epoch_complete_per_class_selection_scores(ledger, detached_weighted, [row["sampleId"] for row in records], config, objective_identity="reference_feature_structure")
            progress("train_score_collection", start + len(records), 68, {"trainRecordsCompleted": start + len(records), "trainRecordsTotal": 48})
            del scan_losses, predicted, weighted, detached_weighted, images, conditions
        train_result = trainer.stage4_finalize_epoch_complete_per_class_selection(ledger, config, "reference_feature_structure")
        luma_result = {**train_result, "objectiveIdentity": "luminance"}
        schedule = [trainer.stage4_epoch_complete_shared_replay_selection(luma_result, train_result, batch, replay, config) for batch in range(4) for replay in range(2)]
        if [(row["classIdentity"], row["objectiveIdentity"]) for row in schedule] != [(identity, objective) for identity in CLASS_IDENTITIES for objective in ("luminance", "reference_feature_structure")]:
            raise ValueError("reference_feature_gpu_shared_schedule_changed")
        train_index = {row["sampleId"]: index for index, row in enumerate(datasets["train"].rows)}
        parameters = tuple(model.denoiser.parameters())
        order = list(config["conditionChannelOrder"])
        gradient_evidence = {}
        for offset, selection in enumerate(train_result["perClassSelections"]):
            identity = selection["classIdentity"]
            index = train_index[selection["sampleId"]]
            record = datasets["train"][index]
            image = record["image"].unsqueeze(0).to(device)
            conditions = record["conditions"].unsqueeze(0).to(device)
            predicted = base.rollout_rgb(model, image, conditions, [SEED + index], diffusion, normalization, config, gradient_tail_steps=5)
            losses, weighted = weighted_reference_tensor(model.autoencoder, predicted, image, conditions, config)
            selected_loss = trainer.stage4_epoch_complete_selected_reference_feature_replay_loss_from_tensor(losses["perSampleClassTensors"], identity, config)
            gradients = torch.autograd.grad(selected_loss, (predicted, *parameters), allow_unused=True)
            rgb_gradient = gradients[0]
            mask = conditions[:, order.index(f"object_{identity}"):order.index(f"object_{identity}") + 1].expand_as(rgb_gradient)
            inside = float((rgb_gradient.abs() * mask).sum().detach().cpu())
            outside = float((rgb_gradient.abs() * (1.0 - mask)).sum().detach().cpu())
            parameter_sum = sum(0.0 if value is None else float(value.detach().abs().sum().cpu()) for value in gradients[1:])
            weighted_score = float(weighted[0, CLASS_IDENTITIES.index(identity)].detach().cpu())
            score_identity = reference_feature_score_identity_evidence(
                selection, identity, record["sampleId"], weighted_score,
                weighted.dtype, int(config["inferenceSteps"]),
            )
            evidence = {**selection, **score_identity, "gradientFinite": bool(torch.isfinite(rgb_gradient).all()) and all(value is None or bool(torch.isfinite(value).all()) for value in gradients[1:]), "insideMaskGradientAbsSum": inside, "outsideMaskGradientAbsSum": outside, "denoiserGradientAbsSum": parameter_sum}
            if not (evidence["numericallyEquivalent"] and evidence["gradientFinite"] and inside > 0 and outside == 0 and parameter_sum > 0):
                raise ValueError(f"reference_feature_gpu_gradient_failed:{identity}:{evidence}")
            gradient_evidence[identity] = evidence
            progress("selected_class_gradient_recomputation", 49 + offset, 68, {"classIdentity": identity, "sampleId": selection["sampleId"]})
        seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
        validation_entries = [(sample, seed) for sample in range(8) for seed in range(seed_count)]
        validation_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(config, "validation", len(validation_entries), "reference_feature_structure")
        for start in range(0, len(validation_entries), chunk_size):
            entries = validation_entries[start:start + chunk_size]
            records = [datasets["validation"][sample] for sample, _ in entries]
            images = torch.stack([row["image"] for row in records]).to(device)
            conditions = torch.stack([row["conditions"] for row in records]).to(device)
            seeds = [SEED + 3000 + sample * seed_count + seed for sample, seed in entries]
            predicted = base.rollout_rgb(model, images, conditions, seeds, diffusion, normalization, config, gradient_tail_steps=5)
            validation_scan_losses, weighted = weighted_reference_tensor(model.autoencoder, predicted, images, conditions, config)
            detached_weighted = weighted.detach()
            trainer.stage4_collect_epoch_complete_per_class_selection_scores(validation_ledger, detached_weighted, [row["sampleId"] for row in records], config, seed_indices=[seed for _, seed in entries], objective_identity="reference_feature_structure")
            progress("validation_checkpoint_identity", 52 + start + len(entries), 68, {"validationTrajectoriesCompleted": start + len(entries), "validationTrajectoriesTotal": len(validation_entries)})
            del validation_scan_losses, predicted, weighted, detached_weighted, images, conditions
        validation_result = trainer.stage4_finalize_epoch_complete_per_class_selection(validation_ledger, config, "reference_feature_structure")
        required = {"classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore"}
        if any(set(row) != required for row in validation_result["perClassSelections"]):
            raise ValueError("reference_feature_gpu_validation_identity_fields_changed")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("reference_feature_gpu_parameter_grad_fields_populated")
        torch.cuda.synchronize(0)
        cuda = {"deviceIndex": 0, "deviceName": torch.cuda.get_device_name(0), "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)), "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0))}
        model.to("cpu")
        denoiser_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
            raise ValueError("reference_feature_gpu_model_state_changed")
        progress("completed", 68, 68)
        report = {"schemaVersion": "stage4-reference-feature-shared-replay-readonly-gpu-report-v1", "status": "passed_stage4_reference_feature_shared_replay_readonly_gpu_qualification", "durationSeconds": round(time.perf_counter() - started, 3), "taskIdentity": authorization["taskIdentity"], "trainSelection": train_result, "sharedReplaySchedule": schedule, "selectedGradientEvidence": gradient_evidence, "validationCheckpointIdentity": validation_result, "validationCheckpointSelectionScore": validation_result["checkpointQualificationScore"], "stateHashes": {"denoiserBefore": denoiser_before, "denoiserAfter": denoiser_after, "autoencoderBefore": autoencoder_before, "autoencoderAfter": autoencoder_after}, "cuda": cuda, "safety": state, **timestamps()}
        write_json_exclusive(output / "gpu-qualification-report.json", report)
        write_json_exclusive(output / "cuda-telemetry.json", {"schemaVersion": "ai-painter-cuda-telemetry-v1", **cuda, **timestamps()})
        terminal = {"schemaVersion": "stage4-reference-feature-shared-replay-readonly-gpu-terminal-v1", "status": "stage4_reference_feature_shared_replay_readonly_gpu_qualification_succeeded_closed", "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60}, "nextLegalAction": "compile_and_execute_one_new_30_epoch_model_smoke_under_separate_authorization", "evidence": {"report": binding(output / "gpu-qualification-report.json"), "cudaTelemetry": binding(output / "cuda-telemetry.json"), "preflight": binding(preflight_path), "consumption": binding(consumption_path)}, "automaticRetryStarted": False, "laterExecutionStarted": False, **timestamps()}
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not output.exists(): output.mkdir(parents=True, exist_ok=False)
        failure = {"schemaVersion": "stage4-reference-feature-shared-replay-readonly-gpu-terminal-v1", "status": "stage4_reference_feature_shared_replay_readonly_gpu_qualification_failed_closed", "errorType": type(error).__name__, "error": str(error), "traceback": traceback.format_exc(), "safety": state, "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60}, "automaticRetryStarted": False, "laterExecutionStarted": False, **timestamps()}
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
    authorization_path = resolve_project(args.authorization)
    output = resolve_project(args.output_dir)
    authorization = validate_authorization(authorization_path, output)
    if args.preflight_only:
        print(json.dumps(preflight(authorization_path, authorization), ensure_ascii=False, indent=2))
        return 0
    if args.preflight_report is None:
        raise ValueError("reference_feature_gpu_preflight_report_required")
    return run_gpu(authorization_path, authorization, output, resolve_project(args.preflight_report))


if __name__ == "__main__":
    raise SystemExit(main())

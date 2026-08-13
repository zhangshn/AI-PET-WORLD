from __future__ import annotations

from argparse import ArgumentParser
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
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SAMPLE_SPLIT = "validation"
IMAGE_SIZE = (256, 192)
SEED = 20263722
EXPECTED_ACTIONS = (
    "read_bound_inactive_config",
    "read_project_autoencoder_checkpoint",
    "initialize_random_denoiser",
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
        preflight = run_preflight(authorization)
        print(json.dumps(preflight, ensure_ascii=False, indent=2))
        return 0
    consumption_path = authorization_path.parent / "gpu-consumption.json"
    consume_authorization(authorization_path, authorization, consumption_path)
    return run_gpu(authorization, output, consumption_path)


def validate_authorization(path: Path, output: Path) -> dict:
    value = read_json(path)
    if value.get("schemaVersion") != "ai-painter-stage4-full-rollout-readonly-gpu-authorization-v1":
        raise ValueError("full_rollout_gpu_authorization_schema_invalid")
    if value.get("status") != "owner_authorized_pending_execution":
        raise ValueError("full_rollout_gpu_authorization_status_invalid")
    if value.get("requestId") != value.get("commandRef"):
        raise ValueError("full_rollout_gpu_authorization_identity_mismatch")
    if tuple(value.get("allowedActions", ())) != EXPECTED_ACTIONS:
        raise ValueError("full_rollout_gpu_authorization_actions_invalid")
    if any(action in set(value.get("deniedActions", ())) for action in EXPECTED_ACTIONS):
        raise ValueError("full_rollout_gpu_authorization_action_conflict")
    if resolve(Path(value["outputNamespace"])) != output:
        raise ValueError("full_rollout_gpu_output_namespace_mismatch")
    if output.exists():
        raise ValueError("full_rollout_gpu_output_namespace_already_exists")
    for name in ("cpuReport", "inactiveConfig", "trainer", "projectAutoencoderCheckpoint"):
        binding = value["bindings"][name]
        bound_path = resolve(Path(binding["path"]))
        if not bound_path.is_file() or sha256_file(bound_path) != binding["sha256"]:
            raise ValueError(f"full_rollout_gpu_binding_invalid:{name}")
    if value.get("taskIdentity") != {
        "contractId": "stage4_full_rollout_final_visible_consistency_v1",
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "topology": "west",
        "rolloutSteps": 50,
        "gradientTailSteps": 5,
    }:
        raise ValueError("full_rollout_gpu_task_identity_invalid")
    if value.get("consumptionState") != {"consumed": False, "consumptionPath": None}:
        raise ValueError("full_rollout_gpu_authorization_already_consumed")
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
        raise ValueError("full_rollout_gpu_cuda_unavailable")
    device = torch.cuda.get_device_properties(0)
    disk_probe = resolve(Path(authorization["outputNamespace"])).parent
    while not disk_probe.exists() and disk_probe.parent != disk_probe:
        disk_probe = disk_probe.parent
    disk = shutil.disk_usage(disk_probe)
    if disk.free < 2 * 1024**3:
        raise ValueError("full_rollout_gpu_disk_budget_insufficient")
    return {
        "schemaVersion": "ai-painter-stage4-full-rollout-gpu-preflight-v1",
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
        raise ValueError("full_rollout_gpu_consumption_already_exists")
    consumption = {
        "schemaVersion": "ai-painter-stage4-full-rollout-readonly-gpu-consumption-v1",
        "status": "consumed_once_before_gpu_execution",
        **timestamps(),
        "requestId": authorization["requestId"],
        "authorizationPath": project_path(path),
        "authorizationSha256": sha256_file(path),
        "outputNamespace": authorization["outputNamespace"],
        "allowedActions": list(EXPECTED_ACTIONS),
    }
    write_json_exclusive(consumption_path, consumption)


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

        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        package = read_json(resolve(DATASET_PATH))
        trainer.validate_training_inputs(config, package)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            SAMPLE_SPLIT,
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("full_rollout_gpu_sample194_not_unique_validation")
        sample = dataset[matches[0]]
        step("sample194_loaded", {"split": SAMPLE_SPLIT})

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
        result = trainer.stage4_full_rollout_final_visible_consistency(
            model,
            conditions,
            image,
            diffusion["alphasCumulative"],
            latent_normalization,
            config,
            0,
        )
        if result is None:
            raise ValueError("full_rollout_gpu_loss_missing")
        loss = result["stage4FullRolloutFinalVisibleConsistencyLossTensor"]
        if not bool(torch.isfinite(loss).all()) or float(loss.detach().cpu()) <= 0.0:
            raise ValueError("full_rollout_gpu_loss_nonfinite_or_zero")
        parameters = tuple(model.denoiser.parameters())
        gradients = torch.autograd.grad(loss, parameters, create_graph=False, allow_unused=True)
        grouped = gradient_groups(model.denoiser.named_parameters(), gradients)
        required_groups = ("baseDenoiser", "route", "footprints", "tree", "rock", "vegetation")
        if any(not math.isfinite(grouped[name]) or grouped[name] <= 0.0 for name in required_groups):
            raise ValueError(f"full_rollout_gpu_required_gradient_route_missing:{grouped}")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("full_rollout_gpu_parameter_grad_fields_populated")
        step("full_50_step_rollout_and_autograd_grad_passed", {"loss": float(loss.detach().cpu()), "gradientGroups": grouped})

        metrics = {
            name: float(value.detach().cpu())
            for name, value in result.items()
            if torch.is_tensor(value) and value.numel() == 1
        }
        if any(not math.isfinite(value) for value in metrics.values()):
            raise ValueError("full_rollout_gpu_metric_nonfinite")
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
            raise ValueError("full_rollout_gpu_model_state_changed")
        step("model_states_unchanged")
        report = {
            "schemaVersion": "ai-painter-stage4-full-rollout-readonly-gpu-qualification-report-v1",
            "status": "passed_readonly_full_50_step_rollout_gradient_qualification",
            **timestamps(),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "taskIdentity": authorization["taskIdentity"],
            "metrics": metrics,
            "gradientGroups": grouped,
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
        write_json_exclusive(output / "cuda-telemetry.json", {"schemaVersion": "ai-painter-cuda-telemetry-v1", **timestamps(), **cuda})
        terminal = {
            "schemaVersion": "ai-painter-stage4-full-rollout-readonly-gpu-terminal-v1",
            "status": "stage4_full_rollout_readonly_gpu_qualification_succeeded_closed",
            **timestamps(),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "nextLegalAction": "compile_and_execute_one_new_30_epoch_model_smoke_with_full_rollout_contract",
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
            "evidence": {
                "report": binding(output / "gpu-qualification-report.json"),
                "cudaTelemetry": binding(output / "cuda-telemetry.json"),
                "consumption": binding(consumption_path),
            },
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        capsule = {
            "schemaVersion": "ai-painter-local-task-capsule-v1",
            "module": "AI Painter R5",
            "fixedTotalProgress": terminal["fixedTotalProgress"],
            "currentStage": "Stage4 full-rollout final visible RGB readonly GPU qualification complete",
            "candidateTerminal": binding(output / "phase-terminal.json"),
            "latestBlocker": None,
            "nextLegalAction": terminal["nextLegalAction"],
            "forbiddenActions": ["historical_failed_run_execution", "review_threshold_training_target", "failed_preview_training_target"],
            "evidence": terminal["evidence"],
            **timestamps(),
        }
        write_json_exclusive(output / "local-task-capsule.json", capsule)
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        failure = {
            "schemaVersion": "ai-painter-stage4-full-rollout-readonly-gpu-terminal-v1",
            "status": "stage4_full_rollout_readonly_gpu_qualification_failed_closed",
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


def gradient_groups(named_parameters, gradients) -> dict[str, float]:
    totals = {"baseDenoiser": 0.0, "route": 0.0, "footprints": 0.0, "tree": 0.0, "rock": 0.0, "vegetation": 0.0}
    for (name, _), gradient in zip(named_parameters, gradients):
        value = 0.0 if gradient is None else float(gradient.detach().abs().sum().cpu())
        matched = False
        for identity in ("route", "footprints", "tree", "rock", "vegetation"):
            if f"semantic_mixture_experts.{identity}." in name or f"semantic_mixture_participation.{identity}." in name:
                totals[identity] += value
                matched = True
                break
        if not matched:
            totals["baseDenoiser"] += value
    return totals


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

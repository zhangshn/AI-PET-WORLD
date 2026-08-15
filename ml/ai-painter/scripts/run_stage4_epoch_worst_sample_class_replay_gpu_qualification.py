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
CONTRACT_ID = "stage4_epoch_global_worst_sample_class_final_visible_replay_v1"
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
        print(json.dumps(run_preflight(authorization), ensure_ascii=False, indent=2))
        return 0
    consumption_path = authorization_path.parent / "gpu-consumption.json"
    consume_authorization(authorization_path, authorization, consumption_path)
    return run_gpu(authorization, output, consumption_path)


def validate_authorization(path: Path, output: Path) -> dict:
    value = read_json(path)
    if value.get("schemaVersion") != "ai-painter-stage4-epoch-worst-readonly-gpu-authorization-v1":
        raise ValueError("epoch_worst_gpu_authorization_schema_invalid")
    if value.get("status") != "owner_authorized_pending_execution":
        raise ValueError("epoch_worst_gpu_authorization_status_invalid")
    if value.get("requestId") != value.get("commandRef"):
        raise ValueError("epoch_worst_gpu_authorization_identity_mismatch")
    if tuple(value.get("allowedActions", ())) != EXPECTED_ACTIONS:
        raise ValueError("epoch_worst_gpu_authorization_actions_invalid")
    if any(action in set(value.get("deniedActions", ())) for action in EXPECTED_ACTIONS):
        raise ValueError("epoch_worst_gpu_authorization_action_conflict")
    if resolve(Path(value["outputNamespace"])) != output or output.exists():
        raise ValueError("epoch_worst_gpu_output_namespace_invalid")
    for name in (
        "implementationAuthorization", "implementationConsumption", "cpuReport",
        "formalModesCpuReport", "inactiveConfig", "trainer",
        "projectAutoencoderCheckpoint", "gpuRunner",
    ):
        binding = value["bindings"][name]
        bound_path = resolve(Path(binding["path"]))
        if not bound_path.is_file() or sha256_file(bound_path) != binding["sha256"]:
            raise ValueError(f"epoch_worst_gpu_binding_invalid:{name}")
    if value.get("taskIdentity") != {
        "contractId": CONTRACT_ID,
        "sampleSplit": "train",
        "sampleCount": 48,
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "batchSize": 1,
        "classIdentities": list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES),
    }:
        raise ValueError("epoch_worst_gpu_task_identity_invalid")
    if value.get("consumptionState") != {"consumed": False, "consumptionPath": None}:
        raise ValueError("epoch_worst_gpu_authorization_already_consumed")
    return value


def run_preflight(authorization: dict) -> dict:
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("epoch_worst_gpu_cuda_unavailable")
    disk_probe = resolve(Path(authorization["outputNamespace"])).parent
    while not disk_probe.exists() and disk_probe.parent != disk_probe:
        disk_probe = disk_probe.parent
    disk = shutil.disk_usage(disk_probe)
    if disk.free < 2 * 1024**3:
        raise ValueError("epoch_worst_gpu_disk_budget_insufficient")
    properties = torch.cuda.get_device_properties(0)
    return {
        "schemaVersion": "ai-painter-stage4-epoch-worst-gpu-preflight-v1",
        "status": "passed_without_authorization_consumption_or_checkpoint_read",
        **timestamps(),
        "python": {"executable": sys.executable, "version": sys.version,
                   "torchVersion": torch.__version__, "cudaAvailable": True},
        "cuda": {"deviceIndex": 0, "name": properties.name,
                 "totalMemoryBytes": properties.total_memory},
        "disk": {"freeBytes": disk.free},
        "authorizationConsumed": False,
        "checkpointRead": False,
        "gpuInitializedByWorkload": False,
    }


def consume_authorization(path: Path, authorization: dict, consumption_path: Path) -> None:
    if consumption_path.exists():
        raise ValueError("epoch_worst_gpu_consumption_already_exists")
    write_json_exclusive(consumption_path, {
        "schemaVersion": "ai-painter-stage4-epoch-worst-readonly-gpu-consumption-v1",
        "status": "consumed_once_before_gpu_execution", **timestamps(),
        "requestId": authorization["requestId"],
        "authorizationPath": project_path(path),
        "authorizationSha256": sha256_file(path),
        "outputNamespace": authorization["outputNamespace"],
        "allowedActions": list(EXPECTED_ACTIONS),
    })


def run_gpu(authorization: dict, output: Path, consumption_path: Path) -> int:
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    state = {
        "autoencoderCheckpointRead": False, "oldDenoiserCheckpointRead": False,
        "gpuUsed": False, "optimizerCreated": False, "backwardExecuted": False,
        "modelWeightsModified": False, "checkpointWritten": False,
        "trainingStarted": False,
    }
    steps = []

    def step(code: str, details=None):
        steps.append({"index": len(steps) + 1, "code": code,
                      "details": details or {}, **timestamps()})
        write_json_atomic(output / "step-telemetry.json", {
            "completedSteps": steps, **state,
        })

    try:
        step("authorization_consumed", {"consumptionSha256": sha256_file(consumption_path)})
        torch.cuda.init()
        torch.cuda.set_device(0)
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        device = torch.device("cuda:0")
        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        trainer.validate_stage4_epoch_worst_sample_class_replay(config)
        package = read_json(resolve(DATASET_PATH))
        trainer.validate_training_inputs(config, package)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH, "train", list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        if len(dataset) != 48 or len({row["sampleId"] for row in dataset.rows}) != 48:
            raise ValueError("epoch_worst_gpu_train_population_not_exact_48")
        step("train_population_loaded", {"sampleCount": len(dataset)})

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
        latent_normalization = trainer.compute_latent_normalization(model, dataset, device)
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([999], device=device, dtype=torch.long)
        ledger = []
        selected = None
        with torch.no_grad():
            for index in range(len(dataset)):
                sample = dataset[index]
                image = sample["image"].unsqueeze(0).to(device)
                conditions = sample["conditions"].unsqueeze(0).to(device)
                latent = trainer.normalize_latent(
                    model.autoencoder.encode(image), latent_normalization,
                )
                generator = torch.Generator(device=device).manual_seed(SEED + index)
                noise = torch.randn(latent.shape, generator=generator, device=device,
                                    dtype=latent.dtype)
                noisy = trainer.add_noise(
                    latent, noise, timestep, diffusion["alphasCumulative"],
                )
                target_velocity = trainer.velocity_target(
                    latent, noise, timestep, diffusion["alphasCumulative"],
                )
                measured = trainer.predict_and_measure(
                    model, noisy, target_velocity, latent, timestep,
                    diffusion["alphasCumulative"], conditions, config, image,
                    latent_normalization,
                )
                weighted = measured[
                    "stage4DistributionAwareWeightedPerSampleClassTensor"
                ][0]
                class_index = int(weighted.argmax())
                score = float(weighted[class_index].cpu())
                sample_id = str(sample["sampleId"])
                row = {
                    "sampleId": sample_id,
                    "classIdentity": trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[class_index],
                    "classIndex": class_index, "score": score,
                    "selectionKey": [-score, sample_id,
                                     trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[class_index]],
                }
                ledger.append(row)
                if selected is None or tuple(row["selectionKey"]) < tuple(selected["selectionKey"]):
                    selected = {**row, "datasetIndex": index}
        if selected is None or len(ledger) != 48:
            raise ValueError("epoch_worst_gpu_ledger_incomplete")
        step("complete_train_ledger_selected", {
            "selectedSampleId": selected["sampleId"],
            "selectedClassIdentity": selected["classIdentity"],
        })

        selected_sample = dataset[selected["datasetIndex"]]
        image = selected_sample["image"].unsqueeze(0).to(device)
        conditions = selected_sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            latent = trainer.normalize_latent(
                model.autoencoder.encode(image), latent_normalization,
            )
        generator = torch.Generator(device=device).manual_seed(SEED + selected["datasetIndex"])
        noise = torch.randn(latent.shape, generator=generator, device=device,
                            dtype=latent.dtype)
        noisy = trainer.add_noise(latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = trainer.velocity_target(
            latent, noise, timestep, diffusion["alphasCumulative"],
        )
        replay = trainer.stage4_epoch_worst_sample_class_replay_supervision(
            model, noisy, target_velocity, latent, timestep,
            diffusion["alphasCumulative"], conditions, image,
            latent_normalization, config, selected["classIndex"],
        )
        loss = replay["stage4EpochWorstSampleClassReplayLossTensor"]
        if not bool(torch.isfinite(loss).all()) or float(loss.detach().cpu()) <= 0:
            raise ValueError("epoch_worst_gpu_replay_loss_nonfinite_or_zero")
        parameters = tuple(model.denoiser.parameters())
        gradients = torch.autograd.grad(loss, parameters, create_graph=False,
                                        allow_unused=True)
        gradient_total = sum(
            0.0 if gradient is None else float(gradient.detach().abs().sum().cpu())
            for gradient in gradients
        )
        if not math.isfinite(gradient_total) or gradient_total <= 0:
            raise ValueError("epoch_worst_gpu_replay_gradient_missing")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("epoch_worst_gpu_parameter_grad_fields_populated")
        step("selected_replay_autograd_grad_passed", {
            "loss": float(loss.detach().cpu()), "gradientAbsoluteSum": gradient_total,
        })

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
            raise ValueError("epoch_worst_gpu_model_state_changed")
        report = {
            "schemaVersion": "ai-painter-stage4-epoch-worst-readonly-gpu-report-v1",
            "status": "passed_stage4_epoch_worst_readonly_gpu_qualification",
            **timestamps(), "durationSeconds": round(time.perf_counter() - started, 3),
            "taskIdentity": authorization["taskIdentity"],
            "ledger": ledger, "selected": selected,
            "selectedReplay": {"loss": float(loss.detach().cpu()),
                               "gradientAbsoluteSum": gradient_total},
            "stateHashes": {
                "denoiserBefore": denoiser_before, "denoiserAfter": denoiser_after,
                "autoencoderBefore": autoencoder_before, "autoencoderAfter": autoencoder_after,
            },
            "cuda": cuda, "safety": state,
        }
        write_json_exclusive(output / "gpu-qualification-report.json", report)
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-cuda-telemetry-v1", **timestamps(), **cuda,
        })
        terminal = {
            "schemaVersion": "ai-painter-stage4-epoch-worst-readonly-gpu-terminal-v1",
            "status": "stage4_epoch_worst_readonly_gpu_qualification_succeeded_closed",
            **timestamps(),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "nextLegalAction": "execute_one_new_30_epoch_model_smoke_with_epoch_worst_replay",
            "automaticRetryStarted": False, "laterExecutionStarted": False,
            "evidence": {
                "report": binding(output / "gpu-qualification-report.json"),
                "cudaTelemetry": binding(output / "cuda-telemetry.json"),
                "consumption": binding(consumption_path),
            },
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        write_json_exclusive(output / "local-task-capsule.json", {
            "schemaVersion": "ai-painter-local-task-capsule-v1",
            "module": "AI Painter R5", "fixedTotalProgress": terminal["fixedTotalProgress"],
            "currentStage": "Stage4 epoch-global worst sample-class readonly GPU qualification complete",
            "candidateTerminal": binding(output / "phase-terminal.json"),
            "latestBlocker": None, "nextLegalAction": terminal["nextLegalAction"],
            "evidence": terminal["evidence"], **timestamps(),
        })
        print(json.dumps({**terminal, "terminal": binding(output / "phase-terminal.json")},
                         ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        failure = {
            "schemaVersion": "ai-painter-stage4-epoch-worst-readonly-gpu-terminal-v1",
            "status": "stage4_epoch_worst_readonly_gpu_qualification_failed_closed",
            **timestamps(), "errorType": type(error).__name__, "error": str(error),
            "traceback": traceback.format_exc(),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "safety": state, "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", failure)
        print(json.dumps({**failure, "terminal": binding(output / "phase-terminal.json")},
                         ensure_ascii=False, indent=2))
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
    return {"recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
            "recordedAtAsiaShanghai": shanghai.isoformat()}


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
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
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
        return str(Path(".runtime") / resolved.relative_to(runtime_root)).replace("\\", "/")
    return str(resolved.relative_to(ROOT)).replace("\\", "/")


if __name__ == "__main__":
    raise SystemExit(main())

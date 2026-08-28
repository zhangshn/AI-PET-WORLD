from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import inspect
import json
import os
from pathlib import Path
import shutil
import sys
import time

import torch

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter_direct_clean_latent_contract import (
    DIRECT_CLEAN_LATENT_ARCHITECTURE,
    validate_direct_clean_latent_cpu_inactive_config,
)
import train_ai_assisted_conditional_denoiser as trainer


CAPABILITY_VERSION = "stage4-direct-condition-clean-latent-generator-change-candidate-v1"
TASK_ID = "run_direct_condition_clean_latent_readonly_gpu_qualification"
SEED = 20263722
IMAGE_SIZE = (256, 192)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tensor_sha256(value: torch.Tensor) -> str:
    tensor = value.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode("ascii"))
    digest.update(str(tuple(tensor.shape)).encode("ascii"))
    digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def state_sha256(module: torch.nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()):
        digest.update(name.encode("utf-8"))
        digest.update(tensor_sha256(value).encode("ascii"))
    return digest.hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def write_json_exclusive(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(descriptor, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def resolve(value: Path) -> Path:
    if value.is_absolute() or ".." in value.parts:
        raise ValueError("project_relative_path_required")
    project_root = ROOT.resolve()
    logical = (ROOT / value).absolute()
    if logical != project_root and project_root not in logical.parents:
        raise ValueError("project_path_escape")
    resolved = logical.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved != project_root and project_root not in resolved.parents and not (
        resolved == runtime or runtime in resolved.parents
    ):
        raise ValueError("unregistered_external_path")
    return resolved


def project_path(value: Path) -> str:
    resolved = value.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT.resolve()).as_posix()


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def validate_ticket_shape(value: dict) -> None:
    if value.get("schemaVersion") != "ai-painter-local-internal-readonly-gpu-ticket-v1":
        raise ValueError("internal_ticket_schema_invalid")
    if value.get("status") != "issued_not_consumed":
        raise ValueError("internal_ticket_status_invalid")
    if value.get("authority") != "local_ai_pet_world_program":
        raise ValueError("internal_ticket_authority_invalid")
    if value.get("capabilityVersion") != CAPABILITY_VERSION or value.get("taskId") != TASK_ID:
        raise ValueError("internal_ticket_task_identity_invalid")
    if value.get("oneTimeConsumption") is not True or value.get("gpuUse") is not True:
        raise ValueError("internal_ticket_gpu_scope_invalid")
    forbidden = ("denoiserCheckpointRead", "optimizerCreation", "backwardExecution", "weightMutation", "checkpointWrite", "smoke", "training")
    if any(value.get("permissions", {}).get(name) is not False for name in forbidden):
        raise ValueError("internal_ticket_forbidden_permission_present")
    if value.get("permissions", {}).get("projectAutoencoderCheckpointRead") is not True:
        raise ValueError("autoencoder_checkpoint_read_scope_missing")
    identity = value.get("executionIdentity", {})
    if identity != {
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "sampleId": SAMPLE_ID,
        "split": "validation",
        "conditionChannels": 23,
        "latentChannels": 12,
    }:
        raise ValueError("readonly_gpu_execution_identity_invalid")


def validate_ticket(value: dict, ticket_path: Path, consumption: Path, output: Path) -> None:
    validate_ticket_shape(value)
    if ticket_path.parent != consumption.parent or output.parent != ticket_path.parent:
        raise ValueError("internal_ticket_namespace_mismatch")
    bindings = value.get("bindings", {})
    for name in ("inactiveConfig", "cpuTerminal", "cpuReport", "modelSupportContract", "modelFactory", "modeRegistry", "sourceIndex", "projectAutoencoderCheckpoint"):
        item = bindings.get(name, {})
        path = resolve(Path(item.get("path", "")))
        if not path.is_file() or sha256_file(path) != item.get("sha256"):
            raise ValueError(f"bound_evidence_invalid:{name}")
    if bindings["sourceIndex"]["sha256"] != SOURCE_INDEX_SHA256:
        raise ValueError("source_index_identity_invalid")
    if bindings["projectAutoencoderCheckpoint"]["sha256"] != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_identity_invalid")


def preflight(value: dict, ticket_path: Path, consumption: Path, output: Path) -> dict:
    validate_ticket(value, ticket_path, consumption, output)
    if consumption.exists() or output.exists():
        raise ValueError("ticket_or_output_already_consumed")
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    free_gpu, total_gpu = torch.cuda.mem_get_info(0)
    probe = output.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    free_disk = shutil.disk_usage(probe).free
    if free_gpu < 4 * 1024**3:
        raise ValueError("available_gpu_memory_below_formal_floor")
    if free_disk < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-direct-clean-latent-readonly-gpu-preflight-v1",
        "status": "passed_not_consumed_gpu_not_initialized_checkpoint_not_read",
        "cudaDevice": torch.cuda.get_device_name(0),
        "freeGpuMemoryBytes": int(free_gpu),
        "totalGpuMemoryBytes": int(total_gpu),
        "freeDiskBytes": int(free_disk),
        "recordedAtUtc": utc_now(),
    }


def consume(value: dict, ticket_path: Path, consumption: Path) -> None:
    write_json_exclusive(consumption, {
        "schemaVersion": "ai-painter-local-internal-readonly-gpu-ticket-consumption-v1",
        "status": "atomically_consumed",
        "ticket": binding(ticket_path),
        "capabilityVersion": CAPABILITY_VERSION,
        "taskId": TASK_ID,
        "oneTimeConsumption": True,
        "consumedAtUtc": utc_now(),
    })


def finite_nonzero(value: torch.Tensor | None) -> bool:
    return value is not None and bool(torch.isfinite(value).all()) and bool(torch.any(value != 0))


def load_sample(config: dict):
    selection = trainer.conditional_dataset_selection_contract(config)
    dataset = AiAssistedConditionalDenoiserDataset(
        DATASET_PATH,
        "validation",
        list(config["conditionChannelOrder"]),
        IMAGE_SIZE,
        selection_contract=selection,
    )
    rows = [row["sampleId"] for row in dataset.rows]
    if len(dataset) != 8 or rows.count(SAMPLE_ID) != 1:
        raise ValueError("fixed_validation_sample_identity_invalid")
    return dataset[rows.index(SAMPLE_ID)]


def run_gpu(value: dict, ticket_path: Path, consumption: Path, output: Path) -> dict:
    started = time.perf_counter()
    output.mkdir(parents=False, exist_ok=False)
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    device = torch.device("cuda:0")
    config = read_json(resolve(Path(value["bindings"]["inactiveConfig"]["path"])))
    validate_direct_clean_latent_cpu_inactive_config(config)
    if config.get("denoiserArchitecture") != DIRECT_CLEAN_LATENT_ARCHITECTURE:
        raise ValueError("direct_clean_latent_architecture_identity_invalid")
    sample = load_sample(config)
    image_cpu = sample["image"].unsqueeze(0)
    conditions_cpu = sample["conditions"].unsqueeze(0)
    if list(image_cpu.shape) != [1, 3, 192, 256] or list(conditions_cpu.shape) != [1, 23, 192, 256]:
        raise ValueError("formal_sample_tensor_shape_invalid")

    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config)
    if tuple(inspect.signature(model.predict_clean_latent).parameters) != ("conditions",):
        raise ValueError("direct_model_public_signature_invalid")
    parameter_names = tuple(name for name, _ in model.denoiser.named_parameters())
    if any(token in name for name in parameter_names for token in ("latent_stem", "time_embedding", "time_mlp", "velocity")):
        raise ValueError("diffusion_parameter_identity_present")
    checkpoint_path = resolve(Path(value["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_sha256_changed_after_consumption")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.to(device).eval()
    denoiser_before = state_sha256(model.denoiser)
    autoencoder_before = state_sha256(model.autoencoder)

    image = image_cpu.to(device)
    conditions = conditions_cpu.to(device).requires_grad_(True)
    with torch.no_grad():
        target_latent = model.autoencoder.encode(image)
    predicted_latent = model.predict_clean_latent(conditions)
    decoded_rgb = model.decode_clean_latent(predicted_latent)
    weights = config["training"]["denoiserLossWeights"]
    clean_latent_loss = (predicted_latent - target_latent).abs().mean()
    decoded_rgb_loss = (decoded_rgb - image).abs().mean()
    qualification_objective = (
        float(weights["cleanLatent"]) * clean_latent_loss
        + float(weights["decodedRgb"]) * decoded_rgb_loss
    )
    parameters = tuple(model.denoiser.parameters())
    gradients = torch.autograd.grad(
        qualification_objective,
        (conditions, *parameters),
        allow_unused=True,
    )
    if not finite_nonzero(gradients[0]):
        raise ValueError("condition_gradient_invalid")
    if any(not finite_nonzero(gradient) for gradient in gradients[1:]):
        raise ValueError("formal_parameter_gradient_invalid")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_field_was_populated")
    if list(predicted_latent.shape) != [1, 12, 48, 64] or list(decoded_rgb.shape) != [1, 3, 192, 256]:
        raise ValueError("direct_output_shape_invalid")

    torch.cuda.synchronize(0)
    telemetry = {
        "deviceName": torch.cuda.get_device_name(0),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    model.to("cpu")
    denoiser_after = state_sha256(model.denoiser)
    autoencoder_after = state_sha256(model.autoencoder)
    if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
        raise ValueError("model_state_changed_during_readonly_gpu_qualification")
    state = {
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": True,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": True,
    }
    gradient_evidence = {
        "conditionGradientFiniteNonZero": True,
        "conditionGradientNorm": float(gradients[0].detach().norm().cpu()),
        "formalParameterTensorCount": len(parameter_names),
        "formalParameterCount": sum(parameter.numel() for parameter in parameters),
        "allFormalParameterGradientsFiniteNonZero": True,
        "cleanLatentLoss": float(clean_latent_loss.detach().cpu()),
        "decodedRgbLoss": float(decoded_rgb_loss.detach().cpu()),
        "qualificationObjective": float(qualification_objective.detach().cpu()),
        "retainedExistingWeights": {
            "cleanLatent": float(weights["cleanLatent"]),
            "decodedRgb": float(weights["decodedRgb"]),
        },
    }
    write_json_atomic(output / "gradient-evidence.json", gradient_evidence)
    write_json_atomic(output / "model-state-hashes.json", state)
    write_json_atomic(output / "cuda-telemetry.json", {"status": "completed", **telemetry})
    report = {
        "schemaVersion": "stage4-direct-clean-latent-readonly-gpu-report-v1",
        "status": "direct_clean_latent_readonly_gpu_qualification_succeeded",
        "capabilityVersion": CAPABILITY_VERSION,
        "architecture": DIRECT_CLEAN_LATENT_ARCHITECTURE,
        "sampleIdentity": {"sampleId": SAMPLE_ID, "split": "validation"},
        "seed": SEED,
        "inputShape": [1, 23, 192, 256],
        "outputShape": [1, 12, 48, 64],
        "decodedRgbShape": [1, 3, 192, 256],
        "gradientEvidence": gradient_evidence,
        "stateHashes": state,
        "cuda": telemetry,
        "safety": {
            "denoiserCheckpointRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightModified": False,
            "checkpointWritten": False,
            "smokeStarted": False,
            "trainingStarted": False,
        },
        "ticket": binding(ticket_path),
        "consumption": binding(consumption),
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "gpu-report.json", report)
    terminal = {
        "schemaVersion": "stage4-direct-clean-latent-readonly-gpu-terminal-v1",
        "executionState": "completed",
        "status": "direct_clean_latent_readonly_gpu_qualification_succeeded",
        "gpuReport": binding(output / "gpu-report.json"),
        "gradientEvidence": binding(output / "gradient-evidence.json"),
        "modelStateHashes": binding(output / "model-state-hashes.json"),
        "cudaTelemetry": binding(output / "cuda-telemetry.json"),
        "ownerAuthorizationRequired": False,
        "ownerResponseRequired": False,
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "phase-terminal.json", terminal)
    return terminal


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--ticket", type=Path, required=True)
    parser.add_argument("--ticket-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    ticket_path = resolve(args.ticket)
    consumption = resolve(args.consumption)
    output = resolve(args.output_dir)
    if sha256_file(ticket_path) != args.ticket_sha256:
        raise ValueError("internal_ticket_sha256_mismatch")
    ticket = read_json(ticket_path)
    result = preflight(ticket, ticket_path, consumption, output)
    if args.preflight_only:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    consume(ticket, ticket_path, consumption)
    terminal = run_gpu(ticket, ticket_path, consumption, output)
    print(json.dumps({"status": terminal["status"], "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

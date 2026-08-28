from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
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
sys.path.insert(0, str(SRC))
sys.path.insert(0, str(SCRIPT_DIR))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter_native_responsibility_residual_contract import (
    NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
    RESPONSIBILITY_IDENTITY_ORDER,
    validate_native_responsibility_residual_cpu_inactive_config,
)
import train_ai_assisted_conditional_denoiser as trainer


CAPABILITY = "stage4-native-condition-encoder-responsibility-residual-final-candidate-v1"
TASK = "run_native_condition_encoder_responsibility_residual_readonly_gpu_qualification"
SEED = 20263722
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def resolve(value: Path) -> Path:
    if value.is_absolute() or ".." in value.parts:
        raise ValueError("project_relative_path_required")
    root = ROOT.resolve()
    logical = (ROOT / value).absolute()
    if logical != root and root not in logical.parents:
        raise ValueError("project_path_escape")
    resolved = logical.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved != root and root not in resolved.parents and not (
        resolved == runtime or runtime in resolved.parents
    ):
        raise ValueError("unregistered_external_path")
    return resolved


def project_path(value: Path):
    resolved = value.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT.resolve()).as_posix()


def sha256_file(value: Path):
    return hashlib.sha256(value.read_bytes()).hexdigest()


def binding(value: Path):
    return {"path": project_path(value), "sha256": sha256_file(value)}


def tensor_sha256(value):
    tensor = value.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode("ascii"))
    digest.update(str(tuple(tensor.shape)).encode("ascii"))
    digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def state_sha256(module):
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()):
        digest.update(name.encode("utf-8"))
        digest.update(tensor_sha256(value).encode("ascii"))
    return digest.hexdigest()


def write_atomic(value: Path, payload):
    value.parent.mkdir(parents=True, exist_ok=True)
    temporary = value.with_name(f".{value.name}.{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, value)


def write_exclusive(value: Path, payload):
    value.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(value, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(
            descriptor,
            (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        )
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def validate_ticket(ticket, ticket_path, consumption, output):
    if ticket.get("schemaVersion") != "ai-painter-local-internal-readonly-gpu-ticket-v1":
        raise ValueError("ticket_schema_invalid")
    if ticket.get("status") != "issued_not_consumed" or ticket.get("authority") != "local_ai_pet_world_program":
        raise ValueError("ticket_state_or_authority_invalid")
    if ticket.get("capabilityVersion") != CAPABILITY or ticket.get("taskId") != TASK:
        raise ValueError("ticket_task_identity_invalid")
    if ticket_path.parent != consumption.parent or output.parent != ticket_path.parent:
        raise ValueError("ticket_namespace_mismatch")
    permissions = ticket.get("permissions", {})
    if permissions.get("projectAutoencoderCheckpointRead") is not True:
        raise ValueError("autoencoder_read_permission_missing")
    for key in (
        "denoiserCheckpointRead",
        "optimizerCreation",
        "backwardExecution",
        "weightMutation",
        "checkpointWrite",
        "smoke",
        "training",
    ):
        if permissions.get(key) is not False:
            raise ValueError(f"forbidden_permission_present:{key}")
    expected_identity = {
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "sampleId": SAMPLE_ID,
        "split": "validation",
        "conditionChannels": 23,
        "latentChannels": 12,
        "responsibilityIdentityOrder": list(RESPONSIBILITY_IDENTITY_ORDER),
    }
    if ticket.get("executionIdentity") != expected_identity:
        raise ValueError("ticket_execution_identity_invalid")
    for name, item in ticket.get("bindings", {}).items():
        file = resolve(Path(item.get("path", "")))
        if not file.is_file() or sha256_file(file) != item.get("sha256"):
            raise ValueError(f"ticket_binding_invalid:{name}")


def preflight(ticket, ticket_path, consumption, output):
    validate_ticket(ticket, ticket_path, consumption, output)
    if consumption.exists() or output.exists():
        raise ValueError("ticket_or_output_already_consumed")
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    free_gpu, total_gpu = torch.cuda.mem_get_info(0)
    free_disk = shutil.disk_usage(ticket_path.parent).free
    if free_gpu < 4 * 1024**3:
        raise ValueError("available_gpu_memory_below_formal_floor")
    if free_disk < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-native-responsibility-residual-readonly-gpu-preflight-v1",
        "status": "passed_not_consumed",
        "cudaDevice": torch.cuda.get_device_name(0),
        "freeGpuMemoryBytes": int(free_gpu),
        "totalGpuMemoryBytes": int(total_gpu),
        "freeDiskBytes": int(free_disk),
        "recordedAtUtc": utc_now(),
    }


def finite_nonzero(value):
    return value is not None and bool(torch.isfinite(value).all()) and bool(torch.any(value != 0))


def load_sample(config):
    selection = trainer.conditional_dataset_selection_contract(config)
    if selection != "registered_v7_capacity_contribution_v1":
        raise ValueError("formal_dataset_selection_contract_invalid")
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=selection,
        )
        for split in ("train", "validation", "challenge", "regression")
    }
    counts = {key: len(value) for key, value in datasets.items()}
    if counts != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}:
        raise ValueError("formal_dataset_split_identity_invalid")
    rows = [row["sampleId"] for row in datasets["validation"].rows]
    if rows.count(SAMPLE_ID) != 1:
        raise ValueError("fixed_validation_sample_identity_invalid")
    return datasets["validation"][rows.index(SAMPLE_ID)], counts


def run_gpu(ticket, ticket_path, consumption, output):
    started = time.perf_counter()
    output.mkdir(parents=False, exist_ok=False)
    config = json.loads(
        resolve(Path(ticket["bindings"]["inactiveConfig"]["path"])).read_text(encoding="utf-8")
    )
    validate_native_responsibility_residual_cpu_inactive_config(config)
    if config.get("denoiserArchitecture") != NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE:
        raise ValueError("architecture_identity_invalid")
    sample, split_counts = load_sample(config)
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    device = torch.device("cuda:0")
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config)
    checkpoint_path = resolve(Path(ticket["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_identity_changed")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.to(device).eval()
    denoiser_before = state_sha256(model.denoiser)
    autoencoder_before = state_sha256(model.autoencoder)
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
    with torch.no_grad():
        target_latent = model.autoencoder.encode(image)
    predicted, responsibility = model.denoiser(
        conditions,
        return_responsibility_evidence=True,
    )
    decoded = model.decode_clean_latent(predicted)
    if list(predicted.shape) != [1, 12, 48, 64] or list(decoded.shape) != [1, 3, 192, 256]:
        raise ValueError("formal_output_shape_invalid")
    if list(responsibility.get("responsibilityIdentityOrder", ())) != list(RESPONSIBILITY_IDENTITY_ORDER):
        raise ValueError("responsibility_identity_order_invalid")
    masks = tuple(responsibility.get("responsibilityMasks", ()))
    residuals = tuple(responsibility.get("maskedResponsibilityResiduals", ()))
    if len(masks) != 5 or len(residuals) != 5:
        raise ValueError("responsibility_output_count_invalid")
    isolation = []
    for identity, mask, residual in zip(RESPONSIBILITY_IDENTITY_ORDER, masks, residuals):
        if list(mask.shape) != [1, 1, 48, 64] or list(residual.shape) != [1, 12, 48, 64]:
            raise ValueError(f"responsibility_shape_invalid:{identity}")
        if not bool(torch.isfinite(mask).all()) or not bool(torch.isfinite(residual).all()):
            raise ValueError(f"responsibility_nonfinite:{identity}")
        outside = residual * (mask == 0).to(residual.dtype)
        if int(torch.count_nonzero(outside).detach().cpu()) != 0:
            raise ValueError(f"responsibility_outside_mask_nonzero:{identity}")
        inside = residual * (mask != 0).to(residual.dtype)
        if int(torch.count_nonzero(mask).detach().cpu()) == 0 or int(torch.count_nonzero(inside).detach().cpu()) == 0:
            raise ValueError(f"responsibility_inside_mask_support_missing:{identity}")
        isolation.append(
            {
                "identity": identity,
                "maskNonzeroCount": int(torch.count_nonzero(mask).detach().cpu()),
                "insideResidualNonzeroCount": int(torch.count_nonzero(inside).detach().cpu()),
                "outsideResidualNonzeroCount": 0,
                "maskSha256": tensor_sha256(mask),
            }
        )
    if responsibility.get("outsideMaskMutationAllowed") is not False or responsibility.get("freeBlendWeightsPresent") is not False:
        raise ValueError("responsibility_merge_contract_invalid")
    if responsibility.get("nativeConditionEncodingBeforeResiduals") is not True:
        raise ValueError("native_encoder_not_upstream_of_residuals")
    weights = config["training"]["denoiserLossWeights"]
    clean_loss = (predicted - target_latent).abs().mean()
    rgb_loss = (decoded - image).abs().mean()
    objective = float(weights["cleanLatent"]) * clean_loss + float(weights["decodedRgb"]) * rgb_loss
    named_parameters = tuple(model.denoiser.named_parameters())
    gradients = torch.autograd.grad(
        objective,
        (conditions, *(parameter for _name, parameter in named_parameters)),
        allow_unused=True,
    )
    if any(not finite_nonzero(value) for value in gradients):
        raise ValueError("formal_input_or_parameter_gradient_invalid")
    head_gradient_evidence = []
    for (name, _parameter), gradient in zip(named_parameters, gradients[1:]):
        if "responsibility_residual_heads." in name:
            head_gradient_evidence.append(
                {
                    "parameter": name,
                    "finiteNonzero": True,
                    "norm": float(gradient.detach().norm().cpu()),
                }
            )
    if len(head_gradient_evidence) != 10:
        raise ValueError("responsibility_head_gradient_tensor_count_invalid")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_field_populated")
    torch.cuda.synchronize(0)
    telemetry = {
        "deviceName": torch.cuda.get_device_name(0),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    gradient_evidence = {
        "conditionGradientFiniteNonZero": True,
        "conditionGradientNorm": float(gradients[0].detach().norm().cpu()),
        "formalParameterTensorCount": len(named_parameters),
        "formalParameterCount": sum(parameter.numel() for _name, parameter in named_parameters),
        "allFormalParameterGradientsFiniteNonZero": True,
        "responsibilityHeadGradientTensorCount": len(head_gradient_evidence),
        "responsibilityHeadGradients": head_gradient_evidence,
        "responsibilityIsolation": isolation,
        "cleanLatentLoss": float(clean_loss.detach().cpu()),
        "decodedRgbLoss": float(rgb_loss.detach().cpu()),
        "qualificationObjective": float(objective.detach().cpu()),
    }
    model.to("cpu")
    denoiser_after = state_sha256(model.denoiser)
    autoencoder_after = state_sha256(model.autoencoder)
    if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
        raise ValueError("model_state_changed")
    states = {
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": True,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": True,
    }
    write_atomic(output / "gradient-evidence.json", gradient_evidence)
    write_atomic(output / "model-state-hashes.json", states)
    write_atomic(output / "cuda-telemetry.json", {"status": "completed", **telemetry})
    report = {
        "schemaVersion": "stage4-native-responsibility-residual-readonly-gpu-report-v1",
        "status": "native_responsibility_residual_readonly_gpu_qualification_succeeded",
        "capabilityVersion": CAPABILITY,
        "architecture": NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
        "sampleIdentity": {"sampleId": SAMPLE_ID, "split": "validation"},
        "splitCounts": split_counts,
        "seed": SEED,
        "inputShape": [1, 23, 192, 256],
        "outputShape": [1, 12, 48, 64],
        "decodedRgbShape": [1, 3, 192, 256],
        "responsibilityIdentityOrder": list(RESPONSIBILITY_IDENTITY_ORDER),
        "gradientEvidence": gradient_evidence,
        "stateHashes": states,
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
    write_atomic(output / "gpu-report.json", report)
    terminal = {
        "schemaVersion": "stage4-native-responsibility-residual-readonly-gpu-terminal-v1",
        "executionState": "completed",
        "status": report["status"],
        "gpuReport": binding(output / "gpu-report.json"),
        "gradientEvidence": binding(output / "gradient-evidence.json"),
        "modelStateHashes": binding(output / "model-state-hashes.json"),
        "cudaTelemetry": binding(output / "cuda-telemetry.json"),
        "ownerAuthorizationRequired": False,
        "recordedAtUtc": utc_now(),
    }
    write_atomic(output / "phase-terminal.json", terminal)
    return terminal


def main():
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
        raise ValueError("ticket_sha256_mismatch")
    ticket = json.loads(ticket_path.read_text(encoding="utf-8"))
    result = preflight(ticket, ticket_path, consumption, output)
    if args.preflight_only:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    write_exclusive(
        consumption,
        {
            "schemaVersion": "ai-painter-local-internal-readonly-gpu-ticket-consumption-v1",
            "status": "atomically_consumed",
            "ticket": binding(ticket_path),
            "capabilityVersion": CAPABILITY,
            "taskId": TASK,
            "oneTimeConsumption": True,
            "consumedAtUtc": utc_now(),
        },
    )
    terminal = run_gpu(ticket, ticket_path, consumption, output)
    print(
        json.dumps(
            {
                "status": terminal["status"],
                "terminal": binding(output / "phase-terminal.json"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

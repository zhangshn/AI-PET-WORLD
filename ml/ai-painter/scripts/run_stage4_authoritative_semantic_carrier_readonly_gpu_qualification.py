from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import torch

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import build_complete_world_system
import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification as dataset_runner


SEED = 20263722
TRAIN_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
VALIDATION_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
IDENTITIES = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass",
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(descriptor, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode())
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tensor_hash(value: torch.Tensor) -> str:
    tensor = value.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode())
    digest.update(json.dumps(list(tensor.shape)).encode())
    digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def state_hash(module: torch.nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in module.state_dict().items():
        digest.update(name.encode())
        digest.update(tensor_hash(value).encode())
    return digest.hexdigest()


def finite_nonzero(value: torch.Tensor | None) -> bool:
    return value is not None and bool(torch.isfinite(value).all()) and bool(value.abs().max() > 0)


def load_samples(base_config: dict) -> list[dict]:
    datasets = dataset_runner.load_datasets(base_config)
    train_ids = [row["sampleId"] for row in datasets["train"].rows]
    validation_ids = [row["sampleId"] for row in datasets["validation"].rows]
    if train_ids[0] != TRAIN_SAMPLE_ID or VALIDATION_SAMPLE_ID not in validation_ids:
        raise ValueError("fixed_sample_identity_changed")
    selected: dict[str, dict] = {}
    grouped: dict[str, dict] = {}
    for row_index in range(len(datasets["train"])):
        sample = datasets["train"][row_index]
        for identity in IDENTITIES:
            if identity in selected:
                continue
            channel_index = base_config["conditionChannelOrder"].index(identity)
            if bool(sample["conditions"][channel_index].max() > 0):
                selected[identity] = sample
                grouped.setdefault(sample["sampleId"], {"sample": sample, "identities": []})["identities"].append(identity)
        if len(selected) == len(IDENTITIES):
            break
    if set(selected) != set(IDENTITIES):
        raise ValueError(f"formal_train_semantic_coverage_missing:{sorted(set(IDENTITIES) - set(selected))}")
    validation = datasets["validation"][validation_ids.index(VALIDATION_SAMPLE_ID)]
    validation_identities = []
    for identity in IDENTITIES:
        channel_index = base_config["conditionChannelOrder"].index(identity)
        if bool(validation["conditions"][channel_index].max() > 0):
            validation_identities.append(identity)
    return [
        {"split": "train", **item}
        for item in grouped.values()
    ] + [{"split": "validation", "sample": validation, "identities": validation_identities}]


def main() -> int:
    if len(sys.argv) != 5:
        raise SystemExit("usage: runner <inactive-config> <base-config> <autoencoder-checkpoint> <output-directory>")
    config_path, base_path, checkpoint_path, output = map(Path, sys.argv[1:])
    for source in (config_path, base_path, checkpoint_path):
        if not source.is_file():
            raise ValueError(f"source_missing:{source}")
    if output.exists():
        raise ValueError("output_directory_already_exists")
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_checkpoint_sha256_mismatch")
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("cuda_unavailable")
    free_bytes, total_bytes = torch.cuda.mem_get_info(0)
    if free_bytes < 4 * 1024**3:
        raise ValueError("cuda_free_memory_below_4gib")
    output.mkdir(parents=True, exist_ok=False)
    write_json_exclusive(output / "internal-consumption.json", {
        "schemaVersion": "stage4-authoritative-semantic-carrier-readonly-gpu-internal-consumption-v1",
        "status": "consumed_once_before_checkpoint_read_and_cuda_forward",
        "ownerAuthorizationRequired": False,
        "checkpointReadScope": "project_autoencoder_only",
        "denoiserCheckpointRead": False,
        "recordedAtUtc": utc_now(),
    })
    started = time.perf_counter()
    config = read_json(config_path)
    base_config = read_json(base_path)
    samples = load_samples(base_config)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    device = torch.device("cuda:0")
    torch.cuda.reset_peak_memory_stats(0)
    model = build_complete_world_system(config)
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, base_config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.to(device).eval()
    denoiser_before = state_hash(model.denoiser)
    autoencoder_before = state_hash(model.autoencoder)
    rows = []
    qualified_identities = set()
    for sample_index, selection in enumerate(samples):
        sample = selection["sample"]
        conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
        generator = torch.Generator(device=device).manual_seed(SEED + sample_index)
        latent = torch.randn((1, 12, 48, 64), device=device, generator=generator)
        timestep = torch.tensor([999.0], device=device)
        output_latent, evidence = model.predict_velocity_with_stage4_authoritative_semantic_carriers(latent, timestep, conditions)
        decoded = model.autoencoder.decode(output_latent)
        if tuple(output_latent.shape) != (1, 12, 48, 64) or tuple(decoded.shape) != (1, 3, 192, 256):
            raise ValueError("formal_output_shape_mismatch")
        resized = model.prepare_typed_conditions(conditions, output_latent.shape[-2:])
        carrier_rows = []
        contribution_by_identity = dict(zip(IDENTITIES, evidence["authoritativelyGatedContributions"]))
        for identity in selection["identities"]:
            gated = contribution_by_identity[identity]
            source_index = config["conditionChannelOrder"].index(identity)
            mask = resized[:, source_index:source_index + 1]
            outside_max = float((gated * (1.0 - mask)).detach().abs().max().cpu())
            parameters = tuple(model.denoiser.authoritative_semantic_carriers[identity].parameters())
            decoded_scalar = decoded.square().mean()
            parameter_gradients = torch.autograd.grad(decoded_scalar, parameters, retain_graph=True, allow_unused=False)
            condition_gradient = torch.autograd.grad(decoded_scalar, conditions, retain_graph=True, allow_unused=False)[0][:, source_index:source_index + 1]
            if outside_max != 0.0 or not all(finite_nonzero(value) for value in parameter_gradients) or not finite_nonzero(condition_gradient):
                raise ValueError(f"carrier_gpu_gradient_or_mask_boundary_failed:{identity}")
            carrier_rows.append({
                "identity": identity,
                "sourceConditionIndex": source_index,
                "outsideMaskMaxAbs": outside_max,
                "parameterGradientTensorCount": len(parameter_gradients),
                "parameterGradientsFiniteNonZero": True,
                "sourceConditionGradientFiniteNonZero": True,
                "reachesDecodedRgb": True,
            })
            qualified_identities.add(identity)
        rows.append({
            "split": selection["split"],
            "sampleId": sample["sampleId"],
            "outputLatentSha256": tensor_hash(output_latent),
            "decodedRgbSha256": tensor_hash(decoded),
            "carrierEvidence": carrier_rows,
        })
        del conditions, latent, output_latent, decoded, resized, evidence
        torch.cuda.empty_cache()
    if qualified_identities != set(IDENTITIES):
        raise ValueError("not_all_carrier_identities_qualified")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_fields_populated")
    torch.cuda.synchronize(0)
    denoiser_after = state_hash(model.denoiser)
    autoencoder_after = state_hash(model.autoencoder)
    if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
        raise ValueError("model_state_changed")
    report = {
        "schemaVersion": "stage4-authoritative-semantic-carrier-readonly-gpu-report-v1",
        "status": "passed",
        "seed": SEED,
        "samples": rows,
        "carrierIdentityOrder": list(IDENTITIES),
        "autoencoderCheckpointSha256": AUTOENCODER_SHA256,
        "denoiserInitialization": "fixed_random_initialization",
        "denoiserStateBeforeSha256": denoiser_before,
        "denoiserStateAfterSha256": denoiser_after,
        "autoencoderStateBeforeSha256": autoencoder_before,
        "autoencoderStateAfterSha256": autoencoder_after,
        "modelStateUnchanged": True,
        "cuda": {
            "deviceName": torch.cuda.get_device_name(0),
            "totalMemoryBytes": int(total_bytes),
            "freeMemoryBytesAtPreflight": int(free_bytes),
            "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        },
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
        "durationSeconds": time.perf_counter() - started,
        "recordedAtUtc": utc_now(),
    }
    write_json_exclusive(output / "gpu-report.json", report)
    write_json_exclusive(output / "cuda-telemetry.json", {"schemaVersion": "stage4-authoritative-semantic-carrier-cuda-telemetry-v1", "status": "passed", **report["cuda"], "durationSeconds": report["durationSeconds"], "recordedAtUtc": report["recordedAtUtc"]})
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

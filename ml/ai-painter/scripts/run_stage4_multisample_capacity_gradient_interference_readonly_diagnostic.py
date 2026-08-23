from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import time

import torch

from ai_painter.complete_world import build_complete_world_system
import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification as base
import run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification as reference_runner


ROOT = Path(__file__).resolve().parents[3]
CLASSES = ("footprints", "tree", "rock", "vegetation")
SEED = 20263722
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    authorization_path = resolve(args.authorization)
    consumption_path = resolve(args.consumption)
    output = resolve(args.output_dir)
    if sha256_file(authorization_path) != args.authorization_sha256:
        raise ValueError("authorization_sha256_mismatch")
    authorization = read_json(authorization_path)
    validate_authorization(authorization, authorization_path, consumption_path, output)
    if args.preflight_only:
        print(json.dumps(preflight(authorization, output), ensure_ascii=False, indent=2))
        return 0
    consume(authorization, authorization_path, consumption_path)
    return run_gpu(authorization, authorization_path, consumption_path, output)


def validate_authorization(value, authorization_path, consumption_path, output):
    if value.get("schemaVersion") != "owner-authorized-stage4-current-model-multisample-capacity-gradient-interference-readonly-diagnostic-v1":
        raise ValueError("authorization_schema_invalid")
    if value.get("status") != "resolved_owner_authorized_not_consumed" or value.get("requestId") != value.get("commandRef"):
        raise ValueError("authorization_identity_invalid")
    if value.get("scope") != "one_readonly_gpu_current_model_multisample_capacity_and_gradient_interference_diagnostic":
        raise ValueError("authorization_scope_invalid")
    if value.get("oneTimeConsumption") is not True or value.get("gpuAuthorized") is not True or value.get("checkpointWeightsReadAuthorized") is not True:
        raise ValueError("readonly_gpu_authority_missing")
    if any(value.get(name) is not False for name in ("denoiserCheckpointReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized")):
        raise ValueError("forbidden_authority_present")
    identity = value.get("taskIdentity", {})
    expected = {"train": 48, "validation": 8}
    if identity.get("population") != expected or identity.get("conditionChannelCount") != 23 or identity.get("classIdentityOrder") != list(CLASSES):
        raise ValueError("task_identity_invalid")
    if identity.get("seed") != SEED or identity.get("imageSize") != {"width": 256, "height": 192} or identity.get("rolloutSteps") != 50 or identity.get("gradientTailSteps") != 5:
        raise ValueError("execution_identity_invalid")
    if value["bindings"]["sourceIndex"]["sha256"] != SOURCE_INDEX_SHA256 or value["bindings"]["projectAutoencoderCheckpoint"]["sha256"] != AUTOENCODER_SHA256:
        raise ValueError("source_or_checkpoint_identity_invalid")
    if resolve(Path(value["execution"]["outputDirectory"])) != output or resolve(Path(value["execution"]["consumptionPath"])) != consumption_path:
        raise ValueError("execution_path_identity_invalid")
    if authorization_path.parent != consumption_path.parent:
        raise ValueError("consumption_parent_identity_invalid")


def preflight(authorization, output):
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    source_index = resolve(Path(authorization["bindings"]["sourceIndex"]["path"]))
    config_path = resolve(Path(authorization["bindings"]["activeConfig"]["path"]))
    checkpoint = resolve(Path(authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(source_index) != SOURCE_INDEX_SHA256:
        raise ValueError("source_index_sha256_mismatch")
    if sha256_file(config_path) != authorization["bindings"]["activeConfig"]["sha256"]:
        raise ValueError("active_config_sha256_mismatch")
    if not checkpoint.is_file():
        raise ValueError("autoencoder_checkpoint_missing")
    if output.exists():
        raise ValueError("output_directory_already_exists")
    probe = output.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    free = shutil.disk_usage(probe).free
    if free < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    return {"schemaVersion": "stage4-multisample-capacity-gradient-interference-preflight-v1", "status": "passed_gpu_not_started_not_consumed_checkpoint_not_read", "python": os.sys.executable, "torchVersion": torch.__version__, "cudaDevice": torch.cuda.get_device_name(0), "freeDiskBytes": free, "outputDirectoryAbsent": True, "checkpointContentRead": False}


def consume(authorization, authorization_path, consumption_path):
    if consumption_path.exists():
        raise ValueError("authorization_already_consumed")
    consumption_path.parent.mkdir(parents=True, exist_ok=True)
    value = {"schemaVersion": "stage4-multisample-capacity-gradient-interference-consumption-v1", "status": "readonly_gpu_authorization_atomically_consumed", "requestId": authorization["requestId"], "commandRef": authorization["commandRef"], "scope": authorization["scope"], "authorization": binding(authorization_path), "oneTimeConsumption": True, "consumedAtUtc": utc_now()}
    descriptor = os.open(consumption_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(descriptor, (json.dumps(value, indent=2) + "\n").encode("utf-8")); os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run_gpu(authorization, authorization_path, consumption_path, output):
    started = time.perf_counter()
    output.parent.mkdir(parents=True, exist_ok=True); output.mkdir(exist_ok=False)
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
    torch.use_deterministic_algorithms(True); torch.backends.cudnn.deterministic = True; torch.backends.cudnn.benchmark = False
    torch.cuda.init(); torch.cuda.set_device(0); torch.cuda.reset_peak_memory_stats(0)
    device = torch.device("cuda:0")
    config = read_json(resolve(Path(authorization["bindings"]["activeConfig"]["path"])))
    datasets = base.load_datasets(config)
    source_index = read_json(resolve(Path(authorization["bindings"]["sourceIndex"]["path"])))
    expected_train = [row["sampleId"] for row in source_index["samples"] if row.get("split") == "train" and row.get("v7CapacityContributionRegistered") is True]
    expected_validation = [row["sampleId"] for row in source_index["samples"] if row.get("split") == "validation" and row.get("v7CapacityContributionRegistered") is True]
    torch.manual_seed(SEED); torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config)
    denoiser_before = state_sha256(model.denoiser)
    checkpoint_path = resolve(Path(authorization["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_checkpoint_sha256_mismatch_after_consumption")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False); model.autoencoder.eval()
    autoencoder_before = state_sha256(model.autoencoder)
    model.to(device).eval()
    normalization = trainer.compute_latent_normalization(model, datasets["train"], device)
    diffusion = trainer.build_diffusion_schedule(config, device)
    shared_parameters = tuple(model.denoiser.output.parameters())
    if not shared_parameters:
        raise ValueError("shared_final_output_parameter_group_missing")
    condition_order = list(config["conditionChannelOrder"])
    rollout_weight = float(config["training"]["stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"]["sourceContracts"]["rolloutWeight"])
    rows = []
    vectors = {"train": {name: [] for name in CLASSES}, "validation": {name: [] for name in CLASSES}}
    vectors_by_sample = {}
    total = 56
    completed = 0
    for split in ("train", "validation"):
        dataset = datasets[split]
        for index in range(len(dataset)):
            record = dataset[index]
            image = record["image"].unsqueeze(0).to(device)
            conditions = record["conditions"].unsqueeze(0).to(device).requires_grad_(True)
            seed = SEED + (0 if split == "train" else 3000) + index
            with torch.no_grad():
                representation = model.denoiser.condition_stem(conditions)
            predicted = base.rollout_rgb(model, image, conditions, [seed], diffusion, normalization, config, gradient_tail_steps=5)
            losses, weighted = reference_runner.weighted_reference_tensor(model.autoencoder, predicted, image, conditions.detach(), config)
            class_rows = []
            sample_vectors = {}
            for class_index, class_identity in enumerate(CLASSES):
                loss = weighted[0, class_index] * rollout_weight
                gradients = torch.autograd.grad(loss, (conditions, *shared_parameters), retain_graph=class_index < len(CLASSES) - 1, allow_unused=True)
                condition_gradient = gradients[0]
                parameter_parts = [(torch.zeros_like(parameter) if gradient is None else gradient).detach().reshape(-1).float().cpu() for parameter, gradient in zip(shared_parameters, gradients[1:])]
                shared_vector = torch.cat(parameter_parts)
                own_channel = condition_order.index(f"object_{class_identity}")
                channel_sums = condition_gradient.detach().abs().sum(dim=(0, 2, 3)).float().cpu()
                finite = bool(torch.isfinite(condition_gradient).all()) and bool(torch.isfinite(shared_vector).all())
                class_rows.append({"classIdentity": class_identity, "weightedLoss": float(loss.detach().cpu()), "gradientFinite": finite, "sharedFinalPathGradientNorm": float(shared_vector.norm()), "sharedFinalPathGradientNonZero": bool(shared_vector.abs().sum() > 0), "ownConditionChannelGradientAbsSum": float(channel_sums[own_channel]), "ownConditionChannelReachesFinalPath": bool(channel_sums[own_channel] > 0), "conditionChannelGradientAbsSums": [float(value) for value in channel_sums]})
                vectors[split][class_identity].append(shared_vector)
                sample_vectors[class_identity] = shared_vector
            vectors_by_sample[(split, record["sampleId"])] = sample_vectors
            rows.append({"sourceIndex": completed, "split": split, "sampleId": record["sampleId"], "seed": seed, "conditionTensorSha256": tensor_sha256(conditions), "conditionRepresentationSha256": tensor_sha256(representation), "targetRgbSha256": tensor_sha256(image), "finalRgbSha256": tensor_sha256(predicted), "conditionRepresentationFinite": bool(torch.isfinite(representation).all()), "finalRgbFinite": bool(torch.isfinite(predicted).all()), "classDiagnostics": class_rows})
            completed += 1
            write_json_atomic(output / "progress.json", {"schemaVersion": "stage4-multisample-capacity-gradient-interference-progress-v1", "status": "running", "completed": completed, "total": total, "percent": round(completed / total * 100, 3), "split": split, "sampleId": record["sampleId"], "recordedAtUtc": utc_now()})
            print(json.dumps({"status": "diagnostic_progress", "completed": completed, "total": total, "split": split, "sampleId": record["sampleId"]}), flush=True)
            del image, conditions, predicted, losses, weighted, representation
            torch.cuda.empty_cache()
    if [row["sampleId"] for row in rows if row["split"] == "train"] != expected_train or [row["sampleId"] for row in rows if row["split"] == "validation"] != expected_validation:
        raise ValueError("source_index_order_changed")
    interference = {split: interference_summary(vectors[split], {key[1]: value for key, value in vectors_by_sample.items() if key[0] == split}) for split in ("train", "validation")}
    capacity = capacity_summary(rows)
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_fields_populated")
    torch.cuda.synchronize(0)
    cuda = {"deviceName": torch.cuda.get_device_name(0), "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)), "peakReservedBytes": int(torch.cuda.max_memory_reserved(0))}
    model.to("cpu")
    denoiser_after = state_sha256(model.denoiser); autoencoder_after = state_sha256(model.autoencoder)
    report = {"schemaVersion": "stage4-current-model-multisample-capacity-gradient-interference-gpu-report-v1", "status": "current_model_multisample_capacity_gradient_interference_gpu_diagnostic_completed", "population": {"train": 48, "validation": 8}, "classIdentityOrder": list(CLASSES), "sourceOrderPreserved": True, "conditionChannelCount": 23, "conditionChannelOrder": condition_order, "imageSize": {"width": 256, "height": 192}, "rolloutSteps": 50, "gradientTailSteps": 5, "rolloutWeight": rollout_weight, "sampleDiagnostics": rows, "capacityEvidence": capacity, "interferenceEvidence": interference, "stateHashes": {"denoiserBefore": denoiser_before, "denoiserAfter": denoiser_after, "denoiserUnchanged": denoiser_before == denoiser_after, "autoencoderBefore": autoencoder_before, "autoencoderAfter": autoencoder_after, "autoencoderUnchanged": autoencoder_before == autoencoder_after}, "safety": {"optimizerCreated": False, "backwardExecuted": False, "modelWeightsModified": False, "trainingStarted": False, "denoiserCheckpointRead": False, "failedCheckpointRead": False, "checkpointWritten": False}, "authorization": binding(authorization_path), "consumption": binding(consumption_path), "cuda": cuda, "durationSeconds": round(time.perf_counter() - started, 3), "recordedAtUtc": utc_now()}
    write_json_atomic(output / "gpu-report.json", report)
    write_json_atomic(output / "cuda-telemetry.json", {"schemaVersion": "stage4-multisample-capacity-gradient-interference-cuda-telemetry-v1", "status": "completed", **cuda, "durationSeconds": report["durationSeconds"], "recordedAtUtc": report["recordedAtUtc"]})
    write_json_atomic(output / "model-state-hashes.json", report["stateHashes"])
    print(json.dumps({"status": report["status"], "gpuReport": binding(output / "gpu-report.json"), "completed": 56}, ensure_ascii=False, indent=2))
    return 0


def interference_summary(by_class, by_sample):
    negative = 0; total = 0; minimum = 1.0; maximum = -1.0; per_class = {}
    for identity, values in by_class.items():
        class_negative = 0; class_total = 0; class_minimum = 1.0
        for left in range(len(values)):
            for right in range(left + 1, len(values)):
                cosine = cosine_value(values[left], values[right]); class_total += 1; total += 1
                minimum = min(minimum, cosine); maximum = max(maximum, cosine); class_minimum = min(class_minimum, cosine)
                if cosine < 0.0: class_negative += 1; negative += 1
        per_class[identity] = {"pairCount": class_total, "negativePairCount": class_negative, "minimumCosine": class_minimum}
    cross_negative = 0; cross_total = 0; cross_minimum = 1.0
    for values in by_sample.values():
        for left in range(len(CLASSES)):
            for right in range(left + 1, len(CLASSES)):
                cosine = cosine_value(values[CLASSES[left]], values[CLASSES[right]]); cross_total += 1; cross_minimum = min(cross_minimum, cosine)
                if cosine < 0.0: cross_negative += 1
    norms = {identity: sum(float(value.norm()) for value in values) for identity, values in by_class.items()}
    largest = max(norms, key=norms.get)
    return {"pairCount": total, "negativePairCount": negative, "minimumCosine": minimum, "maximumCosine": maximum, "perClass": per_class, "crossClassPairCount": cross_total, "crossClassNegativePairCount": cross_negative, "crossClassMinimumCosine": cross_minimum, "classGradientNormSums": norms, "singleClassStrictlyDominatesOthers": norms[largest] > sum(value for key, value in norms.items() if key != largest), "dominantClass": largest}


def capacity_summary(rows):
    representation_groups = {}; rgb_groups = {}
    for row in rows:
        representation_groups.setdefault(row["conditionRepresentationSha256"], []).append(row)
        rgb_groups.setdefault(row["finalRgbSha256"], []).append(row)
    representation_collisions = [group for group in representation_groups.values() if len({row["conditionTensorSha256"] for row in group}) > 1 and len({row["targetRgbSha256"] for row in group}) > 1]
    rgb_collisions = [group for group in rgb_groups.values() if len({row["conditionTensorSha256"] for row in group}) > 1 and len({row["targetRgbSha256"] for row in group}) > 1]
    return {"uniqueConditionTensorCount": len({row["conditionTensorSha256"] for row in rows}), "uniqueConditionRepresentationCount": len(representation_groups), "uniqueFinalRgbCount": len(rgb_groups), "exactConditionRepresentationCollisionCount": len(representation_collisions), "exactFinalRgbCollisionCount": len(rgb_collisions), "conditionRepresentationCollisionSampleIds": [[row["sampleId"] for row in group] for group in representation_collisions], "finalRgbCollisionSampleIds": [[row["sampleId"] for row in group] for group in rgb_collisions]}


def cosine_value(left, right):
    denominator = float(left.norm() * right.norm())
    if not math.isfinite(denominator) or denominator <= 0.0:
        raise ValueError("gradient_cosine_undefined")
    value = float(torch.dot(left, right) / denominator)
    if not math.isfinite(value): raise ValueError("gradient_cosine_nonfinite")
    return value


def resolve(value):
    if value is None or Path(value).is_absolute(): raise ValueError(f"project_relative_path_required:{value}")
    logical = Path(os.path.abspath(ROOT / Path(value))); root = Path(os.path.abspath(ROOT))
    if logical != root and root not in logical.parents: raise ValueError("project_path_escape")
    resolved = logical.resolve(); runtime = (ROOT / ".runtime").resolve()
    if resolved != root and root not in resolved.parents and not (resolved == runtime or runtime in resolved.parents): raise ValueError("unregistered_external_path")
    return resolved


def read_json(path): return json.loads(Path(path).read_text(encoding="utf-8"))
def utc_now(): return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
def sha256_file(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def tensor_sha256(value): return hashlib.sha256(value.detach().cpu().contiguous().numpy().tobytes()).hexdigest()
def state_sha256(module):
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()): digest.update(name.encode()); digest.update(value.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()
def project_path(value):
    resolved = Path(value).resolve(); runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents: return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()
def binding(value): return {"path": project_path(value), "sha256": sha256_file(value)}
def write_json_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True); temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp"); temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"); os.replace(temporary, path)


if __name__ == "__main__": raise SystemExit(main())

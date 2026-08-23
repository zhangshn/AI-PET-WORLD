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

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import build_complete_world_system


ROOT = Path.cwd()
EXPECTED_CHECKPOINT_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
EXPECTED_SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
CLASSES = ("footprints", "tree", "rock", "vegetation")
CHANNELS = tuple(f"object_{name}" for name in CLASSES)
REFERENCE_THRESHOLDS = {
    "footprints": {"maximumMaskedRgbMae": 0.18, "maximumMaskedEdgeMae": 0.12, "minimumMaskedLumaCorrelation": 0.08, "highFidelityFallbackMaximumRgbMae": 0.08, "highFidelityFallbackMaximumEdgeMae": 0.06},
    "tree": {"maximumMaskedRgbMae": 0.18, "maximumMaskedEdgeMae": 0.12, "minimumMaskedLumaCorrelation": 0.08, "highFidelityFallbackMaximumRgbMae": 0.08, "highFidelityFallbackMaximumEdgeMae": 0.06},
    "rock": {"maximumMaskedRgbMae": 0.20, "maximumMaskedEdgeMae": 0.12, "minimumMaskedLumaCorrelation": 0.08, "highFidelityFallbackMaximumRgbMae": 0.08, "highFidelityFallbackMaximumEdgeMae": 0.06},
    "vegetation": {"maximumMaskedRgbMae": 0.18, "maximumMaskedEdgeMae": 0.12, "minimumMaskedLumaCorrelation": 0.08, "highFidelityFallbackMaximumRgbMae": 0.08, "highFidelityFallbackMaximumEdgeMae": 0.06},
}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    authorization_path = project_file(args.authorization)
    consumption_path = project_file(args.consumption)
    output_dir = project_file(args.output_dir)
    if sha256_file(authorization_path) != args.authorization_sha256:
        raise ValueError("authorization_sha256_mismatch")
    authorization = read_json(authorization_path)
    validate_authorization(authorization, authorization_path, consumption_path, output_dir)
    if args.preflight_only:
        print(json.dumps(run_preflight(authorization, output_dir), ensure_ascii=False, indent=2))
        return 0
    consume(authorization, authorization_path, consumption_path)
    return run_gpu(authorization, authorization_path, consumption_path, output_dir)


def validate_authorization(authorization, authorization_path, consumption_path, output_dir):
    if authorization.get("schemaVersion") != "owner-authorized-stage4-frozen-autoencoder-semantic-retention-audit-v1":
        raise ValueError("authorization_schema_invalid")
    if authorization.get("status") != "resolved_owner_authorized_not_consumed":
        raise ValueError("authorization_status_invalid")
    if authorization.get("requestId") != authorization.get("commandRef"):
        raise ValueError("authorization_command_identity_invalid")
    if authorization.get("scope") != "one_readonly_gpu_frozen_autoencoder_semantic_retention_audit_across_64":
        raise ValueError("authorization_scope_invalid")
    if authorization.get("oneTimeConsumption") is not True:
        raise ValueError("one_time_consumption_required")
    if authorization.get("gpuAuthorized") is not True or authorization.get("checkpointWeightsReadAuthorized") is not True:
        raise ValueError("readonly_gpu_checkpoint_authority_missing")
    if authorization.get("optimizerAuthorized") is not False or authorization.get("backwardAuthorized") is not False or authorization.get("trainingAuthorized") is not False:
        raise ValueError("forbidden_training_authority_present")
    identity = authorization.get("taskIdentity", {})
    if identity.get("approvedRecordCount") != 64 or identity.get("splitCounts") != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}:
        raise ValueError("dataset_identity_invalid")
    if identity.get("objectClasses") != list(CLASSES):
        raise ValueError("class_identity_invalid")
    if identity.get("autoencoderCheckpointSha256") != EXPECTED_CHECKPOINT_SHA256:
        raise ValueError("checkpoint_identity_invalid")
    if project_file(identity.get("sourceIndexPath")) != project_file(authorization["bindings"]["sourceIndex"]["path"]):
        raise ValueError("source_index_path_identity_invalid")
    if authorization["bindings"]["sourceIndex"]["sha256"] != EXPECTED_SOURCE_INDEX_SHA256:
        raise ValueError("source_index_hash_identity_invalid")
    if project_file(authorization["execution"]["outputDirectory"]) != output_dir:
        raise ValueError("output_directory_identity_invalid")
    if project_file(authorization["execution"]["consumptionPath"]) != consumption_path:
        raise ValueError("consumption_path_identity_invalid")
    if authorization_path.parent != consumption_path.parent:
        raise ValueError("consumption_parent_identity_invalid")


def run_preflight(authorization, output_dir):
    identity = authorization["taskIdentity"]
    source_index_path = project_file(identity["sourceIndexPath"])
    config_path = project_file(identity["configPath"])
    checkpoint_path = project_file(identity["autoencoderCheckpointPath"])
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    if sha256_file(source_index_path) != EXPECTED_SOURCE_INDEX_SHA256:
        raise ValueError("source_index_sha256_mismatch")
    if sha256_file(config_path) != identity["configSha256"]:
        raise ValueError("config_sha256_mismatch")
    source_index = read_json(source_index_path)
    rows = source_index.get("v7CapacityContributions", [])
    if len(rows) != 64:
        raise ValueError("approved_record_count_mismatch")
    split_counts = {name: sum(row.get("split") == name for row in rows) for name in ("train", "validation", "challenge", "regression")}
    if split_counts != identity["splitCounts"]:
        raise ValueError("source_index_split_mismatch")
    if not checkpoint_path.is_file():
        raise ValueError("autoencoder_checkpoint_missing")
    if output_dir.exists():
        raise ValueError("output_directory_already_exists")
    disk_probe = output_dir.parent
    while not disk_probe.exists() and disk_probe != disk_probe.parent:
        disk_probe = disk_probe.parent
    free_bytes = shutil.disk_usage(disk_probe).free
    if free_bytes < 64 * 1024 * 1024:
        raise ValueError("insufficient_disk_for_audit_evidence")
    return {
        "schemaVersion": "stage4-frozen-autoencoder-semantic-retention-preflight-v1",
        "status": "passed_gpu_not_started_not_consumed",
        "python": os.sys.executable,
        "torchVersion": torch.__version__,
        "cudaAvailable": True,
        "cudaDevice": torch.cuda.get_device_name(0),
        "approvedRecordCount": len(rows),
        "splitCounts": split_counts,
        "checkpointExistsWithoutContentRead": True,
        "checkpointContentRead": False,
        "freeDiskBytes": free_bytes,
        "diskProbePath": project_path(disk_probe),
        "outputDirectoryAbsent": True,
    }


def consume(authorization, authorization_path, consumption_path):
    if consumption_path.exists():
        raise ValueError("authorization_already_consumed")
    consumption_path.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    value = {
        "schemaVersion": "stage4-frozen-autoencoder-semantic-retention-consumption-v1",
        "status": "readonly_gpu_authorization_atomically_consumed",
        "requestId": authorization["requestId"],
        "commandRef": authorization["commandRef"],
        "scope": authorization["scope"],
        "authorization": {"path": project_path(authorization_path), "sha256": sha256_file(authorization_path)},
        "oneTimeConsumption": True,
        "consumedAtUtc": now,
    }
    descriptor = os.open(consumption_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(descriptor, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run_gpu(authorization, authorization_path, consumption_path, output_dir):
    started = time.perf_counter()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(exist_ok=False)
    identity = authorization["taskIdentity"]
    checkpoint_path = project_file(identity["autoencoderCheckpointPath"])
    if sha256_file(checkpoint_path) != EXPECTED_CHECKPOINT_SHA256:
        raise ValueError("autoencoder_checkpoint_sha256_mismatch_after_consumption")
    config = read_json(project_file(identity["configPath"]))
    source_index = read_json(project_file(identity["sourceIndexPath"]))
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    if not isinstance(checkpoint.get("autoencoderState"), dict):
        raise ValueError("autoencoder_state_missing")
    device = torch.device("cuda")
    model = build_complete_world_system(config).to(device)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.eval()
    model.autoencoder.requires_grad_(False)
    state_before = state_sha256(model.autoencoder)
    rows = []
    latent_hashes = []
    source_rows = source_index["v7CapacityContributions"]
    with torch.inference_mode():
        for source_index_position, entry in enumerate(source_rows):
            contribution_path = project_file(entry["contributionPath"])
            if sha256_file(contribution_path) != entry["contributionSha256"]:
                raise ValueError(f"contribution_sha256_mismatch:{entry['sampleId']}")
            contribution = read_json(contribution_path)
            image_path = project_file(contribution["imagePath"])
            condition_pack_path = project_file(entry["conditionPackPath"])
            if sha256_file(image_path) != contribution["imageSha256"]:
                raise ValueError(f"reference_rgb_sha256_mismatch:{entry['sampleId']}")
            if sha256_file(condition_pack_path) != contribution["conditionPackFileSha256"]:
                raise ValueError(f"condition_pack_sha256_mismatch:{entry['sampleId']}")
            source = load_rgb(image_path, config).to(device)
            condition_pack = read_json(condition_pack_path)
            masks = {name: load_mask(condition_pack, f"object_{name}", config, device) for name in CLASSES}
            latent = model.autoencoder.encode(source)
            reconstructed = model.autoencoder.decode(latent).clamp(0.0, 1.0)
            latent_hash = tensor_sha256(latent)
            latent_hashes.append(latent_hash)
            source_features = unique_spatial_features_to_cpu(model.autoencoder, source)
            reconstructed_features = unique_spatial_features(model.autoencoder, reconstructed)
            if len(source_features) != len(reconstructed_features):
                raise ValueError("feature_stage_count_changed")
            feature_stages = []
            for stage_index, (source_feature_cpu, reconstructed_feature) in enumerate(zip(source_features, reconstructed_features)):
                source_feature = source_feature_cpu.to(device)
                feature_stages.append({
                    "stageIndex": stage_index,
                    "shape": list(reconstructed_feature.shape),
                    "mae": finite_float(torch.nn.functional.l1_loss(reconstructed_feature, source_feature)),
                    "finite": bool(torch.isfinite(reconstructed_feature).all() and torch.isfinite(source_feature).all()),
                })
                del source_feature
            class_metrics = []
            for name in CLASSES:
                mask = masks[name]
                response = masked_reference_response(reconstructed, source, mask)
                thresholds = REFERENCE_THRESHOLDS[name]
                normal_pass = response["maskedRgbMae"] <= thresholds["maximumMaskedRgbMae"] and response["maskedEdgeMae"] <= thresholds["maximumMaskedEdgeMae"] and response["maskedLumaCorrelation"] >= thresholds["minimumMaskedLumaCorrelation"]
                fallback_pass = response["maskedRgbMae"] <= thresholds["highFidelityFallbackMaximumRgbMae"] and response["maskedEdgeMae"] <= thresholds["highFidelityFallbackMaximumEdgeMae"]
                latent_mask = torch.nn.functional.interpolate(mask, size=latent.shape[-2:], mode="nearest")
                latent_occupancy = latent_mask.clamp(0.0, 1.0)
                latent_inside_support = latent_occupancy.sum(dim=(2, 3)).clamp_min(1.0)
                latent_outside_occupancy = 1.0 - latent_occupancy
                latent_outside_support = latent_outside_occupancy.sum(dim=(2, 3)).clamp_min(1.0)
                latent_inside_mean = (latent * latent_occupancy).sum(dim=(2, 3)) / latent_inside_support
                latent_outside_mean = (latent * latent_outside_occupancy).sum(dim=(2, 3)) / latent_outside_support
                latent_contrast = (latent_inside_mean - latent_outside_mean).abs().mean()
                class_feature_stages = []
                for stage_index, (source_feature_cpu, reconstructed_feature) in enumerate(zip(source_features, reconstructed_features)):
                    source_feature = source_feature_cpu.to(device)
                    stage_mask = torch.nn.functional.interpolate(mask, size=reconstructed_feature.shape[-2:], mode="nearest")
                    denominator = (stage_mask.sum() * reconstructed_feature.shape[1]).clamp_min(1.0)
                    class_feature_stages.append({"stageIndex": stage_index, "maskedFeatureMae": finite_float(((reconstructed_feature - source_feature).abs() * stage_mask).sum() / denominator), "maskSupport": finite_float(stage_mask.sum())})
                    del source_feature
                class_metrics.append({
                    "sampleId": entry["sampleId"],
                    "classIdentity": name,
                    "maskChannel": f"object_{name}",
                    "maskPixelCount": int(mask.sum().item()),
                    "referenceResponse": response,
                    "referenceThresholds": thresholds,
                    "referenceResponsePassed": bool(normal_pass or fallback_pass),
                    "normalRoutePassed": bool(normal_pass),
                    "highFidelityFallbackPassed": bool(fallback_pass),
                    "latentMaskContrast": finite_float(latent_contrast) if bool(torch.isfinite(latent_contrast)) else None,
                    "latentMaskContrastFiniteNonZero": bool(torch.isfinite(latent_contrast) and latent_contrast > torch.finfo(latent.dtype).eps),
                    "featureStages": class_feature_stages,
                    "metricsFinite": all(math.isfinite(value) for value in response.values()),
                })
            rows.append({
                "sourceIndex": source_index_position,
                "sampleId": entry["sampleId"],
                "capacitySlotId": entry["capacitySlotId"],
                "split": entry["split"],
                "referenceRgb": {"path": project_path(image_path), "sha256": contribution["imageSha256"]},
                "conditionPack": {"path": project_path(condition_pack_path), "sha256": contribution["conditionPackFileSha256"]},
                "latent": {"shape": list(latent.shape), "sha256": latent_hash, "finite": bool(torch.isfinite(latent).all()), "mean": finite_float(latent.mean()), "std": finite_float(latent.std())},
                "featureStages": feature_stages,
                "classMetrics": class_metrics,
            })
            del source, reconstructed, latent, reconstructed_features, source_features, masks
            torch.cuda.empty_cache()
            print(json.dumps({"status": "audit_progress", "completed": len(rows), "total": 64, "sampleId": entry["sampleId"]}), flush=True)
    state_after = state_sha256(model.autoencoder)
    split_counts = {name: sum(row["split"] == name for row in rows) for name in ("train", "validation", "challenge", "regression")}
    report = {
        "schemaVersion": "stage4-frozen-autoencoder-semantic-retention-gpu-report-v1",
        "status": "frozen_autoencoder_semantic_retention_gpu_audit_completed",
        "approvedRecordCount": len(rows),
        "splitCounts": split_counts,
        "sourceOrderPreserved": [row["sampleId"] for row in rows] == [row["sampleId"] for row in source_rows],
        "checkpointPath": project_path(checkpoint_path),
        "checkpointSha256": EXPECTED_CHECKPOINT_SHA256,
        "configPath": identity["configPath"],
        "configSha256": identity["configSha256"],
        "sourceIndexPath": identity["sourceIndexPath"],
        "sourceIndexSha256": EXPECTED_SOURCE_INDEX_SHA256,
        "device": {"type": "cuda", "name": torch.cuda.get_device_name(0), "torchVersion": torch.__version__, "peakAllocatedBytes": int(torch.cuda.max_memory_allocated())},
        "referenceThresholdSource": authorization["bindings"]["conditionAlignmentContract"],
        "referenceThresholdsChanged": False,
        "autoencoderFrozen": not any(parameter.requires_grad for parameter in model.autoencoder.parameters()),
        "autoencoderStateBeforeSha256": state_before,
        "autoencoderStateAfterSha256": state_after,
        "autoencoderStateUnchanged": state_before == state_after,
        "uniqueLatentHashCount": len(set(latent_hashes)),
        "rows": rows,
        "authorization": {"path": project_path(authorization_path), "sha256": sha256_file(authorization_path)},
        "consumption": {"path": project_path(consumption_path), "sha256": sha256_file(consumption_path)},
        "denoiserCheckpointRead": False,
        "failedCheckpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
        "failedPreviewUsedAsTarget": False,
        "reviewThresholdUsedAsTrainingTarget": False,
        "reviewResultUsedAsTrainingTarget": False,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    report_path = output_dir / "gpu-report.json"
    write_json_atomic(report_path, report)
    telemetry = {"schemaVersion": "stage4-frozen-autoencoder-semantic-retention-cuda-telemetry-v1", "status": "completed", "device": report["device"], "recordCount": len(rows), "classAuditCount": len(rows) * len(CLASSES), "durationSeconds": report["durationSeconds"], "recordedAtUtc": report["recordedAtUtc"]}
    write_json_atomic(output_dir / "cuda-telemetry.json", telemetry)
    write_json_atomic(output_dir / "model-state-hashes.json", {"schemaVersion": "stage4-autoencoder-state-hashes-v1", "autoencoderBeforeSha256": state_before, "autoencoderAfterSha256": state_after, "unchanged": state_before == state_after, "denoiserCheckpointRead": False})
    print(json.dumps({"status": report["status"], "gpuReport": {"path": project_path(report_path), "sha256": sha256_file(report_path)}, "completed": len(rows)}, ensure_ascii=False, indent=2))
    return 0


def unique_spatial_features(autoencoder, value):
    current = value
    ordered_shapes = []
    features = {}
    for module in autoencoder.encoder:
        current = module(current)
        shape = tuple(current.shape[-2:])
        if shape not in features:
            ordered_shapes.append(shape)
        features[shape] = current
    return tuple(features[shape] for shape in ordered_shapes)


def unique_spatial_features_to_cpu(autoencoder, value):
    return tuple(feature.detach().cpu() for feature in unique_spatial_features(autoencoder, value))


def masked_reference_response(candidate, reference, mask):
    denominator = (mask.sum() * 3.0).clamp_min(1.0)
    rgb_mae = ((candidate - reference).abs() * mask).sum() / denominator
    candidate_luma = candidate[:, 0:1] * 0.2126 + candidate[:, 1:2] * 0.7152 + candidate[:, 2:3] * 0.0722
    reference_luma = reference[:, 0:1] * 0.2126 + reference[:, 1:2] * 0.7152 + reference[:, 2:3] * 0.0722
    candidate_edge = (candidate_luma[:, :, :, 1:] - candidate_luma[:, :, :, :-1]).abs()
    reference_edge = (reference_luma[:, :, :, 1:] - reference_luma[:, :, :, :-1]).abs()
    edge_mask = mask[:, :, :, :-1]
    edge_mae = ((candidate_edge - reference_edge).abs() * edge_mask).sum() / edge_mask.sum().clamp_min(1.0)
    selected_candidate = candidate_luma[mask > 0.5]
    selected_reference = reference_luma[mask > 0.5]
    centered_candidate = selected_candidate - selected_candidate.mean()
    centered_reference = selected_reference - selected_reference.mean()
    correlation_denominator = torch.sqrt((centered_candidate.square().sum()) * (centered_reference.square().sum()))
    correlation = (centered_candidate * centered_reference).sum() / correlation_denominator if float(correlation_denominator) > 1e-9 else candidate.new_zeros(())
    return {"maskedRgbMae": finite_float(rgb_mae), "maskedEdgeMae": finite_float(edge_mae), "maskedLumaCorrelation": finite_float(correlation)}


def load_rgb(image_path, config):
    width, height = int(config["imageSize"]["width"]), int(config["imageSize"]["height"])
    with Image.open(image_path) as image:
        values = np.asarray(image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS), dtype=np.uint8).copy()
    return torch.from_numpy(values).permute(2, 0, 1).float().div(255.0).unsqueeze(0)


def load_mask(condition_pack, channel_id, config, device):
    channel = next((item for item in condition_pack["channels"] if item["id"] == channel_id), None)
    if channel is None:
        raise ValueError(f"condition_channel_missing:{channel_id}")
    channel_path = project_file(channel["path"])
    if sha256_file(channel_path) != channel["sha256"]:
        raise ValueError(f"condition_channel_sha256_mismatch:{channel_id}")
    width, height = int(config["imageSize"]["width"]), int(config["imageSize"]["height"])
    with Image.open(channel_path) as image:
        values = np.asarray(image.convert("L").resize((width, height), Image.Resampling.NEAREST), dtype=np.uint8).copy()
    result = torch.from_numpy(values).float().div(255.0).unsqueeze(0).unsqueeze(0).to(device)
    if float(result.sum()) <= 0.0:
        raise ValueError(f"empty_object_mask:{channel_id}")
    return result


def state_sha256(module):
    digest = hashlib.sha256()
    for name, tensor in sorted(module.state_dict().items()):
        digest.update(name.encode("utf-8"))
        digest.update(tensor.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def tensor_sha256(tensor):
    return hashlib.sha256(tensor.detach().cpu().contiguous().numpy().tobytes()).hexdigest()


def finite_float(value):
    result = float(value.detach().cpu() if isinstance(value, torch.Tensor) else value)
    if not math.isfinite(result):
        raise ValueError("nonfinite_metric")
    return result


def project_file(value):
    if value is None or Path(value).is_absolute():
        raise ValueError(f"project_relative_path_required:{value}")
    result = Path(os.path.abspath(ROOT / Path(value)))
    if os.path.commonpath([os.path.abspath(ROOT), os.path.abspath(result)]) != os.path.abspath(ROOT):
        raise ValueError(f"project_path_escape:{value}")
    return result


def project_path(value):
    return Path(os.path.relpath(os.path.abspath(value), os.path.abspath(ROOT))).as_posix()


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


if __name__ == "__main__":
    raise SystemExit(main())

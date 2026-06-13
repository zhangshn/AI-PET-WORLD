from __future__ import annotations

from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.dataset.migration_v1 import inspect_v1_sample
from ai_painter.dataset.v1_audit import audit_v1_sample
from ai_painter.dataset.v1_review import validate_v1_review_record

REQUIRED_SPLITS = ("train", "validation")
ENGINEERING_MIN_TRAINABLE = 20
ENGINEERING_MIN_VALIDATION = 2
FIRST_TRAINING_MIN_TRAINABLE = 100
IMPORTANT_CHANNELS = ("grass", "road_center", "walkable", "depth")


def build_v1_readiness_report(dataset_root: Path) -> dict[str, Any]:
    root = dataset_root.resolve()
    scene_root = root / "accepted" / "dataset_v0" / "scene" / "world"
    sample_dirs = sorted(path for path in scene_root.iterdir() if path.is_dir()) if scene_root.exists() else []
    samples = [_sample_report(path) for path in sample_dirs]
    trainable_ids = {item["sampleId"] for item in samples if item["trainable"]}
    indexes = _index_report(root, trainable_ids)
    samples = _attach_splits(samples, indexes)
    duplicates = _duplicate_target_report(samples)
    channel_summary = _channel_summary(samples)
    blockers = _collect_blockers(samples, indexes, duplicates)
    warnings = _collect_warnings(samples, channel_summary)
    readiness_status, readiness_reasons = _readiness_status(samples, indexes, channel_summary, blockers, duplicates)
    return {
        "schemaVersion": "blueprint-v1-training-readiness-report-v1",
        "readinessStatus": readiness_status,
        "readyForFirstTraining": readiness_status == "first_training_ready",
        "engineeringValidationReady": readiness_status in {"engineering_validation_ready", "first_training_ready"},
        "sampleCount": len(samples),
        "statusCounts": dict(Counter(str(item["status"]) for item in samples)),
        "trainableSampleCount": len(trainable_ids),
        "blockedSampleCount": sum(1 for item in samples if item["blockingReasons"]),
        "lowQualityTargets": [item["sampleId"] for item in samples if any("contrast" in reason for reason in item["target"]["blockingReasons"])],
        "splits": indexes,
        "channelSummary": channel_summary,
        "duplicateTargets": duplicates,
        "warnings": warnings,
        "blockers": blockers,
        "readinessReasons": readiness_reasons,
        "samples": samples,
    }


def _sample_report(sample_dir: Path) -> dict[str, Any]:
    status = inspect_v1_sample(sample_dir)
    audit = audit_v1_sample(sample_dir)
    reasons = list(audit["blockingReasons"])
    for error in validate_v1_review_record(sample_dir):
        if error not in reasons:
            reasons.append(error)
    target = _target_report(sample_dir / "target.png")
    reasons.extend(target["blockingReasons"])
    masks = _mask_reports(sample_dir)
    for item in masks.values():
        reasons.extend(item["blockingReasons"])
    return {
        "sampleId": sample_dir.name,
        "status": status["status"],
        "pendingReviewStructures": status.get("pendingReviewStructures", 0),
        "trainable": len(reasons) == 0,
        "split": None,
        "blockingReasons": reasons,
        "warnings": _sample_warnings(sample_dir),
        "target": target,
        "masks": masks,
    }


def _sample_warnings(sample_dir: Path) -> list[str]:
    warnings: list[str] = []
    metadata_path = sample_dir / "metadata.json"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return warnings
    source = metadata.get("source", {})
    review = metadata.get("review", {})
    if isinstance(source, dict) and not source.get("licenseBasis"):
        warnings.append("source licenseBasis is missing")
    if isinstance(review, dict) and not review.get("rightsApproved"):
        warnings.append("rightsApproved is not true")
    return warnings


def _target_report(path: Path) -> dict[str, Any]:
    reasons: list[str] = []
    if not path.is_file():
        return {"exists": False, "sha256": None, "mode": None, "size": None, "sharpness": 0.0, "blockingReasons": ["target.png is missing"]}
    try:
        with Image.open(path) as image:
            converted = image.convert("L")
            sharpness = float(ImageStat.Stat(converted).stddev[0])
            if image.mode != "RGB":
                reasons.append("target.png must be RGB")
            if image.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
                reasons.append("target.png size must be 256x192")
            if sharpness < 4.0:
                reasons.append("target.png contrast is too low for training readiness")
            return {"exists": True, "sha256": _sha256_file(path), "mode": image.mode, "size": list(image.size), "sharpness": sharpness, "blockingReasons": reasons}
    except OSError as error:
        return {"exists": True, "sha256": None, "mode": None, "size": None, "sharpness": 0.0, "blockingReasons": [f"target.png is invalid: {error}"]}


def _mask_reports(sample_dir: Path) -> dict[str, dict[str, Any]]:
    reports: dict[str, dict[str, Any]] = {}
    mask_root = sample_dir / "masks_v1"
    actual = {path.stem for path in mask_root.glob("*.png")} if mask_root.is_dir() else set()
    for name in sorted(actual - set(V1_CONDITION_CHANNELS)):
        reports[name] = {"exists": True, "knownChannel": False, "blockingReasons": [f"unknown mask channel: {name}"]}
    for name in V1_CONDITION_CHANNELS:
        reports[name] = _mask_report(mask_root / f"{name}.png", name)
    return reports


def _mask_report(path: Path, name: str) -> dict[str, Any]:
    reasons: list[str] = []
    if not path.is_file():
        return {"exists": False, "knownChannel": True, "sha256": None, "mode": None, "size": None, "nonZeroPixels": 0, "blockingReasons": [f"missing masks_v1/{name}.png"]}
    try:
        with Image.open(path) as image:
            if image.mode != "L":
                reasons.append(f"mask must be grayscale: {name}")
            if image.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
                reasons.append(f"mask size must be 256x192: {name}")
            histogram = image.convert("L").histogram()
            non_zero = sum(histogram[1:])
            return {"exists": True, "knownChannel": True, "sha256": _sha256_file(path), "mode": image.mode, "size": list(image.size), "nonZeroPixels": int(non_zero), "blockingReasons": reasons}
    except OSError as error:
        return {"exists": True, "knownChannel": True, "sha256": None, "mode": None, "size": None, "nonZeroPixels": 0, "blockingReasons": [f"invalid mask file: {name}: {error}"]}


def _index_report(root: Path, trainable_ids: set[str]) -> dict[str, Any]:
    splits: dict[str, Any] = {}
    assigned: dict[str, list[str]] = defaultdict(list)
    for split in REQUIRED_SPLITS:
        path = root / "indexes" / f"{split}.json"
        sample_ids, errors = _read_index(path, split)
        for sample_id in sample_ids:
            assigned[sample_id].append(split)
        splits[split] = {"exists": path.is_file(), "count": len(sample_ids), "sampleIds": sample_ids, "blockingReasons": errors}
    for sample_id, values in sorted(assigned.items()):
        if len(values) > 1:
            for split in values:
                splits[split]["blockingReasons"].append(f"sample appears in multiple splits: {sample_id}")
    assigned_ids = set(assigned)
    for sample_id in sorted(assigned_ids - trainable_ids):
        for split in assigned[sample_id]:
            splits[split]["blockingReasons"].append(f"split references non-trainable sample: {sample_id}")
    return {"requiredSplits": list(REQUIRED_SPLITS), "splits": splits, "omittedTrainableSampleIds": sorted(trainable_ids - assigned_ids)}


def _read_index(path: Path, split: str) -> tuple[list[str], list[str]]:
    if not path.is_file():
        return [], [f"missing {split}.json"]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [], [f"invalid {split}.json: {error}"]
    values = data.get("sampleIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        return [], [f"{split}.json sampleIds must be an array of strings"]
    errors: list[str] = []
    if data.get("count") != len(values):
        errors.append(f"{split}.json count does not match sampleIds")
    if len(set(values)) != len(values):
        errors.append(f"{split}.json contains duplicate sampleIds")
    if not values:
        errors.append(f"{split}.json is empty")
    return values, errors


def _attach_splits(samples: list[dict[str, Any]], indexes: dict[str, Any]) -> list[dict[str, Any]]:
    split_by_sample: dict[str, str] = {}
    for split, item in indexes["splits"].items():
        for sample_id in item["sampleIds"]:
            split_by_sample[sample_id] = split
    return [{**item, "split": split_by_sample.get(str(item["sampleId"]))} for item in samples]


def _duplicate_target_report(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for item in samples:
        value = item["target"].get("sha256")
        if isinstance(value, str):
            grouped[value].append(str(item["sampleId"]))
    return [{"sha256": key, "sampleIds": value} for key, value in sorted(grouped.items()) if len(value) > 1]


def _channel_summary(samples: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for name in V1_CONDITION_CHANNELS:
        values = [int(item["masks"][name]["nonZeroPixels"]) for item in samples if name in item["masks"]]
        non_empty = [value for value in values if value > 0]
        total = len(values)
        summary[name] = {
            "samples": total,
            "nonEmptySamples": len(non_empty),
            "emptySamples": total - len(non_empty),
            "minNonZeroPixels": min(non_empty) if non_empty else 0,
            "maxNonZeroPixels": max(non_empty) if non_empty else 0,
            "averageNonZeroPixels": round(sum(values) / total, 2) if total else 0.0,
            "coverageRatio": round(len(non_empty) / total, 4) if total else 0.0,
        }
    return summary


def _collect_blockers(samples: list[dict[str, Any]], indexes: dict[str, Any], duplicates: list[dict[str, Any]]) -> list[str]:
    blockers: list[str] = []
    if not samples:
        blockers.append("no accepted scene samples found")
    if not any(item["trainable"] for item in samples):
        blockers.append("no trainable v1 samples found")
    for item in samples:
        for reason in item["blockingReasons"]:
            blockers.append(f"{item['sampleId']}: {reason}")
    for split, item in indexes["splits"].items():
        for reason in item["blockingReasons"]:
            blockers.append(f"{split}: {reason}")
    for sample_id in indexes["omittedTrainableSampleIds"]:
        blockers.append(f"trainable sample omitted from indexes: {sample_id}")
    for item in duplicates:
        blockers.append(f"duplicate target image: {', '.join(item['sampleIds'])}")
    return blockers


def _collect_warnings(samples: list[dict[str, Any]], channel_summary: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    for name, item in channel_summary.items():
        if samples and item["emptySamples"] == len(samples):
            warnings.append(f"channel has no positive pixels in all samples: {name}")
    for item in samples:
        for warning in item["warnings"]:
            warnings.append(f"{item['sampleId']}: {warning}")
    return warnings


def _readiness_status(samples: list[dict[str, Any]], indexes: dict[str, Any], channel_summary: dict[str, Any], blockers: list[str], duplicates: list[dict[str, Any]]) -> tuple[str, list[str]]:
    trainable = sum(1 for item in samples if item["trainable"])
    validation_count = int(indexes["splits"]["validation"]["count"])
    reasons: list[str] = []
    if blockers:
        reasons.append("存在数据完整性或索引阻断项")
        return "not_ready", reasons
    if trainable < ENGINEERING_MIN_TRAINABLE:
        reasons.append(f"可训练样本不足 {ENGINEERING_MIN_TRAINABLE} 张")
        return "not_ready", reasons
    if validation_count < ENGINEERING_MIN_VALIDATION:
        reasons.append(f"validation 样本不足 {ENGINEERING_MIN_VALIDATION} 张")
        return "not_ready", reasons
    for channel in IMPORTANT_CHANNELS:
        if channel_summary[channel]["nonEmptySamples"] == 0:
            reasons.append(f"关键通道缺少覆盖：{channel}")
    if duplicates:
        reasons.append("存在重复 target 图片")
    if reasons:
        return "not_ready", reasons
    if trainable < FIRST_TRAINING_MIN_TRAINABLE:
        return "engineering_validation_ready", [f"尚未达到正式训练最低 {FIRST_TRAINING_MIN_TRAINABLE} 张"]
    return "first_training_ready", []


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()

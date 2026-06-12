from __future__ import annotations

from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.dataset.v1_audit import audit_v1_sample
from ai_painter.dataset.v1_review import validate_v1_review_record

REQUIRED_SPLITS = ("train", "validation")


def build_v1_readiness_report(dataset_root: Path) -> dict[str, Any]:
    root = dataset_root.resolve()
    scene_root = root / "accepted" / "dataset_v0" / "scene" / "world"
    sample_dirs = sorted(path for path in scene_root.iterdir() if path.is_dir()) if scene_root.exists() else []
    samples = [_sample_report(path) for path in sample_dirs]
    indexes = _index_report(root, {item["sampleId"] for item in samples if item["trainable"]})
    duplicates = _duplicate_target_report(samples)
    channel_summary = _channel_summary(samples)
    blockers = _collect_blockers(samples, indexes, duplicates)
    warnings = _collect_warnings(samples, channel_summary)
    return {
        "schemaVersion": "blueprint-v1-training-readiness-report-v0",
        "readyForFirstTraining": len(blockers) == 0,
        "sampleCount": len(samples),
        "trainableSampleCount": sum(1 for item in samples if item["trainable"]),
        "blockedSampleCount": sum(1 for item in samples if item["blockingReasons"]),
        "splits": indexes,
        "channelSummary": channel_summary,
        "duplicateTargets": duplicates,
        "warnings": warnings,
        "blockers": blockers,
        "samples": samples,
    }


def _sample_report(sample_dir: Path) -> dict[str, Any]:
    audit = audit_v1_sample(sample_dir)
    reasons = list(audit["blockingReasons"])
    review_errors = validate_v1_review_record(sample_dir)
    for error in review_errors:
        if error not in reasons:
            reasons.append(error)
    target = _target_report(sample_dir / "target.png")
    reasons.extend(target["blockingReasons"])
    masks = _mask_reports(sample_dir)
    for item in masks.values():
        reasons.extend(item["blockingReasons"])
    return {
        "sampleId": sample_dir.name,
        "trainable": len(reasons) == 0,
        "blockingReasons": reasons,
        "target": target,
        "masks": masks,
    }


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
        path = mask_root / f"{name}.png"
        reports[name] = _mask_report(path, name)
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
    omitted = sorted(trainable_ids - assigned_ids)
    return {"requiredSplits": list(REQUIRED_SPLITS), "splits": splits, "omittedTrainableSampleIds": omitted}


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
        summary[name] = {"samples": len(values), "emptySamples": sum(1 for value in values if value == 0), "minNonZeroPixels": min(values) if values else 0, "maxNonZeroPixels": max(values) if values else 0}
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
    return warnings


def _sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()

from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT
MIN_MVP_SAMPLE_COUNT = 50
MIN_EXPERIMENT_SAMPLE_COUNT = 12

FORBIDDEN_CHANNELS = (
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
)

CORE_CHANNELS = (
    "grass",
    "walkable",
    "depth",
)

CONFLICT_PAIRS = (
    ("water_body", "road_center"),
    ("water_body", "road_edge"),
    ("water_body", "tree_crown"),
    ("water_body", "tree_trunk"),
    ("water_body", "rock"),
    ("road_center", "tree_crown"),
    ("road_center", "rock"),
)

VARIETY_CHANNELS = (
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_crown",
    "rock",
)

OPTIONAL_VARIETY_CHANNELS = (
    "tree_trunk",
)


def main() -> int:
    parser = ArgumentParser(description="Report natural-home dataset quality for local AI Painter training.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    dataset_root = args.dataset_root.resolve()
    output_root = args.output_root.resolve()
    samples = load_sample_ids(dataset_root)
    sample_reports = [inspect_sample(dataset_root, sample_id) for sample_id in samples]
    report = build_report(samples, sample_reports)

    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def load_sample_ids(dataset_root: Path) -> list[str]:
    manifest_path = dataset_root / "dataset-manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        values = manifest.get("sampleIds")
        if isinstance(values, list) and all(isinstance(value, str) for value in values):
            return values
    scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    return sorted(path.name for path in scene_root.iterdir() if path.is_dir())


def inspect_sample(dataset_root: Path, sample_id: str) -> dict[str, object]:
    sample_dir = dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    mask_dir = sample_dir / "masks_v1"
    target_metrics = inspect_target_image(sample_dir / "target.png")
    masks = {name: load_mask(mask_dir / f"{name}.png") for name in V1_CONDITION_CHANNELS}
    coverage = {name: round(float(mask.mean()), 6) for name, mask in masks.items()}
    conflict_pixels = {
        f"{left}+{right}": int(np.logical_and(masks[left], masks[right]).sum())
        for left, right in CONFLICT_PAIRS
    }
    forbidden_pixels = {name: int(masks[name].sum()) for name in FORBIDDEN_CHANNELS}
    missing_core = [name for name in CORE_CHANNELS if coverage[name] <= 0.001]
    warnings = build_sample_warnings(coverage, conflict_pixels, forbidden_pixels, missing_core, target_metrics)
    return {
        "sampleId": sample_id,
        "targetMetrics": target_metrics,
        "coverage": coverage,
        "forbiddenPixels": forbidden_pixels,
        "conflictPixels": conflict_pixels,
        "missingCoreChannels": missing_core,
        "status": "pass" if not warnings else "needs_attention",
        "warnings": warnings,
    }


def load_mask(path: Path) -> np.ndarray:
    if not path.exists():
        return np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.bool_)
    with Image.open(path) as image:
        normalized = image.convert("L")
        if normalized.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
            raise ValueError(f"mask must be 256x192: {path}")
        return np.asarray(normalized, dtype=np.uint8) > 127


def inspect_target_image(path: Path) -> dict[str, float | str]:
    if not path.exists():
        return {
            "status": "missing",
            "contrast": 0.0,
            "edgeDensity": 0.0,
            "laplacianVariance": 0.0,
            "colorRangeMean": 0.0,
            "uniqueColorRatio": 0.0,
            "brightness": 0.0,
        }
    with Image.open(path) as image:
        rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    gray = rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114
    gx = np.diff(gray, axis=1, append=gray[:, -1:])
    gy = np.diff(gray, axis=0, append=gray[-1:, :])
    gradient = np.sqrt(gx * gx + gy * gy)
    laplacian = (
        -4.0 * gray
        + np.roll(gray, 1, axis=0)
        + np.roll(gray, -1, axis=0)
        + np.roll(gray, 1, axis=1)
        + np.roll(gray, -1, axis=1)
    )
    channel_ranges = rgb.reshape(-1, 3).max(axis=0) - rgb.reshape(-1, 3).min(axis=0)
    unique_colors = np.unique((rgb * 255.0).round().astype(np.uint8).reshape(-1, 3), axis=0).shape[0]
    return {
        "status": "ok",
        "contrast": round(float(np.std(gray)), 6),
        "edgeDensity": round(float(np.mean(gradient > 0.08)), 6),
        "laplacianVariance": round(float(np.var(laplacian)), 6),
        "colorRangeMean": round(float(np.mean(channel_ranges)), 6),
        "uniqueColorRatio": round(float(unique_colors / TOTAL_PIXELS), 6),
        "brightness": round(float(np.mean(gray)), 6),
    }


def build_sample_warnings(
    coverage: dict[str, float],
    conflict_pixels: dict[str, int],
    forbidden_pixels: dict[str, int],
    missing_core: list[str],
    target_metrics: dict[str, float | str],
) -> list[str]:
    warnings: list[str] = []
    if target_metrics["status"] != "ok":
        warnings.append("target_missing")
    if missing_core:
        warnings.append("missing_core_channel")
    if any(value > 0 for value in forbidden_pixels.values()):
        warnings.append("forbidden_channel_not_empty")
    if any(value > TOTAL_PIXELS * 0.01 for value in conflict_pixels.values()):
        warnings.append("channel_conflict_too_high")
    if coverage["grass"] < 0.18 and coverage["water_body"] < 0.5:
        warnings.append("grass_coverage_too_low")
    if coverage["tree_crown"] > 0.75:
        warnings.append("tree_crown_coverage_too_high")
    if coverage["water_body"] > 0.01 and coverage["shoreline"] <= 0.001:
        warnings.append("water_without_shoreline")
    if float(target_metrics["laplacianVariance"]) < 0.0028:
        warnings.append("target_too_blurry")
    if float(target_metrics["edgeDensity"]) < 0.18:
        warnings.append("target_edge_density_too_low")
    if float(target_metrics["contrast"]) < 0.105:
        warnings.append("target_contrast_too_low")
    if float(target_metrics["colorRangeMean"]) < 0.45:
        warnings.append("target_color_range_too_low")
    if float(target_metrics["uniqueColorRatio"]) < 0.18:
        warnings.append("target_pixel_detail_density_too_low")
    return warnings


def build_report(sample_ids: list[str], sample_reports: list[dict[str, object]]) -> dict[str, object]:
    sample_count = len(sample_ids)
    channel_sample_counts = {
        name: sum(1 for sample in sample_reports if float(sample["coverage"][name]) > 0.001)
        for name in V1_CONDITION_CHANNELS
    }
    blocked_samples = [sample["sampleId"] for sample in sample_reports if sample["status"] != "pass"]
    warning_counts = build_warning_counts(sample_reports)
    image_quality_blocked_samples = [
        sample["sampleId"]
        for sample in sample_reports
        if any(str(warning).startswith("target_") for warning in sample["warnings"])
    ]
    forbidden_total = sum(
        int(value)
        for sample in sample_reports
        for value in sample["forbiddenPixels"].values()
    )
    conflict_total = sum(
        int(value)
        for sample in sample_reports
        for value in sample["conflictPixels"].values()
    )
    missing_variety = [
        name for name in VARIETY_CHANNELS
        if channel_sample_counts[name] < required_variety_count(sample_count, name)
    ]
    optional_low_variety = [
        name for name in OPTIONAL_VARIETY_CHANNELS
        if channel_sample_counts[name] < required_optional_variety_count(sample_count, name)
    ]
    no_blocked_samples = not blocked_samples
    can_train_experiment = (
        sample_count >= MIN_EXPERIMENT_SAMPLE_COUNT
        and no_blocked_samples
        and forbidden_total == 0
    )
    can_train_mvp_v1 = (
        sample_count >= MIN_MVP_SAMPLE_COUNT
        and no_blocked_samples
        and not missing_variety
        and forbidden_total == 0
        and conflict_total <= TOTAL_PIXELS * sample_count * 0.03
    )
    next_actions = build_next_actions(sample_count, blocked_samples, missing_variety)
    return {
        "schemaVersion": "natural-home-quality-report-v1",
        "stageId": "natural-home-v1-no-building",
        "sampleCount": sample_count,
        "minimumExperimentSampleCount": MIN_EXPERIMENT_SAMPLE_COUNT,
        "minimumMvpSampleCount": MIN_MVP_SAMPLE_COUNT,
        "channelSampleCounts": channel_sample_counts,
        "blockedSampleCount": len(blocked_samples),
        "blockedSamples": blocked_samples,
        "imageQualityBlockedSampleCount": len(image_quality_blocked_samples),
        "imageQualityBlockedSamples": image_quality_blocked_samples,
        "warningCounts": warning_counts,
        "missingVarietyChannels": missing_variety,
        "optionalLowVarietyChannels": optional_low_variety,
        "forbiddenPixelTotal": forbidden_total,
        "conflictPixelTotal": conflict_total,
        "canTrainExperiment": can_train_experiment,
        "canTrainMvpV1": can_train_mvp_v1,
        "status": "mvp_ready" if can_train_mvp_v1 else "experiment_only" if can_train_experiment else "blocked",
        "nextActions": next_actions,
        "samples": sample_reports,
    }


def required_variety_count(sample_count: int, channel: str) -> int:
    if sample_count < MIN_MVP_SAMPLE_COUNT:
        if channel == "tree_trunk":
            return 0
        return 1
    if channel in {"water_body", "shoreline", "road_center", "road_edge"}:
        return max(8, sample_count // 4)
    return max(15, sample_count // 2)


def required_optional_variety_count(sample_count: int, channel: str) -> int:
    if channel == "tree_trunk":
        return max(8, sample_count // 5)
    return 1


def build_warning_counts(sample_reports: list[dict[str, object]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for sample in sample_reports:
        for warning in sample["warnings"]:
            key = str(warning)
            counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def build_next_actions(sample_count: int, blocked_samples: list[object], missing_variety: list[str]) -> list[str]:
    actions: list[str] = []
    if sample_count < MIN_MVP_SAMPLE_COUNT:
        actions.append("add_more_natural_home_training_png")
    if blocked_samples:
        actions.append("improve_or_quarantine_blocked_samples")
    if missing_variety:
        actions.append("add_missing_channel_variety")
    if not actions:
        actions.append("train_natural_home_mvp_v1")
    return actions


if __name__ == "__main__":
    raise SystemExit(main())

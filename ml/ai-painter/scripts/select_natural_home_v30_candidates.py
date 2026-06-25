from __future__ import annotations

from argparse import ArgumentParser
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


def main() -> int:
    parser = ArgumentParser(description="Select V30 natural-home candidates with automatic local quality metrics.")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v29-diverse-source-refiner-generation/latest.json"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v30-quality-selection"),
    )
    parser.add_argument("--min-pass-score", type=float, default=72.0)
    parser.add_argument("--min-candidate-score", type=float, default=62.0)
    args = parser.parse_args()

    manifest = read_json(args.manifest)
    rows = manifest.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"manifest has no rows: {args.manifest}")

    args.output_root.mkdir(parents=True, exist_ok=True)
    evaluated = [
        evaluate_row(row, args.min_pass_score, args.min_candidate_score)
        for row in rows
        if isinstance(row, dict)
    ]
    evaluated.sort(key=lambda row: (-float(row["score"]), str(row["sampleId"])))

    report = {
        "schemaVersion": "natural-home-v30-quality-selection-v1",
        "status": build_report_status(evaluated),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "training_candidate_quality_selection_only",
        "sourceManifest": str(args.manifest.resolve()),
        "sourceStageId": manifest.get("stageId"),
        "sourceTrainingVersion": manifest.get("trainingVersion"),
        "sourceModelVersion": manifest.get("modelVersion"),
        "selectionStrategy": manifest.get("selectionStrategy"),
        "thresholds": {
            "minPassScore": args.min_pass_score,
            "minCandidateScore": args.min_candidate_score,
            "hardFailureBlocksPass": True,
        },
        "summary": summarize(evaluated),
        "contactSheet": str((args.output_root / "contact-sheet.png").resolve()),
        "rows": evaluated,
        "note": "Automatic training-quality selection only. It is not VisualJudge approval and never enters /world.",
    }

    write_json(args.output_root / "selection-report.json", report)
    write_json(args.output_root / "latest.json", report)
    build_contact_sheet(evaluated, args.output_root / "contact-sheet.png")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def evaluate_row(row: dict[str, Any], min_pass_score: float, min_candidate_score: float) -> dict[str, Any]:
    generated_path = Path(str(row["generated"]))
    target_path = Path(str(row["target"]))
    blueprint_path = Path(str(row["blueprint"]))
    sample_dir = blueprint_path.parent

    generated = load_rgb(generated_path)
    target = load_rgb(target_path)
    if generated.shape != target.shape:
        raise ValueError(f"image size mismatch: {row.get('sampleId')}")

    masks = load_masks(sample_dir / "masks_v1")
    generated_metrics = image_metrics(generated)
    target_metrics = image_metrics(target)
    comparison = comparison_metrics(generated, target)
    mask_metrics = condition_metrics(generated, target, masks)

    ratios = {
        "sharpnessRatio": safe_ratio(generated_metrics["laplacianVariance"], target_metrics["laplacianVariance"]),
        "edgeDensityRatio": safe_ratio(generated_metrics["edgeDensity"], target_metrics["edgeDensity"]),
        "colorRangeRatio": safe_ratio(generated_metrics["colorRangeMean"], target_metrics["colorRangeMean"]),
        "contrastRatio": safe_ratio(generated_metrics["contrast"], target_metrics["contrast"]),
        "uniqueColorRatio": safe_ratio(generated_metrics["uniqueColorRatio"], target_metrics["uniqueColorRatio"]),
        "maskBoundaryGradientRatio": mask_metrics["boundaryGradientRatio"],
        "maskInteriorVariationRatio": mask_metrics["interiorVariationRatio"],
    }

    failures = diagnose_failures(comparison, ratios, mask_metrics)
    score = score_candidate(comparison, ratios, mask_metrics)
    has_hard_failure = any(failure["severity"] == "high" for failure in failures)
    if score >= min_pass_score and not has_hard_failure:
        status = "passed_for_next_training"
    elif score >= min_candidate_score and not has_hard_failure:
        status = "review_candidate"
    else:
        status = "rejected_training_candidate"

    return {
        "sampleId": row.get("sampleId"),
        "status": status,
        "score": round_float(score),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "blueprint": str(blueprint_path.resolve()),
        "sourceSha256": row.get("sha256"),
        "metrics": {
            "generated": generated_metrics,
            "target": target_metrics,
            "comparison": comparison,
            "ratios": ratios,
            "condition": mask_metrics,
        },
        "failures": failures,
        "decisionNote": decision_note(status),
    }


def load_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        return np.array(image.convert("RGB"), dtype=np.float32) / 255.0


def load_masks(mask_root: Path) -> dict[str, np.ndarray]:
    masks: dict[str, np.ndarray] = {}
    for channel in V1_CONDITION_CHANNELS:
        with Image.open(mask_root / f"{channel}.png") as image:
            masks[channel] = np.array(image.convert("L"), dtype=np.float32) / 255.0
    return masks


def to_gray(rgb: np.ndarray) -> np.ndarray:
    return rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114


def image_metrics(rgb: np.ndarray) -> dict[str, float]:
    gray = to_gray(rgb)
    gradient = gradient_map(gray)
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
        "laplacianVariance": round_float(float(np.var(laplacian))),
        "edgeDensity": round_float(float(np.mean(gradient > 0.08))),
        "meanGradient": round_float(float(np.mean(gradient))),
        "colorRangeMean": round_float(float(np.mean(channel_ranges))),
        "uniqueColorRatio": round_float(float(unique_colors / (rgb.shape[0] * rgb.shape[1]))),
        "brightness": round_float(float(np.mean(gray))),
        "contrast": round_float(float(np.std(gray))),
    }


def gradient_map(gray: np.ndarray) -> np.ndarray:
    gx = np.diff(gray, axis=1, append=gray[:, -1:])
    gy = np.diff(gray, axis=0, append=gray[-1:, :])
    return np.sqrt(gx * gx + gy * gy)


def comparison_metrics(generated: np.ndarray, target: np.ndarray) -> dict[str, float]:
    diff = generated - target
    mse = float(np.mean(diff * diff))
    mae = float(np.mean(np.abs(diff)))
    psnr = 99.0 if mse <= 1e-12 else float(20.0 * np.log10(1.0 / np.sqrt(mse)))
    return {
        "mse": round_float(mse),
        "mae": round_float(mae),
        "psnr": round_float(psnr),
    }


def condition_metrics(generated: np.ndarray, target: np.ndarray, masks: dict[str, np.ndarray]) -> dict[str, Any]:
    generated_gradient = gradient_map(to_gray(generated))
    target_gradient = gradient_map(to_gray(target))
    active_channels = [name for name, mask in masks.items() if float(np.mean(mask > 0.1)) > 0.0005]
    boundary_values_generated: list[float] = []
    boundary_values_target: list[float] = []
    interior_ratios: list[float] = []
    active_areas: dict[str, float] = {}
    for channel in active_channels:
        mask = masks[channel] > 0.1
        active_areas[channel] = round_float(float(np.mean(mask)))
        boundary = mask_boundary(mask)
        if np.any(boundary):
            boundary_values_generated.append(float(np.mean(generated_gradient[boundary])))
            boundary_values_target.append(float(np.mean(target_gradient[boundary])))
        if np.any(mask):
            generated_region = generated[mask]
            target_region = target[mask]
            interior_ratios.append(safe_ratio(float(np.std(generated_region)), float(np.std(target_region))))

    boundary_generated = float(np.mean(boundary_values_generated)) if boundary_values_generated else 0.0
    boundary_target = float(np.mean(boundary_values_target)) if boundary_values_target else 0.0
    water_artifact = periodic_artifact_metrics(generated, target, masks.get("water_body"))
    return {
        "activeChannelCount": len(active_channels),
        "activeChannels": active_channels,
        "activeAreas": active_areas,
        "boundaryGradient": round_float(boundary_generated),
        "targetBoundaryGradient": round_float(boundary_target),
        "boundaryGradientRatio": safe_ratio(boundary_generated, boundary_target),
        "interiorVariationRatio": round_float(float(np.mean(interior_ratios)) if interior_ratios else 0.0),
        "waterPeriodicArtifactRatio": water_artifact["generatedRatio"],
        "targetWaterPeriodicArtifactRatio": water_artifact["targetRatio"],
        "waterPeriodicArtifactDelta": water_artifact["delta"],
    }


def mask_boundary(mask: np.ndarray) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255)
    expanded = np.array(image.filter(ImageFilter.MaxFilter(3)), dtype=np.uint8) > 0
    eroded = np.array(image.filter(ImageFilter.MinFilter(3)), dtype=np.uint8) > 0
    return expanded != eroded


def periodic_artifact_metrics(generated: np.ndarray, target: np.ndarray, mask: np.ndarray | None) -> dict[str, float]:
    if mask is None:
        return {"generatedRatio": 0.0, "targetRatio": 0.0, "delta": 0.0}
    region = mask > 0.1
    if float(np.mean(region)) < 0.005:
        return {"generatedRatio": 0.0, "targetRatio": 0.0, "delta": 0.0}
    generated_ratio = periodic_artifact_ratio(to_gray(generated), region)
    target_ratio = periodic_artifact_ratio(to_gray(target), region)
    return {
        "generatedRatio": round_float(generated_ratio),
        "targetRatio": round_float(target_ratio),
        "delta": round_float(max(0.0, generated_ratio - target_ratio)),
    }


def periodic_artifact_ratio(gray: np.ndarray, mask: np.ndarray) -> float:
    dx = np.abs(np.diff(gray, axis=1))
    dy = np.abs(np.diff(gray, axis=0))
    mask_x = mask[:, :-1] & mask[:, 1:]
    mask_y = mask[:-1, :] & mask[1:, :]
    if int(mask_x.sum()) < 64 or int(mask_y.sum()) < 64:
        return 0.0
    baseline = (float(np.mean(dx[mask_x])) + float(np.mean(dy[mask_y]))) / 2.0 + 1e-6
    periodic_values: list[float] = []
    for period in (8, 16, 32):
        vertical_grid = np.zeros_like(mask_x)
        vertical_grid[:, period - 1 :: period] = True
        horizontal_grid = np.zeros_like(mask_y)
        horizontal_grid[period - 1 :: period, :] = True
        vertical_mask = mask_x & vertical_grid
        horizontal_mask = mask_y & horizontal_grid
        if int(vertical_mask.sum()) > 16:
            periodic_values.append(float(np.mean(dx[vertical_mask])) / baseline)
        if int(horizontal_mask.sum()) > 16:
            periodic_values.append(float(np.mean(dy[horizontal_mask])) / baseline)
    return max(periodic_values) if periodic_values else 0.0


def diagnose_failures(
    comparison: dict[str, float],
    ratios: dict[str, float],
    mask_metrics: dict[str, Any],
) -> list[dict[str, str]]:
    failures: list[dict[str, str]] = []
    if ratios["sharpnessRatio"] < 0.5:
        failures.append({"code": "too_blurry", "severity": "high", "message": "Generated image is much blurrier than its target."})
    if ratios["edgeDensityRatio"] < 0.6:
        failures.append({"code": "edge_density_too_low", "severity": "high", "message": "Pixel edge density is too low."})
    if ratios["maskBoundaryGradientRatio"] < 0.55:
        failures.append({"code": "structure_boundary_weak", "severity": "high", "message": "Visible structure boundaries are too weak."})
    if ratios["colorRangeRatio"] < 0.55:
        failures.append({"code": "color_range_collapsed", "severity": "medium", "message": "Color range is collapsed."})
    if ratios["contrastRatio"] < 0.6:
        failures.append({"code": "contrast_too_low", "severity": "medium", "message": "Contrast is too low."})
    if ratios["uniqueColorRatio"] < 0.45:
        failures.append({"code": "pixel_detail_density_too_low", "severity": "medium", "message": "Pixel color diversity is too low."})
    if comparison["mae"] > 0.18:
        failures.append({"code": "target_distance_too_high", "severity": "medium", "message": "Generated image is too far from the paired target."})
    water_artifact_delta = float(mask_metrics.get("waterPeriodicArtifactDelta", 0.0))
    water_artifact_ratio = float(mask_metrics.get("waterPeriodicArtifactRatio", 0.0))
    if water_artifact_delta > 0.28 or (water_artifact_delta > 0.16 and water_artifact_ratio > 1.15):
        failures.append({"code": "water_periodic_grid_artifact", "severity": "high", "message": "Water region shows excessive periodic grid artifacts."})
    elif water_artifact_delta > 0.16:
        failures.append({"code": "water_periodic_texture_warning", "severity": "medium", "message": "Water region may contain repetitive texture artifacts."})
    if int(mask_metrics["activeChannelCount"]) < 3:
        failures.append({"code": "condition_channels_too_sparse", "severity": "medium", "message": "Condition masks are too sparse for full-scene learning."})
    return failures


def score_candidate(comparison: dict[str, float], ratios: dict[str, float], mask_metrics: dict[str, Any]) -> float:
    sharpness_score = clamp(ratios["sharpnessRatio"] / 0.92)
    edge_score = clamp(ratios["edgeDensityRatio"] / 0.92)
    boundary_score = clamp(ratios["maskBoundaryGradientRatio"] / 0.9)
    color_score = clamp(ratios["colorRangeRatio"] / 0.9)
    contrast_score = clamp(ratios["contrastRatio"] / 0.9)
    unique_score = clamp(ratios["uniqueColorRatio"] / 0.9)
    mae_score = clamp(1.0 - comparison["mae"] / 0.2)
    psnr_score = clamp((comparison["psnr"] - 16.0) / 18.0)
    water_artifact_penalty = clamp(float(mask_metrics.get("waterPeriodicArtifactDelta", 0.0)) / 0.35) * 12
    return max(
        0.0,
        sharpness_score * 22
        + edge_score * 18
        + boundary_score * 18
        + color_score * 12
        + contrast_score * 10
        + unique_score * 8
        + mae_score * 8
        + psnr_score * 4
        - water_artifact_penalty
    )


def build_report_status(rows: list[dict[str, Any]]) -> str:
    passed = sum(1 for row in rows if row["status"] == "passed_for_next_training")
    review = sum(1 for row in rows if row["status"] == "review_candidate")
    if passed >= 4:
        return "passed_for_next_training"
    if passed + review >= 4:
        return "needs_manual_review"
    return "failed_keep_for_history"


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts = {
        "passedForNextTraining": sum(1 for row in rows if row["status"] == "passed_for_next_training"),
        "reviewCandidate": sum(1 for row in rows if row["status"] == "review_candidate"),
        "rejectedTrainingCandidate": sum(1 for row in rows if row["status"] == "rejected_training_candidate"),
    }
    average_score = sum(float(row["score"]) for row in rows) / len(rows) if rows else 0.0
    return {
        "rowCount": len(rows),
        **status_counts,
        "averageScore": round_float(average_score),
        "bestScore": round_float(max((float(row["score"]) for row in rows), default=0.0)),
        "worstScore": round_float(min((float(row["score"]) for row in rows), default=0.0)),
    }


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    gap = 12
    label_height = 38
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows_count = max(1, math.ceil(len(rows) / columns))
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows_count * cell_h + (rows_count + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        col = index % columns
        line = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + line * (cell_h + gap)
        status = str(row["status"])
        score = float(row["score"])
        border = status_color(status)
        label = f"{index + 1:02d} {score:05.1f} {status}"
        draw.text((x, y), label[:34], fill=border)
        draw.text((x, y + 16), compact_sample_label(str(row["sampleId"])), fill="#dff8e6")
        with Image.open(str(row["generated"])) as image:
            generated = image.convert("RGB")
        draw.rectangle((x - 2, y + label_height - 2, x + CANVAS_WIDTH + 1, y + label_height + CANVAS_HEIGHT + 1), outline=border, width=2)
        sheet.paste(generated, (x, y + label_height))
    sheet.save(output_path)
    return output_path


def status_color(status: str) -> str:
    if status == "passed_for_next_training":
        return "#79f2a6"
    if status == "review_candidate":
        return "#ffd56a"
    return "#ff6b6b"


def compact_sample_label(sample_id: str) -> str:
    label = sample_id.replace("natural-home-", "")
    if "__v28-" in label:
        source, variant = label.split("__v28-", 1)
        label = f"{source} / {variant}"
    return label[:36]


def decision_note(status: str) -> str:
    if status == "passed_for_next_training":
        return "May be used as a training candidate. It is still not approved for player display."
    if status == "review_candidate":
        return "Borderline candidate. Keep for review and compare against later runs."
    return "Rejected for training selection. Keep only as failure history."


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_ratio(left: float, right: float) -> float:
    if right <= 1e-9:
        return 0.0
    return round_float(left / right)


def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def round_float(value: float) -> float:
    return round(float(value), 6)


if __name__ == "__main__":
    raise SystemExit(main())

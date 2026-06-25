from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH


SCHEMA_VERSION = "natural-home-current-mvp-vj1-review-v1"
DEFAULT_STAGE_ID = "natural-home-v91-current-mvp-vj1-review"

ALLOWED_CHANNELS = {
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "walkable",
    "depth",
}

FORBIDDEN_TEXT_TOKENS = {
    "shelter",
    "storehouse",
    "canopy",
    "construction",
    "construct",
    "building",
    "house",
    "foundation",
    "wall",
    "roof",
    "material",
    "settlement",
    "refuge",
    "camp",
    "hut",
    "quarry",
    "work_canopy",
    "storehouse_frame",
    "butler",
    "character",
    "animal",
    "insect",
}

FORBIDDEN_CHANNELS = {
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "building",
    "facility",
    "butler",
    "character",
    "animal",
    "insect",
}


def main() -> int:
    parser = ArgumentParser(description="Run current-MVP natural-home VJ-1 checks for V91 candidates.")
    parser.add_argument(
        "--quality-report",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v91-current-mvp-quality-selection/latest.json"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review"),
    )
    parser.add_argument("--stage-id", type=str, default=DEFAULT_STAGE_ID)
    parser.add_argument("--min-score", type=float, default=90.0)
    parser.add_argument("--max-mae", type=float, default=0.02)
    parser.add_argument("--min-psnr", type=float, default=30.0)
    parser.add_argument("--min-sharpness-ratio", type=float, default=0.82)
    parser.add_argument("--min-edge-density-ratio", type=float, default=0.9)
    parser.add_argument("--min-mask-boundary-ratio", type=float, default=0.85)
    parser.add_argument("--max-water-artifact-delta", type=float, default=0.16)
    args = parser.parse_args()

    quality_report_path = args.quality_report.resolve()
    quality_report = read_json(quality_report_path)
    rows = quality_report.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"quality report has no rows: {quality_report_path}")

    thresholds = {
        "minScore": args.min_score,
        "maxMae": args.max_mae,
        "minPsnr": args.min_psnr,
        "minSharpnessRatio": args.min_sharpness_ratio,
        "minEdgeDensityRatio": args.min_edge_density_ratio,
        "minMaskBoundaryGradientRatio": args.min_mask_boundary_ratio,
        "maxWaterArtifactDelta": args.max_water_artifact_delta,
    }

    reviewed_rows = [review_row(row, thresholds) for row in rows if isinstance(row, dict)]
    reviewed_rows.sort(key=lambda row: (-float(row["score"]), str(row["sampleId"])))
    best_passed = next((row for row in reviewed_rows if row["vj1Status"] == "vj_1_passed"), None)

    args.output_root.mkdir(parents=True, exist_ok=True)
    contact_sheet = args.output_root / "contact-sheet.png"
    build_contact_sheet(reviewed_rows, contact_sheet)

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "stageId": args.stage_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceQualityReport": str(quality_report_path),
        "sourceStageId": quality_report.get("sourceStageId"),
        "reviewScope": "natural_home_current_mvp_vj1_only",
        "status": build_status(reviewed_rows),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "canEnterApprovedFrameCandidateReview": best_passed is not None,
        "approvedFrameStatus": "not_written",
        "thresholds": thresholds,
        "policy": {
            "allowedCurrentMvpContent": sorted(ALLOWED_CHANNELS),
            "forbiddenTextTokens": sorted(FORBIDDEN_TEXT_TOKENS),
            "forbiddenChannels": sorted(FORBIDDEN_CHANNELS),
        },
        "summary": summarize(reviewed_rows),
        "bestCandidate": build_best_candidate(best_passed),
        "contactSheet": str(contact_sheet.resolve()),
        "rows": reviewed_rows,
        "note": (
            "VJ-1 natural-home review only. Passing this report means the candidate may enter "
            "ApprovedFrame candidate review, not that it can be shown to players."
        ),
    }

    write_json(args.output_root / "latest.json", report)
    write_json(args.output_root / "review-report.json", report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


def review_row(row: dict[str, Any], thresholds: dict[str, float]) -> dict[str, Any]:
    checks = []
    generated_path = Path(str(row.get("generated", "")))
    target_path = Path(str(row.get("target", "")))
    blueprint_path = Path(str(row.get("blueprint", "")))
    metrics = row.get("metrics") if isinstance(row.get("metrics"), dict) else {}
    comparison = metrics.get("comparison") if isinstance(metrics.get("comparison"), dict) else {}
    ratios = metrics.get("ratios") if isinstance(metrics.get("ratios"), dict) else {}
    condition = metrics.get("condition") if isinstance(metrics.get("condition"), dict) else {}

    checks.append(check("source_status_passed", row.get("status") == "passed_for_next_training"))
    checks.append(check("source_not_display_allowed", row.get("displayAllowed") is False))
    checks.append(check("source_not_world_promotable", row.get("canPromoteToWorld") is False))
    checks.append(check("generated_file_exists", generated_path.is_file(), str(generated_path)))
    checks.append(check("target_file_exists", target_path.is_file(), str(target_path)))
    checks.append(check("blueprint_file_exists", blueprint_path.is_file(), str(blueprint_path)))
    checks.append(check("generated_png_size", image_size_is_current_mvp(generated_path), f"{CANVAS_WIDTH}x{CANVAS_HEIGHT}"))

    searchable = searchable_text(row)
    for token in sorted(FORBIDDEN_TEXT_TOKENS):
        checks.append(check(f"no_forbidden_text_{token}", token not in searchable, token))

    active_channels = set(active_condition_channels(condition))
    checks.append(check("active_channels_not_empty", len(active_channels) >= 3, ",".join(sorted(active_channels))))
    checks.append(check("active_channels_are_current_mvp", active_channels.issubset(ALLOWED_CHANNELS), ",".join(sorted(active_channels - ALLOWED_CHANNELS))))
    for channel in sorted(FORBIDDEN_CHANNELS):
        checks.append(check(f"no_forbidden_channel_{channel}", channel not in active_channels, channel))

    score = number(row.get("score"))
    mae = number(comparison.get("mae"))
    psnr = number(comparison.get("psnr"))
    sharpness = number(ratios.get("sharpnessRatio"))
    edge_density = number(ratios.get("edgeDensityRatio"))
    boundary = number(ratios.get("maskBoundaryGradientRatio"))
    water_delta = number(condition.get("waterPeriodicArtifactDelta"), default=0.0)

    checks.append(check("score_above_vj1_line", score >= thresholds["minScore"], f"{score}"))
    checks.append(check("mae_under_vj1_line", mae <= thresholds["maxMae"], f"{mae}"))
    checks.append(check("psnr_above_vj1_line", psnr >= thresholds["minPsnr"], f"{psnr}"))
    checks.append(check("sharpness_ratio_above_vj1_line", sharpness >= thresholds["minSharpnessRatio"], f"{sharpness}"))
    checks.append(check("edge_density_ratio_above_vj1_line", edge_density >= thresholds["minEdgeDensityRatio"], f"{edge_density}"))
    checks.append(check("mask_boundary_ratio_above_vj1_line", boundary >= thresholds["minMaskBoundaryGradientRatio"], f"{boundary}"))
    checks.append(check("water_artifact_delta_under_vj1_line", water_delta <= thresholds["maxWaterArtifactDelta"], f"{water_delta}"))

    failed_checks = [item for item in checks if not item["passed"]]
    status = "vj_1_passed" if not failed_checks else "vj_1_failed"
    return {
        "sampleId": row.get("sampleId"),
        "vj1Status": status,
        "vj2Status": "vj_2_not_implemented",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "canEnterApprovedFrameCandidateReview": status == "vj_1_passed",
        "score": round_float(score),
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "blueprint": str(blueprint_path.resolve()),
        "sourceSha256": row.get("sourceSha256"),
        "activeChannels": sorted(active_channels),
        "metrics": {
            "mae": round_float(mae),
            "psnr": round_float(psnr),
            "sharpnessRatio": round_float(sharpness),
            "edgeDensityRatio": round_float(edge_density),
            "maskBoundaryGradientRatio": round_float(boundary),
            "waterPeriodicArtifactDelta": round_float(water_delta),
        },
        "checks": checks,
        "failureReasons": [item["id"] for item in failed_checks],
    }


def check(check_id: str, passed: bool, detail: str | None = None) -> dict[str, Any]:
    return {"id": check_id, "passed": bool(passed), "detail": detail or ""}


def image_size_is_current_mvp(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            return image.format == "PNG" and image.size == (CANVAS_WIDTH, CANVAS_HEIGHT)
    except Exception:
        return False


def searchable_text(row: dict[str, Any]) -> str:
    values = [row.get("sampleId"), row.get("generated"), row.get("target"), row.get("blueprint")]
    return " ".join(str(value).lower() for value in values if value is not None)


def active_condition_channels(condition: dict[str, Any]) -> list[str]:
    channels: set[str] = set()
    active = condition.get("activeChannels")
    if isinstance(active, list):
        channels.update(str(value) for value in active)
    active_areas = condition.get("activeAreas")
    if isinstance(active_areas, dict):
        for key, value in active_areas.items():
            if number(value, default=0.0) > 0.0:
                channels.add(str(key))
    return sorted(channels)


def build_status(rows: list[dict[str, Any]]) -> str:
    passed = sum(1 for row in rows if row["vj1Status"] == "vj_1_passed")
    if passed >= 1:
        return "vj_1_passed_candidate_available"
    return "vj_1_failed_keep_for_history"


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    reason_counts: Counter[str] = Counter()
    for row in rows:
        reason_counts.update(row.get("failureReasons", []))
    passed = sum(1 for row in rows if row["vj1Status"] == "vj_1_passed")
    failed = len(rows) - passed
    return {
        "rowCount": len(rows),
        "vj1PassedCount": passed,
        "vj1FailedCount": failed,
        "vj2Implemented": False,
        "averageScore": round_float(sum(float(row["score"]) for row in rows) / len(rows) if rows else 0.0),
        "bestScore": round_float(max((float(row["score"]) for row in rows), default=0.0)),
        "worstScore": round_float(min((float(row["score"]) for row in rows), default=0.0)),
        "failureReasonCounts": dict(sorted(reason_counts.items())),
    }


def build_best_candidate(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "sampleId": row.get("sampleId"),
        "score": row.get("score"),
        "generated": row.get("generated"),
        "target": row.get("target"),
        "blueprint": row.get("blueprint"),
        "sourceSha256": row.get("sourceSha256"),
        "status": "may_enter_approved_frame_candidate_review",
    }


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> None:
    gap = 12
    label_height = 42
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
        passed = row["vj1Status"] == "vj_1_passed"
        color = "#79f2a6" if passed else "#ff6b6b"
        label = f"{index + 1:02d} {float(row['score']):05.1f} {row['vj1Status']}"
        draw.text((x, y), label[:34], fill=color)
        draw.text((x, y + 17), compact_sample_label(str(row.get("sampleId"))), fill="#dff8e6")
        try:
            with Image.open(str(row["generated"])) as image:
                generated = image.convert("RGB")
            sheet.paste(generated, (x, y + label_height))
            draw.rectangle((x - 2, y + label_height - 2, x + CANVAS_WIDTH + 1, y + label_height + CANVAS_HEIGHT + 1), outline=color, width=2)
        except Exception:
            draw.rectangle((x, y + label_height, x + CANVAS_WIDTH, y + label_height + CANVAS_HEIGHT), fill="#2b1111", outline=color, width=2)
    sheet.save(output_path)


def compact_sample_label(sample_id: str) -> str:
    label = sample_id.replace("natural-home-", "")
    if "__v28-" in label:
        source, variant = label.split("__v28-", 1)
        label = f"{source} / {variant}"
    return label[:38]


def number(value: Any, default: float = -999.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def round_float(value: float) -> float:
    return round(float(value), 6)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

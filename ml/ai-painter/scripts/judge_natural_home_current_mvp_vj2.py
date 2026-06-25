from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageStat

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH


SCHEMA_VERSION = "natural-home-current-mvp-vj2-review-v1"
DEFAULT_STAGE_ID = "natural-home-v91-current-mvp-vj2-review"

REQUIRED_BASE_CHANNELS = {"grass", "depth"}
NATURAL_DETAIL_CHANNELS = {
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "walkable",
}
FORBIDDEN_CURRENT_MVP_TYPES = {
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
    parser = ArgumentParser(description="Run minimal current-MVP natural-home VJ-2 checks for V91 candidates.")
    parser.add_argument(
        "--vj1-report",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v91-current-mvp-vj1-review/latest.json"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v91-current-mvp-vj2-review"),
    )
    parser.add_argument("--stage-id", type=str, default=DEFAULT_STAGE_ID)
    parser.add_argument("--min-score", type=float, default=96.0)
    parser.add_argument("--min-color-count", type=int, default=48)
    parser.add_argument("--max-dominant-color-ratio", type=float, default=0.34)
    parser.add_argument("--min-luminance-stddev", type=float, default=18.0)
    parser.add_argument("--max-luminance-stddev", type=float, default=80.0)
    parser.add_argument("--min-natural-color-ratio", type=float, default=0.55)
    parser.add_argument("--min-detail-channel-count", type=int, default=2)
    args = parser.parse_args()

    vj1_report_path = args.vj1_report.resolve()
    vj1_report = read_json(vj1_report_path)
    rows = vj1_report.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"VJ-1 report has no rows: {vj1_report_path}")

    thresholds = {
        "minScore": args.min_score,
        "minColorCount": args.min_color_count,
        "maxDominantColorRatio": args.max_dominant_color_ratio,
        "minLuminanceStdDev": args.min_luminance_stddev,
        "maxLuminanceStdDev": args.max_luminance_stddev,
        "minNaturalColorRatio": args.min_natural_color_ratio,
        "minDetailChannelCount": args.min_detail_channel_count,
    }

    reviewed_rows = [review_row(row, thresholds) for row in rows if isinstance(row, dict)]
    reviewed_rows.sort(key=lambda row: (-int(row["vj2Passed"]), -float(row["score"]), str(row["sampleId"])))
    best_passed = next((row for row in reviewed_rows if row["vj2Status"] == "vj_2_passed_minimal"), None)

    args.output_root.mkdir(parents=True, exist_ok=True)
    contact_sheet = args.output_root / "contact-sheet.png"
    build_contact_sheet(reviewed_rows, contact_sheet)

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "stageId": args.stage_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceVj1Report": str(vj1_report_path),
        "sourceStageId": vj1_report.get("stageId"),
        "reviewScope": "natural_home_current_mvp_minimal_vj2",
        "status": build_status(reviewed_rows),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "canEnterApprovedFrameCandidateReview": best_passed is not None,
        "approvedFrameStatus": "not_written",
        "thresholds": thresholds,
        "policy": {
            "requiredBaseChannels": sorted(REQUIRED_BASE_CHANNELS),
            "naturalDetailChannels": sorted(NATURAL_DETAIL_CHANNELS),
            "forbiddenCurrentMvpTypes": sorted(FORBIDDEN_CURRENT_MVP_TYPES),
            "note": "This is a minimal VJ-2 semantic/style gate. It may select candidates for ApprovedFrame binding review, but it never writes ApprovedFrame.",
        },
        "summary": summarize(reviewed_rows),
        "bestCandidate": build_best_candidate(best_passed),
        "contactSheet": str(contact_sheet.resolve()),
        "rows": reviewed_rows,
    }

    write_json(args.output_root / "latest.json", report)
    write_json(args.output_root / "review-report.json", report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


def review_row(row: dict[str, Any], thresholds: dict[str, float | int]) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    generated_path = Path(str(row.get("generated", "")))
    blueprint_path = Path(str(row.get("blueprint", "")))
    active_channels = set(str(channel) for channel in row.get("activeChannels", []) if isinstance(channel, str))
    score = number(row.get("score"))
    metrics = image_metrics(generated_path)
    blueprint_types = load_blueprint_types(blueprint_path)

    checks.append(check("vj1_must_pass", row.get("vj1Status") == "vj_1_passed"))
    checks.append(check("candidate_must_not_be_display_allowed", row.get("displayAllowed") is False))
    checks.append(check("candidate_must_not_promote_to_world", row.get("canPromoteToWorld") is False))
    checks.append(check("score_above_minimal_vj2_line", score >= float(thresholds["minScore"]), f"{score}"))
    checks.append(check("generated_png_size", metrics["sizeOk"], f"{CANVAS_WIDTH}x{CANVAS_HEIGHT}"))
    checks.append(check("base_grass_present", "grass" in active_channels or "grass" in blueprint_types))
    checks.append(check("base_depth_present", "depth" in active_channels or "depth" in blueprint_types))
    detail_count = len((active_channels | blueprint_types) & NATURAL_DETAIL_CHANNELS)
    checks.append(check("natural_detail_channel_count", detail_count >= int(thresholds["minDetailChannelCount"]), str(detail_count)))
    forbidden_present = sorted((active_channels | blueprint_types) & FORBIDDEN_CURRENT_MVP_TYPES)
    checks.append(check("no_current_mvp_forbidden_semantic_type", not forbidden_present, ",".join(forbidden_present)))
    checks.append(check("color_count_supports_pixel_detail", metrics["colorCount"] >= int(thresholds["minColorCount"]), str(metrics["colorCount"])))
    checks.append(
        check(
            "dominant_color_not_flat_fill",
            metrics["dominantColorRatio"] <= float(thresholds["maxDominantColorRatio"]),
            f"{metrics['dominantColorRatio']}",
        ),
    )
    checks.append(
        check(
            "luminance_stddev_in_healing_pixel_range",
            float(thresholds["minLuminanceStdDev"]) <= metrics["luminanceStdDev"] <= float(thresholds["maxLuminanceStdDev"]),
            f"{metrics['luminanceStdDev']}",
        ),
    )
    checks.append(
        check(
            "natural_palette_ratio",
            metrics["naturalColorRatio"] >= float(thresholds["minNaturalColorRatio"]),
            f"{metrics['naturalColorRatio']}",
        ),
    )

    failed = [item for item in checks if not item["passed"]]
    vj2_status = "vj_2_passed_minimal" if not failed else "vj_2_failed_minimal"
    return {
        "sampleId": row.get("sampleId"),
        "vj1Status": row.get("vj1Status"),
        "vj2Status": vj2_status,
        "vj2Passed": vj2_status == "vj_2_passed_minimal",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "canEnterApprovedFrameCandidateReview": vj2_status == "vj_2_passed_minimal",
        "approvedFrameStatus": "not_written",
        "score": round_float(score),
        "generated": str(generated_path.resolve()),
        "target": row.get("target"),
        "blueprint": str(blueprint_path.resolve()),
        "sourceSha256": row.get("sourceSha256"),
        "activeChannels": sorted(active_channels),
        "blueprintTypes": sorted(blueprint_types),
        "visualStyleMetrics": metrics,
        "checks": checks,
        "failureReasons": [item["id"] for item in failed],
    }


def image_metrics(path: Path) -> dict[str, Any]:
    try:
        with Image.open(path) as image:
            rgb = image.convert("RGB")
            size_ok = image.format == "PNG" and rgb.size == (CANVAS_WIDTH, CANVAS_HEIGHT)
            quantized = rgb.quantize(colors=128)
            histogram = quantized.histogram()
            pixel_count = rgb.size[0] * rgb.size[1]
            non_empty_bins = [count for count in histogram if count > 0]
            dominant = max(non_empty_bins, default=0) / pixel_count
            luminance = ImageStat.Stat(rgb.convert("L")).stddev[0]
            natural_ratio = calculate_natural_color_ratio(rgb)
            return {
                "sizeOk": size_ok,
                "colorCount": len(non_empty_bins),
                "dominantColorRatio": round_float(dominant),
                "luminanceStdDev": round_float(luminance),
                "naturalColorRatio": round_float(natural_ratio),
            }
    except Exception:
        return {
            "sizeOk": False,
            "colorCount": 0,
            "dominantColorRatio": 1.0,
            "luminanceStdDev": 0.0,
            "naturalColorRatio": 0.0,
        }


def calculate_natural_color_ratio(image: Image.Image) -> float:
    pixels = image.resize((64, 48), Image.Resampling.BILINEAR).getdata()
    total = 0
    natural = 0
    for red, green, blue in pixels:
        total += 1
        is_green = green >= red * 0.78 and green >= blue * 0.72 and green >= 45
        is_water = blue >= 55 and green >= 50 and blue >= red * 0.8
        is_earth = red >= 70 and green >= 50 and blue <= red * 0.9 and abs(red - green) <= 85
        is_stone = abs(red - green) <= 35 and abs(green - blue) <= 35 and 45 <= red <= 190
        if is_green or is_water or is_earth or is_stone:
            natural += 1
    return natural / total if total else 0.0


def load_blueprint_types(path: Path) -> set[str]:
    try:
        blueprint = read_json(path)
    except Exception:
        return set()
    structures = blueprint.get("structures")
    if not isinstance(structures, list):
        return set()
    types = set()
    for structure in structures:
        if isinstance(structure, dict) and isinstance(structure.get("type"), str):
            types.add(structure["type"])
    return types


def check(check_id: str, passed: bool, detail: str | None = None) -> dict[str, Any]:
    return {"id": check_id, "passed": bool(passed), "detail": detail or ""}


def build_status(rows: list[dict[str, Any]]) -> str:
    passed = sum(1 for row in rows if row["vj2Status"] == "vj_2_passed_minimal")
    return "vj_2_passed_candidate_available" if passed else "vj_2_failed_keep_training"


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    reason_counts: Counter[str] = Counter()
    for row in rows:
        reason_counts.update(row.get("failureReasons", []))
    passed = sum(1 for row in rows if row["vj2Status"] == "vj_2_passed_minimal")
    failed = len(rows) - passed
    return {
        "rowCount": len(rows),
        "vj1PassedCount": sum(1 for row in rows if row.get("vj1Status") == "vj_1_passed"),
        "vj2PassedCount": passed,
        "vj2FailedCount": failed,
        "vj2Implemented": True,
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
        "vj2Status": row.get("vj2Status"),
        "status": "may_enter_approved_frame_binding_review",
    }


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> None:
    gap = 12
    label_height = 48
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
        passed = row["vj2Status"] == "vj_2_passed_minimal"
        color = "#79f2a6" if passed else "#ff6b6b"
        label = f"{index + 1:02d} {float(row['score']):05.1f} {row['vj2Status']}"
        draw.text((x, y), label[:36], fill=color)
        draw.text((x, y + 17), compact_sample_label(str(row.get("sampleId"))), fill="#dff8e6")
        draw.text((x, y + 32), f"natural={row['visualStyleMetrics']['naturalColorRatio']}", fill="#b8d8c1")
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

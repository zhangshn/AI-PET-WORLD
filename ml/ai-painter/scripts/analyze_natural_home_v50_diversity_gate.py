from __future__ import annotations

from argparse import ArgumentParser
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

CANVAS_WIDTH = 256
CANVAS_HEIGHT = 192

BLOCKING_FAILURES = {
    "too_blurry",
    "edge_density_too_low",
    "structure_boundary_weak",
    "water_periodic_grid_artifact",
}

WATER_FAILURES = {"water_periodic_grid_artifact", "water_periodic_texture_warning"}

REQUIRED_CHANNELS = {
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_crown",
    "walkable",
    "depth",
}


def main() -> int:
    parser = ArgumentParser(description="Audit V49 natural-home diversity and water-artifact gate.")
    parser.add_argument("--quality-report", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--schema-version", default="natural-home-v50-diversity-water-gate-v1")
    parser.add_argument("--stage-id", default="natural-home-v50-diversity-water-gate")
    parser.add_argument("--min-strict-pass-rows", type=int, default=30)
    parser.add_argument("--min-unique-sources", type=int, default=24)
    parser.add_argument("--min-variant-count", type=int, default=4)
    parser.add_argument("--max-blocking-water-failures", type=int, default=6)
    args = parser.parse_args()

    report = read_json(args.quality_report)
    rows = [row for row in report.get("rows", []) if isinstance(row, dict)]
    if not rows:
        raise ValueError(f"quality report has no rows: {args.quality_report}")

    args.output_root.mkdir(parents=True, exist_ok=True)
    strict_pass_rows = [row for row in rows if is_strict_pass(row)]
    training_pass_rows = [row for row in rows if row.get("status") == "passed_for_next_training"]
    rejected_rows = [row for row in rows if row.get("status") == "rejected_training_candidate"]
    review_rows = [row for row in rows if row.get("status") == "review_candidate"]

    diversity = build_diversity_summary(strict_pass_rows)
    failure_summary = build_failure_summary(rows)
    water_gate = build_water_gate(rows, args.max_blocking_water_failures)
    checks = build_checks(
        strict_pass_rows=strict_pass_rows,
        diversity=diversity,
        water_gate=water_gate,
        min_strict_pass_rows=args.min_strict_pass_rows,
        min_unique_sources=args.min_unique_sources,
        min_variant_count=args.min_variant_count,
    )
    status = "passed_for_next_stage" if all(item["passed"] for item in checks) else "blocked_keep_for_history"
    contact_sheet = build_contact_sheet(strict_pass_rows[:48], args.output_root / "contact-sheet.png")

    manifest = {
        "schemaVersion": args.schema_version,
        "status": status,
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "training_candidate_diversity_water_gate_only",
        "stageId": args.stage_id,
        "sourceQualityReport": str(args.quality_report.resolve()),
        "sourceStageId": report.get("sourceStageId"),
        "sourceModelVersion": report.get("sourceModelVersion"),
        "summary": {
            "rowCount": len(rows),
            "trainingPassRows": len(training_pass_rows),
            "strictPassRows": len(strict_pass_rows),
            "reviewRows": len(review_rows),
            "rejectedRows": len(rejected_rows),
            "sourceAverageScore": report.get("summary", {}).get("averageScore"),
            "strictAverageScore": round_float(average([float(row.get("score", 0)) for row in strict_pass_rows])),
        },
        "diversity": diversity,
        "failureSummary": failure_summary,
        "waterGate": water_gate,
        "checks": checks,
        "contactSheet": str(contact_sheet.resolve()),
        "rows": [build_row_summary(row) for row in rows],
        "note": "V50 is an audit gate only. It checks whether V49 provides diverse, water-safe natural-home candidates. It is not VisualJudge approval and cannot enter /world.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "diversity-report.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def is_strict_pass(row: dict[str, Any]) -> bool:
    return row.get("status") == "passed_for_next_training" and not failure_codes(row)


def build_diversity_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    sources: set[str] = set()
    variants: set[str] = set()
    channels: set[str] = set()
    topology_counts = {
        "hasWater": 0,
        "hasRoad": 0,
        "hasTree": 0,
        "hasRock": 0,
        "openGrassDominant": 0,
        "waterRich": 0,
        "roadRich": 0,
    }
    for row in rows:
        source, variant = split_sample_id(str(row.get("sampleId", "")))
        sources.add(source)
        variants.add(variant)
        active_areas = active_areas_for(row)
        channels.update(active_areas)
        if active_areas.get("water_body", 0) > 0.005:
            topology_counts["hasWater"] += 1
        if active_areas.get("road_center", 0) > 0.005 or active_areas.get("road_edge", 0) > 0.005:
            topology_counts["hasRoad"] += 1
        if active_areas.get("tree_crown", 0) > 0.005:
            topology_counts["hasTree"] += 1
        if active_areas.get("rock", 0) > 0.001:
            topology_counts["hasRock"] += 1
        if active_areas.get("grass", 0) >= 0.45:
            topology_counts["openGrassDominant"] += 1
        if active_areas.get("water_body", 0) >= 0.12:
            topology_counts["waterRich"] += 1
        if active_areas.get("road_center", 0) >= 0.18:
            topology_counts["roadRich"] += 1
    missing_required = sorted(REQUIRED_CHANNELS - channels)
    return {
        "uniqueSourceCount": len(sources),
        "uniqueVariantCount": len(variants),
        "coveredChannels": sorted(channels),
        "missingRequiredChannels": missing_required,
        "topologyCounts": topology_counts,
        "sourceExamples": sorted(sources)[:12],
        "variantExamples": sorted(variants),
    }


def build_failure_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_code: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    for row in rows:
        for failure in row.get("failures", []) or []:
            code = failure if isinstance(failure, str) else str(failure.get("code", "unknown"))
            severity = "unknown" if isinstance(failure, str) else str(failure.get("severity", "unknown"))
            by_code[code] = by_code.get(code, 0) + 1
            by_severity[severity] = by_severity.get(severity, 0) + 1
    return {"byCode": by_code, "bySeverity": by_severity}


def build_water_gate(rows: list[dict[str, Any]], max_blocking_water_failures: int) -> dict[str, Any]:
    blocking_water_rows: list[str] = []
    warning_water_rows: list[str] = []
    for row in rows:
        codes = failure_codes(row)
        sample_id = str(row.get("sampleId", ""))
        if "water_periodic_grid_artifact" in codes:
            blocking_water_rows.append(sample_id)
        elif "water_periodic_texture_warning" in codes:
            warning_water_rows.append(sample_id)
    return {
        "status": "passed" if len(blocking_water_rows) <= max_blocking_water_failures else "blocked",
        "maxBlockingWaterFailures": max_blocking_water_failures,
        "blockingWaterFailureCount": len(blocking_water_rows),
        "warningWaterFailureCount": len(warning_water_rows),
        "blockingWaterRows": blocking_water_rows,
        "warningWaterRows": warning_water_rows,
    }


def build_checks(
    *,
    strict_pass_rows: list[dict[str, Any]],
    diversity: dict[str, Any],
    water_gate: dict[str, Any],
    min_strict_pass_rows: int,
    min_unique_sources: int,
    min_variant_count: int,
) -> list[dict[str, Any]]:
    checks = [
        {
            "id": "strict_pass_rows",
            "passed": len(strict_pass_rows) >= min_strict_pass_rows,
            "value": len(strict_pass_rows),
            "required": min_strict_pass_rows,
        },
        {
            "id": "unique_sources",
            "passed": int(diversity["uniqueSourceCount"]) >= min_unique_sources,
            "value": diversity["uniqueSourceCount"],
            "required": min_unique_sources,
        },
        {
            "id": "variant_coverage",
            "passed": int(diversity["uniqueVariantCount"]) >= min_variant_count,
            "value": diversity["uniqueVariantCount"],
            "required": min_variant_count,
        },
        {
            "id": "required_channel_coverage",
            "passed": not diversity["missingRequiredChannels"],
            "value": diversity["coveredChannels"],
            "required": sorted(REQUIRED_CHANNELS),
        },
        {
            "id": "water_artifact_gate",
            "passed": water_gate["status"] == "passed",
            "value": water_gate["blockingWaterFailureCount"],
            "required": f"<= {water_gate['maxBlockingWaterFailures']}",
        },
    ]
    return checks


def build_row_summary(row: dict[str, Any]) -> dict[str, Any]:
    source, variant = split_sample_id(str(row.get("sampleId", "")))
    return {
        "sampleId": row.get("sampleId"),
        "sourceId": source,
        "variant": variant,
        "status": row.get("status"),
        "score": row.get("score"),
        "strictPass": is_strict_pass(row),
        "failures": row.get("failures", []),
        "activeChannels": row.get("metrics", {}).get("condition", {}).get("activeChannels", []),
        "activeAreas": row.get("metrics", {}).get("condition", {}).get("activeAreas", {}),
        "generated": row.get("generated"),
        "target": row.get("target"),
    }


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    gap = 12
    label_height = 34
    columns = 4
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
        draw.text((x, y), f"{index + 1:02d} {float(row.get('score', 0)):05.1f} strict-pass", fill="#79f2a6")
        draw.text((x, y + 15), compact_sample_label(str(row.get("sampleId", ""))), fill="#dff8e6")
        with Image.open(str(row["generated"])) as image:
            sheet.paste(image.convert("RGB"), (x, y + label_height))
    sheet.save(output_path)
    return output_path


def split_sample_id(sample_id: str) -> tuple[str, str]:
    if "__v28-" in sample_id:
        source, variant = sample_id.split("__v28-", 1)
        return source, variant
    return sample_id, "unknown"


def compact_sample_label(sample_id: str) -> str:
    source, variant = split_sample_id(sample_id.replace("natural-home-", ""))
    return f"{source[:22]} / {variant[:10]}"


def active_areas_for(row: dict[str, Any]) -> dict[str, float]:
    areas = row.get("metrics", {}).get("condition", {}).get("activeAreas", {})
    if not isinstance(areas, dict):
        return {}
    return {str(key): float(value) for key, value in areas.items()}


def failure_codes(row: dict[str, Any]) -> set[str]:
    codes: set[str] = set()
    for failure in row.get("failures", []) or []:
        if isinstance(failure, str):
            codes.add(failure)
        elif isinstance(failure, dict) and failure.get("code"):
            codes.add(str(failure["code"]))
    return codes


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def round_float(value: float) -> float:
    return round(float(value), 6)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

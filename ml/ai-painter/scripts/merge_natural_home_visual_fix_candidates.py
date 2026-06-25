from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw


HIGH_FAILURE_CODES = {
    "too_blurry",
    "edge_density_too_low",
    "structure_boundary_weak",
    "water_periodic_grid_artifact",
}


def main() -> int:
    parser = ArgumentParser(description="Merge source and visual-fix natural-home candidates with a conservative gate.")
    parser.add_argument("--source-quality-report", type=Path, required=True)
    parser.add_argument("--repair-quality-report", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--schema-version", default="natural-home-v48-merge-gate-selection-v1")
    parser.add_argument("--stage-id", default="natural-home-v48-split-expert-merge-gate-selection")
    parser.add_argument("--training-version", default="split-expert-merge-gate-v48")
    parser.add_argument("--model-version", default="source-or-water-shoreline-expert-v48")
    parser.add_argument("--score-margin", type=float, default=1.0)
    parser.add_argument("--strong-score-margin", type=float, default=4.0)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    source_report = read_json(args.source_quality_report)
    repair_report = read_json(args.repair_quality_report)
    source_rows = rows_by_sample_id(source_report)
    repair_rows = rows_by_sample_id(repair_report)

    merged_rows: list[dict[str, Any]] = []
    for sample_id, source_row in source_rows.items():
        repair_row = repair_rows.get(sample_id)
        if not repair_row:
            merged_rows.append(copy_selected_row(sample_id, source_row, None, args.output_root, "kept_source", "repair_missing"))
            continue
        decision, reason = choose_candidate(source_row, repair_row, args.score_margin, args.strong_score_margin)
        selected = repair_row if decision == "accepted_repair" else source_row
        merged_rows.append(copy_selected_row(sample_id, selected, repair_row, args.output_root, decision, reason, source_row))

    contact_sheet = build_contact_sheet(merged_rows, args.output_root / "contact-sheet.png")
    summary = summarize_rows(merged_rows)
    status = "passed_for_next_training" if summary["passedForNextTraining"] > 0 else "needs_training_repair"
    manifest = {
        "schemaVersion": args.schema_version,
        "status": status,
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "training_candidate_merge_gate_only",
        "stageId": args.stage_id,
        "trainingVersion": args.training_version,
        "modelVersion": args.model_version,
        "sourceQualityReport": str(args.source_quality_report.resolve()),
        "repairQualityReport": str(args.repair_quality_report.resolve()),
        "selectionStrategy": "conservative_split_expert_merge",
        "summary": summary,
        "contactSheet": str(contact_sheet.resolve()),
        "rows": merged_rows,
        "note": "Conservative merge gate only. It compares source and repaired local-model candidates, stores every decision, and cannot enter /world without VisualJudge and ApprovedFrame.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "selection-report.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def choose_candidate(source_row: dict[str, Any], repair_row: dict[str, Any], score_margin: float, strong_score_margin: float) -> tuple[str, str]:
    source_score = float_value(source_row.get("score"))
    repair_score = float_value(repair_row.get("score"))
    source_high = high_failure_codes(source_row)
    repair_high = high_failure_codes(repair_row)
    source_failures = failure_codes(source_row)
    repair_failures = failure_codes(repair_row)
    score_delta = repair_score - source_score

    introduced_high = sorted(repair_high - source_high)
    removed_high = sorted(source_high - repair_high)
    removed_any = sorted(source_failures - repair_failures)
    introduced_any = sorted(repair_failures - source_failures)

    if introduced_high and score_delta < strong_score_margin:
        return "kept_source", "repair_introduced_high_failure:" + ",".join(introduced_high)
    if score_delta >= score_margin and len(repair_high) <= len(source_high):
        return "accepted_repair", f"repair_score_improved:{score_delta:.6f}"
    if removed_high and score_delta >= -0.5:
        return "accepted_repair", "repair_removed_high_failure:" + ",".join(removed_high)
    if removed_any and not introduced_any and score_delta >= -0.25:
        return "accepted_repair", "repair_reduced_failure_set:" + ",".join(removed_any)
    return "kept_source", f"source_safer_score_delta:{score_delta:.6f}"


def copy_selected_row(
    sample_id: str,
    selected_row: dict[str, Any],
    repair_row: dict[str, Any] | None,
    output_root: Path,
    decision: str,
    reason: str,
    source_row: dict[str, Any] | None = None,
) -> dict[str, Any]:
    source_row = source_row or selected_row
    output_dir = output_root / "selected" / safe_name(sample_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_source = Path(str(selected_row["generated"]))
    target_source = Path(str(selected_row["target"]))
    generated_path = output_dir / "generated.png"
    target_path = output_dir / "target.png"
    shutil.copy2(generated_source, generated_path)
    shutil.copy2(target_source, target_path)

    blueprint_path = selected_row.get("blueprint") or source_row.get("blueprint")
    if blueprint_path:
        blueprint_copy = output_dir / "blueprint.v1.json"
        shutil.copy2(Path(str(blueprint_path)), blueprint_copy)
        blueprint = str(blueprint_copy.resolve())
    else:
        blueprint = None

    contact_path = output_dir / "contact-sheet.png"
    build_pair_sheet(target_path, generated_path, sample_id, decision, contact_path)

    row = {
        "sampleId": sample_id,
        "status": selected_row.get("status"),
        "score": selected_row.get("score"),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "decision": decision,
        "decisionReason": reason,
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "contactSheet": str(contact_path.resolve()),
        "blueprint": blueprint,
        "sha256": hashlib.sha256(generated_path.read_bytes()).hexdigest(),
        "sourceGenerated": source_row.get("generated"),
        "repairGenerated": repair_row.get("generated") if repair_row else None,
        "sourceScore": source_row.get("score"),
        "repairScore": repair_row.get("score") if repair_row else None,
        "sourceFailures": source_row.get("failures", []),
        "repairFailures": repair_row.get("failures", []) if repair_row else [],
        "metrics": selected_row.get("metrics"),
        "failures": selected_row.get("failures", []),
    }
    write_json(output_dir / "latest.json", row)
    return row


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    if not rows:
        Image.new("RGB", (256, 192), (8, 26, 18)).save(output_path)
        return output_path

    tile_w = 256
    tile_h = 242
    columns = 3
    rows_count = (len(rows) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_w, rows_count * tile_h), (8, 26, 18))
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        x = (index % columns) * tile_w
        y = (index // columns) * tile_h
        with Image.open(str(row["generated"])) as image:
            sheet.paste(image.convert("RGB").resize((256, 192), Image.Resampling.NEAREST), (x, y + 22))
        label = f"{row['sampleId'][:22]} {row['decision']} {row.get('score', 0):.2f}"
        draw.text((x + 4, y + 4), label, fill=(180, 255, 204))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


def build_pair_sheet(target: Path, generated: Path, sample_id: str, decision: str, output_path: Path) -> None:
    sheet = Image.new("RGB", (512, 222), (8, 26, 18))
    draw = ImageDraw.Draw(sheet)
    draw.text((6, 4), f"{sample_id[:42]} / {decision}", fill=(180, 255, 204))
    with Image.open(target) as target_image:
        sheet.paste(target_image.convert("RGB").resize((256, 192), Image.Resampling.NEAREST), (0, 30))
    with Image.open(generated) as generated_image:
        sheet.paste(generated_image.convert("RGB").resize((256, 192), Image.Resampling.NEAREST), (256, 30))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def summarize_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [float_value(row.get("score")) for row in rows]
    passed = [row for row in rows if row.get("status") == "passed_for_next_training"]
    rejected = [row for row in rows if row.get("status") == "rejected_training_candidate"]
    review = [row for row in rows if row.get("status") not in {"passed_for_next_training", "rejected_training_candidate"}]
    return {
        "rowCount": len(rows),
        "passedForNextTraining": len(passed),
        "reviewCandidate": len(review),
        "rejectedTrainingCandidate": len(rejected),
        "acceptedRepairCount": sum(1 for row in rows if row.get("decision") == "accepted_repair"),
        "keptSourceCount": sum(1 for row in rows if row.get("decision") == "kept_source"),
        "averageScore": round(sum(scores) / len(scores), 6) if scores else 0,
        "bestScore": round(max(scores), 6) if scores else 0,
        "worstScore": round(min(scores), 6) if scores else 0,
    }


def rows_by_sample_id(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = report.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("quality report has no rows")
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        if isinstance(row, dict) and row.get("sampleId"):
            result[str(row["sampleId"])] = row
    return result


def failure_codes(row: dict[str, Any]) -> set[str]:
    codes: set[str] = set()
    failures = row.get("failures", [])
    if isinstance(failures, list):
        for failure in failures:
            if isinstance(failure, dict) and failure.get("code"):
                codes.add(str(failure["code"]))
            elif isinstance(failure, str):
                codes.add(failure)
    return codes


def high_failure_codes(row: dict[str, Any]) -> set[str]:
    return {code for code in failure_codes(row) if code in HIGH_FAILURE_CODES}


def float_value(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def safe_name(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in value)[:160]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

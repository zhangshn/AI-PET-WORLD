from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear

CANVAS_WIDTH = 256
CANVAS_HEIGHT = 192


def main() -> int:
    parser = ArgumentParser(description="Build the V87 natural-home quality ledger and negative gate.")
    parser.add_argument("--quality-report", type=Path, action="append", required=True)
    parser.add_argument("--baseline-report", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--min-allow-score", type=float, default=88.0)
    parser.add_argument("--min-allow-count", type=int, default=32)
    parser.add_argument("--schema-version", default="natural-home-v87-quality-ledger-v1")
    parser.add_argument("--stage-id", default="natural-home-v87-quality-ledger")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        preserve_runtime_dir_before_clear(args.output_root, "build-natural-home-v87-quality-ledger")
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    baseline_path = args.baseline_report.resolve()
    reports = [(path.resolve(), read_json(path)) for path in args.quality_report]
    baseline_report = read_json(args.baseline_report)

    negative_rows = collect_negative_rows(reports)
    allow_rows = collect_allow_rows(
        baseline_report,
        baseline_path,
        args.min_allow_score,
        {row_key(row) for row in negative_rows if row_key(row)},
    )

    copied_allow_rows = [copy_row_assets(row, args.output_root / "allowlist", "allow", index) for index, row in enumerate(allow_rows, 1)]
    copied_negative_rows = [
        copy_row_assets(row, args.output_root / "negative-examples", primary_failure_code(row), index)
        for index, row in enumerate(negative_rows, 1)
    ]

    taxonomy = build_failure_taxonomy(copied_negative_rows)
    contact_sheet = build_ledger_contact_sheet(copied_allow_rows, copied_negative_rows, args.output_root / "contact-sheet.png")
    status = "passed_for_v88_preparation" if len(copied_allow_rows) >= args.min_allow_count else "blocked_need_more_quality_rows"
    ledger = {
        "schemaVersion": args.schema_version,
        "status": status,
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "generatedAt": current_timestamp(),
        "sourceQualityReports": [str(path) for path, _report in reports],
        "baselineReport": str(baseline_path),
        "contactSheet": str(contact_sheet.resolve()),
        "thresholds": {
            "minAllowScore": args.min_allow_score,
            "minAllowCount": args.min_allow_count,
            "hardFailureBlocksTrainingTarget": True,
            "negativeExamplesMayTrainAsTarget": False,
        },
        "summary": {
            "allowRowCount": len(copied_allow_rows),
            "negativeRowCount": len(copied_negative_rows),
            "failureCodeCount": len(taxonomy["byCode"]),
            "status": status,
        },
        "trainingPolicy": {
            "nextTrainingTargetSource": "allowlist_only",
            "negativeExampleUsage": "judge_gate_and_regression_history_only",
            "forbiddenTargetStatuses": ["rejected_training_candidate", "review_candidate_with_high_failure"],
            "note": "Rejected candidates are never copied into target.png for future training. They remain evidence for quality gates and failure regression checks.",
        },
        "files": {
            "nextTrainingAllowList": str((args.output_root / "next-training-allowlist.json").resolve()),
            "negativeExamples": str((args.output_root / "negative-examples.json").resolve()),
            "failureTaxonomy": str((args.output_root / "failure-taxonomy.json").resolve()),
        },
        "allowRows": copied_allow_rows,
        "negativeRows": copied_negative_rows,
    }

    write_json(args.output_root / "latest.json", ledger)
    write_json(args.output_root / "quality-ledger.json", ledger)
    write_json(args.output_root / "next-training-allowlist.json", {
        "schemaVersion": "natural-home-v87-next-training-allowlist-v1",
        "status": "ready" if len(copied_allow_rows) >= args.min_allow_count else "blocked",
        "stageId": args.stage_id,
        "generatedAt": ledger["generatedAt"],
        "source": "baseline_quality_report_passed_rows_only",
        "minAllowScore": args.min_allow_score,
        "rowCount": len(copied_allow_rows),
        "rows": copied_allow_rows,
    })
    write_json(args.output_root / "negative-examples.json", {
        "schemaVersion": "natural-home-v87-negative-examples-v1",
        "status": "recorded_for_gate_only",
        "stageId": args.stage_id,
        "generatedAt": ledger["generatedAt"],
        "mayTrainAsTarget": False,
        "rowCount": len(copied_negative_rows),
        "rows": copied_negative_rows,
    })
    write_json(args.output_root / "failure-taxonomy.json", taxonomy)

    print(json.dumps({
        "schemaVersion": ledger["schemaVersion"],
        "status": ledger["status"],
        "stageId": ledger["stageId"],
        "generatedAt": ledger["generatedAt"],
        "summary": ledger["summary"],
        "files": ledger["files"],
        "contactSheet": ledger["contactSheet"],
    }, ensure_ascii=False, indent=2))
    return 0


def collect_negative_rows(reports: list[tuple[Path, dict[str, Any]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for report_path, report in reports:
        for row in quality_rows(report):
            if not is_negative_row(row):
                continue
            key = f"{row.get('sampleId')}|{row.get('generated')}|{report_path}"
            if key in seen:
                continue
            seen.add(key)
            rows.append(enrich_row(row, report, report_path, "negative_example"))
    rows.sort(key=lambda row: (str(row.get("primaryFailureCode")), float(row.get("score", 0.0)), str(row.get("sampleId"))))
    return rows


def collect_allow_rows(
    baseline_report: dict[str, Any],
    baseline_path: Path,
    min_score: float,
    blocked_keys: set[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in quality_rows(baseline_report):
        if row.get("status") != "passed_for_next_training":
            continue
        if float(row.get("score", 0.0)) < min_score:
            continue
        if has_high_failure(row):
            continue
        if row_key(row) in blocked_keys:
            continue
        rows.append(enrich_row(row, baseline_report, baseline_path, "next_training_allow"))
    rows.sort(key=lambda row: (-float(row.get("score", 0.0)), str(row.get("sampleId"))))
    return rows


def quality_rows(report: dict[str, Any]) -> list[dict[str, Any]]:
    return [row for row in report.get("rows", []) if isinstance(row, dict)]


def enrich_row(row: dict[str, Any], report: dict[str, Any], report_path: Path, ledger_role: str) -> dict[str, Any]:
    failures = normalized_failures(row)
    return {
        **row,
        "ledgerRole": ledger_role,
        "mayTrainAsTarget": ledger_role == "next_training_allow",
        "sourceQualityReport": str(report_path),
        "sourceStageId": report.get("sourceStageId"),
        "sourceTrainingVersion": report.get("sourceTrainingVersion"),
        "sourceModelVersion": report.get("sourceModelVersion"),
        "primaryFailureCode": failures[0]["code"] if failures else None,
        "failureCodes": [failure["code"] for failure in failures],
    }


def is_negative_row(row: dict[str, Any]) -> bool:
    return row.get("status") == "rejected_training_candidate" or has_high_failure(row)


def has_high_failure(row: dict[str, Any]) -> bool:
    return any(failure.get("severity") == "high" for failure in normalized_failures(row))


def normalized_failures(row: dict[str, Any]) -> list[dict[str, str]]:
    failures = row.get("failures")
    if not isinstance(failures, list):
        return []
    result: list[dict[str, str]] = []
    for failure in failures:
        if not isinstance(failure, dict):
            result.append({"code": str(failure), "severity": "unknown", "message": ""})
            continue
        code = str(failure.get("code") or "unknown_failure")
        severity = str(failure.get("severity") or "unknown")
        message = str(failure.get("message") or "")
        result.append({"code": code, "severity": severity, "message": message})
    return result


def primary_failure_code(row: dict[str, Any]) -> str:
    code = row.get("primaryFailureCode")
    if isinstance(code, str) and code:
        return safe_name(code)
    failures = normalized_failures(row)
    return safe_name(failures[0]["code"] if failures else "unknown_failure")


def row_key(row: dict[str, Any]) -> str:
    sample_id = str(row.get("sampleId") or "")
    generated = str(row.get("generated") or "")
    return f"{sample_id}|{hash_text(generated)}"


def copy_row_assets(row: dict[str, Any], output_root: Path, group: str, index: int) -> dict[str, Any]:
    sample_id = safe_name(str(row.get("sampleId") or f"row-{index}"))
    row_dir = output_root / safe_name(group) / f"{index:04d}-{sample_id[:96]}"
    row_dir.mkdir(parents=True, exist_ok=True)

    files: dict[str, str] = {}
    for field in ("generated", "target", "blueprint", "contactSheet"):
        copied = copy_optional_file(row.get(field), row_dir, field)
        if copied:
            files[field] = str(copied.resolve())
    mask_dir = copy_mask_dir(row.get("blueprint"), row_dir)
    if mask_dir:
        files["masks_v1"] = str(mask_dir.resolve())

    archived = {
        "sampleId": row.get("sampleId"),
        "status": row.get("status"),
        "score": row.get("score"),
        "ledgerRole": row.get("ledgerRole"),
        "mayTrainAsTarget": row.get("mayTrainAsTarget"),
        "sourceQualityReport": row.get("sourceQualityReport"),
        "sourceStageId": row.get("sourceStageId"),
        "sourceTrainingVersion": row.get("sourceTrainingVersion"),
        "sourceModelVersion": row.get("sourceModelVersion"),
        "sourceSha256": row.get("sourceSha256"),
        "primaryFailureCode": row.get("primaryFailureCode"),
        "failureCodes": row.get("failureCodes", []),
        "failures": row.get("failures", []),
        "metrics": row.get("metrics", {}),
        "files": files,
        "archiveDir": str(row_dir.resolve()),
    }
    write_json(row_dir / "row.json", archived)
    return archived


def copy_optional_file(value: Any, output_dir: Path, field: str) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    source = Path(value)
    if not source.exists() or not source.is_file():
        return None
    target = output_dir / f"{field}{source.suffix or '.dat'}"
    shutil.copy2(source, target)
    return target


def copy_mask_dir(blueprint_value: Any, output_dir: Path) -> Path | None:
    if not isinstance(blueprint_value, str) or not blueprint_value:
        return None
    source = Path(blueprint_value).parent / "masks_v1"
    if not source.exists() or not source.is_dir():
        return None
    target = output_dir / "masks_v1"
    shutil.copytree(source, target)
    return target


def build_failure_taxonomy(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_code: dict[str, dict[str, Any]] = {}
    by_stage: dict[str, int] = {}
    for row in rows:
        stage = str(row.get("sourceStageId") or "unknown_stage")
        by_stage[stage] = by_stage.get(stage, 0) + 1
        failures = row.get("failures") if isinstance(row.get("failures"), list) else []
        if not failures:
            failures = [{"code": "unknown_failure", "severity": "unknown", "message": ""}]
        for failure in failures:
            if not isinstance(failure, dict):
                continue
            code = str(failure.get("code") or "unknown_failure")
            entry = by_code.setdefault(code, {"code": code, "count": 0, "severities": {}, "examples": []})
            entry["count"] += 1
            severity = str(failure.get("severity") or "unknown")
            entry["severities"][severity] = entry["severities"].get(severity, 0) + 1
            if len(entry["examples"]) < 8:
                entry["examples"].append({
                    "sampleId": row.get("sampleId"),
                    "score": row.get("score"),
                    "sourceStageId": row.get("sourceStageId"),
                    "message": failure.get("message"),
                })
    return {
        "schemaVersion": "natural-home-v87-failure-taxonomy-v1",
        "generatedAt": current_timestamp(),
        "byCode": dict(sorted(by_code.items(), key=lambda item: (-int(item[1]["count"]), item[0]))),
        "byStage": dict(sorted(by_stage.items())),
    }


def build_ledger_contact_sheet(allow_rows: list[dict[str, Any]], negative_rows: list[dict[str, Any]], output_path: Path) -> Path:
    columns = 4
    rows_per_group = 3
    gap = 10
    label_height = 24
    header_height = 34
    group_height = header_height + rows_per_group * (CANVAS_HEIGHT // 2 + label_height + gap) + gap
    width = columns * (CANVAS_WIDTH // 2) + (columns + 1) * gap
    height = group_height * 2 + gap
    sheet = Image.new("RGB", (width, height), "#071510")
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 10), "V87 allowlist candidates / may train as target", fill="#79f2a6")
    draw_group(draw, sheet, allow_rows, gap, header_height, "#79f2a6")
    negative_y = group_height + gap
    draw.text((gap, negative_y + 10), "V87 negative examples / gate only, never target", fill="#ff6b6b")
    draw_group(draw, sheet, negative_rows, gap, negative_y + header_height, "#ff6b6b")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


def draw_group(draw: ImageDraw.ImageDraw, sheet: Image.Image, rows: list[dict[str, Any]], x0: int, y0: int, color: str) -> None:
    columns = 4
    gap = 10
    label_height = 24
    thumb_w = CANVAS_WIDTH // 2
    thumb_h = CANVAS_HEIGHT // 2
    for index, row in enumerate(rows[:12]):
        col = index % columns
        line = index // columns
        x = x0 + col * (thumb_w + gap)
        y = y0 + line * (thumb_h + label_height + gap)
        draw.text((x, y), f"{index + 1:02d} {float(row.get('score') or 0):05.1f}", fill=color)
        draw.text((x + 48, y), str(row.get("primaryFailureCode") or row.get("status") or "")[:15], fill="#dff8e6")
        image_path = row.get("files", {}).get("generated") if isinstance(row.get("files"), dict) else None
        if isinstance(image_path, str) and Path(image_path).exists():
            with Image.open(image_path) as image:
                thumb = image.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.BOX)
            sheet.paste(thumb, (x, y + label_height))
        draw.rectangle((x - 1, y + label_height - 1, x + thumb_w, y + label_height + thumb_h), outline=color, width=1)


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def safe_name(value: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in value)
    return safe.strip("._-")[:160] or "item"


def current_timestamp() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

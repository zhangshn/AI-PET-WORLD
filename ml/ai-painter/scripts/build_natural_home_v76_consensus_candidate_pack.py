from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import math
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


CANVAS_WIDTH = 256
CANVAS_HEIGHT = 192


def main() -> int:
    parser = ArgumentParser(description="Build a V76 consensus natural-home candidate pack from passed hidden candidates.")
    parser.add_argument("--quality-report", type=Path, action="append", required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--schema-version", default="natural-home-v76-consensus-candidate-pack-v1")
    parser.add_argument("--stage-id", default="natural-home-v76-consensus-candidate-pack")
    parser.add_argument("--accepted-status", default="passed_for_next_training")
    parser.add_argument("--min-score", type=float, default=86.0)
    parser.add_argument("--min-report-count", type=int, default=2)
    parser.add_argument("--min-safe-rows", type=int, default=16)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        preserve_runtime_dir_before_clear(args.output_root, "build-natural-home-consensus-candidate-pack")
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    reports = [read_json(path) for path in args.quality_report]
    grouped: dict[str, list[dict[str, Any]]] = {}
    rejected_sample_ids: set[str] = set()
    for report_path, report in zip(args.quality_report, reports):
        for row in [row for row in report.get("rows", []) if isinstance(row, dict)]:
            sample_id = str(row.get("sampleId", ""))
            if not sample_id:
                continue
            row = {**row, "sourceQualityReport": str(report_path.resolve()), "sourceStageId": report.get("sourceStageId")}
            if row.get("status") == args.accepted_status and float(row.get("score", 0.0)) >= args.min_score:
                grouped.setdefault(sample_id, []).append(row)
            else:
                rejected_sample_ids.add(sample_id)

    consensus_rows = [
        choose_best_row(sample_id, rows)
        for sample_id, rows in grouped.items()
        if len(rows) >= args.min_report_count and sample_id not in rejected_sample_ids
    ]
    consensus_rows.sort(key=lambda row: (-float(row.get("score", 0.0)), str(row.get("sampleId", ""))))

    packed_rows = [copy_consensus_row(row, args.output_root) for row in consensus_rows]
    contact_sheet = build_contact_sheet(packed_rows, args.output_root / "contact-sheet.png")
    status = "passed_for_next_stage" if len(packed_rows) >= args.min_safe_rows else "blocked_keep_for_history"
    manifest = {
        "schemaVersion": args.schema_version,
        "status": status,
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "consensus_hidden_training_candidate_pack_only",
        "stageId": args.stage_id,
        "sourceQualityReports": [str(path.resolve()) for path in args.quality_report],
        "summary": {
            "safeRowCount": len(packed_rows),
            "requiredSafeRows": args.min_safe_rows,
            "minReportCount": args.min_report_count,
            "minScore": args.min_score,
            "averageScore": round_float(average([float(row.get("score", 0)) for row in packed_rows])),
            "bestScore": round_float(max([float(row.get("score", 0)) for row in packed_rows], default=0)),
            "worstScore": round_float(min([float(row.get("score", 0)) for row in packed_rows], default=0)),
        },
        "contactSheet": str(contact_sheet.resolve()),
        "rows": packed_rows,
        "note": "V76 consensus candidate pack only. A sample must pass the configured hidden quality reports and score gates before it can become a distillation target. This is not VisualJudge approval and cannot enter /world.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "consensus-candidate-pack.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def choose_best_row(sample_id: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    best = max(rows, key=lambda row: (float(row.get("score", 0.0)), str(row.get("sourceStageId", ""))))
    return {
        **best,
        "sampleId": sample_id,
        "consensusReportCount": len(rows),
        "consensusScores": [float(row.get("score", 0.0)) for row in rows],
    }


def copy_consensus_row(row: dict[str, Any], output_root: Path) -> dict[str, Any]:
    sample_id = str(row["sampleId"])
    output_dir = output_root / "safe" / safe_name(sample_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_source = Path(str(row["generated"]))
    target_source = Path(str(row["target"]))
    generated = output_dir / "generated.png"
    target = output_dir / "target.png"
    shutil.copy2(generated_source, generated)
    shutil.copy2(target_source, target)
    contact_sheet = output_dir / "contact-sheet.png"
    build_pair_sheet(target, generated, sample_id, contact_sheet)

    packed = {
        "sampleId": sample_id,
        "status": "strict_safe_candidate",
        "score": row.get("score"),
        "consensusReportCount": row.get("consensusReportCount"),
        "consensusScores": row.get("consensusScores"),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "generated": str(generated.resolve()),
        "target": str(target.resolve()),
        "blueprint": row.get("blueprint"),
        "contactSheet": str(contact_sheet.resolve()),
        "sha256": hashlib.sha256(generated.read_bytes()).hexdigest(),
        "activeChannels": row.get("metrics", {}).get("condition", {}).get("activeChannels", []),
        "activeAreas": row.get("metrics", {}).get("condition", {}).get("activeAreas", {}),
        "sourceQualityReport": row.get("sourceQualityReport"),
        "sourceStageId": row.get("sourceStageId"),
    }
    write_json(output_dir / "latest.json", packed)
    return packed


def build_pair_sheet(target_path: Path, generated_path: Path, sample_id: str, output_path: Path) -> None:
    sheet = Image.new("RGB", (CANVAS_WIDTH * 2 + 24, CANVAS_HEIGHT + 34), "#071510")
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 6), sample_id[:62], fill="#dff8e6")
    with Image.open(target_path) as target, Image.open(generated_path) as generated:
        sheet.paste(target.convert("RGB"), (8, 34))
        sheet.paste(generated.convert("RGB"), (CANVAS_WIDTH + 16, 34))
    sheet.save(output_path)


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
        draw.text((x, y), f"{index + 1:02d} {float(row.get('score', 0)):05.1f} consensus", fill="#79f2a6")
        draw.text((x, y + 15), str(row.get("sampleId", ""))[:36], fill="#dff8e6")
        with Image.open(str(row["generated"])) as image:
            sheet.paste(image.convert("RGB"), (x, y + label_height))
    sheet.save(output_path)
    return output_path


def safe_name(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in value)[:160]


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

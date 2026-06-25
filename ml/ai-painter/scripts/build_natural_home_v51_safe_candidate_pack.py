from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import math
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

CANVAS_WIDTH = 256
CANVAS_HEIGHT = 192


def main() -> int:
    parser = ArgumentParser(description="Build a strict safe natural-home candidate pack from V50 audit rows.")
    parser.add_argument("--v50-report", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--schema-version", default="natural-home-v51-safe-candidate-pack-v1")
    parser.add_argument("--stage-id", default="natural-home-v51-safe-candidate-pack")
    parser.add_argument("--min-safe-rows", type=int, default=30)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    report = read_json(args.v50_report)
    rows = [row for row in report.get("rows", []) if isinstance(row, dict)]
    safe_rows = [row for row in rows if row.get("strictPass") is True and not row.get("failures")]
    safe_rows.sort(key=lambda row: (-float(row.get("score", 0)), str(row.get("sampleId", ""))))

    packed_rows = [copy_safe_row(row, args.output_root) for row in safe_rows]
    contact_sheet = build_contact_sheet(packed_rows, args.output_root / "contact-sheet.png")
    status = "passed_for_next_stage" if len(packed_rows) >= args.min_safe_rows else "blocked_keep_for_history"
    manifest = {
        "schemaVersion": args.schema_version,
        "status": status,
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "strict_safe_training_candidate_pack_only",
        "stageId": args.stage_id,
        "sourceV50Report": str(args.v50_report.resolve()),
        "sourceStageId": report.get("stageId"),
        "summary": {
            "safeRowCount": len(packed_rows),
            "requiredSafeRows": args.min_safe_rows,
            "averageScore": round_float(average([float(row.get("score", 0)) for row in packed_rows])),
            "bestScore": round_float(max([float(row.get("score", 0)) for row in packed_rows], default=0)),
            "worstScore": round_float(min([float(row.get("score", 0)) for row in packed_rows], default=0)),
            "uniqueSourceCount": len({row.get("sourceId") for row in packed_rows}),
            "uniqueVariantCount": len({row.get("variant") for row in packed_rows}),
        },
        "contactSheet": str(contact_sheet.resolve()),
        "rows": packed_rows,
        "note": "Strict safe candidate pack only. Rows with water artifacts, warnings or any failure are excluded. This is still not VisualJudge approval and cannot enter /world.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "safe-candidate-pack.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def copy_safe_row(row: dict[str, Any], output_root: Path) -> dict[str, Any]:
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
        "sourceId": row.get("sourceId"),
        "variant": row.get("variant"),
        "status": "strict_safe_candidate",
        "score": row.get("score"),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "generated": str(generated.resolve()),
        "target": str(target.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "sha256": hashlib.sha256(generated.read_bytes()).hexdigest(),
        "activeChannels": row.get("activeChannels", []),
        "activeAreas": row.get("activeAreas", {}),
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
        draw.text((x, y), f"{index + 1:02d} {float(row.get('score', 0)):05.1f} safe", fill="#79f2a6")
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

from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter, defaultdict
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH


VARIANT_BASE_WEIGHTS: dict[str, int] = {
    "copy": 1,
    "hflip": 1,
    "shift-northwest": 2,
    "shift-southeast": 2,
    "remix-water-rock": 2,
    "remix-road-tree": 2,
}


def main() -> int:
    parser = ArgumentParser(description="Prepare V45 natural-home generalization dataset indexes.")
    parser.add_argument("--source-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v28-real-mask-remix-dataset"))
    parser.add_argument("--quality-report", type=Path, default=Path(".runtime/ai-painter/natural-home-v32-quality-selection/latest.json"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v45-generalization-dataset"))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    train_source_ids = read_index(args.source_root / "indexes" / "train.json")
    validation_source_ids = read_index(args.source_root / "indexes" / "validation.json")
    all_ids = sorted(set(train_source_ids + validation_source_ids))
    if not all_ids:
        raise ValueError(f"source dataset has no samples: {args.source_root}")

    copy_samples(args.source_root, args.output_root, all_ids)
    quality_rows = read_quality_rows(args.quality_report)
    weighted_train_ids, weighting_summary = build_weighted_train_ids(train_source_ids, quality_rows)
    validation_ids = build_validation_ids(validation_source_ids)

    indexes = args.output_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    write_json(indexes / "train.json", {"schemaVersion": "dataset-index-v1", "split": "train", "sampleIds": weighted_train_ids})
    write_json(indexes / "validation.json", {"schemaVersion": "dataset-index-v1", "split": "validation", "sampleIds": validation_ids})

    contact_sheet = build_contact_sheet(args.output_root, unique_in_order(weighted_train_ids)[:12], args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": "natural-home-v45-generalization-dataset-v1",
        "status": "completed",
        "stageId": "natural-home-v45-generalization-dataset",
        "sourceRoot": str(args.source_root.resolve()),
        "qualityReport": str(args.quality_report.resolve()) if args.quality_report.exists() else None,
        "uniqueCopiedSampleCount": len(all_ids),
        "baseTrainCount": len(train_source_ids),
        "weightedTrainCount": len(weighted_train_ids),
        "validationCount": len(validation_ids),
        "sourceCoverageCount": len({source_id(sample_id) for sample_id in train_source_ids}),
        "variantCoverage": dict(sorted(Counter(variant_id(sample_id) for sample_id in train_source_ids).items())),
        "weightingSummary": weighting_summary,
        "contactSheet": str(contact_sheet.resolve()),
        "policy": {
            "targetAndMasksStaySameSource": True,
            "noPngGuessing": True,
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "purpose": "Improve local model generalization by balanced repeated indexes; no new player-facing art is created here.",
        },
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_index(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    values = data.get("sampleIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise ValueError(f"invalid dataset index: {path}")
    return values


def read_quality_rows(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("rows")
    if not isinstance(rows, list):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        if isinstance(row, dict) and isinstance(row.get("sampleId"), str):
            result[str(row["sampleId"])] = row
    return result


def copy_samples(source_root: Path, output_root: Path, sample_ids: list[str]) -> None:
    source_scene_root = source_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = output_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root.mkdir(parents=True, exist_ok=True)
    for sample_id in sample_ids:
        source_dir = source_scene_root / sample_id
        output_dir = output_scene_root / sample_id
        if output_dir.exists():
            continue
        shutil.copytree(source_dir, output_dir)


def build_weighted_train_ids(sample_ids: list[str], quality_rows: dict[str, dict[str, Any]]) -> tuple[list[str], dict[str, Any]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    repeat_counter: Counter[int] = Counter()
    weighted_by_variant: Counter[str] = Counter()
    weighted_by_status: Counter[str] = Counter()

    for sample_id in sample_ids:
        grouped[source_id(sample_id)].append(sample_id)

    weighted: list[str] = []
    for source in sorted(grouped):
        for sample_id in sorted(grouped[source], key=variant_sort_key):
            repeat = repeat_count(sample_id, quality_rows.get(sample_id))
            repeat_counter[repeat] += 1
            weighted_by_variant[variant_id(sample_id)] += repeat
            weighted_by_status[quality_status(quality_rows.get(sample_id))] += repeat
            weighted.extend([sample_id] * repeat)

    return weighted, {
        "uniqueTrainCount": len(sample_ids),
        "weightedTrainCount": len(weighted),
        "repeatDistribution": {str(key): value for key, value in sorted(repeat_counter.items())},
        "weightedByVariant": dict(sorted(weighted_by_variant.items())),
        "weightedByQualityStatus": dict(sorted(weighted_by_status.items())),
        "strategy": "balanced variants plus light V32 low-score reinforcement; no failure-only overfit",
    }


def build_validation_ids(sample_ids: list[str]) -> list[str]:
    return sorted(sample_ids, key=lambda sample_id: (source_id(sample_id), variant_sort_key(sample_id)))


def repeat_count(sample_id: str, quality_row: dict[str, Any] | None) -> int:
    repeat = VARIANT_BASE_WEIGHTS.get(variant_id(sample_id), 1)
    status = quality_status(quality_row)
    score = score_value(quality_row)
    if status == "rejected_training_candidate":
        repeat += 1
    elif status == "review_candidate":
        repeat += 1
    if score is not None and score < 78:
        repeat += 1
    return min(repeat, 4)


def quality_status(row: dict[str, Any] | None) -> str:
    status = row.get("status") if isinstance(row, dict) else None
    return str(status) if isinstance(status, str) else "not_in_v32_selection"


def score_value(row: dict[str, Any] | None) -> float | None:
    if not isinstance(row, dict):
        return None
    score = row.get("score")
    return float(score) if isinstance(score, int | float) else None


def variant_sort_key(sample_id: str) -> tuple[int, str]:
    order = {
        "copy": 0,
        "hflip": 1,
        "shift-northwest": 2,
        "shift-southeast": 3,
        "remix-water-rock": 4,
        "remix-road-tree": 5,
    }
    variant = variant_id(sample_id)
    return order.get(variant, 99), variant


def source_id(sample_id: str) -> str:
    return sample_id.split("__v28-", 1)[0]


def variant_id(sample_id: str) -> str:
    if "__v28-" not in sample_id:
        return "source"
    return sample_id.split("__v28-", 1)[1]


def unique_in_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def build_contact_sheet(output_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 20
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        target_path = output_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id / "target.png"
        if not target_path.exists():
            continue
        with Image.open(target_path) as image:
            target = image.convert("RGB")
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), compact_label(sample_id), fill="#dff8e6")
        sheet.paste(target, (x, y + label_height))
    sheet.save(output_path)
    return output_path


def compact_label(sample_id: str) -> str:
    return sample_id.replace("natural-home-", "")[:32]


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

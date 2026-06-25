from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH
from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


def main() -> int:
    parser = ArgumentParser(description="Prepare a failure-weighted natural-home dataset for local refiner repair.")
    parser.add_argument("--source-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v28-real-mask-remix-dataset"))
    parser.add_argument("--quality-report", type=Path, default=Path(".runtime/ai-painter/natural-home-v37-quality-selection/latest.json"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v39-failure-focus-dataset"))
    parser.add_argument("--failure-repeat", type=int, default=6)
    parser.add_argument("--low-pass-repeat", type=int, default=2)
    parser.add_argument("--low-pass-score", type=float, default=80.0)
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    output_root = args.output_root.resolve()
    ensure_runtime_output(output_root)
    if output_root.exists():
        preserve_runtime_dir_before_clear(output_root, "prepare-natural-home-failure-focus-dataset")
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    train_ids = read_index(source_root / "indexes" / "train.json")
    validation_ids = read_index(source_root / "indexes" / "validation.json")
    all_ids = sorted(set(train_ids + validation_ids))
    copy_samples(source_root, output_root, all_ids)

    report = read_json(args.quality_report)
    rows = [row for row in report.get("rows", []) if isinstance(row, dict)]
    failed_ids = [
        str(row["sampleId"])
        for row in rows
        if row.get("status") == "rejected_training_candidate" and isinstance(row.get("sampleId"), str)
    ]
    low_pass_ids = [
        str(row["sampleId"])
        for row in rows
        if row.get("status") == "passed_for_next_training"
        and isinstance(row.get("sampleId"), str)
        and float(row.get("score", 100.0)) < args.low_pass_score
    ]

    weighted_train_ids = list(train_ids)
    for sample_id in failed_ids:
        weighted_train_ids.extend([sample_id] * max(0, args.failure_repeat))
    for sample_id in low_pass_ids:
        weighted_train_ids.extend([sample_id] * max(0, args.low_pass_repeat))

    indexes = output_root / "indexes"
    indexes.mkdir(parents=True, exist_ok=True)
    write_json(indexes / "train.json", {"schemaVersion": "dataset-index-v1", "split": "train", "sampleIds": weighted_train_ids})
    write_json(indexes / "validation.json", {"schemaVersion": "dataset-index-v1", "split": "validation", "sampleIds": validation_ids})

    focus_ids = failed_ids + [sample_id for sample_id in low_pass_ids if sample_id not in failed_ids]
    contact_sheet = build_contact_sheet(output_root, focus_ids[:12] or all_ids[:12], output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": "natural-home-failure-focus-dataset-v1",
        "status": "completed",
        "stageId": "natural-home-v39-failure-focus-dataset",
        "sourceRoot": str(source_root),
        "qualityReport": str(args.quality_report.resolve()),
        "outputRoot": str(output_root),
        "baseTrainCount": len(train_ids),
        "baseValidationCount": len(validation_ids),
        "weightedTrainCount": len(weighted_train_ids),
        "failedFocusCount": len(failed_ids),
        "lowPassFocusCount": len(low_pass_ids),
        "failureRepeat": args.failure_repeat,
        "lowPassRepeat": args.low_pass_repeat,
        "lowPassScore": args.low_pass_score,
        "failedSampleIds": failed_ids,
        "lowPassSampleIds": low_pass_ids,
        "contactSheet": str(contact_sheet),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "policy": {
            "purpose": "Weight known failed hidden candidates for the next local model training round.",
            "source": "Uses existing same-source target.png, blueprint.v1.json and masks_v1; it does not draw new player-facing content.",
            "worldDisplay": "Never enters /world directly. It can only improve later hidden candidates.",
        },
    }
    write_json(output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def ensure_runtime_output(output_root: Path) -> None:
    parts = {part.lower() for part in output_root.parts}
    if ".runtime" not in parts or "ai-painter" not in parts:
        raise ValueError(f"refuse to overwrite non-runtime dataset root: {output_root}")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_index(path: Path) -> list[str]:
    data = read_json(path)
    values = data.get("sampleIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise ValueError(f"invalid index: {path}")
    return values


def copy_samples(source_root: Path, output_root: Path, sample_ids: list[str]) -> None:
    source_scene_root = source_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = output_root / "accepted" / "dataset_v0" / "scene" / "world"
    for sample_id in sample_ids:
        source_dir = source_scene_root / sample_id
        output_dir = output_scene_root / sample_id
        if not source_dir.exists():
            raise ValueError(f"missing source sample: {source_dir}")
        shutil.copytree(source_dir, output_dir)


def build_contact_sheet(dataset_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 20
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    for index, sample_id in enumerate(sample_ids):
        target_path = scene_root / sample_id / "target.png"
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
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


def compact_label(sample_id: str) -> str:
    if "__v28-" in sample_id:
        source, variant = sample_id.split("__v28-", 1)
        return f"{source.replace('natural-home-', '')[:18]} / {variant[:10]}"
    return sample_id[:30]


if __name__ == "__main__":
    raise SystemExit(main())

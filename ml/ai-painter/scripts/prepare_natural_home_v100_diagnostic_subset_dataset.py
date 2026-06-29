from __future__ import annotations

from argparse import ArgumentParser
from datetime import UTC, datetime
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH
from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


def main() -> int:
    parser = ArgumentParser(description="Prepare V100 diagnostic subset dataset from an existing natural-home dataset.")
    parser.add_argument("--source-dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--stage-id", default="natural-home-v100-diagnostic-subset-dataset")
    parser.add_argument("--sample-limit", type=int, default=8)
    parser.add_argument("--validation-limit", type=int, default=2)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        preserve_runtime_dir_before_clear(args.output_root, "prepare-natural-home-v100-diagnostic-subset")
        shutil.rmtree(args.output_root)

    source_scene_root = args.source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "indexes").mkdir(parents=True, exist_ok=True)

    train_ids = read_index(args.source_dataset_root / "indexes" / "train.json")
    validation_ids = read_index(args.source_dataset_root / "indexes" / "validation.json")
    selected_train = diverse_source_ids(train_ids, args.sample_limit)
    selected_validation = diverse_source_ids(validation_ids, args.validation_limit)
    if not selected_validation:
        selected_validation = selected_train[: max(1, min(args.validation_limit, len(selected_train)))]

    for sample_id in unique_preserve_order(selected_train + selected_validation):
        source = source_scene_root / sample_id
        target = output_scene_root / sample_id
        if not source.is_dir():
            raise FileNotFoundError(f"sample not found: {source}")
        shutil.copytree(source, target)

    write_index(args.output_root, "train", selected_train)
    write_index(args.output_root, "validation", selected_validation)
    contact_sheet = build_contact_sheet(output_scene_root, unique_preserve_order(selected_train + selected_validation), args.output_root / "contact-sheet.png")

    manifest = {
        "schemaVersion": "natural-home-v100-diagnostic-subset-dataset-v1",
        "status": "completed",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "createdAt": datetime.now(UTC).isoformat(),
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "trainSampleCount": len(selected_train),
        "validationSampleCount": len(selected_validation),
        "sampleCount": len(unique_preserve_order(selected_train + selected_validation)),
        "sampleIds": unique_preserve_order(selected_train + selected_validation),
        "contactSheet": str(contact_sheet.resolve()),
        "purpose": "V100 diagnostic subset: prove small-batch reproducibility before continuing broad training.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_index(path: Path) -> list[str]:
    data = read_json(path)
    sample_ids = data.get("sampleIds")
    if not isinstance(sample_ids, list) or not all(isinstance(value, str) for value in sample_ids):
        raise ValueError(f"invalid index: {path}")
    return sample_ids


def write_index(root: Path, split: str, sample_ids: list[str]) -> None:
    write_json(
        root / "indexes" / f"{split}.json",
        {
            "schemaVersion": "dataset-index-v1",
            "split": split,
            "sampleIds": sample_ids,
            "count": len(sample_ids),
        },
    )


def diverse_source_ids(sample_ids: list[str], limit: int) -> list[str]:
    selected: list[str] = []
    seen_sources: set[str] = set()
    for sample_id in sample_ids:
        source = source_id(sample_id)
        if source in seen_sources:
            continue
        seen_sources.add(source)
        selected.append(sample_id)
        if len(selected) >= limit:
            return selected
    for sample_id in sample_ids:
        if sample_id in selected:
            continue
        selected.append(sample_id)
        if len(selected) >= limit:
            break
    return selected


def source_id(sample_id: str) -> str:
    return (
        sample_id.split("__v28-", 1)[0]
        .split("__v96focus", 1)[0]
        .split("__v97repair", 1)[0]
        .split("__v98repair", 1)[0]
        .split("__v99repair", 1)[0]
        .split("__v100", 1)[0]
    )


def build_contact_sheet(scene_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 26
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    row_count = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, row_count * cell_h + (row_count + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        target_path = scene_root / sample_id / "target.png"
        with Image.open(target_path) as image:
            target = image.convert("RGB")
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), sample_id.replace("natural-home-", "")[:34], fill="#dff8e6")
        sheet.paste(target, (x, y + label_height))
    sheet.save(output_path)
    return output_path


def unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

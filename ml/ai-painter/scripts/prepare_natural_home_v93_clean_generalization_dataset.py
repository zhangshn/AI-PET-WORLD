from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH
from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


FORBIDDEN_TOKENS = {
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

VARIANT_REPEAT_WEIGHTS = {
    "copy": 1,
    "hflip": 1,
    "shift-northwest": 2,
    "shift-southeast": 2,
    "remix-water-rock": 2,
    "remix-road-tree": 2,
}


def main() -> int:
    parser = ArgumentParser(description="Prepare V93 clean natural-home generalization dataset.")
    parser.add_argument("--source-dataset-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v45-generalization-dataset"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v93-clean-generalization-dataset"))
    parser.add_argument("--validation-count", type=int, default=24)
    parser.add_argument("--stage-id", default="natural-home-v93-clean-generalization-dataset")
    parser.add_argument("--training-target-source", default="v45_clean_natural_original_target_png")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        preserve_runtime_dir_before_clear(args.output_root, "prepare-natural-home-v93-clean-generalization-dataset")
        shutil.rmtree(args.output_root)

    source_scene_root = args.source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "indexes").mkdir(parents=True, exist_ok=True)

    source_train = read_index(args.source_dataset_root / "indexes" / "train.json")
    source_validation = read_index(args.source_dataset_root / "indexes" / "validation.json")
    unique_source_ids = unique_sorted(source_train + source_validation)
    clean_ids, rejected_rows = split_clean_ids(unique_source_ids)
    if len(clean_ids) < 32:
        raise ValueError(f"V93 clean generalization requires at least 32 clean samples, got {len(clean_ids)}")

    validation_count = max(4, min(args.validation_count, len(clean_ids) // 4))
    validation_ids = pick_validation_ids(clean_ids, validation_count)
    validation_set = set(validation_ids)
    train_unique = [sample_id for sample_id in clean_ids if sample_id not in validation_set]
    train_ids = sorted(train_unique, key=lambda value: (source_id(value), variant_sort_key(value)))

    for sample_id in clean_ids:
        copy_sample(source_scene_root, output_scene_root, sample_id, args.stage_id, args.training_target_source)

    write_index(args.output_root, "train", train_ids)
    write_index(args.output_root, "validation", validation_ids)
    contact_sheet = build_contact_sheet(output_scene_root, clean_ids[:18], args.output_root / "contact-sheet.png")

    manifest = {
        "schemaVersion": "natural-home-v93-clean-generalization-dataset-v1",
        "status": "completed",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "trainingTargetSource": args.training_target_source,
        "sourceSampleCount": len(unique_source_ids),
        "cleanUniqueSampleCount": len(clean_ids),
        "rejectedSampleCount": len(rejected_rows),
        "trainUniqueSampleCount": len(train_unique),
        "trainSampleCount": len(train_ids),
        "validationSampleCount": len(validation_ids),
        "sampleCount": len(train_ids) + len(validation_ids),
        "forbiddenTokens": sorted(FORBIDDEN_TOKENS),
        "variantCoverage": dict(sorted(Counter(variant_id(sample_id) for sample_id in clean_ids).items())),
        "sourceCoverageCount": len({source_id(sample_id) for sample_id in clean_ids}),
        "rejectedReasonCounts": summarize_rejections(rejected_rows),
        "contactSheet": str(contact_sheet.resolve()),
        "policy": {
            "targetAndMasksStaySameSource": True,
            "noPngGuessing": True,
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "purpose": "Clean current-MVP natural-home generalization training. Excludes names with building, settlement, shelter, character, animal, or construction semantics.",
        },
        "rejectedRowsPath": str((args.output_root / "rejected-rows.json").resolve()),
        "rejectedRowsPreview": rejected_rows[:24],
    }
    write_json(args.output_root / "manifest.json", manifest)
    write_json(args.output_root / "rejected-rows.json", {
        "schemaVersion": "natural-home-v93-clean-generalization-rejected-rows-v1",
        "stageId": args.stage_id,
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "rejectedSampleCount": len(rejected_rows),
        "rejectedReasonCounts": summarize_rejections(rejected_rows),
        "rows": rejected_rows,
    })
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_index(path: Path) -> list[str]:
    data = read_json(path)
    sample_ids = data.get("sampleIds")
    if not isinstance(sample_ids, list) or not all(isinstance(value, str) for value in sample_ids):
        raise ValueError(f"invalid index: {path}")
    return sample_ids


def split_clean_ids(sample_ids: list[str]) -> tuple[list[str], list[dict[str, Any]]]:
    clean: list[str] = []
    rejected: list[dict[str, Any]] = []
    for sample_id in sample_ids:
        lower = sample_id.lower()
        hits = sorted(token for token in FORBIDDEN_TOKENS if token in lower)
        if hits:
            rejected.append({"sampleId": sample_id, "reasons": hits})
        else:
            clean.append(sample_id)
    return clean, rejected


def copy_sample(source_scene_root: Path, output_scene_root: Path, sample_id: str, stage_id: str, training_target_source: str) -> None:
    source_sample = source_scene_root / sample_id
    target_sample = output_scene_root / sample_id
    if not source_sample.exists():
        raise ValueError(f"missing source sample: {sample_id}")
    if target_sample.exists():
        shutil.rmtree(target_sample)
    shutil.copytree(source_sample, target_sample)

    source_target = target_sample / "source-target.png"
    shutil.copy2(target_sample / "target.png", source_target)

    metadata_path = target_sample / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["stageId"] = stage_id
    metadata["trainingTargetSource"] = training_target_source
    metadata["sourceOriginalTarget"] = str(source_target.resolve())
    metadata["displayAllowed"] = False
    metadata["canPromoteToWorld"] = False
    write_json(metadata_path, metadata)


def pick_validation_ids(sample_ids: list[str], validation_count: int) -> list[str]:
    by_source: dict[str, list[str]] = {}
    for sample_id in sample_ids:
        by_source.setdefault(source_id(sample_id), []).append(sample_id)
    picked: list[str] = []
    for source in sorted(by_source):
        variants = sorted(by_source[source], key=variant_sort_key)
        picked.append(variants[-1])
        if len(picked) >= validation_count:
            break
    if len(picked) < validation_count:
        for sample_id in sample_ids:
            if sample_id in picked:
                continue
            picked.append(sample_id)
            if len(picked) >= validation_count:
                break
    return sorted(picked, key=lambda value: (source_id(value), variant_sort_key(value)))


def summarize_rejections(rows: list[dict[str, Any]]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for row in rows:
        reasons = row.get("reasons")
        if isinstance(reasons, list):
            counter.update(str(reason) for reason in reasons)
    return dict(sorted(counter.items()))


def build_contact_sheet(scene_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 22
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
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
    sheet.save(output_path)
    return output_path


def source_id(sample_id: str) -> str:
    return sample_id.split("__v28-", 1)[0]


def variant_id(sample_id: str) -> str:
    if "__v28-" not in sample_id:
        return "source"
    return sample_id.split("__v28-", 1)[1]


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


def compact_label(sample_id: str) -> str:
    return sample_id.replace("natural-home-", "")[:34]


def unique_sorted(values: list[str]) -> list[str]:
    return sorted(set(values), key=lambda value: (source_id(value), variant_sort_key(value)))


def write_index(root: Path, split: str, sample_ids: list[str]) -> None:
    write_json(root / "indexes" / f"{split}.json", {
        "schemaVersion": "dataset-index-v1",
        "split": split,
        "sampleIds": sample_ids,
    })


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

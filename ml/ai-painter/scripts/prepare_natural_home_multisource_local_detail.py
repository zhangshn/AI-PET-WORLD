from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS


NATURAL_CATEGORIES: dict[str, tuple[str, ...]] = {
    "grass": ("grass",),
    "water": ("water_body",),
    "shoreline": ("shoreline",),
    "road": ("road_center", "road_edge"),
    "tree": ("tree_trunk", "tree_crown"),
    "rock": ("rock",),
}

FORBIDDEN_CHANNELS = ("shelter_foundation", "shelter_wall", "shelter_roof", "construction_material")


def main() -> int:
    parser = ArgumentParser(description="Prepare multi-source natural-home local detail patches.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--patches-per-source", type=int, default=2)
    parser.add_argument("--train-per-category", type=int, default=36)
    parser.add_argument("--validation-per-category", type=int, default=12)
    args = parser.parse_args()

    if args.patch_size % 8 != 0:
        raise ValueError("patch-size must be divisible by 8.")
    if args.patches_per_source < 1:
        raise ValueError("patches-per-source must be >= 1.")
    if args.train_per_category < 1 or args.validation_per_category < 1:
        raise ValueError("train and validation limits must be >= 1.")
    if args.output_root.exists():
        shutil.rmtree(args.output_root)

    manifest = read_json(args.dataset_root / "dataset-manifest.json")
    train_source_ids = read_index(args.dataset_root / "indexes" / "train.json")
    validation_source_ids = read_index(args.dataset_root / "indexes" / "validation.json")
    if not train_source_ids or not validation_source_ids:
        sample_ids = [value for value in manifest.get("sampleIds", []) if isinstance(value, str)]
        split = max(1, int(len(sample_ids) * 0.75))
        train_source_ids = sample_ids[:split]
        validation_source_ids = sample_ids[split:]

    category_results: dict[str, object] = {}
    for category, focus_channels in NATURAL_CATEGORIES.items():
        train_samples = collect_category_patches(
            args.dataset_root,
            train_source_ids,
            category,
            focus_channels,
            args.patch_size,
            args.patches_per_source,
            args.train_per_category,
        )
        validation_samples = collect_category_patches(
            args.dataset_root,
            validation_source_ids,
            category,
            focus_channels,
            args.patch_size,
            args.patches_per_source,
            args.validation_per_category,
        )
        if not train_samples:
            raise ValueError(f"no train patches for category: {category}")
        if not validation_samples:
            raise ValueError(f"no validation patches for category: {category}")

        category_root = args.output_root / category
        train_ids = write_samples(category_root, train_samples)
        validation_ids = write_samples(category_root, validation_samples)
        write_json(category_root / "train.json", {"sampleIds": train_ids})
        write_json(category_root / "validation.json", {"sampleIds": validation_ids})
        category_results[category] = {
            "status": "completed",
            "focusChannels": list(focus_channels),
            "trainSampleCount": len(train_ids),
            "validationSampleCount": len(validation_ids),
            "trainSourceCount": len({sample["sourceId"] for sample in train_samples}),
            "validationSourceCount": len({sample["sourceId"] for sample in validation_samples}),
        }

    summary = {
        "schemaVersion": "natural-home-multisource-local-detail-dataset-v1",
        "status": "completed",
        "stageId": "natural-home-v1-no-building-multisource-local-details",
        "sourceDatasetRoot": str(args.dataset_root.resolve()),
        "cleanSampleCount": manifest.get("cleanSampleCount", manifest.get("sampleCount")),
        "patchSize": args.patch_size,
        "patchesPerSource": args.patches_per_source,
        "trainPerCategory": args.train_per_category,
        "validationPerCategory": args.validation_per_category,
        "categories": category_results,
        "note": "Multi-source clean natural-home patches only. No building, character, animal or butler content is trained here.",
    }
    write_json(args.output_root / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def collect_category_patches(
    dataset_root: Path,
    source_ids: list[str],
    category: str,
    focus_channels: tuple[str, ...],
    patch_size: int,
    patches_per_source: int,
    limit: int,
) -> list[dict[str, object]]:
    samples: list[dict[str, object]] = []
    for source_id in source_ids:
        source = dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / source_id
        if not source.exists():
            continue
        masks = read_masks(source)
        forbidden = np.maximum.reduce([masks[name] for name in FORBIDDEN_CHANNELS])
        focus = np.maximum.reduce([masks[name] for name in focus_channels])
        origins = choose_patch_origins(focus, forbidden, patch_size, patches_per_source)
        for index, (x, y) in enumerate(origins):
            samples.append(
                {
                    "sampleId": f"{source_id}-{category}-{index:02d}-{x}-{y}",
                    "sourceId": source_id,
                    "category": category,
                    "focusChannels": focus_channels,
                    "source": source,
                    "masks": masks,
                    "x": x,
                    "y": y,
                    "patchSize": patch_size,
                }
            )
            if len(samples) >= limit:
                return samples
    return samples


def read_masks(source: Path) -> dict[str, np.ndarray]:
    return {name: np.asarray(Image.open(source / "masks_v1" / f"{name}.png").convert("L")) for name in V1_CONDITION_CHANNELS}


def choose_patch_origins(focus: np.ndarray, forbidden: np.ndarray, patch_size: int, limit: int) -> list[tuple[int, int]]:
    height, width = focus.shape
    stride = patch_size // 2
    grid: list[tuple[int, int, int]] = []
    for y in range(0, max(1, height - patch_size + 1), stride):
        for x in range(0, max(1, width - patch_size + 1), stride):
            focus_count = int(np.count_nonzero(focus[y : y + patch_size, x : x + patch_size]))
            forbidden_count = int(np.count_nonzero(forbidden[y : y + patch_size, x : x + patch_size]))
            if focus_count >= 12 and forbidden_count == 0:
                grid.append((focus_count, x, y))
    grid.sort(key=lambda item: (-item[0], item[2], item[1]))
    selected: list[tuple[int, int]] = []
    for _score, x, y in grid:
        if all(abs(x - sx) + abs(y - sy) >= patch_size // 2 for sx, sy in selected):
            selected.append((x, y))
        if len(selected) >= limit:
            break
    return selected


def write_samples(category_root: Path, samples: list[dict[str, object]]) -> list[str]:
    sample_ids: list[str] = []
    for sample in samples:
        sample_id = str(sample["sampleId"])
        source = sample["source"]
        masks = sample["masks"]
        x = int(sample["x"])
        y = int(sample["y"])
        patch_size = int(sample["patchSize"])
        destination = category_root / "samples" / sample_id
        (destination / "masks").mkdir(parents=True, exist_ok=True)
        with Image.open(Path(source) / "target.png") as target:
            target.convert("RGB").crop((x, y, x + patch_size, y + patch_size)).save(destination / "target.png")
        for name in V1_CONDITION_CHANNELS:
            Image.fromarray(masks[name][y : y + patch_size, x : x + patch_size]).save(destination / "masks" / f"{name}.png")
        write_json(
            destination / "metadata.json",
            {
                "schemaVersion": "natural-home-local-detail-patch-sample-v1",
                "sourceId": sample["sourceId"],
                "category": sample["category"],
                "x": x,
                "y": y,
                "size": patch_size,
                "focusChannels": list(sample["focusChannels"]),
            },
        )
        sample_ids.append(sample_id)
    return sample_ids


def read_index(path: Path) -> list[str]:
    payload = read_json(path)
    values = payload.get("sampleIds", payload if isinstance(payload, list) else [])
    return [value for value in values if isinstance(value, str)]


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

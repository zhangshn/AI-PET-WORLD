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
    "shoreline": ("water_body", "shoreline"),
    "road": ("road_center", "road_edge"),
    "tree": ("tree_trunk", "tree_crown"),
    "rock": ("rock",),
}

FORBIDDEN_NATURAL_HOME_CHANNELS = (
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
)


def main() -> int:
    parser = ArgumentParser(description="Prepare pure natural-home local detail patches.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--patch-size", type=int, default=96)
    parser.add_argument("--train-patches-per-source", type=int, default=6)
    parser.add_argument("--validation-patches-per-source", type=int, default=2)
    args = parser.parse_args()

    if args.patch_size % 8 != 0:
        raise ValueError("patch-size must be divisible by 8 for the current U-Net down/up sampling.")

    if args.output_root.exists():
        shutil.rmtree(args.output_root)

    source_root = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    result: dict[str, dict[str, int]] = {}
    for category, focus_channels in NATURAL_CATEGORIES.items():
        category_root = args.output_root / category
        train_ids = prepare_split(
            args.dataset_root,
            source_root,
            category_root,
            split="train",
            focus_channels=focus_channels,
            patch_size=args.patch_size,
            patches_per_source=args.train_patches_per_source,
        )
        validation_ids = prepare_split(
            args.dataset_root,
            source_root,
            category_root,
            split="validation",
            focus_channels=focus_channels,
            patch_size=args.patch_size,
            patches_per_source=args.validation_patches_per_source,
        )
        write_json(category_root / "train.json", {"sampleIds": train_ids})
        write_json(category_root / "validation.json", {"sampleIds": validation_ids})
        result[category] = {"train": len(train_ids), "validation": len(validation_ids)}

    manifest = {
        "schemaVersion": "natural-home-local-detail-patches-v1",
        "status": "completed",
        "stageId": "natural-home-v1-no-building-local-details",
        "patchSize": args.patch_size,
        "categories": result,
        "allowedCategories": list(NATURAL_CATEGORIES),
        "forbiddenChannels": list(FORBIDDEN_NATURAL_HOME_CHANNELS),
        "note": "Pure natural-home local detail patches only. Building and construction channels are excluded.",
    }
    write_json(args.output_root / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def prepare_split(
    dataset_root: Path,
    source_root: Path,
    category_root: Path,
    *,
    split: str,
    focus_channels: tuple[str, ...],
    patch_size: int,
    patches_per_source: int,
) -> list[str]:
    source_ids = json.loads((dataset_root / "indexes" / f"{split}.json").read_text(encoding="utf-8"))["sampleIds"]
    output_ids: list[str] = []
    for source_id in source_ids:
        source = source_root / source_id
        masks = {name: np.array(Image.open(source / "masks_v1" / f"{name}.png").convert("L")) for name in V1_CONDITION_CHANNELS}
        forbidden = np.maximum.reduce([masks[name] for name in FORBIDDEN_NATURAL_HOME_CHANNELS])
        focus = np.maximum.reduce([masks[name] for name in focus_channels])
        origins = choose_patch_origins(focus, forbidden, patch_size, patches_per_source)
        for number, (x, y) in enumerate(origins):
            sample_id = f"{source_id}-{category_root.name}-{number:02d}"
            destination = category_root / "samples" / sample_id
            (destination / "masks").mkdir(parents=True, exist_ok=True)
            with Image.open(source / "target.png") as target:
                target.convert("RGB").crop((x, y, x + patch_size, y + patch_size)).save(destination / "target.png")
            for name in V1_CONDITION_CHANNELS:
                Image.fromarray(masks[name][y : y + patch_size, x : x + patch_size]).save(destination / "masks" / f"{name}.png")
            metadata = {
                "schemaVersion": "natural-home-local-detail-patch-sample-v1",
                "sourceId": source_id,
                "category": category_root.name,
                "x": x,
                "y": y,
                "size": patch_size,
                "focusChannels": list(focus_channels),
                "forbiddenPixelCount": int(np.count_nonzero(forbidden[y : y + patch_size, x : x + patch_size])),
            }
            write_json(destination / "metadata.json", metadata)
            output_ids.append(sample_id)
    return output_ids


def choose_patch_origins(focus: np.ndarray, forbidden: np.ndarray, patch_size: int, limit: int) -> list[tuple[int, int]]:
    height, width = focus.shape
    ys, xs = np.where(focus > 0)
    if not len(xs):
        return []

    centers = [
        (int(np.mean(xs)), int(np.mean(ys))),
        (int(np.percentile(xs, 25)), int(np.percentile(ys, 25))),
        (int(np.percentile(xs, 75)), int(np.percentile(ys, 25))),
        (int(np.percentile(xs, 25)), int(np.percentile(ys, 75))),
        (int(np.percentile(xs, 75)), int(np.percentile(ys, 75))),
    ]

    stride = max(12, len(xs) // max(1, limit * 2))
    for index in range(0, len(xs), stride):
        centers.append((int(xs[index]), int(ys[index])))

    origins: list[tuple[int, int]] = []
    seen: set[tuple[int, int]] = set()
    for center_x, center_y in centers:
        x = max(0, min(width - patch_size, center_x - patch_size // 2))
        y = max(0, min(height - patch_size, center_y - patch_size // 2))
        origin = (int(x), int(y))
        if origin in seen:
            continue
        seen.add(origin)
        patch_focus = focus[y : y + patch_size, x : x + patch_size]
        patch_forbidden = forbidden[y : y + patch_size, x : x + patch_size]
        if int(np.count_nonzero(patch_focus)) < 12:
            continue
        if int(np.count_nonzero(patch_forbidden)) > 0:
            continue
        origins.append(origin)
        if len(origins) >= limit:
            break
    return origins


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

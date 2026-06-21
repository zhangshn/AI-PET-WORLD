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
    parser = ArgumentParser(description="Prepare one-source local detail patches for full-scene natural-home composition.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--stride", type=int, default=32)
    parser.add_argument("--train-limit", type=int, default=8)
    parser.add_argument("--validation-limit", type=int, default=3)
    args = parser.parse_args()

    if args.patch_size % 8 != 0:
        raise ValueError("patch-size must be divisible by 8.")
    if args.output_root.exists():
        shutil.rmtree(args.output_root)

    source = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / args.source_id
    if not source.exists():
        raise FileNotFoundError(source)

    masks = read_masks(source)
    source_pixels = target_pixels(source)
    forbidden = np.maximum.reduce([masks[name] for name in FORBIDDEN_CHANNELS])
    result: dict[str, object] = {}
    style_profiles: dict[str, dict[str, list[float]]] = {args.source_id: {}}
    for category, focus_channels in NATURAL_CATEGORIES.items():
        focus = np.maximum.reduce([masks[name] for name in focus_channels])
        style = style_vector(source_pixels, focus > 0)
        style_profiles[args.source_id][category] = style
        origins = choose_patch_origins(focus, forbidden, args.patch_size, args.stride, args.train_limit + args.validation_limit)
        if not origins:
            result[category] = {"status": "skipped", "reason": "no focus pixels"}
            continue
        validation_count = min(args.validation_limit, max(1, len(origins) // 4))
        train_origins = origins[:-validation_count] or origins[:1]
        validation_origins = origins[-validation_count:]
        category_root = args.output_root / category
        train_ids = write_split_samples(source, masks, category_root, args.source_id, category, focus_channels, train_origins, args.patch_size, style)
        validation_ids = write_split_samples(
            source,
            masks,
            category_root,
            args.source_id,
            category,
            focus_channels,
            validation_origins,
            args.patch_size,
            style,
        )
        write_json(category_root / "train.json", {"sampleIds": train_ids})
        write_json(category_root / "validation.json", {"sampleIds": validation_ids})
        result[category] = {
            "status": "completed",
            "trainSampleCount": len(train_ids),
            "validationSampleCount": len(validation_ids),
            "focusChannels": list(focus_channels),
            "styleVector": style,
        }

    summary = {
        "schemaVersion": "natural-home-single-source-local-detail-dataset-v1",
        "status": "completed",
        "stageId": "natural-home-v1-no-building-single-source-compose",
        "sourceId": args.source_id,
        "patchSize": args.patch_size,
        "stride": args.stride,
        "styleVectorChannels": [
            "mean_red",
            "mean_green",
            "mean_blue",
            "std_red",
            "std_green",
            "std_blue",
            "edge_density",
            "local_contrast",
        ],
        "categories": result,
        "note": "One sourceId only. This dataset is for v14 full-scene local model composition, not for /world display.",
    }
    write_json(args.output_root / "style-profiles.json", style_profiles)
    write_json(args.output_root / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def read_masks(source: Path) -> dict[str, np.ndarray]:
    return {name: np.asarray(Image.open(source / "masks_v1" / f"{name}.png").convert("L")) for name in V1_CONDITION_CHANNELS}


def target_pixels(source: Path) -> np.ndarray:
    return np.asarray(Image.open(source / "target.png").convert("RGB"), dtype=np.float32) / 255.0


def style_vector(target: np.ndarray, focus: np.ndarray) -> list[float]:
    if not np.any(focus):
        focus = np.ones(target.shape[:2], dtype=bool)
    pixels = target[focus]
    mean = pixels.mean(axis=0)
    std = pixels.std(axis=0)
    edges = edge_magnitude(target)
    edge_focus = focus[: edges.shape[0], : edges.shape[1]]
    edge_density = float(np.mean(edges[edge_focus] > 0.08)) if np.any(edge_focus) else 0.0
    contrast = float(np.mean(np.abs(pixels - mean)))
    values = [*mean.tolist(), *std.tolist(), edge_density, contrast]
    return [round(float(max(0.0, min(1.0, value))), 6) for value in values]


def edge_magnitude(image: np.ndarray) -> np.ndarray:
    horizontal = np.abs(image[:, 1:, :] - image[:, :-1, :]).mean(axis=2)
    vertical = np.abs(image[1:, :, :] - image[:-1, :, :]).mean(axis=2)
    height = min(horizontal.shape[0], vertical.shape[0])
    width = min(horizontal.shape[1], vertical.shape[1])
    return (horizontal[:height, :width] + vertical[:height, :width]) * 0.5


def choose_patch_origins(focus: np.ndarray, forbidden: np.ndarray, patch_size: int, stride: int, limit: int) -> list[tuple[int, int]]:
    height, width = focus.shape
    grid: list[tuple[int, int, int]] = []
    stride = max(1, stride)
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


def write_split_samples(
    source: Path,
    masks: dict[str, np.ndarray],
    category_root: Path,
    source_id: str,
    category: str,
    focus_channels: tuple[str, ...],
    origins: list[tuple[int, int]],
    patch_size: int,
    style: list[float],
) -> list[str]:
    sample_ids: list[str] = []
    for index, (x, y) in enumerate(origins):
        sample_id = f"{source_id}-{category}-{index:02d}-{x}-{y}"
        destination = category_root / "samples" / sample_id
        (destination / "masks").mkdir(parents=True, exist_ok=True)
        with Image.open(source / "target.png") as target:
            target.convert("RGB").crop((x, y, x + patch_size, y + patch_size)).save(destination / "target.png")
        for name in V1_CONDITION_CHANNELS:
            Image.fromarray(masks[name][y : y + patch_size, x : x + patch_size]).save(destination / "masks" / f"{name}.png")
        write_json(
            destination / "metadata.json",
            {
                "schemaVersion": "natural-home-local-detail-patch-sample-v1",
                "sourceId": source_id,
                "category": category,
                "x": x,
                "y": y,
                "size": patch_size,
                "focusChannels": list(focus_channels),
                "styleVector": style,
            },
        )
        sample_ids.append(sample_id)
    return sample_ids


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

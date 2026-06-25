from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS


PATCH_SIZE = 128

MVP_LOCAL_EXPERTS = {
    "grass_ground": ("grass", "walkable"),
    "road_path": ("road_center", "road_edge"),
    "water_shoreline": ("water_body", "shoreline"),
    "tree_bush": ("tree_trunk", "tree_crown"),
    "rock_terrain": ("rock",),
    "open_ground": ("grass", "walkable", "depth"),
}

EXCLUDED_BUILDING_CHANNELS = (
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
)

JITTER_OFFSETS = (
    (0, 0),
    (-20, 0),
    (20, 0),
    (0, -16),
    (0, 16),
    (-14, -12),
    (14, 12),
)


def main() -> int:
    parser = ArgumentParser(
        description="Prepare V68 MVP natural-home local expert patches without construction/building categories."
    )
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--sample-limit", type=int, default=80)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise FileExistsError(f"output root exists, pass --force to replace: {args.output_root}")
        shutil.rmtree(args.output_root)

    source_root = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    limit_source_indexes(args.dataset_root, args.output_root, args.sample_limit)
    result = {
        "schemaVersion": "natural-home-v68-local-expert-patches-v1",
        "status": "completed",
        "mvpScope": "natural_home_without_construction_or_buildings",
        "patchSize": PATCH_SIZE,
        "categories": {},
    }
    previews = []

    for category, focus_channels in MVP_LOCAL_EXPERTS.items():
        category_root = args.output_root / category
        train_ids = prepare_split(args.output_root, source_root, category_root, "train", category, focus_channels, jitter=True)
        validation_ids = prepare_split(args.output_root, source_root, category_root, "validation", category, focus_channels, jitter=False)
        write_json(category_root / "train.json", {"sampleIds": train_ids, "count": len(train_ids)})
        write_json(category_root / "validation.json", {"sampleIds": validation_ids, "count": len(validation_ids)})
        result["categories"][category] = {
            "focusChannels": list(focus_channels),
            "trainCount": len(train_ids),
            "validationCount": len(validation_ids),
            "status": "ready" if train_ids and validation_ids else "blocked",
        }
        preview = build_preview(category_root, category)
        if preview:
            previews.append((category, preview))

    write_json(args.output_root / "manifest.json", result)
    build_contact_sheet(previews, args.output_root / "patch-preview.png")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def limit_source_indexes(dataset_root: Path, output_root: Path, sample_limit: int) -> None:
    index_root = output_root / "source-indexes"
    index_root.mkdir(parents=True, exist_ok=True)
    for split in ("train", "validation"):
        source_index = dataset_root / "indexes" / f"{split}.json"
        data = json.loads(source_index.read_text(encoding="utf-8"))
        raw_ids = data.get("sampleIds", [])
        deduped = []
        seen = set()
        for sample_id in raw_ids:
            if not isinstance(sample_id, str) or sample_id in seen:
                continue
            seen.add(sample_id)
            deduped.append(sample_id)
            if len(deduped) >= sample_limit:
                break
        write_json(index_root / f"{split}.json", {"sampleIds": deduped, "count": len(deduped)})


def prepare_split(
    dataset_root: Path,
    source_root: Path,
    category_root: Path,
    split: str,
    category: str,
    focus_channels: tuple[str, ...],
    *,
    jitter: bool,
) -> list[str]:
    index_path = dataset_root / "source-indexes" / f"{split}.json"
    source_ids = json.loads(index_path.read_text(encoding="utf-8"))["sampleIds"]
    output_ids = []
    offsets = JITTER_OFFSETS if jitter else ((0, 0),)

    for source_id in source_ids:
        source = source_root / source_id
        if not source.is_dir():
            continue
        with Image.open(source / "target.png") as target_image:
            target = target_image.convert("RGB")
        masks = {
            name: np.array(Image.open(source / "masks_v1" / f"{name}.png").convert("L"), dtype=np.uint8)
            for name in V1_CONDITION_CHANNELS
        }
        focus = np.maximum.reduce([masks[name] for name in focus_channels])
        excluded = np.maximum.reduce([masks[name] for name in EXCLUDED_BUILDING_CHANNELS])
        x_values, y_values = focus_centers(focus, category)
        if not x_values:
            continue

        for center_index, (center_x, center_y) in enumerate(zip(x_values, y_values)):
            for offset_index, (dx, dy) in enumerate(offsets):
                x = clamp(center_x - PATCH_SIZE // 2 + dx, 0, target.width - PATCH_SIZE)
                y = clamp(center_y - PATCH_SIZE // 2 + dy, 0, target.height - PATCH_SIZE)
                if should_skip_patch(focus, excluded, x, y):
                    continue
                sample_id = f"{source_id}-{center_index:02d}-{offset_index:02d}"
                destination = category_root / "samples" / sample_id
                (destination / "masks").mkdir(parents=True, exist_ok=True)
                target.crop((x, y, x + PATCH_SIZE, y + PATCH_SIZE)).save(destination / "target.png")
                for name in V1_CONDITION_CHANNELS:
                    Image.fromarray(masks[name][y : y + PATCH_SIZE, x : x + PATCH_SIZE]).save(destination / "masks" / f"{name}.png")
                write_json(
                    destination / "metadata.json",
                    {
                        "sourceId": source_id,
                        "category": category,
                        "split": split,
                        "x": x,
                        "y": y,
                        "size": PATCH_SIZE,
                        "focusChannels": list(focus_channels),
                    },
                )
                output_ids.append(sample_id)
    return output_ids


def should_skip_patch(focus: np.ndarray, excluded: np.ndarray, x: int, y: int) -> bool:
    focus_patch = focus[y : y + PATCH_SIZE, x : x + PATCH_SIZE]
    excluded_patch = excluded[y : y + PATCH_SIZE, x : x + PATCH_SIZE]
    focus_pixels = int(np.count_nonzero(focus_patch))
    excluded_pixels = int(np.count_nonzero(excluded_patch))
    if focus_pixels < 32:
        return True
    if excluded_pixels == 0:
        return False
    return excluded_pixels / float(PATCH_SIZE * PATCH_SIZE) > 0.015


def focus_centers(focus: np.ndarray, category: str) -> tuple[list[int], list[int]]:
    ys, xs = np.where(focus > 0)
    if not len(xs):
        return [], []
    if category in {"grass_ground", "open_ground"}:
        height, width = focus.shape
        candidates = [
            (width // 2, height // 2),
            (width // 3, height // 3),
            (width * 2 // 3, height // 3),
            (width // 3, height * 2 // 3),
            (width * 2 // 3, height * 2 // 3),
        ]
        return [x for x, _ in candidates], [y for _, y in candidates]
    return [int(np.mean(xs))], [int(np.mean(ys))]


def build_preview(category_root: Path, category: str) -> Image.Image | None:
    train_index = category_root / "train.json"
    if not train_index.is_file():
        return None
    sample_ids = json.loads(train_index.read_text(encoding="utf-8")).get("sampleIds", [])
    if not sample_ids:
        return None
    sample = category_root / "samples" / sample_ids[0] / "target.png"
    if not sample.is_file():
        return None
    preview = Image.new("RGB", (PATCH_SIZE, PATCH_SIZE + 18), "#071510")
    draw = ImageDraw.Draw(preview)
    draw.text((4, 4), category[:28], fill="#dff8e6")
    with Image.open(sample) as image:
        preview.paste(image.convert("RGB"), (0, 18))
    return preview


def build_contact_sheet(previews: list[tuple[str, Image.Image]], output: Path) -> None:
    columns = 3
    cell_w, cell_h = PATCH_SIZE, PATCH_SIZE + 18
    sheet = Image.new("RGB", (columns * cell_w, 2 * cell_h), "#071510")
    for index, (_, image) in enumerate(previews[:6]):
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        sheet.paste(image, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

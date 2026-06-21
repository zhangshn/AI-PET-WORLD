from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS


CATEGORIES = {
    "building": ("shelter_foundation", "shelter_wall", "shelter_roof", "construction_material"),
    "tree": ("tree_trunk", "tree_crown"),
    "road": ("road_center", "road_edge"),
    "shoreline": ("water_body", "shoreline"),
}
PATCH_SIZE = 128


def main() -> int:
    parser = ArgumentParser(description="Prepare same-source high-resolution local asset patches.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    source_root = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    result = {}
    for category, focus_channels in CATEGORIES.items():
        category_root = args.output_root / category
        train_ids = prepare_split(args.dataset_root, source_root, category_root, "train", focus_channels, jitter=True)
        validation_ids = prepare_split(args.dataset_root, source_root, category_root, "validation", focus_channels, jitter=False)
        write_json(category_root / "train.json", {"sampleIds": train_ids})
        write_json(category_root / "validation.json", {"sampleIds": validation_ids})
        result[category] = {"train": len(train_ids), "validation": len(validation_ids)}
    write_json(args.output_root / "manifest.json", {"status": "completed", "patchSize": PATCH_SIZE, "categories": result})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def prepare_split(dataset_root: Path, source_root: Path, category_root: Path, split: str, focus_channels: tuple[str, ...], jitter: bool) -> list[str]:
    source_ids = json.loads((dataset_root / "indexes" / f"{split}.json").read_text(encoding="utf-8"))["sampleIds"]
    output_ids = []
    offsets = ((0, 0), (-18, 0), (18, 0), (0, -14), (0, 14)) if jitter else ((0, 0),)
    for source_id in source_ids:
        source = source_root / source_id
        masks = {name: np.array(Image.open(source / "masks_v1" / f"{name}.png").convert("L")) for name in V1_CONDITION_CHANNELS}
        focus = np.maximum.reduce([masks[name] for name in focus_channels])
        ys, xs = np.where(focus > 0)
        if not len(xs):
            continue
        center_x, center_y = int(np.mean(xs)), int(np.mean(ys))
        for number, (dx, dy) in enumerate(offsets):
            x = max(0, min(256 - PATCH_SIZE, center_x - PATCH_SIZE // 2 + dx))
            y = max(0, min(192 - PATCH_SIZE, center_y - PATCH_SIZE // 2 + dy))
            sample_id = f"{source_id}-{number}"
            destination = category_root / "samples" / sample_id
            (destination / "masks").mkdir(parents=True, exist_ok=True)
            with Image.open(source / "target.png") as target:
                target.convert("RGB").crop((x, y, x + PATCH_SIZE, y + PATCH_SIZE)).save(destination / "target.png")
            for name in V1_CONDITION_CHANNELS:
                Image.fromarray(masks[name][y:y + PATCH_SIZE, x:x + PATCH_SIZE]).save(destination / "masks" / f"{name}.png")
            write_json(destination / "metadata.json", {"sourceId": source_id, "category": category_root.name, "x": x, "y": y, "size": PATCH_SIZE, "focusChannels": focus_channels})
            output_ids.append(sample_id)
    return output_ids


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

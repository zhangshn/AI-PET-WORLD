from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image


FOCUS_CHANNELS = {
    "grass_ground": ("grass", "walkable"),
    "road_path": ("road_center", "road_edge"),
    "water_shoreline": ("water_body", "shoreline"),
    "tree_bush": ("tree_trunk", "tree_crown"),
    "rock_terrain": ("rock",),
    "open_ground": ("grass", "walkable", "depth"),
}

BACKGROUND_RGB = np.array([7, 21, 16], dtype=np.uint8)


def main() -> int:
    parser = ArgumentParser(description="Prepare V70 focus-mask local expert patches from V68 natural-home local patch data.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    categories = {}
    for category, channels in FOCUS_CHANNELS.items():
        categories[category] = convert_category(args.source_root / category, args.output_root / category, channels)

    manifest = {
        "schemaVersion": "natural-home-v70-focus-local-expert-patches-v1",
        "status": "completed",
        "sourceRoot": str(args.source_root.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "backgroundRgb": BACKGROUND_RGB.tolist(),
        "categories": categories,
    }
    (args.output_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def convert_category(source_root: Path, output_root: Path, channels: tuple[str, ...]) -> dict[str, object]:
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "samples").mkdir(parents=True, exist_ok=True)
    copied_counts = {}
    for split in ("train", "validation"):
        index = json.loads((source_root / f"{split}.json").read_text(encoding="utf-8"))
        sample_ids = list(index["sampleIds"])
        for sample_id in sample_ids:
            convert_sample(source_root / "samples" / sample_id, output_root / "samples" / sample_id, channels)
        (output_root / f"{split}.json").write_text(json.dumps({"sampleIds": sample_ids}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        copied_counts[split] = len(sample_ids)
    return {
        "status": "ready",
        "focusChannels": list(channels),
        "trainSampleCount": copied_counts["train"],
        "validationSampleCount": copied_counts["validation"],
    }


def convert_sample(source: Path, target: Path, channels: tuple[str, ...]) -> None:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
    original = np.asarray(Image.open(source / "target.png").convert("RGB"), dtype=np.uint8)
    focus = build_focus_mask(source / "masks", channels)
    focused = np.zeros_like(original)
    focused[:, :] = BACKGROUND_RGB
    focused[focus] = original[focus]
    Image.fromarray(focused, "RGB").save(target / "target.png")
    Image.fromarray((focus.astype(np.uint8) * 255), "L").save(target / "focus-mask.png")
    metadata_path = target / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["targetMode"] = "focus-mask-local-rgb"
    metadata["focusChannels"] = list(channels)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_focus_mask(mask_root: Path, channels: tuple[str, ...]) -> np.ndarray:
    mask = None
    for channel in channels:
        pixels = np.asarray(Image.open(mask_root / f"{channel}.png").convert("L"), dtype=np.uint8) > 0
        mask = pixels if mask is None else np.logical_or(mask, pixels)
    if mask is None:
        raise ValueError("missing focus channels")
    return mask


if __name__ == "__main__":
    raise SystemExit(main())

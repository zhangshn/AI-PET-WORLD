from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageFilter


MASK_NAMES = ("grass", "water", "road", "tree", "rock", "shelter", "walkable", "depth")


def main() -> int:
    parser = ArgumentParser(description="Prepare an isolated local-model bootstrap dataset.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--sample-id", default="bootstrap-world-001")
    args = parser.parse_args()

    source = args.source.resolve()
    root = args.output_root.resolve()
    sample_dir = root / "accepted" / "dataset_v0" / "scene" / "world" / args.sample_id
    masks_dir = sample_dir / "masks"
    if root.exists():
        shutil.rmtree(root)
    masks_dir.mkdir(parents=True)
    (root / "indexes").mkdir(parents=True)

    with Image.open(source) as image:
        target = image.convert("RGB").resize((256, 192), Image.Resampling.LANCZOS)
    target.save(sample_dir / "target.png")

    rgb = np.asarray(target, dtype=np.uint8)
    gray = np.asarray(target.convert("L"), dtype=np.uint8)
    edges = np.asarray(target.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.uint8)
    height, width = gray.shape
    x_axis = np.tile(np.linspace(0, 255, width, dtype=np.uint8), (height, 1))
    y_axis = np.tile(np.linspace(0, 255, height, dtype=np.uint8)[:, None], (1, width))
    saturation = rgb.max(axis=2) - rgb.min(axis=2)
    channels = (rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2], gray, edges, x_axis, y_axis, saturation)
    for name, pixels in zip(MASK_NAMES, channels, strict=True):
        Image.fromarray(pixels).save(masks_dir / f"{name}.png")

    index = {"schemaVersion": "dataset-index-v1", "sampleIds": [args.sample_id], "count": 1}
    (root / "indexes" / "train.json").write_text(json.dumps({**index, "split": "train"}, indent=2) + "\n", encoding="utf-8")
    (root / "indexes" / "validation.json").write_text(
        json.dumps({"schemaVersion": "dataset-index-v1", "split": "validation", "sampleIds": [], "count": 0}, indent=2) + "\n",
        encoding="utf-8",
    )
    manifest = {
        "purpose": "engineering_bootstrap_only",
        "formalTrainingData": False,
        "sampleId": args.sample_id,
        "source": str(source),
        "warning": "Image-derived channels only verify local training and inference; they are not semantic world masks.",
    }
    (root / "bootstrap-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

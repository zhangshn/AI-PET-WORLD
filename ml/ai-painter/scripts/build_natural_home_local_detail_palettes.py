from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path

import numpy as np
from PIL import Image


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Build discrete palettes for pure natural-home local detail patches.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--palette-size", type=int, default=64)
    args = parser.parse_args()

    result: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        category_root = args.dataset_root / category
        sample_ids = json.loads((category_root / "train.json").read_text(encoding="utf-8"))["sampleIds"]
        if not sample_ids:
            raise ValueError(f"missing training samples for category: {category}")

        images = [Image.open(category_root / "samples" / sample_id / "target.png").convert("RGB") for sample_id in sample_ids]
        width = images[0].width
        height = images[0].height
        sheet = Image.new("RGB", (width, height * len(images)))
        for index, image in enumerate(images):
            sheet.paste(image, (0, index * height))

        quantized = sheet.quantize(colors=args.palette_size, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        raw_palette = quantized.getpalette()[: args.palette_size * 3]
        counts = np.bincount(np.asarray(quantized).reshape(-1), minlength=args.palette_size)
        colors: list[list[int]] = []
        for index in np.argsort(counts)[::-1]:
            offset = int(index) * 3
            color = [int(value) for value in raw_palette[offset:offset + 3]]
            if color not in colors:
                colors.append(color)

        payload = {
            "schemaVersion": "ai-painter-natural-home-local-detail-palette-v1",
            "category": category,
            "colorCount": len(colors),
            "colors": colors,
            "sourceSampleCount": len(images),
            "sourcePatchSize": {"width": width, "height": height},
            "note": "Project-owned natural-home patch palette for local model training diagnostics.",
        }
        palette_path = category_root / "palette.json"
        palette_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result[category] = {"colors": len(colors), "path": str(palette_path.resolve())}

        for image in images:
            image.close()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

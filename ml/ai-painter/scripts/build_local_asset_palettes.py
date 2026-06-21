from argparse import ArgumentParser
import json
from pathlib import Path

import numpy as np
from PIL import Image


CATEGORIES = ("building", "tree", "road", "shoreline")


def main() -> int:
    parser = ArgumentParser(description="Build project-owned discrete pixel palettes from local training patches.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--palette-size", type=int, default=48)
    args = parser.parse_args()
    result = {}
    for category in CATEGORIES:
        root = args.dataset_root / category
        sample_ids = json.loads((root / "train.json").read_text(encoding="utf-8"))["sampleIds"]
        images = [Image.open(root / "samples" / sample_id / "target.png").convert("RGB") for sample_id in sample_ids]
        width = 128
        sheet = Image.new("RGB", (width, width * len(images)))
        for index, image in enumerate(images):
            sheet.paste(image, (0, index * width))
        quantized = sheet.quantize(colors=args.palette_size, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        raw_palette = quantized.getpalette()[: args.palette_size * 3]
        counts = np.bincount(np.asarray(quantized).reshape(-1), minlength=args.palette_size)
        colors = []
        for index in np.argsort(counts)[::-1]:
            offset = int(index) * 3
            colors.append(raw_palette[offset:offset + 3])
        payload = {"schemaVersion": "ai-painter-discrete-palette-v1", "category": category, "colorCount": len(colors), "colors": colors, "sourceSampleCount": len(images)}
        path = root / "palette.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result[category] = {"colors": len(colors), "path": str(path.resolve())}
        for image in images:
            image.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

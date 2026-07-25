from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read a single-band numeric GeoTIFF without visual colour conversion."
    )
    parser.add_argument("input", type=Path)
    args = parser.parse_args()

    with Image.open(args.input) as image:
        if image.n_frames != 1:
            raise RuntimeError("numeric GeoTIFF must contain exactly one frame")
        values = [int(value) for value in image.getdata()]
        valid_values = [value for value in values if value != 0]
        if not valid_values:
            raise RuntimeError("numeric GeoTIFF contains no valid non-zero values")
        payload = {
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "noDataValue": 0,
            "noDataCount": len(values) - len(valid_values),
            "validValueCount": len(valid_values),
            "minimum": min(valid_values),
            "maximum": max(valid_values),
            "mean": sum(valid_values) / len(valid_values),
            "values": values,
        }

    print(json.dumps(payload, separators=(",", ":")))


if __name__ == "__main__":
    main()

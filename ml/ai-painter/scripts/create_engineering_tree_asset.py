from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path("data/ai-painter-assets/engineering-source/tree-deciduous-engineering-001")
SIZE = (128, 128)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    trunk = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    crown = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw_trunk(trunk)
    draw_crown(crown)
    trunk.save(ROOT / "trunk.png", "PNG", optimize=True)
    crown.save(ROOT / "crown.png", "PNG", optimize=True)
    manifest = {
        "schemaVersion": "layered-pixel-asset-v1",
        "assetId": "tree-deciduous-engineering-001",
        "category": "tree",
        "admission": "engineering_only",
        "size": list(SIZE),
        "anchor": [64, 119],
        "layers": [
            {"id": "trunk", "file": "trunk.png", "channel": "tree_trunk", "zIndex": 10},
            {"id": "crown", "file": "crown.png", "channel": "tree_crown", "zIndex": 20},
        ],
    }
    (ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )


def draw_trunk(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    draw.polygon([(55, 66), (73, 66), (72, 110), (80, 119), (48, 119), (56, 109)], fill="#4a2818")
    draw.polygon([(59, 67), (68, 67), (67, 111), (74, 116), (64, 114), (55, 117), (60, 108)], fill="#80502a")
    draw.rectangle((62, 72, 66, 108), fill="#a36a35")
    draw.rectangle((56, 82, 60, 105), fill="#63391f")
    draw.polygon([(58, 78), (43, 67), (47, 62), (62, 73)], fill="#684020")
    draw.polygon([(69, 80), (84, 65), (88, 69), (72, 87)], fill="#69401f")
    draw.rectangle((50, 118, 78, 121), fill="#2d2119")


def draw_crown(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    for box in [(24, 39, 57, 72), (42, 20, 78, 61), (67, 29, 104, 68), (31, 54, 70, 87), (58, 50, 96, 86), (48, 34, 87, 75)]:
        draw.ellipse(box, fill="#184f32")
    for box in [(32, 42, 50, 58), (51, 27, 68, 43), (72, 38, 91, 55), (45, 55, 63, 71)]:
        draw.ellipse(box, fill="#3e8b42")
    for x, y in [(29, 58), (38, 35), (55, 23), (75, 31), (91, 50), (61, 62), (77, 66)]:
        draw.rectangle((x, y, x + 7, y + 5), fill="#6daf49")
        draw.rectangle((x + 2, y, x + 5, y + 2), fill="#98c957")
    for x, y in [(28, 68), (40, 78), (57, 80), (72, 78), (88, 69)]:
        draw.rectangle((x, y, x + 9, y + 4), fill="#123d2b")


if __name__ == "__main__":
    main()

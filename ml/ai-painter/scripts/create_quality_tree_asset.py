from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path("data/ai-painter-assets/candidate-source/tree-deciduous-quality-001")
WORK_SIZE = (64, 64)
OUTPUT_SIZE = (128, 128)
SEED = 20260614


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    trunk = Image.new("RGBA", WORK_SIZE, (0, 0, 0, 0))
    crown = Image.new("RGBA", WORK_SIZE, (0, 0, 0, 0))
    draw_trunk(trunk)
    draw_crown(crown)
    trunk.resize(OUTPUT_SIZE, Image.Resampling.NEAREST).save(ROOT / "trunk.png", "PNG", optimize=True)
    crown.resize(OUTPUT_SIZE, Image.Resampling.NEAREST).save(ROOT / "crown.png", "PNG", optimize=True)
    manifest = {
        "schemaVersion": "layered-pixel-asset-v1",
        "assetId": "tree-deciduous-quality-001",
        "category": "tree",
        "admission": "candidate",
        "size": list(OUTPUT_SIZE),
        "anchor": [64, 122],
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
    deep = "#2b1711"
    outline = "#3d2115"
    shadow = "#58301a"
    base = "#79451f"
    warm = "#9c602c"
    light = "#c3833e"
    draw.polygon([(28, 26), (37, 26), (36, 48), (39, 56), (45, 60), (38, 60), (34, 57), (32, 62), (29, 57), (24, 61), (18, 60), (27, 54)], fill=deep)
    draw.polygon([(29, 25), (36, 26), (35, 49), (38, 56), (42, 59), (37, 58), (33, 55), (31, 60), (29, 55), (22, 59), (28, 53)], fill=outline)
    draw.polygon([(30, 26), (35, 27), (34, 49), (36, 55), (32, 54), (31, 58), (29, 53)], fill=base)
    draw.polygon([(33, 27), (35, 28), (34, 48), (32, 53), (32, 32)], fill=light)
    draw.polygon([(30, 39), (20, 31), (17, 25), (20, 23), (23, 30), (31, 35)], fill=outline)
    draw.polygon([(29, 36), (21, 30), (19, 25), (21, 27), (24, 31), (31, 37)], fill=warm)
    draw.polygon([(35, 39), (44, 31), (48, 23), (45, 22), (42, 29), (34, 35)], fill=outline)
    draw.polygon([(35, 36), (42, 30), (45, 24), (45, 27), (43, 32), (35, 40)], fill=light)
    for x, y, length, color in [
        (30, 31, 3, shadow), (33, 34, 2, warm), (30, 40, 2, light),
        (33, 44, 3, shadow), (29, 48, 2, warm), (33, 51, 2, light),
        (27, 55, 3, base), (35, 56, 2, warm), (24, 58, 3, light),
    ]:
        draw.line((x, y, x, y + length), fill=color)
    draw.rectangle((19, 60, 44, 62), fill=deep)
    draw.rectangle((24, 58, 29, 60), fill=base)
    draw.rectangle((35, 58, 40, 60), fill=warm)


def draw_crown(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    rng = random.Random(SEED)
    colors = [
        "#0c3024", "#10402a", "#165033", "#1b6037", "#23703a", "#2e803e",
        "#3b9041", "#4d9f43", "#60ad47", "#75b94c", "#8ac354", "#9dcb5d",
        "#b2d36a", "#d0d66a", "#195b40", "#28794b", "#527f38", "#6f9140",
    ]
    clusters = [
        (8, 23, 25, 39, 3), (13, 14, 30, 31, 6), (22, 7, 39, 25, 9),
        (32, 5, 49, 23, 10), (42, 12, 57, 29, 7), (47, 23, 60, 39, 5),
        (40, 31, 57, 47, 3), (28, 34, 47, 50, 4), (15, 33, 35, 49, 5),
        (5, 31, 23, 46, 2), (22, 20, 43, 40, 7), (34, 20, 53, 39, 6),
    ]
    for x, y, x2, y2, tone in clusters:
        draw.ellipse((x, y, x2, y2), fill=colors[0])
        draw.ellipse((x + 2, y + 2, x2 - 1, y2 - 1), fill=colors[max(2, tone - 2)])
        draw.ellipse((x + 3, y + 2, x2 - 3, y2 - 4), fill=colors[tone])
        if tone >= 6:
            draw.rectangle((x + 5, y + 3, min(x2 - 3, x + 10), y + 4), fill=colors[min(13, tone + 2)])

    # Small shadow pockets describe overlaps without drawing long artificial grooves.
    for x, y, width in [(17, 27, 5), (28, 22, 4), (39, 19, 5), (46, 30, 4), (34, 38, 6), (21, 39, 5), (11, 35, 4)]:
        draw.rectangle((x, y, x + width, y + 1), fill=colors[rng.choice((1, 2, 3, 14))])

    # Leaf chips are deterministic and follow the upper-left light direction.
    for _ in range(120):
        x = rng.randint(9, 56)
        y = rng.randint(9, 45)
        if image.getpixel((x, y))[3] == 0:
            continue
        light = max(0, 52 - x - y)
        index = min(12, max(2, 5 + light // 10 + rng.choice((-2, -1, 0, 0, 1))))
        if x > 39 and y > 29:
            index = max(2, index - 3)
        draw.rectangle((x, y, x + rng.choice((1, 1, 2)), y + rng.choice((0, 1))), fill=colors[index])

    for x, y in [(24, 10), (30, 8), (36, 8), (42, 13), (18, 17), (26, 15), (34, 14), (15, 23), (23, 21)]:
        draw.rectangle((x, y, x + 2, y + 1), fill=colors[11])
        draw.point((x + 1, y), fill=colors[12])
    for x, y in [(19, 24), (31, 18), (44, 23), (50, 32), (37, 43), (23, 44), (12, 37)]:
        draw.point((x, y), fill=colors[13])
    # Purposeful transition colors: new growth, warm light, cool recesses and leaf veins.
    transition_marks = [
        (25, 9, "#c4dc78"), (34, 7, "#dbe28a"), (19, 15, "#a8cf62"),
        (42, 14, "#91c45a"), (48, 22, "#438d3d"), (52, 30, "#2b6b38"),
        (44, 37, "#18513a"), (35, 43, "#123f31"), (17, 39, "#256d36"),
        (13, 29, "#397f38"), (28, 27, "#659f42"), (38, 29, "#7ead49"),
    ]
    for index, (x, y, color) in enumerate(transition_marks):
        draw.rectangle((x, y, x + 1 + index % 2, y), fill=color)

    # Natural edge notches and a raised center reveal the trunk fork.
    for box in [(5, 27, 8, 30), (12, 17, 14, 19), (29, 5, 31, 7), (49, 13, 52, 15), (57, 29, 60, 32), (46, 44, 49, 47)]:
        draw.rectangle(box, fill=(0, 0, 0, 0))
    draw.polygon([(29, 46), (32, 42), (35, 46), (34, 50), (30, 50)], fill=(0, 0, 0, 0))


if __name__ == "__main__":
    main()

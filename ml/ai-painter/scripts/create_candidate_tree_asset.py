from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path("data/ai-painter-assets/candidate-source/tree-deciduous-candidate-001")
WORK_SIZE = (64, 64)
OUTPUT_SIZE = (128, 128)


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
        "assetId": "tree-deciduous-candidate-001",
        "category": "tree",
        "admission": "candidate",
        "size": list(OUTPUT_SIZE),
        "anchor": [64, 120],
        "layers": [
            {"id": "trunk", "file": "trunk.png", "channel": "tree_trunk", "zIndex": 10},
            {"id": "crown", "file": "crown.png", "channel": "tree_crown", "zIndex": 20},
        ],
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def draw_trunk(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    dark, mid, light, deep = "#482819", "#754321", "#a76a32", "#2a1b16"
    draw.polygon([(27, 28), (37, 28), (36, 51), (41, 59), (35, 58), (32, 61), (28, 58), (23, 59), (28, 51)], fill=deep)
    draw.polygon([(29, 27), (36, 28), (35, 52), (39, 58), (34, 57), (32, 60), (29, 57), (25, 58), (29, 51)], fill=dark)
    draw.polygon([(31, 28), (35, 29), (34, 52), (37, 57), (33, 56), (31, 58)], fill=mid)
    draw.polygon([(33, 29), (35, 30), (34, 50), (32, 54), (32, 35)], fill=light)
    draw.polygon([(30, 39), (20, 30), (21, 27), (31, 35)], fill=dark)
    draw.polygon([(22, 29), (25, 30), (31, 36), (29, 37)], fill=mid)
    draw.polygon([(35, 39), (45, 29), (44, 26), (34, 35)], fill=dark)
    draw.polygon([(36, 36), (43, 29), (42, 31), (36, 40)], fill=light)
    draw.rectangle((24, 59, 40, 61), fill=deep)
    draw.rectangle((27, 56, 30, 58), fill=mid)
    draw.rectangle((35, 55, 38, 58), fill=mid)
    bark_marks = [
        (31, 32, "#5d351d"), (34, 34, "#c18442"), (30, 38, "#8d5428"),
        (33, 42, "#d0934d"), (30, 47, "#63371e"), (34, 49, "#8a4e27"),
        (28, 54, "#bd7838"), (36, 55, "#59301b"), (31, 57, "#d49a55"),
    ]
    for x, y, color in bark_marks:
        draw.line((x, y, x, y + 2), fill=color)


def draw_crown(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    outline = "#123525"
    shadow = "#185034"
    base = "#27723a"
    mid = "#419244"
    light = "#6caf4d"
    shine = "#9bc95b"
    clusters = [(9, 18, 28, 36), (17, 8, 37, 29), (28, 5, 46, 26), (38, 12, 56, 32), (6, 29, 27, 46), (18, 25, 42, 47), (34, 25, 57, 45), (25, 17, 49, 40)]
    for box in clusters:
        draw.ellipse(box, fill=outline)
    inner = [(11, 19, 27, 34), (19, 10, 36, 27), (29, 7, 44, 24), (39, 14, 54, 30), (8, 30, 25, 44), (20, 27, 40, 45), (36, 27, 55, 43), (27, 19, 47, 38)]
    for box in inner:
        draw.ellipse(box, fill=shadow)
    for box in [(14, 18, 27, 30), (22, 11, 35, 24), (32, 9, 43, 21), (40, 16, 52, 27), (12, 31, 25, 41), (23, 28, 37, 41), (39, 29, 52, 40)]:
        draw.ellipse(box, fill=base)
    for box in [(17, 18, 25, 25), (24, 13, 32, 20), (34, 11, 41, 18), (42, 18, 49, 24), (16, 32, 23, 38), (27, 29, 35, 36), (41, 31, 49, 37)]:
        draw.ellipse(box, fill=mid)
    for x, y in [(18, 18), (25, 12), (34, 9), (43, 17), (13, 29), (24, 27), (37, 26), (47, 30), (20, 36), (31, 37)]:
        draw.rectangle((x, y, x + 4, y + 2), fill=light)
        draw.point((x + 1, y), fill=shine)
    for x, y in [(10, 36), (16, 42), (27, 45), (38, 44), (49, 40), (54, 30)]:
        draw.rectangle((x, y, x + 5, y + 2), fill=outline)
    for x, y in [(16, 27), (30, 23), (46, 25), (34, 34)]:
        draw.rectangle((x, y, x + 2, y + 2), fill="#d7d65a")
    leaf_marks = [
        (14, 23, "#1f6338"), (19, 15, "#347f3d"), (28, 10, "#5ba34a"),
        (37, 8, "#7cba50"), (47, 18, "#35843e"), (51, 25, "#246d39"),
        (11, 34, "#2f8241"), (18, 39, "#4d9e45"), (25, 33, "#78b84e"),
        (31, 28, "#a9d263"), (38, 34, "#579f43"), (46, 37, "#367f3d"),
        (23, 20, "#86bd51"), (34, 17, "#b8d96a"), (42, 23, "#65aa48"),
        (29, 40, "#2a7139"), (36, 42, "#1d5b34"), (20, 44, "#16482f"),
    ]
    for index, (x, y, color) in enumerate(leaf_marks):
        draw.rectangle((x, y, x + (2 if index % 3 == 0 else 1), y + 1), fill=color)


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path("data/ai-painter-assets/candidate-source")
WORK_SIZE = (64, 64)
OUTPUT_SIZE = (128, 128)

PROFILES = (
    {
        "asset_id": "tree-oak-quality-002",
        "seed": 20260615,
        "clusters": [(7, 22, 27, 40), (13, 12, 34, 32), (25, 7, 45, 28),
                     (38, 12, 58, 33), (43, 25, 61, 43), (28, 28, 51, 49),
                     (12, 31, 34, 49), (21, 18, 48, 41)],
        "trunk_width": 8,
        "trunk_top": 25,
        "palette": ("#092c22", "#12442b", "#1c5d31", "#2c7535", "#418c39",
                    "#59a142", "#75b54d", "#94c65b", "#b4d36b", "#d6df82"),
    },
    {
        "asset_id": "tree-birch-quality-003",
        "seed": 20260616,
        "clusters": [(16, 12, 31, 28), (25, 5, 40, 23), (34, 10, 49, 28),
                     (12, 24, 29, 40), (24, 20, 43, 39), (36, 25, 53, 43),
                     (20, 34, 39, 50), (31, 35, 49, 51)],
        "trunk_width": 5,
        "trunk_top": 21,
        "palette": ("#12362b", "#19513a", "#247047", "#398c54", "#55a762",
                    "#73bc71", "#91cd80", "#b0da91", "#cee6a6", "#e7efbd"),
    },
    {
        "asset_id": "tree-maple-quality-004",
        "seed": 20260617,
        "clusters": [(8, 25, 25, 42), (13, 14, 31, 32), (23, 7, 41, 26),
                     (35, 9, 53, 29), (43, 20, 59, 39), (37, 31, 55, 48),
                     (24, 34, 43, 52), (12, 34, 31, 49), (22, 20, 49, 43)],
        "trunk_width": 7,
        "trunk_top": 24,
        "palette": ("#302315", "#49301a", "#63401e", "#805024", "#9c6229",
                    "#b97930", "#cc9139", "#d9aa4a", "#e4c361", "#f0d985"),
    },
    {
        "asset_id": "tree-willow-quality-006",
        "seed": 20260619,
        "render_kind": "willow",
        "trunk_width": 6,
        "trunk_top": 19,
        "palette": ("#173225", "#244a2d", "#326236", "#427a3e", "#559146",
                    "#69a74f", "#80ba59", "#99cb66", "#b2d775", "#cde38a"),
    },
    {
        "asset_id": "tree-blossom-quality-007",
        "seed": 20260620,
        "render_kind": "blossom",
        "trunk_width": 6,
        "trunk_top": 24,
        "palette": ("#4a2635", "#693144", "#873d55", "#a64d68", "#c25f7d",
                    "#d97994", "#e897ad", "#f1b4c4", "#f7ced8", "#ffe5e9"),
    },
)


def main() -> None:
    for profile in PROFILES:
        create_asset(profile)


def create_asset(profile: dict[str, object]) -> None:
    asset_id = str(profile["asset_id"])
    asset_root = ROOT / asset_id
    asset_root.mkdir(parents=True, exist_ok=True)
    trunk = Image.new("RGBA", WORK_SIZE, (0, 0, 0, 0))
    crown = Image.new("RGBA", WORK_SIZE, (0, 0, 0, 0))
    draw_trunk(trunk, int(profile["trunk_width"]), int(profile["trunk_top"]), asset_id)
    render_kind = str(profile.get("render_kind", "clustered"))
    if render_kind == "willow":
        draw_willow_crown(crown, profile)
    elif render_kind == "blossom":
        draw_blossom_crown(crown, profile)
    else:
        draw_crown(crown, profile)
    trunk.resize(OUTPUT_SIZE, Image.Resampling.NEAREST).save(asset_root / "trunk.png", "PNG", optimize=True)
    crown.resize(OUTPUT_SIZE, Image.Resampling.NEAREST).save(asset_root / "crown.png", "PNG", optimize=True)
    manifest = {
        "schemaVersion": "layered-pixel-asset-v1",
        "assetId": asset_id,
        "category": "tree",
        "admission": "candidate",
        "size": list(OUTPUT_SIZE),
        "anchor": [64, 122],
        "layers": [
            {"id": "trunk", "file": "trunk.png", "channel": "tree_trunk", "zIndex": 10},
            {"id": "crown", "file": "crown.png", "channel": "tree_crown", "zIndex": 20},
        ],
    }
    (asset_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )


def draw_trunk(image: Image.Image, width: int, top: int, asset_id: str) -> None:
    draw = ImageDraw.Draw(image)
    center = 32
    left = center - width // 2
    right = left + width
    colors = ("#291710", "#432517", "#69401f", "#93612f", "#c08a4a")
    if "birch" in asset_id:
        colors = ("#292c2a", "#555b55", "#90958b", "#c6c9b8", "#ece8ce")
    draw.polygon([(left, top), (right, top), (right - 1, 51), (43, 61),
                  (36, 60), (32, 55), (28, 61), (19, 61), (left + 1, 51)], fill=colors[0])
    draw.polygon([(left + 1, top + 1), (right - 1, top + 1), (right - 2, 50),
                  (39, 58), (34, 56), (31, 53), (27, 58), (23, 59), (left + 2, 50)], fill=colors[2])
    draw.polygon([(left + 2, top + 2), (left + width // 2, top + 2),
                  (left + width // 2, 50), (30, 54), (27, 57), (left + 3, 49)], fill=colors[3])
    draw.line((left + 2, top + 4, left + 2, 48), fill=colors[4])
    draw.polygon([(left + 2, 37), (20, 29), (17, 23), (20, 22), (24, 29), (left + 4, 33)], fill=colors[1])
    draw.polygon([(right - 2, 38), (44, 30), (48, 22), (45, 21), (41, 28), (right - 4, 34)], fill=colors[1])
    for y in range(top + 8, 51, 7):
        draw.rectangle((left + 1, y, right - 2, y + 1), fill=colors[(y // 7) % 2 + 1])
    if "birch" in asset_id:
        for y, x in ((29, left), (36, left + 3), (43, left + 1), (49, left + 4)):
            draw.rectangle((x, y, min(right, x + 3), y + 1), fill="#303530")


def draw_crown(image: Image.Image, profile: dict[str, object]) -> None:
    draw = ImageDraw.Draw(image)
    rng = random.Random(int(profile["seed"]))
    palette = tuple(profile["palette"])
    clusters = tuple(profile["clusters"])
    for index, box in enumerate(clusters):
        x1, y1, x2, y2 = box
        tone = min(len(palette) - 3, 2 + index % 5)
        draw.ellipse(box, fill=palette[0])
        draw.ellipse((x1 + 2, y1 + 2, x2 - 1, y2 - 1), fill=palette[max(1, tone - 1)])
        draw.ellipse((x1 + 3, y1 + 2, x2 - 3, y2 - 4), fill=palette[tone])
        draw.rectangle((x1 + 5, y1 + 3, min(x2 - 3, x1 + 10), y1 + 4), fill=palette[min(8, tone + 2)])
    for _ in range(145):
        x = rng.randint(8, 57)
        y = rng.randint(7, 48)
        if image.getpixel((x, y))[3] == 0:
            continue
        lighting = max(0, 58 - x - y)
        tone = min(9, max(2, 4 + lighting // 10 + rng.choice((-1, 0, 0, 1))))
        if x > 39 and y > 28:
            tone = max(1, tone - 2)
        draw.rectangle((x, y, x + rng.choice((1, 1, 2)), y + rng.choice((0, 1))), fill=palette[tone])
    for x, y in ((17, 28), (26, 20), (38, 18), (47, 27), (42, 39), (29, 43), (15, 39)):
        draw.rectangle((x, y, x + 4, y + 1), fill=palette[1])
    for x, y in ((22, 11), (30, 8), (38, 10), (16, 18), (45, 17), (25, 16), (35, 14)):
        if image.getpixel((x, y))[3]:
            draw.rectangle((x, y, x + 2, y + 1), fill=palette[9])
    # Add controlled material transitions rather than arbitrary palette noise.
    # These marks represent new leaves, reflected warm light, cool recesses and veins.
    accent_points = (
        (20, 13, 18), (27, 10, 28), (35, 11, 38), (43, 16, 48),
        (49, 24, -18), (51, 32, -30), (44, 39, -42), (36, 44, -54),
        (25, 43, -34), (16, 37, -22), (13, 28, 12), (28, 27, 24),
    )
    for index, (x, y, shift) in enumerate(accent_points):
        if image.getpixel((x, y))[3]:
            source = palette[min(8, 3 + index % 6)]
            color = shift_color(source, shift, index * 3 - 12)
            draw.rectangle((x, y, x + 1 + index % 2, y), fill=color)
    for box in ((7, 29, 9, 31), (14, 14, 16, 16), (29, 6, 31, 7),
                (49, 15, 52, 17), (56, 31, 59, 34), (44, 45, 47, 48)):
        draw.rectangle(box, fill=(0, 0, 0, 0))
    draw.polygon([(29, 47), (32, 42), (35, 47), (34, 51), (30, 51)], fill=(0, 0, 0, 0))


def draw_willow_crown(image: Image.Image, profile: dict[str, object]) -> None:
    draw = ImageDraw.Draw(image)
    rng = random.Random(int(profile["seed"]))
    palette = tuple(profile["palette"])
    for box, tone in [((9, 10, 35, 31), 5), ((25, 6, 51, 29), 6), ((38, 14, 59, 35), 4),
                      ((14, 23, 43, 42), 5), ((29, 24, 55, 43), 3)]:
        draw.ellipse(box, fill=palette[0])
        x1, y1, x2, y2 = box
        draw.ellipse((x1 + 2, y1 + 2, x2 - 2, y2 - 3), fill=palette[tone])
    for x, length, tone in [(12, 22, 3), (17, 29, 5), (22, 25, 6), (28, 32, 4),
                            (35, 30, 6), (42, 34, 4), (49, 27, 5), (54, 21, 3)]:
        start = 22 + (x % 4)
        draw.line((x, start, x - 2, start + length), fill=palette[0], width=2)
        draw.line((x + 1, start, x, start + length - 3), fill=palette[tone])
        for y in range(start + 5, start + length - 2, 6):
            draw.rectangle((x - 3, y, x + 2, y + 1), fill=palette[min(9, tone + 2)])
    for _ in range(70):
        x, y = rng.randint(10, 56), rng.randint(10, 50)
        if image.getpixel((x, y))[3]:
            draw.point((x, y), fill=palette[rng.randint(2, 9)])
    add_material_accents(draw, image, palette)
    enrich_surface(draw, image, palette, rng, 130)


def draw_blossom_crown(image: Image.Image, profile: dict[str, object]) -> None:
    draw = ImageDraw.Draw(image)
    rng = random.Random(int(profile["seed"]))
    palette = tuple(profile["palette"])
    clusters = [(8, 23, 26, 40), (13, 13, 32, 31), (24, 7, 43, 26),
                (37, 11, 56, 30), (43, 24, 60, 41), (31, 30, 53, 49),
                (16, 31, 38, 49), (23, 19, 49, 42)]
    for index, box in enumerate(clusters):
        x1, y1, x2, y2 = box
        tone = 3 + index % 4
        draw.ellipse(box, fill=palette[0])
        draw.ellipse((x1 + 2, y1 + 2, x2 - 2, y2 - 3), fill=palette[tone])
    for _ in range(135):
        x, y = rng.randint(8, 58), rng.randint(7, 47)
        if image.getpixel((x, y))[3]:
            tone = min(9, max(2, 7 - (x + y) // 22 + rng.choice((-1, 0, 1, 2))))
            draw.rectangle((x, y, x + rng.choice((0, 1, 1)), y + rng.choice((0, 0, 1))), fill=palette[tone])
    for x, y in ((18, 17), (28, 11), (38, 13), (47, 21), (16, 30), (33, 25), (43, 35), (27, 40)):
        draw.rectangle((x, y, x + 2, y + 1), fill=palette[9])
        draw.point((x + 1, y + 2), fill="#fff1bd")
    add_material_accents(draw, image, palette)
    enrich_surface(draw, image, palette, rng, 125)


def add_material_accents(draw: ImageDraw.ImageDraw, image: Image.Image, palette: tuple[str, ...]) -> None:
    points = ((19, 14), (27, 10), (36, 12), (45, 18), (50, 28), (44, 39),
              (34, 45), (23, 42), (14, 34), (29, 27), (39, 29), (20, 25))
    for index, (x, y) in enumerate(points):
        if image.getpixel((x, y))[3]:
            base = palette[min(8, 2 + index % 7)]
            draw.rectangle((x, y, x + 1 + index % 2, y), fill=shift_color(base, index * 5 - 27, index * 2 - 10))


def enrich_surface(
    draw: ImageDraw.ImageDraw,
    image: Image.Image,
    palette: tuple[str, ...],
    rng: random.Random,
    count: int,
) -> None:
    accent_palette = []
    for index in range(16):
        base = palette[min(8, 2 + index % 7)]
        accent_palette.append(shift_color(base, (index % 5) * 8 - 16, (index % 4) * 4 - 6))
    for index in range(count):
        x = rng.randint(10, 54)
        y = rng.randint(8, 51)
        if image.getpixel((x, y))[3] == 0:
            continue
        palette_index = (index + (0 if x + y < 58 else 7)) % len(accent_palette)
        color = accent_palette[palette_index]
        if index % 3 == 0:
            draw.line((x - 1, y, x + 1, y), fill=color)
        else:
            draw.point((x, y), fill=color)


def shift_color(hex_color: str, value_shift: int, green_shift: int) -> str:
    red = int(hex_color[1:3], 16)
    green = int(hex_color[3:5], 16)
    blue = int(hex_color[5:7], 16)
    red = max(0, min(255, red + value_shift))
    green = max(0, min(255, green + value_shift + green_shift))
    blue = max(0, min(255, blue + value_shift // 2))
    return f"#{red:02x}{green:02x}{blue:02x}"


if __name__ == "__main__":
    main()

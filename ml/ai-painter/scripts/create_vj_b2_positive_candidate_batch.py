from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

from ai_painter.assets import build_layered_asset, judge_single_asset

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_quality_tree_batch import create_asset  # noqa: E402


SOURCE_ROOT = Path("data/ai-painter-assets/candidate-source")
OUTPUT_ROOT = Path("data/ai-painter-assets/candidates")

GREEN = ("#092c22", "#12442b", "#1c5d31", "#2c7535", "#418c39", "#59a142", "#75b54d", "#94c65b", "#b4d36b", "#d6df82")
COOL = ("#102d2b", "#17423a", "#20594a", "#2d7057", "#3f8764", "#58a071", "#72b87f", "#91cd91", "#b4dca7", "#d8e8c4")
GOLD = ("#302315", "#49301a", "#63401e", "#805024", "#9c6229", "#b97930", "#cc9139", "#d9aa4a", "#e4c361", "#f0d985")
RED = ("#321b1a", "#52251e", "#713022", "#913d25", "#ad4d28", "#c9652f", "#dc8239", "#eaa24b", "#f1c168", "#f7dc91")
BLUE = ("#10262a", "#173a3e", "#204f50", "#2c6660", "#3e7d70", "#559687", "#70ad9c", "#8dc3af", "#afd8c4", "#d2e9d9")
PURPLE = ("#261d32", "#382747", "#4b315c", "#604071", "#765187", "#8f669e", "#a97eb4", "#c098c8", "#d6b3da", "#ead4ec")


PROFILES = (
    {"asset_id": "tree-acacia-umbrella-quality-043", "seed": 20260701, "trunk_width": 6, "trunk_top": 29, "palette": GREEN,
     "clusters": [(5, 23, 24, 35), (16, 16, 38, 31), (31, 14, 53, 29), (44, 21, 62, 35), (13, 27, 39, 40), (31, 25, 56, 39)]},
    {"asset_id": "tree-redwood-tall-quality-044", "seed": 20260702, "trunk_width": 7, "trunk_top": 17, "palette": COOL,
     "clusters": [(25, 3, 40, 17), (19, 11, 46, 24), (15, 20, 50, 32), (12, 29, 53, 42), (18, 37, 47, 49)]},
    {"asset_id": "tree-copper-autumn-quality-045", "seed": 20260703, "trunk_width": 8, "trunk_top": 24, "palette": RED,
     "clusters": [(8, 24, 27, 42), (14, 12, 34, 31), (27, 6, 46, 27), (40, 13, 58, 33), (38, 29, 56, 47), (20, 31, 42, 51)]},
    {"asset_id": "tree-silver-leaf-quality-046", "seed": 20260704, "trunk_width": 5, "trunk_top": 22, "palette": BLUE,
     "clusters": [(11, 17, 28, 35), (20, 8, 39, 27), (34, 10, 53, 29), (43, 23, 60, 41), (28, 28, 50, 48), (12, 31, 34, 48)]},
    {"asset_id": "tree-pollard-knotted-quality-047", "seed": 20260705, "trunk_width": 10, "trunk_top": 31, "palette": GOLD,
     "clusters": [(7, 22, 25, 40), (18, 13, 36, 32), (31, 17, 49, 36), (43, 24, 60, 42), (23, 29, 43, 48)]},
    {"asset_id": "tree-river-bent-quality-048", "seed": 20260706, "trunk_width": 6, "trunk_top": 26, "palette": GREEN,
     "clusters": [(4, 16, 23, 34), (14, 9, 34, 28), (28, 12, 48, 31), (39, 22, 59, 42), (20, 27, 43, 47)]},
    {"asset_id": "tree-alpine-compact-quality-049", "seed": 20260707, "trunk_width": 6, "trunk_top": 28, "palette": COOL,
     "clusters": [(25, 5, 39, 19), (19, 14, 46, 27), (14, 23, 51, 36), (10, 32, 55, 45), (18, 40, 48, 51)]},
    {"asset_id": "tree-purple-season-quality-050", "seed": 20260708, "trunk_width": 7, "trunk_top": 24, "palette": PURPLE,
     "clusters": [(9, 25, 27, 43), (14, 13, 34, 33), (27, 7, 46, 27), (40, 14, 58, 34), (36, 30, 55, 48), (19, 32, 40, 51)]},
    {"asset_id": "tree-twin-trunk-crown-quality-051", "seed": 20260709, "trunk_width": 9, "trunk_top": 27, "palette": GREEN,
     "clusters": [(6, 24, 27, 43), (12, 12, 33, 32), (28, 8, 48, 29), (42, 18, 61, 39), (31, 31, 53, 49)]},
    {"asset_id": "tree-orchard-low-quality-052", "seed": 20260710, "trunk_width": 7, "trunk_top": 30, "palette": GOLD,
     "clusters": [(6, 27, 25, 43), (14, 19, 34, 37), (27, 17, 47, 36), (40, 23, 59, 41), (21, 31, 44, 49)]},
    {"asset_id": "tree-mountain-windswept-quality-053", "seed": 20260711, "trunk_width": 6, "trunk_top": 27, "palette": BLUE,
     "clusters": [(5, 18, 24, 34), (15, 12, 35, 29), (29, 16, 49, 34), (42, 24, 62, 42), (22, 29, 47, 47)]},
    {"asset_id": "tree-broad-heart-crown-quality-054", "seed": 20260712, "trunk_width": 8, "trunk_top": 25, "palette": GREEN,
     "clusters": [(8, 19, 29, 39), (16, 8, 37, 29), (30, 7, 51, 29), (41, 18, 60, 39), (31, 29, 52, 49), (15, 29, 37, 49)]},
    {"asset_id": "tree-golden-spire-quality-055", "seed": 20260713, "trunk_width": 5, "trunk_top": 20, "palette": GOLD,
     "clusters": [(27, 3, 39, 18), (21, 11, 45, 26), (17, 21, 49, 35), (14, 31, 52, 45), (21, 40, 46, 51)]},
    {"asset_id": "tree-cool-round-canopy-quality-056", "seed": 20260714, "trunk_width": 8, "trunk_top": 26, "palette": BLUE,
     "clusters": [(8, 25, 27, 43), (12, 14, 33, 34), (24, 7, 45, 28), (38, 11, 58, 32), (42, 27, 60, 45), (27, 31, 51, 51), (12, 32, 35, 49)]},
)


def enrich_crown_source(asset_id: str, seed: int) -> None:
    """Add controlled leaf tones to the source layer before compositing."""
    crown_path = SOURCE_ROOT / asset_id / "crown.png"
    image = Image.open(crown_path).convert("RGBA")
    draw = ImageDraw.Draw(image)
    colors = (
        (238, 246, 176, 255),
        (204, 226, 132, 255),
        (118, 160, 91, 255),
        (54, 95, 64, 255),
        (31, 61, 48, 255),
        (173, 205, 112, 255),
    )
    offset = seed % 17
    placed = 0
    for y in range(10 + offset % 4, 96, 8):
        for x in range(12 + offset % 6, 116, 10):
            if image.getpixel((x, y))[3] == 0:
                continue
            draw.rectangle((x, y, x + 1, y + 1), fill=colors[(placed + offset) % len(colors)])
            placed += 1
            if placed >= 36:
                image.save(crown_path, "PNG", optimize=True)
                return
    image.save(crown_path, "PNG", optimize=True)


def main() -> None:
    created = 0
    for profile in PROFILES:
        asset_id = str(profile["asset_id"])
        output = OUTPUT_ROOT / asset_id
        if output.exists():
            continue
        create_asset(profile)
        enrich_crown_source(asset_id, int(profile["seed"]))
        build_layered_asset(SOURCE_ROOT / asset_id / "manifest.json", OUTPUT_ROOT)
        report = judge_single_asset(output)
        if report["status"] != "passed" or report["vjB"]["status"] != "passed":
            raise ValueError(f"新候选未通过 VJ-A/VJ-B1：{asset_id} / {report}")
        created += 1
        print(f"已生成正向候选：{asset_id}")
    print(f"正向候选完成：新增 {created}，目标 {len(PROFILES)}")


if __name__ == "__main__":
    main()

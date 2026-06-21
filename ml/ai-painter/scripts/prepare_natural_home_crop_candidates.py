from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw


REQUIRED_SIZE = (256, 192)


CURATED_CROPS = [
    {
        "source": "scene_001_early_settlement.png",
        "crops": [
            {"id": "river-forest-northeast", "box": [768, 0, 1536, 576], "tags": ["forest", "river", "rocks", "grass"], "include": False},
            {"id": "stream-bank-east", "box": [768, 256, 1536, 832], "tags": ["stream", "shoreline", "trees"], "include": False},
            {"id": "meadow-stones-north", "box": [384, 0, 1152, 576], "tags": ["meadow", "stones", "trees"], "include": False},
            {"id": "upper-left-forest-edge", "box": [0, 0, 384, 288], "tags": ["forest", "grass", "flowers"]},
            {"id": "upper-river-reeds", "box": [896, 0, 1408, 384], "tags": ["river", "reeds", "rocks"]},
            {"id": "north-river-canopy", "box": [1024, 0, 1536, 384], "tags": ["river", "tree", "shoreline"]},
            {"id": "east-river-bank-tight", "box": [960, 128, 1472, 512], "tags": ["water", "shoreline", "rocks"]},
            {"id": "south-river-clean", "box": [928, 512, 1440, 896], "tags": ["water", "shoreline", "flowers"], "include": False},
            {"id": "south-meadow-tree", "box": [512, 608, 1024, 992], "tags": ["grass", "tree", "rocks"]},
            {"id": "southwest-path-meadow", "box": [0, 480, 512, 864], "tags": ["natural_path", "flowers", "trees"]},
            {"id": "northwest-forest-close", "box": [0, 0, 512, 384], "tags": ["forest", "grass", "rocks"]},
            {"id": "northwest-tree-grass", "box": [128, 0, 512, 288], "tags": ["tree", "grass", "flowers"]},
            {"id": "river-north-tight", "box": [896, 0, 1280, 288], "tags": ["river", "shoreline", "rocks"]},
            {"id": "river-far-north", "box": [1152, 0, 1536, 288], "tags": ["river", "tree", "shoreline"]},
            {"id": "river-middle-tight", "box": [896, 192, 1280, 480], "tags": ["river", "reeds", "rocks"]},
            {"id": "river-east-middle", "box": [1152, 192, 1536, 480], "tags": ["river", "grass", "shoreline"]},
            {"id": "southwest-forest-path", "box": [0, 672, 384, 960], "tags": ["natural_path", "forest", "flowers"]},
            {"id": "northwest-tree-line-wide", "box": [0, 0, 768, 384], "tags": ["forest", "grass", "flowers"]},
            {"id": "northeast-river-reed-wide", "box": [960, 0, 1536, 432], "tags": ["river", "reeds", "shoreline"]},
            {"id": "south-central-tree-flower", "box": [512, 640, 1152, 1024], "tags": ["tree", "flowers", "grass"]},
            {"id": "lower-river-rock-edge", "box": [896, 384, 1536, 864], "tags": ["river", "rocks", "shoreline"], "include": False},
        ],
    },
    {
        "source": "scene_002_meadow_spring_shelter.png",
        "crops": [
            {"id": "river-meadow-west", "box": [0, 0, 768, 576], "tags": ["river", "meadow", "shoreline"]},
            {"id": "pond-forest-west", "box": [0, 256, 768, 832], "tags": ["pond", "trees", "rocks"], "include": False},
            {"id": "flower-meadow-northwest", "box": [160, 0, 928, 576], "tags": ["flowers", "meadow", "trees"], "include": False},
            {"id": "forest-left-clean", "box": [0, 0, 512, 384], "tags": ["forest", "flowers", "grass"]},
            {"id": "meadow-left-center", "box": [0, 256, 512, 640], "tags": ["grass", "rocks", "flowers"]},
            {"id": "lower-left-meadow", "box": [0, 512, 512, 896], "tags": ["grass", "flowers", "rocks"]},
            {"id": "pond-southeast", "box": [896, 512, 1408, 896], "tags": ["pond", "shoreline", "reeds"], "include": False},
            {"id": "pond-stones-tight", "box": [768, 448, 1280, 832], "tags": ["water", "rocks", "grass"], "include": False},
            {"id": "east-path-meadow", "box": [1024, 0, 1536, 384], "tags": ["natural_path", "grass", "flowers"]},
            {"id": "lower-open-grass", "box": [384, 640, 896, 1024], "tags": ["grass", "flowers", "rocks"]},
            {"id": "west-forest-bottom", "box": [0, 640, 384, 928], "tags": ["forest", "flowers", "grass"]},
            {"id": "west-flower-meadow-tight", "box": [0, 128, 384, 416], "tags": ["flowers", "grass", "tree"]},
            {"id": "west-meadow-rocks-tight", "box": [0, 384, 384, 672], "tags": ["grass", "rocks", "flowers"]},
            {"id": "south-meadow-flowers-tight", "box": [192, 576, 576, 864], "tags": ["grass", "flowers", "rocks"]},
            {"id": "east-path-flowers-tight", "box": [1024, 128, 1408, 416], "tags": ["natural_path", "flowers", "grass"]},
            {"id": "far-south-pond-edge", "box": [1152, 512, 1536, 800], "tags": ["water", "shoreline", "reeds"]},
            {"id": "south-open-grass-tight", "box": [768, 640, 1152, 928], "tags": ["grass", "flowers", "rocks"]},
            {"id": "lower-west-forest-tight", "box": [0, 736, 384, 1024], "tags": ["forest", "grass", "flowers"]},
            {"id": "top-forest-meadow", "box": [0, 0, 768, 384], "tags": ["forest", "grass", "flowers"]},
            {"id": "north-meadow-path-east", "box": [768, 0, 1536, 384], "tags": ["natural_path", "grass", "flowers"]},
            {"id": "south-pond-wide", "box": [768, 512, 1536, 1024], "tags": ["pond", "shoreline", "rocks"]},
            {"id": "lower-left-forest-pond-edge", "box": [0, 640, 768, 1024], "tags": ["forest", "pond", "grass"]},
            {"id": "west-meadow-waterline", "box": [0, 384, 512, 768], "tags": ["grass", "shoreline", "flowers"]},
            {"id": "east-flower-field", "box": [1024, 256, 1536, 640], "tags": ["natural_path", "flowers", "grass"]},
        ],
    },
    {
        "source": "scene_003_lakeside_work_canopy.png",
        "crops": [
            {"id": "water-meadow-west", "box": [0, 0, 768, 576], "tags": ["water", "meadow", "shoreline"]},
            {"id": "birch-river-west", "box": [0, 256, 768, 832], "tags": ["water", "birch", "shoreline"]},
            {"id": "upper-left-lake-rocks", "box": [0, 0, 512, 384], "tags": ["water", "rocks", "shoreline"], "include": False},
            {"id": "lake-lilies-clean", "box": [0, 384, 512, 768], "tags": ["water", "lilies", "shoreline"]},
            {"id": "right-meadow-path", "box": [1024, 256, 1536, 640], "tags": ["natural_path", "grass", "birch"], "include": False},
            {"id": "right-birch-meadow", "box": [1024, 0, 1536, 384], "tags": ["birch", "grass", "flowers"]},
            {"id": "lower-right-shore", "box": [1024, 608, 1536, 992], "tags": ["water", "shoreline", "grass"]},
            {"id": "lower-lake-clear", "box": [0, 640, 512, 1024], "tags": ["water", "lilies", "rocks"]},
            {"id": "central-cliff-green", "box": [256, 64, 768, 448], "tags": ["cliff", "grass", "rocks"]},
            {"id": "lake-northwest-tight", "box": [0, 0, 384, 288], "tags": ["water", "rocks", "shoreline"]},
            {"id": "lake-middle-west-tight", "box": [0, 288, 384, 576], "tags": ["water", "shoreline", "lilies"]},
            {"id": "lake-southwest-tight", "box": [0, 576, 384, 864], "tags": ["water", "lilies", "rocks"]},
            {"id": "far-right-birch-tight", "box": [1152, 0, 1536, 288], "tags": ["birch", "grass", "flowers"]},
            {"id": "right-grass-rocks-tight", "box": [1152, 384, 1536, 672], "tags": ["grass", "rocks", "flowers"]},
            {"id": "right-lower-water-tight", "box": [1152, 640, 1536, 928], "tags": ["water", "shoreline", "grass"]},
            {"id": "lake-upper-left-square", "box": [0, 0, 512, 512], "tags": ["water", "rocks", "shoreline"]},
            {"id": "lake-left-vertical", "box": [0, 128, 512, 640], "tags": ["water", "shoreline", "reeds"]},
            {"id": "lake-lower-left-square", "box": [0, 512, 512, 1024], "tags": ["water", "lilies", "rocks"]},
            {"id": "birch-north-meadow", "box": [768, 0, 1280, 384], "tags": ["birch", "grass", "flowers"], "include": False},
            {"id": "far-south-water-rocks", "box": [0, 704, 768, 1024], "tags": ["water", "rocks", "shoreline"]},
        ],
    },
    {
        "source": "scene_004_orchard_storehouse_frame.png",
        "crops": [
            {"id": "orchard-meadow-west", "box": [0, 0, 768, 576], "tags": ["orchard", "grass", "flowers"], "include": False},
            {"id": "orchard-path-southwest", "box": [0, 448, 768, 1024], "tags": ["trees", "path", "flowers"], "include": False},
            {"id": "orchard-east-clean", "box": [1024, 0, 1536, 384], "tags": ["orchard", "grass", "path"]},
            {"id": "orchard-southeast", "box": [1024, 384, 1536, 768], "tags": ["orchard", "grass", "flowers"]},
            {"id": "lower-orchard-grass", "box": [768, 640, 1280, 1024], "tags": ["grass", "orchard", "rocks"]},
            {"id": "north-cliff-meadow", "box": [0, 0, 512, 384], "tags": ["cliff", "grass", "flowers"]},
            {"id": "north-orchard-path", "box": [768, 0, 1280, 384], "tags": ["orchard", "natural_path", "grass"]},
            {"id": "south-flower-meadow", "box": [512, 640, 1024, 1024], "tags": ["grass", "flowers", "rocks"]},
            {"id": "east-orchard-close", "box": [1024, 0, 1408, 288], "tags": ["orchard", "grass", "flowers"]},
            {"id": "far-east-orchard-path", "box": [1152, 160, 1536, 448], "tags": ["orchard", "natural_path", "grass"]},
            {"id": "southeast-orchard-tight", "box": [1024, 512, 1408, 800], "tags": ["orchard", "grass", "flowers"]},
            {"id": "northwest-cliff-tight", "box": [0, 0, 384, 288], "tags": ["cliff", "grass", "flowers"]},
            {"id": "north-orchard-tight", "box": [512, 0, 896, 288], "tags": ["tree", "grass", "flowers"]},
            {"id": "south-meadow-tight", "box": [768, 736, 1152, 1024], "tags": ["grass", "flowers", "rocks"]},
            {"id": "orchard-northeast-wide", "box": [896, 0, 1536, 512], "tags": ["orchard", "grass", "natural_path"], "include": False},
            {"id": "orchard-east-path-wide", "box": [1024, 0, 1536, 512], "tags": ["orchard", "path", "flowers"], "include": False},
            {"id": "orchard-lower-east-wide", "box": [896, 512, 1536, 1024], "tags": ["orchard", "grass", "rocks"], "include": False},
            {"id": "orchard-south-grass", "box": [768, 704, 1536, 1024], "tags": ["grass", "orchard", "flowers"], "include": False},
            {"id": "north-cliff-flower-wide", "box": [0, 0, 640, 360], "tags": ["cliff", "grass", "flowers"], "include": False},
        ],
    },
    {
        "source": "scene_005_highland_quarry_refuge.png",
        "crops": [
            {"id": "stream-forest-south", "box": [0, 448, 768, 1024], "tags": ["stream", "rocks", "trees"]},
            {"id": "rock-meadow-east", "box": [768, 192, 1536, 768], "tags": ["grass", "rocks", "trees"], "include": False},
            {"id": "east-rock-meadow-tight", "box": [1024, 128, 1536, 512], "tags": ["rocks", "grass", "trees"], "include": False},
            {"id": "southeast-stream-bank", "box": [1024, 512, 1536, 896], "tags": ["stream", "rocks", "grass"]},
            {"id": "lower-stream-center", "box": [512, 640, 1024, 1024], "tags": ["stream", "shoreline", "rocks"]},
            {"id": "southwest-stream-path", "box": [0, 640, 512, 1024], "tags": ["stream", "natural_path", "trees"]},
            {"id": "right-forest-rocks", "box": [1024, 0, 1536, 384], "tags": ["forest", "rocks", "grass"]},
            {"id": "central-grass-rocks", "box": [640, 384, 1152, 768], "tags": ["grass", "rocks", "flowers"], "include": False},
            {"id": "south-rock-garden", "box": [768, 512, 1280, 896], "tags": ["rocks", "grass", "stream"]},
            {"id": "lower-right-conifers", "box": [1024, 640, 1536, 1024], "tags": ["conifer", "rocks", "grass"]},
            {"id": "far-right-rocks-tight", "box": [1152, 0, 1536, 288], "tags": ["rocks", "grass", "conifer"], "include": False},
            {"id": "right-meadow-rocks-tight", "box": [1152, 256, 1536, 544], "tags": ["grass", "rocks", "flowers"]},
            {"id": "right-stream-tight", "box": [1152, 512, 1536, 800], "tags": ["stream", "shoreline", "rocks"]},
            {"id": "southeast-conifer-tight", "box": [1024, 736, 1408, 1024], "tags": ["conifer", "grass", "rocks"]},
            {"id": "lower-center-stream-tight", "box": [512, 736, 896, 1024], "tags": ["stream", "shoreline", "grass"]},
            {"id": "south-rock-stream-tight", "box": [768, 640, 1152, 928], "tags": ["rocks", "stream", "grass"]},
            {"id": "right-upper-forest-rocks-wide", "box": [1024, 0, 1536, 512], "tags": ["forest", "rocks", "grass"]},
            {"id": "right-mid-meadow-rocks", "box": [1024, 256, 1408, 640], "tags": ["grass", "rocks", "flowers"], "include": False},
            {"id": "stream-bottom-wide", "box": [512, 704, 1280, 1024], "tags": ["stream", "shoreline", "rocks"], "include": False},
            {"id": "stream-lower-east-wide", "box": [896, 640, 1408, 1024], "tags": ["stream", "rocks", "grass"]},
            {"id": "conifer-rock-corner", "box": [1152, 704, 1536, 1024], "tags": ["conifer", "rocks", "stream"]},
            {"id": "left-lower-conifer-path", "box": [0, 512, 512, 896], "tags": ["conifer", "path", "flowers"], "include": False},
        ],
    },
]


def main() -> int:
    parser = ArgumentParser(description="Prepare no-building natural home crop candidates from owner-approved draft scenes.")
    parser.add_argument("--source-root", type=Path, default=Path.home() / "Desktop" / "AI-Painter-Training-Drafts" / "scene")
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-crop-candidates"))
    args = parser.parse_args()

    output_root = args.output_root.resolve()
    if output_root.exists():
        shutil.rmtree(output_root)
    image_root = output_root / "images"
    image_root.mkdir(parents=True, exist_ok=True)

    samples: list[dict[str, Any]] = []
    for scene in CURATED_CROPS:
        source_path = args.source_root / scene["source"]
        if not source_path.is_file():
            raise FileNotFoundError(source_path)
        with Image.open(source_path).convert("RGB") as source:
            for crop in scene["crops"]:
                if crop.get("include") is False:
                    continue
                box = tuple(crop["box"])
                sample_id = f"natural-home-{Path(scene['source']).stem}-{crop['id']}"
                target = image_root / f"{sample_id}.png"
                image = source.crop(box).resize(REQUIRED_SIZE, Image.Resampling.LANCZOS)
                image.save(target)
                samples.append({
                    "sampleId": sample_id,
                    "source": str(source_path),
                    "cropBox": crop["box"],
                    "target": str(target),
                    "tags": crop["tags"],
                    "reviewStatus": "pending_visual_owner_check",
                    "declaredNoForbiddenContent": True,
                    "forbiddenContent": ["building", "shelter", "construction_material", "character", "animal", "insect", "butler"],
                    "allowedContent": ["grass", "tree", "rock", "flower", "bush", "water", "shoreline", "natural_path"],
                })

    write_json(output_root / "crop-manifest.json", {
        "schemaVersion": "natural-home-crop-candidates-v1",
        "stageId": "natural-home-v1-no-building",
        "sourceRoot": str(args.source_root),
        "outputRoot": str(output_root),
        "sampleCount": len(samples),
        "samples": samples,
    })
    build_contact_sheet(samples, output_root / "contact-sheet.png")
    print(json.dumps({"outputRoot": str(output_root), "sampleCount": len(samples)}, ensure_ascii=False, indent=2))
    return 0


def build_contact_sheet(samples: list[dict[str, Any]], output: Path) -> None:
    cols = 4
    tile_w, tile_h = 256, 228
    rows = max(1, (len(samples) + cols - 1) // cols)
    sheet = Image.new("RGB", (cols * tile_w, rows * tile_h), (10, 24, 18))
    draw = ImageDraw.Draw(sheet)
    for index, sample in enumerate(samples):
        row, col = divmod(index, cols)
        x = col * tile_w
        y = row * tile_h
        with Image.open(sample["target"]).convert("RGB") as image:
            sheet.paste(image, (x, y))
        draw.text((x + 4, y + 196), f"{index + 1}. {sample['sampleId'][-28:]}", fill=(190, 245, 210))
        draw.text((x + 4, y + 212), ", ".join(sample["tags"][:4]), fill=(150, 210, 170))
    sheet.save(output)


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

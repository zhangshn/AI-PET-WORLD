from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from .channels import V0_MASK_CHANNELS
from .schema import Blueprint

MASK_NAMES = V0_MASK_CHANNELS


def render_blueprint_masks(blueprint: Blueprint, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    masks = {
        name: Image.new("L", (blueprint.width, blueprint.height), 0)
        for name in MASK_NAMES
    }

    for region in blueprint.terrain_regions:
        ImageDraw.Draw(masks[region.terrain]).polygon(region.polygon, fill=255)

    for road in blueprint.roads:
        ImageDraw.Draw(masks["road"]).line(
            road.points, fill=255, width=road.width, joint="curve"
        )

    for item in blueprint.objects:
        box = (item.x, item.y, item.x + item.width - 1, item.y + item.height - 1)
        ImageDraw.Draw(masks[item.kind]).rectangle(box, fill=255)
        depth = max(1, min(255, round((item.y + item.height) / blueprint.height * 255)))
        ImageDraw.Draw(masks["depth"]).rectangle(box, fill=depth)

    walkable = masks["grass"].copy()
    blocked = Image.new("L", walkable.size, 0)
    for name in ("water", "tree", "rock", "shelter"):
        blocked = ImageChops.lighter(blocked, masks[name])
    walkable.paste(0, mask=blocked)
    masks["walkable"] = ImageChops.lighter(walkable, masks["road"])

    paths: dict[str, Path] = {}
    for name, image in masks.items():
        path = output_dir / f"{name}.png"
        image.save(path, format="PNG", optimize=True)
        paths[name] = path
    return paths

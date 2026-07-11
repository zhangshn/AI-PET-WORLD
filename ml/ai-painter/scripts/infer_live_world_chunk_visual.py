from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.training.dataset import append_condition_extra_channels
from ai_painter.training.rgb_refiner_model import build_rgb_refiner
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


TERRAIN_GRASS = {"grass", "tall_grass", "forest_edge", "meadow", "plain"}
TERRAIN_WATER = {"water", "water_body", "pond", "river", "stream"}
TERRAIN_ROAD = {"dirt_path", "road", "path", "trail"}
TERRAIN_SHORE = {"shoreline", "mud_shore", "river_bank"}


def main() -> int:
    parser = ArgumentParser(description="Run live-world ChunkVisualInput through the local AI Painter models.")
    parser.add_argument("--input", type=Path, default=env_path("LIVE_WORLD_INPUT_PATH"))
    parser.add_argument("--output-image", type=Path, default=env_path("LIVE_WORLD_OUTPUT_IMAGE_PATH"))
    parser.add_argument("--output-meta", type=Path, default=env_path("LIVE_WORLD_OUTPUT_META_PATH"))
    parser.add_argument("--candidate-root", type=Path, default=env_path("LIVE_WORLD_CANDIDATE_ROOT"))
    parser.add_argument("--structure-checkpoint", type=Path, default=Path(".runtime/ai-painter/natural-home-v28-structure-guided-training/best.pt"))
    parser.add_argument("--refiner-checkpoint", type=Path, default=Path(".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-training/best.pt"))
    parser.add_argument("--write-condition-debug", action="store_true")
    args = parser.parse_args()
    require_path(args.input, "--input or LIVE_WORLD_INPUT_PATH")
    require_path(args.output_image, "--output-image or LIVE_WORLD_OUTPUT_IMAGE_PATH")
    require_path(args.output_meta, "--output-meta or LIVE_WORLD_OUTPUT_META_PATH")
    require_path(args.candidate_root, "--candidate-root or LIVE_WORLD_CANDIDATE_ROOT")

    chunk_input = json.loads(args.input.read_text(encoding="utf-8"))
    masks = build_condition_masks(chunk_input)
    args.candidate_root.mkdir(parents=True, exist_ok=True)
    if args.write_condition_debug:
        write_condition_debug(masks, args.candidate_root / "condition-masks")

    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    condition = torch.cat(
        [
            torch.from_numpy(masks[channel]).view(1, CANVAS_HEIGHT, CANVAS_WIDTH).float().div(255.0)
            for channel in V1_CONDITION_CHANNELS
        ],
        dim=0,
    )

    structure_state = torch.load(args.structure_checkpoint, map_location=device, weights_only=False)
    structure_model = build_structure_guided_unet(structure_state["config"]).to(device)
    structure_model.load_state_dict(structure_state["model"])
    structure_model.eval()

    refiner_state = torch.load(args.refiner_checkpoint, map_location=device, weights_only=False)
    refiner = build_rgb_refiner(refiner_state["config"]).to(device)
    refiner.load_state_dict(refiner_state["model"])
    refiner.eval()

    extra_channels = list(refiner_state.get("config", {}).get("conditionExtraChannels", []))
    refined_condition = append_condition_extra_channels(condition, torch, chunk_input["chunkId"], extra_channels).unsqueeze(0).to(device)

    with torch.inference_mode():
        base_rgb, _ = structure_model(refined_condition[:, : len(V1_CONDITION_CHANNELS)])
        prediction = refiner(refined_condition, base_rgb)

    pixels = prediction[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
    args.output_image.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.asarray(pixels, dtype=np.uint8)).save(args.output_image)

    meta = {
        "metaVersion": "live-world-p10-inference-output-v1",
        "status": "generated",
        "imageGenerated": True,
        "chunkId": chunk_input["chunkId"],
        "inputPath": str(args.input),
        "outputImagePath": str(args.output_image),
        "outputImageHash": hashlib.sha256(args.output_image.read_bytes()).hexdigest(),
        "structureCheckpoint": str(args.structure_checkpoint),
        "refinerCheckpoint": str(args.refiner_checkpoint),
        "device": str(device),
        "conditionChannels": list(V1_CONDITION_CHANNELS),
        "conditionExtraChannels": extra_channels,
        "tileSource": {
            "tileWidth": chunk_input.get("tileWidth"),
            "tileHeight": chunk_input.get("tileHeight"),
            "sourcePixelWidth": chunk_input.get("pixelWidth"),
            "sourcePixelHeight": chunk_input.get("pixelHeight"),
            "modelPixelWidth": CANVAS_WIDTH,
            "modelPixelHeight": CANVAS_HEIGHT,
        },
        "entitySummary": summarize_entities(chunk_input.get("entityMap", [])),
        "forbiddenSideEffects": {
            "writesApprovedVisuals": False,
            "writesTrainingSamples": False,
            "bypassesRuntimePageGate": False,
        },
    }
    args.output_meta.parent.mkdir(parents=True, exist_ok=True)
    args.output_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    return 0


def env_path(name: str) -> Path | None:
    import os

    value = os.environ.get(name)
    return Path(value) if value else None


def require_path(value: Path | None, label: str) -> None:
    if value is None:
        raise ValueError(f"missing required path: {label}")


def build_condition_masks(chunk_input: dict[str, Any]) -> dict[str, np.ndarray]:
    terrain = chunk_input["terrainMask"]
    walkable = chunk_input.get("walkableMask")
    collision = chunk_input.get("collisionMask")
    tile_width = int(chunk_input["tileWidth"])
    tile_height = int(chunk_input["tileHeight"])

    masks = {name: np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8) for name in V1_CONDITION_CHANNELS}

    for tile_y in range(tile_height):
        for tile_x in range(tile_width):
            tile = str(terrain[tile_y][tile_x])
            box = tile_box(tile_x, tile_y, tile_width, tile_height)
            if tile in TERRAIN_WATER:
                fill_box(masks["water_body"], box, 255)
            elif tile in TERRAIN_ROAD:
                fill_box(masks["road_center"], inset_box(box, 0.12), 255)
                fill_box(masks["road_edge"], box, 120)
            else:
                fill_box(masks["grass"], box, 255 if tile in TERRAIN_GRASS else 180)
            if tile in TERRAIN_SHORE:
                fill_box(masks["shoreline"], box, 255)
            if walkable is not None and bool(walkable[tile_y][tile_x]):
                fill_box(masks["walkable"], box, 255)
            elif collision is not None and not bool(collision[tile_y][tile_x]):
                fill_box(masks["walkable"], box, 255)
            elif walkable is None and collision is None and tile not in TERRAIN_WATER:
                fill_box(masks["walkable"], box, 255)

    add_derived_shoreline(masks, terrain, tile_width, tile_height)
    draw_entities(masks, chunk_input.get("entityMap", []), tile_width, tile_height)
    masks["depth"] = build_depth_mask()
    return masks


def tile_box(tile_x: int, tile_y: int, tile_width: int, tile_height: int) -> tuple[int, int, int, int]:
    left = round(tile_x * CANVAS_WIDTH / tile_width)
    right = round((tile_x + 1) * CANVAS_WIDTH / tile_width)
    top = round(tile_y * CANVAS_HEIGHT / tile_height)
    bottom = round((tile_y + 1) * CANVAS_HEIGHT / tile_height)
    return left, top, max(left + 1, right), max(top + 1, bottom)


def inset_box(box: tuple[int, int, int, int], ratio: float) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    inset_x = max(1, round((right - left) * ratio))
    inset_y = max(1, round((bottom - top) * ratio))
    return left + inset_x, top + inset_y, right - inset_x, bottom - inset_y


def fill_box(mask: np.ndarray, box: tuple[int, int, int, int], value: int) -> None:
    left, top, right, bottom = box
    mask[max(0, top): min(CANVAS_HEIGHT, bottom), max(0, left): min(CANVAS_WIDTH, right)] = value


def add_derived_shoreline(masks: dict[str, np.ndarray], terrain: list[list[str]], tile_width: int, tile_height: int) -> None:
    for tile_y in range(tile_height):
        for tile_x in range(tile_width):
            tile = str(terrain[tile_y][tile_x])
            neighbors = [
                terrain[ny][nx]
                for nx, ny in ((tile_x - 1, tile_y), (tile_x + 1, tile_y), (tile_x, tile_y - 1), (tile_x, tile_y + 1))
                if 0 <= nx < tile_width and 0 <= ny < tile_height
            ]
            if tile in TERRAIN_WATER and any(str(value) not in TERRAIN_WATER for value in neighbors):
                fill_box(masks["shoreline"], tile_box(tile_x, tile_y, tile_width, tile_height), 255)
            if tile not in TERRAIN_WATER and any(str(value) in TERRAIN_WATER for value in neighbors):
                fill_box(masks["shoreline"], tile_box(tile_x, tile_y, tile_width, tile_height), 180)


def draw_entities(masks: dict[str, np.ndarray], entities: list[dict[str, Any]], tile_width: int, tile_height: int) -> None:
    drawing_images = {name: Image.fromarray(mask) for name, mask in masks.items()}
    draw_by_name = {name: ImageDraw.Draw(image) for name, image in drawing_images.items()}

    for entity in entities:
        entity_type = str(entity.get("entityType", ""))
        x = int(entity.get("tileX", 0))
        y = int(entity.get("tileY", 0))
        width = max(1, int(entity.get("widthTiles", 1)))
        height = max(1, int(entity.get("heightTiles", 1)))
        left, top, right, bottom = tile_box(x, y, tile_width, tile_height)
        right = round((x + width) * CANVAS_WIDTH / tile_width)
        bottom = round((y + height) * CANVAS_HEIGHT / tile_height)
        box = (left, top, max(left + 1, right), max(top + 1, bottom))

        if entity_type == "tree":
            crown = expand_box(box, 0.35)
            trunk = center_box(box, 0.18, 0.38)
            draw_by_name["tree_crown"].ellipse(crown, fill=255)
            draw_by_name["tree_trunk"].rectangle(trunk, fill=255)
            draw_by_name["walkable"].rectangle(box, fill=0)
        elif entity_type in {"rock", "ore_rock"}:
            draw_by_name["rock"].ellipse(box, fill=255)
            draw_by_name["walkable"].rectangle(box, fill=0)
        elif entity_type in {"berry_bush", "grass_clump", "flower", "reed"}:
            draw_by_name["grass"].ellipse(box, fill=220)
        elif entity_type in {"shelter", "hut", "building"}:
            draw_by_name["shelter_foundation"].rectangle(box, fill=255)
            draw_by_name["shelter_wall"].rectangle(inset_box(box, 0.10), fill=255)
            draw_by_name["shelter_roof"].polygon([(left, top), (right, top), ((left + right) // 2, max(0, top - (bottom - top) // 2))], fill=255)
            draw_by_name["walkable"].rectangle(box, fill=0)

    for name, image in drawing_images.items():
        masks[name][:] = np.asarray(image, dtype=np.uint8)


def expand_box(box: tuple[int, int, int, int], ratio: float) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    return (
        max(0, round(left - width * ratio)),
        max(0, round(top - height * ratio)),
        min(CANVAS_WIDTH - 1, round(right + width * ratio)),
        min(CANVAS_HEIGHT - 1, round(bottom + height * ratio)),
    )


def center_box(box: tuple[int, int, int, int], width_ratio: float, height_ratio: float) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2
    half_width = max(1, round((right - left) * width_ratio))
    half_height = max(1, round((bottom - top) * height_ratio))
    return center_x - half_width, center_y - half_height, center_x + half_width, center_y + half_height


def build_depth_mask() -> np.ndarray:
    gradient = np.linspace(50, 230, CANVAS_HEIGHT, dtype=np.uint8)
    return np.repeat(gradient[:, None], CANVAS_WIDTH, axis=1)


def write_condition_debug(masks: dict[str, np.ndarray], output_root: Path) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    for name, mask in masks.items():
        Image.fromarray(mask).save(output_root / f"{name}.png")


def summarize_entities(entities: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entity in entities:
        entity_type = str(entity.get("entityType", "unknown"))
        counts[entity_type] = counts.get(entity_type, 0) + 1
    return counts


if __name__ == "__main__":
    raise SystemExit(main())

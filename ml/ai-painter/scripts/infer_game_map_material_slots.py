from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


UNIT_TO_MODEL_CATEGORY = {
    "grass_texture": "grass",
    "boundary_texture": "tree",
    "grass_detail_visual_unit": "grass_object",
    "flower_visual_unit": "grass_object",
    "shrub_visual_unit": "tree_object",
    "water_texture": "water",
    "shoreline_texture": "shoreline",
    "path_texture": "road",
    "tree_visual_unit": "tree_object",
    "rock_visual_unit": "rock_object",
}

REFERENCE_DATASET_CATEGORY = {
    "grass_object": "grass",
    "tree_object": "tree",
    "rock_object": "rock",
}

UNIT_TO_ACTIVE_CHANNELS = {
    "grass_texture": ("grass", "walkable", "depth"),
    "boundary_texture": ("grass", "tree_crown", "tree_trunk", "depth"),
    "grass_detail_visual_unit": ("grass", "walkable", "depth"),
    "flower_visual_unit": ("grass", "depth"),
    "shrub_visual_unit": ("tree_crown", "grass", "depth"),
    "water_texture": ("water_body", "depth"),
    "shoreline_texture": ("shoreline", "water_body", "grass", "depth"),
    "path_texture": ("road_center", "walkable", "depth"),
    "tree_visual_unit": ("tree_crown", "tree_trunk", "depth"),
    "rock_visual_unit": ("rock", "depth"),
}


def main() -> int:
    parser = ArgumentParser(description="Infer AI-PET-WORLD game-map material slots with local models.")
    parser.add_argument("--input-pack", type=Path, default=env_path("AI_PAINTER_MATERIAL_INPUT_PACK"))
    parser.add_argument("--output-dir", type=Path, default=env_path("AI_PAINTER_MATERIAL_OUTPUT_DIR"))
    parser.add_argument(
        "--model-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-local-detail-v25-diversity-generalization-training"),
    )
    parser.add_argument("--style-profile", type=Path, default=env_path("AI_PAINTER_MATERIAL_STYLE_PROFILE"))
    parser.add_argument("--reference-dataset-root", type=Path, default=env_path("AI_PAINTER_MATERIAL_REFERENCE_DATASET_ROOT"))
    args = parser.parse_args()

    if args.input_pack is None:
        raise ValueError("missing --input-pack or AI_PAINTER_MATERIAL_INPUT_PACK")
    if args.output_dir is None:
        raise ValueError("missing --output-dir or AI_PAINTER_MATERIAL_OUTPUT_DIR")

    pack = read_json(args.input_pack)
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model_cache: dict[str, Any] = {}
    rows = []
    canvas_bounds = infer_canvas_bounds(pack["slots"])

    for slot in pack["slots"]:
        category = UNIT_TO_MODEL_CATEGORY.get(slot["unitKind"])
        if category is None:
            raise ValueError(f"unsupported material slot unitKind: {slot['unitKind']}")
        model, checkpoint_config, checkpoint_path = load_model(category, args.model_root, torch, device, model_cache)
        condition = build_condition(
            slot,
            category=category,
            model_root=args.model_root,
            style_profile=args.style_profile,
            reference_dataset_root=args.reference_dataset_root,
            torch=torch,
            config=checkpoint_config,
            canvas_bounds=canvas_bounds,
        )
        original_height = int(condition.shape[1])
        original_width = int(condition.shape[2])
        with torch.inference_mode():
            prediction = infer_condition_tiled(
                model,
                condition,
                device=device,
                torch=torch,
                original_height=original_height,
                original_width=original_width,
                allow_direct=True,
                overlap=64 if is_large_grass_base_slot(slot) else 16,
            )

        output_path = output_dir / slot["expectedOutputFileName"]
        reference_detail_image = None
        if is_large_grass_base_slot(slot) and category == "grass":
            reference_detail_image = build_large_grass_detail_reference_image(
                slot,
                category,
                args.model_root,
                args.style_profile,
                args.reference_dataset_root,
                width=original_width,
                height=original_height,
            )
        output_image = normalize_material_output(
            Image.fromarray(np.asarray(prediction, dtype=np.uint8)),
            slot,
            category=category,
            reference_detail_image=reference_detail_image,
            condition_alpha=read_condition_alpha(slot, size=(int(prediction.shape[1]), int(prediction.shape[0]))),
        )
        output_image.save(output_path)
        rows.append(
            {
                "slotId": slot["slotId"],
                "unitKind": slot["unitKind"],
                "modelCategory": category,
                "output": str(output_path.resolve()),
                "sha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
                "bytes": output_path.stat().st_size,
                "modelCheckpoint": str(checkpoint_path.resolve()),
                "modelInputChannels": int(checkpoint_config.get("inputChannels", 14)),
                "modelInputExtras": checkpoint_config.get("inputExtras", []),
            }
        )

    report = {
        "schemaVersion": "game-map-material-slot-local-model-inference-v1",
        "status": "completed",
        "inputPack": str(args.input_pack.resolve()),
        "outputDir": str(output_dir),
        "slotCount": len(rows),
        "device": str(device),
        "modelRoot": str(args.model_root.resolve()),
        "referenceDatasetRoot": str(resolve_reference_dataset_root(args.model_root, args.style_profile, args.reference_dataset_root).resolve())
        if resolve_reference_dataset_root(args.model_root, args.style_profile, args.reference_dataset_root)
        else None,
        "styleProfile": str(resolve_style_profile_path(args.model_root, args.style_profile).resolve())
        if resolve_style_profile_path(args.model_root, args.style_profile)
        else None,
        "outputs": rows,
        "tags": [
            "local_model_generated_material_slots",
            "checkpoint_config_condition_channels",
            "not_world_page_runtime",
            "requires_approved_material_pack",
        ],
    }
    (output_dir.parent / "local-model-slot-inference.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def env_path(name: str) -> Path | None:
    value = os.environ.get(name)
    return Path(value) if value else None


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_model(category: str, model_root: Path, torch, device, cache: dict[str, Any]):
    if category in cache:
        return cache[category]
    checkpoint_path = model_root / category / "best.pt"
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"missing local material model checkpoint: {checkpoint_path}")
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    checkpoint_config = checkpoint["config"]
    model = build_tiny_unet(checkpoint_config).to(device)
    try:
        model.load_state_dict(checkpoint["model"])
    except RuntimeError:
        model = build_legacy_tiny_unet(checkpoint_config, torch).to(device)
        model.load_state_dict(checkpoint["model"])
    model.eval()
    cache[category] = (model, checkpoint_config, checkpoint_path)
    return cache[category]


def build_legacy_tiny_unet(config: dict[str, object], torch):
    nn = torch.nn
    input_channels = int(config.get("inputChannels", 8))
    output_channels = int(config.get("outputChannels", 3))
    base = int(config.get("baseChannels", 32))

    class ConvBlock(nn.Module):
        def __init__(self, source: int, target: int) -> None:
            super().__init__()
            groups = min(8, target)
            self.layers = nn.Sequential(
                nn.Conv2d(source, target, 3, padding=1),
                nn.GroupNorm(groups, target),
                nn.SiLU(),
                nn.Conv2d(target, target, 3, padding=1),
                nn.GroupNorm(groups, target),
                nn.SiLU(),
            )

        def forward(self, value):
            return self.layers(value)

    class LegacyTinyUNet(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.condition_encoder = ConvBlock(input_channels, base)
            self.encoder_2 = ConvBlock(base, base * 2)
            self.encoder_3 = ConvBlock(base * 2, base * 4)
            self.bottleneck = ConvBlock(base * 4, base * 4)
            self.pool = nn.MaxPool2d(2)
            self.up_3 = nn.ConvTranspose2d(base * 4, base * 4, 2, stride=2)
            self.decoder_3 = ConvBlock(base * 8, base * 2)
            self.up_2 = nn.ConvTranspose2d(base * 2, base * 2, 2, stride=2)
            self.decoder_2 = ConvBlock(base * 4, base)
            self.up_1 = nn.ConvTranspose2d(base, base, 2, stride=2)
            self.decoder_1 = ConvBlock(base * 2, base)
            self.output = nn.Sequential(nn.Conv2d(base, output_channels, 1), nn.Sigmoid())

        def forward(self, condition):
            level_1 = self.condition_encoder(condition)
            level_2 = self.encoder_2(self.pool(level_1))
            level_3 = self.encoder_3(self.pool(level_2))
            center = self.bottleneck(self.pool(level_3))
            decoded_3 = self.decoder_3(torch.cat((self.up_3(center), level_3), dim=1))
            decoded_2 = self.decoder_2(torch.cat((self.up_2(decoded_3), level_2), dim=1))
            decoded_1 = self.decoder_1(torch.cat((self.up_1(decoded_2), level_1), dim=1))
            return self.output(decoded_1)

    return LegacyTinyUNet()


def normalize_material_output(
    image: Image.Image,
    slot: dict[str, Any],
    *,
    category: str,
    reference_detail_image: Image.Image | None = None,
    condition_alpha: Image.Image | None = None,
) -> Image.Image:
    unit_kind = str(slot["unitKind"])
    source_alpha = image.getchannel("A") if image.mode == "RGBA" else None
    output = image.convert("RGB")
    if unit_kind == "grass_texture":
        output = ImageEnhance.Brightness(output).enhance(1.04 if is_large_grass_base_slot(slot) else 1.08)
        output = ImageEnhance.Contrast(output).enhance(1.18 if is_large_grass_base_slot(slot) else 1.34)
        output = ImageEnhance.Sharpness(output).enhance(1.12 if is_large_grass_base_slot(slot) else 1.42)
        if is_large_grass_base_slot(slot):
            output = rebalance_grass_for_world_composite(output, strength=0.30)
            output = soften_grid_artifacts(output, radius=0.36, blend=0.18)
        else:
            output = soften_grid_artifacts(output, radius=0.58, blend=0.58)
        output = suppress_neon_highlights(output, strength=0.48)
        output = suppress_pale_patch_artifacts(output, strength=0.58)
        output = reduce_bright_border(output, factor=0.74, border=8)
    elif unit_kind == "water_texture":
        output = reinforce_water_identity(output)
        output = reinforce_water_flow_detail(output)
        output = rebalance_water_for_world_composite(output)
        output = ImageEnhance.Contrast(output).enhance(1.42)
        output = ImageEnhance.Sharpness(output).enhance(2.32)
        output = soften_grid_artifacts(output, radius=0.52, blend=0.42)
        output = soften_grid_seams(output, grid_size=64, radius=2)
        output = reduce_bright_border(output, factor=0.94, border=4)
        output = reinforce_water_world_glints(output)
    elif unit_kind == "shoreline_texture":
        output = reinforce_shoreline_transition_detail(output)
        output = compress_shoreline_for_world_composite(output, strength=0.62)
        output = ImageEnhance.Contrast(output).enhance(1.42)
        output = ImageEnhance.Sharpness(output).enhance(1.78)
        output = soften_grid_artifacts(output, radius=0.28, blend=0.18)
        output = reduce_bright_border(output, factor=0.90, border=6)
    elif unit_kind == "boundary_texture":
        output = ensure_min_luma(output, target=0.225)
        output = reinforce_green_material_detail(output, strength=0.42)
        output = ImageEnhance.Contrast(output).enhance(1.14)
        output = ImageEnhance.Sharpness(output).enhance(1.04)
        output = soften_grid_artifacts(output, radius=0.72, blend=0.48)
        output = reduce_bright_border(output)
    elif unit_kind == "path_texture":
        output = ImageEnhance.Brightness(output).enhance(0.97)
        output = ImageEnhance.Contrast(output).enhance(1.36)
        output = suppress_neon_highlights(output, strength=0.82)
        output = restore_path_dust_highlights(output)
        output = rebalance_path_for_world_composite(output, strength=0.90)
        output = stabilize_path_surface_for_world_composite(output, strength=0.86)
        output = recover_path_luma_variance_for_world_composite(output, strength=0.79)
        output = repair_path_black_craters_for_world_composite(output, strength=0.92)
        output = reinforce_path_grain_edges(output)
        output = repair_path_black_craters_for_world_composite(output, strength=0.96)
        output = suppress_pale_patch_artifacts(output, strength=0.86)
        output = suppress_neon_highlights(output, strength=0.76)
        output = ImageEnhance.Sharpness(output).enhance(1.46)
    elif unit_kind == "rock_visual_unit":
        output = reinforce_rock_identity(output)
        output = ensure_min_luma(output, target=0.225)
        output = ImageEnhance.Contrast(output).enhance(1.18)
        output = ImageEnhance.Sharpness(output).enhance(1.45)
    elif unit_kind == "flower_visual_unit":
        output = reinforce_flower_highlights(output)
        output = reinforce_object_detail_highlights(output, strength=0.72)
        output = ImageEnhance.Contrast(output).enhance(1.12)
        output = ImageEnhance.Sharpness(output).enhance(1.32)
    elif unit_kind == "grass_detail_visual_unit":
        output = reinforce_flower_highlights(output)
        output = reinforce_object_detail_highlights(output, strength=0.58)
        output = ImageEnhance.Contrast(output).enhance(1.10)
        output = ImageEnhance.Sharpness(output).enhance(1.24)
    elif unit_kind in {"tree_visual_unit", "shrub_visual_unit"}:
        output = ensure_min_luma(output, target=0.225)
        output = reinforce_green_material_detail(output, strength=0.74)
        output = ImageEnhance.Contrast(output).enhance(1.14)
        output = ImageEnhance.Sharpness(output).enhance(1.40)
    elif category in {"tree", "rock"}:
        output = ImageEnhance.Contrast(output).enhance(1.22)
        output = ImageEnhance.Sharpness(output).enhance(1.55)
    elif category in {"water", "shoreline", "road"}:
        output = ImageEnhance.Contrast(output).enhance(1.26)
        output = ImageEnhance.Sharpness(output).enhance(1.38)
    if unit_kind == "grass_texture":
        if is_large_grass_base_slot(slot):
            output = output.filter(ImageFilter.UnsharpMask(radius=0.28, percent=245, threshold=1))
            output = rebalance_grass_for_world_composite(output, strength=0.18)
            output = soften_grid_artifacts(output, radius=0.30, blend=0.14)
            if reference_detail_image is not None:
                output = inherit_reference_surface_detail(output, reference_detail_image, strength=0.86)
                output = output.filter(ImageFilter.UnsharpMask(radius=0.18, percent=240, threshold=1))
                output = ImageEnhance.Contrast(output).enhance(1.26)
                output = soften_grid_artifacts(output, radius=0.22, blend=0.08)
            output = reinforce_green_material_detail(output, strength=0.04)
            output = suppress_pale_patch_artifacts(output, strength=0.82)
            output = suppress_washed_grass_haze(output, strength=0.84)
            output = stabilize_grass_surface_for_world_composite(output, strength=0.52)
            output = recover_grass_professional_readability(output, strength=0.34)
            output = settle_grass_runtime_surface_for_world_composite(output, strength=0.42)
            output = ImageEnhance.Contrast(output).enhance(1.47)
            output = soften_grid_artifacts(output, radius=0.20, blend=0.08)
            output = output.filter(ImageFilter.UnsharpMask(radius=0.16, percent=132, threshold=2))
        else:
            output = output.filter(ImageFilter.UnsharpMask(radius=0.45, percent=120, threshold=1))
    elif unit_kind == "water_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.24, percent=260, threshold=1))
    elif unit_kind == "shoreline_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.38, percent=185, threshold=1))
    elif unit_kind == "path_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.42, percent=145, threshold=1))
        output = ImageEnhance.Contrast(output).enhance(1.10)
        output = repair_path_black_craters_for_world_composite(output, strength=0.98)
        output = polish_path_runtime_surface_for_world_composite(output, strength=0.12)
        output = recover_path_luma_variance_for_world_composite(output, strength=0.84)
        output = ImageEnhance.Contrast(output).enhance(1.07)
        output = repair_path_black_craters_for_world_composite(output, strength=0.98)
    elif unit_kind == "boundary_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.78, percent=34, threshold=4))
    else:
        output = output.filter(ImageFilter.UnsharpMask(radius=0.55, percent=115, threshold=1))
    output = suppress_warm_neon_highlight_pixels(
        output,
        preserve_green_identity=unit_kind == "grass_detail_visual_unit",
    )
    final_alpha = resolve_output_alpha(
        unit_kind,
        source_alpha=source_alpha,
        condition_alpha=condition_alpha,
    )
    if final_alpha is not None:
        output = output.convert("RGBA")
        output.putalpha(final_alpha)
        return output
    return output


def is_object_unit(unit_kind: str) -> bool:
    return unit_kind in {
        "grass_detail_visual_unit",
        "flower_visual_unit",
        "shrub_visual_unit",
        "tree_visual_unit",
        "rock_visual_unit",
    }


def is_large_grass_base_slot(slot: dict[str, Any]) -> bool:
    if slot.get("unitKind") != "grass_texture":
        return False
    bounds = slot.get("bounds", {})
    width = float(bounds.get("width", 0) or 0)
    height = float(bounds.get("height", 0) or 0)
    return width * height >= 512 * 384


def resolve_output_alpha(
    unit_kind: str,
    *,
    source_alpha: Image.Image | None,
    condition_alpha: Image.Image | None,
) -> Image.Image | None:
    if not is_object_unit(unit_kind):
        return source_alpha
    if source_alpha is None:
        return condition_alpha
    if condition_alpha is None:
        return source_alpha

    source = np.asarray(source_alpha.convert("L"), dtype=np.float32) / 255.0
    condition = np.asarray(condition_alpha.convert("L"), dtype=np.float32) / 255.0
    if float((source > 0.08).mean()) < 0.02:
        return condition_alpha
    alpha = np.clip(source * condition, 0.0, 1.0)
    alpha = (alpha * 255.0).astype(np.uint8)
    return Image.fromarray(alpha, "L")


def read_condition_alpha(slot: dict[str, Any], *, size: tuple[int, int]) -> Image.Image | None:
    if not is_object_unit(str(slot.get("unitKind", ""))):
        return None
    path_value = slot.get("conditionMaskPath")
    if not isinstance(path_value, str):
        return None
    path = Path(path_value)
    if not path.exists():
        return None
    with Image.open(path) as image:
        alpha = image.convert("L")
        if alpha.size != size:
            alpha = alpha.resize(size, Image.Resampling.NEAREST)
        return alpha.point(lambda value: 255 if value > 0 else 0)


def reinforce_water_identity(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    pixels[:, :, 0] *= 0.82
    pixels[:, :, 1] = pixels[:, :, 1] * 0.88 + 10.0
    pixels[:, :, 2] = pixels[:, :, 2] * 1.05 + 8.0
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    glint_mask = (luma > 112.0) & (blue > green * 0.96) & (green > red * 1.12)
    height, width, _ = pixels.shape
    if height > 18 and width > 18:
        interior = np.zeros((height, width), dtype=bool)
        interior[9 : height - 9, 9 : width - 9] = True
        glint_mask = glint_mask & interior
    if np.any(glint_mask):
        glint_target = pixels.copy()
        glint_target[:, :, 0] = np.maximum(glint_target[:, :, 0], 142.0)
        glint_target[:, :, 1] = np.maximum(glint_target[:, :, 1], 176.0)
        glint_target[:, :, 2] = np.maximum(glint_target[:, :, 2], 194.0)
        pixels[glint_mask] = pixels[glint_mask] * 0.70 + glint_target[glint_mask] * 0.30
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_water_flow_detail(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    water = (blue > red * 1.55) & (green > red * 1.22)
    ripple = (
        ((xx * 7 + yy * 11) % 41 == 0)
        | ((xx * 5 - yy * 9) % 53 == 0)
        | ((xx + yy * 3) % 67 == 0)
    )
    dark_ripple = water & ripple
    if np.any(dark_ripple):
        darker = pixels.copy()
        darker[:, :, 0] *= 0.80
        darker[:, :, 1] *= 0.86
        darker[:, :, 2] *= 0.92
        pixels[dark_ripple] = pixels[dark_ripple] * 0.58 + darker[dark_ripple] * 0.42
    light_ripple = water & (((xx * 3 + yy * 5) % 71 == 0) | ((xx * 19 - yy * 2) % 89 == 0))
    if np.any(light_ripple):
        lighter = pixels.copy()
        lighter[:, :, 0] = np.maximum(lighter[:, :, 0], 86.0)
        lighter[:, :, 1] = np.maximum(lighter[:, :, 1], 150.0)
        lighter[:, :, 2] = np.maximum(lighter[:, :, 2], 176.0)
        pixels[light_ripple] = pixels[light_ripple] * 0.72 + lighter[light_ripple] * 0.28
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_water_world_glints(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    water = (blue > red * 1.18) & (green > red * 1.02)
    glint = water & (
        ((xx * 17 + yy * 5) % 97 == 0)
        | ((xx * 11 - yy * 13) % 131 == 0)
    )
    if not np.any(glint):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.maximum(target[:, :, 0], 168.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], 210.0)
    target[:, :, 2] = np.maximum(target[:, :, 2], 214.0)
    pixels[glint] = pixels[glint] * 0.28 + target[glint] * 0.72
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def rebalance_water_for_world_composite(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    water = (blue > red * 1.18) & (green > red * 1.02)
    if not np.any(water):
        return image.convert("RGB")
    teal = pixels.copy()
    teal[:, :, 0] = np.maximum(teal[:, :, 0] * 0.94 + 8.0, 42.0)
    teal[:, :, 1] = np.maximum(teal[:, :, 1] * 1.06 + 14.0, 92.0)
    teal[:, :, 2] = np.minimum(teal[:, :, 2] * 0.88 + 12.0, teal[:, :, 1] * 1.055 + 18.0)
    pixels[water] = pixels[water] * 0.30 + teal[water] * 0.70
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_shoreline_transition_detail(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    shoreline = (green > red * 1.12) & (blue > red * 0.88) & (luma > 58.0)
    grit = shoreline & (
        ((xx * 11 + yy * 5) % 37 == 0)
        | ((xx * 7 - yy * 13) % 47 == 0)
        | ((xx * 17 + yy * 3) % 61 == 0)
        | ((xx * 29 - yy * 7) % 73 == 0)
    )
    if np.any(grit):
        soil = pixels.copy()
        soil[:, :, 0] = soil[:, :, 0] * 1.08 + 18.0
        soil[:, :, 1] = soil[:, :, 1] * 0.92
        soil[:, :, 2] = soil[:, :, 2] * 0.82
        pixels[grit] = pixels[grit] * 0.48 + soil[grit] * 0.52
    reed = shoreline & (
        ((xx * 2 + yy * 17) % 83 == 0)
        | ((xx * 23 + yy) % 97 == 0)
        | ((xx * 13 + yy * 19) % 109 == 0)
    )
    if np.any(reed):
        reed_target = pixels.copy()
        reed_target[:, :, 0] *= 0.72
        reed_target[:, :, 1] = reed_target[:, :, 1] * 1.12 + 10.0
        reed_target[:, :, 2] *= 0.68
        pixels[reed] = pixels[reed] * 0.62 + reed_target[reed] * 0.38
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def compress_shoreline_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    shoreline = (
        (luma > 54.0)
        & (green > 76.0)
        & (red > 58.0)
        & (blue < green * 1.05)
        & (green > red * 0.74)
    )
    if not np.any(shoreline):
        return image.convert("RGB")

    normalized_x = xx / max(1, width - 1)
    core = np.abs(normalized_x - 0.50) < 0.22
    outer = shoreline & ~core
    inner = shoreline & core

    target = pixels.copy()
    bank_wave = (((xx * 7 + yy * 3) % 41) / 40.0 - 0.5) * 8.0
    target[:, :, 0] = np.minimum(target[:, :, 0] * 0.74 + 18.0 + bank_wave, 122.0)
    target[:, :, 1] = np.minimum(target[:, :, 1] * 0.82 + 18.0, 138.0)
    target[:, :, 2] = np.maximum(target[:, :, 2] * 0.94 + 18.0, 82.0)
    pixels[outer] = pixels[outer] * (1.0 - strength) + target[outer] * strength

    core_target = pixels.copy()
    core_target[:, :, 0] = np.minimum(core_target[:, :, 0] * 0.82 + 16.0, 132.0)
    core_target[:, :, 1] = np.minimum(core_target[:, :, 1] * 0.90 + 14.0, 148.0)
    core_target[:, :, 2] = np.maximum(core_target[:, :, 2] * 0.90 + 12.0, 72.0)
    pixels[inner] = pixels[inner] * 0.58 + core_target[inner] * 0.42
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_rock_identity(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    gray = pixels[:, :, 0] * 0.26 + pixels[:, :, 1] * 0.52 + pixels[:, :, 2] * 0.22
    neutral = np.stack([gray * 1.03, gray * 1.02, gray * 0.96], axis=2)
    pixels = pixels * 0.48 + neutral * 0.52
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def suppress_neon_highlights(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    mask = (red > 150.0) & (green > 160.0) & (blue < 130.0) & (green >= red * 0.84)
    if not np.any(mask):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] * 0.92
    target[:, :, 1] = target[:, :, 1] * 0.82
    target[:, :, 2] = target[:, :, 2] * 1.45 + 32.0
    pixels[mask] = pixels[mask] * (1.0 - strength) + target[mask] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def rebalance_grass_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.96) & (luma > 52.0) & (luma < 188.0)
    if not np.any(grass):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.minimum(target[:, :, 0] * 1.10 + 8.0, 168.0)
    target[:, :, 1] = target[:, :, 1] * 0.92
    target[:, :, 2] = np.minimum(target[:, :, 2] * 0.94 + 6.0, 136.0)
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def suppress_pale_patch_artifacts(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    mask = (luma > 168.0) & (red > 160.0) & (green > 132.0) & (blue > 102.0)
    if not np.any(mask):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.minimum(target[:, :, 0] * 0.78, 154.0)
    target[:, :, 1] = np.minimum(target[:, :, 1] * 0.78, 124.0)
    target[:, :, 2] = np.minimum(target[:, :, 2] * 0.72, 92.0)
    pixels[mask] = pixels[mask] * (1.0 - strength) + target[mask] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def suppress_washed_grass_haze(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
    haze = (
        (luma > 100.0)
        & (luma < 188.0)
        & (saturation < 78.0)
        & (green > red * 1.06)
        & (green > blue * 0.96)
    )
    if not np.any(haze):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.minimum(target[:, :, 0] * 0.72, 110.0)
    target[:, :, 1] = np.minimum(target[:, :, 1] * 0.82 + 4.0, 136.0)
    target[:, :, 2] = np.minimum(target[:, :, 2] * 0.70, 98.0)
    pixels[haze] = pixels[haze] * (1.0 - strength) + target[haze] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def stabilize_grass_surface_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
    grass = (
        (green > red * 1.02)
        & (green > blue * 0.94)
        & (luma > 58.0)
        & (luma < 176.0)
    )
    haze = grass & (luma > 92.0) & (saturation < 76.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    detail = (
        (((xx * 11 + yy * 7) % 47) / 46.0 - 0.5) * 18.0
        + (((xx * 5 - yy * 13) % 61) / 60.0 - 0.5) * 12.0
    )
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] * 0.78 + 18.0 + detail * 0.35, 36.0, 128.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * 0.84 + 6.0 + detail * 0.62, 74.0, 148.0)
    target[:, :, 2] = np.clip(target[:, :, 2] * 0.72 + 8.0 + detail * 0.22, 34.0, 104.0)
    pixels[haze] = pixels[haze] * (1.0 - strength) + target[haze] * strength

    micro = grass & (luma > 62.0) & (luma < 160.0)
    if np.any(micro):
        pixels[:, :, 0][micro] = np.clip(pixels[:, :, 0][micro] + detail[micro] * 0.26, 0, 255)
        pixels[:, :, 1][micro] = np.clip(pixels[:, :, 1][micro] + detail[micro] * 0.44, 0, 255)
        pixels[:, :, 2][micro] = np.clip(pixels[:, :, 2][micro] + detail[micro] * 0.18, 0, 255)

    dapple = grass & (
        ((xx * 19 + yy * 3) % 89 < 3)
        | ((xx * 7 - yy * 17) % 107 < 3)
    )
    if np.any(dapple):
        darker = pixels.copy()
        darker[:, :, 0] *= 0.82
        darker[:, :, 1] *= 0.88
        darker[:, :, 2] *= 0.78
        pixels[dapple] = pixels[dapple] * 0.60 + darker[dapple] * 0.40
    light_dapple = grass & (
        ((xx * 23 + yy * 11) % 131 < 2)
        | ((xx * 5 + yy * 29) % 149 < 2)
    )
    if np.any(light_dapple):
        lighter = pixels.copy()
        lighter[:, :, 0] = np.minimum(lighter[:, :, 0] * 1.12 + 8.0, 138.0)
        lighter[:, :, 1] = np.minimum(lighter[:, :, 1] * 1.08 + 10.0, 160.0)
        lighter[:, :, 2] = np.minimum(lighter[:, :, 2] * 1.04 + 4.0, 112.0)
        pixels[light_dapple] = pixels[light_dapple] * 0.64 + lighter[light_dapple] * 0.36
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def recover_grass_professional_readability(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
    grass = (
        (green > red * 1.02)
        & (green > blue * 0.94)
        & (luma > 58.0)
        & (luma < 176.0)
    )
    haze = grass & (luma > 88.0) & (saturation < 82.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    variation = (
        (((xx * 5 + yy * 17) % 113) / 112.0 - 0.5) * 18.0
        + (((xx * 23 - yy * 3) % 157) / 156.0 - 0.5) * 14.0
    )
    target = pixels.copy()
    target[:, :, 0] = np.clip(48.0 + variation * 0.22 + red * 0.22, 34.0, 118.0)
    target[:, :, 1] = np.clip(104.0 + variation * 0.56 + green * 0.18, 76.0, 152.0)
    target[:, :, 2] = np.clip(44.0 + variation * 0.18 + blue * 0.16, 30.0, 92.0)
    pixels[haze] = pixels[haze] * (1.0 - strength) + target[haze] * strength

    pale_grid = grass & (luma > 104.0) & (saturation < 94.0) & (
        ((xx + yy) % 8 < 2) | ((xx * 3 - yy) % 11 < 2)
    )
    if np.any(pale_grid):
        pixels[pale_grid] = pixels[pale_grid] * 0.22 + target[pale_grid] * 0.78

    shadow = grass & (
        ((xx * 17 + yy * 7) % 139 < 4)
        | ((xx * 11 - yy * 19) % 151 < 4)
    )
    if np.any(shadow):
        shaded = pixels.copy()
        shaded[:, :, 0] = np.clip(shaded[:, :, 0] * 0.84, 28.0, 122.0)
        shaded[:, :, 1] = np.clip(shaded[:, :, 1] * 0.92, 62.0, 148.0)
        shaded[:, :, 2] = np.clip(shaded[:, :, 2] * 0.82, 24.0, 92.0)
        pixels[shadow] = pixels[shadow] * 0.60 + shaded[shadow] * 0.40
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def settle_grass_runtime_surface_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    source = image.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    height, width, _ = pixels.shape
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (
        (green > red * 1.01)
        & (green > blue * 0.92)
        & (luma > 52.0)
        & (luma < 178.0)
    )
    if not np.any(grass):
        return source

    seed = np.random.default_rng(71029)
    broad_noise = seed.random((max(10, height // 42), max(10, width // 42)), dtype=np.float32)
    broad = Image.fromarray(np.asarray(broad_noise * 255.0, dtype=np.uint8), "L").resize(
        (width, height),
        Image.Resampling.BICUBIC,
    )
    broad_values = np.asarray(broad.filter(ImageFilter.GaussianBlur(radius=5.4)), dtype=np.float32)
    broad_values = broad_values - float(broad_values.mean())
    broad_values = np.clip(broad_values, -52.0, 52.0)

    smoothed = np.asarray(source.filter(ImageFilter.GaussianBlur(radius=1.15)), dtype=np.float32)
    target = pixels.copy()
    target[:, :, 0] = np.clip(smoothed[:, :, 0] * 0.62 + 42.0 + broad_values * 0.16, 48.0, 122.0)
    target[:, :, 1] = np.clip(smoothed[:, :, 1] * 0.62 + 62.0 + broad_values * 0.36, 88.0, 156.0)
    target[:, :, 2] = np.clip(smoothed[:, :, 2] * 0.56 + 35.0 + broad_values * 0.18, 44.0, 104.0)
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength

    yy, xx = np.indices((height, width))
    soil_fleck = grass & (
        ((xx * 3 + yy * 5) % 211 < 2)
        | ((xx * 17 - yy * 7) % 263 < 2)
    )
    if np.any(soil_fleck):
        soil = pixels.copy()
        soil[:, :, 0] = np.clip(soil[:, :, 0] * 0.86 + 22.0, 48.0, 126.0)
        soil[:, :, 1] = np.clip(soil[:, :, 1] * 0.84 + 8.0, 74.0, 136.0)
        soil[:, :, 2] = np.clip(soil[:, :, 2] * 0.78 + 4.0, 38.0, 88.0)
        pixels[soil_fleck] = pixels[soil_fleck] * 0.58 + soil[soil_fleck] * 0.42

    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def suppress_warm_neon_highlight_pixels(
    image: Image.Image,
    *,
    preserve_green_identity: bool,
) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    mask = (red > 160.0) & (green > 172.0) & (blue < 120.0) & (green >= red * 0.9)
    if not np.any(mask):
        return image.convert("RGB")
    target = pixels.copy()
    if preserve_green_identity:
        target[:, :, 0] = np.maximum(target[:, :, 0], 218.0)
        target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 0.94)
        target[:, :, 2] = 122.0
        pixels[mask] = target[mask]
        return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")
    target[:, :, 0] = np.maximum(target[:, :, 0], 236.0)
    target[:, :, 1] = np.minimum(np.maximum(target[:, :, 1] * 0.82, 184.0), target[:, :, 0] * 0.84)
    target[:, :, 2] = np.minimum(np.maximum(target[:, :, 2], 100.0), 116.0)
    pixels[mask] = pixels[mask] * 0.18 + target[mask] * 0.82
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def restore_path_dust_highlights(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    mask = (luma > 142.0) & (red > blue * 1.45) & (green > blue * 1.35)
    if not np.any(mask):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.minimum(np.maximum(target[:, :, 0], 148.0), 164.0)
    target[:, :, 1] = np.minimum(np.maximum(target[:, :, 1], 110.0), 128.0)
    target[:, :, 2] = np.minimum(np.maximum(target[:, :, 2], 62.0), 78.0)
    pixels[mask] = pixels[mask] * 0.22 + target[mask] * 0.78
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def rebalance_path_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path_surface = (luma > 46.0) & (red > 48.0) & (green > 44.0)
    if not np.any(path_surface):
        return image.convert("RGB")

    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] * 0.76 + 74.0, 104.0, 174.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * 0.64 + 58.0, 82.0, 138.0)
    target[:, :, 2] = np.clip(target[:, :, 2] * 0.46 + 40.0, 48.0, 88.0)
    pixels[path_surface] = pixels[path_surface] * (1.0 - strength) + target[path_surface] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def stabilize_path_surface_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    surface = luma > 18.0
    if not np.any(surface):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    normalized_luma = np.clip((luma - 54.0) / 118.0, 0.0, 1.0)
    grain = (
        (((xx * 13 + yy * 5) % 37) / 36.0 - 0.5) * 26.0
        + (((xx * 3 - yy * 17) % 53) / 52.0 - 0.5) * 16.0
    )
    target = pixels.copy()
    target[:, :, 0] = np.clip(108.0 + normalized_luma * 56.0 + grain * 0.70, 92.0, 174.0)
    target[:, :, 1] = np.clip(80.0 + normalized_luma * 42.0 + grain * 0.42, 68.0, 136.0)
    target[:, :, 2] = np.clip(44.0 + normalized_luma * 24.0 + grain * 0.18, 40.0, 84.0)
    pixels[surface] = pixels[surface] * (1.0 - strength) + target[surface] * strength

    dark_pollution = surface & (luma < 92.0) & (blue < 126.0)
    green_pollution = surface & (green > red * 0.96) & (green > blue * 0.96)
    pollution = dark_pollution | green_pollution
    if np.any(pollution):
        pixels[pollution] = target[pollution]
    pebble = surface & (
        ((xx * 17 + yy * 7) % 67 < 1)
        | ((xx * 5 - yy * 19) % 83 < 1)
    )
    if np.any(pebble):
        darker = pixels.copy()
        darker[:, :, 0] *= 0.78
        darker[:, :, 1] *= 0.74
        darker[:, :, 2] *= 0.68
        pixels[pebble] = pixels[pebble] * 0.46 + darker[pebble] * 0.54
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def recover_path_luma_variance_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    surface = (
        (red > 92.0)
        & (green > 68.0)
        & (blue < 92.0)
        & (red > blue * 1.28)
        & (green > blue * 1.08)
        & (luma > 72.0)
        & (luma < 174.0)
    )
    if not np.any(surface):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad = (
        (((xx * 7 + yy * 11) % 97) / 96.0 - 0.5) * 36.0
        + (((xx * 5 - yy * 13) % 131) / 130.0 - 0.5) * 22.0
    )
    highlight = surface & (((xx * 19 + yy * 5) % 149) < 5)
    wear = surface & (((xx * 3 - yy * 23) % 173) < 6)
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + broad * 0.66, 104.0, 184.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + broad * 0.48, 78.0, 142.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + broad * 0.20, 38.0, 84.0)
    if np.any(highlight):
        target[highlight, 0] = np.clip(target[highlight, 0] + 18.0, 118.0, 188.0)
        target[highlight, 1] = np.clip(target[highlight, 1] + 13.0, 88.0, 148.0)
        target[highlight, 2] = np.clip(target[highlight, 2] + 4.0, 42.0, 86.0)
    if np.any(wear):
        target[wear, 0] = np.clip(target[wear, 0] - 14.0, 98.0, 168.0)
        target[wear, 1] = np.clip(target[wear, 1] - 10.0, 74.0, 132.0)
        target[wear, 2] = np.clip(target[wear, 2] - 5.0, 36.0, 76.0)
    pixels[surface] = pixels[surface] * (1.0 - strength) + target[surface] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def repair_path_black_craters_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    crater = (luma < 78.0) & (red < 106.0) & (green < 96.0) & (blue < 76.0)
    if not np.any(crater):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    variation = (
        (((xx * 7 + yy * 5) % 73) / 72.0 - 0.5) * 18.0
        + (((xx * 13 - yy * 11) % 97) / 96.0 - 0.5) * 12.0
    )
    target = pixels.copy()
    target[:, :, 0] = np.clip(114.0 + variation * 0.42, 96.0, 146.0)
    target[:, :, 1] = np.clip(82.0 + variation * 0.32, 70.0, 112.0)
    target[:, :, 2] = np.clip(42.0 + variation * 0.16, 34.0, 66.0)
    pixels[crater] = pixels[crater] * (1.0 - strength) + target[crater] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def polish_path_runtime_surface_for_world_composite(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 88.0)
        & (green > 62.0)
        & (blue < 92.0)
        & (red > blue * 1.22)
        & (green > blue * 1.02)
        & (luma > 62.0)
        & (luma < 176.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad = (
        (((xx * 5 + yy * 7) % 127) / 126.0 - 0.5) * 22.0
        + (((xx * 11 - yy * 3) % 181) / 180.0 - 0.5) * 16.0
    )
    target = pixels.copy()
    target[:, :, 0] = np.clip(126.0 + broad * 0.46, 108.0, 166.0)
    target[:, :, 1] = np.clip(92.0 + broad * 0.34, 76.0, 128.0)
    target[:, :, 2] = np.clip(50.0 + broad * 0.16, 38.0, 76.0)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength

    dark_hole = path & (luma < 84.0)
    if np.any(dark_hole):
        pixels[dark_hole] = pixels[dark_hole] * 0.14 + target[dark_hole] * 0.86

    tread = path & (
        ((xx * 19 + yy * 5) % 173 < 3)
        | ((xx * 7 - yy * 23) % 197 < 3)
    )
    if np.any(tread):
        worn = pixels.copy()
        worn[:, :, 0] = np.clip(worn[:, :, 0] * 0.92, 96.0, 168.0)
        worn[:, :, 1] = np.clip(worn[:, :, 1] * 0.90, 70.0, 132.0)
        worn[:, :, 2] = np.clip(worn[:, :, 2] * 0.86, 36.0, 78.0)
        pixels[tread] = pixels[tread] * 0.70 + worn[tread] * 0.30

    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_path_grain_edges(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    height, width = luma.shape
    yy, xx = np.indices((height, width))
    grain = (
        ((xx * 13 + yy * 7) % 29 == 0)
        | ((xx * 5 - yy * 11) % 37 == 0)
        | ((xx * 17 + yy * 3) % 43 == 0)
    )
    path_color = (red > blue * 1.18) & (green > blue * 1.04) & (red > 105.0) & (green > 82.0)
    mid_luma = (luma > 82.0) & (luma < 190.0)
    mask = grain & path_color & mid_luma
    if not np.any(mask):
        return image.convert("RGB")
    darker = pixels.copy()
    darker[:, :, 0] *= 0.82
    darker[:, :, 1] *= 0.78
    darker[:, :, 2] *= 0.72
    pixels[mask] = pixels[mask] * 0.54 + darker[mask] * 0.46
    pale_mask = (luma > 136.0) & (red > 142.0) & (green > 112.0) & (blue > 76.0)
    if np.any(pale_mask):
        soil = pixels.copy()
        soil[:, :, 0] = np.minimum(soil[:, :, 0], 154.0)
        soil[:, :, 1] = np.minimum(soil[:, :, 1], 116.0)
        soil[:, :, 2] = np.minimum(soil[:, :, 2], 70.0)
        pixels[pale_mask] = pixels[pale_mask] * 0.16 + soil[pale_mask] * 0.84
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_flower_highlights(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    mask = luma > 92.0
    if not np.any(mask):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.maximum(target[:, :, 0], 238.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], 206.0)
    target[:, :, 2] = np.minimum(np.maximum(target[:, :, 2], 96.0), 106.0)
    pixels[mask] = pixels[mask] * 0.24 + target[mask] * 0.76
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_object_detail_highlights(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    natural_detail = (luma > 62.0) & (green >= blue * 0.72) & (red >= blue * 0.68)
    sparkle = natural_detail & (
        ((xx * 11 + yy * 7) % 31 == 0)
        | ((xx * 5 - yy * 13) % 43 == 0)
        | ((xx * 17 + yy * 3) % 59 == 0)
    )
    if not np.any(sparkle):
        return image.convert("RGB")
    target = pixels.copy()
    target[:, :, 0] = np.maximum(target[:, :, 0], 238.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], 206.0)
    target[:, :, 2] = np.minimum(np.maximum(target[:, :, 2], 96.0), 106.0)
    pixels[sparkle] = pixels[sparkle] * (1.0 - strength) + target[sparkle] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reinforce_green_material_detail(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width))
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    natural_green = (green >= red * 1.08) & (green >= blue * 0.86)
    vein = natural_green & (
        ((xx * 7 + yy * 11) % 37 == 0)
        | ((xx * 13 - yy * 5) % 53 == 0)
        | ((xx + yy * 17) % 71 == 0)
    )
    shade = natural_green & (
        ((xx * 5 + yy * 3) % 41 == 0)
        | ((xx * 19 - yy * 7) % 67 == 0)
    )
    if np.any(vein):
        target = pixels.copy()
        target[:, :, 0] = np.maximum(target[:, :, 0], 54.0)
        target[:, :, 1] = np.maximum(target[:, :, 1], 116.0)
        target[:, :, 2] = np.maximum(target[:, :, 2], 58.0)
        pixels[vein] = pixels[vein] * (1.0 - strength) + target[vein] * strength
    if np.any(shade):
        target = pixels.copy()
        target[:, :, 0] *= 0.64
        target[:, :, 1] *= 0.70
        target[:, :, 2] *= 0.68
        pixels[shade] = pixels[shade] * (1.0 - strength * 0.72) + target[shade] * (strength * 0.72)
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def inherit_reference_surface_detail(
    image: Image.Image,
    reference: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    output = image.convert("RGB")
    reference = reference.convert("RGB").resize(output.size, Image.Resampling.BICUBIC)
    pixels = np.asarray(output, dtype=np.float32)
    reference_pixels = np.asarray(reference, dtype=np.float32)
    reference_luma = (
        reference_pixels[:, :, 0] * 0.2126
        + reference_pixels[:, :, 1] * 0.7152
        + reference_pixels[:, :, 2] * 0.0722
    )
    reference_blur = np.asarray(
        Image.fromarray(np.asarray(np.clip(reference_luma, 0, 255), dtype=np.uint8), "L")
        .filter(ImageFilter.GaussianBlur(radius=2.4)),
        dtype=np.float32,
    )
    detail = np.clip(reference_luma - reference_blur, -34.0, 34.0)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.04) & (green > blue * 0.88) & (luma > 48.0) & (luma < 190.0)
    if not np.any(grass):
        return output
    pixels[grass] += detail[grass, None] * strength
    pixels[:, :, 0] = np.minimum(pixels[:, :, 0], 176.0)
    pixels[:, :, 1] = np.minimum(pixels[:, :, 1], 184.0)
    pixels[:, :, 2] = np.minimum(pixels[:, :, 2], 144.0)
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def soften_grid_artifacts(image: Image.Image, *, radius: float, blend: float) -> Image.Image:
    softened = image.filter(ImageFilter.GaussianBlur(radius=radius))
    return Image.blend(image.convert("RGB"), softened.convert("RGB"), blend)


def soften_grid_seams(image: Image.Image, *, grid_size: int, radius: int) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    for x in range(grid_size, width, grid_size):
        left = max(0, x - radius * 3)
        right = min(width - 1, x + radius * 3)
        if left >= x or right <= x:
            continue
        left_band = pixels[:, max(0, x - radius * 4) : max(0, x - radius * 2), :]
        right_band = pixels[:, min(width, x + radius * 2) : min(width, x + radius * 4), :]
        if left_band.size == 0 or right_band.size == 0:
            continue
        target = (left_band.mean(axis=1) + right_band.mean(axis=1)) / 2.0
        for column in range(left, right + 1):
            distance = abs(column - x) / max(1, radius * 3)
            strength = max(0.0, 0.62 * (1.0 - distance))
            pixels[:, column, :] = pixels[:, column, :] * (1.0 - strength) + target * strength
    for y in range(grid_size, height, grid_size):
        top = max(0, y - radius * 3)
        bottom = min(height - 1, y + radius * 3)
        if top >= y or bottom <= y:
            continue
        top_band = pixels[max(0, y - radius * 4) : max(0, y - radius * 2), :, :]
        bottom_band = pixels[min(height, y + radius * 2) : min(height, y + radius * 4), :, :]
        if top_band.size == 0 or bottom_band.size == 0:
            continue
        target = (top_band.mean(axis=0) + bottom_band.mean(axis=0)) / 2.0
        for row in range(top, bottom + 1):
            distance = abs(row - y) / max(1, radius * 3)
            strength = max(0.0, 0.62 * (1.0 - distance))
            pixels[row, :, :] = pixels[row, :, :] * (1.0 - strength) + target * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def ensure_min_luma(image: Image.Image, *, target: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    current = float((pixels[:, :, 0] * 0.2126 + pixels[:, :, 1] * 0.7152 + pixels[:, :, 2] * 0.0722).mean())
    if current >= target:
        return image.convert("RGB")
    factor = min(1.55, target / max(0.001, current))
    return ImageEnhance.Brightness(image.convert("RGB")).enhance(factor)


def reduce_bright_border(image: Image.Image, *, factor: float = 0.82, border: int | None = None) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    border = border or max(4, min(width, height) // 28)
    if border <= 0:
        return image
    inner = pixels[border : height - border, border : width - border]
    if inner.size == 0:
        return image
    border_mask = np.zeros((height, width), dtype=bool)
    border_mask[:border, :] = True
    border_mask[-border:, :] = True
    border_mask[:, :border] = True
    border_mask[:, -border:] = True
    border_luma = luma(pixels[border_mask])
    inner_luma = luma(inner.reshape(-1, 3))
    delta = float(border_luma.mean() - inner_luma.mean())
    if delta > 0.055:
        pixels[border_mask] = np.clip(pixels[border_mask] * factor, 0, 255)
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def luma(values: np.ndarray) -> np.ndarray:
    return values[:, 0] * 0.2126 + values[:, 1] * 0.7152 + values[:, 2] * 0.0722


def build_condition(
    slot: dict[str, Any],
    *,
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
    torch,
    config: dict[str, object],
    canvas_bounds: dict[str, int],
):
    mask = read_mask(Path(slot["conditionMaskPath"]), torch)
    mask = apply_slot_condition_variation(mask, slot, torch)
    channels = []
    active = set(UNIT_TO_ACTIVE_CHANNELS[slot["unitKind"]])
    for name in V1_CONDITION_CHANNELS:
        channels.append(mask.clone() if name in active else torch.zeros_like(mask))
    condition = torch.cat(channels, dim=0)
    extra_channels = build_extra_channels(
        slot,
        category=category,
        model_root=model_root,
        style_profile=style_profile,
        reference_dataset_root=reference_dataset_root,
        height=int(condition.shape[1]),
        width=int(condition.shape[2]),
        torch=torch,
        config=config,
        canvas_bounds=canvas_bounds,
    )
    if extra_channels:
        condition = torch.cat([condition, *extra_channels], dim=0)
    expected_channels = int(config.get("inputChannels", condition.shape[0]))
    if int(condition.shape[0]) != expected_channels:
        raise ValueError(
            f"material slot condition channel mismatch: built={int(condition.shape[0])}, "
            f"expected={expected_channels}, unitKind={slot['unitKind']}, category={category}"
        )
    return condition


def apply_slot_condition_variation(mask, slot: dict[str, Any], torch):
    if slot.get("unitKind") != "grass_texture":
        return mask

    height = int(mask.shape[1])
    width = int(mask.shape[2])
    if height * width < 256 * 192:
        return mask

    seed_key = f"{slot.get('slotId', 'grass')}:{slot.get('sourceId', '')}:condition-variation-v1"
    digest = hashlib.sha256(seed_key.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "little", signed=False)
    rng = np.random.default_rng(seed)
    coarse_height = max(18, min(48, height // 22))
    coarse_width = max(24, min(64, width // 22))
    coarse = rng.random((coarse_height, coarse_width), dtype=np.float32)
    coarse_image = Image.fromarray(np.uint8(coarse * 255)).resize(
        (width, height),
        Image.Resampling.BICUBIC,
    )
    variation = np.asarray(coarse_image, dtype=np.float32) / 255.0
    variation = 0.985 + variation * 0.015

    y = np.linspace(0.0, 1.0, height, dtype=np.float32).reshape(height, 1)
    x = np.linspace(0.0, 1.0, width, dtype=np.float32).reshape(1, width)
    diagonal = 0.995 + 0.005 * np.sin((x * 2.7 + y * 1.9 + (seed % 997) / 997.0) * np.pi)
    field = np.clip(variation * diagonal, 0.975, 1.0)
    return mask * torch.from_numpy(field).unsqueeze(0).float()


def build_extra_channels(
    slot: dict[str, Any],
    *,
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
    height: int,
    width: int,
    torch,
    config: dict[str, object],
    canvas_bounds: dict[str, int],
):
    extras = config.get("inputExtras", [])
    if not isinstance(extras, list):
        extras = []
    channels = []
    if "coord" in extras:
        channels.extend(coordinate_channels(slot, height, width, torch, canvas_bounds))
    if "noise" in extras:
        channels.append(noise_channel(str(slot["slotId"]), height, width, torch))
    if "category" in extras:
        channels.extend(category_channels(category, height, width, torch))
    if "source" in extras:
        channels.extend(source_channels(str(slot.get("taskId", slot["slotId"])), height, width, torch))
    if "reference" in extras:
        channels.extend(reference_channels(slot, category, model_root, style_profile, reference_dataset_root, height, width, torch, config))
    if "style" in extras:
        channels.extend(style_channels(category, model_root, style_profile, height, width, torch))
    return channels


def coordinate_channels(slot: dict[str, Any], height: int, width: int, torch, canvas_bounds: dict[str, int]):
    bounds = slot.get("bounds", {})
    left = float(bounds.get("x", 0))
    top = float(bounds.get("y", 0))
    slot_width = max(1.0, float(bounds.get("width", width)))
    slot_height = max(1.0, float(bounds.get("height", height)))
    canvas_width = max(1.0, float(canvas_bounds["width"]))
    canvas_height = max(1.0, float(canvas_bounds["height"]))
    x_start = (left / canvas_width) * 2.0 - 1.0
    x_end = ((left + slot_width) / canvas_width) * 2.0 - 1.0
    y_start = (top / canvas_height) * 2.0 - 1.0
    y_end = ((top + slot_height) / canvas_height) * 2.0 - 1.0
    y = torch.linspace(y_start, y_end, height).view(1, height, 1).expand(1, height, width)
    x = torch.linspace(x_start, x_end, width).view(1, 1, width).expand(1, height, width)
    return [x.float(), y.float()]


def infer_canvas_bounds(slots: list[dict[str, Any]]) -> dict[str, int]:
    max_x = 1.0
    max_y = 1.0
    for slot in slots:
        bounds = slot.get("bounds", {})
        max_x = max(max_x, float(bounds.get("x", 0)) + float(bounds.get("width", 1)))
        max_y = max(max_y, float(bounds.get("y", 0)) + float(bounds.get("height", 1)))
    return {"width": int(np.ceil(max_x)), "height": int(np.ceil(max_y))}


def noise_channel(seed_key: str, height: int, width: int, torch):
    digest = hashlib.sha256(seed_key.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "little", signed=False)
    rng = np.random.default_rng(seed)
    pixels = rng.random((1, height, width), dtype=np.float32)
    return torch.from_numpy(pixels)


def category_channels(category: str, height: int, width: int, torch):
    categories = ("grass", "water", "shoreline", "road", "tree", "rock")
    return [
        torch.full((1, height, width), 1.0 if name == category else 0.0, dtype=torch.float32)
        for name in categories
    ]


def source_channels(source_key: str, height: int, width: int, torch):
    digest = hashlib.sha256(source_key.encode("utf-8")).digest()
    values = [byte / 255.0 for byte in digest[:4]]
    return [torch.full((1, height, width), value, dtype=torch.float32) for value in values]


def reference_channels(
    slot: dict[str, Any],
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
    height: int,
    width: int,
    torch,
    config: dict[str, object],
):
    if is_large_grass_base_slot(slot) and category == "grass":
        reference_image = build_large_grass_reference_image(
            slot,
            category,
            model_root,
            style_profile,
            reference_dataset_root,
            width=width,
            height=height,
        )
        if reference_image is not None:
            pixels = np.asarray(reference_image.convert("RGB"), dtype=np.uint8, copy=True)
            tensor = torch.from_numpy(pixels).permute(2, 0, 1).float().div(255.0)
            return list(tensor.split(1, dim=0))

    reference_path = resolve_reference_image_path(slot, category, model_root, style_profile, reference_dataset_root)
    if reference_path is None:
        return [torch.zeros((1, height, width), dtype=torch.float32) for _ in range(3)]
    with Image.open(reference_path) as image:
        if image.size != (width, height):
            image = image.resize((width, height), Image.Resampling.BICUBIC)
        if str(config.get("referenceDetailMode", "full")) == "low_frequency":
            image = low_frequency_reference(image)
        pixels = np.asarray(image.convert("RGB"), dtype=np.uint8, copy=True)
    tensor = torch.from_numpy(pixels).permute(2, 0, 1).float().div(255.0)
    return list(tensor.split(1, dim=0))


def low_frequency_reference(image: Image.Image) -> Image.Image:
    width, height = image.size
    reduced_size = (max(8, width // 16), max(8, height // 16))
    return image.resize(reduced_size, Image.Resampling.BICUBIC).resize(
        (width, height),
        Image.Resampling.BICUBIC,
    ).filter(ImageFilter.GaussianBlur(radius=1.2))


def build_large_grass_reference_image(
    slot: dict[str, Any],
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
    *,
    width: int,
    height: int,
) -> Image.Image | None:
    paths = resolve_reference_image_paths(slot, category, model_root, style_profile, reference_dataset_root)
    if not paths:
        return None
    reference = build_continuous_grass_reference_from_palette(slot, paths, width=width, height=height)
    if reference is not None:
        return reference

    real_references: list[Image.Image] = []
    for path in paths[:3]:
        if not path.exists():
            continue
        with Image.open(path) as image:
            real_references.append(
                image.convert("RGB").resize((width, height), Image.Resampling.BICUBIC)
            )
    if not real_references:
        return None

    reference = real_references[0]
    for image in real_references[1:]:
        reference = Image.blend(reference, image, 0.18)
    reference = low_frequency_reference(reference).filter(ImageFilter.GaussianBlur(radius=0.45))
    return ImageEnhance.Contrast(reference).enhance(1.04)


def build_continuous_grass_reference_from_palette(
    slot: dict[str, Any],
    paths: list[Path],
    *,
    width: int,
    height: int,
) -> Image.Image | None:
    palette = collect_grass_palette(paths)
    if len(palette) < 32:
        return None

    seed_bytes = hashlib.sha256(
        f"{slot.get('slotId', 'large-grass')}|continuous-grass-reference".encode("utf8")
    ).digest()[:8]
    rng = np.random.default_rng(int.from_bytes(seed_bytes, "big"))
    palette_values = palette.astype(np.float32)
    base = np.percentile(palette_values, 52, axis=0)
    spread = np.maximum(np.std(palette_values, axis=0), np.array([10.0, 12.0, 9.0], dtype=np.float32))

    broad = smooth_reference_noise(width, height, rng, cells_x=21, cells_y=16, blur=28.0) - 0.5
    medium = smooth_reference_noise(width, height, rng, cells_x=59, cells_y=43, blur=6.0) - 0.5
    fine = smooth_reference_noise(width, height, rng, cells_x=127, cells_y=95, blur=1.2) - 0.5
    field = broad * 0.24 + medium * 0.46 + fine * 0.30
    field = field - float(field.mean())
    field_std = float(field.std())
    if field_std > 0.0001:
        field = field / field_std
    pixels = base[None, None, :] + field[:, :, None] * spread[None, None, :] * 0.46
    pixels[:, :, 1] = np.maximum(pixels[:, :, 1], pixels[:, :, 0] * 1.12)
    pixels[:, :, 1] = np.maximum(pixels[:, :, 1], pixels[:, :, 2] * 1.10)
    pixels[:, :, 0] = np.minimum(pixels[:, :, 0], 135.0)
    pixels[:, :, 1] = np.clip(pixels[:, :, 1], 92.0, 170.0)
    pixels[:, :, 2] = np.clip(pixels[:, :, 2], 52.0, 130.0)
    reference = Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")
    reference = reference.filter(ImageFilter.GaussianBlur(radius=0.34))
    return ImageEnhance.Contrast(reference).enhance(1.04)


def smooth_reference_noise(
    width: int,
    height: int,
    rng: np.random.Generator,
    *,
    cells_x: int,
    cells_y: int,
    blur: float,
) -> np.ndarray:
    coarse = rng.random((cells_y, cells_x), dtype=np.float32)
    image = Image.fromarray(np.asarray(np.clip(coarse * 255.0, 0, 255), dtype=np.uint8), "L")
    image = image.resize((width, height), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(radius=blur))
    values = np.asarray(image, dtype=np.float32) / 255.0
    minimum = float(values.min())
    maximum = float(values.max())
    if maximum - minimum > 0.0001:
        values = (values - minimum) / (maximum - minimum)
    return values


def build_large_grass_detail_reference_image(
    slot: dict[str, Any],
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
    *,
    width: int,
    height: int,
) -> Image.Image | None:
    paths = resolve_reference_image_paths(slot, category, model_root, style_profile, reference_dataset_root)
    if not paths:
        return None
    real_references: list[Image.Image] = []
    for path in paths[:16]:
        if not path.exists():
            continue
        with Image.open(path) as image:
            real_references.append(image.convert("RGB"))
    if not real_references:
        return None
    return build_non_tiled_grass_detail_reference(
        slot,
        real_references,
        width=width,
        height=height,
    )


def build_non_tiled_grass_detail_reference(
    slot: dict[str, Any],
    references: list[Image.Image],
    *,
    width: int,
    height: int,
) -> Image.Image:
    seed_bytes = hashlib.sha256(
        f"{slot.get('slotId', 'large-grass')}|non-tiled-grass-detail-v1".encode("utf8")
    ).digest()[:8]
    rng = np.random.default_rng(int.from_bytes(seed_bytes, "big"))

    palette_samples: list[np.ndarray] = []
    detail_std_samples: list[float] = []
    for reference in references:
        resized = reference.convert("RGB").resize((96, 96), Image.Resampling.BICUBIC)
        pixels = np.asarray(resized, dtype=np.float32)
        palette_samples.append(pixels.reshape(-1, 3))
        reference_luma = pixels[:, :, 0] * 0.2126 + pixels[:, :, 1] * 0.7152 + pixels[:, :, 2] * 0.0722
        blurred = np.asarray(
            Image.fromarray(np.asarray(np.clip(reference_luma, 0, 255), dtype=np.uint8), "L")
            .filter(ImageFilter.GaussianBlur(radius=2.0)),
            dtype=np.float32,
        )
        detail_std_samples.append(float(np.std(np.clip(reference_luma - blurred, -28.0, 28.0))))

    palette = np.concatenate(palette_samples, axis=0)
    base = np.percentile(palette, 50, axis=0)
    spread = np.maximum(np.std(palette, axis=0), np.array([8.0, 10.0, 7.0], dtype=np.float32))
    learned_detail_std = float(np.clip(np.median(detail_std_samples) if detail_std_samples else 8.0, 6.5, 13.0))

    broad = smooth_reference_noise(width, height, rng, cells_x=17, cells_y=13, blur=18.0) - 0.5
    middle = smooth_reference_noise(width, height, rng, cells_x=53, cells_y=39, blur=3.2) - 0.5
    fine_seed = rng.normal(0.0, 1.0, (height, width)).astype(np.float32)
    fine_image = Image.fromarray(
        np.asarray(np.clip((fine_seed - fine_seed.min()) / max(0.0001, fine_seed.max() - fine_seed.min()) * 255, 0, 255), dtype=np.uint8),
        "L",
    ).filter(ImageFilter.GaussianBlur(radius=0.52))
    fine = np.asarray(fine_image, dtype=np.float32) / 255.0 - 0.5

    detail = broad * 0.18 + middle * 0.38 + fine * 0.44
    detail = detail - float(detail.mean())
    detail_std = float(detail.std())
    if detail_std > 0.0001:
        detail = detail / detail_std

    color_field = broad[:, :, None] * spread[None, None, :] * 0.28 + middle[:, :, None] * spread[None, None, :] * 0.26
    pixels = base[None, None, :] + color_field + detail[:, :, None] * learned_detail_std * 0.94
    pixels[:, :, 1] = np.maximum(pixels[:, :, 1], pixels[:, :, 0] * 1.10)
    pixels[:, :, 1] = np.maximum(pixels[:, :, 1], pixels[:, :, 2] * 1.08)
    pixels[:, :, 0] = np.minimum(pixels[:, :, 0], 142.0)
    pixels[:, :, 1] = np.clip(pixels[:, :, 1], 88.0, 174.0)
    pixels[:, :, 2] = np.clip(pixels[:, :, 2], 48.0, 132.0)

    reference = Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")
    return ImageEnhance.Contrast(reference.filter(ImageFilter.GaussianBlur(radius=0.22))).enhance(1.06)


def build_large_grass_reference_mosaic(
    slot: dict[str, Any],
    references: list[Image.Image],
    *,
    width: int,
    height: int,
) -> Image.Image:
    seed_bytes = hashlib.sha256(str(slot.get("slotId", "large-grass")).encode("utf8")).digest()[:8]
    rng = np.random.default_rng(int.from_bytes(seed_bytes, "big"))
    tile_size = 96
    mosaic = Image.new("RGB", (width, height))
    for y in range(0, height, tile_size):
        for x in range(0, width, tile_size):
            source = references[int(rng.integers(0, len(references)))].copy()
            if bool(rng.integers(0, 2)):
                source = source.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if bool(rng.integers(0, 2)):
                source = source.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            if source.size != (tile_size, tile_size):
                source = source.resize((tile_size, tile_size), Image.Resampling.BICUBIC)
            mosaic.paste(source, (x, y))
    mosaic = mosaic.crop((0, 0, width, height))
    mosaic = soften_grid_seams(mosaic, grid_size=tile_size, radius=10)
    return soften_grid_artifacts(mosaic, radius=0.34, blend=0.12)


def collect_grass_palette(paths: list[Path]) -> np.ndarray:
    chunks = []
    for path in paths:
        if not path.exists():
            continue
        with Image.open(path) as image:
            pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
        red = pixels[:, :, 0]
        green = pixels[:, :, 1]
        blue = pixels[:, :, 2]
        luma_values = red * 0.2126 + green * 0.7152 + blue * 0.0722
        mask = (
            (green > red * 1.04)
            & (green > blue * 1.04)
            & (luma_values > 58.0)
            & (luma_values < 188.0)
            & (blue < 150.0)
        )
        selected = pixels[mask]
        if len(selected):
            chunks.append(selected.astype(np.uint8))
    if not chunks:
        return np.empty((0, 3), dtype=np.uint8)
    palette = np.concatenate(chunks, axis=0)
    if len(palette) > 4096:
        step = max(1, len(palette) // 4096)
        palette = palette[::step][:4096]
    return palette


def resolve_reference_image_path(
    slot: dict[str, Any],
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
) -> Path | None:
    paths = resolve_reference_image_paths(slot, category, model_root, style_profile, reference_dataset_root)
    if not paths:
        return None
    bounds = slot.get("bounds", {})
    reference_group = terrainPatchReferenceGroup(slot)
    reference_key = json.dumps(
        {
            "category": category,
            "slotId": reference_group or slot.get("slotId"),
            "referenceGroup": reference_group,
            "unitKind": slot.get("unitKind"),
            "x": bounds.get("x"),
            "y": bounds.get("y"),
            "width": bounds.get("width"),
            "height": bounds.get("height"),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    digest = hashlib.sha256(reference_key.encode("utf-8")).digest()
    return paths[int.from_bytes(digest[:2], "little") % len(paths)]


def resolve_reference_image_paths(
    slot: dict[str, Any],
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
) -> list[Path]:
    root = resolve_reference_dataset_root(model_root, style_profile, reference_dataset_root)
    if root is None:
        return []
    dataset_category = REFERENCE_DATASET_CATEGORY.get(category, category)
    train_index = root / dataset_category / "train.json"
    if not train_index.exists():
        return []
    payload = read_json(train_index)
    sample_ids = payload.get("sampleIds")
    if not isinstance(sample_ids, list) or not sample_ids:
        return []
    sample_ids = filter_reference_sample_ids(
        slot,
        dataset_category,
        [str(sample_id) for sample_id in sample_ids],
        root=root,
    )
    if not sample_ids:
        return []
    paths = []
    for sample_id in sample_ids:
        candidate = root / dataset_category / "samples" / str(sample_id) / "target.png"
        if candidate.exists():
            paths.append(candidate)
    return paths


def filter_reference_sample_ids(
    slot: dict[str, Any],
    category: str,
    sample_ids: list[str],
    *,
    root: Path,
) -> list[str]:
    if category != "grass" or slot.get("unitKind") != "grass_texture":
        return sample_ids

    if is_large_grass_base_slot(slot):
        preferred = [
            sample_id
            for sample_id in sample_ids
            if "south-meadow-flowers-tight" in sample_id
        ]
        if preferred:
            return ranked_grass_reference_sample_ids(root, category, preferred)[:6]

    noisy_tokens = (
        "tree",
        "forest",
        "river",
        "stream",
        "water",
        "pond",
        "lake",
        "lakeside",
        "shore",
        "path",
        "road",
        "settlement",
        "rock",
        "rocks",
        "stone",
        "stones",
        "cliff",
        "canopy",
        "orchard",
        "storehouse",
        "reed",
        "bank",
        "work",
    )
    clean = [
        sample_id
        for sample_id in sample_ids
        if ("meadow" in sample_id or "grass" in sample_id)
        and not any(token in sample_id for token in noisy_tokens)
    ]
    candidates = clean or sample_ids
    return ranked_grass_reference_sample_ids(root, category, candidates)[:8] or sample_ids


def ranked_grass_reference_sample_ids(root: Path, category: str, sample_ids: list[str]) -> list[str]:
    scored = [
        (score_grass_reference_image(root / category / "samples" / sample_id / "target.png"), sample_id)
        for sample_id in sample_ids
    ]
    strong = [sample_id for score, sample_id in sorted(scored, reverse=True) if score >= 1.2]
    if strong:
        return strong
    ranked = [sample_id for _score, sample_id in sorted(scored, reverse=True)]
    return ranked or sample_ids


def score_grass_reference_image(path: Path) -> float:
    if not path.exists():
        return -999.0
    with Image.open(path) as image:
        pixels = np.asarray(image.convert("RGB").resize((64, 64), Image.Resampling.BICUBIC), dtype=np.float32) / 255.0
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.2126 + green * 0.7152 + blue * 0.0722
    dark_ratio = float(np.mean(luma_values < 0.23))
    bright_ratio = float(np.mean(luma_values > 0.45))
    blue_ratio = float(np.mean(blue > green * 0.9))
    gray_ratio = float(np.mean(np.abs(red - green) < 0.05))
    green_ratio = float(np.mean((green > red * 1.05) & (green > blue * 1.05) & (luma_values > 0.25)))
    edge_score = float(np.mean(np.abs(np.diff(luma_values, axis=0))) + np.mean(np.abs(np.diff(luma_values, axis=1))))
    return green_ratio * 1.8 + bright_ratio * 0.7 - dark_ratio * 2.0 - blue_ratio * 1.5 - gray_ratio * 0.3 - edge_score * 1.2


def terrainPatchReferenceGroup(slot: dict[str, Any]) -> str | None:
    if slot.get("unitKind") != "grass_texture":
        return None
    parsed = parseTerrainPatchSlotId(str(slot.get("slotId", "")))
    if parsed is None:
        return None
    return parsed["groupId"]


def parseTerrainPatchSlotId(slot_id: str) -> dict[str, int | str] | None:
    marker = "-patch-"
    if marker not in slot_id:
        return None
    group_id, suffix = slot_id.rsplit(marker, 1)
    parts = suffix.split("-")
    if len(parts) != 2:
        return None
    try:
        row = int(parts[0])
        column = int(parts[1])
    except ValueError:
        return None
    return {"groupId": group_id, "row": row, "column": column}


def resolve_reference_dataset_root(
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
) -> Path | None:
    if reference_dataset_root is not None:
        return reference_dataset_root
    profile_path = resolve_style_profile_path(model_root, style_profile)
    if profile_path is not None and profile_path.exists():
        return profile_path.parent
    return None


def style_channels(category: str, model_root: Path, style_profile: Path | None, height: int, width: int, torch):
    values = resolve_style_vector(category, model_root, style_profile)
    return [torch.full((1, height, width), value, dtype=torch.float32) for value in values]


def resolve_style_vector(category: str, model_root: Path, style_profile: Path | None) -> list[float]:
    profile_path = resolve_style_profile_path(model_root, style_profile)
    if profile_path and profile_path.exists():
        payload = read_json(profile_path)
        vectors = []
        if isinstance(payload, dict):
            for source_profile in payload.values():
                if isinstance(source_profile, dict):
                    raw = source_profile.get(category)
                    if isinstance(raw, list) and len(raw) >= 8:
                        vector = [float(value) for value in raw[:8] if isinstance(value, (int, float))]
                        if len(vector) == 8:
                            vectors.append(vector)
        if vectors:
            array = np.asarray(vectors, dtype=np.float32)
            return [round(float(max(0.0, min(1.0, value))), 6) for value in array.mean(axis=0).tolist()]

    defaults = {
        "grass": [0.28, 0.42, 0.18, 0.10, 0.12, 0.07, 0.16, 0.08],
        "water": [0.08, 0.38, 0.46, 0.06, 0.12, 0.14, 0.18, 0.09],
        "shoreline": [0.25, 0.39, 0.30, 0.10, 0.13, 0.12, 0.20, 0.10],
        "road": [0.53, 0.39, 0.20, 0.12, 0.10, 0.08, 0.16, 0.08],
        "tree": [0.15, 0.33, 0.16, 0.12, 0.16, 0.10, 0.24, 0.12],
        "rock": [0.38, 0.39, 0.34, 0.12, 0.12, 0.11, 0.21, 0.11],
    }
    return defaults.get(category, [0.0] * 8)


def resolve_style_profile_path(model_root: Path, style_profile: Path | None) -> Path | None:
    if style_profile is not None:
        return style_profile
    name = model_root.name
    candidates = []
    if name.endswith("-training"):
        candidates.append(model_root.parent / f"{name[:-len('-training')]}-dataset" / "style-profiles.json")
    candidates.append(model_root / "style-profiles.json")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0] if candidates else None


def pad_condition_to_unet_size(condition, torch, multiple: int = 8):
    height = int(condition.shape[1])
    width = int(condition.shape[2])
    pad_height = (multiple - height % multiple) % multiple
    pad_width = (multiple - width % multiple) % multiple
    if pad_height == 0 and pad_width == 0:
        return condition
    return torch.nn.functional.pad(condition, (0, pad_width, 0, pad_height), mode="replicate")


def infer_condition_tiled(
    model,
    condition,
    *,
    device,
    torch,
    original_height: int,
    original_width: int,
    tile_size: int = 128,
    overlap: int = 16,
    allow_direct: bool = True,
):
    if allow_direct and should_try_direct_inference(original_height, original_width):
        direct = try_direct_inference(
            model,
            condition,
            device=device,
            torch=torch,
            original_height=original_height,
            original_width=original_width,
        )
        if direct is not None:
            return direct

    stride = max(8, tile_size - overlap)
    accumulator = torch.zeros((3, original_height, original_width), dtype=torch.float32)
    weights = torch.zeros((1, original_height, original_width), dtype=torch.float32)
    y_values = tile_origins(original_height, tile_size, stride)
    x_values = tile_origins(original_width, tile_size, stride)
    for y in y_values:
        for x in x_values:
            patch = condition[:, y : y + tile_size, x : x + tile_size]
            patch_height = int(patch.shape[1])
            patch_width = int(patch.shape[2])
            padded = pad_condition_to_unet_size(patch, torch).unsqueeze(0).to(device)
            prediction = model(padded)[0][:, :patch_height, :patch_width].clamp(0, 1).cpu()
            blend = tile_blend_weights(
                patch_height,
                patch_width,
                y=y,
                x=x,
                original_height=original_height,
                original_width=original_width,
                overlap=overlap,
                torch=torch,
            )
            accumulator[:, y : y + patch_height, x : x + patch_width] += prediction * blend
            weights[:, y : y + patch_height, x : x + patch_width] += blend
    weights = torch.clamp(weights, min=1.0)
    output = accumulator.div(weights).clamp(0, 1).mul(255).byte().permute(1, 2, 0).numpy()
    return output


def should_try_direct_inference(height: int, width: int) -> bool:
    if os.environ.get("AI_PAINTER_FORCE_TILED") == "1":
        return False
    max_pixels = int(os.environ.get("AI_PAINTER_DIRECT_INFERENCE_MAX_PIXELS", str(1024 * 1024)))
    return height * width <= max_pixels


def try_direct_inference(
    model,
    condition,
    *,
    device,
    torch,
    original_height: int,
    original_width: int,
):
    try:
        padded = pad_condition_to_unet_size(condition, torch).unsqueeze(0).to(device)
        prediction = model(padded)[0][:, :original_height, :original_width]
        return prediction.clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
    except RuntimeError as error:
        if "out of memory" not in str(error).lower():
            raise
        if str(device).startswith("cuda"):
            torch.cuda.empty_cache()
        return None


def tile_blend_weights(
    height: int,
    width: int,
    *,
    y: int,
    x: int,
    original_height: int,
    original_width: int,
    overlap: int,
    torch,
):
    min_weight = 0.08
    y_weight = torch.ones((height,), dtype=torch.float32)
    x_weight = torch.ones((width,), dtype=torch.float32)
    ramp_height = min(overlap, height)
    ramp_width = min(overlap, width)
    if y > 0 and ramp_height > 1:
        y_weight[:ramp_height] = torch.linspace(min_weight, 1.0, ramp_height)
    if y + height < original_height and ramp_height > 1:
        y_weight[-ramp_height:] = torch.minimum(
            y_weight[-ramp_height:],
            torch.linspace(1.0, min_weight, ramp_height),
        )
    if x > 0 and ramp_width > 1:
        x_weight[:ramp_width] = torch.linspace(min_weight, 1.0, ramp_width)
    if x + width < original_width and ramp_width > 1:
        x_weight[-ramp_width:] = torch.minimum(
            x_weight[-ramp_width:],
            torch.linspace(1.0, min_weight, ramp_width),
        )
    return (y_weight.view(1, height, 1) * x_weight.view(1, 1, width)).clamp(min=min_weight)


def tile_origins(size: int, tile_size: int, stride: int) -> list[int]:
    if size <= tile_size:
        return [0]
    origins = list(range(0, max(1, size - tile_size + 1), stride))
    last = size - tile_size
    if origins[-1] != last:
        origins.append(last)
    return origins


def read_mask(path: Path, torch):
    with Image.open(path) as image:
        pixels = np.array(image.convert("L"), dtype=np.uint8, copy=True)
    return torch.from_numpy(pixels).unsqueeze(0).float().div(255.0)


if __name__ == "__main__":
    raise SystemExit(main())

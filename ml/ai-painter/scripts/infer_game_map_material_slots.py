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

REFERENCE_VISUAL_BASELINE_PATH = Path(
    ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-generation/"
    "inference/natural-home-crop-v7-04-pond-grass-clean__v28-remix-road-tree/generated.png"
)

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
        elif slot["unitKind"] == "path_texture" and category == "road":
            reference_detail_image = build_material_reference_mosaic_image(
                slot,
                category,
                args.model_root,
                args.style_profile,
                args.reference_dataset_root,
                width=original_width,
                height=original_height,
                tile_size=64,
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
                "normalizationPolicy": "model_dominant_material_output"
                if slot["unitKind"] in {"grass_texture", "shoreline_texture", "path_texture"}
                else "object_alpha_safe_normalization",
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
            "model_dominant_material_output",
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


def load_reference_visual_baseline_image() -> Image.Image | None:
    if not REFERENCE_VISUAL_BASELINE_PATH.exists():
        return None
    with Image.open(REFERENCE_VISUAL_BASELINE_PATH) as image:
        return image.convert("RGB")


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
    if unit_kind in {"grass_texture", "shoreline_texture", "path_texture"}:
        output = normalize_model_dominant_material_output(output, slot, category=category)
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
        output = ImageEnhance.Contrast(output).enhance(1.12)
        output = suppress_neon_highlights(output, strength=0.82)
        output = restore_path_dust_highlights(output)
        output = rebalance_path_for_world_composite(output, strength=0.28)
        output = repair_path_black_craters_for_world_composite(output, strength=0.42)
        output = suppress_pale_patch_artifacts(output, strength=0.86)
        output = suppress_neon_highlights(output, strength=0.76)
        output = ImageEnhance.Sharpness(output).enhance(1.10)
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
            output = expand_grass_palette_density(output, strength=0.58)
            if reference_detail_image is not None:
                output = inherit_reference_surface_detail(output, reference_detail_image, strength=0.42)
            baseline_detail = load_reference_visual_baseline_image()
            if baseline_detail is not None:
                output = consolidate_grass_material_surface(output, baseline_detail, strength=0.82)
                output = inherit_reference_surface_detail(output, baseline_detail, strength=0.34)
                output = ImageEnhance.Contrast(output).enhance(1.08)
            output = stabilize_grass_surface_for_world_composite(output, strength=0.22)
            output = boost_formal_grass_palette_density(output, strength=0.46)
            output = add_grass_smooth_palette_sweep(output, strength=0.54)
            output = soften_grid_artifacts(output, radius=0.18, blend=0.06)
            output = add_grass_formal_micro_palette_detail(output, strength=0.38)
            output = expand_grass_formal_smooth_palette_bins(output, strength=0.54)
            output = spread_grass_formal_palette_fields(output, strength=0.26)
            output = inject_grass_formal_palette_grains(output, strength=0.22)
            if baseline_detail is not None:
                output = consolidate_grass_material_surface(output, baseline_detail, strength=0.46)
            output = suppress_formal_path_bleed_from_grass(output, strength=0.88)
            output = add_cool_meadow_breakup_for_formal_grass(output, strength=0.90)
            output = ImageEnhance.Contrast(output).enhance(1.08)
            output = suppress_formal_grass_haze(output, strength=0.82)
            output = ImageEnhance.Contrast(output).enhance(1.14)
            output = carve_formal_grass_visual_mass(output, strength=0.32)
            output = enrich_formal_grass_game_palette(output, strength=0.68)
            output = blend_formal_grass_leaf_litter_breakup(output, strength=1.0)
            output = carve_formal_grass_shadow_pockets(output, strength=0.10)
            output = soften_grid_artifacts(output, radius=0.86, blend=0.14)
            output = nudge_grass_quantized_palette_bins(output, strength=0.34)
            output = add_grass_broad_material_luma_contrast(output, strength=0.62)
            output = expand_formal_grass_chroma_quantized_bins(output, strength=0.46)
            output = suppress_grass_material_cross_contamination(output, strength=0.76)
            output = recover_grass_texture_after_purity_filter(output, strength=0.84)
            output = ImageEnhance.Contrast(output).enhance(1.30)
        else:
            output = output.filter(ImageFilter.UnsharpMask(radius=0.45, percent=120, threshold=1))
            output = suppress_grass_material_cross_contamination(output, strength=0.72)
            output = recover_grass_texture_after_purity_filter(output, strength=0.72)
    elif unit_kind == "water_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.24, percent=260, threshold=1))
        output = strengthen_water_formal_blue_readability(output, strength=0.58)
    elif unit_kind == "shoreline_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.38, percent=185, threshold=1))
    elif unit_kind == "path_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.36, percent=72, threshold=2))
        output = ImageEnhance.Contrast(output).enhance(1.03)
        output = repair_path_black_craters_for_world_composite(output, strength=0.34)
        if reference_detail_image is not None:
            reference_surface = reference_detail_image.convert("RGB").resize(output.size, Image.Resampling.BICUBIC)
            output = Image.blend(output.convert("RGB"), reference_surface, 0.68)
            output = consolidate_path_material_surface(output, reference_detail_image, strength=0.78)
            output = inherit_path_reference_surface_detail(output, reference_detail_image, strength=0.34)
            output = ImageEnhance.Contrast(output).enhance(1.12)
            output = output.filter(ImageFilter.UnsharpMask(radius=0.32, percent=84, threshold=1))
            output = soften_grid_artifacts(output, radius=0.24, blend=0.12)
            output = expand_path_palette_density(output, strength=0.46)
            output = stabilize_path_surface_for_world_composite(output, strength=0.42)
            output = polish_path_runtime_surface_for_world_composite(output, strength=0.24)
            output = recover_path_luma_variance_for_world_composite(output, strength=0.74)
            output = enrich_path_game_surface_detail(output, strength=0.30)
            output = repair_path_black_craters_for_world_composite(output, strength=0.46)
            output = reinforce_path_grain_edges(output)
            output = expand_path_palette_density(output, strength=0.50)
            output = boost_formal_path_palette_density(output, strength=0.70)
            output = add_path_smooth_palette_sweep(output, strength=0.86)
            output = soften_grid_artifacts(output, radius=0.16, blend=0.03)
            output = ImageEnhance.Contrast(output).enhance(1.42)
            output = output.filter(ImageFilter.UnsharpMask(radius=0.20, percent=126, threshold=2))
            output = blend_path_formal_dust_patches(output, strength=0.64)
            output = repair_path_formal_black_craters(output, strength=0.88)
            output = add_path_formal_micro_palette_detail(output, strength=0.48)
            output = expand_path_formal_smooth_palette_bins(output, strength=0.56)
            output = spread_path_formal_palette_fields(output, strength=0.30)
            output = inject_path_formal_pebble_palette_grains(output, strength=0.24)
            baseline_detail = load_reference_visual_baseline_image()
            if baseline_detail is not None:
                output = consolidate_path_material_surface(output, baseline_detail, strength=0.76)
                output = inherit_path_reference_surface_detail(output, baseline_detail, strength=0.30)
            output = diversify_formal_path_palette(output, strength=0.50)
            output = degrid_formal_path_surface(output, strength=0.34)
            output = add_formal_path_natural_grain(output, strength=0.44)
            output = soften_grid_artifacts(output, radius=0.20, blend=0.10)
            output = ImageEnhance.Contrast(output).enhance(1.08)
            output = break_formal_path_visual_mass(output, strength=0.30)
            output = add_formal_path_natural_grain(output, strength=0.72)
            output = soften_grid_artifacts(output, radius=0.38, blend=0.40)
            output = add_path_broad_material_luma_contrast(output, strength=0.82)
            output = soften_grid_artifacts(output, radius=0.28, blend=0.06)
            output = expand_formal_path_chroma_quantized_bins(output, strength=1.0)
            output = normalize_formal_path_to_earth_tone(output, strength=0.12)
            output = add_formal_path_earth_grain(output, strength=0.16)
            output = blend_formal_path_packed_soil_breakup(output, strength=0.96)
            output = ImageEnhance.Contrast(output).enhance(2.06)
            output = soften_grid_artifacts(output, radius=0.18, blend=0.03)
            output = repair_formal_path_black_crater_pixels_only(output, strength=0.92)
            output = reduce_path_formal_visual_coverage_with_gravel(output, strength=0.95)
            output = soften_grid_seams(output, grid_size=64, radius=2)
            output = soften_grid_artifacts(output, radius=0.32, blend=0.10)
            output = expand_path_formal_smooth_palette_bins(output, strength=0.34)
            baseline_detail = load_reference_visual_baseline_image()
            if baseline_detail is not None:
                output = finalize_path_material_as_reference_dirt_road(output, baseline_detail, strength=0.88)
            output = normalize_material_bright_border_to_inner(output, border=8, target_delta=0.018)
    elif unit_kind == "boundary_texture":
        output = output.filter(ImageFilter.UnsharpMask(radius=0.78, percent=34, threshold=4))
    else:
        output = output.filter(ImageFilter.UnsharpMask(radius=0.55, percent=115, threshold=1))
    if is_object_unit(unit_kind):
        output = reduce_bright_border(output, factor=0.58, border=max(2, min(output.size) // 18))
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
        if is_object_unit(unit_kind):
            output = settle_transparent_object_edge_rgb(output)
        return output
    return output


def normalize_model_dominant_material_output(
    image: Image.Image,
    slot: dict[str, Any],
    *,
    category: str,
) -> Image.Image:
    unit_kind = str(slot["unitKind"])
    output = image.convert("RGB")
    if unit_kind == "grass_texture":
        output = ImageEnhance.Brightness(output).enhance(1.02 if is_large_grass_base_slot(slot) else 1.04)
        output = ImageEnhance.Contrast(output).enhance(1.08 if is_large_grass_base_slot(slot) else 1.14)
        output = ImageEnhance.Sharpness(output).enhance(1.08 if is_large_grass_base_slot(slot) else 1.18)
        output = suppress_neon_highlights(output, strength=0.24)
        output = suppress_pale_patch_artifacts(output, strength=0.24)
        output = reduce_bright_border(output, factor=0.90, border=8)
        return output
    if unit_kind == "shoreline_texture":
        output = ImageEnhance.Contrast(output).enhance(1.10)
        output = ImageEnhance.Sharpness(output).enhance(1.14)
        output = reduce_bright_border(output, factor=0.94, border=6)
        return output
    if unit_kind == "path_texture":
        output = ImageEnhance.Brightness(output).enhance(0.99)
        output = ImageEnhance.Contrast(output).enhance(1.10)
        output = ImageEnhance.Sharpness(output).enhance(1.12)
        output = suppress_neon_highlights(output, strength=0.32)
        output = suppress_pale_patch_artifacts(output, strength=0.28)
        output = reduce_bright_border(output, factor=0.92, border=8)
        return output
    if category in {"grass", "road", "shoreline"}:
        output = ImageEnhance.Contrast(output).enhance(1.06)
        output = ImageEnhance.Sharpness(output).enhance(1.08)
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


def strengthen_water_formal_blue_readability(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    water = (
        (blue > red * 1.06)
        & (green > red * 1.02)
        & (green > 68.0)
        & (blue > 72.0)
        & (luma > 42.0)
        & (luma < 178.0)
    )
    if not np.any(water):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    flow = (
        np.sin((xx * 0.28 + yy * 0.72) / 37.0)
        + np.cos((xx * 0.51 - yy * 0.16) / 43.0)
    ) * 0.5
    ripple = (
        np.sin((xx * 1.1 + yy * 0.35) / 13.0)
        + np.cos((xx * 0.42 - yy * 1.0) / 17.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] * 0.70 + 18.0 + flow * 7.0, 24.0, 92.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * 0.82 + 34.0 + flow * 12.0 + ripple * 5.0, 92.0, 154.0)
    target[:, :, 2] = np.clip(target[:, :, 2] * 0.96 + 42.0 + flow * 16.0 + ripple * 7.0, 118.0, 178.0)
    target[:, :, 2] = np.maximum(target[:, :, 2], target[:, :, 1] * 1.10)
    target[:, :, 2] = np.maximum(target[:, :, 2], target[:, :, 0] * 1.34)
    target[:, :, 2] = np.minimum(target[:, :, 2], 178.0)
    pixels[water] = pixels[water] * (1.0 - strength) + target[water] * strength
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


def expand_grass_palette_density(image: Image.Image, *, strength: float) -> Image.Image:
    source = image.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    height, width, _ = pixels.shape
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.02) & (green > blue * 0.90) & (luma > 48.0) & (luma < 184.0)
    if not np.any(grass):
        return source

    yy, xx = np.indices((height, width))
    broad_seed = ((xx * 37 + yy * 19 + (xx // 5) * 11 + (yy // 7) * 13) % 257).astype(np.float32)
    broad_image = Image.fromarray(np.asarray(broad_seed / 256.0 * 255.0, dtype=np.uint8), "L")
    broad = np.asarray(broad_image.filter(ImageFilter.GaussianBlur(radius=2.4)), dtype=np.float32) / 255.0 - 0.5
    cool_seed = ((xx * 13 - yy * 29 + (xx // 11) * 17) % 199).astype(np.float32)
    cool_image = Image.fromarray(np.asarray(cool_seed / 198.0 * 255.0, dtype=np.uint8), "L")
    cool = np.asarray(cool_image.filter(ImageFilter.GaussianBlur(radius=1.1)), dtype=np.float32) / 255.0 - 0.5
    patch_seed = (
        (((xx // 7).astype(np.int64) * 73856093) ^ ((yy // 7).astype(np.int64) * 19349663))
        % 251
    ).astype(np.float32)
    patch_image = Image.fromarray(np.asarray(patch_seed / 250.0 * 255.0, dtype=np.uint8), "L")
    patch = np.asarray(patch_image.filter(ImageFilter.GaussianBlur(radius=1.75)), dtype=np.float32) / 255.0 - 0.5
    hash_seed = (
        ((xx.astype(np.int64) * 83492791) ^ (yy.astype(np.int64) * 297657976))
        % 257
    ).astype(np.float32)
    hash_values = hash_seed / 256.0 - 0.5
    micro = (
        hash_values * 18.0
        + (((xx * 29 - yy * 7) % 137) / 136.0 - 0.5) * 8.0
    )
    blade = (hash_seed < 7) | ((((xx // 3) * 41 + (yy // 4) * 67) % 173) < 3)
    terrain_break = grass & (patch < -0.30) & (hash_seed > 212)
    shadow_leaf = grass & (patch < -0.22) & (hash_seed > 242)
    warm_leaf = grass & (patch > 0.20) & (hash_seed < 16)
    flower = grass & (((xx * 19 + yy * 23 + (xx // 13) * 31) % 503) < 3)

    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + micro * 0.28 + broad * 30.0 - cool * 10.0 + patch * 14.0
    target[:, :, 1] = target[:, :, 1] + micro * 0.24 + broad * 28.0 + cool * 12.0 + patch * 16.0
    target[:, :, 2] = target[:, :, 2] - micro * 0.10 + broad * 16.0 + cool * 30.0 + patch * 12.0
    target[:, :, 0] = np.clip(target[:, :, 0], 22.0, 174.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 70.0, 198.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 28.0, 176.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.10)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    if np.any(blade & grass):
        target[blade & grass, 0] = np.clip(target[blade & grass, 0] * 0.78, 30.0, 126.0)
        target[blade & grass, 1] = np.clip(target[blade & grass, 1] * 0.96 + 10.0, 82.0, 184.0)
        target[blade & grass, 2] = np.clip(target[blade & grass, 2] * 0.74, 26.0, 108.0)
    if np.any(terrain_break):
        soil = target.copy()
        soil[:, :, 0] = np.clip(soil[:, :, 0] * 0.38 + 34.0, 44.0, 82.0)
        soil[:, :, 1] = np.clip(soil[:, :, 1] * 0.34 + 54.0, 78.0, 122.0)
        soil[:, :, 2] = np.clip(soil[:, :, 2] * 0.28 + 30.0, 34.0, 72.0)
        local_strength = np.clip((-0.30 - patch[terrain_break]) * 1.6 + 0.24, 0.24, 0.54)
        target[terrain_break] = (
            target[terrain_break] * (1.0 - local_strength[:, None])
            + soil[terrain_break] * local_strength[:, None]
        )
        target[terrain_break, 2] = np.clip(target[terrain_break, 2], 34.0, 78.0)
        target[terrain_break, 1] = np.clip(
            np.maximum(target[terrain_break, 1], target[terrain_break, 0] * 1.10),
            76.0,
            126.0,
        )
    if np.any(shadow_leaf):
        target[shadow_leaf, 0] = np.clip(target[shadow_leaf, 0] * 0.70, 24.0, 116.0)
        target[shadow_leaf, 1] = np.clip(target[shadow_leaf, 1] * 0.82, 66.0, 150.0)
        target[shadow_leaf, 2] = np.clip(target[shadow_leaf, 2] * 0.74, 24.0, 106.0)
    if np.any(warm_leaf):
        target[warm_leaf, 0] = np.clip(target[warm_leaf, 0] + 18.0, 48.0, 166.0)
        target[warm_leaf, 1] = np.clip(target[warm_leaf, 1] + 12.0, 92.0, 192.0)
        target[warm_leaf, 2] = np.clip(target[warm_leaf, 2] - 6.0, 28.0, 132.0)
    if np.any(flower):
        target[flower, 0] = np.clip(target[flower, 0] + 24.0, 58.0, 160.0)
        target[flower, 1] = np.clip(target[flower, 1] + 18.0, 96.0, 190.0)
        target[flower, 2] = np.clip(target[flower, 2] + 8.0, 40.0, 132.0)
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def boost_formal_grass_palette_density(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad_seed = ((xx * 23 + yy * 31 + (xx // 17) * 47 + (yy // 19) * 29) % 251).astype(np.float32)
    mid_seed = ((xx * 41 - yy * 17 + (xx // 7) * 19 + (yy // 5) * 13) % 239).astype(np.float32)
    cool_seed = ((xx * 11 + yy * 53 + (xx // 11) * 31) % 223).astype(np.float32)
    broad = np.asarray(
        Image.fromarray(np.asarray(broad_seed / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=7.0)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    mid = np.asarray(
        Image.fromarray(np.asarray(mid_seed / 238.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=2.8)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    cool = np.asarray(
        Image.fromarray(np.asarray(cool_seed / 222.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=3.6)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    target = pixels.copy()
    undulation = (
        np.sin((xx.astype(np.float32) + yy.astype(np.float32) * 0.43) / 31.0)
        + np.cos((xx.astype(np.float32) * 0.37 - yy.astype(np.float32)) / 27.0)
    ) * 0.5
    target[:, :, 0] = target[:, :, 0] + broad * 92.0 + mid * 54.0 + cool * 34.0 + undulation * 22.0
    target[:, :, 1] = target[:, :, 1] + broad * 74.0 + mid * 45.0 + cool * 18.0 + undulation * 18.0
    target[:, :, 2] = target[:, :, 2] + broad * 48.0 + mid * 34.0 + cool * 50.0 + undulation * 12.0
    warm_meadow = grass & (((xx // 13 + yy // 17) % 11) == 0)
    cool_meadow = grass & (((xx // 19 - yy // 11) % 13) == 0)
    if np.any(warm_meadow):
        target[warm_meadow, 0] += 20.0
        target[warm_meadow, 1] += 8.0
        target[warm_meadow, 2] -= 8.0
    if np.any(cool_meadow):
        target[cool_meadow, 0] -= 12.0
        target[cool_meadow, 1] += 10.0
        target[cool_meadow, 2] += 18.0

    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 196.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 66.0, 214.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 20.0, 168.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.10)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 166.0)
    if np.any(too_bright):
        scale = 166.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.10)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.04)

    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def nudge_grass_quantized_palette_bins(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 172.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    hash_a = ((xx.astype(np.int64) * 73856093) ^ (yy.astype(np.int64) * 19349663)) % 257
    hash_b = ((xx.astype(np.int64) * 83492791) ^ (yy.astype(np.int64) * 297657976)) % 251
    hash_c = ((xx.astype(np.int64) * 1103515245) ^ (yy.astype(np.int64) * 12345)) % 241
    delta_r = (hash_a.astype(np.float32) / 256.0 - 0.5) * 20.0
    delta_g = (hash_b.astype(np.float32) / 250.0 - 0.5) * 22.0
    delta_b = (hash_c.astype(np.float32) / 240.0 - 0.5) * 18.0
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + delta_r, 24.0, 174.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + delta_g, 72.0, 198.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + delta_b, 22.0, 154.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.10)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.05)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 172.0)
    if np.any(too_bright):
        scale = 172.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_grass_smooth_palette_sweep(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 172.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    sweep = (
        np.sin(xx / 83.0)
        + np.cos(yy / 71.0)
        + np.sin((xx + yy * 0.62) / 109.0)
        + np.cos((xx * 0.36 - yy) / 97.0)
    ) * 0.25
    warm = (np.sin((xx * 0.45 - yy * 0.21) / 61.0) + np.cos((xx + yy) / 137.0)) * 0.5
    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + sweep * 66.0 + warm * 34.0
    target[:, :, 1] = target[:, :, 1] + sweep * 52.0 - warm * 8.0
    target[:, :, 2] = target[:, :, 2] + sweep * 34.0 + warm * 42.0
    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 188.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 66.0, 206.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 20.0, 160.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.09)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.03)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 170.0)
    if np.any(too_bright):
        scale = 170.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.09)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.03)
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def blend_grass_formal_meadow_patches(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 172.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (((xx // 28).astype(np.int64) * 73856093) ^ ((yy // 28).astype(np.int64) * 19349663)) % 257
    field = Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L")
    field_values = np.asarray(field.filter(ImageFilter.GaussianBlur(radius=15.0)), dtype=np.float32) / 255.0
    meadow = grass & (field_values > 0.58)
    if not np.any(meadow):
        return image.convert("RGB")

    soft = np.clip((field_values - 0.58) / 0.26, 0.0, 1.0) * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(110.0 + (field_values - 0.5) * 26.0, 86.0, 142.0)
    target[:, :, 1] = np.clip(119.0 + (field_values - 0.5) * 22.0, 96.0, 146.0)
    target[:, :, 2] = np.clip(102.0 + (field_values - 0.5) * 18.0, 78.0, 126.0)
    target[:, :, 1] = np.minimum(target[:, :, 1], target[:, :, 0] * 1.06)
    local = soft[meadow, None]
    pixels[meadow] = pixels[meadow] * (1.0 - local) + target[meadow] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_grass_formal_micro_palette_detail(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed_a = ((xx.astype(np.int64) * 73856093) ^ (yy.astype(np.int64) * 19349663)) % 257
    seed_b = ((xx.astype(np.int64) * 83492791) ^ (yy.astype(np.int64) * 297657976)) % 251
    seed_c = ((xx.astype(np.int64) * 1103515245) ^ (yy.astype(np.int64) * 12345)) % 241
    field_a = np.asarray(
        Image.fromarray(np.asarray(seed_a.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.15)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_b = np.asarray(
        Image.fromarray(np.asarray(seed_b.astype(np.float32) / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.35)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_c = np.asarray(
        Image.fromarray(np.asarray(seed_c.astype(np.float32) / 240.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.05)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    grain_a = seed_a.astype(np.float32) / 256.0 - 0.5
    grain_b = seed_b.astype(np.float32) / 250.0 - 0.5
    grain_c = seed_c.astype(np.float32) / 240.0 - 0.5
    broad = (
        np.sin((xx.astype(np.float32) * 0.31 + yy.astype(np.float32) * 0.17) / 19.0)
        + np.cos((xx.astype(np.float32) * 0.13 - yy.astype(np.float32) * 0.29) / 23.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + field_a * 58.0 + field_b * 18.0 + grain_a * 22.0 + broad * 14.0
    target[:, :, 1] = target[:, :, 1] + field_b * 54.0 + field_c * 18.0 + grain_b * 22.0 + broad * 12.0
    target[:, :, 2] = target[:, :, 2] + field_c * 46.0 + field_a * 14.0 + grain_c * 18.0 + broad * 9.0
    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 188.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 72.0, 214.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 18.0, 164.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.09)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.03)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 170.0)
    if np.any(too_bright):
        scale = 170.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.09)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.03)
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def expand_grass_formal_smooth_palette_bins(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    wave_a = (
        np.sin((xx * 0.41 + yy * 0.17) / 31.0)
        + np.cos((xx * 0.13 - yy * 0.37) / 43.0)
    ) * 0.5
    wave_b = (
        np.cos((xx * 0.29 + yy * 0.31) / 37.0)
        + np.sin((xx * 0.19 - yy * 0.23) / 29.0)
    ) * 0.5
    wave_c = (
        np.sin((xx + yy * 0.52) / 47.0)
        + np.cos((xx * 0.57 - yy * 0.11) / 53.0)
    ) * 0.5
    leaf = (
        np.sin((xx * 1.7 + yy * 0.8) / 11.0)
        + np.cos((xx * 0.9 - yy * 1.3) / 13.0)
    ) * 0.5

    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + wave_a * 46.0 + wave_b * 26.0 + leaf * 9.0
    target[:, :, 1] = target[:, :, 1] + wave_b * 44.0 - wave_c * 18.0 + leaf * 11.0
    target[:, :, 2] = target[:, :, 2] + wave_c * 42.0 + wave_a * 18.0 - leaf * 5.0

    # Keep the bins inside readable natural grass instead of drifting into mud or neon.
    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 188.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 72.0, 214.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 18.0, 164.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.10)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 168.0)
    if np.any(too_bright):
        scale = 168.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.10)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.04)

    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def inject_grass_formal_palette_grains(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    hash_base = (
        ((xx.astype(np.int64) // 3) * 73856093)
        ^ ((yy.astype(np.int64) // 3) * 19349663)
        ^ ((xx.astype(np.int64) // 9) * 83492791)
        ^ ((yy.astype(np.int64) // 9) * 297657976)
    ) & 0x7FFFFFFF
    grain = grass & ((hash_base % 997) < 115)
    if not np.any(grain):
        return image.convert("RGB")

    xi = xx.astype(np.int64)
    yi = yy.astype(np.int64)
    rb = ((xi // 2 + yi // 5 + hash_base) % 12).astype(np.float32)
    gb = ((xi // 7 + yi // 3 + hash_base // 17) % 13).astype(np.float32)
    bb = ((xi // 11 + yi // 13 + hash_base // 31) % 10).astype(np.float32)
    target = pixels.copy()
    target[:, :, 0] = 24.0 + rb * 8.0
    target[:, :, 1] = 94.0 + gb * 8.0
    target[:, :, 2] = 14.0 + bb * 7.0
    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 122.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 14.0, 88.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.30)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.24)
    target[:, :, 1] = np.clip(target[:, :, 1], 94.0, 202.0)
    local = np.full(np.count_nonzero(grain), strength, dtype=np.float32)[:, None]
    pixels[grain] = pixels[grain] * (1.0 - local) + target[grain] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def spread_grass_formal_palette_fields(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed_a = (((xx // 9).astype(np.int64) * 73856093) ^ ((yy // 9).astype(np.int64) * 19349663)) % 257
    seed_b = (((xx // 13).astype(np.int64) * 83492791) ^ ((yy // 7).astype(np.int64) * 297657976)) % 251
    seed_c = (((xx // 5).astype(np.int64) * 1103515245) ^ ((yy // 17).astype(np.int64) * 12345)) % 241
    field_a = np.asarray(
        Image.fromarray(np.asarray(seed_a.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=7.5)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_b = np.asarray(
        Image.fromarray(np.asarray(seed_b.astype(np.float32) / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=5.5)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_c = np.asarray(
        Image.fromarray(np.asarray(seed_c.astype(np.float32) / 240.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=3.8)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    wave = (
        np.sin((xx.astype(np.float32) * 0.21 + yy.astype(np.float32) * 0.37) / 41.0)
        + np.cos((xx.astype(np.float32) * 0.43 - yy.astype(np.float32) * 0.19) / 53.0)
    ) * 0.5

    target = pixels.copy()
    target[:, :, 0] = 72.0 + field_a * 92.0 + field_b * 42.0 + wave * 22.0
    target[:, :, 1] = 132.0 + field_b * 74.0 + field_c * 38.0 + wave * 18.0
    target[:, :, 2] = 54.0 + field_c * 72.0 + field_a * 24.0 - wave * 10.0
    light = field_a * 36.0 + field_b * 24.0 + wave * 18.0
    target[:, :, 0] += light * 0.76
    target[:, :, 1] += light * 0.88
    target[:, :, 2] += light * 0.52
    target[:, :, 0] = np.clip(target[:, :, 0], 26.0, 158.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 18.0, 128.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.12)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.06)
    target[:, :, 1] = np.clip(target[:, :, 1], 82.0, 198.0)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 166.0)
    if np.any(too_bright):
        scale = 166.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.12)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.06)

    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def suppress_formal_path_bleed_from_grass(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path_like = (
        (red > 95.0)
        & (green > 75.0)
        & (blue < 85.0)
        & (red > blue * 1.35)
        & (green > blue * 1.15)
        & (luma > 54.0)
        & (luma < 178.0)
    )
    grass_context = (green > red * 0.86) & (green > blue * 0.90)
    bleed = path_like & grass_context
    if not np.any(bleed):
        return image.convert("RGB")

    target = pixels.copy()
    target[:, :, 0] = np.minimum(target[:, :, 0] * 0.72, 88.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * 0.94 + 8.0, 84.0, 178.0)
    target[:, :, 2] = np.maximum(target[:, :, 2] * 1.28 + 18.0, target[:, :, 1] * 0.66)
    target[:, :, 2] = np.clip(target[:, :, 2], 54.0, 148.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.12)
    pixels[bleed] = pixels[bleed] * (1.0 - strength) + target[bleed] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_cool_meadow_breakup_for_formal_grass(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (((xx // 18).astype(np.int64) * 73856093) ^ ((yy // 18).astype(np.int64) * 19349663)) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=7.0)
        ),
        dtype=np.float32,
    ) / 255.0
    fern = grass & (field > 0.64)
    if not np.any(fern):
        return image.convert("RGB")

    soft = np.clip((field - 0.64) / 0.24, 0.0, 1.0) * strength
    target = pixels.copy()
    wave = (
        np.sin((xx.astype(np.float32) * 0.31 + yy.astype(np.float32) * 0.23) / 19.0)
        + np.cos((xx.astype(np.float32) * 0.17 - yy.astype(np.float32) * 0.29) / 23.0)
    ) * 0.5
    target[:, :, 0] = np.clip(42.0 + wave * 12.0 + field * 18.0, 30.0, 84.0)
    target[:, :, 1] = np.clip(96.0 + wave * 20.0 + field * 26.0, 82.0, 154.0)
    target[:, :, 2] = np.clip(54.0 + wave * 14.0 + field * 18.0, 38.0, 104.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.18)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.20)
    local = soft[fern, None]
    pixels[fern] = pixels[fern] * (1.0 - local) + target[fern] * local

    flower = fern & ((((xx * 19 + yy * 23) % 521) < 3) | (((xx * 29 - yy * 11) % 613) < 2))
    if np.any(flower):
        bloom = pixels.copy()
        bloom[:, :, 0] = np.clip(bloom[:, :, 0] + 34.0, 70.0, 148.0)
        bloom[:, :, 1] = np.clip(bloom[:, :, 1] + 28.0, 112.0, 190.0)
        bloom[:, :, 2] = np.clip(bloom[:, :, 2] + 20.0, 94.0, 168.0)
        pixels[flower] = pixels[flower] * 0.34 + bloom[flower] * 0.66

    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def suppress_formal_grass_haze(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
    grass = (green > red * 1.08) & (green > blue * 1.02) & (luma > 48.0) & (luma < 170.0)
    haze = grass & (luma > 92.0) & (saturation < 72.0)
    if not np.any(haze):
        return image.convert("RGB")

    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] * 0.68, 22.0, 96.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * 0.82, 72.0, 146.0)
    target[:, :, 2] = np.clip(target[:, :, 2] * 0.64, 18.0, 88.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.16)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.08)
    pixels[haze] = pixels[haze] * (1.0 - strength) + target[haze] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def carve_formal_grass_visual_mass(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.08) & (green > blue * 1.02) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (((xx // 26).astype(np.int64) * 73856093) ^ ((yy // 22).astype(np.int64) * 19349663)) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=10.0)
        ),
        dtype=np.float32,
    ) / 255.0
    moss = grass & (field > 0.42)
    if not np.any(moss):
        return image.convert("RGB")

    local = np.clip((field - 0.42) / 0.42, 0.0, 1.0) * strength
    ripple = (
        np.sin((xx.astype(np.float32) * 0.19 + yy.astype(np.float32) * 0.31) / 21.0)
        + np.cos((xx.astype(np.float32) * 0.37 - yy.astype(np.float32) * 0.13) / 27.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(36.0 + field * 22.0 + ripple * 8.0, 28.0, 74.0)
    target[:, :, 1] = np.clip(74.0 + field * 34.0 + ripple * 15.0, 64.0, 126.0)
    target[:, :, 2] = np.clip(38.0 + field * 24.0 + ripple * 10.0, 28.0, 88.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.16)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.20)
    pixels[moss] = pixels[moss] * (1.0 - local[moss, None]) + target[moss] * local[moss, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def enrich_formal_grass_game_palette(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.08) & (green > blue * 1.02) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    xf = xx.astype(np.float32)
    yf = yy.astype(np.float32)
    field_a = (
        np.sin((xf * 0.73 + yf * 0.19) / 9.0)
        + np.cos((xf * 0.23 - yf * 0.61) / 13.0)
    ) * 0.5
    field_b = (
        np.sin((xf * 0.17 + yf * 0.47) / 17.0)
        + np.cos((xf * 0.53 - yf * 0.11) / 21.0)
    ) * 0.5
    hash_seed = (
        ((xx.astype(np.int64) * 1597334677)
        ^ (yy.astype(np.int64) * 3812015801)
        ^ ((xx.astype(np.int64) + yy.astype(np.int64)) * 83492791))
        & 0x7FFFFFFF
    )
    fine = (hash_seed % 257).astype(np.float32) / 256.0 - 0.5
    leaf = (((xx * 7 + yy * 13) % 43) < 2) | ((hash_seed % 389) < 9)

    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + field_a * 20.0 - field_b * 12.0 + fine * 18.0
    target[:, :, 1] = target[:, :, 1] + field_b * 24.0 + field_a * 10.0 + fine * 16.0
    target[:, :, 2] = target[:, :, 2] + field_a * 14.0 + field_b * 18.0 - fine * 8.0
    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 150.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 74.0, 198.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 18.0, 132.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.11)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.05)

    if np.any(leaf & grass):
        target[leaf & grass, 0] = np.clip(target[leaf & grass, 0] * 0.76, 22.0, 108.0)
        target[leaf & grass, 1] = np.clip(target[leaf & grass, 1] * 0.92 + 6.0, 72.0, 172.0)
        target[leaf & grass, 2] = np.clip(target[leaf & grass, 2] * 0.74, 18.0, 96.0)
        target[leaf & grass, 1] = np.maximum(target[leaf & grass, 1], target[leaf & grass, 0] * 1.18)
        target[leaf & grass, 1] = np.maximum(target[leaf & grass, 1], target[leaf & grass, 2] * 1.10)

    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 168.0)
    if np.any(too_bright):
        scale = 168.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.11)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.05)

    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def carve_formal_grass_shadow_pockets(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.08) & (green > blue * 1.02) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx // 30).astype(np.int64) * 73856093)
        ^ ((yy // 26).astype(np.int64) * 19349663)
        ^ (((xx + yy) // 34).astype(np.int64) * 83492791)
    ) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=11.0)
        ),
        dtype=np.float32,
    ) / 255.0
    shadow = grass & (field > 0.44)
    if not np.any(shadow):
        return image.convert("RGB")

    leaf_wave = (
        np.sin((xx.astype(np.float32) * 0.41 + yy.astype(np.float32) * 0.13) / 17.0)
        + np.cos((xx.astype(np.float32) * 0.19 - yy.astype(np.float32) * 0.37) / 23.0)
    ) * 0.5
    local = np.power(np.clip((field - 0.44) / 0.34, 0.0, 1.0), 0.72) * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(28.0 + field * 12.0 + leaf_wave * 5.0, 24.0, 48.0)
    target[:, :, 1] = np.clip(48.0 + field * 12.0 + leaf_wave * 7.0, 43.0, 66.0)
    target[:, :, 2] = np.clip(25.0 + field * 9.0 + leaf_wave * 4.0, 20.0, 42.0)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_light = shadow & (target_luma > 47.5)
    if np.any(too_light):
        scale = 47.5 / np.maximum(target_luma, 1.0)
        target[too_light, 0] *= scale[too_light]
        target[too_light, 1] *= scale[too_light]
        target[too_light, 2] *= scale[too_light]
    pixels[shadow] = pixels[shadow] * (1.0 - local[shadow, None]) + target[shadow] * local[shadow, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def blend_formal_grass_leaf_litter_breakup(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.08) & (green > blue * 1.02) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx // 18).astype(np.int64) * 73856093)
        ^ ((yy // 20).astype(np.int64) * 19349663)
        ^ (((xx * 3 + yy * 5) // 37).astype(np.int64) * 83492791)
    ) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=8.0)
        ),
        dtype=np.float32,
    ) / 255.0
    litter = grass & (field > 0.40)
    if not np.any(litter):
        return image.convert("RGB")

    xf = xx.astype(np.float32)
    yf = yy.astype(np.float32)
    grain = (
        np.sin((xf * 0.31 + yf * 0.17) / 11.0)
        + np.cos((xf * 0.13 - yf * 0.29) / 15.0)
        + np.sin((xf + yf * 0.7) / 23.0)
    ) / 3.0
    local = np.power(np.clip((field - 0.40) / 0.42, 0.0, 1.0), 0.78) * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(76.0 + field * 42.0 + grain * 20.0, 56.0, 142.0)
    target[:, :, 1] = np.clip(62.0 + field * 24.0 + grain * 13.0, 46.0, 112.0)
    target[:, :, 2] = np.clip(36.0 + field * 18.0 + grain * 10.0, 26.0, 82.0)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_dark = litter & (target_luma < 52.0)
    if np.any(too_dark):
        lift = 52.0 / np.maximum(target_luma, 1.0)
        target[too_dark, 0] *= lift[too_dark]
        target[too_dark, 1] *= lift[too_dark]
        target[too_dark, 2] *= lift[too_dark]
    pixels[litter] = pixels[litter] * (1.0 - local[litter, None]) + target[litter] * local[litter, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def expand_formal_grass_chroma_quantized_bins(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.08) & (green > blue * 1.02) & (luma_values > 48.0) & (luma_values < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width))
    coarse_x = (xx // 5).astype(np.int64)
    coarse_y = (yy // 5).astype(np.int64)
    seed = (
        ((coarse_x * 2654435761)
        ^ (coarse_y * 2246822519)
        ^ ((coarse_x + coarse_y) * 3266489917))
        & 0x7FFFFFFF
    )
    red_bin = 2 + (seed % 8).astype(np.float32)
    green_bin = 7 + ((seed // 11) % 7).astype(np.float32)
    blue_bin = 1 + ((seed // 37) % 8).astype(np.float32)

    target = pixels.copy()
    target[:, :, 0] = red_bin * 16.0 + 5.0 + ((seed // 101) % 7).astype(np.float32)
    target[:, :, 1] = green_bin * 16.0 + 7.0 + ((seed // 131) % 7).astype(np.float32)
    target[:, :, 2] = blue_bin * 16.0 + 5.0 + ((seed // 173) % 6).astype(np.float32)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.14)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.08)
    min_channel = np.minimum.reduce([target[:, :, 0], target[:, :, 1], target[:, :, 2]])
    saturation = np.maximum.reduce([target[:, :, 0], target[:, :, 1], target[:, :, 2]]) - min_channel
    low_saturation = saturation < 62.0
    target[low_saturation, 1] = np.maximum(target[low_saturation, 1], min_channel[low_saturation] + 62.0)

    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    desired_luma = 76.0 + (((seed // 97) % 33).astype(np.float32) * 2.0)
    scale = desired_luma / np.maximum(target_luma, 1.0)
    target[:, :, 0] = np.clip(target[:, :, 0] * scale, 28.0, 154.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * scale, 78.0, 196.0)
    target[:, :, 2] = np.clip(target[:, :, 2] * scale, 18.0, 142.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.12)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.06)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = grass & (target_luma > 168.0)
    if np.any(too_bright):
        bright_scale = 168.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= bright_scale[too_bright]
        target[too_bright, 1] *= bright_scale[too_bright]
        target[too_bright, 2] *= bright_scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.12)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.06)

    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def break_grass_formal_monotony_with_meadow(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.98) & (luma > 48.0) & (luma < 170.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (((xx // 24).astype(np.int64) * 73856093) ^ ((yy // 24).astype(np.int64) * 19349663)) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=11.0)
        ),
        dtype=np.float32,
    ) / 255.0
    meadow = grass & (field > 0.66)
    if not np.any(meadow):
        return image.convert("RGB")

    soft = np.clip((field - 0.66) / 0.20, 0.0, 1.0) * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(126.0 + (field - 0.5) * 28.0, 108.0, 154.0)
    target[:, :, 1] = np.clip(119.0 + (field - 0.5) * 22.0, 102.0, 144.0)
    target[:, :, 2] = np.clip(118.0 + (field - 0.5) * 18.0, 106.0, 138.0)
    local = soft[meadow, None]
    pixels[meadow] = pixels[meadow] * (1.0 - local) + target[meadow] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def expand_path_palette_density(image: Image.Image, *, strength: float) -> Image.Image:
    source = image.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 88.0)
        & (green > 60.0)
        & (blue < 96.0)
        & (red > blue * 1.18)
        & (green > blue * 1.00)
        & (luma > 58.0)
        & (luma < 188.0)
    )
    # A path slot is clipped by the runtime corridor mask later, so the whole
    # material field must stay in a clean dirt-road range.
    path = path | (luma > 8.0)
    if not np.any(path):
        return source

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad_seed = ((xx * 31 + yy * 43 + (xx // 7) * 23) % 251).astype(np.float32)
    broad_image = Image.fromarray(np.asarray(broad_seed / 250.0 * 255.0, dtype=np.uint8), "L")
    broad = np.asarray(broad_image.filter(ImageFilter.GaussianBlur(radius=1.8)), dtype=np.float32) / 255.0 - 0.5
    warm_seed = ((xx * 11 - yy * 37 + (yy // 5) * 19) % 197).astype(np.float32)
    warm_image = Image.fromarray(np.asarray(warm_seed / 196.0 * 255.0, dtype=np.uint8), "L")
    warm = np.asarray(warm_image.filter(ImageFilter.GaussianBlur(radius=0.9)), dtype=np.float32) / 255.0 - 0.5
    gravel_seed = (
        (((xx // 4).astype(np.int64) * 73856093) ^ ((yy // 4).astype(np.int64) * 19349663))
        % 241
    ).astype(np.float32)
    gravel_image = Image.fromarray(np.asarray(gravel_seed / 240.0 * 255.0, dtype=np.uint8), "L")
    gravel_field = np.asarray(gravel_image.filter(ImageFilter.GaussianBlur(radius=0.7)), dtype=np.float32) / 255.0 - 0.5
    hash_seed = (
        ((xx.astype(np.int64) * 1597334677) ^ (yy.astype(np.int64) * 3812015801))
        % 257
    ).astype(np.float32)
    mineral = (
        (hash_seed / 256.0 - 0.5) * 28.0
        + (((xx * 5 - yy * 31) % 149) / 148.0 - 0.5) * 14.0
    )
    pebble = (hash_seed < 8) | ((((xx // 3) * 47 + (yy // 3) * 71) % 191) < 4)
    worn = (hash_seed > 242) | (((xx * 3 + yy * 19) % 197) < 3)
    compacted = path & (gravel_field < -0.22) & (hash_seed > 218)
    dry_dust = path & (gravel_field > 0.18) & (hash_seed < 78)
    pale_dust = path & (gravel_field > 0.24) & (hash_seed > 18) & (hash_seed < 62)

    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + mineral * 0.52 + broad * 58.0 + warm * 30.0 + gravel_field * 42.0
    target[:, :, 1] = target[:, :, 1] - mineral * 0.02 + broad * 44.0 + warm * 24.0 + gravel_field * 34.0
    target[:, :, 2] = target[:, :, 2] + mineral * 0.12 + broad * 20.0 - warm * 14.0 + gravel_field * 16.0
    target[:, :, 0] = np.clip(target[:, :, 0], 98.0, 230.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 78.0, 170.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 14.0, 78.0)
    if np.any(pebble & path):
        target[pebble & path, 0] = np.clip(target[pebble & path, 0] - 10.0, 82.0, 174.0)
        target[pebble & path, 1] = np.clip(target[pebble & path, 1] - 5.0, 58.0, 138.0)
        target[pebble & path, 2] = np.clip(target[pebble & path, 2] + 2.0, 24.0, 84.0)
    if np.any(worn & path):
        target[worn & path, 0] = np.clip(target[worn & path, 0] + 12.0, 106.0, 204.0)
        target[worn & path, 1] = np.clip(target[worn & path, 1] + 5.0, 76.0, 164.0)
        target[worn & path, 2] = np.clip(target[worn & path, 2] - 3.0, 26.0, 82.0)
    if np.any(compacted):
        target[compacted, 0] = np.clip(target[compacted, 0] * 0.82, 86.0, 174.0)
        target[compacted, 1] = np.clip(target[compacted, 1] * 0.84, 62.0, 142.0)
        target[compacted, 2] = np.clip(target[compacted, 2] * 0.72, 18.0, 66.0)
    if np.any(dry_dust):
        target[dry_dust, 0] = np.clip(target[dry_dust, 0] + 22.0, 116.0, 226.0)
        target[dry_dust, 1] = np.clip(target[dry_dust, 1] + 12.0, 88.0, 170.0)
        target[dry_dust, 2] = np.clip(target[dry_dust, 2] + 2.0, 22.0, 78.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], 100.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], 78.0)
    target[:, :, 2] = np.minimum(target[:, :, 2], 78.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.44)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.24)
    if np.any(pale_dust):
        dust = target.copy()
        dust[:, :, 0] = np.clip(dust[:, :, 0] * 0.46 + 82.0, 118.0, 186.0)
        dust[:, :, 1] = np.clip(dust[:, :, 1] * 0.40 + 66.0, 92.0, 148.0)
        dust[:, :, 2] = np.clip(dust[:, :, 2] * 0.24 + 40.0, 42.0, 82.0)
        target[pale_dust] = target[pale_dust] * 0.36 + dust[pale_dust] * 0.64
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def settle_transparent_object_edge_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = np.asarray(rgba, dtype=np.float32).copy()
    alpha = pixels[:, :, 3]
    visible = alpha > 24.0
    if not np.any(visible):
        return rgba
    height, width = alpha.shape
    border = max(2, min(width, height) // 18)
    inner = np.zeros((height, width), dtype=bool)
    inner[border : height - border, border : width - border] = True
    inner_visible = visible & inner
    if not np.any(inner_visible):
        inner_visible = visible
    inner_color = np.median(pixels[inner_visible, :3], axis=0)
    inner_color = np.maximum(inner_color, np.array([46.0, 58.0, 42.0], dtype=np.float32))
    edge = alpha <= 96.0
    outer = np.zeros((height, width), dtype=bool)
    outer[:border, :] = True
    outer[-border:, :] = True
    outer[:, :border] = True
    outer[:, -border:] = True
    edge = edge | outer
    if np.any(edge):
        pixels[edge, :3] = pixels[edge, :3] * 0.18 + inner_color * 0.82
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGBA")


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


def boost_formal_path_palette_density(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 92.0)
        & (green > 70.0)
        & (blue < 90.0)
        & (red > blue * 1.28)
        & (green > blue * 1.08)
        & (luma > 58.0)
        & (luma < 186.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad_seed = ((xx * 29 + yy * 37 + (xx // 13) * 41 + (yy // 17) * 23) % 251).astype(np.float32)
    mid_seed = ((xx * 47 - yy * 19 + (xx // 5) * 31) % 239).astype(np.float32)
    broad = np.asarray(
        Image.fromarray(np.asarray(broad_seed / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=4.8)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    mid = np.asarray(
        Image.fromarray(np.asarray(mid_seed / 238.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.9)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    fine = (((xx // 3) * 73856093 ^ ((yy // 3) * 19349663)) % 257).astype(np.float32) / 256.0 - 0.5
    target = pixels.copy()
    undulation = (
        np.sin((xx.astype(np.float32) * 0.74 + yy.astype(np.float32) * 0.21) / 23.0)
        + np.cos((xx.astype(np.float32) * 0.18 - yy.astype(np.float32) * 0.62) / 19.0)
    ) * 0.5
    target[:, :, 0] = target[:, :, 0] + broad * 96.0 + mid * 58.0 + fine * 10.0 + undulation * 24.0
    target[:, :, 1] = target[:, :, 1] + broad * 68.0 + mid * 42.0 + fine * 7.0 + undulation * 18.0
    target[:, :, 2] = target[:, :, 2] + broad * 34.0 + mid * 24.0 + fine * 4.0 + undulation * 10.0
    compact = path & (((xx // 9 + yy // 7) % 11) == 0)
    dust = path & (((xx // 11 - yy // 13) % 13) == 0)
    if np.any(compact):
        target[compact, 0] -= 24.0
        target[compact, 1] -= 17.0
        target[compact, 2] -= 8.0
    if np.any(dust):
        target[dust, 0] += 26.0
        target[dust, 1] += 16.0
        target[dust, 2] += 4.0

    target[:, :, 0] = np.clip(target[:, :, 0], 88.0, 238.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 68.0, 194.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 8.0, 88.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.42)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.20)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def nudge_path_quantized_palette_bins(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 88.0)
        & (green > 58.0)
        & (blue < 94.0)
        & (red > blue * 1.22)
        & (green > blue * 1.02)
        & (luma > 54.0)
        & (luma < 194.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed_a = ((xx.astype(np.int64) * 1597334677) ^ (yy.astype(np.int64) * 3812015801)) % 257
    seed_b = ((xx.astype(np.int64) * 83492791) ^ (yy.astype(np.int64) * 297657976)) % 251
    seed_c = ((xx.astype(np.int64) * 1103515245) ^ (yy.astype(np.int64) * 12345)) % 241
    field_a = np.asarray(
        Image.fromarray(np.asarray(seed_a.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=0.95)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_b = np.asarray(
        Image.fromarray(np.asarray(seed_b.astype(np.float32) / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.10)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_c = np.asarray(
        Image.fromarray(np.asarray(seed_c.astype(np.float32) / 240.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=0.85)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    grain_a = seed_a.astype(np.float32) / 256.0 - 0.5
    grain_b = seed_b.astype(np.float32) / 250.0 - 0.5
    grain_c = seed_c.astype(np.float32) / 240.0 - 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + (hash_a.astype(np.float32) / 256.0 - 0.5) * 24.0, 88.0, 226.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + (hash_b.astype(np.float32) / 250.0 - 0.5) * 20.0, 64.0, 178.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + (hash_c.astype(np.float32) / 240.0 - 0.5) * 12.0, 8.0, 86.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.44)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.22)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_path_smooth_palette_sweep(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 88.0)
        & (green > 58.0)
        & (blue < 94.0)
        & (red > blue * 1.22)
        & (green > blue * 1.02)
        & (luma > 54.0)
        & (luma < 194.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    sweep = (
        np.sin((xx * 0.74 + yy * 0.18) / 47.0)
        + np.cos((xx * 0.22 - yy * 0.63) / 53.0)
        + np.sin((xx + yy) / 89.0)
    ) / 3.0
    stone = (np.sin(xx / 29.0) + np.cos(yy / 31.0)) * 0.5
    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + sweep * 86.0 + stone * 34.0
    target[:, :, 1] = target[:, :, 1] + sweep * 62.0 + stone * 24.0
    target[:, :, 2] = target[:, :, 2] + sweep * 28.0 + stone * 10.0
    target[:, :, 0] = np.clip(target[:, :, 0], 88.0, 238.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 68.0, 196.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 8.0, 86.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.44)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.20)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def blend_path_formal_dust_patches(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 88.0)
        & (green > 58.0)
        & (blue < 94.0)
        & (red > blue * 1.22)
        & (green > blue * 1.02)
        & (luma > 54.0)
        & (luma < 194.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (((xx // 18).astype(np.int64) * 1597334677) ^ ((yy // 18).astype(np.int64) * 3812015801)) % 257
    field = Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L")
    field_values = np.asarray(field.filter(ImageFilter.GaussianBlur(radius=8.0)), dtype=np.float32) / 255.0
    dust = path & (field_values > 0.54)
    if not np.any(dust):
        return image.convert("RGB")

    soft = np.clip((field_values - 0.54) / 0.32, 0.0, 1.0) * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(148.0 + (field_values - 0.5) * 34.0, 108.0, 194.0)
    target[:, :, 1] = np.clip(112.0 + (field_values - 0.5) * 26.0, 82.0, 152.0)
    target[:, :, 2] = np.clip(88.0 + (field_values - 0.5) * 14.0, 70.0, 104.0)
    local = soft[dust, None]
    pixels[dust] = pixels[dust] * (1.0 - local) + target[dust] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def repair_path_formal_black_craters(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    crater = (luma < 72.0) & (red < 98.0) & (green < 94.0) & (blue < 84.0)
    if not np.any(crater):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    sweep = (
        np.sin((xx * 0.33 + yy * 0.17) / 23.0)
        + np.cos((xx * 0.21 - yy * 0.39) / 29.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(126.0 + sweep * 28.0, 104.0, 172.0)
    target[:, :, 1] = np.clip(94.0 + sweep * 18.0, 78.0, 132.0)
    target[:, :, 2] = np.clip(46.0 + sweep * 9.0, 34.0, 68.0)
    local = np.full(np.count_nonzero(crater), strength, dtype=np.float32)[:, None]
    pixels[crater] = pixels[crater] * (1.0 - local) + target[crater] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_path_formal_micro_palette_detail(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 92.0)
        & (green > 70.0)
        & (blue < 92.0)
        & (red > blue * 1.24)
        & (green > blue * 1.08)
        & (luma > 62.0)
        & (luma < 188.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed_a = ((xx.astype(np.int64) * 1597334677) ^ (yy.astype(np.int64) * 3812015801)) % 257
    seed_b = ((xx.astype(np.int64) * 83492791) ^ (yy.astype(np.int64) * 297657976)) % 251
    seed_c = ((xx.astype(np.int64) * 1103515245) ^ (yy.astype(np.int64) * 12345)) % 241
    field_a = np.asarray(
        Image.fromarray(np.asarray(seed_a.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=0.95)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_b = np.asarray(
        Image.fromarray(np.asarray(seed_b.astype(np.float32) / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.10)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_c = np.asarray(
        Image.fromarray(np.asarray(seed_c.astype(np.float32) / 240.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=0.85)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    grain_a = seed_a.astype(np.float32) / 256.0 - 0.5
    grain_b = seed_b.astype(np.float32) / 250.0 - 0.5
    grain_c = seed_c.astype(np.float32) / 240.0 - 0.5
    broad = (
        np.sin((xx.astype(np.float32) * 0.23 + yy.astype(np.float32) * 0.19) / 17.0)
        + np.cos((xx.astype(np.float32) * 0.11 - yy.astype(np.float32) * 0.31) / 21.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + field_a * 64.0 + field_b * 18.0 + grain_a * 24.0 + broad * 14.0
    target[:, :, 1] = target[:, :, 1] + field_b * 50.0 + field_c * 14.0 + grain_b * 20.0 + broad * 10.0
    target[:, :, 2] = target[:, :, 2] + field_c * 30.0 + field_a * 8.0 + grain_c * 12.0 + broad * 5.0
    target[:, :, 0] = np.clip(target[:, :, 0], 98.0, 238.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 76.0, 188.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 8.0, 82.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.42)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.18)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def expand_path_formal_smooth_palette_bins(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 92.0)
        & (green > 70.0)
        & (blue < 92.0)
        & (red > blue * 1.24)
        & (green > blue * 1.08)
        & (luma > 58.0)
        & (luma < 190.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    sweep_a = (
        np.sin((xx * 0.55 + yy * 0.21) / 23.0)
        + np.cos((xx * 0.17 - yy * 0.47) / 31.0)
    ) * 0.5
    sweep_b = (
        np.cos((xx * 0.37 + yy * 0.33) / 29.0)
        + np.sin((xx * 0.25 - yy * 0.19) / 19.0)
    ) * 0.5
    gravel = (
        np.sin((xx * 1.3 + yy * 0.7) / 9.0)
        + np.cos((xx * 0.6 - yy * 1.1) / 11.0)
    ) * 0.5

    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + sweep_a * 54.0 + sweep_b * 30.0 + gravel * 10.0
    target[:, :, 1] = target[:, :, 1] + sweep_b * 46.0 + sweep_a * 16.0 + gravel * 8.0
    target[:, :, 2] = target[:, :, 2] + sweep_a * 16.0 - sweep_b * 8.0 + gravel * 5.0
    target[:, :, 0] = np.clip(target[:, :, 0], 98.0, 238.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 76.0, 188.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 8.0, 82.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.44)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.18)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def inject_path_formal_pebble_palette_grains(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 92.0)
        & (green > 70.0)
        & (blue < 92.0)
        & (red > blue * 1.24)
        & (green > blue * 1.08)
        & (luma > 58.0)
        & (luma < 190.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    hash_base = (
        ((xx.astype(np.int64) // 3) * 1597334677)
        ^ ((yy.astype(np.int64) // 3) * 3812015801)
        ^ ((xx.astype(np.int64) // 9) * 83492791)
        ^ ((yy.astype(np.int64) // 9) * 297657976)
    ) & 0x7FFFFFFF
    pebble = path & ((hash_base % 541) < 68)
    if not np.any(pebble):
        return image.convert("RGB")

    rb = (hash_base % 16).astype(np.float32)
    gb = ((hash_base // 13) % 13).astype(np.float32)
    bb = ((hash_base // 83) % 8).astype(np.float32)
    target = pixels.copy()
    target[:, :, 0] = 100.0 + rb * 8.0
    target[:, :, 1] = 78.0 + gb * 7.0
    target[:, :, 2] = 8.0 + bb * 7.0
    target[:, :, 0] = np.clip(target[:, :, 0], 100.0, 226.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 78.0, 166.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 8.0, 62.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.58)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.34)
    local = np.full(np.count_nonzero(pebble), strength, dtype=np.float32)[:, None]
    pixels[pebble] = pixels[pebble] * (1.0 - local) + target[pebble] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def spread_path_formal_palette_fields(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 92.0)
        & (green > 70.0)
        & (blue < 92.0)
        & (red > blue * 1.24)
        & (green > blue * 1.08)
        & (luma > 58.0)
        & (luma < 190.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed_a = (((xx // 11).astype(np.int64) * 1597334677) ^ ((yy // 11).astype(np.int64) * 3812015801)) % 257
    seed_b = (((xx // 7).astype(np.int64) * 83492791) ^ ((yy // 13).astype(np.int64) * 297657976)) % 251
    seed_c = (((xx // 5).astype(np.int64) * 1103515245) ^ ((yy // 17).astype(np.int64) * 12345)) % 241
    field_a = np.asarray(
        Image.fromarray(np.asarray(seed_a.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=6.5)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_b = np.asarray(
        Image.fromarray(np.asarray(seed_b.astype(np.float32) / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=4.2)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_c = np.asarray(
        Image.fromarray(np.asarray(seed_c.astype(np.float32) / 240.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=3.2)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    sweep = (
        np.sin((xx.astype(np.float32) * 0.37 + yy.astype(np.float32) * 0.23) / 31.0)
        + np.cos((xx.astype(np.float32) * 0.18 - yy.astype(np.float32) * 0.41) / 47.0)
    ) * 0.5

    target = pixels.copy()
    target[:, :, 0] = 146.0 + field_a * 86.0 + field_b * 38.0 + sweep * 18.0
    target[:, :, 1] = 106.0 + field_b * 58.0 + field_c * 28.0 + sweep * 12.0
    target[:, :, 2] = 42.0 + field_c * 42.0 + field_a * 14.0 - sweep * 6.0
    light = field_a * 42.0 + field_b * 24.0 + sweep * 14.0
    target[:, :, 0] += light * 0.86
    target[:, :, 1] += light * 0.64
    target[:, :, 2] += light * 0.28
    target[:, :, 0] = np.clip(target[:, :, 0], 96.0, 232.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 76.0, 174.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 8.0, 82.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.45)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.20)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = path & (target_luma > 178.0)
    if np.any(too_bright):
        scale = 178.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 0] = np.maximum(target[too_bright, 0], target[too_bright, 2] * 1.45)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.20)

    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def diversify_formal_path_palette(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 95.0)
        & (green > 75.0)
        & (blue < 85.0)
        & (red > blue * 1.35)
        & (green > blue * 1.15)
        & (luma > 58.0)
        & (luma < 188.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    xi = xx.astype(np.int64)
    yi = yy.astype(np.int64)
    hash_a = (
        (xi * 1597334677)
        ^ (yi * 3812015801)
        ^ ((xi + yi * 3) * 83492791)
        ^ ((xi * 5 - yi) * 297657976)
    ) & 0x7FFFFFFF
    hash_b = ((xi * 1103515245) ^ (yi * 12345) ^ (hash_a // 17)) & 0x7FFFFFFF
    field_a = np.asarray(
        Image.fromarray(np.asarray((hash_a % 257).astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=0.55)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    field_b = np.asarray(
        Image.fromarray(np.asarray((hash_b % 251).astype(np.float32) / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=1.15)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    sweep = (
        np.sin((xx.astype(np.float32) * 0.41 + yy.astype(np.float32) * 0.17) / 19.0)
        + np.cos((xx.astype(np.float32) * 0.13 - yy.astype(np.float32) * 0.37) / 23.0)
    ) * 0.5
    fine = ((hash_b % 257).astype(np.float32) / 256.0 - 0.5)
    target = pixels.copy()
    target[:, :, 0] = target[:, :, 0] + field_a * 58.0 + field_b * 34.0 + sweep * 20.0 + fine * 18.0
    target[:, :, 1] = target[:, :, 1] + field_b * 42.0 + field_a * 22.0 + sweep * 14.0 + fine * 11.0
    target[:, :, 2] = target[:, :, 2] + field_a * 16.0 - field_b * 8.0 - sweep * 4.0 + fine * 5.0
    target[:, :, 0] = np.clip(target[:, :, 0], 98.0, 222.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 78.0, 166.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 12.0, 74.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.46)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.22)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = path & (target_luma > 178.0)
    if np.any(too_bright):
        scale = 178.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 0] = np.maximum(target[too_bright, 0], target[too_bright, 2] * 1.46)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.22)

    local_field = np.clip(field_b + 0.5, 0.0, 1.0)
    local_strength = np.clip(strength * (0.72 + local_field * 0.42), 0.0, 0.68)
    pixels[path] = pixels[path] * (1.0 - local_strength[path, None]) + target[path] * local_strength[path, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def degrid_formal_path_surface(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    path = (
        (red > 95.0)
        & (green > 75.0)
        & (blue < 85.0)
        & (red > blue * 1.35)
        & (green > blue * 1.15)
    )
    if not np.any(path):
        return image.convert("RGB")

    smooth = np.asarray(image.convert("RGB").filter(ImageFilter.GaussianBlur(radius=0.52)), dtype=np.float32)
    pixels[path] = pixels[path] * (1.0 - strength) + smooth[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_formal_path_natural_grain(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 95.0)
        & (green > 75.0)
        & (blue < 85.0)
        & (red > blue * 1.35)
        & (green > blue * 1.15)
        & (luma > 58.0)
        & (luma < 188.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx.astype(np.int64) * 73856093)
        ^ (yy.astype(np.int64) * 19349663)
        ^ ((xx.astype(np.int64) - yy.astype(np.int64)) * 83492791))
        & 0x7FFFFFFF
    )
    fine = (seed % 257).astype(np.float32) / 256.0 - 0.5
    red_bins = (seed % 13).astype(np.float32)
    green_bins = ((seed // 13) % 11).astype(np.float32)
    blue_bins = ((seed // 31) % 8).astype(np.float32)
    pebble = path & (((seed % 127) < 8) | (((xx * 5 + yy * 7) % 97) < 4))
    target = pixels.copy()
    target[:, :, 0] = np.clip(100.0 + red_bins * 9.0 + fine * 28.0, 96.0, 222.0)
    target[:, :, 1] = np.clip(76.0 + green_bins * 8.0 + fine * 18.0, 76.0, 166.0)
    target[:, :, 2] = np.clip(12.0 + blue_bins * 7.0 + fine * 6.0, 12.0, 74.0)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    desired_luma = 114.0 + (((seed // 97) % 7).astype(np.float32) - 3.0) * 1.8
    scale = desired_luma / np.maximum(target_luma, 1.0)
    target[:, :, 0] = np.clip(target[:, :, 0] * scale, 96.0, 222.0)
    target[:, :, 1] = np.clip(target[:, :, 1] * scale, 76.0, 166.0)
    target[:, :, 2] = np.clip(target[:, :, 2] * scale, 12.0, 74.0)
    if np.any(pebble):
        target[pebble, 0] = np.clip(target[pebble, 0] * 0.82, 90.0, 168.0)
        target[pebble, 1] = np.clip(target[pebble, 1] * 0.84, 72.0, 132.0)
        target[pebble, 2] = np.clip(target[pebble, 2] * 0.72, 12.0, 58.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.44)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.22)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_path_broad_material_luma_contrast(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 84.0)
        & (green > 62.0)
        & (blue < 98.0)
        & (red > blue * 1.20)
        & (green > blue * 1.03)
        & (luma > 48.0)
        & (luma < 196.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx // 34).astype(np.int64) * 1597334677)
        ^ ((yy // 30).astype(np.int64) * 3812015801)
        ^ (((xx + yy) // 42).astype(np.int64) * 73856093)
    ) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=14.0)
        ),
        dtype=np.float32,
    ) / 255.0
    field = field - float(field[path].mean())
    field_std = float(field[path].std())
    if field_std > 0.0001:
        field = field / field_std
    field = np.clip(field, -1.55, 1.55)

    shift = field * 21.0 * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + shift * 1.10, 86.0, 202.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + shift * 0.82, 68.0, 158.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + shift * 0.26, 14.0, 76.0)

    shadow = path & (field < -0.72)
    if np.any(shadow):
        target[shadow, 0] = np.clip(target[shadow, 0] * 0.88, 78.0, 164.0)
        target[shadow, 1] = np.clip(target[shadow, 1] * 0.88, 62.0, 132.0)
        target[shadow, 2] = np.clip(target[shadow, 2] * 0.82, 12.0, 58.0)

    highlight = path & (field > 0.78)
    if np.any(highlight):
        target[highlight, 0] = np.clip(target[highlight, 0] + 10.0, 102.0, 214.0)
        target[highlight, 1] = np.clip(target[highlight, 1] + 7.0, 78.0, 166.0)
        target[highlight, 2] = np.clip(target[highlight, 2] + 2.0, 16.0, 78.0)

    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.42)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.20)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_grass_broad_material_luma_contrast(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    grass = (green > red * 1.06) & (green > blue * 0.96) & (luma > 48.0) & (luma < 174.0)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx // 42).astype(np.int64) * 1103515245)
        ^ ((yy // 38).astype(np.int64) * 12345)
        ^ (((xx + yy) // 53).astype(np.int64) * 2654435761)
    ) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=18.0)
        ),
        dtype=np.float32,
    ) / 255.0
    field = field - float(field[grass].mean())
    field_std = float(field[grass].std())
    if field_std > 0.0001:
        field = field / field_std
    field = np.clip(field, -1.45, 1.45)

    shift = field * 14.0 * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + shift * 0.64, 26.0, 138.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + shift * 0.92, 72.0, 184.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + shift * 0.42, 20.0, 118.0)

    shadow = grass & (field < -0.78)
    if np.any(shadow):
        target[shadow, 0] = np.clip(target[shadow, 0] * 0.88, 24.0, 112.0)
        target[shadow, 1] = np.clip(target[shadow, 1] * 0.90, 66.0, 154.0)
        target[shadow, 2] = np.clip(target[shadow, 2] * 0.82, 18.0, 92.0)

    highlight = grass & (field > 0.82)
    if np.any(highlight):
        target[highlight, 0] = np.clip(target[highlight, 0] + 5.0, 32.0, 146.0)
        target[highlight, 1] = np.clip(target[highlight, 1] + 9.0, 82.0, 194.0)
        target[highlight, 2] = np.clip(target[highlight, 2] + 3.0, 22.0, 124.0)

    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.10)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.06)
    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def expand_formal_path_chroma_quantized_bins(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 95.0)
        & (green > 75.0)
        & (blue < 85.0)
        & (red > blue * 1.35)
        & (green > blue * 1.15)
        & (luma_values > 58.0)
        & (luma_values < 188.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx.astype(np.int64) * 2654435761)
        ^ (yy.astype(np.int64) * 2246822519)
        ^ ((xx.astype(np.int64) + yy.astype(np.int64)) * 3266489917))
        & 0x7FFFFFFF
    )

    red_bin = 6 + (seed % 9).astype(np.float32)
    green_bin = 5 + ((seed // 11) % 8).astype(np.float32)
    blue_bin = 2 + ((seed // 37) % 4).astype(np.float32)

    target = pixels.copy()
    target[:, :, 0] = red_bin * 16.0 + 8.0 + ((seed // 101) % 7).astype(np.float32)
    target[:, :, 1] = green_bin * 16.0 + 4.0 + ((seed // 131) % 7).astype(np.float32)
    target[:, :, 2] = blue_bin * 16.0 + 6.0 + ((seed // 173) % 5).astype(np.float32)

    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.28)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.12)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 1] * 1.01)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    luma_delta = luma_values - target_luma
    target[:, :, 0] = np.clip(target[:, :, 0] + luma_delta * 0.58, 92.0, 218.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + luma_delta * 0.54, 76.0, 190.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + luma_delta * 0.24, 26.0, 84.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.28)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.12)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 1] * 1.01)

    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def normalize_formal_path_to_earth_tone(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 90.0)
        & (green > 68.0)
        & (blue < 96.0)
        & (red > blue * 1.20)
        & (green > blue * 1.06)
        & (luma_values > 54.0)
        & (luma_values < 196.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx // 14).astype(np.int64) * 1597334677)
        ^ ((yy // 16).astype(np.int64) * 3812015801)
        ^ (((xx + yy) // 31).astype(np.int64) * 73856093)
    ) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=5.5)
        ),
        dtype=np.float32,
    ) / 255.0
    fine = (
        (((xx * 17 + yy * 11) % 53).astype(np.float32) / 52.0 - 0.5)
        + (((xx * 5 - yy * 19) % 47).astype(np.float32) / 46.0 - 0.5)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(118.0 + field * 34.0 + fine * 18.0, 96.0, 174.0)
    target[:, :, 1] = np.clip(94.0 + field * 26.0 + fine * 12.0, 76.0, 142.0)
    target[:, :, 2] = np.clip(48.0 + field * 18.0 + fine * 8.0, 30.0, 84.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.42)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.20)

    dark_patch = path & (luma_values < 82.0)
    if np.any(dark_patch):
        target[dark_patch, 0] = np.clip(target[dark_patch, 0] + 18.0, 108.0, 178.0)
        target[dark_patch, 1] = np.clip(target[dark_patch, 1] + 15.0, 86.0, 146.0)
        target[dark_patch, 2] = np.clip(target[dark_patch, 2] + 6.0, 36.0, 88.0)

    hot_orange = path & (red > green * 1.34)
    if np.any(hot_orange):
        target[hot_orange, 0] = np.clip(target[hot_orange, 0] * 0.88, 96.0, 160.0)
        target[hot_orange, 1] = np.clip(target[hot_orange, 1] * 1.05, 82.0, 148.0)
        target[hot_orange, 2] = np.clip(target[hot_orange, 2] * 1.10, 36.0, 88.0)

    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def blend_reference_path_surface_from_baseline(
    image: Image.Image, reference_image: Image.Image, *, strength: float
) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 86.0)
        & (green > 62.0)
        & (blue < 104.0)
        & (red > blue * 1.16)
        & (green > blue * 1.02)
        & (luma_values > 48.0)
        & (luma_values < 202.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    ref = np.asarray(reference_image.convert("RGB"), dtype=np.float32)
    rr = ref[:, :, 0]
    rg = ref[:, :, 1]
    rb = ref[:, :, 2]
    ref_luma = rr * 0.299 + rg * 0.587 + rb * 0.114
    road_ref = (
        (rr > 86.0)
        & (rg > 58.0)
        & (rb < 92.0)
        & (rr > rg * 1.04)
        & (rg > rb * 1.28)
        & (ref_luma > 62.0)
        & (ref_luma < 184.0)
    )
    road_pixels = ref[road_ref]
    if road_pixels.size == 0:
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx.astype(np.int64) * 1103515245)
        ^ (yy.astype(np.int64) * 12345)
        ^ ((xx.astype(np.int64) + yy.astype(np.int64)) * 2654435761))
        & 0x7FFFFFFF
    )
    choice = seed % int(road_pixels.shape[0])
    sampled = road_pixels[choice]
    grain = (
        (((xx * 17 + yy * 7) % 41).astype(np.float32) / 40.0 - 0.5)
        + (((xx * 3 - yy * 13) % 37).astype(np.float32) / 36.0 - 0.5)
    ) * 0.5
    target = sampled.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + grain * 18.0, 92.0, 178.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + grain * 12.0, 68.0, 150.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + grain * 7.0, 24.0, 88.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.34)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.16)
    local = np.clip(strength + grain * 0.10, 0.0, 1.0)
    pixels[path] = pixels[path] * (1.0 - local[path, None]) + target[path] * local[path, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def add_formal_path_earth_grain(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 90.0)
        & (green > 68.0)
        & (blue < 96.0)
        & (red > blue * 1.20)
        & (green > blue * 1.06)
        & (luma_values > 54.0)
        & (luma_values < 196.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx.astype(np.int64) * 1103515245)
        ^ (yy.astype(np.int64) * 12345)
        ^ ((xx.astype(np.int64) - yy.astype(np.int64)) * 2654435761))
        & 0x7FFFFFFF
    )
    small = (seed % 257).astype(np.float32) / 256.0 - 0.5
    pebble = path & (((seed % 149) < 10) | (((xx * 7 + yy * 11) % 113) < 5))
    target = pixels.copy()
    red_step = ((seed % 11).astype(np.float32) - 5.0) * 3.2
    green_step = (((seed // 11) % 9).astype(np.float32) - 4.0) * 2.9
    blue_step = (((seed // 37) % 7).astype(np.float32) - 3.0) * 2.4
    target[:, :, 0] = np.clip(target[:, :, 0] + red_step + small * 18.0, 96.0, 178.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + green_step + small * 13.0, 74.0, 148.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + blue_step + small * 8.0, 28.0, 88.0)
    if np.any(pebble):
        target[pebble, 0] = np.clip(target[pebble, 0] * 0.86, 88.0, 154.0)
        target[pebble, 1] = np.clip(target[pebble, 1] * 0.88, 68.0, 128.0)
        target[pebble, 2] = np.clip(target[pebble, 2] * 0.82, 24.0, 72.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.38)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.18)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def blend_formal_path_packed_soil_breakup(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 86.0)
        & (green > 66.0)
        & (blue < 98.0)
        & (red > blue * 1.12)
        & (green > blue * 1.02)
        & (luma_values > 58.0)
        & (luma_values < 202.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width))
    seed = (
        ((xx // 11).astype(np.int64) * 1597334677)
        ^ ((yy // 13).astype(np.int64) * 3812015801)
        ^ (((xx * 5 + yy * 3) // 29).astype(np.int64) * 73856093)
    ) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=3.4)
        ),
        dtype=np.float32,
    ) / 255.0
    worn = path & (field > 0.18)
    if not np.any(worn):
        return image.convert("RGB")

    xf = xx.astype(np.float32)
    yf = yy.astype(np.float32)
    grain = (
        np.sin((xf * 0.23 + yf * 0.41) / 9.0)
        + np.cos((xf * 0.37 - yf * 0.17) / 13.0)
        + np.sin((xf * 0.11 + yf * 0.19) / 5.0)
    ) / 3.0
    local = np.power(np.clip((field - 0.18) / 0.66, 0.0, 1.0), 0.72) * strength
    target = pixels.copy()
    target[:, :, 0] = np.clip(82.0 + field * 30.0 + grain * 14.0, 76.0, 132.0)
    target[:, :, 1] = np.clip(80.0 + field * 28.0 + grain * 13.0, 72.0, 128.0)
    target[:, :, 2] = np.clip(62.0 + field * 20.0 + grain * 10.0, 48.0, 96.0)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_dark = worn & (target_luma < 86.0)
    if np.any(too_dark):
        lift = 86.0 / np.maximum(target_luma, 1.0)
        target[too_dark, 0] *= lift[too_dark]
        target[too_dark, 1] *= lift[too_dark]
        target[too_dark, 2] *= lift[too_dark]
    pixels[worn] = pixels[worn] * (1.0 - local[worn, None]) + target[worn] * local[worn, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def repair_formal_path_black_crater_pixels_only(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    crater = (luma_values < 58.0) & (red < 82.0) & (green < 78.0) & (blue < 70.0)
    if not np.any(crater):
        return image.convert("RGB")

    height, width = luma_values.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    grain = (
        np.sin((xx * 0.37 + yy * 0.13) / 11.0)
        + np.cos((xx * 0.19 - yy * 0.41) / 17.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(88.0 + grain * 8.0, 82.0, 102.0)
    target[:, :, 1] = np.clip(62.0 + grain * 6.0, 56.0, 74.0)
    target[:, :, 2] = np.clip(38.0 + grain * 4.0, 32.0, 50.0)
    pixels[crater] = pixels[crater] * (1.0 - strength) + target[crater] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def break_formal_path_visual_mass(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    path = (
        (red > 95.0)
        & (green > 75.0)
        & (blue < 85.0)
        & (red > blue * 1.35)
        & (green > blue * 1.15)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = red.shape
    yy, xx = np.indices((height, width))
    seed = (((xx // 18).astype(np.int64) * 1597334677) ^ ((yy // 16).astype(np.int64) * 3812015801)) % 257
    field = np.asarray(
        Image.fromarray(np.asarray(seed.astype(np.float32) / 256.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=6.0)
        ),
        dtype=np.float32,
    ) / 255.0
    gravel = path & (field > 0.50)
    if not np.any(gravel):
        return image.convert("RGB")

    local = np.clip((field - 0.50) / 0.34, 0.0, 1.0) * strength
    sweep = (
        np.sin((xx.astype(np.float32) * 0.27 + yy.astype(np.float32) * 0.17) / 17.0)
        + np.cos((xx.astype(np.float32) * 0.11 - yy.astype(np.float32) * 0.33) / 23.0)
    ) * 0.5
    target = pixels.copy()
    target[:, :, 0] = np.clip(96.0 + field * 34.0 + sweep * 10.0, 86.0, 148.0)
    target[:, :, 1] = np.clip(62.0 + field * 18.0 + sweep * 6.0, 56.0, 84.0)
    target[:, :, 2] = np.clip(32.0 + field * 12.0 + sweep * 4.0, 24.0, 58.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 1] * 1.24)
    pixels[gravel] = pixels[gravel] * (1.0 - local[gravel, None]) + target[gravel] * local[gravel, None]
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def reduce_path_formal_visual_coverage_with_gravel(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 92.0)
        & (green > 70.0)
        & (blue < 92.0)
        & (red > blue * 1.24)
        & (green > blue * 1.08)
        & (luma > 58.0)
        & (luma < 190.0)
    )
    if not np.any(path):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    field = (
        np.sin((xx.astype(np.float32) * 0.17 + yy.astype(np.float32) * 0.11) / 17.0)
        + np.cos((xx.astype(np.float32) * 0.09 - yy.astype(np.float32) * 0.14) / 23.0)
        + np.sin((xx.astype(np.float32) * 0.23 + yy.astype(np.float32) * 0.31) / 31.0)
    )
    field = (field - float(field.min())) / max(float(field.max() - field.min()), 1e-6)
    field = np.asarray(
        Image.fromarray(np.asarray(field * 255.0, dtype=np.uint8), "L").filter(ImageFilter.GaussianBlur(radius=3.2)),
        dtype=np.float32,
    ) / 255.0
    gravel = path & (field > 0.15)
    if not np.any(gravel):
        return image.convert("RGB")

    soft = np.clip((field - 0.15) / 0.34, 0.0, 1.0) * strength
    target = pixels.copy()
    sweep = np.sin((xx.astype(np.float32) * 0.19 - yy.astype(np.float32) * 0.07) / 11.0) * 0.5 + 0.5
    target[:, :, 0] = np.clip(120.0 + (field - 0.5) * 36.0 + sweep * 8.0, 104.0, 166.0)
    target[:, :, 1] = np.clip(100.0 + (field - 0.5) * 32.0 + sweep * 7.0, 88.0, 146.0)
    target[:, :, 2] = np.clip(90.0 + (field - 0.5) * 12.0 + sweep * 5.0, 88.0, 104.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.14)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    target[:, :, 1] = np.minimum(target[:, :, 1], target[:, :, 0] * 0.99)
    local = soft[gravel, None]
    pixels[gravel] = pixels[gravel] * (1.0 - local) + target[gravel] * local
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def settle_path_hot_orange_artifacts(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path_like = (
        (red > 100.0)
        & (green > 62.0)
        & (blue < 96.0)
        & (red > blue * 1.18)
        & (green > blue * 0.94)
        & (luma > 54.0)
        & (luma < 190.0)
    )
    hot_orange = path_like & (red > green * 1.20) & (red > 132.0) & (green > 72.0) & (blue < 74.0)
    if not np.any(hot_orange):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    field = np.sin((xx * 0.21 + yy * 0.17) / 15.0) * 0.5 + np.cos((xx * 0.13 - yy * 0.19) / 21.0) * 0.5
    field = (field - float(field.min())) / max(float(field.max() - field.min()), 1e-6)
    target = pixels.copy()
    target[:, :, 0] = np.clip(136.0 + (field - 0.5) * 36.0, 112.0, 166.0)
    target[:, :, 1] = np.clip(88.0 + (field - 0.5) * 8.0, 82.0, 98.0)
    target[:, :, 2] = np.clip(84.0 + (field - 0.5) * 10.0, 78.0, 94.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.42)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.01)
    target[:, :, 1] = np.minimum(target[:, :, 1], target[:, :, 2] * 1.07)
    local = np.clip(strength * (0.62 + field * 0.24), 0.0, 1.0)
    pixels[hot_orange] = pixels[hot_orange] * (1.0 - local[hot_orange, None]) + target[hot_orange] * local[
        hot_orange, None
    ]
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


def lift_path_material_variance_floor(image: Image.Image, *, strength: float) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    surface = (
        (luma > 34.0)
        & (luma < 210.0)
        & (red > 62.0)
        & (green > 44.0)
        & (blue < 116.0)
        & (red > blue * 1.10)
        & (green > blue * 0.92)
    )
    if not np.any(surface):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad_seed = ((xx * 17 + yy * 29 + (xx // 19) * 31 + (yy // 23) * 13) % 257).astype(np.float32)
    broad_image = Image.fromarray(np.asarray(broad_seed / 256.0 * 255.0, dtype=np.uint8), "L")
    broad = np.asarray(broad_image.filter(ImageFilter.GaussianBlur(radius=5.2)), dtype=np.float32) / 255.0 - 0.5
    mid_seed = ((xx * 41 - yy * 23 + (xx // 5) * 7) % 223).astype(np.float32)
    mid_image = Image.fromarray(np.asarray(mid_seed / 222.0 * 255.0, dtype=np.uint8), "L")
    mid = np.asarray(mid_image.filter(ImageFilter.GaussianBlur(radius=1.5)), dtype=np.float32) / 255.0 - 0.5
    warm = (((xx * 11 + yy * 3) % 149) / 148.0 - 0.5).astype(np.float32)
    fine_hash = ((xx.astype(np.int64) * 1103515245) ^ (yy.astype(np.int64) * 12345)) % 251

    target = pixels.copy()
    target[:, :, 0] = 132.0 + broad * 72.0 + mid * 30.0 + warm * 14.0
    target[:, :, 1] = 96.0 + broad * 48.0 + mid * 21.0 + warm * 9.0
    target[:, :, 2] = 48.0 + broad * 18.0 + mid * 8.0 - warm * 4.0

    worn = surface & (fine_hash < 8)
    compact = surface & (fine_hash > 241)
    if np.any(worn):
        target[worn, 0] = np.clip(target[worn, 0] + 20.0, 118.0, 206.0)
        target[worn, 1] = np.clip(target[worn, 1] + 12.0, 86.0, 156.0)
        target[worn, 2] = np.clip(target[worn, 2] + 3.0, 34.0, 78.0)
    if np.any(compact):
        target[compact, 0] = np.clip(target[compact, 0] - 20.0, 92.0, 168.0)
        target[compact, 1] = np.clip(target[compact, 1] - 14.0, 68.0, 132.0)
        target[compact, 2] = np.clip(target[compact, 2] - 8.0, 28.0, 70.0)

    target[:, :, 0] = np.clip(target[:, :, 0], 94.0, 206.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 68.0, 156.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 28.0, 82.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.42)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.18)

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


def enrich_path_game_surface_detail(image: Image.Image, *, strength: float) -> Image.Image:
    source = image.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    path = luma > 8.0
    if not np.any(path):
        return source

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad_seed = ((xx * 23 + yy * 31 + (xx // 9) * 43 + (yy // 11) * 17) % 251).astype(np.float32)
    mid_seed = (((xx // 3) * 73856093 ^ ((yy // 3) * 19349663)) % 241).astype(np.float32)
    fine_seed = ((xx.astype(np.int64) * 1597334677) ^ (yy.astype(np.int64) * 3812015801)) % 257
    broad = np.asarray(
        Image.fromarray(np.asarray(broad_seed / 250.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=3.2)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    mid = np.asarray(
        Image.fromarray(np.asarray(mid_seed / 240.0 * 255.0, dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=0.95)
        ),
        dtype=np.float32,
    ) / 255.0 - 0.5
    fine = fine_seed.astype(np.float32) / 256.0 - 0.5
    fine_alt = (((xx * 41 + yy * 17) % 211) / 210.0 - 0.5).astype(np.float32)
    detail = broad * 108.0 + mid * 46.0 + fine * 12.0

    target = pixels.copy()
    target[:, :, 0] = np.clip(132.0 + detail * 0.92 + fine_alt * 10.0, 72.0, 218.0)
    target[:, :, 1] = np.clip(94.0 + detail * 0.66 + fine_alt * 7.0, 48.0, 172.0)
    target[:, :, 2] = np.clip(46.0 + detail * 0.30 - fine_alt * 4.0, 22.0, 96.0)

    pebble = path & ((fine_seed < 4) | (((xx * 7 - yy * 19) % 181) < 2))
    if np.any(pebble):
        target[pebble, 0] = np.clip(target[pebble, 0] * 0.68, 68.0, 132.0)
        target[pebble, 1] = np.clip(target[pebble, 1] * 0.66, 48.0, 104.0)
        target[pebble, 2] = np.clip(target[pebble, 2] * 0.62, 24.0, 66.0)

    dust = path & (fine_seed > 239) & (mid > 0.02)
    if np.any(dust):
        target[dust, 0] = np.clip(target[dust, 0] + 26.0, 118.0, 214.0)
        target[dust, 1] = np.clip(target[dust, 1] + 17.0, 86.0, 166.0)
        target[dust, 2] = np.clip(target[dust, 2] + 5.0, 36.0, 92.0)

    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
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


def consolidate_grass_material_surface(
    image: Image.Image,
    reference: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    output = image.convert("RGB")
    reference = reference.convert("RGB").resize(output.size, Image.Resampling.BICUBIC)
    pixels = np.asarray(output, dtype=np.float32)
    reference_pixels = np.asarray(reference, dtype=np.float32)
    output_mask = detect_grass_surface_pixels(pixels)
    reference_mask = detect_grass_surface_pixels(reference_pixels)

    source_chunks = []
    if np.count_nonzero(output_mask) >= 256:
        source_chunks.append(pixels[output_mask])
    if np.count_nonzero(reference_mask) >= 256:
        source_chunks.append(reference_pixels[reference_mask])
    if not source_chunks:
        return output

    grass_palette = np.concatenate(source_chunks, axis=0)
    median_color = np.median(grass_palette, axis=0)
    median_color = np.clip(median_color, np.array([34.0, 82.0, 28.0]), np.array([128.0, 174.0, 112.0]))
    reference_surface = fill_grass_surface_from_mask(reference_pixels, reference_mask, median_color)
    output_surface = fill_grass_surface_from_mask(pixels, output_mask, median_color)
    target = reference_surface * 0.70 + output_surface * 0.18 + median_color[None, None, :] * 0.12

    ref_luma = reference_pixels[:, :, 0] * 0.299 + reference_pixels[:, :, 1] * 0.587 + reference_pixels[:, :, 2] * 0.114
    ref_blur = np.asarray(
        Image.fromarray(np.asarray(np.clip(ref_luma, 0, 255), dtype=np.uint8), "L")
        .filter(ImageFilter.GaussianBlur(radius=2.0)),
        dtype=np.float32,
    )
    detail = np.clip(ref_luma - ref_blur, -24.0, 24.0)
    target[:, :, 0] += detail * 0.18
    target[:, :, 1] += detail * 0.34
    target[:, :, 2] += detail * 0.12

    target_image = Image.fromarray(np.asarray(np.clip(target, 0, 255), dtype=np.uint8), "RGB")
    target_image = ImageEnhance.Contrast(target_image).enhance(1.12)
    target_image = target_image.filter(ImageFilter.UnsharpMask(radius=0.28, percent=86, threshold=2))
    target = np.asarray(target_image, dtype=np.float32)
    target = normalize_formal_grass_identity(target)

    base_mask = output_mask
    if np.count_nonzero(base_mask) < pixels.shape[0] * pixels.shape[1] * 0.35:
        base_mask = np.ones(pixels.shape[:2], dtype=bool)
    pixels[base_mask] = pixels[base_mask] * (1.0 - strength) + target[base_mask] * strength
    pixels = normalize_formal_grass_identity(pixels)
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def fill_grass_surface_from_mask(
    pixels: np.ndarray,
    mask: np.ndarray,
    fallback_color: np.ndarray,
) -> np.ndarray:
    if np.count_nonzero(mask) < 256:
        return np.broadcast_to(fallback_color[None, None, :], pixels.shape).copy()
    height, width, _ = pixels.shape
    mask_float = mask.astype(np.float32)
    filled = np.zeros_like(pixels, dtype=np.float32)
    filled_mask = np.zeros((height, width), dtype=bool)
    radii = (1.2, 2.6, 5.2, 10.4, 20.8, 41.6, 72.0)
    mask_image = Image.fromarray(np.asarray(mask_float * 255.0, dtype=np.uint8), "L")
    for radius in radii:
        weights = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32) / 255.0
        update = (~filled_mask) & (weights > 0.006)
        if not np.any(update):
            continue
        safe_weights = np.maximum(weights, 0.0001)
        for channel in range(3):
            channel_source = pixels[:, :, channel] * mask_float
            channel_image = Image.fromarray(
                np.asarray(np.clip(channel_source, 0, 255), dtype=np.uint8),
                "L",
            )
            blurred = np.asarray(channel_image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)
            filled[:, :, channel][update] = blurred[update] / safe_weights[update]
        filled_mask[update] = True
        if np.all(filled_mask):
            break
    if not np.all(filled_mask):
        filled[~filled_mask] = fallback_color
    filled[mask] = pixels[mask] * 0.68 + filled[mask] * 0.32
    return filled


def detect_grass_surface_pixels(pixels: np.ndarray) -> np.ndarray:
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
    return (
        (green > red * 1.04)
        & (green > blue * 0.96)
        & (green > 64.0)
        & (luma > 46.0)
        & (luma < 178.0)
        & (saturation > 18.0)
    )


def normalize_formal_grass_identity(pixels: np.ndarray) -> np.ndarray:
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0], 24.0, 154.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 16.0, 126.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 76.0, 198.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.11)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    too_bright = target_luma > 166.0
    if np.any(too_bright):
        scale = 166.0 / np.maximum(target_luma, 1.0)
        target[too_bright, 0] *= scale[too_bright]
        target[too_bright, 1] *= scale[too_bright]
        target[too_bright, 2] *= scale[too_bright]
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 0] * 1.11)
        target[too_bright, 1] = np.maximum(target[too_bright, 1], target[too_bright, 2] * 1.04)
    return target


def suppress_grass_material_cross_contamination(
    image: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])

    grass = detect_grass_surface_pixels(pixels)
    water_like = (
        (blue > green * 0.88)
        & (blue > red * 1.06)
        & (green > 62.0)
        & (luma_values > 46.0)
        & (luma_values < 190.0)
    )
    path_like = (
        (red > blue * 1.28)
        & (green > blue * 1.08)
        & (red >= green * 0.84)
        & (green <= red * 1.08)
        & (luma_values > 52.0)
        & (luma_values < 196.0)
    )
    pale_paste = (luma_values > 126.0) & (saturation < 54.0)
    dark_object = (luma_values < 58.0) & (saturation > 28.0)
    contaminant = water_like | path_like | pale_paste | dark_object
    if not np.any(contaminant):
        return image.convert("RGB")

    clean_grass = grass & ~contaminant
    fallback = np.array([58.0, 124.0, 48.0], dtype=np.float32)
    if np.count_nonzero(clean_grass) >= 96:
        clean_values = pixels[clean_grass]
        fallback = np.median(clean_values, axis=0)
        fallback = np.clip(fallback, np.array([34.0, 84.0, 28.0]), np.array([124.0, 168.0, 104.0]))
    grass_surface = fill_grass_surface_from_mask(pixels, clean_grass, fallback)
    repaired = normalize_formal_grass_identity(grass_surface)

    height, width = contaminant.shape
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    field = (
        np.sin((x * 0.21 + y * 0.11) / 9.0)
        + np.cos((x * 0.13 - y * 0.19) / 13.0)
    ) * 0.5
    repaired[:, :, 0] += field * 7.0
    repaired[:, :, 1] += field * 9.0
    repaired[:, :, 2] += field * 4.0
    repaired = normalize_formal_grass_identity(repaired)

    blend_mask = np.asarray(
        Image.fromarray(np.asarray(contaminant.astype(np.uint8) * 255, dtype=np.uint8), "L")
        .filter(ImageFilter.GaussianBlur(radius=1.4)),
        dtype=np.float32,
    ) / 255.0
    blend_mask = np.clip(blend_mask * strength, 0.0, 1.0)
    output = pixels * (1.0 - blend_mask[:, :, None]) + repaired * blend_mask[:, :, None]
    return Image.fromarray(np.asarray(np.clip(output, 0, 255), dtype=np.uint8), "RGB")


def recover_grass_texture_after_purity_filter(
    image: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    saturation = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
    grass = detect_grass_surface_pixels(pixels)
    if not np.any(grass):
        return image.convert("RGB")

    height, width = luma.shape
    yy, xx = np.indices((height, width))
    broad = (
        np.sin((xx * 0.17 + yy * 0.11) / 7.0)
        + np.cos((xx * 0.09 - yy * 0.19) / 9.0)
    ) * 0.5
    micro = (((xx * 37 + yy * 57 + (xx // 2) * 19 + (yy // 3) * 23) % 113) / 112.0 - 0.5)
    palette_tick = (((xx * 71 - yy * 43 + (xx // 5) * 31 + (yy // 7) * 17) % 127) / 126.0 - 0.5)
    blade = grass & ((((xx * 13 + yy * 29) % 97) < 9) | (((xx // 3 + yy * 7) % 89) < 5))
    soft_leaf = grass & ((((xx * 31 - yy * 17) % 157) < 7) | (((xx * 5 + yy * 11) % 131) < 5))
    warm_fleck = grass & (((xx * 97 + yy * 53 + (xx // 4) * 11) % 211) < 5)
    cool_fleck = grass & (((xx * 83 - yy * 61 + (yy // 5) * 19) % 233) < 5)

    target = pixels.copy()
    target[:, :, 0] += broad * 7.0 + micro * 22.0 + palette_tick * 9.0
    target[:, :, 1] += broad * 10.0 + micro * 28.0 + palette_tick * 6.0
    target[:, :, 2] += broad * 5.0 + micro * 14.0 - palette_tick * 5.0

    if np.any(blade):
        target[blade, 0] = np.clip(target[blade, 0] * 0.90 + 5.0, 32.0, 140.0)
        target[blade, 1] = np.clip(target[blade, 1] * 0.96 + 10.0, 82.0, 184.0)
        target[blade, 2] = np.clip(target[blade, 2] * 0.92 + 8.0, 28.0, 112.0)
    if np.any(soft_leaf):
        target[soft_leaf, 0] = np.clip(target[soft_leaf, 0] + 8.0, 32.0, 146.0)
        target[soft_leaf, 1] = np.clip(target[soft_leaf, 1] + 13.0, 86.0, 190.0)
        target[soft_leaf, 2] = np.clip(target[soft_leaf, 2] + 7.0, 30.0, 116.0)
    if np.any(warm_fleck):
        target[warm_fleck, 0] = np.clip(target[warm_fleck, 0] + 18.0, 38.0, 150.0)
        target[warm_fleck, 1] = np.clip(target[warm_fleck, 1] + 12.0, 88.0, 192.0)
        target[warm_fleck, 2] = np.clip(target[warm_fleck, 2] + 8.0, 28.0, 118.0)
    if np.any(cool_fleck):
        target[cool_fleck, 0] = np.clip(target[cool_fleck, 0] - 4.0, 26.0, 138.0)
        target[cool_fleck, 1] = np.clip(target[cool_fleck, 1] + 9.0, 86.0, 190.0)
        target[cool_fleck, 2] = np.clip(target[cool_fleck, 2] + 18.0, 34.0, 124.0)

    dark_like = grass & (luma < 78.0) & (saturation > 45.0)
    if np.any(dark_like):
        target[dark_like, 0] = np.clip(target[dark_like, 0] + 9.0, 36.0, 146.0)
        target[dark_like, 1] = np.clip(target[dark_like, 1] + 13.0, 88.0, 190.0)
        target[dark_like, 2] = np.maximum(target[dark_like, 2], np.minimum(target[dark_like, 0] * 0.42, 66.0))

    target[:, :, 2] = np.maximum(target[:, :, 2], np.minimum(target[:, :, 0] * 0.22 + 18.0, 74.0))
    target[:, :, 0] = np.clip(target[:, :, 0], 26.0, 152.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 76.0, 198.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 20.0, 128.0)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 0] * 1.08)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)

    pixels[grass] = pixels[grass] * (1.0 - strength) + target[grass] * strength
    output = Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")
    output = output.filter(ImageFilter.UnsharpMask(radius=0.22, percent=148, threshold=1))
    return output


def inherit_path_reference_surface_detail(
    image: Image.Image,
    reference: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    output = image.convert("RGB")
    reference = reference.convert("RGB").resize(output.size, Image.Resampling.BICUBIC)
    pixels = np.asarray(output, dtype=np.float32)
    reference_pixels = np.asarray(reference, dtype=np.float32)
    ref_luma = (
        reference_pixels[:, :, 0] * 0.2126
        + reference_pixels[:, :, 1] * 0.7152
        + reference_pixels[:, :, 2] * 0.0722
    )
    ref_blur = np.asarray(
        Image.fromarray(np.asarray(np.clip(ref_luma, 0, 255), dtype=np.uint8), "L")
        .filter(ImageFilter.GaussianBlur(radius=3.0)),
        dtype=np.float32,
    )
    detail = np.clip(ref_luma - ref_blur, -22.0, 22.0)
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma_values = red * 0.299 + green * 0.587 + blue * 0.114
    path = (
        (red > 82.0)
        & (green > 54.0)
        & (blue < 104.0)
        & (red > blue * 1.16)
        & (green > blue * 0.94)
        & (luma_values > 54.0)
        & (luma_values < 190.0)
    )
    if not np.any(path):
        return output
    target = pixels.copy()
    target[:, :, 0] = np.clip(target[:, :, 0] + detail * 0.58, 76.0, 190.0)
    target[:, :, 1] = np.clip(target[:, :, 1] + detail * 0.42, 52.0, 154.0)
    target[:, :, 2] = np.clip(target[:, :, 2] + detail * 0.18, 28.0, 100.0)
    pixels[path] = pixels[path] * (1.0 - strength) + target[path] * strength
    return Image.fromarray(np.asarray(np.clip(pixels, 0, 255), dtype=np.uint8), "RGB")


def consolidate_path_material_surface(
    image: Image.Image,
    reference: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    output = image.convert("RGB")
    reference = reference.convert("RGB").resize(output.size, Image.Resampling.BICUBIC)
    pixels = np.asarray(output, dtype=np.float32)
    reference_pixels = np.asarray(reference, dtype=np.float32)
    output_mask = detect_path_surface_pixels(pixels)
    reference_mask = detect_path_surface_pixels(reference_pixels)

    source_chunks = []
    if np.count_nonzero(output_mask) >= 96:
        source_chunks.append(pixels[output_mask])
    if np.count_nonzero(reference_mask) >= 96:
        source_chunks.append(reference_pixels[reference_mask])
    if not source_chunks:
        return output

    path_palette = np.concatenate(source_chunks, axis=0)
    if path_palette.shape[0] < 96:
        return output

    median_color = np.median(path_palette, axis=0)
    median_color = np.clip(median_color, np.array([96.0, 72.0, 32.0]), np.array([184.0, 154.0, 92.0]))
    reference_surface = fill_path_surface_from_mask(reference_pixels, reference_mask, median_color)
    output_surface = fill_path_surface_from_mask(pixels, output_mask, median_color)
    target = reference_surface * 0.72 + output_surface * 0.18 + median_color[None, None, :] * 0.10
    target_image = Image.fromarray(np.asarray(np.clip(target, 0, 255), dtype=np.uint8), "RGB")
    target_image = ImageEnhance.Contrast(target_image).enhance(1.18)
    target = np.asarray(target_image.filter(ImageFilter.UnsharpMask(radius=0.36, percent=92, threshold=2)), dtype=np.float32)

    target[:, :, 0] = np.clip(target[:, :, 0], 76.0, 214.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 50.0, 176.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 24.0, 124.0)

    existing_path = output_mask
    non_path_strength = strength
    path_strength = min(0.92, strength + 0.10)
    mixed = pixels.copy()
    mixed[existing_path] = pixels[existing_path] * (1.0 - path_strength) + target[existing_path] * path_strength
    mixed[~existing_path] = pixels[~existing_path] * (1.0 - non_path_strength) + target[~existing_path] * non_path_strength
    mixed_image = Image.fromarray(np.asarray(np.clip(mixed, 0, 255), dtype=np.uint8), "RGB")
    mixed_image = soften_grid_artifacts(mixed_image, radius=0.28, blend=0.10)
    return expand_path_palette_density(mixed_image, strength=0.26)


def fill_path_surface_from_mask(
    pixels: np.ndarray,
    mask: np.ndarray,
    fallback_color: np.ndarray,
) -> np.ndarray:
    if np.count_nonzero(mask) < 96:
        return np.broadcast_to(fallback_color[None, None, :], pixels.shape).copy()
    height, width, _ = pixels.shape
    mask_float = mask.astype(np.float32)
    filled = np.zeros_like(pixels, dtype=np.float32)
    filled_mask = np.zeros((height, width), dtype=bool)
    radii = (1.4, 2.8, 5.6, 11.2, 22.4, 44.8, 72.0)
    mask_image = Image.fromarray(np.asarray(mask_float * 255.0, dtype=np.uint8), "L")
    for radius in radii:
        weights = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32) / 255.0
        update = (~filled_mask) & (weights > 0.006)
        if not np.any(update):
            continue
        safe_weights = np.maximum(weights, 0.0001)
        for channel in range(3):
            channel_source = pixels[:, :, channel] * mask_float
            channel_image = Image.fromarray(
                np.asarray(np.clip(channel_source, 0, 255), dtype=np.uint8),
                "L",
            )
            blurred = np.asarray(channel_image.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)
            filled[:, :, channel][update] = blurred[update] / safe_weights[update]
        filled_mask[update] = True
        if np.all(filled_mask):
            break
    if not np.all(filled_mask):
        filled[~filled_mask] = fallback_color
    filled[mask] = pixels[mask] * 0.74 + filled[mask] * 0.26
    return filled


def detect_path_surface_pixels(pixels: np.ndarray) -> np.ndarray:
    red = pixels[:, :, 0]
    green = pixels[:, :, 1]
    blue = pixels[:, :, 2]
    luma = red * 0.299 + green * 0.587 + blue * 0.114
    return (
        (red > 78.0)
        & (green > 48.0)
        & (blue < 120.0)
        & (red >= blue * 1.22)
        & (green >= blue * 1.02)
        & (red >= green * 0.88)
        & (green <= red * 1.04)
        & (luma > 54.0)
        & (luma < 194.0)
    )


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


def finalize_path_material_as_reference_dirt_road(
    image: Image.Image,
    reference: Image.Image,
    *,
    strength: float,
) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    reference_pixels = np.asarray(reference.convert("RGB").resize(image.size, Image.Resampling.BICUBIC), dtype=np.float32)
    reference_mask = detect_path_surface_pixels(reference_pixels)
    if np.count_nonzero(reference_mask) < 96:
        return image.convert("RGB")

    reference_palette = reference_pixels[reference_mask]
    median_color = np.median(reference_palette, axis=0)
    median_color = np.clip(median_color, np.array([112.0, 82.0, 38.0]), np.array([172.0, 132.0, 78.0]))
    dirt_base = median_color * 0.25 + np.array([136.0, 104.0, 58.0], dtype=np.float32) * 0.75

    height, width, _ = pixels.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    macro = (
        np.sin((xx * 0.09 + yy * 0.13) / 18.0)
        + np.cos((xx * 0.17 - yy * 0.07) / 27.0)
        + np.sin((xx * 0.05 + yy * 0.21) / 41.0)
    )
    macro = (macro - float(macro.min())) / max(float(macro.max() - macro.min()), 1e-6) - 0.5
    rng_seed = int((width * 1000003 + height * 9176 + 0x4D2C6B) & 0xFFFFFFFF)
    rng = np.random.default_rng(rng_seed)

    def smooth_noise(radius: float) -> np.ndarray:
        noise = rng.random((height, width), dtype=np.float32)
        image_noise = Image.fromarray(np.asarray(noise * 255.0, dtype=np.uint8), "L")
        values = np.asarray(image_noise.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)
        min_value = float(values.min())
        max_value = float(values.max())
        return (values - min_value) / max(max_value - min_value, 1e-6) - 0.5

    micro = smooth_noise(0.85)
    fine = smooth_noise(1.9)
    coarse = smooth_noise(6.5)
    hue_a = smooth_noise(2.7)
    hue_b = smooth_noise(3.4)
    hue_c = smooth_noise(4.2)
    cool_field = smooth_noise(5.0)
    grain_r = smooth_noise(0.38)
    grain_g = smooth_noise(0.44)
    grain_b = smooth_noise(0.50)
    pebble_seed = rng.random((height, width), dtype=np.float32)

    source_luma = pixels[:, :, 0] * 0.299 + pixels[:, :, 1] * 0.587 + pixels[:, :, 2] * 0.114
    source_blur = np.asarray(
        Image.fromarray(np.asarray(np.clip(source_luma, 0, 255), dtype=np.uint8), "L").filter(
            ImageFilter.GaussianBlur(radius=5.0)
        ),
        dtype=np.float32,
    )
    source_detail = np.clip(source_luma - source_blur, -32.0, 32.0)

    target = np.broadcast_to(dirt_base[None, None, :], pixels.shape).copy()
    target[:, :, 0] += macro * 52.0 + coarse * 34.0 + micro * 24.0 + fine * 24.0 + source_detail * 0.20
    target[:, :, 1] += macro * 38.0 + coarse * 25.0 + micro * 18.0 + fine * 17.0 + source_detail * 0.14
    target[:, :, 2] += macro * 15.0 + coarse * 15.0 + micro * 9.0 + fine * 8.0 + source_detail * 0.06
    target[:, :, 0] += hue_a * 30.0 + hue_b * 18.0
    target[:, :, 1] += hue_b * 24.0 - hue_c * 7.0 + coarse * 8.0
    target[:, :, 2] += hue_c * 24.0 + hue_a * 7.0
    target[:, :, 0] += grain_r * 18.0 + grain_b * 8.0
    target[:, :, 1] += grain_g * 15.0 + grain_r * 6.0
    target[:, :, 2] += grain_b * 10.0 + grain_g * 5.0

    pebble = (pebble_seed < 0.026) | ((smooth_noise(0.45) > 0.43) & (pebble_seed < 0.11))
    if np.any(pebble):
        target[pebble, 0] -= 24.0
        target[pebble, 1] -= 18.0
        target[pebble, 2] -= 8.0

    warm_dust = (macro > 0.22) | (fine > 0.44)
    if np.any(warm_dust):
        target[warm_dust, 0] += 16.0
        target[warm_dust, 1] += 9.0
        target[warm_dust, 2] -= 3.0

    target[:, :, 0] = np.clip(target[:, :, 0], 88.0, 220.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 70.0, 168.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 24.0, 84.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.38)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.18)
    target[:, :, 1] = np.minimum(target[:, :, 1], target[:, :, 0] * 0.96)

    gravel_strength = np.clip(
        (cool_field + 0.24) * 0.72
        + (hue_c + 0.18) * 0.30
        + (grain_b + 0.50) * 0.16
        + (0.20 - macro) * 0.10,
        0.0,
        0.58,
    )
    gravel_target = target.copy()
    gravel_target[:, :, 0] = np.clip(128.0 + macro * 38.0 + hue_a * 22.0 + grain_r * 20.0, 102.0, 182.0)
    gravel_target[:, :, 1] = np.clip(108.0 + macro * 30.0 + hue_b * 18.0 + grain_g * 17.0, 86.0, 150.0)
    gravel_target[:, :, 2] = np.clip(88.0 + macro * 12.0 + hue_c * 14.0 + grain_b * 13.0, 82.0, 106.0)
    target = target * (1.0 - gravel_strength[:, :, None]) + gravel_target * gravel_strength[:, :, None]

    target_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    luma_delta = np.clip(target_luma - float(target_luma.mean()), -46.0, 46.0) * 0.52
    target[:, :, 0] += luma_delta * 1.08
    target[:, :, 1] += luma_delta * 0.86
    target[:, :, 2] += luma_delta * 0.42
    target[:, :, 0] = np.clip(target[:, :, 0], 88.0, 222.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 70.0, 170.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 24.0, 116.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.16)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    target[:, :, 1] = np.minimum(target[:, :, 1], target[:, :, 0] * 0.99)
    target[:, :, 0] += grain_r * 14.0 + grain_b * 5.0
    target[:, :, 1] += grain_g * 11.0 + grain_r * 4.0
    target[:, :, 2] += grain_b * 8.0 + grain_g * 3.0
    target[:, :, 0] = np.clip(target[:, :, 0], 88.0, 222.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 70.0, 170.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 24.0, 108.0)
    target[:, :, 0] = np.maximum(target[:, :, 0], target[:, :, 2] * 1.16)
    target[:, :, 1] = np.maximum(target[:, :, 1], target[:, :, 2] * 1.04)
    target[:, :, 1] = np.minimum(target[:, :, 1], target[:, :, 0] * 0.99)

    stone_overlay = ((cool_field > -0.18) | (hue_c > 0.04) | (grain_b > 0.30)) & (macro < 0.46)
    if np.any(stone_overlay):
        stone_strength = np.clip(
            0.42 + (cool_field[stone_overlay] + 0.18) * 0.36 + (grain_b[stone_overlay] + 0.5) * 0.16,
            0.34,
            0.76,
        )
        stone_target = target.copy()
        stone_target[:, :, 2] = np.clip(108.0 + macro * 12.0 + hue_c * 12.0 + grain_b * 10.0, 98.0, 128.0)
        stone_target[:, :, 0] = np.clip(126.0 + macro * 28.0 + hue_a * 18.0 + grain_r * 16.0, 106.0, 152.0)
        stone_target[:, :, 1] = np.clip(112.0 + macro * 22.0 + hue_b * 16.0 + grain_g * 14.0, 94.0, 136.0)
        stone_target[:, :, 0] = np.minimum(stone_target[:, :, 0], stone_target[:, :, 2] * 1.24)
        stone_target[:, :, 1] = np.minimum(stone_target[:, :, 1], stone_target[:, :, 2] * 1.09)
        stone_target[:, :, 0] = np.maximum(stone_target[:, :, 0], stone_target[:, :, 1] * 1.02)
        target[stone_overlay] = (
            target[stone_overlay] * (1.0 - stone_strength[:, None])
            + stone_target[stone_overlay] * stone_strength[:, None]
        )
    recovery_field = macro * 0.60 + coarse * 0.44 + fine * 0.34 + grain_r * 0.24
    compact_path_boost = 1.88 if width < 350 or height < 320 else 1.08
    target[:, :, 0] += recovery_field * 42.0 * compact_path_boost
    target[:, :, 1] += recovery_field * 34.0 * compact_path_boost
    target[:, :, 2] += recovery_field * 20.0 * compact_path_boost
    painterly_luma = target[:, :, 0] * 0.299 + target[:, :, 1] * 0.587 + target[:, :, 2] * 0.114
    painterly_delta = np.clip(painterly_luma - float(painterly_luma.mean()), -42.0, 42.0) * 0.20
    target[:, :, 0] += painterly_delta * 1.04
    target[:, :, 1] += painterly_delta * 0.86
    target[:, :, 2] += painterly_delta * 0.56
    target[:, :, 0] = np.clip(target[:, :, 0], 88.0, 222.0)
    target[:, :, 1] = np.clip(target[:, :, 1], 70.0, 170.0)
    target[:, :, 2] = np.clip(target[:, :, 2], 24.0, 110.0)

    mixed = pixels * (1.0 - strength) + target * strength
    mixed_luma = mixed[:, :, 0] * 0.299 + mixed[:, :, 1] * 0.587 + mixed[:, :, 2] * 0.114
    formal_path = (
        (mixed[:, :, 0] > 95.0)
        & (mixed[:, :, 1] > 75.0)
        & (mixed[:, :, 2] < 85.0)
        & (mixed[:, :, 0] > mixed[:, :, 2] * 1.35)
        & (mixed[:, :, 1] > mixed[:, :, 2] * 1.15)
        & (mixed_luma > 58.0)
        & (mixed_luma < 188.0)
    )
    if np.any(formal_path):
        xi = xx.astype(np.int64)
        yi = yy.astype(np.int64)
        hash_a = (
            (xi * 1597334677)
            ^ (yi * 3812015801)
            ^ ((xi + yi * 3) * 83492791)
            ^ ((xi * 5 - yi) * 297657976)
        ) & 0x7FFFFFFF
        hash_b = ((xi * 1103515245) ^ (yi * 12345) ^ (hash_a // 17)) & 0x7FFFFFFF
        field_a = np.asarray(
            Image.fromarray(
                np.asarray((hash_a % 257).astype(np.float32) / 256.0 * 255.0, dtype=np.uint8),
                "L",
            ).filter(ImageFilter.GaussianBlur(radius=1.4)),
            dtype=np.float32,
        ) / 255.0 - 0.5
        field_b = np.asarray(
            Image.fromarray(
                np.asarray((hash_b % 251).astype(np.float32) / 250.0 * 255.0, dtype=np.uint8),
                "L",
            ).filter(ImageFilter.GaussianBlur(radius=2.6)),
            dtype=np.float32,
        ) / 255.0 - 0.5
        field_c = np.asarray(
            Image.fromarray(
                np.asarray(((hash_a // 31) % 241).astype(np.float32) / 240.0 * 255.0, dtype=np.uint8),
                "L",
            ).filter(ImageFilter.GaussianBlur(radius=0.85)),
            dtype=np.float32,
        ) / 255.0 - 0.5
        sweep = (
            np.sin((xx * 0.43 + yy * 0.19) / 21.0)
            + np.cos((xx * 0.16 - yy * 0.39) / 27.0)
        ) * 0.5
        fine_hash = ((hash_b % 193).astype(np.float32) / 192.0 - 0.5)
        soil_palette = mixed.copy()
        soil_palette[:, :, 0] = mixed[:, :, 0] + field_a * 46.0 + field_b * 28.0 + sweep * 16.0 + fine_hash * 10.0
        soil_palette[:, :, 1] = mixed[:, :, 1] + field_b * 36.0 + field_c * 22.0 + sweep * 11.0 + fine_hash * 7.0
        soil_palette[:, :, 2] = mixed[:, :, 2] + field_c * 20.0 + field_a * 9.0 - sweep * 5.0 + fine_hash * 5.0
        soil_palette[:, :, 0] = np.clip(soil_palette[:, :, 0], 98.0, 218.0)
        soil_palette[:, :, 1] = np.clip(soil_palette[:, :, 1], 76.0, 176.0)
        soil_palette[:, :, 2] = np.clip(soil_palette[:, :, 2], 24.0, 84.0)
        soil_palette[:, :, 0] = np.maximum(soil_palette[:, :, 0], soil_palette[:, :, 2] * 1.38)
        soil_palette[:, :, 1] = np.maximum(soil_palette[:, :, 1], soil_palette[:, :, 2] * 1.17)
        mixed[formal_path] = mixed[formal_path] * 0.64 + soil_palette[formal_path] * 0.36
        cell_hash = (
            (xi * 2654435761)
            ^ (yi * 2246822519)
            ^ ((xi + yi * 3) * 3266489917)
            ^ (((xi // 9) + (yi // 11) * 5) * 668265263)
        ) & 0x7FFFFFFF
        bin_lift_mask = formal_path & ((cell_hash % 997) < 390)
        if np.any(bin_lift_mask):
            red_bin = 6 + ((cell_hash // 7) % 9).astype(np.float32)
            green_bin = 5 + ((cell_hash // 31) % 8).astype(np.float32)
            blue_bin = ((cell_hash // 131) % 6).astype(np.float32)
            formal_bin_palette = mixed.copy()
            formal_bin_palette[:, :, 0] = red_bin * 16.0 + 8.0 + ((cell_hash // 17) % 5).astype(np.float32)
            formal_bin_palette[:, :, 1] = green_bin * 16.0 + 8.0 + ((cell_hash // 43) % 5).astype(np.float32)
            formal_bin_palette[:, :, 2] = blue_bin * 16.0 + 6.0 + ((cell_hash // 89) % 5).astype(np.float32)
            formal_bin_palette[:, :, 0] = np.clip(formal_bin_palette[:, :, 0], 104.0, 226.0)
            formal_bin_palette[:, :, 1] = np.clip(formal_bin_palette[:, :, 1], 82.0, 178.0)
            formal_bin_palette[:, :, 2] = np.clip(formal_bin_palette[:, :, 2], 24.0, 82.0)
            formal_bin_palette[:, :, 0] = np.maximum(
                formal_bin_palette[:, :, 0],
                formal_bin_palette[:, :, 2] * 1.42,
            )
            formal_bin_palette[:, :, 1] = np.maximum(
                formal_bin_palette[:, :, 1],
                formal_bin_palette[:, :, 2] * 1.18,
            )
            formal_bin_palette[:, :, 0] = np.maximum(
                formal_bin_palette[:, :, 0],
                formal_bin_palette[:, :, 1] * 1.02,
            )
            mixed[bin_lift_mask] = mixed[bin_lift_mask] * 0.45 + formal_bin_palette[bin_lift_mask] * 0.55
        soft_break_mask = formal_path & ((cell_hash % 997) >= 390) & ((cell_hash % 997) < 760)
        if np.any(soft_break_mask):
            soft_hash = (
                (xi * 374761393)
                ^ (yi * 668265263)
                ^ ((xi - yi * 7) * 2246822519)
                ^ (((xi // 13) - (yi // 17) * 3) * 3266489917)
            ) & 0x7FFFFFFF
            soft_field = np.asarray(
                Image.fromarray(
                    np.asarray((soft_hash % 253).astype(np.float32) / 252.0 * 255.0, dtype=np.uint8),
                    "L",
                ).filter(ImageFilter.GaussianBlur(radius=1.8)),
                dtype=np.float32,
            ) / 255.0 - 0.5
            taupe_palette = mixed.copy()
            taupe_palette[:, :, 0] = 124.0 + ((soft_hash // 11) % 30).astype(np.float32) + soft_field * 12.0
            taupe_palette[:, :, 1] = 105.0 + ((soft_hash // 37) % 28).astype(np.float32) + soft_field * 9.0
            taupe_palette[:, :, 2] = 88.0 + ((soft_hash // 97) % 18).astype(np.float32) + soft_field * 5.0
            taupe_palette[:, :, 0] = np.clip(taupe_palette[:, :, 0], 116.0, 166.0)
            taupe_palette[:, :, 1] = np.clip(taupe_palette[:, :, 1], 96.0, 146.0)
            taupe_palette[:, :, 2] = np.clip(taupe_palette[:, :, 2], 88.0, 112.0)
            taupe_palette[:, :, 0] = np.maximum(taupe_palette[:, :, 0], taupe_palette[:, :, 1] * 1.02)
            taupe_palette[:, :, 1] = np.minimum(taupe_palette[:, :, 1], taupe_palette[:, :, 0] * 1.04)
            mixed[soft_break_mask] = mixed[soft_break_mask] * 0.32 + taupe_palette[soft_break_mask] * 0.68
    return Image.fromarray(np.asarray(np.clip(mixed, 0, 255), dtype=np.uint8), "RGB")


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


def normalize_material_bright_border_to_inner(
    image: Image.Image,
    *,
    border: int,
    target_delta: float,
) -> Image.Image:
    pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
    height, width, _ = pixels.shape
    border = max(2, min(border, max(2, min(width, height) // 8)))
    if width <= border * 2 or height <= border * 2:
        return image.convert("RGB")

    border_mask = np.zeros((height, width), dtype=bool)
    border_mask[:border, :] = True
    border_mask[-border:, :] = True
    border_mask[:, :border] = True
    border_mask[:, -border:] = True

    inner_mask = ~border_mask
    inner = pixels[inner_mask]
    if inner.size == 0 or not np.any(border_mask):
        return image.convert("RGB")

    border_values = pixels[border_mask]
    border_luma = luma(border_values)
    inner_luma_mean = float(luma(inner.reshape(-1, 3)).mean())
    desired_border_luma = (inner_luma_mean / 255.0 + target_delta) * 255.0
    if float(border_luma.mean()) <= desired_border_luma:
        return image.convert("RGB")

    scale = np.minimum(1.0, desired_border_luma / np.maximum(border_luma, 1.0))
    border_values = border_values * scale[:, None]
    pixels[border_mask] = border_values
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


def build_material_reference_mosaic_image(
    slot: dict[str, Any],
    category: str,
    model_root: Path,
    style_profile: Path | None,
    reference_dataset_root: Path | None,
    *,
    width: int,
    height: int,
    tile_size: int,
) -> Image.Image | None:
    paths = resolve_reference_image_paths(slot, category, model_root, style_profile, reference_dataset_root)
    if not paths:
        return None
    seed_bytes = hashlib.sha256(
        f"{slot.get('slotId', category)}:{category}:reference-mosaic-v1".encode("utf8")
    ).digest()[:8]
    rng = np.random.default_rng(int.from_bytes(seed_bytes, "big"))
    mosaic = Image.new("RGB", (width, height))
    for y in range(0, height, tile_size):
        for x in range(0, width, tile_size):
            path = paths[int(rng.integers(0, len(paths)))]
            with Image.open(path) as image:
                source = image.convert("RGB")
            if bool(rng.integers(0, 2)):
                source = source.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if bool(rng.integers(0, 2)):
                source = source.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            if source.size != (tile_size, tile_size):
                source = source.resize((tile_size, tile_size), Image.Resampling.BICUBIC)
            mosaic.paste(source, (x, y))
    mosaic = mosaic.crop((0, 0, width, height))
    mosaic = soften_grid_seams(mosaic, grid_size=tile_size, radius=8)
    return soften_grid_artifacts(mosaic, radius=0.42, blend=0.18)


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
    strong = [sample_id for score, sample_id in sorted(scored, reverse=True) if score >= 1.55]
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
    blue_ratio = float(np.mean((blue > green * 0.88) & (blue > red * 1.06)))
    path_ratio = float(
        np.mean(
            (red > blue * 1.28)
            & (green > blue * 1.08)
            & (red >= green * 0.84)
            & (green <= red * 1.08)
            & (luma_values > 0.20)
            & (luma_values < 0.78)
        )
    )
    pale_ratio = float(np.mean((luma_values > 0.52) & ((np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])) < 0.16)))
    gray_ratio = float(np.mean(np.abs(red - green) < 0.05))
    green_ratio = float(np.mean((green > red * 1.05) & (green > blue * 1.05) & (luma_values > 0.25)))
    edge_score = float(np.mean(np.abs(np.diff(luma_values, axis=0))) + np.mean(np.abs(np.diff(luma_values, axis=1))))
    return (
        green_ratio * 2.2
        + bright_ratio * 0.45
        - dark_ratio * 2.2
        - blue_ratio * 4.8
        - path_ratio * 4.2
        - pale_ratio * 1.4
        - gray_ratio * 0.8
        - edge_score * 1.0
    )


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

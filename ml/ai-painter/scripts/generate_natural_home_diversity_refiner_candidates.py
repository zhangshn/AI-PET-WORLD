from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import math
from pathlib import Path
import shutil
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS
from ai_painter.runtime_retention import preserve_runtime_dir_before_clear
from ai_painter.training.dataset import image_tensor
from ai_painter.training.rgb_refiner_model import build_rgb_refiner
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


def main() -> int:
    parser = ArgumentParser(description="Render diverse natural-home candidates with the full-scene RGB refiner.")
    parser.add_argument("--dataset-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v25-diversity-generation/dataset"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v26-diversity-refiner-generation"))
    parser.add_argument("--structure-checkpoint", type=Path, default=Path(".runtime/ai-painter/natural-home-clean-structure-guided-training/best.pt"))
    parser.add_argument("--refiner-checkpoint", type=Path, default=Path(".runtime/ai-painter/natural-home-clean-direct-training/best.pt"))
    parser.add_argument("--schema-version", default="natural-home-diversity-refiner-generation-v26")
    parser.add_argument("--stage-id", default="natural-home-v26-diversity-refiner-generation")
    parser.add_argument("--training-version", default="training-rgb-refiner-natural-home-direct-v1-clean-multisample")
    parser.add_argument("--model-version", default="rgb-refiner-natural-home-unet-v4-direct-multisample")
    parser.add_argument("--sample-limit", type=int, default=6)
    parser.add_argument(
        "--selection-strategy",
        choices=("sorted", "diverse-source", "diverse-source-variants"),
        default="sorted",
        help=(
            "Choose candidate conditions. diverse-source spreads samples across source scenes; "
            "diverse-source-variants walks source scenes and variants for broader hidden candidate sweeps."
        ),
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    scene_root = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    sample_ids = select_sample_ids(scene_root, args.sample_limit, args.selection_strategy)
    if not sample_ids:
        raise ValueError(f"no diversity samples found: {scene_root}")
    if args.output_root.exists() and args.force:
        preserve_runtime_dir_before_clear(args.output_root, "generate-natural-home-diversity-refiner-candidates")
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    structure_state = torch.load(args.structure_checkpoint, map_location=device, weights_only=False)
    structure_model = build_structure_guided_unet(structure_state["config"]).to(device)
    structure_model.load_state_dict(structure_state["model"])
    structure_model.eval()
    refiner_state = torch.load(args.refiner_checkpoint, map_location=device, weights_only=False)
    refiner = build_rgb_refiner(refiner_state["config"]).to(device)
    refiner.load_state_dict(refiner_state["model"])
    refiner.eval()

    rows: list[dict[str, Any]] = []
    with torch.inference_mode():
        for sample_id in sample_ids:
            rows.append(render_sample(args.dataset_root, args.output_root, sample_id, structure_model, refiner, torch, device))

    contact_sheet = build_contact_sheet(rows, args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": args.schema_version,
        "status": "needs_visual_judge",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "local_full_scene_refiner_diversity_candidate",
        "stageId": args.stage_id,
        "trainingVersion": args.training_version,
        "modelVersion": args.model_version,
        "sampleCount": len(rows),
        "selectionStrategy": args.selection_strategy,
        "datasetRoot": str(args.dataset_root.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "structureCheckpoint": str(args.structure_checkpoint.resolve()),
        "refinerCheckpoint": str(args.refiner_checkpoint.resolve()),
        "device": str(device),
        "rows": rows,
        "note": "This run renders new natural-home structure conditions with the configured local full-scene structure model and RGB refiner. These are hidden candidates only.",
    }
    (args.output_root / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def select_sample_ids(scene_root: Path, sample_limit: int, selection_strategy: str) -> list[str]:
    all_sample_ids = sorted(path.name for path in scene_root.iterdir() if path.is_dir())
    if selection_strategy == "sorted":
        return all_sample_ids[:sample_limit]

    grouped: dict[str, list[str]] = {}
    for sample_id in all_sample_ids:
        source_id = sample_id.split("__v28-", 1)[0]
        grouped.setdefault(source_id, []).append(sample_id)

    source_ids = sorted(grouped)
    if not source_ids:
        return []

    preferred_variants = (
        "remix-road-tree",
        "remix-water-rock",
        "shift-southeast",
        "shift-northwest",
        "hflip",
        "copy",
    )
    if selection_strategy == "diverse-source-variants":
        selected: list[str] = []
        max_count = min(sample_limit, len(all_sample_ids))
        for variant in preferred_variants:
            for source_id in source_ids:
                candidate = select_preferred_variant(grouped[source_id], (variant,))
                if candidate in selected:
                    continue
                selected.append(candidate)
                if len(selected) >= max_count:
                    return selected
        return selected

    limit = min(sample_limit, len(source_ids))
    if limit <= 1:
        selected_sources = source_ids[:limit]
    else:
        selected_sources = [
            source_ids[round(index * (len(source_ids) - 1) / (limit - 1))]
            for index in range(limit)
        ]

    selected: list[str] = []
    for index, source_id in enumerate(selected_sources):
        candidates = grouped[source_id]
        variant_offset = index % len(preferred_variants)
        ranked_variants = preferred_variants[variant_offset:] + preferred_variants[:variant_offset]
        selected.append(select_preferred_variant(candidates, ranked_variants))
    return selected


def select_preferred_variant(candidates: list[str], ranked_variants: tuple[str, ...]) -> str:
    for variant in ranked_variants:
        suffix = f"__v28-{variant}"
        for candidate in candidates:
            if candidate.endswith(suffix):
                return candidate
    return candidates[0]


def render_sample(dataset_root: Path, output_root: Path, sample_id: str, structure_model, refiner, torch, device) -> dict[str, Any]:
    sample = dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    output_dir = output_root / "inference" / sample_id
    output_dir.mkdir(parents=True, exist_ok=True)
    condition = torch.cat([image_tensor(sample / "masks_v1" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0).unsqueeze(0).to(device)
    base_rgb, _ = structure_model(condition)
    prediction = refiner(condition, base_rgb)
    pixels = prediction[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
    generated_path = output_dir / "generated.png"
    Image.fromarray(np.asarray(pixels, dtype=np.uint8)).save(generated_path)
    target_path = output_dir / "target.png"
    shutil.copy2(sample / "target.png", target_path)
    contact_path = output_dir / "contact-sheet.png"
    build_pair_sheet(target_path, generated_path, sample_id, contact_path)
    row = {
        "sampleId": sample_id,
        "status": "needs_visual_judge",
        "displayAllowed": False,
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "contactSheet": str(contact_path.resolve()),
        "blueprint": str((sample / "blueprint.v1.json").resolve()),
        "sha256": hashlib.sha256(generated_path.read_bytes()).hexdigest(),
        "note": "Generated from structure conditions only. It is not an ApprovedFrame.",
    }
    (output_dir / "latest.json").write_text(json.dumps(row, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return row


def build_pair_sheet(target_path: Path, generated_path: Path, sample_id: str, output_path: Path) -> None:
    with Image.open(target_path) as target_image, Image.open(generated_path) as generated_image:
        target = target_image.convert("RGB")
        generated = generated_image.convert("RGB")
    gap = 12
    label_height = 24
    sheet = Image.new("RGB", (CANVAS_WIDTH * 2 + gap * 3, CANVAS_HEIGHT + label_height + gap * 2), "#071510")
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, gap), f"{sample_id} condition", fill="#dff8e6")
    draw.text((CANVAS_WIDTH + gap * 2, gap), "local model generated", fill="#dff8e6")
    sheet.paste(target, (gap, gap + label_height))
    sheet.paste(generated, (CANVAS_WIDTH + gap * 2, gap + label_height))
    sheet.save(output_path)


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    thumbs: list[tuple[str, Image.Image]] = []
    for row in rows:
        with Image.open(Path(str(row["generated"]))) as image:
            thumbs.append((str(row["sampleId"]), image.convert("RGB")))
    gap = 12
    label_height = 22
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    sheet_w = columns * cell_w + (columns + 1) * gap
    rows_count = math.ceil(len(thumbs) / columns)
    sheet_h = rows_count * cell_h + (rows_count + 1) * gap
    sheet = Image.new("RGB", (sheet_w, sheet_h), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, (sample_id, image) in enumerate(thumbs):
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), f"{index + 1:02d} {compact_sample_label(sample_id)}", fill="#dff8e6")
        sheet.paste(image, (x, y + label_height))
    sheet.save(output_path)
    return output_path


def compact_sample_label(sample_id: str) -> str:
    label = sample_id
    if "__v28-" in label:
        source, variant = label.split("__v28-", 1)
        source = source.replace("natural-home-", "")
        label = f"{source} / {variant}"
    return label[:30]


if __name__ == "__main__":
    raise SystemExit(main())

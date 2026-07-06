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
from ai_painter.training.dataset import append_condition_extra_channels, image_tensor
from ai_painter.training.rgb_refiner_model import build_rgb_refiner
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


def main() -> int:
    parser = ArgumentParser(description="Render diverse natural-home candidates with the full-scene RGB refiner.")
    parser.add_argument("--dataset-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v25-diversity-generation/dataset"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v26-diversity-refiner-generation"))
    parser.add_argument("--structure-checkpoint", type=Path, default=Path(".runtime/ai-painter/natural-home-v28-structure-guided-training/best.pt"))
    parser.add_argument("--refiner-checkpoint", type=Path, default=Path(".runtime/ai-painter/natural-home-clean-direct-training/best.pt"))
    parser.add_argument("--schema-version", default="natural-home-diversity-refiner-generation-v26")
    parser.add_argument("--stage-id", default="natural-home-v26-diversity-refiner-generation")
    parser.add_argument("--training-version", default="training-rgb-refiner-natural-home-direct-v1-clean-multisample")
    parser.add_argument("--model-version", default="rgb-refiner-natural-home-unet-v4-direct-multisample")
    parser.add_argument("--sample-limit", type=int, default=6)
    parser.add_argument(
        "--selection-strategy",
        choices=("sorted", "train-index", "validation-index", "diverse-source", "diverse-source-variants", "formal-world"),
        default="sorted",
        help=(
            "Choose candidate conditions. train-index and validation-index read dataset split files; "
            "diverse-source spreads samples across source scenes; "
            "diverse-source-variants walks source scenes and variants for broader hidden candidate sweeps; "
            "formal-world only selects full-frame natural-home-scene samples and blocks crop/partial sources. "
            "It also blocks current-stage building, work, construction, and material topics."
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
    refiner.ai_painter_config = refiner_state["config"]
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
    dataset_root = scene_root.parents[3]
    if selection_strategy in {"train-index", "validation-index"}:
        split = "train" if selection_strategy == "train-index" else "validation"
        return read_split_ids(dataset_root, split, sample_limit)

    all_sample_ids = sorted(path.name for path in scene_root.iterdir() if path.is_dir())
    if selection_strategy == "formal-world":
        return select_formal_world_sample_ids(all_sample_ids, sample_limit)
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


def select_formal_world_sample_ids(all_sample_ids: list[str], sample_limit: int) -> list[str]:
    formal_ids = [
        sample_id
        for sample_id in all_sample_ids
        if is_formal_world_sample_id(sample_id)
    ]
    if sample_limit <= 0:
        return []
    if sample_limit >= len(formal_ids):
        return formal_ids
    if sample_limit == 1:
        return formal_ids[:1]
    return [
        formal_ids[round(index * (len(formal_ids) - 1) / (sample_limit - 1))]
        for index in range(sample_limit)
    ]


def is_formal_world_sample_id(sample_id: str) -> bool:
    lowered = sample_id.lower()
    blocked_tokens = (
        "crop",
        "partial",
        "patch",
        "tile",
        "sprite",
        "diagnostic",
        "local-detail",
        "local_detail",
        "construction",
        "building",
        "house",
        "facility",
        "material",
        "scaffold",
        "wall",
        "roof",
        "foundation",
    )
    return lowered.startswith("natural-home-scene_") and not any(token in lowered for token in blocked_tokens)


def select_preferred_variant(candidates: list[str], ranked_variants: tuple[str, ...]) -> str:
    for variant in ranked_variants:
        suffix = f"__v28-{variant}"
        for candidate in candidates:
            if candidate.endswith(suffix):
                return candidate
    return candidates[0]


def read_split_ids(dataset_root: Path, split: str, sample_limit: int) -> list[str]:
    index_path = dataset_root / "indexes" / f"{split}.json"
    data = json.loads(index_path.read_text(encoding="utf-8"))
    sample_ids = data.get("sampleIds")
    if not isinstance(sample_ids, list) or not all(isinstance(value, str) for value in sample_ids):
        raise ValueError(f"invalid dataset index: {index_path}")
    return sample_ids[:sample_limit]


def render_sample(dataset_root: Path, output_root: Path, sample_id: str, structure_model, refiner, torch, device) -> dict[str, Any]:
    sample = dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    output_dir = output_root / "inference" / sample_id
    output_dir.mkdir(parents=True, exist_ok=True)
    base_condition = torch.cat([image_tensor(sample / "masks_v1" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0)
    refiner_config = getattr(refiner, "ai_painter_config", {})
    extra_channels = read_condition_extra_channels(refiner_config)
    condition = append_condition_extra_channels(base_condition, torch, sample_id, extra_channels).unsqueeze(0).to(device)
    base_rgb_manifest = load_base_rgb_manifest(refiner_config)
    if base_rgb_manifest:
        base_rgb_path = base_rgb_manifest.get(sample_id)
        if base_rgb_path is None:
            raise ValueError(f"base RGB not found for sampleId: {sample_id}")
        base_rgb = image_tensor(base_rgb_path, "RGB", torch, expected_channels=3).unsqueeze(0).to(device)
    else:
        base_rgb, _ = structure_model(condition[:, :14])
    if bool(refiner_config.get("zeroBaseRgb", False)) and not base_rgb_manifest:
        base_rgb = torch.zeros_like(base_rgb)
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
        "conditionExtraChannels": extra_channels,
        "zeroBaseRgb": bool(refiner_config.get("zeroBaseRgb", False)),
        "baseRgbManifest": refiner_config.get("baseRgbManifest"),
        "note": "Generated from structure conditions and deterministic texture controls. It is not an ApprovedFrame.",
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


def read_condition_extra_channels(config: dict[str, Any]) -> list[str]:
    values = config.get("conditionExtraChannels", [])
    if not isinstance(values, list):
        raise ValueError("conditionExtraChannels must be a list")
    return [str(value) for value in values]


def load_base_rgb_manifest(config: dict[str, Any]) -> dict[str, Path]:
    raw_path = config.get("baseRgbManifest")
    if not raw_path:
        return {}
    manifest_path = Path(str(raw_path))
    if not manifest_path.is_absolute():
        manifest_path = Path.cwd() / manifest_path
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = manifest.get("rows", [])
    if not isinstance(rows, list):
        raise ValueError(f"invalid baseRgbManifest rows: {manifest_path}")
    mapping: dict[str, Path] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        sample_id = row.get("sampleId")
        generated = row.get("generated")
        if isinstance(sample_id, str) and isinstance(generated, str):
            mapping[sample_id] = Path(generated)
    if not mapping:
        raise ValueError(f"empty baseRgbManifest: {manifest_path}")
    return mapping


if __name__ == "__main__":
    raise SystemExit(main())

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
from ai_painter.training.local_patch_dataset import build_patch_condition
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


REPAIR_CATEGORIES: dict[str, tuple[str, ...]] = {
    "water": ("water_body",),
    "shoreline": ("shoreline",),
}


def main() -> int:
    parser = ArgumentParser(description="Apply local water/shoreline expert repair to hidden natural-home candidates.")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--schema-version", default="natural-home-v32-water-expert-fix-v42")
    parser.add_argument("--stage-id", default="natural-home-v42-v32-water-expert-fix-generation")
    parser.add_argument("--training-version", default="water-expert-fix-from-v32-hidden-candidates-v42")
    parser.add_argument("--model-version", default="local-water-expert-fix-v42")
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--stride", type=int, default=32)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    source_manifest = read_json(args.manifest)
    source_rows = source_manifest.get("rows")
    if not isinstance(source_rows, list) or not source_rows:
        raise ValueError(f"manifest has no rows: {args.manifest}")
    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    models = load_models(args.model_root, torch, device)

    rows: list[dict[str, Any]] = []
    with torch.inference_mode():
        for source_row in source_rows:
            if isinstance(source_row, dict):
                rows.append(repair_row(source_row, args.output_root, models, args.patch_size, args.stride, torch, device))

    contact_sheet = build_contact_sheet(rows, args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": args.schema_version,
        "status": "needs_visual_judge",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "local_water_expert_visual_fix_candidate",
        "stageId": args.stage_id,
        "trainingVersion": args.training_version,
        "modelVersion": args.model_version,
        "sourceManifest": str(args.manifest.resolve()),
        "sourceStageId": source_manifest.get("stageId"),
        "sampleCount": len(rows),
        "outputRoot": str(args.output_root.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "modelRoot": str(args.model_root.resolve()),
        "device": str(device),
        "repairCategories": list(REPAIR_CATEGORIES),
        "rows": rows,
        "note": "Hidden local visual-fix candidate. It repairs water/shoreline expression only and cannot enter /world without later VisualJudge and ApprovedFrame.",
    }
    write_json(args.output_root / "latest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def load_models(model_root: Path, torch, device) -> dict[str, dict[str, Any]]:
    models: dict[str, dict[str, Any]] = {}
    for category in REPAIR_CATEGORIES:
        checkpoint_path = model_root / category / "best.pt"
        if not checkpoint_path.is_file():
            raise FileNotFoundError(checkpoint_path)
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
        model = build_tiny_unet(checkpoint["config"]).to(device)
        model.load_state_dict(checkpoint["model"])
        model.eval()
        models[category] = {
            "checkpointPath": checkpoint_path,
            "checkpoint": checkpoint,
            "model": model,
        }
    return models


def repair_row(
    source_row: dict[str, Any],
    output_root: Path,
    models: dict[str, dict[str, Any]],
    patch_size: int,
    stride: int,
    torch,
    device,
) -> dict[str, Any]:
    sample_id = str(source_row["sampleId"])
    sample = Path(str(source_row["blueprint"])).parent
    output_dir = output_root / "inference" / sample_id
    output_dir.mkdir(parents=True, exist_ok=True)

    original_generated_path = Path(str(source_row["generated"]))
    with Image.open(original_generated_path) as image:
        canvas = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    masks = read_masks(sample)

    repairs: list[dict[str, Any]] = []
    for category in REPAIR_CATEGORIES:
        repair = apply_category_repair(
            category,
            sample_id,
            masks,
            output_dir,
            models[category],
            canvas,
            patch_size,
            stride,
            torch,
            device,
        )
        repairs.append(repair)

    generated_path = output_dir / "generated.png"
    Image.fromarray((np.clip(canvas, 0.0, 1.0) * 255.0).round().astype(np.uint8)).save(generated_path)
    target_path = output_dir / "target.png"
    shutil.copy2(sample / "target.png", target_path)
    contact_path = output_dir / "contact-sheet.png"
    build_pair_sheet(target_path, original_generated_path, generated_path, sample_id, contact_path)

    row = {
        "sampleId": sample_id,
        "status": "needs_visual_judge",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "contactSheet": str(contact_path.resolve()),
        "blueprint": str((sample / "blueprint.v1.json").resolve()),
        "sourceGenerated": str(original_generated_path.resolve()),
        "sourceSha256": source_row.get("sha256"),
        "sha256": hashlib.sha256(generated_path.read_bytes()).hexdigest(),
        "repairs": repairs,
        "note": "V42 local water expert visual-fix candidate. It keeps source facts and only blends water/shoreline expert output inside matching masks.",
    }
    write_json(output_dir / "latest.json", row)
    return row


def apply_category_repair(
    category: str,
    sample_id: str,
    masks: dict[str, np.ndarray],
    output_dir: Path,
    model_bundle: dict[str, Any],
    canvas: np.ndarray,
    patch_size: int,
    stride: int,
    torch,
    device,
) -> dict[str, Any]:
    model = model_bundle["model"]
    checkpoint = model_bundle["checkpoint"]
    focus = np.maximum.reduce([masks[name] for name in REPAIR_CATEGORIES[category]])
    origins = patch_origins(focus, patch_size, stride)
    if not origins:
        return {
            "category": category,
            "status": "skipped_no_mask",
            "patchCount": 0,
            "checkpoint": str(model_bundle["checkpointPath"].resolve()),
        }

    category_output = np.zeros_like(canvas)
    category_weight = np.zeros((canvas.shape[0], canvas.shape[1], 1), dtype=np.float32)
    patch_root = output_dir / "working-patches" / category
    patch_root.mkdir(parents=True, exist_ok=True)
    for index, (x, y) in enumerate(origins):
        patch_dir = write_condition_patch(patch_root, sample_id, category, index, x, y, patch_size, masks)
        condition = build_patch_condition(patch_dir, torch, checkpoint["config"]).unsqueeze(0).to(device)
        predicted = model(condition)[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
        alpha = focus[y : y + patch_size, x : x + patch_size].astype(np.float32) / 255.0
        alpha = alpha * feather_window(patch_size)
        alpha = alpha[:, :, None]
        category_output[y : y + patch_size, x : x + patch_size] += predicted.astype(np.float32) / 255.0 * alpha
        category_weight[y : y + patch_size, x : x + patch_size] += alpha

    category_image = category_output / np.maximum(category_weight, 1e-6)
    layer_alpha = np.clip(focus.astype(np.float32) / 255.0, 0.0, 1.0)[:, :, None]
    if category == "shoreline":
        layer_alpha *= 0.82
    canvas[:] = canvas * (1.0 - layer_alpha) + category_image * layer_alpha
    preview_path = output_dir / f"{category}-repair-layer.png"
    Image.fromarray((np.clip(category_image, 0.0, 1.0) * 255.0).round().astype(np.uint8)).save(preview_path)

    return {
        "category": category,
        "status": "applied",
        "patchCount": len(origins),
        "checkpoint": str(model_bundle["checkpointPath"].resolve()),
        "preview": str(preview_path.resolve()),
        "epoch": checkpoint.get("epoch"),
        "step": checkpoint.get("step"),
        "loss": checkpoint.get("loss"),
    }


def read_masks(sample: Path) -> dict[str, np.ndarray]:
    return {
        name: np.asarray(Image.open(sample / "masks_v1" / f"{name}.png").convert("L"))
        for name in V1_CONDITION_CHANNELS
    }


def write_condition_patch(
    root: Path,
    source_id: str,
    category: str,
    index: int,
    x: int,
    y: int,
    patch_size: int,
    masks: dict[str, np.ndarray],
) -> Path:
    patch_dir = root / f"{index:03d}-{x}-{y}"
    masks_dir = patch_dir / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)
    for name in V1_CONDITION_CHANNELS:
        Image.fromarray(masks[name][y : y + patch_size, x : x + patch_size]).save(masks_dir / f"{name}.png")
    metadata = {
        "schemaVersion": "natural-home-local-detail-patch-sample-v1",
        "sourceId": source_id,
        "category": category,
        "x": x,
        "y": y,
        "size": patch_size,
        "focusChannels": list(REPAIR_CATEGORIES[category]),
    }
    write_json(patch_dir / "metadata.json", metadata)
    return patch_dir


def patch_origins(focus: np.ndarray, patch_size: int, stride: int) -> list[tuple[int, int]]:
    height, width = focus.shape
    origins: list[tuple[int, int]] = []
    ys = list(range(0, max(1, height - patch_size + 1), stride))
    xs = list(range(0, max(1, width - patch_size + 1), stride))
    if ys[-1] != height - patch_size:
        ys.append(height - patch_size)
    if xs[-1] != width - patch_size:
        xs.append(width - patch_size)
    for y in ys:
        for x in xs:
            if int(np.count_nonzero(focus[y : y + patch_size, x : x + patch_size])) > 0:
                origins.append((x, y))
    return origins


def feather_window(size: int) -> np.ndarray:
    axis = np.hanning(size).astype(np.float32)
    window = np.outer(axis, axis)
    return np.maximum(window, 0.22)


def build_pair_sheet(target_path: Path, original_path: Path, generated_path: Path, sample_id: str, output_path: Path) -> None:
    with Image.open(target_path) as target_image, Image.open(original_path) as original_image, Image.open(generated_path) as generated_image:
        target = target_image.convert("RGB")
        original = original_image.convert("RGB")
        generated = generated_image.convert("RGB")
    gap = 12
    label_height = 24
    sheet = Image.new("RGB", (CANVAS_WIDTH * 3 + gap * 4, CANVAS_HEIGHT + label_height + gap * 2), "#071510")
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, gap), f"{sample_id} target", fill="#dff8e6")
    draw.text((CANVAS_WIDTH + gap * 2, gap), "before V42", fill="#dff8e6")
    draw.text((CANVAS_WIDTH * 2 + gap * 3, gap), "after V42", fill="#dff8e6")
    sheet.paste(target, (gap, gap + label_height))
    sheet.paste(original, (CANVAS_WIDTH + gap * 2, gap + label_height))
    sheet.paste(generated, (CANVAS_WIDTH * 2 + gap * 3, gap + label_height))
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
    rows_count = max(1, math.ceil(len(thumbs) / columns))
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
    label = sample_id.replace("natural-home-", "")
    if "__v28-" in label:
        source, variant = label.split("__v28-", 1)
        label = f"{source} / {variant}"
    return label[:30]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

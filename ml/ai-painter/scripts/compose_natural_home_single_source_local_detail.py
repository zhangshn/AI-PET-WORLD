from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.training.local_patch_dataset import build_patch_condition
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


CATEGORY_FOCUS: dict[str, tuple[str, ...]] = {
    "grass": ("grass",),
    "water": ("water_body",),
    "shoreline": ("shoreline",),
    "road": ("road_edge", "road_center"),
    "tree": ("tree_trunk", "tree_crown"),
    "rock": ("rock",),
}

LAYER_ORDER = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Compose a full natural-home scene from single-source local detail experts.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--stride", type=int, default=32)
    parser.add_argument("--style-profile", type=Path)
    parser.add_argument("--condition-source-id")
    args = parser.parse_args()

    source = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / args.source_id
    if not source.exists():
        raise FileNotFoundError(source)
    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    masks = read_masks(source)
    with Image.open(source / "target.png") as target_image:
        target = target_image.convert("RGB")
    width, height = target.size
    style_profiles = read_style_profiles(args.style_profile)

    canvas = np.zeros((height, width, 3), dtype=np.float32)
    weights = np.zeros((height, width, 1), dtype=np.float32)
    rows: list[dict[str, object]] = []
    for category in LAYER_ORDER:
        row = compose_category(
            category,
            source,
            masks,
            args.model_root / category,
            args.output_root,
            args.condition_source_id or args.source_id,
            style_profiles.get(args.source_id, {}).get(category),
            canvas,
            weights,
            args.patch_size,
            args.stride,
            torch,
            device,
        )
        rows.append(row)

    generated = np.clip(canvas, 0.0, 1.0)
    generated_image = Image.fromarray((generated * 255.0).round().astype(np.uint8))
    generated_path = args.output_root / "generated.png"
    target_path = args.output_root / "target.png"
    generated_image.save(generated_path)
    target.save(target_path)
    contact_sheet_path = args.output_root / "contact-sheet.png"
    build_contact_sheet(target, generated_image, rows).save(contact_sheet_path)

    report = {
        "schemaVersion": "natural-home-single-source-local-detail-composition-v1",
        "status": "completed",
        "displayAllowed": False,
        "stageId": "natural-home-v1-no-building-single-source-compose",
        "sourceId": args.source_id,
        "device": str(device),
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "contactSheet": str(contact_sheet_path.resolve()),
        "patchSize": args.patch_size,
        "stride": args.stride,
        "categories": rows,
        "note": "This is a local model full-scene composition candidate. It is not an ApprovedFrame and cannot enter /world.",
    }
    (args.output_root / "latest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def read_masks(source: Path) -> dict[str, np.ndarray]:
    return {name: np.asarray(Image.open(source / "masks_v1" / f"{name}.png").convert("L")) for name in V1_CONDITION_CHANNELS}


def compose_category(
    category: str,
    source: Path,
    masks: dict[str, np.ndarray],
    model_root: Path,
    output_root: Path,
    source_id: str,
    style_vector: list[float] | None,
    canvas: np.ndarray,
    weights: np.ndarray,
    patch_size: int,
    stride: int,
    torch,
    device,
) -> dict[str, object]:
    checkpoint = torch.load(model_root / "best.pt", map_location=device, weights_only=False)
    model = build_tiny_unet(checkpoint["config"]).to(device)
    model.load_state_dict(checkpoint["model"])
    model.eval()

    focus = np.maximum.reduce([masks[name] for name in CATEGORY_FOCUS[category]])
    origins = patch_origins(focus, patch_size, stride)
    category_output = np.zeros_like(canvas)
    category_weight = np.zeros_like(weights)
    patch_root = output_root / "working-patches" / category
    patch_root.mkdir(parents=True, exist_ok=True)

    for index, (x, y) in enumerate(origins):
        patch_dir = write_condition_patch(patch_root, source_id, category, index, x, y, patch_size, masks, style_vector)
        condition = build_patch_condition(patch_dir, torch, checkpoint["config"]).unsqueeze(0).to(device)
        with torch.inference_mode():
            predicted = model(condition)[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()
        alpha = focus[y : y + patch_size, x : x + patch_size].astype(np.float32) / 255.0
        if category == "grass":
            alpha = np.maximum(alpha, 0.95)
        alpha = alpha * feather_window(patch_size)
        alpha = alpha[:, :, None]
        category_output[y : y + patch_size, x : x + patch_size] += predicted.astype(np.float32) / 255.0 * alpha
        category_weight[y : y + patch_size, x : x + patch_size] += alpha

    category_image = category_output / np.maximum(category_weight, 1e-6)
    if category == "grass":
        layer_alpha = np.ones_like(weights)
    else:
        layer_alpha = np.clip(focus.astype(np.float32) / 255.0, 0.0, 1.0)[:, :, None]
    canvas[:] = canvas * (1.0 - layer_alpha) + category_image * layer_alpha
    weights[:] = np.maximum(weights, layer_alpha)
    preview_path = output_root / f"{category}-layer.png"
    Image.fromarray((np.clip(category_image, 0.0, 1.0) * 255.0).round().astype(np.uint8)).save(preview_path)

    return {
        "category": category,
        "sourceId": source_id,
        "checkpoint": str((model_root / "best.pt").resolve()),
        "patchCount": len(origins),
        "preview": str(preview_path.resolve()),
        "epoch": checkpoint.get("epoch"),
        "step": checkpoint.get("step"),
        "loss": checkpoint.get("loss"),
    }


def feather_window(size: int) -> np.ndarray:
    axis = np.hanning(size).astype(np.float32)
    window = np.outer(axis, axis)
    return np.maximum(window, 0.18)


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


def write_condition_patch(
    root: Path,
    source_id: str,
    category: str,
    index: int,
    x: int,
    y: int,
    patch_size: int,
    masks: dict[str, np.ndarray],
    style_vector: list[float] | None = None,
) -> Path:
    patch_dir = root / f"{index:03d}-{x}-{y}"
    masks_dir = patch_dir / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)
    for name in V1_CONDITION_CHANNELS:
        Image.fromarray(masks[name][y : y + patch_size, x : x + patch_size]).save(masks_dir / f"{name}.png")
    metadata: dict[str, object] = {
        "schemaVersion": "natural-home-local-detail-patch-sample-v1",
        "sourceId": source_id,
        "category": category,
        "x": x,
        "y": y,
        "size": patch_size,
        "focusChannels": list(CATEGORY_FOCUS[category]),
    }
    if style_vector is not None:
        metadata["styleVector"] = style_vector
    (patch_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return patch_dir


def read_style_profiles(path: Path | None) -> dict[str, dict[str, list[float]]]:
    if path is None or not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    profiles: dict[str, dict[str, list[float]]] = {}
    if not isinstance(raw, dict):
        return profiles
    for source_id, categories in raw.items():
        if not isinstance(source_id, str) or not isinstance(categories, dict):
            continue
        profiles[source_id] = {}
        for category, values in categories.items():
            if isinstance(category, str) and isinstance(values, list):
                profiles[source_id][category] = [float(value) for value in values[:8] if isinstance(value, (int, float))]
    return profiles


def build_contact_sheet(target: Image.Image, generated: Image.Image, rows: list[dict[str, object]]) -> Image.Image:
    gap = 12
    label_height = 26
    width = target.width * 2 + gap * 3
    height = target.height + label_height + 110
    sheet = Image.new("RGB", (width, height), "#071510")
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, gap), "target", fill="#dff8e6")
    draw.text((target.width + gap * 2, gap), "generated by local experts", fill="#dff8e6")
    sheet.paste(target, (gap, gap + label_height))
    sheet.paste(generated, (target.width + gap * 2, gap + label_height))
    y = gap + label_height + target.height + 12
    for row in rows:
        draw.text((gap, y), f"{row['category']}: {row['patchCount']} patches | epoch {row.get('epoch')}", fill="#8ee6b0")
        y += 16
    return sheet


if __name__ == "__main__":
    raise SystemExit(main())

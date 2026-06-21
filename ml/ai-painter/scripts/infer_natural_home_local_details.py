from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from ai_painter.training.local_patch_dataset import build_patch_condition
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Infer pure natural-home local detail models and build a review sheet.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    args.output_root.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    for category in NATURAL_CATEGORIES:
        row = infer_category(category, args.dataset_root / category, args.model_root / category, args.output_root, torch, device)
        rows.append(row)

    contact_sheet = build_contact_sheet(rows)
    contact_sheet_path = args.output_root / "contact-sheet.png"
    contact_sheet.save(contact_sheet_path)
    result = {
        "schemaVersion": "natural-home-local-detail-inference-v1",
        "status": "completed",
        "stageId": "natural-home-v1-no-building-local-details",
        "device": str(device),
        "contactSheet": str(contact_sheet_path.resolve()),
        "categories": rows,
    }
    (args.output_root / "latest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def infer_category(category: str, dataset_root: Path, model_root: Path, output_root: Path, torch, device) -> dict[str, object]:
    validation_ids = json.loads((dataset_root / "validation.json").read_text(encoding="utf-8"))["sampleIds"]
    if not validation_ids:
        raise ValueError(f"missing validation samples for category: {category}")
    sample_id = validation_ids[0]
    sample = dataset_root / "samples" / sample_id
    checkpoint = torch.load(model_root / "best.pt", map_location=device, weights_only=False)
    model = build_tiny_unet(checkpoint["config"]).to(device)
    model.load_state_dict(checkpoint["model"])
    model.eval()

    condition = build_patch_condition(sample, torch, checkpoint["config"]).unsqueeze(0).to(device)
    with torch.inference_mode():
        prediction = model(condition)[0].clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()

    generated = Image.fromarray(np.asarray(prediction, dtype=np.uint8))
    target = Image.open(sample / "target.png").convert("RGB")
    generated_path = output_root / f"{category}-generated.png"
    target_path = output_root / f"{category}-target.png"
    generated.save(generated_path)
    target.save(target_path)
    return {
        "category": category,
        "sampleId": sample_id,
        "generated": str(generated_path.resolve()),
        "target": str(target_path.resolve()),
        "epoch": checkpoint.get("epoch"),
        "step": checkpoint.get("step"),
        "loss": checkpoint.get("loss"),
    }


def build_contact_sheet(rows: list[dict[str, object]]) -> Image.Image:
    first_target = Image.open(str(rows[0]["target"])).convert("RGB")
    patch_size = first_target.width
    label_height = 22
    gap = 12
    columns_width = patch_size * 2 + gap
    width = columns_width * 2 + gap * 3
    row_height = patch_size + label_height + gap
    height = row_height * 3 + gap
    sheet = Image.new("RGB", (width, height), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        column = index % 2
        row_index = index // 2
        x = gap + column * (columns_width + gap)
        y = gap + row_index * row_height
        category = str(row["category"])
        draw.text((x, y), f"{category}: target / generated", fill="#dff8e6")
        target = Image.open(str(row["target"])).convert("RGB")
        generated = Image.open(str(row["generated"])).convert("RGB")
        sheet.paste(target, (x, y + label_height))
        sheet.paste(generated, (x + patch_size + gap, y + label_height))
    return sheet


if __name__ == "__main__":
    raise SystemExit(main())

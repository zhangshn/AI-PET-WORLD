from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


def main() -> int:
    parser = ArgumentParser(description="Build a construction/home candidate pack from local structure-guided inference outputs.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--inference-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--training-root", type=Path, required=True)
    parser.add_argument("--stage-id", default="construction-home-v53-structure-candidate-pack")
    parser.add_argument("--schema-version", default="construction-home-candidate-pack-v1")
    args = parser.parse_args()

    args.output_root.mkdir(parents=True, exist_ok=True)
    rows = []
    for inference_dir in sorted(path for path in args.inference_root.iterdir() if path.is_dir()):
        sample_id = inference_dir.name
        sample_dir = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
        generated = inference_dir / "generated.png"
        if not generated.is_file() or not sample_dir.is_dir():
            continue
        row = build_row(sample_id, sample_dir, inference_dir, generated)
        rows.append(row)

    rows.sort(key=lambda row: row["sampleId"])
    contact_sheet = build_contact_sheet(rows, args.output_root / "contact-sheet.png")
    training_summary = read_json(args.training_root / "training-summary.json")
    manifest = {
        "schemaVersion": args.schema_version,
        "status": "candidate_pack_ready_for_vj",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "construction_home_structure_guided_candidates_only",
        "stageId": args.stage_id,
        "datasetRoot": str(args.dataset_root.resolve()),
        "inferenceRoot": str(args.inference_root.resolve()),
        "trainingRoot": str(args.training_root.resolve()),
        "trainingSummary": training_summary,
        "contactSheet": str(contact_sheet.resolve()),
        "summary": {
            "rowCount": len(rows),
            "requiredChannels": [
                "grass",
                "road_center",
                "road_edge",
                "walkable",
                "shelter_foundation",
                "shelter_wall",
                "construction_material",
            ],
            "rowsWithConstructionCore": sum(
                1 for row in rows if "shelter_foundation" in row["activeChannels"] and "construction_material" in row["activeChannels"]
            ),
        },
        "rows": rows,
        "note": "Local model generated construction/home candidates. They are hidden candidates only and must pass VisualJudge before ApprovedFrame.",
    }
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "candidate-pack.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def build_row(sample_id: str, sample_dir: Path, inference_dir: Path, generated: Path) -> dict[str, Any]:
    target = sample_dir / "target.png"
    structure_preview = inference_dir / "structure-preview.png"
    blueprint = sample_dir / "blueprint.v1.json"
    active_channels = read_active_channels(sample_dir / "masks_v1")
    generated_sha256 = digest(generated)
    contact_sheet = inference_dir / "pair-sheet.png"
    build_pair_sheet(sample_id, target, generated, structure_preview, contact_sheet)

    return {
        "sampleId": sample_id,
        "status": "structure_guided_candidate",
        "diagnosisStatus": "pass_candidate",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "score": 90,
        "generated": str(generated.resolve()),
        "target": str(target.resolve()),
        "structurePreview": str(structure_preview.resolve()) if structure_preview.is_file() else None,
        "blueprint": str(blueprint.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "sha256": generated_sha256,
        "activeChannels": active_channels,
        "activeAreas": read_active_areas(sample_dir / "masks_v1", active_channels),
        "tags": [
            "local_structure_guided_model_output",
            "construction_home_candidate",
            "hidden_candidate_only",
            "visual_judge_required",
        ],
    }


def read_active_channels(mask_dir: Path) -> list[str]:
    channels = []
    for channel in V1_CONDITION_CHANNELS:
        mask = mask_dir / f"{channel}.png"
        if not mask.is_file():
            continue
        with Image.open(mask) as image:
            if image.convert("L").getbbox() is not None:
                channels.append(channel)
    return channels


def read_active_areas(mask_dir: Path, channels: list[str]) -> dict[str, int]:
    areas = {}
    for channel in channels:
        with Image.open(mask_dir / f"{channel}.png") as image:
            pixels = image.convert("L")
            areas[channel] = sum(1 for value in pixels.getdata() if value > 0)
    return areas


def build_pair_sheet(sample_id: str, target_path: Path, generated_path: Path, structure_path: Path, output_path: Path) -> None:
    sheet = Image.new("RGB", (CANVAS_WIDTH * 3 + 32, CANVAS_HEIGHT + 36), "#071510")
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), sample_id[:80], fill="#dff8e6")
    for index, image_path in enumerate((target_path, generated_path, structure_path)):
        if not image_path.is_file():
            continue
        with Image.open(image_path) as image:
            sheet.paste(image.convert("RGB"), (8 + index * (CANVAS_WIDTH + 8), 34))
    sheet.save(output_path)


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    gap = 12
    label_height = 34
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    row_count = max(1, math.ceil(len(rows) / columns))
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, row_count * cell_h + (row_count + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        col = index % columns
        line = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + line * (cell_h + gap)
        draw.text((x, y), f"{index + 1:02d} construction candidate", fill="#79f2a6")
        draw.text((x, y + 15), row["sampleId"][:36], fill="#dff8e6")
        with Image.open(row["generated"]) as image:
            sheet.paste(image.convert("RGB"), (x, y + label_height))
    sheet.save(output_path)
    return output_path


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V1_CONDITION_CHANNELS


SCHEMA_VERSION = "natural-home-v118-complete-world-dataset-v1"
STAGE_ID = "natural-home-v118-complete-world-blueprint-dataset"

BLOCKED_SOURCE_TOKENS = {
    "crop",
    "partial",
    "patch",
    "tile",
    "sprite",
    "diagnostic",
    "local-detail",
    "local_detail",
    "tight",
    "close",
    "corner",
}

FORBIDDEN_CURRENT_MVP_TYPES = {
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "building",
    "facility",
    "butler",
    "character",
    "animal",
    "insect",
}

GAME_WORLD_INTENT = {
    "scope": "complete_natural_home_mvp",
    "frameRole": "primary_world_view",
    "runtimeFrameSource": True,
    "tags": [
        "complete_natural_home_mvp",
        "primary_world_view",
        "runtime_frame_source",
    ],
    "anchors": [
        "world_entry",
        "primary_path",
        "natural_boundary",
        "water_feature",
        "exploration_area",
        "visual_center",
    ],
    "forbiddenForCurrentMvp": sorted(FORBIDDEN_CURRENT_MVP_TYPES),
    "note": (
        "V118 is a complete-game-world condition source, not a finished game-world frame source. "
        "It is still training data only; "
        "it cannot enter /world until the generated frame passes VJ-1, VJ-2, "
        "Game-World Frame Gate, ApprovedFrame binding, RuntimeFrame, and owner confirmation."
    ),
}


def main() -> int:
    parser = ArgumentParser(description="Prepare V118 complete natural-home world blueprint dataset.")
    parser.add_argument(
        "--source-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v45-generalization-dataset"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v118-complete-world-blueprint-dataset"),
    )
    parser.add_argument("--validation-source-count", type=int, default=8)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    source_scene_root = args.source_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    if not source_scene_root.is_dir():
        raise ValueError(f"source scene root does not exist: {source_scene_root}")

    selected_ids = [
        sample_id
        for sample_id in sorted(path.name for path in source_scene_root.iterdir() if path.is_dir())
        if is_complete_world_source_id(sample_id) and blueprint_is_current_mvp_safe(source_scene_root / sample_id / "blueprint.v1.json")
    ]
    if not selected_ids:
        raise ValueError("no complete-world source samples selected")

    copied_ids: list[str] = []
    source_counter: Counter[str] = Counter()
    variant_counter: Counter[str] = Counter()
    for sample_id in selected_ids:
        source_dir = source_scene_root / sample_id
        output_dir = output_scene_root / sample_id
        shutil.copytree(source_dir, output_dir)
        update_blueprint_intent(output_dir / "blueprint.v1.json")
        copied_ids.append(sample_id)
        source_counter[source_id(sample_id)] += 1
        variant_counter[variant_id(sample_id)] += 1

    train_ids, validation_ids = split_by_source(copied_ids, args.validation_source_count)
    write_json(args.output_root / "indexes" / "train.json", {
        "schemaVersion": "dataset-index-v1",
        "split": "train",
        "sampleIds": train_ids,
    })
    write_json(args.output_root / "indexes" / "validation.json", {
        "schemaVersion": "dataset-index-v1",
        "split": "validation",
        "sampleIds": validation_ids,
    })

    contact_sheet = build_contact_sheet(args.output_root, validation_ids[:12] or copied_ids[:12], args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "status": "completed",
        "stageId": STAGE_ID,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceRoot": str(args.source_root.resolve()),
        "selectedSampleCount": len(copied_ids),
        "selectedSourceCount": len(source_counter),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sourceCoverage": dict(sorted(source_counter.items())),
        "variantCoverage": dict(sorted(variant_counter.items())),
        "blockedSourceTokens": sorted(BLOCKED_SOURCE_TOKENS),
        "forbiddenCurrentMvpTypes": sorted(FORBIDDEN_CURRENT_MVP_TYPES),
        "gameWorldIntent": GAME_WORLD_INTENT,
        "contactSheet": str(contact_sheet.resolve()),
        "policy": {
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "purpose": (
                "Provide complete natural-home world conditions for the next local model generation/training pass. "
                "The selected sources are not finished complete game-world frames. "
                "This dataset is not an ApprovedFrame and must not be shown in /world."
            ),
        },
    }
    write_json(args.output_root / "dataset-manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def is_complete_world_source_id(sample_id: str) -> bool:
    lowered = sample_id.lower()
    return lowered.startswith("natural-home-scene_") and not any(token in lowered for token in BLOCKED_SOURCE_TOKENS)


def blueprint_is_current_mvp_safe(path: Path) -> bool:
    data = read_json(path)
    types = {str(item.get("type")) for item in data.get("structures", []) if isinstance(item, dict)}
    return not (types & FORBIDDEN_CURRENT_MVP_TYPES)


def update_blueprint_intent(path: Path) -> None:
    data = read_json(path)
    data["gameWorldFrameIntent"] = GAME_WORLD_INTENT
    data["runtimeFrameIntent"] = GAME_WORLD_INTENT
    data["sourcePolicy"] = {
        "selectedFor": STAGE_ID,
        "completeWorldConditionSource": True,
        "completeGameWorldFrameSource": False,
        "requiresModelGeneration": True,
        "blockedSourceTokens": sorted(BLOCKED_SOURCE_TOKENS),
        "displayAllowed": False,
        "canPromoteToWorld": False,
    }
    write_json(path, data)


def split_by_source(sample_ids: list[str], validation_source_count: int) -> tuple[list[str], list[str]]:
    sources = sorted({source_id(sample_id) for sample_id in sample_ids})
    validation_sources = set(sources[-max(1, min(validation_source_count, len(sources))):])
    train_ids = [sample_id for sample_id in sample_ids if source_id(sample_id) not in validation_sources]
    validation_ids = [sample_id for sample_id in sample_ids if source_id(sample_id) in validation_sources]
    return train_ids, validation_ids


def source_id(sample_id: str) -> str:
    return sample_id.split("__v28-", 1)[0]


def variant_id(sample_id: str) -> str:
    return sample_id.split("__v28-", 1)[1] if "__v28-" in sample_id else "source"


def build_contact_sheet(output_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 20
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        target_path = output_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id / "target.png"
        if not target_path.exists():
            continue
        with Image.open(target_path) as image:
            target = image.convert("RGB")
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), compact_label(sample_id), fill="#dff8e6")
        sheet.paste(target, (x, y + label_height))
    sheet.save(output_path)
    return output_path


def compact_label(sample_id: str) -> str:
    return sample_id.replace("natural-home-", "")[:36]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH


TRAIN_SPLIT_RATIO = 0.8


def main() -> int:
    parser = ArgumentParser(description="Build a clean natural-home dataset from the quality report.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--quality-report", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    dataset_root = args.dataset_root.resolve()
    quality_report_path = args.quality_report.resolve()
    output_root = args.output_root.resolve()

    quality_report = read_json(quality_report_path)
    source_manifest = read_json(dataset_root / "dataset-manifest.json")
    source_ids = load_source_ids(dataset_root, source_manifest)
    blocked_ids = set(str(sample_id) for sample_id in quality_report.get("blockedSamples", []))
    clean_ids = [sample_id for sample_id in source_ids if sample_id not in blocked_ids]

    if not clean_ids:
        raise ValueError("quality gate removed every sample; clean dataset cannot be built")

    if output_root.exists():
        shutil.rmtree(output_root)

    source_scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    clean_scene_root = output_root / "accepted" / "dataset_v0" / "scene" / "world"
    clean_scene_root.mkdir(parents=True)

    for sample_id in clean_ids:
        source_sample = source_scene_root / sample_id
        if not source_sample.exists():
            raise FileNotFoundError(f"source sample is missing: {source_sample}")
        shutil.copytree(source_sample, clean_scene_root / sample_id)

    train_ids, validation_ids = build_clean_splits(dataset_root, clean_ids)
    indexes = output_root / "indexes"
    indexes.mkdir(parents=True)
    write_index(indexes / "train.json", "train", train_ids)
    write_index(indexes / "validation.json", "validation", validation_ids)

    quarantine_dir = output_root / "quarantine"
    quarantine_dir.mkdir(parents=True)
    blocked_details = build_blocked_details(quality_report)
    (quarantine_dir / "quarantined-samples.json").write_text(
        json.dumps(
            {
                "schemaVersion": "natural-home-quarantine-v1",
                "sourceQualityReport": str(quality_report_path),
                "blockedSampleCount": len(blocked_details),
                "blockedSamples": blocked_details,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    manifest = {
        "schemaVersion": "natural-home-clean-dataset-manifest-v1",
        "status": "clean_training_ready",
        "sourceDatasetRoot": str(dataset_root),
        "sourceQualityReport": str(quality_report_path),
        "sourceSampleCount": len(source_ids),
        "cleanSampleCount": len(clean_ids),
        "blockedSampleCount": len(blocked_ids),
        "trainCount": len(train_ids),
        "validationCount": len(validation_ids),
        "sampleIds": clean_ids,
        "blockedSampleIds": sorted(blocked_ids),
        "warningCounts": quality_report.get("warningCounts", {}),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "policy": "Blocked samples are copied to a quarantine manifest and excluded from clean training indexes. Source files are not deleted.",
    }
    (output_root / "dataset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_contact_sheet(clean_scene_root, clean_ids, output_root / "contact-sheet.png")

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, object]:
    if not path.exists():
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def load_source_ids(dataset_root: Path, manifest: dict[str, object]) -> list[str]:
    values = manifest.get("sampleIds")
    if isinstance(values, list) and all(isinstance(value, str) for value in values):
        return values
    scene_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    return sorted(path.name for path in scene_root.iterdir() if path.is_dir())


def build_clean_splits(dataset_root: Path, clean_ids: list[str]) -> tuple[list[str], list[str]]:
    original_train = load_index(dataset_root / "indexes" / "train.json")
    original_validation = load_index(dataset_root / "indexes" / "validation.json")
    clean_set = set(clean_ids)
    train_ids = [sample_id for sample_id in original_train if sample_id in clean_set]
    validation_ids = [sample_id for sample_id in original_validation if sample_id in clean_set]
    already_split = set(train_ids) | set(validation_ids)
    missing = [sample_id for sample_id in clean_ids if sample_id not in already_split]
    if missing:
        split_at = max(1, min(len(missing), int(len(missing) * TRAIN_SPLIT_RATIO)))
        train_ids.extend(missing[:split_at])
        validation_ids.extend(missing[split_at:])
    if not validation_ids and len(train_ids) > 1:
        validation_ids.append(train_ids.pop())
    return train_ids, validation_ids


def load_index(path: Path) -> list[str]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    values = data.get("sampleIds", [])
    return [str(value) for value in values if isinstance(value, str)]


def write_index(path: Path, split: str, sample_ids: list[str]) -> None:
    path.write_text(
        json.dumps(
            {
                "schemaVersion": "dataset-index-v1",
                "split": split,
                "sampleIds": sample_ids,
                "count": len(sample_ids),
                "qualityGate": "natural-home-quality-report-v1",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def build_blocked_details(quality_report: dict[str, object]) -> list[dict[str, object]]:
    samples = quality_report.get("samples", [])
    if not isinstance(samples, list):
        return []
    details: list[dict[str, object]] = []
    for sample in samples:
        if not isinstance(sample, dict):
            continue
        if sample.get("status") == "pass":
            continue
        details.append(
            {
                "sampleId": sample.get("sampleId"),
                "warnings": sample.get("warnings", []),
                "targetMetrics": sample.get("targetMetrics", {}),
                "status": "quarantined",
            }
        )
    return details


def write_contact_sheet(scene_root: Path, sample_ids: list[str], output: Path) -> None:
    scale = 2
    columns = 3
    label_height = 18
    rows = (len(sample_ids) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (columns * CANVAS_WIDTH * scale, rows * (CANVAS_HEIGHT * scale + label_height)),
        (5, 18, 14),
    )
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        with Image.open(scene_root / sample_id / "target.png") as image:
            thumb = image.resize((CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale), Image.Resampling.NEAREST)
        x = index % columns * CANVAS_WIDTH * scale
        y = index // columns * (CANVAS_HEIGHT * scale + label_height)
        sheet.paste(thumb, (x, y))
        draw.text((x + 6, y + CANVAS_HEIGHT * scale + 3), sample_id[:58], fill=(170, 230, 190))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=False, compress_level=9)


if __name__ == "__main__":
    raise SystemExit(main())

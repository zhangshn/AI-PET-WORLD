from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear

CANVAS_WIDTH = 256
CANVAS_HEIGHT = 192


def main() -> int:
    parser = ArgumentParser(description="Prepare V88 natural-home quality allowlist dataset.")
    parser.add_argument("--source-dataset-root", type=Path, required=True)
    parser.add_argument("--allowlist", type=Path, required=True)
    parser.add_argument("--negative-examples", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--validation-count", type=int, default=8)
    parser.add_argument("--min-score", type=float, default=88.0)
    parser.add_argument("--stage-id", default="natural-home-v88-quality-allowlist-dataset")
    parser.add_argument("--training-target-source", default="v87_quality_allowlist_generated_png")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        preserve_runtime_dir_before_clear(args.output_root, "prepare-natural-home-v88-quality-allowlist-dataset")
        shutil.rmtree(args.output_root)

    scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    scene_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "indexes").mkdir(parents=True, exist_ok=True)

    allowlist = read_json(args.allowlist)
    negative_examples = read_json(args.negative_examples)
    negative_keys = {
        row_key(row)
        for row in negative_examples.get("rows", [])
        if isinstance(row, dict) and row.get("mayTrainAsTarget") is False
    }

    rows = [
        row
        for row in allowlist.get("rows", [])
        if isinstance(row, dict)
        and row.get("status") == "passed_for_next_training"
        and row.get("mayTrainAsTarget") is True
        and float(row.get("score", 0.0)) >= args.min_score
        and row_key(row) not in negative_keys
    ]
    if len(rows) < 32:
        raise ValueError(f"V88 requires at least 32 clean allowlist rows, got {len(rows)}")
    rows.sort(key=lambda row: (-float(row.get("score", 0.0)), str(row.get("sampleId", ""))))

    validation_count = max(1, min(args.validation_count, len(rows) // 4))
    validation_rows = rows[-validation_count:]
    train_rows = rows[:-validation_count]

    copied_train = [
        copy_allow_row(args.source_dataset_root, scene_root, row, args.stage_id, args.training_target_source)
        for row in train_rows
    ]
    copied_validation = [
        copy_allow_row(args.source_dataset_root, scene_root, row, args.stage_id, args.training_target_source)
        for row in validation_rows
    ]
    train_ids = [row["sampleId"] for row in copied_train]
    validation_ids = [row["sampleId"] for row in copied_validation]
    write_index(args.output_root, "train", train_ids)
    write_index(args.output_root, "validation", validation_ids)

    contact_sheet = build_contact_sheet(copied_train + copied_validation, args.output_root / "contact-sheet.png")
    manifest = {
        "schemaVersion": "natural-home-v88-quality-allowlist-dataset-v1",
        "status": "completed",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "allowlist": str(args.allowlist.resolve()),
        "negativeExamples": str(args.negative_examples.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "minScore": args.min_score,
        "trainSampleCount": len(train_ids),
        "validationSampleCount": len(validation_ids),
        "sampleCount": len(train_ids) + len(validation_ids),
        "negativeExampleCount": int(negative_examples.get("rowCount", 0) or len(negative_examples.get("rows", []))),
        "trainingPolicy": {
            "targetSource": "v87_allowlist_only",
            "negativeExampleUsage": "visual_judge_and_regression_history_only",
            "negativeExamplesMayTrainAsTarget": False,
            "note": "Only V87 allowlist generated PNGs are copied to target.png. Rejected rows are not copied into training targets.",
        },
        "rows": copied_train + copied_validation,
    }
    write_json(args.output_root / "manifest.json", manifest)
    write_json(args.output_root / "latest.json", manifest)
    print(json.dumps({
        "schemaVersion": manifest["schemaVersion"],
        "status": manifest["status"],
        "stageId": manifest["stageId"],
        "sampleCount": manifest["sampleCount"],
        "trainSampleCount": manifest["trainSampleCount"],
        "validationSampleCount": manifest["validationSampleCount"],
        "negativeExampleCount": manifest["negativeExampleCount"],
        "contactSheet": manifest["contactSheet"],
    }, ensure_ascii=False, indent=2))
    return 0


def copy_allow_row(
    source_dataset_root: Path,
    output_scene_root: Path,
    row: dict[str, Any],
    stage_id: str,
    training_target_source: str,
) -> dict[str, Any]:
    sample_id = str(row["sampleId"])
    source_sample = source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    target_sample = output_scene_root / sample_id
    if target_sample.exists():
        shutil.rmtree(target_sample)

    if source_sample.exists():
        shutil.copytree(source_sample, target_sample)
    else:
        target_sample.mkdir(parents=True, exist_ok=True)
        copy_blueprint(row, target_sample)
        copy_mask_dir(row, target_sample)
        write_json(target_sample / "metadata.json", {
            "schemaVersion": "training-sample-metadata-v0",
            "sampleId": sample_id,
            "sampleLayer": "scene",
            "targetImage": "target.png",
            "blueprintFile": "blueprint.v1.json",
        })

    files = row.get("files") if isinstance(row.get("files"), dict) else {}
    generated = Path(str(files.get("generated") or row.get("generated") or ""))
    original_target_path = target_sample / "source-target.png"
    if (target_sample / "target.png").is_file():
        shutil.copy2(target_sample / "target.png", original_target_path)
    else:
        copy_optional_file(files.get("target") or row.get("target"), original_target_path)
    if not generated.is_file():
        raise ValueError(f"missing allowlist generated image for {sample_id}: {generated}")
    shutil.copy2(generated, target_sample / "target.png")

    metadata_path = target_sample / "metadata.json"
    metadata = read_json(metadata_path) if metadata_path.is_file() else {}
    metadata.update({
        "schemaVersion": metadata.get("schemaVersion") or "training-sample-metadata-v0",
        "sampleId": sample_id,
        "stageId": stage_id,
        "trainingTargetSource": training_target_source,
        "allowlistScore": row.get("score"),
        "allowlistStatus": row.get("status"),
        "sourceQualityReport": row.get("sourceQualityReport"),
        "sourceTrainingVersion": row.get("sourceTrainingVersion"),
        "sourceModelVersion": row.get("sourceModelVersion"),
        "sourceGenerated": str(generated.resolve()),
        "sourceOriginalTarget": str(original_target_path.resolve()) if original_target_path.is_file() else None,
        "targetSha256": sha256_file(target_sample / "target.png"),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "negativeExamplesMayTrainAsTarget": False,
    })
    write_json(metadata_path, metadata)

    return {
        "sampleId": sample_id,
        "score": row.get("score"),
        "target": str((target_sample / "target.png").resolve()),
        "sourceTarget": str(original_target_path.resolve()) if original_target_path.is_file() else None,
        "blueprint": str((target_sample / "blueprint.v1.json").resolve()),
        "masks": str((target_sample / "masks_v1").resolve()),
        "targetSha256": metadata["targetSha256"],
        "sourceQualityReport": row.get("sourceQualityReport"),
    }


def copy_blueprint(row: dict[str, Any], target_sample: Path) -> None:
    files = row.get("files") if isinstance(row.get("files"), dict) else {}
    source = Path(str(files.get("blueprint") or row.get("blueprint") or ""))
    if not source.is_file():
        raise ValueError(f"missing blueprint for {row.get('sampleId')}: {source}")
    shutil.copy2(source, target_sample / "blueprint.v1.json")


def copy_mask_dir(row: dict[str, Any], target_sample: Path) -> None:
    files = row.get("files") if isinstance(row.get("files"), dict) else {}
    source = Path(str(files.get("masks_v1") or ""))
    if not source.is_dir():
        raise ValueError(f"missing masks_v1 for {row.get('sampleId')}: {source}")
    shutil.copytree(source, target_sample / "masks_v1")


def copy_optional_file(source: Any, target: Path) -> None:
    source_path = Path(str(source or ""))
    if source_path.is_file():
        shutil.copy2(source_path, target)


def write_index(root: Path, split: str, sample_ids: list[str]) -> None:
    write_json(root / "indexes" / f"{split}.json", {
        "schemaVersion": "dataset-index-v1",
        "split": split,
        "sampleIds": sample_ids,
    })


def build_contact_sheet(rows: list[dict[str, Any]], output_path: Path) -> Path:
    thumb_w = 128
    thumb_h = 96
    padding = 10
    label_h = 18
    columns = 4
    rows_count = (len(rows) + columns - 1) // columns
    sheet = Image.new("RGB", (
        columns * thumb_w + (columns + 1) * padding,
        rows_count * (thumb_h + label_h) + (rows_count + 1) * padding,
    ), (12, 31, 24))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, row in enumerate(rows):
        x = padding + (index % columns) * (thumb_w + padding)
        y = padding + (index // columns) * (thumb_h + label_h + padding)
        with Image.open(row["target"]) as image:
            thumb = image.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.BOX)
        sheet.paste(thumb, (x, y))
        label = f"{index + 1:02d} score {float(row.get('score') or 0):.1f}"
        draw.text((x, y + thumb_h + 3), label, fill=(145, 255, 188), font=font)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


def row_key(row: dict[str, Any]) -> str:
    files = row.get("files") if isinstance(row.get("files"), dict) else {}
    sample_id = str(row.get("sampleId") or "")
    generated = str(files.get("generated") or row.get("generated") or "")
    return f"{sample_id}|{hash_text(generated)}"


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

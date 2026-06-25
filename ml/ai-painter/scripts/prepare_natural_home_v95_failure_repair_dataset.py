from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
import json
from pathlib import Path
import shutil
from typing import Any

from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH
from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


FOCUS_FAILURES = {
    "edge_density_ratio_above_vj1_line",
    "mae_under_vj1_line",
    "mask_boundary_ratio_above_vj1_line",
    "psnr_above_vj1_line",
    "score_above_vj1_line",
    "sharpness_ratio_above_vj1_line",
    "water_artifact_delta_under_vj1_line",
}


def main() -> int:
    parser = ArgumentParser(description="Prepare V95 natural-home failure-repair dataset from V93 clean data and V94 review reports.")
    parser.add_argument("--source-dataset-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v93-clean-generalization-dataset"))
    parser.add_argument("--quality-report", type=Path, default=Path(".runtime/ai-painter/natural-home-v94-edge-sharpness-repair-quality-selection/latest.json"))
    parser.add_argument("--vj1-report", type=Path, default=Path(".runtime/ai-painter/natural-home-v94-edge-sharpness-repair-vj1-review/latest.json"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v95-failure-repair-dataset"))
    parser.add_argument("--stage-id", default="natural-home-v95-failure-repair-dataset")
    parser.add_argument("--training-target-source", default="v95_v94_failure_repair_same_source_target_png")
    parser.add_argument("--max-focus-sources", type=int, default=36)
    parser.add_argument("--focus-repeat", type=int, default=2)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        preserve_runtime_dir_before_clear(args.output_root, "prepare-natural-home-v95-failure-repair-dataset")
        shutil.rmtree(args.output_root)

    source_scene_root = args.source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "indexes").mkdir(parents=True, exist_ok=True)

    source_train = read_index(args.source_dataset_root / "indexes" / "train.json")
    source_validation = read_index(args.source_dataset_root / "indexes" / "validation.json")
    source_train_set = set(source_train)
    base_ids = unique_preserve_order(source_train + source_validation)

    vj1_rows = rows_by_sample_id(read_json(args.vj1_report).get("rows", []))
    quality_rows = rows_by_sample_id(read_json(args.quality_report).get("rows", []))
    focus_sources = choose_focus_sources(source_train, vj1_rows, quality_rows, args.max_focus_sources)

    for sample_id in base_ids:
        copy_training_sample(
            source_scene_root,
            output_scene_root,
            sample_id,
            sample_id,
            args.stage_id,
            args.training_target_source,
            focus_record=None,
        )

    focus_copy_ids: list[str] = []
    focus_records: list[dict[str, Any]] = []
    for source_id in focus_sources:
        source_vj1 = vj1_rows.get(source_id, {})
        source_quality = quality_rows.get(source_id, {})
        focus_record = build_focus_record(source_id, source_vj1, source_quality)
        repeats = args.focus_repeat + extra_repeat(source_vj1, source_quality)
        for index in range(1, repeats + 1):
            copy_id = f"{source_id}__v95focus{index:02d}"
            copy_training_sample(
                source_scene_root,
                output_scene_root,
                source_id,
                copy_id,
                args.stage_id,
                args.training_target_source,
                focus_record={**focus_record, "copyIndex": index, "copyCount": repeats},
            )
            focus_copy_ids.append(copy_id)
        focus_records.append({**focus_record, "copyCount": repeats})

    train_ids = list(source_train) + focus_copy_ids
    validation_ids = list(source_validation)
    write_index(args.output_root, "train", train_ids)
    write_index(args.output_root, "validation", validation_ids)

    contact_ids = focus_copy_ids[:18] if focus_copy_ids else train_ids[:18]
    contact_sheet = build_contact_sheet(output_scene_root, contact_ids, args.output_root / "contact-sheet.png")

    manifest = {
        "schemaVersion": "natural-home-v95-failure-repair-dataset-v1",
        "status": "completed",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "qualityReport": str(args.quality_report.resolve()),
        "vj1Report": str(args.vj1_report.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "trainingTargetSource": args.training_target_source,
        "baseTrainSampleCount": len(source_train),
        "baseValidationSampleCount": len(source_validation),
        "focusSourceCount": len(focus_sources),
        "focusCopySampleCount": len(focus_copy_ids),
        "trainSampleCount": len(train_ids),
        "validationSampleCount": len(validation_ids),
        "sampleCount": len(train_ids) + len(validation_ids),
        "focusFailureReasonCounts": dict(sorted(Counter(reason for row in focus_records for reason in row["failureReasons"]).items())),
        "focusRecordsPath": str((args.output_root / "focus-records.json").resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "policy": {
            "sameSourceTargetAndMasks": True,
            "noPngGuessing": True,
            "usesFailedCandidatesAsSignalOnly": True,
            "failedGeneratedImagesAreNotTrainingTargets": True,
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "purpose": "Expand natural-home training pressure around V94 VJ-1 failures while preserving same-source target/mask truth.",
        },
    }
    write_json(args.output_root / "manifest.json", manifest)
    write_json(args.output_root / "focus-records.json", {
        "schemaVersion": "natural-home-v95-focus-records-v1",
        "stageId": args.stage_id,
        "focusSourceCount": len(focus_sources),
        "focusCopySampleCount": len(focus_copy_ids),
        "rows": focus_records,
    })
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_index(path: Path) -> list[str]:
    data = read_json(path)
    sample_ids = data.get("sampleIds")
    if not isinstance(sample_ids, list) or not all(isinstance(value, str) for value in sample_ids):
        raise ValueError(f"invalid index: {path}")
    return sample_ids


def write_index(root: Path, split: str, sample_ids: list[str]) -> None:
    write_json(root / "indexes" / f"{split}.json", {
        "schemaVersion": "dataset-index-v1",
        "split": split,
        "sampleIds": sample_ids,
        "count": len(sample_ids),
    })


def rows_by_sample_id(rows: Any) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    if not isinstance(rows, list):
        return result
    for row in rows:
        if isinstance(row, dict) and isinstance(row.get("sampleId"), str):
            result[row["sampleId"]] = row
    return result


def choose_focus_sources(
    train_ids: list[str],
    vj1_rows: dict[str, dict[str, Any]],
    quality_rows: dict[str, dict[str, Any]],
    limit: int,
) -> list[str]:
    ranked: list[tuple[float, str]] = []
    for sample_id in train_ids:
        vj1 = vj1_rows.get(sample_id, {})
        quality = quality_rows.get(sample_id, {})
        reasons = [str(reason) for reason in vj1.get("failureReasons", []) if str(reason) in FOCUS_FAILURES]
        if not reasons:
            continue
        score = float_value(vj1.get("score", quality.get("score", 0.0)))
        quality_status = str(quality.get("status", ""))
        severity = len(reasons) * 10.0 + (20.0 if quality_status == "rejected_training_candidate" else 0.0) + max(0.0, 95.0 - score)
        ranked.append((-severity, sample_id))
    return [sample_id for _severity, sample_id in sorted(ranked)[: max(0, limit)]]


def build_focus_record(source_id: str, vj1_row: dict[str, Any], quality_row: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceSampleId": source_id,
        "score": vj1_row.get("score", quality_row.get("score")),
        "qualityStatus": quality_row.get("status"),
        "vj1Status": vj1_row.get("vj1Status"),
        "failureReasons": [str(reason) for reason in vj1_row.get("failureReasons", []) if str(reason) in FOCUS_FAILURES],
        "qualityFailures": quality_row.get("failures", []),
    }


def extra_repeat(vj1_row: dict[str, Any], quality_row: dict[str, Any]) -> int:
    reasons = {str(reason) for reason in vj1_row.get("failureReasons", [])}
    extra = 0
    if "edge_density_ratio_above_vj1_line" in reasons:
        extra += 1
    if "sharpness_ratio_above_vj1_line" in reasons:
        extra += 1
    if quality_row.get("status") == "rejected_training_candidate":
        extra += 1
    return min(extra, 3)


def copy_training_sample(
    source_scene_root: Path,
    output_scene_root: Path,
    source_id: str,
    target_id: str,
    stage_id: str,
    training_target_source: str,
    *,
    focus_record: dict[str, Any] | None,
) -> None:
    source_dir = source_scene_root / source_id
    target_dir = output_scene_root / target_id
    if not source_dir.exists():
        raise ValueError(f"missing source sample: {source_id}")
    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(source_dir, target_dir)

    metadata_path = target_dir / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["sampleId"] = target_id
    metadata["sourceSampleId"] = metadata.get("sourceSampleId") or source_id.split("__v28-", 1)[0]
    metadata["sourceOriginalSampleId"] = source_id
    metadata["stageId"] = stage_id
    metadata["trainingTargetSource"] = training_target_source
    metadata["sourceOriginalTarget"] = str((target_dir / "source-target.png").resolve())
    metadata["displayAllowed"] = False
    metadata["canPromoteToWorld"] = False
    if focus_record:
        metadata["v95FailureRepairFocus"] = focus_record
    write_json(metadata_path, metadata)

    blueprint_path = target_dir / "blueprint.v1.json"
    if blueprint_path.exists():
        blueprint = read_json(blueprint_path)
        if "sceneId" in blueprint:
            blueprint["sceneId"] = target_id
        write_json(blueprint_path, blueprint)


def build_contact_sheet(scene_root: Path, sample_ids: list[str], output_path: Path) -> Path:
    gap = 10
    label_height = 22
    columns = 3
    cell_w = CANVAS_WIDTH
    cell_h = CANVAS_HEIGHT + label_height
    rows = max(1, (len(sample_ids) + columns - 1) // columns)
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, sample_id in enumerate(sample_ids):
        target_path = scene_root / sample_id / "target.png"
        if not target_path.exists():
            continue
        with Image.open(target_path) as image:
            target = image.convert("RGB")
        col = index % columns
        row = index // columns
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        draw.text((x, y), sample_id.replace("natural-home-", "")[:36], fill="#dff8e6")
        sheet.paste(target, (x, y + label_height))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return output_path


def unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def float_value(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


if __name__ == "__main__":
    raise SystemExit(main())

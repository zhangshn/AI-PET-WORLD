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
    parser = ArgumentParser(description="Prepare V97 natural-home edge, sharpness, and boundary repair dataset.")
    parser.add_argument("--source-dataset-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v96-clean-multilayout-dataset"))
    parser.add_argument("--quality-report", type=Path, default=Path(".runtime/ai-painter/natural-home-v96-clean-multilayout-quality-selection/latest.json"))
    parser.add_argument("--vj1-report", type=Path, default=Path(".runtime/ai-painter/natural-home-v96-clean-multilayout-vj1-review/latest.json"))
    parser.add_argument("--output-root", type=Path, default=Path(".runtime/ai-painter/natural-home-v97-edge-boundary-repair-dataset"))
    parser.add_argument("--stage-id", default="natural-home-v97-edge-boundary-repair-dataset")
    parser.add_argument("--training-target-source", default="v97_edge_boundary_repair_same_source_target_png")
    parser.add_argument("--max-focus-sources", type=int, default=42)
    parser.add_argument("--focus-repeat", type=int, default=2)
    parser.add_argument("--copy-suffix", default="v97repair")
    parser.add_argument("--schema-version", default="natural-home-v97-edge-boundary-repair-dataset-v1")
    parser.add_argument(
        "--policy-purpose",
        default="Repair V96 VJ-1 edge density, sharpness, MAE/PSNR, and mask-boundary failures without buildings, characters, animals, or dynamic content.",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        preserve_runtime_dir_before_clear(args.output_root, "prepare-natural-home-v97-edge-boundary-repair-dataset")
        shutil.rmtree(args.output_root)

    source_scene_root = args.source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    output_scene_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "indexes").mkdir(parents=True, exist_ok=True)

    source_train = unique_preserve_order(read_index(args.source_dataset_root / "indexes" / "train.json"))
    source_train_set = set(source_train)
    source_validation = [
        sample_id
        for sample_id in unique_preserve_order(read_index(args.source_dataset_root / "indexes" / "validation.json"))
        if sample_id not in source_train_set
    ]
    base_ids = unique_preserve_order(source_train + source_validation)

    vj1_rows = rows_by_sample_id(read_optional_json(args.vj1_report).get("rows", []))
    quality_rows = rows_by_sample_id(read_optional_json(args.quality_report).get("rows", []))
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
    for focus_source_id in focus_sources:
        focus_record = build_focus_record(focus_source_id, vj1_rows.get(focus_source_id, {}), quality_rows.get(focus_source_id, {}))
        repeats = args.focus_repeat + extra_repeat(focus_record)
        for index in range(1, repeats + 1):
            copy_id = f"{focus_source_id}__{args.copy_suffix}{index:02d}"
            copy_training_sample(
                source_scene_root,
                output_scene_root,
                focus_source_id,
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

    contact_ids = diverse_contact_ids(train_ids, focus_copy_ids)
    contact_sheet = build_contact_sheet(output_scene_root, contact_ids, args.output_root / "contact-sheet.png")

    manifest = {
        "schemaVersion": args.schema_version,
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
        "sourceCoverageCount": len({source_id(sample_id) for sample_id in base_ids}),
        "variantCoverage": dict(sorted(Counter(variant_id(sample_id) for sample_id in base_ids).items())),
        "focusFailureReasonCounts": dict(sorted(Counter(reason for row in focus_records for reason in row["failureReasons"]).items())),
        "focusPolicyCounts": dict(sorted(Counter(reason for row in focus_records for reason in row["repairFocus"]).items())),
        "focusRecordsPath": str((args.output_root / "focus-records.json").resolve()),
        "contactSheet": str(contact_sheet.resolve()),
        "policy": {
            "sameSourceTargetAndMasks": True,
            "noPngGuessing": True,
            "usesFailedCandidatesAsLightweightSignalOnly": True,
            "failedGeneratedImagesAreNotTrainingTargets": True,
            "displayAllowed": False,
            "canPromoteToWorld": False,
            "purpose": args.policy_purpose,
        },
    }
    write_json(args.output_root / "manifest.json", manifest)
    write_json(args.output_root / "latest.json", manifest)
    write_json(args.output_root / "focus-records.json", {
        "schemaVersion": "natural-home-v97-focus-records-v1",
        "stageId": args.stage_id,
        "focusSourceCount": len(focus_sources),
        "focusCopySampleCount": len(focus_copy_ids),
        "rows": focus_records,
    })
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_optional_json(path: Path) -> dict[str, Any]:
    try:
        return read_json(path)
    except FileNotFoundError:
        return {}


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
        repair_weight = repair_weight_from_reasons(reasons)
        quality_bonus = 16.0 if quality_status == "passed_for_next_training" else 0.0
        rejection_penalty = 6.0 if quality_status == "rejected_training_candidate" else 0.0
        severity = repair_weight + quality_bonus + rejection_penalty + max(0.0, 96.0 - score)
        ranked.append((-severity, sample_id))
    return unique_preserve_order([sample_id for _severity, sample_id in sorted(ranked)])[: max(0, limit)]


def build_focus_record(source_id: str, vj1_row: dict[str, Any], quality_row: dict[str, Any]) -> dict[str, Any]:
    reasons = [str(reason) for reason in vj1_row.get("failureReasons", []) if str(reason) in FOCUS_FAILURES]
    return {
        "sourceSampleId": source_id,
        "score": vj1_row.get("score", quality_row.get("score")),
        "qualityStatus": quality_row.get("status"),
        "vj1Status": vj1_row.get("vj1Status"),
        "failureReasons": reasons,
        "repairFocus": repair_focus_from_reasons(reasons),
        "qualityFailures": quality_row.get("failures", []),
    }


def repair_focus_from_reasons(reasons: list[str]) -> list[str]:
    focus: list[str] = []
    reason_set = set(reasons)
    if "edge_density_ratio_above_vj1_line" in reason_set:
        focus.append("edge_density")
    if "sharpness_ratio_above_vj1_line" in reason_set:
        focus.append("sharpness")
    if "mask_boundary_ratio_above_vj1_line" in reason_set:
        focus.append("mask_boundary")
    if "mae_under_vj1_line" in reason_set or "psnr_above_vj1_line" in reason_set:
        focus.append("target_similarity")
    if "water_artifact_delta_under_vj1_line" in reason_set:
        focus.append("water_artifact")
    return focus or ["general_vj1_quality"]


def repair_weight_from_reasons(reasons: list[str]) -> float:
    weight = 0.0
    for focus in repair_focus_from_reasons(reasons):
        if focus == "edge_density":
            weight += 18.0
        elif focus == "sharpness":
            weight += 16.0
        elif focus == "mask_boundary":
            weight += 15.0
        elif focus == "target_similarity":
            weight += 12.0
        elif focus == "water_artifact":
            weight += 8.0
        else:
            weight += 5.0
    return weight


def extra_repeat(focus_record: dict[str, Any]) -> int:
    focus = set(str(value) for value in focus_record.get("repairFocus", []))
    extra = 0
    if "edge_density" in focus:
        extra += 1
    if "sharpness" in focus:
        extra += 1
    if "mask_boundary" in focus:
        extra += 1
    if "target_similarity" in focus:
        extra += 1
    if focus_record.get("qualityStatus") == "passed_for_next_training":
        extra += 1
    return min(extra, 4)


def copy_training_sample(
    source_scene_root: Path,
    output_scene_root: Path,
    source_sample_id: str,
    target_sample_id: str,
    stage_id: str,
    training_target_source: str,
    *,
    focus_record: dict[str, Any] | None,
) -> None:
    source_dir = source_scene_root / source_sample_id
    target_dir = output_scene_root / target_sample_id
    if not source_dir.exists():
        raise ValueError(f"missing source sample: {source_sample_id}")
    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(source_dir, target_dir)

    source_target = target_dir / "source-target.png"
    if not source_target.exists():
        shutil.copy2(target_dir / "target.png", source_target)

    metadata_path = target_dir / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["sampleId"] = target_sample_id
    metadata["sourceSampleId"] = metadata.get("sourceSampleId") or source_id(source_sample_id)
    metadata["sourceOriginalSampleId"] = source_sample_id
    metadata["stageId"] = stage_id
    metadata["trainingTargetSource"] = training_target_source
    metadata["sourceOriginalTarget"] = str(source_target.resolve())
    metadata["displayAllowed"] = False
    metadata["canPromoteToWorld"] = False
    if focus_record:
        metadata["v97EdgeBoundaryRepairFocus"] = focus_record
    write_json(metadata_path, metadata)

    blueprint_path = target_dir / "blueprint.v1.json"
    if blueprint_path.exists():
        blueprint = read_json(blueprint_path)
        if "sceneId" in blueprint:
            blueprint["sceneId"] = target_sample_id
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


def diverse_contact_ids(train_ids: list[str], focus_ids: list[str]) -> list[str]:
    source_seen: set[str] = set()
    picked: list[str] = []
    for sample_id in focus_ids + train_ids:
        base = source_id(sample_id)
        if base in source_seen:
            continue
        source_seen.add(base)
        picked.append(sample_id)
        if len(picked) >= 18:
            break
    return picked or train_ids[:18]


def source_id(sample_id: str) -> str:
    return (
        sample_id.split("__v28-", 1)[0]
        .split("__v96focus", 1)[0]
        .split("__v97repair", 1)[0]
        .split("__v98repair", 1)[0]
        .split("__v99repair", 1)[0]
    )


def variant_id(sample_id: str) -> str:
    if "__v28-" not in sample_id:
        return "source"
    return (
        sample_id.split("__v28-", 1)[1]
        .split("__v96focus", 1)[0]
        .split("__v97repair", 1)[0]
        .split("__v98repair", 1)[0]
        .split("__v99repair", 1)[0]
    )


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

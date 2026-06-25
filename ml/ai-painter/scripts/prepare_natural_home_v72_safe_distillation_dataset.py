from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil
from typing import Any

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear


def main() -> int:
    parser = ArgumentParser(description="Prepare V72 natural-home safe-candidate distillation dataset.")
    parser.add_argument("--source-dataset-root", type=Path, required=True)
    parser.add_argument("--safe-pack", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--validation-count", type=int, default=4)
    parser.add_argument("--accepted-status", default="strict_safe_candidate")
    parser.add_argument("--min-score", type=float, default=0.0)
    parser.add_argument("--stage-id", default="natural-home-v72-safe-distillation-dataset")
    parser.add_argument("--training-target-source", default="v51_strict_safe_candidate_generated_png")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if not args.force:
            raise ValueError(f"output root already exists; pass --force to replace: {args.output_root}")
        preserve_runtime_dir_before_clear(args.output_root, "prepare-natural-home-distillation-dataset")
        shutil.rmtree(args.output_root)
    scene_root = args.output_root / "accepted" / "dataset_v0" / "scene" / "world"
    scene_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "indexes").mkdir(parents=True, exist_ok=True)

    safe_pack = read_json(args.safe_pack)
    rows = [row for row in safe_pack.get("rows", []) if isinstance(row, dict)]
    rows = [
        row
        for row in rows
        if row.get("status") == args.accepted_status
        and row.get("displayAllowed") is False
        and row.get("canPromoteToWorld") is False
        and float(row.get("score", 0.0)) >= args.min_score
    ]
    if len(rows) < 8:
        raise ValueError("distillation requires at least 8 accepted hidden candidates.")
    rows.sort(key=lambda row: (-float(row.get("score", 0.0)), str(row.get("sampleId", ""))))

    validation_count = max(1, min(args.validation_count, len(rows) // 4))
    validation_rows = rows[-validation_count:]
    train_rows = rows[:-validation_count]

    train_ids = [copy_row(args.source_dataset_root, scene_root, row, args.stage_id, args.training_target_source) for row in train_rows]
    validation_ids = [copy_row(args.source_dataset_root, scene_root, row, args.stage_id, args.training_target_source) for row in validation_rows]
    write_index(args.output_root, "train", train_ids)
    write_index(args.output_root, "validation", validation_ids)

    manifest = {
        "schemaVersion": "natural-home-v72-safe-distillation-dataset-v1",
        "status": "completed",
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "sourceDatasetRoot": str(args.source_dataset_root.resolve()),
        "safePack": str(args.safe_pack.resolve()),
        "acceptedStatus": args.accepted_status,
        "minScore": args.min_score,
        "outputRoot": str(args.output_root.resolve()),
        "trainSampleCount": len(train_ids),
        "validationSampleCount": len(validation_ids),
        "sampleCount": len(train_ids) + len(validation_ids),
        "note": "Distillation dataset only. target.png is a strict safe generated candidate; masks and blueprint remain bound to the original same-source world facts. Not an ApprovedFrame.",
        "rows": [
            {
                "sampleId": str(row.get("sampleId", "")),
                "score": row.get("score"),
                "sourceGenerated": row.get("generated"),
                "sourceOriginalTarget": row.get("target"),
            }
            for row in rows
        ],
    }
    write_json(args.output_root / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def copy_row(
    source_dataset_root: Path,
    output_scene_root: Path,
    row: dict[str, Any],
    stage_id: str,
    training_target_source: str,
) -> str:
    sample_id = str(row["sampleId"])
    source_sample = source_dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
    if not source_sample.exists():
        raise ValueError(f"missing source sample for safe candidate: {sample_id}")

    target_sample = output_scene_root / sample_id
    if target_sample.exists():
        shutil.rmtree(target_sample)
    shutil.copytree(source_sample, target_sample)

    original_target = target_sample / "source-target.png"
    shutil.copy2(target_sample / "target.png", original_target)
    shutil.copy2(Path(str(row["generated"])), target_sample / "target.png")

    metadata_path = target_sample / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["stageId"] = stage_id
    metadata["trainingTargetSource"] = training_target_source
    metadata["safeCandidateScore"] = row.get("score")
    metadata["safeCandidateSha256"] = row.get("sha256")
    metadata["sourceOriginalTarget"] = str(original_target.resolve())
    metadata["displayAllowed"] = False
    metadata["canPromoteToWorld"] = False
    write_json(metadata_path, metadata)
    return sample_id


def write_index(root: Path, split: str, sample_ids: list[str]) -> None:
    write_json(root / "indexes" / f"{split}.json", {
        "schemaVersion": "dataset-index-v1",
        "split": split,
        "sampleIds": sample_ids,
    })


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

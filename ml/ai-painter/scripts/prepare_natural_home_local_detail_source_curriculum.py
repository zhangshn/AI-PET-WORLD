from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Prepare source-grouped curriculum datasets for natural-home local detail training.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--train-limit", type=int, default=8)
    parser.add_argument("--validation-limit", type=int, default=3)
    parser.add_argument("--source-id", default="")
    args = parser.parse_args()

    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    result: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        source_category_root = args.source_root / category
        train_ids = json.loads((source_category_root / "train.json").read_text(encoding="utf-8"))["sampleIds"]
        validation_ids = json.loads((source_category_root / "validation.json").read_text(encoding="utf-8"))["sampleIds"]
        chosen_source = args.source_id or choose_source_id(source_category_root, train_ids, validation_ids)
        selected_train = filter_by_source(source_category_root, train_ids, chosen_source)[: args.train_limit]
        selected_validation = filter_by_source(source_category_root, validation_ids, chosen_source)[: args.validation_limit]
        if not selected_train:
            raise ValueError(f"no train samples for {category} source {chosen_source}")
        if not selected_validation:
            selected_validation = selected_train[-1:]

        target_category_root = args.output_root / category
        for sample_id in sorted(set(selected_train + selected_validation)):
            copy_sample(source_category_root, target_category_root, sample_id)

        write_index(target_category_root / "train.json", selected_train)
        write_index(target_category_root / "validation.json", selected_validation)
        result[category] = {
            "sourceId": chosen_source,
            "trainSampleCount": len(selected_train),
            "validationSampleCount": len(selected_validation),
            "trainSampleIds": selected_train,
            "validationSampleIds": selected_validation,
        }

    summary = {
        "schemaVersion": "natural-home-local-detail-source-curriculum-dataset-v1",
        "status": "completed",
        "categoryCount": len(NATURAL_CATEGORIES),
        "trainLimit": args.train_limit,
        "validationLimit": args.validation_limit,
        "categories": result,
        "note": "Diagnostic curriculum dataset only. It reduces visual variance before returning to full multi-source training.",
    }
    (args.output_root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def choose_source_id(root: Path, train_ids: list[str], validation_ids: list[str]) -> str:
    counts: dict[str, int] = {}
    for sample_id in train_ids + validation_ids:
        source_id = read_source_id(root, sample_id)
        counts[source_id] = counts.get(source_id, 0) + 1
    if not counts:
        raise ValueError(f"no samples in {root}")
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]


def filter_by_source(root: Path, sample_ids: list[str], source_id: str) -> list[str]:
    return [sample_id for sample_id in sample_ids if read_source_id(root, sample_id) == source_id]


def read_source_id(root: Path, sample_id: str) -> str:
    metadata = json.loads((root / "samples" / sample_id / "metadata.json").read_text(encoding="utf-8"))
    value = metadata.get("sourceId")
    if not isinstance(value, str) or not value:
        raise ValueError(f"missing sourceId for {sample_id}")
    return value


def copy_sample(source_root: Path, target_root: Path, sample_id: str) -> None:
    source = source_root / "samples" / sample_id
    target = target_root / "samples" / sample_id
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target)


def write_index(path: Path, sample_ids: list[str]) -> None:
    payload = {
        "schemaVersion": "natural-home-local-source-curriculum-index-v1",
        "sampleIds": sample_ids,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

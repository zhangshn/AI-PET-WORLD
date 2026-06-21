from __future__ import annotations

from argparse import ArgumentParser
from collections import defaultdict
import json
from pathlib import Path
import shutil


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Prepare multi-source curriculum datasets for natural-home local detail training.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--source-count", type=int, default=3)
    parser.add_argument("--train-per-source", type=int, default=2)
    parser.add_argument("--validation-per-source", type=int, default=1)
    args = parser.parse_args()

    if args.source_count < 1:
        raise ValueError("--source-count must be >= 1")
    if args.train_per_source < 1:
        raise ValueError("--train-per-source must be >= 1")
    if args.validation_per_source < 1:
        raise ValueError("--validation-per-source must be >= 1")

    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    category_results: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        source_category_root = args.source_root / category
        train_ids = read_index(source_category_root / "train.json")
        validation_ids = read_index(source_category_root / "validation.json")
        grouped = group_samples_by_source(source_category_root, train_ids, validation_ids)
        chosen_sources = choose_sources(grouped, args.source_count)
        selected_train: list[str] = []
        selected_validation: list[str] = []

        for source_id in chosen_sources:
            selected_validation.extend(grouped[source_id]["validation"][: args.validation_per_source])
            selected_train.extend(grouped[source_id]["train"][: args.train_per_source])

        selected_validation = unique_preserve_order(selected_validation)
        selected_train = [sample_id for sample_id in unique_preserve_order(selected_train) if sample_id not in set(selected_validation)]
        if not selected_train and selected_validation:
            selected_train = selected_validation[:-1]
            selected_validation = selected_validation[-1:]
        if not selected_train:
            raise ValueError(f"no train samples for category: {category}")
        if not selected_validation:
            selected_validation = selected_train[-min(len(selected_train), args.validation_per_source) :]
            selected_train = selected_train[: -len(selected_validation)]
        if not selected_train:
            raise ValueError(f"cannot split train/validation without overlap for category: {category}")

        target_category_root = args.output_root / category
        for sample_id in sorted(set(selected_train + selected_validation)):
            copy_sample(source_category_root, target_category_root, sample_id)

        write_index(target_category_root / "train.json", selected_train)
        write_index(target_category_root / "validation.json", selected_validation)
        category_results[category] = {
            "sourceIds": chosen_sources,
            "sourceCount": len(chosen_sources),
            "trainSampleCount": len(selected_train),
            "validationSampleCount": len(selected_validation),
            "trainSampleIds": selected_train,
            "validationSampleIds": selected_validation,
        }

    summary = {
        "schemaVersion": "natural-home-local-detail-multisource-curriculum-dataset-v1",
        "status": "completed",
        "categoryCount": len(NATURAL_CATEGORIES),
        "sourceCount": args.source_count,
        "trainPerSource": args.train_per_source,
        "validationPerSource": args.validation_per_source,
        "categories": category_results,
        "note": "Diagnostic multi-source curriculum dataset. It expands v10 source-locked training without jumping directly to full visual variance.",
    }
    (args.output_root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def read_index(path: Path) -> list[str]:
    return json.loads(path.read_text(encoding="utf-8"))["sampleIds"]


def group_samples_by_source(root: Path, train_ids: list[str], validation_ids: list[str]) -> dict[str, dict[str, list[str]]]:
    grouped: dict[str, dict[str, list[str]]] = defaultdict(lambda: {"train": [], "validation": []})
    for sample_id in train_ids:
        grouped[read_source_id(root, sample_id)]["train"].append(sample_id)
    for sample_id in validation_ids:
        grouped[read_source_id(root, sample_id)]["validation"].append(sample_id)
    return dict(grouped)


def choose_sources(grouped: dict[str, dict[str, list[str]]], limit: int) -> list[str]:
    scored = sorted(
        grouped.items(),
        key=lambda item: (
            -len(item[1]["train"]),
            -len(item[1]["validation"]),
            item[0],
        ),
    )
    return [source_id for source_id, _ in scored[:limit]]


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
        "schemaVersion": "natural-home-local-multisource-curriculum-index-v1",
        "sampleIds": sample_ids,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Prepare visually sane local-detail curriculum datasets.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--train-limit", type=int, default=8)
    parser.add_argument("--validation-limit", type=int, default=3)
    args = parser.parse_args()

    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    report: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        source_category_root = args.source_root / category
        train_ids = read_index(source_category_root / "train.json")
        validation_ids = read_index(source_category_root / "validation.json")
        ranked_train = rank_samples(source_category_root, category, train_ids)
        ranked_validation = rank_samples(source_category_root, category, validation_ids)
        selected_train = [item["sampleId"] for item in ranked_train[: args.train_limit]]
        selected_validation = [item["sampleId"] for item in ranked_validation[: args.validation_limit]]
        if not selected_train:
            raise ValueError(f"no visually sane train samples for {category}")
        if not selected_validation:
            selected_validation = selected_train[-1:]

        target_category_root = args.output_root / category
        for sample_id in sorted(set(selected_train + selected_validation)):
            copy_sample(source_category_root, target_category_root, sample_id)
        write_index(target_category_root / "train.json", selected_train)
        write_index(target_category_root / "validation.json", selected_validation)

        report[category] = {
            "trainSampleCount": len(selected_train),
            "validationSampleCount": len(selected_validation),
            "trainSamples": [item for item in ranked_train if item["sampleId"] in selected_train],
            "validationSamples": [item for item in ranked_validation if item["sampleId"] in selected_validation],
            "rejectedTrainCount": max(0, len(train_ids) - len(ranked_train)),
            "rejectedValidationCount": max(0, len(validation_ids) - len(ranked_validation)),
        }

    summary = {
        "schemaVersion": "natural-home-local-detail-visual-curriculum-dataset-v1",
        "status": "completed",
        "categoryCount": len(NATURAL_CATEGORIES),
        "trainLimit": args.train_limit,
        "validationLimit": args.validation_limit,
        "categories": report,
        "note": "Diagnostic dataset only. It rejects patches whose visible RGB evidence does not match their category.",
    }
    (args.output_root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def read_index(path: Path) -> list[str]:
    return json.loads(path.read_text(encoding="utf-8"))["sampleIds"]


def rank_samples(root: Path, category: str, sample_ids: list[str]) -> list[dict[str, object]]:
    ranked: list[dict[str, object]] = []
    for sample_id in sample_ids:
        sample_root = root / "samples" / sample_id
        target = np.array(Image.open(sample_root / "target.png").convert("RGB"), dtype=np.uint8)
        score, evidence = visible_score(category, target)
        if score <= 0.0:
            continue
        metadata = json.loads((sample_root / "metadata.json").read_text(encoding="utf-8"))
        focus_pixels = focus_pixel_count(sample_root, metadata.get("focusChannels", []))
        if focus_pixels < 32:
            continue
        ranked.append(
            {
                "sampleId": sample_id,
                "sourceId": metadata.get("sourceId", ""),
                "x": metadata.get("x"),
                "y": metadata.get("y"),
                "focusPixels": focus_pixels,
                "visibleScore": round(score, 6),
                "evidence": evidence,
            }
        )
    ranked.sort(key=lambda item: (-float(item["visibleScore"]), -int(item["focusPixels"]), str(item["sampleId"])))
    return ranked


def focus_pixel_count(sample_root: Path, focus_channels: object) -> int:
    if not isinstance(focus_channels, list) or not focus_channels:
        return 0
    merged: np.ndarray | None = None
    for channel in focus_channels:
        if not isinstance(channel, str):
            continue
        mask_path = sample_root / "masks" / f"{channel}.png"
        if not mask_path.exists():
            continue
        mask = np.array(Image.open(mask_path).convert("L"), dtype=np.uint8)
        merged = mask if merged is None else np.maximum(merged, mask)
    if merged is None:
        return 0
    return int(np.count_nonzero(merged))


def visible_score(category: str, image: np.ndarray) -> tuple[float, dict[str, float]]:
    r = image[:, :, 0].astype(np.float32)
    g = image[:, :, 1].astype(np.float32)
    b = image[:, :, 2].astype(np.float32)
    maxc = np.maximum.reduce([r, g, b])
    minc = np.minimum.reduce([r, g, b])
    saturation = (maxc - minc) / np.maximum(maxc, 1.0)

    green = (g > r * 1.08) & (g > b * 1.02) & (g > 55)
    dark_green = green & (g < 170)
    water = (b > 70) & (g > 70) & (b >= r * 1.12) & (g >= r * 1.05)
    tan = (r > 105) & (g > 80) & (b < 95) & (r >= g * 0.9) & (g >= b * 1.1)
    brown = (r > 75) & (g > 45) & (b < 75) & (r > b * 1.25)
    gray = (maxc > 70) & (maxc < 205) & (saturation < 0.22)

    ratios = {
        "greenRatio": ratio(green),
        "darkGreenRatio": ratio(dark_green),
        "waterRatio": ratio(water),
        "tanRatio": ratio(tan),
        "brownRatio": ratio(brown),
        "grayRatio": ratio(gray),
    }
    if category == "grass":
        score = ratios["greenRatio"] - ratios["waterRatio"] * 0.4
        return (score if ratios["greenRatio"] >= 0.22 else 0.0), ratios
    if category == "water":
        score = ratios["waterRatio"] - ratios["tanRatio"] * 0.5
        return (score if ratios["waterRatio"] >= 0.18 else 0.0), ratios
    if category == "shoreline":
        score = ratios["waterRatio"] * 0.65 + max(ratios["tanRatio"], ratios["brownRatio"]) * 0.55
        return (score if ratios["waterRatio"] >= 0.08 and max(ratios["tanRatio"], ratios["brownRatio"]) >= 0.04 else 0.0), ratios
    if category == "road":
        score = ratios["tanRatio"] + ratios["brownRatio"] * 0.6 - ratios["darkGreenRatio"] * 0.4
        return (score if ratios["tanRatio"] >= 0.12 else 0.0), ratios
    if category == "tree":
        score = ratios["darkGreenRatio"] + ratios["brownRatio"] * 0.15
        return (score if ratios["darkGreenRatio"] >= 0.28 else 0.0), ratios
    if category == "rock":
        score = ratios["grayRatio"] - ratios["waterRatio"] * 0.25
        return (score if ratios["grayRatio"] >= 0.06 else 0.0), ratios
    return 0.0, ratios


def ratio(mask: np.ndarray) -> float:
    return float(np.count_nonzero(mask) / mask.size)


def copy_sample(source_root: Path, target_root: Path, sample_id: str) -> None:
    source = source_root / "samples" / sample_id
    target = target_root / "samples" / sample_id
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target)


def write_index(path: Path, sample_ids: list[str]) -> None:
    payload = {
        "schemaVersion": "natural-home-local-visual-curriculum-index-v1",
        "sampleIds": sample_ids,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

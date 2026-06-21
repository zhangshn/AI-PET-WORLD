from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

from PIL import Image, ImageDraw


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Build a source-expert route manifest from source-locked local detail models.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--inference-root", type=Path, required=True)
    parser.add_argument("--diagnosis", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    dataset_summary = read_json(args.dataset_root / "summary.json")
    inference = read_json(args.inference_root / "latest.json")
    diagnosis = read_json(args.diagnosis)
    diagnosis_by_category = {item["category"]: item for item in diagnosis.get("categories", [])}
    failures = diagnosis.get("failures", [])
    output_categories: list[dict[str, object]] = []
    route_failures: list[dict[str, str]] = []

    args.output_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []
    for item in inference.get("categories", []):
        category = str(item["category"])
        if category not in NATURAL_CATEGORIES:
            continue
        source_id = source_for_category(dataset_summary, category)
        checkpoint = args.model_root / category / "best.pt"
        category_failures = [failure for failure in failures if str(failure.get("code", "")).startswith(f"{category}_")]
        diagnosis_item = diagnosis_by_category.get(category, {})
        route_status = "pass_candidate" if checkpoint.exists() and not category_failures else "failed"
        if route_status != "pass_candidate":
            route_failures.append(
                {
                    "code": f"{category}_source_expert_not_ready",
                    "severity": "high",
                    "message": f"{category} 来源专家未达到候选标准。",
                }
            )

        generated_path = copy_image(Path(str(item["generated"])), args.output_root / f"{category}-generated.png")
        target_path = copy_image(Path(str(item["target"])), args.output_root / f"{category}-target.png")
        row = {
            "category": category,
            "sourceId": source_id,
            "routeStatus": route_status,
            "checkpoint": str(checkpoint.resolve()),
            "generated": str(generated_path.resolve()),
            "target": str(target_path.resolve()),
            "sampleId": item.get("sampleId"),
            "epoch": item.get("epoch"),
            "step": item.get("step"),
            "loss": item.get("loss"),
            "metrics": diagnosis_item.get("metrics"),
        }
        rows.append(row)
        output_categories.append(row)

    contact_sheet = build_contact_sheet(rows)
    contact_sheet_path = args.output_root / "contact-sheet.png"
    contact_sheet.save(contact_sheet_path)

    manifest = {
        "schemaVersion": "natural-home-source-expert-route-v1",
        "status": "pass_candidate" if not route_failures else "failed",
        "displayAllowed": False,
        "stageId": "natural-home-v1-no-building-source-expert-route",
        "trainingVersion": "source-expert-route-from-v10-source-locked",
        "modelVersion": "natural-home-local-detail-v13-source-expert-route",
        "sourceDataset": str(args.dataset_root),
        "sourceModelRoot": str(args.model_root),
        "sourceDiagnosis": str(args.diagnosis),
        "contactSheet": str(contact_sheet_path.resolve()),
        "metrics": aggregate_metrics(output_categories),
        "categories": output_categories,
        "failures": route_failures,
        "note": "This is a local model expert routing artifact. It is not an ApprovedFrame and cannot enter /world.",
    }
    (args.output_root / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_root / "route-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def source_for_category(dataset_summary: dict[str, object], category: str) -> str:
    categories = dataset_summary.get("categories", {})
    if not isinstance(categories, dict):
        return "unknown"
    item = categories.get(category, {})
    if not isinstance(item, dict):
        return "unknown"
    value = item.get("sourceId")
    return value if isinstance(value, str) and value else "unknown"


def copy_image(source: Path, target: Path) -> Path:
    if not source.exists():
        raise FileNotFoundError(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target


def aggregate_metrics(categories: list[dict[str, object]]) -> dict[str, float]:
    names = ("mae", "psnr", "sharpnessRatio", "edgeDensityRatio")
    values: dict[str, list[float]] = {name: [] for name in names}
    for category in categories:
        metrics = category.get("metrics")
        if not isinstance(metrics, dict):
            continue
        for name in names:
            value = metrics.get(name)
            if isinstance(value, (float, int)):
                values[name].append(float(value))
    return {name: sum(items) / len(items) for name, items in values.items() if items}


def build_contact_sheet(rows: list[dict[str, object]]) -> Image.Image:
    first_target = Image.open(str(rows[0]["target"])).convert("RGB")
    patch_size = first_target.width
    label_height = 34
    gap = 12
    columns_width = patch_size * 2 + gap
    width = columns_width * 2 + gap * 3
    row_height = patch_size + label_height + gap
    height = row_height * 3 + gap
    sheet = Image.new("RGB", (width, height), "#071510")
    draw = ImageDraw.Draw(sheet)
    for index, row in enumerate(rows):
        column = index % 2
        row_index = index // 2
        x = gap + column * (columns_width + gap)
        y = gap + row_index * row_height
        category = str(row["category"])
        source_id = str(row["sourceId"])
        label = f"{category}: target / expert | {source_id[:32]}"
        draw.text((x, y), label, fill="#dff8e6")
        target = Image.open(str(row["target"])).convert("RGB")
        generated = Image.open(str(row["generated"])).convert("RGB")
        sheet.paste(target, (x, y + label_height))
        sheet.paste(generated, (x + patch_size + gap, y + label_height))
    return sheet


if __name__ == "__main__":
    raise SystemExit(main())

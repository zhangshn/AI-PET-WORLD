from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any

from PIL import Image, ImageDraw


DEFAULT_SOURCE_IDS = (
    "natural-home-crop-v7-01-forest-grass-east",
    "natural-home-crop-v7-06-water-shore-clean",
    "natural-home-crop-v7-12-forest-stream-clean",
)


def main() -> int:
    parser = ArgumentParser(description="Run natural-home source-expert bank training.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--source-ids", default=",".join(DEFAULT_SOURCE_IDS))
    parser.add_argument("--patch-size", type=int, default=64)
    parser.add_argument("--stride", type=int, default=16)
    parser.add_argument("--compose-stride", type=int, default=32)
    parser.add_argument("--train-limit", type=int, default=14)
    parser.add_argument("--validation-limit", type=int, default=4)
    parser.add_argument("--schema-version", default="natural-home-source-expert-bank-v18")
    parser.add_argument("--stage-id", default="natural-home-v18-source-expert-bank")
    parser.add_argument("--training-version", default="training-natural-home-local-details-v18-source-expert-bank")
    parser.add_argument("--model-version", default="natural-home-local-detail-unet-v18-source-expert-bank")
    parser.add_argument("--run-label", default="V18")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    source_ids = [item.strip() for item in args.source_ids.split(",") if item.strip()]
    if not source_ids:
        raise ValueError("At least one source id is required.")

    if args.output_root.exists() and args.force:
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    script_root = Path(__file__).resolve().parent
    dataset_root = args.dataset_root.resolve()
    config = args.config.resolve()
    output_root = args.output_root.resolve()
    dataset_bank_root = output_root / "datasets"
    training_bank_root = output_root / "training"
    inference_bank_root = output_root / "inference"
    diagnosis_bank_root = output_root / "diagnosis"

    rows: list[dict[str, Any]] = []
    for index, source_id in enumerate(source_ids, start=1):
        source_root = dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / source_id
        if not source_root.exists():
            raise FileNotFoundError(source_root)

        print(f"[{args.run_label}] {index}/{len(source_ids)} prepare {source_id}", flush=True)
        source_dataset = dataset_bank_root / source_id
        run(
            script_root / "prepare_natural_home_single_source_local_detail.py",
            "--dataset-root",
            dataset_root,
            "--source-id",
            source_id,
            "--output-root",
            source_dataset,
            "--patch-size",
            args.patch_size,
            "--stride",
            args.stride,
            "--train-limit",
            args.train_limit,
            "--validation-limit",
            args.validation_limit,
        )

        print(f"[{args.run_label}] {index}/{len(source_ids)} train {source_id}", flush=True)
        source_training = training_bank_root / source_id
        run(
            script_root / "train_natural_home_local_detail_models.py",
            "--dataset-root",
            source_dataset,
            "--config",
            config,
            "--output-root",
            source_training,
        )

        print(f"[{args.run_label}] {index}/{len(source_ids)} compose {source_id}", flush=True)
        source_inference = inference_bank_root / source_id
        run(
            script_root / "compose_natural_home_single_source_local_detail.py",
            "--dataset-root",
            dataset_root,
            "--source-id",
            source_id,
            "--model-root",
            source_training,
            "--output-root",
            source_inference,
            "--patch-size",
            args.patch_size,
            "--stride",
            args.compose_stride,
            "--style-profile",
            source_dataset / "style-profiles.json",
        )

        print(f"[{args.run_label}] {index}/{len(source_ids)} diagnose {source_id}", flush=True)
        source_diagnosis = diagnosis_bank_root / source_id
        run(
            script_root / "diagnose_natural_home_refiner.py",
            "--generated",
            source_inference / "generated.png",
            "--target",
            source_root / "target.png",
            "--sample-id",
            source_id,
            "--output-root",
            source_diagnosis,
        )

        rows.append(build_row(source_id, source_dataset, source_training, source_inference, source_diagnosis))

    contact_sheet = output_root / "contact-sheet.png"
    build_contact_sheet(rows, contact_sheet)
    manifest = {
        "schemaVersion": args.schema_version,
        "status": "pass_candidate" if all(row["diagnosisStatus"] == "pass_candidate" for row in rows) else "failed",
        "displayAllowed": False,
        "stageId": args.stage_id,
        "trainingVersion": args.training_version,
        "modelVersion": args.model_version,
        "sourceCount": len(rows),
        "contactSheet": str(contact_sheet),
        "rows": rows,
        "note": "Local source experts only. This artifact is training evidence and cannot enter /world without VisualJudge and ApprovedFrame.",
    }
    write_json(output_root / "latest.json", manifest)
    write_json(output_root / "source-expert-bank.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)
    return 0


def run(script: Path, *args: object) -> None:
    command = [sys.executable, str(script), *[str(arg) for arg in args]]
    subprocess.run(command, check=True)


def build_row(source_id: str, dataset_root: Path, training_root: Path, inference_root: Path, diagnosis_root: Path) -> dict[str, Any]:
    diagnosis = read_json(diagnosis_root / "report.json")
    composition = read_json(inference_root / "latest.json")
    training = read_json(training_root / "training-summary.json")
    metrics = diagnosis.get("metrics", {})
    comparison = metrics.get("comparison", {}) if isinstance(metrics, dict) else {}
    return {
        "sourceId": source_id,
        "datasetRoot": str(dataset_root),
        "trainingRoot": str(training_root),
        "inferenceRoot": str(inference_root),
        "diagnosisRoot": str(diagnosis_root),
        "generated": str(inference_root / "generated.png"),
        "target": str(inference_root / "target.png"),
        "contactSheet": str(inference_root / "contact-sheet.png"),
        "trainSampleCount": training.get("trainSampleCount"),
        "validationSampleCount": training.get("validationSampleCount"),
        "bestValidationLoss": training.get("bestValidationLoss"),
        "diagnosisStatus": diagnosis.get("status"),
        "mae": comparison.get("mae") if isinstance(comparison, dict) else None,
        "psnr": comparison.get("psnr") if isinstance(comparison, dict) else None,
        "sharpnessRatio": metrics.get("sharpnessRatio") if isinstance(metrics, dict) else None,
        "edgeDensityRatio": metrics.get("edgeDensityRatio") if isinstance(metrics, dict) else None,
        "failures": diagnosis.get("failures", []),
    }


def build_contact_sheet(rows: list[dict[str, Any]], output: Path) -> None:
    if not rows:
        return
    thumbs: list[tuple[str, Image.Image, Image.Image]] = []
    for row in rows:
        target = Image.open(str(row["target"])).convert("RGB")
        generated = Image.open(str(row["generated"])).convert("RGB")
        target.thumbnail((320, 240), Image.Resampling.NEAREST)
        generated.thumbnail((320, 240), Image.Resampling.NEAREST)
        thumbs.append((str(row["sourceId"]), target.copy(), generated.copy()))

    width = 680
    row_height = 300
    height = row_height * len(thumbs) + 20
    sheet = Image.new("RGB", (width, height), "#071510")
    draw = ImageDraw.Draw(sheet)
    y = 10
    for source_id, target, generated in thumbs:
        draw.text((12, y), source_id[:88], fill="#dff8e6")
        draw.text((12, y + 20), "target", fill="#8ee6b0")
        draw.text((350, y + 20), "generated", fill="#8ee6b0")
        sheet.paste(target, (12, y + 42))
        sheet.paste(generated, (350, y + 42))
        y += row_height
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> int:
    parser = ArgumentParser(description="Diagnose pure natural-home local detail inference outputs.")
    parser.add_argument("--inference-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    latest = json.loads((args.inference_root / "latest.json").read_text(encoding="utf-8"))
    category_reports = []
    failures = []
    for item in latest["categories"]:
        generated = np.asarray(Image.open(item["generated"]).convert("RGB"), dtype=np.float32) / 255.0
        target = np.asarray(Image.open(item["target"]).convert("RGB"), dtype=np.float32) / 255.0
        metrics = compare_images(generated, target)
        category_reports.append({**item, "metrics": metrics})
        if metrics["sharpnessRatio"] < 0.72:
            failures.append(
                {
                    "code": f"{item['category']}_sharpness_too_low",
                    "severity": "high",
                    "message": "局部输出仍然偏糊。",
                }
            )
        if metrics["edgeDensityRatio"] < 0.65:
            failures.append(
                {
                    "code": f"{item['category']}_edge_density_too_low",
                    "severity": "high",
                    "message": "局部像素边缘密度不足。",
                }
            )
        if metrics["mae"] > 0.13:
            failures.append(
                {
                    "code": f"{item['category']}_color_error_too_high",
                    "severity": "medium",
                    "message": "局部颜色偏差过高。",
                }
            )

    report = {
        "schemaVersion": "natural-home-local-detail-diagnosis-v1",
        "status": "failed" if failures else "pass_candidate",
        "displayAllowed": False,
        "stageId": latest.get("stageId"),
        "device": latest.get("device"),
        "categoryCount": len(category_reports),
        "metrics": aggregate_metrics(category_reports),
        "categories": category_reports,
        "failures": failures,
        "note": "Local detail outputs are training diagnostics only. They cannot enter the formal world without VisualJudge and ApprovedFrame.",
    }
    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def compare_images(generated: np.ndarray, target: np.ndarray) -> dict[str, float]:
    mae = float(np.mean(np.abs(generated - target)))
    mse = float(np.mean((generated - target) ** 2))
    psnr = 99.0 if mse == 0 else float(20 * math.log10(1.0 / math.sqrt(mse)))
    generated_edges = edge_magnitude(generated)
    target_edges = edge_magnitude(target)
    generated_sharpness = float(np.mean(generated_edges))
    target_sharpness = float(np.mean(target_edges))
    generated_edge_density = float(np.mean(generated_edges > 0.08))
    target_edge_density = float(np.mean(target_edges > 0.08))
    return {
        "mae": mae,
        "psnr": psnr,
        "sharpnessRatio": ratio(generated_sharpness, target_sharpness),
        "edgeDensityRatio": ratio(generated_edge_density, target_edge_density),
        "generatedSharpness": generated_sharpness,
        "targetSharpness": target_sharpness,
        "generatedEdgeDensity": generated_edge_density,
        "targetEdgeDensity": target_edge_density,
    }


def edge_magnitude(image: np.ndarray) -> np.ndarray:
    horizontal = np.abs(image[:, 1:, :] - image[:, :-1, :]).mean(axis=2)
    vertical = np.abs(image[1:, :, :] - image[:-1, :, :]).mean(axis=2)
    height = min(horizontal.shape[0], vertical.shape[0])
    width = min(horizontal.shape[1], vertical.shape[1])
    return (horizontal[:height, :width] + vertical[:height, :width]) * 0.5


def ratio(value: float, target: float) -> float:
    if target <= 0:
        return 1.0 if value <= 0 else 0.0
    return float(value / target)


def aggregate_metrics(category_reports: list[dict[str, object]]) -> dict[str, float]:
    metric_names = ("mae", "psnr", "sharpnessRatio", "edgeDensityRatio")
    return {
        name: float(np.mean([item["metrics"][name] for item in category_reports]))  # type: ignore[index]
        for name in metric_names
    }


if __name__ == "__main__":
    raise SystemExit(main())

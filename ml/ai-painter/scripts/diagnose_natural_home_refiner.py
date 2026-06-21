from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


def main() -> int:
    parser = ArgumentParser(description="Diagnose natural-home RGB refiner inference quality.")
    parser.add_argument("--generated", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--sample-id", required=True)
    args = parser.parse_args()

    generated = load_rgb(args.generated)
    target = load_rgb(args.target)
    if generated.shape != target.shape:
        raise ValueError(f"image size mismatch: generated={generated.shape}, target={target.shape}")

    generated_gray = to_gray(generated)
    target_gray = to_gray(target)
    generated_metrics = image_metrics(generated)
    target_metrics = image_metrics(target)
    comparison = comparison_metrics(generated, target)
    failures = diagnose_failures(generated_metrics, target_metrics, comparison)

    report: dict[str, Any] = {
        "schemaVersion": "natural-home-refiner-diagnosis-v1",
        "sampleId": args.sample_id,
        "status": "failed" if failures else "pass_candidate",
        "displayAllowed": False,
        "reviewScope": "local_model_training_diagnosis_only",
        "inputs": {
            "generated": str(args.generated.resolve()),
            "target": str(args.target.resolve()),
        },
        "metrics": {
            "generated": generated_metrics,
            "target": target_metrics,
            "comparison": comparison,
            "sharpnessRatio": safe_ratio(generated_metrics["laplacianVariance"], target_metrics["laplacianVariance"]),
            "edgeDensityRatio": safe_ratio(generated_metrics["edgeDensity"], target_metrics["edgeDensity"]),
        },
        "failures": failures,
        "nextTrainingPlan": build_next_training_plan(failures, generated_metrics, target_metrics, comparison),
    }

    args.output_root.mkdir(parents=True, exist_ok=True)
    output_path = args.output_root / "report.json"
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def load_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        pixels = np.array(image.convert("RGB"), dtype=np.float32) / 255.0
    return pixels


def to_gray(rgb: np.ndarray) -> np.ndarray:
    return rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114


def image_metrics(rgb: np.ndarray) -> dict[str, float]:
    gray = to_gray(rgb)
    gx = np.diff(gray, axis=1, append=gray[:, -1:])
    gy = np.diff(gray, axis=0, append=gray[-1:, :])
    gradient = np.sqrt(gx * gx + gy * gy)
    laplacian = (
        -4.0 * gray
        + np.roll(gray, 1, axis=0)
        + np.roll(gray, -1, axis=0)
        + np.roll(gray, 1, axis=1)
        + np.roll(gray, -1, axis=1)
    )
    channel_ranges = rgb.reshape(-1, 3).max(axis=0) - rgb.reshape(-1, 3).min(axis=0)
    unique_colors = np.unique((rgb * 255.0).round().astype(np.uint8).reshape(-1, 3), axis=0).shape[0]
    return {
        "laplacianVariance": round(float(np.var(laplacian)), 6),
        "edgeDensity": round(float(np.mean(gradient > 0.08)), 6),
        "meanGradient": round(float(np.mean(gradient)), 6),
        "colorRangeMean": round(float(np.mean(channel_ranges)), 6),
        "uniqueColorRatio": round(float(unique_colors / (rgb.shape[0] * rgb.shape[1])), 6),
        "brightness": round(float(np.mean(gray)), 6),
        "contrast": round(float(np.std(gray)), 6),
    }


def comparison_metrics(generated: np.ndarray, target: np.ndarray) -> dict[str, float]:
    diff = generated - target
    mse = float(np.mean(diff * diff))
    mae = float(np.mean(np.abs(diff)))
    psnr = 99.0 if mse <= 1e-12 else float(20.0 * np.log10(1.0 / np.sqrt(mse)))
    return {
        "mse": round(mse, 6),
        "mae": round(mae, 6),
        "psnr": round(psnr, 4),
    }


def diagnose_failures(generated: dict[str, float], target: dict[str, float], comparison: dict[str, float]) -> list[dict[str, Any]]:
    failures: list[dict[str, Any]] = []
    sharpness_ratio = safe_ratio(generated["laplacianVariance"], target["laplacianVariance"])
    edge_ratio = safe_ratio(generated["edgeDensity"], target["edgeDensity"])
    color_ratio = safe_ratio(generated["colorRangeMean"], target["colorRangeMean"])

    if sharpness_ratio < 0.58:
        failures.append({
            "code": "too_blurry",
            "severity": "high",
            "message": "推理图锐度明显低于训练目标，不能进入玩家世界。",
        })
    if edge_ratio < 0.72:
        failures.append({
            "code": "edge_density_too_low",
            "severity": "high",
            "message": "像素边缘密度不足，树、水岸、岩石等结构边界偏糊。",
        })
    if color_ratio < 0.68:
        failures.append({
            "code": "color_range_collapsed",
            "severity": "medium",
            "message": "颜色范围收窄，画面容易发灰或糊成一片。",
        })
    if comparison["mae"] > 0.16:
        failures.append({
            "code": "target_distance_too_high",
            "severity": "medium",
            "message": "推理图与同源训练目标差异过大，说明 RGB Refiner 仍未学稳。",
        })
    if generated["uniqueColorRatio"] < 0.08:
        failures.append({
            "code": "pixel_detail_density_too_low",
            "severity": "medium",
            "message": "有效颜色细节密度不足，距离 MVP 像素画质量仍较远。",
        })
    return failures


def build_next_training_plan(
    failures: list[dict[str, Any]],
    generated: dict[str, float],
    target: dict[str, float],
    comparison: dict[str, float],
) -> list[str]:
    codes = {failure["code"] for failure in failures}
    plan: list[str] = []
    if "too_blurry" in codes or "edge_density_too_low" in codes:
        plan.append("提高 RGB Refiner 边缘损失权重，并增加高频纹理保持损失。")
        plan.append("优先补充树冠、水岸、岩石边缘清楚的纯自然家园训练图。")
    if "color_range_collapsed" in codes:
        plan.append("降低过强平滑倾向，增加颜色范围和局部对比约束。")
    if "target_distance_too_high" in codes:
        plan.append("先缩小学习率并延长训练，再观察验证集是否稳定下降。")
    if "pixel_detail_density_too_low" in codes:
        plan.append("增加同风格高细节样本，并避免把低清晰草稿图混入训练集。")
    if not plan:
        plan.append("当前诊断未发现硬失败，可进入更严格 VisualJudge 图片质量审核。")
    plan.append(
        f"当前参考指标：锐度 {generated['laplacianVariance']} / 目标 {target['laplacianVariance']}，"
        f"MAE {comparison['mae']}。"
    )
    return plan


def safe_ratio(left: float, right: float) -> float:
    if right <= 1e-9:
        return 0.0
    return round(float(left / right), 6)


if __name__ == "__main__":
    raise SystemExit(main())

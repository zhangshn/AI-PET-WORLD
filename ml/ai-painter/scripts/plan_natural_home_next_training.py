from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
from typing import Any


def main() -> int:
    parser = ArgumentParser(description="Plan the next natural-home RGB refiner training run.")
    parser.add_argument("--diagnosis", type=Path, required=True)
    parser.add_argument("--current-config", type=Path, required=True)
    parser.add_argument("--training-summary", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    diagnosis = read_json(args.diagnosis)
    config = read_json(args.current_config)
    summary = read_json(args.training_summary)
    failures = {item.get("code") for item in diagnosis.get("failures", []) if isinstance(item, dict)}
    metrics = diagnosis.get("metrics", {}) if isinstance(diagnosis.get("metrics"), dict) else {}
    comparison = metrics.get("comparison", {}) if isinstance(metrics.get("comparison"), dict) else {}
    known_best = config.get("knownBestMetrics", {}) if isinstance(config.get("knownBestMetrics"), dict) else {}
    regressed_from_known_best = is_regressed(metrics, comparison, known_best)

    next_config = dict(config)
    loss_weights = dict(config.get("lossWeights", {}))
    decisions: list[dict[str, Any]] = []

    current_edge_weight = float(loss_weights.get("edge", 1.0))
    current_texture_weight = float(loss_weights.get("texture", 1.0))
    loss_escalation_saturated = current_edge_weight >= 2.6 and current_texture_weight >= 1.8

    if regressed_from_known_best:
        decisions.append({
            "code": "regressed_from_known_best",
            "reason": "当前推理指标低于已知最佳结果，不能继续沿用本轮调参方向。",
        })

    if "too_blurry" in failures and not loss_escalation_saturated and not regressed_from_known_best:
        loss_weights["edge"] = bounded(float(loss_weights.get("edge", 1.0)) * 1.18, 1.0, 3.2)
        loss_weights["texture"] = bounded(float(loss_weights.get("texture", 1.0)) * 1.12, 1.0, 2.4)
        next_config["residualPenalty"] = bounded(float(config.get("residualPenalty", 0.05)) * 0.75, 0.01, 0.08)
        next_config["residualScale"] = bounded(float(config.get("residualScale", 0.35)) + 0.04, 0.2, 0.5)
        decisions.append({
            "code": "increase_high_frequency_learning",
            "reason": "当前锐度比低于目标，下一轮提高边缘/纹理学习并降低残差保守约束。",
        })
    elif "too_blurry" in failures:
        decisions.append({
            "code": "stop_loss_only_escalation",
            "reason": "高边缘/纹理权重仍未解决模糊，继续堆损失权重可能恶化画面，应转向补高质量数据或升级模型结构。",
        })

    if "edge_density_too_low" in failures and not loss_escalation_saturated and not regressed_from_known_best:
        structure_weights = dict(config.get("structureWeights", {}))
        for key in ("water", "shoreline", "road", "roadEdge", "tree", "rock"):
            structure_weights[key] = bounded(float(structure_weights.get(key, 1.0)) * 1.08, 1.0, 2.8)
        next_config["structureWeights"] = structure_weights
        decisions.append({
            "code": "boost_natural_boundary_regions",
            "reason": "水岸、树冠、岩石等区域边缘不足，下一轮提高自然边界区域权重。",
        })
    elif "edge_density_too_low" in failures:
        decisions.append({
            "code": "needs_boundary_data_or_model_capacity",
            "reason": "自然边界区域加权已较高但边缘密度仍不足，下一步需要更多清晰边界样本或更强细节模型。",
        })

    if "color_range_collapsed" in failures and not regressed_from_known_best:
        loss_weights["texture"] = bounded(float(loss_weights.get("texture", 1.0)) * 1.08, 1.0, 2.6)
        decisions.append({
            "code": "protect_color_range",
            "reason": "颜色范围不足，下一轮增加局部纹理和颜色差异保持。",
        })

    if comparison.get("mae", 0) and float(comparison["mae"]) > 0.05 and not regressed_from_known_best:
        next_config["learningRate"] = bounded(float(config.get("learningRate", 0.0001)) * 0.85, 0.00004, 0.00018)
        decisions.append({
            "code": "stabilize_learning_rate",
            "reason": "目标差异偏高时降低学习率，避免颜色和结构大幅漂移。",
        })

    next_config["lossWeights"] = loss_weights
    if not loss_escalation_saturated and not regressed_from_known_best:
        next_config["maxEpochs"] = int(min(max(int(config.get("maxEpochs", 220)) + 40, 220), 320))
    else:
        next_config["maxEpochs"] = int(config.get("maxEpochs", 260))
    next_config["trainingVersion"] = "training-rgb-refiner-natural-home-v1-planned"
    next_config["status"] = "planned_from_local_diagnosis_not_auto_applied"

    data_actions = [
        "补充树冠、水岸、岩石边缘清楚的纯自然家园训练图。",
        "剔除过糊、低对比、重复构图或边缘不清楚的训练图。",
    ]
    if (loss_escalation_saturated or regressed_from_known_best) and failures:
        data_actions.append("暂停继续上调 edge/texture 权重，先补数据或升级细节模型后再重训。")
    if not failures:
        data_actions = ["当前没有硬失败，可进入更严格 VJ-1 审核或扩大验证集。"]

    plan = {
        "schemaVersion": "natural-home-next-training-plan-v1",
        "sourceDiagnosis": str(args.diagnosis.resolve()),
        "sourceConfig": str(args.current_config.resolve()),
        "sourceTrainingSummary": str(args.training_summary.resolve()),
        "status": "needs_data_or_model_change" if (loss_escalation_saturated or regressed_from_known_best) and failures else "ready_for_next_run" if failures else "ready_for_visual_judge",
        "autoApplied": False,
        "decisions": decisions,
        "dataActions": data_actions,
        "nextConfigPreview": next_config,
        "trainingCommand": "npm run train:ai-painter-natural-home-rgb-refiner && npm run infer:ai-painter-natural-home-rgb-refiner && npm run diagnose:ai-painter-natural-home-rgb-refiner",
        "currentRun": {
            "epochs": summary.get("epochs"),
            "bestValidationLoss": summary.get("bestValidationLoss"),
            "trainSampleCount": summary.get("trainSampleCount"),
            "validationSampleCount": summary.get("validationSampleCount"),
        },
        "knownBestMetrics": known_best,
    }

    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_root / "next-config-preview.json").write_text(json.dumps(next_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(plan, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def bounded(value: float, minimum: float, maximum: float) -> float:
    return round(min(max(value, minimum), maximum), 6)


def is_regressed(metrics: dict[str, Any], comparison: dict[str, Any], known_best: dict[str, Any]) -> bool:
    if not known_best:
        return False
    sharpness = float(metrics.get("sharpnessRatio", 0.0) or 0.0)
    edge = float(metrics.get("edgeDensityRatio", 0.0) or 0.0)
    mae = float(comparison.get("mae", 999.0) or 999.0)
    best_sharpness = float(known_best.get("sharpnessRatio", 0.0) or 0.0)
    best_edge = float(known_best.get("edgeDensityRatio", 0.0) or 0.0)
    best_mae = float(known_best.get("mae", 999.0) or 999.0)
    return sharpness < best_sharpness * 0.98 or edge < best_edge * 0.98 or mae > best_mae * 1.02


if __name__ == "__main__":
    raise SystemExit(main())

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "natural-home-v102-formal-vj2-diagnostic-v1"


def main() -> int:
    parser = ArgumentParser(description="Analyze formal natural-home VJ-2 failures before planning V102.")
    parser.add_argument("--formal-vj1", type=Path, required=True)
    parser.add_argument("--formal-vj2", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--stage-id", default="natural-home-v102-formal-vj2-diagnostic")
    parser.add_argument("--target-vj2-min-score", type=float, default=96.0)
    args = parser.parse_args()

    formal_vj1 = read_json(args.formal_vj1)
    formal_vj2 = read_json(args.formal_vj2)
    rows = build_rows(formal_vj1, formal_vj2, args.target_vj2_min_score)
    summary = summarize(rows, formal_vj1, formal_vj2)
    conclusion = conclude(summary)
    training_plan = build_training_plan(conclusion, rows)

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "stageId": args.stage_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "approvedFrameStatus": "not_written",
        "sourceReports": {
            "formalVj1": str(args.formal_vj1.resolve()),
            "formalVj2": str(args.formal_vj2.resolve()),
        },
        "reviewScope": "aip_4_formal_vj2_failure_diagnosis_only",
        "summary": summary,
        "rows": rows,
        "conclusion": conclusion,
        "v102TrainingPlan": training_plan,
        "notes": [
            "This report is diagnostic only. It must not lower formal VJ-2 thresholds.",
            "It must not write ApprovedFrame.",
            "It must not expand into characters, buildings, animals, dynamics, VisualUnit, town, or city modules.",
        ],
    }

    args.output_root.mkdir(parents=True, exist_ok=True)
    write_json(args.output_root / "latest.json", report)
    write_json(args.output_root / "diagnostic-report.json", report)
    print(
        json.dumps(
            {
                "status": conclusion["status"],
                "canStartV102": conclusion["canStartV102"],
                "formalVj1PassedCount": summary["formalVj1PassedCount"],
                "formalVj2PassedCount": summary["formalVj2PassedCount"],
                "bestScore": summary["bestScore"],
                "bestScoreGapToVj2": summary["bestScoreGapToVj2"],
                "nextAction": conclusion["nextAction"],
            },
            ensure_ascii=True,
            indent=2,
        ),
    )
    return 0


def build_rows(formal_vj1: dict[str, Any], formal_vj2: dict[str, Any], min_score: float) -> list[dict[str, Any]]:
    vj1_rows_by_id = {
        str(row.get("sampleId")): row
        for row in formal_vj1.get("rows", [])
        if isinstance(row, dict) and row.get("sampleId")
    }
    rows: list[dict[str, Any]] = []
    for row in formal_vj2.get("rows", []):
        if not isinstance(row, dict):
            continue
        sample_id = str(row.get("sampleId"))
        vj1_row = vj1_rows_by_id.get(sample_id, {})
        score = number(row.get("formalVisualScore", row.get("score")))
        source_training_quality_score = number(row.get("sourceTrainingQualityScore", row.get("score")))
        score_gap = round_float(max(0.0, min_score - score))
        vj1_metrics = vj1_row.get("metrics") if isinstance(vj1_row.get("metrics"), dict) else {}
        style_metrics = row.get("visualStyleMetrics") if isinstance(row.get("visualStyleMetrics"), dict) else {}
        row_failure_reasons = list(row.get("failureReasons", [])) if isinstance(row.get("failureReasons"), list) else []
        vj1_failure_reasons = list(vj1_row.get("failureReasons", [])) if isinstance(vj1_row.get("failureReasons"), list) else []
        rows.append(
            {
                "sampleId": sample_id,
                "score": round_float(score),
                "formalVisualScore": round_float(score),
                "sourceTrainingQualityScore": round_float(source_training_quality_score),
                "scoreGapToVj2": score_gap,
                "vj1Status": row.get("vj1Status"),
                "vj2Status": row.get("vj2Status"),
                "formalVj1Passed": row.get("vj1Status") == "vj_1_passed",
                "formalVj2Passed": row.get("vj2Passed") is True,
                "vj2FailureReasons": row_failure_reasons,
                "vj1FailureReasons": vj1_failure_reasons,
                "v102Focus": choose_focus(row_failure_reasons, vj1_failure_reasons, score_gap, vj1_metrics, style_metrics),
                "generated": row.get("generated"),
                "blueprint": row.get("blueprint"),
                "activeChannels": row.get("activeChannels", []),
                "visualStyleMetrics": style_metrics,
                "formalVj1Metrics": vj1_metrics,
            },
        )
    rows.sort(key=lambda item: (-int(item["formalVj1Passed"]), item["scoreGapToVj2"], str(item["sampleId"])))
    return rows


def choose_focus(
    vj2_reasons: list[Any],
    vj1_reasons: list[Any],
    score_gap: float,
    vj1_metrics: dict[str, Any],
    style_metrics: dict[str, Any],
) -> list[str]:
    reasons = {str(item) for item in vj2_reasons + vj1_reasons}
    focus: list[str] = []
    if "formal_visual_score_above_minimal_vj2_line" in reasons or "score_above_minimal_vj2_line" in reasons:
        focus.append("raise_formal_world_score_without_lowering_vj2_threshold")
    if "sharpness_ratio_above_vj1_line" in reasons:
        focus.append("increase_sharpness_and_micro_edge_clarity")
    if "edge_density_ratio_above_vj1_line" in reasons:
        focus.append("increase_natural_boundary_edge_density")
    if score_gap > 0:
        focus.append(f"close_vj2_score_gap_{score_gap}")
    sharpness = number(vj1_metrics.get("sharpnessRatio"))
    if sharpness > 0 and sharpness < 0.86:
        focus.append("repair_soft_output_before_candidate_generation")
    luminance_std = number(style_metrics.get("luminanceStdDev"))
    if luminance_std > 0 and luminance_std < 35.0:
        focus.append("slightly_increase_local_contrast_and_pixel_texture")
    if not focus:
        focus.append("hold_current_strategy_and_expand_validation_samples")
    return dedupe(focus)


def summarize(rows: list[dict[str, Any]], formal_vj1: dict[str, Any], formal_vj2: dict[str, Any]) -> dict[str, Any]:
    vj2_reason_counts: Counter[str] = Counter()
    vj1_reason_counts: Counter[str] = Counter()
    focus_counts: Counter[str] = Counter()
    for row in rows:
        vj2_reason_counts.update(str(item) for item in row["vj2FailureReasons"])
        vj1_reason_counts.update(str(item) for item in row["vj1FailureReasons"])
        focus_counts.update(str(item) for item in row["v102Focus"])
    return {
        "rowCount": len(rows),
        "formalVj1PassedCount": sum(1 for row in rows if row["formalVj1Passed"]),
        "formalVj2PassedCount": sum(1 for row in rows if row["formalVj2Passed"]),
        "averageScore": round_float(sum(number(row.get("score")) for row in rows) / len(rows) if rows else 0.0),
        "bestScore": round_float(max((number(row.get("score")) for row in rows), default=0.0)),
        "worstScore": round_float(min((number(row.get("score")) for row in rows), default=0.0)),
        "averageSourceTrainingQualityScore": round_float(
            sum(number(row.get("sourceTrainingQualityScore")) for row in rows) / len(rows) if rows else 0.0,
        ),
        "bestSourceTrainingQualityScore": round_float(max((number(row.get("sourceTrainingQualityScore")) for row in rows), default=0.0)),
        "bestScoreGapToVj2": round_float(min((number(row.get("scoreGapToVj2")) for row in rows), default=0.0)),
        "vj1JudgeProfile": formal_vj1.get("judgeProfile"),
        "vj2SourceVj1JudgeProfile": formal_vj2.get("sourceVj1JudgeProfile"),
        "vj2FailureReasonCounts": dict(sorted(vj2_reason_counts.items())),
        "vj1FailureReasonCounts": dict(sorted(vj1_reason_counts.items())),
        "v102FocusCounts": dict(sorted(focus_counts.items())),
    }


def conclude(summary: dict[str, Any]) -> dict[str, Any]:
    if summary["formalVj2PassedCount"] > 0:
        return {
            "status": "formal_vj2_candidate_available",
            "canStartV102": False,
            "nextAction": "Do not train V102 yet. Start ApprovedFrame binding review for the passing candidate.",
            "reasonZh": "已经有 formal VJ-2 通过候选，下一步应该做 ApprovedFrame 绑定校验。",
        }
    if summary["formalVj1PassedCount"] == 0:
        return {
            "status": "blocked_before_vj2_by_formal_vj1",
            "canStartV102": True,
            "nextAction": "Train only for formal VJ-1 quality failures before trying VJ-2 again.",
            "reasonZh": "没有任何候选通过 formal VJ-1，必须先修清晰度、边缘和自然结构。",
        }
    best_gap = number(summary.get("bestScoreGapToVj2"))
    if 0 < best_gap <= 3.0:
        return {
            "status": "near_pass_formal_vj2_score_line",
            "canStartV102": True,
            "nextAction": "Run targeted quality repair. Do not lower VJ-2 minScore.",
            "reasonZh": "已有候选通过 formal VJ-1，但 VJ-2 分数差距较小，应做定向质量修复。",
        }
    return {
        "status": "formal_vj2_quality_gap_large",
        "canStartV102": True,
        "nextAction": "Train only after adding clear natural-home samples or improving detail learning.",
        "reasonZh": "formal VJ-1 有通过样本，但 VJ-2 分数差距仍明显，需要补数据或修细节学习。",
    }


def build_training_plan(conclusion: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    focus_counts: Counter[str] = Counter()
    for row in rows:
        focus_counts.update(row.get("v102Focus", []))
    return {
        "stage": "AIP-5 targeted quality repair",
        "allowedToStart": bool(conclusion.get("canStartV102")),
        "primaryFocus": [item for item, _count in focus_counts.most_common(6)],
        "allowedActions": [
            "继续使用纯自然家园范围：草地、水体、水岸、道路、树、石、花草、空间深度。",
            "提高候选清晰度、局部对比、自然边缘和像素细节。",
            "保留所有成功、失败、候选、日志、耗时、GPU 与来源记录。",
            "训练后重新跑 formal VJ-1 与 formal VJ-2。",
        ],
        "forbiddenActions": [
            "不得降低 formal VJ-2 minScore。",
            "不得加入建筑、人物、动物、动态、VisualUnit、小镇或城市。",
            "不得把训练诊断或 VJ-1 当作 ApprovedFrame 依据。",
            "不得把候选图、局部图、crop、patch、tile、sprite 写入 /world。",
        ],
        "acceptance": {
            "formalVj1": "validation candidates have at least 1 formal VJ-1 pass",
            "formalVj2": "validation candidates have at least 1 formal VJ-2 pass",
            "approvedFrame": "not automatic; binding review must run after VJ-2 pass",
            "worldPage": "must stay blocked until ApprovedFrame is written and current runtime facts match",
        },
    }


def dedupe(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed


def round_float(value: float) -> float:
    return round(float(value), 6)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

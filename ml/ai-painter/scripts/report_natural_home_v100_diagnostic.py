from __future__ import annotations

from argparse import ArgumentParser
from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any


def main() -> int:
    parser = ArgumentParser(description="Summarize V100 natural-home diagnostic results.")
    parser.add_argument("--target-self-vj1", type=Path, required=True)
    parser.add_argument("--single-vj1", type=Path)
    parser.add_argument("--subset-vj1", type=Path)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--stage-id", default="natural-home-v100-diagnostic-report")
    args = parser.parse_args()

    args.output_root.mkdir(parents=True, exist_ok=True)
    target_self = read_optional_json(args.target_self_vj1)
    single = read_optional_json(args.single_vj1) if args.single_vj1 else {}
    subset = read_optional_json(args.subset_vj1) if args.subset_vj1 else {}

    checkpoints = [
        build_checkpoint("target_self_vj1", target_self, "原始目标图自检 VJ-1"),
        build_checkpoint("single_reproduction_vj1", single, "单样本复现 VJ-1"),
        build_checkpoint("subset_reproduction_vj1", subset, "小样本复现 VJ-1"),
    ]
    conclusion = conclude(checkpoints)
    report = {
        "schemaVersion": "natural-home-v100-diagnostic-report-v1",
        "status": conclusion["status"],
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "stageId": args.stage_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "checkpoints": checkpoints,
        "conclusion": conclusion,
        "note": "Diagnostic report only. It decides whether broad V100+ training is meaningful.",
    }
    write_json(args.output_root / "latest.json", report)
    write_json(args.output_root / "diagnostic-report.json", report)
    print(json.dumps(conclusion, ensure_ascii=False, indent=2))
    return 0


def build_checkpoint(key: str, report: dict[str, Any], label: str) -> dict[str, Any]:
    if not report:
        return {
            "key": key,
            "label": label,
            "status": "not_run",
            "passedCount": 0,
            "rowCount": 0,
            "failureReasonCounts": {},
        }
    summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
    passed_count = int(summary.get("vj1PassedCount") or summary.get("passedCount") or 0)
    row_count = int(summary.get("rowCount") or report.get("rowCount") or 0)
    status = "passed" if row_count > 0 and passed_count == row_count else "failed"
    return {
        "key": key,
        "label": label,
        "status": status,
        "passedCount": passed_count,
        "rowCount": row_count,
        "failureReasonCounts": summary.get("failureReasonCounts", {}),
        "sourceReport": str(Path(str(report.get("sourceQualityReport", ""))).resolve()) if report.get("sourceQualityReport") else None,
    }


def conclude(checkpoints: list[dict[str, Any]]) -> dict[str, Any]:
    target = next(item for item in checkpoints if item["key"] == "target_self_vj1")
    single = next(item for item in checkpoints if item["key"] == "single_reproduction_vj1")
    subset = next(item for item in checkpoints if item["key"] == "subset_reproduction_vj1")
    if target["status"] == "failed":
        return {
            "status": "blocked_by_vj_threshold_or_target_quality",
            "nextAction": "Do not train. Fix VJ-1 thresholds or source target data first.",
            "reasonZh": "原始目标图自检都无法通过，继续训练没有意义。",
        }
    if single["status"] == "failed":
        return {
            "status": "blocked_by_model_or_loss_single_reproduction",
            "nextAction": "Do not run broad training. Fix model, loss, or generation path first.",
            "reasonZh": "目标图可以通过，但单样本复现不通过，说明模型、训练目标或生成路径有问题。",
        }
    if subset["status"] == "failed":
        return {
            "status": "blocked_by_small_set_reproduction",
            "nextAction": "Fix small-set reproduction before broad V100 training.",
            "reasonZh": "单样本可以通过，但小样本复现不通过，说明小集合训练策略仍有问题。",
        }
    if subset["status"] == "not_run":
        return {
            "status": "diagnostic_incomplete",
            "nextAction": "Run subset diagnostic before broad training.",
            "reasonZh": "诊断还没跑完，不能进入普通训练。",
        }
    return {
        "status": "diagnostic_passed",
        "nextAction": "Broad natural-home training may resume with controlled V100.",
        "reasonZh": "目标图、单样本和小样本诊断均通过，可以继续正式训练。",
    }


def read_optional_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "natural-home-current-mvp-quality-ready-filter-v1"


def main() -> int:
    parser = ArgumentParser(
        description="Remove quality-report blocked samples from current MVP natural-home candidates."
    )
    parser.add_argument("--candidate-filter", type=Path, required=True)
    parser.add_argument("--quality-report", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()

    candidate_filter_path = args.candidate_filter.resolve()
    quality_report_path = args.quality_report.resolve()
    output_root = args.output_root.resolve()

    candidate_filter = read_json(candidate_filter_path)
    quality_report = read_json(quality_report_path)
    blocked_by_sample = blocked_quality_samples(quality_report)

    source_rows = [
        row for row in candidate_filter.get("acceptedRows", [])
        if isinstance(row, dict)
    ]
    accepted_rows: list[dict[str, Any]] = []
    rejected_rows: list[dict[str, Any]] = []

    for row in source_rows:
        sample_id = str(row.get("sampleId", ""))
        blocked = blocked_by_sample.get(sample_id)
        result = dict(row)
        if blocked:
            result["qualityReadyDecision"] = {
                "status": "rejected_quality_report_blocked",
                "warnings": blocked.get("warnings", []),
                "reason": "quality_report_sample_not_pass",
            }
            rejected_rows.append(result)
        else:
            result["qualityReadyDecision"] = {
                "status": "accepted_for_current_mvp_quality_ready_training",
                "warnings": [],
            }
            accepted_rows.append(result)

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "stageId": "natural-home-v91-current-mvp-quality-ready-filter",
        "generatedAt": datetime.now(UTC).isoformat(),
        "candidateFilter": str(candidate_filter_path),
        "qualityReport": str(quality_report_path),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "status": "ready_for_next_training_dataset" if accepted_rows else "blocked_no_quality_ready_candidates",
        "summary": {
            "sourceAcceptedCount": len(source_rows),
            "qualityReadyAcceptedCount": len(accepted_rows),
            "qualityRejectedCount": len(rejected_rows),
            "qualityReportStatus": quality_report.get("status"),
            "qualityReportBlockedSampleCount": quality_report.get("blockedSampleCount"),
            "qualityReportForbiddenPixelTotal": quality_report.get("forbiddenPixelTotal"),
        },
        "rows": accepted_rows,
        "acceptedRows": accepted_rows,
        "rejectedRows": rejected_rows,
        "note": "Quality-ready training filter only. It never approves images for player display.",
    }

    output_root.mkdir(parents=True, exist_ok=True)
    write_json(output_root / "latest.json", report)
    write_json(output_root / "accepted-rows.json", {"rows": accepted_rows})
    write_json(output_root / "rejected-rows.json", {"rows": rejected_rows})
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


def blocked_quality_samples(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    blocked: dict[str, dict[str, Any]] = {}
    for sample in report.get("samples", []):
        if not isinstance(sample, dict):
            continue
        if sample.get("status") == "pass":
            continue
        sample_id = str(sample.get("sampleId", ""))
        if sample_id:
            blocked[sample_id] = sample
    return blocked


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

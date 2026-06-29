from __future__ import annotations

from argparse import ArgumentParser
from datetime import UTC, datetime
import json
from pathlib import Path
import shutil
import sys
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from select_natural_home_v30_candidates import (  # noqa: E402
    build_contact_sheet,
    build_report_status,
    evaluate_row,
    summarize,
    write_json,
)

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear  # noqa: E402


def main() -> int:
    parser = ArgumentParser(description="Build V100 target-self quality report for VJ threshold diagnosis.")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--stage-id", default="natural-home-v100-target-self-quality-diagnostic")
    parser.add_argument("--sample-limit", type=int, default=24)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists() and args.force:
        preserve_runtime_dir_before_clear(args.output_root, "build-natural-home-v100-target-self-quality")
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    manifest = read_json(args.manifest)
    rows = manifest.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"manifest has no rows: {args.manifest}")

    target_rows = []
    for row in rows[: max(1, args.sample_limit)]:
        if not isinstance(row, dict):
            continue
        target = row.get("target")
        target_rows.append(
            {
                **row,
                "generated": target,
                "target": target,
                "status": "needs_target_self_quality_check",
                "displayAllowed": False,
                "canPromoteToWorld": False,
                "note": "V100 diagnostic row: target image is used as generated image to test VJ/metric feasibility.",
            }
        )

    evaluated = [evaluate_row(row, min_pass_score=72.0, min_candidate_score=62.0) for row in target_rows]
    evaluated.sort(key=lambda row: (-float(row["score"]), str(row["sampleId"])))

    contact_sheet = build_contact_sheet(evaluated, args.output_root / "contact-sheet.png")
    report = {
        "schemaVersion": "natural-home-v100-target-self-quality-diagnostic-v1",
        "status": build_report_status(evaluated),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "reviewScope": "target_self_metric_feasibility_diagnostic_only",
        "stageId": args.stage_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceManifest": str(args.manifest.resolve()),
        "sourceStageId": manifest.get("stageId"),
        "sampleCount": len(evaluated),
        "summary": summarize(evaluated),
        "contactSheet": str(contact_sheet.resolve()),
        "rows": evaluated,
        "note": "If target-self rows cannot pass VJ-1, the VJ thresholds or source targets are invalid before further training.",
    }
    write_json(args.output_root / "latest.json", report)
    write_json(args.output_root / "selection-report.json", report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())

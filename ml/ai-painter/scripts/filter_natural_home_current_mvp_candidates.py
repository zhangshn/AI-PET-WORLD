from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any


CURRENT_MVP_STAGE_ID = "natural-home-current-mvp-natural-only"
SCHEMA_VERSION = "natural-home-current-mvp-candidate-filter-v1"

FORBIDDEN_TEXT_TOKENS = (
    "shelter",
    "storehouse",
    "canopy",
    "construction",
    "construct",
    "building",
    "house",
    "foundation",
    "wall",
    "roof",
    "material",
    "settlement",
    "refuge",
    "camp",
    "hut",
    "quarry",
    "work_canopy",
    "storehouse_frame",
)

FORBIDDEN_ACTIVE_CHANNELS = (
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "building",
    "facility",
    "butler",
    "character",
    "animal",
    "insect",
)


def main() -> int:
    parser = ArgumentParser(
        description="Filter natural-home training candidates to the current MVP natural-only scope."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v89-quality-selection/latest.json"),
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v90-current-mvp-natural-only-filter"),
    )
    args = parser.parse_args()

    source_path = args.source.resolve()
    output_root = args.output_root.resolve()
    source = read_json(source_path)
    rows = source.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"source selection has no rows: {source_path}")

    accepted_rows: list[dict[str, Any]] = []
    rejected_rows: list[dict[str, Any]] = []

    for row in rows:
        filtered = filter_row(row)
        if filtered["filterDecision"]["status"] == "accepted_for_current_mvp_training":
            accepted_rows.append(filtered)
        else:
            rejected_rows.append(filtered)

    report = build_report(source_path, source, rows, accepted_rows, rejected_rows)
    output_root.mkdir(parents=True, exist_ok=True)
    write_json(output_root / "latest.json", report)
    write_json(output_root / "accepted-rows.json", {"rows": accepted_rows})
    write_json(output_root / "rejected-rows.json", {"rows": rejected_rows})
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


def filter_row(row: dict[str, Any]) -> dict[str, Any]:
    reasons: list[dict[str, str]] = []
    status = str(row.get("status", ""))
    if status != "passed_for_next_training":
        reasons.append({"code": "not_passed_for_next_training", "value": status})

    text = searchable_text(row)
    for token in FORBIDDEN_TEXT_TOKENS:
        if token in text:
            reasons.append({"code": "forbidden_semantic_token", "value": token})

    active_channels = active_condition_channels(row)
    for channel in FORBIDDEN_ACTIVE_CHANNELS:
        if channel in active_channels:
            reasons.append({"code": "forbidden_active_channel", "value": channel})

    decision_status = (
        "rejected_for_current_mvp_training"
        if reasons
        else "accepted_for_current_mvp_training"
    )
    result = dict(row)
    result["filterDecision"] = {
        "stageId": CURRENT_MVP_STAGE_ID,
        "status": decision_status,
        "reasons": reasons,
    }
    return result


def searchable_text(row: dict[str, Any]) -> str:
    values = [
        row.get("sampleId"),
        row.get("generated"),
        row.get("target"),
        row.get("blueprint"),
        row.get("sourceSha256"),
    ]
    return " ".join(str(value).lower() for value in values if value is not None)


def active_condition_channels(row: dict[str, Any]) -> set[str]:
    metrics = row.get("metrics")
    if not isinstance(metrics, dict):
        return set()
    condition = metrics.get("condition")
    if not isinstance(condition, dict):
        return set()

    active = condition.get("activeChannels")
    channels: set[str] = set()
    if isinstance(active, list):
        channels.update(str(value) for value in active)

    active_areas = condition.get("activeAreas")
    if isinstance(active_areas, dict):
        for key, value in active_areas.items():
            try:
                area = float(value)
            except (TypeError, ValueError):
                continue
            if area > 0.0:
                channels.add(str(key))
    return channels


def build_report(
    source_path: Path,
    source: dict[str, Any],
    rows: list[Any],
    accepted_rows: list[dict[str, Any]],
    rejected_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    reason_counts: Counter[str] = Counter()
    token_counts: Counter[str] = Counter()
    channel_counts: Counter[str] = Counter()
    for row in rejected_rows:
        decision = row.get("filterDecision", {})
        reasons = decision.get("reasons", []) if isinstance(decision, dict) else []
        for reason in reasons:
            if not isinstance(reason, dict):
                continue
            code = str(reason.get("code", "unknown"))
            value = str(reason.get("value", ""))
            reason_counts[code] += 1
            if code == "forbidden_semantic_token":
                token_counts[value] += 1
            if code == "forbidden_active_channel":
                channel_counts[value] += 1

    summary = {
        "sourceRowCount": len(rows),
        "sourcePassedForNextTraining": sum(
            1 for row in rows if isinstance(row, dict) and row.get("status") == "passed_for_next_training"
        ),
        "acceptedForCurrentMvpTraining": len(accepted_rows),
        "rejectedForCurrentMvpTraining": len(rejected_rows),
        "reasonCounts": dict(sorted(reason_counts.items())),
        "forbiddenTokenCounts": dict(sorted(token_counts.items())),
        "forbiddenActiveChannelCounts": dict(sorted(channel_counts.items())),
    }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "stageId": CURRENT_MVP_STAGE_ID,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceSelection": str(source_path),
        "sourceStageId": source.get("sourceStageId"),
        "sourceStatus": source.get("status"),
        "reviewScope": "training_candidate_filter_only",
        "policy": {
            "allowedCurrentMvpContent": [
                "grass",
                "water_body",
                "shoreline",
                "natural_path",
                "tree_crown",
                "tree_trunk",
                "rock",
                "flowers",
                "shrubs",
                "walkable",
                "depth",
            ],
            "forbiddenTextTokens": list(FORBIDDEN_TEXT_TOKENS),
            "forbiddenActiveChannels": list(FORBIDDEN_ACTIVE_CHANNELS),
        },
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "status": "ready_for_next_training_dataset" if accepted_rows else "blocked_no_current_mvp_candidates",
        "summary": summary,
        "acceptedRows": accepted_rows,
        "rejectedRows": rejected_rows,
        "note": (
            "Derived filter only. Original V89 selection is preserved. "
            "This report does not approve any image for player display."
        ),
    }


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

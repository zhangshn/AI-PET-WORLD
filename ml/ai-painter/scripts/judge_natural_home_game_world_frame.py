from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from datetime import UTC, datetime
import json
from pathlib import Path
from typing import Any

from PIL import Image


SCHEMA_VERSION = "natural-home-game-world-frame-gate-v1"
DEFAULT_STAGE_ID = "natural-home-v117-complete-game-world-frame-gate"
MIN_RUNTIME_FRAME_WIDTH = 768
MIN_RUNTIME_FRAME_HEIGHT = 576

REQUIRED_INTENT_TAGS = {
    "complete_natural_home_mvp",
    "primary_world_view",
    "runtime_frame_source",
}

REQUIRED_ANCHORS = {
    "world_entry",
    "primary_path",
    "natural_boundary",
    "water_feature",
    "exploration_area",
    "visual_center",
}

BLOCKED_SOURCE_TOKENS = {
    "crop",
    "partial",
    "patch",
    "tile",
    "sprite",
    "diagnostic",
    "local-detail",
    "local_detail",
}


def main() -> int:
    parser = ArgumentParser(description="Gate natural-home VJ-2 candidates as complete game world frames.")
    parser.add_argument(
        "--vj2-report",
        type=Path,
        required=True,
        help="Path to a natural-home VJ-2 latest.json report.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".runtime/ai-painter/natural-home-v117-complete-game-world-frame-gate"),
    )
    parser.add_argument("--stage-id", type=str, default=DEFAULT_STAGE_ID)
    args = parser.parse_args()

    vj2_report_path = args.vj2_report.resolve()
    vj2_report = read_json(vj2_report_path)
    rows = vj2_report.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"VJ-2 report has no rows: {vj2_report_path}")

    reviewed_rows = [review_row(row) for row in rows if isinstance(row, dict)]
    reviewed_rows.sort(
        key=lambda row: (
            -int(row["gameWorldFramePassed"]),
            -float(row.get("sourceVj2Score", 0.0)),
            str(row["sampleId"]),
        )
    )
    best_passed = next((row for row in reviewed_rows if row["gameWorldFrameStatus"] == "game_world_frame_passed"), None)

    args.output_root.mkdir(parents=True, exist_ok=True)
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "stageId": args.stage_id,
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourceVj2Report": str(vj2_report_path),
        "sourceStageId": vj2_report.get("stageId"),
        "reviewScope": "natural_home_complete_game_world_frame_gate",
        "status": build_status(reviewed_rows),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "canEnterApprovedFrameCandidateReview": best_passed is not None,
        "approvedFrameStatus": "not_written",
        "policy": {
            "requiredIntentTags": sorted(REQUIRED_INTENT_TAGS),
            "requiredAnchors": sorted(REQUIRED_ANCHORS),
            "minimumRuntimeFrameSize": {
                "width": MIN_RUNTIME_FRAME_WIDTH,
                "height": MIN_RUNTIME_FRAME_HEIGHT,
                "note": "Complete game world frames must not be local crops or small natural tiles.",
            },
            "blockedSourceTokens": sorted(BLOCKED_SOURCE_TOKENS),
            "note": (
                "This gate is stricter than natural-quality VJ-2. It only allows complete game world frames "
                "with explicit world composition intent. Natural local tiles must fail here."
            ),
        },
        "summary": summarize(reviewed_rows),
        "bestCandidate": build_best_candidate(best_passed),
        "rows": reviewed_rows,
    }

    write_json(args.output_root / "latest.json", report)
    write_json(args.output_root / "review-report.json", report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


def review_row(row: dict[str, Any]) -> dict[str, Any]:
    blueprint_path = Path(str(row.get("blueprint", "")))
    blueprint = read_json(blueprint_path) if blueprint_path.exists() else {}
    generated_path = Path(str(row.get("generated", "")))
    image_metrics = inspect_generated_image(generated_path)
    game_world_intent = extract_game_world_intent(blueprint)
    source_policy = extract_source_policy(blueprint)
    intent_tags = set(game_world_intent.get("tags", []))
    anchors = set(game_world_intent.get("anchors", []))
    blocked_tokens = blocked_source_tokens(row)

    vj2_passed = row.get("vj2Status") == "vj_2_passed_minimal"
    is_complete_frame_source = source_policy.get("completeGameWorldFrameSource") is True
    is_model_generated_from_complete_condition = (
        source_policy.get("completeWorldConditionSource") is True
        and source_policy.get("requiresModelGeneration") is True
        and vj2_passed
    )

    checks = [
        check("vj2_natural_quality_must_pass", vj2_passed),
        check("candidate_must_not_be_display_allowed", row.get("displayAllowed") is False),
        check("candidate_must_not_promote_to_world", row.get("canPromoteToWorld") is False),
        check("source_must_not_be_local_or_partial", not blocked_tokens, ",".join(blocked_tokens)),
        check(
            "generated_image_must_exist",
            image_metrics.get("exists") is True,
            str(generated_path),
        ),
        check(
            "generated_image_must_be_full_runtime_resolution",
            image_metrics.get("width", 0) >= MIN_RUNTIME_FRAME_WIDTH
            and image_metrics.get("height", 0) >= MIN_RUNTIME_FRAME_HEIGHT,
            f'{image_metrics.get("width", 0)}x{image_metrics.get("height", 0)}',
        ),
        check(
            "generated_image_must_keep_four_three_ratio",
            image_metrics.get("aspectRatioOk") is True,
            str(image_metrics.get("aspectRatio", 0)),
        ),
        check(
            "complete_world_intent_tags_present",
            REQUIRED_INTENT_TAGS.issubset(intent_tags),
            ",".join(sorted(intent_tags)),
        ),
        check(
            "complete_world_anchors_present",
            REQUIRED_ANCHORS.issubset(anchors),
            ",".join(sorted(anchors)),
        ),
        check("blueprint_must_declare_complete_world_scope", game_world_intent.get("scope") == "complete_natural_home_mvp"),
        check("blueprint_must_declare_primary_world_view", game_world_intent.get("frameRole") == "primary_world_view"),
        check("runtime_frame_source_declared", game_world_intent.get("runtimeFrameSource") is True),
        check(
            "source_must_be_complete_game_world_frame_source_or_generated_from_condition",
            is_complete_frame_source or is_model_generated_from_complete_condition,
        ),
        check(
            "source_model_generation_requirement_satisfied",
            source_policy.get("requiresModelGeneration") is not True or is_model_generated_from_complete_condition,
        ),
    ]

    failed = [item for item in checks if not item["passed"]]
    status = "game_world_frame_passed" if not failed else "game_world_frame_failed"
    return {
        "sampleId": row.get("sampleId"),
        "gameWorldFrameStatus": status,
        "gameWorldFramePassed": status == "game_world_frame_passed",
        "sourceVj2Status": row.get("vj2Status"),
        "sourceVj2Score": row.get("formalVisualScore", row.get("score", 0.0)),
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "canEnterApprovedFrameCandidateReview": status == "game_world_frame_passed",
        "approvedFrameStatus": "not_written",
        "generated": str(Path(str(row.get("generated", ""))).resolve()),
        "blueprint": str(blueprint_path.resolve()),
        "imageMetrics": image_metrics,
        "gameWorldIntent": game_world_intent,
        "sourcePolicy": source_policy,
        "checks": checks,
        "failureReasons": [item["id"] for item in failed],
    }


def inspect_generated_image(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"exists": False, "width": 0, "height": 0, "aspectRatio": 0.0, "aspectRatioOk": False}
    with Image.open(path) as image:
        width, height = image.size
    aspect_ratio = width / height if height else 0.0
    return {
        "exists": True,
        "width": width,
        "height": height,
        "aspectRatio": round(aspect_ratio, 6),
        "aspectRatioOk": abs(aspect_ratio - (4 / 3)) <= 0.015,
    }


def extract_game_world_intent(blueprint: dict[str, Any]) -> dict[str, Any]:
    value = blueprint.get("gameWorldFrameIntent")
    if not isinstance(value, dict):
        value = blueprint.get("runtimeFrameIntent")
    if not isinstance(value, dict):
        value = {}

    tags = value.get("tags")
    anchors = value.get("anchors")
    return {
        "scope": value.get("scope"),
        "frameRole": value.get("frameRole"),
        "runtimeFrameSource": value.get("runtimeFrameSource") is True,
        "tags": [item for item in tags if isinstance(item, str)] if isinstance(tags, list) else [],
        "anchors": [item for item in anchors if isinstance(item, str)] if isinstance(anchors, list) else [],
    }


def extract_source_policy(blueprint: dict[str, Any]) -> dict[str, Any]:
    value = blueprint.get("sourcePolicy")
    if not isinstance(value, dict):
        return {}
    return {
        "completeWorldConditionSource": value.get("completeWorldConditionSource") is True,
        "completeGameWorldFrameSource": value.get("completeGameWorldFrameSource") is True,
        "requiresModelGeneration": value.get("requiresModelGeneration") is True,
    }


def blocked_source_tokens(row: dict[str, Any]) -> list[str]:
    text = " ".join(
        str(value)
        for value in [row.get("sampleId"), row.get("generated"), row.get("target"), row.get("blueprint")]
        if value is not None
    ).lower()
    return sorted(token for token in BLOCKED_SOURCE_TOKENS if token in text)


def check(identifier: str, passed: bool, actual: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"id": identifier, "passed": bool(passed)}
    if actual is not None:
        result["actual"] = actual
    return result


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    reason_counts: Counter[str] = Counter()
    for row in rows:
        reason_counts.update(row.get("failureReasons", []))
    passed = sum(1 for row in rows if row["gameWorldFrameStatus"] == "game_world_frame_passed")
    return {
        "rowCount": len(rows),
        "gameWorldFramePassedCount": passed,
        "gameWorldFrameFailedCount": len(rows) - passed,
        "failureReasonCounts": dict(sorted(reason_counts.items())),
    }


def build_status(rows: list[dict[str, Any]]) -> str:
    return "has_complete_game_world_frame_candidate" if any(row["gameWorldFramePassed"] for row in rows) else "blocked_no_complete_game_world_frame"


def build_best_candidate(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "sampleId": row.get("sampleId"),
        "generated": row.get("generated"),
        "blueprint": row.get("blueprint"),
        "gameWorldFrameStatus": row.get("gameWorldFrameStatus"),
    }


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

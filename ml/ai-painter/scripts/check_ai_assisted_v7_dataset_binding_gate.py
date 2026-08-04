from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from ai_painter.complete_world.dataset import is_ai_assisted_conditional_row


EXPECTED_SPLITS = {
    "train": 48,
    "validation": 8,
    "challenge": 4,
    "regression": 4,
}


def main() -> int:
    parser = ArgumentParser(description="Check the repaired V7 registered-capacity-only Dataset gate.")
    parser.add_argument("--dataset-pointer", type=Path, default=Path("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    root = Path.cwd()
    pointer = read_json(root / args.dataset_pointer)
    manifest_path = root / pointer["manifestPath"]
    manifest = read_json(manifest_path)
    source_index_path = root / manifest["sourceIndexPath"]
    source_index = read_json(source_index_path)
    source_rows = source_index.get("samples", [])

    selected_by_split = {
        split: [
            row for row in source_rows
            if is_ai_assisted_conditional_row(
                row,
                split,
                require_v7_capacity_contribution=True,
            )
        ]
        for split in EXPECTED_SPLITS
    }
    split_counts = {split: len(rows) for split, rows in selected_by_split.items()}
    selected_rows = [row for rows in selected_by_split.values() for row in rows]
    assert split_counts == EXPECTED_SPLITS, f"actual V7 split mismatch: {split_counts}"
    assert len(selected_rows) == 64, f"actual V7 loaded count must be 64, got {len(selected_rows)}"
    assert len({row.get("recordId") for row in selected_rows}) == 64, "V7 record identities must be unique"
    assert len({row.get("v7CapacitySlotId") for row in selected_rows}) == 64, "V7 capacity slots must be unique"
    assert all(row.get("v7CapacityContributionRegistered") is True for row in selected_rows), "non-capacity row entered V7 selection"

    legacy_rows = [row for row in source_rows if row.get("currentConditionIdentityMatches") is True]
    assert legacy_rows, "negative regression requires at least one legacy current-condition row"
    legacy_probe = legacy_rows[0]
    assert is_ai_assisted_conditional_row(
        legacy_probe,
        legacy_probe["split"],
        require_v7_capacity_contribution=True,
    ) is False, "legacy current-condition row entered V7 registered-capacity-only selection"

    positive_probe = selected_rows[0]
    negative_mutations = {
        "capacity_registration_removed": {"v7CapacityContributionRegistered": False, "currentConditionIdentityMatches": True},
        "owner_approval_removed": {"ownerReviewStatus": "pending_review"},
        "machine_pass_removed": {"machineReviewStatus": "rejected"},
        "condition_binding_removed": {"conditionBound": False},
        "formal_conditional_eligibility_removed": {"formalConditionalTrainingEligible": False},
        "independent_training_enabled": {"independentTrainingEligible": True},
    }
    negative_results = {}
    for name, mutation in negative_mutations.items():
        candidate = deepcopy(positive_probe)
        candidate.update(mutation)
        rejected = not is_ai_assisted_conditional_row(
            candidate,
            positive_probe["split"],
            require_v7_capacity_contribution=True,
        )
        assert rejected, f"negative Dataset binding probe was accepted: {name}"
        negative_results[name] = "rejected_as_required"

    wrong_split_rejected = not is_ai_assisted_conditional_row(
        positive_probe,
        next(split for split in EXPECTED_SPLITS if split != positive_probe["split"]),
        require_v7_capacity_contribution=True,
    )
    assert wrong_split_rejected, "cross-split row entered the wrong V7 split"

    created_at = datetime.now(timezone.utc)
    output_path = args.output or Path(
        ".runtime/ai-painter/v7-dataset-binding-regressions"
    ) / f"v7-dataset-binding-regression-{created_at.strftime('%Y-%m-%dT%H-%M-%S-%fZ')}" / "report.json"
    report = {
        "schemaVersion": "ai-assisted-v7-dataset-binding-regression-v1",
        "status": "passed",
        "createdAtUtc": created_at.isoformat().replace("+00:00", "Z"),
        "selectionMode": "v7_registered_capacity_contribution_only",
        "datasetPackageId": manifest.get("packageId"),
        "datasetManifestPath": project_path(manifest_path, root),
        "datasetManifestSha256": sha256_file(manifest_path),
        "sourceIndexPath": project_path(source_index_path, root),
        "sourceIndexSha256": sha256_file(source_index_path),
        "positive": {
            "actualLoadedCount": len(selected_rows),
            "actualSplitCounts": split_counts,
            "uniqueRecordIdCount": len({row.get("recordId") for row in selected_rows}),
            "uniqueCapacitySlotCount": len({row.get("v7CapacitySlotId") for row in selected_rows}),
            "legacyRowsMixed": 0,
        },
        "negative": {
            "legacyCurrentConditionRow": "rejected_as_required",
            "wrongSplit": "rejected_as_required",
            **negative_results,
        },
        "sourcePopulation": dict(Counter(
            "v7_capacity" if row.get("v7CapacityContributionRegistered") is True
            else "legacy_current_condition" if row.get("currentConditionIdentityMatches") is True
            else "other"
            for row in source_rows
        )),
        "formalInferenceAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    output_path = root / output_path
    output_path.parent.mkdir(parents=True, exist_ok=False)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**report, "reportPath": project_path(output_path, root), "reportSha256": sha256_file(output_path)}, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path, root: Path) -> str:
    return str(path.absolute().relative_to(root.absolute())).replace("\\", "/")


if __name__ == "__main__":
    raise SystemExit(main())

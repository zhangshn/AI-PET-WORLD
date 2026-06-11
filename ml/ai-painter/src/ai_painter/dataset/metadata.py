from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

ALLOWED_SOURCE_KINDS = {
    "ai_assisted_manual_creation",
    "self_created_bitmap",
    "commissioned_bitmap",
    "cc0_bitmap",
    "commercially_licensed_bitmap",
}


@dataclass(frozen=True)
class SourceRecord:
    kind: str
    tool_name: str
    created_at: str
    license_basis: str
    human_approved: bool
    direct_copy_prohibited: bool


@dataclass(frozen=True)
class ReviewRecord:
    reviewer: str
    reviewed_at: str
    rights_approved: bool
    blueprint_approved: bool
    visual_quality_approved: bool


@dataclass(frozen=True)
class SampleMetadata:
    schema_version: str
    sample_id: str
    dataset_version: str
    target_image: str
    blueprint_file: str
    source: SourceRecord
    review: ReviewRecord
    notes: str


def load_metadata(path: Path) -> SampleMetadata:
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_metadata_data(data)
    if errors:
        raise ValueError("; ".join(errors))
    source = data["source"]
    review = data["review"]
    return SampleMetadata(
        schema_version=data["schemaVersion"],
        sample_id=data["sampleId"],
        dataset_version=data["datasetVersion"],
        target_image=data["targetImage"],
        blueprint_file=data["blueprintFile"],
        source=SourceRecord(
            kind=source["kind"],
            tool_name=source["toolName"],
            created_at=source["createdAt"],
            license_basis=source["licenseBasis"],
            human_approved=source["humanApproved"],
            direct_copy_prohibited=source["directCopyProhibited"],
        ),
        review=ReviewRecord(
            reviewer=review["reviewer"],
            reviewed_at=review["reviewedAt"],
            rights_approved=review["rightsApproved"],
            blueprint_approved=review["blueprintApproved"],
            visual_quality_approved=review["visualQualityApproved"],
        ),
        notes=data.get("notes", ""),
    )


def validate_metadata_data(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return ["metadata must be a JSON object"]
    errors: list[str] = []
    if data.get("schemaVersion") != "training-sample-metadata-v0":
        errors.append("schemaVersion must be training-sample-metadata-v0")
    for key in ("sampleId", "datasetVersion", "targetImage", "blueprintFile"):
        if not isinstance(data.get(key), str) or not data[key]:
            errors.append(f"{key} is required")
    source = data.get("source")
    if not isinstance(source, dict):
        errors.append("source is required")
        return errors
    if source.get("kind") not in ALLOWED_SOURCE_KINDS:
        errors.append("source.kind is not allowed")
    for key in ("toolName", "createdAt", "licenseBasis"):
        if not isinstance(source.get(key), str) or not source[key]:
            errors.append(f"source.{key} is required")
    if source.get("humanApproved") is not True:
        errors.append("source.humanApproved must be true")
    if source.get("directCopyProhibited") is not True:
        errors.append("source.directCopyProhibited must be true")
    review = data.get("review")
    if not isinstance(review, dict):
        errors.append("review is required")
        return errors
    for key in ("reviewer", "reviewedAt"):
        if not isinstance(review.get(key), str) or not review[key]:
            errors.append(f"review.{key} is required")
    for key in ("rightsApproved", "blueprintApproved", "visualQualityApproved"):
        if review.get(key) is not True:
            errors.append(f"review.{key} must be true")
    return errors

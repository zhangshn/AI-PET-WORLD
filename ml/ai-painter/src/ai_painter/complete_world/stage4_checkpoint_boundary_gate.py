"""Stage 4 final-RGB boundary evidence and checkpoint eligibility gate.

This module deliberately owns no training loss and no checkpoint metric weight.  It
mirrors the route-boundary portion of
``condition-semantic-boundary-contact-v3`` and can only veto replacement of an
otherwise better scalar checkpoint candidate when visible boundary evidence
regresses.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import hashlib
import json
import math
import re
from typing import Any, Iterable, Mapping, Sequence


BOUNDARY_CONTACT_CONTRACT_VERSION = "condition-semantic-boundary-contact-v3"
CHECKPOINT_GATE_CONTRACT_VERSION = (
    "stage4-final-rgb-boundary-checkpoint-non-regression-v1"
)
BOUNDARY_VALIDATION_LEDGER_VERSION = (
    "stage4-final-rgb-boundary-validation-ledger-v1"
)
BOUNDARY_BAND_PIXELS = 6
BOUNDARY_SIDES = ("north", "east", "south", "west")
FORMAL_REVIEW_WIDTH = 1024
FORMAL_REVIEW_HEIGHT = 768
FORMAL_REVIEW_RESIZE_KERNEL = "nearest"
FORMAL_REVIEW_SOURCE_QUANTIZATION = "uint8_png_rgb"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class BoundaryCheckpointContractError(ValueError):
    """Raised when a formally enabled gate has an invalid configuration."""


def _binary_mask(values: Iterable[Any], width: int, height: int) -> tuple[int, ...]:
    if width <= 0 or height <= 0:
        raise BoundaryCheckpointContractError("boundary_canvas_invalid")
    result = tuple(1 if bool(value) else 0 for value in values)
    if len(result) != width * height:
        raise BoundaryCheckpointContractError("boundary_mask_size_mismatch")
    return result


def _boundary_counts(
    mask: Sequence[int], width: int, height: int, band_pixels: int
) -> dict[str, int]:
    counts = {side: 0 for side in BOUNDARY_SIDES}
    for y in range(height):
        for x in range(width):
            if not mask[y * width + x]:
                continue
            if y < band_pixels:
                counts["north"] += 1
            if x >= width - band_pixels:
                counts["east"] += 1
            if y >= height - band_pixels:
                counts["south"] += 1
            if x < band_pixels:
                counts["west"] += 1
    return counts


def _maximum_boundary_signal_run(
    mask: Sequence[int], width: int, height: int, band_pixels: int, side: str
) -> int:
    length = width if side in {"north", "south"} else height
    maximum_run = 0
    current_run = 0
    for coordinate in range(length):
        present = False
        for depth in range(band_pixels):
            x = (
                depth
                if side == "west"
                else width - 1 - depth
                if side == "east"
                else coordinate
            )
            y = (
                depth
                if side == "north"
                else height - 1 - depth
                if side == "south"
                else coordinate
            )
            if mask[y * width + x]:
                present = True
                break
        if present:
            current_run += 1
            maximum_run = max(maximum_run, current_run)
        else:
            current_run = 0
    return maximum_run


def _boundary_connected_component_stats(
    mask: Sequence[int], width: int, height: int, band_pixels: int
) -> dict[str, dict[str, int]]:
    result = {
        side: {
            "contactingComponentCount": 0,
            "maximumComponentSize": 0,
            "maximumComponentContactPixels": 0,
        }
        for side in BOUNDARY_SIDES
    }
    visited = bytearray(len(mask))
    for start, value in enumerate(mask):
        if not value or visited[start]:
            continue
        queue: deque[int] = deque([start])
        visited[start] = 1
        component_size = 0
        contact_counts = {side: 0 for side in BOUNDARY_SIDES}
        while queue:
            index = queue.popleft()
            component_size += 1
            x = index % width
            y = index // width
            if y < band_pixels:
                contact_counts["north"] += 1
            if x >= width - band_pixels:
                contact_counts["east"] += 1
            if y >= height - band_pixels:
                contact_counts["south"] += 1
            if x < band_pixels:
                contact_counts["west"] += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    next_x = x + dx
                    next_y = y + dy
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_index = next_y * width + next_x
                    if not mask[next_index] or visited[next_index]:
                        continue
                    visited[next_index] = 1
                    queue.append(next_index)
        for side, contact_count in contact_counts.items():
            if contact_count == 0:
                continue
            stats = result[side]
            stats["contactingComponentCount"] += 1
            stats["maximumComponentSize"] = max(
                stats["maximumComponentSize"], component_size
            )
            stats["maximumComponentContactPixels"] = max(
                stats["maximumComponentContactPixels"], contact_count
            )
    return result


def _rectangular_support_mask(
    expected: Sequence[int], width: int, height: int, radius: int
) -> tuple[int, ...]:
    integral_width = width + 1
    integral = [0] * ((width + 1) * (height + 1))
    for y in range(height):
        row_sum = 0
        for x in range(width):
            row_sum += expected[y * width + x]
            integral[(y + 1) * integral_width + x + 1] = (
                integral[y * integral_width + x + 1] + row_sum
            )
    support = [0] * len(expected)
    for y in range(height):
        top = max(0, y - radius)
        bottom = min(height - 1, y + radius)
        for x in range(width):
            left = max(0, x - radius)
            right = min(width - 1, x + radius)
            count = (
                integral[(bottom + 1) * integral_width + right + 1]
                - integral[top * integral_width + right + 1]
                - integral[(bottom + 1) * integral_width + left]
                + integral[top * integral_width + left]
            )
            support[y * width + x] = 1 if count > 0 else 0
    return tuple(support)


def isolate_condition_supported_connected_components(
    actual: Iterable[Any], expected: Iterable[Any], width: int, height: int
) -> tuple[int, ...]:
    """Mirror ``condition_supported_connected_components_v1`` exactly."""

    actual_mask = _binary_mask(actual, width, height)
    expected_mask = _binary_mask(expected, width, height)
    support = _rectangular_support_mask(expected_mask, width, height, 48)
    retained = bytearray(len(actual_mask))
    visited = bytearray(len(actual_mask))
    for start, value in enumerate(actual_mask):
        if not value or visited[start]:
            continue
        queue: deque[int] = deque([start])
        visited[start] = 1
        indexes: list[int] = []
        support_pixels = 0
        expected_overlap = 0
        while queue:
            index = queue.popleft()
            indexes.append(index)
            support_pixels += support[index]
            expected_overlap += expected_mask[index]
            x = index % width
            y = index // width
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    next_x = x + dx
                    next_y = y + dy
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_index = next_y * width + next_x
                    if not actual_mask[next_index] or visited[next_index]:
                        continue
                    visited[next_index] = 1
                    queue.append(next_index)
        support_ratio = support_pixels / len(indexes)
        keep = expected_overlap > 0 or (
            support_pixels >= 8 and support_ratio >= 0.02
        )
        if keep:
            for index in indexes:
                retained[index] = 1
    return tuple(retained)


def classify_route_rgb(
    rgb: Sequence[Sequence[int]], *, season: str
) -> tuple[int, ...]:
    """Apply the frozen Stage 4 wet/dry route color classifier."""

    dry = season == "dry_season"
    result: list[int] = []
    for pixel in rgb:
        if len(pixel) < 3:
            raise BoundaryCheckpointContractError("boundary_rgb_channel_count_invalid")
        red, green, blue = (int(pixel[0]), int(pixel[1]), int(pixel[2]))
        if not all(0 <= value <= 255 for value in (red, green, blue)):
            raise BoundaryCheckpointContractError("boundary_rgb_value_invalid")
        luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
        if dry:
            red_lead = red - green
            green_lead = green - blue
            matched = (
                red > green * 1.4
                and green > blue * 1.12
                and red_lead > green_lead
                and 80 < red < 230
                and 55 < green < 190
                and blue < 135
                and luminance > 70
            )
        else:
            matched = (
                red > green * 1.03
                and green > blue * 1.12
                and 80 < red < 230
                and 55 < green < 190
                and blue < 135
                and luminance > 70
            )
        result.append(1 if matched else 0)
    return tuple(result)


def audit_boundary_contacts(
    expected: Iterable[Any],
    supported_actual: Iterable[Any],
    raw_actual: Iterable[Any],
    width: int,
    height: int,
) -> dict[str, Any]:
    """Return the immutable v3 boundary tuple used by review and checkpoints."""

    expected_mask = _binary_mask(expected, width, height)
    supported_mask = _binary_mask(supported_actual, width, height)
    raw_mask = _binary_mask(raw_actual, width, height)
    expected_counts = _boundary_counts(
        expected_mask, width, height, BOUNDARY_BAND_PIXELS
    )
    actual_counts = _boundary_counts(
        supported_mask, width, height, BOUNDARY_BAND_PIXELS
    )
    raw_actual_counts = _boundary_counts(
        raw_mask, width, height, BOUNDARY_BAND_PIXELS
    )
    required_sides = [side for side in BOUNDARY_SIDES if expected_counts[side] > 0]
    actual_contact_sides = [
        side for side in BOUNDARY_SIDES if actual_counts[side] >= 6
    ]
    component_stats = _boundary_connected_component_stats(
        raw_mask, width, height, BOUNDARY_BAND_PIXELS
    )
    raw_contact_sides = [
        side
        for side in BOUNDARY_SIDES
        if component_stats[side]["maximumComponentSize"] >= 500
        and component_stats[side]["maximumComponentContactPixels"] >= 6
    ]
    missing_sides = []
    minimum_counts = {}
    for side in required_sides:
        # JavaScript Math.round for the non-negative formal count domain.
        minimum = max(6, math.floor(expected_counts[side] * 0.1 + 0.5))
        minimum_counts[side] = minimum
        if actual_counts[side] < minimum:
            missing_sides.append(side)
    unexpected_sides = [
        side for side in raw_contact_sides if side not in required_sides
    ]
    applicable = bool(required_sides)
    return {
        "contractVersion": BOUNDARY_CONTACT_CONTRACT_VERSION,
        "status": (
            "applicable"
            if applicable
            else "not_applicable_no_required_boundary_from_official_condition_mask"
        ),
        "applicable": applicable,
        "bandPixels": BOUNDARY_BAND_PIXELS,
        "expectedCounts": expected_counts,
        "minimumRequiredCounts": minimum_counts,
        "actualCounts": actual_counts,
        "rawActualCounts": raw_actual_counts,
        "rawActualMaximumRuns": {
            side: _maximum_boundary_signal_run(
                raw_mask, width, height, BOUNDARY_BAND_PIXELS, side
            )
            for side in BOUNDARY_SIDES
        },
        "rawBoundaryComponentStats": component_stats,
        "requiredSides": required_sides,
        "actualContactSides": actual_contact_sides,
        "rawActualContactSides": raw_contact_sides,
        "unexpectedContactSignalMode": (
            "full_frame_raw_path_boundary_connected_component_minimum_500_pixels_"
            "and_6_contact_pixels_v2"
        ),
        "missingRequiredSides": missing_sides,
        "unexpectedContactSides": unexpected_sides,
        "passed": applicable and not missing_sides and not unexpected_sides,
    }


def audit_route_boundary_from_rgb(
    expected: Iterable[Any],
    rgb: Sequence[Sequence[int]],
    width: int,
    height: int,
    *,
    season: str,
) -> dict[str, Any]:
    expected_mask = _binary_mask(expected, width, height)
    if len(rgb) != width * height:
        raise BoundaryCheckpointContractError("boundary_rgb_size_mismatch")
    raw = classify_route_rgb(rgb, season=season)
    supported = isolate_condition_supported_connected_components(
        raw, expected_mask, width, height
    )
    return audit_boundary_contacts(expected_mask, supported, raw, width, height)


def boundary_gate_contract_status(contract: Mapping[str, Any] | None) -> dict[str, Any]:
    """Validate the gate without ever coercing absence into a zero metric."""

    if contract is None:
        return {
            "status": "not_applicable_checkpoint_boundary_contract_missing",
            "applicable": False,
            "metricValue": None,
        }
    if contract.get("contractVersion") != CHECKPOINT_GATE_CONTRACT_VERSION:
        raise BoundaryCheckpointContractError(
            "checkpoint_boundary_contract_version_invalid"
        )
    if contract.get("enabled") is not True:
        return {
            "status": "not_applicable_checkpoint_boundary_contract_disabled",
            "applicable": False,
            "metricValue": None,
        }
    if contract.get("role") != "checkpoint_eligibility_gate_only":
        raise BoundaryCheckpointContractError("checkpoint_boundary_role_invalid")
    if (
        "trainingLossContribution" in contract
        and contract.get("trainingLossContribution") is not False
    ):
        raise BoundaryCheckpointContractError(
            "checkpoint_boundary_training_loss_injection_forbidden"
        )
    if (
        "bestCheckpointMetricWeight" in contract
        and contract.get("bestCheckpointMetricWeight") is not False
    ):
        raise BoundaryCheckpointContractError(
            "checkpoint_boundary_metric_weight_injection_forbidden"
        )
    return {"status": "applicable", "applicable": True, "metricValue": None}


def build_boundary_validation_ledger(
    entries: Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    """Bind every validation sample/seed boundary audit into one immutable ledger."""

    normalized: list[dict[str, Any]] = []
    identities: set[tuple[str, int]] = set()
    for raw_entry in entries:
        sample_id = raw_entry.get("sampleId")
        seed_index = raw_entry.get("seedIndex")
        seed = raw_entry.get("seed")
        condition_pack_path = raw_entry.get("conditionPackPath")
        condition_pack_sha256 = raw_entry.get("conditionPackSha256")
        condition_mask_path = raw_entry.get("conditionMaskPath")
        condition_mask_sha256 = raw_entry.get("conditionMaskSha256")
        season = raw_entry.get("season")
        normalization = raw_entry.get("normalization")
        source_preview_sha256 = raw_entry.get("sourcePreviewSha256")
        normalized_review_rgb_sha256 = raw_entry.get(
            "normalizedReviewRgbSha256"
        )
        audit = raw_entry.get("boundaryAudit")
        if not isinstance(sample_id, str) or not sample_id:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_sample_identity_invalid"
            )
        if not isinstance(seed_index, int) or seed_index < 0:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_seed_index_invalid"
            )
        if not isinstance(seed, int):
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_seed_invalid"
            )
        if not isinstance(condition_pack_path, str) or not condition_pack_path:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_condition_pack_path_invalid"
            )
        if not isinstance(condition_mask_path, str) or not condition_mask_path:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_condition_mask_path_invalid"
            )
        for name, value in (
            ("condition_pack", condition_pack_sha256),
            ("condition_mask", condition_mask_sha256),
            ("source_preview", source_preview_sha256),
            ("normalized_review_rgb", normalized_review_rgb_sha256),
        ):
            if not _SHA256.fullmatch(str(value or "")):
                raise BoundaryCheckpointContractError(
                    f"checkpoint_boundary_ledger_{name}_sha256_invalid"
                )
        if not isinstance(season, str) or not season:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_season_invalid"
            )
        expected_normalization = {
            "width": FORMAL_REVIEW_WIDTH,
            "height": FORMAL_REVIEW_HEIGHT,
            "resizeKernel": FORMAL_REVIEW_RESIZE_KERNEL,
            "sourceQuantization": FORMAL_REVIEW_SOURCE_QUANTIZATION,
        }
        if normalization != expected_normalization:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_normalization_identity_invalid"
            )
        identity = (sample_id, seed_index)
        if identity in identities:
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_identity_duplicate"
            )
        identities.add(identity)
        if not isinstance(audit, Mapping):
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_audit_missing"
            )
        audit_value = dict(audit)
        if (
            audit_value.get("contractVersion")
            != BOUNDARY_CONTACT_CONTRACT_VERSION
            or audit_value.get("applicable") is not True
        ):
            raise BoundaryCheckpointContractError(
                "checkpoint_boundary_ledger_audit_not_applicable"
            )
        normalized.append(
            {
                "sampleId": sample_id,
                "seedIndex": seed_index,
                "seed": seed,
                "conditionPackPath": condition_pack_path,
                "conditionPackSha256": condition_pack_sha256,
                "conditionMaskPath": condition_mask_path,
                "conditionMaskSha256": condition_mask_sha256,
                "season": season,
                "normalization": dict(normalization),
                "sourcePreviewSha256": source_preview_sha256,
                "normalizedReviewRgbSha256": normalized_review_rgb_sha256,
                "boundaryAudit": audit_value,
                "boundaryAuditSha256": _canonical_sha256(audit_value),
            }
        )
    if not normalized:
        raise BoundaryCheckpointContractError(
            "checkpoint_boundary_validation_ledger_empty"
        )
    normalized.sort(key=lambda value: (value["sampleId"], value["seedIndex"]))
    condition_set = [
        {
            "sampleId": value["sampleId"],
            "seedIndex": value["seedIndex"],
            "seed": value["seed"],
            "conditionPackPath": value["conditionPackPath"],
            "conditionPackSha256": value["conditionPackSha256"],
            "conditionMaskPath": value["conditionMaskPath"],
            "conditionMaskSha256": value["conditionMaskSha256"],
            "season": value["season"],
            "normalization": value["normalization"],
            "requiredSides": value["boundaryAudit"]["requiredSides"],
            "expectedCounts": value["boundaryAudit"]["expectedCounts"],
        }
        for value in normalized
    ]
    return {
        "schemaVersion": BOUNDARY_VALIDATION_LEDGER_VERSION,
        "contractVersion": BOUNDARY_CONTACT_CONTRACT_VERSION,
        "status": "complete_validation_boundary_ledger",
        "applicable": True,
        "entryCount": len(normalized),
        "conditionSetSha256": _canonical_sha256({"entries": condition_set}),
        "passed": all(value["boundaryAudit"]["passed"] for value in normalized),
        "entries": normalized,
    }


def _canonical_sha256(value: Mapping[str, Any]) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_checkpoint_candidate(
    *,
    epoch: int,
    optimizer_step: int,
    denoiser_state_sha256: str,
    scalar_score: float,
    final_rgb_sha256: str,
    boundary_audit: Mapping[str, Any],
    preview_sha256: str,
) -> dict[str, Any]:
    if epoch <= 0 or optimizer_step <= 0:
        raise BoundaryCheckpointContractError("checkpoint_candidate_step_invalid")
    if not math.isfinite(float(scalar_score)):
        raise BoundaryCheckpointContractError("checkpoint_candidate_score_non_finite")
    hashes = (denoiser_state_sha256, final_rgb_sha256, preview_sha256)
    if not all(_SHA256.fullmatch(value or "") for value in hashes):
        raise BoundaryCheckpointContractError("checkpoint_candidate_sha256_invalid")
    boundary = dict(boundary_audit)
    boundary_sha256 = _canonical_sha256(boundary)
    binding = {
        "epoch": epoch,
        "optimizerStep": optimizer_step,
        "stateSha256": denoiser_state_sha256,
    }
    return {
        "schemaVersion": "stage4-post-optimizer-checkpoint-candidate-v1",
        "epoch": epoch,
        "optimizerStep": optimizer_step,
        "denoiserStateSha256": denoiser_state_sha256,
        "scalarScore": float(scalar_score),
        "finalRgbSha256": final_rgb_sha256,
        "boundaryAudit": boundary,
        "boundaryAuditSha256": boundary_sha256,
        "previewSha256": preview_sha256,
        "evidenceBindings": {
            name: dict(binding)
            for name in ("scalarScore", "finalRgb", "boundaryAudit", "preview")
        },
    }


def _validate_candidate(candidate: Mapping[str, Any]) -> None:
    if candidate.get("schemaVersion") != "stage4-post-optimizer-checkpoint-candidate-v1":
        raise BoundaryCheckpointContractError("checkpoint_candidate_schema_invalid")
    state_sha256 = candidate.get("denoiserStateSha256")
    if not _SHA256.fullmatch(str(state_sha256 or "")):
        raise BoundaryCheckpointContractError("checkpoint_candidate_state_sha256_invalid")
    if not _SHA256.fullmatch(str(candidate.get("finalRgbSha256") or "")):
        raise BoundaryCheckpointContractError("checkpoint_candidate_rgb_sha256_invalid")
    if not _SHA256.fullmatch(str(candidate.get("previewSha256") or "")):
        raise BoundaryCheckpointContractError("checkpoint_candidate_preview_sha256_invalid")
    if not math.isfinite(float(candidate.get("scalarScore", math.nan))):
        raise BoundaryCheckpointContractError("checkpoint_candidate_score_non_finite")
    boundary = candidate.get("boundaryAudit")
    if not isinstance(boundary, Mapping):
        raise BoundaryCheckpointContractError("checkpoint_candidate_boundary_missing")
    if boundary.get("contractVersion") != BOUNDARY_CONTACT_CONTRACT_VERSION:
        raise BoundaryCheckpointContractError("checkpoint_candidate_boundary_version_invalid")
    if boundary.get("applicable") is not True:
        raise BoundaryCheckpointContractError(
            "checkpoint_candidate_boundary_not_applicable"
        )
    if candidate.get("boundaryAuditSha256") != _canonical_sha256(boundary):
        raise BoundaryCheckpointContractError("checkpoint_candidate_boundary_hash_mismatch")
    if boundary.get("schemaVersion") == BOUNDARY_VALIDATION_LEDGER_VERSION:
        rebuilt = build_boundary_validation_ledger(boundary.get("entries", []))
        if rebuilt != boundary:
            raise BoundaryCheckpointContractError(
                "checkpoint_candidate_boundary_ledger_identity_mismatch"
            )
    epoch = candidate.get("epoch")
    step = candidate.get("optimizerStep")
    bindings = candidate.get("evidenceBindings")
    if not isinstance(bindings, Mapping):
        raise BoundaryCheckpointContractError("checkpoint_candidate_bindings_missing")
    for name in ("scalarScore", "finalRgb", "boundaryAudit", "preview"):
        binding = bindings.get(name)
        if not isinstance(binding, Mapping):
            raise BoundaryCheckpointContractError(
                f"checkpoint_candidate_{name}_binding_missing"
            )
        if (
            binding.get("epoch") != epoch
            or binding.get("optimizerStep") != step
            or binding.get("stateSha256") != state_sha256
        ):
            raise BoundaryCheckpointContractError(
                "checkpoint_candidate_pre_post_identity_mismatch"
            )


@dataclass(frozen=True)
class CheckpointGateDecision:
    eligible: bool
    reason: str
    scalar_improved: bool
    required_contact_non_regressed: bool
    no_new_missing_side: bool
    no_new_unexpected_side: bool


def decide_checkpoint_replacement(
    candidate: Mapping[str, Any], incumbent: Mapping[str, Any] | None
) -> CheckpointGateDecision:
    """Apply the metric-only final-RGB boundary non-regression gate."""

    _validate_candidate(candidate)
    if incumbent is None:
        return CheckpointGateDecision(True, "initial_candidate", True, True, True, True)
    _validate_candidate(incumbent)
    candidate_boundary = candidate["boundaryAudit"]
    incumbent_boundary = incumbent["boundaryAudit"]
    scalar_improved = float(candidate["scalarScore"]) < float(
        incumbent["scalarScore"]
    )
    (
        required_contact_non_regressed,
        no_new_missing,
        no_new_unexpected,
    ) = _compare_boundary_evidence(candidate_boundary, incumbent_boundary)
    eligible = (
        scalar_improved
        and required_contact_non_regressed
        and no_new_missing
        and no_new_unexpected
    )
    if not scalar_improved:
        reason = "scalar_score_not_improved"
    elif not required_contact_non_regressed:
        reason = "required_boundary_actual_contact_regressed"
    elif not no_new_missing:
        reason = "new_required_boundary_side_missing"
    elif not no_new_unexpected:
        reason = "new_unexpected_boundary_side"
    else:
        reason = "eligible"
    return CheckpointGateDecision(
        eligible,
        reason,
        scalar_improved,
        required_contact_non_regressed,
        no_new_missing,
        no_new_unexpected,
    )


def _compare_single_boundary_audit(
    candidate: Mapping[str, Any], incumbent: Mapping[str, Any]
) -> tuple[bool, bool, bool]:
    if (
        candidate["requiredSides"] != incumbent["requiredSides"]
        or candidate["expectedCounts"] != incumbent["expectedCounts"]
    ):
        raise BoundaryCheckpointContractError(
            "checkpoint_candidate_official_condition_identity_changed"
        )
    contact_non_regressed = all(
        candidate["actualCounts"][side] >= incumbent["actualCounts"][side]
        for side in candidate["requiredSides"]
    )
    no_new_missing = set(candidate["missingRequiredSides"]).issubset(
        set(incumbent["missingRequiredSides"])
    )
    no_new_unexpected = set(candidate["unexpectedContactSides"]).issubset(
        set(incumbent["unexpectedContactSides"])
    )
    return contact_non_regressed, no_new_missing, no_new_unexpected


def _compare_boundary_evidence(
    candidate: Mapping[str, Any], incumbent: Mapping[str, Any]
) -> tuple[bool, bool, bool]:
    candidate_is_ledger = (
        candidate.get("schemaVersion") == BOUNDARY_VALIDATION_LEDGER_VERSION
    )
    incumbent_is_ledger = (
        incumbent.get("schemaVersion") == BOUNDARY_VALIDATION_LEDGER_VERSION
    )
    if candidate_is_ledger != incumbent_is_ledger:
        raise BoundaryCheckpointContractError(
            "checkpoint_candidate_boundary_evidence_kind_changed"
        )
    if not candidate_is_ledger:
        return _compare_single_boundary_audit(candidate, incumbent)
    if (
        candidate.get("conditionSetSha256") != incumbent.get("conditionSetSha256")
        or candidate.get("entryCount") != incumbent.get("entryCount")
    ):
        raise BoundaryCheckpointContractError(
            "checkpoint_candidate_official_condition_identity_changed"
        )
    candidate_entries = {
        (entry["sampleId"], entry["seedIndex"]): entry
        for entry in candidate["entries"]
    }
    incumbent_entries = {
        (entry["sampleId"], entry["seedIndex"]): entry
        for entry in incumbent["entries"]
    }
    if set(candidate_entries) != set(incumbent_entries):
        raise BoundaryCheckpointContractError(
            "checkpoint_candidate_official_condition_identity_changed"
        )
    results = [
        _compare_single_boundary_audit(
            candidate_entries[identity]["boundaryAudit"],
            incumbent_entries[identity]["boundaryAudit"],
        )
        for identity in sorted(candidate_entries)
    ]
    return tuple(all(result[index] for result in results) for index in range(3))

"""Pure original metric/rank formula with explicit schedule; no qualification."""
from collections.abc import Sequence, Mapping
from painter_stage4_v24_dry_single_world_checkpoint_worker import (
    require, _finite_number, OBJECT_CHANNELS, VALIDATION_ROWS, ELIGIBLE_EPOCHS,
)

def rank_validation_epoch(observations, expected_validation_ids, *, epoch, eligible_epochs=ELIGIBLE_EPOCHS):
    """Apply the frozen three-level rank to exactly eight ordered rows."""
    require(epoch in eligible_epochs, "ineligible checkpoint-selection epoch")
    require(isinstance(expected_validation_ids, Sequence)
            and not isinstance(expected_validation_ids, str)
            and len(expected_validation_ids) == VALIDATION_ROWS
            and len(set(expected_validation_ids)) == VALIDATION_ROWS
            and all(isinstance(value, str) and value
                    for value in expected_validation_ids),
            "frozen eight validation identities required")
    require(isinstance(observations, Sequence)
            and len(observations) == VALIDATION_ROWS,
            "exactly eight validation observations required")
    require(all(isinstance(row, Mapping) for row in observations)
            and [row.get("sampleId") for row in observations]
                == list(expected_validation_ids),
            "validation identity or order differs")
    coverage = {role: 0 for role in OBJECT_CHANNELS}
    correlations, maes = [], []
    for row in observations:
        require(row.get("split") == "validation"
                and type(row.get("epoch")) is int and row["epoch"] == epoch,
                "validation split or epoch differs")
        mae = row.get("fullRgbMae")
        require(_finite_number(mae) and 0 <= mae <= 1,
                "invalid validation RGB MAE")
        maes.append(float(mae))
        values = row.get("objectCorrelations")
        require(isinstance(values, Mapping)
                and set(values) == set(OBJECT_CHANNELS),
                "four-class validation correlation map differs")
        for role in OBJECT_CHANNELS:
            value = values[role]
            if value is None:
                continue
            require(_finite_number(value) and -1 <= value <= 1,
                    "invalid applicable object correlation")
            coverage[role] += 1
            correlations.append(float(value))
    require(all(count > 0 for count in coverage.values()),
            "validation lacks one or more natural object classes")
    worst, mean_mae = min(correlations), sum(maes) / VALIDATION_ROWS
    return {"epoch": epoch,
            "worstApplicableObjectCorrelation": worst,
            "meanValidationRgbMae": mean_mae,
            "applicableImageCounts": coverage,
            "rank": [worst, -mean_mae, -epoch],
            "qualificationGranted": False,
            "checkpointPromotionEligible": False}


def _validated_rank(value, *, eligible_epochs=ELIGIBLE_EPOCHS):
    require(isinstance(value, Mapping)
            and value.get("qualificationGranted") is False
            and value.get("checkpointPromotionEligible") is False,
            "invalid checkpoint rank boundary")
    epoch = value.get("epoch")
    worst = value.get("worstApplicableObjectCorrelation")
    mean_mae = value.get("meanValidationRgbMae")
    coverage = value.get("applicableImageCounts")
    require(epoch in eligible_epochs
            and _finite_number(worst) and -1 <= worst <= 1
            and _finite_number(mean_mae) and 0 <= mean_mae <= 1
            and isinstance(coverage, Mapping)
            and set(coverage) == set(OBJECT_CHANNELS)
            and all(type(count) is int and 1 <= count <= VALIDATION_ROWS
                    for count in coverage.values())
            and value.get("rank") == [worst, -mean_mae, -epoch],
            "checkpoint rank fields disagree")
    return tuple(value["rank"])


def prefer_checkpoint(candidate, incumbent, *, eligible_epochs=ELIGIBLE_EPOCHS):
    """Return true only for a better later eligible candidate."""
    candidate_rank = _validated_rank(candidate, eligible_epochs=eligible_epochs)
    if incumbent is None:
        return True
    incumbent_rank = _validated_rank(incumbent, eligible_epochs=eligible_epochs)
    require(candidate["epoch"] > incumbent["epoch"],
            "checkpoint candidates must advance through eligible epochs")
    return candidate_rank > incumbent_rank

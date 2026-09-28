"""Inactive V18 CPU candidate: fact-preserving object position regularization.

The training sample, 23 channels, source image, instance table and WorldFacts
are never transformed. Only the object appearance branch receives a private
view with global coordinate_x/y erased. Its existing local relative XY remains
available, while the terrain backbone continues to receive the full input.
This is a fresh model version, not a loader or successor of V17 weights.
"""
from __future__ import annotations

from dataclasses import replace
import math
from collections.abc import Mapping, Sequence

from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import (
    build_native_rgb_structured_object_cpu_v17,
)


CAPABILITY = "stage4_mvp_native_rgb_structured_object_v18"
ARCHITECTURE = "stage4_native_rgb_structured_object_coordinate_free_appearance_v18"
SEED = 20260928
OBJECT_CLASSES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
PLAN = {
    "capabilityVersion": CAPABILITY, "sourceSplitCounts": {"train": 48, "validation": 8,
        "challenge": 4, "regression": 4}, "model": {"baseChannels": 48, "patchChannels": 32,
        "freshInitializationSeed": SEED, "parentCheckpointLoaded": False},
    "stage": {"stage": 0, "width": 256, "height": 192, "maxEpochs": 24},
    "optimizer": {"name": "AdamW", "generatorLearningRate": 0.0001,
        "discriminatorLearningRate": 0.0001, "weightDecay": 0.01},
    "resourceBound": {"maxGeneratorSteps": 1152, "maxDiscriminatorSteps": 1152,
        "maxGpuMemoryFraction": 0.7, "cpuThreads": 2, "automaticRetries": 0,
        "maxTrainingAttempts": 1},
    "checkpointSelection": {"eligibleEpochFirst": 8, "eligibleEpochLast": 24,
        "validationSamples": 8, "firstCriterion": "maximum_worst_applicable_object_class_correlation",
        "secondCriterion": "minimum_mean_existing_validation_objective",
        "thirdCriterion": "earliest_epoch", "reviewThresholdsChanged": False},
}


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _order(order):
    _require(isinstance(order, Sequence) and len(order) == 23 and len(set(order)) == 23
             and all(key in order for key in (*OBJECT_CLASSES, "coordinate_x", "coordinate_y")),
             "complete V18 23-channel order required")
    return tuple(order)


def coordinate_free_views(views, order):
    """Create private object views; source tensors and authoritative table stay intact."""
    import torch
    order = _order(order)
    result = []
    for view in views:
        source = view.subject_conditions
        _require(isinstance(source, torch.Tensor) and source.shape[0] == 23,
                 "bound object view lacks 23 source conditions")
        local = source.clone()
        local[order.index("coordinate_x")] = 0
        local[order.index("coordinate_y")] = 0
        result.append(replace(view, subject_conditions=local))
    return result


def build_native_rgb_structured_object_v18_cpu(*, condition_channel_order,
                                               base_channels=48, patch_channels=32):
    """Fresh V17-shaped core with a separately named object appearance adapter."""
    from torch import nn
    order = _order(condition_channel_order)
    core = build_native_rgb_structured_object_cpu_v17(
        condition_channel_order=order, base_channels=base_channels,
        patch_channels=patch_channels)

    class PositionRegularizedAppearance(nn.Module):
        def __init__(self, appearance):
            super().__init__()
            self.base = appearance

        def forward(self, views, terrain_patches):
            return self.base(coordinate_free_views(views, order), terrain_patches)

    core.appearance = PositionRegularizedAppearance(core.appearance)

    class Renderer(nn.Module):
        architecture_id = ARCHITECTURE
        capability_version = CAPABILITY
        responsibility_implementation_mode = "declared_shared_substrate"
        execution_qualified = False

        def __init__(self, network):
            super().__init__()
            self.core = network
            self.condition_channel_order = order

        def forward(self, conditions, instance_table, *, return_evidence=False):
            return self.core(conditions, instance_table,
                             return_evidence=return_evidence)

    return Renderer(core)


def build_fresh_native_rgb_structured_object_v18_cpu(*, condition_channel_order):
    """The only proposed training initialization; consumes no checkpoint."""
    import torch
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(SEED)
        return build_native_rgb_structured_object_v18_cpu(
            condition_channel_order=condition_channel_order,
            base_channels=PLAN["model"]["baseChannels"],
            patch_channels=PLAN["model"]["patchChannels"])


def train_objective(critic, predicted, sample, instance_table, channel_order):
    """The existing original-RGB objective remains train-only for V18."""
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
        train_structured_object_objective,
    )
    _require(sample.get("split") == "train", "only bound train may update V18")
    return train_structured_object_objective(critic, predicted, sample,
                                             instance_table, _order(channel_order))


def validation_observation(model, sample, channel_order, epoch):
    """One no-gradient, no-update observation for the frozen validation order."""
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
        validation_structured_object_score,
    )
    _require(sample.get("split") == "validation" and isinstance(sample.get("sampleId"), str)
             and sample["sampleId"] and type(epoch) is int and 1 <= epoch <= 24,
             "V18 checkpoint observation requires validation")
    _require(model.training is False, "V18 validation requires eval mode")
    with torch.no_grad():
        predicted = model(sample["conditions"][None], sample["objectInstanceTable"])
        score, parts = validation_structured_object_score(
            predicted, sample, sample["objectInstanceTable"], _order(channel_order))
    numeric = float(score)
    _require(math.isfinite(numeric), "nonfinite validation objective")
    correlations = {}
    for role in OBJECT_CLASSES:
        key = role + "LumaCorrelation"
        if key in parts:
            value = float(parts[key])
            _require(math.isfinite(value) and -1 <= value <= 1,
                     "nonfinite or invalid object correlation: " + role)
            correlations[role] = value
        else:
            correlations[role] = None
    return {"sampleId": sample["sampleId"], "split": "validation",
            "epoch": epoch, "existingValidationObjective": numeric,
            "objectCorrelations": correlations}


def rank_epoch(observations, expected_validation_ids, *, epoch):
    """One fixed eight-image selection rank; no review decision or optimizer."""
    _require(type(epoch) is int and 8 <= epoch <= 24, "epoch is ineligible for V18 checkpoint selection")
    _require(isinstance(expected_validation_ids, Sequence) and not isinstance(expected_validation_ids, str)
             and len(expected_validation_ids) == 8 and len(set(expected_validation_ids)) == 8
             and all(isinstance(value, str) and value for value in expected_validation_ids),
             "frozen eight validation IDs missing")
    _require(isinstance(observations, Sequence) and len(observations) == 8,
             "all eight validation observations required")
    _require([row.get("sampleId") for row in observations if isinstance(row, Mapping)]
             == list(expected_validation_ids), "validation selection/order differs")
    values = []
    coverage = {role: 0 for role in OBJECT_CLASSES}
    for row in observations:
        _require(isinstance(row, Mapping) and row.get("split") == "validation"
                 and type(row.get("epoch")) is int and row["epoch"] == epoch,
                 "validation row has wrong split or epoch")
        score = row.get("existingValidationObjective")
        _require(type(score) in (int, float) and math.isfinite(score), "nonfinite validation score")
        values.append(float(score))
        correlations = row.get("objectCorrelations")
        _require(isinstance(correlations, Mapping) and set(correlations) == set(OBJECT_CLASSES),
                 "four-class correlation map differs")
        for role, value in correlations.items():
            if value is None:
                continue
            _require(type(value) in (int, float) and math.isfinite(value) and -1 <= value <= 1,
                     "invalid applicable object correlation")
            coverage[role] += 1
    _require(all(count > 0 for count in coverage.values()),
             "frozen validation lacks at least one required object class")
    worst = min(row["objectCorrelations"][role] for row in observations
                for role in OBJECT_CLASSES if row["objectCorrelations"][role] is not None)
    mean_score = sum(values) / 8
    return {"epoch": epoch, "worstApplicableObjectCorrelation": worst,
            "meanExistingValidationObjective": mean_score,
            "applicableImageCounts": coverage, "rank": [worst, -mean_score, -epoch],
            "qualificationGranted": False}


def prefer_checkpoint(candidate, incumbent):
    """Call once per completed eligible epoch; equal ranks keep earliest."""
    def rank(value):
        _require(isinstance(value, Mapping) and value.get("qualificationGranted") is False,
                 "invalid V18 rank")
        epoch = value.get("epoch")
        worst = value.get("worstApplicableObjectCorrelation")
        mean = value.get("meanExistingValidationObjective")
        _require(type(epoch) is int and 8 <= epoch <= 24
                 and type(worst) in (int, float) and math.isfinite(worst) and -1 <= worst <= 1
                 and type(mean) in (int, float) and math.isfinite(mean)
                 and isinstance(value.get("applicableImageCounts"), Mapping)
                 and set(value["applicableImageCounts"]) == set(OBJECT_CLASSES)
                 and all(type(count) is int and 1 <= count <= 8
                         for count in value["applicableImageCounts"].values())
                 and value.get("rank") == [worst, -mean, -epoch], "V18 rank fields disagree")
        return tuple(value["rank"])

    candidate_rank = rank(candidate)
    if incumbent is None:
        return True
    incumbent_rank = rank(incumbent)
    _require(type(candidate.get("epoch")) is int and type(incumbent.get("epoch")) is int
             and candidate["epoch"] > incumbent["epoch"], "V18 epochs must advance once")
    return candidate_rank > incumbent_rank

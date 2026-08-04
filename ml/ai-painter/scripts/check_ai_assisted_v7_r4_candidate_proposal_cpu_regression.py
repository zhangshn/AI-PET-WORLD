from argparse import ArgumentParser
import json
from pathlib import Path

import torch

from train_ai_assisted_conditional_denoiser import (
    object_semantic_rgb_losses,
    path_forbidden_boundary_rgb_loss,
    path_interior_rgb_loss,
)


def main():
    parser = ArgumentParser(description="CPU-only regression for the isolated V7 R4 configuration proposal.")
    parser.add_argument("--base-config", type=Path, required=True)
    parser.add_argument("--r3-candidate", type=Path, required=True)
    parser.add_argument("--r4-proposal", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    base = read_json(args.base_config)
    r3 = read_json(args.r3_candidate)
    r4 = read_json(args.r4_proposal)
    assert r4["status"] == "isolated_candidate_proposal_cpu_regression_pending_not_implemented_not_active"
    assert r4["promotionBoundary"]["trainerImplementationComplete"] is False
    assert r4["promotionBoundary"]["gpuTrainingAuthorized"] is False
    config = deep_merge(base, r3["patch"])
    proposal = r4["proposal"]
    interior_range = proposal["pathStabilityWeightSearch"]["pathInteriorRgb"]
    forbidden_range = proposal["pathStabilityWeightSearch"]["pathForbiddenBoundaryRgb"]
    assert interior_range["minimum"] == interior_range["current"]
    assert forbidden_range["minimum"] == forbidden_range["current"]
    assert interior_range["maximum"] >= interior_range["current"] > 0
    assert forbidden_range["maximum"] >= forbidden_range["current"] > 0
    assert interior_range["selectedValue"] is None
    assert forbidden_range["selectedValue"] is None

    order = list(config["conditionChannelOrder"])
    conditions = torch.zeros((1, len(order), 8, 8), dtype=torch.float32)
    set_mask(conditions, order, "terrain_path_ground", 2, 6, 2, 6)
    set_mask(conditions, order, "object_footprints", 2, 6, 2, 6)
    set_mask(conditions, order, "object_tree", 2, 3, 2, 3)
    set_mask(conditions, order, "object_rock", 3, 4, 3, 4)
    set_mask(conditions, order, "object_vegetation", 4, 5, 4, 5)
    target = torch.zeros((1, 3, 8, 8), dtype=torch.float32)

    baseline = torch.zeros_like(target, requires_grad=True)
    baseline_objects = object_semantic_rgb_losses(baseline, target, conditions, config)
    assert all(float(value.detach()) == 0.0 for value in baseline_objects.values())
    assert float(path_interior_rgb_loss(baseline, target, conditions, config).detach()) == 0.0
    assert float(path_forbidden_boundary_rgb_loss(baseline, target, conditions, config).detach()) == 0.0

    object_results = {}
    object_pixels = {
        "objectFootprintsRgbMae": (2, 5),
        "objectTreeRgbMae": (2, 2),
        "objectRockRgbMae": (3, 3),
        "objectVegetationRgbMae": (4, 4),
    }
    for metric_name, (row, col) in object_pixels.items():
        prediction = torch.zeros_like(target, requires_grad=True)
        prediction.data[:, :, row, col] = 1.0
        losses = object_semantic_rgb_losses(prediction, target, conditions, config)
        assert float(losses[metric_name].detach()) > 0.0
        losses["objectSemanticRgbMae"].backward()
        assert float(prediction.grad.abs().sum()) > 0.0
        object_results[metric_name] = float(losses[metric_name].detach())

    path_prediction = torch.zeros_like(target, requires_grad=True)
    path_prediction.data[:, :, 5, 5] = 1.0
    path_loss = path_interior_rgb_loss(path_prediction, target, conditions, config)
    assert float(path_loss.detach()) > 0.0
    (path_loss * float(interior_range["maximum"])).backward()
    assert float(path_prediction.grad.abs().sum()) > 0.0

    boundary_prediction = torch.zeros_like(target, requires_grad=True)
    boundary_prediction.data[:, :, 0, 0] = 1.0
    boundary_loss = path_forbidden_boundary_rgb_loss(boundary_prediction, target, conditions, config)
    assert float(boundary_loss.detach()) > 0.0
    (boundary_loss * float(forbidden_range["maximum"])).backward()
    assert float(boundary_prediction.grad.abs().sum()) > 0.0

    report = {
        "schemaVersion": "ai-assisted-v7-r4-candidate-proposal-cpu-regression-v1",
        "status": "passed_cpu_only_proposal_not_implemented_no_training",
        "device": "cpu",
        "optimizerCreated": False,
        "modelWeightsModified": False,
        "trainerFormalConfigurationModified": False,
        "gpuTrainingStarted": False,
        "positiveRegression": {
            "allZeroPredictionProducesZeroNewLosses": True,
            "allFourObjectChannelsRemainIndependentlyDetectable": True,
            "allObjectChannelErrorsProduceGradient": True,
            "pathInteriorErrorDetectedAtCurrentAndMaximumWeight": True,
            "forbiddenBoundaryErrorDetectedAtCurrentAndMaximumWeight": True,
            "pathLossesProduceGradient": True,
        },
        "negativeRegression": {
            "candidateRemainsProposalOnly": True,
            "selectedSearchValuesRemainUnset": True,
            "reviewThresholdsModified": False,
            "sourceR3CandidateModified": False,
            "trainingAuthorizationPresent": False,
        },
        "measured": {
            "objectChannelRgbMae": object_results,
            "pathInteriorRgbMae": float(path_loss.detach()),
            "pathInteriorWeightedCurrent": float(path_loss.detach()) * float(interior_range["current"]),
            "pathInteriorWeightedMaximum": float(path_loss.detach()) * float(interior_range["maximum"]),
            "pathForbiddenBoundaryRgbMae": float(boundary_loss.detach()),
            "pathForbiddenWeightedCurrent": float(boundary_loss.detach()) * float(forbidden_range["current"]),
            "pathForbiddenWeightedMaximum": float(boundary_loss.detach()) * float(forbidden_range["maximum"]),
        },
    }
    write_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def set_mask(tensor, order, name, row_start, row_end, col_start, col_end):
    index = order.index(name)
    tensor[:, index:index + 1, row_start:row_end, col_start:col_end] = 1.0


def deep_merge(base, patch):
    result = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

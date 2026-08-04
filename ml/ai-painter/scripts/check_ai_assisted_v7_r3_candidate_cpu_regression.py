from argparse import ArgumentParser
import json
from pathlib import Path

import torch

from train_ai_assisted_conditional_denoiser import (
    object_semantic_rgb_losses,
    path_forbidden_boundary_rgb_loss,
    path_interior_rgb_loss,
    validate_v7_r3_candidate_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="CPU-only regression for the isolated V7 R3 candidate loss contract.")
    parser.add_argument("--base-config", type=Path, required=True)
    parser.add_argument("--candidate-overlay", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    base = read_json(args.base_config)
    overlay = read_json(args.candidate_overlay)
    config = deep_merge(base, overlay["patch"])
    contract = validate_v7_r3_candidate_contract(config)
    training_gate_closed = False
    try:
        validate_v7_training_authorization(config, {})
    except ValueError as error:
        training_gate_closed = str(error) == "V7 R3 candidate is isolated and is not authorized for training"
    assert training_gate_closed, "r3_candidate_training_gate_not_closed"

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
    assert all(float(value.detach()) == 0.0 for value in baseline_objects.values()), "r3_object_baseline_not_zero"
    assert float(path_interior_rgb_loss(baseline, target, conditions, config).detach()) == 0.0, "r3_path_baseline_not_zero"
    assert float(path_forbidden_boundary_rgb_loss(baseline, target, conditions, config).detach()) == 0.0, "r3_forbidden_boundary_baseline_not_zero"

    rock_prediction = torch.zeros_like(target, requires_grad=True)
    rock_prediction.data[:, :, 3, 3] = 1.0
    rock_losses = object_semantic_rgb_losses(rock_prediction, target, conditions, config)
    assert float(rock_losses["objectRockRgbMae"].detach()) > 0.0, "r3_rock_loss_did_not_detect_error"
    assert float(rock_losses["objectTreeRgbMae"].detach()) == 0.0, "r3_rock_error_leaked_into_tree_loss"
    assert float(rock_losses["objectVegetationRgbMae"].detach()) == 0.0, "r3_rock_error_leaked_into_vegetation_loss"
    rock_losses["objectSemanticRgbMae"].backward()
    assert float(rock_prediction.grad.abs().sum()) > 0.0, "r3_object_loss_has_no_gradient"

    path_prediction = torch.zeros_like(target, requires_grad=True)
    path_prediction.data[:, :, 5, 5] = 1.0
    path_loss = path_interior_rgb_loss(path_prediction, target, conditions, config)
    assert float(path_loss.detach()) > 0.0, "r3_path_interior_loss_did_not_detect_error"
    path_loss.backward()
    assert float(path_prediction.grad.abs().sum()) > 0.0, "r3_path_interior_loss_has_no_gradient"

    boundary_prediction = torch.zeros_like(target, requires_grad=True)
    boundary_prediction.data[:, :, 0, 0] = 1.0
    boundary_loss = path_forbidden_boundary_rgb_loss(boundary_prediction, target, conditions, config)
    assert float(boundary_loss.detach()) > 0.0, "r3_forbidden_boundary_loss_did_not_detect_error"
    boundary_loss.backward()
    assert float(boundary_prediction.grad.abs().sum()) > 0.0, "r3_forbidden_boundary_loss_has_no_gradient"

    report = {
        "schemaVersion": "ai-assisted-v7-r3-candidate-cpu-regression-v1",
        "status": "passed_cpu_only_no_training",
        "device": "cpu",
        "optimizerCreated": False,
        "modelWeightsModified": False,
        "gpuTrainingStarted": False,
        "candidateContract": contract,
        "positiveRegression": {
            "identicalPredictionAllNewLossesZero": True,
            "rockChannelErrorDetected": True,
            "rockChannelIndependentFromTreeAndVegetation": True,
            "pathInteriorCoverageErrorDetected": True,
            "forbiddenBoundaryErrorDetected": True,
            "allAffectedLossesProduceGradient": True,
        },
        "negativeRegression": {
            "trainingAuthorizationRejected": training_gate_closed,
            "r2EvidenceModified": False,
            "reviewThresholdsModified": False,
        },
        "measured": {
            "rockRgbMae": float(rock_losses["objectRockRgbMae"].detach()),
            "objectSemanticRgbMae": float(rock_losses["objectSemanticRgbMae"].detach()),
            "pathInteriorRgbMae": float(path_loss.detach()),
            "pathForbiddenBoundaryRgbMae": float(boundary_loss.detach()),
        },
    }
    write_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def set_mask(tensor, order, name, row_start, row_end, col_start, col_end):
    tensor[:, order.index(name):order.index(name) + 1, row_start:row_end, col_start:col_end] = 1.0


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

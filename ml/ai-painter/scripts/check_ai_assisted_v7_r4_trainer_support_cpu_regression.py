from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path

import torch

from train_ai_assisted_conditional_denoiser import (
    build_v7_r4_candidate_config,
    object_semantic_rgb_losses,
    path_forbidden_boundary_rgb_loss,
    path_interior_rgb_loss,
    summarize_v7_r4_tail_stability,
    validate_v7_r4_candidate_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="CPU-only positive and negative regression for V7 R4 trainer support.")
    parser.add_argument("--base-config", type=Path, required=True)
    parser.add_argument("--r3-candidate", type=Path, required=True)
    parser.add_argument("--r4-proposal", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    base = read_json(args.base_config)
    r3 = read_json(args.r3_candidate)
    proposal = read_json(args.r4_proposal)
    r3_config = deep_merge(base, r3["patch"])
    searches = proposal["proposal"]["pathStabilityWeightSearch"]
    minimum_config = build_v7_r4_candidate_config(
        r3_config,
        proposal,
        searches["pathInteriorRgb"]["minimum"],
        searches["pathForbiddenBoundaryRgb"]["minimum"],
    )
    maximum_config = build_v7_r4_candidate_config(
        r3_config,
        proposal,
        searches["pathInteriorRgb"]["maximum"],
        searches["pathForbiddenBoundaryRgb"]["maximum"],
    )
    minimum_contract = validate_v7_r4_candidate_contract(minimum_config)
    maximum_contract = validate_v7_r4_candidate_contract(maximum_config)

    negative_contract_checks = {
        "pathInteriorBelowRangeRejected": expect_value_error(
            lambda: build_v7_r4_candidate_config(
                r3_config,
                proposal,
                float(searches["pathInteriorRgb"]["minimum"]) - 0.01,
                searches["pathForbiddenBoundaryRgb"]["minimum"],
            ),
            "outside the authorized proposal range",
        ),
        "pathForbiddenAboveRangeRejected": expect_value_error(
            lambda: build_v7_r4_candidate_config(
                r3_config,
                proposal,
                searches["pathInteriorRgb"]["minimum"],
                float(searches["pathForbiddenBoundaryRgb"]["maximum"]) + 0.01,
            ),
            "outside the authorized proposal range",
        ),
        "reviewThresholdMutationRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["r4BoundedSelectionEvidence"].update(
                {"reviewThresholdPolicy": "modified"}
            ),
            "cannot change machine review thresholds",
        ),
        "objectWeightSelectionRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["r4BoundedSelectionEvidence"].update(
                {"selectedObjectWeightChanges": {"object_tree": 1.1}}
            ),
            "cannot select object weight changes",
        ),
        "inactiveCandidateTrainingRejected": expect_value_error(
            lambda: validate_v7_training_authorization(minimum_config, {}),
            "is isolated and is not authorized for training",
        ),
    }
    assert all(negative_contract_checks.values())

    order = list(minimum_config["conditionChannelOrder"])
    conditions = torch.zeros((1, len(order), 8, 8), dtype=torch.float32)
    set_mask(conditions, order, "terrain_path_ground", 2, 6, 2, 6)
    set_mask(conditions, order, "object_footprints", 2, 6, 2, 6)
    set_mask(conditions, order, "object_tree", 2, 3, 2, 3)
    set_mask(conditions, order, "object_rock", 3, 4, 3, 4)
    set_mask(conditions, order, "object_vegetation", 4, 5, 4, 5)
    target = torch.zeros((1, 3, 8, 8), dtype=torch.float32)

    object_results = {}
    object_pixels = {
        "objectFootprintsRgbMae": (2, 5),
        "objectTreeRgbMae": (2, 2),
        "objectRockRgbMae": (3, 3),
        "objectVegetationRgbMae": (4, 4),
    }
    for metric_name, (row, column) in object_pixels.items():
        prediction = torch.zeros_like(target, requires_grad=True)
        with torch.no_grad():
            prediction[:, :, row, column] = 1.0
        losses = object_semantic_rgb_losses(prediction, target, conditions, minimum_config)
        losses["objectSemanticRgbMae"].backward()
        measured = float(losses[metric_name].detach())
        gradient = float(prediction.grad.abs().sum())
        assert measured > 0.0 and gradient > 0.0
        object_results[metric_name] = {"loss": measured, "gradientL1": gradient}

    path_prediction = torch.zeros_like(target, requires_grad=True)
    with torch.no_grad():
        path_prediction[:, :, 5, 5] = 1.0
    path_interior = path_interior_rgb_loss(path_prediction, target, conditions, minimum_config)
    (path_interior * maximum_contract["pathInteriorRgbWeight"]).backward()
    assert float(path_interior.detach()) > 0.0 and float(path_prediction.grad.abs().sum()) > 0.0

    forbidden_prediction = torch.zeros_like(target, requires_grad=True)
    with torch.no_grad():
        forbidden_prediction[:, :, 0, 0] = 1.0
    path_forbidden = path_forbidden_boundary_rgb_loss(
        forbidden_prediction, target, conditions, minimum_config
    )
    (path_forbidden * maximum_contract["pathForbiddenBoundaryRgbWeight"]).backward()
    assert float(path_forbidden.detach()) > 0.0 and float(forbidden_prediction.grad.abs().sum()) > 0.0

    positive_tail = summarize_v7_r4_tail_stability([
        {"epoch": 100, "passed": True, "issueCodes": []},
        {"epoch": 110, "passed": True, "issueCodes": []},
        {"epoch": 120, "passed": True, "issueCodes": []},
    ], minimum_config)
    path_recurrence_tail = summarize_v7_r4_tail_stability([
        {"epoch": 100, "passed": True, "issueCodes": []},
        {"epoch": 110, "passed": False, "issueCodes": [
            "condition_terrain_path_ground_uncontracted_boundary_contact"
        ]},
        {"epoch": 120, "passed": True, "issueCodes": []},
    ], minimum_config)
    object_recurrence_tail = summarize_v7_r4_tail_stability([
        {"epoch": 100, "passed": True, "issueCodes": []},
        {"epoch": 110, "passed": False, "issueCodes": [
            "condition_object_tree_reference_semantic_mismatch"
        ]},
        {"epoch": 120, "passed": True, "issueCodes": []},
    ], minimum_config)
    missing_tail = summarize_v7_r4_tail_stability([
        {"epoch": 100, "passed": True, "issueCodes": []},
        {"epoch": 120, "passed": True, "issueCodes": []},
    ], minimum_config)
    assert positive_tail["passed"] is True
    assert path_recurrence_tail["passed"] is False
    assert object_recurrence_tail["passed"] is False
    assert missing_tail["passed"] is False

    path_value = float(path_interior.detach())
    forbidden_value = float(path_forbidden.detach())
    report = {
        "schemaVersion": "ai-assisted-v7-r4-trainer-support-cpu-regression-v1",
        "status": "passed_cpu_only_r4_trainer_support_not_active_no_training",
        "device": "cpu",
        "optimizerCreated": False,
        "modelWeightsModified": False,
        "formalConfigurationActivated": False,
        "gpuTrainingStarted": False,
        "validationStarted": False,
        "formalInferenceStarted": False,
        "runtimeFrameStarted": False,
        "worldEntered": False,
        "positiveRegression": {
            "minimumBoundCandidateContractAccepted": True,
            "maximumBoundCandidateContractAccepted": True,
            "allFourObjectChannelsIndependentlyDetectable": True,
            "allObjectChannelErrorsProduceGradient": True,
            "pathInteriorErrorProducesGradient": True,
            "forbiddenBoundaryErrorProducesGradient": True,
            "epoch100110120ZeroRecurrenceGatePassed": positive_tail["passed"],
        },
        "negativeRegression": {
            **negative_contract_checks,
            "pathBoundaryRecurrenceRejected": path_recurrence_tail["passed"] is False,
            "objectSemanticRecurrenceRejected": object_recurrence_tail["passed"] is False,
            "missingTailEpochRejected": missing_tail["passed"] is False,
        },
        "measured": {
            "minimumContract": minimum_contract,
            "maximumContract": maximum_contract,
            "objectChannelLosses": object_results,
            "pathInteriorRgbMae": path_value,
            "pathInteriorWeightedMinimum": path_value * minimum_contract["pathInteriorRgbWeight"],
            "pathInteriorWeightedMaximum": path_value * maximum_contract["pathInteriorRgbWeight"],
            "pathForbiddenBoundaryRgbMae": forbidden_value,
            "pathForbiddenWeightedMinimum": forbidden_value * minimum_contract["pathForbiddenBoundaryRgbWeight"],
            "pathForbiddenWeightedMaximum": forbidden_value * maximum_contract["pathForbiddenBoundaryRgbWeight"],
        },
        "tailGateRegression": {
            "positive": positive_tail,
            "pathRecurrence": path_recurrence_tail,
            "objectRecurrence": object_recurrence_tail,
            "missingEpoch": missing_tail,
        },
    }
    write_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def expect_mutation_rejected(config, mutate, message):
    candidate = deepcopy(config)
    mutate(candidate)
    return expect_value_error(lambda: validate_v7_r4_candidate_contract(candidate), message)


def expect_value_error(action, message):
    try:
        action()
    except ValueError as error:
        assert message in str(error), f"unexpected error: {error}"
        return True
    raise AssertionError(f"expected ValueError containing: {message}")


def set_mask(tensor, order, name, row_start, row_end, column_start, column_end):
    index = order.index(name)
    tensor[:, index:index + 1, row_start:row_end, column_start:column_end] = 1.0


def deep_merge(base, patch):
    result = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path

import torch

from train_ai_assisted_conditional_denoiser import (
    build_v7_r5_candidate_config,
    path_short_trajectory_consistency_loss,
    r5_path_replay_passes_per_epoch,
    summarize_v7_r5_tail_stability,
    validate_v7_r5_candidate_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="CPU-only positive and negative regression for V7 R5 trainer support.")
    parser.add_argument("--r4-config", type=Path, required=True)
    parser.add_argument("--r5-proposal", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    r4_config = read_json(args.r4_config)
    proposal = read_json(args.r5_proposal)
    proposed = proposal["proposal"]
    epoch_range = proposed["checkpointContinuationProposal"]["continuationEpochs"]
    replay_range = proposed["pathHardExampleReplayProposal"]["replayPassesPerEpoch"]
    consistency_range = proposed["pathShortTrajectoryConsistencyProposal"]["weight"]

    minimum_config = build_v7_r5_candidate_config(
        r4_config,
        proposal,
        epoch_range["minimum"],
        replay_range["minimum"],
        consistency_range["minimum"],
    )
    maximum_config = build_v7_r5_candidate_config(
        r4_config,
        proposal,
        epoch_range["maximum"],
        replay_range["maximum"],
        consistency_range["maximum"],
    )
    minimum_contract = validate_v7_r5_candidate_contract(minimum_config)
    maximum_contract = validate_v7_r5_candidate_contract(maximum_config)

    negative_contract_checks = {
        "continuationEpochBelowRangeRejected": expect_value_error(
            lambda: build_v7_r5_candidate_config(
                r4_config, proposal, int(epoch_range["minimum"]) - 10,
                replay_range["minimum"], consistency_range["minimum"],
            ),
            "outside the proposal range",
        ),
        "replayPassAboveRangeRejected": expect_value_error(
            lambda: build_v7_r5_candidate_config(
                r4_config, proposal, epoch_range["minimum"],
                int(replay_range["maximum"]) + 1, consistency_range["minimum"],
            ),
            "outside the proposal range",
        ),
        "trajectoryWeightAboveRangeRejected": expect_value_error(
            lambda: build_v7_r5_candidate_config(
                r4_config, proposal, epoch_range["minimum"],
                replay_range["minimum"], float(consistency_range["maximum"]) + 0.01,
            ),
            "outside the proposal range",
        ),
        "failedPreviewTargetRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["pathHardExampleReplay"].update(
                {"failedPreviewPixelsUsedAsTrainingTargets": True}
            ),
            "failed preview pixels cannot be used",
        ),
        "nonOriginalTargetSourceRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["pathHardExampleReplay"].update(
                {"targetSource": "failed_preview_pixels"}
            ),
            "target source is invalid",
        ),
        "checkpointIdentityMutationRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["r5CheckpointContinuation"].update(
                {"sourceCheckpointSha256": "0" * 64}
            ),
            "does not match the proposal evidence",
        ),
        "checkpointLoadingActivationRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["r5CheckpointContinuation"].update(
                {"loadingAuthorizedNow": True}
            ),
            "cannot authorize checkpoint loading",
        ),
        "r4PathWeightMutationRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["denoiserLossWeights"].update(
                {"pathInteriorRgb": 2.1}
            ),
            "preserve the R4 path loss weights",
        ),
        "objectWeightMutationRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["objectSemanticChannelWeights"].update(
                {"object_tree": 1.1}
            ),
            "preserve the R4 object semantic weights",
        ),
        "reviewThresholdMutationRejected": expect_mutation_rejected(
            minimum_config,
            lambda value: value["training"]["r5BoundedSelectionEvidence"].update(
                {"reviewThresholdPolicy": "lowered"}
            ),
            "cannot change machine review thresholds",
        ),
        "inactiveCandidateTrainingRejected": expect_value_error(
            lambda: validate_v7_training_authorization(minimum_config, {}),
            "is isolated and is not authorized for training",
        ),
    }
    assert all(negative_contract_checks.values())

    order = list(minimum_config["conditionChannelOrder"])
    conditions = torch.zeros((1, len(order), 8, 8), dtype=torch.float32)
    path_index = order.index("terrain_path_ground")
    conditions[:, path_index:path_index + 1, 2:6, 2:6] = 1.0
    target = torch.zeros((1, 3, 8, 8), dtype=torch.float32)
    first = torch.zeros_like(target, requires_grad=True)
    second = torch.zeros_like(target, requires_grad=True)
    with torch.no_grad():
        first[:, :, 2:6, 2:6] = 0.25
        second[:, :, 2:6, 2:6] = 0.75
        second[:, :, 0, 0] = 1.0
    path_consistency = path_short_trajectory_consistency_loss(
        [first, second], target, conditions, minimum_config
    )
    assert path_consistency is not None
    path_consistency["pathShortTrajectoryConsistencyLossTensor"].backward()
    gradient_l1 = float(first.grad.abs().sum() + second.grad.abs().sum())
    assert float(path_consistency["pathShortTrajectoryConsistencyRawLoss"].detach()) > 0.0
    assert gradient_l1 > 0.0

    minimum_replay_passes = r5_path_replay_passes_per_epoch(minimum_config)
    maximum_replay_passes = r5_path_replay_passes_per_epoch(maximum_config)
    assert minimum_replay_passes == 1 and maximum_replay_passes == 2

    minimum_tail_epochs = minimum_contract["tailEpochs"]
    positive_tail = summarize_v7_r5_tail_stability([
        {"epoch": epoch, "passed": True, "issueCodes": []}
        for epoch in minimum_tail_epochs
    ], minimum_config)
    path_recurrence_tail = summarize_v7_r5_tail_stability([
        {"epoch": minimum_tail_epochs[0], "passed": True, "issueCodes": []},
        {"epoch": minimum_tail_epochs[1], "passed": False, "issueCodes": [
            "condition_terrain_path_ground_uncontracted_boundary_contact"
        ]},
        {"epoch": minimum_tail_epochs[2], "passed": True, "issueCodes": []},
    ], minimum_config)
    object_recurrence_tail = summarize_v7_r5_tail_stability([
        {"epoch": minimum_tail_epochs[0], "passed": True, "issueCodes": []},
        {"epoch": minimum_tail_epochs[1], "passed": False, "issueCodes": [
            "condition_object_rock_reference_semantic_mismatch"
        ]},
        {"epoch": minimum_tail_epochs[2], "passed": True, "issueCodes": []},
    ], minimum_config)
    missing_tail = summarize_v7_r5_tail_stability([
        {"epoch": minimum_tail_epochs[0], "passed": True, "issueCodes": []},
        {"epoch": minimum_tail_epochs[2], "passed": True, "issueCodes": []},
    ], minimum_config)
    assert positive_tail["passed"] is True
    assert path_recurrence_tail["passed"] is False
    assert object_recurrence_tail["passed"] is False
    assert missing_tail["passed"] is False

    report = {
        "schemaVersion": "ai-assisted-v7-r5-trainer-support-cpu-regression-v1",
        "status": "passed_cpu_only_r5_trainer_support_not_active_no_checkpoint_load_no_training",
        "device": "cpu",
        "checkpointLoaded": False,
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
            "originalApprovedTargetReplayContractAccepted": True,
            "oneAndTwoReplayPassesAccepted": True,
            "pathTrajectoryConsistencyLossProducesGradient": True,
            "dynamicThreeTailPassGateAccepted": positive_tail["passed"],
            "checkpointContinuationIdentityBoundWithoutLoading": True,
        },
        "negativeRegression": {
            **negative_contract_checks,
            "pathRecurrenceRejected": path_recurrence_tail["passed"] is False,
            "objectRecurrenceRejected": object_recurrence_tail["passed"] is False,
            "missingTailEpochRejected": missing_tail["passed"] is False,
        },
        "measured": {
            "minimumContract": minimum_contract,
            "maximumContract": maximum_contract,
            "pathShortTrajectoryConsistencyRawLoss": float(
                path_consistency["pathShortTrajectoryConsistencyRawLoss"].detach()
            ),
            "pathShortTrajectoryConsistencyWeightedLoss": float(
                path_consistency["pathShortTrajectoryConsistencyWeightedLoss"].detach()
            ),
            "gradientL1": gradient_l1,
            "minimumReplayPasses": minimum_replay_passes,
            "maximumReplayPasses": maximum_replay_passes,
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
    return expect_value_error(lambda: validate_v7_r5_candidate_contract(candidate), message)


def expect_value_error(action, message):
    try:
        action()
    except ValueError as error:
        assert message in str(error), f"unexpected error: {error}"
        return True
    raise AssertionError(f"expected ValueError containing: {message}")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

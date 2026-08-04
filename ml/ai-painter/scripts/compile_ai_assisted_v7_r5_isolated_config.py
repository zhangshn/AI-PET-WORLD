from argparse import ArgumentParser
import json
from pathlib import Path

from train_ai_assisted_conditional_denoiser import (
    build_v7_r5_candidate_config,
    validate_v7_r5_candidate_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="Select bounded R5 values and compile an inactive isolated configuration.")
    parser.add_argument("--r4-config", type=Path, required=True)
    parser.add_argument("--r5-proposal", type=Path, required=True)
    parser.add_argument("--output-config", type=Path, required=True)
    parser.add_argument("--output-selection", type=Path, required=True)
    args = parser.parse_args()

    r4_config = read_json(args.r4_config)
    proposal = read_json(args.r5_proposal)
    selected, rationale = select_minimum_effective_values(proposal)
    config = build_v7_r5_candidate_config(
        r4_config,
        proposal,
        selected["continuationEpochs"],
        selected["replayPassesPerEpoch"],
        selected["pathShortTrajectoryConsistencyWeight"],
    )
    contract = validate_v7_r5_candidate_contract(config)
    inactive_training_rejected = expect_value_error(
        lambda: validate_v7_training_authorization(config, {}),
        "is isolated and is not authorized for training",
    )
    assert inactive_training_rejected
    assert config["status"] == "isolated_r5_candidate_not_active"
    assert config["training"]["trainingAuthorizationStatus"] == "not_authorized_candidate_only"
    assert config["training"]["r5CheckpointContinuation"]["loadingAuthorizedNow"] is False
    assert config["training"]["ownerTrainingAuthorization"]["checkpointLoadingAuthorized"] is False
    assert config["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] is False

    selection = {
        "schemaVersion": "ai-assisted-v7-r5-isolated-config-selection-v1",
        "status": "r5_bounded_values_selected_isolated_config_compiled_not_active",
        "selectionPolicy": "minimum_effective_intervention_before_single_sample_gpu_smoke",
        "selectedValues": selected,
        "selectionRationale": rationale,
        "contract": contract,
        "boundaries": {
            "configurationActive": False,
            "checkpointFileRead": False,
            "checkpointDeserialized": False,
            "checkpointLoaded": False,
            "optimizerCreated": False,
            "modelWeightsModified": False,
            "gpuTrainingStarted": False,
            "validationStarted": False,
            "formalInferenceStarted": False,
            "runtimeFrameStarted": False,
            "worldEntered": False,
        },
        "nextIndependentAuthorization": "one_r5_single_sample_gpu_overfit_smoke_only",
    }
    write_json_exclusive(args.output_config, config)
    write_json_exclusive(args.output_selection, selection)
    print(json.dumps(selection, ensure_ascii=False, indent=2))


def select_minimum_effective_values(candidate):
    failure = candidate.get("failureAnalysis", {})
    proposal = candidate.get("proposal", {})
    assert failure.get("finalEpochPassed") is True
    assert int(failure.get("finalPassingStreak", 0)) == 1
    assert failure.get("requiredTailPassed") is False
    clusters = list(failure.get("issueClusters", []))
    object_clusters = [row for row in clusters if row.get("family") == "object_semantic_alignment"]
    path_clusters = [row for row in clusters if row.get("family") == "terrain_path_topology"]
    assert object_clusters and all(int(row.get("lastSeenEpoch", 10**9)) < 100 for row in object_clusters)
    path_tail_epochs = sorted({
        int(epoch)
        for row in path_clusters
        for epoch in row.get("occurrenceEpochs", [])
        if int(epoch) >= 100
    })
    assert path_tail_epochs == [100, 110]
    assert proposal.get("preserveR4PathLossWeights", {}).get("increaseBeyondR4BoundSelected") is False
    assert proposal.get("objectSemanticStabilityProposal", {}).get("selectedWeightChanges") is None

    epoch_range = proposal["checkpointContinuationProposal"]["continuationEpochs"]
    replay_range = proposal["pathHardExampleReplayProposal"]["replayPassesPerEpoch"]
    consistency_range = proposal["pathShortTrajectoryConsistencyProposal"]["weight"]
    selected = {
        "continuationEpochs": int(epoch_range["minimum"]),
        "replayPassesPerEpoch": int(replay_range["minimum"]),
        "pathShortTrajectoryConsistencyWeight": float(consistency_range["minimum"]),
    }
    rationale = {
        "whyMinimumIntervention": "R4最终预览已通过，当前缺口是尾段连续稳定性而不是完全不可学习；先用范围下限执行单样本Smoke可避免道路目标过权和对象语义回退。",
        "continuationEpochs": "选择30：这是允许范围内能提供Epoch 10/20/30三次连续尾段审核的最短完整周期。",
        "replayPassesPerEpoch": "选择1：每个原始合格目标增加一次道路困难样本重放，先验证稳定收益，避免直接翻倍重放造成过拟合。",
        "pathShortTrajectoryConsistencyWeight": "选择0.25：R4道路基础Loss已为2.0上限，新增一致性项先使用提案下限。",
        "objectWeights": "保持不变：对象拒绝码均在Epoch 100前消失。",
        "reviewThresholds": "保持不变：Smoke仍须连续三次通过全部原机器门禁。",
        "pathTailFailureEpochs": path_tail_epochs,
    }
    return selected, rationale


def expect_value_error(action, message):
    try:
        action()
    except ValueError as error:
        assert message in str(error), f"unexpected error: {error}"
        return True
    raise AssertionError(f"expected ValueError containing: {message}")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_exclusive(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()

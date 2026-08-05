from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path

from train_ai_assisted_conditional_denoiser import (
    validate_v7_r5_candidate_contract,
    validate_v7_r5_stage3_internal_trainer_contract,
    validate_v7_training_authorization,
)


SELECTION_POLICY = "failure_prevalence_linear_mapping_with_minimum_continuation_and_preserved_trajectory_weight"
COVERAGE_CONVERGENCE_SELECTION_POLICY = "failure_prevalence_linear_mapping_with_tail_gate_continuation"


def main():
    parser = ArgumentParser(description="Compile an inactive R5 stage-3 internal isolated configuration without loading a checkpoint.")
    parser.add_argument("--base-r5-config", type=Path, required=True)
    parser.add_argument("--stage3-candidate", type=Path, required=True)
    parser.add_argument("--trainer-support", type=Path, required=True)
    parser.add_argument("--output-config", type=Path, required=True)
    parser.add_argument("--output-selection", type=Path, required=True)
    args = parser.parse_args()

    base_config = read_json(args.base_r5_config)
    candidate = read_json(args.stage3_candidate)
    trainer_support = read_json(args.trainer_support)
    coverage_convergence = is_coverage_convergence_candidate(candidate)
    if coverage_convergence:
        validate_coverage_convergence_selection_source(candidate, trainer_support)
        selected, rationale = select_coverage_convergence_bounded_values(candidate)
        config = compile_coverage_convergence_inactive_config(base_config, candidate, selected)
        selection_policy = COVERAGE_CONVERGENCE_SELECTION_POLICY
        selection_schema = "ai-assisted-v7-r5-stage3-coverage-convergence-isolated-config-selection-v1"
        selection_status = "r5_stage3_coverage_convergence_bounded_values_selected_isolated_config_compiled_not_active"
        next_authorization = "one_r5_stage3_coverage_convergence_checkpoint_continuation_single_sample_gpu_overfit_smoke_only"
    else:
        selected, rationale = select_bounded_values(candidate)
        config = compile_inactive_config(base_config, candidate, selected)
        selection_policy = SELECTION_POLICY
        selection_schema = "ai-assisted-v7-r5-stage3-internal-isolated-config-selection-v1"
        selection_status = "r5_stage3_bounded_values_selected_isolated_config_compiled_not_active"
        next_authorization = "one_r5_stage3_internal_checkpoint_continuation_single_sample_gpu_overfit_smoke_only"
    base_contract = validate_v7_r5_candidate_contract(config)
    stage3_contract = validate_v7_r5_stage3_internal_trainer_contract(config)
    inactive_training_rejected = expect_value_error(
        lambda: validate_v7_training_authorization(config, {}),
        "is isolated and is not authorized for training",
    )
    assert inactive_training_rejected
    if not coverage_convergence:
        assert trainer_support.get("status") == "implemented_cpu_verified_not_selected_not_active_no_checkpoint_load_no_training"

    selection = {
        "schemaVersion": selection_schema,
        "status": selection_status,
        "selectionPolicy": selection_policy,
        "selectedValues": selected,
        "selectionRationale": rationale,
        "baseR5Contract": base_contract,
        "stage3TrainerContract": stage3_contract,
        "boundaries": {
            "configurationActive": False,
            "checkpointFileRead": False,
            "checkpointDeserialized": False,
            "checkpointLoaded": False,
            "optimizerCreated": False,
            "modelWeightsModified": False,
            "gpuTrainingStarted": False,
            "fullTrainingStarted": False,
            "strictRevalidationStarted": False,
            "formalInferenceStarted": False,
            "runtimeFrameStarted": False,
            "worldEntered": False,
        },
        "nextIndependentAuthorization": next_authorization,
    }
    write_json_exclusive(args.output_config, config)
    write_json_exclusive(args.output_selection, selection)
    print(json.dumps(selection, ensure_ascii=False, indent=2))


def select_bounded_values(candidate):
    failure = candidate["failureAnalysis"]
    proposal = candidate["proposal"]
    preview_count = int(failure["previewCount"])
    assert preview_count == 4 and int(failure["failedPreviewCount"]) == 4
    clusters = {row["issueCode"]: row for row in failure["issueClusters"]}
    coverage_cluster = clusters["condition_terrain_path_ground_coverage_mismatch"]
    boundary_cluster = clusters["condition_terrain_path_ground_uncontracted_boundary_contact"]
    coverage_range = proposal["pathCoverageCalibrationProposal"]["weight"]
    boundary_range = proposal["authorizedBoundaryTopologyProposal"]["weight"]
    continuation_range = proposal["checkpointContinuationProposal"]["continuationEpochs"]
    replay_range = proposal["pathHardExampleReplayProposal"]["replayPassesPerEpoch"]
    trajectory_range = proposal["pathShortTrajectoryConsistencyProposal"]["weight"]
    coverage_prevalence = int(coverage_cluster["occurrenceCount"]) / preview_count
    boundary_prevalence = int(boundary_cluster["occurrenceCount"]) / preview_count
    selected = {
        "continuationEpochs": int(continuation_range["minimum"]),
        "replayPassesPerEpoch": int(replay_range["minimum"]),
        "pathCoverageCalibrationWeight": linear_weight(coverage_range, coverage_prevalence),
        "authorizedBoundaryTopologyWeight": linear_weight(boundary_range, boundary_prevalence),
        "pathShortTrajectoryConsistencyWeight": float(trajectory_range["minimum"]),
    }
    assert int(replay_range["minimum"]) == int(replay_range["maximum"]) == 2
    assert selected == {
        "continuationEpochs": 30,
        "replayPassesPerEpoch": 2,
        "pathCoverageCalibrationWeight": 0.75,
        "authorizedBoundaryTopologyWeight": 0.5,
        "pathShortTrajectoryConsistencyWeight": 0.25,
    }
    rationale = {
        "policy": SELECTION_POLICY,
        "coverageFailurePrevalence": coverage_prevalence,
        "boundaryFailurePrevalence": boundary_prevalence,
        "continuationEpochs": "选择30：允许范围下限，同时提供Epoch 10/20/30三次连续尾段审核。",
        "replayPassesPerEpoch": "选择2：候选上下限均为2，只重放原始Owner已通过RGB和绑定条件包。",
        "pathCoverageCalibrationWeight": "覆盖拒绝出现4/4次，按出现率线性映射到0.25—0.75范围上限0.75。",
        "authorizedBoundaryTopologyWeight": "边界拒绝出现2/4次，按出现率线性映射到0.25—0.75范围中点0.50。",
        "pathShortTrajectoryConsistencyWeight": "保持当前值和候选下限0.25，避免与两个新Loss同时放大。",
        "objectSemanticWeights": "保持不变：四张R5预览的对象语义审核全部通过。",
        "reviewThresholds": "保持原机器审核阈值不变，拒绝阈值不作为训练目标。",
    }
    return selected, rationale


def is_coverage_convergence_candidate(candidate):
    proposal = candidate.get("proposal", {})
    return (
        candidate.get("schemaVersion") == "ai-assisted-v7-r5-stage3-coverage-convergence-candidate-v1"
        and "pathActivationMassCalibrationProposal" in proposal
        and "shortTrajectoryCoverageDriftProposal" in proposal
    )


def validate_coverage_convergence_selection_source(candidate, trainer_support):
    assert is_coverage_convergence_candidate(candidate)
    assert candidate.get("status") == "isolated_stage3_coverage_convergence_candidate_cpu_verified_not_implemented_not_active"
    assert candidate.get("reviewThresholdPolicy") == "preserved_unchanged_not_used_as_training_target"
    proposal = candidate["proposal"]
    assert proposal.get("implementationStatus") == "proposal_only_requires_separate_owner_authorization"
    assert proposal.get("trainingAuthorizationStatus") == "not_authorized_proposal_only"
    assert proposal["checkpointContinuationProposal"].get("loadingAuthorizedNow") is False
    assert proposal["checkpointContinuationProposal"]["continuationEpochs"] == {
        "minimum": 10,
        "maximum": 30,
        "selectedValue": None,
    }
    assert proposal["pathActivationMassCalibrationProposal"]["weight"] == {
        "minimum": 0.25,
        "maximum": 0.75,
        "selectedValue": None,
    }
    assert proposal["shortTrajectoryCoverageDriftProposal"]["weight"] == {
        "minimum": 0.1,
        "maximum": 0.35,
        "selectedValue": None,
    }
    assert trainer_support.get("status") == "implemented_cpu_verified_not_selected_not_active"
    trainer_candidate = trainer_support.get("candidate", {})
    assert trainer_candidate.get("path") == "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-convergence-candidate.json"
    assert isinstance(trainer_candidate.get("sha256"), str) and len(trainer_candidate["sha256"]) == 64
    assert trainer_candidate.get("executionValuesSelected") is False
    assert trainer_candidate.get("active") is False
    boundary = trainer_support.get("executionBoundary", {})
    for key in (
        "executionValuesSelected",
        "candidateActive",
        "checkpointLoaded",
        "optimizerCreated",
        "modelWeightsModified",
        "gpuTrainingStarted",
        "fullTrainingStarted",
        "strictRevalidationStarted",
        "formalInferenceStarted",
        "runtimeFrameStarted",
        "worldEntered",
    ):
        assert boundary.get(key) is False


def select_coverage_convergence_bounded_values(candidate):
    failure = candidate["failureAnalysis"]
    proposal = candidate["proposal"]
    preview_count = int(failure["previewCount"])
    rejected_count = len(failure["rejectedEpochs"])
    assert preview_count == 4 and rejected_count == 3
    failure_prevalence = rejected_count / preview_count
    continuation_range = proposal["checkpointContinuationProposal"]["continuationEpochs"]
    activation_range = proposal["pathActivationMassCalibrationProposal"]["weight"]
    drift_range = proposal["shortTrajectoryCoverageDriftProposal"]["weight"]
    tail_epochs = [int(value) for value in proposal["smokeStabilityGate"]["tailEpochs"]]
    continuation_epochs = max(tail_epochs)
    assert int(continuation_range["minimum"]) <= continuation_epochs <= int(continuation_range["maximum"])
    selected = {
        "continuationEpochs": continuation_epochs,
        "pathActivationMassCalibrationWeight": linear_weight(activation_range, failure_prevalence),
        "shortTrajectoryCoverageDriftWeight": linear_weight(drift_range, failure_prevalence),
    }
    assert selected == {
        "continuationEpochs": 30,
        "pathActivationMassCalibrationWeight": 0.625,
        "shortTrajectoryCoverageDriftWeight": 0.2875,
    }
    preserved = proposal["preserveExistingTrainingContract"]
    rationale = {
        "policy": COVERAGE_CONVERGENCE_SELECTION_POLICY,
        "coverageConvergenceFailurePrevalence": failure_prevalence,
        "continuationEpochs": "选择30：覆盖未来Epoch 10/20/30三次连续尾段审核。",
        "pathActivationMassCalibrationWeight": "道路覆盖拒绝出现3/4次，按出现率线性映射到0.25—0.75得到0.625。",
        "shortTrajectoryCoverageDriftWeight": "道路覆盖拒绝出现3/4次，按出现率线性映射到0.10—0.35得到0.2875。",
        "preservedTrainingContract": preserved,
        "objectSemanticWeights": "保持不变：本轮失败证据的对象语义回归数为0。",
        "reviewThresholds": "保持原机器审核阈值不变，拒绝阈值不作为训练目标。",
    }
    return selected, rationale


def linear_weight(bounds, prevalence):
    minimum = float(bounds["minimum"])
    maximum = float(bounds["maximum"])
    assert 0.0 <= prevalence <= 1.0 and minimum <= maximum
    return round(minimum + prevalence * (maximum - minimum), 6)


def compile_inactive_config(base_config, candidate, selected):
    config = deepcopy(base_config)
    proposal = candidate["proposal"]
    training = config["training"]
    training["denoiserEpochs"] = selected["continuationEpochs"]
    training["pathHardExampleReplay"]["passesPerEpoch"] = selected["replayPassesPerEpoch"]
    training["pathHardExampleReplay"]["evidenceEpochs"] = [1, 10, 20, 30]
    training["pathShortTrajectoryConsistency"]["weight"] = selected["pathShortTrajectoryConsistencyWeight"]
    training["pathCoverageCalibration"] = {
        "enabled": True,
        "conditionChannel": proposal["pathCoverageCalibrationProposal"]["conditionChannel"],
        "targetSource": proposal["pathCoverageCalibrationProposal"]["targetSource"],
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "objective": proposal["pathCoverageCalibrationProposal"]["objective"],
        "weight": selected["pathCoverageCalibrationWeight"],
        "supportBandRatio": 0.04,
        "appearanceTemperature": 0.2,
        "activationMargin": 0.0,
    }
    training["authorizedBoundaryTopology"] = {
        "enabled": True,
        "conditionChannel": proposal["authorizedBoundaryTopologyProposal"]["conditionChannel"],
        "allowedSidesSource": proposal["authorizedBoundaryTopologyProposal"]["allowedSidesSource"],
        "requiredBoundarySides": proposal["authorizedBoundaryTopologyProposal"]["requiredBoundarySides"],
        "objective": proposal["authorizedBoundaryTopologyProposal"]["objective"],
        "weight": selected["authorizedBoundaryTopologyWeight"],
        "boundaryBandRatio": float(training.get("pathBoundaryBandRatio", 0.04)),
        "appearanceTemperature": 0.2,
        "activationMargin": 0.0,
    }
    training["r5BoundedSelectionEvidence"]["replayPassesPerEpoch"]["selectedValue"] = selected["replayPassesPerEpoch"]
    checkpoint = proposal["checkpointContinuationProposal"]
    training["r5Stage3CheckpointContinuation"] = {
        "sourceCheckpointPath": checkpoint["sourceCheckpointPath"],
        "sourceCheckpointSha256": checkpoint["sourceCheckpointSha256"],
        "sourceBoundedRepairVersion": "v7_bounded_repair_r5_candidate",
        "loadingAuthorizedNow": False,
        "checkpointFileReadByCompiler": False,
    }
    training["r5Stage3InternalBoundedSelectionEvidence"] = {
        "candidateVersion": proposal["boundedRepairVersion"],
        "candidateStatus": candidate["status"],
        "selectionPolicy": SELECTION_POLICY,
        "continuationEpochs": {**proposal["checkpointContinuationProposal"]["continuationEpochs"], "selectedValue": selected["continuationEpochs"]},
        "replayPassesPerEpoch": {**proposal["pathHardExampleReplayProposal"]["replayPassesPerEpoch"], "selectedValue": selected["replayPassesPerEpoch"]},
        "pathCoverageCalibrationWeight": {**proposal["pathCoverageCalibrationProposal"]["weight"], "selectedValue": selected["pathCoverageCalibrationWeight"]},
        "authorizedBoundaryTopologyWeight": {**proposal["authorizedBoundaryTopologyProposal"]["weight"], "selectedValue": selected["authorizedBoundaryTopologyWeight"]},
        "pathShortTrajectoryConsistencyWeight": {**proposal["pathShortTrajectoryConsistencyProposal"]["weight"], "selectedValue": selected["pathShortTrajectoryConsistencyWeight"]},
        "reviewThresholdPolicy": candidate["reviewThresholdPolicy"],
        "selectedObjectWeightChanges": None,
    }
    training["smokeStabilityGate"]["tailEpochs"] = [10, 20, 30]
    training["smokeStabilityGate"].update({
        "requireZeroPathCoverageIssues": True,
        "requireZeroUnauthorizedBoundaryContacts": True,
        "requireZeroObjectSemanticIssues": True,
        "preserveReviewThresholds": True,
    })
    smoke_epochs = set(int(value) for value in training["fixedEpochPreviewPolicy"].get("smoke", []))
    training["fixedEpochPreviewPolicy"]["smoke"] = sorted(smoke_epochs | {1, 10, 20, 30})
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    authorization = training["ownerTrainingAuthorization"]
    authorization["status"] = "not_authorized_proposal_only"
    for key in (
        "trainerImplementationAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        authorization[key] = False
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage3-internal-isolated"
    config["status"] = "isolated_r5_stage3_internal_candidate_not_active"
    return config


def compile_coverage_convergence_inactive_config(base_config, candidate, selected):
    config = deepcopy(base_config)
    proposal = candidate["proposal"]
    training = config["training"]
    training["denoiserEpochs"] = selected["continuationEpochs"]

    activation = proposal["pathActivationMassCalibrationProposal"]
    training["pathActivationMassCalibration"] = {
        "enabled": True,
        "conditionChannel": activation["conditionChannel"],
        "targetSource": activation["targetSource"],
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "lossForm": activation["lossForm"],
        "weight": selected["pathActivationMassCalibrationWeight"],
        "supportBandRatio": 0.04,
        "appearanceTemperature": 0.2,
        "activationMargin": 0.0,
        "epsilon": 1e-6,
    }
    drift = proposal["shortTrajectoryCoverageDriftProposal"]
    training["shortTrajectoryCoverageDrift"] = {
        "enabled": True,
        "source": drift["source"],
        "failedPreviewTrajectoryUsedAsTrainingTarget": False,
        "objective": drift["objective"],
        "weight": selected["shortTrajectoryCoverageDriftWeight"],
    }

    checkpoint = proposal["checkpointContinuationProposal"]
    training["r5Stage3CheckpointContinuation"] = {
        "sourceCheckpointPath": checkpoint["sourceCheckpointPath"],
        "sourceCheckpointSha256": checkpoint["sourceCheckpointSha256"],
        "sourceBoundedRepairVersion": proposal["boundedRepairVersion"],
        "loadingAuthorizedNow": False,
        "checkpointFileReadByCompiler": False,
    }
    training["r5Stage3CoverageConvergenceBoundedSelectionEvidence"] = {
        "candidateVersion": proposal["boundedRepairVersion"],
        "candidateStatus": candidate["status"],
        "selectionPolicy": COVERAGE_CONVERGENCE_SELECTION_POLICY,
        "continuationEpochs": {
            **proposal["checkpointContinuationProposal"]["continuationEpochs"],
            "selectedValue": selected["continuationEpochs"],
        },
        "pathActivationMassCalibrationWeight": {
            **proposal["pathActivationMassCalibrationProposal"]["weight"],
            "selectedValue": selected["pathActivationMassCalibrationWeight"],
        },
        "shortTrajectoryCoverageDriftWeight": {
            **proposal["shortTrajectoryCoverageDriftProposal"]["weight"],
            "selectedValue": selected["shortTrajectoryCoverageDriftWeight"],
        },
        "preservedExistingTrainingContract": deepcopy(proposal["preserveExistingTrainingContract"]),
        "reviewThresholdPolicy": candidate["reviewThresholdPolicy"],
        "selectedObjectWeightChanges": None,
    }
    training["smokeStabilityGate"].update(deepcopy(proposal["smokeStabilityGate"]))
    smoke_epochs = set(int(value) for value in training["fixedEpochPreviewPolicy"].get("smoke", []))
    training["fixedEpochPreviewPolicy"]["smoke"] = sorted(smoke_epochs | {1, 10, 20, 30})
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    authorization = training["ownerTrainingAuthorization"]
    authorization["status"] = "not_authorized_proposal_only"
    for key in (
        "trainerImplementationAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        authorization[key] = False
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage3-coverage-convergence-isolated"
    config["status"] = "isolated_r5_stage3_coverage_convergence_candidate_not_active"
    validate_compiled_coverage_convergence_isolation(config, candidate, selected)
    return config


def validate_compiled_coverage_convergence_isolation(config, candidate, selected):
    training = config.get("training", {})
    evidence = training.get("r5Stage3CoverageConvergenceBoundedSelectionEvidence", {})
    assert evidence.get("selectionPolicy") == COVERAGE_CONVERGENCE_SELECTION_POLICY
    assert evidence.get("continuationEpochs", {}).get("selectedValue") == selected["continuationEpochs"]
    assert evidence.get("pathActivationMassCalibrationWeight", {}).get("selectedValue") == selected["pathActivationMassCalibrationWeight"]
    assert evidence.get("shortTrajectoryCoverageDriftWeight", {}).get("selectedValue") == selected["shortTrajectoryCoverageDriftWeight"]
    checkpoint = training.get("r5Stage3CheckpointContinuation", {})
    source_checkpoint = candidate["proposal"]["checkpointContinuationProposal"]
    assert checkpoint.get("sourceCheckpointPath") == source_checkpoint["sourceCheckpointPath"]
    assert checkpoint.get("sourceCheckpointSha256") == source_checkpoint["sourceCheckpointSha256"]
    assert checkpoint.get("checkpointFileReadByCompiler") is False
    assert checkpoint.get("loadingAuthorizedNow") is False
    assert training.get("trainingAuthorizationStatus") == "not_authorized_candidate_only"
    authorization = training.get("ownerTrainingAuthorization", {})
    for key in (
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "singleSampleGpuOverfitSmokeAuthorized",
        "automaticRetryAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        assert authorization.get(key) is False
    return True


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

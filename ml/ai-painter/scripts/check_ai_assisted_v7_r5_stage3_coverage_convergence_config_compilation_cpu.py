from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from compile_ai_assisted_v7_r5_stage3_internal_isolated_config import (
    compile_coverage_convergence_inactive_config,
    compile_inactive_config,
    select_bounded_values,
    select_coverage_convergence_bounded_values,
    validate_compiled_coverage_convergence_isolation,
    validate_coverage_convergence_selection_source,
)
from train_ai_assisted_conditional_denoiser import (
    validate_v7_r5_candidate_contract,
    validate_v7_r5_stage3_internal_trainer_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="CPU positive/negative regression for the inactive R5 stage-3 coverage-convergence config compiler.")
    parser.add_argument("--base-r5-config", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--trainer-support", type=Path, required=True)
    parser.add_argument("--legacy-base-r5-config", type=Path, required=True)
    parser.add_argument("--legacy-candidate", type=Path, required=True)
    parser.add_argument("--legacy-trainer-support", type=Path, required=True)
    parser.add_argument("--compiler", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    base_config = read_json(args.base_r5_config)
    candidate = read_json(args.candidate)
    trainer_support = read_json(args.trainer_support)
    validate_coverage_convergence_selection_source(candidate, trainer_support)
    selected, rationale = select_coverage_convergence_bounded_values(candidate)
    config = compile_coverage_convergence_inactive_config(base_config, candidate, selected)
    base_contract = validate_v7_r5_candidate_contract(config)
    stage3_contract = validate_v7_r5_stage3_internal_trainer_contract(config)

    legacy_base = read_json(args.legacy_base_r5_config)
    legacy_candidate = read_json(args.legacy_candidate)
    legacy_support = read_json(args.legacy_trainer_support)
    legacy_selected, _ = select_bounded_values(legacy_candidate)
    legacy_config = compile_inactive_config(legacy_base, legacy_candidate, legacy_selected)
    legacy_contract = validate_v7_r5_stage3_internal_trainer_contract(legacy_config)

    positive = {
        "coverageConvergenceSourceAccepted": True,
        "failurePrevalenceMappedToExpectedWeights": selected == {
            "continuationEpochs": 30,
            "pathActivationMassCalibrationWeight": 0.625,
            "shortTrajectoryCoverageDriftWeight": 0.2875,
        },
        "tailGateContinuationSelected": selected["continuationEpochs"] == 30,
        "activationMassWeightWithinBounds": 0.25 <= selected["pathActivationMassCalibrationWeight"] <= 0.75,
        "coverageDriftWeightWithinBounds": 0.1 <= selected["shortTrajectoryCoverageDriftWeight"] <= 0.35,
        "baseR5ContractAccepted": base_contract["status"] == "r5_candidate_contract_valid_not_authorized_for_training",
        "stage3ContractAccepted": stage3_contract["status"] == "r5_stage3_internal_trainer_contract_valid_not_active",
        "coverageConvergenceContractAccepted": stage3_contract["coverageConvergence"]["status"] == "r5_stage3_coverage_convergence_trainer_contract_valid_not_active",
        "inactiveTrainingRejected": expect_value_error(
            lambda: validate_v7_training_authorization(config, {}),
            "is isolated and is not authorized for training",
        ),
        "checkpointIdentityCopiedWithoutRead": config["training"]["r5Stage3CheckpointContinuation"]["checkpointFileReadByCompiler"] is False,
        "checkpointLoadingRemainsDisabled": config["training"]["r5Stage3CheckpointContinuation"]["loadingAuthorizedNow"] is False,
        "optimizerAuthorizationRemainsDisabled": config["training"]["ownerTrainingAuthorization"]["optimizerCreationAuthorized"] is False,
        "modelWeightMutationRemainsDisabled": config["training"]["ownerTrainingAuthorization"]["modelWeightMutationAuthorized"] is False,
        "gpuTrainingRemainsDisabled": config["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] is False,
        "existingCoverageWeightPreserved": config["training"]["pathCoverageCalibration"]["weight"] == 0.75,
        "existingBoundaryWeightPreserved": config["training"]["authorizedBoundaryTopology"]["weight"] == 0.5,
        "existingTrajectoryWeightPreserved": config["training"]["pathShortTrajectoryConsistency"]["weight"] == 0.25,
        "legacyCandidateStillAccepted": legacy_contract["coverageConvergence"] is None,
        "legacySelectionUnchanged": legacy_selected == {
            "continuationEpochs": 30,
            "replayPassesPerEpoch": 2,
            "pathCoverageCalibrationWeight": 0.75,
            "authorizedBoundaryTopologyWeight": 0.5,
            "pathShortTrajectoryConsistencyWeight": 0.25,
        },
        "reviewThresholdPolicyPreserved": rationale["reviewThresholds"].startswith("保持原机器审核阈值不变"),
    }

    invalid_activation_low = deepcopy(config)
    invalid_activation_low["training"]["pathActivationMassCalibration"]["weight"] = 0.24
    invalid_activation_high = deepcopy(config)
    invalid_activation_high["training"]["pathActivationMassCalibration"]["weight"] = 0.76
    invalid_drift_low = deepcopy(config)
    invalid_drift_low["training"]["shortTrajectoryCoverageDrift"]["weight"] = 0.09
    invalid_drift_high = deepcopy(config)
    invalid_drift_high["training"]["shortTrajectoryCoverageDrift"]["weight"] = 0.36
    invalid_failed_pixels = deepcopy(config)
    invalid_failed_pixels["training"]["pathActivationMassCalibration"]["failedPreviewPixelsUsedAsTrainingTargets"] = True
    invalid_review_target = deepcopy(config)
    invalid_review_target["training"]["pathActivationMassCalibration"]["machineReviewThresholdUsedAsTrainingTarget"] = True
    invalid_failed_trajectory = deepcopy(config)
    invalid_failed_trajectory["training"]["shortTrajectoryCoverageDrift"]["failedPreviewTrajectoryUsedAsTrainingTarget"] = True
    invalid_checkpoint_read = deepcopy(config)
    invalid_checkpoint_read["training"]["r5Stage3CheckpointContinuation"]["checkpointFileReadByCompiler"] = True
    invalid_checkpoint_load = deepcopy(config)
    invalid_checkpoint_load["training"]["r5Stage3CheckpointContinuation"]["loadingAuthorizedNow"] = True
    invalid_optimizer = deepcopy(config)
    invalid_optimizer["training"]["ownerTrainingAuthorization"]["optimizerCreationAuthorized"] = True
    invalid_gpu = deepcopy(config)
    invalid_gpu["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] = True
    selected_candidate = deepcopy(candidate)
    selected_candidate["proposal"]["pathActivationMassCalibrationProposal"]["weight"]["selectedValue"] = 0.625
    active_support = deepcopy(trainer_support)
    active_support["candidate"]["active"] = True

    negative = {
        "activationWeightBelowBoundRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_activation_low), "activation-mass weight is outside"
        ),
        "activationWeightAboveBoundRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_activation_high), "activation-mass weight is outside"
        ),
        "driftWeightBelowBoundRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_drift_low), "coverage drift weight is outside"
        ),
        "driftWeightAboveBoundRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_drift_high), "coverage drift weight is outside"
        ),
        "failedPreviewPixelsRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_failed_pixels), "cannot use failed preview pixels"
        ),
        "machineReviewTargetRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_review_target), "cannot use machine-review thresholds"
        ),
        "failedPreviewTrajectoryRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_failed_trajectory), "cannot use failed preview trajectories"
        ),
        "checkpointReadFlagRejected": expect_assertion(
            lambda: validate_compiled_coverage_convergence_isolation(invalid_checkpoint_read, candidate, selected)
        ),
        "checkpointLoadingFlagRejected": expect_assertion(
            lambda: validate_compiled_coverage_convergence_isolation(invalid_checkpoint_load, candidate, selected)
        ),
        "optimizerAuthorizationRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_optimizer), "active execution authorization"
        ),
        "gpuAuthorizationRejected": expect_value_error(
            lambda: validate_v7_r5_stage3_internal_trainer_contract(invalid_gpu), "active execution authorization"
        ),
        "preselectedCandidateRejected": expect_assertion(
            lambda: validate_coverage_convergence_selection_source(selected_candidate, trainer_support)
        ),
        "activeTrainerSupportRejected": expect_assertion(
            lambda: validate_coverage_convergence_selection_source(candidate, active_support)
        ),
    }
    assert all(positive.values()), positive
    assert all(negative.values()), negative

    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage3-coverage-convergence-config-compilation-cpu-regression-v1",
        "status": "passed_cpu_only_bounded_selection_inactive_config_compilation_not_active",
        "device": "cpu",
        "inputs": {
            "candidatePath": args.candidate.as_posix(),
            "candidateSha256": sha256_file(args.candidate),
            "trainerSupportPath": args.trainer_support.as_posix(),
            "trainerSupportSha256": sha256_file(args.trainer_support),
            "baseConfigPath": args.base_r5_config.as_posix(),
            "baseConfigSha256": sha256_file(args.base_r5_config),
            "compilerPath": args.compiler.as_posix(),
            "compilerSha256": sha256_file(args.compiler),
        },
        "selectedValues": selected,
        "positiveRegression": positive,
        "negativeRegression": negative,
        "positiveAssertionsPassed": len(positive),
        "negativeAssertionsPassed": len(negative),
        "executionBoundary": {
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
    }
    write_json_exclusive(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def expect_value_error(action, message):
    try:
        action()
    except ValueError as error:
        assert message in str(error), f"unexpected error: {error}"
        return True
    raise AssertionError(f"expected ValueError containing: {message}")


def expect_assertion(action):
    try:
        action()
    except AssertionError:
        return True
    raise AssertionError("expected AssertionError")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_exclusive(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()

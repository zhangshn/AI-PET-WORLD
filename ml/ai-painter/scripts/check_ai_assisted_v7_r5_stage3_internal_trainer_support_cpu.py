import argparse
import json
from copy import deepcopy
from pathlib import Path

import torch

from train_ai_assisted_conditional_denoiser import (
    authorized_boundary_topology_loss,
    path_activation_mass_calibration_loss,
    path_coverage_calibration_loss,
    r5_path_replay_passes_per_epoch,
    serialize_condition_evidence_metrics,
    short_trajectory_coverage_drift_loss,
    validate_v7_r5_stage3_internal_trainer_contract,
)


def expect_rejected(config, expected_fragment):
    try:
        validate_v7_r5_stage3_internal_trainer_contract(config)
    except ValueError as error:
        return expected_fragment in str(error)
    return False


def expect_metric_serialization_rejected(metrics, expected_fragment):
    try:
        serialize_condition_evidence_metrics(metrics)
    except ValueError as error:
        return expected_fragment in str(error)
    return False


def build_contract_config():
    return {
        "conditionChannelOrder": ["terrain_path_ground"],
        "training": {
            "pathBoundaryBandRatio": 0.125,
            "pathHardExampleReplay": {
                "enabled": True,
                "targetSource": "original_owner_approved_rgb_and_condition_pack_only",
                "failedPreviewPixelsUsedAsTrainingTargets": False,
                "passesPerEpoch": 2,
            },
            "pathCoverageCalibration": {
                "enabled": True,
                "conditionChannel": "terrain_path_ground",
                "targetSource": "original_condition_mask_support_only",
                "machineReviewThresholdUsedAsTrainingTarget": False,
                "weight": 0.25,
                "supportBandRatio": 0.0625,
                "appearanceTemperature": 0.2,
                "activationMargin": 0.0,
            },
            "authorizedBoundaryTopology": {
                "enabled": True,
                "conditionChannel": "terrain_path_ground",
                "allowedSidesSource": "original_condition_channel_boundary_contact_only",
                "weight": 0.75,
                "boundaryBandRatio": 0.125,
                "appearanceTemperature": 0.2,
                "activationMargin": 0.0,
            },
            "pathActivationMassCalibration": {
                "enabled": True,
                "conditionChannel": "terrain_path_ground",
                "targetSource": "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only",
                "failedPreviewPixelsUsedAsTrainingTargets": False,
                "machineReviewThresholdUsedAsTrainingTarget": False,
                "lossForm": "symmetric_log_activation_mass_ratio_plus_outside_support_leakage",
                "weight": 0.25,
                "supportBandRatio": 0.0625,
                "appearanceTemperature": 0.2,
                "activationMargin": 0.0,
            },
            "shortTrajectoryCoverageDrift": {
                "enabled": True,
                "source": "current_training_prediction_steps_against_original_target_activation_mass_only",
                "failedPreviewTrajectoryUsedAsTrainingTarget": False,
                "weight": 0.1,
            },
            "ownerTrainingAuthorization": {
                "checkpointLoadingAuthorized": False,
                "optimizerCreationAuthorized": False,
                "gpuTrainingAuthorizedNow": False,
                "fullTrainingAuthorized": False,
                "strictRevalidationAuthorized": False,
                "formalInferenceAuthorized": False,
                "runtimeFrameAuthorized": False,
                "worldEntryAuthorized": False,
            },
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    torch.set_num_threads(1)

    config = build_contract_config()
    contract = validate_v7_r5_stage3_internal_trainer_contract(config)
    height = width = 16
    conditions = torch.zeros((1, 1, height, width), dtype=torch.float32, device="cpu")
    conditions[:, :, 7:, 7:9] = 1.0
    target = torch.empty((1, 3, height, width), dtype=torch.float32, device="cpu")
    target[:, 0] = 0.20
    target[:, 1] = 0.55
    target[:, 2] = 0.15
    path_color = torch.tensor([0.55, 0.32, 0.12], dtype=torch.float32).view(1, 3, 1, 1)
    target = target * (1.0 - conditions) + path_color * conditions

    clean_coverage = float(path_coverage_calibration_loss(target, target, conditions, config))
    clean_boundary = float(authorized_boundary_topology_loss(target, target, conditions, config))

    spurious_coverage = target.clone()
    spurious_coverage[:, :, 3:6, 1:4] = path_color
    spurious_coverage.requires_grad_(True)
    coverage_loss = path_coverage_calibration_loss(spurious_coverage, target, conditions, config)
    coverage_loss.backward()
    coverage_gradient = float(spurious_coverage.grad[:, :, 3:6, 1:4].abs().sum())

    unauthorized_boundary = target.clone()
    unauthorized_boundary[:, :, :2, :4] = path_color
    unauthorized_boundary.requires_grad_(True)
    boundary_loss = authorized_boundary_topology_loss(unauthorized_boundary, target, conditions, config)
    boundary_loss.backward()
    boundary_gradient = float(unauthorized_boundary.grad[:, :, :2, :4].abs().sum())

    authorized_south = target.clone()
    authorized_south[:, :, -2:, 3:6] = path_color
    authorized_south_loss = float(authorized_boundary_topology_loss(authorized_south, target, conditions, config))

    clean_activation_mass = float(path_activation_mass_calibration_loss(target, target, conditions, config))
    undercovered_path = target.clone()
    undercovered_path[:, :, 9:13, 7:9] = torch.tensor([0.20, 0.55, 0.15]).view(1, 3, 1, 1)
    undercovered_path.requires_grad_(True)
    undercoverage_loss = path_activation_mass_calibration_loss(undercovered_path, target, conditions, config)
    undercoverage_loss.backward()
    undercoverage_gradient = float(undercovered_path.grad[:, :, 9:13, 7:9].abs().sum())

    overcovered_path = target.clone()
    overcovered_path[:, :, 9:13, 6:7] = path_color
    overcovered_path.requires_grad_(True)
    overcoverage_loss = path_activation_mass_calibration_loss(overcovered_path, target, conditions, config)
    overcoverage_loss.backward()
    overcoverage_gradient = float(overcovered_path.grad[:, :, 9:13, 6:7].abs().sum())

    outside_support_path = target.clone()
    outside_support_path[:, :, 2:5, 1:4] = path_color
    outside_support_loss = float(path_activation_mass_calibration_loss(outside_support_path, target, conditions, config))

    stable_drift = float(short_trajectory_coverage_drift_loss([target, target.clone()], target, conditions, config))
    drifting_step = overcovered_path.detach().clone().requires_grad_(True)
    drifting_loss = short_trajectory_coverage_drift_loss([target, drifting_step], target, conditions, config)
    drifting_loss.backward()
    drifting_gradient = float(drifting_step.grad.abs().sum())

    invalid_failed_preview = deepcopy(config)
    invalid_failed_preview["training"]["pathHardExampleReplay"]["failedPreviewPixelsUsedAsTrainingTargets"] = True
    invalid_coverage_source = deepcopy(config)
    invalid_coverage_source["training"]["pathCoverageCalibration"]["targetSource"] = "machine_review_signal_ratio"
    invalid_review_target = deepcopy(config)
    invalid_review_target["training"]["pathCoverageCalibration"]["machineReviewThresholdUsedAsTrainingTarget"] = True
    invalid_boundary_source = deepcopy(config)
    invalid_boundary_source["training"]["authorizedBoundaryTopology"]["allowedSidesSource"] = "failed_preview_boundary_sides"
    invalid_low_weight = deepcopy(config)
    invalid_low_weight["training"]["pathCoverageCalibration"]["weight"] = 0.24
    invalid_high_weight = deepcopy(config)
    invalid_high_weight["training"]["authorizedBoundaryTopology"]["weight"] = 0.76
    invalid_replay_count = deepcopy(config)
    invalid_replay_count["training"]["pathHardExampleReplay"]["passesPerEpoch"] = 3
    invalid_execution = deepcopy(config)
    invalid_execution["training"]["ownerTrainingAuthorization"]["optimizerCreationAuthorized"] = True
    invalid_activation_failed_preview = deepcopy(config)
    invalid_activation_failed_preview["training"]["pathActivationMassCalibration"]["failedPreviewPixelsUsedAsTrainingTargets"] = True
    invalid_activation_review_target = deepcopy(config)
    invalid_activation_review_target["training"]["pathActivationMassCalibration"]["machineReviewThresholdUsedAsTrainingTarget"] = True
    invalid_activation_source = deepcopy(config)
    invalid_activation_source["training"]["pathActivationMassCalibration"]["targetSource"] = "failed_preview_activation_mass"
    invalid_activation_form = deepcopy(config)
    invalid_activation_form["training"]["pathActivationMassCalibration"]["lossForm"] = "one_sided_review_ratio"
    invalid_activation_weight = deepcopy(config)
    invalid_activation_weight["training"]["pathActivationMassCalibration"]["weight"] = 0.24
    invalid_drift_failed_preview = deepcopy(config)
    invalid_drift_failed_preview["training"]["shortTrajectoryCoverageDrift"]["failedPreviewTrajectoryUsedAsTrainingTarget"] = True
    invalid_drift_source = deepcopy(config)
    invalid_drift_source["training"]["shortTrajectoryCoverageDrift"]["source"] = "failed_preview_trajectory"
    invalid_drift_weight = deepcopy(config)
    invalid_drift_weight["training"]["shortTrajectoryCoverageDrift"]["weight"] = 0.36

    serialized_metrics = serialize_condition_evidence_metrics({
        "compositeLossTensor": torch.tensor(1.0),
        "compositeLoss": torch.tensor(1.0),
        "velocityPredictionMse": torch.tensor(0.5),
        "cleanLatentMae": torch.tensor(0.25),
        "compositeConditionQualityScore": torch.tensor(0.75),
        "decodedRgbMae": torch.tensor(0.125),
        "pathCoverageCalibrationLoss": torch.tensor(0.0625),
        "predictedRgbTensor": torch.zeros((1, 3, 4, 4), dtype=torch.float32),
    })
    invalid_unknown_image_tensor = {
        "unexpectedSpatialTensor": torch.zeros((1, 3, 4, 4), dtype=torch.float32),
    }
    invalid_predicted_rgb_shape = {
        "predictedRgbTensor": torch.zeros((1, 4, 4), dtype=torch.float32),
    }
    invalid_metric_type = {
        "decodedRgbMae": {"value": 0.125},
    }

    positive = {
        "contractAcceptedAtAuthorizedBounds": contract["status"] == "r5_stage3_internal_trainer_contract_valid_not_active",
        "coverageConvergenceContractAcceptedAtCandidateBounds": contract["coverageConvergence"]["status"] == "r5_stage3_coverage_convergence_trainer_contract_valid_not_active",
        "exactlyTwoOriginalTargetReplayPassesSupported": r5_path_replay_passes_per_epoch(config) == 2,
        "cleanOriginalTargetCoverageHasZeroExcess": clean_coverage == 0.0,
        "spuriousRoadCoverageProducesPositiveLoss": float(coverage_loss) > 0.0,
        "spuriousRoadCoverageProducesGradient": coverage_gradient > 0.0,
        "cleanOriginalBoundaryTopologyHasZeroExcess": clean_boundary == 0.0,
        "unauthorizedBoundaryContactProducesPositiveLoss": float(boundary_loss) > 0.0,
        "unauthorizedBoundaryContactProducesGradient": boundary_gradient > 0.0,
        "originallyAuthorizedSouthSideIsNotPenalized": authorized_south_loss == 0.0,
        "ownerApprovedTargetHasZeroActivationMassLoss": clean_activation_mass == 0.0,
        "undercoverageProducesSymmetricActivationMassLoss": float(undercoverage_loss) > 0.0,
        "undercoverageProducesGradient": undercoverage_gradient > 0.0,
        "overcoverageProducesSymmetricActivationMassLoss": float(overcoverage_loss) > 0.0,
        "overcoverageProducesGradient": overcoverage_gradient > 0.0,
        "outsideSupportRoadActivationProducesLeakageLoss": outside_support_loss > 0.0,
        "stableShortTrajectoryHasZeroCoverageDrift": stable_drift == 0.0,
        "changingShortTrajectoryProducesCoverageDrift": float(drifting_loss) > 0.0,
        "changingShortTrajectoryProducesGradient": drifting_gradient > 0.0,
        "knownPredictedRgbTensorExcludedFromScalarEvidence": "predictedRgbTensor" not in serialized_metrics,
        "scalarConditionEvidenceMetricsPreserved": serialized_metrics == {
            "decodedRgbMae": 0.125,
            "pathCoverageCalibrationLoss": 0.0625,
        },
    }
    negative = {
        "failedPreviewTargetsRejected": expect_rejected(invalid_failed_preview, "failed preview pixels"),
        "machineReviewCoverageSourceRejected": expect_rejected(invalid_coverage_source, "target source"),
        "machineReviewThresholdTargetRejected": expect_rejected(invalid_review_target, "machine-review threshold"),
        "failedPreviewBoundarySourceRejected": expect_rejected(invalid_boundary_source, "boundary source"),
        "coverageWeightBelowBoundRejected": expect_rejected(invalid_low_weight, "outside the authorized implementation bounds"),
        "boundaryWeightAboveBoundRejected": expect_rejected(invalid_high_weight, "outside the authorized implementation bounds"),
        "thirdReplayPassRejected": expect_rejected(invalid_replay_count, "exactly two"),
        "optimizerAuthorizationRejected": expect_rejected(invalid_execution, "active execution authorization"),
        "activationMassFailedPreviewTargetsRejected": expect_rejected(invalid_activation_failed_preview, "failed preview pixels"),
        "activationMassReviewThresholdTargetsRejected": expect_rejected(invalid_activation_review_target, "machine-review thresholds"),
        "activationMassWrongSourceRejected": expect_rejected(invalid_activation_source, "activation-mass target source"),
        "activationMassWrongLossFormRejected": expect_rejected(invalid_activation_form, "loss form"),
        "activationMassWeightOutsideCandidateBoundsRejected": expect_rejected(invalid_activation_weight, "outside the candidate bounds"),
        "coverageDriftFailedPreviewTrajectoryRejected": expect_rejected(invalid_drift_failed_preview, "failed preview trajectories"),
        "coverageDriftWrongSourceRejected": expect_rejected(invalid_drift_source, "coverage drift source"),
        "coverageDriftWeightOutsideCandidateBoundsRejected": expect_rejected(invalid_drift_weight, "outside the candidate bounds"),
        "unknownNonScalarTensorRejected": expect_metric_serialization_rejected(invalid_unknown_image_tensor, "must be scalar"),
        "invalidPredictedRgbTensorShapeRejected": expect_metric_serialization_rejected(invalid_predicted_rgb_shape, "batched RGB image tensor"),
        "unsupportedMetricTypeRejected": expect_metric_serialization_rejected(invalid_metric_type, "unsupported type"),
    }
    passed = all(positive.values()) and all(negative.values())
    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage3-coverage-convergence-trainer-support-cpu-regression-v1",
        "status": "passed_cpu_only_stage3_coverage_convergence_trainer_support_not_selected_not_active" if passed else "failed_closed_cpu_regression",
        "device": "cpu",
        "candidateEvidence": {
            "path": "data/ai-painter/system-governance/v7-r5-stage3-internal-path-coverage-convergence-candidate.json",
            "sha256": "20902ff2aed25fff6575c6a46e1cb44188ccee0565a2bbcbe8bfe552dab04615",
        },
        "authorizationEvidence": {
            "requestPath": ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-trainer-support-20260805/request.json",
            "requestSha256": "541a89b7144833798da632fd24c99aa19bbff2c84457fab8907be8ad137067a5",
            "consumptionPath": ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-trainer-support-20260805/authorization-consumption.json",
            "consumptionSha256": "e396ed5e193938b6a90dcd98e26456e1c5b7b286b8e90877b5732a40c3eea7ce",
        },
        "positiveRegression": positive,
        "negativeRegression": negative,
        "measurements": {
            "cleanCoverageLoss": clean_coverage,
            "spuriousCoverageLoss": float(coverage_loss),
            "spuriousCoverageGradientL1": coverage_gradient,
            "cleanBoundaryTopologyLoss": clean_boundary,
            "unauthorizedBoundaryTopologyLoss": float(boundary_loss),
            "unauthorizedBoundaryGradientL1": boundary_gradient,
            "authorizedSouthBoundaryTopologyLoss": authorized_south_loss,
            "cleanActivationMassCalibrationLoss": clean_activation_mass,
            "undercoverageActivationMassLoss": float(undercoverage_loss),
            "undercoverageActivationMassGradientL1": undercoverage_gradient,
            "overcoverageActivationMassLoss": float(overcoverage_loss),
            "overcoverageActivationMassGradientL1": overcoverage_gradient,
            "outsideSupportLeakageLoss": outside_support_loss,
            "stableShortTrajectoryCoverageDriftLoss": stable_drift,
            "changingShortTrajectoryCoverageDriftLoss": float(drifting_loss),
            "changingShortTrajectoryCoverageDriftGradientL1": drifting_gradient,
            "replayPassesPerEpoch": r5_path_replay_passes_per_epoch(config),
        },
        "executionBoundary": {
            "executionValuesSelected": False,
            "candidateActive": False,
            "checkpointLoaded": False,
            "optimizerCreated": False,
            "modelWeightsModified": False,
            "gpuTrainingStarted": False,
            "validationStarted": False,
            "formalInferenceStarted": False,
            "runtimeFrameStarted": False,
            "worldEntered": False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

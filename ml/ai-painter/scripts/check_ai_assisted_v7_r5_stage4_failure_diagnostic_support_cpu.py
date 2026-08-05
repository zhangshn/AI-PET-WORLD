from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

import torch


ROOT = Path.cwd()
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
TRAINER_SHA256 = "836899f6cc596d6555fd5fb7aa18c94ade8ed324b1a4a058d982ecc4412996da"
AUTHORIZATION_PATH = Path(".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-diagnostic-trainer-support-20260805/request.json")
AUTHORIZATION_SHA256 = "4a314080c8a43bcab0b8dd943f00ad9476bc6ba7b7c9eafaed8272d99f9a7559"
CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "authorization-consumption.json"
CONSUMPTION_SHA256 = "ac3fc4717bdcce78d9b7debe2842d9b6769dcbc2a06f056aab1e69fe2bc942d6"
COMMAND_REF = "owner-authorized-v7-r5-stage4-diagnostic-trainer-support-cpu-regression-20260805"
SCOPE = "implement_stage4_object_and_route_diagnostics_support_and_cpu_positive_negative_regression_only"
PROPOSAL_PATH = Path(".runtime/ai-painter/local-ai-failure-learning-r5-stage4/local-ai-v7-r5-stage4-failure-learning-2026-08-05T10-52-29-779Z/read-only-repair-proposal.json")
PROPOSAL_SHA256 = "2a5d311fbf397c0438fa030e12fef21ecfb58c323436ed3c4e682fe15e43b677"
FAILURE_LEARNING_TERMINAL_PATH = PROPOSAL_PATH.parent / "phase-terminal.json"
FAILURE_LEARNING_TERMINAL_SHA256 = "1b7ad85c7828416e23c8b58bc16e511b6af523147973092747873ee80941a790"
OBJECT_CHANNELS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
OBJECT_MEASUREMENTS = ["independent_loss", "gradient_contribution", "decoded_response"]
ROUTE_MEASUREMENTS = ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    torch.set_num_threads(1)
    validate_authorization()
    trainer = load_trainer()
    config = diagnostic_config()
    contract_result = trainer.validate_v7_r5_stage4_failure_diagnostic_support_contract(config)
    target, conditions = synthetic_inputs(config)
    good = target.clone().requires_grad_(True)
    missing = torch.zeros_like(target).requires_grad_(True)
    shifted = shifted_route_prediction(target, conditions, config).requires_grad_(True)
    truncated = truncated_route_prediction(target, conditions, config).requires_grad_(True)
    good_metrics = trainer.stage4_failure_diagnostic_metrics(good, target, conditions, config)
    missing_metrics = trainer.stage4_failure_diagnostic_metrics(missing, target, conditions, config)
    shifted_metrics = trainer.stage4_failure_diagnostic_metrics(shifted, target, conditions, config)
    truncated_metrics = trainer.stage4_failure_diagnostic_metrics(truncated, target, conditions, config)

    positive = {
        "supportContractAccepted": contract_result["status"] == "r5_stage4_failure_diagnostic_support_contract_valid_not_active",
        "objectChannelsBound": contract_result["objectChannels"] == OBJECT_CHANNELS,
        "objectMeasurementsBound": contract_result["objectMeasurements"] == OBJECT_MEASUREMENTS,
        "routeMeasurementsBound": contract_result["routeMeasurements"] == ROUTE_MEASUREMENTS,
        "executionValuesRemainUnselected": contract_result["executionValuesSelected"] is False,
        "trainingConfigRemainsUnapplied": contract_result["trainingConfigApplied"] is False,
        "allObjectDiagnosticScalarsPresent": all_object_metrics_present(good_metrics),
        "exactObjectTargetsHaveZeroIndependentLoss": all(float(good_metrics[f"stage4Diagnostic{prefix}IndependentLoss"]) == 0.0 for prefix in object_prefixes()),
        "missingObjectsIncreaseIndependentLoss": all(float(missing_metrics[f"stage4Diagnostic{prefix}IndependentLoss"]) > float(good_metrics[f"stage4Diagnostic{prefix}IndependentLoss"]) for prefix in object_prefixes()),
        "exactObjectTargetsHaveZeroPrototypeError": all(float(good_metrics[f"stage4Diagnostic{prefix}DecodedResponsePrototypeMae"]) == 0.0 for prefix in object_prefixes()),
        "missingObjectsIncreasePrototypeError": all(float(missing_metrics[f"stage4Diagnostic{prefix}DecodedResponsePrototypeMae"]) > float(good_metrics[f"stage4Diagnostic{prefix}DecodedResponsePrototypeMae"]) for prefix in object_prefixes()),
        "missingObjectsProduceGradientContribution": all(float(missing_metrics[f"stage4Diagnostic{prefix}GradientContribution"]) > 0.0 for prefix in object_prefixes()),
        "exactRouteHasUnitActivationMass": abs(float(good_metrics["stage4DiagnosticRouteActivationMassRatio"]) - 1.0) < 1e-6,
        "missingRouteReducesActivationMass": float(missing_metrics["stage4DiagnosticRouteActivationMassRatio"]) < float(good_metrics["stage4DiagnosticRouteActivationMassRatio"]),
        "exactRouteHasZeroSpatialMismatch": float(good_metrics["stage4DiagnosticRouteSpatialDistributionL1"]) < 1e-8,
        "shiftedRouteIncreasesSpatialMismatch": float(shifted_metrics["stage4DiagnosticRouteSpatialDistributionL1"]) > float(good_metrics["stage4DiagnosticRouteSpatialDistributionL1"]),
        "exactRouteHasZeroCentroidDrift": float(good_metrics["stage4DiagnosticRouteCentroidDrift"]) < 1e-8,
        "shiftedRouteIncreasesCentroidDrift": float(shifted_metrics["stage4DiagnosticRouteCentroidDrift"]) > float(good_metrics["stage4DiagnosticRouteCentroidDrift"]),
        "exactRouteHasStrongRequiredBoundaryContact": float(good_metrics["stage4DiagnosticRouteRequiredBoundaryContactMinimum"]) > 0.99,
        "truncatedRouteWeakensRequiredBoundaryContact": float(truncated_metrics["stage4DiagnosticRouteRequiredBoundaryContactMinimum"]) < float(good_metrics["stage4DiagnosticRouteRequiredBoundaryContactMinimum"]),
        "legacyConfigProducesNoStage4Diagnostics": trainer.stage4_failure_diagnostic_metrics(good, target, conditions, legacy_config(config)) == {},
    }
    negative = {
        "objectChannelMutationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"]["objectSemanticDiagnostics"].update(channels=list(reversed(OBJECT_CHANNELS)))),
        "objectMeasurementRemovalRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"]["objectSemanticDiagnostics"].update(measurements=OBJECT_MEASUREMENTS[:-1])),
        "gradientTargetMutationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"]["objectSemanticDiagnostics"].update(gradientTarget="model_weights")),
        "objectWeightChangeFlagRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"]["objectSemanticDiagnostics"].update(changesTrainingWeightsNow=True)),
        "objectWeightMutationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["objectSemanticChannelWeights"].update(object_tree=1.5)),
        "routeMeasurementRemovalRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"]["routeLateRegressionDiagnostics"].update(measurements=ROUTE_MEASUREMENTS[:-1])),
        "pathWeightMutationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["denoiserLossWeights"].update(pathInteriorRgb=2.5)),
        "reviewThresholdMutationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(reviewThresholdsModified=True)),
        "failedPreviewTargetRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(failedPreviewPixelsUsedAsTrainingTargets=True)),
        "executionValueSelectionRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(executionValuesSelected=True)),
        "trainingConfigApplicationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(trainingConfigApplied=True)),
        "checkpointReadRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(checkpointFileReadAuthorized=True)),
        "gpuUseRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(gpuUseAuthorized=True)),
        "trainingAuthorizationRejected": expect_contract_rejected(trainer, config, lambda value: value["training"]["stage4FailureDiagnostics"].update(trainingAuthorized=True)),
        "invalidRouteGridRejected": expect_metrics_rejected(trainer, config, target, conditions, lambda value: value["training"]["stage4FailureDiagnostics"]["routeLateRegressionDiagnostics"].update(spatialGridSize=1)),
        "missingRequiredBoundaryRejected": expect_metrics_rejected(trainer, config, target, conditions, lambda value: value["training"]["authorizedBoundaryTopology"].update(requiredBoundarySides=[])),
    }
    failures = [name for name, passed in {**positive, **negative}.items() if not passed]
    now = datetime.now(timezone.utc)
    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage4-failure-diagnostic-trainer-support-cpu-regression-v1",
        "status": "passed_cpu_only_stage4_diagnostic_support_not_active" if not failures else "failed_cpu_only_stage4_diagnostic_support",
        "device": "cpu",
        "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "generatedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "inputs": {
            "authorizationPath": project_path(AUTHORIZATION_PATH),
            "authorizationSha256": AUTHORIZATION_SHA256,
            "consumptionPath": project_path(CONSUMPTION_PATH),
            "consumptionSha256": CONSUMPTION_SHA256,
            "proposalPath": project_path(PROPOSAL_PATH),
            "proposalSha256": PROPOSAL_SHA256,
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": TRAINER_SHA256,
            "checkerPath": project_path(Path(__file__)),
            "checkerSha256": sha256_file(Path(__file__)),
        },
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "measured": {
            "good": scalar_metrics(good_metrics),
            "missing": scalar_metrics(missing_metrics),
            "shiftedRoute": scalar_metrics(shifted_metrics),
            "truncatedRoute": scalar_metrics(truncated_metrics),
        },
        "boundaries": inactive_boundaries(),
    }
    write_json_exclusive(args.report, report)
    if failures:
        terminal = terminal_record("r5_stage4_diagnostic_trainer_support_cpu_regression_failed_closed", [*failures], args, report)
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps(terminal, ensure_ascii=False, indent=2))
        return 1
    contract = support_contract(args.report, report)
    write_json_exclusive(args.contract, contract)
    terminal = terminal_record("r5_stage4_diagnostic_trainer_support_cpu_verified_not_active", [], args, report, contract)
    write_json_exclusive(args.terminal, terminal)
    print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(args.terminal)}, ensure_ascii=False, indent=2))
    return 0


def diagnostic_config() -> dict:
    return {
        "conditionChannelOrder": ["terrain_path_ground", *OBJECT_CHANNELS],
        "training": {
            "semanticRgbConditionChannels": list(OBJECT_CHANNELS),
            "objectSemanticChannelWeights": {"object_footprints": 1.0, "object_tree": 1.0, "object_rock": 1.25, "object_vegetation": 1.0},
            "denoiserLossWeights": {"objectSemanticRgb": 1.0, "pathInteriorRgb": 2.0, "pathForbiddenBoundaryRgb": 2.0},
            "pathBoundaryBandRatio": 0.04,
            "pathActivationMassCalibration": {
                "enabled": True,
                "conditionChannel": "terrain_path_ground",
                "targetSource": "original_owner_approved_rgb_activation_mass_with_original_condition_mask_only",
                "failedPreviewPixelsUsedAsTrainingTargets": False,
                "machineReviewThresholdUsedAsTrainingTarget": False,
                "lossForm": "symmetric_log_activation_mass_ratio_plus_outside_support_leakage",
                "weight": 0.625,
                "supportBandRatio": 0.04,
                "appearanceTemperature": 0.2,
                "activationMargin": 0.0,
                "epsilon": 1e-6,
            },
            "authorizedBoundaryTopology": {
                "enabled": True,
                "conditionChannel": "terrain_path_ground",
                "allowedSidesSource": "original_condition_channel_boundary_contact_only",
                "requiredBoundarySides": ["south"],
                "weight": 0.5,
                "boundaryBandRatio": 0.125,
                "appearanceTemperature": 0.2,
                "activationMargin": 0.0,
            },
            "stage4FailureDiagnostics": {
                "enabled": True,
                "status": "diagnostic_support_candidate_not_active",
                "objectSemanticDiagnostics": {
                    "channels": list(OBJECT_CHANNELS),
                    "measurements": list(OBJECT_MEASUREMENTS),
                    "gradientTarget": "predicted_rgb_only",
                    "changesTrainingWeightsNow": False,
                },
                "routeLateRegressionDiagnostics": {
                    "conditionChannel": "terrain_path_ground",
                    "measurements": list(ROUTE_MEASUREMENTS),
                    "requiredBoundarySidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
                    "preserveExistingPathLossWeights": True,
                    "spatialGridSize": 4,
                },
                "reviewThresholdsModified": False,
                "failedPreviewPixelsUsedAsTrainingTargets": False,
                "executionValuesSelected": False,
                "trainingConfigApplied": False,
                "checkpointFileReadAuthorized": False,
                "gpuUseAuthorized": False,
                "trainingAuthorized": False,
            },
        },
    }


def synthetic_inputs(config: dict) -> tuple[torch.Tensor, torch.Tensor]:
    height = width = 16
    conditions = torch.zeros((1, len(config["conditionChannelOrder"]), height, width), dtype=torch.float32)
    order = config["conditionChannelOrder"]
    conditions[:, order.index("terrain_path_ground"), :, 7:9] = 1.0
    regions = {
        "object_footprints": (slice(2, 5), slice(2, 5), (0.8, 0.5, 0.2)),
        "object_tree": (slice(2, 5), slice(11, 14), (0.1, 0.8, 0.2)),
        "object_rock": (slice(9, 12), slice(2, 5), (0.6, 0.6, 0.7)),
        "object_vegetation": (slice(9, 12), slice(11, 14), (0.2, 0.6, 0.1)),
    }
    target = torch.zeros((1, 3, height, width), dtype=torch.float32)
    target[:, :, :, 7:9] = torch.tensor((0.7, 0.5, 0.3), dtype=torch.float32).view(1, 3, 1, 1)
    for channel, (rows, columns, color) in regions.items():
        conditions[:, order.index(channel), rows, columns] = 1.0
        target[:, :, rows, columns] = torch.tensor(color, dtype=torch.float32).view(1, 3, 1, 1)
    return target, conditions


def shifted_route_prediction(target: torch.Tensor, conditions: torch.Tensor, config: dict) -> torch.Tensor:
    value = target.clone()
    path = conditions[:, config["conditionChannelOrder"].index("terrain_path_ground"):config["conditionChannelOrder"].index("terrain_path_ground") + 1]
    value = value * (1.0 - path)
    value[:, :, :, 8:10] = torch.tensor((0.7, 0.5, 0.3), dtype=value.dtype).view(1, 3, 1, 1)
    return value


def truncated_route_prediction(target: torch.Tensor, conditions: torch.Tensor, config: dict) -> torch.Tensor:
    value = target.clone()
    path = conditions[:, config["conditionChannelOrder"].index("terrain_path_ground"):config["conditionChannelOrder"].index("terrain_path_ground") + 1]
    value = value * (1.0 - path)
    value[:, :, :12, 7:9] = torch.tensor((0.7, 0.5, 0.3), dtype=value.dtype).view(1, 3, 1, 1)
    return value


def all_object_metrics_present(metrics: dict) -> bool:
    suffixes = ("IndependentLoss", "GradientContribution", "DecodedResponsePrototypeMae")
    return all(f"stage4Diagnostic{prefix}{suffix}" in metrics for prefix in object_prefixes() for suffix in suffixes)


def object_prefixes() -> tuple[str, ...]:
    return ("objectFootprints", "objectTree", "objectRock", "objectVegetation")


def legacy_config(config: dict) -> dict:
    value = deepcopy(config)
    del value["training"]["stage4FailureDiagnostics"]
    return value


def expect_contract_rejected(trainer, config: dict, mutate) -> bool:
    value = deepcopy(config)
    mutate(value)
    try:
        trainer.validate_v7_r5_stage4_failure_diagnostic_support_contract(value)
    except ValueError:
        return True
    return False


def expect_metrics_rejected(trainer, config: dict, target: torch.Tensor, conditions: torch.Tensor, mutate) -> bool:
    value = deepcopy(config)
    mutate(value)
    try:
        trainer.stage4_failure_diagnostic_metrics(target.clone().requires_grad_(True), target, conditions, value)
    except ValueError:
        return True
    return False


def scalar_metrics(metrics: dict) -> dict:
    return {key: float(value.detach()) for key, value in metrics.items()}


def validate_authorization() -> None:
    for path, expected, code in (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (CONSUMPTION_PATH, CONSUMPTION_SHA256, "consumption"),
        (PROPOSAL_PATH, PROPOSAL_SHA256, "proposal"),
        (FAILURE_LEARNING_TERMINAL_PATH, FAILURE_LEARNING_TERMINAL_SHA256, "failure_learning_terminal"),
        (TRAINER_PATH, TRAINER_SHA256, "trainer"),
    ):
        if not path.is_file() or sha256_file(path) != expected:
            raise ValueError(f"stage4_diagnostic_support_{code}_missing_or_changed")
    authorization = read_json(AUTHORIZATION_PATH)
    consumption = read_json(CONSUMPTION_PATH)
    proposal = read_json(PROPOSAL_PATH)
    terminal = read_json(FAILURE_LEARNING_TERMINAL_PATH)
    if authorization.get("status") != "resolved_owner_authorized" or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF or authorization.get("ownerDecision", {}).get("scope") != SCOPE:
        raise ValueError("stage4_diagnostic_support_authorization_identity_invalid")
    if consumption.get("status") != "consumed_before_authorized_write" or consumption.get("authorizationSha256") != AUTHORIZATION_SHA256 or consumption.get("commandRef") != COMMAND_REF or consumption.get("scope") != SCOPE or consumption.get("allowedExecutionCount") != 1:
        raise ValueError("stage4_diagnostic_support_consumption_identity_invalid")
    identity = authorization.get("taskIdentity", {})
    if identity.get("failureLearningProposalPath") != project_path(PROPOSAL_PATH) or identity.get("failureLearningProposalSha256") != PROPOSAL_SHA256:
        raise ValueError("stage4_diagnostic_support_proposal_binding_invalid")
    if identity.get("requiredObjectChannels") != OBJECT_CHANNELS or identity.get("requiredObjectMeasurements") != OBJECT_MEASUREMENTS or identity.get("requiredRouteMeasurements") != ROUTE_MEASUREMENTS:
        raise ValueError("stage4_diagnostic_support_measurement_binding_invalid")
    if proposal.get("status") != "owner_review_required_not_applied" or proposal.get("configurationPatchProposal", {}).get("selectedExecutionValues") is not False or proposal.get("applicationGate", {}).get("applyConfigurationNow") is not False:
        raise ValueError("stage4_diagnostic_support_proposal_boundary_invalid")
    if terminal.get("status") != "r5_stage4_six_preview_failures_analyzed_read_only_repair_proposal_cpu_verified":
        raise ValueError("stage4_diagnostic_support_failure_learning_not_closed")
    resolution = authorization.get("resolution", {})
    for key in ("trainerDiagnosticSupportAuthorized", "objectIndependentLossDiagnosticsAuthorized", "objectGradientContributionDiagnosticsAuthorized", "objectDecodedResponseDiagnosticsAuthorized", "routeLateRegressionDiagnosticsAuthorized", "supportContractStorageAuthorized", "cpuPositiveNegativeRegressionAuthorized", "immutableTerminalStorageAuthorized"):
        if resolution.get(key) is not True:
            raise ValueError(f"stage4_diagnostic_support_{key}_missing")
    for key in ("trainingConfigurationApplicationAuthorized", "executionValueSelectionAuthorized", "lossWeightModificationAuthorized", "reviewThresholdChangeAuthorized", "failedPreviewPixelsAsTrainingTargetsAuthorized", "checkpointFileReadAuthorized", "checkpointDeserializationAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuUseAuthorized", "gpuTrainingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointFormalPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        if resolution.get(key) is not False:
            raise ValueError(f"stage4_diagnostic_support_boundary_{key}_invalid")


def support_contract(report_path: Path, report: dict) -> dict:
    return {
        "schemaVersion": "v7-r5-stage4-failure-diagnostic-trainer-support-contract-v1",
        "status": "cpu_verified_diagnostic_support_not_active",
        "generatedBy": "local_ai_stage4_diagnostic_trainer_support_program",
        "authorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": AUTHORIZATION_SHA256},
        "authorizationConsumption": {"path": project_path(CONSUMPTION_PATH), "sha256": CONSUMPTION_SHA256},
        "failureLearningProposal": {"path": project_path(PROPOSAL_PATH), "sha256": PROPOSAL_SHA256},
        "trainer": {"path": project_path(TRAINER_PATH), "sha256": TRAINER_SHA256},
        "cpuRegression": {"path": project_path(report_path), "sha256": sha256_file(report_path)},
        "diagnostics": {
            "objectChannels": OBJECT_CHANNELS,
            "objectMeasurements": OBJECT_MEASUREMENTS,
            "routeMeasurements": ROUTE_MEASUREMENTS,
            "changesTrainingWeightsNow": False,
            "selectedExecutionValues": False,
            "trainingConfigApplied": False,
        },
        "activationGate": {
            "status": "not_active_requires_separate_parameter_selection_and_execution_authorization",
            "checkpointFileRead": False,
            "optimizerCreation": False,
            "gpuUse": False,
            "training": False,
        },
    }


def terminal_record(status: str, blockers: list[str], args, report: dict, contract: dict | None = None) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "v7-r5-stage4-failure-diagnostic-trainer-support-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(args.report),
        "contractPath": project_path(args.contract) if contract is not None else None,
        "contractSha256": sha256_file(args.contract) if contract is not None else None,
        "positiveAssertionsPassed": report["positiveAssertionsPassed"],
        "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        "blockers": blockers,
        "nextIndependentAuthorization": "stage4_bounded_diagnostic_parameter_selection_and_inactive_config_compilation_only" if not blockers else "diagnostic_support_failure_review_only",
        **inactive_boundaries(),
    }


def inactive_boundaries() -> dict:
    return {
        "trainingConfigModified": False,
        "executionValuesSelected": False,
        "lossWeightsModified": False,
        "reviewThresholdsModified": False,
        "checkpointFileRead": False,
        "checkpointDeserialized": False,
        "checkpointLoaded": False,
        "optimizerCreated": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "gpuTrainingStarted": False,
        "fullTrainingStarted": False,
        "strictRevalidationStarted": False,
        "formalInferenceStarted": False,
        "checkpointFormallyPromoted": False,
        "runtimeFrameStarted": False,
        "worldEntryStarted": False,
    }


def load_trainer():
    spec = importlib.util.spec_from_file_location("stage4_diagnostic_trainer", ROOT / TRAINER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("stage4_diagnostic_support_trainer_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_json(path: Path) -> dict:
    return json.loads((path if path.is_absolute() else ROOT / path).read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    resolved = path if path.is_absolute() else ROOT / path
    digest = hashlib.sha256()
    with resolved.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path: Path) -> str:
    resolved = path if path.is_absolute() else ROOT / path
    return resolved.absolute().relative_to(ROOT.absolute()).as_posix()


def write_json_exclusive(path: Path, value: dict) -> None:
    resolved = path if path.is_absolute() else ROOT / path
    resolved.parent.mkdir(parents=True, exist_ok=True)
    with resolved.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

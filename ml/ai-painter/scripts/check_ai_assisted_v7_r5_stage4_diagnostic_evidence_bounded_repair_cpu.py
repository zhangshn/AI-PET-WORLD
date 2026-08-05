from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import torch


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-action-request-v7-r5-stage4-bounded-repair-selection-trainer-support-20260805/request.json"
)
AUTHORIZATION_SHA256 = "fd0dc553b10ad4026d9375de1fb617aaf76c06f4acfcf887d0c57461d141ddf1"
CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "authorization-consumption.json"
CONSUMPTION_SHA256 = "3b846235da3bb739a03cae4ede8a3223c0dfc06a1a775f62a2e9523379bd30d5"
COMMAND_REF = "owner-authorized-v7-r5-stage4-bounded-repair-selection-trainer-support-20260805"
SCOPE = (
    "select_stage4_diagnostic_evidence_bounded_repair_parameters_implement_"
    "trainer_support_compile_inactive_config_and_cpu_regression_only"
)
ANALYSIS_PATH = Path(
    ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-diagnostic-evidence/"
    "local-ai-v7-r5-stage4-diagnostic-evidence-failure-analysis-2026-08-05T13-53-20-943Z/"
    "failure-analysis.json"
)
ANALYSIS_SHA256 = "989cab51d47d3b82e21bee980c5e12914e8ca3033bd3ecf8b24fd72ffc2e5d23"
PROPOSAL_PATH = ANALYSIS_PATH.parent / "read-only-repair-proposal.json"
PROPOSAL_SHA256 = "6ef3f9f709accbbb29b255dbe2e966e4971f0504df299b22779c500274690ca9"
ANALYSIS_REGRESSION_PATH = ANALYSIS_PATH.parent / "cpu-positive-negative-regression.json"
ANALYSIS_REGRESSION_SHA256 = "0348ac6c09ec5ded6509ea100552b950d3ae425b23660b28b705019da02dc626"
ANALYSIS_TERMINAL_PATH = ANALYSIS_PATH.parent / "phase-terminal.json"
ANALYSIS_TERMINAL_SHA256 = "e6812fa4266ff43ef89054f04640ee7c682b16100e65f216738643f8543e8172"
SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/"
    "chains/ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z/active-config.json"
)
SOURCE_CONFIG_SHA256 = "7a5f66356d8b57a5e927487f20c4807b005b99615f9fc0f76e84e593de3e1583"
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
TRAINER_BEFORE_SHA256 = "8a83a5750faaedb0dcc5459693b61933e20be3e5ea144b8ff3a6baa8bd4c3b1d"
TRAINER_SHA256 = "dd465603361f1e53b0304d89b62a111b8d822fbfaac3537509c006a893946dd5"
LEGACY_COMPILER_PATH = Path(
    "ml/ai-painter/scripts/compile_ai_assisted_v7_r5_stage4_failure_diagnostic_inactive_config.py"
)
LEGACY_COMPILER_SHA256 = "03001f7f095c955c80a39392c1098e2060dd6161674b230a8a6d5ef79c757375"
LEGACY_CHECKER_PATH = Path(
    "ml/ai-painter/scripts/check_ai_assisted_v7_r5_stage4_failure_diagnostic_support_cpu.py"
)
LEGACY_CHECKER_SHA256 = "2605a13fb9db7b6c60b0bdc14c5af59dcee0e526fbb7319074bd50a0eaf4382e"
SELECTION_POLICY = (
    "failure_prevalence_linear_mapping_with_bound_diagnostic_direction_"
    "and_no_threshold_reinterpretation"
)
OBJECT_CHANNELS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]


def main() -> int:
    parser = ArgumentParser(description="Compile and CPU-check the inactive Stage 4 bounded repair candidate.")
    parser.add_argument("--inactive-config", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    try:
        torch.set_num_threads(1)
        validate_authorization_and_bindings()
        trainer = load_trainer()
        analysis = read_json(ANALYSIS_PATH)
        proposal = read_json(PROPOSAL_PATH)
        source_config = read_json(SOURCE_CONFIG_PATH)
        selection = select_parameters(analysis, proposal, source_config)
        config = compile_inactive_config(source_config, selection)
        positive, negative, measured = run_regressions(trainer, source_config, config, selection)
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        report = build_report(positive, negative, measured, failures)
        if failures:
            write_json_exclusive(args.report, report)
            write_json_exclusive(args.terminal, terminal_record(
                "r5_stage4_bounded_repair_cpu_regression_failed_closed",
                failures,
                args,
            ))
            return 1

        write_json_exclusive(args.inactive_config, config)
        selection["inactiveConfig"] = {
            "path": project_path(args.inactive_config),
            "sha256": sha256_file(args.inactive_config),
        }
        write_json_exclusive(args.selection, selection)
        report["outputs"] = {
            "inactiveConfig": selection["inactiveConfig"],
            "selection": {"path": project_path(args.selection)},
        }
        write_json_exclusive(args.report, report)
        contract = support_contract(args, report)
        write_json_exclusive(args.contract, contract)
        terminal = terminal_record(
            "r5_stage4_bounded_repair_selected_compiled_cpu_verified_not_active",
            [],
            args,
        )
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(args.terminal),
            "terminalSha256": sha256_file(args.terminal),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not resolved(args.terminal).exists():
            write_json_exclusive(args.terminal, failure_terminal(error))
        raise


def validate_authorization_and_bindings() -> None:
    bindings = (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (CONSUMPTION_PATH, CONSUMPTION_SHA256, "consumption"),
        (ANALYSIS_PATH, ANALYSIS_SHA256, "analysis"),
        (PROPOSAL_PATH, PROPOSAL_SHA256, "proposal"),
        (ANALYSIS_REGRESSION_PATH, ANALYSIS_REGRESSION_SHA256, "analysis_regression"),
        (ANALYSIS_TERMINAL_PATH, ANALYSIS_TERMINAL_SHA256, "analysis_terminal"),
        (SOURCE_CONFIG_PATH, SOURCE_CONFIG_SHA256, "source_config"),
        (TRAINER_PATH, TRAINER_SHA256, "trainer"),
        (LEGACY_COMPILER_PATH, LEGACY_COMPILER_SHA256, "legacy_compiler"),
        (LEGACY_CHECKER_PATH, LEGACY_CHECKER_SHA256, "legacy_checker"),
    )
    for path, expected, code in bindings:
        if not resolved(path).is_file() or sha256_file(path) != expected:
            raise ValueError(f"stage4_bounded_repair_{code}_missing_or_changed")
    authorization = read_json(AUTHORIZATION_PATH)
    consumption = read_json(CONSUMPTION_PATH)
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("stage4_bounded_repair_authorization_identity_invalid")
    if (
        consumption.get("consumptionStatus") != "consumed_once_for_bounded_cpu_only_execution"
        or consumption.get("requestSha256") != AUTHORIZATION_SHA256
        or consumption.get("commandIdentity") != COMMAND_REF
        or consumption.get("authorizedScope") != SCOPE
        or int(consumption.get("allowedExecutionCount", 0)) != 1
        or int(consumption.get("configurationCompilationsAllowed", 0)) != 1
        or int(consumption.get("cpuRegressionExecutionsAllowed", 0)) != 1
        or consumption.get("automaticRetryAllowed") is not False
    ):
        raise ValueError("stage4_bounded_repair_consumption_identity_invalid")
    identity = authorization.get("taskIdentity", {})
    required_identity = {
        "failureAnalysisPath": project_path(ANALYSIS_PATH),
        "failureAnalysisSha256": ANALYSIS_SHA256,
        "repairProposalPath": project_path(PROPOSAL_PATH),
        "repairProposalSha256": PROPOSAL_SHA256,
        "analysisRegressionPath": project_path(ANALYSIS_REGRESSION_PATH),
        "analysisRegressionSha256": ANALYSIS_REGRESSION_SHA256,
        "analysisTerminalPath": project_path(ANALYSIS_TERMINAL_PATH),
        "analysisTerminalSha256": ANALYSIS_TERMINAL_SHA256,
        "sourceStage4ConfigPath": project_path(SOURCE_CONFIG_PATH),
        "sourceStage4ConfigSha256": SOURCE_CONFIG_SHA256,
        "trainerPath": project_path(TRAINER_PATH),
        "trainerBeforeSha256": TRAINER_BEFORE_SHA256,
        "legacyDiagnosticCompilerPath": project_path(LEGACY_COMPILER_PATH),
        "legacyDiagnosticCompilerSha256": LEGACY_COMPILER_SHA256,
        "legacyDiagnosticCpuCheckerPath": project_path(LEGACY_CHECKER_PATH),
        "legacyDiagnosticCpuCheckerSha256": LEGACY_CHECKER_SHA256,
        "requiredSelectionPolicy": SELECTION_POLICY,
    }
    for key, expected in required_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_bounded_repair_identity_{key}_invalid")
    if identity.get("requiredObjectChannels") != OBJECT_CHANNELS:
        raise ValueError("stage4_bounded_repair_object_channels_invalid")
    expected_bounds = {
        "objectRockRelativeMultiplier": {"minimum": 1.0, "maximum": 1.25},
        "pathActivationMassCalibrationWeight": {"minimum": 0.625, "maximum": 0.75},
        "requiredBoundaryContactLossWeight": {"minimum": 0.25, "maximum": 0.75},
    }
    if identity.get("authorizedBounds") != expected_bounds:
        raise ValueError("stage4_bounded_repair_authorized_bounds_invalid")
    resolution = authorization.get("resolution", {})
    for key in (
        "boundedRepairParameterSelectionAuthorized",
        "trainerSupportImplementationAuthorized",
        "requiredBoundaryContactLossSupportAuthorized",
        "existingObjectChannelWeightSupportReuseAuthorized",
        "inactiveConfigurationCompilationAuthorized",
        "selectionContractStorageAuthorized",
        "trainerSupportContractStorageAuthorized",
        "cpuPositiveNegativeRegressionAuthorized",
        "immutableTerminalStorageAuthorized",
        "legacyBehaviorCompatibilityRequired",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"stage4_bounded_repair_{key}_missing")
    for key in (
        "sourceEvidenceModificationAuthorized",
        "sourceTrainingConfigurationModificationAuthorized",
        "candidateConfigurationActivationAuthorized",
        "reviewThresholdChangeAuthorized",
        "failedPreviewPixelsAsTrainingTargetsAuthorized",
        "checkpointFileReadAuthorized",
        "checkpointDeserializationAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "backwardExecutionAuthorized",
        "modelWeightMutationAuthorized",
        "gpuUseAuthorized",
        "trainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
        "automaticRetryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"stage4_bounded_repair_boundary_{key}_invalid")


def select_parameters(analysis: dict, proposal: dict, source_config: dict) -> dict:
    if analysis.get("status") != "stage4_six_preview_failures_and_17_diagnostic_metrics_analyzed_read_only_proposal_ready":
        raise ValueError("stage4_bounded_repair_analysis_status_invalid")
    summary = analysis.get("summary", {})
    if int(summary.get("previewCount", 0)) != 6 or int(summary.get("failedPreviewCount", 0)) != 6:
        raise ValueError("stage4_bounded_repair_requires_six_failed_previews")
    diagnostic = analysis.get("diagnosticInterpretation", {})
    if int(diagnostic.get("metricCount", 0)) != 17:
        raise ValueError("stage4_bounded_repair_requires_17_diagnostic_metrics")
    objects = diagnostic.get("objectMetrics", {})
    if any(objects.get(key) != "rock" for key in (
        "highestIndependentLossChannel",
        "highestGradientContributionChannel",
        "highestDecodedResponsePrototypeMaeChannel",
    )):
        raise ValueError("stage4_bounded_repair_rock_direction_not_supported")
    route = diagnostic.get("routeMetrics", {})
    if route.get("activationDirectionRelativeToTarget") != "above_target" or route.get("requiredBoundaryContactState") != "absent":
        raise ValueError("stage4_bounded_repair_route_direction_not_supported")
    clusters = {row.get("issueCode"): row for row in analysis.get("issueClusters", [])}
    counts = {
        "objectRockRelativeMultiplier": int(clusters.get("condition_object_rock_reference_semantic_mismatch", {}).get("occurrenceCount", 0)),
        "pathActivationMassCalibrationWeight": int(clusters.get("condition_terrain_path_ground_coverage_mismatch", {}).get("occurrenceCount", 0)),
        "requiredBoundaryContactLossWeight": int(clusters.get("condition_terrain_path_ground_required_boundary_contact_missing", {}).get("occurrenceCount", 0)),
    }
    if counts != {
        "objectRockRelativeMultiplier": 6,
        "pathActivationMassCalibrationWeight": 2,
        "requiredBoundaryContactLossWeight": 1,
    }:
        raise ValueError("stage4_bounded_repair_failure_prevalence_invalid")
    candidate = proposal.get("configurationPatchProposal", {}).get("diagnosticEvidenceCandidate", {})
    if (
        proposal.get("status") != "owner_review_required_not_applied"
        or candidate.get("status") != "bounded_candidate_not_selected_not_applied"
        or candidate.get("evidenceScope") != "one_fixed_validation_sample_one_timestep_one_seed"
    ):
        raise ValueError("stage4_bounded_repair_proposal_boundary_invalid")
    ranges = {
        "objectRockRelativeMultiplier": (1.0, 1.25),
        "pathActivationMassCalibrationWeight": (0.625, 0.75),
        "requiredBoundaryContactLossWeight": (0.25, 0.75),
    }
    values = {}
    for name, (minimum, maximum) in ranges.items():
        prevalence = counts[name] / 6.0
        values[name] = {
            "minimum": minimum,
            "maximum": maximum,
            "failureOccurrenceCount": counts[name],
            "sourcePreviewCount": 6,
            "failurePrevalence": prevalence,
            "selectedValue": minimum + prevalence * (maximum - minimum),
        }
    source_weights = source_config.get("training", {}).get("objectSemanticChannelWeights", {})
    if source_weights != {"object_footprints": 1, "object_tree": 1, "object_rock": 1.25, "object_vegetation": 1}:
        raise ValueError("stage4_bounded_repair_source_object_weights_invalid")
    return {
        "schemaVersion": "v7-r5-stage4-diagnostic-evidence-bounded-selection-contract-v1",
        "status": "selected_inactive_not_authorized",
        "selectionPolicy": SELECTION_POLICY,
        "selectedValues": values,
        "interpretation": {
            "objectRock": "six_of_six_failures_map_to_upper_relative_bound_which_equals_the_existing_1_25_channel_multiplier",
            "pathActivationMass": "two_of_six_failures_map_linearly_from_0_625_to_0_75",
            "requiredBoundaryContact": "one_of_six_failures_maps_linearly_from_0_25_to_0_75",
            "spatialAndCentroid": "diagnostic_only_no_weight_or_threshold_selected",
        },
        "evidenceScope": "one_fixed_validation_sample_one_timestep_one_seed_plus_six_preview_failure_prevalence",
        "reviewThresholdPolicy": "preserved_unchanged_not_used_as_training_target",
        "authorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": AUTHORIZATION_SHA256},
        "authorizationConsumption": {"path": project_path(CONSUMPTION_PATH), "sha256": CONSUMPTION_SHA256},
        "analysis": {"path": project_path(ANALYSIS_PATH), "sha256": ANALYSIS_SHA256},
        "proposal": {"path": project_path(PROPOSAL_PATH), "sha256": PROPOSAL_SHA256},
        "sourceConfig": {"path": project_path(SOURCE_CONFIG_PATH), "sha256": SOURCE_CONFIG_SHA256},
        **inactive_boundaries(),
    }


def compile_inactive_config(source_config: dict, selection: dict) -> dict:
    config = deepcopy(source_config)
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage4-diagnostic-evidence-bounded-candidate"
    config["status"] = "r5_stage4_diagnostic_evidence_bounded_repair_candidate_inactive"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["ownerTrainingAuthorization"] = {
        "authorizationId": AUTHORIZATION_PATH.parent.name,
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "authorizationConsumptionPath": project_path(CONSUMPTION_PATH),
        "authorizationConsumptionSha256": CONSUMPTION_SHA256,
        "status": "not_authorized_candidate_only",
        "checkpointFileReadAuthorized": False,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "fullTrainingAuthorized": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    training["stage4FullTrainingContract"]["status"] = "bounded_repair_candidate_inactive"
    selected = selection["selectedValues"]
    training["objectSemanticChannelWeights"] = {
        "object_footprints": 1.0,
        "object_tree": 1.0,
        "object_rock": selected["objectRockRelativeMultiplier"]["selectedValue"],
        "object_vegetation": 1.0,
    }
    training["pathActivationMassCalibration"]["weight"] = selected["pathActivationMassCalibrationWeight"]["selectedValue"]
    topology = training["authorizedBoundaryTopology"]
    training["stage4RequiredBoundaryContact"] = {
        "enabled": True,
        "status": "candidate_support_not_active",
        "conditionChannel": "terrain_path_ground",
        "targetSource": "original_owner_approved_rgb_required_boundary_activation_with_original_condition_mask_only",
        "requiredSidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "lossForm": "required_side_target_activation_deficit",
        "weight": selected["requiredBoundaryContactLossWeight"]["selectedValue"],
        "boundaryBandRatio": float(topology["boundaryBandRatio"]),
        "appearanceTemperature": float(topology["appearanceTemperature"]),
        "activationMargin": float(topology["activationMargin"]),
    }
    training["r5Stage4DiagnosticEvidenceBoundedSelectionEvidence"] = {
        "candidateVersion": "v7_r5_stage4_diagnostic_evidence_bounded_candidate_v1",
        "candidateStatus": "selected_inactive_not_authorized",
        "selectionPolicy": SELECTION_POLICY,
        "selectedValues": deepcopy(selected),
        "evidenceScope": selection["evidenceScope"],
        "analysisPath": project_path(ANALYSIS_PATH),
        "analysisSha256": ANALYSIS_SHA256,
        "proposalPath": project_path(PROPOSAL_PATH),
        "proposalSha256": PROPOSAL_SHA256,
        "sourceConfigPath": project_path(SOURCE_CONFIG_PATH),
        "sourceConfigSha256": SOURCE_CONFIG_SHA256,
        "reviewThresholdPolicy": "preserved_unchanged_not_used_as_training_target",
        "selectedObjectWeightChanges": {"object_rock": "preserved_existing_relative_multiplier_1_25"},
        "spatialOrCentroidWeightChanges": None,
        "hydrologyWeightChanges": None,
        "candidateActive": False,
    }
    return config


def run_regressions(trainer, source_config: dict, config: dict, selection: dict):
    contract = trainer.validate_v7_r5_candidate_contract(config)
    target, missing, conditions = synthetic_contact_inputs(config)
    perfect_loss = trainer.required_boundary_contact_loss(target, target, conditions, config)
    missing_loss = trainer.required_boundary_contact_loss(missing, target, conditions, config)
    legacy_zero = trainer.required_boundary_contact_loss(target, target, conditions, source_config)
    selected = selection["selectedValues"]
    positive = {
        "trainerContractAcceptedInactiveCandidate": contract.get("status") == "r5_candidate_contract_valid_for_stage4_bounded_repair_not_active",
        "rockPrevalenceMappedToUpperBound": close(selected["objectRockRelativeMultiplier"]["selectedValue"], 1.25),
        "rockExistingChannelWeightPreserved": close(config["training"]["objectSemanticChannelWeights"]["object_rock"], 1.25),
        "otherObjectWeightsPreserved": all(close(config["training"]["objectSemanticChannelWeights"][name], 1.0) for name in ("object_footprints", "object_tree", "object_vegetation")),
        "pathActivationPrevalenceMapped": close(selected["pathActivationMassCalibrationWeight"]["selectedValue"], 2.0 / 3.0),
        "requiredContactPrevalenceMapped": close(selected["requiredBoundaryContactLossWeight"]["selectedValue"], 1.0 / 3.0),
        "perfectRequiredContactHasZeroLoss": close(float(perfect_loss.detach()), 0.0),
        "missingRequiredContactHasPositiveLoss": float(missing_loss.detach()) > 0.0,
        "legacyConfigWithoutNewLossReturnsZero": close(float(legacy_zero.detach()), 0.0),
        "candidateRemainsInactive": config.get("status", "").endswith("_inactive") and config["training"]["trainingAuthorizationStatus"] == "not_authorized_candidate_only",
        "formalStageEpochsRemainForty": [row["epochs"] for row in config["training"]["stage4FullTrainingContract"]["stages"]] == [40, 40, 40],
        "dataSplitPreserved": config["training"]["stage4FullTrainingContract"]["splitCounts"] == {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "reviewThresholdsNotReinterpreted": selection["reviewThresholdPolicy"] == "preserved_unchanged_not_used_as_training_target",
        "sourceConfigHashPreserved": sha256_file(SOURCE_CONFIG_PATH) == SOURCE_CONFIG_SHA256,
        "legacyFilesPreserved": sha256_file(LEGACY_COMPILER_PATH) == LEGACY_COMPILER_SHA256 and sha256_file(LEGACY_CHECKER_PATH) == LEGACY_CHECKER_SHA256,
    }
    negative_mutations = {
        "rockSelectionAboveBoundRejected": lambda value: value["training"]["r5Stage4DiagnosticEvidenceBoundedSelectionEvidence"]["selectedValues"]["objectRockRelativeMultiplier"].update(selectedValue=1.251),
        "pathActivationSelectionBelowBoundRejected": lambda value: value["training"]["r5Stage4DiagnosticEvidenceBoundedSelectionEvidence"]["selectedValues"]["pathActivationMassCalibrationWeight"].update(selectedValue=0.624),
        "requiredContactSelectionAboveBoundRejected": lambda value: value["training"]["r5Stage4DiagnosticEvidenceBoundedSelectionEvidence"]["selectedValues"]["requiredBoundaryContactLossWeight"].update(selectedValue=0.751),
        "rockWeightMutationRejected": lambda value: value["training"]["objectSemanticChannelWeights"].update(object_rock=1.5),
        "pathActivationWeightMismatchRejected": lambda value: value["training"]["pathActivationMassCalibration"].update(weight=0.7),
        "requiredContactWeightMismatchRejected": lambda value: value["training"]["stage4RequiredBoundaryContact"].update(weight=0.5),
        "failedPreviewTargetRejected": lambda value: value["training"]["stage4RequiredBoundaryContact"].update(failedPreviewPixelsUsedAsTrainingTargets=True),
        "reviewThresholdTargetRejected": lambda value: value["training"]["stage4RequiredBoundaryContact"].update(machineReviewThresholdUsedAsTrainingTarget=True),
        "wrongTargetSourceRejected": lambda value: value["training"]["stage4RequiredBoundaryContact"].update(targetSource="failed_preview_pixels"),
        "wrongRequiredSideSourceRejected": lambda value: value["training"]["stage4RequiredBoundaryContact"].update(requiredSidesSource="machine_review"),
        "candidateActivationRejected": lambda value: value["training"]["r5Stage4DiagnosticEvidenceBoundedSelectionEvidence"].update(candidateActive=True),
        "checkpointAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(checkpointLoadingAuthorized=True),
        "optimizerAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True),
        "gpuAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True),
        "trainingAuthorizationRejected": lambda value: value["training"]["ownerTrainingAuthorization"].update(fullTrainingAuthorized=True),
    }
    negative = {
        name: expect_contract_rejected(trainer, config, mutate)
        for name, mutate in negative_mutations.items()
    }
    return positive, negative, {
        "perfectRequiredBoundaryContactLoss": float(perfect_loss.detach()),
        "missingRequiredBoundaryContactLoss": float(missing_loss.detach()),
        "legacyRequiredBoundaryContactLoss": float(legacy_zero.detach()),
    }


def synthetic_contact_inputs(config: dict):
    height = width = 16
    conditions = torch.zeros((1, len(config["conditionChannelOrder"]), height, width), dtype=torch.float32, device="cpu")
    index = config["conditionChannelOrder"].index("terrain_path_ground")
    conditions[:, index, :, 7:9] = 1.0
    target = torch.zeros((1, 3, height, width), dtype=torch.float32, device="cpu")
    path_color = torch.tensor((0.7, 0.5, 0.3), dtype=torch.float32, device="cpu").view(1, 3, 1, 1)
    target[:, :, :, 7:9] = path_color
    missing = target.clone()
    missing[:, :, -2:, 7:9] = 0.0
    return target, missing, conditions


def expect_contract_rejected(trainer, config: dict, mutate) -> bool:
    value = deepcopy(config)
    mutate(value)
    try:
        trainer.validate_v7_r5_candidate_contract(value)
    except ValueError:
        return True
    return False


def build_report(positive, negative, measured, failures):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-regression-v1",
        "status": "passed_cpu_only_bounded_repair_not_active" if not failures else "failed_cpu_only_bounded_repair_closed",
        "generatedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "generatedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "device": "cpu",
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "measured": measured,
        "inputs": {
            "authorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": AUTHORIZATION_SHA256},
            "consumption": {"path": project_path(CONSUMPTION_PATH), "sha256": CONSUMPTION_SHA256},
            "analysis": {"path": project_path(ANALYSIS_PATH), "sha256": ANALYSIS_SHA256},
            "proposal": {"path": project_path(PROPOSAL_PATH), "sha256": PROPOSAL_SHA256},
            "sourceConfig": {"path": project_path(SOURCE_CONFIG_PATH), "sha256": SOURCE_CONFIG_SHA256},
            "trainer": {"path": project_path(TRAINER_PATH), "sha256": TRAINER_SHA256},
            "checker": {"path": project_path(Path(__file__)), "sha256": sha256_file(Path(__file__))},
        },
        **inactive_boundaries(),
    }


def support_contract(args, report):
    return {
        "schemaVersion": "v7-r5-stage4-diagnostic-evidence-bounded-repair-trainer-support-contract-v1",
        "status": "cpu_verified_bounded_repair_support_not_active",
        "trainer": {"path": project_path(TRAINER_PATH), "sha256": TRAINER_SHA256},
        "selection": {"path": project_path(args.selection), "sha256": sha256_file(args.selection)},
        "inactiveConfig": {"path": project_path(args.inactive_config), "sha256": sha256_file(args.inactive_config)},
        "cpuRegression": {"path": project_path(args.report), "sha256": sha256_file(args.report)},
        "supportedCapabilities": {
            "existingObjectSemanticChannelWeights": True,
            "requiredBoundaryContactLoss": True,
            "pathActivationMassCalibrationWeight": True,
            "legacyConfigurationWithoutRequiredBoundaryContact": True,
        },
        "positiveAssertionsPassed": report["positiveAssertionsPassed"],
        "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        **inactive_boundaries(),
    }


def terminal_record(status, blockers, args):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "v7-r5-stage4-diagnostic-evidence-bounded-repair-terminal-v1",
        "status": status,
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "selectionPath": project_path(args.selection),
        "selectionSha256": sha256_file(args.selection),
        "inactiveConfigPath": project_path(args.inactive_config),
        "inactiveConfigSha256": sha256_file(args.inactive_config),
        "cpuRegressionPath": project_path(args.report),
        "cpuRegressionSha256": sha256_file(args.report),
        "trainerSupportContractPath": project_path(args.contract),
        "trainerSupportContractSha256": sha256_file(args.contract),
        "blockers": blockers,
        "nextIndependentAuthorization": "stage4_bounded_repair_gpu_smoke_only",
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def failure_terminal(error):
    now = datetime.now(timezone.utc)
    return {
        "schemaVersion": "v7-r5-stage4-diagnostic-evidence-bounded-repair-terminal-v1",
        "status": "r5_stage4_bounded_repair_execution_failed_closed",
        "recordedAtUtc": now.isoformat().replace("+00:00", "Z"),
        "recordedAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "blockers": [f"{type(error).__name__}: {error}"],
        "automaticRetry": False,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def inactive_boundaries():
    return {
        "candidateActive": False,
        "sourceTrainingConfigModified": False,
        "reviewThresholdsModified": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "checkpointFileRead": False,
        "checkpointDeserialized": False,
        "checkpointLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "gpuUsed": False,
        "trainingStarted": False,
        "strictRevalidationStarted": False,
        "formalInferenceStarted": False,
        "checkpointPromoted": False,
        "runtimeFrameStarted": False,
        "worldEntryStarted": False,
    }


def load_trainer():
    spec = importlib.util.spec_from_file_location("stage4_bounded_repair_trainer", resolved(TRAINER_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("stage4_bounded_repair_trainer_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def close(actual, expected):
    return math.isclose(float(actual), float(expected), rel_tol=0.0, abs_tol=1e-12)


def resolved(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def read_json(path: Path) -> dict:
    return json.loads(resolved(path).read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with resolved(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path: Path) -> str:
    return resolved(path).absolute().relative_to(ROOT.absolute()).as_posix()


def write_json_exclusive(path: Path, value: dict) -> None:
    output = resolved(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

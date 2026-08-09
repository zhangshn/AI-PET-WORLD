from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import torch


ROOT = Path(__file__).resolve().parents[3]
PROJECT_RUNTIME_LOGICAL_ENTRY = ".runtime"
REGISTERED_HOT_RUNTIME_ROOT = "D:/AI-PET-WORLD-DATA/hot/runtime"
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
CROSS_DOMAIN_IMPLEMENTATION_CONSUMPTION_NAME = "implementation-authorization-consumption.json"
CROSS_DOMAIN_COMMAND_REF = "owner-authorized-v7-r5-stage4-cross-domain-visual-consistency-candidate-and-one-gpu-smoke-20260808-154822808"
CROSS_DOMAIN_SCOPE = "bind_successful_stage4_timeline_analysis_freeze_analyzer_and_review_thresholds_implement_one_cross_domain_visual_consistency_candidate_compile_inactive_config_run_full_cpu_positive_negative_gate_then_if_passed_consume_one_single_sample_30_epoch_gpu_smoke"
CROSS_DOMAIN_SUPPLEMENTAL_SCOPE = "allow_only_current_stage4_smoke_runner_trainer_sha_binding_to_read_and_verify_task_identity_trainer_sha256_preserve_legacy_stage3_and_stage4_behavior"
CROSS_DOMAIN_IMPLEMENTATION_CONSUMPTION_SHA256 = "b64a7a26f5e06c31eef58ae653cb75a224c800eb17ff8f5b0e8a42c6f7c132d8"
STRUCTURED_PARENT_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/owner-authorized-r5-stage4-structured-stability-candidate-cpu-20260808-input.json"
)
STRUCTURED_PARENT_AUTHORIZATION_SHA256 = "6cbe44795986a0e104053f70633837ec5718387928edf6d3f16fead8459486ec"
STRUCTURED_PARENT_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-r5-stage4-structured-stability-candidate-cpu-20260808/"
    "implementation-authorization-consumption.json"
)
STRUCTURED_PARENT_CONSUMPTION_SHA256 = "278a3404f042ed4abbcd2ee6e42da1d6036368803647c0450247e7c9f1db0637"
STRUCTURED_COMMAND_REF = "owner-authorized-r5-stage4-structured-stability-candidate-cpu-20260808"
STRUCTURED_SCOPE = (
    "build_one_inactive_stage4_structured_route_rock_trajectory_stability_candidate_"
    "and_late_stability_qualification_cpu_only"
)
STRUCTURED_ROOT_CAUSES = [
    "route_topology_training_trajectory_instability",
    "terminal_pass_without_stability_window",
    "uneven_object_semantic_learning_rate",
]
STRUCTURED_ANALYSIS_TERMINAL_SHA256 = "86a9a278457462c9ea5979b70776ad1655734352e6fe0d69583a47ad208f7b76"
STRUCTURED_DECISION_SHA256 = "aa6127b0c0fb1420730c053ef8f3cd655fbb453d085bebb0cc6a3fd73e242976"
STRUCTURED_PROPOSAL_SHA256 = "efbd4a4f33805e7fa163dcd9e27763c36439627a5f6cdd8f1c89984b6849a123"
STRUCTURED_ANALYSIS_CPU_SHA256 = "cc50d31b68505af945ef5c2c959d9f99d8e4278d319b43f8b01ef6888de226f5"
STRUCTURED_FAILURE_ANALYSIS_SHA256 = "7114684ae7061b9ed86ae67c087338956d77a8373e8990532558b3bfaa11cb97"
DECODED_ALIGNMENT_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-r5-stage4-decoded-domain-alignment-cpu-support-20260808-204122373-input.json"
)
DECODED_ALIGNMENT_AUTHORIZATION_SHA256 = "0fed5e61b65c4e24cb53dfb74674ece6d7f3c644a1475d56fc00ecbda63be9d4"
DECODED_ALIGNMENT_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-r5-stage4-decoded-domain-alignment-cpu-support-20260808-204122373/"
    "implementation-authorization-consumption.json"
)
DECODED_ALIGNMENT_CONSUMPTION_SHA256 = "dabbfd467463e9433341995a7cd547574f91742abfa2c7bb254a7aa6f18e2b95"
DECODED_ALIGNMENT_COMMAND_REF = (
    "owner-authorized-r5-stage4-decoded-domain-alignment-cpu-support-20260808-204122373"
)
DECODED_ALIGNMENT_SCOPE = (
    "implement_stage4_decoded_domain_alignment_bridge_v1_cpu_support_"
    "compile_inactive_config_and_regress_only"
)
DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-r5-stage4-v7-stage-boundary-v8-cpu-regression-20260808-210526578-input.json"
)
DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_SHA256 = "6ede8832921b2aec921cf96fc4a1e42702b58743ad71f7ab8d4e2a5532a39ee6"
DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-r5-stage4-v7-stage-boundary-v8-cpu-regression-20260808-210526578/"
    "implementation-authorization-consumption.json"
)
DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_SHA256 = "bf6b96a90e9bbaa5b047f90377db75944d39b5bf6b59c52eb0126ec6c0fc8cf0"
DECODED_ALIGNMENT_REGRESSION_COMMAND_REF = (
    "owner-authorized-r5-stage4-v7-stage-boundary-v8-cpu-regression-20260808-210526578"
)
DECODED_ALIGNMENT_REGRESSION_SCOPE = (
    "separate_v7_stage3_30_epoch_and_stage4_inactive_40_epoch_contracts_"
    "then_run_one_complete_v8_cpu_regression"
)
DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_PATH = Path(
    ".runtime/ai-painter/v8-r5-stage4-decoded-domain-alignment-cpu-support/"
    "20260808-211000000/phase-terminal.json"
)
DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_SHA256 = "2f931b9e398338210ab39d3e93a13d58aace5e1800983c7e828b0a8f069bfcf0"
DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_PATH = DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_PATH.parent / "cpu-regression-report.json"
DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_SHA256 = "bfaf2e077da9df251358d95ae75ccdb0b5b740ce6deffb4632ba63f2d66e2fd5"
DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH = Path(
    ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-architecture-design-convergence/"
    "local-ai-v7-r5-stage4-architecture-design-convergence-20260808-202232050/phase-terminal.json"
)
DECODED_ALIGNMENT_DESIGN_TERMINAL_SHA256 = "8f5a6f2a59ade9ee5fed8c7e8cd42944ff4188630e2f5f80bf176536c06c1608"
DECODED_ALIGNMENT_DESIGN_REPORT_PATH = DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH.parent / "architecture-design-report.json"
DECODED_ALIGNMENT_DESIGN_REPORT_SHA256 = "2b6b4702987f14fb9de1c7ba3e15f090519b230b1d7df00920ffcfa54b302613"
DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_PATH = (
    DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH.parent / "inactive-architecture-implementation-contract.json"
)
DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_SHA256 = "da53f0005c99c64d525ec25d784b52304d76775a405847a02a71800c1212438e"
DECODED_ALIGNMENT_SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/configs/"
    "ai-assisted-v7-r5-stage4-coverage-convergence-full-training-config-20260805-182000000.json"
)
DECODED_ALIGNMENT_SOURCE_CONFIG_SHA256 = "c7a893604b55e3e1cb49ed288d7f723212034b13aed3456bf5822eaa175cb352"
MODEL_PATH = Path("ml/ai-painter/src/ai_painter/complete_world/model.py")
MODEL_BEFORE_SHA256 = "f086820205665896c4930b7ca3924b6bf6edb87fac31924cc3ab68c32d2337ac"
DECODED_ALIGNMENT_TRAINER_BEFORE_SHA256 = "cadd21b944da0a430b0643c0c7015926b5eea38aa3f56609953a73399fea986f"
DECODED_ALIGNMENT_CHECKER_BEFORE_SHA256 = "ddec91bb92f745242473d9b085909efe5cca95bea011f27070257356ecf7486f"
DECODED_ALIGNMENT_READOUT_CHANNELS = [
    "terrain_path_ground",
    "route_required_boundary",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
]
DECODED_ALIGNMENT_ALLOWED_SUPERVISION = [
    "original_owner_approved_reference_rgb",
    "original_compiled_23_channel_condition_pack",
    "approved_world_facts_region_graph_and_edge_ports",
    "project_generated_game_coordinate_route_geometry",
    "original_object_identity_and_semantic_masks",
    "current_training_prediction_and_frozen_project_autoencoder_decode",
]


def main() -> int:
    parser = ArgumentParser(description="Compile and CPU-check the inactive Stage 4 bounded repair candidate.")
    parser.add_argument("--cross-domain-authorization", type=Path)
    parser.add_argument("--structured-stability-authorization", type=Path)
    parser.add_argument("--decoded-domain-alignment-authorization", type=Path)
    parser.add_argument("--inactive-config", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    selected_modes = sum(value is not None for value in (
        args.cross_domain_authorization,
        args.structured_stability_authorization,
        args.decoded_domain_alignment_authorization,
    ))
    if selected_modes > 1:
        raise ValueError("only_one_stage4_candidate_mode_may_be_selected")
    if args.decoded_domain_alignment_authorization is not None:
        return run_decoded_domain_alignment_cpu_support(args)
    if args.structured_stability_authorization is not None:
        return run_structured_stability_candidate(args)
    if args.cross_domain_authorization is not None:
        return run_cross_domain_candidate(args)
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


def compile_sample_bound_stage4_inactive_smoke_config(
    source_config: dict,
    *,
    authorization_binding: dict,
    sample_identity: dict,
    checkpoint_identity: dict,
    topology_evidence: dict,
) -> dict:
    """Derive an inactive Stage4 Smoke config without opening any execution boundary."""
    if authorization_binding.get("projectRuntimeLogicalEntry") != PROJECT_RUNTIME_LOGICAL_ENTRY:
        raise ValueError("sample-bound Stage4 logical runtime identity is invalid")
    if authorization_binding.get("registeredHotRuntimeRoot") != REGISTERED_HOT_RUNTIME_ROOT:
        raise ValueError("sample-bound Stage4 registered hot runtime identity is invalid")
    for path_key, sha_key in (
        ("storageAuthorityPath", "storageAuthoritySha256"),
        ("architectureAuthorityPath", "architectureAuthoritySha256"),
        ("previousCpuFailureTerminalPath", "previousCpuFailureTerminalSha256"),
    ):
        if not isinstance(authorization_binding.get(path_key), str) or not isinstance(
            authorization_binding.get(sha_key), str
        ):
            raise ValueError(f"sample-bound Stage4 storage binding is missing: {path_key}")
    config = deepcopy(source_config)
    config["architectureVersion"] = (
        "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-"
        "stage4-diagnostic-evidence-bounded-sample-bound-inactive-smoke"
    )
    config["status"] = "r5_stage4_sample_bound_inactive_smoke_config_cpu_verified_not_authorized"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training["seed"] = int(sample_identity["seed"])
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["authorizedOverfitSampleId"] = sample_identity["sampleId"]
    training["authorizedOverfitConditionLabel"] = sample_identity["conditionLabel"]
    training["authorizedOverfitSampleSplit"] = sample_identity["sampleSplit"]
    training["authorizedInitialization"] = (
        "project_stage4_failed_stage0_checkpoint_continuation_nonformal_smoke"
    )
    training["fixedEpochPreviewPolicy"]["smoke"] = list(sample_identity["requiredPreviewEpochs"])
    training["stage4FullTrainingContract"]["status"] = "bounded_repair_smoke_inactive"

    topology = training["authorizedBoundaryTopology"]
    topology["requiredBoundarySides"] = list(sample_identity["requiredBoundarySides"])
    training["stage4RequiredBoundaryContact"]["status"] = "candidate_support_not_active"
    training["r5Stage4BoundedRepairCheckpointContinuation"] = {
        "sourceManifestPath": checkpoint_identity["stage0ManifestPath"],
        "sourceManifestSha256": checkpoint_identity["stage0ManifestSha256"],
        "sourceCheckpointPath": checkpoint_identity["stage0CheckpointPath"],
        "sourceCheckpointSha256": checkpoint_identity["stage0CheckpointSha256"],
        "sourceArchitectureVersion": (
            "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-"
            "stage4-coverage-convergence-full-training"
        ),
        "loadingAuthorizedNow": False,
        "stage1OrStage2InitializationAuthorized": False,
    }
    training["r5Stage4BoundedRepairSmokeContract"] = {
        "status": "inactive_cpu_verified_not_authorized",
        "stageIndex": 0,
        "resolution": deepcopy(training["resolutionStages"][0]),
        "epochCount": int(sample_identity["epochCount"]),
        "evaluationInterval": int(sample_identity["evaluationInterval"]),
        "requiredPreviewEpochs": list(sample_identity["requiredPreviewEpochs"]),
        "requiredDiagnosticMetricCount": int(sample_identity["requiredDiagnosticMetricCount"]),
        "sampleId": sample_identity["sampleId"],
        "conditionLabel": sample_identity["conditionLabel"],
        "sampleSplit": sample_identity["sampleSplit"],
        "nonFormalValidationSampleOverfit": True,
        "checkpointPromotionEligible": False,
        "automaticRetryAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
        "imagePath": sample_identity["imagePath"],
        "conditionPackPath": sample_identity["conditionPackPath"],
    }
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "diagnostic_support_candidate_not_active",
        "objectSemanticDiagnostics": {
            "channels": list(OBJECT_CHANNELS),
            "measurements": ["independent_loss", "gradient_contribution", "decoded_response"],
            "gradientTarget": "predicted_rgb_only",
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "conditionChannel": "terrain_path_ground",
            "measurements": ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"],
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
    }
    training["r5Stage4SampleBoundTopologyEvidence"] = {
        "status": "cpu_verified_current_sample_topology_not_active",
        "sampleId": sample_identity["sampleId"],
        "authoritativeRequiredBoundarySides": list(sample_identity["requiredBoundarySides"]),
        "authority": "current_execution_sample_world_facts_connectivity_and_project_route_geometry",
        "conditionMaskRole": "per_resolution_consistency_validation_only",
        "checkedResolutions": deepcopy(training["resolutionStages"]),
        "boundaryAnalysisPath": topology_evidence["boundaryAnalysisPath"],
        "boundaryAnalysisSha256": topology_evidence["boundaryAnalysisSha256"],
        "supportContractPath": topology_evidence["supportContractPath"],
        "supportContractSha256": topology_evidence["supportContractSha256"],
        "crossSampleTopologyReuseAuthorized": False,
    }
    training["r5Stage4RegisteredRuntimeStorageIdentity"] = {
        "status": "bound_for_cpu_verification_not_active",
        "projectRuntimeLogicalEntry": authorization_binding["projectRuntimeLogicalEntry"],
        "registeredHotRuntimeRoot": authorization_binding["registeredHotRuntimeRoot"],
        "storageAuthorityPath": authorization_binding["storageAuthorityPath"],
        "storageAuthoritySha256": authorization_binding["storageAuthoritySha256"],
        "architectureAuthorityPath": authorization_binding["architectureAuthorityPath"],
        "architectureAuthoritySha256": authorization_binding["architectureAuthoritySha256"],
        "previousCpuFailureTerminalPath": authorization_binding[
            "previousCpuFailureTerminalPath"
        ],
        "previousCpuFailureTerminalSha256": authorization_binding[
            "previousCpuFailureTerminalSha256"
        ],
        "arbitraryExternalPathAuthorized": False,
        "absolutePathAuthorized": False,
        "parentTraversalAuthorized": False,
    }
    training["ownerTrainingAuthorization"] = {
        **deepcopy(authorization_binding),
        "status": "not_authorized_candidate_only",
        "executionConsumptionPath": None,
        "executionConsumptionSha256": None,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
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


def load_decoded_alignment_model_builder():
    source_root = str(resolved(Path("ml/ai-painter/src")))
    if source_root not in sys.path:
        sys.path.insert(0, source_root)
    spec = importlib.util.spec_from_file_location("stage4_decoded_alignment_model", resolved(MODEL_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("stage4_decoded_alignment_model_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.build_complete_world_system


def run_decoded_domain_alignment_cpu_support(args) -> int:
    torch.set_num_threads(1)
    authorization_path = args.decoded_domain_alignment_authorization
    try:
        authorization, consumption_path = validate_decoded_alignment_authorization(authorization_path, args)
        trainer = load_trainer()
        build_system = load_decoded_alignment_model_builder()
        source_config = read_json(DECODED_ALIGNMENT_SOURCE_CONFIG_PATH)
        config = compile_decoded_alignment_inactive_config(
            source_config,
            authorization_path,
            consumption_path,
        )
        positive, negative, measured, audit = run_decoded_alignment_regressions(
            trainer,
            build_system,
            source_config,
            config,
        )
        failed_positive = [name for name, passed in positive.items() if not passed]
        failed_negative = [name for name, passed in negative.items() if not passed]
        failures = failed_positive + failed_negative
        report = decoded_alignment_report(
            authorization_path,
            consumption_path,
            positive,
            negative,
            measured,
            audit,
            failed_positive,
            failed_negative,
        )
        if failures:
            write_json_exclusive(args.report, report)
            write_json_exclusive(args.terminal, decoded_alignment_terminal(
                "r5_stage4_decoded_domain_alignment_cpu_regression_failed_closed",
                args,
                failures,
            ))
            return 1

        write_json_exclusive(args.inactive_config, config)
        if sha256_file(args.inactive_config) == DECODED_ALIGNMENT_SOURCE_CONFIG_SHA256:
            raise ValueError("stage4_decoded_alignment_config_must_differ_from_v7_source")
        report["outputs"] = {
            "inactiveConfig": {
                "path": project_path(args.inactive_config),
                "sha256": sha256_file(args.inactive_config),
            },
        }
        write_json_exclusive(args.report, report)
        support = decoded_alignment_support_contract(args, report)
        write_json_exclusive(args.contract, support)
        owner_request = decoded_alignment_owner_action_request(args)
        write_json_exclusive(args.selection, owner_request)
        terminal = decoded_alignment_terminal(
            "r5_stage4_decoded_domain_alignment_cpu_support_completed_closed_not_active",
            args,
            [],
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
            write_json_exclusive(args.terminal, {
                "schemaVersion": "v8-r5-stage4-decoded-domain-alignment-cpu-support-terminal-v1",
                "status": "r5_stage4_decoded_domain_alignment_cpu_support_execution_failed_closed",
                "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
                "error": {"type": type(error).__name__, "message": str(error)},
                "failedClosed": True,
                "automaticRetry": False,
                "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                **inactive_boundaries(),
            })
        raise


def validate_decoded_alignment_authorization(authorization_path: Path, args):
    bindings = (
        (authorization_path, DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_SHA256, "regression_authorization"),
        (
            DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_PATH,
            DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_SHA256,
            "regression_consumption",
        ),
        (DECODED_ALIGNMENT_AUTHORIZATION_PATH, DECODED_ALIGNMENT_AUTHORIZATION_SHA256, "implementation_authorization"),
        (DECODED_ALIGNMENT_CONSUMPTION_PATH, DECODED_ALIGNMENT_CONSUMPTION_SHA256, "implementation_consumption"),
        (
            DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_PATH,
            DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_SHA256,
            "previous_failure_terminal",
        ),
        (
            DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_PATH,
            DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_SHA256,
            "previous_cpu_report",
        ),
        (DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH, DECODED_ALIGNMENT_DESIGN_TERMINAL_SHA256, "design_terminal"),
        (DECODED_ALIGNMENT_DESIGN_REPORT_PATH, DECODED_ALIGNMENT_DESIGN_REPORT_SHA256, "design_report"),
        (
            DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_PATH,
            DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_SHA256,
            "implementation_contract",
        ),
        (DECODED_ALIGNMENT_SOURCE_CONFIG_PATH, DECODED_ALIGNMENT_SOURCE_CONFIG_SHA256, "source_config"),
    )
    if project_path(authorization_path) != project_path(DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_PATH):
        raise ValueError("stage4_decoded_alignment_authorization_path_identity_invalid")
    for path, expected_sha, code in bindings:
        if not resolved(path).is_file() or sha256_file(path) != expected_sha:
            raise ValueError(f"stage4_decoded_alignment_{code}_missing_or_changed")
    outputs = [args.inactive_config, args.selection, args.report, args.contract, args.terminal]
    if len({str(resolved(path)).casefold() for path in outputs}) != len(outputs):
        raise ValueError("stage4_decoded_alignment_output_paths_must_be_distinct")
    if any(resolved(path).exists() for path in outputs):
        raise ValueError("stage4_decoded_alignment_output_already_exists")
    for path in outputs:
        try:
            resolved(path).relative_to(ROOT)
        except ValueError as error:
            raise ValueError("stage4_decoded_alignment_output_must_remain_in_project") from error

    authorization = read_json(authorization_path)
    consumption = read_json(DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_PATH)
    if (
        authorization.get("schemaVersion")
        != "owner-authorized-r5-stage4-v7-stage-boundary-v8-cpu-regression-input-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("commandRef") != DECODED_ALIGNMENT_REGRESSION_COMMAND_REF
        or authorization.get("scope") != DECODED_ALIGNMENT_REGRESSION_SCOPE
    ):
        raise ValueError("stage4_decoded_alignment_authorization_identity_invalid")
    if (
        consumption.get("status") != "consumed_once_for_v7_stage_boundary_fix_and_one_v8_cpu_regression"
        or consumption.get("commandRef") != DECODED_ALIGNMENT_REGRESSION_COMMAND_REF
        or consumption.get("scope") != DECODED_ALIGNMENT_REGRESSION_SCOPE
        or consumption.get("authorizationSha256") != DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_SHA256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("stage4_decoded_alignment_consumption_identity_invalid")

    identity = authorization.get("implementationIdentity", {})
    expected_identity = {
        "frozenModelPath": project_path(MODEL_PATH),
        "frozenModelSha256": "954d2b42cb9f8216f74ccd5753de017ea8539aea0f58d94e954374ded4029577",
        "trainerPath": project_path(TRAINER_PATH),
        "trainerBeforeSha256": "cf5678e75f89e4f21970c2b79d6cd60b3a00a730620427cfd575d6499b026275",
        "cpuCheckerPath": project_path(Path(__file__)),
        "cpuCheckerBeforeSha256": "b87c73237ff8f934a2b11451198c910294f4fccc46c05140ca4138b8a19aefe4",
        "boundLegacyStage4InactiveConfigPath": project_path(DECODED_ALIGNMENT_SOURCE_CONFIG_PATH),
        "boundLegacyStage4InactiveConfigSha256": DECODED_ALIGNMENT_SOURCE_CONFIG_SHA256,
        "previousV8CpuSupportAuthorizationPath": project_path(DECODED_ALIGNMENT_AUTHORIZATION_PATH),
        "previousV8CpuSupportAuthorizationSha256": DECODED_ALIGNMENT_AUTHORIZATION_SHA256,
        "previousV8CpuSupportConsumptionPath": project_path(DECODED_ALIGNMENT_CONSUMPTION_PATH),
        "previousV8CpuSupportConsumptionSha256": DECODED_ALIGNMENT_CONSUMPTION_SHA256,
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_decoded_alignment_identity_{key}_invalid")
    previous_failure = authorization.get("boundPreviousFailureTerminal", {})
    previous_report = authorization.get("boundPreviousCpuReport", {})
    if (
        previous_failure.get("path") != project_path(DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_PATH)
        or previous_failure.get("sha256") != DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_SHA256
        or previous_report.get("path") != project_path(DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_PATH)
        or previous_report.get("sha256") != DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_SHA256
        or previous_report.get("onlyFailedPositiveKey") != "legacy_v7_stage4_contract_still_accepted"
    ):
        raise ValueError("stage4_decoded_alignment_previous_failure_binding_invalid")
    previous_terminal_record = read_json(DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_PATH)
    previous_report_record = read_json(DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_PATH)
    if (
        previous_terminal_record.get("status") != "r5_stage4_decoded_domain_alignment_cpu_regression_failed_closed"
        or previous_report_record.get("failedPositiveKeys") != ["legacy_v7_stage4_contract_still_accepted"]
        or previous_report_record.get("failedNegativeKeys") != []
    ):
        raise ValueError("stage4_decoded_alignment_previous_failure_content_invalid")
    separation = authorization.get("requiredContractSeparation", {})
    expected_stages = [
        {"index": 0, "width": 256, "height": 192, "epochs": 40, "initialization": "deterministic_project_random"},
        {"index": 1, "width": 512, "height": 384, "epochs": 40, "initialization": "current_run_stage_0_checkpoint_only"},
        {"index": 2, "width": 1024, "height": 768, "epochs": 40, "initialization": "current_run_stage_1_checkpoint_only"},
    ]
    if (
        separation.get("stage3SmokeContinuationEpochs") != 30
        or separation.get("stage4FormalEpochsPerStage") != 40
        or separation.get("stage4ResolutionStages") != expected_stages
        or separation.get("fixedPreviewEpochsPerStage") != [1, 5, 10, 20, 30, 40]
        or separation.get("legacyInactiveStage4Status") != "compiled_not_active"
        or separation.get("legacyStage3BehaviorMustRemainCompatible") is not True
        or separation.get("malformedStage4ContractMustBeRejected") is not True
    ):
        raise ValueError("stage4_decoded_alignment_stage_contract_separation_invalid")
    authorized = authorization.get("authorizedBoundaries", {})
    for key in (
        "trainerModificationAuthorized",
        "existingCpuCheckerModificationAuthorized",
        "syntheticCpuForwardAuthorized",
        "syntheticCpuAutogradInspectionAuthorized",
        "cpuPositiveNegativeRegressionAuthorized",
        "inactiveConfigCompilationAuthorizedAfterAllPass",
        "evidenceWriteAuthorized",
        "uniquePlanMigrationRegistryAndTaskCapsuleSyncAuthorizedAfterAllPass",
    ):
        if authorized.get(key) is not True:
            raise ValueError(f"stage4_decoded_alignment_authorized_action_{key}_missing")
    for key in (
        "frozenV8ModelModificationAuthorized",
        "legacyV7ConfigFileModificationAuthorized",
        "checkpointReadOrLoadAuthorized",
        "optimizerCreationAuthorized",
        "backwardMethodExecutionAuthorized",
        "modelWeightModificationAuthorized",
        "modelParameterUpdateAuthorized",
        "gpuUseAuthorized",
        "trainingAuthorized",
        "hyperparameterSelectionAuthorized",
        "reviewThresholdModificationAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
        "automaticRetryAuthorized",
    ):
        if authorized.get(key) is not False:
            raise ValueError(f"stage4_decoded_alignment_forbidden_boundary_{key}_opened")
    if sha256_file(MODEL_PATH) != identity["frozenModelSha256"]:
        raise ValueError("stage4_decoded_alignment_frozen_model_changed")
    if sha256_file(TRAINER_PATH) == identity["trainerBeforeSha256"]:
        raise ValueError("stage4_decoded_alignment_stage_boundary_fix_not_implemented")
    if sha256_file(Path(__file__)) == identity["cpuCheckerBeforeSha256"]:
        raise ValueError("stage4_decoded_alignment_compatibility_regression_not_implemented")
    return authorization, DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_PATH


def compile_decoded_alignment_inactive_config(source_config, authorization_path, consumption_path):
    config = deepcopy(source_config)
    config["architectureVersion"] = (
        "all-validation-multiseed-semantic-rollout-unet-v8-stage4-decoded-domain-alignment-cpu-support"
    )
    config["denoiserArchitecture"] = "multiscale_condition_unet_v8_stage4_decoded_alignment"
    config["status"] = "r5_stage4_decoded_domain_alignment_cpu_supported_inactive_not_trainable"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization_path.stem,
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": sha256_file(authorization_path),
        "implementationConsumptionPath": project_path(consumption_path),
        "implementationConsumptionSha256": sha256_file(consumption_path),
        "status": "not_authorized_candidate_only",
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
    training["r5CheckpointContinuation"] = {
        "sourceCheckpointPath": None,
        "sourceCheckpointSha256": None,
        "sourceArchitectureVersion": "multiscale_condition_unet_v7",
        "existingDenoiserCheckpointCompatible": False,
        "loadingAuthorizedNow": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
    }
    if isinstance(training.get("stage4FullTrainingContract"), dict):
        training["stage4FullTrainingContract"]["status"] = "v8_architecture_cpu_support_not_active"
    training["stage4DecodedDomainAlignment"] = {
        "enabled": False,
        "status": "cpu_support_verified_not_active",
        "contractId": "stage4_decoded_domain_alignment_bridge_v1",
        "architectureId": "multiscale_condition_unet_v8_stage4_decoded_alignment",
        "conditionChannelCount": 23,
        "latentOutputShapeChanged": False,
        "legacyStage3AndStage4ModesPreserved": True,
        "existingDenoiserCheckpointCompatible": False,
        "stage0InitializationIfLaterAuthorized": "project_random_initialization_only",
        "trainingLossImplementationStatus": "not_implemented_not_authorized",
        "typedConditionDecoderAdapters": {
            "scales": ["up1", "up0"],
            "source": "original_compiled_23_channel_condition_pack",
            "channelOrder": deepcopy(config["conditionChannelOrder"]),
            "resizeContract": config["conditionResizeContract"],
        },
        "sharedSemanticTopologyReadout": {
            "channels": deepcopy(DECODED_ALIGNMENT_READOUT_CHANNELS),
            "sourceFeatures": "existing_up0_decoder_features_after_up1_and_up0_typed_condition_adapters",
            "changesLatentOutputShape": False,
        },
        "frozenAutoencoderDecodedConsistencyPath": {
            "status": "support_contract_only_not_active",
            "autoencoderParametersFrozen": True,
            "gradientMayFlowToDenoiserPrediction": True,
            "autoencoderCheckpointReadRequiresSeparateAuthorization": True,
        },
        "supervisionContract": {
            "allowedSources": deepcopy(DECODED_ALIGNMENT_ALLOWED_SUPERVISION),
            "failedPreviewPixelsUsedAsTrainingTargets": False,
            "machineReviewThresholdsUsedAsTrainingTargets": False,
            "conditionMaskIsWorldFactAuthority": False,
        },
        "hyperparameterSelections": [],
        "evidenceBindings": {
            "architectureDesignTerminal": {
                "path": project_path(DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH),
                "sha256": DECODED_ALIGNMENT_DESIGN_TERMINAL_SHA256,
            },
            "architectureDesignReport": {
                "path": project_path(DECODED_ALIGNMENT_DESIGN_REPORT_PATH),
                "sha256": DECODED_ALIGNMENT_DESIGN_REPORT_SHA256,
            },
            "inactiveImplementationContract": {
                "path": project_path(DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_PATH),
                "sha256": DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_SHA256,
            },
        },
        "ownerImplementationAuthorization": {
            "authorizationPath": project_path(DECODED_ALIGNMENT_AUTHORIZATION_PATH),
            "authorizationSha256": DECODED_ALIGNMENT_AUTHORIZATION_SHA256,
            "implementationConsumptionPath": project_path(DECODED_ALIGNMENT_CONSUMPTION_PATH),
            "implementationConsumptionSha256": DECODED_ALIGNMENT_CONSUMPTION_SHA256,
            "commandRef": DECODED_ALIGNMENT_COMMAND_REF,
            "scope": DECODED_ALIGNMENT_SCOPE,
        },
        "cpuRegressionAuthorization": {
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": sha256_file(authorization_path),
            "implementationConsumptionPath": project_path(consumption_path),
            "implementationConsumptionSha256": sha256_file(consumption_path),
            "commandRef": DECODED_ALIGNMENT_REGRESSION_COMMAND_REF,
            "scope": DECODED_ALIGNMENT_REGRESSION_SCOPE,
            "previousFailureTerminalPath": project_path(DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_PATH),
            "previousFailureTerminalSha256": DECODED_ALIGNMENT_PREVIOUS_FAILURE_TERMINAL_SHA256,
            "previousCpuReportPath": project_path(DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_PATH),
            "previousCpuReportSha256": DECODED_ALIGNMENT_PREVIOUS_CPU_REPORT_SHA256,
        },
        "activationGate": {
            "configurationActiveNow": False,
            "checkpointReadNow": False,
            "optimizerCreationNow": False,
            "backwardExecutionNow": False,
            "modelParameterUpdateNow": False,
            "gpuUseNow": False,
            "trainingNow": False,
            "validationNow": False,
            "formalInferenceNow": False,
            "checkpointPromotionNow": False,
            "runtimeFrameNow": False,
            "worldEntryNow": False,
        },
    }
    return config


def run_decoded_alignment_regressions(trainer, build_system, source_config, config):
    positive = {}
    negative = {}
    measured = {}
    positive["v8_inactive_contract_accepted"] = regression_accepts(
        lambda: trainer.validate_v8_stage4_decoded_domain_alignment_cpu_support_contract(config, ROOT)
    )
    positive["legacy_v7_stage4_contract_still_accepted"] = regression_accepts(
        lambda: trainer.validate_v7_r5_candidate_contract(source_config)
    )
    positive["legacy_v7_inactive_stage4_mode_recognized"] = regression_accepts(
        lambda: trainer.validate_v7_r5_stage4_inactive_full_training_contract(source_config)
    ) and trainer.is_v7_r5_stage4_contract_mode(source_config)
    positive["stage4_40_epochs_are_independent_from_stage3_30_epoch_selection"] = (
        source_config["training"]["denoiserEpochs"] == 40
        and [
            stage["epochs"]
            for stage in source_config["training"]["stage4FullTrainingContract"]["stages"]
        ] == [40, 40, 40]
        and source_config["training"]["r5BoundedSelectionEvidence"]["continuationEpochs"]["selectedValue"] == 30
    )
    stage3_fixture = deepcopy(source_config)
    stage3_fixture["status"] = "isolated_r5_candidate_not_active"
    stage3_fixture["training"].pop("stage4FullTrainingContract", None)
    stage3_fixture["training"]["denoiserEpochs"] = 30
    positive["legacy_stage3_30_epoch_candidate_still_accepted"] = (
        not trainer.is_v7_r5_stage4_contract_mode(stage3_fixture)
        and regression_accepts(lambda: trainer.validate_v7_r5_candidate_contract(stage3_fixture))
    )
    positive["source_hyperparameters_preserved_without_selection"] = (
        config["training"]["denoiserLossVersion"] == source_config["training"]["denoiserLossVersion"]
        and config["training"]["bestCheckpointMetric"] == source_config["training"]["bestCheckpointMetric"]
        and config["training"]["stage4DecodedDomainAlignment"]["hyperparameterSelections"] == []
    )

    model_config = deepcopy(config)
    model_config["baseChannels"] = 8
    model_config["denoiserBaseChannels"] = 8
    system = build_system(model_config).cpu()
    if any(parameter.device.type != "cpu" for parameter in system.parameters()):
        raise ValueError("stage4_decoded_alignment_synthetic_model_not_cpu_only")
    for parameter in system.autoencoder.parameters():
        parameter.requires_grad_(False)
    batch_size = 2
    latent_height = 8
    latent_width = 8
    noisy_latent = torch.randn(
        batch_size,
        int(model_config["latentChannels"]),
        latent_height,
        latent_width,
        dtype=torch.float32,
        device="cpu",
        requires_grad=True,
    )
    conditions = torch.zeros(
        batch_size,
        23,
        latent_height * 4,
        latent_width * 4,
        dtype=torch.float32,
        device="cpu",
    )
    for index in range(23):
        conditions[:, index] = float(index + 1) / 23.0
    order = model_config["conditionChannelOrder"]
    discrete_index = order.index("terrain_path_ground")
    continuous_index = order.index("coordinate_x")
    checkerboard = (
        torch.arange(latent_height * 4).reshape(-1, 1)
        + torch.arange(latent_width * 4).reshape(1, -1)
    ) % 2
    conditions[:, discrete_index] = checkerboard.float()
    conditions[:, continuous_index] = torch.linspace(
        0.0,
        1.0,
        latent_width * 4,
        dtype=torch.float32,
    ).reshape(1, 1, -1).expand(batch_size, latent_height * 4, -1)
    timestep = torch.tensor([17, 311], dtype=torch.long, device="cpu")
    captured = {}
    hook_up1 = system.denoiser.typed_condition_adapter_up1.register_forward_pre_hook(
        lambda _module, inputs: captured.__setitem__("up1", inputs[0].detach().clone())
    )
    hook_up0 = system.denoiser.typed_condition_adapter_up0.register_forward_pre_hook(
        lambda _module, inputs: captured.__setitem__("up0", inputs[0].detach().clone())
    )
    state_before = trainer.state_dict_sha256(system.state_dict())
    predicted, readout = system.predict_velocity_with_stage4_alignment(
        noisy_latent,
        timestep,
        conditions,
    )
    hook_up1.remove()
    hook_up0.remove()
    expected_up1 = system.prepare_typed_conditions(conditions, (latent_height // 2, latent_width // 2))
    expected_up0 = system.prepare_typed_conditions(conditions, (latent_height, latent_width))
    explicit_discrete = torch.nn.functional.interpolate(
        conditions[:, [discrete_index]],
        size=(latent_height, latent_width),
        mode="nearest",
    )
    explicit_continuous = torch.nn.functional.interpolate(
        conditions[:, [continuous_index]],
        size=(latent_height, latent_width),
        mode="bilinear",
        align_corners=False,
    )
    positive["latent_output_shape_preserved"] = tuple(predicted.shape) == tuple(noisy_latent.shape)
    positive["shared_semantic_topology_readout_shape_exact"] = tuple(readout.shape) == (
        batch_size,
        len(DECODED_ALIGNMENT_READOUT_CHANNELS),
        latent_height,
        latent_width,
    )
    positive["shared_readout_channel_order_exact"] = (
        list(system.stage4_alignment_readout_channel_order()) == DECODED_ALIGNMENT_READOUT_CHANNELS
    )
    positive["typed_adapter_up1_receives_ordered_conditions"] = (
        "up1" in captured and torch.equal(captured["up1"], expected_up1)
    )
    positive["typed_adapter_up0_receives_ordered_conditions"] = (
        "up0" in captured and torch.equal(captured["up0"], expected_up0)
    )
    positive["discrete_nearest_resize_preserved"] = torch.equal(
        expected_up0[:, [discrete_index]],
        explicit_discrete,
    )
    positive["continuous_bilinear_resize_preserved"] = torch.allclose(
        expected_up0[:, [continuous_index]],
        explicit_continuous,
        rtol=0.0,
        atol=1e-7,
    )

    decoded_rgb = system.autoencoder.decode(predicted)
    diagnostic_loss = decoded_rgb.mean() + readout.mean()
    adapter_parameters = [
        parameter
        for name, parameter in system.denoiser.named_parameters()
        if name.startswith("typed_condition_adapter_")
    ]
    readout_parameters = [
        parameter
        for name, parameter in system.denoiser.named_parameters()
        if name.startswith("shared_semantic_topology_readout")
    ]
    gradients = torch.autograd.grad(
        diagnostic_loss,
        [*adapter_parameters, *readout_parameters],
        allow_unused=True,
    )
    adapter_gradients = gradients[:len(adapter_parameters)]
    readout_gradients = gradients[len(adapter_parameters):]
    state_after = trainer.state_dict_sha256(system.state_dict())
    positive["typed_adapter_gradient_path_present"] = any(
        gradient is not None and float(gradient.detach().abs().sum()) > 0.0
        for gradient in adapter_gradients
    )
    positive["shared_readout_gradient_path_present"] = any(
        gradient is not None and float(gradient.detach().abs().sum()) > 0.0
        for gradient in readout_gradients
    )
    positive["autoencoder_parameters_frozen_and_gradient_isolated"] = (
        all(parameter.requires_grad is False for parameter in system.autoencoder.parameters())
        and all(parameter.grad is None for parameter in system.autoencoder.parameters())
    )
    positive["autograd_inspection_did_not_update_model_state"] = state_before == state_after
    positive["autograd_grad_did_not_populate_parameter_grad_buffers"] = all(
        parameter.grad is None for parameter in system.parameters()
    )

    legacy_model_config = deepcopy(model_config)
    legacy_model_config["denoiserArchitecture"] = "multiscale_condition_unet_v7"
    legacy_system = build_system(legacy_model_config).cpu()
    legacy_output = legacy_system.predict_velocity(noisy_latent.detach(), timestep, conditions)
    positive["legacy_v7_forward_shape_unchanged"] = tuple(legacy_output.shape) == tuple(noisy_latent.shape)
    v7_state = legacy_system.denoiser.state_dict()
    v8_state = system.denoiser.state_dict()
    strict_schema_compatible = (
        set(v7_state) == set(v8_state)
        and all(tuple(v7_state[name].shape) == tuple(v8_state[name].shape) for name in v7_state)
    )
    added_v8_keys = sorted(set(v8_state) - set(v7_state))
    positive["v8_checkpoint_schema_change_is_bounded_to_new_components"] = (
        bool(added_v8_keys)
        and all(name.startswith((
            "typed_condition_adapter_up1.",
            "typed_condition_adapter_up0.",
            "shared_semantic_topology_readout.",
        )) for name in added_v8_keys)
        and not (set(v7_state) - set(v8_state))
    )
    negative["old_v7_checkpoint_strict_schema_compatibility_rejected"] = not strict_schema_compatible

    contract_mutations = {
        "illegal_supervision_source_rejected": (
            "supervisionContract", "allowedSources", [*DECODED_ALIGNMENT_ALLOWED_SUPERVISION, "failed_preview_pixels"]
        ),
        "failed_preview_target_rejected": (
            "supervisionContract", "failedPreviewPixelsUsedAsTrainingTargets", True
        ),
        "review_threshold_target_rejected": (
            "supervisionContract", "machineReviewThresholdsUsedAsTrainingTargets", True
        ),
        "hyperparameter_selection_rejected": (
            None, "hyperparameterSelections", [{"name": "learningRate", "value": 0.001}]
        ),
        "old_checkpoint_compatibility_claim_rejected": (
            None, "existingDenoiserCheckpointCompatible", True
        ),
        "wrong_adapter_scale_rejected": (
            "typedConditionDecoderAdapters", "scales", ["up0"]
        ),
        "configuration_activation_rejected": (
            "activationGate", "configurationActiveNow", True
        ),
    }
    for name, (section, key, value) in contract_mutations.items():
        candidate = deepcopy(config)
        target = candidate["training"]["stage4DecodedDomainAlignment"]
        if section is not None:
            target = target[section]
        target[key] = value
        negative[name] = regression_rejects(
            lambda candidate=candidate: trainer.validate_v8_stage4_decoded_domain_alignment_cpu_support_contract(
                candidate,
                ROOT,
            )
        )
    candidate = deepcopy(config)
    candidate["training"]["stage4DecodedDomainAlignment"]["activationGate"]["startTrainingNow"] = True
    negative["unknown_activation_action_rejected"] = regression_rejects(
        lambda: trainer.validate_v8_stage4_decoded_domain_alignment_cpu_support_contract(candidate, ROOT)
    )
    negative["inactive_v8_training_gate_rejects_execution"] = regression_rejects(
        lambda: trainer.validate_training_inputs(config, {})
    )
    negative["legacy_v7_alignment_readout_unavailable"] = regression_rejects(
        lambda: legacy_system.predict_velocity_with_stage4_alignment(
            noisy_latent.detach(),
            timestep,
            conditions,
        )
    )
    invalid_channel_config = deepcopy(model_config)
    invalid_channel_config["conditionChannels"] = 22
    negative["invalid_22_channel_model_rejected"] = regression_rejects(
        lambda: build_system(invalid_channel_config)
    )
    malformed_stage4_epochs = deepcopy(source_config)
    malformed_stage4_epochs["training"]["stage4FullTrainingContract"]["stages"][0]["epochs"] = 30
    negative["malformed_stage4_30_epoch_stage_rejected"] = regression_rejects(
        lambda: trainer.validate_v7_r5_candidate_contract(malformed_stage4_epochs)
    )
    malformed_stage4_previews = deepcopy(source_config)
    malformed_stage4_previews["training"]["stage4FullTrainingContract"]["fixedPreviewEpochsPerStage"] = [1, 10, 20, 30]
    negative["malformed_stage4_preview_contract_rejected"] = regression_rejects(
        lambda: trainer.validate_v7_r5_candidate_contract(malformed_stage4_previews)
    )
    stage3_wrong_epoch_fixture = deepcopy(stage3_fixture)
    stage3_wrong_epoch_fixture["training"]["denoiserEpochs"] = 40
    negative["stage3_cannot_inherit_stage4_40_epoch_contract_without_stage4_identity"] = regression_rejects(
        lambda: trainer.validate_v7_r5_candidate_contract(stage3_wrong_epoch_fixture)
    )

    audit = {
        "designEvidenceHashesExact": all((
            sha256_file(DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH) == DECODED_ALIGNMENT_DESIGN_TERMINAL_SHA256,
            sha256_file(DECODED_ALIGNMENT_DESIGN_REPORT_PATH) == DECODED_ALIGNMENT_DESIGN_REPORT_SHA256,
            sha256_file(DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_PATH)
            == DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_SHA256,
        )),
        "sourceConfigHashExact": sha256_file(DECODED_ALIGNMENT_SOURCE_CONFIG_PATH) == DECODED_ALIGNMENT_SOURCE_CONFIG_SHA256,
        "v8ImplementationAuthorizationConsumedOnce": (
            sha256_file(DECODED_ALIGNMENT_AUTHORIZATION_PATH) == DECODED_ALIGNMENT_AUTHORIZATION_SHA256
            and sha256_file(DECODED_ALIGNMENT_CONSUMPTION_PATH) == DECODED_ALIGNMENT_CONSUMPTION_SHA256
        ),
        "currentRegressionAuthorizationConsumedOnce": (
            sha256_file(DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_PATH)
            == DECODED_ALIGNMENT_REGRESSION_AUTHORIZATION_SHA256
            and sha256_file(DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_PATH)
            == DECODED_ALIGNMENT_REGRESSION_CONSUMPTION_SHA256
        ),
        "modelTrainerCheckerImplemented": all((
            sha256_file(MODEL_PATH) == "954d2b42cb9f8216f74ccd5753de017ea8539aea0f58d94e954374ded4029577",
            sha256_file(TRAINER_PATH) != "cf5678e75f89e4f21970c2b79d6cd60b3a00a730620427cfd575d6499b026275",
            sha256_file(Path(__file__)) != "b87c73237ff8f934a2b11451198c910294f4fccc46c05140ca4138b8a19aefe4",
        )),
        "configurationInactive": config["training"]["trainingAuthorizationStatus"] == "not_authorized_candidate_only",
        "noCheckpointIdentityCarriedIntoV8": (
            config["training"]["r5CheckpointContinuation"]["sourceCheckpointPath"] is None
            and config["training"]["r5CheckpointContinuation"]["sourceCheckpointSha256"] is None
        ),
        "allExecutionBoundariesClosed": all(
            inactive_boundaries()[key] is False for key in (
                "checkpointFileRead",
                "checkpointLoaded",
                "optimizerCreated",
                "backwardExecuted",
                "modelWeightsModified",
                "gpuUsed",
                "trainingStarted",
                "strictRevalidationStarted",
                "formalInferenceStarted",
                "checkpointPromoted",
                "runtimeFrameStarted",
                "worldEntryStarted",
            )
        ),
    }
    positive["complete_cpu_only_configuration_audit_passed"] = all(audit.values())
    measured.update({
        "conditionChannelCount": int(conditions.shape[1]),
        "latentOutputShape": list(predicted.shape),
        "sharedReadoutShape": list(readout.shape),
        "decodedRgbShapeForGradientIsolation": list(decoded_rgb.shape),
        "v8OnlyStateKeyCount": len(added_v8_keys),
        "modelStateSha256BeforeAutogradInspection": state_before,
        "modelStateSha256AfterAutogradInspection": state_after,
        "syntheticCpuForwardCount": 2,
        "autogradGradInspectionCount": 1,
        "backwardMethodExecutionCount": 0,
        "optimizerCreationCount": 0,
        "modelParameterUpdateCount": 0,
        "checkpointReadCount": 0,
        "gpuExecutionCount": 0,
        "trainingExecutionCount": 0,
    })
    return positive, negative, measured, audit


def decoded_alignment_report(
    authorization_path,
    consumption_path,
    positive,
    negative,
    measured,
    audit,
    failed_positive,
    failed_negative,
):
    passed = not failed_positive and not failed_negative
    return {
        "schemaVersion": "v8-r5-stage4-decoded-domain-alignment-cpu-regression-v1",
        "status": (
            "passed_cpu_only_decoded_domain_alignment_support_not_active"
            if passed else "failed_cpu_only_decoded_domain_alignment_support_closed"
        ),
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": sha256_file(authorization_path),
            "implementationConsumptionPath": project_path(consumption_path),
            "implementationConsumptionSha256": sha256_file(consumption_path),
            "architectureDesignTerminalPath": project_path(DECODED_ALIGNMENT_DESIGN_TERMINAL_PATH),
            "architectureDesignTerminalSha256": DECODED_ALIGNMENT_DESIGN_TERMINAL_SHA256,
            "architectureDesignReportPath": project_path(DECODED_ALIGNMENT_DESIGN_REPORT_PATH),
            "architectureDesignReportSha256": DECODED_ALIGNMENT_DESIGN_REPORT_SHA256,
            "inactiveImplementationContractPath": project_path(DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_PATH),
            "inactiveImplementationContractSha256": DECODED_ALIGNMENT_IMPLEMENTATION_CONTRACT_SHA256,
            "sourceConfigPath": project_path(DECODED_ALIGNMENT_SOURCE_CONFIG_PATH),
            "sourceConfigSha256": DECODED_ALIGNMENT_SOURCE_CONFIG_SHA256,
            "modelPath": project_path(MODEL_PATH),
            "modelSha256": sha256_file(MODEL_PATH),
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(TRAINER_PATH),
            "compilerAndCpuCheckerPath": project_path(Path(__file__)),
            "compilerAndCpuCheckerSha256": sha256_file(Path(__file__)),
        },
        "positiveRegressions": positive,
        "negativeRegressions": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "measurements": measured,
        "completeConfigurationAudit": audit,
        "allCpuRegressionsPassed": passed,
        "hyperparameterSelections": [],
        "automaticRetry": False,
        **inactive_boundaries(),
    }


def decoded_alignment_support_contract(args, report):
    return {
        "schemaVersion": "v8-r5-stage4-decoded-domain-alignment-trainer-support-contract-v1",
        "status": "cpu_verified_decoded_domain_alignment_support_not_active",
        "contractId": "stage4_decoded_domain_alignment_bridge_v1",
        "architectureId": "multiscale_condition_unet_v8_stage4_decoded_alignment",
        "modelPath": project_path(MODEL_PATH),
        "modelSha256": sha256_file(MODEL_PATH),
        "trainerPath": project_path(TRAINER_PATH),
        "trainerSha256": sha256_file(TRAINER_PATH),
        "compilerAndCpuCheckerPath": project_path(Path(__file__)),
        "compilerAndCpuCheckerSha256": sha256_file(Path(__file__)),
        "inactiveConfigPath": project_path(args.inactive_config),
        "inactiveConfigSha256": sha256_file(args.inactive_config),
        "cpuReportPath": project_path(args.report),
        "cpuReportSha256": sha256_file(args.report),
        "conditionChannels": 23,
        "typedConditionAdapterScales": ["up1", "up0"],
        "sharedReadoutChannels": deepcopy(DECODED_ALIGNMENT_READOUT_CHANNELS),
        "latentOutputShapeChanged": False,
        "legacyStage3AndStage4ModesPreserved": True,
        "existingDenoiserCheckpointCompatible": False,
        "hyperparameterSelections": [],
        "allCpuRegressionsPassed": report["allCpuRegressionsPassed"],
        "nextIndependentAuthorization": (
            "one_fixed_single_sample_gpu_forward_and_gradient_routing_diagnostic_for_v8_only"
        ),
        **inactive_boundaries(),
    }


def decoded_alignment_owner_action_request(args):
    return {
        "schemaVersion": "ai-painter-owner-action-request-preview-v1",
        "status": "preview_not_approved_not_consumed_not_executed",
        "module": "AI Painter R5",
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        "currentStage": 4,
        "candidate": "stage4_decoded_domain_alignment_bridge_v1",
        "requestType": "separate_v8_single_sample_gpu_forward_and_gradient_routing_diagnostic",
        "sourceEvidence": {
            "inactiveConfigPath": project_path(args.inactive_config),
            "inactiveConfigSha256": sha256_file(args.inactive_config),
            "supportContractPath": project_path(args.contract),
            "supportContractSha256": sha256_file(args.contract),
            "cpuReportPath": project_path(args.report),
            "cpuReportSha256": sha256_file(args.report),
        },
        "proposedAction": {
            "summary": "Run one separately authorized fixed-sample V8 forward and gradient-routing GPU diagnostic before any training Smoke.",
            "ownerApprovalRequired": True,
            "approvedNow": False,
            "consumedNow": False,
            "executedNow": False,
        },
        "forbiddenWithoutFutureAuthorization": [
            "checkpoint_read_or_load",
            "optimizer_creation",
            "model_parameter_update",
            "gpu_use",
            "training",
            "stage4_full_training",
            "stage5_strict_revalidation",
            "formal_inference",
            "checkpoint_promotion",
            "runtime_frame",
            "world_entry",
        ],
    }


def decoded_alignment_terminal(status, args, blockers):
    return {
        "schemaVersion": "v8-r5-stage4-decoded-domain-alignment-cpu-support-terminal-v1",
        "status": status,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
        "inactiveConfigPath": project_path(args.inactive_config) if resolved(args.inactive_config).exists() else None,
        "inactiveConfigSha256": sha256_file(args.inactive_config) if resolved(args.inactive_config).exists() else None,
        "cpuReportPath": project_path(args.report) if resolved(args.report).exists() else None,
        "cpuReportSha256": sha256_file(args.report) if resolved(args.report).exists() else None,
        "trainerSupportContractPath": project_path(args.contract) if resolved(args.contract).exists() else None,
        "trainerSupportContractSha256": sha256_file(args.contract) if resolved(args.contract).exists() else None,
        "ownerActionRequestPath": project_path(args.selection) if resolved(args.selection).exists() else None,
        "ownerActionRequestSha256": sha256_file(args.selection) if resolved(args.selection).exists() else None,
        "blockers": blockers,
        "automaticRetry": False,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        "stage4InternalState": (
            "decoded_domain_alignment_v8_cpu_supported_not_active"
            if not blockers else "decoded_domain_alignment_v8_cpu_support_failed_closed"
        ),
        "nextIndependentAuthorization": (
            "one_fixed_single_sample_gpu_forward_and_gradient_routing_diagnostic_for_v8_only"
            if not blockers else None
        ),
        **inactive_boundaries(),
    }


def run_cross_domain_candidate(args) -> int:
    torch.set_num_threads(1)
    authorization_path = args.cross_domain_authorization
    try:
        authorization, identity, implementation_path = validate_cross_domain_authorization(authorization_path)
        trainer = load_trainer()
        source_config = read_json(Path(identity["sourceInactiveConfigPath"]))
        analysis = read_json(Path(identity["failureAnalysisPath"]))
        selection = select_cross_domain_parameters(authorization_path, identity, analysis, implementation_path)
        config = compile_cross_domain_inactive_config(source_config, selection, authorization_path, implementation_path)
        positive, negative, measured = run_cross_domain_regressions(
            trainer,
            source_config,
            config,
            identity,
        )
        failures = [name for name, passed in {**positive, **negative}.items() if not passed]
        report = cross_domain_report(
            authorization_path,
            implementation_path,
            identity,
            positive,
            negative,
            measured,
            failures,
        )
        if failures:
            write_json_exclusive(args.report, report)
            write_json_exclusive(args.terminal, cross_domain_terminal(
                "r5_stage4_cross_domain_visual_consistency_cpu_regression_failed_closed",
                args,
                failures,
            ))
            return 1
        write_json_exclusive(args.inactive_config, config)
        if sha256_file(args.inactive_config) == identity["sourceInactiveConfigSha256"]:
            raise ValueError("stage4_cross_domain_candidate_must_not_match_previous_failed_smoke_config")
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
        write_json_exclusive(args.contract, cross_domain_support_contract(args, report))
        terminal = cross_domain_terminal(
            "r5_stage4_cross_domain_visual_consistency_selected_compiled_cpu_verified_not_active",
            args,
            [],
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
            write_json_exclusive(args.terminal, {
                "schemaVersion": "v7-r5-stage4-cross-domain-visual-consistency-terminal-v1",
                "status": "r5_stage4_cross_domain_visual_consistency_execution_failed_closed",
                "error": {"type": type(error).__name__, "message": str(error)},
                "failedClosed": True,
                **inactive_boundaries(),
            })
        raise


def validate_cross_domain_authorization(authorization_path: Path):
    if not resolved(authorization_path).is_file():
        raise ValueError("stage4_cross_domain_authorization_missing")
    authorization = read_json(authorization_path)
    implementation_path = authorization_path.parent / CROSS_DOMAIN_IMPLEMENTATION_CONSUMPTION_NAME
    if not resolved(implementation_path).is_file() or sha256_file(implementation_path) != CROSS_DOMAIN_IMPLEMENTATION_CONSUMPTION_SHA256:
        raise ValueError("stage4_cross_domain_implementation_consumption_missing_or_changed")
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != CROSS_DOMAIN_COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != CROSS_DOMAIN_SCOPE
        or authorization.get("ownerDecision", {}).get("supplementalScope") != CROSS_DOMAIN_SUPPLEMENTAL_SCOPE
    ):
        raise ValueError("stage4_cross_domain_authorization_identity_invalid")
    implementation = read_json(implementation_path)
    if (
        implementation.get("requestId") != authorization.get("requestId")
        or implementation.get("authorizationSha256") != sha256_file(authorization_path)
        or implementation.get("commandRef") != CROSS_DOMAIN_COMMAND_REF
        or implementation.get("scope") != CROSS_DOMAIN_SCOPE
        or implementation.get("allowedCandidateCompilationCount") != 1
        or implementation.get("allowedCpuRegressionCount") != 1
        or implementation.get("gpuExecutionConsumed") is not False
    ):
        raise ValueError("stage4_cross_domain_implementation_consumption_identity_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "fixedStageNumber": 4,
        "sampleId": "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "epochCount": 30,
        "requiredPreviewEpochs": [1, 5, 10, 20, 30],
        "requiredDiagnosticMetricCount": 17,
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_cross_domain_{key}_identity_invalid")
    bindings = (
        (identity["successfulAnalysisTerminalPath"], identity["successfulAnalysisTerminalSha256"], "analysis_terminal"),
        (identity["failureAnalysisPath"], identity["failureAnalysisSha256"], "analysis"),
        (identity["repairProposalPath"], identity["repairProposalSha256"], "proposal"),
        (identity["previousEffectiveSmokeTerminalPath"], identity["previousEffectiveSmokeTerminalSha256"], "previous_smoke_terminal"),
        (identity["sourceInactiveConfigPath"], identity["sourceInactiveConfigSha256"], "source_config"),
        (identity["frozenAnalyzerPath"], identity["frozenAnalyzerSha256"], "frozen_analyzer"),
        (identity["frozenAnalysisRunnerPath"], identity["frozenAnalysisRunnerSha256"], "frozen_analysis_runner"),
    )
    for path, expected, label in bindings:
        bound_path = Path(path)
        if not resolved(bound_path).is_file() or sha256_file(bound_path) != expected:
            raise ValueError(f"stage4_cross_domain_{label}_missing_or_changed")
    resolution = authorization.get("resolution", {})
    for flag in (
        "boundedParameterSelectionAuthorized",
        "inactiveConfigurationCompilationAuthorized",
        "trainerCrossDomainVisualConsistencySupportAuthorized",
        "smokeCpuCheckerUpdateAuthorized",
        "candidateCompilerUpdateAuthorized",
        "currentRunnerTrainerShaDynamicAuthorizationBindingAuthorized",
        "cpuPositiveNegativeRegressionAuthorized",
    ):
        if resolution.get(flag) is not True:
            raise ValueError(f"stage4_cross_domain_{flag}_missing")
    for flag in (
        "analyzerModificationAuthorized",
        "analysisRunnerModificationAuthorized",
        "reviewThresholdModificationAuthorized",
        "failedPreviewPixelsAsTrainingTargetsAuthorized",
        "machineReviewThresholdsAsTrainingTargetsAuthorized",
        "stage4FullTrainingAuthorized",
        "stage1Authorized",
        "stage2Authorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
        "automaticRetryAuthorized",
    ):
        if resolution.get(flag) is not False:
            raise ValueError(f"stage4_cross_domain_{flag}_opened")
    return authorization, identity, implementation_path


def select_cross_domain_parameters(authorization_path, identity, analysis, implementation_path):
    timeline = analysis.get("timeline", [])
    if len(timeline) != 5 or [row.get("epoch") for row in timeline] != [1, 5, 10, 20, 30]:
        raise ValueError("stage4_cross_domain_requires_five_fixed_preview_records")
    prevalence = {
        "rock": sum("condition_object_rock_reference_semantic_mismatch" in row.get("issueCodes", []) for row in timeline) / 5,
        "routeCoverage": sum("condition_terrain_path_ground_coverage_mismatch" in row.get("issueCodes", []) for row in timeline) / 5,
        "routeBoundary": sum("condition_terrain_path_ground_required_boundary_contact_missing" in row.get("issueCodes", []) for row in timeline) / 5,
    }
    if prevalence != {"rock": 1.0, "routeCoverage": 0.8, "routeBoundary": 1.0}:
        raise ValueError("stage4_cross_domain_failure_prevalence_changed")
    values = {
        "crossDomainRolloutWeight": {"minimum": 0.175, "maximum": 0.35, "failurePrevalence": 1.0, "selectedValue": 0.35},
        "gradientTailSteps": {"minimum": 2, "maximum": 5, "failurePrevalence": 1.0, "selectedValue": 5},
        "objectRockRelativeMultiplier": {"minimum": 1.0, "maximum": 1.25, "failurePrevalence": 1.0, "selectedValue": 1.25},
    }
    return {
        "schemaVersion": "v7-r5-stage4-cross-domain-visual-consistency-selection-contract-v1",
        "status": "selected_inactive_not_authorized",
        "candidateVersion": "v7_r5_stage4_cross_domain_visual_consistency_candidate_v1",
        "selectionPolicy": "five_preview_failure_prevalence_linear_mapping_with_existing_training_weight_caps",
        "reviewThresholdPolicy": "preserved_unchanged_not_used_as_training_target",
        "selectedValues": values,
        "observedFailurePrevalence": prevalence,
        "trainingTargetSources": ["original_owner_approved_rgb", "original_condition_pack", "existing_legal_training_supervision"],
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "authorization": {"path": project_path(authorization_path), "sha256": sha256_file(authorization_path)},
        "authorizationConsumption": {"path": project_path(implementation_path), "sha256": sha256_file(implementation_path)},
        "analysis": {"path": identity["failureAnalysisPath"], "sha256": identity["failureAnalysisSha256"]},
        "proposal": {"path": identity["repairProposalPath"], "sha256": identity["repairProposalSha256"]},
        "sourceConfig": {"path": identity["sourceInactiveConfigPath"], "sha256": identity["sourceInactiveConfigSha256"]},
        **inactive_boundaries(),
    }


def compile_cross_domain_inactive_config(source_config, selection, authorization_path, implementation_path):
    config = deepcopy(source_config)
    training = config["training"]
    training["denoiserLossVersion"] = "velocity_decoded_rgb_path_replay_cross_domain_visual_consistency_v7_repair_r5_candidate"
    training["r5Stage4CrossDomainVisualConsistencySelectionEvidence"] = {
        "candidateVersion": selection["candidateVersion"],
        "candidateStatus": "selected_inactive_not_authorized",
        "selectionPolicy": selection["selectionPolicy"],
        "reviewThresholdPolicy": selection["reviewThresholdPolicy"],
        "selectedValues": deepcopy(selection["selectedValues"]),
        "analysisPath": selection["analysis"]["path"],
        "analysisSha256": selection["analysis"]["sha256"],
        "proposalPath": selection["proposal"]["path"],
        "proposalSha256": selection["proposal"]["sha256"],
        "sourceConfigPath": selection["sourceConfig"]["path"],
        "sourceConfigSha256": selection["sourceConfig"]["sha256"],
        "candidateActive": False,
    }
    training["stage4CrossDomainVisualConsistency"] = {
        "enabled": True,
        "status": "candidate_support_not_active",
        "targetSource": "original_owner_approved_rgb_and_condition_pack_only",
        "rolloutInitializationSource": "deterministic_noise_from_task_seed_plus_preview_offset_without_preview_pixels",
        "conditionChannel": "terrain_path_ground",
        "objectChannel": "object_rock",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "inferenceStepsSource": "model_config_inference_steps",
        "previewSeedOffset": 3000,
        "gradientTailSteps": 5,
        "weight": 0.35,
        "route": {
            "lossForm": "path_rgb_plus_activation_mass_plus_required_boundary_contact",
            "requiredSidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
        },
        "rock": {
            "lossForm": "masked_rgb_plus_masked_edge_reference_consistency",
            "rgbWeight": 1.25,
            "edgeWeight": 0.35,
        },
    }
    inactive_authorization = training.get("ownerTrainingAuthorization", {})
    training["ownerTrainingAuthorization"] = {
        **inactive_authorization,
        "authorizationId": authorization_path.parent.name,
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": sha256_file(authorization_path),
        "authorizationCommandRef": CROSS_DOMAIN_COMMAND_REF,
        "authorizationScope": CROSS_DOMAIN_SCOPE,
        "implementationConsumptionPath": project_path(implementation_path),
        "implementationConsumptionSha256": sha256_file(implementation_path),
        "status": "not_authorized_candidate_only",
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    if config == source_config:
        raise ValueError("stage4_cross_domain_candidate_configuration_identical_to_previous_failure")
    return config


def run_cross_domain_regressions(trainer, source_config, config, identity):
    positive = {}
    negative = {}
    measured = {}
    positive["new_candidate_contract_accepted"] = regression_accepts(lambda: trainer.validate_v7_r5_candidate_contract(config))
    positive["new_cross_domain_contract_accepted"] = regression_accepts(lambda: trainer.validate_v7_r5_stage4_cross_domain_visual_consistency_contract(config))
    positive["legacy_source_candidate_still_accepted"] = regression_accepts(lambda: trainer.validate_v7_r5_candidate_contract(source_config))
    positive["candidate_differs_from_previous_failed_smoke"] = config != source_config
    positive["sample_seed_and_west_topology_preserved"] = (
        config["training"].get("seed") == identity["seed"]
        and config["training"].get("authorizedOverfitSampleId") == identity["sampleId"]
        and config["training"].get("authorizedBoundaryTopology", {}).get("requiredBoundarySides") == ["west"]
    )
    target = torch.zeros((1, 3, 16, 16), dtype=torch.float32)
    target[:, :, 5:11, :5] = 0.8
    predicted = target.clone().requires_grad_(True)
    conditions = torch.zeros((1, len(config["conditionChannelOrder"]), 16, 16), dtype=torch.float32)
    conditions[:, config["conditionChannelOrder"].index("terrain_path_ground"), 5:11, :8] = 1.0
    conditions[:, config["conditionChannelOrder"].index("object_rock"), 7:10, 9:13] = 1.0
    losses = trainer.stage4_cross_domain_visual_consistency_losses(predicted, target, conditions, config)
    losses["stage4CrossDomainVisualConsistencyLossTensor"].backward()
    perfect_loss = float(losses["stage4CrossDomainVisualConsistencyWeightedLoss"].detach())
    perfect_gradient = float(predicted.grad.abs().sum())
    changed = target.clone()
    changed[:, :, 5:11, :8] = 0.0
    changed[:, :, 7:10, 9:13] = 1.0
    changed.requires_grad_(True)
    changed_losses = trainer.stage4_cross_domain_visual_consistency_losses(changed, target, conditions, config)
    changed_losses["stage4CrossDomainVisualConsistencyLossTensor"].backward()
    changed_loss = float(changed_losses["stage4CrossDomainVisualConsistencyWeightedLoss"].detach())
    changed_gradient = float(changed.grad.abs().sum())
    positive["perfect_original_reference_has_zero_cross_domain_loss"] = abs(perfect_loss) < 1e-8
    positive["route_and_rock_mismatch_raise_cross_domain_loss"] = changed_loss > perfect_loss + 1e-6
    positive["cross_domain_loss_contributes_gradient"] = changed_gradient > 0.0
    measured.update({
        "perfectReferenceWeightedLoss": perfect_loss,
        "perfectReferenceGradientL1": perfect_gradient,
        "mismatchedReferenceWeightedLoss": changed_loss,
        "mismatchedReferenceGradientL1": changed_gradient,
    })
    mutations = {
        "failed_preview_pixels_rejected": ("stage4CrossDomainVisualConsistency", "failedPreviewPixelsUsedAsTrainingTargets", True),
        "review_threshold_target_rejected": ("stage4CrossDomainVisualConsistency", "machineReviewThresholdUsedAsTrainingTarget", True),
        "wrong_target_source_rejected": ("stage4CrossDomainVisualConsistency", "targetSource", "failed_preview_pixels"),
        "excess_weight_rejected": ("stage4CrossDomainVisualConsistency", "weight", 0.351),
        "wrong_gradient_tail_rejected": ("stage4CrossDomainVisualConsistency", "gradientTailSteps", 6),
    }
    for name, (section, key, value) in mutations.items():
        candidate = deepcopy(config)
        candidate["training"][section][key] = value
        negative[name] = regression_rejects(lambda candidate=candidate: trainer.validate_v7_r5_stage4_cross_domain_visual_consistency_contract(candidate))
    candidate = deepcopy(config)
    candidate["training"]["r5Stage4CrossDomainVisualConsistencySelectionEvidence"]["candidateActive"] = True
    negative["self_activation_rejected"] = regression_rejects(lambda: trainer.validate_v7_r5_stage4_cross_domain_visual_consistency_contract(candidate))
    return positive, negative, measured


def regression_accepts(action):
    try:
        action()
        return True
    except Exception:
        return False


def regression_rejects(action):
    try:
        action()
        return False
    except Exception:
        return True


def cross_domain_report(authorization_path, implementation_path, identity, positive, negative, measured, failures):
    return {
        "schemaVersion": "v7-r5-stage4-cross-domain-visual-consistency-cpu-regression-v1",
        "status": "passed_cpu_only_cross_domain_visual_consistency_not_active" if not failures else "failed_cpu_only_cross_domain_visual_consistency_closed",
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": sha256_file(authorization_path),
            "implementationConsumptionPath": project_path(implementation_path),
            "implementationConsumptionSha256": sha256_file(implementation_path),
            "analysisPath": identity["failureAnalysisPath"],
            "analysisSha256": identity["failureAnalysisSha256"],
            "sourceConfigPath": identity["sourceInactiveConfigPath"],
            "sourceConfigSha256": identity["sourceInactiveConfigSha256"],
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(TRAINER_PATH),
        },
        "positiveRegressions": positive,
        "negativeRegressions": negative,
        "measurements": measured,
        "failures": failures,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        **inactive_boundaries(),
    }


def cross_domain_support_contract(args, report):
    return {
        "schemaVersion": "v7-r5-stage4-cross-domain-visual-consistency-trainer-support-contract-v1",
        "status": "cpu_verified_cross_domain_visual_consistency_support_not_active",
        "trainerPath": project_path(TRAINER_PATH),
        "trainerSha256": sha256_file(TRAINER_PATH),
        "candidateCpuReportPath": project_path(args.report),
        "candidateCpuReportSha256": sha256_file(args.report),
        "inactiveConfigPath": project_path(args.inactive_config),
        "inactiveConfigSha256": sha256_file(args.inactive_config),
        "selectionContractPath": project_path(args.selection),
        "selectionContractSha256": sha256_file(args.selection),
        "allCpuRegressionsPassed": not report["failures"],
        **inactive_boundaries(),
    }


def cross_domain_terminal(status, args, blockers):
    return {
        "schemaVersion": "v7-r5-stage4-cross-domain-visual-consistency-terminal-v1",
        "status": status,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
        "inactiveConfigPath": project_path(args.inactive_config) if resolved(args.inactive_config).exists() else None,
        "inactiveConfigSha256": sha256_file(args.inactive_config) if resolved(args.inactive_config).exists() else None,
        "selectionContractPath": project_path(args.selection) if resolved(args.selection).exists() else None,
        "selectionContractSha256": sha256_file(args.selection) if resolved(args.selection).exists() else None,
        "cpuReportPath": project_path(args.report) if resolved(args.report).exists() else None,
        "cpuReportSha256": sha256_file(args.report) if resolved(args.report).exists() else None,
        "trainerSupportContractPath": project_path(args.contract) if resolved(args.contract).exists() else None,
        "trainerSupportContractSha256": sha256_file(args.contract) if resolved(args.contract).exists() else None,
        "blockers": blockers,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        **inactive_boundaries(),
    }


def run_structured_stability_candidate(args) -> int:
    torch.set_num_threads(1)
    authorization_path = args.structured_stability_authorization
    try:
        authorization, identity, consumption_path = validate_structured_stability_authorization(
            authorization_path,
            args,
        )
        trainer = load_trainer()
        source_config = read_json(Path(identity["sourceInactiveConfigPath"]))
        analysis = read_json(Path(identity["failureAnalysisPath"]))
        decision = read_json(Path(identity["decisionPath"]))
        selection = select_structured_stability_parameters(
            authorization_path,
            consumption_path,
            identity,
            analysis,
            decision,
        )
        config = compile_structured_stability_inactive_config(
            source_config,
            selection,
            authorization_path,
            consumption_path,
        )
        positive, negative, measured, audit = run_structured_stability_regressions(
            trainer,
            source_config,
            config,
            identity,
            selection,
        )
        failed_positive = [name for name, passed in positive.items() if not passed]
        failed_negative = [name for name, passed in negative.items() if not passed]
        failures = failed_positive + failed_negative
        report = structured_stability_report(
            authorization_path,
            consumption_path,
            identity,
            positive,
            negative,
            measured,
            audit,
            failed_positive,
            failed_negative,
        )
        if failures:
            write_json_exclusive(args.report, report)
            write_json_exclusive(args.terminal, structured_stability_terminal(
                "r5_stage4_structured_stability_cpu_regression_failed_closed",
                args,
                failures,
            ))
            return 1

        write_json_exclusive(args.inactive_config, config)
        if sha256_file(args.inactive_config) == identity["sourceInactiveConfigSha256"]:
            raise ValueError("stage4_structured_stability_candidate_must_differ_from_source_config")
        selection["inactiveConfig"] = {
            "path": project_path(args.inactive_config),
            "sha256": sha256_file(args.inactive_config),
        }
        write_json_exclusive(args.selection, selection)
        report["outputs"] = {
            "inactiveConfig": selection["inactiveConfig"],
            "selectionContract": {"path": project_path(args.selection)},
        }
        write_json_exclusive(args.report, report)
        write_json_exclusive(args.contract, structured_stability_support_contract(args, report))
        terminal = structured_stability_terminal(
            "r5_stage4_structured_stability_selected_compiled_cpu_verified_not_active",
            args,
            [],
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
            write_json_exclusive(args.terminal, {
                "schemaVersion": "v7-r5-stage4-structured-stability-terminal-v1",
                "status": "r5_stage4_structured_stability_execution_failed_closed",
                "error": {"type": type(error).__name__, "message": str(error)},
                "failedClosed": True,
                "automaticRetry": False,
                "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                **inactive_boundaries(),
            })
        raise


def validate_structured_stability_authorization(authorization_path: Path, args):
    if not resolved(authorization_path).is_file():
        raise ValueError("stage4_structured_stability_execution_authorization_missing")
    authorization = read_json(authorization_path)
    if (
        authorization.get("schemaVersion") != "v7-r5-stage4-structured-stability-derived-execution-authorization-v1"
        or authorization.get("status") != "derived_from_consumed_immutable_owner_authorization"
        or authorization.get("commandRef") != STRUCTURED_COMMAND_REF
        or authorization.get("scope") != STRUCTURED_SCOPE
    ):
        raise ValueError("stage4_structured_stability_execution_authorization_identity_invalid")
    parent = authorization.get("parentAuthorization", {})
    if (
        parent.get("path") != project_path(STRUCTURED_PARENT_AUTHORIZATION_PATH)
        or parent.get("sha256") != STRUCTURED_PARENT_AUTHORIZATION_SHA256
        or not resolved(STRUCTURED_PARENT_AUTHORIZATION_PATH).is_file()
        or sha256_file(STRUCTURED_PARENT_AUTHORIZATION_PATH) != STRUCTURED_PARENT_AUTHORIZATION_SHA256
    ):
        raise ValueError("stage4_structured_stability_parent_authorization_missing_or_changed")
    parent_consumption = authorization.get("parentImplementationConsumption", {})
    if (
        parent_consumption.get("path") != project_path(STRUCTURED_PARENT_CONSUMPTION_PATH)
        or parent_consumption.get("sha256") != STRUCTURED_PARENT_CONSUMPTION_SHA256
        or not resolved(STRUCTURED_PARENT_CONSUMPTION_PATH).is_file()
        or sha256_file(STRUCTURED_PARENT_CONSUMPTION_PATH) != STRUCTURED_PARENT_CONSUMPTION_SHA256
    ):
        raise ValueError("stage4_structured_stability_parent_consumption_missing_or_changed")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "fixedStageNumber": 4,
        "sampleId": "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "previewEpochs": [1, 5, 10, 20, 30],
        "acceptedDecisionCode": "new_actionable_difference",
        "acceptedNewRootCauseIds": STRUCTURED_ROOT_CAUSES,
        "trainerPath": project_path(TRAINER_PATH),
        "compilerAndCpuCheckerPath": project_path(Path(__file__)),
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_structured_stability_{key}_identity_invalid")
    bindings = (
        (identity.get("analysisTerminalPath"), identity.get("analysisTerminalSha256"), STRUCTURED_ANALYSIS_TERMINAL_SHA256, "analysis_terminal"),
        (identity.get("decisionPath"), identity.get("decisionSha256"), STRUCTURED_DECISION_SHA256, "decision"),
        (identity.get("proposalPath"), identity.get("proposalSha256"), STRUCTURED_PROPOSAL_SHA256, "proposal"),
        (identity.get("analysisCpuRegressionPath"), identity.get("analysisCpuRegressionSha256"), STRUCTURED_ANALYSIS_CPU_SHA256, "analysis_cpu_regression"),
        (identity.get("failureAnalysisPath"), identity.get("failureAnalysisSha256"), STRUCTURED_FAILURE_ANALYSIS_SHA256, "failure_analysis"),
        (identity.get("sourceInactiveConfigPath"), identity.get("sourceInactiveConfigSha256"), "6128bb057c0b935a89cfe58cacd2d1411ace75ad1cf4f58d5a811fbf1b7f8968", "source_config"),
        (identity.get("trainerPath"), identity.get("trainerSha256"), identity.get("trainerSha256"), "trainer"),
        (identity.get("compilerAndCpuCheckerPath"), identity.get("compilerAndCpuCheckerSha256"), identity.get("compilerAndCpuCheckerSha256"), "checker"),
    )
    for raw_path, bound_sha, required_sha, label in bindings:
        if not isinstance(raw_path, str) or not isinstance(bound_sha, str) or bound_sha != required_sha:
            raise ValueError(f"stage4_structured_stability_{label}_binding_invalid")
        path = Path(raw_path)
        if not resolved(path).is_file() or sha256_file(path) != bound_sha:
            raise ValueError(f"stage4_structured_stability_{label}_missing_or_changed")
    allowed = authorization.get("authorizedActions", {})
    for flag in (
        "selectBoundedParameters",
        "compileOneInactiveConfiguration",
        "runOneCpuPositiveNegativeRegression",
        "runOneCompleteConfigurationAudit",
        "saveOutputs",
    ):
        if allowed.get(flag) is not True:
            raise ValueError(f"stage4_structured_stability_{flag}_not_authorized")
    forbidden = authorization.get("forbiddenActions", {})
    for flag in (
        "checkpointReadOrLoad",
        "optimizerCreation",
        "executeBackward",
        "modelWeightMutation",
        "gpuUse",
        "training",
        "validation",
        "formalInference",
        "checkpointPromotion",
        "runtimeFrame",
        "worldEntry",
        "automaticRetry",
    ):
        if forbidden.get(flag) is not True:
            raise ValueError(f"stage4_structured_stability_forbidden_{flag}_not_closed")
    output_paths = authorization.get("outputPaths", {})
    expected_outputs = {
        "inactiveConfig": project_path(args.inactive_config),
        "selectionContract": project_path(args.selection),
        "cpuReport": project_path(args.report),
        "supportContract": project_path(args.contract),
        "terminal": project_path(args.terminal),
    }
    if output_paths != expected_outputs:
        raise ValueError("stage4_structured_stability_output_paths_changed")
    consumption_path = authorization_path.parent / "candidate-execution-consumption.json"
    if not resolved(consumption_path).is_file():
        raise ValueError("stage4_structured_stability_execution_consumption_missing")
    consumption = read_json(consumption_path)
    if (
        consumption.get("status") != "consumed_before_candidate_compilation_and_cpu_regression"
        or consumption.get("authorizationPath") != project_path(authorization_path)
        or consumption.get("authorizationSha256") != sha256_file(authorization_path)
        or consumption.get("commandRef") != STRUCTURED_COMMAND_REF
        or consumption.get("scope") != STRUCTURED_SCOPE
        or consumption.get("candidateCompilationCount") != 1
        or consumption.get("cpuRegressionCount") != 1
        or consumption.get("completeConfigurationAuditCount") != 1
        or consumption.get("gpuExecutionConsumed") is not False
        or consumption.get("backwardExecutionConsumed") is not False
    ):
        raise ValueError("stage4_structured_stability_execution_consumption_invalid")
    return authorization, identity, consumption_path


def select_structured_stability_parameters(authorization_path, consumption_path, identity, analysis, decision):
    timeline = analysis.get("timeline", [])
    if len(timeline) != 5 or [row.get("epoch") for row in timeline] != [1, 5, 10, 20, 30]:
        raise ValueError("stage4_structured_stability_requires_five_epoch_timeline")
    if [bool(row.get("passed")) for row in timeline] != [False, False, False, False, True]:
        raise ValueError("stage4_structured_stability_source_pass_timeline_changed")
    route_codes = {
        "condition_terrain_path_ground_coverage_mismatch",
        "condition_terrain_path_ground_required_boundary_contact_missing",
    }
    route_prevalence = sum(bool(route_codes.intersection(row.get("issueCodes", []))) for row in timeline) / 5
    rock_prevalence = sum(
        "condition_object_rock_reference_semantic_mismatch" in row.get("issueCodes", [])
        for row in timeline
    ) / 5
    if not close(route_prevalence, 0.4) or not close(rock_prevalence, 0.8):
        raise ValueError("stage4_structured_stability_failure_prevalence_changed")
    comparison = decision.get("comparison", {})
    if decision.get("decisionCode") != "new_actionable_difference" or comparison.get("newRootCauseIds") != STRUCTURED_ROOT_CAUSES:
        raise ValueError("stage4_structured_stability_decision_roots_changed")
    selected_values = {
        "trajectoryTailStepCount": {"minimum": 2, "maximum": 3, "failurePrevalence": 0.8, "selectedValue": 3},
        "routeTrajectoryStabilityWeight": {"minimum": 0.05, "maximum": 0.2, "failurePrevalence": route_prevalence, "selectedValue": 0.11},
        "rockTrajectoryStabilityWeight": {"minimum": 0.05, "maximum": 0.25, "failurePrevalence": rock_prevalence, "selectedValue": 0.21},
    }
    return {
        "schemaVersion": "v7-r5-stage4-structured-stability-selection-contract-v1",
        "status": "selected_inactive_not_authorized",
        "candidateVersion": "v7_r5_stage4_structured_stability_candidate_v2",
        "selectionPolicy": "observed_failure_prevalence_linear_mapping_with_existing_weight_caps",
        "reviewThresholdPolicy": "preserved_unchanged_not_used_as_training_target",
        "acceptedDecisionCode": "new_actionable_difference",
        "acceptedNewRootCauseIds": STRUCTURED_ROOT_CAUSES,
        "observedFailurePrevalence": {"routeTopologyUnion": route_prevalence, "objectRock": rock_prevalence},
        "selectedValues": selected_values,
        "lateStabilityQualification": {
            "requiredEpochs": [20, 30],
            "minimumConsecutivePasses": 2,
            "finalEpochMustPass": True,
            "trainingTarget": False,
        },
        "trainingTargetSources": [
            "original_owner_approved_rgb",
            "original_condition_pack",
            "existing_legal_training_supervision",
        ],
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "authorization": {"path": project_path(authorization_path), "sha256": sha256_file(authorization_path)},
        "authorizationConsumption": {"path": project_path(consumption_path), "sha256": sha256_file(consumption_path)},
        "analysis": {"path": identity["failureAnalysisPath"], "sha256": identity["failureAnalysisSha256"]},
        "decision": {"path": identity["decisionPath"], "sha256": identity["decisionSha256"]},
        "proposal": {"path": identity["proposalPath"], "sha256": identity["proposalSha256"]},
        "sourceConfig": {"path": identity["sourceInactiveConfigPath"], "sha256": identity["sourceInactiveConfigSha256"]},
        **inactive_boundaries(),
    }


def compile_structured_stability_inactive_config(source_config, selection, authorization_path, consumption_path):
    config = deepcopy(source_config)
    training = config["training"]
    training["denoiserLossVersion"] = (
        "velocity_decoded_rgb_path_replay_cross_domain_structured_stability_v7_repair_r5_candidate"
    )
    training["r5Stage4StructuredStabilitySelectionEvidence"] = {
        "candidateVersion": selection["candidateVersion"],
        "candidateStatus": "selected_inactive_not_authorized",
        "selectionPolicy": selection["selectionPolicy"],
        "reviewThresholdPolicy": selection["reviewThresholdPolicy"],
        "selectedValues": deepcopy(selection["selectedValues"]),
        "analysisPath": selection["analysis"]["path"],
        "analysisSha256": selection["analysis"]["sha256"],
        "decisionPath": selection["decision"]["path"],
        "decisionSha256": selection["decision"]["sha256"],
        "proposalPath": selection["proposal"]["path"],
        "proposalSha256": selection["proposal"]["sha256"],
        "sourceConfigPath": selection["sourceConfig"]["path"],
        "sourceConfigSha256": selection["sourceConfig"]["sha256"],
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "candidateActive": False,
    }
    training["stage4StructuredTrajectoryStability"] = {
        "enabled": True,
        "status": "candidate_support_not_active",
        "targetSource": "original_owner_approved_rgb_and_condition_pack_only",
        "trajectorySource": "current_cross_domain_gradient_tail_predictions_only",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "tailStepCount": 3,
        "route": {
            "conditionChannel": "terrain_path_ground",
            "lossForm": "original_reference_plus_adjacent_tail_step_consistency",
            "weight": 0.11,
        },
        "rock": {
            "conditionChannel": "object_rock",
            "lossForm": "original_reference_plus_adjacent_tail_step_consistency",
            "weight": 0.21,
        },
    }
    training["stage4LateStabilityQualification"] = {
        "status": "qualification_gate_not_training_target_not_active",
        "requiredEpochs": [20, 30],
        "minimumConsecutivePasses": 2,
        "finalEpochMustPass": True,
        "trainingTarget": False,
        "machineReviewThresholdUsedAsTrainingTarget": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
    }
    previous = training.get("ownerTrainingAuthorization", {})
    training["ownerTrainingAuthorization"] = {
        **previous,
        "authorizationId": authorization_path.parent.name,
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": sha256_file(authorization_path),
        "authorizationCommandRef": STRUCTURED_COMMAND_REF,
        "authorizationScope": STRUCTURED_SCOPE,
        "implementationConsumptionPath": project_path(consumption_path),
        "implementationConsumptionSha256": sha256_file(consumption_path),
        "status": "not_authorized_candidate_only",
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    config["status"] = "r5_stage4_structured_stability_inactive_smoke_config_cpu_verified_not_authorized"
    if config == source_config:
        raise ValueError("stage4_structured_stability_configuration_identical_to_source")
    return config


def late_stability_qualification_passes(review_results, qualification):
    required_epochs = qualification.get("requiredEpochs", [])
    if required_epochs != [20, 30] or qualification.get("minimumConsecutivePasses") != 2:
        return False
    values = [bool(review_results.get(epoch, False)) for epoch in required_epochs]
    return all(values) and (not qualification.get("finalEpochMustPass") or values[-1])


def run_structured_stability_regressions(trainer, source_config, config, identity, selection):
    positive = {}
    negative = {}
    measured = {}
    positive["new_candidate_contract_accepted"] = regression_accepts(
        lambda: trainer.validate_v7_r5_candidate_contract(config)
    )
    positive["structured_stability_contract_accepted"] = regression_accepts(
        lambda: trainer.validate_v7_r5_stage4_structured_stability_candidate_contract(config)
    )
    positive["legacy_cross_domain_source_still_accepted"] = regression_accepts(
        lambda: trainer.validate_v7_r5_stage4_cross_domain_visual_consistency_contract(source_config)
    )
    positive["legacy_stage4_candidate_still_accepted"] = regression_accepts(
        lambda: trainer.validate_v7_r5_candidate_contract(source_config)
    )
    positive["candidate_differs_from_source"] = config != source_config
    positive["sample_seed_and_west_topology_preserved"] = (
        config["training"].get("seed") == identity["seed"]
        and config["training"].get("authorizedOverfitSampleId") == identity["sampleId"]
        and config["training"].get("authorizedBoundaryTopology", {}).get("requiredBoundarySides") == ["west"]
    )
    target = torch.zeros((1, 3, 16, 16), dtype=torch.float32)
    target[:, :, 5:11, :8] = 0.8
    target[:, :, 7:10, 9:13] = 0.35
    conditions = torch.zeros((1, len(config["conditionChannelOrder"]), 16, 16), dtype=torch.float32)
    conditions[:, config["conditionChannelOrder"].index("terrain_path_ground"), 5:11, :8] = 1.0
    conditions[:, config["conditionChannelOrder"].index("object_rock"), 7:10, 9:13] = 1.0
    perfect_steps = [target.clone(), target.clone(), target.clone()]
    perfect_losses = trainer.stage4_cross_domain_trajectory_stability_losses(
        perfect_steps,
        target,
        conditions,
        config,
    )
    perfect_loss = float(perfect_losses["stage4StructuredTrajectoryStabilityWeightedLoss"].detach())
    changed_steps = [target.clone(), target.clone(), target.clone()]
    changed_steps[0][:, :, 5:11, :8] = 0.0
    changed_steps[1][:, :, 7:10, 9:13] = 1.0
    changed_losses = trainer.stage4_cross_domain_trajectory_stability_losses(
        changed_steps,
        target,
        conditions,
        config,
    )
    changed_loss = float(changed_losses["stage4StructuredTrajectoryStabilityWeightedLoss"].detach())
    positive["perfect_original_reference_and_stable_tail_has_zero_loss"] = abs(perfect_loss) < 1e-8
    positive["route_and_rock_tail_instability_raise_loss"] = changed_loss > perfect_loss + 1e-6
    positive["late_two_epoch_consecutive_pass_qualifies"] = late_stability_qualification_passes(
        {20: True, 30: True},
        config["training"]["stage4LateStabilityQualification"],
    )
    positive["selection_uses_original_legal_supervision_only"] = (
        selection["trainingTargetSources"] == [
            "original_owner_approved_rgb",
            "original_condition_pack",
            "existing_legal_training_supervision",
        ]
        and selection["failedPreviewPixelsUsedAsTrainingTargets"] is False
        and selection["machineReviewThresholdUsedAsTrainingTarget"] is False
    )
    measured.update({
        "perfectStructuredStabilityWeightedLoss": perfect_loss,
        "mismatchedStructuredStabilityWeightedLoss": changed_loss,
        "backwardExecutionCount": 0,
        "checkpointReadCount": 0,
        "gpuExecutionCount": 0,
    })
    mutations = {
        "failed_preview_pixels_rejected": ("stage4StructuredTrajectoryStability", "failedPreviewPixelsUsedAsTrainingTargets", True),
        "review_threshold_target_rejected": ("stage4StructuredTrajectoryStability", "machineReviewThresholdUsedAsTrainingTarget", True),
        "tail_step_above_bound_rejected": ("stage4StructuredTrajectoryStability", "tailStepCount", 4),
    }
    for name, (section, key, value) in mutations.items():
        candidate = deepcopy(config)
        candidate["training"][section][key] = value
        negative[name] = regression_rejects(
            lambda candidate=candidate: trainer.validate_v7_r5_stage4_structured_stability_candidate_contract(candidate)
        )
    for name, channel, value in (
        ("route_weight_above_bound_rejected", "route", 0.201),
        ("rock_weight_above_bound_rejected", "rock", 0.251),
    ):
        candidate = deepcopy(config)
        candidate["training"]["stage4StructuredTrajectoryStability"][channel]["weight"] = value
        negative[name] = regression_rejects(
            lambda candidate=candidate: trainer.validate_v7_r5_stage4_structured_stability_candidate_contract(candidate)
        )
    candidate = deepcopy(config)
    candidate["training"]["stage4LateStabilityQualification"]["trainingTarget"] = True
    negative["qualification_training_target_rejected"] = regression_rejects(
        lambda: trainer.validate_v7_r5_stage4_structured_stability_candidate_contract(candidate)
    )
    candidate = deepcopy(config)
    candidate["training"]["stage4LateStabilityQualification"]["requiredEpochs"] = [10, 20, 30]
    negative["wrong_late_window_rejected"] = regression_rejects(
        lambda: trainer.validate_v7_r5_stage4_structured_stability_candidate_contract(candidate)
    )
    candidate = deepcopy(config)
    candidate["training"]["r5Stage4StructuredStabilitySelectionEvidence"]["candidateActive"] = True
    negative["self_activation_rejected"] = regression_rejects(
        lambda: trainer.validate_v7_r5_stage4_structured_stability_candidate_contract(candidate)
    )
    negative["single_final_epoch_pass_not_qualified"] = not late_stability_qualification_passes(
        {20: False, 30: True},
        config["training"]["stage4LateStabilityQualification"],
    )
    audit = {
        "sampleIdentityExact": positive["sample_seed_and_west_topology_preserved"],
        "sourceConfigurationHashExact": sha256_file(Path(identity["sourceInactiveConfigPath"])) == identity["sourceInactiveConfigSha256"],
        "decisionEvidenceHashesExact": all((
            sha256_file(Path(identity["analysisTerminalPath"])) == STRUCTURED_ANALYSIS_TERMINAL_SHA256,
            sha256_file(Path(identity["decisionPath"])) == STRUCTURED_DECISION_SHA256,
            sha256_file(Path(identity["proposalPath"])) == STRUCTURED_PROPOSAL_SHA256,
            sha256_file(Path(identity["analysisCpuRegressionPath"])) == STRUCTURED_ANALYSIS_CPU_SHA256,
        )),
        "contractFieldsExact": positive["structured_stability_contract_accepted"],
        "lateQualificationSeparatedFromTrainingTarget": (
            config["training"]["stage4LateStabilityQualification"]["trainingTarget"] is False
        ),
        "outputRemainsInactive": config["training"]["ownerTrainingAuthorization"]["status"] == "not_authorized_candidate_only",
        "checkpointOptimizerBackwardGpuTrainingAllClosed": all(
            inactive_boundaries()[key] is False
            for key in (
                "checkpointFileRead", "checkpointLoaded", "optimizerCreated", "backwardExecuted",
                "modelWeightsModified", "gpuUsed", "trainingStarted",
            )
        ),
    }
    positive["complete_configuration_audit_passed"] = all(audit.values())
    return positive, negative, measured, audit


def structured_stability_report(
    authorization_path,
    consumption_path,
    identity,
    positive,
    negative,
    measured,
    audit,
    failed_positive,
    failed_negative,
):
    return {
        "schemaVersion": "v7-r5-stage4-structured-stability-cpu-regression-v1",
        "status": (
            "passed_cpu_only_structured_stability_not_active"
            if not failed_positive and not failed_negative
            else "failed_cpu_only_structured_stability_closed"
        ),
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "authorizationPath": project_path(authorization_path),
            "authorizationSha256": sha256_file(authorization_path),
            "executionConsumptionPath": project_path(consumption_path),
            "executionConsumptionSha256": sha256_file(consumption_path),
            "analysisTerminalPath": identity["analysisTerminalPath"],
            "analysisTerminalSha256": identity["analysisTerminalSha256"],
            "decisionPath": identity["decisionPath"],
            "decisionSha256": identity["decisionSha256"],
            "proposalPath": identity["proposalPath"],
            "proposalSha256": identity["proposalSha256"],
            "sourceConfigPath": identity["sourceInactiveConfigPath"],
            "sourceConfigSha256": identity["sourceInactiveConfigSha256"],
            "trainerPath": project_path(TRAINER_PATH),
            "trainerSha256": sha256_file(TRAINER_PATH),
            "checkerPath": project_path(Path(__file__)),
            "checkerSha256": sha256_file(Path(__file__)),
        },
        "positiveRegressions": positive,
        "negativeRegressions": negative,
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "measurements": measured,
        "completeConfigurationAudit": audit,
        "allCpuRegressionsPassed": not failed_positive and not failed_negative,
        "automaticRetry": False,
        **inactive_boundaries(),
    }


def structured_stability_support_contract(args, report):
    return {
        "schemaVersion": "v7-r5-stage4-structured-stability-trainer-support-contract-v1",
        "status": "cpu_verified_structured_stability_support_not_active",
        "candidateVersion": "v7_r5_stage4_structured_stability_candidate_v2",
        "trainerPath": project_path(TRAINER_PATH),
        "trainerSha256": sha256_file(TRAINER_PATH),
        "compilerAndCpuCheckerPath": project_path(Path(__file__)),
        "compilerAndCpuCheckerSha256": sha256_file(Path(__file__)),
        "candidateCpuReportPath": project_path(args.report),
        "candidateCpuReportSha256": sha256_file(args.report),
        "inactiveConfigPath": project_path(args.inactive_config),
        "inactiveConfigSha256": sha256_file(args.inactive_config),
        "selectionContractPath": project_path(args.selection),
        "selectionContractSha256": sha256_file(args.selection),
        "allCpuRegressionsPassed": report["allCpuRegressionsPassed"],
        "lateStabilityQualificationIsTrainingTarget": False,
        "nextIndependentAuthorization": "one_fixed_sample194_west_structured_stability_gpu_smoke_only",
        **inactive_boundaries(),
    }


def structured_stability_terminal(status, args, blockers):
    return {
        "schemaVersion": "v7-r5-stage4-structured-stability-terminal-v1",
        "status": status,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
        "inactiveConfigPath": project_path(args.inactive_config) if resolved(args.inactive_config).exists() else None,
        "inactiveConfigSha256": sha256_file(args.inactive_config) if resolved(args.inactive_config).exists() else None,
        "selectionContractPath": project_path(args.selection) if resolved(args.selection).exists() else None,
        "selectionContractSha256": sha256_file(args.selection) if resolved(args.selection).exists() else None,
        "cpuReportPath": project_path(args.report) if resolved(args.report).exists() else None,
        "cpuReportSha256": sha256_file(args.report) if resolved(args.report).exists() else None,
        "trainerSupportContractPath": project_path(args.contract) if resolved(args.contract).exists() else None,
        "trainerSupportContractSha256": sha256_file(args.contract) if resolved(args.contract).exists() else None,
        "blockers": blockers,
        "automaticRetry": False,
        "fixedOverallProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
        "stage4InternalState": "structured_stability_candidate_cpu_verified_not_active" if not blockers else "structured_stability_candidate_failed_closed",
        **inactive_boundaries(),
    }


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

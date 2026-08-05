from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from train_ai_assisted_conditional_denoiser import (
    validate_v7_r5_stage4_failure_diagnostic_support_contract,
    validate_v7_training_authorization,
)


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-action-request-v7-r5-stage4-diagnostic-parameter-selection-20260805/request.json"
)
AUTHORIZATION_SHA256 = "c18791970ebdb6d6a1d85658ee1b4c512ad9cc69c226938dff55e983af7ea62c"
CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "authorization-consumption.json"
CONSUMPTION_SHA256 = "34cdeb841e0a10bae199cbf66785503c4c147bdd838ce6d9d04477438d586260"
COMMAND_REF = (
    "owner-authorized-v7-r5-stage4-diagnostic-parameter-selection-"
    "inactive-config-cpu-regression-20260805"
)
SCOPE = (
    "select_stage4_bounded_diagnostic_sampling_parameters_compile_inactive_"
    "config_and_cpu_positive_negative_boundaries_only"
)
FAILURE_ANALYSIS_PATH = Path(
    ".runtime/ai-painter/local-ai-failure-learning-r5-stage4/"
    "local-ai-v7-r5-stage4-failure-learning-2026-08-05T10-52-29-779Z/"
    "failure-analysis.json"
)
FAILURE_ANALYSIS_SHA256 = "2c0d25da99335b281fcaf8b30d536243ae533c6b73257922b37feb547cfb0a50"
REPAIR_PROPOSAL_PATH = FAILURE_ANALYSIS_PATH.parent / "read-only-repair-proposal.json"
REPAIR_PROPOSAL_SHA256 = "2a5d311fbf397c0438fa030e12fef21ecfb58c323436ed3c4e682fe15e43b677"
TRAINER_SUPPORT_PATH = Path(
    "data/ai-painter/system-governance/"
    "v7-r5-stage4-failure-diagnostic-trainer-support-contract.json"
)
TRAINER_SUPPORT_SHA256 = "353829111c64619919de872f14f600ee90192f596e96984946ea10d9f5ddc57c"
TRAINER_SUPPORT_TERMINAL_PATH = Path(
    ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-trainer-support/"
    "local-ai-v7-r5-stage4-diagnostic-trainer-support-2026-08-05T11-00-00-000Z/"
    "phase-terminal.json"
)
TRAINER_SUPPORT_TERMINAL_SHA256 = "64a7fb8ce1eb1becc92754c2169dc198fe1967a146a6a054d53e019c846f7781"
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
TRAINER_SHA256 = "836899f6cc596d6555fd5fb7aa18c94ade8ed324b1a4a058d982ecc4412996da"
SOURCE_CONFIG_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/"
    "chains/ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z/"
    "active-config.json"
)
SOURCE_CONFIG_SHA256 = "7a5f66356d8b57a5e927487f20c4807b005b99615f9fc0f76e84e593de3e1583"

FIXED_EPOCHS = [1, 5, 10, 20, 30, 40]
OBJECT_CHANNELS = [
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
]
OBJECT_MEASUREMENTS = ["independent_loss", "gradient_contribution", "decoded_response"]
ROUTE_MEASUREMENTS = ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"]
SELECTION_POLICY = "support_verified_minimal_diagnostic_sampling_with_training_weights_preserved"


def main() -> int:
    parser = ArgumentParser(
        description="Compile an inactive Stage 4 failure-diagnostic configuration without reading a checkpoint."
    )
    parser.add_argument("--output-config", type=Path, required=True)
    parser.add_argument("--output-selection", type=Path, required=True)
    args = parser.parse_args()

    authorization = validate_authorization()
    failure_analysis = read_bound_json(FAILURE_ANALYSIS_PATH, FAILURE_ANALYSIS_SHA256)
    proposal = read_bound_json(REPAIR_PROPOSAL_PATH, REPAIR_PROPOSAL_SHA256)
    trainer_support = read_bound_json(TRAINER_SUPPORT_PATH, TRAINER_SUPPORT_SHA256)
    source_config = read_bound_json(SOURCE_CONFIG_PATH, SOURCE_CONFIG_SHA256)
    selected, rationale = select_bounded_diagnostic_parameters(
        failure_analysis,
        proposal,
        trainer_support,
        source_config,
    )
    config = compile_inactive_config(source_config, selected)
    contract = validate_compiled_inactive_config(source_config, config, selected)
    selection = build_selection_record(
        authorization,
        failure_analysis,
        selected,
        rationale,
        contract,
    )
    write_json_exclusive(args.output_config, config)
    selection["compiledConfig"] = {
        "path": project_path(args.output_config),
        "sha256": sha256_file(args.output_config),
    }
    write_json_exclusive(args.output_selection, selection)
    print(json.dumps(selection, ensure_ascii=False, indent=2))
    return 0


def validate_authorization() -> dict:
    bindings = (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (CONSUMPTION_PATH, CONSUMPTION_SHA256, "consumption"),
        (FAILURE_ANALYSIS_PATH, FAILURE_ANALYSIS_SHA256, "failure_analysis"),
        (REPAIR_PROPOSAL_PATH, REPAIR_PROPOSAL_SHA256, "repair_proposal"),
        (TRAINER_SUPPORT_PATH, TRAINER_SUPPORT_SHA256, "trainer_support"),
        (TRAINER_SUPPORT_TERMINAL_PATH, TRAINER_SUPPORT_TERMINAL_SHA256, "trainer_support_terminal"),
        (TRAINER_PATH, TRAINER_SHA256, "trainer"),
        (SOURCE_CONFIG_PATH, SOURCE_CONFIG_SHA256, "source_config"),
    )
    for path, expected_hash, code in bindings:
        if not (ROOT / path).is_file() or sha256_file(ROOT / path) != expected_hash:
            raise ValueError(f"stage4_diagnostic_parameter_selection_{code}_missing_or_changed")
    authorization = read_json(ROOT / AUTHORIZATION_PATH)
    consumption = read_json(ROOT / CONSUMPTION_PATH)
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("stage4_diagnostic_parameter_selection_authorization_identity_invalid")
    if (
        consumption.get("status") != "consumed_before_authorized_write"
        or consumption.get("authorizationSha256") != AUTHORIZATION_SHA256
        or consumption.get("commandRef") != COMMAND_REF
        or consumption.get("scope") != SCOPE
        or int(consumption.get("allowedExecutionCount", 0)) != 1
        or int(consumption.get("configurationCompilationsAllowed", 0)) != 1
        or int(consumption.get("cpuRegressionExecutionsAllowed", 0)) != 1
    ):
        raise ValueError("stage4_diagnostic_parameter_selection_consumption_identity_invalid")
    identity = authorization.get("taskIdentity", {})
    required_identity = {
        "sourceFailureAnalysisPath": project_path(FAILURE_ANALYSIS_PATH),
        "sourceFailureAnalysisSha256": FAILURE_ANALYSIS_SHA256,
        "repairProposalPath": project_path(REPAIR_PROPOSAL_PATH),
        "repairProposalSha256": REPAIR_PROPOSAL_SHA256,
        "trainerSupportContractPath": project_path(TRAINER_SUPPORT_PATH),
        "trainerSupportContractSha256": TRAINER_SUPPORT_SHA256,
        "trainerPath": project_path(TRAINER_PATH),
        "trainerSha256": TRAINER_SHA256,
        "trainerSupportTerminalPath": project_path(TRAINER_SUPPORT_TERMINAL_PATH),
        "trainerSupportTerminalSha256": TRAINER_SUPPORT_TERMINAL_SHA256,
        "sourceStage4ConfigPath": project_path(SOURCE_CONFIG_PATH),
        "sourceStage4ConfigSha256": SOURCE_CONFIG_SHA256,
    }
    for key, expected in required_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"stage4_diagnostic_parameter_selection_identity_{key}_invalid")
    if identity.get("fixedDiagnosticEpochs") != FIXED_EPOCHS:
        raise ValueError("stage4_diagnostic_parameter_selection_epoch_identity_invalid")
    if identity.get("requiredObjectChannels") != OBJECT_CHANNELS:
        raise ValueError("stage4_diagnostic_parameter_selection_object_identity_invalid")
    if identity.get("requiredRouteMeasurements") != ROUTE_MEASUREMENTS:
        raise ValueError("stage4_diagnostic_parameter_selection_route_identity_invalid")
    resolution = authorization.get("resolution", {})
    for key in (
        "boundedDiagnosticSamplingParameterSelectionAuthorized",
        "inactiveConfigurationCompilationAuthorized",
        "selectionContractStorageAuthorized",
        "cpuPositiveNegativeConfigurationRegressionAuthorized",
        "immutableTerminalStorageAuthorized",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"stage4_diagnostic_parameter_selection_{key}_missing")
    for key in (
        "trainingConfigurationActivationAuthorized",
        "trainingLossWeightSelectionAuthorized",
        "lossWeightModificationAuthorized",
        "reviewThresholdChangeAuthorized",
        "failedPreviewPixelsAsTrainingTargetsAuthorized",
        "checkpointFileReadAuthorized",
        "checkpointDeserializationAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuUseAuthorized",
        "gpuTrainingAuthorized",
        "fullTrainingAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"stage4_diagnostic_parameter_selection_boundary_{key}_invalid")
    return authorization


def select_bounded_diagnostic_parameters(failure_analysis, proposal, trainer_support, source_config):
    validate_selection_sources(failure_analysis, proposal, trainer_support, source_config)
    training = source_config["training"]
    activation = training["pathActivationMassCalibration"]
    topology = training["authorizedBoundaryTopology"]
    selected = {
        "diagnosticEpochs": list(FIXED_EPOCHS),
        "objectChannels": list(OBJECT_CHANNELS),
        "objectMeasurements": list(OBJECT_MEASUREMENTS),
        "objectGradientTarget": "predicted_rgb_only",
        "routeMeasurements": list(ROUTE_MEASUREMENTS),
        "routeSpatialGridSize": 4,
        "routeSpatialGridSizeBounds": {"minimum": 2, "maximum": 16},
        "pathSupportBandRatio": float(activation["supportBandRatio"]),
        "pathAppearanceTemperature": float(activation["appearanceTemperature"]),
        "pathActivationEpsilon": float(activation["epsilon"]),
        "requiredBoundarySides": list(topology["requiredBoundarySides"]),
        "requiredBoundaryBandRatio": float(topology["boundaryBandRatio"]),
    }
    if not 2 <= selected["routeSpatialGridSize"] <= 16:
        raise ValueError("stage4 diagnostic spatial grid selection is outside support bounds")
    rationale = {
        "policy": SELECTION_POLICY,
        "objectFailurePrevalenceByChannel": {channel: 1.0 for channel in OBJECT_CHANNELS},
        "routeCoverageFailurePrevalence": 2 / 6,
        "hydrologyResolvedAfterEpoch": 10,
        "routeSpatialGridSize": "select the CPU-verified 4x4 default within the trainer-supported 2..16 bound",
        "inheritedPathParameters": "preserve the active R5 path support, temperature, epsilon, and required-boundary definitions",
        "trainingWeights": "preserve all object, path, and hydrology training weights; this selection is diagnostic-only",
        "reviewThresholds": "preserve existing machine-review thresholds and never use them as training targets",
    }
    return selected, rationale


def validate_selection_sources(failure_analysis, proposal, trainer_support, source_config):
    if failure_analysis.get("status") != "stage4_six_preview_failures_analyzed_read_only_repair_proposal_ready":
        raise ValueError("stage4 diagnostic selection failure analysis status is invalid")
    summary = failure_analysis.get("summary", {})
    if int(summary.get("previewCount", 0)) != 6 or int(summary.get("failedPreviewCount", 0)) != 6:
        raise ValueError("stage4 diagnostic selection requires all six source previews")
    timeline = failure_analysis.get("timeline", [])
    if [int(row.get("epoch", 0)) for row in timeline] != FIXED_EPOCHS:
        raise ValueError("stage4 diagnostic selection source epochs are invalid")
    if not all(row.get("passed") is False for row in timeline):
        raise ValueError("stage4 diagnostic selection source failure status is invalid")
    clusters = {row.get("issueCode"): row for row in failure_analysis.get("issueClusters", [])}
    for channel in OBJECT_CHANNELS:
        issue_code = f"condition_{channel}_reference_semantic_mismatch"
        cluster = clusters.get(issue_code, {})
        if int(cluster.get("occurrenceCount", 0)) != 6 or cluster.get("presentAtFinal") is not True:
            raise ValueError(f"stage4 diagnostic selection persistent object evidence is invalid: {channel}")
    route_cluster = clusters.get("condition_terrain_path_ground_coverage_mismatch", {})
    if int(route_cluster.get("occurrenceCount", 0)) != 2 or route_cluster.get("presentAtFinal") is not True:
        raise ValueError("stage4 diagnostic selection route terminal evidence is invalid")
    water_clusters = [row for row in failure_analysis.get("issueClusters", []) if row.get("family") == "hydrology_spatial_alignment"]
    if len(water_clusters) != 3 or not all(row.get("resolvedByFinal") is True for row in water_clusters):
        raise ValueError("stage4 diagnostic selection hydrology history is invalid")
    patch = proposal.get("configurationPatchProposal", {})
    bounded = patch.get("boundedParameterSelection", {})
    if (
        proposal.get("status") != "owner_review_required_not_applied"
        or patch.get("status") != "proposal_only_not_applied"
        or bounded.get("status") != "not_selected_requires_separate_evidence_and_owner_authorization"
        or proposal.get("applicationGate", {}).get("applyConfigurationNow") is not False
    ):
        raise ValueError("stage4 diagnostic selection repair proposal boundary is invalid")
    if trainer_support.get("status") != "cpu_verified_diagnostic_support_not_active":
        raise ValueError("stage4 diagnostic selection trainer support is not closed")
    diagnostics = trainer_support.get("diagnostics", {})
    if (
        diagnostics.get("objectChannels") != OBJECT_CHANNELS
        or diagnostics.get("objectMeasurements") != OBJECT_MEASUREMENTS
        or diagnostics.get("routeMeasurements") != ROUTE_MEASUREMENTS
        or diagnostics.get("changesTrainingWeightsNow") is not False
    ):
        raise ValueError("stage4 diagnostic selection trainer support binding is invalid")
    if source_config.get("status") != "owner_authorized_r5_stage4_full_training_active":
        raise ValueError("stage4 diagnostic selection source config status is invalid")


def compile_inactive_config(source_config, selected):
    config = deepcopy(source_config)
    config["status"] = "r5_stage4_diagnostic_parameters_selected_inactive"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training["trainingAuthorizationStatus"] = "not_authorized_diagnostic_candidate_only"
    training["ownerTrainingAuthorization"] = {
        "authorizationId": "owner-action-request-v7-r5-stage4-diagnostic-parameter-selection-20260805",
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "authorizationConsumptionPath": project_path(CONSUMPTION_PATH),
        "authorizationConsumptionSha256": CONSUMPTION_SHA256,
        "status": "not_authorized_diagnostic_candidate_only",
        "checkpointFileReadAuthorized": False,
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "fullTrainingAuthorized": False,
        "automaticRetryAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }
    training["stage4FullTrainingContract"]["status"] = "diagnostic_candidate_inactive"
    training["stage4FailureDiagnostics"] = {
        "enabled": True,
        "status": "diagnostic_support_candidate_not_active",
        "objectSemanticDiagnostics": {
            "channels": list(selected["objectChannels"]),
            "measurements": list(selected["objectMeasurements"]),
            "gradientTarget": selected["objectGradientTarget"],
            "changesTrainingWeightsNow": False,
        },
        "routeLateRegressionDiagnostics": {
            "conditionChannel": "terrain_path_ground",
            "measurements": list(selected["routeMeasurements"]),
            "requiredBoundarySidesSource": "authorizedBoundaryTopology.requiredBoundarySides",
            "preserveExistingPathLossWeights": True,
            "spatialGridSize": selected["routeSpatialGridSize"],
        },
        "parameterSelection": {
            "status": "bounded_diagnostic_sampling_parameters_selected_inactive",
            "selectionPolicy": SELECTION_POLICY,
            "diagnosticEpochs": list(selected["diagnosticEpochs"]),
            "pathSupportBandRatio": selected["pathSupportBandRatio"],
            "pathAppearanceTemperature": selected["pathAppearanceTemperature"],
            "pathActivationEpsilon": selected["pathActivationEpsilon"],
            "requiredBoundarySides": list(selected["requiredBoundarySides"]),
            "requiredBoundaryBandRatio": selected["requiredBoundaryBandRatio"],
        },
        "reviewThresholdsModified": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "executionValuesSelected": False,
        "diagnosticSamplingValuesSelected": True,
        "trainingConfigApplied": False,
        "checkpointFileReadAuthorized": False,
        "gpuUseAuthorized": False,
        "trainingAuthorized": False,
    }
    training["r5Stage4FailureDiagnosticBoundedSelectionEvidence"] = {
        "status": "selected_inactive_not_training_authorized",
        "selectionPolicy": SELECTION_POLICY,
        "failureAnalysisPath": project_path(FAILURE_ANALYSIS_PATH),
        "failureAnalysisSha256": FAILURE_ANALYSIS_SHA256,
        "repairProposalPath": project_path(REPAIR_PROPOSAL_PATH),
        "repairProposalSha256": REPAIR_PROPOSAL_SHA256,
        "trainerSupportContractPath": project_path(TRAINER_SUPPORT_PATH),
        "trainerSupportContractSha256": TRAINER_SUPPORT_SHA256,
        "sourceConfigPath": project_path(SOURCE_CONFIG_PATH),
        "sourceConfigSha256": SOURCE_CONFIG_SHA256,
        "selectedValues": deepcopy(selected),
        "objectTrainingWeightChanges": None,
        "pathTrainingWeightChanges": None,
        "hydrologyTrainingWeightChanges": None,
        "reviewThresholdChanges": None,
        "sourceTrainingConfigModified": False,
        "candidateActive": False,
    }
    return config


def validate_compiled_inactive_config(source_config, config, selected):
    source_training = source_config["training"]
    training = config["training"]
    if config.get("status") != "r5_stage4_diagnostic_parameters_selected_inactive":
        raise ValueError("stage4 diagnostic compiled config is not inactive")
    if training.get("trainingAuthorizationStatus") != "not_authorized_diagnostic_candidate_only":
        raise ValueError("stage4 diagnostic compiled training authorization is not inactive")
    authorization = training.get("ownerTrainingAuthorization", {})
    for key in (
        "checkpointFileReadAuthorized",
        "checkpointLoadingAuthorized",
        "optimizerCreationAuthorized",
        "modelWeightMutationAuthorized",
        "gpuTrainingAuthorizedNow",
        "fullTrainingAuthorized",
        "automaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "validationAuthorized",
        "formalInferenceAuthorized",
        "checkpointPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if authorization.get(key) is not False:
            raise ValueError(f"stage4 diagnostic compiled authorization boundary is invalid: {key}")
    diagnostics = training.get("stage4FailureDiagnostics", {})
    if diagnostics.get("diagnosticSamplingValuesSelected") is not True:
        raise ValueError("stage4 diagnostic sampling values were not recorded")
    parameter_selection = diagnostics.get("parameterSelection", {})
    if parameter_selection.get("diagnosticEpochs") != selected.get("diagnosticEpochs") or selected.get("diagnosticEpochs") != FIXED_EPOCHS:
        raise ValueError("stage4 diagnostic compiled epochs are invalid")
    route_grid_size = int(diagnostics.get("routeLateRegressionDiagnostics", {}).get("spatialGridSize", 0))
    if route_grid_size != int(selected.get("routeSpatialGridSize", 0)) or route_grid_size != 4:
        raise ValueError("stage4 diagnostic compiled spatial grid is invalid")
    if selected.get("routeSpatialGridSizeBounds") != {"minimum": 2, "maximum": 16}:
        raise ValueError("stage4 diagnostic selected spatial grid bounds are invalid")
    selected_parameter_bindings = {
        "pathSupportBandRatio": "pathSupportBandRatio",
        "pathAppearanceTemperature": "pathAppearanceTemperature",
        "pathActivationEpsilon": "pathActivationEpsilon",
        "requiredBoundarySides": "requiredBoundarySides",
        "requiredBoundaryBandRatio": "requiredBoundaryBandRatio",
    }
    for parameter_key, selected_key in selected_parameter_bindings.items():
        if parameter_selection.get(parameter_key) != selected.get(selected_key):
            raise ValueError(f"stage4 diagnostic selected parameter binding is invalid: {selected_key}")
    if training.get("r5Stage4FailureDiagnosticBoundedSelectionEvidence", {}).get("selectedValues") != selected:
        raise ValueError("stage4 diagnostic selection evidence does not match selected values")
    support_contract = validate_v7_r5_stage4_failure_diagnostic_support_contract(config)
    preserved_fields = (
        "denoiserLossWeights",
        "bestCheckpointMetricWeights",
        "rolloutCheckpointMetricWeights",
        "objectSemanticChannelWeights",
        "pathActivationMassCalibration",
        "authorizedBoundaryTopology",
        "shortTrajectoryCoverageDrift",
        "smokeStabilityGate",
        "fixedEpochPreviewPolicy",
        "resolutionStages",
        "denoiserEpochs",
    )
    for key in preserved_fields:
        if training.get(key) != source_training.get(key):
            raise ValueError(f"stage4 diagnostic compiled config changed preserved training field: {key}")
    source_stage4 = source_training.get("stage4FullTrainingContract", {})
    stage4 = training.get("stage4FullTrainingContract", {})
    for key, value in source_stage4.items():
        if key != "status" and stage4.get(key) != value:
            raise ValueError(f"stage4 diagnostic compiled config changed Stage 4 contract field: {key}")
    if stage4.get("status") != "diagnostic_candidate_inactive":
        raise ValueError("stage4 diagnostic compiled Stage 4 contract is not inactive")
    training_rejected = False
    try:
        validate_v7_training_authorization(config, {})
    except (ValueError, FileNotFoundError):
        training_rejected = True
    if not training_rejected:
        raise ValueError("stage4 diagnostic compiled config unexpectedly passed the training gate")
    return {
        "status": "stage4_bounded_diagnostic_parameters_selected_inactive_config_valid",
        "trainerSupport": support_contract,
        "selectedValues": deepcopy(selected),
        "trainingAuthorizationRejected": training_rejected,
        "sourceTrainingWeightsPreserved": True,
        "sourceReviewThresholdsPreserved": True,
    }


def build_selection_record(authorization, failure_analysis, selected, rationale, contract):
    return {
        "schemaVersion": "ai-assisted-v7-r5-stage4-failure-diagnostic-parameter-selection-v1",
        "status": "bounded_diagnostic_sampling_parameters_selected_inactive_config_compiled",
        "selectionPolicy": SELECTION_POLICY,
        "authorization": {
            "path": project_path(AUTHORIZATION_PATH),
            "sha256": AUTHORIZATION_SHA256,
            "commandRef": authorization["ownerDecision"]["commandRef"],
            "scope": authorization["ownerDecision"]["scope"],
        },
        "authorizationConsumption": {
            "path": project_path(CONSUMPTION_PATH),
            "sha256": CONSUMPTION_SHA256,
        },
        "sources": {
            "failureAnalysis": {"path": project_path(FAILURE_ANALYSIS_PATH), "sha256": FAILURE_ANALYSIS_SHA256},
            "repairProposal": {"path": project_path(REPAIR_PROPOSAL_PATH), "sha256": REPAIR_PROPOSAL_SHA256},
            "trainerSupport": {"path": project_path(TRAINER_SUPPORT_PATH), "sha256": TRAINER_SUPPORT_SHA256},
            "sourceConfig": {"path": project_path(SOURCE_CONFIG_PATH), "sha256": SOURCE_CONFIG_SHA256},
        },
        "sourceEvidence": {
            "previewCount": failure_analysis["summary"]["previewCount"],
            "failedPreviewCount": failure_analysis["summary"]["failedPreviewCount"],
            "epochs": list(FIXED_EPOCHS),
        },
        "selectedValues": deepcopy(selected),
        "selectionRationale": rationale,
        "compiledContract": contract,
        "boundaries": boundary_record(),
        "nextIndependentAuthorization": "one_fixed_single_sample_stage4_diagnostic_gpu_smoke_only",
    }


def boundary_record():
    return {
        "sourceTrainingConfigModified": False,
        "inactiveCandidateCompiled": True,
        "candidateActive": False,
        "trainingLossWeightsSelected": False,
        "trainingLossWeightsModified": False,
        "reviewThresholdsModified": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
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


def read_bound_json(path: Path, expected_hash: str):
    full_path = ROOT / path
    if not full_path.is_file() or sha256_file(full_path) != expected_hash:
        raise ValueError(f"bound input is missing or changed: {project_path(path)}")
    return read_json(full_path)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, payload):
    full_path = path if path.is_absolute() else ROOT / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with full_path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256_file(path: Path):
    full_path = path if path.is_absolute() else ROOT / path
    digest = hashlib.sha256()
    with full_path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def project_path(path: Path):
    if not path.is_absolute():
        return path.as_posix()
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()


if __name__ == "__main__":
    raise SystemExit(main())

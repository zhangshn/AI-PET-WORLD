from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
COMPILER_PATH = Path("ml/ai-painter/scripts/compile_ai_assisted_v7_r5_stage4_failure_diagnostic_inactive_config.py")
COMPILER_SHA256 = "03001f7f095c955c80a39392c1098e2060dd6161674b230a8a6d5ef79c757375"
CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_v7_r5_stage4_failure_diagnostic_config_cpu.py")


def main() -> int:
    parser = ArgumentParser(description="CPU-only positive/negative checks for the inactive Stage 4 diagnostic config.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()

    compiler = load_compiler()
    compiler.validate_authorization()
    config = read_json(resolve(args.config))
    selection = read_json(resolve(args.selection))
    source = compiler.read_bound_json(compiler.SOURCE_CONFIG_PATH, compiler.SOURCE_CONFIG_SHA256)
    failure_analysis = compiler.read_bound_json(compiler.FAILURE_ANALYSIS_PATH, compiler.FAILURE_ANALYSIS_SHA256)
    proposal = compiler.read_bound_json(compiler.REPAIR_PROPOSAL_PATH, compiler.REPAIR_PROPOSAL_SHA256)
    trainer_support = compiler.read_bound_json(compiler.TRAINER_SUPPORT_PATH, compiler.TRAINER_SUPPORT_SHA256)
    selected = deepcopy(selection.get("selectedValues", {}))
    compiled_contract = compiler.validate_compiled_inactive_config(source, config, selected)

    positive = positive_assertions(compiler, source, config, selection, selected, compiled_contract, args)
    negative = negative_assertions(
        compiler,
        source,
        config,
        selected,
        failure_analysis,
        proposal,
        trainer_support,
    )
    failures = [key for key, passed in {**positive, **negative}.items() if not passed]
    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage4-failure-diagnostic-config-cpu-regression-v1",
        "status": "passed_cpu_only_inactive_diagnostic_config_not_active" if not failures else "failed_cpu_only_inactive_diagnostic_config",
        "device": "cpu",
        **timestamps("generatedAt"),
        "inputs": {
            "authorizationPath": compiler.project_path(compiler.AUTHORIZATION_PATH),
            "authorizationSha256": compiler.AUTHORIZATION_SHA256,
            "consumptionPath": compiler.project_path(compiler.CONSUMPTION_PATH),
            "consumptionSha256": compiler.CONSUMPTION_SHA256,
            "compilerPath": compiler.project_path(COMPILER_PATH),
            "compilerSha256": COMPILER_SHA256,
            "checkerPath": compiler.project_path(CHECKER_PATH),
            "checkerSha256": sha256_file(resolve(CHECKER_PATH)),
            "configPath": compiler.project_path(args.config),
            "configSha256": sha256_file(resolve(args.config)),
            "selectionPath": compiler.project_path(args.selection),
            "selectionSha256": sha256_file(resolve(args.selection)),
        },
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "selectedValues": selected,
        "compiledContract": compiled_contract,
        "boundaries": compiler.boundary_record(),
    }
    write_json_exclusive(args.report, report)
    if failures:
        terminal = terminal_record(
            "r5_stage4_diagnostic_parameter_selection_cpu_regression_failed_closed",
            failures,
            args,
            report,
        )
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps(terminal, ensure_ascii=False, indent=2))
        return 1

    contract = formal_contract(compiler, args, report)
    write_json_exclusive(args.contract, contract)
    terminal = terminal_record(
        "r5_stage4_bounded_diagnostic_parameters_selected_inactive_config_cpu_verified",
        [],
        args,
        report,
        contract,
    )
    write_json_exclusive(args.terminal, terminal)
    print(
        json.dumps(
            {
                **terminal,
                "terminalPath": project_path(args.terminal),
                "terminalSha256": sha256_file(resolve(args.terminal)),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def positive_assertions(compiler, source, config, selection, selected, contract, args):
    source_training = source["training"]
    training = config["training"]
    diagnostic = training["stage4FailureDiagnostics"]
    authorization = training["ownerTrainingAuthorization"]
    stage4 = training["stage4FullTrainingContract"]
    boundary_false = all(
        value is False
        for key, value in compiler.boundary_record().items()
        if key not in ("inactiveCandidateCompiled",)
    )
    return {
        "authorizationAndConsumptionBound": True,
        "compilerHashBound": sha256_file(resolve(COMPILER_PATH)) == COMPILER_SHA256,
        "compiledConfigHashBound": selection.get("compiledConfig", {}).get("path") == project_path(args.config)
        and selection.get("compiledConfig", {}).get("sha256") == sha256_file(resolve(args.config)),
        "inactiveTopLevelStatus": config.get("status") == "r5_stage4_diagnostic_parameters_selected_inactive",
        "inactiveTrainingAuthorizationStatus": training.get("trainingAuthorizationStatus") == "not_authorized_diagnostic_candidate_only",
        "trainerDiagnosticSupportAccepted": contract.get("trainerSupport", {}).get("status") == "r5_stage4_failure_diagnostic_support_contract_valid_not_active",
        "fixedSixEpochsSelected": selected.get("diagnosticEpochs") == compiler.FIXED_EPOCHS,
        "fourPersistentObjectChannelsSelected": selected.get("objectChannels") == compiler.OBJECT_CHANNELS,
        "objectMeasurementsBound": selected.get("objectMeasurements") == compiler.OBJECT_MEASUREMENTS,
        "routeMeasurementsBound": selected.get("routeMeasurements") == compiler.ROUTE_MEASUREMENTS,
        "routeSpatialGridWithinBounds": selected.get("routeSpatialGridSizeBounds") == {"minimum": 2, "maximum": 16}
        and 2 <= int(selected.get("routeSpatialGridSize", 0)) <= 16,
        "cpuVerifiedFourByFourGridSelected": int(selected.get("routeSpatialGridSize", 0)) == 4,
        "objectTrainingWeightsPreserved": training.get("objectSemanticChannelWeights") == source_training.get("objectSemanticChannelWeights"),
        "pathTrainingWeightsPreserved": training.get("denoiserLossWeights", {}).get("pathInteriorRgb") == source_training.get("denoiserLossWeights", {}).get("pathInteriorRgb")
        and training.get("denoiserLossWeights", {}).get("pathForbiddenBoundaryRgb") == source_training.get("denoiserLossWeights", {}).get("pathForbiddenBoundaryRgb"),
        "checkpointMetricWeightsPreserved": training.get("bestCheckpointMetricWeights") == source_training.get("bestCheckpointMetricWeights"),
        "rolloutMetricWeightsPreserved": training.get("rolloutCheckpointMetricWeights") == source_training.get("rolloutCheckpointMetricWeights"),
        "pathCalibrationContractPreserved": training.get("pathActivationMassCalibration") == source_training.get("pathActivationMassCalibration"),
        "trajectoryDriftContractPreserved": training.get("shortTrajectoryCoverageDrift") == source_training.get("shortTrajectoryCoverageDrift"),
        "reviewGatePreserved": training.get("smokeStabilityGate") == source_training.get("smokeStabilityGate"),
        "datasetSplitPreserved": {key: stage4.get(key) for key in ("datasetCapacityCount", "splitCounts")}
        == {key: source_training["stage4FullTrainingContract"].get(key) for key in ("datasetCapacityCount", "splitCounts")},
        "resolutionAndEpochStagesPreserved": stage4.get("stages") == source_training["stage4FullTrainingContract"].get("stages"),
        "trainingGateRejectsCandidate": contract.get("trainingAuthorizationRejected") is True,
        "allExecutionBoundariesClosed": boundary_false,
        "failedPreviewPixelsRemainExcluded": diagnostic.get("failedPreviewPixelsUsedAsTrainingTargets") is False,
        "sourceConfigHashUnchanged": sha256_file(resolve(compiler.SOURCE_CONFIG_PATH)) == compiler.SOURCE_CONFIG_SHA256,
        "checkpointAndGpuAuthorizationFalse": all(
            authorization.get(key) is False
            for key in (
                "checkpointFileReadAuthorized",
                "checkpointLoadingAuthorized",
                "optimizerCreationAuthorized",
                "modelWeightMutationAuthorized",
                "gpuTrainingAuthorizedNow",
                "fullTrainingAuthorized",
            )
        ),
    }


def negative_assertions(compiler, source, config, selected, analysis, proposal, trainer_support):
    return {
        "topLevelActivationRejected": reject_config(compiler, source, config, selected, lambda c, s: c.__setitem__("status", "active")),
        "trainingAuthorizationActivationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"].__setitem__("trainingAuthorizationStatus", "owner_authorized")),
        "checkpointReadAuthorizationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["ownerTrainingAuthorization"].__setitem__("checkpointFileReadAuthorized", True)),
        "checkpointLoadAuthorizationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["ownerTrainingAuthorization"].__setitem__("checkpointLoadingAuthorized", True)),
        "optimizerAuthorizationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["ownerTrainingAuthorization"].__setitem__("optimizerCreationAuthorized", True)),
        "gpuAuthorizationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["ownerTrainingAuthorization"].__setitem__("gpuTrainingAuthorizedNow", True)),
        "fullTrainingAuthorizationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["ownerTrainingAuthorization"].__setitem__("fullTrainingAuthorized", True)),
        "stage4ContractActivationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FullTrainingContract"].__setitem__("status", "active_single_execution")),
        "objectWeightMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["objectSemanticChannelWeights"].__setitem__("object_tree", 1.5)),
        "pathInteriorWeightMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["denoiserLossWeights"].__setitem__("pathInteriorRgb", 2.5)),
        "pathForbiddenWeightMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["denoiserLossWeights"].__setitem__("pathForbiddenBoundaryRgb", 2.5)),
        "pathCalibrationMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["pathActivationMassCalibration"].__setitem__("weight", 0.7)),
        "trajectoryWeightMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["shortTrajectoryCoverageDrift"].__setitem__("weight", 0.3)),
        "reviewGateMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["smokeStabilityGate"].__setitem__("requireAllMachineReviewsPassed", False)),
        "failedPreviewTargetRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"].__setitem__("failedPreviewPixelsUsedAsTrainingTargets", True)),
        "missingDiagnosticEpochRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"]["parameterSelection"].__setitem__("diagnosticEpochs", [1, 5, 10, 20, 30])),
        "objectChannelRemovalRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"]["objectSemanticDiagnostics"].__setitem__("channels", compiler.OBJECT_CHANNELS[:-1])),
        "objectMeasurementRemovalRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"]["objectSemanticDiagnostics"].__setitem__("measurements", compiler.OBJECT_MEASUREMENTS[:-1])),
        "routeMeasurementRemovalRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"]["routeLateRegressionDiagnostics"].__setitem__("measurements", compiler.ROUTE_MEASUREMENTS[:-1])),
        "routeGridBelowBoundRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"]["routeLateRegressionDiagnostics"].__setitem__("spatialGridSize", 1)),
        "routeGridAboveBoundRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["stage4FailureDiagnostics"]["routeLateRegressionDiagnostics"].__setitem__("spatialGridSize", 17)),
        "pathSupportBandMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["pathActivationMassCalibration"].__setitem__("supportBandRatio", 0.08)),
        "appearanceTemperatureMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["pathActivationMassCalibration"].__setitem__("appearanceTemperature", 0.4)),
        "activationEpsilonMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["pathActivationMassCalibration"].__setitem__("epsilon", 0.001)),
        "requiredBoundaryRemovalRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["authorizedBoundaryTopology"].__setitem__("requiredBoundarySides", [])),
        "boundaryBandMutationRejected": reject_config(compiler, source, config, selected, lambda c, s: c["training"]["authorizedBoundaryTopology"].__setitem__("boundaryBandRatio", 0.08)),
        "selectionGridMismatchRejected": reject_config(compiler, source, config, selected, lambda c, s: s.__setitem__("routeSpatialGridSize", 8)),
        "sourceEpochMutationRejected": reject_sources(compiler, analysis, proposal, trainer_support, source, lambda a: a["timeline"][0].__setitem__("epoch", 2)),
        "sourceObjectPrevalenceMutationRejected": reject_sources(compiler, analysis, proposal, trainer_support, source, lambda a: a["issueClusters"][0].__setitem__("occurrenceCount", 5)),
        "sourceHydrologyResolutionMutationRejected": reject_sources(compiler, analysis, proposal, trainer_support, source, mark_hydrology_unresolved),
    }


def reject_config(compiler, source, config, selected, mutate):
    candidate = deepcopy(config)
    candidate_selected = deepcopy(selected)
    mutate(candidate, candidate_selected)
    try:
        compiler.validate_compiled_inactive_config(source, candidate, candidate_selected)
    except (ValueError, FileNotFoundError):
        return True
    return False


def reject_sources(compiler, analysis, proposal, trainer_support, source, mutate):
    candidate = deepcopy(analysis)
    mutate(candidate)
    try:
        compiler.select_bounded_diagnostic_parameters(candidate, proposal, trainer_support, source)
    except ValueError:
        return True
    return False


def mark_hydrology_unresolved(analysis):
    for cluster in analysis["issueClusters"]:
        if cluster.get("family") == "hydrology_spatial_alignment":
            cluster["resolvedByFinal"] = False
            return


def formal_contract(compiler, args, report):
    return {
        "schemaVersion": "v7-r5-stage4-failure-diagnostic-inactive-config-selection-contract-v1",
        "status": "cpu_verified_bounded_diagnostic_parameters_selected_inactive",
        "generatedBy": "local_ai_stage4_diagnostic_parameter_selection_program",
        "authorization": {
            "path": compiler.project_path(compiler.AUTHORIZATION_PATH),
            "sha256": compiler.AUTHORIZATION_SHA256,
        },
        "authorizationConsumption": {
            "path": compiler.project_path(compiler.CONSUMPTION_PATH),
            "sha256": compiler.CONSUMPTION_SHA256,
        },
        "compiledConfig": {
            "path": project_path(args.config),
            "sha256": sha256_file(resolve(args.config)),
        },
        "selection": {
            "path": project_path(args.selection),
            "sha256": sha256_file(resolve(args.selection)),
        },
        "cpuRegression": {
            "path": project_path(args.report),
            "sha256": sha256_file(resolve(args.report)),
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        },
        "selectedValues": report["selectedValues"],
        "activationGate": {
            "status": "not_active_requires_separate_fixed_single_sample_diagnostic_smoke_authorization",
            "trainingLossWeightsSelected": False,
            "checkpointFileRead": False,
            "optimizerCreation": False,
            "gpuUse": False,
            "training": False,
        },
    }


def terminal_record(status, blockers, args, report, contract=None):
    record = {
        "schemaVersion": "v7-r5-stage4-diagnostic-parameter-selection-terminal-v1",
        "status": status,
        **timestamps("recordedAt"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(resolve(args.report)),
        "compiledConfigPath": project_path(args.config),
        "compiledConfigSha256": sha256_file(resolve(args.config)),
        "selectionPath": project_path(args.selection),
        "selectionSha256": sha256_file(resolve(args.selection)),
        "positiveAssertionsPassed": report["positiveAssertionsPassed"],
        "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        "blockers": blockers,
        "nextIndependentAuthorization": "one_fixed_single_sample_stage4_diagnostic_gpu_smoke_only" if not blockers else "diagnostic_config_failure_review_only",
        **report["boundaries"],
    }
    if contract is not None:
        record["contractPath"] = project_path(args.contract)
        record["contractSha256"] = sha256_file(resolve(args.contract))
    return record


def load_compiler():
    if not resolve(COMPILER_PATH).is_file() or sha256_file(resolve(COMPILER_PATH)) != COMPILER_SHA256:
        raise ValueError("stage4 diagnostic config compiler is missing or changed")
    spec = importlib.util.spec_from_file_location("stage4_diagnostic_config_compiler", resolve(COMPILER_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("stage4 diagnostic config compiler import failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def timestamps(prefix):
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
    }


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, payload):
    full_path = resolve(path)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with full_path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve(path: Path):
    return path if path.is_absolute() else ROOT / path


def project_path(path: Path):
    full_path = resolve(path)
    try:
        return full_path.relative_to(ROOT).as_posix()
    except ValueError:
        return full_path.resolve().relative_to(ROOT.resolve()).as_posix()


if __name__ == "__main__":
    raise SystemExit(main())

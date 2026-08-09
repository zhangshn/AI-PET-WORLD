from __future__ import annotations

from argparse import ArgumentParser
import ast
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import traceback

from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import run_ai_assisted_v9_r5_stage4_gradient_diagnostic as runner
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--attestation", type=Path, required=True)
    args = parser.parse_args()
    report_path = runner.resolve(args.report)
    attestation_path = runner.resolve(args.attestation)
    try:
        authorization = runner.validate_authorization(args.authorization)
        if report_path != runner.resolve(Path(authorization["implementation"]["cpuReportPath"])):
            raise ValueError("v9_diagnostic_cpu_report_output_invalid")
        if attestation_path != runner.resolve(Path(authorization["implementation"]["implementationAttestationPath"])):
            raise ValueError("v9_diagnostic_attestation_output_invalid")
        if report_path.exists() or attestation_path.exists():
            raise FileExistsError("v9_diagnostic_cpu_output_already_exists")
        positive, negative, evidence = run_regressions(authorization)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-cpu-report-v1",
            "status": (
                "passed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
                if not failed_positive and not failed_negative
                else "failed_closed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
            ),
            **timestamps("recordedAt"),
            "authorization": runner.binding(args.authorization),
            "implementationConsumption": runner.binding(runner.IMPLEMENTATION_CONSUMPTION_PATH),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "evidence": evidence,
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        runner.write_json_exclusive(report_path, report)
        if failed_positive or failed_negative:
            raise ValueError(f"V9 diagnostic CPU regression failed: {failed_positive}:{failed_negative}")
        attestation = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-implementation-attestation-v1",
            "status": "v9_gpu_diagnostic_implementation_cpu_verified",
            **timestamps("recordedAt"),
            "requestId": runner.REQUEST_ID,
            "authorizationSha256": runner.AUTHORIZATION_SHA256,
            "runnerPath": runner.project_path(runner.RUNNER_PATH),
            "runnerSha256": runner.sha256_file(runner.resolve(runner.RUNNER_PATH)),
            "cpuCheckerPath": runner.project_path(runner.CPU_CHECKER_PATH),
            "cpuCheckerSha256": runner.sha256_file(runner.resolve(runner.CPU_CHECKER_PATH)),
            "cpuReportPath": runner.project_path(report_path),
            "cpuReportSha256": runner.sha256_file(report_path),
            "gpuExecutionAuthorizedByOwnerCommand": True,
            "gpuExecutionConsumed": False,
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "trainingStarted": False,
        }
        runner.write_json_exclusive(attestation_path, attestation)
        print(json.dumps({
            "status": attestation["status"],
            "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
            "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
            "report": runner.binding(report_path),
            "attestation": runner.binding(attestation_path),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not report_path.exists():
            failure = {
                "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-cpu-report-v1",
                "status": "failed_closed_v9_readonly_gpu_diagnostic_cpu_authorization_regression",
                **timestamps("recordedAt"),
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "checkpointRead": False,
                "optimizerCreated": False,
                "backwardMethodExecuted": False,
                "modelWeightsModified": False,
                "gpuUsed": False,
                "trainingStarted": False,
                "automaticRetryStarted": False,
            }
            runner.write_json_exclusive(report_path, failure)
        print(json.dumps(runner.read_json(report_path), ensure_ascii=False, indent=2))
        return 1


def run_regressions(authorization: dict):
    runner.validate_authorization_document(authorization, verify_bindings=True)
    config = runner.read_json(runner.resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
    package = runner.read_json(runner.resolve(runner.DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    dataset = AiAssistedConditionalDenoiserDataset(
        runner.DATASET_PATH,
        runner.SAMPLE_SPLIT,
        list(config["conditionChannelOrder"]),
        runner.IMAGE_SIZE,
        selection_contract=trainer.conditional_dataset_selection_contract(config),
    )
    occurrences = [row.get("sampleId") for row in dataset.rows if row.get("sampleId") == runner.SAMPLE_ID]
    source_index = runner.read_json(runner.resolve(Path(authorization["bindings"]["datasetSourceIndex"]["path"])))
    source_matches = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == runner.SAMPLE_ID and row.get("v7CapacityContributionRegistered") is True
    ]
    source_text = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    source_contract = inspect_source_contract(source_text)
    implementation_consumption = runner.read_json(runner.resolve(runner.IMPLEMENTATION_CONSUMPTION_PATH))
    output_path = runner.resolve(Path(authorization["execution"]["outputDirectory"]))
    gpu_consumption_path = runner.resolve(Path(authorization["execution"]["gpuConsumptionPath"]))
    positive = {
        "ownerAuthorizationIdentityValid": True,
        "implementationAuthorizationConsumedOnce": implementation_consumption.get("oneTimeConsumption") is True,
        "v9CpuTerminalBound": authorization["bindings"]["v9CpuTerminal"]["sha256"] == "7094094dc750b35694516f7fd6f2b22dca642d7f7a0de4aff8dc773dfc95e02e",
        "v9InactiveConfigBound": authorization["bindings"]["v9InactiveConfig"]["sha256"] == "e4a90350ea1263bcef0a90ba36491f4a9477c8886aeac4ae0f44b846f1e4bef6",
        "v9CpuReportBound": authorization["bindings"]["v9CpuReport"]["sha256"] == "5b7548a53a85addb82fd6701dcf878735c688fd049a821b67d72f38a1158e961",
        "v9SupportContractBound": authorization["bindings"]["v9SupportContract"]["sha256"] == "961c18c7f84d73ea5a954170fc2a7804e692872469dfe28b0395d75c367b2538",
        "autoencoderCheckpointIdentityBound": authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"] == "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
        "v9ContractValidatedInactive": True,
        "sample194UniqueValidation": occurrences == [runner.SAMPLE_ID] and len(source_matches) == 1 and source_matches[0].get("split") == "validation",
        "fixedTaskIdentity": authorization["taskIdentity"] == {
            **authorization["taskIdentity"],
            "sampleId": runner.SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "timestep": 999,
            "resolution": {"width": 256, "height": 192},
            "requiredBoundarySides": ["west"],
        },
        "exact17MetricContract": config["training"]["stage4ObjectSemanticDecoderAlignment"]["diagnosticManifestRegistry"]["exactFields"] == list(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
        "outputDirectoryNotCreatedBeforeGpu": not output_path.exists(),
        "gpuConsumptionNotCreatedBeforePreflight": not gpu_consumption_path.exists(),
        "runnerHasNoBackwardCall": source_contract["backwardCallCount"] == 0,
        "runnerHasNoOptimizerConstruction": source_contract["optimizerReferenceCount"] == 0,
        "runnerHasNoCheckpointWrite": source_contract["torchSaveCallCount"] == 0,
        "runnerOnlyLoadsProjectAutoencoder": source_contract["autoencoderLoaderCount"] == 1 and source_contract["denoiserCheckpointLoaderCount"] == 0,
        "authorizationConsumptionBeforeGpuRun": source_text.index("write_json_exclusive(consumption_path, consumption)") < source_text.index("return run_gpu("),
        "autoencoderReadOccursInsideConsumedGpuRun": source_text.index("checkpoint = trainer.load_autoencoder_checkpoint") > source_text.index("def run_gpu("),
        "cudaInitOccursInsideConsumedGpuRun": source_text.index("torch.cuda.init()") > source_text.index("def run_gpu("),
        "parameterHashVerificationImplemented": "v9_diagnostic_model_state_changed" in source_text,
        "exact17RegistrationImplemented": "register_v9_stage4_diagnostic_manifest_fields" in source_text,
        "failureClosesWithoutRetry": "automaticRetryStarted\": False" in source_text,
    }
    negative = {
        "rejectWrongRequestId": rejects(authorization, lambda value: value.__setitem__("requestId", "wrong")),
        "rejectWrongScope": rejects(authorization, lambda value: value["ownerDecision"].__setitem__("scope", "wrong")),
        "rejectWrongArchitecture": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("architectureId", "v8")),
        "rejectWrongSample": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("sampleId", "wrong")),
        "rejectTrainReclassification": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("seed", 1)),
        "rejectWrongTimestep": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("timestep", 998)),
        "rejectWrongResolution": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("resolution", {"width": 512, "height": 384})),
        "rejectWrongTopology": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("requiredBoundarySides", ["east"])),
        "rejectWrongMetricCount": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 16)),
        "rejectOldDenoiserRead": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("oldV7OrV8DenoiserCheckpointReadOrLoad", True)),
        "rejectOptimizer": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("optimizerCreation", True)),
        "rejectBackwardMethod": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("backwardMethodExecution", True)),
        "rejectWeightMutation": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("modelWeightModification", True)),
        "rejectCheckpointWrite": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("checkpointWrite", True)),
        "rejectSmoke": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("smoke", True)),
        "rejectFullTraining": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("stage4FullTraining", True)),
        "rejectAutomaticRetry": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("automaticRetry", True)),
        "rejectFailurePolicyRetry": rejects(authorization, lambda value: value["failurePolicy"].__setitem__("automaticRetry", True)),
        "rejectUnknownAction": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("startTrainingNow", True)),
        "rejectAutoencoderReadClosed": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("projectAutoencoderCheckpointReadAndLoad", False)),
        "rejectRuntimeFrame": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("runtimeFrame", True)),
        "rejectWorldEntry": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("worldEntry", True)),
        "rejectTamperedBoundConfig": binding_rejects(authorization, "v9InactiveConfig"),
        "rejectTamperedAutoencoderIdentity": binding_rejects(authorization, "projectAutoencoderCheckpoint"),
    }
    evidence = {
        "sample194ValidationOccurrences": len(occurrences),
        "sourceIndexSample194Matches": len(source_matches),
        "sourceContract": source_contract,
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "outputDirectoryExists": output_path.exists(),
        "gpuConsumptionExists": gpu_consumption_path.exists(),
        "checkpointRead": False,
        "gpuUsed": False,
    }
    return positive, negative, evidence


def inspect_source_contract(source_text: str) -> dict:
    tree = ast.parse(source_text)
    backward_calls = 0
    optimizer_references = 0
    torch_save_calls = 0
    autoencoder_loaders = 0
    denoiser_loaders = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == "backward":
                backward_calls += 1
            if node.func.attr == "save" and isinstance(node.func.value, ast.Name) and node.func.value.id == "torch":
                torch_save_calls += 1
            if node.func.attr == "load_autoencoder_checkpoint":
                autoencoder_loaders += 1
            if "denoiser" in node.func.attr.lower() and "checkpoint" in node.func.attr.lower():
                denoiser_loaders += 1
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "torch" and node.attr == "optim":
            optimizer_references += 1
    return {
        "backwardCallCount": backward_calls,
        "optimizerReferenceCount": optimizer_references,
        "torchSaveCallCount": torch_save_calls,
        "autoencoderLoaderCount": autoencoder_loaders,
        "denoiserCheckpointLoaderCount": denoiser_loaders,
    }


def rejects(authorization: dict, mutation) -> bool:
    candidate = deepcopy(authorization)
    mutation(candidate)
    try:
        runner.validate_authorization_document(candidate, verify_bindings=False)
    except (ValueError, FileNotFoundError, PermissionError):
        return True
    return False


def binding_rejects(authorization: dict, key: str) -> bool:
    candidate = deepcopy(authorization)
    candidate["bindings"][key]["sha256"] = "0" * 64
    try:
        runner.validate_authorization_document(candidate, verify_bindings=True)
    except (ValueError, FileNotFoundError, PermissionError):
        return True
    return False


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())

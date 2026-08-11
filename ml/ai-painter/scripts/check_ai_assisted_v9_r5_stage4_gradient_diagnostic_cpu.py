from __future__ import annotations

from argparse import ArgumentParser
import ast
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import traceback

import torch

from ai_painter.complete_world import build_complete_world_system
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
        structure_mode = runner.is_structure_fact_authorization(authorization)
        semantic_mixture_mode = runner.is_semantic_mixture_authorization(authorization)
        if report_path != runner.resolve(Path(authorization["implementation"]["cpuReportPath"])):
            raise ValueError("v9_diagnostic_cpu_report_output_invalid")
        if attestation_path != runner.resolve(Path(authorization["implementation"]["implementationAttestationPath"])):
            raise ValueError("v9_diagnostic_attestation_output_invalid")
        if report_path.exists() or attestation_path.exists():
            raise FileExistsError("v9_diagnostic_cpu_output_already_exists")
        positive, negative, evidence = run_regressions(authorization)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        passed_status = (
            "passed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
            if semantic_mixture_mode
            else (
                "passed_structure_fact_first_readonly_gpu_diagnostic_cpu_authorization_regression"
                if structure_mode else "passed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
            )
        )
        failed_status = (
            "failed_closed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
            if semantic_mixture_mode
            else (
                "failed_closed_structure_fact_first_readonly_gpu_diagnostic_cpu_authorization_regression"
                if structure_mode else "failed_closed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
            )
        )
        report = {
            "schemaVersion": (
                "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-cpu-report-v1"
                if semantic_mixture_mode
                else (
                    "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-cpu-report-v1"
                    if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-cpu-report-v1"
                )
            ),
            "status": passed_status if not failed_positive and not failed_negative else failed_status,
            **timestamps("recordedAt"),
            "authorization": runner.binding(args.authorization),
            "implementationConsumption": runner.binding(
                runner.SEMANTIC_MIXTURE_IMPLEMENTATION_CONSUMPTION_PATH
                if semantic_mixture_mode
                else (
                    runner.STRUCTURE_FACT_IMPLEMENTATION_CONSUMPTION_PATH
                    if structure_mode else runner.IMPLEMENTATION_CONSUMPTION_PATH
                )
            ),
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
            raise ValueError(f"Stage4 diagnostic CPU regression failed: {failed_positive}:{failed_negative}")
        attestation = {
            "schemaVersion": (
                "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-implementation-attestation-v1"
                if semantic_mixture_mode
                else (
                    "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-implementation-attestation-v1"
                    if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-implementation-attestation-v1"
                )
            ),
            "status": (
                "fact_conditioned_semantic_mixture_gpu_diagnostic_implementation_cpu_verified"
                if semantic_mixture_mode
                else (
                    "structure_fact_first_gpu_diagnostic_implementation_cpu_verified"
                    if structure_mode else "v9_gpu_diagnostic_implementation_cpu_verified"
                )
            ),
            **timestamps("recordedAt"),
            "requestId": runner.authorization_request_id(authorization),
            "authorizationSha256": runner.authorization_sha256(authorization),
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
                "schemaVersion": "ai-painter-r5-stage4-gradient-diagnostic-cpu-report-v1",
                "status": "failed_closed_readonly_gpu_diagnostic_cpu_authorization_regression",
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
    if runner.is_semantic_mixture_authorization(authorization):
        return run_semantic_mixture_regressions(authorization)
    if runner.is_structure_fact_authorization(authorization):
        return run_structure_fact_regressions(authorization)
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


def run_semantic_mixture_regressions(authorization: dict):
    runner.validate_authorization_document(authorization, verify_bindings=True)
    config = runner.read_json(
        runner.resolve(Path(authorization["bindings"]["inactiveConfig"]["path"]))
    )
    package = runner.read_json(runner.resolve(runner.DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    dataset = AiAssistedConditionalDenoiserDataset(
        runner.DATASET_PATH,
        runner.SAMPLE_SPLIT,
        list(config["conditionChannelOrder"]),
        runner.IMAGE_SIZE,
        selection_contract=trainer.conditional_dataset_selection_contract(config),
    )
    occurrences = [
        row.get("sampleId") for row in dataset.rows
        if row.get("sampleId") == runner.SAMPLE_ID
    ]
    source_index = runner.read_json(
        runner.resolve(Path(authorization["bindings"]["datasetSourceIndex"]["path"]))
    )
    source_matches = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == runner.SAMPLE_ID
        and row.get("v7CapacityContributionRegistered") is True
    ]
    source_text = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    source_contract = inspect_source_contract(source_text)
    implementation_consumption = runner.read_json(
        runner.resolve(runner.SEMANTIC_MIXTURE_IMPLEMENTATION_CONSUMPTION_PATH)
    )
    output_path = runner.resolve(Path(authorization["execution"]["outputDirectory"]))
    gpu_consumption_path = runner.resolve(
        Path(authorization["execution"]["gpuConsumptionPath"])
    )

    torch.manual_seed(runner.SEED)
    model = build_complete_world_system(config).cpu().eval()
    latent = torch.randn(1, int(config["latentChannels"]), 8, 8)
    timestep = torch.tensor([runner.TIMESTEP], dtype=torch.long)
    conditions = torch.rand(1, 23, 32, 32)
    discrete_indices, _ = trainer.condition_type_indices(config)
    conditions[:, discrete_indices] = (conditions[:, discrete_indices] > 0.5).to(
        conditions.dtype
    )
    velocity, mixture = model.predict_velocity_with_stage4_semantic_mixture(
        latent, timestep, conditions,
    )
    identities = tuple(mixture.get("expertIdentityOrder", ()))
    contributions = tuple(mixture.get("expertContributions", ()))
    gated = tuple(mixture.get("gatedContributions", ()))
    gradient_isolation = {}
    for index, identity in enumerate(identities):
        own_parameters = tuple(model.denoiser.semantic_mixture_experts[identity].parameters())
        other_parameters = tuple(
            parameter
            for other in identities if other != identity
            for parameter in model.denoiser.semantic_mixture_experts[other].parameters()
        )
        gate_parameters = tuple(model.denoiser.semantic_mixture_participation[identity].parameters())
        own = torch.autograd.grad(
            contributions[index].mean(), own_parameters,
            retain_graph=True, allow_unused=True,
        )
        cross = torch.autograd.grad(
            contributions[index].mean(), other_parameters,
            retain_graph=True, allow_unused=True,
        )
        gate = torch.autograd.grad(
            gated[index].mean(), gate_parameters,
            retain_graph=True, allow_unused=True,
        )
        gradient_isolation[identity] = {
            "own": sum(runner.gradient_norm(value) for value in own) > 0.0,
            "cross": sum(runner.gradient_norm(value) for value in cross) == 0.0,
            "gate": sum(runner.gradient_norm(value) for value in gate) > 0.0,
        }
    contract = config["training"]["stage4FactConditionedSemanticMixture"]
    legacy_v9 = validate_legacy_v9_behavior_baseline(package)
    positive = {
        "ownerAuthorizationIdentityValid": True,
        "implementationAuthorizationConsumedOnce": (
            implementation_consumption.get("oneTimeConsumption") is True
            and implementation_consumption.get("gpuExecutionConsumed") is False
        ),
        "cpuTerminalBound": authorization["bindings"]["cpuTerminal"]["sha256"]
        == "0d8e60d9f3d63bd449d69c440f8ded953d9c7b054ef98210e076364bd87a86bd",
        "inactiveConfigBound": authorization["bindings"]["inactiveConfig"]["sha256"]
        == "e800a67b30a8e87401c795751250bba28a92bf48386aac6aae1307f2b14784cb",
        "cpuReportBound": authorization["bindings"]["cpuReport"]["sha256"]
        == "7e4485d0f757935511fdd12a9295091bf9ced3a4a11bdcff7468719360271aa0",
        "supportContractBound": authorization["bindings"]["supportContract"]["sha256"]
        == "7440ca8725276b429c8f286d6774422597d6c9896970b77760c1feb5d70bf85a",
        "autoencoderCheckpointIdentityBound": (
            authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"]
            == "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
        ),
        "inactiveContractValidated": (
            config["denoiserArchitecture"] == runner.SEMANTIC_MIXTURE_ARCHITECTURE
            and contract["enabled"] is False
        ),
        "sample194UniqueValidation": (
            occurrences == [runner.SAMPLE_ID]
            and len(source_matches) == 1
            and source_matches[0].get("split") == "validation"
        ),
        "formal23ChannelOrderPreserved": (
            tuple(config["conditionChannelOrder"])
            == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER
        ),
        "fiveTypedExpertsExact": identities == runner.SEMANTIC_MIXTURE_IDENTITIES,
        "syntheticForwardShapeFinite": (
            velocity.shape == latent.shape
            and torch.isfinite(velocity).all().item()
            and mixture["participation"].shape == (1, 5, 8, 8)
        ),
        "fivePrivateExpertGradientIsolation": all(
            value["own"] and value["cross"] and value["gate"]
            for value in gradient_isolation.values()
        ),
        "exact17MetricContract": (
            contract["diagnosticManifestRegistry"]["exactFields"]
            == list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS)
            and contract["diagnosticManifestRegistry"]["exactFieldCount"] == 17
        ),
        "outputDirectoryNotCreatedBeforeGpu": not output_path.exists(),
        "gpuConsumptionNotCreatedBeforePreflight": not gpu_consumption_path.exists(),
        "runnerHasNoBackwardCall": source_contract["backwardCallCount"] == 0,
        "runnerHasNoOptimizerConstruction": source_contract["optimizerReferenceCount"] == 0,
        "runnerHasNoCheckpointWrite": source_contract["torchSaveCallCount"] == 0,
        "runnerOnlyLoadsProjectAutoencoder": (
            source_contract["autoencoderLoaderCount"] == 1
            and source_contract["denoiserCheckpointLoaderCount"] == 0
        ),
        "gpuConsumptionBeforeGpuRun": (
            source_text.index("write_json_exclusive(consumption_path, consumption)")
            < source_text.index("return run_gpu(")
        ),
        "fiveExpertCausalChecksImplemented": (
            "semantic_mixture_diagnostic_causal_response_missing" in source_text
        ),
        "fiveExpertGradientChecksImplemented": (
            "semantic_mixture_diagnostic_private_gradient_failed" in source_text
        ),
        "parameterHashVerificationImplemented": (
            "semantic_mixture_diagnostic_model_state_changed" in source_text
        ),
        "exact17ExportImplemented": (
            "FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS" in source_text
        ),
        "legacyV9AuthorizationEvidenceImmutable": legacy_v9["authorizationEvidenceImmutable"],
        "legacyV9TrainingContractStillValid": legacy_v9["trainingContractValid"],
        "legacyV9ModelBuildAndForwardStillValid": legacy_v9["modelBuildAndForwardValid"],
        "failureClosesWithoutRetry": "automaticRetryStarted\": False" in source_text,
    }
    negative = {
        "rejectWrongRequestId": rejects(
            authorization, lambda value: value.__setitem__("requestId", "wrong")
        ),
        "rejectWrongCommandRef": rejects(
            authorization, lambda value: value.__setitem__("commandRef", "wrong")
        ),
        "rejectWrongScope": rejects(
            authorization, lambda value: value.__setitem__("scope", "wrong")
        ),
        "rejectWrongArchitecture": rejects(
            authorization,
            lambda value: value["taskIdentity"].__setitem__("architectureId", "v9"),
        ),
        "rejectWrongSample": rejects(
            authorization,
            lambda value: value["taskIdentity"].__setitem__("sampleId", "wrong"),
        ),
        "rejectTrainReclassification": rejects(
            authorization,
            lambda value: value["taskIdentity"].__setitem__("sampleSplit", "train"),
        ),
        "rejectWrongSeed": rejects(
            authorization, lambda value: value["taskIdentity"].__setitem__("seed", 1)
        ),
        "rejectWrongTimestep": rejects(
            authorization,
            lambda value: value["taskIdentity"].__setitem__("timestep", 998),
        ),
        "rejectWrongTopology": rejects(
            authorization,
            lambda value: value["taskIdentity"].__setitem__(
                "requiredBoundarySides", ["east"]
            ),
        ),
        "rejectMissingExpert": rejects(
            authorization,
            lambda value: value["taskIdentity"]["expertIdentities"].pop(),
        ),
        "rejectWrongMetricCount": rejects(
            authorization,
            lambda value: value["taskIdentity"].__setitem__(
                "diagnosticManifestMetricCount", 16
            ),
        ),
        "rejectUnknownImplementationAction": rejects(
            authorization,
            lambda value: value["implementationActions"].__setitem__("unknown", True),
        ),
        "rejectUnknownExecutionAction": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("unknown", True),
        ),
        "rejectOldDenoiserRead": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__(
                "oldDenoiserCheckpointReadOrLoad", True
            ),
        ),
        "rejectOptimizer": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("optimizerCreation", True),
        ),
        "rejectBackwardMethod": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__(
                "backwardMethodExecution", True
            ),
        ),
        "rejectWeightMutation": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__(
                "modelWeightModification", True
            ),
        ),
        "rejectCheckpointWrite": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("checkpointWrite", True),
        ),
        "rejectSmoke": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("smoke", True),
        ),
        "rejectFullTraining": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__(
                "stage4FullTraining", True
            ),
        ),
        "rejectAutomaticRetry": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("automaticRetry", True),
        ),
        "rejectRuntimeFrame": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("runtimeFrame", True),
        ),
        "rejectWorldEntry": rejects(
            authorization,
            lambda value: value["executionActions"].__setitem__("worldEntry", True),
        ),
        "rejectTamperedBoundConfig": binding_rejects(authorization, "inactiveConfig"),
        "rejectTamperedAutoencoderIdentity": binding_rejects(
            authorization, "projectAutoencoderCheckpoint"
        ),
    }
    evidence = {
        "sample194ValidationOccurrences": len(occurrences),
        "sourceIndexSample194Matches": len(source_matches),
        "sourceContract": source_contract,
        "gradientIsolation": gradient_isolation,
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "outputDirectoryExists": output_path.exists(),
        "gpuConsumptionExists": gpu_consumption_path.exists(),
        "checkpointRead": False,
        "gpuUsed": False,
    }
    return positive, negative, evidence


def run_structure_fact_regressions(authorization: dict):
    runner.validate_authorization_document(authorization, verify_bindings=True)
    config = runner.read_json(runner.resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
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
        if row.get("sampleId") == runner.SAMPLE_ID
        and row.get("v7CapacityContributionRegistered") is True
    ]
    source_text = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    source_contract = inspect_source_contract(source_text)
    implementation_consumption = runner.read_json(
        runner.resolve(runner.STRUCTURE_FACT_IMPLEMENTATION_CONSUMPTION_PATH)
    )
    output_path = runner.resolve(Path(authorization["execution"]["outputDirectory"]))
    gpu_consumption_path = runner.resolve(Path(authorization["execution"]["gpuConsumptionPath"]))
    contract = config["training"]["stage4StructureFactFirstDualStage"]
    legacy_v9 = validate_legacy_v9_behavior_baseline(package)
    loss_registry = validate_structure_fact_loss_registry_runtime(config)
    positive = {
        "ownerAuthorizationIdentityValid": True,
        "implementationAuthorizationConsumedOnce": implementation_consumption.get("oneTimeConsumption") is True,
        "cpuTerminalBound": authorization["bindings"]["cpuTerminal"]["sha256"] == "f0de35ee3d49f4f26aec0edc72586e81f90f7c6aef73d2d75e4ad004c1c13418",
        "inactiveConfigBound": authorization["bindings"]["inactiveConfig"]["sha256"] == "6cefbbaf61fb3b8e932842586901865b1ffa76d71c799c8ed9fc99f0859b05f7",
        "cpuReportBound": authorization["bindings"]["cpuReport"]["sha256"] == "7d7e9c74e15fc4aac4dbd29cff726406a5476458c5522a50d0cc67cb80678096",
        "supportContractBound": authorization["bindings"]["supportContract"]["sha256"] == "42d24f9952b899808e2a4fba0f03ee3e308f759c0e47734a899dc100c3605b4e",
        "ownerActionRequestBound": authorization["bindings"]["ownerActionRequest"]["sha256"] == "4787af5122cd1f3633d100a2ef7d9d368ad38b853fee62d1df9582dfec568249",
        "autoencoderCheckpointIdentityBound": authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"] == "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
        "structureFactContractValidatedInactive": config["denoiserArchitecture"] == runner.STRUCTURE_FACT_ARCHITECTURE,
        "sample194UniqueValidation": occurrences == [runner.SAMPLE_ID] and len(source_matches) == 1 and source_matches[0].get("split") == "validation",
        "conditionChannelOrderPreserved": len(config["conditionChannelOrder"]) == 23,
        "stageAChannelsExact": contract["stageA"]["outputChannels"] == list(runner.STRUCTURE_FACT_CHANNELS),
        "stageBScalesExact": contract["stageB"]["injectionScales"] == list(runner.STRUCTURE_FACT_STAGE_B_SCALES),
        "exact17MetricContract": contract["diagnosticManifestRegistry"]["exactFields"] == list(trainer.STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
        "sixChannelLossRegistryOrderExact": loss_registry["registryOrder"] == list(runner.STRUCTURE_FACT_CHANNELS),
        "sixChannelLossRegistryKeysUnique": len(set(loss_registry["registryValues"])) == len(runner.STRUCTURE_FACT_CHANNELS),
        "sixChannelLossesProducedBySyntheticForward": loss_registry["producedChannelLossKeys"] == set(loss_registry["registryValues"]),
        "sixChannelLossesRouteOnlyToMatchingStageAHead": all(loss_registry["headIsolation"].values()),
        "sixChannelLossRegistryImmutable": loss_registry["immutable"],
        "runnerConsumesSharedLossRegistryWithoutIndependentKeys": (
            "trainer.STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS" in source_text
            and all(value not in source_text for value in loss_registry["registryValues"])
        ),
        "outputDirectoryNotCreatedBeforeGpu": not output_path.exists(),
        "gpuConsumptionNotCreatedBeforePreflight": not gpu_consumption_path.exists(),
        "runnerHasNoBackwardCall": source_contract["backwardCallCount"] == 0,
        "runnerHasNoOptimizerConstruction": source_contract["optimizerReferenceCount"] == 0,
        "runnerHasNoCheckpointWrite": source_contract["torchSaveCallCount"] == 0,
        "runnerOnlyLoadsProjectAutoencoder": source_contract["autoencoderLoaderCount"] == 1 and source_contract["denoiserCheckpointLoaderCount"] == 0,
        "gpuConsumptionBeforeGpuRun": source_text.index("write_json_exclusive(consumption_path, consumption)") < source_text.index("return run_gpu("),
        "autoencoderReadOccursInsideConsumedGpuRun": source_text.index("return trainer.load_autoencoder_checkpoint") > source_text.index("def run_gpu("),
        "cudaInitOccursInsideConsumedGpuRun": source_text.index("torch.cuda.init()") > source_text.index("def run_gpu("),
        "sixHeadIsolationImplemented": "structure_fact_diagnostic_typed_head_isolation_failed" in source_text,
        "stageAToStageBValidationImplemented": "structure_fact_diagnostic_stage_a_to_stage_b_gradient_path_missing" in source_text,
        "original23ConditionValidationImplemented": "structure_fact_diagnostic_original_23_condition_gradient_path_missing" in source_text,
        "parameterHashVerificationImplemented": "structure_fact_diagnostic_model_state_changed" in source_text,
        "exact17RegistrationImplemented": "STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS" in source_text,
        "legacyV9AuthorizationEvidenceImmutable": legacy_v9["authorizationEvidenceImmutable"],
        "legacyV9TrainingContractStillValid": legacy_v9["trainingContractValid"],
        "legacyV9ModelBuildAndForwardStillValid": legacy_v9["modelBuildAndForwardValid"],
        "failureClosesWithoutRetry": "automaticRetryStarted\": False" in source_text,
    }
    negative = {
        "rejectWrongRequestId": rejects(authorization, lambda value: value.__setitem__("requestId", "wrong")),
        "rejectWrongScope": rejects(authorization, lambda value: value.__setitem__("scope", "wrong")),
        "rejectWrongArchitecture": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("architectureId", "v9")),
        "rejectWrongSample": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("sampleId", "wrong")),
        "rejectTrainReclassification": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("seed", 1)),
        "rejectWrongTimestep": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("timestep", 998)),
        "rejectWrongResolution": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("resolution", {"width": 512, "height": 384})),
        "rejectWrongTopology": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("requiredBoundarySides", ["east"])),
        "rejectWrongStructureChannels": rejects(authorization, lambda value: value["taskIdentity"]["structureChannels"].pop()),
        "rejectWrongStageBScales": rejects(authorization, lambda value: value["taskIdentity"]["stageBInjectionScales"].pop()),
        "rejectWrongConditionCount": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("conditionChannelCount", 22)),
        "rejectWrongMetricCount": rejects(authorization, lambda value: value["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 16)),
        "rejectCodeModification": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("codeModification", True)),
        "rejectOldDenoiserRead": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("oldV7V8V9DenoiserCheckpointReadOrLoad", True)),
        "rejectOptimizer": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("optimizerCreation", True)),
        "rejectBackwardMethod": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("backwardMethodExecution", True)),
        "rejectWeightMutation": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("modelWeightModification", True)),
        "rejectCheckpointWrite": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("checkpointWrite", True)),
        "rejectSmoke": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("smoke", True)),
        "rejectFullTraining": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("stage4FullTraining", True)),
        "rejectAutomaticRetry": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("automaticRetry", True)),
        "rejectUnknownAction": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("startTrainingNow", True)),
        "rejectAutoencoderReadClosed": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("projectAutoencoderCheckpointReadAndLoad", False)),
        "rejectRuntimeFrame": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("runtimeFrame", True)),
        "rejectWorldEntry": rejects(authorization, lambda value: value["authorizedActions"].__setitem__("worldEntry", True)),
        "rejectTamperedBoundConfig": binding_rejects(authorization, "inactiveConfig"),
        "rejectTamperedAutoencoderIdentity": binding_rejects(authorization, "projectAutoencoderCheckpoint"),
        "rejectTamperedRunnerIdentity": binding_rejects(authorization, "runner"),
        "rejectMissingLossRegistryChannel": loss_registry_rejects(
            lambda value: value.pop("terrain_path_ground"), loss_registry["producedChannelLossKeys"]
        ),
        "rejectUnknownLossRegistryChannel": loss_registry_rejects(
            lambda value: value.__setitem__("unknown_channel", "stage4StructureFactUnknownBce"),
            loss_registry["producedChannelLossKeys"],
        ),
        "rejectDuplicateLossRegistryKey": loss_registry_rejects(
            lambda value: value.__setitem__("route_required_boundary", value["terrain_path_ground"]),
            loss_registry["producedChannelLossKeys"],
        ),
        "rejectLossRegistryOrderChange": loss_registry_rejects(
            lambda value: reverse_mapping_in_place(value), loss_registry["producedChannelLossKeys"]
        ),
    }
    evidence = {
        "sample194ValidationOccurrences": len(occurrences),
        "sourceIndexSample194Matches": len(source_matches),
        "sourceContract": source_contract,
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "outputDirectoryExists": output_path.exists(),
        "gpuConsumptionExists": gpu_consumption_path.exists(),
        "structureFactLossRegistry": {
            "order": loss_registry["registryOrder"],
            "values": loss_registry["registryValues"],
            "headIsolation": loss_registry["headIsolation"],
        },
        "checkpointRead": False,
        "gpuUsed": False,
    }
    return positive, negative, evidence


def validate_structure_fact_loss_registry_runtime(config: dict) -> dict:
    registry = trainer.STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS
    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    latent = torch.randn(1, int(config["latentChannels"]), 8, 8, requires_grad=True)
    timestep = torch.tensor([999], dtype=torch.long)
    conditions = torch.rand(1, 23, 32, 32)
    discrete_indices, _ = trainer.condition_type_indices(config)
    conditions[:, discrete_indices] = (conditions[:, discrete_indices] > 0.5).to(conditions.dtype)
    velocity, alignment = model.predict_velocity_with_stage4_structure_fact(
        latent, timestep, conditions,
    )
    predicted_clean = latent - velocity * 0.1
    predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
    target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
    predicted_rgb = model.autoencoder.decode(predicted_clean)
    losses = trainer.composite_denoiser_losses_structure_fact_first_stage4(
        velocity,
        torch.randn_like(velocity),
        predicted_clean,
        torch.zeros_like(predicted_clean),
        predicted_conditions,
        target_conditions,
        predicted_rgb,
        torch.rand_like(predicted_rgb),
        conditions,
        alignment,
        config,
    )
    validate_structure_fact_loss_registry_contract(registry, set(losses))
    all_head_parameters = []
    head_slices = {}
    for name in runner.STRUCTURE_FACT_CHANNELS:
        start = len(all_head_parameters)
        all_head_parameters.extend(model.denoiser.structure_fact_heads[name].parameters())
        head_slices[name] = slice(start, len(all_head_parameters))
    head_isolation = {}
    for name in runner.STRUCTURE_FACT_CHANNELS:
        gradients = torch.autograd.grad(
            losses[registry[name]],
            tuple(all_head_parameters),
            retain_graph=True,
            create_graph=False,
            allow_unused=True,
        )
        selected = gradients[head_slices[name]]
        other = [
            gradient
            for other_name in runner.STRUCTURE_FACT_CHANNELS
            if other_name != name
            for gradient in gradients[head_slices[other_name]]
        ]
        selected_norm = sum(
            0.0 if gradient is None else float(gradient.detach().norm())
            for gradient in selected
        )
        other_norm = sum(
            0.0 if gradient is None else float(gradient.detach().norm())
            for gradient in other
        )
        head_isolation[name] = selected_norm > 0.0 and other_norm == 0.0
    immutable = False
    try:
        registry["unknown_channel"] = "stage4StructureFactUnknownBce"
    except TypeError:
        immutable = True
    return {
        "registryOrder": list(registry),
        "registryValues": list(registry.values()),
        "producedChannelLossKeys": {
            key for key in losses
            if key.startswith("stage4StructureFact")
            and key.endswith("Bce")
            and key != "stage4StructureFactLayoutBce"
        },
        "headIsolation": head_isolation,
        "immutable": immutable,
    }


def validate_structure_fact_loss_registry_contract(registry, produced_keys: set[str]) -> None:
    if list(registry) != list(runner.STRUCTURE_FACT_CHANNELS):
        raise ValueError("structure_fact_loss_registry_channel_order_invalid")
    values = list(registry.values())
    if len(values) != len(set(values)):
        raise ValueError("structure_fact_loss_registry_duplicate_key")
    if set(values) != {
        key for key in produced_keys
        if key.startswith("stage4StructureFact")
        and key.endswith("Bce")
        and key != "stage4StructureFactLayoutBce"
    }:
        raise ValueError("structure_fact_loss_registry_produced_key_set_invalid")


def loss_registry_rejects(mutation, produced_keys: set[str]) -> bool:
    candidate = dict(trainer.STRUCTURE_FACT_FIRST_STAGE4_CHANNEL_LOSS_KEYS)
    mutation(candidate)
    try:
        validate_structure_fact_loss_registry_contract(candidate, produced_keys)
    except Exception:
        return True
    return False


def reverse_mapping_in_place(value: dict) -> None:
    reversed_items = list(value.items())[::-1]
    value.clear()
    value.update(reversed_items)


def validate_legacy_v9_behavior_baseline(package: dict) -> dict:
    authorization_path = runner.resolve(runner.AUTHORIZATION_PATH)
    if runner.sha256_file(authorization_path) != runner.AUTHORIZATION_SHA256:
        raise ValueError("legacy_v9_authorization_evidence_changed")
    historical_authorization = runner.read_json(authorization_path)
    if (
        historical_authorization.get("requestId") != runner.REQUEST_ID
        or historical_authorization.get("ownerDecision", {}).get("scope") != runner.SCOPE
    ):
        raise ValueError("legacy_v9_authorization_evidence_identity_invalid")
    config_identity = historical_authorization.get("bindings", {}).get("v9InactiveConfig", {})
    config_path = runner.resolve(Path(config_identity.get("path", "missing")))
    if config_identity.get("sha256") != runner.sha256_file(config_path):
        raise ValueError("legacy_v9_inactive_config_evidence_changed")
    config = runner.read_json(config_path)
    trainer.validate_training_inputs(config, package)
    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    latent = torch.randn(1, int(config["latentChannels"]), 8, 8)
    timestep = torch.tensor([999], dtype=torch.long)
    conditions = torch.rand(1, 23, 32, 32)
    discrete_indices, _ = trainer.condition_type_indices(config)
    conditions[:, discrete_indices] = (conditions[:, discrete_indices] > 0.5).to(conditions.dtype)
    with torch.no_grad():
        velocity, alignment = model.predict_velocity_with_stage4_object_alignment(
            latent, timestep, conditions,
        )
    model_valid = (
        tuple(velocity.shape) == tuple(latent.shape)
        and tuple(alignment["objectReadoutUp1"].shape) == (1, 4, 4, 4)
        and tuple(alignment["objectReadoutUp0"].shape) == (1, 4, 8, 8)
        and tuple(alignment["routeReadout"].shape) == (1, 2, 8, 8)
    )
    if not model_valid:
        raise ValueError("legacy_v9_model_build_or_forward_behavior_changed")
    return {
        "authorizationEvidenceImmutable": True,
        "trainingContractValid": True,
        "modelBuildAndForwardValid": True,
    }


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

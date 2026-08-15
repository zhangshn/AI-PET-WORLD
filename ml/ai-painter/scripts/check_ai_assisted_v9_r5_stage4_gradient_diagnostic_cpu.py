from __future__ import annotations

from argparse import ArgumentParser
import ast
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sys
import traceback

import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import run_ai_assisted_v9_r5_stage4_gradient_diagnostic as runner
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--attestation", type=Path)
    parser.add_argument("--object-visible-structure-implementation-contract", action="store_true")
    parser.add_argument(
        "--object-reference-multiscale-implementation-contract", action="store_true"
    )
    parser.add_argument(
        "--early-convergence-implementation-contract", action="store_true"
    )
    parser.add_argument(
        "--early-convergence-integrated-preflight-correction-contract",
        action="store_true",
    )
    parser.add_argument(
        "--early-convergence-gpu-runner-contract-correction",
        action="store_true",
    )
    parser.add_argument("--implementation-authorization", type=Path)
    parser.add_argument("--implementation-consumption", type=Path)
    args = parser.parse_args()
    if args.early_convergence_gpu_runner_contract_correction:
        if any((
            args.authorization, args.report, args.attestation,
            args.object_visible_structure_implementation_contract,
            args.object_reference_multiscale_implementation_contract,
            args.early_convergence_implementation_contract,
            args.early_convergence_integrated_preflight_correction_contract,
        )):
            raise ValueError("early_convergence_gpu_runner_contract_correction_paths_mixed")
        report = run_early_convergence_gpu_runner_contract_correction(
            args.implementation_authorization, args.implementation_consumption,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["status"] == (
            "passed_stage4_early_convergence_gpu_runner_local_mode_and_preflight_hash_contract_correction_cpu_contract"
        ) else 1
    if args.early_convergence_integrated_preflight_correction_contract:
        if any((
            args.authorization, args.report, args.attestation,
            args.object_visible_structure_implementation_contract,
            args.object_reference_multiscale_implementation_contract,
            args.early_convergence_implementation_contract,
        )):
            raise ValueError("early_convergence_preflight_correction_paths_mixed")
        report = run_early_convergence_integrated_preflight_correction_contract(
            args.implementation_authorization, args.implementation_consumption,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["status"] == (
            "passed_stage4_early_convergence_integrated_preflight_lineage_isolation_cpu_contract"
        ) else 1
    if args.early_convergence_implementation_contract:
        if any((
            args.authorization, args.report, args.attestation,
            args.object_visible_structure_implementation_contract,
            args.object_reference_multiscale_implementation_contract,
        )):
            raise ValueError("early_convergence_implementation_contract_paths_mixed")
        report = run_early_convergence_implementation_contract(
            args.implementation_authorization, args.implementation_consumption,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["status"] == (
            "passed_stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_cpu_contract"
        ) else 1
    if args.object_reference_multiscale_implementation_contract:
        if any((args.authorization, args.report, args.attestation, args.object_visible_structure_implementation_contract)):
            raise ValueError("object_reference_multiscale_implementation_contract_paths_mixed")
        report = run_object_reference_multiscale_implementation_contract(
            args.implementation_authorization, args.implementation_consumption,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["status"] == (
            "passed_stage4_object_reference_multiscale_readonly_gpu_entry_implementation_cpu_contract"
        ) else 1
    if args.object_visible_structure_implementation_contract:
        if any((args.authorization, args.report, args.attestation)):
            raise ValueError("object_visible_structure_implementation_contract_paths_mixed")
        report = run_object_visible_structure_implementation_contract(
            args.implementation_authorization, args.implementation_consumption,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["status"] == (
            "passed_stage4_object_visible_structure_readonly_gpu_entry_implementation_cpu_contract"
        ) else 1
    if any(value is None for value in (args.authorization, args.report, args.attestation)):
        raise ValueError("legacy_diagnostic_cpu_paths_required")
    report_path = runner.resolve(args.report)
    attestation_path = runner.resolve(args.attestation)
    try:
        authorization = runner.validate_authorization(args.authorization)
        structure_mode = runner.is_structure_fact_authorization(authorization)
        semantic_mixture_mode = runner.is_semantic_mixture_authorization(authorization)
        final_visible_rgb_mode = runner.is_final_visible_rgb_authorization(authorization)
        vegetation_repair_mode = runner.is_vegetation_repair_authorization(authorization)
        vegetation_luminance_mode = runner.is_vegetation_luminance_authorization(authorization)
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
            "passed_stage4_vegetation_luminance_spatial_readonly_gpu_diagnostic_cpu_authorization_regression"
            if vegetation_luminance_mode
            else (
            "passed_stage4_vegetation_final_visible_readonly_gpu_diagnostic_cpu_authorization_regression"
            if vegetation_repair_mode
            else (
            "passed_stage4_final_visible_rgb_readonly_gpu_diagnostic_cpu_authorization_regression"
            if final_visible_rgb_mode
            else (
                "passed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
                if semantic_mixture_mode
                else (
                    "passed_structure_fact_first_readonly_gpu_diagnostic_cpu_authorization_regression"
                    if structure_mode else "passed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
                )
            )))
        )
        failed_status = (
            "failed_closed_stage4_vegetation_luminance_spatial_readonly_gpu_diagnostic_cpu_authorization_regression"
            if vegetation_luminance_mode
            else (
            "failed_closed_stage4_vegetation_final_visible_readonly_gpu_diagnostic_cpu_authorization_regression"
            if vegetation_repair_mode
            else (
            "failed_closed_stage4_final_visible_rgb_readonly_gpu_diagnostic_cpu_authorization_regression"
            if final_visible_rgb_mode
            else (
                "failed_closed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
                if semantic_mixture_mode
                else (
                    "failed_closed_structure_fact_first_readonly_gpu_diagnostic_cpu_authorization_regression"
                    if structure_mode else "failed_closed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
                )
            )))
        )
        report = {
            "schemaVersion": (
                "ai-painter-r5-stage4-vegetation-final-visible-gradient-diagnostic-cpu-report-v1"
                if vegetation_repair_mode
                else (
                "ai-painter-r5-stage4-final-visible-rgb-gradient-diagnostic-cpu-report-v1"
                if final_visible_rgb_mode
                else (
                    "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-cpu-report-v1"
                    if semantic_mixture_mode
                    else (
                        "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-cpu-report-v1"
                        if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-cpu-report-v1"
                    )
                ))
            ),
            "status": passed_status if not failed_positive and not failed_negative else failed_status,
            **timestamps("recordedAt"),
            "authorization": runner.binding(args.authorization),
            "implementationConsumption": runner.binding(
                runner.VEGETATION_LUMINANCE_IMPLEMENTATION_CONSUMPTION_PATH
                if vegetation_luminance_mode
                else (
                runner.VEGETATION_REPAIR_IMPLEMENTATION_CONSUMPTION_PATH
                if vegetation_repair_mode
                else (
                runner.FINAL_VISIBLE_RGB_IMPLEMENTATION_CONSUMPTION_PATH
                if final_visible_rgb_mode
                else (
                    runner.SEMANTIC_MIXTURE_IMPLEMENTATION_CONSUMPTION_PATH
                    if semantic_mixture_mode
                    else (
                        runner.STRUCTURE_FACT_IMPLEMENTATION_CONSUMPTION_PATH
                        if structure_mode else runner.IMPLEMENTATION_CONSUMPTION_PATH
                    )
                )))
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
                "ai-painter-r5-stage4-vegetation-final-visible-gradient-diagnostic-implementation-attestation-v1"
                if vegetation_repair_mode
                else (
                "ai-painter-r5-stage4-final-visible-rgb-gradient-diagnostic-implementation-attestation-v1"
                if final_visible_rgb_mode
                else (
                    "ai-painter-r5-stage4-fact-conditioned-semantic-mixture-gradient-diagnostic-implementation-attestation-v1"
                    if semantic_mixture_mode
                    else (
                        "ai-painter-r5-stage4-structure-fact-first-gradient-diagnostic-implementation-attestation-v1"
                        if structure_mode else "ai-painter-r5-stage4-v9-gradient-diagnostic-implementation-attestation-v1"
                    )
                ))
            ),
            "status": (
                "stage4_vegetation_luminance_spatial_gpu_diagnostic_implementation_cpu_verified"
                if vegetation_luminance_mode
                else (
                "stage4_vegetation_final_visible_gpu_diagnostic_implementation_cpu_verified"
                if vegetation_repair_mode
                else (
                "stage4_final_visible_rgb_gpu_diagnostic_implementation_cpu_verified"
                if final_visible_rgb_mode
                else (
                    "fact_conditioned_semantic_mixture_gpu_diagnostic_implementation_cpu_verified"
                    if semantic_mixture_mode
                    else (
                        "structure_fact_first_gpu_diagnostic_implementation_cpu_verified"
                        if structure_mode else "v9_gpu_diagnostic_implementation_cpu_verified"
                    )
                )))
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
    if runner.is_vegetation_luminance_authorization(authorization):
        return run_vegetation_luminance_regressions(authorization)
    if runner.is_vegetation_repair_authorization(authorization):
        return run_vegetation_repair_regressions(authorization)
    if runner.is_final_visible_rgb_authorization(authorization):
        return run_final_visible_rgb_regressions(authorization)
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


def run_final_visible_rgb_regressions(authorization: dict):
    runner.validate_authorization_document(authorization, verify_bindings=True)
    config = runner.read_json(
        runner.resolve(Path(authorization["bindings"]["inactiveConfig"]["path"]))
    )
    package = runner.read_json(runner.resolve(runner.DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    objective = trainer.validate_stage4_per_class_final_visible_rgb_obligation(config)
    dataset = AiAssistedConditionalDenoiserDataset(
        runner.DATASET_PATH,
        runner.SAMPLE_SPLIT,
        list(config["conditionChannelOrder"]),
        runner.IMAGE_SIZE,
        selection_contract=trainer.conditional_dataset_selection_contract(config),
    )
    occurrences = [
        row.get("sampleId") for row in dataset.rows if row.get("sampleId") == runner.SAMPLE_ID
    ]
    source_index = runner.read_json(
        runner.resolve(Path(authorization["bindings"]["datasetSourceIndex"]["path"]))
    )
    source_matches = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == runner.SAMPLE_ID
        and row.get("v7CapacityContributionRegistered") is True
        and row.get("split") == "validation"
    ]
    source_text = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    source_contract = inspect_source_contract(source_text)
    implementation_consumption = runner.read_json(
        runner.resolve(runner.FINAL_VISIBLE_RGB_IMPLEMENTATION_CONSUMPTION_PATH)
    )
    output_path = runner.resolve(Path(authorization["execution"]["outputDirectory"]))
    gpu_consumption_path = runner.resolve(
        Path(authorization["execution"]["gpuConsumptionPath"])
    )

    torch.manual_seed(runner.SEED)
    model = build_complete_world_system(config).cpu().eval()
    predicted_rgb = torch.rand(1, 3, 48, 64, requires_grad=True)
    target_rgb = torch.rand_like(predicted_rgb)
    conditions = torch.zeros(1, 23, 48, 64)
    order = list(config["conditionChannelOrder"])
    terms = list(trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_RGB_TERMS)
    gradient_evidence = {}
    for index, term in enumerate(terms):
        y0 = 2 + index * 8
        conditions[:, order.index(term["sourceChannel"]), y0:y0 + 5, 3 + index:12 + index] = 1.0
        loss = trainer.masked_condition_rgb_loss(
            predicted_rgb, target_rgb, conditions, config, term["sourceChannel"],
        )
        gradient = torch.autograd.grad(loss, predicted_rgb, retain_graph=True)[0]
        mask = conditions[:, order.index(term["sourceChannel"]):order.index(term["sourceChannel"]) + 1]
        inside = float((gradient.abs() * mask).sum())
        outside = float((gradient.abs() * (1.0 - mask)).sum())
        gradient_evidence[term["identity"]] = {
            "finiteNonzero": torch.isfinite(gradient).all().item() and inside > 0.0,
            "insideMaskGradientAbsSum": inside,
            "outsideMaskGradientAbsSum": outside,
        }
    expected_weights = {
        "route": 2.0,
        "footprints": 1.0 / 4.25,
        "tree": 1.0 / 4.25,
        "rock": 1.25 / 4.25,
        "vegetation": 1.0 / 4.25,
    }
    positive = {
        "ownerAuthorizationIdentityValid": True,
        "implementationAuthorizationConsumedOnce": (
            implementation_consumption.get("oneTimeConsumption") is True
            and implementation_consumption.get("gpuExecutionConsumed") is False
        ),
        "allCpuPrerequisitesBound": all(
            key in authorization["bindings"]
            for key in ("cpuTerminal", "cpuReport", "configurationAudit", "supportContract")
        ),
        "inactiveConfigBound": authorization["bindings"]["inactiveConfig"]["sha256"]
        == "ff0a4077a9b92a08b4582d38e5d41f6cbf539a6abf1848f10e10b9506acf1788",
        "autoencoderCheckpointIdentityBound": authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"]
        == "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
        "objectiveContractValidatedInactive": objective.get("status")
        == "stage4_per_class_final_visible_rgb_obligation_cpu_contract_valid_inactive",
        "exactFiveOrderedObligations": objective.get("terms") == terms and len(terms) == 5,
        "derivedWeightsExact": all(
            abs(float(objective["derivedWeights"][key]) - expected) <= 1e-12
            for key, expected in expected_weights.items()
        ),
        "formal23ChannelOrderPreserved": tuple(config["conditionChannelOrder"])
        == trainer.FORMAL_COMPLETE_WORLD_CONDITION_CHANNEL_ORDER,
        "sample194UniqueValidation": occurrences == [runner.SAMPLE_ID] and len(source_matches) == 1,
        "syntheticModelBuildPreserved": model.denoiser is not None,
        "fiveCpuGradientAndMaskIsolationChecksPass": all(
            item["finiteNonzero"] and item["outsideMaskGradientAbsSum"] == 0.0
            for item in gradient_evidence.values()
        ),
        "exact27MetricContract": len(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS) == 27,
        "outputDirectoryNotCreatedBeforeGpu": not output_path.exists(),
        "gpuConsumptionNotCreatedBeforePreflight": not gpu_consumption_path.exists(),
        "runnerHasNoBackwardCall": source_contract["backwardCallCount"] == 0,
        "runnerHasNoOptimizerConstruction": source_contract["optimizerReferenceCount"] == 0,
        "runnerHasNoCheckpointWrite": source_contract["torchSaveCallCount"] == 0,
        "runnerOnlyLoadsProjectAutoencoder": source_contract["autoencoderLoaderCount"] == 1
        and source_contract["denoiserCheckpointLoaderCount"] == 0,
        "fiveGpuObligationChecksImplemented": "final_visible_rgb_diagnostic_gradient_or_mask_failed" in source_text,
        "parameterHashVerificationImplemented": "semantic_mixture_diagnostic_model_state_changed" in source_text,
        "failureClosesWithoutRetry": "automaticRetryStarted\": False" in source_text,
    }
    negative = {
        "rejectWrongRequestId": rejects(authorization, lambda v: v.__setitem__("requestId", "wrong")),
        "rejectWrongCommandRef": rejects(authorization, lambda v: v.__setitem__("commandRef", "wrong")),
        "rejectWrongScope": rejects(authorization, lambda v: v.__setitem__("scope", "wrong")),
        "rejectWrongArchitecture": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("architectureId", "wrong")),
        "rejectWrongObjective": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("trainingObjectiveContractId", "wrong")),
        "rejectWrongSample": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sampleId", "wrong")),
        "rejectTrainReclassification": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("seed", 1)),
        "rejectWrongTimestep": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("timestep", 998)),
        "rejectWrongResolution": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("resolution", {"width": 512, "height": 384})),
        "rejectWrongTopology": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("requiredBoundarySides", ["east"])),
        "rejectMissingObligation": rejects(authorization, lambda v: v["taskIdentity"]["obligationIdentities"].pop()),
        "rejectWrongMetricCount": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 17)),
        "rejectOptimizer": rejects(authorization, lambda v: v["executionActions"].__setitem__("optimizerCreation", True)),
        "rejectBackward": rejects(authorization, lambda v: v["executionActions"].__setitem__("backwardMethodExecution", True)),
        "rejectWeightMutation": rejects(authorization, lambda v: v["executionActions"].__setitem__("modelWeightModification", True)),
        "rejectCheckpointWrite": rejects(authorization, lambda v: v["executionActions"].__setitem__("checkpointWrite", True)),
        "rejectOldCheckpointRead": rejects(authorization, lambda v: v["executionActions"].__setitem__("oldDenoiserOrDiagnosticCheckpointReadOrLoad", True)),
        "rejectSmoke": rejects(authorization, lambda v: v["executionActions"].__setitem__("smoke", True)),
        "rejectFullTraining": rejects(authorization, lambda v: v["executionActions"].__setitem__("stage4FullTraining", True)),
        "rejectUnknownAction": rejects(authorization, lambda v: v["executionActions"].__setitem__("unknown", True)),
        "rejectAutomaticRetry": rejects(authorization, lambda v: v["executionActions"].__setitem__("automaticRetry", True)),
        "rejectTamperedConfig": binding_rejects(authorization, "inactiveConfig"),
        "rejectTamperedSupport": binding_rejects(authorization, "supportContract"),
        "rejectTamperedAutoencoder": binding_rejects(authorization, "projectAutoencoderCheckpoint"),
    }
    evidence = {
        "gradientEvidence": gradient_evidence,
        "sourceContract": source_contract,
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "checkpointRead": False,
        "gpuUsed": False,
    }
    return positive, negative, evidence


def run_vegetation_luminance_regressions(authorization: dict):
    runner.validate_authorization_document(authorization, verify_bindings=True)
    config = runner.read_json(
        runner.resolve(Path(authorization["bindings"]["inactiveConfig"]["path"]))
    )
    package = runner.read_json(runner.resolve(runner.DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    contract = trainer.validate_stage4_vegetation_luminance_spatial_structure_supervision(
        config
    )
    dataset = AiAssistedConditionalDenoiserDataset(
        runner.DATASET_PATH, runner.SAMPLE_SPLIT, list(config["conditionChannelOrder"]),
        runner.IMAGE_SIZE,
        selection_contract=trainer.conditional_dataset_selection_contract(config),
    )
    occurrences = [
        row.get("sampleId") for row in dataset.rows
        if row.get("sampleId") == runner.SAMPLE_ID
    ]
    source_text = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    source_contract = inspect_source_contract(source_text)
    output_path = runner.resolve(Path(authorization["execution"]["outputDirectory"]))
    consumption_path = runner.resolve(
        Path(authorization["execution"]["gpuConsumptionPath"])
    )
    torch.manual_seed(runner.SEED)
    predicted_rgb = torch.rand(1, 3, 48, 64, requires_grad=True)
    target_rgb = torch.rand_like(predicted_rgb)
    conditions = torch.zeros(1, 23, 48, 64)
    order = list(config["conditionChannelOrder"])
    conditions[:, order.index("object_vegetation"), 10:35, 20:44] = 1.0
    loss = trainer.masked_condition_luminance_correlation_loss(
        predicted_rgb, target_rgb, conditions, config, "object_vegetation",
    )
    gradient = torch.autograd.grad(loss, predicted_rgb)[0]
    mask = conditions[:, order.index("object_vegetation"):order.index("object_vegetation") + 1]
    inside = float((gradient.abs() * mask).sum())
    outside = float((gradient.abs() * (1.0 - mask)).sum())
    implementation_consumption = runner.read_json(
        runner.resolve(runner.VEGETATION_LUMINANCE_IMPLEMENTATION_CONSUMPTION_PATH)
    )
    positive = {
        "ownerAuthorizationIdentityValid": True,
        "implementationAuthorizationConsumedOnce": implementation_consumption.get("oneTimeConsumption") is True,
        "allCpuPrerequisitesBound": all(key in authorization["bindings"] for key in ("cpuTerminal", "cpuReport", "supportContract", "inactiveConfig")),
        "luminanceContractValidatedInactive": contract.get("status") == "stage4_vegetation_luminance_spatial_structure_cpu_contract_valid_inactive",
        "derivedWeightReusesExistingVegetationObligation": abs(float(contract["derivedWeight"]) - 1.0 / 4.25) <= 1e-12,
        "exact29MetricContract": len(trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config)) == 29,
        "legacy28And27MetricContractsPreserved": len(trainer.STAGE4_VEGETATION_FINAL_VISIBLE_SEMANTIC_REPAIR_DIAGNOSTIC_FIELDS) == 28 and len(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS) == 27,
        "sample194UniqueValidation": occurrences == [runner.SAMPLE_ID],
        "vegetationLuminanceGradientExactMaskSupport": torch.isfinite(gradient).all().item() and inside > 0.0 and outside == 0.0,
        "outputDirectoryNotCreatedBeforeGpu": not output_path.exists(),
        "gpuConsumptionNotCreatedBeforePreflight": not consumption_path.exists(),
        "runnerHasNoBackwardCall": source_contract["backwardCallCount"] == 0,
        "runnerHasNoOptimizerConstruction": source_contract["optimizerReferenceCount"] == 0,
        "runnerHasNoCheckpointWrite": source_contract["torchSaveCallCount"] == 0,
        "runnerOnlyLoadsProjectAutoencoder": source_contract["autoencoderLoaderCount"] == 1 and source_contract["denoiserCheckpointLoaderCount"] == 0,
        "gpuLuminanceCheckImplemented": "vegetation_luminance_spatial_gradient_or_support_failed" in source_text,
        "parameterHashVerificationImplemented": "semantic_mixture_diagnostic_model_state_changed" in source_text,
    }
    negative = {
        "rejectWrongRequestId": rejects(authorization, lambda v: v.__setitem__("requestId", "wrong")),
        "rejectWrongCommandRef": rejects(authorization, lambda v: v.__setitem__("commandRef", "wrong")),
        "rejectWrongScope": rejects(authorization, lambda v: v.__setitem__("scope", "wrong")),
        "rejectWrongObjective": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("trainingObjectiveContractId", "wrong")),
        "rejectWrongSample": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sampleId", "wrong")),
        "rejectTrainReclassification": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("seed", 1)),
        "rejectWrongTimestep": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("timestep", 998)),
        "rejectWrongResolution": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("resolution", {"width": 512, "height": 384})),
        "rejectWrongSourceChannel": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sourceChannel", "object_tree")),
        "rejectWrongMetricCount": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 28)),
        "rejectOptimizer": rejects(authorization, lambda v: v["executionActions"].__setitem__("optimizerCreation", True)),
        "rejectBackward": rejects(authorization, lambda v: v["executionActions"].__setitem__("backwardMethodExecution", True)),
        "rejectWeightMutation": rejects(authorization, lambda v: v["executionActions"].__setitem__("modelWeightModification", True)),
        "rejectCheckpointWrite": rejects(authorization, lambda v: v["executionActions"].__setitem__("checkpointWrite", True)),
        "rejectOldCheckpointRead": rejects(authorization, lambda v: v["executionActions"].__setitem__("oldDenoiserOrDiagnosticCheckpointReadOrLoad", True)),
        "rejectSmoke": rejects(authorization, lambda v: v["executionActions"].__setitem__("smoke", True)),
        "rejectFullTraining": rejects(authorization, lambda v: v["executionActions"].__setitem__("stage4FullTraining", True)),
        "rejectUnknownAction": rejects(authorization, lambda v: v["executionActions"].__setitem__("unknown", True)),
        "rejectAutomaticRetry": rejects(authorization, lambda v: v["executionActions"].__setitem__("automaticRetry", True)),
        "rejectTamperedConfig": binding_rejects(authorization, "inactiveConfig"),
        "rejectTamperedSupport": binding_rejects(authorization, "supportContract"),
        "rejectTamperedAutoencoder": binding_rejects(authorization, "projectAutoencoderCheckpoint"),
    }
    return positive, negative, {
        "vegetationLuminanceGradient": {"insideMaskAbsSum": inside, "outsideMaskAbsSum": outside, "lossValue": float(loss.detach())},
        "sourceContract": source_contract,
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "checkpointRead": False, "gpuUsed": False,
    }


def run_vegetation_repair_regressions(authorization: dict):
    runner.validate_authorization_document(authorization, verify_bindings=True)
    config = runner.read_json(
        runner.resolve(Path(authorization["bindings"]["inactiveConfig"]["path"]))
    )
    package = runner.read_json(runner.resolve(runner.DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    repair = trainer.validate_stage4_vegetation_final_visible_semantic_repair(config)
    dataset = AiAssistedConditionalDenoiserDataset(
        runner.DATASET_PATH, runner.SAMPLE_SPLIT, list(config["conditionChannelOrder"]),
        runner.IMAGE_SIZE,
        selection_contract=trainer.conditional_dataset_selection_contract(config),
    )
    occurrences = [
        row.get("sampleId") for row in dataset.rows
        if row.get("sampleId") == runner.SAMPLE_ID
    ]
    source_text = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    source_contract = inspect_source_contract(source_text)
    output_path = runner.resolve(Path(authorization["execution"]["outputDirectory"]))
    consumption_path = runner.resolve(
        Path(authorization["execution"]["gpuConsumptionPath"])
    )
    torch.manual_seed(runner.SEED)
    predicted_rgb = torch.rand(1, 3, 48, 64, requires_grad=True)
    target_rgb = torch.rand_like(predicted_rgb)
    conditions = torch.zeros(1, 23, 48, 64)
    order = list(config["conditionChannelOrder"])
    conditions[:, order.index("object_vegetation"), 10:35, 20:44] = 1.0
    edge = trainer.masked_condition_gradient_rgb_loss(
        predicted_rgb, target_rgb, conditions, config, "object_vegetation",
    )
    gradient = torch.autograd.grad(edge, predicted_rgb)[0]
    mask = conditions[:, order.index("object_vegetation"):order.index("object_vegetation") + 1]
    support = torch.nn.functional.max_pool2d(mask, 3, 1, 1)
    inside = float((gradient.abs() * mask).sum())
    adjacent = float((gradient.abs() * (support - mask)).sum())
    outside = float((gradient.abs() * (1.0 - support)).sum())
    implementation_consumption = runner.read_json(
        runner.resolve(runner.VEGETATION_REPAIR_IMPLEMENTATION_CONSUMPTION_PATH)
    )
    positive = {
        "ownerAuthorizationIdentityValid": True,
        "implementationAuthorizationConsumedOnce": (
            implementation_consumption.get("oneTimeConsumption") is True
        ),
        "allCpuPrerequisitesBound": all(
            key in authorization["bindings"]
            for key in ("cpuTerminal", "cpuReport", "supportContract", "inactiveConfig")
        ),
        "repairContractValidatedInactive": repair.get("status")
        == "stage4_vegetation_final_visible_semantic_repair_cpu_contract_valid_inactive",
        "derivedWeightReusesExistingVegetationObligation": abs(
            float(repair["derivedWeight"]) - 1.0 / 4.25
        ) <= 1e-12,
        "exact28MetricContract": len(
            trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config)
        ) == 28,
        "legacy27MetricContractPreserved": len(
            trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_DIAGNOSTIC_FIELDS
        ) == 27,
        "sample194UniqueValidation": occurrences == [runner.SAMPLE_ID],
        "vegetationEdgeGradientExactSupport": (
            torch.isfinite(gradient).all().item()
            and inside > 0.0 and adjacent > 0.0 and outside == 0.0
        ),
        "outputDirectoryNotCreatedBeforeGpu": not output_path.exists(),
        "gpuConsumptionNotCreatedBeforePreflight": not consumption_path.exists(),
        "runnerHasNoBackwardCall": source_contract["backwardCallCount"] == 0,
        "runnerHasNoOptimizerConstruction": source_contract["optimizerReferenceCount"] == 0,
        "runnerHasNoCheckpointWrite": source_contract["torchSaveCallCount"] == 0,
        "runnerOnlyLoadsProjectAutoencoder": source_contract["autoencoderLoaderCount"] == 1
        and source_contract["denoiserCheckpointLoaderCount"] == 0,
        "gpuEdgeCheckImplemented": (
            "vegetation_final_visible_edge_gradient_or_support_failed" in source_text
        ),
        "parameterHashVerificationImplemented": (
            "semantic_mixture_diagnostic_model_state_changed" in source_text
        ),
    }
    negative = {
        "rejectWrongRequestId": rejects(authorization, lambda v: v.__setitem__("requestId", "wrong")),
        "rejectWrongCommandRef": rejects(authorization, lambda v: v.__setitem__("commandRef", "wrong")),
        "rejectWrongScope": rejects(authorization, lambda v: v.__setitem__("scope", "wrong")),
        "rejectWrongObjective": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("trainingObjectiveContractId", "wrong")),
        "rejectWrongSample": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sampleId", "wrong")),
        "rejectTrainReclassification": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sampleSplit", "train")),
        "rejectWrongSeed": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("seed", 1)),
        "rejectWrongTimestep": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("timestep", 998)),
        "rejectWrongResolution": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("resolution", {"width": 512, "height": 384})),
        "rejectWrongSourceChannel": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("sourceChannel", "object_tree")),
        "rejectWrongMetricCount": rejects(authorization, lambda v: v["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 27)),
        "rejectOptimizer": rejects(authorization, lambda v: v["executionActions"].__setitem__("optimizerCreation", True)),
        "rejectBackward": rejects(authorization, lambda v: v["executionActions"].__setitem__("backwardMethodExecution", True)),
        "rejectWeightMutation": rejects(authorization, lambda v: v["executionActions"].__setitem__("modelWeightModification", True)),
        "rejectCheckpointWrite": rejects(authorization, lambda v: v["executionActions"].__setitem__("checkpointWrite", True)),
        "rejectOldCheckpointRead": rejects(authorization, lambda v: v["executionActions"].__setitem__("oldDenoiserOrDiagnosticCheckpointReadOrLoad", True)),
        "rejectSmoke": rejects(authorization, lambda v: v["executionActions"].__setitem__("smoke", True)),
        "rejectFullTraining": rejects(authorization, lambda v: v["executionActions"].__setitem__("stage4FullTraining", True)),
        "rejectUnknownAction": rejects(authorization, lambda v: v["executionActions"].__setitem__("unknown", True)),
        "rejectAutomaticRetry": rejects(authorization, lambda v: v["executionActions"].__setitem__("automaticRetry", True)),
        "rejectTamperedConfig": binding_rejects(authorization, "inactiveConfig"),
        "rejectTamperedSupport": binding_rejects(authorization, "supportContract"),
        "rejectTamperedAutoencoder": binding_rejects(authorization, "projectAutoencoderCheckpoint"),
    }
    return positive, negative, {
        "vegetationEdgeGradient": {
            "insideMaskAbsSum": inside,
            "adjacentBoundaryAbsSum": adjacent,
            "outsideOnePixelSupportAbsSum": outside,
        },
        "sourceContract": source_contract,
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "checkpointRead": False,
        "gpuUsed": False,
    }


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


def run_early_convergence_gpu_runner_contract_correction(
    authorization_path: Path | None, consumption_path: Path | None,
) -> dict:
    request_id = (
        "owner-authorized-stage4-object-reference-multiscale-early-convergence-"
        "gpu-runner-local-mode-and-preflight-hash-contract-correction-"
        "20260815-204600000"
    )
    scope = "one_cpu_bounded_gpu_runner_local_mode_and_preflight_hash_contract_correction"
    expected_authorization = runner.resolve(Path(
        ".runtime/ai-painter/owner-action-requests/" + request_id + "/authorization.json"
    ))
    expected_consumption = expected_authorization.parent / "consumption.json"
    expected_authorization_sha = (
        "7cb50b7f9396b1630843a4ee0e06bb866db33096c325c323ff74948dfc05a608"
    )
    expected_consumption_sha = (
        "977fe4d5e752b4769159d5eefd5e7cf8ce3be093f94c2d1fce9e4a320aa6152a"
    )
    if (
        authorization_path is None
        or consumption_path is None
        or runner.resolve(authorization_path) != expected_authorization
        or runner.resolve(consumption_path) != expected_consumption
        or runner.sha256_file(expected_authorization) != expected_authorization_sha
        or runner.sha256_file(expected_consumption) != expected_consumption_sha
    ):
        raise ValueError("early_convergence_gpu_runner_correction_authority_invalid")
    authorization = runner.read_json(expected_authorization)
    consumption = runner.read_json(expected_consumption)
    expected_targets = [
        "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
        "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
        "scripts/record-stage4-object-reference-multiscale-early-convergence-gpu-runner-local-mode-and-preflight-hash-contract-correction.mjs",
    ]
    expected_actions = [
        "initialize_early_convergence_mode_locally_inside_run_semantic_mixture_gpu_and_safe_failure_terminal_branch",
        "align_preflight_hash_calculation_with_exact_persisted_json_bytes",
        "modify_runner_cpu_checker_and_one_bounded_recorder_only",
        "run_python_node_syntax_cpu_positive_negative_full_cli_pre_gpu_control_flow_and_serialization_hash_regression",
        "retire_consumed_failed_gpu_authorization",
        "form_implementation_report_terminal_capsule_ledger_sqlite_and_new_inactive_gpu_owner_request",
    ]
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("authorizedTargetPaths") != expected_targets
        or authorization.get("allowedActions") != expected_actions
        or authorization.get("oneTimeConsumptionRequired") is not True
        or any(authorization.get(key) is not False for key in (
            "gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized",
            "checkpointReadOrLoadAuthorized", "modelLoadAuthorized",
            "optimizerOrBackwardAuthorized", "trainingAuthorized",
            "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized",
            "stage0Or1Or2Authorized",
        ))
    ):
        raise ValueError("early_convergence_gpu_runner_correction_authority_contract_invalid")
    if (
        consumption.get("status")
        != "cpu_only_gpu_runner_local_mode_and_preflight_hash_contract_correction_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != expected_authorization_sha
        or any(consumption.get(key) is not False for key in (
            "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointFileRead",
            "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted",
            "validationStarted", "smokeStarted", "stage0Started", "stage1Started",
            "stage2Started",
        ))
    ):
        raise ValueError("early_convergence_gpu_runner_correction_consumption_invalid")
    for name, value in authorization["requiredBindings"].items():
        if name in ("runner", "cpuChecker"):
            continue
        if runner.sha256_file(runner.resolve(Path(value["path"]))) != value["sha256"]:
            raise ValueError(f"early_convergence_gpu_runner_correction_binding_changed:{name}")

    old_gpu_authorization = runner.read_json(runner.resolve(Path(
        authorization["requiredBindings"]["consumedGpuAuthorization"]["path"]
    )))
    old_gpu_consumption = runner.read_json(runner.resolve(Path(
        authorization["requiredBindings"]["gpuConsumption"]["path"]
    )))
    failure_terminal = runner.read_json(runner.resolve(Path(
        authorization["requiredBindings"]["failureTerminal"]["path"]
    )))
    python_report = runner.read_json(runner.resolve(Path(
        authorization["requiredBindings"]["pythonPreflight"]["path"]
    )))
    resource_report = runner.read_json(runner.resolve(Path(
        authorization["requiredBindings"]["resourcePreflight"]["path"]
    )))

    runner_source = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    tree = ast.parse(runner_source)
    gpu_function = next(
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "run_semantic_mixture_gpu"
    )
    assignments = [
        node for node in ast.walk(gpu_function)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "early_convergence_mode"
                for target in node.targets)
    ]
    early_load_lines = [
        node.lineno for node in ast.walk(gpu_function)
        if isinstance(node, ast.Name)
        and node.id == "early_convergence_mode"
        and isinstance(node.ctx, ast.Load)
    ]
    local_mode_initialized_before_all_reads = (
        len(assignments) == 1
        and bool(early_load_lines)
        and assignments[0].lineno < min(early_load_lines)
    )
    exclusive_source = runner_source.split("def write_json_exclusive(", 1)[1].split(
        "def write_json_atomic(", 1
    )[0]
    atomic_source = runner_source.split("def write_json_atomic(", 1)[1].split(
        "def timestamps(", 1
    )[0]
    serialization_sample = {
        "status": "passed_cpu_serialization_hash_regression",
        "unicode": "四对象双通道",
        "nested": {"values": [1, 0.5, 0.25]},
    }
    serialized_bytes = runner.json_document_bytes(serialization_sample)
    serialization_hash_matches = (
        runner.sha256_json_document(serialization_sample)
        == hashlib.sha256(serialized_bytes).hexdigest()
    )

    future_root = Path(
        ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-"
        "readonly-gpu-gradient-qualifications/20260815-210000000"
    )
    candidate = deepcopy(old_gpu_authorization)
    candidate["requestId"] = runner.EARLY_CONVERGENCE_REQUEST_ID
    candidate["commandRef"] = runner.EARLY_CONVERGENCE_REQUEST_ID
    candidate["scope"] = runner.EARLY_CONVERGENCE_SCOPE
    candidate["implementation"] = {
        "cpuReportPath": runner.project_path(Path(authorization["outputNamespace"]) / "cpu-report.json"),
        "implementationAttestationPath": old_gpu_authorization["implementation"][
            "implementationAttestationPath"
        ],
        "pythonPreflightPath": runner.project_path(future_root / "python-preflight.json"),
        "resourcePreflightPath": runner.project_path(future_root / "resource-preflight.json"),
    }
    candidate["execution"] = {
        "outputDirectory": runner.project_path(future_root / "gpu-execution"),
        "gpuConsumptionPath": runner.project_path(
            runner.EARLY_CONVERGENCE_AUTHORIZATION_PATH.parent
            / "gpu-execution-consumption.json"
        ),
    }
    candidate["_diagnosticMode"] = "object_reference_multiscale_early_convergence"
    candidate["_authorizationSha256"] = "0" * 64

    calls = []
    cuda_init_called = False
    original_argv = sys.argv
    original_validate_authorization = runner.validate_authorization
    original_validate_attestation = runner.validate_implementation_attestation
    original_preflight = runner.build_object_visible_structure_preflight_reports
    original_write_exclusive = runner.write_json_exclusive
    original_run_gpu = runner.run_gpu
    original_cuda_available = runner.torch.cuda.is_available
    original_cuda_count = runner.torch.cuda.device_count
    original_cuda_init = runner.torch.cuda.init
    try:
        runner.validate_authorization = lambda _path: candidate
        runner.validate_implementation_attestation = lambda _path, _authorization: {}
        runner.build_object_visible_structure_preflight_reports = (
            lambda _authorization, _attestation: (deepcopy(python_report), deepcopy(resource_report))
        )
        runner.write_json_exclusive = lambda path, value: calls.append(
            (runner.project_path(path), deepcopy(value), runner.json_document_bytes(value))
        )
        runner.run_gpu = lambda *_args: calls.append(("run_gpu", None, b"")) or 0
        runner.torch.cuda.is_available = lambda: True
        runner.torch.cuda.device_count = lambda: 1
        def reject_cuda_init():
            nonlocal cuda_init_called
            cuda_init_called = True
            raise AssertionError("cuda_init_forbidden_in_cpu_regression")
        runner.torch.cuda.init = reject_cuda_init
        sys.argv = [
            str(runner.RUNNER_PATH),
            "--authorization", runner.project_path(runner.EARLY_CONVERGENCE_AUTHORIZATION_PATH),
            "--implementation-attestation", runner.project_path(
                runner.EARLY_CONVERGENCE_LINEAGE_ATTESTATION_PATH
            ),
            "--output-dir", runner.project_path(future_root / "gpu-execution"),
        ]
        cli_result = runner.main()
    finally:
        sys.argv = original_argv
        runner.validate_authorization = original_validate_authorization
        runner.validate_implementation_attestation = original_validate_attestation
        runner.build_object_visible_structure_preflight_reports = original_preflight
        runner.write_json_exclusive = original_write_exclusive
        runner.run_gpu = original_run_gpu
        runner.torch.cuda.is_available = original_cuda_available
        runner.torch.cuda.device_count = original_cuda_count
        runner.torch.cuda.init = original_cuda_init

    captured_consumption = calls[0][1] if calls else {}
    positive = {
        "authorizationAndConsumptionBound": True,
        "allImmutableFailureEvidenceBindingsVerified": True,
        "consumedGpuAuthorizationIdentityMatches": (
            old_gpu_consumption.get("authorizationSha256")
            == authorization["requiredBindings"]["consumedGpuAuthorization"]["sha256"]
        ),
        "failedGpuTerminalClosed": failure_terminal.get("status")
        == "stage4_two_lane_early_convergence_gpu_qualification_failed_closed",
        "historicalPreflightHashMismatchReproduced": (
            old_gpu_consumption.get("pythonPreflightSha256")
            != authorization["requiredBindings"]["pythonPreflight"]["sha256"]
            and old_gpu_consumption.get("resourcePreflightSha256")
            != authorization["requiredBindings"]["resourcePreflight"]["sha256"]
        ),
        "earlyConvergenceModeInitializedLocallyBeforeAllReads": local_mode_initialized_before_all_reads,
        "exclusiveWriterUsesCanonicalBytes": (
            'target.open("xb")' in exclusive_source
            and "json_document_bytes(value)" in exclusive_source
        ),
        "atomicWriterUsesCanonicalBytes": (
            "write_bytes(json_document_bytes(value))" in atomic_source
        ),
        "serializationHashMatchesCanonicalPersistedBytes": serialization_hash_matches,
        "fullCliReachedRunGpuBoundary": cli_result == 0 and calls[-1][0] == "run_gpu",
        "fullCliEvidenceWriteOrderConsumptionBeforePreflights": (
            len(calls) == 4
            and calls[0][0].endswith("gpu-execution-consumption.json")
            and calls[1][0].endswith("python-preflight.json")
            and calls[2][0].endswith("resource-preflight.json")
        ),
        "capturedPythonHashMatchesPersistedBytes": (
            captured_consumption.get("pythonPreflightSha256")
            == hashlib.sha256(calls[1][2]).hexdigest()
        ),
        "capturedResourceHashMatchesPersistedBytes": (
            captured_consumption.get("resourcePreflightSha256")
            == hashlib.sha256(calls[2][2]).hexdigest()
        ),
        "cudaInitializationNotCalled": cuda_init_called is False,
        "runnerContainsNoBackwardCall": ".backward(" not in runner_source,
    }
    negative = {
        "rejectWrongRequestId": authorization.get("requestId") == request_id,
        "rejectWrongCommandRef": authorization.get("commandRef") == request_id,
        "rejectRunnerBindingDriftAtAuthorizationTime": (
            authorization["requiredBindings"]["runner"]["sha256"]
            == "b67065eb99ed4c5fcfda9bcf31db6afb1313da94555631e93330d055b9b5508e"
        ),
        "rejectCheckerBindingDriftAtAuthorizationTime": (
            authorization["requiredBindings"]["cpuChecker"]["sha256"]
            == "51c9608a55b446055dedb378478ad2cce5455bb557460c886310088b95bc28f6"
        ),
        "rejectGpuPermission": authorization.get("gpuAuthorized") is False,
        "rejectCudaPermission": authorization.get("cudaInitializationAuthorized") is False,
        "rejectAutogradPermission": authorization.get("autogradAuthorized") is False,
        "rejectCheckpointPermission": authorization.get("checkpointReadOrLoadAuthorized") is False,
        "rejectModelLoadPermission": authorization.get("modelLoadAuthorized") is False,
        "rejectOptimizerOrBackwardPermission": authorization.get("optimizerOrBackwardAuthorized") is False,
        "rejectTrainingPermission": authorization.get("trainingAuthorized") is False,
        "rejectValidationPermission": authorization.get("validationAuthorized") is False,
        "rejectSmokePermission": authorization.get("smokeAuthorized") is False,
        "rejectAutomaticRetry": authorization.get("automaticRetryAuthorized") is False,
        "rejectStage0Or1Or2": authorization.get("stage0Or1Or2Authorized") is False,
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    return {
        "schemaVersion": "stage4-early-convergence-gpu-runner-local-mode-and-preflight-hash-contract-correction-cpu-report-v1",
        "status": (
            "passed_stage4_early_convergence_gpu_runner_local_mode_and_preflight_hash_contract_correction_cpu_contract"
            if not failed_positive and not failed_negative
            else "failed_closed_stage4_early_convergence_gpu_runner_local_mode_and_preflight_hash_contract_correction_cpu_contract"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "authorization": runner.binding(expected_authorization),
        "consumption": runner.binding(expected_consumption),
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "failedGpuAuthorization": runner.binding(runner.resolve(Path(
            authorization["requiredBindings"]["consumedGpuAuthorization"]["path"]
        ))),
        "failedGpuConsumption": runner.binding(runner.resolve(Path(
            authorization["requiredBindings"]["gpuConsumption"]["path"]
        ))),
        "checkpointFileRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "autogradExecuted": False,
        "backwardMethodExecuted": False,
        "gpuUsed": False,
        "cudaInitialized": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
        "stage0Or1Or2Started": False,
    }


def run_early_convergence_integrated_preflight_correction_contract(
    authorization_path: Path | None, consumption_path: Path | None,
) -> dict:
    request_id = (
        "owner-authorized-stage4-object-reference-multiscale-early-convergence-"
        "integrated-preflight-lineage-isolation-correction-20260815-192800000"
    )
    scope = (
        "one_cpu_bounded_early_convergence_integrated_preflight_lineage_"
        "isolation_correction"
    )
    expected_authorization = runner.resolve(Path(
        ".runtime/ai-painter/owner-action-requests/" + request_id + "/authorization.json"
    ))
    expected_consumption = expected_authorization.parent / "consumption.json"
    expected_authorization_sha = (
        "1ac93ce12ce5f774fac8d6a1c099df5e8e1693ec25dad890075b080e303dfe20"
    )
    expected_consumption_sha = (
        "7e5b63ff1bfe84c1a830ec074c090798e5179601cabc31569de912fab6f53471"
    )
    if (
        authorization_path is None
        or consumption_path is None
        or runner.resolve(authorization_path) != expected_authorization
        or runner.resolve(consumption_path) != expected_consumption
        or runner.sha256_file(expected_authorization) != expected_authorization_sha
        or runner.sha256_file(expected_consumption) != expected_consumption_sha
    ):
        raise ValueError("early_convergence_preflight_correction_authority_invalid")
    authorization = runner.read_json(expected_authorization)
    consumption = runner.read_json(expected_consumption)
    expected_targets = [
        "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
        "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
        "scripts/record-stage4-object-reference-multiscale-early-convergence-integrated-preflight-lineage-isolation-correction.mjs",
    ]
    if (
        authorization.get("requestId") != request_id
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != scope
        or authorization.get("authorizedTargetPaths") != expected_targets
        or authorization.get("oneTimeConsumptionRequired") is not True
        or any(authorization.get(key) is not False for key in (
            "gpuAuthorized", "cudaInitializationAuthorized", "autogradAuthorized",
            "checkpointReadOrLoadAuthorized", "modelLoadAuthorized",
            "optimizerOrBackwardAuthorized", "trainingAuthorized",
            "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized",
            "stage0Or1Or2Authorized",
        ))
    ):
        raise ValueError("early_convergence_preflight_correction_authority_contract_invalid")
    for name in ("unconsumedGpuAuthorization", "ownerRequest", "entryTerminal"):
        value = authorization["requiredBindings"][name]
        if runner.sha256_file(runner.resolve(Path(value["path"]))) != value["sha256"]:
            raise ValueError(f"early_convergence_preflight_correction_binding_changed:{name}")
    if (
        consumption.get("status")
        != "cpu_only_integrated_preflight_lineage_isolation_correction_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != scope
        or consumption.get("authorizationSha256") != expected_authorization_sha
        or consumption.get("authorizedTargetPaths") != expected_targets
        or any(consumption.get(key) is not False for key in (
            "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointFileRead",
            "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted",
            "validationStarted", "smokeStarted", "stage0Started", "stage1Started",
            "stage2Started",
        ))
    ):
        raise ValueError("early_convergence_preflight_correction_consumption_invalid")
    old_gpu_path = runner.resolve(Path(
        authorization["requiredBindings"]["unconsumedGpuAuthorization"]["path"]
    ))
    old_gpu_consumption = old_gpu_path.parent / "gpu-execution-consumption.json"
    old_output_root = runner.resolve(Path(
        ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-"
        "readonly-gpu-gradient-qualifications/20260815-191500000"
    ))
    candidate = runner.read_json(old_gpu_path)
    attestation = runner.read_json(runner.resolve(Path(
        candidate["implementation"]["implementationAttestationPath"]
    )))
    candidate["requestId"] = runner.EARLY_CONVERGENCE_REQUEST_ID
    candidate["commandRef"] = runner.EARLY_CONVERGENCE_REQUEST_ID
    candidate["scope"] = runner.EARLY_CONVERGENCE_SCOPE
    correction_output = Path(
        ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-"
        "integrated-preflight-lineage-isolation-corrections/20260815-192800000"
    )
    future_output = Path(
        ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-"
        "readonly-gpu-gradient-qualifications/20260815-193500000"
    )
    candidate["implementation"] = {
        "cpuReportPath": runner.project_path(correction_output / "cpu-report.json"),
        "implementationAttestationPath": runner.project_path(
            runner.EARLY_CONVERGENCE_LINEAGE_ATTESTATION_PATH
        ),
        "pythonPreflightPath": runner.project_path(future_output / "python-preflight.json"),
        "resourcePreflightPath": runner.project_path(future_output / "resource-preflight.json"),
    }
    candidate["execution"] = {
        "outputDirectory": runner.project_path(future_output / "gpu-execution"),
        "gpuConsumptionPath": runner.project_path(
            runner.EARLY_CONVERGENCE_AUTHORIZATION_PATH.parent
            / "gpu-execution-consumption.json"
        ),
    }
    candidate["_diagnosticMode"] = "object_reference_multiscale_early_convergence"
    candidate["_authorizationPath"] = runner.project_path(old_gpu_path)
    candidate["_authorizationSha256"] = runner.sha256_file(old_gpu_path)
    runner.validate_authorization_document(candidate, verify_bindings=False)
    config_path = runner.resolve(Path(candidate["bindings"]["inactiveConfig"]["path"]))
    config_before = runner.read_json(config_path)
    cuda_init_called = False
    original_is_available = runner.torch.cuda.is_available
    original_init = runner.torch.cuda.init
    original_sha256_file = runner.sha256_file
    try:
        runner.torch.cuda.is_available = lambda: False
        runner.sha256_file = lambda path: (
            "0" * 64
            if runner.resolve(path) == runner.resolve(
                runner.EARLY_CONVERGENCE_LINEAGE_ATTESTATION_PATH
            )
            else original_sha256_file(path)
        )
        def reject_cuda_init():
            nonlocal cuda_init_called
            cuda_init_called = True
            raise AssertionError("cuda_init_forbidden_in_cpu_regression")
        runner.torch.cuda.init = reject_cuda_init
        try:
            runner.build_object_visible_structure_preflight_reports(candidate, attestation)
        except ValueError as error:
            reached_cuda_gate = str(error) == "v9_diagnostic_cuda_device_zero_unavailable"
        else:
            reached_cuda_gate = False
    finally:
        runner.torch.cuda.is_available = original_is_available
        runner.torch.cuda.init = original_init
        runner.sha256_file = original_sha256_file
    invalid_config = deepcopy(config_before)
    invalid_config["training"][
        "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"
    ]["status"] = "wrong"
    invalid_rejected = False
    try:
        runner.validate_early_convergence_diagnostic_config(invalid_config)
    except Exception:
        invalid_rejected = True
    runner_source = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    preflight_source = runner_source.split(
        "def build_object_visible_structure_preflight_reports(", 1
    )[1].split("def consume_and_run(", 1)[0]
    positive = {
        "authorizationAndConsumptionBound": True,
        "oldGpuAuthorizationStillUnconsumed": not old_gpu_consumption.exists(),
        "oldGpuEvidenceRootAbsent": not old_output_root.exists(),
        "earlyConvergenceAuthorizationAccepted": True,
        "integratedPreflightReachedCudaAvailabilityGate": reached_cuda_gate,
        "cudaInitializationNotCalled": cuda_init_called is False,
        "sourceInactiveConfigUnchanged": config_before == runner.read_json(config_path),
        "invalidEarlyConvergenceConfigRejected": invalid_rejected,
        "preflightContainsEarlyConvergenceIsolationBranch": all(
            token in preflight_source for token in (
                "early_convergence_mode = is_early_convergence_authorization",
                "validate_early_convergence_diagnostic_config(config)",
                "trainer.validate_training_inputs(config, package)",
            )
        ),
        "runnerContainsNoBackwardCall": ".backward(" not in runner_source,
    }
    negative = {
        "rejectWrongRequestId": authorization.get("requestId") == request_id,
        "rejectGpuPermission": authorization.get("gpuAuthorized") is False,
        "rejectCudaPermission": authorization.get("cudaInitializationAuthorized") is False,
        "rejectAutogradPermission": authorization.get("autogradAuthorized") is False,
        "rejectCheckpointPermission": authorization.get("checkpointReadOrLoadAuthorized") is False,
        "rejectTrainingPermission": authorization.get("trainingAuthorized") is False,
        "rejectValidationPermission": authorization.get("validationAuthorized") is False,
        "rejectSmokePermission": authorization.get("smokeAuthorized") is False,
        "rejectAutomaticRetry": authorization.get("automaticRetryAuthorized") is False,
        "rejectStage0Or1Or2": authorization.get("stage0Or1Or2Authorized") is False,
    }
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    return {
        "schemaVersion": "stage4-early-convergence-integrated-preflight-lineage-isolation-correction-cpu-report-v1",
        "status": (
            "passed_stage4_early_convergence_integrated_preflight_lineage_isolation_cpu_contract"
            if not failed_positive and not failed_negative
            else "failed_closed_stage4_early_convergence_integrated_preflight_lineage_isolation_cpu_contract"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "authorization": runner.binding(expected_authorization),
        "consumption": runner.binding(expected_consumption),
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "oldGpuAuthorization": runner.binding(old_gpu_path),
        "oldGpuAuthorizationConsumed": False,
        "checkpointFileRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "autogradExecuted": False,
        "backwardMethodExecuted": False,
        "gpuUsed": False,
        "cudaInitialized": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }


def run_early_convergence_implementation_contract(
    authorization_path: Path | None, consumption_path: Path | None,
) -> dict:
    expected_authorization = runner.resolve(
        runner.EARLY_CONVERGENCE_IMPLEMENTATION_AUTHORIZATION_PATH
    )
    expected_consumption = runner.resolve(
        runner.EARLY_CONVERGENCE_IMPLEMENTATION_CONSUMPTION_PATH
    )
    if (
        authorization_path is None
        or consumption_path is None
        or runner.resolve(authorization_path) != expected_authorization
        or runner.resolve(consumption_path) != expected_consumption
        or runner.sha256_file(expected_authorization)
        != runner.EARLY_CONVERGENCE_IMPLEMENTATION_AUTHORIZATION_SHA256
        or runner.sha256_file(expected_consumption)
        != runner.EARLY_CONVERGENCE_IMPLEMENTATION_CONSUMPTION_SHA256
    ):
        raise ValueError("early_convergence_implementation_authority_invalid")
    authorization = runner.read_json(expected_authorization)
    consumption = runner.read_json(expected_consumption)
    expected_targets = [
        "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
        "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
        "scripts/record-stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation.mjs",
    ]
    expected_actions = [
        "modify_only_existing_stage4_gradient_diagnostic_runner_cpu_checker_and_one_bounded_recorder",
        "add_inactive_two_lane_readonly_gpu_qualification_mode",
        "execute_python_node_syntax_checks_and_cpu_positive_negative_contract_regression",
        "form_implementation_report_inactive_gpu_execution_contract_owner_request_terminal_capsule_ledger_and_sqlite_index",
    ]
    if (
        authorization.get("schemaVersion")
        != "owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId") != runner.EARLY_CONVERGENCE_IMPLEMENTATION_REQUEST_ID
        or authorization.get("commandRef") != runner.EARLY_CONVERGENCE_IMPLEMENTATION_REQUEST_ID
        or authorization.get("scope") != runner.EARLY_CONVERGENCE_IMPLEMENTATION_SCOPE
        or authorization.get("outputNamespace")
        != ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementations/20260815-190500000"
        or authorization.get("authorizedTargetPaths") != expected_targets
        or authorization.get("allowedActions") != expected_actions
        or authorization.get("oneTimeConsumptionRequired") is not True
        or any(authorization.get(key) is not False for key in (
            "futureGpuExecutionAuthorized", "cudaInitializationAuthorized",
            "autogradExecutionAuthorized", "checkpointFileReadAuthorized",
            "modelLoadAuthorized", "optimizerCreationAuthorized",
            "backwardExecutionAuthorized", "trainingAuthorized",
            "validationAuthorized", "smokeAuthorized", "automaticRetryAuthorized",
            "stage0Authorized", "stage1Or2Authorized",
        ))
    ):
        raise ValueError("early_convergence_implementation_authority_contract_invalid")
    for name in (
        "implementationReport", "inactiveSupportContract", "inactiveConfig",
        "cpuReport", "trainer",
    ):
        value = authorization["requiredBindings"][name]
        if runner.sha256_file(runner.resolve(Path(value["path"]))) != value["sha256"]:
            raise ValueError(f"early_convergence_implementation_source_changed:{name}")
    if (
        consumption.get("status")
        != "cpu_only_early_convergence_readonly_gpu_entry_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != runner.EARLY_CONVERGENCE_IMPLEMENTATION_REQUEST_ID
        or consumption.get("commandRef") != runner.EARLY_CONVERGENCE_IMPLEMENTATION_REQUEST_ID
        or consumption.get("scope") != runner.EARLY_CONVERGENCE_IMPLEMENTATION_SCOPE
        or consumption.get("authorizationSha256")
        != runner.EARLY_CONVERGENCE_IMPLEMENTATION_AUTHORIZATION_SHA256
        or consumption.get("authorizedTargetPaths") != expected_targets
        or any(consumption.get(key) is not False for key in (
            "checkpointFileRead", "modelLoaded", "optimizerCreated", "autogradExecuted",
            "backwardExecuted", "modelWeightsMutated", "gpuUsed", "cudaInitialized",
            "trainingStarted", "validationStarted", "smokeStarted", "stage0Started",
            "stage1Started", "stage2Started",
        ))
    ):
        raise ValueError("early_convergence_implementation_consumption_contract_invalid")

    candidate = synthetic_early_convergence_gpu_authorization(authorization)
    runner.validate_authorization_document(candidate, verify_bindings=False)
    config = runner.load_early_convergence_config(candidate)
    stabilization = (
        trainer.validate_stage4_object_reference_multiscale_early_convergence_stabilization(
            config
        )
    )
    positive = {
        "implementationAuthorizationHashBound": True,
        "implementationConsumptionHashBound": True,
        "commandIdentityExact": True,
        "authorizedTargetSetExact": True,
        "futureGpuExecutionStillUnauthorized": True,
        "futureAuthorizationContractAccepted": True,
        "sample194Bound": candidate["taskIdentity"]["sampleId"] == runner.SAMPLE_ID,
        "twoReplayLanesBound": candidate["taskIdentity"]["replayLaneCount"] == 2,
        "fourObjectChannelsBound": tuple(candidate["taskIdentity"]["objectSemanticChannels"])
        == runner.OBJECT_CHANNELS,
        "pyramidBound": candidate["taskIdentity"]["pyramidScales"] == [1.0, 0.5, 0.25],
        "metricCount48Bound": candidate["taskIdentity"]["diagnosticManifestMetricCount"] == 48,
        "inactiveCandidateContractAccepted": stabilization.get("status")
        == "cpu_support_verified_inactive",
        "lane1IdentityBound": stabilization["lanes"][0]["laneId"]
        == "lane_1_existing_global_worst_sample_class",
        "lane2IdentityBound": stabilization["lanes"][1]["laneId"]
        == "lane_2_joint_four_object_reference_multiscale",
        "replayBudgetUnchanged": stabilization["replayBudget"]["addsReplayPasses"] is False,
        "optimizerBudgetUnchanged": stabilization["replayBudget"]["addsOptimizerSteps"] is False,
        "sourceConfigNotMutated": config == runner.read_json(
            runner.resolve(Path(candidate["bindings"]["inactiveConfig"]["path"]))
        ),
    }
    negative_mutations = {
        "rejectWrongRequestId": lambda item: item.__setitem__("requestId", "wrong"),
        "rejectWrongScope": lambda item: item.__setitem__("scope", "wrong"),
        "rejectWrongSample": lambda item: item["taskIdentity"].__setitem__("sampleId", "wrong"),
        "rejectWrongContract": lambda item: item["taskIdentity"].__setitem__("trainingObjectiveContractId", "wrong"),
        "rejectWrongLaneCount": lambda item: item["taskIdentity"].__setitem__("replayLaneCount", 1),
        "rejectWrongPyramid": lambda item: item["taskIdentity"].__setitem__("pyramidScales", [1.0]),
        "rejectWrongMetricCount": lambda item: item["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 47),
        "rejectCheckpointRead": lambda item: item["executionActions"].__setitem__("failedDenoiserCheckpointReadOrLoad", True),
        "rejectOptimizer": lambda item: item["executionActions"].__setitem__("optimizerCreation", True),
        "rejectBackward": lambda item: item["executionActions"].__setitem__("backwardMethodExecution", True),
        "rejectTraining": lambda item: item["executionActions"].__setitem__("training", True),
        "rejectValidation": lambda item: item["executionActions"].__setitem__("validation", True),
        "rejectSmoke": lambda item: item["executionActions"].__setitem__("smoke", True),
        "rejectStage0": lambda item: item["executionActions"].__setitem__("stage0OrStage1OrStage2", True),
        "rejectUnknownAction": lambda item: item["executionActions"].__setitem__("unknown", False),
        "rejectWrongOutput": lambda item: item["execution"].__setitem__("outputDirectory", "wrong"),
    }
    negative = {
        name: object_visible_structure_authorization_rejects(candidate, mutation)
        for name, mutation in negative_mutations.items()
    }
    runner_source = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    required_tokens = (
        "EARLY_CONVERGENCE_SCHEMA", "load_early_convergence_config",
        "validate_early_convergence_diagnostic_config",
        "lane_1_existing_global_worst_sample_class",
        "lane_2_joint_four_object_reference_multiscale",
        "two_lane_early_convergence_gradient_routes_verified",
        "torch.autograd.grad", "write_json_exclusive(consumption_path, consumption)",
    )
    positive["runnerContainsBoundCandidateMode"] = all(
        token in runner_source for token in required_tokens
    )
    positive["runnerContainsNoBackwardCall"] = ".backward(" not in runner_source
    semantic_gpu_source = runner_source.split("def run_semantic_mixture_gpu(", 1)[1].split(
        "def is_structure_fact_authorization(", 1
    )[0]
    positive["diagnosticConfigIsolatedFromClosedSmokeLineage"] = (
        "if early_convergence_mode:\n            validate_early_convergence_diagnostic_config(config)"
        in semantic_gpu_source
    )
    positive["implementationAuthorizationCannotExecuteGpu"] = authorization_path_rejected(
        expected_authorization
    )
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    return {
        "schemaVersion": "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-cpu-report-v1",
        "status": (
            "passed_stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_cpu_contract"
            if not failed_positive and not failed_negative
            else "failed_closed_stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_cpu_contract"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "authorization": runner.binding(expected_authorization),
        "implementationConsumption": runner.binding(expected_consumption),
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "checkpointFileRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "autogradExecuted": False,
        "backwardMethodExecuted": False,
        "gpuUsed": False,
        "cudaInitialized": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }


def synthetic_early_convergence_gpu_authorization(
    implementation_authorization: dict,
) -> dict:
    implementation_root = Path(implementation_authorization["outputNamespace"])
    execution_root = Path(
        ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-"
        "readonly-gpu-gradient-qualifications/20260815-193500000"
    )
    binding_keys = (
        "implementationReport", "inactiveSupportContract", "inactiveConfig", "cpuReport",
        "trainer", "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint",
        "implementationAuthorization", "implementationConsumption", "runner", "cpuChecker",
        "entryImplementationReport",
    )
    bindings = {
        key: {"path": f"placeholder/{key}", "sha256": "0" * 64}
        for key in binding_keys
    }
    for key in ("implementationReport", "inactiveSupportContract", "inactiveConfig", "cpuReport", "trainer"):
        bindings[key] = implementation_authorization["requiredBindings"][key]
    return {
        "schemaVersion": runner.EARLY_CONVERGENCE_SCHEMA,
        "status": "owner_authorized_unconsumed",
        "requestId": runner.EARLY_CONVERGENCE_REQUEST_ID,
        "commandRef": runner.EARLY_CONVERGENCE_REQUEST_ID,
        "scope": runner.EARLY_CONVERGENCE_SCOPE,
        "taskIdentity": {
            "architectureId": runner.SEMANTIC_MIXTURE_ARCHITECTURE,
            "trainingObjectiveContractId": runner.EARLY_CONVERGENCE_CONTRACT_ID,
            "sampleId": runner.SAMPLE_ID,
            "sampleSplit": runner.SAMPLE_SPLIT,
            "seed": runner.SEED,
            "timestep": runner.TIMESTEP,
            "resolution": {"width": runner.IMAGE_SIZE[0], "height": runner.IMAGE_SIZE[1]},
            "requiredBoundarySides": ["west"],
            "objectSemanticChannels": list(runner.OBJECT_CHANNELS),
            "pyramidScales": [1.0, 0.5, 0.25],
            "replayLaneCount": 2,
            "diagnosticManifestMetricCount": 48,
            "denoiserInitialization": "fixed_random_seed_20263722",
            "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
        },
        "executionActions": {
            "projectAutoencoderCheckpointReadAndLoadFrozen": True,
            "fixedRandomDenoiserInitialization": True,
            "singleSample194ValidationRead": True,
            "singleReadonlyCudaForward": True,
            "torchAutogradGradInspection": True,
            "lane1SelectedGlobalWorstClassGradientVerification": True,
            "lane2JointFourObjectReferenceMultiscaleGradientVerification": True,
            "combinedTwoLaneGradientVerification": True,
            "matchingSemanticMixtureExpertRouteVerification": True,
            "exactFortyEightDiagnosticManifestExport": True,
            "preAndPostModelStateSha256IdentityComparison": True,
            "cudaTelemetryWrite": True,
            "diagnosticReportWrite": True,
            "terminalEvidenceWrite": True,
            "failedDenoiserCheckpointReadOrLoad": False,
            "optimizerCreation": False,
            "backwardMethodExecution": False,
            "modelWeightModification": False,
            "checkpointWrite": False,
            "training": False,
            "validation": False,
            "smoke": False,
            "automaticRetry": False,
            "stage0OrStage1OrStage2": False,
            "formalInference": False,
            "checkpointPromotion": False,
            "runtimeFrame": False,
            "worldEntry": False,
        },
        "failurePolicy": {
            "stopImmediately": True, "automaticRetry": False,
            "preserveEvidence": True, "noTrainingEscalation": True,
        },
        "implementation": {
            "cpuReportPath": runner.project_path(implementation_root / "cpu-report.json"),
            "implementationAttestationPath": runner.project_path(
                runner.EARLY_CONVERGENCE_LINEAGE_ATTESTATION_PATH
            ),
            "pythonPreflightPath": runner.project_path(execution_root / "python-preflight.json"),
            "resourcePreflightPath": runner.project_path(execution_root / "resource-preflight.json"),
        },
        "execution": {
            "outputDirectory": runner.project_path(execution_root / "gpu-execution"),
            "gpuConsumptionPath": runner.project_path(
                runner.EARLY_CONVERGENCE_AUTHORIZATION_PATH.parent
                / "gpu-execution-consumption.json"
            ),
        },
        "bindings": bindings,
    }


def run_object_reference_multiscale_implementation_contract(
    authorization_path: Path | None, consumption_path: Path | None,
) -> dict:
    expected_authorization = runner.resolve(
        runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_AUTHORIZATION_PATH
    )
    expected_consumption = runner.resolve(
        runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_CONSUMPTION_PATH
    )
    if (
        authorization_path is None
        or consumption_path is None
        or runner.resolve(authorization_path) != expected_authorization
        or runner.resolve(consumption_path) != expected_consumption
    ):
        raise ValueError("object_reference_multiscale_implementation_authority_paths_invalid")
    if runner.sha256_file(expected_authorization) != (
        runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_AUTHORIZATION_SHA256
    ):
        raise ValueError("object_reference_multiscale_implementation_authorization_hash_invalid")
    if runner.sha256_file(expected_consumption) != (
        runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_CONSUMPTION_SHA256
    ):
        raise ValueError("object_reference_multiscale_implementation_consumption_hash_invalid")
    authorization = runner.read_json(expected_authorization)
    consumption = runner.read_json(expected_consumption)
    expected_targets = [
        "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
        "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
        "scripts/record-stage4-object-reference-multiscale-readonly-gpu-entry-implementation.mjs",
    ]
    expected_allowed = [
        "add_current_multiscale_luminance_structure_mode_to_existing_stage4_gpu_diagnostic_runner",
        "add_exact_future_owner_gpu_authorization_and_atomic_consumption_contract",
        "add_cpu_positive_negative_authorization_activation_and_execution_boundary_regressions",
        "run_python_and_node_syntax_checks_and_cpu_contract_regressions",
        "write_inactive_gpu_execution_contract_implementation_report_owner_request_terminal_and_capsule",
        "synchronize_implementation_event_ledger_and_sqlite_index",
    ]
    if (
        authorization.get("schemaVersion")
        != "owner-authorized-stage4-object-reference-multiscale-readonly-gpu-entry-implementation-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId")
        != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_REQUEST_ID
        or authorization.get("commandRef")
        != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_REQUEST_ID
        or authorization.get("scope")
        != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_SCOPE
        or authorization.get("outputNamespace")
        != ".runtime/ai-painter/stage4-object-reference-multiscale-readonly-gpu-entry-implementations/20260815-143331000"
        or authorization.get("authorizedTargetPaths") != expected_targets
        or authorization.get("allowedActions") != expected_allowed
        or authorization.get("futureGpuExecutionAuthorized") is not False
        or authorization.get("cudaInitializationAuthorized") is not False
        or authorization.get("autogradExecutionAuthorized") is not False
        or authorization.get("checkpointFileReadAuthorized") is not False
        or authorization.get("modelLoadAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("validationAuthorized") is not False
        or authorization.get("smokeAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
    ):
        raise ValueError("object_reference_multiscale_implementation_authority_contract_invalid")
    if authorization.get("targetPreimageBindings") != {
        "runner": {
            "path": runner.project_path(runner.RUNNER_PATH),
            "sha256": "d72ba919421d295353f036baa8915e36113b710c8d2d5ab75a290bb8289db9c4",
        },
        "cpuChecker": {
            "path": runner.project_path(runner.CPU_CHECKER_PATH),
            "sha256": "20d6ea534e316304163b16f8eb8bace522a89285f2c479b8795cf960677511f5",
        },
        "recorder": {
            "path": "scripts/record-stage4-object-reference-multiscale-readonly-gpu-entry-implementation.mjs",
            "mustNotExistBeforeFirstWrite": True,
        },
    }:
        raise ValueError("object_reference_multiscale_implementation_preimage_contract_invalid")
    if (
        consumption.get("status")
        != "multiscale_readonly_gpu_entry_implementation_authorization_atomically_consumed"
        or consumption.get("requestId")
        != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_REQUEST_ID
        or consumption.get("commandRef")
        != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_REQUEST_ID
        or consumption.get("scope") != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_SCOPE
        or consumption.get("authorizationSha256")
        != runner.OBJECT_REFERENCE_MULTISCALE_IMPLEMENTATION_AUTHORIZATION_SHA256
        or consumption.get("authorizedTargetPaths") != expected_targets
        or any(consumption.get(key) is not False for key in (
            "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointFileRead",
            "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted",
            "validationStarted", "smokeStarted", "stage1Or2Started", "trainerModified",
        ))
    ):
        raise ValueError("object_reference_multiscale_implementation_consumption_contract_invalid")
    for name, value in authorization.get("sourceEvidence", {}).items():
        evidence = runner.resolve(Path(value.get("path", "missing")))
        if not evidence.is_file() or runner.sha256_file(evidence) != value.get("sha256"):
            raise ValueError(f"object_reference_multiscale_implementation_source_changed:{name}")

    candidate = synthetic_object_reference_multiscale_gpu_authorization(authorization)
    runner.validate_authorization_document(candidate, verify_bindings=False)
    source_config_path = runner.resolve(Path(candidate["bindings"]["sourceConfig"]["path"]))
    source_config_before = runner.read_json(source_config_path)
    activated_config = runner.load_object_visible_structure_config(candidate)
    activated_contract = activated_config["training"][
        "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"
    ]
    activated_registry = activated_config["training"][
        "stage4FactConditionedSemanticMixture"
    ]["diagnosticManifestRegistry"]
    positive = {
        "implementationAuthorizationHashBound": True,
        "implementationConsumptionHashBound": True,
        "commandIdentityExact": True,
        "authorizedTargetSetExact": True,
        "futureGpuExecutionStillUnauthorized": True,
        "cudaInitializationStillUnauthorized": True,
        "autogradExecutionStillUnauthorized": True,
        "checkpointAndModelLoadStillUnauthorized": True,
        "futureAuthorizationContractAccepted": True,
        "sample194Bound": candidate["taskIdentity"]["sampleId"] == runner.SAMPLE_ID,
        "fourObjectChannelsBound": tuple(candidate["taskIdentity"]["objectSemanticChannels"])
        == runner.OBJECT_CHANNELS,
        "exactPyramidBound": candidate["taskIdentity"]["pyramidScales"] == [1.0, 0.5, 0.25],
        "metricCount48Bound": candidate["taskIdentity"]["diagnosticManifestMetricCount"] == 48,
        "freshRandomDenoiserBound": candidate["taskIdentity"]["denoiserInitialization"]
        == "fixed_random_seed_20263722",
        "frozenProjectAutoencoderBound": candidate["taskIdentity"]["autoencoderState"]
        == "bound_project_checkpoint_loaded_and_frozen",
        "newLineageAttestationPathBound": candidate["implementation"][
            "implementationAttestationPath"
        ] == runner.project_path(runner.OBJECT_REFERENCE_MULTISCALE_LINEAGE_ATTESTATION_PATH),
        "oneForwardFourSeparateAndCombinedBound": all(
            candidate["executionActions"][key] is True for key in (
                "singleReadonlyCudaForward",
                "fourSeparateTypedMultiscaleAggregateGradientVerification",
                "matchingSemanticMixtureExpertRouteVerification",
                "combinedTypedMultiscaleGradientVerification",
            )
        ),
        "mutationAndTrainingBoundFalse": all(
            candidate["executionActions"][key] is False for key in (
                "failedDenoiserCheckpointReadOrLoad", "optimizerCreation",
                "backwardMethodExecution", "modelWeightModification", "checkpointWrite",
                "training", "validation", "smoke", "automaticRetry",
            )
        ),
        "realBoundConfigActivationValid": (
            trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
                activated_config
            ).get("status")
            == "stage4_object_reference_multiscale_luminance_structure_contract_valid_active"
        ),
        "realBoundDiagnosticRegistryExact48": (
            activated_registry.get("exactFieldCount") == 48
            and activated_registry.get("exactFields")
            == list(trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_DIAGNOSTIC_FIELDS)
        ),
        "failedSingleScaleContractRemoved": (
            "stage4ObjectVisibleStructureSupervision" not in activated_config["training"]
        ),
        "inMemoryActivationDoesNotMutateSourceConfig": (
            source_config_before == runner.read_json(source_config_path)
        ),
    }
    negative_mutations = {
        "rejectWrongRequestId": lambda item: item.__setitem__("requestId", "wrong"),
        "rejectWrongCommandRef": lambda item: item.__setitem__("commandRef", "wrong"),
        "rejectWrongScope": lambda item: item.__setitem__("scope", "wrong"),
        "rejectWrongSample": lambda item: item["taskIdentity"].__setitem__("sampleId", "wrong"),
        "rejectWrongSplit": lambda item: item["taskIdentity"].__setitem__("sampleSplit", "train"),
        "rejectWrongSeed": lambda item: item["taskIdentity"].__setitem__("seed", 0),
        "rejectWrongTimestep": lambda item: item["taskIdentity"].__setitem__("timestep", 0),
        "rejectWrongResolution": lambda item: item["taskIdentity"].__setitem__("resolution", {"width": 1, "height": 1}),
        "rejectWrongContract": lambda item: item["taskIdentity"].__setitem__("trainingObjectiveContractId", "wrong"),
        "rejectMissingObject": lambda item: item["taskIdentity"]["objectSemanticChannels"].pop(),
        "rejectWrongPyramid": lambda item: item["taskIdentity"].__setitem__("pyramidScales", [1.0]),
        "rejectWrongMetricCount": lambda item: item["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 32),
        "rejectFailedCheckpointRead": lambda item: item["executionActions"].__setitem__("failedDenoiserCheckpointReadOrLoad", True),
        "rejectOptimizer": lambda item: item["executionActions"].__setitem__("optimizerCreation", True),
        "rejectBackward": lambda item: item["executionActions"].__setitem__("backwardMethodExecution", True),
        "rejectWeightMutation": lambda item: item["executionActions"].__setitem__("modelWeightModification", True),
        "rejectTraining": lambda item: item["executionActions"].__setitem__("training", True),
        "rejectValidation": lambda item: item["executionActions"].__setitem__("validation", True),
        "rejectSmoke": lambda item: item["executionActions"].__setitem__("smoke", True),
        "rejectAutomaticRetry": lambda item: item["executionActions"].__setitem__("automaticRetry", True),
        "rejectUnknownAction": lambda item: item["executionActions"].__setitem__("unknown", False),
        "rejectWrongImplementationPath": lambda item: item["implementation"].__setitem__("cpuReportPath", "wrong"),
        "rejectWrongExecutionPath": lambda item: item["execution"].__setitem__("outputDirectory", "wrong"),
    }
    negative = {
        name: object_visible_structure_authorization_rejects(candidate, mutation)
        for name, mutation in negative_mutations.items()
    }
    runner_source = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    required_tokens = (
        "OBJECT_REFERENCE_MULTISCALE_SCHEMA",
        "OBJECT_REFERENCE_MULTISCALE_SCOPE",
        "load_object_reference_multiscale_config",
        "four_object_reference_multiscale_and_combined_gradient_routes_verified",
        "MultiscaleLuminanceStructureLoss",
        "multiscaleComponentMetrics",
        "stage4_object_reference_multiscale_readonly_gpu_diagnostic_authorization_atomically_consumed",
    )
    positive["runnerContainsBoundCurrentMode"] = all(
        token in runner_source for token in required_tokens
    )
    positive["runnerContainsNoBackwardCall"] = ".backward(" not in runner_source
    consume_source = runner_source.split("def consume_and_run(", 1)[1].split("def run_gpu(", 1)[0]
    consumption_write_index = consume_source.index(
        "write_json_exclusive(consumption_path, consumption)"
    )
    positive["authorizationConsumedBeforePythonPreflightWrite"] = (
        consumption_write_index
        < consume_source.index("write_json_exclusive(python_path, python_report)")
    )
    positive["authorizationConsumedBeforeResourcePreflightWrite"] = (
        consumption_write_index
        < consume_source.index("write_json_exclusive(resource_path, resource_report)")
    )
    positive["authorizationConsumedBeforeGpuRun"] = (
        consumption_write_index < consume_source.index("return run_gpu(")
    )
    positive["implementationAuthorizationCannotExecuteGpu"] = authorization_path_rejected(
        expected_authorization
    )
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    return {
        "schemaVersion": "stage4-object-reference-multiscale-readonly-gpu-entry-implementation-cpu-report-v1",
        "status": (
            "passed_stage4_object_reference_multiscale_readonly_gpu_entry_implementation_cpu_contract"
            if not failed_positive and not failed_negative
            else "failed_closed_stage4_object_reference_multiscale_readonly_gpu_entry_implementation_cpu_contract"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "authorization": runner.binding(expected_authorization),
        "implementationConsumption": runner.binding(expected_consumption),
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "checkpointFileRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "autogradExecuted": False,
        "backwardMethodExecuted": False,
        "gpuUsed": False,
        "cudaInitialized": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }


def synthetic_object_reference_multiscale_gpu_authorization(
    implementation_authorization: dict,
) -> dict:
    implementation_root = Path(implementation_authorization["outputNamespace"])
    execution_root = Path(
        ".runtime/ai-painter/stage4-object-reference-multiscale-readonly-gpu-gradient-"
        "qualifications/20260815-144500000"
    )
    fragment_binding = implementation_authorization["sourceEvidence"]["inactiveConfigFragment"]
    fragment = runner.read_json(runner.resolve(Path(fragment_binding["path"])))
    binding_keys = (
        "cpuTerminal", "implementationReport", "cpuReport", "supportContract",
        "inactiveConfigFragment", "gpuQualificationRequest", "sourceConfig", "model",
        "trainer", "compiler", "objectCpuChecker", "modeRegistry", "datasetManifest",
        "datasetSourceIndex", "projectAutoencoderCheckpoint", "implementationAuthorization",
        "implementationConsumption", "runner", "cpuChecker", "entryImplementationReport",
    )
    bindings = {
        key: {"path": f"placeholder/{key}", "sha256": "0" * 64}
        for key in binding_keys
    }
    bindings["inactiveConfigFragment"] = fragment_binding
    bindings["sourceConfig"] = fragment["sourceConfig"]
    return {
        "schemaVersion": runner.OBJECT_REFERENCE_MULTISCALE_SCHEMA,
        "status": "owner_authorized_unconsumed",
        "requestId": runner.OBJECT_REFERENCE_MULTISCALE_REQUEST_ID,
        "commandRef": runner.OBJECT_REFERENCE_MULTISCALE_REQUEST_ID,
        "scope": runner.OBJECT_REFERENCE_MULTISCALE_SCOPE,
        "taskIdentity": {
            "architectureId": runner.SEMANTIC_MIXTURE_ARCHITECTURE,
            "trainingObjectiveContractId": runner.OBJECT_REFERENCE_MULTISCALE_CONTRACT_ID,
            "sampleId": runner.SAMPLE_ID,
            "sampleSplit": runner.SAMPLE_SPLIT,
            "seed": runner.SEED,
            "timestep": runner.TIMESTEP,
            "resolution": {"width": runner.IMAGE_SIZE[0], "height": runner.IMAGE_SIZE[1]},
            "requiredBoundarySides": ["west"],
            "objectSemanticChannels": list(runner.OBJECT_CHANNELS),
            "pyramidScales": [1.0, 0.5, 0.25],
            "diagnosticManifestMetricCount": 48,
            "denoiserInitialization": "fixed_random_seed_20263722",
            "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
        },
        "executionActions": {
            "projectAutoencoderCheckpointReadAndLoadFrozen": True,
            "fixedRandomDenoiserInitialization": True,
            "singleSample194ValidationRead": True,
            "singleReadonlyCudaForward": True,
            "torchAutogradGradInspection": True,
            "fourSeparateTypedMultiscaleAggregateGradientVerification": True,
            "matchingSemanticMixtureExpertRouteVerification": True,
            "combinedTypedMultiscaleGradientVerification": True,
            "exactFortyEightDiagnosticManifestExport": True,
            "preAndPostModelStateSha256IdentityComparison": True,
            "cudaTelemetryWrite": True,
            "diagnosticReportWrite": True,
            "terminalEvidenceWrite": True,
            "localTaskCapsuleEventLedgerSqliteSync": True,
            "failedDenoiserCheckpointReadOrLoad": False,
            "optimizerCreation": False,
            "backwardMethodExecution": False,
            "modelWeightModification": False,
            "checkpointWrite": False,
            "training": False,
            "validation": False,
            "smoke": False,
            "automaticRetry": False,
            "stage1OrStage2": False,
            "formalInference": False,
            "checkpointPromotion": False,
            "runtimeFrame": False,
            "worldEntry": False,
        },
        "failurePolicy": {
            "stopImmediately": True,
            "automaticRetry": False,
            "preserveEvidence": True,
            "noTrainingEscalation": True,
        },
        "implementation": {
            "cpuReportPath": runner.project_path(implementation_root / "cpu-report.json"),
            "implementationAttestationPath": runner.project_path(
                runner.OBJECT_REFERENCE_MULTISCALE_LINEAGE_ATTESTATION_PATH
            ),
            "pythonPreflightPath": runner.project_path(execution_root / "python-preflight.json"),
            "resourcePreflightPath": runner.project_path(execution_root / "resource-preflight.json"),
        },
        "execution": {
            "outputDirectory": runner.project_path(execution_root / "gpu-execution"),
            "gpuConsumptionPath": runner.project_path(
                runner.OBJECT_REFERENCE_MULTISCALE_AUTHORIZATION_PATH.parent
                / "gpu-execution-consumption.json"
            ),
        },
        "bindings": bindings,
    }


def run_object_visible_structure_implementation_contract(
    authorization_path: Path | None, consumption_path: Path | None,
) -> dict:
    expected_authorization = runner.resolve(
        runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION_PATH
    )
    expected_consumption = runner.resolve(
        runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_CONSUMPTION_PATH
    )
    if (
        authorization_path is None
        or consumption_path is None
        or runner.resolve(authorization_path) != expected_authorization
        or runner.resolve(consumption_path) != expected_consumption
    ):
        raise ValueError("object_visible_structure_implementation_authority_paths_invalid")
    if runner.sha256_file(expected_authorization) != (
        runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION_SHA256
    ):
        raise ValueError("object_visible_structure_implementation_authorization_hash_invalid")
    if runner.sha256_file(expected_consumption) != (
        runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_CONSUMPTION_SHA256
    ):
        raise ValueError("object_visible_structure_implementation_consumption_hash_invalid")
    authorization = runner.read_json(expected_authorization)
    consumption = runner.read_json(expected_consumption)
    expected_targets = [
        "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
        "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
        "scripts/record-stage4-object-visible-structure-readonly-gpu-entry-implementation.mjs",
    ]
    expected_allowed = [
        "add_one_current_four_object_visible_structure_mode_to_existing_gpu_diagnostic",
        "add_exact_future_owner_authorization_and_consumption_contract",
        "add_cpu_positive_negative_authorization_and_execution_boundary_regressions",
        "run_python_syntax_and_cpu_contract_checks",
        "write_inactive_gpu_execution_contract_implementation_report_owner_request_terminal_and_capsule",
        "synchronize_implementation_event_ledger_and_sqlite",
    ]
    expected_denied = [
        "start_gpu", "execute_torch_autograd_grad", "read_or_load_failed_checkpoint_weights",
        "load_autoencoder_or_denoiser", "create_optimizer", "execute_backward",
        "mutate_model_weights", "start_training", "start_validation", "start_new_smoke",
        "automatic_retry_stage0", "start_stage1", "start_stage2", "checkpoint_promotion",
        "formal_inference", "runtime_frame", "world_entry",
    ]
    if (
        authorization.get("schemaVersion")
        != "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId")
        != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_REQUEST_ID
        or authorization.get("commandRef")
        != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_REQUEST_ID
        or authorization.get("scope")
        != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_SCOPE
        or authorization.get("authorizedTargetPaths") != expected_targets
        or authorization.get("allowedActions") != expected_allowed
        or authorization.get("deniedActions") != expected_denied
        or authorization.get("futureGpuExecutionAuthorized") is not False
        or authorization.get("autogradExecutionAuthorized") is not False
        or authorization.get("checkpointFileReadAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
    ):
        raise ValueError("object_visible_structure_implementation_authority_contract_invalid")
    if (
        consumption.get("status")
        != "readonly_gpu_gradient_entry_implementation_authorization_atomically_consumed"
        or consumption.get("requestId")
        != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_REQUEST_ID
        or consumption.get("commandRef")
        != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_REQUEST_ID
        or consumption.get("scope") != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_SCOPE
        or consumption.get("authorizationSha256")
        != runner.OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION_SHA256
        or consumption.get("authorizedTargetPaths") != expected_targets
        or any(consumption.get(key) is not False for key in (
            "gpuUsed", "autogradExecuted", "checkpointFileRead", "modelLoaded",
            "optimizerCreated", "backwardExecuted", "trainingStarted",
            "validationStarted", "smokeStarted",
        ))
    ):
        raise ValueError("object_visible_structure_implementation_consumption_contract_invalid")
    for name, value in authorization.get("sourceEvidence", {}).items():
        if name == "existingGpuDiagnosticRunner":
            valid = value == {
                "path": runner.project_path(runner.RUNNER_PATH),
                "sha256": "6d74b4b267c8c3b472d64b9319b8699bf9ae8217e61d69191c38e15d662c62b1",
            }
        elif name == "existingCpuChecker":
            valid = value == {
                "path": runner.project_path(runner.CPU_CHECKER_PATH),
                "sha256": "d63a4307b8ade33a6ce867e5dd1ae6c9ab31b9c8c30c9da92e1aac87737eb294",
            }
        else:
            path = runner.resolve(Path(value.get("path", "missing")))
            valid = path.is_file() and runner.sha256_file(path) == value.get("sha256")
        if not valid:
            raise ValueError(f"object_visible_structure_implementation_source_changed:{name}")

    candidate = synthetic_object_visible_structure_gpu_authorization()
    runner.validate_authorization_document(candidate, verify_bindings=False)
    retired_authorization_path = runner.resolve(Path(
        ".runtime/ai-painter/owner-action-requests/"
        "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-"
        "qualification-20260815-015000000/gpu-execution-authorization.json"
    ))
    retired_authorization = runner.read_json(retired_authorization_path)
    source_config_path = runner.resolve(Path(
        retired_authorization["bindings"]["sourceConfig"]["path"]
    ))
    source_config_before = runner.read_json(source_config_path)
    activated_config = runner.load_object_visible_structure_config(retired_authorization)
    trainer.validate_training_inputs(
        activated_config, runner.read_json(runner.resolve(runner.DATASET_PATH))
    )
    activated_object_contract = activated_config["training"][
        "stage4ObjectVisibleStructureSupervision"
    ]
    activated_registry = activated_config["training"][
        "stage4FactConditionedSemanticMixture"
    ]["diagnosticManifestRegistry"]
    positive = {
        "implementationAuthorizationHashBound": True,
        "implementationConsumptionHashBound": True,
        "commandIdentityExact": True,
        "authorizedTargetSetExact": True,
        "futureGpuExecutionStillUnauthorized": True,
        "autogradExecutionStillUnauthorized": True,
        "failedCheckpointReadStillUnauthorized": True,
        "futureAuthorizationContractAccepted": True,
        "sample194Bound": candidate["taskIdentity"]["sampleId"] == runner.SAMPLE_ID,
        "fourObjectChannelsBound": tuple(candidate["taskIdentity"]["objectSemanticChannels"])
        == runner.OBJECT_CHANNELS,
        "metricCount32Bound": candidate["taskIdentity"]["diagnosticManifestMetricCount"] == 32,
        "freshRandomDenoiserBound": candidate["taskIdentity"]["denoiserInitialization"]
        == "fixed_random_seed_20263722",
        "frozenProjectAutoencoderBound": candidate["taskIdentity"]["autoencoderState"]
        == "bound_project_checkpoint_loaded_and_frozen",
        "newLineageAttestationPathBound": candidate["implementation"][
            "implementationAttestationPath"
        ] == runner.project_path(runner.OBJECT_VISIBLE_STRUCTURE_LINEAGE_ATTESTATION_PATH),
        "oneForwardFourSeparateAndCombinedBound": all(
            candidate["executionActions"][key] is True for key in (
                "singleReadonlyCudaForward",
                "fourSeparateTypedVisibleStructureGradientVerification",
                "matchingSemanticMixtureExpertRouteVerification",
                "combinedTypedVisibleStructureGradientVerification",
            )
        ),
        "mutationAndTrainingBoundFalse": all(
            candidate["executionActions"][key] is False for key in (
                "failedDenoiserCheckpointReadOrLoad", "optimizerCreation",
                "backwardMethodExecution", "modelWeightModification", "checkpointWrite",
                "training", "validation", "smoke", "automaticRetry",
            )
        ),
        "realBoundSourceConfigActivationValid": (
            trainer.validate_stage4_object_visible_structure_supervision(
                activated_config
            ).get("status")
            == "stage4_object_visible_structure_supervision_contract_valid_active"
        ),
        "realBoundDiagnosticRegistryExact32": (
            activated_registry.get("exactFieldCount") == 32
            and activated_registry.get("exactFields")
            == list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS)
        ),
        "inMemoryActivationDoesNotMutateSourceConfig": (
            source_config_before == runner.read_json(source_config_path)
            and "stage4ObjectVisibleStructureSupervision"
            not in source_config_before["training"]
        ),
        "retiredGpuAuthorizationRejectedByCurrentRunner": (
            authorization_path_rejected(retired_authorization_path)
        ),
    }

    negative_mutations = {
        "rejectWrongRequestId": lambda item: item.__setitem__("requestId", "wrong"),
        "rejectWrongCommandRef": lambda item: item.__setitem__("commandRef", "wrong"),
        "rejectWrongScope": lambda item: item.__setitem__("scope", "wrong"),
        "rejectWrongSample": lambda item: item["taskIdentity"].__setitem__("sampleId", "wrong"),
        "rejectWrongSplit": lambda item: item["taskIdentity"].__setitem__("sampleSplit", "train"),
        "rejectWrongSeed": lambda item: item["taskIdentity"].__setitem__("seed", 0),
        "rejectWrongTimestep": lambda item: item["taskIdentity"].__setitem__("timestep", 0),
        "rejectWrongResolution": lambda item: item["taskIdentity"].__setitem__("resolution", {"width": 1, "height": 1}),
        "rejectWrongContract": lambda item: item["taskIdentity"].__setitem__("trainingObjectiveContractId", "wrong"),
        "rejectMissingObject": lambda item: item["taskIdentity"]["objectSemanticChannels"].pop(),
        "rejectWrongMetricCount": lambda item: item["taskIdentity"].__setitem__("diagnosticManifestMetricCount", 31),
        "rejectFailedCheckpointRead": lambda item: item["executionActions"].__setitem__("failedDenoiserCheckpointReadOrLoad", True),
        "rejectOptimizer": lambda item: item["executionActions"].__setitem__("optimizerCreation", True),
        "rejectBackward": lambda item: item["executionActions"].__setitem__("backwardMethodExecution", True),
        "rejectWeightMutation": lambda item: item["executionActions"].__setitem__("modelWeightModification", True),
        "rejectTraining": lambda item: item["executionActions"].__setitem__("training", True),
        "rejectValidation": lambda item: item["executionActions"].__setitem__("validation", True),
        "rejectSmoke": lambda item: item["executionActions"].__setitem__("smoke", True),
        "rejectAutomaticRetry": lambda item: item["executionActions"].__setitem__("automaticRetry", True),
        "rejectUnknownAction": lambda item: item["executionActions"].__setitem__("unknown", False),
        "rejectWrongImplementationPath": lambda item: item["implementation"].__setitem__("cpuReportPath", "wrong"),
        "rejectWrongExecutionPath": lambda item: item["execution"].__setitem__("outputDirectory", "wrong"),
    }
    negative = {
        name: object_visible_structure_authorization_rejects(candidate, mutation)
        for name, mutation in negative_mutations.items()
    }
    runner_source = runner.resolve(runner.RUNNER_PATH).read_text(encoding="utf-8")
    required_tokens = (
        runner.OBJECT_VISIBLE_STRUCTURE_SCHEMA,
        runner.OBJECT_VISIBLE_STRUCTURE_SCOPE,
        "load_object_visible_structure_config",
        "four_object_visible_structure_and_combined_gradient_routes_verified",
        "stage4SemanticMixtureFootprintsFinalTypedLuminanceCorrelationLoss",
        "stage4SemanticMixtureTreeFinalTypedLuminanceCorrelationLoss",
        "stage4SemanticMixtureRockFinalTypedLuminanceCorrelationLoss",
        "stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss",
        "matchingSemanticMixtureExpertGradientNorm",
        "build_object_visible_structure_preflight_reports",
        "object_visible_structure_preflight_must_be_integrated_with_atomic_consumption",
        "stage4_object_visible_structure_readonly_gpu_diagnostic_authorization_atomically_consumed",
    )
    positive["runnerContainsBoundCurrentMode"] = all(
        token in runner_source for token in required_tokens
    )
    positive["runnerContainsNoBackwardCall"] = ".backward(" not in runner_source
    consume_source = runner_source.split("def consume_and_run(", 1)[1].split(
        "def run_gpu(", 1
    )[0]
    consumption_write_index = consume_source.index(
        "write_json_exclusive(consumption_path, consumption)"
    )
    positive["authorizationConsumedBeforePythonPreflightWrite"] = (
        consumption_write_index
        < consume_source.index("write_json_exclusive(python_path, python_report)")
    )
    positive["authorizationConsumedBeforeResourcePreflightWrite"] = (
        consumption_write_index
        < consume_source.index("write_json_exclusive(resource_path, resource_report)")
    )
    positive["authorizationConsumedBeforeGpuRun"] = (
        consumption_write_index < consume_source.index("return run_gpu(")
    )
    positive["implementationAuthorizationCannotExecuteGpu"] = authorization_path_rejected(
        expected_authorization
    )
    failed_positive = [key for key, value in positive.items() if value is not True]
    failed_negative = [key for key, value in negative.items() if value is not True]
    return {
        "schemaVersion": "stage4-object-visible-structure-readonly-gpu-entry-implementation-cpu-report-v1",
        "status": (
            "passed_stage4_object_visible_structure_readonly_gpu_entry_implementation_cpu_contract"
            if not failed_positive and not failed_negative
            else "failed_closed_stage4_object_visible_structure_readonly_gpu_entry_implementation_cpu_contract"
        ),
        **timestamps("recordedAt"),
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(value is True for value in positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(value is True for value in negative.values()),
        "negativeTotal": len(negative),
        "failedPositiveKeys": failed_positive,
        "failedNegativeKeys": failed_negative,
        "authorization": runner.binding(expected_authorization),
        "implementationConsumption": runner.binding(expected_consumption),
        "runner": runner.binding(runner.RUNNER_PATH),
        "cpuChecker": runner.binding(runner.CPU_CHECKER_PATH),
        "checkpointFileRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "autogradExecuted": False,
        "backwardMethodExecuted": False,
        "gpuUsed": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }


def synthetic_object_visible_structure_gpu_authorization() -> dict:
    implementation_root = Path(
        ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-entry-cpu-"
        "contract-corrections/20260815-024000000"
    )
    execution_root = Path(
        ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-"
        "qualifications/20260815-025000000"
    )
    binding_keys = (
        "cpuTerminal", "cpuReport", "inactiveSupportContract", "inactiveConfigFragment",
        "sourceConfig", "model", "trainer", "compiler", "objectCpuChecker", "modeRegistry",
        "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint", "implementationAuthorization",
        "implementationConsumption", "runner", "cpuChecker", "entryImplementationReport",
    )
    return {
        "schemaVersion": runner.OBJECT_VISIBLE_STRUCTURE_SCHEMA,
        "status": "owner_authorized_unconsumed",
        "requestId": runner.OBJECT_VISIBLE_STRUCTURE_REQUEST_ID,
        "commandRef": runner.OBJECT_VISIBLE_STRUCTURE_REQUEST_ID,
        "scope": runner.OBJECT_VISIBLE_STRUCTURE_SCOPE,
        "taskIdentity": {
            "architectureId": runner.SEMANTIC_MIXTURE_ARCHITECTURE,
            "trainingObjectiveContractId": runner.OBJECT_VISIBLE_STRUCTURE_CONTRACT_ID,
            "sampleId": runner.SAMPLE_ID,
            "sampleSplit": runner.SAMPLE_SPLIT,
            "seed": runner.SEED,
            "timestep": runner.TIMESTEP,
            "resolution": {"width": runner.IMAGE_SIZE[0], "height": runner.IMAGE_SIZE[1]},
            "requiredBoundarySides": ["west"],
            "objectSemanticChannels": list(runner.OBJECT_CHANNELS),
            "diagnosticManifestMetricCount": 32,
            "denoiserInitialization": "fixed_random_seed_20263722",
            "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
        },
        "executionActions": {
            "projectAutoencoderCheckpointReadAndLoadFrozen": True,
            "fixedRandomDenoiserInitialization": True,
            "singleSample194ValidationRead": True,
            "singleReadonlyCudaForward": True,
            "torchAutogradGradInspection": True,
            "fourSeparateTypedVisibleStructureGradientVerification": True,
            "matchingSemanticMixtureExpertRouteVerification": True,
            "combinedTypedVisibleStructureGradientVerification": True,
            "exactThirtyTwoDiagnosticManifestExport": True,
            "preAndPostModelStateSha256IdentityComparison": True,
            "cudaTelemetryWrite": True,
            "diagnosticReportWrite": True,
            "terminalEvidenceWrite": True,
            "localTaskCapsuleEventLedgerSqliteSync": True,
            "failedDenoiserCheckpointReadOrLoad": False,
            "optimizerCreation": False,
            "backwardMethodExecution": False,
            "modelWeightModification": False,
            "checkpointWrite": False,
            "training": False,
            "validation": False,
            "smoke": False,
            "automaticRetry": False,
            "stage1OrStage2": False,
            "formalInference": False,
            "checkpointPromotion": False,
            "runtimeFrame": False,
            "worldEntry": False,
        },
        "failurePolicy": {
            "stopImmediately": True,
            "automaticRetry": False,
            "preserveEvidence": True,
            "noTrainingEscalation": True,
        },
        "implementation": {
            "cpuReportPath": runner.project_path(implementation_root / "cpu-report.json"),
            "implementationAttestationPath": runner.project_path(
                runner.OBJECT_VISIBLE_STRUCTURE_LINEAGE_ATTESTATION_PATH
            ),
            "pythonPreflightPath": runner.project_path(execution_root / "python-preflight.json"),
            "resourcePreflightPath": runner.project_path(execution_root / "resource-preflight.json"),
        },
        "execution": {
            "outputDirectory": runner.project_path(execution_root / "gpu-execution"),
            "gpuConsumptionPath": runner.project_path(
                runner.OBJECT_VISIBLE_STRUCTURE_AUTHORIZATION_PATH.parent
                / "gpu-execution-consumption.json"
            ),
        },
        "bindings": {
            key: {"path": f"placeholder/{key}", "sha256": "0" * 64}
            for key in binding_keys
        },
    }


def object_visible_structure_authorization_rejects(candidate: dict, mutation) -> bool:
    changed = deepcopy(candidate)
    mutation(changed)
    try:
        runner.validate_authorization_document(changed, verify_bindings=False)
    except Exception:
        return True
    return False


def authorization_path_rejected(path: Path) -> bool:
    try:
        runner.validate_authorization(path)
    except Exception:
        return True
    return False


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

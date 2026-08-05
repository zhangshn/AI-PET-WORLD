from argparse import ArgumentParser
import ast
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = Path("ml/ai-painter/scripts/run_ai_assisted_v7_r5_stage4_readonly_diagnostic_gpu_smoke.py")
RUNNER_SHA256 = "e715d757c5e468de9b65202adf6904d0ecca92e216e019835eb8f682f0f58b9f"
LEGACY_REPAIR_RUNNER_SHA256 = "0b4e7120b5926263ec68ac5a3f5f11e509ae1f5f37443019f144edc4a4132900"
CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_v7_r5_stage4_readonly_diagnostic_gpu_smoke_cpu.py")
REPAIR_AUTHORIZATION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-action-request-v7-r5-stage4-readonly-diagnostic-cpu-order-checker-fix-retry-20260805/request.json"
)
REPAIR_AUTHORIZATION_SHA256 = "3a740e8de585253ed6405cf2e8da4a67e688c9bb1da2ba1589e8bfb69e52052e"
REPAIR_IMPLEMENTATION_CONSUMPTION_PATH = REPAIR_AUTHORIZATION_PATH.parent / "implementation-authorization-consumption.json"
REPAIR_IMPLEMENTATION_CONSUMPTION_SHA256 = "18c5e330c8cf565f18c838f1ddda09667d2a2a688a2d5678e83df534ce778ca1"
REPAIR_COMMAND_REF = "owner-authorized-v7-r5-stage4-readonly-diagnostic-cpu-ast-order-check-fix-one-retry-20260805"
REPAIR_SCOPE = "fix_cpu_checker_to_validate_executable_cuda_call_order_then_preflights_and_one_same_readonly_gpu_diagnostic_only"


def main() -> int:
    parser = ArgumentParser(description="CPU-only authorization and boundary regression for the read-only Stage 4 GPU diagnostic.")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()

    runner = load_runner()
    preflight = runner.validate_read_only_preflight()
    authorization = runner.read_json(runner.resolve(runner.AUTHORIZATION_PATH))
    implementation = runner.read_json(runner.resolve(runner.IMPLEMENTATION_CONSUMPTION_PATH))
    config = runner.read_json(runner.resolve(runner.CONFIG_PATH))
    selection = runner.read_json(runner.resolve(runner.SELECTION_CONTRACT_PATH))
    config_cpu = runner.read_json(runner.resolve(runner.CONFIG_CPU_REPORT_PATH))
    manifest = runner.read_json(runner.resolve(runner.STAGE0_MANIFEST_PATH))
    dataset_manifest = runner.read_json(runner.resolve(runner.DATASET_MANIFEST_PATH))
    source_index = runner.read_json(runner.resolve(runner.SOURCE_INDEX_PATH))
    runner_source = runner.resolve(RUNNER_PATH).read_text(encoding="utf-8")
    repair_authorization = read_bound_json(REPAIR_AUTHORIZATION_PATH, REPAIR_AUTHORIZATION_SHA256)
    repair_implementation = read_bound_json(REPAIR_IMPLEMENTATION_CONSUMPTION_PATH, REPAIR_IMPLEMENTATION_CONSUMPTION_SHA256)
    validate_repair_authorization(repair_authorization, repair_implementation)
    cuda_init_call_lines = executable_call_lines(runner_source, "torch.cuda.init")
    cuda_reset_call_lines = executable_call_lines(runner_source, "torch.cuda.reset_peak_memory_stats")
    object_metric_probe = build_object_metric_probe(runner, config)
    object_prefix_pairs = (
        ("ObjectFootprints", "objectFootprints"),
        ("ObjectTree", "objectTree"),
        ("ObjectRock", "objectRock"),
        ("ObjectVegetation", "objectVegetation"),
    )
    object_measurements = ("IndependentLoss", "GradientContribution", "DecodedResponsePrototypeMae")
    formal_object_keys = [f"stage4Diagnostic{prefix}{measurement}" for prefix, _ in object_prefix_pairs for measurement in object_measurements]
    legacy_object_keys = [f"stage4Diagnostic{prefix}{measurement}" for _, prefix in object_prefix_pairs for measurement in object_measurements]
    alias_pairs = list(zip(formal_object_keys, legacy_object_keys))

    positive = {
        "preflightPassedCheckpointNotReadGpuNotStarted": preflight.get("status") == "all_readonly_diagnostic_object_metric_prefix_fix_retry_preflights_passed_checkpoint_not_read_gpu_not_started",
        "runnerHashBound": sha256_file(resolve(RUNNER_PATH)) == RUNNER_SHA256,
        "repairAuthorizationBound": repair_authorization.get("ownerDecision", {}).get("commandRef") == REPAIR_COMMAND_REF,
        "repairImplementationConsumptionBound": repair_implementation.get("authorizationSha256") == REPAIR_AUTHORIZATION_SHA256,
        "authorizationBound": preflight.get("authorization", {}).get("sha256") == runner.AUTHORIZATION_SHA256,
        "implementationConsumptionBound": preflight.get("implementationConsumption", {}).get("sha256") == runner.IMPLEMENTATION_CONSUMPTION_SHA256,
        "inactiveConfigBound": preflight.get("config", {}).get("sha256") == runner.CONFIG_SHA256,
        "selectionContractBound": preflight.get("selectionContract", {}).get("sha256") == runner.SELECTION_CONTRACT_SHA256,
        "trainerHashBound": preflight.get("trainer", {}).get("sha256") == runner.TRAINER_SHA256,
        "allTwelveFormalObjectMetricKeysPresent": all(key in object_metric_probe for key in formal_object_keys),
        "allTwelveLegacyObjectMetricAliasesPresent": all(key in object_metric_probe for key in legacy_object_keys),
        "formalAndLegacyObjectMetricAliasesShareValues": all(object_metric_probe[formal] is object_metric_probe[legacy] for formal, legacy in alias_pairs),
        "formalObjectMetricValuesFinite": all(bool(runner.torch.isfinite(object_metric_probe[key]).item()) for key in formal_object_keys),
        "objectDiagnosticGradientAvailableOnCpuProbe": float(object_metric_probe["stage4DiagnosticObjectGradientAvailable"]) == 1.0,
        "singleValidationSampleBound": preflight.get("sample", {}).get("sampleId") == runner.SAMPLE_ID and preflight.get("sample", {}).get("split") == "validation",
        "conditionLabelBound": preflight.get("sample", {}).get("conditionLabel") == runner.CONDITION_LABEL,
        "sampleImageBound": preflight.get("sample", {}).get("imageSha256") == runner.SAMPLE_IMAGE_SHA256,
        "conditionPackBound": preflight.get("sample", {}).get("conditionPackSha256") == runner.CONDITION_PACK_SHA256,
        "stage0CheckpointManifestIdentityBoundWithoutRead": preflight.get("checkpointBindingsFromImmutableManifestOnly", {}).get("stage0Sha256") == runner.STAGE0_CHECKPOINT_SHA256,
        "autoencoderCheckpointManifestIdentityBoundWithoutRead": preflight.get("checkpointBindingsFromImmutableManifestOnly", {}).get("autoencoderSha256") == runner.AUTOENCODER_CHECKPOINT_SHA256,
        "fixedResolutionBound": preflight.get("diagnostic", {}).get("resolution") == {"width": 256, "height": 192},
        "fixedTimestepBound": preflight.get("diagnostic", {}).get("timestep") == 999,
        "fixedSeedBound": preflight.get("diagnostic", {}).get("seed") == 20263722,
        "oneDenoiserForwardBound": preflight.get("diagnostic", {}).get("denoiserForwardPasses") == 1,
        "zeroLossBackwardBound": preflight.get("diagnostic", {}).get("lossBackwardPasses") == 0,
        "zeroOptimizerStepsBound": preflight.get("diagnostic", {}).get("optimizerSteps") == 0,
        "preflightCheckpointBoundaryClosed": preflight.get("checkpointFileRead") is False and preflight.get("checkpointLoaded") is False,
        "preflightGpuBoundaryClosed": preflight.get("gpuUsed") is False,
        "preflightTrainingBoundaryClosed": preflight.get("trainingStarted") is False and preflight.get("fullTrainingStarted") is False,
        "runnerContainsNoOptimizerConstruction": "torch.optim" not in runner_source,
        "runnerContainsNoLossBackwardCall": ".backward(" not in runner_source,
        "runnerContainsNoOptimizerStepCall": "optimizer.step(" not in runner_source,
        "runnerContainsNoCheckpointWrite": "torch.save(" not in runner_source,
        "cudaTelemetryResetUsesIntegerDeviceIndex": "torch.cuda.reset_peak_memory_stats(0)" in runner_source and "torch.cuda.reset_peak_memory_stats(device)" not in runner_source,
        "cudaTelemetryReadUsesIntegerDeviceIndex": "torch.cuda.max_memory_allocated(0)" in runner_source,
        "cudaContextExplicitlyInitialized": "torch.cuda.init()" in runner_source,
        "cudaDeviceZeroExplicitlyConfirmed": "current_device_index = int(torch.cuda.current_device())" in runner_source and "if current_device_index != 0:" in runner_source,
        "cudaContextInitializedBeforeTelemetryReset": len(cuda_init_call_lines) == 1 and len(cuda_reset_call_lines) == 1 and cuda_init_call_lines[0] < cuda_reset_call_lines[0],
        "exactExecutionStepWriterPresent": "def record_execution_step(" in runner_source and '"execution-steps"' in runner_source,
        "cudaContextInitializationStepMarkerPresent": 'complete_step(5, "cuda_context_initialized_and_device_zero_confirmed"' in runner_source,
        "failureTerminalRecordsLastCompletedStep": '"lastCompletedStep": execution_state["lastCompletedStep"]' in runner_source,
        "previousFailureEvidenceBound": preflight.get("previousFailure", {}).get("terminalSha256") == runner.PREVIOUS_FAILURE_TERMINAL_SHA256,
    }
    negative = negative_assertions(
        runner,
        authorization,
        implementation,
        config,
        selection,
        config_cpu,
        manifest,
        dataset_manifest,
        source_index,
    )
    negative.update({
        "repairCommandIdentityMutationRejected": reject_repair_authorization(repair_authorization, repair_implementation, lambda a, i: a["ownerDecision"].__setitem__("commandRef", "wrong")),
        "repairScopeMutationRejected": reject_repair_authorization(repair_authorization, repair_implementation, lambda a, i: a["ownerDecision"].__setitem__("scope", "wrong")),
        "runnerModificationAuthorizationRejected": reject_repair_authorization(repair_authorization, repair_implementation, lambda a, i: a["resolution"].__setitem__("runnerModificationAuthorized", True)),
        "checkerFixMutationRejected": reject_repair_authorization(repair_authorization, repair_implementation, lambda a, i: a["taskIdentity"]["authorizedCodeChange"].__setitem__("newAssertion", "string index")),
    })
    failures = [key for key, passed in {**positive, **negative}.items() if not passed]
    report = {
        "schemaVersion": "v7-r5-stage4-readonly-diagnostic-gpu-smoke-cpu-regression-v1",
        "status": "passed_cpu_only_readonly_diagnostic_gpu_smoke_gate_checkpoint_not_read_gpu_not_started" if not failures else "failed_cpu_only_readonly_diagnostic_gpu_smoke_gate",
        "device": "cpu",
        **timestamps("generatedAt"),
        "inputs": {
            "authorizationPath": runner.project_path(runner.AUTHORIZATION_PATH),
            "authorizationSha256": runner.AUTHORIZATION_SHA256,
            "implementationConsumptionPath": runner.project_path(runner.IMPLEMENTATION_CONSUMPTION_PATH),
            "implementationConsumptionSha256": runner.IMPLEMENTATION_CONSUMPTION_SHA256,
            "runnerPath": runner.project_path(RUNNER_PATH),
            "runnerSha256": RUNNER_SHA256,
            "checkerPath": runner.project_path(CHECKER_PATH),
            "checkerSha256": sha256_file(resolve(CHECKER_PATH)),
            "repairAuthorizationPath": project_path(REPAIR_AUTHORIZATION_PATH),
            "repairAuthorizationSha256": REPAIR_AUTHORIZATION_SHA256,
            "repairImplementationConsumptionPath": project_path(REPAIR_IMPLEMENTATION_CONSUMPTION_PATH),
            "repairImplementationConsumptionSha256": REPAIR_IMPLEMENTATION_CONSUMPTION_SHA256,
        },
        "positive": positive,
        "negative": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "boundaries": runner.closed_boundaries(checkpoint_read=False, checkpoint_loaded=False, gpu_used=False),
    }
    write_json_exclusive(args.report, report)
    if failures:
        terminal = terminal_record(runner, "r5_stage4_readonly_diagnostic_gpu_smoke_cpu_gate_failed_closed", failures, args, report)
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps(terminal, ensure_ascii=False, indent=2))
        return 1
    contract = build_contract(runner, args, report, preflight)
    write_json_exclusive(args.contract, contract)
    terminal = terminal_record(runner, "r5_stage4_readonly_diagnostic_gpu_smoke_cpu_gate_verified_checkpoint_not_read_gpu_not_started", [], args, report, contract)
    write_json_exclusive(args.terminal, terminal)
    print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(resolve(args.terminal))}, ensure_ascii=False, indent=2))
    return 0


def build_object_metric_probe(runner, config):
    torch = runner.torch
    predicted_rgb = torch.full((1, 3, 8, 8), 0.25, dtype=torch.float32, requires_grad=True)
    target_rgb = torch.zeros_like(predicted_rgb)
    channel_order = list(config["conditionChannelOrder"])
    conditions = torch.zeros((1, len(channel_order), 8, 8), dtype=torch.float32)
    for channel in runner.trainer.V7_R5_STAGE4_OBJECT_DIAGNOSTIC_CHANNELS:
        conditions[:, channel_order.index(channel)] = 1.0
    return runner.trainer.object_semantic_diagnostic_metrics(
        predicted_rgb,
        target_rgb,
        conditions,
        config,
    )


def negative_assertions(runner, authorization, implementation, config, selection, config_cpu, manifest, dataset_manifest, source_index):
    return {
        "commandIdentityMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["ownerDecision"].__setitem__("commandRef", "wrong")),
        "scopeMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["ownerDecision"].__setitem__("scope", "wrong")),
        "sampleIdentityMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"].__setitem__("sampleId", "wrong")),
        "stage0CheckpointHashMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"].__setitem__("stage0CheckpointSha256", "0" * 64)),
        "autoencoderCheckpointHashMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"].__setitem__("autoencoderCheckpointSha256", "0" * 64)),
        "forwardCountMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"].__setitem__("forwardPassCount", 2)),
        "backwardCountMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"].__setitem__("backwardPassCount", 1)),
        "optimizerAuthorizationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["resolution"].__setitem__("optimizerCreationAuthorized", True)),
        "lossBackwardAuthorizationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["resolution"].__setitem__("lossBackwardAuthorized", True)),
        "weightMutationAuthorizationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["resolution"].__setitem__("modelWeightMutationAuthorized", True)),
        "trainingAuthorizationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["resolution"].__setitem__("trainingAuthorized", True)),
        "additionalAutomaticRetryAuthorizationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["resolution"].__setitem__("additionalAutomaticRetryAuthorized", True)),
        "formalObjectMetricPrefixMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"]["authorizedCodeChange"].__setitem__("formalPrefixes", ["wrong"])),
        "legacyObjectMetricAliasMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"]["authorizedCodeChange"].__setitem__("legacyAliasesMustRemain", False)),
        "trainerLogicExpansionRejected": reject_authorization(runner, authorization, implementation, lambda a, i: a["taskIdentity"]["authorizedCodeChange"].__setitem__("trainerLogicBeyondMetricKeysAuthorized", True)),
        "implementationConsumptionStatusMutationRejected": reject_authorization(runner, authorization, implementation, lambda a, i: i.__setitem__("status", "wrong")),
        "inactiveConfigActivationRejected": reject_config(runner, config, selection, config_cpu, lambda c, s, r: c.__setitem__("status", "active")),
        "trainingStatusActivationRejected": reject_config(runner, config, selection, config_cpu, lambda c, s, r: c["training"].__setitem__("trainingAuthorizationStatus", "owner_authorized")),
        "stage4ContractActivationRejected": reject_config(runner, config, selection, config_cpu, lambda c, s, r: c["training"]["stage4FullTrainingContract"].__setitem__("status", "active_single_execution")),
        "selectionContractFailureRejected": reject_config(runner, config, selection, config_cpu, lambda c, s, r: s.__setitem__("status", "failed")),
        "configCpuFailureRejected": reject_config(runner, config, selection, config_cpu, lambda c, s, r: r.__setitem__("failures", ["failure"])),
        "diagnosticStatusMutationRejected": reject_config(runner, config, selection, config_cpu, lambda c, s, r: c["training"]["stage4FailureDiagnostics"].__setitem__("status", "active")),
        "manifestStage0PathMutationRejected": reject_manifest(runner, manifest, dataset_manifest, lambda m, d: m.__setitem__("checkpointPath", "wrong")),
        "manifestStage0HashMutationRejected": reject_manifest(runner, manifest, dataset_manifest, lambda m, d: m.__setitem__("checkpointSha256", "0" * 64)),
        "manifestAutoencoderPathMutationRejected": reject_manifest(runner, manifest, dataset_manifest, lambda m, d: m.__setitem__("autoencoderCheckpointPath", "wrong")),
        "manifestAutoencoderHashMutationRejected": reject_manifest(runner, manifest, dataset_manifest, lambda m, d: m.__setitem__("autoencoderCheckpointSha256", "0" * 64)),
        "manifestDenoiserNotTrainedRejected": reject_manifest(runner, manifest, dataset_manifest, lambda m, d: m.__setitem__("denoiserTrained", False)),
        "manifestFormalInferenceClaimRejected": reject_manifest(runner, manifest, dataset_manifest, lambda m, d: m.__setitem__("formalInferenceEligible", True)),
        "sampleSplitMutationRejected": reject_sample(runner, source_index, lambda row: row.__setitem__("split", "train")),
        "sampleImageHashMutationRejected": reject_sample(runner, source_index, lambda row: row.__setitem__("imageSha256", "0" * 64)),
        "sampleConditionPackMutationRejected": reject_sample(runner, source_index, lambda row: row.__setitem__("conditionPackPath", "wrong")),
        "sampleCapacityRegistrationMutationRejected": reject_sample(runner, source_index, lambda row: row.__setitem__("v7CapacityContributionRegistered", False)),
        "sampleOwnerReviewMutationRejected": reject_sample(runner, source_index, lambda row: row.__setitem__("ownerReviewStatus", "pending")),
    }


def validate_repair_authorization(authorization, implementation):
    if (
        authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != REPAIR_COMMAND_REF
        or authorization.get("ownerDecision", {}).get("scope") != REPAIR_SCOPE
        or implementation.get("status") != "cpu_checker_ast_order_fix_scope_consumed_before_authorized_write"
        or implementation.get("authorizationSha256") != REPAIR_AUTHORIZATION_SHA256
        or implementation.get("commandRef") != REPAIR_COMMAND_REF
        or implementation.get("scope") != REPAIR_SCOPE
    ):
        raise ValueError("Stage 4 CPU checker repair authorization identity is invalid")
    identity = authorization.get("taskIdentity", {})
    if (
        identity.get("runnerSha256MustRemain") != LEGACY_REPAIR_RUNNER_SHA256
        or identity.get("cpuCheckerBeforeSha256") != "f76c88fc9ab708279e2b5ce299d713659e7f466bb2483ffd79af1aa781c818f9"
        or identity.get("authorizedCodeChange") != {
            "checkerOnly": True,
            "oldAssertion": "runner_source.index('torch.cuda.init()') < runner_source.index('torch.cuda.reset_peak_memory_stats(0)')",
            "newAssertion": "compare Python AST executable Call node line numbers only",
            "runnerModificationAuthorized": False,
        }
    ):
        raise ValueError("Stage 4 CPU checker repair task identity is invalid")
    resolution = authorization.get("resolution", {})
    for key in (
        "cpuCheckerAstOrderFixAuthorized",
        "cpuPositiveNegativeRegressionAuthorized",
        "pythonPreflightAuthorized",
        "gpuResourcePreflightAuthorized",
        "diskBudgetPreflightAuthorized",
        "atomicGpuExecutionConsumptionRequired",
        "sameCheckpointHashVerificationAuthorizedAfterPreflight",
        "sameCheckpointReadAndLoadAuthorizedAfterPreflight",
        "sameSingleSampleGpuForwardAuthorized",
        "samePredictedRgbDiagnosticAutogradAuthorized",
        "diagnosticAndTerminalEvidenceStorageAuthorized",
    ):
        if resolution.get(key) is not True:
            raise ValueError(f"Stage 4 CPU checker repair authorization is missing: {key}")
    for key in (
        "runnerModificationAuthorized",
        "optimizerCreationAuthorized",
        "lossBackwardAuthorized",
        "modelWeightMutationAuthorized",
        "checkpointWriteAuthorized",
        "trainingAuthorized",
        "fullTrainingAuthorized",
        "additionalAutomaticRetryAuthorized",
        "strictRevalidationAuthorized",
        "formalInferenceAuthorized",
        "checkpointFormalPromotionAuthorized",
        "runtimeFrameAuthorized",
        "worldEntryAuthorized",
    ):
        if resolution.get(key) is not False:
            raise ValueError(f"Stage 4 CPU checker repair boundary is open: {key}")


def reject_repair_authorization(authorization, implementation, mutate):
    a, i = deepcopy(authorization), deepcopy(implementation)
    mutate(a, i)
    try:
        validate_repair_authorization(a, i)
    except ValueError:
        return True
    return False


def executable_call_lines(source, dotted_name):
    tree = ast.parse(source)
    return [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and dotted_expression_name(node.func) == dotted_name
    ]


def dotted_expression_name(node):
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
        return ".".join(reversed(parts))
    return None


def read_bound_json(path, expected_hash):
    full_path = resolve(path)
    if not full_path.is_file() or sha256_file(full_path) != expected_hash:
        raise ValueError(f"bound JSON is missing or changed: {project_path(path)}")
    return json.loads(full_path.read_text(encoding="utf-8"))


def reject_authorization(runner, authorization, implementation, mutate):
    a = deepcopy(authorization)
    i = deepcopy(implementation)
    mutate(a, i)
    try:
        runner.validate_authorization(a, i)
    except ValueError:
        return True
    return False


def reject_config(runner, config, selection, config_cpu, mutate):
    c, s, r = deepcopy(config), deepcopy(selection), deepcopy(config_cpu)
    mutate(c, s, r)
    try:
        runner.validate_bound_config(c, s, r)
    except ValueError:
        return True
    return False


def reject_manifest(runner, manifest, dataset_manifest, mutate):
    m, d = deepcopy(manifest), deepcopy(dataset_manifest)
    mutate(m, d)
    try:
        runner.validate_manifest_bindings(m, d)
    except ValueError:
        return True
    return False


def reject_sample(runner, source_index, mutate):
    value = deepcopy(source_index)
    row = next(row for row in value["samples"] if row.get("sampleId") == runner.SAMPLE_ID)
    mutate(row)
    try:
        runner.validate_sample_binding(value)
    except ValueError:
        return True
    return False


def build_contract(runner, args, report, preflight):
    return {
        "schemaVersion": "v7-r5-stage4-readonly-diagnostic-gpu-smoke-runner-contract-v1",
        "status": "cpu_verified_checkpoint_not_read_gpu_not_started",
        "authorization": {"path": runner.project_path(runner.AUTHORIZATION_PATH), "sha256": runner.AUTHORIZATION_SHA256},
        "implementationConsumption": {"path": runner.project_path(runner.IMPLEMENTATION_CONSUMPTION_PATH), "sha256": runner.IMPLEMENTATION_CONSUMPTION_SHA256},
        "runner": {"path": runner.project_path(RUNNER_PATH), "sha256": RUNNER_SHA256},
        "cpuRegression": {
            "path": project_path(args.report),
            "sha256": sha256_file(resolve(args.report)),
            "positiveAssertionsPassed": report["positiveAssertionsPassed"],
            "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        },
        "execution": {
            "sampleId": runner.SAMPLE_ID,
            "conditionLabel": runner.CONDITION_LABEL,
            "stage0CheckpointSha256": runner.STAGE0_CHECKPOINT_SHA256,
            "autoencoderCheckpointSha256": runner.AUTOENCODER_CHECKPOINT_SHA256,
            "resolution": {"width": 256, "height": 192},
            "timestep": 999,
            "seed": 20263722,
            "denoiserForwardPasses": 1,
            "lossBackwardPasses": 0,
            "optimizerSteps": 0,
        },
        "activationGate": {
            "status": "requires_atomic_gpu_execution_consumption_after_python_gpu_and_resource_preflights",
            "checkpointFileRead": False,
            "checkpointLoaded": False,
            "gpuUsed": False,
            "training": False,
        },
        "preflight": preflight,
    }


def terminal_record(runner, status, blockers, args, report, contract=None):
    value = {
        "schemaVersion": "v7-r5-stage4-readonly-diagnostic-gpu-smoke-cpu-terminal-v1",
        "status": status,
        **timestamps("recordedAt"),
        "reportPath": project_path(args.report),
        "reportSha256": sha256_file(resolve(args.report)),
        "positiveAssertionsPassed": report["positiveAssertionsPassed"],
        "negativeAssertionsPassed": report["negativeAssertionsPassed"],
        "blockers": blockers,
        "nextAction": "python_gpu_resource_preflight_then_atomic_gpu_execution_consumption" if not blockers else "cpu_gate_failure_review_only",
        **runner.closed_boundaries(checkpoint_read=False, checkpoint_loaded=False, gpu_used=False),
    }
    if contract is not None:
        value["contractPath"] = project_path(args.contract)
        value["contractSha256"] = sha256_file(resolve(args.contract))
    return value


def load_runner():
    if not resolve(RUNNER_PATH).is_file() or sha256_file(resolve(RUNNER_PATH)) != RUNNER_SHA256:
        raise ValueError("Stage 4 read-only diagnostic runner is missing or changed")
    spec = importlib.util.spec_from_file_location("stage4_readonly_diagnostic_runner", resolve(RUNNER_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("Stage 4 read-only diagnostic runner import failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def timestamps(prefix):
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
    }


def write_json_exclusive(path, payload):
    full_path = resolve(path)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with full_path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve(path):
    return path if path.is_absolute() else ROOT / path


def project_path(path):
    full_path = resolve(path)
    try:
        return full_path.relative_to(ROOT).as_posix()
    except ValueError:
        return full_path.resolve().relative_to(ROOT.resolve()).as_posix()


if __name__ == "__main__":
    raise SystemExit(main())

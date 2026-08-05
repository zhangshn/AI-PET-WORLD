from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from train_ai_assisted_conditional_denoiser import (
    V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_ID,
    V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_PATH,
    V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256,
    V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS,
    V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_PATH,
    V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_SHA256,
    validate_v7_r5_candidate_contract,
    validate_v7_r5_stage3_internal_trainer_contract,
    validate_v7_training_authorization,
)


def main():
    parser = ArgumentParser(description="CPU authorization regression for the R5 stage-3 coverage-convergence GPU Smoke gate.")
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--selection-contract", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--parent-manifest", type=Path, required=True)
    parser.add_argument("--legacy-derived-config", type=Path, required=True)
    parser.add_argument("--trainer", type=Path, required=True)
    parser.add_argument("--runner", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    source = read_json(args.source_config)
    package = read_json(args.dataset_package)
    parent_manifest = read_json(args.parent_manifest)
    config = build_authorized_config(source, parent_manifest, args)
    base_contract = validate_v7_r5_candidate_contract(config)
    stage3_contract = validate_v7_r5_stage3_internal_trainer_contract(config)
    validate_v7_training_authorization(config, package)

    legacy_config = read_json(args.legacy_derived_config)
    legacy_base_contract = validate_v7_r5_candidate_contract(legacy_config)
    legacy_stage3_contract = validate_v7_r5_stage3_internal_trainer_contract(legacy_config)

    positive = {
        "immutableAuthorizationAccepted": True,
        "atomicConsumptionAccepted": True,
        "sourceConfigHashAccepted": sha256_file(args.source_config) == "0f35220968a020bd5b27d785380f1e20eacb85239bb598b567156c8f907185d6",
        "selectionContractHashAccepted": sha256_file(args.selection_contract) == "6af2a71585bfb66cdde858da27c39fd21f38d67c036294ae53d303bef7c03ab3",
        "baseContractActiveSmokeAccepted": base_contract["checkpointLoadingAuthorized"] is True,
        "stage3ContractActiveSmokeAccepted": stage3_contract["coverageConvergence"]["status"] == "r5_stage3_coverage_convergence_trainer_contract_valid_not_active",
        "activationWeightBound": config["training"]["pathActivationMassCalibration"]["weight"] == 0.625,
        "driftWeightBound": config["training"]["shortTrajectoryCoverageDrift"]["weight"] == 0.2875,
        "checkpointHashDeferredToRunner": config["training"]["ownerTrainingAuthorization"]["checkpointHashValidatedByRunnerAfterPythonPreflight"] is True,
        "singleGpuSmokeAuthorized": config["training"]["ownerTrainingAuthorization"]["singleSampleGpuOverfitSmokeAuthorized"] is True,
        "automaticRetryDisabled": config["training"]["ownerTrainingAuthorization"]["automaticRetryAuthorized"] is False,
        "fullTrainingDisabled": config["training"]["ownerTrainingAuthorization"]["fullTrainingAuthorized"] is False,
        "legacyBaseContractStillAccepted": legacy_base_contract["checkpointLoadingAuthorized"] is True,
        "legacyStage3ContractStillAccepted": legacy_stage3_contract["status"] == "r5_stage3_internal_trainer_contract_valid_not_active",
    }

    invalid_authorization_hash = deepcopy(config)
    invalid_authorization_hash["training"]["ownerTrainingAuthorization"]["authorizationSha256"] = "0" * 64
    invalid_consumption_hash = deepcopy(config)
    invalid_consumption_hash["training"]["ownerTrainingAuthorization"]["authorizationConsumptionSha256"] = "0" * 64
    invalid_checkpoint_loading = deepcopy(config)
    invalid_checkpoint_loading["training"]["ownerTrainingAuthorization"]["checkpointLoadingAuthorized"] = False
    invalid_optimizer = deepcopy(config)
    invalid_optimizer["training"]["ownerTrainingAuthorization"]["optimizerCreationAuthorized"] = False
    invalid_gpu = deepcopy(config)
    invalid_gpu["training"]["ownerTrainingAuthorization"]["gpuTrainingAuthorizedNow"] = False
    invalid_retry = deepcopy(config)
    invalid_retry["training"]["ownerTrainingAuthorization"]["automaticRetryAuthorized"] = True
    invalid_full_training = deepcopy(config)
    invalid_full_training["training"]["ownerTrainingAuthorization"]["fullTrainingAuthorized"] = True
    invalid_deferred_hash = deepcopy(config)
    invalid_deferred_hash["training"]["ownerTrainingAuthorization"]["checkpointHashValidatedByRunnerAfterPythonPreflight"] = False
    invalid_sample = deepcopy(config)
    invalid_sample["training"]["authorizedOverfitSampleId"] = "wrong-sample"
    invalid_condition = deepcopy(config)
    invalid_condition["training"]["authorizedOverfitConditionLabel"] = "wrong-condition"
    invalid_activation = deepcopy(config)
    invalid_activation["training"]["pathActivationMassCalibration"]["weight"] = 0.5
    invalid_drift = deepcopy(config)
    invalid_drift["training"]["shortTrajectoryCoverageDrift"]["weight"] = 0.2
    invalid_checkpoint_identity = deepcopy(config)
    invalid_checkpoint_identity["training"]["r5Stage3CheckpointContinuation"]["sourceCheckpointSha256"] = "1" * 64

    negative = {
        "authorizationHashMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_authorization_hash, package), "authorizationSha256 identity is invalid"),
        "consumptionHashMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_consumption_hash, package), "authorizationConsumptionSha256 identity is invalid"),
        "checkpointLoadingMissingRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_checkpoint_loading, package), "active Smoke is missing an execution authorization"),
        "optimizerMissingRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_optimizer, package), "active Smoke is missing an execution authorization"),
        "gpuMissingRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_gpu, package), "active Smoke is missing an execution authorization"),
        "automaticRetryRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_retry, package), "active Smoke opens a forbidden execution boundary"),
        "fullTrainingRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_full_training, package), "active Smoke opens a forbidden execution boundary"),
        "checkpointHashDeferralMissingRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_deferred_hash, package), "requires post-preflight runner checkpoint validation"),
        "sampleMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_sample, package), "sample identity mismatch"),
        "conditionMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_condition, package), "condition identity mismatch"),
        "activationWeightMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_activation, package), "activation-mass weight identity mismatch"),
        "driftWeightMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_drift, package), "drift weight identity mismatch"),
        "checkpointIdentityMismatchRejected": expect_value_error(lambda: validate_v7_training_authorization(invalid_checkpoint_identity, package), "parent checkpoint binding mismatch"),
    }
    assert all(positive.values()), positive
    assert all(negative.values()), negative

    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage3-coverage-convergence-smoke-authorization-cpu-regression-v1",
        "status": "passed_cpu_only_authorization_gate_checkpoint_not_read_gpu_not_started",
        "device": "cpu",
        "inputs": {
            "sourceConfigPath": args.source_config.as_posix(),
            "sourceConfigSha256": sha256_file(args.source_config),
            "selectionContractPath": args.selection_contract.as_posix(),
            "selectionContractSha256": sha256_file(args.selection_contract),
            "datasetPackagePath": args.dataset_package.as_posix(),
            "datasetPackageSha256": sha256_file(args.dataset_package),
            "trainerPath": args.trainer.as_posix(),
            "trainerSha256": sha256_file(args.trainer),
            "runnerPath": args.runner.as_posix(),
            "runnerSha256": sha256_file(args.runner),
        },
        "positiveRegression": positive,
        "negativeRegression": negative,
        "positiveAssertionsPassed": len(positive),
        "negativeAssertionsPassed": len(negative),
        "executionBoundary": {
            "checkpointFileRead": False,
            "checkpointDeserialized": False,
            "checkpointLoaded": False,
            "optimizerCreated": False,
            "modelWeightsModified": False,
            "gpuTrainingStarted": False,
            "automaticRetryStarted": False,
            "fullTrainingStarted": False,
            "strictRevalidationStarted": False,
            "formalInferenceStarted": False,
            "runtimeFrameStarted": False,
            "worldEntered": False,
        },
    }
    write_json_exclusive(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def build_authorized_config(source, parent_manifest, args):
    config = deepcopy(source)
    training = config["training"]
    config["status"] = V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS
    training["trainingAuthorizationStatus"] = V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS
    training["authorizedOverfitSampleId"] = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
    training["authorizedOverfitConditionLabel"] = "v7-complete-map-146"
    training["authorizedInitialization"] = "project_r5_single_sample_checkpoint_continuation"
    training["r5Stage3CheckpointContinuation"]["loadingAuthorizedNow"] = True
    training["r5Stage3CheckpointContinuation"]["sourceArchitectureVersion"] = parent_manifest["architectureVersion"]
    training["ownerTrainingAuthorization"].update({
        "authorizationId": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_ID,
        "authorizationPath": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_PATH,
        "authorizationSha256": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_SHA256,
        "authorizationConsumptionPath": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_PATH,
        "authorizationConsumptionSha256": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_CONSUMPTION_SHA256,
        "sourceConfigPath": args.source_config.as_posix(),
        "sourceConfigSha256": sha256_file(args.source_config),
        "selectionContractPath": args.selection_contract.as_posix(),
        "selectionContractSha256": sha256_file(args.selection_contract),
        "status": V7_REPAIR_R5_COVERAGE_CONVERGENCE_SMOKE_AUTHORIZATION_STATUS,
        "checkpointHashValidatedByRunnerAfterPythonPreflight": True,
        "checkpointLoadingAuthorized": True,
        "optimizerCreationAuthorized": True,
        "modelWeightMutationAuthorized": True,
        "gpuTrainingAuthorizedNow": True,
        "singleSampleGpuOverfitSmokeAuthorized": True,
        "automaticRetryAuthorized": False,
        "fullTrainingAuthorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    })
    return config


def expect_value_error(action, message):
    try:
        action()
    except ValueError as error:
        assert message in str(error), f"unexpected error: {error}"
        return True
    raise AssertionError(f"expected ValueError containing: {message}")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_exclusive(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()

from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path


ROOT = Path.cwd()
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
RUNNER_PATH = Path("scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs")
INACTIVE_CONFIG_PATH = Path(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/configs/ai-assisted-v7-r5-stage4-coverage-convergence-full-training-config-20260805-182000000.json")
DATASET_MANIFEST_PATH = Path("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
LEGACY_STAGE3_ACTIVE_CONFIG_PATH = Path(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-coverage-convergence/derived-configs/ai-assisted-v7-r5-stage3-coverage-convergence-checkpoint-continuation-overfit-smoke-2026-08-05T08-37-03-827Z.json")
AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/request.json"
AUTHORIZATION_SHA256 = "2bc4993cf339476d786a5c4a90dc60bb61bd0ade632f366c2414ef60bba5a07c"
IMPLEMENTATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/implementation-authorization-consumption.json"
IMPLEMENTATION_SHA256 = "698788ed3a5b5b87f25f92ef2234a5345be9a92b2aebb7ce8c8c20127ae690b4"
PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_full_training_preflight_only"


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    trainer = load_trainer()
    package = read_json(DATASET_MANIFEST_PATH)
    inactive = read_json(INACTIVE_CONFIG_PATH)
    config = build_preflight_config(inactive)
    positive: dict[str, bool] = {}
    negative: dict[str, bool] = {}
    failures: list[str] = []

    def record(group: dict[str, bool], name: str, passed: bool) -> None:
        group[name] = bool(passed)
        if not passed:
            failures.append(name)

    candidate = trainer.validate_v7_r5_candidate_contract(config)
    trainer.validate_v7_repair_r5_stage4_full_training_authorization(config, package, ROOT)
    record(positive, "stage4PreflightCandidateContractAccepted", candidate["status"] == "r5_candidate_contract_valid_for_stage4_preflight")
    record(positive, "stage3SmokeContinuationEpochContractPreserved", candidate["continuationEpochs"] == 30)
    record(positive, "immutableAuthorizationBound", sha256_file(Path(AUTHORIZATION_PATH)) == AUTHORIZATION_SHA256)
    record(positive, "implementationConsumptionBound", sha256_file(Path(IMPLEMENTATION_PATH)) == IMPLEMENTATION_SHA256)
    record(positive, "inactiveConfigBound", sha256_file(INACTIVE_CONFIG_PATH) == "c7a893604b55e3e1cb49ed288d7f723212034b13aed3456bf5822eaa175cb352")
    record(positive, "datasetCapacityBound", package.get("v7CapacityContributionCount") == 64)
    record(positive, "stageOrderBound", config["training"]["resolutionStages"] == [{"width": 256, "height": 192}, {"width": 512, "height": 384}, {"width": 1024, "height": 768}])
    record(positive, "epochCountBound", config["training"]["denoiserEpochs"] == 40)
    record(positive, "previewEpochsBound", config["training"]["fixedEpochPreviewPolicy"]["formalStage"] == [1, 5, 10, 20, 30, 40])
    record(positive, "stage0RandomInitializationBound", config["training"]["authorizedInitialization"] == "project_random_stage0_then_current_run_progressive_checkpoint_chain")
    record(positive, "stage3SmokeCheckpointLoadingClosed", config["training"]["r5Stage3CheckpointContinuation"]["loadingAuthorizedNow"] is False)
    record(positive, "activationMassWeightPreserved", config["training"]["pathActivationMassCalibration"]["weight"] == 0.625)
    record(positive, "coverageDriftWeightPreserved", config["training"]["shortTrajectoryCoverageDrift"]["weight"] == 0.2875)
    record(positive, "preflightExecutionFlagsClosed", not any(config["training"]["ownerTrainingAuthorization"].get(key) is True for key in ("checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized")))
    legacy = read_json(LEGACY_STAGE3_ACTIVE_CONFIG_PATH)
    legacy_contract = trainer.validate_v7_r5_candidate_contract(legacy)
    record(positive, "legacyStage3CandidateStillAccepted", legacy_contract["status"] == "r5_candidate_contract_valid_for_single_smoke")
    record(positive, "legacyR1FullTrainingValidatorPreserved", callable(trainer.validate_v7_repair_r1_full_training_authorization))

    expect_rejected(negative, failures, "authorizationHashMismatchRejected", trainer, package, config, lambda value: value["training"]["ownerTrainingAuthorization"].update(authorizationSha256="0" * 64))
    expect_rejected(negative, failures, "implementationHashMismatchRejected", trainer, package, config, lambda value: value["training"]["ownerTrainingAuthorization"].update(implementationConsumptionSha256="1" * 64))
    expect_rejected(negative, failures, "preflightGpuFlagRejected", trainer, package, config, lambda value: value["training"]["ownerTrainingAuthorization"].update(gpuTrainingAuthorizedNow=True))
    expect_rejected(negative, failures, "preflightOptimizerFlagRejected", trainer, package, config, lambda value: value["training"]["ownerTrainingAuthorization"].update(optimizerCreationAuthorized=True))
    expect_rejected(negative, failures, "automaticRetryRejected", trainer, package, config, lambda value: value["training"]["ownerTrainingAuthorization"].update(automaticRetryAuthorized=True))
    expect_rejected(negative, failures, "stage3CheckpointLoadingRejected", trainer, package, config, lambda value: value["training"]["r5Stage3CheckpointContinuation"].update(loadingAuthorizedNow=True))
    expect_rejected(negative, failures, "epochCountMismatchRejected", trainer, package, config, lambda value: value["training"].update(denoiserEpochs=39))
    expect_rejected(negative, failures, "stage3SmokeContinuationEpochMutationRejected", trainer, package, config, lambda value: value["training"]["r5BoundedSelectionEvidence"]["continuationEpochs"].update(selectedValue=40))
    expect_rejected(negative, failures, "previewEpochMismatchRejected", trainer, package, config, lambda value: value["training"]["fixedEpochPreviewPolicy"].update(formalStage=[1, 10, 20, 30, 40]))
    expect_rejected(negative, failures, "resolutionOrderMismatchRejected", trainer, package, config, lambda value: value["training"].update(resolutionStages=list(reversed(value["training"]["resolutionStages"]))))
    expect_rejected(negative, failures, "initializationMismatchRejected", trainer, package, config, lambda value: value["training"].update(authorizedInitialization="project_r5_single_sample_checkpoint_continuation"))
    expect_rejected(negative, failures, "activeStatusWithoutTrainingConsumptionRejected", trainer, package, config, activate_without_consumption)
    package_bad = deepcopy(package)
    package_bad["v7CapacityContributionCount"] = 63
    try:
        trainer.validate_v7_repair_r5_stage4_full_training_authorization(config, package_bad, ROOT)
        record(negative, "datasetCapacityMismatchRejected", False)
    except ValueError:
        record(negative, "datasetCapacityMismatchRejected", True)

    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage4-full-training-authorization-cpu-regression-v1",
        "status": "passed_cpu_only_stage4_authorization_and_lineage_gates_checkpoint_not_read_gpu_not_started" if not failures else "failed_cpu_only_stage4_authorization_and_lineage_gates",
        "device": "cpu",
        "inputs": {
            "authorizationPath": AUTHORIZATION_PATH,
            "authorizationSha256": AUTHORIZATION_SHA256,
            "implementationConsumptionPath": IMPLEMENTATION_PATH,
            "implementationConsumptionSha256": IMPLEMENTATION_SHA256,
            "inactiveConfigPath": INACTIVE_CONFIG_PATH.as_posix(),
            "inactiveConfigSha256": sha256_file(INACTIVE_CONFIG_PATH),
            "trainerPath": TRAINER_PATH.as_posix(),
            "trainerSha256": sha256_file(TRAINER_PATH),
            "runnerPath": RUNNER_PATH.as_posix(),
            "runnerSha256": sha256_file(RUNNER_PATH),
        },
        "positiveRegression": positive,
        "negativeRegression": negative,
        "positiveAssertionsPassed": sum(positive.values()),
        "negativeAssertionsPassed": sum(negative.values()),
        "failures": failures,
        "executionBoundary": {
            "stage3SmokeCheckpointFileRead": False,
            "autoencoderCheckpointFileRead": False,
            "checkpointDeserialized": False,
            "checkpointLoaded": False,
            "optimizerCreated": False,
            "modelWeightsModified": False,
            "gpuTrainingStarted": False,
            "automaticRetryStarted": False,
            "strictRevalidationStarted": False,
            "formalInferenceStarted": False,
            "checkpointFormallyPromoted": False,
            "runtimeFrameStarted": False,
            "worldEntered": False,
        },
    }
    write_json_exclusive(args.report, report)
    print(json.dumps({**report, "reportPath": args.report.as_posix(), "reportSha256": sha256_file(args.report)}, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


def build_preflight_config(inactive: dict) -> dict:
    config = deepcopy(inactive)
    config["status"] = "r5_stage4_full_training_read_only_preflight"
    training = config["training"]
    training["trainingAuthorizationStatus"] = PREFLIGHT_STATUS
    training["stage4FullTrainingContract"]["status"] = "read_only_preflight"
    authorization = training["ownerTrainingAuthorization"]
    authorization["status"] = PREFLIGHT_STATUS
    authorization["trainingExecutionConsumptionPath"] = None
    authorization["trainingExecutionConsumptionSha256"] = None
    for key in ("checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized", "singleSampleGpuOverfitSmokeAuthorized", "automaticRetryAuthorized", "strictRevalidationAuthorized", "validationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"):
        authorization[key] = False
    return config


def activate_without_consumption(value: dict) -> None:
    value["training"]["trainingAuthorizationStatus"] = "owner_authorized_v7_r5_stage4_full_training"
    authorization = value["training"]["ownerTrainingAuthorization"]
    authorization["status"] = "owner_authorized_v7_r5_stage4_full_training"
    for key in ("checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "fullTrainingAuthorized"):
        authorization[key] = True


def expect_rejected(group: dict[str, bool], failures: list[str], name: str, trainer, package: dict, source: dict, mutate) -> None:
    value = deepcopy(source)
    mutate(value)
    try:
        trainer.validate_v7_r5_candidate_contract(value)
        trainer.validate_v7_repair_r5_stage4_full_training_authorization(value, package, ROOT)
        group[name] = False
        failures.append(name)
    except ValueError:
        group[name] = True


def load_trainer():
    spec = importlib.util.spec_from_file_location("stage4_trainer", ROOT / TRAINER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("trainer_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_json(path: Path) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with (ROOT / path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_exclusive(path: Path, value: dict) -> None:
    resolved = ROOT / path
    resolved.parent.mkdir(parents=True, exist_ok=True)
    with resolved.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

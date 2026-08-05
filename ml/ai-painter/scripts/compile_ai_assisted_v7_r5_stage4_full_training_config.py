from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path


ROOT = Path.cwd()
AUTHORIZATION_PATH = Path(".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805/request.json")
AUTHORIZATION_SHA256 = "2bc4993cf339476d786a5c4a90dc60bb61bd0ade632f366c2414ef60bba5a07c"
IMPLEMENTATION_CONSUMPTION_PATH = AUTHORIZATION_PATH.parent / "implementation-authorization-consumption.json"
IMPLEMENTATION_CONSUMPTION_SHA256 = "698788ed3a5b5b87f25f92ef2234a5345be9a92b2aebb7ce8c8c20127ae690b4"
COMMAND_REF = "owner-authorized-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
SCOPE = "split_stage3_smoke_30_epoch_and_stage4_formal_40_epoch_contract_then_one_bounded_stage4_execution_only"
SOURCE_CONFIG_PATH = Path(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/stage3-coverage-convergence-isolated-configs/ai-assisted-v7-r5-stage3-coverage-convergence-isolated-config-2026-08-05T07-54-34-093Z/isolated-config.json")
SOURCE_CONFIG_SHA256 = "0f35220968a020bd5b27d785380f1e20eacb85239bb598b567156c8f907185d6"
SELECTION_CONTRACT_PATH = Path("data/ai-painter/system-governance/v7-r5-stage3-coverage-convergence-isolated-config-selection-contract.json")
SELECTION_CONTRACT_SHA256 = "6af2a71585bfb66cdde858da27c39fd21f38d67c036294ae53d303bef7c03ab3"
STAGE3_CLOSURE_REPORT_PATH = Path(".runtime/ai-painter/v7-r5-stage3-coverage-convergence-preview-review-recoveries/ai-assisted-v7-r5-stage3-offline-preview-review-recovery-2026-08-05T09-08-26-587Z/offline-preview-review-recovery-report.json")
STAGE3_CLOSURE_REPORT_SHA256 = "052ca39e5b446c67afeee8edead5eb8344ae7e6a7a38c5a228557c412b513e0b"
STAGE3_CLOSURE_TERMINAL_PATH = STAGE3_CLOSURE_REPORT_PATH.parent / "offline-preview-review-recovery-terminal.json"
STAGE3_CLOSURE_TERMINAL_SHA256 = "b78f72f0c463046e4db98c623cb5d4055bb14f0da7afb7515b1a9a1e8080c2b2"
DATASET_MANIFEST_PATH = Path("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
EXPECTED_SPLITS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
EXPECTED_STAGES = [
    {"width": 256, "height": 192},
    {"width": 512, "height": 384},
    {"width": 1024, "height": 768},
]
FORMAL_PREVIEWS = [1, 5, 10, 20, 30, 40]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--output-config", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    args = parser.parse_args()
    validate_inputs()
    source = read_json(SOURCE_CONFIG_PATH)
    config = deepcopy(source)
    config["status"] = "r5_stage4_coverage_convergence_full_training_config_compiled_not_active"
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage4-coverage-convergence-full-training"
    training = config["training"]
    training["trainingAuthorizationStatus"] = "not_authorized_candidate_only"
    training["denoiserEpochs"] = 40
    training["resolutionStages"] = deepcopy(EXPECTED_STAGES)
    training["authorizedInitialization"] = "project_random_stage0_then_current_run_progressive_checkpoint_chain"
    training["fixedEpochPreviewPolicy"] = {
        **training.get("fixedEpochPreviewPolicy", {}),
        "formalStage": FORMAL_PREVIEWS,
    }
    training["r5Stage3CheckpointContinuation"] = {
        **training["r5Stage3CheckpointContinuation"],
        "loadingAuthorizedNow": False,
        "checkpointFileReadByCompiler": False,
        "stage4TrainingInitializationSource": "forbidden_stage3_smoke_checkpoint_not_used",
    }
    training["stage4FullTrainingContract"] = {
        "status": "compiled_not_active",
        "datasetCapacityCount": 64,
        "splitCounts": EXPECTED_SPLITS,
        "stages": [
            {"index": 0, "width": 256, "height": 192, "epochs": 40, "initialization": "deterministic_project_random"},
            {"index": 1, "width": 512, "height": 384, "epochs": 40, "initialization": "current_run_stage_0_checkpoint_only"},
            {"index": 2, "width": 1024, "height": 768, "epochs": 40, "initialization": "current_run_stage_1_checkpoint_only"},
        ],
        "fixedPreviewEpochsPerStage": FORMAL_PREVIEWS,
        "machineReviewRequiredPerStage": True,
        "stopOnFirstFailure": True,
        "automaticRetryAuthorized": False,
        "stage3SmokeCheckpointInitializationAuthorized": False,
        "strictRevalidationAuthorized": False,
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": "owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805",
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "implementationConsumptionPath": project_path(IMPLEMENTATION_CONSUMPTION_PATH),
        "implementationConsumptionSha256": IMPLEMENTATION_CONSUMPTION_SHA256,
        "sourceConfigPath": project_path(SOURCE_CONFIG_PATH),
        "sourceConfigSha256": SOURCE_CONFIG_SHA256,
        "selectionContractPath": project_path(SELECTION_CONTRACT_PATH),
        "selectionContractSha256": SELECTION_CONTRACT_SHA256,
        "stage3ClosureReportPath": project_path(STAGE3_CLOSURE_REPORT_PATH),
        "stage3ClosureReportSha256": STAGE3_CLOSURE_REPORT_SHA256,
        "stage3ClosureTerminalPath": project_path(STAGE3_CLOSURE_TERMINAL_PATH),
        "stage3ClosureTerminalSha256": STAGE3_CLOSURE_TERMINAL_SHA256,
        "status": "not_authorized_candidate_only",
        "trainingExecutionConsumptionPath": None,
        "trainingExecutionConsumptionSha256": None,
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
    write_json_exclusive(args.output_config, config)
    now = datetime.now(timezone.utc)
    report = {
        "schemaVersion": "ai-assisted-v7-r5-stage4-full-training-config-compilation-v1",
        "status": "r5_stage4_full_training_config_compiled_not_active_checkpoint_not_read_gpu_not_started",
        "createdAtUtc": now.isoformat().replace("+00:00", "Z"),
        "createdAtAsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "implementationConsumptionPath": project_path(IMPLEMENTATION_CONSUMPTION_PATH),
        "implementationConsumptionSha256": IMPLEMENTATION_CONSUMPTION_SHA256,
        "sourceConfigPath": project_path(SOURCE_CONFIG_PATH),
        "sourceConfigSha256": SOURCE_CONFIG_SHA256,
        "outputConfigPath": project_path(args.output_config),
        "outputConfigSha256": sha256_file(args.output_config),
        "datasetManifestPath": project_path(DATASET_MANIFEST_PATH),
        "datasetManifestSha256": DATASET_MANIFEST_SHA256,
        "recordCount": 64,
        "splitCounts": EXPECTED_SPLITS,
        "stages": training["stage4FullTrainingContract"]["stages"],
        "fixedPreviewEpochsPerStage": FORMAL_PREVIEWS,
        "selectedValues": {
            "pathActivationMassCalibrationWeight": training["pathActivationMassCalibration"]["weight"],
            "shortTrajectoryCoverageDriftWeight": training["shortTrajectoryCoverageDrift"]["weight"],
        },
        "executionBoundary": {
            "stage3SmokeCheckpointFileRead": False,
            "autoencoderCheckpointFileRead": False,
            "checkpointLoaded": False,
            "optimizerCreated": False,
            "modelWeightsModified": False,
            "gpuTrainingStarted": False,
            "strictRevalidationStarted": False,
            "formalInferenceStarted": False,
            "runtimeFrameStarted": False,
            "worldEntered": False,
        },
    }
    write_json_exclusive(args.output_report, report)
    print(json.dumps({**report, "reportSha256": sha256_file(args.output_report)}, ensure_ascii=False, indent=2))
    return 0


def validate_inputs() -> None:
    for path, expected, code in (
        (AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"),
        (IMPLEMENTATION_CONSUMPTION_PATH, IMPLEMENTATION_CONSUMPTION_SHA256, "implementation_consumption"),
        (SOURCE_CONFIG_PATH, SOURCE_CONFIG_SHA256, "source_config"),
        (SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256, "selection_contract"),
        (STAGE3_CLOSURE_REPORT_PATH, STAGE3_CLOSURE_REPORT_SHA256, "stage3_closure_report"),
        (STAGE3_CLOSURE_TERMINAL_PATH, STAGE3_CLOSURE_TERMINAL_SHA256, "stage3_closure_terminal"),
        (DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"),
    ):
        if not path.is_file() or sha256_file(path) != expected:
            raise ValueError(f"{code}_missing_or_changed")
    authorization = read_json(AUTHORIZATION_PATH)
    implementation = read_json(IMPLEMENTATION_CONSUMPTION_PATH)
    if authorization.get("status") != "resolved_owner_authorized" or authorization.get("ownerDecision", {}).get("commandRef") != COMMAND_REF or authorization.get("ownerDecision", {}).get("scope") != SCOPE:
        raise ValueError("authorization_identity_invalid")
    if implementation.get("status") != "implementation_scope_consumed_before_authorized_writes_training_scope_not_consumed" or implementation.get("authorizationSha256") != AUTHORIZATION_SHA256:
        raise ValueError("implementation_consumption_invalid")
    closure = read_json(STAGE3_CLOSURE_REPORT_PATH)
    if closure.get("status") != "r5_stage3_coverage_convergence_gpu_smoke_passed_closed_after_offline_preview_review" or closure.get("stage3Closed") is not True:
        raise ValueError("stage3_not_successfully_closed")
    dataset = read_json(DATASET_MANIFEST_PATH)
    if dataset.get("v7CapacityContributionCount") != 64:
        raise ValueError("dataset_capacity_invalid")


def read_json(path: Path) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8") if not path.is_absolute() else path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    resolved = path if path.is_absolute() else ROOT / path
    digest = hashlib.sha256()
    with resolved.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path: Path) -> str:
    if not path.is_absolute():
        return path.as_posix()
    return path.absolute().relative_to(ROOT.absolute()).as_posix()


def write_json_exclusive(path: Path, value: dict) -> None:
    resolved = path if path.is_absolute() else ROOT / path
    resolved.parent.mkdir(parents=True, exist_ok=True)
    with resolved.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import traceback

from ai_painter.complete_world.dataset import (
    AiAssistedConditionalDenoiserDataset,
    is_ai_assisted_conditional_row,
    resolve_conditional_dataset_selection_contract,
)
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v8-stage4-dataset-selection-and-gradient-diagnostic-retry-20260808.json"
)
IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v8-stage4-dataset-selection-and-gradient-diagnostic-retry-20260808/"
    "implementation-consumption.json"
)
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
CONFIG_PATH = Path(
    ".runtime/ai-painter/v8-r5-stage4-decoded-domain-alignment-cpu-support/"
    "20260808-211500000/inactive-config.json"
)
FAILURE_PATH = Path(
    ".runtime/ai-painter/v8-r5-stage4-gradient-diagnostic/20260808-220000000/phase-terminal.json"
)
FAILURE_SHA256 = "89121b65a8fa991569b8122c884d087f6b866294ff9a24f9739f939059cd0974"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SPLITS = ("train", "validation", "challenge", "regression")
EXPECTED_COUNTS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--terminal", type=Path, required=True)
    args = parser.parse_args()
    try:
        authorization = validate_authorization()
        config = read_json(resolve(CONFIG_PATH))
        positive, negative, evidence = run_regressions(config)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        report = {
            "schemaVersion": "ai-painter-r5-stage4-v8-dataset-selection-cpu-regression-v1",
            "status": "passed_cpu_only_gpu_not_started" if not failed_positive and not failed_negative else "failed_closed_cpu_only",
            **timestamps("recordedAt"),
            "authorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": sha256_file(resolve(AUTHORIZATION_PATH))},
            "implementationConsumption": {"path": project_path(IMPLEMENTATION_CONSUMPTION_PATH), "sha256": sha256_file(resolve(IMPLEMENTATION_CONSUMPTION_PATH))},
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": failed_positive,
            "failedNegativeKeys": failed_negative,
            "evidence": evidence,
            "positivePassed": sum(value is True for value in positive.values()),
            "positiveTotal": len(positive),
            "negativePassed": sum(value is True for value in negative.values()),
            "negativeTotal": len(negative),
            "checkpointRead": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.report, report)
        if failed_positive or failed_negative:
            raise ValueError(f"dataset_selection_cpu_regression_failed:{failed_positive}:{failed_negative}")
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v8-dataset-selection-cpu-terminal-v1",
            "status": "v8_dataset_selection_cpu_contract_passed_closed",
            **timestamps("recordedAt"),
            "reportPath": project_path(args.report),
            "reportSha256": sha256_file(resolve(args.report)),
            "blockers": [],
            "nextAction": "create_one_new_independent_v8_gradient_diagnostic_authorization",
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(args.terminal, terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(args.terminal), "terminalSha256": sha256_file(resolve(args.terminal))}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        if not resolve(args.terminal).exists():
            terminal = {
                "schemaVersion": "ai-painter-r5-stage4-v8-dataset-selection-cpu-terminal-v1",
                "status": "v8_dataset_selection_cpu_contract_failed_closed",
                **timestamps("recordedAt"),
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "automaticRetryStarted": False,
                "gpuUsed": False,
                "trainingStarted": False,
            }
            write_json_exclusive(args.terminal, terminal)
        print(json.dumps(read_json(resolve(args.terminal)), ensure_ascii=False, indent=2))
        return 1


def validate_authorization() -> dict:
    authorization = read_json(resolve(AUTHORIZATION_PATH))
    if authorization.get("requestId") != "owner-authorized-v8-stage4-dataset-selection-and-gradient-diagnostic-retry-20260808":
        raise ValueError("authorization_identity_invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("authorization_status_invalid")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != authorization.get("requestId"):
        raise ValueError("authorization_command_ref_invalid")
    if decision.get("scope") != "fix_v8_dataset_selection_to_existing_64_v7_capacity_rows_cpu_regress_then_one_new_gradient_diagnostic_only":
        raise ValueError("authorization_scope_invalid")
    actions = authorization.get("authorizedActions", {})
    for key in (
        "datasetSelectionContractImplementation",
        "trainerDatasetSelectionIntegration",
        "diagnosticRunnerDatasetSelectionIntegration",
        "cpuPositiveNegativeRegression",
        "cpuEvidenceWrite",
        "independentGpuDiagnosticAuthorizationCreationAfterCpuPass",
        "atomicGpuDiagnosticConsumptionAfterAllPreflights",
        "oneGpuGradientDiagnostic",
        "autoencoderCheckpointReadDuringGpuDiagnostic",
    ):
        if actions.get(key) is not True:
            raise ValueError(f"authorized_action_{key}_closed")
    for key in (
        "oldDenoiserCheckpointRead",
        "optimizerCreation",
        "backwardExecution",
        "modelWeightMutation",
        "checkpointWrite",
        "training",
        "thirtyEpochSmoke",
        "fullTraining",
        "strictRevalidation",
        "formalInference",
        "checkpointPromotion",
        "runtimeFrame",
        "worldEntry",
        "automaticRetry",
    ):
        if actions.get(key) is not False:
            raise ValueError(f"forbidden_action_{key}_open")
    if sha256_file(resolve(FAILURE_PATH)) != FAILURE_SHA256:
        raise ValueError("previous_failure_terminal_missing_or_changed")
    failure = read_json(resolve(FAILURE_PATH))
    if failure.get("status") != "v8_gradient_diagnostic_failed_closed" or failure.get("failureMessage") != "diagnostic_sample_not_unique_in_validation_split":
        raise ValueError("previous_failure_terminal_content_invalid")
    consumption = read_json(resolve(IMPLEMENTATION_CONSUMPTION_PATH))
    if consumption.get("status") != "implementation_authorization_atomically_consumed":
        raise ValueError("implementation_consumption_status_invalid")
    if consumption.get("authorizationSha256") != sha256_file(resolve(AUTHORIZATION_PATH)):
        raise ValueError("implementation_consumption_authorization_sha_invalid")
    return authorization


def run_regressions(config: dict):
    selection = trainer.conditional_dataset_selection_contract(config)
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=selection,
        )
        for split in SPLITS
    }
    loaded = trainer.validate_loaded_v7_datasets(datasets)
    sample_occurrences = [
        split
        for split, dataset in datasets.items()
        for row in dataset.rows
        if row.get("sampleId") == SAMPLE_ID
    ]
    v7_config = deepcopy(config)
    v7_config["denoiserArchitecture"] = "multiscale_condition_unet_v7"
    legacy_v7_selection = trainer.conditional_dataset_selection_contract(v7_config)
    legacy_v7 = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=legacy_v7_selection,
        )
        for split in SPLITS
    }
    legacy_v7_evidence = trainer.validate_loaded_v7_datasets(legacy_v7)
    non_v7_config = deepcopy(config)
    non_v7_config["denoiserArchitecture"] = "multiscale_condition_unet_v6"
    legacy_current_selection = trainer.conditional_dataset_selection_contract(non_v7_config)
    legacy_current = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=legacy_current_selection,
        )
        for split in SPLITS
    }
    positive = {
        "v8SelectionContractExplicit": selection == "registered_v7_capacity_contribution_v1",
        "v8ActualSplitCounts48_8_4_4": loaded["actualSplitCounts"] == EXPECTED_COUNTS,
        "v8ActualCapacityCount64": loaded["actualLoadedV7CapacityCount"] == 64,
        "v8AllRowsCapacityRegistered": loaded["allRowsCapacityRegistered"] is True,
        "v8RecordIdsUnique64": loaded["uniqueRecordIdCount"] == 64,
        "v8CapacitySlotsUnique64": loaded["uniqueCapacitySlotCount"] == 64,
        "sample194OccursExactlyOnce": sample_occurrences == ["validation"],
        "sample194ValidationDatasetCountOne": sum(row.get("sampleId") == SAMPLE_ID for row in datasets["validation"].rows) == 1,
        "legacyV7SelectionPreserved": legacy_v7_selection == selection,
        "legacyV7SplitCountsPreserved": legacy_v7_evidence["actualSplitCounts"] == EXPECTED_COUNTS,
        "legacyNonV7SelectionPreserved": legacy_current_selection == "current_condition_identity_v1",
        "legacyNonV7ModeStillLoads": all(len(dataset) > 0 for dataset in legacy_current.values()),
        "datasetInstanceRecordsExplicitContract": all(dataset.selection_contract == selection for dataset in datasets.values()),
        "gpuNotUsed": True,
        "checkpointNotRead": True,
    }
    sample_row = next(row for row in datasets["validation"].rows if row.get("sampleId") == SAMPLE_ID)
    negative = {
        "unknownSelectionContractRejected": rejected(lambda: resolve_conditional_dataset_selection_contract(selection_contract="unregistered_external_rows")),
        "legacyFlagConflictRejected": rejected(lambda: resolve_conditional_dataset_selection_contract(require_v7_capacity_contribution=True, selection_contract="current_condition_identity_v1")),
        "sample194WrongSplitRejected": not is_ai_assisted_conditional_row(sample_row, "train", selection_contract=selection),
        "sample194MissingCapacityRegistrationRejected": rejects_mutated_row(sample_row, selection, lambda row: row.__setitem__("v7CapacityContributionRegistered", False)),
        "sample194MachineReviewFailureRejected": rejects_mutated_row(sample_row, selection, lambda row: row.__setitem__("machineReviewStatus", "failed")),
        "sample194OwnerApprovalMissingRejected": rejects_mutated_row(sample_row, selection, lambda row: row.__setitem__("ownerReviewStatus", "pending")),
        "externalAbsoluteSelectionInjectionRejected": rejected(lambda: resolve_conditional_dataset_selection_contract(selection_contract="D:/external/index.json")),
    }
    evidence = {
        "selectionContract": selection,
        "actualSplitCounts": loaded["actualSplitCounts"],
        "actualCapacityCount": loaded["actualLoadedV7CapacityCount"],
        "sample194Occurrences": sample_occurrences,
        "legacyV7SelectionContract": legacy_v7_selection,
        "legacyCurrentConditionSelectionContract": legacy_current_selection,
        "legacyCurrentConditionSplitCounts": {split: len(dataset) for split, dataset in legacy_current.items()},
    }
    return positive, negative, evidence


def rejected(action) -> bool:
    try:
        action()
    except (ValueError, TypeError):
        return True
    return False


def rejects_mutated_row(source, selection, mutate) -> bool:
    row = deepcopy(source)
    mutate(row)
    return not is_ai_assisted_conditional_row(row, row["split"], selection_contract=selection)


def resolve(path: Path) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value.resolve()
    local = (ROOT / value).resolve()
    if local.exists() or not str(value).replace("\\", "/").startswith(".runtime/"):
        return local
    return (Path("D:/AI-PET-WORLD-DATA/hot/runtime") / Path(*value.parts[1:])).resolve()


def project_path(path: Path) -> str:
    resolved = resolve(path)
    try:
        return str(resolved.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        runtime = Path("D:/AI-PET-WORLD-DATA/hot/runtime").resolve()
        return str(Path(".runtime") / resolved.relative_to(runtime)).replace("\\", "/")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(resolve(path).read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(resolve(path).read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())

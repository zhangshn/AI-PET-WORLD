from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = (
    "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity"
)
SCHEMA = (
    "owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-"
    "implementation-v1"
)
SCOPE = (
    "one_cpu_inactive_stage4_epoch_complete_per_class_worst_luminance_"
    "selection_and_checkpoint_identity_implementation"
)
GATE_FIELDS = (
    "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
    "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
    "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
    "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow",
    "worldEntryNow",
)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def validate_authorization(
    authorization_path: Path,
    authorization_sha256: str,
    consumption_path: Path,
    consumption_sha256: str,
) -> dict:
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("schemaVersion") != SCHEMA
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId") != authorization.get("commandRef")
        or authorization.get("scope") != SCOPE
        or authorization.get("checkpointReadAuthorized") is not False
        or authorization.get("optimizerCreationAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("modelWeightModificationAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
        or authorization.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("epoch-complete selection CPU authorization invalid")
    if (
        consumption.get("status") != "consumed_once"
        or consumption.get("requestId") != authorization["requestId"]
        or consumption.get("commandRef") != authorization["commandRef"]
        or consumption.get("scope") != SCOPE
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("epoch-complete selection CPU consumption invalid")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        source = (ROOT / binding["path"]).resolve()
        if not source.is_file() or sha256_file(source) != binding["sha256"]:
            raise ValueError(f"epoch-complete selection evidence changed:{name}")
    return authorization


def compile_config(source: dict) -> dict:
    result = deepcopy(source)
    training = result["training"]
    per_class = (
        trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
            result
        )
    )
    replay = trainer.validate_stage4_epoch_worst_sample_class_replay(result)
    if per_class is None or replay is None:
        raise ValueError("epoch-complete selection source contracts missing")
    identities = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    training[CONTRACT_KEY] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": (
            trainer.STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_ID
        ),
        "sourceContracts": {
            "perClassWorstSampleContractId": (
                trainer.STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
            ),
            "weightedPerSampleClassTensorSource": (
                "stage4_full_rollout_worst_sample_class_reference_luminance_"
                "obligation_losses.weightedPerSampleClassTensors"
            ),
            "derivedClassWeights": deepcopy(
                per_class["sourceContracts"]["derivedClassWeights"]
            ),
            "rolloutWeight": float(per_class["sourceContracts"]["rolloutWeight"]),
            "replayPassesPerObservedPrimaryBatch": int(
                replay["replay"]["passesPerObservedPrimaryBatch"]
            ),
            "freeNumericalWeightSelectionAllowed": False,
        },
        "trainingSelection": {
            "population": "all_48_train_split_records_in_one_completed_epoch",
            "classIdentities": identities,
            "scoreCollection": "detach_score_and_identity_only_during_current_epoch",
            "selection": "one_maximum_per_class_with_lexicographic_sample_id_tie_break",
            "differentiableApplication": (
                "recompute_selected_sample_class_from_same_approved_sources_in_existing_epoch_replay_budget"
            ),
            "classSchedule": (
                "round_robin_formal_class_order_across_existing_two_replay_passes"
            ),
            "firstEpochBehavior": (
                "collect_identity_only_keep_existing_non_selected_primary_supervision"
            ),
            "replacesBatchLocalMaximum": True,
            "additionalLossWeight": False,
            "additionalOptimizerSteps": 0,
        },
        "checkpointQualification": {
            "population": "all_8_validation_records_all_existing_rollout_seeds",
            "selection": (
                "one_maximum_per_class_with_sample_id_then_seed_index_tie_break"
            ),
            "requiredPersistedFields": [
                "classIdentity", "sampleId", "seedIndex", "rawScore",
                "weightedScore",
            ],
            "aggregation": (
                "sum_four_existing_derived_weighted_class_maxima_times_existing_rollout_weight"
            ),
            "mustEqualReportedCheckpointObligation": True,
            "metric": "validationCheckpointSelectionScore",
            "entersQualificationScore": True,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
            "rollout": "existing_50_step_final_decoded_rgb",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "existingLossValuesOrWeightsChanged": False,
            "batchSizeChanged": False,
            "optimizerStepBudgetChanged": False,
            "datasetOrSplitChanged": False,
            "conditionChannelOrderChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_EVIDENCE_BINDINGS
        ),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_LUMINANCE_SELECTION_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(result)
    return result


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--consumption-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source_path = (ROOT / args.source).resolve()
    output_path = (ROOT / args.output).resolve()
    authorization = validate_authorization(
        (ROOT / args.authorization).resolve(),
        args.authorization_sha256,
        (ROOT / args.consumption).resolve(),
        args.consumption_sha256,
    )
    prior = authorization["sourceEvidence"]["priorInactiveConfig"]
    if (
        sha256_file(source_path) != args.source_sha256
        or project_path(source_path) != prior["path"]
        or args.source_sha256 != prior["sha256"]
    ):
        raise ValueError("epoch-complete selection source config changed")
    expected_output = (
        ROOT / authorization["outputNamespace"] / "inactive-config.json"
    ).resolve()
    if output_path != expected_output or output_path.exists():
        raise ValueError("epoch-complete selection output identity invalid")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(compile_config(read_json(source_path)), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "stage4_epoch_complete_per_class_worst_luminance_inactive_config_compiled",
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

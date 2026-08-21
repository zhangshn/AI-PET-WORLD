from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"
SCHEMA = (
    "owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-"
    "structure-cpu-implementation-v1"
)
SCOPE = (
    "one_cpu_inactive_stage4_per_class_worst_sample_final_visible_luminance_"
    "structure_obligation_implementation"
)
ALLOWED_ACTIONS = [
    "verify_bound_design_terminal_report_decision_contract_cpu_report_and_data_audit",
    "extend_existing_trainer_with_inactive_per_class_worst_sample_luminance_obligation",
    "compile_one_inactive_configuration",
    "extend_cpu_positive_negative_contract_checker",
    "execute_python_syntax_cpu_regression_and_configuration_audit",
    "write_support_contract_cpu_report_owner_request_terminal_and_local_records",
]
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
    request_id = authorization.get("requestId")
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("schemaVersion") != SCHEMA
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or not isinstance(request_id, str)
        or authorization.get("commandRef") != request_id
        or authorization.get("scope") != SCOPE
        or authorization.get("allowedActions") != ALLOWED_ACTIONS
        or authorization.get("checkpointReadAuthorized") is not False
        or authorization.get("optimizerCreationAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
        or authorization.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("per-class worst-sample luminance CPU authorization invalid")
    if (
        consumption.get("status") != "consumed_once"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != SCOPE
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("per-class worst-sample luminance CPU consumption invalid")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        source = (ROOT / binding["path"]).resolve()
        if not source.is_file() or sha256_file(source) != binding["sha256"]:
            raise ValueError(
                f"per-class worst-sample luminance evidence changed: {name}"
            )
    return authorization


def compile_config(source: dict) -> dict:
    result = deepcopy(source)
    training = result["training"]
    per_class = (
        trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            result
        )
    )
    global_worst = (
        trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            result
        )
    )
    rollout = trainer.validate_stage4_full_rollout_final_visible_consistency(result)
    if per_class is None or global_worst is None or rollout is None:
        raise ValueError("per-class worst-sample luminance source contracts missing")
    identities = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    derived_weights = deepcopy(per_class["sourceContract"]["derivedWeights"])
    rollout_weight = float(rollout["weight"])
    training[CONTRACT_KEY] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": (
            trainer.STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        ),
        "sourceContracts": {
            "perClassLuminanceStructureContractId": (
                trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
            ),
            "globalWorstSampleClassContractId": (
                trainer.STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
            ),
            "weightedPerSampleClassTensorSource": (
                "stage4_full_rollout_worst_sample_class_reference_luminance_"
                "obligation_losses.weightedPerSampleClassTensors"
            ),
            "derivedClassWeights": derived_weights,
            "classWeightSource": (
                "training.stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation."
                "sourceContract.derivedWeights"
            ),
            "rolloutWeight": rollout_weight,
            "rolloutWeightSource": (
                "training.stage4FullRolloutFinalVisibleConsistency.weight"
            ),
            "freeNumericalWeightSelectionAllowed": False,
        },
        "selection": {
            "trainingPopulation": "all_48_train_split_records",
            "checkpointPopulation": "all_8_validation_split_records",
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": identities,
            "perClassRule": "maximum_over_samples_within_each_bound_object_class",
            "tieBreak": "lexicographic_sample_id_within_class",
            "globalCrossClassMaximumAllowed": False,
            "validationSamplesUsedForWeightUpdates": False,
            "challengeOrRegressionUsedForWeightUpdates": False,
        },
        "totalLoss": {
            "aggregation": "sum_four_already_derived_weighted_per_class_maxima",
            "entersExistingFullRolloutLossSlot": True,
            "replacesGlobalSampleClassMaximumInThatSlot": True,
            "additionalLossWeight": False,
            "additionalOptimizerSteps": 0,
            "freeNumericWeightSelected": False,
        },
        "checkpointQualification": {
            "metric": "validationCheckpointSelectionScore",
            "perClassRule": "maximum_over_validation_trajectories_within_each_class",
            "aggregation": "sum_four_already_derived_weighted_per_class_maxima",
            "sameRolloutWeightRequired": True,
            "entersQualificationScore": True,
            "replacesGlobalSampleClassMaximum": True,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "existingLossValuesOrWeightsChanged": False,
            "optimizerStepBudgetChanged": False,
            "datasetOrSplitChanged": False,
            "conditionChannelOrderChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS
        ),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_PER_CLASS_WORST_SAMPLE_FINAL_VISIBLE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
        result
    )
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
    authorization_path = (ROOT / args.authorization).resolve()
    consumption_path = (ROOT / args.consumption).resolve()
    authorization = validate_authorization(
        authorization_path,
        args.authorization_sha256,
        consumption_path,
        args.consumption_sha256,
    )
    prior = authorization["sourceEvidence"]["priorInactiveConfig"]
    if (
        sha256_file(source_path) != args.source_sha256
        or project_path(source_path) != prior["path"]
        or args.source_sha256 != prior["sha256"]
    ):
        raise ValueError("per-class worst-sample luminance source config changed")
    expected_output = (
        ROOT / authorization["outputNamespace"] / "inactive-config.json"
    ).resolve()
    if output_path != expected_output or output_path.exists():
        raise ValueError("per-class worst-sample luminance output identity invalid")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(compile_config(read_json(source_path)), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "stage4_per_class_worst_sample_final_visible_luminance_structure_inactive_config_compiled",
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

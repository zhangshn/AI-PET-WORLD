from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4EpochWorstSampleClassReferenceFeatureStructureReplay"
SCHEMA = "owner-authorized-stage4-epoch-worst-reference-feature-replay-cpu-implementation-v1"
SCOPE = "one_cpu_readonly_adjudication_then_inactive_epoch_worst_reference_feature_replay_implementation"
ALLOWED_ACTIONS = [
    "verify_bound_stage0_failure_evidence_without_checkpoint_weight_read",
    "execute_cpu_readonly_reference_feature_replay_wiring_adjudication",
    "extend_existing_trainer_with_inactive_epoch_worst_reference_feature_replay",
    "compile_one_inactive_reference_feature_replay_configuration",
    "extend_cpu_positive_negative_contract_checker",
    "execute_cpu_positive_negative_regression_and_configuration_audit",
    "write_analysis_support_contract_cpu_report_owner_request_terminal_and_local_records",
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
        or authorization.get("checkpointWeightsReadAuthorized") is not False
        or authorization.get("optimizerCreationAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
        or authorization.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("epoch-worst reference-feature CPU authorization is invalid")
    if (
        consumption.get("status") != "consumed_once"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != SCOPE
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("epoch-worst reference-feature CPU consumption is invalid")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        if binding.get("identityOnly") is True:
            if binding.get("weightsReadAuthorized") is not False:
                raise ValueError("checkpoint identity unexpectedly permits weight reads")
            continue
        source = (ROOT / binding["path"]).resolve()
        if not source.is_file() or sha256_file(source) != binding["sha256"]:
            raise ValueError(f"epoch-worst reference-feature evidence changed: {name}")
    return authorization


def compile_config(source: dict) -> dict:
    result = deepcopy(source)
    training = result["training"]
    reference_feature = (
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            result
        )
    )
    epoch_worst = trainer.validate_stage4_epoch_worst_sample_class_replay(result)
    if reference_feature is None or epoch_worst is None:
        raise ValueError("epoch-worst reference-feature source contracts are missing")
    identities = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    training[CONTRACT_KEY] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": (
            trainer.STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_ID
        ),
        "sourceContracts": {
            "referenceFeatureStructureContractId": (
                trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
            ),
            "epochWorstReplayContractId": trainer.STAGE4_EPOCH_WORST_SAMPLE_CLASS_REPLAY_ID,
            "perSampleClassTensorSource": (
                "stage4_per_class_final_visible_reference_feature_structure_"
                "obligation_losses.perSampleClassTensors"
            ),
            "derivedClassWeights": deepcopy(
                reference_feature["sourceContract"]["derivedClassWeights"]
            ),
            "classWeightSource": (
                "training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation."
                "sourceContract.derivedClassWeights"
            ),
            "rolloutWeight": float(
                reference_feature["sourceContract"]["rolloutWeight"]
            ),
            "rolloutWeightSource": (
                "training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation."
                "sourceContract.rolloutWeight"
            ),
            "freeNumericalWeightSelectionAllowed": False,
        },
        "selection": {
            "population": (
                "observed_current_train_split_epoch_prefix_with_complete_epoch_"
                "finalization"
            ),
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": identities,
            "score": (
                "same_derived_weighted_per_sample_class_reference_feature_"
                "structure_tensor"
            ),
            "tieBreak": "lexicographic_sample_id_then_fixed_class_order",
        },
        "replay": {
            "passesPerObservedPrimaryBatch": int(
                epoch_worst["replay"]["passesPerObservedPrimaryBatch"]
            ),
            "passesSource": (
                "training.stage4EpochWorstSampleClassReplay.replay."
                "passesPerObservedPrimaryBatch"
            ),
            "addsReplayPasses": False,
            "addsOptimizerSteps": False,
            "loss": "same_selected_reference_feature_structure_sample_class_tensor",
            "recomputeFromSameBoundSampleAndClass": True,
            "freeNumericWeightSelected": False,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
            "featureSource": "frozen_project_autoencoder_features",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
            "validationSamplesUsedAsTrainingTargets": False,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "existingLossValuesOrWeightsChanged": False,
            "optimizerStepBudgetChanged": False,
            "datasetOrSplitChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_EVIDENCE_BINDINGS
        ),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_EPOCH_WORST_REFERENCE_FEATURE_STRUCTURE_REPLAY_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
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
    if (
        sha256_file(source_path) != args.source_sha256
        or project_path(source_path)
        != authorization["sourceEvidence"]["priorInactiveConfig"]["path"]
        or args.source_sha256
        != authorization["sourceEvidence"]["priorInactiveConfig"]["sha256"]
    ):
        raise ValueError("epoch-worst reference-feature source config changed")
    expected_output = (
        ROOT / authorization["outputNamespace"] / "inactive-config.json"
    ).resolve()
    if output_path != expected_output or output_path.exists():
        raise ValueError("epoch-worst reference-feature output identity is invalid")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(compile_config(read_json(source_path)), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "stage4_epoch_worst_reference_feature_replay_inactive_config_compiled",
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

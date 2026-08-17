from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"
GATE_FIELDS = (
    "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
    "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
    "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
    "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
)
ALLOWED_ACTIONS = [
    "implement_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_cpu_inactive_support",
    "compile_one_inactive_configuration",
    "execute_cpu_positive_negative_contract_regression_and_configuration_audit",
    "write_support_contract_cpu_report_owner_action_request_terminal_and_local_records",
]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


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
        or authorization.get("schemaVersion")
        != "owner-authorized-stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-implementation-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or not isinstance(request_id, str)
        or not request_id.startswith(
            "owner-authorized-stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-implementation-"
        )
        or authorization.get("commandRef") != request_id
        or authorization.get("scope")
        != "one_cpu_only_inactive_full_rollout_per_class_luminance_structure_implementation"
        or authorization.get("allowedActions") != ALLOWED_ACTIONS
        or authorization.get("checkpointWeightsReadAuthorized") is not False
        or authorization.get("optimizerCreationAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
    ):
        raise ValueError("CPU inactive implementation authorization is invalid")
    if (
        consumption.get("status")
        != "cpu_inactive_full_rollout_per_class_luminance_structure_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != authorization.get("scope")
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
        or any(
            consumption.get(name) is not False
            for name in (
                "checkpointWeightsRead", "optimizerCreated", "backwardExecuted",
                "gpuUsed", "trainingStarted",
            )
        )
    ):
        raise ValueError("CPU inactive implementation consumption is invalid")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        source = ROOT / binding["path"]
        if not source.is_file() or sha256_file(source) != binding["sha256"]:
            raise ValueError(f"CPU inactive source evidence changed: {name}")
    return authorization


def compile_config(source: dict) -> dict:
    result = deepcopy(source)
    training = result.get("training", {})
    multiscale = trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
        result
    )
    rollout = trainer.validate_stage4_full_rollout_final_visible_consistency(result)
    required_classes = list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    training[CONTRACT_KEY] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": (
            trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        ),
        "sourceContract": {
            "contractId": trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID,
            "function": "stage4_object_reference_multiscale_luminance_structure_supervision_losses",
            "pyramidScales": list(
                trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES
            ),
            "derivedWeights": deepcopy(multiscale["derivedWeights"]),
            "freeNumericalWeightSelectionAllowed": False,
        },
        "requiredClasses": required_classes,
        "rolloutBinding": {
            "parentContractId": "stage4_full_rollout_final_visible_consistency_v1",
            "decodedRgbSource": "same_50_step_final_decoded_rgb_before_detach",
            "rolloutSteps": int(result["inferenceSteps"]),
            "gradientTailSteps": int(rollout["gradientTailSteps"]),
            "entersTotalLoss": True,
        },
        "aggregation": {
            "perClass": "reuse_native_half_quarter_and_cross_scale_structure_consistency",
            "crossClass": "sum_existing_derived_weighted_object_obligations",
            "rolloutWeight": float(rollout["weight"]),
            "rolloutWeightSource": "training.stage4FullRolloutFinalVisibleConsistency.weight",
            "freeNumericalWeightSelectionAllowed": False,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": required_classes,
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "checkpointQualification": {
            "metric": "validationCheckpointSelectionScore",
            "source": "same_final_rollout_per_class_weighted_luminance_structure_obligation",
            "sameDerivedClassWeightsRequired": True,
            "sameRolloutWeightRequired": True,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "lossWeightsChanged": False,
            "datasetOrSplitChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
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
    if output_path.exists():
        raise ValueError("inactive configuration output already exists")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("inactive configuration source identity changed")
    authorization = validate_authorization(
        authorization_path, args.authorization_sha256,
        consumption_path, args.consumption_sha256,
    )
    configured_output = (ROOT / authorization["outputNamespace"] / "inactive-config.json").resolve()
    if output_path != configured_output:
        raise ValueError("inactive configuration output path changed")
    output_path.parent.mkdir(parents=True, exist_ok=False)
    output_path.write_text(
        json.dumps(compile_config(read_json(source_path)), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "stage4_full_rollout_per_class_luminance_structure_inactive_config_compiled",
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

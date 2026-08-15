from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_stage_mode_registry import FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS


ROOT = Path.cwd().resolve()
AUTH_SCHEMA = "owner-authorized-stage4-semantic-mixture-object-visible-structure-supervision-implementation-v1"
AUTH_SCOPE = "one_bounded_cpu_only_inactive_object_visible_structure_supervision_implementation_and_contract_regression_only"
REQUIRED_ACTIONS = [
    "implement_inactive_four_typed_object_visible_structure_supervision_cpu_support",
    "generalize_existing_masked_luminance_correlation_to_exact_four_object_channels",
    "reuse_existing_per_class_final_visible_weights_without_new_numeric_selection",
    "modify_only_bound_trainer_and_new_compiler_checker_finalizer",
    "run_python_syntax_and_cpu_forward_positive_negative_contract_regressions",
    "write_inactive_contract_fragment_cpu_report_implementation_report_terminal_capsule_owner_request",
    "synchronize_implementation_event_ledger_and_sqlite",
]
TARGET_PATHS = [
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
    "ml/ai-painter/scripts/compile_stage4_object_visible_structure_supervision_config.py",
    "ml/ai-painter/scripts/check_stage4_object_visible_structure_supervision_cpu.py",
    "scripts/record-stage4-object-visible-structure-supervision-cpu-success.mjs",
]
GATE_FIELDS = (
    "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
    "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
    "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
    "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
)


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
) -> tuple[dict, dict]:
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("schemaVersion") != AUTH_SCHEMA
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId") != authorization.get("commandRef")
        or authorization.get("scope") != AUTH_SCOPE
        or authorization.get("allowedActions") != REQUIRED_ACTIONS
        or authorization.get("authorizedTargetPaths") != TARGET_PATHS
        or authorization.get("implementationExecutionAuthorized") is not True
        or authorization.get("checkpointFileReadAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("validationAuthorized") is not False
        or authorization.get("smokeAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
    ):
        raise ValueError("object visible-structure implementation authorization is invalid")
    if (
        consumption.get("status")
        != "cpu_only_inactive_implementation_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("requestId") != authorization["requestId"]
        or consumption.get("commandRef") != authorization["commandRef"]
        or consumption.get("scope") != authorization["scope"]
        or consumption.get("checkpointFileRead") is not False
        or consumption.get("optimizerCreated") is not False
        or consumption.get("backwardExecuted") is not False
        or consumption.get("modelWeightsMutated") is not False
        or consumption.get("gpuUsed") is not False
        or consumption.get("trainingStarted") is not False
        or consumption.get("validationStarted") is not False
        or consumption.get("smokeStarted") is not False
    ):
        raise ValueError("object visible-structure implementation consumption is invalid")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        if name == "currentTrainer":
            if binding != {
                "path": "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
                "sha256": "2f527811e5dcb10fbb0380c38f0770edaef8b40d74f6391f8898226675a6b565",
            }:
                raise ValueError("object visible-structure trainer preimage binding changed")
            continue
        evidence = ROOT / binding["path"]
        if not evidence.is_file() or sha256_file(evidence) != binding["sha256"]:
            raise ValueError(f"object visible-structure source binding changed: {name}")
    return authorization, consumption


def compile_inactive_fragment(
    source: dict,
    source_path: Path,
    source_sha256: str,
    authorization: dict,
    consumption: dict,
) -> tuple[dict, dict]:
    if sha256_file(source_path) != source_sha256:
        raise ValueError("object visible-structure source config identity changed")
    if source.get("denoiserArchitecture") != "stage4_fact_conditioned_semantic_mixture_decoder_v1":
        raise ValueError("object visible-structure source architecture is invalid")
    if tuple(source.get("conditionChannelOrder", ())) != tuple(dict.fromkeys(source.get("conditionChannelOrder", ()))):
        raise ValueError("object visible-structure condition order contains duplicates")
    if not all(channel in source.get("conditionChannelOrder", ()) for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS):
        raise ValueError("object visible-structure source channels are incomplete")

    test_config = deepcopy(source)
    training = test_config["training"]
    training["trainingAuthorizationStatus"] = FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS
    training.pop("stage4VegetationLuminanceSpatialStructureSupervision", None)
    derived = trainer.derive_stage4_object_visible_structure_weights(test_config)
    contract = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID,
        "sourceChannels": list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "luminanceCoefficients": [0.2126, 0.7152, 0.0722],
        "lossFunction": "one_minus_masked_zero_mean_normalized_luminance_correlation",
        "derivedWeights": derived["weights"],
        "weightDerivation": derived,
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "worldFacts": "approved_world_facts",
            "maskChannels": list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
            "failedPreviewPixelsUsedAsTargets": False,
            "failedCheckpointWeightsReadOrLoaded": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "waterAndPathBehaviorPreserved": True,
            "existingColorAndEdgeObligationsPreserved": True,
            "modelArchitectureChanged": False,
            "checkpointFormatChanged": False,
            "datasetOrSplitChanged": False,
            "conditionPackChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_EVIDENCE_BINDINGS),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    training["stage4ObjectVisibleStructureSupervision"] = contract
    validation = trainer.validate_stage4_object_visible_structure_supervision(test_config)
    fragment = {
        "schemaVersion": "stage4-object-visible-structure-supervision-inactive-config-fragment-v1",
        "status": "cpu_support_verified_inactive",
        "sourceConfig": {"path": project_path(source_path), "sha256": source_sha256},
        "sourceReadBoundary": {
            "configJsonReadOnly": True,
            "failedCheckpointFileReadOrLoaded": False,
        },
        "replaceContract": "stage4VegetationLuminanceSpatialStructureSupervision",
        "trainingAuthorizationStatusRequired": FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS,
        "trainingPatch": {"stage4ObjectVisibleStructureSupervision": contract},
        "activationAuthorized": False,
        "trainingAuthorized": False,
        "gpuAuthorized": False,
        "authorization": {
            "path": project_path(authorization_path := ROOT / consumption["authorizationPath"]),
            "sha256": sha256_file(authorization_path),
        },
        "consumption": {
            "path": project_path(consumption_path := ROOT / trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION["implementationConsumptionPath"]),
            "sha256": sha256_file(consumption_path),
        },
    }
    return fragment, {"config": test_config, "validation": validation}


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
    authorization, consumption = validate_authorization(
        args.authorization.resolve(), args.authorization_sha256,
        args.consumption.resolve(), args.consumption_sha256,
    )
    source = read_json(args.source.resolve())
    fragment, _ = compile_inactive_fragment(
        source, args.source.resolve(), args.source_sha256, authorization, consumption,
    )
    if args.output.exists():
        raise ValueError("object visible-structure inactive fragment already exists")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fragment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": fragment["status"],
        "output": project_path(args.output),
        "sha256": sha256_file(args.output),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

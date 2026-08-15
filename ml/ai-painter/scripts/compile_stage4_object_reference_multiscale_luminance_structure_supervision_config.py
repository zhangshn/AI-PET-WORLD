from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_stage_mode_registry import FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS


ROOT = Path.cwd().resolve()
AUTH_SCHEMA = (
    "owner-authorized-stage4-object-reference-multiscale-luminance-structure-"
    "supervision-cpu-implementation-v1"
)
AUTH_SCOPE = (
    "one_bounded_cpu_only_inactive_multiscale_luminance_structure_supervision_"
    "implementation_config_compile_and_contract_regression_only"
)
REQUIRED_ACTIONS = [
    "implement_one_versioned_inactive_four_object_multiscale_luminance_structure_supervision_cpu_branch",
    "inherit_exact_existing_texture_hierarchy_scales_without_free_numerical_selection",
    "compile_one_inactive_configuration_fragment",
    "run_python_syntax_and_cpu_forward_positive_negative_contract_regressions",
    "write_implementation_report_terminal_capsule_and_inactive_gpu_qualification_request",
    "synchronize_implementation_event_ledger_and_sqlite_index",
]
TARGET_PATHS = [
    "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
    "ml/ai-painter/scripts/compile_stage4_object_reference_multiscale_luminance_structure_supervision_config.py",
    "ml/ai-painter/scripts/check_stage4_object_reference_multiscale_luminance_structure_supervision_cpu.py",
    "scripts/record-stage4-object-reference-multiscale-luminance-structure-supervision-cpu-success.mjs",
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
    expected_request = (
        "owner-authorized-stage4-object-reference-multiscale-luminance-structure-"
        "supervision-cpu-implementation-20260815-141934048"
    )
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("schemaVersion") != AUTH_SCHEMA
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("requestId") != expected_request
        or authorization.get("commandRef") != expected_request
        or authorization.get("scope") != AUTH_SCOPE
        or authorization.get("allowedActions") != REQUIRED_ACTIONS
        or authorization.get("authorizedTargetPaths") != TARGET_PATHS
        or authorization.get("implementationExecutionAuthorized") is not True
        or authorization.get("configurationCompileAuthorized") is not True
        or authorization.get("cpuContractRegressionAuthorized") is not True
        or authorization.get("checkpointFileReadAuthorized") is not False
        or authorization.get("modelLoadAuthorized") is not False
        or authorization.get("optimizerCreationAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("cudaInitializationAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("validationAuthorized") is not False
        or authorization.get("smokeAuthorized") is not False
        or authorization.get("stage1Or2Authorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
    ):
        raise ValueError("multiscale CPU implementation authorization is invalid")
    if (
        consumption.get("status")
        != "cpu_only_inactive_multiscale_implementation_authorization_atomically_consumed"
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("requestId") != expected_request
        or consumption.get("commandRef") != expected_request
        or consumption.get("scope") != AUTH_SCOPE
        or consumption.get("oneTimeConsumption") is not True
        or any(
            consumption.get(name) is not False
            for name in (
                "checkpointFileRead", "modelLoaded", "optimizerCreated", "backwardExecuted",
                "modelWeightsMutated", "gpuUsed", "cudaInitialized", "trainingStarted",
                "validationStarted", "smokeStarted", "stage1Or2Started",
            )
        )
    ):
        raise ValueError("multiscale CPU implementation consumption is invalid")
    expected_trainer_preimage = {
        "path": "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
        "sha256": "fdf89032f1c4ee7a4d4cbfb4640a83bc3563bc81b6b790eb22ffc006049871ec",
    }
    if authorization.get("targetPreimageBindings", {}).get("trainer") != expected_trainer_preimage:
        raise ValueError("multiscale trainer preimage authorization changed")
    for name in ("compiler", "checker", "recorder"):
        binding = authorization.get("targetPreimageBindings", {}).get(name, {})
        if binding.get("mustNotExistBeforeFirstWrite") is not True:
            raise ValueError(f"multiscale target preimage contract changed: {name}")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        evidence = ROOT / binding["path"]
        if not evidence.is_file() or sha256_file(evidence) != binding["sha256"]:
            raise ValueError(f"multiscale source evidence changed: {name}")
    if trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION != {
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": authorization_sha256,
        "implementationConsumptionPath": project_path(consumption_path),
        "implementationConsumptionSha256": consumption_sha256,
    }:
        raise ValueError("multiscale runtime implementation authorization binding changed")
    return authorization, consumption


def compile_inactive_fragment(
    source: dict,
    source_path: Path,
    source_sha256: str,
    authorization: dict,
    consumption: dict,
) -> tuple[dict, dict]:
    if sha256_file(source_path) != source_sha256:
        raise ValueError("multiscale source config identity changed")
    if source.get("denoiserArchitecture") != "stage4_fact_conditioned_semantic_mixture_decoder_v1":
        raise ValueError("multiscale source architecture is invalid")
    if list(source.get("training", {}).get("textureHierarchyScales", ())) != [1, 0.5, 0.25]:
        raise ValueError("multiscale source pyramid authority changed")
    failed_contract = source.get("training", {}).get("stage4ObjectVisibleStructureSupervision", {})
    if (
        failed_contract.get("contractId") != trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID
        or failed_contract.get("lossFunction")
        != "one_minus_masked_zero_mean_normalized_luminance_correlation"
    ):
        raise ValueError("failed single-scale candidate identity changed")
    if not all(
        channel in source.get("conditionChannelOrder", ())
        for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS
    ):
        raise ValueError("multiscale source channels are incomplete")

    test_config = deepcopy(source)
    training = test_config["training"]
    training["trainingAuthorizationStatus"] = FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS
    training.pop("stage4VegetationLuminanceSpatialStructureSupervision", None)
    training.pop("stage4ObjectVisibleStructureSupervision", None)
    derived = trainer.derive_stage4_object_visible_structure_weights(test_config)
    contract = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID,
        "sourceChannels": list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "luminanceCoefficients": [0.2126, 0.7152, 0.0722],
        "pyramidScales": list(
            trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SCALES
        ),
        "pyramidAuthority": "training.textureHierarchyScales_exact_inheritance",
        "perScaleLossFunction": (
            "masked_zero_mean_normalized_luminance_correlation_at_each_inherited_scale"
        ),
        "crossScaleLossFunction": "masked_laplacian_pyramid_structure_consistency",
        "aggregation": {
            "perObject": (
                "arithmetic_mean_of_three_per_scale_correlations_and_one_"
                "cross_scale_structure_consistency"
            ),
            "crossObject": "sum_of_existing_typed_weighted_object_obligations",
            "freeNumericalWeightSelectionAllowed": False,
        },
        "derivedWeights": derived["weights"],
        "weightDerivation": derived,
        "noveltyBoundary": {
            "rejectedCandidateContractId": trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID,
            "rejectedCandidateLossFunction": (
                "one_minus_masked_zero_mean_normalized_luminance_correlation"
            ),
            "failedSingleScaleContractReuseAllowed": False,
            "distinctMechanism": (
                "per_scale_masked_luminance_correlation_plus_cross_scale_structure_consistency"
            ),
        },
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
        "evidenceBindings": deepcopy(
            trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_EVIDENCE_BINDINGS
        ),
        "ownerImplementationAuthorization": deepcopy(
            trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    training["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"] = contract
    validation = (
        trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
            test_config
        )
    )
    fragment = {
        "schemaVersion": (
            "stage4-object-reference-multiscale-luminance-structure-supervision-"
            "inactive-config-fragment-v1"
        ),
        "status": "cpu_support_verified_inactive",
        "runId": "20260815-072500000-stage0",
        "sourceConfig": {"path": project_path(source_path), "sha256": source_sha256},
        "sourceReadBoundary": {
            "configJsonReadOnly": True,
            "failedCheckpointFileReadOrLoaded": False,
        },
        "replacesFailedContract": trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID,
        "trainingAuthorizationStatusRequired": FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_INACTIVE_STATUS,
        "trainingPatch": {
            "remove": [
                "stage4ObjectVisibleStructureSupervision",
                "stage4VegetationLuminanceSpatialStructureSupervision",
            ],
            "add": {"stage4ObjectReferenceMultiscaleLuminanceStructureSupervision": contract},
        },
        "activationAuthorized": False,
        "trainingAuthorized": False,
        "gpuAuthorized": False,
        "authorization": {
            "path": project_path(ROOT / consumption["authorizationPath"]),
            "sha256": sha256_file(ROOT / consumption["authorizationPath"]),
        },
        "consumption": {
            "path": project_path(
                ROOT
                / trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION[
                    "implementationConsumptionPath"
                ]
            ),
            "sha256": trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_IMPLEMENTATION_AUTHORIZATION[
                "implementationConsumptionSha256"
            ],
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
        raise ValueError("multiscale inactive fragment already exists")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(fragment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "status": fragment["status"],
        "output": project_path(args.output),
        "sha256": sha256_file(args.output),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

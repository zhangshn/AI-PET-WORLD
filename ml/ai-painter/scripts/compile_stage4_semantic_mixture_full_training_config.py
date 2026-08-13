from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from ai_painter_execution_grant import ALL_ACTIONS, ExecutionAction
from ai_painter_stage_mode_registry import (
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS,
)


STATUSES = (
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE0_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE1_FULL_TRAINING_STATUS,
    FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE2_FULL_TRAINING_STATUS,
)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path, root: Path) -> str:
    resolved = path.resolve()
    logical_runtime = (root / ".runtime").resolve()
    if resolved == logical_runtime or logical_runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(logical_runtime)).as_posix()
    return resolved.relative_to(root.resolve()).as_posix()


def active_gate(value: dict, *, smoke_key: str | None = None) -> dict:
    result = {key: False for key in value}
    for key in (
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    ):
        if key in result:
            result[key] = True
    if smoke_key and smoke_key in result:
        result[smoke_key] = False
    return result


def compile_config(
    source: dict,
    stage: int,
    authorization_path: Path,
    authorization_sha256: str,
    consumption_path: Path,
    consumption_sha256: str,
    implementation_authorization_path: Path,
    implementation_authorization_sha256: str,
    implementation_consumption_path: Path,
    implementation_consumption_sha256: str,
    root: Path,
) -> dict:
    if stage not in (0, 1, 2):
        raise ValueError("formal training stage must be 0, 1, or 2")
    authorization = json.loads(authorization_path.read_text(encoding="utf-8"))
    consumption = json.loads(consumption_path.read_text(encoding="utf-8"))
    required_action = (ExecutionAction.RUN_STAGE0, ExecutionAction.RUN_STAGE1, ExecutionAction.RUN_STAGE2)[stage]
    actions = {
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
        ExecutionAction.LOAD_AUTOENCODER,
        ExecutionAction.CREATE_OPTIMIZER,
        ExecutionAction.EXECUTE_BACKWARD,
        ExecutionAction.MUTATE_MODEL_WEIGHTS,
        required_action,
    }
    if stage > 0:
        actions.add(ExecutionAction.LOAD_PARENT_DENOISER)
    action_values = sorted(action.value for action in actions)
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or authorization.get("executionActions") != action_values
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("formal Stage authorization or consumption identity is invalid")

    config = deepcopy(source)
    training = config["training"]
    training["trainingAuthorizationStatus"] = STATUSES[stage]
    training["denoiserEpochs"] = 40
    training["authorizedInitialization"] = (
        "project_random_fact_conditioned_semantic_mixture"
        if stage == 0 else f"current_run_stage_{stage - 1}_checkpoint_only"
    )
    training["factConditionedSemanticMixtureStage4FullTrainingContract"] = {
        "status": "active_owner_authorized_independent_stage_execution",
        "stage": stage,
        "resolution": deepcopy(training["resolutionStages"][stage]),
        "epochCount": 40,
        "previewEpochs": [1, 5, 10, 20, 30, 40],
        "datasetCapacity": 64,
        "splitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "initialization": training["authorizedInitialization"],
        "parentCheckpointRequired": stage > 0,
        "smokeCheckpointAllowed": False,
        "historicalCheckpointAllowed": False,
        "automaticRetryAllowed": False,
    }
    training["stage4UnifiedTrainingPreviewSamplingContract"] = {
        "schemaVersion": "stage4-unified-training-preview-sampling-contract-v1",
        "enabled": True,
        "status": "active_owner_authorized_single_execution",
        "samplingFunction": "evaluate_deterministic_rollout_rgb_quality_v7",
        "modelStateBinding": "sha256_sorted_tensor_bytes_v1",
        "seedBinding": "training_seed_plus_3000",
        "normalizationBinding": "checkpoint_latent_normalization",
        "decodeBinding": "frozen_project_autoencoder_decode_clamp_0_1",
        "checkpointPreviewIdentityGate": "byte_exact_best_epoch_reproduction",
        "deterministicAlgorithmsRequired": True,
        "cublasWorkspaceConfig": ":4096:8",
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdsUsedAsTrainingTargets": False,
    }
    mixture = training["stage4FactConditionedSemanticMixture"]
    mixture["enabled"] = True
    mixture["status"] = "training_loss_active_owner_authorized"
    mixture["activationGate"] = active_gate(mixture["activationGate"], smoke_key="smoke30EpochNow")
    diagnostics = training["stage4FailureDiagnostics"]
    diagnostics["status"] = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_full_training"
    for key in ("trainingConfigApplied", "checkpointFileReadAuthorized", "gpuUseAuthorized", "trainingAuthorized"):
        diagnostics[key] = True
    for name in (
        "stage4PerClassFinalVisibleRgbObligation",
        "stage4DistributionAwareVisibleSpatialSemanticObligation",
        "stage4VegetationFinalVisibleSemanticRepair",
        "stage4VegetationLuminanceSpatialStructureSupervision",
    ):
        contract = training.get(name)
        if contract:
            contract["status"] = "training_loss_active_owner_authorized"
            contract["activationGate"] = active_gate(contract["activationGate"], smoke_key="smokeNow")

    status = STATUSES[stage]
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "authorizationPath": project_path(authorization_path, root),
        "authorizationSha256": authorization_sha256,
        "executionConsumptionPath": project_path(consumption_path, root),
        "executionConsumptionSha256": consumption_sha256,
        "implementationAuthorizationPath": project_path(implementation_authorization_path, root),
        "implementationAuthorizationSha256": implementation_authorization_sha256,
        "implementationConsumptionPath": project_path(implementation_consumption_path, root),
        "implementationConsumptionSha256": implementation_consumption_sha256,
        "requestId": authorization["requestId"],
        "commandRef": authorization["commandRef"],
        "scope": authorization["scope"],
        "executionActions": action_values,
        "explicitlyDeniedActions": sorted(action.value for action in ALL_ACTIONS - actions),
        "executionState": "consumed",
        "preflightOnly": False,
        "status": status,
        "checkpointLoadingAuthorized": stage > 0,
        "optimizerCreationAuthorized": True,
        "backwardExecutionAuthorized": True,
        "modelWeightMutationAuthorized": True,
        "gpuTrainingAuthorizedNow": True,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": True,
        "stage1Authorized": stage == 1,
        "stage2Authorized": stage == 2,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    return config


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--stage", type=int, required=True)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--consumption-sha256", required=True)
    parser.add_argument("--implementation-authorization", type=Path, required=True)
    parser.add_argument("--implementation-authorization-sha256", required=True)
    parser.add_argument("--implementation-consumption", type=Path, required=True)
    parser.add_argument("--implementation-consumption-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path.cwd().resolve()
    config = compile_config(
        json.loads(args.source.read_text(encoding="utf-8")), args.stage,
        args.authorization.resolve(), args.authorization_sha256,
        args.consumption.resolve(), args.consumption_sha256,
        args.implementation_authorization.resolve(), args.implementation_authorization_sha256,
        args.implementation_consumption.resolve(), args.implementation_consumption_sha256,
        root,
    )
    if args.output.exists():
        raise ValueError("formal Stage active config output must not already exist")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "stage4_semantic_mixture_formal_stage_config_compiled", "stage": args.stage, "output": project_path(args.output, root), "sha256": sha256_file(args.output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

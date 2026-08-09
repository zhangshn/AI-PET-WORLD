from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path("data/ai-painter/system-governance/owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808.json")
IMPLEMENTATION_CONSUMPTION_PATH = Path(".runtime/ai-painter/owner-action-requests/owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808/implementation-consumption.json")
SOURCE_CONFIG_PATH = Path(".runtime/ai-painter/v8-r5-stage4-decoded-domain-alignment-cpu-support/20260808-211500000/inactive-config.json")
DATASET_PATH = Path("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
SOURCE_INDEX_PATH = DATASET_PATH.parent / "source-index.json"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
ALLOWED_SOURCES = [
    "original_owner_approved_reference_rgb",
    "original_compiled_23_channel_condition_pack",
    "approved_world_facts_region_graph_and_edge_ports",
    "project_generated_game_coordinate_route_geometry",
    "original_object_identity_and_semantic_masks",
    "current_training_prediction_and_frozen_project_autoencoder_decode",
]
READOUT_CHANNELS = [
    "terrain_path_ground", "route_required_boundary", "object_footprints",
    "object_tree", "object_rock", "object_vegetation",
]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    authorization = validate_implementation_authorization()
    source = read_json(resolve(SOURCE_CONFIG_PATH))
    package = read_json(resolve(DATASET_PATH))
    source_index = read_json(resolve(SOURCE_INDEX_PATH))
    rows = [
        row for row in source_index.get("samples", [])
        if row.get("sampleId") == SAMPLE_ID and row.get("v7CapacityContributionRegistered") is True
    ]
    if len(rows) != 1 or rows[0].get("split") != "validation":
        raise ValueError("V8 Smoke fixed sample identity is not unique in the approved capacity rows")
    config = compile_config(source, authorization, rows[0])
    trainer.validate_training_inputs(config, package)
    write_json_exclusive(args.output, config)
    print(json.dumps({
        "status": "v8_stage4_smoke_inactive_config_compiled_cpu_validated_not_active",
        "configPath": project_path(args.output),
        "configSha256": sha256_file(resolve(args.output)),
        "sampleId": SAMPLE_ID,
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "gpuUsed": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


def validate_implementation_authorization() -> dict:
    authorization = read_json(resolve(AUTHORIZATION_PATH))
    if authorization.get("requestId") != "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808":
        raise ValueError("V8 Smoke implementation authorization identity is invalid")
    if authorization.get("status") != "resolved_owner_authorized":
        raise ValueError("V8 Smoke implementation authorization is not resolved")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != authorization.get("requestId"):
        raise ValueError("V8 Smoke implementation command identity is invalid")
    consumption = read_json(resolve(IMPLEMENTATION_CONSUMPTION_PATH))
    if consumption.get("status") != "implementation_authorization_atomically_consumed":
        raise ValueError("V8 Smoke implementation authorization was not consumed")
    if consumption.get("authorizationSha256") != sha256_file(resolve(AUTHORIZATION_PATH)):
        raise ValueError("V8 Smoke implementation consumption authorization hash changed")
    for key in ("trainerLossImplementation", "inactiveConfigCompilerExtension", "gpuSmokeRunnerExtension", "cpuCheckerExtension", "cpuPositiveNegativeRegression"):
        if authorization.get("authorizedActions", {}).get(key) is not True:
            raise ValueError(f"V8 Smoke implementation action is closed: {key}")
    for key in ("stage4FullTraining", "stage1OrStage2", "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame", "worldEntry", "automaticRetry"):
        if authorization.get("authorizedActions", {}).get(key) is not False:
            raise ValueError(f"V8 Smoke forbidden action is open: {key}")
    for key in ("gradientDiagnosticTerminal", "gradientDiagnosticReport", "inactiveV8CpuConfig", "datasetManifest", "sourceIndex"):
        binding = authorization.get("bindings", {}).get(key, {})
        if binding.get("sha256") != sha256_file(resolve(Path(binding.get("path", "missing")))):
            raise ValueError(f"V8 Smoke source binding changed: {key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["gradientDiagnosticTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["gradientDiagnosticReport"]["path"])))
    if terminal.get("status") != "v8_gradient_diagnostic_passed_closed" or report.get("status") != "passed_readonly_gpu_forward_and_gradient_routing_weights_unchanged":
        raise ValueError("V8 Smoke gradient diagnostic prerequisite is not successful")
    return authorization


def compile_config(source: dict, authorization: dict, sample: dict) -> dict:
    config = deepcopy(source)
    config["architectureVersion"] = "all-validation-multiseed-semantic-rollout-unet-v8-stage4-decoded-alignment-smoke"
    config["status"] = "v8_stage4_shared_readout_training_loss_supported_inactive"
    config["formalInferenceEligible"] = False
    training = config["training"]
    training["trainingAuthorizationStatus"] = trainer.V8_STAGE4_SMOKE_INACTIVE_STATUS
    training["authorizedInitialization"] = "project_random_v8_denoiser"
    training["seed"] = 20263722
    training["denoiserEpochs"] = 30
    training["denoiserLossVersion"] = "velocity_decoded_rgb_shared_semantic_topology_alignment_v8_stage4"
    training["bestCheckpointMetric"] = "fixed_grid_plus_shared_semantic_topology_rollout_score_v8_stage4"
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedOverfitConditionLabel"] = sample["conditionLabel"]
    training["fixedEpochPreviewPolicy"] = {
        **deepcopy(training.get("fixedEpochPreviewPolicy", {})),
        "smoke": [1, 5, 10, 20, 30],
    }
    training["authorizedBoundaryTopology"] = {
        **deepcopy(training.get("authorizedBoundaryTopology", {})),
        "enabled": True,
        "requiredBoundarySides": ["west"],
    }
    training["v8Stage4SingleSampleSmokeContract"] = {
        "status": "compiled_inactive_not_authorized",
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "conditionLabel": sample["conditionLabel"],
        "imagePath": sample["imagePath"],
        "imageSha256": sample["imageSha256"],
        "conditionPackPath": sample["conditionPackPath"],
        "conditionPackSha256": sha256_file(resolve(Path(sample["conditionPackPath"]))),
        "seed": 20263722,
        "requiredBoundarySides": ["west"],
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "evaluationInterval": 5,
        "previewEpochs": [1, 5, 10, 20, 30],
        "datasetSelectionContract": "registered_v7_capacity_contribution_v1",
        "requiredSplitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "oldDenoiserCheckpointCompatible": False,
        "oldDenoiserCheckpointReadAuthorized": False,
        "stage0Initialization": "project_random_v8_denoiser",
    }
    contract = training["stage4DecodedDomainAlignment"]
    contract["enabled"] = False
    contract["status"] = "training_loss_supported_inactive"
    contract["trainingLossImplementationStatus"] = "implemented_cpu_verified_not_active"
    contract["sharedReadoutTrainingSupervision"] = {
        "loss": "balanced_binary_cross_entropy_v1",
        "weightSource": "training.denoiserLossWeights.discreteConditionOutputBinding",
        "targetChannels": deepcopy(READOUT_CHANNELS),
        "allowedSources": deepcopy(ALLOWED_SOURCES),
        "routeBoundaryIdentitySource": "approved_world_facts_region_graph_and_edge_ports",
        "conditionMaskRole": "consistency_projection_only_not_world_fact_authority",
        "conditionMaskIsWorldFactAuthority": False,
        "failedPreviewPixelsUsedAsTrainingTargets": False,
        "machineReviewThresholdsUsedAsTrainingTargets": False,
        "newFreeHyperparameterSelected": False,
    }
    contract["hyperparameterSelections"] = []
    contract["activationGate"] = {
        "configurationActiveNow": False,
        "autoencoderCheckpointReadNow": False,
        "oldDenoiserCheckpointReadNow": False,
        "optimizerCreationNow": False,
        "backwardExecutionNow": False,
        "modelParameterUpdateNow": False,
        "gpuUseNow": False,
        "trainingNow": False,
        "checkpointWriteNow": False,
        "stage4FullTrainingNow": False,
        "stage1OrStage2Now": False,
        "strictRevalidationNow": False,
        "formalInferenceNow": False,
        "checkpointPromotionNow": False,
        "runtimeFrameNow": False,
        "worldEntryNow": False,
    }
    contract["trainingEvidenceBindings"] = {
        "gradientDiagnosticTerminal": deepcopy(authorization["bindings"]["gradientDiagnosticTerminal"]),
        "gradientDiagnosticReport": deepcopy(authorization["bindings"]["gradientDiagnosticReport"]),
        "ownerAuthorization": {"path": project_path(AUTHORIZATION_PATH), "sha256": sha256_file(resolve(AUTHORIZATION_PATH))},
        "implementationConsumption": {"path": project_path(IMPLEMENTATION_CONSUMPTION_PATH), "sha256": sha256_file(resolve(IMPLEMENTATION_CONSUMPTION_PATH))},
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "authorizationPath": project_path(AUTHORIZATION_PATH),
        "authorizationSha256": sha256_file(resolve(AUTHORIZATION_PATH)),
        "implementationConsumptionPath": project_path(IMPLEMENTATION_CONSUMPTION_PATH),
        "implementationConsumptionSha256": sha256_file(resolve(IMPLEMENTATION_CONSUMPTION_PATH)),
        "status": "not_authorized_candidate_only",
        "checkpointLoadingAuthorized": False,
        "optimizerCreationAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "gpuTrainingAuthorizedNow": False,
        "singleSampleGpuOverfitSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "strictRevalidationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    return config


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


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path.cwd().resolve()
CONTRACT_ID = "stage4_epoch_global_worst_sample_class_final_visible_replay_v1"
EARLY_CONVERGENCE_CONTRACT_ID = (
    "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
)
IDENTITIES = ["route", "footprints", "tree", "rock", "vegetation"]
CHANNELS = [
    "terrain_path_ground", "object_footprints", "object_tree",
    "object_rock", "object_vegetation",
]
OBJECT_CHANNELS = CHANNELS[1:]
DESIGN_BINDINGS = {
    "design": {
        "path": ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-designs/20260815-182607000/early-convergence-stabilization-design.json",
        "sha256": "09a276d9f6c655ddef8c91d2604d9442043804a4662d5b6ebba42ad50ad7c735",
    },
    "cpuReport": {
        "path": ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-designs/20260815-182607000/cpu-contract-regression.json",
        "sha256": "9bf2ee1a5cefff227d6da7a9a9d900323d6e5c6048a84bd8a2d408cdaf1e7191",
    },
    "inactiveImplementationContract": {
        "path": ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-designs/20260815-182607000/inactive-implementation-contract.json",
        "sha256": "9d225b9cbf6ebbdb4a0a923f3d72c3bcaa5bab8ce5cf89bb3fba866c58f210c8",
    },
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def compile_config(source: dict) -> dict:
    result = deepcopy(source)
    training = result["training"]
    replay_passes = int(training["pathHardExampleReplay"]["passesPerEpoch"])
    if replay_passes not in (1, 2):
        raise ValueError("existing replay count is not a bounded formal value")
    training["stage4EpochWorstSampleClassReplay"] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": CONTRACT_ID,
        "selection": {
            "population": "observed_current_train_split_epoch_prefix_with_complete_epoch_finalization",
            "sampleIdentity": "dataset_sampleId",
            "classIdentities": IDENTITIES,
            "score": "direct_plus_full_rollout_existing_derived_weighted_final_visible_rgb",
            "tieBreak": "lexicographic_sample_id_then_fixed_class_order",
        },
        "replay": {
            "passesPerObservedPrimaryBatch": replay_passes,
            "passesSource": "training.pathHardExampleReplay.passesPerEpoch",
            "replacesPerBatchPathOnlyReplay": True,
            "loss": "selected_existing_derived_weighted_final_visible_rgb",
            "freeNumericWeightSelected": False,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": CHANNELS,
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "validationSamplesUsedAsTrainingTargets": False,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "checkpointFormatChanged": False,
            "datasetSplitChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "activationGate": {
            "configurationActiveNow": False, "checkpointReadNow": False,
            "optimizerCreationNow": False, "backwardExecutionNow": False,
            "modelParameterUpdateNow": False, "gpuUseNow": False,
            "trainingNow": False, "smokeNow": False,
            "stage4FullTrainingNow": False, "stage5Now": False,
            "formalInferenceNow": False, "checkpointPromotionNow": False,
            "runtimeFrameNow": False, "worldEntryNow": False,
        },
    }
    return result


def compile_early_convergence_stabilization_config(source: dict) -> dict:
    """Add only the inactive two-lane replay candidate to the current config."""
    result = deepcopy(source)
    training = result["training"]
    replay = training.get("stage4EpochWorstSampleClassReplay", {})
    if replay.get("contractId") != CONTRACT_ID:
        raise ValueError("current epoch-worst replay contract is unavailable")
    if replay.get("replay", {}).get("passesPerObservedPrimaryBatch") != 2:
        raise ValueError("early-convergence stabilization requires the existing two-pass budget")
    if replay.get("replay", {}).get("passesSource") != "training.pathHardExampleReplay.passesPerEpoch":
        raise ValueError("early-convergence replay budget authority changed")
    multiscale = training.get(
        "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision", {}
    )
    if multiscale.get("contractId") != (
        "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
    ):
        raise ValueError("current object-reference multiscale supervision is unavailable")
    if multiscale.get("sourceChannels") != OBJECT_CHANNELS:
        raise ValueError("current object-reference multiscale channel order changed")
    if multiscale.get("pyramidScales") != [1, 0.5, 0.25]:
        raise ValueError("current object-reference multiscale pyramid changed")
    derived_weights = deepcopy(multiscale.get("derivedWeights", {}))
    if list(derived_weights) != IDENTITIES[1:] or not all(
        isinstance(value, (int, float)) and value > 0
        for value in derived_weights.values()
    ):
        raise ValueError("current object-reference multiscale weights changed")
    training["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": EARLY_CONVERGENCE_CONTRACT_ID,
        "sourceRunId": "20260815-190000000",
        "replayBudget": {
            "totalReplayPassesPerObservedPrimaryBatch": 2,
            "source": "training.stage4EpochWorstSampleClassReplay.replay.passesPerObservedPrimaryBatch",
            "addsReplayPasses": False,
            "addsOptimizerSteps": False,
        },
        "lanes": [
            {
                "laneId": "lane_1_existing_global_worst_sample_class",
                "passIndex": 0,
                "passCount": 1,
                "selection": "existing_global_worst_sample_class_selection_unchanged",
                "loss": "selected_existing_derived_weighted_final_visible_rgb",
                "includesRoute": True,
            },
            {
                "laneId": "lane_2_joint_four_object_reference_multiscale",
                "passIndex": 1,
                "passCount": 1,
                "selection": "all_four_typed_objects_in_fixed_existing_channel_order",
                "loss": "existing_typed_object_multiscale_luminance_structure_losses_jointly_aggregated_with_existing_derived_weights",
                "includesRoute": False,
                "objectChannels": OBJECT_CHANNELS,
                "aggregation": "sum_of_existing_typed_weighted_object_obligations",
            },
        ],
        "preservedSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "objectChannels": OBJECT_CHANNELS,
            "pyramidScales": [1, 0.5, 0.25],
            "pyramidAuthority": "training.textureHierarchyScales_exact_inheritance",
            "derivedWeights": derived_weights,
            "derivedWeightAuthority": "training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision.derivedWeights",
            "freeNumericWeightSelectionAllowed": False,
        },
        "legalSupervision": {
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "validationSamplesUsedAsTrainingTargets": False,
        },
        "compatibility": {
            "firstWorstClassLanePreserved": True,
            "routeAndWaterBaseLossesPreserved": True,
            "existingTwoReplayPassBudgetPreserved": True,
            "modelArchitectureChanged": False,
            "checkpointFormatChanged": False,
            "datasetOrSplitChanged": False,
            "conditionPackChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(DESIGN_BINDINGS),
        "activationGate": {
            "configurationActiveNow": False,
            "checkpointReadNow": False,
            "optimizerCreationNow": False,
            "backwardExecutionNow": False,
            "modelParameterUpdateNow": False,
            "gpuUseNow": False,
            "trainingNow": False,
            "smokeNow": False,
            "stage4FullTrainingNow": False,
            "stage5Now": False,
            "formalInferenceNow": False,
            "checkpointPromotionNow": False,
            "runtimeFrameNow": False,
            "worldEntryNow": False,
        },
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--early-convergence-stabilization", action="store_true")
    args = parser.parse_args()
    source = (ROOT / args.source).resolve()
    output = (ROOT / args.output).resolve()
    if output.exists():
        raise ValueError("epoch-worst inactive output must not exist")
    output.parent.mkdir(parents=True, exist_ok=True)
    source_config = json.loads(source.read_text(encoding="utf-8"))
    config = (
        compile_early_convergence_stabilization_config(source_config)
        if args.early_convergence_stabilization
        else compile_config(source_config)
    )
    output.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "compiled_inactive", "path": project(output), "sha256": sha(output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path.cwd().resolve()
CONTRACT_ID = "stage4_full_rollout_final_visible_consistency_v1"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def compile_config(source: dict, evidence: dict) -> dict:
    result = deepcopy(source)
    training = result["training"]
    short = training["shortTrajectorySupervision"]
    existing_weights = training["denoiserLossWeights"]
    contract = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": CONTRACT_ID,
        "sampler": "same_deterministic_velocity_sampler_as_fixed_preview",
        "rolloutInitialization": "deterministic_noise_from_training_seed_plus_existing_preview_offset",
        "rolloutSteps": int(result["inferenceSteps"]),
        "gradientTailSteps": 5,
        "gradientTailSource": "existing_v7_r5_cross_domain_visual_consistency_contract",
        "weight": float(short["weight"]),
        "weightSource": "training.shortTrajectorySupervision.weight",
        "finalVisibleTerms": {
            "decodedRgb": float(existing_weights["decodedRgb"]),
            "spatialGridRgb": float(existing_weights["spatialGridRgb"]),
            "terrainWaterMaskedRgb": float(existing_weights["sparseRegionDecodedRgb"]),
            "routeInteriorRgb": float(existing_weights["pathInteriorRgb"]),
            "routeForbiddenBoundaryRgb": float(existing_weights["pathForbiddenBoundaryRgb"]),
            "routeCoverage": float(training["pathCoverageCalibration"]["weight"]),
            "routeActivationMass": float(training["pathActivationMassCalibration"]["weight"]),
            "routeRequiredBoundary": float(existing_weights["pathBoundaryRgb"]),
            "perClassDistributionAware": "reuse_stage4_distribution_aware_visible_spatial_semantic_obligation",
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": [
                "terrain_water", "terrain_path_ground", "object_footprints",
                "object_tree", "object_rock", "object_vegetation",
            ],
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "checkpointFormatChanged": False,
            "datasetSplitChanged": False,
            "oldModesPreserved": True,
        },
        "evidenceBindings": evidence,
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
    training["stage4FullRolloutFinalVisibleConsistency"] = contract
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--failed-terminal", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--selected-review", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    paths = {name: (ROOT / getattr(args, name)).resolve() for name in ("source", "failed_terminal", "manifest", "selected_review")}
    evidence = {name: {"path": project(path), "sha256": sha(path)} for name, path in paths.items() if name != "source"}
    output = (ROOT / args.output).resolve()
    if output.exists():
        raise ValueError("full-rollout output must not exist")
    output.parent.mkdir(parents=True, exist_ok=True)
    value = compile_config(json.loads(paths["source"].read_text(encoding="utf-8")), evidence)
    output.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "compiled_inactive", "path": project(output), "sha256": sha(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

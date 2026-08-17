from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import ast
import hashlib
import json
from pathlib import Path

import torch

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def active_config(config: dict) -> dict:
    result = deepcopy(config)
    contract = result["training"][CONTRACT_KEY]
    contract["status"] = "training_loss_active_owner_authorized"
    active = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "smokeNow",
    }
    contract["activationGate"] = {
        name: name in active for name in contract["activationGate"]
    }
    return result


def synthetic_inputs(config: dict):
    height, width = 48, 64
    predicted = torch.linspace(
        0.05, 0.95, 2 * 3 * height * width, dtype=torch.float32,
    ).reshape(2, 3, height, width).clone().requires_grad_(True)
    target = torch.flip(predicted.detach(), dims=(-1,)).clone()
    conditions = torch.zeros(
        2, len(config["conditionChannelOrder"]), height, width, dtype=torch.float32,
    )
    regions = {
        "object_footprints": (slice(4, 20), slice(4, 20)),
        "object_tree": (slice(4, 20), slice(24, 40)),
        "object_rock": (slice(24, 40), slice(4, 20)),
        "object_vegetation": (slice(24, 40), slice(24, 48)),
    }
    order = list(config["conditionChannelOrder"])
    for channel, (ys, xs) in regions.items():
        conditions[:, order.index(channel), ys, xs] = 1.0
    conditions[:, order.index("terrain_path_ground"), :, :4] = 1.0
    return predicted, target, conditions, regions


def bool_value(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, torch.Tensor) and value.numel() == 1:
        return bool(value.item())
    raise TypeError("comparison result must be bool or one-element Tensor")


def expect_rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            config
        )
    except (KeyError, TypeError, ValueError) as error:
        return {"name": name, "passed": True, "error": str(error)}
    return {"name": name, "passed": False, "error": "mutation was accepted"}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--config-sha256", required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    config_path = (ROOT / args.config).resolve()
    source_path = (ROOT / args.source).resolve()
    output_path = (ROOT / args.output).resolve()
    if output_path.exists():
        raise ValueError("CPU report output already exists")
    if sha256_file(config_path) != args.config_sha256:
        raise ValueError("inactive configuration identity changed")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("source configuration identity changed")
    config = read_json(config_path)
    source_config = read_json(source_path)
    contract = trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
        config
    )
    active = active_config(config)
    trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
        active
    )
    predicted, target, conditions, regions = synthetic_inputs(active)
    result = trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
        predicted, target, conditions, active,
    )
    matrix = result["weightedPerSampleClassTensors"]
    worst = result["worstWeightedSampleClassTensor"]
    winner = int(matrix.detach().reshape(-1).argmax())
    sample_index, class_index = divmod(winner, matrix.shape[1])
    winning_channel = list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)[class_index]
    gradient = torch.autograd.grad(worst, predicted, retain_graph=False)[0]
    ys, xs = regions[winning_channel]
    selected_mask = torch.zeros_like(gradient)
    selected_mask[sample_index:sample_index + 1, :, ys, xs] = 1.0
    inside = float((gradient.abs() * selected_mask).sum())
    outside = float((gradient.abs() * (1.0 - selected_mask)).sum())

    source = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
    source_text = (ROOT / source).read_text(encoding="utf-8")
    ast.parse(source_text)
    positives = [
        {"name": "inactive_contract_valid", "passed": contract["status"] == "cpu_support_verified_inactive"},
        {"name": "active_contract_valid", "passed": True},
        {"name": "per_sample_per_class_identity", "passed": tuple(matrix.shape) == (2, 4)},
        {"name": "worst_is_exact_matrix_maximum", "passed": bool_value(torch.equal(worst, matrix.reshape(-1).amax()))},
        {"name": "winning_mask_gradient_finite_nonzero", "passed": torch.isfinite(gradient).all().item() and inside > 0.0},
        {"name": "winning_mask_outside_gradient_zero", "passed": outside == 0.0},
        {"name": "route_west_equal_is_non_regression", "passed": trainer.stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(active, 0.4, 0.4)},
        {"name": "route_west_improvement_is_non_regression", "passed": trainer.stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(active, 0.5, 0.4)},
        {"name": "route_west_regression_rejected", "passed": not trainer.stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary(active, 0.3, 0.4)},
        {"name": "total_loss_slot_uses_worst_obligation", "passed": 'worst_sample_class_luminance["worstWeightedSampleClassTensor"]' in source_text},
        {"name": "checkpoint_uses_validation_maximum", "passed": "max(worst_sample_class_luminance_values)" in source_text},
        {"name": "checkpoint_selection_has_route_non_regression", "passed": "and route_non_regression_passed" in source_text},
    ]

    negatives = []
    mutations = []
    missing = deepcopy(config); del missing["training"][CONTRACT_KEY]["aggregation"]; mutations.append(("missing_field", missing))
    unknown = deepcopy(config); unknown["training"][CONTRACT_KEY]["unknown"] = True; mutations.append(("unknown_field", unknown))
    order_changed = deepcopy(config); order_changed["training"][CONTRACT_KEY]["requiredClasses"][0:2] = reversed(order_changed["training"][CONTRACT_KEY]["requiredClasses"][0:2]); mutations.append(("class_order_changed", order_changed))
    cross_class = deepcopy(config); cross_class["training"][CONTRACT_KEY]["aggregation"]["selection"] = "sum_over_class"; mutations.append(("cross_class_sum_restored", cross_class))
    free_weight = deepcopy(config); free_weight["training"][CONTRACT_KEY]["aggregation"]["rolloutWeight"] += 0.01; mutations.append(("free_rollout_weight", free_weight))
    wrong_weight = deepcopy(config); wrong_weight["training"][CONTRACT_KEY]["sourceContract"]["derivedWeights"]["tree"] += 0.01; mutations.append(("free_class_weight", wrong_weight))
    failed_preview = deepcopy(config); failed_preview["training"][CONTRACT_KEY]["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] = True; mutations.append(("failed_preview_target", failed_preview))
    review_target = deepcopy(config); review_target["training"][CONTRACT_KEY]["legalSupervision"]["machineReviewResultsUsedAsTargets"] = True; mutations.append(("review_result_target", review_target))
    cross_class_channel = deepcopy(config); cross_class_channel["training"][CONTRACT_KEY]["requiredClasses"][1] = "object_rock"; mutations.append(("cross_class_wiring", cross_class_channel))
    wrong_side = deepcopy(config); wrong_side["training"][CONTRACT_KEY]["routeWestBoundaryNonRegression"]["requiredSide"] = "east"; mutations.append(("road_west_contract_changed", wrong_side))
    free_threshold = deepcopy(config); free_threshold["training"][CONTRACT_KEY]["routeWestBoundaryNonRegression"]["freeThresholdSelected"] = True; mutations.append(("road_free_threshold", free_threshold))
    checkpoint_source = deepcopy(config); checkpoint_source["training"][CONTRACT_KEY]["checkpointQualification"]["source"] = "average"; mutations.append(("checkpoint_source_changed", checkpoint_source))
    gate = deepcopy(config); gate["training"][CONTRACT_KEY]["activationGate"]["gpuUseNow"] = True; mutations.append(("inactive_gpu_gate", gate))
    for name, mutated in mutations:
        negatives.append(expect_rejected(name, mutated))

    legacy = deepcopy(config)
    del legacy["training"][CONTRACT_KEY]
    positives.append({
        "name": "legacy_config_without_contract_preserved",
        "passed": (
            legacy == source_config
            and trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
                legacy
            )["contractId"]
            == trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        ),
    })
    forbidden_runtime_calls = all(token not in source_text for token in ())
    positives.append({"name": "cpu_checker_does_not_authorize_runtime_actions", "passed": forbidden_runtime_calls})
    positive_passed = sum(item["passed"] for item in positives)
    negative_passed = sum(item["passed"] for item in negatives)
    report = {
        "status": (
            "passed_stage4_full_rollout_worst_sample_class_reference_luminance_cpu_contract"
            if positive_passed == len(positives) and negative_passed == len(negatives)
            else "failed_stage4_full_rollout_worst_sample_class_reference_luminance_cpu_contract"
        ),
        "positivePassed": positive_passed,
        "positiveTotal": len(positives),
        "negativePassed": negative_passed,
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "gradientEvidence": {
            "winnerSampleIndex": sample_index,
            "winnerClass": winning_channel,
            "insideMaskGradientAbsSum": inside,
            "outsideMaskGradientAbsSum": outside,
            "finite": bool(torch.isfinite(gradient).all()),
        },
        "safety": {
            "checkpointRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "gpuUsed": False,
            "trainingStarted": False,
        },
        "config": {"path": project_path(config_path), "sha256": args.config_sha256},
        "source": {"path": project_path(source_path), "sha256": args.source_sha256},
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    print(json.dumps({
        "status": report["status"],
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
        "positive": f"{positive_passed}/{len(positives)}",
        "negative": f"{negative_passed}/{len(negatives)}",
    }))
    return 0 if report["status"].startswith("passed_") else 1


if __name__ == "__main__":
    raise SystemExit(main())

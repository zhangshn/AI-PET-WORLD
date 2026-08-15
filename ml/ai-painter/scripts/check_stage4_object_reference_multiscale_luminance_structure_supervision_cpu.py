from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
import math
from pathlib import Path

import torch

import compile_stage4_object_reference_multiscale_luminance_structure_supervision_config as compiler
import train_ai_assisted_conditional_denoiser as trainer


CONTRACT_KEY = "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"


def rejected(config: dict, mutation) -> bool:
    value = deepcopy(config)
    mutation(value)
    try:
        trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
            value
        )
    except (KeyError, TypeError, ValueError):
        return True
    return False


def synthetic_forward(config: dict) -> dict:
    order = list(config["conditionChannelOrder"])
    size = 32
    conditions = torch.zeros((1, len(order), size, size), dtype=torch.float32)
    boxes = {
        "object_footprints": (slice(2, 10), slice(2, 10)),
        "object_tree": (slice(2, 10), slice(22, 30)),
        "object_rock": (slice(22, 30), slice(2, 10)),
        "object_vegetation": (slice(22, 30), slice(22, 30)),
    }
    target = torch.zeros((1, 3, size, size), dtype=torch.float32)
    yy, xx = torch.meshgrid(
        torch.linspace(0.0, 1.0, size),
        torch.linspace(0.0, 1.0, size),
        indexing="ij",
    )
    for index, channel in enumerate(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS):
        rows, columns = boxes[channel]
        conditions[:, order.index(channel), rows, columns] = 1.0
        target[:, 0, rows, columns] = xx[rows, columns] * (0.32 + index * 0.05)
        target[:, 1, rows, columns] = yy[rows, columns] * (0.43 + index * 0.04)
        target[:, 2, rows, columns] = (
            xx[rows, columns] + 2.0 * yy[rows, columns]
        ) * (0.10 + index * 0.01)
    predicted = (
        target * 0.72
        + torch.roll(target, shifts=1, dims=-1) * 0.18
        + torch.roll(target, shifts=1, dims=-2) * 0.10
    ).requires_grad_(True)
    result = trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
        predicted, target, conditions, config,
    )
    perfect = trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
        target.clone().requires_grad_(True), target, conditions, config,
    )
    union = torch.zeros((1, 1, size, size), dtype=torch.float32)
    for channel in trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS:
        union = torch.maximum(union, conditions[:, order.index(channel):order.index(channel) + 1])
    outside_changed = predicted.detach().clone() + (1.0 - union) * 7.0
    outside_changed.requires_grad_(True)
    outside_result = (
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            outside_changed, target, conditions, config,
        )
    )
    return {
        "result": result,
        "perfect": perfect,
        "outsideResult": outside_result,
        "predicted": predicted,
        "target": target,
        "conditions": conditions,
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--consumption-sha256", required=True)
    args = parser.parse_args()
    authorization, consumption = compiler.validate_authorization(
        args.authorization.resolve(), args.authorization_sha256,
        args.consumption.resolve(), args.consumption_sha256,
    )
    source = compiler.read_json(args.source.resolve())
    fragment, built = compiler.compile_inactive_fragment(
        source, args.source.resolve(), args.source_sha256, authorization, consumption,
    )
    config = built["config"]
    contract = config["training"][CONTRACT_KEY]
    forward = synthetic_forward(config)
    result = forward["result"]
    perfect = forward["perfect"]
    outside = forward["outsideResult"]
    prefixes = ("Footprints", "Tree", "Rock", "Vegetation")
    suffixes = (
        "NativeLuminanceCorrelationLoss",
        "HalfLuminanceCorrelationLoss",
        "QuarterLuminanceCorrelationLoss",
        "CrossScaleStructureConsistencyLoss",
        "MultiscaleLuminanceStructureLoss",
    )
    expected_metrics = {
        f"stage4SemanticMixture{prefix}FinalTyped{suffix}"
        for prefix in prefixes
        for suffix in suffixes
    }
    existing_weights = trainer.derive_stage4_per_class_final_visible_rgb_weights(config)[
        "weights"
    ]
    object_means_exact = True
    for prefix in prefixes:
        components = [
            result["losses"][
                f"stage4SemanticMixture{prefix}FinalTyped{suffix}"
            ]
            for suffix in suffixes[:-1]
        ]
        aggregate = result["losses"][
            f"stage4SemanticMixture{prefix}FinalTypedMultiscaleLuminanceStructureLoss"
        ]
        object_means_exact = object_means_exact and torch.allclose(
            aggregate, torch.stack(components).mean(), atol=1e-7, rtol=1e-7,
        )
    positives = {
        "compiled_fragment_inactive": fragment["status"] == "cpu_support_verified_inactive",
        "formal_activation_closed": fragment["activationAuthorized"] is False,
        "training_closed": fragment["trainingAuthorized"] is False,
        "gpu_closed": fragment["gpuAuthorized"] is False,
        "failed_single_scale_contract_removed": (
            fragment["replacesFailedContract"]
            == trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_SUPERVISION_ID
            and "stage4ObjectVisibleStructureSupervision" not in config["training"]
        ),
        "novel_contract_identity": (
            contract["contractId"]
            == trainer.STAGE4_OBJECT_REFERENCE_MULTISCALE_LUMINANCE_STRUCTURE_SUPERVISION_ID
        ),
        "exact_four_channels": (
            tuple(contract["sourceChannels"])
            == trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS
        ),
        "existing_pyramid_exactly_inherited": contract["pyramidScales"] == [1.0, 0.5, 0.25],
        "existing_weights_reused": contract["derivedWeights"] == {
            key: existing_weights[key]
            for key in ("footprints", "tree", "rock", "vegetation")
        },
        "no_free_weight_selected": (
            contract["weightDerivation"]["freeValueSelectionAllowed"] is False
            and contract["aggregation"]["freeNumericalWeightSelectionAllowed"] is False
        ),
        "review_thresholds_unchanged": contract["compatibility"]["reviewThresholdsChanged"] is False,
        "failed_preview_targets_rejected": contract["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] is False,
        "failed_checkpoint_weights_closed": contract["legalSupervision"]["failedCheckpointWeightsReadOrLoaded"] is False,
        "forward_metric_identity_exact": set(result["losses"]) == expected_metrics,
        "forward_losses_finite": all(
            math.isfinite(float(value.detach())) for value in result["losses"].values()
        ),
        "forward_total_finite": math.isfinite(float(result["weightedTotalTensor"].detach())),
        "future_gradient_path_present_without_backward": result["weightedTotalTensor"].requires_grad is True,
        "perfect_reference_losses_zero": all(
            abs(float(value.detach())) <= 1e-6 for value in perfect["losses"].values()
        ),
        "per_object_aggregation_is_structural_mean": object_means_exact,
        "mask_bounded_outside_change_invariant": all(
            torch.allclose(result["losses"][name], outside["losses"][name], atol=1e-7, rtol=1e-7)
            for name in expected_metrics
        ),
        "diagnostic_registry_exact": expected_metrics.issubset(
            trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config)
        ),
        "water_and_path_preserved": contract["compatibility"]["waterAndPathBehaviorPreserved"] is True,
    }
    mutations = {
        "disabled_rejected": lambda value: value["training"][CONTRACT_KEY].update(enabled=False),
        "active_without_execution_rejected": lambda value: value["training"][CONTRACT_KEY].update(status="training_loss_active_owner_authorized"),
        "channel_order_rejected": lambda value: value["training"][CONTRACT_KEY].update(sourceChannels=list(reversed(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS))),
        "luminance_coefficients_rejected": lambda value: value["training"][CONTRACT_KEY].update(luminanceCoefficients=[1.0, 0.0, 0.0]),
        "pyramid_scales_rejected": lambda value: value["training"][CONTRACT_KEY].update(pyramidScales=[1.0, 0.5]),
        "source_pyramid_change_rejected": lambda value: value["training"].update(textureHierarchyScales=[1.0, 0.5]),
        "per_scale_loss_identity_rejected": lambda value: value["training"][CONTRACT_KEY].update(perScaleLossFunction="single_scale_reuse"),
        "cross_scale_loss_identity_rejected": lambda value: value["training"][CONTRACT_KEY].update(crossScaleLossFunction="none"),
        "free_aggregation_weight_rejected": lambda value: value["training"][CONTRACT_KEY]["aggregation"].update(freeNumericalWeightSelectionAllowed=True),
        "derived_weight_change_rejected": lambda value: value["training"][CONTRACT_KEY]["derivedWeights"].update(tree=9.0),
        "failed_single_scale_reuse_rejected": lambda value: value["training"].update(stage4ObjectVisibleStructureSupervision={}),
        "single_object_duplicate_rejected": lambda value: value["training"].update(stage4VegetationLuminanceSpatialStructureSupervision={}),
        "novelty_reuse_rejected": lambda value: value["training"][CONTRACT_KEY]["noveltyBoundary"].update(failedSingleScaleContractReuseAllowed=True),
        "failed_preview_target_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(failedPreviewPixelsUsedAsTargets=True),
        "failed_checkpoint_read_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(failedCheckpointWeightsReadOrLoaded=True),
        "threshold_change_rejected": lambda value: value["training"][CONTRACT_KEY]["compatibility"].update(reviewThresholdsChanged=True),
        "water_path_change_rejected": lambda value: value["training"][CONTRACT_KEY]["compatibility"].update(waterAndPathBehaviorPreserved=False),
        "architecture_change_rejected": lambda value: value.update(denoiserArchitecture="other"),
        "evidence_change_rejected": lambda value: value["training"][CONTRACT_KEY]["evidenceBindings"]["formalDesign"].update(sha256="0" * 64),
        "authorization_change_rejected": lambda value: value["training"][CONTRACT_KEY]["ownerImplementationAuthorization"].update(authorizationSha256="0" * 64),
        "activation_gate_rejected": lambda value: value["training"][CONTRACT_KEY]["activationGate"].update(trainingNow=True),
        "unknown_field_rejected": lambda value: value["training"][CONTRACT_KEY].update(freeField=True),
    }
    negatives = {name: rejected(config, mutation) for name, mutation in mutations.items()}
    missing_mask = forward["conditions"].clone()
    missing_mask[:, config["conditionChannelOrder"].index("object_tree")] = 0.0
    try:
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            forward["predicted"], forward["target"], missing_mask, config,
        )
        negatives["empty_typed_mask_rejected"] = False
    except ValueError:
        negatives["empty_typed_mask_rejected"] = True
    constant_target = torch.zeros_like(forward["target"])
    try:
        trainer.stage4_object_reference_multiscale_luminance_structure_supervision_losses(
            forward["predicted"], constant_target, forward["conditions"], config,
        )
        negatives["constant_reference_structure_rejected"] = False
    except ValueError:
        negatives["constant_reference_structure_rejected"] = True
    if not all(positives.values()) or not all(negatives.values()):
        failed_positive = [name for name, passed in positives.items() if not passed]
        failed_negative = [name for name, passed in negatives.items() if not passed]
        raise ValueError(
            f"multiscale CPU contract regression failed: positive={failed_positive}, negative={failed_negative}"
        )
    report = {
        "schemaVersion": (
            "stage4-object-reference-multiscale-luminance-structure-supervision-"
            "cpu-regression-v1"
        ),
        "status": "stage4_object_reference_multiscale_luminance_structure_cpu_regression_passed",
        "positivePassed": sum(positives.values()),
        "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()),
        "negativeTotal": len(negatives),
        "positiveChecks": positives,
        "negativeChecks": negatives,
        "forwardMetrics": {
            name: float(value.detach()) for name, value in result["losses"].items()
        },
        "pyramidScales": result["pyramidScales"],
        "derivedWeights": result["derivedWeights"],
        "executionBoundary": {
            "checkpointFileRead": False,
            "modelLoaded": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsMutated": False,
            "gpuUsed": False,
            "cudaInitialized": False,
            "trainingStarted": False,
            "validationStarted": False,
            "smokeStarted": False,
            "stage1Or2Started": False,
        },
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

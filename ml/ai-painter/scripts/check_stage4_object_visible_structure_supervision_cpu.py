from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
import math
from pathlib import Path

import torch

import compile_stage4_object_visible_structure_supervision_config as compiler
import train_ai_assisted_conditional_denoiser as trainer


def rejected(config: dict, mutation) -> bool:
    value = deepcopy(config)
    mutation(value)
    try:
        trainer.validate_stage4_object_visible_structure_supervision(value)
    except (KeyError, TypeError, ValueError):
        return True
    return False


def synthetic_forward(config: dict) -> dict:
    order = list(config["conditionChannelOrder"])
    conditions = torch.zeros((1, len(order), 16, 16), dtype=torch.float32)
    boxes = {
        "object_footprints": (slice(1, 5), slice(1, 5)),
        "object_tree": (slice(1, 5), slice(10, 14)),
        "object_rock": (slice(10, 14), slice(1, 5)),
        "object_vegetation": (slice(10, 14), slice(10, 14)),
    }
    target = torch.zeros((1, 3, 16, 16), dtype=torch.float32)
    yy, xx = torch.meshgrid(
        torch.linspace(0.0, 1.0, 16), torch.linspace(0.0, 1.0, 16), indexing="ij",
    )
    for index, channel in enumerate(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS):
        rows, columns = boxes[channel]
        conditions[:, order.index(channel), rows, columns] = 1.0
        target[:, 0, rows, columns] = xx[rows, columns] * (0.35 + index * 0.05)
        target[:, 1, rows, columns] = yy[rows, columns] * (0.45 + index * 0.04)
        target[:, 2, rows, columns] = (xx[rows, columns] + yy[rows, columns]) * 0.2
    predicted = (target * 0.8 + torch.flip(target, dims=(-1,)) * 0.2).requires_grad_(True)
    result = trainer.stage4_object_visible_structure_supervision_losses(
        predicted, target, conditions, config,
    )
    perfect = trainer.stage4_object_visible_structure_supervision_losses(
        target.clone().requires_grad_(True), target, conditions, config,
    )
    return {
        "result": result,
        "perfect": perfect,
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
    contract = config["training"]["stage4ObjectVisibleStructureSupervision"]
    forward = synthetic_forward(config)
    result = forward["result"]
    perfect = forward["perfect"]
    expected_metrics = {
        f"stage4SemanticMixture{prefix}FinalTypedLuminanceCorrelationLoss"
        for prefix in ("Footprints", "Tree", "Rock", "Vegetation")
    }
    existing = trainer.derive_stage4_per_class_final_visible_rgb_weights(config)["weights"]
    positives = {
        "compiled_fragment_inactive": fragment["status"] == "cpu_support_verified_inactive",
        "formal_activation_closed": fragment["activationAuthorized"] is False,
        "training_closed": fragment["trainingAuthorized"] is False,
        "gpu_closed": fragment["gpuAuthorized"] is False,
        "single_object_contract_replaced": (
            fragment["replaceContract"] == "stage4VegetationLuminanceSpatialStructureSupervision"
            and "stage4VegetationLuminanceSpatialStructureSupervision" not in config["training"]
        ),
        "exact_four_channels": tuple(contract["sourceChannels"]) == trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS,
        "existing_weights_reused": contract["derivedWeights"] == {
            key: existing[key] for key in ("footprints", "tree", "rock", "vegetation")
        },
        "no_free_weight_selected": contract["weightDerivation"]["freeValueSelectionAllowed"] is False,
        "review_thresholds_unchanged": contract["compatibility"]["reviewThresholdsChanged"] is False,
        "failed_preview_targets_rejected": contract["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] is False,
        "failed_checkpoint_weights_closed": contract["legalSupervision"]["failedCheckpointWeightsReadOrLoaded"] is False,
        "forward_metric_identity_exact": set(result["losses"]) == expected_metrics,
        "forward_losses_finite": all(math.isfinite(float(value.detach())) for value in result["losses"].values()),
        "forward_total_finite": math.isfinite(float(result["weightedTotalTensor"].detach())),
        "future_gradient_path_present_without_backward": result["weightedTotalTensor"].requires_grad is True,
        "perfect_reference_correlation_zero": all(abs(float(value.detach())) <= 1e-6 for value in perfect["losses"].values()),
        "diagnostic_registry_exact": set(expected_metrics).issubset(
            trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config)
        ),
        "water_and_path_preserved": contract["compatibility"]["waterAndPathBehaviorPreserved"] is True,
    }
    mutations = {
        "disabled_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"].update(enabled=False),
        "active_without_owner_execution_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"].update(status="training_loss_active_owner_authorized"),
        "channel_order_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"].update(sourceChannels=list(reversed(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS))),
        "luminance_coefficients_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"].update(luminanceCoefficients=[1.0, 0.0, 0.0]),
        "loss_identity_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"].update(lossFunction="masked_mae"),
        "free_weight_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["derivedWeights"].update(tree=9.0),
        "failed_preview_target_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["legalSupervision"].update(failedPreviewPixelsUsedAsTargets=True),
        "failed_checkpoint_read_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["legalSupervision"].update(failedCheckpointWeightsReadOrLoaded=True),
        "threshold_change_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["compatibility"].update(reviewThresholdsChanged=True),
        "water_path_change_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["compatibility"].update(waterAndPathBehaviorPreserved=False),
        "architecture_change_rejected": lambda value: value.update(denoiserArchitecture="other"),
        "evidence_change_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["evidenceBindings"]["formalDesign"].update(sha256="0" * 64),
        "authorization_change_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["ownerImplementationAuthorization"].update(authorizationSha256="0" * 64),
        "activation_gate_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"]["activationGate"].update(trainingNow=True),
        "single_object_duplicate_rejected": lambda value: value["training"].update(stage4VegetationLuminanceSpatialStructureSupervision={}),
        "unknown_field_rejected": lambda value: value["training"]["stage4ObjectVisibleStructureSupervision"].update(freeField=True),
    }
    negatives = {name: rejected(config, mutation) for name, mutation in mutations.items()}
    missing_mask = forward["conditions"].clone()
    missing_mask[:, config["conditionChannelOrder"].index("object_tree")] = 0.0
    try:
        trainer.stage4_object_visible_structure_supervision_losses(
            forward["predicted"], forward["target"], missing_mask, config,
        )
        negatives["empty_typed_mask_rejected"] = False
    except ValueError:
        negatives["empty_typed_mask_rejected"] = True
    constant_target = torch.zeros_like(forward["target"])
    try:
        trainer.stage4_object_visible_structure_supervision_losses(
            forward["predicted"], constant_target, forward["conditions"], config,
        )
        negatives["constant_reference_structure_rejected"] = False
    except ValueError:
        negatives["constant_reference_structure_rejected"] = True
    if not all(positives.values()) or not all(negatives.values()):
        raise ValueError("object visible-structure CPU contract regression failed")
    report = {
        "schemaVersion": "stage4-object-visible-structure-supervision-cpu-regression-v1",
        "status": "stage4_object_visible_structure_supervision_cpu_regression_passed",
        "positivePassed": sum(positives.values()),
        "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()),
        "negativeTotal": len(negatives),
        "positiveChecks": positives,
        "negativeChecks": negatives,
        "forwardMetrics": {name: float(value.detach()) for name, value in result["losses"].items()},
        "derivedWeights": result["derivedWeights"],
        "executionBoundary": {
            "checkpointFileRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsMutated": False,
            "gpuUsed": False,
            "trainingStarted": False,
            "validationStarted": False,
            "smokeStarted": False,
        },
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

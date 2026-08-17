from __future__ import annotations

from argparse import ArgumentParser
import ast
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import torch

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"
CLASSES = list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
IDENTITIES = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])


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
    trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
        result
    )
    return result


def synthetic_tensors(config: dict):
    height, width = 48, 64
    yy = torch.linspace(0.0, 1.0, height).view(1, 1, height, 1)
    xx = torch.linspace(0.0, 1.0, width).view(1, 1, 1, width)
    target = torch.cat(
        [
            (0.15 + 0.65 * xx + 0.10 * yy).expand(1, 1, height, width),
            (0.10 + 0.20 * xx + 0.70 * yy).expand(1, 1, height, width),
            (0.20 + 0.45 * xx + 0.35 * yy).expand(1, 1, height, width),
        ],
        dim=1,
    ).clamp(0.0, 1.0)
    predicted = (
        target * 0.73
        + torch.cat(
            [
                (0.17 * yy).expand(1, 1, height, width),
                (0.13 * xx).expand(1, 1, height, width),
                (0.11 * (xx - yy).abs()).expand(1, 1, height, width),
            ],
            dim=1,
        )
    ).clamp(0.0, 1.0).detach().requires_grad_(True)
    conditions = torch.zeros(1, len(config["conditionChannelOrder"]), height, width)
    regions = {
        "object_footprints": (2, 22, 2, 24),
        "object_tree": (2, 22, 38, 62),
        "object_rock": (26, 46, 2, 24),
        "object_vegetation": (26, 46, 38, 62),
    }
    order = list(config["conditionChannelOrder"])
    masks = {}
    for channel, (top, bottom, left, right) in regions.items():
        index = order.index(channel)
        conditions[:, index:index + 1, top:bottom, left:right] = 1.0
        masks[channel] = conditions[:, index:index + 1]
    return predicted, target, conditions, masks


def rejects(config: dict, mutate) -> bool:
    candidate = deepcopy(config)
    mutate(candidate)
    try:
        trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            candidate
        )
    except (KeyError, TypeError, ValueError):
        return True
    return False


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
    source = read_json(source_path)
    inactive = (
        trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            config
        )
    )
    executable = active_config(config)
    predicted, target, conditions, masks = synthetic_tensors(executable)
    result = (
        trainer.stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses(
            predicted, target, conditions, executable,
        )
    )
    gradient_evidence = {}
    positive = {
        "inactive_contract_valid": inactive["status"] == "cpu_support_verified_inactive",
        "exact_23_channel_order_preserved": (
            config["conditionChannelOrder"] == source["conditionChannelOrder"]
            and len(config["conditionChannelOrder"]) == 23
        ),
        "exact_four_class_registration": result["sourceChannels"] == CLASSES,
        "existing_derived_weights_reused": (
            result["derivedWeights"]
            == config["training"]["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"]["derivedWeights"]
        ),
    }
    for identity, channel in zip(IDENTITIES, CLASSES):
        value = result["perClassLossTensors"][identity]
        gradient = torch.autograd.grad(value, predicted, retain_graph=True)[0]
        mask = masks[channel].expand_as(gradient)
        inside = float((gradient.abs() * mask).sum())
        outside = float((gradient.abs() * (1.0 - mask)).sum())
        gradient_evidence[identity] = {
            "lossFinite": bool(torch.isfinite(value)),
            "insideMaskGradientAbsSum": inside,
            "outsideMaskGradientAbsSum": outside,
        }
        positive[f"{identity}_finite_nonzero_inside_mask_gradient"] = (
            bool(torch.isfinite(value)) and inside > 0.0
        )
        positive[f"{identity}_zero_outside_mask_gradient"] = outside == 0.0
    aggregate_gradient = torch.autograd.grad(
        result["weightedTotalTensor"], predicted, retain_graph=False,
    )[0]
    positive["aggregate_gradient_finite_nonzero"] = (
        bool(torch.isfinite(aggregate_gradient).all())
        and float(aggregate_gradient.abs().sum()) > 0.0
    )

    trainer_source = Path(trainer.__file__).read_text(encoding="utf-8")
    ast.parse(trainer_source)
    positive["same_50_step_final_decoded_rgb_enters_total_loss"] = all(
        token in trainer_source for token in (
            "predicted_rgb = model.autoencoder.decode",
            "stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses",
            'per_class_luminance["weightedTotalTensor"]',
        )
    )
    positive["checkpoint_selection_uses_same_weighted_obligation"] = all(
        token in trainer_source for token in (
            "per_class_luminance_weighted_total",
            'result["rolloutRgbQualityScore"] += checkpoint_obligation',
            'config["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"]',
        )
    )
    positive["legacy_source_unchanged"] = CONTRACT_KEY not in source.get("training", {})

    negative = {
        "missing_class_rejected": lambda value: value["training"][CONTRACT_KEY]["requiredClasses"].pop(),
        "duplicate_class_rejected": lambda value: value["training"][CONTRACT_KEY]["requiredClasses"].append("object_rock"),
        "reordered_class_rejected": lambda value: value["training"][CONTRACT_KEY]["requiredClasses"].reverse(),
        "cross_class_wiring_rejected": lambda value: value["training"][CONTRACT_KEY]["sourceContract"]["derivedWeights"].update(footprints=value["training"][CONTRACT_KEY]["sourceContract"]["derivedWeights"]["rock"]),
        "wrong_reference_source_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(reference="failed_preview_rgb"),
        "failed_preview_target_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(failedPreviewPixelsUsedAsTargets=True),
        "review_threshold_target_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(machineReviewThresholdsUsedAsTargets=True),
        "review_result_target_rejected": lambda value: value["training"][CONTRACT_KEY]["legalSupervision"].update(machineReviewResultsUsedAsTargets=True),
        "free_rollout_weight_rejected": lambda value: value["training"][CONTRACT_KEY]["aggregation"].update(rolloutWeight=0.123),
        "partial_activation_rejected": lambda value: value["training"][CONTRACT_KEY]["activationGate"].update(trainingNow=True),
        "unknown_field_rejected": lambda value: value["training"][CONTRACT_KEY].update(unknownField=True),
    }
    negative_results = {name: rejects(config, mutate) for name, mutate in negative.items()}
    if not all(positive.values()) or not all(negative_results.values()):
        raise ValueError(
            f"CPU contract regression failed: positive={positive}, negative={negative_results}"
        )
    report = {
        "schemaVersion": "stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-report-v1",
        "status": "passed_stage4_full_rollout_per_class_final_visible_luminance_structure_cpu",
        "config": {"path": project_path(config_path), "sha256": args.config_sha256},
        "source": {"path": project_path(source_path), "sha256": args.source_sha256},
        "positive": positive,
        "negative": negative_results,
        "gradientEvidence": gradient_evidence,
        "positivePassed": sum(positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(negative_results.values()),
        "negativeTotal": len(negative_results),
        "executionBoundary": {
            "checkpointWeightsRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "gpuUsed": False,
            "trainingStarted": False,
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

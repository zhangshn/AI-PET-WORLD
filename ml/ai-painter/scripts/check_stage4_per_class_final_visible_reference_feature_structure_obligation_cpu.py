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
CONTRACT_KEY = "stage4PerClassFinalVisibleReferenceFeatureStructureObligation"


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


def call_path(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = call_path(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


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


class SyntheticFrozenAutoencoder(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = torch.nn.Sequential(
            torch.nn.Conv2d(3, 4, 3, padding=1, bias=False),
            torch.nn.SiLU(),
            torch.nn.Conv2d(4, 6, 4, stride=2, padding=1, bias=False),
            torch.nn.SiLU(),
            torch.nn.Conv2d(6, 8, 4, stride=2, padding=1, bias=False),
            torch.nn.SiLU(),
        )
        generator = torch.Generator().manual_seed(20263722)
        with torch.no_grad():
            for parameter in self.parameters():
                parameter.copy_(torch.rand(
                    parameter.shape, dtype=parameter.dtype, generator=generator,
                ) * 0.08 - 0.04)
        self.requires_grad_(False)


def synthetic_inputs(config: dict):
    height, width = 48, 64
    predicted = torch.linspace(
        0.05, 0.95, 2 * 3 * height * width, dtype=torch.float32,
    ).reshape(2, 3, height, width).clone().requires_grad_(True)
    target = torch.flip(predicted.detach(), dims=(-1,)).clone()
    conditions = torch.zeros(
        2, len(config["conditionChannelOrder"]), height, width,
        dtype=torch.float32,
    )
    regions = {
        "footprints": (slice(4, 20), slice(4, 20)),
        "tree": (slice(4, 20), slice(24, 40)),
        "rock": (slice(24, 40), slice(4, 20)),
        "vegetation": (slice(24, 40), slice(24, 48)),
    }
    order = list(config["conditionChannelOrder"])
    for identity, (ys, xs) in regions.items():
        conditions[:, order.index(f"object_{identity}"), ys, xs] = 1.0
    return predicted, target, conditions, regions


def expect_rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
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
        raise ValueError("reference-feature CPU report output already exists")
    if sha256_file(config_path) != args.config_sha256:
        raise ValueError("reference-feature inactive configuration identity changed")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("reference-feature source configuration identity changed")
    config = read_json(config_path)
    source_config = read_json(source_path)
    contract = (
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            config
        )
    )
    active = active_config(config)
    trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
        active
    )
    predicted, target, conditions, regions = synthetic_inputs(active)
    autoencoder = SyntheticFrozenAutoencoder()
    state_before = {
        name: value.detach().clone() for name, value in autoencoder.state_dict().items()
    }
    result = (
        trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
            autoencoder, predicted, target, conditions, active,
        )
    )
    identities = tuple(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    gradient_evidence = {}
    gradients = {}
    for identity in identities:
        gradient = torch.autograd.grad(
            result["perClassLossTensors"][identity], predicted,
            retain_graph=True,
        )[0]
        gradients[identity] = gradient
        ys, xs = regions[identity]
        mask = torch.zeros_like(gradient)
        mask[:, :, ys, xs] = 1.0
        inside = float((gradient.abs() * mask).sum())
        outside = float((gradient.abs() * (1.0 - mask)).sum())
        other_inside = {}
        for other_identity, (other_ys, other_xs) in regions.items():
            if other_identity == identity:
                continue
            other_inside[other_identity] = float(
                gradient[:, :, other_ys, other_xs].abs().sum()
            )
        gradient_evidence[identity] = {
            "finite": bool(torch.isfinite(gradient).all()),
            "insideMaskAbsSum": inside,
            "outsideMaskAbsSum": outside,
            "otherClassMaskAbsSums": other_inside,
        }
    expected_weighted_total = sum(
        result["perClassLossTensors"][identity]
        * float(contract["sourceContract"]["derivedClassWeights"][identity])
        for identity in identities
    )
    state_after = autoencoder.state_dict()
    trainer_source = ROOT / "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
    checker_source = Path(__file__).resolve()
    trainer_text = trainer_source.read_text(encoding="utf-8")
    checker_text = checker_source.read_text(encoding="utf-8")
    ast.parse(trainer_text)
    ast.parse(checker_text)
    positives = [
        {
            "name": "inactive_contract_valid",
            "passed": contract["status"] == "cpu_support_verified_inactive",
        },
        {"name": "active_contract_valid", "passed": True},
        {
            "name": "exact_four_class_order",
            "passed": list(contract["requiredClasses"])
            == list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        },
        {
            "name": "unique_existing_autoencoder_spatial_stages",
            "passed": result["featureStageCount"] == 3,
        },
        {
            "name": "per_sample_per_class_matrix_preserved",
            "passed": tuple(result["perSampleClassTensors"].shape) == (2, 4),
        },
        {
            "name": "derived_weighted_total_exact",
            "passed": torch.equal(result["weightedTotalTensor"], expected_weighted_total),
        },
        {
            "name": "all_class_gradients_finite_nonzero_inside",
            "passed": all(
                evidence["finite"] and evidence["insideMaskAbsSum"] > 0.0
                for evidence in gradient_evidence.values()
            ),
        },
        {
            "name": "all_class_gradients_zero_outside",
            "passed": all(
                evidence["outsideMaskAbsSum"] == 0.0
                for evidence in gradient_evidence.values()
            ),
        },
        {
            "name": "cross_class_masks_isolated",
            "passed": all(
                all(value == 0.0 for value in evidence["otherClassMaskAbsSums"].values())
                for evidence in gradient_evidence.values()
            ),
        },
        {
            "name": "autoencoder_state_unchanged",
            "passed": all(
                torch.equal(state_before[name], state_after[name])
                for name in state_before
            ),
        },
        {
            "name": "total_loss_path_registered",
            "passed": (
                'reference_feature_structure["weightedTotalTensor"]' in trainer_text
                and "stage4PerClassFinalVisibleReferenceFeatureStructureWeightedLoss"
                in trainer_text
            ),
        },
        {
            "name": "checkpoint_qualification_path_registered",
            "passed": (
                "rolloutPerClassFinalVisibleReferenceFeatureStructureCheckpointObligation"
                in trainer_text
                and 'result["rolloutRgbQualityScore"] += checkpoint_obligation'
                in trainer_text
            ),
        },
    ]
    mutations = []
    missing = deepcopy(config)
    del missing["training"][CONTRACT_KEY]["featureExtraction"]
    mutations.append(("missing_field", missing))
    unknown = deepcopy(config)
    unknown["training"][CONTRACT_KEY]["unknown"] = True
    mutations.append(("unknown_field", unknown))
    order_changed = deepcopy(config)
    order_changed["training"][CONTRACT_KEY]["requiredClasses"][0:2] = reversed(
        order_changed["training"][CONTRACT_KEY]["requiredClasses"][0:2]
    )
    mutations.append(("class_order_changed", order_changed))
    wrong_feature = deepcopy(config)
    wrong_feature["training"][CONTRACT_KEY]["featureExtraction"]["autoencoderSource"] = "other"
    mutations.append(("wrong_feature_source", wrong_feature))
    free_stage = deepcopy(config)
    free_stage["training"][CONTRACT_KEY]["featureExtraction"]["spatialStageSelection"] = "manual"
    mutations.append(("free_feature_stage", free_stage))
    free_class_weight = deepcopy(config)
    free_class_weight["training"][CONTRACT_KEY]["sourceContract"]["derivedClassWeights"]["tree"] += 0.01
    mutations.append(("free_class_weight", free_class_weight))
    free_rollout_weight = deepcopy(config)
    free_rollout_weight["training"][CONTRACT_KEY]["aggregation"]["rolloutWeight"] += 0.01
    mutations.append(("free_rollout_weight", free_rollout_weight))
    failed_preview = deepcopy(config)
    failed_preview["training"][CONTRACT_KEY]["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] = True
    mutations.append(("failed_preview_target", failed_preview))
    review_target = deepcopy(config)
    review_target["training"][CONTRACT_KEY]["legalSupervision"]["machineReviewResultsUsedAsTargets"] = True
    mutations.append(("review_result_target", review_target))
    wrong_mask = deepcopy(config)
    wrong_mask["training"][CONTRACT_KEY]["legalSupervision"]["maskChannels"][1] = "object_rock"
    mutations.append(("cross_class_mask_wiring", wrong_mask))
    wrong_checkpoint = deepcopy(config)
    wrong_checkpoint["training"][CONTRACT_KEY]["checkpointQualification"]["source"] = "review_result"
    mutations.append(("checkpoint_source_changed", wrong_checkpoint))
    model_change = deepcopy(config)
    model_change["training"][CONTRACT_KEY]["compatibility"]["modelArchitectureChanged"] = True
    mutations.append(("model_change", model_change))
    gate = deepcopy(config)
    gate["training"][CONTRACT_KEY]["activationGate"]["gpuUseNow"] = True
    mutations.append(("inactive_gpu_gate", gate))
    evidence = deepcopy(config)
    evidence["training"][CONTRACT_KEY]["evidenceBindings"]["causalAdjudication"]["sha256"] = "0" * 64
    mutations.append(("evidence_hash_changed", evidence))
    negatives = [expect_rejected(name, mutated) for name, mutated in mutations]
    legacy = deepcopy(config)
    del legacy["training"][CONTRACT_KEY]
    positives.append({
        "name": "legacy_config_without_contract_preserved",
        "passed": legacy == source_config,
    })
    checker_calls = {
        call_path(node.func)
        for node in ast.walk(ast.parse(checker_text))
        if isinstance(node, ast.Call)
    }
    positives.append({
        "name": "cpu_checker_forbidden_runtime_actions_absent",
        "passed": not any(
            name == "torch.load"
            or name.endswith(".backward")
            or name.startswith("torch.optim.")
            or name.endswith(".cuda")
            for name in checker_calls
        ),
    })
    positive_passed = sum(bool(item["passed"]) for item in positives)
    negative_passed = sum(bool(item["passed"]) for item in negatives)
    status = (
        "passed_stage4_per_class_final_visible_reference_feature_structure_cpu_contract"
        if positive_passed == len(positives) and negative_passed == len(negatives)
        else "failed_stage4_per_class_final_visible_reference_feature_structure_cpu_contract"
    )
    report = {
        "status": status,
        "positivePassed": positive_passed,
        "positiveTotal": len(positives),
        "negativePassed": negative_passed,
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "gradientEvidence": gradient_evidence,
        "featureEvidence": {
            "uniqueSpatialStageCount": result["featureStageCount"],
            "perSampleClassShape": list(result["perSampleClassTensors"].shape),
            "derivedClassWeights": result["derivedClassWeights"],
            "source": "synthetic_cpu_frozen_autoencoder_no_checkpoint",
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
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": status,
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
        "positive": f"{positive_passed}/{len(positives)}",
        "negative": f"{negative_passed}/{len(negatives)}",
    }))
    return 0 if status.startswith("passed_") else 1


if __name__ == "__main__":
    raise SystemExit(main())

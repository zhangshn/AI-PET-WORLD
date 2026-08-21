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
CONTRACT_KEY = "stage4PerClassWorstSampleReferenceFeatureStructureObligation"


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
                parameter.copy_(
                    torch.rand(
                        parameter.shape,
                        dtype=parameter.dtype,
                        generator=generator,
                    ) * 0.08 - 0.04
                )
        self.requires_grad_(False)


def synthetic_images(config: dict):
    height, width = 48, 64
    predicted = torch.linspace(
        0.04, 0.96, 4 * 3 * height * width, dtype=torch.float32,
    ).reshape(4, 3, height, width).clone().requires_grad_(True)
    target = torch.flip(predicted.detach(), dims=(-1,)).clone()
    conditions = torch.zeros(
        4, len(config["conditionChannelOrder"]), height, width,
        dtype=torch.float32,
    )
    regions = {
        "footprints": (slice(2, 12), slice(2, 14)),
        "tree": (slice(14, 24), slice(16, 28)),
        "rock": (slice(26, 36), slice(30, 42)),
        "vegetation": (slice(38, 46), slice(46, 62)),
    }
    order = list(config["conditionChannelOrder"])
    for identity, (ys, xs) in regions.items():
        conditions[:, order.index(f"object_{identity}"), ys, xs] = 1.0
    return predicted, target, conditions, regions


def expect_rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
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
    parser.add_argument("--audit-output", type=Path, required=True)
    args = parser.parse_args()
    config_path = (ROOT / args.config).resolve()
    source_path = (ROOT / args.source).resolve()
    output_path = (ROOT / args.output).resolve()
    audit_path = (ROOT / args.audit_output).resolve()
    if output_path.exists() or audit_path.exists():
        raise ValueError("per-class worst reference-feature CPU output already exists")
    if sha256_file(config_path) != args.config_sha256:
        raise ValueError("per-class worst reference-feature config identity changed")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("per-class worst reference-feature source identity changed")

    config = read_json(config_path)
    source = read_json(source_path)
    contract = (
        trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
            config
        )
    )
    identities = tuple(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    weights = contract["sourceContracts"]["derivedClassWeights"]
    rollout_weight = float(contract["sourceContracts"]["rolloutWeight"])

    direct_tensor = torch.tensor([
        [9.0, 1.0, 1.0, 1.0],
        [1.0, 8.0, 1.0, 1.0],
        [1.0, 1.0, 7.0, 1.0],
        [1.0, 1.0, 1.0, 6.0],
    ], dtype=torch.float32, requires_grad=True)
    sample_ids = ["sample-d", "sample-c", "sample-b", "sample-a"]
    direct = (
        trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
            direct_tensor, sample_ids, config
        )
    )
    expected_total = sum(
        direct_tensor[index, index] * float(weights[identity])
        for index, identity in enumerate(identities)
    )
    direct_gradient = torch.autograd.grad(
        direct["weightedTotalTensor"], direct_tensor, retain_graph=True,
    )[0]
    expected_support = torch.eye(4, dtype=torch.bool)

    tie_tensor = torch.ones(2, 4, dtype=torch.float32, requires_grad=True)
    tie = (
        trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
            tie_tensor, ["sample-z", "sample-a"], config
        )
    )

    predicted, target, conditions, regions = synthetic_images(config)
    autoencoder = SyntheticFrozenAutoencoder()
    autoencoder_before = {
        name: value.detach().clone() for name, value in autoencoder.state_dict().items()
    }
    feature = (
        trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
            autoencoder, predicted, target, conditions, config
        )
    )
    image_result = (
        trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
            feature["perSampleClassTensors"], sample_ids, config
        )
    )
    image_gradient_evidence = {}
    for identity, selection in zip(identities, image_result["perClassSelections"]):
        gradient = torch.autograd.grad(
            image_result["perClassWorstTensors"][identity],
            predicted,
            retain_graph=True,
        )[0]
        selected_index = int(selection["sampleIndex"])
        ys, xs = regions[identity]
        mask = torch.zeros_like(gradient)
        mask[selected_index:selected_index + 1, :, ys, xs] = 1.0
        image_gradient_evidence[identity] = {
            "selectedSampleIndex": selected_index,
            "selectedSampleId": selection["sampleId"],
            "finite": bool(torch.isfinite(gradient).all()),
            "insideMaskAbsSum": float((gradient.abs() * mask).sum()),
            "outsideMaskAbsSum": float((gradient.abs() * (1.0 - mask)).sum()),
        }

    total_gradient = torch.autograd.grad(
        image_result["weightedTotalTensor"], predicted, retain_graph=True,
    )[0]
    selected_union = torch.zeros_like(total_gradient)
    for identity, selection in zip(identities, image_result["perClassSelections"]):
        index = int(selection["sampleIndex"])
        ys, xs = regions[identity]
        selected_union[index:index + 1, :, ys, xs] = 1.0

    trainer_path = ROOT / "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
    checker_path = Path(__file__).resolve()
    trainer_text = trainer_path.read_text(encoding="utf-8")
    checker_ast = ast.parse(checker_path.read_text(encoding="utf-8"))
    checker_calls = {
        call_path(node.func)
        for node in ast.walk(checker_ast)
        if isinstance(node, ast.Call)
    }

    positives = [
        {
            "name": "inactive_contract_valid_and_all_gates_closed",
            "passed": (
                contract["status"] == "cpu_support_verified_inactive"
                and all(value is False for value in contract["activationGate"].values())
            ),
        },
        {
            "name": "source_config_preserved_except_new_contract",
            "passed": (
                {key: value for key, value in config["training"].items() if key != CONTRACT_KEY}
                == source["training"]
                and {key: value for key, value in config.items() if key != "training"}
                == {key: value for key, value in source.items() if key != "training"}
            ),
        },
        {
            "name": "four_classes_select_independent_worst_samples",
            "passed": [
                (row["classIdentity"], row["sampleIndex"])
                for row in direct["perClassSelections"]
            ] == list(zip(identities, range(4))),
        },
        {
            "name": "per_class_worst_total_uses_only_existing_derived_weights",
            "passed": torch.equal(direct["weightedTotalTensor"], expected_total),
        },
        {
            "name": "checkpoint_qualification_uses_same_total_and_rollout_weight",
            "passed": torch.equal(
                direct["checkpointQualificationTensor"], expected_total * rollout_weight
            ),
        },
        {
            "name": "total_loss_gradient_routes_to_each_selected_sample_class_only",
            "passed": (
                torch.equal(direct_gradient != 0, expected_support)
                and bool(torch.isfinite(direct_gradient).all())
            ),
        },
        {
            "name": "per_class_tie_break_is_lexicographic_sample_id",
            "passed": all(
                row["sampleIndex"] == 1 and row["sampleId"] == "sample-a"
                for row in tie["perClassSelections"]
            ),
        },
        {
            "name": "real_feature_path_has_finite_nonzero_masked_gradients",
            "passed": all(
                item["finite"] and item["insideMaskAbsSum"] > 0.0
                for item in image_gradient_evidence.values()
            ),
        },
        {
            "name": "real_feature_path_has_zero_gradient_outside_bound_mask",
            "passed": all(
                item["outsideMaskAbsSum"] == 0.0
                for item in image_gradient_evidence.values()
            ),
        },
        {
            "name": "four_class_total_gradient_isolated_to_selected_class_regions",
            "passed": (
                float((total_gradient.abs() * selected_union).sum()) > 0.0
                and float((total_gradient.abs() * (1.0 - selected_union)).sum()) == 0.0
            ),
        },
        {
            "name": "no_new_replay_pass_or_optimizer_step_budget",
            "passed": (
                contract["totalLoss"]["additionalReplayPasses"] == 0
                and contract["totalLoss"]["additionalOptimizerSteps"] == 0
            ),
        },
        {
            "name": "main_loss_and_checkpoint_contract_registered_in_trainer",
            "passed": (
                "sum_four_per_class_maxima_using_existing_derived_class_weights"
                in trainer_text
                and "checkpointQualificationTensor" in trainer_text
                and "validationCheckpointSelectionScore" in trainer_text
            ),
        },
        {
            "name": "frozen_autoencoder_state_unchanged",
            "passed": all(
                torch.equal(autoencoder_before[name], autoencoder.state_dict()[name])
                for name in autoencoder_before
            ),
        },
        {
            "name": "legacy_without_new_contract_preserved",
            "passed": (
                trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
                    source
                ) is None
                and trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
                    source
                ) is not None
            ),
        },
        {
            "name": "cpu_checker_forbidden_runtime_actions_absent",
            "passed": not any(
                name == "torch.load"
                or name.endswith(".backward")
                or name.startswith("torch.optim.")
                or name.endswith(".cuda")
                for name in checker_calls
            ),
        },
    ]

    mutations = []
    missing = deepcopy(config)
    del missing["training"][CONTRACT_KEY]["selection"]
    mutations.append(("missing_field", missing))
    unknown = deepcopy(config)
    unknown["training"][CONTRACT_KEY]["unknown"] = True
    mutations.append(("unknown_field", unknown))
    order = deepcopy(config)
    order["training"][CONTRACT_KEY]["selection"]["classIdentities"][0:2] = reversed(
        order["training"][CONTRACT_KEY]["selection"]["classIdentities"][0:2]
    )
    mutations.append(("class_order_changed", order))
    global_max = deepcopy(config)
    global_max["training"][CONTRACT_KEY]["selection"]["globalCrossClassMaximumAllowed"] = True
    mutations.append(("global_cross_class_max_reintroduced", global_max))
    tensor_source = deepcopy(config)
    tensor_source["training"][CONTRACT_KEY]["sourceContracts"]["perSampleClassTensorSource"] = "historical"
    mutations.append(("tensor_source_changed", tensor_source))
    class_weight = deepcopy(config)
    class_weight["training"][CONTRACT_KEY]["sourceContracts"]["derivedClassWeights"]["tree"] += 0.01
    mutations.append(("free_class_weight", class_weight))
    rollout_weight_change = deepcopy(config)
    rollout_weight_change["training"][CONTRACT_KEY]["sourceContracts"]["rolloutWeight"] += 0.01
    mutations.append(("free_rollout_weight", rollout_weight_change))
    extra_pass = deepcopy(config)
    extra_pass["training"][CONTRACT_KEY]["totalLoss"]["additionalReplayPasses"] = 1
    mutations.append(("extra_replay_pass", extra_pass))
    extra_step = deepcopy(config)
    extra_step["training"][CONTRACT_KEY]["totalLoss"]["additionalOptimizerSteps"] = 1
    mutations.append(("extra_optimizer_step", extra_step))
    wrong_reference = deepcopy(config)
    wrong_reference["training"][CONTRACT_KEY]["legalSupervision"]["reference"] = "failed_preview"
    mutations.append(("failed_preview_reference", wrong_reference))
    wrong_mask = deepcopy(config)
    wrong_mask["training"][CONTRACT_KEY]["legalSupervision"]["maskChannels"][1] = "object_rock"
    mutations.append(("cross_class_mask", wrong_mask))
    review_target = deepcopy(config)
    review_target["training"][CONTRACT_KEY]["legalSupervision"]["machineReviewResultsUsedAsTargets"] = True
    mutations.append(("review_result_target", review_target))
    validation_target = deepcopy(config)
    validation_target["training"][CONTRACT_KEY]["legalSupervision"]["validationSamplesUsedAsTrainingTargets"] = True
    mutations.append(("validation_target", validation_target))
    checkpoint_population = deepcopy(config)
    checkpoint_population["training"][CONTRACT_KEY]["checkpointQualification"]["population"] = "train"
    mutations.append(("checkpoint_population_changed", checkpoint_population))
    gate = deepcopy(config)
    gate["training"][CONTRACT_KEY]["activationGate"]["gpuUseNow"] = True
    mutations.append(("inactive_gpu_gate", gate))
    evidence = deepcopy(config)
    evidence["training"][CONTRACT_KEY]["evidenceBindings"]["causalDecision"]["sha256"] = "0" * 64
    mutations.append(("evidence_identity_changed", evidence))
    authorization = deepcopy(config)
    authorization["training"][CONTRACT_KEY]["ownerImplementationAuthorization"]["authorizationSha256"] = "0" * 64
    mutations.append(("authorization_identity_changed", authorization))
    negatives = [expect_rejected(name, mutated) for name, mutated in mutations]

    tensor_negatives = []
    for name, value, ids in (
        ("invalid_rank", torch.ones(4), ["sample-a"]),
        ("invalid_class_count", torch.ones(1, 5), ["sample-a"]),
        ("non_finite", torch.tensor([[1.0, 2.0, float("nan"), 4.0]]), ["sample-a"]),
        ("duplicate_sample_id", torch.ones(2, 4), ["duplicate", "duplicate"]),
    ):
        try:
            trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
                value, ids, config
            )
        except (TypeError, ValueError):
            tensor_negatives.append({"name": name, "passed": True})
        else:
            tensor_negatives.append({"name": name, "passed": False})
    negatives.extend(tensor_negatives)

    positive_passed = sum(bool(item["passed"]) for item in positives)
    negative_passed = sum(bool(item["passed"]) for item in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    status = (
        "passed_stage4_per_class_worst_sample_reference_feature_structure_cpu_contract"
        if passed
        else "failed_stage4_per_class_worst_sample_reference_feature_structure_cpu_contract"
    )
    report = {
        "schemaVersion": (
            "stage4-per-class-worst-sample-reference-feature-structure-cpu-report-v1"
        ),
        "status": status,
        "positivePassed": positive_passed,
        "positiveTotal": len(positives),
        "negativePassed": negative_passed,
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "directSelections": direct["perClassSelections"],
        "directGradient": direct_gradient.detach().tolist(),
        "imageGradientEvidence": image_gradient_evidence,
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
    audit = {
        "schemaVersion": (
            "stage4-per-class-worst-sample-reference-feature-structure-config-audit-v1"
        ),
        "status": "passed_configuration_audit" if passed else "failed_configuration_audit",
        "contractId": contract["contractId"],
        "exactFields": list(contract),
        "classIdentities": list(identities),
        "derivedClassWeights": weights,
        "rolloutWeight": rollout_weight,
        "allActivationGatesFalse": all(
            value is False for value in contract["activationGate"].values()
        ),
        "sourceConfigPreserved": positives[1]["passed"],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    audit_path.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "status": status,
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
        "auditPath": project_path(audit_path),
        "auditSha256": sha256_file(audit_path),
        "positive": f"{positive_passed}/{len(positives)}",
        "negative": f"{negative_passed}/{len(negatives)}",
    }))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

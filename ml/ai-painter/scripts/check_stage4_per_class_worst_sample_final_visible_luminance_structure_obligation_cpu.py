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
CONTRACT_KEY = "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"


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


def rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
            config
        )
    except (KeyError, TypeError, ValueError) as error:
        return {"name": name, "passed": True, "error": str(error)}
    return {"name": name, "passed": False, "error": "mutation accepted"}


def synthetic_images(config: dict):
    height, width = 48, 64
    predicted = torch.linspace(
        0.03, 0.97, 4 * 3 * height * width, dtype=torch.float32,
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
        raise ValueError("per-class worst-sample luminance CPU output exists")
    if sha256_file(config_path) != args.config_sha256:
        raise ValueError("per-class worst-sample luminance config changed")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("per-class worst-sample luminance source changed")
    config = read_json(config_path)
    source = read_json(source_path)
    contract = (
        trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(
            config
        )
    )
    identities = tuple(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    rollout_weight = float(contract["sourceContracts"]["rolloutWeight"])

    direct_tensor = torch.tensor([
        [9.0, 1.0, 1.0, 1.0],
        [1.0, 8.0, 1.0, 1.0],
        [1.0, 1.0, 7.0, 1.0],
        [1.0, 1.0, 1.0, 6.0],
    ], dtype=torch.float32, requires_grad=True)
    sample_ids = ["sample-d", "sample-c", "sample-b", "sample-a"]
    direct = (
        trainer.stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(
            direct_tensor, sample_ids, config
        )
    )
    expected_total = sum(direct_tensor[index, index] for index in range(4))
    direct_gradient = torch.autograd.grad(
        direct["weightedTotalTensor"], direct_tensor, retain_graph=True,
    )[0]
    tie = (
        trainer.stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(
            torch.ones(2, 4, dtype=torch.float32, requires_grad=True),
            ["sample-z", "sample-a"],
            config,
        )
    )

    predicted, target, conditions, regions = synthetic_images(config)
    source_losses = (
        trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
            predicted, target, conditions, config
        )
    )
    image_result = (
        trainer.stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(
            source_losses["weightedPerSampleClassTensors"], sample_ids, config
        )
    )
    gradient_evidence = {}
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
        gradient_evidence[identity] = {
            "selectedSampleIndex": selected_index,
            "selectedSampleId": selection["sampleId"],
            "finite": bool(torch.isfinite(gradient).all()),
            "insideMaskAbsSum": float((gradient.abs() * mask).sum()),
            "outsideMaskAbsSum": float((gradient.abs() * (1.0 - mask)).sum()),
        }

    trainer_path = ROOT / "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
    trainer_text = trainer_path.read_text(encoding="utf-8")
    checker_ast = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    calls = {
        call_path(node.func) for node in ast.walk(checker_ast)
        if isinstance(node, ast.Call)
    }
    source_preserved = (
        {key: value for key, value in config["training"].items() if key != CONTRACT_KEY}
        == source["training"]
        and {key: value for key, value in config.items() if key != "training"}
        == {key: value for key, value in source.items() if key != "training"}
    )
    positives = [
        {"name": "inactive_contract_valid_all_gates_closed", "passed": contract["status"] == "cpu_support_verified_inactive" and not any(contract["activationGate"].values())},
        {"name": "source_config_preserved_except_new_contract", "passed": source_preserved},
        {"name": "four_classes_select_independent_worst_samples", "passed": [(row["classIdentity"], row["sampleIndex"]) for row in direct["perClassSelections"]] == list(zip(identities, range(4)))},
        {"name": "weighted_total_sums_four_already_weighted_maxima", "passed": torch.equal(direct["weightedTotalTensor"], expected_total)},
        {"name": "checkpoint_uses_same_total_and_rollout_weight", "passed": torch.equal(direct["checkpointQualificationTensor"], expected_total * rollout_weight)},
        {"name": "direct_gradient_only_selected_sample_class", "passed": torch.equal(direct_gradient != 0, torch.eye(4, dtype=torch.bool)) and bool(torch.isfinite(direct_gradient).all())},
        {"name": "tie_break_is_lexicographic_sample_id", "passed": all(row["sampleIndex"] == 1 and row["sampleId"] == "sample-a" for row in tie["perClassSelections"])},
        {"name": "masked_luminance_gradients_finite_nonzero", "passed": all(row["finite"] and row["insideMaskAbsSum"] > 0.0 for row in gradient_evidence.values())},
        {"name": "masked_luminance_gradients_zero_outside", "passed": all(row["outsideMaskAbsSum"] == 0.0 for row in gradient_evidence.values())},
        {"name": "existing_derived_weights_and_rollout_weight_reused", "passed": contract["sourceContracts"]["derivedClassWeights"] == source["training"]["stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"]["sourceContract"]["derivedWeights"] and rollout_weight == float(source["training"]["stage4FullRolloutFinalVisibleConsistency"]["weight"])},
        {"name": "same_total_loss_slot_replaces_global_maximum", "passed": contract["totalLoss"]["entersExistingFullRolloutLossSlot"] and contract["totalLoss"]["replacesGlobalSampleClassMaximumInThatSlot"] and "- existing_global_worst" in trainer_text and "+ replacement" in trainer_text},
        {"name": "checkpoint_per_class_maximum_registered", "passed": "worst_sample_class_luminance_per_class_values" in trainer_text and "rolloutPerClassWorstSampleFinalVisibleLuminanceStructureCheckpointObligation" in trainer_text},
        {"name": "no_new_weight_or_optimizer_step", "passed": contract["totalLoss"]["additionalLossWeight"] is False and contract["totalLoss"]["additionalOptimizerSteps"] == 0},
        {"name": "training_validation_roles_separated", "passed": contract["selection"]["trainingPopulation"] == "all_48_train_split_records" and contract["selection"]["checkpointPopulation"] == "all_8_validation_split_records" and contract["selection"]["validationSamplesUsedForWeightUpdates"] is False},
        {"name": "legacy_source_without_contract_preserved", "passed": trainer.validate_stage4_per_class_worst_sample_final_visible_luminance_structure_obligation(source) is None},
        {"name": "checker_forbidden_runtime_actions_absent", "passed": not any(name == "torch.load" or name.endswith(".backward") or name.startswith("torch.optim.") or name.endswith(".cuda") for name in calls)},
    ]

    mutations = []
    def mutate(name, action):
        value = deepcopy(config)
        action(value["training"][CONTRACT_KEY])
        mutations.append((name, value))
    mutate("missing_field", lambda c: c.pop("selection"))
    mutate("unknown_field", lambda c: c.update({"unknown": True}))
    mutate("class_order_changed", lambda c: c["selection"]["classIdentities"].reverse())
    mutate("global_maximum_reintroduced", lambda c: c["selection"].update({"globalCrossClassMaximumAllowed": True}))
    mutate("training_population_changed", lambda c: c["selection"].update({"trainingPopulation": "all_64"}))
    mutate("validation_used_for_training", lambda c: c["selection"].update({"validationSamplesUsedForWeightUpdates": True}))
    mutate("challenge_used_for_training", lambda c: c["selection"].update({"challengeOrRegressionUsedForWeightUpdates": True}))
    mutate("tensor_source_changed", lambda c: c["sourceContracts"].update({"weightedPerSampleClassTensorSource": "historical"}))
    mutate("class_weight_changed", lambda c: c["sourceContracts"]["derivedClassWeights"].update({"tree": 999.0}))
    mutate("rollout_weight_changed", lambda c: c["sourceContracts"].update({"rolloutWeight": 999.0}))
    mutate("extra_loss_weight", lambda c: c["totalLoss"].update({"additionalLossWeight": True}))
    mutate("extra_optimizer_step", lambda c: c["totalLoss"].update({"additionalOptimizerSteps": 1}))
    mutate("wrong_reference", lambda c: c["legalSupervision"].update({"reference": "failed_preview"}))
    mutate("cross_class_mask", lambda c: c["legalSupervision"]["maskChannels"].__setitem__(1, "object_rock"))
    mutate("review_target", lambda c: c["legalSupervision"].update({"machineReviewResultsUsedAsTargets": True}))
    mutate("gpu_gate", lambda c: c["activationGate"].update({"gpuUseNow": True}))
    mutate("evidence_changed", lambda c: c["evidenceBindings"]["designDecision"].update({"sha256": "0" * 64}))
    mutate("authorization_changed", lambda c: c["ownerImplementationAuthorization"].update({"authorizationSha256": "0" * 64}))
    negatives = [rejected(name, value) for name, value in mutations]
    for name, tensor, ids in (
        ("invalid_rank", torch.ones(4), ["sample-a"]),
        ("invalid_class_count", torch.ones(1, 5), ["sample-a"]),
        ("non_finite", torch.tensor([[1.0, 2.0, float("nan"), 4.0]]), ["sample-a"]),
        ("duplicate_sample_id", torch.ones(2, 4), ["duplicate", "duplicate"]),
    ):
        try:
            trainer.stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(tensor, ids, config)
        except (TypeError, ValueError):
            negatives.append({"name": name, "passed": True})
        else:
            negatives.append({"name": name, "passed": False})

    positive_passed = sum(bool(row["passed"]) for row in positives)
    negative_passed = sum(bool(row["passed"]) for row in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    status = "passed_stage4_per_class_worst_sample_final_visible_luminance_structure_cpu_contract" if passed else "failed_stage4_per_class_worst_sample_final_visible_luminance_structure_cpu_contract"
    report = {
        "schemaVersion": "stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-report-v1",
        "status": status,
        "positivePassed": positive_passed, "positiveTotal": len(positives),
        "negativePassed": negative_passed, "negativeTotal": len(negatives),
        "positives": positives, "negatives": negatives,
        "directSelections": direct["perClassSelections"],
        "directGradient": direct_gradient.detach().tolist(),
        "imageGradientEvidence": gradient_evidence,
        "safety": {"checkpointRead": False, "optimizerCreated": False, "backwardExecuted": False, "gpuUsed": False, "trainingStarted": False},
        "config": {"path": project_path(config_path), "sha256": args.config_sha256},
        "source": {"path": project_path(source_path), "sha256": args.source_sha256},
    }
    audit = {
        "schemaVersion": "stage4-per-class-worst-sample-final-visible-luminance-structure-config-audit-v1",
        "status": "passed_configuration_audit" if passed else "failed_configuration_audit",
        "contractId": contract["contractId"],
        "classIdentities": list(identities),
        "derivedClassWeights": contract["sourceContracts"]["derivedClassWeights"],
        "rolloutWeight": rollout_weight,
        "allActivationGatesFalse": not any(contract["activationGate"].values()),
        "sourceConfigPreserved": source_preserved,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "path": project_path(output_path), "sha256": sha256_file(output_path), "auditPath": project_path(audit_path), "auditSha256": sha256_file(audit_path), "positive": f"{positive_passed}/{len(positives)}", "negative": f"{negative_passed}/{len(negatives)}"}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import ast
import hashlib
import json
from pathlib import Path

import torch

import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_full_rollout_per_class_final_visible_luminance_structure_gpu_qualification as gpu_runner


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4EpochWorstSampleClassReferenceFeatureStructureReplay"


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
    # Mirror the legal sample-194 topology: the typed object masks live inside
    # the broader footprint support.  Cross-source isolation therefore cannot
    # be inferred from gradients observed in another (overlapping) mask.
    regions = {
        "footprints": (slice(2, 46), slice(2, 62)),
        "tree": (slice(6, 18), slice(6, 20)),
        "rock": (slice(24, 36), slice(6, 20)),
        "vegetation": (slice(6, 38), slice(28, 56)),
    }
    order = list(config["conditionChannelOrder"])
    for identity, (ys, xs) in regions.items():
        conditions[:, order.index(f"object_{identity}"), ys, xs] = 1.0
    return predicted, target, conditions, regions


def expect_rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
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
        raise ValueError("epoch-worst reference-feature CPU output already exists")
    if sha256_file(config_path) != args.config_sha256:
        raise ValueError("epoch-worst reference-feature config identity changed")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("epoch-worst reference-feature source identity changed")

    config = read_json(config_path)
    source = read_json(source_path)
    contract = (
        trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
            config
        )
    )
    predicted, target, conditions, regions = synthetic_inputs(config)
    autoencoder = SyntheticFrozenAutoencoder()
    autoencoder_before = {
        name: value.detach().clone() for name, value in autoencoder.state_dict().items()
    }
    feature_result = (
        trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
            autoencoder, predicted, target, conditions, config
        )
    )
    per_sample_class = feature_result["perSampleClassTensors"]
    weighted = (
        trainer.stage4_epoch_worst_reference_feature_weighted_per_sample_class_tensor(
            per_sample_class, config
        )
    )
    sample_ids = ["sample-z", "sample-a"]
    candidate = trainer.stage4_epoch_worst_reference_feature_candidate(
        per_sample_class, sample_ids, config
    )
    flat_index = int(weighted.detach().reshape(-1).argmax())
    expected_sample_index = flat_index // weighted.shape[1]
    expected_object_class_index = flat_index % weighted.shape[1]
    identities = tuple(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])

    gradient_evidence = {}
    order = list(config["conditionChannelOrder"])
    for object_class_index, identity in enumerate(identities):
        replay = trainer.stage4_epoch_worst_reference_feature_replay_loss_from_tensor(
            per_sample_class[0:1], config, object_class_index + 1
        )
        gradient = torch.autograd.grad(
            replay["stage4EpochWorstSampleClassReplayLossTensor"],
            predicted,
            retain_graph=True,
        )[0]
        ys, xs = regions[identity]
        bound_sample_mask = torch.zeros_like(gradient)
        bound_sample_mask[0:1, :, ys, xs] = 1.0
        inside = float((gradient.abs() * bound_sample_mask).sum())
        outside = float((gradient.abs() * (1.0 - bound_sample_mask)).sum())
        alternate_conditions = conditions.clone()
        for other_identity in identities:
            if other_identity != identity:
                alternate_conditions[
                    :, order.index(f"object_{other_identity}"):
                    order.index(f"object_{other_identity}") + 1
                ].zero_()
        alternate_result = (
            trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
                autoencoder, predicted, target, alternate_conditions, config
            )
        )
        alternate_tensor = alternate_result["perSampleClassTensors"]
        alternate_replay = (
            trainer.stage4_epoch_worst_reference_feature_replay_loss_from_tensor(
                alternate_tensor[0:1], config, object_class_index + 1
            )
        )
        alternate_loss = alternate_replay[
            "stage4EpochWorstSampleClassReplayLossTensor"
        ]
        alternate_gradient = torch.autograd.grad(
            alternate_loss, predicted, retain_graph=True,
        )[0]
        baseline_selection_tensor = torch.zeros_like(per_sample_class[0:1])
        baseline_selection_tensor[0, object_class_index] = per_sample_class[
            0, object_class_index
        ]
        alternate_selection_tensor = torch.zeros_like(alternate_tensor[0:1])
        alternate_selection_tensor[0, object_class_index] = alternate_tensor[
            0, object_class_index
        ]
        baseline_selection = trainer.stage4_epoch_worst_reference_feature_candidate(
            baseline_selection_tensor, ["bound-sample"], config
        )
        alternate_selection = trainer.stage4_epoch_worst_reference_feature_candidate(
            alternate_selection_tensor, ["bound-sample"], config
        )
        decoded_rgb_gradient_equivalence = (
            gpu_runner.dtype_derived_gradient_equivalence(
                gradient, alternate_gradient
            )
        )
        source_isolation = {
            "contractId": (
                "stage4_reference_feature_source_isolation_causal_boundary_v1"
            ),
            "otherConditionChannelsAblated": [
                f"object_{other_identity}"
                for other_identity in identities
                if other_identity != identity
            ],
            "ownPerSampleClassTensorIdentical": torch.equal(
                per_sample_class[0, object_class_index].detach(),
                alternate_tensor[0, object_class_index].detach(),
            ),
            "ownReplayLossIdentical": torch.equal(
                replay["stage4EpochWorstSampleClassReplayLossTensor"].detach(),
                alternate_loss.detach(),
            ),
            "ownSelectionIdentityIdentical": (
                baseline_selection["sampleIndex"]
                == alternate_selection["sampleIndex"]
                and baseline_selection["classIndex"]
                == alternate_selection["classIndex"]
                and baseline_selection["classIdentity"]
                == alternate_selection["classIdentity"]
                and baseline_selection["score"]
                == alternate_selection["score"]
            ),
            "ownDecodedRgbGradientEquivalent": (
                decoded_rgb_gradient_equivalence["equivalent"]
            ),
            "decodedRgbGradientEquivalence": decoded_rgb_gradient_equivalence,
            "independentFullParameterGradientIdentityComparisonExecuted": False,
        }
        gradient_evidence[identity] = {
            "finite": bool(torch.isfinite(gradient).all()),
            "insideMaskAbsSum": inside,
            "outsideMaskAbsSum": outside,
            "sourceIsolation": source_isolation,
            "selectedClassIndex": object_class_index + 1,
        }

    tie_tensor = torch.ones(2, 4, dtype=torch.float32)
    tie_candidate = trainer.stage4_epoch_worst_reference_feature_candidate(
        tie_tensor, ["sample-z", "sample-a"], config
    )
    trainer_path = ROOT / "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
    runner_path = ROOT / "ml/ai-painter/scripts/run_stage4_full_rollout_per_class_final_visible_luminance_structure_gpu_qualification.py"
    checker_path = Path(__file__).resolve()
    trainer_text = trainer_path.read_text(encoding="utf-8")
    runner_text = runner_path.read_text(encoding="utf-8")
    checker_text = checker_path.read_text(encoding="utf-8")
    trainer_ast = ast.parse(trainer_text)
    checker_ast = ast.parse(checker_text)
    checker_calls = {
        call_path(node.func)
        for node in ast.walk(checker_ast)
        if isinstance(node, ast.Call)
    }
    baseline_gradient = torch.tensor(
        [1.0, 0.0, 0.125, -0.5], dtype=torch.float32
    )
    dtype_close_gradient = torch.tensor(
        [1.0 + 1.0e-7, 0.0, 0.125 + 1.0e-8, -0.5],
        dtype=torch.float32,
    )
    outside_dtype_tolerance_gradient = torch.tensor(
        [1.01, 0.0, 0.125, -0.5], dtype=torch.float32
    )
    changed_support_gradient = torch.tensor(
        [1.0, 1.0e-8, 0.125, -0.5], dtype=torch.float32
    )
    dtype_close_evidence = gpu_runner.dtype_derived_gradient_equivalence(
        baseline_gradient, dtype_close_gradient
    )
    outside_tolerance_evidence = gpu_runner.dtype_derived_gradient_equivalence(
        baseline_gradient, outside_dtype_tolerance_gradient
    )
    changed_support_evidence = gpu_runner.dtype_derived_gradient_equivalence(
        baseline_gradient, changed_support_gradient
    )
    expected_rtol, expected_atol = gpu_runner.default_tolerances(torch.float32)

    positives = [
        {
            "name": "inactive_contract_valid",
            "passed": contract["status"] == "cpu_support_verified_inactive",
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
            "name": "same_per_sample_class_tensor_registered",
            "passed": contract["sourceContracts"]["perSampleClassTensorSource"].endswith(
                ".perSampleClassTensors"
            ) and tuple(per_sample_class.shape) == (2, 4),
        },
        {
            "name": "derived_weights_and_rollout_weight_exact",
            "passed": torch.equal(
                weighted,
                per_sample_class * (
                    per_sample_class.new_tensor([
                        contract["sourceContracts"]["derivedClassWeights"][identity]
                        for identity in identities
                    ]) * contract["sourceContracts"]["rolloutWeight"]
                ).unsqueeze(0),
            ),
        },
        {
            "name": "worst_sample_class_selection_exact",
            "passed": (
                candidate["sampleIndex"] == expected_sample_index
                and candidate["classIndex"] == expected_object_class_index + 1
                and candidate["classIdentity"] == identities[expected_object_class_index]
            ),
        },
        {
            "name": "selection_tie_break_exact",
            "passed": (
                tie_candidate["sampleIndex"] == 1
                and tie_candidate["classIndex"] == 3
                and tie_candidate["classIdentity"] == "rock"
            ),
        },
        {
            "name": "replay_reuses_same_tensor_without_extra_pass_or_step",
            "passed": (
                contract["replay"]["addsReplayPasses"] is False
                and contract["replay"]["addsOptimizerSteps"] is False
                and "stage4_epoch_worst_reference_feature_replay_loss_from_tensor" in trainer_text
            ),
        },
        {
            "name": "all_replay_gradients_finite_nonzero_inside",
            "passed": all(
                item["finite"] and item["insideMaskAbsSum"] > 0.0
                for item in gradient_evidence.values()
            ),
        },
        {
            "name": "all_replay_gradients_zero_outside_and_cross_sources_isolated",
            "passed": all(
                item["outsideMaskAbsSum"] == 0.0
                and item["sourceIsolation"]["contractId"]
                == "stage4_reference_feature_source_isolation_causal_boundary_v1"
                and item["sourceIsolation"]["ownPerSampleClassTensorIdentical"]
                and item["sourceIsolation"]["ownReplayLossIdentical"]
                and item["sourceIsolation"]["ownSelectionIdentityIdentical"]
                and item["sourceIsolation"]["ownDecodedRgbGradientEquivalent"]
                and item["sourceIsolation"]["decodedRgbGradientEquivalence"]["finite"]
                and item["sourceIsolation"]["decodedRgbGradientEquivalence"]["nonzeroSupportIdentical"]
                and item["sourceIsolation"]["independentFullParameterGradientIdentityComparisonExecuted"] is False
                for item in gradient_evidence.values()
            ),
        },
        {
            "name": "overlapping_semantic_masks_exercised",
            "passed": all(
                conditions[
                    :, order.index(f"object_{identity}"):
                    order.index(f"object_{identity}") + 1
                ][conditions[
                    :, order.index("object_footprints"):
                    order.index("object_footprints") + 1
                ] > 0].sum() > 0
                for identity in identities[1:]
            ),
        },
        {
            "name": "pytorch_dtype_derived_gradient_equivalence_accepted",
            "passed": (
                dtype_close_evidence["equivalent"]
                and dtype_close_evidence["dtype"] == "torch.float32"
                and dtype_close_evidence["rtol"] == float(expected_rtol)
                and dtype_close_evidence["atol"] == float(expected_atol)
                and dtype_close_evidence["finite"]
                and dtype_close_evidence["nonzeroSupportIdentical"]
                and dtype_close_evidence["maxAbsoluteDifference"] > 0.0
                and dtype_close_evidence["maxRelativeDifference"] > 0.0
            ),
        },
        {
            "name": "outside_dtype_tolerance_and_support_change_rejected",
            "passed": (
                not outside_tolerance_evidence["equivalent"]
                and not changed_support_evidence["equivalent"]
                and changed_support_evidence["nonzeroSupportIdentical"] is False
            ),
        },
        {
            "name": "runner_compares_source_isolation_at_decoded_rgb_causal_boundary",
            "passed": (
                runner_text.count("(decoded_rgb,),") >= 2
                and '"decodedRgbGradientEquivalence"' in runner_text
                and '"selectedReplayDecodedRgbGradientEquivalence"' in runner_text
                and "stage4_reference_feature_source_isolation_causal_boundary_v1"
                in runner_text
            ),
        },
        {
            "name": "runner_retains_one_canonical_parameter_gradient_route",
            "passed": (
                '"canonicalParameterGradientRouteFinite"' in runner_text
                and '"canonicalParameterGradientRouteAbsSum"' in runner_text
                and '"independentFullParameterGradientIdentityComparisonExecuted": False'
                in runner_text
                and "alternate_decoded_rgb_gradients = torch.autograd.grad(" in runner_text
                and "alternate_selected_decoded_rgb_gradients = torch.autograd.grad("
                in runner_text
            ),
        },
        {
            "name": "runner_uses_only_pytorch_dtype_derived_equivalence",
            "passed": (
                "default_tolerances(left.dtype" in runner_text
                and "torch.testing.assert_close" in runner_text
                and "freeTolerance" not in runner_text
            ),
        },
        {
            "name": "runner_requires_new_causal_boundary_cpu_lineage",
            "passed": (
                "stage4_reference_feature_source_isolation_causal_boundary_"
                in runner_text
                and "cpu_support_authorization_atomically_consumed"
                in runner_text
                and "equivalence_correction_authorization_atomically_consumed"
                not in runner_text
            ),
        },
        {
            "name": "autoencoder_state_unchanged",
            "passed": all(
                torch.equal(autoencoder_before[name], autoencoder.state_dict()[name])
                for name in autoencoder_before
            ),
        },
        {
            "name": "main_loss_and_epoch_replay_wiring_present",
            "passed": (
                'reference_feature_structure["weightedTotalTensor"]' in trainer_text
                and "stage4_epoch_worst_reference_feature_candidate" in trainer_text
                and "stage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss" in trainer_text
            ),
        },
        {
            "name": "legacy_without_new_contract_preserved",
            "passed": (
                trainer.validate_stage4_epoch_worst_sample_class_reference_feature_structure_replay(
                    source
                ) is None
                and trainer.validate_stage4_epoch_worst_sample_class_replay(source) is not None
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
    tensor_source = deepcopy(config)
    tensor_source["training"][CONTRACT_KEY]["sourceContracts"]["perSampleClassTensorSource"] = "other"
    mutations.append(("tensor_source_changed", tensor_source))
    class_weight = deepcopy(config)
    class_weight["training"][CONTRACT_KEY]["sourceContracts"]["derivedClassWeights"]["tree"] += 0.01
    mutations.append(("free_class_weight", class_weight))
    rollout_weight = deepcopy(config)
    rollout_weight["training"][CONTRACT_KEY]["sourceContracts"]["rolloutWeight"] += 0.01
    mutations.append(("free_rollout_weight", rollout_weight))
    extra_pass = deepcopy(config)
    extra_pass["training"][CONTRACT_KEY]["replay"]["addsReplayPasses"] = True
    mutations.append(("extra_replay_pass", extra_pass))
    optimizer_step = deepcopy(config)
    optimizer_step["training"][CONTRACT_KEY]["replay"]["addsOptimizerSteps"] = True
    mutations.append(("extra_optimizer_step", optimizer_step))
    wrong_reference = deepcopy(config)
    wrong_reference["training"][CONTRACT_KEY]["legalSupervision"]["reference"] = "failed_preview"
    mutations.append(("wrong_reference_source", wrong_reference))
    cross_class = deepcopy(config)
    cross_class["training"][CONTRACT_KEY]["legalSupervision"]["maskChannels"][1] = "object_rock"
    mutations.append(("cross_class_mask", cross_class))
    failed_preview = deepcopy(config)
    failed_preview["training"][CONTRACT_KEY]["legalSupervision"]["failedPreviewPixelsUsedAsTargets"] = True
    mutations.append(("failed_preview_target", failed_preview))
    review_result = deepcopy(config)
    review_result["training"][CONTRACT_KEY]["legalSupervision"]["machineReviewResultsUsedAsTargets"] = True
    mutations.append(("review_result_target", review_result))
    validation_target = deepcopy(config)
    validation_target["training"][CONTRACT_KEY]["legalSupervision"]["validationSamplesUsedAsTrainingTargets"] = True
    mutations.append(("validation_target", validation_target))
    gate = deepcopy(config)
    gate["training"][CONTRACT_KEY]["activationGate"]["gpuUseNow"] = True
    mutations.append(("inactive_gpu_gate", gate))
    evidence = deepcopy(config)
    evidence["training"][CONTRACT_KEY]["evidenceBindings"]["causalAdjudication"]["sha256"] = "0" * 64
    mutations.append(("evidence_identity_changed", evidence))
    authorization = deepcopy(config)
    authorization["training"][CONTRACT_KEY]["ownerImplementationAuthorization"]["authorizationSha256"] = "0" * 64
    mutations.append(("authorization_identity_changed", authorization))
    negatives = [expect_rejected(name, mutated) for name, mutated in mutations]

    tensor_negatives = []
    for name, value, sample_ids_value in (
        ("invalid_rank", torch.ones(4), ["sample-a"]),
        ("invalid_class_count", torch.ones(1, 5), ["sample-a"]),
        ("non_finite", torch.tensor([[1.0, 2.0, float("nan"), 4.0]]), ["sample-a"]),
    ):
        try:
            trainer.stage4_epoch_worst_reference_feature_candidate(
                value, sample_ids_value, config
            )
        except (TypeError, ValueError):
            tensor_negatives.append({"name": name, "passed": True})
        else:
            tensor_negatives.append({"name": name, "passed": False})
    try:
        trainer.stage4_epoch_worst_reference_feature_candidate(
            torch.ones(2, 4), ["duplicate", "duplicate"], config
        )
    except ValueError:
        tensor_negatives.append({"name": "duplicate_sample_id", "passed": True})
    else:
        tensor_negatives.append({"name": "duplicate_sample_id", "passed": False})
    try:
        trainer.stage4_epoch_worst_reference_feature_replay_loss_from_tensor(
            torch.ones(1, 4), config, 0
        )
    except ValueError:
        tensor_negatives.append({"name": "route_class_rejected", "passed": True})
    else:
        tensor_negatives.append({"name": "route_class_rejected", "passed": False})
    negatives.extend(tensor_negatives)

    positive_passed = sum(bool(item["passed"]) for item in positives)
    negative_passed = sum(bool(item["passed"]) for item in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    status = (
        "passed_stage4_epoch_worst_reference_feature_replay_cpu_contract"
        if passed
        else "failed_stage4_epoch_worst_reference_feature_replay_cpu_contract"
    )
    report = {
        "status": status,
        "positivePassed": positive_passed,
        "positiveTotal": len(positives),
        "negativePassed": negative_passed,
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "selectionEvidence": candidate,
        "tieBreakEvidence": tie_candidate,
        "gradientEvidence": gradient_evidence,
        "safety": {
            "checkpointWeightsRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "gpuUsed": False,
            "trainingStarted": False,
        },
        "config": {"path": project_path(config_path), "sha256": args.config_sha256},
        "source": {"path": project_path(source_path), "sha256": args.source_sha256},
    }
    audit = {
        "status": "passed_configuration_audit" if passed else "failed_configuration_audit",
        "contractId": contract["contractId"],
        "exactFields": list(contract),
        "classIdentities": list(identities),
        "derivedClassWeights": contract["sourceContracts"]["derivedClassWeights"],
        "rolloutWeight": contract["sourceContracts"]["rolloutWeight"],
        "allActivationGatesFalse": all(
            value is False for value in contract["activationGate"].values()
        ),
        "sourceConfigPreserved": positives[1]["passed"],
        "trainerAstValid": isinstance(trainer_ast, ast.Module),
        "checkerAstValid": isinstance(checker_ast, ast.Module),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
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

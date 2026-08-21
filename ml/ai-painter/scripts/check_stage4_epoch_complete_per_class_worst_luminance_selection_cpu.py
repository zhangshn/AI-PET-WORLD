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
CONTRACT_KEY = (
    "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity"
)


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
        trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(
            config
        )
    except (KeyError, TypeError, ValueError) as error:
        return {"name": name, "passed": True, "error": str(error)}
    return {"name": name, "passed": False, "error": "mutation accepted"}


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
        raise ValueError("epoch-complete selection CPU output exists")
    if sha256_file(config_path) != args.config_sha256:
        raise ValueError("epoch-complete selection config changed")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("epoch-complete selection source changed")
    config = read_json(config_path)
    source = read_json(source_path)
    contract = (
        trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(
            config
        )
    )
    identities = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])
    weights = contract["sourceContracts"]["derivedClassWeights"]
    rollout_weight = float(contract["sourceContracts"]["rolloutWeight"])

    train_tensor = torch.zeros(48, 4, dtype=torch.float64)
    train_ids = [f"train-{index:02d}" for index in range(48)]
    expected_rows = [7, 19, 31, 43]
    for class_index, row_index in enumerate(expected_rows):
        train_tensor[row_index, class_index] = 10.0 + class_index
    train_tensor[8, 0] = train_tensor[7, 0]
    train_ids[7], train_ids[8] = "train-a", "train-z"
    train_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
        config, "train", 48,
    )
    for index in range(0, 48, 3):
        trainer.stage4_collect_epoch_complete_per_class_selection_scores(
            train_ledger,
            train_tensor[index:index + 3],
            train_ids[index:index + 3],
            config,
        )
    train_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
        train_ledger, config,
    )

    seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
    validation_count = 8 * seed_count
    validation_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
        config, "validation", validation_count,
    )
    validation_tensor = torch.arange(
        validation_count * 4, dtype=torch.float64,
    ).reshape(validation_count, 4).div(100.0)
    validation_ids = [
        f"validation-{index // seed_count:02d}" for index in range(validation_count)
    ]
    validation_seeds = [index % seed_count for index in range(validation_count)]
    trainer.stage4_collect_epoch_complete_per_class_selection_scores(
        validation_ledger, validation_tensor, validation_ids, config,
        seed_indices=validation_seeds,
    )
    validation_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
        validation_ledger, config,
    )

    replay_schedule = [
        trainer.stage4_epoch_complete_per_class_replay_selection(
            train_result, batch_index, replay_index, config,
        )["classIdentity"]
        for batch_index in range(2)
        for replay_index in range(2)
    ]

    height, width = 24, 32
    predicted = torch.linspace(
        0.01, 0.99, 3 * height * width, dtype=torch.float32,
    ).reshape(1, 3, height, width).clone().requires_grad_(True)
    target = torch.flip(predicted.detach(), dims=(-1,)).clone()
    conditions = torch.zeros(
        1, len(config["conditionChannelOrder"]), height, width,
        dtype=torch.float32,
    )
    regions = {
        "footprints": (slice(1, 6), slice(1, 8)),
        "tree": (slice(7, 12), slice(9, 16)),
        "rock": (slice(13, 18), slice(17, 24)),
        "vegetation": (slice(19, 23), slice(25, 31)),
    }
    order = list(config["conditionChannelOrder"])
    for identity, (ys, xs) in regions.items():
        conditions[:, order.index(f"object_{identity}"), ys, xs] = 1.0
    source_losses = (
        trainer.stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses(
            predicted, target, conditions, config,
        )
    )
    gradient_evidence = {}
    for identity in identities:
        selected_loss = (
            trainer.stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(
                source_losses["weightedPerSampleClassTensors"], identity, config,
            )
        )
        gradient = torch.autograd.grad(
            selected_loss, predicted, retain_graph=True,
        )[0]
        ys, xs = regions[identity]
        mask = torch.zeros_like(gradient)
        mask[:, :, ys, xs] = 1.0
        gradient_evidence[identity] = {
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
    expected_train_ids = [train_ids[index] for index in expected_rows]
    positives = [
        {"name": "inactive_contract_valid_all_gates_closed", "passed": contract["status"] == "cpu_support_verified_inactive" and not any(contract["activationGate"].values())},
        {"name": "source_preserved_except_new_contract", "passed": source_preserved},
        {"name": "complete_48_train_records_required", "passed": train_result["identityCount"] == 48},
        {"name": "four_classes_selected_independently", "passed": [row["classIdentity"] for row in train_result["perClassSelections"]] == identities},
        {"name": "deterministic_lexicographic_tie_break", "passed": [row["sampleId"] for row in train_result["perClassSelections"]] == expected_train_ids},
        {"name": "score_ledger_is_detached_identity_only", "passed": all(set(row) == {"sampleId", "seedIndex", "scores"} and not any(isinstance(value, torch.Tensor) for value in row["scores"].values()) for row in train_ledger["entries"].values())},
        {"name": "existing_two_replay_passes_round_robin_four_classes", "passed": replay_schedule == identities and contract["sourceContracts"]["replayPassesPerObservedPrimaryBatch"] == 2},
        {"name": "no_additional_optimizer_steps_or_weight", "passed": contract["trainingSelection"]["additionalOptimizerSteps"] == 0 and contract["trainingSelection"]["additionalLossWeight"] is False},
        {"name": "validation_covers_all_8_records_and_seeds", "passed": validation_result["identityCount"] == validation_count and {row["sampleId"] for row in validation_result["perClassSelections"]} <= set(validation_ids)},
        {"name": "validation_persists_exact_identity_fields", "passed": all(set(row) == {"classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore"} for row in validation_result["perClassSelections"])},
        {"name": "checkpoint_score_exact_weighted_sum", "passed": validation_result["checkpointQualificationScore"] == validation_result["weightedScoreSum"] * rollout_weight},
        {"name": "selected_replay_gradients_finite_nonzero_inside", "passed": all(row["finite"] and row["insideMaskAbsSum"] > 0.0 for row in gradient_evidence.values())},
        {"name": "selected_replay_gradients_strictly_zero_outside", "passed": all(row["outsideMaskAbsSum"] == 0.0 for row in gradient_evidence.values())},
        {"name": "trainer_replaces_batch_local_semantics_with_epoch_ledger", "passed": "epoch_complete_ledger" in trainer_text and "prior_epoch_complete_result" in trainer_text and "epoch_complete_selection_state" in trainer_text},
        {"name": "first_epoch_has_no_prior_selected_replay", "passed": contract["trainingSelection"]["firstEpochBehavior"] == "collect_identity_only_keep_existing_non_selected_primary_supervision"},
        {"name": "checkpoint_identity_registered_in_rollout_result", "passed": "rolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointSelections" in trainer_text and "validationCheckpointSelectionScore" in trainer_text},
        {"name": "existing_derived_weights_reused", "passed": weights == source["training"]["stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"]["sourceContracts"]["derivedClassWeights"]},
        {"name": "legacy_source_without_contract_preserved", "passed": trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(source) is None},
        {"name": "checker_forbidden_runtime_actions_absent", "passed": not any(name == "torch.load" or name.endswith(".backward") or name.startswith("torch.optim.") or name.endswith(".cuda") for name in calls)},
    ]

    mutations = []
    def mutate(name, action):
        value = deepcopy(config)
        action(value["training"][CONTRACT_KEY])
        mutations.append((name, value))
    mutate("missing_field", lambda c: c.pop("trainingSelection"))
    mutate("unknown_field", lambda c: c.update({"unknown": True}))
    mutate("class_order_changed", lambda c: c["trainingSelection"]["classIdentities"].reverse())
    mutate("population_changed", lambda c: c["trainingSelection"].update({"population": "current_batch"}))
    mutate("score_graph_retained", lambda c: c["trainingSelection"].update({"scoreCollection": "retain_graph"}))
    mutate("tie_break_changed", lambda c: c["trainingSelection"].update({"selection": "first_seen"}))
    mutate("batch_local_maximum_restored", lambda c: c["trainingSelection"].update({"replacesBatchLocalMaximum": False}))
    mutate("extra_optimizer_step", lambda c: c["trainingSelection"].update({"additionalOptimizerSteps": 1}))
    mutate("free_weight", lambda c: c["trainingSelection"].update({"additionalLossWeight": True}))
    mutate("replay_pass_count_changed", lambda c: c["sourceContracts"].update({"replayPassesPerObservedPrimaryBatch": 3}))
    mutate("class_weight_changed", lambda c: c["sourceContracts"]["derivedClassWeights"].update({"tree": 99.0}))
    mutate("rollout_weight_changed", lambda c: c["sourceContracts"].update({"rolloutWeight": 99.0}))
    mutate("validation_population_changed", lambda c: c["checkpointQualification"].update({"population": "one_sample"}))
    mutate("validation_fields_changed", lambda c: c["checkpointQualification"]["requiredPersistedFields"].reverse())
    mutate("wrong_reference", lambda c: c["legalSupervision"].update({"reference": "failed_preview"}))
    mutate("review_result_target", lambda c: c["legalSupervision"].update({"machineReviewResultsUsedAsTargets": True}))
    mutate("cross_class_mask", lambda c: c["legalSupervision"]["maskChannels"].__setitem__(1, "object_rock"))
    mutate("checkpoint_format_changed", lambda c: c["compatibility"].update({"checkpointFormatChanged": True}))
    mutate("gpu_gate_open", lambda c: c["activationGate"].update({"gpuUseNow": True}))
    mutate("evidence_changed", lambda c: c["evidenceBindings"]["causalDecision"].update({"sha256": "0" * 64}))
    mutate("authorization_changed", lambda c: c["ownerImplementationAuthorization"].update({"authorizationSha256": "0" * 64}))
    negatives = [rejected(name, value) for name, value in mutations]

    def functional_rejection(name, action):
        try:
            action()
        except (KeyError, TypeError, ValueError):
            negatives.append({"name": name, "passed": True})
        else:
            negatives.append({"name": name, "passed": False})

    functional_rejection(
        "incomplete_train_population",
        lambda: trainer.stage4_finalize_epoch_complete_per_class_selection(
            trainer.stage4_epoch_complete_per_class_selection_ledger(config, "train", 48),
            config,
        ),
    )
    duplicate_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
        config, "train", 48,
    )
    trainer.stage4_collect_epoch_complete_per_class_selection_scores(
        duplicate_ledger, torch.ones(1, 4), ["same"], config,
    )
    functional_rejection(
        "duplicate_identity",
        lambda: trainer.stage4_collect_epoch_complete_per_class_selection_scores(
            duplicate_ledger, torch.ones(1, 4), ["same"], config,
        ),
    )
    functional_rejection(
        "wrong_train_count",
        lambda: trainer.stage4_epoch_complete_per_class_selection_ledger(
            config, "train", 47,
        ),
    )
    functional_rejection(
        "validation_seed_missing",
        lambda: trainer.stage4_collect_epoch_complete_per_class_selection_scores(
            trainer.stage4_epoch_complete_per_class_selection_ledger(
                config, "validation", 8,
            ),
            torch.ones(1, 4), ["validation-a"], config,
        ),
    )
    functional_rejection(
        "finalized_ledger_reuse",
        lambda: trainer.stage4_collect_epoch_complete_per_class_selection_scores(
            train_ledger, torch.ones(1, 4), ["late"], config,
        ),
    )
    functional_rejection(
        "unknown_selected_class",
        lambda: trainer.stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(
            torch.ones(1, 4), "route", config,
        ),
    )

    positive_passed = sum(bool(row["passed"]) for row in positives)
    negative_passed = sum(bool(row["passed"]) for row in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    status = (
        "passed_stage4_epoch_complete_per_class_worst_luminance_cpu_contract"
        if passed else
        "failed_stage4_epoch_complete_per_class_worst_luminance_cpu_contract"
    )
    report = {
        "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-cpu-report-v1",
        "status": status,
        "positivePassed": positive_passed,
        "positiveTotal": len(positives),
        "negativePassed": negative_passed,
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "trainSelections": train_result["perClassSelections"],
        "validationSelections": validation_result["perClassSelections"],
        "replaySchedule": replay_schedule,
        "gradientEvidence": gradient_evidence,
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
        "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-config-audit-v1",
        "status": "passed_configuration_audit" if passed else "failed_configuration_audit",
        "contractId": contract["contractId"],
        "trainIdentityCount": train_result["identityCount"],
        "validationIdentityCount": validation_result["identityCount"],
        "classIdentities": identities,
        "derivedClassWeights": weights,
        "rolloutWeight": rollout_weight,
        "existingReplayPasses": contract["sourceContracts"]["replayPassesPerObservedPrimaryBatch"],
        "additionalOptimizerSteps": contract["trainingSelection"]["additionalOptimizerSteps"],
        "allActivationGatesFalse": not any(contract["activationGate"].values()),
        "sourceConfigPreserved": source_preserved,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    audit_path.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
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

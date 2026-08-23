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
CONTRACT_KEY = "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"


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


class SyntheticFrozenAutoencoder(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = torch.nn.Sequential(
            torch.nn.Conv2d(3, 4, 3, padding=1, bias=False), torch.nn.SiLU(),
            torch.nn.Conv2d(4, 6, 4, stride=2, padding=1, bias=False), torch.nn.SiLU(),
            torch.nn.Conv2d(6, 8, 4, stride=2, padding=1, bias=False), torch.nn.SiLU(),
        )
        generator = torch.Generator().manual_seed(20263722)
        with torch.no_grad():
            for parameter in self.parameters():
                parameter.copy_(torch.rand(parameter.shape, generator=generator) * 0.08 - 0.04)
        self.requires_grad_(False)


def rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(config)
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
        raise ValueError("reference-feature shared replay CPU output exists")
    if sha256_file(config_path) != args.config_sha256 or sha256_file(source_path) != args.source_sha256:
        raise ValueError("reference-feature shared replay input identity changed")
    config = read_json(config_path)
    source = read_json(source_path)
    contract = trainer.validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(config)
    identities = list(trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_IDENTITIES[1:])

    train_ids = [f"train-{index:02d}" for index in range(48)]
    train_tensor = torch.zeros(48, 4, dtype=torch.float64)
    expected_indices = [5, 17, 29, 41]
    for class_index, row_index in enumerate(expected_indices):
        train_tensor[row_index, class_index] = 20.0 + class_index
    train_tensor[6, 0] = train_tensor[5, 0]
    train_ids[5], train_ids[6] = "train-a", "train-z"
    ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
        config, "train", 48, "reference_feature_structure",
    )
    for index in range(0, 48, 4):
        trainer.stage4_collect_epoch_complete_per_class_selection_scores(
            ledger, train_tensor[index:index + 4], train_ids[index:index + 4], config,
            objective_identity="reference_feature_structure",
        )
    train_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
        ledger, config, "reference_feature_structure",
    )

    luminance_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
        config, "train", 48, "luminance",
    )
    trainer.stage4_collect_epoch_complete_per_class_selection_scores(
        luminance_ledger, train_tensor, train_ids, config,
        objective_identity="luminance",
    )
    luminance_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
        luminance_ledger, config, "luminance",
    )
    epoch1_selection = (
        trainer.stage4_epoch_complete_shared_replay_selection_for_epoch(
            None, None, None, 0, 0, 0, config,
        )
    )
    epoch2_selection = (
        trainer.stage4_epoch_complete_shared_replay_selection_for_epoch(
            luminance_result, train_result, 1, 1, 48, 0, config,
        )
    )
    replay_schedule = [
        trainer.stage4_epoch_complete_shared_replay_selection(
            luminance_result, train_result, batch_index, replay_index, config,
        )
        for batch_index in range(4) for replay_index in range(2)
    ]

    seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
    validation_count = 8 * seed_count
    validation_ledger = trainer.stage4_epoch_complete_per_class_selection_ledger(
        config, "validation", validation_count, "reference_feature_structure",
    )
    validation_tensor = torch.arange(validation_count * 4, dtype=torch.float64).reshape(validation_count, 4) / 100.0
    validation_ids = [f"validation-{index // seed_count:02d}" for index in range(validation_count)]
    validation_seeds = [index % seed_count for index in range(validation_count)]
    trainer.stage4_collect_epoch_complete_per_class_selection_scores(
        validation_ledger, validation_tensor, validation_ids, config,
        seed_indices=validation_seeds, objective_identity="reference_feature_structure",
    )
    validation_result = trainer.stage4_finalize_epoch_complete_per_class_selection(
        validation_ledger, config, "reference_feature_structure",
    )

    height, width = 48, 64
    predicted = torch.linspace(0.04, 0.96, 4 * 3 * height * width).reshape(4, 3, height, width).requires_grad_(True)
    target = torch.flip(predicted.detach(), dims=(-1,)).clone()
    conditions = torch.zeros(4, len(config["conditionChannelOrder"]), height, width)
    regions = {
        "footprints": (slice(2, 12), slice(2, 14)),
        "tree": (slice(14, 24), slice(16, 28)),
        "rock": (slice(26, 36), slice(30, 42)),
        "vegetation": (slice(38, 46), slice(46, 62)),
    }
    order = list(config["conditionChannelOrder"])
    for identity, (ys, xs) in regions.items():
        conditions[:, order.index(f"object_{identity}"), ys, xs] = 1.0
    feature = trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses(
        SyntheticFrozenAutoencoder(), predicted, target, conditions, config,
    )
    gradient_evidence = {}
    for class_index, identity in enumerate(identities):
        selected = trainer.stage4_epoch_complete_selected_reference_feature_replay_loss_from_tensor(
            feature["perSampleClassTensors"][class_index:class_index + 1], identity, config,
        )
        gradient = torch.autograd.grad(selected, predicted, retain_graph=True)[0]
        ys, xs = regions[identity]
        mask = torch.zeros_like(gradient)
        mask[class_index:class_index + 1, :, ys, xs] = 1.0
        gradient_evidence[identity] = {
            "finite": bool(torch.isfinite(gradient).all()),
            "insideMaskAbsSum": float((gradient.abs() * mask).sum()),
            "outsideMaskAbsSum": float((gradient.abs() * (1.0 - mask)).sum()),
        }

    source_preserved = (
        {key: value for key, value in config["training"].items() if key != CONTRACT_KEY} == source["training"]
        and {key: value for key, value in config.items() if key != "training"} == {key: value for key, value in source.items() if key != "training"}
    )
    expected_schedule = [
        (identity, objective)
        for identity in identities
        for objective in ("luminance", "reference_feature_structure")
    ]
    positives = [
        {"name": "inactive_contract_all_gates_closed", "passed": contract["status"] == "cpu_support_verified_inactive" and not any(contract["activationGate"].values())},
        {"name": "source_preserved_except_new_contract", "passed": source_preserved},
        {"name": "complete_48_train_records", "passed": train_result["identityCount"] == 48},
        {"name": "four_classes_selected_independently", "passed": [row["classIdentity"] for row in train_result["perClassSelections"]] == identities},
        {"name": "lexicographic_tie_break", "passed": train_result["perClassSelections"][0]["sampleId"] == "train-a"},
        {"name": "detached_score_identity_only", "passed": all(not any(isinstance(v, torch.Tensor) for score in row["scores"].values() for v in score.values()) for row in ledger["entries"].values())},
        {"name": "shared_two_pass_round_robin", "passed": [(row["classIdentity"], row["objectiveIdentity"]) for row in replay_schedule] == expected_schedule},
        {"name": "epoch1_collects_without_shared_replay", "passed": epoch1_selection is None},
        {"name": "epoch2_uses_both_complete_epoch1_identities", "passed": epoch2_selection["sampleId"] in train_ids and epoch2_selection["objectiveIdentity"] in {"luminance", "reference_feature_structure"}},
        {"name": "epoch1_finalizes_both_48_record_identities", "passed": luminance_result["identityCount"] == 48 and train_result["identityCount"] == 48},
        {"name": "no_extra_replay_or_optimizer_steps", "passed": contract["sourceContracts"]["replayPassesPerObservedPrimaryBatch"] == 2 and contract["sharedReplay"]["addsReplayPasses"] is False and contract["sharedReplay"]["addsOptimizerSteps"] is False},
        {"name": "validation_covers_8_records_and_seeds", "passed": validation_result["identityCount"] == validation_count},
        {"name": "validation_exact_identity_fields", "passed": all(set(row) == {"classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore"} for row in validation_result["perClassSelections"])},
        {"name": "checkpoint_score_uses_existing_rollout_weight", "passed": validation_result["checkpointQualificationScore"] == validation_result["weightedScoreSum"] * float(contract["sourceContracts"]["rolloutWeight"])},
        {"name": "mask_inside_gradients_finite_nonzero", "passed": all(row["finite"] and row["insideMaskAbsSum"] > 0.0 for row in gradient_evidence.values())},
        {"name": "mask_outside_gradients_zero", "passed": all(row["outsideMaskAbsSum"] == 0.0 for row in gradient_evidence.values())},
        {"name": "old_luminance_selector_compatible", "passed": trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(config) is not None},
        {"name": "old_source_without_new_contract_compatible", "passed": trainer.validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(source) is None},
    ]

    mutations = []
    def mutate(name, action):
        value = deepcopy(config)
        action(value["training"][CONTRACT_KEY])
        mutations.append((name, value))
    mutate("missing_field", lambda c: c.pop("epochSelection"))
    mutate("unknown_field", lambda c: c.update({"unknown": True}))
    mutate("class_order", lambda c: c["epochSelection"]["classIdentities"].reverse())
    mutate("wrong_population", lambda c: c["epochSelection"].update({"population": "current_batch"}))
    mutate("cross_epoch_state", lambda c: c["epochSelection"].update({"scoreCollection": "retain_prior_epoch"}))
    mutate("extra_replay", lambda c: c["sharedReplay"].update({"addsReplayPasses": True}))
    mutate("extra_step", lambda c: c["sharedReplay"].update({"addsOptimizerSteps": True}))
    mutate("objective_order", lambda c: c["sharedReplay"]["objectiveOrder"].reverse())
    mutate("free_weight", lambda c: c["sourceContracts"].update({"freeNumericalWeightSelectionAllowed": True}))
    mutate("wrong_split", lambda c: c["checkpointQualification"].update({"population": "challenge"}))
    mutate("failed_preview", lambda c: c["legalSupervision"].update({"reference": "failed_preview"}))
    mutate("review_target", lambda c: c["legalSupervision"].update({"machineReviewResultsUsedAsTargets": True}))
    mutate("cross_class", lambda c: c["legalSupervision"]["maskChannels"].__setitem__(0, "object_tree"))
    mutate("weight_changed", lambda c: c["sourceContracts"]["derivedClassWeights"].update({"tree": 99.0}))
    mutate("gate_open", lambda c: c["activationGate"].update({"gpuUseNow": True}))
    mutate("evidence_changed", lambda c: c["evidenceBindings"]["decision"].update({"sha256": "0" * 64}))
    negatives = [rejected(name, value) for name, value in mutations]

    def functional_rejection(name, action):
        try: action()
        except (KeyError, TypeError, ValueError): negatives.append({"name": name, "passed": True})
        else: negatives.append({"name": name, "passed": False})
    functional_rejection("incomplete_train", lambda: trainer.stage4_finalize_epoch_complete_per_class_selection(trainer.stage4_epoch_complete_per_class_selection_ledger(config, "train", 48, "reference_feature_structure"), config, "reference_feature_structure"))
    functional_rejection("objective_mismatch", lambda: trainer.stage4_collect_epoch_complete_per_class_selection_scores(trainer.stage4_epoch_complete_per_class_selection_ledger(config, "train", 48, "reference_feature_structure"), torch.ones(1, 4), ["a"], config, objective_identity="luminance"))
    functional_rejection("unknown_objective", lambda: trainer.stage4_epoch_complete_per_class_selection_ledger(config, "train", 48, "unknown"))
    functional_rejection("missing_prior_objective", lambda: trainer.stage4_epoch_complete_shared_replay_selection(luminance_result, None, 0, 1, config))
    functional_rejection("premature_epoch1_shared_replay", lambda: trainer.stage4_epoch_complete_shared_replay_selection(None, None, 0, 0, config))
    functional_rejection("cross_epoch_identity_pollution", lambda: trainer.stage4_epoch_complete_shared_replay_selection_for_epoch(luminance_result, train_result, 2, 1, 48, 0, config))
    wrong_class_result = deepcopy(train_result)
    wrong_class_result["perClassSelections"][0]["classIdentity"] = "tree"
    functional_rejection("cross_class_selection_identity", lambda: trainer.stage4_epoch_complete_shared_replay_selection_for_epoch(luminance_result, wrong_class_result, 1, 1, 48, 1, config))

    positive_passed = sum(bool(row["passed"]) for row in positives)
    negative_passed = sum(bool(row["passed"]) for row in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    report = {
        "schemaVersion": "stage4-reference-feature-shared-replay-cpu-report-v1",
        "status": "passed_stage4_reference_feature_shared_replay_cpu_contract" if passed else "failed_stage4_reference_feature_shared_replay_cpu_contract",
        "positivePassed": positive_passed, "positiveTotal": len(positives),
        "negativePassed": negative_passed, "negativeTotal": len(negatives),
        "positives": positives, "negatives": negatives,
        "trainSelections": train_result["perClassSelections"],
        "validationSelections": validation_result["perClassSelections"],
        "sharedReplaySchedule": replay_schedule,
        "epochLifecycleEvidence": {
            "epoch1SharedReplaySelection": epoch1_selection,
            "epoch1LuminanceIdentityCount": luminance_result["identityCount"],
            "epoch1ReferenceFeatureIdentityCount": train_result["identityCount"],
            "epoch2FirstSharedReplaySelection": epoch2_selection,
        },
        "gradientEvidence": gradient_evidence,
        "safety": {"checkpointRead": False, "optimizerCreated": False, "backwardExecuted": False, "gpuUsed": False, "trainingStarted": False},
    }
    audit = {
        "schemaVersion": "stage4-reference-feature-shared-replay-config-audit-v1",
        "status": "passed_configuration_audit" if passed else "failed_configuration_audit",
        "trainIdentityCount": train_result["identityCount"],
        "validationIdentityCount": validation_result["identityCount"],
        "classIdentities": identities,
        "objectiveOrder": contract["sharedReplay"]["objectiveOrder"],
        "existingReplayPasses": contract["sourceContracts"]["replayPassesPerObservedPrimaryBatch"],
        "sourceConfigPreserved": source_preserved,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "path": project_path(output_path), "sha256": sha256_file(output_path), "auditPath": project_path(audit_path), "auditSha256": sha256_file(audit_path), "positive": f"{positive_passed}/{len(positives)}", "negative": f"{negative_passed}/{len(negatives)}"}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

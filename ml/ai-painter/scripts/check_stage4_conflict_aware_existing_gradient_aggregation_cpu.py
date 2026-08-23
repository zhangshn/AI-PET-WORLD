from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
import math
from pathlib import Path
import sys

import torch

import train_ai_assisted_conditional_denoiser as trainer


CLASSES = ("footprints", "tree", "rock", "vegetation")


def main() -> int:
    parser = ArgumentParser(); parser.add_argument("--config", type=Path, required=True); args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    contract = trainer.validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    weights = contract["derivedClassWeights"]
    positive = []
    negative = []
    def pos(name, condition): positive.append({"name": name, "passed": bool(condition)})
    def reject(name, callback):
        passed = False
        try: callback()
        except (ValueError, KeyError, TypeError): passed = True
        negative.append({"name": name, "passed": passed})

    conflict = {
        "footprints": (torch.tensor([1.0, 0.0]),),
        "tree": (torch.tensor([-1.0, 1.0]),),
        "rock": (torch.tensor([0.0, 1.0]),),
        "vegetation": (torch.tensor([1.0, 1.0]),),
    }
    result = trainer.stage4_conflict_aware_existing_gradient_aggregation(conflict, config)
    pos("negative_dot_projection_occurs", any(item["projected"] for item in result["interactions"]))
    pos("formal_class_order", result["classOrder"] == list(CLASSES))
    pos("existing_weights_applied_exactly", all(torch.equal(result["originalWeightedGradients"][name][0], conflict[name][0] * float(weights[name])) for name in CLASSES))
    pos("aggregate_finite", all(torch.isfinite(value).all() for value in result["aggregatedSharedGradients"]))
    pos("optimizer_budget_unchanged", result["additionalOptimizerSteps"] == 0 and result["additionalReplayPasses"] == 0)
    pos("no_free_tolerance", result["freeNumericalToleranceUsed"] is False and contract["projection"]["numericTolerance"] is None)
    non_conflict = {"footprints": (torch.tensor([1.0, 0.0]),), "tree": (torch.tensor([0.0, 1.0]),), "rock": (torch.tensor([1.0, 1.0]),), "vegetation": (torch.tensor([2.0, 1.0]),)}
    unchanged = trainer.stage4_conflict_aware_existing_gradient_aggregation(non_conflict, config)
    pos("nonnegative_gradients_bitwise_unchanged", all(torch.equal(unchanged["originalWeightedGradients"][name][0], unchanged["projectedWeightedGradients"][name][0]) for name in CLASSES))
    pos("checkpoint_contract_unchanged", contract["checkpointQualification"] == {"lossValuesChanged": False, "validationMetricsChanged": False, "selectionContractChanged": False})
    pos("inactive_all_gates_false", not any(contract["activationGate"].values()))
    pos("old_config_without_contract_preserved", trainer.validate_stage4_conflict_aware_existing_gradient_aggregation({"training": {}}) is None)

    reject("missing_class", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation({key: value for key, value in conflict.items() if key != "tree"}, config))
    reject("class_reorder", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(dict(reversed(list(conflict.items()))), config))
    bad_shape = deepcopy(conflict); bad_shape["tree"] = (torch.ones(3),); reject("shape_change", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(bad_shape, config))
    nan_value = deepcopy(conflict); nan_value["tree"] = (torch.tensor([math.nan, 1.0]),); reject("nan", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(nan_value, config))
    inf_value = deepcopy(conflict); inf_value["tree"] = (torch.tensor([math.inf, 1.0]),); reject("inf", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(inf_value, config))
    zero_value = deepcopy(conflict); zero_value["tree"] = (torch.zeros(2),); reject("zero_gradient", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(zero_value, config))
    empty_value = deepcopy(conflict); empty_value["tree"] = (); reject("empty_parameter_group", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(empty_value, config))
    def mutate(field, value): changed = deepcopy(config); changed["training"]["stage4ConflictAwareExistingGradientAggregation"][field] = value; return lambda: trainer.validate_stage4_conflict_aware_existing_gradient_aggregation(changed)
    reject("free_tolerance", mutate("projection", {**contract["projection"], "numericTolerance": 1e-6}))
    reject("weight_change", mutate("derivedClassWeights", {**weights, "tree": weights["tree"] + 0.1}))
    reject("extra_optimizer_step", mutate("optimizerBudget", {**contract["optimizerBudget"], "additionalOptimizerSteps": 1}))
    reject("extra_replay", mutate("optimizerBudget", {**contract["optimizerBudget"], "additionalReplayPasses": 1}))
    reject("loss_change", mutate("sourceLossContract", {**contract["sourceLossContract"], "lossValuesChanged": True}))
    reject("data_change", mutate("compatibility", {**contract["compatibility"], "datasetOrSplitChanged": True}))
    reject("review_change", mutate("compatibility", {**contract["compatibility"], "reviewThresholdsChanged": True}))
    reject("preview_target", mutate("legalTargets", {**contract["legalTargets"], "failedPreviewPixelsUsedAsTargets": True}))
    reject("review_result_target", mutate("legalTargets", {**contract["legalTargets"], "machineReviewResultsUsedAsTargets": True}))
    reject("active_training_gate", mutate("activationGate", {**contract["activationGate"], "trainingNow": True}))
    reject("evidence_change", mutate("evidenceBindings", {**contract["evidenceBindings"], "diagnosticTerminal": {"path": "wrong", "sha256": "0" * 64}}))
    status = "passed" if all(item["passed"] for item in positive + negative) else "failed"
    report = {"schemaVersion": "stage4-conflict-aware-existing-gradient-aggregation-cpu-report-v1", "status": status, "positive": {"passed": sum(item["passed"] for item in positive), "total": len(positive), "cases": positive}, "negative": {"passed": sum(item["passed"] for item in negative), "total": len(negative), "cases": negative}, "checkpointRead": False, "gpuStarted": False, "optimizerCreated": False, "backwardExecuted": False, "trainingStarted": False}
    print(json.dumps(report, ensure_ascii=False, indent=2)); return 0 if status == "passed" else 1


if __name__ == "__main__": raise SystemExit(main())

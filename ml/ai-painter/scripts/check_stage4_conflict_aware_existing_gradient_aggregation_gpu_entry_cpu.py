from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import ast
import json
from pathlib import Path

import torch

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
CLASSES = ("footprints", "tree", "rock", "vegetation")


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--runner", type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(resolve(args.config).read_text(encoding="utf-8"))
    runner = resolve(args.runner)
    source = runner.read_text(encoding="utf-8")
    tree = ast.parse(source)
    calls = {node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, (ast.Attribute, ast.Name))}
    positives = []
    negatives = []
    pos = lambda name, passed: positives.append({"name": name, "passed": bool(passed)})
    def reject(name, operation):
        passed = False
        try:
            operation()
        except Exception:
            passed = True
        negatives.append({"name": name, "passed": passed})

    contract = trainer.validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    conflict = {
        "footprints": (torch.tensor([1.0, 0.0]),),
        "tree": (torch.tensor([-1.0, 1.0]),),
        "rock": (torch.tensor([0.0, 1.0]),),
        "vegetation": (torch.tensor([1.0, 1.0]),),
    }
    result = trainer.stage4_conflict_aware_existing_gradient_aggregation(conflict, config)
    pos("contract_identity", contract["contractId"] == "stage4_conflict_aware_existing_gradient_aggregation_v1")
    pos("formal_class_order", result["classOrder"] == list(CLASSES))
    pos("strict_negative_projection_covered", any(item["projected"] and item["dotProduct"] < 0 for item in result["interactions"]))
    pos("nonnegative_unchanged_branch_covered", any(not item["projected"] and item["dotProduct"] >= 0 for item in result["interactions"]))
    pos("aggregate_finite_nonzero", all(torch.isfinite(value).all() and value.abs().sum() > 0 for value in result["aggregatedSharedGradients"]))
    pos("execution_budget_unchanged", result["additionalOptimizerSteps"] == 0 and result["additionalReplayPasses"] == 0)
    pos("no_free_tolerance", result["freeNumericalToleranceUsed"] is False and contract["projection"]["numericTolerance"] is None)
    pos("runner_uses_autograd_grad", "grad" in calls and "stage4_conflict_aware_existing_gradient_aggregation" in source)
    pos("runner_no_optimizer_or_backward", "optimizer" not in calls and "backward" not in calls)
    pos("runner_full_population", '"train": 48' in source and '"validation": 8' in source and 'total": 56' in source)
    pos("runner_checks_state_unchanged", '"denoiserUnchanged"' in source and '"autoencoderUnchanged"' in source)
    pos("all_gates_inactive", not any(contract["activationGate"].values()))

    reject("missing_class", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation({key: value for key, value in conflict.items() if key != "rock"}, config))
    reject("reordered_class", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation(dict(reversed(list(conflict.items()))), config))
    reject("nan_gradient", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation({**conflict, "tree": (torch.tensor([float("nan"), 1.0]),)}, config))
    reject("inf_gradient", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation({**conflict, "tree": (torch.tensor([float("inf"), 1.0]),)}, config))
    reject("zero_gradient", lambda: trainer.stage4_conflict_aware_existing_gradient_aggregation({**conflict, "tree": (torch.zeros(2),)}, config))
    def changed(field, value):
        candidate = deepcopy(config)
        candidate["training"]["stage4ConflictAwareExistingGradientAggregation"][field] = value
        return lambda: trainer.validate_stage4_conflict_aware_existing_gradient_aggregation(candidate)
    reject("free_tolerance", changed("projection", {**contract["projection"], "numericTolerance": 1e-6}))
    reject("weight_change", changed("derivedClassWeights", {**contract["derivedClassWeights"], "tree": 1.0}))
    reject("optimizer_step_change", changed("optimizerBudget", {**contract["optimizerBudget"], "additionalOptimizerSteps": 1}))
    reject("replay_change", changed("optimizerBudget", {**contract["optimizerBudget"], "additionalReplayPasses": 1}))
    reject("checkpoint_change", changed("checkpointQualification", {**contract["checkpointQualification"], "selectionContractChanged": True}))
    reject("training_gate", changed("activationGate", {**contract["activationGate"], "trainingNow": True}))
    reject("class_order_change", changed("classOrder", list(reversed(CLASSES))))
    report = {
        "schemaVersion": "stage4-conflict-aware-gradient-aggregation-gpu-entry-cpu-report-v1",
        "status": "passed" if all(item["passed"] for item in positives + negatives) else "failed",
        "positive": {"passed": sum(item["passed"] for item in positives), "total": len(positives), "cases": positives},
        "negative": {"passed": sum(item["passed"] for item in negatives), "total": len(negatives), "cases": negatives},
        "checkpointRead": False,
        "gpuStarted": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "passed" else 1


def resolve(value: Path) -> Path:
    if value.is_absolute():
        result = value.resolve()
    else:
        result = (ROOT / value).resolve()
    runtime = (ROOT / ".runtime").resolve()
    if result != ROOT and ROOT not in result.parents and result != runtime and runtime not in result.parents:
        raise ValueError("project_path_required")
    return result


if __name__ == "__main__":
    raise SystemExit(main())

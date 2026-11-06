"""Frozen150 wind-transform-only repair; shared149 guarded evaluation helpers."""

import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import time

CONTRACT_SHA256 = "4deee0b437d014da9afdfdf420dff0f5fcdeb747cfaf5c166bb4f5741dbff721"
STABILITY_SHA256 = "a0f9d12e07eca5b7d9c2611935c6f70c00818f25ee910edc5dfe22ad19a9638e"
STABILITY_PATH = Path(__file__).with_name("world_environment_stability.py")
if hashlib.sha256(STABILITY_PATH.read_bytes()).hexdigest() != STABILITY_SHA256:
    raise ValueError("frozen149 dependency changed")
_spec = importlib.util.spec_from_file_location("stability150_dependency", STABILITY_PATH)
parent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parent)
pilot, comparison = parent.pilot, parent.comparison
EVIDENCE_ROOT = pilot.ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-stability-150-20261029"
# Keep the exact149 guards, dates, causal feedback and post-trajectory scoring.
guard_bounds, guard_counts = parent.guard_bounds, parent.guard_counts
safe_values, origins = parent.safe_values, parent.origins
trajectory, score_trajectory = parent.trajectory, parent.score_trajectory
aggregate_rollouts, checkpoint_bytes = parent.aggregate_rollouts, parent.checkpoint_bytes


def validate_contract(contract, sha):
    pilot.require(sha == CONTRACT_SHA256, "only frozen150 contract supported")
    pilot.require(contract["schemaVersion"] == "world-environment-wind-stability-experiment-v1" and contract["productionReady"] is False, "wind stability contract mismatch")


def transform_targets(target):
    torch = pilot.configure_torch()
    transformed = parent.transform_targets(target)
    positive = target[:, 3] + 1e-6
    transformed[:, 3] = positive + torch.log(-torch.expm1(-positive))
    return transformed


def inverse_targets(transformed):
    torch = pilot.configure_torch()
    return torch.stack((torch.logaddexp(torch.zeros_like(transformed[:, 0]), transformed[:, 0]),
                        100 * torch.sigmoid(transformed[:, 1]), transformed[:, 2],
                        torch.logaddexp(torch.zeros_like(transformed[:, 3]), transformed[:, 3])), dim=1)


def fit_ridge(history, targets, input_mean, input_std):
    torch = pilot.configure_torch()
    transformed = transform_targets(targets)
    target_mean = transformed.mean(0)
    target_std = transformed.std(0, unbiased=False).clamp_min(1e-6)
    x = comparison.design(history, input_mean, input_std)
    y = (transformed - target_mean) / target_std
    penalty = torch.eye(29, dtype=torch.float64) * 10
    penalty[-1, -1] = 0
    weights = torch.linalg.solve(x.T @ x + penalty, x.T @ y)
    pilot.require(bool(torch.isfinite(weights).all()), "nonfinite ridge weights")
    return {"weights": weights, "inputMean": input_mean, "inputStd": input_std, "targetMean": target_mean, "targetStd": target_std}


def predict(model, history):
    return inverse_targets((comparison.design(history, model["inputMean"], model["inputStd"]) @ model["weights"]) * model["targetStd"] + model["targetMean"])


def output_directory(value):
    base, path = EVIDENCE_ROOT.resolve(strict=True), Path(value).absolute()
    pilot.require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    pilot.require(parent == base or base in parent.parents, "output outside150 evidence root")
    cursor = path.parent
    while cursor.resolve() != base:
        pilot.require(not cursor.is_symlink() and not cursor.is_junction(), "linked output ancestor")
        cursor = cursor.parent
    path.mkdir()
    return path


def run(args):
    started, begin = pilot.utc_now(), time.monotonic()
    deadline = begin + 120
    output, state, fit_count = output_directory(args.output_dir), {"bytes": 0}, 0
    try:
        contract = pilot.read_bound(args.contract, args.contract_sha256)
        validate_contract(contract, args.contract_sha256)
        parent_contract = pilot.read_bound(pilot.ROOT / contract["parentContract"]["path"], contract["parentContract"]["sha256"])
        parent.validate_contract(parent_contract, contract["parentContract"]["sha256"])
        pilot.require(args.dataset_sha256 == contract["dataset"]["sha256"], "dataset identity mismatch")
        dataset = pilot.validate_dataset(pilot.read_bound(args.dataset, args.dataset_sha256), pilot.CONTRACT_SHA256)
        torch = pilot.configure_torch()
        parent_checkpoint = torch.load(io.BytesIO(checkpoint_bytes(contract["parentCheckpoint"])), map_location="cpu", weights_only=True)
        pilot.require(parent_checkpoint["contractSha256"] == parent.CONTRACT_SHA256 and parent_checkpoint["datasetSha256"] == args.dataset_sha256, "parent checkpoint provenance mismatch")
        old = parent_checkpoint["model"]
        mean, std = pilot.fit_normalizer(dataset["trainDays"])
        bounds = guard_bounds(dataset["trainDays"], std)
        train = [w for w in dataset["windows"] if w["split"] == "train"]
        history = torch.tensor([w["history"] for w in train], dtype=torch.float64)
        target = torch.tensor([w["target"] for w in train], dtype=torch.float64)
        pilot.require(time.monotonic() < deadline, "preparation wall budget exhausted")
        fit_count = 1
        model = fit_ridge(history, target, mean, std)
        unchanged = all(torch.equal(model[k][:, :3], old[k][:, :3]) if k == "weights" else torch.equal(model[k][:3], old[k][:3]) for k in ("weights", "targetMean", "targetStd"))
        pilot.require(unchanged and torch.equal(model["inputMean"], old["inputMean"]) and torch.equal(model["inputStd"], old["inputStd"]), "other three model outputs or input normalizer changed")
        checkpoint = {"schemaVersion": "world-environment-wind-stability-checkpoint-v1", "model": model, "contractSha256": args.contract_sha256,
                      "datasetSha256": args.dataset_sha256, "targetTransform": "rain_and_wind_inverse_softplus_others149", "fitCount": 1}
        buffer = io.BytesIO()
        torch.save(checkpoint, buffer)
        checkpoint_ref = pilot.save_exclusive(output / "checkpoint.pt", buffer.getvalue(), state)
        loaded = torch.load(output / "checkpoint.pt", map_location="cpu", weights_only=True)
        pilot.require(loaded["contractSha256"] == args.contract_sha256 and loaded["datasetSha256"] == args.dataset_sha256 and all(torch.equal(v, loaded["model"][k]) for k, v in model.items()), "checkpoint reload mismatch")
        evaluations, rows = {}, []
        for split in pilot.SPLITS:
            pilot.require(time.monotonic() < deadline, "evaluation wall budget exhausted")
            windows = [w for w in dataset["windows"] if w["split"] == split]
            history = torch.tensor([w["history"] for w in windows], dtype=torch.float64)
            target = torch.tensor([w["target"] for w in windows], dtype=torch.float64)
            predicted, old_prediction = predict(model, history), parent.predict(old, history)
            pilot.require(torch.equal(predicted, predict(loaded["model"], history)), "strict reload prediction mismatch")
            ablated = predict(loaded["model"], history[:, -1:, :].repeat(1, 7, 1))
            finite = bool(torch.isfinite(predicted).all())
            ablated_finite = bool(torch.isfinite(ablated).all())
            evaluations[split] = {"count": len(windows), "previouslyExposed": True, "model": pilot.metrics(predicted, target, std) if finite else None,
                                  "parent149": pilot.metrics(old_prediction, target, std), "persistence": pilot.metrics(history[:, -1], target, std), "trainMean": pilot.metrics(mean.expand_as(target), target, std),
                                  "guardViolations": guard_counts(predicted, bounds), "ablationGuardViolations": guard_counts(ablated, bounds),
                                  "historyAblation": {"metrics": pilot.metrics(ablated, target, std) if ablated_finite else None,
                                  "meanAbsoluteOutputChange": safe_values((ablated - predicted).abs().mean(0).tolist()), "currentDayUnchanged": True, "worldMemoryVerified": False}}
            for i, window in enumerate(windows):
                rows.append({"split": split, "targetDate": window["targetDate"], "target": target[i].tolist(), "model": safe_values(predicted[i].tolist()),
                             "parent149": safe_values(old_prediction[i].tolist()), "persistence": history[i, -1].tolist(), "historyAblated": safe_values(ablated[i].tolist())})
        # Origin selection inspects dates and initial history, never future target values.
        selected_origins = origins(dataset["windows"])
        rollouts = []
        for origin in selected_origins:
            new_result = trajectory(lambda h: predict(loaded["model"], h), origin["history"], origin["targetDate"], bounds, deadline)
            old_result = trajectory(lambda h: parent.predict(old, h), origin["history"], origin["targetDate"], bounds, deadline)
            rollouts.append({"split": origin["split"], "originDate": origin["targetDate"], "initialHistoryDates": origin["historyDates"], "new150": new_result, "parent149": old_result})
        # Truth is now consulted for scoring, after every model trajectory terminated.
        truth_map = {w["targetDate"]: w["target"] for w in dataset["windows"]}
        for rollout in rollouts:
            for label in ("new150", "parent149"):
                rollout[label]["scores"] = score_trajectory(rollout[label], truth_map, std, mean)
        aggregates = {label: {split: {str(h): aggregate_rollouts(rollouts, label, split, h, truth_map, std, mean) for h in (7, 30)} for split in pilot.SPLITS} for label in ("new150", "parent149")}
        one_step_better = all(evaluations[s]["model"] is not None and evaluations[s]["model"]["meanNormalizedMAE"] < evaluations[s]["persistence"]["meanNormalizedMAE"] for s in ("validation", "test"))
        guard_pass = all(not any(e["guardViolations"].values()) and not any(e["ablationGuardViolations"].values()) for e in evaluations.values())
        complete = bool(rollouts) and all(r["new150"]["completed30Days"] for r in rollouts)
        seven_day_better = all(aggregates["new150"][s]["7"]["fullCoverage"] and aggregates["new150"][s]["7"]["metrics"]["meanNormalizedMAE"] < aggregates["new150"][s]["7"]["constantLastDay"]["meanNormalizedMAE"] for s in ("validation", "test"))
        passed = one_step_better and guard_pass and complete and seven_day_better
        predictions_ref = pilot.save_exclusive(output / "predictions.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "rows": rows}), state)
        rollouts_ref = pilot.save_exclusive(output / "rollouts.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "guards": bounds, "trajectories": rollouts}), state)
        result = {"schemaVersion": "world-environment-wind-stability-result-v1", "taskId": "WORLD-ENVIRONMENT-STABILITY-150", "status": "experiment_completed",
                  "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": fit_count, "device": "cpu", "cpuThreads": 2,
                  "dtype": "float64", "alpha": 10.0, "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256,
                  "parentCheckpoint": contract["parentCheckpoint"], "checkpoint": checkpoint_ref, "predictions": predictions_ref, "rollouts": rollouts_ref,
                  "codeBindings": [{"path": str(p.resolve()), "sha256": pilot.digest(p.read_bytes())} for p in [Path(__file__), STABILITY_PATH, parent.COMPARISON_PATH, comparison.PILOT_PATH]],
                  "runtime": {"python": sys.version, "torch": torch.__version__}, "guards": {pilot.FIELDS[i]: {"minimum": v[0], "maximum": v[1], "purpose": "empirical_diagnostic_only"} for i, v in enumerate(bounds)},
                  "evaluations": evaluations, "rolloutAggregates": aggregates, "originCount": len(rollouts), "otherThreeOutputsUnchanged": unchanged,
                  "strictCpuReloadIdentical": True, "developmentRuleConditions": {"oneStepBetter": one_step_better, "oneStepAndAblationGuards": guard_pass, "allNew30DayRolloutsComplete": complete, "sevenDayBetter": seven_day_better},
                  "developmentStabilityPassed": passed, "decision": "further_isolated_evaluation_only" if passed else "rejected_for_production_followup",
                  "allSplitsPreviouslyExposed": True, "worldMemoryVerified": False, "productionReady": False, "worldStateWrites": 0,
                  "limitations": ["Regional retrospective meteorology only; no world-state, vegetation or visual qualification.", "Empirical train-derived bounds are not natural physical limits.",
                                  "Development selection used exposed validation/test; no fresh-test claim.", "Ablation and closed-loop weather are not verified world memory."], "artifactBytesBeforeResult": state["bytes"]}
        pilot.require(time.monotonic() < deadline, "total wall budget exhausted")
        pilot.save_exclusive(output / "result.json", pilot.json_bytes(result), state)
        return {"status": result["status"], "outputDirectory": str(output), "fitCount": fit_count, "developmentStabilityPassed": passed, "artifactBytes": state["bytes"], "productionReady": False}
    except Exception as error:
        pilot.save_exclusive(output / "failure.json", pilot.json_bytes({"taskId": "WORLD-ENVIRONMENT-STABILITY-150", "status": "failed", "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(),
                             "elapsedSeconds": time.monotonic() - begin, "fitAttempts": fit_count, "errorType": type(error).__name__, "error": str(error)[:2000], "productionReady": False, "worldStateWrites": 0}), state)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("dataset", "dataset-sha256", "contract", "contract-sha256", "output-dir"):
        parser.add_argument("--" + name, required=True)
    try:
        print(json.dumps(run(parser.parse_args()), ensure_ascii=False, allow_nan=False))
    except Exception as error:
        print(json.dumps({"status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000]}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

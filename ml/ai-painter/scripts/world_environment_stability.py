"""Frozen149 rainfall-transform repair and guarded retrospective rollout comparison."""

import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
import math
from pathlib import Path
import sys
import time


CONTRACT_SHA256 = "c4802184a634f7b8eec9c3baa224ae7ae21067cfd5efa524108f701ecd5ce85c"
COMPARISON_SHA256 = "c68f38252e3ed743fa33769d5d0432d8f19da0b6f6563bbd900d27c92241f1b6"
COMPARISON_PATH = Path(__file__).with_name("world_environment_comparison.py")
if hashlib.sha256(COMPARISON_PATH.read_bytes()).hexdigest() != COMPARISON_SHA256:
    raise ValueError("frozen148 dependency changed")
_spec = importlib.util.spec_from_file_location("comparison149_dependency", COMPARISON_PATH)
comparison = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(comparison)
pilot = comparison.pilot
EVIDENCE_ROOT = pilot.ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-stability-149-20261029"


def validate_contract(contract, sha):
    pilot.require(sha == CONTRACT_SHA256, "only frozen149 contract supported")
    pilot.require(contract["schemaVersion"] == "world-environment-stability-experiment-v1" and contract["productionReady"] is False, "stability contract mismatch")


def transform_targets(target):
    torch = pilot.configure_torch()
    transformed = comparison.transform_targets(target)
    positive = target[:, 0] + 1e-6
    transformed[:, 0] = positive + torch.log(-torch.expm1(-positive))
    return transformed


def inverse_targets(transformed):
    torch = pilot.configure_torch()
    # Avoid the obsolete rainfall exp even as a discarded intermediate.
    return torch.stack((torch.logaddexp(torch.zeros_like(transformed[:, 0]), transformed[:, 0]),
                        100 * torch.sigmoid(transformed[:, 1]), transformed[:, 2], torch.exp(transformed[:, 3])), dim=1)


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


def guard_bounds(train_days, std):
    torch = pilot.configure_torch()
    values = torch.tensor(train_days, dtype=torch.float64)
    return [[0.0, float(2 * values[:, 0].max())], [0.0, 100.0],
            [float(values[:, 2].min() - 3 * std[2]), float(values[:, 2].max() + 3 * std[2])], [0.0, float(2 * values[:, 3].max())]]


def guard_failures(vector, bounds):
    failures = []
    for index, (low, high) in enumerate(bounds):
        value = float(vector[index])
        if not math.isfinite(value) or not low <= value <= high:
            failures.append({"field": pilot.FIELDS[index], "rawValue": value if math.isfinite(value) else str(value), "minimum": low, "maximum": high,
                             "reason": "nonfinite" if not math.isfinite(value) else "outside_frozen_empirical_bounds"})
    return failures


def guard_counts(values, bounds):
    counts = dict.fromkeys(pilot.FIELDS, 0)
    for row in values:
        for failure in guard_failures(row, bounds):
            counts[failure["field"]] += 1
    return counts


def safe_values(values):
    if isinstance(values, list):
        return [safe_values(v) for v in values]
    return values if math.isfinite(values) else str(values)


def origins(windows):
    seen, selected = set(), []
    for window in windows:
        split, date = window["split"], window["targetDate"]
        month_key = (split, date[:6])
        last = (pilot.parse_date(date) + dt.timedelta(days=29)).strftime("%Y%m%d")
        if month_key not in seen and last <= pilot.SPLITS[split][1]:
            seen.add(month_key)
            selected.append({"split": split, "targetDate": date, "historyDates": window["historyDates"], "history": window["history"]})
    return selected


def trajectory(predictor, initial_history, start_date, bounds, deadline):
    """No truth argument: future observations cannot enter autoregressive feedback."""
    torch = pilot.configure_torch()
    history = torch.tensor(initial_history, dtype=torch.float64).clone()
    pilot.require(tuple(history.shape) == (7, 4), "trajectory initial history shape")
    steps, rejection = [], None
    for index in range(30):
        pilot.require(time.monotonic() < deadline, "rollout wall budget exhausted")
        date = (pilot.parse_date(start_date) + dt.timedelta(days=index)).strftime("%Y%m%d")
        consumed = history.tolist()
        consumed_sha = pilot.digest(pilot.json_bytes(consumed))
        predicted = predictor(history.unsqueeze(0))[0].detach().to(torch.float64)
        failures = guard_failures(predicted, bounds)
        step = {"step": index + 1, "date": date, "inputHistorySha256": consumed_sha, "prediction": safe_values(predicted.tolist()), "acceptedForFeedback": not failures}
        steps.append(step)
        if failures:
            rejection = {"step": index + 1, "date": date, "inputHistory": consumed, "inputHistorySha256": consumed_sha,
                         "rawPrediction": safe_values(predicted.tolist()), "failures": failures, "appendedToHistory": False}
            break
        history = torch.cat((history[1:], predicted.unsqueeze(0)), dim=0)
    return {"initialHistory": initial_history, "originDate": start_date, "steps": steps, "completedAcceptedSteps": sum(s["acceptedForFeedback"] for s in steps),
            "completed30Days": rejection is None and len(steps) == 30, "firstRejection": rejection, "feedbackPolicy": "predictions_only_after_initial7days"}


def score_trajectory(result, truth_map, std, mean):
    """Called only after the trajectory has completed or rejected."""
    torch = pilot.configure_torch()
    scores = {}
    for horizon in (7, 30):
        complete = result["completedAcceptedSteps"] >= horizon
        scores[str(horizon)] = {"complete": complete, "metrics": None, "constantLastDay": None, "trainMean": None}
        if complete:
            steps = result["steps"][:horizon]
            predicted = torch.tensor([s["prediction"] for s in steps], dtype=torch.float64)
            target = torch.tensor([truth_map[s["date"]] for s in steps], dtype=torch.float64)
            last = torch.tensor(result["initialHistory"][-1], dtype=torch.float64).expand_as(target)
            scores[str(horizon)].update(metrics=pilot.metrics(predicted, target, std), constantLastDay=pilot.metrics(last, target, std), trainMean=pilot.metrics(mean.expand_as(target), target, std))
    return scores


def aggregate_rollouts(rollouts, label, split, horizon, truth_map, std, mean):
    torch = pilot.configure_torch()
    chosen = [r for r in rollouts if r["split"] == split]
    complete = [r[label] for r in chosen if r[label]["completedAcceptedSteps"] >= horizon]
    summary = {"origins": len(chosen), "completedOrigins": len(complete), "rejectedOrigins": len(chosen) - len(complete), "fullCoverage": len(complete) == len(chosen),
               "metrics": None, "constantLastDay": None, "trainMean": None}
    if complete:
        predictions, targets, constants = [], [], []
        for result in complete:
            for step in result["steps"][:horizon]:
                predictions.append(step["prediction"])
                targets.append(truth_map[step["date"]])
                constants.append(result["initialHistory"][-1])
        target = torch.tensor(targets, dtype=torch.float64)
        summary.update(metrics=pilot.metrics(torch.tensor(predictions, dtype=torch.float64), target, std),
                       constantLastDay=pilot.metrics(torch.tensor(constants, dtype=torch.float64), target, std), trainMean=pilot.metrics(mean.expand_as(target), target, std))
    return summary


def output_directory(value):
    base, path = EVIDENCE_ROOT.resolve(strict=True), Path(value).absolute()
    pilot.require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    pilot.require(parent == base or base in parent.parents, "output outside149 evidence root")
    cursor = path.parent
    while cursor.resolve() != base:
        pilot.require(not cursor.is_symlink() and not cursor.is_junction(), "linked output ancestor")
        cursor = cursor.parent
    path.mkdir()
    return path


def checkpoint_bytes(ref):
    path = pilot.ROOT / ref["path"]
    pilot.require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1, "checkpoint not regular file")
    with path.open("rb") as handle:
        raw = handle.read(pilot.MAX_BYTES + 1)
    pilot.require(len(raw) <= pilot.MAX_BYTES and pilot.digest(raw) == ref["sha256"], "checkpoint size/SHA mismatch")
    return raw


def run(args):
    started, begin = pilot.utc_now(), time.monotonic()
    deadline = begin + 120
    output, state, fit_count = output_directory(args.output_dir), {"bytes": 0}, 0
    try:
        contract = pilot.read_bound(args.contract, args.contract_sha256)
        validate_contract(contract, args.contract_sha256)
        parent_contract = pilot.read_bound(pilot.ROOT / contract["parentContract"]["path"], contract["parentContract"]["sha256"])
        comparison.validate_contract(parent_contract, contract["parentContract"]["sha256"])
        pilot.require(args.dataset_sha256 == contract["dataset"]["sha256"], "dataset identity mismatch")
        dataset = pilot.validate_dataset(pilot.read_bound(args.dataset, args.dataset_sha256), pilot.CONTRACT_SHA256)
        torch = pilot.configure_torch()
        parent_checkpoint = torch.load(io.BytesIO(checkpoint_bytes(contract["parentCheckpoint"])), map_location="cpu", weights_only=True)
        pilot.require(parent_checkpoint["contractSha256"] == comparison.CONTRACT_SHA256 and parent_checkpoint["datasetSha256"] == args.dataset_sha256, "parent checkpoint provenance mismatch")
        old = parent_checkpoint["model"]
        mean, std = pilot.fit_normalizer(dataset["trainDays"])
        bounds = guard_bounds(dataset["trainDays"], std)
        train = [w for w in dataset["windows"] if w["split"] == "train"]
        history = torch.tensor([w["history"] for w in train], dtype=torch.float64)
        target = torch.tensor([w["target"] for w in train], dtype=torch.float64)
        pilot.require(time.monotonic() < deadline, "preparation wall budget exhausted")
        fit_count = 1
        model = fit_ridge(history, target, mean, std)
        unchanged = all(torch.equal(model[k][:, 1:], old[k][:, 1:]) if k == "weights" else torch.equal(model[k][1:], old[k][1:]) for k in ("weights", "targetMean", "targetStd"))
        pilot.require(unchanged and torch.equal(model["inputMean"], old["inputMean"]) and torch.equal(model["inputStd"], old["inputStd"]), "other three model outputs or input normalizer changed")
        checkpoint = {"schemaVersion": "world-environment-stability-checkpoint-v1", "model": model, "contractSha256": args.contract_sha256,
                      "datasetSha256": args.dataset_sha256, "targetTransform": "rain_inverse_softplus_others148", "fitCount": 1}
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
            predicted, old_prediction = predict(model, history), comparison.predict(old, history)
            pilot.require(torch.equal(predicted, predict(loaded["model"], history)), "strict reload prediction mismatch")
            ablated = predict(loaded["model"], history[:, -1:, :].repeat(1, 7, 1))
            finite = bool(torch.isfinite(predicted).all())
            ablated_finite = bool(torch.isfinite(ablated).all())
            evaluations[split] = {"count": len(windows), "previouslyExposed": True, "model": pilot.metrics(predicted, target, std) if finite else None,
                                  "parent148": pilot.metrics(old_prediction, target, std), "persistence": pilot.metrics(history[:, -1], target, std), "trainMean": pilot.metrics(mean.expand_as(target), target, std),
                                  "guardViolations": guard_counts(predicted, bounds), "ablationGuardViolations": guard_counts(ablated, bounds),
                                  "historyAblation": {"metrics": pilot.metrics(ablated, target, std) if ablated_finite else None,
                                  "meanAbsoluteOutputChange": safe_values((ablated - predicted).abs().mean(0).tolist()), "currentDayUnchanged": True, "worldMemoryVerified": False}}
            for i, window in enumerate(windows):
                rows.append({"split": split, "targetDate": window["targetDate"], "target": target[i].tolist(), "model": safe_values(predicted[i].tolist()),
                             "parent148": safe_values(old_prediction[i].tolist()), "persistence": history[i, -1].tolist(), "historyAblated": safe_values(ablated[i].tolist())})
        # Origin selection inspects dates and initial history, never future target values.
        selected_origins = origins(dataset["windows"])
        rollouts = []
        for origin in selected_origins:
            new_result = trajectory(lambda h: predict(loaded["model"], h), origin["history"], origin["targetDate"], bounds, deadline)
            old_result = trajectory(lambda h: comparison.predict(old, h), origin["history"], origin["targetDate"], bounds, deadline)
            rollouts.append({"split": origin["split"], "originDate": origin["targetDate"], "initialHistoryDates": origin["historyDates"], "new149": new_result, "parent148": old_result})
        # Truth is now consulted for scoring, after every model trajectory terminated.
        truth_map = {w["targetDate"]: w["target"] for w in dataset["windows"]}
        for rollout in rollouts:
            for label in ("new149", "parent148"):
                rollout[label]["scores"] = score_trajectory(rollout[label], truth_map, std, mean)
        aggregates = {label: {split: {str(h): aggregate_rollouts(rollouts, label, split, h, truth_map, std, mean) for h in (7, 30)} for split in pilot.SPLITS} for label in ("new149", "parent148")}
        one_step_better = all(evaluations[s]["model"] is not None and evaluations[s]["model"]["meanNormalizedMAE"] < evaluations[s]["persistence"]["meanNormalizedMAE"] for s in ("validation", "test"))
        guard_pass = all(not any(e["guardViolations"].values()) and not any(e["ablationGuardViolations"].values()) for e in evaluations.values())
        complete = bool(rollouts) and all(r["new149"]["completed30Days"] for r in rollouts)
        seven_day_better = all(aggregates["new149"][s]["7"]["fullCoverage"] and aggregates["new149"][s]["7"]["metrics"]["meanNormalizedMAE"] < aggregates["new149"][s]["7"]["constantLastDay"]["meanNormalizedMAE"] for s in ("validation", "test"))
        passed = one_step_better and guard_pass and complete and seven_day_better
        predictions_ref = pilot.save_exclusive(output / "predictions.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "rows": rows}), state)
        rollouts_ref = pilot.save_exclusive(output / "rollouts.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "guards": bounds, "trajectories": rollouts}), state)
        result = {"schemaVersion": "world-environment-stability-result-v1", "taskId": "WORLD-ENVIRONMENT-STABILITY-149", "status": "experiment_completed",
                  "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": fit_count, "device": "cpu", "cpuThreads": 2,
                  "dtype": "float64", "alpha": 10.0, "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256,
                  "parentCheckpoint": contract["parentCheckpoint"], "checkpoint": checkpoint_ref, "predictions": predictions_ref, "rollouts": rollouts_ref,
                  "codeBindings": [{"path": str(p.resolve()), "sha256": pilot.digest(p.read_bytes())} for p in [Path(__file__), COMPARISON_PATH, comparison.PILOT_PATH]],
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
        pilot.save_exclusive(output / "failure.json", pilot.json_bytes({"taskId": "WORLD-ENVIRONMENT-STABILITY-149", "status": "failed", "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(),
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

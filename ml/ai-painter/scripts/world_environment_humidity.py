"""Frozen153 RH-column repair, evaluated against150 on all exposed periods."""

import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import time

CONTRACT_SHA256 = "fef9030883c521274683f6bb09806904dfcd0faeeb4b44c4406e89405df453e0"
HOLDOUT_SHA256 = "cf8b2555422b775a6b5bed2c86320e93f810a14d59b127d5da2d7f04a78a840a"
HOLDOUT_PATH = Path(__file__).with_name("world_environment_holdout.py")
if hashlib.sha256(HOLDOUT_PATH.read_bytes()).hexdigest() != HOLDOUT_SHA256:
    raise ValueError("frozen151 dependency changed")
_spec = importlib.util.spec_from_file_location("holdout153_dependency", HOLDOUT_PATH)
holdout = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(holdout)
pilot, wind = holdout.pilot, holdout.wind
EVIDENCE_ROOT = pilot.ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-humidity-153-20261029"
SPLITS = ["train", "validation", "test", "holdout2024"]
EVALUATION_SPLITS = SPLITS[1:]


def validate_contract(contract, sha):
    pilot.require(sha == CONTRACT_SHA256, "only frozen153 contract supported")
    pilot.require(contract["schemaVersion"] == "world-environment-humidity-experiment-v1" and contract["productionReady"] is False, "humidity contract mismatch")


def fit_rh_column(parent, history, targets):
    torch = pilot.configure_torch()
    pilot.require(targets.dtype == torch.float64 and tuple(targets.shape) == (history.shape[0], 4), "RH training target shape/dtype mismatch")
    pilot.require(bool(torch.isfinite(targets).all()) and bool(((targets[:, 1] >= 0) & (targets[:, 1] <= 100)).all()), "invalid RH training targets")
    candidate = {key: value.clone() for key, value in parent.items()}
    x = wind.comparison.design(history, parent["inputMean"], parent["inputStd"])
    mean, std = targets[:, 1].mean(), targets[:, 1].std(unbiased=False)
    pilot.require(bool(torch.isfinite(std)) and float(std) > 0, "RH target standard deviation must be positive")
    y = (targets[:, 1] - mean) / std
    penalty = torch.eye(29, dtype=torch.float64) * 10
    penalty[-1, -1] = 0
    candidate["weights"][:, 1] = torch.linalg.solve(x.T @ x + penalty, x.T @ y)
    candidate["targetMean"][1], candidate["targetStd"][1] = mean, std
    pilot.require(all(bool(torch.isfinite(v).all()) for v in candidate.values()), "nonfinite RH fit")
    return candidate


def verify_unchanged_columns(candidate, parent):
    torch = pilot.configure_torch()
    columns = [0, 2, 3]
    return (torch.equal(candidate["weights"][:, columns], parent["weights"][:, columns])
            and torch.equal(candidate["targetMean"][columns], parent["targetMean"][columns])
            and torch.equal(candidate["targetStd"][columns], parent["targetStd"][columns])
            and torch.equal(candidate["inputMean"], parent["inputMean"]) and torch.equal(candidate["inputStd"], parent["inputStd"]))


def predict(model, history):
    torch = pilot.configure_torch()
    transformed = (wind.comparison.design(history, model["inputMean"], model["inputStd"]) @ model["weights"]) * model["targetStd"] + model["targetMean"]
    # RH is an unconstrained raw percentage; guards reject it, never clip it.
    return torch.stack((torch.logaddexp(torch.zeros_like(transformed[:, 0]), transformed[:, 0]), transformed[:, 1], transformed[:, 2],
                        torch.logaddexp(torch.zeros_like(transformed[:, 3]), transformed[:, 3])), dim=1)


def criteria(evaluations, aggregates, rollouts):
    def better(split, horizon, field=None):
        current = aggregates["candidate153"][split][str(horizon)]
        if not current["fullCoverage"] or current["metrics"] is None:
            return False
        if field:
            parent = aggregates["parent150"][split][str(horizon)]
            return parent["fullCoverage"] and parent["metrics"] is not None and current["metrics"]["perField"][field]["MAE"] < parent["metrics"]["perField"][field]["MAE"]
        return current["metrics"]["meanNormalizedMAE"] < current["constantLastDay"]["meanNormalizedMAE"]
    return {
        "oneStepBetterEachEvaluationSplit": all(evaluations[s]["candidate153"]["metrics"] is not None and evaluations[s]["candidate153"]["metrics"]["meanNormalizedMAE"] < evaluations[s]["persistence"]["meanNormalizedMAE"] for s in EVALUATION_SPLITS),
        "allSplitsOneStepAndAblationGuards": all(not any(evaluations[s]["candidate153"][k].values()) for s in SPLITS for k in ("guardViolations", "ablationGuardViolations")),
        "all60CandidateThirtyDayRolloutsComplete": len(rollouts) == 60 and all(r["candidate153"]["completed30Days"] for r in rollouts),
        "sevenDayBetterEachEvaluationSplit": all(better(s, 7) for s in EVALUATION_SPLITS),
        "thirtyDayRhBetterThanParentEachEvaluationSplit": all(better(s, 30, "RH2M") for s in EVALUATION_SPLITS),
        "thirtyDayBetterThanConstantEachEvaluationSplit": all(better(s, 30) for s in EVALUATION_SPLITS),
    }


def output_directory(value):
    base, path = EVIDENCE_ROOT.resolve(strict=True), Path(value).absolute()
    pilot.require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    pilot.require(parent == base or base in parent.parents, "output outside153 evidence root")
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
        for ref in contract["codeBindings"]:
            pilot.require(pilot.digest((pilot.ROOT / ref["path"]).read_bytes()) == ref["sha256"], "source dependency mismatch")
        training_ref, additional_ref = contract["trainingDataset"], contract["additionalExposedDataset"]
        training = pilot.validate_dataset(pilot.read_bound(pilot.ROOT / training_ref["path"], training_ref["sha256"]), pilot.CONTRACT_SHA256)
        additional = holdout.validate_dataset(pilot.read_bound(pilot.ROOT / additional_ref["path"], additional_ref["sha256"]))
        windows = training["windows"] + additional["windows"]
        pilot.require(len(windows) == 1799, "combined window count mismatch")
        torch = pilot.configure_torch()
        parent = holdout.frozen_checkpoint(contract["parentCheckpoint"])
        mean, std = parent["inputMean"], parent["inputStd"]
        bounds = [[contract["guards"][f]["minimum"], contract["guards"][f]["maximum"]] for f in pilot.FIELDS]
        train = [w for w in training["windows"] if w["split"] == "train"]
        pilot.require(len(train) == 724 and time.monotonic() < deadline, "training count/time mismatch")
        fit_count = 1
        candidate = fit_rh_column(parent, torch.tensor([w["history"] for w in train], dtype=torch.float64), torch.tensor([w["target"] for w in train], dtype=torch.float64))
        pilot.require(verify_unchanged_columns(candidate, parent), "non-RH model state changed")
        checkpoint = {"schemaVersion": "world-environment-humidity-checkpoint-v1", "model": candidate, "contractSha256": args.contract_sha256,
                      "trainingDatasetSha256": training_ref["sha256"], "parentCheckpointSha256": contract["parentCheckpoint"]["sha256"], "fitCount": 1, "onlyFittedColumn": "RH2M", "targetTransform": "raw_RH_other_columns150"}
        stream = io.BytesIO()
        torch.save(checkpoint, stream)
        checkpoint_ref = pilot.save_exclusive(output / "checkpoint.pt", stream.getvalue(), state)
        restored = torch.load(output / "checkpoint.pt", map_location="cpu", weights_only=True)
        pilot.require(restored["contractSha256"] == args.contract_sha256 and all(torch.equal(v, restored["model"][k]) for k, v in candidate.items()), "checkpoint strict reload mismatch")
        # Compute predictions now; future target metrics are deferred until all trajectories finish.
        daily = {}
        for split in SPLITS:
            group = [w for w in windows if w["split"] == split]
            history = torch.tensor([w["history"] for w in group], dtype=torch.float64)
            repeated = history[:, -1:, :].repeat(1, 7, 1)
            new_prediction = predict(candidate, history)
            pilot.require(torch.equal(new_prediction, predict(restored["model"], history)), "strict reload predictions differ")
            daily[split] = {"group": group, "history": history, "candidate153": (new_prediction, predict(restored["model"], repeated)), "parent150": (wind.predict(parent, history), wind.predict(parent, repeated))}
        selected = wind.origins(training["windows"]) + holdout.select_origins(additional["windows"])
        counts = {s: sum(o["split"] == s for o in selected) for s in SPLITS}
        pilot.require(counts == contract["evaluation"]["originCounts"], "origin count mismatch")
        rollouts = []
        for origin in selected:
            new_result = wind.trajectory(lambda h: predict(restored["model"], h), origin["history"], origin["targetDate"], bounds, deadline)
            parent_result = wind.trajectory(lambda h: wind.predict(parent, h), origin["history"], origin["targetDate"], bounds, deadline)
            rollouts.append({"split": origin["split"], "originDate": origin["targetDate"], "initialHistoryDates": origin["historyDates"], "candidate153": new_result, "parent150": parent_result})
        truth = {w["targetDate"]: w["target"] for w in windows}
        evaluations, rows, failures = {}, [], []
        for split, item in daily.items():
            target = torch.tensor([w["target"] for w in item["group"]], dtype=torch.float64)
            evaluations[split] = {"count": len(item["group"]), "previouslyExposed": True, "persistence": holdout.metrics(item["history"][:, -1], target, std), "trainMean": holdout.metrics(mean.expand_as(target), target, std)}
            for label in ("candidate153", "parent150"):
                prediction, ablated = item[label]
                evaluations[split][label] = {"metrics": holdout.metrics(prediction, target, std) if bool(torch.isfinite(prediction).all()) else None,
                    "guardViolations": wind.guard_counts(prediction, bounds), "ablationGuardViolations": wind.guard_counts(ablated, bounds),
                    "ablationMetrics": holdout.metrics(ablated, target, std) if bool(torch.isfinite(ablated).all()) else None,
                    "meanAbsoluteAblationChange": wind.safe_values((ablated - prediction).abs().mean(0).tolist())}
            for i, window in enumerate(item["group"]):
                row = {"split": split, "targetDate": window["targetDate"], "target": window["target"], "persistence": window["history"][-1]}
                for label in ("candidate153", "parent150"):
                    pred, ablated = item[label]
                    row[label] = {"prediction": wind.safe_values(pred[i].tolist()), "historyAblated": wind.safe_values(ablated[i].tolist())}
                    for kind, value, consumed in (("oneStep", pred[i], window["history"]), ("ablation", ablated[i], [window["history"][-1]] * 7)):
                        reasons = wind.parent.guard_failures(value, bounds)
                        if reasons:
                            failures.append({"model": label, "kind": kind, "split": split, "targetDate": window["targetDate"], "rawPrediction": wind.safe_values(value.tolist()), "inputHistory": consumed, "failures": reasons})
                rows.append(row)
        for rollout in rollouts:
            for label in ("candidate153", "parent150"):
                rollout[label]["scores"] = wind.score_trajectory(rollout[label], truth, std, mean)
        aggregates = {label: {s: {str(h): wind.aggregate_rollouts(rollouts, label, s, h, truth, std, mean) for h in (7, 30)} for s in SPLITS} for label in ("candidate153", "parent150")}
        conditions = criteria(evaluations, aggregates, rollouts)
        predictions_ref = pilot.save_exclusive(output / "predictions.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "rows": rows, "guardFailures": failures}), state)
        rollouts_ref = pilot.save_exclusive(output / "rollouts.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "guards": bounds, "trajectories": rollouts}), state)
        for ref in contract["codeBindings"] + [training_ref, additional_ref, contract["parentCheckpoint"]]:
            pilot.require(pilot.digest((pilot.ROOT / ref["path"]).read_bytes()) == ref["sha256"], "frozen input changed during run")
        result = {"schemaVersion": "world-environment-humidity-result-v1", "taskId": "WORLD-ENVIRONMENT-HUMIDITY-153", "status": "experiment_completed",
                  "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": fit_count, "onlyFittedColumn": "RH2M",
                  "device": "cpu", "cpuThreads": 2, "dtype": "float64", "alpha": 10.0, "contractSha256": args.contract_sha256,
                  "trainingDataset": training_ref, "additionalExposedDataset": additional_ref, "parentCheckpoint": contract["parentCheckpoint"],
                  "checkpoint": checkpoint_ref, "predictions": predictions_ref, "rollouts": rollouts_ref, "codeBindings": contract["codeBindings"] + [{"path": str(Path(__file__).resolve()), "sha256": pilot.digest(Path(__file__).read_bytes())}],
                  "runtime": {"python": sys.version, "torch": torch.__version__}, "otherThreeColumnsAndInputNormalizerUnchanged": True,
                  "strictCpuReloadIdentical": True, "guards": contract["guards"], "originCounts": counts, "evaluations": evaluations, "rolloutAggregates": aggregates,
                  "passConditions": conditions, "developmentRepairPassed": all(conditions.values()), "allSplitsPreviouslyExposed": True,
                  "productionReady": False, "worldMemoryVerified": False, "worldStateWrites": 0, "limitations": contract["limitations"] + ["Provider publication times unknown; retrospective completed-day hypothesis, not operational as-of forecasting."],
                  "artifactBytesBeforeResult": state["bytes"]}
        pilot.require(time.monotonic() < deadline, "total execution wall budget exhausted")
        pilot.save_exclusive(output / "result.json", pilot.json_bytes(result), state)
        return {"status": result["status"], "outputDirectory": str(output), "fitCount": fit_count, "developmentRepairPassed": result["developmentRepairPassed"], "productionReady": False, "artifactBytes": state["bytes"]}
    except Exception as error:
        pilot.save_exclusive(output / "failure.json", pilot.json_bytes({"taskId": "WORLD-ENVIRONMENT-HUMIDITY-153", "status": "failed", "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(),
                             "elapsedSeconds": time.monotonic() - begin, "fitCount": fit_count, "errorType": type(error).__name__, "error": str(error)[:2000], "productionReady": False, "worldStateWrites": 0}), state)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("contract", "contract-sha256", "output-dir"):
        parser.add_argument("--" + name, required=True)
    try:
        print(json.dumps(run(parser.parse_args()), ensure_ascii=False, allow_nan=False))
    except Exception as error:
        print(json.dumps({"status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000]}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Frozen153 versus150 inference on154 holdout2025; zero fitting."""

import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import time

CONTRACT_SHA256 = "4ac397b53dc55b7d4d0f33da6e213db88a2ee0210be03042e483103ccf527517"
DATASET_SHA256 = "ee21c9ffc321999acba896eef88a3f8b7225712388090cde0454ecc70bc17dc5"
HUMIDITY_SHA256 = "b3e0788504f52eaeab44fb556acced7b32d5a79af3ab47e6a0faf12df0762928"
HUMIDITY_PATH = Path(__file__).with_name("world_environment_humidity.py")
if hashlib.sha256(HUMIDITY_PATH.read_bytes()).hexdigest() != HUMIDITY_SHA256:
    raise ValueError("frozen153 dependency changed")
_spec = importlib.util.spec_from_file_location("humidity154_dependency", HUMIDITY_PATH)
humidity = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(humidity)
pilot, wind, holdout = humidity.pilot, humidity.wind, humidity.holdout
EVIDENCE_ROOT = pilot.ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-holdout-154-20261029"


def validate_contract(contract, sha):
    pilot.require(sha == CONTRACT_SHA256, "only frozen154 evaluation contract supported")
    pilot.require(contract["schemaVersion"] == "world-environment-holdout2025-evaluation-v1" and contract["productionReady"] is False, "evaluation contract mismatch")


def validate_dataset(dataset):
    pilot.exact_keys(dataset, ["schemaVersion", "contractSha256", "sourceBinding", "fieldOrder", "units", "sourceDays", "windows", "splitSummary", "productionReady"])
    pilot.require(dataset["schemaVersion"] == "world-environment-holdout2025-dataset-v1" and dataset["contractSha256"] == CONTRACT_SHA256, "dataset identity mismatch")
    pilot.require(dataset["fieldOrder"] == pilot.FIELDS and dataset["units"] == pilot.UNITS, "field/unit mismatch")
    pilot.require(dataset["sourceDays"] == 365 and dataset["productionReady"] is False, "holdout coverage/production mismatch")
    pilot.require(type(dataset["sourceBinding"]) is dict and bool(dataset["sourceBinding"]), "source binding missing")
    pilot.require(type(dataset["windows"]) is list and len(dataset["windows"]) == 358, "holdout window count mismatch")
    dates, seen = pilot.date_range("20250101", "20251231"), {}
    for i, window in enumerate(dataset["windows"], 7):
        pilot.exact_keys(window, ["split", "history", "target", "historyDates", "targetDate"])
        pilot.require(window["split"] == "holdout2025" and window["targetDate"] == dates[i], "holdout split/target order mismatch")
        pilot.require(window["historyDates"] == dates[i - 7:i], "future/cross-boundary/unordered history")
        pilot.require(type(window["history"]) is list and len(window["history"]) == 7, "history shape mismatch")
        for date, row in zip(window["historyDates"] + [window["targetDate"]], window["history"] + [window["target"]]):
            values = pilot.vector(row)
            if date in seen:
                pilot.require(seen[date] == values, "same date inconsistent values")
            seen[date] = values
    pilot.require(sorted(seen) == dates, "holdout dates incomplete")
    return dataset


def select_origins(windows):
    selected, months = [], set()
    for window in windows:
        date, month = window["targetDate"], window["targetDate"][:6]
        last = (pilot.parse_date(date) + dt.timedelta(days=29)).strftime("%Y%m%d")
        if month not in months and last <= "20251231":
            pilot.require(window["split"] == "holdout2025" and "20250108" <= date <= "20251231", "origin outside holdout")
            months.add(month)
            selected.append({"split": "holdout2025", "targetDate": date, "history": window["history"], "historyDates": window["historyDates"]})
    return selected


def load_candidate(ref, parent_sha):
    torch = pilot.configure_torch()
    checkpoint = torch.load(io.BytesIO(wind.checkpoint_bytes(ref)), weights_only=True, map_location="cpu")
    pilot.require(checkpoint["schemaVersion"] == "world-environment-humidity-checkpoint-v1", "candidate checkpoint schema mismatch")
    pilot.require(checkpoint["contractSha256"] == ref["trainingContractSha256"] and checkpoint["trainingDatasetSha256"] == ref["trainingDatasetSha256"] and checkpoint["parentCheckpointSha256"] == parent_sha, "candidate lineage mismatch")
    pilot.require(checkpoint["targetTransform"] == "raw_RH_other_columns150" and checkpoint["onlyFittedColumn"] == "RH2M" and checkpoint["fitCount"] == 1, "candidate target identity mismatch")
    model = checkpoint["model"]
    pilot.require(set(model) == {"weights", "inputMean", "inputStd", "targetMean", "targetStd"}, "candidate model fields mismatch")
    for name, value in model.items():
        shape = (29, 4) if name == "weights" else (4,)
        pilot.require(type(value) is torch.Tensor and tuple(value.shape) == shape and value.dtype == torch.float64 and value.device.type == "cpu" and bool(torch.isfinite(value).all()), "candidate tensor type/shape/domain mismatch")
    pilot.require(bool((model["inputStd"] > 0).all()) and bool((model["targetStd"] > 0).all()), "candidate normalizer invalid")
    return model


def criteria(evaluation, aggregates, rollouts):
    new, old = aggregates["candidate153"], aggregates["parent150"]
    candidate = evaluation["candidate153"]
    full7, full30 = new["7"]["fullCoverage"], new["30"]["fullCoverage"]
    return {"oneStepBetter": candidate["metrics"] is not None and candidate["metrics"]["meanNormalizedMAE"] < evaluation["persistence"]["meanNormalizedMAE"],
            "oneStepAndAblationGuards": not any(candidate["guardViolations"].values()) and not any(candidate["ablationGuardViolations"].values()),
            "all12CandidateThirtyDayRolloutsComplete": len(rollouts) == 12 and all(r["candidate153"]["completed30Days"] for r in rollouts),
            "sevenDayBetter": full7 and new["7"]["metrics"] is not None and new["7"]["metrics"]["meanNormalizedMAE"] < new["7"]["constantLastDay"]["meanNormalizedMAE"],
            "thirtyDayRhBetterThanParent": full30 and old["30"]["fullCoverage"] and new["30"]["metrics"] is not None and old["30"]["metrics"] is not None and new["30"]["metrics"]["perField"]["RH2M"]["MAE"] < old["30"]["metrics"]["perField"]["RH2M"]["MAE"],
            "thirtyDayBetterThanConstant": full30 and new["30"]["metrics"] is not None and new["30"]["metrics"]["meanNormalizedMAE"] < new["30"]["constantLastDay"]["meanNormalizedMAE"]}


def output_directory(value):
    base, path = EVIDENCE_ROOT.resolve(strict=True), Path(value).absolute()
    pilot.require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    pilot.require(parent == base or base in parent.parents, "output outside154 evidence root")
    cursor = path.parent
    while cursor.resolve() != base:
        pilot.require(not cursor.is_symlink() and not cursor.is_junction(), "linked output ancestor")
        cursor = cursor.parent
    path.mkdir()
    return path


def run(args):
    started, begin = pilot.utc_now(), time.monotonic()
    deadline = begin + 120
    output, state = output_directory(args.output_dir), {"bytes": 0}
    try:
        contract = pilot.read_bound(args.contract, args.contract_sha256)
        validate_contract(contract, args.contract_sha256)
        pilot.require(args.dataset_sha256 == DATASET_SHA256, "frozen154 dataset mismatch")
        for ref in contract["codeBindings"]:
            pilot.require(pilot.digest((pilot.ROOT / ref["path"]).read_bytes()) == ref["sha256"], "frozen dependency SHA mismatch")
        dataset = validate_dataset(pilot.read_bound(args.dataset, args.dataset_sha256))
        torch = pilot.configure_torch()
        parent = holdout.frozen_checkpoint(contract["parentCheckpoint"])
        parent_reload = holdout.frozen_checkpoint(contract["parentCheckpoint"])
        candidate = load_candidate(contract["candidateCheckpoint"], contract["parentCheckpoint"]["sha256"])
        candidate_reload = load_candidate(contract["candidateCheckpoint"], contract["parentCheckpoint"]["sha256"])
        pilot.require(all(torch.equal(parent[k], parent_reload[k]) and torch.equal(candidate[k], candidate_reload[k]) for k in parent), "checkpoint reload mismatch")
        pilot.require(humidity.verify_unchanged_columns(candidate, parent), "candidate unrelated columns or input normalization differ from parent")
        mean, std = candidate["inputMean"], candidate["inputStd"]
        bounds = [[contract["guards"][f]["minimum"], contract["guards"][f]["maximum"]] for f in pilot.FIELDS]
        windows = dataset["windows"]
        history = torch.tensor([w["history"] for w in windows], dtype=torch.float64)
        repeated = history[:, -1:, :].repeat(1, 7, 1)
        daily = {"candidate153": (humidity.predict(candidate, history), humidity.predict(candidate_reload, repeated)), "parent150": (wind.predict(parent, history), wind.predict(parent_reload, repeated))}
        pilot.require(torch.equal(daily["candidate153"][0], humidity.predict(candidate_reload, history)) and torch.equal(daily["parent150"][0], wind.predict(parent_reload, history)), "strict prediction reload mismatch")
        selected = select_origins(windows)
        pilot.require(len(selected) == 12, "monthly origin count mismatch")
        rollouts = []
        for origin in selected:
            new_result = wind.trajectory(lambda h: humidity.predict(candidate_reload, h), origin["history"], origin["targetDate"], bounds, deadline)
            old_result = wind.trajectory(lambda h: wind.predict(parent_reload, h), origin["history"], origin["targetDate"], bounds, deadline)
            rollouts.append({"split": "holdout2025", "originDate": origin["targetDate"], "initialHistoryDates": origin["historyDates"], "candidate153": new_result, "parent150": old_result})
        # Future truth is consulted only for scoring after both sets of trajectories terminate.
        truth = {w["targetDate"]: w["target"] for w in windows}
        target = torch.tensor([w["target"] for w in windows], dtype=torch.float64)
        evaluation = {"count": 358, "persistence": holdout.metrics(history[:, -1], target, std), "trainMean": holdout.metrics(mean.expand_as(target), target, std)}
        rows, failures = [], []
        for label, (prediction, ablated) in daily.items():
            evaluation[label] = {"metrics": holdout.metrics(prediction, target, std) if bool(torch.isfinite(prediction).all()) else None,
                                 "guardViolations": wind.guard_counts(prediction, bounds), "ablationGuardViolations": wind.guard_counts(ablated, bounds),
                                 "ablationMetrics": holdout.metrics(ablated, target, std) if bool(torch.isfinite(ablated).all()) else None,
                                 "meanAbsoluteAblationChange": wind.safe_values((ablated - prediction).abs().mean(0).tolist())}
        for i, window in enumerate(windows):
            row = {"targetDate": window["targetDate"], "target": window["target"], "persistence": window["history"][-1]}
            for label, (prediction, ablated) in daily.items():
                row[label] = {"prediction": wind.safe_values(prediction[i].tolist()), "historyAblated": wind.safe_values(ablated[i].tolist())}
                for kind, value, consumed in (("oneStep", prediction[i], window["history"]), ("ablation", ablated[i], [window["history"][-1]] * 7)):
                    reasons = wind.parent.guard_failures(value, bounds)
                    if reasons:
                        failures.append({"model": label, "kind": kind, "targetDate": window["targetDate"], "rawPrediction": wind.safe_values(value.tolist()), "inputHistory": consumed, "failures": reasons})
            rows.append(row)
        for rollout in rollouts:
            for label in daily:
                rollout[label]["scores"] = wind.score_trajectory(rollout[label], truth, std, mean)
        aggregates = {label: {str(h): wind.aggregate_rollouts(rollouts, label, "holdout2025", h, truth, std, mean) for h in (7, 30)} for label in daily}
        conditions = criteria(evaluation, aggregates, rollouts)
        predictions_ref = pilot.save_exclusive(output / "predictions.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "rows": rows, "guardFailures": failures}), state)
        rollouts_ref = pilot.save_exclusive(output / "rollouts.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "guards": bounds, "trajectories": rollouts}), state)
        for ref in contract["codeBindings"] + [contract["candidateCheckpoint"], contract["parentCheckpoint"], {"path": str(Path(args.dataset).resolve()), "sha256": args.dataset_sha256}, {"path": str(Path(args.contract).resolve()), "sha256": args.contract_sha256}]:
            pilot.require(pilot.digest((pilot.ROOT / ref["path"]).read_bytes()) == ref["sha256"], "frozen evaluation input changed")
        result = {"schemaVersion": "world-environment-holdout2025-result-v1", "taskId": "WORLD-ENVIRONMENT-HOLDOUT-154", "status": "evaluation_completed",
                  "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": 0, "trainingUpdates": 0,
                  "device": "cpu", "cpuThreads": 2, "dtype": "float64", "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256,
                  "candidateCheckpoint": contract["candidateCheckpoint"], "parentCheckpoint": contract["parentCheckpoint"],
                  "codeBindings": contract["codeBindings"] + [{"path": str(Path(__file__).resolve()), "sha256": pilot.digest(Path(__file__).read_bytes())}],
                  "sourceBinding": dataset["sourceBinding"], "normalizer": {"mean": mean.tolist(), "std": std.tolist(), "fittedOnHoldout": False},
                  "guards": contract["guards"], "oneStep": evaluation, "rolloutAggregates": aggregates, "originCount": 12, "passConditions": conditions,
                  "temporalHoldoutPassed": all(conditions.values()), "candidateAndParentStrictTwoLoadsIdentical": True, "unrelatedColumnsAndInputNormalizerUnchanged": True,
                  "inputAndCheckpointFilesUnchanged": True, "predictions": predictions_ref, "rollouts": rollouts_ref,
                  "exposureBoundary": contract["exposureBoundary"], "holdout2025ExposedByThisEvaluation": True,
                  "productionReady": False, "worldMemoryVerified": False, "worldStateWrites": 0,
                  "limitations": ["Same location/provider temporal evaluation only; no independent geography or total project-source isolation.",
                                  "Provider publication times unknown; retrospective completed-day hypothesis, not operational as-of availability.",
                                  "No fitting, normalizer recalculation or model selection in this evaluation.", "No whole-world, visual or world-memory qualification."], "artifactBytesBeforeResult": state["bytes"]}
        pilot.require(time.monotonic() < deadline, "evaluation wall budget exhausted")
        pilot.save_exclusive(output / "result.json", pilot.json_bytes(result), state)
        return {"status": result["status"], "outputDirectory": str(output), "fitCount": 0, "temporalHoldoutPassed": result["temporalHoldoutPassed"], "artifactBytes": state["bytes"], "productionReady": False}
    except Exception as error:
        pilot.save_exclusive(output / "failure.json", pilot.json_bytes({"taskId": "WORLD-ENVIRONMENT-HOLDOUT-154", "status": "failed", "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(),
                             "elapsedSeconds": time.monotonic() - begin, "fitCount": 0, "trainingUpdates": 0, "errorType": type(error).__name__, "error": str(error)[:2000], "worldStateWrites": 0, "productionReady": False}), state)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for field in ("dataset", "dataset-sha256", "contract", "contract-sha256", "output-dir"):
        parser.add_argument("--" + field, required=True)
    try:
        print(json.dumps(run(parser.parse_args()), ensure_ascii=False, allow_nan=False))
    except Exception as error:
        print(json.dumps({"status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000]}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

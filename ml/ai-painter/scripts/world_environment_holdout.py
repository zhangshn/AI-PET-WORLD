"""Frozen150 checkpoint evaluation on151 temporal holdout; no fitting allowed."""

import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import time

CONTRACT_SHA256 = "98ba8d178de741f94776a4c248e6912611cce1c7639ce957f1778dc75e616feb"
DATASET_SHA256 = "0bb927609b226177cb649e5cee0039f153be88e920c9cf2d15465462bcad2141"
WIND_SHA256 = "718d4736db582deb067c2fa57d375e94f1cc928d13b5ee81a9a6893c8d307e13"
WIND_PATH = Path(__file__).with_name("world_environment_stability_wind.py")
if hashlib.sha256(WIND_PATH.read_bytes()).hexdigest() != WIND_SHA256:
    raise ValueError("frozen150 dependency changed")
_spec = importlib.util.spec_from_file_location("wind151_dependency", WIND_PATH)
wind = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wind)
pilot = wind.pilot
EVIDENCE_ROOT = pilot.ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-holdout-151-20261029"


def validate_contract(contract, sha):
    pilot.require(sha == CONTRACT_SHA256, "only frozen151 evaluation contract supported")
    pilot.require(contract["schemaVersion"] == "world-environment-holdout-evaluation-v1" and contract["productionReady"] is False, "evaluation contract mismatch")


def validate_dataset(dataset):
    pilot.exact_keys(dataset, ["schemaVersion", "contractSha256", "sourceBinding", "fieldOrder", "units", "sourceDays", "windows", "splitSummary", "productionReady"])
    pilot.require(dataset["schemaVersion"] == "world-environment-holdout-dataset-v1" and dataset["contractSha256"] == CONTRACT_SHA256, "dataset identity mismatch")
    pilot.require(dataset["fieldOrder"] == pilot.FIELDS and dataset["units"] == pilot.UNITS, "field/unit mismatch")
    pilot.require(dataset["sourceDays"] == 366 and dataset["productionReady"] is False, "holdout coverage/production mismatch")
    pilot.require(type(dataset["sourceBinding"]) is dict and bool(dataset["sourceBinding"]), "missing source binding")
    pilot.require(type(dataset["windows"]) is list and len(dataset["windows"]) == 359, "holdout window count mismatch")
    dates = pilot.date_range("20240101", "20241231")
    seen = {}
    for index, window in enumerate(dataset["windows"], 7):
        pilot.exact_keys(window, ["split", "history", "target", "historyDates", "targetDate"])
        pilot.require(window["split"] == "holdout2024" and window["targetDate"] == dates[index], "holdout split/target order mismatch")
        pilot.require(window["historyDates"] == dates[index - 7:index], "future/cross-boundary/unordered history")
        pilot.require(type(window["history"]) is list and len(window["history"]) == 7, "history shape mismatch")
        for date, row in zip(window["historyDates"] + [window["targetDate"]], window["history"] + [window["target"]]):
            values = pilot.vector(row)
            if date in seen:
                pilot.require(seen[date] == values, "inconsistent date values")
            seen[date] = values
    pilot.require(sorted(seen) == dates, "holdout dates incomplete")
    return dataset


def select_origins(windows):
    selected, months = [], set()
    for window in windows:
        date = window["targetDate"]
        month = date[:6]
        last = (pilot.parse_date(date) + dt.timedelta(days=29)).strftime("%Y%m%d")
        if month not in months and last <= "20241231":
            pilot.require(window["split"] == "holdout2024" and "20240108" <= date <= "20241231", "origin outside holdout")
            months.add(month)
            selected.append({"split": "holdout2024", "targetDate": date, "history": window["history"], "historyDates": window["historyDates"]})
    return selected


def frozen_checkpoint(ref):
    torch = pilot.configure_torch()
    raw = wind.checkpoint_bytes(ref)
    result = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
    pilot.require(result["schemaVersion"] == "world-environment-wind-stability-checkpoint-v1", "checkpoint schema mismatch")
    pilot.require(result["contractSha256"] == ref["trainingContractSha256"] and result["datasetSha256"] == ref["trainingDatasetSha256"], "checkpoint training lineage mismatch")
    pilot.require(result["targetTransform"] == "rain_and_wind_inverse_softplus_others149" and result["fitCount"] == 1, "checkpoint model metadata mismatch")
    model = result["model"]
    pilot.require(set(model) == {"weights", "inputMean", "inputStd", "targetMean", "targetStd"}, "checkpoint model fields mismatch")
    for name, value in model.items():
        shape = (29, 4) if name == "weights" else (4,)
        pilot.require(type(value) is torch.Tensor and tuple(value.shape) == shape and value.dtype == torch.float64 and value.device.type == "cpu" and bool(torch.isfinite(value).all()), "checkpoint tensor type/shape/domain mismatch")
    pilot.require(bool((model["inputStd"] > 0).all()) and bool((model["targetStd"] > 0).all()), "invalid frozen normalizer")
    return model


def metrics(prediction, target, std):
    result = pilot.metrics(prediction, target, std)
    for i, field in enumerate(pilot.FIELDS):
        result["perField"][field]["bias"] = float((prediction[:, i] - target[:, i]).mean())
    return result


def output_directory(value):
    base, path = EVIDENCE_ROOT.resolve(strict=True), Path(value).absolute()
    pilot.require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    pilot.require(parent == base or base in parent.parents, "output outside151 evidence root")
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
        pilot.require(args.dataset_sha256 == DATASET_SHA256, "frozen151 dataset mismatch")
        bindings = contract["codeBindings"]
        for ref in bindings:
            pilot.require(pilot.digest((pilot.ROOT / ref["path"]).read_bytes()) == ref["sha256"], "frozen dependency SHA mismatch")
        dataset = validate_dataset(pilot.read_bound(args.dataset, args.dataset_sha256))
        torch = pilot.configure_torch()
        # Two independent reads and loads of the same immutable checkpoint.
        model, reloaded = frozen_checkpoint(contract["checkpoint"]), frozen_checkpoint(contract["checkpoint"])
        pilot.require(all(torch.equal(model[k], reloaded[k]) for k in model), "checkpoint reload tensors differ")
        mean, std = model["inputMean"], model["inputStd"]
        bounds = [[contract["guards"][field]["minimum"], contract["guards"][field]["maximum"]] for field in pilot.FIELDS]
        windows = dataset["windows"]
        history = torch.tensor([w["history"] for w in windows], dtype=torch.float64)
        predicted = wind.predict(model, history)
        pilot.require(torch.equal(predicted, wind.predict(reloaded, history)), "strict reload predictions differ")
        ablated = wind.predict(reloaded, history[:, -1:, :].repeat(1, 7, 1))
        selected = select_origins(windows)
        pilot.require(len(selected) == contract["origins"]["expected"], "monthly origin count mismatch")
        rollouts = []
        for origin in selected:
            result = wind.trajectory(lambda h: wind.predict(reloaded, h), origin["history"], origin["targetDate"], bounds, deadline)
            rollouts.append({"split": "holdout2024", "originDate": origin["targetDate"], "initialHistoryDates": origin["historyDates"], "frozen150": result})
        # All model trajectories have terminated before future target scoring.
        truth_map = {w["targetDate"]: w["target"] for w in windows}
        target = torch.tensor([w["target"] for w in windows], dtype=torch.float64)
        finite, ablated_finite = bool(torch.isfinite(predicted).all()), bool(torch.isfinite(ablated).all())
        evaluation = {"count": len(windows), "model": metrics(predicted, target, std) if finite else None, "persistence": metrics(history[:, -1], target, std),
                      "trainMean": metrics(mean.expand_as(target), target, std), "guardViolations": wind.guard_counts(predicted, bounds),
                      "ablationGuardViolations": wind.guard_counts(ablated, bounds), "historyAblation": {"metrics": metrics(ablated, target, std) if ablated_finite else None,
                      "meanAbsoluteOutputChange": wind.safe_values((ablated - predicted).abs().mean(0).tolist()), "worldMemoryVerified": False}}
        for rollout in rollouts:
            rollout["frozen150"]["scores"] = wind.score_trajectory(rollout["frozen150"], truth_map, std, mean)
        aggregate = {str(h): wind.aggregate_rollouts(rollouts, "frozen150", "holdout2024", h, truth_map, std, mean) for h in (7, 30)}
        conditions = {"oneStepBetter": finite and evaluation["model"]["meanNormalizedMAE"] < evaluation["persistence"]["meanNormalizedMAE"],
                      "oneStepAndAblationGuards": not any(evaluation["guardViolations"].values()) and not any(evaluation["ablationGuardViolations"].values()),
                      "all12ThirtyDayRolloutsComplete": all(r["frozen150"]["completed30Days"] for r in rollouts),
                      "sevenDayBetter": aggregate["7"]["fullCoverage"] and aggregate["7"]["metrics"]["meanNormalizedMAE"] < aggregate["7"]["constantLastDay"]["meanNormalizedMAE"]}
        rows, failures = [], []
        for i, window in enumerate(windows):
            rows.append({"targetDate": window["targetDate"], "target": window["target"], "model": wind.safe_values(predicted[i].tolist()),
                         "persistence": history[i, -1].tolist(), "historyAblated": wind.safe_values(ablated[i].tolist())})
            for label, values, consumed in (("oneStep", predicted[i], history[i].tolist()), ("historyAblation", ablated[i], history[i, -1:].repeat(7, 1).tolist())):
                reasons = wind.parent.guard_failures(values, bounds)
                if reasons:
                    failures.append({"kind": label, "targetDate": window["targetDate"], "rawPrediction": wind.safe_values(values.tolist()), "inputHistory": consumed, "failures": reasons})
        predictions_ref = pilot.save_exclusive(output / "predictions.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "rows": rows, "guardFailures": failures}), state)
        rollouts_ref = pilot.save_exclusive(output / "rollouts.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "guards": bounds, "trajectories": rollouts}), state)
        # Re-read fixed inputs and dependencies; evaluation cannot mutate their bytes.
        for ref in bindings + [{"path": str(Path(args.dataset).resolve()), "sha256": args.dataset_sha256}, {"path": str(Path(args.contract).resolve()), "sha256": args.contract_sha256}, contract["checkpoint"]]:
            pilot.require(pilot.digest((pilot.ROOT / ref["path"]).read_bytes()) == ref["sha256"], "protected evaluation input changed")
        result = {"schemaVersion": "world-environment-holdout-result-v1", "taskId": "WORLD-ENVIRONMENT-HOLDOUT-151", "status": "evaluation_completed",
                  "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": 0, "trainingUpdates": 0,
                  "device": "cpu", "cpuThreads": 2, "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256,
                  "checkpoint": contract["checkpoint"], "codeBindings": bindings + [{"path": str(Path(__file__).resolve()), "sha256": pilot.digest(Path(__file__).read_bytes())}],
                  "sourceBinding": dataset["sourceBinding"], "normalization": "immutable150_checkpoint_inputMean/inputStd; no holdout fitting",
                  "normalizer": {"mean": mean.tolist(), "std": std.tolist()}, "guards": contract["guards"], "oneStep": evaluation,
                  "rolloutAggregates": aggregate, "originCount": len(rollouts), "passConditions": conditions, "temporalHoldoutPassed": all(conditions.values()),
                  "strictTwoCheckpointLoadsIdentical": True, "inputAndCheckpointFilesUnchanged": True, "predictions": predictions_ref, "rollouts": rollouts_ref,
                  "exposureBoundary": contract["exposureBoundary"], "holdout2024ExposedByThisEvaluation": True,
                  "productionReady": False, "worldMemoryVerified": False, "worldStateWrites": 0,
                  "limitations": ["Only temporal transfer at the same location/provider; not independent geography or complete project-source isolation.",
                                  "Provider publication times are unknown: completed-day inputs are a retrospective assumption, not verified operational as-of availability.",
                                  "No parameter fitting or checkpoint selection in this evaluation.", "Weather prediction and guard stability do not certify world memory, runtime publication or autonomous world integration."],
                  "artifactBytesBeforeResult": state["bytes"]}
        pilot.require(time.monotonic() < deadline, "evaluation wall budget exhausted")
        pilot.save_exclusive(output / "result.json", pilot.json_bytes(result), state)
        return {"status": result["status"], "outputDirectory": str(output), "fitCount": 0, "temporalHoldoutPassed": result["temporalHoldoutPassed"], "artifactBytes": state["bytes"], "productionReady": False}
    except Exception as error:
        pilot.save_exclusive(output / "failure.json", pilot.json_bytes({"taskId": "WORLD-ENVIRONMENT-HOLDOUT-151", "status": "failed", "startedAtUtc": started,
                             "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": 0, "trainingUpdates": 0,
                             "errorType": type(error).__name__, "error": str(error)[:2000], "worldStateWrites": 0, "productionReady": False}), state)
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

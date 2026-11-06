"""One frozen CPU ridge comparison, using already-exposed temporal holdouts."""

import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import time


CONTRACT_SHA256 = "9f7d11afda8045474349b476ea50c70e6e14c5dbbe6d5b481998dde5684dc7ab"
PILOT_SHA256 = "d77135fec15215cea671f3b949ff92cb62fa61b6c81db82f4ddb33317dd07a51"
PILOT_PATH = Path(__file__).with_name("world_environment_pilot.py")
if hashlib.sha256(PILOT_PATH.read_bytes()).hexdigest() != PILOT_SHA256:
    raise ValueError("frozen147 dependency changed")
_spec = importlib.util.spec_from_file_location("environment_pilot148_dependency", PILOT_PATH)
pilot = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pilot)
EVIDENCE_ROOT = pilot.ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-comparison-148-20261029"


def validate_contract(contract, sha):
    pilot.require(sha == CONTRACT_SHA256, "only frozen148 contract supported")
    pilot.require(contract.get("schemaVersion") == "world-environment-ridge-comparison-v1", "comparison schema mismatch")
    pilot.require(contract["model"]["alpha"] == 10.0 and contract["productionReady"] is False, "comparison settings mismatch")


def transform_targets(targets):
    torch = pilot.configure_torch()
    pilot.require(targets.dtype == torch.float64 and targets.ndim == 2 and targets.shape[1] == 4, "target tensor shape/dtype mismatch")
    pilot.require(bool(torch.isfinite(targets).all()) and not any(pilot.physical_violations(targets).values()), "invalid target domain")
    return torch.stack((torch.log(targets[:, 0] + 1e-6), torch.log((targets[:, 1] + 1e-6) / (100 - targets[:, 1] + 1e-6)), targets[:, 2], torch.log(targets[:, 3] + 1e-6)), dim=1)


def inverse_targets(transformed):
    torch = pilot.configure_torch()
    return torch.stack((torch.exp(transformed[:, 0]), 100 * torch.sigmoid(transformed[:, 1]), transformed[:, 2], torch.exp(transformed[:, 3])), dim=1)


def target_normalizer(train_targets):
    transformed = transform_targets(train_targets)
    return transformed.mean(0), transformed.std(0, unbiased=False).clamp_min(1e-6)


def design(history, mean, std):
    torch = pilot.configure_torch()
    pilot.require(history.dtype == torch.float64 and history.ndim == 3 and tuple(history.shape[1:]) == (7, 4), "history tensor shape/dtype mismatch")
    features = ((history - mean) / std).flatten(1)
    return torch.cat((features, torch.ones(features.shape[0], 1, dtype=torch.float64)), dim=1)


def fit_ridge(history, targets, input_mean, input_std):
    torch = pilot.configure_torch()
    target_mean, target_std = target_normalizer(targets)
    x = design(history, input_mean, input_std)
    y = (transform_targets(targets) - target_mean) / target_std
    penalty = torch.eye(29, dtype=torch.float64) * 10.0
    penalty[-1, -1] = 0.0
    weights = torch.linalg.solve(x.T @ x + penalty, x.T @ y)
    pilot.require(bool(torch.isfinite(weights).all()), "nonfinite ridge weights")
    return {"weights": weights, "inputMean": input_mean, "inputStd": input_std, "targetMean": target_mean, "targetStd": target_std}


def predict(model, history):
    transformed = (design(history, model["inputMean"], model["inputStd"]) @ model["weights"]) * model["targetStd"] + model["targetMean"]
    return inverse_targets(transformed)


def output_directory(value):
    base = EVIDENCE_ROOT.resolve(strict=True)
    path = Path(value).absolute()
    pilot.require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    pilot.require(parent == base or base in parent.parents, "output outside148 evidence root")
    cursor = path.parent
    while cursor.resolve() != base:
        pilot.require(not cursor.is_symlink() and not cursor.is_junction(), "linked output ancestor")
        cursor = cursor.parent
    path.mkdir()
    return path


def run(args):
    started, begin = pilot.utc_now(), time.monotonic()
    output = output_directory(args.output_dir)
    state = {"bytes": 0}
    fit_count = 0
    try:
        contract = pilot.read_bound(args.contract, args.contract_sha256)
        validate_contract(contract, args.contract_sha256)
        pilot.require(args.dataset_sha256 == contract["dataset"]["sha256"], "frozen dataset identity mismatch")
        parent_ref = contract["parentExperiment"]
        parent = pilot.read_bound(pilot.ROOT / parent_ref["path"], parent_ref["sha256"])
        pilot.validate_contract(parent, parent_ref["sha256"])
        dataset = pilot.validate_dataset(pilot.read_bound(args.dataset, args.dataset_sha256), parent_ref["sha256"])
        torch = pilot.configure_torch()
        mean, std = pilot.fit_normalizer(dataset["trainDays"])
        train = [w for w in dataset["windows"] if w["split"] == "train"]
        train_history = torch.tensor([w["history"] for w in train], dtype=torch.float64, device="cpu")
        train_targets = torch.tensor([w["target"] for w in train], dtype=torch.float64, device="cpu")
        pilot.require(time.monotonic() - begin < 120, "comparison wall budget exhausted")
        fit_count = 1
        model = fit_ridge(train_history, train_targets, mean, std)
        checkpoint = {"schemaVersion": "world-environment-ridge-checkpoint-v1", "model": model, "contractSha256": args.contract_sha256,
                      "datasetSha256": args.dataset_sha256, "dtype": "float64", "alpha": 10.0, "fitCount": fit_count}
        buffer = io.BytesIO()
        torch.save(checkpoint, buffer)
        checkpoint_ref = pilot.save_exclusive(output / "checkpoint.pt", buffer.getvalue(), state)
        loaded = torch.load(output / "checkpoint.pt", weights_only=True, map_location="cpu")
        pilot.require(loaded["contractSha256"] == args.contract_sha256 and loaded["datasetSha256"] == args.dataset_sha256, "checkpoint provenance mismatch")
        pilot.require(loaded["model"].keys() == model.keys() and all(torch.equal(v, loaded["model"][k]) for k, v in model.items()), "checkpoint tensor mismatch")
        evaluations, rows = {}, []
        for split in pilot.SPLITS:
            pilot.require(time.monotonic() - begin < 120, "comparison wall budget exhausted")
            windows = [w for w in dataset["windows"] if w["split"] == split]
            history = torch.tensor([w["history"] for w in windows], dtype=torch.float64, device="cpu")
            target = torch.tensor([w["target"] for w in windows], dtype=torch.float64, device="cpu")
            predicted = predict(model, history)
            pilot.require(torch.equal(predicted, predict(loaded["model"], history)), "strict reload predictions differ")
            pilot.require(bool(torch.isfinite(predicted).all()), "nonfinite inverse-transform prediction")
            ablated = predict(loaded["model"], history[:, -1:, :].repeat(1, 7, 1))
            pilot.require(bool(torch.isfinite(ablated).all()), "nonfinite ablation prediction")
            evaluations[split] = {"count": len(windows), "previouslyExposed": True, "model": pilot.metrics(predicted, target, std),
                                  "persistence": pilot.metrics(history[:, -1, :], target, std), "trainMean": pilot.metrics(mean.expand_as(target), target, std),
                                  "physicalViolations": pilot.physical_violations(predicted), "historyAblation": {"metrics": pilot.metrics(ablated, target, std),
                                  "meanAbsoluteOutputChange": (ablated - predicted).abs().mean(0).tolist(), "currentDayUnchanged": True, "worldMemoryVerified": False}}
            for i, window in enumerate(windows):
                rows.append({"split": split, "targetDate": window["targetDate"], "target": target[i].tolist(), "model": predicted[i].tolist(),
                             "persistence": history[i, -1].tolist(), "trainMean": mean.tolist(), "historyAblated": ablated[i].tolist()})
        passed = all(evaluations[s]["model"]["meanNormalizedMAE"] < evaluations[s]["persistence"]["meanNormalizedMAE"] for s in ("validation", "test")) and all(not any(e["physicalViolations"].values()) for e in evaluations.values())
        predictions_ref = pilot.save_exclusive(output / "predictions.json", pilot.json_bytes({"fieldOrder": pilot.FIELDS, "units": pilot.UNITS, "rows": rows}), state)
        result = {"schemaVersion": "world-environment-ridge-comparison-result-v1", "taskId": "WORLD-ENVIRONMENT-COMPARISON-148", "status": "experiment_completed",
                  "startedAtUtc": started, "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitCount": fit_count,
                  "device": "cpu", "cpuThreads": 2, "dtype": "float64", "alpha": 10.0, "parameterCount": 116, "interceptPenalty": 0.0,
                  "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256, "sourceBinding": dataset["sourceBinding"],
                  "codeBindings": [{"path": str(p.resolve()), "sha256": pilot.digest(p.read_bytes())} for p in [Path(__file__), PILOT_PATH]],
                  "runtime": {"python": sys.version, "torch": torch.__version__},
                  "normalizer": {"inputMean": mean.tolist(), "inputStd": std.tolist(), "trainingDayCount": len(dataset["trainDays"]),
                                 "targetMean": model["targetMean"].tolist(), "targetStd": model["targetStd"].tolist(), "trainingTargetCount": len(train), "usesHoldout": False},
                  "evaluations": evaluations, "checkpoint": checkpoint_ref, "predictions": predictions_ref, "strictCpuReloadIdentical": True,
                  "developmentComparisonPassed": passed, "decision": "further_isolated_evaluation_only" if passed else "rejected_for_production_followup",
                  "testPreviouslyExposed": True, "productionReady": False, "worldMemoryVerified": False, "worldStateWrites": 0,
                  "limitations": ["Comparison informed by147 failure; test previously exposed, not independent validation.",
                                  "Positive inverse transforms approximate zero by epsilon; not hidden clipping.",
                                  "One-step retrospective regional meteorology does not qualify autonomous rollout, vegetation or world memory.",
                                  "Passing the development comparison does not grant capability publication or production access."], "artifactBytesBeforeResult": state["bytes"]}
        pilot.require(time.monotonic() - begin < 120, "comparison wall budget exhausted")
        pilot.save_exclusive(output / "result.json", pilot.json_bytes(result), state)
        return {"status": result["status"], "outputDirectory": str(output), "fitCount": fit_count, "developmentComparisonPassed": passed, "artifactBytes": state["bytes"], "productionReady": False}
    except Exception as error:
        pilot.save_exclusive(output / "failure.json", pilot.json_bytes({"taskId": "WORLD-ENVIRONMENT-COMPARISON-148", "status": "failed", "startedAtUtc": started,
                              "finishedAtUtc": pilot.utc_now(), "elapsedSeconds": time.monotonic() - begin, "fitAttempts": fit_count,
                              "errorType": type(error).__name__, "error": str(error)[:2000], "productionReady": False, "worldStateWrites": 0}), state)
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

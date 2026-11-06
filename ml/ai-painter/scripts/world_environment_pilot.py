"""Bounded, retrospective CPU learning experiment; never a world-state writer."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sys
import time


CONTRACT_SHA256 = "170899620754fdf3ec9bca0b19373ac83232e17379d27dd6a4efa30178d0ddbd"
FIELDS = ["PRECTOTCORR", "RH2M", "T2M", "WS2M"]
UNITS = ["mm/day", "%", "C", "m/s"]
MAX_BYTES = 8 * 1024 * 1024
SPLITS = {"train": ("20200101", "20211231"), "validation": ("20220101", "20221231"), "test": ("20230101", "20231231")}
COUNTS = {"train": 724, "validation": 358, "test": 358}
ROOT = Path(__file__).resolve().parents[3]
EVIDENCE_ROOT = ROOT / ".runtime/ai-painter/controller-repair-reviews/world-environment-pilot-147-20261029"
_torch_configured = False


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")


def parse_date(value):
    require(isinstance(value, str) and len(value) == 8 and value.isascii() and value.isdigit(), "invalid date")
    result = dt.datetime.strptime(value, "%Y%m%d").date()
    require(result.strftime("%Y%m%d") == value, "noncanonical date")
    return result


def date_range(start, end):
    first, last = parse_date(start), parse_date(end)
    return [(first + dt.timedelta(days=i)).strftime("%Y%m%d") for i in range((last - first).days + 1)]


def exact_keys(value, required, optional=()):
    require(type(value) is dict and set(required) <= value.keys() and value.keys() <= set(required) | set(optional), "missing or unknown schema field")


def strict_json(raw):
    def pairs(items):
        out = {}
        for key, value in items:
            require(key not in out, "duplicate JSON key")
            out[key] = value
        return out

    return json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite JSON constant")))


def read_bound(path, expected_sha):
    path = Path(path)
    require(len(expected_sha) == 64 and all(c in "0123456789abcdef" for c in expected_sha), "invalid expected SHA")
    require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1, "input must be a regular nonlinked file")
    with path.open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    require(0 < len(raw) <= MAX_BYTES, "input byte bound exceeded")
    require(digest(raw) == expected_sha, "input SHA mismatch")
    return strict_json(raw)


def validate_contract(contract, expected_sha):
    require(expected_sha == CONTRACT_SHA256, "only frozen experiment147 contract supported")
    require(contract.get("schemaVersion") == "world-environment-pilot-experiment-v1", "contract schema mismatch")
    require(contract.get("productionReady") is False, "experiment cannot grant production status")
    # The exact raw-byte SHA above binds every frozen hyperparameter and budget.
    require(contract["model"]["updates"] == 600 and contract["resources"]["cpuThreads"] == 2, "unsupported execution contract")


def vector(value):
    require(type(value) is list and len(value) == 4, "expected four-variable vector")
    require(all(type(x) in (int, float) and math.isfinite(x) for x in value), "invalid/nonfinite numeric input")
    require(value[0] >= 0 and 0 <= value[1] <= 100 and value[2] >= -273.15 and value[3] >= 0, "source physical range violation")
    return tuple(value)


def validate_dataset(dataset, contract_sha):
    exact_keys(dataset, ["schemaVersion", "contractSha256", "sourceBinding", "fieldOrder", "units", "trainDays", "trainDates", "windows"],
               ["sourceQualification", "sourceDays", "splitSummary", "preparationCodeBindings", "productionReady"])
    require(dataset["schemaVersion"] == "world-environment-pilot-dataset-v1" and dataset["contractSha256"] == contract_sha, "dataset identity mismatch")
    require(dataset["fieldOrder"] == FIELDS and dataset["units"] == UNITS, "field/unit order mismatch")
    require(type(dataset["sourceBinding"]) is dict and bool(dataset["sourceBinding"]), "source binding missing")
    require(dataset.get("productionReady", False) is False, "dataset cannot claim production ready")
    train_dates = date_range(*SPLITS["train"])
    require(dataset["trainDates"] == train_dates and type(dataset["trainDays"]) is list and len(dataset["trainDays"]) == len(train_dates), "training normalization dates mismatch")
    day_values = {date: vector(values) for date, values in zip(train_dates, dataset["trainDays"])}
    require(type(dataset["windows"]) is list and len(dataset["windows"]) == sum(COUNTS.values()), "window count mismatch")
    expected_order = [(split, date) for split, span in SPLITS.items() for date in date_range(*span)[7:]]
    for window, (split, target) in zip(dataset["windows"], expected_order):
        exact_keys(window, ["split", "history", "target", "historyDates", "targetDate"])
        require(window["split"] == split and window["targetDate"] == target, "split/target sequence mismatch")
        target_day = parse_date(target)
        history_dates = [(target_day - dt.timedelta(days=i)).strftime("%Y%m%d") for i in range(7, 0, -1)]
        require(window["historyDates"] == history_dates, "future, missing, duplicate or unordered history")
        require(type(window["history"]) is list and len(window["history"]) == 7, "history shape mismatch")
        for date, values in zip(history_dates + [target], window["history"] + [window["target"]]):
            require(SPLITS[split][0] <= date <= SPLITS[split][1], "cross-split history or target")
            values = vector(values)
            if date in day_values:
                require(day_values[date] == values, "same source date has inconsistent values")
            else:
                day_values[date] = values
    return dataset


def configure_torch():
    global _torch_configured
    import torch
    if not _torch_configured:
        torch.set_num_threads(2)
        torch.set_num_interop_threads(2)
        torch.use_deterministic_algorithms(True)
        _torch_configured = True
    require(torch.get_num_threads() == 2, "CPU thread contract mismatch")
    return torch


def fit_normalizer(train_days):
    torch = configure_torch()
    values = torch.tensor(train_days, dtype=torch.float64, device="cpu")
    return values.mean(dim=0), values.std(dim=0, unbiased=False).clamp_min(1e-6)


def make_model():
    torch = configure_torch()

    class ResidualModel(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.hidden = torch.nn.Linear(28, 32, device="cpu")
            self.output = torch.nn.Linear(32, 4, device="cpu")

        def forward(self, history):
            return history[:, -1, :] + self.output(torch.tanh(self.hidden(history.flatten(1))))

    return ResidualModel()


def tensors(windows, mean, std):
    torch = configure_torch()
    history = torch.tensor([w["history"] for w in windows], dtype=torch.float64, device="cpu")
    targets = torch.tensor([w["target"] for w in windows], dtype=torch.float64, device="cpu")
    return ((history - mean) / std).to(torch.float32), ((targets - mean) / std).to(torch.float32), history, targets


def train_updates(model, history, targets, updates, deadline, trace=None):
    """Small test fixtures may call this primitive; the CLI always uses 600."""
    torch = configure_torch()
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.0001)
    trace = [] if trace is None else trace
    model.train()
    for step in range(1, updates + 1):
        require(time.monotonic() < deadline, "training wall budget exhausted")
        optimizer.zero_grad(set_to_none=True)
        loss = torch.mean((model(history) - targets) ** 2)
        require(bool(torch.isfinite(loss)), "nonfinite training loss")
        loss.backward()
        require(all(p.grad is not None and bool(torch.isfinite(p.grad).all()) for p in model.parameters()), "nonfinite/missing gradient")
        optimizer.step()
        require(all(bool(torch.isfinite(p).all()) for p in model.parameters()), "nonfinite model parameter")
        trace.append({"update": step, "trainingNormalizedMSEBeforeUpdate": float(loss.detach())})
    model.eval()
    return trace


def metrics(prediction, target, std):
    torch = configure_torch()
    error = prediction - target
    return {"perField": {name: {"unit": UNITS[i], "MAE": float(error[:, i].abs().mean()), "RMSE": float(torch.sqrt((error[:, i] ** 2).mean()))} for i, name in enumerate(FIELDS)},
            "meanNormalizedMAE": float((error.abs() / std).mean())}


def physical_violations(prediction):
    torch = configure_torch()
    tests = [prediction[:, 0] < 0, (prediction[:, 1] < 0) | (prediction[:, 1] > 100), prediction[:, 2] < -273.15, prediction[:, 3] < 0]
    return {field: int((tests[i] | ~torch.isfinite(prediction[:, i])).sum()) for i, field in enumerate(FIELDS)}


def save_exclusive(path, raw, output_state):
    require(output_state["bytes"] + len(raw) <= MAX_BYTES, "output byte budget exceeded")
    with path.open("xb") as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    output_state["bytes"] += len(raw)
    return {"path": str(path), "bytes": len(raw), "sha256": digest(raw)}


def new_output_directory(value):
    base = EVIDENCE_ROOT.resolve(strict=True)
    path = Path(value).absolute()
    require(not path.exists(), "output directory must be new")
    parent = path.parent.resolve(strict=True)
    require(parent == base or base in parent.parents, "output outside experiment evidence root")
    # .runtime itself is a registered mount; no descendant link is accepted.
    cursor = path.parent
    while cursor.resolve() != base:
        require(not cursor.is_symlink() and not cursor.is_junction(), "linked output ancestor")
        cursor = cursor.parent
    path.mkdir()
    return path


def run(args):
    started, start_mono = utc_now(), time.monotonic()
    deadline = start_mono + 180
    output = new_output_directory(args.output_dir)
    output_state = {"bytes": 0}
    actual_updates = 0
    trace = []
    try:
        contract = read_bound(args.contract, args.contract_sha256)
        validate_contract(contract, args.contract_sha256)
        dataset = validate_dataset(read_bound(args.dataset, args.dataset_sha256), args.contract_sha256)
        torch = configure_torch()
        torch.random.default_generator.manual_seed(147)
        mean, std = fit_normalizer(dataset["trainDays"])
        model = make_model()
        initial = {name: value.detach().clone() for name, value in model.state_dict().items()}
        train_windows = [w for w in dataset["windows"] if w["split"] == "train"]
        history, targets, _, _ = tensors(train_windows, mean, std)
        train_updates(model, history, targets, 600, deadline, trace)
        actual_updates = len(trace)
        require(any(not torch.equal(initial[name], value) for name, value in model.state_dict().items()), "training produced unchanged parameters")
        checkpoint = {"schemaVersion": "world-environment-pilot-checkpoint-v1", "state_dict": model.state_dict(), "mean": mean, "std": std,
                      "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256, "actualUpdates": actual_updates,
                      "modelFamily": "residual_mlp_28_32_4_tanh_last_day", "seed": 147}
        buffer = io.BytesIO()
        torch.save(checkpoint, buffer)
        checkpoint_ref = save_exclusive(output / "checkpoint.pt", buffer.getvalue(), output_state)
        loaded = torch.load(output / "checkpoint.pt", map_location="cpu", weights_only=True)
        require(loaded["contractSha256"] == args.contract_sha256 and loaded["datasetSha256"] == args.dataset_sha256, "checkpoint provenance mismatch")
        restored = make_model()
        restored.load_state_dict(loaded["state_dict"], strict=True)
        restored.eval()
        require(torch.equal(loaded["mean"], mean) and torch.equal(loaded["std"], std), "normalizer reload mismatch")
        evaluations, predictions = {}, []
        with torch.no_grad():
            for split in SPLITS:
                require(time.monotonic() < deadline, "evaluation wall budget exhausted")
                windows = [w for w in dataset["windows"] if w["split"] == split]
                x, _, raw_history, target = tensors(windows, mean, std)
                normalized = model(x)
                require(torch.equal(normalized, restored(x)), "strict CPU reload prediction mismatch")
                prediction = normalized.to(torch.float64) * std + mean
                require(bool(torch.isfinite(prediction).all()), "nonfinite model output")
                ablated_x = x[:, -1:, :].repeat(1, 7, 1)
                ablated = restored(ablated_x).to(torch.float64) * std + mean
                require(bool(torch.isfinite(ablated).all()), "nonfinite ablation output")
                evaluations[split] = {"count": len(windows), "model": metrics(prediction, target, std),
                                      "persistence": metrics(raw_history[:, -1, :], target, std), "trainMean": metrics(mean.expand_as(target), target, std),
                                      "physicalViolations": physical_violations(prediction),
                                      "historyAblation": {"metrics": metrics(ablated, target, std), "meanAbsoluteOutputChange": (ablated - prediction).abs().mean(0).tolist(),
                                                          "currentDayUnchanged": True, "worldMemoryVerified": False}}
                for i, window in enumerate(windows):
                    predictions.append({"split": split, "targetDate": window["targetDate"], "target": target[i].tolist(), "model": prediction[i].tolist(),
                                        "persistence": raw_history[i, -1].tolist(), "trainMean": mean.tolist(), "historyAblated": ablated[i].tolist()})
        feasible = all(evaluations[s]["model"]["meanNormalizedMAE"] < evaluations[s]["persistence"]["meanNormalizedMAE"] for s in ("validation", "test")) and all(sum(e["physicalViolations"].values()) == 0 for e in evaluations.values())
        prediction_ref = save_exclusive(output / "predictions.json", json_bytes({"fieldOrder": FIELDS, "units": UNITS, "rows": predictions}), output_state)
        trace_ref = save_exclusive(output / "training-trace.json", json_bytes(trace), output_state)
        result = {"schemaVersion": "world-environment-pilot-result-v1", "taskId": "WORLD-ENVIRONMENT-PILOT-147", "status": "experiment_completed",
                  "startedAtUtc": started, "finishedAtUtc": utc_now(), "elapsedSeconds": time.monotonic() - start_mono,
                  "actualUpdates": actual_updates, "device": "cpu", "cpuThreads": 2, "seed": 147, "parameterCount": sum(p.numel() for p in model.parameters()),
                  "contractSha256": args.contract_sha256, "datasetSha256": args.dataset_sha256, "sourceBinding": dataset["sourceBinding"],
                  "codeBinding": {"path": str(Path(__file__).resolve()), "sha256": digest(Path(__file__).read_bytes())},
                  "runtime": {"python": sys.version, "torch": torch.__version__, "deterministicAlgorithms": True},
                  "normalizer": {"mean": mean.tolist(), "std": std.tolist(), "trainingDayCount": len(dataset["trainDays"]), "usesHoldout": False},
                  "evaluations": evaluations, "strictCpuReloadIdentical": True, "feasibilityRuleSatisfied": feasible,
                  "decision": "feasible_for_further_isolated_validation" if feasible else "rejected_for_production_followup",
                  "productionReady": False, "capabilityReleased": False, "worldStateWrites": 0, "worldMemoryVerified": False,
                  "checkpoint": checkpoint_ref, "predictions": prediction_ref, "trainingTrace": trace_ref,
                  "limitations": ["Regional gridded retrospective meteorology, not operational as-of forecast.", "One-step teacher-forced prediction is not autonomous rollout.",
                                  "Ablation demonstrates sensitivity only, not useful world memory.", "Test metrics are exposed by this experiment; no subsequent untouched-test claim.",
                                  "No vegetation, soil, world-state or visual ability is qualified."]}
        require(time.monotonic() < deadline, "total experiment wall budget exhausted")
        result["artifactBytesBeforeResult"] = output_state["bytes"]
        save_exclusive(output / "result.json", json_bytes(result), output_state)
        return {"status": result["status"], "outputDirectory": str(output), "actualUpdates": actual_updates, "feasibilityRuleSatisfied": feasible, "productionReady": False, "artifactBytes": output_state["bytes"]}
    except Exception as error:
        failure = {"taskId": "WORLD-ENVIRONMENT-PILOT-147", "status": "failed", "startedAtUtc": started, "finishedAtUtc": utc_now(),
                   "elapsedSeconds": time.monotonic() - start_mono, "completedUpdatesKnown": len(trace),
                   "errorType": type(error).__name__, "error": str(error)[:2000], "productionReady": False, "worldStateWrites": 0}
        if trace and not (output / "training-trace.json").exists():
            save_exclusive(output / "training-trace.json", json_bytes(trace), output_state)
        save_exclusive(output / "failure.json", json_bytes(failure), output_state)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("dataset", "dataset-sha256", "contract", "contract-sha256", "output-dir"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(run(args), ensure_ascii=False, allow_nan=False))
    except Exception as error:
        print(json.dumps({"status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000]}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

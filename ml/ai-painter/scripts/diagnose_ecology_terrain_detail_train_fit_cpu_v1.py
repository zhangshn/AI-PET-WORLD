"""One bounded, CPU-only fit observation of an existing terrain checkpoint.

This diagnostic does not select a checkpoint, train, publish, or rerun review.
The caller supplies the existing native Job supervisor and immutable request.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import statistics
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/diagnose_ecology_terrain_detail_train_fit_cpu_v1.py"
RUN = "terrain-detail-quality-v2-619740d4-4192-49b9-ae23-7d7083f1e95d"
OUTPUT = ".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/terrain-train-fit-v1"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
LIMITS = {"attempts": 1, "automaticRetries": 0, "cpuThreads": 2,
          "maxWallSeconds": 240, "maxGeneratorForwards": 48,
          "maxOutputMiB": 8, "optimizerSteps": 0, "autogradCalls": 0,
          "cudaInitialization": False, "validationReinference": False}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def validate_request(request):
    require(type(request) is dict and request.get("schemaVersion") ==
            "terrain-train-fit-readonly-request-v1", "request schema differs")
    require(request.get("runId") == RUN and request.get("outputRoot") == OUTPUT,
            "exact diagnostic Run/output required")
    require(request.get("limits") == LIMITS, "readonly diagnostic limits differ")
    require(request.get("trainingAllowed") is False and
            request.get("qualificationGranted") is False, "no training/qualification")
    for key in ("qualityPlan", "workerTerminal", "cpuReview", "executionPackage",
                "checkpoint", "adapter"):
        binding = request.get(key)
        require(type(binding) is dict and set(binding) == {"path", "sha256"}
                and type(binding["path"]) is str and type(binding["sha256"]) is str
                and len(binding["sha256"]) == 64
                and all(c in "0123456789abcdef" for c in binding["sha256"]),
                "invalid input binding: " + key)
    require(request["adapter"]["path"] == SELF, "own adapter binding differs")
    return request


def summarize(rows):
    require(len(rows) == 48 and len({r["sampleId"] for r in rows}) == 48,
            "complete unique48 train rows required")
    require(all(r.get("split") == "train" for r in rows), "train rows only")
    require(all(type(r["fullRgbMae"]) in (float, int) and
                math.isfinite(r["fullRgbMae"]) and 0 <= r["fullRgbMae"] <= 1
                for r in rows), "invalid train RGB metric")
    result = {}
    for role in ROLES:
        values = [r["objectCorrelations"].get(role) for r in rows]
        valid = [v for v in values if v is not None]
        require(all(type(v) in (float, int) and math.isfinite(v) and -1 <= v <= 1
                    for v in valid), "invalid object correlation")
        result[role] = {"applicableCount": len(valid),
                        "negativeOrZeroCount": sum(v <= 0 for v in valid),
                        "meanCorrelation": statistics.mean(valid) if valid else None,
                        "medianCorrelation": statistics.median(valid) if valid else None,
                        "minimumCorrelation": min(valid) if valid else None,
                        "maximumCorrelation": max(valid) if valid else None}
    return {"sampleCount": 48, "meanRgbMae": statistics.mean(r["fullRgbMae"] for r in rows),
            "medianRgbMae": statistics.median(r["fullRgbMae"] for r in rows),
            "roles": result}


def run(request_binding):
    started = time.monotonic()
    for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
        sys.path.insert(0, str(directory))
    import ecology_terrain_detail_weight_quality_auth_v1 as auth
    import painter_stage4_ecology_terrain_detail_weight_quality_worker_v1 as worker
    reader = auth.Reader(ROOT)
    request = validate_request(auth.read_json(reader, request_binding))
    reader.read(request["adapter"], auth.PROGRAM_MAX)
    output = reader.path(OUTPUT)
    output.mkdir(exist_ok=False)
    rows, calls = [], {"generatorForwards": 0, "autogradCalls": 0,
                       "optimizerConstruction": 0, "optimizerSteps": 0,
                       "cudaInitializationAttempts": 0}

    def resource():
        require(time.monotonic() - started < 239, "CPU observation wall budget")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file())
                < 7 * 1024**2, "CPU evidence reserve exhausted")

    def publish(name, value):
        raw = (json.dumps(value, sort_keys=True, allow_nan=False) + "\n").encode()
        require(len(raw) < 1024**2, "diagnostic JSON ceiling")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file()) + len(raw)
                <= 8 * 1024**2, "diagnostic output ceiling")
        with (output / name).open("xb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())

    def event(stage, **extra):
        resource()
        value = {"recordedAtUtc": datetime.now(timezone.utc).isoformat(),
                 "stage": stage, "completedTrainRows": len(rows), **extra}
        with (output / "events.jsonl").open("ab") as stream:
            stream.write((json.dumps(value, allow_nan=False) + "\n").encode())
            stream.flush()

    def forbidden(counter):
        def reject(*args, **kwargs):
            calls[counter] += 1
            raise ValueError("readonly operation prohibited: " + counter)
        return reject

    try:
        publish("claim.json", {"request": request_binding, "runId": RUN,
                               "attempts": 1, "automaticRetries": 0})
        torch, profile, shared = worker.runtime()
        torch.set_num_threads(2)
        torch.set_num_interop_threads(2)
        require(not torch.cuda.is_initialized(), "CUDA already initialized")
        with ExitStack() as guards:
            for owner, name, counter in ((torch.cuda, "_lazy_init", "cudaInitializationAttempts"),
                    (torch.autograd, "grad", "autogradCalls"),
                    (torch.autograd, "backward", "autogradCalls"),
                    (torch.optim.Optimizer, "__init__", "optimizerConstruction")):
                guards.enter_context(patch.object(owner, name, forbidden(counter)))
            plan = auth.read_json(reader, request["qualityPlan"])
            terminal = auth.read_json(reader, request["workerTerminal"])
            review = auth.read_json(reader, request["cpuReview"])
            package = auth.read_json(reader, request["executionPackage"])
            require(plan["runId"] == terminal["runId"] == RUN
                    and terminal["status"] == "training_completed_review_pending"
                    and terminal["executionState"] == "completed"
                    and terminal["completedEpochs"] == 12
                    and terminal["optimizerSteps"] == {"generator": 576, "discriminator": 576}
                    and terminal["executionPackage"] == request["executionPackage"]
                    and review["executionPackage"] == request["executionPackage"]
                    and review["workerTerminal"] == request["workerTerminal"]
                    and request["qualityPlan"] in package["inputEvidence"],
                    "original Run/package/terminal differs")
            selected = terminal["selectedCheckpointRecord"]
            require(selected["checkpoint"] == request["checkpoint"] == review["selectedCheckpoint"],
                    "selected exact checkpoint differs")
            programs = {**plan["programBindings"], "trainFitAdapter": request["adapter"]}
            worker.verify_loaded_sources(reader, {"programBindings": programs})
            event("verifying_original_train_sources")
            auth.verify_data_closure(reader, plan)
            loaded, order = worker.load_samples(reader, plan, splits=("train",))
            train = loaded["train"]
            require(len(train) == 48 and all(s["split"] == "train" for s in train), "exact train48 required")
            require([s["sampleId"] for s in train] ==
                    auth.read_json(reader, plan["trainSplit"])["sampleIds"], "train order differs")
            forbidden_rgb = {r["originalRgb"]["path"] for r in review["validationImages"]}
            source_index = reader.json(reader.json(plan["datasetManifest"])["sourceIndex"])
            forbidden_rgb.update(r["image"]["path"] for r in source_index["samples"] if r["split"] != "train")
            require(not forbidden_rgb.intersection(reader.observed), "non-train RGB was read")
            model, critic = profile.fresh_networks(order)
            worker.checkpoint.reload(reader.read(request["checkpoint"]), model=model, critic=critic,
                configuration=plan["configuration"], run_id=RUN,
                package_binding=request["executionPackage"], dataset_binding=plan["datasetManifest"],
                epoch=selected["epoch"], selection=selected["selection"], counts=selected["counts"],
                program_bindings=plan["programBindings"], plan_binding=request["qualityPlan"])
            model.eval().requires_grad_(False)
            before = shared.v24.core.cpu.state_hash(model)
            critic_before = shared.v24.core.cpu.state_hash(critic)
            event("strict_checkpoint_loaded")
            with torch.inference_mode():
                for sample in train:
                    resource()
                    require(torch.get_num_threads() <= 2 and not torch.cuda.is_initialized(), "CPU-only boundary")
                    require(calls["generatorForwards"] < 48, "48 forward ceiling")
                    calls["generatorForwards"] += 1
                    prediction = profile.sample_forward(model, sample)
                    require(prediction.device.type == "cpu" and tuple(prediction.shape) == (1, 3, 192, 256),
                            "CPU native256 RGB required")
                    _, corr = shared.original_object_class_spatial_loss(prediction, sample, order, split="train")
                    rows.append({"sampleId": sample["sampleId"], "split": "train",
                        "identity": json.loads(sample["_ecology_regime_binding"].identity_json),
                        "fullRgbMae": float((prediction[0] - sample["image"]).abs().mean()),
                        "objectCorrelations": {role: None if corr.get(role) is None else float(corr[role])
                                               for role in ROLES}})
                    event("train_row_observed", sampleId=sample["sampleId"])
            require(before == shared.v24.core.cpu.state_hash(model)
                    and critic_before == shared.v24.core.cpu.state_hash(critic)
                    and all(p.grad is None for net in (model, critic) for p in net.parameters()),
                    "G/D state or gradients changed")
            require(not forbidden_rgb.intersection(reader.observed), "non-train RGB was read")
            worker.verify_loaded_sources(reader, {"programBindings": programs})
            reader.unchanged()
            resource()
            report = {"schemaVersion": "terrain-train-fit-readonly-report-v1",
                "status": "train48_observation_completed_not_qualified",
                "recordedAtUtc": datetime.now(timezone.utc).isoformat(), "request": request_binding,
                "runId": RUN, "checkpoint": request["checkpoint"], "trainSplit": plan["trainSplit"],
                "modelStateBefore": before, "modelStateAfter": shared.v24.core.cpu.state_hash(model),
                "criticStateUnchanged": True, "rows": rows, "summary": summarize(rows),
                "existingValidation": {"report": request["cpuReview"], "rows": review["validation"],
                    "selectionCpu": review["selectionCpu"], "reinference": False},
                "actualCalls": calls, "elapsedMs": round((time.monotonic() - started) * 1000),
                "observedBindings": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
                "gpuInitialized": torch.cuda.is_initialized(), "weightsModified": False,
                "checkpointSelectionModified": False, "trainingStarted": False,
                "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
                "formalStage4QualificationGranted": False, "runtimePublicationGranted": False}
            publish("report.json", report)
            print(json.dumps({"status": report["status"], "rows": len(rows), "calls": calls,
                              "elapsedMs": report["elapsedMs"]}), flush=True)
            return report
    except BaseException as primary:
        try:
            publish("failure.json", {"status": "readonly_diagnostic_failed_closed", "request": request_binding,
                "recordedAtUtc": datetime.now(timezone.utc).isoformat(), "error": str(primary)[:4096],
                "errorType": type(primary).__name__, "completedRows": len(rows), "actualCalls": calls,
                "partialRows": rows, "automaticRetries": 0, "trainingStarted": False})
        except BaseException as secondary:
            print("secondary evidence error: " + str(secondary)[:1024], file=sys.stderr)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    run({"path": args.request, "sha256": args.sha256})

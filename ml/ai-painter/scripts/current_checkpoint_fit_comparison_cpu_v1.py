"""FIT006 extension of the existing CPU diagnostic entry, not a training route."""
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import types
from unittest.mock import patch

from decode1_entry_weight_fit_history_v1 import CASE, RUN, LIMITS, need, verified_fit_history
from current_checkpoint_fit_metrics_v1 import sample_metrics, summarize


def batch_members(train, validation, batch):
    need(len(train) == len(set(train)) == 48 and len(validation) == len(set(validation)) == 8
         and set(train).isdisjoint(validation), "exact disjoint 48/8 required")
    need(type(batch) is int and 0 <= batch < 4, "FIT006 batch outside four")
    return ("train", train[batch * 16:(batch + 1) * 16]) if batch < 3 else ("validation", validation)


def run(root, request_binding, batch):
    started, started_utc = time.monotonic(), datetime.now(timezone.utc).isoformat()
    import painter_stage4_decode1_entry_weight_quality_worker_v1 as own
    import decode1_entry_weight_quality_auth_v1 as auth
    import torch
    history = verified_fit_history(root, request_binding)
    reader = auth.Reader(root, fit_history=history)
    live = auth.Reader(root)
    request = live.json(request_binding)
    need(os.environ.get("CUDA_VISIBLE_DEVICES") == "-1" and not torch.cuda.is_initialized(), "CPU-only environment required")
    affinity = own.configure_cpu()
    need(len(affinity) <= 2, "two CPU cores required")
    actual = dict(generatorForwards=0, criticForwards=0, autogradAttempts=0,
                  optimizerConstructionAttempts=0, cudaInitializationAttempts=0)
    output = CASE + "/batch-" + str(batch)

    def resource():
        need(time.monotonic() - started < 177 and time.time() * 1000 < request["deadlineUnixMs"], "FIT006 deadline")
        need(torch.get_num_threads() <= 2 and torch.get_num_interop_threads() <= 2
             and not torch.cuda.is_initialized(), "FIT006 thread/CUDA boundary")

    def event(stage, **values):
        print(json.dumps({"stage": stage, "batch": batch, **values}), flush=True)

    def forbidden(counter):
        def reject(*args, **kwargs):
            actual[counter] += 1
            raise RuntimeError("forbidden FIT006 side effect: " + counter)
        return reject

    own.write(root, output + "/started.json", {"request": request_binding, "batch": batch, "startedAtUtc": started_utc})
    try:
        with ExitStack() as stack:
            for owner, name, counter in ((torch.autograd, "grad", "autogradAttempts"),
                    (torch.autograd, "backward", "autogradAttempts"), (torch.Tensor, "backward", "autogradAttempts"),
                    (torch.optim.Optimizer, "__init__", "optimizerConstructionAttempts"),
                    (torch.cuda, "_lazy_init", "cudaInitializationAttempts")):
                stack.enter_context(patch.object(owner, name, forbidden(counter)))
            plan = reader.json(request["sourcePlan"])
            terminal = reader.json(request["sourceTerminal"])
            need(plan["datasetManifest"] == request["datasetManifest"]
                 and plan["trainSplit"] == request["trainSplit"] and plan["validationSplit"] == request["validationSplit"],
                 "FIT006 dataset/split binding differs")
            train = reader.json(plan["trainSplit"])["sampleIds"]
            validation = reader.json(plan["validationSplit"])["sampleIds"]
            need(train == request["trainSampleIds"] and validation == request["validationSampleIds"], "FIT006 order differs")
            split, ids = batch_members(train, validation, batch)
            resource(); event("verify_data_and_load_samples")
            auth.verify_data_closure(reader, plan, recompute=True)
            loaded, order = own.load_samples(reader, plan, splits=(split,))
            samples = loaded[split][batch * 16:(batch + 1) * 16] if split == "train" else loaded[split]
            need([s["sampleId"] for s in samples] == ids, "FIT006 sample identity differs")
            profile = auth.profile_components(plan["capabilityVersion"])
            codec = auth.checkpoint_components(plan["capabilityVersion"])
            model, critic = profile.fresh_networks(order)
            selected = terminal["selectedCheckpointRecord"]
            resource(); event("strict_checkpoint_reload")
            codec.reload(reader.read(request["checkpoint"]), model=model, critic=critic,
                configuration=plan["configuration"], run_id=RUN, package_binding=request["sourcePackage"],
                dataset_binding=plan["datasetManifest"], epoch=24, selection=selected["selection"],
                counts=selected["counts"], program_bindings=plan["programBindings"], plan_binding=request["sourcePlan"])
            model.eval(); critic.eval()
            shared = own.runtime_for_plan(plan)[2]
            before = [shared.v24.core.cpu.state_hash(n) for n in (model, critic)]

            def generator_seen(*_):
                actual["generatorForwards"] += 1
                need(actual["generatorForwards"] <= len(ids), "FIT006 forward ceiling")

            def critic_seen(*_):
                actual["criticForwards"] += 1
                raise RuntimeError("FIT006 critic forward prohibited")

            handles = [model.register_forward_pre_hook(generator_seen), critic.register_forward_pre_hook(critic_seen)]
            rows = []
            try:
                with shared._preserve_rng_and_mode(model), torch.inference_mode():
                    for sample in samples:
                        resource()
                        predicted = profile.sample_forward(model, sample)
                        need(tuple(predicted.shape) == (1, 3, 192, 256) and predicted.device.type == "cpu"
                             and not predicted.requires_grad and bool(torch.isfinite(predicted).all()), "complete CPU RGB required")
                        identity = json.loads(sample["_ecology_regime_binding"].identity_json)
                        _, original_correlations = shared.original_object_class_spatial_loss(predicted, sample, order, split=split)
                        row = {"sampleId": sample["sampleId"], "split": split, "epoch": 24,
                               "sourceRgb": identity["image"], "conditionPack": identity["conditionPack"],
                               "objectCorrelations": {k: None if v is None else float(v) for k, v in original_correlations.items()},
                               **sample_metrics(predicted, sample, order)}
                        if split == "train":
                            from PIL import Image
                            png = io.BytesIO()
                            pixels = (predicted[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype("uint8")
                            Image.fromarray(pixels).save(png, format="PNG")
                            row["predictionPng"] = own.write(root, output + "/prediction-" + str(len(rows)).zfill(2) + ".png", png.getvalue())
                        rows.append(row)
                        event("sample_completed", sampleId=sample["sampleId"], completed=len(rows))
            finally:
                for handle in handles:
                    handle.remove()
            need(actual["generatorForwards"] == len(ids)
                 and before == [shared.v24.core.cpu.state_hash(n) for n in (model, critic)]
                 and all(p.grad is None for n in (model, critic) for p in n.parameters()), "FIT006 state changed")
            programs = {b["path"]: b for b in request["actualPrograms"]}
            loaded_sources = {}
            for module in tuple(sys.modules.values()):
                filename = vars(module).get("__file__") if isinstance(module, types.ModuleType) else None
                if type(filename) is str:
                    file = Path(filename).absolute()
                    if file.is_relative_to(root) and not file.is_relative_to(root / "ml/ai-painter/.venv"):
                        logical = file.relative_to(root).as_posix()
                        need(logical in programs, "loaded source not declared: " + logical)
                        live.read(programs[logical]); loaded_sources[logical] = programs[logical]
            resource(); reader.unchanged(); live.unchanged()
            result = {"schemaVersion": "current-checkpoint-fit-comparison-cpu-batch-v1", "status": "completed",
                      "request": request_binding, "batch": batch, "checkpoint": request["checkpoint"],
                      "sourceRunId": RUN, "rows": rows, "summary": summarize(rows), "actualCalls": actual,
                      "modelStateBeforeAfterEqual": True, "gradientsRemainAbsent": True,
                      "affinity": affinity, "cpuThreads": torch.get_num_threads(),
                      "loadedProjectSources": list(loaded_sources.values()), "inferenceSemanticChecks": history.semantics,
                      "historicalProgramBindings": plan["programBindings"],
                      "startedAtUtc": started_utc, "endedAtUtc": datetime.now(timezone.utc).isoformat(),
                      "elapsedSeconds": time.monotonic() - started, "formalQualificationGranted": False,
                      "runtimePublicationGranted": False, "challengeContentRead": False, "regressionContentRead": False}
            binding = own.write(root, output + "/result.json", result)
            event("batch_completed", result=binding)
            return binding
    except BaseException as error:
        own.write(root, output + "/failure.json", {"status": "failed_closed", "batch": batch,
            "errorType": type(error).__name__, "error": str(error)[:4096], "actualCalls": actual,
            "elapsedSeconds": time.monotonic() - started, "automaticRetries": 0}, terminal=True)
        raise

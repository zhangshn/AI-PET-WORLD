"""One approved post-mortem: exact final checkpoint, train-only CPU inference.

Not a training entry, capability release or replay of the source execution.
"""
from __future__ import annotations
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import types
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/check_current_checkpoint_train_fit_cpu_v1.py"
RUN = "d1-if-v2-89ac18ed-ade0-4dfa-8a51-8de6dc39b616"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")


def require(value, message):
    if not value:
        raise ValueError(message)


def batch_ids(ids, batch):
    require(type(ids) is list and len(ids) == len(set(ids)) == 48, "exact48 train IDs required")
    require(type(batch) is int and 0 <= batch < 3, "batch outside fixed three")
    return ids[batch * 16:(batch + 1) * 16]


def load_verified_train_sources(auth, own, reader, plan):
    # Hash reads alone do not establish snapshot authority. Use the existing
    # verifier to recompute the real closure before the existing loader.
    auth.verify_data_closure(reader, plan, recompute=True)
    return own.load_samples(reader, plan, splits=("train",))


def summarize(rows):
    require(rows and len({r["sampleId"] for r in rows}) == len(rows), "duplicate/empty fit rows")
    roles = {}
    for role in ROLES:
        values = [(r["sampleId"], r["objectCorrelations"][role]) for r in rows
                  if r["objectCorrelations"][role] is not None]
        roles[role] = {"applicable": len(values),
            "mean": sum(v for _, v in values) / len(values) if values else None,
            "worst": min(values, key=lambda x: x[1]) if values else None}
    return {"sampleCount": len(rows), "meanRgbMae": sum(r["fullRgbMae"] for r in rows) / len(rows),
            "perRole": roles}


def run(request_binding, batch):
    started = time.monotonic()
    started_utc = datetime.now(timezone.utc).isoformat()
    for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
        sys.path.insert(0, str(directory))
    import painter_stage4_decode1_entry_weight_quality_worker_v1 as own
    import decode1_entry_weight_quality_auth_v1 as auth
    import torch
    reader = auth.Reader(ROOT)
    request = reader.json(request_binding)
    require(request["schemaVersion"] == "current-checkpoint-train-fit-cpu-request-v1"
            and request["sourceRunId"] == RUN, "diagnostic request scope differs")
    base = ".runtime/ai-painter/registered-training-d1-if-v2-executions/" + RUN
    require(request["sourcePlan"] == {"path": base + "/quality-plan.json",
        "sha256": "b4adff3111724f96e817bfee81bc7995e722293ed3b5c11308721eb78573bff9"}
        and request["sourceTerminal"] == {"path": base + "/worker-terminal.json",
        "sha256": "bc95ed6b0d126b338771d57ae2d60d8a3593728ad556ae0df1090c79bdfea993"}
        and request["checkpoint"]["sha256"] == "ff702e41370756bb24f97c4950daac56d6abc75e8f0171d9a73c367fd837a3e0",
        "current approved immutable inputs required")
    require(request["outputRoot"] == ".runtime/ai-painter/controller-repair-reviews/interface-contract-unification-20261019/namespace-v2/train-fit-02",
        "exact independent diagnostic output required")
    require(request["limits"] == {"wallSeconds": 600, "batchWallSeconds": 180,
        "cpuThreads": 2, "modelForwards": 48, "batches": 3, "outputBytes": 8388608,
        "optimizerUpdates": 0, "automaticRetries": 0}, "diagnostic limits differ")
    for binding in request["diagnosticPrograms"]:
        reader.read(binding)
    require(any(b["path"] == SELF and b["sha256"] == hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
                for b in request["diagnosticPrograms"]), "actual diagnostic source differs")
    affinity = own.configure_cpu()
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "-1" and not torch.cuda.is_initialized(), "CPU-only environment required")
    require(float(request["deadlineUnixMs"]) > time.time() * 1000, "diagnostic deadline elapsed")
    actual = {"generatorForwards": 0, "criticForwards": 0, "autogradAttempts": 0,
              "optimizerConstructionAttempts": 0, "cudaInitializationAttempts": 0}

    def resource():
        require(time.monotonic() - started < 177 and time.time() * 1000 < request["deadlineUnixMs"], "CPU diagnostic deadline")
        require(torch.get_num_threads() <= 2 and torch.get_num_interop_threads() <= 2
                and not torch.cuda.is_initialized(), "CPU thread/CUDA boundary")

    def forbidden(counter):
        def reject(*args, **kwargs):
            actual[counter] += 1
            raise RuntimeError("forbidden diagnostic side effect: " + counter)
        return reject

    def event(stage, **values):
        print(json.dumps({"stage": stage, "batch": batch, **values}), flush=True)

    output = request["outputRoot"] + "/batch-" + str(batch)
    batch_ids(request["trainSampleIds"], batch)
    own.write(ROOT, output + "/started.json", {"request": request_binding, "batch": batch,
        "startedAtUtc": started_utc, "automaticRetries": 0})
    try:
        with ExitStack() as stack:
            for owner, name, counter in ((torch.autograd, "grad", "autogradAttempts"),
                    (torch.autograd, "backward", "autogradAttempts"), (torch.Tensor, "backward", "autogradAttempts"),
                    (torch.optim.Optimizer, "__init__", "optimizerConstructionAttempts"),
                    (torch.cuda, "_lazy_init", "cudaInitializationAttempts")):
                stack.enter_context(patch.object(owner, name, forbidden(counter)))
            package = reader.json(request["sourcePackage"])
            plan = reader.json(request["sourcePlan"])
            terminal = reader.json(request["sourceTerminal"])
            require(request["sourcePlan"] in package["inputEvidence"] and plan["runId"] == RUN
                    and terminal["runId"] == RUN and terminal["status"] == "training_completed_review_pending"
                    and terminal["completedEpochs"] == 24 and terminal["checkpointReloadVerified"] is True
                    and terminal["executionPackage"] == request["sourcePackage"],
                    "exact completed source checkpoint required")
            for binding in plan["programBindings"].values():
                reader.read(binding)
            selected = terminal["selectedCheckpointRecord"]
            require(selected["checkpoint"] == request["checkpoint"] and selected["epoch"] == 24
                    and selected["counts"] == {"generator": 1152, "discriminator": 1152}, "checkpoint/count identity differs")
            ids = reader.json(plan["trainSplit"])["sampleIds"]
            expected = batch_ids(ids, batch)
            require(ids == request["trainSampleIds"] and request["trainSplit"] == plan["trainSplit"], "frozen train split differs")
            resource(); event("load_bound_train_sources")
            loaded, order = load_verified_train_sources(auth, own, reader, plan)
            require(set(loaded) == {"train"} and [s["sampleId"] for s in loaded["train"]] == ids, "train source/order differs")
            samples = loaded["train"][batch * 16:(batch + 1) * 16]
            profile = auth.profile_components(plan["capabilityVersion"])
            codec = auth.checkpoint_components(plan["capabilityVersion"])
            resource(); event("strict_checkpoint_reload")
            model, critic = profile.fresh_networks(order)
            codec.reload(reader.read(request["checkpoint"]), model=model, critic=critic,
                configuration=plan["configuration"], run_id=RUN, package_binding=request["sourcePackage"],
                dataset_binding=plan["datasetManifest"], epoch=24, selection=selected["selection"],
                counts=selected["counts"], program_bindings=plan["programBindings"], plan_binding=request["sourcePlan"])
            model.eval(); critic.eval()
            shared = own.runtime_for_plan(plan)[2]
            before = [shared.v24.core.cpu.state_hash(n) for n in (model, critic)]
            def generator_seen(*_):
                actual["generatorForwards"] += 1
                require(actual["generatorForwards"] <= 16, "forward budget exceeded")
            def critic_seen(*_):
                actual["criticForwards"] += 1
                raise RuntimeError("critic forward prohibited")
            handles = [model.register_forward_pre_hook(generator_seen), critic.register_forward_pre_hook(critic_seen)]
            rows = []
            try:
                with shared._preserve_rng_and_mode(model), torch.inference_mode():
                    for sample in samples:
                        resource()
                        predicted = profile.sample_forward(model, sample)
                        require(predicted.shape == (1, 3, 192, 256) and predicted.device.type == "cpu"
                                and not predicted.requires_grad, "CPU no-grad complete RGB required")
                        _, correlations = shared.original_object_class_spatial_loss(predicted, sample, order, split="train")
                        error = (predicted[0] - sample["image"]).abs()
                        rgb, pixels = {}, {}
                        for role in ROLES:
                            mask = sample["conditions"][list(order).index(role)] > 0.5
                            pixels[role] = int(mask.sum())
                            rgb[role] = float(error[:, mask].mean()) if pixels[role] else None
                        identity = json.loads(sample["_ecology_regime_binding"].identity_json)
                        rows.append({"sampleId": sample["sampleId"], "split": "train", "epoch": 24,
                            "checkpoint": request["checkpoint"], "sourceRgb": identity["image"],
                            "conditionPack": identity["conditionPack"], "fullRgbMae": float(error.mean()),
                            "objectCorrelations": {role: None if correlations.get(role) is None else float(correlations[role]) for role in ROLES},
                            "objectCoreRgbMae": rgb, "objectCorePixels": pixels})
                        event("sample_completed", completed=len(rows), sampleId=sample["sampleId"])
            finally:
                for handle in handles:
                    handle.remove()
            require([r["sampleId"] for r in rows] == expected and actual["generatorForwards"] == 16, "exact16 inference rows required")
            require(before == [shared.v24.core.cpu.state_hash(n) for n in (model, critic)]
                    and all(p.grad is None for n in (model, critic) for p in n.parameters()), "model/critic/grad changed")
            programs = {b["path"]: b for b in (*plan["programBindings"].values(), *request["diagnosticPrograms"])}
            loaded_sources = []
            for module in tuple(sys.modules.values()):
                filename = vars(module).get("__file__") if isinstance(module, types.ModuleType) else None
                if type(filename) is str:
                    file = Path(filename).absolute()
                    if file.is_relative_to(ROOT) and not file.is_relative_to(ROOT / "ml/ai-painter/.venv"):
                        logical = file.relative_to(ROOT).as_posix()
                        require(logical in programs, "loaded source not declared: " + logical)
                        reader.read(programs[logical]); loaded_sources.append(programs[logical])
            require(len({b["path"] for b in loaded_sources}) <= 256, "actual loaded project source ceiling")
            resource(); reader.unchanged()
            result = {"schemaVersion": "current-checkpoint-train-fit-cpu-batch-v1", "status": "completed",
                "sourceRunId": RUN, "diagnosticId": request["diagnosticId"], "request": request_binding,
                "batch": batch, "checkpoint": request["checkpoint"], "rows": rows, "summary": summarize(rows),
                "actualCalls": actual, "modelStateBeforeAfterEqual": True, "gradientsRemainAbsent": True,
                "optimizerUpdates": 0, "gpuInitialized": False, "affinity": affinity,
                "cpuThreads": torch.get_num_threads(), "startedAtUtc": started_utc,
                "endedAtUtc": datetime.now(timezone.utc).isoformat(), "elapsedSeconds": time.monotonic() - started,
                "loadedProjectSources": list({b["path"]: b for b in loaded_sources}.values()),
                "formalQualificationGranted": False, "runtimePublicationGranted": False,
                "validationForwardCalls": 0, "challengeContentRead": False, "regressionContentRead": False}
            binding = own.write(ROOT, output + "/result.json", result)
            event("batch_completed", result=binding)
            return binding
    except BaseException as error:
        own.write(ROOT, output + "/failure.json", {"status": "failed_closed", "batch": batch,
            "errorType": type(error).__name__, "error": str(error)[:4096], "actualCalls": actual,
            "elapsedSeconds": time.monotonic() - started, "automaticRetries": 0}, terminal=True)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--batch", type=int, required=True)
    args = parser.parse_args()
    if args.request == ".runtime/ai-painter/controller-repair-reviews/fit-comparison-006-20261022/evaluation-v1/request.json":
        sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
        sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
        from current_checkpoint_fit_comparison_cpu_v1 import run as run_comparison
        run_comparison(ROOT, {"path": args.request, "sha256": args.sha256}, args.batch)
    else:
        run({"path": args.request, "sha256": args.sha256}, args.batch)

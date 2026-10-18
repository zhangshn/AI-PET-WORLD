"""One exact train sample, one CPU forward; no training or causal claim."""
from __future__ import annotations
import argparse
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import random
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/diagnose_ecology_terrain_detail_object_response_cpu_v1.py"
RUN = "terrain-detail-quality-v2-78017caf-1495-4a85-a2ed-e03e3a8e532c"
RUN_ROOT = ".runtime/ai-painter/ecology-terrain-detail-weight-quality-executions/" + RUN
OUTPUT = ".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/terrain-object-response-v1"
ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
BINDINGS = ("qualityPlan", "workerTerminal", "cpuReview", "executionPackage", "checkpoint", "adapter")
LIMITS = {"attempts": 1, "automaticRetries": 0, "cpuThreads": 2, "maxWallSeconds": 240,
    "maxGeneratorForwards": 1, "maxDecodedTrainSamples": 1, "maxOutputMiB": 8,
    "maxJsonBytes": 1048576, "optimizerConstruction": 0, "optimizerSteps": 0,
    "autogradCalls": 0, "cudaInitialization": False, "validationReinference": False}


def require(ok, message):
    if not ok: raise ValueError(message)


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


def guard_image_read(logical, allowed):
    if logical.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")):
        require(logical in allowed, "out-of-scope RGB/channel read prohibited")


def validate_request(value):
    require(type(value) is dict and set(value) == set(BINDINGS) | {
        "schemaVersion", "runId", "outputRoot", "limits", "trainingAllowed", "qualificationGranted", "selectedSampleId"},
        "exact request fields required")
    require(value["schemaVersion"] == "terrain-object-response-readonly-request-v1"
        and value["runId"] == RUN and value["outputRoot"] == OUTPUT, "request identity differs")
    require(json_bytes(value["limits"]) == json_bytes(LIMITS), "readonly limits differ")
    require(value["trainingAllowed"] is False and value["qualificationGranted"] is False,
        "training or qualification prohibited")
    require(type(value["selectedSampleId"]) is str and bool(value["selectedSampleId"]), "fixed sample required")
    for key in BINDINGS:
        b = value[key]
        require(type(b) is dict and set(b) == {"path", "sha256"} and type(b["path"]) is str
            and b["path"] and not b["path"].startswith(("/", "\\")) and ":" not in b["path"]
            and "\\" not in b["path"] and all(p not in ("", ".", "..") for p in b["path"].split("/"))
            and type(b["sha256"]) is str and len(b["sha256"]) == 64
            and all(c in "0123456789abcdef" for c in b["sha256"]), "invalid binding: " + key)
    require(value["adapter"]["path"] == SELF, "adapter identity differs")
    for key, path in {"qualityPlan": RUN_ROOT + "/quality-plan.json", "workerTerminal": RUN_ROOT + "/worker-terminal.json",
            "cpuReview": RUN_ROOT + "/dry-review/cpu-review.json", "checkpoint": RUN_ROOT + "/checkpoint-24.pt",
            "executionPackage": ".runtime/ai-painter/autonomous-closed-loop-packages/terrain-detail-quality-v2-package-78017caf-1495-4a85-a2ed-e03e3a8e532c/package.json"}.items():
        require(value[key]["path"] == path, "exact current input path differs: " + key)
    return value


def region_metrics(predicted, target, mask):
    """RGB L1; signed edge L1 on pairs wholly inside the region; centered luma."""
    import torch
    n = int(mask.sum())
    if n == 0:
        return {"pixels": 0, "rgbMae": None, "signedEdgeMae": None,
            "edgeChannelPairs": 0, "lumaCorrelation": None, "correlationStatus": "empty_region"}
    rgb = float((predicted - target).abs()[:, mask].mean())
    edge_sum, edge_count = 0.0, 0
    for axis in (1, 2):
        if axis == 1:
            a, b = predicted[:, 1:, :] - predicted[:, :-1, :], target[:, 1:, :] - target[:, :-1, :]
            pairs = mask[1:, :] & mask[:-1, :]
        else:
            a, b = predicted[:, :, 1:] - predicted[:, :, :-1], target[:, :, 1:] - target[:, :, :-1]
            pairs = mask[:, 1:] & mask[:, :-1]
        edge_sum += float((a - b).abs()[:, pairs].sum())
        edge_count += 3 * int(pairs.sum())
    weights = predicted.new_tensor((.2126, .7152, .0722))[:, None, None]
    a, b = (predicted * weights).sum(0)[mask], (target * weights).sum(0)[mask]
    a, b = a - a.mean(), b - b.mean()
    energy_a, energy_b = a.square().sum(), b.square().sum()
    status = "measured"
    corr = None
    if n < 2: status = "insufficient_pixels"
    elif float(energy_b) < 1e-8: status = "constant_reference"
    elif float(energy_a) == 0: status = "constant_prediction"
    else: corr = float(((a * b).sum() / torch.sqrt(energy_a * energy_b + 1e-8)).clamp(-1, 1))
    return {"pixels": n, "rgbMae": rgb, "signedEdgeMae": edge_sum / edge_count if edge_count else None,
        "edgeChannelPairs": edge_count, "lumaCorrelation": corr, "correlationStatus": status}


def measure_response(prediction, target, evidence):
    import torch
    require(type(prediction) is torch.Tensor and prediction.shape == (1, 3, 192, 256)
        and type(target) is torch.Tensor and target.shape == (3, 192, 256), "native256 tensors required")
    terrain = evidence["terrainRgb"]
    require(type(terrain) is torch.Tensor and terrain.shape == prediction.shape, "terrain RGB shape differs")
    for value in (prediction, target, terrain):
        require(value.device.type == "cpu" and value.dtype == torch.float32 and not value.requires_grad
            and bool(torch.isfinite(value).all()) and bool(((value >= 0) & (value <= 1)).all()), "finite detached CPU RGB required")
    masks, residuals = evidence["visibleObjectSupportMasks"], evidence["maskedObjectRgbResiduals"]
    require(set(masks) == set(residuals) == set(ROLES), "four exact object branches required")
    count = torch.zeros_like(terrain[:, :1]); total = torch.zeros_like(terrain)
    regions = {}
    for role in ROLES:
        mask, residual = masks[role], residuals[role]
        core = evidence["responsibilityConditions"][role]
        require(mask.shape == core.shape == (1, 1, 192, 256) and residual.shape == prediction.shape,
            "object evidence shape differs")
        for value in (mask, core, residual):
            require(value.device.type == "cpu" and not value.requires_grad and bool(torch.isfinite(value).all()), "CPU evidence required")
        require(bool(((mask == 0) | (mask == 1)).all()) and bool(((core == 0) | (core == 1)).all()), "binary masks required")
        require(not bool(((core > 0) & ~(mask > 0)).any()), "core escapes actual visible support")
        require(bool((residual.abs() <= 1).all()) and not bool(residual.masked_select(~mask.bool().expand_as(residual)).count_nonzero()),
            "residual outside support or tanh range")
        count += mask.float(); total += residual
        active = residual[mask.bool().expand_as(residual)]
        regions[role] = {"core": region_metrics(prediction[0], target, core[0, 0].bool()),
            "support": region_metrics(prediction[0], target, mask[0, 0].bool()),
            "tanhResidual": {"activeChannelValues": active.numel(), "saturationAbsThreshold": .99,
                "saturationCount": int((active.abs() >= .99).sum()),
                "saturationRatio": float((active.abs() >= .99).float().mean()) if active.numel() else None,
                "maximumAbs": float(active.abs().max()) if active.numel() else None}}
    base = torch.logit(terrain.clamp(1e-5, 1 - 1e-5))
    reconstructed = torch.sigmoid(base + total)
    require(torch.equal(prediction, reconstructed), "actual RGB does not match actual four-branch composition")
    lower, upper = torch.sigmoid(base - count), torch.sigmoid(base + count)
    unreachable = (target[None] < lower) | (target[None] > upper)
    distances = (lower - target[None]).clamp_min(0) + (target[None] - upper).clamp_min(0)
    reachability = {}
    for branches in range(5):
        mask = (count == branches).expand_as(prediction)
        n = int(mask.sum())
        reachability[str(branches)] = {"pixels": n // 3, "channelValues": n,
            "targetOutsideClosedRgbEnvelopeCount": int((unreachable & mask).sum()),
            "targetOutsideClosedRgbEnvelopeRatio": float(unreachable[mask].float().mean()) if n else None,
            "minimumRgbMaeToClosedEnvelope": float(distances[mask].mean()) if n else None}
    return {"roles": regions, "reachableEnvelopeByActiveBranchCount": reachability,
        "reachabilityRule": "sigmoid(logit(clamp(actual_terrain_rgb,1e-5,1-1e-5)) +/- sum(actual_binary_visible_masks))",
        "reachabilityInterpretation": "optimistic_closed_bound_with_current_terrain_not_global_model_capacity_or_cause",
        "metricsMethod": "same_region_adjacent_signed_edges; centered_luma_eps1e-8; saturation_abs_ge_0.99",
        "rootCauseEstablished": False}


@contextmanager
def preserve_rng(torch):
    import numpy as np
    py, np_state, cpu = random.getstate(), np.random.get_state(), torch.get_rng_state().clone()
    primary = None
    try:
        yield
        require(random.getstate() == py and np.array_equal(np_state[1], np.random.get_state()[1])
            and np_state[0] == np.random.get_state()[0] and np_state[2:] == np.random.get_state()[2:]
            and torch.equal(cpu, torch.get_rng_state()), "diagnostic RNG changed")
    except BaseException as error:
        primary = error
        raise
    finally:
        try:
            random.setstate(py); np.random.set_state(np_state); torch.set_rng_state(cpu)
        except BaseException as error:
            if primary is None: raise
            primary.secondary_rng_restore_error = str(error)[:1024]


def load_selected(reader, plan, sample_id, profile, shared, calls):
    """Reuse the original decoder exactly once, never worker.load_samples."""
    ids = reader.json(plan["trainSplit"])["sampleIds"]
    require(len(ids) == len(set(ids)) == 48 and ids[0] == sample_id, "first fixed train sample required")
    manifest, order, continuous, _selected, _membership = shared.v24.core.cpu.select_rows(reader)
    require(reader.json(plan["datasetManifest"]) == manifest, "source manifest differs")
    source = reader.json(manifest["sourceIndex"])
    rows = [r for r in source["samples"] if r["sampleId"] == sample_id]
    require(len(rows) == 1 and rows[0]["split"] == "train", "unique selected train row required")
    row = rows[0]
    pack = reader.json(row["conditionPack"])
    reader.allowed_images = {row["image"]["path"], *(b["path"] for b in pack["channels"])}
    require(calls["trainSampleDecodeAttempts"] == 0, "one decode ceiling")
    calls["trainSampleDecodeAttempts"] += 1
    sample, identity = shared.v24.core.cpu.load_sample(reader, row, order, continuous)
    calls["decodedTrainSamples"] += 1
    from painter_stage4_appearance_regime_probe import derive_regime_record
    record, _code, _facts = derive_regime_record(reader, identity)
    return profile.bind_sample_ecology(reader, sample, identity, record), order, identity


def run(request_binding):
    started = time.monotonic()
    sys.dont_write_bytecode = True
    for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
        sys.path.insert(0, str(directory))
    import ecology_terrain_detail_weight_quality_auth_v1 as auth
    import painter_stage4_ecology_terrain_detail_weight_quality_worker_v1 as worker
    class SelectedReader(auth.Reader):
        allowed_images = frozenset()
        snapshots = {}
        def read(self, binding, maximum=auth.MAX_CAPTURE):
            logical = binding["path"]
            guard_image_read(logical, self.allowed_images)
            return super().read(binding, maximum)
        def snapshot(self, logical):
            if logical == auth.CANONICAL_REGION_PROGRAM: return super().snapshot(logical)
            require(logical in self.snapshots and logical.endswith(".json"), "unbound metadata snapshot")
            binding = self.snapshots[logical]
            return self.read(binding), dict(binding)
    reader = SelectedReader(ROOT)
    request = validate_request(auth.read_json(reader, request_binding))
    reader.read(request["adapter"], auth.PROGRAM_MAX)
    output = reader.path(OUTPUT)
    output.mkdir(exist_ok=False)
    calls = {"generatorForwards": 0, "generatorForwardCompleted": 0, "trainSampleDecodeAttempts": 0,
        "decodedTrainSamples": 0, "objectHeadForwards": 0,
        "autogradCalls": 0, "optimizerConstruction": 0, "optimizerSteps": 0, "cudaInitializationAttempts": 0}
    def resource():
        require(time.monotonic() - started < 239, "CPU wall ceiling/reserve")
    def publish(name, value):
        raw = json_bytes(value)
        require(len(raw) <= LIMITS["maxJsonBytes"], "single JSON ceiling")
        files = list(output.iterdir())
        require(all(p.is_file() and not p.is_symlink() for p in files), "unknown output entry")
        require(sum(p.stat().st_size for p in files) + len(raw) <= 8 * 1024**2, "output ceiling")
        reader.mapping.check()
        with (output / name).open("xb") as stream:
            require(stream.write(raw) == len(raw), "short evidence write")
            stream.flush(); os.fsync(stream.fileno())
    def forbidden(counter):
        def reject(*args, **kwargs):
            calls[counter] += 1
            raise ValueError("readonly operation prohibited: " + counter)
        return reject
    try:
        publish("claim.json", {"request": request_binding, "runId": RUN, "limits": LIMITS})
        torch, profile, shared = worker.runtime()
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
        require(not torch.cuda.is_initialized(), "CUDA already initialized")
        with preserve_rng(torch), ExitStack() as guards:
            for owner, name, counter in ((torch.cuda, "_lazy_init", "cudaInitializationAttempts"),
                (torch.autograd, "grad", "autogradCalls"), (torch.autograd, "backward", "autogradCalls"),
                (torch.optim.Optimizer, "__init__", "optimizerConstruction"),
                (torch.optim.Optimizer, "step", "optimizerSteps")):
                guards.enter_context(patch.object(owner, name, forbidden(counter)))
            plan, terminal, review, package = (auth.read_json(reader, request[k]) for k in BINDINGS[:4])
            require(plan["runId"] == terminal["runId"] == RUN and plan["capabilityVersion"] == auth.CAPABILITY
                and terminal["status"] == "training_completed_review_pending" and terminal["executionState"] == "completed"
                and terminal["completedEpochs"] == 24 and terminal["optimizerSteps"] == {"generator": 1152, "discriminator": 1152}
                and terminal["checkpointReloadVerified"] is True and terminal["executionPackage"] == request["executionPackage"]
                and review["executionPackage"] == request["executionPackage"] and review["workerTerminal"] == request["workerTerminal"]
                and request["qualityPlan"] in package["inputEvidence"]
                and package["programLineage"] == {k: v["sha256"] for k, v in plan["programBindings"].items()}, "Run/package identity differs")
            selected = terminal["selectedCheckpointRecord"]
            require(selected["epoch"] == 24 and selected["counts"] == {"generator": 1152, "discriminator": 1152}
                and selected["checkpoint"] == request["checkpoint"] == review["selectedCheckpoint"], "exact epoch24 checkpoint differs")
            worker.checkpoint.validate_configuration(plan["configuration"])
            programs = {**plan["programBindings"], "objectResponseAdapter": request["adapter"]}
            for binding in programs.values(): reader.read(binding, auth.PROGRAM_MAX)
            closure = auth.read_json(reader, plan["dataClosure"])
            require(closure["schema"] == "ecology-terrain-detail-weight-quality-data-closure-v1"
                and closure["splitSampleIds"]["train"] == reader.json(plan["trainSplit"])["sampleIds"], "source closure differs")
            reader.snapshots = {b["path"]: b for b in closure["bindings"] if b["path"].endswith(".json")}
            require(len(reader.snapshots) == sum(b["path"].endswith(".json") for b in closure["bindings"]), "duplicate closure metadata")
            sample, order, identity = load_selected(reader, plan, request["selectedSampleId"], profile, shared, calls)
            worker.verify_loaded_sources(reader, {"programBindings": programs})
            resource()
            model, critic = profile.fresh_networks(order)
            worker.checkpoint.reload(reader.read(request["checkpoint"]), model=model, critic=critic,
                configuration=plan["configuration"], run_id=RUN, package_binding=request["executionPackage"],
                dataset_binding=plan["datasetManifest"], epoch=24, selection=selected["selection"], counts=selected["counts"],
                program_bindings=plan["programBindings"], plan_binding=request["qualityPlan"])
            from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import validate_model_identity
            validate_model_identity(model)
            for head in model.object_rgb_heads.values():
                require(type(head) is torch.nn.Sequential and len(head) == 3
                    and type(head[0]) is torch.nn.Conv2d and head[0].in_channels == 8 and head[0].out_channels == 16
                    and type(head[1]) is torch.nn.SiLU and type(head[2]) is torch.nn.Conv2d
                    and head[2].in_channels == 16 and head[2].out_channels == 3, "actual 8/16/3 head differs")
            before = [shared.v24.core.cpu.state_hash(net) for net in (model, critic)]
            def head_observed(*args): calls["objectHeadForwards"] += 1
            def generator_observed(*args):
                require(calls["generatorForwards"] == 0, "one generator forward ceiling")
                calls["generatorForwards"] += 1
            handle = model.register_forward_pre_hook(generator_observed); guards.callback(handle.remove)
            for head in model.object_rgb_heads.values():
                handle = head.register_forward_hook(head_observed); guards.callback(handle.remove)
            forward_error = None
            try:
                with shared._preserve_rng_and_mode(model), torch.inference_mode():
                    model.eval(); resource()
                    prediction, evidence = profile.sample_forward(model, sample, return_evidence=True)
                    calls["generatorForwardCompleted"] += 1
                    resource()
                    measurements = measure_response(prediction, sample["image"], evidence)
            except BaseException as error:
                forward_error = error
                raise
            finally:
                try:
                    after = [shared.v24.core.cpu.state_hash(net) for net in (model, critic)]
                    require(before == after and all(p.grad is None for net in (model, critic) for p in net.parameters()), "G/D state/grad changed")
                except BaseException as error:
                    if forward_error is None: raise
                    forward_error.secondary_state_integrity_error = str(error)[:1024]
            require(calls == {"generatorForwards": 1, "generatorForwardCompleted": 1, "trainSampleDecodeAttempts": 1,
                "decodedTrainSamples": 1, "objectHeadForwards": 4,
                "autogradCalls": 0, "optimizerConstruction": 0, "optimizerSteps": 0, "cudaInitializationAttempts": 0}
                and not torch.cuda.is_initialized() and torch.get_num_threads() <= 2, "actual CPU call limits differ")
            worker.verify_loaded_sources(reader, {"programBindings": programs}); reader.unchanged(); resource()
        report = {"schemaVersion": "terrain-object-response-readonly-report-v1", "status": "single_train_observation_completed_not_qualified",
            "request": request_binding, "runId": RUN, "checkpoint": request["checkpoint"], "sampleIdentity": identity,
            "measurements": measurements, "actualCalls": calls, "modelStateBefore": before[0], "modelStateAfter": after[0],
            "criticStateBefore": before[1], "criticStateAfter": after[1], "rngUnchanged": True,
            "observedBindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())],
            "elapsedMs": round((time.monotonic() - started) * 1000), "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
            "gpuInitialized": False, "weightsModified": False, "trainingStarted": False,
            "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
            "formalStage4QualificationGranted": False, "runtimePublicationGranted": False}
        publish("report.json", report)
        print(json.dumps({"status": report["status"], "actualCalls": calls}), flush=True)
        return report
    except BaseException as primary:
        try:
            publish("failure.json", {"status": "readonly_diagnostic_failed_closed", "request": request_binding,
                "errorType": type(primary).__name__, "error": str(primary)[:4096], "actualCalls": calls,
                "recordedAtUtc": datetime.now(timezone.utc).isoformat(), "automaticRetries": 0, "trainingStarted": False})
        except BaseException as secondary:
            print("secondary evidence error: " + str(secondary)[:1024], file=sys.stderr)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    run({"path": args.request, "sha256": args.sha256})

"""One authenticated real CPU probe; one stdout JSON, no evidence-file writer."""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).absolute().parents[3]
SELF = "ml/ai-painter/scripts/check_joint_object_priority_real_cpu_v1.py"
PROFILE = "ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_cpu_v1.py"
CANDIDATE = "stage4_mvp256_dry_joint_object_priority_real_cpu_v1"
UPDATE_RULE = "stage4_mvp256_dry_joint_object_priority_cpu_v1"
POLICY = {"path": "data/ai-painter/system-governance/ai-painter-joint-object-priority-real-cpu-policy-v1.json",
    "sha256": "91fae3af9d0b954569d3dc6255d462966b199e0df371a172d1cec99ce4408fc6"}
DATA_PLAN = {"path": ".runtime/ai-painter/final-rgb-base-weight-quality-executions/final-rgb-base-quality-v1-f13f9856-7aac-4d43-b7c9-51133cfed683/quality-plan.json",
    "sha256": "4d96fb6239943620793b83bb63d1e17374b070650106323d17c11ab0690b482c"}
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
OUTPUT_PREFIX = ".runtime/ai-painter/joint-object-priority-real-cpu-checks/"
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
MAX_JSON = 1048576
PRIMARY_CALL_FIELDS = ("generatorForwards", "generatorForwardCompleted", "trainSampleDecodeAttempts", "decodedTrainSamples",
    "autogradCalls", "backwardCalls", "optimizerConstruction", "optimizerSteps", "checkpointLoads", "cudaInitializationAttempts")


def require(value, message):
    if not value:
        raise ValueError(message)


def binding(value):
    require(type(value) is dict and set(value) == {"path", "sha256"}, "exact binding required")
    path, digest = value["path"], value["sha256"]
    require(type(path) is str and path and not path.startswith(("/", "\\")) and ":" not in path
        and "\\" not in path and all(p not in ("", ".", "..") for p in path.split("/")), "relative bound path required")
    require(type(digest) is str and re.fullmatch("[0-9a-f]{64}", digest) is not None, "lowercase SHA256 required")
    return value


def validate_request(value):
    require(type(value) is dict and set(value) == {"schemaVersion", "runId", "candidateId", "policy", "dataPlan",
        "programBindings", "selectedSampleId", "outputRoot", "registryBefore", "interpreter", "deadlineUnixMs"},
        "exact request fields required")
    require(value["schemaVersion"] == "joint-object-priority-real-cpu-request-v1" and value["candidateId"] == CANDIDATE,
        "real CPU request identity differs")
    require(type(value["runId"]) is str and re.fullmatch(r"joint-object-real-cpu-[A-Za-z0-9_-]{1,100}", value["runId"]),
        "bounded runId required")
    require(value["outputRoot"] == OUTPUT_PREFIX + value["runId"], "exact Run output root required")
    for key in ("policy", "dataPlan", "registryBefore"):
        binding(value[key])
    require(value["policy"] == POLICY and value["dataPlan"] == DATA_PLAN and value["selectedSampleId"] == SAMPLE_ID,
        "fixed policy/data locator/sample required")
    require(value["registryBefore"]["path"] == REGISTRY, "exact readonly registry required")
    programs = value["programBindings"]
    require(type(programs) is dict and 1 <= len(programs) <= 256, "bounded programBindings required")
    sources = {}
    for item in programs.values():
        binding(item)
        require(item["path"] not in sources or sources[item["path"]] == item["sha256"], "conflicting source hashes")
        sources[item["path"]] = item["sha256"]
    require(SELF in sources and PROFILE in sources, "worker/profile source bindings required")
    interpreter = value["interpreter"]
    require(type(interpreter) is dict and set(interpreter) == {"path", "sha256"}
        and type(interpreter["path"]) is str and Path(interpreter["path"]).is_absolute()
        and type(interpreter["sha256"]) is str and re.fullmatch("[0-9a-f]{64}", interpreter["sha256"]),
        "absolute interpreter binding required")
    require(type(value["deadlineUnixMs"]) is int and value["deadlineUnixMs"] > 0, "integer deadline required")
    return value


def json_bytes(value):
    raw = (json.dumps(value, allow_nan=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
    require(len(raw) <= MAX_JSON, "single JSON ceiling exceeded")
    return raw


def bootstrap_request(request_binding):
    binding(request_binding)
    sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
    import ecology_terrain_detail_weight_quality_auth_v1 as auth
    # RuntimeMap owns the exact logical .runtime -> registered physical root
    # relationship, handle/SHA checks and junction policy.  A project.resolve()
    # containment test would incorrectly reject that legitimate mapping.
    reader = auth.Reader(ROOT)
    raw = reader.read(request_binding, MAX_JSON)
    value = validate_request(json.loads(raw))
    reader.unchanged()
    return value


def guard_image_read(path, allowed):
    if path.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")):
        require(path in allowed, "out-of-scope RGB/channel read prohibited")


def selected_reader_class(auth):
    class SelectedReader(auth.Reader):
        def __init__(self, root):
            super().__init__(root)
            self.allowed_images = frozenset()
            self.snapshots = {}

        def read(self, item, maximum=auth.MAX_CAPTURE):
            guard_image_read(item["path"], self.allowed_images)
            return super().read(item, maximum)

        def snapshot(self, logical):
            if logical == auth.CANONICAL_REGION_PROGRAM:
                return super().snapshot(logical)
            require(logical in self.snapshots and logical.endswith(".json"), "unbound metadata snapshot")
            item = self.snapshots[logical]
            return self.read(item), dict(item)
    return SelectedReader


def prepare_data_locator(reader, plan):
    """Adapt only the explicitly bound finalRGB plan's metadata vocabulary."""
    require(plan.get("capabilityVersion") == "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1",
        "fixed finalRGB data context differs")
    closure = reader.json(plan["dataClosure"])
    require(closure["schema"] == "object-support-structure-quality-data-closure-v1", "data closure schema differs")
    require(closure["splitSampleIds"]["train"] == reader.json(plan["trainSplit"])["sampleIds"]
        and len(closure["splitSampleIds"]["train"]) == 48
        and closure["splitSampleIds"]["train"][0] == SAMPLE_ID
        and len(closure["splitSampleIds"]["validation"]) == 8, "fixed split metadata differs")
    snapshots = {item["path"]: item for item in closure["bindings"] if item["path"].endswith(".json")}
    require(len(snapshots) == sum(item["path"].endswith(".json") for item in closure["bindings"]),
        "duplicate closure metadata")
    reader.snapshots = snapshots
    return closure


def validate_policy(reader, policy):
    # The request pins the complete immutable policy, not a subset of booleans.
    require(policy["schemaVersion"] == "ai-painter-joint-object-priority-real-cpu-policy-v1"
        and policy["candidateId"] == CANDIDATE and policy["updateRule"]["candidateId"] == UPDATE_RULE
        and policy["data"]["dataPlan"] == DATA_PLAN and policy["data"]["selectedSampleId"] == SAMPLE_ID,
        "real CPU policy identity differs")
    for item in (policy["formalSpecification"], policy["updateRule"]["policy"],
            policy["updateRule"]["implementation"], policy["updateRule"]["syntheticAcceptance"],
            policy["updateRule"]["historicalSpecification"]):
        reader.read({key: item[key] for key in ("path", "sha256")}, 1048576)
    require(all(flag is False for flag in policy["qualification"].values()), "CPU result cannot grant execution/qualification")


def run(request_binding):
    started = time.monotonic()
    calls = {"generatorForwards": 0, "generatorForwardCompleted": 0, "criticForwards": 0,
        "trainSampleDecodeAttempts": 0, "decodedTrainSamples": 0, "autogradCalls": 0,
        "autogradCompleted": 0, "discriminatorAutogradCalls": 0, "backwardCalls": 0,
        "optimizerConstruction": 0, "optimizerSteps": 0, "checkpointLoads": 0,
        "cudaInitializationAttempts": 0, "tensorSaveAttempts": 0}
    request, reader, failure, before, after, imports = None, None, {}, None, None, None
    rng_before = rng_after = None
    try:
        request = bootstrap_request(request_binding)
        require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "CPU-only visibility required")
        require(time.time() * 1000 < request["deadlineUnixMs"] <= time.time() * 1000 + 240000,
            "expired or unbounded deadline")
        interpreter = Path(request["interpreter"]["path"])
        require(Path(sys.executable).resolve() == interpreter.resolve()
            and hashlib.sha256(interpreter.read_bytes()).hexdigest() == request["interpreter"]["sha256"],
            "exact interpreter required")
        sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
        import ecology_terrain_detail_weight_quality_auth_v1 as auth
        import painter_stage4_ecology_terrain_detail_weight_quality_worker_v1 as worker
        import diagnose_ecology_terrain_detail_object_response_cpu_v1 as sample_loader
        reader = selected_reader_class(auth)(ROOT)
        require(auth.read_json(reader, request_binding) == request, "request changed across authentication")
        policy = auth.read_json(reader, request["policy"])
        validate_policy(reader, policy)
        programs = request["programBindings"]
        unique = {item["path"]: item for item in programs.values()}
        require(sum(len(reader.read(item, 1048576)) for item in unique.values()) <= 16777216, "source closure byte ceiling")
        reader.read(request["registryBefore"], auth.CONTROL_JSON_MAX)

        def resource():
            require(time.monotonic() - started < 179 and time.time() * 1000 < request["deadlineUnixMs"] - 1000,
                "CPU worker deadline/cleanup reserve")
            reader.mapping.check()

        torch, inherited_profile, shared = worker.runtime()
        import painter_stage4_joint_object_priority_training_profile_cpu_v1 as profile
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2:
            torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process()
        require(len(process.cpu_affinity()) <= 2, "managed CPU affinity ceiling")
        require(not torch.cuda.is_initialized(), "CUDA already initialized")
        imports = worker.verify_loaded_sources(reader, {"programBindings": programs})
        plan = auth.read_json(reader, request["dataPlan"])
        prepare_data_locator(reader, plan)
        rng_before = profile.rng_fingerprint()

        def forbidden(counter):
            def reject(*args, **kwargs):
                calls[counter] += 1
                raise ValueError("real CPU prohibited operation: " + counter)
            return reject

        with sample_loader.preserve_rng(torch), ExitStack() as guards:
            for owner, name, counter in ((torch.cuda, "_lazy_init", "cudaInitializationAttempts"),
                    (torch.autograd, "backward", "backwardCalls"), (torch.optim.Optimizer, "__init__", "optimizerConstruction"),
                    (torch.optim.Optimizer, "step", "optimizerSteps"), (torch, "load", "checkpointLoads"),
                    (torch, "save", "tensorSaveAttempts")):
                guards.enter_context(patch.object(owner, name, forbidden(counter)))
            original_grad = torch.autograd.grad

            def counted_grad(*args, **kwargs):
                resource()
                require(calls["autogradCalls"] < 5, "five independent G gradient ceiling")
                calls["autogradCalls"] += 1
                inputs = args[1] if len(args) > 1 else kwargs.get("inputs", ())
                expected = tuple(model.parameters())
                if len(inputs) != len(expected) or any(a is not b for a, b in zip(inputs, expected)):
                    calls["discriminatorAutogradCalls"] += 1
                    raise ValueError("only the complete G parameter sequence may be differentiated")
                value = original_grad(*args, **kwargs)
                calls["autogradCompleted"] += 1
                return value

            guards.enter_context(patch.object(torch.autograd, "grad", counted_grad))
            sample, order, sample_identity = sample_loader.load_selected(
                reader, plan, SAMPLE_ID, inherited_profile, shared, calls)
            imports = worker.verify_loaded_sources(reader, {"programBindings": programs})
            resource()
            model, critic = profile.fresh_networks(order)
            before = [shared.v24.core.cpu.state_hash(net) for net in (model, critic)]

            def generator_observed(*args):
                require(calls["generatorForwards"] == 0, "one real generator forward ceiling")
                calls["generatorForwards"] += 1

            for net, hook, completed_hook in (
                    (model, generator_observed, lambda *_: calls.__setitem__("generatorForwardCompleted", calls["generatorForwardCompleted"] + 1)),
                    (critic, lambda *_: calls.__setitem__("criticForwards", calls["criticForwards"] + 1), None)):
                guards.callback(net.register_forward_pre_hook(hook).remove)
                if completed_hook is not None:
                    guards.callback(net.register_forward_hook(completed_hook).remove)
            probe_error = None
            snapshot_errors = []
            try:
                probe = profile.zero_update_probe(model, critic, sample, order, resource, failure_evidence=failure)
            except BaseException as error:
                probe_error = error
                raise
            finally:
                try:
                    after = [shared.v24.core.cpu.state_hash(net) for net in (model, critic)]
                    rng_after = profile.rng_fingerprint()
                except BaseException as error:
                    if probe_error is None:
                        raise
                    snapshot_errors.append(str(error)[:2048])
                    failure["secondaryStateSnapshotErrors"] = snapshot_errors
            require(before == after and rng_before == rng_after
                and all(p.grad is None for net in (model, critic) for p in net.parameters()), "state/RNG/gradient fields changed")
            require(probe["passed"] is True and calls["autogradCalls"] == calls["autogradCompleted"] == 5
                and calls["generatorForwards"] == calls["generatorForwardCompleted"] == 1
                and calls["decodedTrainSamples"] == calls["trainSampleDecodeAttempts"] == 1, "actual CPU call protocol differs")
            require(not torch.cuda.is_initialized() and all(calls[key] == 0 for key in
                ("discriminatorAutogradCalls", "backwardCalls", "optimizerConstruction", "optimizerSteps",
                 "checkpointLoads", "cudaInitializationAttempts", "tensorSaveAttempts")), "CPU boundary violated")
            imports = worker.verify_loaded_sources(reader, {"programBindings": programs})
            reader.unchanged()
            resource()
        rng_after = profile.rng_fingerprint()
        require(rng_before == rng_after, "outer RNG state differs")
        return {"schemaVersion": "joint-object-priority-real-cpu-worker-result-v1", "success": True,
            "status": "real_cpu_verified_inactive", "executionState": "completed", "runId": request["runId"],
            "candidateId": CANDIDATE, "updateRuleId": UPDATE_RULE, "request": request_binding,
            "policy": request["policy"], "sampleIdentity": sample_identity,
            "actualCalls": {key: calls[key] for key in PRIMARY_CALL_FIELDS},
            "additionalCalls": {key: value for key, value in calls.items() if key not in PRIMARY_CALL_FIELDS}, "probe": probe,
            "modelStateBefore": before[0], "modelStateAfter": after[0], "criticStateBefore": before[1], "criticStateAfter": after[1],
            "rngBefore": rng_before, "rngAfter": rng_after, "rngUnchanged": rng_before == rng_after,
            "loadedSources": imports, "observedBindings": [{"path": p, "sha256": h} for p, h in sorted(reader.observed.items())],
            "resources": {"threads": torch.get_num_threads(), "cpuAffinity": process.cpu_affinity(), "rssBytes": process.memory_info().rss},
            "elapsedMs": round((time.monotonic() - started) * 1000), "trainingStarted": False, "gpuInitialized": False,
            "weightsModified": False, "imageOrCheckpointWritten": False, "validationRgbRead": False,
            "challengeContentRead": False, "regressionContentRead": False,
            "formalStage4QualificationGranted": False, "runtimePublicationGranted": False}
    except BaseException as primary:
        secondary = []
        if reader is not None:
            try:
                reader.unchanged()
            except BaseException as error:
                secondary.append({"check": "source_and_registry_unchanged", "error": str(error)[:2048]})
        return {"schemaVersion": "joint-object-priority-real-cpu-worker-result-v1", "success": False,
            "status": "real_cpu_failed_closed", "executionState": "failed_closed", "runId": request.get("runId") if request else None,
            "candidateId": CANDIDATE, "updateRuleId": UPDATE_RULE, "request": request_binding,
            "error": {"type": type(primary).__name__, "message": str(primary)[:4096]},
            "actualCalls": {key: calls[key] for key in PRIMARY_CALL_FIELDS},
            "additionalCalls": {key: value for key, value in calls.items() if key not in PRIMARY_CALL_FIELDS},
            "completedGradientLabels": failure.get("completedGradientLabels", []),
            "gradientEvidence": failure, "stateBefore": before, "stateAfter": after, "rngBefore": rng_before,
            "rngAfter": rng_after, "loadedSources": imports, "secondaryErrors": secondary,
            "elapsedMs": round((time.monotonic() - started) * 1000), "trainingStarted": False,
            "gpuQualificationGranted": False, "formalStage4QualificationGranted": False, "runtimePublicationGranted": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    args = parser.parse_args()
    result = run({"path": args.request, "sha256": args.request_sha256})
    result["recordedAtUtc"] = datetime.now(timezone.utc).isoformat()
    try:
        raw = json_bytes(result)
    except BaseException as error:
        original = result.get("error")
        result = {"schemaVersion": "joint-object-priority-real-cpu-worker-result-v1", "success": False,
            "runId": result.get("runId"), "candidateId": CANDIDATE, "actualCalls": result["actualCalls"],
            "error": original or {"type": type(error).__name__, "message": str(error)[:2048]},
            "secondarySerializationError": str(error)[:2048], "trainingStarted": False, "formalStage4QualificationGranted": False}
        raw = json_bytes(result)
    sys.stdout.buffer.write(raw)
    sys.stdout.buffer.flush()
    return 0 if result["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

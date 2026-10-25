"""Bound single-sample fresh-seed diagnosis; no training or old-run recovery."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import types
import unittest

STARTED = time.monotonic()
STARTED_AT_UTC = datetime.now(timezone.utc).isoformat()
ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
POLICY = "data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v3.json"
SAMPLE = "ai-cold-start-v7-v7-capacity-slot-186-grassland-forest-transition-v2"
POLICY_V4 = "data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v4.json"
SAMPLE_V4 = "ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2"
MODEL_V4 = "stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1"
CAPABILITY_V4 = "stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1"
FAILURE_RUN_V4 = "d2o-ss1-v1-a15f7de7-c24c-40ea-8e31-43f52eed35d8"


def require(ok, text):
    if not ok:
        raise ValueError(text)


def diagnostic_route(policy=None):
    """Two fixed diagnostic identities; the legacy default remains target40."""
    if policy is None or policy.get("schemaVersion") == "parameter40-qualification-diagnostic-policy-v3":
        return dict(policy=POLICY, sample=SAMPLE, ordinal=40, index=40,
                    name="core.core.terrain.decode_2.layers.0.weight", shape=[96, 192, 3, 3],
                    prefix="p40-", target0=False)
    require(policy.get("schemaVersion") == "parameter40-qualification-diagnostic-policy-v4", "diagnostic policy schema")
    target = dict(index=0, name="core.core.terrain.base_stem.layers.0.weight", shape=[48, 31, 3, 3])
    require(policy.get("failureRunId") == FAILURE_RUN_V4 and policy.get("sampleId") == SAMPLE_V4
            and type(policy.get("sampleOrdinal")) is int and policy["sampleOrdinal"] == 17
            and policy.get("target") == target and type(policy["target"]["index"]) is int
            and policy.get("modelCapabilityVersion") == MODEL_V4
            and policy.get("selectedTargetPacketBytes") == 2097152
            and policy.get("outputRoot") == ".runtime/ai-painter/parameter0-qualification-diagnostics-v1",
            "exact target0 policy identity/bounds required")
    return dict(policy=POLICY_V4, sample=SAMPLE_V4, ordinal=17, prefix="p0-", target0=True, **target)


def validate_bound_source(policy, plan, model_identity, failure=None):
    route = diagnostic_route(policy)
    graph = model_identity["graph"]
    require(plan["runId"] == policy["failureRunId"] and plan["configuration"]["objectSupportStructureWeight"] == 1
            and graph[route["index"]]["name"] == policy["target"]["name"], "source candidate/target identity differs")
    if route["target0"]:
        require(plan["capabilityVersion"] == model_identity["capabilityVersion"] == CAPABILITY_V4
                and plan["configuration"]["modelCapabilityVersion"] == model_identity["modelCapabilityVersion"] == MODEL_V4
                and plan["modelBinding"] == policy["sourceModel"] and plan["dataClosure"] == policy["sourceDataClosure"]
                and len(graph) == 108 and sum(row["elements"] for row in graph) == 2242687
                and graph[0] == dict(name=route["name"], shape=route["shape"], elements=13392, dtype="torch.float32"),
                "bound target0 complete model/data identity differs")
        attempted = (failure or {}).get("attemptedSample", {})
        require(failure is not None and failure.get("runId") == plan["runId"]
                and failure.get("packageId") == plan["packageId"] and failure.get("capabilityVersion") == CAPABILITY_V4
                and failure.get("status") == "failed_closed" and failure.get("optimizerSteps") == 0
                and failure.get("originalError", {}).get("type") == "ValueError"
                and failure["originalError"].get("message") == "actual four-term total gradient identity differs at parameter 0"
                and attempted.get("sampleId") == route["sample"] and attempted.get("gradientSetsAvailable") == 5
                and attempted.get("callCounts") == dict(generatorForwards=1, generatorForwardCompleted=1,
                    generatorAutograd=5, discriminatorAutograd=1), "bound original target0 failure differs")
    return route


def fresh_bound_networks(profile, order, policy, model_identity):
    route = diagnostic_route(policy)
    if not route["target0"]:
        return profile.fresh_networks(order)
    model, critic = profile.fresh_networks(order, model_capability=MODEL_V4)
    validate_fresh_model(model, model_identity)
    return model, critic


def validate_fresh_model(model, model_identity):
    graph = [dict(name=name, shape=list(value.shape), elements=value.numel(), dtype=str(value.dtype))
             for name, value in model.named_parameters()]
    require(graph == model_identity["graph"] and model.capability_version == model_identity["modelCapabilityVersion"] == MODEL_V4
            and model.architecture_id == model_identity["architecture"] and model.numeric_rule == model_identity["numericRule"],
            "fresh target0 full graph/numeric identity differs")


def raw_json(path, expected=None):
    value = path.read_bytes()
    require(len(value) <= 2 * 1024**2, "bounded control JSON required")
    if expected:
        require(hashlib.sha256(value).hexdigest() == expected, "control SHA differs: " + str(path))
    return json.loads(value)


def put(output, name, value, *, binary=False):
    data = value if binary else (json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode()
    used = sum(p.stat().st_size for p in output.rglob("*") if p.is_file())
    require(used + len(data) <= 16 * 1024**2 - (0 if name == "worker-result.json" else 65536), "diagnostic output ceiling")
    target = output / name
    with target.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    return {"path": target.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(data).hexdigest()}


from qualification_gradient_gate_authentication_cpu_v1 import code_identity, authenticate_gate


def load_one(reader, policy, plan, profile, shared):
    import painter_stage4_appearance_regime_probe as seasonal
    route = diagnostic_route(policy)
    metadata = reader.json(policy["sourceDiagnostic"])
    rows = [r for r in metadata["rows"] if r["sampleId"] == route["sample"] and r["split"] == "train"]
    require(len(rows) == 1 and rows[0]["ordinal"] == route["ordinal"], "exact failed train metadata required")
    manifest = reader.json(plan["datasetManifest"])
    ids = reader.json(plan["trainSplit"])["sampleIds"]
    require(len(ids) == 48 and ids[route["ordinal"]] == route["sample"] and metadata["datasetManifest"] == plan["datasetManifest"], "source data/split identity differs")
    sources = reader.json(manifest["sourceIndex"])["samples"]
    source = [r for r in sources if r["sampleId"] == route["sample"]]
    require(len(source) == 1 and source[0]["split"] == "train" and "sourceCorrection" not in source[0], "exact unchanged sample required")
    order, continuous = manifest["identityPayload"]["channelOrder"], manifest["identityPayload"]["continuousChannelIds"]
    sample, identity = shared.v24.core.cpu.load_sample(reader, source[0], order, continuous)
    strip = lambda obj: {k: v for k, v in obj.items() if k != "ordinal"}
    require(strip(identity) == strip(rows[0]["identity"]), "decoded sample identity differs")
    record, _, _ = seasonal.derive_regime_record(reader, identity)
    return profile.bind_sample_ecology(reader, sample, identity, record), order


def cpu_sample_preflight(reader, policy, plan, profile, shared):
    """Decode the exact original target through the real loader, never a model."""
    from contextlib import ExitStack
    from unittest.mock import patch
    import torch
    route = diagnostic_route(policy)
    def forbidden(*_args, **_kwargs):
        raise ValueError("model/autograd/CUDA prohibited in CPU sample preflight")
    with ExitStack() as guards:
        for obj, name in ((profile, "fresh_networks"), (torch.autograd, "grad"),
                          (torch.Tensor, "backward"), (torch.cuda, "_lazy_init")):
            guards.enter_context(patch.object(obj, name, side_effect=forbidden))
        sample, order = load_one(reader, policy, plan, profile, shared)
        require(sample["sampleId"] == route["sample"] and sample["split"] == "train" and len(order) == 23,
                "exact target CPU sample required")
        for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
            tensor = sample[key]
            require(tensor.shape == shape and tensor.device.type == "cpu" and not tensor.requires_grad
                    and tensor.dtype == torch.float32 and bool(torch.isfinite(tensor).all()),
                    "CPU target tensor identity/geometry differs: " + key)
    return {"sampleId": route["sample"], "split": "train", "resolution": [256, 192],
            "conditionChannels": 23, "sourceIdentityVerified": True,
            "originalLoaderAndEcologyBindingCompleted": True, "modelConstructed": False}


def record_diagnostic_failure(result, error):
    evidence = {"type": type(error).__name__, "message": str(error)[:4096]}
    if result.get("originalError") is None:
        result["originalError"] = evidence
    else:
        result.setdefault("secondaryDiagnosticErrors", []).append(evidence)
    result.update(status="diagnostic_failed_closed", reasonCode="diagnostic_execution_or_evidence_failed")


def run_gpu_observation(reader, policy, plan, model_identity, profile, shared, output, programs, resource, result):
    import torch
    from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target40Observation, Target0Observation
    from ai_painter.complete_world.parameter40_qualification_reference_v1 import contrast
    route = diagnostic_route(policy)
    sample, order = load_one(reader, policy, plan, profile, shared)
    model, critic = fresh_bound_networks(profile, order, policy, model_identity)
    state = lambda: {"generator": shared.v24.core.cpu.state_hash(model), "discriminator": shared.v24.core.cpu.state_hash(critic)}
    require(state() == model_identity["initialState"], "fresh model does not match original initial state")
    require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "original CUDA capability required")
    torch.cuda.set_device(0)
    torch.cuda.set_per_process_memory_fraction(0.7)
    model.to("cuda:0")
    critic.to("cuda:0")
    require(state() == model_identity["initialState"], "device transfer changed initial state")
    if route["target0"]:
        validate_fresh_model(model, model_identity)
    observation = (Target0Observation if route["target0"] else Target40Observation)(model, resource)
    attempted, original = {}, None
    try:
        with observation:
            profile.zero_update_probe(model, critic, sample, order, resource, event=observation.event,
                failure_evidence=attempted, support_structure_weight=1.0)
    except BaseException as error:
        original = error
    result.update(status="diagnostic_not_reproduced" if original is None else "diagnostic_failed_closed",
        actualCounts=observation.counts, originalError=None if original is None else {"type": type(original).__name__, "message": str(original)},
        originalAttempt=attempted, initialState=model_identity["initialState"],
        meaning="fresh_seed_single_sample_new_observation_not_original_execution_replay")
    # v4 archives the primary error before even a post-probe state hash can fail.
    if not route["target0"]:
        result["finalState"] = state()
    put(output, "original-observation.json", result)
    if route["target0"]:
        result["finalState"] = state()
    require(state() == model_identity["initialState"] and not attempted.get("secondaryProbeErrors"), "probe state/RNG invariants failed")
    if original is not None and str(original) == "actual four-term total gradient identity differs at parameter " + str(route["index"]):
        authenticated = authenticate_gate(original, observation, programs)
        packet, metadata = observation.compact()
        require(metadata["productionGeometry"], "production geometry not established")
        memory = io.BytesIO()
        torch.save(packet, memory)
        require(memory.tell() <= (policy["selectedTargetPacketBytes"] if route["target0"] else 8 * 1024**2), "compact packet byte limit")
        packet_binding = put(output, "target" + str(route["index"]) + "-packet.pt", memory.getvalue(), binary=True)
        meta_binding = put(output, "target" + str(route["index"]) + "-packet.json", {"packet": packet_binding, "metadata": metadata, "originalGate": authenticated})
        result.update(originalGate=authenticated, packet=packet_binding, metadata=meta_binding)
        comparison = contrast(packet, metadata, resource)
        nonfinite = route["target0"] and comparison.get("componentSumFinite") is False
        result.update(status=("diagnostic_nonfinite_component_sum_evidence_complete" if nonfinite
                              else "diagnostic_target_evidence_complete"), comparison=comparison)
    elif original is not None:
        result["reasonCode"] = "different_failure_or_incomplete_observation"


def execute_request(request, policy, route, output, resource, worker, result):
    worker.configure_cpu()
    class SourceReader(worker.auth.Reader):
        def __init__(self):
            super().__init__(ROOT)
            base = worker.auth.Reader(ROOT)
            closure = base.json(policy["sourceDataClosure"])
            metadata = base.json(policy["sourceDiagnostic"])
            target = [r for r in metadata["rows"] if r["sampleId"] == route["sample"] and r["split"] == "train"]
            require(len(target) == 1, "unique target source metadata required")
            inputs = [b for b in closure["bindings"] if b["path"].endswith(".json")]
            inputs += [target[0]["identity"]["image"], *target[0]["identity"]["channels"], *policy["sourceInputs"]]
            self.allowed = {}
            for b in inputs:
                value = {k: b[k] for k in ("path", "sha256")}
                require(self.allowed.setdefault(b["path"], value) == value, "conflicting diagnostic input digest")
            self.allowed.update({b["path"]: b for b in request["programBindings"]})
        def read(self, binding, maximum=64 * 1024**2):
            resource()
            require(self.allowed.get(binding["path"]) == {k: binding[k] for k in ("path", "sha256")}, "undeclared diagnostic source read")
            return super().read(binding, maximum)
        def snapshot(self, logical):
            require(logical in self.allowed, "undeclared metadata snapshot")
            binding = self.allowed[logical]
            return self.read(binding), dict(binding)
    reader = SourceReader()
    programs = {b["path"]: b for b in request["programBindings"]}
    require(len(programs) == len(request["programBindings"]) <= 256, "unique bounded diagnostic programs")
    source_bytes = 0
    for binding in programs.values():
        source_bytes += len(reader.read(binding, 1024**2))
        if route["target0"]:
            require(source_bytes <= 16 * 1024**2, "diagnostic total source byte limit")
    plan = reader.json(policy["sourcePlan"])
    model_identity = reader.json(plan["modelBinding"])
    validate_bound_source(policy, plan, model_identity, reader.json(policy["sourceFailure"]) if route["target0"] else None)
    try:
        if request["mode"] == "cpu":
            suite = unittest.defaultTestLoader.loadTestsFromName("test_parameter40_qualification_observation_v1")
            tested = unittest.TextTestRunner(stream=sys.stderr, verbosity=1).run(suite)
            require(tested.wasSuccessful() and tested.testsRun > 0 and not tested.skipped, "CPU component tests failed")
            _, profile, shared = worker.runtime_for_plan(plan)
            decoded = cpu_sample_preflight(reader, policy, plan, profile, shared)
            result.update(status="cpu_preflight_passed", testCount=tested.testsRun, samplePreflight=decoded,
                          modelForwards=0, modelAutograd=0, cudaCalls=0)
        else:
            _, profile, shared = worker.runtime_for_plan(plan)
            run_gpu_observation(reader, policy, plan, model_identity, profile, shared, output, programs, resource, result)
    except BaseException as error:
        if not route["target0"]:
            raise
        record_diagnostic_failure(result, error)
    try:
        worker.verify_loaded_sources(reader, {"programBindings": {str(i): b for i, b in enumerate(request["programBindings"])}})
        reader.unchanged()
    except BaseException as error:
        if not route["target0"]:
            raise
        record_diagnostic_failure(result, error)


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--request", required=True)
    args.add_argument("--request-sha256", required=True)
    options = args.parse_args()
    request = raw_json(ROOT / options.request, options.request_sha256)
    require(request["policy"]["path"] in (POLICY, POLICY_V4) and request["mode"] in ("cpu", "gpu"), "fixed policy/mode required")
    policy = raw_json(ROOT / request["policy"]["path"], request["policy"]["sha256"])
    route = diagnostic_route(policy)
    require(request["policy"]["path"] == route["policy"], "policy path/schema conflict")
    require(request["outputRoot"] == policy["outputRoot"] + "/" + request["runId"]
            and request["runId"].startswith(route["prefix"]), "private output identity differs")
    output = ROOT / request["outputRoot"]
    require(output.is_dir() and not output.is_symlink(), "precreated private output required")
    require(time.time() * 1000 < request["deadlineUnixMs"], "diagnostic deadline exhausted")
    import painter_stage4_decode1_entry_weight_quality_worker_v1 as worker
    def resource():
        require(time.time() * 1000 < request["deadlineUnixMs"], "diagnostic deadline exhausted")
    result = {"runId": request["runId"], "trainingAllowed": False, "stage4Qualified": False,
              "historicalReplayAllowed": False, "optimizerConstruction": 0, "optimizerSteps": 0}
    if route["target0"]:
        result["actualCounts"] = {kind + suffix: 0 for kind in ("forward", "generator", "discriminator")
                                  for suffix in ("Attempted", "Completed")}
    try:
        execute_request(request, policy, route, output, resource, worker, result)
    except BaseException as error:
        if not route["target0"]:
            raise
        record_diagnostic_failure(result, error)
    result.update(elapsedSeconds=time.monotonic() - STARTED, recordedAtUtc=datetime.now(timezone.utc).isoformat())
    if route["target0"]:
        result["workerTiming"] = dict(startedAtUtc=STARTED_AT_UTC, finishedAtUtc=result["recordedAtUtc"],
            monotonicElapsedSeconds=result["elapsedSeconds"], scope="python_entry_before_final_write_not_native_startup_transport_or_cleanup")
    put(output, "worker-result.json", result)
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()

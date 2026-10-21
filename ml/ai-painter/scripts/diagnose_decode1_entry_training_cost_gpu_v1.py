"""One fresh, source-bound zero-update cost probe. Never resume a training Run."""
from __future__ import annotations
import argparse
from contextlib import contextmanager, ExitStack
from datetime import datetime, timezone
from functools import wraps
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import types
from unittest.mock import patch

STARTED = time.monotonic()
ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
import torch
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as bridge
import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
# Only the existing live-handle identity and ordinary heartbeat IO primitives;
# never invoke this module's parent route/package/context authorization.
import decode1_entry_weight_quality_auth_v1 as process_io
from painter_stage4_decode1_entry_weight_quality_worker_v1 import verify_torch_dynamic_namespace

require = capture.require
POLICY_PATH = "data/ai-painter/system-governance/ai-painter-decode1-entry-training-cost-probe-policy-v1.json"
OUTPUT = ".runtime/ai-painter/decode1-entry-training-cost-probes"
CAPABILITY = "stage4_mvp256_dry_decode1_entry_training_cost_probe_v1"
PROGRAM = "ml/ai-painter/scripts/diagnose_decode1_entry_training_cost_gpu_v1.py"
TEST = "ml/ai-painter/tests/test_decode1_entry_training_cost_gpu_v1.py"
RESOURCES = dict(cpuPreparationSeconds=120, gpuDiagnosticSeconds=180, cpuThreads=2, cpuAffinityCores=2,
    maxGpuMemoryFraction=.7, maximumTemperatureC=85, minimumFreeVramMiB=2048,
    minimumFreeDiskMiB=2048, maxOutputBytes=134217728, maxStreamBytes=8388608,
    maxTimingJsonBytes=32768, maxTimingAtomicTemporaryBytes=32768,
    failureTerminalReserveBytes=65536, temperatureComparison="strictly_less_than")
BOUNDARY = dict(trainingAllowed=False, gpuQualified=False, stage4Qualified=False,
    checkpointWritten=False, imageWritten=False, capabilityReleased=False, historicalReplayAllowed=False)
CUDA_UUID_TYPE = vars(torch._C).get("_CUuuid")


def gpu_uuid(value):
    require(type(value) is str or (CUDA_UUID_TYPE is not None and type(value) is CUDA_UUID_TYPE), "CUDA UUID provider differs")
    text = str(value)
    require(re.fullmatch(r"(?:GPU-)?[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", text), "standard128 GPU UUID required")
    bare = text.removeprefix("GPU-").lower()
    return bytes.fromhex(bare.replace("-", "")), "GPU-" + bare


def driver_device_zero(raw):
    require(type(raw) is str and raw, "GPU driver query empty/nontext output")
    indices, uuids, zero = set(), set(), None
    for line in raw.splitlines():
        parts = line.split(",")
        require(len(parts) == 3, "GPU driver query malformed row")
        index, text, temperature = [p[1:] if i and p.startswith(" ") else p for i, p in enumerate(parts)]
        require(re.fullmatch(r"0|[1-9][0-9]*", index) and re.fullmatch(r"[0-9]{1,3}", temperature), "GPU driver malformed index/temperature")
        bits, canonical = gpu_uuid(text)
        require(index not in indices and bits not in uuids, "GPU driver duplicate index/UUID")
        indices.add(index); uuids.add(bits)
        if index == "0": zero = bits, canonical, int(temperature)
    require(zero is not None, "GPU driver device0 absent")
    return zero


def require_gpu_poll(free, uuid, temperature):
    gpu_uuid(uuid)
    require(type(free) is int and free >= 0 and type(temperature) is int and 0 <= temperature <= 999,
        "GPU resource poll metadata invalid")
    reasons = []
    if free < 2048 * 1024**2: reasons.append("free_vram_below_minimum")
    if temperature >= 85: reasons.append("temperature_at_or_above_maximum")
    if reasons:
        raise ValueError("GPU resource guard: " + json.dumps(dict(freeVramMiB=free / 1024**2, temperatureC=temperature,
            gpuUuid=uuid, minimumFreeVramMiB=2048, maximumTemperatureC=85, triggered=reasons,
            sampledAtUtc=datetime.now(timezone.utc).isoformat()), sort_keys=True, separators=(",", ":")))


def binding(value):
    require(type(value) is dict and set(value) == {"path", "sha256"}
        and type(value["path"]) is str and value["path"] and not re.search(r"[\\:\x00-\x1f\x7f]", value["path"])
        and not value["path"].startswith("/") and all(p not in ("", ".", "..") for p in value["path"].split("/"))
        and type(value["sha256"]) is str and re.fullmatch("[a-f0-9]{64}", value["sha256"]), "exact logical byte binding required")
    return dict(value)


class Timings:
    """Bounded primitive-only host spans; nested inclusive time is never GPU time."""
    def __init__(self, clock=time.perf_counter):
        self.clock, self.rows, self.stack, self.by_key = clock, [], [], {}

    @contextmanager
    def span(self, name):
        require(type(name) is str and len(name) <= 100, "timing name bound")
        parent = self.stack[-1] if self.stack else None
        key = (parent, name)
        if key not in self.by_key:
            require(len(self.rows) < 128, "unique timing group bound")
            self.by_key[key] = len(self.rows)
            self.rows.append(dict(id=len(self.rows), name=name, parent=parent,
                calls=0, completedCalls=0, elapsedSeconds=0., maximumSeconds=0.))
        row = self.rows[self.by_key[key]]
        row["calls"] += 1
        started = self.clock()
        self.stack.append(row["id"])
        try:
            yield
            row["completedCalls"] += 1
        finally:
            elapsed = max(0., self.clock() - started)
            row["elapsedSeconds"] += elapsed
            row["maximumSeconds"] = max(row["maximumSeconds"], elapsed)
            require(self.stack.pop() == row["id"], "timing stack differs")

    def wrap(self, name, function):
        @wraps(function)
        def measured(*args, **kwargs):
            with self.span(name):
                return function(*args, **kwargs)
        return measured

    def report(self):
        return dict(schemaVersion="ai-painter-decode1-entry-training-cost-observation-v1", clock="host_perf_counter", spans=[dict(row) for row in self.rows],
            semantics="Inclusive host elapsed; nested spans overlap. Original resource checks may synchronize. No added CUDA timing/synchronization.",
            limitations=["Fresh seed20260929 only; does not reproduce the 899-updated state or full-epoch throughput.",
                "Carrier parameter copies are inline in carrier_build_copy_verify; gradient CPU copies are inline in generator_candidate_total.",
                "cpu_joint_rule includes its original validation and arithmetic; pure arithmetic is not separately instrumented.",
                "Never sum parent and child spans as independent GPU time."])


def validate_contract(request, package, policy, now=None):
    require(policy["schemaVersion"] == "ai-painter-decode1-entry-training-cost-probe-policy-v1"
        and policy["capabilityVersion"] == CAPABILITY and policy["resources"] == RESOURCES
        and policy["allowedModes"] == ["cpu_prepare", "gpu_probe"] and policy["outputRoot"] == OUTPUT,
        "fixed diagnostic policy/resources required")
    boundary = policy["executionBoundary"]
    require(boundary["cpuPreparationAttempts"] == boundary["gpuAttempts"] == 1 and boundary["automaticRetries"] == 0
        and boundary["generatorForwardsMaximum"] == 1 and boundary["generatorAutogradMaximum"] == 5
        and boundary["discriminatorAutogradMaximum"] == 1 and boundary["optimizerConstructions"] == boundary["optimizerUpdates"] == 0
        and all(boundary[k] is False for k in ("training", "writePng", "writeCheckpoint", "replayConsumedParent", "latestTrainingTerminalMayChange"))
        and boundary["preserveAllOriginalResourceChecksAndFrequencies"] is True, "fixed zero-update boundary required")
    require(request["schemaVersion"] == "decode1-entry-training-cost-request-v1"
        and request["mode"] in policy["allowedModes"] and re.fullmatch(r"decode1-entry-cost-[a-f0-9-]{36}", request["runId"])
        and request["outputRoot"] == OUTPUT + "/" + request["runId"] and binding(request["policy"])["path"] == POLICY_PATH,
        "own diagnostic request required")
    require(package["schemaVersion"] == "decode1-entry-training-cost-package-v1" and package["runId"] == request["runId"]
        and package["policy"] == request["policy"] and package["capabilityVersion"] == CAPABILITY,
        "same immutable package required")
    for key in ("scope", "resources"):
        require(package[key] == policy[key], "package/policy differs: " + key)
    scope = policy["scope"]
    require(scope["sampleSplit"] == "train" and type(scope["sampleId"]) is str and scope["sampleId"]
        and scope["initializationSeed"] == 20260929 and scope["sampleCount"] == 1
        and scope["sampleSelector"] == "first_row_of_exact_parent_train_split", "fixed single-sample scope required")
    programs = package["programBindings"]
    require(type(programs) is list and 0 < len(programs) <= 256
        and len({binding(b)["path"] for b in programs}) == len(programs), "unique <=256 closure required")
    by_path = {b["path"]: b for b in programs}
    require(all(by_path.get(b["path"]) == b for b in policy["modelBoundary"]["frozenAlgorithmBindings"])
        and PROGRAM in by_path and TEST in by_path, "own/frozen source missing")
    require(binding(request["package"])["path"] == request["outputRoot"] + "/package.json", "own package path required")
    seconds = 120 if request["mode"] == "cpu_prepare" else 180
    require(type(request["deadlineUnixMs"]) is int and 0 < request["deadlineUnixMs"] / 1000
        - (time.time() if now is None else now) <= seconds, "shared bounded deadline required")


class Reader:
    def __init__(self, mapping, programs, check_read):
        self.mapping, self.root, self.check_read = mapping, mapping.project, check_read
        self.spec_mapping = None
        self.snapshots, self.observed, self.rasters, self.allowed_rasters = {}, {}, set(), set()
        for b in programs: self.allow(b)

    def path(self, logical): return self.mapping.path(logical)

    def allow(self, value):
        b = binding({k: value[k] for k in ("path", "sha256")})
        require(self.snapshots.get(b["path"], b) == b, "snapshot binding conflict")
        self.snapshots[b["path"]] = b

    def read(self, value, maximum=64 * 1024**2):
        b = binding({k: value[k] for k in ("path", "sha256")})
        require(not b["path"].endswith((".pt", ".pth", ".safetensors", ".npz")), "state/archive reads prohibited")
        require(b["path"] not in self.rasters or b["path"] in self.allowed_rasters, "unselected raster content prohibited")
        self.check_read()  # deadline/identity only; never a GPU resource callback
        actual_binding = self.spec_mapping[1] if self.spec_mapping and b == self.spec_mapping[0] else b
        size = self.path(actual_binding["path"]).lstat().st_size
        require(size <= maximum, "bounded source allocation")
        raw = self.mapping.binding(actual_binding, maximum=size)
        require(self.observed.get(b["path"], b["sha256"]) == b["sha256"], "source changed")
        self.observed[b["path"]] = b["sha256"]; self.allow(b)
        return raw

    def json(self, b): return json.loads(self.read(b, 8 * 1024**2))

    def snapshot(self, logical):
        require(logical in self.snapshots, "undeclared source snapshot: " + logical)
        b = self.snapshots[logical]
        return self.read(b, 8 * 1024**2), dict(b)

    def unchanged(self):
        for name, sha in tuple(self.observed.items()): self.read({"path": name, "sha256": sha})


def prepare_metadata(reader, data, selected_id):
    cpu = profile.inherited.core.cpu
    require({k: cpu.MANIFEST[k] for k in ("path", "sha256")} == data["datasetManifest"]
        and {k: cpu.CONDITION_CONTRACT[k] for k in ("path", "sha256")} == data["conditionContract"], "original loader binding differs")
    diagnostic = reader.json(data["regimeDiagnostic"])
    require(all({k: diagnostic[key][k] for k in ("path", "sha256")} == data[key]
        for key in ("datasetManifest", "trainSplit", "validationSplit")), "original data/split differs")
    manifest, order, continuous, _, _ = cpu.select_rows(reader)
    require(reader.json(data["datasetManifest"]) == manifest, "original manifest differs")
    source = reader.json(manifest["sourceIndex"])
    rows = source["samples"]
    require(len(rows) == len({r["sampleId"] for r in rows}) == 64, "original64 source differs")
    for row in rows:
        reader.rasters.add(row["image"]["path"])
        if row["split"] in ("train", "validation"): reader.allow(row["regionSource"])
    for record in diagnostic["rows"]:
        identity = record["identity"]
        require(record["split"] in ("train", "validation"), "metadata split differs")
        reader.allow(identity["visualFactManifestFile"])
        reader.rasters.update(b["path"] for b in identity["channels"])
        task = reader.json(identity["taskPackage"])
        for key in ("seasonSnapshot", "regionalProfile"):
            source_binding = task["sourceBindings"]
            reader.allow({"path": source_binding[key + "Path"], "sha256": source_binding[key + "Sha256"]})
    metadata = profile.prepare_metadata(reader, data["regimeDiagnostic"], data["conditionContract"])
    ids = reader.json(data["trainSplit"])["sampleIds"]
    require(len(ids) == len(set(ids)) == 48 and ids == metadata["splitSampleIds"]["train"] and selected_id == ids[0],
        "fixed original train membership required")
    ordinal = ids.index(selected_id)
    row = next(row for row in rows if row["sampleId"] == selected_id)
    require(row["split"] == "train", "selected train source required")
    return row, metadata["records"][("train", ordinal)], order, continuous


def load_one(reader, prepared, counts):
    row, record, order, continuous = prepared
    require(counts["sampleDecodeAttempts"] == 0, "single decode ceiling")
    pack = reader.json(row["conditionPack"])
    reader.allowed_rasters = {row["image"]["path"], *(b["path"] for b in pack["channels"])}
    counts["sampleDecodeAttempts"] += 1
    sample, actual = profile.inherited.core.cpu.load_sample(reader, row, order, continuous)
    require({k: v for k, v in actual.items() if k != "ordinal"}
        == {k: v for k, v in record["identity"].items() if k != "ordinal"}, "selected source identity differs")
    sample = profile.bind_sample_ecology(reader, sample, record["identity"], record["regimeRecord"])
    counts["decodedSamples"] += 1
    return sample


def verify_imports(mapping, programs):
    by_path = {b["path"]: b for b in programs}
    io_reader = types.SimpleNamespace(path=mapping.path, read=lambda b: mapping.binding(binding(b)))
    for module in tuple(sys.modules.values()):
        if verify_torch_dynamic_namespace(io_reader, module) is not None: continue
        if not isinstance(module, types.ModuleType): continue
        filename = vars(module).get("__file__")
        if type(filename) is not str: continue
        try: logical = Path(filename).absolute().relative_to(mapping.project).as_posix()
        except ValueError: continue
        if logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/", "ml/ai-painter/tests/")) and logical.endswith(".py"):
            require(logical in by_path, "loaded project source unbound: " + logical)
            mapping.binding(by_path[logical], maximum=1048576)


def configure_cpu():
    import psutil
    process = psutil.Process(); affinity = process.cpu_affinity()[:2]
    require(affinity, "empty CPU affinity")
    process.cpu_affinity(affinity)
    require(process.cpu_affinity() == affinity, "CPU affinity readback differs")
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    return process, affinity


def commit_observation(mapping, request, package_binding, times, counts):
    """Bounded primitives only; an interrupted uncommitted span stays unknown."""
    report = dict(runId=request["runId"], policy=request["policy"], package=package_binding,
        committedAtUtc=datetime.now(timezone.utc).isoformat(), counts=dict(counts), observation=times.report())
    raw = json.dumps(report, allow_nan=False, separators=(",", ":")).encode()
    require(len(raw) <= 32768, "committed timing JSON ceiling")
    directory = mapping.path(request["outputRoot"])
    require(capture.directory_bytes(directory) + len(raw) <= 134217728 - 65536, "timing temporary/terminal reserve")
    target = directory / "gpu-observation.json"
    pending = directory / "gpu-observation.json.staged"
    identity = capture._directory_identity(directory)
    with pending.open("xb") as stream:
        require(stream.write(raw) == len(raw), "short timing write")
        stream.flush(); os.fsync(stream.fileno())
    require(capture._directory_identity(directory) == identity, "timing parent changed")
    os.replace(pending, target)
    require(capture._directory_identity(directory) == identity, "timing parent changed after publish")


def verify_live_identity(mapping, registry_binding, request, package, *, identity_reader=process_io.process_identity):
    """New Run only, using the registry digest verified by this live Node call."""
    raw = mapping.binding(binding(registry_binding))
    registry = json.loads(raw)
    require(registry.get("schemaVersion") == "ai-painter-current-execution-registry-v1"
        and type(registry.get("registryRevision")) is int and registry["registryRevision"] > 0,
        "verified current registry required")
    if request["mode"] == "cpu_prepare":
        require(registry.get("activeExecution") is None, "CPU preparation active execution changed")
        return
    active = registry.get("activeExecution")
    require(type(active) is dict and registry.get("executionState") == active.get("executionState") == "executing",
        "live executing registry required")
    identity = dict(capabilityVersion=CAPABILITY, runId=request["runId"], packageId=request["runId"] + "-package")
    require(all(registry.get(k) == active.get(k) == v for k, v in identity.items()), "cross-Run registry identity")
    lineage = {"costSource" + str(i): b for i, b in enumerate(package["programBindings"])}
    require(active.get("programLineage") == lineage, "live full source lineage differs")
    pid, creation = active.get("processId"), active.get("processStartIdentity")
    require(type(pid) is int and type(creation) is str and identity_reader(pid) == creation, "supervisor creation identity differs")
    identity.update(processId=pid, processStartIdentity=creation)
    lock_binding = binding(active["lock"])
    require(lock_binding["path"] == request["outputRoot"] + "/active-lock.json", "exact own diagnostic phase lock required")
    lock = json.loads(mapping.binding(lock_binding))
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
        and all(lock.get(k) == v for k, v in identity.items()), "same-Run immutable phase lock differs")
    heartbeat_path = request["outputRoot"] + "/heartbeat.json"
    require(active.get("heartbeat") == dict(path=heartbeat_path, ttlSeconds=120), "original heartbeat TTL/path differs")
    io_reader = types.SimpleNamespace(mapping=mapping, path=mapping.path)
    path = mapping.path(heartbeat_path)
    parents = process_io._heartbeat_parents(io_reader, path)
    process_io._heartbeat_check_parents(io_reader, parents)
    # The existing sharing-compatible ordinary-file handle permits atomic host
    # replacement. Validate the exact retained version, not a guessed disk hash.
    with process_io._open_heartbeat_handle(path) as stream:
        before = os.fstat(stream.fileno()); process_io._heartbeat_plain_file(before)
        heartbeat_raw = stream.read(before.st_size + 1)
        after = os.fstat(stream.fileno()); process_io._heartbeat_plain_file(after)
        require(capture._file_identity(before) == capture._file_identity(after)
            and len(heartbeat_raw) == before.st_size, "heartbeat changed in-place")
    heartbeat = json.loads(heartbeat_raw)
    require(heartbeat.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1"
        and heartbeat.get("executionState") == "executing" and heartbeat.get("ttlSeconds") == 120
        and all(heartbeat.get(k) == v for k, v in identity.items()), "same-Run live heartbeat differs")
    stamp = datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00"))
    require(stamp.tzinfo is not None and -300 <= (datetime.now(timezone.utc) - stamp).total_seconds() < 120,
        "heartbeat stale/future")
    process_io._heartbeat_check_parents(io_reader, parents)
    guard_path = mapping.path(".runtime/ai-painter/owned-worker-guards/active.json")
    guard = json.loads(guard_path.read_bytes())
    require(guard.get("runnerPid") == pid and guard.get("executableSha256") == package["interpreter"]["sha256"]
        and Path(guard.get("executable", "")).resolve() == Path(sys.executable).resolve()
        and guard.get("commandSha256") == capture.digest(json.dumps(["-B", *sys.argv], ensure_ascii=False,
            separators=(",", ":")).encode()), "this native guard/invocation differs")
    require(mapping.binding(registry_binding) == raw and identity_reader(pid) == creation, "registry/supervisor changed on final reread")


@contextmanager
def instrument(timings, counts):
    """Exactly one delegation per call; restore on every exit; retain no tensors."""
    original_grad = torch.autograd.grad
    def grad(*args, **kwargs):
        index = counts["autogradAttempts"]
        require(index < 6, "six total VJP ceiling")
        # The frozen zero_update_probe executes D first, then the five G groups.
        label = "discriminator_vjp" if index == 0 else "generator_vjp_" + bridge.COMPONENTS_IN_ORDER[index - 1]
        counts["autogradAttempts"] += 1
        with timings.span(label):
            result = original_grad(*args, **kwargs)
        counts["autogradCompleted"] += 1
        return result
    with ExitStack() as stack:
        for obj, name, label in ((profile, "sample_forward", "generator_forward"),
                (profile, "_generator_candidate", "generator_candidate_total"),
                (profile, "_d_objective", "discriminator_objective"),
                (bridge, "_cpu_carrier", "carrier_build_copy_verify"),
                (bridge, "_verify_carrier", "carrier_full_byte_verification"),
                (bridge.parent, "build_fresh_object_ecology_final_rgb_base_weight_precision", "carrier_fresh_construction"),
                (bridge.frozen, "apply_object_joint_rgb_structure_priority_update_cpu", "cpu_joint_rule")):
            stack.enter_context(patch.object(obj, name, timings.wrap(label, getattr(obj, name))))
        stack.enter_context(patch.object(torch.autograd, "grad", grad))
        yield


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True); parser.add_argument("--request-sha256", required=True)
    parser.add_argument("--policy-sha256", required=True)
    parser.add_argument("--active-registry-sha256")
    args = parser.parse_args()
    times = Timings()
    counts = dict(generatorForwards=0, generatorAutograd=0, discriminatorAutograd=0, autogradAttempts=0,
        autogradCompleted=0, sampleDecodeAttempts=0, decodedSamples=0, optimizerConstruction=0, optimizerUpdates=0,
        resourceChecks=0, authenticationChecks=0, thermalPolls=0)
    result = dict(schemaVersion="decode1-entry-training-cost-worker-result-v1", **BOUNDARY)
    try:
        require(re.fullmatch("[a-f0-9]{64}", args.policy_sha256), "explicit policy SHA required")
        mapping = capture.RuntimeMap.current(ROOT)
        request_binding = binding(dict(path=args.request, sha256=args.request_sha256))
        request = json.loads(mapping.binding(request_binding))
        result.update(runId=request["runId"], mode=request["mode"])
        expected_policy = dict(path=POLICY_PATH, sha256=args.policy_sha256)
        require(request["policy"] == expected_policy, "invocation/policy binding differs")
        policy = json.loads(mapping.binding(expected_policy))
        package_binding = binding(request["package"])
        require(package_binding["path"] == OUTPUT + "/" + request["runId"] + "/package.json", "own package required before read")
        package = json.loads(mapping.binding(package_binding))
        validate_contract(request, package, policy)
        process, affinity = configure_cpu()
        result["cpuAffinity"] = affinity
        programs = package["programBindings"]
        registry_binding = binding(request["registryBefore"]) if request["mode"] == "cpu_prepare" else binding(dict(
            path=".runtime/ai-painter/current-execution-registry/current.json", sha256=args.active_registry_sha256))
        total = sum(len(mapping.binding(binding(b), maximum=1048576)) for b in programs)
        require(total <= 16777216, "source closure aggregate ceiling")
        require(Path(sys.executable).resolve() == Path(package["interpreter"]["path"]).resolve()
            and capture.digest(Path(sys.executable).read_bytes()) == package["interpreter"]["sha256"], "actual Python differs")
        node = shutil.which("node")
        require(node and Path(node).resolve() == Path(package["nodeInterpreter"]["path"]).resolve()
            and capture.digest(Path(node).read_bytes()) == package["nodeInterpreter"]["sha256"], "actual Node differs")
        # Every periodic reauthentication remains dynamic, with fresh immutable
        # bytes and loaded-module checks. No cached 'passed' flags grant authority.
        def authenticate():
            with times.span("dynamic_authentication"):
                counts["authenticationChecks"] += 1
                require(json.loads(mapping.binding(expected_policy)) == policy, "policy changed")
                require(json.loads(mapping.binding(package_binding)) == package, "package changed")
                mapping.binding(request_binding)
                for key in ("package", "plan", "modelIdentity", "failure", "originalSpecificationSnapshot"):
                    mapping.binding(binding(policy["parentEvidence"][key]))
                parent_identity = json.loads(mapping.binding(binding(policy["parentEvidence"]["plan"])))
                require(process_io.runtime_identity(ROOT) == parent_identity["runtimeIdentity"], "dynamic Python/Node runtime identity differs")
                for b in programs: mapping.binding(binding(b), maximum=1048576)
                verify_imports(mapping, programs)
                verify_live_identity(mapping, registry_binding, request, package)
        last_thermal, gpu_identity = [None], [None]
        def resource():
            with times.span("original_protection_checks"):
                counts["resourceChecks"] += 1
                seconds = 120 if request["mode"] == "cpu_prepare" else 180
                require(time.time() * 1000 < request["deadlineUnixMs"] and time.monotonic() - STARTED < seconds,
                    "diagnostic shared deadline exhausted")
                require(torch.get_num_threads() <= 2 and torch.get_num_interop_threads() <= 2
                    and process.cpu_affinity() == affinity and 1 <= len(affinity) <= 2, "two-core/two-thread boundary")
                mapping.check()
                directory = mapping.path(request["outputRoot"])
                require(shutil.disk_usage(directory).free >= 2048 * 1024**2, "disk safety floor")
                require(capture.directory_bytes(directory) <= 134217728 - 65536, "output reserve exhausted")
                if request["mode"] == "cpu_prepare":
                    require(not torch.cuda.is_initialized(), "CPU preparation initialized CUDA")
                elif torch.cuda.is_initialized():
                    require(torch.cuda.current_device() == 0, "current CUDA ordinal differs")
                    torch.cuda.synchronize()  # original protection call, never a timing call
                    free, total = torch.cuda.mem_get_info()
                    low_vram = free < 2048 * 1024**2
                    if low_vram or last_thermal[0] is None or time.monotonic() - last_thermal[0] >= 10:
                        counts["thermalPolls"] += 1
                        queried = subprocess.run(["nvidia-smi", "--query-gpu=index,uuid,temperature.gpu", "--format=csv,noheader,nounits"],
                            capture_output=True, text=True, timeout=min(10, max(.01, request["deadlineUnixMs"] / 1000 - time.time())),
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                        require(queried.returncode == 0, "GPU thermal query failed")
                        driver_bits, actual, temperature = driver_device_zero(queried.stdout)
                        provider_bits, _ = gpu_uuid(torch.cuda.get_device_properties(0).uuid)
                        require(driver_bits == provider_bits and gpu_identity[0] in (None, actual), "GPU UUID differs")
                        require_gpu_poll(int(free), actual, temperature)
                        authenticate()
                        gpu_identity[0], last_thermal[0] = actual, time.monotonic()
                    profile.inherited.core.gpu.check_memory(total=int(total), reserved=int(torch.cuda.max_memory_reserved()),
                        allocated=int(torch.cuda.max_memory_allocated()), device_used=int(total - free), fraction=.7)
        def check_read():
            require(time.time() * 1000 < request["deadlineUnixMs"], "read shared deadline exhausted")
            mapping.check()
        reader = Reader(mapping, programs, check_read)
        reader.spec_mapping = (binding(policy["parentEvidence"]["originalSpecification"]),
            binding(policy["parentEvidence"]["originalSpecificationSnapshot"]))
        with times.span("initial_authentication"): authenticate()
        check_read()
        with ExitStack() as guards:
            for obj, name in ((torch.optim.Optimizer, "__init__"), (torch, "load"), (torch, "save"),
                    (torch.Tensor, "backward"), (torch.autograd, "backward")):
                guards.enter_context(patch.object(obj, name, side_effect=AssertionError("diagnostic prohibited: " + name)))
            if request["mode"] == "cpu_prepare":
                for obj, name in ((torch.cuda, "_lazy_init"), (torch.autograd, "grad"), (torch.nn.Module, "_call_impl")):
                    guards.enter_context(patch.object(obj, name, side_effect=AssertionError("CPU preparation prohibited: " + name)))
            parent_plan = reader.json(policy["parentEvidence"]["plan"])
            data_closure = reader.json(parent_plan["dataClosure"])
            for b in data_closure["bindings"]: reader.allow(b)
            for key in ("datasetManifest", "trainSplit", "validationSplit"):
                require(package["dataBindings"][key] == parent_plan[key], "parent data binding differs")
            require(package["nodeInterpreter"] == dict(path=parent_plan["runtimeIdentity"]["node"]["absolutePath"],
                sha256=parent_plan["runtimeIdentity"]["node"]["sha256"]), "parent Node identity differs")
            require(package["dataBindings"]["regimeDiagnostic"] in data_closure["bindings"], "parent diagnostic binding missing")
            with times.span("data_metadata_authorization"):
                prepared = prepare_metadata(reader, package["dataBindings"], package["scope"]["sampleId"])
            with times.span("fresh_models_seed20260929"):
                model, critic = profile.fresh_networks(prepared[2])
                expected_model = reader.json(policy["parentEvidence"]["modelIdentity"])
                capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), expected_model["graph"])
                initial_state = dict(generator=profile.inherited.core.cpu.state_hash(model),
                    discriminator=profile.inherited.core.cpu.state_hash(critic))
                require(initial_state == expected_model["initialState"], "fresh CPU seed state differs from immutable original fresh identity")
            result["freshModelIdentity"] = dict(parameterTensors=len(tuple(model.parameters())),
                parameterElements=sum(p.numel() for p in model.parameters()), seed=20260929,
                modelCapabilityVersion=profile.MODEL_CAPABILITY, initialCpuState=initial_state)
            require(result["freshModelIdentity"]["parameterTensors"] == 108
                and result["freshModelIdentity"]["parameterElements"] == 2242687, "fresh model graph differs")
            if request["mode"] == "gpu_probe":
                cpu = json.loads(mapping.binding(binding(request["cpuAcceptance"])))
                require(cpu["status"] == "cpu_preparation_passed" and cpu["package"] == package_binding
                    and cpu["policy"] == expected_policy and cpu["worker"]["freshModelIdentity"] == result["freshModelIdentity"],
                    "same-package CPU preparation required")
                with times.span("selected_sample_decode"):
                    sample = load_one(reader, prepared, counts)
                require(not torch.cuda.is_initialized(), "CUDA initialized before admission")
                with times.span("original_cuda_setup_and_transfer"):
                    torch.cuda.init(); torch.cuda.set_device(0); torch.cuda.set_per_process_memory_fraction(.7, 0)
                    require(torch.cuda.is_bf16_supported(), "original D BF16 unavailable")
                    model.to("cuda:0"); critic.to("cuda:0")
                resource()
                commit_observation(mapping, request, package_binding, times, counts)
                def event(stage, kind, gradients=None):
                    # Existing probe event; do not retain or inspect gradient tensors.
                    if stage == "complete":
                        counts[{"forward": "generatorForwards", "generator": "generatorAutograd", "discriminator": "discriminatorAutograd"}[kind]] += 1
                        commit_observation(mapping, request, package_binding, times, counts)
                failure = {}
                with times.span("single_zero_update_probe"), instrument(times, counts):
                    result["probe"] = profile.zero_update_probe(model, critic, sample, prepared[2], resource,
                        event=event, failure_evidence=failure)
                require([counts[k] for k in ("generatorForwards", "generatorAutograd", "discriminatorAutograd", "autogradAttempts", "autogradCompleted")]
                    == [1, 5, 1, 6, 6], "exact single-forward/five-G/one-D counts required")
            reader.unchanged()
            verify_imports(mapping, programs)
            authenticate()  # final identity/source reread; adds no CUDA sync
            if request["mode"] == "gpu_probe": commit_observation(mapping, request, package_binding, times, counts)
        result.update(status="cpu_preparation_passed" if request["mode"] == "cpu_prepare" else "probe_completed_no_training_qualification", executionState="completed")
    except BaseException as error:
        result.update(status="failed_closed", executionState="failed_closed",
            firstError=dict(type=type(error).__name__, message=str(error)[:4096]),
            gradientFailureSummary=getattr(error, "decode1_entry_gradient_summary", None),
            secondaryProbeErrors=[str(e)[:1024] for e in getattr(error, "secondary_probe_errors", [])[:8]])
    timing_report = times.report()
    require(len(json.dumps(timing_report, separators=(",", ":")).encode()) <= 32768, "timing JSON32768 ceiling")
    result.update(counts=counts, timings=timing_report, elapsedSeconds=time.monotonic() - STARTED,
        cudaInitialized=torch.cuda.is_initialized(), **BOUNDARY)
    raw = json.dumps(result, allow_nan=False, separators=(",", ":"))
    require(len(raw.encode()) <= RESOURCES["maxStreamBytes"], "bounded result stream")
    print(raw)
    return 0 if result["executionState"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

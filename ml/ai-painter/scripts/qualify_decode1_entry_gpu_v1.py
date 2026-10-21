"""Same-package CPU preparation / zero-update full-train GPU qualification only."""
from __future__ import annotations
import argparse
from contextlib import ExitStack
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import types
import unittest
from unittest.mock import patch

STARTED = time.monotonic()
ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/tests")]
import torch
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as bridge
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
from ai_painter.complete_world.native_rgb_object_support_structure_device_v1 import train_object_support_structure_candidate_objective
import painter_stage4_object_support_structure_training_profile_v1 as shared

require = capture.require
POLICY_PATH = "data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v1.json"
POLICY_SHA256 = "526a4a3748449a795dcd3cb373c228d245ac52de1ae1b73c6cae0df2cced39eb"
CAPABILITY = bridge.CAPABILITY
MODEL_CAPABILITY = identity.CAPABILITY
OUTPUT_ROOT = ".runtime/ai-painter/decode1-entry-gpu-qualifications"
PROGRAM = "ml/ai-painter/scripts/qualify_decode1_entry_gpu_v1.py"
TEST = "ml/ai-painter/tests/test_decode1_entry_gpu_qualification_cpu_v1.py"
CANONICAL = {"path": "scripts/lib/real-earth-region-governance.mjs",
    "sha256": "c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1"}
RESOURCES = dict(cpuPreparationSeconds=240, gpuQualificationSeconds=720, threads=2, maxGpuMemoryFraction=.7,
    maximumTemperatureC=85, minimumFreeVramMiB=2048, minimumFreeDiskMiB=2048, cpuOutputBytes=8388608,
    gpuOutputBytes=16777216, totalOutputBytes=134217728, maxStreamBytes=8388608, failureReserveBytes=65536,
    cleanupReserveMs=1000, finalizationReserveMs=8000, attempts=1, automaticRetries=0)
PACKAGE_FIELDS = {"schemaVersion", "runId", "capabilityVersion", "modelCapabilityVersion", "policy", "programBindings",
    "interpreter", "nodeInterpreter", "scope", "resources", "dataBindings", "frozenCpuModelBindings"}
QUALIFICATION = dict(gpuQualified=False, trainingAllowed=False, checkpointWritten=False, stage4Qualified=False,
    capabilityReleased=False, runtimeFrameAllowed=False)


def raw_binding(value):
    require(type(value) is dict and {"path", "sha256"} <= set(value) and type(value["path"]) is str
        and type(value["sha256"]) is str and re.fullmatch("[a-f0-9]{64}", value["sha256"]), "exact source binding required")
    return {key: value[key] for key in ("path", "sha256")}


def same(left, right):
    return json.dumps(left, sort_keys=True, separators=(",", ":"), allow_nan=False) == json.dumps(right, sort_keys=True, separators=(",", ":"), allow_nan=False)


def validate_contract(request, package, policy, *, now=None):
    mode = request.get("mode")
    fields = {"schemaVersion", "runId", "mode", "outputRoot", "policy", "package", "deadlineUnixMs"}
    if mode == "gpu_qualify": fields.add("cpuAcceptance")
    require(set(request) == fields and request["schemaVersion"] == "decode1-entry-gpu-qualification-request-v1"
        and mode in ("cpu_prepare", "gpu_qualify"), "exact qualification request ABI required")
    require(re.fullmatch("decode1-entry-qualification-[a-f0-9-]{36}", request["runId"] or "") is not None,
        "dedicated qualification run identity required")
    require(request["outputRoot"] == OUTPUT_ROOT + "/" + request["runId"], "own output namespace required")
    require(request["policy"] == {"path": POLICY_PATH, "sha256": POLICY_SHA256}, "fixed registered policy required")
    require(policy["schemaVersion"] == "ai-painter-decode1-entry-gpu-qualification-policy-v1"
        and policy["status"] == "registered_qualification_route_not_qualified" and policy["allowedModes"] == ["cpu_prepare", "gpu_qualify"]
        and policy["resources"] == RESOURCES and policy["outputRoot"] == OUTPUT_ROOT
        and set(policy["packageFields"]) == PACKAGE_FIELDS, "qualification policy identity/resources differ")
    require(set(package) == PACKAGE_FIELDS and package["schemaVersion"] == "decode1-entry-gpu-qualification-package-v1"
        and package["runId"] == request["runId"] and package["policy"] == request["policy"]
        and package["capabilityVersion"] == policy["capabilityVersion"] == CAPABILITY
        and package["modelCapabilityVersion"] == policy["modelCapabilityVersion"] == MODEL_CAPABILITY,
        "exact same qualification package required")
    for key in ("scope", "resources", "dataBindings", "frozenCpuModelBindings", "nodeInterpreter"):
        require(same(package[key], policy[key]), "package differs from policy: " + key)
    require(policy["metadataCanonicalProgram"] == CANONICAL, "original canonical helper required")
    programs = package["programBindings"]
    require(type(programs) is list and 0 < len(programs) <= 256
        and all(type(b) is dict and set(b) == {"path", "sha256"} for b in programs)
        and len({b["path"] for b in programs}) == len(programs), "bounded unique exact source closure required")
    paths = {b["path"]: raw_binding(b) for b in programs}
    require(all(path in paths for path in (PROGRAM, TEST, CANONICAL["path"], policy["implementations"]["deviceBridge"]))
        and paths[CANONICAL["path"]] == CANONICAL
        and all(paths.get(b["path"]) == b for b in package["frozenCpuModelBindings"]), "own/current/frozen source missing")
    seconds = RESOURCES["cpuPreparationSeconds" if mode == "cpu_prepare" else "gpuQualificationSeconds"]
    require(type(request["deadlineUnixMs"]) is int and 0 < request["deadlineUnixMs"] / 1000
        - (time.time() if now is None else now) <= seconds, "bounded shared phase deadline required")
    require(raw_binding(request["package"])["path"].startswith(request["outputRoot"] + "/"), "package outside own run")
    if mode == "gpu_qualify":
        require(raw_binding(request["cpuAcceptance"])["path"].startswith(request["outputRoot"] + "/"), "CPU record outside same run")


class Reader:
    """Exact source/data reads; snapshots are declared immutable bindings, never guesses."""
    def __init__(self, mapping, programs, resource=lambda: None):
        self.mapping, self.root, self.resource = mapping, mapping.project, resource
        self.observed, self.snapshots, self.forbidden = {}, {}, set()
        self.allowed_rasters, self.rasters = set(), set()
        for binding in programs: self.allow(binding)

    def path(self, logical): return self.mapping.path(logical)

    def allow(self, binding):
        bound = raw_binding(binding)
        previous = self.snapshots.get(bound["path"])
        require(previous is None or previous == bound, "conflicting snapshot binding")
        self.snapshots[bound["path"]] = bound

    def read(self, binding, maximum=64 * 1024**2):
        bound = raw_binding(binding)
        logical = bound["path"]
        require(logical not in self.forbidden and (logical not in self.rasters or logical in self.allowed_rasters),
            "content outside phase/split: " + logical)
        require(not logical.endswith((".pt", ".pth", ".safetensors")), "state/archive reads prohibited")
        self.resource()
        # Allocate only the bound regular file size, retaining the original ceiling.
        size = self.path(logical).lstat().st_size
        require(0 <= size <= maximum, "source allocation ceiling")
        raw = self.mapping.binding(bound, maximum=size)
        require(self.observed.get(logical, bound["sha256"]) == bound["sha256"], "source changed")
        self.observed[logical] = bound["sha256"]
        self.allow(bound)
        return raw

    def json(self, binding): return json.loads(self.read(binding, 8 * 1024**2))

    def snapshot(self, logical):
        require(logical in self.snapshots, "undeclared source snapshot: " + logical)
        bound = self.snapshots[logical]
        return self.read(bound, 8 * 1024**2), dict(bound)

    def unchanged(self):
        for path, sha in tuple(self.observed.items()): self.read({"path": path, "sha256": sha})


def _profile():
    # Only the frozen numerical/data profile, not quality_worker/auth/lifecycle.
    return shared.inherited


def load_samples(reader, data, *, split):
    require(split in ("train", "validation"), "train/validation content only")
    profile = _profile()
    cpu = profile.core.cpu
    require(raw_binding(cpu.MANIFEST) == data["datasetManifest"]
        and raw_binding(cpu.CONDITION_CONTRACT) == data["conditionContract"], "original loader data bindings differ")
    diagnostic = reader.json(data["regimeDiagnostic"])
    require(all(raw_binding(diagnostic[key]) == data[key] for key in ("datasetManifest", "trainSplit", "validationSplit")),
        "original metadata data/splits differ")
    manifest, order, continuous, _selected, _memberships = cpu.select_rows(reader)
    require(same(reader.json(data["datasetManifest"]), manifest), "original dataset differs")
    source = reader.json(manifest["sourceIndex"])
    rows = {row["sampleId"]: row for row in source["samples"]}
    require(len(rows) == len(source["samples"]) == 64, "unique original64 source required")
    for row in source["samples"]:
        if row["split"] not in ("train", "validation"):
            reader.forbidden.update(row[key]["path"] for key in ("image", "conditionPack", "contribution", "sourceRecord"))
        else:
            reader.allow(row["regionSource"])
            reader.rasters.add(row["image"]["path"])
            if row["split"] == split: reader.allowed_rasters.add(row["image"]["path"])
    # Populate only metadata-declared raw snapshot bindings. No self-hashing or
    # historical scan is permitted to repair a missing metadata/source identity.
    for record in diagnostic["rows"]:
        sample_identity = record["identity"]
        require(record["split"] in ("train", "validation"), "metadata identity split differs")
        reader.allow(sample_identity["visualFactManifestFile"])
        for channel in sample_identity["channels"]:
            reader.rasters.add(channel["path"])
            if record["split"] == split: reader.allowed_rasters.add(channel["path"])
        task = reader.json(sample_identity["taskPackage"])
        bindings = task["sourceBindings"]
        for key in ("seasonSnapshot", "regionalProfile"):
            reader.allow({"path": bindings[key + "Path"], "sha256": bindings[key + "Sha256"]})
    metadata = profile.prepare_metadata(reader, data["regimeDiagnostic"], data["conditionContract"])
    ids = reader.json(data[split + "Split"])["sampleIds"]
    require(len(ids) == len(set(ids)) == (48 if split == "train" else 8)
        and ids == metadata["splitSampleIds"][split], "source split/order differs")
    loaded = []
    for ordinal, sample_id in enumerate(ids):
        row = rows[sample_id]
        require(row["split"] == split, "cross-split source")
        sample, actual = cpu.load_sample(reader, row, order, continuous)
        record = metadata["records"][(split, ordinal)]
        require(same({k: v for k, v in actual.items() if k != "ordinal"},
            {k: v for k, v in record["identity"].items() if k != "ordinal"}), "decoded source identity differs")
        loaded.append(profile.bind_sample_ecology(reader, sample, record["identity"], record["regimeRecord"]))
    reader.unchanged()
    return loaded, order


def fresh_networks(order):
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(20260929)
        model = identity.build_fresh_object_ecology_decode1_entry_weight_precision(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
    model.load_state_dict({key: value.detach().clone() for key, value in model.state_dict().items()}, strict=True, assign=False)
    bridge.bind_parameters(model)
    return model, critic


def state_digest(network):
    digest = hashlib.sha256()
    for name, tensor in network.state_dict().items():
        digest.update(json.dumps([name, str(tensor.dtype), list(tensor.shape)], separators=(",", ":")).encode())
        digest.update(tensor.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def model_identity(model, critic):
    identity.validate_model_identity(model)
    named = tuple(model.named_parameters())
    return dict(capabilityVersion=MODEL_CAPABILITY, architecture=identity.ARCHITECTURE, numericRule=identity.NUMERIC_RULE,
        graph=[dict(name=name, shape=list(value.shape), dtype=str(value.dtype)) for name, value in named],
        parameterCount=len(named), parameterElements=sum(p.numel() for _, p in named),
        initialState=dict(generator=state_digest(model), discriminator=state_digest(critic)))


class Calls:
    LIMITS = {"forward": 48, "generator": 240, "discriminator": 48}
    def __init__(self):
        self.counts = {key + suffix: 0 for key in self.LIMITS for suffix in ("Attempted", "Completed")}
        self.counts.update(optimizerConstruction=0, optimizerUpdates=0, cudaCalls=0,
            cudaInitializationAttempted=0, cudaInitializationCompleted=0)
        self.window, self.sample, self.completed_samples = {}, None, []
        self.gradient_summary = []

    def begin(self, sample, ordinal):
        require(ordinal == len(self.completed_samples) and ordinal < 48, "ordered bounded sample required")
        self.sample = dict(sampleId=sample["sampleId"], split=sample["split"], trainOrdinal=ordinal)
        self.window = {key: self.counts[key + "Attempted"] + (5 if key == "generator" else 1) for key in self.LIMITS}

    def event(self, stage, kind, gradients=None):
        require(stage in ("attempt", "complete") and kind in self.LIMITS, "qualification event differs")
        key = kind + ("Attempted" if stage == "attempt" else "Completed")
        value = self.counts[key] + 1
        require(value <= min(self.LIMITS[kind], self.window[kind]), "qualification call ceiling exhausted")
        if stage == "complete": require(value <= self.counts[kind + "Attempted"], "completion without attempt")
        self.counts[key] = value
        if gradients is not None:
            self.gradient_summary.append(dict(kind=kind, tensorCount=len(gradients), unusedTensorCount=sum(v is None for v in gradients),
                allFinite=all(v is None or bool(torch.isfinite(v).all()) for v in gradients)))
            self.gradient_summary[:] = self.gradient_summary[-6:]


def probe(model, critic, sample, order, calls, resource):
    profile = _profile()
    profile.validate_sample_ecology(sample)
    device = next(model.parameters()).device
    with profile.generator_fp32_scope(device): parameters, groups, season, ecology = bridge.bind_parameters(model)
    bound = {**sample, "conditions": sample["conditions"].detach().to(device), "image": sample["image"].detach().to(device)}
    require(all(p.grad is None for network in (model, critic) for p in network.parameters()), "clean probe gradients required")
    raw, labels, forwards = [], [], []
    def event(stage, kind, gradients=None):
        if stage == "attempt": resource()
        calls.event(stage, kind, gradients)
        if stage == "complete": resource()
    def observed(stage, label, gradients):
        if stage == "complete": raw.append(gradients); labels.append(label)
        event(stage, "generator", gradients)
    def forward_seen(*args):
        forwards.append(True)
        require(len(forwards) == 1, "single G forward required")
    with shared._probe_state(model, critic, device):
        handle = model.register_forward_pre_hook(forward_seen)
        try:
            event("attempt", "forward")
            prediction, evidence = profile.sample_forward(model, bound, return_evidence=True)
            event("complete", "forward")
            shared._phase(critic, True)
            d_loss, _ = shared._d_objective(critic, prediction, bound, device)
            event("attempt", "discriminator")
            d_gradients = torch.autograd.grad(d_loss, tuple(critic.parameters()), create_graph=False, allow_unused=True)
            event("complete", "discriminator", d_gradients)
            require(all(v is None or bool(torch.isfinite(v).all()) for v in d_gradients)
                and any(v is not None and bool(v.count_nonzero()) for v in d_gradients), "D gradients nonfinite/zero")
            shared._phase(critic, False)
            frozen_critic = shared._critic_state(critic)
            with profile.generator_fp32_scope(device), bridge.observe_generator_gradients(observed):
                total, parts = train_object_support_structure_candidate_objective(critic, prediction, bound, bound["objectInstanceTable"], order)
                candidate, facts = bridge.compute_generator_candidate_gradients(model=model, critic=critic, sample=bound,
                    actual_total=total, structured_objective=parts["v21UnchangedTotal"], whole_frame_fidelity=parts["wholeFrameFidelity"],
                    object_core_rgb=parts["objectCoreRgbWeighted"], object_support_structure=parts["objectSupportStructureWeighted"])
            require(tuple(labels) == bridge.COMPONENTS_IN_ORDER and len(forwards) == 1, "one-forward/five-VJP provenance differs")
            require(shared._critic_state(critic) == frozen_critic, "G changed frozen critic")
            for index, key, size in ((season, "appearance_regime", 4), (ecology, "ecology_regime", 7)):
                value, active = raw[0][index], int(sample[key].argmax())
                require(value is not None, key + " gradient missing")
                norms = [float(value[:, i].norm()) for i in range(size)]
                require(norms[active] > 0 and all(norms[i] == 0 for i in range(size) if i != active)
                    and candidate[index] is value, key + " slice unreachable/changed")
            for key, indexes in groups.items():
                if bool(bound["conditions"][list(order).index(key)].count_nonzero()):
                    require(any(raw[3][i] is not None and bool(raw[3][i].count_nonzero()) for i in indexes)
                        and facts["generatorGradientFacts"]["headCandidateL2"][key] > 0, "applicable head unreachable: " + key)
            return dict(sampleId=sample["sampleId"], loss=float(total.detach()), discriminatorLoss=float(d_loss.detach()),
                objectCount=evidence["objectCount"], originalGatePassed=True, independentGeneratorVjps=5)
        finally:
            handle.remove()


def configure_cpu():
    import psutil
    process = psutil.Process()
    allowed = process.cpu_affinity()
    require(bool(allowed), "empty allowed CPU affinity")
    selected = allowed[:2]
    process.cpu_affinity(selected)
    actual = process.cpu_affinity()
    require(set(actual) == set(selected) and 1 <= len(actual) <= 2, "CPU affinity readback differs")
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    return process, actual


def verify_imports(reader, programs):
    bindings = {b["path"]: b for b in programs}
    for module in tuple(sys.modules.values()):
        if type(module) is not types.ModuleType: continue
        filename = vars(module).get("__file__")
        if type(filename) is not str: continue
        try: logical = Path(filename).resolve().relative_to(reader.root).as_posix()
        except ValueError: continue
        if logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/", "ml/ai-painter/tests/")) and logical.endswith(".py"):
            require(logical in bindings, "loaded project source unbound: " + logical)
            reader.read(bindings[logical], 1024**2)


def verify_sources(reader, package, policy):
    for b in policy["frozenCpuModelBindings"]: reader.read(b, 1024**2)
    for key in ("acceptance", "terminal", "request", "policy", "originalNormativeBytes"):
        reader.read(policy["priorCpuEvidence"][key], 2 * 1024**2)
    reader.read(policy["formalSpecification"], 2 * 1024**2)
    source = reader.json(policy["originalSourceLocator"])
    original = source["context"]["programBindings"]
    for row in policy["sourceAlgorithmBindings"]:
        binding = raw_binding(row["binding"])
        require(row["role"] == "parameter60_causal_restore_v1" or raw_binding(original[row["role"]]) == binding,
            "original source algorithm binding differs")
        reader.read(binding, 1024**2)
    total = 0
    for binding in package["programBindings"]: total += len(reader.read(binding, 1024**2))
    require(total <= 16 * 1024**2, "source closure aggregate ceiling")
    require(Path(sys.executable).resolve() == Path(package["interpreter"]["path"]).resolve()
        and capture.digest(Path(sys.executable).read_bytes()) == package["interpreter"]["sha256"], "actual Python differs")
    node = shutil.which("node")
    require(node is not None and Path(node).resolve() == Path(package["nodeInterpreter"]["path"]).resolve()
        and capture.digest(Path(node).read_bytes()) == package["nodeInterpreter"]["sha256"], "actual Node differs")
    require(package["nodeInterpreter"] == policy["nodeInterpreter"], "bound Node differs")
    verify_imports(reader, package["programBindings"])


def preparation_abi_tests(reader, package):
    binding = next(b for b in package["programBindings"] if b["path"] == TEST)
    reader.read(binding, 1024**2)
    # Literal import, fixed bound module; no dynamic filename/module dispatch.
    sys.modules.setdefault("qualify_decode1_entry_gpu_v1", sys.modules[__name__])
    import test_decode1_entry_gpu_qualification_cpu_v1 as module
    require(Path(module.__file__).resolve() == reader.path(TEST).resolve(), "own ABI test import origin differs")
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(module.PreparationAbiTests)
    output = io.StringIO()
    result = unittest.TextTestRunner(stream=output, verbosity=0).run(suite)
    require(result.testsRun > 0 and result.wasSuccessful() and not result.skipped,
        "same-process preparation ABI components failed: " + output.getvalue()[-2048:])
    return dict(testsRun=result.testsRun, failures=len(result.failures), errors=len(result.errors), skipped=len(result.skipped),
        status="passed", realModelAutograd=False)


def verify_cpu_acceptance(reader, binding, request, initial):
    acceptance = reader.json(binding)
    require(acceptance["schemaVersion"] == "decode1-entry-gpu-qualification-cpu-acceptance-v1"
        and acceptance["runId"] == request["runId"] and acceptance["package"] == request["package"]
        and acceptance["policy"] == request["policy"] and acceptance["status"] == "cpu_preparation_passed",
        "own same-package successful CPU acceptance required")
    result = acceptance["worker"]
    require(result["status"] == "cpu_preparation_passed" and result["executionState"] == "completed"
        and result["package"] == request["package"] and result["policy"] == request["policy"]
        and result["runId"] == request["runId"] and same(result["modelIdentity"], initial), "same CPU initial model identity required")
    require(all(result["counts"][key] == 0 for key in Calls().counts)
        and result["componentTests"]["status"] == "passed", "own CPU non-compute preparation required")
    owned_binding = raw_binding(acceptance["ownedReceipt"])
    require(owned_binding["path"].startswith(request["outputRoot"] + "/"), "CPU receipt outside same run")
    owned = reader.json(owned_binding)
    proof = owned.get("proof", {})
    require(owned.get("ownerClosed") is True and owned.get("cleanupConfirmed") is True
        and proof.get("activeProcessesAfterCleanup") == 0 and proof.get("exitCode") == 0
        and proof.get("assignedBeforeResume") is True and proof.get("killOnJobClose") is True
        and proof.get("stdoutClosed") is True and proof.get("stderrClosed") is True
        and owned.get("guardReleaseConfirmed") is True and proof.get("stopReason") is None,
        "successful own CPU live Job release required")


def cuda_call(calls, function, *args, **kwargs):
    calls.counts["cudaCalls"] += 1
    return function(*args, **kwargs)


def gpu_uuid(value):
    provider = vars(torch._C).get("_CUuuid")
    require(type(value) is str or (provider is not None and type(value) is provider), "CUDA UUID provider differs")
    text = str(value)
    require(re.fullmatch(r"(?:GPU-)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", text)
        is not None, "standard128 GPU UUID required")
    return text.removeprefix("GPU-").lower()


def result_json(result):
    """Always retain the first failure and counts, even after many source reads."""
    if result["status"] == "failed_closed":
        receipts = result.get("sourceReceipts", {})
        result["sourceReceiptCount"] = len(receipts)
        result["sourceReceiptsSha256"] = capture.digest(json.dumps(receipts, sort_keys=True).encode())
        selected = {}
        for key, value in receipts.items():
            if len(json.dumps({**selected, key: value}).encode()) > 16384: break
            selected[key] = value
        result["sourceReceipts"] = selected
        result["sourceReceiptsTruncated"] = len(selected) != len(receipts)
        result["secondaryProbeErrors"] = [str(v)[:2048] for v in result.get("secondaryProbeErrors", [])[:8]]
        # Initial complete graph is already in the immutable CPU record. Do not
        # let its repetition crowd out this failure's sample and real counts.
        if "modelIdentity" in result:
            result["modelIdentity"] = {k: v for k, v in result["modelIdentity"].items() if k != "graph"}
    raw = json.dumps(result, allow_nan=False, separators=(",", ":"))
    require(len(raw.encode()) <= (65536 if result["status"] == "failed_closed" else RESOURCES["maxStreamBytes"]),
        "bounded worker result exceeded")
    return raw


def run(request, package, policy, reader, calls, result, process):
    mode = request["mode"]
    reader.resource()
    samples, order = load_samples(reader, package["dataBindings"], split="validation" if mode == "cpu_prepare" else "train")
    result["sampleIds"] = [sample["sampleId"] for sample in samples]
    reader.resource()
    model, critic = fresh_networks(order)
    initial = model_identity(model, critic)
    result.update(modelIdentity=initial, stateDigestBefore=initial["initialState"], stateDigestAfter=None)
    if mode == "cpu_prepare":
        result["componentTests"] = preparation_abi_tests(reader, package)
        result["stateDigestAfter"] = dict(generator=state_digest(model), discriminator=state_digest(critic))
        require(result["stateDigestBefore"] == result["stateDigestAfter"], "CPU fresh identity/reload state changed")
        return
    verify_cpu_acceptance(reader, request["cpuAcceptance"], request, initial)
    require(not torch.cuda.is_initialized(), "GPU must initialize only after same-package CPU verification")
    calls.counts["cudaInitializationAttempted"] += 1
    cuda_call(calls, torch.cuda.init)
    calls.counts["cudaInitializationCompleted"] += 1
    cuda_call(calls, torch.cuda.set_device, 0)
    cuda_call(calls, torch.cuda.set_per_process_memory_fraction, .7, 0)
    require(cuda_call(calls, torch.cuda.is_bf16_supported), "original D BF16 unavailable")
    reader.resource()
    cuda_call(calls, model.to, "cuda:0")
    cuda_call(calls, critic.to, "cuda:0")
    require(dict(generator=state_digest(model), discriminator=state_digest(critic)) == result["stateDigestBefore"],
        "device transfer changed CPU initial state")
    reader.resource()
    for ordinal, sample in enumerate(samples):
        calls.begin(sample, ordinal)
        facts = probe(model, critic, sample, order, calls, reader.resource)
        calls.completed_samples.append(facts["sampleId"])
    require(all(calls.counts[key + suffix] == ceiling for key, ceiling in Calls.LIMITS.items()
        for suffix in ("Attempted", "Completed")), "exact full48 GPU counts required")
    result["stateDigestAfter"] = dict(generator=state_digest(model), discriminator=state_digest(critic))
    require(result["stateDigestBefore"] == result["stateDigestAfter"], "GPU G/D state changed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    args = parser.parse_args()
    calls, result = Calls(), dict(schemaVersion="decode1-entry-gpu-qualification-worker-result-v1", **QUALIFICATION)
    reader = None
    try:
        mapping = capture.RuntimeMap.current(ROOT)
        request = json.loads(mapping.binding({"path": args.request, "sha256": args.request_sha256}))
        result.update(runId=request.get("runId"), mode=request.get("mode"), policy=request.get("policy"), package=request.get("package"))
        require(request.get("policy") == {"path": POLICY_PATH, "sha256": POLICY_SHA256}, "fixed policy before any control reads")
        require(re.fullmatch("decode1-entry-qualification-[a-f0-9-]{36}", request.get("runId") or "") is not None
            and raw_binding(request["package"])["path"].startswith(OUTPUT_ROOT + "/" + request["runId"] + "/")
            and request["package"]["path"].endswith(".json"), "own JSON package before any package read")
        policy = json.loads(mapping.binding(raw_binding(request["policy"])))
        package = json.loads(mapping.binding(raw_binding(request["package"])))
        validate_contract(request, package, policy)
        process, affinity = configure_cpu()
        result["cpuAffinity"] = affinity
        last_thermal, gpu_identity = [None], [None]
        def resource():
            seconds = 240 if request["mode"] == "cpu_prepare" else 720
            require(time.time() * 1000 < request["deadlineUnixMs"] and time.monotonic() - STARTED < seconds,
                "qualification shared deadline exhausted")
            require(torch.get_num_threads() <= 2 and torch.get_num_interop_threads() <= 2
                and set(process.cpu_affinity()) == set(affinity) and len(affinity) <= 2, "CPU resource boundary exceeded")
            mapping.check()
            directory = mapping.path(request["outputRoot"])
            require(shutil.disk_usage(directory).free >= 2048 * 1024**2, "disk safety floor")
            require(capture.directory_bytes(directory) <= RESOURCES["totalOutputBytes"] - 65536, "output reserve exhausted")
            if request["mode"] == "cpu_prepare":
                require(not torch.cuda.is_initialized(), "CPU preparation initialized CUDA")
            elif torch.cuda.is_initialized():
                cuda_call(calls, torch.cuda.synchronize)
                free, total = cuda_call(calls, torch.cuda.mem_get_info)
                require(free >= 2048 * 1024**2, "VRAM safety floor")
                _profile().core.gpu.check_memory(total=int(total), reserved=int(cuda_call(calls, torch.cuda.max_memory_reserved)),
                    allocated=int(cuda_call(calls, torch.cuda.max_memory_allocated)), device_used=int(total - free), fraction=.7)
                if last_thermal[0] is None or time.monotonic() - last_thermal[0] >= 10:
                    queried = subprocess.run(["nvidia-smi", "--query-gpu=index,uuid,temperature.gpu", "--format=csv,noheader,nounits"],
                        capture_output=True, text=True, timeout=min(10, max(.01, request["deadlineUnixMs"] / 1000 - time.time())),
                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                    require(queried.returncode == 0, "GPU thermal query failed")
                    rows = [line.split(",") for line in queried.stdout.strip().splitlines()]
                    zero = [row for row in rows if len(row) == 3 and row[0].strip() == "0"]
                    require(len(zero) == 1 and float(zero[0][2]) <= 85, "GPU temperature/ordinal differs")
                    actual = gpu_uuid(zero[0][1].strip())
                    provider = gpu_uuid(cuda_call(calls, torch.cuda.get_device_properties, 0).uuid)
                    require(actual == provider and gpu_identity[0] in (None, actual), "GPU UUID differs")
                    gpu_identity[0], last_thermal[0] = actual, time.monotonic()
        reader = Reader(mapping, package["programBindings"], resource)
        resource()
        verify_sources(reader, package, policy)
        with ExitStack() as guards:
            for obj, name in ((torch.optim.Optimizer, "__init__"), (torch, "load"), (torch, "save"),
                    (torch.Tensor, "backward"), (torch.autograd, "backward")):
                guards.enter_context(patch.object(obj, name, side_effect=AssertionError("qualification prohibited: " + name)))
            if request["mode"] == "cpu_prepare":
                for obj, name in ((torch.cuda, "_lazy_init"), (torch.autograd, "grad")):
                    guards.enter_context(patch.object(obj, name, side_effect=AssertionError("CPU preparation prohibited: " + name)))
            run(request, package, policy, reader, calls, result, process)
        verify_imports(reader, package["programBindings"])
        reader.unchanged()
        resource()
        result.update(status="cpu_preparation_passed" if request["mode"] == "cpu_prepare" else "gpu_qualification_passed", executionState="completed")
    except BaseException as error:
        result.update(status="failed_closed", executionState="failed_closed", firstError=dict(type=type(error).__name__, message=str(error)[:4096]),
            sampleIdentity=calls.sample, finiteGradientSummaries=calls.gradient_summary,
            gradientFailureSummary=getattr(error, "decode1_entry_gradient_summary", None),
            secondaryProbeErrors=getattr(error, "secondary_probe_errors", []), fullSnapshotCaptured=False)
    finally:
        result.update(counts=dict(calls.counts), completedSampleIds=list(calls.completed_samples),
            sourceReceipts={} if reader is None else dict(reader.observed), elapsedSeconds=time.monotonic() - STARTED,
            cudaInitialized=torch.cuda.is_initialized(), cudaCallsScope="explicit worker CUDA setup/resource APIs, not nested kernels",
            **QUALIFICATION)
        print(result_json(result))
    return 0 if result["executionState"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Single governed target-88 CPU candidate check. No training or GPU entry."""
import argparse
import collections
from contextlib import ExitStack
import hashlib
import io
import json
import os
from pathlib import Path
import pickle
import re
import random
import sys
import time
from unittest.mock import patch
import zipfile
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/scripts")]
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as candidate
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as parent
from ai_painter.complete_world import object_support_final_rgb_weight_priority_update_v1 as bridge
from ai_painter.complete_world import final_rgb_base_weight_reduction_precision_v1 as operator
from ai_painter.complete_world.native_rgb_object_support_structure_device_v1 import train_object_support_structure_candidate_objective
import painter_stage4_ecology_terrain_detail_weight_training_profile_v1 as profile

POLICY_PATH = "data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-precision-cpu-policy-v2.json"
POLICY_SHA256 = "71e895f3dc744c76880c0f405cf42d9349a6dfdc4c233ec751ac73809d5ff438"
SOURCE_SNAPSHOT_MODULE = "scripts/lib/real-earth-region-governance.mjs"
PREDECESSOR = {
    "policy": {"path":"data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-precision-cpu-policy-v1.json","sha256":"fc2bd9e7e2e2a2c1698c3d1801accad8906c8bf24bad86eb142bd8f1f9fccd02"},
    "claim": {"path":".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks/attempt-v1.json","sha256":"6f0d6c82e594b3f8c051c0d18f0a834b15bb110e56917ae6e3a934dbc1c523d5"},
    "failure": {"path":".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks/final-rgb-base-cpu-447b84a5-26e4-43f2-8cf2-7b13d04ed7da/failure.json","sha256":"39dbeeb34182395dae690512cb86800ce79ba4910bbbc79037b473c9e1958189"},
    "repairReview": {"path":".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/coordination-20261016/finalrgb88-candidate-and-checker-acceptance-v1.json","sha256":"e9ec3e744a9111ffd88b85a9353712157231ec2a5ddf006600fc75855d68d500"},
    "reason":"checker_source_binding_omission_before_complete_forward",
}
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-169-forested-low-mountain-v2"
LOCATOR = {"path": ".runtime/ai-painter/object-support-structure-quality-executions/object-support-quality-v1-e03cae36-386e-4919-b83c-a8441ab7115c/gradient-failure/manifest.json", "sha256": "6fa557bad90e86ed90c83b9686bbcf77842215eb4839a9bbd53ca2b851e93605"}
FIXTURE_ROOT = ".runtime/ai-painter/parameter88-causal-gpu-diagnostics/parameter88-gpu-3e129698-8867-4b5d-aaed-7ea65a65b45e/"
FIXTURES = {
    "originalGateFailure": {"path": FIXTURE_ROOT + "original-gate-failure.json", "sha256": "b84df56ee6b034515ecc6dffcf6d5fb35523c95b9e37adee59a9ccf14f72d7f3", "bytes": 414},
    "tensors": {"path": FIXTURE_ROOT + "target-capture.pt", "sha256": "923e84b1fc6404526c5d31e967ac1e59c10013c729e1e142e097d4dbb4bed950", "bytes": 57041730},
    "metadata": {"path": FIXTURE_ROOT + "target-capture.json", "sha256": "a420bf8809f215ed01819ce203efce0efe61518c4d1064aff156cf984b7fafd6", "bytes": 3303},
    "contrastTensors": {"path": FIXTURE_ROOT + "local-contrast.pt", "sha256": "715007b747e0934a582fca69f57c9db9042bc1bc134fda6563d00b09243ee276", "bytes": 1828546},
}
LIMITS = {"fullBaselineForwards": 1, "fullCandidateForwards": 1, "fullGeneratorAutogradCalls": 5,
    "operatorFixtureForwards": 1, "operatorFixtureAutogradCalls": 5, "discriminatorAutogradCalls": 0,
    "optimizerConstruction": 0, "optimizerUpdates": 0, "cudaCalls": 0}
require = capture.require


def raw_binding(b):
    require(isinstance(b, dict) and isinstance(b.get("path"), str) and re.fullmatch("[a-f0-9]{64}", b.get("sha256", "")), "exact byte binding required")
    return {k: b[k] for k in ("path", "sha256")}


def digest(value):
    return capture.tensor_sha(value.detach().cpu().contiguous())


def states(network):
    return {name: digest(value) for name, value in network.state_dict().items()}


def network_snapshot(network):
    return states(network), tuple((id(v), v._version, v.requires_grad, id(v.grad), v.untyped_storage().data_ptr()) for v in network.parameters()), tuple((id(m), m.training) for m in network.modules())


class SingleSampleReader:
    def __init__(self, mapping, resource, program_bindings):
        self.mapping, self.resource, self.allowed, self.observed = mapping, resource, {}, {}
        self.root = mapping.project
        require(type(program_bindings) in (list, tuple) and len(program_bindings) <= 256,
            "bounded current program source closure required")
        for binding in program_bindings:
            require(type(binding) is dict and set(binding) == {"path", "sha256"}, "exact current source binding required")
            binding = raw_binding(binding)
            logical = binding["path"]
            require("\\" not in logical and ":" not in logical and not logical.startswith("/")
                and all(part not in ("", ".", "..") for part in logical.split("/"))
                and ((logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/", "ml/ai-painter/tests/")) and logical.endswith(".py"))
                    or (logical.startswith(("scripts/", "src/")) and logical.endswith(".mjs"))
                    or (logical.startswith("scripts/windows/") and logical.endswith(".cs"))),
                "current source closure paths only; no historical data/archive paths")
            require(logical not in self.allowed, "duplicate current source binding")
            self.allow(binding)

    def allow(self, b):
        b = raw_binding(b)
        require(self.allowed.setdefault(b["path"], b) == b, "source binding conflict")

    def read(self, b):
        b = raw_binding(b)
        require(self.allowed.get(b["path"]) == b and not b["path"].endswith(".pt"), "undeclared or state archive read")
        self.resource()
        value = self.mapping.binding(b, maximum=64 * 1024**2)
        self.observed[b["path"]] = b["sha256"]
        return value

    def json(self, b):
        return json.loads(self.read(b))

    def snapshot(self, logical):
        require(logical in self.allowed, "undeclared source snapshot")
        b = self.allowed[logical]
        return self.read(b), dict(b)

    def unchanged(self):
        for name, sha in tuple(self.observed.items()):
            self.read({"path": name, "sha256": sha})


def load_train_sample(mapping, locator, resource, program_bindings):
    identity = locator["context"]["sampleIdentity"]
    require(identity["sampleId"] == SAMPLE_ID and identity["split"] == "train", "fixed train-169 identity required")
    # Only the current request's already authenticated closure is registered.
    # The locator's historical programBindings are deliberately not consulted.
    reader = SingleSampleReader(mapping, resource, program_bindings)
    cpu = profile.core.cpu
    reader.allow(cpu.MANIFEST)
    dataset = reader.json(cpu.MANIFEST)
    reader.allow(dataset["sourceIndex"])
    source = reader.json(dataset["sourceIndex"])
    rows = [r for r in source["samples"] if r["sampleId"] == SAMPLE_ID]
    require(len(rows) == 1 and rows[0]["split"] == "train", "unique train row required")
    row = rows[0]
    require(row["image"] == identity["image"] and row["conditionPack"] == identity["conditionPack"], "original sample row differs")
    reader.allow(cpu.CONDITION_CONTRACT)
    contract = reader.json(cpu.CONDITION_CONTRACT)
    order = contract["tensorContract"]["channelOrder"]
    continuous = contract["tensorContract"]["typePartitions"]["continuous"]
    require(order == dataset["identityPayload"]["channelOrder"] == [c["id"] for c in identity["channels"]]
        and continuous == dataset["identityPayload"]["continuousChannelIds"], "original channel type/resize differs")
    for key in ("image", "conditionPack", "contribution", "sourceRecord", "regionSource"):
        reader.allow(row[key])
    for key in ("taskPackage", "visualFactManifestFile"):
        reader.allow(identity[key])
    for b in identity["channels"]:
        reader.allow(b)
    task = reader.json(identity["taskPackage"])
    bindings = task["sourceBindings"]
    require(bindings["naturalizedWorldFactsSha256"] == identity["factHash"], "fact binding differs")
    reader.allow({"path": bindings["naturalizedWorldFactsPath"], "sha256": bindings["naturalizedWorldFactsSha256"]})
    for key in ("seasonSnapshot", "regionalProfile"):
        reader.allow({"path": bindings[key + "Path"], "sha256": bindings[key + "Sha256"]})
    require(row["regionSource"]["path"] == bindings["realEarthRegionSourcePackagePath"], "raw region path differs")
    provenance = reader.json(row["regionSource"])["sourceProvenance"]
    reader.allow({"path": provenance["sourceRegistryPath"], "sha256": provenance["sourceRegistrySha256"]})
    sample, reproduced = cpu.load_sample(reader, row, order, continuous)
    require(reproduced == identity, "pure loader reproduced sample identity differs")
    record, _, _ = profile.predecessor.derive_regime_record(reader, identity)
    sample = profile.bind_sample_ecology(reader, sample, identity, record)
    profile.validate_sample_ecology(sample)
    reader.unchanged()
    return sample, order, reader


def _rebuild(storage, offset, shape, stride, requires_grad=False, hooks=None):
    require(type(storage) is dict and requires_grad is False and not hooks, "inert tensor metadata required")
    return dict(storage=storage, offset=offset, shape=tuple(shape), stride=tuple(stride))


class FixtureUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) in (("torch._utils", "_rebuild_tensor_v2"), ("torch._utils", "_rebuild_tensor")):
            return _rebuild
        if module == "torch" and name == "FloatStorage":
            return name
        if (module, name) == ("collections", "OrderedDict"):
            return collections.OrderedDict
        raise ValueError("forbidden fixture pickle global: " + module + "." + name)

    def persistent_load(self, pid):
        require(type(pid) is tuple and len(pid) == 5 and pid[0] == "storage" and pid[1] == "FloatStorage"
            and type(pid[2]) is str and pid[2].isdecimal() and pid[3] == "cpu" and type(pid[4]) is int
            and 0 < pid[4] <= 2359296, "fixture storage metadata differs")
        return dict(key=pid[2], elements=pid[4])


def decode_fixture(raw, metadata):
    """Decode only input + five adjoints, never captured weight gradients/state."""
    labels = list(bridge.COMPONENTS_IN_ORDER)
    require(metadata["labels"] == labels and metadata["parameterIndex"] == 88
        and metadata["parameterName"] == candidate.TARGET + ".weight", "target fixture metadata differs")
    wanted = ["input"] + ["adjoint." + label for label in labels]
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        entries = z.infolist()
        require(len(entries) < 64 and len({i.filename for i in entries}) == len(entries)
            and sum(i.file_size for i in entries) <= 64 * 1024**2
            and all(i.compress_type == zipfile.ZIP_STORED and not i.flag_bits & 1 for i in entries), "bounded uncompressed fixture ZIP required")
        prefixes = {i.filename.split("/")[0] for i in entries}
        require(len(prefixes) == 1, "single archive prefix required")
        prefix = prefixes.pop() + "/"
        for i in entries:
            tail = i.filename[len(prefix):]
            require(tail in ("data.pkl", "byteorder", "version", ".data/serialization_id", ".format_version", ".storage_alignment")
                or (tail.startswith("data/") and tail[5:].isdecimal()), "unexpected ZIP entry")
        require(z.read(prefix + "byteorder") == b"little" and z.getinfo(prefix + "data.pkl").file_size <= 2 * 1024**2, "pickle/endianness bound")
        descriptors = FixtureUnpickler(io.BytesIO(z.read(prefix + "data.pkl"))).load()
        require(type(descriptors) in (dict, collections.OrderedDict) and set(descriptors) == set(wanted) | {"gradient." + l for l in labels}, "exact fixture archive keys required")
        values, storages = {}, set()
        for key in wanted:
            desc, md = descriptors[key], metadata["descriptors"][key]
            require(desc["shape"] == (1, 48, 192, 256) and desc["stride"] == (2359296, 49152, 256, 1)
                and desc["offset"] == 0 and desc["storage"]["elements"] == 2359296
                and desc["storage"]["key"] not in storages, "fixture tensor shape/stride/alias differs")
            storages.add(desc["storage"]["key"])
            entry = prefix + "data/" + desc["storage"]["key"]
            require(z.getinfo(entry).file_size == md["bytes"] == 9437184, "fixture storage length differs")
            value = torch.frombuffer(bytearray(z.read(entry)), dtype=torch.float32).clone().reshape(desc["shape"])
            require(md["dtype"] == "torch.float32" and md["shape"] == list(desc["shape"]) and md["stride"] == list(desc["stride"])
                and digest(value) == md["sha256"] and bool(torch.isfinite(value).all()), "fixture descriptor hash/type/finite differs")
            values[key] = value
        return values


def verify_imports(mapping, bindings):
    index = {b["path"]: b for b in bindings}
    require(len(index) == len(bindings), "source binding duplicates")
    for module in tuple(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if not filename:
            continue
        try:
            logical = Path(filename).resolve().relative_to(mapping.project).as_posix()
        except ValueError:
            continue
        if logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/")) and logical.endswith(".py"):
            require(logical in index, "actual imported source unbound: " + logical)
            mapping.binding(index[logical], maximum=1024**2)


def verify_predecessor(mapping, policy):
    require(policy["predecessorVerification"] == PREDECESSOR, "exact predecessor bindings/reason required")
    old, claim, failure = (json.loads(mapping.binding(PREDECESSOR[key])) for key in ("policy","claim","failure"))
    mapping.binding(PREDECESSOR["repairReview"])
    require(old["schemaVersion"] == "ai-painter-final-rgb-base-weight-precision-cpu-policy-v1"
        and all(old[key] == policy[key] for key in ("candidate","target","scope","resources","limits","comparison","qualification")),
        "predecessor scope/budget differs")
    require(claim["policy"] == PREDECESSOR["policy"] and claim["automaticRetries"] == 0, "original claim identity differs")
    worker = json.loads(failure["stdout"])
    require(failure["schemaVersion"] == "final-rgb-base-precision-cpu-terminal-v1"
        and failure["status"] == worker["status"] == "cpu_candidate_failed_closed"
        and failure["executionState"] == worker["executionState"] == "failed_closed"
        and failure["runId"] == worker["runId"] == claim["runId"] and worker["policy"] == PREDECESSOR["policy"],
        "original failed run identity differs")
    counts = {**LIMITS,"fullBaselineForwards":0,"fullCandidateForwards":0,"fullGeneratorAutogradCalls":0}
    require(worker["counts"] == counts and worker["error"] == {"type":"ValueError","message":"undeclared source snapshot"}
        and worker["trainingAllowed"] is False and worker["stage4Qualified"] is False,
        "original failure phase/counts/error differs")
    receipt = failure["ownedReceipt"]
    require(all(receipt[key] is True for key in ("cleanupConfirmed","guardReleaseConfirmed","emptyJob","liveOwnerCleanupConfirmed"))
        and receipt["ownerExitCode"] == 0, "original cleanup/guard release evidence differs")
    return PREDECESSOR


def validate_request(request, policy, now=None):
    require(request["schemaVersion"] == "final-rgb-base-precision-cpu-request-v1" and request["policy"] == {"path":POLICY_PATH,"sha256":POLICY_SHA256},
        "dedicated CPU request required")
    require(request["verificationRevision"] == policy["verificationRevision"] == 2
        and request["predecessorVerification"] == policy["predecessorVerification"] == PREDECESSOR
        and policy["attemptClaimPath"] == ".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks/attempt-v2.json",
        "exact revision2 predecessor/claim boundary required")
    require(policy["schemaVersion"] == "ai-painter-final-rgb-base-weight-precision-cpu-policy-v1"
        and policy["status"] == "registered_cpu_candidate_verification_only" and policy["candidate"] == candidate.CAPABILITY
        and policy["formalSpecification"] == {"path":"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
            "version":"AI-PAINTER-SPEC-1.76","sha256":"59b3ba516d3b7749cd602f7937401d124cdc33f63021539ee8d488eb21764880"},
        "registered independent CPU policy required")
    require(policy["target"] == {"parameterIndex": 88, "parameterName": candidate.TARGET + ".weight", "weightShape": [48,48,3,3]}, "only target 88")
    require(policy["scope"] == {"resolution": [256,192], "sampleId": SAMPLE_ID, "split": "train", "sampleCount": 1,
        "originalDataSplits": "48/8/4/4 unchanged", "initializationSeed": 20260929, "parameterCount": 108,
        "parameterElements": 2242687, "failureStateInitializationAllowed": False}, "fixed fresh train scope")
    require(policy["dataLocator"] == LOCATOR and policy["operatorFixture"] == FIXTURES and policy["limits"] == LIMITS, "fixed artifacts and operation ceilings")
    require(policy["resources"] == {"maxWallSeconds":120,"threads":2,"maxOutputBytes":8388608,"maxStreamBytes":8388608,
        "failureReserveBytes":65536,"cleanupReserveMs":1000,"finalizationReserveMs":8000,"attempts":1,"automaticRetries":0}, "fixed resource budget")
    require(policy["comparison"] == {"atol":1e-6,"rtol":1e-5,"originalGateKept":True,"nativeForwardBytesIdentical":True,
        "onlyTargetWeightGradientChanged":True}, "unchanged numeric gate")
    require(policy["qualification"] == {"gpuExecutionAllowed":False,"trainingAllowed":False,"checkpointWritten":False,
        "stage4Qualified":False,"capabilityReleased":False,"runtimeFrameAllowed":False}, "inactive CPU qualification")
    require(0 < request["deadlineUnixMs"] / 1000 - (time.time() if now is None else now) <= 120, "bounded deadline")


def run_check(mapping, request, policy, resource, counts):
    metadata = None
    fixture_raw = None
    for role, binding in policy["operatorFixture"].items():
        resource()
        raw = mapping.binding(raw_binding(binding), maximum=64 * 1024**2)
        require(len(raw) == binding["bytes"], "fixture artifact size differs")
        if role == "metadata":
            metadata = json.loads(raw)
        elif role == "tensors":
            fixture_raw = raw
        # The local contrast and original failure are hash-bound provenance,
        # never model initialization or numerical inputs to this check.
    captured = decode_fixture(fixture_raw, metadata)
    del fixture_raw
    weight = torch.zeros((48,48,3,3), requires_grad=True)
    bias = torch.zeros(48)
    counts["operatorFixtureForwards"] += 1
    output = operator.final_rgb_base_weight_reduction_precision(captured["input"], weight, bias)
    rows, hashes = [], []
    for i, label in enumerate(bridge.COMPONENTS_IN_ORDER):
        resource()
        counts["operatorFixtureAutogradCalls"] += 1
        gradient = torch.autograd.grad(output, weight, grad_outputs=captured["adjoint." + label], retain_graph=i < 4)[0]
        require(bool(torch.isfinite(gradient).all()), "fixture gradient nonfinite")
        rows.append(gradient)
        hashes.append({"label":label,"sha256":digest(gradient)})
    expected = ((rows[1] + rows[2]) + rows[3]) + rows[4]
    outside = int((~torch.isclose(rows[0], expected, atol=1e-6, rtol=1e-5)).count_nonzero())
    require(outside == 0, "captured input/adjoint operator fixture remains outside original gate")
    del captured, output, rows, weight, bias
    resource()
    locator = json.loads(mapping.binding(policy["dataLocator"]))
    sample, order, reader = load_train_sample(mapping, locator, resource, request["programBindings"])
    sample_before = {key:digest(sample[key]) for key in ("image","conditions","appearance_regime","ecology_regime")}
    instances_before = json.dumps(sample["objectInstanceTable"],sort_keys=True,allow_nan=False)
    baseline, critic = profile.fresh_networks(order)
    model = candidate.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=order)
    require(type(baseline) is parent.TerrainDetailWeightPrecisionEcologyRenderer, "fresh exact baseline required")
    a, b = tuple(model.named_parameters()), tuple(baseline.named_parameters())
    require(len(a) == len(b) == 108 and all(n == m and digest(v) == digest(w) for (n,v),(m,w) in zip(a,b)), "all fresh parameter bytes differ")
    profile._phase(critic, False)
    before = tuple(network_snapshot(net) for net in (baseline, model, critic))
    rng = torch.get_rng_state().clone()
    py_rng, numpy_rng, backend = random.getstate(), profile.np.random.get_state(), profile._backend_snapshot()
    observed, forward_hashes = [], {}
    def event(stage, label, values):
        resource()
        require(label == bridge.COMPONENTS_IN_ORDER[len(observed)], "real gradient order differs")
        if stage == "attempt":
            counts["fullGeneratorAutogradCalls"] += 1
        else:
            require(stage == "complete" and type(values) is tuple and len(values) == 108, "complete 108 raw gradients required")
            observed.append(label)
    with profile.generator_fp32_scope(torch.device("cpu")):
        with torch.no_grad():
            counts["fullBaselineForwards"] += 1
            native = profile.sample_forward(baseline, sample)
        counts["fullCandidateForwards"] += 1
        prediction = profile.sample_forward(model, sample)
        require(tuple(prediction.shape) == (1,3,192,256) and digest(prediction) == digest(native), "full256 native forward bytes differ")
        forward_hashes = {"baseline":digest(native),"candidate":digest(prediction)}
        resource()
        total, parts = train_object_support_structure_candidate_objective(critic, prediction, sample, sample["objectInstanceTable"], order)
        with bridge.observe_generator_gradients(event):
            gradients, facts = bridge.compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
                actual_total=total, structured_objective=parts["v21UnchangedTotal"], whole_frame_fidelity=parts["wholeFrameFidelity"],
                object_core_rgb=parts["objectCoreRgbWeighted"], object_support_structure=parts["objectSupportStructureWeighted"])
    require(observed == list(bridge.COMPONENTS_IN_ORDER) and counts == LIMITS, "exact real operation counts differ")
    require(len(gradients) == 108 and all(bool(torch.isfinite(v).all()) for v in gradients), "complete finite checked gradients required")
    require(before == tuple(network_snapshot(net) for net in (baseline, model, critic))
        and torch.equal(rng, torch.get_rng_state()), "G/D state/mode/flags/grad/RNG changed")
    numpy_after = profile.np.random.get_state()
    require(random.getstate() == py_rng and numpy_rng[0] == numpy_after[0]
        and profile.np.array_equal(numpy_rng[1],numpy_after[1]) and numpy_rng[2:] == numpy_after[2:]
        and profile._backend_snapshot() == backend, "Python/NumPy RNG or original backend changed")
    require(sample_before == {key:digest(sample[key]) for key in sample_before}
        and instances_before == json.dumps(sample["objectInstanceTable"],sort_keys=True,allow_nan=False), "bound sample tensors/instances changed")
    reader.unchanged()
    verify_imports(mapping, request["programBindings"])
    resource()
    return {"status":"cpu_candidate_verified_inactive","executionState":"completed","candidate":candidate.CAPABILITY,
        "capturedFixtureOutsideToleranceElements":outside,"fixtureGradientHashes":hashes,"fixtureDecodedTensorKeys":["input"] + ["adjoint." + l for l in bridge.COMPONENTS_IN_ORDER],
        "nativeFull256ForwardBytesEqual":True,"fullForwardHashes":forward_hashes,"fullOriginalLossGradientGatePassed":True,
        "gradientFacts":facts,"sourceReceipts":reader.observed,"beforeAfterStateBytesEqual":True,
        "failedStateOrCheckpointLoaded":False,"pngOrCheckpointWritten":False,"cudaInitialized":False,
        "trainingAllowed":False,"stage4Qualified":False,"checkpointWritten":False}


def main():
    began = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    args = parser.parse_args()
    mapping = capture.RuntimeMap.current(ROOT)
    request = json.loads(mapping.binding({"path":args.request,"sha256":args.request_sha256}))
    require(request["policy"]["path"] == POLICY_PATH, "fixed policy path")
    policy = json.loads(mapping.binding(request["policy"]))
    validate_request(request, policy)
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "CPU visibility required")
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    deadline = request["deadlineUnixMs"] / 1000
    def resource():
        require(time.time() < deadline and time.monotonic() - began < 120, "CPU candidate deadline exceeded")
        require(not torch.cuda.is_initialized() and torch.get_num_threads() <= 2 and torch.get_num_interop_threads() <= 2, "CPU boundary")
        mapping.check()
    counts = {key:0 for key in LIMITS}
    try:
        resource()
        verify_predecessor(mapping, policy)
        mapping.binding(raw_binding(policy["formalSpecification"]))
        require(Path(sys.executable).resolve() == Path(request["interpreter"]["path"]).resolve()
            and hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest() == request["interpreter"]["sha256"], "interpreter identity differs")
        for b in request["programBindings"]:
            mapping.binding(b, maximum=1024**2)
        for item in policy["sourceAlgorithmBindings"]:
            mapping.binding(raw_binding(item["binding"]), maximum=1024**2)
        verify_imports(mapping, request["programBindings"])
        require(any(b["path"] == SOURCE_SNAPSHOT_MODULE for b in request["programBindings"]),
            "current source closure missing required canonical snapshot module: " + SOURCE_SNAPSHOT_MODULE)
        with ExitStack() as guards:
            for obj, name in ((torch.cuda,"_lazy_init"),(torch.optim.Optimizer,"__init__"),(torch,"load"),(torch,"save"),
                    (torch.Tensor,"backward"),(torch.autograd,"backward")):
                guards.enter_context(patch.object(obj,name,side_effect=AssertionError("CPU candidate prohibited operation: " + name)))
            value = run_check(mapping, request, policy, resource, counts)
        value.update(schemaVersion="final-rgb-base-precision-cpu-worker-result-v1",runId=request["runId"],policy=request["policy"],
            verificationRevision=2,predecessorVerification=PREDECESSOR,counts=counts,elapsedSeconds=time.monotonic()-began)
        print(json.dumps(value,allow_nan=False))
    except BaseException as error:
        print(json.dumps({"schemaVersion":"final-rgb-base-precision-cpu-worker-result-v1","status":"cpu_candidate_failed_closed",
            "executionState":"failed_closed","runId":request["runId"],"policy":request["policy"],"verificationRevision":2,
            "predecessorVerification":PREDECESSOR,"counts":counts,
            "error":{"type":type(error).__name__,"message":str(error)[:4096]},"trainingAllowed":False,"stage4Qualified":False},allow_nan=False))
        raise


if __name__ == "__main__":
    main()

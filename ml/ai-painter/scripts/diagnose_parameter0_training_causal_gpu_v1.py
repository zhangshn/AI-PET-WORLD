"""Independent saved-state zero-update parameter0 diagnostic; never a training entry.

The observed G phase is usable by CPU fixtures. The command-line execution
envelope is separately authenticated against the new GPU policy, not CPU 1.62.
"""
from __future__ import annotations

import hashlib
import argparse
import io
import importlib
import json
import os
import re
import shutil
import time
from pathlib import Path
import random
import sys
import types
import weakref
import unittest
from copy import deepcopy

WORKER_STARTED = time.monotonic()

import numpy as np
import torch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture
from ai_painter.complete_world import parameter0_training_causal_restore_v1 as restore
from ai_painter.complete_world.parameter0_training_causal_observation_v1 import (
    Parameter0Observer, LABELS, TARGET_NAME, TARGET_INDEX, decompose_target_gradients, fixed_coordinate_failure,
)
from qualification_gradient_gate_authentication_cpu_v1 import authenticate_gate

TARGET_ERROR = "actual four-term total gradient identity differs at parameter 0"
require = capture.require
GPU_POLICY_PATH = "data/ai-painter/system-governance/ai-painter-parameter0-training-causal-gpu-policy-v1.json"
GPU_POLICY = None
CURRENT_POLICY = None
_PHASE_PROOFS = weakref.WeakKeyDictionary()
RESOURCE_LIMITS = dict(maxWallSeconds=180, threads=2, maxGpuMemoryFraction=.7, maximumTemperatureC=85,
    minimumFreeVramMiB=2048, minimumFreeDiskMiB=2048, maxOutputBytes=134217728,
    maxTargetCaptureBytes=67108864, attempts=1, automaticRetries=0, maxStreamBytes=8388608,
    cleanupReserveMs=1000, failureEvidenceReserveBytes=65536, temperaturePollMs=1000,
    cpuPreflightMaxWallSeconds=120, cpuPreflightMaxOutputBytes=8388608, finalizationReserveMs=8000,
    maxTargetPersistedBytes=2097152)


class _PhaseProof:
    pass


def _profile():
    profile_sha = restore.source_route(CURRENT_POLICY)["profile_sha"]
    logical = "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py"
    path = ROOT / logical
    require(not path.is_symlink() and capture.digest(path.read_bytes()) == profile_sha, "original profile source changed")
    old = list(sys.path)
    try:
        sys.path.insert(0, str(path.parent))
        profile = importlib.import_module(path.stem)
        require(Path(profile.__file__).resolve() == path.resolve(), "profile import origin differs")
        return profile
    finally:
        sys.path[:] = old


def _diagnostic_tensor_sha(value):
    """Hash logical tensor bytes on the host, without changing the source.

    The frozen capture helper intentionally serializes CPU bytes. All device
    normalization belongs to this diagnostic adapter, not to the original
    model, gradient gate or capture algorithm. No dtype conversion is allowed.
    """
    require(type(value) in (torch.Tensor, torch.nn.Parameter)
            and value.layout == torch.strided and value.device.type in ("cpu", "cuda"),
            "plain CPU/CUDA strided tensor required for diagnostic digest")
    host = value.detach().cpu().contiguous()
    require(host.device.type == "cpu" and not host.requires_grad
            and host.dtype == value.dtype and tuple(host.shape) == tuple(value.shape),
            "diagnostic host digest must preserve dtype and shape")
    return capture.tensor_sha(host)


COORDINATES = ((1, 13, 0, 0),)
def _authenticate_gate(error, observer, programs):
    require(type(programs) is list and len(programs) == len({b["path"] for b in programs}),
            "unique authenticated program lineage required")
    return authenticate_gate(error, observer.target_observation, {b["path"]: b for b in programs})


def _error(error):
    return dict(type=type(error).__name__, message=str(error)[:8192])


def _secondary(primary, error):
    message = (type(error).__name__ + ": " + str(error))[:8192]
    if primary is not None and error is not primary:
        primary.add_note("parameter0 diagnostic secondary: " + message)
    return message


def _secondary_notes(error):
    # Persist the same bounded secondary chain that remains on native stderr.
    return [str(value)[:2048] for value in getattr(error, "__notes__", ())[:4]]


def _tensor_identity(value):
    storage = value.untyped_storage()
    return (str(value.device), id(value), storage._cdata, storage.data_ptr(), storage.nbytes(),
            tuple(value.shape), tuple(value.stride()), value.storage_offset(), value.dtype, value._version)


def _network_state(network):
    rows = tuple(network.named_parameters(remove_duplicate=False)) + tuple(network.named_buffers(remove_duplicate=False))
    require(len({name for name, _ in rows}) == len(rows) and len({id(value) for _, value in rows}) == len(rows),
            "network state identity alias")
    values = []
    for name, value in rows:
        require(value.layout == torch.strided and value.is_contiguous() and bool(torch.isfinite(value.detach()).all()),
                "network state nonfinite/layout differs")
        grad = value.grad if isinstance(value, torch.nn.Parameter) else None
        require(grad is None, "diagnostic requires clean original grad fields")
        values.append((name, value, _tensor_identity(value), _diagnostic_tensor_sha(value), value.requires_grad))
    return {"values": values, "modes": tuple((name, module, module.training)
            for name, module in network.named_modules(remove_duplicate=False))}


def _state_unchanged(network, before):
    after = _network_state(network)
    require(len(after["values"]) == len(before["values"]) and all(
        a[0] == b[0] and a[1] is b[1] and a[2:] == b[2:] for a, b in zip(after["values"], before["values"])),
        "network state/versions/flags/grad changed")
    require(len(after["modes"]) == len(before["modes"]) and all(
        a[0] == b[0] and a[1] is b[1] and a[2] == b[2] for a, b in zip(after["modes"], before["modes"])),
        "network mode or module identity changed")


def _sample_state(sample):
    require(sample.get("sampleId") == restore.source_route(CURRENT_POLICY)["sample"] and sample.get("split") == "train", "exact failure train sample required")
    rows = []
    for key in ("image", "conditions", "appearance_regime", "ecology_regime"):
        value = sample.get(key)
        require(type(value) is torch.Tensor and value.dtype == torch.float32 and value.layout == torch.strided
                and not value.requires_grad and bool(torch.isfinite(value).all()), "finite detached sample required: " + key)
        rows.append((key, value, _tensor_identity(value), _diagnostic_tensor_sha(value)))
    table = json.dumps(sample["objectInstanceTable"], sort_keys=True, allow_nan=False)
    return rows, table


def _sample_unchanged(sample, before):
    rows, table = _sample_state(sample)
    require(table == before[1] and all(a[0] == b[0] and a[1] is b[1] and a[2:] == b[2:]
            for a, b in zip(rows, before[0])), "sample bytes/layout/identity changed")


def _rng_snapshot(device):
    return dict(python=random.getstate(), numpy=deepcopy(np.random.get_state()),
        torch=torch.random.get_rng_state().clone(),
        cuda=torch.cuda.get_rng_state(device).clone() if device.type == "cuda" else None)


def _rng_unchanged(before, device):
    after = _rng_snapshot(device)
    require(after["python"] == before["python"] and torch.equal(after["torch"], before["torch"])
            and after["numpy"][0] == before["numpy"][0] and np.array_equal(after["numpy"][1], before["numpy"][1])
            and after["numpy"][2:] == before["numpy"][2:]
            and (before["cuda"] is None or torch.equal(after["cuda"], before["cuda"])), "G phase RNG changed")


def run_observed_g_phase(model, critic, sample, order, *, resource, programs, preserve_first):
    """One original G call; the caught exception is locked before postchecks.

    preserve_first commits the raw error and five full target gradients without
    treating them as authenticated. Observer failures cannot become a gate proof.
    """
    require(callable(resource) and callable(preserve_first) and torch.get_num_threads() <= 2,
            "bounded resource and first-error persistence required")
    resource()
    profile = _profile()
    require(len(tuple(model.parameters())) == 108 and len(tuple(critic.parameters())) == 14,
            "complete original G108/D14 required")
    require(len(order) == 23 and len(set(order)) == 23 and tuple(order) == tuple(model.condition_channel_order),
            "original 23 channel order required")
    initial_g, initial_d = _network_state(model), _network_state(critic)
    original_sample = _sample_state(sample)
    device = next(model.parameters()).device
    rng = _rng_snapshot(device)
    counts = dict(generatorForwards=0, generatorAutogradAttempts=0, generatorAutogradCompleted=0,
        discriminatorAutograd=0, optimizerConstruction=0, optimizerUpdates=0, localFp64WeightVjp=0)
    primary, result, observed, first_receipt = None, None, None, None
    preservation_error = None
    try:
        profile._phase(critic, False)
        frozen_d = _network_state(critic)
        bound = profile._bound_device(model, sample)
        bound_before = _sample_state(bound)
        observer = Parameter0Observer(model, resource=resource, coordinates=COORDINATES)
        def event(stage, label, raw):
            resource()
            key = "generatorAutogradAttempts" if stage == "attempt" else "generatorAutogradCompleted"
            require(stage in ("attempt", "complete") and counts[key] < 5
                    and label == LABELS[counts[key]], "five original ordered events required")
            counts[key] += 1  # Account the original event even if observation fails.
            observer(stage, label, raw)
        try:
            with observer:
                try:
                    resource()
                    counts["generatorForwards"] += 1
                    prediction = profile.sample_forward(model, bound)
                    resource()
                    with profile.observe_generator_gradients(event):
                        profile._generator_candidate(model, critic, bound, order, prediction,
                                                     support_structure_weight=1.0)
                    resource()
                except BaseException as failure:
                    primary = failure  # Lock even before observer.__exit__ checks.
                    try:
                        first_receipt = preserve_first(primary, observer.target_observation.raw)
                        require(first_receipt is not None, "first error preservation incomplete")
                    except BaseException as secondary:
                        preservation_error = secondary
                        _secondary(primary, secondary)
                    raise
        except BaseException as failure:
            if primary is None:
                primary = failure
                first_receipt = preserve_first(primary, observer.target_observation.raw)
                require(first_receipt is not None, "first error preservation incomplete")
            elif failure is not primary:
                _secondary(primary, failure)
                raise
        if preservation_error is not None:
            raise preservation_error
        _state_unchanged(model, initial_g)
        _state_unchanged(critic, frozen_d)
        _sample_unchanged(bound, bound_before)
        _sample_unchanged(sample, original_sample)
        _rng_unchanged(rng, device)
        if primary is None:
            result = dict(status="diagnostic_not_reproduced", counts=counts,
                reasonCode="original_gate_passed", meaning="new_call_not_historical_replay")
        else:
            require(counts["generatorAutogradAttempts"] == counts["generatorAutogradCompleted"] == 5,
                    "all five original independent gradients must complete")
            require(getattr(observer, "_observation_error", None) is None,
                    "observation failure cannot authenticate an original gate")
            original_gate = _authenticate_gate(primary, observer, programs)
            observed = observer.evidence()
            fixed = fixed_coordinate_failure(observed["native_gradients"], coordinates=COORDINATES)
            original_gate.update(fixed)
            if fixed["referenceAllowed"]:
                result = dict(status="diagnostic_target_gate_observed", counts=counts,
                    originalGateFailure=original_gate, observation=observed, firstPreservation=first_receipt,
                    meaning="new_same_call_local_evidence_not_root_cause_or_qualification")
            else:
                result = dict(status="diagnostic_not_reproduced", counts=counts,
                    originalGateFailure=original_gate, firstPreservation=first_receipt,
                    reasonCode=fixed["reasonCode"], meaning="fixed_coordinate_not_reproduced_zero_reference")
    except BaseException as failure:
        result = dict(status="diagnostic_failed_closed", counts=counts,
            error=_error(primary if primary is not None else failure),
            secondaryError=None if primary is None or failure is primary else _secondary(primary, failure),
            firstPreservation=first_receipt)
    finally:
        try:
            for _, parameter, _, _, flag in initial_d["values"]:
                if isinstance(parameter, torch.nn.Parameter): parameter.requires_grad_(flag)
            for _, module, flag in initial_d["modes"]: module.training = flag
            _state_unchanged(model, initial_g)
            _state_unchanged(critic, initial_d)
            _sample_unchanged(sample, original_sample)
            _rng_unchanged(rng, device)
            resource()
        except BaseException as invariant:
            if result is None:
                result = dict(counts=counts)
            result.update(status="diagnostic_failed_closed",
                error=_error(primary if primary is not None else invariant),
                secondaryInvariantError=_secondary(primary, invariant))
    result["stateTiming"], result["historicalReplayAllowed"] = "after_exception", False
    result["_primaryException"] = primary
    if result["status"] == "diagnostic_target_gate_observed":
        token = _PhaseProof()
        _PHASE_PROOFS[token] = (result, initial_g, initial_d, model, critic, original_sample, sample,
                               deepcopy(observed["metadata"]), deepcopy(result["originalGateFailure"]))
        result["_phaseProof"] = token
    return result


def finish_target_contrast(phase, *, preserve, resource):
    """Persist the independently authenticated error/capture before local math.

    This helper consumes only the result of this module's observed phase, and
    does not grant GPU admission. The supervised entry owns final registration.
    """
    require(phase.get("status") == "diagnostic_target_gate_observed", "no target contrast for other terminal")
    token = phase.get("_phaseProof")
    require(token in _PHASE_PROOFS and _PHASE_PROOFS[token][0] is phase, "same-call private phase proof required")
    _, g_before, d_before, model, critic, sample_before, sample, metadata_before, gate_before = _PHASE_PROOFS.pop(token)
    require(phase["observation"]["metadata"] == metadata_before and phase["originalGateFailure"] == gate_before,
            "authenticated phase evidence changed before contrast")
    _state_unchanged(model, g_before)
    _state_unchanged(critic, d_before)
    _sample_unchanged(sample, sample_before)
    observation = phase["observation"]
    for key, value in {"input": observation["input_tensor"],
            **{"adjoint." + label: value for label, value in zip(LABELS, observation["adjoints"])},
            **{"gradient." + label: value for label, value in zip(LABELS, observation["native_gradients"])}}.items():
        require(_diagnostic_tensor_sha(value) == observation["metadata"]["descriptors"][key]["sha256"],
                "target capture changed before contrast")
    resource()
    preservation = preserve(phase["originalGateFailure"], observation)
    require(preservation is not None, "original failure/capture preservation did not complete")
    resource()
    def counted(stage, label):
        key = "localFp64WeightVjpAttempts" if stage == "attempt" else "localFp64WeightVjp"
        phase["counts"][key] = phase["counts"].get(key, 0) + 1
    report = decompose_target_gradients(observation["input_tensor"], observation["adjoints"],
        observation["native_gradients"], convolution=observation["convolution"], resource=resource, on_reference=counted,
        coordinates=COORDINATES)
    resource()
    return dict(status="diagnostic_target_evidence_complete", originalGateFailure=phase["originalGateFailure"],
        preservation=preservation, counts=dict(phase["counts"]),
        observation=observation, contrast=report, historicalReplayAllowed=False,
        meaning="local_evidence_not_whole_model_root_cause_or_training_qualification")


def _json(raw):
    def members(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, "duplicate JSON member")
            value[key] = item
        return value
    value = json.loads(raw, object_pairs_hook=members)
    require(type(value) is dict, "JSON object required")
    return value


def validate_request(request, policy, *, cpu, now=None):
    now = time.time() if now is None else now
    route = restore.source_route(policy)
    expected_policy = GPU_POLICY_PATH
    binding = request.get("policy", {})
    require(request.get("schemaVersion") == "parameter0-training-causal-gpu-request-v1"
            and binding.get("path") == expected_policy and type(binding.get("sha256")) is str
            and re.fullmatch("[0-9a-f]{64}", binding["sha256"]), "exact new request/policy binding required")
    if GPU_POLICY is not None: require(binding == GPU_POLICY, "invocation policy differs")
    require(policy.get("schemaVersion") == restore.CURRENT_SCHEMA
            and policy.get("status") == "registered_one_shot_zero_update_diagnostic_not_training",
            "registered parameter0 training policy required")
    restore.validate_source_policy(policy)
    require(policy.get("metadataCanonicalProgram") == CANONICAL_PROGRAM, "exact metadata canonical program required")
    require(request.get("nodeInterpreter") == policy.get("nodeInterpreter") and type(policy.get("nodeInterpreter")) is dict, "bound Node interpreter required")
    canonical_program_binding(request.get("programBindings"))
    formal = policy.get("formalSpecification", {})
    require(formal.get("path") == "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
            and formal.get("version") == "AI-PAINTER-SPEC-1.122"
            and re.fullmatch("[0-9a-f]{64}", formal.get("sha256", "")), "versioned formal binding required")
    require(policy["outputRoot"] == ".runtime/ai-painter/parameter0-training-causal-gpu-runs", "exact new output namespace required")
    require(policy["attemptClaimPath"] == policy["outputRoot"] + "/attempt-v1.json"
            and policy["resources"]["attempts"] == 1 and policy["resources"]["automaticRetries"] == 0, "single attempt required")
    require(request.get("mode") == ("cpu_preflight" if cpu else "gpu_diagnostic"), "phase mode differs")
    run = request.get("runId")
    require(type(run) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", run)
            and request.get("outputRoot") == policy["outputRoot"] + "/" + run, "own run/output namespace required")
    deadline = request.get("deadlineUnixMs")
    require(type(deadline) is int and 0 < deadline / 1000 - now <= (120 if cpu else 180), "shared deadline required")
    programs = request.get("programBindings")
    require(type(programs) is list and 1 <= len(programs) <= 256
            and len({b["path"] for b in programs}) == len(programs), "bounded unique program lineage required")
    require(policy["comparison"]["atol"] == 1e-6 and policy["comparison"]["rtol"] == 1e-5
            and policy["comparison"]["originalGateKept"] is True, "original comparison required")
    require(policy.get("resources") == RESOURCE_LIMITS,
            "original diagnostic resource limits required")
    require(policy.get("counts") == dict(fullGeneratorForward=1, fullGeneratorAutograd=5,
            discriminatorAutograd=0, optimizerConstruction=0, optimizerUpdates=0,
            localFp64WeightVjp=5, extraNativeBackwardReplay=0, extraModelAutograd=0),
            "fixed one-forward/five-gradient/zero-update counts required")
    require(policy["gradientLabels"] == list(LABELS) and policy["cpuPreparation"] == {
        "maxWallSeconds": 120, "threads": 2, "maxOutputBytes": 8388608, "attempts": 1, "automaticRetries": 0,
        "fullModelForwards": 0, "fullModelAutogradCalls": 0, "optimizerConstruction": 0,
        "optimizerUpdates": 0, "cudaCalls": 0,
        "scope": "bound archive/state/sample identity, synthetic observer and exact request ABI; no real forward"},
        "independent CPU preparation boundary differs")
    require(type(policy.get("qualification")) is dict and policy["qualification"]
            and all(v is False for v in policy["qualification"].values()), "no diagnostic qualification")
    prefix = "parameter0-training-cpu-current-" if cpu else "parameter0-training-gpu-"
    require(run.startswith(prefix), "own phase run prefix required")


def _prepare_state(mapping, policy, resource):
    return restore.prepare_exact_failure_state(mapping, policy, resource=resource)


class _SingleSampleReader:
    """Only original registered metadata and the one authenticated train row."""
    def __init__(self, mapping, programs, resource):
        self.mapping, self.root, self.resource = mapping, mapping.project, resource
        self.allowed, self.observed = {}, {}
        for binding in programs.values(): self.allow(binding)

    def allow(self, binding):
        binding = _raw_binding(binding)
        previous = self.allowed.setdefault(binding["path"], binding)
        require(previous == binding, "conflicting single-source binding")

    def read(self, binding):
        require(type(binding) is dict and "path" in binding and "sha256" in binding,
                "source path and byte digest required")
        # Original channel descriptors carry typed raster metadata. Authorization
        # is still only the exact predeclared file and digest; unused descriptor
        # fields cannot grant a new path, split or interpretation.
        binding = _raw_binding({key: binding[key] for key in ("path", "sha256")})
        require(self.allowed.get(binding["path"]) == binding, "undeclared single-source read")
        self.resource()
        raw = self.mapping.binding(binding, maximum=capture.MAX_CAPTURE)
        self.observed[binding["path"]] = binding["sha256"]
        return raw

    def json(self, binding): return _json(self.read(binding))

    def snapshot(self, logical):
        require(logical in self.allowed, "undeclared single-source snapshot")
        binding = self.allowed[logical]
        return self.read(binding), dict(binding)

    def unchanged(self):
        for logical, sha in tuple(self.observed.items()): self.read({"path": logical, "sha256": sha})


def _raw_binding(value):
    require(type(value) is dict and set(value) <= {"path", "sha256", "id", "bytes", "contentSha256", "contentHashAlgorithm",
            "taskBoundCanonicalPackageSha256"} and type(value.get("path")) is str
            and type(value.get("sha256")) is str and re.fullmatch(r"[a-f0-9]{64}", value["sha256"]),
            "original source byte binding required")
    return {key: value[key] for key in ("path", "sha256")}



CANONICAL_PROGRAM = {
    "path": "scripts/lib/real-earth-region-governance.mjs",
    "sha256": "c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1",
}


def canonical_program_binding(programs):
    require(type(programs) is list and 1 <= len(programs) <= 256, "bounded diagnostic programs required")
    require(all(type(row) is dict and type(row.get("path")) is str for row in programs),
            "program binding paths required")
    require(len({row["path"] for row in programs}) == len(programs), "duplicate diagnostic program path")
    rows = [row for row in programs if row["path"] == CANONICAL_PROGRAM["path"]]
    require(len(rows) == 1 and _raw_binding(rows[0]) == CANONICAL_PROGRAM,
            "exact canonical metadata program missing or changed")
    return dict(CANONICAL_PROGRAM)


def _verify_metadata_node(mapping, policy, request):
    """Bind the existing canonical helper and its original Node, not an arbitrary PATH tool."""
    require(policy.get("metadataCanonicalProgram") == CANONICAL_PROGRAM, "canonical program differs")
    canonical_program_binding(request.get("programBindings"))
    mapping.binding(CANONICAL_PROGRAM, maximum=1024**2)
    rows = [row for row in policy["sourceEvidence"] if row["path"].endswith("/quality-plan.json")]
    require(len(rows) == 1, "unique original plan required")
    plan = _json(mapping.binding(restore._binding(rows[0])))
    original = plan["runtimeIdentity"]["node"]
    declared = policy.get("nodeInterpreter")
    require(type(declared) is dict and set(declared) == {"path", "sha256"}
            and request.get("nodeInterpreter") == declared
            and Path(declared["path"]).resolve() == Path(original["absolutePath"]).resolve()
            and declared["sha256"] == original["sha256"], "original Node identity differs")
    actual = shutil.which("node")
    require(actual is not None and Path(actual).resolve() == Path(declared["path"]).resolve(),
            "canonical Node PATH identity differs")
    require(capture.digest(Path(actual).read_bytes()) == declared["sha256"], "canonical Node bytes differ")
    return dict(path=declared["path"], sha256=declared["sha256"], verified=True)


def load_failure_sample(mapping, manifest, plan, *, resource, programs):
    profile = _profile()
    cpu = profile.inherited.core.cpu
    context = manifest["context"]
    identity = context["sampleIdentity"]
    require(identity["sampleId"] == restore.source_route(CURRENT_POLICY)["sample"] and identity["split"] == "train", "exact train sample required")
    canonical = canonical_program_binding(programs)
    reader = _SingleSampleReader(mapping, context["programBindings"], resource)
    reader.allow(canonical)
    # Metadata only. Select one row; never invoke prepare_metadata/load_samples
    # or open validation/challenge/regression asset paths.
    dataset_binding = plan["datasetManifest"]
    reader.allow(dataset_binding)
    dataset = reader.json(dataset_binding)
    reader.allow(plan["trainSplit"])
    membership = reader.json(plan["trainSplit"])
    ids = membership.get("sampleIds")
    require(membership.get("split") == "train" and type(ids) is list
            and len(ids) == len(set(ids)) == 48 and ids[8] == identity["sampleId"],
            "exact saved train membership/index8 required")
    reader.allow(dataset["sourceIndex"])
    source = reader.json(dataset["sourceIndex"])
    rows = [row for row in source["samples"] if row["sampleId"] == identity["sampleId"]]
    require(len(rows) == 1 and rows[0]["split"] == "train", "unique original train row required")
    row = rows[0]
    require(not row.get("sourceCorrection"), "fixed source row must not change correction route")
    require(row["image"] == identity["image"] and row["conditionPack"] == identity["conditionPack"], "original row differs from captured sample")
    reader.allow(cpu.CONDITION_CONTRACT)
    contract = reader.json(cpu.CONDITION_CONTRACT)
    order = contract["tensorContract"]["channelOrder"]
    continuous = contract["tensorContract"]["typePartitions"]["continuous"]
    require(order == dataset["identityPayload"]["channelOrder"] == [c["id"] for c in identity["channels"]]
            and continuous == dataset["identityPayload"]["continuousChannelIds"], "original channel type/resize contract differs")
    for key in ("image", "conditionPack", "contribution", "sourceRecord", "regionSource"):
        reader.allow(row[key])
    for key in ("taskPackage", "visualFactManifestFile"): reader.allow(identity[key])
    for binding in identity["channels"]: reader.allow({k: binding[k] for k in ("path", "sha256")})
    task = reader.json(identity["taskPackage"])
    source_bindings = task["sourceBindings"]
    reader.allow({"path": source_bindings["naturalizedWorldFactsPath"], "sha256": source_bindings["naturalizedWorldFactsSha256"]})
    require(source_bindings["naturalizedWorldFactsSha256"] == identity["factHash"], "captured facts binding differs")
    for key in ("seasonSnapshot", "regionalProfile"):
        reader.allow({"path": source_bindings[key+"Path"], "sha256": source_bindings[key+"Sha256"]})
    # The original index carries the raw region-file SHA separately from the
    # task's canonical-package SHA. Do not mistake canonical hash for raw bytes.
    require(row["regionSource"]["path"] == source_bindings["realEarthRegionSourcePackagePath"], "region raw source binding missing")
    region = reader.json(row["regionSource"])
    provenance = region["sourceProvenance"]
    reader.allow({"path": provenance["sourceRegistryPath"], "sha256": provenance["sourceRegistrySha256"]})
    resource()
    sample, reproduced_identity = cpu.load_sample(reader, row, order, continuous)
    require(reproduced_identity == identity, "single sample identity changed by original loader")
    record, _, _ = profile.inherited.predecessor.derive_regime_record(reader, identity)
    sample = profile.bind_sample_ecology(reader, sample, identity, record)
    profile.validate_sample_ecology(sample)
    require(tuple(sample["conditions"].shape) == (23, 192, 256) and tuple(sample["image"].shape) == (3, 192, 256), "original resolution differs")
    reader.unchanged()
    return sample, order, reader


def _verify_imports(mapping, programs):
    bindings = {b["path"]: b for b in programs}
    for module in tuple(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if not filename: continue
        candidate = Path(filename).resolve()
        try: logical = candidate.relative_to(mapping.project).as_posix()
        except ValueError: continue
        if logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/")) and logical.endswith(".py"):
            require(logical in bindings, "imported project source unbound: " + logical)
            mapping.binding(bindings[logical], maximum=1024**2)


class _EvidenceWriter:
    def __init__(self, mapping, output, maximum, resource):
        self.mapping, self.output, self.maximum, self.resource = mapping, output, maximum, resource
        self.used = 0
    def write(self, name, raw, *, failure=False):
        capture_names = {"original-gate-failure.json", "raw-target-gradients.pt", "target-capture.pt", "target-capture.json", "local-contrast.pt"}
        if name in capture_names:
            require(getattr(self, "capture_used", 0) + len(raw) + 65536 <= 2 * 1024**2, "aggregate2MiB target quota")
            self.capture_used = getattr(self, "capture_used", 0) + len(raw)
        require(re.fullmatch(r"[a-z-]+\.(json|pt)", name), "private evidence name required")
        if name in ("worker-result.json", "worker-failure.json"):
            require(getattr(self, "terminal_used", 0) + len(raw) <= 65536,
                    "terminal evidence exceeds cumulative reserved64KiB")
            self.terminal_used = getattr(self, "terminal_used", 0) + len(raw)
        require(self.used + len(raw) <= self.maximum - (0 if failure else 65536), "output budget exceeded")
        self.resource()
        logical = self.output + "/" + name
        path = self.mapping.path(logical)
        require(path.parent.is_dir(), "supervisor-created output directory required")
        with path.open("xb") as stream:
            stream.write(raw); stream.flush(); os.fsync(stream.fileno())
        self.used += len(raw)
        binding = {"path": logical, "sha256": capture.digest(raw), "bytes": len(raw)}
        require(self.mapping.binding({k: binding[k] for k in ("path", "sha256")},
                    maximum=self.maximum) == raw, "persisted evidence readback differs")
        return binding
    def json(self, name, value, *, failure=False):
        return self.write(name, capture.json_bytes(value), failure=failure)


def _tensor_archive(values, maximum):
    require(sum(v.numel()*v.element_size() for v in values.values()) + 65536 <= maximum, "serialization budget exceeded before copies")
    class Bounded(io.BytesIO):
        def write(self, data):
            require(self.tell()+len(data)+65536 <= maximum, "serialization allocation budget exceeded")
            return super().write(data)
    stream = Bounded()
    tensors = {key: value.detach().to("cpu").contiguous() for key, value in values.items()}
    torch.save(tensors, stream)
    return stream.getvalue()


CPU_TEST_PATHS = ("ml/ai-painter/tests/test_parameter0_training_causal_observation_v1.py",
                  "ml/ai-painter/tests/test_diagnose_parameter0_training_causal_gpu_v1.py")


def _configure_cpu_affinity():
    import psutil
    process = psutil.Process()
    allowed = process.cpu_affinity()
    require(bool(allowed), "empty allowed CPU affinity")
    process.cpu_affinity(allowed[:2])
    observed = process.cpu_affinity()
    require(0 < len(observed) <= 2 and set(observed).issubset(set(allowed)), "CPU affinity readback differs")
    return process, observed


def run_cpu_component_tests(mapping, programs, *, resource):
    """Run exactly the two bound synthetic files in this managed CPU process."""
    resource()
    require(not torch.cuda.is_initialized(), "CPU components must not initialize CUDA")
    bindings = {item["path"]: item for item in programs}
    loader, suite = unittest.TestLoader(), unittest.TestSuite()
    old = list(sys.path)
    stream = io.StringIO()
    try:
        sys.path.insert(0, str(ROOT / "ml/ai-painter/tests"))
        for logical in CPU_TEST_PATHS:
            require(logical in bindings, "CPU component test source unbound")
            raw = mapping.binding(bindings[logical], maximum=1024**2)
            module = importlib.import_module(Path(logical).stem)
            require(Path(module.__file__).absolute() == ROOT / logical, "CPU test import origin differs")
            require(capture.digest((ROOT / logical).read_bytes()) == capture.digest(raw), "CPU test source changed")
            suite.addTests(loader.loadTestsFromModule(module))
        require(suite.countTestCases() > 0, "empty CPU component suite")
        result = unittest.TextTestRunner(stream=stream, verbosity=0).run(suite)
        resource()
        require(not torch.cuda.is_initialized() and result.wasSuccessful() and not result.skipped,
                "current CPU components failed/skipped: " + stream.getvalue()[-4096:])
        return dict(status="passed", testPaths=list(CPU_TEST_PATHS), testsRun=result.testsRun,
                    failures=len(result.failures), errors=len(result.errors), skipped=len(result.skipped),
                    processId=os.getpid())
    finally:
        sys.path[:] = old


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    parser.add_argument("--cpu-preflight", action="store_true")
    args = parser.parse_args()
    mapping = capture.RuntimeMap.current(ROOT)
    request = _json(mapping.binding({"path": args.request, "sha256": args.request_sha256}))
    global GPU_POLICY, CURRENT_POLICY
    GPU_POLICY = restore._binding(request["policy"])
    policy = _json(mapping.binding(GPU_POLICY))
    validate_request(request, policy, cpu=args.cpu_preflight)
    CURRENT_POLICY = policy
    formal = policy["formalSpecification"]
    mapping.binding({k: formal[k] for k in ("path", "sha256")})
    mapping.binding(policy["designBinding"])
    require(Path(sys.executable).resolve() == Path(request["interpreter"]["path"]).resolve()
            and capture.digest(Path(sys.executable).read_bytes()) == request["interpreter"]["sha256"], "interpreter binding differs")
    process, affinity = _configure_cpu_affinity()
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    deadline = request["deadlineUnixMs"] / 1000
    def resource():
        require(time.time() < deadline and time.monotonic()-WORKER_STARTED < (120 if args.cpu_preflight else 180), "shared diagnostic deadline exceeded")
        require(torch.get_num_threads() <= 2 and 0 < len(process.cpu_affinity()) <= 2, "CPU thread/affinity limit exceeded")
        if args.cpu_preflight: require(not torch.cuda.is_initialized(), "CPU preflight initialized CUDA")
        mapping.check()
    resource()
    node_identity = _verify_metadata_node(mapping, policy, request)
    for binding in request["programBindings"]: mapping.binding(binding, maximum=1024**2)
    maximum = policy["cpuPreparation"]["maxOutputBytes"] if args.cpu_preflight else policy["resources"]["maxOutputBytes"] - policy["resources"]["maxStreamBytes"]
    writer = _EvidenceWriter(mapping, request["outputRoot"], maximum, resource)
    counts = dict(generatorForwards=0, generatorAutogradAttempts=0, generatorAutogradCompleted=0,
        discriminatorAutograd=0, optimizerConstruction=0, optimizerUpdates=0, cudaCalls=0)
    try:
        components = run_cpu_component_tests(mapping, request["programBindings"], resource=resource) if args.cpu_preflight else None
        model, critic, manifest, state = _prepare_state(mapping, policy, resource)
        plan = _json(mapping.binding(dict(path=restore.SOURCE_ROOT + "quality-plan.json",
                                         sha256=restore.SOURCE_HASHES["quality-plan.json"])))
        sample, order, reader = load_failure_sample(mapping, manifest, plan, resource=resource, programs=request["programBindings"])
        _verify_imports(mapping, request["programBindings"])
        if args.cpu_preflight:
            status, capture_bindings, summary = "cpu_preflight_passed_not_gpu_or_root_cause", {}, {}
        else:
            acceptance = _json(mapping.binding(request["cpuAcceptance"]))
            require(acceptance["schemaVersion"] == "parameter0-training-current-cpu-acceptance-v1"
                    and acceptance["status"] == "current_cpu_accepted_not_gpu_result"
                    and acceptance["policy"] == GPU_POLICY and acceptance["programBindings"] == request["programBindings"]
                    and acceptance["interpreter"] == request["interpreter"]
                    and acceptance.get("nodeInterpreter") == request["nodeInterpreter"], "own current CPU acceptance differs")
            require(acceptance["worker"]["status"] == "cpu_preflight_passed_not_gpu_or_root_cause"
                    and acceptance["worker"].get("cpuComponentTests", {}).get("status") == "passed",
                    "current CPU worker/components did not pass")
            require(request["cpuAcceptance"]["path"].startswith(policy["outputRoot"]+"/parameter0-training-cpu-current-"), "historical CPU attempt cannot grant this route")
            resource()
            torch.cuda.set_per_process_memory_fraction(policy["resources"]["maxGpuMemoryFraction"], 0)
            free, _ = torch.cuda.mem_get_info(0)
            require(free >= policy["resources"]["minimumFreeVramMiB"]*1024**2, "GPU free memory below fixed minimum")
            counts["cudaCalls"] = 2  # explicit initialization/fraction and memory query, not a kernel count
            model.to("cuda:0"); critic.to("cuda:0")
            for prefix, network in (("generator", model), ("discriminator", critic)):
                for name, value in network.state_dict().items():
                    require(_diagnostic_tensor_sha(value) == state[prefix]["restoredByteHashes"][name], "device transfer changed source state bytes")
            resource()
            capture_bindings, summary = {}, {}
            def preserve_first(error, raw):
                capture_bindings["originalGateFailure"] = writer.json("original-gate-failure.json",
                    dict(**_error(error), authenticated=False, meaning="raw_first_error_before_postchecks"))
                if type(raw) in (list, tuple) and len(raw) == 5:
                    values = {"gradient." + label: value for label, value in zip(LABELS, raw)}
                    capture_bindings["rawTargetGradients"] = writer.write("raw-target-gradients.pt",
                        _tensor_archive(values, 2 * 1024**2 - writer.capture_used - 65536))
                return dict(capture_bindings)
            phase = run_observed_g_phase(model, critic, sample, order, resource=resource,
                programs=request["programBindings"], preserve_first=preserve_first)
            counts.update(phase["counts"])
            if phase["status"] == "diagnostic_target_gate_observed":
                def preserve(error, observation):
                    require("originalGateFailure" in capture_bindings and "rawTargetGradients" in capture_bindings, "first error/raw target not persisted")
                    values = {"input": observation["input_tensor"],
                        **{"adjoint."+label: value for label, value in zip(LABELS, observation["adjoints"])},
                        **{"gradient."+label: value for label, value in zip(LABELS, observation["native_gradients"])}}
                    archive = writer.write("target-capture.pt", _tensor_archive(values, 2 * 1024**2 - writer.capture_used - 65536))
                    metadata = writer.json("target-capture.json", dict(**observation["metadata"],
                        authenticatedOriginalGateFailure=error, firstPreservation=dict(capture_bindings)))
                    capture_bindings.update(tensors=archive, metadata=metadata)
                    return dict(capture_bindings)
                completed = finish_target_contrast(phase, preserve=preserve, resource=resource)
                report = completed["contrast"]
                tensors = {"observedDifference": report["observedDifference"], "residual": report["residual"],
                    **{"reference."+str(i): v for i, v in enumerate(report["referenceGradients"])}, **report["terms"]}
                capture_bindings["contrastTensors"] = writer.write("local-contrast.pt", _tensor_archive(tensors, 2 * 1024**2 - writer.capture_used - 65536))
                summary = {k: v for k, v in report.items() if k not in ("referenceGradients", "terms", "observedDifference", "residual", "upstreamAdjointDifference")}
                counts.update(completed["counts"])
                status = completed["status"]
            else:
                status = phase["status"]
                if status == "diagnostic_failed_closed": summary = {k: v for k, v in phase.items()
                    if k not in ("counts", "observation") and not k.startswith("_")}
                elif phase.get("originalGateFailure"):
                    summary = {k: phase[k] for k in ("reasonCode", "meaning", "originalGateFailure")}
        reader.unchanged()
        _verify_imports(mapping, request["programBindings"])
        mapping.binding(GPU_POLICY)
        resource()
        result = dict(schemaVersion="parameter0-training-causal-worker-result-v1", status=status, runId=request["runId"],
            policy=GPU_POLICY, counts=counts, sourceStateTiming="after_exception",
            statePreparation=state if args.cpu_preflight else {
                key: dict(stateTensorCount=len(value["restoredByteHashes"]),
                    preparationSha256=capture.digest(capture.json_bytes(value)),
                    requiresGradHistoricalClaim=False, archivedGradientsInstalled=False)
                for key, value in state.items()},
            cpuComponentTests=components, cpuAffinity=affinity, metadataNodeInterpreter=node_identity,
            sampleId=restore.source_route(CURRENT_POLICY)["sample"], sourceReceipts=dict(reader.observed), artifacts=capture_bindings, contrast=summary,
            originalGateFailure=phase.get("originalGateFailure") if not args.cpu_preflight else None,
            error=phase.get("error") if not args.cpu_preflight else None,
            secondaryErrors=_secondary_notes(phase["_primaryException"])
                if not args.cpu_preflight and phase.get("_primaryException") is not None else [],
            historicalReplayAllowed=False, trainingAllowed=False, stage4Qualified=False, rootCauseProven=False,
            checkpointWritten=False, cudaCallCountingScope="explicit_initialization_and_memory_query_not_kernel_count")
        binding = writer.json("cpu-worker-result.json" if args.cpu_preflight else "worker-result.json", result)
        resource()
        print(json.dumps({**result, "workerResult": binding}, allow_nan=False))
    except BaseException as error:
        if "phase" in locals():
            counts.update(phase["counts"])
            primary = phase.get("_primaryException")
            if primary is not None and primary is not error:
                _secondary(primary, error)
                error = primary
        failure = dict(status="diagnostic_failed_closed", runId=request["runId"], policy=GPU_POLICY,
            originalGateFailure=phase.get("originalGateFailure") if "phase" in locals() else None,
            counts=counts, error=dict(type=type(error).__name__, message=str(error)[:8192]), historicalReplayAllowed=False,
            secondaryErrors=_secondary_notes(error),
            trainingAllowed=False, stage4Qualified=False, rootCauseProven=False)
        try:
            # Failure evidence remains permitted after the compute deadline; it
            # consumes the original total quota, not a new execution allowance.
            writer.resource = lambda: mapping.check()
            failure["evidence"] = writer.json("worker-failure.json", failure, failure=True)
        except BaseException as secondary: failure["secondaryEvidenceError"] = str(secondary)[:2048]
        print(json.dumps(failure, allow_nan=False))
        raise error


if __name__ == "__main__": main()

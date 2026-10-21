"""Independent zero-update parameter48 diagnostic; never a training entry.

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
from ai_painter.complete_world import parameter48_causal_restore_v1 as restore
from ai_painter.complete_world.parameter48_causal_observation_v1 import (
    Parameter48Observer, LABELS, TARGET_NAME, TARGET_INDEX, decompose_target_gradients,
)
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate_module

GATE_SHA = "99c437fe1cdf31229257c25716736e3c2f580a58f99fde8297c5e06611920324"
PROFILE_SHA = "c80f98a207f0f6e7414331a9bf0885dad61c476c3c209c035ffa4c93476910cc"
TARGET_ERROR = "actual four-term total gradient identity differs at parameter 48"
require = capture.require
GPU_POLICY_PATH = "data/ai-painter/system-governance/ai-painter-parameter48-causal-gpu-policy-v1.json"
GPU_POLICY = None
_PHASE_PROOFS = weakref.WeakKeyDictionary()
RESOURCE_LIMITS = dict(maxWallSeconds=180, threads=2, maxGpuMemoryFraction=.7, maximumTemperatureC=85,
    minimumFreeVramMiB=2048, minimumFreeDiskMiB=2048, maxOutputBytes=134217728,
    maxTargetCaptureBytes=67108864, attempts=1, automaticRetries=0, maxStreamBytes=8388608,
    cleanupReserveMs=1000, failureEvidenceReserveBytes=65536, temperaturePollMs=1000,
    cpuPreflightMaxWallSeconds=120, cpuPreflightMaxOutputBytes=8388608, finalizationReserveMs=8000)


class _PhaseProof:
    pass


def _profile():
    logical = "ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_v1.py"
    path = ROOT / logical
    require(not path.is_symlink() and capture.digest(path.read_bytes()) == PROFILE_SHA, "original profile source changed")
    old = list(sys.path)
    try:
        sys.path.insert(0, str(path.parent))
        profile = importlib.import_module(path.stem)
        require(Path(profile.__file__).resolve() == path.resolve(), "profile import origin differs")
        return profile
    finally:
        sys.path[:] = old


def _compiled_function(code, name):
    return next(value for value in code.co_consts if isinstance(value, types.CodeType) and value.co_name == name)


def _code_identity(code):
    # marshal's intern/reference encoding is not a canonical code identity.
    return (code.co_code, tuple(_code_identity(v) if isinstance(v, types.CodeType) else v for v in code.co_consts),
        code.co_names, code.co_varnames, code.co_freevars, code.co_cellvars, code.co_argcount,
        code.co_posonlyargcount, code.co_kwonlyargcount, code.co_nlocals, code.co_stacksize,
        code.co_flags, code.co_firstlineno, code.co_linetable, code.co_exceptiontable,
        code.co_name, code.co_qualname, code.co_filename)


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


COORDINATES = ((10, 81, 0, 0), (10, 81, 1, 0))
HELPER_PATH = "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_cpu_v1.py"
HELPER_SHA = "d2d3238be5e3baab321dce0d697d70723cc69c622c361cc8fe215560f8e1e67c"


def _authenticate_gate(error, observation):
    """Authenticate the actual joint gate, its imported require, and both points."""
    require(type(error) is ValueError and str(error) == TARGET_ERROR, "not exact parameter48 gate")
    gate = gate_module.apply_object_joint_rgb_structure_priority_update_cpu
    helper = gate_module.require
    source = Path(gate.__code__.co_filename)
    expected_path = ROOT / "ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_cpu_v1.py"
    require(source.absolute() == expected_path and not source.is_symlink(), "gate source path differs")
    raw = source.read_bytes()
    require(capture.digest(raw) == GATE_SHA, "frozen original gate SHA differs")
    compiled = compile(raw, gate.__code__.co_filename, "exec", dont_inherit=True)
    require(_code_identity(gate.__code__) == _code_identity(_compiled_function(compiled, gate.__name__)),
            "loaded original gate code differs")
    # Joint gate aliases an existing bridge require; it is not defined in the
    # joint source. Bind that helper independently, without executing its source.
    helper_source = Path(helper.__code__.co_filename)
    require(helper_source.absolute() == ROOT / HELPER_PATH and not helper_source.is_symlink(),
            "gate helper source path differs")
    helper_raw = helper_source.read_bytes()
    require(capture.digest(helper_raw) == HELPER_SHA, "frozen original helper SHA differs")
    helper_compiled = compile(helper_raw, helper.__code__.co_filename, "exec", dont_inherit=True)
    require(_code_identity(helper.__code__) == _code_identity(_compiled_function(helper_compiled, "require")),
            "loaded original gate helper differs")
    frames, tb = [], error.__traceback__
    while tb is not None:
        frames.append(tb); tb = tb.tb_next
    matches = [frame for frame in frames if frame.tb_frame.f_code is gate.__code__]
    require(len(matches) == 1 and frames[-1].tb_frame.f_code is helper.__code__, "gate traceback origin differs")
    target = matches[0]
    local = target.tb_frame.f_locals
    require(local.get("i") == TARGET_INDEX, "original target index differs")
    names = ("total_gradients", "structured_gradients", "whole_frame_gradients", "core_gradients", "support_gradients")
    normalized = ("g_actual", "g_s", "g_w", "g_c", "g_support")
    require(len(observation["native_gradients"]) == 5, "five same-call gradients required")
    for label, name, normalized_name, observed in zip(LABELS, names, normalized, observation["native_gradients"]):
        values = local.get(name)
        require(type(values) in (tuple, list) and len(values) == 108 and values[TARGET_INDEX] is not None
                and _diagnostic_tensor_sha(values[TARGET_INDEX]) == _diagnostic_tensor_sha(observed)
                and _diagnostic_tensor_sha(local[normalized_name]) == _diagnostic_tensor_sha(observed),
                "gate inputs differ from same-call observed target: " + label)
    values = observation["native_gradients"]
    require(all(type(value) is torch.Tensor and value.device.type == "cpu" and value.dtype == torch.float32
                and tuple(value.shape) == (48, 144, 3, 3) and not value.requires_grad
                and bool(torch.isfinite(value).all()) for value in values), "complete finite CPU target gradients required")
    expected = (((values[1].float() + values[2].float()).float() + values[3].float()).float() + values[4].float())
    require(bool(torch.isfinite(expected).all())
            and _diagnostic_tensor_sha(local["expected"]) == _diagnostic_tensor_sha(expected), "gate comparison not confirmed")
    close = torch.isclose(values[0], expected, atol=1e-6, rtol=1e-5)
    require(not bool(close.all()), "original target gate did not fail")
    selected_mask = [not bool(close[point]) for point in COORDINATES]
    return {"type": "ValueError", "message": str(error), "sourceSha256": GATE_SHA,
            "sourcePath": str(source), "helperSourcePath": HELPER_PATH, "helperSourceSha256": HELPER_SHA,
            "gateLine": target.tb_lineno, "raiseLine": frames[-1].tb_lineno,
            "selectedCoordinates": [list(point) for point in COORDINATES],
            "selectedCoordinateFailureMask": selected_mask, "selectedCoordinatesReproduced": all(selected_mask),
            "meaning": "same_call_original_gate_not_historical_replay"}


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
    require(sample.get("sampleId") == restore.SAMPLE_ID and sample.get("split") == "train", "exact failure train sample required")
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


def run_observed_g_phase(model, critic, sample, order, *, resource):
    """One original G forward/five original grads; target contrast is separate.

    The returned captured target gradients are evidence only, not a full gradient
    set for an optimizer. The worker persists the authenticated error BEFORE math.
    """
    require(callable(resource) and torch.get_num_threads() <= 2, "bounded resource callback/threads required")
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
    observed = None
    result = None
    primary = None
    try:
        profile.shared._phase(critic, False)
        frozen_d = _network_state(critic)
        bound = profile._bound_device(model, sample)
        bound_before = _sample_state(bound)
        observer = Parameter48Observer(model, resource=resource)
        def event(stage, label, raw):
            resource()
            observer(stage, label, raw)
            if stage == "attempt": counts["generatorAutogradAttempts"] += 1
            else: counts["generatorAutogradCompleted"] += 1
        error = None
        try:
            with observer:
                resource()
                counts["generatorForwards"] += 1
                prediction = profile.sample_forward(model, bound)
                resource()
                with profile.observe_generator_gradients(event):
                    profile._generator_candidate(model, critic, bound, order, prediction)
                resource()
        except BaseException as failure:
            error = failure
        _state_unchanged(model, initial_g)
        _state_unchanged(critic, frozen_d)
        _sample_unchanged(bound, bound_before)
        _sample_unchanged(sample, original_sample)
        _rng_unchanged(rng, device)
        if error is None:
            observer.evidence()
            result = dict(status="diagnostic_not_reproduced", counts=counts,
                          meaning="after_exception_reconstruction_not_historical_replay")
        else:
            primary = error
            observed = observer.evidence()
            require(counts["generatorAutogradAttempts"] == counts["generatorAutogradCompleted"] == 5,
                    "all five original independent gradients must complete")
            original_gate = _authenticate_gate(error, observed)
            if original_gate["selectedCoordinatesReproduced"]:
                result = dict(status="diagnostic_target_gate_observed", counts=counts,
                    originalGateFailure=original_gate, observation=observed,
                    meaning="same_call_observation_not_root_cause_or_qualification")
            else:
                result = dict(status="diagnostic_not_reproduced", counts=counts,
                    originalGateFailure=original_gate, reasonCode="selected_coordinates_not_reproduced",
                    meaning="original_parameter48_gate_still_failed_selected_pair_not_reproduced")
    except BaseException as failure:
        result = dict(status="diagnostic_failed_closed", counts=counts,
            error=dict(type=type(primary or failure).__name__, message=str(primary or failure)),
            secondaryError=None if primary is None or failure is primary else str(failure))
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
            result = dict(status="diagnostic_failed_closed", counts=counts,
                error=dict(type=type(primary or invariant).__name__, message=str(primary or invariant)),
                secondaryInvariantError=str(invariant))
    result["stateTiming"] = "after_exception"
    result["historicalReplayAllowed"] = False
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
        observation["native_gradients"], convolution=observation["convolution"], resource=resource, on_reference=counted)
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
    binding = request.get("policy", {})
    require(request.get("schemaVersion") == "parameter48-causal-gpu-request-v1"
            and binding.get("path") == GPU_POLICY_PATH and type(binding.get("sha256")) is str
            and re.fullmatch("[0-9a-f]{64}", binding["sha256"]), "exact new request/policy binding required")
    if GPU_POLICY is not None: require(binding == GPU_POLICY, "invocation policy differs")
    require(policy.get("schemaVersion") == "ai-painter-parameter48-causal-gpu-policy-v1"
            and policy.get("status") == "registered_one_shot_zero_update_diagnostic_not_training",
            "registered parameter48 policy required")
    restore.validate_source_policy(policy)
    formal = policy.get("formalSpecification", {})
    require(formal.get("path") == "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
            and re.fullmatch(r"AI-PAINTER-SPEC-1[.][0-9]+", formal.get("version", ""))
            and re.fullmatch("[0-9a-f]{64}", formal.get("sha256", "")), "versioned formal binding required")
    require(policy["outputRoot"] == ".runtime/ai-painter/parameter48-causal-gpu-diagnostics", "exact new output namespace required")
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
    require(all(policy.get("resources", {}).get(key) == value for key, value in RESOURCE_LIMITS.items()),
            "original diagnostic resource limits required")
    require(policy["gradientLabels"] == list(LABELS) and policy["cpuPreparation"] == {
        "maxWallSeconds": 120, "threads": 2, "maxOutputBytes": 8388608, "attempts": 1, "automaticRetries": 0,
        "fullModelForwards": 0, "fullModelAutogradCalls": 0, "optimizerConstruction": 0,
        "optimizerUpdates": 0, "cudaCalls": 0,
        "scope": "bound archive/state/sample identity, synthetic observer and exact request ABI; no real forward"},
        "independent CPU preparation boundary differs")
    require(all(v is False for v in policy["qualification"].values()), "no diagnostic qualification")


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


def load_failure_sample(mapping, manifest, *, resource):
    profile = _profile()
    cpu = profile.inherited.core.cpu
    context = manifest["context"]
    identity = context["sampleIdentity"]
    require(identity["sampleId"] == restore.SAMPLE_ID and identity["split"] == "train", "exact train sample required")
    reader = _SingleSampleReader(mapping, context["programBindings"], resource)
    # Metadata only. Select one row; never invoke prepare_metadata/load_samples
    # or open validation/challenge/regression asset paths.
    reader.allow(cpu.MANIFEST)
    dataset = reader.json(cpu.MANIFEST)
    reader.allow(dataset["sourceIndex"])
    source = reader.json(dataset["sourceIndex"])
    rows = [row for row in source["samples"] if row["sampleId"] == identity["sampleId"]]
    require(len(rows) == 1 and rows[0]["split"] == "train", "unique original train row required")
    row = rows[0]
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
        capture_names = {"original-gate-failure.json", "target-capture.pt", "target-capture.json", "local-contrast.pt"}
        if name in capture_names:
            require(getattr(self, "capture_used", 0) + len(raw) + 65536 <= 64 * 1024**2, "aggregate64MiB capture quota")
            self.capture_used = getattr(self, "capture_used", 0) + len(raw)
        require(re.fullmatch(r"[a-z-]+\.(json|pt)", name), "private evidence name required")
        require(self.used + len(raw) <= self.maximum - (0 if failure else 65536), "output budget exceeded")
        self.resource()
        logical = self.output + "/" + name
        path = self.mapping.path(logical)
        require(path.parent.is_dir(), "supervisor-created output directory required")
        with path.open("xb") as stream:
            stream.write(raw); stream.flush(); os.fsync(stream.fileno())
        self.used += len(raw)
        return {"path": logical, "sha256": capture.digest(raw), "bytes": len(raw)}
    def json(self, name, value, *, failure=False):
        return self.write(name, capture.json_bytes(value), failure=failure)


def _tensor_archive(values, maximum):
    require(sum(v.numel()*v.element_size() for v in values.values()) + 1024**2 <= maximum, "serialization budget exceeded before copies")
    class Bounded(io.BytesIO):
        def write(self, data):
            require(self.tell()+len(data)+1024**2 <= maximum, "serialization allocation budget exceeded")
            return super().write(data)
    stream = Bounded()
    tensors = {key: value.detach().to("cpu").contiguous() for key, value in values.items()}
    torch.save(tensors, stream)
    return stream.getvalue()


CPU_TEST_PATHS = ("ml/ai-painter/tests/test_parameter48_causal_observation_v1.py",
                  "ml/ai-painter/tests/test_diagnose_parameter48_causal_gpu_v1.py")


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
    global GPU_POLICY
    GPU_POLICY = restore._binding(request["policy"])
    policy = _json(mapping.binding(GPU_POLICY))
    validate_request(request, policy, cpu=args.cpu_preflight)
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
    for binding in request["programBindings"]: mapping.binding(binding, maximum=1024**2)
    maximum = policy["cpuPreparation"]["maxOutputBytes"] if args.cpu_preflight else policy["resources"]["maxOutputBytes"] - policy["resources"]["maxStreamBytes"]
    writer = _EvidenceWriter(mapping, request["outputRoot"], maximum, resource)
    counts = dict(generatorForwards=0, generatorAutogradAttempts=0, generatorAutogradCompleted=0,
        discriminatorAutograd=0, optimizerConstruction=0, optimizerUpdates=0, cudaCalls=0)
    try:
        components = run_cpu_component_tests(mapping, request["programBindings"], resource=resource) if args.cpu_preflight else None
        model, critic, manifest, state = _prepare_state(mapping, policy, resource)
        sample, order, reader = load_failure_sample(mapping, manifest, resource=resource)
        _verify_imports(mapping, request["programBindings"])
        if args.cpu_preflight:
            status, capture_bindings, summary = "cpu_preflight_passed_not_gpu_or_root_cause", {}, {}
        else:
            acceptance = _json(mapping.binding(request["cpuAcceptance"]))
            require(acceptance["schemaVersion"] == "parameter48-current-cpu-acceptance-v1"
                    and acceptance["status"] == "current_cpu_accepted_not_gpu_result"
                    and acceptance["policy"] == GPU_POLICY and acceptance["programBindings"] == request["programBindings"]
                    and acceptance["interpreter"] == request["interpreter"], "own current CPU acceptance differs")
            require(acceptance["worker"]["status"] == "cpu_preflight_passed_not_gpu_or_root_cause"
                    and acceptance["worker"].get("cpuComponentTests", {}).get("status") == "passed",
                    "current CPU worker/components did not pass")
            require(request["cpuAcceptance"]["path"].startswith(policy["outputRoot"]+"/parameter48-cpu-current-"), "historical CPU attempt cannot grant this route")
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
            phase = run_observed_g_phase(model, critic, sample, order, resource=resource)
            counts.update(phase["counts"])
            capture_bindings, summary = {}, {}
            if phase["status"] == "diagnostic_target_gate_observed":
                def preserve(error, observation):
                    failure = writer.json("original-gate-failure.json", error)
                    values = {"input": observation["input_tensor"],
                        **{"adjoint."+label: value for label, value in zip(LABELS, observation["adjoints"])},
                        **{"gradient."+label: value for label, value in zip(LABELS, observation["native_gradients"])}}
                    archive = writer.write("target-capture.pt", _tensor_archive(values, policy["resources"]["maxTargetCaptureBytes"]))
                    metadata = writer.json("target-capture.json", observation["metadata"])
                    capture_bindings.update(originalGateFailure=failure, tensors=archive, metadata=metadata)
                    return dict(capture_bindings)
                completed = finish_target_contrast(phase, preserve=preserve, resource=resource)
                report = completed["contrast"]
                tensors = {"observedDifference": report["observedDifference"], "residual": report["residual"],
                    **{"reference."+str(i): v for i, v in enumerate(report["referenceGradients"])}, **report["terms"]}
                capture_bindings["contrastTensors"] = writer.write("local-contrast.pt", _tensor_archive(tensors, 32*1024**2))
                summary = {k: v for k, v in report.items() if k not in ("referenceGradients", "terms", "observedDifference", "residual", "upstreamAdjointDifference")}
                counts.update(completed["counts"])
                status = completed["status"]
            else:
                status = phase["status"]
                if status == "diagnostic_failed_closed": summary = {k: v for k, v in phase.items() if k not in ("counts", "_phaseProof")}
                elif phase.get("originalGateFailure"):
                    capture_bindings["originalGateFailure"] = writer.json("original-gate-failure.json", phase["originalGateFailure"])
                    summary = {k: phase[k] for k in ("reasonCode", "meaning", "originalGateFailure")}
        reader.unchanged()
        _verify_imports(mapping, request["programBindings"])
        mapping.binding(GPU_POLICY)
        resource()
        result = dict(schemaVersion="parameter48-causal-worker-result-v1", status=status, runId=request["runId"],
            policy=GPU_POLICY, counts=counts, sourceStateTiming="after_exception", statePreparation=state,
            cpuComponentTests=components, cpuAffinity=affinity,
            sampleId=restore.SAMPLE_ID, sourceReceipts=dict(reader.observed), artifacts=capture_bindings, contrast=summary,
            historicalReplayAllowed=False, trainingAllowed=False, stage4Qualified=False, rootCauseProven=False,
            checkpointWritten=False, cudaCallCountingScope="explicit_initialization_and_memory_query_not_kernel_count")
        binding = writer.json("cpu-worker-result.json" if args.cpu_preflight else "worker-result.json", result)
        resource()
        print(json.dumps({**result, "workerResult": binding}, allow_nan=False))
    except BaseException as error:
        if "phase" in locals(): counts.update(phase["counts"])
        failure = dict(status="diagnostic_failed_closed", runId=request["runId"], policy=GPU_POLICY,
            originalGateFailure=phase.get("originalGateFailure") if "phase" in locals() else None,
            counts=counts, error=dict(type=type(error).__name__, message=str(error)[:8192]), historicalReplayAllowed=False,
            trainingAllowed=False, stage4Qualified=False, rootCauseProven=False)
        try:
            # Failure evidence remains permitted after the compute deadline; it
            # consumes the original total quota, not a new execution allowance.
            writer.resource = lambda: mapping.check()
            failure["evidence"] = writer.json("worker-failure.json", failure, failure=True)
        except BaseException as secondary: failure["secondaryEvidenceError"] = str(secondary)[:2048]
        print(json.dumps(failure, allow_nan=False))
        raise


if __name__ == "__main__": main()

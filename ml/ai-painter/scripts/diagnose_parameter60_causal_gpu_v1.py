"""Independent zero-update parameter60 diagnostic; never a training entry.

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
from copy import deepcopy

WORKER_STARTED = time.monotonic()

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture
from ai_painter.complete_world import parameter60_causal_restore_v1 as restore
from ai_painter.complete_world.parameter60_causal_observation_v1 import (
    Parameter60Observer, LABELS, TARGET_NAME, TARGET_INDEX, decompose_target_gradients,
)
from ai_painter.complete_world import object_head_core_priority_update_v24_cpu as gate_module

GATE_SHA = "b0bc959700244ee508e2a9f3dd257f882abf4717f4e99b7d21f40d4a5b47f1ad"
PROFILE_SHA = "13ae825668d6e01068a3e96610d22e2b22403c8e2e22fde4fafec17845df43f4"
TARGET_ERROR = "actual total gradient identity differs at parameter 60"
require = capture.require
GPU_POLICY = {"path": "data/ai-painter/system-governance/ai-painter-parameter60-causal-gpu-policy-v3.json",
    "sha256": "454cf9bdb76274ba53ed4adc4851ecb7bc3e466fbfac7e5f14c824dbd6a4b56b"}
_PHASE_PROOFS = weakref.WeakKeyDictionary()


class _PhaseProof:
    pass


def _profile():
    logical = "ml/ai-painter/scripts/painter_stage4_ecology_decode1_weight_training_profile_v1.py"
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


def _authenticate_gate(error, observation):
    """Authenticate actual immutable code, traceback location and observed values.

    A matching message, filename or caller boolean alone is never sufficient.
    """
    require(type(error) is ValueError and str(error) == TARGET_ERROR, "not the exact parameter60 gate failure")
    gate = gate_module.apply_object_head_core_priority_update_v24_cpu
    helper = gate_module._require
    source = Path(gate.__code__.co_filename)
    require(source.resolve() == ROOT / "ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py"
            and not source.is_symlink(), "gate source path differs")
    raw = source.read_bytes()
    require(capture.digest(raw) == GATE_SHA, "frozen original gate SHA differs")
    compiled = compile(raw, gate.__code__.co_filename, "exec", dont_inherit=True)
    require(_code_identity(gate.__code__) == _code_identity(_compiled_function(compiled, gate.__name__))
            and _code_identity(helper.__code__) == _code_identity(_compiled_function(compiled, "_require")),
            "loaded original gate code differs from frozen source")
    frames = []
    traceback = error.__traceback__
    while traceback is not None:
        frames.append(traceback)
        traceback = traceback.tb_next
    matches = [tb for tb in frames if tb.tb_frame.f_code is gate.__code__]
    require(len(matches) == 1 and frames[-1].tb_frame.f_code is helper.__code__
            and frames[-1].tb_lineno == 27, "original gate traceback origin differs")
    target = matches[0]
    require(target.tb_lineno == 161 and target.tb_frame.f_locals.get("index") == TARGET_INDEX,
            "original parameter60 gate code location differs")
    local = target.tb_frame.f_locals
    for label, name, observed in zip(LABELS,
            ("total_gradients", "structured_gradients", "whole_frame_gradients", "core_gradients"),
            observation["native_gradients"]):
        values = local.get(name)
        require(type(values) in (tuple, list) and len(values) == 108 and values[60] is not None
                and _diagnostic_tensor_sha(values[60]) == _diagnostic_tensor_sha(observed),
                "gate inputs differ from same-call observed target: " + label)
    return {"type": "ValueError", "message": str(error), "sourceSha256": GATE_SHA,
            "sourcePath": str(source), "gateLine": target.tb_lineno, "raiseLine": frames[-1].tb_lineno,
            "meaning": "original_gate_failure_preserved_not_a_training_pass"}


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
    """One original G forward/four original grads; target contrast is separate.

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
        profile._phase(critic, False)
        frozen_d = _network_state(critic)
        bound = profile._bound_device(model, sample)
        bound_before = _sample_state(bound)
        observer = Parameter60Observer(model, resource=resource)
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
            require(counts["generatorAutogradAttempts"] == counts["generatorAutogradCompleted"] == 4,
                    "all four original independent gradients must complete")
            original_gate = _authenticate_gate(error, observed)
            result = dict(status="diagnostic_target_gate_observed", counts=counts,
                originalGateFailure=original_gate, observation=observed,
                meaning="same_call_observation_not_root_cause_or_qualification")
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
        _PHASE_PROOFS[token] = (result, initial_g, initial_d, model, critic, original_sample, sample)
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
    _, g_before, d_before, model, critic, sample_before, sample = _PHASE_PROOFS.pop(token)
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
    report = decompose_target_gradients(observation["input_tensor"], observation["adjoints"],
        observation["native_gradients"], convolution=observation["convolution"])
    resource()
    return dict(status="diagnostic_target_evidence_complete", originalGateFailure=phase["originalGateFailure"],
        preservation=preservation, counts={**phase["counts"], "localFp64WeightVjp": 4},
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
    require(request.get("schemaVersion") == "parameter60-causal-gpu-request-v1"
            and request.get("policy") == GPU_POLICY, "exact independent GPU request/policy required")
    require(policy.get("schemaVersion") == "ai-painter-parameter60-causal-gpu-policy-v3"
            and policy.get("status") == "registered_zero_update_diagnostic_requires_own_cpu_acceptance",
            "registered diagnostic policy required")
    require(policy["formalSpecification"] == {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
        "version": "AI-PAINTER-SPEC-1.65", "sha256": "84e7332ab2527b6d6c9c9e7b81fb77b1cfe0d7ad2339f6be17508628b424057b"},
        "independent 1.65 normative binding required")
    require(policy["attemptClaimPath"] == policy["outputRoot"] + "/attempt-v3.json"
            and policy["resources"]["attempts"] == 1 and policy["resources"]["automaticRetries"] == 0,
            "independent one-attempt successor required")
    require(request.get("mode") == ("cpu_preflight" if cpu else "gpu_diagnostic"), "phase mode differs")
    run = request.get("runId")
    require(type(run) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", run)
            and request.get("outputRoot") == policy["outputRoot"] + "/" + run, "own run/output namespace required")
    deadline = request.get("deadlineUnixMs")
    require(type(deadline) is int and 0 < deadline/1000-now <= (120 if cpu else 180), "fixed shared deadline required")
    programs = request.get("programBindings")
    require(type(programs) is list and 1 <= len(programs) <= 256
            and len({b["path"] for b in programs}) == len(programs), "bounded unique program lineage required")
    require(policy["scope"]["failureSampleId"] == restore.SAMPLE_ID and policy["scope"]["sampleSplit"] == "train"
            and policy["scope"]["sampleCount"] == 1 and policy["scope"]["resolution"] == [256, 192], "single failure train scope required")
    require(policy["target"]["parameterIndex"] == 60 and policy["target"]["parameterName"] == TARGET_NAME,
            "parameter60 scope required")
    require(policy["comparison"]["atol"] == 1e-6 and policy["comparison"]["rtol"] == 1e-5,
            "original gradient tolerance required")
    require(all(value is False for value in policy["qualification"].values()), "diagnostic grants no model qualification")


def _prepare_state(mapping, policy, resource):
    expected = [{"path": restore.SOURCE_ROOT + name, "sha256": sha} for name, sha in restore.SOURCE_HASHES.items()]
    require(policy["sourceEvidence"] == expected, "exact failed Run evidence required")
    archive = policy["sourceTensorArchive"]
    require(archive == {"path": restore.SOURCE_ROOT + "gradient-failure/tensors.pt", "sha256": restore.ARCHIVE_SHA,
                        "bytes": 42252025}, "exact failed archive required")
    records = []
    for binding in expected:
        resource()
        records.append(_json(mapping.binding(binding)))
    terminal, manifest, primary, identity = records
    context = manifest["context"]
    require(terminal["status"] == terminal["executionState"] == "failed_closed"
            and terminal["runId"] == context["runId"] and terminal["executionPackage"] == context["executionPackage"]
            and terminal["failurePosition"] == context["failurePosition"] and terminal["originalError"] == primary["primaryError"],
            "source terminal/context differs")
    require(primary["timing"] == manifest["stateTiming"] == "after_exception" and primary["context"] == context
            and primary["primaryError"]["type"] == "ValueError" and primary["primaryError"]["message"] == TARGET_ERROR,
            "exact parameter60 original failure required")
    capture.validate_manifest(manifest)
    require(manifest["status"] == "captured" and not manifest["missing"] and not manifest["nonfiniteTensorKeys"]
            and manifest["labels"] == list(LABELS) and len(manifest["gradients"]) == 4,
            "complete finite original capture required")
    require(terminal["captureReceipt"]["replayAllowed"] is False and manifest["replayAllowed"] is False
            and context["sampleId"] == context["sampleIdentity"]["sampleId"] == restore.SAMPLE_ID
            and context["split"] == context["sampleIdentity"]["split"] == "train"
            and context["sampleBindings"] == policy["sourceSampleBindings"], "original replay/sample boundary differs")
    require(identity["graph"] == manifest["graph"] and len(identity["graph"]) == 108
            and identity["capabilityVersion"] == terminal["capabilityVersion"], "source model graph/capability differs")
    execution = _json(mapping.binding(manifest["executionBinding"]))
    require(execution["runId"] == context["runId"] and execution["programBindings"] == context["programBindings"]
            and execution["modelBinding"] == context["modelBinding"], "capture execution identity differs")
    mapping.binding(context["executionPackage"])
    verified = {}
    for binding in context["programBindings"].values():
        if restore._is_original_python_source(binding["path"]):
            resource()
            raw = mapping.binding(restore._binding(binding), maximum=1024**2)
            verified[str(mapping.path(binding["path"]))] = capture.digest(raw)
    require(len(policy["sourceAlgorithmBindings"]) == 5, "five original algorithms required")
    for item in policy["sourceAlgorithmBindings"]:
        require(item["binding"] == context["programBindings"][item["role"]], "original algorithm collision")
        mapping.binding(item["binding"], maximum=1024**2)
    require(manifest["artifacts"]["tensors"] == archive, "archive receipt differs")
    raw = mapping.binding(restore._binding(archive), maximum=capture.MAX_CAPTURE)
    require(len(raw) == archive["bytes"], "archive size differs")
    resource()
    tensors = capture.safe_load_bytes(raw, archive["sha256"], manifest)
    require(all(bool(torch.isfinite(v).all()) for v in tensors.values()), "nonfinite archived tensor")
    order = [row["id"] for row in context["sampleIdentity"]["channels"]]
    require(len(order) == len(set(order)) == 23, "23 original channels required")
    with restore._preserve_current_rng():
        model, critic = restore._fresh_networks(mapping.project, order, verified)
        capture.validate_graph(tuple(model.named_parameters(remove_duplicate=False)), manifest["graph"])
        require(len(tuple(critic.parameters())) == 14, "complete original D14 required")
        states = [v for n in (model, critic) for v in (*n.parameters(), *n.buffers()) if v.numel()]
        require(len({_tensor_identity(v)[2:4] for v in states}) == len(states), "cross-network state alias")
        for prefix, network in (("generator", model), ("discriminator", critic)):
            restore._state_plan(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
        state = {prefix: restore._restore_network(network, manifest["networks"][prefix], tensors, manifest["tensorDescriptors"])
                 for prefix, network in (("generator", model), ("discriminator", critic))}
    resource()
    return model, critic, manifest, state


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
    cpu = profile.core.cpu
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
    record, _, _ = profile.predecessor.derive_regime_record(reader, identity)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    parser.add_argument("--cpu-preflight", action="store_true")
    args = parser.parse_args()
    mapping = capture.RuntimeMap.current(ROOT)
    request = _json(mapping.binding({"path": args.request, "sha256": args.request_sha256}))
    policy = _json(mapping.binding(GPU_POLICY))
    validate_request(request, policy, cpu=args.cpu_preflight)
    formal = policy["formalSpecification"]
    mapping.binding({k: formal[k] for k in ("path", "sha256")})
    mapping.binding(policy["designBinding"])
    for binding in policy["predecessorRegistration"].values(): mapping.binding(binding)
    require(Path(sys.executable).resolve() == Path(request["interpreter"]["path"]).resolve()
            and capture.digest(Path(sys.executable).read_bytes()) == request["interpreter"]["sha256"], "interpreter binding differs")
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    deadline = request["deadlineUnixMs"] / 1000
    def resource():
        require(time.time() < deadline and time.monotonic()-WORKER_STARTED < (120 if args.cpu_preflight else 180), "shared diagnostic deadline exceeded")
        require(torch.get_num_threads() <= 2, "CPU thread limit exceeded")
        if args.cpu_preflight: require(not torch.cuda.is_initialized(), "CPU preflight initialized CUDA")
        mapping.check()
    resource()
    for binding in request["programBindings"]: mapping.binding(binding, maximum=1024**2)
    maximum = policy["resources"]["cpuPreflightMaxOutputBytes"] if args.cpu_preflight else policy["resources"]["maxOutputBytes"] - policy["resources"]["maxStreamBytes"]
    writer = _EvidenceWriter(mapping, request["outputRoot"], maximum, resource)
    counts = dict(generatorForwards=0, generatorAutogradAttempts=0, generatorAutogradCompleted=0,
        discriminatorAutograd=0, optimizerConstruction=0, optimizerUpdates=0, cudaCalls=0)
    try:
        model, critic, manifest, state = _prepare_state(mapping, policy, resource)
        sample, order, reader = load_failure_sample(mapping, manifest, resource=resource)
        _verify_imports(mapping, request["programBindings"])
        if args.cpu_preflight:
            status, capture_bindings, summary = "cpu_preflight_passed_not_gpu_or_root_cause", {}, {}
        else:
            acceptance = _json(mapping.binding(request["cpuAcceptance"]))
            require(acceptance["schemaVersion"] == "parameter60-current-cpu-acceptance-v1"
                    and acceptance["status"] == "current_cpu_accepted_not_gpu_result"
                    and acceptance["policy"] == GPU_POLICY and acceptance["programBindings"] == request["programBindings"]
                    and acceptance["interpreter"] == request["interpreter"], "own current CPU acceptance differs")
            require(acceptance["worker"]["status"] == "cpu_preflight_passed_not_gpu_or_root_cause", "current CPU worker did not pass")
            require(request["cpuAcceptance"]["path"].startswith(policy["outputRoot"]+"/parameter60-cpu-current-"), "historical CPU attempt cannot grant this route")
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
                    "upstreamAdjointDifference": report["upstreamAdjointDifference"],
                    **{"reference."+str(i): v for i, v in enumerate(report["referenceGradients"])}, **report["terms"]}
                capture_bindings["contrastTensors"] = writer.write("local-contrast.pt", _tensor_archive(tensors, 32*1024**2))
                summary = {k: v for k, v in report.items() if k not in ("referenceGradients", "terms", "observedDifference", "residual", "upstreamAdjointDifference")}
                counts.update(completed["counts"])
                status = completed["status"]
            else:
                status = phase["status"]
                if status == "diagnostic_failed_closed": summary = {k: v for k, v in phase.items() if k not in ("counts", "_phaseProof")}
        reader.unchanged()
        _verify_imports(mapping, request["programBindings"])
        mapping.binding(GPU_POLICY)
        resource()
        result = dict(schemaVersion="parameter60-causal-worker-result-v1", status=status, runId=request["runId"],
            policy=GPU_POLICY, counts=counts, sourceStateTiming="after_exception", statePreparation=state,
            sampleId=restore.SAMPLE_ID, sourceReceipts=dict(reader.observed), artifacts=capture_bindings, contrast=summary,
            historicalReplayAllowed=False, trainingAllowed=False, stage4Qualified=False, rootCauseProven=False,
            checkpointWritten=False, cudaCallCountingScope="explicit_initialization_and_memory_query_not_kernel_count")
        binding = writer.json("cpu-worker-result.json" if args.cpu_preflight else "worker-result.json", result)
        resource()
        print(json.dumps({**result, "workerResult": binding}, allow_nan=False))
    except BaseException as error:
        failure = dict(status="diagnostic_failed_closed", runId=request["runId"], policy=GPU_POLICY,
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

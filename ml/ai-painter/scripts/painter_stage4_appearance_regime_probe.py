"""Explicit managed successor profile. Source-bound season, no default routing."""
from __future__ import annotations
from contextlib import contextmanager, nullcontext
from copy import deepcopy
from dataclasses import dataclass
import hashlib
import json
import random
import numpy as np
import torch
import painter_stage4_v24_object_head_core_priority_probe as v24
from ai_painter.complete_world.object_appearance_regime_input_cpu import require, bound_regime, validate_regime
from ai_painter.complete_world.object_appearance_regime_bias_precision import (
    build_fresh_object_appearance_regime_bias_precision, seasonal_parameter, CAPABILITY, ARCHITECTURE)
from ai_painter.complete_world.object_appearance_regime_priority_update import (
    compute_generator_candidate_gradients, observe_generator_gradients, bind_parameters,
    generator_full_fp32_backend, commit_generator_step)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator, discriminator_train_objective
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective

core = v24.core


def _binding_from_source(reader, source, key):
    path = source[key + "Path"]
    _, binding = reader.snapshot(path)
    if key != "realEarthRegionSourcePackage":
        require(binding["sha256"] == source[key + "Sha256"], "source raw identity differs: " + key)
    else:
        binding["taskBoundCanonicalPackageSha256"] = source[key + "Sha256"]
    return binding


def derive_regime_record(reader, identity):
    """Read pack/task/provenance only, never validation target RGB or metrics."""
    require(identity["split"] in ("train", "validation"), "unsupported metadata split")
    pack = reader.json(identity["conditionPack"])
    task = reader.json(identity["taskPackage"])
    source = task["sourceBindings"]
    region_binding = _binding_from_source(reader, source, "realEarthRegionSourcePackage")
    region = reader.json(region_binding)
    provenance = region["sourceProvenance"]
    record = {"conditionPack": deepcopy(identity["conditionPack"]), "taskPackage": deepcopy(identity["taskPackage"]),
        "seasonSnapshot": _binding_from_source(reader, source, "seasonSnapshot"),
        "regionalProfile": _binding_from_source(reader, source, "regionalProfile"),
        "regionSourcePackage": region_binding,
        "sourceRegistry": {"path": provenance["sourceRegistryPath"], "sha256": provenance["sourceRegistrySha256"]}}
    code, facts = bound_regime(reader, record)
    require(pack["categoricalConditions"]["ecologyPlan"]["season"] == facts["season"], "source season differs")
    return record, code, facts


def prepare_metadata(reader, diagnostic_binding, condition_binding, *, collect_train_assets=False):
    diagnostic = reader.json(diagnostic_binding)
    manifest = reader.json(diagnostic["datasetManifest"])
    contract = reader.json(condition_binding)
    order = manifest["identityPayload"]["channelOrder"]
    continuous = manifest["identityPayload"]["continuousChannelIds"]
    require(len(order) == len(set(order)) == 23 and order == contract["tensorContract"]["channelOrder"]
        and continuous == contract["tensorContract"]["typePartitions"]["continuous"], "channel contract differs")
    records = {}; split_ids = {}
    for split, count in (("train", 48), ("validation", 8)):
        split_file = reader.json(diagnostic[split + "Split"])
        ids = split_file["sampleIds"]
        require(split_file["split"] == split and len(ids) == len(set(ids)) == count, "split membership differs")
        rows = [row for row in diagnostic["rows"] if row["split"] == split]
        require(len(rows) == count and {row["ordinal"] for row in rows} == set(range(count)), "metadata ordinal set differs")
        split_ids[split] = list(ids)
        for row in rows:
            identity = deepcopy(row["identity"])
            ordinal = row["ordinal"]
            # Diagnostic split order and the original pack's source ordinal
            # are different namespaces. Preserve the source ordinal verbatim.
            require(identity["sampleId"] == row["sampleId"] == ids[ordinal] and identity["split"] == split,
                "metadata source identity differs")
            record, code, facts = derive_regime_record(reader, identity)
            pack = reader.json(identity["conditionPack"])
            require([channel["id"] for channel in pack["channels"]] == order, "pack channels differ")
            records[(split, ordinal)] = {"identity": identity, "splitOrdinal": ordinal,
                "regimeRecord": record, "season": facts["season"], "metadataFacts": facts}
            if split == "train" and collect_train_assets:
                reader.read(identity["image"]); reader.read(identity["visualFactManifestFile"])
                task = reader.json(identity["taskPackage"]); source = task["sourceBindings"]
                reader.read({"path": source["naturalizedWorldFactsPath"], "sha256": source["naturalizedWorldFactsSha256"]})
                for channel in pack["channels"]: reader.read(channel)
    require(not set(split_ids["train"]) & set(split_ids["validation"]), "split overlap")
    return {"order": order, "continuous": continuous, "records": records,
        "selected": {str(i): records[("train", i)] for i in (2, 3, 0, 1)},
        "splitSampleIds": split_ids, "metadataCounts": {"train": 48, "validation": 8},
        "validationRgbRead": False, "validationMetricSelection": False, "executionAuthorityGranted": False}


def tensor_digest(value):
    value = value.detach().cpu().contiguous()
    return hashlib.sha256(str(value.shape).encode() + str(value.dtype).encode() + value.numpy().tobytes()).hexdigest()


@dataclass(frozen=True)
class _SeasonBinding:
    reader: object
    identity_json: str
    record_json: str
    tensor_hashes: tuple
    table_json: str


def bind_sample_season(reader, sample, identity, record):
    require(sample.get("sampleId") == identity["sampleId"] and sample.get("split") == identity["split"]
        and identity["split"] in ("train", "validation"), "sample source/split differs")
    require(record["conditionPack"] == identity["conditionPack"] and record["taskPackage"] == identity["taskPackage"], "sample metadata source differs")
    code, _ = bound_regime(reader, record)
    require(all(isinstance(sample.get(k), torch.Tensor) and sample[k].device.type == "cpu"
        and sample[k].dtype == torch.float32 and not sample[k].requires_grad for k in ("conditions", "image")), "bind detached CPU source tensors")
    pack = reader.json(record["conditionPack"])
    require(sample["objectInstanceTable"] == pack["objectInstanceTable"], "sample object table differs from pack")
    bound = {**sample, "appearance_regime": code.clone()}
    bound["_appearance_regime_binding"] = _SeasonBinding(reader,
        json.dumps(identity, sort_keys=True), json.dumps(record, sort_keys=True),
        tuple(tensor_digest(sample[k]) for k in ("conditions", "image")), json.dumps(sample["objectInstanceTable"], sort_keys=True))
    return bound


def validate_sample_season(sample):
    binding = sample.get("_appearance_regime_binding")
    require(type(binding) is _SeasonBinding, "source-bound appearance regime required")
    identity, record = json.loads(binding.identity_json), json.loads(binding.record_json)
    require(sample.get("sampleId") == identity["sampleId"] and sample.get("split") == identity["split"], "bound sample identity differs")
    actual, _ = bound_regime(binding.reader, record)
    code = validate_regime(sample.get("appearance_regime"))
    require(torch.equal(code, actual), "bound appearance regime differs from original source")
    require(all(not sample[k].requires_grad and sample[k].dtype == torch.float32 for k in ("conditions", "image"))
        and tuple(tensor_digest(sample[k]) for k in ("conditions", "image")) == binding.tensor_hashes
        and json.dumps(sample["objectInstanceTable"], sort_keys=True) == binding.table_json, "bound sample content changed")
    return code


def fresh_networks(order):
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(core.TRAINING["initializationSeed"])
        model = build_fresh_object_appearance_regime_bias_precision(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
    return model, critic


@contextmanager
def generator_fp32_scope(device):
    with generator_full_fp32_backend(), torch.autocast(device.type, enabled=False):
        yield


def sample_forward(model, sample, return_evidence=False):
    code = validate_sample_season(sample)
    device = next(model.parameters()).device
    with generator_fp32_scope(device):
        return model(sample["conditions"].detach().to(device)[None], sample["objectInstanceTable"],
            appearance_regime=code, return_evidence=return_evidence)


def _phase(critic, training):
    critic.train(training).requires_grad_(training)
    v24._require_critic_phase(critic, training=training, trainable=training)


def _bound_device(model, sample):
    validate_sample_season(sample)
    device = next(model.parameters()).device
    return {**sample, "conditions": sample["conditions"].detach().to(device), "image": sample["image"].detach().to(device)}


def _critic_state(critic):
    return (tuple((name, tensor_digest(value)) for name, value in critic.state_dict().items()),
        tuple(None if p.grad is None else tensor_digest(p.grad) for p in critic.parameters()), v24._critic_tensor_versions(critic))


def _cuda_rng_snapshot(device):
    # CPU paths must not touch CUDA RNG even in an already-initialized process.
    return torch.cuda.get_rng_state(device).clone() if device.type == "cuda" else None


def _backend_snapshot():
    return (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
        torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
        torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision)


def _diagnostic_update(container, value, primary):
    if container is None: return
    try: container.update(value)
    except BaseException as secondary:
        try: primary.secondary_diagnostic_error = str(secondary)
        except BaseException: pass


def _diagnostic_append(container, key, value, primary):
    if container is None: return
    try: container.setdefault(key, []).append(value)
    except BaseException as secondary:
        try: primary.secondary_diagnostic_error = str(secondary)
        except BaseException: pass


def _generator_candidate(model, critic, sample, order, prediction):
    with generator_fp32_scope(next(model.parameters()).device):
        total, parts = train_object_core_fidelity_candidate_objective(critic, prediction, sample, sample["objectInstanceTable"], order)
        candidate, facts = compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
            actual_total=total, structured_objective=parts["v21UnchangedTotal"],
            whole_frame_fidelity=parts["wholeFrameFidelity"], object_core_rgb=parts["objectCoreRgbWeighted"])
    return total, candidate, facts


def _d_objective(critic, prediction, sample, device):
    with (torch.autocast("cuda", dtype=torch.bfloat16) if device.type == "cuda" else nullcontext()):
        return core.gpu.detached_discriminator_objective(critic, prediction.detach(), sample)


def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
        counts, ledger_row, resource, forward, after_update=lambda name, loss: None):
    require(sample.get("split") == "train" and sample.get("sampleId") == ledger_row["sampleId"], "update source differs")
    require(tuple(order) == tuple(model.condition_channel_order), "update channel order differs")
    bound = _bound_device(model, sample); device = next(model.parameters()).device
    entry = v24._critic_mode_snapshot(critic)
    primary = None
    try:
        generator_optimizer.zero_grad(set_to_none=True); resource()
        _phase(critic, True)
        # Every G forward, including the D-phase no-grad forward, uses IEEE FP32.
        with torch.no_grad(), generator_fp32_scope(device):
            detached = sample_forward(model, bound)
        d_loss, _ = _d_objective(critic, detached, bound, device)
        before = counts["discriminator"]
        try:
            core.v21.update_network(critic_optimizer, d_loss, critic, bound, "discriminator", counts, 2304, resource)
        finally:
            ledger_row["discriminator"] += counts["discriminator"] - before
        after_update("discriminator", float(d_loss.detach()))
        require(all(p.grad is None for p in model.parameters()), "D leaked generator gradient")
        critic_optimizer.zero_grad(set_to_none=True)
        _phase(critic, False); frozen = _critic_state(critic)
        with generator_fp32_scope(device):
            prediction = sample_forward(model, bound)
            total, candidate, facts = _generator_candidate(model, critic, bound, order, prediction)
        before = counts["generator"]
        try:
            commit_generator_step(optimizer=generator_optimizer, model=model, candidate_gradients=candidate,
                sample=bound, counts=counts, limit=2304, check_resource=resource, gradient_validator=core.gpu.gradient_facts)
        finally:
            ledger_row["generator"] += counts["generator"] - before
        v24._require_critic_phase(critic, training=False, trainable=False)
        require(_critic_state(critic) == frozen, "G changed frozen critic")
        after_update("generator", float(total.detach()))
        return {"generatorLoss": float(total.detach()), "discriminatorLoss": float(d_loss.detach()),
            "fourHeadUpdate": facts, "criticGeneratorPhaseUnchanged": True}
    except BaseException as error:
        primary = error; raise
    finally:
        try: v24._restore_critic_mode_snapshot(entry)
        except BaseException as secondary:
            if primary is None: raise
            try: primary.secondary_restore_error = str(secondary)
            except BaseException: pass


def zero_update_probe(model, critic, sample, order, resource, forward=None, *, event=None, failure_evidence=None):
    """One shared G forward, four independent full G grads, one D grad; no step."""
    require(sample.get("split") == "train", "zero-update gradients require train")
    require(tuple(order) == tuple(model.condition_channel_order), "probe channel order differs")
    bound = _bound_device(model, sample); device = next(model.parameters()).device
    parameters, groups, season_index = bind_parameters(model)
    entry = v24._critic_mode_snapshot(critic)
    state = {key: _critic_state(network) for key, network in (("model", model), ("critic", critic))}
    require(all(p.grad is None for n in (model, critic) for p in n.parameters()), "probe requires clean gradients")
    rng = torch.random.get_rng_state().clone(); python_rng = random.getstate(); numpy_rng = np.random.get_state()
    cuda_rng = _cuda_rng_snapshot(device); backend = _backend_snapshot()
    primary = None; raw = []
    def emit(stage, kind, gradients=None):
        if stage == "attempt": resource()
        if gradients is not None and kind == "generator": raw.append(gradients)
        if event is not None: event(stage, kind, gradients)
        if stage == "complete": resource()
    def observe(stage, label, gradients): emit(stage, "generator", gradients)
    try:
        emit("attempt", "forward")
        prediction, evidence = sample_forward(model, bound, return_evidence=True)
        emit("complete", "forward")
        _phase(critic, True)
        d_loss, _ = _d_objective(critic, prediction, bound, device)
        emit("attempt", "discriminator")
        d_gradients = torch.autograd.grad(d_loss, tuple(critic.parameters()), create_graph=False, allow_unused=True)
        emit("complete", "discriminator", d_gradients)
        require(all(v is None or bool(torch.isfinite(v).all()) for v in d_gradients)
            and any(v is not None and bool(v.count_nonzero()) for v in d_gradients), "D gradients nonfinite/zero")
        _phase(critic, False); frozen = _critic_state(critic)
        with observe_generator_gradients(observe):
            total, candidate, facts = _generator_candidate(model, critic, bound, order, prediction)
        v24._require_critic_phase(critic, training=False, trainable=False)
        require(_critic_state(critic) == frozen, "probe G changed frozen critic")
        seasonal = raw[0][season_index]; active = int(sample["appearance_regime"].argmax())
        require(seasonal is not None, "seasonal gradient missing")
        norms = [float(seasonal[:, i].norm()) for i in range(4)]
        require(norms[active] > 0 and all(norms[i] == 0 for i in range(4) if i != active), "seasonal slice unreachable")
        require(torch.equal(candidate[season_index], seasonal), "seasonal gradient changed")
        for key, indexes in groups.items():
            if bool(bound["conditions"][list(order).index(key)].count_nonzero()):
                require(any(raw[3][i] is not None and bool(raw[3][i].count_nonzero()) for i in indexes)
                    and facts["generatorGradientFacts"]["headCandidateL2"][key] > 0, "applicable head unreachable: " + key)
        return {"passed": True, "optimizerCreated": False, "optimizerUpdates": 0,
            "loss": float(total.detach()), "discriminatorLoss": float(d_loss.detach()),
            "fourHeadUpdate": facts, "seasonalSliceL2": norms, "objectCount": evidence["objectCount"],
            "callCounts": {"generatorForwards": 1, "generatorAutograd": 4, "discriminatorAutograd": 1},
            "cudaRngChecked": cuda_rng is not None}
    except BaseException as error:
        primary = error
        if failure_evidence is not None:
            _diagnostic_update(failure_evidence, {"originalError": str(error), "gradientSetsAvailable": len(raw)}, error)
            try:
                failure_evidence["rawGradientSummaries"] = [{"set": j, "parameters": [
                    {"index": i, "name": name, "unused": value is None,
                     "finite": value is None or bool(torch.isfinite(value).all())}
                    for i, ((name, _), value) in enumerate(zip(model.named_parameters(), rows))]}
                    for j, rows in enumerate(raw)]
            except BaseException as secondary:
                _diagnostic_append(failure_evidence, "secondaryDiagnosticErrors", str(secondary), error)
        raise
    finally:
        try:
            v24._restore_critic_mode_snapshot(entry)
            require(state == {key: _critic_state(network) for key, network in (("model", model), ("critic", critic))}, "zero-update state/grad changed")
            validate_sample_season(sample)
            require(torch.equal(rng, torch.random.get_rng_state()) and random.getstate() == python_rng
                and np.array_equal(numpy_rng[1], np.random.get_state()[1])
                and numpy_rng[0] == np.random.get_state()[0] and numpy_rng[2:] == np.random.get_state()[2:], "zero-update RNG changed")
            require(cuda_rng is None or torch.equal(cuda_rng, torch.cuda.get_rng_state(device)), "zero-update CUDA RNG changed")
            require(backend == _backend_snapshot(), "zero-update backend changed")
        except BaseException as secondary:
            if primary is None: raise
            _diagnostic_append(failure_evidence, "secondaryInvariantErrors", str(secondary), primary)
        finally:
            cleanup_errors = []
            callbacks = [lambda: torch.random.set_rng_state(rng), lambda: random.setstate(python_rng), lambda: np.random.set_state(numpy_rng),
                lambda: torch.use_deterministic_algorithms(backend[0], warn_only=backend[1]),
                lambda: setattr(torch.backends.mkldnn, "enabled", backend[2]), lambda: setattr(torch.backends.mkldnn, "deterministic", backend[3]),
                lambda: setattr(torch.backends.cuda.matmul, "fp32_precision", backend[4]), lambda: setattr(torch.backends.cudnn.conv, "fp32_precision", backend[5])]
            if cuda_rng is not None: callbacks.append(lambda: torch.cuda.set_rng_state(cuda_rng, device))
            for callback in callbacks:
                try: callback()
                except BaseException as secondary: cleanup_errors.append(secondary)
            if cleanup_errors:
                if primary is None: raise cleanup_errors[0]
                for secondary in cleanup_errors: _diagnostic_append(failure_evidence, "secondaryCleanupErrors", str(secondary), primary)

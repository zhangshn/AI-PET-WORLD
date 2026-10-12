"""Explicit factorized ecology profile; source-bound ecology/season, unchanged loss.

No diagnostic import, checkpoint fallback or default routing. Lifecycle callers must
supply their own resource supervisor and authenticated execution package.
"""
from __future__ import annotations
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
import json
import random
import numpy as np
import torch
import painter_stage4_appearance_regime_probe as predecessor
from ai_painter.complete_world.object_appearance_regime_input_cpu import require
from ai_painter.complete_world.object_ecology_regime_conditioned import (
    build_fresh_object_ecology_regime_conditioned, seasonal_parameter,
    CAPABILITY, ARCHITECTURE, NUMERIC_RULE, ecological_parameter)
from ai_painter.complete_world.object_ecology_regime_priority_update import (
    compute_generator_candidate_gradients, observe_generator_gradients, bind_parameters,
    generator_full_fp32_backend)
from ai_painter.complete_world.object_head_core_priority_update_v24 import commit_generator_step
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective
v24 = predecessor.v24
core = predecessor.core
from ai_painter.complete_world.object_ecology_regime_input_cpu import bound_ecology_regime, validate_ecology
tensor_digest = predecessor.tensor_digest

def fresh_networks(order):
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(core.TRAINING["initializationSeed"])
        model = build_fresh_object_ecology_regime_conditioned(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
    return model, critic


@contextmanager
def generator_fp32_scope(device):
    with generator_full_fp32_backend(), torch.autocast(device.type, enabled=False):
        yield


def sample_forward(model, sample, return_evidence=False):
    code = validate_sample_ecology(sample)[0]
    device = next(model.parameters()).device
    with generator_fp32_scope(device):
        return model(sample["conditions"].detach().to(device)[None], sample["objectInstanceTable"],
            appearance_regime=code, ecology_regime=sample["ecology_regime"], return_evidence=return_evidence)


def _phase(critic, training):
    critic.train(training).requires_grad_(training)
    v24._require_critic_phase(critic, training=training, trainable=training)


def _bound_device(model, sample):
    validate_sample_ecology(sample)[0]
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
    parameters, groups, season_index, ecology_index = bind_parameters(model)
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
        ecological = raw[0][ecology_index]; ecology_active = int(sample["ecology_regime"].argmax())
        require(ecological is not None, "ecological gradient missing")
        ecology_norms = [float(ecological[:, i].norm()) for i in range(7)]
        require(ecology_norms[ecology_active] > 0 and all(ecology_norms[i] == 0 for i in range(7) if i != ecology_active), "ecology slice unreachable")
        require(torch.equal(candidate[ecology_index], ecological), "ecology gradient changed")
        for key, indexes in groups.items():
            if bool(bound["conditions"][list(order).index(key)].count_nonzero()):
                require(any(raw[3][i] is not None and bool(raw[3][i].count_nonzero()) for i in indexes)
                    and facts["generatorGradientFacts"]["headCandidateL2"][key] > 0, "applicable head unreachable: " + key)
        return {"passed": True, "optimizerCreated": False, "optimizerUpdates": 0,
            "loss": float(total.detach()), "discriminatorLoss": float(d_loss.detach()),
            "fourHeadUpdate": facts, "seasonalSliceL2": norms, "ecologySliceL2": ecology_norms, "objectCount": evidence["objectCount"],
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
            validate_sample_ecology(sample)[0]
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


@dataclass(frozen=True)
class _EcologyBinding:
    reader: object
    identity_json: str
    record_json: str


def prepare_metadata(reader, diagnostic_binding, condition_binding, *, collect_train_assets=False):
    metadata = predecessor.prepare_metadata(reader, diagnostic_binding, condition_binding,
                                             collect_train_assets=collect_train_assets)
    for row in metadata["records"].values():
        season, ecology, facts = bound_ecology_regime(reader, row["regimeRecord"])
        require(row["season"] == facts["season"], "ecology/season source disagrees")
        row["ecology"] = facts["ecology"]
        row["ecologyMetadataFacts"] = facts
    reader.unchanged()
    return metadata


def bind_sample_ecology(reader, sample, identity, record):
    bound = predecessor.bind_sample_season(reader, sample, identity, record)
    season, ecology, facts = bound_ecology_regime(reader, record)
    require(torch.equal(bound["appearance_regime"], season), "independent ecological season differs")
    bound["ecology_regime"] = ecology.clone()
    bound["_ecology_regime_binding"] = _EcologyBinding(
        reader, json.dumps(identity, sort_keys=True), json.dumps(record, sort_keys=True))
    return bound


def validate_sample_ecology(sample):
    season = predecessor.validate_sample_season(sample)
    token = sample.get("_ecology_regime_binding")
    require(type(token) is _EcologyBinding, "authenticated ecology binding required")
    identity, record = json.loads(token.identity_json), json.loads(token.record_json)
    require(sample["sampleId"] == identity["sampleId"] and sample["split"] == identity["split"],
            "ecology identity/split changed")
    seasonal_token = sample.get("_appearance_regime_binding")
    require(seasonal_token.reader is token.reader
            and json.loads(seasonal_token.identity_json) == identity
            and json.loads(seasonal_token.record_json) == record, "season/ecology sources differ")
    actual_season, actual_ecology, _ = bound_ecology_regime(token.reader, record)
    ecology = validate_ecology(sample.get("ecology_regime"))
    require(torch.equal(season, actual_season) and torch.equal(ecology, actual_ecology),
            "source-bound season/ecology changed")
    return season, ecology

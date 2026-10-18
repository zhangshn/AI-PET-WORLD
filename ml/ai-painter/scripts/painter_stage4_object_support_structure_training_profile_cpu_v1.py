"""Inactive CPU generator interface; one-forward/five-VJP probe, no optimizer.

This is not a training or GPU entry. The frozen model and original source-bound
season/ecology loader are reused, without modifying their modules or globals.
"""
from contextlib import contextmanager
import random
import numpy as np
import torch

import painter_stage4_ecology_terrain_detail_weight_training_profile_v1 as parent
from ai_painter.complete_world.native_rgb_object_support_structure_candidate_cpu_v1 import (
    train_object_support_structure_candidate_objective,
)
from ai_painter.complete_world.object_support_structure_priority_update_cpu_v1 import (
    CANDIDATE_ID, MODEL_CAPABILITY, COMPONENTS_IN_ORDER, bind_parameters, require,
    compute_generator_candidate_gradients, observe_generator_gradients,
)

CAPABILITY = CANDIDATE_ID
EXECUTION_QUALIFIED = False
prepare_metadata = parent.prepare_metadata
bind_sample_ecology = parent.bind_sample_ecology
validate_sample_ecology = parent.validate_sample_ecology


def fresh_networks(order):
    require(torch.get_num_threads() <= 2, "CPU<=2 required")
    model, critic = parent.fresh_networks(order)
    bind_parameters(model)
    return model, critic


def _source(model, sample, order):
    require(sample.get("split") == "train", "CPU generator requires train")
    bind_parameters(model)
    require(tuple(order) == tuple(model.condition_channel_order), "CPU generator condition order differs")
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.device.type == "cpu"
            and value.dtype == torch.float32 and not value.requires_grad and bool(torch.isfinite(value).all()),
            "detached CPU source tensors required")
    validate_sample_ecology(sample)
    return sample


def sample_forward(model, sample, return_evidence=False):
    _source(model, sample, model.condition_channel_order)
    return parent.sample_forward(model, sample, return_evidence=return_evidence)


def _network_snapshot(network):
    return (parent._critic_state(network), tuple((id(p), p.requires_grad, id(p.grad)) for p in network.parameters()))


@contextmanager
def _preserve_probe_state(model, critic):
    """Restore modes/flags/RNG on either outcome; report mutation as failure.

    Values/gradients are never deliberately rewritten or silently repaired.
    A mutation and a cleanup failure are secondary when a primary already exists.
    """
    require(isinstance(critic, torch.nn.Module) and all(v.device.type == "cpu"
        and (not v.is_floating_point() or v.dtype == torch.float32)
        for v in (*critic.parameters(), *critic.buffers())), "CPU FP32 critic required")
    networks = (model, critic)
    before = tuple(_network_snapshot(net) for net in networks)
    modes = [(m, m.training) for net in networks for m in net.modules()]
    flags = [(p, p.requires_grad) for net in networks for p in net.parameters()]
    py, numpy, cpu = random.getstate(), np.random.get_state(), torch.random.get_rng_state().clone()
    backend = parent._backend_snapshot()
    primary = None
    try:
        yield
    except BaseException as error:
        primary = error
        raise
    finally:
        errors = []
        def attempt(action):
            try: action()
            except BaseException as error: errors.append(error)
        def rng_check():
            now = np.random.get_state()
            require(random.getstate() == py and np.array_equal(numpy[1], now[1])
                and numpy[0] == now[0] and numpy[2:] == now[2:]
                and torch.equal(cpu, torch.random.get_rng_state()), "CPU probe RNG changed")
        attempt(rng_check)
        for module, mode in modes: attempt(lambda m=module, value=mode: setattr(m, "training", value))
        for parameter, needed in flags: attempt(lambda p=parameter, value=needed: p.requires_grad_(value))
        attempt(lambda: require(before == tuple(_network_snapshot(net) for net in networks), "CPU probe G/D state/grad/identity changed"))
        attempt(lambda: require(parent._backend_snapshot() == backend, "CPU probe backend changed"))
        for action in (lambda: random.setstate(py), lambda: np.random.set_state(numpy), lambda: torch.random.set_rng_state(cpu),
                lambda: torch.use_deterministic_algorithms(backend[0], warn_only=backend[1]),
                lambda: setattr(torch.backends.mkldnn, "enabled", backend[2]),
                lambda: setattr(torch.backends.mkldnn, "deterministic", backend[3]),
                lambda: setattr(torch.backends.cuda.matmul, "fp32_precision", backend[4]),
                lambda: setattr(torch.backends.cudnn.conv, "fp32_precision", backend[5])):
            attempt(action)
        if errors:
            if primary is None: raise errors[0]
            try: primary.secondary_probe_errors = [str(error)[:2048] for error in errors]
            except BaseException: pass


def generator_objective_and_gradients(model, critic, sample, order, prediction):
    """Return actual scalar, unchanged/new parts, checked candidate and trace."""
    _source(model, sample, order)
    require(all(not m.training for m in critic.modules()) and all(not p.requires_grad for p in critic.parameters()),
        "critic must be frozen eval")
    with _preserve_probe_state(model, critic), parent.generator_fp32_scope(torch.device("cpu")):
        total, parts = train_object_support_structure_candidate_objective(critic, prediction, sample, sample["objectInstanceTable"], order)
        candidate, facts = compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
            actual_total=total, structured_objective=parts["v21UnchangedTotal"],
            whole_frame_fidelity=parts["wholeFrameFidelity"], object_core_rgb=parts["objectCoreRgbWeighted"],
            object_support_structure=parts["objectSupportStructureWeighted"])
    return total, parts, candidate, facts


def _plain(value):
    if isinstance(value, torch.Tensor):
        require(value.numel() == 1 and bool(torch.isfinite(value.detach())), "finite scalar diagnostic required")
        return float(value.detach())
    if isinstance(value, dict): return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [_plain(v) for v in value]
    require(value is None or type(value) in (str, bool, int, float), "unrecognized diagnostic")
    return value


def zero_update_probe(model, critic, sample, order, resource, *, event=None, failure_evidence=None):
    """Exactly one real model call and five G VJPs; never D autograd/optimizer."""
    _source(model, sample, order)
    require(not torch.cuda.is_initialized(), "CPU probe cannot inherit initialized CUDA")
    calls = {"generatorForwards": 0, "generatorAutograd": 0, "discriminatorAutograd": 0,
        "optimizerConstruction": 0, "optimizerUpdates": 0}
    completed_labels = []
    def emit(stage, label, gradients=None):
        resource()
        if event is not None: event(stage, label, gradients)
    def forward_seen(*args):
        require(calls["generatorForwards"] == 0, "single shared forward ceiling")
        calls["generatorForwards"] += 1
    def observed(stage, label, gradients):
        if stage == "complete":
            completed_labels.append(label)
            calls["generatorAutograd"] += 1
        emit(stage, label, gradients)
    try:
        with _preserve_probe_state(model, critic):
            parent._phase(critic, False)
            model.eval()
            handle = model.register_forward_pre_hook(forward_seen)
            inner_error = None
            try:
                emit("attempt", "forward")
                prediction, evidence = sample_forward(model, sample, return_evidence=True)
                emit("complete", "forward")
                with observe_generator_gradients(observed):
                    total, parts, candidate, facts = generator_objective_and_gradients(model, critic, sample, order, prediction)
                require(calls["generatorForwards"] == 1 and calls["generatorAutograd"] == 5
                    and tuple(completed_labels) == COMPONENTS_IN_ORDER, "observed one-forward/five-VJP protocol differs")
                result = {"candidateId": CANDIDATE_ID, "modelCapabilityVersion": MODEL_CAPABILITY,
                    "passed": True,
                    "status": "cpu_zero_update_observation_not_qualified", "loss": float(total.detach()),
                    "lossParts": _plain(parts), "fiveGradientFacts": facts, "callCounts": dict(calls),
                    "objectCount": evidence["objectCount"], "optimizerCreated": False, "optimizerUpdates": 0,
                    "modelCriticStateGradUnchanged": True, "rngUnchanged": True, "gpuInitialized": False,
                    "gpuQualificationGranted": False, "trainingGranted": False, "formalStage4QualificationGranted": False}
                resource()
            except BaseException as error:
                inner_error = error
                raise
            finally:
                try: handle.remove()
                except BaseException as error:
                    if inner_error is None: raise
                    inner_error.secondary_hook_cleanup_error = str(error)[:2048]
        return result
    except BaseException as error:
        try:
            error.object_support_probe_calls = dict(calls)
            error.object_support_probe_completed_labels = list(completed_labels)
        except BaseException: pass
        if failure_evidence is not None:
            try:
                raw = getattr(error, "object_support_gradient_evidence", {})
                failure_evidence.update({"originalError": {"type": type(error).__name__, "message": str(error)[:4096]},
                    "callCounts": dict(calls), "completedGradientLabels": list(completed_labels),
                    "gradientSetsAvailable": raw.get("gradientSetsAvailable", 0),
                    "gradientSummaries": [{"label": COMPONENTS_IN_ORDER[i], "parameterTensorCount": len(rows),
                        "unusedTensorCount": sum(v is None for v in rows),
                        "allFinite": all(v is None or bool(torch.isfinite(v).all()) for v in rows)}
                        for i, rows in enumerate(raw.get("rawGradients", []))],
                    "secondaryProbeErrors": getattr(error, "secondary_probe_errors", []),
                    "gpuQualificationGranted": False, "trainingGranted": False})
            except BaseException as secondary:
                try: error.secondary_failure_evidence_error = str(secondary)[:2048]
                except BaseException: pass
        raise

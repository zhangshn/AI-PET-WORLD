"""Independent decode1-entry training adapter: explicit five-VJP G, unchanged D/commit policy.

Importing this module registers nothing and creates no optimizer or execution.
Device implementation is not GPU admission, training or quality qualification.
"""
from contextlib import contextmanager
import random
import sys
import importlib
import numpy as np
import torch
import painter_stage4_ecology_terrain_detail_weight_training_profile_v1 as inherited
import painter_stage4_object_support_structure_training_profile_cpu_v1 as cpu_reference
from ai_painter.complete_world.native_rgb_object_support_structure_device_v1 import (
    train_object_support_structure_candidate_objective)
from ai_painter.complete_world.object_decode1_entry_joint_priority_device_v1 import (
    MODEL_CAPABILITY, COMPONENTS_IN_ORDER, bind_parameters, compute_generator_candidate_gradients,
    observe_generator_gradients, require)
from ai_painter.complete_world.object_head_core_priority_update_v24 import commit_generator_step

CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_v1"
EXECUTION_QUALIFIED = False
UPDATE_LIMIT = 1152
SUPPORT_WEIGHT1_CAPABILITY = "stage4_mvp256_dry_decode1_support_structure_weight1_v1"
prepare_metadata = inherited.prepare_metadata
bind_sample_ecology = inherited.bind_sample_ecology
validate_sample_ecology = inherited.validate_sample_ecology
generator_fp32_scope = inherited.generator_fp32_scope
_d_objective = inherited._d_objective
_phase = inherited._phase
_critic_state = inherited._critic_state
_update_discriminator = inherited.core.v21.update_network


def fresh_networks(order):
    from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
    require(torch.get_num_threads() <= 2 and inherited.core.TRAINING["initializationSeed"] == 20260929,
        "fixed CPU threads/seed required")
    with torch.device("cpu"), torch.random.fork_rng(devices=[]):
        torch.random.default_generator.manual_seed(20260929)
        model = identity.build_fresh_object_ecology_decode1_entry_weight_precision(condition_channel_order=order)
        critic = build_conditional_texture_discriminator()
    bind_parameters(model)
    return model, critic


def _bound_device(model, sample):
    require(sample.get("split") in ("train", "validation"), "train/validation source required")
    validate_sample_ecology(sample)
    parameters = tuple(model.parameters())
    require(parameters and parameters[0].device.type in ("cpu", "cuda"), "CPU/CUDA model required")
    device = parameters[0].device
    with generator_fp32_scope(device): bind_parameters(model)
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and value.shape == shape and value.dtype == torch.float32
            and (value.device.type == "cpu" or value.device == device) and not value.requires_grad
            and bool(torch.isfinite(value).all()) and bool(((value >= 0) & (value <= 1)).all()), "detached bound FP32 source required")
    return {**sample, "conditions": sample["conditions"].detach().to(device), "image": sample["image"].detach().to(device)}


def sample_forward(model, sample, return_evidence=False):
    require(sample.get("split") in ("train", "validation"), "train/validation forward only")
    require(sample.get("split") == "train" or not torch.is_grad_enabled(), "validation is read-only forward")
    bound = _bound_device(model, sample)
    # This helper contains only the authenticated model call and original FP32 scope.
    return inherited.sample_forward(model, bound, return_evidence=return_evidence)


def execution_support_structure_weight(configuration):
    require(type(configuration) is dict, "authenticated training configuration required")
    if configuration.get("capabilityVersion") == SUPPORT_WEIGHT1_CAPABILITY:
        require(type(configuration.get("objectSupportStructureWeight")) is int
            and configuration["objectSupportStructureWeight"] == 1,
            "registered support weight1 configuration required")
        return 1.0
    require("objectSupportStructureWeight" not in configuration,
        "legacy candidate cannot activate support weight1")
    return 0.1


def _validate_support_structure_weight(value):
    require(type(value) is float and value in (0.1, 1.0), "fixed support structure weight required")
    return value


def _generator_candidate(model, critic, sample, order, prediction, *, support_structure_weight=0.1):
    weight = _validate_support_structure_weight(support_structure_weight)
    require(sample.get("split") == "train" and tuple(order) == tuple(model.condition_channel_order), "train/order differs")
    with generator_fp32_scope(next(model.parameters()).device):
        total, parts = train_object_support_structure_candidate_objective(critic, prediction, sample, sample["objectInstanceTable"], order,
            **({"support_structure_weight": weight} if weight == 1.0 else {}))
        candidate, facts = compute_generator_candidate_gradients(model=model, critic=critic, sample=sample,
            actual_total=total, structured_objective=parts["v21UnchangedTotal"],
            whole_frame_fidelity=parts["wholeFrameFidelity"], object_core_rgb=parts["objectCoreRgbWeighted"],
            object_support_structure=parts["objectSupportStructureWeighted"])
    if weight == 1.0: facts["objectSupportStructureWeight"] = 1
    return total, candidate, facts


def _component_profile(components):
    require(components is None or components is sys.modules[__name__],
        "exact decode1 entry training profile required")
    return sys.modules[__name__]

def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
        counts, ledger_row, resource, forward, after_update=lambda name, loss: None, *, update_limit=UPDATE_LIMIT,
        prediction_observer=None, components=None, support_structure_weight=0.1):
    api = _component_profile(components)
    weight = _validate_support_structure_weight(support_structure_weight)
    require(type(update_limit) is int and update_limit == UPDATE_LIMIT, "fixed 1152 update limit required")
    require(sample.get("split") == "train" and sample.get("sampleId") == ledger_row["sampleId"], "update source differs")
    require(tuple(order) == tuple(model.condition_channel_order), "update channel order differs")
    require(all(type(counts.get(k)) is int and 0 <= counts[k] < update_limit for k in ("generator", "discriminator")), "optimizer step budget exhausted")
    bound = api._bound_device(model, sample); device = next(model.parameters()).device
    entry = inherited.v24._critic_mode_snapshot(critic)
    primary = None
    preview_error = None
    try:
        generator_optimizer.zero_grad(set_to_none=True); resource()
        _phase(critic, True)
        with torch.no_grad(), generator_fp32_scope(device):
            detached = api.sample_forward(model, bound)
        d_loss, _ = _d_objective(critic, detached, bound, device)
        before = counts["discriminator"]
        try:
            _update_discriminator(critic_optimizer, d_loss, critic, bound, "discriminator", counts, update_limit, resource)
        finally:
            ledger_row["discriminator"] += counts["discriminator"] - before
        after_update("discriminator", float(d_loss.detach()))
        require(all(p.grad is None for p in model.parameters()), "D leaked generator gradient")
        critic_optimizer.zero_grad(set_to_none=True)
        _phase(critic, False); frozen = _critic_state(critic)
        with generator_fp32_scope(device):
            prediction = api.sample_forward(model, bound)
            if prediction_observer is not None:
                try:
                    prediction_observer(prediction, bound, dict(counts))
                except Exception as secondary:
                    # Optional diagnostics cannot prevent the original G objective.
                    # Safety/control BaseExceptions and resource() remain unchanged.
                    preview_error = {"errorType": type(secondary).__name__, "availabilityCode": "capture_failed"}
            total, candidate, facts = api._generator_candidate(model, critic, bound, order, prediction,
                **({"support_structure_weight": weight} if weight == 1.0 else {}))
        before = counts["generator"]
        try:
            commit_generator_step(optimizer=generator_optimizer, model=model, candidate_gradients=candidate,
                sample=bound, counts=counts, limit=update_limit, check_resource=resource,
                gradient_validator=inherited.core.gpu.gradient_facts)
        finally:
            ledger_row["generator"] += counts["generator"] - before
        inherited.v24._require_critic_phase(critic, training=False, trainable=False)
        require(_critic_state(critic) == frozen, "G changed frozen critic")
        after_update("generator", float(total.detach()))
        result = {"generatorLoss": float(total.detach()), "discriminatorLoss": float(d_loss.detach()),
            "fiveGradientFacts": facts, "criticGeneratorPhaseUnchanged": True}
        if preview_error is not None:
            result["trainingPreviewSecondaryError"] = preview_error
        return result
    except BaseException as error:
        if preview_error is not None:
            try: error.training_preview_secondary_error = preview_error
            except Exception: pass
        primary = error; raise
    finally:
        try: inherited.v24._restore_critic_mode_snapshot(entry)
        except BaseException as secondary:
            if primary is None: raise
            try: primary.secondary_restore_error = str(secondary)
            except BaseException: pass


@contextmanager
def _probe_state(model, critic, device):
    networks = (model, critic)
    state = tuple(cpu_reference._network_snapshot(n) for n in networks)
    modes = [(m, m.training) for n in networks for m in n.modules()]
    flags = [(p, p.requires_grad) for n in networks for p in n.parameters()]
    rng, py, numpy = torch.get_rng_state().clone(), random.getstate(), np.random.get_state()
    cuda_rng = inherited._cuda_rng_snapshot(device)
    backend = inherited._backend_snapshot()
    primary = None
    try:
        yield
    except BaseException as error:
        primary = error; raise
    finally:
        errors = []
        def attempt(action):
            try: action()
            except BaseException as error: errors.append(error)
        for m, value in modes: attempt(lambda m=m, value=value: setattr(m, "training", value))
        for p, value in flags: attempt(lambda p=p, value=value: p.requires_grad_(value))
        attempt(lambda: require(state == tuple(cpu_reference._network_snapshot(n) for n in networks), "probe G/D state/grad/identity changed"))
        def check_rng():
            now = np.random.get_state()
            require(torch.equal(rng, torch.get_rng_state()) and py == random.getstate() and numpy[0] == now[0]
                and np.array_equal(numpy[1], now[1]) and numpy[2:] == now[2:], "probe CPU RNG changed")
        attempt(check_rng)
        if cuda_rng is not None: attempt(lambda: require(torch.equal(cuda_rng, torch.cuda.get_rng_state(device)), "probe CUDA RNG changed"))
        attempt(lambda: require(backend == inherited._backend_snapshot(), "probe backend changed"))
        actions = [lambda: torch.set_rng_state(rng), lambda: random.setstate(py), lambda: np.random.set_state(numpy),
            lambda: torch.use_deterministic_algorithms(backend[0], warn_only=backend[1]),
            lambda: setattr(torch.backends.mkldnn, "enabled", backend[2]), lambda: setattr(torch.backends.mkldnn, "deterministic", backend[3]),
            lambda: setattr(torch.backends.cuda.matmul, "fp32_precision", backend[4]), lambda: setattr(torch.backends.cudnn.conv, "fp32_precision", backend[5])]
        if cuda_rng is not None: actions.append(lambda: torch.cuda.set_rng_state(cuda_rng, device))
        for action in actions: attempt(action)
        if errors:
            if primary is None: raise errors[0]
            try: primary.secondary_probe_errors = [str(error)[:2048] for error in errors]
            except BaseException: pass


def _failure_summary(error, failure_evidence, raw, calls, labels):
    try:
        if not hasattr(error, "object_support_gradient_evidence"):
            error.object_support_gradient_evidence = {"gradientSetsAvailable": len(raw), "rawGradients": raw,
                "componentsInOrder": list(COMPONENTS_IN_ORDER)}
        if failure_evidence is not None:
            failure_evidence.update({"originalError": {"type": type(error).__name__, "message": str(error)[:4096]},
                "callCounts": dict(calls), "completedGradientLabels": list(labels), "gradientSetsAvailable": len(raw),
                "rawGradientSummaries": [{"label": COMPONENTS_IN_ORDER[i], "parameterTensorCount": len(rows),
                    "unusedTensorCount": sum(v is None for v in rows),
                    "allFinite": all(v is None or bool(torch.isfinite(v).all()) for v in rows)} for i, rows in enumerate(raw)],
                "secondaryProbeErrors": getattr(error, "secondary_probe_errors", [])})
    except BaseException as secondary:
        try: error.secondary_failure_evidence_error = str(secondary)[:2048]
        except BaseException: pass


def zero_update_probe(model, critic, sample, order, resource, forward=None, *, event=None, failure_evidence=None,
        components=None, support_structure_weight=0.1):
    """One shared G forward, five G VJPs and one D VJP; no optimizer step."""
    api = _component_profile(components)
    weight = _validate_support_structure_weight(support_structure_weight)
    require(sample.get("split") == "train" and tuple(order) == tuple(model.condition_channel_order), "train/order differs")
    bound = api._bound_device(model, sample); device = next(model.parameters()).device
    with generator_fp32_scope(device): parameters, groups, season, ecology = api.bind_parameters(model)
    require(all(p.grad is None for n in (model, critic) for p in n.parameters()), "probe requires clean gradients")
    calls = {"generatorForwards": 0, "generatorForwardCompleted": 0, "generatorAutograd": 0, "discriminatorAutograd": 0}
    raw, labels = [], []
    def emit(stage, kind, gradients=None):
        resource()
        if event is not None: event(stage, kind, gradients)
    def observed(stage, label, gradients):
        if stage == "complete":
            raw.append(gradients); labels.append(label); calls["generatorAutograd"] += 1
        emit(stage, "generator", gradients)
    def forward_seen(*args):
        require(calls["generatorForwards"] == 0, "single shared G forward required")
        calls["generatorForwards"] += 1
    try:
        with _probe_state(model, critic, device):
            handle = model.register_forward_pre_hook(forward_seen)
            primary = None
            try:
                emit("attempt", "forward")
                prediction, evidence = api.sample_forward(model, bound, return_evidence=True)
                calls["generatorForwardCompleted"] += 1
                emit("complete", "forward")
                _phase(critic, True)
                d_loss, _ = _d_objective(critic, prediction, bound, device)
                emit("attempt", "discriminator")
                d_gradients = torch.autograd.grad(d_loss, tuple(critic.parameters()), create_graph=False, allow_unused=True)
                calls["discriminatorAutograd"] += 1
                emit("complete", "discriminator", d_gradients)
                require(all(v is None or bool(torch.isfinite(v).all()) for v in d_gradients)
                    and any(v is not None and bool(v.count_nonzero()) for v in d_gradients), "D gradients nonfinite/zero")
                _phase(critic, False); frozen = _critic_state(critic)
                with api.observe_generator_gradients(observed):
                    total, candidate, facts = api._generator_candidate(model, critic, bound, order, prediction,
                **({"support_structure_weight": weight} if weight == 1.0 else {}))
                require(tuple(labels) == COMPONENTS_IN_ORDER and calls["generatorForwards"] == 1
                    and calls["generatorAutograd"] == 5, "one-forward/five-VJP observation differs")
                inherited.v24._require_critic_phase(critic, training=False, trainable=False)
                require(_critic_state(critic) == frozen, "probe G changed frozen critic")
                norms = []
                for index, key, size in ((season, "appearance_regime", 4), (ecology, "ecology_regime", 7)):
                    value = raw[0][index]; active = int(sample[key].argmax())
                    require(value is not None, key + " gradient missing")
                    row = [float(value[:, i].norm()) for i in range(size)]
                    require(row[active] > 0 and all(row[i] == 0 for i in range(size) if i != active), key + " slice unreachable")
                    require(candidate[index] is value, key + " actual gradient identity changed")
                    norms.append(row)
                for key, indexes in groups.items():
                    if bool(bound["conditions"][list(order).index(key)].count_nonzero()):
                        require(any(raw[3][i] is not None and bool(raw[3][i].count_nonzero()) for i in indexes)
                            and facts["generatorGradientFacts"]["headCandidateL2"][key] > 0, "applicable head unreachable: " + key)
                result = {"passed": True, "capabilityVersion": api.CAPABILITY, "modelCapabilityVersion": api.MODEL_CAPABILITY,
                    "optimizerCreated": False, "optimizerUpdates": 0, "loss": float(total.detach()),
                    "discriminatorLoss": float(d_loss.detach()), "fiveGradientFacts": facts,
                    "seasonalSliceL2": norms[0], "ecologySliceL2": norms[1], "objectCount": evidence["objectCount"],
                    "callCounts": dict(calls), "cudaRngChecked": device.type == "cuda",
                    "gpuQualificationGranted": False, "trainingGranted": False}
                resource()
            except BaseException as error:
                primary = error; raise
            finally:
                try: handle.remove()
                except BaseException as secondary:
                    if primary is None: raise
                    primary.secondary_hook_cleanup_error = str(secondary)
        return result
    except BaseException as error:
        _failure_summary(error, failure_evidence, raw, calls, labels)
        raise

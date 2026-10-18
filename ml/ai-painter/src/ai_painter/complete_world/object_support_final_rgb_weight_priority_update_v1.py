"""Independent five-VJP CPU bridge; original gate runs on an explicit parent carrier."""
from contextlib import contextmanager
from contextvars import ContextVar
import torch
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as identity
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as parent
from ai_painter.complete_world import object_support_structure_priority_update_cpu_v1 as frozen
from ai_painter.complete_world.object_head_core_priority_update_v24 import _autocast_enabled
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    _validate_model_and_parameters, _validate_gradient_set, _flatten,
)

MODEL_CAPABILITY = identity.CAPABILITY
CANDIDATE_ID = "stage4_mvp256_dry_object_support_final_rgb_weight_precision_cpu_v1"
EXECUTION_QUALIFIED = False
COMPONENTS_IN_ORDER = frozen.COMPONENTS_IN_ORDER
require = frozen.require
_OBSERVER = ContextVar("final_rgb_base_weight_cpu_gradient_observer", default=None)


@contextmanager
def observe_generator_gradients(observer):
    token = _OBSERVER.set(observer)
    try:
        yield
    finally:
        _OBSERVER.reset(token)


def bind_parameters(model):
    identity.validate_model_identity(model)
    require(torch.get_num_threads() <= 2 and not _autocast_enabled(torch), "CPU<=2/no-autocast required")
    parameters, groups = _validate_model_and_parameters(model, tuple(model.parameters()))
    require(all(p.requires_grad for p in parameters) and all(v.device.type == "cpu" for v in model.buffers()),
            "complete trainable CPU model required")
    owned = [i for rows in groups.values() for i in rows]
    require(len(owned) == len(set(owned)) == 16 and sum(parameters[i].numel() for i in owned) == 4876
        and all(len(rows) == 4 and sum(parameters[i].numel() for i in rows) == 1219 for rows in groups.values()),
        "four actual head groups differ")
    by_id = {id(p): i for i, p in enumerate(parameters)}
    season, ecology = by_id[id(identity.seasonal_parameter(model))], by_id[id(identity.ecological_parameter(model))]
    require(season != ecology and season not in owned and ecology not in owned, "season/ecology/head aliases")
    return parameters, groups, season, ecology


def _bytes_equal(left, right):
    return left.shape == right.shape and left.dtype == right.dtype and torch.equal(
        left.detach().reshape(-1).view(torch.uint8), right.detach().reshape(-1).view(torch.uint8))


def _check_carrier(model, carrier):
    identity.validate_model_identity(model)
    parent.validate_model_identity(carrier)
    source, target = tuple(model.named_parameters(remove_duplicate=False)), tuple(carrier.named_parameters(remove_duplicate=False))
    require(len(source) == len(target) == 108 and all(name == other and _bytes_equal(value, original)
        and value is not original and value.untyped_storage().data_ptr() != original.untyped_storage().data_ptr()
        for (name, value), (other, original) in zip(source, target)), "explicit parent carrier name/shape/byte/isolation differs")
    require(model.capability_version != carrier.capability_version and not carrier.execution_qualified,
            "carrier must retain parent identity without qualification")


def _cpu_carrier(model):
    bind_parameters(model)
    carrier = parent.build_fresh_object_ecology_terrain_detail_weight_precision(
        condition_channel_order=model.condition_channel_order)
    # Only parameter bytes cross this arithmetic boundary. The original parent
    # identity buffers are retained and validated, never replaced by new IDs.
    state = {name: value.detach().clone() for name, value in carrier.state_dict().items()}
    for name, value in model.named_parameters():
        require(name in state and value.device.type == "cpu", "carrier parameter path/device differs")
        state[name] = value.detach().clone()
    carrier.load_state_dict(state, strict=True, assign=False)
    _check_carrier(model, carrier)
    frozen.bind_parameters(carrier)
    return carrier


def apply_object_support_final_rgb_weight_priority_update_cpu(*, model, parameters, total_gradients,
        structured_gradients, whole_frame_gradients, core_gradients, support_gradients):
    """Arithmetic only: supplied gradients do not establish their provenance."""
    canonical, groups, season, ecology = bind_parameters(model)
    checked, checked_groups = _validate_model_and_parameters(model, parameters)
    require(all(a is b for a, b in zip(checked, canonical)) and groups == checked_groups, "canonical parameter order required")
    observed = (total_gradients, structured_gradients, whole_frame_gradients, core_gradients, support_gradients)
    actual, _ = _validate_gradient_set("actualTotal", observed[0], canonical)
    carrier = _cpu_carrier(model)
    candidate, reference = frozen.apply_object_support_structure_priority_update_cpu(model=carrier,
        parameters=tuple(carrier.parameters()), total_gradients=observed[0], structured_gradients=observed[1],
        whole_frame_gradients=observed[2], core_gradients=observed[3], support_gradients=observed[4])
    _check_carrier(model, carrier)
    # Preserve original actual-total tensor identity outside the projected heads,
    # including normalized zeros for unused parameters.
    result = list(actual)
    for key, indexes in groups.items():
        if reference["headDiagnostics"][key]["branch"] == "conflict_projected":
            for index in indexes:
                result[index] = candidate[index]
        else:
            require(all(_bytes_equal(candidate[i], actual[i]) for i in indexes), "nonconflict bytes changed")
    owned = {i for rows in groups.values() for i in rows}
    require(all(result[i] is actual[i] for i in range(108) if i not in owned)
        and result[season] is actual[season] and result[ecology] is actual[ecology], "nonhead actual total identity changed")
    facts = {**reference, "candidateId": CANDIDATE_ID, "modelCapabilityVersion": MODEL_CAPABILITY,
        "arithmeticCarrierCapabilityVersion": parent.CAPABILITY,
        "arithmeticCarrierRole": "original_parent_identity_pure_gate_and_projection_only",
        "carrierAllParameterNamesShapesBytesVerified": True, "carrierQualificationInherited": False,
        "originalGateAndProjectionUnchanged": True, "actualTotalProvenanceVerified": False}
    return tuple(result), facts


def compute_generator_candidate_gradients(*, model, critic, sample, actual_total, structured_objective,
        whole_frame_fidelity, object_core_rgb, object_support_structure):
    parameters, groups, season, ecology = bind_parameters(model)
    require(isinstance(sample, dict) and sample.get("split") == "train", "train-only generator gradients")
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.device.type == "cpu"
            and value.dtype == torch.float32 and not value.requires_grad and value.layout == torch.strided
            and bool(torch.isfinite(value).all()) and bool(((value >= 0) & (value <= 1)).all()),
            "detached finite CPU FP32 train tensors required: " + key)
    require(isinstance(critic, torch.nn.Module) and all(not m.training for m in critic.modules())
        and all(not p.requires_grad for p in critic.parameters()) and all(v.device.type == "cpu"
            and (not v.is_floating_point() or v.dtype == torch.float32) and bool(torch.isfinite(v).all())
            for v in (*critic.parameters(), *critic.buffers())), "finite frozen eval CPU FP32 critic required")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb, object_support_structure)
    require(all(isinstance(v, torch.Tensor) and v.shape == torch.Size([]) and v.device.type == "cpu"
        and v.dtype == torch.float32 and v.requires_grad and bool(torch.isfinite(v.detach())) for v in losses),
        "five differentiable CPU FP32 scalar objectives required")
    expected = (((structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb).float() + object_support_structure)
    require(torch.equal(actual_total.detach(), expected.detach()), "exact ordered four-term scalar formula differs")
    raw = []
    try:
        observer = _OBSERVER.get()
        for i, (label, loss) in enumerate(zip(COMPONENTS_IN_ORDER, losses)):
            if observer is not None:
                observer("attempt", label, None)
            rows = torch.autograd.grad(loss, parameters, retain_graph=i < 4, create_graph=False, allow_unused=True)
            raw.append(rows)
            if observer is not None:
                observer("complete", label, rows)
        candidate, facts = apply_object_support_final_rgb_weight_priority_update_cpu(model=model, parameters=parameters,
            total_gradients=raw[0], structured_gradients=raw[1], whole_frame_gradients=raw[2],
            core_gradients=raw[3], support_gradients=raw[4])
        facts.update(actualTotalProvenanceVerified=True, actualTotalIndependentFullModelGradient=True,
            autogradGradCalls=5, independentFullParameterGradientTensorCounts=[len(rows) for rows in raw],
            scalarValues={label: float(loss.detach()) for label, loss in zip(COMPONENTS_IN_ORDER, losses)},
            generatorGradientFacts={"tensorCount": len(candidate), "allFinite": True,
                "nonzeroTensorCount": sum(bool(v.count_nonzero()) for v in candidate),
                "headCandidateL2": {key: float(_flatten(candidate, indexes).norm()) for key, indexes in groups.items()}})
        return candidate, facts
    except BaseException as error:
        try:
            error.object_support_gradient_evidence = {"gradientSetsAvailable": len(raw), "componentsInOrder": list(COMPONENTS_IN_ORDER),
                "rawGradients": raw, "parameterNames": [name for name, _ in model.named_parameters()]}
        except BaseException as secondary:
            try:
                error.secondary_gradient_evidence_error = str(secondary)
            except BaseException:
                pass
        raise

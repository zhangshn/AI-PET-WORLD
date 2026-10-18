"""Final RGB candidate device adapter; old identity carrier is arithmetic only."""
from contextlib import contextmanager
from contextvars import ContextVar
import torch
from ai_painter.complete_world import object_support_structure_priority_update_cpu_v1 as frozen
from ai_painter.complete_world import object_support_final_rgb_weight_priority_update_v1 as cpu_bridge
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as identity
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import OBJECT_HEAD_KEYS
from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import (
    CAPABILITY as PARENT_MODEL_CAPABILITY, build_fresh_object_ecology_terrain_detail_weight_precision)
from ai_painter.complete_world.object_head_core_priority_update_v24 import _autocast_enabled, generator_full_fp32_backend
CAPABILITY = "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1"
MODEL_CAPABILITY = identity.CAPABILITY

CANDIDATE_ID = CAPABILITY
EXECUTION_QUALIFIED = False
COMPONENTS_IN_ORDER = frozen.COMPONENTS_IN_ORDER
require = frozen.require
_OBSERVER = ContextVar("object_support_device_gradient_observer", default=None)


@contextmanager
def observe_generator_gradients(observer):
    token = _OBSERVER.set(observer)
    try: yield
    finally: _OBSERVER.reset(token)


def bind_parameters(model):
    require(isinstance(model, torch.nn.Module), "exact model required")
    parameters = tuple(model.parameters())
    require(parameters and parameters[0].device.type in ("cpu", "cuda"), "CPU/CUDA model required")
    if parameters[0].device.type == "cpu": return cpu_bridge.bind_parameters(model)
    device = parameters[0].device
    require(torch.get_num_threads() <= 2 and not _autocast_enabled(torch), "CPU<=2/no autocast required")
    require(all(p.device == device and p.dtype == torch.float32 for p in parameters)
        and all(v.device == device for v in model.buffers()), "complete single-device FP32 model required")
    require(torch.backends.cuda.matmul.fp32_precision == "ieee" and torch.backends.cudnn.conv.fp32_precision == "ieee",
        "generator IEEE FP32 required")
    identity.validate_model_identity(model)
    named = tuple(model.named_parameters(remove_duplicate=False))
    require(len(named) == len(parameters) == 108 and all(p.requires_grad for p in parameters), "complete trainable generator required")
    by_id = {id(p): i for i,p in enumerate(parameters)}
    require(set(model.object_rgb_heads) == set(OBJECT_HEAD_KEYS), "four actual heads required")
    groups = {key: tuple(by_id[id(p)] for p in model.object_rgb_heads[key].parameters()) for key in OBJECT_HEAD_KEYS}
    owned = [i for indexes in groups.values() for i in indexes]
    require(len(owned) == len(set(owned)) == 16 and sum(parameters[i].numel() for i in owned) == 4876
        and all(len(rows) == 4 and sum(parameters[i].numel() for i in rows) == 1219 for rows in groups.values()), "head groups differ")
    season, ecology = by_id[id(identity.seasonal_parameter(model))], by_id[id(identity.ecological_parameter(model))]
    require(season != ecology and season not in owned and ecology not in owned, "season/ecology/head aliases")
    return parameters, groups, season, ecology


def _verify_carrier(model, carrier):
    identity.validate_model_identity(model)
    frozen.bind_parameters(carrier)
    actual, copied = tuple(model.named_parameters()), tuple(carrier.named_parameters())
    require(len(actual) == len(copied) == 108 and carrier.capability_version == PARENT_MODEL_CAPABILITY,
        "genuine original parent arithmetic carrier required")
    for (name,value),(other,target) in zip(actual,copied):
        require(name == other and value.shape == target.shape and value.dtype == target.dtype
            and value is not target and value.untyped_storage()._cdata != target.untyped_storage()._cdata
            and torch.equal(value.detach().cpu().contiguous().reshape(-1).view(torch.uint8),
                            target.detach().reshape(-1).view(torch.uint8)), "carrier full parameter name/shape/byte/isolation differs")
    require(not carrier.execution_qualified, "carrier qualification prohibited")


def _cpu_carrier(model):
    identity.validate_model_identity(model)
    carrier = build_fresh_object_ecology_terrain_detail_weight_precision(condition_channel_order=model.condition_channel_order)
    state = {name:value.detach().clone() for name,value in carrier.state_dict().items()}
    for name,value in model.named_parameters():
        require(name in state and state[name].shape == value.shape, "carrier parameter graph differs")
        state[name] = value.detach().cpu().clone()
    carrier.load_state_dict(state, strict=True)
    _verify_carrier(model, carrier)
    return carrier

def _validated(rows, parameters, label):
    require(len(rows) == len(parameters), label + " complete gradients required")
    values, used = [], set()
    for value, parameter in zip(rows, parameters):
        if value is None:
            values.append(torch.zeros_like(parameter)); continue
        require(isinstance(value, torch.Tensor) and id(value) not in used and value.shape == parameter.shape
            and value.device == parameter.device and value.dtype == torch.float32 and bool(torch.isfinite(value).all()),
            label + " gradient metadata/finite/alias differs")
        used.add(id(value)); values.append(value)
    return tuple(values)


def compute_generator_candidate_gradients(*, model, critic, sample, actual_total, structured_objective,
        whole_frame_fidelity, object_core_rgb, object_support_structure):
    parameters, groups, season, ecology = bind_parameters(model)
    device = parameters[0].device
    fields = dict(model=model, critic=critic, sample=sample, actual_total=actual_total,
        structured_objective=structured_objective, whole_frame_fidelity=whole_frame_fidelity,
        object_core_rgb=object_core_rgb, object_support_structure=object_support_structure)
    if device.type == "cpu":
        with cpu_bridge.observe_generator_gradients(_OBSERVER.get()):
            result, facts = cpu_bridge.compute_generator_candidate_gradients(**fields)
        facts.update(candidateId=CAPABILITY)
        return result, facts
    require(sample.get("split") == "train", "train-only generator gradients")
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and value.shape == shape and value.device == device
            and value.dtype == torch.float32 and not value.requires_grad and bool(torch.isfinite(value).all())
            and bool(((value >= 0) & (value <= 1)).all()), "detached device FP32 train tensors required")
    require(isinstance(critic, torch.nn.Module) and all(not m.training for m in critic.modules())
        and all(not p.requires_grad for p in critic.parameters()) and all(v.device == device
            and (not v.is_floating_point() or v.dtype == torch.float32) and bool(torch.isfinite(v).all())
            for v in (*critic.parameters(), *critic.buffers())), "finite frozen eval device critic required")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb, object_support_structure)
    require(all(isinstance(v, torch.Tensor) and v.shape == torch.Size([]) and v.device == device
        and v.dtype == torch.float32 and v.requires_grad and bool(torch.isfinite(v.detach())) for v in losses),
        "five differentiable device FP32 scalar objectives required")
    expected = (((structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb).float() + object_support_structure)
    require(torch.equal(actual_total.detach(), expected.detach()), "exact ordered four-term scalar formula differs")
    raw = []
    try:
        observer = _OBSERVER.get()
        for i, (label, loss) in enumerate(zip(COMPONENTS_IN_ORDER, losses)):
            if observer is not None: observer("attempt", label, None)
            rows = torch.autograd.grad(loss, parameters, retain_graph=i < 4, create_graph=False, allow_unused=True)
            raw.append(rows)
            if observer is not None: observer("complete", label, rows)
        actual = _validated(raw[0], parameters, "actualTotal")
        for label, rows in zip(COMPONENTS_IN_ORDER[1:], raw[1:]): _validated(rows, parameters, label)
        carrier = _cpu_carrier(model)
        copied = [tuple(None if v is None else v.detach().cpu().clone() for v in rows) for rows in raw]
        cpu_candidate, facts = frozen.apply_object_support_structure_priority_update_cpu(model=carrier,
            parameters=tuple(carrier.parameters()), total_gradients=copied[0], structured_gradients=copied[1],
            whole_frame_gradients=copied[2], core_gradients=copied[3], support_gradients=copied[4])
        _verify_carrier(model, carrier)
        candidate = list(actual)
        for key, indexes in groups.items():
            for index in indexes:
                if facts["headDiagnostics"][key]["branch"] == "conflict_projected":
                    candidate[index] = cpu_candidate[index].to(device=device)
                else:
                    cpu_actual = torch.zeros_like(cpu_candidate[index]) if copied[0][index] is None else copied[0][index]
                    require(torch.equal(cpu_candidate[index].reshape(-1).view(torch.uint8), cpu_actual.reshape(-1).view(torch.uint8)),
                        "nonconflict actual head bytes changed")
        owned = {i for indexes in groups.values() for i in indexes}
        require(all(candidate[i] is actual[i] for i in range(108) if i not in owned)
            and candidate[season] is actual[season] and candidate[ecology] is actual[ecology], "non-head actual identity changed")
        facts.update(candidateId=CAPABILITY, modelCapabilityVersion=MODEL_CAPABILITY,
            arithmeticCarrierCapabilityVersion=PARENT_MODEL_CAPABILITY, carrierAllParameterNamesShapesBytesVerified=True,
            carrierQualificationInherited=False, originalGateAndProjectionUnchanged=True,
            actualTotalProvenanceVerified=True, autogradGradCalls=5,
            scalarValues={label: float(loss.detach()) for label, loss in zip(COMPONENTS_IN_ORDER, losses)},
            independentFullParameterGradientTensorCounts=[108]*5, actualTotalIndependentFullModelGradient=True,
            cpuReferenceExact=True, cpuCopiedParameterTensorCount=108, cpuCopiedParameterElementCount=2242687,
            generatorGradientFacts={"tensorCount": 108, "allFinite": True,
                "nonzeroTensorCount": sum(bool(v.count_nonzero()) for v in candidate),
                "headCandidateL2": {key: float(torch.cat([candidate[i].reshape(-1) for i in indexes]).norm()) for key, indexes in groups.items()}})
        return tuple(candidate), facts
    except BaseException as error:
        try:
            error.object_support_gradient_evidence = {"gradientSetsAvailable": len(raw), "rawGradients": raw,
                "componentsInOrder": list(COMPONENTS_IN_ORDER), "parameterNames": [name for name, _ in model.named_parameters()]}
        except BaseException: pass
        raise

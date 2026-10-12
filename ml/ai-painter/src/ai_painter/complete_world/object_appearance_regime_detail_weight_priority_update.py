"""Explicit new identity bridge; four independent gradients and the unchanged CPU gate."""
from __future__ import annotations
from contextlib import contextmanager
from contextvars import ContextVar
import torch
from torch import nn
from ai_painter.complete_world.object_appearance_regime_input_cpu import require
from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import validate_model_identity, seasonal_parameter, CAPABILITY
from ai_painter.complete_world.object_head_core_priority_update_v24 import _normalize, _autocast_enabled, generator_full_fp32_backend
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    OBJECT_HEAD_KEYS, apply_object_head_core_priority_update_v24_cpu)

_OBSERVER = ContextVar("appearance_regime_gradient_observer", default=None)


@contextmanager
def observe_generator_gradients(observer):
    """Bounded evidence hook; never changes the differentiations or their results."""
    token = _OBSERVER.set(observer)
    try:
        yield
    finally:
        _OBSERVER.reset(token)


def bind_parameters(model):
    validate_model_identity(model)
    parameters = tuple(model.parameters())
    named = tuple(model.named_parameters(remove_duplicate=False))
    require(len(named) == len(parameters) == 107 and len({id(p) for _, p in named}) == 107
        and len({p.untyped_storage().data_ptr() for p in parameters}) == 107
        and all(p.requires_grad and bool(torch.isfinite(p.detach()).all()) for p in parameters), "complete generator graph/finite/alias differs")
    heads = model.object_rgb_heads
    require(set(heads.keys()) == set(OBJECT_HEAD_KEYS), "four actual heads required")
    by_id = {id(p): i for i, p in enumerate(parameters)}
    groups = {key: tuple(by_id[id(p)] for p in heads[key].parameters()) for key in OBJECT_HEAD_KEYS}
    owned = [i for rows in groups.values() for i in rows]
    require(len(owned) == len(set(owned)) == 16 and sum(parameters[i].numel() for i in owned) == 4876
        and all(len(rows) == 4 and sum(parameters[i].numel() for i in rows) == 1219 for rows in groups.values()), "four head graph differs")
    seasonal = seasonal_parameter(model)
    index = next(i for i, p in enumerate(parameters) if p is seasonal)
    require(index not in owned, "seasonal parameter cannot be a projected head")
    return parameters, groups, index


from ai_painter.complete_world.object_appearance_regime_priority_update import _cpu_carrier


def compute_generator_candidate_gradients(*, model, critic, sample, actual_total,
        structured_objective, whole_frame_fidelity, object_core_rgb):
    require(sample.get("split") == "train", "non-train generator gradients prohibited")
    require(all(isinstance(sample.get(k), torch.Tensor) and not sample[k].requires_grad
        for k in ("image", "conditions")), "source tensors must be detached")
    require(all(not m.training for m in critic.modules()) and all(not p.requires_grad for p in critic.parameters()), "critic must be frozen eval")
    require(not _autocast_enabled(torch), "generator autocast prohibited")
    parameters, groups, seasonal_index = bind_parameters(model)
    device = parameters[0].device
    if device.type == "cuda":
        require(torch.backends.cuda.matmul.fp32_precision == "ieee" and torch.backends.cudnn.conv.fp32_precision == "ieee", "generator IEEE FP32 required")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb)
    require(all(isinstance(v, torch.Tensor) and v.numel() == 1 and v.device == device
        and v.dtype == torch.float32 and bool(torch.isfinite(v.detach())) for v in losses), "finite native FP32 scalar objectives required")
    require(torch.equal(actual_total.detach(), ((structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb).detach()), "fixed total scalar formula differs")
    labels = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb")
    observed = []; normalized = []; unused = {}
    observer = _OBSERVER.get()
    try:
        for i, (label, loss) in enumerate(zip(labels, losses)):
            if observer is not None: observer("attempt", label, None)
            raw = torch.autograd.grad(loss, parameters, retain_graph=i < 3, create_graph=False, allow_unused=True)
            observed.append(raw)
            if observer is not None: observer("complete", label, raw)
        for label, raw in zip(labels, observed):
            values, indexes = _normalize(raw, parameters, label)
            normalized.append(values); unused[label] = list(indexes)
        actual, structured, whole, core = normalized
        carrier = _cpu_carrier(model)
        cpu_gradients = [tuple(v.cpu().clone() for v in rows) for rows in normalized]
        cpu_candidate, reference = apply_object_head_core_priority_update_v24_cpu(
            model=carrier, parameters=tuple(carrier.parameters()), total_gradients=cpu_gradients[0],
            structured_gradients=cpu_gradients[1], whole_frame_gradients=cpu_gradients[2], core_gradients=cpu_gradients[3])
        candidate = list(actual)
        for key, indexes in groups.items():
            for index in indexes:
                if reference["headDiagnostics"][key]["branch"] == "conflict_projected":
                    candidate[index] = cpu_candidate[index].to(device=device, dtype=torch.float32)
                else:
                    require(torch.equal(cpu_candidate[index].reshape(-1).view(torch.uint8), cpu_gradients[0][index].reshape(-1).view(torch.uint8)), "nonconflict head bytes changed")
        owned = {i for indexes in groups.values() for i in indexes}
        require(all(candidate[i] is actual[i] for i in range(107) if i not in owned), "non-head identity changed")
        require(candidate[seasonal_index] is actual[seasonal_index], "seasonal actual gradient identity changed")
        facts = {"candidateId": CAPABILITY, "autogradGradCalls": 4, "independentFullParameterGradientTensorCounts": [107] * 4,
            "cpuCopiedParameterTensorCount": 107, "cpuCopiedParameterElementCount": 2240671,
            "fullModelAuxiliaryGradientsCopiedToCpu": True, "actualTotalIndependentFullModelGradient": True,
            "cpuReferenceExact": True, "headDiagnostics": reference["headDiagnostics"],
            "nonHeadActualTotalIdentityPreserved": True, "nonConflictHeadActualTotalBytesPreserved": True,
            "seasonalParameterIndex": seasonal_index, "unusedGradientIndexes": unused,
            "parameterIdentity": {"modelParameterTensorCount": 107, "modelParameterElementCount": 2240671,
                "objectHeadParameterTensorCount": 16, "objectHeadParameterElementCount": 4876},
            "generatorGradientFacts": {"tensorCount": 107, "allFinite": True,
                "nonzeroTensorCount": sum(bool(v.count_nonzero()) for v in candidate),
                "nonzeroElementCount": sum(int(v.count_nonzero()) for v in candidate),
                "headCandidateL2": {key: float(torch.cat([candidate[i].reshape(-1) for i in indexes]).norm()) for key, indexes in groups.items()}}}
        return tuple(candidate), facts
    except BaseException as error:
        # Preserve the primary exception even if diagnostic attachment fails.
        try:
            error.appearance_regime_gradient_evidence = {"gradientSetsAvailable": len(observed), "rawGradients": observed,
                "parameterNames": [name for name, _ in model.named_parameters()], "parameterTensorCount": 107}
        except BaseException:
            pass
        raise

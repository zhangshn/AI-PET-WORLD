"""Five disjoint real V27 groups using the fixed V24 projection mathematics.

Auxiliary differentiations now cover shared hidden plus four adapters (10
tensors), instead of four independent heads (16). Shared core gradients come
from the complete aggregated core scalar. Cross-class coupling is new.
"""
from __future__ import annotations
import math
import torch
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import ROLES
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    _require, _named_parameters_with_duplicates, _validate_gradient_set, _flatten,
    TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL, PROJECTION_ROUNDOFF_MULTIPLIER,
)

GROUPS = ("shared_hidden", *ROLES)
CANDIDATE_ID = "stage4_mvp_v27_shared_hidden_core_priority_cpu_v1"


def bind_parameter_groups(model, parameters=None):
    _require(isinstance(model, torch.nn.Module), "real model required")
    canonical = tuple(model.parameters())
    parameters = canonical if parameters is None else tuple(parameters)
    _require(len(canonical) == len(parameters) and all(a is b for a, b in
             zip(canonical, parameters)), "complete canonical parameter sequence required")
    named = _named_parameters_with_duplicates(model)
    _require(len(named) == len(parameters) and len({id(p) for _, p in named}) == len(named),
             "parameter registration alias prohibited")
    _require(len({p.untyped_storage().data_ptr() for p in parameters}) == len(parameters),
             "parameter storage alias prohibited")
    _require(all(p.device.type == "cpu" and p.dtype == torch.float32
                 and bool(torch.isfinite(p).all()) for p in parameters), "finite CPU FP32 required")
    shared = getattr(model, "object_shared_hidden", None)
    adapters = getattr(model, "object_rgb_adapters", None)
    _require(isinstance(shared, torch.nn.Module) and isinstance(adapters, torch.nn.ModuleDict)
             and tuple(adapters) == ROLES, "real shared hidden and four adapters required")
    index = {id(p): i for i, p in enumerate(parameters)}
    groups, owned = {}, set()
    for key, module in ((GROUPS[0], shared), *((r, adapters[r]) for r in ROLES)):
        members = tuple(module.parameters())
        _require(members, "empty group: " + key)
        ids = [id(p) for p in members]
        _require(len(set(ids)) == len(ids) and all(i in index and i not in owned for i in ids),
                 "group identity overlap or missing parameter")
        owned.update(ids)
        groups[key] = tuple(index[i] for i in ids)
    _require(owned == {id(p) for name, p in named if name.startswith(
        ("object_shared_hidden.", "object_rgb_adapters."))}, "object group coverage differs")
    return parameters, groups


def apply_shared_hidden_priority_v27_cpu(*, model, parameters, core_gradients,
        whole_frame_gradients, structured_gradients, total_gradients):
    parameters, groups = bind_parameter_groups(model, parameters)
    core, _ = _validate_gradient_set("core", core_gradients, parameters)
    whole, _ = _validate_gradient_set("whole", whole_frame_gradients, parameters)
    structured, _ = _validate_gradient_set("structured", structured_gradients, parameters)
    total, _ = _validate_gradient_set("independentTotal", total_gradients, parameters)
    candidate = list(total)  # preserve non-group actual tensor identity
    diagnostics = {}
    for key, indexes in groups.items():
        for i in indexes:
            expected = (structured[i].float() + whole[i].float()).float() + core[i].float()
            _require(bool(torch.isclose(total[i], expected, atol=TOTAL_GRADIENT_ATOL,
                         rtol=TOTAL_GRADIENT_RTOL).all()), "actual total gradient identity differs")
        c = _flatten(core, indexes).double()
        other = (_flatten(whole, indexes) + _flatten(structured, indexes)).double()
        raw = _flatten(total, indexes)
        q, d = float(torch.dot(c, c)), float(torch.dot(c, other))
        _require(math.isfinite(q) and math.isfinite(d), "nonfinite projection reduction")
        coefficient = residual = bound = None
        branch = "core_zero_preserve_actual_total" if q == 0 else "non_conflict_preserve_actual_total"
        if q != 0 and d < 0:
            branch = "conflict_projected"
            coefficient = d / q
            projected64 = other - coefficient * c
            projected32 = projected64.float()
            residual = abs(float(torch.dot(c, projected32.double())))
            bound = (PROJECTION_ROUNDOFF_MULTIPLIER * torch.finfo(torch.float32).eps
                     * float(torch.linalg.vector_norm(c))
                     * float(torch.linalg.vector_norm(projected64)))
            _require(bool(torch.isfinite(projected32).all()) and residual <= bound,
                     "projection roundoff exceeds fixed V24 bound")
            updated = (raw.double() - coefficient * c).float()
            _require(bool(torch.isfinite(updated).all()), "candidate FP32 overflow")
            offset = 0
            for i in indexes:
                count = parameters[i].numel()
                candidate[i] = updated[offset:offset+count].reshape_as(parameters[i])
                offset += count
            _require(offset == updated.numel(), "candidate split differs")
        after = _flatten(candidate, indexes)
        diagnostics[key] = {"branch": branch, "qCoreSquaredL2": q, "dCoreDotOther": d,
            "coefficient": coefficient, "projectionResidualDot": residual,
            "projectionRoundoffBound": bound, "parameterTensorCount": len(indexes),
            "parameterElementCount": sum(parameters[i].numel() for i in indexes),
            "coreL2": float(torch.linalg.vector_norm(c)),
            "candidateL2": float(torch.linalg.vector_norm(after)),
            "changedByteCount": int(torch.count_nonzero(after.view(torch.uint8) != raw.view(torch.uint8)))}
    owned = {i for indexes in groups.values() for i in indexes}
    _require(all(candidate[i] is total[i] for i in range(len(parameters)) if i not in owned),
             "non-group total identity changed")
    return tuple(candidate), {"candidateId": CANDIDATE_ID, "groupDiagnostics": diagnostics,
        "parameterTensorCount": len(parameters), "parameterElementCount": sum(p.numel() for p in parameters),
        "objectParameterTensorCount": len(owned), "nonGroupActualTotalIdentityPreserved": True,
        "crossClassCouplingChanged": True, "optimizerCreated": False, "parametersUpdated": False}


def compute_shared_hidden_priority_gradients_v27_cpu(*, model, critic, sample,
        actual_total, structured_objective, whole_frame_fidelity, object_core_rgb,
        counter=None, resource_check=lambda: None):
    _require(sample.get("split") == "train", "train-only differentiation required")
    _require(all(isinstance(sample.get(k), torch.Tensor) and not sample[k].requires_grad
                 for k in ("image", "conditions")), "detached source required")
    _require(all(not m.training for m in critic.modules()) and all(not p.requires_grad
                 for p in critic.parameters()), "frozen eval critic required")
    _require(not torch.is_autocast_enabled("cpu"), "autocast prohibited")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb)
    _require(all(isinstance(v, torch.Tensor) and v.numel() == 1 and v.dtype == torch.float32
                 and bool(torch.isfinite(v)) for v in losses), "finite FP32 scalars required")
    _require(torch.equal(actual_total.detach(), ((structured_objective.float()
             + whole_frame_fidelity).float() + object_core_rgb).detach()), "total scalar identity differs")
    parameters, groups = bind_parameter_groups(model)
    indexes = tuple(i for group in groups.values() for i in group)
    selected = tuple(parameters[i] for i in indexes)
    counter = {} if counter is None else counter
    def grad(loss, params, retain):
        resource_check()
        counter["autogradGradCallsAttempted"] = counter.get("autogradGradCallsAttempted", 0) + 1
        values = torch.autograd.grad(loss, params, retain_graph=retain, allow_unused=True)
        counter["autogradGradCallsCompleted"] = counter.get("autogradGradCallsCompleted", 0) + 1
        return values
    total = grad(actual_total, parameters, True)
    auxiliary = [grad(loss, selected, n < 2) for n, loss in enumerate(
        (object_core_rgb, whole_frame_fidelity, structured_objective))]
    expanded = []
    for values in auxiliary:
        full = [None] * len(parameters)
        for i, value in zip(indexes, values):
            full[i] = value
        expanded.append(tuple(full))
    candidate, facts = apply_shared_hidden_priority_v27_cpu(model=model, parameters=parameters,
        core_gradients=expanded[0], whole_frame_gradients=expanded[1],
        structured_gradients=expanded[2], total_gradients=total)
    facts.update({"autogradGradCalls": 4, "actualTotalIndependentFullModelGradient": True,
                  "auxiliaryParameterTensorCount": len(selected)})
    return candidate, facts

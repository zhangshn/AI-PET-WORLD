"""Inactive CPU five-VJP support successor; no optimizer or execution entry."""
from collections.abc import Mapping
from contextlib import contextmanager
from contextvars import ContextVar
import math
import torch

from ai_painter.complete_world import object_ecology_terrain_detail_weight_priority_update_v1 as parent
from ai_painter.complete_world.object_ecology_terrain_detail_weight_precision_v1 import CAPABILITY as MODEL_CAPABILITY
from ai_painter.complete_world.object_head_core_priority_update_v24 import _autocast_enabled
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    OBJECT_HEAD_KEYS, TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL, PROJECTION_ROUNDOFF_MULTIPLIER,
    _validate_model_and_parameters, _validate_gradient_set, _flatten, _relation,
)

CANDIDATE_ID = "stage4_mvp256_dry_object_support_structure_integration_cpu_v1"
EXECUTION_QUALIFIED = False
COMPONENTS_IN_ORDER = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
_OBSERVER = ContextVar("object_support_structure_cpu_gradient_observer", default=None)


def require(ok, message):
    if not ok: raise ValueError(message)


@contextmanager
def observe_generator_gradients(observer):
    token = _OBSERVER.set(observer)
    try: yield
    finally: _OBSERVER.reset(token)


def bind_parameters(model):
    require(torch.get_num_threads() <= 2 and not _autocast_enabled(torch), "CPU<=2/no-autocast required")
    require(isinstance(model, torch.nn.Module) and all(p.device.type == "cpu" and p.dtype == torch.float32
        for p in model.parameters()) and all(v.device.type == "cpu" for v in model.buffers()), "CPU FP32 model required")
    parameters, groups, season, ecology = parent.bind_parameters(model)
    canonical, checked_groups = _validate_model_and_parameters(model, parameters)
    require(groups == checked_groups and len(canonical) == 108 and sum(p.numel() for p in canonical) == 2242687,
        "exact complete CPU108 parameter graph differs")
    require(all(v.device.type == "cpu" for v in model.buffers()), "CPU model buffers required")
    return canonical, groups, season, ecology


def _validate_inputs(model, critic, sample):
    require(isinstance(sample, Mapping) and sample.get("split") == "train", "train-only generator gradients")
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.device.type == "cpu"
            and value.dtype == torch.float32 and not value.requires_grad and value.layout == torch.strided
            and bool(torch.isfinite(value).all()) and bool(((value >= 0) & (value <= 1)).all()),
            "detached finite CPU FP32 train tensors required: " + key)
    require(isinstance(critic, torch.nn.Module) and all(not m.training for m in critic.modules())
        and all(not p.requires_grad for p in critic.parameters()), "critic must be frozen eval")
    require(all(v.device.type == "cpu" and (not v.is_floating_point() or v.dtype == torch.float32)
        and bool(torch.isfinite(v).all()) for v in (*critic.parameters(), *critic.buffers())), "finite CPU FP32 critic required")
    return bind_parameters(model)


def apply_object_support_structure_priority_update_cpu(*, model, parameters, total_gradients,
        structured_gradients, whole_frame_gradients, core_gradients, support_gradients):
    """Check the new four-term sum and apply the unchanged core-priority rule.

    This lower-level function checks supplied observations, not their provenance.
    Only compute_generator_candidate_gradients establishes five real VJPs.
    """
    canonical, groups, season, ecology = bind_parameters(model)
    checked, checked_groups = _validate_model_and_parameters(model, parameters)
    require(all(a is b for a, b in zip(checked, canonical)) and checked_groups == groups,
        "complete canonical parameter order required")
    observed = (total_gradients, structured_gradients, whole_frame_gradients, core_gradients, support_gradients)
    normalized, unused = [], {}
    for label, rows in zip(COMPONENTS_IN_ORDER, observed):
        values, missing = _validate_gradient_set(label, rows, canonical)
        normalized.append(values)
        unused[label] = [i for i, value in enumerate(missing) if value]
    actual, structured, whole, core, support = normalized
    for i, (g_actual, g_s, g_w, g_c, g_support) in enumerate(zip(actual, structured, whole, core, support)):
        expected = (((g_s.float() + g_w.float()).float() + g_c.float()).float() + g_support.float())
        require(bool(torch.isclose(g_actual, expected, atol=TOTAL_GRADIENT_ATOL, rtol=TOTAL_GRADIENT_RTOL).all()),
            "actual four-term total gradient identity differs at parameter " + str(i))
    candidate = list(actual)
    diagnostics = {}
    for key, indexes in groups.items():
        core32, whole32, structured32, support32, actual32 = (
            _flatten(rows, indexes) for rows in (core, whole, structured, support, actual))
        other32 = (whole32.float() + structured32.float()).float() + support32.float()
        core64, other64, actual64 = core32.to(torch.float64), other32.to(torch.float64), actual32.to(torch.float64)
        q, d = float(torch.dot(core64, core64)), float(torch.dot(core64, other64))
        require(math.isfinite(q) and math.isfinite(d), key + " FP64 reduction is nonfinite")
        coefficient = residual = bound = None
        if q == 0:
            branch = "core_zero_preserve_actual_total"
        elif d >= 0:
            branch = "non_conflict_preserve_actual_total"
        else:
            branch, coefficient = "conflict_projected", d / q
            projected_other64 = other64 - coefficient * core64
            projected_other32 = projected_other64.to(torch.float32)
            require(bool(torch.isfinite(projected_other32).all()), key + " projected other overflow")
            residual = abs(float(torch.dot(core64, projected_other32.to(torch.float64))))
            bound = (PROJECTION_ROUNDOFF_MULTIPLIER * torch.finfo(torch.float32).eps
                * float(torch.linalg.vector_norm(core64)) * float(torch.linalg.vector_norm(projected_other64)))
            require(residual <= bound, key + " original projection roundoff bound exceeded")
            candidate32 = (actual64 - coefficient * core64).to(torch.float32)
            require(bool(torch.isfinite(candidate32).all()), key + " candidate overflow")
            offset = 0
            for index in indexes:
                n = canonical[index].numel()
                candidate[index] = candidate32[offset:offset+n].reshape_as(canonical[index])
                offset += n
            require(offset == candidate32.numel(), "candidate head split differs")
        candidate32 = _flatten(candidate, indexes)
        if branch != "conflict_projected":
            require(all(candidate[i] is actual[i] for i in indexes)
                and torch.equal(candidate32.view(torch.uint8), actual32.view(torch.uint8)), "nonconflict actual head bytes changed")
        diagnostics[key] = {"branch": branch, "qCoreSquaredL2": q, "dCoreDotOther": d,
            "coefficient": coefficient, "projectionResidualDot": residual, "projectionRoundoffBound": bound,
            "rawCoreVsOther": _relation(core64, other64), "rawCoreVsActualTotal": _relation(core64, actual64),
            "candidateCoreVsTotal": _relation(core64, candidate32.to(torch.float64)),
            "supportL2": float(torch.linalg.vector_norm(support32.to(torch.float64))),
            "changedByteCount": int(torch.count_nonzero(candidate32.view(torch.uint8) != actual32.view(torch.uint8)))}
    owned = {i for indexes in groups.values() for i in indexes}
    require(all(candidate[i] is actual[i] for i in range(108) if i not in owned), "non-head actual gradient identity changed")
    require(candidate[season] is actual[season] and candidate[ecology] is actual[ecology], "season/ecology actual gradient identity changed")
    require(all(v.shape == p.shape and v.dtype == p.dtype and v.device == p.device and bool(torch.isfinite(v).all())
        for v, p in zip(candidate, canonical)), "candidate gradient metadata/finite differs")
    return tuple(candidate), {"candidateId": CANDIDATE_ID, "modelCapabilityVersion": MODEL_CAPABILITY,
        "componentsInOrder": list(COMPONENTS_IN_ORDER), "headDiagnostics": diagnostics,
        "gradientIdentityAtol": TOTAL_GRADIENT_ATOL, "gradientIdentityRtol": TOTAL_GRADIENT_RTOL,
        "unusedGradientIndexes": unused, "seasonalParameterIndex": season, "ecologyParameterIndex": ecology,
        "parameterIdentity": {"modelParameterTensorCount": 108, "modelParameterElementCount": 2242687,
            "objectHeadParameterTensorCount": 16, "objectHeadParameterElementCount": 4876},
        "nonHeadActualTotalIdentityPreserved": True, "nonConflictHeadActualTotalBytesPreserved": True,
        "actualTotalProvenanceVerified": False, "optimizerCreated": False, "parametersUpdated": False}


def compute_generator_candidate_gradients(*, model, critic, sample, actual_total, structured_objective,
        whole_frame_fidelity, object_core_rgb, object_support_structure):
    parameters, groups, season, ecology = _validate_inputs(model, critic, sample)
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb, object_support_structure)
    require(all(isinstance(v, torch.Tensor) and v.shape == torch.Size([]) and v.device.type == "cpu"
        and v.dtype == torch.float32 and v.requires_grad and bool(torch.isfinite(v.detach())) for v in losses),
        "five finite differentiable CPU FP32 scalar objectives required")
    expected = (((structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb).float() + object_support_structure)
    require(torch.equal(actual_total.detach(), expected.detach()), "exact ordered four-term scalar formula differs")
    raw = []
    observer = _OBSERVER.get()
    try:
        for i, (label, loss) in enumerate(zip(COMPONENTS_IN_ORDER, losses)):
            if observer is not None: observer("attempt", label, None)
            rows = torch.autograd.grad(loss, parameters, retain_graph=i < 4, create_graph=False, allow_unused=True)
            raw.append(rows)
            if observer is not None: observer("complete", label, rows)
        candidate, facts = apply_object_support_structure_priority_update_cpu(model=model, parameters=parameters,
            total_gradients=raw[0], structured_gradients=raw[1], whole_frame_gradients=raw[2],
            core_gradients=raw[3], support_gradients=raw[4])
        facts.update(actualTotalProvenanceVerified=True, actualTotalIndependentFullModelGradient=True,
            autogradGradCalls=len(raw), independentFullParameterGradientTensorCounts=[len(rows) for rows in raw],
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
            try: error.secondary_gradient_evidence_error = str(secondary)
            except BaseException: pass
        raise

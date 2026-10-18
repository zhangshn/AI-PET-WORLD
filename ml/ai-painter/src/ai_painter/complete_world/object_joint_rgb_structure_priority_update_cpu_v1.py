"""Isolated synthetic-CPU candidate for joint object colour/structure priority.

Four existing scalar terms and their weights stay unchanged.  Only four RGB
heads may receive a projected gradient.  Joint-anchor alignment says nothing
about each constituent loss, an AdamW step, visual quality or qualification.
"""
from contextlib import contextmanager
from contextvars import ContextVar
import math

import torch

from ai_painter.complete_world import object_support_final_rgb_weight_priority_update_v1 as bridge
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL, PROJECTION_ROUNDOFF_MULTIPLIER,
    _validate_model_and_parameters, _validate_gradient_set, _flatten, _relation,
)

CANDIDATE_ID = "stage4_mvp256_dry_joint_object_priority_cpu_v1"
MODEL_CAPABILITY = bridge.MODEL_CAPABILITY
EXECUTION_QUALIFIED = False
COMPONENTS_IN_ORDER = bridge.COMPONENTS_IN_ORDER
bind_parameters = bridge.bind_parameters
require = bridge.require
_OBSERVER = ContextVar("joint_object_priority_cpu_gradient_observer", default=None)


@contextmanager
def observe_generator_gradients(observer):
    token = _OBSERVER.set(observer)
    try:
        yield
    finally:
        _OBSERVER.reset(token)


def apply_object_joint_rgb_structure_priority_update_cpu(*, model, parameters, total_gradients,
        structured_gradients, whole_frame_gradients, core_gradients, support_gradients):
    """Validate supplied five sets; this arithmetic API cannot prove provenance.

Support gradients already include the original 0.1 weight.  The original
ordered FP32 four-term gate is evaluated before forming the joint anchor.
No previous projection, model carrier, optimizer or parameter write is used.
"""
    canonical, groups, season, ecology = bind_parameters(model)
    checked, checked_groups = _validate_model_and_parameters(model, parameters)
    require(all(a is b for a, b in zip(checked, canonical)) and checked_groups == groups,
            "complete canonical parameter order required")
    normalized, unused = [], {}
    observed = (total_gradients, structured_gradients, whole_frame_gradients, core_gradients, support_gradients)
    for label, rows in zip(COMPONENTS_IN_ORDER, observed):
        values, missing = _validate_gradient_set(label, rows, canonical)
        normalized.append(values)
        unused[label] = [i for i, flag in enumerate(missing) if flag]
    actual, structured, whole, core, support = normalized
    for i, (g_actual, g_s, g_w, g_c, g_support) in enumerate(zip(*normalized)):
        expected = (((g_s.float() + g_w.float()).float() + g_c.float()).float() + g_support.float())
        require(bool(torch.isfinite(expected).all()) and bool(torch.isclose(g_actual, expected,
                atol=TOTAL_GRADIENT_ATOL, rtol=TOTAL_GRADIENT_RTOL).all()),
                "actual four-term total gradient identity differs at parameter " + str(i))
    candidate, diagnostics = list(actual), {}
    for key, indexes in groups.items():
        core32, support32, whole32, structured32, actual32 = (
            _flatten(rows, indexes) for rows in (core, support, whole, structured, actual))
        anchor32 = (core32.float() + support32.float()).float()
        other32 = (whole32.float() + structured32.float()).float()
        require(bool(torch.isfinite(anchor32).all()) and bool(torch.isfinite(other32).all()),
                key + " joint anchor/other FP32 sum nonfinite")
        anchor64, other64, actual64 = (v.to(torch.float64) for v in (anchor32, other32, actual32))
        q, d = float(torch.dot(anchor64, anchor64)), float(torch.dot(anchor64, other64))
        require(math.isfinite(q) and math.isfinite(d), key + " FP64 reduction nonfinite")
        coefficient = residual = bound = None
        if q == 0:
            branch = "joint_anchor_zero_preserve_actual_total"
        elif d >= 0:
            branch = "non_conflict_preserve_actual_total"
        else:
            branch, coefficient = "conflict_projected", d / q
            require(math.isfinite(coefficient), key + " projection coefficient nonfinite")
            projected_other64 = other64 - coefficient * anchor64
            projected_other32 = projected_other64.to(torch.float32)
            require(bool(torch.isfinite(projected_other32).all()), key + " projected other overflow")
            residual = abs(float(torch.dot(anchor64, projected_other32.to(torch.float64))))
            bound = (PROJECTION_ROUNDOFF_MULTIPLIER * torch.finfo(torch.float32).eps
                * float(torch.linalg.vector_norm(anchor64)) * float(torch.linalg.vector_norm(projected_other64)))
            require(math.isfinite(residual) and math.isfinite(bound) and residual <= bound,
                    key + " original projection roundoff bound exceeded")
            candidate32 = (actual64 - coefficient * anchor64).to(torch.float32)
            require(bool(torch.isfinite(candidate32).all()), key + " candidate overflow")
            offset = 0
            for index in indexes:
                n = canonical[index].numel()
                candidate[index] = candidate32[offset:offset + n].reshape_as(canonical[index])
                offset += n
            require(offset == candidate32.numel(), "candidate head split differs")
        candidate32 = _flatten(candidate, indexes)
        if branch != "conflict_projected":
            require(all(candidate[i] is actual[i] for i in indexes)
                and torch.equal(candidate32.view(torch.uint8), actual32.view(torch.uint8)),
                "nonconflict actual head bytes changed")
        diagnostics[key] = {"branch": branch, "qJointAnchorSquaredL2": q, "dJointAnchorDotOther": d,
            "coefficient": coefficient, "projectionResidualDot": residual, "projectionRoundoffBound": bound,
            "rawJointAnchorVsOther": _relation(anchor64, other64),
            "rawJointAnchorVsActualTotal": _relation(anchor64, actual64),
            "candidateJointAnchorVsTotal": _relation(anchor64, candidate32.to(torch.float64)),
            "candidateCoreVsTotal": _relation(core32.double(), candidate32.double()),
            "candidateSupportVsTotal": _relation(support32.double(), candidate32.double()),
            "changedByteCount": int(torch.count_nonzero(candidate32.view(torch.uint8) != actual32.view(torch.uint8)))}
    owned = {i for indexes in groups.values() for i in indexes}
    require(all(candidate[i] is actual[i] for i in range(108) if i not in owned)
        and candidate[season] is actual[season] and candidate[ecology] is actual[ecology],
        "non-head/season/ecology actual gradient identity changed")
    require(all(v.shape == p.shape and v.dtype == p.dtype and v.device == p.device
        and bool(torch.isfinite(v).all()) for v, p in zip(candidate, canonical)),
        "candidate gradient metadata/finite differs")
    return tuple(candidate), {"candidateId": CANDIDATE_ID, "modelCapabilityVersion": MODEL_CAPABILITY,
        "componentsInOrder": list(COMPONENTS_IN_ORDER), "headDiagnostics": diagnostics,
        "gradientIdentityAtol": TOTAL_GRADIENT_ATOL, "gradientIdentityRtol": TOTAL_GRADIENT_RTOL,
        "projectionRoundoffMultiplier": PROJECTION_ROUNDOFF_MULTIPLIER,
        "unusedGradientIndexes": unused, "seasonalParameterIndex": season, "ecologyParameterIndex": ecology,
        "parameterIdentity": {"modelParameterTensorCount": 108, "modelParameterElementCount": 2242687,
            "objectHeadParameterTensorCount": 16, "objectHeadParameterElementCount": 4876},
        "nonHeadActualTotalIdentityPreserved": True, "nonConflictHeadActualTotalBytesPreserved": True,
        "actualTotalProvenanceVerified": False, "optimizerCreated": False, "parametersUpdated": False,
        "individualLossDescentGuaranteed": False, "adamwStepImprovementGuaranteed": False,
        "visualQualityGuaranteed": False, "trainingAllowed": False, "stage4Qualified": False}


def _validate_inputs(model, critic, sample):
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
    return parameters, groups, season, ecology


def compute_generator_candidate_gradients(*, model, critic, sample, actual_total, structured_objective,
        whole_frame_fidelity, object_core_rgb, object_support_structure):
    """Differentiate five supplied synthetic scalar graphs independently.

No renderer or critic is called.  Provenance means actual independent VJPs
plus the original scalar and gradient gates, not proof of visual supervision.
"""
    parameters, groups, season, ecology = _validate_inputs(model, critic, sample)
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb, object_support_structure)
    require(all(isinstance(v, torch.Tensor) and v.shape == torch.Size([]) and v.device.type == "cpu"
        and v.dtype == torch.float32 and v.requires_grad and bool(torch.isfinite(v.detach())) for v in losses),
        "five differentiable CPU FP32 scalar objectives required")
    expected = (((structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb).float()
        + object_support_structure)
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
        candidate, facts = apply_object_joint_rgb_structure_priority_update_cpu(model=model, parameters=parameters,
            total_gradients=raw[0], structured_gradients=raw[1], whole_frame_gradients=raw[2],
            core_gradients=raw[3], support_gradients=raw[4])
        facts.update(actualTotalProvenanceVerified=True, actualTotalIndependentFullModelGradient=True,
            autogradGradCalls=len(raw), independentFullParameterGradientTensorCounts=[len(rows) for rows in raw],
            scalarValues={label: float(loss.detach()) for label, loss in zip(COMPONENTS_IN_ORDER, losses)})
        return candidate, facts
    except BaseException as error:
        try:
            error.object_joint_gradient_evidence = {"gradientSetsAvailable": len(raw),
                "componentsInOrder": list(COMPONENTS_IN_ORDER), "rawGradients": raw,
                "parameterNames": [name for name, _ in model.named_parameters()]}
        except BaseException:
            pass
        raise

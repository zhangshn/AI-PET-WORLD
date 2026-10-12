"""Inactive CPU-only V24 object-head core-priority gradient candidate.

This module transforms already-computed CPU gradients.  It does not run a
model, create an optimizer, update parameters, save a checkpoint, or expose a
training/runtime entry point.
"""
from __future__ import annotations

from collections.abc import Sequence
import math


CANDIDATE_ID = "stage4_mvp_v24_object_head_core_priority_update_cpu_candidate_v1"
OBJECT_HEAD_KEYS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
TOTAL_GRADIENT_ATOL = 1e-6
TOTAL_GRADIENT_RTOL = 1e-5
PROJECTION_ROUNDOFF_MULTIPLIER = 16


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _named_parameters_with_duplicates(model):
    try:
        return tuple(model.named_parameters(remove_duplicate=False))
    except TypeError as error:  # pragma: no cover - supported PyTorch is required.
        raise ValueError("PyTorch must expose duplicate-aware named_parameters") from error


def _validate_model_and_parameters(model, parameters):
    import torch

    _require(isinstance(model, torch.nn.Module), "model must be a torch module")
    parameters = tuple(parameters)
    canonical = tuple(model.parameters())
    _require(len(parameters) == len(canonical)
             and all(left is right for left, right in zip(parameters, canonical)),
             "parameters must be the complete model parameter sequence in canonical order")
    _require(len({id(parameter) for parameter in parameters}) == len(parameters),
             "duplicate parameter identity is prohibited")
    storage_identities = [parameter.untyped_storage().data_ptr() for parameter in parameters]
    _require(len(storage_identities) == len(set(storage_identities)),
             "parameter storage aliases are prohibited")

    duplicate_aware = _named_parameters_with_duplicates(model)
    identities = [id(parameter) for _, parameter in duplicate_aware]
    _require(len(identities) == len(set(identities)),
             "model parameter aliases are prohibited")
    _require(len(duplicate_aware) == len(parameters),
             "duplicate-aware parameter graph differs from canonical parameters")

    for parameter in parameters:
        _require(parameter.device.type == "cpu", "parameters must stay on CPU")
        _require(parameter.dtype == torch.float32, "parameters must be CPU float32")
        _require(bool(torch.isfinite(parameter.detach()).all()),
                 "model parameters must be finite")

    heads = getattr(model, "object_rgb_heads", None)
    _require(heads is not None and hasattr(heads, "keys") and hasattr(heads, "__getitem__"),
             "model must expose object_rgb_heads modules")
    _require(set(heads.keys()) == set(OBJECT_HEAD_KEYS),
             "object_rgb_heads must contain exactly the four bound keys")
    parameter_index = {id(parameter): index for index, parameter in enumerate(parameters)}
    head_indices = {}
    owned = set()
    for key in OBJECT_HEAD_KEYS:
        head = heads[key]
        _require(isinstance(head, torch.nn.Module), key + " must be a torch module")
        actual = tuple(head.parameters())
        _require(actual, key + " must have parameters")
        _require(len({id(parameter) for parameter in actual}) == len(actual),
                 key + " contains duplicate parameters")
        indexes = []
        for parameter in actual:
            identity = id(parameter)
            _require(identity in parameter_index,
                     key + " parameter is absent from the complete parameter sequence")
            _require(identity not in owned, "object head parameter alias is prohibited")
            owned.add(identity)
            indexes.append(parameter_index[identity])
        head_indices[key] = tuple(indexes)
    return parameters, head_indices


def _validate_gradient_set(name, values, parameters):
    import torch

    _require(isinstance(values, Sequence) and not isinstance(values, (str, bytes)),
             name + " must be a complete gradient sequence")
    values = tuple(values)
    _require(len(values) == len(parameters), name + " gradient count differs")
    normalized = []
    unused = []
    tensor_identities = set()
    for index, (value, parameter) in enumerate(zip(values, parameters)):
        if value is None:
            normalized.append(torch.zeros_like(parameter, memory_format=torch.preserve_format))
            unused.append(True)
            continue
        _require(isinstance(value, torch.Tensor),
                 f"{name}[{index}] must be a tensor or None")
        _require(id(value) not in tensor_identities,
                 name + " contains aliased gradient tensors")
        tensor_identities.add(id(value))
        _require(value.shape == parameter.shape, f"{name}[{index}] shape differs")
        _require(value.dtype == parameter.dtype, f"{name}[{index}] dtype differs")
        _require(value.device == parameter.device, f"{name}[{index}] device differs")
        _require(bool(torch.isfinite(value).all()), f"{name}[{index}] must be finite")
        normalized.append(value)
        unused.append(False)
    return tuple(normalized), tuple(unused)


def _flatten(values, indexes):
    import torch
    return torch.cat(tuple(values[index].detach().reshape(-1) for index in indexes))


def _relation(left64, right64):
    import torch
    dot = float(torch.dot(left64, right64))
    left_norm = float(torch.linalg.vector_norm(left64))
    right_norm = float(torch.linalg.vector_norm(right64))
    cosine = None if left_norm == 0 or right_norm == 0 else dot / (left_norm * right_norm)
    return {"dot": dot, "leftL2": left_norm, "rightL2": right_norm,
            "cosine": cosine}


def apply_object_head_core_priority_update_v24_cpu(
        *, model, parameters, core_gradients, whole_frame_gradients,
        structured_gradients, total_gradients):
    """Return candidate gradients and diagnostics without mutating any input.

    ``total_gradients`` must come from an independent differentiation of the
    actual scalar ``(Ls.float() + Lf).float() + Lc``.  This function can check
    its numeric identity but deliberately cannot infer gradient provenance from
    a caller-provided mapping.
    """
    import torch

    parameters, head_indices = _validate_model_and_parameters(model, parameters)
    core, core_unused = _validate_gradient_set("core", core_gradients, parameters)
    whole, whole_unused = _validate_gradient_set(
        "wholeFrameFidelity", whole_frame_gradients, parameters)
    structured, structured_unused = _validate_gradient_set(
        "structuredObjective", structured_gradients, parameters)
    total, total_unused = _validate_gradient_set("actualTotal", total_gradients, parameters)

    expected_total = tuple((structured_value.float() + whole_value.float()).float()
                           + core_value.float()
                           for core_value, whole_value, structured_value
                           in zip(core, whole, structured))
    for index, (actual, expected) in enumerate(zip(total, expected_total)):
        _require(bool(torch.isclose(actual, expected, atol=TOTAL_GRADIENT_ATOL,
                                    rtol=TOTAL_GRADIENT_RTOL).all()),
                 f"actual total gradient identity differs at parameter {index}")

    candidate = [value.detach().clone(memory_format=torch.preserve_format)
                 for value in total]
    float32_epsilon = torch.finfo(torch.float32).eps
    diagnostics = {}
    for key in OBJECT_HEAD_KEYS:
        indexes = head_indices[key]
        core32 = _flatten(core, indexes)
        whole32 = _flatten(whole, indexes)
        structured32 = _flatten(structured, indexes)
        total32 = _flatten(total, indexes)
        other32 = whole32 + structured32
        core64 = core32.to(torch.float64)
        other64 = other32.to(torch.float64)
        total64 = total32.to(torch.float64)
        q = float(torch.dot(core64, core64))
        d = float(torch.dot(core64, other64))
        _require(math.isfinite(q) and math.isfinite(d), key + " reduction is nonfinite")

        if q == 0:
            branch = "core_zero_preserve_actual_total"
            coefficient = None
            projection_residual = None
            projection_bound = None
        elif d >= 0:
            branch = "non_conflict_preserve_actual_total"
            coefficient = None
            projection_residual = None
            projection_bound = None
        else:
            branch = "conflict_projected"
            coefficient = d / q
            projected_other64 = other64 - coefficient * core64
            projected_other32 = projected_other64.to(torch.float32)
            _require(bool(torch.isfinite(projected_other32).all()),
                     key + " projected other gradient overflowed float32")
            projection_residual = abs(float(torch.dot(
                core64, projected_other32.to(torch.float64))))
            projection_bound = (PROJECTION_ROUNDOFF_MULTIPLIER * float32_epsilon
                                * float(torch.linalg.vector_norm(core64))
                                * float(torch.linalg.vector_norm(projected_other64)))
            _require(projection_residual <= projection_bound,
                     key + " projection roundoff exceeds the fixed bound")

            candidate64 = total64 - coefficient * core64
            candidate32 = candidate64.to(torch.float32)
            _require(bool(torch.isfinite(candidate32).all()),
                     key + " candidate gradient overflowed float32")
            offset = 0
            for index in indexes:
                count = parameters[index].numel()
                candidate[index] = candidate32[offset:offset + count].reshape_as(parameters[index])
                offset += count
            _require(offset == candidate32.numel(), key + " candidate split differs")

        candidate_head32 = _flatten(candidate, indexes)
        changed = candidate_head32.view(torch.uint8).ne(total32.view(torch.uint8))
        diagnostics[key] = {
            "branch": branch,
            "qCoreSquaredL2": q,
            "dCoreDotOther": d,
            "coefficient": coefficient,
            "rawCoreVsOther": _relation(core64, other64),
            "rawCoreVsActualTotal": _relation(core64, total64),
            "candidateCoreVsTotal": _relation(core64, candidate_head32.to(torch.float64)),
            "projectionResidualDot": projection_residual,
            "projectionRoundoffBound": projection_bound,
            "parameterTensorCount": len(indexes),
            "parameterElementCount": sum(parameters[index].numel() for index in indexes),
            "changedByteCount": int(torch.count_nonzero(changed)),
            "changedElementCount": int(torch.count_nonzero(candidate_head32 != total32)),
            "candidateDifferenceL2": float(torch.linalg.vector_norm(
                candidate_head32.to(torch.float64) - total64)),
            "unusedGradientTensorCount": {
                "core": sum(core_unused[index] for index in indexes),
                "wholeFrameFidelity": sum(whole_unused[index] for index in indexes),
                "structuredObjective": sum(structured_unused[index] for index in indexes),
                "actualTotal": sum(total_unused[index] for index in indexes),
            },
        }

    for index, value in enumerate(candidate):
        _require(value.shape == parameters[index].shape
                 and value.dtype == parameters[index].dtype
                 and value.device == parameters[index].device,
                 "candidate gradient metadata differs")
        _require(bool(torch.isfinite(value).all()), "candidate gradient must be finite")

    owned = {index for indexes in head_indices.values() for index in indexes}
    _require(all(torch.equal(candidate[index], total[index])
                 for index in range(len(parameters)) if index not in owned),
             "non-head gradient changed")
    return tuple(candidate), {
        "candidateId": CANDIDATE_ID,
        "headDiagnostics": diagnostics,
        "parameterTensorCount": len(parameters),
        "parameterElementCount": sum(parameter.numel() for parameter in parameters),
        "objectHeadParameterTensorCount": len(owned),
        "nonHeadParameterTensorCount": len(parameters) - len(owned),
        "actualTotalIndependentlyRequired": True,
        "optimizerCreated": False,
        "parametersUpdated": False,
    }

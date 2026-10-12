"""Managed-entry helpers for the inactive V24 core-priority training candidate.

The module computes one generator candidate gradient set from the existing
three-term objective.  It has no CLI, policy writer, background process,
checkpoint writer, or automatic training entry point.
"""
from __future__ import annotations

from collections import OrderedDict
from contextlib import contextmanager
import math

from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    OBJECT_HEAD_KEYS,
    apply_object_head_core_priority_update_v24_cpu,
)


CANDIDATE_ID = "stage4_mvp_v24_object_head_core_priority_training_candidate_v3"
EXPERIMENT_TYPE = "object_head_core_priority_train_only"
EXPECTED_MODEL_PARAMETER_TENSORS = 106
EXPECTED_MODEL_PARAMETER_ELEMENTS = 2_239_519
EXPECTED_HEAD_PARAMETER_TENSORS = 16
EXPECTED_HEAD_PARAMETER_ELEMENTS = 4_876
GENERATOR_LEARNING_RATE = .0001
ADAMW_BETAS = (.9, .999)
ADAMW_EPS = 1e-8
ADAMW_WEIGHT_DECAY = .01


def _require(value, message):
    if not value:
        raise ValueError(message)


@contextmanager
def generator_full_fp32_backend(*, cuda_matmul=None, cudnn_conv=None):
    """Use the current PyTorch precision API and restore every changed field.

    The nested cleanup is intentional: if the convolution setter fails after
    the matmul setter succeeds, the matmul field is still restored.
    """
    if cuda_matmul is None or cudnn_conv is None:
        import torch
        _require(cuda_matmul is None and cudnn_conv is None,
                 "precision backend overrides must be supplied together")
        cuda_matmul = torch.backends.cuda.matmul
        cudnn_conv = torch.backends.cudnn.conv
    matmul_before = cuda_matmul.fp32_precision
    conv_before = cudnn_conv.fp32_precision
    matmul_changed = False
    try:
        cuda_matmul.fp32_precision = "ieee"
        matmul_changed = True
        conv_changed = False
        try:
            cudnn_conv.fp32_precision = "ieee"
            conv_changed = True
            yield
        finally:
            if conv_changed:
                cudnn_conv.fp32_precision = conv_before
    finally:
        if matmul_changed:
            cuda_matmul.fp32_precision = matmul_before


def _storage_identity(parameter):
    return parameter.untyped_storage().data_ptr()


def bind_v23_object_head_parameters(model):
    """Return full/head parameters by actual module identity, failing closed."""
    import torch

    _require(isinstance(model, torch.nn.Module), "model must be a torch module")
    parameters = tuple(model.parameters())
    _require(len(parameters) == EXPECTED_MODEL_PARAMETER_TENSORS
             and sum(value.numel() for value in parameters) == EXPECTED_MODEL_PARAMETER_ELEMENTS,
             "V23 complete model parameter graph differs")
    _require(len({id(value) for value in parameters}) == len(parameters),
             "duplicate model parameter identity prohibited")
    _require(len({_storage_identity(value) for value in parameters}) == len(parameters),
             "shared model parameter storage prohibited")
    _require(all(value.dtype == torch.float32 for value in parameters),
             "generator parameters must be native float32")
    devices = {value.device for value in parameters}
    _require(len(devices) == 1, "generator parameters must share one device")

    heads = getattr(model, "object_rgb_heads", None)
    _require(heads is not None and set(heads.keys()) == set(OBJECT_HEAD_KEYS),
             "actual four object_rgb_heads are required")
    by_identity = {id(value): index for index, value in enumerate(parameters)}
    head_indexes = OrderedDict()
    owned = set()
    for key in OBJECT_HEAD_KEYS:
        values = tuple(heads[key].parameters())
        _require(len(values) == 4 and sum(value.numel() for value in values) == 1219,
                 key + " parameter graph differs")
        indexes = []
        for value in values:
            identity = id(value)
            _require(identity in by_identity and identity not in owned,
                     "object head identity overlap or absence")
            owned.add(identity); indexes.append(by_identity[identity])
        head_indexes[key] = tuple(indexes)
    _require(len(owned) == EXPECTED_HEAD_PARAMETER_TENSORS
             and sum(parameters[index].numel() for indexes in head_indexes.values()
                     for index in indexes) == EXPECTED_HEAD_PARAMETER_ELEMENTS,
             "four-head parameter graph differs")
    return parameters, head_indexes


def _autocast_enabled(torch):
    enabled = bool(torch.is_autocast_enabled())
    for device in ("cpu", "cuda"):
        try:
            enabled = enabled or bool(torch.is_autocast_enabled(device))
        except (TypeError, RuntimeError):
            pass
    return enabled


def _normalize(gradients, parameters, name):
    import torch
    _require(len(gradients) == len(parameters), name + " gradient count differs")
    values, unused = [], []
    for index, (gradient, parameter) in enumerate(zip(gradients, parameters)):
        if gradient is None:
            values.append(torch.zeros_like(parameter)); unused.append(index)
        else:
            _require(gradient.shape == parameter.shape and gradient.dtype == torch.float32
                     and gradient.device == parameter.device,
                     name + " gradient metadata differs")
            _require(bool(torch.isfinite(gradient).all()), name + " gradient is nonfinite")
            values.append(gradient.detach());
    return tuple(values), tuple(unused)


def _cpu_head_carrier(parameters, head_indexes):
    import torch
    from torch import nn

    class Carrier(nn.Module):
        def __init__(self):
            super().__init__()
            self.object_rgb_heads = nn.ModuleDict()
            for key, indexes in head_indexes.items():
                self.object_rgb_heads[key] = nn.ParameterList([
                    nn.Parameter(parameters[index].detach().to("cpu", dtype=torch.float32).clone(),
                                 requires_grad=False)
                    for index in indexes])

    return Carrier()


def compute_v24_generator_candidate_gradients(*, model, critic, sample,
                                                actual_total, structured_objective,
                                                whole_frame_fidelity, object_core_rgb):
    """Differentiate the real objective and return one checked full gradient set.

    The real total is differentiated independently over the complete model.
    Only the 16 actual head parameters receive the other three differentiations
    and bounded CPU copies.
    """
    import torch

    _require(sample.get("split") == "train", "non-train generator update prohibited")
    _require(isinstance(sample.get("image"), torch.Tensor)
             and isinstance(sample.get("conditions"), torch.Tensor)
             and not sample["image"].requires_grad and not sample["conditions"].requires_grad,
             "target and conditions must be detached")
    _require(not critic.training and all(not value.requires_grad for value in critic.parameters()),
             "critic must be frozen in eval mode for generator gradients")
    _require(not _autocast_enabled(torch), "generator gradient computation forbids autocast")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb)
    _require(all(isinstance(value, torch.Tensor) and value.numel() == 1
                 and value.dtype == torch.float32 and bool(torch.isfinite(value)) for value in losses),
             "generator objective scalars must be finite native float32")
    expected = (structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb
    _require(torch.equal(actual_total.detach(), expected.detach()),
             "actual total scalar differs from the fixed objective formula")

    parameters, head_indexes = bind_v23_object_head_parameters(model)
    if parameters[0].is_cuda:
        _require(torch.backends.cuda.matmul.fp32_precision == "ieee"
                 and torch.backends.cudnn.conv.fp32_precision == "ieee",
                 "CUDA generator gradients require explicit IEEE FP32 matmul and convolution")
    head_parameters = tuple(parameters[index] for indexes in head_indexes.values() for index in indexes)
    actual_raw = torch.autograd.grad(actual_total, parameters, retain_graph=True,
                                     create_graph=False, allow_unused=True)
    core_raw = torch.autograd.grad(object_core_rgb, head_parameters, retain_graph=True,
                                   create_graph=False, allow_unused=True)
    whole_raw = torch.autograd.grad(whole_frame_fidelity, head_parameters, retain_graph=True,
                                    create_graph=False, allow_unused=True)
    structured_raw = torch.autograd.grad(structured_objective, head_parameters, retain_graph=False,
                                         create_graph=False, allow_unused=True)
    actual, actual_unused = _normalize(actual_raw, parameters, "actualTotal")
    core, core_unused = _normalize(core_raw, head_parameters, "objectCoreRgb")
    whole, whole_unused = _normalize(whole_raw, head_parameters, "wholeFrameFidelity")
    structured, structured_unused = _normalize(
        structured_raw, head_parameters, "structuredObjective")

    carrier = _cpu_head_carrier(parameters, head_indexes)
    carrier_parameters = tuple(carrier.parameters())
    actual_head = tuple(actual[index].to("cpu", dtype=torch.float32).clone()
                        for indexes in head_indexes.values() for index in indexes)
    core_cpu = tuple(value.to("cpu", dtype=torch.float32).clone() for value in core)
    whole_cpu = tuple(value.to("cpu", dtype=torch.float32).clone() for value in whole)
    structured_cpu = tuple(value.to("cpu", dtype=torch.float32).clone() for value in structured)
    candidate_cpu, reference = apply_object_head_core_priority_update_v24_cpu(
        model=carrier, parameters=carrier_parameters, core_gradients=core_cpu,
        whole_frame_gradients=whole_cpu, structured_gradients=structured_cpu,
        total_gradients=actual_head)

    candidate = list(actual)
    head_position = 0
    for key, indexes in head_indexes.items():
        branch = reference["headDiagnostics"][key]["branch"]
        for index in indexes:
            if branch == "conflict_projected":
                value = candidate_cpu[head_position].to(parameters[index].device,
                                                        dtype=torch.float32)
                _require(bool(torch.isfinite(value).all()), key + " returned nonfinite gradient")
                candidate[index] = value
            else:
                _require(torch.equal(candidate_cpu[head_position].contiguous().view(torch.uint8),
                                     actual_head[head_position].contiguous().view(torch.uint8)),
                         key + " nonconflict CPU reference changed bytes")
                candidate[index] = actual[index]
            head_position += 1
    _require(head_position == EXPECTED_HEAD_PARAMETER_TENSORS,
             "CPU head candidate mapping differs")
    head_owned = {index for indexes in head_indexes.values() for index in indexes}
    _require(all(candidate[index] is actual[index] for index in range(len(parameters))
                 if index not in head_owned), "non-head actual gradient identity changed")
    nonconflict_bytes_preserved = all(
        reference["headDiagnostics"][key]["changedByteCount"] == 0
        for key in OBJECT_HEAD_KEYS
        if reference["headDiagnostics"][key]["branch"] != "conflict_projected")
    named_by_identity = {id(value): name for name, value in model.named_parameters()}
    head_parameter_names = {key: [named_by_identity[id(parameters[index])] for index in indexes]
                            for key, indexes in head_indexes.items()}
    gradient_nonzero_tensors = sum(bool(torch.count_nonzero(value)) for value in candidate)
    gradient_nonzero_elements = sum(int(torch.count_nonzero(value)) for value in candidate)
    head_candidate_l2 = {key: float(torch.linalg.vector_norm(torch.cat(tuple(
        candidate[index].reshape(-1).float() for index in indexes))))
        for key, indexes in head_indexes.items()}
    return tuple(candidate), {"candidateId": CANDIDATE_ID,
        "autogradGradCalls": 4, "actualTotalIndependentFullModelGradient": True,
        "headOnlyAuxiliaryGradientTensorCount": EXPECTED_HEAD_PARAMETER_TENSORS * 3,
        "cpuCopiedParameterTensorCount": EXPECTED_HEAD_PARAMETER_TENSORS,
        "cpuCopiedParameterElementCount": EXPECTED_HEAD_PARAMETER_ELEMENTS,
        "fullModelAuxiliaryGradientsCopiedToCpu": False,
        "cpuReferenceExact": True, "headDiagnostics": reference["headDiagnostics"],
        "parameterIdentity": {"modelParameterTensorCount": len(parameters),
            "modelParameterElementCount": sum(value.numel() for value in parameters),
            "objectHeadParameterTensorCount": len(head_owned),
            "objectHeadParameterElementCount": EXPECTED_HEAD_PARAMETER_ELEMENTS,
            "headParameterNames": head_parameter_names,
            "uniqueParameterIdentities": True, "uniqueParameterStorages": True},
        "generatorGradientFacts": {"tensorCount": len(candidate),
            "nonzeroTensorCount": gradient_nonzero_tensors,
            "nonzeroElementCount": gradient_nonzero_elements,
            "allFinite": True, "headCandidateL2": head_candidate_l2},
        "nonHeadActualTotalIdentityPreserved": True,
        "nonConflictHeadActualTotalBytesPreserved": nonconflict_bytes_preserved,
        "unusedGradientIndexes": {"actualTotal": list(actual_unused),
            "objectCoreRgb": list(core_unused), "wholeFrameFidelity": list(whole_unused),
            "structuredObjective": list(structured_unused)}}


def commit_generator_step(*, optimizer, model, candidate_gradients, sample, counts,
                          limit, check_resource, gradient_validator):
    """Assign one checked gradient set and preserve real completed-step counts."""
    import torch

    _require(sample.get("split") == "train", "non-train generator update prohibited")
    _require(isinstance(optimizer, torch.optim.AdamW), "generator optimizer must be AdamW")
    _require(counts.get("generator", -1) < limit, "generator optimizer step budget exhausted")
    parameters = tuple(model.parameters())
    _require(len(candidate_gradients) == len(parameters), "candidate gradient count differs")
    for group in optimizer.param_groups:
        _require(group["lr"] == GENERATOR_LEARNING_RATE
                 and tuple(group["betas"]) == ADAMW_BETAS
                 and group["eps"] == ADAMW_EPS
                 and group["weight_decay"] == ADAMW_WEIGHT_DECAY
                 and group.get("foreach") is False and group.get("fused") is False,
                 "generator AdamW plan differs")
    optimizer.zero_grad(set_to_none=True)
    for parameter, gradient in zip(parameters, candidate_gradients):
        _require(gradient.shape == parameter.shape and gradient.dtype == parameter.dtype
                 and gradient.device == parameter.device and bool(torch.isfinite(gradient).all()),
                 "candidate gradient metadata or finite check failed")
        parameter.grad = gradient.detach()
    gradient_validator(model, next(model.parameters()).device.type)
    check_resource()
    optimizer.step()
    counts["generator"] += 1
    for name, parameter in model.named_parameters():
        _require(bool(torch.isfinite(parameter).all()),
                 "nonfinite parameter after generator step: " + name)
    for state in optimizer.state.values():
        for value in state.values():
            if isinstance(value, torch.Tensor):
                _require(bool(torch.isfinite(value).all()),
                         "nonfinite generator optimizer state")
    check_resource()

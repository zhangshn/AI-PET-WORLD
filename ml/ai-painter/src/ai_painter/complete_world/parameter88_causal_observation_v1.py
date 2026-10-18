"""Read-only parameter88 observations and unauthenticated local arithmetic evidence.

No model construction, restore, admission, differentiation, optimizer or file I/O.
The controller must authenticate the original gate origin before using a contrast.
"""
from __future__ import annotations

import hashlib
import math
from copy import deepcopy
import torch
from torch import nn
from torch.nn import functional as F

LABELS = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
TARGET_INDEX = 88
TARGET_NAME = "core.core.final_rgb_decoder.base.layers.2.weight"
TARGET_MODULE = TARGET_NAME.removesuffix(".weight")
METADATA_RESERVE = 1024**2
MAX_CAPTURE_BYTES = 64 * 1024**2
ATOL, RTOL = 1e-6, 1e-5


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _tensor(value, *, device=None, contiguous=False):
    _require(type(value) in (torch.Tensor, nn.Parameter) and value.layout == torch.strided
             and value.dtype == torch.float32 and value.device.type in ("cpu", "cuda"),
             "plain finite FP32 strided tensor required")
    _require(device is None or value.device == device, "tensor device mismatch")
    _require(not contiguous or value.is_contiguous(), "contiguous tensor required")
    _require(bool(torch.isfinite(value.detach()).all()), "nonfinite tensor")
    return value


def _storage(value):
    s = value.untyped_storage()
    return (str(value.device), s._cdata, s.data_ptr(), s.nbytes())


def _signature(value):
    return (_storage(value), tuple(value.shape), tuple(value.stride()),
            value.storage_offset(), value.dtype, value._version, value.requires_grad)


def _sha(value):
    return hashlib.sha256(value.detach().cpu().numpy().tobytes(order="C")).hexdigest()


def _pair(value, name, *, zero=False):
    values = (value, value) if type(value) is int else tuple(value) if type(value) in (tuple, list) else ()
    _require(len(values) == 2 and all(type(v) is int and v >= (0 if zero else 1) for v in values),
             "invalid convolution " + name)
    return values


class Parameter88Observer:
    """Single-use observer compatible with original attempt/complete events.

    ``evidence()`` returns detached capture tensors. It grants no permission to
    run the local contrast: a separately authenticated controller owns that gate.
    """
    def __init__(self, model, *, max_capture_bytes=MAX_CAPTURE_BYTES, resource=None):
        _require(isinstance(model, nn.Module), "model required")
        _require(type(max_capture_bytes) is int and METADATA_RESERVE <= max_capture_bytes <= MAX_CAPTURE_BYTES,
                 "capture budget invalid")
        _require(resource is None or callable(resource), "resource callback invalid")
        self.model, self.resource = model, resource
        self.maximum, self.used = max_capture_bytes, METADATA_RESERVE
        self._handles, self._sources = [], []
        self._active, self._entered, self._closed, self._forwards = None, False, False, 0
        self._adjoints, self._gradients, self._descriptors = {}, {}, {}
        self._input, self._input_ref, self._output_ref = None, None, None
        self._observation_error = None
        self._graph = tuple(model.named_parameters(remove_duplicate=False))
        self._buffers = tuple(model.named_buffers(remove_duplicate=False))
        _require(len(self._graph) == 108 and len({id(p) for _, p in self._graph}) == 108,
                 "canonical 108 parameter identities required")
        canonical = tuple(model.parameters())
        _require(len(canonical) == len(self._graph) and all(p is q for p, (_, q) in zip(canonical, self._graph)),
                 "canonical parameter order differs")
        _require(len({_storage(p) for _, p in self._graph}) == 108, "parameter storage alias")
        self.device = self._graph[0][1].device
        for _, p in self._graph:
            _tensor(p, device=self.device, contiguous=True)
            _require(p.requires_grad, "all original parameters must require gradients")
        for _, b in self._buffers:
            _require(b.layout == torch.strided and b.device == self.device and bool(torch.isfinite(b.detach()).all()),
                     "buffer layout/device/finite mismatch")
        self._versions = tuple(_signature(p) for _, p in self._graph)
        self._existing_gradients = tuple((p.grad, None if p.grad is None else _signature(p.grad)) for _, p in self._graph)
        self._buffer_versions = tuple(_signature(b) for _, b in self._buffers)
        self._modes = tuple((name, module, module.training) for name, module in model.named_modules(remove_duplicate=False))
        self.module = model.get_submodule(TARGET_MODULE)
        _require(type(self.module) is nn.Conv2d and self._graph[TARGET_INDEX][0] == TARGET_NAME
                 and self._graph[TARGET_INDEX][1] is self.module.weight
                 and tuple(self.module.weight.shape) == (48, 48, 3, 3), "exact parameter88 convolution binding required")
        _require(self.module.padding_mode == "zeros", "only original zero-padding convolution supported")
        self.convolution = dict(weight_shape=tuple(self.module.weight.shape),
            stride=_pair(self.module.stride, "stride"), padding=_pair(self.module.padding, "padding", zero=True),
            dilation=_pair(self.module.dilation, "dilation"), groups=self.module.groups)
        _require(type(self.module.groups) is int and self.module.groups == 1
                 and self.module.in_channels == self.module.out_channels == 48,
                 "target convolution channel/group binding differs")
        self._configuration = self._config()
        self._weight_sha = _sha(self.module.weight)

    def _config(self):
        return (self.module.in_channels, self.module.out_channels, self.module.kernel_size,
                self.module.stride, self.module.padding, self.module.dilation, self.module.groups,
                self.module.padding_mode, id(self.module.bias))

    def _check(self):
        if self.resource is not None:
            self.resource()
        named = tuple(self.model.named_parameters(remove_duplicate=False))
        buffers = tuple(self.model.named_buffers(remove_duplicate=False))
        _require(len(named) == len(self._graph) and all(n == old and p is ref
                 for (n, p), (old, ref) in zip(named, self._graph)), "parameter graph changed")
        _require(len(buffers) == len(self._buffers) and all(n == old and b is ref
                 for (n, b), (old, ref) in zip(buffers, self._buffers)), "buffer graph changed")
        _require(tuple(_signature(p) for _, p in named) == self._versions
                 and tuple(_signature(b) for _, b in buffers) == self._buffer_versions,
                 "parameter/buffer identity or version changed")
        _require(all(p.grad is grad and (grad is None or _signature(grad) == signature)
                 for (_, p), (grad, signature) in zip(named, self._existing_gradients)),
                 "original parameter grad changed")
        modes = tuple(self.model.named_modules(remove_duplicate=False))
        _require(len(modes) == len(self._modes) and all(n == old and m is ref and m.training == flag
                 for (n, m), (old, ref, flag) in zip(modes, self._modes)), "module graph/mode changed")
        _require(self._config() == self._configuration and _sha(self.module.weight) == self._weight_sha,
                 "convolution configuration/weight bytes changed")
        for value, signature in self._sources:
            _require(_signature(value) == signature, "observed tensor identity/layout/version changed")
        if self._input_ref is not None:
            _require(_sha(self._input_ref) == self._descriptors["input"]["sha256"], "shared input bytes changed")
        if self._output_ref is not None:
            _require(_signature(self._output_ref) == self._output_signature,
                     "target output identity/layout/version changed")

    def _clone(self, key, value):
        _tensor(value, device=self.device)
        size = value.numel() * value.element_size()
        _require(self.used + size <= self.maximum, "capture budget exceeded before clone")
        source_storage = _storage(value)
        _require(source_storage not in {_storage(p) for _, p in self._graph}, "capture aliases model parameter")
        _require(source_storage not in {_storage(b) for _, b in self._buffers}, "capture aliases model buffer")
        _require(key == "input" or source_storage != _storage(self._output_ref), "capture aliases forward output")
        _require(all(source_storage != _storage(other) for other, _ in self._sources), "capture source storage alias")
        self.used += size
        result = value.detach().clone(memory_format=torch.contiguous_format)
        _require(_storage(result) != source_storage and result.is_contiguous() and not result.requires_grad,
                 "capture clone layout/alias invalid")
        self._sources.append((value, _signature(value)))
        self._descriptors[key] = dict(bytes=size, shape=list(value.shape), stride=list(value.stride()),
            sourceVersion=value._version, dtype=str(value.dtype), device=str(value.device), sha256=_sha(result))
        return result

    def __enter__(self):
        _require(not self._entered and not self._closed, "observer is single-use")
        self._check()
        self._entered = True
        self._handles.append(self.module.register_forward_hook(self._forward))
        return self

    def _forward(self, module, args, output):
        self._check()
        _require(module is self.module and self._forwards == 0 and len(args) == 1,
                 "repeated or wrong target forward")
        input_tensor = _tensor(args[0], device=self.device, contiguous=True)
        _tensor(output, device=self.device, contiguous=True)
        _require(input_tensor.ndim == output.ndim == 4 and input_tensor.shape[0] == output.shape[0] == 1
                 and input_tensor.shape[1] == output.shape[1] == 48 and output.requires_grad,
                 "target input/output shape or graph invalid")
        _require(_storage(input_tensor) != _storage(output), "target input/output alias")
        proposed = input_tensor.numel() * 4 + 5 * output.numel() * 4 + 5 * self.module.weight.numel() * 4
        _require(self.used + proposed <= self.maximum, "capture budget exceeded before first clone")
        self._forwards = 1
        self._input_ref, self._output_ref = input_tensor, output
        self._output_signature = _signature(output)
        self._input = self._clone("input", input_tensor)
        self._handles.append(output.register_hook(self._adjoint))
        return None

    def _adjoint(self, value):
        self._check()
        _require(self._active is not None and self._active not in self._adjoints, "missing/repeated adjoint label")
        _require(tuple(value.shape) == tuple(self._output_ref.shape), "adjoint shape differs")
        self._adjoints[self._active] = self._clone("adjoint." + self._active, value)
        return None

    def __call__(self, stage, label, raw):
        _require(self._entered and not self._closed, "observer not active")
        self._check()
        _require(self._forwards == 1 and _signature(self._output_ref) == self._output_signature,
                 "same target output invocation required")
        _require(stage in ("attempt", "complete") and label in LABELS, "unknown observation stage/label")
        if stage == "attempt":
            _require(raw is None and self._active is None and len(self._gradients) < 5
                     and label == LABELS[len(self._gradients)], "duplicate/out-of-order attempt label")
            self._active = label
        else:
            _require(self._active == label and label in self._adjoints and label not in self._gradients,
                     "missing/duplicate/out-of-order complete label")
            _require(type(raw) in (tuple, list) and len(raw) == 108 and raw[TARGET_INDEX] is not None,
                     "complete original 108 gradient sequence required")
            value = raw[TARGET_INDEX]
            _require(tuple(value.shape) == tuple(self.module.weight.shape), "target native gradient shape differs")
            self._gradients[label] = self._clone("gradient." + label, value)
            self._active = None

    def _complete(self):
        _require(self._forwards == 1 and self._active is None and tuple(self._adjoints) == LABELS
                 and tuple(self._gradients) == LABELS, "five objective captures incomplete")

    def __exit__(self, kind, error, traceback):
        try:
            self._check()
            self._complete()
        except BaseException as secondary:
            self._observation_error = str(secondary)
            if error is None:
                raise
            try:
                error.parameter88_observation_error = str(secondary)
            except BaseException:
                pass
        finally:
            self._closed = True
            for handle in reversed(self._handles):
                handle.remove()
            self._handles.clear()
        return False

    def evidence(self):
        _require(self._closed and self._observation_error is None, "closed complete observation required")
        self._check()
        self._complete()
        captured = {"input": self._input,
            **{"adjoint." + key: value for key, value in self._adjoints.items()},
            **{"gradient." + key: value for key, value in self._gradients.items()}}
        for key, value in captured.items():
            _require(_sha(value) == self._descriptors[key]["sha256"], "captured tensor bytes changed")
        return dict(input_tensor=self._input, adjoints=tuple(self._adjoints[v] for v in LABELS),
            native_gradients=tuple(self._gradients[v] for v in LABELS), convolution=dict(self.convolution),
            metadata=dict(schemaVersion="parameter88-causal-observation-v1", labels=list(LABELS),
                parameterIndex=TARGET_INDEX, parameterName=TARGET_NAME, weightSha256=self._weight_sha,
                currentInstanceVersion=self._versions[TARGET_INDEX][5], targetForwards=self._forwards,
                objectiveCaptures=len(self._gradients), captureBytes=self.used,
                metadataReserveBytes=METADATA_RESERVE, descriptors=deepcopy(self._descriptors),
                meaning="observation_only_not_authenticated_gate_or_historical_replay"))


def local_weight_vjp_fp64(input_tensor, adjoint, *, weight_shape, stride, padding, dilation, groups):
    """Same-device FP64 unfold/matmul. No autograd, .grad write or model update."""
    _tensor(input_tensor)
    _tensor(adjoint, device=input_tensor.device)
    shape = tuple(weight_shape)
    _require(len(shape) == 4 and all(type(v) is int and v > 0 for v in shape), "weight shape invalid")
    _require(type(groups) is int and groups > 0 and shape[0] % groups == 0, "convolution groups invalid")
    stride, padding, dilation = _pair(stride, "stride"), _pair(padding, "padding", zero=True), _pair(dilation, "dilation")
    _require(input_tensor.ndim == adjoint.ndim == 4 and input_tensor.shape[0] > 0
             and input_tensor.shape[0] == adjoint.shape[0] and input_tensor.shape[1] == shape[1] * groups
             and adjoint.shape[1] == shape[0], "input/adjoint convolution channels differ")
    spatial = tuple((input_tensor.shape[i + 2] + 2 * padding[i] - dilation[i] * (shape[i + 2] - 1) - 1)
                    // stride[i] + 1 for i in range(2))
    _require(all(v > 0 for v in spatial) and tuple(adjoint.shape[2:]) == spatial, "convolution output spatial mismatch")
    with torch.no_grad(), torch.autocast(device_type=input_tensor.device.type, enabled=False):
        columns = F.unfold(input_tensor.detach().to(torch.float64), shape[2:],
                           dilation=dilation, padding=padding, stride=stride)
        batch, _, locations = columns.shape
        columns = columns.reshape(batch, groups, math.prod(shape[1:]), locations)
        upstream = adjoint.detach().to(torch.float64).reshape(batch, groups, shape[0] // groups, locations)
        result = (upstream @ columns.transpose(-1, -2)).sum(dim=0).reshape(shape)
        _require(bool(torch.isfinite(result).all()), "FP64 reference nonfinite")
        return result


def decompose_target_gradients(input_tensor, adjoints, native_gradients, *, convolution, resource=None, on_reference=None):
    """Pure evidence; cannot authenticate a gate exception or grant continuation."""
    _tensor(input_tensor)
    _require(type(adjoints) in (tuple, list) and type(native_gradients) in (tuple, list)
             and len(adjoints) == len(native_gradients) == 5, "five ordered target gradients/adjoints required")
    _require(type(convolution) is dict and set(convolution) == {"weight_shape", "stride", "padding", "dilation", "groups"},
             "exact convolution configuration required")
    shape = tuple(convolution["weight_shape"])
    for value in native_gradients:
        _tensor(value, device=input_tensor.device)
        _require(tuple(value.shape) == shape, "native gradient shape mismatch")
    references = []
    for label, value in zip(LABELS, adjoints):
        if resource is not None: resource()
        if on_reference is not None: on_reference("attempt", label)
        references.append(local_weight_vjp_fp64(input_tensor, value, **convolution))
        if on_reference is not None: on_reference("complete", label)
        if resource is not None: resource()
    references = tuple(references)
    with torch.no_grad():
        A = native_gradients[0].detach().to(torch.float64)
        E32 = ((native_gradients[1].detach().float() + native_gradients[2].detach().float()).float() + native_gradients[3].detach().float()).float() + native_gradients[4].detach().float()
        E = E32.to(torch.float64)
        T = references[0]
        S = ((references[1] + references[2]) + references[3]) + references[4]
        B = ((native_gradients[1].detach().to(torch.float64) + native_gradients[2].detach().to(torch.float64)) + native_gradients[3].detach().to(torch.float64)) + native_gradients[4].detach().to(torch.float64)
        upstream, total_reduction, component_reduction, rounding = T - S, A - T, B - S, B - E
        residual = (A - E) - (((upstream + total_reduction) - component_reduction) + rounding)
        difference = adjoints[0].detach().to(torch.float64) - ((adjoints[1].detach().to(torch.float64)
                     + adjoints[2].detach().to(torch.float64)) + adjoints[3].detach().to(torch.float64) + adjoints[4].detach().to(torch.float64))
        component_adjoint32 = ((adjoints[1].detach().float() + adjoints[2].detach().float()).float() + adjoints[3].detach().float()).float() + adjoints[4].detach().float()
        outside = ~torch.isclose(native_gradients[0].detach(), E32, atol=ATOL, rtol=RTOL)
        rounded_comparisons = []
        for label, native, reference in zip(LABELS, native_gradients, references):
            rounded = reference.to(torch.float32)
            _require(bool(torch.isfinite(rounded).all()), "reference FP32 rounding nonfinite")
            rounded_comparisons.append(dict(label=label, rounding="single_fp64_to_fp32",
                outsideToleranceElements=int((~torch.isclose(native.detach(), rounded, atol=ATOL, rtol=RTOL)).count_nonzero()),
                maximumAbsoluteDifference=float((native.detach().to(torch.float64)-rounded.to(torch.float64)).abs().max())))
        return dict(schemaVersion="parameter88-local-decomposition-v1",
            meaning="pure_arithmetic_evidence_not_authenticated_gate_or_causal_qualification",
            formula="A-E=(T-S)+(A-T)-(B-S)+(B-E)", labels=list(LABELS),
            referenceVjpCount=5, referenceGradients=references,
            referenceFp32Comparisons=rounded_comparisons,
            terms=dict(upstream=upstream, totalNativeReduction=total_reduction,
                       componentNativeReduction=component_reduction, fp32ComponentSumRounding=rounding),
            observedDifference=A-E, residual=residual, maximumResidual=float(residual.abs().max()),
            upstreamAdjointDifference=difference,
            upstreamAdjointDifferenceSummary=dict(shape=list(difference.shape), dtype=str(difference.dtype),
                sha256=_sha(difference), maximumAbsolute=float(difference.abs().max()),
                minimumSigned=float(difference.min()), maximumSigned=float(difference.max()),
                nonzeroElements=int(difference.count_nonzero()),
                meaning="difference_of_same_call_observed_adjoints_not_whole_model_gradient_reference"),
            upstreamAdjointBytesEqual=_sha(adjoints[0]) == _sha(component_adjoint32),
            originalFp32Comparison=dict(atol=ATOL, rtol=RTOL,
                order="(((structured.float()+whole.float()).float()+core.float()).float()+support.float())",
                outsideToleranceElements=int(outside.count_nonzero()),
                maximumAbsoluteDifference=float((A-E).abs().max())))


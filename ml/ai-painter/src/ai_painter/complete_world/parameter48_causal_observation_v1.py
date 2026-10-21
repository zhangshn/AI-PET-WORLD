"""Read-only selected-plane observations; no model, restore, gate or file I/O.

Only the worker can authenticate the unchanged 108-parameter gate, preserve its
first error, and decide whether a new local comparison is in scope. These pure
observations and arithmetic never grant that permission or prove a root cause.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import math
import struct
import weakref

import torch
from torch import nn

LABELS = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
TARGET_INDEX = 48
TARGET_NAME = "core.core.terrain.decode_1.layers.0.weight"
TARGET_MODULE = TARGET_NAME.removesuffix(".weight")
TARGET_SHAPE = (48, 144, 3, 3)
COORDINATES = ((10, 81, 0, 0), (10, 81, 1, 0))
INPUT_CHANNEL, OUTPUT_CHANNEL = 81, 10
METADATA_RESERVE = 1024**2
MAX_CAPTURE_BYTES = 64 * 1024**2
PRODUCTION_SPATIAL = (192, 256)
ATOL, RTOL = 1e-6, 1e-5


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _tensor(value, *, device=None, contiguous=False):
    _require(type(value) in (torch.Tensor, nn.Parameter) and value.layout == torch.strided
             and value.dtype == torch.float32 and value.device.type in ("cpu", "cuda"),
             "plain FP32 strided tensor required")
    _require(device is None or value.device == device, "tensor device mismatch")
    _require(not contiguous or value.is_contiguous(), "contiguous tensor required")
    _require(bool(torch.isfinite(value.detach()).all()), "nonfinite tensor")
    return value


def _storage(value):
    storage = value.untyped_storage()
    return (str(value.device), storage._cdata, storage.data_ptr(), storage.nbytes())


def _signature(value):
    return (_storage(value), tuple(value.shape), tuple(value.stride()), value.storage_offset(),
            value.dtype, value._version, value.requires_grad)


def _sha(value):
    return hashlib.sha256(value.detach().cpu().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def _pair(value):
    result = (value, value) if type(value) is int else tuple(value) if type(value) in (tuple, list) else ()
    _require(len(result) == 2 and all(type(v) is int for v in result), "invalid convolution pair")
    return result


def _convolution(value):
    _require(type(value) is dict and set(value) == {"weight_shape", "stride", "padding", "dilation", "groups"},
             "exact convolution configuration required")
    _require(tuple(value["weight_shape"]) == TARGET_SHAPE and _pair(value["stride"]) == (1, 1)
             and _pair(value["padding"]) == (1, 1) and _pair(value["dilation"]) == (1, 1)
             and type(value["groups"]) is int and value["groups"] == 1, "parameter48 convolution geometry differs")


class _PlaneObserver:
    """Shared mechanism. Small tests supply an actual fixture subclass, no flag.

    Full activation references below are weak: capturing six planes must not
    retain five full output-adjoint storages. A released source is recorded as
    released, never represented as a lifetime-long version/byte proof.
    """
    def _spatial(self):
        raise NotImplementedError

    def __init__(self, model, *, max_capture_bytes=MAX_CAPTURE_BYTES, resource=None):
        _require(isinstance(model, nn.Module), "model required")
        _require(type(max_capture_bytes) is int and METADATA_RESERVE <= max_capture_bytes <= MAX_CAPTURE_BYTES,
                 "capture budget invalid")
        _require(resource is None or callable(resource), "resource callback invalid")
        self.model, self.resource = model, resource
        self.maximum, self.used = max_capture_bytes, METADATA_RESERVE
        self._handles, self._sources = [], []
        self._active, self._entered, self._closed, self._forwards = None, False, False, 0
        self._checking = False
        self._adjoints, self._gradients, self._descriptors = {}, {}, {}
        self._input, self._input_ref, self._output_ref = None, None, None
        self._observation_error = None
        self._graph = tuple(model.named_parameters(remove_duplicate=False))
        self._buffers = tuple(model.named_buffers(remove_duplicate=False))
        canonical = tuple(model.parameters())
        _require(len(self._graph) == len(canonical) == 108 and len({id(p) for _, p in self._graph}) == 108
                 and all(p is q for p, (_, q) in zip(canonical, self._graph)), "canonical 108 parameter identities/order required")
        _require(len({_storage(p) for _, p in self._graph}) == 108, "parameter storage alias")
        self.device = canonical[0].device
        for parameter in canonical:
            _tensor(parameter, device=self.device, contiguous=True)
            _require(parameter.requires_grad, "all original parameters must require gradients")
        for _, buffer in self._buffers:
            _require(buffer.layout == torch.strided and buffer.device == self.device
                     and bool(torch.isfinite(buffer.detach()).all()), "buffer layout/device/finite mismatch")
        self._versions = tuple(_signature(p) for _, p in self._graph)
        self._buffer_versions = tuple(_signature(b) for _, b in self._buffers)
        self._existing_gradients = tuple((p.grad, None if p.grad is None else _signature(p.grad)) for p in canonical)
        self._modes = tuple((name, module, module.training) for name, module in model.named_modules(remove_duplicate=False))
        self.module = model.get_submodule(TARGET_MODULE)
        _require(type(self.module) is nn.Conv2d and self._graph[TARGET_INDEX][0] == TARGET_NAME
                 and self._graph[TARGET_INDEX][1] is self.module.weight and tuple(self.module.weight.shape) == TARGET_SHAPE,
                 "exact parameter48 convolution binding required")
        _require(self.module.in_channels == 144 and self.module.out_channels == 48
                 and _pair(self.module.kernel_size) == (3, 3) and self.module.padding_mode == "zeros",
                 "parameter48 channels/kernel/zero padding differ")
        self.convolution = dict(weight_shape=TARGET_SHAPE, stride=_pair(self.module.stride),
                                padding=_pair(self.module.padding), dilation=_pair(self.module.dilation), groups=self.module.groups)
        _convolution(self.convolution)
        self._configuration = self._config()
        self._weight_sha = _sha(self.module.weight)
        self._cpu_rng_sha = _sha(torch.random.get_rng_state())
        _require(self.device.type != "cuda" or torch.cuda.is_initialized(), "observer cannot initialize CUDA")
        self._cuda_rng_sha = _sha(torch.cuda.get_rng_state(self.device)) if self.device.type == "cuda" else None

    def _config(self):
        return (self.module.in_channels, self.module.out_channels, self.module.kernel_size, self.module.stride,
                self.module.padding, self.module.dilation, self.module.groups, self.module.padding_mode, id(self.module.bias))

    def _check(self):
        _require(not self._checking, "reentrant observation/resource callback")
        self._checking = True
        try:
            if self.resource is not None:
                self.resource()
            named, buffers = tuple(self.model.named_parameters(remove_duplicate=False)), tuple(self.model.named_buffers(remove_duplicate=False))
            _require(len(named) == len(self._graph) and all(n == old and p is ref
                     for (n, p), (old, ref) in zip(named, self._graph)), "parameter graph changed")
            _require(len(buffers) == len(self._buffers) and all(n == old and b is ref
                     for (n, b), (old, ref) in zip(buffers, self._buffers)), "buffer graph changed")
            _require(tuple(_signature(p) for _, p in named) == self._versions
                     and tuple(_signature(b) for _, b in buffers) == self._buffer_versions,
                     "parameter/buffer identity or version changed")
            _require(all(p.grad is grad and (grad is None or _signature(grad) == signature)
                     for (_, p), (grad, signature) in zip(named, self._existing_gradients)), "original parameter grad changed")
            modes = tuple(self.model.named_modules(remove_duplicate=False))
            _require(len(modes) == len(self._modes) and all(n == old and m is ref and m.training == flag
                     for (n, m), (old, ref, flag) in zip(modes, self._modes)), "module graph/mode changed")
            _require(self.model.get_submodule(TARGET_MODULE) is self.module and self._config() == self._configuration
                     and _sha(self.module.weight) == self._weight_sha, "convolution instance/configuration/weight bytes changed")
            _require(_sha(torch.random.get_rng_state()) == self._cpu_rng_sha, "CPU RNG changed")
            if self._cuda_rng_sha is not None:
                _require(torch.cuda.is_initialized() and _sha(torch.cuda.get_rng_state(self.device)) == self._cuda_rng_sha,
                         "CUDA RNG changed")
            for reference, signature, _ in self._sources:
                source = reference()
                if source is not None:
                    _require(_signature(source) == signature, "observed tensor identity/layout/version changed")
            if self._input_ref is not None:
                source = self._input_ref()
                if source is not None:
                    _require(_sha(source[:, INPUT_CHANNEL:INPUT_CHANNEL + 1]) == self._descriptors["input"]["sha256"],
                             "shared input plane bytes changed")
            if self._output_ref is not None:
                output = self._output_ref()
                if output is not None:
                    _require(_signature(output) == self._output_signature, "target output identity/layout/version changed")
        finally:
            self._checking = False

    def _clone(self, key, source, channel=None):
        _tensor(source, device=self.device)
        signature, source_storage = _signature(source), _storage(source)
        _require(source_storage not in {_storage(p) for _, p in self._graph}
                 and source_storage not in {_storage(b) for _, b in self._buffers}, "capture aliases model state")
        output = None if self._output_ref is None else self._output_ref()
        _require(output is None or source_storage != _storage(output), "capture aliases forward output")
        for reference, _, _ in self._sources:
            other = reference()
            _require(other is None or source_storage != _storage(other), "capture source storage alias")
        selected = source if channel is None else source[:, channel:channel + 1]
        size = selected.numel() * selected.element_size()
        _require(self.used + size <= self.maximum, "capture budget exceeded before copy")
        result = selected.detach().to(device="cpu", copy=True, memory_format=torch.contiguous_format)
        _require(_signature(source) == signature, "source changed during CPU copy")
        _require(result.device.type == "cpu" and result.is_contiguous() and not result.requires_grad
                 and _storage(result) != source_storage and result.untyped_storage().nbytes() == size,
                 "independent compact CPU copy required")
        self.used += size
        self._sources.append((weakref.ref(source), signature, key))
        self._descriptors[key] = dict(bytes=size, shape=list(result.shape), sourceShape=list(source.shape),
            sourceStride=list(source.stride()), sourceVersion=source._version, dtype=str(result.dtype), device="cpu",
            sourceDevice=str(source.device), selectedChannel=channel, sha256=_sha(result))
        return result

    def __enter__(self):
        _require(not self._entered and not self._closed, "observer is single-use")
        self._check()
        self._entered = True
        self._handles.append(self.module.register_forward_hook(self._forward))
        return self

    def _forward(self, module, args, output):
        self._check()
        _require(module is self.module and self._forwards == 0 and len(args) == 1, "repeated or wrong target forward")
        value = _tensor(args[0], device=self.device, contiguous=True)
        _tensor(output, device=self.device, contiguous=True)
        spatial = self._spatial()
        _require(tuple(value.shape) == (1, 144, *spatial) and tuple(output.shape) == (1, 48, *spatial)
                 and output.requires_grad, "exact target N1/input/output spatial geometry required")
        _require(_storage(value) != _storage(output), "target input/output alias")
        proposed = 6 * math.prod(spatial) * 4 + 5 * math.prod(TARGET_SHAPE) * 4
        _require(self.used + proposed <= self.maximum, "capture budget exceeded before first copy")
        self._forwards = 1
        self._input_ref, self._output_ref = weakref.ref(value), weakref.ref(output)
        self._output_signature, self._output_shape = _signature(output), tuple(output.shape)
        self._input = self._clone("input", value, INPUT_CHANNEL)
        self._handles.append(output.register_hook(self._adjoint))
        return None

    def _adjoint(self, value):
        self._check()
        _require(self._active is not None and self._active not in self._adjoints, "missing/repeated adjoint label")
        _require(tuple(value.shape) == self._output_shape, "adjoint shape differs")
        self._adjoints[self._active] = self._clone("adjoint." + self._active, value, OUTPUT_CHANNEL)
        return None

    def gradient_event(self, stage, label, raw):
        _require(self._entered and not self._closed, "observer not active")
        self._check()
        _require(self._forwards == 1, "same target output invocation required")
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
            _require(tuple(raw[TARGET_INDEX].shape) == TARGET_SHAPE, "target native gradient shape differs")
            self._gradients[label] = self._clone("gradient." + label, raw[TARGET_INDEX])
            self._active = None

    __call__ = gradient_event

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
                error.parameter48_observation_error = str(secondary)
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
        captured = {"input": self._input, **{"adjoint." + k: v for k, v in self._adjoints.items()},
                    **{"gradient." + k: v for k, v in self._gradients.items()}}
        for key, value in captured.items():
            _require(_sha(value) == self._descriptors[key]["sha256"], "captured tensor bytes changed")
        return dict(input_tensor=self._input, adjoints=tuple(self._adjoints[k] for k in LABELS),
            native_gradients=tuple(self._gradients[k] for k in LABELS), convolution=dict(self.convolution),
            metadata=dict(schemaVersion="parameter48-causal-observation-v1", labels=list(LABELS),
                parameterIndex=TARGET_INDEX, parameterName=TARGET_NAME, weightSha256=self._weight_sha,
                currentInstanceVersion=self._versions[TARGET_INDEX][5], targetForwards=self._forwards,
                objectiveCaptures=len(self._gradients), captureBytes=self.used, metadataReserveBytes=METADATA_RESERVE,
                coordinates=[list(v) for v in COORDINATES], inputChannel=INPUT_CHANNEL, outputAdjointChannel=OUTPUT_CHANNEL,
                productionGeometryVerified=type(self) is Parameter48Observer and tuple(self._input.shape[2:]) == PRODUCTION_SPATIAL,
                descriptors=deepcopy(self._descriptors), cpuRngSha256=self._cpu_rng_sha, cudaRngSha256=self._cuda_rng_sha,
                releasedSources=[key for reference, _, key in self._sources if reference() is None],
                sourceVersionScope="copy_interval_and_subsequent_checks_while_original_source_is_alive",
                meaning="selected_plane_observation_only_not_authenticated_gate_or_historical_replay"))


class Parameter48Observer(_PlaneObserver):
    """Production observer: fixed actual N1/192x256 geometry, no test-mode flag."""
    def _spatial(self):
        return PRODUCTION_SPATIAL


def _planes(input_tensor, adjoints, native_gradients, convolution):
    _convolution(convolution)
    _require(type(adjoints) in (tuple, list) and type(native_gradients) in (tuple, list)
             and len(adjoints) == len(native_gradients) == 5, "five ordered target gradients/adjoints required")
    _tensor(input_tensor, device=torch.device("cpu"), contiguous=True)
    _require(input_tensor.ndim == 4 and tuple(input_tensor.shape[:2]) == (1, 1)
             and 0 < input_tensor.shape[2] <= 192 and 0 < input_tensor.shape[3] <= 256, "selected input plane shape differs")
    seen = set()
    for value in (input_tensor, *adjoints, *native_gradients):
        _tensor(value, device=torch.device("cpu"), contiguous=True)
        _require(not value.requires_grad and value.untyped_storage().nbytes() == value.numel() * 4, "compact detached CPU evidence required")
        storage = _storage(value)
        _require(storage not in seen, "retained evidence storage alias")
        seen.add(storage)
    _require(all(tuple(v.shape) == tuple(input_tensor.shape) for v in adjoints), "selected adjoint plane shape differs")
    _require(all(tuple(v.shape) == TARGET_SHAPE for v in native_gradients), "native target gradient shape differs")
    retained = METADATA_RESERVE + sum(v.numel() * 4 for v in (input_tensor, *adjoints, *native_gradients))
    # Includes FP64 selected planes/products, Python float/list storage with a
    # conservative 64-byte slot allowance, and the small returned vectors.
    workspace = input_tensor.numel() * (8 * 8 + 64) + 65536
    _require(retained + workspace <= MAX_CAPTURE_BYTES, "local reference working budget exceeded")
    return retained, workspace


def _selected_reference(input_tensor, adjoint, resource):
    spatial = tuple(input_tensor.shape[2:])
    height, width = spatial
    x = input_tensor[0, 0].to(torch.float64)
    dy = adjoint[0, 0].to(torch.float64)
    values = []
    for _, _, ky, kx in COORDINATES:
        if resource is not None:
            resource()
        h0, h1 = max(0, 1 - ky), min(height, height + 1 - ky)
        w0, w1 = max(0, 1 - kx), min(width, width + 1 - kx)
        products = dy[h0:h1, w0:w1] * x[h0 + ky - 1:h1 + ky - 1, w0 + kx - 1:w1 + kx - 1]
        value = math.fsum(products.reshape(-1).tolist())
        _require(math.isfinite(value), "local FP64 reference nonfinite")
        values.append(value)
    return torch.tensor(values, dtype=torch.float64)


def _adjoint_summary(adjoints, resource):
    digest = hashlib.sha256()
    minimum, maximum, absolute, nonzero, equal = math.inf, -math.inf, 0.0, 0, True
    height, width = adjoints[0].shape[2:]
    for h in range(height):
        if resource is not None and h % 16 == 0:
            resource()
        rows = [v[0, 0, h].tolist() for v in adjoints]
        differences = [rows[0][w] - math.fsum(row[w] for row in rows[1:]) for w in range(width)]
        digest.update(struct.pack("<" + "d" * width, *differences))
        minimum, maximum = min(minimum, min(differences)), max(maximum, max(differences))
        absolute = max(absolute, max(abs(v) for v in differences))
        nonzero += sum(v != 0 for v in differences)
        ordered = ((adjoints[1][0, 0, h] + adjoints[2][0, 0, h]) + adjoints[3][0, 0, h]) + adjoints[4][0, 0, h]
        equal = equal and torch.equal(adjoints[0][0, 0, h].view(torch.uint8), ordered.view(torch.uint8))
    return dict(shape=list(adjoints[0].shape), dtype="torch.float64", sha256=digest.hexdigest(), maximumAbsolute=absolute,
                minimumSigned=minimum, maximumSigned=maximum, nonzeroElements=nonzero,
                meaning="selected_output_channel_observed_adjoint_difference_not_whole_model_reference"), equal


def decompose_target_gradients(input_tensor, adjoints, native_gradients, *, convolution, resource=None, on_reference=None):
    """Five two-coordinate CPU references; never authenticate a gate or start one.

    Small actual plane sizes are supported only as pure synthetic arithmetic;
    their summary explicitly fails the production spatial-shape condition.
    The public observer has no such relaxation. The worker owns non-reproduction
    handling and MUST preserve/authenticate its first error before calling here.
    """
    _require(resource is None or callable(resource), "resource callback invalid")
    _require(on_reference is None or callable(on_reference), "reference callback invalid")
    retained, workspace = _planes(input_tensor, adjoints, native_gradients, convolution)
    signatures = tuple(_signature(v) for v in (input_tensor, *adjoints, *native_gradients))
    hashes = tuple(_sha(v) for v in (input_tensor, *adjoints, *native_gradients))
    references = []
    with torch.no_grad():
        for label, value in zip(LABELS, adjoints):
            if resource is not None:
                resource()
            if on_reference is not None:
                on_reference("attempt", label)
            references.append(_selected_reference(input_tensor, value, resource))
            if on_reference is not None:
                on_reference("complete", label)
            if resource is not None:
                resource()
        references = tuple(references)
        native = tuple(torch.tensor([float(v[c]) for c in COORDINATES], dtype=torch.float32) for v in native_gradients)
        A = native[0].double()
        E32 = ((native[1] + native[2]) + native[3]) + native[4]
        _require(bool(torch.isfinite(E32).all()), "selected native FP32 component sum nonfinite")
        E, T = E32.double(), references[0]
        S = torch.tensor([math.fsum(float(v[i]) for v in references[1:]) for i in range(2)], dtype=torch.float64)
        B = torch.tensor([math.fsum(float(v[i]) for v in native[1:]) for i in range(2)], dtype=torch.float64)
        upstream, total_reduction, component_reduction, rounding = T - S, A - T, B - S, B - E
        difference = A - E
        residual = difference - (((upstream + total_reduction) - component_reduction) + rounding)
        adjoint_summary, adjoint_equal = _adjoint_summary(adjoints, resource)
        comparisons = []
        for label, original, reference in zip(LABELS, native, references):
            rounded = reference.float()
            _require(bool(torch.isfinite(rounded).all()), "reference FP32 rounding nonfinite")
            comparisons.append(dict(label=label, rounding="single_fp64_to_fp32", comparedCoordinates=2,
                outsideToleranceElements=int((~torch.isclose(original, rounded, atol=ATOL, rtol=RTOL)).count_nonzero()),
                maximumAbsoluteDifference=float((original.double() - rounded.double()).abs().max())))
        outside = ~torch.isclose(native[0], E32, atol=ATOL, rtol=RTOL)
        summary = dict(schemaVersion="parameter48-local-decomposition-v1", labels=list(LABELS),
            meaning="two_coordinate_pure_arithmetic_not_authenticated_gate_or_causal_qualification",
            formula="A-E=(T-S)+(A-T)-(B-S)+(B-E)", coordinates=[list(c) for c in COORDINATES], referenceVjpCount=5,
            spatialMatchesProduction=tuple(input_tensor.shape[2:]) == PRODUCTION_SPATIAL,
            referenceMethod="CPU_FP64_products_of_observed_FP32_values_then_math.fsum",
            scope="selected_two_weights_only_not_full_weight_or_model_FP64", maximumResidual=float(residual.abs().max()),
            retainedCaptureBytes=retained, referenceWorkingBytesUpperBound=workspace,
            upstreamAdjointDifferenceSummary=adjoint_summary, upstreamAdjointBytesEqual=adjoint_equal,
            referenceFp32Comparisons=comparisons,
            originalFp32Comparison=dict(atol=ATOL, rtol=RTOL, comparedCoordinates=2,
                order="(((structured.float()+whole.float()).float()+core.float()).float()+support.float())",
                outsideToleranceElements=int(outside.count_nonzero()), selectedCoordinatesOutsideTolerance=outside.tolist(),
                maximumAbsoluteDifference=float(difference.abs().max())))
    if resource is not None:
        resource()
    _require(tuple(_signature(v) for v in (input_tensor, *adjoints, *native_gradients)) == signatures
             and tuple(_sha(v) for v in (input_tensor, *adjoints, *native_gradients)) == hashes,
             "local reference input identity/version/bytes changed")
    return dict(**summary, summary=deepcopy(summary), referenceGradients=references,
        terms=dict(upstream=upstream, totalNativeReduction=total_reduction, componentNativeReduction=component_reduction,
                   fp32ComponentSumRounding=rounding), observedDifference=difference, residual=residual)

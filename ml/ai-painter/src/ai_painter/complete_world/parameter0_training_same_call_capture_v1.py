"""Fixed training target0 G-call capture; no execution, local reference or file writer.

No local reference, optimizer or training registration. Every context ends before
a G commit. Same-call sealing proves observed object/code/traceback relationships,
not the authority of caller-supplied Run/sample labels or production integration.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import io
import json
import math
from pathlib import Path
import re
import random
import struct
import types
import uuid
import weakref

import torch
import numpy as np
from torch import nn
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate_module
from ai_painter.complete_world import object_decode1_entry_joint_priority_device_v1 as device_bridge
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as model_identity

ROOT = Path(__file__).absolute().parents[5]
SOURCE_BINDINGS = (
    ("ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_cpu_v1.py", "99c437fe1cdf31229257c25716736e3c2f580a58f99fde8297c5e06611920324"),
    ("ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_cpu_v1.py", "d2d3238be5e3baab321dce0d697d70723cc69c622c361cc8fe215560f8e1e67c"),
    ("ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_entry_weight_precision_v1.py", "3c8934c330b9a414a061baf08709a7d3fb9f87336962e503c3bbfccdd4e66873"),
    ("ml/ai-painter/src/ai_painter/complete_world/object_decode1_entry_joint_priority_device_v1.py", "4387b21e1d11e1a834e98c0a2b1fdf1508135664cb858360db561bd7ffda033e"),
)
SIDECAR_MAXIMUM = 2097152
AGGREGATE_FAILURE_MAXIMUM = 67108864
EXECUTION_MAXIMUM = 134217728
FAILURE_RESERVE = 65536
_PACKETS = weakref.WeakKeyDictionary()
_ACTIVE = weakref.WeakKeyDictionary()


def is_resource_failure(error):
    """Propagation marker only, never an execution or evidence credential."""
    return getattr(error, "parameter0_capture_resource_failure", False) is True


def _backend():
    """Read operator-specific metadata; never infer or modify numerical policy."""
    value = dict(schemaVersion="operator-specific-backend-observation-v1",
        cudnnEnabled=torch.backends.cudnn.enabled,
        cudnnBenchmark=torch.backends.cudnn.benchmark,
        cudnnDeterministic=torch.backends.cudnn.deterministic,
        deterministicAlgorithms=torch.are_deterministic_algorithms_enabled(),
        cudnnConvFp32Precision=torch.backends.cudnn.conv.fp32_precision,
        cudnnRnnFp32Precision=torch.backends.cudnn.rnn.fp32_precision,
        cudaMatmulFp32Precision=torch.backends.cuda.matmul.fp32_precision)
    for key in ("cudnnEnabled", "cudnnBenchmark", "cudnnDeterministic", "deterministicAlgorithms"):
        _require(type(value[key]) is bool, "backend observation boolean invalid: " + key)
    for key in ("cudnnConvFp32Precision", "cudnnRnnFp32Precision", "cudaMatmulFp32Precision"):
        _require(type(value[key]) is str and value[key] in ("none", "ieee", "tf32", "bf16"),
                 "backend observation precision invalid: " + key)
    return value


def _host_rng():
    value = np.random.get_state()
    return hashlib.sha256(repr((random.getstate(), value[0], value[1].tolist(), *value[2:])).encode()).hexdigest()


def required_source_bindings():
    return [dict(path=path, sha256=sha) for path, sha in SOURCE_BINDINGS]


def _json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _code_identity(code):
    return (code.co_code, tuple(_code_identity(v) if isinstance(v, types.CodeType) else v for v in code.co_consts),
            code.co_names, code.co_varnames, code.co_freevars, code.co_cellvars, code.co_argcount,
            code.co_posonlyargcount, code.co_kwonlyargcount, code.co_nlocals, code.co_stacksize,
            code.co_flags, code.co_firstlineno, code.co_linetable, code.co_exceptiontable,
            code.co_name, code.co_qualname, code.co_filename)


def _nested_code(code, name):
    for value in code.co_consts:
        if isinstance(value, types.CodeType):
            if value.co_qualname == name:
                return value
            try:
                return _nested_code(value, name)
            except ValueError:
                pass
    raise ValueError("bound code definition absent: " + name)


def _verified_sources(bindings):
    _require(type(bindings) in (list, tuple) and len(bindings) <= 256, "bounded source bindings required")
    _require(all(type(b) is dict and set(b) == {"path", "sha256"} for b in bindings), "exact source binding fields")
    _require(len({b["path"] for b in bindings}) == len(bindings), "duplicate source path")
    indexed = {b["path"]: b["sha256"] for b in bindings}
    raw = {}
    for logical, sha in SOURCE_BINDINGS:
        _require(indexed.get(logical) == sha, "required source binding differs: " + logical)
        source = ROOT / logical
        for part in (source, *source.parents):
            info = part.lstat()
            _require(not part.is_symlink() and not (getattr(info, "st_file_attributes", 0) & 0x400), "source redirection")
        value = source.read_bytes()
        _require(len(value) <= 1048576 and hashlib.sha256(value).hexdigest() == sha, "bound source bytes differ")
        raw[logical] = value
    for function, logical in (
        (gate_module.apply_object_joint_rgb_structure_priority_update_cpu, SOURCE_BINDINGS[0][0]),
        (gate_module.require, SOURCE_BINDINGS[1][0]),
        (model_identity.validate_model_identity, SOURCE_BINDINGS[2][0]),
        (device_bridge.compute_generator_candidate_gradients, SOURCE_BINDINGS[3][0]),
    ):
        _require(Path(function.__code__.co_filename).absolute() == ROOT / logical, "loaded source origin differs")
        compiled = compile(raw[logical], function.__code__.co_filename, "exec", dont_inherit=True)
        _require(_code_identity(function.__code__) == _code_identity(_nested_code(compiled, function.__qualname__)),
                 "loaded bound code differs")
    return required_source_bindings()


class _SealedCapture:
    __slots__ = ("__weakref__",)
    def __new__(cls):
        raise TypeError("only an authenticated same-call failure can seal capture")


def _issue_packet(metadata, tensors):
    descriptors, pieces, offset = {}, [], 0
    for name, value in tensors.items():
        _tensor(value, device=torch.device("cpu"), contiguous=True)
        _require(not value.requires_grad and value.untyped_storage().nbytes() == value.numel()*4, "compact detached sealed tensor")
        raw = value.reshape(-1).view(torch.uint8).numpy().tobytes()
        descriptors[name] = dict(shape=list(value.shape), dtype="torch.float32", offset=offset,
                                 bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
        pieces.append(raw)
        offset += len(raw)
    metadata = {**metadata, "tensors": descriptors}
    header = _json(metadata)
    _require(len(header) <= METADATA_RESERVE and 12 + len(header) + offset <= SIDECAR_MAXIMUM - 4*FAILURE_RESERVE,
             "sealed sidecar must leave aggregate manifests and terminal reserve within 2MiB")
    # Tensor copies, immutable pieces, serialization buffer and one largest
    # transient piece may coexist. This is an owned workspace bound, not RSS.
    workspace_bound = 3*offset + 3*len(header) + max(map(len, pieces), default=0) + 12
    _require(workspace_bound <= MAX_CAPTURE_BYTES, "encoding workspace exceeded")
    token = object.__new__(_SealedCapture)
    _PACKETS[token] = (header, tuple(pieces))
    return token


def encode_capture(packet, *, original_failure_parts, execution_parts):
    """Consume a private seal. Inputs are actual existing bytes, never free-space booleans.

    execution_parts excludes the existing failure parts and this new sidecar.
    No claim is made about files not supplied here or an unintegrated writer.
    """
    _require(type(packet) is _SealedCapture and packet in _PACKETS, "private live sealed packet required")
    def measured(parts):
        _require(type(parts) in (list, tuple) and len(parts) <= 256 and
                 all(type(v) is bytes for v in parts), "actual immutable serialized byte parts required")
        return sum(map(len, parts))
    failure_bytes, other_bytes = measured(original_failure_parts), measured(execution_parts)
    header, pieces = _PACKETS.pop(packet)
    class Bounded(io.BytesIO):
        def write(self, raw):
            _require(self.tell()+len(raw) <= SIDECAR_MAXIMUM, "actual encoded sidecar exceeds 2MiB")
            return super().write(raw)
    stream = Bounded()
    stream.write(b"P0SC1\0\0\0")
    stream.write(struct.pack("<I", len(header)))
    stream.write(header)
    for raw in pieces:
        stream.write(raw)
    encoded = stream.getvalue()
    target_reserved = len(encoded) + 4*FAILURE_RESERVE
    _require(target_reserved <= SIDECAR_MAXIMUM, "aggregate target sidecar reserve exceeds 2MiB")
    failure_total = failure_bytes + target_reserved
    execution_total = other_bytes + failure_total
    _require(failure_total <= AGGREGATE_FAILURE_MAXIMUM, "actual aggregate failure exceeds 64MiB including reserve")
    _require(execution_total <= EXECUTION_MAXIMUM, "actual execution exceeds 128MiB including reserve")
    return dict(bytes=encoded, sha256=hashlib.sha256(encoded).hexdigest(), metadata=json.loads(header),
                accounting=dict(sidecarBytes=len(encoded), targetBytesIncludingManifestAndTerminalReserve=target_reserved,
                    manifestAndTerminalReserveBytes=4*FAILURE_RESERVE, existingFailureBytes=failure_bytes,
                    otherExecutionBytes=other_bytes, failureReserveBytes=FAILURE_RESERVE,
                    aggregateFailureBytesIncludingReserve=failure_total, executionBytesIncludingReserve=execution_total,
                    productionWriterVerified=False))

LABELS = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
TARGET_INDEX = 0
TARGET_NAME = "core.core.terrain.base_stem.layers.0.weight"
TARGET_MODULE = TARGET_NAME.removesuffix(".weight")
TARGET_SHAPE = (48, 31, 3, 3)
COORDINATES = ((1, 13, 0, 0),)
INPUT_CHANNEL, OUTPUT_CHANNEL = 13, 1
METADATA_RESERVE = 65536
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
             and type(value["groups"]) is int and value["groups"] == 1, "parameter0 convolution geometry differs")


class _StepObserver:
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
                 "exact parameter0 convolution binding required")
        _require(self.module.in_channels == 31 and self.module.out_channels == 48
                 and _pair(self.module.kernel_size) == (3, 3) and self.module.padding_mode == "zeros",
                 "parameter0 channels/kernel/zero padding differ")
        _require(type(self.module.bias) is nn.Parameter and tuple(self.module.bias.shape) == (48,)
                 and getattr(self.module.forward, "__func__", None) is nn.Conv2d.forward
                 and getattr(self.module._conv_forward, "__func__", None) is nn.Conv2d._conv_forward,
                 "original native convolution methods/bias required")
        self.convolution = dict(weight_shape=TARGET_SHAPE, stride=_pair(self.module.stride),
                                padding=_pair(self.module.padding), dilation=_pair(self.module.dilation), groups=self.module.groups)
        _convolution(self.convolution)
        self._configuration = self._config()
        self._weight_sha = _sha(self.module.weight)
        self._state_hashes = tuple(_sha(v) for _,v in (*self._graph,*self._buffers))
        self._state_sha = hashlib.sha256(_json(list(zip(
            [n for n,_ in (*self._graph,*self._buffers)], self._state_hashes)))).hexdigest()
        spatial = self._spatial()
        capture_payload = 6*math.prod(spatial)*4 + 6*math.prod(TARGET_SHAPE)*4
        largest_state = max((v.numel()*v.element_size() for _,v in (*self._graph,*self._buffers)), default=0)
        # Conservatively cover model hashing/copy temporaries, source finite
        # masks, ordered target sums, owned compact values and metadata.
        self._workspace_bound = (6*largest_state + 2*48*math.prod(spatial) + capture_payload
                                 + 3*math.prod(TARGET_SHAPE)*4 + 4*METADATA_RESERVE)
        _require(self._workspace_bound <= MAX_CAPTURE_BYTES, "capture and verification workspace exceeded")
        self._host_rng_sha = _host_rng()
        self._backend_at_forward = None
        self._backend_at_gradients = []
        self._cpu_rng_sha = _sha(torch.random.get_rng_state())
        _require(self.device.type != "cuda" or torch.cuda.is_initialized(), "observer cannot initialize CUDA")
        self._cuda_rng_sha = _sha(torch.cuda.get_rng_state(self.device)) if self.device.type == "cuda" else None

    def _config(self):
        return (self.module.in_channels, self.module.out_channels, self.module.kernel_size, self.module.stride,
                self.module.padding, self.module.dilation, self.module.groups, self.module.padding_mode, id(self.module.bias),
                getattr(self.module.forward, "__func__", None), getattr(self.module._conv_forward, "__func__", None))

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
            _require(_host_rng() == self._host_rng_sha, "Python/NumPy RNG changed")
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
        value = _tensor(args[0], device=self.device)
        _tensor(output, device=self.device)
        spatial = self._spatial()
        _require(tuple(value.shape) == (1, 31, *spatial) and tuple(output.shape) == (1, 48, *spatial)
                 and output.requires_grad, "exact target N1/input/output spatial geometry required")
        _require(_storage(value) != _storage(output), "target input/output alias")
        proposed = 6 * math.prod(spatial) * 4 + 5 * math.prod(TARGET_SHAPE) * 4
        _require(self.used + proposed <= self.maximum, "capture budget exceeded before first copy")
        self._forwards = 1
        self._backend_at_forward = _backend()
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
            _require(tuple(raw[TARGET_INDEX].shape) == TARGET_SHAPE and not raw[TARGET_INDEX].requires_grad,
                     "target native gradient shape/detachment differs")
            self._gradients[label] = self._clone("gradient." + label, raw[TARGET_INDEX])
            self._backend_at_gradients.append(dict(label=label, settings=_backend()))
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
                error.parameter0_observation_error = str(secondary)
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
            metadata=dict(schemaVersion="parameter0-training-same-call-observation-v1", labels=list(LABELS),
                parameterIndex=TARGET_INDEX, parameterName=TARGET_NAME, weightSha256=self._weight_sha,
                currentInstanceVersion=self._versions[TARGET_INDEX][5], targetForwards=self._forwards,
                objectiveCaptures=len(self._gradients), captureBytes=self.used, metadataReserveBytes=METADATA_RESERVE,
                coordinates=[list(v) for v in COORDINATES], inputChannel=INPUT_CHANNEL, outputAdjointChannel=OUTPUT_CHANNEL,
                productionGeometryVerified=type(self) is Parameter0TrainingSameCallCapture and tuple(self._input.shape[2:]) == PRODUCTION_SPATIAL,
                descriptors=deepcopy(self._descriptors), cpuRngSha256=self._cpu_rng_sha, cudaRngSha256=self._cuda_rng_sha,
                pythonNumpyRngSha256=self._host_rng_sha, backendAtForward=self._backend_at_forward,
                backendAtGradientCompletions=deepcopy(self._backend_at_gradients),
                modelStateBeforeSha256=self._state_sha, modelStateAfterSha256=self._state_sha,
                modelStateVerifiedUnchanged=True,
                moduleModes=[dict(name=name, training=flag) for name, _, flag in self._modes],
                captureAndVerificationWorkspaceBoundBytes=self._workspace_bound,
                releasedSources=[key for reference, _, key in self._sources if reference() is None],
                sourceVersionScope="copy_interval_and_subsequent_checks_while_original_source_is_alive",
                meaning="selected_plane_observation_only_not_authenticated_gate_or_historical_replay"))


class Parameter0TrainingSameCallCapture(_StepObserver):
    """One explicit G phase. Instrumentation failure never replaces the original error."""
    def _spatial(self):
        return PRODUCTION_SPATIAL

    def _validate_model_identity(self, model):
        # The bound training path already performs full model admission. Do not
        # call its cached reference factory here: a cache miss could build a model.
        # This component independently checks exact type/identity and the supplied
        # authenticated full graph; the original bridge/gate still validates it.
        _require(type(model) is model_identity.Decode2OutputWeightPrecisionEcologyRenderer
            and model.capability_version == model_identity.RGB_OUTPUT_CAPABILITY
            and model.architecture_id == model_identity.RGB_OUTPUT_ARCHITECTURE
            and model.numeric_rule == model_identity.RGB_OUTPUT_RULE
            and model.execution_qualified is False and model.parent_checkpoint_loaded is False,
            "exact current RGB model required")

    def _validate_graph(self, graph, actual):
        _require(type(graph) is list and graph == actual and len(graph) == 108 and
                 sum(p["elements"] for p in graph) == 2242687, "actual complete108 graph binding differs")

    def __init__(self, model, *, identity, graph, source_bindings, phase="generator", resource=None,
                 max_capture_bytes=MAX_CAPTURE_BYTES):
        _require(phase == "generator", "explicit generator phase required")
        self._source_bindings = _verified_sources(source_bindings)
        self._validate_model_identity(model)
        named = tuple(model.named_parameters(remove_duplicate=False))
        actual = [dict(name=n, shape=list(v.shape), dtype=str(v.dtype), elements=v.numel()) for n,v in named]
        self._validate_graph(graph, actual)
        _require(type(identity) is dict and set(identity) == {"runId", "packageId", "sampleId", "epoch",
                 "zeroBasedEpochPosition", "trainIndex", "optimizerSteps", "modelBinding"}, "exact step identity fields")
        _require(all(type(identity[k]) is str and 0 < len(identity[k]) <= 256 for k in ("runId","packageId","sampleId")),
                 "bounded step labels required")
        _require(all(type(identity[k]) is int and identity[k] >= 0 for k in ("epoch","zeroBasedEpochPosition","trainIndex")),
                 "integer step positions required")
        _require(type(identity["optimizerSteps"]) is dict and set(identity["optimizerSteps"]) == {"generator","discriminator"} and
                 all(type(v) is int and v >= 0 for v in identity["optimizerSteps"].values()), "integer update counts required")
        binding = identity["modelBinding"]
        _require(type(binding) is dict and set(binding) == {"path","sha256"} and type(binding["path"]) is str and
                 type(binding["sha256"]) is str and re.fullmatch("[a-f0-9]{64}", binding["sha256"]), "model binding labels required")
        self._identity = json.loads(_json(identity))
        self._graph_sha = hashlib.sha256(_json(graph)).hexdigest()
        self.packet, self.outcome = None, dict(status="not_entered")
        self._call_id = uuid.uuid4().hex
        self._bound_resource, self._resource_failure = resource, None
        self._entry_unavailable = False
        self._entry_reason = None
        super().__init__(model, max_capture_bytes=max_capture_bytes, resource=self._resource_guard)

    def _resource_guard(self):
        if self._resource_failure is not None:
            raise self._resource_failure
        if self._bound_resource is not None:
            try:
                self._bound_resource()
            except BaseException as error:
                self._resource_failure = error
                try: error.parameter0_capture_resource_failure = True
                except BaseException: pass
                raise

    def __enter__(self):
        _require(not self._entered and not self._closed, "G context is single-use")
        try:
            _require(torch.is_grad_enabled(), "G context must enter with gradients enabled")
            _require(self.model not in _ACTIVE, "one active G-step context per model")
            super().__enter__()
        except BaseException as secondary:
            safety = secondary is self._resource_failure or not isinstance(secondary, Exception)
            resource = self._bound_resource
            self._entry_unavailable = True
            self._entry_reason = str(secondary)[:2048]
            cleanup = self._release()
            self._bound_resource = resource
            self.outcome = dict(status="same_call_capture_unavailable", reason=self._entry_reason, cleanupErrors=cleanup)
            if safety:
                self._bound_resource = None
                raise
            return self
        _ACTIVE[self.model] = weakref.ref(self)
        self.outcome = dict(status="observing_one_g_call")
        return self

    def _protect(self, action, *args):
        if self._entry_unavailable:
            self._resource_guard()
            return None
        if self._observation_error is None:
            try:
                action(*args)
            except BaseException as secondary:
                if secondary is self._resource_failure or not isinstance(secondary, Exception):
                    raise
                self._observation_error = str(secondary)[:2048]
        else:
            self._resource_guard()
        return None

    def _forward(self, *args):
        return self._protect(super()._forward, *args)

    def _adjoint(self, *args):
        return self._protect(super()._adjoint, *args)

    def gradient_event(self, *args):
        return self._protect(super().gradient_event, *args)

    __call__ = gradient_event

    def _authenticate(self, error, evidence):
        _require(type(error) is ValueError and str(error) ==
                 "actual four-term total gradient identity differs at parameter 0", "not original target0 error")
        _verified_sources(self._source_bindings)
        frames, tb = [], error.__traceback__
        while tb is not None:
            frames.append(tb)
            tb = tb.tb_next
        gate = gate_module.apply_object_joint_rgb_structure_priority_update_cpu
        hits = [t for t in frames if t.tb_frame.f_code is gate.__code__]
        _require(len(hits) == 1 and frames[-1].tb_frame.f_code is gate_module.require.__code__, "original gate traceback differs")
        local = hits[0].tb_frame.f_locals
        _require(local.get("i") == TARGET_INDEX, "original gate target differs")
        names = ("total_gradients","structured_gradients","whole_frame_gradients","core_gradients","support_gradients")
        native = evidence["native_gradients"]
        # Direct CPU gate uses the same objects. The frozen device bridge may
        # pass CPU copies; authenticate its raw originals and actual model too.
        bridge_frames = [t for t in frames if t.tb_frame.f_code is device_bridge.compute_generator_candidate_gradients.__code__]
        if local.get("model") is self.model:
            originals = [local.get(name) for name in names]
        else:
            _require(len(bridge_frames) == 1 and bridge_frames[0].tb_frame.f_locals.get("model") is self.model,
                     "same model bridge traceback required")
            bridge = bridge_frames[0].tb_frame.f_locals
            _require(local.get("model") is bridge.get("carrier"), "same bridge carrier required")
            copied = bridge.get("copied")
            _require(type(copied) is list and len(copied) == 5 and
                     all(local.get(name) is row for name, row in zip(names, copied)),
                     "same bridge copied rows required")
            originals = bridge.get("raw")
        _require(type(originals) in (list,tuple) and len(originals) == 5, "five same-call originals required")
        retained = {key: (ref, signature) for ref,signature,key in self._sources}
        for label, name, rows, observed in zip(LABELS, names, originals, native):
            _require(type(rows) in (tuple,list) and len(rows) == 108, "same-call full108 gradients required")
            source = rows[TARGET_INDEX]
            reference, signature = retained["gradient."+label]
            _require(source is reference() and _signature(source) == signature and _sha(source) == _sha(observed),
                     "same-call gradient object/value identity differs")
            copies = local.get(name)
            _require(type(copies) in (tuple,list) and len(copies) == 108 and _sha(copies[TARGET_INDEX]) == _sha(observed),
                     "gate copied target differs")
        for name, observed in zip(("g_actual","g_s","g_w","g_c","g_support"), native):
            _require(_sha(local[name]) == _sha(observed), "normalized gate target differs")
        expected = (((native[1].float()+native[2].float()).float()+native[3].float()).float()+native[4].float())
        _require(bool(torch.isfinite(expected).all()) and _sha(expected) == _sha(local["expected"]), "original ordered gate differs")
        violating = not bool(torch.isclose(native[0], expected, atol=ATOL, rtol=RTOL)[COORDINATES[0]])
        classification = "fixed_coordinate_violating" if violating else "fixed_coordinate_not_violating"
        weight = self.module.weight.detach().to("cpu", copy=True, memory_format=torch.contiguous_format)
        _require(_sha(weight) == self._weight_sha, "target weight witness changed")
        return dict(type="ValueError", message=str(error), gateLine=hits[0].tb_lineno,
                    raiseLine=frames[-1].tb_lineno, sourceBindings=self._source_bindings,
                    verifiedGradientSets=5, fullParameterGroups=108, sameCallInputsVerified=True,
                    fixedCoordinateClassification=classification, fixedCoordinateViolating=violating,
                    referenceAllowed=False, localReferenceCalls=0,
                    selectedValues={label:float(value[COORDINATES[0]]) for label,value in zip(LABELS,native)},
                    selectedOrderedSum=float(expected[COORDINATES[0]]), originalAtol=ATOL, originalRtol=RTOL), weight

    def _release(self):
        model = self.model
        cleanup_errors = []
        for handle in reversed(self._handles):
            try:
                handle.remove()
            except BaseException as error:
                cleanup_errors.append(str(error)[:256])
        self._handles.clear()
        owner = _ACTIVE.get(model)
        if owner is not None and owner() is self:
            _ACTIVE.pop(model, None)
        self._closed = True
        for key in ("_sources","_graph","_buffers","_versions","_buffer_versions","_existing_gradients","_modes","_state_hashes"):
            setattr(self, key, ())
        self._adjoints.clear()
        self._gradients.clear()
        self._descriptors.clear()
        self._input = self._input_ref = self._output_ref = None
        self.model = self.module = self.resource = None
        self._bound_resource = self._resource_failure = None
        return cleanup_errors

    def __exit__(self, kind, error, traceback):
        if self._entry_unavailable:
            self._bound_resource = self._resource_failure = None
            return False
        propagate = None
        try:
            if self._resource_failure is not None:
                raise self._resource_failure
            if self._observation_error is not None:
                self._resource_guard()
            _require(self._observation_error is None, self._observation_error or "observation unavailable")
            self._check()
            _require(self._state_hashes == tuple(_sha(v) for _,v in (*self._graph,*self._buffers)),
                     "model state bytes changed during observation")
            self._complete()
            self._closed = True
            if error is None:
                self.outcome = dict(status="successful_g_released_without_capture")
            else:
                evidence = self.evidence()
                failure, weight = self._authenticate(error, evidence)
                metadata = dict(schemaVersion="parameter0-training-same-call-capture-v1",
                    callId=self._call_id, identity=self._identity, graphSha256=self._graph_sha,
                    target=dict(parameterIndex=0, parameterName=TARGET_NAME, shape=list(TARGET_SHAPE),
                                coordinate=[1,13,0,0], inputChannel=13, outputChannel=1),
                    originalFailure=failure, observation=evidence["metadata"],
                    originalError=dict(type=type(error).__name__, message=str(error)),
                    sourceBindings=self._source_bindings,
                    fixedCoordinateClassification=failure["fixedCoordinateClassification"],
                    fixedCoordinateViolating=failure["fixedCoordinateViolating"], referenceAllowed=False, localReferenceCalls=0,
                    productionGeometryVerified=type(self) is Parameter0TrainingSameCallCapture,
                    identityMeaning="caller_step_labels_not_execution_or_sample_authorization",
                    productionIntegrated=False, qualificationGranted=False, rootCauseProven=False)
                values = {"input":evidence["input_tensor"],
                    **{"adjoint."+k:v for k,v in zip(LABELS,evidence["adjoints"])},
                    **{"gradient."+k:v for k,v in zip(LABELS,evidence["native_gradients"])},
                    "weightWitness":weight}
                self.packet = _issue_packet(metadata, values)
                self.outcome = dict(status="sealed_same_call_target_failure", callId=self._call_id)
        except BaseException as secondary:
            self.packet = None
            self.outcome = dict(status="same_call_capture_unavailable", reason=str(secondary)[:2048],
                                originalError=None if error is None else dict(type=type(error).__name__, message=str(error)[:2048]))
            if secondary is self._resource_failure:
                self.outcome["resourceError"] = dict(type=type(secondary).__name__, message=str(secondary)[:2048])
            if error is None and (secondary is self._resource_failure or not isinstance(secondary, Exception)):
                propagate = secondary
        finally:
            cleanup = self._release()
            if cleanup:
                if self.packet is not None:
                    _PACKETS.pop(self.packet, None)
                self.packet = None
                self.outcome = dict(status="same_call_capture_unavailable", reason="hook cleanup failed", cleanupErrors=cleanup)
        if propagate is not None:
            raise propagate
        return False

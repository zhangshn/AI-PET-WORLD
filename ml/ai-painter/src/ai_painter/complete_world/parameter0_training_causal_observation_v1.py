"""Fixed-coordinate new-call observation; never a gate, restore or runner.

The worker authenticates the real original exception and persists it and the
five raw gradients before requesting the local arithmetic below. Neither this
observer nor its arithmetic claims historical replay or execution permission.
"""
from copy import deepcopy
import math
import random

import numpy as np
import torch

from ai_painter.complete_world.parameter40_qualification_observation_v1 import (
    LABELS, Target0Observation, TARGET0_NAME, TARGET0_SHAPE, TARGET0_SPATIAL,
    classified_scalar, require, sha, signature,
)

TARGET_INDEX, TARGET_NAME, TARGET_SHAPE = 0, TARGET0_NAME, TARGET0_SHAPE
TARGET_MODULE = TARGET_NAME.removesuffix(".weight")
COORDINATES = ((1, 13, 0, 0),)
PRODUCTION_SPATIAL = TARGET0_SPATIAL
MAX_CAPTURE_BYTES = 64 * 1024**2
MAX_TARGET_SIDECAR_BYTES = 2 * 1024**2
TERMINAL_RESERVE_BYTES = 65536
ATOL, RTOL = 1e-6, 1e-5


def _coordinates(value):
    require(type(value) in (tuple, list) and len(value) == 1
            and type(value[0]) in (tuple, list) and len(value[0]) == 4
            and all(type(v) is int for v in value[0]) and tuple(value[0]) == COORDINATES[0],
            "only fixed parameter0 coordinate [1,13,0,0] is allowed")
    return COORDINATES


def _tensor(value, shape=None):
    require(type(value) is torch.Tensor and value.device.type == "cpu"
            and value.dtype == torch.float32 and value.layout == torch.strided
            and not value.requires_grad, "detached CPU FP32 strided evidence required")
    require(shape is None or tuple(value.shape) == tuple(shape), "evidence shape differs")
    require(bool(torch.isfinite(value).all()), "nonfinite evidence component")


def _convolution(value):
    require(type(value) is dict and set(value) == {"weight_shape", "stride", "padding", "dilation", "groups"}
            and tuple(value["weight_shape"]) == TARGET_SHAPE and tuple(value["stride"]) == (1, 1)
            and tuple(value["padding"]) == (1, 1) and tuple(value["dilation"]) == (1, 1)
            and type(value["groups"]) is int and value["groups"] == 1, "original parameter0 convolution differs")


def _workspace_bytes(spatial):
    pixels, elements = math.prod(spatial), math.prod(TARGET_SHAPE)
    # Includes compact planes, FP64 temporaries, Python float/list slots, raw
    # comparisons, metadata and a complete bounded serialization buffer.
    return (6 * pixels * 4 + 8 * pixels * 8 + pixels * 64
            + 5 * elements * 8 + 3 * elements * 4 + 65536 + MAX_TARGET_SIDECAR_BYTES)


def _rng(device):
    state = np.random.get_state()
    numpy_state = (state[0], state[1].tobytes(), *state[2:])
    require(device.type != "cuda" or torch.cuda.is_initialized(), "observer cannot initialize CUDA")
    return (random.getstate(), numpy_state, sha(torch.random.get_rng_state()),
            sha(torch.cuda.get_rng_state(device)) if device.type == "cuda" else None)


class Parameter0Observer:
    """Exact original Target0Observation plus fixed training-event binding."""

    def __init__(self, model, *, resource=None, coordinates=COORDINATES,
                 max_capture_bytes=MAX_CAPTURE_BYTES):
        self.coordinates = _coordinates(coordinates)
        require(type(max_capture_bytes) is int and 1024**2 <= max_capture_bytes <= MAX_CAPTURE_BYTES,
                "capture budget invalid")
        require(resource is None or callable(resource), "resource callback required")
        self.model, self.resource = model, resource or (lambda: None)
        self.maximum = max_capture_bytes
        self.target_observation = Target0Observation(model, self.resource)
        self.device = self.target_observation.module.weight.device
        self.convolution = dict(weight_shape=TARGET_SHAPE, stride=(1, 1), padding=(1, 1), dilation=(1, 1), groups=1)
        self._before = self._state()
        self._rng_before = _rng(self.device)
        self._entered = self._closed = False
        self._active = None
        self._completed = []
        self._observation_error = None
        self._evidence = None
        self._captured_hashes = {}

    def _state(self):
        named = tuple(self.model.named_parameters(remove_duplicate=False))
        canonical = tuple(self.model.parameters())
        require(len(named) == len(canonical) == 108 and len({id(p) for _, p in named}) == 108
                and len({n for n, _ in named}) == 108
                and all(p is q for (_, p), q in zip(named, canonical)), "canonical108 parameter graph differs")
        buffers = tuple(self.model.named_buffers(remove_duplicate=False))
        values, storages = [], set()
        for kind, rows in (("parameter", named), ("buffer", buffers)):
            for name, value in rows:
                require(value.device == self.device and value.layout == torch.strided
                        and bool(torch.isfinite(value.detach()).all()), "state device/layout/finite differs")
                storage = (str(value.device), value.untyped_storage()._cdata)
                require(not value.numel() or storage not in storages, "state storage alias")
                storages.add(storage)
                require(kind != "parameter" or value.grad is None, "original grad fields must remain empty")
                values.append((kind, name, id(value), signature(value), sha(value)))
        module = self.target_observation.module
        require(type(module) is torch.nn.Conv2d and self.model.get_submodule(TARGET_MODULE) is module
                and named[0][0] == TARGET_NAME and named[0][1] is module.weight
                and tuple(module.weight.shape) == TARGET_SHAPE, "original native target0 identity differs")
        configuration = (module.in_channels, module.out_channels, module.kernel_size, module.stride,
                         module.padding, module.dilation, module.groups, module.padding_mode, id(module.bias))
        require(configuration[:8] == (31, 48, (3, 3), (1, 1), (1, 1), (1, 1), 1, "zeros"),
                "original target0 geometry changed")
        modes = tuple((name, id(module), module.training)
                      for name, module in self.model.named_modules(remove_duplicate=False))
        return tuple(values), modes, configuration

    def _check(self):
        self.resource()
        require(self._state() == self._before, "observation state/bytes/versions/modes/flags changed")
        require(_rng(self.device) == self._rng_before, "observation RNG changed")

    def __enter__(self):
        require(not self._entered and not self._closed, "observer single-use")
        self._check()
        full_capture = ((31 + 5 * 48) * math.prod(PRODUCTION_SPATIAL) * 4
                        + 5 * math.prod(TARGET_SHAPE) * 4 + self.target_observation.bytes)
        require(full_capture + _workspace_bytes(PRODUCTION_SPATIAL) <= self.maximum,
                "observation/reference/serialization working budget exceeded")
        self._entered = True
        self.target_observation.__enter__()
        return self

    def gradient_event(self, stage, label, raw):
        require(self._entered and not self._closed, "observer not active")
        self._check()
        target = self.target_observation
        require(target.forward_count == 1, "one actual target forward required")
        require(stage in ("attempt", "complete") and label in LABELS, "unknown gradient stage/label")
        if stage == "attempt":
            require(raw is None and self._active is None and len(self._completed) < 5
                    and label == LABELS[len(self._completed)], "duplicate/out-of-order gradient attempt")
            self._active = label
            if not self._captured_hashes:
                self._captured_hashes["input"] = sha(target.input)
            target.event(stage, "generator")
        else:
            require(self._active == label and type(raw) in (tuple, list) and len(raw) == 108,
                    "missing/out-of-order/invalid complete gradient event")
            target.event(stage, "generator", raw)
            self._captured_hashes["adjoint." + label] = sha(target.adjoints[-1])
            self._captured_hashes["gradient." + label] = sha(target.raw[-1])
            self._completed.append(label)
            self._active = None
        require(target.bytes + _workspace_bytes(PRODUCTION_SPATIAL) <= self.maximum,
                "observation/reference/serialization working budget exceeded")

    __call__ = gradient_event

    def __exit__(self, kind, error, traceback):
        failures = []
        try:
            self._check()
            require(self._active is None and tuple(self._completed) == LABELS, "five original gradient captures incomplete")
        except BaseException as secondary:
            failures.append(secondary)
        try:
            self.target_observation.__exit__(kind, error, traceback)
        except BaseException as secondary:
            failures.append(secondary)
        self._closed = True
        if self.target_observation.observation_error:
            failures.append(ValueError(self.target_observation.observation_error))
        if failures:
            self._observation_error = "; ".join(str(value) for value in failures)
            if error is not None:
                try:
                    error.parameter0_observation_error = self._observation_error
                except BaseException:
                    pass
            else:
                raise failures[0]
        return False

    def evidence(self):
        require(self._closed and self._observation_error is None, "closed complete observation required")
        self._check()
        target = self.target_observation
        target._compact_ready()
        require(self._active is None and tuple(self._completed) == LABELS, "five original captures required")
        captured = {"input": target.input, **{"adjoint." + k: v for k, v in zip(LABELS, target.adjoints)},
                    **{"gradient." + k: v for k, v in zip(LABELS, target.raw)}}
        require({k: sha(v) for k, v in captured.items()} == self._captured_hashes, "captured evidence bytes changed")
        if self._evidence is None:
            require(target.bytes + _workspace_bytes(PRODUCTION_SPATIAL) <= self.maximum, "evidence workspace budget exceeded")
            packet = target._packet(COORDINATES[0])
            descriptors = {key: dict(shape=list(value.shape), dtype=str(value.dtype), bytes=value.numel() * 4,
                                    sha256=sha(value)) for key, value in packet.items()}
            payload = sum(row["bytes"] for row in descriptors.values()) + sum(v.numel() * 4 for v in target.raw)
            require(payload + TERMINAL_RESERVE_BYTES < MAX_TARGET_SIDECAR_BYTES, "target payload leaves no terminal space")
            self._evidence = dict(input_tensor=packet["input"],
                adjoints=tuple(packet["adjoint." + k] for k in LABELS), native_gradients=tuple(target.raw),
                convolution=dict(self.convolution), metadata=dict(schemaVersion="parameter0-training-causal-observation-v1",
                    labels=list(LABELS), parameterIndex=0, parameterName=TARGET_NAME, shape=list(TARGET_SHAPE),
                    coordinates=[list(COORDINATES[0])], inputChannel=13, outputAdjointChannel=1,
                    targetForwards=1, objectiveCaptures=5, captureBytes=target.bytes,
                    combinedWorkspaceBound=target.bytes + _workspace_bytes(PRODUCTION_SPATIAL),
                    targetTensorPayloadIncludingRawDuplicate=payload, terminalReserveBytes=TERMINAL_RESERVE_BYTES,
                    productionGeometryVerified=type(target) is Target0Observation and target.spatial() == PRODUCTION_SPATIAL,
                    weightSha256=target.weight_sha, currentInstanceVersion=target.module.weight._version,
                    descriptors=descriptors, sourceVersionScope="original_observer_copy_interval",
                    meaning="new_same_call_observation_not_authenticated_gate_or_historical_replay"))
        evidence = self._evidence
        packet = {"input": evidence["input_tensor"], **{"adjoint." + k: v for k, v in zip(LABELS, evidence["adjoints"])},
                  **{"gradient." + k: v for k, v in zip(LABELS, evidence["native_gradients"])}}
        require(all(sha(v) == evidence["metadata"]["descriptors"][k]["sha256"] for k, v in packet.items()),
                "compact evidence bytes changed")
        return dict(evidence, metadata=deepcopy(evidence["metadata"]), convolution=dict(evidence["convolution"]))


def fixed_coordinate_failure(native_gradients, *, coordinates=COORDINATES):
    _coordinates(coordinates)
    require(type(native_gradients) in (tuple, list) and len(native_gradients) == 5, "five original gradients required")
    for value in native_gradients:
        _tensor(value, TARGET_SHAPE)
    a, s, w, c, support = native_gradients
    expected = ((s + w) + c) + support
    finite = bool(torch.isfinite(expected).all())
    point = COORDINATES[0]
    outside = not bool(torch.isclose(a[point], expected[point], atol=ATOL, rtol=RTOL))
    return dict(coordinates=[list(point)], componentSumFinite=finite,
        classification="ordered_component_sum_nonfinite" if not finite else "finite_tolerance_violation" if outside else "selected_coordinate_not_reproduced",
        referenceAllowed=finite and outside, referenceAllowedMeaning="numeric_condition_only_not_original_gate_authentication",
        selectedCoordinatesReproduced=finite and outside, selectedCoordinateFailureMask=[outside],
        selectedExpected=classified_scalar(expected[point]),
        selectedValues={label: classified_scalar(value[point]) for label, value in zip(LABELS, native_gradients)},
        reasonCode="ordered_component_sum_nonfinite" if not finite else "fixed_coordinate_failed" if outside else "selected_coordinate_not_reproduced",
        referenceVjpCount=0, historicalReplay=False)


def decompose_target_gradients(input_tensor, adjoints, native_gradients, *, convolution,
                              resource=None, on_reference=None, coordinates=COORDINATES):
    """At most five pure CPU references, after worker-owned gate/persistence proof."""
    _coordinates(coordinates)
    _convolution(convolution)
    require(resource is None or callable(resource), "resource callback invalid")
    require(on_reference is None or callable(on_reference), "reference callback invalid")
    fixed = fixed_coordinate_failure(native_gradients)
    require(fixed["componentSumFinite"], "ordered component sum nonfinite: zero references")
    require(fixed["selectedCoordinatesReproduced"], "fixed coordinate not reproduced: zero references")
    require(type(adjoints) in (tuple, list) and len(adjoints) == 5, "five original adjoints required")
    _tensor(input_tensor)
    require(input_tensor.ndim == 4 and tuple(input_tensor.shape[:2]) == (1, 1)
            and all(0 < n <= bound for n, bound in zip(input_tensor.shape[2:], PRODUCTION_SPATIAL)), "bounded input plane required")
    values = (input_tensor, *adjoints, *native_gradients)
    for value in adjoints:
        _tensor(value, input_tensor.shape)
    require(len({value.untyped_storage()._cdata for value in values}) == 11, "evidence storage alias")
    before = tuple((signature(value), sha(value)) for value in values)
    retained = 1024**2 + sum(value.untyped_storage().nbytes() for value in values)
    working = _workspace_bytes(tuple(input_tensor.shape[2:]))
    require(retained + working <= MAX_CAPTURE_BYTES, "local reference workspace budget exceeded")
    references = []
    height, width = input_tensor.shape[2:]
    for label, dy in zip(LABELS, adjoints):
        if resource is not None:
            resource()
        if on_reference is not None:
            on_reference("attempt", label)
        # ky=kx=0, padding=1: output[1:H,1:W] multiplies input[0:H-1,0:W-1].
        products = input_tensor[0, 0, :height - 1, :width - 1].double() * dy[0, 0, 1:, 1:].double()
        value = math.fsum(products.reshape(-1).tolist())
        require(math.isfinite(value), "local reference nonfinite")
        references.append(torch.tensor([value], dtype=torch.float64, device="cpu"))
        if on_reference is not None:
            on_reference("complete", label)
    point = COORDINATES[0]
    native = [value[point] for value in native_gradients]
    a = float(native[0])
    e = float(((native[1] + native[2]) + native[3]) + native[4])
    b = math.fsum(float(value) for value in native[1:])
    t, s = float(references[0][0]), math.fsum(float(value[0]) for value in references[1:])
    terms = dict(upstream=t - s, totalNativeReduction=a - t, componentNativeReduction=b - s,
                 fp32ComponentSumRounding=b - e)
    residual = (a - e) - ((terms["upstream"] + terms["totalNativeReduction"])
                          - terms["componentNativeReduction"] + terms["fp32ComponentSumRounding"])
    require(all(math.isfinite(v) for v in (*terms.values(), residual)), "finite local decomposition required")
    if resource is not None:
        resource()
    require(tuple((signature(value), sha(value)) for value in values) == before, "local reference changed evidence")
    summary = dict(schemaVersion="parameter0-training-local-decomposition-v1", labels=list(LABELS),
        coordinates=[list(point)], referenceVjpCount=5, localReferenceCount=5,
        referenceMethod="CPU_FP64_products_of_captured_FP32_planes_then_math.fsum",
        formula="A-E=(T-S)+(A-T)-(B-S)+(B-E)", maximumResidual=abs(residual),
        spatialMatchesProduction=tuple(input_tensor.shape[2:]) == PRODUCTION_SPATIAL,
        retainedCaptureBytes=retained, referenceWorkingBytesUpperBound=working,
        originalFp32Comparison=dict(atol=ATOL, rtol=RTOL, comparedCoordinates=1,
            selectedCoordinatesOutsideTolerance=[True], outsideToleranceElements=1,
            maximumAbsoluteDifference=abs(a - e)),
        scope="new_call_one_weight_coordinate_not_old_failure_or_full_model_root_cause", modelUpdated=False)
    return dict(**summary, summary=deepcopy(summary), referenceGradients=tuple(references),
                terms={key: torch.tensor([value], dtype=torch.float64, device="cpu") for key, value in terms.items()},
                observedDifference=torch.tensor([a - e], dtype=torch.float64, device="cpu"),
                residual=torch.tensor([residual], dtype=torch.float64, device="cpu"))

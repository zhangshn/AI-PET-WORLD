"""One-call read-only target40 capture. No runner, file I/O, optimizer or gate."""
import hashlib
import math
import torch

LABELS = ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure")
NAME = "core.core.terrain.decode_2.layers.0.weight"
SHAPE = (96, 192, 3, 3)
INDEX = 40
SPATIAL = (96, 128)
MAX_CAPTURE = 64 * 1024**2
RESERVE = 1024**2
TARGET0_NAME = "core.core.terrain.base_stem.layers.0.weight"
TARGET0_SHAPE = (48, 31, 3, 3)
TARGET0_SPATIAL = (192, 256)


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(value):
    return hashlib.sha256(value.detach().cpu().contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()).hexdigest()


def signature(value):
    storage = value.untyped_storage()
    return (id(value), storage._cdata, storage.data_ptr(), tuple(value.shape), tuple(value.stride()),
            value.storage_offset(), value.dtype, value.device, value._version, value.requires_grad)


class Target40Observation:
    """Production geometry only. All hooks return None; original gradients survive."""
    index, name, shape = INDEX, NAME, SHAPE

    def spatial(self):
        return SPATIAL

    def __init__(self, model, resource):
        self.model, self.resource = model, resource
        self.named = tuple(model.named_parameters())
        require(len(self.named) == 108 and self.named[self.index][0] == self.name
                and tuple(self.named[self.index][1].shape) == self.shape, "target40 complete parameter identity differs")
        self.module = model.get_submodule(self.name.removesuffix(".weight"))
        require(self.module.weight is self.named[self.index][1] and self.module.stride == (1, 1)
                and self.module.padding == (1, 1) and self.module.dilation == (1, 1)
                and self.module.groups == 1, "target40 convolution geometry differs")
        self.before = tuple(signature(p) for _, p in self.named)
        self.weight_sha = sha(self.module.weight)
        self.handles, self.raw, self.adjoints = [], [], []
        self.input = None
        self.active = None
        self.forward_count = 0
        self.counts = {kind + suffix: 0 for kind in ("forward", "generator", "discriminator")
                       for suffix in ("Attempted", "Completed")}
        self.bytes = RESERVE
        self.closed = False
        self.observation_error = None

    def copy(self, value):
        require(type(value) is torch.Tensor and value.dtype == torch.float32
                and value.layout == torch.strided and bool(torch.isfinite(value.detach()).all()), "finite FP32 observation required")
        needed = value.numel() * 4
        require(self.bytes + needed <= MAX_CAPTURE, "target40 capture budget exceeded before copy")
        before = signature(value)
        copied = value.detach().to(device="cpu", copy=True, memory_format=torch.contiguous_format)
        require(signature(value) == before and copied.untyped_storage().nbytes() == needed,
                "observation source changed or copy not compact")
        self.bytes += needed
        return copied

    def __enter__(self):
        require(not self.handles and not self.closed, "target40 observer single-use")
        self.resource()
        self.handles.append(self.module.register_forward_hook(self.forward))
        return self

    def forward(self, module, args, output):
        self.resource()
        require(module is self.module and self.forward_count == 0 and len(args) == 1, "single target40 forward required")
        require(tuple(args[0].shape) == (1, self.shape[1], *self.spatial())
                and tuple(output.shape) == (1, self.shape[0], *self.spatial()) and output.requires_grad,
                "target40 actual activation geometry differs")
        proposed = (self.shape[1] + 5 * self.shape[0]) * math.prod(self.spatial()) * 4 + 5 * math.prod(self.shape) * 4
        require(proposed + RESERVE <= MAX_CAPTURE, "target40 full capture exceeds original ceiling")
        self.input = self.copy(args[0])
        self.forward_count += 1
        self.handles.append(output.register_hook(self.adjoint))
        return None

    def adjoint(self, value):
        require(self.active == len(self.adjoints) and self.active is not None,
                "target40 adjoint outside original ordered G call")
        require(tuple(value.shape) == (1, self.shape[0], *self.spatial()), "target40 adjoint shape differs")
        self.adjoints.append(self.copy(value))
        return None

    def event(self, stage, kind, gradients=None):
        require(stage in ("attempt", "complete") and kind in ("forward", "generator", "discriminator"), "unknown probe event")
        self.counts[kind + ("Attempted" if stage == "attempt" else "Completed")] += 1
        if kind != "generator":
            return
        if stage == "attempt":
            require(self.active is None and len(self.raw) < 5, "duplicate original gradient attempt")
            self.active = len(self.raw)
        else:
            require(self.active == len(self.raw) and len(self.adjoints) == len(self.raw) + 1
                    and len(gradients) == 108 and gradients[self.index] is not None
                    and tuple(gradients[self.index].shape) == self.shape, "complete original gradient capture differs")
            self.raw.append(self.copy(gradients[self.index]))
            self.active = None

    def __exit__(self, kind, error, traceback):
        try:
            require(tuple(signature(p) for _, p in self.model.named_parameters()) == self.before
                    and sha(self.module.weight) == self.weight_sha, "observation changed model identity/version/weight")
        except BaseException as secondary:
            self.observation_error = str(secondary)
            if error is None:
                raise
        finally:
            self.closed = True
            for handle in reversed(self.handles):
                handle.remove()
            self.handles.clear()
        return False

    def _compact_ready(self):
        require(self.closed and self.observation_error is None and self.forward_count == 1
                and len(self.raw) == len(self.adjoints) == 5 and self.active is None, "complete closed target40 capture required")
        workspace_bound = 5 * math.prod(self.shape) * 8 + 3 * math.prod(self.shape) * 4 + 6 * math.prod(self.spatial()) * 4 + 8 * math.prod(self.spatial()) * 8 + 65536
        require(self.bytes + workspace_bound <= MAX_CAPTURE, "capture plus compact/reference workspace exceeds ceiling")

    def _packet(self, coordinate):
        output_channel, input_channel, _, _ = coordinate
        return {"input": self.input[:, input_channel:input_channel + 1].clone(),
                **{"adjoint." + label: value[:, output_channel:output_channel + 1].clone()
                   for label, value in zip(LABELS, self.adjoints)},
                **{"gradient." + label: value for label, value in zip(LABELS, self.raw)}}

    def compact(self):
        self._compact_ready()
        a, s, w, c, support = self.raw
        expected = ((s + w) + c) + support
        require(bool(torch.isfinite(expected).all()), "target40 component sum nonfinite")
        outside = ~torch.isclose(a, expected, atol=1e-6, rtol=1e-5)
        require(bool(outside.any()), "target40 original comparison did not fail")
        ratio = (a.double() - expected.double()).abs() / (1e-6 + 1e-5 * expected.double().abs())
        flat = int(ratio.reshape(-1).argmax())
        coordinate = []
        for size in reversed(self.shape):
            coordinate.append(flat % size)
            flat //= size
        coordinate = tuple(reversed(coordinate))
        require(bool(outside[coordinate]), "selected coordinate is not an original violation")
        packet = self._packet(coordinate)
        metadata = dict(parameterIndex=INDEX, parameterName=NAME, shape=list(SHAPE), coordinate=list(coordinate),
            selection="first_argmax_abs_difference_over_original_tolerance_within_target40",
            originalOutsideToleranceElements=int(outside.count_nonzero()),
            originalMaximumAbsoluteDifference=float((a.double() - expected.double()).abs().max()),
            maximumToleranceRatio=float(ratio.max()), capturedBytes=self.bytes,
            productionGeometry=type(self) is Target40Observation and self.spatial() == SPATIAL,
            descriptors={key: {"shape": list(value.shape), "dtype": str(value.dtype), "sha256": sha(value)}
                         for key, value in packet.items()})
        return packet, metadata


def classified_scalar(value):
    """Lossless finite FP32 scalar display; never emit JSON NaN/Infinity."""
    value = float(value)
    category = ("finite" if math.isfinite(value) else "nan" if math.isnan(value)
                else "positive_infinity" if value > 0 else "negative_infinity")
    return {"value": value if math.isfinite(value) else None, "classification": category}


class Target0Observation(Target40Observation):
    """Exact v4 target; does not replace the legacy target40 default."""
    index, name, shape = 0, TARGET0_NAME, TARGET0_SHAPE

    def spatial(self):
        return TARGET0_SPATIAL

    def __init__(self, model, resource):
        super().__init__(model, resource)
        require(type(self.module) is torch.nn.Conv2d and self.module.in_channels == 31
                and self.module.out_channels == 48 and self.module.kernel_size == (3, 3)
                and self.module.padding_mode == "zeros" and self.module.bias is not None,
                "target0 original native convolution type/config differs")

    def __exit__(self, kind, error, traceback):
        # Remove every handle even if one removal fails, without replacing the
        # original probe exception. The caller rejects any observation error.
        failures = []
        try:
            require(tuple(signature(p) for _, p in self.model.named_parameters()) == self.before
                    and sha(self.module.weight) == self.weight_sha, "observation changed model identity/version/weight")
        except BaseException as secondary:
            failures.append(secondary)
        finally:
            self.closed = True
            for handle in reversed(self.handles):
                try:
                    handle.remove()
                except BaseException as secondary:
                    failures.append(secondary)
            self.handles.clear()
        if failures:
            self.observation_error = "; ".join(str(e) for e in failures)
            if error is None:
                raise failures[0]
        return False

    def compact(self):
        self._compact_ready()
        a, s, w, c, support = self.raw
        stages = (s + w,)
        stages += (stages[-1] + c,)
        stages += (stages[-1] + support,)
        expected = stages[-1]
        finite = torch.isfinite(expected)
        sum_finite = bool(finite.all())
        outside = ~finite | ~torch.isclose(a, expected, atol=1e-6, rtol=1e-5)
        require(bool(outside.any()), "target0 original comparison did not fail")
        ratio = None
        if sum_finite:
            ratio = (a.double() - expected.double()).abs() / (1e-6 + 1e-5 * expected.double().abs())
            flat = int(ratio.reshape(-1).argmax())
        else:
            flat = int((~finite).reshape(-1).nonzero()[0, 0])
        coordinate = []
        for size in reversed(self.shape):
            coordinate.append(flat % size)
            flat //= size
        coordinate = tuple(reversed(coordinate))
        require(bool(outside[coordinate]), "selected coordinate is not an original violation")
        packet = self._packet(coordinate)
        actual_value, expected_value = float(a[coordinate]), float(expected[coordinate])
        selected_finite = math.isfinite(expected_value)
        difference = abs(actual_value - expected_value) if selected_finite else None
        allowed = 1e-6 + 1e-5 * abs(expected_value) if selected_finite else None
        metadata = dict(parameterIndex=0, parameterName=self.name, shape=list(self.shape), coordinate=list(coordinate),
            selection=("first_argmax_abs_difference_over_original_tolerance_within_target0" if sum_finite
                       else "first_flattened_nonfinite_component_sum"),
            componentSumFinite=sum_finite, nonfiniteSumElements=int((~finite).count_nonzero()),
            originalOutsideToleranceElements=int(outside.count_nonzero()),
            originalMaximumAbsoluteDifference=float((a.double() - expected.double()).abs().max()) if sum_finite else None,
            maximumToleranceRatio=float(ratio.max()) if ratio is not None else None,
            selectedValues={label: classified_scalar(value[coordinate]) for label, value in zip(LABELS, self.raw)},
            orderedSumStages=[classified_scalar(value[coordinate]) for value in stages],
            selectedExpected=classified_scalar(expected_value), selectedAbsoluteDifference=difference,
            selectedAllowedDifference=allowed, selectedToleranceRatio=difference / allowed if selected_finite else None,
            originalAtol=1e-6, originalRtol=1e-5, capturedBytes=self.bytes,
            productionGeometry=type(self) is Target0Observation and self.spatial() == TARGET0_SPATIAL,
            descriptors={key: {"shape": list(value.shape), "dtype": str(value.dtype), "sha256": sha(value)}
                         for key, value in packet.items()})
        return packet, metadata

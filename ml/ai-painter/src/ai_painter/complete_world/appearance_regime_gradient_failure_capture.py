"""Bounded, failure-only evidence for the unchanged appearance-regime model.

Call after perform_pair raises and re-raise that SAME exception afterwards.
This module does not repair, replay, load a model, update, or grant admission.
The tensor archive is a flat CPU tensor dictionary, never a pickled exception,
module, optimizer, sample image, conditions, or source file contents.
"""
from __future__ import annotations
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import random
import numpy as np
import torch

SCHEMA = "appearance-regime-gradient-failure-capture-v1"
EXPECTED_PARAMETERS = 107
ATOL, RTOL = 1e-6, 1e-5
MAX_CAPTURE_BYTES = 64 * 1024 * 1024
MAX_EXECUTION_BYTES = 128 * 1024 * 1024
METADATA_RESERVE = 1024 * 1024
RECEIPT_RESERVE = 65536
PRIMARY = "gradient-failure-primary.json"
TENSORS = "gradient-failure-tensors.pt"
MANIFEST = "gradient-failure-manifest.json"
PENDING = "gradient-failure-manifest.pending.json"
FAILURE = "gradient-failure-receipt.json"
FILES = (PRIMARY, TENSORS, MANIFEST, PENDING, FAILURE)
ROOT = Path(os.path.abspath(__file__)).parents[5]


def _require(value, message):
    if not value: raise ValueError(message)


def _error(error):
    result = {"type": type(error).__module__ + "." + type(error).__qualname__}
    try: result["message"] = str(error)
    except BaseException: result["message"] = "<exception message unavailable>"
    # Bound pathological exception strings but preserve their exact digest.
    if len(result["message"].encode("utf-8")) > 16384:
        text = result["message"]
        result.update(message=text[:4096], messageTruncated=True,
            fullMessageSha256=hashlib.sha256(text.encode("utf-8")).hexdigest(), fullMessageCharacters=len(text))
    return result


def _json(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def _path(raw, *, absolute=False):
    text = os.fspath(raw)
    _require(type(text) is str and text and "\x00" not in text and len(text) <= 4096
        and not any(part in (".", "..") for part in re.split(r"[/\\]", text)), "unsafe capture/source path")
    value = Path(text)
    _require(not absolute or value.is_absolute(), "capture output root must be absolute")
    if not value.is_absolute():
        _require(":" not in text and not text.startswith(("/", "\\")), "unsafe source logical path")
        value = ROOT / value
    return Path(os.path.abspath(value))


def _bindings(values):
    _require(type(values) is list and len(values) <= 4096, "source bindings must be a bounded list")
    result = []; identities = {}
    for binding in values:
        _require(type(binding) is dict and type(binding.get("path")) is str
            and type(binding.get("sha256")) is str and re.fullmatch(r"[a-f0-9]{64}", binding["sha256"]), "source binding path/SHA invalid")
        path = _path(binding["path"])
        _no_redirect(path)
        _require(path.is_file(), "source binding file absent: " + binding["path"])
        _require(binding["path"] not in identities or identities[binding["path"]] == binding["sha256"], "source binding SHA conflict")
        identities[binding["path"]] = binding["sha256"]
        result.append({"path": binding["path"], "sha256": binding["sha256"]})
    return result


def _no_redirect(path):
    """Allow the registered project .runtime junction, reject other aliases."""
    if path.is_relative_to(ROOT):
        relative = path.relative_to(ROOT)
        if relative.parts and relative.parts[0] == ".runtime":
            expected = (ROOT / ".runtime").resolve().joinpath(*relative.parts[1:])
        else: expected = ROOT.resolve() / relative
    else: expected = path
    _require(path.resolve() == expected, "unregistered path alias/redirection")


def _execution_proof(binding, output_root):
    value = _bindings([binding])[0]; path = _path(value["path"])
    _no_redirect(path); _no_redirect(output_root)
    _require(path.stat().st_size <= 2 * 1024 * 1024, "execution binding too large")
    data = path.read_bytes()
    _require(hashlib.sha256(data).hexdigest() == value["sha256"], "execution binding SHA differs")
    package = json.loads(data)
    _require(type(package) is dict and type(package.get("outputRoot")) is str, "execution package outputRoot missing")
    owned = _path(package["outputRoot"]); _no_redirect(owned)
    _require(output_root.resolve().is_relative_to(owned.resolve()), "capture output outside bound Run root")
    return value, owned


class _Budget:
    def __init__(self, maximum): self.maximum, self.used = maximum, 0
    def check(self, size, *, reserve=0):
        _require(type(size) is int and size >= 0 and self.used + size + reserve <= self.maximum, "failure capture output budget exceeded")


class _Sink:
    def __init__(self, stream, budget): self.stream, self.budget = stream, budget
    def write(self, data):
        self.budget.check(len(data), reserve=RECEIPT_RESERVE)
        count = self.stream.write(data); self.budget.used += count
        _require(count == len(data), "short failure tensor write")
        return count
    def flush(self): self.stream.flush()
    def tell(self): return self.stream.tell()


def _binding(path):
    _require(not path.is_symlink(), "evidence file symlink prohibited")
    _no_redirect(path)
    digest = hashlib.sha256(); size = 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block); size += len(block)
    return {"path": path.as_posix(), "sha256": digest.hexdigest(), "bytes": size}


def _exclusive(root, name, data, budget):
    _require(name in FILES, "unknown evidence filename")
    budget.check(len(data))
    path = root / name
    with path.open("xb") as stream:
        count = stream.write(data); budget.used += count
        _require(count == len(data), "short failure metadata write")
        stream.flush(); os.fsync(stream.fileno())
    return _binding(path)


def _owned_bytes(root):
    """Stat existing Run artifacts/Checkpoints without reading their contents."""
    total = checkpoints = 0
    if root.is_dir():
        for path in root.rglob("*"):
            _no_redirect(path)
            if path.is_file():
                size = path.stat().st_size; total += size
                if path.suffix == ".pt": checkpoints += size
    return {"totalBytes": total, "checkpointBytes": checkpoints}


def _commit_manifest(root, data, budget, owned_root):
    # Keep the pending witness as evidence. An exclusive hard link publishes
    # only the already-fsynced, verified bytes; it never overwrites a final
    # name or exposes a half-written final manifest. Both entries are counted.
    budget.check(len(data) * 2)
    _require(_owned_bytes(owned_root)["totalBytes"] + len(data) * 2 <= MAX_EXECUTION_BYTES, "actual Run output budget exhausted")
    pending = _exclusive(root, PENDING, data, budget)
    _require(pending["sha256"] == hashlib.sha256(data).hexdigest(), "pending manifest SHA differs")
    os.link(root / PENDING, root / MANIFEST)
    budget.used += len(data)
    return _binding(root / MANIFEST)


def _tensor(value):
    _require(isinstance(value, torch.Tensor) and value.layout == torch.strided and not value.is_meta
        and value.device.type in ("cpu", "cuda"), "unsupported evidence tensor")
    if value.device.type == "cuda":
        _require(torch.cuda.is_initialized(), "capture cannot initialize CUDA")
    return value


def _cpu(value):
    value = _tensor(value).detach().to(device="cpu").clone(memory_format=torch.contiguous_format)
    _require(type(value) is torch.Tensor and value.device.type == "cpu" and not value.requires_grad, "plain detached CPU tensor required")
    return value


def _tensor_sha(value):
    raw = value.contiguous().reshape(-1).view(torch.uint8).numpy().tobytes()
    return hashlib.sha256(raw).hexdigest()


def _number(value):
    value = float(value)
    if math.isnan(value): return {"status": "nan", "value": None}
    if math.isinf(value): return {"status": "positive_infinity" if value > 0 else "negative_infinity", "value": None}
    return {"status": "finite", "value": value}


def _collect_specs(model, critic, attachment):
    """Inspect references and sizes before copying/serialization; never mutate."""
    specs = []; networks = {}; named = tuple(model.named_parameters())
    for network_name, network in (("model", model), ("critic", critic)):
        _require(isinstance(network, torch.nn.Module), "capture networks must be modules")
        parameters = tuple(network.named_parameters()); buffers = tuple(network.named_buffers())
        metadata = {"parameters": [], "buffers": [], "modes": {name: bool(module.training) for name, module in network.named_modules()}}
        for kind, values in (("parameter", parameters), ("buffer", buffers)):
            for i, (name, tensor) in enumerate(values):
                _require(len(name) <= 2048, "tensor name too long")
                key = network_name + "." + kind + "." + str(i)
                _tensor(tensor); specs.append((key, tensor))
                item = {"name": name, "key": key, "shape": list(tensor.shape), "dtype": str(tensor.dtype),
                    "sourceDevice": str(tensor.device), "tensorVersion": int(tensor._version)}
                if kind == "parameter":
                    item["requiresGrad"] = bool(tensor.requires_grad)
                    item["gradientKey"] = None
                    if tensor.grad is not None:
                        grad_key = key + ".grad"; _tensor(tensor.grad); specs.append((grad_key, tensor.grad)); item["gradientKey"] = grad_key
                metadata["parameters" if kind == "parameter" else "buffers"].append(item)
        networks[network_name] = metadata
    gradients = []; problems = []
    if type(attachment) is not dict:
        return specs, networks, named, gradients, ["exception has no raw gradient attachment"]
    raw = attachment.get("rawGradients")
    if type(raw) not in (tuple, list):
        return specs, networks, named, gradients, ["rawGradients is not a sequence"]
    _require(len(raw) <= 4, "more than four gradient sets prohibited")
    if len(named) != EXPECTED_PARAMETERS: problems.append("canonical model parameter count is not 107")
    if attachment.get("parameterNames") != [name for name, _ in named]: problems.append("attachment parameter names differ from canonical order")
    if attachment.get("parameterTensorCount") != len(named): problems.append("attachment parameter count differs")
    if attachment.get("gradientSetsAvailable") != len(raw): problems.append("attachment completed set count differs")
    if len(raw) != 4: problems.append("four independent gradient sets are incomplete")
    for set_index, sequence in enumerate(raw):
        _require(type(sequence) in (tuple, list) and len(sequence) <= EXPECTED_PARAMETERS, "invalid/oversized raw gradient sequence")
        if len(sequence) != len(named): problems.append("gradient set " + str(set_index) + " does not cover canonical parameters")
        rows = []
        for i, value in enumerate(sequence):
            if value is None:
                rows.append({"key": None, "unused": True}); continue
            _tensor(value)
            key = "gradient." + str(set_index) + "." + str(i); specs.append((key, value))
            rows.append({"key": key, "unused": False, "shape": list(value.shape), "dtype": str(value.dtype), "sourceDevice": str(value.device)})
            if i < len(named):
                parameter = named[i][1]
                if value.shape != parameter.shape or value.dtype != torch.float32 or value.device != parameter.device:
                    problems.append("gradient metadata differs at set " + str(set_index) + " parameter " + str(i))
        gradients.append(rows)
    return specs, networks, named, gradients, problems


def _random_snapshot(model, critic):
    tensors = {"random.torch_cpu": torch.random.get_rng_state()}
    python = random.getstate(); numpy = np.random.get_state()
    metadata = {"python": python, "numpy": {"algorithm": numpy[0], "keys": numpy[1].tolist(),
        "position": int(numpy[2]), "hasGaussian": int(numpy[3]), "cachedGaussian": _number(numpy[4])},
        "cudaDevices": [], "backend": {"deterministic": torch.are_deterministic_algorithms_enabled(),
            "deterministicWarnOnly": torch.is_deterministic_algorithms_warn_only_enabled(),
            "mkldnnEnabled": torch.backends.mkldnn.enabled, "mkldnnDeterministic": torch.backends.mkldnn.deterministic,
            "cudaMatmulFp32Precision": torch.backends.cuda.matmul.fp32_precision,
            "cudnnConvFp32Precision": torch.backends.cudnn.conv.fp32_precision}}
    devices = sorted({str(p.device) for network in (model, critic) for p in network.parameters() if p.device.type == "cuda"})
    for device in devices:
        _require(torch.cuda.is_initialized(), "random snapshot cannot initialize CUDA")
        tensors["random." + device] = torch.cuda.get_rng_state(torch.device(device))
        metadata["cudaDevices"].append(device)
    return tensors, metadata


def _ensure_unchanged(model, critic, specs, versions, networks, random_tensors, random_metadata, context):
    references = dict(specs)
    _require(all(value._version == version for (_, value), version in zip(specs, versions)), "capture changed source tensor version")
    for name, network in (("model", model), ("critic", critic)):
        metadata = networks[name]
        _require({n: bool(m.training) for n, m in network.named_modules()} == metadata["modes"], "capture changed network mode")
        parameters = dict(network.named_parameters()); buffers = dict(network.named_buffers())
        _require(list(parameters) == [item["name"] for item in metadata["parameters"]]
            and list(buffers) == [item["name"] for item in metadata["buffers"]], "capture changed canonical tensor graph")
        for item in metadata["parameters"]:
            parameter = parameters[item["name"]]
            _require(parameter is references[item["key"]] and parameter.requires_grad == item["requiresGrad"], "capture changed parameter identity/trainability")
            _require(parameter.grad is (None if item["gradientKey"] is None else references[item["gradientKey"]]), "capture changed parameter gradient identity")
        _require(all(buffers[item["name"]] is references[item["key"]] for item in metadata["buffers"]), "capture changed buffer identity")
    current_tensors, current_metadata = _random_snapshot(model, critic)
    _require(current_metadata == random_metadata and set(current_tensors) == set(random_tensors)
        and all(torch.equal(value, current_tensors[key]) for key, value in random_tensors.items()), "capture changed random/backend state")
    _require(context == (torch.is_grad_enabled(), torch.is_autocast_enabled("cpu"), torch.is_autocast_enabled("cuda")), "capture changed caller context")


def _comparison(named, gradients, tensors, problems, error):
    result = {"status": "unavailable", "gradientSetsAvailable": len(gradients), "gradientSetsExpected": 4,
        "canonicalParameterCount": len(named), "expectedParameterCount": EXPECTED_PARAMETERS,
        "formula": "(structured.float()+wholeFrame.float()).float()+core.float()", "atol": ATOL, "rtol": RTOL,
        "passedAllOriginalToleranceMasks": None, "allFinite": None, "problems": problems,
        "parameters": [], "outsideToleranceElements": None, "worstParameterIndex": None,
        "meaning": "diagnostic comparison only; never qualification or gate replacement"}
    match = re.fullmatch(r"actual total gradient identity differs at parameter (\d+)", _error(error)["message"])
    result["exceptionReportedParameterIndex"] = int(match.group(1)) if match else None
    if problems: return result
    total_outside = 0; worst = -1.; all_finite = True; first_nonfinite = None
    with torch.no_grad(), torch.autocast("cpu", enabled=False):
        for i, (name, parameter) in enumerate(named):
            unused = [rows[i]["key"] is None for rows in gradients]
            values = [torch.zeros(parameter.shape, dtype=torch.float32, device="cpu") if rows[i]["key"] is None
                else tensors[rows[i]["key"]] for rows in gradients]
            actual, structured, whole, core = values
            expected = (structured.float() + whole.float()).float() + core.float()
            finite_sets = [bool(torch.isfinite(v).all()) for v in values]
            finite = torch.isfinite(actual) & torch.isfinite(expected)
            close = torch.isclose(actual, expected, atol=ATOL, rtol=RTOL)
            delta = (actual.double() - expected.double()).abs().reshape(-1)
            outside = int((~close).sum()); total_outside += outside
            finite_delta = torch.where(torch.isfinite(delta), delta, torch.full_like(delta, -1))
            index = int(finite_delta.argmax()) if delta.numel() else None
            maximum = float(delta.max()) if delta.numel() else 0.
            if not bool(torch.isfinite(delta).all()):
                index = int(torch.nonzero(~torch.isfinite(delta), as_tuple=False)[0])
                if first_nonfinite is None: first_nonfinite = i
            score = float(finite_delta.max()) if delta.numel() else 0.
            if score > worst: worst = score; result["worstParameterIndex"] = i
            all_finite = all_finite and all(finite_sets) and bool(finite.all())
            result["parameters"].append({"index": i, "name": name, "shape": list(parameter.shape), "unused": unused,
                "finiteGradientSets": finite_sets, "nonfiniteActualElements": int((~torch.isfinite(actual)).sum()),
                "nonfiniteExpectedElements": int((~torch.isfinite(expected)).sum()), "outsideToleranceElements": outside,
                "maxAbsoluteDifference": _number(maximum), "worstFlatIndex": index,
                "worstActual": _number(actual.reshape(-1)[index]) if index is not None else None,
                "worstExpected": _number(expected.reshape(-1)[index]) if index is not None else None,
                "worstOriginalComparisonLimit": _number(ATOL + RTOL * expected.reshape(-1)[index].abs()) if index is not None else None,
                "differenceArithmetic": "float64 diagnostics", "comparisonLimitArithmetic": "float32"})
    result.update(status="computed_from_four_complete_107_sets", outsideToleranceElements=total_outside,
        allFinite=all_finite, passedAllOriginalToleranceMasks=bool(total_outside == 0 and all_finite))
    result["worstParameterCriterion"] = "maximum_finite_absolute_difference" if first_nonfinite is None else "first_nonfinite_difference"
    if first_nonfinite is not None: result["worstParameterIndex"] = first_nonfinite
    return result


def capture_gradient_failure(*, error, model, critic, sample, counts, epoch, train_position,
        output_root, execution_binding, source_bindings, remaining_output_bytes):
    """Return a receipt for success/partial/failed capture; never replace error.

The caller retains and re-raises ``error``. A failed/interrupted capture is not
retried, and every successfully created file (including partial archive) stays.
Source bindings are existing-file references, NOT a claim of rehashed pixels.
"""
    original = _error(error)
    receipt = {"schemaVersion": SCHEMA, "status": "capture_failed", "originalError": original,
        "executionQualified": False, "artifacts": {}, "locationOrigin": "explicit_capture_call", "automaticRetries": 0}
    root = budget = None; attempted = False
    try:
        _require(isinstance(error, BaseException), "original exception required")
        _require(type(remaining_output_bytes) is int and 0 <= remaining_output_bytes <= MAX_EXECUTION_BYTES, "remaining execution budget invalid")
        _require(type(counts) is dict and len(counts) <= 32 and all(type(k) is str and len(k) <= 128
            and type(v) is int and v >= 0 for k, v in counts.items()), "actual counters invalid")
        _require((epoch is None or type(epoch) is int and epoch >= 0)
            and (train_position is None or type(train_position) is int and train_position >= 0), "explicit epoch/train position invalid")
        _require(type(sample) is dict and type(sample.get("sampleId")) in (str, type(None))
            and type(sample.get("split")) in (str, type(None)), "explicit sample identity invalid")
        location = {"epoch": epoch, "trainPosition": train_position, "sampleId": sample.get("sampleId"),
            "split": sample.get("split"), "origin": "explicit_capture_call", "inferredSample": False}
        receipt.update(location=location, counts=dict(counts))
        budget = _Budget(min(MAX_CAPTURE_BYTES, remaining_output_bytes))
        root = _path(output_root, absolute=True)
        execution, owned_root = _execution_proof(execution_binding, root)
        existing = _owned_bytes(owned_root)
        _require(existing["totalBytes"] <= MAX_EXECUTION_BYTES, "actual Run output budget already exhausted")
        budget = _Budget(min(budget.maximum, MAX_EXECUTION_BYTES - existing["totalBytes"]))
        _require(not root.is_symlink(), "capture root symlink prohibited")
        root.mkdir(parents=True, exist_ok=True); root = root.resolve()
        _require(not any((root / name).exists() or (root / name).is_symlink() for name in FILES), "failure capture already consumed; no retry")
        primary = {"schemaVersion": SCHEMA, "status": "capture_started_original_error_preserved",
            "originalError": original, "location": location, "counts": dict(counts), "automaticRetries": 0}
        attempted = True
        receipt["artifacts"]["primary"] = _exclusive(root, PRIMARY, _json(primary), budget)
        _require(torch.get_num_threads() <= 2, "failure capture CPU thread budget exceeded")
        bindings = _bindings(source_bindings)
        specs, networks, named, gradients, problems = _collect_specs(model, critic, getattr(error, "appearance_regime_gradient_evidence", None))
        random_tensors, random_metadata = _random_snapshot(model, critic)
        specs.extend(random_tensors.items())
        if isinstance(sample.get("appearance_regime"), torch.Tensor) and sample["appearance_regime"].shape == (4,):
            specs.append(("sample.appearance_regime", sample["appearance_regime"]))
        versions = tuple(value._version for _, value in specs)
        context = (torch.is_grad_enabled(), torch.is_autocast_enabled("cpu"), torch.is_autocast_enabled("cuda"))
        tensor_bytes = sum(value.numel() * value.element_size() for _, value in specs)
        metadata = {"executionBinding": execution, "executionOwnedOutputRoot": owned_root.as_posix(),
            "sourceBindings": bindings, "networks": networks, "gradientSets": gradients, "randomState": random_metadata}
        estimate = tensor_bytes + len(specs) * 512 + len(_json(metadata)) + METADATA_RESERVE + RECEIPT_RESERVE
        receipt["sizePreflight"] = {"rawTensorBytes": tensor_bytes, "estimatedAdditionalBytes": estimate,
            "captureMaximumBytes": budget.maximum, "existingRunBytes": existing["totalBytes"],
            "existingCheckpointBytes": existing["checkpointBytes"], "callerRemainingOutputBytes": remaining_output_bytes,
            "sourcePixelsCopied": False}
        budget.check(estimate)
        with torch.no_grad(): tensors = {key: _cpu(value) for key, value in specs}
        descriptors = {key: {"shape": list(value.shape), "dtype": str(value.dtype), "sha256": _tensor_sha(value),
            "bytes": value.numel() * value.element_size()} for key, value in tensors.items()}
        comparison = _comparison(named, gradients, tensors, problems, error)
        with (root / TENSORS).open("xb") as stream:
            torch.save(tensors, _Sink(stream, budget)); stream.flush(); os.fsync(stream.fileno())
        receipt["artifacts"]["tensors"] = _binding(root / TENSORS)
        # Confirm actual payload bytes and safe detached contents BEFORE the
        # exclusive final manifest is committed; garbage/partial save is not
        # a complete scene, even if a serializer returned without an error.
        snapshot = (root / TENSORS).read_bytes()
        _require(hashlib.sha256(snapshot).hexdigest() == receipt["artifacts"]["tensors"]["sha256"], "serialized tensor snapshot SHA differs")
        _verify_tensors(snapshot, descriptors)
        _ensure_unchanged(model, critic, specs, versions, networks, random_tensors, random_metadata, context)
        _require(counts == primary["counts"], "capture changed actual counters")
        status = "partial_failure_evidence_captured" if problems else "failure_evidence_captured"
        manifest = {"schemaVersion": SCHEMA, "status": status, "originalError": original,
            "location": location, "counts": dict(counts), **metadata, "tensorDescriptors": descriptors,
            "artifacts": dict(receipt["artifacts"]), "comparison": comparison, "sizePreflight": receipt["sizePreflight"],
            "executionBytesRehashed": True, "sourceBytesRehashed": False, "sourcePixelsCopied": False, "executionQualified": False,
            "gradientEvidenceComplete": not problems,
            "invariantsVerifiedBeforeManifest": True,
            "manifestCommitProtocol": "exclusive_fsynced_pending_atomic_link_keep_witness_count_both_entries",
            "use": "diagnostic_only_not_training_initialization_or_gate_override"}
        receipt["artifacts"]["manifest"] = _commit_manifest(root, _json(manifest), budget, owned_root)
        receipt.update(status=status, gradientEvidenceComplete=not problems, comparisonStatus=comparison["status"], capturedBytes=budget.used)
        return receipt
    except BaseException as secondary:
        receipt["captureError"] = _error(secondary)
        receipt["status"] = "capture_interrupted" if isinstance(secondary, (KeyboardInterrupt, SystemExit)) else "capture_failed"
        if root is not None and attempted:
            try:
                if budget is not None: budget.used = sum((root / name).stat().st_size for name in FILES if (root / name).is_file())
                if (root / TENSORS).is_file(): receipt["partialTensorArtifact"] = _binding(root / TENSORS)
                if budget is not None:
                    receipt["artifacts"]["failure"] = _exclusive(root, FAILURE, _json(receipt), budget)
            except BaseException as tertiary: receipt["secondaryEvidenceError"] = _error(tertiary)
        return receipt


def _verify_tensors(data, descriptors):
    tensors = torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
    _require(type(tensors) is dict and set(tensors) == set(descriptors), "safe tensor payload keys differ")
    for key, value in tensors.items():
        descriptor = descriptors[key]
        _require(type(value) is torch.Tensor and value.device.type == "cpu" and not value.requires_grad
            and value.layout == torch.strided and list(value.shape) == descriptor["shape"] and str(value.dtype) == descriptor["dtype"]
            and value.numel() * value.element_size() == descriptor["bytes"] and _tensor_sha(value) == descriptor["sha256"], "safe tensor descriptor differs")
    return tensors


def verify_gradient_failure_capture(receipt):
    """Verify one immutable byte snapshot and safely load its CPU-only tensors.

This read-only verifier is diagnostic; no model loading or admission occurs.
"""
    _require(type(receipt) is dict and receipt.get("status") in ("failure_evidence_captured", "partial_failure_evidence_captured"), "committed capture receipt required")
    manifest_binding = receipt["artifacts"]["manifest"]
    path = _path(manifest_binding["path"], absolute=True); root = path.parent.resolve()
    _require(path.name == MANIFEST and not path.is_symlink(), "manifest path differs")
    _require(path.stat().st_size <= MAX_CAPTURE_BYTES, "manifest size exceeds capture budget")
    payload = path.read_bytes()
    _require(len(payload) == manifest_binding["bytes"] and hashlib.sha256(payload).hexdigest() == manifest_binding["sha256"], "manifest bytes/SHA differ")
    manifest = json.loads(payload)
    _require(manifest["schemaVersion"] == SCHEMA and manifest["status"] == receipt["status"]
        and manifest["executionQualified"] is False, "failure manifest identity differs")
    _execution_proof(manifest["executionBinding"], root)
    for kind, filename in (("primary", PRIMARY), ("tensors", TENSORS)):
        binding = manifest["artifacts"][kind]; artifact = _path(binding["path"], absolute=True)
        _require(artifact.parent.resolve() == root and artifact.name == filename and not artifact.is_symlink(), "artifact path escapes capture root")
        _require(_binding(artifact) == binding, "artifact bytes/SHA differ")
    binding = manifest["artifacts"]["tensors"]
    _require(0 <= binding["bytes"] <= MAX_CAPTURE_BYTES, "tensor archive budget differs")
    data = _path(binding["path"], absolute=True).read_bytes()
    _require(hashlib.sha256(data).hexdigest() == binding["sha256"], "tensor snapshot SHA differs")
    tensors = _verify_tensors(data, manifest["tensorDescriptors"])
    return manifest, tensors

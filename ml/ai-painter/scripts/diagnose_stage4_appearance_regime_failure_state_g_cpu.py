"""One owned CPU surrogate G graph; never training or CUDA replay."""
from __future__ import annotations
import argparse
import ast
from contextlib import ExitStack, contextmanager
import hashlib
import inspect
import json
import math
import os
from pathlib import Path
import random
import re
import sys
import time
from unittest.mock import patch

import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as safe

ROOT = Path(os.path.abspath(__file__)).parents[3]
ENTRY = "ml/ai-painter/scripts/diagnose_stage4_appearance_regime_failure_state_g_cpu.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_appearance_regime_failure_state_g_cpu.py"
HELPER = "ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py"
SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
SPEC_SHA = "7eb9495572ff0b908297f1773e1fb724196287d59cf86dd6a5878fb4b6ccee3a"
PARENT = (".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/"
          "mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/"
          "dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/"
          "gradient-failure-capture-t-q4-37/post-capture-t-q4-38/next-t-q4-39/numeric-implementation")
SCHEMA = "appearance-regime-failure-state-g-cpu-surrogate-v1"
LIMITS = dict(safe.LIMITS)
BOUNDARY = {"diagnosticOnly": True, "cudaReplay": False, "rootCause": "unknown",
            "trainingAllowed": False, "checkpointPromotion": False,
            "qualificationGranted": False, "runtimePublication": False, "automaticRetries": 0}
require = safe.require
HISTORY_MODE = "t-q4-40-explicit-two-js-history-v1"
NEW_PARENT = safe.OUTPUT_PARENT + "/next-t-q4-40"
HISTORY_MANIFEST = {"path": safe.OUTPUT_PARENT + "/next-t-q4-39/migration-supervisor-integration/before-source/manifest.json",
                    "sha256": "76c9d27b6ba29093507072fcb194f2696c0c0f25c222b87e6da09e4f63e075bd"}
HISTORY_SOURCES = (
    ("scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs",
     "4e797018048d07af15ca520f5a7eb097f9abac46a373b93be5c3eb6ac133e558", 85190),
    ("scripts/tests/run-ai-painter-appearance-regime-gradient-failure-capture.test.mjs",
     "ee5a6a3cc4f6dc50879c62da6c7b10069d77efea1af5799fd460ec1bd7d5e982", 19676))
SOURCE_RUN = ".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions/mvp256-dry-capture-v1-f81b7392b96fa1eb88853e898da724ef116711112f5ef76f"
SOURCE_FAILURE = {"path": SOURCE_RUN + "/failure.json", "sha256": "9c6d9fabf3193582dc6326e4dd76ec87f3825799e297d95a0add453d2e9933aa"}
SOURCE_PACKAGE = {"path": SOURCE_RUN + "/execution-package.json", "sha256": "b2cbb50211a4f9b6b094f86f78c8b3de9c01723249a5f6700acf254040c3c7f9"}


def history_mappings():
    parent = HISTORY_MANIFEST["path"].rsplit("/", 1)[0]
    return [{"path": path, "sha256": sha, "bytes": size,
             "snapshot": {"path": parent + "/" + Path(path).name + ".bin", "sha256": sha, "bytes": size}}
            for path, sha, size in HISTORY_SOURCES]


class HistoryReader(safe.Reader):
    """Two pinned non-executed JS byte proofs; never a generic fallback."""
    def __init__(self, root, deadline, terminal, binding):
        super().__init__(root, deadline)
        require(type(binding) is dict and set(binding) == {"path", "sha256"}
                and binding["path"] == NEW_PARENT + "/history-proof.json", "history proof path/fields differ")
        proof = super().bound(binding)
        require(type(proof) is dict and set(proof) == {"schemaVersion", "mode", "sourceFailure",
                "sourceExecutionPackage", "beforeSourceManifest", "mappings"}, "history proof fields differ")
        require(proof["schemaVersion"] == HISTORY_MODE and proof["mode"] == HISTORY_MODE
                and proof["sourceFailure"] == terminal == SOURCE_FAILURE
                and proof["sourceExecutionPackage"] == SOURCE_PACKAGE
                and proof["beforeSourceManifest"] == HISTORY_MANIFEST
                and proof["mappings"] == history_mappings(), "history proof scope/bindings differ")
        source = super().bound(SOURCE_FAILURE)
        require(source["executionPackage"] == SOURCE_PACKAGE, "history source package conflict")
        package = super().bound(SOURCE_PACKAGE)
        require(package["outputRoot"] == SOURCE_RUN, "history source Run conflict")
        records = super().bound(HISTORY_MANIFEST)
        require(type(records) is list and len(records) == 2, "history manifest count differs")
        self.aliases, self.current = {}, {}
        for record, mapping in zip(records, history_mappings()):
            require(type(record) is dict and set(record) == {"path", "sha256", "bytes", "snapshot"}
                    and all(record[k] == mapping[k] for k in ("path", "sha256", "bytes")), "history manifest binding differs")
            # The immutable manifest's R: string is provenance only. Resolve
            # exclusively the pinned logical snapshot, never that drive alias.
            require(type(record["snapshot"]) is str and Path(record["snapshot"]).is_absolute(),
                    "history manifest recorded path differs")
            super().bound(mapping["snapshot"], json_data=False)
            matches = [b for b in package["programBindings"].values() if b["path"] == mapping["path"]]
            require(matches and all(b["sha256"] == mapping["sha256"] for b in matches), "original package history SHA conflict")
            current_file = safe.logical_path(root, mapping["path"])
            current = {"path": mapping["path"], "sha256": safe.file_hash(current_file, deadline)}
            super().bound(current, json_data=False)
            self.aliases[mapping["path"]], self.current[mapping["path"]] = mapping, current

    def bound(self, binding, *, json_data=True, maximum=None):
        path = binding.get("path") if type(binding) is dict else None
        if path not in self.aliases:
            return super().bound(binding, json_data=json_data, maximum=maximum)
        mapping = self.aliases[path]
        require(not json_data and set(binding) in ({"path", "sha256"}, {"path", "sha256", "bytes"})
                and binding["sha256"] == mapping["sha256"]
                and ("bytes" not in binding or type(binding["bytes"]) is int
                     and binding["bytes"] == mapping["bytes"]), "history raw-byte binding differs")
        super().bound(self.current[path], json_data=False, maximum=maximum)
        return super().bound(mapping["snapshot"], json_data=False, maximum=maximum)


def make_reader(root, deadline, terminal, history_binding=None):
    return HistoryReader(root, deadline, terminal, history_binding) if history_binding is not None else safe.Reader(root, deadline)


def control_identity(reader, programs, terminal, history_binding=None):
    payload = {"inputs": reader.observed, "programs": programs, "terminal": terminal,
               "algorithm": SCHEMA, "limits": LIMITS}
    if history_binding is not None:
        payload.update(historyMode=HISTORY_MODE, historyBinding=history_binding)
    return safe.digest(safe.encoded(payload))


def observe_programs(reader, programs, history_binding):
    if history_binding is not None:
        for binding in programs:
            reader.bound(binding, json_data=False)


def bindings(root, deadline):
    result = []
    for path in (ENTRY, TEST, HELPER, safe.CAPTURE, SPEC):
        digest = safe.file_hash(safe.logical_path(root, path), deadline)
        result.append({"path": path, "sha256": digest})
    require(result[-1]["sha256"] == SPEC_SHA, "current surrogate specification differs")
    require(result[-2]["sha256"] == safe.CAPTURE_SHA, "frozen capture differs")
    return result


class InputReader:
    """Bound raw-byte adapter for the original ONE-row decoder; no ticket."""
    def __init__(self, reader, known):
        self.reader, self.root, self.known = reader, reader.root, dict(known)

    def read(self, binding):
        fields = {key: binding[key] for key in ("path", "sha256")}
        file = self.reader.bound(fields, json_data=False, maximum=LIMITS["captureBytes"])
        return file.read_bytes()

    def json(self, binding):
        return json.loads(self.read(binding))

    def snapshot(self, path):
        require(path in self.known, "unbound decoder snapshot path: " + path)
        binding = {"path": path, "sha256": self.known[path]}
        return self.read(binding), binding

    def unchanged(self):
        self.reader.unchanged()


def validate_network_metadata(manifest):
    for family, count in (("model", 107), ("critic", 14)):
        network = manifest["networks"][family]
        params = network["parameters"]
        require(len(params) == count and len({p["name"] for p in params}) == count,
                "complete named network parameters required")
        require(type(network["modes"]) is dict and "" in network["modes"]
                and all(type(value) is bool for value in network["modes"].values()), "invalid module modes")
        for kind in ("parameters", "buffers"):
            records = network[kind]
            require(len({p["name"] for p in records}) == len(records), "duplicate state names")
            for i, item in enumerate(records):
                require(item["key"] == f"{family}.{kind[:-1]}.{i}", "canonical state reference differs")
                desc = manifest["tensorDescriptors"][item["key"]]
                require(item["shape"] == desc["shape"] and item["dtype"] == desc["dtype"],
                        "state descriptor differs")
                if kind == "parameters":
                    require(type(item["requiresGrad"]) is bool and item["gradientKey"] is None,
                            "dirty or unknown captured parameter gradients")
    require(all(p["requiresGrad"] for p in manifest["networks"]["model"]["parameters"]),
            "G parameters must all require gradients")
    require([p["name"] for p in manifest["networks"]["model"]["buffers"]] ==
            ["regime_identity", "numeric_identity"] and
            not manifest["networks"]["critic"]["buffers"], "unsupported stateful buffer graph")


def source_guard(reader, package):
    sources, random_calls = {}, []
    draws = {"rand", "randn", "randint", "rand_like", "randn_like", "randint_like",
             "bernoulli", "multinomial", "normal", "poisson", "random", "choice",
             "choices", "sample", "shuffle", "uniform"}
    for binding in package["programBindings"].values():
        file = reader.bound(binding, json_data=False)
        sources[binding["path"]] = binding["sha256"]
        if not binding["path"].endswith(".py") or "/src/" not in binding["path"]:
            continue
        tree = ast.parse(file.read_text(encoding="utf-8-sig"))
        functions = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
        for call in ast.walk(tree):
            if not isinstance(call, ast.Call):
                continue
            name = ast.unparse(call.func)
            require(not any(s in name.lower() for s in ("dropout", "batchnorm", "batch_norm")),
                    "unknown stochastic/stateful module in bound source")
            if name.split(".")[-1].lower() in draws:
                owners = [n for n in functions if n.lineno <= call.lineno <= n.end_lineno]
                owner = min(owners, key=lambda n: n.end_lineno - n.lineno).name if owners else None
                require(binding["path"] == "ml/ai-painter/src/ai_painter/training/dataset.py"
                        and owner in ("__getitem__", "deterministic_noise_channel"),
                        "unproved random source route")
                random_calls.append({"path": binding["path"], "line": call.lineno, "function": owner})
    return sources, random_calls


def input_preflight(reader, context):
    package = reader.bound(context["phase"]["executionPackage"])
    sources, excluded = source_guard(reader, package)
    manifest = reader.bound(package["datasetManifest"])
    index = reader.bound(manifest["sourceIndex"])  # transitive SHA; not required in capture refs
    split = reader.bound(package["trainSplit"])
    sid = context["location"]["sampleId"]
    rows = [row for row in index["samples"] if row["sampleId"] == sid]
    require(len(rows) == 1 and rows[0]["split"] == "train" and sid in split["sampleIds"],
            "exact one failed train row required")
    row = rows[0]
    pack = reader.bound(row["conditionPack"])
    order, continuous = manifest["identityPayload"]["channelOrder"], manifest["identityPayload"]["continuousChannelIds"]
    contract = reader.bound({"path": "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json",
                             "sha256": "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2"})
    require(len(order) == len(set(order)) == 23 and [c["id"] for c in pack["channels"]] == order,
            "full fixed condition order required")
    require(order == contract["tensorContract"]["channelOrder"] and
            continuous == contract["tensorContract"]["typePartitions"]["continuous"],
            "frozen input channel contract differs")
    for binding in (row["image"], *pack["channels"]):
        reader.bound({"path": binding["path"], "sha256": binding["sha256"]},
                     json_data=False, maximum=LIMITS["captureBytes"])
    known = {b["path"]: b["sha256"] for b in context["manifest"]["sourceBindings"]}
    known.update(sources)
    for binding in (row["contribution"], row["sourceRecord"], row["regionSource"]):
        reader.bound({"path": binding["path"], "sha256": binding["sha256"]})
    task_path = pack["sourceBindings"]["taskPackagePath"]
    require(task_path in known, "task snapshot must have authenticated raw binding")
    task = reader.bound({"path": task_path, "sha256": known[task_path]})
    source = task["sourceBindings"]
    close_decoder_inputs(reader, known, task, pack)
    for key in ("naturalizedWorldFacts", "seasonSnapshot", "regionalProfile"):
        reader.bound({"path": source[key + "Path"], "sha256": source[key + "Sha256"]})
    region = reader.bound({"path": row["regionSource"]["path"], "sha256": row["regionSource"]["sha256"]})
    provenance = region["sourceProvenance"]
    reader.bound({"path": provenance["sourceRegistryPath"], "sha256": provenance["sourceRegistrySha256"]})
    validate_network_metadata(context["manifest"])
    return {"package": package, "row": row, "pack": pack, "order": order, "continuous": continuous,
            "known": known, "sources": sources, "excludedRandomCalls": excluded,
            "sourceOrdinal": row["ordinal"], "trainSplitOrdinal": split["sampleIds"].index(sid)}


def close_decoder_inputs(reader, known, task, pack):
    """Authenticate the original decoder/regime's remaining raw snapshots."""
    source = task["sourceBindings"]
    visual = source["visualFactManifestPath"]
    governance = "scripts/lib/real-earth-region-governance.mjs"
    require(visual == pack["sourceBindings"]["visualFactManifestPath"]
            and source["visualFactManifestSha256"] == pack["visualFactManifestSha256"],
            "task/pack visual manifest identity differs")
    for path in (visual, governance):
        require(path in known, "decoder input must have original authenticated raw binding: " + path)
        reader.bound({"path": path, "sha256": known[path]}, json_data=False)


@contextmanager
def completed_g_evidence(result):
    """Retain completed G evidence if any later comparison/identity check fails."""
    raw = result["rawGradients"]
    completed = {key: value for key, value in result.items() if key != "rawGradients"}
    try:
        yield
    except BaseException as error:
        error.control_call_counts = dict(completed["callCounts"])
        error.control_original_gate_error = completed.get("originalGateError")
        error.control_completed_g_result = completed
        try:
            error.control_raw_summaries = [
                [{"unused": value is None,
                  "finite": value is None or bool(__import__("torch").isfinite(value).all()),
                  "shape": None if value is None else list(value.shape),
                  "sha256": None if value is None else tensor_sha(value)} for value in rows] for rows in raw]
        except BaseException as secondary:
            error.control_summary_error = str(secondary)[:512]
        raise


def tensor_sha(value):
    return hashlib.sha256(value.detach().cpu().contiguous().reshape(-1).view(
        __import__("torch").uint8).numpy().tobytes()).hexdigest()


def state_snapshot(network):
    return {"parameters": [(name, list(t.shape), str(t.dtype), tensor_sha(t), int(t._version),
                            bool(t.requires_grad), None if t.grad is None else tensor_sha(t.grad))
                           for name, t in network.named_parameters()],
            "buffers": [(name, list(t.shape), str(t.dtype), tensor_sha(t), int(t._version))
                        for name, t in network.named_buffers()],
            "modes": [(name, bool(module.training)) for name, module in network.named_modules()]}


def install_state(network, metadata, tensors):
    actual_p, actual_b = dict(network.named_parameters()), dict(network.named_buffers())
    require(list(actual_p) == [p["name"] for p in metadata["parameters"]] and
            list(actual_b) == [p["name"] for p in metadata["buffers"]], "exact state names/order differ")
    state = {}
    for group, actual in (("parameters", actual_p), ("buffers", actual_b)):
        for item in metadata[group]:
            tensor = tensors[item["key"]]
            require(list(actual[item["name"]].shape) == item["shape"] == list(tensor.shape)
                    and str(actual[item["name"]].dtype) == item["dtype"] == str(tensor.dtype)
                    and tensor.device.type == "cpu", "exact CPU state shape/dtype differs")
            state[item["name"]] = tensor.clone()
    network.load_state_dict(state, strict=True)
    modules = dict(network.named_modules())
    require(set(modules) == set(metadata["modes"]), "complete module mode map differs")
    for name, flag in metadata["modes"].items():
        modules[name].training = flag
    for item in metadata["parameters"]:
        parameter = actual_p[item["name"]]
        parameter.requires_grad_(item["requiresGrad"])
        parameter.grad = None
    require(all(tensor_sha(network.state_dict()[name]) == tensor_sha(value)
                for name, value in state.items()), "installed state bytes differ")


def module_guard(network, allowed_files):
    import torch
    allowed_torch = {"Sequential", "ModuleDict", "ModuleList", "ParameterList", "Conv2d",
                     "GroupNorm", "SiLU", "LeakyReLU", "ReLU", "Identity", "Linear",
                     "Tanh", "Sigmoid", "AvgPool2d", "MaxPool2d", "Upsample", "Flatten"}
    for module in network.modules():
        require(not any(getattr(module, field, {}) for field in
                        ("_forward_hooks", "_forward_pre_hooks", "_backward_hooks", "_backward_pre_hooks")),
                "unknown module hooks prohibited")
        if type(module).__module__.startswith("torch.nn"):
            require(type(module).__name__ in allowed_torch, "unknown torch module prohibited")
        else:
            require(str(Path(inspect.getfile(type(module))).resolve()) in allowed_files,
                    "unbound custom module class")
        require(not isinstance(module, (torch.nn.modules.dropout._DropoutNd,
                                       torch.nn.modules.batchnorm._BatchNorm)), "random/stateful module prohibited")
    require(all(not getattr(p, "_backward_hooks", None) for p in network.parameters()),
            "unknown parameter hooks prohibited")


def forbidden_guard(api):
    # Dynamo keys its lazy rule table by function identity. Each API needs a
    # distinct rejecting object; do not expose the original via __wrapped__.
    def forbidden(*args, **kwargs):
        raise RuntimeError("forbidden CUDA/D-autograd/optimizer/backward operation: " + api)
    return forbidden


@contextmanager
def torch_guards(torch, call, grad):
    with ExitStack() as stack:
        stack.enter_context(patch.object(torch.nn.Module, "__call__", call))
        stack.enter_context(patch.object(torch.autograd, "grad", grad))
        stack.enter_context(patch.object(torch.Tensor, "backward", forbidden_guard("Tensor.backward")))
        stack.enter_context(patch.object(torch.optim.Optimizer, "__init__", forbidden_guard("Optimizer.__init__")))
        for name in ("_lazy_init", "init", "is_available", "is_initialized", "device_count",
                     "get_rng_state", "get_rng_state_all", "set_rng_state", "manual_seed_all", "synchronize"):
            stack.enter_context(patch.object(torch.cuda, name, forbidden_guard("cuda." + name)))
        yield


def run_g_control(*, model, critic, sample, order, profile, deadline, allowed_files):
    """Shared original G graph with actual grad-call instrumentation; no steps."""
    import numpy as np
    import torch
    module_guard(model, allowed_files)
    module_guard(critic, allowed_files)
    require(sample.get("split") == "train", "only train sample permitted")
    parameters = tuple(model.parameters())
    require(len(parameters) == 107 and len(tuple(critic.parameters())) == 14
            and all(p.requires_grad and p.device.type == "cpu" and p.grad is None for p in parameters),
            "clean complete CPU generator required")
    require(all(p.device.type == "cpu" and p.grad is None for p in critic.parameters()), "clean CPU critic required")
    counts = {"generatorForwards": 0, "generatorAutogradAttempts": 0, "generatorAutogradCompleted": 0,
              "discriminatorAutograd": 0, "optimizerObjects": 0, "optimizerSteps": 0, "cudaCalls": 0}
    entry = state_snapshot(critic)
    rng = torch.random.get_rng_state().clone()
    python_rng, numpy_rng = random.getstate(), np.random.get_state()
    backend = (torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
               torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
    primary = None
    raw, labels, cleanup = [], ("actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb"), []
    original_grad, original_call = torch.autograd.grad, torch.nn.Module.__call__
    def call(module, *args, **kwargs):
        if module is model:
            counts["generatorForwards"] += 1
            require(counts["generatorForwards"] == 1, "extra generator forward prohibited")
        safe.deadline_check(deadline)
        return original_call(module, *args, **kwargs)
    def grad(loss, inputs, *args, **kwargs):
        actual_inputs = tuple(inputs)
        require(not args and len(actual_inputs) == len(parameters) and
                all(a is b for a, b in zip(actual_inputs, parameters)), "D/unknown autograd input prohibited")
        i = counts["generatorAutogradAttempts"]
        require(i < 4 and kwargs == {"retain_graph": i < 3, "create_graph": False, "allow_unused": True},
                "original four-gradient call contract differs")
        counts["generatorAutogradAttempts"] += 1
        safe.deadline_check(deadline)
        values = original_grad(loss, inputs, **kwargs)
        require(len(values) == 107, "partial raw gradient set")
        counts["generatorAutogradCompleted"] += 1
        return values
    def observer(stage, label, values):
        require(label == labels[len(raw)] if len(raw) < 4 else False, "gradient observation order differs")
        if stage == "complete":
            require(len(values) == 107 and counts["generatorAutogradCompleted"] == len(raw) + 1,
                    "observer completion without real grad call")
            raw.append(values)
        else:
            require(stage == "attempt", "unknown gradient observation event")
    try:
        critic.eval().requires_grad_(False)
        require(all(not m.training for m in critic.modules()) and
                all(not p.requires_grad for p in critic.parameters()), "critic G phase not frozen eval")
        before = {"model": state_snapshot(model), "critic": state_snapshot(critic),
                  "input": {k: tensor_sha(sample[k]) for k in ("image", "conditions", "appearance_regime")},
                  "table": safe.digest(safe.encoded(sample["objectInstanceTable"]))}
        with torch_guards(torch, call, grad):
            with profile.observe_generator_gradients(observer):
                prediction = profile.sample_forward(model, sample)
                try:
                    profile._generator_candidate(model, critic, sample, order, prediction)
                    outcome = "cpu_original_gate_passed"
                except ValueError as error:
                    if re.fullmatch(r"actual total gradient identity differs at parameter \d+", str(error)) and len(raw) == 4:
                        outcome = "cpu_original_gate_failed"
                        original_gate_error = str(error)
                    else:
                        raise
        require(counts["generatorForwards"] == 1 and counts["generatorAutogradCompleted"] == 4 and len(raw) == 4,
                "one forward/four complete actual gradients required")
        require(all(v is None or (v.device.type == "cpu" and v.dtype == torch.float32 and
                                  bool(torch.isfinite(v).all())) for rows in raw for v in rows),
                "raw gradients nonfinite or non-CPU")
        after = {"model": state_snapshot(model), "critic": state_snapshot(critic),
                 "input": {k: tensor_sha(sample[k]) for k in ("image", "conditions", "appearance_regime")},
                 "table": safe.digest(safe.encoded(sample["objectInstanceTable"]))}
        require(before == after, "G changed state/input/modes/gradients")
        require(torch.equal(rng, torch.random.get_rng_state()) and python_rng == random.getstate()
                and numpy_rng[0] == np.random.get_state()[0] and
                np.array_equal(numpy_rng[1], np.random.get_state()[1]) and
                numpy_rng[2:] == np.random.get_state()[2:], "G changed RNG")
        require(backend == (torch.backends.mkldnn.enabled, torch.backends.mkldnn.deterministic,
                            torch.are_deterministic_algorithms_enabled(),
                            torch.is_deterministic_algorithms_warn_only_enabled()), "G changed CPU backend")
        safe.deadline_check(deadline)
        return {"outcome": outcome, "originalGateError": locals().get("original_gate_error"),
                "callCounts": counts, "rawGradients": raw, "before": before, "after": after,
                "stateInputRngUnchanged": True}
    except BaseException as error:
        primary = error
        error.control_call_counts = counts
        error.control_original_gate_error = locals().get("original_gate_error")
        try:
            error.control_raw_summaries = [
                [{"unused": v is None, "finite": v is None or bool(torch.isfinite(v).all()),
                  "shape": None if v is None else list(v.shape),
                  "sha256": None if v is None else tensor_sha(v)} for v in rows] for rows in raw]
            if "before" in locals():
                error.control_state_unchanged_on_failure = (
                    before["model"] == state_snapshot(model) and before["critic"] == state_snapshot(critic)
                    and before["input"] == {k: tensor_sha(sample[k]) for k in
                                           ("image", "conditions", "appearance_regime")}
                    and before["table"] == safe.digest(safe.encoded(sample["objectInstanceTable"])))
        except BaseException as secondary:
            error.control_summary_error = str(secondary)[:512]
        raise
    finally:
        operations = [
            lambda: torch.random.set_rng_state(rng),
            lambda: random.setstate(python_rng), lambda: np.random.set_state(numpy_rng),
            lambda: setattr(torch.backends.mkldnn, "enabled", backend[0]),
            lambda: setattr(torch.backends.mkldnn, "deterministic", backend[1]),
            lambda: torch.use_deterministic_algorithms(backend[2], warn_only=backend[3])]
        modules, params = dict(critic.named_modules()), dict(critic.named_parameters())
        operations += [lambda n=n, f=f: setattr(modules[n], "training", f) for n, f in entry["modes"]]
        operations += [lambda n=p[0], f=p[5]: params[n].requires_grad_(f) for p in entry["parameters"]]
        for operation in operations:
            try:
                operation()
            except BaseException as secondary:
                cleanup.append(str(secondary)[:512])
        if cleanup:
            if primary is not None:
                primary.control_cleanup_errors = cleanup
            else:
                raise RuntimeError("G cleanup failed: " + repr(cleanup))


def worker(root, binding, output, identity, deadline, history_binding=None):
    safe.verify_owned_worker()
    safe.deadline_check(deadline)  # inherited deadline; never a fresh120sec
    reader = make_reader(root, deadline, binding, history_binding)
    claim = json.loads((output / "control-inputs.json").read_bytes())
    require(claim["identity"] == identity and claim["terminalBinding"] == binding
            and claim.get("historyBinding") == history_binding
            and claim["deadline"] == deadline and math.isfinite(deadline)
            and deadline <= time.monotonic() + LIMITS["wallSeconds"], "worker claim/deadline differs")
    context = safe.preflight(reader, binding)
    inputs = input_preflight(reader, context)
    programs = bindings(root, deadline)
    observe_programs(reader, programs, history_binding)
    if history_binding is not None:
        request = safe.digest(safe.encoded({"terminal": binding, "programs": programs,
            "algorithm": SCHEMA, "limits": LIMITS,
            "history": {"mode": HISTORY_MODE, "binding": history_binding, "inputs": reader.observed}}))
        control_claim = json.loads((output / "control-claim.json").read_bytes())
        require(output.name == "control-" + request and control_claim["requestIdentity"] == request
                and control_claim.get("historyBinding") == history_binding, "worker request/history namespace conflict")
    require(identity == control_identity(reader, programs, binding, history_binding), "worker inputs/programs changed")
    capture = safe.load_capture(root)
    torch = capture.torch
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    require(not getattr(torch.cuda, "_initialized", False), "unexpected CUDA initialization")
    artifact = context["receipt"]["artifacts"]["tensors"]
    with safe.locked_capture_archive(Path(artifact["path"])):
        archive_guard = safe.inspect_tensor_archive(Path(artifact["path"]),
                        context["manifest"]["tensorDescriptors"], expected_sha=artifact["sha256"])
        data = Path(artifact["path"]).read_bytes()
        require(len(data) == artifact["bytes"] and safe.digest(data) == artifact["sha256"], "archive changed")
        tensors = capture._verify_tensors(data, context["manifest"]["tensorDescriptors"])
    for path in (root / "ml/ai-painter/src", root / "ml/ai-painter/scripts"):
        sys.path.insert(0, str(path))
    import check_stage4_mvp_structured_object_v18_cpu_acceptance as decoder
    import painter_stage4_appearance_regime_checkpoint_worker as attached
    import painter_stage4_appearance_regime_probe as profile
    adapter = InputReader(reader, inputs["known"])
    sample, decoded_identity = decoder.load_sample(adapter, inputs["row"], inputs["order"], inputs["continuous"])
    sample = attached.attach_regime(adapter, inputs["row"], sample)
    require(sample["sampleId"] == context["location"]["sampleId"] and sample["split"] == "train", "decoded source differs")
    model, critic = profile.fresh_networks(inputs["order"])
    install_state(model, context["manifest"]["networks"]["model"], tensors)
    install_state(critic, context["manifest"]["networks"]["critic"], tensors)
    require(tensor_sha(sample["appearance_regime"]) == context["manifest"]["tensorDescriptors"]["sample.appearance_regime"]["sha256"],
            "reconstructed season differs")
    # Existing constructor RNG is isolated; preserve CPU process state, never fake missing pre-G RNG.
    allowed = {str(safe.logical_path(root, p).resolve()) for p in inputs["sources"] if p.endswith(".py")}
    result = run_g_control(model=model, critic=critic, sample=sample, order=inputs["order"],
                           profile=profile, deadline=deadline, allowed_files=allowed)
    with completed_g_evidence(result):
        raw = result.pop("rawGradients")
        named, groups, values = list(model.named_parameters()), [], {}
        for j, rows in enumerate(raw):
            groups.append([])
            for i, value in enumerate(rows):
                key = None if value is None else f"gradient.{j}.{i}"
                groups[-1].append({"key": key, "unused": value is None})
                if value is not None:
                    values[key] = value.detach()
        comparison = capture._comparison(named, groups, values, [], ValueError(result["originalGateError"] or "CPU gate passed"))
        bad_indices, bad_count = [], 0
        for i, (_, parameter) in enumerate(named):
            a, s, w, c = [torch.zeros_like(parameter) if rows[i] is None else rows[i] for rows in raw]
            expected = (s.float() + w.float()).float() + c.float()
            bad = torch.nonzero((~torch.isclose(a, expected, atol=1e-6, rtol=1e-5)).reshape(-1),
                                as_tuple=False).reshape(-1)
            bad_count += bad.numel()
            require(bad_count <= 8192, "all-bad-index diagnostic output budget exceeded")
            bad_indices.append({"parameterIndex": i, "flatIndices": bad.tolist()})
        require((comparison["passedAllOriginalToleranceMasks"] is True) ==
                (result["outcome"] == "cpu_original_gate_passed"), "CPU gate/statistics conflict")
        reader.unchanged()
        safe.deadline_check(deadline)
        report = {"schemaVersion": SCHEMA, "status": "cpu_surrogate_complete_diagnostic_only",
                  "identity": identity, "terminalBinding": binding, "originalCudaFailure": context["originalError"],
                  "location": context["location"], "actualTrainingCountsUnchanged": context["counts"],
                  "comparison": comparison, "result": result, "decodedIdentity": decoded_identity,
                  "allBadIndices": bad_indices,
                  "rawGradientSummaries": [[{"unused": v is None, "sha256": None if v is None else tensor_sha(v),
                                             "shape": None if v is None else list(v.shape)}
                                            for v in rows] for rows in raw],
                  "inputBindings": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
                  "programBindings": programs, "snapshotDeserializations": 1, "archivePreflight": archive_guard,
                  "boundary": BOUNDARY, "limits": LIMITS, "surrogateGaps": [
                      "pre-G RNG not captured; no stochastic bound G forward route; no fabricated pre-state",
                      "historical decoded tensors and library binaries not captured",
                      "new CPU graph/backends cannot prove CUDA root cause"],
                  "excludedRandomSourceCalls": inputs["excludedRandomCalls"]}
        import numpy as np
        import PIL
        report["currentRuntimeVersions"] = {"torch": torch.__version__, "numpy": np.__version__,
                                           "Pillow": PIL.__version__}
        if history_binding is not None:
            after_identity = control_identity(reader, programs, binding, history_binding)
            require(after_identity == identity, "history/input final identity differs")
            report.update(historyMode=HISTORY_MODE, historyBinding=history_binding,
                          inputIdentityBeforeAfter={"before": identity, "after": after_identity})
        return safe.write_exclusive(output, "worker-result.json", report)


def owned_failure_metadata(output, identity, terminal_binding):
    """Read only a stopped owned worker's bounded evidence; absent counts unknown."""
    result = {"workerErrorBinding": None, "callCounts": None, "originalCpuGateError": None,
              "cleanupErrors": None, "rawSummaryBinding": None}
    file = output / "worker-error.json"
    if not file.exists():
        return result
    require(not file.is_symlink() and file.resolve().parent == output.resolve()
            and file.stat().st_size <= LIMITS["failureReserveBytes"] // 4, "unsafe worker error receipt")
    raw = file.read_bytes()
    require(len(raw) <= LIMITS["failureReserveBytes"] // 4, "worker receipt grew")
    error = json.loads(raw)
    require(error.get("identity") == identity and error.get("terminalBinding") == terminal_binding
            and error.get("boundary") == BOUNDARY, "worker error identity differs")
    result["workerErrorBinding"] = {"path": str(file), "sha256": safe.digest(raw)}
    result["workerError"] = {"type": error["errorType"], "message": error["error"]}
    counts = error.get("callCounts")
    if counts is not None:
        require(type(counts) is dict and set(counts) ==
                {"generatorForwards", "generatorAutogradAttempts", "generatorAutogradCompleted",
                 "discriminatorAutograd", "optimizerObjects", "optimizerSteps", "cudaCalls"}
                and all(type(n) is int and 0 <= n <= 8192 for n in counts.values()),
                "worker counts receipt differs")
        result["callCounts"] = counts
    result["originalCpuGateError"] = error.get("originalCpuGateError")
    result["cleanupErrors"] = error.get("cleanupErrors")
    result["stateUnchangedOnFailure"] = error.get("stateUnchangedOnFailure")
    completed_binding = error.get("completedGReceiptBinding")
    if completed_binding is not None:
        completed_file = output / "completed-g-receipt.json"
        require(type(completed_binding) is dict and set(completed_binding) == {"path", "sha256"}
                and Path(completed_binding["path"]).absolute() == completed_file.absolute()
                and not completed_file.is_symlink() and completed_file.resolve().parent == output.resolve()
                and completed_file.stat().st_size <= LIMITS["jsonBytes"], "completed G receipt escaped output")
        data = completed_file.read_bytes()
        require(safe.digest(data) == completed_binding["sha256"], "completed G receipt SHA differs")
        receipt = json.loads(data)
        require(receipt["callCounts"] == counts, "completed G receipt counts conflict")
        result["completedGReceiptBinding"] = completed_binding
    binding = error.get("rawSummaryBinding")
    if binding is not None:
        require(type(binding) is dict and set(binding) == {"path", "sha256"}, "partial summary binding differs")
        summary = output / "partial-raw-summaries.json"
        require(Path(binding["path"]).absolute() == summary.absolute() and not summary.is_symlink()
                and summary.resolve().parent == output.resolve()
                and summary.stat().st_size <= LIMITS["jsonBytes"], "partial summary escaped output")
        data = summary.read_bytes()
        require(len(data) <= LIMITS["jsonBytes"] and safe.digest(data) == binding["sha256"],
                "partial summary SHA differs")
        json.loads(data)
        result["rawSummaryBinding"] = binding
    return result


def diagnose(*, terminal_binding, root=ROOT, history_binding=None):
    root = Path(os.path.abspath(root))
    deadline = time.monotonic() + LIMITS["wallSeconds"]
    programs = bindings(root, deadline)
    request_payload = {"terminal": terminal_binding, "programs": programs, "algorithm": SCHEMA, "limits": LIMITS}
    if history_binding is not None:
        bootstrap = make_reader(root, deadline, terminal_binding, history_binding)
        context = safe.preflight(bootstrap, terminal_binding)
        input_preflight(bootstrap, context)
        observe_programs(bootstrap, programs, history_binding)
        bootstrap.unchanged()
        request_payload["history"] = {"mode": HISTORY_MODE, "binding": history_binding, "inputs": bootstrap.observed}
    request = safe.digest(safe.encoded(request_payload))
    output = safe.logical_path(root, (NEW_PARENT if history_binding is not None else PARENT) + "/control-" + request)
    if output.exists():
        require(safe.output_bytes(output) <= LIMITS["outputBytes"], "cached output over budget")
        claim, final, intent = (output / name for name in ("control-claim.json", "control-terminal.json", "control-commit.json"))
        require(all(p.is_file() and p.stat().st_size <= LIMITS["jsonBytes"] for p in (claim, final, intent)),
                "incomplete or unknown claim; no retry")
        c, f, i = (json.loads(p.read_bytes()) for p in (claim, final, intent))
        require(c["requestIdentity"] == request and f["requestIdentity"] == request and
                safe.digest(final.read_bytes()) == i["terminal"]["sha256"] and
                Path(i["terminal"]["path"]).absolute() == final.absolute() and
                i["identity"] == f["identity"], "cached identity/hash conflict")
        require(f["boundary"] == BOUNDARY and f["status"] in
                ("cpu_surrogate_complete_diagnostic_only", "cpu_surrogate_failed_closed"),
                "unknown cached terminal")
        if history_binding is not None:
            require(c.get("historyBinding") == f.get("historyBinding") == history_binding
                    and f.get("historyMode") == HISTORY_MODE, "cached history binding conflict")
        if f["status"] == "cpu_surrogate_failed_closed":
            return i["terminal"]  # terminal failure is immutable; never retry
        reader = make_reader(root, deadline, terminal_binding, history_binding)
        context = safe.preflight(reader, terminal_binding)
        input_preflight(reader, context)
        observe_programs(reader, programs, history_binding)
        if history_binding is not None:
            require(reader.observed == bootstrap.observed, "cached history request inputs changed")
        identity = control_identity(reader, programs, terminal_binding, history_binding)
        require(identity == f["identity"], "cached input identity changed; no retry")
        reader.unchanged()
        return i["terminal"]
    output.mkdir(parents=True, exist_ok=False)
    identity, context, process = None, None, None
    safe.write_exclusive(output, "control-claim.json", {"requestIdentity": request, "terminalBinding": terminal_binding,
                                                     "programBindings": programs, "boundary": BOUNDARY,
                                                     **({"historyBinding": history_binding} if history_binding else {})})
    try:
        reader = make_reader(root, deadline, terminal_binding, history_binding)
        context = safe.preflight(reader, terminal_binding)
        input_preflight(reader, context)
        observe_programs(reader, programs, history_binding)
        if history_binding is not None:
            require(reader.observed == bootstrap.observed, "history request inputs changed before worker")
        identity = control_identity(reader, programs, terminal_binding, history_binding)
        safe.write_exclusive(output, "control-inputs.json", {"identity": identity, "terminalBinding": terminal_binding,
                                                         "deadline": deadline,
                                                         **({"historyBinding": history_binding} if history_binding else {})})
        argv = [sys.executable, "-B", str(safe.logical_path(root, ENTRY)), "--worker",
                "--terminal", terminal_binding["path"], "--sha256", terminal_binding["sha256"],
                "--output", str(output.relative_to(root)).replace("\\", "/"), "--identity", identity,
                "--deadline", str(deadline)]
        if history_binding is not None:
            argv += ["--history-binding", history_binding["path"], "--history-sha256", history_binding["sha256"]]
        process = safe.run_owned_process(argv, cwd=root, deadline=deadline, evidence_root=output)
        safe.write_exclusive(output, "owned-process.json", process)
        require(process["cleanupConfirmed"] and not process["timedOut"] and process["exitCode"] == 0,
                "owned CPU worker failed or timed out")
        worker_file = output / "worker-result.json"
        require(worker_file.stat().st_size <= LIMITS["jsonBytes"], "worker report over budget")
        result = json.loads(worker_file.read_bytes())
        require(result["identity"] == identity and result["programBindings"] == programs and
                result["boundary"] == BOUNDARY and result["status"] == "cpu_surrogate_complete_diagnostic_only",
                "worker result identity differs")
        if history_binding is not None:
            require(result.get("historyBinding") == history_binding and result.get("historyMode") == HISTORY_MODE
                    and result.get("inputIdentityBeforeAfter") == {"before": identity, "after": identity},
                    "worker history identity differs")
        reader.unchanged()
        safe.deadline_check(deadline)
        result.update(requestIdentity=request, ownedProcess=process)
    except BaseException as error:
        result = {"schemaVersion": SCHEMA, "status": "cpu_surrogate_failed_closed", "requestIdentity": request,
                  "identity": identity, "errorType": type(error).__name__, "error": str(error)[:4096],
                  "originalCudaFailure": context["originalError"] if context else None,
                  "ownedProcess": process or getattr(error, "owned_process_receipt", None), "boundary": BOUNDARY}
        owned = result["ownedProcess"]
        if owned is not None and owned.get("cleanupConfirmed"):
            try:
                result["ownedWorkerFailure"] = owned_failure_metadata(output, identity, terminal_binding)
            except BaseException as metadata_error:
                result["ownedWorkerFailure"] = {"callCounts": None, "metadataError": str(metadata_error)[:1024]}
        else:
            result["ownedWorkerFailure"] = {"callCounts": None, "metadataError": "owned cleanup unconfirmed or no worker"}
    if history_binding is not None:
        result.update(historyMode=HISTORY_MODE, historyBinding=history_binding)
    terminal = {"path": str(output / "control-terminal.json"), "sha256": safe.digest(safe.encoded(result))}
    safe.write_exclusive(output, "control-commit.json", {"terminal": terminal, "identity": identity}, failure=True)
    return safe.write_exclusive(output, "control-terminal.json", result,
                                failure=result["status"] == "cpu_surrogate_failed_closed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terminal", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--history-binding")
    parser.add_argument("--history-sha256")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--output", help=argparse.SUPPRESS)
    parser.add_argument("--identity", help=argparse.SUPPRESS)
    parser.add_argument("--deadline", type=float, help=argparse.SUPPRESS)
    args = parser.parse_args()
    binding = {"path": args.terminal, "sha256": args.sha256}
    require(bool(args.history_binding) == bool(args.history_sha256), "history binding requires path and SHA")
    history_binding = {"path": args.history_binding, "sha256": args.history_sha256} if args.history_binding else None
    if args.worker:
        require(args.deadline and args.identity and re.fullmatch("[a-f0-9]{64}", args.identity)
                and args.output.startswith((NEW_PARENT if history_binding else PARENT) + "/control-"), "worker control identity absent")
        output = safe.logical_path(ROOT, args.output)
        try:
            worker(ROOT, binding, output, args.identity, args.deadline, history_binding)
        except BaseException as error:
            failure = {"identity": args.identity, "terminalBinding": binding,
                       "errorType": type(error).__name__, "error": str(error)[:4096],
                       "callCounts": getattr(error, "control_call_counts", None),
                       "originalCpuGateError": getattr(error, "control_original_gate_error", None),
                       "cleanupErrors": getattr(error, "control_cleanup_errors", None), "boundary": BOUNDARY}
            failure["stateUnchangedOnFailure"] = getattr(error, "control_state_unchanged_on_failure", None)
            failure["summaryError"] = getattr(error, "control_summary_error", None)
            summaries = getattr(error, "control_raw_summaries", None)
            completed = getattr(error, "control_completed_g_result", None)
            if completed is not None:
                try:
                    failure["completedGReceiptBinding"] = safe.write_exclusive(output, "completed-g-receipt.json", completed)
                except BaseException as publication:
                    failure["completedGReceiptPublicationError"] = str(publication)[:512]
            if summaries:
                try:
                    failure["rawSummaryBinding"] = safe.write_exclusive(output, "partial-raw-summaries.json", summaries)
                except BaseException as publication:
                    failure["rawSummaryPublicationError"] = str(publication)[:512]
            try:
                safe.write_exclusive(output, "worker-error.json", failure, failure=True)
            except BaseException as publication:
                error.control_publication_error = str(publication)
            raise
    else:
        result = diagnose(terminal_binding=binding, history_binding=history_binding)
        print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        if "--worker" not in sys.argv:
            print(json.dumps({"status": "cpu_surrogate_failed_closed", "error": str(error)[:4096]}), file=sys.stderr)
        sys.exit(1)

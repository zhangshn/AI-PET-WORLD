"""Independent source-frozen four-train CPU execution bridge, once, zero updates."""
from __future__ import annotations
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import _thread
import time

ROOT = Path(os.path.abspath(__file__)).parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src")); sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import torch
import check_stage4_mvp256_dry_appearance_regime_bias_precision_cpu as predecessor
import painter_stage4_appearance_regime_probe as profile
from ai_painter.complete_world.object_appearance_regime_bias_precision import (
    build_fresh_object_appearance_regime_bias_precision as build, CAPABILITY, ARCHITECTURE, NUMERIC_RULE,
    parameter_initialization_digest, validate_model_identity)
from ai_painter.complete_world.object_appearance_regime_priority_update import bind_parameters

comparison = predecessor.comparison
parent = predecessor.parent
require = parent.require
OUTPUT = parent.DIAG + "/season-managed-execution-t-q4-36/numeric"
WORK = {"path": parent.DIAG + "/season-managed-execution-t-q4-36/numeric-workorder.json", "sha256": "b521f4dca645f14430d407ce77e4ee137c2f6c9148867697a758e24dda3b9414"}
PREDECESSOR = {"path": predecessor.OUTPUT + "/report.json", "sha256": "0c94447559100fa3fdc62fe845ac013eb9a53beaf294ef7db9b891fc4907cb7f"}
ACCEPT = {"path": predecessor.OUTPUT + "/controller-acceptance.json", "sha256": "7dab39ae5059df092331427abc0bf8bb1c63405ad031ebdb5328fadfa241bdef"}
MODULES = ("rgb_bias_reduction_precision", "object_appearance_regime_bias_precision", "object_appearance_regime_priority_update")
SCRIPTS = ("painter_stage4_appearance_regime_probe", "check_stage4_appearance_regime_execution_cpu")
FILES = ["ml/ai-painter/src/ai_painter/complete_world/" + name + ".py" for name in MODULES] + [
    "ml/ai-painter/scripts/" + name + ".py" for name in SCRIPTS] + [
    "ml/ai-painter/tests/test_" + name + ".py" for name in MODULES + SCRIPTS]
SELECTED = predecessor.SELECTED
BUDGET = predecessor.BUDGET
EXPECTED = {"modelForwardsAttempted": 4, "modelForwardsCompleted": 4,
    "generatorGradCallsAttempted": 16, "generatorGradCallsCompleted": 16,
    "discriminatorGradCallsAttempted": 4, "discriminatorGradCallsCompleted": 4}
FrozenReader = comparison.FrozenReader


class Counters(dict):
    def __init__(self):
        super().__init__({key: 0 for key in EXPECTED}); self.window = dict(EXPECTED)
    def begin_case(self):
        self.window = {key: min(EXPECTED[key], self[key] + (4 if key.startswith("generator") else 1)) for key in EXPECTED}
    def __setitem__(self, key, value):
        require(key in EXPECTED and type(value) is int and value == self[key] + 1 and value <= self.window[key], "counter/call limit differs")
        super().__setitem__(key, value)


def source_closure(reader):
    seen = set(predecessor.source_closure(reader)); pending = list(FILES)
    roots = ("ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests")
    def locate(name):
        for root in roots:
            for suffix in (name.replace(".", "/") + "/__init__.py", name.replace(".", "/") + ".py"):
                if reader.path(root + "/" + suffix).is_file(): return root + "/" + suffix
        return None
    while pending:
        path = pending.pop()
        if path in seen: continue
        seen.add(path); payload, _ = reader.snapshot(path)
        root = next(root for root in roots if path.startswith(root + "/")); parts = path[len(root) + 1:].split("/")[:-1]
        for i in range(1, len(parts) + 1):
            init = root + "/" + "/".join(parts[:i]) + "/__init__.py"
            if reader.path(init).is_file(): pending.append(init)
        for node in ast.walk(ast.parse(payload, filename=path)):
            names = []
            if isinstance(node, ast.Import): names = [item.name for item in node.names]
            elif isinstance(node, ast.ImportFrom):
                base = ".".join(parts[:len(parts) - node.level + 1]) if node.level else ""
                name = ".".join(v for v in (base, node.module) if v)
                names = [name] + [name + "." + item.name for item in node.names if item.name != "*"]
            for name in names:
                dependency = locate(name)
                if dependency: pending.append(dependency)
    return sorted(seen)


def prepare_metadata(reader, collect_assets=False):
    return profile.prepare_metadata(reader, comparison.capture.DIAGNOSTIC, comparison.capture.CONDITION,
        collect_train_assets=collect_assets)


def binding_template(reader=None):
    """Metadata and opaque hashes only: no construction, pixel decode, or claim."""
    reader = reader or parent.Reader()
    work = reader.json(WORK)
    require(work["workOrder"] == "T-Q4-36-N" and set(work["allowedFiles"]) == set(FILES)
        and work["evidenceRoot"] == OUTPUT and work["capability"] == CAPABILITY and work["architecture"] == ARCHITECTURE, "workorder differs")
    for binding in work["documents"]: reader.read(binding)
    reader.read(PREDECESSOR); reader.read(ACCEPT); reader.read(comparison.capture.REGISTRY)
    closure = source_closure(reader)
    plan = prepare_metadata(reader, collect_assets=True)
    reader.unchanged()
    return {"schemaVersion": "t-q4-36-n-frozen-bindings-v1", "task": "T-Q4-36-N", "capabilityVersion": CAPABILITY,
        "architecture": ARCHITECTURE, "budget": BUDGET,
        "selection": [{"trainOrdinal": o, "season": s} for o, s in SELECTED],
        "metadataCounts": plan["metadataCounts"], "validationRgbRead": False, "executionAuthorityGranted": False,
        "sourceClosure": closure, "bindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())]}


def authenticate(reader, manifest):
    require(manifest["schemaVersion"] == "t-q4-36-n-frozen-bindings-v1" and manifest["task"] == "T-Q4-36-N"
        and manifest["capabilityVersion"] == CAPABILITY and manifest["architecture"] == ARCHITECTURE
        and manifest["budget"] == BUDGET and manifest["selection"] == [{"trainOrdinal": o, "season": s} for o, s in SELECTED]
        and manifest["metadataCounts"] == {"train": 48, "validation": 8}
        and manifest["validationRgbRead"] is False and manifest["executionAuthorityGranted"] is False, "frozen contract differs")
    for binding in manifest["bindings"]: reader.read(binding)
    actual = binding_template(reader)
    require(actual["sourceClosure"] == manifest["sourceClosure"], "own complete source closure differs")
    required = {item["path"]: item["sha256"] for item in actual["bindings"]}
    frozen = {item["path"]: item["sha256"] for item in manifest["bindings"]}
    require(all(frozen.get(path) == sha for path, sha in required.items() if path != OUTPUT + "/frozen-bindings.json"), "required immutable binding missing")
    registry = reader.json(comparison.capture.REGISTRY)
    require(registry["registryRevision"] == 371 and registry["activeExecution"] is None and registry["nextMachineAction"] is None, "registry not idle")
    previous = reader.json(PREDECESSOR)
    require(previous["status"] == "fixed_four_cpu_checked_not_execution_qualified", "predecessor evidence differs")
    parent.verify_loaded_sources(reader, manifest["sourceClosure"])


def graph(model):
    parameters, groups, index = bind_parameters(model)
    return parameters, groups, index, {"capabilityVersion": CAPABILITY, "architecture": ARCHITECTURE,
        "numericRule": NUMERIC_RULE, "tensors": 107, "elements": 2240671, "seasonalElements": 1152,
        "seasonalParameterIndex": index, "headIndices": {key: list(rows) for key, rows in groups.items()},
        "parameters": [{"name": name, "shape": list(p.shape), "elements": p.numel()} for name, p in model.named_parameters()]}


def load_real(reader, plan, ordinal, season):
    sample, code, identity = parent.load_real(reader, plan, ordinal, season)
    record = plan["selected"][str(ordinal)]
    bound = profile.bind_sample_season(reader, sample, record["identity"], record["regimeRecord"])
    require(torch.equal(code, bound["appearance_regime"]), "source regime differs")
    return bound, code, identity


def probe(model, critic, sample, code, counters, budget, *, failure_evidence=None):
    parameters, _, _, actual_graph = graph(model); raw = []
    require(torch.equal(sample["appearance_regime"], code), "checker regime differs")
    def event(stage, kind, gradients):
        prefix = {"forward": "modelForwards", "generator": "generatorGradCalls", "discriminator": "discriminatorGradCalls"}[kind]
        counters[prefix + ("Attempted" if stage == "attempt" else "Completed")] += 1
        if kind == "generator" and stage == "complete": raw.append(gradients)
    try:
        facts = profile.zero_update_probe(model, critic, sample, model.condition_channel_order, budget,
            event=event, failure_evidence=failure_evidence)
        facts["allParameterIdentity"] = comparison.summarize_all(parameters, actual_graph, raw, [])
        return facts
    except BaseException as error:
        try:
            parent.record_gradient_failure(failure_evidence, actual_graph, parameters, raw, error)
            if failure_evidence is not None and len(raw) == 4:
                failure_evidence["allParameterIdentity"] = comparison.summarize_all(parameters, actual_graph, raw, [])
        except BaseException as secondary:
            profile._diagnostic_append(failure_evidence, "secondaryDiagnosticErrors", str(secondary), error)
        raise


def write_exclusive(output, name, value):
    require(name in ("claim.json", "report.json", "failure.json"), "terminal filename differs")
    data = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    require(len(data) + sum(p.stat().st_size for p in output.rglob("*") if p.is_file()) <= BUDGET["outputBytes"], "combined16MiB output exceeded")
    with (output / name).open("xb") as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
    return {"path": str(output / name), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def execute(binding=None, *, output=None, synthetic=False, prepare=None, loader=None, model_factory=None,
        baseline_factory=None, critic_factory=None, graph_function=None, probe_function=None, clock=None):
    output = Path(os.path.abspath(output or ROOT / OUTPUT))
    callbacks = (prepare, loader, model_factory, baseline_factory, critic_factory, graph_function, probe_function, clock)
    if synthetic:
        require(output.is_relative_to(Path(os.path.abspath(tempfile.gettempdir()))) and all(callbacks[:7]), "isolated synthetic callbacks required")
        reader = parent.Reader(); manifest = None
    else:
        require(output == Path(os.path.abspath(ROOT / OUTPUT)) and all(v is None for v in callbacks), "real callbacks/output overrides prohibited")
        require(binding and binding["path"] == OUTPUT + "/frozen-bindings.json", "unique own frozen manifest required")
        manifest = parent.Reader().json(binding)
        reader = FrozenReader(manifest["bindings"] + [binding])
        reader.read(binding)
        prepare, loader, model_factory, baseline_factory = prepare_metadata, load_real, build, predecessor.build
        critic_factory, graph_function, probe_function = parent.build_conditional_texture_discriminator, graph, probe
    output.mkdir(parents=True, exist_ok=True)
    require(not any((output / name).exists() for name in ("claim.json", "report.json", "failure.json")), "new check already consumed; no retry")
    require(sum(p.stat().st_size for p in output.rglob("*") if p.is_file()) <= BUDGET["outputBytes"] - 1048576, "terminal reserve unavailable")
    write_exclusive(output, "claim.json", {"task": "T-Q4-36-N", "binding": binding, "synthetic": synthetic,
        "attempt": 1, "automaticRetries": 0, "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
    clock = clock or time.monotonic; started = clock(); expired = threading.Event()
    def interrupt(): expired.set(); _thread.interrupt_main()
    timer = threading.Timer(180, interrupt); timer.daemon = True; timer.start()
    def budget(): require(not expired.is_set() and 0 <= clock() - started < 180, "CPU180-second budget exceeded")
    threads = torch.get_num_threads(); rng = torch.random.get_rng_state().clone(); flags = comparison.backend_state()
    counters = Counters(); results = []; evidence = {}; actual_graph = initial = initialization = None; primary = None
    try:
        torch.set_num_threads(2)
        with comparison.capture.guards(output), torch.random.fork_rng(devices=[]):
            budget(); require(not torch.cuda.is_initialized(), "actual CPU check cannot initialize CUDA")
            if not synthetic: authenticate(reader, manifest)
            plan = prepare(reader)
            model = model_factory(condition_channel_order=plan["order"]).train()
            baseline = baseline_factory(condition_channel_order=plan["order"]).train()
            old, new = tuple(baseline.named_parameters()), tuple(model.named_parameters())
            require(len(old) == len(new) and all(n == m and comparison.same_bytes(p, q)
                for (n, p), (m, q) in zip(old, new)), "CPU predecessor initialization differs")
            initialization = {"originalParameterDigest": parameter_initialization_digest(baseline), "successorParameterDigest": parameter_initialization_digest(model)}
            del baseline
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(20260929); critic = critic_factory().eval().requires_grad_(False)
            _, _, _, actual_graph = graph_function(model)
            initial = {"model": parent.state(model), "critic": parent.state(critic)}
            for ordinal, season in SELECTED:
                budget(); before = dict(counters); counters.begin_case()
                evidence = {"trainOrdinal": ordinal, "season": season, "status": "not_started"}
                sample, code, identity = loader(reader, plan, ordinal, season)
                require(sample["split"] == "train" and torch.equal(code, parent.encode_season(season))
                    and sample["sampleId"] == plan["selected"][str(ordinal)]["identity"]["sampleId"], "fixed train source differs")
                facts = probe_function(model, critic, sample, code, counters, budget, failure_evidence=evidence)
                delta = {key: counters[key] - before[key] for key in counters}
                require(delta == {key: 4 if key.startswith("generator") else 1 for key in EXPECTED}, "per-case exact calls differ")
                require(initial == {"model": parent.state(model), "critic": parent.state(critic)}
                    and all(p.grad is None for n in (model, critic) for p in n.parameters()), "per-case state changed")
                require(flags == comparison.backend_state(), "backend changed")
                if not synthetic: validate_model_identity(model); parent.verify_loaded_sources(reader, manifest["sourceClosure"])
                reader.unchanged(); budget()
                results.append({"trainOrdinal": ordinal, "season": season, "loadedIdentity": identity, "callCounts": delta, **facts})
            require(dict(counters) == EXPECTED and len(results) == 4 and not torch.cuda.is_initialized(), "terminal counts/GPU differ")
            reader.unchanged(); budget()
        require(torch.equal(rng, torch.random.get_rng_state()), "caller RNG not restored")
        return write_exclusive(output, "report.json", {"schemaVersion": "t-q4-36-n-cpu-execution-bridge-v1",
            "status": "synthetic_cpu_bridge_checked_not_qualified" if synthetic else "cpu_execution_bridge_checked_not_gpu_qualified",
            "synthetic": synthetic, "capabilityVersion": CAPABILITY, "architecture": ARCHITECTURE,
            "callCounts": dict(counters), "optimizerSteps": 0, "gpuInitialized": False, "terminalAssertionsCompleted": True,
            "actualGraph": actual_graph, "parameterInitialization": initialization, "initialState": initial,
            "finalState": {"model": parent.state(model), "critic": parent.state(critic)}, "sampleResults": results,
            "inputBindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())],
            "binding": binding, "budget": BUDGET, "elapsedSeconds": clock() - started,
            "unverified": ["actual CUDA", "all48 admission", "lifecycle", "training", "visual/Runtime/Stage4 release"]})
    except BaseException as error:
        primary = error
        try:
            write_exclusive(output, "failure.json", {"status": "cpu_failed_closed", "synthetic": synthetic,
                "errorType": type(error).__name__, "error": str(error), "callCounts": dict(counters),
                "gradientFailureEvidence": evidence, "partialResults": results, "actualGraph": actual_graph,
                "initialState": initial, "parameterInitialization": initialization, "terminalAssertionsCompleted": False,
                "inputBindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())], "elapsedSeconds": clock() - started})
        except BaseException as secondary:
            try: error.secondary_evidence_error = str(secondary)
            except BaseException: pass
        raise
    finally:
        try:
            timer.cancel(); torch.random.set_rng_state(rng); torch.set_num_threads(threads)
            torch.use_deterministic_algorithms(flags["deterministic"], warn_only=flags["warnOnly"])
            torch.backends.mkldnn.enabled = flags["mkldnnEnabled"]; torch.backends.mkldnn.deterministic = flags["mkldnnDeterministic"]
        except BaseException as secondary:
            if primary is None: raise
            try: primary.secondary_cleanup_error = str(secondary)
            except BaseException: pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bindings", required=True); parser.add_argument("--sha256", required=True)
    args = parser.parse_args(); require(ROOT == Path("F:/ai-pet-world"), "fixed workspace required")
    print(json.dumps(execute({"path": args.bindings, "sha256": args.sha256}), ensure_ascii=False))

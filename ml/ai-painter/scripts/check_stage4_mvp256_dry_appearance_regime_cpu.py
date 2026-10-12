"""T-Q4-29: one immutable four-train CPU check, no GPU or optimizer."""
from __future__ import annotations
import _thread
import ast
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import threading
import time
from unittest.mock import patch

ROOT = Path(os.path.abspath(__file__)).parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import torch
from ai_painter.complete_world.object_appearance_regime_input_cpu import require, SEASONS, bound_regime, encode_season
from ai_painter.complete_world.object_appearance_regime_conditioned_cpu import (
    build_fresh_object_appearance_regime_conditioned_cpu as build, seasonal_parameter, CAPABILITY, ARCHITECTURE)
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import ROLES, SEED
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import (
    _validate_model_and_parameters, apply_object_head_core_priority_update_v24_cpu,
    TOTAL_GRADIENT_ATOL, TOTAL_GRADIENT_RTOL)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator, discriminator_train_objective
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective
from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views

DIAG = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72"
OUTPUT = DIAG + "/season-cpu-t-q4-29"
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp256_dry_appearance_regime_cpu.py"
FILES = ["ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_input_cpu.py",
    "ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_conditioned_cpu.py",
    "ml/ai-painter/tests/test_object_appearance_regime_conditioned_cpu.py", PROGRAM,
    "ml/ai-painter/tests/test_check_stage4_mvp256_dry_appearance_regime_cpu.py"]
SPEC = {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "sha256": "0a6ae5ded45454f892cfe51842cb37e24db33a9017b2de6a364e24ebc5f2e72e"}
GUIDE = {"path": "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md", "sha256": "67506c2e27f8988aae15655960ce9a5bf8b2ff8b2325fc13f4f3f4b09e46cd05"}
SELECTED = ((2, SEASONS[0]), (3, SEASONS[1]), (0, SEASONS[2]), (1, SEASONS[3]))
COUNTS = {"generatorForwardsAttempted": 0, "generatorForwardsCompleted": 0,
    "generatorGradCallsAttempted": 0, "generatorGradCallsCompleted": 0,
    "discriminatorGradCallsAttempted": 0, "discriminatorGradCallsCompleted": 0}

def digest(payload): return hashlib.sha256(payload).hexdigest()

class Reader:
    def __init__(self, root=ROOT): self.root, self.observed = root, {}
    def path(self, path):
        require(isinstance(path, str) and not any(v in path for v in ("\\", ":"))
            and all(v not in ("", ".", "..") for v in path.split("/")), "unsafe logical path")
        result = Path(os.path.abspath(self.root / path))
        require(result.is_relative_to(self.root), "path outside workspace")
        resolved = result.resolve()
        require(resolved.is_relative_to(self.root.resolve()) or
            (path.startswith(".runtime/") and resolved.is_relative_to((self.root / ".runtime").resolve())), "source escapes runtime/workspace")
        return result
    def read(self, binding):
        data = self.path(binding["path"]).read_bytes(); actual = digest(data)
        require(actual == binding["sha256"], "source SHA differs: " + binding["path"])
        require(binding["path"] not in self.observed or self.observed[binding["path"]] == actual, "source changed")
        self.observed[binding["path"]] = actual
        return data
    def json(self, binding): return json.loads(self.read(binding))
    def snapshot(self, path):
        payload = self.path(path).read_bytes(); binding = {"path": path, "sha256": digest(payload)}
        self.read(binding); return payload, binding
    def unchanged(self):
        for path, sha in list(self.observed.items()): self.read({"path": path, "sha256": sha})

def source_closure(reader):
    roots = ("ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests")
    def locate(name):
        suffix = name.replace(".", "/")
        for root in roots:
            for path in (root + "/" + suffix + "/__init__.py", root + "/" + suffix + ".py"):
                if reader.path(path).is_file(): return path
        return None
    pending, seen = list(FILES), set()
    while pending:
        path = pending.pop()
        if path in seen: continue
        seen.add(path); payload, _ = reader.snapshot(path)
        root = next(root for root in roots if path.startswith(root + "/"))
        parts = path[len(root)+1:].split("/")[:-1]
        for i in range(1, len(parts)+1):
            parent = root + "/" + "/".join(parts[:i]) + "/__init__.py"
            if reader.path(parent).is_file(): pending.append(parent)
        for node in ast.walk(ast.parse(payload, filename=path)):
            names = []
            if isinstance(node, ast.Import): names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                base = ".".join(parts[:len(parts)-node.level+1]) if node.level else ""
                name = ".".join(v for v in (base, node.module) if v)
                names = [name] + [name + "." + alias.name for alias in node.names if alias.name != "*"]
            for name in names:
                found = locate(name)
                if found: pending.append(found)
    return sorted(seen)

def verify_loaded_sources(reader, closure):
    verified = []
    for module in tuple(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if not filename or not Path(filename).is_absolute(): continue
        path = Path(os.path.abspath(filename))
        if not path.is_relative_to(ROOT) or path.is_relative_to(ROOT / "ml/ai-painter/.venv"): continue
        logical = path.relative_to(ROOT).as_posix()
        require(logical in closure, "unbound imported project source: " + logical)
        reader.read({"path": logical, "sha256": reader.observed[logical]}); verified.append(logical)
    return sorted(set(verified))

def state(network):
    h = hashlib.sha256()
    for name, value in network.state_dict().items():
        h.update(name.encode()); h.update(str(value.shape).encode()); h.update(str(value.dtype).encode())
        h.update(value.detach().contiguous().numpy().tobytes())
    return {"sha256": h.hexdigest(), "modes": {name: module.training for name, module in network.named_modules()},
        "requiresGrad": [p.requires_grad for p in network.parameters()]}

def graph(model):
    parameters, groups = _validate_model_and_parameters(model, tuple(model.parameters()))
    named = list(model.named_parameters()); seasonal = seasonal_parameter(model)
    require(sum(p is seasonal for p in parameters) == 1, "seasonal parameter absent/aliased")
    index = next(i for i, p in enumerate(parameters) if p is seasonal)
    require(index not in {i for indexes in groups.values() for i in indexes}, "seasonal branch incorrectly grouped as RGB head")
    return parameters, groups, index, {"architecture": ARCHITECTURE, "capability": CAPABILITY,
        "tensors": len(parameters), "elements": sum(p.numel() for p in parameters),
        "seasonalParameterIndex": index, "seasonalElements": seasonal.numel(),
        "parameters": [{"name": n, "shape": list(p.shape), "elements": p.numel()} for n, p in named],
        "headIndices": {k: list(v) for k, v in groups.items()}, "storageAliases": False}

def autograd(loss, parameters, counters, kind, budget, retain=False):
    budget(); counters[kind + "GradCallsAttempted"] += 1
    result = torch.autograd.grad(loss, parameters, retain_graph=retain, allow_unused=True)
    counters[kind + "GradCallsCompleted"] += 1
    require(all(v is None or bool(torch.isfinite(v).all()) for v in result), "nonfinite " + kind + " gradients")
    return result

def diagnostic_number(value):
    """Never emit non-standard JSON numbers or substitute missing values with zero."""
    if value is None:
        return {"status": "not_available", "value": None}
    value = float(value)
    if math.isnan(value): return {"status": "nan", "value": None}
    if math.isinf(value): return {"status": "positive_infinity" if value > 0 else "negative_infinity", "value": None}
    return {"status": "finite", "value": value}

def summarize_gradient_failure(actual_graph, parameters, gradients, error):
    """Inspect already-computed gradients; original adapter remains the only gate."""
    result = {"status": "not_available", "originalErrorType": type(error).__name__, "originalError": str(error),
        "gradientSetsAvailable": len(gradients), "gradientSetsExpected": 4,
        "comparison": {"formula": "(structured.float()+wholeFrame.float()).float()+core.float()",
            "atol": TOTAL_GRADIENT_ATOL, "rtol": TOTAL_GRADIENT_RTOL,
            "criterion": "torch.isclose(actualTotal, expected, atol=atol, rtol=rtol)",
            "relativeErrorDefinition": "abs(actual-expected)/abs(expected);0/0=0,nonzero/0=infinity",
            "statisticsArithmetic": "float64 detached differences; gate/mismatch mask uses original float32 isclose"},
        "failingParameter": None, "maxAbsoluteError": diagnostic_number(None),
        "maxRelativeError": diagnostic_number(None), "outsideToleranceElements": None,
        "nonfiniteActualElements": None, "nonfiniteExpectedElements": None, "examples": [], "exampleLimit": 8}
    match = re.fullmatch(r"actual total gradient identity differs at parameter (\d+)", str(error))
    if match is None:
        match = re.fullmatch(r"(?:actualTotal|core|wholeFrameFidelity|structuredObjective)\[(\d+)\] must be finite", str(error))
    if match is None:
        result["reason"] = "original failure does not identify a parameter index"
        return result
    index = int(match.group(1))
    require(0 <= index < len(parameters) and len(actual_graph["parameters"]) == len(parameters), "diagnostic parameter graph differs")
    parameter = parameters[index]
    record = actual_graph["parameters"][index]
    require(record["shape"] == list(parameter.shape), "diagnostic shape differs from measured graph")
    result["failingParameter"] = {"index": index, "name": record["name"], "shape": list(parameter.shape),
        "dtype": str(parameter.dtype), "device": str(parameter.device)}
    if len(gradients) != 4:
        result["reason"] = "four gradient sequences not all available"
        return result
    require(all(len(values) == len(parameters) for values in gradients), "diagnostic gradient counts differ")
    with torch.no_grad():
        values = []
        unused = []
        for sequence in gradients:
            value = sequence[index]
            unused.append(value is None)
            if value is None: value = torch.zeros_like(parameter, memory_format=torch.preserve_format)
            require(value.shape == parameter.shape and value.dtype == parameter.dtype and value.device == parameter.device,
                "diagnostic gradient metadata differs")
            values.append(value.detach())
        actual, structured, whole, core = values
        expected = (structured.float() + whole.float()).float() + core.float()
        close = torch.isclose(actual, expected, atol=TOTAL_GRADIENT_ATOL, rtol=TOTAL_GRADIENT_RTOL)
        finite = torch.isfinite(actual) & torch.isfinite(expected)
        actual64, expected64 = actual.to(torch.float64), expected.to(torch.float64)
        difference = (actual64 - expected64).abs()
        relative = difference / expected64.abs()
        relative = torch.where((difference == 0) & (expected64 == 0), torch.zeros_like(relative), relative)
        all_finite = bool(finite.all())
        result.update({"status": "captured_finite" if all_finite else "captured_nonfinite",
            "originalFailureStillRejected": True, "elementCount": parameter.numel(),
            "noneGradientsNormalizedToZero": dict(zip(("actualTotal", "structured", "wholeFrame", "core"), unused)),
            "nonfiniteActualElements": int((~torch.isfinite(actual)).sum()),
            "nonfiniteExpectedElements": int((~torch.isfinite(expected)).sum()),
            "outsideToleranceElements": int((~close).sum()),
            "maxAbsoluteError": diagnostic_number(float(difference.max())) if all_finite else {"status": "undefined_nonfinite_inputs", "value": None},
            "maxRelativeError": diagnostic_number(float(relative.max())) if all_finite else {"status": "undefined_nonfinite_inputs", "value": None}})
        flattened = [value.reshape(-1) for value in (actual, expected, structured, whole, core)]
        for flat_index in (~close).reshape(-1).nonzero().flatten()[:8].tolist():
            a, e, s, w, c = (float(value[flat_index]) for value in flattened)
            result["examples"].append({"flatIndex": flat_index,
                "actualTotal": diagnostic_number(a), "expected": diagnostic_number(e),
                "structured": diagnostic_number(s), "wholeFrame": diagnostic_number(w), "core": diagnostic_number(c),
                "absoluteError": diagnostic_number(abs(a-e)),
                "relativeError": diagnostic_number(0 if a == e == 0 else abs(a-e)/abs(e) if e != 0 else float("inf")),
                "toleranceAtElement": diagnostic_number(TOTAL_GRADIENT_ATOL + TOTAL_GRADIENT_RTOL * abs(e))})
    return result

def record_gradient_failure(destination, actual_graph, parameters, gradients, error):
    if destination is None: return
    try:
        payload = summarize_gradient_failure(actual_graph, parameters, gradients, error)
        json.dumps(payload, allow_nan=False)
    except BaseException as diagnostic_error:
        payload = {"status": "diagnostic_failed", "originalErrorType": type(error).__name__, "originalError": str(error),
            "diagnosticErrorType": type(diagnostic_error).__name__, "diagnosticError": str(diagnostic_error)}
    destination.clear(); destination.update(payload)

def probe(model, critic, sample, code, counters, budget, *, failure_evidence=None):
    require(sample["split"] == "train", "gradient requires train")
    parameters, groups, season_index, actual_graph = graph(model)
    gradients = []
    saved_source = {k: sample[k].clone() for k in ("image", "conditions")}
    saved_table = deepcopy(sample["objectInstanceTable"])
    saved_model, saved_critic, rng = state(model), state(critic), torch.random.get_rng_state().clone()
    flags = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
    critic_modes = [(m, m.training) for m in critic.modules()]
    critic_requires = [(p, p.requires_grad) for p in critic.parameters()]
    try:
        budget(); counters["generatorForwardsAttempted"] += 1
        prediction, evidence = model(sample["conditions"][None], sample["objectInstanceTable"], appearance_regime=code, return_evidence=True)
        counters["generatorForwardsCompleted"] += 1
        critic.train().requires_grad_(True)
        d_loss, _ = discriminator_train_objective(critic, prediction, sample)
        d_grad = autograd(d_loss, tuple(critic.parameters()), counters, "discriminator", budget)
        require(any(v is not None and bool(v.count_nonzero()) for v in d_grad), "critic gradient is zero")
        critic.eval().requires_grad_(False)
        total, parts = train_object_core_fidelity_candidate_objective(critic, prediction, sample, sample["objectInstanceTable"], model.condition_channel_order)
        values = [total, parts["v21UnchangedTotal"], parts["wholeFrameFidelity"], parts["objectCoreRgbWeighted"]]
        for i, value in enumerate(values):
            gradients.append(autograd(value, parameters, counters, "generator", budget, retain=i < 3))
        candidate, facts = apply_object_head_core_priority_update_v24_cpu(model=model, parameters=parameters,
            total_gradients=gradients[0], structured_gradients=gradients[1], whole_frame_gradients=gradients[2], core_gradients=gradients[3])
        sg = gradients[0][season_index]
        require(sg is not None and bool(sg.count_nonzero()), "seasonal actual-total gradient is zero/missing")
        active = int(code.argmax()); norms = [float(sg[:, i].norm()) for i in range(4)]
        require(norms[active] > 0 and all(norms[i] == 0 for i in range(4) if i != active), "seasonal slice reachability differs")
        require(torch.equal(candidate[season_index], sg), "seasonal non-head actual-total gradient changed")
        head_norms = {}
        for role, indexes in groups.items():
            head_norms[role] = float(torch.cat([candidate[i].reshape(-1) for i in indexes]).norm())
            if bool(sample["conditions"][model.condition_channel_order.index(role)].count_nonzero()):
                require(any(gradients[3][i] is not None and bool(gradients[3][i].count_nonzero()) for i in indexes), "applicable head core gradient is zero: " + role)
                require(head_norms[role] > 0, "applicable projected head gradient is zero: " + role)
        return {"loss": float(total.detach()), "discriminatorLoss": float(d_loss.detach()), "seasonalSliceL2": norms,
            "fourHeadUpdate": facts, "candidateHeadL2": head_norms, "objectCount": evidence["objectCount"], "sourceUnchanged": True}
    except BaseException as error:
        record_gradient_failure(failure_evidence, actual_graph, parameters, gradients, error)
        raise
    finally:
        for module, mode in critic_modes: module.training = mode
        for parameter, needed in critic_requires: parameter.requires_grad_(needed)
        require(state(model) == saved_model and state(critic) == saved_critic, "network state changed")
        require(all(p.grad is None for n in (model, critic) for p in n.parameters()), "parameter .grad mutated")
        require(all(torch.equal(sample[k], v) for k, v in saved_source.items()) and sample["objectInstanceTable"] == saved_table, "source/instance mutated")
        require(torch.equal(rng, torch.random.get_rng_state()), "probe RNG mutated")
        require(flags == (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled()), "backend state mutated")

def exclusive(path, value):
    encoded = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    require(len(encoded) <= 16*1024*1024, "output exceeds16MiB")
    require(len(encoded) + sum(p.stat().st_size for p in path.parent.iterdir() if p.is_file()) <= 16*1024*1024,
            "combined output exceeds16MiB")
    with path.open("xb") as stream: stream.write(encoded); stream.flush(); os.fsync(stream.fileno())
    return {"path": str(path), "sha256": digest(encoded), "bytes": len(encoded)}

def execute(output, prepare, loader, *, synthetic=False):
    output = Path(output); output.mkdir(parents=True, exist_ok=True)
    require(not any((output / name).exists() for name in ("claim.json", "report.json", "failure.json")), "consumed or terminal check cannot repeat")
    exclusive(output / "claim.json", {"capability": CAPABILITY, "attempt": 1, "automaticRetries": 0,
        "synthetic": synthetic, "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
    started = time.monotonic(); counters = dict(COUNTS); results = []; reader = Reader(); closure = []
    actual_graph, plan = None, None
    failure_evidence = {"status": "not_started", "reason": "source/model not prepared"}
    old_threads, rng = torch.get_num_threads(), torch.random.get_rng_state().clone()
    old_flags = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
    expired = threading.Event()
    def interrupt(): expired.set(); _thread.interrupt_main()
    timer = threading.Timer(180, interrupt); timer.daemon = True; timer.start()
    def budget(): require(not expired.is_set() and time.monotonic()-started < 180, "CPU180s budget exceeded")
    boundary = {"gpuInitialized": False, "optimizerSteps": 0, "checkpointsReadWritten": 0,
        "all48Qualified": False, "executionQualification": False, "trainingAllowed": False,
        "validationPixelsRead": 0, "challengeRegressionRecordsRead": 0, "currentRegistryWritten": False}
    try:
        torch.set_num_threads(2)
        with torch.random.fork_rng(devices=[]), patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("optimizer prohibited")), \
             patch.object(torch, "load", side_effect=AssertionError("checkpoint prohibited")), \
             patch.object(torch, "save", side_effect=AssertionError("checkpoint prohibited")), \
             patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward prohibited")), \
             patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA prohibited")):
            plan = prepare(reader)
            if not synthetic:
                closure = source_closure(reader); verify_loaded_sources(reader, closure)
            model = build(condition_channel_order=plan["order"]).train()
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(SEED); critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
            _, _, _, actual_graph = graph(model)
            failure_evidence = {"status": "not_computed", "reason": "no generator gradients computed"}
            initial = {"model": state(model), "critic": state(critic)}
            for ordinal, season in SELECTED:
                budget(); sample, code, identity = loader(reader, plan, ordinal, season)
                require(torch.equal(code, encode_season(season)), "fixed sample regime differs")
                failure_evidence = {"status": "not_computed", "reason": "current sample gradients not completed",
                    "trainOrdinal": ordinal, "season": season}
                facts = probe(model, critic, sample, code, counters, budget, failure_evidence=failure_evidence)
                failure_evidence = {"status": "not_applicable", "reason": "current probe had no rejected gradient comparison"}
                results.append({"trainOrdinal": ordinal, "season": season, "identity": identity, **facts})
                if not synthetic: verify_loaded_sources(reader, closure)
                require(initial == {"model": state(model), "critic": state(critic)}, "per-sample state changed")
            require(counters == {"generatorForwardsAttempted": 4, "generatorForwardsCompleted": 4,
                "generatorGradCallsAttempted": 16, "generatorGradCallsCompleted": 16,
                "discriminatorGradCallsAttempted": 4, "discriminatorGradCallsCompleted": 4}, "incomplete counts")
            require(not torch.cuda.is_initialized(), "CUDA was initialized")
            reader.unchanged(); budget()
        require(torch.equal(rng, torch.random.get_rng_state()), "caller RNG not restored")
        report = {"schemaVersion": "t-q4-29-season-cpu-evidence-v1", "status": "cpu_checked_not_execution_qualified",
            "synthetic": synthetic, "capability": CAPABILITY, "actualGraph": actual_graph, "plan": plan,
            "callCounts": counters, "sampleResults": results, "initialState": initial,
            "finalState": {"model": state(model), "critic": state(critic)}, "inputBindings": [
                {"path": path, "sha256": sha} for path, sha in sorted(reader.observed.items())],
            "sourceClosure": closure, "elapsedSeconds": time.monotonic()-started, "boundary": boundary,
            "unverified": ["all48train CPU/GPU admission", "CUDA bridge", "training", "originalRGB seasonal alignment", "visual/Runtime/Stage4 qualification"],
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        return exclusive(output / "report.json", report)
    except BaseException as error:
        exclusive(output / "failure.json", {"status": "cpu_failed_closed", "synthetic": synthetic,
            "errorType": type(error).__name__, "error": str(error), "callCounts": counters,
            "actualGraph": actual_graph, "plan": plan, "gradientFailureEvidence": failure_evidence,
            "partialResults": results, "initialState": locals().get("initial"), "boundary": boundary,
            "inputBindings": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
            "elapsedSeconds": time.monotonic()-started, "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
        raise
    finally:
        timer.cancel(); torch.random.set_rng_state(rng); torch.set_num_threads(old_threads)
        torch.use_deterministic_algorithms(old_flags[0], warn_only=old_flags[1])

def prepare_real(reader):
    reader.read(SPEC); reader.read(GUIDE)
    diagnostic = reader.json({"path": DIAG + "/report.json", "sha256": "4639d25a8c0f0bc2f60592c15b23971de3a17b131124ea54df52568c4139a09e"})
    proposal = reader.json({"path": DIAG + "/model-successor-proposal-t-q4-28b/report.json", "sha256": "2ed514baff4ca1a7a147e9054954dbd5fcda2d809eca9fe821517d02653750be"})
    manifest = reader.json(diagnostic["datasetManifest"]); split = reader.json(diagnostic["trainSplit"])
    require(split["split"] == "train" and len(split["sampleIds"]) == 48, "train membership differs")
    condition = reader.json({"path": "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json", "sha256": "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2"})
    order = manifest["identityPayload"]["channelOrder"]
    require(order == condition["tensorContract"]["channelOrder"] and len(order) == 23, "23-channel order differs")
    selected = {}
    for ordinal, season in SELECTED:
        row = next(row for row in diagnostic["rows"] if row["split"] == "train" and row["ordinal"] == ordinal)
        record = next(row for row in proposal["records"] if row["trainOrdinal"] == ordinal)
        require(row["sampleId"] == split["sampleIds"][ordinal] == record["sampleIdEvidenceOnly"]
            and record["appearanceValues"]["season"] == season, "fixed train identity differs")
        selected[str(ordinal)] = {"identity": row["identity"], "regimeRecord": record}
    return {"order": order, "continuous": manifest["identityPayload"]["continuousChannelIds"],
        "selected": selected, "formalSpec": SPEC, "guide": GUIDE,
        "historicalDiagnosticUse": "immutable selected input identities only; not candidate qualification",
        "resource": {"threads": 2, "seconds": 180, "outputBytes": 16*1024*1024, "attempts": 1, "retries": 0}}

def load_real(reader, plan, ordinal, season):
    import numpy as np
    from PIL import Image
    selected = plan["selected"][str(ordinal)]; identity = selected["identity"]
    code, profile = bound_regime(reader, selected["regimeRecord"])
    pack = reader.json(identity["conditionPack"]); task = reader.json(identity["taskPackage"])
    require([item["id"] for item in pack["channels"]] == plan["order"], "selected channel order differs")
    source = task["sourceBindings"]
    facts = reader.json({"path": source["naturalizedWorldFactsPath"], "sha256": source["naturalizedWorldFactsSha256"]})
    visual = reader.json(identity["visualFactManifestFile"])
    require(visual["manifestSha256"] == pack["visualFactManifestSha256"] == source["visualFactManifestSha256"], "visual source differs")
    table = pack["objectInstanceTable"]; objects = task["spatialLayers"]["objectFootprints"]
    require(len(table) == len(objects), "instance count differs")
    for i, (item, original) in enumerate(zip(table, objects), 1):
        require(item["value"] == i and all(item[k] == original[k] for k in ("objectId", "kind", "footprint", "blocksMovement")), "instance authority differs")
    def pixels(binding, mode, resampling):
        with Image.open(io.BytesIO(reader.read(binding))) as image:
            require(image.format == "PNG" and image.mode == mode and image.size == (1024, 768), "native image format differs")
            return np.asarray(image.resize((256, 192), resample=resampling), dtype=np.uint8).copy()
    rgb = pixels(identity["image"], "RGB", Image.Resampling.LANCZOS)
    channels = [pixels(item, "L", Image.Resampling.BILINEAR if item["id"] in plan["continuous"] else Image.Resampling.NEAREST) for item in pack["channels"]]
    sample = {"split": "train", "sampleId": identity["sampleId"], "image": torch.from_numpy(rgb).permute(2, 0, 1).float().div(255),
        "conditions": torch.stack([torch.from_numpy(value).float().div(255) for value in channels]), "objectInstanceTable": deepcopy(table)}
    validate_bound_object_views(sample["conditions"], table, plan["order"])
    return sample, code, {"source": identity, "appearanceProfile": profile}

if __name__ == "__main__":
    require(len(sys.argv) == 1 and ROOT == Path("F:/ai-pet-world"), "fixed workspace/no CLI overrides required")
    print(json.dumps(execute(ROOT / OUTPUT, prepare_real, load_real), ensure_ascii=False))

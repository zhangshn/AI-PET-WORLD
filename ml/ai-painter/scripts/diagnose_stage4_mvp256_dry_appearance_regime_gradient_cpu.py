"""T-Q4-32 independent single-train numeric capture, never qualification."""
from __future__ import annotations
import argparse
import _thread
import ast
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
from unittest.mock import patch

ROOT = Path(os.path.abspath(__file__)).parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import torch
import check_stage4_mvp256_dry_appearance_regime_cpu as parent

PROGRAM = "ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu.py"
TEST = "ml/ai-painter/tests/test_diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu.py"
OUTPUT = parent.DIAG + "/season-gradient-capture-t-q4-32"
SPEC = dict(parent.SPEC)
GUIDE = {"path": "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
    "sha256": "32a7255b4395e1b6d5d8049eaef085aed5c3641ed83089a5fba35cb2a6e7e6f1"}
DIAGNOSTIC = {"path": parent.DIAG + "/report.json", "sha256": "4639d25a8c0f0bc2f60592c15b23971de3a17b131124ea54df52568c4139a09e"}
PROPOSAL = {"path": parent.DIAG + "/model-successor-proposal-t-q4-28b/report.json", "sha256": "2ed514baff4ca1a7a147e9054954dbd5fcda2d809eca9fe821517d02653750be"}
CONDITION = {"path": "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json", "sha256": "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2"}
PARENT_SOURCE = {"path": parent.PROGRAM, "sha256": "f31f116a391e8d08cc48dbd22e6c6f62b032c98bb5c1375d572b4d9a7d2d9b7a"}
PARENT_TEST = {"path": "ml/ai-painter/tests/test_check_stage4_mvp256_dry_appearance_regime_cpu.py", "sha256": "c40c0ce31bbc2db2494386a7f0bd586d2327ac2ffef290539982de4e96224673"}
OLD_CLAIM = {"path": parent.OUTPUT + "/claim.json", "sha256": "47c7460d8859a506ff70983d9c9f55edd3cffdd0fe0f38de06d4fc8f5dfb4d70"}
OLD_FAILURE = {"path": parent.OUTPUT + "/failure.json", "sha256": "ef746e824ce5683cdfe528986f5590f094c8e89b48f741081b3475a6a884bf7f"}
REGISTRY = {"path": ".runtime/ai-painter/current-execution-registry/current.json", "sha256": "1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa"}
ORDINAL, SEASON = 2, "dry_season"
LIMITS = {"cpuThreads": 2, "wallSeconds": 120, "generatorForwards": 1, "generatorAutogradCalls": 4,
    "discriminatorAutogradCalls": 1, "optimizerSteps": 0, "attempts": 1, "automaticRetries": 0,
    "combinedOutputBytes": 2*1024*1024, "gradientExamples": 8}
EXPECTED_COUNTS = {key: (1 if "Forwards" in key or key.startswith("discriminator") else 4) for key in parent.COUNTS}
require = parent.require

class LimitedCounters(dict):
    def __init__(self):
        super().__init__(parent.COUNTS); self.blocked = []
    def __setitem__(self, key, value):
        require(key in EXPECTED_COUNTS and type(value) is int and value == self[key]+1, "counter transition differs")
        if value > EXPECTED_COUNTS[key]:
            self.blocked.append({"counter": key, "blockedValue": value})
            raise ValueError("capture call limit exceeded: " + key)
        super().__setitem__(key, value)

class FrozenReader(parent.Reader):
    def __init__(self, bindings, root=ROOT):
        super().__init__(root); self.frozen = {item["path"]: item["sha256"] for item in bindings}
        require(len(self.frozen) == len(bindings), "duplicate frozen binding")
    def snapshot(self, path):
        require(path in self.frozen, "unbound snapshot/source: " + path)
        binding = {"path": path, "sha256": self.frozen[path]}
        return self.read(binding), binding

def source_closure(reader):
    """Include own runner/tests plus their static imports; never mutate old FILES."""
    seen = set(parent.source_closure(reader)); pending = [PROGRAM, TEST]
    roots = ("ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests")
    def locate(name):
        for root in roots:
            for suffix in (name.replace(".", "/") + "/__init__.py", name.replace(".", "/") + ".py"):
                path = root + "/" + suffix
                if reader.path(path).is_file(): return path
        return None
    while pending:
        path = pending.pop()
        if path in seen: continue
        seen.add(path); text, _ = reader.snapshot(path)
        root = next(root for root in roots if path.startswith(root + "/"))
        parts = path[len(root)+1:].split("/")[:-1]
        for i in range(1, len(parts)+1):
            init = root + "/" + "/".join(parts[:i]) + "/__init__.py"
            if reader.path(init).is_file(): pending.append(init)
        for node in ast.walk(ast.parse(text, filename=path)):
            names = []
            if isinstance(node, ast.Import): names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                package = ".".join(parts[:len(parts)-node.level+1]) if node.level else ""
                name = ".".join(v for v in (package, node.module) if v)
                names = [name] + [name + "." + alias.name for alias in node.names if alias.name != "*"]
            for name in names:
                found = locate(name)
                if found: pending.append(found)
    return sorted(seen)

def binding_template(reader):
    closure = source_closure(reader)
    seeds = [SPEC, GUIDE, PARENT_SOURCE, PARENT_TEST, REGISTRY, OLD_CLAIM, OLD_FAILURE]
    for binding in seeds: reader.read(binding)
    for path in ("scripts/lib/real-earth-region-governance.mjs", OUTPUT + "/work-order.json"):
        reader.snapshot(path)
    return {"schemaVersion": "t-q4-32-frozen-bindings-v1", "task": "T-Q4-32", "limits": LIMITS,
        "sample": {"split": "train", "trainOrdinal": ORDINAL, "season": SEASON}, "sourceClosure": closure,
        "bindings": [{"path": path, "sha256": sha} for path, sha in sorted(reader.observed.items())]}

def authenticate(reader, manifest):
    require(manifest["schemaVersion"] == "t-q4-32-frozen-bindings-v1" and manifest["task"] == "T-Q4-32"
        and manifest["limits"] == LIMITS and manifest["sample"] == {"split": "train", "trainOrdinal": 2, "season": "dry_season"}, "capture manifest contract differs")
    for binding in manifest["bindings"]: reader.read(binding)
    require(source_closure(reader) == manifest["sourceClosure"] and PROGRAM in manifest["sourceClosure"]
        and TEST in manifest["sourceClosure"], "own complete source closure differs")
    for binding in (SPEC, GUIDE, PARENT_SOURCE, PARENT_TEST, OLD_CLAIM, OLD_FAILURE): reader.read(binding)
    registry = reader.json(REGISTRY)
    require(registry["registryRevision"] == 371 and registry["activeExecution"] is None and registry["nextMachineAction"] is None, "active execution/registry differs")
    work = reader.json({"path": OUTPUT + "/work-order.json", "sha256": reader.frozen[OUTPUT + "/work-order.json"]})
    require(work["task"] == "T-Q4-32" and work["limits"] == LIMITS and work["sample"] ==
        {"split": "train", "ordinal": 2, "season": "dry_season", "resolution": [256, 192]}
        and work["spec"] == SPEC and work["guide"] == GUIDE, "work-order differs")
    return parent.verify_loaded_sources(reader, manifest["sourceClosure"])

def prepare_metadata(reader):
    diagnostic = reader.json(DIAGNOSTIC); proposal = reader.json(PROPOSAL)
    manifest = reader.json(diagnostic["datasetManifest"]); split = reader.json(diagnostic["trainSplit"])
    condition = reader.json(CONDITION)
    order = manifest["identityPayload"]["channelOrder"]
    require(split["split"] == "train" and len(split["sampleIds"]) == len(set(split["sampleIds"])) == 48, "train membership differs")
    require(order == condition["tensorContract"]["channelOrder"] and len(order) == len(set(order)) == 23, "23-channel contract differs")
    require(manifest["identityPayload"]["continuousChannelIds"] == condition["tensorContract"]["typePartitions"]["continuous"], "continuous channels differ")
    rows = [row for row in diagnostic["rows"] if row["split"] == "train" and row["ordinal"] == ORDINAL]
    records = [row for row in proposal["records"] if row["trainOrdinal"] == ORDINAL]
    require(len(rows) == len(records) == 1, "fixed selected metadata absent/duplicate")
    row, record = rows[0], records[0]
    require(row["sampleId"] == row["identity"]["sampleId"] == split["sampleIds"][ORDINAL] == record["sampleIdEvidenceOnly"]
        and row["identity"]["split"] == "train" and record["appearanceValues"]["season"] == SEASON
        and row["identity"]["conditionPack"] == record["conditionPack"]
        and row["identity"]["taskPackage"] == record["taskPackage"], "fixed train/season/source binding differs")
    return {"trainOrdinal": ORDINAL, "season": SEASON, "sourceIdentity": deepcopy(row["identity"]),
        "order": order, "continuous": manifest["identityPayload"]["continuousChannelIds"],
        "selected": {"2": {"identity": deepcopy(row["identity"]), "regimeRecord": deepcopy(record)}},
        "historicUsage": "Only selected binding fields; no holdout metrics, pictures or model selection"}

def output_bytes(output): return sum(path.stat().st_size for path in output.rglob("*") if path.is_file())

def write_exclusive(output, name, value):
    require(name in ("claim.json", "report.json", "failure.json"), "invalid capture terminal path")
    data = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    require(len(data)+output_bytes(output) <= LIMITS["combinedOutputBytes"], "combined2MiB output limit exceeded")
    with (output/name).open("xb") as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
    return {"path": str(output/name), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}

@contextmanager
def guards(output):
    from PIL import Image
    originals = {"builtin": open, "io": io.open}
    def wrapper(original):
        def guarded(file, mode="r", *args, **kwargs):
            if isinstance(file, (str, os.PathLike)) and any(flag in mode for flag in "wa+x"):
                target = Path(os.path.abspath(file))
                require(target.is_relative_to(output) and target.suffix.lower() != ".png", "write outside capture output/PNG prohibited")
            return original(file, mode, *args, **kwargs)
        return guarded
    with patch("builtins.open", wrapper(originals["builtin"])), patch.object(io, "open", wrapper(originals["io"])), \
         patch.object(torch.cuda, "_lazy_init", side_effect=AssertionError("CUDA prohibited")), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("optimizer prohibited")), \
         patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward prohibited")), \
         patch.object(torch, "load", side_effect=AssertionError("checkpoint prohibited")), \
         patch.object(torch, "save", side_effect=AssertionError("checkpoint prohibited")), \
         patch.object(Image.Image, "save", side_effect=AssertionError("image output prohibited")):
        yield

def completed_capture(error, evidence, counters):
    require(dict(counters) == EXPECTED_COUNTS, "incomplete single-sample call counts")
    if error is None: return "capture_completed_original_check_passed_not_qualified"
    require(type(error) is ValueError and re.fullmatch(r"actual total gradient identity differs at parameter \d+", str(error))
        and evidence.get("originalError") == str(error) and evidence.get("status") in ("captured_finite", "captured_nonfinite")
        and evidence.get("failingParameter") is not None and evidence.get("outsideToleranceElements") is not None
        and len(evidence.get("examples", [])) <= 8, "original rejection lacks complete numeric evidence")
    return "capture_completed_original_check_rejected"

def execute(binding=None, *, output=None, synthetic=False, prepare=None, loader=None,
            model_factory=None, critic_factory=None, graph_function=None, probe_function=None, clock=None):
    """Synthetic callbacks only in temp namespaces; real path uses frozen implementations."""
    output = Path(os.path.abspath(output or ROOT/OUTPUT)); output.mkdir(parents=True, exist_ok=True)
    if synthetic:
        require(output != Path(os.path.abspath(ROOT/OUTPUT)) and prepare and loader and model_factory
            and critic_factory and graph_function and probe_function, "synthetic callbacks/output required")
        reader = parent.Reader(); manifest = None
    else:
        require(output == Path(os.path.abspath(ROOT/OUTPUT)) and all(value is None for value in
            (prepare, loader, model_factory, critic_factory, graph_function, probe_function, clock)), "real capture callbacks/output overrides forbidden")
        require(binding and binding["path"] == OUTPUT+"/frozen-bindings.json", "unique frozen binding required")
        preliminary = parent.Reader(); manifest = preliminary.json(binding)
        reader = FrozenReader(manifest["bindings"]); reader.observed.update(preliminary.observed)
        prepare, loader, model_factory = prepare_metadata, parent.load_real, parent.build
        critic_factory, graph_function, probe_function = parent.build_conditional_texture_discriminator, parent.graph, parent.probe
    require(not any((output/name).exists() for name in ("claim.json", "report.json", "failure.json")), "capture already consumed/terminal; no repeat")
    require(output_bytes(output) <= LIMITS["combinedOutputBytes"]-131072, "insufficient reserved failure-output quota")
    write_exclusive(output, "claim.json", {"task": "T-Q4-32", "synthetic": synthetic, "attempt": 1,
        "automaticRetries": 0, "binding": binding, "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
    clock = clock or time.monotonic; started = clock(); counters = LimitedCounters(); evidence = {"status": "not_started"}
    plan = actual_graph = initial = identity = None; original_error = None; facts = None
    caller_rng = torch.random.get_rng_state().clone(); old_threads = torch.get_num_threads()
    flags = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
    expired = threading.Event()
    def interrupt(): expired.set(); _thread.interrupt_main()
    timer = threading.Timer(LIMITS["wallSeconds"], interrupt); timer.daemon = True; timer.start()
    def budget(): require(not expired.is_set() and clock()-started < LIMITS["wallSeconds"], "capture120s budget exceeded")
    boundary = {"qualified": False, "trainingAllowed": False, "optimizerSteps": 0, "GPU": False,
        "checkpoint": False, "PNG": False, "registryWritten": False, "reusedOldClaim": False,
        "validationChallengeRegressionPixels": 0, "synthetic": synthetic}
    try:
        torch.set_num_threads(2)
        with guards(output), torch.random.fork_rng(devices=[]):
            budget(); require(not torch.cuda.is_initialized(), "CUDA already initialized")
            if not synthetic: authenticate(reader, manifest)
            plan = prepare(reader)
            require(plan["trainOrdinal"] == ORDINAL and plan["season"] == SEASON, "fixed capture plan differs")
            budget(); sample, code, identity = loader(reader, plan, ORDINAL, SEASON)
            require(sample["split"] == "train" and sample["sampleId"] == plan["sourceIdentity"]["sampleId"]
                and torch.equal(code, parent.encode_season(SEASON)), "loaded train/season/identity differs")
            model = model_factory(condition_channel_order=plan["order"]).train()
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(20260929); critic = critic_factory().eval().requires_grad_(False)
            _, _, _, actual_graph = graph_function(model)
            initial = {"model": parent.state(model), "critic": parent.state(critic)}
            source = {key: sample[key].clone() for key in ("image", "conditions")}; table = deepcopy(sample["objectInstanceTable"])
            before_probe_rng = torch.random.get_rng_state().clone()
            evidence = {"status": "not_computed"}
            try: facts = probe_function(model, critic, sample, code, counters, budget, failure_evidence=evidence)
            except BaseException as error: original_error = error
            require(initial == {"model": parent.state(model), "critic": parent.state(critic)}
                and all(p.grad is None for network in (model, critic) for p in network.parameters()), "capture model/critic state changed")
            require(torch.equal(before_probe_rng, torch.random.get_rng_state()) and all(torch.equal(sample[k], value)
                for k, value in source.items()) and table == sample["objectInstanceTable"], "capture RNG/source/instances changed")
            require(flags == (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled()), "capture backend state changed")
            if original_error is not None and dict(counters) != EXPECTED_COUNTS: raise original_error
            if not synthetic: parent.verify_loaded_sources(reader, manifest["sourceClosure"])
            reader.unchanged(); budget()
            status = completed_capture(original_error, evidence, counters)
        require(torch.equal(caller_rng, torch.random.get_rng_state()), "caller RNG not restored")
        report = {"schemaVersion": "t-q4-32-single-train-gradient-capture-v1", "status": status, "boundary": boundary,
            "trainOrdinal": ORDINAL, "season": SEASON, "sourceIdentity": plan["sourceIdentity"], "loadedIdentity": identity,
            "originalError": None if original_error is None else {"type": type(original_error).__name__, "message": str(original_error)},
            "failedGate": None if original_error is None else "original_v24_actual_total_gradient_identity",
            "actualGraph": actual_graph, "gradientFailureEvidence": evidence, "probeFacts": facts,
            "callCounts": dict(counters), "blockedCounterIncrements": counters.blocked, "limits": LIMITS,
            "binding": binding, "initialState": initial, "finalState": {"model": parent.state(model), "critic": parent.state(critic)},
            "inputs": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
            "elapsedSeconds": clock()-started, "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        return write_exclusive(output, "report.json", report)
    except BaseException as error:
        write_exclusive(output, "failure.json", {"schemaVersion": "t-q4-32-single-train-gradient-capture-v1",
            "status": "capture_failed_closed", "errorType": type(error).__name__, "error": str(error),
            "originalError": None if original_error is None else {"type": type(original_error).__name__, "message": str(original_error)},
            "actualGraph": actual_graph, "gradientFailureEvidence": evidence, "initialState": initial, "sourceIdentity": None if plan is None else plan.get("sourceIdentity"),
            "callCounts": dict(counters), "blockedCounterIncrements": counters.blocked, "boundary": boundary,
            "inputs": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
            "elapsedSeconds": clock()-started, "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
        raise
    finally:
        timer.cancel(); torch.random.set_rng_state(caller_rng); torch.set_num_threads(old_threads)
        torch.use_deterministic_algorithms(flags[0], warn_only=flags[1])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bindings", required=True); parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    require(ROOT == Path("F:/ai-pet-world"), "fixed workspace required")
    print(json.dumps(execute({"path": args.bindings, "sha256": args.sha256}), ensure_ascii=False))

"""Own four-season CPU gate. Import/preparation never executes the gate.

The sole computation entry requires the existing private owned Job supervisor.
No checkpoint import, optimizer, GPU, retry, registry mutation or qualification
promotion is available. Historical diagnostics supply source metadata only.
"""
from __future__ import annotations
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
for entry in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    if str(entry) not in sys.path: sys.path.insert(0, str(entry))
CAPABILITY = "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1"
SCHEMA = "detail-weight-own-four-season-cpu-v1"
SELECTION = ((2, "dry_season"), (3, "dry_to_wet_transition"), (0, "wet_season"), (1, "wet_to_dry_transition"))
BUDGET = {"seconds": 180, "threads": 2, "outputBytes": 16777216,
          "generatorForwards": 4, "generatorAutograd": 16, "discriminatorAutograd": 4, "optimizerSteps": 0}
COUNTS = {"forwardAttempted": 4, "forwardCompleted": 4, "generatorAttempted": 16,
          "generatorCompleted": 16, "discriminatorAttempted": 4, "discriminatorCompleted": 4}
PROGRAM = "ml/ai-painter/scripts/check_stage4_detail_weight_execution_cpu.py"
TEST = "ml/ai-painter/tests/test_check_stage4_detail_weight_execution_cpu.py"


def require(value, message):
    if not value: raise ValueError(message)


def _runtime():
    import torch
    import painter_stage4_appearance_regime_detail_weight_training_profile as profile
    import check_stage4_mvp256_dry_appearance_regime_cpu as inputs
    import diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu as metadata
    import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as owned
    return torch, profile, inputs, metadata, owned


class Counters(dict):
    """Per-case and whole-run bounds apply before the next computation."""
    def __init__(self):
        super().__init__((key, 0) for key in COUNTS)
        self.case = {key: 0 for key in COUNTS}

    def begin_case(self):
        self.case = {key: self[key] + (4 if key.startswith("generator") else 1) for key in COUNTS}

    def event(self, stage, kind, _gradients):
        require(stage in ("attempt", "complete") and kind in ("forward", "generator", "discriminator"), "unknown computation event")
        key = kind + ("Attempted" if stage == "attempt" else "Completed")
        value = self[key] + 1
        require(value <= min(COUNTS[key], self.case[key]), "actual call budget exceeded: " + key)
        if stage == "complete": require(value <= self[kind + "Attempted"], "completion has no attempt")
        self[key] = value


def source_closure(reader, seeds=(PROGRAM, TEST)):
    """Recompute project import closure from current bytes, including lazy imports."""
    roots = ("ml/ai-painter/scripts", "ml/ai-painter/src", "ml/ai-painter/tests")
    pending, seen = list(seeds), set()
    def locate(name):
        relative = name.replace(".", "/")
        for root in roots:
            for suffix in (relative + ".py", relative + "/__init__.py"):
                path = root + "/" + suffix
                if reader.path(path).is_file(): return path
        return None
    while pending:
        path = pending.pop()
        if path in seen: continue
        seen.add(path); raw, _binding = reader.snapshot(path)
        root = next(prefix for prefix in roots if path.startswith(prefix + "/"))
        parts = path[len(root) + 1:].split("/")[:-1]
        for size in range(1, len(parts) + 1):
            init = root + "/" + "/".join(parts[:size]) + "/__init__.py"
            if reader.path(init).is_file(): pending.append(init)
        for node in ast.walk(ast.parse(raw, filename=path)):
            names = []
            if isinstance(node, ast.Import): names = [alias.name for alias in node.names]
            if isinstance(node, ast.ImportFrom):
                base = ".".join(parts[:len(parts) - node.level + 1]) if node.level else ""
                name = ".".join(part for part in (base, node.module) if part)
                names = [name] + [name + "." + alias.name for alias in node.names if alias.name != "*"]
            for name in names:
                dependency = locate(name)
                if dependency: pending.append(dependency)
    return sorted(seen)


def prepare_bindings(workorder_binding, *, root=ROOT):
    """Opaque selected asset hashes; no pixel decoding, graph, claim or execution."""
    _torch, profile, inputs, metadata, _owned = _runtime()
    reader = inputs.Reader(Path(root))
    work = reader.json(workorder_binding)
    require(work.get("schema") == "t-q4-46-bounded-integration-workorders-v1"
            and work["training"]["id"] == "T-Q4-46"
            and work["training"]["realCpu"] == {"seconds": 180, "threads": 2, "outputBytes": 16777216,
                "forwards": 4, "gGrad": 16, "dGrad": 4, "optimizerSteps": 0}, "own workorder differs")
    for binding in work["documents"]: reader.read(binding)
    spec = next(item for item in work["documents"] if item["path"].endswith("AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"))
    require(b"AI-PAINTER-SPEC-1.50" in reader.read(spec), "current specification differs")
    # This is source reauthentication, not inherited numeric qualification.
    seeds = [path for path in work["training"]["allowedFiles"] if path.endswith(".py") and reader.path(path).is_file()]
    require(PROGRAM in seeds and TEST in seeds, "own CPU program/test sources absent")
    closure = source_closure(reader, seeds)
    plan = profile.prepare_metadata(reader, metadata.DIAGNOSTIC, metadata.CONDITION)
    diagnostic = reader.json(metadata.DIAGNOSTIC)
    dataset = diagnostic["datasetManifest"]
    for ordinal, season in SELECTION:
        row = plan["selected"][str(ordinal)]
        require(row["season"] == season, "fixed first-season train record differs")
        identity = row["identity"]
        reader.read(identity["image"]); reader.read(identity["visualFactManifestFile"])
        pack = reader.json(identity["conditionPack"])
        task = reader.json(identity["taskPackage"]); source = task["sourceBindings"]
        reader.read({"path": source["naturalizedWorldFactsPath"], "sha256": source["naturalizedWorldFactsSha256"]})
        for channel in pack["channels"]: reader.read(channel)
    reader.unchanged()
    return {"schema": SCHEMA, "capabilityVersion": CAPABILITY, "workorder": dict(workorder_binding),
            "budget": dict(BUDGET), "selection": [list(row) for row in SELECTION],
            "outputRoot": work["training"]["evidenceRoot"] + "/real-cpu",
            "datasetManifest": dataset, "metadataCounts": plan["metadataCounts"],
            "sourceSeeds": seeds, "sourceClosure": closure,
            "bindings": [{"path": path, "sha256": sha} for path, sha in sorted(reader.observed.items())],
            "validationRgbRead": False, "qualificationGranted": False}


def authenticate(reader, manifest):
    require(manifest.get("schema") == SCHEMA and manifest.get("capabilityVersion") == CAPABILITY
            and manifest.get("budget") == BUDGET and manifest.get("selection") == [list(row) for row in SELECTION]
            and manifest.get("metadataCounts") == {"train": 48, "validation": 8}
            and manifest.get("validationRgbRead") is False and manifest.get("qualificationGranted") is False,
            "own CPU binding contract differs")
    for binding in manifest["bindings"]: reader.read(binding)
    actual = prepare_bindings(manifest["workorder"], root=reader.root)
    require(actual == manifest, "current source/data closure differs from frozen manifest")


def execute(frozen_binding, *, output, deadline, root=ROOT):
    """Four source-bound zero-update probes in an already-owned child process."""
    torch, profile, inputs, metadata, owned = _runtime()
    from ai_painter.complete_world.object_appearance_regime_detail_weight_precision import validate_model_identity
    from ai_painter.complete_world.object_appearance_regime_bias_precision import build_fresh_object_appearance_regime_bias_precision
    from ai_painter.complete_world.object_appearance_regime_detail_weight_priority_update import bind_parameters
    from ai_painter.complete_world.object_appearance_regime_input_cpu import encode_season
    owned.verify_owned_worker()
    started = time.monotonic()
    require(started < deadline <= started + BUDGET["seconds"], "CPU deadline invalid")
    output = Path(os.path.abspath(output)); reader = inputs.Reader(Path(root))
    manifest = reader.json(frozen_binding)
    require(output == reader.path(manifest["outputRoot"]), "own CPU output differs")
    require(not output.exists(), "CPU opportunity consumed or output already exists")
    output.mkdir(parents=True)
    # Existing writer is stricter (8MiB) than this real gate's 16MiB ceiling.
    def write(name, value): return owned.write_exclusive(output, name, value, failure=name == "failure.json")
    write("claim.json", {"schema": SCHEMA, "binding": frozen_binding, "attempt": 1,
                         "automaticRetries": 0, "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
    def resource():
        require(time.monotonic() < deadline and torch.get_num_threads() <= 2, "CPU time/thread budget exhausted")
        require(owned.output_bytes(output) <= BUDGET["outputBytes"] - 65536, "CPU evidence budget exhausted")
        require(not torch.cuda.is_initialized(), "CPU entry initialized CUDA")
    threads = torch.get_num_threads(); rng = torch.random.get_rng_state().clone()
    counts = Counters(); results = []; evidence = {}; primary = None
    try:
        torch.set_num_threads(2); resource()
        authenticate(reader, manifest)
        inputs.verify_loaded_sources(reader, manifest["sourceClosure"])
        plan = profile.prepare_metadata(reader, metadata.DIAGNOSTIC, metadata.CONDITION)
        with torch.random.fork_rng(devices=[]):
            model, critic = profile.fresh_networks(plan["order"])
            baseline = build_fresh_object_appearance_regime_bias_precision(condition_channel_order=plan["order"])
        require(all(n == m and p.shape == q.shape and p.dtype == q.dtype
                    and torch.equal(p.detach().reshape(-1).view(torch.uint8), q.detach().reshape(-1).view(torch.uint8))
                    for (n, p), (m, q) in zip(model.named_parameters(), baseline.named_parameters()))
                and len(tuple(model.parameters())) == len(tuple(baseline.parameters())) == 107,
                "fresh inherited initialization differs")
        del baseline
        validate_model_identity(model); parameters, heads, seasonal = bind_parameters(model)
        graph = {"parameters": [{"name": name, "shape": list(p.shape)} for name, p in model.named_parameters()],
                 "elements": sum(p.numel() for p in parameters), "headIndices": {key: list(value) for key, value in heads.items()},
                 "seasonalParameterIndex": seasonal, "numericRule": model.numeric_rule, "architecture": model.architecture_id}
        critic.eval().requires_grad_(False)
        before = {"model": inputs.state(model), "critic": inputs.state(critic)}
        for ordinal, season in SELECTION:
            resource(); counts.begin_case(); prior_counts = dict(counts)
            evidence = {"trainOrdinal": ordinal, "season": season}
            sample, code, identity = inputs.load_real(reader, plan, ordinal, season)
            row = plan["selected"][str(ordinal)]
            sample = profile.bind_sample_season(reader, sample, row["identity"], row["regimeRecord"])
            require(sample["split"] == "train" and torch.equal(code, encode_season(season))
                    and sample["sampleId"] == row["identity"]["sampleId"], "fixed CPU train identity differs")
            facts = profile.zero_update_probe(model, critic, sample, plan["order"], resource,
                                              event=counts.event, failure_evidence=evidence)
            delta = {key: counts[key] - prior_counts[key] for key in counts}
            require(delta == {key: 4 if key.startswith("generator") else 1 for key in counts}, "per-season call count differs")
            require(before == {"model": inputs.state(model), "critic": inputs.state(critic)}, "zero-update full state changed")
            validate_model_identity(model); inputs.verify_loaded_sources(reader, manifest["sourceClosure"])
            reader.unchanged(); resource()
            results.append({"trainOrdinal": ordinal, "season": season, "source": identity, "counts": delta, "probe": facts})
        require(dict(counts) == COUNTS and torch.equal(rng, torch.random.get_rng_state()), "terminal counts/RNG differ")
        return write("report.json", {"schema": SCHEMA, "status": "own_four_season_cpu_passed_not_gpu_qualified",
                     "capabilityVersion": CAPABILITY, "binding": frozen_binding, "datasetManifest": manifest["datasetManifest"],
                     "sourceClosure": manifest["sourceClosure"], "inputBindings": manifest["bindings"], "graph": graph,
                     "sampleResults": results, "actualCounts": dict(counts), "optimizerSteps": 0,
                     "cudaInitialized": False, "initialState": before,
                     "finalState": {"model": inputs.state(model), "critic": inputs.state(critic)},
                     "elapsedSeconds": time.monotonic() - started, "qualificationGranted": False,
                     "lifecycleQualified": False, "budget": BUDGET, "writerOutputBytes": owned.LIMITS["outputBytes"]})
    except BaseException as error:
        primary = error
        try: write("failure.json", {"schema": SCHEMA, "status": "failed_closed", "error": str(error)[:4096],
                                    "actualCounts": dict(counts), "partialResults": len(results),
                                    "failureEvidence": {"trainOrdinal": evidence.get("trainOrdinal"), "season": evidence.get("season"),
                                        "gradientSetsAvailable": evidence.get("gradientSetsAvailable"),
                                        "originalError": str(evidence.get("originalError", ""))[:2048]},
                                    "rawGradientSummariesOmittedForFailureReserve": True})
        except BaseException as secondary: error.secondary_evidence_error = str(secondary)
        raise
    finally:
        try: torch.random.set_rng_state(rng); torch.set_num_threads(threads)
        except BaseException as secondary:
            if primary is None: raise
            primary.secondary_restore_error = str(secondary)


def launch(frozen_binding, *, root=ROOT):
    """Existing private-Job runner enforces 180 seconds including child startup."""
    import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as owned
    root = Path(root)
    path = owned.logical_path(root, frozen_binding["path"])
    require(path.stat().st_size <= 2097152, "frozen manifest byte bound exceeded")
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == frozen_binding["sha256"], "frozen manifest SHA differs")
    manifest = json.loads(raw)
    output = owned.logical_path(root, manifest["outputRoot"])
    require(not output.exists(), "own CPU opportunity already consumed")
    deadline = time.monotonic() + BUDGET["seconds"]
    argv = [str(Path(root) / "ml/ai-painter/.venv/Scripts/python.exe"), "-B", str(Path(root) / PROGRAM),
            "--child", "--bindings", frozen_binding["path"], "--sha256", frozen_binding["sha256"],
            "--output", str(output), "--deadline", str(deadline)]
    receipt = owned.run_owned_process(argv, cwd=Path(root), deadline=deadline, evidence_root=output)
    require(receipt["cleanupConfirmed"] and receipt["activeProcessesAfterCleanup"] == 0, "own CPU cleanup unconfirmed")
    owned.write_exclusive(output, "owned-process.json", receipt)
    require(receipt["exitCode"] == 0 and not receipt["timedOut"], "own CPU child failed")
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bindings", required=True); parser.add_argument("--sha256", required=True)
    parser.add_argument("--child", action="store_true"); parser.add_argument("--output"); parser.add_argument("--deadline", type=float)
    args = parser.parse_args(); binding = {"path": args.bindings, "sha256": args.sha256}
    result = execute(binding, output=args.output, deadline=args.deadline) if args.child else launch(binding)
    print(json.dumps(result, ensure_ascii=False))

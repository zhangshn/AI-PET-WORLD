"""One immutable-contract CPU check: train ordinals 0/43, 2 forwards/8 grads.

--describe-contract prints a complete suggested contract without claiming or
decoding samples. The controller writes/freezes it. --contract PATH --sha256
SHA consumes it once. Synthetic tests are separate from real asset counters.
"""
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
import sys
import time
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import torch
import check_stage4_mvp_structured_object_v18_cpu_acceptance as data
from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import (
    CAPABILITY, ARCHITECTURE, CONTEXT_RULE, SHARING_RULE, FEATURE_RULE, ROLES, SEED,
    AGGREGATION_RULE, build_fresh_object_head_shared_hidden_v27_cpu,
)
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import (
    GROUPS, bind_parameter_groups, compute_shared_hidden_priority_gradients_v27_cpu,
)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective
from ai_painter.complete_world.split_training import state_hash

DIRECTORY = ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu"
CONTRACT_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v1.json"
PARENT_DATA_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
PARENT_DATA_SHA = "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp256_dry_v27_cpu.py"
SRC = "ml/ai-painter/src/ai_painter/complete_world/"
TESTS = ["ml/ai-painter/tests/" + name for name in (
    "test_object_head_shared_hidden_v27_cpu.py", "test_object_head_shared_hidden_v27_integration_cpu.py",
    "test_object_head_shared_hidden_priority_v27_cpu.py")]
SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
GUIDE = "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"
SNAPSHOT = DIRECTORY + "/frozen-parent-formal-spec-1.35.md"
SCHEMA = "stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v1"
RESOURCES = {"maxWallSeconds": 180, "cpuThreads": 2, "maxOutputBytes": 16*1024*1024,
    "attempts": 1, "automaticRetries": 0, "maxRealModelForwards": 2, "maxRealAutogradGradCalls": 8}
ACTIVATION = {"cpuCheckAllowed": True, "gpuAllowed": False, "trainingAllowed": False,
    "formalQualificationAllowed": False, "runtimePublicationAllowed": False}
MODEL_PLAN = {"architectureId": ARCHITECTURE, "seed": SEED,
    "parameterElements": 2236015, "parameterTensors": 100,
    "objectParameterElements": 1372, "objectParameterTensors": 10,
    "contextRule": CONTEXT_RULE, "aggregationRule": AGGREGATION_RULE,
    "sharingRule": SHARING_RULE, "featureRule": FEATURE_RULE,
    "initialization": "fresh_v23_footprints_first_block_four_original_last_convs_no_extra_rng",
    "historicalCheckpointLoaded": False}
GRADIENT_PLAN = {"groups": list(GROUPS), "formula": "fixed_v24_negative_other_projection_float64_then_fp32",
    "totalGradientAtol": 1e-6, "totalGradientRtol": 1e-5, "roundoffMultiplier": 16,
    "sharedCoreSource": "complete_aggregated_original_objectCoreRgbWeighted_scalar",
    "independentTotalScope": "all_100_model_parameters",
    "auxiliaryScope": "10_shared_and_adapter_parameters_three_calls",
    "nonGroupGradient": "original_independent_actual_total",
    "crossClassCouplingChanged": True, "oldFourGroupUpdateEquivalenceClaim": False,
    "lossAndWeightsChanged": False}
require = data.require


def project_file(path):
    require(isinstance(path, str) and path and "\\" not in path and ":" not in path
        and not path.startswith("/") and all(v not in ("", ".", "..", "latest", "latest.json")
        for v in path.split("/")), "unsafe project path")
    target = (ROOT / path).resolve()
    require(target.is_relative_to(ROOT.resolve()) or (path.startswith(".runtime/")
        and target.is_relative_to((ROOT / ".runtime").resolve())), "path escapes project/runtime")
    return target


def bind(path):
    return {"path": path, "sha256": hashlib.sha256(project_file(path).read_bytes()).hexdigest()}


def write_exclusive(path, value):
    encoded = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
    require(len(encoded) <= RESOURCES["maxOutputBytes"], "CPU output exceeds 16MiB")
    target = project_file(path); target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as stream:
        stream.write(encoded); stream.flush(); os.fsync(stream.fileno())
    return {"path": path, "sha256": hashlib.sha256(encoded).hexdigest()}


def required_program_paths():
    """Static local-import closure, including lazy imports and package initializers."""
    pending = [PROGRAM, *TESTS, SRC+"object_head_shared_hidden_v27_cpu.py",
               SRC+"object_head_shared_hidden_priority_v27_cpu.py"]
    seen = set()
    roots = ["ml/ai-painter/src/", "ml/ai-painter/scripts/", "ml/ai-painter/tests/"]
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        tree = ast.parse(project_file(path).read_text(encoding="utf8"))
        for node in ast.walk(tree):
            names = [a.name for a in node.names] if isinstance(node, ast.Import) else (
                [node.module] if isinstance(node, ast.ImportFrom) and node.module and not node.level else [])
            for name in names:
                suffix = name.replace(".", "/")
                for root in roots:
                    options = (root+suffix+".py", root+suffix+"/__init__.py")
                    found = next((p for p in options if project_file(p).is_file()), None)
                    if found:
                        pending.append(found)
                        parts = suffix.split("/")
                        for i in range(1, len(parts)):
                            init = root+"/".join(parts[:i])+"/__init__.py"
                            if project_file(init).is_file(): pending.append(init)
                        break
    return sorted(seen)


def selected_metadata(reader, manifest):
    source = reader.json(manifest["sourceIndex"])
    require(source["sampleCount"] == len(source["samples"]) == 64, "64 source rows required")
    rows = {r["sampleId"]: r for r in source["samples"]}
    require(len(rows) == 64 and manifest["sampleCount"] == 64 and manifest["splitCounts"] == data.COUNTS,
            "fixed source capacity differs")
    splits = {k: reader.json(b) for k, b in manifest["splits"].items()}
    seen = set()
    for key, count in data.COUNTS.items():
        ids = splits[key]["sampleIds"]
        require(splits[key]["split"] == key and len(set(ids)) == len(ids) == count
            and seen.isdisjoint(ids) and all(rows[i]["split"] == key for i in ids), "split overlap/membership differs")
        seen.update(ids)
    require(len(seen) == 64, "incomplete split coverage")
    return [deepcopy(rows[splits["train"]["sampleIds"][i]]) for i in (0, 43)]


def selected_asset_bindings(reader, rows):
    """Bind only selected train content; other splits remain membership metadata."""
    result = {}
    def add(binding):
        path = binding["path"]
        clean = {"path": path, "sha256": binding["sha256"]}
        require(path not in result or result[path] == clean, "conflicting selected asset SHA")
        result[path] = clean
    for row in rows:
        for key in ("image", "conditionPack", "contribution", "sourceRecord", "regionSource"):
            add(row[key])
        pack = reader.json(row["conditionPack"])
        for channel in pack["channels"]: add(channel)
        contribution = reader.json(row["contribution"])
        task_binding = {"path": contribution["taskPackagePath"], "sha256": contribution["taskPackageSha256"]}
        add(task_binding)
        task = reader.json(task_binding)
        visual = task["sourceBindings"]["visualFactManifestPath"]
        add(bind(visual))
        add({"path": task["sourceBindings"]["naturalizedWorldFactsPath"],
             "sha256": task["sourceBindings"]["naturalizedWorldFactsSha256"]})
    return [result[p] for p in sorted(result)]


def contract_template():
    reader = data.BoundReader(ROOT)
    manifest = reader.json(data.MANIFEST)
    rows = selected_metadata(reader, manifest)
    parent = reader.json({"path": PARENT_DATA_PATH, "sha256": PARENT_DATA_SHA})
    return {"schemaVersion": SCHEMA, "status": "cpu_only_inactive_not_execution_qualified",
        "capabilityVersion": CAPABILITY, "immutable": True,
        "formalSpecification": bind(SPEC), "executionGuide": bind(GUIDE),
        "historicalParentSpecification": bind(SNAPSHOT),
        "modelPlan": MODEL_PLAN, "gradientPlan": GRADIENT_PLAN,
        "resourceBound": RESOURCES, "activation": ACTIVATION,
        "dataUse": {"splitCounts": data.COUNTS, "trainOrdinals": [0, 43],
            "validationContentRead": False, "challengeContentRead": False, "regressionContentRead": False},
        "dataBindings": {"datasetManifest": data.MANIFEST, "sourceIndex": manifest["sourceIndex"],
            "splits": manifest["splits"], "conditionContract": data.CONDITION_CONTRACT,
            "parentDataCandidate": {"path": PARENT_DATA_PATH, "sha256": PARENT_DATA_SHA},
            "numericReview": parent["frozenBindings"]["numericReview"],
            "detailReview": parent["frozenBindings"]["detailReview"]},
        "selectedTrainRows": rows, "selectedAssetBindings": selected_asset_bindings(reader, rows),
        "programBindings": [bind(p) for p in required_program_paths()],
        "syntheticTests": TESTS, "cpuReportPath": DIRECTORY+"/report.json",
        "cpuFailurePath": DIRECTORY+"/failure.json", "cpuClaimPath": DIRECTORY+"/claim.json"}


def validate_contract(reader, binding):
    require(binding["path"] == CONTRACT_PATH, "unique V27 CPU contract path required")
    c = reader.json(binding)
    require(c.get("schemaVersion") == SCHEMA and c.get("status") == "cpu_only_inactive_not_execution_qualified"
        and c.get("immutable") is True and c.get("capabilityVersion") == CAPABILITY, "inactive contract identity differs")
    for key, expected in (("modelPlan", MODEL_PLAN), ("gradientPlan", GRADIENT_PLAN),
                          ("resourceBound", RESOURCES), ("activation", ACTIVATION)):
        require(c.get(key) == expected, "contract plan differs: " + key)
    require(c.get("dataUse") == {"splitCounts": data.COUNTS, "trainOrdinals": [0, 43],
        "validationContentRead": False, "challengeContentRead": False, "regressionContentRead": False}, "CPU data use differs")
    for key, path, digest in (("formalSpecification", SPEC, "8b55b8f9ff578711cac29aad578f2ff056d7f1bc41e1d1ab72446afc9f16cfcf"),
        ("executionGuide", GUIDE, "7a14a5cbd3a133e729a1184312a29fa9089a70c8c5f19d87b02eb9244ff92990"),
        ("historicalParentSpecification", SNAPSHOT, "8c61d84a8cdd727ee2d4879ab594630ebee7d3e91e678c81d75bb7b5ea9fbd28")):
        require(c.get(key) == {"path": path, "sha256": digest}, "frozen formal identity differs: " + key)
        reader.read(c[key])
    require(c.get("syntheticTests") == TESTS, "synthetic suite differs")
    for key, name in (("cpuReportPath", "report"), ("cpuFailurePath", "failure"), ("cpuClaimPath", "claim")):
        require(c.get(key) == DIRECTORY+"/"+name+".json", "fixed evidence path differs")
    bindings = c.get("programBindings", [])
    require(len({b["path"] for b in bindings}) == len(bindings)
        and {b["path"] for b in bindings} == set(required_program_paths()), "complete local program/test closure differs")
    for b in bindings: reader.read(b)
    d = c["dataBindings"]
    require(d["datasetManifest"] == data.MANIFEST and d["conditionContract"] == data.CONDITION_CONTRACT,
            "original dataset/condition contract differs")
    require(d["parentDataCandidate"] == {"path": PARENT_DATA_PATH, "sha256": PARENT_DATA_SHA},
            "original V24 data candidate differs")
    manifest = reader.json(d["datasetManifest"])
    require(d["sourceIndex"] == manifest["sourceIndex"] and d["splits"] == manifest["splits"], "data metadata binding differs")
    condition = reader.json(d["conditionContract"])
    require(manifest["identityPayload"]["channelOrder"] == condition["tensorContract"]["channelOrder"]
        and manifest["identityPayload"]["continuousChannelIds"] == condition["tensorContract"]["typePartitions"]["continuous"],
        "channel order/type differs")
    parent = reader.json(d["parentDataCandidate"])
    require(parent["frozenBindings"]["datasetManifest"] == d["datasetManifest"]
        and all(d[k] == parent["frozenBindings"][k] for k in ("numericReview", "detailReview")), "original data/review differs")
    for k in ("numericReview", "detailReview"): reader.read(d[k])
    rows = selected_metadata(reader, manifest)
    require(c["selectedTrainRows"] == rows, "fixed train ordinal rows differ")
    require(c["selectedAssetBindings"] == selected_asset_bindings(reader, rows), "selected original asset bindings differ")
    for b in c["selectedAssetBindings"]: reader.read(b)
    return c, manifest, rows


@contextmanager
def zero_update_guard():
    with patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("optimizer prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("checkpoint load prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("checkpoint write prohibited")), \
         patch.object(torch.Tensor, "backward", side_effect=RuntimeError("backward prohibited")), \
         patch.object(torch.cuda, "is_available", side_effect=RuntimeError("GPU prohibited")):
        yield


def synthetic_suite():
    sys.path.insert(0, str(ROOT / "ml/ai-painter/tests"))
    suite = unittest.TestSuite()
    for path in TESTS:
        suite.addTests(unittest.defaultTestLoader.loadTestsFromName(Path(path).stem))
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    return {"testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
            "skipped": len(result.skipped), "passed": result.wasSuccessful(), "rawOutput": stream.getvalue()}


def execute(binding):
    started = time.monotonic()
    counters = {"modelForwardsAttempted": 0, "modelForwardsCompleted": 0,
                "autogradGradCallsAttempted": 0, "autogradGradCallsCompleted": 0}
    reader = data.BoundReader(ROOT)
    # Duplicate consumption never produces a second run or replaces old evidence.
    require(not project_file(DIRECTORY+"/claim.json").exists(), "V27 CPU claim already consumed")
    require(not project_file(DIRECTORY+"/report.json").exists() and not project_file(DIRECTORY+"/failure.json").exists(),
            "V27 CPU terminal already exists")
    require(not torch.cuda.is_initialized(), "CUDA already initialized")
    # Claim after authenticating input bytes, before any CPU probe.
    reader.read(binding)
    write_exclusive(DIRECTORY+"/claim.json", {"contract": binding, "attempt": 1, "automaticRetries": 0,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat()})
    boundary = {"optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False,
        "gpuStarted": False, "trainingStarted": False, "validationContentRead": False,
        "challengeContentRead": False, "regressionContentRead": False, "executionRegistryWritten": False,
        "formalStage4Qualified": False, "runtimePublicationGranted": False}
    old_threads = torch.get_num_threads()
    rng = torch.random.get_rng_state().clone()
    expired = threading.Event()
    def deadline():
        expired.set()
        _thread.interrupt_main()
    watchdog = threading.Timer(max(.001, 180-(time.monotonic()-started)), deadline)
    watchdog.daemon = True
    watchdog.start()
    def resource_check():
        require(not expired.is_set() and time.monotonic()-started <= 180, "CPU wall time exceeded")
        require(torch.get_num_threads() == 2 and not torch.cuda.is_initialized(), "CPU resource boundary differs")
        require(counters["modelForwardsAttempted"] <= 2 and counters["autogradGradCallsAttempted"] <= 8,
                "real call budget exceeded")
    try:
        torch.set_num_threads(2)
        c, manifest, rows = validate_contract(reader, binding)
        with torch.random.fork_rng(devices=[]), zero_update_guard():
            synthetics = synthetic_suite()
            require(synthetics["passed"] and not synthetics["skipped"], "synthetic CPU suite failed")
            resource_check()
            order = manifest["identityPayload"]["channelOrder"]
            continuous = manifest["identityPayload"]["continuousChannelIds"]
            torch.manual_seed(SEED)
            model = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=order).train()
            critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
            params, groups = bind_parameter_groups(model)
            owned = {i for indexes in groups.values() for i in indexes}
            require((sum(p.numel() for p in params), len(params), sum(params[i].numel() for i in owned), len(owned))
                == (2236015, 100, 1372, 10), "actual parameter graph differs")
            initial = {"model": state_hash(model), "critic": state_hash(critic)}
            sample_results = []
            for ordinal, row in zip((0, 43), rows):
                resource_check()
                sample, identity = data.load_sample(reader, row, order, continuous)
                require(sample["split"] == "train", "real gradients require train")
                source = {k: sample[k].clone() for k in ("image", "conditions")}
                table = deepcopy(sample["objectInstanceTable"])
                local_rng = torch.random.get_rng_state().clone()
                counters["modelForwardsAttempted"] += 1
                prediction, evidence = model(sample["conditions"][None], table, return_evidence=True)
                counters["modelForwardsCompleted"] += 1
                total, parts = train_object_core_fidelity_candidate_objective(critic, prediction, sample, table, order)
                gradients, facts = compute_shared_hidden_priority_gradients_v27_cpu(model=model, critic=critic,
                    sample=sample, actual_total=total, structured_objective=parts["v21UnchangedTotal"],
                    whole_frame_fidelity=parts["wholeFrameFidelity"], object_core_rgb=parts["objectCoreRgbWeighted"],
                    counter=counters, resource_check=resource_check)
                applicable = {r: int(sample["conditions"][order.index(r)].count_nonzero()) for r in ROLES}
                for key, diagnostic in facts["groupDiagnostics"].items():
                    if key == GROUPS[0] or applicable[key]:
                        require(diagnostic["coreL2"] > 0 and diagnostic["candidateL2"] > 0,
                                "applicable shared/adapter gradient is zero: " + key)
                require(all(bool(torch.isfinite(v).all()) for v in gradients), "nonfinite complete gradients")
                require(all(torch.equal(sample[k], v) for k, v in source.items())
                    and table == sample["objectInstanceTable"], "source tensor/instances changed")
                require(torch.equal(local_rng, torch.random.get_rng_state()), "real probe RNG changed")
                require(initial == {"model": state_hash(model), "critic": state_hash(critic)}
                    and all(p.grad is None for n in (model, critic) for p in n.parameters()), "zero-update state changed")
                sample_results.append({"trainOrdinal": ordinal, "identity": identity, "fourClassCorePixels": applicable,
                    "originalLoss": float(total.detach()), "gradientFacts": facts,
                    "sourceTensorsInstancesUnchanged": True, "objectCount": evidence["objectCount"]})
                del prediction, evidence, total, parts, gradients
            require(counters == {"modelForwardsAttempted": 2, "modelForwardsCompleted": 2,
                "autogradGradCallsAttempted": 8, "autogradGradCallsCompleted": 8}, "real counters differ")
            # Any lazy project module must have been frozen by the static closure.
            frozen = {b["path"] for b in c["programBindings"]}
            for module in tuple(sys.modules.values()):
                file = getattr(module, "__file__", None)
                if file:
                    path = Path(file).resolve()
                    if path.suffix == ".py" and any(path.is_relative_to(ROOT / directory) for directory in (
                            "ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests")):
                        require(path.relative_to(ROOT).as_posix() in frozen, "unbound imported local program: " + str(path))
            reader.unchanged(); resource_check()
        require(torch.equal(rng, torch.random.get_rng_state()), "caller RNG restoration failed")
        report = {"schemaVersion": "ai-painter-mvp256-dry-v27-cpu-check-v1",
            "status": "cpu_contract_checked_not_execution_qualified", "contract": binding,
            "capabilityVersion": CAPABILITY, "architectureId": ARCHITECTURE,
            "formalSpecification": c["formalSpecification"], "historicalParentSpecification": c["historicalParentSpecification"],
            "programBindings": c["programBindings"], "verifiedBindings": [
                {"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
            "modelPlan": MODEL_PLAN, "gradientPlan": GRADIENT_PLAN, "realCallCounts": counters,
            "syntheticEvidence": synthetics, "sampleResults": sample_results,
            "testedTrainSampleCount": 2, "all48GradientProbesCompleted": False,
            "initialState": initial, "finalState": {"model": state_hash(model), "critic": state_hash(critic)},
            "boundary": boundary, "elapsedSeconds": time.monotonic()-started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        return write_exclusive(DIRECTORY+"/report.json", report)
    except BaseException as error:
        if expired.is_set():
            error = TimeoutError("CPU 180s watchdog expired")
        failure = {"status": "cpu_check_failed_closed", "contract": binding,
            "errorType": type(error).__name__, "error": str(error), "realCallCounts": counters,
            "verifiedBindings": [{"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
            "boundary": boundary, "elapsedSeconds": time.monotonic()-started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        write_exclusive(DIRECTORY+"/failure.json", failure)
        if expired.is_set(): raise error
        raise
    finally:
        watchdog.cancel()
        torch.random.set_rng_state(rng)
        torch.set_num_threads(old_threads)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--describe-contract", action="store_true")
    parser.add_argument("--contract")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.describe_contract:
        require(not args.contract and not args.sha256, "description cannot consume contract")
        print(json.dumps(contract_template(), ensure_ascii=False, indent=2))
    else:
        parser.error("--contract and --sha256 required") if not (args.contract and args.sha256) else None
        print(json.dumps(execute({"path": args.contract, "sha256": args.sha256}), ensure_ascii=False))

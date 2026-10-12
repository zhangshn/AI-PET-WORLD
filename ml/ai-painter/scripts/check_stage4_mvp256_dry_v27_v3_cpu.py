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
    CAPABILITY as MODEL_CAPABILITY, ARCHITECTURE, CONTEXT_RULE, SHARING_RULE, FEATURE_RULE, ROLES, SEED,
    AGGREGATION_RULE, build_fresh_object_head_shared_hidden_v27_cpu,
)
from ai_painter.complete_world.object_head_shared_hidden_priority_v27_cpu import (
    GROUPS, bind_parameter_groups, compute_shared_hidden_priority_gradients_v27_cpu,
)
from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import train_object_core_fidelity_candidate_objective
from ai_painter.complete_world.split_training import state_hash

CAPABILITY = "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_v3_candidate"
DIRECTORY = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu"
CONTRACT_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v3.json"
PARENT_DATA_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
PARENT_DATA_SHA = "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"
PROGRAM = "ml/ai-painter/scripts/check_stage4_mvp256_dry_v27_v3_cpu.py"
SUCCESS_TEST = "ml/ai-painter/tests/test_check_stage4_mvp256_dry_v27_v3_cpu.py"
SRC = "ml/ai-painter/src/ai_painter/complete_world/"
TESTS = ["ml/ai-painter/tests/" + name for name in (
    "test_object_head_shared_hidden_v27_cpu.py", "test_object_head_shared_hidden_v27_integration_cpu.py",
    "test_object_head_shared_hidden_priority_v27_cpu.py", "test_check_stage4_mvp256_dry_v27_v2_cpu.py", "test_check_stage4_mvp256_dry_v27_v3_cpu.py")]
SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
GUIDE = "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"
SNAPSHOT = DIRECTORY + "/frozen-parent-formal-spec-1.37.md"
V2_SNAPSHOT = ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-cpu/frozen-parent-formal-spec-1.36.md"
HISTORICAL_SNAPSHOT = ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/frozen-parent-formal-spec-1.35.md"
SCHEMA = "stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v3"
PREDECESSOR_CONTRACT = {"path": "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v1.json",
    "sha256": "1fac0c8b134709d250e85206f5bcec6ab5196b87ad5ec8260cbf50751ea68849"}
PREDECESSOR_FAILURE = {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/failure.json",
    "sha256": "16f9728a1288059c32a5677c7a6c891cfb129425d1cbd36f33dc97c4b4a93a04"}
PREDECESSOR_PROGRAM = {"path": "ml/ai-painter/scripts/check_stage4_mvp256_dry_v27_cpu.py",
    "sha256": "2095d0ff9ac523e9214e373c3c7ba66af2adf05e451a83a3653fa4a734238bd4"}
V2_BINDINGS = {
    "contract": {"path": "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v2.json",
        "sha256": "3b91aa94339ed3c6a50c1fcc2b73ba2e64ce536e34f7c41ca349e8738bb67560"},
    "program": {"path": "ml/ai-painter/scripts/check_stage4_mvp256_dry_v27_v2_cpu.py",
        "sha256": "20eff3520c61abf3d5d4f0915bdb43d4aaf68ecc605b24708b7b847550550e2b"},
    "tests": {"path": "ml/ai-painter/tests/test_check_stage4_mvp256_dry_v27_v2_cpu.py",
        "sha256": "cfd3fcc2fe12543935f08ed68d857ec4f70f4703b0b56c0f49e5a777d2d19897"},
    "failure": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-cpu/failure.json",
        "sha256": "e28a56579b9590458f419956a21b59ab4025a69464a794398f6641120308d97f"},
    "claim": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-cpu/claim.json",
        "sha256": "329637a199ccec6ea425b33421707a0caacb52a45f63e0a9a0c5f5c216ef7437"},
    "acceptance": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-cpu/controller-acceptance.json",
        "sha256": "4759da41d7c1bf1efa12c8b6caa4d7b11eec7d4d8b2e36c122e925a71fca4380"},
    "dependencyReview": {"path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-cpu/dependency-review.json",
        "sha256": "791ec0f09db0e412b2492dcd9bd7f15f032df8662ddeb0caea594692ba370531"}}
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


SOURCE_ROOTS = ("ml/ai-painter/src", "ml/ai-painter/scripts", "ml/ai-painter/tests")


def local_dependency_closure(seeds):
    """Read only reachable source. Include static lazy imports, never execute them.

    A from-import name may be a symbol: only an existing child module is added.
    Missing explicit imports within a known local package fail closed. Static
    parsing does not claim to exhaust dynamically constructed import strings.
    """
    pending, seen = list(seeds), set()

    def context(path):
        for root in SOURCE_ROOTS:
            prefix = root + "/"
            if path.startswith(prefix):
                suffix = path[len(prefix):]
                require(suffix.endswith(".py"), "Python source required")
                parts = suffix[:-3].split("/")
                package = parts[:-1]
                if parts[-1] == "__init__":
                    package = parts[:-1]
                return root, package
        raise ValueError("dependency seed is outside source roots: " + path)

    def module_files(name):
        require(all(part.isidentifier() for part in name.split(".")), "invalid import module name")
        suffix = name.replace(".", "/")
        for root in SOURCE_ROOTS:
            # Python resolves packages before a same-name plain module.
            for path in (root+"/"+suffix+"/__init__.py", root+"/"+suffix+".py"):
                if project_file(path).is_file():
                    result = [path]
                    for i in range(1, len(suffix.split("/"))):
                        init = root+"/"+"/".join(suffix.split("/")[:i])+"/__init__.py"
                        if project_file(init).is_file():
                            result.append(init)
                    return result
        return []

    def known_local(name):
        top = name.split(".")[0]
        return any(project_file(root+"/"+top).is_dir()
                   or project_file(root+"/"+top+".py").is_file() for root in SOURCE_ROOTS)

    while pending:
        path = pending.pop()
        if path in seen:
            continue
        root, package = context(path)
        # Resolve source before reading; symlink traversal cannot escape ROOT.
        text = project_file(path).read_text(encoding="utf8")
        seen.add(path)
        # Seeds also bind all parent initializers even without an import edge.
        parts = path[len(root)+1:].split("/")[:-1]
        for i in range(1, len(parts)+1):
            init = root+"/"+"/".join(parts[:i])+"/__init__.py"
            if project_file(init).is_file():
                pending.append(init)
        for node in ast.walk(ast.parse(text, filename=path)):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    files = module_files(alias.name)
                    require(files or not known_local(alias.name), "unresolved local import: "+alias.name)
                    pending.extend(files)
            elif isinstance(node, ast.ImportFrom):
                if node.level:
                    require(node.level <= len(package), "relative import escapes package: "+path)
                    base = package[:len(package)-node.level+1]
                    name = ".".join(base + (node.module.split(".") if node.module else []))
                else:
                    name = node.module or ""
                files = module_files(name) if name else []
                require(files or (not node.level and not known_local(name)),
                        "unresolved local from-import: "+name)
                pending.extend(files)
                if files:
                    for alias in node.names:
                        if alias.name != "*":
                            pending.extend(module_files(name+"."+alias.name))
    return sorted(seen)


def required_program_paths():
    return local_dependency_closure([PROGRAM, SUCCESS_TEST, *TESTS,
        SRC+"object_head_shared_hidden_v27_cpu.py", SRC+"object_head_shared_hidden_priority_v27_cpu.py"])


def verify_loaded_programs(reader, bindings, *, modules=None):
    """Verify actual project-source module locations and immutable bytes.

    Virtualenv and external library modules are not project source. A module
    claiming a source-root path must resolve inside ROOT and its declared
    source roots, must be bound, and must match SHA, including lazy imports.
    """
    by_path = {}
    for binding in bindings:
        path = binding["path"]
        require(path not in by_path, "duplicate program binding")
        target = project_file(path)
        require(any(target.is_relative_to((ROOT/root).resolve()) for root in SOURCE_ROOTS),
                "program binding outside source roots")
        by_path[path] = binding
    verified = set()
    for module in tuple((sys.modules if modules is None else modules).values()):
        filename = getattr(module, "__file__", None)
        if not filename:
            continue
        source = Path(filename)
        if not source.is_absolute():
            # External module proxies can expose a relative virtual __file__
            # (e.g. PyTorch operator namespaces) without a file-loader origin.
            # Authenticate their owning class's actual library module location
            # rather than invent a cwd-local source file from that marker.
            origin = getattr(getattr(module, "__spec__", None), "origin", None)
            if origin and Path(origin).is_absolute():
                source = Path(origin)
            else:
                owner = sys.modules.get(type(module).__module__)
                owner_file = getattr(owner, "__file__", None)
                if origin is None and owner_file and Path(owner_file).is_absolute():
                    owner_path = Path(owner_file)
                    if not owner_path.is_relative_to(ROOT) or owner_path.is_relative_to(ROOT / "ml/ai-painter/.venv"):
                        continue
        raw = source.absolute()
        if not raw.is_relative_to(ROOT):
            continue
        # Bundled environment libraries are external dependencies. Any other
        # project-local module must be in the declared source roots; do not
        # silently exempt dynamically loaded project code in another directory.
        if raw.is_relative_to(ROOT / "ml/ai-painter/.venv"):
            continue
        require(any(raw.is_relative_to(ROOT/root) for root in SOURCE_ROOTS),
                "loaded project module outside declared source roots: "+str(raw))
        require(raw.suffix == ".py", "loaded project module lacks bound Python source: "+str(raw))
        logical = raw.relative_to(ROOT).as_posix()
        target = project_file(logical)
        require(any(target.is_relative_to((ROOT/root).resolve()) for root in SOURCE_ROOTS),
                "loaded project module escaped source roots")
        require(logical in by_path, "unbound imported local program: "+str(raw))
        reader.read(by_path[logical])
        verified.add(logical)
    return sorted(verified)


def check_program_coverage(reader, bindings, phase, checks):
    item = {"phase": phase, "status": "started"}
    checks.append(item)
    item["verifiedModulePaths"] = verify_loaded_programs(reader, bindings)
    item["status"] = "verified"



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
        "capabilityVersion": CAPABILITY, "modelCapabilityVersion": MODEL_CAPABILITY, "immutable": True,
        "formalSpecification": bind(SPEC), "executionGuide": bind(GUIDE),
        "historicalParentSpecification": bind(SNAPSHOT),
        "historicalV27Specification": bind(HISTORICAL_SNAPSHOT),
        "historicalV2Specification": bind(V2_SNAPSHOT), "dependencyPredecessor": V2_BINDINGS,
        "dependencyRule": "recursive_static_absolute_relative_package_child_and_parent_init_v1",
        "predecessorContract": PREDECESSOR_CONTRACT, "predecessorFailure": PREDECESSOR_FAILURE,
        "predecessorProgram": PREDECESSOR_PROGRAM,
        "predecessorClaim": bind(".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/claim.json"),
        "predecessorAcceptance": bind(".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/controller-acceptance.json"),
        "successPathTests": bind(SUCCESS_TEST),
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
        and c.get("immutable") is True and c.get("capabilityVersion") == CAPABILITY
        and c.get("modelCapabilityVersion") == MODEL_CAPABILITY, "inactive contract identity differs")
    for key, expected in (("modelPlan", MODEL_PLAN), ("gradientPlan", GRADIENT_PLAN),
                          ("resourceBound", RESOURCES), ("activation", ACTIVATION)):
        require(c.get(key) == expected, "contract plan differs: " + key)
    require(c.get("dataUse") == {"splitCounts": data.COUNTS, "trainOrdinals": [0, 43],
        "validationContentRead": False, "challengeContentRead": False, "regressionContentRead": False}, "CPU data use differs")
    for key, path, digest in (("formalSpecification", SPEC, "aa28b9617b85df7c5f50b47f02f328eb9267f5c6a72e1c5fa7ca9e6e83d9527c"),
        ("executionGuide", GUIDE, "8098cab9ac8232b42839eb4519fb9ffe393d592133f29f1284a8f3956c720799"),
        ("historicalParentSpecification", SNAPSHOT, "0d5fc32f8d14114da27c9dee0aca28ba99711fa42c1c38ee053bf41d60f55ab7"),
        ("historicalV2Specification", V2_SNAPSHOT, "8b55b8f9ff578711cac29aad578f2ff056d7f1bc41e1d1ab72446afc9f16cfcf"),
        ("historicalV27Specification", HISTORICAL_SNAPSHOT, "8c61d84a8cdd727ee2d4879ab594630ebee7d3e91e678c81d75bb7b5ea9fbd28")):
        require(c.get(key) == {"path": path, "sha256": digest}, "frozen formal identity differs: " + key)
        reader.read(c[key])
    validate_v1_history(reader, c)
    validate_predecessor(reader, c)
    require(c.get("successPathTests") == bind(SUCCESS_TEST), "success-path test binding differs")
    reader.read(c["successPathTests"])
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


def validate_v1_history(reader, contract):
    """Accept only the immutable, consumed zero-call state-API failure."""
    for key, expected in (("predecessorContract", PREDECESSOR_CONTRACT),
                          ("predecessorFailure", PREDECESSOR_FAILURE),
                          ("predecessorProgram", PREDECESSOR_PROGRAM)):
        require(contract.get(key) == expected, "predecessor binding differs: " + key)
        reader.read(expected)
    parent = reader.json(PREDECESSOR_CONTRACT)
    failure = reader.json(PREDECESSOR_FAILURE)
    require(parent.get("schemaVersion") == "stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v1"
        and parent.get("capabilityVersion") == MODEL_CAPABILITY
        and failure.get("status") == "cpu_check_failed_closed"
        and failure.get("contract") == PREDECESSOR_CONTRACT
        and failure.get("errorType") == "TypeError"
        and failure.get("error") == "unsupported state value: SharedHiddenRenderer"
        and failure.get("realCallCounts") == {"modelForwardsAttempted": 0, "modelForwardsCompleted": 0,
            "autogradGradCallsAttempted": 0, "autogradGradCallsCompleted": 0},
        "predecessor is not the exact zero-call state API failure")
    for key, path in (("predecessorClaim", ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/claim.json"),
                      ("predecessorAcceptance", ".runtime/ai-painter/stage4-mvp256-dry-v27-cpu/controller-acceptance.json")):
        require(contract[key]["path"] == path, "predecessor evidence path differs")
        reader.read(contract[key])
    claim = reader.json(contract["predecessorClaim"])
    require(claim.get("contract") == PREDECESSOR_CONTRACT and claim.get("attempt") == 1
        and claim.get("automaticRetries") == 0, "predecessor claim is not consumed")
    # Preserve and authenticate every frozen predecessor program/test dependency.
    for binding in parent["programBindings"]:
        reader.read(binding)


def validate_predecessor(reader, contract):
    require(contract.get("dependencyPredecessor") == V2_BINDINGS, "exact dependency predecessor bindings required")
    require(contract.get("dependencyRule") == "recursive_static_absolute_relative_package_child_and_parent_init_v1",
            "dependency rule differs")
    for binding in V2_BINDINGS.values():
        reader.read(binding)
    parent = reader.json(V2_BINDINGS["contract"])
    failure = reader.json(V2_BINDINGS["failure"])
    claim = reader.json(V2_BINDINGS["claim"])
    acceptance = reader.json(V2_BINDINGS["acceptance"])
    require(parent["capabilityVersion"] == "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_v2_candidate"
        and failure["status"] == "cpu_check_failed_closed" and failure["contract"] == V2_BINDINGS["contract"]
        and failure["errorType"] == "ValueError"
        and failure["error"] == "unbound imported local program: F:\\ai-pet-world\\ml\\ai-painter\\src\\ai_painter\\blueprint\\schema.py"
        and failure["realCallCounts"] == {"modelForwardsAttempted": 2, "modelForwardsCompleted": 2,
            "autogradGradCallsAttempted": 8, "autogradGradCallsCompleted": 8}
        and claim["contract"] == V2_BINDINGS["contract"] and claim["attempt"] == 1 and claim["automaticRetries"] == 0
        and acceptance["status"] == "rejected_incomplete_local_import_binding"
        and acceptance["acceptedCpuQualification"] is False, "predecessor is not the exact consumed dependency failure")
    for binding in parent["programBindings"]:
        reader.read(binding)


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
    sample_results, dependency_checks = [], []
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
        check_program_coverage(reader, c["programBindings"], "before_synthetic_suite", dependency_checks)
        with torch.random.fork_rng(devices=[]), zero_update_guard():
            synthetics = synthetic_suite()
            require(synthetics["passed"] and not synthetics["skipped"], "synthetic CPU suite failed")
            resource_check()
            order = manifest["identityPayload"]["channelOrder"]
            continuous = manifest["identityPayload"]["continuousChannelIds"]
            torch.manual_seed(SEED)
            model = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=order).train()
            critic = build_conditional_texture_discriminator().eval().requires_grad_(False)
            actual_model = {"capabilityVersion": model.capability_version,
                "executionQualified": model.execution_qualified,
                "parentCheckpointLoaded": model.parent_checkpoint_loaded}
            require(actual_model == {"capabilityVersion": MODEL_CAPABILITY,
                "executionQualified": False, "parentCheckpointLoaded": False}, "actual V27 model identity differs")
            params, groups = bind_parameter_groups(model)
            owned = {i for indexes in groups.values() for i in indexes}
            require((sum(p.numel() for p in params), len(params), sum(params[i].numel() for i in owned), len(owned))
                == (2236015, 100, 1372, 10), "actual parameter graph differs")
            initial = {"model": state_hash(model.state_dict()), "critic": state_hash(critic.state_dict())}
            for ordinal, row in zip((0, 43), rows):
                resource_check()
                check_program_coverage(reader, c["programBindings"], "before_sample_"+str(ordinal), dependency_checks)
                sample, identity = data.load_sample(reader, row, order, continuous)
                check_program_coverage(reader, c["programBindings"], "after_sample_"+str(ordinal)+"_before_forward", dependency_checks)
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
                require(initial == {"model": state_hash(model.state_dict()), "critic": state_hash(critic.state_dict())}
                    and all(p.grad is None for n in (model, critic) for p in n.parameters()), "zero-update state changed")
                sample_results.append({"trainOrdinal": ordinal, "identity": identity, "fourClassCorePixels": applicable,
                    "originalLoss": float(total.detach()), "gradientFacts": facts,
                    "sourceTensorsInstancesUnchanged": True, "objectCount": evidence["objectCount"]})
                del prediction, evidence, total, parts, gradients
            require(counters == {"modelForwardsAttempted": 2, "modelForwardsCompleted": 2,
                "autogradGradCallsAttempted": 8, "autogradGradCallsCompleted": 8}, "real counters differ")
            check_program_coverage(reader, c["programBindings"], "terminal", dependency_checks)
            reader.unchanged(); resource_check()
        require(torch.equal(rng, torch.random.get_rng_state()), "caller RNG restoration failed")
        report = {"schemaVersion": "ai-painter-mvp256-dry-v27-cpu-check-v3",
            "status": "cpu_contract_checked_not_execution_qualified", "contract": binding,
            "capabilityVersion": CAPABILITY, "architectureId": ARCHITECTURE,
            "actualModelIdentity": actual_model, "dependencyChecks": dependency_checks, "terminalAssertionsCompleted": True,
            "formalSpecification": c["formalSpecification"], "historicalParentSpecification": c["historicalParentSpecification"],
            "programBindings": c["programBindings"], "verifiedBindings": [
                {"path": p, "sha256": s} for p, s in sorted(reader.observed.items())],
            "modelPlan": MODEL_PLAN, "gradientPlan": GRADIENT_PLAN, "realCallCounts": counters,
            "syntheticEvidence": synthetics, "sampleResults": sample_results,
            "testedTrainSampleCount": 2, "all48GradientProbesCompleted": False,
            "initialState": initial, "finalState": {"model": state_hash(model.state_dict()), "critic": state_hash(critic.state_dict())},
            "boundary": boundary, "elapsedSeconds": time.monotonic()-started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        return write_exclusive(DIRECTORY+"/report.json", report)
    except BaseException as error:
        if expired.is_set():
            error = TimeoutError("CPU 180s watchdog expired")
        failure = {"status": "cpu_check_failed_closed", "contract": binding,
            "errorType": type(error).__name__, "error": str(error), "realCallCounts": counters,
            "partialSampleResults": sample_results, "dependencyChecks": dependency_checks,
            "availableInitialState": locals().get("initial"), "terminalAssertionsCompleted": False,
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

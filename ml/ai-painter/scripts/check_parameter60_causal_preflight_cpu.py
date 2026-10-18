"""CPU preparation only. No renderer forward, CUDA, optimizer or training entry."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import time
import unittest

import torch
from ai_painter.complete_world.ecology_regime_gradient_failure_capture import RuntimeMap

POLICY_PATH = "data/ai-painter/system-governance/ai-painter-parameter60-causal-cpu-policy-v1.json"
POLICY_SHA = "67cec6ef0c5c2d395eb9f7f4e13d9ec301c35366db6597c361379efd4bd7c51f"
TEST_PATHS = (
    "ml/ai-painter/tests/test_parameter60_causal_observation_v1.py",
    "ml/ai-painter/tests/test_parameter60_causal_restore_v1.py",
)


def require(value, message):
    if not value:
        raise ValueError(message)


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON member")
        result[key] = value
    return result


def main():
    started = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--request-sha256", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    mapping = RuntimeMap.current(root)
    request = json.loads(mapping.binding({"path": args.request, "sha256": args.request_sha256}),
                         object_pairs_hook=no_duplicate_keys)
    require(request.get("schemaVersion") == "parameter60-causal-cpu-request-v1", "request schema differs")
    require(request.get("policy") == {"path": POLICY_PATH, "sha256": POLICY_SHA}, "exact CPU policy required")
    policy = json.loads(mapping.binding(request["policy"]), object_pairs_hook=no_duplicate_keys)
    require(policy["status"] == "active_cpu_preflight_only_not_gpu_or_training", "CPU policy inactive")
    deadline = request["deadlineUnixMs"] / 1000
    require(type(request["deadlineUnixMs"]) is int and 0 < deadline - time.time() <= 120,
            "CPU request deadline invalid or expired")

    def resource():
        require(time.time() < deadline, "CPU preparation wall deadline exceeded")
        require(time.monotonic() - started < 120, "CPU preparation local wall exceeded")
        require(not torch.cuda.is_initialized(), "CPU check initialized CUDA")
        mapping.check()

    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "empty CUDA visibility required")
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    programs = request["programBindings"]
    require(type(programs) is list and 1 <= len(programs) <= 256, "bounded program lineage required")
    by_path = {item["path"]: item for item in programs}
    require(len(by_path) == len(programs), "duplicate program path")
    require(set(TEST_PATHS) <= set(by_path), "CPU test files unbound")
    executable = Path(sys.executable).resolve()
    require(str(executable).casefold() == request["interpreter"]["path"].casefold()
            and hashlib.sha256(executable.read_bytes()).hexdigest() == request["interpreter"]["sha256"],
            "Python executable binding differs")
    for binding in programs:
        resource()
        mapping.binding(binding, maximum=1024**2)
    specification = policy["formalSpecification"]
    raw_spec = mapping.binding({key: specification[key] for key in ("path", "sha256")})
    require(("文档版本：`" + specification["version"] + "`").encode() in raw_spec,
            "current specification version differs")

    suite = unittest.TestSuite()
    for index, logical in enumerate(TEST_PATHS):
        spec = importlib.util.spec_from_file_location("parameter60_private_cpu_tests_" + str(index), mapping.path(logical))
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
    log = io.StringIO()
    resource()
    tests = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    resource()
    require(tests.wasSuccessful() and tests.testsRun > 0, "CPU component regression failed: " + log.getvalue())

    from ai_painter.complete_world.parameter60_causal_restore_v1 import prepare_exact_failure_state
    prepared = prepare_exact_failure_state(root, policy, resource=resource)
    resource()
    model, critic = prepared["model"], prepared["critic"]
    require(all(parameter.device.type == "cpu" and parameter.grad is None
                for network in (model, critic) for parameter in network.parameters()),
            "CPU restoration device/gradient boundary differs")
    # Verify imported project code, not merely caller-declared bindings.
    imported = []
    for module in tuple(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if not filename:
            continue
        candidate = Path(filename).resolve()
        try:
            logical = candidate.relative_to(root).as_posix()
        except ValueError:
            continue
        if not logical.startswith(("ml/ai-painter/src/", "ml/ai-painter/scripts/", "ml/ai-painter/tests/")) or not logical.endswith(".py"):
            continue
        require(logical in by_path, "imported project source is not bound: " + logical)
        mapping.binding(by_path[logical], maximum=1024**2)
        imported.append(logical)
    for binding in programs:
        resource()
        mapping.binding(binding, maximum=1024**2)
    resource()
    report = {
        "schemaVersion": "parameter60-causal-cpu-result-v1",
        "status": "cpu_preflight_passed_not_gpu_or_root_cause",
        "runId": request["runId"], "policy": request["policy"],
        "tests": {"run": tests.testsRun, "failed": len(tests.failures),
                  "errors": len(tests.errors), "skipped": len(tests.skipped), "log": log.getvalue()},
        "statePreparation": prepared["receipt"], "importedProjectSources": sorted(set(imported)),
        "elapsedSeconds": time.monotonic() - started,
        "counts": {"fullModelForwards": 0, "fullModelAutogradCalls": 0,
                   "optimizerConstruction": 0, "optimizerUpdates": 0, "cudaCalls": 0},
        "gpuExecutionAllowed": False, "trainingAllowed": False,
        "rootCauseProven": False, "stage4Qualified": False,
        "checkpointWritten": False, "productionRegistryWritten": False,
    }
    require(len(json.dumps(report).encode()) < 8 * 1024**2, "CPU output quota exceeded")
    print(json.dumps(report, allow_nan=False))


if __name__ == "__main__":
    main()

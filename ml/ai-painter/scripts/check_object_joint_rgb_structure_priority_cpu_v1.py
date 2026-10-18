"""Bounded synthetic-only checker; stdout is one JSON record, logs use stderr."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).absolute().parents[3]
POLICY_PATH = "data/ai-painter/system-governance/ai-painter-joint-object-priority-cpu-policy-v1.json"
FILES = {
    "gradientBridge": "ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_cpu_v1.py",
    "tests": "ml/ai-painter/tests/test_object_joint_rgb_structure_priority_update_cpu_v1.py",
    "syntheticCpuCheck": "ml/ai-painter/scripts/check_object_joint_rgb_structure_priority_cpu_v1.py",
}
MAX_JSON_BYTES = 1048576
MAX_WALL_SECONDS = 120
DEFINITIONS = (
    ("data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json", "f5842c5005a60a2c51dd84f9baca1d4ecc751a5fed09e8647f7d96acd4efaefe", "unchanged_loss_definition_not_execution_qualification"),
    ("data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json", "2aa89a112ebc125e9b4bfdea8f7adade22f1d57afb094d1d4b4f1cff36293d82", "original_gradient_gate_and_projection_reference_not_new_anchor_definition"),
    ("ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_cpu_v1.py", "d2d3238be5e3baab321dce0d697d70723cc69c622c361cc8fe215560f8e1e67c", "immutable_original_core_priority_rule"),
    ("ml/ai-painter/src/ai_painter/complete_world/object_support_final_rgb_weight_priority_update_v1.py", "c56e0c52265686144a7133b9c50bf0cdda794ad426e40ccbbdd5b7fc26eb82e5", "real_parent_model_binding_and_input_validation"),
)
PROTOCOL = {
    "componentsInOrder": ["actualTotal", "structuredObjective", "wholeFrameFidelity", "objectCoreRgb", "objectSupportStructure"],
    "generatorAutogradCallsPerSyntheticGraph": 5, "singleSharedSyntheticScalarGraph": True,
    "scalarFormula": "(((structured.float() + whole).float() + core).float() + support)",
    "expectedGradientFormula": "(((g_structured.float() + g_whole.float()).float() + g_core.float()).float() + g_support.float())",
    "atol": 1e-6, "rtol": 1e-5,
    "priorityObjective": "existing_weighted_core_rgb_plus_existing_weighted_support_structure",
    "supportAlreadyWeighted": True, "additionalSupportWeight": False,
    "anchorFormula": "(g_core.float() + g_support.float()).float()",
    "otherGradientFormula": "(g_whole.float() + g_structured.float()).float()",
    "projection": "FP64 q=dot(anchor,anchor), d=dot(anchor,other); q==0 or d>=0 preserves actualTotal bytes and tensor identity; otherwise (actualTotal.float64()-(d/q)*anchor.float64()).float32()",
    "projectionRoundoffMultiplier": 16, "newNearZeroThreshold": False,
    "nonHeadActualGradientIdentityPreserved": True, "nonConflictHeadActualBytesPreserved": True,
    "actualTotalMustNotBeReconstructedFromComponentGradients": True,
    "callerGradientArraysEstablishProvenance": False, "originalScalarAndFiveIndependentVjpsRequiredForProvenance": True,
    "guaranteesIndividualLossImprovement": False, "guaranteesAdamWStepImprovement": False, "guaranteesVisualImprovement": False,
}


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def policy_check():
    policy = json.loads((ROOT / POLICY_PATH).read_text(encoding="utf-8"))
    require(policy["schemaVersion"] == "ai-painter-joint-object-priority-cpu-policy-v1"
        and policy["candidateId"] == "stage4_mvp256_dry_joint_object_priority_cpu_v1"
        and policy["status"] == "registered_inactive_synthetic_cpu_only", "policy identity/status differs")
    formal = {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
        "version": "AI-PAINTER-SPEC-1.80", "sha256": "3dcb487c54206c2512f79890f02fb305ef5cda85dc65e684a95b396e60937fa2"}
    historical = {"path": "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.79-318e7078.txt",
        "sha256": "318e7078b24f56734af92ba6636d63ec89ef27174866cc72ac2f4e934505b30e",
        "purpose": "historical_review_only", "executionAllowed": False}
    require(policy["formalSpecification"] == formal and policy["historicalSpecification"] == historical,
        "formal/historical specification binding differs")
    require(sha(formal["path"]) == formal["sha256"] and sha(historical["path"]) == historical["sha256"],
        "formal/historical specification bytes differ")
    require("文档版本：`AI-PAINTER-SPEC-1.80`" in (ROOT / formal["path"]).read_text(encoding="utf-8"),
        "current specification version differs")
    require(policy["unchangedDefinitions"] == [dict(path=p, sha256=h, role=r) for p, h, r in DEFINITIONS],
        "unchanged definition identities differ")
    for path, expected, _ in DEFINITIONS:
        require(sha(path) == expected, "unchanged definition bytes differ: " + path)
    require(policy["implementation"] == FILES, "implementation paths differ")
    require(policy["gradientProtocol"] == PROTOCOL, "fixed algorithm semantics differ")
    require(policy["model"] == {"capability": "stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1",
        "parameterTensors": 108, "parameterElements": 2242687, "objectHeadParameterTensors": 16,
        "objectHeadParameterElements": 4876, "initializationSeed": 20260929, "freshSourceParameterGraphOnly": True,
        "forwardOrParameterGraphChanged": False, "parentIdentityBuffersRewritten": False, "checkpointLoading": False},
        "model graph/identity semantics differ")
    require(policy["cpuScope"] == {"syntheticOnly": True, "sourceModelParameterConstruction": True,
        "syntheticScalarAutograd": True, "rendererForwards": 0, "criticForwards": 0,
        "realTrainSampleContentRead": False, "validationContentRead": False, "challengeOrRegressionContentRead": False,
        "modelStateBeforeAndAfterMustMatch": True, "rngStateBeforeAndAfterMustMatch": True}, "synthetic CPU scope differs")
    require(policy["resources"] == {"cpuThreads": 2, "cpuAffinityMaximum": 2, "syntheticTestsMaxWallSeconds": 120,
        "maxOutputMiB": 8, "maxJsonBytes": MAX_JSON_BYTES}, "resource limits differ")
    require(policy["boundaries"] == {"cpuOnly": True, **dict.fromkeys(("optimizerConstruction", "weightUpdates",
        "cudaInitialization", "checkpointOrImageOutput", "oldSourceBytesMutation", "productionEntryRouting",
        "currentExecutionRegistryWrite", "realModelDiagnosticGranted", "gpuQualificationGranted", "trainingGranted",
        "visualOrStage4QualificationGranted", "runtimePublicationGranted"), False)}, "execution boundaries differ")
    bindings = {path: sha(path) for path in (*FILES.values(), POLICY_PATH, formal["path"], historical["path"],
        *(p for p, _, _ in DEFINITIONS))}
    return bindings


class BoundedLog(io.StringIO):
    def write(self, value):
        require(self.tell() + len(value) <= MAX_JSON_BYTES // 2, "test log bound exceeded")
        return super().write(value)


class RecordingResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.checks = []
        self.subtests = 0

    def addSuccess(self, test):
        super().addSuccess(test)
        self.checks.append({"name": test.id(), "success": True})

    def addSubTest(self, test, subtest, err):
        super().addSubTest(test, subtest, err)
        self.subtests += 1
        self.checks.append({"name": subtest.id(), "success": err is None,
            **({"error": self._exc_info_to_string(err, test)[-8192:]} if err else {})})

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.checks.append({"name": test.id(), "success": False, "error": self._exc_info_to_string(err, test)[-8192:]})

    def addError(self, test, err):
        super().addError(test, err)
        self.checks.append({"name": test.id(), "success": False, "error": self._exc_info_to_string(err, test)[-8192:]})

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.checks.append({"name": test.id(), "success": False, "error": "skip prohibited: " + reason})


def worker():
    began = time.monotonic()
    before = policy_check()
    spec = importlib.util.spec_from_file_location("joint_priority_synthetic_tests", ROOT / FILES["tests"])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    suite = unittest.defaultTestLoader.loadTestsFromModule(module)
    expected_count = suite.countTestCases()
    log = BoundedLog()
    result = unittest.TextTestRunner(stream=log, verbosity=2, resultclass=RecordingResult).run(suite)
    sys.stderr.write(log.getvalue())
    unchanged = before == policy_check()
    resources = module.RESOURCE_FACTS
    safe = (not any(module.FORBIDDEN_CALLS.values()) and resources.get("cudaInitialized") is False
        and resources.get("cpuThreads", 3) <= 2 and resources.get("cpuInteropThreads", 3) <= 2
        and len(resources.get("cpuAffinity", [0, 1, 2])) <= 2)
    passed = (result.wasSuccessful() and not result.skipped and not result.expectedFailures
        and not result.unexpectedSuccesses and result.testsRun == expected_count and expected_count > 0
        and unchanged and safe and time.monotonic() - began <= MAX_WALL_SECONDS)
    return {"schemaVersion": "joint-object-priority-synthetic-cpu-check-v1", "success": passed,
        "status": "synthetic_cpu_verified" if passed else "synthetic_cpu_failed_closed",
        "candidateId": "stage4_mvp256_dry_joint_object_priority_cpu_v1", "bindings": before,
        "checks": [{"name": "policy_specification_fixed_semantics_and_unchanged_bytes", "success": True},
            *result.checks, {"name": "source_policy_bytes_unchanged_after_suite", "success": unchanged},
            {"name": "global_forbidden_side_effects_and_resources", "success": safe}],
        "tests": {"discovered": expected_count, "run": result.testsRun, "failures": len(result.failures),
            "errors": len(result.errors), "skipped": len(result.skipped), "subtests": result.subtests,
            "expectedFailures": len(result.expectedFailures), "unexpectedSuccesses": len(result.unexpectedSuccesses)},
        "forbiddenSideEffectCalls": module.FORBIDDEN_CALLS, "resources": resources,
        "elapsedSeconds": time.monotonic() - began, "trainingAllowed": False,
        "realModelDiagnosticGranted": False, "gpuQualificationGranted": False,
        "stage4Qualified": False, "runtimePublicationGranted": False}


def main():
    began = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if args.worker:
            value = worker()
        else:
            policy_check()
            env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "CUDA_VISIBLE_DEVICES": "",
                "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2"}
            process = subprocess.run([sys.executable, "-B", str(Path(__file__).absolute()), "--worker"],
                cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                timeout=max(.001, MAX_WALL_SECONDS - (time.monotonic() - began)),
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(len(process.stdout) <= MAX_JSON_BYTES and len(process.stderr) <= MAX_JSON_BYTES,
                "worker output bound exceeded")
            sys.stderr.buffer.write(process.stderr)
            value = json.loads(process.stdout)
            require(process.returncode == 0 or value.get("success") is False, "worker exit/result conflict")
            value["totalElapsedSeconds"] = time.monotonic() - began
        value["recordedAtUtc"] = datetime.now(timezone.utc).isoformat()
    except BaseException as error:
        value = {"schemaVersion": "joint-object-priority-synthetic-cpu-check-v1", "success": False,
            "status": "synthetic_cpu_failed_closed", "checks": [{"name": "checker_execution", "success": False,
                "error": type(error).__name__ + ": " + str(error)[:8192]}],
            "elapsedSeconds": time.monotonic() - began, "trainingAllowed": False,
            "gpuQualificationGranted": False, "stage4Qualified": False}
        traceback.print_exc(limit=8, file=sys.stderr)
    encoded = json.dumps(value, allow_nan=False, ensure_ascii=False).encode("utf-8")
    if len(encoded) + 1 > MAX_JSON_BYTES:
        encoded = b'{"success":false,"status":"synthetic_cpu_failed_closed","error":"JSON output bound exceeded"}'
        value["success"] = False
    sys.stdout.buffer.write(encoded + b"\n")
    return 0 if value["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

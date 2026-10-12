"""V28 single-use managed worker; no GPU or optimizer is created on import."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import torch

ROOT = Path(__file__).resolve().parents[3]
for entry in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

import painter_stage4_v24_dry_single_world_checkpoint_worker as base  # noqa: E402
AGGREGATION_RULE = "strict_deterministic_index_add_scoped_to_object_assembly_v1"
def profile():
    import painter_stage4_appearance_regime_probe as candidate_profile
    return candidate_profile

def sample_forward(model, sample, return_evidence=False):
    return profile().sample_forward(model, sample, return_evidence=return_evidence)

def perform_pair(*args, **kwargs):
    return profile().perform_pair(*args, **kwargs)

CAPABILITY = "stage4_mvp256_dry_appearance_regime_bias_precision_v1"
POLICY_SCHEMA = "stage4-mvp256-dry-appearance-regime-gradient-failure-capture-execution-policy-v1"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-execution-policy-v1.json"
CPU_REPORT_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/numeric/report.json"
PACKAGE_SCHEMA = "ai-painter-stage4-mvp256-dry-v28-execution-package-v1"
GPU_SCHEMA = "ai-painter-stage4-mvp256-dry-v28-zero-update-gpu-gate-v1"
TICKET_SCHEMA = "ai-painter-stage4-mvp256-dry-v28-training-ticket-v1"
LOCK_SCHEMA = "ai-painter-stage4-mvp256-dry-v28-managed-lock-v1"
LAUNCH_SCHEMA = "ai-painter-stage4-mvp256-dry-v28-launch-identity-v1"
IDENTITY = {
    "capability": CAPABILITY,
    "checkpointSchema": "ai-painter-stage4-mvp256-dry-v28-checkpoint-v1",
    "terminalSchema": "ai-painter-stage4-mvp256-dry-v28-worker-terminal-v1",
    "progressSchema": "ai-painter-stage4-mvp256-dry-v28-progress-v1",
}
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions"
PROGRAM_PATHS = {'worker': 'ml/ai-painter/scripts/painter_stage4_appearance_regime_gradient_failure_capture_worker.py', 'gpuQualifier': 'ml/ai-painter/scripts/qualify_stage4_appearance_regime_gradient_failure_capture_gpu.py', 'supervisor': 'scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs', 'model': 'ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_bias_precision.py', 'probe': 'ml/ai-painter/scripts/painter_stage4_appearance_regime_probe.py'}

PROGRAM_PATHS.update(capture="ml/ai-painter/src/ai_painter/complete_world/appearance_regime_gradient_failure_capture.py",
    cpuReview="ml/ai-painter/scripts/review_stage4_appearance_regime_gradient_failure_capture_cpu.py")

def require(condition, message):
    if not condition:
        raise ValueError(message)


def fresh_networks(order):
    return profile().fresh_networks(order)


ISOLATED_READONLY_PATH = "data/ai-painter/system-governance/isolated-cpu-readonly-inputs.json"


def _isolated_root(root):
    path = Path(root).resolve().as_posix()
    return "/gradient-failure-capture-t-q4-37/lifecycle/acceptance-" in path and path.endswith("/isolated-project")


class _IsolatedReadOnlyReader(base.v24.core.cpu.BoundReader):
    """Explicit bound source reads for a CPU fixture; all writes stay local."""
    def __init__(self, root):
        super().__init__(Path(root))
        require(_isolated_root(root), "read-only fixture reader outside task evidence")
        raw, self.readonly_manifest_binding = super().snapshot(ISOLATED_READONLY_PATH)
        manifest = json.loads(raw)
        require(manifest.get("schemaVersion") == "ai-painter-v28-isolated-readonly-inputs-v1"
                and manifest.get("sourceRoot") == "F:/ai-pet-world"
                and manifest.get("capabilityVersion") == CAPABILITY,
                "isolated read-only source manifest differs")
        self.source_root = Path(manifest["sourceRoot"])
        self.readonly = {}
        for entry in manifest["inputs"]:
            item = base._binding(entry["binding"], "isolated read-only input")
            require(item["path"] not in self.readonly
                    and isinstance(entry.get("resolvedPath"), str), "duplicate read-only input")
            self.readonly[item["path"]] = entry

    def read(self, binding):
        entry = self.readonly.get(binding.get("path"))
        if entry is None:
            return super().read(binding)
        item = base._binding({"path": binding.get("path"), "sha256": binding.get("sha256")}, "isolated source read")
        require(item == entry["binding"], "read outside immutable source whitelist")
        logical = item["path"]
        require(logical and "\\" not in logical and ":" not in logical
                and not logical.startswith("/") and all(part not in ("", ".", "..")
                    for part in logical.split("/")), "unsafe read-only source path")
        target = self.source_root / logical
        resolved = target.resolve()
        require(resolved.as_posix() == entry["resolvedPath"], "read-only source resolution changed")
        source_base = self.source_root.resolve()
        runtime_base = (self.source_root / ".runtime").resolve()
        require(resolved.is_relative_to(source_base)
                or (logical.startswith(".runtime/") and resolved.is_relative_to(runtime_base)),
                "read-only source escaped registered roots")
        raw = target.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == item["sha256"], "read-only source SHA changed: " + logical)
        self.observed[logical] = item["sha256"]
        return raw

    def snapshot(self, logical):
        if logical in self.readonly:
            item = self.readonly[logical]["binding"]
            return self.read(item), dict(item)
        return super().snapshot(logical)


def _bound_reader(root):
    if _isolated_root(root) and (Path(root) / ISOLATED_READONLY_PATH).is_file():
        return _IsolatedReadOnlyReader(root)
    return base.v24.core.cpu.BoundReader(Path(root))


ARCHITECTURE = "fresh_v23_four_heads_zero_season_branch_rgb_bias_fp64_device_v1"
SINGLE_CHANGE = {'operation': 'four_independent_rgb_heads_zero_source_bound_season_branch_fp64_bias_device_v1', 'trainingAndInference': True, 'dropoutEnabled': False, 'fullV23ContextPreserved': True, 'groupCount': 5, 'modelParameterTensorCount': 107, 'modelParameterElementCount': 2240671, 'objectParameterTensorCount': 16, 'objectParameterElementCount': 4876, 'seasonalParameterTensorCount': 1, 'seasonalParameterElementCount': 1152}

FROZEN_REGISTRY_INPUT = {'observed': {'path': '.runtime/ai-painter/current-execution-registry/current.json', 'sha256': '1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa'}, 'transaction': {'path': '.runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/transaction.json', 'sha256': '5b97e75842d4d56f0d60c25b2eeb95a54891a0f0058556d187323c1522fa1482'}, 'snapshot': {'path': '.runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/current.staged.json', 'sha256': '1dab2b28f25a2e087498f10627dfa3352ec2f18edb87bf402b59634d3df8b5aa'}, 'event': {'path': '.runtime/ai-painter/current-execution-registry/transactions/current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c/registry-event.staged.jsonl', 'sha256': '5eff2a54dcab0893f299c57dbce24bebbe652bcbf8447a775ed048754fab0983'}, 'transactionId': 'current-execution-registry-advance-20261006044713-ef8e77ed-7858-4124-986b-496edef13a6c', 'registryRevision': 371}

HISTORICAL_DOCUMENTS = {'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md': {'path': '.runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/formal-at-integration-1.44.bin', 'sha256': '6dcb84f2503445eca030958a469794dcb4823e83a3591de0b5d8a75ef5cf078c'}, 'docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md': {'path': '.runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/execution-guide-at-integration.bin', 'sha256': 'd3342653a14a95c18b81b228e07cdd666e7e27eb72d00c02e53e838a48740c5d'}}

def read_numeric_input(reader, binding):
    snapshot = HISTORICAL_DOCUMENTS.get(binding["path"])
    if snapshot is not None:
        require(binding["sha256"] == snapshot["sha256"], "unknown historical document observation")
        return reader.read(snapshot)
    if binding["path"] != FROZEN_REGISTRY_INPUT["observed"]["path"]:
        return reader.read(binding)
    frozen = FROZEN_REGISTRY_INPUT
    require(binding == frozen["observed"], "unknown historical registry observation")
    transaction, snapshot, event = [reader.json(frozen[key]) for key in ("transaction", "snapshot", "event")]
    require(transaction.get("status") == "committed"
            and transaction.get("currentStaged") == frozen["snapshot"]
            and transaction.get("registryEventStaged") == frozen["event"]
            and transaction.get("currentSha256") == event.get("currentSha256") == frozen["observed"]["sha256"]
            and all(record.get("transactionId") == frozen["transactionId"]
                and record.get("registryRevision") == record.get("eventSequence") == frozen["registryRevision"]
                for record in (transaction, snapshot, event))
            and snapshot.get("activeExecution") is None
            and datetime.fromisoformat(transaction["committedAtUtc"].replace("Z", "+00:00"))
                >= datetime.fromisoformat(transaction["recordedAtUtc"].replace("Z", "+00:00")),
            "historical registry immutable commit differs")
    return reader.read(frozen["snapshot"])

def read_model_cpu_proof(reader, binding):
    require(binding["path"] == CPU_REPORT_PATH, "candidate CPU evidence path differs")
    report = reader.json(binding)
    require(report.get("status") == "cpu_execution_bridge_checked_not_gpu_qualified"
            and report.get("capabilityVersion") == CAPABILITY
            and report.get("architecture") == ARCHITECTURE
            and report.get("synthetic") is False
            and report.get("callCounts") == {
                "modelForwardsAttempted": 4, "modelForwardsCompleted": 4,
                "generatorGradCallsAttempted": 16, "generatorGradCallsCompleted": 16,
                "discriminatorGradCallsAttempted": 4, "discriminatorGradCallsCompleted": 4}
            and report.get("optimizerSteps") == 0
            and report.get("gpuInitialized") is False
            and report.get("terminalAssertionsCompleted") is True
            and report.get("initialState") == report.get("finalState")
            and report.get("actualGraph", {}).get("tensors") == 107
            and report.get("actualGraph", {}).get("elements") == 2240671
            and report.get("actualGraph", {}).get("seasonalElements") == 1152
            and len(report.get("actualGraph", {}).get("parameters", [])) == 107
            and report.get("parameterInitialization", {}).get("originalParameterDigest")
                == report.get("parameterInitialization", {}).get("successorParameterDigest")
            and bool(report.get("inputBindings")),
            "current candidate real CPU proof differs; synthetic evidence grants no qualification")
    for binding in report["inputBindings"]:
        read_numeric_input(reader, base._binding(binding, "CPU input"))
    return report


def validate_program_bindings(reader, bindings):
    import re
    require(isinstance(bindings, dict) and bindings, "program bindings required")
    for role, item in bindings.items():
        require(re.fullmatch(r"[A-Za-z0-9._-]{1,80}", role) is not None
                and role not in ("__proto__", "prototype", "constructor"), "invalid registry program role")
        item = base._binding(item, "current source")
        logical = item["path"]
        require(logical and not logical.startswith("/") and ":" not in logical
                and "\\" not in logical
                and all(p not in ("", ".", "..") for p in logical.split("/")),
                "noncanonical program path")
        if role.startswith("dependency_"):
            require(role == "dependency_" + hashlib.sha256(logical.encode("utf8")).hexdigest(),
                    "dependency role/path identity differs")
        reader.read(item)


CAPTURE_CPU_PATH = '.runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/numeric/source-freeze.json'

def read_capture_cpu_proof(reader, binding, programs):
    require(binding["path"] == CAPTURE_CPU_PATH, "capture CPU proof path differs")
    proof = reader.json(binding)
    require(proof.get("task") == "T-Q4-37-N"
        and proof.get("status") == "source_frozen_for_independent_controller_review"
        and proof["syntheticTests"]["passed"] == proof["syntheticTests"]["distinctTests"] > 0
        and proof["syntheticTests"]["skipped"] == 0, "capture CPU test proof differs")
    for role in ("capture", "captureTests"):
        rows = [row for row in proof["sources"] if row["path"] == programs[role]["path"]]
        require(len(rows) == 1 and {key: rows[0][key] for key in ("path","sha256")} == programs[role], "capture source freeze differs")
        reader.read(programs[role])
    log = proof["syntheticTests"]["logs"][-1]
    require(proof.get("workspace") == "F:/ai-pet-world", "capture source workspace differs")
    logical = Path(log["path"]).relative_to(Path("F:/ai-pet-world")).as_posix()
    raw = reader.read({"path": logical,"sha256":log["sha256"]}).decode("utf8")
    import re
    require("Ran " + str(proof["syntheticTests"]["passed"]) + " tests" in raw
        and re.search(r"^OK\s*$",raw,re.M) is not None, "capture actual CPU log differs")
    return proof

def _source_candidate(reader, policy, *, cpu_admission_only=False):
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == CAPABILITY
            and policy.get("executionVersion") == "appearance_regime_gradient_failure_capture_v1"
            and policy.get("aggregationRule") == AGGREGATION_RULE
            and policy.get("historicalQualificationMayBeReused") is False
            and policy.get("historicalCheckpointMayInitialize") is False,
            "V28 execution boundary differs")
    require(policy.get("failureCapture") == {"maxCaptureBytes": 67108864, "maxCombinedBytes": 134217728,
            "terminalReserveBytes": 1048576, "callAfterOriginalPairFailureOnly": True}, "capture resource boundary differs")
    require(policy.get("historicalDocuments") == HISTORICAL_DOCUMENTS, "historical CPU document mapping differs")
    require(policy.get("captureProgram") == policy.get("programBindings", {}).get("capture"), "capture source identity differs")
    read_capture_cpu_proof(reader, base._binding(policy.get("captureCpuEvidence"), "capture CPU evidence"), policy["programBindings"])
    parent_binding = base._binding(policy.get("predecessorCandidate"), "V24 source candidate")
    require(parent_binding["path"] == "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json",
            "V28 original data candidate differs")
    parent = reader.json(parent_binding)
    base.validate_candidate_contract(parent)
    require(policy.get("executionCeiling") == base.RESOURCE_CEILING
            and policy.get("checkpointSelection") == parent["checkpointSelection"]
            and policy.get("dataUse") == parent["dataUse"]
            and policy.get("scope") == parent["scope"]
            and policy.get("singleChange") == SINGLE_CHANGE
            and policy.get("activation") == {
                "cpuAcceptanceCompleted": True, "gpuQualificationAllowed": True,
                "trainingAllowed": False, "formalStage4QualificationAllowed": False,
                "runtimePublicationAllowed": False}, "V28 frozen contract differs")
    cpu_binding = base._binding(policy.get("modelCpuEvidence"), "V28 model CPU")
    report = read_model_cpu_proof(reader, cpu_binding)
    numeric_claim_binding = base._binding(policy.get("modelCpuClaim"), "numeric CPU single claim")
    require(numeric_claim_binding["path"] == str(Path(CPU_REPORT_PATH).parent / "claim.json").replace("\\", "/"),
            "numeric CPU claim path differs")
    numeric_claim = reader.json(numeric_claim_binding)
    require(numeric_claim.get("task") == "T-Q4-36-N" and numeric_claim.get("synthetic") is False
            and numeric_claim.get("attempt") == 1 and numeric_claim.get("automaticRetries") == 0
            and numeric_claim.get("binding") == report.get("binding"), "numeric CPU claim differs")
    reader.read(base._binding(report.get("binding"), "numeric source freeze"))
    for binding in HISTORICAL_DOCUMENTS.values(): reader.read(binding)
    acceptance = reader.json(base._binding(policy.get("cpuAcceptance"), "V28 lifecycle CPU"))
    final_scope = "synthetic_cpu_tests_and_real_isolated_registry_package_admission_not_gpu_qualification"
    if acceptance.get("scope") != final_scope:
        root_path = Path(reader.root).resolve().as_posix()
        require(cpu_admission_only and acceptance.get("scope") == "synthetic_cpu_tests_prerequisite_not_managed_admission"
                and "/gradient-failure-capture-t-q4-37/lifecycle/acceptance-" in root_path
                and root_path.endswith("/isolated-project"), "incomplete lifecycle admission evidence")
        manifest_binding = base._binding(policy.get("cpuAdmissionReadOnlyInputs"), "CPU fixture read-only manifest")
        require(manifest_binding.get("path") == ISOLATED_READONLY_PATH
                and manifest_binding == getattr(reader, "readonly_manifest_binding", None),
                "unbound isolated read-only source whitelist")
        reader.read(manifest_binding)
        expected = {binding["path"]: binding for binding in report["inputBindings"]
                    if not binding["path"].endswith((".py", ".mjs", ".md"))
                    and binding["path"] != FROZEN_REGISTRY_INPUT["observed"]["path"]}
        require({path: entry["binding"] for path, entry in reader.readonly.items()} == expected,
                "isolated whitelist differs from real numeric proof")
    else:
        isolated = acceptance.get("isolatedAdmission", {}).get("admission", {})
        require(isolated.get("status") == "managed_package_admission_passed_gpu_not_initialized"
                and isolated.get("capabilityVersion") == CAPABILITY
                and isolated.get("gpuInitialized") is False
                and isolated.get("qualificationClaimCreated") is False
                and acceptance.get("productionRegistryUnchanged") is True
                and acceptance.get("productionPolicyWritten") is False, "isolated CPU admission receipt differs")
    validate_program_bindings(reader, acceptance["programBindings"])
    require(acceptance.get("schemaVersion") == "ai-painter-mvp256-dry-v28-lifecycle-cpu-acceptance-v1"
            and acceptance.get("status") == "v28_lifecycle_cpu_acceptance_passed"
            and acceptance.get("capabilityVersion") == CAPABILITY
            and acceptance.get("modelCpuEvidence") == cpu_binding
            and acceptance.get("formalSpecification") == policy.get("formalSpecification")
            and acceptance.get("executionGuide") == policy.get("executionGuide")
            and acceptance.get("optimizerSteps") == 0
            and acceptance.get("syntheticOptimizerSteps") == {"generator": 0, "discriminator": 0}
            and acceptance.get("gpuInitialized") is False
            and acceptance.get("trainingStarted") is False
            and acceptance.get("failedTests") == acceptance.get("skippedTests") == 0
            and acceptance.get("passedTests", 0) > 0
            and "candidateContract" not in acceptance, "V28 lifecycle CPU proof differs")
    cpu_claim = reader.json(base._binding(acceptance.get("claim"), "lifecycle CPU claim"))
    require(cpu_claim.get("schemaVersion") == "ai-painter-mvp256-dry-v28-lifecycle-cpu-claim-v1"
            and cpu_claim.get("capabilityVersion") == CAPABILITY
            and cpu_claim.get("attempt") == 1 and cpu_claim.get("automaticRetries") == 0
            and cpu_claim.get("programBindings") == acceptance["programBindings"]
            and cpu_claim.get("modelCpuEvidence") == cpu_binding
            and cpu_claim.get("formalSpecification") == policy["formalSpecification"]
            and cpu_claim.get("executionGuide") == policy["executionGuide"],
            "V28 lifecycle CPU claim differs")
    outputs = acceptance["testOutputs"]
    py_output = reader.json(base._binding(outputs["python"], "CPU Python test output"))
    js_output = reader.json(base._binding(outputs["node"], "CPU Node test output"))
    py_result = json.loads(py_output["stdout"].strip())
    import re
    def tap_count(name):
        match = re.search(r"^# " + name + r" (\d+)\s*$", js_output["stdout"], re.M)
        require(match is not None, "missing actual TAP count: " + name)
        return int(match.group(1))
    require(py_result["failures"] == py_result["errors"] == py_result["skipped"] == 0
            and py_result["gpuInitialized"] is False
            and py_result["syntheticOptimizerSteps"] == {"generator": 0, "discriminator": 0}
            and tap_count("fail") == tap_count("cancelled") == tap_count("skipped") == 0
            and tap_count("tests") == tap_count("pass") > 0
            and py_result["testsRun"] + tap_count("pass") == acceptance["passedTests"],
            "V28 actual test outputs differ")
    for item in acceptance["programBindings"].values():
        reader.read(base._binding(item, "V28 CPU-tested lifecycle source"))
    require(policy.get("programBindings") == acceptance["programBindings"],
            "V28 policy/source closure differs")
    for role, path in PROGRAM_PATHS.items():
        require(acceptance["programBindings"].get(role, {}).get("path") == path,
                "missing tested V28 program: " + role)
    spec = reader.read(base._binding(policy.get("formalSpecification"), "V28 specification"))
    require(b"AI-PAINTER-SPEC-1.45" in spec, "V28 current specification differs")
    reader.read(base._binding(policy.get("executionGuide"), "V28 guide"))
    for item in parent["frozenBindings"].values():
        reader.read(item)
    for item in policy["baseline"].values():
        reader.read(item)
    require(policy.get("numericSuccessGate") == {
        "maximumValidationRgbMae": 0.06140733743086457,
        "minimumExclusiveWorstApplicableObjectCorrelation": -0.08459185063838959,
        "preselectedSampleId": parent["scope"]["subjectSampleId"],
        "allOriginalReviewsRequired": True}, "V28 frozen numeric success gate differs")
    require(all(k not in policy for k in ("executionPackage", "gpuQualification",
            "trainingTicket", "managedLock", "launchIdentity")), "policy references descendants")
    return report, parent

def authenticate_training_gate(ticket_binding, *, root=ROOT, check_process=True):
    """Rehash V28-specific acyclic package, GPU, lock, launch, and ticket."""
    reader = _bound_reader(root)
    ticket_binding = base._binding(ticket_binding, "V28 ticket")
    ticket = reader.json(ticket_binding)
    require(ticket.get("executionVersion") == "appearance_regime_gradient_failure_capture_v1", "diagnostic ticket identity differs")
    require(ticket.get("schemaVersion") == TICKET_SCHEMA
            and ticket.get("status") == "issued_single_use"
            and ticket.get("capabilityVersion") == CAPABILITY
            and ticket.get("trainingAllowed") is True
            and ticket.get("automaticRetries") == 0
            and ticket.get("formalStage4QualificationAllowed") is False
            and ticket.get("runtimePublicationAllowed") is False,
            "V28 single-use training ticket required")
    package_binding = base._binding(ticket.get("executionPackage"), "V28 package")
    package = reader.json(package_binding)
    require(package.get("executionVersion") == "appearance_regime_gradient_failure_capture_v1", "diagnostic base identity differs")
    require(package.get("schemaVersion") == PACKAGE_SCHEMA
            and package.get("status") == "issued_single_attempt"
            and package.get("capabilityVersion") == CAPABILITY
            and package.get("trainingIntent") == "bounded_once"
            and package.get("trainingAllowed") is False
            and package.get("resourceBudget") == base.RESOURCE_CEILING
            and package.get("trainingPlan") == {
                "epochs": 48, "trainRows": 48, "validationRows": 8,
                "eligibleCheckpointEpochs": [24, 36, 48],
                "generatorOptimizerSteps": 2304,
                "discriminatorOptimizerSteps": 2304,
                "historicalCheckpointLoaded": False,
            }
            and package.get("managedExecutionRequired")
            == "javascript_managed_orchestration"
            and package.get("formalStage4QualificationAllowed") is False
            and package.get("runtimePublicationAllowed") is False,
            "V28 managed base package differs")
    run_id, package_id = package.get("runId"), package.get("packageId")
    require(all(isinstance(value, str) and 8 <= len(value) <= 128
                and all(char.isalnum() or char in "_-" for char in value)
                for value in (run_id, package_id)), "invalid V28 run identity")
    programs = package.get("programBindings")
    require(isinstance(programs, dict)
            and all(programs.get(role, {}).get("path") == expected
                    for role, expected in PROGRAM_PATHS.items()),
            "V28 program roles differ")
    for binding in programs.values():
        reader.read(base._binding(binding, "V28 program"))
    policy_binding = base._binding(package.get("candidateContract"), "V28 policy")
    require(policy_binding["path"] == POLICY_PATH,
            "V28 policy path differs")
    policy = reader.json(policy_binding)
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == CAPABILITY,
            "V28 execution policy differs")
    proposal, parent = _source_candidate(reader, policy)
    acceptance = reader.json(base._binding(policy["cpuAcceptance"], "V28 lifecycle evidence"))
    require(all(acceptance["programBindings"].get(role) == binding
                for role, binding in programs.items()),
            "V28 execution program differs from CPU-tested program")
    require(package.get("sourceDataCandidate") == policy["predecessorCandidate"]
            and package.get("cpuAcceptance") == policy["cpuAcceptance"]
            and package.get("modelCpuEvidence") == policy["modelCpuEvidence"]
            and package.get("programBindings") == policy["programBindings"]
            and not any(k in package for k in ("gpuQualification", "trainingTicket", "managedLock", "launchIdentity")),
            "V28 package predecessor/CPU bindings differ")
    for binding in parent["frozenBindings"].values():
        reader.read(binding)
    require(package.get("datasetManifest") == parent["frozenBindings"]["datasetManifest"]
            and package.get("trainSplit") == parent["frozenBindings"]["trainSplit"]
            and package.get("validationSplit") == parent["frozenBindings"]["validationSplit"]
            and package.get("execution", {}).get("reviewPlan") == {
                "boundedDryReviewAllowed": True,
                "formalStage4QualificationAllowed": False,
                "runtimePublicationAllowed": False,
                "numericThresholdContract": parent["frozenBindings"]["numericReview"],
                "detailThresholdContract": parent["frozenBindings"]["detailReview"],
            }, "V28 inherited data/review bindings differ")
    specification = reader.read(base._binding(policy.get("formalSpecification"), "V28 specification"))
    require(b"AI-PAINTER-SPEC-1.45" in specification, "V28 specification version differs")

    output_root = package.get("outputRoot")
    require(isinstance(output_root, str)
            and output_root.startswith(OUTPUT_PARENT + "/")
            and all(part not in ("", ".", "..") for part in output_root.split("/"))
            and "\\" not in output_root
            and package_binding["path"] == output_root + "/execution-package.json"
            and ticket_binding["path"] == output_root + "/training-ticket.json",
            "isolated V28 output root required")
    require(ticket.get("runId") == run_id and ticket.get("packageId") == package_id
            and ticket.get("consumptionClaimPath")
            == output_root + "/training-ticket-consumed.json",
            "V28 ticket identity differs")
    gpu_binding = base._binding(ticket.get("gpuQualification"), "V28 GPU gate")
    require(gpu_binding["path"] == output_root + "/zero-update-gpu-qualification.json",
            "V28 GPU gate path differs")
    gpu = reader.json(gpu_binding)
    require(gpu.get("executionVersion") == "appearance_regime_gradient_failure_capture_v1", "diagnostic GPU identity differs")
    train_ids = reader.json(parent["frozenBindings"]["trainSplit"])["sampleIds"]
    cases = gpu.get("cases")
    require(gpu.get("schemaVersion") == GPU_SCHEMA
            and gpu.get("status") == "current_candidate_zero_update_gpu_qualification_passed"
            and gpu.get("capabilityVersion") == CAPABILITY
            and gpu.get("runId") == run_id and gpu.get("packageId") == package_id
            and gpu.get("executionPackage") == package_binding
            and gpu.get("candidateContract") == policy_binding
            and gpu.get("gpuInitialized") is True
            and gpu.get("optimizerCreated") is False
            and gpu.get("optimizerSteps") == {"generator": 0, "discriminator": 0}
            and gpu.get("checkpointLoaded") is False
            and gpu.get("checkpointWritten") is False
            and gpu.get("weightsModified") is False
            and gpu.get("historicalV24QualificationReused") is False
            and gpu.get("trainingModeDeterminismObserved") is True
            and gpu.get("aggregationRule") == AGGREGATION_RULE
            and gpu.get("caseCount") == 48
            and gpu.get("generatorAutogradGradCalls") == 192
            and gpu.get("discriminatorAutogradGradCalls") == 48
            and gpu.get("finalStateSha256") == gpu.get("initialStateSha256")
            and isinstance(cases, list) and len(cases) == 48
            and [row.get("case", {}).get("sampleId") for row in cases] == train_ids
            and all(row.get("passed") is True
                    and row.get("trainingModeRepeatBytesEqual") is True
                    and row.get("objectInstancesUnchanged") is True
                    and row.get("contextIsolationRule") == "full_v23_terrain_context_private_global_xy_zero_v1"
                    and row.get("aggregationRule") == AGGREGATION_RULE
                    and row.get("autogradGradCalls") == 4
                    and row.get("discriminatorAutogradGradCalls") == 1
                    and row.get("optimizerCreated") is False
                    and row.get("optimizerSteps") == {"generator": 0, "discriminator": 0}
                    and row.get("sourceTensorsUnchanged") is True
                    and row.get("rngRestored") is True
                    and row.get("gradFieldsCleared") is True
                    and row.get("initialStateSha256") == gpu["initialStateSha256"]
                    and row.get("finalStateSha256") == gpu["initialStateSha256"]
                    and row.get("case", {}).get("split") == "train"
                    and row.get("case", {}).get("trainOrdinal") == ordinal
                    for ordinal, row in enumerate(cases))
            and gpu.get("trainingAllowedByThisArtifact") is False,
            "V28 current-candidate GPU gate differs")
    lock_binding = base._binding(ticket.get("managedLock"), "V28 managed lock")
    launch_binding = base._binding(ticket.get("launchIdentity"), "V28 launch")
    require(lock_binding["path"] == output_root + "/managed-training-lock.json"
            and launch_binding["path"]
                == output_root + "/supervisor-launch-identity.json",
            "V28 lock/launch paths differ")
    lock, launch = reader.json(lock_binding), reader.json(launch_binding)
    require(lock.get("schemaVersion") == LOCK_SCHEMA
            and lock.get("status") == "active_bound_single_attempt"
            and lock.get("runId") == run_id and lock.get("packageId") == package_id
            and lock.get("executionPackage") == package_binding
            and lock.get("resourceBudget") == base.RESOURCE_CEILING,
            "V28 managed lock differs")
    require(launch.get("schemaVersion") == LAUNCH_SCHEMA
            and launch.get("status") == "managed_supervisor_identity_verified"
            and launch.get("runId") == run_id and launch.get("packageId") == package_id
            and launch.get("executionPackage") == package_binding
            and launch.get("managedLock") == lock_binding
            and type(launch.get("processId")) is int and launch["processId"] > 0
            and isinstance(launch.get("processStartIdentity"), str)
            and launch["processStartIdentity"].startswith(str(launch["processId"]) + ":"),
            "V28 supervisor launch differs")
    process_chain = None
    if check_process:
        pid = launch["processId"]
        identity = launch["processStartIdentity"]
        registry_path = Path(root) / ".runtime/ai-painter/current-execution-registry/current.json"
        current = json.loads(registry_path.read_bytes())
        active = current.get("activeExecution")
        require(isinstance(active, dict)
                and active.get("runId") == run_id
                and active.get("packageId") == package_id
                and active.get("capabilityVersion") == CAPABILITY
                and active.get("processId") == pid
                and active.get("processStartIdentity") == identity
                and active.get("programLineage") == programs,
                "V28 current managed execution differs")
        heartbeat_path = base.v24.core.cpu.project_file(
            root, active.get("heartbeat", {}).get("path", ""))
        heartbeat = json.loads(heartbeat_path.read_bytes())
        require(heartbeat.get("runId") == run_id
                and heartbeat.get("processId") == pid
                and heartbeat.get("processStartIdentity") == identity
                and time.time() < datetime.fromisoformat(
                    heartbeat["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp()
                    + 120,
                "V28 managed heartbeat stale or changed")
        active_lock = reader.json(base._binding(active.get("lock"),
                                                "V28 current active lock"))
        require(active_lock.get("runId") == run_id
                and active_lock.get("packageId") == package_id
                and active_lock.get("processId") == pid
                and active_lock.get("processStartIdentity") == identity,
                "V28 current active lock differs")
        require(base.managed_worker.process_identity(pid) == identity,
                "V28 supervisor exited or PID reused")
        rows = base.managed_worker.read_process_chain(os.getpid(), pid)
        base.managed_worker.validate_process_chain(rows, pid, identity)
        require(rows == base.managed_worker.read_process_chain(os.getpid(), pid),
                "V28 process chain changed during authentication")
        process_chain = tuple(tuple(sorted(row.items())) for row in rows)
    reader.unchanged()
    sources = tuple({"path": path, "sha256": digest}
                    for path, digest in reader.observed.items())
    return base._AuthenticatedTrainingGate(
        package_binding, policy_binding, run_id, package_id, output_root,
        ticket_binding, ticket["consumptionClaimPath"], process_chain,
        gpu["initialStateSha256"], sources)



import painter_stage4_appearance_regime_checkpoint_worker as frozen
import random
import math
import traceback
IDENTITY = frozen.IDENTITY
OBJECT_CHANNELS = frozen.OBJECT_CHANNELS
serialize_checkpoint = frozen.serialize_checkpoint
reload_checkpoint_exact = frozen.reload_checkpoint_exact

fresh_networks = frozen.fresh_networks
attach_regime = frozen.attach_regime
load_bound_train_and_validation = frozen.load_bound_train_and_validation
validation_observation = frozen.validation_observation
bounded_training_loop = frozen.bounded_training_loop
MAX_CAPTURE_BYTES = 64 * 1024**2
TOTAL_BYTES = 128 * 1024**2
TERMINAL_RESERVE = 1024**2

def remaining_capture_bytes(directory):
    directory = Path(directory)
    return max(0, min(MAX_CAPTURE_BYTES, TOTAL_BYTES - TERMINAL_RESERVE -
        sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())))

def make_failure_capture_pair_runner(*, progress, output_root, execution_binding,
                                     source_bindings, diagnostic, deadline,
                                     capture=None, pair=None, before_capture=None):
    if pair is None: pair = frozen.perform_pair
    if capture is None:
        from ai_painter.complete_world.appearance_regime_gradient_failure_capture import capture_gradient_failure
        capture = capture_gradient_failure
    state = {"epoch": None, "position": 0, "stopped": False}
    def runner(model, critic, sample, order, generator_optimizer, critic_optimizer,
               counts, ledger_row, resource, forward):
        require(not state["stopped"], "failed pair cannot be retried")
        epoch = progress.get("actualEpoch")
        require(type(epoch) is int and 1 <= epoch <= 48, "actual epoch unavailable")
        if epoch != state["epoch"]: state.update(epoch=epoch, position=0)
        state["position"] += 1
        require(state["position"] <= 48, "actual train position exceeds epoch")
        try:
            return pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
                        counts, ledger_row, resource, forward)
        except BaseException as error:
            state["stopped"] = True
            diagnostic.update(originalErrorType=type(error).__name__, originalError=str(error),
                epoch=epoch, trainPosition=state["position"], sampleId=sample.get("sampleId"),
                optimizerSteps=dict(counts), failureCaptureTriggered=True)
            if before_capture is not None:
                try: before_capture(diagnostic)
                except BaseException as secondary:
                    diagnostic["captureStartPublicationError"] = str(secondary)
            try:
                require(time.monotonic() < deadline, "training deadline exhausted before capture")
                remaining = remaining_capture_bytes(Path(output_root).parent)
                require(remaining > 0, "capture budget exhausted")
                Path(output_root).mkdir(exist_ok=False)
                receipt = capture(error=error, model=model, critic=critic, sample=sample,
                    counts=dict(counts), epoch=epoch, train_position=state["position"],
                    output_root=str(Path(output_root).absolute()), execution_binding=execution_binding,
                    source_bindings=list(source_bindings), remaining_output_bytes=remaining)
                require(time.monotonic() < deadline, "training deadline exhausted during capture")
                require(sum(p.stat().st_size for p in Path(output_root).parent.rglob("*") if p.is_file())
                    <= TOTAL_BYTES - TERMINAL_RESERVE, "capture exceeded reserved total budget")
                diagnostic["captureReceipt"] = receipt
            except BaseException as secondary:
                diagnostic["captureError"] = {"type": type(secondary).__name__, "error": str(secondary)}
            raise
    return runner

def run_captured_boundary(*, terminal_sink, output_root, execution_binding, source_bindings,
                          started, capture=None, pair=None, **arguments):
    progress = {"optimizerSteps": {"generator": 0, "discriminator": 0}}
    diagnostic = {"failureCaptureTriggered": False}
    gate = arguments["training_gate"]
    require(isinstance(gate, base._ConsumedTrainingGate), "consumed same-package gate required")
    def before_capture(value):
        base._write_exclusive_json(Path(output_root).parent / "failure-capture-started.json", {
            **value, "runId": gate.authenticated.run_id, "packageId": gate.authenticated.package_id,
            "capabilityVersion": CAPABILITY,
            "optimizerStepsGenerator": value["optimizerSteps"]["generator"],
            "optimizerStepsDiscriminator": value["optimizerSteps"]["discriminator"]})
    runner = make_failure_capture_pair_runner(progress=progress, output_root=output_root,
        execution_binding=execution_binding, source_bindings=source_bindings,
        diagnostic=diagnostic, deadline=started+2700, capture=capture, pair=pair,
        before_capture=before_capture)
    primary = None
    try:
        result = frozen.bounded_training_loop(**arguments, pair_runner=runner, _progress_state=progress)
        terminal = {"schemaVersion": IDENTITY["terminalSchema"], "executionState": "completed", **result}
    except BaseException as error:
        primary = error
        counts = dict(progress["optimizerSteps"])
        progress_error = None
        try:
            value = base._progress_value(gate, actual_epoch=progress.get("actualEpoch",0),
                completed_epochs=progress.get("completedEpochs",0), counts=counts, phase="failed_closed",
                selected=progress.get("selected"), latest_checkpoint=progress.get("latestCheckpoint"), identity=IDENTITY)
            base._publish_progress(gate, value, root=arguments.get("artifact_root",ROOT))
        except BaseException as secondary: progress_error = str(secondary)
        terminal = {"schemaVersion": IDENTITY["terminalSchema"], "status": "experiment_failed_closed",
            "executionState": "failed_closed", "capabilityVersion": CAPABILITY,
            "runId": gate.authenticated.run_id, "packageId": gate.authenticated.package_id,
            "executionPackage": gate.authenticated.package_binding, "candidateContract": gate.authenticated.candidate_binding,
            "errorType": type(error).__name__, "error": str(error), "traceback": traceback.format_exc(),
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "optimizerSteps": counts, "completedEpochs": progress.get("completedEpochs",0),
            "checkpoints": progress.get("checkpoints",[]), "progressPublicationError": progress_error,
            "checkpointPromotable": False, "formalStage4QualificationAllowed": False,
            "stage4QualificationGranted": False, "runtimePublicationAllowed": False,
            "challengeContentRead": False, "regressionContentRead": False}
    terminal["executionVersion"] = "appearance_regime_gradient_failure_capture_v1"
    terminal["failureCapture"] = diagnostic
    if diagnostic["failureCaptureTriggered"]:
        try:
            path = Path(output_root).parent / "failure-capture-diagnostic.json"
            base._write_exclusive_json(path, diagnostic)
            terminal["failureCaptureReceipt"] = {"path": path.relative_to(arguments.get("artifact_root", ROOT)).as_posix(),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        except BaseException as secondary: terminal["failureCapturePublicationError"] = str(secondary)
    try: terminal_sink(terminal)
    except BaseException as secondary:
        if primary is None: raise
        try: primary.terminal_publication_error = str(secondary)
        except BaseException: pass
        raise primary
    return terminal
def run_cli(ticket_binding, output_path):
    started = time.monotonic()
    authenticated = authenticate_training_gate(ticket_binding)
    require(output_path.replace("\\", "/")
            == authenticated.output_root + "/phase-terminal.json",
            "V28 terminal path differs")
    consumed = base.consume_training_ticket(
        authenticated, capability=CAPABILITY,
        claim_schema="ai-painter-stage4-mvp256-dry-v28-ticket-consumption-v1")
    directory = base.v24.core.cpu.project_file(ROOT, authenticated.output_root)
    terminal_path = directory / "phase-terminal.json"
    training_entered = False

    def terminal_sink(value):
        require(len(json.dumps(value, ensure_ascii=False).encode("utf8")) <= 262144,
                "worker terminal exceeds reserved bytes")
        base._write_exclusive_json(terminal_path, value)

    try:
        guard = base.RuntimeResourceGuard(
            consumed, started=started, authenticator=authenticate_training_gate)
        guard.pre_cuda()
        train, validation, order, _ = load_bound_train_and_validation(consumed)
        guard.pre_cuda()
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                "CUDA BF16 unavailable")
        device = torch.device("cuda:0")
        torch.cuda.set_device(device)
        torch.cuda.manual_seed_all(base.MODEL_SEED)
        free, total = torch.cuda.mem_get_info(device)
        allocation = (int(total * base.RESOURCE_CEILING["maxGpuMemoryFraction"])
                      - (total - free) - 64 * 1024 * 1024)
        require(allocation > 0 and free >= base.RESOURCE_CEILING["minimumFreeVramMiB"]
                * 1024 * 1024, "V28 insufficient VRAM below bounded allocation")
        torch.cuda.set_per_process_memory_fraction(allocation / total, device)
        torch.cuda.reset_peak_memory_stats(device)
        checkpoint_dir = directory / "checkpoints"
        checkpoint_dir.mkdir(exist_ok=False)

        def checkpoint_sink(epoch, payload, _selection, _state_hashes):
            require(time.monotonic() - started < 2700, "checkpoint deadline exhausted")
            require(sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())
                    + len(payload) <= TOTAL_BYTES - TERMINAL_RESERVE,
                    "checkpoint would exhaust diagnostic terminal reserve")
            logical = authenticated.output_root + f"/checkpoints/epoch-{epoch:02d}.pt"
            path = base.v24.core.cpu.project_file(ROOT, logical)
            with path.open("xb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            return {"path": logical, "sha256": hashlib.sha256(payload).hexdigest()}

        training_entered = True
        return run_captured_boundary(
            output_root=directory / "failure-capture", execution_binding=authenticated.package_binding,
            source_bindings=list(authenticated.source_bindings), started=started,
            terminal_sink=terminal_sink, train_samples=train,
            validation_samples=validation, channel_order=order,
            training_gate=consumed, resource_check=guard,
            checkpoint_sink=checkpoint_sink, device=device,
            network_factory=fresh_networks, identity=IDENTITY)
    except Exception as error:
        if training_entered:
            # The failed boundary already preserved actual progress/capture metadata.
            # Never fabricate a second terminal with zero counts after training.
            raise
        progress = base._progress_value(
            consumed, actual_epoch=0, completed_epochs=0,
            counts={"generator": 0, "discriminator": 0},
            phase="failed_closed", identity=IDENTITY)
        progress_error = None
        try:
            base._publish_progress(consumed, progress)
        except Exception as failure:
            progress = None
            progress_error = str(failure)
        terminal = {"schemaVersion": IDENTITY["terminalSchema"],
            "status": "experiment_failed_closed", "executionState": "failed_closed",
            "capabilityVersion": CAPABILITY, "runId": authenticated.run_id,
            "packageId": authenticated.package_id,
            "executionPackage": authenticated.package_binding,
            "trainingTicketConsumption": consumed.consumption_claim,
            "errorType": type(error).__name__, "error": str(error),
            "optimizerStepsGenerator": 0, "optimizerStepsDiscriminator": 0,
            "latestProgress": progress, "progressPublicationError": progress_error,
            "challengeContentRead": False, "regressionContentRead": False,
            "checkpointPromotable": False,
            "formalStage4QualificationAllowed": False,
            "stage4QualificationGranted": False,
            "runtimePublicationAllowed": False}
        terminal_sink(terminal)
        return terminal


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--cpu-preflight", action="store_true")
    parser.add_argument("--training-ticket")
    parser.add_argument("--training-ticket-sha256")
    parser.add_argument("--output")
    args = parser.parse_args(argv)
    require(not (args.run and args.cpu_preflight), "V28 mode ambiguous")
    if not args.run:
        require(not any((args.training_ticket, args.training_ticket_sha256,
                         args.output)), "run arguments require --run")
        print(json.dumps({"status": "cpu_preflight_passed_training_not_started",
                          "capabilityVersion": CAPABILITY,
                          "trainingStarted": False, "gpuInitialized": False,
                          "optimizerCreated": False, "checkpointLoaded": False,
                          "checkpointWritten": False}))
        return 0
    require(all((args.training_ticket, args.training_ticket_sha256, args.output)),
            "V28 run requires ticket binding and output")
    result = run_cli({"path": args.training_ticket,
                      "sha256": args.training_ticket_sha256}, args.output)
    print(json.dumps({"status": result["status"], "runId": result.get("runId")}),
          flush=True)
    return 0 if result["status"] == "training_completed_review_pending" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed_before_ticket_consumption",
                          "errorType": type(error).__name__, "error": str(error)}),
              file=sys.stderr, flush=True)
        raise SystemExit(1)

"""V27 single-use managed worker; no GPU or optimizer is created on import."""
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
from ai_painter.complete_world.object_head_shared_hidden_priority_v27 import perform_pair  # noqa: E402
from ai_painter.complete_world.object_head_shared_hidden_v27_cpu import (  # noqa: E402
    build_fresh_object_head_shared_hidden_v27_cpu, AGGREGATION_RULE,
)

CAPABILITY = "stage4_mvp256_dry_object_head_shared_hidden_v27_v3"
POLICY_SCHEMA = "stage4-mvp256-dry-v27-shared-hidden-execution-policy-v3"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-execution-policy-v3.json"
CPU_REPORT_PATH = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/report.json"
PACKAGE_SCHEMA = "ai-painter-stage4-mvp256-dry-v27-v3-execution-package-v1"
GPU_SCHEMA = "ai-painter-stage4-mvp256-dry-v27-v3-zero-update-gpu-gate-v1"
TICKET_SCHEMA = "ai-painter-stage4-mvp256-dry-v27-v3-training-ticket-v1"
LOCK_SCHEMA = "ai-painter-stage4-mvp256-dry-v27-v3-managed-lock-v1"
LAUNCH_SCHEMA = "ai-painter-stage4-mvp256-dry-v27-v3-launch-identity-v1"
IDENTITY = {
    "capability": CAPABILITY,
    "checkpointSchema": "ai-painter-stage4-mvp256-dry-v27-v3-checkpoint-v1",
    "terminalSchema": "ai-painter-stage4-mvp256-dry-v27-v3-worker-terminal-v1",
    "progressSchema": "ai-painter-stage4-mvp256-dry-v27-v3-progress-v1",
}
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions"
PROGRAM_PATHS = {
    "worker": "ml/ai-painter/scripts/painter_stage4_v27_dry_single_world_checkpoint_worker.py",
    "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v27_gpu.py",
    "supervisor": "scripts/run-ai-painter-mvp256-dry-v27-training.mjs",
    "model": "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_v27_cpu.py",
    "probe": "ml/ai-painter/src/ai_painter/complete_world/object_head_shared_hidden_priority_v27.py",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fresh_networks(order):
    """Direct frozen V27 factory plus the original fresh critic; no old G state load."""
    with base._preserve_global_rng():
        torch.manual_seed(base.MODEL_SEED)
        legacy, critic = base.v24.fresh_networks(order)
        del legacy
        model = build_fresh_object_head_shared_hidden_v27_cpu(condition_channel_order=order)
    return model, critic

def _bound_reader(root):
    return base.v24.core.cpu.BoundReader(root)


HISTORICAL_TRANSACTION_ID = "current-execution-registry-advance-20261003072654-34480828-e8e3-4b53-a53e-1054b966ca29"
HISTORICAL_TRANSACTION_ROOT = ".runtime/ai-painter/current-execution-registry/transactions/" + HISTORICAL_TRANSACTION_ID
HISTORICAL_REGISTRY_OBSERVATION = {
    "observed": {"path": ".runtime/ai-painter/current-execution-registry/current.json",
        "sha256": "0ce72710a9232731c133ca5af47ca15057b301802efdb5f4a25518d078436908",
        "registryRevision": 366, "activeExecution": None},
    "transaction": {"path": HISTORICAL_TRANSACTION_ROOT + "/transaction.json",
        "sha256": "bda02cd448662b461bab42deb613a0c73ea8763893445238187fceccd462ff86"},
    "snapshot": {"path": HISTORICAL_TRANSACTION_ROOT + "/current.staged.json",
        "sha256": "0ce72710a9232731c133ca5af47ca15057b301802efdb5f4a25518d078436908"},
    "event": {"path": HISTORICAL_TRANSACTION_ROOT + "/registry-event.staged.jsonl",
        "sha256": "6123bd6026edb8a003c9d68d159a6c5cbd3890590927be07daf94e174cb7123c"},
}


def validate_historical_registry_records(transaction, snapshot, event):
    proof = HISTORICAL_REGISTRY_OBSERVATION
    require(transaction["schemaVersion"] == "ai-painter-current-execution-registry-transaction-v1"
            and snapshot["schemaVersion"] == "ai-painter-current-execution-registry-v1"
            and event["schemaVersion"] == "ai-painter-current-execution-registry-event-v1"
            and transaction["status"] == "committed"
            and datetime.fromisoformat(transaction["committedAtUtc"].replace("Z", "+00:00"))
                >= datetime.fromisoformat(transaction["recordedAtUtc"].replace("Z", "+00:00")),
            "historical registry commit differs")
    require(all(record["transactionId"] == HISTORICAL_TRANSACTION_ID
                and record["registryRevision"] == record["eventSequence"] == 366
                and record["recordedAtUtc"] == transaction["recordedAtUtc"]
                for record in (transaction, snapshot, event)),
            "historical registry revision/transaction/event differs")
    require(transaction["currentStaged"] == proof["snapshot"]
            and transaction["registryEventStaged"] == proof["event"]
            and transaction["currentSha256"] == event["currentSha256"] == proof["observed"]["sha256"]
            and event["previousCurrentSha256"] == transaction["previousCurrentSha256"]
                == snapshot["supersedes"]["currentSha256"]
            and transaction["previousRegistryRevision"] == snapshot["supersedes"]["registryRevision"]
                == snapshot["supersedes"]["eventSequence"] == 365
            and event["action"] == "advance_current_capability_lifecycle"
            and event["taskId"] == snapshot["taskId"] and event["runId"] == snapshot["runId"]
            and snapshot["activeExecution"] is None,
            "historical registry immutable binding differs")


def read_historical_registry_observation(reader, observation):
    require(observation == HISTORICAL_REGISTRY_OBSERVATION["observed"],
            "historical registry observation identity differs")
    proof = HISTORICAL_REGISTRY_OBSERVATION
    validate_historical_registry_records(reader.json(proof["transaction"]),
        reader.json(proof["snapshot"]), reader.json(proof["event"]))
    return proof


def read_model_cpu_proof(reader, binding):
    root = ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/"
    expected = {"path": root + "report.json",
                "sha256": "0c45507597b1cb6fa1b497274b12fbbf34c6726d07f252909a49c10cbd804955"}
    require(binding == expected, "V27 model CPU report identity differs")
    report = reader.json(expected)
    contract_binding = {"path": "data/ai-painter/system-governance/stage4-mvp256-dry-v27-shared-hidden-cpu-candidate-v3.json",
        "sha256": "0dba539adf017cfd4a7e900aef6aa8602d4db1538e4640c9f0cb76ae1c0241b7"}
    claim_binding = {"path": root + "claim.json",
        "sha256": "c962867bfbcd364341fe57d261b399a3165e57c10c5980ea8c226ff6791ff2b5"}
    acceptance_binding = {"path": root + "controller-acceptance.json",
        "sha256": "8de54d9a2b4c3b2b053ddfe3511642de70b79b0cfb6db690484df706b272415e"}
    contract, claim = reader.json(contract_binding), reader.json(claim_binding)
    accepted = reader.json(acceptance_binding)
    read_historical_registry_observation(reader, accepted["registryBeforeAndAfter"])
    require(report["contract"] == claim["contract"] == accepted["contract"] == contract_binding
            and claim["attempt"] == 1 and claim["automaticRetries"] == 0
            and accepted["report"] == expected and accepted["claim"] == claim_binding
            and accepted["bindingMismatches"] == 0, "V27 consumed CPU chain differs")
    snapshots = {
        "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md":
            accepted["checkedFormalSpecificationSnapshot"],
        "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md":
            accepted["checkedExecutionGuideSnapshot"],
    }
    def rehash(value):
        if value is accepted["registryBeforeAndAfter"]:
            return read_historical_registry_observation(reader, value)
        if isinstance(value, dict):
            if isinstance(value.get("path"), str) and isinstance(value.get("sha256"), str):
                item = {"path": value["path"], "sha256": value["sha256"]}
                if item["path"] in snapshots:
                    require(item["sha256"] == snapshots[item["path"]]["sha256"],
                            "historical document SHA differs from exact snapshot")
                    item = snapshots[item["path"]]
                reader.read(base._binding(item, "V27 historical proof"))
            for child in value.values():
                rehash(child)
        elif isinstance(value, list):
            for child in value:
                rehash(child)
    for value in (report, contract, claim, accepted):
        rehash(value)
    require(report["status"] == "cpu_contract_checked_not_execution_qualified"
            and report["capabilityVersion"] == "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_v3_candidate"
            and report["actualModelIdentity"] == {
                "capabilityVersion": "stage4_mvp256_dry_object_head_shared_hidden_v27_cpu_candidate",
                "executionQualified": False, "parentCheckpointLoaded": False}
            and report["realCallCounts"] == {"modelForwardsAttempted": 2,
                "modelForwardsCompleted": 2, "autogradGradCallsAttempted": 8,
                "autogradGradCallsCompleted": 8}
            and report["syntheticEvidence"]["testsRun"] == 29
            and all(report["syntheticEvidence"][k] == 0 for k in ("failures", "errors", "skipped"))
            and len(report["dependencyChecks"]) == 6
            and all(row["status"] == "verified" for row in report["dependencyChecks"])
            and report["terminalAssertionsCompleted"] is True
            and report["initialState"] == report["finalState"]
            and report["boundary"]["optimizerSteps"] == 0
            and all(report["boundary"][k] is False for k in report["boundary"]
                    if k != "optimizerSteps"), "V27 model CPU assertions differ")
    return report


SINGLE_CHANGE = {"operation": "one_registered_hidden_four_independent_rgb_adapters_v1",
    "trainingAndInference": True, "dropoutEnabled": False,
    "fullV23ContextPreserved": True, "groupCount": 5,
    "modelParameterTensorCount": 100, "modelParameterElementCount": 2236015,
    "objectParameterTensorCount": 10, "objectParameterElementCount": 1372,
    "crossClassCouplingChanged": True}



PREDECESSOR_MANIFEST = {
    "path": ".runtime/ai-painter/stage4-mvp256-dry-v27-lifecycle-cpu/frozen-before-registry-repair-20261006/manifest.json",
    "sha256": "9982e3c7c7be329c8082673449b9e73046f927512c091ed1946c3fd11178a71a"}


def read_predecessor_proof(reader, binding=PREDECESSOR_MANIFEST):
    require(binding == PREDECESSOR_MANIFEST, "predecessor source manifest differs")
    manifest = reader.json(binding)
    require(manifest["schemaVersion"] == "ai-painter-v27-pre-registration-repair-source-snapshot-v1"
            and len(manifest["sources"]) == 20, "predecessor source snapshot schema differs")
    archived = {}
    for row in manifest["sources"]:
        original, snapshot = row["originalPath"], row["snapshot"]
        require(original not in archived and snapshot["path"]
                == str(Path(binding["path"]).parent).replace("\\", "/") + "/" + original,
                "duplicate or misplaced frozen source")
        reader.read(base._binding(snapshot, "predecessor snapshot"))
        archived[original] = snapshot
    def rehash(value):
        if isinstance(value, dict):
            if isinstance(value.get("path"), str) and isinstance(value.get("sha256"), str):
                item = {"path": value["path"], "sha256": value["sha256"]}
                if item["path"] in archived:
                    snapshot = archived[item["path"]]
                    require(item["sha256"] == snapshot["sha256"], "historical source snapshot SHA differs")
                    item = snapshot
                reader.read(base._binding(item, "predecessor bound bytes"))
            for child in value.values():
                rehash(child)
        elif isinstance(value, list):
            for child in value:
                rehash(child)
    policy = reader.json(manifest["predecessorPolicy"])
    cpu = reader.json(manifest["predecessorCpuAcceptance"])
    claim = reader.json(manifest["predecessorClaim"])
    failure = reader.json(manifest["predecessorFailure"])
    package = reader.json(manifest["predecessorExecutionPackage"])
    for record in (policy, cpu, claim, failure, package):
        rehash(record)
    require(policy["schemaVersion"] == "stage4-mvp256-dry-v27-shared-hidden-execution-policy-v1"
            and policy["capabilityVersion"] == "stage4_mvp256_dry_object_head_shared_hidden_v27"
            and policy["cpuAcceptance"] == manifest["predecessorCpuAcceptance"]
            and claim["candidateContract"] == package["candidateContract"] == manifest["predecessorPolicy"]
            and failure["executionPackage"] == manifest["predecessorExecutionPackage"]
            and claim["automaticRetries"] == 0
            and all(record["capabilityVersion"] == policy["capabilityVersion"]
                    and record["runId"] == claim["runId"] and record["packageId"] == claim["packageId"]
                    for record in (claim, failure, package)), "predecessor identity chain differs")
    require(failure["status"] == failure["executionState"] == "failed_closed"
            and failure["error"].startswith("Error: registry_active_execution_program_role_invalid")
            and failure["trainingStarted"] is False
            and failure["optimizerStepsGenerator"] == failure["optimizerStepsDiscriminator"] == 0
            and all(failure[k] is None for k in ("workerTerminal", "progress", "gpuQualificationFailure")),
            "predecessor is not a zero-update pretraining interface failure")
    root = Path(reader.root) if hasattr(reader, "root") else ROOT
    previous = Path(manifest["predecessorExecutionPackage"]["path"]).parent
    for name in ("zero-update-gpu-qualification.json", "zero-update-gpu-qualification-claim.json",
                 "zero-update-gpu-qualification-failure.json", "training-ticket.json",
                 "training-ticket-consumed.json", "phase-terminal.json", "progress.json"):
        require(not (root / previous / name).exists(), "predecessor progressed beyond registration")
    return {"frozenSourceManifest": binding,
        "predecessorExecutionPolicy": manifest["predecessorPolicy"],
        "predecessorExecutionClaim": manifest["predecessorClaim"],
        "predecessorRegistrationFailure": manifest["predecessorFailure"]}


PREDECESSOR_V2_MANIFEST = {
    "path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-lifecycle-cpu/frozen-before-historical-binding-repair-20261006/manifest.json",
    "sha256": "8d710b8331943c1cd38378cbe36d7c68df9543fe586a9b354411a96b30b83db7"}
PREDECESSOR_V2_CLAIM = {
    "path": ".runtime/ai-painter/stage4-mvp256-dry-v27-v2-executions/single-training-attempt-claim.json",
    "sha256": "358dabeab755d82ed15ca1a520affb06c913d0eede673e6084387d163d81eaf1"}


def read_execution_predecessor_proof(reader):
    original = read_predecessor_proof(reader)
    manifest = reader.json(PREDECESSOR_V2_MANIFEST)
    require(manifest["schemaVersion"] == "ai-painter-v27-v2-pre-historical-binding-repair-source-snapshot-v1"
            and len(manifest["sources"]) == 18, "V2 frozen source schema differs")
    archived = {}
    for row in manifest["sources"]:
        logical, snapshot = row["originalPath"], row["snapshot"]
        require(logical not in archived and snapshot["path"]
                == Path(PREDECESSOR_V2_MANIFEST["path"]).parent.as_posix() + "/" + logical,
                "duplicate or misplaced V2 frozen source")
        reader.read(base._binding(snapshot, "V2 frozen source"))
        archived[logical] = snapshot
    def rehash(value):
        if isinstance(value, dict):
            if isinstance(value.get("path"), str) and isinstance(value.get("sha256"), str):
                item = {"path": value["path"], "sha256": value["sha256"]}
                if item["path"] in archived:
                    require(archived[item["path"]]["sha256"] == item["sha256"],
                            "V2 historical source SHA differs")
                    item = archived[item["path"]]
                reader.read(base._binding(item, "V2 predecessor bound bytes"))
            for child in value.values():
                rehash(child)
        elif isinstance(value, list):
            for child in value:
                rehash(child)
    policy = reader.json(manifest["predecessorPolicy"])
    cpu = reader.json(manifest["predecessorCpuAcceptance"])
    cpu_claim = reader.json(cpu["claim"])
    claim = reader.json(PREDECESSOR_V2_CLAIM)
    failure = reader.json(manifest["predecessorFailure"])
    package = reader.json(failure["executionPackage"])
    for record in (policy, cpu, cpu_claim, claim, failure, package):
        rehash(record)
    require(policy["schemaVersion"] == "stage4-mvp256-dry-v27-shared-hidden-execution-policy-v2"
            and policy["capabilityVersion"] == "stage4_mvp256_dry_object_head_shared_hidden_v27_v2"
            and policy["cpuAcceptance"] == manifest["predecessorCpuAcceptance"]
            and claim["candidateContract"] == package["candidateContract"] == manifest["predecessorPolicy"]
            and package["schemaVersion"] == "ai-painter-stage4-mvp256-dry-v27-v2-execution-package-v1"
            and cpu["schemaVersion"] == "ai-painter-mvp256-dry-v27-v2-lifecycle-cpu-acceptance-v1"
            and cpu["status"] == "v27_v2_lifecycle_cpu_acceptance_passed"
            and cpu_claim["schemaVersion"] == "ai-painter-mvp256-dry-v27-v2-lifecycle-cpu-claim-v1"
            and all(cpu_claim[k] == cpu[k] for k in ("programBindings", "modelCpuEvidence",
                                                   "formalSpecification", "executionGuide"))
            and cpu["programBindings"] == package["programBindings"] == policy["programBindings"]
            and all(policy.get(k) == cpu.get(k) == cpu_claim.get(k) == v for k, v in original.items()),
            "V2 predecessor CPU/source chain differs")
    require(claim["automaticRetries"] == 0
            and all(record["capabilityVersion"] == policy["capabilityVersion"]
                    and record["runId"] == claim["runId"] and record["packageId"] == claim["packageId"]
                    for record in (claim, failure, package))
            and failure["schemaVersion"] == "ai-painter-mvp256-dry-v27-v2-training-failure-v1"
            and failure["status"] == failure["executionState"] == "failed_closed"
            and "v27_gpu_preflight_failed_closed" in failure["error"]
            and "source SHA mismatch: .runtime/ai-painter/current-execution-registry/current.json" in failure["error"]
            and failure["trainingStarted"] is False
            and failure["optimizerStepsGenerator"] == failure["optimizerStepsDiscriminator"] == 0
            and all(failure[k] is None for k in ("workerTerminal", "progress", "gpuQualificationFailure")),
            "V2 predecessor is not a zero-update historical-observation preflight failure")
    previous = Path(failure["executionPackage"]["path"]).parent
    for name in ("zero-update-gpu-qualification.json", "zero-update-gpu-qualification-claim.json",
                 "zero-update-gpu-qualification-failure.json", "training-ticket.json",
                 "training-ticket-consumed.json", "phase-terminal.json", "progress.json"):
        require(not (Path(reader.root) / previous / name).exists(), "V2 predecessor progressed after preflight")
    read_model_cpu_proof(reader, policy["modelCpuEvidence"])
    return {**original, "predecessorV2SourceManifest": PREDECESSOR_V2_MANIFEST,
        "predecessorV2ExecutionPolicy": manifest["predecessorPolicy"],
        "predecessorV2CpuAcceptance": manifest["predecessorCpuAcceptance"],
        "predecessorV2ExecutionClaim": PREDECESSOR_V2_CLAIM,
        "predecessorV2PreflightFailure": manifest["predecessorFailure"],
        "historicalRegistryObservation": HISTORICAL_REGISTRY_OBSERVATION}


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


def _source_candidate(reader, policy):
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == CAPABILITY
            and policy.get("executionVersion") == "shared_hidden_historical_observation_repair_v27_v3"
            and policy.get("aggregationRule") == AGGREGATION_RULE
            and policy.get("historicalQualificationMayBeReused") is False
            and policy.get("historicalCheckpointMayInitialize") is False,
            "V27 execution boundary differs")
    parent_binding = base._binding(policy.get("predecessorCandidate"), "V24 source candidate")
    require(parent_binding["path"] == "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json",
            "V27 original data candidate differs")
    parent = reader.json(parent_binding)
    predecessor = read_execution_predecessor_proof(reader)
    require(all(policy.get(k) == v for k, v in predecessor.items()), "V27-v2 predecessor bindings differ")
    base.validate_candidate_contract(parent)
    require(policy.get("executionCeiling") == base.RESOURCE_CEILING
            and policy.get("checkpointSelection") == parent["checkpointSelection"]
            and policy.get("dataUse") == parent["dataUse"]
            and policy.get("scope") == parent["scope"]
            and policy.get("singleChange") == SINGLE_CHANGE
            and policy.get("activation") == {
                "cpuAcceptanceCompleted": True, "gpuQualificationAllowed": True,
                "trainingAllowed": False, "formalStage4QualificationAllowed": False,
                "runtimePublicationAllowed": False}, "V27 frozen contract differs")
    cpu_binding = base._binding(policy.get("modelCpuEvidence"), "V27 model CPU")
    report = read_model_cpu_proof(reader, cpu_binding)
    acceptance = reader.json(base._binding(policy.get("cpuAcceptance"), "V27 lifecycle CPU"))
    require(all(acceptance.get(k) == v for k, v in predecessor.items()), "V27-v2 CPU predecessor bindings differ")
    validate_program_bindings(reader, acceptance["programBindings"])
    require(acceptance.get("schemaVersion") == "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-acceptance-v1"
            and acceptance.get("status") == "v27_v3_lifecycle_cpu_acceptance_passed"
            and acceptance.get("capabilityVersion") == CAPABILITY
            and acceptance.get("modelCpuEvidence") == cpu_binding
            and acceptance.get("formalSpecification") == policy.get("formalSpecification")
            and acceptance.get("executionGuide") == policy.get("executionGuide")
            and acceptance.get("optimizerSteps") == 0
            and acceptance.get("syntheticOptimizerSteps") == {"generator": 1, "discriminator": 1}
            and acceptance.get("gpuInitialized") is False
            and acceptance.get("trainingStarted") is False
            and acceptance.get("failedTests") == acceptance.get("skippedTests") == 0
            and acceptance.get("passedTests", 0) > 0
            and "candidateContract" not in acceptance, "V27 lifecycle CPU proof differs")
    cpu_claim = reader.json(base._binding(acceptance.get("claim"), "lifecycle CPU claim"))
    require(all(cpu_claim.get(k) == v for k, v in predecessor.items()),
            "V27-v2 CPU claim predecessor bindings differ")
    require(cpu_claim.get("schemaVersion") == "ai-painter-mvp256-dry-v27-v3-lifecycle-cpu-claim-v1"
            and cpu_claim.get("capabilityVersion") == CAPABILITY
            and cpu_claim.get("attempt") == 1 and cpu_claim.get("automaticRetries") == 0
            and cpu_claim.get("programBindings") == acceptance["programBindings"]
            and cpu_claim.get("modelCpuEvidence") == cpu_binding
            and cpu_claim.get("formalSpecification") == policy["formalSpecification"]
            and cpu_claim.get("executionGuide") == policy["executionGuide"],
            "V27 lifecycle CPU claim differs")
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
            and py_result["syntheticOptimizerSteps"] == {"generator": 1, "discriminator": 1}
            and tap_count("fail") == tap_count("cancelled") == tap_count("skipped") == 0
            and tap_count("tests") == tap_count("pass") > 0
            and py_result["testsRun"] + tap_count("pass") == acceptance["passedTests"],
            "V27 actual test outputs differ")
    for item in acceptance["programBindings"].values():
        reader.read(base._binding(item, "V27 CPU-tested lifecycle source"))
    require(policy.get("programBindings") == acceptance["programBindings"],
            "V27 policy/source closure differs")
    for role, path in PROGRAM_PATHS.items():
        require(acceptance["programBindings"].get(role, {}).get("path") == path,
                "missing tested V27 program: " + role)
    spec = reader.read(base._binding(policy.get("formalSpecification"), "V27 specification"))
    require(b"AI-PAINTER-SPEC-1.41" in spec, "V27 current specification differs")
    reader.read(base._binding(policy.get("executionGuide"), "V27 guide"))
    for item in parent["frozenBindings"].values():
        reader.read(item)
    for item in policy["baseline"].values():
        reader.read(item)
    require(policy.get("numericSuccessGate") == {
        "maximumValidationRgbMae": 0.06140733743086457,
        "minimumExclusiveWorstApplicableObjectCorrelation": -0.08459185063838959,
        "preselectedSampleId": parent["scope"]["subjectSampleId"],
        "allOriginalReviewsRequired": True}, "V27 frozen numeric success gate differs")
    require(all(k not in policy for k in ("executionPackage", "gpuQualification",
            "trainingTicket", "managedLock", "launchIdentity")), "policy references descendants")
    return report, parent

def authenticate_training_gate(ticket_binding, *, root=ROOT, check_process=True):
    """Rehash V27-specific acyclic package, GPU, lock, launch, and ticket."""
    reader = _bound_reader(root)
    ticket_binding = base._binding(ticket_binding, "V27 ticket")
    ticket = reader.json(ticket_binding)
    require(ticket.get("schemaVersion") == TICKET_SCHEMA
            and ticket.get("status") == "issued_single_use"
            and ticket.get("capabilityVersion") == CAPABILITY
            and ticket.get("trainingAllowed") is True
            and ticket.get("automaticRetries") == 0
            and ticket.get("formalStage4QualificationAllowed") is False
            and ticket.get("runtimePublicationAllowed") is False,
            "V27 single-use training ticket required")
    package_binding = base._binding(ticket.get("executionPackage"), "V27 package")
    package = reader.json(package_binding)
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
            "V27 managed base package differs")
    run_id, package_id = package.get("runId"), package.get("packageId")
    require(all(isinstance(value, str) and 8 <= len(value) <= 128
                and all(char.isalnum() or char in "_-" for char in value)
                for value in (run_id, package_id)), "invalid V27 run identity")
    programs = package.get("programBindings")
    require(isinstance(programs, dict)
            and all(programs.get(role, {}).get("path") == expected
                    for role, expected in PROGRAM_PATHS.items()),
            "V27 program roles differ")
    for binding in programs.values():
        reader.read(base._binding(binding, "V27 program"))
    policy_binding = base._binding(package.get("candidateContract"), "V27 policy")
    require(policy_binding["path"] == POLICY_PATH,
            "V27 policy path differs")
    policy = reader.json(policy_binding)
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == CAPABILITY,
            "V27 execution policy differs")
    proposal, parent = _source_candidate(reader, policy)
    acceptance = reader.json(base._binding(policy["cpuAcceptance"], "V27 lifecycle evidence"))
    require(all(acceptance["programBindings"].get(role) == binding
                for role, binding in programs.items()),
            "V27 execution program differs from CPU-tested program")
    require(package.get("sourceDataCandidate") == policy["predecessorCandidate"]
            and package.get("cpuAcceptance") == policy["cpuAcceptance"]
            and package.get("modelCpuEvidence") == policy["modelCpuEvidence"]
            and package.get("programBindings") == policy["programBindings"]
            and not any(k in package for k in ("gpuQualification", "trainingTicket", "managedLock", "launchIdentity")),
            "V27 package predecessor/CPU bindings differ")
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
            }, "V27 inherited data/review bindings differ")
    specification = reader.read(base._binding(policy.get("formalSpecification"), "V27 specification"))
    require(b"AI-PAINTER-SPEC-1.41" in specification, "V27 specification version differs")

    output_root = package.get("outputRoot")
    require(isinstance(output_root, str)
            and output_root.startswith(OUTPUT_PARENT + "/")
            and all(part not in ("", ".", "..") for part in output_root.split("/"))
            and "\\" not in output_root
            and package_binding["path"] == output_root + "/execution-package.json"
            and ticket_binding["path"] == output_root + "/training-ticket.json",
            "isolated V27 output root required")
    require(ticket.get("runId") == run_id and ticket.get("packageId") == package_id
            and ticket.get("consumptionClaimPath")
            == output_root + "/training-ticket-consumed.json",
            "V27 ticket identity differs")
    gpu_binding = base._binding(ticket.get("gpuQualification"), "V27 GPU gate")
    require(gpu_binding["path"] == output_root + "/zero-update-gpu-qualification.json",
            "V27 GPU gate path differs")
    gpu = reader.json(gpu_binding)
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
            "V27 current-candidate GPU gate differs")
    lock_binding = base._binding(ticket.get("managedLock"), "V27 managed lock")
    launch_binding = base._binding(ticket.get("launchIdentity"), "V27 launch")
    require(lock_binding["path"] == output_root + "/managed-training-lock.json"
            and launch_binding["path"]
                == output_root + "/supervisor-launch-identity.json",
            "V27 lock/launch paths differ")
    lock, launch = reader.json(lock_binding), reader.json(launch_binding)
    require(lock.get("schemaVersion") == LOCK_SCHEMA
            and lock.get("status") == "active_bound_single_attempt"
            and lock.get("runId") == run_id and lock.get("packageId") == package_id
            and lock.get("executionPackage") == package_binding
            and lock.get("resourceBudget") == base.RESOURCE_CEILING,
            "V27 managed lock differs")
    require(launch.get("schemaVersion") == LAUNCH_SCHEMA
            and launch.get("status") == "managed_supervisor_identity_verified"
            and launch.get("runId") == run_id and launch.get("packageId") == package_id
            and launch.get("executionPackage") == package_binding
            and launch.get("managedLock") == lock_binding
            and type(launch.get("processId")) is int and launch["processId"] > 0
            and isinstance(launch.get("processStartIdentity"), str)
            and launch["processStartIdentity"].startswith(str(launch["processId"]) + ":"),
            "V27 supervisor launch differs")
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
                "V27 current managed execution differs")
        heartbeat_path = base.v24.core.cpu.project_file(
            root, active.get("heartbeat", {}).get("path", ""))
        heartbeat = json.loads(heartbeat_path.read_bytes())
        require(heartbeat.get("runId") == run_id
                and heartbeat.get("processId") == pid
                and heartbeat.get("processStartIdentity") == identity
                and time.time() < datetime.fromisoformat(
                    heartbeat["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp()
                    + 120,
                "V27 managed heartbeat stale or changed")
        active_lock = reader.json(base._binding(active.get("lock"),
                                                "V27 current active lock"))
        require(active_lock.get("runId") == run_id
                and active_lock.get("packageId") == package_id
                and active_lock.get("processId") == pid
                and active_lock.get("processStartIdentity") == identity,
                "V27 current active lock differs")
        require(base.managed_worker.process_identity(pid) == identity,
                "V27 supervisor exited or PID reused")
        rows = base.managed_worker.read_process_chain(os.getpid(), pid)
        base.managed_worker.validate_process_chain(rows, pid, identity)
        require(rows == base.managed_worker.read_process_chain(os.getpid(), pid),
                "V27 process chain changed during authentication")
        process_chain = tuple(tuple(sorted(row.items())) for row in rows)
    reader.unchanged()
    sources = tuple({"path": path, "sha256": digest}
                    for path, digest in reader.observed.items())
    return base._AuthenticatedTrainingGate(
        package_binding, policy_binding, run_id, package_id, output_root,
        ticket_binding, ticket["consumptionClaimPath"], process_chain,
        gpu["initialStateSha256"], sources)


def run_cli(ticket_binding, output_path):
    started = time.monotonic()
    authenticated = authenticate_training_gate(ticket_binding)
    require(output_path.replace("\\", "/")
            == authenticated.output_root + "/phase-terminal.json",
            "V27 terminal path differs")
    consumed = base.consume_training_ticket(
        authenticated, capability=CAPABILITY,
        claim_schema="ai-painter-stage4-mvp256-dry-v27-v3-ticket-consumption-v1")
    directory = base.v24.core.cpu.project_file(ROOT, authenticated.output_root)
    terminal_path = directory / "phase-terminal.json"

    def terminal_sink(value):
        base._write_exclusive_json(terminal_path, value)

    try:
        guard = base.RuntimeResourceGuard(
            consumed, started=started, authenticator=authenticate_training_gate)
        guard.pre_cuda()
        train, validation, order, _ = base.load_bound_train_and_validation(consumed)
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
                * 1024 * 1024, "V27 insufficient VRAM below bounded allocation")
        torch.cuda.set_per_process_memory_fraction(allocation / total, device)
        torch.cuda.reset_peak_memory_stats(device)
        checkpoint_dir = directory / "checkpoints"
        checkpoint_dir.mkdir(exist_ok=False)

        def checkpoint_sink(epoch, payload, _selection, _state_hashes):
            logical = authenticated.output_root + f"/checkpoints/epoch-{epoch:02d}.pt"
            path = base.v24.core.cpu.project_file(ROOT, logical)
            with path.open("xb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            return {"path": logical, "sha256": hashlib.sha256(payload).hexdigest()}

        return base.run_with_terminal_boundary(
            terminal_sink=terminal_sink, train_samples=train,
            validation_samples=validation, channel_order=order,
            training_gate=consumed, resource_check=guard,
            checkpoint_sink=checkpoint_sink, device=device,
            network_factory=fresh_networks, pair_runner=perform_pair, identity=IDENTITY)
    except Exception as error:
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
    require(not (args.run and args.cpu_preflight), "V27 mode ambiguous")
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
            "V27 run requires ticket binding and output")
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

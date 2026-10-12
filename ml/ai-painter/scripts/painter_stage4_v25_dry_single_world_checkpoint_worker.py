"""V25 single-use managed worker; no GPU or optimizer is created on import."""
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
from ai_painter.complete_world.object_head_train_dropout_v25_cpu import (  # noqa: E402
    build_fresh_object_head_train_dropout_v25_cpu,
)

CAPABILITY = "stage4_mvp256_dry_object_head_train_dropout_v25_v1"
POLICY_SCHEMA = "stage4-mvp256-dry-v25-head-dropout-execution-policy-v2"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp256-dry-v25-head-dropout-execution-policy-v2.json"
PREDECESSOR_ROOT = ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/mvp256-dry-v25-4c1335bd1cedfeeff95f8b1bf3614d4adf41d59960db077a"
RECOVERY_CLAIM = ".runtime/ai-painter/stage4-mvp256-dry-v25-executions/single-heartbeat-recovery-v2-attempt-claim.json"
PACKAGE_SCHEMA = "ai-painter-stage4-mvp256-dry-v25-execution-package-v1"
GPU_SCHEMA = "ai-painter-stage4-mvp256-dry-v25-zero-update-gpu-gate-v1"
TICKET_SCHEMA = "ai-painter-stage4-mvp256-dry-v25-training-ticket-v1"
LOCK_SCHEMA = "ai-painter-stage4-mvp256-dry-v25-managed-lock-v1"
LAUNCH_SCHEMA = "ai-painter-stage4-mvp256-dry-v25-launch-identity-v1"
IDENTITY = {
    "capability": CAPABILITY,
    "checkpointSchema": "ai-painter-stage4-mvp256-dry-v25-checkpoint-v1",
    "terminalSchema": "ai-painter-stage4-mvp256-dry-v25-worker-terminal-v1",
    "progressSchema": "ai-painter-stage4-mvp256-dry-v25-progress-v1",
}
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp256-dry-v25-executions"
PROGRAM_PATHS = {
    "worker": "ml/ai-painter/scripts/painter_stage4_v25_dry_single_world_checkpoint_worker.py",
    "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v25_gpu.py",
    "supervisor": "scripts/run-ai-painter-mvp256-dry-v25-training.mjs",
    "model": "ml/ai-painter/src/ai_painter/complete_world/object_head_train_dropout_v25_cpu.py",
    "probe": "ml/ai-painter/src/ai_painter/complete_world/object_head_train_dropout_v25_probe.py",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fresh_networks(order):
    """Use the V24 fresh initialization; never load a historical Checkpoint."""
    with base._preserve_global_rng():
        legacy, critic = base.v24.fresh_networks(order)
        model = build_fresh_object_head_train_dropout_v25_cpu(
            condition_channel_order=order)
        model.load_state_dict(legacy.state_dict(), strict=True)
        del legacy
    return model, critic


def _bound_reader(root):
    return base.v24.core.cpu.BoundReader(root)


def validate_recovery_policy(reader, policy):
    """One distinct execution recovery, never a resume or model search."""
    import ast

    recovery = policy.get("recovery", {})
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("executionVersion") == "heartbeat_recovery_v2"
            and recovery.get("additionalExecutionAttempts") == 1
            and recovery.get("automaticTrainingRetries") == 0
            and recovery.get("historicalCheckpointMayInitialize") is False
            and recovery.get("oldRunMustRemainClosed") is True
            and recovery.get("heartbeatPublication") == {
                "retryableErrorCodes": ["EPERM", "EACCES", "EBUSY"],
                "maxReplaceAttempts": 21, "retryDelayMilliseconds": 100,
                "maxWaitMilliseconds": 2000, "sameStagedBytesOnly": True,
                "preservePreviousHeartbeat": True,
            }, "V25 fixed execution recovery boundary differs")
    previous_binding = base._binding(recovery.get("predecessorPolicy"), "previous V25 policy")
    require(previous_binding["path"] == POLICY_PATH.replace("-v2.json", "-v1.json"),
            "V25 previous policy path differs")
    previous = reader.json(previous_binding)
    for key in ("capabilityVersion", "cpuProposal", "predecessorCandidate", "scope",
                "dataUse", "singleChange", "checkpointSelection", "executionCeiling", "activation"):
        require(policy.get(key) == previous.get(key), "V25 recovery changed " + key)
    failure_binding = base._binding(recovery.get("predecessorFailure"), "V25 heartbeat failure")
    require(failure_binding["path"] == PREDECESSOR_ROOT + "/failure.json",
            "V25 recovery predecessor differs")
    failure = reader.json(failure_binding)
    old_package_binding = base._binding(failure.get("executionPackage"), "old V25 package")
    old_package = reader.json(old_package_binding)
    require(old_package.get("candidateContract") == previous_binding
            and failure.get("status") == "failed_closed"
            and failure.get("capabilityVersion") == CAPABILITY
            and failure.get("workerTerminal") is None
            and failure.get("gpuQualificationFailure") is None
            and "AbortController.abort" in failure.get("error", "")
            and "Timeout.<anonymous>" in failure.get("error", ""),
            "V25 predecessor is not the bound supervisor cancellation")
    progress = reader.json(base._binding(failure.get("progress"), "old V25 progress"))
    count = failure.get("optimizerStepsGenerator")
    require(type(count) is int and 0 < count < 2304
            and count == failure.get("optimizerStepsDiscriminator")
            and count == progress.get("optimizerStepsGenerator")
            and count == progress.get("optimizerStepsDiscriminator")
            and 0 < progress.get("completedEpochs", 0) < 48,
            "V25 recovery cannot restart a completed or differently counted run")
    claim_binding = base._binding(recovery.get("predecessorClaim"), "old V25 claim")
    require(claim_binding["path"] == OUTPUT_PARENT + "/single-training-attempt-claim.json",
            "V25 old claim path differs")
    claim = reader.json(claim_binding)
    consumed = reader.json(base._binding(recovery.get("predecessorTicketConsumption"), "old consumed ticket"))
    old_ticket_binding = base._binding(consumed.get("trainingTicket"), "old training ticket")
    old_ticket = reader.json(old_ticket_binding)
    require(claim.get("runId") == failure.get("runId") == old_package.get("runId")
            and claim.get("packageId") == failure.get("packageId") == old_package.get("packageId")
            and old_ticket.get("executionPackage") == old_package_binding
            and old_ticket_binding["path"] == PREDECESSOR_ROOT + "/training-ticket.json"
            and recovery["predecessorTicketConsumption"]["path"]
                == PREDECESSOR_ROOT + "/training-ticket-consumed.json",
            "V25 old execution was not consumed consistently")
    snapshot_spec = base._binding(recovery.get("historicalSpecification"), "historical 1.32")
    require(snapshot_spec["sha256"] == previous["formalSpecification"]["sha256"]
            and b"AI-PAINTER-SPEC-1.32" in reader.read(snapshot_spec),
            "V25 historical specification differs")
    snapshot_worker = base._binding(recovery.get("historicalWorker"), "historical V25 worker")
    require(snapshot_worker["sha256"] == old_package["programBindings"]["worker"]["sha256"],
            "V25 historical worker differs")
    original = ast.parse(reader.read(snapshot_worker))
    current = ast.parse(Path(__file__).read_bytes())
    for name in ("fresh_networks", "run_cli"):
        old_function = next(node for node in original.body if isinstance(node, ast.FunctionDef) and node.name == name)
        new_function = next(node for node in current.body if isinstance(node, ast.FunctionDef) and node.name == name)
        require(ast.dump(old_function, include_attributes=False)
                == ast.dump(new_function, include_attributes=False),
                "V25 recovery changed protected training function " + name)
    return failure_binding


def _source_candidate(reader, policy):
    validate_recovery_policy(reader, policy)
    proposal = reader.json(base._binding(policy.get("cpuProposal"), "V25 proposal"))
    require(proposal.get("schemaVersion")
            == "stage4-mvp256-dry-v25-head-dropout-cpu-candidate-v1"
            and proposal.get("status")
            == "cpu_only_inactive_not_execution_qualified"
            and proposal.get("predecessor", {}).get("checkpointMayInitializeV25") is False
            and proposal.get("predecessor", {}).get("historicalGpuQualificationMayBeReused") is False,
            "V25 CPU proposal boundary differs")
    parent_binding = base._binding(policy.get("predecessorCandidate"),
                                   "V24 source candidate")
    require(parent_binding == proposal["predecessor"]["candidateContract"],
            "V25 predecessor identity differs")
    parent = reader.json(parent_binding)
    base.validate_candidate_contract(parent)
    require(policy.get("executionCeiling") == base.RESOURCE_CEILING
            and policy.get("checkpointSelection") == parent["checkpointSelection"]
            and policy.get("dataUse") == parent["dataUse"]
            and policy.get("scope") == parent["scope"]
            and policy.get("singleChange") == proposal["singleChange"]
            and policy.get("activation") == {
                "cpuAcceptanceCompleted": True,
                "gpuQualificationAllowed": True,
                "trainingAllowed": False,
                "formalStage4QualificationAllowed": False,
                "runtimePublicationAllowed": False,
            },
            "V25 inherited contract differs")
    return proposal, parent


def authenticate_training_gate(ticket_binding, *, root=ROOT, check_process=True):
    """Rehash V25-specific acyclic package, GPU, lock, launch, and ticket."""
    reader = _bound_reader(root)
    ticket_binding = base._binding(ticket_binding, "V25 ticket")
    ticket = reader.json(ticket_binding)
    require(ticket.get("schemaVersion") == TICKET_SCHEMA
            and ticket.get("status") == "issued_single_use"
            and ticket.get("capabilityVersion") == CAPABILITY
            and ticket.get("trainingAllowed") is True
            and ticket.get("automaticRetries") == 0
            and ticket.get("formalStage4QualificationAllowed") is False
            and ticket.get("runtimePublicationAllowed") is False,
            "V25 single-use training ticket required")
    package_binding = base._binding(ticket.get("executionPackage"), "V25 package")
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
            "V25 managed base package differs")
    run_id, package_id = package.get("runId"), package.get("packageId")
    require(all(isinstance(value, str) and 8 <= len(value) <= 128
                and all(char.isalnum() or char in "_-" for char in value)
                for value in (run_id, package_id)), "invalid V25 run identity")
    programs = package.get("programBindings")
    require(isinstance(programs, dict)
            and all(programs.get(role, {}).get("path") == expected
                    for role, expected in PROGRAM_PATHS.items()),
            "V25 program roles differ")
    for binding in programs.values():
        reader.read(base._binding(binding, "V25 program"))
    policy_binding = base._binding(package.get("candidateContract"), "V25 policy")
    require(policy_binding["path"] == POLICY_PATH,
            "V25 policy path differs")
    policy = reader.json(policy_binding)
    require(policy.get("schemaVersion") == POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == CAPABILITY,
            "V25 execution policy differs")
    proposal, parent = _source_candidate(reader, policy)
    require(package.get("sourceDataCandidate") == policy["predecessorCandidate"]
            and package.get("cpuAcceptance") == policy["cpuAcceptance"],
            "V25 package predecessor/CPU bindings differ")
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
            }, "V25 inherited data/review bindings differ")
    cpu_acceptance = reader.json(base._binding(policy.get("cpuAcceptance"),
                                               "V25 CPU acceptance"))
    require(cpu_acceptance.get("status") == "v25_cpu_acceptance_passed"
            and cpu_acceptance.get("policyCandidate") == policy["cpuProposal"]
            and cpu_acceptance.get("specification") == policy["formalSpecification"]
            and cpu_acceptance.get("optimizerSteps") == 0
            and cpu_acceptance.get("gpuInitialized") is False,
            "V25 CPU acceptance differs")
    for binding in cpu_acceptance.get("tests", []) + cpu_acceptance.get("programs", []):
        reader.read(base._binding(binding, "V25 CPU-tested program"))
    specification = reader.read(base._binding(policy.get("formalSpecification"),
                                             "V25 formal specification"))
    require(b"AI-PAINTER-SPEC-1.33" in specification,
            "V25 formal specification version differs")
    output_root = package.get("outputRoot")
    require(isinstance(output_root, str)
            and output_root.startswith(OUTPUT_PARENT + "/")
            and all(part not in ("", ".", "..") for part in output_root.split("/"))
            and "\\" not in output_root
            and package_binding["path"] == output_root + "/execution-package.json"
            and ticket_binding["path"] == output_root + "/training-ticket.json",
            "isolated V25 output root required")
    require(ticket.get("runId") == run_id and ticket.get("packageId") == package_id
            and ticket.get("consumptionClaimPath")
            == output_root + "/training-ticket-consumed.json",
            "V25 ticket identity differs")
    gpu_binding = base._binding(ticket.get("gpuQualification"), "V25 GPU gate")
    require(gpu_binding["path"] == output_root + "/zero-update-gpu-qualification.json",
            "V25 GPU gate path differs")
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
            and gpu.get("trainingModeStochasticityObserved") is True
            and gpu.get("caseCount") == 48
            and gpu.get("generatorAutogradGradCalls") == 192
            and gpu.get("discriminatorAutogradGradCalls") == 48
            and gpu.get("finalStateSha256") == gpu.get("initialStateSha256")
            and isinstance(cases, list) and len(cases) == 48
            and [row.get("case", {}).get("sampleId") for row in cases] == train_ids
            and all(row.get("passed") is True
                    and row.get("dropoutTrainingMode") is True
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
            "V25 current-candidate GPU gate differs")
    lock_binding = base._binding(ticket.get("managedLock"), "V25 managed lock")
    launch_binding = base._binding(ticket.get("launchIdentity"), "V25 launch")
    require(lock_binding["path"] == output_root + "/managed-training-lock.json"
            and launch_binding["path"]
                == output_root + "/supervisor-launch-identity.json",
            "V25 lock/launch paths differ")
    lock, launch = reader.json(lock_binding), reader.json(launch_binding)
    require(lock.get("schemaVersion") == LOCK_SCHEMA
            and lock.get("status") == "active_bound_single_attempt"
            and lock.get("runId") == run_id and lock.get("packageId") == package_id
            and lock.get("executionPackage") == package_binding
            and lock.get("resourceBudget") == base.RESOURCE_CEILING,
            "V25 managed lock differs")
    require(launch.get("schemaVersion") == LAUNCH_SCHEMA
            and launch.get("status") == "managed_supervisor_identity_verified"
            and launch.get("runId") == run_id and launch.get("packageId") == package_id
            and launch.get("executionPackage") == package_binding
            and launch.get("managedLock") == lock_binding
            and type(launch.get("processId")) is int and launch["processId"] > 0
            and isinstance(launch.get("processStartIdentity"), str)
            and launch["processStartIdentity"].startswith(str(launch["processId"]) + ":"),
            "V25 supervisor launch differs")
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
                "V25 current managed execution differs")
        heartbeat_path = base.v24.core.cpu.project_file(
            root, active.get("heartbeat", {}).get("path", ""))
        heartbeat = json.loads(heartbeat_path.read_bytes())
        require(heartbeat.get("runId") == run_id
                and heartbeat.get("processId") == pid
                and heartbeat.get("processStartIdentity") == identity
                and time.time() < datetime.fromisoformat(
                    heartbeat["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp()
                    + 120,
                "V25 managed heartbeat stale or changed")
        active_lock = reader.json(base._binding(active.get("lock"),
                                                "V25 current active lock"))
        require(active_lock.get("runId") == run_id
                and active_lock.get("packageId") == package_id
                and active_lock.get("processId") == pid
                and active_lock.get("processStartIdentity") == identity,
                "V25 current active lock differs")
        require(base.managed_worker.process_identity(pid) == identity,
                "V25 supervisor exited or PID reused")
        rows = base.managed_worker.read_process_chain(os.getpid(), pid)
        base.managed_worker.validate_process_chain(rows, pid, identity)
        require(rows == base.managed_worker.read_process_chain(os.getpid(), pid),
                "V25 process chain changed during authentication")
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
            "V25 terminal path differs")
    consumed = base.consume_training_ticket(
        authenticated, capability=CAPABILITY,
        claim_schema="ai-painter-stage4-mvp256-dry-v25-ticket-consumption-v1")
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
                * 1024 * 1024, "V25 insufficient VRAM below bounded allocation")
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
            network_factory=fresh_networks, identity=IDENTITY)
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
    require(not (args.run and args.cpu_preflight), "V25 mode ambiguous")
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
            "V25 run requires ticket binding and output")
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

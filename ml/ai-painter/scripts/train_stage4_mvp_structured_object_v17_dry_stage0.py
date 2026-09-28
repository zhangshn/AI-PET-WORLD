"""Single-use V17 dry-slice worker, launched by the local registry supervisor.

--preflight verifies bytes and metadata on CPU; it never decodes sample tensors.
Execution additionally requires a consumed local ticket, live supervisor/lock and
matching active registry. Read-only qualification alone cannot admit training.
No historical weights, retries, registry writes, review or publication occur here.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import io
import json
import math
import os
from pathlib import Path
import random
import re
import subprocess
import sys
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import run_stage4_mvp_structured_object_v17_readonly_gpu_qualification as gpu

cpu = gpu.cpu
require = gpu.require
exact = gpu.exact
CAPABILITY = gpu.CAPABILITY
WORKER_PATH = "ml/ai-painter/scripts/train_stage4_mvp_structured_object_v17_dry_stage0.py"
TEST_PATH = "ml/ai-painter/tests/test_stage4_mvp_structured_object_v17_worker_gate.py"
SUPERVISOR_PATH = "scripts/run-ai-painter-stage4-mvp-v17-dry-training.mjs"
PACKAGE_SCHEMA = "ai-painter-stage4-mvp-structured-object-v17-dry-stage0-execution-package-v1"
TICKET_SCHEMA = "ai-painter-stage4-mvp-structured-object-v17-training-execution-ticket-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-structured-object-v17-dry-stage0-checkpoint-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-structured-object-v17-dry-stage0-training-terminal-v1"
OUTPUT_PREFIX = ".runtime/ai-painter/stage4-mvp-structured-object-v17-dry-executions/"
REGISTRY_PATH = ".runtime/ai-painter/current-execution-registry/current.json"
CANDIDATE = {"path": "data/ai-painter/system-governance/stage4-mvp-native-rgb-structured-object-v17-contract-v1.json",
             "sha256": "514b8163b89f529dcef5d51c5a5b03bbefe72c709560de7ccdb146ad2cc921a2"}
GPU_REPORT = {"path": gpu.OUTPUT_ROOT + "/attempt-81ad75572c0e2c36adee3ea4f3667aec9c3a1d16bfe8d943b7a1c9ff35927913/report.json",
              "sha256": "43cbd563bc6dcceccb97d26d32b4f4828e9b5af53ee4aabf64c40c169ed81e6b"}
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 24}
BUDGET = {"maxGpuMemoryFraction": 0.7, "maxEpochs": 24, "maxGeneratorSteps": 1152,
          "maxDiscriminatorSteps": 1152, "timeoutSeconds": 43200, "cpuThreads": 2,
          "automaticRetries": 0}
OPTIMIZER_PLAN = {"name": "AdamW", "generatorLearningRate": 0.0001,
                  "discriminatorLearningRate": 0.0001, "weightDecay": 0.01,
                  "betas": [0.9, 0.999], "eps": 1e-8}
MIRROR_FIELDS = ("runId", "packageId", "batchRunId", "capabilityVersion", "candidateContract",
    "cpuQualification", "gpuQualification", "datasetManifest", "dryScope", "modelPlan",
    "precisionExecutionPlan", "stage", "resourceBudget", "optimizerPlan", "programBindings",
    "ticketConsumptionRequired", "permittedSplits", "forbiddenSplits", "outputRoot",
    "outputTerminalPath", "formalStage0QualificationAllowed", "runtimePublicationAllowed")


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(path):
    return {"path": path, "sha256": cpu.sha(cpu.project_file(ROOT, path).read_bytes())}


def validate_package(package, ticket):
    require(package.get("schemaVersion") == PACKAGE_SCHEMA and ticket.get("schemaVersion") == TICKET_SCHEMA,
            "independent V17 execution package and training ticket required")
    require(ticket.get("status") == "issued_single_use" and isinstance(ticket.get("ticketId"), str)
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{7,127}", ticket["ticketId"]), "invalid single-use ticket")
    for key in MIRROR_FIELDS:
        require(key in package and key in ticket and exact(package[key], ticket[key]), "ticket/package mismatch: " + key)
    for key in ("runId", "packageId", "batchRunId"):
        require(isinstance(package[key], str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{7,127}", package[key]),
                "invalid run/package identity: " + key)
    expected = {"capabilityVersion": CAPABILITY, "candidateContract": CANDIDATE,
        "gpuQualification": GPU_REPORT, "datasetManifest": cpu.MANIFEST, "dryScope": gpu.SCOPE,
        "modelPlan": gpu.MODEL_PLAN, "precisionExecutionPlan": gpu.PRECISION_PLAN,
        "stage": STAGE, "resourceBudget": BUDGET, "optimizerPlan": OPTIMIZER_PLAN,
        "ticketConsumptionRequired": True, "permittedSplits": ["train", "validation"],
        "forbiddenSplits": ["challenge", "regression"], "formalStage0QualificationAllowed": False,
        "runtimePublicationAllowed": False}
    for key, value in expected.items():
        require(exact(package.get(key), value), "training plan/boundary differs: " + key)
    output = package["outputRoot"]
    require(isinstance(output, str) and output.startswith(OUTPUT_PREFIX)
            and output.split("/")[-1] == package["runId"]
            and all(part not in ("", ".", "..") for part in output.split("/"))
            and "\\" not in output, "invalid isolated output root")
    cpu.project_file(ROOT, output + "/phase-terminal.json")
    require(package["outputTerminalPath"] == output + "/phase-terminal.json"
            and gpu.binding(package.get("trainingExecutionTicket"))["path"] == output + "/training-ticket.json",
            "ticket or terminal escaped this run")
    programs = package["programBindings"]
    require(isinstance(programs, dict), "program bindings missing")
    for role, path in {"worker": WORKER_PATH, "workerTests": TEST_PATH, "supervisor": SUPERVISOR_PATH}.items():
        require(gpu.binding(programs.get(role))["path"] == path, "program role/path differs: " + role)
    baseline = ticket.get("registryBeforeStart", {})
    require(type(baseline.get("registryRevision")) is int and baseline["registryRevision"] >= 0
            and baseline.get("activeExecution", "missing") is None
            and isinstance(baseline.get("registrySha256"), str)
            and re.fullmatch(r"[a-f0-9]{64}", baseline["registrySha256"]), "inactive registry snapshot missing")


def validate_gpu_report(report, candidate, acceptance, package):
    require(report.get("schemaVersion") == gpu.REPORT_SCHEMA
            and report.get("status") == "readonly_gpu_qualification_passed_training_still_disabled"
            and report.get("capabilityVersion") == CAPABILITY
            and exact(report.get("candidateContract"), package["candidateContract"])
            and exact(report.get("cpuAcceptance"), package["cpuQualification"])
            and report.get("implementationIdentitySha256") == gpu.implementation_identity(candidate)
            and exact(report.get("precisionExecutionPlan"), gpu.PRECISION_PLAN), "GPU qualification identity differs")
    for key, value in {"optimizerCreated": False, "optimizerSteps": 0, "checkpointLoaded": False,
        "checkpointWritten": False, "weightsModified": False, "gpuInitialized": True,
        "generatorBackwardCalls": 1, "discriminatorBackwardCalls": 1,
        "trainingAllowedByThisArtifact": False, "stage4QualificationGranted": False,
        "validationRgbOrChannelPixelsRead": False, "challengeContentRead": False,
        "regressionContentRead": False, "registryWritten": False}.items():
        require(exact(report.get(key), value), "GPU qualification boundary differs: " + key)
    require(report.get("attemptId") == candidate["readonlyGpuQualification"]["attemptId"], "GPU attempt differs")
    for network in ("Model", "Critic"):
        initial, final = "initial" + network + "StateSha256", "final" + network + "StateSha256"
        require(report.get(initial) == report.get(final) == acceptance[initial], "GPU/CPU initial state differs")
    sample = report.get("sampleIdentity", {})
    require(sample.get("sampleId") == gpu.TRAIN_ID and sample.get("split") == "train"
            and type(sample.get("ordinal")) is int and sample["ordinal"] == gpu.TRAIN_ORDINAL,
            "GPU positive train identity differs")
    for role in gpu.ROLES:
        count = report.get("positiveRolePixelCounts", {}).get(role)
        gradient = report.get("responsibilityGradients", {}).get(role, {}).get("maskedGradientAbsoluteSum")
        require(type(count) is int and count > 0 and type(gradient) in (int, float)
                and math.isfinite(gradient) and gradient > 0, "GPU responsibility evidence missing: " + role)
    measurements = report.get("memoryMeasurements")
    require(isinstance(measurements, list) and measurements, "GPU memory evidence missing")
    for item in measurements:
        observed = {"total": item["totalBytes"], "reserved": item["peakReservedBytes"],
            "allocated": item["peakAllocatedBytes"], "device_used": item["sampledDeviceUsedBytes"]}
        measured = gpu.check_memory(**observed, fraction=BUDGET["maxGpuMemoryFraction"])
        require(exact(item["limitBytes"], measured["limitBytes"])
                and exact(item.get("observed"), observed), "GPU memory evidence fields disagree")


def validate_idle_registry(registry):
    require(registry.get("schemaVersion") == "ai-painter-current-execution-registry-v1"
            and "activeExecution" in registry and registry["activeExecution"] is None
            and registry.get("executionState") not in ("executing", "running")
            and type(registry.get("registryRevision")) is int, "registry is not an inactive baseline")


def process_identity(pid):
    require(type(pid) is int and pid > 0, "invalid supervisor PID")
    command = ("$p=Get-CimInstance Win32_Process -Filter 'ProcessId = " + str(pid)
        + "'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')")
    result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
        capture_output=True, text=True, check=True, timeout=10,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return result.stdout.strip()


def read_process_chain(worker_pid, supervisor_pid):
    """Read at most self -> exact venv launcher -> registered supervisor."""
    require(all(type(pid) is int and pid > 0 for pid in (worker_pid, supervisor_pid)), "invalid process-chain PID")
    command = ("$taskPid=" + str(worker_pid) + "; $rows=@(); for($i=0;$i -lt 3;$i++){"
        "$p=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$taskPid); if($null -eq $p){exit 3};"
        "$rows += [pscustomobject]@{pid=[int]$p.ProcessId; parentPid=[int]$p.ParentProcessId;"
        "executablePath=$p.ExecutablePath; createdAtUtc=$p.CreationDate.ToUniversalTime().ToString('o')};"
        "if($taskPid -eq " + str(supervisor_pid) + "){break}; $taskPid=[int]$p.ParentProcessId };"
        "ConvertTo-Json -InputObject @($rows) -Compress")
    result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
        capture_output=True, text=True, check=True, timeout=10,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return json.loads(result.stdout)


def validate_process_chain(rows, supervisor_pid, supervisor_identity, *, worker_pid=None, worker_parent=None):
    worker_pid = os.getpid() if worker_pid is None else worker_pid
    worker_parent = os.getppid() if worker_parent is None else worker_parent
    require(isinstance(rows, list) and len(rows) in (2, 3), "unexpected supervisor ancestry depth")
    require(all(isinstance(row, dict) and type(row.get("pid")) is int and row["pid"] > 0
                and type(row.get("parentPid")) is int and row["parentPid"] >= 0
                and isinstance(row.get("createdAtUtc"), str)
                and isinstance(row.get("executablePath"), str) and row["executablePath"] for row in rows),
            "incomplete process-chain evidence")
    require(len({row["pid"] for row in rows}) == len(rows)
            and rows[0]["pid"] == worker_pid and rows[0]["parentPid"] == worker_parent
            and rows[-1]["pid"] == supervisor_pid
            and all(child["parentPid"] == parent["pid"] for child, parent in zip(rows, rows[1:])),
            "worker is not the registered supervisor's direct or venv child")
    require(str(supervisor_pid) + ":" + rows[-1]["createdAtUtc"] == supervisor_identity,
            "supervisor exited or PID reused in process chain")
    normalize = lambda value: os.path.normcase(os.path.abspath(str(value)))
    venv_python = normalize(ROOT / "ml/ai-painter/.venv/Scripts/python.exe")
    allowed_worker = {venv_python, normalize(getattr(sys, "_base_executable", sys.executable))}
    require(normalize(rows[0]["executablePath"]) in allowed_worker, "worker executable differs from venv runtime")
    if len(rows) == 3:
        require(normalize(rows[1]["executablePath"]) == venv_python, "intermediate process is not the exact venv launcher")
    created = [datetime.fromisoformat(row["createdAtUtc"].replace("Z", "+00:00")) for row in rows]
    require(all(value.tzinfo is not None for value in created)
            and all(child >= parent for child, parent in zip(created, created[1:]))
            and (created[0] - datetime.now(timezone.utc)).total_seconds() <= 5,
            "process creation order differs; parent PID may have been reused")
    return rows


def validate_active(registry, package, package_binding, baseline, lock, heartbeat, *, check_process=True):
    active = registry.get("activeExecution")
    require(registry.get("schemaVersion") == "ai-painter-current-execution-registry-v1"
            and isinstance(active, dict) and registry.get("executionState") == "executing"
            and type(registry.get("registryRevision")) is int
            and registry["registryRevision"] > baseline["registryRevision"]
            and registry.get("supersedes", {}).get("registryRevision") == baseline["registryRevision"]
            and registry.get("supersedes", {}).get("currentSha256") == baseline["registrySha256"]
            and exact(active.get("programLineage"), package["programBindings"]), "active registry/package mismatch")
    for key in ("capabilityVersion", "runId", "packageId"):
        require(registry.get(key) == active.get(key) == lock.get(key) == heartbeat.get(key) == package[key],
                "active execution identity differs: " + key)
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
            and heartbeat.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1"
            and active.get("executionState") == heartbeat.get("executionState") == "executing"
            and exact(heartbeat.get("ttlSeconds"), 120), "lock/heartbeat boundary differs")
    for key in ("processId", "processStartIdentity"):
        require(active.get(key) == lock.get(key) == heartbeat.get(key), "supervisor process identity differs")
    require(type(active.get("processId")) is int and active["processId"] > 0
            and isinstance(active.get("processStartIdentity"), str)
            and active["processStartIdentity"].startswith(str(active["processId"]) + ":"), "supervisor identity missing")
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00"))).total_seconds()
    require(-5 <= age <= 120, "supervisor heartbeat expired or future")
    if check_process:
        require(process_identity(active["processId"]) == active["processStartIdentity"], "supervisor exited or PID reused")
        rows = read_process_chain(os.getpid(), active["processId"])
        validate_process_chain(rows, active["processId"], active["processStartIdentity"])
        # Requery after validation: an exited/replaced launcher cannot certify a
        # stale parent edge. No arbitrary deeper ancestor is accepted.
        require(exact(rows, read_process_chain(os.getpid(), active["processId"])),
                "process chain changed while validating supervisor")
        return rows


def current_registry(package, package_binding, baseline, reader, *, preflight=False):
    raw = cpu.project_file(ROOT, REGISTRY_PATH).read_bytes()
    registry = json.loads(raw)
    if preflight:
        validate_idle_registry(registry)
        require(registry["registryRevision"] == baseline["registryRevision"]
                and cpu.sha(raw) == baseline["registrySha256"], "registry changed since ticket baseline")
        return registry
    active = registry.get("activeExecution") or {}
    lock_binding = gpu.binding(active.get("lock"))
    require(lock_binding["path"] == package["outputRoot"] + "/execution-lock.json"
            and exact(active.get("heartbeat"), {"path": package["outputRoot"] + "/heartbeat.json", "ttlSeconds": 120}),
            "registered lock or heartbeat path differs")
    lock = reader.json(lock_binding)
    heartbeat = json.loads(cpu.project_file(ROOT, active["heartbeat"]["path"]).read_bytes())
    terminal = registry.get("terminalEvidence", {})
    dispatch_binding = gpu.binding({"path": terminal.get("path"), "sha256": terminal.get("sha256")})
    require(registry.get("packageSha256") == dispatch_binding["sha256"], "registry dispatch SHA differs")
    dispatch = reader.json(dispatch_binding)
    require(dispatch.get("executionPackage") == package_binding
            and dispatch.get("trainingExecutionTicket") == package["trainingExecutionTicket"]
            and dispatch.get("runId") == package["runId"] and dispatch.get("packageId") == package["packageId"]
            and terminal.get("status") == dispatch.get("status") == "bounded_dry_training_dispatched",
            "registered dispatch does not bind this package/ticket")
    chain = validate_active(registry, package, package_binding, baseline, lock, heartbeat)
    return {**registry, "workerProcessChainEvidence": chain}


def authenticate(package_binding, *, preflight=False):
    reader = cpu.BoundReader()
    package = reader.json(gpu.binding(package_binding))
    ticket = reader.json(gpu.binding(package.get("trainingExecutionTicket")))
    validate_package(package, ticket)
    for value in package["programBindings"].values():
        reader.read(gpu.binding(value))
    candidate = reader.json(package["candidateContract"])
    acceptance = reader.json(package["cpuQualification"])
    gpu.validate_gate(candidate, acceptance, candidate_binding=package["candidateContract"],
        cpu_binding=package["cpuQualification"], attempt_id=candidate["readonlyGpuQualification"]["attemptId"],
        output_root=gpu.OUTPUT_ROOT)
    for value in gpu.declared_bindings(candidate):
        reader.read(value)
    report = reader.json(package["gpuQualification"])
    validate_gpu_report(report, candidate, acceptance, package)
    # Raw source bytes are rehashed; no PNG decoding or tensors during preflight.
    for value in report["sourceBindingsRecomputed"]:
        reader.read(gpu.binding(value))
    scope = gpu.verify_dry_scope(reader)
    manifest, order, continuous, _, memberships = cpu.select_rows(reader)
    require(manifest.get("qualification", {}).get("dataQualifiedForTraining") is True
            and exact(candidate["datasetBinding"]["sourceIndex"], manifest["sourceIndex"])
            and exact(candidate["datasetBinding"]["splits"], manifest["splits"]), "dataset release differs")
    source = reader.json(manifest["sourceIndex"])
    by_id = {row["sampleId"]: row for row in source["samples"]}
    rows = {}
    for split in cpu.COUNTS:
        require(memberships[split]["selectionSha256"] == candidate["datasetBinding"][split + "SelectionSha256"],
                "selected rows differ: " + split)
        if split in ("train", "validation"):
            ids = reader.json(manifest["splits"][split])["sampleIds"]
            rows[split] = [by_id[key] for key in ids]
    baseline = ticket["registryBeforeStart"]
    registry = current_registry(package, package_binding, baseline, reader, preflight=preflight)
    reader.unchanged()
    return {"reader": reader, "package": package, "ticket": ticket, "candidate": candidate,
        "acceptance": acceptance, "gpuReport": report, "scope": scope, "order": order,
        "continuous": continuous, "rows": rows, "baseline": baseline, "registry": registry}


def write_exclusive(path, value):
    with path.open("x", encoding="utf8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def atomic_bytes(path, data, *, replace=False):
    require(replace or not path.exists(), "artifact already exists; retry forbidden")
    temporary = path.with_name(path.name + ".staged-" + uuid4().hex)
    # A failed temporary is retained as failure evidence.
    with temporary.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def atomic_json(path, value, *, replace=False):
    atomic_bytes(path, (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf8"), replace=replace)


def load_splits(context, progress):
    result, identities = {}, {}
    for split in ("train", "validation"):
        result[split], identities[split] = [], []
        for ordinal, row in enumerate(context["rows"][split]):
            require(row["split"] == split, "cross-split content prohibited")
            sample, identity = cpu.load_sample(context["reader"], row, context["order"], context["continuous"])
            identity["ordinal"] = ordinal
            identity["tensorHashes"] = {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")}
            result[split].append(sample)
            identities[split].append(identity)
            progress("loading_" + split, loadedSamples=ordinal + 1)
    return result, identities


def update_network(optimizer, loss, network, sample, name, counts, limit, check_resource):
    import torch
    require(sample.get("split") == "train", "validation/held-out optimizer update prohibited")
    require(counts[name] < limit, "optimizer step budget exhausted")
    require(bool(torch.isfinite(loss).all()), "nonfinite loss: " + name)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    gpu.gradient_facts(network, next(network.parameters()).device.type)
    check_resource()
    optimizer.step()
    counts[name] += 1  # Preserve a completed update even if its result is invalid.
    for parameter_name, parameter in network.named_parameters():
        require(bool(torch.isfinite(parameter).all()), "nonfinite parameter after step: " + name + "/" + parameter_name)
    for state in optimizer.state.values():
        for value in state.values():
            if isinstance(value, torch.Tensor):
                require(bool(torch.isfinite(value).all()), "nonfinite optimizer state: " + name)
    check_resource()


def validate_samples(model, samples, order, measure):
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import validation_structured_object_score
    model.eval()
    before = cpu.state_hash(model)
    metrics = []
    device = next(model.parameters()).device
    with torch.no_grad():
        for sample in samples:
            require(sample.get("split") == "validation", "selection may read validation only")
            bound = {**sample, "image": sample["image"].to(device), "conditions": sample["conditions"].to(device)}
            with torch.autocast(device.type, dtype=torch.bfloat16):
                predicted = model(bound["conditions"][None], sample["objectInstanceTable"])
                score, _ = validation_structured_object_score(predicted, bound, sample["objectInstanceTable"], order)
            value = float(score)
            require(math.isfinite(value), "nonfinite validation score")
            metrics.append({"sampleId": sample["sampleId"], "score": value})
            measure()
    require(metrics and before == cpu.state_hash(model), "validation changed model state")
    return sum(row["score"] for row in metrics) / len(metrics), metrics


def checkpoint(path, model, critic, metadata):
    import torch
    payload = {**metadata, "schemaVersion": CHECKPOINT_SCHEMA,
        "modelState": {key: value.detach().cpu().clone() for key, value in model.state_dict().items()},
        "criticState": {key: value.detach().cpu().clone() for key, value in critic.state_dict().items()},
        "modelStateSha256": cpu.state_hash(model), "criticStateSha256": cpu.state_hash(critic)}
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    atomic_bytes(path, buffer.getvalue())
    return payload["modelStateSha256"], payload["criticStateSha256"]


def run(package_binding):
    context = authenticate(package_binding)
    package, reader = context["package"], context["reader"]
    directory = cpu.project_file(ROOT, package["outputRoot"])
    require(not any((directory / name).exists() for name in
        ("worker-started.json", "phase-terminal.json", "progress.json", "epochs")), "worker already consumed; retry forbidden")
    started = time.monotonic()
    counts = {"generator": 0, "discriminator": 0}
    state = {"schemaVersion": TERMINAL_SCHEMA, "status": "failed_closed", "capabilityVersion": CAPABILITY,
        "runId": package["runId"], "packageId": package["packageId"], "batchRunId": package["batchRunId"],
        "executionPackage": package_binding, "trainingExecutionTicket": package["trainingExecutionTicket"],
        "candidateContract": package["candidateContract"], "cpuQualification": package["cpuQualification"],
        "gpuQualification": package["gpuQualification"], "datasetManifest": cpu.MANIFEST,
        "dryScope": gpu.SCOPE, "stage": STAGE, "precisionExecutionPlan": gpu.PRECISION_PLAN,
        "processId": os.getpid(), "parentProcessId": os.getppid(), "gpuStarted": False,
        "supervisorProcessChain": context["registry"].get("workerProcessChainEvidence"),
        "completedEpochs": 0, "stagePassed": False, "stage4QualificationGranted": False,
        "runtimePublicationAllowed": False, "automaticRetryStarted": False,
        "challengeContentRead": False, "regressionContentRead": False, "registryWritten": False}
    write_exclusive(directory / "worker-started.json", {**state, "startedAtUtc": utc_now()})
    attempted = None
    last_registry_check = 0.0

    def live_check(force=False):
        nonlocal last_registry_check
        require(time.monotonic() - started < BUDGET["timeoutSeconds"], "training wall time exhausted")
        if force or time.monotonic() - last_registry_check >= 15:
            current_registry(package, package_binding, context["baseline"], reader)
            last_registry_check = time.monotonic()

    def progress(phase, **extra):
        live_check()
        atomic_json(directory / "progress.json", {"capabilityVersion": CAPABILITY, "runId": package["runId"],
            "packageId": package["packageId"], "processId": os.getpid(), "phase": phase,
            "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
            "completedEpochs": state["completedEpochs"], "updatedAtUtc": utc_now(), **extra}, replace=True)

    try:
        import torch
        from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import build_native_rgb_structured_object_cpu_v17
        from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
        from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import train_structured_object_objective
        torch.set_num_threads(2)
        torch.manual_seed(gpu.MODEL_PLAN["seed"])
        model = build_native_rgb_structured_object_cpu_v17(condition_channel_order=context["order"],
            base_channels=48, patch_channels=32)
        critic = build_conditional_texture_discriminator()
        for name, network in (("Model", model), ("Critic", critic)):
            digest = cpu.state_hash(network)
            require(digest == context["acceptance"]["initial" + name + "StateSha256"], "fresh training state differs: " + name)
            state["initial" + name + "StateSha256"] = digest
        samples, identities = load_splits(context, progress)
        atomic_json(directory / "sample-identities.json", identities)
        reader.unchanged()
        live_check(force=True)
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(), "CUDA BF16 unavailable")
        device = torch.device("cuda:0")
        torch.cuda.set_device(device)
        state["gpuStarted"] = True
        torch.cuda.manual_seed_all(gpu.MODEL_PLAN["seed"])
        free, total = torch.cuda.mem_get_info(device)
        allocator_bytes = int(total * 0.7) - (total - free) - 64 * 1024 * 1024
        require(allocator_bytes > 0, "insufficient memory below 70 percent ceiling")
        torch.cuda.set_per_process_memory_fraction(allocator_bytes / total, device)
        torch.cuda.reset_peak_memory_stats(device)
        state["allocatorBudgetBytes"] = allocator_bytes

        def measure():
            live_check()
            torch.cuda.synchronize(device)
            available, capacity = torch.cuda.mem_get_info(device)
            observation = {"total": int(capacity), "reserved": int(torch.cuda.max_memory_reserved(device)),
                "allocated": int(torch.cuda.max_memory_allocated(device)), "device_used": int(capacity - available)}
            state["lastMemoryObservation"] = observation
            state["memory"] = gpu.check_memory(**observation, fraction=0.7)

        model.to(device)
        critic.to(device)
        measure()
        optimizer_args = {"betas": tuple(OPTIMIZER_PLAN["betas"]), "eps": OPTIMIZER_PLAN["eps"],
                          "weight_decay": OPTIMIZER_PLAN["weightDecay"], "foreach": False, "fused": False}
        generator_optimizer = torch.optim.AdamW(model.parameters(), lr=0.0001, **optimizer_args)
        critic_optimizer = torch.optim.AdamW(critic.parameters(), lr=0.0001, **optimizer_args)
        epochs = directory / "epochs"
        epochs.mkdir(exist_ok=False)
        best_score, best_epoch, selected = math.inf, None, None
        for epoch in range(1, 25):
            live_check(force=True)
            reader.unchanged()
            model.train()
            critic.train()
            indices = list(range(48))
            random.Random(gpu.MODEL_PLAN["seed"] + epoch).shuffle(indices)
            train_metrics = []
            for index in indices:
                sample = samples["train"][index]
                measure()
                bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
                attempted = {"epoch": epoch, "sampleId": sample["sampleId"], "network": "discriminator",
                             "attemptedStep": counts["discriminator"] + 1}
                generator_optimizer.zero_grad(set_to_none=True)
                critic.requires_grad_(True)
                with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                    detached = model(bound["conditions"][None], sample["objectInstanceTable"])
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    d_loss, _ = gpu.detached_discriminator_objective(critic, detached, bound)
                update_network(critic_optimizer, d_loss, critic, bound, "discriminator", counts, 1152, measure)
                require(all(p.grad is None for p in model.parameters()), "discriminator leaked generator gradients")
                critic_optimizer.zero_grad(set_to_none=True)
                critic.requires_grad_(False)
                attempted = {"epoch": epoch, "sampleId": sample["sampleId"], "network": "generator",
                             "attemptedStep": counts["generator"] + 1}
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    predicted = model(bound["conditions"][None], sample["objectInstanceTable"])
                    g_loss, _ = train_structured_object_objective(critic, predicted, bound,
                        sample["objectInstanceTable"], context["order"])
                update_network(generator_optimizer, g_loss, model, bound, "generator", counts, 1152, measure)
                require(all(p.grad is None for p in critic.parameters()), "generator leaked critic gradients")
                train_metrics.append({"sampleId": sample["sampleId"], "generatorLoss": float(g_loss.detach()),
                                      "discriminatorLoss": float(d_loss.detach())})
                attempted = None
                del predicted, detached, g_loss, d_loss, bound
                progress("training", epoch=epoch, sampleIndex=index)
            generator_optimizer.zero_grad(set_to_none=True)
            attempted = {"epoch": epoch, "network": "validation", "attemptedStep": 0}
            score, validation_metrics = validate_samples(model, samples["validation"], context["order"], measure)
            attempted = None
            require(counts["generator"] == counts["discriminator"] == epoch * 48, "epoch update count differs")
            path = epochs / f"epoch-{epoch:02d}.pt"
            metadata = {key: state[key] for key in ("capabilityVersion", "runId", "packageId", "executionPackage",
                "trainingExecutionTicket", "candidateContract", "cpuQualification", "gpuQualification", "datasetManifest",
                "dryScope", "precisionExecutionPlan", "initialModelStateSha256", "initialCriticStateSha256")}
            metadata.update(epoch=epoch, validationScore=score, modelPlan=gpu.MODEL_PLAN,
                optimizerStepsGenerator=counts["generator"], optimizerStepsDiscriminator=counts["discriminator"],
                formalInferenceEligible=False, checkpointPromotionEligible=False, automaticResumeAllowed=False)
            model_hash, critic_hash = checkpoint(path, model, critic, metadata)
            checkpoint_binding = bind(package["outputRoot"] + f"/epochs/epoch-{epoch:02d}.pt")
            if score < best_score:
                best_score, best_epoch, selected = score, epoch, checkpoint_binding
                state.update(selectedEpoch=epoch, selectedScore=score, checkpoint=selected,
                    modelStateSha256=model_hash, criticStateSha256=critic_hash)
            state["completedEpochs"] = epoch
            atomic_json(epochs / f"epoch-{epoch:02d}.json", {"epoch": epoch, "train": train_metrics,
                "validation": validation_metrics, "checkpoint": checkpoint_binding, "checkpointSelectionScore": score,
                "bestEpoch": best_epoch, "bestScore": best_score, "memory": state["memory"],
                "optimizerStepsGenerator": counts["generator"], "optimizerStepsDiscriminator": counts["discriminator"],
                "recordedAtUtc": utc_now()})
            progress("epoch_completed", epoch=epoch, bestEpoch=best_epoch, bestScore=best_score)
            print(json.dumps({"event": "epoch_completed", "epoch": epoch, "validationScore": score,
                "bestEpoch": best_epoch, "bestScore": best_score, "recordedAtUtc": utc_now()}), flush=True)
        require(counts == {"generator": 1152, "discriminator": 1152} and selected, "bounded training incomplete")
        state.update(finalTrainingModelStateSha256=cpu.state_hash(model), finalTrainingCriticStateSha256=cpu.state_hash(critic))
        for split in ("train", "validation"):
            for sample, identity in zip(samples[split], identities[split]):
                require(identity["tensorHashes"] == {key: cpu.tensor_hash(sample[key]) for key in ("image", "conditions")},
                        "source tensor changed during training: " + sample["sampleId"])
        saved = torch.load(io.BytesIO(reader.read(selected)), map_location="cpu", weights_only=True)
        require(saved["schemaVersion"] == CHECKPOINT_SCHEMA and saved["executionPackage"] == package_binding
                and saved["epoch"] == best_epoch and saved["validationScore"] == best_score,
                "selected checkpoint identity differs")
        model.load_state_dict(saved["modelState"], strict=True)
        critic.load_state_dict(saved["criticState"], strict=True)
        require(cpu.state_hash(model) == saved["modelStateSha256"] == state["modelStateSha256"]
                and cpu.state_hash(critic) == saved["criticStateSha256"] == state["criticStateSha256"],
                "safe checkpoint reload changed selected state")
        measure()
        reader.unchanged()
        live_check(force=True)
        state.update(status="training_completed_review_pending", executionState="completed",
            checkpointReloadVerified=True, machineReviewPending=True)
    except Exception as error:
        state.update(errorType=type(error).__name__, error=str(error), failureContext=attempted, executionState="failed_closed")
        for name in ("model", "critic"):
            if name in locals():
                try:
                    state["failure" + name.title() + "StateSha256"] = cpu.state_hash(locals()[name])
                except Exception as state_error:
                    state["failure" + name.title() + "StateHashError"] = str(state_error)
    state.update(optimizerStepsGenerator=counts["generator"], optimizerStepsDiscriminator=counts["discriminator"],
        trainingStarted=any(counts.values()), elapsedSeconds=time.monotonic() - started, recordedAtUtc=utc_now(),
        sourceBindingsRecomputed=[{"path": path, "sha256": digest} for path, digest in reader.observed.items()])
    atomic_json(directory / "progress.json", {**state, "phase": state["executionState"]}, replace=True)
    write_exclusive(directory / "phase-terminal.json", state)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    package_binding = {"path": args.execution_package.replace("\\", "/"), "sha256": args.execution_package_sha256}
    package = cpu.BoundReader().json(gpu.binding(package_binding))
    require(args.output.replace("\\", "/") == package.get("outputTerminalPath"), "CLI terminal differs from package")
    if args.preflight:
        context = authenticate(package_binding, preflight=True)
        print(json.dumps({"status": "cpu_preflight_passed_training_not_started", "executionPackage": package_binding,
            "implementationIdentitySha256": gpu.implementation_identity(context["candidate"]),
            "registryRevision": context["registry"]["registryRevision"], "trainSampleCount": 48,
            "validationSampleCount": 8, "trainingStarted": False, "sampleTensorsDecoded": False}))
        return 0
    result = run(package_binding)
    print(json.dumps({"status": result["status"], "terminal": bind(package["outputTerminalPath"])}), flush=True)
    return 0 if result["status"] == "training_completed_review_pending" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed_before_worker", "errorType": type(error).__name__,
                          "error": str(error)}), file=sys.stderr, flush=True)
        raise SystemExit(1)

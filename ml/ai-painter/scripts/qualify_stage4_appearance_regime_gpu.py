"""Current V28 train-mode, 48-row, zero-update GPU qualification."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
for entry in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

import painter_stage4_appearance_regime_checkpoint_worker as worker  # noqa: E402
base = worker.base
core = base.v24.core
SCHEMA = worker.GPU_SCHEMA
MAX_SECONDS = 600
MAX_REPORT_BYTES = 8 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_current(root, package, *, check_process=False):
    registry = json.loads((root / ".runtime/ai-painter/current-execution-registry/current.json")
                          .read_bytes())
    active = registry.get("activeExecution")
    require(isinstance(active, dict)
            and registry.get("runId") == package["runId"]
            and registry.get("packageId") == package["packageId"]
            and registry.get("capabilityVersion") == worker.CAPABILITY
            and registry.get("executionState") == "executing"
            and active.get("schemaVersion") == "ai-painter-current-active-execution-v1"
            and active.get("executionState") == "executing"
            and active.get("runId") == package["runId"]
            and active.get("packageId") == package["packageId"]
            and active.get("capabilityVersion") == worker.CAPABILITY,
            "V28 managed execution absent or changed")
    heartbeat = json.loads(core.cpu.project_file(
        root, active["heartbeat"]["path"]).read_bytes())
    require(active.get("programLineage") == package["programBindings"]
            and active["heartbeat"].get("ttlSeconds") == 120,
            "V28 current program lineage or heartbeat contract differs")
    require(heartbeat.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1"
            and heartbeat.get("capabilityVersion") == worker.CAPABILITY
            and heartbeat.get("executionState") == "executing"
            and heartbeat.get("packageId") == package["packageId"]
            and heartbeat.get("runId") == package["runId"]
            and heartbeat.get("processId") == active["processId"]
            and heartbeat.get("processStartIdentity") == active["processStartIdentity"]
            and heartbeat.get("ttlSeconds") == 120
            and datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp()
                <= time.time() + 300
            and time.time() < datetime.fromisoformat(
                heartbeat["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp() + 120,
            "V28 heartbeat stale or changed")
    reader = worker._bound_reader(root)
    lock = reader.json(base._binding(active["lock"], "managed execution lock"))
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
            and lock.get("capabilityVersion") == worker.CAPABILITY
            and lock.get("runId") == package["runId"]
            and lock.get("packageId") == package["packageId"]
            and lock.get("processId") == active["processId"]
            and lock.get("processStartIdentity") == active["processStartIdentity"],
            "V28 managed execution lock differs")
    if check_process:
        require(base.managed_worker.process_identity(active["processId"])
                == active["processStartIdentity"],
                "V28 supervisor exited or PID reused")
    reader.unchanged()


def check_package(binding, *, root=ROOT, check_registry=True):
    reader = worker._bound_reader(root)
    binding = base._binding(binding, "V28 base package")
    package = reader.json(binding)
    require(package.get("schemaVersion") == worker.PACKAGE_SCHEMA
            and package.get("status") == "issued_single_attempt"
            and package.get("capabilityVersion") == worker.CAPABILITY
            and package.get("trainingIntent") == "bounded_once"
            and package.get("trainingAllowed") is False
            and package.get("resourceBudget") == base.RESOURCE_CEILING
            and package.get("trainingPlan") == {
                "epochs": 48, "trainRows": 48, "validationRows": 8,
                "eligibleCheckpointEpochs": [24, 36, 48],
                "generatorOptimizerSteps": 2304,
                "discriminatorOptimizerSteps": 2304,
                "historicalCheckpointLoaded": False,
            }, "V28 inactive base package required")
    programs = package.get("programBindings")
    require(isinstance(programs, dict)
            and all(programs.get(role, {}).get("path") == path
                    for role, path in worker.PROGRAM_PATHS.items()),
            "V28 GPU program identity differs")
    worker.validate_program_bindings(reader, programs)
    policy_binding = base._binding(package.get("candidateContract"), "V28 policy")
    require(policy_binding["path"] == worker.POLICY_PATH,
            "V28 policy path differs")
    policy = reader.json(policy_binding)
    require(policy.get("schemaVersion") == worker.POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == worker.CAPABILITY,
            "V28 policy identity differs")
    _proposal, parent = worker._source_candidate(reader, policy, cpu_admission_only=True)
    acceptance = reader.json(base._binding(policy["cpuAcceptance"], "V28 lifecycle evidence"))
    require(all(acceptance["programBindings"].get(role) == program
                for role, program in programs.items()),
            "V28 GPU program differs from CPU-tested program")
    require(package.get("sourceDataCandidate") == policy["predecessorCandidate"]
            and package.get("cpuAcceptance") == policy["cpuAcceptance"]
            and package.get("modelCpuEvidence") == policy["modelCpuEvidence"]
            and programs == policy["programBindings"]
            and not any(k in package for k in ("gpuQualification", "trainingTicket", "managedLock", "launchIdentity")),
            "V28 package predecessor/CPU bindings differ")
    require(package.get("outputRoot", "").startswith(worker.OUTPUT_PARENT + "/")
            and binding["path"] == package["outputRoot"] + "/execution-package.json",
            "V28 package output root differs")
    require(package.get("datasetManifest") == parent["frozenBindings"]["datasetManifest"]
            and package.get("trainSplit") == parent["frozenBindings"]["trainSplit"]
            and package.get("validationSplit") == parent["frozenBindings"]["validationSplit"],
            "V28 inherited split bindings differ")
    for source in parent["frozenBindings"].values():
        reader.read(source)
    spec = reader.read(base._binding(policy.get("formalSpecification"), "V28 spec"))
    require(b"AI-PAINTER-SPEC-1.44" in spec, "V28 formal spec differs")

    manifest = reader.json(package["datasetManifest"])
    require(manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4}
            and manifest.get("qualification", {}).get("dataQualifiedForTraining") is True
            and manifest.get("qualification", {}).get("executionQualified") is False,
            "V28 dataset release qualification differs")
    reader.unchanged()
    if check_registry:
        read_current(root, package, check_process=True)
    return package, policy, parent


def probe_counters():
    return {kind + suffix: 0 for kind in ("forward", "generator", "discriminator")
            for suffix in ("Attempted", "Completed")}


def observe_probe(model, critic, sample, order, resource, counters, *,
                  probe=None, failure_evidence=None):
    """Observe actual profile events and compute invariants; no autograd replacement."""
    import copy
    import random
    import numpy as np
    import torch
    probe = worker.profile().zero_update_probe if probe is None else probe
    failure_evidence = {} if failure_evidence is None else failure_evidence
    states = {key: core.cpu.state_hash(net) for key, net in (("Model", model), ("Critic", critic))}
    sources = {key: core.cpu.tensor_hash(sample[key]) for key in ("image", "conditions", "appearance_regime")}
    table = copy.deepcopy(sample["objectInstanceTable"])
    rng = torch.get_rng_state().clone()
    cuda_rng = torch.cuda.get_rng_state_all() if torch.cuda.is_initialized() else None
    python_rng, numpy_rng = random.getstate(), np.random.get_state()
    def backend():
        return (torch.backends.cuda.matmul.fp32_precision, torch.backends.cudnn.conv.fp32_precision,
                torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic,
                torch.are_deterministic_algorithms_enabled(),
                torch.is_deterministic_algorithms_warn_only_enabled())
    flags = backend()
    before_counts = dict(counters)
    expected_lengths = {"generator": len(tuple(model.parameters())),
                        "discriminator": len(tuple(critic.parameters()))}
    def event(stage, kind, gradients):
        require(stage in ("attempt", "complete") and kind in ("forward", "generator", "discriminator"),
                "unknown numerical probe event")
        suffix = "Attempted" if stage == "attempt" else "Completed"
        counters[kind + suffix] += 1
        require(counters[kind + "Completed"] <= counters[kind + "Attempted"],
                "numerical completion precedes attempt")
        if stage == "complete" and kind != "forward":
            require(isinstance(gradients, (tuple, list)) and len(gradients) == expected_lengths[kind],
                    "full parameter gradient event differs")
    primary = None
    try:
        report = probe(model, critic, sample, order, resource, event=event,
                       failure_evidence=failure_evidence)
        require(report.get("passed") is True and report.get("optimizerCreated") is False
                and report.get("optimizerUpdates") == 0
                and report.get("callCounts") == {
                    "generatorForwards": 1, "generatorAutograd": 4, "discriminatorAutograd": 1},
                "candidate zero-update profile result differs")
        delta = {key: value - before_counts[key] for key, value in counters.items()}
        require(delta == {"forwardAttempted": 1, "forwardCompleted": 1,
                          "generatorAttempted": 4, "generatorCompleted": 4,
                          "discriminatorAttempted": 1, "discriminatorCompleted": 1},
                "actual zero-update event counts differ")
        after = {key: core.cpu.state_hash(net) for key, net in (("Model", model), ("Critic", critic))}
        require(states == after, "zero-update model/critic SHA changed")
        require(sources == {key: core.cpu.tensor_hash(sample[key]) for key in sources}
                and table == sample["objectInstanceTable"], "zero-update source/table changed")
        require(all(p.grad is None for net in (model, critic) for p in net.parameters()),
                "zero-update gradients not cleared")
        require(torch.equal(rng, torch.get_rng_state()) and random.getstate() == python_rng
                and numpy_rng[0] == np.random.get_state()[0]
                and np.array_equal(numpy_rng[1], np.random.get_state()[1])
                and numpy_rng[2:] == np.random.get_state()[2:]
                and (cuda_rng is None or all(torch.equal(a,b) for a,b in zip(
                    cuda_rng, torch.cuda.get_rng_state_all()))) and flags == backend(),
                "zero-update RNG/backend changed")
        return {**report, "autogradGradCalls": delta["generatorCompleted"],
                "discriminatorAutogradGradCalls": delta["discriminatorCompleted"],
                "optimizerSteps": {"generator": 0, "discriminator": 0},
                "contextIsolationRule": "full_v23_terrain_context_private_global_xy_zero_v1",
                "aggregationRule": worker.AGGREGATION_RULE,
                "sourceTensorsUnchanged": True, "objectInstancesUnchanged": True,
                "sourceTensorHashesBeforeAndAfter": sources, "rngRestored": True,
                "gradFieldsCleared": True, "initialStateSha256": states, "finalStateSha256": after}
    except BaseException as error:
        primary = error
        try:
            failure_evidence.update(originalError=str(error), actualEventCounts={
                key: value - before_counts[key] for key, value in counters.items()})
        except BaseException as diagnostic_error:
            try: error.secondary_diagnostic_error = str(diagnostic_error)
            except BaseException: pass
        raise
    finally:
        restores = [lambda: torch.set_rng_state(rng),
                    lambda: torch.cuda.set_rng_state_all(cuda_rng) if cuda_rng is not None else None,
                    lambda: random.setstate(python_rng), lambda: np.random.set_state(numpy_rng),
                    lambda: setattr(torch.backends.cuda.matmul, "fp32_precision", flags[0]),
                    lambda: setattr(torch.backends.cudnn.conv, "fp32_precision", flags[1]),
                    lambda: setattr(torch.backends.cudnn, "benchmark", flags[2]),
                    lambda: setattr(torch.backends.cudnn, "deterministic", flags[3]),
                    lambda: torch.use_deterministic_algorithms(flags[4], warn_only=flags[5])]
        first_restore_error = None
        for restore in restores:
            try: restore()
            except BaseException as secondary:
                first_restore_error = first_restore_error or secondary
                try: failure_evidence.setdefault("secondaryRestoreErrors", []).append(str(secondary))
                except BaseException: pass
        if primary is None and first_restore_error is not None:
            raise first_restore_error


def execute(package_binding, *, root=ROOT):
    import torch

    started = time.monotonic()
    torch.set_num_threads(2)
    package, policy, parent = check_package(package_binding, root=root)
    receipt = core.cpu.BoundReader(root).json(policy["cpuAcceptance"])
    require(receipt.get("scope") == "synthetic_cpu_tests_and_real_isolated_registry_package_admission_not_gpu_qualification",
            "synthetic prerequisite package cannot execute GPU qualification")
    output = core.cpu.project_file(
        root, package["outputRoot"] + "/zero-update-gpu-qualification.json")
    require(not output.exists() and not (output.parent / "zero-update-gpu-qualification-failure.json").exists(), "V28 GPU gate already consumed")
    claim = output.parent / "zero-update-gpu-qualification-claim.json"
    base._write_exclusive_json(claim, {"executionPackage": package_binding, "attempt": 1, "automaticRetries": 0})
    counters = probe_counters()
    case_failure_evidence = {}
    cases = []
    initialized = False
    initial = None
    last_thermal = 0.0

    def resource():
        nonlocal last_thermal
        require(time.monotonic() - started < MAX_SECONDS, "V28 GPU probe timeout")
        read_current(root, package)
        require(shutil.disk_usage(output.parent).free >= 2048 * 1024**2,
                "V28 free disk below qualification floor")
        torch.cuda.synchronize(0)
        free, total = torch.cuda.mem_get_info(0)
        require(free >= 2048 * 1024**2, "V28 free VRAM below floor")
        core.gpu.check_memory(
            total=int(total), reserved=int(torch.cuda.max_memory_reserved(0)),
            allocated=int(torch.cuda.max_memory_allocated(0)),
            device_used=int(total - free), fraction=0.7)
        if time.monotonic() - last_thermal >= 10:
            process = subprocess.run(
                ["nvidia-smi", "--query-gpu=temperature.gpu",
                 "--format=csv,noheader,nounits"], capture_output=True,
                text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(process.returncode == 0 and process.stdout.strip(),
                    "V28 GPU temperature unavailable")
            require(int(process.stdout.strip().splitlines()[0]) <= 85,
                    "V28 GPU temperature above ceiling")
            last_thermal = time.monotonic()

    try:
        reader = core.cpu.BoundReader(root)
        manifest, order, continuous, _, memberships = core.cpu.select_rows(reader)
        bound_manifest = reader.json(package["datasetManifest"])
        require(manifest["datasetReleaseIdentity"]
                == bound_manifest["datasetReleaseIdentity"],
                "V28 dataset release identity differs")
        source_policy = reader.json(parent["frozenBindings"]["sourcePolicy"])
        require(memberships["train"]["selectionSha256"]
                == source_policy["inputs"]["trainSelectionSha256"],
                "V28 frozen train selection differs")
        index = reader.json(manifest["sourceIndex"])
        membership = reader.json(parent["frozenBindings"]["trainSplit"])
        train_ids = membership["sampleIds"]
        require(len(train_ids) == len(set(train_ids)) == 48,
                "V28 exact 48 train rows required")
        by_id = {row["sampleId"]: row for row in index["samples"]}
        samples = []
        for sample_id in train_ids:
            row = by_id[sample_id]
            require(row["split"] == "train", "V28 non-train probe row")
            sample, identity = core.cpu.load_sample(reader, row, order, continuous)
            require(sample["sampleId"] == identity["sampleId"] == sample_id,
                    "V28 decoded sample identity differs")
            sample = worker.attach_regime(reader, row, sample)
            samples.append((row, sample))
        reader.unchanged()
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                "V28 CUDA BF16 unavailable")
        torch.cuda.set_device(0)
        free, total = torch.cuda.mem_get_info(0)
        allocation = int(total * 0.7) - (total - free) - 64 * 1024**2
        require(allocation > 0 and free >= 2048 * 1024**2,
                "V28 insufficient available VRAM below 70 percent")
        torch.cuda.set_per_process_memory_fraction(allocation / total, 0)
        torch.cuda.reset_peak_memory_stats(0)
        torch.manual_seed(base.MODEL_SEED)
        model, critic = worker.fresh_networks(order)
        initial = {"Model": core.cpu.state_hash(model),
                   "Critic": core.cpu.state_hash(critic)}
        model.to("cuda:0")
        critic.to("cuda:0")
        initialized = True
        resource()
        for ordinal, (row, sample) in enumerate(samples):
            resource()
            bound = {**sample, "conditions": sample["conditions"].to("cuda:0"),
                     "image": sample["image"].to("cuda:0")}
            model.train()
            with torch.no_grad(), base.v24.generator_full_fp32_backend():
                repeated_a = worker.sample_forward(model, bound)
                repeated_b = worker.sample_forward(model, bound)
            require(torch.equal(repeated_a.contiguous().view(torch.uint8),
                                repeated_b.contiguous().view(torch.uint8)),
                    "V28 training-mode repeat bytes differ at train ordinal " + str(ordinal))
            del repeated_a, repeated_b
            source_hashes = {key: core.cpu.tensor_hash(bound[key])
                             for key in ("image", "conditions", "appearance_regime")}
            case_failure_evidence = {"trainOrdinal": ordinal}
            report = observe_probe(model, critic, bound, order, resource, counters,
                                   failure_evidence=case_failure_evidence)
            require(report["initialStateSha256"] == initial, "fresh GPU state differs")
            cases.append({**report, "trainingModeRepeatBytesEqual": True,
                "sourceTensorHashesBeforeAndAfter": source_hashes,
                "case": {"sampleId": row["sampleId"], "split": "train",
                         "trainOrdinal": ordinal, "image": row["image"],
                         "conditionPack": row["conditionPack"]}})
            del bound
        final = {"Model": core.cpu.state_hash(model),
                 "Critic": core.cpu.state_hash(critic)}
        require(initial == final, "V28 GPU probe changed model or critic")
        check_package(package_binding, root=root)
        require(time.monotonic() - started < MAX_SECONDS,
                "V28 GPU probe expired after cases")
        report = {"schemaVersion": SCHEMA,
            "status": "current_candidate_zero_update_gpu_qualification_passed",
            "capabilityVersion": worker.CAPABILITY,
            "runId": package["runId"], "packageId": package["packageId"],
            "executionPackage": package_binding,
            "candidateContract": package["candidateContract"],
            "historicalV24QualificationReused": False,
            "trainingModeDeterminismObserved": True,
            "aggregationRule": worker.AGGREGATION_RULE,
            "gpuInitialized": True, "optimizerCreated": False,
            "optimizerSteps": {"generator": 0, "discriminator": 0},
            "checkpointLoaded": False, "checkpointWritten": False,
            "weightsModified": False, "generatorAutogradGradCalls": counters["generatorCompleted"],
            "discriminatorAutogradGradCalls": counters["discriminatorCompleted"],
            "rawAutogradCounts": counters,
            "trainingAllowedByThisArtifact": False,
            "caseCount": 48, "cases": cases,
            "initialStateSha256": initial, "finalStateSha256": final,
            "maxWallSeconds": MAX_SECONDS,
            "elapsedSeconds": time.monotonic() - started,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        encoded = (json.dumps(report, ensure_ascii=False, indent=2,
                              allow_nan=False) + "\n").encode("utf8")
        require(len(encoded) <= MAX_REPORT_BYTES, "V28 GPU report exceeds cap")
        with output.open("xb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        return {"status": report["status"], "report": {
            "path": output.relative_to(root).as_posix(), "sha256": sha(encoded)},
            "caseCount": 48, "optimizerSteps": 0}
    except Exception as error:
        failure = output.parent / "zero-update-gpu-qualification-failure.json"
        if not failure.exists():
            encoded = (json.dumps({"schemaVersion": SCHEMA,
                "status": "current_candidate_zero_update_gpu_qualification_failed_closed",
                "capabilityVersion": worker.CAPABILITY,
                "runId": package["runId"], "packageId": package["packageId"],
                "executionPackage": package_binding,
                "gpuInitialized": initialized,
                "completedCaseCount": len(cases), "partialCases": cases,
                "rawAutogradCounts": counters,
                "caseFailureEvidence": case_failure_evidence,
                "optimizerSteps": {"generator": 0, "discriminator": 0},
                "errorType": type(error).__name__, "error": str(error),
                "recordedAtUtc": datetime.now(timezone.utc).isoformat()},
                ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf8")
            with failure.open("xb") as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
        return {"status": "current_candidate_zero_update_gpu_qualification_failed_closed",
                "completedCaseCount": len(cases), "error": str(error)}


def admission_preflight(package_binding, *, root=ROOT):
    """Run the same complete package admission as execute, without GPU work or writes."""
    import torch
    require(not torch.cuda.is_initialized(), "CPU admission requires uninitialized CUDA")
    package, _policy, _parent = check_package(package_binding, root=root)
    previous = core.cpu.project_file(root, package["outputRoot"])
    for name in ("zero-update-gpu-qualification.json", "zero-update-gpu-qualification-failure.json",
                 "zero-update-gpu-qualification-claim.json", "training-ticket.json",
                 "training-ticket-consumed.json", "phase-terminal.json", "progress.json"):
        require(not (previous / name).exists(), "V28 package already consumed or progressed")
    require(not torch.cuda.is_initialized(), "admission initialized CUDA")
    return {"status": "managed_package_admission_passed_gpu_not_initialized",
        "capabilityVersion": worker.CAPABILITY, "executionPackage": package_binding,
        "runId": package["runId"], "packageId": package["packageId"],
        "gpuInitialized": False, "optimizerCreated": False, "optimizerSteps": 0,
        "qualificationClaimCreated": False, "trainingStarted": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--admission-preflight", action="store_true")
    args = parser.parse_args(argv)
    require(not (args.admission_preflight and args.execute), "admission and GPU execution are exclusive")
    if args.admission_preflight:
        require(args.package and args.sha256, "V28 bound admission package required")
        print(json.dumps(admission_preflight({"path": args.package, "sha256": args.sha256}),
                         ensure_ascii=False, allow_nan=False), flush=True)
        return 0
    if not args.execute:
        require(not args.package and not args.sha256,
                "V28 GPU package arguments require --execute")
        print(json.dumps({"status": "cpu_preflight_only_gpu_not_initialized",
                          "optimizerSteps": 0, "trainingStarted": False}))
        return 0
    require(args.package and args.sha256, "V28 bound package required")
    result = execute({"path": args.package, "sha256": args.sha256})
    print(json.dumps(result, ensure_ascii=False, allow_nan=False), flush=True)
    return 0 if result["status"] == "current_candidate_zero_update_gpu_qualification_passed" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        failure = {"status": "v28_gpu_preflight_failed_closed",
                   "errorType": type(error).__name__, "error": str(error)}
        if "--admission-preflight" in sys.argv[1:]:
            import torch
            failure.update(gpuInitialized=torch.cuda.is_initialized(), optimizerCreated=False,
                           qualificationClaimCreated=False, trainingStarted=False)
        print(json.dumps(failure),
              file=sys.stderr, flush=True)
        raise SystemExit(1)

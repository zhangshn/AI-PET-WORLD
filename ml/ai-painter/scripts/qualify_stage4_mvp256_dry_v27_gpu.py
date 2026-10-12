"""Current V27 train-mode, 48-row, zero-update GPU qualification."""
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

import painter_stage4_v27_dry_single_world_checkpoint_worker as worker  # noqa: E402
from ai_painter.complete_world.object_head_shared_hidden_priority_v27 import (  # noqa: E402
    train_mode_zero_update_probe,
)

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
            "V27 managed execution absent or changed")
    heartbeat = json.loads(core.cpu.project_file(
        root, active["heartbeat"]["path"]).read_bytes())
    require(active.get("programLineage") == package["programBindings"]
            and active["heartbeat"].get("ttlSeconds") == 120,
            "V27 current program lineage or heartbeat contract differs")
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
            "V27 heartbeat stale or changed")
    reader = core.cpu.BoundReader(root)
    lock = reader.json(base._binding(active["lock"], "managed execution lock"))
    require(lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1"
            and lock.get("capabilityVersion") == worker.CAPABILITY
            and lock.get("runId") == package["runId"]
            and lock.get("packageId") == package["packageId"]
            and lock.get("processId") == active["processId"]
            and lock.get("processStartIdentity") == active["processStartIdentity"],
            "V27 managed execution lock differs")
    if check_process:
        require(base.managed_worker.process_identity(active["processId"])
                == active["processStartIdentity"],
                "V27 supervisor exited or PID reused")
    reader.unchanged()


def check_package(binding, *, root=ROOT, check_registry=True):
    reader = core.cpu.BoundReader(root)
    binding = base._binding(binding, "V27 base package")
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
            }, "V27 inactive base package required")
    programs = package.get("programBindings")
    require(isinstance(programs, dict)
            and all(programs.get(role, {}).get("path") == path
                    for role, path in worker.PROGRAM_PATHS.items()),
            "V27 GPU program identity differs")
    worker.validate_program_bindings(reader, programs)
    policy_binding = base._binding(package.get("candidateContract"), "V27 policy")
    require(policy_binding["path"] == worker.POLICY_PATH,
            "V27 policy path differs")
    policy = reader.json(policy_binding)
    require(policy.get("schemaVersion") == worker.POLICY_SCHEMA
            and policy.get("status") == "cpu_accepted_not_gpu_qualified"
            and policy.get("capabilityVersion") == worker.CAPABILITY,
            "V27 policy identity differs")
    _proposal, parent = worker._source_candidate(reader, policy)
    acceptance = reader.json(base._binding(policy["cpuAcceptance"], "V27 lifecycle evidence"))
    require(all(acceptance["programBindings"].get(role) == program
                for role, program in programs.items()),
            "V27 GPU program differs from CPU-tested program")
    require(package.get("sourceDataCandidate") == policy["predecessorCandidate"]
            and package.get("cpuAcceptance") == policy["cpuAcceptance"]
            and package.get("modelCpuEvidence") == policy["modelCpuEvidence"]
            and programs == policy["programBindings"]
            and not any(k in package for k in ("gpuQualification", "trainingTicket", "managedLock", "launchIdentity")),
            "V27 package predecessor/CPU bindings differ")
    require(package.get("outputRoot", "").startswith(worker.OUTPUT_PARENT + "/")
            and binding["path"] == package["outputRoot"] + "/execution-package.json",
            "V27 package output root differs")
    require(package.get("datasetManifest") == parent["frozenBindings"]["datasetManifest"]
            and package.get("trainSplit") == parent["frozenBindings"]["trainSplit"]
            and package.get("validationSplit") == parent["frozenBindings"]["validationSplit"],
            "V27 inherited split bindings differ")
    for source in parent["frozenBindings"].values():
        reader.read(source)
    spec = reader.read(base._binding(policy.get("formalSpecification"), "V27 spec"))
    require(b"AI-PAINTER-SPEC-1.41" in spec, "V27 formal spec differs")

    manifest = reader.json(package["datasetManifest"])
    require(manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4}
            and manifest.get("qualification", {}).get("dataQualifiedForTraining") is True
            and manifest.get("qualification", {}).get("executionQualified") is False,
            "V27 dataset release qualification differs")
    reader.unchanged()
    if check_registry:
        read_current(root, package, check_process=True)
    return package, policy, parent


def execute(package_binding, *, root=ROOT):
    import torch

    started = time.monotonic()
    torch.set_num_threads(2)
    package, policy, parent = check_package(package_binding, root=root)
    output = core.cpu.project_file(
        root, package["outputRoot"] + "/zero-update-gpu-qualification.json")
    require(not output.exists() and not (output.parent / "zero-update-gpu-qualification-failure.json").exists(), "V27 GPU gate already consumed")
    claim = output.parent / "zero-update-gpu-qualification-claim.json"
    base._write_exclusive_json(claim, {"executionPackage": package_binding, "attempt": 1, "automaticRetries": 0})
    counters = {"generatorAttempted": 0, "generatorCompleted": 0, "discriminatorAttempted": 0, "discriminatorCompleted": 0}
    cases = []
    initialized = False
    initial = None
    last_thermal = 0.0

    def resource():
        nonlocal last_thermal
        require(time.monotonic() - started < MAX_SECONDS, "V27 GPU probe timeout")
        read_current(root, package)
        require(shutil.disk_usage(output.parent).free >= 2048 * 1024**2,
                "V27 free disk below qualification floor")
        torch.cuda.synchronize(0)
        free, total = torch.cuda.mem_get_info(0)
        require(free >= 2048 * 1024**2, "V27 free VRAM below floor")
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
                    "V27 GPU temperature unavailable")
            require(int(process.stdout.strip().splitlines()[0]) <= 85,
                    "V27 GPU temperature above ceiling")
            last_thermal = time.monotonic()

    try:
        reader = core.cpu.BoundReader(root)
        manifest, order, continuous, _, memberships = core.cpu.select_rows(reader)
        bound_manifest = reader.json(package["datasetManifest"])
        require(manifest["datasetReleaseIdentity"]
                == bound_manifest["datasetReleaseIdentity"],
                "V27 dataset release identity differs")
        source_policy = reader.json(parent["frozenBindings"]["sourcePolicy"])
        require(memberships["train"]["selectionSha256"]
                == source_policy["inputs"]["trainSelectionSha256"],
                "V27 frozen train selection differs")
        index = reader.json(manifest["sourceIndex"])
        membership = reader.json(parent["frozenBindings"]["trainSplit"])
        train_ids = membership["sampleIds"]
        require(len(train_ids) == len(set(train_ids)) == 48,
                "V27 exact 48 train rows required")
        by_id = {row["sampleId"]: row for row in index["samples"]}
        samples = []
        for sample_id in train_ids:
            row = by_id[sample_id]
            require(row["split"] == "train", "V27 non-train probe row")
            sample, identity = core.cpu.load_sample(reader, row, order, continuous)
            require(sample["sampleId"] == identity["sampleId"] == sample_id,
                    "V27 decoded sample identity differs")
            samples.append((row, sample))
        reader.unchanged()
        require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                "V27 CUDA BF16 unavailable")
        torch.cuda.set_device(0)
        free, total = torch.cuda.mem_get_info(0)
        allocation = int(total * 0.7) - (total - free) - 64 * 1024**2
        require(allocation > 0 and free >= 2048 * 1024**2,
                "V27 insufficient available VRAM below 70 percent")
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
        first_sample = samples[0][1]
        first_conditions = first_sample["conditions"].to("cuda:0")
        torch_rng = torch.get_rng_state().clone()
        cuda_rng = torch.cuda.get_rng_state_all()
        first_prediction = None
        second_prediction = None
        try:
            model.train()
            with torch.no_grad(), base.v24.generator_full_fp32_backend():
                first_prediction = model(
                    first_conditions[None], first_sample["objectInstanceTable"])
                second_prediction = model(
                    first_conditions[None], first_sample["objectInstanceTable"])
            require(torch.equal(first_prediction, second_prediction),
                    "V27 GPU train-mode output is not deterministic")
        finally:
            torch.set_rng_state(torch_rng)
            torch.cuda.set_rng_state_all(cuda_rng)
            del first_conditions, first_prediction, second_prediction
        resource()
        original_grad = torch.autograd.grad
        generator_ids = {id(p) for p in model.parameters()}
        def counted_grad(loss, parameters, **kwargs):
            parameters = tuple(parameters)
            phase = "generator" if all(id(p) in generator_ids for p in parameters) else "discriminator"
            counters[phase + "Attempted"] += 1
            result = original_grad(loss, parameters, **kwargs)
            counters[phase + "Completed"] += 1
            return result
        from unittest.mock import patch
        for ordinal, (row, sample) in enumerate(samples):
            resource()
            bound = {**sample, "conditions": sample["conditions"].to("cuda:0"),
                     "image": sample["image"].to("cuda:0")}
            model.train()
            with torch.no_grad(), base.v24.generator_full_fp32_backend():
                repeated_a = model(bound["conditions"][None], bound["objectInstanceTable"])
                repeated_b = model(bound["conditions"][None], bound["objectInstanceTable"])
            require(torch.equal(repeated_a.contiguous().view(torch.uint8),
                                repeated_b.contiguous().view(torch.uint8)),
                    "V27 training-mode repeat bytes differ at train ordinal " + str(ordinal))
            del repeated_a, repeated_b
            source_hashes = {key: core.cpu.tensor_hash(bound[key])
                             for key in ("image", "conditions")}
            with patch.object(torch.autograd, "grad", counted_grad):
                report = train_mode_zero_update_probe(
                    model, critic, bound, order, profile=base.v24,
                    resource_check=resource)
            require(report.get("passed") is True
                    and report.get("autogradGradCalls") == 4
                    and report.get("discriminatorAutogradGradCalls") == 1
                    and report.get("contextIsolationRule") == "full_v23_terrain_context_private_global_xy_zero_v1"
                    and report.get("aggregationRule") == worker.AGGREGATION_RULE
                    and report.get("optimizerCreated") is False
                    and report.get("optimizerSteps") == {
                        "generator": 0, "discriminator": 0}
                    and report.get("sourceTensorsUnchanged") is True
                    and report.get("rngRestored") is True
                    and report.get("gradFieldsCleared") is True
                    and report.get("initialStateSha256") == initial
                    and report.get("finalStateSha256") == initial,
                    "V27 train-mode zero-update case failed")
            cases.append({**report, "trainingModeRepeatBytesEqual": True,
                "sourceTensorHashesBeforeAndAfter": source_hashes,
                "case": {"sampleId": row["sampleId"], "split": "train",
                         "trainOrdinal": ordinal, "image": row["image"],
                         "conditionPack": row["conditionPack"]}})
            del bound
        final = {"Model": core.cpu.state_hash(model),
                 "Critic": core.cpu.state_hash(critic)}
        require(initial == final, "V27 GPU probe changed model or critic")
        check_package(package_binding, root=root)
        require(time.monotonic() - started < MAX_SECONDS,
                "V27 GPU probe expired after cases")
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
        require(len(encoded) <= MAX_REPORT_BYTES, "V27 GPU report exceeds cap")
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
        require(not (previous / name).exists(), "V27 package already consumed or progressed")
    require(not torch.cuda.is_initialized(), "admission initialized CUDA")
    return {"status": "managed_package_admission_passed_gpu_not_initialized",
        "capabilityVersion": worker.CAPABILITY, "executionPackage": package_binding,
        "runId": package["runId"], "packageId": package["packageId"],
        "historicalRegistryRevision": worker.HISTORICAL_REGISTRY_OBSERVATION["observed"]["registryRevision"],
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
        require(args.package and args.sha256, "V27 bound admission package required")
        print(json.dumps(admission_preflight({"path": args.package, "sha256": args.sha256}),
                         ensure_ascii=False, allow_nan=False), flush=True)
        return 0
    if not args.execute:
        require(not args.package and not args.sha256,
                "V27 GPU package arguments require --execute")
        print(json.dumps({"status": "cpu_preflight_only_gpu_not_initialized",
                          "optimizerSteps": 0, "trainingStarted": False}))
        return 0
    require(args.package and args.sha256, "V27 bound package required")
    result = execute({"path": args.package, "sha256": args.sha256})
    print(json.dumps(result, ensure_ascii=False, allow_nan=False), flush=True)
    return 0 if result["status"] == "current_candidate_zero_update_gpu_qualification_passed" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        failure = {"status": "v27_gpu_preflight_failed_closed",
                   "errorType": type(error).__name__, "error": str(error)}
        if "--admission-preflight" in sys.argv[1:]:
            import torch
            failure.update(gpuInitialized=torch.cuda.is_initialized(), optimizerCreated=False,
                           qualificationClaimCreated=False, trainingStarted=False)
        print(json.dumps(failure),
              file=sys.stderr, flush=True)
        raise SystemExit(1)

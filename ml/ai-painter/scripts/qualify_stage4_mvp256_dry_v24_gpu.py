"""One current-candidate zero-update GPU qualification over all 48 frozen train rows.

Default --check is CPU-only. --execute must run under the JS managed current
execution. This file never creates an optimizer, Checkpoint, or training update.
"""
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
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))

import painter_stage4_v24_object_head_core_priority_probe as profile  # noqa: E402
import painter_stage4_v24_dry_single_world_checkpoint_worker as worker  # noqa: E402

core = profile.core
SCHEMA = "ai-painter-stage4-mvp256-dry-v24-zero-update-gpu-gate-v1"
MAX_SECONDS = 600
MAX_REPORT_BYTES = 8 * 1024 * 1024
SOURCE_CASES = 48


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def bound_json(binding: dict) -> dict:
    reader = core.cpu.BoundReader()
    result = reader.json(binding)
    reader.unchanged()
    return result


def check_package(binding: dict, *, check_registry: bool) -> tuple[dict, dict]:
    reader = core.cpu.BoundReader()
    package = reader.json(binding)
    require(package.get("schemaVersion") == worker.PACKAGE_SCHEMA
            and package.get("status") == "issued_single_attempt"
            and package.get("capabilityVersion") == worker.CAPABILITY
            and package.get("trainingIntent") == "bounded_once"
            and package.get("trainingAllowed") is False
            and package.get("resourceBudget") == worker.RESOURCE_CEILING,
            "current inactive base package required")
    candidate = reader.json(package["candidateContract"])
    worker.validate_candidate_contract(candidate)
    require(package.get("datasetManifest") == candidate["frozenBindings"]["datasetManifest"]
            and package.get("trainSplit") == candidate["frozenBindings"]["trainSplit"]
            and package.get("validationSplit") == candidate["frozenBindings"]["validationSplit"],
            "frozen dataset or split binding differs")
    manifest = reader.json(package["datasetManifest"])
    require(manifest.get("splitCounts") == {
                "train": 48, "validation": 8, "challenge": 4, "regression": 4}
            and manifest.get("qualification", {}).get("dataQualifiedForTraining") is True
            and manifest.get("qualification", {}).get("executionQualified") is False,
            "dataset release qualification boundary differs")
    require(package.get("programBindings", {}).get("gpuQualifier", {}).get("path")
            == "ml/ai-painter/scripts/qualify_stage4_mvp256_dry_v24_gpu.py",
            "GPU qualifier program not bound")
    for program in package["programBindings"].values():
        reader.read(program)
    reader.unchanged()
    if check_registry:
        registry = json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
        active = registry.get("activeExecution")
        require(isinstance(active, dict)
                and active.get("runId") == package.get("runId")
                and active.get("packageId") == package.get("packageId")
                and active.get("capabilityVersion") == worker.CAPABILITY,
                "managed current execution not active for this package")
        require(time.time() < datetime.fromisoformat(
            json.loads(core.cpu.project_file(ROOT, active["heartbeat"]["path"]).read_bytes())
            ["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp() + 120,
            "managed heartbeat stale")
        lock = bound_json(active["lock"])
        require(lock.get("runId") == package["runId"]
                and lock.get("packageId") == package["packageId"],
                "managed lock identity differs")
    return package, candidate


def check_live_execution(package: dict) -> None:
    """Cheap per-gradient liveness check; full bound-source rehash brackets probe."""
    registry = json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json").read_bytes())
    active = registry.get("activeExecution")
    require(isinstance(active, dict)
            and active.get("runId") == package["runId"]
            and active.get("packageId") == package["packageId"]
            and active.get("capabilityVersion") == worker.CAPABILITY,
            "current managed execution changed during GPU qualification")
    heartbeat = json.loads(core.cpu.project_file(
        ROOT, active["heartbeat"]["path"]).read_bytes())
    require(heartbeat.get("runId") == package["runId"]
            and heartbeat.get("processId") == active["processId"]
            and time.time() < datetime.fromisoformat(
                heartbeat["heartbeatAtUtc"].replace("Z", "+00:00")).timestamp() + 120,
            "managed execution heartbeat stale or changed")


def execute(package_binding: dict) -> dict:
    import torch

    torch.set_num_threads(2)
    started = time.monotonic()
    package, candidate = check_package(package_binding, check_registry=True)
    output = core.cpu.project_file(ROOT, package["outputRoot"] + "/zero-update-gpu-qualification.json")
    require(not output.exists(), "GPU qualification already consumed")
    cases = []
    gpu_initialized = False
    initial = None
    last_thermal = 0.0

    def resource() -> None:
        nonlocal last_thermal
        require(time.monotonic() - started < MAX_SECONDS,
                "current-candidate GPU qualification timeout")
        check_live_execution(package)
        require(shutil.disk_usage(output.parent).free >= 2048 * 1024**2,
                "free disk below qualification floor")
        torch.cuda.synchronize(0)
        free, total = torch.cuda.mem_get_info(0)
        require(free >= 2048 * 1024**2, "free VRAM below qualification floor")
        core.gpu.check_memory(total=int(total),
                              reserved=int(torch.cuda.max_memory_reserved(0)),
                              allocated=int(torch.cuda.max_memory_allocated(0)),
                              device_used=int(total - free), fraction=0.7)
        if time.monotonic() - last_thermal >= 10:
            process = subprocess.run(
                ["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            require(process.returncode == 0, "GPU temperature unavailable")
            require(int(process.stdout.strip().splitlines()[0]) <= 85,
                    "GPU temperature above ceiling")
            last_thermal = time.monotonic()

    try:
        with profile.successor_profile():
            reader = core.cpu.BoundReader()
            manifest, order, continuous, _, memberships = core.cpu.select_rows(reader)
            require(manifest["datasetReleaseIdentity"]
                    == bound_json(package["datasetManifest"])["datasetReleaseIdentity"],
                    "dataset identity differs")
            require(memberships["train"]["selectionSha256"]
                    == bound_json(candidate["frozenBindings"]["sourcePolicy"])["inputs"]["trainSelectionSha256"],
                    "frozen train selection differs")
            index = reader.json(manifest["sourceIndex"])
            membership = reader.json(manifest["splits"]["train"])
            by_id = {row["sampleId"]: row for row in index["samples"]}
            train_ids = membership["sampleIds"]
            require(len(train_ids) == len(set(train_ids)) == SOURCE_CASES,
                    "48 unique train rows required")
            samples = []
            for sample_id in train_ids:
                row = by_id[sample_id]
                require(row["split"] == "train", "non-train GPU probe row")
                sample, identity = core.cpu.load_sample(reader, row, order, continuous)
                require(sample["sampleId"] == identity["sampleId"] == sample_id,
                        "decoded sample identity differs")
                samples.append((row, sample))
            reader.unchanged()
            require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                    "CUDA BF16 unavailable")
            torch.cuda.set_device(0)
            free, total = torch.cuda.mem_get_info(0)
            allocation = int(total * .7) - (total - free) - 64 * 1024**2
            require(allocation > 0 and free >= 2048 * 1024**2,
                    "insufficient available VRAM below 70 percent")
            torch.cuda.set_per_process_memory_fraction(allocation / total, 0)
            torch.cuda.reset_peak_memory_stats(0)
            torch.manual_seed(worker.MODEL_SEED)
            model, critic = core.fresh_networks(order)
            initial = {"Model": core.cpu.state_hash(model),
                       "Critic": core.cpu.state_hash(critic)}
            model.to("cuda:0")
            critic.to("cuda:0")
            gpu_initialized = True
            resource()

            def forward(kind, bound):
                return model(bound["conditions"][None], bound["objectInstanceTable"])

            for ordinal, (row, sample) in enumerate(samples):
                resource()
                bound = {**sample, "conditions": sample["conditions"].to("cuda:0"),
                         "image": sample["image"].to("cuda:0")}
                report = profile.zero_update_probe(model, critic, bound, order, resource, forward)
                require(report.get("passed") is True
                        and report.get("generatorCandidate", {}).get("autogradGradCalls") == 4
                        and report.get("discriminatorGradientFacts", {}).get("nonzeroTensorCount", 0) > 0
                        and report.get("optimizerCreated") is False
                        and report.get("optimizerSteps") == {"generator": 0, "discriminator": 0}
                        and report.get("sourceTensorsUnchanged") is True
                        and report.get("rngRestored") is True
                        and report.get("gradFieldsCleared") is True,
                        "V24 zero-update probe case failed")
                cases.append({**report, "discriminatorAutogradGradCalls": 1,
                    "case": {"sampleId": row["sampleId"],
                    "split": "train", "trainOrdinal": ordinal,
                    "image": row["image"], "conditionPack": row["conditionPack"]}})
                del bound
            final = {"Model": core.cpu.state_hash(model),
                     "Critic": core.cpu.state_hash(critic)}
            require(initial == final, "GPU probe changed model or critic state")
        check_package(package_binding, check_registry=True)
        require(time.monotonic() - started < MAX_SECONDS,
                "GPU qualification timeout after all cases")
        report = {"schemaVersion": SCHEMA,
                  "status": "current_candidate_zero_update_gpu_qualification_passed",
                  "capabilityVersion": worker.CAPABILITY,
                  "runId": package["runId"], "packageId": package["packageId"],
                  "executionPackage": package_binding,
                  "candidateContract": package["candidateContract"],
                  "historicalV24QualificationReused": False,
                  "gpuInitialized": True, "optimizerCreated": False,
                  "optimizerSteps": {"generator": 0, "discriminator": 0},
                  "checkpointLoaded": False, "checkpointWritten": False,
                  "weightsModified": False,
                  "generatorAutogradGradCalls": SOURCE_CASES * 4,
                  "discriminatorAutogradGradCalls": SOURCE_CASES,
                  "trainingAllowedByThisArtifact": False,
                  "caseCount": SOURCE_CASES, "cases": cases,
                  "initialStateSha256": initial, "finalStateSha256": final,
                  "maxWallSeconds": MAX_SECONDS,
                  "elapsedSeconds": time.monotonic() - started,
                  "recordedAtUtc": datetime.now(timezone.utc).isoformat()}
        encoded = (json.dumps(report, ensure_ascii=False, indent=2,
                              allow_nan=False) + "\n").encode()
        require(len(encoded) <= MAX_REPORT_BYTES, "GPU report exceeds cap")
        with output.open("xb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        return {"status": report["status"],
                "report": {"path": output.relative_to(ROOT).as_posix(),
                           "sha256": sha(encoded)},
                "caseCount": SOURCE_CASES, "optimizerSteps": 0}
    except Exception as error:
        failure = output.parent / "zero-update-gpu-qualification-failure.json"
        if not failure.exists():
            encoded = (json.dumps({"schemaVersion": SCHEMA,
                "status": "current_candidate_zero_update_gpu_qualification_failed_closed",
                "runId": package["runId"], "packageId": package["packageId"],
                "executionPackage": package_binding,
                "gpuInitialized": gpu_initialized, "completedCaseCount": len(cases),
                "optimizerSteps": {"generator": 0, "discriminator": 0},
                "error": str(error), "recordedAtUtc": datetime.now(timezone.utc).isoformat()},
                ensure_ascii=False, indent=2) + "\n").encode()
            with failure.open("xb") as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    binding = {"path": args.package, "sha256": args.sha256}
    package, _ = check_package(binding, check_registry=args.execute)
    if args.execute:
        print(json.dumps(execute(binding), ensure_ascii=False))
    else:
        print(json.dumps({"status": "gpu_qualification_preflight_passed_not_started",
                          "runId": package["runId"], "caseCount": SOURCE_CASES,
                          "gpuInitialized": False, "optimizerSteps": 0},
                         ensure_ascii=False))


if __name__ == "__main__":
    main()

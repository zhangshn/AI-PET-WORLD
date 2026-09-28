"""One bounded V13 GPU gradient/memory probe; zero optimizer steps and no Checkpoint."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml/ai-painter/src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype, train_original_instance_objective,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (  # noqa: E402
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from check_stage4_mvp_instance_object_v13_cpu import (  # noqa: E402
    CAPABILITY, CONTRACT_PATH, SEED, verify_contract,
)


POLICY_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-instance-object-v13-readonly-gpu-policy-v1.json"
)
PROGRAM_PATH = (
    "ml/ai-painter/scripts/"
    "run_stage4_mvp_instance_object_v13_readonly_gpu_qualification.py"
)
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp-instance-object-v13-gpu-qualifications"
MAX_WALL_SECONDS = 120


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def bind(logical: str) -> dict:
    return {"path": logical, "sha256": hashlib.sha256(
        project_file(ROOT, logical).read_bytes()).hexdigest()}


def current_registry() -> dict:
    return json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json")
                      .read_text(encoding="utf-8"))


def run() -> dict:
    started = time.monotonic()
    policy_binding = bind(POLICY_PATH)
    policy = bound_json(ROOT, policy_binding)
    contract, condition = verify_contract()
    require(policy.get("schemaVersion") == "stage4-mvp-instance-object-v13-readonly-gpu-policy-v1"
            and policy.get("status") == "active_single_readonly_qualification"
            and policy.get("capabilityVersion") == CAPABILITY
            and policy.get("candidateContract") == bind(CONTRACT_PATH)
            and policy.get("datasetManifest") == contract["datasetBinding"]["manifest"]
            and policy.get("program") == bind(PROGRAM_PATH)
            and policy.get("execution") == {
                "maxGpuMemoryFraction": 0.7, "maxWallSeconds": MAX_WALL_SECONDS,
                "optimizerAllowed": False, "trainingAllowed": False,
                "checkpointAllowed": False, "validationRead": False,
                "challengeRead": False, "regressionRead": False,
            }, "V13 read-only GPU policy or program binding invalid")
    cpu = bound_json(ROOT, policy["cpuQualification"])
    require(cpu.get("status") == "cpu_readonly_passed_formal_review_and_training_still_disabled"
            and cpu.get("candidateContract") == policy["candidateContract"]
            and cpu.get("datasetManifest") == policy["datasetManifest"]
            and cpu.get("trainingStarted") is False
            and cpu.get("gpuStarted") is False
            and cpu.get("optimizerSteps") == 0
            and cpu.get("splitObjectCoverage", {}).get("train", {}).get("sampleCount") == 48
            and cpu.get("splitObjectCoverage", {}).get("validation", {}).get("sampleCount") == 8,
            "V13 CPU evidence is not the exact candidate or split")
    before_registry = current_registry()
    require(before_registry.get("activeExecution") is None,
            "another Stage4 execution is active")
    require(torch.cuda.is_available(), "V13 CUDA unavailable")
    torch.set_num_threads(4)
    order = condition["tensorContract"]["channelOrder"]
    train = SplitReleaseDataset(ROOT, policy["datasetManifest"], "train", (256, 192))
    require(len(train) == 48
            and train.selection_sha256 == contract["datasetBinding"]["trainSelectionSha256"],
            "V13 GPU probe train split differs from CPU qualification")
    sample = load_bound_object_sample(train, 0)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    initial = state_hash(model.state_dict())
    require(initial == cpu["initialModelStateSha256"],
            "V13 initial model differs from CPU qualification")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(0.7, device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device)
    target = {**sample, "image": sample["image"].to(device),
              "conditions": conditions[0]}
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        prediction = model(conditions, sample["objectInstanceTable"])
        objective, parts = train_original_instance_objective(
            prediction, target, sample["objectInstanceTable"], order)
    require(prediction.shape == (1, 3, 192, 256)
            and bool(torch.isfinite(objective)),
            "V13 GPU forward or objective invalid")
    object_parameter = next(model.object_head.parameters())
    shared_parameter = next(parameter for parameter in model.core.parameters()
                            if parameter.requires_grad)
    gradients = torch.autograd.grad(objective, (object_parameter, shared_parameter),
                                    allow_unused=False)
    gradient_sums = [float(gradient.detach().abs().sum()) for gradient in gradients]
    require(all(bool(torch.isfinite(gradient).all()) for gradient in gradients)
            and all(value > 0 for value in gradient_sums),
            "V13 GPU object/shared gradient missing or non-finite")
    torch.cuda.synchronize(device)
    final = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    peak = int(torch.cuda.max_memory_reserved(device))
    total_memory = int(torch.cuda.get_device_properties(device).total_memory)
    require(final == initial
            and all(parameter.grad is None for parameter in model.parameters())
            and peak / total_memory <= 0.7,
            "V13 GPU state changed or memory cap exceeded")
    require(time.monotonic() - started <= MAX_WALL_SECONDS,
            "V13 GPU wall-time cap exceeded")
    after_registry = current_registry()
    require(after_registry.get("registryRevision") == before_registry.get("registryRevision")
            and after_registry.get("activeExecution") is None,
            "current execution registry changed during GPU probe")
    require(bind(PROGRAM_PATH) == policy["program"]
            and bind(CONTRACT_PATH) == policy["candidateContract"]
            and bind(POLICY_PATH) == policy_binding,
            "V13 GPU policy or program changed during probe")
    identity = "gpu-v13-" + hashlib.sha256((policy_binding["sha256"]
        + policy["cpuQualification"]["sha256"]).encode()).hexdigest()[:48]
    report = {
        "schemaVersion": "stage4-mvp-instance-object-v13-readonly-gpu-report-v1",
        "status": "readonly_gpu_qualification_passed_training_still_disabled",
        "capabilityVersion": CAPABILITY, "identity": identity,
        "policy": policy_binding, "candidateContract": policy["candidateContract"],
        "cpuQualification": policy["cpuQualification"],
        "datasetManifest": policy["datasetManifest"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": "train"},
        "initialModelStateSha256": initial, "finalModelStateSha256": final,
        "objectiveTotal": float(objective.detach()),
        "instanceSupportRgbMae": float(parts["instanceSupportRgbMae"].detach()),
        "boundObjectCount": len(sample["objectInstanceTable"]),
        "objectAndSharedGradientAbsoluteSums": gradient_sums,
        "peakGpuReservedBytes": peak, "gpuTotalBytes": total_memory,
        "peakGpuReservedFraction": peak / total_memory,
        "optimizerCreated": False, "optimizerSteps": 0,
        "backwardExecuted": False, "weightsModified": False,
        "checkpointWritten": False, "trainingStarted": False,
        "validationRead": False, "challengeRead": False, "regressionRead": False,
        "trainingAllowedByThisArtifact": False,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    output = project_file(ROOT, f"{OUTPUT_PARENT}/{identity}/report.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    return {"status": report["status"], "report": bind(output.relative_to(ROOT).as_posix())}


if __name__ == "__main__":
    try:
        print(json.dumps(run(), ensure_ascii=False), flush=True)
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        raise SystemExit(1)

"""One policy-bound V12 CUDA objective probe; no optimizer or checkpoint."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import torch


ROOT = Path(__file__).resolve().parents[3]
for directory in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts"):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_local_texture_objective_v12 import (  # noqa: E402
    TEXTURE_WEIGHT, full_frame_local_texture_objective,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 import (  # noqa: E402
    build_renderer,
)
from check_stage4_mvp_local_texture_v12_execution_cpu import bind, require  # noqa: E402


POLICY = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-rgb-local-texture-v12-gpu-qualification-policy.json"
)
PROGRAM = "ml/ai-painter/scripts/run_stage4_mvp_local_texture_v12_readonly_gpu_qualification.py"
OUTPUT_PARENT = ".runtime/ai-painter/stage4-mvp-local-texture-v12-gpu-qualifications"
SEED = 20260929


def current_registry() -> dict:
    path = ".runtime/ai-painter/current-execution-registry/current.json"
    registry = json.loads(project_file(ROOT, path).read_text(encoding="utf-8"))
    require(registry.get("activeExecution") is None, "V12 GPU probe overlaps an active execution")
    return registry


def run() -> dict:
    require(torch.cuda.is_available(), "V12 CUDA unavailable")
    before_registry = current_registry()
    policy = bound_json(ROOT, bind(POLICY))
    require(policy.get("schemaVersion") == "stage4-mvp-local-texture-v12-gpu-qualification-policy-v1"
            and policy.get("status") == "active_single_readonly_qualification"
            and policy.get("automaticRetry") is False
            and policy.get("program") == bind(PROGRAM),
            "V12 GPU policy or bound program changed")
    contract = bound_json(ROOT, policy["candidateContract"])
    cpu = bound_json(ROOT, policy["cpuExecutionPreflight"])
    require(contract.get("status") == "cpu_candidate_not_execution_qualified"
            and contract.get("capabilityVersion") == policy.get("capabilityVersion")
            and cpu.get("status") == "cpu_execution_preflight_passed_training_still_disabled"
            and cpu.get("contract") == policy["candidateContract"]
            and cpu.get("datasetManifest") == contract["datasetManifest"]
            and cpu.get("modelStateUnchanged") is True
            and cpu.get("optimizerSteps") == 0
            and cpu.get("trainingStarted") is False,
            "V12 GPU candidate or independent CPU preflight invalid")
    execution = policy.get("execution")
    require(execution == {
        "resolution": [256, 192], "split": "train", "maxGpuMemoryFraction": 0.7,
        "optimizerAllowed": False, "backwardCallAllowed": False,
        "autogradProbeAllowed": True, "weightModificationAllowed": False,
        "checkpointWriteAllowed": False, "trainingAllowed": False,
    }, "V12 GPU safety policy changed")
    data = SplitReleaseDataset(ROOT, contract["datasetManifest"], "train", (256, 192))
    require(len(data) == 48 and data.manifest["qualification"]["dataQualifiedForTraining"] is True,
            "V12 GPU train release invalid")
    sample = data[0]
    require(sample["split"] == "train", "V12 GPU selected non-train sample")

    torch.cuda.set_device(0)
    torch.cuda.set_per_process_memory_fraction(0.7, 0)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_renderer(ROOT)
    initial = state_hash(model.state_dict())
    require(initial == cpu["initialModelStateSha256"],
            "V12 fresh model initialization differs from CPU preflight")
    model.to("cuda:0").eval()
    conditions = sample["conditions"].unsqueeze(0).to("cuda:0")
    target = sample["image"].unsqueeze(0).to("cuda:0")
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        predicted = model(conditions)
        total, parts = full_frame_local_texture_objective(predicted, target, conditions, model)
    require(tuple(predicted.shape) == (1, 3, 192, 256)
            and bool(torch.isfinite(total))
            and torch.allclose(total, parts["v11Total"].float()
                               + TEXTURE_WEIGHT * parts["localTextureMoments"], atol=1e-5),
            "V12 mixed-precision GPU objective invalid")
    object_parameters = tuple(model.context_heads["object_tree"].parameters())
    shared_parameter = next(parameter for parameter in model.core.parameters()
                            if parameter.requires_grad)
    gradients = torch.autograd.grad(total, object_parameters + (shared_parameter,),
                                    allow_unused=False)
    gradient_sums = [float(value.detach().abs().sum()) for value in gradients]
    require(all(bool(torch.isfinite(value).all()) for value in gradients)
            and all(value > 0 for value in gradient_sums),
            "V12 GPU objective lacks finite object/shared gradient")
    final = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    peak = int(torch.cuda.max_memory_reserved(0))
    total_memory = int(torch.cuda.get_device_properties(0).total_memory)
    require(final == initial and all(parameter.grad is None for parameter in model.parameters())
            and peak / total_memory <= 0.7,
            "V12 GPU probe changed state, retained gradients, or exceeded resource cap")
    after_registry = current_registry()
    require(after_registry.get("registryRevision") == before_registry.get("registryRevision"),
            "current execution registry changed during V12 GPU probe")
    policy_binding = bind(POLICY)
    identity = "gpu-v12-" + hashlib.sha256((policy_binding["sha256"]
        + policy["cpuExecutionPreflight"]["sha256"]).encode()).hexdigest()[:48]
    report = {
        "schemaVersion": "stage4-mvp-local-texture-v12-readonly-gpu-report-v1",
        "status": "readonly_gpu_qualification_passed_training_still_disabled",
        "capabilityVersion": policy["capabilityVersion"], "identity": identity,
        "policy": policy_binding, "candidateContract": policy["candidateContract"],
        "cpuExecutionPreflight": policy["cpuExecutionPreflight"],
        "datasetManifest": contract["datasetManifest"],
        "sampleIdentity": {"sampleId": sample["sampleId"], "split": sample["split"]},
        "initialModelStateSha256": initial, "finalModelStateSha256": final,
        "objectiveTotal": float(total.detach()),
        "v11Objective": float(parts["v11Total"].detach()),
        "localTextureMoments": float(parts["localTextureMoments"].detach()),
        "objectContextGradientAbsoluteSums": gradient_sums[:-1],
        "sharedGradientAbsoluteSum": gradient_sums[-1],
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
    return {"status": report["status"], "report": bind(output.relative_to(ROOT).as_posix())}


if __name__ == "__main__":
    try:
        print(json.dumps(run(), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)

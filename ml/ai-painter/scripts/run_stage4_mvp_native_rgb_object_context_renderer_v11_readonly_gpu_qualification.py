"""Bound V11 CUDA probe; autograd only, never optimize or save a checkpoint."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.split_release import SplitReleaseDataset  # noqa: E402
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 import (  # noqa: E402
    CAPABILITY_VERSION, build_renderer, load_contract,
)
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (  # noqa: E402
    digest, project_file, read_json, validate_binding,
)


POLICY_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-object-context-renderer-v11-gpu-qualification-policy.json"
)
POLICY_ID = "stage4-mvp-native-complete-rgb-object-context-renderer-v11-gpu-qualification-policy-v1"
OUTPUT = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-mvp-native-rgb-object-context-renderer-v11-qualifications"
    / "gpu-report.json"
)
SEED = 20260929
RESPONSIBILITIES = (
    "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)


def _canonical_sha(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def _bound_json(binding: dict, label: str) -> dict:
    validate_binding(ROOT, binding, label)
    return read_json(project_file(ROOT, binding["path"]), label)


def run() -> dict:
    if not torch.cuda.is_available():
        raise ValueError("V11 CUDA unavailable")
    registry = read_json(
        ROOT / ".runtime" / "ai-painter" / "current-execution-registry" / "current.json",
        "current execution registry",
    )
    if registry.get("activeExecution") is not None:
        raise ValueError("V11 GPU probe cannot overlap an active execution")
    policy_path = project_file(ROOT, POLICY_PATH)
    policy_bytes = policy_path.read_bytes()
    policy = read_json(policy_path, "V11 GPU policy")
    if (policy.get("schemaVersion") != POLICY_ID or policy.get("policyId") != POLICY_ID
            or policy.get("status") != "active_single_readonly_qualification"
            or policy.get("capabilityVersion") != CAPABILITY_VERSION
            or policy.get("automaticRetry") is not False):
        raise ValueError("V11 GPU policy identity changed")
    validate_binding(ROOT, policy["gpuQualifierProgram"], "V11 GPU qualifier program")
    contract = _bound_json(policy["candidateContract"], "V11 contract")
    loaded, _ = load_contract(ROOT)
    if contract != loaded:
        raise ValueError("V11 bound contract differs from loader")
    cpu = _bound_json(policy["cpuQualification"], "V11 CPU report")
    if (cpu.get("status") != "cpu_contract_passed_training_still_disabled"
            or cpu.get("capabilityVersion") != CAPABILITY_VERSION
            or cpu.get("contract") != policy["candidateContract"]
            or cpu.get("stateUnchanged") is not True
            or cpu.get("trainingStarted") is not False):
        raise ValueError("V11 CPU evidence not eligible")
    for binding in cpu["programBindings"]:
        validate_binding(ROOT, binding, "V11 CPU program")
    execution = policy["execution"]
    if execution != {
        "resolution": [256, 192], "split": "train",
        "oneNonemptySamplePerResponsibility": True,
        "maxGpuMemoryFraction": 0.7, "optimizerAllowed": False,
        "backwardCallAllowed": False, "autogradProbeAllowed": True,
        "weightModificationAllowed": False, "checkpointWriteAllowed": False,
        "trainingAllowed": False,
    }:
        raise ValueError("V11 GPU safety boundary changed")
    dataset = SplitReleaseDataset(ROOT, contract["datasetBinding"], "train", (256, 192))
    if len(dataset) != 48:
        raise ValueError("V11 train capacity changed")
    order = read_json(project_file(ROOT, contract["conditionContract"]["path"]),
                      "condition contract")["tensorContract"]["channelOrder"]
    selected = {}
    for sample in dataset:
        for identity in RESPONSIBILITIES:
            if identity not in selected and bool(
                (sample["conditions"][order.index(identity)] > 0.5).any()
            ):
                selected[identity] = sample
        if len(selected) == len(RESPONSIBILITIES):
            break
    if set(selected) != set(RESPONSIBILITIES):
        raise ValueError("V11 train lacks full responsibility coverage")

    torch.cuda.set_device(0)
    torch.cuda.set_per_process_memory_fraction(0.7, 0)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_renderer(ROOT)
    before = state_hash(model.state_dict())
    if before != cpu["modelInitializationStateSha256"]:
        raise ValueError("V11 model initialization differs from CPU evidence")
    model.to("cuda:0").eval()
    rows = {}
    for identity in RESPONSIBILITIES:
        sample = selected[identity]
        conditions = sample["conditions"].unsqueeze(0).to("cuda:0")
        if identity in model.support_radii:
            rgb, evidence = model(conditions, return_evidence=True)
            contribution = evidence["contextLogitContributions"][identity]
            mask = evidence["visualSupports"][identity]
            parameters = tuple(model.context_heads[identity].parameters())
        else:
            rgb, evidence = model.core(conditions, return_evidence=True)
            contribution = evidence["responsibilityLogitContributions"][identity]
            mask = evidence["responsibilityMasks"][identity]
            parameters = tuple(model.core.responsibility_heads[identity].parameters())
        gradients = torch.autograd.grad(contribution.sum(), parameters, allow_unused=False)
        row = {
            "sampleId": sample["sampleId"], "split": sample["split"],
            "outputShape": list(rgb.shape), "supportPixels": int(mask.count_nonzero()),
            "outsideSupportContributionMaximum": float((contribution * (1 - mask)).detach().abs().max()),
            "gradientFinite": all(bool(torch.isfinite(value).all()) for value in gradients),
            "gradientAbsoluteSum": sum(float(value.detach().abs().sum()) for value in gradients),
        }
        if (row["outputShape"] != [1, 3, 192, 256] or row["supportPixels"] <= 0
                or row["outsideSupportContributionMaximum"] != 0
                or not row["gradientFinite"] or row["gradientAbsoluteSum"] <= 0):
            raise ValueError("V11 GPU responsibility probe failed: " + identity)
        rows[identity] = row
        del conditions, rgb, evidence, contribution, mask, parameters, gradients
    after = state_hash({key: value.detach().cpu() for key, value in model.state_dict().items()})
    peak = int(torch.cuda.max_memory_reserved(0))
    total = int(torch.cuda.get_device_properties(0).total_memory)
    if (before != after or any(parameter.grad is not None for parameter in model.parameters())
            or peak / total > 0.7):
        raise ValueError("V11 GPU state/gradient/resource boundary failed")
    current = read_json(
        ROOT / ".runtime" / "ai-painter" / "current-execution-registry" / "current.json",
        "current execution registry",
    )
    if current.get("activeExecution") is not None:
        raise ValueError("V11 GPU probe overlapped a new active execution")
    initialization = {
        "schemaVersion": "ai-painter-stage4-mvp-stage0-training-initialization-v1",
        "capabilityVersion": CAPABILITY_VERSION, "seed": SEED,
        "candidateContract": policy["candidateContract"],
        "datasetBinding": contract["datasetBinding"],
        "modelStateSha256": before,
    }
    return {
        "schemaVersion": "stage4-mvp-native-rgb-object-context-renderer-v11-readonly-gpu-report-v1",
        "status": "readonly_gpu_qualification_passed",
        "capabilityVersion": CAPABILITY_VERSION,
        "policy": {"path": POLICY_PATH, "sha256": digest(policy_bytes)},
        "candidateContract": policy["candidateContract"],
        "cpuQualification": policy["cpuQualification"],
        "datasetManifest": {"path": contract["datasetBinding"]["path"],
                            "sha256": contract["datasetBinding"]["sha256"]},
        "modelInitializationStateSha256": before,
        "formalInitializationSha256": _canonical_sha(initialization),
        "initialization": initialization,
        "responsibilityEvidence": rows,
        "modelStateUnchanged": True, "parameterGradientsCleared": True,
        "peakGpuReservedBytes": peak, "gpuTotalBytes": total,
        "peakGpuReservedFraction": peak / total,
        "optimizerCreated": False, "optimizerSteps": 0, "backwardExecuted": False,
        "weightsModified": False, "checkpointWritten": False,
        "trainingStarted": False, "validationRead": False,
        "challengeRead": False, "regressionRead": False,
        "trainingAllowedByThisArtifact": False,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main() -> int:
    try:
        report = run()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        if OUTPUT.exists():
            raise FileExistsError("V11 GPU report already exists; never overwrite evidence")
        staged = OUTPUT.with_name(OUTPUT.name + f".staged-{os.getpid()}")
        staged.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(staged, OUTPUT)
        print(json.dumps({"status": report["status"], "output": str(OUTPUT)}, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""One registered, bounded train-only V11 memorization diagnostic; never a Stage4 run."""

from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sys
import time

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11 import (  # noqa: E402
    build_renderer, full_frame_object_context_objective,
)


POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v11-train-only-capacity-probe-v1.json"
POLICY_SHA256 = "bc770855e53ec872b8b4769bb27375359401f8b19c6778eaf44f56ad8339c71a"
DATASET_SHA256 = "3d3cb6c594bd3b719e9dd13e366d492e1ac1717caaecca78434468484ac70913"
TRAIN_RGB_SHA256 = "eb5c085a05f775ea8df2a8912ff806794dca25b7a378dc54102b142aecf43125"
TRAIN_CONDITION_SHA256 = "05ff62ecdce5a4d545af0dc4652e64fe580d272f032049a8b464924bb751e3aa"
SCHEMA = "stage4-mvp-v11-train-only-capacity-probe-package-v1"
CHECKPOINT_SCHEMA = "stage4-mvp-v11-train-only-capacity-probe-checkpoint-v1"
OUTPUT_PARENT = ".runtime/ai-painter/learning-capacity-experiments"
PROGRAMS = (
    "scripts/run-ai-painter-learning-capacity-experiment.mjs",
    "ml/ai-painter/scripts/painter_stage4_v11_train_only_capacity_probe.py",
    "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_context_renderer.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_recovery_renderer.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_renderer.py",
    "ml/ai-painter/src/ai_painter/complete_world/native_rgb_renderer.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
    "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
    "ml/ai-painter/tests/test_stage4_v11_train_only_capacity_probe.py",
    "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-object-context-renderer-v11-contract.json",
    POLICY_PATH,
)


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def binding(logical: str) -> dict:
    return {"path": logical, "sha256": sha(project_file(ROOT, logical).read_bytes())}


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_policy() -> dict:
    policy = bound_json(ROOT, {"path": POLICY_PATH, "sha256": POLICY_SHA256})
    if (policy.get("schemaVersion") != "stage4-mvp-v11-train-only-capacity-probe-v1"
            or policy.get("status") != "active_single_bounded_diagnostic_not_formal_training"
            or policy.get("scope") != "train_only_learning_capacity_no_generalization_claim"
            or policy.get("capabilityArchitecture")
            != "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
            or policy.get("resolution") != [256, 192]
            or policy.get("initializationSeed") != 20260929
            or policy.get("objective") != "unchanged_v11_full_frame_object_context_objective"
            or policy.get("learningRate") != 0.0001
            or policy.get("maxOptimizerSteps") != 512
            or policy.get("observationSteps") != [0, 128, 256, 512]
            or policy.get("resources") != {
                "maxWallSeconds": 900, "maxGpuMemoryFraction": 0.7,
                "maxOutputMiB": 128, "automaticRetries": 0,
            }
            or policy.get("execution") != {
                "cpuBehaviorTestsRequired": True,
                "noUpdateGpuProbeRequired": True,
                "currentExecutionRegistryRequired": True,
                "oneExecutionIdentityOnly": True,
                "validationReadAllowed": False,
                "challengeReadAllowed": False,
                "regressionReadAllowed": False,
                "failedCheckpointReuseAllowed": False,
                "checkpointSelectionAllowed": False,
                "checkpointPromotionAllowed": False,
                "formalStageAdvancementAllowed": False,
                "runtimeFrameAllowed": False,
            }):
        raise ValueError("V11 train-only diagnostic policy changed")
    if (policy.get("datasetManifest", {}).get("sha256") != DATASET_SHA256
            or policy.get("sample", {}).get("referenceRgbSha256") != TRAIN_RGB_SHA256
            or policy.get("sample", {}).get("conditionPackSha256") != TRAIN_CONDITION_SHA256
            or policy.get("freshModelInitializationStateSha256")
            != "2b08867a8606361ecf6c7ae62fc63c4135496b24005460ebaf0a4a3336ad648a"
            or policy["sample"].get("split") != "train"
            or policy["sample"].get("sampleId")
            != "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"):
        raise ValueError("V11 diagnostic sample is not the frozen train item")
    return policy


def selected_train_sample(policy: dict):
    dataset = SplitReleaseDataset(ROOT, policy["datasetManifest"], "train", (256, 192))
    if len(dataset) != 48:
        raise ValueError("V11 diagnostic train population changed")
    selected = [(index, row) for index, row in enumerate(dataset.rows)
                if row["sampleId"] == policy["sample"]["sampleId"]]
    if len(selected) != 1:
        raise ValueError("V11 diagnostic train sample missing or duplicated")
    index, row = selected[0]
    if (row["image"]["sha256"] != policy["sample"]["referenceRgbSha256"]
            or row["conditionPack"]["sha256"] != policy["sample"]["conditionPackSha256"]):
        raise ValueError("V11 diagnostic RGB or condition identity changed")
    return dataset, index, row


def exclusive_json(target: Path, value: dict) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def atomic_json(target: Path, value: dict) -> None:
    staged = target.with_name(target.name + f".staged-{os.getpid()}")
    exclusive_json(staged, value)
    os.replace(staged, target)


def prepare() -> dict:
    policy = read_policy()
    _, _, row = selected_train_sample(policy)
    programs = [binding(path) for path in PROGRAMS]
    identity_payload = {
        "policy": binding(POLICY_PATH), "datasetManifest": policy["datasetManifest"],
        "sampleId": row["sampleId"], "sampleRgb": row["image"],
        "conditionPack": row["conditionPack"], "programBindings": programs,
    }
    identity = "v11-train-only-capacity-" + sha(json.dumps(
        identity_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
    ).encode("utf-8"))[:48]
    logical = f"{OUTPUT_PARENT}/{identity}"
    package = {
        "schemaVersion": SCHEMA, "experimentIdentity": identity, "outputRoot": logical,
        "scope": policy["scope"], "policy": binding(POLICY_PATH),
        "datasetManifest": policy["datasetManifest"], "sample": policy["sample"],
        "programBindings": programs, "resources": {
            "maxWallSeconds": policy["resources"]["maxWallSeconds"],
            "maxGpuMemoryFraction": policy["resources"]["maxGpuMemoryFraction"],
            "maxOutputMiB": policy["resources"]["maxOutputMiB"],
        }, "maxOptimizerSteps": policy["maxOptimizerSteps"],
        "initializationSeed": policy["initializationSeed"],
        "recordedAtUtc": now(),
    }
    output = project_file(ROOT, logical)
    output.mkdir(parents=True, exist_ok=True)
    package_path = output / "package.json"
    if package_path.exists():
        existing = json.loads(package_path.read_text(encoding="utf-8"))
        if any(existing.get(key) != package[key] for key in package if key != "recordedAtUtc"):
            raise ValueError("V11 diagnostic package identity collision")
    elif any(output.iterdir()):
        raise ValueError("V11 diagnostic output exists without package")
    else:
        exclusive_json(package_path, package)
    return binding(f"{logical}/package.json")


def authenticate(package_binding: dict):
    package = bound_json(ROOT, package_binding)
    policy = read_policy()
    if (package.get("schemaVersion") != SCHEMA
            or package.get("scope") != policy["scope"]
            or package.get("policy") != binding(POLICY_PATH)
            or package.get("datasetManifest") != policy["datasetManifest"]
            or package.get("sample") != policy["sample"]
            or package.get("resources") != {
                "maxWallSeconds": 900, "maxGpuMemoryFraction": 0.7,
                "maxOutputMiB": 128,
            }
            or package.get("maxOptimizerSteps") != 512
            or package.get("initializationSeed") != 20260929
            or package.get("programBindings") != [binding(path) for path in PROGRAMS]):
        raise ValueError("V11 diagnostic package or program binding changed")
    output = project_file(ROOT, package["outputRoot"])
    if output != project_file(ROOT, f"{OUTPUT_PARENT}/{package['experimentIdentity']}"):
        raise ValueError("V11 diagnostic output identity changed")
    registry = json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json")
                          .read_text(encoding="utf-8"))
    active = registry.get("activeExecution")
    if (registry.get("executionState") != "executing"
            or not isinstance(active, dict)
            or active.get("runId") != package["experimentIdentity"]
            or active.get("packageId") != package["experimentIdentity"]):
        raise ValueError("V11 diagnostic has no exact registered active execution")
    return package, policy, output


def gradient_mean(value: torch.Tensor) -> torch.Tensor:
    return ((value[..., :, 1:] - value[..., :, :-1]).abs().mean()
            + (value[..., 1:, :] - value[..., :-1, :]).abs().mean()) / 2


def run(package_binding: dict) -> dict:
    package, policy, output = authenticate(package_binding)
    dataset, index, row = selected_train_sample(policy)
    sample = dataset[index]
    if sample["sampleId"] != row["sampleId"]:
        raise ValueError("V11 diagnostic selected tensor identity changed")
    torch.manual_seed(policy["initializationSeed"])
    torch.cuda.manual_seed_all(policy["initializationSeed"])
    model = build_renderer(ROOT)
    initial = state_hash(model.state_dict())
    if initial != policy["freshModelInitializationStateSha256"]:
        raise ValueError("V11 diagnostic did not start from fresh qualified initialization")
    if not torch.cuda.is_available():
        raise ValueError("V11 diagnostic CUDA unavailable")
    started = time.monotonic()
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(0.7, device)
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device)
    target = sample["image"].unsqueeze(0).to(device)
    if (conditions.shape != (1, 23, 192, 256)
            or target.shape != (1, 3, 192, 256)
            or not bool(torch.isfinite(conditions).all() and torch.isfinite(target).all())):
        raise ValueError("V11 diagnostic train tensor invalid")
    parameters = [parameter for parameter in model.parameters() if parameter.requires_grad]
    with torch.autocast("cuda", dtype=torch.float16):
        probe_prediction = model(conditions)
        probe_loss, _ = full_frame_object_context_objective(
            probe_prediction, target, conditions, model,
        )
    gradients = torch.autograd.grad(probe_loss, parameters, allow_unused=True)
    gradient_norm = sum(float(grad.detach().abs().sum()) for grad in gradients if grad is not None)
    if (not bool(torch.isfinite(probe_loss)) or not math.isfinite(gradient_norm)
            or gradient_norm <= 0
            or state_hash(model.state_dict()) != initial):
        raise ValueError("V11 diagnostic no-update GPU probe failed")
    exclusive_json(output / "gpu-probe.json", {
        "status": "no_update_gpu_probe_passed", "experimentIdentity": package["experimentIdentity"],
        "initialModelStateSha256": initial, "gradientAbsSum": gradient_norm,
        "optimizerCreated": False, "optimizerSteps": 0, "weightsModified": False,
        "recordedAtUtc": now(),
    })
    del gradients, probe_prediction, probe_loss
    optimizer = torch.optim.AdamW(parameters, lr=policy["learningRate"])
    scaler = torch.amp.GradScaler("cuda")

    def observe(step: int) -> dict:
        model.eval()
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.float16):
            prediction = model(conditions).float()
            objective, parts = full_frame_object_context_objective(
                prediction, target, conditions, model,
            )
        pred_grad = float(gradient_mean(prediction))
        ref_grad = float(gradient_mean(target))
        return {
            "optimizerSteps": step, "objective": float(objective),
            "rgbMae": float(parts["fullRgbMae"]),
            "predictedGradientMean": pred_grad, "referenceGradientMean": ref_grad,
            "gradientRatio": pred_grad / max(ref_grad, 1e-12),
            "treeSupportRgbMae": float(parts["objectSupportRgbMae"]["object_tree"]),
        }

    observations = [observe(0)]
    max_steps = policy["maxOptimizerSteps"]
    for step in range(1, max_steps + 1):
        if time.monotonic() - started > policy["resources"]["maxWallSeconds"]:
            raise TimeoutError("V11 diagnostic bounded wall time exceeded")
        model.train()
        optimizer.zero_grad(set_to_none=True)
        with torch.autocast("cuda", dtype=torch.float16):
            predicted = model(conditions)
            loss, _ = full_frame_object_context_objective(
                predicted, target, conditions, model,
            )
        if not bool(torch.isfinite(loss)):
            raise ValueError("V11 diagnostic non-finite objective")
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        if step in policy["observationSteps"]:
            observations.append(observe(step))
        if step % 32 == 0:
            peak = int(torch.cuda.max_memory_reserved(device))
            gpu_total = int(torch.cuda.get_device_properties(device).total_memory)
            if peak / gpu_total > 0.7:
                raise ValueError("V11 diagnostic GPU memory cap exceeded")
            atomic_json(output / "progress.json", {
                "experimentIdentity": package["experimentIdentity"],
                "gpuStarted": True, "trainingStarted": True,
                "optimizerSteps": step, "optimizerStepTarget": max_steps,
                "lastObservation": observations[-1], "updatedAtUtc": now(),
            })
    if len(observations) != len(policy["observationSteps"]):
        raise ValueError("V11 diagnostic observation schedule incomplete")
    final_state = {key: value.detach().cpu().clone()
                   for key, value in model.state_dict().items()}
    checkpoint_payload = {
        "schemaVersion": CHECKPOINT_SCHEMA,
        "experimentIdentity": package["experimentIdentity"],
        "sourcePackage": package_binding, "sampleId": row["sampleId"],
        "modelState": final_state, "modelStateSha256": state_hash(final_state),
        "optimizerSteps": max_steps, "formalQualificationGranted": False,
    }
    checkpoint = output / "train-only-diagnostic.pt"
    with checkpoint.open("xb") as stream:
        torch.save(checkpoint_payload, stream)
        stream.flush()
        os.fsync(stream.fileno())
    reloaded = torch.load(checkpoint, map_location="cpu", weights_only=True)
    if (reloaded["schemaVersion"] != CHECKPOINT_SCHEMA
            or state_hash(reloaded["modelState"]) != checkpoint_payload["modelStateSha256"]):
        raise ValueError("V11 diagnostic checkpoint reload differs")
    from PIL import Image
    with torch.no_grad(), torch.autocast("cuda", dtype=torch.float16):
        preview = model(conditions)[0].float().clamp(0, 1).mul(255).round().byte()
    preview_path = output / "train-only-preview.png"
    Image.fromarray(preview.permute(1, 2, 0).cpu().numpy()).save(preview_path, format="PNG")
    if (checkpoint.stat().st_size + preview_path.stat().st_size
            > policy["resources"]["maxOutputMiB"] * 1024 * 1024):
        raise ValueError("V11 diagnostic output budget exceeded")
    if [binding(path) for path in PROGRAMS] != package["programBindings"]:
        raise ValueError("V11 diagnostic program changed during run")
    result = {
        "schemaVersion": "stage4-mvp-v11-train-only-capacity-probe-result-v1",
        "status": "experiment_executed_not_visual_qualified",
        "experimentIdentity": package["experimentIdentity"],
        "scope": policy["scope"], "sampleId": row["sampleId"],
        "datasetManifest": package["datasetManifest"],
        "gpuStarted": True, "trainingStarted": True,
        "optimizerSteps": max_steps, "initialModelStateSha256": initial,
        "finalModelStateSha256": checkpoint_payload["modelStateSha256"],
        "checkpointReloadExact": True, "observations": observations,
        "trainOnly": True, "validationRead": False, "challengeRead": False,
        "regressionRead": False, "formalQualificationGranted": False,
        "checkpointPromotable": False, "automaticRetryStarted": False,
        "peakGpuReservedBytes": int(torch.cuda.max_memory_reserved(device)),
        "gpuTotalBytes": int(torch.cuda.get_device_properties(device).total_memory),
        "artifacts": [
            binding(f"{package['outputRoot']}/gpu-probe.json"),
            binding(f"{package['outputRoot']}/train-only-diagnostic.pt"),
            binding(f"{package['outputRoot']}/train-only-preview.png"),
        ], "recordedAtUtc": now(),
    }
    exclusive_json(output / "result.json", result)
    return result


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "run"))
    parser.add_argument("--policy")
    parser.add_argument("--package")
    parser.add_argument("--sha256")
    args = parser.parse_args()
    try:
        if args.mode == "prepare":
            if args.policy != POLICY_PATH:
                raise ValueError("V11 diagnostic exact policy argument required")
            print(json.dumps(prepare(), ensure_ascii=False), flush=True)
        else:
            if not args.package or not args.sha256:
                raise ValueError("V11 diagnostic bound package required")
            result = run({"path": args.package, "sha256": args.sha256})
            print(json.dumps({"status": result["status"],
                              "optimizerSteps": result["optimizerSteps"]}), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

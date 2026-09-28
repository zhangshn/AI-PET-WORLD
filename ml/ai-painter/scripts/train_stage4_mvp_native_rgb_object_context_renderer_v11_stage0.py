"""Bounded V11 full-frame Stage0 worker; only callable by the registered lifecycle."""

from argparse import ArgumentParser
import io
import json
from pathlib import Path
import random
import sys

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
    CAPABILITY_VERSION, build_renderer, full_frame_object_context_objective,
    load_contract,
)
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import read_json  # noqa: E402
import train_stage4_mvp_native_rgb_renderer_v6_stage0 as base  # noqa: E402


PACKAGE_SCHEMA = "ai-painter-stage4-mvp-native-rgb-object-context-renderer-v11-formal-stage-execution-package-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-native-rgb-object-context-renderer-v11-checkpoint-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-stage0-training-terminal-v1"
EPOCH_SCHEMA = "ai-painter-stage4-mvp-object-context-renderer-v11-epoch-v1"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 24}
SEED = 20260929
OPTIMIZER_STEPS = 1152
CHECKPOINT_NAME = "stage0-native-rgb-object-context-v11.pt"


def authenticate(package_binding: dict):
    package = bound_json(ROOT, package_binding)
    contract, _ = load_contract(ROOT)
    expected_dataset = {key: contract["datasetBinding"][key] for key in ("path", "sha256")}
    if (package.get("schemaVersion") != PACKAGE_SCHEMA
            or package.get("capabilityVersion") != CAPABILITY_VERSION
            or package.get("stage") != STAGE
            or package.get("datasetManifest") != expected_dataset
            or package.get("ticketConsumptionRequired") is not True
            or package.get("permittedSplits") != ["train", "validation"]
            or package.get("forbiddenSplits") != ["challenge", "regression"]):
        raise ValueError("V11 execution package identity or split boundary invalid")
    budget = package.get("resourceBudget", {})
    if (budget.get("maxEpochs") != 24 or budget.get("maxOptimizerSteps") != OPTIMIZER_STEPS
            or budget.get("maxGpuMemoryFraction") != 0.7):
        raise ValueError("V11 execution resource budget invalid")
    cpu = bound_json(ROOT, package["cpuQualification"])
    gpu = bound_json(ROOT, package["gpuQualification"])
    if (cpu.get("status") != "cpu_contract_passed_training_still_disabled"
            or cpu.get("capabilityVersion") != CAPABILITY_VERSION
            or cpu.get("dataset") != contract["datasetBinding"]
            or cpu.get("trainingStarted") is not False
            or gpu.get("status") != "readonly_gpu_qualification_passed"
            or gpu.get("capabilityVersion") != CAPABILITY_VERSION
            or gpu.get("cpuQualification") != package["cpuQualification"]
            or gpu.get("datasetManifest") != expected_dataset
            or gpu.get("optimizerSteps") != 0
            or gpu.get("weightsModified") is not False
            or gpu.get("trainingStarted") is not False
            or package.get("formalInitializationSha256") != gpu.get("formalInitializationSha256")):
        raise ValueError("V11 current candidate CPU/GPU evidence invalid")
    for binding in package["programBindings"]:
        if base.digest(project_file(ROOT, binding["path"]).read_bytes()) != binding["sha256"]:
            raise ValueError("V11 execution program binding changed")
    registry = read_json(
        ROOT / ".runtime" / "ai-painter" / "current-execution-registry" / "current.json",
        "current execution registry",
    )
    active = registry.get("activeExecution")
    if (not isinstance(active, dict) or active.get("runId") != package.get("runId")
            or active.get("packageId") != package.get("packageId")
            or active.get("capabilityVersion") != CAPABILITY_VERSION
            or registry.get("executionState") != "executing"):
        raise ValueError("V11 execution is not the registered active task")
    return package, contract, gpu


def _scalar(parts: dict) -> dict:
    return {
        "total": float(parts["total"].detach()),
        "fullRgbMae": float(parts["fullRgbMae"].detach()),
        "fullRgbGradientMae": float(parts["fullRgbGradientMae"].detach()),
        "objectSupportRgbMae": {
            key: float(value.detach()) for key, value in parts["objectSupportRgbMae"].items()
        },
    }


def _average(rows: list[dict]) -> dict:
    return {
        "total": sum(row["total"] for row in rows) / len(rows),
        "fullRgbMae": sum(row["fullRgbMae"] for row in rows) / len(rows),
        "fullRgbGradientMae": sum(row["fullRgbGradientMae"] for row in rows) / len(rows),
        "objectSupportRgbMae": {
            key: sum(row["objectSupportRgbMae"][key] for row in rows) / len(rows)
            for key in rows[0]["objectSupportRgbMae"]
        },
    }


def run(package_binding: dict) -> dict:
    package, contract, gpu = authenticate(package_binding)
    train_data = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation_data = SplitReleaseDataset(ROOT, package["datasetManifest"], "validation", (256, 192))
    if (len(train_data) != 48 or len(validation_data) != 8
            or train_data.manifest["qualification"]["dataQualifiedForTraining"] is not True):
        raise ValueError("V11 exact dataset capacity or qualification changed")
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    random.seed(SEED)
    model = build_renderer(ROOT)
    initial = state_hash(model.state_dict())
    if initial != gpu["modelInitializationStateSha256"] or gpu["initialization"]["modelStateSha256"] != initial:
        raise ValueError("V11 trained model initialization differs from GPU qualification")
    if not torch.cuda.is_available():
        raise ValueError("V11 CUDA unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(0.7, device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    parameters = [parameter for parameter in model.parameters() if parameter.requires_grad]
    if any(parameter.requires_grad for identity in model.support_radii
           for parameter in model.core.responsibility_heads[identity].parameters()):
        raise ValueError("V11 replaced old typed heads are trainable")
    optimizer = torch.optim.AdamW(parameters, lr=1e-4)
    scaler = torch.amp.GradScaler("cuda")
    train = base.cache_split(train_data)
    validation = base.cache_split(validation_data)
    output_root = package["outputRoot"]
    epochs_root = project_file(ROOT, output_root + "/epochs")
    epochs_root.mkdir(parents=True, exist_ok=True)
    progress_path = project_file(ROOT, output_root + "/progress.json")
    best_score, best_epoch, best_state = float("inf"), None, None
    optimizer_steps = 0
    for epoch in range(1, STAGE["epochCount"] + 1):
        model.train()
        indices = list(range(len(train)))
        random.Random(SEED + epoch).shuffle(indices)
        train_rows = []
        for index in indices:
            sample = train[index]
            conditions = sample["conditions"].unsqueeze(0).to(device, non_blocking=True)
            target = sample["image"].unsqueeze(0).to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                predicted = model(conditions)
                loss, parts = full_frame_object_context_objective(
                    predicted, target, conditions, model,
                )
            if not bool(torch.isfinite(loss)):
                raise ValueError("V11 non-finite train objective")
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer_steps += 1
            train_rows.append(_scalar(parts))
            del conditions, target, predicted, loss, parts
        model.eval()
        validation_rows = []
        with torch.no_grad():
            for sample in validation:
                conditions = sample["conditions"].unsqueeze(0).to(device, non_blocking=True)
                target = sample["image"].unsqueeze(0).to(device, non_blocking=True)
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    predicted = model(conditions)
                    loss, parts = full_frame_object_context_objective(
                        predicted, target, conditions, model,
                    )
                if not bool(torch.isfinite(loss)):
                    raise ValueError("V11 non-finite validation objective")
                validation_rows.append(_scalar(parts))
                del conditions, target, predicted, loss, parts
        train_metrics, validation_metrics = _average(train_rows), _average(validation_rows)
        score = validation_metrics["total"]
        if score < best_score:
            best_score, best_epoch = score, epoch
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
        base.write_atomic(epochs_root / f"epoch-{epoch:02d}.json", {
            "schemaVersion": EPOCH_SCHEMA, "runId": package["runId"],
            "epoch": epoch, "optimizerSteps": optimizer_steps,
            "train": train_metrics, "validation": validation_metrics,
            "checkpointSelectionScore": score, "bestEpochSoFar": best_epoch,
            "bestScoreSoFar": best_score, "challengeRead": False,
            "regressionRead": False, "recordedAtUtc": base.utc_now(),
        })
        base.write_atomic(progress_path, {
            "schemaVersion": "ai-painter-stage4-mvp-stage0-training-progress-v1",
            "capabilityVersion": CAPABILITY_VERSION, "runId": package["runId"],
            "phase": "training", "epoch": epoch, "epochTarget": STAGE["epochCount"],
            "optimizerSteps": optimizer_steps, "optimizerStepTarget": OPTIMIZER_STEPS,
            "checkpointSelectionScore": score, "bestEpoch": best_epoch,
            "bestScore": best_score, "updatedAtUtc": base.utc_now(),
        })
    if optimizer_steps != OPTIMIZER_STEPS or best_state is None or best_epoch is None:
        raise ValueError("V11 bounded training schedule incomplete")
    model.load_state_dict(best_state, strict=True)
    selected_sha = state_hash(model.state_dict())
    payload = {
        "schemaVersion": CHECKPOINT_SCHEMA, "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": contract["architectureId"],
        "executionIdentity": {"batchRunId": package["batchRunId"],
                              "runId": package["runId"], "packageId": package["packageId"],
                              "executionPackage": package_binding},
        "stage": STAGE, "datasetManifest": package["datasetManifest"],
        "candidateContract": gpu["candidateContract"],
        "formalInitializationSha256": package["formalInitializationSha256"],
        "modelState": best_state, "modelStateSha256": selected_sha,
        "bestEpoch": best_epoch, "bestValidationMetric": best_score,
        "completedEpochs": STAGE["epochCount"], "optimizerSteps": optimizer_steps,
        "machineReviewPending": True, "formalInferenceEligible": False,
        "checkpointPromotionEligible": False, "automaticRetryStarted": False,
    }
    buffer = io.BytesIO()
    torch.save(payload, buffer)
    checkpoint_logical = output_root + "/" + CHECKPOINT_NAME
    base.write_exclusive_bytes(project_file(ROOT, checkpoint_logical), buffer.getvalue())
    checkpoint_binding = base.bind(checkpoint_logical)
    reloaded = torch.load(io.BytesIO(project_file(ROOT, checkpoint_logical).read_bytes()),
                          map_location="cpu", weights_only=True)
    if reloaded.get("schemaVersion") != CHECKPOINT_SCHEMA or state_hash(reloaded["modelState"]) != selected_sha:
        raise ValueError("V11 checkpoint reload identity mismatch")
    peak = int(torch.cuda.max_memory_reserved(device))
    total = int(torch.cuda.get_device_properties(device).total_memory)
    if peak / total > 0.7:
        raise ValueError("V11 GPU resource cap exceeded")
    for binding in package["programBindings"]:
        if base.digest(project_file(ROOT, binding["path"]).read_bytes()) != binding["sha256"]:
            raise ValueError("V11 program changed during training")
    return {
        "schemaVersion": TERMINAL_SCHEMA,
        "status": "training_completed_review_pending", "executionState": "completed",
        "capabilityVersion": CAPABILITY_VERSION, "architectureId": contract["architectureId"],
        "batchRunId": package["batchRunId"], "runId": package["runId"],
        "packageId": package["packageId"], "stage": STAGE,
        "executionPackage": package_binding, "datasetManifest": package["datasetManifest"],
        "cpuQualification": package["cpuQualification"],
        "gpuQualification": package["gpuQualification"],
        "checkpoint": checkpoint_binding, "modelStateSha256": selected_sha,
        "selectedEpoch": best_epoch, "selectedScore": best_score,
        "completedEpochs": STAGE["epochCount"], "optimizerSteps": optimizer_steps,
        "nonTrainOptimizerSteps": 0, "checkpointReloadVerified": True,
        "challengeRead": False, "regressionRead": False,
        "persistentDerivedTrainingImagesWritten": False,
        "gpuStarted": True, "trainingStarted": True,
        "peakGpuReservedBytes": peak, "gpuTotalBytes": total,
        "stagePassed": False, "machineReviewPending": True,
        "automaticRetryStarted": False, "recordedAtUtc": base.utc_now(),
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    binding = {"path": args.execution_package.replace("\\", "/"),
               "sha256": args.execution_package_sha256}
    try:
        result = run(binding)
        output = project_file(ROOT, args.output.replace("\\", "/"))
        base.write_atomic(output, result)
        print(json.dumps({"status": result["status"],
                          "terminal": base.bind(args.output.replace("\\", "/"))},
                         ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

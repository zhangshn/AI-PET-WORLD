from __future__ import annotations

"""Run one bounded 256x192 Stage0 training for the native complete-RGB V6 model."""

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import random
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, canonical_bytes, digest, project_file,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (  # noqa: E402
    CAPABILITY_VERSION, build_renderer, load_contract, native_rgb_objective,
)


PACKAGE_SCHEMA = "ai-painter-stage4-mvp-native-rgb-renderer-v6-formal-stage-execution-package-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-terminal-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-native-rgb-renderer-v6-checkpoint-v1"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
SEED = 20260924


def require(value, message: str) -> None:
    if not value:
        raise ValueError(message)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(logical: str) -> dict:
    data = project_file(ROOT, logical).read_bytes()
    return {"path": logical, "sha256": digest(data)}


def write_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(path.name + f".staged-{os.getpid()}")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def write_exclusive_bytes(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(value)
        stream.flush()
        os.fsync(stream.fileno())


def initialization_identity(contract: dict, model_state_sha256: str) -> tuple[dict, str]:
    value = {
        "schemaVersion": "stage4-mvp-native-complete-rgb-renderer-v6-initialization-v1",
        "capabilityVersion": CAPABILITY_VERSION,
        "seed": SEED,
        "candidateContract": {
            "path": "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-renderer-v6-contract.json",
            "sha256": digest(project_file(ROOT, "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-renderer-v6-contract.json").read_bytes()),
        },
        "datasetBinding": contract["datasetBinding"],
        "modelStateSha256": model_state_sha256,
    }
    return value, digest(canonical_bytes(value))


def authenticate(package_binding: dict) -> tuple[dict, dict, dict]:
    package = bound_json(ROOT, package_binding)
    require(package.get("schemaVersion") == PACKAGE_SCHEMA, "V6 execution package schema invalid")
    require(package.get("capabilityVersion") == CAPABILITY_VERSION and package.get("stage") == STAGE,
            "V6 Stage0 identity invalid")
    contract, _ = load_contract(ROOT)
    require(package.get("datasetManifest") == {
                "path": contract["datasetBinding"]["path"],
                "sha256": contract["datasetBinding"]["sha256"],
            },
            "V6 execution Dataset differs from candidate contract")
    cpu = bound_json(ROOT, package["cpuQualification"])
    gpu = bound_json(ROOT, package["gpuQualification"])
    require(cpu.get("status") == "cpu_contract_passed_training_still_disabled"
            and cpu.get("capabilityVersion") == CAPABILITY_VERSION
            and cpu.get("dataset", {}).get("path") == package["datasetManifest"]["path"]
            and cpu.get("dataset", {}).get("sha256") == package["datasetManifest"]["sha256"],
            "V6 CPU qualification invalid")
    require(gpu.get("status") == "readonly_gpu_qualification_passed"
            and gpu.get("capabilityVersion") == CAPABILITY_VERSION
            and gpu.get("datasetManifest") == package["datasetManifest"]
            and gpu.get("cpuQualification") == package["cpuQualification"]
            and gpu.get("trainingAllowedByThisArtifact") is True
            and gpu.get("optimizerSteps") == 0
            and gpu.get("weightsModified") is False,
            "V6 GPU qualification invalid")
    require(package.get("formalInitializationSha256") == gpu.get("formalInitializationSha256"),
            "V6 qualified initialization binding changed")
    budget = package.get("resourceBudget", {})
    require(budget.get("maxEpochs") == 40 and budget.get("maxOptimizerSteps") == 1920
            and 0 < float(budget.get("maxGpuMemoryFraction", 0)) <= 0.70,
            "V6 resource budget changed")
    require(package.get("permittedSplits") == ["train", "validation"]
            and package.get("forbiddenSplits") == ["challenge", "regression"],
            "V6 split boundary changed")
    return package, contract, gpu


def cache_split(dataset: SplitReleaseDataset) -> list[dict]:
    return [{
        "sampleId": sample["sampleId"],
        "image": sample["image"].contiguous(),
        "conditions": sample["conditions"].contiguous(),
    } for sample in (dataset[index] for index in range(len(dataset)))]


def scalar_components(components: dict) -> dict:
    return {
        "total": float(components["total"].detach()),
        "fullRgbMae": float(components["fullRgbMae"].detach()),
        "fullRgbGradientMae": float(components["fullRgbGradientMae"].detach()),
        "fullRgbLaplacianMae": float(components["fullRgbLaplacianMae"].detach()),
        "responsibilityRgbMae": {
            key: float(value.detach()) for key, value in components["responsibilityRgbMae"].items()
        },
    }


def average_rows(rows: list[dict]) -> dict:
    result = {key: sum(row[key] for row in rows) / len(rows)
              for key in ("total", "fullRgbMae", "fullRgbGradientMae", "fullRgbLaplacianMae")}
    identities = rows[0]["responsibilityRgbMae"]
    result["responsibilityRgbMae"] = {
        key: sum(row["responsibilityRgbMae"][key] for row in rows) / len(rows)
        for key in identities
    }
    return result


def run(package_binding: dict) -> dict:
    package, contract, gpu = authenticate(package_binding)
    train_dataset = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation_dataset = SplitReleaseDataset(ROOT, package["datasetManifest"], "validation", (256, 192))
    require(len(train_dataset) == 48 and len(validation_dataset) == 8,
            "V6 exact split capacity changed")
    require(train_dataset.manifest.get("qualification", {}).get("dataQualifiedForTraining") is True,
            "V6 Dataset training qualification missing")

    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    random.seed(SEED)
    model = build_renderer(ROOT)
    initial_state = state_hash(model.state_dict())
    initialization, initialization_sha = initialization_identity(contract, initial_state)
    require(initial_state == gpu.get("modelInitializationStateSha256")
            and initialization == gpu.get("initialization")
            and initialization_sha == package["formalInitializationSha256"],
            "V6 model initialization does not reproduce GPU qualification")

    require(torch.cuda.is_available(), "V6 Stage0 CUDA unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    scaler = torch.amp.GradScaler("cuda")
    train = cache_split(train_dataset)
    validation = cache_split(validation_dataset)
    output_root = package["outputRoot"]
    progress_path = project_file(ROOT, output_root + "/progress.json")
    epochs_root = project_file(ROOT, output_root + "/epochs")
    epochs_root.mkdir(parents=True, exist_ok=True)
    objective = contract["trainingObjective"]
    best_epoch = None
    best_score = float("inf")
    best_state = None
    optimizer_steps = 0

    for epoch in range(1, 41):
        model.train()
        order = list(range(len(train)))
        random.Random(SEED + epoch).shuffle(order)
        train_rows = []
        for index in order:
            sample = train[index]
            conditions = sample["conditions"].unsqueeze(0).to(device, non_blocking=True)
            target = sample["image"].unsqueeze(0).to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                predicted = model(conditions)
                loss, components = native_rgb_objective(
                    predicted, target, conditions, model, objective,
                )
            require(bool(torch.isfinite(loss)), "V6 non-finite train objective")
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer_steps += 1
            train_rows.append(scalar_components(components))
            del conditions, target, predicted, loss, components

        model.eval()
        validation_rows = []
        with torch.no_grad():
            for sample in validation:
                conditions = sample["conditions"].unsqueeze(0).to(device, non_blocking=True)
                target = sample["image"].unsqueeze(0).to(device, non_blocking=True)
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    predicted = model(conditions)
                    loss, components = native_rgb_objective(
                        predicted, target, conditions, model, objective,
                    )
                require(bool(torch.isfinite(loss)), "V6 non-finite validation objective")
                validation_rows.append(scalar_components(components))
                del conditions, target, predicted, loss, components
        train_metrics = average_rows(train_rows)
        validation_metrics = average_rows(validation_rows)
        score = validation_metrics["total"]
        if score < best_score:
            best_score = score
            best_epoch = epoch
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
        evidence = {
            "schemaVersion": "ai-painter-stage4-mvp-native-rgb-renderer-v6-epoch-v1",
            "runId": package["runId"], "epoch": epoch, "optimizerSteps": optimizer_steps,
            "train": train_metrics, "validation": validation_metrics,
            "checkpointSelectionScore": score,
            "bestEpochSoFar": best_epoch, "bestScoreSoFar": best_score,
            "challengeRead": False, "regressionRead": False, "recordedAtUtc": utc_now(),
        }
        write_atomic(epochs_root / f"epoch-{epoch:02d}.json", evidence)
        write_atomic(progress_path, {
            "schemaVersion": "ai-painter-stage4-mvp-native-rgb-renderer-v6-progress-v1",
            "runId": package["runId"], "phase": "training", "epoch": epoch,
            "epochTarget": 40, "optimizerSteps": optimizer_steps,
            "optimizerStepTarget": 1920, "checkpointSelectionScore": score,
            "bestEpoch": best_epoch, "bestScore": best_score, "updatedAtUtc": utc_now(),
        })

    require(optimizer_steps == 1920 and best_state is not None and best_epoch is not None,
            "V6 bounded schedule incomplete")
    model.load_state_dict(best_state, strict=True)
    selected_state_sha = state_hash(model.state_dict())
    checkpoint_payload = {
        "schemaVersion": CHECKPOINT_SCHEMA,
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": contract["architectureId"],
        "executionIdentity": {
            "batchRunId": package["batchRunId"], "runId": package["runId"],
            "packageId": package["packageId"], "executionPackage": package_binding,
        },
        "stage": STAGE, "datasetManifest": package["datasetManifest"],
        "candidateContract": gpu["candidateContract"],
        "formalInitializationSha256": package["formalInitializationSha256"],
        "modelState": best_state, "modelStateSha256": selected_state_sha,
        "bestEpoch": best_epoch, "bestValidationMetric": best_score,
        "completedEpochs": 40, "optimizerSteps": optimizer_steps,
        "machineReviewPending": True, "formalInferenceEligible": False,
        "checkpointPromotionEligible": False, "automaticRetryStarted": False,
    }
    buffer = io.BytesIO()
    torch.save(checkpoint_payload, buffer)
    checkpoint_logical = output_root + "/stage0-native-rgb-v6.pt"
    write_exclusive_bytes(project_file(ROOT, checkpoint_logical), buffer.getvalue())
    checkpoint_binding = bind(checkpoint_logical)
    reloaded = torch.load(io.BytesIO(project_file(ROOT, checkpoint_logical).read_bytes()),
                          map_location="cpu", weights_only=True)
    require(reloaded.get("schemaVersion") == CHECKPOINT_SCHEMA
            and state_hash(reloaded["modelState"]) == selected_state_sha,
            "V6 checkpoint reload identity mismatch")
    peak_reserved = int(torch.cuda.max_memory_reserved(device))
    total_memory = int(torch.cuda.get_device_properties(device).total_memory)
    require(peak_reserved / total_memory <= package["resourceBudget"]["maxGpuMemoryFraction"],
            "V6 Stage0 GPU resource cap exceeded")
    return {
        "schemaVersion": TERMINAL_SCHEMA,
        "status": "training_completed_review_pending", "executionState": "completed",
        "capabilityVersion": CAPABILITY_VERSION, "architectureId": contract["architectureId"],
        "batchRunId": package["batchRunId"], "runId": package["runId"],
        "packageId": package["packageId"], "stage": STAGE,
        "executionPackage": package_binding, "datasetManifest": package["datasetManifest"],
        "cpuQualification": package["cpuQualification"],
        "gpuQualification": package["gpuQualification"],
        "checkpoint": checkpoint_binding, "modelStateSha256": selected_state_sha,
        "selectedEpoch": best_epoch, "selectedScore": best_score,
        "completedEpochs": 40, "optimizerSteps": optimizer_steps,
        "nonTrainOptimizerSteps": 0, "checkpointReloadVerified": True,
        "challengeRead": False, "regressionRead": False,
        "gpuStarted": True, "trainingStarted": True,
        "peakGpuReservedBytes": peak_reserved, "gpuTotalBytes": total_memory,
        "stagePassed": False, "machineReviewPending": True,
        "automaticRetryStarted": False, "recordedAtUtc": utc_now(),
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    package = {"path": args.execution_package.replace("\\", "/"),
               "sha256": args.execution_package_sha256}
    try:
        result = run(package)
        output = project_file(ROOT, args.output.replace("\\", "/"))
        write_atomic(output, result)
        print(json.dumps({"status": result["status"], "terminal": bind(args.output.replace("\\", "/"))},
                         ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

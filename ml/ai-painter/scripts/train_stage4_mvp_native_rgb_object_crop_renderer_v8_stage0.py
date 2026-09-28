from __future__ import annotations

"""Bounded V8 Stage0 training: one full frame plus one in-memory object crop."""

import io
from pathlib import Path
import random
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

import train_stage4_mvp_native_rgb_renderer_v6_stage0 as base  # noqa: E402
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, canonical_bytes, digest, project_file,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8 import (  # noqa: E402
    CAPABILITY_VERSION, CONTRACT_PATH, OBJECT_CROP_IDENTITIES, build_renderer,
    deterministic_object_crop, load_contract, native_rgb_objective,
)
from train_stage4_mvp_native_rgb_detail_renderer_v7_stage0 import (  # noqa: E402
    average_rows, scalar_components,
)


SEED = 20260926
PACKAGE_SCHEMA = "ai-painter-stage4-mvp-native-rgb-object-crop-renderer-v8-formal-stage-execution-package-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-stage0-training-terminal-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-native-rgb-object-crop-renderer-v8-checkpoint-v1"
EPOCH_SCHEMA = "ai-painter-stage4-mvp-object-crop-renderer-v8-epoch-v1"
CHECKPOINT_FILENAME = "stage0-native-rgb-object-crop-v8.pt"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
OPTIMIZER_STEP_TARGET = 3840


def initialization_identity(contract: dict, model_state_sha256: str) -> tuple[dict, str]:
    value = {
        "schemaVersion": "ai-painter-stage4-mvp-stage0-training-initialization-v1",
        "capabilityVersion": CAPABILITY_VERSION,
        "seed": SEED,
        "candidateContract": {
            "path": CONTRACT_PATH,
            "sha256": digest(project_file(ROOT, CONTRACT_PATH).read_bytes()),
        },
        "datasetBinding": contract["datasetBinding"],
        "modelStateSha256": model_state_sha256,
    }
    return value, digest(canonical_bytes(value))


def authenticate(package_binding: dict) -> tuple[dict, dict, dict]:
    package = bound_json(ROOT, package_binding)
    base.require(package.get("schemaVersion") == PACKAGE_SCHEMA, "V8 execution package schema invalid")
    base.require(package.get("capabilityVersion") == CAPABILITY_VERSION and package.get("stage") == STAGE,
                 "V8 Stage0 identity invalid")
    contract, _ = load_contract(ROOT)
    expected_dataset = {
        "path": contract["datasetBinding"]["path"],
        "sha256": contract["datasetBinding"]["sha256"],
    }
    base.require(package.get("datasetManifest") == expected_dataset,
                 "V8 execution Dataset differs from candidate contract")
    cpu = bound_json(ROOT, package["cpuQualification"])
    gpu = bound_json(ROOT, package["gpuQualification"])
    base.require(
        cpu.get("status") == "cpu_contract_passed_training_still_disabled"
        and cpu.get("capabilityVersion") == CAPABILITY_VERSION
        and cpu.get("cropCurriculum", {}).get("sampleCount") == 48
        and cpu.get("cropCurriculum", {}).get("allCropsContainTargetObject") is True
        and cpu.get("cropCurriculum", {}).get("persistentDerivedImagesWritten") is False,
        "V8 CPU qualification invalid",
    )
    base.require(
        gpu.get("status") == "readonly_gpu_qualification_passed"
        and gpu.get("capabilityVersion") == CAPABILITY_VERSION
        and gpu.get("datasetManifest") == package["datasetManifest"]
        and gpu.get("cpuQualification") == package["cpuQualification"]
        and gpu.get("trainingAllowedByThisArtifact") is True
        and gpu.get("optimizerSteps") == 0
        and gpu.get("weightsModified") is False,
        "V8 GPU qualification invalid",
    )
    base.require(package.get("formalInitializationSha256") == gpu.get("formalInitializationSha256"),
                 "V8 qualified initialization binding changed")
    budget = package.get("resourceBudget", {})
    base.require(
        budget.get("maxEpochs") == STAGE["epochCount"]
        and budget.get("maxOptimizerSteps") == OPTIMIZER_STEP_TARGET
        and 0 < float(budget.get("maxGpuMemoryFraction", 0)) <= 0.70,
        "V8 resource budget changed",
    )
    base.require(package.get("permittedSplits") == ["train", "validation"]
                 and package.get("forbiddenSplits") == ["challenge", "regression"],
                 "V8 split boundary changed")
    return package, contract, gpu


def run(package_binding: dict) -> dict:
    package, contract, gpu = authenticate(package_binding)
    train_dataset = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation_dataset = SplitReleaseDataset(ROOT, package["datasetManifest"], "validation", (256, 192))
    base.require(len(train_dataset) == 48 and len(validation_dataset) == 8,
                 "V8 exact split capacity changed")
    base.require(train_dataset.manifest.get("qualification", {}).get("dataQualifiedForTraining") is True,
                 "V8 Dataset training qualification missing")

    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    random.seed(SEED)
    model = build_renderer(ROOT)
    initial_state = state_hash(model.state_dict())
    initialization, initialization_sha = initialization_identity(contract, initial_state)
    base.require(
        initial_state == gpu.get("modelInitializationStateSha256")
        and initialization == gpu.get("initialization")
        and initialization_sha == package["formalInitializationSha256"],
        "V8 model initialization does not reproduce GPU qualification",
    )
    base.require(torch.cuda.is_available(), "V8 Stage0 CUDA unavailable")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    scaler = torch.amp.GradScaler("cuda")
    train = base.cache_split(train_dataset)
    validation = base.cache_split(validation_dataset)
    output_root = package["outputRoot"]
    progress_path = project_file(ROOT, output_root + "/progress.json")
    epochs_root = project_file(ROOT, output_root + "/epochs")
    epochs_root.mkdir(parents=True, exist_ok=True)
    objective = contract["trainingObjective"]
    best_epoch, best_state = None, None
    best_score = float("inf")
    optimizer_steps = 0

    for epoch in range(1, STAGE["epochCount"] + 1):
        model.train()
        order = list(range(len(train)))
        random.Random(SEED + epoch).shuffle(order)
        train_rows = []
        crop_histogram = {identity: 0 for identity in OBJECT_CROP_IDENTITIES}
        for index in order:
            sample = train[index]
            cropped, crop_evidence = deterministic_object_crop(
                sample, responsibility_indices=model.responsibility_indices,
                epoch=epoch, sample_index=index, seed=SEED,
            )
            crop_histogram[crop_evidence["identity"]] += 1
            for variant in (sample, cropped):
                conditions = variant["conditions"].unsqueeze(0).to(device, non_blocking=True)
                target = variant["image"].unsqueeze(0).to(device, non_blocking=True)
                optimizer.zero_grad(set_to_none=True)
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    predicted = model(conditions)
                    loss, components = native_rgb_objective(
                        predicted, target, conditions, model, objective,
                    )
                base.require(bool(torch.isfinite(loss)), "V8 non-finite train objective")
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
                base.require(bool(torch.isfinite(loss)), "V8 non-finite validation objective")
                validation_rows.append(scalar_components(components))
                del conditions, target, predicted, loss, components
        train_metrics = average_rows(train_rows)
        validation_metrics = average_rows(validation_rows)
        score = validation_metrics["total"]
        if score < best_score:
            best_score, best_epoch = score, epoch
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
        evidence = {
            "schemaVersion": EPOCH_SCHEMA,
            "runId": package["runId"], "epoch": epoch, "optimizerSteps": optimizer_steps,
            "train": train_metrics, "validation": validation_metrics,
            "objectCropHistogram": crop_histogram,
            "checkpointSelectionScore": score, "bestEpochSoFar": best_epoch,
            "bestScoreSoFar": best_score, "challengeRead": False,
            "regressionRead": False, "recordedAtUtc": base.utc_now(),
        }
        base.write_atomic(epochs_root / f"epoch-{epoch:02d}.json", evidence)
        base.write_atomic(progress_path, {
            "schemaVersion": "ai-painter-stage4-mvp-stage0-training-progress-v1",
            "capabilityVersion": CAPABILITY_VERSION,
            "runId": package["runId"], "phase": "training", "epoch": epoch,
            "epochTarget": STAGE["epochCount"], "optimizerSteps": optimizer_steps,
            "optimizerStepTarget": OPTIMIZER_STEP_TARGET,
            "checkpointSelectionScore": score, "bestEpoch": best_epoch,
            "bestScore": best_score, "updatedAtUtc": base.utc_now(),
        })

    base.require(optimizer_steps == OPTIMIZER_STEP_TARGET
                 and best_state is not None and best_epoch is not None,
                 "V8 bounded schedule incomplete")
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
        "completedEpochs": STAGE["epochCount"], "optimizerSteps": optimizer_steps,
        "trainingCurriculum": contract["trainingCurriculum"],
        "machineReviewPending": True, "formalInferenceEligible": False,
        "checkpointPromotionEligible": False, "automaticRetryStarted": False,
    }
    buffer = io.BytesIO()
    torch.save(checkpoint_payload, buffer)
    checkpoint_logical = output_root + "/" + CHECKPOINT_FILENAME
    base.write_exclusive_bytes(project_file(ROOT, checkpoint_logical), buffer.getvalue())
    checkpoint_binding = base.bind(checkpoint_logical)
    reloaded = torch.load(io.BytesIO(project_file(ROOT, checkpoint_logical).read_bytes()),
                          map_location="cpu", weights_only=True)
    base.require(reloaded.get("schemaVersion") == CHECKPOINT_SCHEMA
                 and state_hash(reloaded["modelState"]) == selected_state_sha,
                 "V8 checkpoint reload identity mismatch")
    peak_reserved = int(torch.cuda.max_memory_reserved(device))
    total_memory = int(torch.cuda.get_device_properties(device).total_memory)
    base.require(peak_reserved / total_memory <= package["resourceBudget"]["maxGpuMemoryFraction"],
                 "V8 Stage0 GPU resource cap exceeded")
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
        "completedEpochs": STAGE["epochCount"], "optimizerSteps": optimizer_steps,
        "nonTrainOptimizerSteps": 0, "checkpointReloadVerified": True,
        "challengeRead": False, "regressionRead": False,
        "persistentDerivedTrainingImagesWritten": False,
        "gpuStarted": True, "trainingStarted": True,
        "peakGpuReservedBytes": peak_reserved, "gpuTotalBytes": total_memory,
        "stagePassed": False, "machineReviewPending": True,
        "automaticRetryStarted": False, "recordedAtUtc": base.utc_now(),
    }


def configure() -> None:
    base.PACKAGE_SCHEMA = PACKAGE_SCHEMA
    base.TERMINAL_SCHEMA = TERMINAL_SCHEMA
    base.CHECKPOINT_SCHEMA = CHECKPOINT_SCHEMA
    base.STAGE = STAGE
    base.SEED = SEED
    base.CAPABILITY_VERSION = CAPABILITY_VERSION
    base.run = run


def main() -> int:
    configure()
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())

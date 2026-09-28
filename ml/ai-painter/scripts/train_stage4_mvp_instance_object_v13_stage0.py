"""Bound V13 Stage0 worker. Inactive until one verified local execution package binds it.

Only train RGB updates weights; validation RGB selects the Checkpoint. This worker
does not grant review, Stage4, GPU qualification, or Runtime authority.
"""

from argparse import ArgumentParser
import io
import json
from pathlib import Path
import random
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml/ai-painter/src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
    train_original_instance_objective,
    validation_instance_object_score,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (  # noqa: E402
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from check_stage4_mvp_instance_object_v13_cpu import (  # noqa: E402
    ARCHITECTURE, CAPABILITY, CONTRACT_PATH, SEED, verify_contract,
)
import train_stage4_mvp_native_rgb_renderer_v6_stage0 as base  # noqa: E402


PACKAGE_SCHEMA = "ai-painter-stage4-mvp-native-rgb-instance-object-v13-formal-stage-execution-package-v1"
CHECKPOINT_SCHEMA = "ai-painter-stage4-mvp-native-rgb-instance-object-v13-checkpoint-v1"
TERMINAL_SCHEMA = "ai-painter-stage4-mvp-stage0-training-terminal-v1"
EPOCH_SCHEMA = "ai-painter-stage4-mvp-instance-object-v13-epoch-v1"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 24}
BUDGET = {"maxGpuMemoryFraction": 0.7, "maxEpochs": 24,
          "maxOptimizerSteps": 1152, "timeoutSeconds": 43200}
REVIEW_PATH = "data/ai-painter/system-governance/stage4-mvp-v13-stage0-review-contract-v1.json"
CHECKPOINT_NAME = "stage0-native-rgb-instance-object-v13.pt"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def authenticate(package_binding: dict) -> tuple[dict, dict, dict, tuple[str, ...]]:
    package = bound_json(ROOT, package_binding)
    contract, condition = verify_contract()
    manifest = contract["datasetBinding"]["manifest"]
    order = tuple(condition["tensorContract"]["channelOrder"])
    require(package.get("schemaVersion") == PACKAGE_SCHEMA
            and package.get("capabilityVersion") == CAPABILITY
            and package.get("stage") == STAGE
            and package.get("datasetManifest") == manifest
            and package.get("candidateContract") == base.bind(CONTRACT_PATH)
            and package.get("resourceBudget") == BUDGET
            and package.get("permittedSplits") == ["train", "validation"]
            and package.get("forbiddenSplits") == ["challenge", "regression"]
            and package.get("ticketConsumptionRequired") is True,
            "V13 execution package identity or bounds invalid")
    review = bound_json(ROOT, package["reviewContract"])
    require(package["reviewContract"]["path"] == REVIEW_PATH
            and review.get("schemaVersion") == "stage4-mvp-v13-stage0-review-contract-v1"
            and review.get("capabilityVersion") == CAPABILITY
            and review.get("status") == "active_for_v13_stage0_machine_review"
            and review.get("activation") == {
                "formalReviewExecutionAllowed": True, "trainingAllowed": False,
                "gpuAllowed": False, "runtimeFrameAllowed": False,
            }, "V13 independent formal review is unavailable")
    cpu = bound_json(ROOT, package["cpuQualification"])
    gpu = bound_json(ROOT, package["gpuQualification"])
    require(cpu.get("status") == "cpu_readonly_passed_formal_review_and_training_still_disabled"
            and cpu.get("capabilityVersion") == CAPABILITY
            and cpu.get("candidateContract") == package["candidateContract"]
            and cpu.get("datasetManifest") == manifest
            and cpu.get("splitObjectCoverage", {}).get("train", {}).get("sampleCount") == 48
            and cpu.get("splitObjectCoverage", {}).get("validation", {}).get("sampleCount") == 8
            and cpu.get("optimizerSteps") == 0
            and cpu.get("trainingStarted") is False
            and gpu.get("status") == "readonly_gpu_qualification_passed_training_still_disabled"
            and gpu.get("capabilityVersion") == CAPABILITY
            and gpu.get("candidateContract") == package["candidateContract"]
            and gpu.get("cpuQualification") == package["cpuQualification"]
            and gpu.get("datasetManifest") == manifest
            and gpu.get("optimizerSteps") == 0
            and gpu.get("weightsModified") is False
            and gpu.get("trainingStarted") is False
            and 0 < gpu.get("peakGpuReservedFraction", 0) <= 0.7
            and package.get("formalInitializationSha256")
            == cpu.get("initialModelStateSha256")
            == gpu.get("initialModelStateSha256"),
            "V13 candidate-specific CPU/GPU evidence invalid")
    programs = package.get("programBindings")
    require(isinstance(programs, list) and programs
            and any(item.get("path") ==
                    "ml/ai-painter/scripts/train_stage4_mvp_instance_object_v13_stage0.py"
                    for item in programs), "V13 worker is not bound")
    for item in programs:
        require(base.bind(item["path"]) == item, "V13 program binding changed")
    registry = json.loads((ROOT / ".runtime/ai-painter/current-execution-registry/current.json")
                          .read_text(encoding="utf-8"))
    active = registry.get("activeExecution")
    require(isinstance(active, dict)
            and active.get("runId") == package.get("runId")
            and active.get("packageId") == package.get("packageId")
            and active.get("capabilityVersion") == CAPABILITY
            and registry.get("executionState") == "executing",
            "V13 formal training is not the registered active execution")
    return package, contract, gpu, order


def scalar_parts(parts: dict) -> dict:
    return {key: float(parts[key].detach()) for key in
            ("total", "fullRgbMae", "fullRgbGradientMae", "instanceSupportRgbMae")}


def mean_parts(rows: list[dict]) -> dict:
    return {key: sum(row[key] for row in rows) / len(rows) for key in rows[0]}


def run(package_binding: dict) -> dict:
    package, contract, gpu, order = authenticate(package_binding)
    train_data = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation_data = SplitReleaseDataset(ROOT, package["datasetManifest"], "validation", (256, 192))
    require(len(train_data) == 48 and len(validation_data) == 8
            and train_data.selection_sha256 == contract["datasetBinding"]["trainSelectionSha256"]
            and validation_data.selection_sha256 == contract["datasetBinding"]["validationSelectionSha256"],
            "V13 fixed split selection changed")
    require(torch.cuda.is_available(), "V13 CUDA unavailable")
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    random.seed(SEED)
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    require(model.architecture_id == ARCHITECTURE
            and state_hash(model.state_dict()) == gpu["initialModelStateSha256"],
            "V13 fresh model differs from qualification")
    device = torch.device("cuda:0")
    torch.cuda.set_device(device)
    torch.cuda.set_per_process_memory_fraction(0.7, device)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)
    model.to(device)
    require(all(not any(parameter.requires_grad for parameter in
                        model.core.responsibility_heads[role].parameters())
                for role in ("object_tree", "object_rock", "object_vegetation")),
            "V13 replaced typed heads became trainable")
    optimizer = torch.optim.AdamW((parameter for parameter in model.parameters()
                                   if parameter.requires_grad), lr=1e-4)
    scaler = torch.amp.GradScaler("cuda")
    # The bound 56 samples are decoded once; object tables remain tied to their
    # source packs. No derived RGB patch is persisted or used at inference.
    train = [load_bound_object_sample(train_data, index) for index in range(48)]
    validation = [load_bound_object_sample(validation_data, index) for index in range(8)]
    output_root = package["outputRoot"]
    epoch_root = project_file(ROOT, output_root + "/epochs")
    epoch_root.mkdir(parents=True, exist_ok=True)
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
            target = {**sample, "image": sample["image"].to(device, non_blocking=True),
                      "conditions": conditions[0]}
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                predicted = model(conditions, sample["objectInstanceTable"])
                loss, parts = train_original_instance_objective(
                    predicted, target, sample["objectInstanceTable"], order)
            require(bool(torch.isfinite(loss)), "V13 non-finite train objective")
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer_steps += 1
            train_rows.append(scalar_parts(parts))
        model.eval()
        validation_rows = []
        with torch.no_grad():
            for sample in validation:
                conditions = sample["conditions"].unsqueeze(0).to(device, non_blocking=True)
                target = {**sample, "image": sample["image"].to(device, non_blocking=True),
                          "conditions": conditions[0]}
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    predicted = model(conditions, sample["objectInstanceTable"])
                    score, parts = validation_instance_object_score(
                        predicted, target, sample["objectInstanceTable"], order)
                require(bool(torch.isfinite(score)), "V13 non-finite validation score")
                validation_rows.append(scalar_parts(parts))
        train_metrics, validation_metrics = mean_parts(train_rows), mean_parts(validation_rows)
        selected_score = validation_metrics["total"]
        if selected_score < best_score:
            best_score, best_epoch = selected_score, epoch
            best_state = {key: value.detach().cpu().clone()
                          for key, value in model.state_dict().items()}
        base.write_atomic(epoch_root / f"epoch-{epoch:02d}.json", {
            "schemaVersion": EPOCH_SCHEMA, "runId": package["runId"],
            "epoch": epoch, "optimizerSteps": optimizer_steps,
            "train": train_metrics, "validation": validation_metrics,
            "checkpointSelectionScore": selected_score, "bestEpochSoFar": best_epoch,
            "bestScoreSoFar": best_score, "challengeRead": False,
            "regressionRead": False, "recordedAtUtc": base.utc_now(),
        })
        base.write_atomic(progress_path, {
            "schemaVersion": "ai-painter-stage4-mvp-stage0-training-progress-v1",
            "capabilityVersion": CAPABILITY, "runId": package["runId"],
            "phase": "training", "epoch": epoch, "epochTarget": STAGE["epochCount"],
            "optimizerSteps": optimizer_steps, "optimizerStepTarget": BUDGET["maxOptimizerSteps"],
            "checkpointSelectionScore": selected_score, "bestEpoch": best_epoch,
            "bestScore": best_score, "updatedAtUtc": base.utc_now(),
        })
    require(optimizer_steps == BUDGET["maxOptimizerSteps"] and best_state is not None,
            "V13 bounded training did not complete")
    model.load_state_dict(best_state, strict=True)
    selected_sha = state_hash(model.state_dict())
    checkpoint = {
        "schemaVersion": CHECKPOINT_SCHEMA, "capabilityVersion": CAPABILITY,
        "architectureId": ARCHITECTURE,
        "executionIdentity": {key: package[key] for key in ("batchRunId", "runId", "packageId")}
        | {"executionPackage": package_binding},
        "stage": STAGE, "datasetManifest": package["datasetManifest"],
        "candidateContract": package["candidateContract"],
        "reviewContract": package["reviewContract"],
        "formalInitializationSha256": package["formalInitializationSha256"],
        "modelState": best_state, "modelStateSha256": selected_sha,
        "bestEpoch": best_epoch, "bestValidationMetric": best_score,
        "completedEpochs": STAGE["epochCount"], "optimizerSteps": optimizer_steps,
        "machineReviewPending": True, "formalInferenceEligible": False,
        "checkpointPromotionEligible": False, "automaticRetryStarted": False,
    }
    buffer = io.BytesIO()
    torch.save(checkpoint, buffer)
    checkpoint_logical = output_root + "/" + CHECKPOINT_NAME
    base.write_exclusive_bytes(project_file(ROOT, checkpoint_logical), buffer.getvalue())
    checkpoint_binding = base.bind(checkpoint_logical)
    reloaded = torch.load(io.BytesIO(project_file(ROOT, checkpoint_logical).read_bytes()),
                          map_location="cpu", weights_only=True)
    require(reloaded.get("schemaVersion") == CHECKPOINT_SCHEMA
            and state_hash(reloaded["modelState"]) == selected_sha,
            "V13 Checkpoint reload identity mismatch")
    peak = int(torch.cuda.max_memory_reserved(device))
    total_memory = int(torch.cuda.get_device_properties(device).total_memory)
    require(peak / total_memory <= 0.7, "V13 GPU resource cap exceeded")
    for item in package["programBindings"]:
        require(base.bind(item["path"]) == item, "V13 program changed during training")
    return {
        "schemaVersion": TERMINAL_SCHEMA, "status": "training_completed_review_pending",
        "executionState": "completed", "capabilityVersion": CAPABILITY,
        "architectureId": ARCHITECTURE,
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
        "peakGpuReservedBytes": peak, "gpuTotalBytes": total_memory,
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
        base.write_atomic(project_file(ROOT, args.output.replace("\\", "/")), result)
        print(json.dumps({"status": result["status"],
                          "terminal": base.bind(args.output.replace("\\", "/"))},
                         ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

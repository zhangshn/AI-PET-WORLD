from __future__ import annotations

"""Run the exact bounded 256x192 formal Stage0 Denoiser schedule."""

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, canonical_bytes, digest, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    stage4_semantic_transport_v2_optimizer_parameters,
)
from stage4_formal_stage_execution import (  # noqa: E402
    build_formal_stage_component_config,
    initialize_formal_stage0_cpu,
    reload_formal_stage_v7_checkpoint,
    run_formal_stage_checkpoint,
)
from train_ai_assisted_conditional_denoiser import (  # noqa: E402
    build_diffusion_schedule, compute_latent_normalization,
)


V2_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
V3_CAPABILITY = "stage4_mvp_object_semantic_closure_v3"
V4_CAPABILITY = "stage4_mvp_object_trajectory_closure_v4"
V5_CAPABILITY = "stage4_mvp_short_trajectory_closure_v5"
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
SEED = 20260721


def require(value, message):
    if not value:
        raise ValueError(message)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_atomic(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(path.name + f".staged-{os.getpid()}")
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(staged, path)


def bind(logical: str):
    data = project_file(ROOT, logical).read_bytes()
    return {"path": logical, "sha256": digest(data)}


def load_request(binding_value: dict):
    request = bound_json(ROOT, binding_value)
    require(request.get("schemaVersion") in {
                "ai-painter-stage4-v2-formal-stage-execution-package-v1",
                "ai-painter-stage4-mvp-object-closure-v3-formal-stage-execution-package-v1",
                "ai-painter-stage4-mvp-object-trajectory-closure-v4-formal-stage-execution-package-v1",
                "ai-painter-stage4-mvp-short-trajectory-closure-v5-formal-stage-execution-package-v1",
            },
            "Formal Stage0 execution package schema invalid")
    require(request.get("capabilityVersion") in {V2_CAPABILITY, V3_CAPABILITY, V4_CAPABILITY, V5_CAPABILITY}
            and request.get("stage") == STAGE,
            "Formal Stage0 identity invalid")
    require(request.get("datasetManifest") and request.get("cpuQualification")
            and request.get("gpuQualification"), "Formal qualification bindings missing")
    cpu = bound_json(ROOT, request["cpuQualification"])
    gpu = bound_json(ROOT, request["gpuQualification"])
    require(cpu.get("status") == "cpu_preflight_passed"
            and gpu.get("status") == "readonly_gpu_qualification_passed",
            "Current CPU/GPU qualification not passed")
    require(cpu.get("capabilityVersion", V2_CAPABILITY) == request["capabilityVersion"]
            and gpu.get("capabilityVersion", V2_CAPABILITY) == request["capabilityVersion"],
            "Qualification capability differs from execution package")
    require(cpu.get("datasetManifest") == request["datasetManifest"]
            and gpu.get("datasetManifest") == request["datasetManifest"],
            "Qualification Dataset differs from execution package")
    require(gpu.get("trainingAllowedByThisArtifact") is True
            and gpu.get("optimizerSteps") == 0 and gpu.get("weightsModified") is False,
            "GPU qualification safety evidence invalid")
    return request


def run(request_binding: dict):
    request = load_request(request_binding)
    train = SplitReleaseDataset(ROOT, request["datasetManifest"], "train", (256, 192))
    validation = SplitReleaseDataset(ROOT, request["datasetManifest"], "validation", (256, 192))
    manifest = train.manifest
    qualification = manifest.get("qualification", {})
    require(qualification.get("dataQualifiedForTraining") is True
            and qualification.get("foundationQualified") is True
            and qualification.get("denoiserTrainingAllowed") is True
            and qualification.get("trainingAllowed") is False,
            "Formal Denoiser Dataset gate failed")
    checkpoint = torch.load(io.BytesIO(read_bound(ROOT, manifest["foundationCheckpoint"])),
                            map_location="cpu", weights_only=True)
    foundation_state = checkpoint["autoencoderState"]
    foundation_hash = manifest["identityPayload"]["foundationStateSha256"]
    require(state_hash(foundation_state) == foundation_hash, "Formal foundation state mismatch")
    capability = request["capabilityVersion"]
    config = build_formal_stage_component_config(ROOT, capability_version=capability)
    initialization = {
        "schemaVersion": "ai-painter-formal-stage0-initialization-input-v1",
        "stage": STAGE,
        "datasetManifest": request["datasetManifest"],
        "configSha256": digest(canonical_bytes(config)),
        "seed": SEED,
        "foundationStateSha256": foundation_hash,
    }
    config, model, initialized = initialize_formal_stage0_cpu(
        root=ROOT, initialization=initialization, train_dataset=train,
        validation_dataset=validation, foundation_state=foundation_state,
        capability_version=capability)
    require(initialized["inputSha256"] == request["formalInitializationSha256"],
            "Formal initialization differs from GPU-qualified input")

    device = torch.device("cuda:0")
    require(torch.cuda.is_available(), "Formal Stage0 CUDA unavailable")
    torch.cuda.set_device(0)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    model.to(device)
    latent_normalization = compute_latent_normalization(model, train, device)
    diffusion = build_diffusion_schedule(config, device)
    optimizer = torch.optim.AdamW(
        stage4_semantic_transport_v2_optimizer_parameters(model),
        lr=float(config["training"]["denoiserLearningRate"]),
    )
    output_root = request["outputRoot"]
    progress_path = project_file(ROOT, output_root + "/progress.json")
    epochs_root = project_file(ROOT, output_root + "/epochs")
    epochs_root.mkdir(parents=True, exist_ok=True)

    def persist_epoch(evidence):
        epoch = evidence["epoch"]
        epoch_path = epochs_root / f"epoch-{epoch:02d}.json"
        with epoch_path.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(evidence, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        write_atomic(progress_path, {
            "schemaVersion": "ai-painter-stage4-mvp-denoiser-progress-v1",
            "runId": request["runId"], "phase": "training", "epoch": epoch,
            "epochTarget": 40, "optimizerSteps": epoch * 48,
            "optimizerStepTarget": 1920,
            "checkpointSelectionScore": evidence["checkpointSelectionScore"],
            "updatedAtUtc": utc_now(),
        })

    identity = {
        "batchRunId": request["batchRunId"], "runId": request["runId"],
        "packageId": request["packageId"], "capabilityVersion": capability,
        "executionPackage": request_binding, "stage": STAGE,
    }
    result = run_formal_stage_checkpoint(
        root=ROOT, checkpoint_path=output_root + "/stage0-v7.pt", identity=identity,
        on_epoch_completed=persist_epoch, model=model, optimizer=optimizer,
        train_dataset=train, validation_dataset=validation, stage=STAGE,
        diffusion=diffusion, latent_normalization=latent_normalization,
        device=device, config=config, seed=SEED,
    )
    reloaded = reload_formal_stage_v7_checkpoint(root=ROOT, result=result, model=model, config=config)
    require(reloaded["denoiserStateSha256"] == result["denoiserStateSha256"],
            "Formal Stage0 reload state mismatch")
    peak_reserved = int(torch.cuda.max_memory_reserved(0))
    total_memory = int(torch.cuda.get_device_properties(0).total_memory)
    require(peak_reserved / total_memory <= request["resourceBudget"]["maxGpuMemoryFraction"],
            "Formal Stage0 GPU resource cap exceeded")
    terminal = {
        "schemaVersion": "ai-painter-stage4-mvp-denoiser-stage0-terminal-v1",
        "status": "training_completed_review_pending",
        "executionState": "completed",
        "capabilityVersion": capability,
        "batchRunId": request["batchRunId"], "runId": request["runId"],
        "packageId": request["packageId"], "stage": STAGE,
        "executionPackage": request_binding, "datasetManifest": request["datasetManifest"],
        "cpuQualification": request["cpuQualification"], "gpuQualification": request["gpuQualification"],
        "checkpoint": result["checkpoint"], "denoiserStateSha256": result["denoiserStateSha256"],
        "selectedEpoch": result["selectedEpoch"], "selectedScore": result["selectedScore"],
        "completedEpochs": result["schedule"]["completedEpochs"],
        "optimizerSteps": result["schedule"]["optimizerSteps"],
        "nonTrainOptimizerSteps": result["schedule"]["nonTrainOptimizerSteps"],
        "checkpointReloadVerified": True, "challengeRead": False, "regressionRead": False,
        "gpuStarted": True, "trainingStarted": True,
        "peakGpuReservedBytes": peak_reserved, "gpuTotalBytes": total_memory,
        "stagePassed": False, "machineReviewPending": True,
        "recordedAtUtc": utc_now(),
    }
    return terminal


def main():
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    package = {"path": args.execution_package.replace("\\", "/"),
               "sha256": args.execution_package_sha256}
    output = project_file(ROOT, args.output.replace("\\", "/"))
    try:
        result = run(package)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        print(json.dumps({"status": result["status"],
                          "terminal": bind(args.output.replace("\\", "/"))},
                         ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

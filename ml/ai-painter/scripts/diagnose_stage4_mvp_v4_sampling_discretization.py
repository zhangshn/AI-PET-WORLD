from __future__ import annotations

"""Read-only V4 sampling-discretization diagnostic.

The rejected V4 Checkpoint is loaded for diagnosis only.  The script repeats
deterministic validation inference for three fixed representative rows at
50/100/200 sampler steps.  It never creates an optimizer, runs backward,
modifies weights, reads challenge/regression, or grants qualification.
"""

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timezone
import json
import math
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
    SplitReleaseDataset,
    digest,
    project_file,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    state_dict_sha256,
)
from diagnose_stage4_mvp_object_semantic_closure_v3 import (  # noqa: E402
    masked_reference_response,
)
from materialize_stage4_mvp_stage0_review_candidates import (  # noqa: E402
    V4_CAPABILITY,
    load_and_authenticate,
    load_model,
)
from train_ai_assisted_conditional_denoiser import (  # noqa: E402
    build_diffusion_schedule,
    decode_final_visible_rgb,
    denormalize_latent,
    deterministic_velocity_step,
    inference_timesteps,
    load_latent_normalization,
    save_tensor_png,
    stage4_fixed_preview_determinism_scope,
)


OBJECT_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
SAMPLE_INDICES = (0, 2, 6)
INFERENCE_STEP_COUNTS = (50, 100, 200)
BASE_SEED = 20263721
SEED_STRIDE = 2


def require(value, message):
    if not value:
        raise ValueError(message)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def finite(value):
    result = float(value.detach().cpu() if isinstance(value, torch.Tensor) else value)
    require(math.isfinite(result), "non-finite diagnostic metric")
    return result


def bind(logical):
    return {"path": logical, "sha256": digest(project_file(ROOT, logical).read_bytes())}


def write_exclusive(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def diagnose(package_binding, terminal_binding, output_dir):
    package, terminal = load_and_authenticate(
        package_binding, terminal_binding, V4_CAPABILITY
    )
    train = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation = SplitReleaseDataset(
        ROOT, package["datasetManifest"], "validation", (256, 192)
    )
    require(len(train) == 48 and len(validation) == 8, "formal split capacity mismatch")
    config, model, checkpoint = load_model(
        package, terminal, train, validation, V4_CAPABILITY
    )
    require(torch.cuda.is_available(), "CUDA unavailable for read-only diagnostic")
    device = torch.device("cuda:0")
    torch.cuda.set_device(0)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    model.to(device).eval()
    model.autoencoder.requires_grad_(False)
    model.denoiser.requires_grad_(False)
    denoiser_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_before = state_hash(model.autoencoder.state_dict())
    normalization = load_latent_normalization(checkpoint, device)
    diffusion = build_diffusion_schedule(config, device)
    order = list(config["conditionChannelOrder"])
    output_root = project_file(ROOT, output_dir)
    require(not (output_root / "report.json").exists(), "diagnostic report already exists")

    rows = []
    with torch.inference_mode(), stage4_fixed_preview_determinism_scope(True):
        for sample_index in SAMPLE_INDICES:
            row = validation[sample_index]
            target = row["image"].unsqueeze(0).to(device)
            conditions = row["conditions"].unsqueeze(0).to(device)
            latent_shape = model.autoencoder.encode(target).shape
            seed = BASE_SEED + sample_index * SEED_STRIDE
            masks = {
                channel: conditions[:, order.index(channel):order.index(channel) + 1]
                for channel in OBJECT_CHANNELS
            }
            step_rows = []
            for step_count in INFERENCE_STEP_COUNTS:
                generator = torch.Generator(device=device).manual_seed(seed)
                latent = torch.randn(
                    latent_shape,
                    device=device,
                    generator=generator,
                    dtype=target.dtype,
                )
                steps = inference_timesteps(
                    int(config["diffusionSteps"]), step_count, device
                )
                for step_index, timestep in enumerate(steps):
                    timestep_value = int(timestep.item())
                    timestep_batch = torch.full(
                        (1,), timestep_value, device=device, dtype=torch.long
                    )
                    velocity = model.predict_velocity(latent, timestep_batch, conditions)
                    previous = (
                        int(steps[step_index + 1].item())
                        if step_index + 1 < len(steps)
                        else -1
                    )
                    latent = deterministic_velocity_step(
                        latent,
                        velocity,
                        timestep_value,
                        previous,
                        diffusion["alphasCumulative"],
                    )
                candidate = decode_final_visible_rgb(
                    model,
                    denormalize_latent(latent, normalization),
                    conditions,
                    config,
                ).clamp(0.0, 1.0)
                logical_image = (
                    output_dir.rstrip("/")
                    + f"/images/validation-{sample_index:02d}-steps-{step_count:03d}.png"
                )
                image_path = project_file(ROOT, logical_image)
                image_path.parent.mkdir(parents=True, exist_ok=True)
                save_tensor_png(candidate[0], image_path)
                step_rows.append({
                    "inferenceSteps": step_count,
                    "seed": seed,
                    "candidateRgb": bind(logical_image),
                    "globalRgbMae": finite(
                        torch.nn.functional.l1_loss(candidate, target)
                    ),
                    "objectReferenceResponse": {
                        channel: masked_reference_response(
                            candidate, target, masks[channel]
                        )
                        for channel in OBJECT_CHANNELS
                    },
                })
            rows.append({
                "sampleIndex": sample_index,
                "sampleId": row["sampleId"],
                "split": "validation",
                "referenceRgb": row["source"]["image"] if "source" in row else None,
                "stepComparisons": step_rows,
            })

    denoiser_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_hash(model.autoencoder.state_dict())
    require(denoiser_before == denoiser_after == terminal["denoiserStateSha256"],
            "read-only diagnostic mutated Denoiser")
    require(autoencoder_before == autoencoder_after,
            "read-only diagnostic mutated Autoencoder")
    report = {
        "schemaVersion": "stage4-mvp-v4-sampling-discretization-diagnostic-v1",
        "status": "completed_readonly_sampling_discretization_diagnostic",
        "capabilityVersion": V4_CAPABILITY,
        "runId": terminal["runId"],
        "executionPackage": package_binding,
        "trainingTerminal": terminal_binding,
        "checkpoint": terminal["checkpoint"],
        "datasetManifest": package["datasetManifest"],
        "sampleIndices": list(SAMPLE_INDICES),
        "inferenceStepCounts": list(INFERENCE_STEP_COUNTS),
        "rows": rows,
        "executionBoundary": {
            "splitRead": "validation_only",
            "failedCheckpointLoadedForDiagnosisOnly": True,
            "failedCheckpointUsedAsTrainingInitialization": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightsModified": False,
            "checkpointWritten": False,
            "machineReviewExecuted": False,
            "qualificationGranted": False,
            "challengeRead": False,
            "regressionRead": False,
        },
        "stateEvidence": {
            "denoiserBeforeSha256": denoiser_before,
            "denoiserAfterSha256": denoiser_after,
            "autoencoderBeforeSha256": autoencoder_before,
            "autoencoderAfterSha256": autoencoder_after,
        },
        "device": {
            "type": "cuda",
            "name": torch.cuda.get_device_name(0),
            "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        },
        "recordedAtUtc": utc_now(),
    }
    logical_report = output_dir.rstrip("/") + "/report.json"
    write_exclusive(project_file(ROOT, logical_report), report)
    return {"status": report["status"], "report": bind(logical_report)}


def main():
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--training-terminal", required=True)
    parser.add_argument("--training-terminal-sha256", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    try:
        result = diagnose(
            {
                "path": args.execution_package.replace("\\", "/"),
                "sha256": args.execution_package_sha256,
            },
            {
                "path": args.training_terminal.replace("\\", "/"),
                "sha256": args.training_terminal_sha256,
            },
            args.output_dir.replace("\\", "/"),
        )
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({
            "status": "failed_closed",
            "errorType": type(error).__name__,
            "error": str(error),
        }, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

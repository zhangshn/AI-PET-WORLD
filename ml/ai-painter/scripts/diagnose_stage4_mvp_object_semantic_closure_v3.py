from __future__ import annotations

"""Read-only causal diagnostic for the rejected MVP object-closure V3 run.

The diagnostic authenticates and loads the exact rejected Checkpoint for analysis
only.  It reads validation rows, never creates an optimizer, never calls backward,
never writes a Checkpoint and never reads challenge/regression rows.  It separates
three possible failure locations:

1. frozen Autoencoder semantic retention;
2. final RGB responsibility compositor behaviour on an exact encoded reference;
3. Denoiser and RGB compositor sensitivity to each authoritative object channel.
"""

from argparse import ArgumentParser
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
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    state_dict_sha256,
)
from materialize_stage4_mvp_stage0_review_candidates import (  # noqa: E402
    V3_CAPABILITY,
    load_and_authenticate,
    load_model,
)
from train_ai_assisted_conditional_denoiser import (  # noqa: E402
    build_diffusion_schedule,
    decode_final_visible_rgb,
    load_latent_normalization,
    normalize_latent,
)


OBJECT_CHANNELS = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
TIMESTEP_FRACTIONS = (0.0, 0.5, 1.0)


def require(value, message):
    if not value:
        raise ValueError(message)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(logical):
    return {"path": logical, "sha256": digest(project_file(ROOT, logical).read_bytes())}


def finite(value):
    result = float(value.detach().cpu() if isinstance(value, torch.Tensor) else value)
    require(math.isfinite(result), "non-finite diagnostic metric")
    return result


def masked_reference_response(candidate, reference, mask):
    denominator = (mask.sum() * 3.0).clamp_min(1.0)
    rgb_mae = ((candidate - reference).abs() * mask).sum() / denominator
    candidate_luma = (
        candidate[:, 0:1] * 0.2126
        + candidate[:, 1:2] * 0.7152
        + candidate[:, 2:3] * 0.0722
    )
    reference_luma = (
        reference[:, 0:1] * 0.2126
        + reference[:, 1:2] * 0.7152
        + reference[:, 2:3] * 0.0722
    )
    candidate_edge = (candidate_luma[:, :, :, 1:] - candidate_luma[:, :, :, :-1]).abs()
    reference_edge = (reference_luma[:, :, :, 1:] - reference_luma[:, :, :, :-1]).abs()
    edge_mask = mask[:, :, :, :-1]
    edge_mae = (
        (candidate_edge - reference_edge).abs() * edge_mask
    ).sum() / edge_mask.sum().clamp_min(1.0)
    selected_candidate = candidate_luma[mask > 0.5]
    selected_reference = reference_luma[mask > 0.5]
    centered_candidate = selected_candidate - selected_candidate.mean()
    centered_reference = selected_reference - selected_reference.mean()
    correlation_denominator = torch.sqrt(
        centered_candidate.square().sum() * centered_reference.square().sum()
    )
    correlation = (
        (centered_candidate * centered_reference).sum() / correlation_denominator
        if float(correlation_denominator) > 1e-9
        else candidate.new_zeros(())
    )
    return {
        "maskedRgbMae": finite(rgb_mae),
        "maskedEdgeMae": finite(edge_mae),
        "maskedLumaCorrelation": finite(correlation),
    }


def summarize(rows, section):
    result = {}
    for channel in OBJECT_CHANNELS:
        values = [row[section][channel] for row in rows]
        result[channel] = {
            key: sum(value[key] for value in values) / len(values)
            for key in values[0]
        }
    return result


def diagnose(package_binding, terminal_binding, output_path):
    package, terminal = load_and_authenticate(
        package_binding, terminal_binding, V3_CAPABILITY
    )
    train = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation = SplitReleaseDataset(
        ROOT, package["datasetManifest"], "validation", (256, 192)
    )
    require(len(train) == 48 and len(validation) == 8, "formal split capacity mismatch")
    config, model, checkpoint = load_model(
        package, terminal, train, validation, V3_CAPABILITY
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
    autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
    normalization = load_latent_normalization(checkpoint, device)
    diffusion = build_diffusion_schedule(config, device)
    order = list(config["conditionChannelOrder"])
    responsibility_order = tuple(
        model.decode_stage4_semantic_responsibility_rgb(
            model.autoencoder.encode(validation[0]["image"].unsqueeze(0).to(device)),
            validation[0]["conditions"].unsqueeze(0).to(device),
            return_evidence=True,
        )[1]["responsibilityIdentityOrder"]
    )
    require(all(channel in responsibility_order for channel in OBJECT_CHANNELS),
            "object responsibility identity is missing")

    rows = []
    with torch.inference_mode():
        for sample_index in range(len(validation)):
            row = validation[sample_index]
            target = row["image"].unsqueeze(0).to(device)
            conditions = row["conditions"].unsqueeze(0).to(device)
            masks = {
                channel: conditions[:, order.index(channel):order.index(channel) + 1]
                for channel in OBJECT_CHANNELS
            }
            latent = model.autoencoder.encode(target)
            base = model.autoencoder.decode(latent).clamp(0.0, 1.0)
            complete, evidence = decode_final_visible_rgb(
                model,
                latent,
                conditions,
                config,
                return_stage4_semantic_responsibility_evidence=True,
            )
            complete = complete.clamp(0.0, 1.0)
            proposal_by_channel = {
                channel: evidence["responsibilityRgbProposals"][
                    responsibility_order.index(channel)
                ].clamp(0.0, 1.0)
                for channel in OBJECT_CHANNELS
            }
            base_metrics = {
                channel: masked_reference_response(base, target, masks[channel])
                for channel in OBJECT_CHANNELS
            }
            complete_metrics = {
                channel: masked_reference_response(complete, target, masks[channel])
                for channel in OBJECT_CHANNELS
            }
            proposal_metrics = {
                channel: masked_reference_response(
                    proposal_by_channel[channel], target, masks[channel]
                )
                for channel in OBJECT_CHANNELS
            }

            overlaps = {}
            for left in OBJECT_CHANNELS:
                for right in OBJECT_CHANNELS:
                    if left >= right:
                        continue
                    intersection = (masks[left] * masks[right]).sum()
                    minimum = torch.minimum(masks[left].sum(), masks[right].sum()).clamp_min(1.0)
                    overlaps[f"{left}|{right}"] = {
                        "intersectionPixels": finite(intersection),
                        "fractionOfSmallerMask": finite(intersection / minimum),
                    }

            decoder_sensitivity = {}
            for channel in OBJECT_CHANNELS:
                ablated = conditions.clone()
                ablated[:, order.index(channel)] = 0.0
                ablated_rgb = decode_final_visible_rgb(
                    model, latent, ablated, config
                ).clamp(0.0, 1.0)
                mask = masks[channel]
                denominator = (mask.sum() * 3.0).clamp_min(1.0)
                decoder_sensitivity[channel] = {
                    "globalRgbMaeFromAblation": finite(
                        torch.nn.functional.l1_loss(complete, ablated_rgb)
                    ),
                    "insideMaskRgbMaeFromAblation": finite(
                        ((complete - ablated_rgb).abs() * mask).sum() / denominator
                    ),
                }

            normalized_clean = normalize_latent(latent, normalization)
            generator = torch.Generator(device=device).manual_seed(20260924 + sample_index)
            noise = torch.randn(
                normalized_clean.shape,
                device=device,
                generator=generator,
                dtype=normalized_clean.dtype,
            )
            timestep_rows = []
            for fraction in TIMESTEP_FRACTIONS:
                timestep_value = round((int(config["diffusionSteps"]) - 1) * fraction)
                alpha = diffusion["alphasCumulative"][timestep_value]
                noisy = alpha.sqrt() * normalized_clean + (1.0 - alpha).sqrt() * noise
                timestep = torch.full(
                    (1,), timestep_value, device=device, dtype=torch.long
                )
                baseline_velocity = model.predict_velocity(noisy, timestep, conditions)
                channel_response = {}
                for channel in OBJECT_CHANNELS:
                    ablated = conditions.clone()
                    ablated[:, order.index(channel)] = 0.0
                    ablated_velocity = model.predict_velocity(noisy, timestep, ablated)
                    channel_response[channel] = finite(
                        torch.nn.functional.l1_loss(
                            baseline_velocity, ablated_velocity
                        )
                    )
                all_objects_ablated = conditions.clone()
                for channel in OBJECT_CHANNELS:
                    all_objects_ablated[:, order.index(channel)] = 0.0
                all_objects_velocity = model.predict_velocity(
                    noisy, timestep, all_objects_ablated
                )
                path_ablated = conditions.clone()
                path_ablated[:, order.index("terrain_path_ground")] = 0.0
                path_velocity = model.predict_velocity(noisy, timestep, path_ablated)
                timestep_rows.append({
                    "timestep": timestep_value,
                    "objectChannelVelocityResponseMae": channel_response,
                    "allObjectChannelsVelocityResponseMae": finite(
                        torch.nn.functional.l1_loss(
                            baseline_velocity, all_objects_velocity
                        )
                    ),
                    "pathChannelVelocityResponseMae": finite(
                        torch.nn.functional.l1_loss(
                            baseline_velocity, path_velocity
                        )
                    ),
                    "baselineVelocityAbsMean": finite(baseline_velocity.abs().mean()),
                })

            rows.append({
                "sampleIndex": sample_index,
                "sampleId": row["sampleId"],
                "split": "validation",
                "maskSupportPixels": {
                    channel: finite(mask.sum()) for channel, mask in masks.items()
                },
                "maskOverlap": overlaps,
                "autoencoderReconstruction": base_metrics,
                "conditionedFinalRgbOnReferenceLatent": complete_metrics,
                "responsibilityProposalOnReferenceLatent": proposal_metrics,
                "decoderConditionAblation": decoder_sensitivity,
                "denoiserConditionAblation": timestep_rows,
            })

    denoiser_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
    require(denoiser_before == denoiser_after == terminal["denoiserStateSha256"],
            "read-only diagnostic mutated Denoiser")
    require(autoencoder_before == autoencoder_after,
            "read-only diagnostic mutated Autoencoder")

    aggregate_denoiser = {}
    for channel in OBJECT_CHANNELS:
        values = [
            timestep["objectChannelVelocityResponseMae"][channel]
            for row in rows
            for timestep in row["denoiserConditionAblation"]
        ]
        aggregate_denoiser[channel] = sum(values) / len(values)
    aggregate_decoder = {
        channel: {
            key: sum(
                row["decoderConditionAblation"][channel][key] for row in rows
            ) / len(rows)
            for key in (
                "globalRgbMaeFromAblation",
                "insideMaskRgbMaeFromAblation",
            )
        }
        for channel in OBJECT_CHANNELS
    }
    report = {
        "schemaVersion": "stage4-mvp-object-semantic-closure-v3-readonly-causal-diagnostic-v1",
        "status": "completed_readonly_causal_diagnostic_not_training_qualified",
        "capabilityVersion": V3_CAPABILITY,
        "runId": package["runId"],
        "executionPackage": package_binding,
        "trainingTerminal": terminal_binding,
        "checkpoint": terminal["checkpoint"],
        "datasetManifest": package["datasetManifest"],
        "rows": rows,
        "aggregate": {
            "autoencoderReconstruction": summarize(rows, "autoencoderReconstruction"),
            "conditionedFinalRgbOnReferenceLatent": summarize(
                rows, "conditionedFinalRgbOnReferenceLatent"
            ),
            "responsibilityProposalOnReferenceLatent": summarize(
                rows, "responsibilityProposalOnReferenceLatent"
            ),
            "decoderConditionAblation": aggregate_decoder,
            "denoiserObjectConditionVelocityResponseMae": aggregate_denoiser,
        },
        "executionBoundary": {
            "splitRead": "validation_only",
            "trainRowsConstructedForIdentityOnly": True,
            "trainRowsConsumed": False,
            "challengeRead": False,
            "regressionRead": False,
            "failedCheckpointLoadedForDiagnosisOnly": True,
            "failedCheckpointUsedAsTrainingInitialization": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightsModified": False,
            "checkpointWritten": False,
            "qualificationGranted": False,
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
    target = project_file(ROOT, output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    return {
        "status": report["status"],
        "report": bind(output_path),
        "validationSampleCount": len(rows),
        "weightsModified": False,
    }


def main():
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--training-terminal", required=True)
    parser.add_argument("--training-terminal-sha256", required=True)
    parser.add_argument("--output", required=True)
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
            args.output.replace("\\", "/"),
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

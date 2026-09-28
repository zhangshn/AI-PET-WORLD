from __future__ import annotations

"""Fail-closed CPU and read-only GPU qualification for the MVP Stage4 Denoiser.

This program binds the source-isolated 64-sample release to the freshly trained
Autoencoder.  CPU mode authenticates the immutable inputs and the exact formal
Stage0 initialization.  GPU mode replays those checks and executes the real
formal objective with ``torch.autograd.grad`` only.  It never creates an
optimizer, calls ``backward``, mutates weights, reads challenge/regression, or
writes a checkpoint.
"""

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
from pathlib import Path
import sys
import time

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SOURCE_ROOT = PROJECT_ROOT / "ml" / "ai-painter" / "src"
for import_root in (SOURCE_ROOT, SCRIPT_DIR):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset,
    bound_json,
    canonical_bytes,
    digest,
    read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from stage4_formal_stage_execution import (  # noqa: E402
    build_formal_stage_component_config,
    initialize_formal_stage0_cpu,
)
import run_stage4_semantic_transport_v2_readonly_gpu_qualification as gpu_support  # noqa: E402
from ai_painter_stage4_mvp_object_semantic_closure_v3_runtime import (  # noqa: E402
    activated_object_semantic_closure_v3,
)
from ai_painter_stage4_mvp_object_trajectory_closure_v4_runtime import (  # noqa: E402
    activated_object_trajectory_closure_v4,
)
from ai_painter_stage4_mvp_short_trajectory_closure_v5_runtime import (  # noqa: E402
    activated_short_trajectory_closure_v5,
)


SCHEMA = "ai-painter-stage4-mvp-denoiser-execution-qualification-v1"
DATASET_SCHEMA = "ai-painter-stage4-v2-mvp64-denoiser-dataset-release-v1"
V2_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
V3_CAPABILITY = "stage4_mvp_object_semantic_closure_v3"
V4_CAPABILITY = "stage4_mvp_object_trajectory_closure_v4"
V5_CAPABILITY = "stage4_mvp_short_trajectory_closure_v5"
SEED = 20260721
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
MAX_GPU_MEMORY_FRACTION = 0.70


def require(value, message):
    if not value:
        raise ValueError(message)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def project_path(path: Path) -> str:
    value = Path(path)
    if not value.is_absolute():
        logical = value.as_posix()
        require(logical and not logical.startswith("/")
                and all(part not in {"", ".", ".."} for part in logical.split("/")),
                "Invalid project-relative path")
        candidate = PROJECT_ROOT.joinpath(*logical.split("/"))
        allowed = (PROJECT_ROOT / ".runtime").resolve() if logical.startswith(".runtime/") \
            else PROJECT_ROOT.resolve()
        require(candidate.resolve().is_relative_to(allowed), "Path escapes declared storage root")
        return logical
    resolved = value.resolve()
    root = PROJECT_ROOT.resolve()
    if resolved.is_relative_to(root):
        return resolved.relative_to(root).as_posix()
    runtime = (PROJECT_ROOT / ".runtime").resolve()
    require(resolved.is_relative_to(runtime), "Absolute path escapes project and Runtime storage")
    return ".runtime/" + resolved.relative_to(runtime).as_posix()


def binding(path: Path) -> dict:
    data = path.read_bytes()
    return {"path": project_path(path), "sha256": digest(data)}


def write_exclusive(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def prepare(dataset_binding: dict, capability_version: str = V2_CAPABILITY):
    require(capability_version in {V2_CAPABILITY, V3_CAPABILITY, V4_CAPABILITY, V5_CAPABILITY},
            "Unsupported MVP Denoiser capability")
    train = SplitReleaseDataset(PROJECT_ROOT, dataset_binding, "train", (256, 192))
    validation = SplitReleaseDataset(PROJECT_ROOT, dataset_binding, "validation", (256, 192))
    manifest = train.manifest
    require(manifest == validation.manifest, "MVP Denoiser Dataset views disagree")
    require(manifest.get("schemaVersion") == DATASET_SCHEMA, "MVP Denoiser Dataset schema invalid")
    require(manifest.get("immutable") is True, "MVP Denoiser Dataset is not immutable")
    require(manifest.get("splitCounts") == {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
            "MVP Denoiser Dataset split counts changed")
    qualification = manifest.get("qualification", {})
    require(qualification.get("dataQualifiedForTraining") is True
            and qualification.get("foundationQualified") is True
            and qualification.get("denoiserTrainingAllowed") is True,
            "MVP Denoiser data/foundation qualification missing")
    require(qualification.get("executionQualified") is False
            and qualification.get("gpuQualified") is False
            and qualification.get("trainingAllowed") is False,
            "Dataset release improperly claims execution qualification")

    foundation_qualification = bound_json(PROJECT_ROOT, manifest["foundationQualification"])
    require(foundation_qualification.get("foundationQualified") is True,
            "Fresh foundation qualification missing")
    require(foundation_qualification.get("denoiserTrainingAllowedByThisArtifact") is False,
            "Foundation artifact improperly grants Denoiser training")
    checkpoint = torch.load(io.BytesIO(read_bound(PROJECT_ROOT, manifest["foundationCheckpoint"])),
                            map_location="cpu", weights_only=True)
    require(checkpoint.get("schemaVersion") == "ai-painter-stage4-mvp-fresh-foundation-checkpoint-v1",
            "Fresh foundation checkpoint schema invalid")
    require(checkpoint.get("denoiserState") is None and checkpoint.get("denoiserTrained") is False,
            "Historical Denoiser state is forbidden")
    foundation_state = checkpoint.get("autoencoderState")
    expected_state = manifest["identityPayload"]["foundationStateSha256"]
    require(state_hash(foundation_state) == checkpoint.get("autoencoderStateSha256") == expected_state,
            "Fresh foundation state identity mismatch")

    config = build_formal_stage_component_config(
        PROJECT_ROOT, capability_version=capability_version)
    initialization = {
        "schemaVersion": "ai-painter-formal-stage0-initialization-input-v1",
        "stage": STAGE,
        "datasetManifest": dataset_binding,
        "configSha256": digest(canonical_bytes(config)),
        "seed": SEED,
        "foundationStateSha256": expected_state,
    }
    config, model, initialized = initialize_formal_stage0_cpu(
        root=PROJECT_ROOT,
        initialization=initialization,
        train_dataset=train,
        validation_dataset=validation,
        foundation_state=foundation_state,
        capability_version=capability_version,
    )
    return manifest, train, validation, config, model, initialized


def cpu_qualification(dataset_binding: dict, capability_version: str = V2_CAPABILITY) -> dict:
    manifest, train, validation, config, model, initialized = prepare(
        dataset_binding, capability_version)
    require(len(train) == 48 and len(validation) == 8, "Formal CPU split selection incomplete")
    require(all(parameter.grad is None for parameter in model.parameters()),
            "Formal CPU initialization populated gradients")
    return {
        "schemaVersion": SCHEMA,
        "mode": "cpu_preflight",
        "status": "cpu_preflight_passed",
        "capabilityVersion": capability_version,
        "datasetManifest": dataset_binding,
        "datasetReleaseIdentity": manifest["datasetReleaseIdentity"],
        "foundationCheckpoint": manifest["foundationCheckpoint"],
        "foundationQualification": manifest["foundationQualification"],
        "formalConfigSha256": digest(canonical_bytes(config)),
        "formalInitialization": initialized,
        "splitCounts": manifest["splitCounts"],
        "challengeRead": False,
        "regressionRead": False,
        "optimizerCreated": False,
        "optimizerSteps": 0,
        "gpuStarted": False,
        "trainingAllowedByThisArtifact": False,
        "recordedAtUtc": utc_now(),
    }


def compact_sample(value: dict) -> dict:
    gradients = value["parameterGradients"]
    return {
        "role": value["role"],
        "sampleId": value["sampleId"],
        "split": value["split"],
        "compositeLoss": value["compositeLoss"],
        "responsibilityOccupancy": value["responsibilityOccupancy"],
        "nonzeroParameterTensorCount": gradients["nonzeroParameterTensorCount"],
        "nonzeroParameterNames": gradients["nonzeroParameterNames"],
        "allRequiredParametersFiniteNonzero": gradients["allRequiredParametersFiniteNonzero"],
        "noisyLatentGradient": value["noisyLatentGradient"],
        "conditionGradient": value["conditionGradient"],
        "typedResize": value["typedResize"],
        "allParameterGradFieldsRemainNone": value["allParameterGradFieldsRemainNone"],
    }


def short_trajectory_gradient_evidence(model, sample, device, config,
                                       latent_normalization, inventory) -> dict:
    """Exercise V5's additional graph without populating gradients or weights."""
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device)
    with torch.no_grad():
        clean_latent = model.autoencoder.encode(image)
        clean_latent = gpu_support.trainer.normalize_latent(
            clean_latent, latent_normalization
        )
    diffusion = gpu_support.trainer.build_diffusion_schedule(config, device)
    timesteps = torch.full((1,), 999, device=device, dtype=torch.long)
    noise = torch.randn_like(clean_latent)
    noisy_latent = gpu_support.trainer.add_noise(
        clean_latent, noise, timesteps, diffusion["alphasCumulative"]
    )
    metrics = gpu_support.trainer.short_trajectory_supervision(
        model,
        noisy_latent,
        clean_latent,
        timesteps,
        diffusion["alphasCumulative"],
        conditions,
        image,
        latent_normalization,
        config,
    )
    require(metrics is not None, "V5 short-trajectory graph did not execute")
    loss = metrics["shortTrajectoryLossTensor"]
    named = inventory["namedParameters"]
    gradients = torch.autograd.grad(
        loss, [parameter for _, parameter in named], allow_unused=True
    )
    nonzero = []
    for (name, _), gradient in zip(named, gradients):
        if gradient is None:
            continue
        require(torch.isfinite(gradient).all().item(),
                "V5 short-trajectory gradient is non-finite: " + name)
        if torch.count_nonzero(gradient).item() > 0:
            nonzero.append(name)
    require(nonzero, "V5 short-trajectory graph reached no trainable parameter")
    return {
        "sampleId": sample["sampleId"],
        "split": sample["split"],
        "steps": int(metrics["shortTrajectoryStepCount"].detach().cpu().item()),
        "weightedLoss": float(loss.detach().cpu().item()),
        "nonzeroParameterTensorCount": len(nonzero),
        "nonzeroParameterNames": nonzero,
        "backwardExecuted": False,
        "parameterGradFieldsRemainNone": all(
            parameter.grad is None for parameter in model.parameters()
        ),
    }


def gpu_qualification(dataset_binding: dict, cpu_binding: dict,
                      capability_version: str = V2_CAPABILITY) -> dict:
    cpu = bound_json(PROJECT_ROOT, cpu_binding)
    require(cpu.get("schemaVersion") == SCHEMA and cpu.get("status") == "cpu_preflight_passed",
            "Current CPU preflight is missing")
    require(cpu.get("capabilityVersion", V2_CAPABILITY) == capability_version,
            "CPU preflight capability differs")
    require(cpu.get("datasetManifest") == dataset_binding, "CPU preflight Dataset differs")
    manifest, train, validation, config, model, initialized = prepare(
        dataset_binding, capability_version)
    require(initialized["inputSha256"] == cpu["formalInitialization"]["inputSha256"],
            "Formal CPU initialization changed after preflight")

    gpu_support._load_project_modules()
    device = gpu_support.require_formal_cuda()
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    total_memory = torch.cuda.get_device_properties(0).total_memory

    inventory = gpu_support.validate_parameter_inventory(model)
    foundation_before = gpu_support.state_dict_sha256(model.autoencoder.state_dict())
    denoiser_before = gpu_support.state_dict_sha256(model.denoiser.state_dict())
    model.to(device)
    gpu_support.validate_stage4_semantic_transport_v2_autoencoder_boundary(
        model, phase="before_training", expected_state_sha256=foundation_before)
    started = time.perf_counter()
    latent_normalization = gpu_support.trainer.compute_latent_normalization(model, train, device)
    require(latent_normalization.get("sampleCount") == 48, "Train-only latent normalization incomplete")

    # The first train and first validation item prove both formal Dataset routes.
    # Additional train items are evaluated only until every trainable Denoiser
    # parameter has a real non-zero gradient.  No held-out split is instantiated.
    candidates = [("first_formal_train_record", train[0])]
    candidates.extend((f"validation_record_{index + 1}", validation[index]) for index in range(len(validation)))
    candidates.extend((f"train_coverage_record_{index + 1}", train[index]) for index in range(1, len(train)))
    reached: set[str] = set()
    samples = []
    all_names = {name for name, _ in inventory["namedParameters"]}
    validation_executed = False
    short_trajectory_evidence = None
    with activated_object_semantic_closure_v3(config):
        with activated_object_trajectory_closure_v4(config):
            with activated_short_trajectory_closure_v5(config):
                for role, sample in candidates:
                    raw = gpu_support._sample_gradient_evidence(
                        model,
                        sample,
                        role=role,
                        device=device,
                        model_config=config,
                        latent_normalization=latent_normalization,
                        parameter_inventory=inventory,
                        require_all_parameters=False,
                    )
                    raw["split"] = sample["split"]
                    compact = compact_sample(raw)
                    reached.update(compact["nonzeroParameterNames"])
                    samples.append(compact)
                    validation_executed = validation_executed or sample["split"] == "validation"
                    if validation_executed and reached == all_names:
                        break
                if capability_version == V5_CAPABILITY:
                    short_trajectory_evidence = short_trajectory_gradient_evidence(
                        model, train[0], device, config, latent_normalization, inventory
                    )
    require(validation_executed, "Validation graph was not executed")
    require(reached == all_names,
            "Formal GPU graph did not reach every trainable Denoiser parameter: "
            + ",".join(sorted(all_names - reached)))

    model.to("cpu")
    foundation_after = gpu_support.state_dict_sha256(model.autoencoder.state_dict())
    denoiser_after = gpu_support.state_dict_sha256(model.denoiser.state_dict())
    require(foundation_after == foundation_before, "GPU qualification changed Autoencoder state")
    require(denoiser_after == denoiser_before, "GPU qualification changed Denoiser state")
    require(all(parameter.grad is None for parameter in model.parameters()),
            "GPU qualification populated parameter grad fields")
    peak_allocated = int(torch.cuda.max_memory_allocated(0))
    peak_reserved = int(torch.cuda.max_memory_reserved(0))
    peak_fraction = peak_reserved / total_memory
    require(peak_fraction <= MAX_GPU_MEMORY_FRACTION, "GPU qualification exceeded resource cap")

    return {
        "schemaVersion": SCHEMA,
        "mode": "readonly_gpu_qualification",
        "status": "readonly_gpu_qualification_passed",
        "capabilityVersion": capability_version,
        "datasetManifest": dataset_binding,
        "datasetReleaseIdentity": manifest["datasetReleaseIdentity"],
        "cpuPreflight": cpu_binding,
        "foundationCheckpoint": manifest["foundationCheckpoint"],
        "foundationQualification": manifest["foundationQualification"],
        "formalInitializationSha256": initialized["inputSha256"],
        "formalObjective": (
            "mvp_short_trajectory_closure_v5"
            if capability_version == V5_CAPABILITY
            else "mvp_object_trajectory_closure_v4"
            if capability_version == V4_CAPABILITY
            else "mvp_object_semantic_closure_v3"
            if capability_version == V3_CAPABILITY
            else "formal_v6_composite_exact_reuse_v1"
        ),
        "samplesExecuted": samples,
        "shortTrajectoryGradientEvidence": short_trajectory_evidence,
        "allTrainableDenoiserParametersReached": True,
        "parameterTensorCount": inventory["parameterTensorCount"],
        "parameterScalarCount": inventory["parameterScalarCount"],
        "foundationStateBefore": foundation_before,
        "foundationStateAfter": foundation_after,
        "denoiserStateBefore": denoiser_before,
        "denoiserStateAfter": denoiser_after,
        "latentNormalization": gpu_support.trainer.serialize_latent_normalization(latent_normalization),
        "cuda": {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "totalMemoryBytes": int(total_memory),
            "peakAllocatedBytes": peak_allocated,
            "peakReservedBytes": peak_reserved,
            "peakReservedFraction": peak_fraction,
            "maxAllowedFraction": MAX_GPU_MEMORY_FRACTION,
            "durationSeconds": round(time.perf_counter() - started, 6),
        },
        "challengeRead": False,
        "regressionRead": False,
        "optimizerCreated": False,
        "optimizerSteps": 0,
        "backwardExecuted": False,
        "weightsModified": False,
        "checkpointWritten": False,
        "trainingAllowedByThisArtifact": True,
        "recordedAtUtc": utc_now(),
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--mode", choices=("cpu", "gpu"), required=True)
    parser.add_argument("--capability-version", choices=(V2_CAPABILITY, V3_CAPABILITY, V4_CAPABILITY, V5_CAPABILITY),
                        default=V2_CAPABILITY)
    parser.add_argument("--dataset-manifest", type=Path, required=True)
    parser.add_argument("--dataset-sha256", required=True)
    parser.add_argument("--cpu-preflight", type=Path)
    parser.add_argument("--cpu-preflight-sha256")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        dataset_binding = {"path": project_path(args.dataset_manifest), "sha256": args.dataset_sha256}
        require(digest(args.dataset_manifest.read_bytes()) == args.dataset_sha256,
                "Dataset manifest SHA-256 mismatch")
        if args.mode == "cpu":
            result = cpu_qualification(dataset_binding, args.capability_version)
        else:
            require(args.cpu_preflight is not None and args.cpu_preflight_sha256,
                    "GPU mode requires the exact CPU preflight")
            require(digest(args.cpu_preflight.read_bytes()) == args.cpu_preflight_sha256,
                    "CPU preflight SHA-256 mismatch")
            result = gpu_qualification(
                dataset_binding,
                {"path": project_path(args.cpu_preflight), "sha256": args.cpu_preflight_sha256},
                args.capability_version,
            )
        write_exclusive(args.output, result)
        print(json.dumps({"status": result["status"], "output": binding(args.output)},
                         ensure_ascii=False), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"schemaVersion": SCHEMA, "status": "failed_closed",
                          "errorType": type(error).__name__, "error": str(error)},
                         ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

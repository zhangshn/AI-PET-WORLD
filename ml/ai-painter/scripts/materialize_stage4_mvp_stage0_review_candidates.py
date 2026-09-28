from __future__ import annotations

"""Materialize immutable validation candidates from the selected MVP Stage0 Checkpoint.

This is post-training inference only.  It authenticates the exact execution,
dataset, frozen foundation and selected Denoiser state, then emits one
deterministic 256x192 candidate for each of the eight validation rows.  It does
not read challenge/regression, create an optimizer, mutate weights, review the
images, or grant Stage/Checkpoint qualification.
"""

from argparse import ArgumentParser
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import sys

from PIL import Image
import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for value in (ROOT / "ml" / "ai-painter" / "src", SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset,
    bound_json,
    canonical_bytes,
    digest,
    project_file,
    read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402
from ai_painter_stage4_semantic_transport_v2_trainer_support import (  # noqa: E402
    state_dict_sha256,
)
from stage4_formal_stage_execution import (  # noqa: E402
    build_formal_stage_component_config,
    initialize_formal_stage0_cpu,
)
from train_ai_assisted_conditional_denoiser import (  # noqa: E402
    build_diffusion_schedule,
    evaluate_deterministic_rollout_rgb_quality_v7,
    load_latent_normalization,
    stage4_fixed_preview_determinism_scope,
)


V2_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
V3_CAPABILITY = "stage4_mvp_object_semantic_closure_v3"
V4_CAPABILITY = "stage4_mvp_object_trajectory_closure_v4"
V5_CAPABILITY = "stage4_mvp_short_trajectory_closure_v5"
SUPPORTED_CAPABILITIES = (V2_CAPABILITY, V3_CAPABILITY, V4_CAPABILITY, V5_CAPABILITY)
STAGE = {"stage": 0, "width": 256, "height": 192, "epochCount": 40}
SEED = 20260721
OBJECT_MASK_ROLES = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)


def require(value, message):
    if not value:
        raise ValueError(message)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def bind(logical: str):
    data = project_file(ROOT, logical).read_bytes()
    return {"path": logical, "sha256": digest(data)}


def write_exclusive(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def load_and_authenticate(package_binding: dict, terminal_binding: dict, capability: str):
    package = bound_json(ROOT, package_binding)
    terminal = bound_json(ROOT, terminal_binding)
    expected_package_schema = {
        V2_CAPABILITY: "ai-painter-stage4-v2-formal-stage-execution-package-v1",
        V3_CAPABILITY: "ai-painter-stage4-mvp-object-closure-v3-formal-stage-execution-package-v1",
        V4_CAPABILITY: "ai-painter-stage4-mvp-object-trajectory-closure-v4-formal-stage-execution-package-v1",
        V5_CAPABILITY: "ai-painter-stage4-mvp-short-trajectory-closure-v5-formal-stage-execution-package-v1",
    }[capability]
    require(package.get("schemaVersion") == expected_package_schema,
            "execution package schema invalid")
    require(
        terminal.get("schemaVersion")
        == "ai-painter-stage4-mvp-denoiser-stage0-terminal-v1",
        "training terminal schema invalid",
    )
    require(
        package.get("capabilityVersion") == terminal.get("capabilityVersion") == capability,
        "capability identity mismatch",
    )
    require(package.get("stage") == terminal.get("stage") == STAGE, "Stage0 identity mismatch")
    require(terminal.get("status") == "training_completed_review_pending", "training is not review-pending")
    require(terminal.get("executionState") == "completed", "training execution is not complete")
    require(terminal.get("executionPackage") == package_binding, "terminal package binding mismatch")
    require(terminal.get("checkpointReloadVerified") is True, "training checkpoint reload not verified")
    require(terminal.get("challengeRead") is False and terminal.get("regressionRead") is False,
            "held-out split boundary changed")
    require(package.get("datasetManifest") == terminal.get("datasetManifest"),
            "terminal dataset binding mismatch")
    return package, terminal


def load_model(package: dict, terminal: dict, train, validation, capability: str):
    manifest = train.manifest
    foundation_payload = torch.load(
        io.BytesIO(read_bound(ROOT, manifest["foundationCheckpoint"])),
        map_location="cpu",
        weights_only=True,
    )
    foundation_state = foundation_payload["autoencoderState"]
    foundation_hash = manifest["identityPayload"]["foundationStateSha256"]
    require(state_hash(foundation_state) == foundation_hash, "foundation state mismatch")
    config = build_formal_stage_component_config(ROOT, capability_version=capability)
    initialization = {
        "schemaVersion": "ai-painter-formal-stage0-initialization-input-v1",
        "stage": STAGE,
        "datasetManifest": package["datasetManifest"],
        "configSha256": digest(canonical_bytes(config)),
        "seed": SEED,
        "foundationStateSha256": foundation_hash,
    }
    config, model, initialized = initialize_formal_stage0_cpu(
        root=ROOT,
        initialization=initialization,
        train_dataset=train,
        validation_dataset=validation,
        foundation_state=foundation_state,
        capability_version=capability,
    )
    require(initialized["inputSha256"] == package["formalInitializationSha256"],
            "formal initialization differs from trained execution")

    checkpoint_binding = terminal["checkpoint"]
    checkpoint = torch.load(
        io.BytesIO(read_bound(ROOT, checkpoint_binding)),
        map_location="cpu",
        weights_only=True,
    )
    require(checkpoint.get("schemaVersion") == "project-owned-ai-assisted-cold-start-checkpoint-v7",
            "checkpoint schema invalid")
    require(checkpoint.get("executionIdentity", {}).get("executionPackage")
            == terminal["executionPackage"], "checkpoint execution identity mismatch")
    require(checkpoint.get("datasetBindingEvidence", {}).get("manifest")
            == package["datasetManifest"], "checkpoint dataset identity mismatch")
    require(checkpoint.get("modelConfig") == config, "checkpoint config mismatch")
    require(checkpoint.get("bestEpoch") == terminal["selectedEpoch"], "selected epoch mismatch")
    require(checkpoint.get("bestValidationMetric") == terminal["selectedScore"],
            "selected score mismatch")
    require(checkpoint.get("machineReviewPending") is True
            and checkpoint.get("formalInferenceEligible") is False
            and checkpoint.get("checkpointPromotionEligible") is False,
            "checkpoint role is not review-pending")
    require(state_dict_sha256(checkpoint["autoencoderState"])
            == state_dict_sha256(model.autoencoder.state_dict()),
            "checkpoint foundation differs")
    require(state_dict_sha256(checkpoint["denoiserState"])
            == terminal["denoiserStateSha256"], "checkpoint Denoiser identity mismatch")
    model.denoiser.load_state_dict(checkpoint["denoiserState"], strict=True)
    require(state_dict_sha256(model.denoiser.state_dict()) == terminal["denoiserStateSha256"],
            "loaded Denoiser identity mismatch")
    return config, model, checkpoint


def materialize(package_binding: dict, terminal_binding: dict, output_dir: str,
                capability: str):
    require(capability in SUPPORTED_CAPABILITIES, "unsupported capability identity")
    package, terminal = load_and_authenticate(package_binding, terminal_binding, capability)
    train = SplitReleaseDataset(ROOT, package["datasetManifest"], "train", (256, 192))
    validation = SplitReleaseDataset(ROOT, package["datasetManifest"], "validation", (256, 192))
    require(len(train) == 48 and len(validation) == 8, "formal split capacity mismatch")
    config, model, checkpoint = load_model(package, terminal, train, validation, capability)

    device = torch.device("cuda:0")
    require(torch.cuda.is_available(), "candidate generation CUDA unavailable")
    torch.cuda.set_device(0)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(0)
    model.to(device).eval()
    latent_normalization = load_latent_normalization(checkpoint, device)
    diffusion = build_diffusion_schedule(config, device)
    output_root = project_file(ROOT, output_dir)
    require(not (output_root / "manifest.json").exists(), "candidate manifest already exists")
    preview_root = output_root / "images"
    source_rows = validation.rows
    seed_count = int(config["training"].get("checkpointRolloutSeedsPerSample", 2))
    base_seed = int(terminal.get("stage", {}).get("seed", SEED)) + 3000
    before = state_dict_sha256(model.denoiser.state_dict())
    candidates = []
    with stage4_fixed_preview_determinism_scope(True):
        for sample_index, source_row in enumerate(source_rows):
            subset = torch.utils.data.Subset(validation, [sample_index])
            sample_seed = base_seed + sample_index * seed_count
            metrics = evaluate_deterministic_rollout_rgb_quality_v7(
                model,
                subset,
                diffusion,
                latent_normalization,
                device,
                sample_seed,
                config,
                preview_output_dir=preview_root,
                epoch_number=int(terminal["selectedEpoch"]),
                force_checkpoint_bound_preview=True,
            )
            artifact = metrics.get("previewArtifact")
            require(isinstance(artifact, dict), "checkpoint-bound preview missing")
            require(artifact.get("sampleId") == source_row["sampleId"], "preview sample mismatch")
            require(artifact.get("denoiserStateSha256") == terminal["denoiserStateSha256"],
                    "preview Denoiser identity mismatch")
            preview_path = project_file(ROOT, artifact["previewPath"])
            with Image.open(preview_path) as image:
                require(image.size == (256, 192) and image.mode == "RGB",
                        "candidate image dimensions or mode invalid")
            condition_pack = bound_json(ROOT, source_row["conditionPack"])
            channels = {item["id"]: {"path": item["path"], "sha256": item["sha256"]}
                        for item in condition_pack["channels"]}
            candidates.append({
                "sampleIndex": sample_index,
                "sampleId": source_row["sampleId"],
                "split": "validation",
                "seed": sample_seed,
                "candidateRgb": {
                    "path": artifact["previewPath"],
                    "sha256": artifact["previewSha256"],
                    "width": 256,
                    "height": 192,
                    "role": "complete_rgb_candidate",
                },
                "referenceRgb": source_row["image"],
                "conditionPack": source_row["conditionPack"],
                "objectMasks": [
                    {"role": role, **channels[role]} for role in OBJECT_MASK_ROLES
                ],
                "artifactIdentity": artifact,
                "rolloutMetrics": {key: value for key, value in metrics.items()
                                   if key != "previewArtifact"},
            })
    after = state_dict_sha256(model.denoiser.state_dict())
    require(before == after == terminal["denoiserStateSha256"], "candidate inference mutated weights")
    manifest = {
        "schemaVersion": "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1",
        "status": "candidate_pack_materialized_review_pending",
        "architectureId": capability,
        "executionPackageIdentity": package["packageId"],
        "runId": package["runId"],
        "stage": STAGE,
        "executionPackage": package_binding,
        "trainingTerminal": terminal_binding,
        "datasetManifest": package["datasetManifest"],
        "checkpoint": terminal["checkpoint"],
        "selectedEpoch": terminal["selectedEpoch"],
        "selectedScore": terminal["selectedScore"],
        "denoiserStateSha256": terminal["denoiserStateSha256"],
        "candidateCount": len(candidates),
        "candidateSplit": "validation",
        "candidates": candidates,
        "executionBoundary": {
            "gpuInferenceExecuted": True,
            "optimizerCreated": False,
            "optimizerSteps": 0,
            "backwardExecuted": False,
            "weightsModified": False,
            "challengeRead": False,
            "regressionRead": False,
            "machineReviewExecuted": False,
            "qualificationGranted": False,
        },
        "peakGpuReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "gpuTotalBytes": int(torch.cuda.get_device_properties(0).total_memory),
        "recordedAtUtc": utc_now(),
    }
    require(len(candidates) == 8, "all validation candidates are required")
    write_exclusive(output_root / "manifest.json", manifest)
    logical_manifest = output_dir.rstrip("/") + "/manifest.json"
    return {"status": manifest["status"], "manifest": bind(logical_manifest),
            "candidateCount": len(candidates)}


def main():
    parser = ArgumentParser()
    parser.add_argument("--execution-package", required=True)
    parser.add_argument("--execution-package-sha256", required=True)
    parser.add_argument("--training-terminal", required=True)
    parser.add_argument("--training-terminal-sha256", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--capability-version", choices=SUPPORTED_CAPABILITIES,
                        default=V2_CAPABILITY)
    args = parser.parse_args()
    try:
        result = materialize(
            {"path": args.execution_package.replace("\\", "/"),
             "sha256": args.execution_package_sha256},
            {"path": args.training_terminal.replace("\\", "/"),
             "sha256": args.training_terminal_sha256},
            args.output_dir.replace("\\", "/"),
            args.capability_version,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

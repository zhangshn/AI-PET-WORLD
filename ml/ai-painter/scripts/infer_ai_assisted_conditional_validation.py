from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
import os
from pathlib import Path
import time

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import build_complete_world_system, build_schedule, deterministic_velocity_step, inference_timesteps


def main() -> int:
    parser = ArgumentParser(description="Run one isolated AI-assisted complete-world inference validation.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--condition-pack", type=Path, required=True)
    parser.add_argument("--output-image", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--allow-progressive-checkpoint-nonformal", action="store_true")
    args = parser.parse_args()

    started = time.perf_counter()
    config = read_json(args.config)
    condition_pack = read_json(args.condition_pack)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    validate_inputs(config, condition_pack, checkpoint, args.allow_progressive_checkpoint_nonformal)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_complete_world_system(config).to(device)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.denoiser.load_state_dict(checkpoint["denoiserState"], strict=True)
    model.eval()

    conditions = load_conditions(condition_pack, config, device)
    width = int(config["imageSize"]["width"])
    height = int(config["imageSize"]["height"])
    factor = int(config["latentDownsampleFactor"])
    generator = torch.Generator(device=device).manual_seed(args.seed)
    latent_normalization = load_latent_normalization(checkpoint, device)
    latent = torch.randn(
        (1, int(config["latentChannels"]), height // factor, width // factor),
        generator=generator,
        device=device,
    )
    schedule = build_schedule(int(config["diffusionSteps"]), device)
    timesteps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)

    with torch.inference_mode():
        for index, timestep in enumerate(timesteps):
            previous = int(timesteps[index + 1]) if index + 1 < len(timesteps) else -1
            predicted_velocity = model.predict_velocity(latent, timestep.view(1), conditions)
            latent = deterministic_velocity_step(latent, predicted_velocity, int(timestep), previous, schedule["alphaBars"])
        decoded_latent = denormalize_latent(latent, latent_normalization)
        image = model.autoencoder.decode(decoded_latent).clamp(0.0, 1.0)[0]

    pixels = image.mul(255).byte().permute(1, 2, 0).cpu().numpy()
    args.output_image.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels, mode="RGB").save(args.output_image, format="PNG", optimize=True)
    report = {
        "schemaVersion": "ai-assisted-complete-world-inference-validation-report-v1",
        "status": "validation_image_generated_pending_machine_review",
        "ownership": "project_owned_architecture_ai_assisted_cold_start_weights",
        "trainingLane": "ai_assisted_cold_start",
        "trainingDataPolicyVersion": "owner-authorized-ai-assisted-cold-start-v1",
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": True,
        "aiGenerationDependencyDeclared": True,
        "modelId": config["modelId"],
        "conditionPackId": condition_pack["conditionPackId"],
        "worldId": condition_pack["worldId"],
        "tick": condition_pack["tick"],
        "seed": args.seed,
        "checkpointPath": str(args.checkpoint.resolve()),
        "checkpointSha256": sha256_file(args.checkpoint),
        "conditionPackPath": str(args.condition_pack.resolve()),
        "conditionPackSha256": condition_pack["conditionPackSha256"],
        "outputImagePath": str(args.output_image.resolve()),
        "outputImageSha256": sha256_file(args.output_image),
        "outputSize": {"width": width, "height": height},
        "checkpointNativeResolution": checkpoint["resolutionStage"],
        "checkpointNativeResolutionMatchesOutput": checkpoint["resolutionStage"] == {"width": width, "height": height},
        "progressiveCheckpointNonformalValidation": args.allow_progressive_checkpoint_nonformal,
        "inferenceSteps": int(config["inferenceSteps"]),
        "predictionTarget": config["predictionTarget"],
        "latentNormalizationVersion": checkpoint["latentNormalization"]["version"],
        "formalCandidate": False,
        "formalInferenceEligible": False,
        "runtimeFrameEligible": False,
        "requiresMachineReview": True,
        "requiresOwnerReview": True,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "automaticStorage": True,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def load_conditions(pack, config, device):
    channel_by_id = {channel["id"]: channel for channel in pack["channels"]}
    target_size = (int(config["imageSize"]["width"]), int(config["imageSize"]["height"]))
    arrays = []
    for channel_id in config["conditionChannelOrder"]:
        channel = channel_by_id.get(channel_id)
        if not channel:
            raise ValueError(f"condition channel missing: {channel_id}")
        channel_path = resolve_project_path(channel["path"])
        if sha256_file(channel_path) != channel.get("sha256"):
            raise ValueError(f"condition channel hash mismatch: {channel_id}")
        continuous = channel.get("kind") in {"distance", "coordinate", "continuous"} or channel_id.startswith("signed_distance_") or channel_id in {"coordinate_x", "coordinate_y", "moisture_proximity"}
        resampling = Image.Resampling.BILINEAR if continuous else Image.Resampling.NEAREST
        with Image.open(channel_path) as source:
            value = np.asarray(source.convert("L").resize(target_size, resample=resampling), dtype=np.uint8).copy()
        arrays.append(torch.from_numpy(value).float().div(255.0))
    return torch.stack(arrays, dim=0).unsqueeze(0).to(device)


def validate_inputs(config, pack, checkpoint, allow_progressive_checkpoint_nonformal):
    if config.get("ownership") != "project_owned_architecture_ai_assisted_cold_start_weights":
        raise ValueError("AI-assisted model configuration ownership is invalid")
    if config.get("trainingLane") != "ai_assisted_cold_start" or config.get("upstreamModelIds") != []:
        raise ValueError("AI-assisted model configuration provenance is invalid")
    if checkpoint.get("schemaVersion") != config.get("requiredCheckpointProvenance"):
        raise ValueError("AI-assisted checkpoint provenance schema is invalid")
    if checkpoint.get("ownership") != "project_owned_architecture_ai_assisted_cold_start_weights":
        raise ValueError("AI-assisted checkpoint ownership is invalid")
    if checkpoint.get("upstreamModelIds") != [] or checkpoint.get("thirdPartyWeightsLoaded") is not False:
        raise ValueError("AI-assisted checkpoint contains an upstream weight dependency")
    if checkpoint.get("thirdPartyGeneratedTrainingOutputUsed") is not True or checkpoint.get("aiGenerationDependencyDeclared") is not True:
        raise ValueError("AI-assisted training data dependency is not declared")
    if checkpoint.get("denoiserTrained") is not True or checkpoint.get("formalInferenceEligible") is not False:
        raise ValueError("AI-assisted checkpoint validation boundary is invalid")
    if checkpoint.get("trainingStage") != "conditional_denoiser_training" or checkpoint.get("programValidated") is not True:
        raise ValueError("AI-assisted checkpoint training-stage evidence is invalid")
    if config.get("predictionTarget") != "velocity_v1" or checkpoint.get("predictionTarget") != "velocity_v1":
        raise ValueError("AI-assisted checkpoint prediction target is invalid")
    if checkpoint.get("bestCheckpointMetric") != config.get("training", {}).get("bestCheckpointMetric"):
        raise ValueError("AI-assisted checkpoint selection metric is invalid")
    if checkpoint.get("denoiserLossVersion") != config.get("training", {}).get("denoiserLossVersion"):
        raise ValueError("AI-assisted checkpoint loss contract is invalid")
    if checkpoint.get("conditionResizeContract") != "discrete_nearest_continuous_bilinear_v1":
        raise ValueError("AI-assisted checkpoint condition resize contract is invalid")
    if checkpoint.get("latentNormalization", {}).get("version") != "per_channel_train_split_v1":
        raise ValueError("AI-assisted checkpoint latent normalization is invalid")
    checkpoint_resolution = checkpoint.get("resolutionStage")
    if allow_progressive_checkpoint_nonformal:
        if config.get("modelId") != "ai-pet-world-complete-world-ai-assisted-cold-start-v7-engineering-26":
            raise ValueError("progressive checkpoint exception is restricted to V7 engineering validation")
        if checkpoint_resolution != {"width": 256, "height": 192}:
            raise ValueError("V7 engineering validation requires the completed stage-0 checkpoint")
        if config.get("imageSize") != {"width": 1024, "height": 768}:
            raise ValueError("V7 engineering validation output contract must remain 1024x768")
    elif checkpoint_resolution != config.get("imageSize"):
        raise ValueError("AI-assisted checkpoint is not the native 1024x768 stage")
    if not isinstance(checkpoint.get("autoencoderState"), dict) or not isinstance(checkpoint.get("denoiserState"), dict):
        raise ValueError("AI-assisted checkpoint model state is missing")
    if pack.get("schemaVersion") != "complete-world-visual-condition-pack-v1":
        raise ValueError("condition pack schema is invalid")
    if len(pack.get("channels", [])) != len(config["conditionChannelOrder"]):
        raise ValueError("condition pack channel count is invalid")
    if [channel.get("id") for channel in pack["channels"]] != config["conditionChannelOrder"]:
        raise ValueError("condition pack channel order is invalid")
    if not canonical_json_hash_matches(pack, "conditionPackSha256"):
        raise ValueError("condition pack canonical hash is invalid")
    must_show = set(pack.get("categoricalConditions", {}).get("sceneIntent", {}).get("mustShow", []))
    if pack.get("canvas") != {"width": 1024, "height": 768, "coordinateSpace": "task_output_pixels", "frameScope": "complete_runtime_frame"}:
        raise ValueError("condition pack canvas is not a complete native RuntimeFrame")
    if pack.get("categoricalConditions", {}).get("sceneIntent", {}).get("sceneType") != "training_complete_natural_home_map":
        raise ValueError("condition pack scene is not a complete natural-home map")
    if not {"entrance", "main_path", "home_center", "natural_boundary"}.issubset(must_show):
        raise ValueError("condition pack is missing complete-map composition identities")


def load_latent_normalization(checkpoint, device):
    value = checkpoint["latentNormalization"]
    mean = value.get("mean")
    standard_deviation = value.get("standardDeviation")
    if not isinstance(mean, list) or not isinstance(standard_deviation, list) or len(mean) != len(standard_deviation):
        raise ValueError("AI-assisted latent normalization values are invalid")
    if any(float(item) <= 0 for item in standard_deviation):
        raise ValueError("AI-assisted latent normalization scale is invalid")
    return {
        "mean": torch.tensor(mean, dtype=torch.float32, device=device).view(1, -1, 1, 1),
        "standardDeviation": torch.tensor(standard_deviation, dtype=torch.float32, device=device).view(1, -1, 1, 1),
    }


def denormalize_latent(latent, normalization):
    return latent * normalization["standardDeviation"] + normalization["mean"]


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json_hash_matches(value, hash_field):
    expected = value.get(hash_field)
    if not isinstance(expected, str):
        return False
    canonical = dict(value)
    canonical.pop(hash_field, None)
    payload = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest() == expected


def resolve_project_path(value):
    root = Path.cwd().resolve()
    resolved = (root / value).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        default_data_root = Path("D:/AI-PET-WORLD-DATA") if os.name == "nt" else root / ".ai-pet-world-data"
        physical_runtime_root = (Path(os.environ.get("AI_PET_WORLD_DATA_ROOT", default_data_root)) / "hot" / "runtime").resolve()
        try:
            resolved.relative_to(physical_runtime_root)
        except ValueError as error:
            raise ValueError(f"condition channel path escapes approved project and runtime roots: {value}") from error
    if not resolved.is_file():
        raise ValueError(f"condition channel file is missing: {value}")
    return resolved


if __name__ == "__main__":
    raise SystemExit(main())

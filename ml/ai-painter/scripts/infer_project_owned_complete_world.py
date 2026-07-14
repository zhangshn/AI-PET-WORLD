from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import time

import numpy as np
from PIL import Image
import torch

from ai_painter.complete_world import build_complete_world_system, build_schedule, deterministic_step, inference_timesteps


def main() -> int:
    parser = ArgumentParser(description="Run the project-owned complete-world diffusion sampler.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--condition-pack", type=Path, required=True)
    parser.add_argument("--output-image", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--seed", type=int, required=True)
    args = parser.parse_args()

    started = time.perf_counter()
    config = read_json(args.config)
    condition_pack = read_json(args.condition_pack)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    validate_inputs(config, condition_pack, checkpoint)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_complete_world_system(config).to(device)
    model.load_state_dict(checkpoint["modelState"], strict=True)
    model.eval()
    conditions = load_conditions(condition_pack, config, device)
    width = int(config["imageSize"]["width"])
    height = int(config["imageSize"]["height"])
    factor = int(config["latentDownsampleFactor"])
    generator = torch.Generator(device=device).manual_seed(args.seed)
    latent = torch.randn((1, int(config["latentChannels"]), height // factor, width // factor), generator=generator, device=device)
    schedule = build_schedule(int(config["diffusionSteps"]), device)
    timesteps = inference_timesteps(int(config["diffusionSteps"]), int(config["inferenceSteps"]), device)

    with torch.inference_mode():
        for index, timestep in enumerate(timesteps):
            previous = int(timesteps[index + 1]) if index + 1 < len(timesteps) else -1
            batch_timestep = timestep.view(1)
            predicted_noise = model.predict_noise(latent, batch_timestep, conditions)
            latent = deterministic_step(latent, predicted_noise, int(timestep), previous, schedule["alphaBars"])
        image = model.autoencoder.decode(latent).clamp(0.0, 1.0)[0]

    pixels = image.mul(255).byte().permute(1, 2, 0).cpu().numpy()
    args.output_image.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels, mode="RGB").save(args.output_image, format="PNG", optimize=True)
    report = {
        "schemaVersion": "project-owned-complete-world-inference-report-v1",
        "status": "completed_candidate_generated",
        "ownership": "project_owned_independent_weights",
        "upstreamModelIds": [],
        "thirdPartyWeightsLoaded": False,
        "thirdPartyGeneratedTrainingOutputUsed": False,
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
        "inferenceSteps": int(config["inferenceSteps"]),
        "durationSeconds": round(time.perf_counter() - started, 3),
        "automaticStorage": True,
    }
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
        continuous = channel.get("kind") in {"distance", "coordinate", "continuous"} or channel_id.startswith("signed_distance_") or channel_id in {"coordinate_x", "coordinate_y", "moisture_proximity"}
        resampling = Image.Resampling.BILINEAR if continuous else Image.Resampling.NEAREST
        with Image.open(channel["path"]) as image:
            value = np.asarray(image.convert("L").resize(target_size, resample=resampling), dtype=np.uint8).copy()
        arrays.append(torch.from_numpy(value).float().div(255.0))
    return torch.stack(arrays, dim=0).unsqueeze(0).to(device)


def validate_inputs(config, pack, checkpoint):
    if config.get("ownership") != "project_owned_independent_weights" or config.get("upstreamModelIds") != []:
        raise ValueError("model configuration is not independently owned")
    if checkpoint.get("schemaVersion") != "project-owned-complete-world-checkpoint-v1":
        raise ValueError("checkpoint provenance schema is invalid")
    if checkpoint.get("ownership") != "project_owned_independent_weights" or checkpoint.get("upstreamModelIds") != []:
        raise ValueError("checkpoint has an upstream model dependency")
    if checkpoint.get("thirdPartyWeightsLoaded") is not False or checkpoint.get("thirdPartyGeneratedTrainingOutputUsed") is not False:
        raise ValueError("checkpoint violates independent training provenance")
    if pack.get("schemaVersion") != "complete-world-visual-condition-pack-v1" or len(pack.get("channels", [])) != len(config["conditionChannelOrder"]):
        raise ValueError("condition pack contract is invalid")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())

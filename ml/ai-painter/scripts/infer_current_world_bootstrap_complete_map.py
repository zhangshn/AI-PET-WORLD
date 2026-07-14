from __future__ import annotations

from argparse import ArgumentParser
from contextlib import nullcontext
import hashlib
import json
from pathlib import Path
import time
from typing import Any

import numpy as np
from PIL import Image

from ai_painter.training.rgb_refiner_model import build_rgb_refiner
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


LEGACY_CHANNELS = (
    "grass",
    "water_body",
    "shoreline",
    "road_center",
    "road_edge",
    "tree_trunk",
    "tree_crown",
    "rock",
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
    "walkable",
    "depth",
)
BOOTSTRAP_NATIVE_SIZE = (256, 192)
BOOTSTRAP_LATENT_NOISE_SCALE = 0.025


def main() -> int:
    parser = ArgumentParser(description="Generate one bootstrap complete-map candidate from the current compiled condition pack.")
    parser.add_argument("--condition-pack", type=Path, required=True)
    parser.add_argument("--structure-checkpoint", type=Path, required=True)
    parser.add_argument("--refiner-checkpoint", type=Path, required=True)
    parser.add_argument("--output-image", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--seed", type=int, required=True)
    args = parser.parse_args()

    started = time.perf_counter()
    condition_pack = read_json(args.condition_pack)
    validate_condition_pack(condition_pack)
    width = int(condition_pack["canvas"]["width"])
    height = int(condition_pack["canvas"]["height"])
    channel_index = {item["id"]: item for item in condition_pack["channels"]}
    loaded = {channel_id: read_channel(Path(item["path"]), width, height) for channel_id, item in channel_index.items()}
    zeros = np.zeros((height, width), dtype=np.float32)

    path_distance = loaded["signed_distance_path"]
    road_edge = (np.abs(path_distance - (128.0 / 255.0)) <= (8.0 / 255.0)).astype(np.float32)
    mapping: dict[str, dict[str, Any]] = {
        "grass": mapped("terrain_grass"),
        "water_body": mapped("terrain_water"),
        "shoreline": mapped("terrain_shoreline"),
        "road_center": mapped("terrain_path_ground"),
        "road_edge": derived("signed_distance_path", "absolute_distance_to_encoded_boundary_lte_8"),
        "tree_trunk": mapped("object_tree", "authoritative footprint reused because trunk geometry is unavailable"),
        "tree_crown": mapped("object_tree", "authoritative footprint reused because crown geometry is unavailable"),
        "rock": mapped("object_rock"),
        "shelter_foundation": forbidden_zero("building is outside current scope"),
        "shelter_wall": forbidden_zero("building is outside current scope"),
        "shelter_roof": forbidden_zero("building is outside current scope"),
        "construction_material": forbidden_zero("construction is outside current scope"),
        "walkable": mapped("walkable"),
        "depth": missing_zero("authoritative depth channel is unavailable in the current condition pack"),
    }
    arrays = {
        "grass": loaded["terrain_grass"],
        "water_body": loaded["terrain_water"],
        "shoreline": loaded["terrain_shoreline"],
        "road_center": loaded["terrain_path_ground"],
        "road_edge": road_edge,
        "tree_trunk": loaded["object_tree"],
        "tree_crown": loaded["object_tree"],
        "rock": loaded["object_rock"],
        "shelter_foundation": zeros,
        "shelter_wall": zeros,
        "shelter_roof": zeros,
        "construction_material": zeros,
        "walkable": loaded["walkable"],
        "depth": zeros,
    }

    torch = require_torch()
    seed_everything(torch, args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    native_width, native_height = BOOTSTRAP_NATIVE_SIZE
    native_arrays = {
        name: resize_float_channel(value, native_width, native_height)
        for name, value in arrays.items()
    }
    condition = torch.from_numpy(np.stack([native_arrays[name] for name in LEGACY_CHANNELS], axis=0)).unsqueeze(0)

    structure_state = torch.load(args.structure_checkpoint, map_location="cpu", weights_only=False)
    structure_config = structure_state["config"]
    require_channels(structure_config, 14, "structure checkpoint")
    structure_model = build_structure_guided_unet(structure_config).to(device)
    structure_model.load_state_dict(structure_state["model"])
    structure_model.eval()

    structure_autocast = torch.autocast(device_type="cuda", dtype=torch.float16) if device.type == "cuda" else nullcontext()
    with torch.inference_mode(), structure_autocast:
        base_rgb, _ = structure_model(condition.to(device))
    base_rgb = base_rgb.float().cpu()
    latent_generator = torch.Generator(device="cpu")
    latent_generator.manual_seed(args.seed)
    latent_noise = torch.randn(base_rgb.shape, generator=latent_generator) * BOOTSTRAP_LATENT_NOISE_SCALE
    base_rgb = (base_rgb + latent_noise).clamp(0, 1)
    del structure_model
    if device.type == "cuda":
        torch.cuda.empty_cache()

    refiner_state = torch.load(args.refiner_checkpoint, map_location="cpu", weights_only=False)
    refiner_config = refiner_state["config"]
    require_channels(refiner_config, 17, "RGB refiner checkpoint")
    refiner = build_rgb_refiner(refiner_config).to(device)
    refiner.load_state_dict(refiner_state["model"])
    refiner.eval()
    refiner_autocast = torch.autocast(device_type="cuda", dtype=torch.float16) if device.type == "cuda" else nullcontext()
    with torch.inference_mode(), refiner_autocast:
        prediction = refiner(condition.to(device), base_rgb.to(device))
    native_pixels = prediction[0].float().clamp(0, 1).mul(255).byte().cpu().permute(1, 2, 0).numpy()

    args.output_image.parent.mkdir(parents=True, exist_ok=True)
    native_output_path = args.output_image.with_name(f"{args.output_image.stem}-native-256x192.png")
    native_image = Image.fromarray(np.asarray(native_pixels, dtype=np.uint8), mode="RGB")
    native_image.save(native_output_path, format="PNG", optimize=True)
    review_image = native_image.resize((width, height), resample=Image.Resampling.LANCZOS)
    review_image.save(args.output_image, format="PNG", optimize=True)
    output_sha256 = sha256_file(args.output_image)
    consumed_ids = sorted({entry.get("sourceChannel") for entry in mapping.values() if entry.get("sourceChannel")})
    unused_ids = sorted(set(channel_index) - set(consumed_ids))
    finished = time.perf_counter()
    report = {
        "schemaVersion": "current-world-bootstrap-model-report-v1",
        "status": "completed_bootstrap_candidate_generated",
        "taskId": condition_pack["taskId"],
        "conditionPackId": condition_pack["conditionPackId"],
        "dictionaryVersionId": condition_pack["dictionaryVersionId"],
        "worldId": condition_pack["worldId"],
        "tick": condition_pack["tick"],
        "seed": args.seed,
        "device": str(device),
        "canvas": {"width": width, "height": height},
        "nativeModelOutputSize": {"width": native_width, "height": native_height},
        "reviewOutputResample": {"method": "lanczos", "width": width, "height": height, "formalNativeResolution": False},
        "latentInput": {"kind": "seeded_rgb_base_noise", "seed": args.seed, "scale": BOOTSTRAP_LATENT_NOISE_SCALE},
        "adapterVersion": "bootstrap-legacy-14-channel-native-resolution-adapter-v2",
        "legacyInputChannels": list(LEGACY_CHANNELS),
        "channelMapping": mapping,
        "consumedCompiledChannelIds": consumed_ids,
        "unusedCompiledChannelIds": unused_ids,
        "structureCheckpoint": str(args.structure_checkpoint.resolve()),
        "structureCheckpointSha256": sha256_file(args.structure_checkpoint),
        "structureModelVersion": structure_config.get("modelVersion"),
        "refinerCheckpoint": str(args.refiner_checkpoint.resolve()),
        "refinerCheckpointSha256": sha256_file(args.refiner_checkpoint),
        "refinerModelVersion": refiner_config.get("modelVersion"),
        "outputImagePath": str(args.output_image.resolve()),
        "outputImageSha256": output_sha256,
        "nativeOutputImagePath": str(native_output_path.resolve()),
        "nativeOutputImageSha256": sha256_file(native_output_path),
        "outputSource": "fresh_local_model_inference",
        "reusedExistingImage": False,
        "targetImageUsed": False,
        "programDrawnRgbUsed": False,
        "durationSeconds": round(finished - started, 3),
        "formalLimitations": [
            "bootstrap checkpoints were trained at 256x192",
            "1024x768 review image is a Lanczos resample of the native 256x192 local-model output and is not formal native-resolution evidence",
            "legacy adapter consumes 14 compatible channels rather than the full current condition vocabulary",
            "authoritative depth, separate tree trunk/crown, contact shadow, ground disturbance and per-pixel occlusion are unavailable",
            "candidate cannot enter /world and cannot become a positive sample without owner approval",
        ],
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def read_channel(path: Path, width: int, height: int) -> np.ndarray:
    with Image.open(path) as image:
        normalized = image.convert("L")
        if normalized.size != (width, height):
            raise ValueError(f"condition channel size mismatch: {path}")
        return np.asarray(normalized, dtype=np.float32) / 255.0


def resize_float_channel(value: np.ndarray, width: int, height: int) -> np.ndarray:
    encoded = np.clip(value * 255.0, 0, 255).astype(np.uint8)
    resized = Image.fromarray(encoded, mode="L").resize((width, height), resample=Image.Resampling.NEAREST)
    return np.asarray(resized, dtype=np.float32) / 255.0


def validate_condition_pack(value: dict[str, Any]) -> None:
    if value.get("schemaVersion") != "complete-world-visual-condition-pack-v1":
        raise ValueError("unsupported condition pack schema")
    if value.get("status") != "compiled_conditions_ready":
        raise ValueError("condition pack is not ready")
    if value.get("outputKind") != "model_condition_only_no_rgb":
        raise ValueError("condition pack output boundary mismatch")
    if value.get("generatesPlayerFacingPixels") is not False:
        raise ValueError("condition pack must not be a player-facing image")


def mapped(source: str, note: str | None = None) -> dict[str, Any]:
    return {"mode": "direct_current_condition", "sourceChannel": source, "note": note}


def derived(source: str, operation: str) -> dict[str, Any]:
    return {"mode": "deterministic_condition_derivation", "sourceChannel": source, "operation": operation}


def forbidden_zero(reason: str) -> dict[str, Any]:
    return {"mode": "forced_zero_forbidden_scope", "sourceChannel": None, "reason": reason}


def missing_zero(reason: str) -> dict[str, Any]:
    return {"mode": "forced_zero_authoritative_source_missing", "sourceChannel": None, "reason": reason, "guessed": False}


def require_channels(config: dict[str, Any], expected: int, label: str) -> None:
    actual = int(config.get("inputChannels", 0))
    if actual != expected:
        raise ValueError(f"{label} inputChannels={actual}, expected={expected}")


def seed_everything(torch, seed: int) -> None:
    np.random.seed(seed % (2**32))
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    if hasattr(torch.backends, "cudnn"):
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())

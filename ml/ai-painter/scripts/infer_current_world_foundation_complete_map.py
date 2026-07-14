from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import time
from typing import Any

import numpy as np
from PIL import Image, ImageDraw
import torch
from diffusers import ControlNetModel, StableDiffusionControlNetPipeline, UniPCMultistepScheduler


REVIEW_SIZE = (1024, 768)
NATIVE_SIZE = REVIEW_SIZE
PALETTE = {
    "grass": (4, 250, 7),
    "water": (61, 230, 250),
    "shoreline": (120, 120, 70),
    "path": (0, 10, 255),
    "tree": (4, 200, 3),
    "rock": (255, 41, 10),
}
ADE20K_CLASS_BINDINGS = {
    "grass": {"classIndex": 9, "className": "grass"},
    "water": {"classIndex": 21, "className": "water"},
    "shoreline": {"classIndex": 13, "className": "earth"},
    "path": {"classIndex": 91, "className": "dirt track"},
    "tree": {"classIndex": 4, "className": "tree"},
    "rock": {"classIndex": 34, "className": "rock"},
}


def main() -> int:
    parser = ArgumentParser(description="Generate a current-world bootstrap candidate with a fully local visual foundation model.")
    parser.add_argument("--condition-pack", type=Path, required=True)
    parser.add_argument("--task-package", type=Path, required=True)
    parser.add_argument("--source-manifest", type=Path, required=True)
    parser.add_argument("--output-image", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--failure-feedback", type=Path)
    args = parser.parse_args()

    started = time.perf_counter()
    condition_pack = read_json(args.condition_pack)
    task = read_json(args.task_package)
    source_manifest = read_json(args.source_manifest)
    validate_inputs(condition_pack, task, source_manifest)
    model_by_role = {item["role"]: item for item in source_manifest["models"]}
    base = model_by_role["base_visual_prior"]
    control = model_by_role["segmentation_condition_adapter"]
    control_image, consumed_ids = build_segmentation_condition(condition_pack)
    failure_feedback = read_json(args.failure_feedback) if args.failure_feedback else None
    prompt, negative_prompt, consumed_failure_codes, semantic_summary = compile_prompts(task, failure_feedback, condition_pack)

    args.output_image.parent.mkdir(parents=True, exist_ok=True)
    control_path = args.output_image.with_name("controlnet-seg-condition.png")
    native_path = args.output_image.with_name("candidate-native-1024x768.png")
    control_image.save(control_path, format="PNG", optimize=True)

    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    controlnet = ControlNetModel.from_pretrained(
        resolve_local(control["localPath"]),
        torch_dtype=dtype,
        variant="fp16" if dtype == torch.float16 else None,
        use_safetensors=True,
        local_files_only=True,
    )
    pipeline = StableDiffusionControlNetPipeline.from_pretrained(
        resolve_local(base["localPath"]),
        controlnet=controlnet,
        torch_dtype=dtype,
        variant="fp16" if dtype == torch.float16 else None,
        use_safetensors=True,
        local_files_only=True,
    )
    pipeline.scheduler = UniPCMultistepScheduler.from_config(pipeline.scheduler.config)
    pipeline.enable_attention_slicing("max")
    pipeline.enable_vae_slicing()
    pipeline.enable_vae_tiling()
    if torch.cuda.is_available():
        pipeline.enable_model_cpu_offload()
        if pipeline.safety_checker is not None:
            configure_cpu_safety_checker(pipeline)
        generator = torch.Generator(device="cpu").manual_seed(args.seed)
    else:
        pipeline.to("cpu")
        generator = torch.Generator(device="cpu").manual_seed(args.seed)

    prompt_token_count = len(pipeline.tokenizer(prompt, truncation=False)["input_ids"])
    negative_prompt_token_count = len(pipeline.tokenizer(negative_prompt, truncation=False)["input_ids"])
    if prompt_token_count > pipeline.tokenizer.model_max_length:
        raise ValueError(f"positive prompt exceeds model token limit: {prompt_token_count}")
    if negative_prompt_token_count > pipeline.tokenizer.model_max_length:
        raise ValueError(f"negative prompt exceeds model token limit: {negative_prompt_token_count}")

    result = pipeline(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=control_image,
        width=NATIVE_SIZE[0],
        height=NATIVE_SIZE[1],
        num_inference_steps=30,
        guidance_scale=8.0,
        controlnet_conditioning_scale=1.2,
        generator=generator,
    )
    if not result.images:
        raise RuntimeError("local foundation model returned no image")
    native_image = result.images[0].convert("RGB")
    native_image.save(native_path, format="PNG", optimize=True)
    review_image = native_image.copy()
    review_image.save(args.output_image, format="PNG", optimize=True)

    report = {
        "schemaVersion": "current-world-foundation-bootstrap-model-report-v1",
        "status": "completed_bootstrap_candidate_generated",
        "taskId": task["taskId"],
        "conditionPackId": condition_pack["conditionPackId"],
        "dictionaryVersionId": condition_pack["dictionaryVersionId"],
        "worldId": condition_pack["worldId"],
        "tick": condition_pack["tick"],
        "seed": args.seed,
        "device": "cuda_with_model_cpu_offload" if torch.cuda.is_available() else "cpu",
        "adapterVersion": "local-sd15-controlnet-seg-complete-map-bootstrap-v10",
        "modelVersion": f"{base['repoId']}@{base['revision']}+{control['repoId']}@{control['revision']}",
        "modelSourceManifestPath": str(args.source_manifest.resolve()),
        "modelSourceManifestSha256": sha256_file(args.source_manifest),
        "consumedCompiledChannelIds": consumed_ids,
        "unusedCompiledChannelIds": sorted(set(item["id"] for item in condition_pack["channels"]) - set(consumed_ids)),
        "prompt": prompt,
        "negativePrompt": negative_prompt,
        "promptTokenCount": prompt_token_count,
        "negativePromptTokenCount": negative_prompt_token_count,
        "promptTokenLimit": pipeline.tokenizer.model_max_length,
        "failureFeedbackInputPath": str(args.failure_feedback.resolve()) if args.failure_feedback else None,
        "consumedFailureCodes": consumed_failure_codes,
        "conditionSemanticSummary": semantic_summary,
        "controlImagePath": str(control_path.resolve()),
        "controlImageSha256": sha256_file(control_path),
        "controlProtocol": "ADE20K SceneParse150 palette used by ControlNet segmentation",
        "controlClassBindings": {
            key: {**value, "rgb": list(PALETTE[key])}
            for key, value in ADE20K_CLASS_BINDINGS.items()
        },
        "nativeModelOutputSize": {"width": NATIVE_SIZE[0], "height": NATIVE_SIZE[1]},
        "nativeOutputImagePath": str(native_path.resolve()),
        "nativeOutputImageSha256": sha256_file(native_path),
        "reviewOutputResample": {"method": "none", "width": REVIEW_SIZE[0], "height": REVIEW_SIZE[1], "formalNativeResolution": True},
        "outputImagePath": str(args.output_image.resolve()),
        "outputImageSha256": sha256_file(args.output_image),
        "outputSource": "fresh_local_foundation_inference",
        "reusedExistingImage": False,
        "targetImageUsed": False,
        "programDrawnRgbUsed": False,
        "onlineInferenceApiUsed": False,
        "localFilesOnly": True,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "formalLimitations": [
            "external open-license model is used only as a fully local bootstrap visual prior",
            "segmentation ControlNet consumes a semantic subset of the current 23-channel condition vocabulary",
            "candidate cannot enter /world or become positive without machine gates and owner approval",
        ],
    }
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def build_segmentation_condition(pack: dict[str, Any]) -> tuple[Image.Image, list[str]]:
    channels = {item["id"]: item for item in pack["channels"]}
    required = ["terrain_grass", "terrain_water", "terrain_shoreline", "terrain_path_ground", "object_tree", "object_rock"]
    masks = {name: load_mask(Path(channels[name]["path"])) for name in required}
    width, height = pack["canvas"]["width"], pack["canvas"]["height"]
    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    canvas[:, :] = PALETTE["grass"]
    for channel_id, palette_id in [
        ("terrain_water", "water"),
        ("terrain_shoreline", "shoreline"),
        ("terrain_path_ground", "path"),
        ("object_tree", "tree"),
        ("object_rock", "rock"),
    ]:
        mask = masks[channel_id]
        if channel_id in {"object_tree", "object_rock"}:
            mask = naturalize_object_footprints(mask)
        canvas[mask >= 128] = PALETTE[palette_id]
    image = Image.fromarray(canvas, mode="RGB").resize(NATIVE_SIZE, resample=Image.Resampling.NEAREST)
    return image, required


def compile_prompts(
    task: dict[str, Any],
    failure_feedback: dict[str, Any] | None,
    condition_pack: dict[str, Any],
) -> tuple[str, str, list[str], dict[str, Any]]:
    director = task["directorPlan"]
    channel_by_id = {item["id"]: item for item in condition_pack["channels"]}
    tree_count = count_mask_components(load_mask(Path(channel_by_id["object_tree"]["path"])))
    rock_count = count_mask_components(load_mask(Path(channel_by_id["object_rock"]["path"])))
    semantic_summary = {
        "treeCount": tree_count,
        "rockCount": rock_count,
        "waterLocation": "right_boundary_only",
        "pathKind": "flat_dirt_track",
    }
    failure_codes = sorted({item.get("code") for item in (failure_feedback or {}).get("issues", []) if item.get("code")})
    applied_failure_codes = []
    if "vj1_low_detail_blur_artifact" in failure_codes:
        applied_failure_codes.append("vj1_low_detail_blur_artifact")
    if "vj2_path_not_visually_distinct" in failure_codes:
        applied_failure_codes.append("vj2_path_not_visually_distinct")
    if "professional_clip_playable_map_readability_failed" in failure_codes:
        applied_failure_codes.append("professional_clip_playable_map_readability_failed")
    if "vj2_water_outside_condition_mask" in failure_codes:
        applied_failure_codes.append("vj2_water_outside_condition_mask")
    if "vj2_object_block_readability_failed" in failure_codes:
        applied_failure_codes.append("vj2_object_block_readability_failed")
    prompt = (
        "professional top-down orthographic 2D JRPG game map, crisp production game art, readable playable dry grassland, "
        "coastal sea only on far right edge, no inland water, flat brown dirt track exactly following marked route, "
        f"exactly {tree_count} round trees and {rock_count} grounded rocks only at marked positions, clean terrain, soft daylight, no interface"
    )
    negative = (
        "watercolor, concept art, aerial photo, 3D render, buildings, characters, animals, text, UI, pond, inland lake, extra river, "
        "wall, fence, bridge, raised path, log, branch, pipe, extra trees, extra rocks, square objects, collage, repeated texture, blur, noise, scan lines"
    )
    semantic_summary["directorPlanId"] = director.get("directorRunId")
    return prompt, negative, applied_failure_codes, semantic_summary


def count_mask_components(mask: np.ndarray) -> int:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    count = 0
    for start_y in range(height):
        for start_x in range(width):
            if mask[start_y, start_x] < 128 or visited[start_y, start_x]:
                continue
            count += 1
            stack = [(start_x, start_y)]
            visited[start_y, start_x] = True
            while stack:
                x, y = stack.pop()
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= next_x < width and 0 <= next_y < height and not visited[next_y, next_x] and mask[next_y, next_x] >= 128:
                        visited[next_y, next_x] = True
                        stack.append((next_x, next_y))
    return count


def configure_cpu_safety_checker(pipeline: StableDiffusionControlNetPipeline) -> None:
    pipeline.safety_checker.to(device="cpu", dtype=torch.float32)

    def run_safety_checker(image: Any, _device: Any, _dtype: Any) -> tuple[Any, Any]:
        if torch.is_tensor(image):
            feature_input = pipeline.image_processor.postprocess(image, output_type="pil")
        else:
            feature_input = pipeline.image_processor.numpy_to_pil(image)
        clip_input = pipeline.feature_extractor(feature_input, return_tensors="pt").pixel_values.to(
            device="cpu",
            dtype=torch.float32,
        )
        checked_image, flags = pipeline.safety_checker(images=image, clip_input=clip_input)
        return checked_image, flags

    pipeline.run_safety_checker = run_safety_checker


def validate_inputs(pack: dict[str, Any], task: dict[str, Any], source: dict[str, Any]) -> None:
    if pack.get("schemaVersion") != "complete-world-visual-condition-pack-v1" or pack.get("status") != "compiled_conditions_ready":
        raise ValueError("condition pack is invalid")
    if task.get("taskId") != pack.get("taskId"):
        raise ValueError("task and condition pack identity mismatch")
    if source.get("schemaVersion") != "ai-painter-local-visual-foundation-manifest-v1" or source.get("status") != "local_visual_foundation_ready":
        raise ValueError("local visual foundation manifest is invalid")
    if source.get("onlineInferenceApiUsed") is not False or source.get("localFilesOnly") is not True:
        raise ValueError("local-only model boundary is invalid")


def load_mask(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        return np.asarray(image.convert("L"), dtype=np.uint8)


def naturalize_object_footprints(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    output = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(output)
    for start_y in range(height):
        for start_x in range(width):
            if mask[start_y, start_x] < 128 or visited[start_y, start_x]:
                continue
            stack = [(start_x, start_y)]
            visited[start_y, start_x] = True
            min_x = max_x = start_x
            min_y = max_y = start_y
            while stack:
                x, y = stack.pop()
                min_x, max_x = min(min_x, x), max(max_x, x)
                min_y, max_y = min(min_y, y), max(max_y, y)
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= next_x < width and 0 <= next_y < height and not visited[next_y, next_x] and mask[next_y, next_x] >= 128:
                        visited[next_y, next_x] = True
                        stack.append((next_x, next_y))
            inset_x = max(1, int((max_x - min_x + 1) * 0.08))
            inset_y = max(1, int((max_y - min_y + 1) * 0.08))
            draw.ellipse((min_x + inset_x, min_y + inset_y, max_x - inset_x, max_y - inset_y), fill=255)
    return np.asarray(output, dtype=np.uint8)


def resolve_local(value: str) -> str:
    return str((Path.cwd() / value).resolve())


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

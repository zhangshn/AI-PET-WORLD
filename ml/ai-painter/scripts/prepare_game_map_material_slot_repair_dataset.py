from __future__ import annotations

from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS


FORBIDDEN_LATER_STAGE_CHANNELS = (
    "shelter_foundation",
    "shelter_wall",
    "shelter_roof",
    "construction_material",
)


CATEGORY_RULES = {
    "grass": {
        "focusChannels": ("grass",),
        "patchSize": 96,
        "minFocusRatio": 0.58,
        "maxTreeRatio": 0.14,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 1.0,
        "maxRockRatio": 0.12,
        "trainLimit": 180,
        "validationLimit": 36,
    },
    "grass_object": {
        "focusChannels": ("grass",),
        "patchSize": 48,
        "minFocusRatio": 0.18,
        "maxTreeRatio": 0.20,
        "maxWaterRatio": 0.15,
        "maxRoadRatio": 0.45,
        "maxRockRatio": 0.28,
        "trainLimit": 160,
        "validationLimit": 32,
    },
    "road": {
        "focusChannels": ("road_center", "road_edge"),
        "patchSize": 64,
        "minFocusRatio": 0.26,
        "maxTreeRatio": 0.03,
        "maxWaterRatio": 0.0,
        "maxRoadRatio": 1.0,
        "maxRockRatio": 0.08,
        "trainLimit": 140,
        "validationLimit": 28,
    },
    "rock": {
        "focusChannels": ("rock",),
        "patchSize": 48,
        "minFocusRatio": 0.008,
        "maxTreeRatio": 0.18,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 1.0,
        "maxRockRatio": 1.0,
        "trainLimit": 120,
        "validationLimit": 24,
    },
    "rock_object": {
        "focusChannels": ("rock",),
        "patchSize": 48,
        "minFocusRatio": 0.008,
        "maxTreeRatio": 0.35,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 0.55,
        "maxRockRatio": 1.0,
        "trainLimit": 120,
        "validationLimit": 24,
    },
    "water": {
        "focusChannels": ("water_body",),
        "patchSize": 96,
        "minFocusRatio": 0.28,
        "maxTreeRatio": 0.12,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 0.12,
        "maxRockRatio": 0.30,
        "trainLimit": 140,
        "validationLimit": 28,
    },
    "shoreline": {
        "focusChannels": ("shoreline",),
        "patchSize": 80,
        "minFocusRatio": 0.10,
        "maxTreeRatio": 0.10,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 0.28,
        "maxRockRatio": 0.35,
        "trainLimit": 140,
        "validationLimit": 28,
    },
    "tree": {
        "focusChannels": ("tree_crown", "tree_trunk"),
        "patchSize": 96,
        "minFocusRatio": 0.02,
        "maxTreeRatio": 1.0,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 0.45,
        "maxRockRatio": 0.55,
        "trainLimit": 160,
        "validationLimit": 32,
    },
    "tree_object": {
        "focusChannels": ("tree_crown", "tree_trunk"),
        "patchSize": 64,
        "minFocusRatio": 0.02,
        "maxTreeRatio": 1.0,
        "maxWaterRatio": 1.0,
        "maxRoadRatio": 0.45,
        "maxRockRatio": 0.55,
        "trainLimit": 160,
        "validationLimit": 32,
    },
}


def main() -> int:
    parser = ArgumentParser(
        description="Prepare same-source repair patches for game-map material slots."
    )
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument(
        "--only-category",
        choices=sorted(CATEGORY_RULES.keys()),
        help="Prepare one material category instead of the full category set.",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output_root.exists():
        if args.only_category:
            category_root = args.output_root / args.only_category
            if category_root.exists():
                if not args.force:
                    raise FileExistsError(f"category output already exists: {category_root}")
                shutil.rmtree(category_root)
        elif not args.force:
            raise FileExistsError(f"output root already exists: {args.output_root}")
        else:
            shutil.rmtree(args.output_root)

    source_root = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    train_ids = read_index(args.dataset_root / "indexes" / "train.json")
    validation_ids = read_index(args.dataset_root / "indexes" / "validation.json")
    if not source_root.exists():
        raise FileNotFoundError(f"source dataset not found: {source_root}")
    if not train_ids or not validation_ids:
        raise ValueError("source dataset must contain train and validation indexes")

    category_summaries = {}
    selected_rules = (
        {args.only_category: CATEGORY_RULES[args.only_category]}
        if args.only_category
        else CATEGORY_RULES
    )
    for category, rule in selected_rules.items():
        print(f"[prepare] category={category} split=train", flush=True)
        category_root = args.output_root / category
        train_samples = collect_samples(
            source_root,
            train_ids,
            category=category,
            rule=rule,
            split="train",
            limit=int(rule["trainLimit"]),
        )
        print(f"[prepare] category={category} train_samples={len(train_samples)}", flush=True)
        print(f"[prepare] category={category} split=validation", flush=True)
        validation_samples = collect_samples(
            source_root,
            validation_ids,
            category=category,
            rule=rule,
            split="validation",
            limit=int(rule["validationLimit"]),
        )
        print(f"[prepare] category={category} validation_samples={len(validation_samples)}", flush=True)
        if category == "road":
            train_samples = extend_with_reference_baseline_road_samples(
                args.output_root,
                train_samples,
                split="train",
                limit=int(rule["trainLimit"]),
            )
            validation_samples = extend_with_reference_baseline_road_samples(
                args.output_root,
                validation_samples,
                split="validation",
                limit=int(rule["validationLimit"]),
            )
        if not train_samples:
            raise ValueError(f"no train samples were produced for category: {category}")
        if not validation_samples:
            raise ValueError(f"no validation samples were produced for category: {category}")

        write_samples(category_root, train_samples)
        write_samples(category_root, validation_samples)
        write_json(category_root / "train.json", {"sampleIds": [sample["sampleId"] for sample in train_samples]})
        write_json(
            category_root / "validation.json",
            {"sampleIds": [sample["sampleId"] for sample in validation_samples]},
        )
        category_summaries[category] = {
            "status": "completed",
            "patchSize": int(rule["patchSize"]),
            "focusChannels": list(rule["focusChannels"]),
            "trainSampleCount": len(train_samples),
            "validationSampleCount": len(validation_samples),
            "trainSourceCount": len({sample["sourceId"] for sample in train_samples}),
            "validationSourceCount": len({sample["sourceId"] for sample in validation_samples}),
            "selectionPolicy": {
                "minFocusRatio": rule["minFocusRatio"],
                "maxTreeRatio": rule["maxTreeRatio"],
                "maxWaterRatio": rule["maxWaterRatio"],
                "maxRoadRatio": rule["maxRoadRatio"],
                "maxRockRatio": rule["maxRockRatio"],
                "forbiddenLaterStageChannels": list(FORBIDDEN_LATER_STAGE_CHANNELS),
            },
        }
        print(f"[prepare] category={category} written", flush=True)

    summary = {
        "schemaVersion": "game-map-material-slot-repair-dataset-v1",
        "status": "completed",
        "stageId": "P7-V44-material-slot-repair-dataset",
        "sourceDatasetRoot": str(args.dataset_root.resolve()),
        "outputRoot": str(args.output_root.resolve()),
        "sourcePolicy": "same_source_target_png_and_masks_v1_only",
        "notProgramDrawing": True,
        "notWorldRuntimeFrame": True,
        "purpose": (
            "Repair game-map material slot models for grass, path, water, shoreline, tree and object materials. "
            "The dataset is cropped from trusted target.png + masks_v1 pairs and must not be shown on /world."
        ),
        "categories": category_summaries,
    }
    write_json(args.output_root / "dataset-summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def collect_samples(
    source_root: Path,
    source_ids: list[str],
    *,
    category: str,
    rule: dict[str, object],
    split: str,
    limit: int,
) -> list[dict[str, object]]:
    patch_size = int(rule["patchSize"])
    focus_channels = tuple(str(value) for value in rule["focusChannels"])
    scored: list[dict[str, object]] = []

    for source_id in source_ids:
        if category == "road" and not is_allowed_road_source(source_id):
            continue
        source = source_root / source_id
        if not source.exists():
            continue
        masks = read_masks(source)
        with Image.open(source / "target.png") as image:
            target = np.asarray(image.convert("RGB"), dtype=np.uint8)
        focus = combine_masks(masks, focus_channels)
        forbidden = combine_masks(masks, FORBIDDEN_LATER_STAGE_CHANNELS)
        tree = combine_masks(masks, ("tree_trunk", "tree_crown"))
        water = combine_masks(masks, ("water_body", "shoreline"))
        road = combine_masks(masks, ("road_center", "road_edge"))
        rock = masks["rock"]

        for x, y in candidate_origins(focus, patch_size):
            patch = target[y : y + patch_size, x : x + patch_size]
            if patch.shape[0] != patch_size or patch.shape[1] != patch_size:
                continue
            metrics = patch_metrics(
                patch,
                masks={
                    "focus": focus[y : y + patch_size, x : x + patch_size],
                    "forbidden": forbidden[y : y + patch_size, x : x + patch_size],
                    "tree": tree[y : y + patch_size, x : x + patch_size],
                    "water": water[y : y + patch_size, x : x + patch_size],
                    "waterBody": masks["water_body"][y : y + patch_size, x : x + patch_size],
                    "shoreline": masks["shoreline"][y : y + patch_size, x : x + patch_size],
                    "road": road[y : y + patch_size, x : x + patch_size],
                    "rock": rock[y : y + patch_size, x : x + patch_size],
                    "grass": masks["grass"][y : y + patch_size, x : x + patch_size],
                },
            )
            if not passes_category_rule(category, metrics, rule):
                continue
            scored.append(
                {
                    "sampleId": f"{category}-{split}-{len(scored):04d}-{source_id}-{x}-{y}",
                    "sourceId": source_id,
                    "source": source,
                    "category": category,
                    "split": split,
                    "x": x,
                    "y": y,
                    "size": patch_size,
                    "focusChannels": focus_channels,
                    "metrics": metrics,
                    "score": score_patch(category, metrics),
                    "styleVector": style_vector(patch),
                }
            )

    scored.sort(key=lambda item: (-float(item["score"]), str(item["sourceId"]), int(item["y"]), int(item["x"])))
    selected = select_diverse_sources(scored, limit)
    for index, sample in enumerate(selected):
        sample["sampleId"] = f"{category}-{split}-{index:04d}-{sample['sourceId']}-{sample['x']}-{sample['y']}"
    return selected


def extend_with_reference_baseline_road_samples(
    output_root: Path,
    samples: list[dict[str, object]],
    *,
    split: str,
    limit: int,
) -> list[dict[str, object]]:
    baseline_image = Path(
        r"F:\ai-pet-world\.runtime\ai-painter\natural-home-v91-current-mvp-quality-ready-generation\inference\natural-home-crop-v7-04-pond-grass-clean__v28-remix-road-tree\target.png"
    )
    if not baseline_image.exists():
        return samples

    source_id = "reference-visual-baseline-road-natural-home-v91"
    source_root = output_root / "_supplemental_sources" / source_id
    mask_root = source_root / "masks_v1"
    mask_root.mkdir(parents=True, exist_ok=True)
    with Image.open(baseline_image) as image:
        target = image.convert("RGB")
        target.save(source_root / "target.png")
        width, height = target.size
    for name in V1_CONDITION_CHANNELS:
        value = 255 if name in {"road_center", "walkable"} else 0
        Image.new("L", (width, height), value).save(mask_root / f"{name}.png")

    train_origins = [
        (126, 0),
        (120, 16),
        (112, 32),
        (106, 48),
        (100, 64),
        (94, 80),
        (88, 96),
        (82, 112),
        (76, 128),
        (70, 128),
        (128, 104),
        (144, 112),
        (160, 112),
        (176, 112),
    ]
    validation_origins = [(116, 8), (102, 56), (84, 104), (152, 112)]
    origins = train_origins if split == "train" else validation_origins

    with Image.open(source_root / "target.png") as image:
        target = np.asarray(image.convert("RGB"), dtype=np.uint8)

    supplemental = list(samples)
    for x, y in origins:
        if len(supplemental) >= limit:
            break
        patch = target[y : y + 64, x : x + 64]
        if patch.shape[0] != 64 or patch.shape[1] != 64:
            continue
        full_mask = np.full((64, 64), 255, dtype=np.uint8)
        empty_mask = np.zeros((64, 64), dtype=np.uint8)
        metrics = patch_metrics(
            patch,
            masks={
                "focus": full_mask,
                "forbidden": empty_mask,
                "tree": empty_mask,
                "water": empty_mask,
                "waterBody": empty_mask,
                "shoreline": empty_mask,
                "road": full_mask,
                "rock": empty_mask,
                "grass": empty_mask,
            },
        )
        supplemental.append(
            {
                "sampleId": (
                    f"road-{split}-{len(supplemental):04d}-{source_id}-{x}-{y}"
                ),
                "sourceId": source_id,
                "source": source_root,
                "category": "road",
                "split": split,
                "x": x,
                "y": y,
                "size": 64,
                "focusChannels": ("road_center", "road_edge"),
                "metrics": metrics,
                "score": score_patch("road", metrics),
                "styleVector": style_vector(patch),
                "sourcePolicy": "reference_visual_baseline_local_model_crop_v1",
            }
        )
    return supplemental[:limit]


def candidate_origins(focus: np.ndarray, patch_size: int) -> list[tuple[int, int]]:
    height, width = focus.shape
    stride = max(8, patch_size // 4)
    origins: list[tuple[int, int]] = []
    ys, xs = np.where(focus > 127)
    if len(xs):
        centers = [
            (int(np.mean(xs)), int(np.mean(ys))),
            (int(np.percentile(xs, 20)), int(np.percentile(ys, 20))),
            (int(np.percentile(xs, 80)), int(np.percentile(ys, 20))),
            (int(np.percentile(xs, 20)), int(np.percentile(ys, 80))),
            (int(np.percentile(xs, 80)), int(np.percentile(ys, 80))),
        ]
        for center_x, center_y in centers:
            origins.append(
                (
                    max(0, min(width - patch_size, center_x - patch_size // 2)),
                    max(0, min(height - patch_size, center_y - patch_size // 2)),
                )
            )
    for y in range(0, max(1, height - patch_size + 1), stride):
        for x in range(0, max(1, width - patch_size + 1), stride):
            origins.append((x, y))
    return list(dict.fromkeys(origins))


def passes_category_rule(category: str, metrics: dict[str, float], rule: dict[str, object]) -> bool:
    if metrics["forbiddenRatio"] > 0.0:
        return False
    if metrics["focusRatio"] < float(rule["minFocusRatio"]):
        return False
    if metrics["treeRatio"] > float(rule["maxTreeRatio"]):
        return False
    if metrics["waterRatio"] > float(rule["maxWaterRatio"]):
        return False
    if metrics["roadRatio"] > float(rule["maxRoadRatio"]):
        return False
    if metrics["rockRatio"] > float(rule["maxRockRatio"]):
        return False
    if category == "grass":
        if metrics["waterBodyRatio"] > 0.05:
            return False
        if metrics["treeRatio"] > 0.14:
            return False
        if metrics["rockRatio"] > 0.12:
            return False
        if metrics["bluePixelRatio"] > 0.06:
            return False
        if metrics["darkObjectPixelRatio"] > 0.24:
            return False
        if metrics["roadSoilPixelRatio"] > 0.12:
            return False
        if metrics["vegetationPixelRatio"] < metrics["roadSoilPixelRatio"] + 0.30:
            return False
        if metrics["rMean"] < 0.14:
            return False
        if metrics["gMean"] < 0.32 or metrics["gMean"] > 0.58:
            return False
        if metrics["greenDominance"] < 0.06 or metrics["greenDominance"] > 0.22:
            return False
        if metrics["soilIdentity"] > 0.32:
            return False
        if metrics["edgeDensity"] > 0.066:
            return False
        if metrics["lumaStd"] > 0.18:
            return False
        if metrics["greenDominance"] > 0.17 and metrics["edgeDensity"] > 0.075:
            return False
        if metrics["lumaStd"] < 0.035:
            return False
        if metrics["quantizedColorCount"] < 24:
            return False
    if category == "road":
        if metrics["soilIdentity"] < 0.045:
            return False
        if metrics["greenDominance"] > 0.025:
            return False
        if metrics["grassRatio"] > 0.045:
            return False
        if metrics["vegetationPixelRatio"] > 0.055:
            return False
        if metrics["roadSoilPixelRatio"] < 0.68:
            return False
        if metrics["gMean"] > metrics["rMean"] * 0.94:
            return False
        if metrics["lumaStd"] > 0.125:
            return False
        if metrics["edgeDensity"] < 0.018:
            return False
        if metrics["quantizedColorCount"] < 18:
            return False
    if category == "rock":
        if metrics["neutrality"] < 0.35:
            return False
    if category == "water":
        if metrics["waterBodyRatio"] < 0.28:
            return False
        if metrics["bMean"] < metrics["gMean"] * 0.62:
            return False
        if metrics["edgeDensity"] < 0.018:
            return False
    if category == "shoreline":
        if metrics["shorelineRatio"] < 0.10:
            return False
        if metrics["waterBodyRatio"] < 0.06 or metrics["grassRatio"] < 0.10:
            return False
        if metrics["edgeDensity"] < 0.018:
            return False
    if category in {"tree", "tree_object"}:
        if metrics["edgeDensity"] < 0.010:
            return False
    return True


def score_patch(category: str, metrics: dict[str, float]) -> float:
    score = metrics["focusRatio"] * 2.0 + metrics["edgeDensity"] + metrics["lumaStd"]
    if category == "grass":
        score += max(0.0, 0.16 - metrics["greenDominance"])
        score += metrics["paletteDensity"] * 0.0025
        score += metrics["edgeDensity"] * 2.0
        score -= metrics["waterRatio"] * 9.0
        score -= metrics["waterBodyRatio"] * 14.0
        score -= metrics["shorelineRatio"] * 8.0
        score -= metrics["roadRatio"] * 7.0
        score -= metrics["roadSoilPixelRatio"] * 6.0
        score -= metrics["bluePixelRatio"] * 10.0
        score -= metrics["darkObjectPixelRatio"] * 4.5
    if category == "road":
        score += metrics["soilIdentity"] * 2.0
        score += metrics["roadSoilPixelRatio"] * 1.2
        score += metrics["paletteDensity"] * 0.003
        score += metrics["lumaStd"] * 1.5
        score -= metrics["grassRatio"] * 5.0
        score -= metrics["vegetationPixelRatio"] * 8.0
        score -= max(0.0, metrics["gMean"] - metrics["rMean"] * 0.86) * 6.0
    if category == "rock":
        score += metrics["neutrality"]
    if category == "water":
        score += max(0.0, metrics["bMean"] - metrics["rMean"]) + metrics["edgeDensity"] * 2.0
    if category == "shoreline":
        score += metrics["edgeDensity"] * 2.0 + metrics["waterRatio"] * 0.35
    if category in {"tree", "tree_object"}:
        score += max(0.0, metrics["greenDominance"]) + metrics["edgeDensity"] * 2.0
    return round(float(score), 6)


def select_diverse_sources(samples: list[dict[str, object]], limit: int) -> list[dict[str, object]]:
    selected: list[dict[str, object]] = []
    per_source: dict[str, int] = {}
    pass_cap = 1
    while len(selected) < limit and pass_cap <= 8:
        for sample in samples:
            if sample in selected:
                continue
            source_id = str(sample["sourceId"])
            if per_source.get(source_id, 0) >= pass_cap:
                continue
            selected.append(sample)
            per_source[source_id] = per_source.get(source_id, 0) + 1
            if len(selected) >= limit:
                return selected
        pass_cap += 1
    return selected[:limit]


def write_samples(category_root: Path, samples: list[dict[str, object]]) -> None:
    for sample in samples:
        source = Path(sample["source"])
        x = int(sample["x"])
        y = int(sample["y"])
        size = int(sample["size"])
        destination = category_root / "samples" / str(sample["sampleId"])
        (destination / "masks").mkdir(parents=True, exist_ok=True)
        with Image.open(source / "target.png") as target:
            target.convert("RGB").crop((x, y, x + size, y + size)).save(destination / "target.png")
        for name in V1_CONDITION_CHANNELS:
            with Image.open(source / "masks_v1" / f"{name}.png") as mask:
                mask.convert("L").crop((x, y, x + size, y + size)).save(destination / "masks" / f"{name}.png")
        write_json(
            destination / "metadata.json",
            {
                "schemaVersion": "game-map-material-slot-repair-sample-v1",
                "sourceId": sample["sourceId"],
                "category": sample["category"],
                "split": sample["split"],
                "x": x,
                "y": y,
                "size": size,
                "focusChannels": list(sample["focusChannels"]),
                "metrics": sample["metrics"],
                "styleVector": sample["styleVector"],
                "sourcePolicy": sample.get("sourcePolicy", "same_source_target_png_and_masks_v1_crop"),
                "notProgramDrawing": True,
            },
        )


def patch_metrics(patch: np.ndarray, *, masks: dict[str, np.ndarray]) -> dict[str, float]:
    pixel_count = float(patch.shape[0] * patch.shape[1])
    rgb = patch.astype(np.float32) / 255.0
    r_mean = float(rgb[:, :, 0].mean())
    g_mean = float(rgb[:, :, 1].mean())
    b_mean = float(rgb[:, :, 2].mean())
    luma = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    horizontal = np.abs(luma[:, 1:] - luma[:, :-1])
    vertical = np.abs(luma[1:, :] - luma[:-1, :])
    edge_density = float((horizontal.mean() + vertical.mean()) * 0.5)
    neutrality = 1.0 - min(1.0, max(abs(r_mean - g_mean), abs(g_mean - b_mean), abs(r_mean - b_mean)) * 3.0)
    quantized = np.unique((patch >> 4).reshape(-1, 3), axis=0)
    quantized_color_count = int(quantized.shape[0])
    road_soil = (
        (rgb[:, :, 0] > rgb[:, :, 2] * 1.45)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.12)
        & (rgb[:, :, 0] >= rgb[:, :, 1] * 0.92)
        & (luma > 0.24)
        & (luma < 0.78)
    )
    vegetation = (
        (rgb[:, :, 1] > rgb[:, :, 0] * 1.04)
        & (rgb[:, :, 1] > rgb[:, :, 2] * 1.35)
        & (luma > 0.20)
    )
    blue_object = (
        (rgb[:, :, 2] > rgb[:, :, 1] * 0.92)
        & (rgb[:, :, 2] > rgb[:, :, 0] * 1.08)
        & (luma > 0.18)
        & (luma < 0.74)
    )
    dark_object = (
        (luma < 0.23)
        & (rgb[:, :, 1] < 0.36)
        & (np.maximum.reduce([rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]]) - np.minimum.reduce([rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]]) > 0.08)
    )
    return {
        "focusRatio": round(ratio(masks["focus"], pixel_count), 6),
        "forbiddenRatio": round(ratio(masks["forbidden"], pixel_count), 6),
        "treeRatio": round(ratio(masks["tree"], pixel_count), 6),
        "waterRatio": round(ratio(masks["water"], pixel_count), 6),
        "waterBodyRatio": round(ratio(masks["waterBody"], pixel_count), 6),
        "shorelineRatio": round(ratio(masks["shoreline"], pixel_count), 6),
        "roadRatio": round(ratio(masks["road"], pixel_count), 6),
        "rockRatio": round(ratio(masks["rock"], pixel_count), 6),
        "grassRatio": round(ratio(masks["grass"], pixel_count), 6),
        "edgeDensity": round(edge_density, 6),
        "lumaStd": round(float(luma.std()), 6),
        "rMean": round(r_mean, 6),
        "gMean": round(g_mean, 6),
        "bMean": round(b_mean, 6),
        "greenDominance": round(g_mean - max(r_mean, b_mean), 6),
        "soilIdentity": round(((r_mean + g_mean) * 0.5) - b_mean, 6),
        "neutrality": round(neutrality, 6),
        "quantizedColorCount": quantized_color_count,
        "paletteDensity": round(quantized_color_count / pixel_count * 10000.0, 6),
        "roadSoilPixelRatio": round(float(np.count_nonzero(road_soil)) / pixel_count, 6),
        "vegetationPixelRatio": round(float(np.count_nonzero(vegetation)) / pixel_count, 6),
        "bluePixelRatio": round(float(np.count_nonzero(blue_object)) / pixel_count, 6),
        "darkObjectPixelRatio": round(float(np.count_nonzero(dark_object)) / pixel_count, 6),
    }


def is_allowed_road_source(source_id: str) -> bool:
    lowered = source_id.lower()
    rejected_tokens = (
        "early_settlement",
        "meadow",
        "grass",
        "rocks",
        "stream",
        "quarry",
        "tree-line",
        "flower",
        "lower-orchard",
    )
    if any(token in lowered for token in rejected_tokens):
        return False
    allowed_tokens = (
        "north-orchard-path",
        "orchard-east-clean",
        "orchard-southeast",
        "southeast-orchard-tight",
    )
    return any(token in lowered for token in allowed_tokens)


def style_vector(patch: np.ndarray) -> list[float]:
    rgb = patch.astype(np.float32) / 255.0
    mean = rgb.reshape(-1, 3).mean(axis=0)
    std = rgb.reshape(-1, 3).std(axis=0)
    luma = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    edge = (np.abs(luma[:, 1:] - luma[:, :-1]).mean() + np.abs(luma[1:, :] - luma[:-1, :]).mean()) * 0.5
    contrast = float(np.mean(np.abs(rgb - mean.reshape(1, 1, 3))))
    values = [*mean.tolist(), *std.tolist(), float(edge), contrast]
    return [round(float(max(0.0, min(1.0, value))), 6) for value in values]


def ratio(mask: np.ndarray, pixel_count: float) -> float:
    return float(np.count_nonzero(mask > 127)) / pixel_count


def read_masks(source: Path) -> dict[str, np.ndarray]:
    return {
        name: np.asarray(Image.open(source / "masks_v1" / f"{name}.png").convert("L"), dtype=np.uint8)
        for name in V1_CONDITION_CHANNELS
    }


def combine_masks(masks: dict[str, np.ndarray], names: tuple[str, ...]) -> np.ndarray:
    values = [masks[name] for name in names]
    return np.maximum.reduce(values) if values else np.zeros_like(next(iter(masks.values())))


def read_index(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    values = payload.get("sampleIds", []) if isinstance(payload, dict) else []
    return [value for value in values if isinstance(value, str)]


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

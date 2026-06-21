from argparse import ArgumentParser
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageDraw

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS
from ai_painter.dataset.component_instances import connected_components, padded_square


MINIMUM_PIXELS = {
    "tree_trunk": 4,
    "shoreline": 6,
    "road_center": 12,
    "road_edge": 12,
}
SCENE_LEVEL_CHANNELS = {"grass", "depth", "walkable"}
REQUIRED_UNIQUE_SCENES = 20
REQUIRED_INSTANCES_BY_CHANNEL = {
    "grass": 20,
    "water_body": 12,
    "shoreline": 12,
    "road_center": 20,
    "road_edge": 40,
    "tree_trunk": 40,
    "tree_crown": 40,
    "rock": 40,
    "shelter_foundation": 20,
    "shelter_wall": 20,
    "shelter_roof": 12,
    "construction_material": 40,
    "walkable": 20,
    "depth": 20,
}


def main() -> int:
    parser = ArgumentParser(description="Extract same-source component instances and audit autonomous-training readiness.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    if args.output_root.exists():
        shutil.rmtree(args.output_root)
    source_root = args.dataset_root / "accepted" / "dataset_v0" / "scene" / "world"
    sample_dirs = sorted(path for path in source_root.iterdir() if path.is_dir())
    report = {"schemaVersion": "ai-painter-component-readiness-v1", "sourceSceneCount": len(sample_dirs), "requiredUniqueScenes": REQUIRED_UNIQUE_SCENES, "channels": {}}
    previews: list[tuple[str, Image.Image]] = []

    for channel in V1_CONDITION_CHANNELS:
        channel_root = args.output_root / "channels" / channel
        instances = []
        non_empty_scenes = 0
        component_sizes = []
        preview_added = False
        for source in sample_dirs:
            with Image.open(source / "target.png") as image:
                target = image.convert("RGB")
            with Image.open(source / "masks_v1" / f"{channel}.png") as image:
                mask = np.asarray(image.convert("L"), dtype=np.uint8)
            components = connected_components(mask, minimum_pixels=MINIMUM_PIXELS.get(channel, 8))
            if components:
                non_empty_scenes += 1
            if channel in SCENE_LEVEL_CHANNELS and components:
                components = components[:1]
            for number, component in enumerate(components):
                x, y, size = padded_square(component, target.width, target.height)
                sample_id = f"{source.name}-{number:03d}"
                destination = channel_root / sample_id
                destination.mkdir(parents=True, exist_ok=True)
                target.crop((x, y, x + size, y + size)).resize((64, 64), Image.Resampling.NEAREST).save(destination / "target.png")
                Image.fromarray(component.mask).crop((x, y, x + size, y + size)).resize((64, 64), Image.Resampling.NEAREST).save(destination / "mask.png")
                metadata = {"sampleId": sample_id, "sourceId": source.name, "channel": channel, "sourceBox": [component.x0, component.y0, component.x1, component.y1], "crop": [x, y, size], "componentPixels": component.pixels}
                (destination / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                instances.append(metadata)
                component_sizes.append(component.pixels)
                if not preview_added:
                    preview = target.copy()
                    overlay = Image.new("RGBA", preview.size, (0, 0, 0, 0))
                    overlay_pixels = np.zeros((preview.height, preview.width, 4), dtype=np.uint8)
                    overlay_pixels[component.mask > 0] = (255, 224, 72, 145)
                    overlay = Image.fromarray(overlay_pixels)
                    preview = Image.alpha_composite(preview.convert("RGBA"), overlay)
                    previews.append((channel, preview.convert("RGB")))
                    preview_added = True
        unique_sources = len({item["sourceId"] for item in instances})
        required_instances = REQUIRED_INSTANCES_BY_CHANNEL[channel]
        required_unique_scenes = min(REQUIRED_UNIQUE_SCENES, required_instances)
        ready = unique_sources >= required_unique_scenes and len(instances) >= required_instances
        report["channels"][channel] = {
            "status": "ready" if ready else "blocked",
            "nonEmptyScenes": non_empty_scenes,
            "uniqueSourceScenes": unique_sources,
            "requiredUniqueScenes": required_unique_scenes,
            "instanceCount": len(instances),
            "requiredInstances": required_instances,
            "averageComponentPixels": round(sum(component_sizes) / len(component_sizes), 2) if component_sizes else 0,
            "blockers": ([] if ready else [f"unique scenes {unique_sources}/{required_unique_scenes}", f"instances {len(instances)}/{required_instances}"]),
        }
    report["readyChannelCount"] = sum(value["status"] == "ready" for value in report["channels"].values())
    report["blockedChannelCount"] = len(V1_CONDITION_CHANNELS) - report["readyChannelCount"]
    report["canStartAutonomousTraining"] = report["blockedChannelCount"] == 0
    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_contact_sheet(previews, args.output_root / "component-preview.png")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def build_contact_sheet(previews: list[tuple[str, Image.Image]], output: Path) -> None:
    cell_width, cell_height = 256, 220
    sheet = Image.new("RGB", (cell_width * 2, cell_height * 7), (7, 21, 16))
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(previews[:14]):
        x = (index % 2) * cell_width
        y = (index // 2) * cell_height
        sheet.paste(image.resize((256, 192), Image.Resampling.NEAREST), (x, y + 24))
        draw.text((x + 8, y + 6), name, fill=(216, 255, 228))
    sheet.save(output)


if __name__ == "__main__":
    raise SystemExit(main())

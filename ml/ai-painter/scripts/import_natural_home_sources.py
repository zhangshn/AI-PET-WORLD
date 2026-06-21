from __future__ import annotations

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
from typing import Any

from PIL import Image


SAFE_ID = re.compile(r"[^a-z0-9_-]+")
REQUIRED_SIZE = (256, 192)


def main() -> int:
    parser = ArgumentParser(description="Import no-building natural home source PNG files for AI Painter stage 1.")
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--output-root", type=Path, default=Path("data/ai-painter-datasets/natural-home/source-originals"))
    parser.add_argument("--creator", default="project-owner")
    parser.add_argument("--rights", default="project-owned; allowed for local commercial training and use")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    source_dir = args.source_dir.resolve()
    output_root = args.output_root.resolve()
    if not source_dir.is_dir():
        raise FileNotFoundError(f"source directory does not exist: {source_dir}")

    output_root.mkdir(parents=True, exist_ok=True)
    imported: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, image_path in enumerate(sorted(source_dir.glob("*.png")), 1):
        sample_id = build_sample_id(image_path.stem, index)
        if sample_id in seen_ids:
            sample_id = f"{sample_id}-{index:03d}"
        seen_ids.add(sample_id)

        destination = output_root / f"{sample_id}.png"
        metadata_path = output_root / f"{sample_id}.source.json"
        try:
            image_info = inspect_png(image_path)
            if image_info["size"] != list(REQUIRED_SIZE):
                rejected.append({
                    "file": str(image_path),
                    "reason": f"size_must_be_{REQUIRED_SIZE[0]}x{REQUIRED_SIZE[1]}",
                    "actualSize": image_info["size"],
                })
                continue
            if destination.exists() and not args.overwrite:
                rejected.append({"file": str(image_path), "reason": "sample_already_exists", "sampleId": sample_id})
                continue
            shutil.copy2(image_path, destination)
            metadata = {
                "schemaVersion": "natural-home-source-v1",
                "sampleId": sample_id,
                "stageId": "natural-home-v1-no-building",
                "sourceFile": str(image_path),
                "targetFile": str(destination),
                "sha256": digest(destination),
                "width": REQUIRED_SIZE[0],
                "height": REQUIRED_SIZE[1],
                "mode": image_info["mode"],
                "creator": args.creator,
                "rights": args.rights,
                "declaredNoForbiddenContent": True,
                "allowedContent": ["grass", "tree", "rock", "flower", "bush", "water", "shoreline", "natural_path"],
                "forbiddenContent": ["building", "shelter", "construction_material", "character", "animal", "insect", "butler"],
                "admission": "source_only_until_blueprint_and_masks_exist",
                "trainable": False,
            }
            write_json(metadata_path, metadata)
            imported.append({"sampleId": sample_id, "file": str(destination), "sha256": metadata["sha256"]})
        except Exception as error:
            rejected.append({"file": str(image_path), "reason": str(error)})

    manifest = {
        "schemaVersion": "natural-home-source-import-manifest-v1",
        "stageId": "natural-home-v1-no-building",
        "sourceDir": str(source_dir),
        "outputRoot": str(output_root),
        "importedCount": len(imported),
        "rejectedCount": len(rejected),
        "imported": imported,
        "rejected": rejected,
    }
    write_json(output_root / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0 if imported else 1


def build_sample_id(stem: str, index: int) -> str:
    normalized = SAFE_ID.sub("-", stem.lower()).strip("-")
    if not normalized:
        normalized = f"sample-{index:03d}"
    if not normalized.startswith("natural-home-"):
        normalized = f"natural-home-{normalized}"
    return normalized[:80]


def inspect_png(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        return {"size": list(image.size), "mode": image.mode}


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

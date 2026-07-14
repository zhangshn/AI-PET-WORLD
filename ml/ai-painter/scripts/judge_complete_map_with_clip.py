from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


ROOT = Path(__file__).resolve().parents[3]
MODEL_ROLE = "machine_visual_semantic_gate"
RUBRIC = [
    {
        "id": "complete_game_map_identity",
        "positive": "a professional top-down 2D role-playing game environment map",
        "negative": "an abstract material texture test image",
        "minimumPositiveProbability": 0.55,
    },
    {
        "id": "natural_object_semantics",
        "positive": "organic trees bushes and irregular grounded natural rocks",
        "negative": "square buildings houses roofs and architectural blocks",
        "minimumPositiveProbability": 0.55,
    },
    {
        "id": "flat_path_semantics",
        "positive": "a flat embedded dirt footpath crossing natural grass",
        "negative": "a raised wall fence barrier embankment or seawall",
        "minimumPositiveProbability": 0.55,
    },
    {
        "id": "playable_map_readability",
        "positive": "a readable traversable playable game map with coherent spatial layout",
        "negative": "a loose concept illustration without readable gameplay space",
        "minimumPositiveProbability": 0.55,
    },
    {
        "id": "professional_render_coherence",
        "positive": "crisp coherent polished professional 2D game environment art",
        "negative": "a blurry noisy distorted image with visible generation artifacts",
        "minimumPositiveProbability": 0.55,
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--source-manifest", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    image_path = Path(args.image).resolve()
    source_manifest_path = Path(args.source_manifest).resolve()
    output_path = Path(args.output).resolve()
    assert_inside_root(image_path)
    assert_inside_root(source_manifest_path)
    assert_inside_root(output_path)

    source_manifest = read_json(source_manifest_path)
    model_record = next((row for row in source_manifest["models"] if row["role"] == MODEL_ROLE), None)
    if model_record is None:
        raise ValueError(f"local model role is missing: {MODEL_ROLE}")
    model_path = (ROOT / model_record["localPath"]).resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"local CLIP model is missing: {model_path}")

    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    model = CLIPModel.from_pretrained(model_path, local_files_only=True).eval()
    processor = CLIPProcessor.from_pretrained(model_path, local_files_only=True)
    image = Image.open(image_path).convert("RGB")

    criteria = []
    with torch.inference_mode():
        for item in RUBRIC:
            labels = [item["positive"], item["negative"]]
            inputs = processor(text=labels, images=image, return_tensors="pt", padding=True)
            probabilities = model(**inputs).logits_per_image.softmax(dim=1)[0].cpu().tolist()
            positive_probability = float(probabilities[0])
            criterion = {
                **item,
                "positiveProbability": round(positive_probability, 6),
                "negativeProbability": round(float(probabilities[1]), 6),
                "passed": positive_probability >= item["minimumPositiveProbability"],
            }
            criteria.append(criterion)

    failed = [item for item in criteria if not item["passed"]]
    average_positive = sum(item["positiveProbability"] for item in criteria) / len(criteria)
    report = {
        "schemaVersion": "complete-map-local-clip-semantic-review-v1",
        "status": "passed" if not failed else "failed",
        "passed": not failed,
        "reviewPurpose": "machine semantic and professional prior gate; never owner final approval",
        "imagePath": project_path(image_path),
        "imageSha256": sha256_file(image_path),
        "model": {
            "role": model_record["role"],
            "repoId": model_record["repoId"],
            "revision": model_record["revision"],
            "license": model_record["license"],
            "localPath": model_record["localPath"],
            "sourceManifestPath": project_path(source_manifest_path),
            "sourceManifestSha256": sha256_file(source_manifest_path),
            "localFilesOnly": True,
            "onlineInferenceApiUsed": False,
            "device": "cpu",
        },
        "rubric": criteria,
        "averagePositiveProbability": round(average_positive, 6),
        "failedCriterionIds": [item["id"] for item in failed],
        "canEnterWorld": False,
        "canCountAsPositiveSample": False,
        "ownerFinalReviewRequired": True,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "averagePositiveProbability": report["averagePositiveProbability"],
        "failedCriterionIds": report["failedCriterionIds"],
        "output": project_path(output_path),
    }, ensure_ascii=False, indent=2))
    return 0


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def assert_inside_root(path: Path) -> None:
    path.relative_to(ROOT)


def project_path(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


if __name__ == "__main__":
    raise SystemExit(main())

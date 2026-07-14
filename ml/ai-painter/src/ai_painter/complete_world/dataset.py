from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.training.torch_runtime import require_torch


class IndependentCompleteWorldDataset:
    def __init__(self, package_manifest: Path, split: str, channel_order: list[str], image_size: tuple[int, int]):
        torch = require_torch()
        self._torch = torch
        self.root = Path.cwd()
        manifest = read_json(package_manifest)
        if manifest.get("schemaVersion") != "complete-map-dataset-package-v1":
            raise ValueError("complete-map dataset package schema is invalid")
        if manifest.get("canStartFormalTraining") is not True:
            raise ValueError("complete-map dataset package is not approved for formal training")
        source_index = read_json(self.root / manifest["sourceIndexPath"])
        self.rows = [
            row for row in source_index.get("samples", [])
            if row.get("split") == split
            and row.get("classification") == "completeMapPositive"
            and row.get("trainingUsage") == "positive"
            and row.get("independentTrainingEligible") is True
            and row.get("trainingDataProvenance") == "independent-training-eligible"
        ]
        if not self.rows:
            raise ValueError(f"no independent complete-map positive samples in split={split}")
        self.channel_order = channel_order
        self.image_size = image_size

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        condition_pack = read_json(self.root / row["conditionPackPath"])
        channels = {channel["id"]: channel for channel in condition_pack["channels"]}
        missing = [channel_id for channel_id in self.channel_order if channel_id not in channels]
        if missing:
            raise ValueError(f"sample condition pack is missing channels: {missing}")
        image = read_image(self.root / row["imagePath"], "RGB", self.image_size, Image.Resampling.LANCZOS)
        condition_tensors = []
        for channel_id in self.channel_order:
            channel = channels[channel_id]
            continuous = channel.get("kind") in {"distance", "coordinate", "continuous"} or channel_id.startswith("signed_distance_") or channel_id in {"coordinate_x", "coordinate_y", "moisture_proximity"}
            resampling = Image.Resampling.BILINEAR if continuous else Image.Resampling.NEAREST
            condition_tensors.append(read_image(self.root / channel["path"], "L", self.image_size, resampling))
        return {
            "sampleId": row["sampleId"],
            "image": self._torch.from_numpy(image).permute(2, 0, 1).float().div(255.0),
            "conditions": self._torch.stack([
                self._torch.from_numpy(value).float().div(255.0) for value in condition_tensors
            ], dim=0),
        }


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_image(path: Path, mode: str, size: tuple[int, int], resampling):
    with Image.open(path) as image:
        value = image.convert(mode).resize(size, resample=resampling)
        return np.asarray(value, dtype=np.uint8).copy()

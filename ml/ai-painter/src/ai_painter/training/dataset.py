from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V0_MASK_CHANNELS, V1_CONDITION_CHANNELS

from .torch_runtime import require_torch

MASK_NAMES = V0_MASK_CHANNELS


class WorldSceneDataset:
    def __init__(self, dataset_root: Path, split: str = "train", *, blueprint_version: str = "v0", allow_manual_review: bool = False) -> None:
        self.dataset_root = dataset_root.resolve()
        self.sample_ids = load_split(self.dataset_root, split)
        self.blueprint_version = blueprint_version
        self.allow_manual_review = allow_manual_review
        if blueprint_version not in {"v0", "v1"}:
            raise ValueError("blueprint_version must be v0 or v1")
        if not self.sample_ids:
            raise ValueError(f"dataset split is empty: {split}")

    def __len__(self) -> int:
        return len(self.sample_ids)

    def __getitem__(self, index: int) -> dict[str, Any]:
        torch = require_torch()
        sample_id = self.sample_ids[index]
        directory = self.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
        target = image_tensor(directory / "target.png", "RGB", torch, expected_channels=3)
        if self.blueprint_version == "v1":
            self._ensure_v1_trainable(directory)
            mask_dir = directory / "masks_v1"
            channels = V1_CONDITION_CHANNELS
        else:
            mask_dir = directory / "masks"
            channels = V0_MASK_CHANNELS
        condition = torch.cat([
            image_tensor(mask_dir / f"{name}.png", "L", torch, expected_channels=1)
            for name in channels
        ], dim=0)
        return {"sampleId": sample_id, "condition": condition, "target": target}

    def _ensure_v1_trainable(self, directory: Path) -> None:
        path = directory / "blueprint.v1.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schemaVersion") != "world-blueprint-v1":
            raise ValueError(f"invalid v1 blueprint: {path}")
        if data.get("requiresManualReview") and not self.allow_manual_review:
            raise ValueError(f"v1 blueprint still requires manual review: {directory.name}")


def load_split(dataset_root: Path, split: str) -> list[str]:
    if split not in {"train", "validation"}:
        raise ValueError("split must be train or validation")
    path = dataset_root / "indexes" / f"{split}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    values = data.get("sampleIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise ValueError(f"invalid dataset index: {path}")
    return values


def image_tensor(path: Path, mode: str, torch, *, expected_channels: int | None = None):
    with Image.open(path) as image:
        normalized = image.convert(mode)
        if normalized.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
            raise ValueError(f"image must be 256x192: {path}")
        pixels = np.array(normalized, dtype=np.uint8, copy=True)
        if pixels.ndim == 2:
            pixels = pixels[:, :, None]
        if expected_channels is not None and pixels.shape[2] != expected_channels:
            raise ValueError(f"unexpected channel count for {path}")
        tensor = torch.from_numpy(pixels)
        return tensor.permute(2, 0, 1).float().div(255.0)

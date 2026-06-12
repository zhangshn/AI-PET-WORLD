from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .torch_runtime import require_torch

MASK_NAMES = ("grass", "water", "road", "tree", "rock", "shelter", "walkable", "depth")


class WorldSceneDataset:
    def __init__(self, dataset_root: Path, split: str = "train") -> None:
        self.dataset_root = dataset_root.resolve()
        self.sample_ids = load_split(self.dataset_root, split)
        if not self.sample_ids:
            raise ValueError(f"dataset split is empty: {split}")

    def __len__(self) -> int:
        return len(self.sample_ids)

    def __getitem__(self, index: int) -> dict[str, Any]:
        torch = require_torch()
        sample_id = self.sample_ids[index]
        directory = self.dataset_root / "accepted" / "dataset_v0" / "scene" / "world" / sample_id
        target = image_tensor(directory / "target.png", "RGB", torch)
        condition = torch.cat([
            image_tensor(directory / "masks" / f"{name}.png", "L", torch)
            for name in MASK_NAMES
        ], dim=0)
        return {"sampleId": sample_id, "condition": condition, "target": target}


def load_split(dataset_root: Path, split: str) -> list[str]:
    if split not in {"train", "validation"}:
        raise ValueError("split must be train or validation")
    path = dataset_root / "indexes" / f"{split}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    values = data.get("sampleIds")
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise ValueError(f"invalid dataset index: {path}")
    return values


def image_tensor(path: Path, mode: str, torch):
    with Image.open(path) as image:
        normalized = image.convert(mode)
        pixels = np.array(normalized, dtype=np.uint8, copy=True)
        if pixels.ndim == 2:
            pixels = pixels[:, :, None]
        tensor = torch.from_numpy(pixels)
        return tensor.permute(2, 0, 1).float().div(255.0)

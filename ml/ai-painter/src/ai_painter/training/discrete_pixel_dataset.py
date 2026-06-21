from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS

from .local_patch_dataset import read_image
from .torch_runtime import require_torch


class DiscretePixelDataset:
    def __init__(self, root: Path, split: str) -> None:
        self.root = root.resolve()
        self.palette = np.asarray(json.loads((self.root / "palette.json").read_text(encoding="utf-8"))["colors"], dtype=np.int16)
        sample_ids = json.loads((self.root / f"{split}.json").read_text(encoding="utf-8"))["sampleIds"]
        self.samples = [self.root / "samples" / sample_id for sample_id in sample_ids]
        self.augment = split == "train"
        if not self.samples:
            raise ValueError(f"discrete pixel split is empty: {split}")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        torch = require_torch()
        directory = self.samples[index]
        condition = torch.cat([read_image(directory / "masks" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0)
        with Image.open(directory / "target.png") as image:
            pixels = np.asarray(image.convert("RGB"), dtype=np.int16)
        difference = pixels[:, :, None, :].astype(np.int32) - self.palette[None, None, :, :].astype(np.int32)
        distances = (difference ** 2).sum(axis=3)
        target = torch.from_numpy(np.argmin(distances, axis=2).astype(np.int64))
        if self.augment and bool(torch.rand(()) < 0.5):
            condition = torch.flip(condition, dims=(2,))
            target = torch.flip(target, dims=(1,))
        return {"condition": condition, "target": target, "sampleId": directory.name}

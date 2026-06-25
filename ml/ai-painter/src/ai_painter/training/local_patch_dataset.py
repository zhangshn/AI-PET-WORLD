from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import V1_CONDITION_CHANNELS

from .torch_runtime import require_torch


class LocalPatchDataset:
    def __init__(self, root: Path, split: str, config: dict[str, object] | None = None) -> None:
        self.root = root.resolve()
        self.config = config or {}
        self.split = split
        index = json.loads((self.root / f"{split}.json").read_text(encoding="utf-8"))
        self.samples = [self.root / "samples" / value for value in index["sampleIds"]]
        if not self.samples:
            raise ValueError(f"local patch split is empty: {split}")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        torch = require_torch()
        directory = self.samples[index]
        condition = build_patch_condition(directory, torch, self.config)
        target = read_image(directory / "target.png", "RGB", torch)
        use_augmentation = self.split == "train" and bool(self.config.get("augment", True))
        if use_augmentation and bool(torch.rand(()) < 0.5):
            condition = torch.flip(condition, dims=(2,))
            target = torch.flip(target, dims=(2,))
        return {"condition": condition, "target": target, "sampleId": directory.name}


def build_patch_condition(directory: Path, torch, config: dict[str, object] | None = None):
    config = config or {}
    condition = torch.cat([read_image(directory / "masks" / f"{name}.png", "L", torch) for name in V1_CONDITION_CHANNELS], dim=0)
    extras = config.get("inputExtras", [])
    if not isinstance(extras, list):
        extras = []
    extra_channels = []
    if "coord" in extras:
        extra_channels.extend(coordinate_channels(condition.shape[1], condition.shape[2], torch))
    if "noise" in extras:
        extra_channels.append(noise_channel(directory.name, condition.shape[1], condition.shape[2], torch))
    if "category" in extras:
        extra_channels.extend(category_channels(directory, condition.shape[1], condition.shape[2], torch))
    if "source" in extras:
        extra_channels.extend(source_channels(directory, condition.shape[1], condition.shape[2], torch))
    if "style" in extras:
        extra_channels.extend(style_channels(directory, condition.shape[1], condition.shape[2], torch))
    if extra_channels:
        condition = torch.cat([condition, *extra_channels], dim=0)
    return condition


def coordinate_channels(height: int, width: int, torch):
    y = torch.linspace(-1.0, 1.0, height).view(1, height, 1).expand(1, height, width)
    x = torch.linspace(-1.0, 1.0, width).view(1, 1, width).expand(1, height, width)
    return [x.float(), y.float()]


def noise_channel(sample_id: str, height: int, width: int, torch):
    digest = hashlib.sha256(sample_id.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "little", signed=False)
    rng = np.random.default_rng(seed)
    pixels = rng.random((1, height, width), dtype=np.float32)
    return torch.from_numpy(pixels)


def category_channels(directory: Path, height: int, width: int, torch):
    categories = ("grass", "water", "shoreline", "road", "tree", "rock")
    metadata_path = directory / "metadata.json"
    category = ""
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        value = metadata.get("category")
        if isinstance(value, str):
            category = normalize_category(value)
    channels = []
    for name in categories:
        fill = 1.0 if name == category else 0.0
        channels.append(torch.full((1, height, width), fill, dtype=torch.float32))
    return channels


def normalize_category(value: str) -> str:
    aliases = {
        "grass_ground": "grass",
        "open_ground": "grass",
        "road_path": "road",
        "water_shoreline": "shoreline",
        "tree_bush": "tree",
        "rock_terrain": "rock",
    }
    return aliases.get(value, value)


def source_channels(directory: Path, height: int, width: int, torch):
    metadata_path = directory / "metadata.json"
    source_id = directory.name
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        value = metadata.get("sourceId")
        if isinstance(value, str) and value:
            source_id = value
    digest = hashlib.sha256(source_id.encode("utf-8")).digest()
    values = [byte / 255.0 for byte in digest[:4]]
    return [torch.full((1, height, width), value, dtype=torch.float32) for value in values]


def style_channels(directory: Path, height: int, width: int, torch):
    metadata_path = directory / "metadata.json"
    values = [0.0] * 8
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        raw_values = metadata.get("styleVector")
        if isinstance(raw_values, list):
            for index, value in enumerate(raw_values[:8]):
                if isinstance(value, (int, float)):
                    values[index] = max(0.0, min(1.0, float(value)))
    return [torch.full((1, height, width), value, dtype=torch.float32) for value in values]


def read_image(path: Path, mode: str, torch):
    with Image.open(path) as image:
        pixels = np.array(image.convert(mode), dtype=np.uint8, copy=True)
    if pixels.ndim == 2:
        pixels = pixels[:, :, None]
    return torch.from_numpy(pixels).permute(2, 0, 1).float().div(255.0)

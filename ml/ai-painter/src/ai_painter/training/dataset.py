from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from ai_painter.blueprint.channels import CANVAS_HEIGHT, CANVAS_WIDTH, V0_MASK_CHANNELS, V1_CONDITION_CHANNELS
from ai_painter.dataset.v1_review import validate_v1_review_record

from .torch_runtime import require_torch

MASK_NAMES = V0_MASK_CHANNELS


class WorldSceneDataset:
    def __init__(
        self,
        dataset_root: Path,
        split: str = "train",
        *,
        blueprint_version: str = "v0",
        allow_manual_review: bool = False,
        augment: bool = False,
        condition_extra_channels: list[str] | None = None,
    ) -> None:
        self.dataset_root = dataset_root.resolve()
        self.sample_ids = load_split(self.dataset_root, split)
        self.blueprint_version = blueprint_version
        self.allow_manual_review = allow_manual_review
        self.augment = augment and split == "train"
        self.condition_extra_channels = condition_extra_channels or []
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
        condition = append_condition_extra_channels(condition, torch, sample_id, self.condition_extra_channels)
        if self.augment and bool(torch.rand(()) < 0.5):
            condition = torch.flip(condition, dims=(2,))
            target = torch.flip(target, dims=(2,))
        return {"sampleId": sample_id, "condition": condition, "target": target}

    def _ensure_v1_trainable(self, directory: Path) -> None:
        path = directory / "blueprint.v1.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schemaVersion") != "world-blueprint-v1":
            raise ValueError(f"invalid v1 blueprint: {path}")
        if self.allow_manual_review:
            return
        if data.get("requiresManualReview"):
            raise ValueError(f"v1 blueprint still requires manual review: {directory.name}")
        review_errors = validate_v1_review_record(directory)
        if review_errors:
            raise ValueError("; ".join(review_errors))


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


def append_condition_extra_channels(condition, torch, sample_id: str, channel_names: list[str]):
    if not channel_names:
        return condition

    extras = [build_condition_extra_channel(condition, torch, sample_id, name) for name in channel_names]
    return torch.cat([condition, *extras], dim=0)


def build_condition_extra_channel(condition, torch, sample_id: str, name: str):
    height = condition.shape[1]
    width = condition.shape[2]
    normalized_name = str(name)
    if normalized_name == "coord_x":
        return torch.linspace(0.0, 1.0, width, dtype=condition.dtype).view(1, 1, width).repeat(1, height, 1)
    if normalized_name == "coord_y":
        return torch.linspace(0.0, 1.0, height, dtype=condition.dtype).view(1, height, 1).repeat(1, 1, width)
    if normalized_name.startswith("noise_"):
        return deterministic_noise_channel(condition, torch, sample_id, normalized_name)
    raise ValueError(f"unknown condition extra channel: {name}")


def deterministic_noise_channel(condition, torch, sample_id: str, name: str):
    import hashlib

    height = condition.shape[1]
    width = condition.shape[2]
    scale_by_name = {
        "noise_fine": 1,
        "noise_medium": 4,
        "noise_coarse": 12,
    }
    scale = scale_by_name.get(name)
    if scale is None:
        raise ValueError(f"unknown noise extra channel: {name}")

    digest = hashlib.sha256(f"{sample_id}:{name}".encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "little") % (2**31)
    generator = torch.Generator()
    generator.manual_seed(seed)
    noise_height = max(1, (height + scale - 1) // scale)
    noise_width = max(1, (width + scale - 1) // scale)
    noise = torch.rand((1, noise_height, noise_width), generator=generator, dtype=condition.dtype)
    if scale == 1:
        return noise[:, :height, :width]
    upsampled = torch.nn.functional.interpolate(
        noise.unsqueeze(0),
        size=(height, width),
        mode="bilinear",
        align_corners=False,
    )[0]
    return upsampled

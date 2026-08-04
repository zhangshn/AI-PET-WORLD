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


class AiAssistedColdStartRgbDataset:
    def __init__(self, package_manifest: Path, split: str, image_size: tuple[int, int]):
        torch = require_torch()
        self._torch = torch
        self.root = Path.cwd()
        manifest = read_json(package_manifest)
        if manifest.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1":
            raise ValueError("AI-assisted cold-start dataset package schema is invalid")
        if manifest.get("trainingLane") != "ai_assisted_cold_start":
            raise ValueError("AI-assisted cold-start training lane is invalid")
        if manifest.get("canStartAutoencoderWarmup") is not True:
            raise ValueError("AI-assisted cold-start package is not ready for autoencoder warmup")
        if manifest.get("canStartFormalTraining") is not False or manifest.get("formalInferenceEligible") is not False:
            raise ValueError("AI-assisted warmup package must not claim formal training readiness")
        source_index = read_json(self.root / manifest["sourceIndexPath"])
        self.rows = [
            row for row in source_index.get("samples", [])
            if row.get("split") == split
            and row.get("categoryId") == "complete-maps"
            and "rgb_autoencoder_warmup" in row.get("trainingRoles", [])
            and row.get("aiAssistedColdStartEligible") is True
            and row.get("independentTrainingEligible") is False
            and row.get("ownerReviewStatus") == "owner_approved"
            and row.get("machineReviewStatus") == "passed"
        ]
        if not self.rows:
            raise ValueError(f"no AI-assisted complete-map RGB samples in split={split}")
        self.image_size = image_size

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        image = read_image(self.root / row["imagePath"], "RGB", self.image_size, Image.Resampling.LANCZOS)
        return {
            "sampleId": row["sampleId"],
            "image": self._torch.from_numpy(image).permute(2, 0, 1).float().div(255.0),
        }


class AiAssistedConditionalDenoiserDataset:
    def __init__(
        self,
        package_manifest: Path,
        split: str,
        channel_order: list[str],
        image_size: tuple[int, int],
        require_v7_capacity_contribution: bool = False,
    ):
        torch = require_torch()
        self._torch = torch
        self.root = Path.cwd()
        manifest = read_json(package_manifest)
        if manifest.get("schemaVersion") != "ai-assisted-cold-start-dataset-package-v1":
            raise ValueError("AI-assisted conditional dataset package schema is invalid")
        if manifest.get("trainingLane") != "ai_assisted_cold_start":
            raise ValueError("AI-assisted conditional training lane is invalid")
        if manifest.get("canTrainConditionalDenoiser") is not True:
            raise ValueError("AI-assisted package is not ready for conditional denoiser training")
        if manifest.get("currentConditionUnpairedCount") != 0:
            raise ValueError("AI-assisted package contains unpaired condition records")
        if manifest.get("formalInferenceEligible") is not False:
            raise ValueError("AI-assisted conditional package must not claim formal inference readiness")
        source_index = read_json(self.root / manifest["sourceIndexPath"])
        self.rows = [
            row for row in source_index.get("samples", [])
            if is_ai_assisted_conditional_row(
                row,
                split,
                require_v7_capacity_contribution=require_v7_capacity_contribution,
            )
        ]
        if not self.rows:
            raise ValueError(f"no AI-assisted conditional complete-map samples in split={split}")
        self.channel_order = channel_order
        self.image_size = image_size
        self.require_v7_capacity_contribution = require_v7_capacity_contribution

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        condition_pack = read_json(self.root / row["conditionPackPath"])
        channels = {channel["id"]: channel for channel in condition_pack["channels"]}
        missing = [channel_id for channel_id in self.channel_order if channel_id not in channels]
        if missing:
            raise ValueError(f"conditional sample is missing channels: {missing}")
        if len(channels) != len(self.channel_order):
            raise ValueError("conditional sample channel count does not match the locked channel order")
        image = read_image(self.root / row["imagePath"], "RGB", self.image_size, Image.Resampling.LANCZOS)
        condition_tensors = []
        for channel_id in self.channel_order:
            channel = channels[channel_id]
            continuous = channel.get("kind") in {"distance", "coordinate", "continuous"} or channel_id.startswith("signed_distance_") or channel_id in {"coordinate_x", "coordinate_y", "moisture_proximity"}
            resampling = Image.Resampling.BILINEAR if continuous else Image.Resampling.NEAREST
            condition_tensors.append(read_image(self.root / channel["path"], "L", self.image_size, resampling))
        return {
            "sampleId": row["sampleId"],
            "conditionLabel": row["conditionLabel"],
            "conditionPackPath": row["conditionPackPath"],
            "image": self._torch.from_numpy(image).permute(2, 0, 1).float().div(255.0),
            "conditions": self._torch.stack([
                self._torch.from_numpy(value).float().div(255.0) for value in condition_tensors
            ], dim=0),
        }


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def is_ai_assisted_conditional_row(
    row: dict,
    split: str,
    *,
    require_v7_capacity_contribution: bool = False,
) -> bool:
    binding_matches = (
        row.get("v7CapacityContributionRegistered") is True
        if require_v7_capacity_contribution
        else row.get("currentConditionIdentityMatches") is True
    )
    return (
        row.get("split") == split
        and row.get("categoryId") == "complete-maps"
        and "conditional_denoiser" in row.get("trainingRoles", [])
        and row.get("formalConditionalTrainingEligible") is True
        and row.get("conditionBound") is True
        and binding_matches
        and row.get("ownerReviewStatus") == "owner_approved"
        and row.get("machineReviewStatus") == "passed"
        and row.get("aiAssistedColdStartEligible") is True
        and row.get("independentTrainingEligible") is False
    )


def read_image(path: Path, mode: str, size: tuple[int, int], resampling):
    with Image.open(path) as image:
        value = image.convert(mode).resize(size, resample=resampling)
        return np.asarray(value, dtype=np.uint8).copy()

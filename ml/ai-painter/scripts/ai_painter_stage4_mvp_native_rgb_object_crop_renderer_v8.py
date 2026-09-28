from __future__ import annotations

"""V8 contract, renderer and deterministic in-memory crop selection."""

from pathlib import Path
from typing import Any

from ai_painter.complete_world.native_rgb_detail_renderer import (
    RESPONSIBILITY_IDENTITIES,
    build_native_complete_rgb_detail_renderer,
)
from ai_painter_stage4_mvp_native_rgb_detail_renderer_v7 import native_rgb_objective
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (
    digest, project_file, read_json, validate_binding,
)


CAPABILITY_VERSION = "stage4_mvp_native_complete_rgb_object_crop_renderer_v8"
ARCHITECTURE_ID = "stage4_native_complete_rgb_multiscale_detail_renderer_v2"
CONTRACT_ID = "stage4-mvp-native-complete-rgb-object-crop-renderer-v8-contract-v1"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-object-crop-renderer-v8-contract.json"
)
OBJECT_CROP_IDENTITIES = (
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)


def load_contract(root: Path) -> tuple[dict[str, Any], str]:
    path = project_file(root, CONTRACT_PATH)
    data = path.read_bytes()
    contract = read_json(path, "V8 object-crop renderer contract")
    if (
        contract.get("schemaVersion") != CONTRACT_ID
        or contract.get("contractId") != CONTRACT_ID
        or contract.get("status") != "cpu_candidate_not_execution_qualified"
        or contract.get("capabilityVersion") != CAPABILITY_VERSION
        or contract.get("architectureId") != ARCHITECTURE_ID
    ):
        raise ValueError("V8 object-crop contract identity changed")
    validate_binding(root, contract["datasetBinding"], "V8 Dataset")
    validate_binding(root, contract["reviewBinding"], "V8 machine review")
    validate_binding(root, contract["parentFailureEvidence"], "V8 parent failure")
    curriculum = contract.get("trainingCurriculum", {})
    if (
        curriculum.get("epochCount") != 40
        or curriculum.get("fullFrameUpdatesPerSamplePerEpoch") != 1
        or curriculum.get("objectCropUpdatesPerSamplePerEpoch") != 1
        or curriculum.get("objectCropSize") != [128, 128]
        or curriculum.get("objectCropIdentities") != list(OBJECT_CROP_IDENTITIES)
        or curriculum.get("persistentDerivedTrainingImagesAllowed") is not False
        or curriculum.get("exactOptimizerSteps") != 3840
        or contract.get("automaticRetry") is not False
    ):
        raise ValueError("V8 bounded training curriculum changed")
    return contract, digest(data)


def build_renderer(root: Path):
    contract, _ = load_contract(root)
    condition = read_json(
        project_file(root, contract["conditionContract"]["path"]), "condition contract",
    )
    order = condition["tensorContract"]["channelOrder"]
    if contract["renderer"]["responsibilityIdentities"] != list(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V8 responsibility identity order changed")
    return build_native_complete_rgb_detail_renderer(
        condition_channel_order=order, base_channels=contract["renderer"]["baseChannels"],
    )


def deterministic_object_crop(
    sample: dict, *, responsibility_indices: dict[str, int], epoch: int,
    sample_index: int, seed: int, crop_size: tuple[int, int] = (128, 128),
) -> tuple[dict, dict]:
    import random
    import torch

    conditions = sample["conditions"]
    target = sample["image"]
    if conditions.ndim != 3 or target.ndim != 3:
        raise ValueError("V8 crop expects unbatched CHW tensors")
    height, width = conditions.shape[-2:]
    crop_width, crop_height = crop_size
    if crop_width > width or crop_height > height or crop_width % 8 or crop_height % 8:
        raise ValueError("V8 crop dimensions are invalid")
    offset = (epoch - 1 + sample_index) % len(OBJECT_CROP_IDENTITIES)
    chosen = None
    points = None
    for step in range(len(OBJECT_CROP_IDENTITIES)):
        identity = OBJECT_CROP_IDENTITIES[(offset + step) % len(OBJECT_CROP_IDENTITIES)]
        mask = conditions[responsibility_indices[identity]] > 0.5
        nonzero = torch.nonzero(mask, as_tuple=False)
        if nonzero.numel() > 0:
            chosen, points = identity, nonzero
            break
    if chosen is None or points is None:
        raise ValueError("V8 train sample has no eligible object crop")
    generator = random.Random(seed + epoch * 100_003 + sample_index * 997)
    center_y = int(points[:, 0].float().mean().round()) + generator.randint(-12, 12)
    center_x = int(points[:, 1].float().mean().round()) + generator.randint(-12, 12)
    top = max(0, min(height - crop_height, center_y - crop_height // 2))
    left = max(0, min(width - crop_width, center_x - crop_width // 2))
    cropped = {
        **sample,
        "image": target[:, top:top + crop_height, left:left + crop_width].contiguous(),
        "conditions": conditions[:, top:top + crop_height, left:left + crop_width].contiguous(),
    }
    selected_mask = cropped["conditions"][responsibility_indices[chosen]]
    if int((selected_mask > 0.5).count_nonzero()) <= 0:
        raise ValueError("V8 selected crop lost its target object")
    evidence = {
        "identity": chosen, "left": left, "top": top,
        "width": crop_width, "height": crop_height,
        "maskNonzero": int((selected_mask > 0.5).count_nonzero()),
    }
    return cropped, evidence

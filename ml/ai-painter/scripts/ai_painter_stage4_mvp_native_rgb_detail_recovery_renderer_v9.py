from __future__ import annotations

"""V9 bounded contract, renderer and detail-statistic objective."""

from pathlib import Path
from typing import Any

from ai_painter.complete_world.native_rgb_detail_recovery_renderer import (
    RESPONSIBILITY_IDENTITIES,
    build_native_complete_rgb_detail_recovery_renderer,
)
from ai_painter_stage4_mvp_native_rgb_detail_renderer_v7 import native_rgb_objective
from ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8 import (
    OBJECT_CROP_IDENTITIES, deterministic_object_crop,
)
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (
    digest, project_file, read_json, validate_binding,
)


CAPABILITY_VERSION = "stage4_mvp_native_complete_rgb_detail_recovery_renderer_v9"
ARCHITECTURE_ID = "stage4_native_complete_rgb_detail_recovery_renderer_v3"
CONTRACT_ID = "stage4-mvp-native-complete-rgb-detail-recovery-renderer-v9-contract-v1"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-detail-recovery-renderer-v9-contract.json"
)


def load_contract(root: Path) -> tuple[dict[str, Any], str]:
    path = project_file(root, CONTRACT_PATH)
    data = path.read_bytes()
    contract = read_json(path, "V9 detail recovery contract")
    if (
        contract.get("schemaVersion") != CONTRACT_ID
        or contract.get("contractId") != CONTRACT_ID
        or contract.get("status") != "cpu_candidate_not_execution_qualified"
        or contract.get("capabilityVersion") != CAPABILITY_VERSION
        or contract.get("architectureId") != ARCHITECTURE_ID
    ):
        raise ValueError("V9 detail recovery contract identity changed")
    validate_binding(root, contract["datasetBinding"], "V9 Dataset")
    validate_binding(root, contract["parentFailureEvidence"], "V9 parent failure")
    validate_binding(root, contract["reviewBindings"]["semanticAndUpperAesthetic"], "V9 semantic review")
    validate_binding(root, contract["reviewBindings"]["minimumDetail"], "V9 minimum detail review")
    renderer = contract["renderer"]
    if (
        renderer.get("inputConditionChannels") != 23
        or renderer.get("outputChannels") != 3
        or renderer.get("baseChannels") != 48
        or renderer.get("deterministicFourierFrequencyBands") != [1, 2, 4, 8, 16]
        or renderer.get("fourierFeatureCount") != 20
        or renderer.get("randomInputAllowed") is not False
        or renderer.get("externalModelAllowed") is not False
        or renderer.get("staticMapOrTileCompositionAllowed") is not False
    ):
        raise ValueError("V9 renderer boundary changed")
    curriculum = contract["trainingCurriculum"]
    if (
        curriculum.get("epochCount") != 24
        or curriculum.get("fullFrameUpdatesPerSamplePerEpoch") != 1
        or curriculum.get("objectCropUpdatesPerSamplePerEpoch") != 1
        or curriculum.get("objectCropSize") != [128, 128]
        or curriculum.get("objectCropIdentities") != list(OBJECT_CROP_IDENTITIES)
        or curriculum.get("exactOptimizerSteps") != 2304
        or curriculum.get("freshInitializationRequired") is not True
        or curriculum.get("v8CheckpointReuseAllowed") is not False
        or contract.get("automaticRetry") is not False
    ):
        raise ValueError("V9 bounded schedule changed")
    return contract, digest(data)


def build_renderer(root: Path):
    contract, _ = load_contract(root)
    condition = read_json(
        project_file(root, contract["conditionContract"]["path"]), "condition contract",
    )
    order = condition["tensorContract"]["channelOrder"]
    if contract["renderer"]["responsibilityIdentities"] != list(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V9 responsibility identity order changed")
    return build_native_complete_rgb_detail_recovery_renderer(
        condition_channel_order=order,
        base_channels=contract["renderer"]["baseChannels"],
        frequency_bands=contract["renderer"]["deterministicFourierFrequencyBands"],
    )


def detail_recovery_objective(predicted, target, conditions, model, objective):
    from torch.nn import functional as functional

    base_total, components = native_rgb_objective(
        predicted, target, conditions, model, objective,
    )
    detail = objective["detailStatistics"]
    high_pass_kernel = int(detail["highPassKernel"])
    variance_kernel = int(detail["localVarianceKernel"])

    def high_pass(value):
        return value - functional.avg_pool2d(
            value, high_pass_kernel, stride=1, padding=high_pass_kernel // 2,
        )

    def gradient_energy(value):
        horizontal = (value[..., :, 1:] - value[..., :, :-1]).abs().mean(dim=(-3, -2, -1))
        vertical = (value[..., 1:, :] - value[..., :-1, :]).abs().mean(dim=(-3, -2, -1))
        return (horizontal + vertical) / 2.0

    def local_variance(value):
        mean = functional.avg_pool2d(
            value, variance_kernel, stride=1, padding=variance_kernel // 2,
        )
        square_mean = functional.avg_pool2d(
            value.square(), variance_kernel, stride=1, padding=variance_kernel // 2,
        )
        return (square_mean - mean.square()).clamp_min(0.0).mean(dim=(-3, -2, -1))

    predicted_texture = high_pass(predicted).abs().mean(dim=(-3, -2, -1))
    target_texture = high_pass(target).abs().mean(dim=(-3, -2, -1))
    texture_energy = functional.l1_loss(predicted_texture, target_texture)
    gradient_energy_loss = functional.l1_loss(
        gradient_energy(predicted), gradient_energy(target),
    )
    local_variance_loss = functional.l1_loss(
        local_variance(predicted), local_variance(target),
    )
    total = (
        base_total
        + texture_energy * float(detail["textureEnergyWeight"])
        + gradient_energy_loss * float(detail["gradientEnergyWeight"])
        + local_variance_loss * float(detail["localVarianceWeight"])
    )
    return total, {
        **components,
        "baseTotal": base_total,
        "detailTextureEnergyLoss": texture_energy,
        "detailGradientEnergyLoss": gradient_energy_loss,
        "detailLocalVarianceLoss": local_variance_loss,
        "total": total,
    }

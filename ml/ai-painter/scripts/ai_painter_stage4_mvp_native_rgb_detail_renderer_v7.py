from __future__ import annotations

"""Contract and train-only objective for the V7 multiscale RGB detail successor."""

from pathlib import Path
from typing import Any

from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (
    digest, project_file, read_json, validate_binding,
)


CAPABILITY_VERSION = "stage4_mvp_native_complete_rgb_detail_renderer_v7"
ARCHITECTURE_ID = "stage4_native_complete_rgb_multiscale_detail_renderer_v2"
CONTRACT_ID = "stage4-mvp-native-complete-rgb-detail-renderer-v7-contract-v1"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-detail-renderer-v7-contract.json"
)


def load_contract(root: Path) -> tuple[dict[str, Any], str]:
    path = project_file(root, CONTRACT_PATH)
    data = path.read_bytes()
    contract = read_json(path, "V7 native RGB detail contract")
    if (
        contract.get("schemaVersion") != CONTRACT_ID
        or contract.get("contractId") != CONTRACT_ID
        or contract.get("status") != "cpu_candidate_not_execution_qualified"
        or contract.get("capabilityVersion") != CAPABILITY_VERSION
        or contract.get("architectureId") != ARCHITECTURE_ID
    ):
        raise ValueError("V7 native RGB detail contract identity changed")
    validate_binding(root, contract["datasetBinding"], "V7 Dataset")
    validate_binding(root, contract["reviewBinding"], "V7 machine review")
    validate_binding(root, contract["parentFailureEvidence"], "V7 parent failure")
    renderer = contract.get("renderer", {})
    if (
        renderer.get("inputChannels") != 23
        or renderer.get("outputChannels") != 3
        or renderer.get("baseChannels") != 32
        or renderer.get("decoderScales") != [8, 4, 2, 1]
        or renderer.get("fullResolutionDetailRefinement") is not True
        or renderer.get("objectMaskLocalShapeEncoder") is not True
        or renderer.get("oneParameterNamespacePerResponsibility") is not True
        or renderer.get("outsideAuthoritativeMaskContributionMustBeZero") is not True
        or renderer.get("randomInputAllowed") is not False
        or renderer.get("diffusionAllowed") is not False
        or renderer.get("autoencoderAllowed") is not False
        or renderer.get("patchSpriteTileCompositionAllowed") is not False
    ):
        raise ValueError("V7 renderer boundary changed")
    if contract.get("automaticRetry") is not False:
        raise ValueError("V7 automatic retry must remain disabled")
    return contract, digest(data)


def build_renderer(root: Path):
    from ai_painter.complete_world.native_rgb_detail_renderer import (
        RESPONSIBILITY_IDENTITIES, build_native_complete_rgb_detail_renderer,
    )

    contract, _ = load_contract(root)
    condition_contract = read_json(
        project_file(root, contract["conditionContract"]["path"]), "condition contract",
    )
    order = condition_contract["tensorContract"]["channelOrder"]
    if contract["renderer"]["responsibilityIdentities"] != list(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V7 responsibility identity order changed")
    return build_native_complete_rgb_detail_renderer(
        condition_channel_order=order, base_channels=contract["renderer"]["baseChannels"],
    )


def native_rgb_objective(predicted, target, conditions, model, objective: dict[str, Any]):
    import torch
    from torch.nn import functional as functional

    def gradient(value):
        return value[..., :, 1:] - value[..., :, :-1], value[..., 1:, :] - value[..., :-1, :]

    def laplacian(value):
        return (-4.0 * value[..., 1:-1, 1:-1] + value[..., 1:-1, :-2]
                + value[..., 1:-1, 2:] + value[..., :-2, 1:-1] + value[..., 2:, 1:-1])

    full_rgb = functional.l1_loss(predicted, target)
    pred_grad, target_grad = gradient(predicted), gradient(target)
    full_gradient = sum(functional.l1_loss(a, b) for a, b in zip(pred_grad, target_grad)) / 2.0
    full_laplacian = functional.l1_loss(laplacian(predicted), laplacian(target))
    total = (full_rgb * float(objective["fullRgbMaeWeight"])
             + full_gradient * float(objective["fullRgbGradientWeight"])
             + full_laplacian * float(objective["fullRgbLaplacianWeight"]))
    rgb_losses, gradient_losses, structure_losses = {}, {}, {}
    luma_weights = predicted.new_tensor([0.2126, 0.7152, 0.0722]).view(1, 3, 1, 1)
    predicted_luma = (predicted * luma_weights).sum(dim=1, keepdim=True)
    target_luma = (target * luma_weights).sum(dim=1, keepdim=True)
    for identity, weight in objective["responsibilityRgbMaeWeights"].items():
        index = model.responsibility_indices[identity]
        mask = conditions[:, index:index + 1]
        denominator = mask.sum()
        rgb_denominator = denominator * predicted.shape[1]
        rgb = ((predicted - target).abs() * mask).sum() / rgb_denominator.clamp_min(1.0)
        rgb = torch.where(denominator > 0, rgb, predicted.sum() * 0.0)
        horizontal_mask = mask[..., :, 1:] * mask[..., :, :-1]
        vertical_mask = mask[..., 1:, :] * mask[..., :-1, :]
        horizontal = (((pred_grad[0] - target_grad[0]).abs() * horizontal_mask).sum()
                      / (horizontal_mask.sum() * 3).clamp_min(1.0))
        vertical = (((pred_grad[1] - target_grad[1]).abs() * vertical_mask).sum()
                    / (vertical_mask.sum() * 3).clamp_min(1.0))
        local_gradient = (horizontal + vertical) / 2.0
        count = denominator.clamp_min(1.0)
        pred_mean = (predicted_luma * mask).sum() / count
        target_mean = (target_luma * mask).sum() / count
        pred_centered = (predicted_luma - pred_mean) * mask
        target_centered = (target_luma - target_mean) * mask
        numerator = (pred_centered * target_centered).sum()
        norm = torch.sqrt(pred_centered.square().sum() * target_centered.square().sum() + 1e-8)
        correlation = numerator / norm
        structure = torch.where(denominator > 1, 1.0 - correlation, predicted.sum() * 0.0)
        rgb_losses[identity] = rgb
        gradient_losses[identity] = local_gradient
        structure_losses[identity] = structure
        total = total + float(weight) * (
            rgb
            + local_gradient * float(objective["responsibilityGradientWeight"])
            + structure * float(objective["responsibilityLumaStructureWeight"])
        )
    return total, {
        "fullRgbMae": full_rgb, "fullRgbGradientMae": full_gradient,
        "fullRgbLaplacianMae": full_laplacian, "responsibilityRgbMae": rgb_losses,
        "responsibilityGradientMae": gradient_losses,
        "responsibilityLumaStructureLoss": structure_losses, "total": total,
    }

from __future__ import annotations

"""Contract and objective support for the bounded native-RGB V6 candidate."""

from hashlib import sha256
import json
from pathlib import Path
from typing import Any


CAPABILITY_VERSION = "stage4_mvp_native_complete_rgb_renderer_v6"
ARCHITECTURE_ID = "stage4_native_complete_rgb_responsibility_renderer_v1"
CONTRACT_ID = "stage4-mvp-native-complete-rgb-renderer-v6-contract-v1"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-renderer-v6-contract.json"
)


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def project_file(root: Path, logical: str) -> Path:
    if not isinstance(logical, str) or not logical or logical.startswith(("/", "\\")):
        raise ValueError("project-relative path is invalid")
    parts = logical.replace("\\", "/").split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError("project-relative path is invalid")
    path = root.joinpath(*parts).resolve()
    allowed = (root / ".runtime").resolve() if logical.startswith(".runtime/") else root.resolve()
    if not path.is_relative_to(allowed):
        raise ValueError("project-relative path escapes root")
    return path


def read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_bytes())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is unreadable") from error
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def validate_binding(root: Path, binding: dict[str, Any], label: str) -> None:
    if (
        not isinstance(binding, dict)
        or not {"path", "sha256"}.issubset(binding)
        or not isinstance(binding.get("path"), str)
        or not isinstance(binding.get("sha256"), str)
    ):
        raise ValueError(f"{label} binding is invalid")
    path = project_file(root, binding["path"])
    if digest(path.read_bytes()) != binding["sha256"]:
        raise ValueError(f"{label} binding is stale")


def load_contract(root: Path) -> tuple[dict[str, Any], str]:
    path = project_file(root, CONTRACT_PATH)
    data = path.read_bytes()
    contract = read_json(path, "V6 native RGB contract")
    if (
        contract.get("schemaVersion") != CONTRACT_ID
        or contract.get("contractId") != CONTRACT_ID
        or contract.get("status") != "cpu_candidate_not_execution_qualified"
        or contract.get("capabilityVersion") != CAPABILITY_VERSION
        or contract.get("architectureId") != ARCHITECTURE_ID
    ):
        raise ValueError("V6 native RGB contract identity changed")
    validate_binding(root, contract["datasetBinding"], "V6 Dataset")
    validate_binding(root, contract["reviewBinding"], "V6 machine review")
    for label, binding in contract["failureEvidence"].items():
        validate_binding(root, binding, f"V6 failure evidence {label}")
    renderer = contract.get("renderer", {})
    expected_false = (
        "randomInputAllowed", "diffusionAllowed", "autoencoderAllowed",
        "patchSpriteTileCompositionAllowed",
    )
    expected_derived_exclusions = [
        "object_instance", "signed_distance_path", "signed_distance_water",
        "signed_distance_shoreline", "signed_distance_object_ground",
    ]
    if (
        renderer.get("inputChannels") != 23
        or renderer.get("outputChannels") != 3
        or renderer.get("baseChannels") != 32
        or renderer.get("baseExcludesResponsibilityChannels") is not True
        or renderer.get("baseExcludesDerivedResponsibilityChannels") != expected_derived_exclusions
        or renderer.get("oneParameterNamespacePerResponsibility") is not True
        or renderer.get("outsideAuthoritativeMaskContributionMustBeZero") is not True
        or any(renderer.get(key) is not False for key in expected_false)
    ):
        raise ValueError("V6 native RGB renderer boundary changed")
    gates = contract.get("activationGates", {})
    if gates.get("cpuContractNow") is not True or any(
        value is not False for key, value in gates.items() if key != "cpuContractNow"
    ):
        raise ValueError("V6 activation gate changed")
    if contract.get("automaticRetry") is not False:
        raise ValueError("V6 automatic retry must remain disabled")
    return contract, digest(data)


def build_renderer(root: Path):
    from ai_painter.complete_world.native_rgb_renderer import (
        RESPONSIBILITY_IDENTITIES,
        build_native_complete_rgb_renderer,
    )

    contract, _ = load_contract(root)
    condition_contract = read_json(
        project_file(root, contract["conditionContract"]["path"]),
        "condition contract",
    )
    order = condition_contract["tensorContract"]["channelOrder"]
    if contract["renderer"]["responsibilityIdentities"] != list(RESPONSIBILITY_IDENTITIES):
        raise ValueError("V6 responsibility identity order changed")
    return build_native_complete_rgb_renderer(
        condition_channel_order=order,
        base_channels=contract["renderer"]["baseChannels"],
    )


def native_rgb_objective(predicted, target, conditions, model, objective: dict[str, Any]):
    import torch
    from torch.nn import functional as functional

    def gradient(value):
        horizontal = value[..., :, 1:] - value[..., :, :-1]
        vertical = value[..., 1:, :] - value[..., :-1, :]
        return horizontal, vertical

    def laplacian(value):
        return (
            -4.0 * value[..., 1:-1, 1:-1]
            + value[..., 1:-1, :-2]
            + value[..., 1:-1, 2:]
            + value[..., :-2, 1:-1]
            + value[..., 2:, 1:-1]
        )

    full_rgb = functional.l1_loss(predicted, target)
    predicted_gradient = gradient(predicted)
    target_gradient = gradient(target)
    full_gradient = sum(
        functional.l1_loss(left, right)
        for left, right in zip(predicted_gradient, target_gradient)
    ) / 2.0
    full_laplacian = functional.l1_loss(laplacian(predicted), laplacian(target))
    components = {
        "fullRgbMae": full_rgb,
        "fullRgbGradientMae": full_gradient,
        "fullRgbLaplacianMae": full_laplacian,
    }
    total = (
        full_rgb * float(objective["fullRgbMaeWeight"])
        + full_gradient * float(objective["fullRgbGradientWeight"])
        + full_laplacian * float(objective["fullRgbLaplacianWeight"])
    )
    responsibility_losses = {}
    for identity, weight in objective["responsibilityRgbMaeWeights"].items():
        index = model.responsibility_indices[identity]
        mask = conditions[:, index:index + 1]
        denominator = mask.sum() * predicted.shape[1]
        masked = (
            ((predicted - target).abs() * mask).sum() / denominator.clamp_min(1.0)
        )
        masked = torch.where(denominator > 0, masked, predicted.sum() * 0.0)
        responsibility_losses[identity] = masked
        total = total + masked * float(weight)
    components["responsibilityRgbMae"] = responsibility_losses
    components["total"] = total
    return total, components

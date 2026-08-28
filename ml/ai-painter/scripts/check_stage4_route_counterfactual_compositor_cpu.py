from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "ml" / "ai-painter" / "src"
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
sys.path.insert(0, str(SRC))
sys.path.insert(0, str(SCRIPTS))

from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_native_condition_encoder_contract import (
    compile_native_condition_encoder_cpu_inactive_config,
)
from ai_painter_route_counterfactual_compositor_contract import (
    COUNTERFACTUAL_DERIVED_CHANNELS,
    ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE,
    compile_route_counterfactual_compositor_cpu_inactive_config,
    validate_route_counterfactual_compositor_cpu_inactive_config,
)


SOURCE_CONFIG = (
    ROOT
    / ".runtime"
    / "ai-painter"
    / "stage4-direct-responsibility-residual-formal-stage0"
    / "stage4-direct-responsibility-residual-stage0-20260827091911-01"
    / "active-config.json"
)
DATASET_PATH = (
    ROOT
    / "data"
    / "world-samples"
    / "ai-assisted-cold-start-dataset-packages"
    / "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z"
    / "manifest.json"
)


def state_sha256(state) -> str:
    digest = hashlib.sha256()
    for name in sorted(state):
        tensor = state[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def tensor_sha256(value) -> str:
    tensor = value.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode("ascii"))
    digest.update(str(tuple(tensor.shape)).encode("ascii"))
    digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def main() -> int:
    torch = require_torch()
    source = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    config = compile_route_counterfactual_compositor_cpu_inactive_config(source)
    contract = validate_route_counterfactual_compositor_cpu_inactive_config(config)
    baseline_config = compile_native_condition_encoder_cpu_inactive_config(source)
    selection = trainer.conditional_dataset_selection_contract(config)
    split_counts = {
        split: len(AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=selection,
        ))
        for split in ("train", "validation", "challenge", "regression")
    }
    if split_counts != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}:
        raise AssertionError("route counterfactual split coverage is invalid")

    seed = int(config["training"]["seed"])
    torch.manual_seed(seed)
    model = build_complete_world_system(config)
    torch.manual_seed(seed)
    baseline = build_complete_world_system(baseline_config)
    if model.denoiser.__class__.__name__ != "ProjectOwnedNativeConditionCleanLatentGenerator":
        raise AssertionError("route counterfactual factory binding is invalid")
    names = tuple(name for name, _ in model.denoiser.named_parameters())
    baseline_names = tuple(name for name, _ in baseline.denoiser.named_parameters())
    if names != baseline_names:
        raise AssertionError("route counterfactual added or removed parameter identities")
    shapes = tuple(tuple(value.shape) for value in model.denoiser.parameters())
    baseline_shapes = tuple(tuple(value.shape) for value in baseline.denoiser.parameters())
    if shapes != baseline_shapes:
        raise AssertionError("route counterfactual changed parameter shapes")
    if any("responsibility_residual_heads" in name for name in names):
        raise AssertionError("route counterfactual retained rejected residual heads")
    parameter_count = sum(value.numel() for value in model.denoiser.parameters())
    if parameter_count != 4_610_572:
        raise AssertionError("route counterfactual parameter count changed")
    if state_sha256(model.denoiser.state_dict()) != state_sha256(baseline.denoiser.state_dict()):
        raise AssertionError("route counterfactual fixed initialization identity changed")

    torch.manual_seed(seed)
    conditions = torch.rand(1, 23, 192, 256, requires_grad=True)
    order = list(config["conditionChannelOrder"])
    grass_index = order.index("terrain_grass")
    path_index = order.index("terrain_path_ground")
    signed_path_index = order.index("signed_distance_path")
    with torch.no_grad():
        conditions[:, path_index].zero_()
        conditions[:, path_index, 24:152, 0:72] = 1.0
        conditions[:, grass_index, 24:152, 0:72] = 0.0
        conditions[:, signed_path_index] = 0.5
    before = state_sha256(model.state_dict())
    final_latent, evidence = model.denoiser(
        conditions,
        return_route_counterfactual_evidence=True,
    )
    full_latent = evidence["fullRouteLatent"]
    no_route_latent = evidence["noRouteLatent"]
    route_mask = evidence["routeMask"]
    no_route_conditions = evidence["noRouteConditions"]
    if evidence["sharedParameterCopies"] != 1:
        raise AssertionError("route counterfactual uses more than one parameter copy")
    if list(final_latent.shape) != [1, 12, 48, 64]:
        raise AssertionError("route counterfactual output shape is invalid")
    if list(route_mask.shape) != [1, 1, 48, 64] or route_mask.requires_grad:
        raise AssertionError("route counterfactual mask identity is invalid")
    expected = no_route_latent + route_mask * (full_latent - no_route_latent)
    if tensor_sha256(final_latent) != tensor_sha256(expected):
        raise AssertionError("route counterfactual merge is not byte exact")
    outside = route_mask.expand_as(final_latent) == 0
    inside = route_mask.expand_as(final_latent) == 1
    if not torch.any(outside) or not torch.any(inside):
        raise AssertionError("route counterfactual fixture lacks binary support")
    if not torch.equal(final_latent[outside], no_route_latent[outside]):
        raise AssertionError("mask outside does not equal the no-route latent")
    inside_final = final_latent[inside]
    inside_full = full_latent[inside]
    inside_no_route = no_route_latent[inside]
    inside_scale = torch.maximum(
        torch.maximum(inside_no_route.abs(), inside_full.abs()),
        torch.maximum((inside_full - inside_no_route).abs(), inside_final.abs()),
    )
    inside_tolerance = (
        torch.finfo(final_latent.dtype).eps * 3 * inside_scale
    )
    inside_difference = (inside_final - inside_full).abs()
    if not torch.all(inside_difference <= inside_tolerance):
        raise AssertionError(
            "mask-inside latent exceeds the dtype-derived three-operation "
            "counterfactual merge boundary"
        )
    if not torch.all(no_route_conditions[:, path_index] == 0):
        raise AssertionError("no-route path channel is not zero")
    if not torch.all(no_route_conditions[:, signed_path_index] == 1.0 / 255.0):
        raise AssertionError("no-route signed path channel is not uniquely derived")
    if not torch.equal(
        no_route_conditions[:, grass_index],
        torch.maximum(conditions[:, grass_index], conditions[:, path_index]),
    ):
        raise AssertionError("no-route grass channel is not uniquely derived")
    derived = set(COUNTERFACTUAL_DERIVED_CHANNELS)
    for index, channel_id in enumerate(order):
        if channel_id not in derived and not torch.equal(
            no_route_conditions[:, index], conditions[:, index]
        ):
            raise AssertionError(f"unrelated channel changed: {channel_id}")

    with torch.no_grad():
        baseline_full = baseline.predict_clean_latent(conditions.detach())
    if tensor_sha256(baseline_full) != tensor_sha256(full_latent):
        raise AssertionError("legacy native full-route output identity changed")
    decoded = model.decode_clean_latent(final_latent)
    objective = final_latent.square().mean() + decoded.abs().mean()
    parameters = tuple(model.denoiser.parameters())
    gradients = torch.autograd.grad(
        objective,
        (conditions, *parameters),
        allow_unused=True,
    )
    if any(value is None for value in gradients):
        raise AssertionError("a formal route counterfactual parameter is unreachable")
    if any(not torch.isfinite(value).all() for value in gradients):
        raise AssertionError("a route counterfactual gradient is non-finite")
    if any(not torch.any(value != 0) for value in gradients):
        raise AssertionError("a route counterfactual gradient is zero")
    if any(value.grad is not None for value in model.parameters()):
        raise AssertionError("CPU qualification populated parameter grad fields")
    if state_sha256(model.state_dict()) != before:
        raise AssertionError("CPU qualification changed model state")
    if any(parameter.requires_grad for parameter in model.autoencoder.parameters()):
        raise AssertionError("Autoencoder is not frozen")
    try:
        baseline.denoiser(
            conditions.detach(),
            return_route_counterfactual_evidence=True,
        )
    except ValueError:
        pass
    else:
        raise AssertionError("legacy native encoder exposed counterfactual evidence")

    mutations = (
        ("parameterCopies", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("parameterCopies", 2)),
        ("additionalParameters", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("additionalTrainableParameters", 1)),
        ("pathValue", lambda value: value["routeCounterfactualCompositorContract"]["noRouteDerivation"].__setitem__("terrain_path_ground", "free_value")),
        ("signedPath", lambda value: value["routeCounterfactualCompositorContract"]["noRouteDerivation"].__setitem__("signed_distance_path", "zero")),
        ("grass", lambda value: value["routeCounterfactualCompositorContract"]["noRouteDerivation"].__setitem__("terrain_grass", "unchanged")),
        ("otherChannels", lambda value: value["routeCounterfactualCompositorContract"]["noRouteDerivation"].__setitem__("otherChannels", "mutable")),
        ("mask", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("routeMaskSource", "learned_mask")),
        ("merge", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("merge", "free_alpha_blend")),
        ("freeBlend", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("freeBlendWeightsPresent", True)),
        ("postDecode", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("postDecodeRgbMutation", True)),
        ("newLoss", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("newLossTermAdded", True)),
        ("active", lambda value: value.__setitem__("status", "active")),
        ("gpuGate", lambda value: value["training"]["activationGates"].__setitem__("gpuNow", True)),
        ("loss", lambda value: value["training"]["denoiserLossWeights"].__setitem__("newLoss", 1.0)),
        ("architecture", lambda value: value.__setitem__("denoiserArchitecture", "stage4_native_condition_encoder_clean_latent_generator_v1")),
    )
    for name, mutate in mutations:
        invalid = copy.deepcopy(config)
        mutate(invalid)
        try:
            validate_route_counterfactual_compositor_cpu_inactive_config(invalid)
        except ValueError:
            continue
        raise AssertionError(f"invalid route counterfactual contract accepted: {name}")

    print(json.dumps({
        "status": "stage4_route_counterfactual_compositor_cpu_support_passed",
        "positiveChecks": 28,
        "negativeChecks": len(mutations),
        "modeId": contract["modeId"],
        "architecture": ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE,
        "parameterTensorCount": len(names),
        "parameterCount": parameter_count,
        "baselineParameterCount": sum(value.numel() for value in baseline.denoiser.parameters()),
        "additionalTrainableParameterCount": 0,
        "sharedParameterCopies": 1,
        "counterfactualDerivedChannels": list(COUNTERFACTUAL_DERIVED_CHANNELS),
        "unchangedConditionChannelCount": 20,
        "splitCounts": split_counts,
        "outputShape": list(final_latent.shape),
        "decodedRgbShape": list(decoded.shape),
        "maskInsideFullRouteNumericallyEquivalent": True,
        "maskInsideMaxAbsoluteDifference": float(inside_difference.max().item()),
        "maskInsideMaxDerivedTolerance": float(inside_tolerance.max().item()),
        "maskOutsideNoRouteByteExact": True,
        "allFormalGradientsFiniteNonZero": True,
        "legacyNativeFullRouteByteIdentity": True,
        "modelStateUnchanged": True,
        "autoencoderFrozen": True,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

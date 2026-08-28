from __future__ import annotations

import copy
import hashlib
import inspect
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
    NATIVE_CONDITION_ENCODER_ARCHITECTURE,
    compile_native_condition_encoder_cpu_inactive_config,
    validate_native_condition_encoder_cpu_inactive_config,
)


SOURCE_CONFIG = ROOT / ".runtime" / "ai-painter" / (
    "stage4-direct-responsibility-residual-formal-stage0"
) / "stage4-direct-responsibility-residual-stage0-20260827091911-01" / (
    "active-config.json"
)
DATASET_PATH = ROOT / "data" / "world-samples" / (
    "ai-assisted-cold-start-dataset-packages"
) / "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z" / "manifest.json"


def state_sha256(state) -> str:
    digest = hashlib.sha256()
    for name in sorted(state):
        tensor = state[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def main() -> int:
    torch = require_torch()
    source = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    config = compile_native_condition_encoder_cpu_inactive_config(source)
    contract = validate_native_condition_encoder_cpu_inactive_config(config)
    selection = trainer.conditional_dataset_selection_contract(config)
    if selection != "registered_v7_capacity_contribution_v1":
        raise AssertionError("native condition encoder is not bound to the formal dataset")
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
        raise AssertionError("native condition encoder formal split coverage is invalid")

    torch.manual_seed(int(config["training"]["seed"]))
    model = build_complete_world_system(config)
    if model.denoiser.__class__.__name__ != "ProjectOwnedNativeConditionCleanLatentGenerator":
        raise AssertionError("native condition encoder model factory binding is invalid")
    names = tuple(name for name, _ in model.denoiser.named_parameters())
    allowed_prefixes = (
        "native_condition_stem.",
        "native_condition_down1.",
        "native_condition_down2.",
        "middle.",
        "output.",
    )
    if not names or any(not name.startswith(allowed_prefixes) for name in names):
        raise AssertionError("native condition encoder parameter namespace escaped")
    if any(name.startswith(("up", "fuse", "responsibility_residual_heads")) for name in names):
        raise AssertionError("native condition encoder retained a rejected route module")

    spatial_shapes = {}
    hooks = [
        model.denoiser.native_condition_stem.register_forward_hook(
            lambda _module, inputs, output: spatial_shapes.update({
                "stemInput": list(inputs[0].shape), "stemOutput": list(output.shape)
            })
        ),
        model.denoiser.native_condition_down1.register_forward_hook(
            lambda _module, inputs, output: spatial_shapes.update({
                "down1Input": list(inputs[0].shape), "down1Output": list(output.shape)
            })
        ),
        model.denoiser.native_condition_down2.register_forward_hook(
            lambda _module, inputs, output: spatial_shapes.update({
                "down2Input": list(inputs[0].shape), "down2Output": list(output.shape)
            })
        ),
    ]
    conditions = torch.rand(1, 23, 192, 256, requires_grad=True)
    before = state_sha256(model.state_dict())
    clean_latent = model.predict_clean_latent(conditions)
    for hook in hooks:
        hook.remove()
    decoded = model.decode_clean_latent(clean_latent)
    if list(clean_latent.shape) != [1, 12, 48, 64]:
        raise AssertionError("native condition encoder latent shape is invalid")
    if list(decoded.shape) != [1, 3, 192, 256]:
        raise AssertionError("native condition encoder decoded RGB shape is invalid")
    expected_shapes = {
        "stemInput": [1, 23, 192, 256],
        "stemOutput": [1, 64, 192, 256],
        "down1Input": [1, 64, 192, 256],
        "down1Output": [1, 128, 96, 128],
        "down2Input": [1, 128, 96, 128],
        "down2Output": [1, 256, 48, 64],
    }
    if spatial_shapes != expected_shapes:
        raise AssertionError("native condition encoder spatial identity is invalid")
    objective = clean_latent.square().mean() + decoded.abs().mean()
    parameters = tuple(model.denoiser.parameters())
    gradients = torch.autograd.grad(
        objective,
        (conditions, *parameters),
        allow_unused=True,
    )
    if any(value is None for value in gradients):
        raise AssertionError("a native condition encoder input or parameter is unreachable")
    if any(not torch.isfinite(value).all() for value in gradients):
        raise AssertionError("a native condition encoder gradient is non-finite")
    if any(not torch.any(value != 0) for value in gradients):
        raise AssertionError("a native condition encoder gradient is zero")
    after = state_sha256(model.state_dict())
    if before != after:
        raise AssertionError("CPU qualification changed model state")
    if any(parameter.requires_grad for parameter in model.autoencoder.parameters()):
        raise AssertionError("Autoencoder is not frozen")
    forward_source = inspect.getsource(model.denoiser.forward)
    if "native_condition_stem(conditions)" not in forward_source:
        raise AssertionError("native conditions do not reach the first learned stem directly")
    if "prepare_typed_conditions(conditions" in forward_source:
        raise AssertionError("raw condition resize remains before the learned stem")

    mutations = (
        lambda value: value["nativeConditionEncoderContract"].__setitem__("rawConditionResizeBeforeStem", True),
        lambda value: value["nativeConditionEncoderContract"].__setitem__("widths", [64, 128, 512]),
        lambda value: value["nativeConditionEncoderContract"].__setitem__("strideSequence", [1, 4]),
        lambda value: value["nativeConditionEncoderContract"].__setitem__("postDecodeRgbMutation", True),
        lambda value: value["nativeConditionEncoderContract"].__setitem__("newLossTermAdded", True),
        lambda value: value["nativeConditionEncoderContract"].__setitem__("freeArchitectureParameterChosen", True),
        lambda value: value["training"]["activationGates"].__setitem__("gpuNow", True),
        lambda value: value["training"]["denoiserLossWeights"].__setitem__("velocity", 1.0),
        lambda value: value.__setitem__("denoiserArchitecture", "stage4_direct_condition_clean_latent_generator_v1"),
        lambda value: value.__setitem__("directResponsibilityResidualContract", {}),
        lambda value: value["training"].__setitem__("splitCounts", {"train": 64}),
    )
    for mutate in mutations:
        invalid = copy.deepcopy(config)
        mutate(invalid)
        try:
            validate_native_condition_encoder_cpu_inactive_config(invalid)
        except ValueError:
            continue
        raise AssertionError("invalid native condition encoder contract was accepted")

    print(json.dumps({
        "status": "stage4_native_condition_encoder_cpu_support_passed",
        "positiveChecks": 20,
        "negativeChecks": len(mutations),
        "modeId": contract["modeId"],
        "architecture": NATIVE_CONDITION_ENCODER_ARCHITECTURE,
        "parameterTensorCount": len(names),
        "parameterCount": sum(parameter.numel() for parameter in parameters),
        "datasetSelectionContract": selection,
        "splitCounts": split_counts,
        "spatialIdentity": spatial_shapes,
        "inputShape": list(conditions.shape),
        "outputShape": list(clean_latent.shape),
        "decodedRgbShape": list(decoded.shape),
        "allFormalGradientsFiniteNonZero": True,
        "modelStateUnchanged": before == after,
        "autoencoderFrozen": True,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

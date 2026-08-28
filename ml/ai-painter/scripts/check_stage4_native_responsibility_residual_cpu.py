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
from ai_painter_native_responsibility_residual_contract import (
    NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
    RESPONSIBILITY_IDENTITY_ORDER,
    compile_native_responsibility_residual_cpu_inactive_config,
    validate_native_responsibility_residual_cpu_inactive_config,
)


SOURCE_CONFIG = ROOT / ".runtime" / "ai-painter" / "stage4-direct-responsibility-residual-formal-stage0" / "stage4-direct-responsibility-residual-stage0-20260827091911-01" / "active-config.json"
DATASET_PATH = ROOT / "data" / "world-samples" / "ai-assisted-cold-start-dataset-packages" / "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z" / "manifest.json"


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
    config = compile_native_responsibility_residual_cpu_inactive_config(source)
    contract = validate_native_responsibility_residual_cpu_inactive_config(config)
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
        raise AssertionError("native responsibility residual split coverage is invalid")

    torch.manual_seed(int(config["training"]["seed"]))
    model = build_complete_world_system(config)
    if model.denoiser.__class__.__name__ != "ProjectOwnedNativeConditionCleanLatentGenerator":
        raise AssertionError("native responsibility residual factory binding is invalid")
    names = tuple(name for name, _ in model.denoiser.named_parameters())
    head_names = tuple(
        name for name in names if name.startswith("responsibility_residual_heads.")
    )
    if len(head_names) != len(RESPONSIBILITY_IDENTITY_ORDER) * 2:
        raise AssertionError("native responsibility residual parameter identity is incomplete")
    if set(name.split(".")[1] for name in head_names) != set(RESPONSIBILITY_IDENTITY_ORDER):
        raise AssertionError("native responsibility residual parameter identity is crossed")
    if sum(parameter.numel() for parameter in model.denoiser.parameters()) != 4_748_872:
        raise AssertionError("native responsibility residual parameter count changed")

    conditions = torch.rand(1, 23, 192, 256, requires_grad=True)
    with torch.no_grad():
        for offset, channel_id in enumerate(RESPONSIBILITY_IDENTITY_ORDER):
            index = config["conditionChannelOrder"].index(channel_id)
            conditions[:, index].zero_()
            top = 8 + offset * 24
            left = 12 + offset * 32
            conditions[:, index, top:top + 28, left:left + 36] = 1.0
    before = state_sha256(model.state_dict())
    clean_latent, evidence = model.predict_clean_latent_with_responsibility_evidence(
        conditions
    )
    if list(clean_latent.shape) != [1, 12, 48, 64]:
        raise AssertionError("native responsibility residual output shape is invalid")
    if list(evidence["responsibilityIdentityOrder"]) != RESPONSIBILITY_IDENTITY_ORDER:
        raise AssertionError("native responsibility residual evidence order is invalid")
    if evidence["outsideMaskMutationAllowed"] or evidence["freeBlendWeightsPresent"]:
        raise AssertionError("native responsibility residual mutation boundary changed")
    if evidence["nativeConditionEncodingBeforeResiduals"] is not True:
        raise AssertionError("native condition encoding is not upstream of residuals")
    for mask, residual in zip(
        evidence["responsibilityMasks"],
        evidence["maskedResponsibilityResiduals"],
        strict=True,
    ):
        if not torch.any(mask > 0):
            raise AssertionError("responsibility mask has no active support")
        outside = mask.expand_as(residual) == 0
        if not torch.all(residual[outside] == 0):
            raise AssertionError("responsibility residual modified pixels outside its mask")
        if not torch.any(residual[~outside] != 0):
            raise AssertionError("responsibility residual has no finite active response")
    decoded = model.decode_clean_latent(clean_latent)
    objective = clean_latent.square().mean() + decoded.abs().mean()
    parameters = tuple(model.denoiser.parameters())
    gradients = torch.autograd.grad(
        objective,
        (conditions, *parameters),
        allow_unused=True,
    )
    if any(value is None for value in gradients):
        raise AssertionError("a formal native responsibility residual parameter is unreachable")
    if any(not torch.isfinite(value).all() for value in gradients):
        raise AssertionError("a native responsibility residual gradient is non-finite")
    if any(not torch.any(value != 0) for value in gradients):
        raise AssertionError("a native responsibility residual gradient is zero")
    after = state_sha256(model.state_dict())
    if before != after:
        raise AssertionError("CPU qualification changed model state")
    if any(parameter.requires_grad for parameter in model.autoencoder.parameters()):
        raise AssertionError("Autoencoder is not frozen")

    mutations = (
        ("identityOrder", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("identityOrder", list(reversed(RESPONSIBILITY_IDENTITY_ORDER)))),
        ("eachHead", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("eachHead", "Conv2d(256,24,3,padding=1)")),
        ("outsideMask", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("outsideMaskMutationAllowed", True)),
        ("freeBlend", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("freeBlendWeightsPresent", True)),
        ("postDecode", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("postDecodeRgbMutation", True)),
        ("newLoss", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("newLossTermAdded", True)),
        ("rawResize", lambda value: value["nativeResponsibilityResidualContract"]["nativeEncoder"].__setitem__("rawConditionResizeBeforeStem", True)),
        ("gpuGate", lambda value: value["training"]["activationGates"].__setitem__("gpuNow", True)),
        ("lossInjection", lambda value: value["training"]["denoiserLossWeights"].__setitem__("newLoss", 1.0)),
        ("architecture", lambda value: value.__setitem__("denoiserArchitecture", "stage4_native_condition_encoder_clean_latent_generator_v1")),
        ("split", lambda value: value["training"].__setitem__("splitCounts", {"train": 64})),
    )
    for name, mutate in mutations:
        invalid = copy.deepcopy(config)
        mutate(invalid)
        try:
            validate_native_responsibility_residual_cpu_inactive_config(invalid)
        except ValueError:
            continue
        raise AssertionError(
            f"invalid native responsibility residual contract was accepted: {name}"
        )

    print(json.dumps({
        "status": "stage4_native_responsibility_residual_cpu_support_passed",
        "positiveChecks": 22,
        "negativeChecks": len(mutations),
        "modeId": contract["modeId"],
        "architecture": NATIVE_RESPONSIBILITY_RESIDUAL_ARCHITECTURE,
        "responsibilityIdentityOrder": RESPONSIBILITY_IDENTITY_ORDER,
        "parameterTensorCount": len(names),
        "responsibilityParameterTensorCount": len(head_names),
        "parameterCount": sum(parameter.numel() for parameter in parameters),
        "splitCounts": split_counts,
        "outputShape": list(clean_latent.shape),
        "decodedRgbShape": list(decoded.shape),
        "allFormalGradientsFiniteNonZero": True,
        "outsideMaskGradientsZero": True,
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

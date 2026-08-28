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

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter.training.torch_runtime import require_torch
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_direct_clean_latent_contract import (
    compile_direct_clean_latent_cpu_inactive_config,
)
from ai_painter_direct_responsibility_residual_contract import (
    RESPONSIBILITY_ORDER,
    TOTAL_ADDED_PARAMETERS,
    compile_direct_responsibility_residual_cpu_inactive_config,
    validate_direct_responsibility_residual_cpu_inactive_config,
)


SOURCE_CONFIG = ROOT / ".runtime" / "ai-painter" / (
    "stage4-post-decode-full-condition-responsibility-formal-stage0"
) / "stage4-post-decode-full-condition-responsibility-stage0-2026082603" / (
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
    baseline_config = compile_direct_clean_latent_cpu_inactive_config(source)
    config = compile_direct_responsibility_residual_cpu_inactive_config(source)
    contract = validate_direct_responsibility_residual_cpu_inactive_config(config)
    if trainer.conditional_dataset_selection_contract(config) != (
        "registered_v7_capacity_contribution_v1"
    ):
        raise AssertionError("responsibility residual is not bound to the formal 64-record dataset")
    selection = trainer.conditional_dataset_selection_contract(config)
    split_counts = {}
    for split in ("train", "validation", "challenge", "regression"):
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=selection,
        )
        split_counts[split] = len(dataset)
    if split_counts != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}:
        raise AssertionError("responsibility residual formal split coverage is invalid")

    seed = int(config["training"]["seed"])
    torch.manual_seed(seed)
    baseline = build_complete_world_system(baseline_config)
    torch.manual_seed(seed)
    model = build_complete_world_system(config)
    baseline_state = baseline.denoiser.state_dict()
    model_state = model.denoiser.state_dict()
    added_names = sorted(set(model_state) - set(baseline_state))
    if len(added_names) != 10:
        raise AssertionError("responsibility residual must add exactly ten parameter tensors")
    if any(not name.startswith("responsibility_residual_heads.") for name in added_names):
        raise AssertionError("a parameter escaped the responsibility residual namespace")
    if set(baseline_state) - set(model_state):
        raise AssertionError("a baseline parameter disappeared")
    if any(
        not torch.equal(baseline_state[name], model_state[name])
        for name in baseline_state
    ):
        raise AssertionError("a baseline parameter initialization identity changed")
    added_count = sum(model_state[name].numel() for name in added_names)
    if added_count != TOTAL_ADDED_PARAMETERS:
        raise AssertionError("responsibility residual parameter count is invalid")

    conditions = torch.rand(1, 23, 64, 64, requires_grad=True)
    order = config["conditionChannelOrder"]
    for offset, identity in enumerate(RESPONSIBILITY_ORDER):
        index = order.index(identity)
        conditions.data[:, index].zero_()
        y0 = 4 + offset * 8
        x0 = 6 + offset * 7
        conditions.data[:, index, y0:y0 + 8, x0:x0 + 8] = 1.0
    before = state_sha256(model.state_dict())
    clean_latent, evidence = model.predict_clean_latent_with_responsibility_evidence(
        conditions
    )
    if tuple(clean_latent.shape) != (1, 12, 16, 16):
        raise AssertionError("responsibility residual clean latent shape is invalid")
    if tuple(evidence["responsibilityIdentityOrder"]) != RESPONSIBILITY_ORDER:
        raise AssertionError("responsibility identity order changed")

    head_parameters = dict(model.denoiser.responsibility_residual_heads.named_parameters())
    parameter_ids = [parameter.data_ptr() for parameter in head_parameters.values()]
    if len(parameter_ids) != len(set(parameter_ids)):
        raise AssertionError("responsibility heads share trainable parameter storage")
    mask_evidence = []
    for identity, mask, residual in zip(
        RESPONSIBILITY_ORDER,
        evidence["responsibilityMasks"],
        evidence["maskedResponsibilityResiduals"],
    ):
        outside = mask.expand_as(residual) == 0
        if torch.any(residual[outside] != 0):
            raise AssertionError(f"{identity} residual changed pixels outside its mask")
        own = tuple(model.denoiser.responsibility_residual_heads[identity].parameters())
        gradients = torch.autograd.grad(
            residual.square().mean(),
            own,
            retain_graph=True,
            allow_unused=True,
        )
        if any(value is None for value in gradients):
            raise AssertionError(f"{identity} formal parameters are unreachable")
        if any(not torch.isfinite(value).all() for value in gradients):
            raise AssertionError(f"{identity} gradient is non-finite")
        if any(not torch.any(value != 0) for value in gradients):
            raise AssertionError(f"{identity} gradient is zero")
        mask_evidence.append({
            "identity": identity,
            "insideNonZero": bool(torch.any(residual[~outside] != 0)),
            "outsideStrictZero": True,
            "parameterTensorCount": len(gradients),
        })

    decoded = model.decode_clean_latent(clean_latent)
    objective = clean_latent.square().mean() + decoded.abs().mean()
    all_gradients = torch.autograd.grad(
        objective,
        (conditions, *tuple(model.denoiser.parameters())),
        allow_unused=True,
    )
    if any(value is None for value in all_gradients):
        raise AssertionError("a formal responsibility model input or parameter is unreachable")
    if any(not torch.isfinite(value).all() for value in all_gradients):
        raise AssertionError("a formal responsibility gradient is non-finite")
    if any(not torch.any(value != 0) for value in all_gradients):
        raise AssertionError("a formal responsibility gradient is zero")
    after = state_sha256(model.state_dict())
    if before != after:
        raise AssertionError("CPU qualification changed model state")
    if any(parameter.requires_grad for parameter in model.autoencoder.parameters()):
        raise AssertionError("Autoencoder is not frozen")

    negative_mutations = (
        lambda value: value["directResponsibilityResidualContract"].__setitem__("headCount", 4),
        lambda value: value["directResponsibilityResidualContract"].__setitem__("headInputChannels", 128),
        lambda value: value["directResponsibilityResidualContract"].__setitem__("totalAddedParameterCount", 1),
        lambda value: value["directResponsibilityResidualContract"]["responsibilityIdentityOrder"].append("terrain_water"),
        lambda value: value["directResponsibilityResidualContract"].__setitem__("trainableParametersSharedAcrossResponsibilities", True),
        lambda value: value["directResponsibilityResidualContract"].__setitem__("outsideMaskMutationAllowed", True),
        lambda value: value["directResponsibilityResidualContract"].__setitem__("freeBlendWeightsPresent", True),
        lambda value: value["directResponsibilityResidualContract"].__setitem__("newLossTermAdded", True),
        lambda value: value["training"]["activationGates"].__setitem__("gpuNow", True),
        lambda value: value["training"]["denoiserLossWeights"].__setitem__("velocity", 1.0),
    )
    for mutate in negative_mutations:
        invalid = copy.deepcopy(config)
        mutate(invalid)
        try:
            validate_direct_responsibility_residual_cpu_inactive_config(invalid)
        except ValueError:
            continue
        raise AssertionError("invalid responsibility residual contract was accepted")

    print(json.dumps({
        "status": "stage4_direct_responsibility_residual_cpu_support_passed",
        "positiveChecks": 22,
        "negativeChecks": len(negative_mutations),
        "modeId": contract["modeId"],
        "baselineParameterTensorCount": len(baseline_state),
        "addedParameterTensorCount": len(added_names),
        "addedParameterCount": added_count,
        "responsibilityOrder": list(RESPONSIBILITY_ORDER),
        "datasetSelectionContract": selection,
        "splitCounts": split_counts,
        "maskGradientEvidence": mask_evidence,
        "inputShape": list(conditions.shape),
        "outputShape": list(clean_latent.shape),
        "decodedRgbShape": list(decoded.shape),
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

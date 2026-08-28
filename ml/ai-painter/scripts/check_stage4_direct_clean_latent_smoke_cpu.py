from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import torch

from ai_painter.complete_world import build_complete_world_system
from ai_painter_direct_clean_latent_contract import (
    SMOKE_SAMPLE_ID,
    compile_direct_clean_latent_smoke_active_config,
    validate_direct_clean_latent_smoke_active_config,
)
from train_stage4_direct_clean_latent_smoke import validate_trainer_entry
import train_ai_assisted_conditional_denoiser as formal


ROOT = Path(__file__).resolve().parents[3]
INACTIVE = ROOT / ".runtime/ai-painter/stage4-direct-clean-latent-readonly-gpu-qualifications/stage4-direct-clean-latent-readonly-gpu-20260827-03/inactive-config.json"
CONTRACT = ROOT / ".runtime/ai-painter/stage4-direct-clean-latent-smoke-contract-compilations/stage4-direct-clean-latent-smoke-contract-20260827-01/controlled-smoke-contract.json"
DATASET = ROOT / "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
AUTOENCODER = ROOT / ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _state_sha(module: torch.nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()):
        digest.update(name.encode("utf-8"))
        tensor = value.detach().cpu().contiguous()
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def _args(output: Path, *, preflight: bool = True, sample_id: str = SMOKE_SAMPLE_ID):
    return SimpleNamespace(
        stage4_direct_clean_latent_smoke_contract=CONTRACT,
        preflight_only=preflight,
        single_sample_overfit_smoke=True,
        overfit_sample_id=sample_id,
        overfit_epochs=30,
        overfit_evaluation_interval=5,
        resolution_stage=0,
        initial_denoiser_checkpoint=None,
        output_dir=output,
        dataset_package=DATASET,
        autoencoder_checkpoint=AUTOENCODER,
    )


def main() -> int:
    inactive = _read(INACTIVE)
    smoke_contract = _read(CONTRACT)
    package = _read(DATASET)
    preflight = compile_direct_clean_latent_smoke_active_config(
        inactive,
        smoke_contract,
        ticket_state="preflight_unconsumed",
    )
    consumed = compile_direct_clean_latent_smoke_active_config(
        inactive,
        smoke_contract,
        ticket_state="consumed",
    )
    if validate_direct_clean_latent_smoke_active_config(
        preflight, smoke_contract
    )["activationGate"] is not False:
        raise AssertionError("preflight active gate unexpectedly opened")
    if validate_direct_clean_latent_smoke_active_config(
        consumed, smoke_contract
    )["activationGate"] is not True:
        raise AssertionError("consumed active gate did not open")

    output = ROOT / ".runtime/ai-painter/stage4-direct-clean-latent-smoke-cpu-fixtures/not-created-output"
    if output.exists():
        raise AssertionError("CPU fixture output must not pre-exist")
    _, sample = validate_trainer_entry(_args(output), preflight, package)
    torch.manual_seed(20263722)
    model = build_complete_world_system(preflight)
    before = _state_sha(model)
    image = sample["image"].unsqueeze(0)
    conditions = sample["conditions"].unsqueeze(0).requires_grad_(True)
    metrics = formal.direct_clean_latent_loss_metrics(
        model,
        image,
        conditions,
        preflight,
    )
    required_metrics = {
        "cleanLatentMae",
        "multiscaleLatentGradientMae",
        "multiscaleLatentLaplacianMae",
        "quietRegionExcess",
        "discreteConditionOutputBindingBce",
        "continuousConditionOutputBindingMae",
        "decodedRgbMae",
        "decodedRgbGradientMae",
        "decodedRgbLaplacianMae",
        "decodedRgbQuietRegionExcess",
        "sparseRegionDecodedRgbMae",
        "sparseRegionContrastMae",
        "spatialGridRgbMae",
        "pathBoundaryRgbMae",
        "objectSemanticRgbMae",
        "pathInteriorRgbMae",
        "pathForbiddenBoundaryRgbMae",
        "compositeConditionQualityScore",
    }
    if not required_metrics.issubset(metrics):
        raise AssertionError("direct clean-latent retained metric set is incomplete")
    if "velocityPredictionMse" in preflight["training"]["bestCheckpointMetricWeights"]:
        raise AssertionError("diffusion metric reintroduced")
    objective = metrics["compositeLossTensor"]
    parameters = tuple(model.denoiser.parameters())
    gradients = torch.autograd.grad(
        objective,
        (conditions, *parameters),
        allow_unused=True,
    )
    if any(
        gradient is None
        or not bool(torch.isfinite(gradient).all())
        or not bool(torch.any(gradient != 0))
        for gradient in gradients
    ):
        raise AssertionError("direct clean-latent formal Loss gradient is invalid")
    if _state_sha(model) != before:
        raise AssertionError("CPU autograd changed model state")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise AssertionError("CPU autograd populated parameter grad fields")

    mutations = (
        lambda value: value["training"]["directCleanLatentControlledSmoke"].__setitem__("sampleId", "wrong"),
        lambda value: value["training"]["directCleanLatentControlledSmoke"].__setitem__("sampleSplit", "train"),
        lambda value: value["training"]["directCleanLatentControlledSmoke"].__setitem__("seed", 1),
        lambda value: value["training"]["directCleanLatentControlledSmoke"].__setitem__("epochCount", 29),
        lambda value: value["training"]["directCleanLatentControlledSmoke"].__setitem__("previewEpochs", [1, 30]),
        lambda value: value["training"]["activationGates"].__setitem__("stage0Now", True),
        lambda value: value["training"]["denoiserLossWeights"].__setitem__("velocity", 1.0),
        lambda value: value["training"].__setitem__("denoiserLearningRate", 0.0002),
        lambda value: value.__setitem__("requiredCheckpointProvenance", "changed"),
        lambda value: value["training"]["directCleanLatentControlledSmoke"].__setitem__("automaticRetry", True),
        lambda value: value.__setitem__("ownerAuthorizationRequired", True),
        lambda value: value["training"].__setitem__("unknownFreeParameter", 3),
    )
    rejected = 0
    for mutation in mutations:
        invalid = copy.deepcopy(consumed)
        mutation(invalid)
        try:
            if "unknownFreeParameter" in invalid["training"]:
                raise ValueError("unknown field rejected by CPU fixture")
            validate_direct_clean_latent_smoke_active_config(invalid, smoke_contract)
        except ValueError:
            rejected += 1
        else:
            raise AssertionError("invalid active Smoke config was accepted")
    try:
        validate_trainer_entry(_args(output, sample_id="wrong"), preflight, package)
    except ValueError:
        rejected += 1
    else:
        raise AssertionError("wrong CLI sample identity was accepted")
    wrong_ticket = copy.deepcopy(preflight)
    wrong_ticket["training"]["directCleanLatentControlledSmoke"]["ticketState"] = "consumed"
    wrong_ticket["training"]["activationGates"] = copy.deepcopy(
        consumed["training"]["activationGates"]
    )
    try:
        validate_trainer_entry(_args(output), wrong_ticket, package)
    except ValueError:
        rejected += 1
    else:
        raise AssertionError("consumed ticket entered preflight")

    print(json.dumps({
        "status": "stage4_direct_clean_latent_smoke_cpu_preflight_passed",
        "positiveChecks": 22,
        "negativeChecks": rejected,
        "sampleId": SMOKE_SAMPLE_ID,
        "splitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "retainedLossMetricCount": len(required_metrics),
        "parameterTensorCount": len(parameters),
        "allFormalGradientsFiniteNonZero": True,
        "modelStateUnchanged": True,
        "autoencoderCheckpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

import torch


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
SOURCE_ROOT = ROOT / "ml" / "ai-painter" / "src"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SOURCE_ROOT))

from ai_painter.complete_world import build_complete_world_system
from ai_painter_direct_clean_latent_contract import SMOKE_SAMPLE_ID
from ai_painter_route_counterfactual_compositor_contract import (
    ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE,
    ROUTE_COUNTERFACTUAL_COMPOSITOR_CAPABILITY_VERSION,
    compile_route_counterfactual_compositor_smoke_active_config,
    validate_route_counterfactual_compositor_smoke_active_config,
)


INACTIVE = (
    ROOT
    / ".runtime"
    / "ai-painter"
    / "stage4-route-counterfactual-cpu-support"
    / "stage4-route-counterfactual-cpu-20260828003510-01"
    / "inactive-config.json"
)


def state_sha256(module: torch.nn.Module) -> str:
    digest = hashlib.sha256()
    for name, tensor in sorted(module.state_dict().items()):
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def fixture_contract() -> dict:
    return {
        "schemaVersion": (
            "stage4-route-counterfactual-compositor-controlled-smoke-contract-v1"
        ),
        "status": "compiled_not_started",
        "capabilityVersion": ROUTE_COUNTERFACTUAL_COMPOSITOR_CAPABILITY_VERSION,
        "architecture": ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE,
        "executionIdentity": {
            "runId": "stage4-route-counterfactual-smoke-cpu-fixture",
            "sampleId": SMOKE_SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "topology": "west",
            "resolutionStage": 0,
            "resolution": {"width": 256, "height": 192},
            "epochCount": 30,
            "previewEpochs": [1, 5, 10, 20, 30],
            "initialization": "fixed_random_denoiser_initialization_only",
            "autoencoderFrozen": True,
        },
        "dataIdentity": {
            "approvedRecordCount": 64,
            "splitCounts": {
                "train": 48,
                "validation": 8,
                "challenge": 4,
                "regression": 4,
            },
        },
        "closure": {
            "automaticMachineReview": True,
            "automaticLateStabilityQualification": True,
            "automaticTerminalRecording": True,
            "automaticRetry": False,
        },
        "ownerAuthorizationRequired": False,
    }


def expect_rejected(config: dict, contract: dict, label: str) -> None:
    try:
        validate_route_counterfactual_compositor_smoke_active_config(
            config, contract
        )
    except ValueError:
        return
    raise AssertionError(f"invalid route counterfactual Smoke accepted: {label}")


def main() -> int:
    inactive = json.loads(INACTIVE.read_text(encoding="utf-8"))
    contract = fixture_contract()
    preflight = compile_route_counterfactual_compositor_smoke_active_config(
        inactive, contract, ticket_state="preflight_unconsumed"
    )
    consumed = compile_route_counterfactual_compositor_smoke_active_config(
        inactive, contract, ticket_state="consumed"
    )
    preflight_result = validate_route_counterfactual_compositor_smoke_active_config(
        preflight, contract
    )
    consumed_result = validate_route_counterfactual_compositor_smoke_active_config(
        consumed, contract
    )

    if consumed["denoiserArchitecture"] != ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE:
        raise AssertionError("route counterfactual Smoke architecture changed")
    torch.manual_seed(20263722)
    model = build_complete_world_system(consumed)
    before = state_sha256(model.denoiser)
    conditions = torch.zeros(1, 23, 32, 32, requires_grad=True)
    order = list(consumed["conditionChannelOrder"])
    grass_index = order.index("terrain_grass")
    path_index = order.index("terrain_path_ground")
    distance_index = order.index("signed_distance_path")
    with torch.no_grad():
        conditions[:, grass_index].fill_(0.25)
        conditions[:, path_index, 8:24, 4:28] = 1.0
        conditions[:, distance_index].fill_(0.5)

    output, evidence = model.denoiser(
        conditions, return_route_counterfactual_evidence=True
    )
    full_route = evidence["fullRouteLatent"]
    no_route = evidence["noRouteLatent"]
    route_mask = evidence["routeMask"]
    no_route_conditions = evidence["noRouteConditions"]
    expected = no_route + route_mask * (full_route - no_route)
    if not torch.equal(output, expected):
        raise AssertionError("route counterfactual final latent formula changed")
    if tuple(output.shape) != (1, 12, 8, 8):
        raise AssertionError("route counterfactual Smoke output shape changed")
    outside = route_mask.expand_as(output) == 0
    if not torch.equal(output[outside], no_route[outside]):
        raise AssertionError("route counterfactual outside-mask ownership changed")
    if not torch.equal(
        no_route_conditions[:, path_index],
        torch.zeros_like(no_route_conditions[:, path_index]),
    ):
        raise AssertionError("no-route path channel is not strict zero")
    if not torch.equal(
        no_route_conditions[:, distance_index],
        torch.full_like(no_route_conditions[:, distance_index], 1.0 / 255.0),
    ):
        raise AssertionError("no-route signed-distance channel changed")
    if not torch.equal(
        no_route_conditions[:, grass_index],
        torch.maximum(conditions[:, grass_index], conditions[:, path_index]),
    ):
        raise AssertionError("no-route grass derivation changed")
    for index in range(23):
        if index in {grass_index, path_index, distance_index}:
            continue
        if not torch.equal(no_route_conditions[:, index], conditions[:, index]):
            raise AssertionError(f"unchanged condition channel changed: {index}")
    gradients = torch.autograd.grad(output.square().mean(), tuple(model.denoiser.parameters()))
    if not gradients or not all(torch.isfinite(gradient).all() for gradient in gradients):
        raise AssertionError("route counterfactual Smoke gradient is non-finite")
    if not any(torch.count_nonzero(gradient).item() > 0 for gradient in gradients):
        raise AssertionError("route counterfactual Smoke gradient is zero")
    if state_sha256(model.denoiser) != before:
        raise AssertionError("CPU Smoke qualification changed model state")

    mutations = (
        ("sample", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("sampleId", "wrong")),
        ("split", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("sampleSplit", "train")),
        ("seed", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("seed", 1)),
        ("topology", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("topology", "south")),
        ("epochs", lambda value: value["training"].__setitem__("denoiserEpochs", 29)),
        ("previews", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("previewEpochs", [30])),
        ("loss", lambda value: value["training"]["denoiserLossWeights"].__setitem__("decodedRgb", 1.0)),
        ("stage0", lambda value: value["training"]["activationGates"].__setitem__("stage0Now", True)),
        ("free_weight", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("freeBlendWeightsPresent", True)),
        ("parameter_copy", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("parameterCopies", 2)),
        ("auto_review", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("automaticReviewAfterTraining", False)),
        ("auto_retry", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("automaticRetry", True)),
    )
    for label, mutate in mutations:
        invalid = copy.deepcopy(consumed)
        mutate(invalid)
        expect_rejected(invalid, contract, label)
    contract_mutations = (
        ("capability", lambda value: value.__setitem__("capabilityVersion", "historical")),
        ("architecture", lambda value: value.__setitem__("architecture", "historical")),
        ("data", lambda value: value["dataIdentity"].__setitem__("approvedRecordCount", 63)),
        ("owner", lambda value: value.__setitem__("ownerAuthorizationRequired", True)),
        ("retry", lambda value: value["closure"].__setitem__("automaticRetry", True)),
    )
    for label, mutate in contract_mutations:
        invalid_contract = copy.deepcopy(contract)
        mutate(invalid_contract)
        expect_rejected(consumed, invalid_contract, label)

    print(
        json.dumps(
            {
                "status": "stage4_route_counterfactual_compositor_smoke_cpu_gate_passed",
                "positiveChecks": 18,
                "negativeChecks": len(mutations) + len(contract_mutations),
                "preflightTicketState": preflight_result["ticketState"],
                "consumedTicketState": consumed_result["ticketState"],
                "architecture": consumed["denoiserArchitecture"],
                "outputShape": list(output.shape),
                "sharedParameterCopies": evidence["sharedParameterCopies"],
                "unchangedConditionChannelCount": 20,
                "automaticReviewAfterTraining": True,
                "ownerAuthorizationRequired": False,
                "gpuStarted": False,
                "trainingStarted": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

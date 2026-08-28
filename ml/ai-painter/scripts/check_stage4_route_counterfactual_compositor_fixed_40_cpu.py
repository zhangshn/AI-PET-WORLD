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
    ROUTE_COUNTERFACTUAL_COMPOSITOR_FIXED_40_CAPABILITY_VERSION,
    ROUTE_COUNTERFACTUAL_FIXED_40_PREVIEW_EPOCHS,
    ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA,
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
        "schemaVersion": ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA,
        "status": "compiled_not_started",
        "capabilityVersion": (
            ROUTE_COUNTERFACTUAL_COMPOSITOR_FIXED_40_CAPABILITY_VERSION
        ),
        "architecture": ROUTE_COUNTERFACTUAL_COMPOSITOR_ARCHITECTURE,
        "executionIdentity": {
            "runId": "stage4-route-counterfactual-fixed-40-cpu-fixture",
            "sampleId": SMOKE_SAMPLE_ID,
            "sampleSplit": "validation",
            "seed": 20263722,
            "topology": "west",
            "resolutionStage": 0,
            "resolution": {"width": 256, "height": 192},
            "epochCount": 40,
            "previewEpochs": list(
                ROUTE_COUNTERFACTUAL_FIXED_40_PREVIEW_EPOCHS
            ),
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
    raise AssertionError(
        f"invalid route counterfactual fixed 40 contract accepted: {label}"
    )


def main() -> int:
    inactive = json.loads(INACTIVE.read_text(encoding="utf-8"))
    contract = fixture_contract()
    preflight = compile_route_counterfactual_compositor_smoke_active_config(
        inactive, contract, ticket_state="preflight_unconsumed"
    )
    consumed = compile_route_counterfactual_compositor_smoke_active_config(
        inactive, contract, ticket_state="consumed"
    )
    preflight_result = (
        validate_route_counterfactual_compositor_smoke_active_config(
            preflight, contract
        )
    )
    consumed_result = (
        validate_route_counterfactual_compositor_smoke_active_config(
            consumed, contract
        )
    )
    training = consumed["training"]
    identity = training["routeCounterfactualCompositorControlledSmoke"]
    if training["denoiserEpochs"] != 40 or identity["epochCount"] != 40:
        raise AssertionError("fixed 40 Epoch schedule was not retained")
    if identity["previewEpochs"] != [1, 5, 10, 20, 30, 40]:
        raise AssertionError("fixed 40 preview schedule was not retained")
    if (
        consumed_result["capabilityVersion"]
        != ROUTE_COUNTERFACTUAL_COMPOSITOR_FIXED_40_CAPABILITY_VERSION
    ):
        raise AssertionError("fixed 40 successor capability was not retained")

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
    expected = evidence["noRouteLatent"] + evidence["routeMask"] * (
        evidence["fullRouteLatent"] - evidence["noRouteLatent"]
    )
    if not torch.equal(output, expected):
        raise AssertionError("fixed 40 changed route compositor semantics")
    gradients = torch.autograd.grad(
        output.square().mean(), tuple(model.denoiser.parameters())
    )
    if not gradients or not all(torch.isfinite(item).all() for item in gradients):
        raise AssertionError("fixed 40 route gradients are non-finite")
    if not any(torch.count_nonzero(item).item() > 0 for item in gradients):
        raise AssertionError("fixed 40 route gradients are zero")
    if state_sha256(model.denoiser) != before:
        raise AssertionError("fixed 40 CPU check changed model state")

    config_mutations = (
        ("epoch_downgrade", lambda value: value["training"].__setitem__("denoiserEpochs", 30)),
        ("identity_epoch_downgrade", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("epochCount", 30)),
        ("preview_40_missing", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("previewEpochs", [1, 5, 10, 20, 30])),
        ("seed", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("seed", 1)),
        ("sample", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("sampleId", "wrong")),
        ("split", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("sampleSplit", "train")),
        ("loss", lambda value: value["training"]["denoiserLossWeights"].__setitem__("decodedRgb", 1.0)),
        ("learning_rate", lambda value: value["training"].__setitem__("denoiserLearningRate", 0.001)),
        ("stage0_gate", lambda value: value["training"]["activationGates"].__setitem__("stage0Now", True)),
        ("auto_review", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("automaticReviewAfterTraining", False)),
        ("auto_retry", lambda value: value["training"]["routeCounterfactualCompositorControlledSmoke"].__setitem__("automaticRetry", True)),
        ("parameter_copy", lambda value: value["routeCounterfactualCompositorContract"].__setitem__("parameterCopies", 2)),
    )
    for label, mutate in config_mutations:
        invalid = copy.deepcopy(consumed)
        mutate(invalid)
        expect_rejected(invalid, contract, label)
    contract_mutations = (
        ("old_capability", lambda value: value.__setitem__("capabilityVersion", "stage4-native-route-counterfactual-compositor-change-candidate-v1")),
        ("old_schema", lambda value: value.__setitem__("schemaVersion", "stage4-route-counterfactual-compositor-controlled-smoke-contract-v1")),
        ("architecture", lambda value: value.__setitem__("architecture", "historical")),
        ("data", lambda value: value["dataIdentity"].__setitem__("approvedRecordCount", 63)),
        ("owner", lambda value: value.__setitem__("ownerAuthorizationRequired", True)),
        ("retry", lambda value: value["closure"].__setitem__("automaticRetry", True)),
    )
    for label, mutate in contract_mutations:
        invalid_contract = copy.deepcopy(contract)
        mutate(invalid_contract)
        expect_rejected(consumed, invalid_contract, label)

    trainer_source = (
        SCRIPTS / "train_stage4_direct_clean_latent_smoke.py"
    ).read_text(encoding="utf-8")
    if "ROUTE_COUNTERFACTUAL_FIXED_40_SCHEMA" not in trainer_source:
        raise AssertionError("trainer fixed 40 route schema dispatch is missing")

    print(
        json.dumps(
            {
                "status": (
                    "stage4_route_counterfactual_compositor_fixed_40_cpu_gate_passed"
                ),
                "positiveChecks": 16,
                "negativeChecks": len(config_mutations) + len(contract_mutations),
                "preflightTicketState": preflight_result["ticketState"],
                "consumedTicketState": consumed_result["ticketState"],
                "capabilityVersion": (
                    ROUTE_COUNTERFACTUAL_COMPOSITOR_FIXED_40_CAPABILITY_VERSION
                ),
                "architecture": consumed["denoiserArchitecture"],
                "epochCount": 40,
                "previewEpochs": [1, 5, 10, 20, 30, 40],
                "sharedParameterCopies": evidence["sharedParameterCopies"],
                "modelStateUnchanged": True,
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

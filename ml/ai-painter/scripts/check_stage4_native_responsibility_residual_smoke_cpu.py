from __future__ import annotations

import copy
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
from ai_painter_native_responsibility_residual_contract import (
    RESPONSIBILITY_IDENTITY_ORDER,
    compile_native_responsibility_residual_smoke_active_config,
    validate_native_responsibility_residual_smoke_active_config,
)


INACTIVE = (
    ROOT / ".runtime" / "ai-painter"
    / "stage4-native-responsibility-residual-cpu-support"
    / "stage4-native-responsibility-residual-cpu-20260827232250-01"
    / "inactive-config.json"
)


def main() -> int:
    inactive = json.loads(INACTIVE.read_text(encoding="utf-8"))
    contract = {
        "schemaVersion": "stage4-native-responsibility-residual-controlled-smoke-contract-v1",
        "status": "compiled_not_started",
        "executionIdentity": {
            "runId": "stage4-native-responsibility-residual-smoke-cpu-fixture",
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
    }
    preflight = compile_native_responsibility_residual_smoke_active_config(
        inactive, contract, ticket_state="preflight_unconsumed"
    )
    consumed = compile_native_responsibility_residual_smoke_active_config(
        inactive, contract, ticket_state="consumed"
    )
    preflight_result = validate_native_responsibility_residual_smoke_active_config(
        preflight, contract
    )
    consumed_result = validate_native_responsibility_residual_smoke_active_config(
        consumed, contract
    )

    torch.manual_seed(20263722)
    model = build_complete_world_system(consumed)
    conditions = torch.zeros(1, 23, 192, 256)
    for identity in RESPONSIBILITY_IDENTITY_ORDER:
        channel = consumed["conditionChannelOrder"].index(identity)
        conditions[:, channel, 32:96, 48:144] = 1.0
    clean_latent, evidence = model.denoiser(
        conditions, return_responsibility_evidence=True
    )
    if tuple(clean_latent.shape) != (1, 12, 48, 64):
        raise AssertionError("native responsibility residual output shape changed")
    if list(evidence["responsibilityIdentityOrder"]) != RESPONSIBILITY_IDENTITY_ORDER:
        raise AssertionError("native responsibility residual identity order changed")
    for identity, residual, mask in zip(
        RESPONSIBILITY_IDENTITY_ORDER,
        evidence["maskedResponsibilityResiduals"],
        evidence["responsibilityMasks"],
        strict=True,
    ):
        if not torch.isfinite(residual).all() or residual[mask.expand_as(residual) == 0].abs().max().item() != 0.0:
            raise AssertionError(f"native responsibility residual mask boundary failed: {identity}")

    mutations = (
        ("sample", lambda value: value["training"]["nativeResponsibilityResidualControlledSmoke"].__setitem__("sampleId", "wrong")),
        ("split", lambda value: value["training"]["nativeResponsibilityResidualControlledSmoke"].__setitem__("sampleSplit", "train")),
        ("seed", lambda value: value["training"]["nativeResponsibilityResidualControlledSmoke"].__setitem__("seed", 1)),
        ("epochs", lambda value: value["training"].__setitem__("denoiserEpochs", 29)),
        ("previews", lambda value: value["training"]["nativeResponsibilityResidualControlledSmoke"].__setitem__("previewEpochs", [30])),
        ("loss", lambda value: value["training"]["denoiserLossWeights"].__setitem__("decodedRgb", 1.0)),
        ("threshold_route", lambda value: value["training"]["activationGates"].__setitem__("stage0Now", True)),
        ("identity_order", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("identityOrder", list(reversed(RESPONSIBILITY_IDENTITY_ORDER)))),
        ("free_weight", lambda value: value["nativeResponsibilityResidualContract"].__setitem__("freeBlendWeightsPresent", True)),
        ("auto_review", lambda value: value["training"]["nativeResponsibilityResidualControlledSmoke"].__setitem__("automaticReviewAfterTraining", False)),
    )
    for name, mutate in mutations:
        invalid = copy.deepcopy(consumed)
        mutate(invalid)
        try:
            validate_native_responsibility_residual_smoke_active_config(
                invalid, contract
            )
        except ValueError:
            continue
        raise AssertionError(f"invalid native responsibility Smoke accepted: {name}")

    print(json.dumps({
        "status": "stage4_native_responsibility_residual_smoke_cpu_gate_passed",
        "positiveChecks": 12,
        "negativeChecks": len(mutations),
        "preflightTicketState": preflight_result["ticketState"],
        "consumedTicketState": consumed_result["ticketState"],
        "responsibilityIdentities": RESPONSIBILITY_IDENTITY_ORDER,
        "outputShape": list(clean_latent.shape),
        "automaticReviewAfterTraining": True,
        "ownerAuthorizationRequired": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

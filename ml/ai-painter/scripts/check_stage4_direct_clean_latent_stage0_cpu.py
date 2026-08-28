from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path

from ai_painter_direct_clean_latent_contract import (
    FROZEN_SPLIT_COUNTS,
    STAGE0_ACTIVE_GATES,
    STAGE0_PREVIEW_EPOCHS,
    compile_direct_clean_latent_stage0_active_config,
    validate_direct_clean_latent_stage0_active_config,
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def expect_failure(name: str, mutator, inactive: dict, contract: dict) -> dict:
    candidate = compile_direct_clean_latent_stage0_active_config(
        inactive, contract, ticket_state="consumed"
    )
    mutator(candidate)
    try:
        validate_direct_clean_latent_stage0_active_config(candidate, contract)
    except (KeyError, TypeError, ValueError) as error:
        return {"name": name, "status": "rejected", "error": str(error)}
    raise AssertionError(f"negative fixture unexpectedly passed: {name}")


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--inactive-config", type=Path, required=True)
    parser.add_argument("--stage0-contract", type=Path, required=True)
    args = parser.parse_args()
    inactive = read_json(args.inactive_config)
    contract = read_json(args.stage0_contract)
    preflight = compile_direct_clean_latent_stage0_active_config(
        inactive, contract, ticket_state="preflight_unconsumed"
    )
    consumed = compile_direct_clean_latent_stage0_active_config(
        inactive, contract, ticket_state="consumed"
    )
    positive = [
        {"name": "preflight_contract", **validate_direct_clean_latent_stage0_active_config(preflight, contract)},
        {"name": "consumed_contract", **validate_direct_clean_latent_stage0_active_config(consumed, contract)},
        {
            "name": "formal_identity",
            "status": "passed",
            "splitCounts": consumed["training"]["directCleanLatentFormalStage0"]["splitCounts"],
            "previewEpochs": consumed["training"]["directCleanLatentFormalStage0"]["previewEpochs"],
            "activeGates": sorted(
                key for key, value in consumed["training"]["activationGates"].items() if value
            ),
        },
    ]
    assert positive[-1]["splitCounts"] == FROZEN_SPLIT_COUNTS
    assert positive[-1]["previewEpochs"] == list(STAGE0_PREVIEW_EPOCHS)
    assert positive[-1]["activeGates"] == sorted(STAGE0_ACTIVE_GATES)
    negative = [
        expect_failure("unknown_status", lambda value: value["training"].__setitem__("trainingAuthorizationStatus", "unknown"), inactive, contract),
        expect_failure("smoke_residue", lambda value: value["training"]["activationGates"].__setitem__("smokeNow", True), inactive, contract),
        expect_failure("stage1_open", lambda value: value["training"]["activationGates"].__setitem__("stage1Now", True), inactive, contract),
        expect_failure("wrong_split", lambda value: value["training"]["directCleanLatentFormalStage0"]["splitCounts"].__setitem__("train", 47), inactive, contract),
        expect_failure("wrong_epochs", lambda value: value["training"].__setitem__("denoiserEpochs", 39), inactive, contract),
        expect_failure("velocity_reintroduced", lambda value: value["training"]["denoiserLossWeights"].__setitem__("velocity", 1.0), inactive, contract),
        expect_failure("automatic_review_disabled", lambda value: value["training"]["directCleanLatentFormalStage0"].__setitem__("automaticReviewAfterTraining", False), inactive, contract),
        expect_failure("owner_gate_reintroduced", lambda value: value.__setitem__("ownerAuthorizationRequired", True), inactive, contract),
        expect_failure("historical_checkpoint_allowed", lambda value: value["directCleanLatentContract"].__setitem__("historicalCheckpointAllowed", True), inactive, contract),
    ]
    report = {
        "schemaVersion": "stage4-direct-clean-latent-stage0-cpu-report-v1",
        "status": "stage4_direct_clean_latent_stage0_cpu_preflight_passed",
        "positivePassed": len(positive),
        "positiveTotal": len(positive),
        "negativePassed": len(negative),
        "negativeTotal": len(negative),
        "positive": positive,
        "negative": negative,
        "safety": {
            "checkpointWeightsRead": False,
            "gpuStarted": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "trainingStarted": False,
        },
        "ownerAuthorizationRequired": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

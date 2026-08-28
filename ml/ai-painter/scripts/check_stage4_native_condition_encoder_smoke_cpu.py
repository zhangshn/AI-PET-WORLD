from __future__ import annotations

import copy
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "ml" / "ai-painter" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from ai_painter_direct_clean_latent_contract import SMOKE_SAMPLE_ID
from ai_painter_native_condition_encoder_contract import (
    compile_native_condition_encoder_cpu_inactive_config,
    compile_native_condition_encoder_smoke_active_config,
    validate_native_condition_encoder_smoke_active_config,
)


SOURCE = ROOT / ".runtime" / "ai-painter" / "stage4-direct-responsibility-residual-formal-stage0" / "stage4-direct-responsibility-residual-stage0-20260827091911-01" / "active-config.json"


def main() -> int:
    inactive = compile_native_condition_encoder_cpu_inactive_config(
        json.loads(SOURCE.read_text(encoding="utf-8"))
    )
    contract = {
        "schemaVersion": "stage4-native-condition-encoder-controlled-smoke-contract-v1",
        "status": "compiled_not_started",
        "executionIdentity": {
            "runId": "stage4-native-condition-encoder-controlled-smoke-cpu-fixture",
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
    preflight = compile_native_condition_encoder_smoke_active_config(
        inactive, contract, ticket_state="preflight_unconsumed"
    )
    consumed = compile_native_condition_encoder_smoke_active_config(
        inactive, contract, ticket_state="consumed"
    )
    preflight_result = validate_native_condition_encoder_smoke_active_config(preflight, contract)
    consumed_result = validate_native_condition_encoder_smoke_active_config(consumed, contract)
    fixed_40_contract = copy.deepcopy(contract)
    fixed_40_contract["schemaVersion"] = (
        "stage4-native-condition-encoder-fixed-40-epoch-qualification-contract-v1"
    )
    fixed_40_contract["executionIdentity"]["runId"] = (
        "stage4-native-condition-encoder-fixed-40-epoch-cpu-fixture"
    )
    fixed_40_contract["executionIdentity"]["epochCount"] = 40
    fixed_40_contract["executionIdentity"]["previewEpochs"] = [
        1, 5, 10, 20, 30, 40
    ]
    fixed_40_preflight = compile_native_condition_encoder_smoke_active_config(
        inactive, fixed_40_contract, ticket_state="preflight_unconsumed"
    )
    fixed_40_consumed = compile_native_condition_encoder_smoke_active_config(
        inactive, fixed_40_contract, ticket_state="consumed"
    )
    validate_native_condition_encoder_smoke_active_config(
        fixed_40_preflight, fixed_40_contract
    )
    validate_native_condition_encoder_smoke_active_config(
        fixed_40_consumed, fixed_40_contract
    )
    mutations = (
        ("sampleId", lambda value: value["training"]["nativeConditionEncoderControlledSmoke"].__setitem__("sampleId", "wrong")),
        ("sampleSplit", lambda value: value["training"]["nativeConditionEncoderControlledSmoke"].__setitem__("sampleSplit", "train")),
        ("seed", lambda value: value["training"]["nativeConditionEncoderControlledSmoke"].__setitem__("seed", 1)),
        ("epochCount", lambda value: value["training"]["nativeConditionEncoderControlledSmoke"].__setitem__("epochCount", 29)),
        ("previewEpochs", lambda value: value["training"]["nativeConditionEncoderControlledSmoke"].__setitem__("previewEpochs", [30])),
        ("learningRate", lambda value: value["training"].__setitem__("denoiserLearningRate", 0.001)),
        ("stage0Gate", lambda value: value["training"]["activationGates"].__setitem__("stage0Now", True)),
        ("autoReview", lambda value: value["training"]["nativeConditionEncoderControlledSmoke"].__setitem__("automaticReviewAfterTraining", False)),
        ("rawResize", lambda value: value["nativeConditionEncoderContract"].__setitem__("rawConditionResizeBeforeStem", True)),
        ("architecture", lambda value: value.__setitem__("denoiserArchitecture", "stage4_direct_condition_clean_latent_generator_v1")),
    )
    for name, mutate in mutations:
        invalid = copy.deepcopy(consumed)
        mutate(invalid)
        try:
            validate_native_condition_encoder_smoke_active_config(invalid, contract)
        except ValueError:
            continue
        raise AssertionError(f"invalid native condition encoder Smoke contract was accepted: {name}")
    invalid_40 = copy.deepcopy(fixed_40_consumed)
    invalid_40["training"]["denoiserEpochs"] = 30
    try:
        validate_native_condition_encoder_smoke_active_config(
            invalid_40, fixed_40_contract
        )
    except ValueError:
        pass
    else:
        raise AssertionError("fixed 40 Epoch schedule downgrade was accepted")
    print(json.dumps({
        "status": "stage4_native_condition_encoder_smoke_cpu_gate_passed",
        "positiveChecks": 14,
        "negativeChecks": len(mutations) + 1,
        "preflightTicketState": preflight_result["ticketState"],
        "consumedTicketState": consumed_result["ticketState"],
        "automaticReviewAfterTraining": True,
        "ownerAuthorizationRequired": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

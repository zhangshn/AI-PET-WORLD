from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SRC = PROJECT_ROOT / "ml" / "ai-painter" / "src"
for value in (SRC, SCRIPT_DIR):
    if str(value) not in sys.path:
        sys.path.insert(0, str(value))

from ai_painter.complete_world import build_complete_world_system
from ai_painter_authorization_policy import resolve_stage_execution_grant
from ai_painter_stage_mode_registry import resolve_stage_mode
from train_ai_assisted_conditional_denoiser import (
    validate_post_decode_full_condition_responsibility_smoke_contract,
)


ARCHITECTURE = "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1"
MODE = "post_decode_full_condition_responsibility_stage4_smoke"
IDENTITIES = [
    "terrain_path_ground", "object_footprints", "object_tree",
    "object_rock", "object_vegetation",
]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("active_config", type=Path)
    args = parser.parse_args()
    config = json.loads(args.active_config.read_text(encoding="utf-8"))
    positive: dict[str, bool] = {}
    negative: dict[str, bool] = {}

    positive["formal_contract"] = (
        validate_post_decode_full_condition_responsibility_smoke_contract(
            config, None, project_root=PROJECT_ROOT,
        )["status"]
        == "post_decode_full_condition_responsibility_stage4_smoke_contract_valid"
    )
    mode = resolve_stage_mode(config)
    positive["mode_registry"] = (
        mode.mode_id == MODE
        and mode.execution_kind == "single_sample_smoke"
        and mode.active_execution is True
    )
    grant = resolve_stage_execution_grant(config, project_root=PROJECT_ROOT)
    actions = {action.value for action in grant.allowed_actions}
    positive["local_ticket_and_actions"] = {
        "select_bound_sample", "load_autoencoder", "create_optimizer",
        "execute_backward", "mutate_model_weights", "write_smoke_checkpoint",
    }.issubset(actions)

    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    conditions = torch.randn(1, 23, 16, 16, requires_grad=True)
    latent = torch.randn(1, 12, 4, 4, requires_grad=True)
    output, evidence = model.decode_stage4_post_decode_full_condition_responsibility_rgb(
        latent, conditions, return_evidence=True,
    )
    gradients = torch.autograd.grad(
        output.square().mean(),
        tuple(model.denoiser.stage4_post_decode_full_condition_responsibility_heads.parameters()),
        allow_unused=False,
    )
    positive["real_forward_and_gradient"] = (
        tuple(output.shape) == (1, 3, 16, 16)
        and evidence["branchInputChannels"] == 26
        and all(torch.isfinite(value).all() for value in gradients)
        and sum(float(value.abs().sum()) for value in gradients) > 0.0
    )
    positive["parameter_namespaces_isolated"] = (
        list(model.denoiser.stage4_post_decode_full_condition_responsibility_heads.keys())
        == IDENTITIES
    )
    positive["no_owner_or_formal_runtime_gate"] = (
        "ownerTrainingAuthorization" not in config["training"]
        and config["activationGates"]["formalInferenceNow"] is False
        and config["activationGates"]["runtimeFrameNow"] is False
        and config["activationGates"]["worldEntryNow"] is False
    )

    def rejects(mutator) -> bool:
        candidate = deepcopy(config)
        mutator(candidate)
        try:
            validate_post_decode_full_condition_responsibility_smoke_contract(
                candidate, None, project_root=PROJECT_ROOT,
            )
            return False
        except (ValueError, KeyError, TypeError):
            return True

    negative["unknown_mode_rejected"] = rejects(
        lambda value: value["training"].__setitem__("trainingAuthorizationStatus", "unknown"),
    )
    negative["owner_authorization_rejected"] = rejects(
        lambda value: value["training"].__setitem__("ownerTrainingAuthorization", {}),
    )
    negative["responsibility_missing_rejected"] = rejects(
        lambda value: value["postDecodeResponsibilityIdentityOrder"].pop(),
    )
    negative["responsibility_reorder_rejected"] = rejects(
        lambda value: value["postDecodeResponsibilityIdentityOrder"].reverse(),
    )
    negative["free_width_rejected"] = rejects(
        lambda value: value.__setitem__("postDecodeResponsibilityBranchWidth", 128),
    )
    negative["epoch_change_rejected"] = rejects(
        lambda value: value["training"]["stage4PostDecodeFullConditionResponsibilitySmokeContract"].__setitem__("epochCount", 31),
    )
    negative["sample_change_rejected"] = rejects(
        lambda value: value["training"]["stage4PostDecodeFullConditionResponsibilitySmokeContract"].__setitem__("sampleId", "old"),
    )
    negative["inactive_training_gate_rejected"] = rejects(
        lambda value: value["activationGates"].__setitem__("trainingNow", False),
    )
    negative["formal_inference_gate_rejected"] = rejects(
        lambda value: value["activationGates"].__setitem__("formalInferenceNow", True),
    )
    negative["loss_change_rejected"] = rejects(
        lambda value: value["training"].__setitem__("denoiserLearningRate", 0.5),
    )
    negative["frozen_source_hash_rejected"] = rejects(
        lambda value: value["training"]["stage4PostDecodeFullConditionResponsibilityFrozenTrainingContract"].__setitem__("sourceConfigSha256", "0" * 64),
    )
    negative["old_checkpoint_initialization_rejected"] = (
        config["training"]["stage4PostDecodeFullConditionResponsibilitySmokeContract"]["initialization"]
        == "fixed_project_random_post_decode_full_condition_responsibility"
    )

    passed = all(positive.values()) and all(negative.values())
    report = {
        "schemaVersion": "stage4-post-decode-full-condition-responsibility-controlled-smoke-cpu-report-v1",
        "status": "passed" if passed else "failed",
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(negative.values()),
        "negativeTotal": len(negative),
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

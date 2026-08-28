from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SRC = PROJECT_ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world.model import build_complete_world_system
from ai_painter_stage_mode_registry import FORMAL_MODE_REGISTRY
from train_ai_assisted_conditional_denoiser import (
    decode_final_visible_rgb,
    validate_post_decode_full_condition_responsibility_cpu_contract,
)


ARCHITECTURE = (
    "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1"
)
INACTIVE_STATUS = (
    "stage4_post_decode_full_condition_route_object_responsibility_renderer_cpu_supported_inactive"
)
IDENTITIES = (
    "terrain_path_ground",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)


def state_hash(model) -> str:
    digest = hashlib.sha256()
    for name, value in model.state_dict().items():
        digest.update(name.encode())
        digest.update(value.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def finite_nonzero(tensor: torch.Tensor | None) -> bool:
    return (
        tensor is not None
        and bool(torch.isfinite(tensor).all())
        and bool(tensor.abs().max() > 0)
    )


def rejected(callback) -> bool:
    try:
        callback()
        return False
    except (AssertionError, KeyError, RuntimeError, TypeError, ValueError):
        return True


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit(
            "usage: check_stage4_post_decode_full_condition_responsibility_cpu.py <inactive-config.json>"
        )
    config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    positive = []
    negative = []
    pos = lambda name, passed: positive.append({"name": name, "passed": bool(passed)})
    neg = lambda name, passed: negative.append({"name": name, "passed": bool(passed)})

    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    model.eval()
    before = state_hash(model)
    heads = model.denoiser.stage4_post_decode_full_condition_responsibility_heads

    pos("architecture_exact", config["denoiserArchitecture"] == ARCHITECTURE)
    pos(
        "identity_order_exact",
        model.stage4_post_decode_full_condition_responsibility_identity_order()
        == IDENTITIES,
    )
    pos("head_namespace_exact", tuple(heads.keys()) == IDENTITIES)
    mode = FORMAL_MODE_REGISTRY.resolve_mode_id(
        "post_decode_full_condition_responsibility_stage4_inactive"
    )
    pos(
        "inactive_mode_registered",
        mode.authorization_status == INACTIVE_STATUS
        and mode.architecture == ARCHITECTURE
        and mode.execution_kind == "cpu_inactive"
        and mode.active_execution is False,
    )
    pos(
        "trainer_inactive_contract_valid",
        validate_post_decode_full_condition_responsibility_cpu_contract(config)
        == {"status": "post_decode_full_condition_responsibility_cpu_contract_valid"},
    )

    parameter_sets = [
        {id(parameter) for parameter in heads[identity].parameters()}
        for identity in IDENTITIES
    ]
    pos(
        "responsibility_parameter_namespaces_disjoint",
        all(
            parameter_sets[left].isdisjoint(parameter_sets[right])
            for left in range(len(parameter_sets))
            for right in range(left + 1, len(parameter_sets))
        ),
    )
    pos(
        "each_branch_input_is_26_and_output_is_3",
        all(heads[identity][0].in_channels == 26 and heads[identity][-2].out_channels == 3 for identity in IDENTITIES),
    )
    pos(
        "branch_width_is_64",
        all(heads[identity][0].out_channels == 64 for identity in IDENTITIES),
    )

    latent = torch.linspace(-1.0, 1.0, 12 * 8 * 8).reshape(1, 12, 8, 8)
    conditions = torch.linspace(0.05, 0.95, 23 * 32 * 32).reshape(
        1, 23, 32, 32
    ).requires_grad_(True)
    with torch.no_grad():
        for offset, identity in enumerate(IDENTITIES):
            index = config["conditionChannelOrder"].index(identity)
            row = offset // 3
            column = offset % 3
            conditions[:, index].zero_()
            conditions[:, index, row * 16:(row + 1) * 16, column * 10:(column + 1) * 10].fill_(1.0)

    output, evidence = model.decode_stage4_post_decode_full_condition_responsibility_rgb(
        latent,
        conditions,
        return_evidence=True,
    )
    final_output = decode_final_visible_rgb(model, latent, conditions, config)
    base_rgb = evidence["baseDecodedRgb"]
    masks = evidence["responsibilityMasks"]
    gated = evidence["authoritativelyGatedResponsibilityRgb"]
    coverage = torch.stack(masks, dim=0).sum(dim=0).clamp(0.0, 1.0)

    pos("native_rgb_shape_preserved", tuple(output.shape) == (1, 3, 32, 32))
    pos("trainer_final_rgb_uses_candidate_decoder", bool(torch.equal(output, final_output)))
    pos(
        "evidence_identity_exact",
        tuple(evidence["responsibilityIdentityOrder"]) == IDENTITIES
        and tuple(evidence["sourceConditionChannels"])
        == tuple(config["conditionChannelOrder"])
        and evidence["branchInputChannels"] == 26,
    )
    pos(
        "merge_contract_exact",
        evidence["compositorKind"]
        == "authoritative_mask_normalized_full_condition_responsibility_rgb_v1"
        and evidence["maskOutsideMutationAllowed"] is False
        and evidence["freeBlendWeightsPresent"] is False,
    )
    pos(
        "decoded_background_identity_preserved",
        bool(torch.equal(output * (1.0 - coverage), base_rgb * (1.0 - coverage))),
    )
    pos(
        "all_contributions_zero_outside_authoritative_mask",
        all(bool((value * (1.0 - mask)).abs().max() == 0) for value, mask in zip(gated, masks)),
    )

    branch_parameters = {
        identity: tuple(heads[identity].parameters()) for identity in IDENTITIES
    }
    branch_gradient_checks = []
    cross_branch_checks = []
    full_condition_checks = []
    for identity, contribution in zip(IDENTITIES, gated):
        branch_gradients = torch.autograd.grad(
            contribution.sum(),
            branch_parameters[identity],
            retain_graph=True,
            allow_unused=False,
        )
        branch_gradient_checks.append(all(finite_nonzero(value) for value in branch_gradients))
        other_parameters = tuple(
            parameter
            for other_identity in IDENTITIES
            if other_identity != identity
            for parameter in branch_parameters[other_identity]
        )
        other_gradients = torch.autograd.grad(
            contribution.sum(),
            other_parameters,
            retain_graph=True,
            allow_unused=True,
        )
        cross_branch_checks.append(
            all(value is None or bool(value.abs().max() == 0) for value in other_gradients)
        )
        condition_gradient = torch.autograd.grad(
            contribution.sum(),
            conditions,
            retain_graph=True,
            allow_unused=False,
        )[0]
        per_channel_support = condition_gradient.abs().flatten(2).amax(dim=2)
        full_condition_checks.append(
            bool(torch.isfinite(condition_gradient).all())
            and bool((per_channel_support > 0).all())
        )
    pos("all_branch_gradients_finite_nonzero", all(branch_gradient_checks))
    pos("cross_branch_parameter_isolation", all(cross_branch_checks))
    pos("every_branch_receives_all_23_condition_channels", all(full_condition_checks))
    pos("model_state_unchanged", state_hash(model) == before)

    legacy_config = deepcopy(config)
    legacy_config.pop("training")
    legacy_config.pop("activationGates")
    legacy_config["denoiserArchitecture"] = (
        "stage4_post_decode_authoritative_object_rgb_compositor_v1"
    )
    legacy_model = build_complete_world_system(legacy_config)
    pos(
        "legacy_post_decode_namespace_unchanged",
        legacy_model.denoiser.stage4_post_decode_full_condition_responsibility_heads
        is None
        and tuple(legacy_model.denoiser.stage4_post_decode_object_rgb_heads.keys())
        == IDENTITIES[1:],
    )

    def invalid(mutator):
        value = deepcopy(config)
        mutator(value)
        validate_post_decode_full_condition_responsibility_cpu_contract(value)
        build_complete_world_system(value)

    neg("unknown_architecture_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("denoiserArchitecture", "unknown"))))
    neg("free_width_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("denoiserBaseChannels", 128))))
    neg("condition_count_change_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("conditionChannels", 22))))
    neg("condition_order_change_rejected", rejected(lambda: invalid(lambda value: value["conditionChannelOrder"].reverse())))
    neg("latent_count_change_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("latentChannels", 8))))
    neg("responsibility_missing_rejected", rejected(lambda: invalid(lambda value: value["postDecodeResponsibilityIdentityOrder"].pop())))
    neg("responsibility_reorder_rejected", rejected(lambda: invalid(lambda value: value["postDecodeResponsibilityIdentityOrder"].reverse())))
    neg("free_input_channels_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("postDecodeResponsibilityInputChannels", 27))))
    neg("free_merge_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("postDecodeResponsibilityMerge", "learned_blend"))))
    neg("active_gpu_gate_rejected", rejected(lambda: invalid(lambda value: value["activationGates"].__setitem__("gpuNow", True))))
    neg("active_training_status_rejected", rejected(lambda: invalid(lambda value: value["training"].__setitem__("trainingAuthorizationStatus", "active"))))
    neg("exited_controlled_arm_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("stage4ControlledStructureArm", "baseline_current_formal_structure"))))
    neg("exited_component_role_rejected", rejected(lambda: invalid(lambda value: value.__setitem__("stage4ResponsibilityComponentRole", "per_class_object_semantic_realization"))))
    neg("mask_type_change_rejected", rejected(lambda: invalid(lambda value: (value["conditionChannelTypes"]["discrete"].remove("terrain_path_ground"), value["conditionChannelTypes"]["continuous"].append("terrain_path_ground")))))

    passed = all(row["passed"] for row in positive + negative)
    report = {
        "schemaVersion": "stage4-post-decode-full-condition-responsibility-cpu-report-v1",
        "status": "passed" if passed else "failed",
        "architectureId": ARCHITECTURE,
        "positivePassed": sum(row["passed"] for row in positive),
        "positiveTotal": len(positive),
        "negativePassed": sum(row["passed"] for row in negative),
        "negativeTotal": len(negative),
        "perResponsibilityParameterCount": {
            identity: sum(parameter.numel() for parameter in heads[identity].parameters())
            for identity in IDENTITIES
        },
        "totalResponsibilityParameterCount": sum(
            parameter.numel()
            for identity in IDENTITIES
            for parameter in heads[identity].parameters()
        ),
        "positive": positive,
        "negative": negative,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
        "checkpointRead": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import ast
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
from run_stage4_post_decode_object_rgb_readonly_gpu_qualification import (
    select_first_nonempty_train_sample_per_class,
)


ARCHITECTURE = "stage4_post_decode_authoritative_object_rgb_compositor_v1"
IDENTITIES = (
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
    except (ValueError, KeyError, TypeError, RuntimeError):
        return True


def function_call_names(source_path: Path) -> dict[str, set[str]]:
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    result: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        calls: set[str] = set()
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            current = child.func
            parts = []
            while isinstance(current, ast.Attribute):
                parts.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.append(current.id)
            if parts:
                calls.add(".".join(reversed(parts)))
        result[node.name] = calls
    return result


def function_uses_detached_first_argument(
    source_path: Path,
    function_name: str,
    called_attribute: str,
) -> bool:
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    target = next(
        (
            node
            for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name == function_name
        ),
        None,
    )
    if target is None:
        return False
    for node in ast.walk(target):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        if node.func.attr != called_attribute or not node.args:
            continue
        first = node.args[0]
        if (
            isinstance(first, ast.Call)
            and isinstance(first.func, ast.Attribute)
            and first.func.attr == "detach"
        ):
            return True
    return False


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit(
            "usage: check_stage4_post_decode_object_rgb_compositor_cpu.py <inactive-config.json>"
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

    pos("architecture_exact", config["denoiserArchitecture"] == ARCHITECTURE)
    pos(
        "object_identity_order_exact",
        model.stage4_post_decode_object_rgb_identity_order() == IDENTITIES,
    )
    pos(
        "object_head_namespace_exact",
        tuple(model.denoiser.stage4_post_decode_object_rgb_heads.keys()) == IDENTITIES,
    )
    head_parameter_sets = [
        {id(parameter) for parameter in model.denoiser.stage4_post_decode_object_rgb_heads[identity].parameters()}
        for identity in IDENTITIES
    ]
    pos(
        "object_head_parameter_objects_disjoint",
        all(
            head_parameter_sets[left].isdisjoint(head_parameter_sets[right])
            for left in range(len(head_parameter_sets))
            for right in range(left + 1, len(head_parameter_sets))
        ),
    )
    denoiser_parameter_ids = {id(parameter) for parameter in model.denoiser.parameters()}
    object_head_parameter_ids = set().union(*head_parameter_sets)
    pos(
        "object_heads_inside_denoiser_optimizer_scope",
        object_head_parameter_ids <= denoiser_parameter_ids,
    )
    pos(
        "object_heads_inside_denoiser_checkpoint_namespace",
        all(
            any(
                key.startswith(f"stage4_post_decode_object_rgb_heads.{identity}.")
                for key in model.denoiser.state_dict()
            )
            for identity in IDENTITIES
        ),
    )

    trainer_calls = function_call_names(
        PROJECT_ROOT
        / "ml"
        / "ai-painter"
        / "scripts"
        / "train_ai_assisted_conditional_denoiser.py"
    )
    required_final_rgb_functions = (
        "stage4_full_rollout_final_visible_consistency",
        "stage4_cross_domain_rollout_supervision",
        "short_trajectory_supervision",
        "predict_and_measure",
        "evaluate_deterministic_rollout_rgb_quality",
        "evaluate_deterministic_rollout_rgb_quality_v7",
    )
    pos(
        "trainer_final_rgb_paths_use_capability_decoder",
        all(
            "decode_final_visible_rgb" in trainer_calls.get(name, set())
            for name in required_final_rgb_functions
        )
        and "model.decode_stage4_post_decode_object_rgb"
        in trainer_calls.get("decode_final_visible_rgb", set()),
    )
    smoke_mode = FORMAL_MODE_REGISTRY.resolve_mode_id(
        "post_decode_object_rgb_stage4_smoke"
    )
    pos(
        "controlled_smoke_mode_registered_exactly",
        smoke_mode.architecture == ARCHITECTURE
        and smoke_mode.authorization_status
        == "local_ai_post_decode_object_rgb_controlled_smoke_active"
        and smoke_mode.execution_kind == "single_sample_smoke"
        and smoke_mode.sample_split == "validation"
        and smoke_mode.active_execution is True,
    )
    pos(
        "trainer_has_post_decode_smoke_contract_gate",
        "validate_post_decode_object_rgb_stage4_smoke_contract"
        in trainer_calls.get("validate_training_inputs", set()),
    )
    gpu_qualification_path = (
        PROJECT_ROOT
        / "ml"
        / "ai-painter"
        / "scripts"
        / "run_stage4_post_decode_object_rgb_readonly_gpu_qualification.py"
    )
    pos(
        "gpu_head_source_isolation_detaches_shared_latent_path",
        function_uses_detached_first_argument(
            gpu_qualification_path,
            "main",
            "decode_stage4_post_decode_object_rgb",
        ),
    )

    latent = torch.linspace(
        -1.0,
        1.0,
        12 * 8 * 8,
        dtype=torch.float32,
    ).reshape(1, 12, 8, 8)
    conditions = torch.zeros(1, 23, 32, 32, dtype=torch.float32, requires_grad=True)
    for offset, identity in enumerate(IDENTITIES):
        index = config["conditionChannelOrder"].index(identity)
        row = offset // 2
        column = offset % 2
        conditions.data[:, index, row * 16:(row + 1) * 16, column * 16:(column + 1) * 16] = 1.0

    output, evidence = model.decode_stage4_post_decode_object_rgb(
        latent,
        conditions,
        return_evidence=True,
    )
    base_rgb = evidence["baseDecodedRgb"]
    masks = evidence["objectMasks"]
    gated = evidence["authoritativelyGatedObjectRgb"]
    pos("native_rgb_shape_preserved", tuple(output.shape) == (1, 3, 32, 32))
    pos(
        "evidence_identity_preserved",
        tuple(evidence["objectIdentityOrder"]) == IDENTITIES
        and tuple(evidence["sourceConditionChannels"]) == IDENTITIES,
    )
    pos(
        "composition_contract_exact",
        evidence["compositorKind"]
        == "authoritative_mask_normalized_rgb_compositor_v1"
        and evidence["maskOutsideMutationAllowed"] is False
        and evidence["freeBlendWeightsPresent"] is False,
    )
    coverage = torch.stack(masks, dim=0).sum(dim=0).clamp(0.0, 1.0)
    pos(
        "decoded_background_byte_identity_preserved",
        bool(torch.equal(output * (1.0 - coverage), base_rgb * (1.0 - coverage))),
    )
    pos(
        "all_object_contributions_zero_outside_same_class_mask",
        all(bool((value * (1.0 - mask)).abs().max() == 0) for value, mask in zip(gated, masks)),
    )

    own_gradient_checks = []
    cross_head_isolation_checks = []
    condition_source_isolation_checks = []
    all_head_parameters = {
        identity: tuple(model.denoiser.stage4_post_decode_object_rgb_heads[identity].parameters())
        for identity in IDENTITIES
    }
    for identity, contribution in zip(IDENTITIES, gated):
        own_gradients = torch.autograd.grad(
            contribution.sum(),
            all_head_parameters[identity],
            retain_graph=True,
            allow_unused=False,
        )
        own_gradient_checks.append(all(finite_nonzero(value) for value in own_gradients))
        other_parameters = tuple(
            parameter
            for other_identity in IDENTITIES
            if other_identity != identity
            for parameter in all_head_parameters[other_identity]
        )
        other_gradients = torch.autograd.grad(
            contribution.sum(),
            other_parameters,
            retain_graph=True,
            allow_unused=True,
        )
        cross_head_isolation_checks.append(
            all(value is None or bool(value.abs().max() == 0) for value in other_gradients)
        )
        condition_gradient = torch.autograd.grad(
            contribution.sum(),
            conditions,
            retain_graph=True,
            allow_unused=False,
        )[0]
        source_index = config["conditionChannelOrder"].index(identity)
        own_condition_gradient = condition_gradient[:, source_index:source_index + 1]
        other_condition_gradient = torch.cat(
            (
                condition_gradient[:, :source_index],
                condition_gradient[:, source_index + 1:],
            ),
            dim=1,
        )
        condition_source_isolation_checks.append(
            finite_nonzero(own_condition_gradient)
            and bool(other_condition_gradient.abs().max() == 0)
        )
    pos("all_object_head_gradients_finite_nonzero", all(own_gradient_checks))
    pos("cross_object_head_gradient_isolation", all(cross_head_isolation_checks))
    pos("same_class_condition_source_isolation", all(condition_source_isolation_checks))
    pos("model_state_unchanged", before == state_hash(model))

    class FixtureDataset:
        def __init__(self, samples):
            self.samples = samples

        def __len__(self):
            return len(self.samples)

        def __getitem__(self, index):
            return self.samples[index]

    fixture_samples = []
    for sample_index in range(len(IDENTITIES)):
        fixture_conditions = torch.zeros(23, 4, 4)
        identity = IDENTITIES[sample_index]
        channel_index = config["conditionChannelOrder"].index(identity)
        fixture_conditions[channel_index, sample_index, sample_index] = 1.0
        fixture_samples.append(
            {
                "sampleId": f"formal-source-{sample_index}",
                "conditions": fixture_conditions,
            }
        )
    selected_fixtures = select_first_nonempty_train_sample_per_class(
        FixtureDataset(fixture_samples),
        list(config["conditionChannelOrder"]),
    )
    pos(
        "gpu_qualification_selects_first_nonempty_sample_per_class",
        all(
            selected_fixtures[identity][0]["sampleId"]
            == f"formal-source-{offset}"
            and selected_fixtures[identity][1] == 1
            for offset, identity in enumerate(IDENTITIES)
        ),
    )

    baseline = deepcopy(config)
    baseline["denoiserArchitecture"] = "stage4_authoritative_visual_semantic_carrier_decoder_v1"
    baseline_model = build_complete_world_system(baseline)
    baseline_output = baseline_model.decode_stage4_post_decode_object_rgb(latent, conditions)
    pos(
        "legacy_architecture_decode_behavior_unchanged",
        bool(torch.equal(baseline_output, baseline_model.autoencoder.decode(latent))),
    )

    wrong = deepcopy(config)
    wrong["denoiserBaseChannels"] = 128
    neg("free_width_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config)
    wrong["conditionChannels"] = 22
    neg("condition_count_change_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config)
    wrong["latentChannels"] = 8
    neg("latent_count_change_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config)
    wrong["stage4ControlledStructureArm"] = "baseline_current_formal_structure"
    neg("exited_controlled_arm_combination_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config)
    wrong["stage4ResponsibilityComponentRole"] = "per_class_object_semantic_realization"
    neg("exited_component_combination_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config)
    wrong["conditionChannelTypes"]["discrete"].remove("object_tree")
    wrong["conditionChannelTypes"]["continuous"].append("object_tree")
    neg("object_mask_type_change_rejected", rejected(lambda: build_complete_world_system(wrong)))
    missing_class_samples = fixture_samples[:-1]
    neg(
        "gpu_qualification_rejects_missing_nonempty_class_mask",
        rejected(
            lambda: select_first_nonempty_train_sample_per_class(
                FixtureDataset(missing_class_samples),
                list(config["conditionChannelOrder"]),
            )
        ),
    )

    head_names = [
        name
        for name, _ in model.named_parameters()
        if ".stage4_post_decode_object_rgb_heads." in f".{name}"
    ]
    report = {
        "schemaVersion": "stage4-post-decode-object-rgb-compositor-cpu-report-v1",
        "status": "passed" if all(item["passed"] for item in positive + negative) else "failed_closed",
        "positiveResults": positive,
        "negativeResults": negative,
        "positivePassed": sum(item["passed"] for item in positive),
        "positiveTotal": len(positive),
        "negativePassed": sum(item["passed"] for item in negative),
        "negativeTotal": len(negative),
        "parameterTensorCount": len(head_names),
        "parameterCount": sum(
            parameter.numel()
            for name, parameter in model.named_parameters()
            if ".stage4_post_decode_object_rgb_heads." in f".{name}"
        ),
        "objectIdentityOrder": list(IDENTITIES),
        "checkpointWeightsRead": False,
        "gpuStarted": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

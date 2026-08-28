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


ARCHITECTURE = "stage4_authoritative_visual_semantic_carrier_decoder_v1"
IDENTITIES = (
    "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
    "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass",
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
)


def state_hash(model) -> str:
    digest = hashlib.sha256()
    for name, value in model.state_dict().items():
        digest.update(name.encode())
        digest.update(value.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def finite_nonzero(tensor: torch.Tensor | None) -> bool:
    return tensor is not None and bool(torch.isfinite(tensor).all()) and bool(tensor.abs().max() > 0)


def rejected(callback) -> bool:
    try:
        callback()
        return False
    except (ValueError, KeyError, TypeError, RuntimeError):
        return True


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: check_stage4_authoritative_semantic_carrier_cpu.py <inactive-config.json>")
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
    pos("carrier_identity_order_exact", model.stage4_authoritative_semantic_carrier_identity_order() == IDENTITIES)
    pos("carrier_namespace_count_exact", tuple(model.denoiser.authoritative_semantic_carriers.keys()) == IDENTITIES)
    pos("learned_participation_gate_absent", model.denoiser.semantic_mixture_participation is None)
    carrier_names = [name for name, _ in model.named_parameters() if ".authoritative_semantic_carriers." in name]
    pos("all_carrier_parameters_independently_namespaced", bool(carrier_names) and all(any(f".authoritative_semantic_carriers.{identity}." in name for identity in IDENTITIES) for name in carrier_names))

    noisy = torch.linspace(-1.0, 1.0, 12 * 8 * 8, dtype=torch.float32).reshape(1, 12, 8, 8)
    conditions = torch.zeros(1, 23, 32, 32, dtype=torch.float32, requires_grad=True)
    for offset, identity in enumerate(IDENTITIES):
        index = config["conditionChannelOrder"].index(identity)
        row = offset % 4
        col = (offset // 4) % 4
        conditions.data[:, index, row * 8:(row + 1) * 8, col * 8:(col + 1) * 8] = 1.0
    timestep = torch.tensor([500.0], dtype=torch.float32)
    output, evidence = model.predict_velocity_with_stage4_authoritative_semantic_carriers(noisy, timestep, conditions)
    pos("output_shape_preserved", tuple(output.shape) == (1, 12, 8, 8))
    pos("evidence_identity_preserved", tuple(evidence["carrierIdentityOrder"]) == IDENTITIES and tuple(evidence["sourceConditionChannels"]) == IDENTITIES)
    pos("authoritative_gate_kind_exact", evidence["gateKind"] == "immutable_source_condition_mask_multiplication_v1" and evidence["learnedParticipationGatePresent"] is False)

    gradient_checks = []
    outside_zero_checks = []
    parameter_object_sets = []
    resized = model.prepare_typed_conditions(conditions, output.shape[-2:])
    for identity, gated in zip(IDENTITIES, evidence["authoritativelyGatedContributions"]):
        source_index = config["conditionChannelOrder"].index(identity)
        mask = resized[:, source_index:source_index + 1]
        outside_zero_checks.append(bool((gated * (1.0 - mask)).abs().max() == 0))
        parameters = tuple(model.denoiser.authoritative_semantic_carriers[identity].parameters())
        parameter_object_sets.append({id(parameter) for parameter in parameters})
        parameter_gradients = torch.autograd.grad(gated.sum(), parameters, retain_graph=True, allow_unused=False)
        condition_gradient = torch.autograd.grad(gated.sum(), conditions, retain_graph=True, allow_unused=False)[0][:, source_index:source_index + 1]
        gradient_checks.append(all(finite_nonzero(value) for value in parameter_gradients) and finite_nonzero(condition_gradient))
    pos("all_carrier_gradients_finite_nonzero", all(gradient_checks))
    pos("all_contributions_zero_outside_authoritative_mask", all(outside_zero_checks))
    pos("carrier_parameter_objects_are_disjoint", all(parameter_object_sets[left].isdisjoint(parameter_object_sets[right]) for left in range(len(parameter_object_sets)) for right in range(left + 1, len(parameter_object_sets))))
    pos("model_state_unchanged", before == state_hash(model))

    wrong = deepcopy(config); wrong["denoiserBaseChannels"] = 128
    neg("free_width_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config); wrong["conditionChannels"] = 22
    neg("condition_count_change_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config); wrong["latentChannels"] = 8
    neg("latent_count_change_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config); wrong["stage4ControlledStructureArm"] = "baseline_current_formal_structure"
    neg("exited_controlled_arm_combination_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config); wrong["stage4ResponsibilityComponentRole"] = "terrain_route_hydrology_spatial_realization"
    neg("exited_component_combination_rejected", rejected(lambda: build_complete_world_system(wrong)))
    wrong = deepcopy(config); wrong["conditionChannelTypes"]["discrete"].remove("object_tree"); wrong["conditionChannelTypes"]["continuous"].append("object_tree")
    neg("carrier_type_change_rejected", rejected(lambda: build_complete_world_system(wrong)))

    report = {
        "schemaVersion": "stage4-authoritative-visual-semantic-carrier-cpu-report-v1",
        "status": "passed" if all(item["passed"] for item in positive + negative) else "failed_closed",
        "positiveResults": positive,
        "negativeResults": negative,
        "positivePassed": sum(item["passed"] for item in positive),
        "positiveTotal": len(positive),
        "negativePassed": sum(item["passed"] for item in negative),
        "negativeTotal": len(negative),
        "parameterTensorCount": len(carrier_names),
        "parameterCount": sum(
            parameter.numel()
            for name, parameter in model.named_parameters()
            if ".authoritative_semantic_carriers." in name
        ),
        "carrierIdentityOrder": list(IDENTITIES),
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

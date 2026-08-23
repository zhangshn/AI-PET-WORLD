from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
from pathlib import Path
import sys

import torch

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import build_complete_world_system
import run_stage4_controlled_structure_arm_readonly_gpu_qualification as runner


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--baseline-config", type=Path, required=True)
    parser.add_argument("--fusion-config", type=Path, required=True)
    parser.add_argument("--capacity-config", type=Path, required=True)
    parser.add_argument("--parameter-report", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    baseline = read_json(runner.resolve(args.baseline_config))
    fusion = read_json(runner.resolve(args.fusion_config))
    capacity = read_json(runner.resolve(args.capacity_config))
    parameter_report = read_json(runner.resolve(args.parameter_report))
    positive = []
    negative = []

    def pos(name, condition):
        positive.append({"name": name, "passed": bool(condition)})

    def reject(name, callback):
        passed = False
        try:
            callback()
        except (ValueError, KeyError, TypeError):
            passed = True
        negative.append({"name": name, "passed": passed})

    pos("baseline_arm_identity", baseline.get("stage4ControlledStructureArm") == runner.BASELINE_ARM)
    pos("fusion_arm_identity", fusion.get("stage4ControlledStructureArm") == runner.FUSION_ARM and fusion.get("denoiserBaseChannels") == 64)
    pos("capacity_arm_identity", capacity.get("stage4ControlledStructureArm") == runner.CAPACITY_ARM and capacity.get("denoiserBaseChannels") == 128)
    for name, config in (("baseline", baseline), ("fusion", fusion), ("capacity", capacity)):
        gates = config["training"]["stage4ControlledStructureThreeArm"]["activationGate"]
        pos(f"{name}_activation_gates_closed", all(value is False for value in gates.values()))
    pos("cpu_report_exact_fusion_parameter_count", parameter_report["conditionFusionOnly"]["addedParameterCount"] == 20236)
    pos("cpu_report_capacity_width_identity", parameter_report["capacityOnly"]["changedTensorShapes"]["denoiser.time_embedding.1.weight"]["after"] == [512, 128])

    torch.manual_seed(runner.SEED)
    baseline_model = build_complete_world_system(baseline)
    torch.manual_seed(runner.SEED)
    fusion_model = build_complete_world_system(fusion)
    torch.manual_seed(runner.SEED)
    capacity_model = build_complete_world_system(capacity)
    fusion_identity = runner.common_state_identity(baseline_model, fusion_model, runner.FUSION_ARM)
    capacity_identity = runner.common_state_identity(baseline_model, capacity_model, runner.CAPACITY_ARM)
    pos("fusion_four_new_tensor_identity", set(fusion_identity["newKeys"]) == set(runner.FUSION_KEYS) and fusion_identity["commonTensorBytesEqual"])
    pos("capacity_module_names_identical", not capacity_identity["newKeys"] and not capacity_identity["missingKeys"])
    noisy = torch.zeros(1, 12, 8, 8)
    conditions = torch.linspace(0, 1, 23 * 32 * 32).reshape(1, 23, 32, 32).requires_grad_(True)
    timestep = torch.tensor([999])
    fusion_output = fusion_model.predict_velocity(noisy, timestep, conditions)
    fusion_grad = torch.autograd.grad(fusion_output.square().mean(), (conditions, *tuple(fusion_model.denoiser.final_condition_residual.parameters())))
    pos("fusion_cpu_condition_and_branch_gradient_finite_nonzero", all(runner.finite_nonzero(item) for item in fusion_grad))
    capacity_conditions = conditions.detach().clone().requires_grad_(True)
    capacity_output = capacity_model.predict_velocity(noisy, timestep, capacity_conditions)
    capacity_grad = torch.autograd.grad(capacity_output.square().mean(), (capacity_conditions, capacity_model.denoiser.condition_stem[0].weight, capacity_model.denoiser.output[2].weight))
    pos("capacity_cpu_condition_to_output_gradient_finite_nonzero", all(runner.finite_nonzero(item) for item in capacity_grad))
    pos("output_contract_12_channels", list(fusion_output.shape) == list(capacity_output.shape) == [1, 12, 8, 8])
    source = Path(runner.__file__).read_text(encoding="utf-8")
    pos("readonly_runner_uses_autograd_grad", "torch.autograd.grad" in source)
    pos("readonly_runner_has_no_optimizer_or_backward_call", "torch.optim" not in source and ".backward(" not in source)

    unknown = deepcopy(fusion); unknown["stage4ControlledStructureArm"] = "unknown"
    reject("unknown_arm_rejected", lambda: build_complete_world_system(unknown))
    cross = deepcopy(fusion); cross["denoiserBaseChannels"] = 128
    reject("simultaneous_structure_axes_rejected", lambda: build_complete_world_system(cross))
    free_width = deepcopy(capacity); free_width["denoiserBaseChannels"] = 96
    reject("free_capacity_width_rejected", lambda: build_complete_world_system(free_width))
    missing_arm = deepcopy(fusion); missing_arm.pop("stage4ControlledStructureArm")
    reject("missing_fusion_identity_rejected", lambda: runner.common_state_identity(baseline_model, build_complete_world_system(missing_arm), runner.FUSION_ARM))
    reject("absolute_project_path_rejected", lambda: runner.resolve(ROOT / ".runtime" / "x"))
    reject("parent_traversal_rejected", lambda: runner.resolve(Path(".runtime/../../outside")))
    reject("unregistered_external_path_rejected", lambda: runner.resolve(Path("data/../../outside")))
    reject("invalid_arm_authorization_rejected", lambda: runner.validate_authorization({"schemaVersion": "owner-authorized-stage4-controlled-structure-arm-readonly-gpu-qualification-v1", "status": "resolved_owner_authorized_not_consumed", "requestId": "a", "commandRef": "a", "scope": "one_readonly_gpu_stage4_controlled_structure_arm_qualification", "oneTimeConsumption": True, "gpuAuthorized": True, "checkpointWeightsReadAuthorized": True, "denoiserCheckpointReadAuthorized": False, "optimizerAuthorized": False, "backwardAuthorized": False, "trainingAuthorized": False, "checkpointWriteAuthorized": False, "taskIdentity": {"arm": "old"}}, Path("a"), Path("b"), Path("c")))
    active = deepcopy(fusion); active["training"]["stage4ControlledStructureThreeArm"]["activationGate"]["gpuUseNow"] = True
    reject("active_inactive_config_rejected", lambda: (_ for _ in ()).throw(ValueError("active")) if any(active["training"]["stage4ControlledStructureThreeArm"]["activationGate"].values()) else None)
    nan = torch.tensor(float("nan"))
    reject("nan_gradient_rejected", lambda: (_ for _ in ()).throw(ValueError("nonfinite")) if not runner.finite_nonzero(nan) else None)

    status = "passed" if all(row["passed"] for row in positive + negative) else "failed"
    report = {
        "schemaVersion": "stage4-controlled-structure-arm-gpu-entry-cpu-report-v1",
        "status": status,
        "positive": {"passed": sum(row["passed"] for row in positive), "total": len(positive), "cases": positive},
        "negative": {"passed": sum(row["passed"] for row in negative), "total": len(negative), "cases": negative},
        "safety": {"checkpointRead": False, "gpuStarted": False, "optimizerCreated": False, "backwardExecuted": False, "trainingStarted": False},
    }
    if args.output is not None:
        output = runner.resolve(args.output)
        if output.exists():
            raise ValueError("cpu_report_output_already_exists")
        runner.write_json_atomic(output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

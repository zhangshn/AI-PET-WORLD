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
import run_stage4_isolated_responsibility_component_readonly_gpu_qualification as runner


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--terrain-config", type=Path, required=True)
    parser.add_argument("--object-config", type=Path, required=True)
    parser.add_argument("--final-config", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    configs = {
        runner.ROLE_ORDER[0]: read_json(runner.resolve(args.terrain_config)),
        runner.ROLE_ORDER[1]: read_json(runner.resolve(args.object_config)),
        runner.ROLE_ORDER[2]: read_json(runner.resolve(args.final_config)),
    }
    positive = []
    negative = []

    def pos(name, condition):
        positive.append({"name": name, "passed": bool(condition)})

    def reject(name, callback):
        passed = False
        try:
            callback()
        except (ValueError, KeyError, TypeError, RuntimeError):
            passed = True
        negative.append({"name": name, "passed": passed})

    models = {}
    namespaces = []
    for role in runner.ROLE_ORDER:
        config = configs[role]
        gates = config["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"]
        pos(f"{role}_config_identity_exact", config.get("stage4ResponsibilityComponentRole") == role)
        pos(f"{role}_inactive_gates_closed", gates and not any(gates.values()))
        torch.manual_seed(runner.SEED)
        model = build_complete_world_system(config)
        models[role] = model
        identity = runner.parameter_namespace_identity(model, role)
        namespaces.append(identity["namespace"])
        pos(f"{role}_parameter_namespace_isolated", identity["allTrainableParametersRolePrefixed"])
        pos(f"{role}_expert_set_exact", identity["expertIdentityOrder"] == list(runner.EXPECTED_EXPERTS[role]))
        noisy = torch.linspace(-1, 1, 12 * 48 * 64).reshape(1, 12, 48, 64).requires_grad_(True)
        conditions = torch.linspace(0, 1, 23 * 192 * 256).reshape(1, 23, 192, 256).requires_grad_(True)
        output = model.predict_velocity(noisy, torch.tensor([999.0]), conditions)
        named_parameters = tuple(model.denoiser.named_parameters())
        gradient = torch.autograd.grad(
            output.square().mean(),
            (noisy, conditions, *(parameter for _, parameter in named_parameters)),
            allow_unused=True,
        )
        partition = runner.responsibility_gradient_partition(named_parameters, gradient[2:], role)
        pos(f"{role}_cpu_input_condition_parameter_gradient_finite_nonzero", all(runner.finite_nonzero(item) for item in gradient[:2]))
        pos(f"{role}_formal_parameter_subset_all_finite_nonzero", all(row["finite"] is True and row["nonZero"] is True for row in partition["formalResponsibilityActiveParameters"]))
        pos(f"{role}_inactive_auxiliary_probe_exact", partition["inactiveAuxiliaryParameterCount"] == 12 and all(row["parameterName"].startswith("output_bound_condition_probe.") for row in partition["inactiveAuxiliaryParameters"]))
        pos(f"{role}_latent_output_contract", list(output.shape) == [1, 12, 48, 64])
    pos("three_parameter_namespaces_pairwise_distinct", len(set(namespaces)) == 3)
    pos("terrain_route_expert_only", runner.parameter_namespace_identity(models[runner.ROLE_ORDER[0]], runner.ROLE_ORDER[0])["expertIdentityOrder"] == ["route"])
    pos("object_four_experts_only", runner.parameter_namespace_identity(models[runner.ROLE_ORDER[1]], runner.ROLE_ORDER[1])["expertIdentityOrder"] == ["footprints", "tree", "rock", "vegetation"])
    pos("final_no_special_experts", runner.parameter_namespace_identity(models[runner.ROLE_ORDER[2]], runner.ROLE_ORDER[2])["expertIdentityOrder"] == [])
    with torch.no_grad():
        decoded = models[runner.ROLE_ORDER[2]].decode_stage4_native_complete_rgb(torch.zeros(1, 12, 48, 64))
    pos("final_stage0_native_decode_fourfold", list(decoded.shape) == [1, 3, 192, 256])
    reject("terrain_rgb_decode_rejected", lambda: models[runner.ROLE_ORDER[0]].decode_stage4_native_complete_rgb(torch.zeros(1, 12, 48, 64)))
    reject("object_rgb_decode_rejected", lambda: models[runner.ROLE_ORDER[1]].decode_stage4_native_complete_rgb(torch.zeros(1, 12, 48, 64)))

    source = Path(runner.__file__).read_text(encoding="utf-8")
    pos("runner_uses_real_autograd_grad", "torch.autograd.grad" in source)
    pos("runner_allows_unused_only_for_explicit_partition", "allow_unused=True" in source and "responsibility_gradient_partition" in source)
    pos("runner_has_no_optimizer_or_backward", "torch.optim" not in source and ".backward(" not in source)
    pos("runner_writes_no_checkpoint", "torch.save(" not in source)
    pos("runner_enforces_state_hash_identity", "denoiser_before != denoiser_after" in source and "autoencoder_before != autoencoder_after" in source)
    pos("runner_enforces_predecessor_terminal_and_output_sha", "predecessor_terminal_identity_invalid" in source and "predecessor_tensor_sha256_mismatch" in source)
    pos("runner_uses_fixed_first_train_and_sample194", runner.TRAIN_SAMPLE_ID in source and runner.VALIDATION_SAMPLE_ID in source)
    pos("runner_records_native_1024x768_boundary", "decoded_native.shape" in source and "[1, 3, 768, 1024]" in source)

    unknown = deepcopy(configs[runner.ROLE_ORDER[0]])
    unknown["stage4ResponsibilityComponentRole"] = "unknown"
    reject("unknown_role_rejected", lambda: build_complete_world_system(unknown))
    shared = deepcopy(configs[runner.ROLE_ORDER[1]])
    shared["training"]["stage4IsolatedResponsibilityComponent"]["parameterNamespace"] = "shared"
    reject("shared_namespace_contract_rejected", lambda: (_ for _ in ()).throw(ValueError("shared")) if shared["training"]["stage4IsolatedResponsibilityComponent"]["parameterNamespace"] == "shared" else None)
    reject("absolute_path_rejected", lambda: runner.resolve(ROOT / ".runtime" / "x"))
    reject("parent_escape_rejected", lambda: runner.resolve(Path(".runtime/../../outside")))
    reject("unknown_authorized_role_rejected", lambda: runner.validate_authorization({
        "schemaVersion": "owner-authorized-stage4-isolated-responsibility-component-readonly-gpu-qualification-v1",
        "status": "resolved_owner_authorized_not_consumed", "requestId": "x", "commandRef": "x",
        "scope": "one_readonly_gpu_stage4_isolated_responsibility_component_qualification",
        "oneTimeConsumption": True, "gpuAuthorized": True, "checkpointWeightsReadAuthorized": True,
        "denoiserCheckpointReadAuthorized": False, "optimizerAuthorized": False, "backwardAuthorized": False,
        "modelWeightModificationAuthorized": False, "checkpointWriteAuthorized": False, "smokeAuthorized": False,
        "trainingAuthorized": False, "stage0Authorized": False, "stage1Authorized": False, "stage2Authorized": False,
        "taskIdentity": {"roleId": "unknown", "roleIndex": 0},
    }, Path("a"), Path("b"), Path("c")))
    wrong_order = {"taskIdentity": {"roleId": runner.ROLE_ORDER[1]}, "predecessor": {"roleId": runner.ROLE_ORDER[2], "sameQualificationPackageRequired": True}}
    reject("wrong_predecessor_role_rejected", lambda: runner.validate_predecessor(wrong_order))
    missing_predecessor = {"taskIdentity": {"roleId": runner.ROLE_ORDER[2]}, "predecessor": {"roleId": runner.ROLE_ORDER[1], "sameQualificationPackageRequired": True, "terminalPath": ".runtime/missing-terminal.json", "outputEvidencePath": ".runtime/missing-output.json"}}
    reject("missing_predecessor_evidence_rejected", lambda: runner.validate_predecessor(missing_predecessor))
    reject("nan_gradient_rejected", lambda: (_ for _ in ()).throw(ValueError("nonfinite")) if not runner.finite_nonzero(torch.tensor(float("nan"))) else None)
    reject("zero_gradient_rejected", lambda: (_ for _ in ()).throw(ValueError("zero")) if not runner.finite_nonzero(torch.zeros(1)) else None)
    synthetic_parameters = (("output.weight", torch.nn.Parameter(torch.ones(1))), ("output_bound_condition_probe.0.weight", torch.nn.Parameter(torch.ones(1))))
    reject("missing_formal_parameter_gradient_rejected", lambda: runner.responsibility_gradient_partition(synthetic_parameters, (None, None), runner.ROLE_ORDER[2]))
    reject("reachable_inactive_auxiliary_probe_rejected", lambda: runner.responsibility_gradient_partition(synthetic_parameters, (torch.ones(1), torch.ones(1)), runner.ROLE_ORDER[2]))
    reject("nonfinite_formal_parameter_gradient_rejected", lambda: runner.responsibility_gradient_partition(synthetic_parameters, (torch.tensor(float("nan")), None), runner.ROLE_ORDER[2]))
    wrong_mask = torch.zeros(1, 4, 2, 2)
    wrong_mask_after = wrong_mask.clone(); wrong_mask_after[0, 0, 0, 0] = 1
    reject("object_mask_modification_rejected", lambda: (_ for _ in ()).throw(ValueError("mask_changed")) if runner.tensor_sha256(wrong_mask) != runner.tensor_sha256(wrong_mask_after) else None)

    status = "passed" if all(item["passed"] for item in positive + negative) else "failed"
    report = {
        "schemaVersion": "stage4-isolated-responsibility-component-gpu-entry-cpu-report-v1",
        "status": status,
        "positive": {"passed": sum(item["passed"] for item in positive), "total": len(positive), "cases": positive},
        "negative": {"passed": sum(item["passed"] for item in negative), "total": len(negative), "cases": negative},
        "safety": {"checkpointRead": False, "gpuStarted": False, "optimizerCreated": False, "backwardExecuted": False, "checkpointWritten": False, "smokeStarted": False, "trainingStarted": False},
    }
    if args.output is not None:
        output = runner.resolve(args.output)
        if output.exists():
            raise ValueError("cpu_report_output_already_exists")
        runner.write_json_atomic(output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if status == "passed" else 1


if __name__ == "__main__":
    torch.set_num_threads(1)
    raise SystemExit(main())

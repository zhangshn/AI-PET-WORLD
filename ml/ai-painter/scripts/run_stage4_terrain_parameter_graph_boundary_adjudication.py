from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

import torch

from ai_painter.complete_world import build_complete_world_system


ROOT = Path(__file__).resolve().parents[3]
SEED = 20263722
ROLE = "terrain_route_hydrology_spatial_realization"
BOUND = {
    ".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualification-failures/20260823-162800000/phase-terminal.json": "8e964fc164c1e21c4162a3be889260cd22fdef5e32839f6ed41fe451983822a6",
    ".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-162500001-terrain_route_hydrology_spatial_realization/phase-terminal.json": "ee5e70d6c5a5b5a848e06d5a111caafc390f1dbe02cf522e889f1467005b747b",
    ".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualifications/20260823-162500001-terrain_route_hydrology_spatial_realization/failure-report.json": "2fb672e4d97f616b1fb8bad412d0966f6933262518caa67029c47d6daf3adc79",
    ".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-authorizations/stage4-isolated-responsibility-component-gpu-qualification-20260823-162500000/1-terrain_route_hydrology_spatial_realization/gpu-consumption.json": "b764e66b28d4a086354d95cf198b1e40e80abf4207488c025ede046dec0a4e32",
    ".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-entry-cpu/20260823-162217767/cpu-report.json": "0085b15f68abd685d29a0270e7e4cb3d9396af8f1b698844e4312cdd8b9618c7",
    ".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-authorizations/stage4-isolated-responsibility-component-gpu-qualification-20260823-162500000/authorization-package.json": "36f0cb39df0a28c2d0d3a34784fc223f23f9af174e29bd94587b09a8adf6cb06",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def tensor_status(value: torch.Tensor | None) -> dict:
    if value is None:
        return {"graphReachable": False, "finite": None, "nonZero": None, "absoluteSum": None}
    detached = value.detach()
    finite = bool(torch.isfinite(detached).all())
    absolute_sum = float(detached.abs().sum()) if finite else None
    return {"graphReachable": True, "finite": finite, "nonZero": bool(absolute_sum and absolute_sum > 0), "absoluteSum": absolute_sum}


def graph_rows(model, noisy, conditions, *, formal_details: bool) -> tuple[list[dict], dict]:
    parameters = tuple(model.denoiser.named_parameters())
    if formal_details:
        predicted, details = model.predict_velocity_with_stage4_semantic_mixture(
            noisy, torch.tensor([999.0]), conditions,
        )
        if tuple(details["expertIdentityOrder"]) != ("route",):
            raise ValueError("terrain_formal_route_identity_invalid")
        scalar = (
            predicted.square().mean()
            + details["expertContributions"][0].square().mean()
            + details["participation"].square().mean()
            + details["gatedContributions"][0].square().mean()
        )
    else:
        predicted = model.predict_velocity(noisy, torch.tensor([999.0]), conditions)
        scalar = predicted.square().mean()
    gradients = torch.autograd.grad(
        scalar,
        (noisy, conditions, *(parameter for _, parameter in parameters)),
        allow_unused=True,
    )
    input_status = {"latentInput": tensor_status(gradients[0]), "conditionInput": tensor_status(gradients[1])}
    rows = []
    for (name, parameter), gradient in zip(parameters, gradients[2:]):
        module = name.rsplit(".", 1)[0]
        status = tensor_status(gradient)
        rows.append({
            "parameterName": name,
            "fullyQualifiedParameterName": f"stage4_responsibility_components.{ROLE}.{name}",
            "moduleName": module,
            "shape": list(parameter.shape),
            "numel": parameter.numel(),
            "routeExpertOrParticipation": name.startswith("semantic_mixture_experts.route.") or name.startswith("semantic_mixture_participation.route."),
            **status,
        })
    return rows, input_status


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    for logical, expected in BOUND.items():
        path = ROOT / logical
        if not path.is_file() or sha256_file(path) != expected:
            raise ValueError(f"bound_evidence_invalid:{logical}")
    package = read_json(ROOT / next(key for key in BOUND if key.endswith("authorization-package.json")))
    if any((ROOT / item["consumptionPath"]).exists() for item in package["authorizations"][1:]):
        raise ValueError("later_component_authorization_consumed")
    config_path = ROOT / args.config
    output = ROOT / args.output_dir
    if output.exists():
        raise ValueError("output_directory_already_exists")
    config = read_json(config_path)
    if config.get("stage4ResponsibilityComponentRole") != ROLE:
        raise ValueError("terrain_config_identity_invalid")
    if any(config["training"]["stage4IsolatedResponsibilityComponent"]["activationGate"].values()):
        raise ValueError("inactive_config_gate_open")
    torch.manual_seed(SEED)
    model = build_complete_world_system(config)
    model.eval()
    if next(model.parameters()).is_cuda or torch.cuda.is_initialized():
        raise ValueError("cuda_must_not_initialize")
    noisy = torch.linspace(-1, 1, 12 * 48 * 64).reshape(1, 12, 48, 64).requires_grad_(True)
    conditions = torch.linspace(0, 1, 23 * 192 * 256).reshape(1, 23, 192, 256).requires_grad_(True)
    ordinary_rows, ordinary_inputs = graph_rows(model, noisy, conditions, formal_details=False)
    noisy_formal = noisy.detach().clone().requires_grad_(True)
    conditions_formal = conditions.detach().clone().requires_grad_(True)
    formal_rows, formal_inputs = graph_rows(model, noisy_formal, conditions_formal, formal_details=True)
    ordinary_by_name = {row["parameterName"]: row for row in ordinary_rows}
    formal_by_name = {row["parameterName"]: row for row in formal_rows}
    unused = [row for row in ordinary_rows if not row["graphReachable"]]
    route_names = [row["parameterName"] for row in ordinary_rows if row["routeExpertOrParticipation"]]
    ordinary_route_all_reachable = bool(route_names) and all(ordinary_by_name[name]["graphReachable"] for name in route_names)
    formal_route_all_reachable = bool(route_names) and all(formal_by_name[name]["graphReachable"] for name in route_names)
    used_all_finite = all(row["finite"] is True for row in ordinary_rows if row["graphReachable"])
    used_has_nonzero = any(row["nonZero"] is True for row in ordinary_rows if row["graphReachable"])
    if ordinary_route_all_reachable and unused and used_all_finite and used_has_nonzero:
        decision = "formal_gradient_parameter_subset_contract_mismatch"
        rationale = "ordinary responsibility output reaches all route expert and participation parameters, while auxiliary trainable tensors outside that output remain legitimately unused"
    elif not ordinary_route_all_reachable and formal_route_all_reachable:
        decision = "readonly_gpu_diagnostic_output_path_selection_defect"
        rationale = "formal semantic-mixture responsibility output reaches route parameters that the ordinary diagnostic output does not"
    elif not formal_route_all_reachable:
        decision = "terrain_component_execution_wiring_defect"
        rationale = "route expert or participation parameters remain unreachable even from the formal semantic-mixture responsibility output"
    else:
        decision = "evidence_insufficient_for_graph_boundary_decision"
        rationale = "observed graph identities do not uniquely select an authorized decision"
    output.mkdir(parents=True, exist_ok=False)
    report = {
        "schemaVersion": "stage4-terrain-formal-parameter-graph-boundary-report-v1",
        "status": "completed",
        "seed": SEED,
        "device": "cpu",
        "checkpointRead": False,
        "cudaInitialized": torch.cuda.is_initialized(),
        "roleId": ROLE,
        "parameterNamespace": f"stage4_responsibility_components.{ROLE}",
        "ordinaryOutput": {"inputGradients": ordinary_inputs, "parameters": ordinary_rows},
        "formalSemanticMixtureOutput": {"inputGradients": formal_inputs, "parameters": formal_rows},
        "summary": {
            "parameterCount": len(ordinary_rows),
            "ordinaryReachableCount": len(ordinary_rows) - len(unused),
            "ordinaryUnusedCount": len(unused),
            "ordinaryUnusedParameterNames": [row["fullyQualifiedParameterName"] for row in unused],
            "routeFormalParameterCount": len(route_names),
            "ordinaryRouteAllReachable": ordinary_route_all_reachable,
            "formalRouteAllReachable": formal_route_all_reachable,
            "ordinaryUsedGradientsAllFinite": used_all_finite,
            "ordinaryUsedGradientHasNonZero": used_has_nonzero,
        },
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "parameter-graph-report.json", report)
    decision_doc = {
        "schemaVersion": "stage4-terrain-formal-parameter-graph-boundary-decision-v1",
        "status": "succeeded",
        "decision": decision,
        "rationale": rationale,
        "parameterGraphReport": {"path": str((args.output_dir / "parameter-graph-report.json").as_posix()), "sha256": sha256_file(output / "parameter-graph-report.json")},
        "gpuRetryAuthorized": False,
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "decision.json", decision_doc)
    print(json.dumps({"status": "succeeded", "decision": decision, "unusedParameterCount": len(unused), "unusedParameterNames": [row["fullyQualifiedParameterName"] for row in unused], "reportSha256": sha256_file(output / "parameter-graph-report.json"), "decisionSha256": sha256_file(output / "decision.json")}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    torch.set_num_threads(1)
    raise SystemExit(main())

from __future__ import annotations

from argparse import ArgumentParser
import ast
import copy
import hashlib
import json
from pathlib import Path

import torch

import run_stage4_per_class_worst_sample_reference_feature_structure_gpu_qualification as runner
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
EXPECTED_SOURCE_HASHES = {
    "phase-terminal.json": "b4943006e2a4194af2a7a0eb2dfc405b59eab2fd5a208c3a87bf8a75f0fd8aae",
    "cpu-report.json": "d3e2d0cd9046a6e4cc31c58a705b4fa52233615e0b3cbbd8cba1e4522091d398",
    "configuration-audit.json": "44130cafcb17478217beebc0643bd0f9cacdf083c68c90395687a7d484b957f5",
    "inactive-config.json": "6f4d700e75c592500eb2e7c9fbafc2d4495bbe420e90d681f5846a22a1740af7",
    "training-objective-support-contract.json": "985e4d77cf3c8d0a3f42b1756c6c42a3d7e3d8456c8110ec51926160974907aa",
}
EXPECTED_CLASSES = ["footprints", "tree", "rock", "vegetation"]


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--implementation-authorization", type=Path, required=True)
    parser.add_argument("--implementation-consumption", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    config_path = resolve(args.config)
    source_root = resolve(args.source_root)
    authorization_path = resolve(args.implementation_authorization)
    consumption_path = resolve(args.implementation_consumption)
    output = resolve(args.output)
    if output.exists():
        raise ValueError("gpu_entry_cpu_report_already_exists")

    config = read_json(config_path)
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    contract = (
        trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
            config
        )
    )
    positives = []
    negatives = []

    positives.append(check(
        "bound_source_hashes_exact",
        all(
            (source_root / name).is_file()
            and sha256_file(source_root / name) == expected
            for name, expected in EXPECTED_SOURCE_HASHES.items()
        ),
    ))
    positives.append(check(
        "bound_cpu_terminal_is_success",
        read_json(source_root / "phase-terminal.json").get("status")
        == "stage4_per_class_worst_sample_reference_feature_structure_cpu_succeeded_closed",
    ))
    positives.append(check(
        "inactive_contract_and_all_gates_closed",
        contract is not None
        and contract.get("status") == "cpu_support_verified_inactive"
        and all(value is False for value in contract["activationGate"].values()),
    ))

    values = torch.tensor([
        [9.0, 1.0, 1.0, 1.0],
        [1.0, 8.0, 1.0, 1.0],
        [1.0, 1.0, 7.0, 1.0],
        [1.0, 1.0, 1.0, 6.0],
    ], requires_grad=True)
    sample_ids = ["train-d", "train-c", "train-b", "train-a"]
    selected = (
        trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
            values, sample_ids, config
        )
    )
    selected_ids = [
        row["sampleId"] for row in selected["perClassSelections"]
    ]
    positives.append(check(
        "four_classes_retain_independent_worst_sample_identity",
        selected_ids == sample_ids,
    ))
    weights = contract["sourceContracts"]["derivedClassWeights"]
    expected_total = sum(
        score * float(weights[identity])
        for score, identity in zip((9.0, 8.0, 7.0, 6.0), EXPECTED_CLASSES)
    )
    positives.append(check(
        "derived_weighted_total_exact",
        torch.allclose(
            selected["weightedTotalTensor"],
            torch.tensor(expected_total),
            atol=1e-7,
            rtol=0.0,
        ),
    ))
    rollout_weight = float(contract["sourceContracts"]["rolloutWeight"])
    positives.append(check(
        "checkpoint_qualification_uses_same_four_class_total",
        torch.allclose(
            selected["checkpointQualificationTensor"],
            selected["weightedTotalTensor"] * rollout_weight,
            atol=1e-7,
            rtol=0.0,
        ),
    ))
    gradient = torch.autograd.grad(selected["weightedTotalTensor"], values)[0]
    expected_support = torch.eye(4, dtype=torch.bool)
    positives.append(check(
        "four_selected_sample_class_gradients_nonzero_and_isolated",
        torch.equal(gradient != 0, expected_support)
        and bool(torch.isfinite(gradient).all()),
    ))
    positives.append(check(
        "runner_exact_task_identity_constants",
        runner.CONTRACT_ID
        == "stage4_per_class_worst_sample_reference_feature_structure_obligation_v1"
        and runner.SEED == 20263722
        and runner.IMAGE_SIZE == (256, 192)
        and runner.ROLLOUT_STEPS == 50
        and runner.GRADIENT_TAIL_STEPS == 5
        and list(runner.CLASS_IDENTITIES) == EXPECTED_CLASSES,
    ))
    positives.append(check(
        "runner_scans_train_and_validation_before_gradients",
        source_order(
            runner.__file__,
            "train_scan = scan_population",
            "validation_scan = scan_population",
            "gradient_evidence = {}",
        ),
    ))
    positives.append(check(
        "runner_uses_only_autograd_grad_for_gradient_qualification",
        runner_ast_safety(Path(runner.__file__)),
    ))
    positives.append(check(
        "implementation_authorization_consumed_once",
        authorization.get("status") == "resolved_owner_authorized_not_consumed"
        and consumption.get("status") == "consumed_once"
        and consumption.get("authorizationSha256") == sha256_file(authorization_path)
        and consumption.get("oneTimeConsumption") is True,
    ))
    positives.append(check(
        "frozen_compatibility_contract_unchanged",
        contract.get("compatibility") == {
            "modelArchitectureChanged": False,
            "existingLossValuesOrWeightsChanged": False,
            "optimizerStepBudgetChanged": False,
            "datasetOrSplitChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
    ))

    mutations = [
        ("global_cross_class_max", ("selection", "globalCrossClassMaximumAllowed"), True),
        ("free_numeric_weight", ("sourceContracts", "freeNumericalWeightSelectionAllowed"), True),
        ("extra_optimizer_step", ("totalLoss", "additionalOptimizerSteps"), 1),
        ("failed_preview_target", ("legalSupervision", "failedPreviewPixelsUsedAsTargets"), True),
        ("review_result_target", ("legalSupervision", "machineReviewResultsUsedAsTargets"), True),
        ("gpu_gate_activated", ("activationGate", "gpuUseNow"), True),
    ]
    for name, field_path, value in mutations:
        mutated = copy.deepcopy(config)
        target = mutated["training"][
            "stage4PerClassWorstSampleReferenceFeatureStructureObligation"
        ]
        for key in field_path[:-1]:
            target = target[key]
        target[field_path[-1]] = value
        negatives.append(rejected(name, mutated))
    negatives.extend([
        rejected_tensor("invalid_rank", torch.zeros(4), sample_ids, config),
        rejected_tensor("invalid_class_count", torch.zeros(4, 3), sample_ids, config),
        rejected_tensor(
            "non_finite_tensor",
            torch.tensor([[float("nan")] * 4]),
            ["sample"],
            config,
        ),
        rejected_tensor("duplicate_sample_id", torch.zeros(2, 4), ["same", "same"], config),
    ])

    report = {
        "schemaVersion": (
            "stage4-per-class-worst-sample-reference-feature-structure-"
            "gpu-entry-cpu-report-v1"
        ),
        "status": (
            "passed_stage4_per_class_worst_sample_reference_feature_structure_"
            "gpu_entry_cpu_gate"
            if all(row["passed"] for row in positives + negatives)
            else "failed_stage4_per_class_worst_sample_reference_feature_structure_gpu_entry_cpu_gate"
        ),
        "positivePassed": sum(row["passed"] for row in positives),
        "positiveTotal": len(positives),
        "negativePassed": sum(row["passed"] for row in negatives),
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "bindings": {
            "config": binding(config_path),
            "implementationAuthorization": binding(authorization_path),
            "implementationConsumption": binding(consumption_path),
            "gpuRunner": binding(Path(runner.__file__)),
        },
        "safety": {
            "checkpointRead": False,
            "gpuUsed": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "trainingStarted": False,
        },
    }
    write_json_exclusive(output, report)
    print(json.dumps({
        "status": report["status"],
        "path": project_path(output),
        "sha256": sha256_file(output),
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
    }, ensure_ascii=False))
    return 0 if report["status"].startswith("passed_") else 1


def runner_ast_safety(path: Path) -> bool:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    forbidden = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        name = call_name(node.func)
        if (
            name.endswith(".backward")
            or name in {"torch.save", "torch.optim.Adam", "torch.optim.AdamW"}
            or name.endswith("load_denoiser_checkpoint")
        ):
            forbidden.append(name)
    return not forbidden and "torch.autograd.grad" in path.read_text(encoding="utf-8")


def call_name(node) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = call_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    return ""


def source_order(path: str, *needles: str) -> bool:
    source = Path(path).read_text(encoding="utf-8")
    positions = [source.find(needle) for needle in needles]
    return all(position >= 0 for position in positions) and positions == sorted(positions)


def rejected(name: str, config: dict) -> dict:
    try:
        trainer.validate_stage4_per_class_worst_sample_reference_feature_structure_obligation(
            config
        )
    except (KeyError, TypeError, ValueError) as error:
        return {"name": name, "passed": True, "error": str(error)}
    return {"name": name, "passed": False, "error": "mutation accepted"}


def rejected_tensor(name: str, tensor, sample_ids, config) -> dict:
    try:
        trainer.stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(
            tensor, sample_ids, config
        )
    except (KeyError, TypeError, ValueError):
        return {"name": name, "passed": True}
    return {"name": name, "passed": False}


def check(name: str, passed: bool) -> dict:
    return {"name": name, "passed": bool(passed)}


def resolve(path: Path) -> Path:
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime_root = (ROOT / ".runtime").resolve()
    if resolved == runtime_root or runtime_root in resolved.parents:
        return str(Path(".runtime") / resolved.relative_to(runtime_root)).replace("\\", "/")
    return str(resolved.relative_to(ROOT)).replace("\\", "/")


def write_json_exclusive(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

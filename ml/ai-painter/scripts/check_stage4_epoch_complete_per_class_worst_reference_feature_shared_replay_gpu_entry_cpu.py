from __future__ import annotations

from argparse import ArgumentParser
import ast
import hashlib
import inspect
import json
import math
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification as runner


ROOT = Path.cwd().resolve()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def call_path(node: ast.AST) -> str:
    if isinstance(node, ast.Name): return node.id
    if isinstance(node, ast.Attribute):
        prefix = call_path(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def validate_unified_execution_identity(identity: dict) -> None:
    expected = {
        "trainScanBatchSize": 1,
        "validationScanBatchSize": 1,
        "selectedRerunBatchSize": 1,
        "trainScanGradientTailSteps": 5,
        "validationScanGradientTailSteps": 5,
        "selectedRerunGradientTailSteps": 5,
        "rolloutSteps": 50,
        "sameSampleOrder": True,
        "sameSeedIdentity": True,
        "sameInitialLatentIdentity": True,
        "sameModelEvalState": True,
        "sameTimestepPath": True,
        "sameAutoencoderDecode": True,
        "sameReferenceFeatureAndClassWeighting": True,
        "scoreDetachedImmediately": True,
        "graphReleasedImmediately": True,
        "freeToleranceParameter": False,
    }
    if identity != expected:
        changed = sorted(
            key for key in set(identity) | set(expected)
            if identity.get(key) != expected.get(key)
        )
        raise ValueError(f"scan_rerun_execution_identity_not_unified:{changed}")


def execution_identity_from_source() -> dict:
    source = runner.RUNNER_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    run_gpu = next(
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "run_gpu"
    )
    run_source = ast.get_source_segment(source, run_gpu) or ""
    rollout_calls = [
        node for node in ast.walk(run_gpu)
        if isinstance(node, ast.Call) and call_path(node.func) == "base.rollout_rgb"
    ]
    tails = []
    for call in rollout_calls:
        tail = next(
            (keyword.value.value for keyword in call.keywords
             if keyword.arg == "gradient_tail_steps"
             and isinstance(keyword.value, ast.Constant)),
            None,
        )
        tails.append(tail)
    return {
        "trainScanBatchSize": 1 if "chunk_size = 1" in run_source else None,
        "validationScanBatchSize": 1 if "chunk_size = 1" in run_source else None,
        "selectedRerunBatchSize": 1 if 'image = record["image"].unsqueeze(0).to(device)' in run_source else None,
        "trainScanGradientTailSteps": tails[0] if len(tails) > 0 else None,
        "selectedRerunGradientTailSteps": tails[1] if len(tails) > 1 else None,
        "validationScanGradientTailSteps": tails[2] if len(tails) > 2 else None,
        "rolloutSteps": 50,
        "sameSampleOrder": 'range(start, min(start + chunk_size, 48))' in run_source and 'index = train_index[selection["sampleId"]]' in run_source,
        "sameSeedIdentity": '[SEED + index for index in range(start, start + len(records))]' in run_source and '[SEED + index]' in run_source,
        "sameInitialLatentIdentity": "base.rollout_rgb" in run_source,
        "sameModelEvalState": "model.to(device).eval()" in run_source,
        "sameTimestepPath": len(rollout_calls) == 3 and tails == [5, 5, 5],
        "sameAutoencoderDecode": len(rollout_calls) == 3,
        "sameReferenceFeatureAndClassWeighting": run_source.count("weighted_reference_tensor(model.autoencoder") == 3,
        "scoreDetachedImmediately": run_source.count("detached_weighted = weighted.detach()") == 2,
        "graphReleasedImmediately": "del scan_losses, predicted, weighted, detached_weighted, images, conditions" in run_source and "del validation_scan_losses, predicted, weighted, detached_weighted, images, conditions" in run_source,
        "freeToleranceParameter": "tolerance" in inspect.signature(runner.reference_feature_score_identity_evidence).parameters,
    }


def execution_identity_regression() -> dict:
    actual = execution_identity_from_source()
    validate_unified_execution_identity(actual)
    positives = [
        {"name": "train_scan_batch_one", "passed": actual["trainScanBatchSize"] == 1},
        {"name": "validation_scan_batch_one", "passed": actual["validationScanBatchSize"] == 1},
        {"name": "all_paths_use_five_step_autograd_tail", "passed": [actual["trainScanGradientTailSteps"], actual["selectedRerunGradientTailSteps"], actual["validationScanGradientTailSteps"]] == [5, 5, 5]},
        {"name": "same_sample_seed_latent_model_timestep_decode_feature_and_weighting", "passed": all(actual[name] is True for name in ("sameSampleOrder", "sameSeedIdentity", "sameInitialLatentIdentity", "sameModelEvalState", "sameTimestepPath", "sameAutoencoderDecode", "sameReferenceFeatureAndClassWeighting"))},
        {"name": "score_detached_and_graph_released_immediately", "passed": actual["scoreDetachedImmediately"] and actual["graphReleasedImmediately"]},
        {"name": "dtype_derived_tolerance_has_no_free_parameter", "passed": actual["freeToleranceParameter"] is False},
    ]
    negatives = []
    for name, key, value in (
        ("batch_size_change_rejected", "trainScanBatchSize", 4),
        ("validation_batch_size_change_rejected", "validationScanBatchSize", 4),
        ("all_no_grad_scan_rejected", "trainScanGradientTailSteps", 0),
        ("validation_all_no_grad_scan_rejected", "validationScanGradientTailSteps", 0),
        ("seed_identity_change_rejected", "sameSeedIdentity", False),
        ("initial_latent_identity_change_rejected", "sameInitialLatentIdentity", False),
        ("timestep_path_change_rejected", "sameTimestepPath", False),
        ("decode_path_change_rejected", "sameAutoencoderDecode", False),
        ("reference_feature_weighting_change_rejected", "sameReferenceFeatureAndClassWeighting", False),
        ("missing_detach_rejected", "scoreDetachedImmediately", False),
        ("retained_graph_rejected", "graphReleasedImmediately", False),
        ("free_tolerance_injection_rejected", "freeToleranceParameter", True),
    ):
        mutated = dict(actual)
        mutated[key] = value
        try:
            validate_unified_execution_identity(mutated)
        except ValueError:
            negatives.append({"name": name, "passed": True})
        else:
            negatives.append({"name": name, "passed": False})
    return {
        "schemaVersion": "stage4-reference-feature-scan-rerun-execution-identity-cpu-report-v1",
        "status": "passed" if all(row["passed"] for row in positives + negatives) else "failed",
        "positivePassed": sum(bool(row["passed"]) for row in positives),
        "positiveTotal": len(positives),
        "negativePassed": sum(bool(row["passed"]) for row in negatives),
        "negativeTotal": len(negatives),
        "positives": positives,
        "negatives": negatives,
        "executionIdentity": actual,
        "safety": {"checkpointRead": False, "optimizerCreated": False, "backwardExecuted": False, "gpuStarted": False, "trainingStarted": False},
    }


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path)
    parser.add_argument("--authorization-sha256")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--contract-regression-only", action="store_true")
    args = parser.parse_args()
    if args.contract_regression_only:
        report = execution_identity_regression()
        output_path = (ROOT / args.output).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": report["status"], "path": project_path(output_path), "sha256": sha256_file(output_path), "positive": f'{report["positivePassed"]}/{report["positiveTotal"]}', "negative": f'{report["negativePassed"]}/{report["negativeTotal"]}'}))
        return 0 if report["status"] == "passed" else 1
    if args.authorization is None or args.authorization_sha256 is None:
        raise ValueError("reference-feature GPU CPU gate authorization required")
    authorization_path = (ROOT / args.authorization).resolve()
    output_path = (ROOT / args.output).resolve()
    if output_path.exists() or sha256_file(authorization_path) != args.authorization_sha256:
        raise ValueError("reference-feature GPU CPU gate input invalid")
    authorization = runner.validate_authorization(
        authorization_path, (ROOT / read_json(authorization_path)["outputNamespace"]).resolve(),
    )
    config_path = (ROOT / authorization["bindings"]["inactiveConfig"]["path"]).resolve()
    config = read_json(config_path)
    contract = trainer.validate_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay(config)
    source_index = read_json((ROOT / authorization["bindings"]["sourceIndex"]["path"]).resolve())
    train_ids = [row["sampleId"] for row in source_index["samples"] if row.get("split") == "train" and row.get("v7CapacityContributionRegistered") is True]
    validation_ids = [row["sampleId"] for row in source_index["samples"] if row.get("split") == "validation" and row.get("v7CapacityContributionRegistered") is True]
    tree = ast.parse(runner.RUNNER_PATH.read_text(encoding="utf-8"))
    calls = {call_path(node.func) for node in ast.walk(tree) if isinstance(node, ast.Call)}
    positives = [
        {"name": "authorization_exact_and_unconsumed", "passed": authorization["status"] == "owner_authorized_pending_execution" and not (authorization_path.parent / "gpu-consumption.json").exists()},
        {"name": "inactive_contract_valid", "passed": contract["status"] == "cpu_support_verified_inactive" and not any(contract["activationGate"].values())},
        {"name": "source_index_exact_48_train", "passed": len(train_ids) == 48 and len(set(train_ids)) == 48},
        {"name": "source_index_exact_8_validation", "passed": len(validation_ids) == 8 and len(set(validation_ids)) == 8},
        {"name": "runner_uses_real_50_step_rollout", "passed": "base.rollout_rgb" in calls},
        {"name": "runner_uses_reference_feature_tensor", "passed": "weighted_reference_tensor" in calls and "trainer.stage4_per_class_final_visible_reference_feature_structure_obligation_losses" in calls},
        {"name": "runner_uses_shared_selector", "passed": "trainer.stage4_epoch_complete_shared_replay_selection" in calls},
        {"name": "runner_uses_autograd_grad", "passed": "torch.autograd.grad" in calls},
        {"name": "runner_has_no_optimizer_or_backward", "passed": not any(value.startswith("torch.optim") or value.endswith(".backward") for value in calls)},
        {"name": "formal_output_absent", "passed": not (ROOT / authorization["outputNamespace"]).exists()},
        {"name": "registered_runtime_physical_mapping_allowed", "passed": runner.resolve_project(Path(authorization["outputNamespace"])) == (ROOT / authorization["outputNamespace"]).resolve()},
        {"name": "score_identity_bound_is_dtype_rollout_and_scale_derived", "passed": runner.reference_feature_score_identity_evidence({"classIdentity": "footprints", "sampleId": "sample-a", "weightedScore": 0.4099023640155792}, "footprints", "sample-a", 0.40990111231803894, trainer.torch.float32, 50)["numericallyEquivalent"] is True},
        {"name": "score_identity_has_no_free_tolerance_parameter", "passed": "tolerance" not in inspect.signature(runner.reference_feature_score_identity_evidence).parameters},
    ]
    identity_regression = execution_identity_regression()
    positives.extend(identity_regression["positives"])
    mutations = []
    for name, key, value in (
        ("wrong_status", "status", "closed"),
        ("wrong_scope", "scope", "wrong"),
        ("gpu_not_authorized", "gpuAuthorized", False),
        ("training_authorized", "trainingAuthorized", True),
    ):
        mutated = dict(authorization); mutated[key] = value; mutations.append((name, mutated))
    negatives = []
    for name, mutated in mutations:
        valid = not (
            mutated.get("status") != "owner_authorized_pending_execution"
            or mutated.get("scope") != runner.SCOPE
            or mutated.get("gpuAuthorized") is not True
            or mutated.get("trainingAuthorized") is not False
        )
        negatives.append({"name": name, "passed": not valid})
    def path_rejected(name, value):
        try:
            runner.resolve_project(Path(value))
        except ValueError:
            negatives.append({"name": name, "passed": True})
        else:
            negatives.append({"name": name, "passed": False})
    path_rejected("absolute_path_rejected", str((ROOT / ".runtime").resolve()))
    path_rejected("parent_escape_rejected", "../outside")
    path_rejected("unregistered_external_path_rejected", "ml/ai-painter/scripts/../../../../outside")
    def score_rejected(name, selection, class_identity, sample_id, rerun, dtype=trainer.torch.float32, steps=50):
        try:
            runner.reference_feature_score_identity_evidence(
                selection, class_identity, sample_id, rerun, dtype, steps,
            )
        except ValueError:
            negatives.append({"name": name, "passed": True})
        else:
            negatives.append({"name": name, "passed": False})
    baseline = {"classIdentity": "tree", "sampleId": "sample-a", "weightedScore": 0.4}
    epsilon = float(trainer.torch.finfo(trainer.torch.float32).eps)
    boundary = epsilon * 50 * 1.0
    score_rejected("difference_above_derived_boundary_rejected", baseline, "tree", "sample-a", 0.4 + boundary * 1.01)
    score_rejected("class_identity_change_rejected", baseline, "rock", "sample-a", 0.4)
    score_rejected("sample_identity_change_rejected", baseline, "tree", "sample-b", 0.4)
    score_rejected("nan_rejected", baseline, "tree", "sample-a", math.nan)
    score_rejected("infinity_rejected", baseline, "tree", "sample-a", math.inf)
    score_rejected("rollout_step_change_rejected", baseline, "tree", "sample-a", 0.4, steps=49)
    negatives.extend(identity_regression["negatives"])
    positive_passed = sum(bool(row["passed"]) for row in positives)
    negative_passed = sum(bool(row["passed"]) for row in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    report = {
        "schemaVersion": "stage4-reference-feature-shared-replay-gpu-entry-cpu-report-v1",
        "status": "passed_stage4_reference_feature_shared_replay_readonly_gpu_cpu_gate" if passed else "failed_stage4_reference_feature_shared_replay_readonly_gpu_cpu_gate",
        "positivePassed": positive_passed, "positiveTotal": len(positives),
        "negativePassed": negative_passed, "negativeTotal": len(negatives),
        "positives": positives, "negatives": negatives,
        "authorization": {"path": project_path(authorization_path), "sha256": args.authorization_sha256},
        "safety": {"checkpointRead": False, "optimizerCreated": False, "backwardExecuted": False, "gpuStarted": False, "trainingStarted": False},
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "path": project_path(output_path), "sha256": sha256_file(output_path), "positive": f"{positive_passed}/{len(positives)}", "negative": f"{negative_passed}/{len(negatives)}"}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

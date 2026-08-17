from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import ast
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import run_stage4_full_rollout_per_class_final_visible_luminance_structure_gpu_qualification as runner
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def bind(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def rejects(authorization: dict, authorization_path: Path, output: Path, mutate) -> bool:
    candidate = deepcopy(authorization)
    mutate(candidate)
    authorization_path.write_text(
        json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    try:
        runner.validate_authorization(authorization_path, output)
    except (KeyError, TypeError, ValueError):
        return True
    return False


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--config-sha256", required=True)
    parser.add_argument("--cpu-terminal", type=Path, required=True)
    parser.add_argument("--cpu-terminal-sha256", required=True)
    parser.add_argument("--cpu-report", type=Path, required=True)
    parser.add_argument("--cpu-report-sha256", required=True)
    parser.add_argument("--support-contract", type=Path, required=True)
    parser.add_argument("--support-contract-sha256", required=True)
    parser.add_argument("--configuration-audit", type=Path)
    parser.add_argument("--configuration-audit-sha256")
    parser.add_argument("--owner-action-request", type=Path)
    parser.add_argument("--owner-action-request-sha256")
    parser.add_argument("--implementation-authorization", type=Path, required=True)
    parser.add_argument("--implementation-consumption", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    paths = {
        "inactiveConfig": (ROOT / args.config).resolve(),
        "cpuTerminal": (ROOT / args.cpu_terminal).resolve(),
        "cpuReport": (ROOT / args.cpu_report).resolve(),
        "supportContract": (ROOT / args.support_contract).resolve(),
        "implementationAuthorization": (ROOT / args.implementation_authorization).resolve(),
        "implementationConsumption": (ROOT / args.implementation_consumption).resolve(),
        "trainer": Path(trainer.__file__).resolve(),
        "runner": Path(runner.__file__).resolve(),
        "cpuChecker": Path(__file__).resolve(),
        "datasetManifest": runner.resolve(runner.DATASET_PATH),
        "projectAutoencoderCheckpoint": runner.resolve(runner.AUTOENCODER_PATH),
    }
    output_path = (ROOT / args.output).resolve()
    if output_path.exists():
        raise ValueError("GPU qualification CPU report output already exists")
    if sha256_file(paths["inactiveConfig"]) != args.config_sha256:
        raise ValueError("inactive configuration identity changed")
    if sha256_file(paths["cpuTerminal"]) != args.cpu_terminal_sha256:
        raise ValueError("CPU terminal identity changed")
    if sha256_file(paths["cpuReport"]) != args.cpu_report_sha256:
        raise ValueError("CPU report identity changed")
    if sha256_file(paths["supportContract"]) != args.support_contract_sha256:
        raise ValueError("support contract identity changed")
    config = json.loads(paths["inactiveConfig"].read_text(encoding="utf-8"))
    reference_feature_structure = (
        runner.REFERENCE_FEATURE_STRUCTURE_CONTRACT_KEY
        in config.get("training", {})
    )
    worst_sample_class = (
        not reference_feature_structure
        and runner.WORST_SAMPLE_CLASS_CONTRACT_KEY in config.get("training", {})
    )
    if worst_sample_class or reference_feature_structure:
        if args.configuration_audit is None or args.configuration_audit_sha256 is None:
            raise ValueError("configuration audit binding is required")
        paths["configurationAudit"] = (ROOT / args.configuration_audit).resolve()
        if sha256_file(paths["configurationAudit"]) != args.configuration_audit_sha256:
            raise ValueError("configuration audit identity changed")
    if reference_feature_structure:
        if args.owner_action_request is None or args.owner_action_request_sha256 is None:
            raise ValueError("reference feature structure Owner action request binding is required")
        paths["ownerActionRequest"] = (ROOT / args.owner_action_request).resolve()
        if sha256_file(paths["ownerActionRequest"]) != args.owner_action_request_sha256:
            raise ValueError("Owner action request identity changed")
    activated = runner.active_config(config)
    active_contract = (
        trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
            activated
        )
        if reference_feature_structure
        else
        trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            activated
        )
        if worst_sample_class
        else trainer.validate_stage4_full_rollout_per_class_final_visible_luminance_structure_obligation(
            activated
        )
    )
    package = json.loads(paths["datasetManifest"].read_text(encoding="utf-8"))
    readonly_inputs = runner.validate_readonly_diagnostic_inputs(activated, package)

    source = Path(runner.__file__).read_text(encoding="utf-8")
    tree = ast.parse(source)
    calls = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute):
                calls.append(node.func.attr)
            elif isinstance(node.func, ast.Name):
                calls.append(node.func.id)
    positive = {
        "inactive_configuration_identity_valid": True,
        "active_contract_validation_passes": active_contract["status"] == "training_loss_active_owner_authorized",
        "readonly_diagnostic_dataset_identity_is_48_8_4_4": readonly_inputs["identity"]["actualSplitCounts"] == trainer.V7_MVP64_SPLIT_COUNTS,
        "formal_smoke_execution_lineage_not_required": "validate_training_inputs(config, package)" not in source,
        "exact_four_classes_preserved": active_contract["requiredClasses"] == list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS),
        "runner_uses_real_50_step_rollout": "stage4_full_rollout_final_visible_consistency" in calls,
        "runner_uses_torch_autograd_grad": "grad" in calls,
        "runner_uses_worst_sample_class_aggregation": (
            not worst_sample_class
            or "stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses"
            in source
        ),
        "runner_uses_reference_feature_structure_obligation": (
            not reference_feature_structure
            or "stage4_per_class_final_visible_reference_feature_structure_obligation_losses"
            in source
        ),
        "reference_feature_stages_derive_from_frozen_autoencoder": (
            not reference_feature_structure
            or (
                active_contract["featureExtraction"]["autoencoderSource"]
                == "frozen_project_autoencoder"
                and active_contract["featureExtraction"]["spatialStageSelection"]
                == "ordered_unique_spatial_shapes_after_each_existing_encoder_module"
                and active_contract["featureExtraction"][
                    "freeFeatureScaleOrWeightSelectionAllowed"
                ] is False
            )
        ),
        "reference_feature_weights_reuse_formal_derivation": (
            not reference_feature_structure
            or (
                active_contract["sourceContract"]["freeNumericalWeightSelectionAllowed"]
                is False
                and active_contract["aggregation"]["freeNumericalWeightSelectionAllowed"]
                is False
            )
        ),
        "runner_enforces_west_boundary_non_regression": (
            not worst_sample_class
            or "stage4_worst_sample_class_checkpoint_candidate_preserves_west_boundary"
            in source
        ),
        "runner_has_no_optimizer_call": not any(name in {"Adam", "AdamW", "SGD", "Optimizer"} for name in calls),
        "runner_has_no_backward_call": "backward" not in calls,
        "runner_has_no_checkpoint_write": "save" not in calls,
        "project_autoencoder_identity_present": paths["projectAutoencoderCheckpoint"].is_file(),
        "sample194_validation_identity_fixed": runner.SAMPLE_ID.endswith("194-wet-season-drainage-hollow-v6") and runner.SAMPLE_SPLIT == "validation",
    }

    with TemporaryDirectory(prefix="stage4-per-class-rollout-gpu-contract-") as temporary:
        temporary_root = Path(temporary)
        authorization_path = temporary_root / "authorization.json"
        execution_output = (temporary_root / "execution-output").resolve()
        contract_id = (
            trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
            if reference_feature_structure
            else
            trainer.STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
            if worst_sample_class
            else trainer.STAGE4_FULL_ROLLOUT_PER_CLASS_FINAL_VISIBLE_LUMINANCE_STRUCTURE_OBLIGATION_ID
        )
        authorization = {
            "schemaVersion": (
                "ai-painter-stage4-per-class-final-visible-reference-feature-structure-readonly-gpu-authorization-v1"
                if reference_feature_structure
                else
                "ai-painter-stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-authorization-v1"
                if worst_sample_class
                else "ai-painter-stage4-full-rollout-per-class-luminance-readonly-gpu-authorization-v1"
            ),
            "status": "owner_authorized_pending_execution",
            "requestId": "owner-authorized-stage4-full-rollout-per-class-luminance-readonly-gpu-test-20260816-104100000",
            "commandRef": "owner-authorized-stage4-full-rollout-per-class-luminance-readonly-gpu-test-20260816-104100000",
            "scope": (
                "stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_qualification"
                if reference_feature_structure
                else
                "stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_qualification"
                if worst_sample_class
                else "stage4_full_rollout_per_class_final_visible_luminance_structure_readonly_gpu_qualification"
            ),
            "allowedActions": list(runner.EXPECTED_ACTIONS),
            "deniedActions": sorted(runner.FORBIDDEN_ACTIONS),
            "outputNamespace": str(execution_output.resolve()),
            "bindings": {name: bind(path) for name, path in paths.items()},
            "taskIdentity": {
                "contractId": contract_id,
                "sampleId": runner.SAMPLE_ID,
                "sampleSplit": runner.SAMPLE_SPLIT,
                "seed": runner.SEED,
                "imageSize": {"width": 256, "height": 192},
                "topology": "west",
                "rolloutSteps": 50,
                "gradientTailSteps": 5,
                "requiredClasses": list(runner.CLASS_IDENTITIES),
            },
            "consumptionState": {"consumed": False, "consumptionPath": None},
        }
        authorization_path.write_text(json.dumps(authorization, indent=2) + "\n", encoding="utf-8")
        runner.validate_authorization(authorization_path, execution_output)
        positive["exact_authorization_contract_passes"] = True
        negative_mutations = {
            "wrong_hash_rejected": lambda value: value["bindings"]["trainer"].update(sha256="0" * 64),
            "path_injection_rejected": lambda value: value["bindings"]["runner"].update(path="C:/outside/runner.py"),
            "unknown_action_rejected": lambda value: value["allowedActions"].append("unknown_action"),
            "forbidden_action_omission_rejected": lambda value: value["deniedActions"].remove("create_optimizer"),
            "action_conflict_rejected": lambda value: value["deniedActions"].append("execute_cuda_50_step_forward"),
            "wrong_sample_rejected": lambda value: value["taskIdentity"].update(sampleId="old-sample"),
            "wrong_rollout_steps_rejected": lambda value: value["taskIdentity"].update(rolloutSteps=49),
            "wrong_scope_rejected": lambda value: value.update(scope="wrong_scope"),
            "consumed_authorization_rejected": lambda value: value.update(consumptionState={"consumed": True, "consumptionPath": "old.json"}),
            "output_reuse_rejected": lambda value: execution_output.mkdir(parents=True, exist_ok=False),
        }
        negative = {}
        for name, mutate in negative_mutations.items():
            if execution_output.exists():
                execution_output.rmdir()
            negative[name] = rejects(authorization, authorization_path, execution_output, mutate)

    if not all(positive.values()) or not all(negative.values()):
        raise ValueError(f"GPU qualification CPU contract failed: positive={positive}, negative={negative}")
    report = {
        "schemaVersion": (
            "stage4-per-class-final-visible-reference-feature-structure-readonly-gpu-cpu-report-v1"
            if reference_feature_structure
            else
            "stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-cpu-report-v1"
            if worst_sample_class
            else "stage4-full-rollout-per-class-luminance-readonly-gpu-cpu-report-v1"
        ),
        "status": (
            "passed_stage4_per_class_final_visible_reference_feature_structure_readonly_gpu_cpu_gate"
            if reference_feature_structure
            else
            "passed_stage4_full_rollout_worst_sample_class_reference_luminance_readonly_gpu_cpu_gate"
            if worst_sample_class
            else "passed_stage4_full_rollout_per_class_luminance_readonly_gpu_cpu_gate"
        ),
        "bindings": {name: bind(path) for name, path in paths.items()},
        "positive": positive,
        "negative": negative,
        "positivePassed": sum(positive.values()),
        "positiveTotal": len(positive),
        "negativePassed": sum(negative.values()),
        "negativeTotal": len(negative),
        "executionBoundary": {
            "checkpointWeightsRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "gpuUsed": False,
            "trainingStarted": False,
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
        "positive": f"{report['positivePassed']}/{report['positiveTotal']}",
        "negative": f"{report['negativePassed']}/{report['negativeTotal']}",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

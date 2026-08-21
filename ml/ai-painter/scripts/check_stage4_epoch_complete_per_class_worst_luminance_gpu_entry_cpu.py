from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import ast
import hashlib
import json
from pathlib import Path
import tempfile

import run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification as runner
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def project_path(path: Path) -> str:
    resolved = path.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def call_path(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = call_path(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    authorization_path = (ROOT / args.authorization).resolve()
    output_path = (ROOT / args.output).resolve()
    if output_path.exists():
        raise ValueError("epoch-complete GPU CPU report already exists")
    if sha256_file(authorization_path) != args.authorization_sha256:
        raise ValueError("epoch-complete GPU authorization changed")
    authorization = read_json(authorization_path)
    formal_output = (ROOT / authorization["outputNamespace"]).resolve()
    validated = runner.validate_authorization(authorization_path, formal_output)
    inactive_config_path = (
        ROOT / authorization["bindings"]["inactiveConfig"]["path"]
    ).resolve()
    config = read_json(inactive_config_path)
    contract = trainer.validate_stage4_epoch_complete_per_class_worst_luminance_selection(
        config
    )
    source_index = read_json(
        (ROOT / authorization["bindings"]["sourceIndex"]["path"]).resolve()
    )
    train_ids = [
        row["sampleId"] for row in source_index.get("samples", [])
        if row.get("split") == "train"
        and row.get("v7CapacityContributionRegistered") is True
    ]
    validation_ids = [
        row["sampleId"] for row in source_index.get("samples", [])
        if row.get("split") == "validation"
        and row.get("v7CapacityContributionRegistered") is True
    ]
    runner_source = Path(runner.__file__).read_text(encoding="utf-8")
    runner_ast = ast.parse(runner_source)
    calls = {
        call_path(node.func) for node in ast.walk(runner_ast)
        if isinstance(node, ast.Call)
    }
    positives = [
        {"name": "authorization_exact_contract_passes", "passed": validated == authorization},
        {"name": "bound_cpu_terminal_exact", "passed": authorization["bindings"]["cpuTerminal"]["sha256"] == "8f6eb4e98e2fa14464c7f0bd4518d3bb67179a16d953b70ce0216dcf020e869d"},
        {"name": "bound_cpu_report_exact", "passed": authorization["bindings"]["cpuReport"]["sha256"] == "2f3ab0987bfdc91cc52b4764620b5489618df0579c36f7717833f676dde95e1f"},
        {"name": "bound_inactive_config_exact", "passed": authorization["bindings"]["inactiveConfig"]["sha256"] == "2945c28e537f417437a3164c32625967882b3c06774a7407d60499c7b3aaf53a"},
        {"name": "bound_support_contract_exact", "passed": authorization["bindings"]["supportContract"]["sha256"] == "d0618b9679431951208b2ba4427d3f2c8d118524c2e6f682130f936ac5c74c85"},
        {"name": "inactive_contract_valid", "passed": contract["status"] == "cpu_support_verified_inactive" and not any(contract["activationGate"].values())},
        {"name": "source_index_exact_48_train", "passed": len(train_ids) == 48 and len(set(train_ids)) == 48},
        {"name": "source_index_exact_8_validation", "passed": len(validation_ids) == 8 and len(set(validation_ids)) == 8},
        {"name": "runner_uses_complete_train_ledger", "passed": "trainer.stage4_epoch_complete_per_class_selection_ledger" in calls and "trainer.stage4_collect_epoch_complete_per_class_selection_scores" in calls and "trainer.stage4_finalize_epoch_complete_per_class_selection" in calls},
        {"name": "runner_uses_real_50_step_rollout", "passed": "rollout_rgb" in calls and "model.predict_velocity" in calls and "trainer.deterministic_velocity_step" in calls},
        {"name": "runner_recomputes_selected_autograd_grad", "passed": "torch.autograd.grad" in calls and "trainer.stage4_epoch_complete_selected_luminance_replay_loss_from_tensor" in calls},
        {"name": "runner_computes_formal_train_normalization", "passed": "trainer.compute_latent_normalization" in calls},
        {"name": "runner_uses_all_validation_seeds", "passed": "checkpointRolloutSeedsPerSample" in runner_source and "validation_entries" in runner_source},
        {"name": "runner_persists_exact_checkpoint_identity", "passed": all(name in runner_source for name in ("classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore", "validationCheckpointSelectionScore"))},
        {"name": "runner_checks_model_state_unchanged", "passed": "epoch_complete_gpu_model_state_changed" in runner_source and "state_dict_sha256" in calls},
        {"name": "runner_has_no_optimizer_backward_or_checkpoint_write", "passed": not any(name.endswith(".backward") or name.startswith("torch.optim.") or name == "torch.save" for name in calls)},
        {"name": "formal_output_absent_before_cpu_gate", "passed": not formal_output.exists()},
    ]

    mutations = []
    def mutate(name, action):
        value = deepcopy(authorization)
        action(value)
        mutations.append((name, value))
    mutate("wrong_schema", lambda value: value.update({"schemaVersion": "historical"}))
    mutate("wrong_status", lambda value: value.update({"status": "consumed"}))
    mutate("request_command_mismatch", lambda value: value.update({"commandRef": "other"}))
    mutate("wrong_scope", lambda value: value.update({"scope": "training"}))
    mutate("action_missing", lambda value: value["allowedActions"].pop())
    mutate("optimizer_allowed", lambda value: value.update({"optimizerCreationAuthorized": True}))
    mutate("backward_allowed", lambda value: value.update({"backwardExecutionAuthorized": True}))
    mutate("training_allowed", lambda value: value.update({"trainingAuthorized": True}))
    mutate("old_denoiser_allowed", lambda value: value.update({"oldDenoiserCheckpointReadAuthorized": True}))
    mutate("wrong_train_population", lambda value: value["taskIdentity"].update({"trainPopulation": "first_four"}))
    mutate("wrong_validation_population", lambda value: value["taskIdentity"].update({"validationPopulation": "sample194"}))
    mutate("wrong_seed", lambda value: value["taskIdentity"].update({"seed": 1}))
    mutate("wrong_rollout_steps", lambda value: value["taskIdentity"].update({"rolloutSteps": 49}))
    mutate("binding_sha_changed", lambda value: value["bindings"]["cpuTerminal"].update({"sha256": "0" * 64}))
    mutate("binding_path_external", lambda value: value["bindings"]["cpuReport"].update({"path": "C:/outside.json"}))
    mutate("binding_missing", lambda value: value["bindings"].pop("sourceIndex"))
    mutate("consumption_reuse", lambda value: value.update({"consumptionState": {"consumed": True, "consumptionPath": "old"}}))
    mutate("existing_output", lambda value: value.update({"outputNamespace": ".runtime"}))
    negatives = []
    with tempfile.TemporaryDirectory(prefix="ai-painter-epoch-complete-gpu-cpu-") as directory:
        fixture_root = Path(directory)
        for index, (name, value) in enumerate(mutations):
            fixture_path = fixture_root / f"fixture-{index:02d}.json"
            fixture_path.write_text(
                json.dumps(value, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            try:
                runner.validate_authorization(fixture_path, formal_output)
            except (KeyError, TypeError, ValueError):
                negatives.append({"name": name, "passed": True})
            else:
                negatives.append({"name": name, "passed": False})

    positive_passed = sum(bool(row["passed"]) for row in positives)
    negative_passed = sum(bool(row["passed"]) for row in negatives)
    passed = positive_passed == len(positives) and negative_passed == len(negatives)
    report = {
        "schemaVersion": "stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-cpu-report-v1",
        "status": (
            "passed_stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_cpu_gate"
            if passed else
            "failed_stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_cpu_gate"
        ),
        "positivePassed": positive_passed, "positiveTotal": len(positives),
        "negativePassed": negative_passed, "negativeTotal": len(negatives),
        "positives": positives, "negatives": negatives,
        "trainIdentityCount": len(train_ids),
        "validationIdentityCount": len(validation_ids),
        "safety": {
            "checkpointRead": False, "gpuStarted": False, "optimizerCreated": False,
            "backwardExecuted": False, "modelWeightsModified": False,
            "trainingStarted": False, "formalOutputCreated": False,
        },
        "authorization": {"path": project_path(authorization_path), "sha256": args.authorization_sha256},
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    print(json.dumps({
        "status": report["status"], "path": project_path(output_path),
        "sha256": sha256_file(output_path),
        "positive": f"{positive_passed}/{len(positives)}",
        "negative": f"{negative_passed}/{len(negatives)}",
    }))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

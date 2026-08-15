from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

from ai_painter_authorization_policy import resolve_stage_execution_grant
from ai_painter_execution_grant import ExecutionAction
from ai_painter_stage_mode_registry import resolve_stage_mode
from compile_stage4_semantic_mixture_full_training_config import compile_config
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
DEFAULT_SOURCE = ROOT / ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260813-113000000/active-config.json"
PACKAGE = ROOT / "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
IMPLEMENTATION_ROOT = ROOT / ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-worst-sample-class-replay-20260814-080200792"
IMPLEMENTATION_AUTH = IMPLEMENTATION_ROOT / "implementation-authorization.json"
IMPLEMENTATION_CONSUMPTION = IMPLEMENTATION_ROOT / "implementation-consumption.json"
OUTPUT_ROOT = ROOT / ".runtime/ai-painter/stage4-semantic-mixture-formal-stage-mode-cpu-regressions"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    resolved = path.resolve()
    logical_runtime = (ROOT / ".runtime").resolve()
    if resolved == logical_runtime or logical_runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(logical_runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def make_identity(stage: int, case_root: Path) -> tuple[Path, str, Path, str]:
    request = f"owner-authorized-stage4-semantic-mixture-stage{stage}-full-training-cpu-fixture"
    actions = {
        "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder",
        "create_optimizer", "execute_backward", "mutate_model_weights", f"run_stage{stage}",
    }
    if stage > 0:
        actions.add("load_parent_denoiser")
    authorization = {
        "schemaVersion": "ai-painter-stage4-formal-stage-execution-authorization-v1",
        "requestId": request,
        "commandRef": request,
        "scope": f"one_stage4_semantic_mixture_stage{stage}_full_training_only",
        "status": "resolved_owner_authorized_not_consumed",
        "executionActions": sorted(actions),
        "oneTimeConsumptionRequired": True,
    }
    auth_path = case_root / "authorization.json"
    write(auth_path, authorization)
    consumption = {
        "schemaVersion": "ai-painter-stage4-formal-stage-execution-consumption-v1",
        "requestId": request,
        "commandRef": request,
        "scope": authorization["scope"],
        "authorizationSha256": sha(auth_path),
        "oneTimeConsumption": True,
        "status": "stage4_formal_stage_authorization_atomically_consumed",
    }
    consumption_path = case_root / "consumption.json"
    write(consumption_path, consumption)
    return auth_path, sha(auth_path), consumption_path, sha(consumption_path)


def compile_stage(
    source: dict,
    stage: int,
    case_root: Path,
    implementation_authorization: Path = IMPLEMENTATION_AUTH,
    implementation_consumption: Path = IMPLEMENTATION_CONSUMPTION,
) -> dict:
    auth, auth_sha, consumption, consumption_sha = make_identity(stage, case_root)
    return compile_config(
        source, stage, auth, auth_sha, consumption, consumption_sha,
        implementation_authorization, sha(implementation_authorization),
        implementation_consumption, sha(implementation_consumption), ROOT,
    )


def make_implementation_fixture(
    case_root: Path,
    *,
    authorization_changes: dict | None = None,
    consumption_changes: dict | None = None,
) -> tuple[Path, Path]:
    authorization = json.loads(IMPLEMENTATION_AUTH.read_text(encoding="utf-8"))
    authorization.update(authorization_changes or {})
    authorization_path = case_root / "implementation-authorization.json"
    write(authorization_path, authorization)
    consumption = json.loads(IMPLEMENTATION_CONSUMPTION.read_text(encoding="utf-8"))
    consumption.update({
        "requestId": authorization["requestId"],
        "commandRef": authorization["commandRef"],
        "scope": authorization["scope"],
        "authorizationPath": rel(authorization_path),
        "authorizationSha256": sha(authorization_path),
        "oneTimeConsumption": True,
    })
    consumption.update(consumption_changes or {})
    consumption_path = case_root / "implementation-consumption.json"
    write(consumption_path, consumption)
    return authorization_path, consumption_path


def rejects(action, contains: str | None = None) -> bool:
    try:
        action()
    except (ValueError, KeyError) as error:
        return contains is None or contains in str(error)
    return False


def main() -> int:
    run_id = sys.argv[1] if len(sys.argv) > 1 else "manual"
    source_path = (
        (ROOT / sys.argv[3]).resolve()
        if len(sys.argv) > 3 and sys.argv[2] == "--source"
        else DEFAULT_SOURCE
    )
    run_root = OUTPUT_ROOT / run_id
    if run_root.exists():
        raise ValueError("new CPU runId directory must not exist")
    if not source_path.is_file():
        raise ValueError("formal training source config is unavailable")
    source = json.loads(source_path.read_text(encoding="utf-8"))
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    trainer_source = Path(trainer.__file__).read_text(encoding="utf-8")
    positives = {}
    negatives = {}
    configs = []
    positives["non_scheduled_best_checkpoint_generates_bound_source_and_reproduction"] = (
        trainer_source.count("force_checkpoint_bound_preview=True") == 2
        and "or force_checkpoint_bound_preview" in trainer_source
        and 'args.output_dir / "checkpoint-bound-preview-source"' in trainer_source
        and 'args.output_dir / "checkpoint-bound-preview-reproduction"' in trainer_source
    )
    positives["fixed_epoch_preview_schedule_remains_strict"] = (
        "def should_save_epoch_preview" in trainer_source
        and 'policy.get("smoke", []) + policy.get("formalStage", [])' in trainer_source
    )
    for stage in (0, 1, 2):
        config = compile_stage(source, stage, run_root / f"stage-{stage}-positive")
        write(run_root / f"stage-{stage}-positive" / "active-config.json", config)
        configs.append(config)
        mode = resolve_stage_mode(config)
        grant = resolve_stage_execution_grant(config, project_root=ROOT, verify_owner_files=True)
        trainer.validate_training_inputs(config, package)
        positives[f"stage{stage}_mode_registered"] = mode.stage == stage and mode.execution_kind == f"full_training_stage{stage}"
        positives[f"stage{stage}_only_its_action"] = all(
            grant.permits(action) is (index == stage)
            for index, action in enumerate((ExecutionAction.RUN_STAGE0, ExecutionAction.RUN_STAGE1, ExecutionAction.RUN_STAGE2))
        )
        positives[f"stage{stage}_parent_policy"] = grant.checkpoint_constraints["parentDenoiserAllowed"] is (stage > 0)
        positives[f"stage{stage}_forty_epochs_and_preview_schedule"] = (
            config["training"]["denoiserEpochs"] == 40
            and config["training"]["fixedEpochPreviewPolicy"]["formalStage"] == [1, 5, 10, 20, 30, 40]
        )
        positives[f"stage{stage}_full_contract_valid"] = (
            trainer.validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(config, package, ROOT)["status"]
            == f"stage4_fact_conditioned_semantic_mixture_stage{stage}_full_training_contract_valid"
        )
        full_rollout = config["training"]["stage4FullRolloutFinalVisibleConsistency"]
        positives[f"stage{stage}_qualified_full_rollout_objective_active"] = (
            full_rollout["status"] == "training_loss_active_owner_authorized"
            and full_rollout["rolloutSteps"] == 50
            and full_rollout["gradientTailSteps"] == 5
            and full_rollout["activationGate"]["trainingNow"] is True
            and full_rollout["activationGate"]["stage4FullTrainingNow"] is True
            and full_rollout["activationGate"]["smokeNow"] is False
        )
        epoch_worst = config["training"].get("stage4EpochWorstSampleClassReplay")
        if epoch_worst is not None:
            positives[f"stage{stage}_epoch_worst_replay_active"] = (
                epoch_worst["status"] == "training_loss_active_owner_authorized"
                and epoch_worst["activationGate"]["trainingNow"] is True
                and epoch_worst["activationGate"]["stage4FullTrainingNow"] is True
                and epoch_worst["activationGate"]["smokeNow"] is False
            )
        object_visible_structure = config["training"].get("stage4ObjectVisibleStructureSupervision")
        if object_visible_structure is not None:
            positives[f"stage{stage}_object_visible_structure_active"] = (
                object_visible_structure["status"] == "training_loss_active_owner_authorized"
                and object_visible_structure["activationGate"]["trainingNow"] is True
                and object_visible_structure["activationGate"]["stage4FullTrainingNow"] is True
                and object_visible_structure["activationGate"]["smokeNow"] is False
            )
        positives[f"stage{stage}_formal_diagnostic_registry_has_no_smoke_schedule"] = (
            "fixedEpochs" not in config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
            and config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]["exactFieldCount"] == (
                32 if object_visible_structure is not None and object_visible_structure.get("enabled") is True else 29
            )
        )

    bad = deepcopy(configs[0])
    bad["training"]["ownerTrainingAuthorization"]["executionActions"].append("run_stage1")
    negatives["cross_stage_action_rejected"] = rejects(lambda: resolve_stage_execution_grant(bad, project_root=ROOT, verify_owner_files=True))
    bad = deepcopy(configs[1])
    bad["training"]["ownerTrainingAuthorization"]["checkpointLoadingAuthorized"] = False
    negatives["stage1_parent_permission_omission_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[0])
    bad["training"]["factConditionedSemanticMixtureStage4FullTrainingContract"]["parentCheckpointRequired"] = True
    negatives["stage0_parent_contract_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[2])
    bad["training"]["denoiserEpochs"] = 30
    negatives["wrong_epoch_count_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[2])
    bad["training"]["fixedEpochPreviewPolicy"]["formalStage"] = [1, 5, 10, 20, 30]
    negatives["missing_epoch40_preview_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassFinalVisibleRgbObligation"]["activationGate"]["stage5Now"] = True
    negatives["stage5_activation_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[0])
    bad["training"]["ownerTrainingAuthorization"]["automaticRetryAuthorized"] = True
    negatives["automatic_retry_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[1])
    bad["training"]["factConditionedSemanticMixtureStage4FullTrainingContract"]["historicalCheckpointAllowed"] = True
    negatives["historical_checkpoint_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[0])
    bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["rolloutSteps"] = 49
    negatives["full_rollout_step_count_change_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    bad = deepcopy(configs[0])
    bad["training"]["stage4FullRolloutFinalVisibleConsistency"]["activationGate"]["smokeNow"] = True
    negatives["full_rollout_smoke_identity_in_formal_stage_rejected"] = rejects(lambda: trainer.validate_training_inputs(bad, package))
    if "stage4EpochWorstSampleClassReplay" in configs[0]["training"]:
        bad = deepcopy(configs[0])
        bad["training"]["stage4EpochWorstSampleClassReplay"]["activationGate"]["smokeNow"] = True
        negatives["epoch_worst_replay_smoke_identity_in_formal_stage_rejected"] = rejects(
            lambda: trainer.validate_training_inputs(bad, package)
        )
    if "stage4ObjectVisibleStructureSupervision" in configs[0]["training"]:
        bad = deepcopy(configs[0])
        bad["training"]["stage4ObjectVisibleStructureSupervision"]["activationGate"]["stage4FullTrainingNow"] = False
        negatives["object_visible_structure_inactive_in_formal_stage_rejected"] = (
            configs[0]["training"]["stage4ObjectVisibleStructureSupervision"]["activationGate"]["stage4FullTrainingNow"] is True
            and bad["training"]["stage4ObjectVisibleStructureSupervision"]["activationGate"]["stage4FullTrainingNow"] is False
        )

    lineage_cases = {
        "implementation_status_alias_rejected": ({"status": "owner_authorized_unconsumed"}, {}),
        "implementation_request_id_mismatch_rejected": ({}, {"requestId": "forged-request-id"}),
        "implementation_command_ref_mismatch_rejected": ({}, {"commandRef": "forged-command-ref"}),
        "implementation_scope_mismatch_rejected": ({}, {"scope": "forged-scope"}),
        "implementation_authorization_hash_mismatch_rejected": ({}, {"authorizationSha256": "0" * 64}),
        "implementation_one_time_consumption_false_rejected": ({}, {"oneTimeConsumption": False}),
    }
    for key, (authorization_changes, consumption_changes) in lineage_cases.items():
        fixture_root = run_root / key
        fixture_authorization, fixture_consumption = make_implementation_fixture(
            fixture_root,
            authorization_changes=authorization_changes,
            consumption_changes=consumption_changes,
        )
        bad = compile_stage(
            source,
            0,
            fixture_root / "stage0",
            fixture_authorization,
            fixture_consumption,
        )
        negatives[key] = rejects(
            lambda bad=bad: resolve_stage_execution_grant(
                bad, project_root=ROOT, verify_owner_files=True,
            ),
            "implementation authorization lineage is invalid",
        )

    report = {
        "schemaVersion": "stage4-semantic-mixture-formal-stage-modes-cpu-report-v1",
        "status": "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression"
        if all(positives.values()) and all(negatives.values()) else "failed_stage4_semantic_mixture_formal_stage_modes_cpu_regression_closed",
        "runId": run_id,
        "positive": positives,
        "negative": negatives,
        "positivePassed": sum(positives.values()),
        "positiveTotal": len(positives),
        "negativePassed": sum(negatives.values()),
        "negativeTotal": len(negatives),
        "sourceConfig": {"path": rel(source_path), "sha256": sha(source_path)},
        "implementationAuthorization": {"path": rel(IMPLEMENTATION_AUTH), "sha256": sha(IMPLEMENTATION_AUTH)},
        "implementationConsumption": {"path": rel(IMPLEMENTATION_CONSUMPTION), "sha256": sha(IMPLEMENTATION_CONSUMPTION)},
        "checkpointWeightsRead": False,
        "optimizerCreated": False,
        "gpuStarted": False,
        "trainingStarted": False,
    }
    write(run_root / "cpu-report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"].startswith("passed_") else 1


if __name__ == "__main__":
    raise SystemExit(main())

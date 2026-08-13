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
SOURCE = ROOT / ".runtime/ai-painter/stage4-vegetation-luminance-spatial-structure-supervision/20260813-034000000/inactive-config.json"
PACKAGE = ROOT / "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
IMPLEMENTATION_ROOT = ROOT / ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-semantic-mixture-formal-stage-modes-20260813-043747447"
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


def compile_stage(source: dict, stage: int, case_root: Path) -> dict:
    auth, auth_sha, consumption, consumption_sha = make_identity(stage, case_root)
    return compile_config(
        source, stage, auth, auth_sha, consumption, consumption_sha,
        IMPLEMENTATION_AUTH, sha(IMPLEMENTATION_AUTH),
        IMPLEMENTATION_CONSUMPTION, sha(IMPLEMENTATION_CONSUMPTION), ROOT,
    )


def rejects(action, contains: str | None = None) -> bool:
    try:
        action()
    except (ValueError, KeyError) as error:
        return contains is None or contains in str(error)
    return False


def main() -> int:
    run_id = sys.argv[1] if len(sys.argv) > 1 else "manual"
    run_root = OUTPUT_ROOT / run_id
    if run_root.exists():
        raise ValueError("new CPU runId directory must not exist")
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
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
        "sourceConfig": {"path": rel(SOURCE), "sha256": sha(SOURCE)},
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

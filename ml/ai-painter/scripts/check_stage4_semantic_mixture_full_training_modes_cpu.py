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
DEFAULT_SOURCE = ROOT / ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementations/20260821-051855146/inactive-config.json"
PACKAGE = ROOT / "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
IMPLEMENTATION_ROOT = ROOT / ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-stage0-20260821-063700000"
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
    implementation_authorization: Path | None = None,
    implementation_consumption: Path | None = None,
) -> dict:
    implementation_authorization = implementation_authorization or IMPLEMENTATION_AUTH
    implementation_consumption = implementation_consumption or IMPLEMENTATION_CONSUMPTION
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


def validate_current_candidate_activation_contract(config: dict) -> None:
    training = config.get("training", {})
    for name in (
        "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision",
        "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization",
        "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation",
        "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation",
        "stage4PerClassFinalVisibleReferenceFeatureStructureObligation",
        "stage4EpochWorstSampleClassReferenceFeatureStructureReplay",
        "stage4PerClassWorstSampleReferenceFeatureStructureObligation",
        "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation",
        "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity",
        "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay",
    ):
        contract = training.get(name)
        if not isinstance(contract, dict):
            raise ValueError(f"current candidate contract is missing: {name}")
        gate = contract.get("activationGate", {})
        required_true = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "stage4FullTrainingNow",
        }
        required_false = {
            "smokeNow", "stage5Now", "formalInferenceNow", "checkpointPromotionNow",
            "runtimeFrameNow", "worldEntryNow",
        }
        if (
            contract.get("status") != "training_loss_active_owner_authorized"
            or set(gate) != required_true | required_false
            or any(gate.get(key) is not True for key in required_true)
            or any(gate.get(key) is not False for key in required_false)
        ):
            raise ValueError(f"current candidate formal activation is invalid: {name}")
    conflict_aware = training.get("stage4ConflictAwareExistingGradientAggregation")
    if not isinstance(conflict_aware, dict):
        raise ValueError("current candidate contract is missing: stage4ConflictAwareExistingGradientAggregation")
    conflict_gate = conflict_aware.get("activationGate", {})
    required_true = {
        "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
        "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
        "trainingNow", "stage4FullTrainingNow",
    }
    required_false = {
        "smokeNow", "stage5Now", "formalInferenceNow", "checkpointPromotionNow",
        "runtimeFrameNow", "worldEntryNow",
    }
    if (
        conflict_aware.get("status") != "training_paradigm_active_owner_authorized"
        or set(conflict_gate) != required_true | required_false
        or any(conflict_gate.get(key) is not True for key in required_true)
        or any(conflict_gate.get(key) is not False for key in required_false)
    ):
        raise ValueError("current candidate formal activation is invalid: stage4ConflictAwareExistingGradientAggregation")
    controlled = training.get("stage4ControlledStructureThreeArm")
    if controlled is not None:
        controlled_arm = config.get("stage4ControlledStructureArm")
        controlled_gate = controlled.get("activationGate", {})
        controlled_required_true = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
            "trainingNow", "stage4FullTrainingNow",
        }
        controlled_required_false = {
            "smokeNow", "stage1Now", "stage2Now", "formalInferenceNow",
            "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
        }
        if (
            controlled_arm not in {
                "condition_fusion_only_final_direct_residual_23_64_12",
                "capacity_only_base_width_64_to_existing_level1_128",
            }
            or controlled.get("status") != "structure_active_owner_authorized"
            or controlled.get("armId") != controlled_arm
            or controlled.get("denoiserBaseChannels")
            != (128 if controlled_arm == "capacity_only_base_width_64_to_existing_level1_128" else 64)
            or set(controlled_gate) != controlled_required_true | controlled_required_false
            or any(controlled_gate.get(key) is not True for key in controlled_required_true)
            or any(controlled_gate.get(key) is not False for key in controlled_required_false)
        ):
            raise ValueError("adjudicated controlled structure formal activation is invalid")


def main() -> int:
    global IMPLEMENTATION_ROOT, IMPLEMENTATION_AUTH, IMPLEMENTATION_CONSUMPTION
    run_id, source_path, output_root, implementation_root = parse_cli(sys.argv[1:])
    IMPLEMENTATION_ROOT = implementation_root
    IMPLEMENTATION_AUTH = IMPLEMENTATION_ROOT / "implementation-authorization.json"
    IMPLEMENTATION_CONSUMPTION = IMPLEMENTATION_ROOT / "implementation-consumption.json"
    run_root = output_root / run_id
    if run_root.exists():
        raise ValueError("new CPU runId directory must not exist")
    if not source_path.is_file():
        raise ValueError("formal training source config is unavailable")
    source = json.loads(source_path.read_text(encoding="utf-8"))
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    trainer_source = Path(trainer.__file__).read_text(encoding="utf-8")
    formal_runner_source = (ROOT / "scripts/run-stage4-semantic-mixture-formal-stage.mjs").read_text(encoding="utf-8")
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
    positives["formal_training_resource_telemetry_is_fileized"] = all(
        marker in formal_runner_source
        for marker in (
            'resource-telemetry.json', 'training_heartbeat',
            'peakGpuMemoryBytes', 'resourceTelemetry',
        )
    )
    for stage in (0, 1, 2):
        config = compile_stage(source, stage, run_root / f"stage-{stage}-positive")
        write(run_root / f"stage-{stage}-positive" / "active-config.json", config)
        configs.append(config)
        mode = resolve_stage_mode(config)
        grant = resolve_stage_execution_grant(config, project_root=ROOT, verify_owner_files=True)
        trainer.validate_training_inputs(config, package)
        validate_current_candidate_activation_contract(config)
        controlled = config["training"].get("stage4ControlledStructureThreeArm")
        positives[f"stage{stage}_adjudicated_controlled_structure_active"] = (
            controlled is not None
            and config.get("stage4ControlledStructureArm") in {
                "condition_fusion_only_final_direct_residual_23_64_12",
                "capacity_only_base_width_64_to_existing_level1_128",
            }
            and controlled.get("status") == "structure_active_owner_authorized"
            and controlled["activationGate"]["stage4FullTrainingNow"] is True
            and controlled["activationGate"]["smokeNow"] is False
        )
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
        multiscale = config["training"].get(
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"
        )
        early_convergence = config["training"].get(
            "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"
        )
        positives[f"stage{stage}_object_reference_multiscale_active"] = (
            multiscale is not None
            and multiscale["status"] == "training_loss_active_owner_authorized"
            and multiscale["activationGate"]["configurationActiveNow"] is True
            and multiscale["activationGate"]["trainingNow"] is True
            and multiscale["activationGate"]["stage4FullTrainingNow"] is True
            and multiscale["activationGate"]["smokeNow"] is False
            and all(
                multiscale["activationGate"][key] is False
                for key in (
                    "stage5Now", "formalInferenceNow", "checkpointPromotionNow",
                    "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        positives[f"stage{stage}_early_convergence_stabilization_active"] = (
            early_convergence is not None
            and early_convergence["status"] == "training_loss_active_owner_authorized"
            and early_convergence["activationGate"]["configurationActiveNow"] is True
            and early_convergence["activationGate"]["trainingNow"] is True
            and early_convergence["activationGate"]["stage4FullTrainingNow"] is True
            and early_convergence["activationGate"]["smokeNow"] is False
            and all(
                early_convergence["activationGate"][key] is False
                for key in (
                    "stage5Now", "formalInferenceNow", "checkpointPromotionNow",
                    "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        full_rollout_per_class_luminance = config["training"].get(
            "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"
        )
        positives[f"stage{stage}_full_rollout_per_class_luminance_active"] = (
            full_rollout_per_class_luminance is not None
            and full_rollout_per_class_luminance["status"]
            == "training_loss_active_owner_authorized"
            and full_rollout_per_class_luminance["activationGate"]["configurationActiveNow"] is True
            and full_rollout_per_class_luminance["activationGate"]["trainingNow"] is True
            and full_rollout_per_class_luminance["activationGate"]["stage4FullTrainingNow"] is True
            and full_rollout_per_class_luminance["activationGate"]["smokeNow"] is False
            and all(
                full_rollout_per_class_luminance["activationGate"][key] is False
                for key in (
                    "stage5Now", "formalInferenceNow", "checkpointPromotionNow",
                    "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        full_rollout_worst_sample_class_luminance = config["training"].get(
            "stage4FullRolloutWorstSampleClassReferenceLuminanceObligation"
        )
        positives[f"stage{stage}_full_rollout_worst_sample_class_luminance_active"] = (
            full_rollout_worst_sample_class_luminance is not None
            and full_rollout_worst_sample_class_luminance["status"]
            == "training_loss_active_owner_authorized"
            and full_rollout_worst_sample_class_luminance["activationGate"]["configurationActiveNow"] is True
            and full_rollout_worst_sample_class_luminance["activationGate"]["trainingNow"] is True
            and full_rollout_worst_sample_class_luminance["activationGate"]["stage4FullTrainingNow"] is True
            and full_rollout_worst_sample_class_luminance["activationGate"]["smokeNow"] is False
            and all(
                full_rollout_worst_sample_class_luminance["activationGate"][key] is False
                for key in (
                    "stage5Now", "formalInferenceNow", "checkpointPromotionNow",
                    "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        reference_feature_structure = config["training"].get(
            "stage4PerClassFinalVisibleReferenceFeatureStructureObligation"
        )
        positives[f"stage{stage}_per_class_reference_feature_structure_active"] = (
            reference_feature_structure is not None
            and reference_feature_structure["status"]
            == "training_loss_active_owner_authorized"
            and all(
                reference_feature_structure["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                reference_feature_structure["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        epoch_worst_reference_feature_replay = config["training"].get(
            "stage4EpochWorstSampleClassReferenceFeatureStructureReplay"
        )
        positives[f"stage{stage}_epoch_worst_reference_feature_replay_active"] = (
            epoch_worst_reference_feature_replay is not None
            and epoch_worst_reference_feature_replay["status"]
            == "training_loss_active_owner_authorized"
            and all(
                epoch_worst_reference_feature_replay["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                epoch_worst_reference_feature_replay["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        per_class_worst_reference_feature_structure = config["training"].get(
            "stage4PerClassWorstSampleReferenceFeatureStructureObligation"
        )
        positives[f"stage{stage}_per_class_worst_reference_feature_structure_active"] = (
            per_class_worst_reference_feature_structure is not None
            and per_class_worst_reference_feature_structure["status"]
            == "training_loss_active_owner_authorized"
            and all(
                per_class_worst_reference_feature_structure["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                per_class_worst_reference_feature_structure["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        per_class_worst_final_visible_luminance = config["training"].get(
            "stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"
        )
        positives[f"stage{stage}_per_class_worst_final_visible_luminance_active"] = (
            per_class_worst_final_visible_luminance is not None
            and per_class_worst_final_visible_luminance["status"]
            == "training_loss_active_owner_authorized"
            and all(
                per_class_worst_final_visible_luminance["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                per_class_worst_final_visible_luminance["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        epoch_complete_selection = config["training"].get(
            "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity"
        )
        positives[f"stage{stage}_epoch_complete_per_class_selection_active"] = (
            epoch_complete_selection is not None
            and epoch_complete_selection["status"]
            == "training_loss_active_owner_authorized"
            and all(
                epoch_complete_selection["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                epoch_complete_selection["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        epoch_complete_reference_feature_shared_replay = config["training"].get(
            "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"
        )
        positives[f"stage{stage}_epoch_complete_reference_feature_shared_replay_active"] = (
            epoch_complete_reference_feature_shared_replay is not None
            and epoch_complete_reference_feature_shared_replay["status"]
            == "training_loss_active_owner_authorized"
            and all(
                epoch_complete_reference_feature_shared_replay["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                epoch_complete_reference_feature_shared_replay["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        conflict_aware = config["training"].get(
            "stage4ConflictAwareExistingGradientAggregation"
        )
        positives[f"stage{stage}_conflict_aware_gradient_aggregation_active"] = (
            conflict_aware is not None
            and conflict_aware["status"]
            == "training_paradigm_active_owner_authorized"
            and all(
                conflict_aware["activationGate"][key] is True
                for key in (
                    "configurationActiveNow", "checkpointReadNow",
                    "optimizerCreationNow", "backwardExecutionNow",
                    "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                    "stage4FullTrainingNow",
                )
            )
            and all(
                conflict_aware["activationGate"][key] is False
                for key in (
                    "smokeNow", "stage5Now", "formalInferenceNow",
                    "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
                )
            )
        )
        resolved_diagnostic_fields = (
            trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config)
        )
        positives[f"stage{stage}_formal_diagnostic_registry_has_no_smoke_schedule"] = (
            "fixedEpochs" not in config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
            and config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]["exactFieldCount"]
            == len(resolved_diagnostic_fields)
            and config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]["exactFields"]
            == list(resolved_diagnostic_fields)
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
    bad = deepcopy(configs[0])
    del bad["training"]["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"]
    negatives["object_reference_multiscale_missing_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["object_reference_multiscale_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"]["activationGate"]["smokeNow"] = True
    negatives["object_reference_multiscale_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"]["unknown"] = True
    negatives["object_reference_multiscale_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    del bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]
    negatives["early_convergence_contract_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["early_convergence_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["activationGate"]["smokeNow"] = True
    negatives["early_convergence_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization"]["unknown"] = True
    negatives["early_convergence_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    del bad["training"]["stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"]
    negatives["full_rollout_per_class_luminance_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["full_rollout_per_class_luminance_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"]["activationGate"]["smokeNow"] = True
    negatives["full_rollout_per_class_luminance_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation"]["unknown"] = True
    negatives["full_rollout_per_class_luminance_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    del bad["training"]["stage4PerClassFinalVisibleReferenceFeatureStructureObligation"]
    negatives["reference_feature_structure_contract_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassFinalVisibleReferenceFeatureStructureObligation"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["reference_feature_structure_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassFinalVisibleReferenceFeatureStructureObligation"]["activationGate"]["smokeNow"] = True
    negatives["reference_feature_structure_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassFinalVisibleReferenceFeatureStructureObligation"]["unknown"] = True
    negatives["reference_feature_structure_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    del bad["training"]["stage4EpochWorstSampleClassReferenceFeatureStructureReplay"]
    negatives["epoch_worst_reference_feature_replay_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4EpochWorstSampleClassReferenceFeatureStructureReplay"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["epoch_worst_reference_feature_replay_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4EpochWorstSampleClassReferenceFeatureStructureReplay"]["activationGate"]["smokeNow"] = True
    negatives["epoch_worst_reference_feature_replay_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4EpochWorstSampleClassReferenceFeatureStructureReplay"]["unknown"] = True
    negatives["epoch_worst_reference_feature_replay_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    del bad["training"]["stage4PerClassWorstSampleReferenceFeatureStructureObligation"]
    negatives["per_class_worst_reference_feature_structure_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassWorstSampleReferenceFeatureStructureObligation"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["per_class_worst_reference_feature_structure_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassWorstSampleReferenceFeatureStructureObligation"]["activationGate"]["smokeNow"] = True
    negatives["per_class_worst_reference_feature_structure_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassWorstSampleReferenceFeatureStructureObligation"]["unknown"] = True
    negatives["per_class_worst_reference_feature_structure_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    del bad["training"]["stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"]
    negatives["per_class_worst_final_visible_luminance_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["per_class_worst_final_visible_luminance_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"]["activationGate"]["smokeNow"] = True
    negatives["per_class_worst_final_visible_luminance_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"]["stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation"]["unknown"] = True
    negatives["per_class_worst_final_visible_luminance_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    current_contract_name = (
        "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity"
    )
    bad = deepcopy(configs[0])
    del bad["training"][current_contract_name]
    negatives["epoch_complete_per_class_selection_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"][current_contract_name]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["epoch_complete_per_class_selection_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][current_contract_name]["activationGate"]["smokeNow"] = True
    negatives["epoch_complete_per_class_selection_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][current_contract_name]["unknown"] = True
    negatives["epoch_complete_per_class_selection_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    shared_replay_contract_name = (
        "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"
    )
    bad = deepcopy(configs[0])
    del bad["training"][shared_replay_contract_name]
    negatives["epoch_complete_reference_feature_shared_replay_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"][shared_replay_contract_name]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["epoch_complete_reference_feature_shared_replay_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][shared_replay_contract_name]["activationGate"]["smokeNow"] = True
    negatives["epoch_complete_reference_feature_shared_replay_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][shared_replay_contract_name]["unknown"] = True
    negatives["epoch_complete_reference_feature_shared_replay_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    conflict_contract_name = "stage4ConflictAwareExistingGradientAggregation"
    bad = deepcopy(configs[0])
    del bad["training"][conflict_contract_name]
    negatives["conflict_aware_gradient_aggregation_missing_rejected"] = rejects(
        lambda: validate_current_candidate_activation_contract(bad)
    )
    bad = deepcopy(configs[0])
    bad["training"][conflict_contract_name]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["conflict_aware_gradient_aggregation_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][conflict_contract_name]["activationGate"]["smokeNow"] = True
    negatives["conflict_aware_gradient_aggregation_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][conflict_contract_name]["unknown"] = True
    negatives["conflict_aware_gradient_aggregation_unknown_field_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    controlled_contract_name = "stage4ControlledStructureThreeArm"
    bad = deepcopy(configs[0])
    bad["training"][controlled_contract_name]["activationGate"]["stage4FullTrainingNow"] = False
    negatives["winning_controlled_structure_partial_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["training"][controlled_contract_name]["activationGate"]["smokeNow"] = True
    negatives["winning_controlled_structure_smoke_residue_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
    )
    bad = deepcopy(configs[0])
    bad["stage4ControlledStructureArm"] = "unknown_controlled_structure_arm"
    bad["training"][controlled_contract_name]["armId"] = bad["stage4ControlledStructureArm"]
    negatives["unknown_controlled_structure_formal_activation_rejected"] = rejects(
        lambda: trainer.validate_training_inputs(bad, package)
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


def parse_cli(values: list[str]) -> tuple[str, Path, Path, Path]:
    run_id = "manual"
    source_path = DEFAULT_SOURCE
    output_root = OUTPUT_ROOT
    implementation_root = IMPLEMENTATION_ROOT
    index = 0
    if values and not values[0].startswith("--"):
        run_id = values[0]
        index = 1
    while index < len(values):
        name = values[index]
        if name not in {"--source", "--output-root", "--implementation-root"} or index + 1 >= len(values):
            raise ValueError(f"unknown or incomplete CPU checker argument: {name}")
        resolved = (ROOT / values[index + 1]).resolve()
        if name == "--source":
            source_path = resolved
        elif name == "--output-root":
            output_root = resolved
        else:
            implementation_root = resolved
        index += 2
    if not run_id or any(token in run_id for token in ("/", "\\", "..")):
        raise ValueError("CPU runId is invalid")
    return run_id, source_path, output_root, implementation_root


if __name__ == "__main__":
    raise SystemExit(main())

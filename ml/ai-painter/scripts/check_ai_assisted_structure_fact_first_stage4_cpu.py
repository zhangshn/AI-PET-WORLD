from __future__ import annotations

from argparse import ArgumentParser
import ast
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import traceback

import torch

from ai_painter.complete_world import build_complete_world_system
import compile_ai_assisted_structure_fact_first_stage4_inactive_config as compiler
import train_ai_assisted_conditional_denoiser as trainer
from ai_painter_stage_mode_registry import FORMAL_MODE_REGISTRY, ModeRegistry, ModeSpec, resolve_stage_mode


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = compiler.AUTHORIZATION_PATH
CONSUMPTION_PATH = compiler.CONSUMPTION_PATH
OUTPUT_ROOT = Path(
    ".runtime/ai-painter/stage4-structure-fact-first-dual-stage-cpu-support/20260810-215503422"
)
CONFIG_PATH = OUTPUT_ROOT / "inactive-config.json"
REPORT_PATH = OUTPUT_ROOT / "cpu-positive-negative-regression.json"
SUPPORT_PATH = OUTPUT_ROOT / "architecture-support-contract.json"
OWNER_REQUEST_PATH = OUTPUT_ROOT / "owner-action-request.json"
TERMINAL_PATH = OUTPUT_ROOT / "phase-terminal.json"
CAPSULE_PATH = OUTPUT_ROOT / "local-task-capsule.json"
MODEL_PATH = Path("ml/ai-painter/src/ai_painter/complete_world/model.py")
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
REGISTRY_PATH = Path("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
COMPILER_PATH = Path("ml/ai-painter/scripts/compile_ai_assisted_structure_fact_first_stage4_inactive_config.py")
CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_structure_fact_first_stage4_cpu.py")
EXPECTED_SPLITS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--output-root", type=Path, default=OUTPUT_ROOT)
    args = parser.parse_args()
    output_root = Path(args.output_root)
    if project_path(output_root) != project_path(OUTPUT_ROOT):
        raise ValueError("Stage 4 structure-fact-first CPU output root changed")
    if resolve(output_root).exists():
        raise ValueError("Stage 4 structure-fact-first CPU output root already exists")
    try:
        authorization = compiler.validate_authorization()
        source = read_json(resolve(compiler.SOURCE_CONFIG_PATH))
        package = read_json(resolve(compiler.DATASET_PATH))
        source_index = read_json(resolve(compiler.SOURCE_INDEX_PATH))
        sample_rows = [
            row for row in source_index.get("samples", [])
            if row.get("sampleId") == compiler.SAMPLE_ID
            and row.get("v7CapacityContributionRegistered") is True
        ]
        if len(sample_rows) != 1:
            raise ValueError("Stage 4 structure-fact-first sample identity is not unique")
        config = compiler.compile_config(source, authorization, sample_rows[0])
        positive, negative, evidence = run_regressions(config, package, source_index)
        failed_positive = [key for key, value in positive.items() if value is not True]
        failed_negative = [key for key, value in negative.items() if value is not True]
        if failed_positive or failed_negative:
            raise ValueError(
                f"Stage 4 structure-fact-first CPU regression failed: {failed_positive}:{failed_negative}"
            )

        write_json_exclusive(CONFIG_PATH, config)
        report = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-cpu-regression-v1",
            "status": "passed_cpu_only_structure_fact_first_dual_stage_inactive",
            **timestamps("recordedAt"),
            "authorization": binding(AUTHORIZATION_PATH),
            "implementationConsumption": binding(CONSUMPTION_PATH),
            "inactiveConfig": binding(CONFIG_PATH),
            "positive": positive,
            "negative": negative,
            "failedPositiveKeys": [],
            "failedNegativeKeys": [],
            "positivePassed": len(positive),
            "positiveTotal": len(positive),
            "negativePassed": len(negative),
            "negativeTotal": len(negative),
            "evidence": evidence,
            "checkpointReadOrLoaded": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
        }
        write_json_exclusive(REPORT_PATH, report)
        support = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-cpu-support-contract-v1",
            "status": "structure_fact_first_dual_stage_cpu_supported_inactive",
            **timestamps("recordedAt"),
            "contractId": compiler.CONTRACT_ID,
            "architectureId": compiler.ARCHITECTURE_ID,
            "stageA": {
                "component": "typed_semantic_topology_layout_predictor",
                "inputChannelCount": 23,
                "outputChannels": compiler.STRUCTURE_CHANNELS,
                "independentTypedHeads": True,
                "auditableIntermediate": True,
            },
            "stageB": {
                "component": "condition_preserving_rgb_latent_denoiser",
                "originalConditionChannelCount": 23,
                "structureChannelCount": len(compiler.STRUCTURE_CHANNELS),
                "injectionScales": compiler.STAGE_B_INJECTION_SCALES,
                "latentOutputShapeChanged": False,
            },
            "legalSupervisionSources": compiler.LEGAL_SUPERVISION_SOURCES,
            "prohibitedTrainingSources": compiler.PROHIBITED_TRAINING_SOURCES,
            "diagnosticManifestFields": list(
                trainer.STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
            ),
            "datasetCapacity": 64,
            "datasetSplitCounts": EXPECTED_SPLITS,
            "autoencoderFrozen": True,
            "oldV7V8V9DenoiserCheckpointCompatible": False,
            "freeHyperparametersSelected": [],
            "sourceCodeBindings": {
                "model": binding(MODEL_PATH),
                "trainer": binding(TRAINER_PATH),
                "modeRegistry": binding(REGISTRY_PATH),
                "inactiveConfigCompiler": binding(COMPILER_PATH),
                "cpuChecker": binding(CHECKER_PATH),
            },
            "nextAction": "separately_authorized_readonly_gpu_forward_and_autograd_grad_route_diagnostic",
            "checkpointReadAuthorized": False,
            "optimizerAuthorized": False,
            "backwardAuthorized": False,
            "gpuAuthorized": False,
            "trainingAuthorized": False,
        }
        write_json_exclusive(SUPPORT_PATH, support)
        owner_request = {
            "schemaVersion": "ai-painter-owner-action-request-v1",
            "status": "owner_decision_required_not_authorized_not_executed",
            "module": "AI Painter R5",
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "currentStage": 4,
            "finding": "structure_fact_first_dual_stage_cpu_support_and_inactive_contract_passed",
            "requestedNextAction": "authorize_one_readonly_gpu_forward_and_autograd_grad_route_diagnostic_for_the_new_dual_stage_architecture",
            "preservedInvariants": [
                "23_channel_condition_schema", "64_of_64_dataset", "48_8_4_4_split",
                "frozen_autoencoder", "legacy_v7_v8_v9_behavior", "machine_review_thresholds",
            ],
            "forbiddenSideEffects": [
                "optimizer_creation", "backward_method_execution", "model_weight_update",
                "checkpoint_write", "training", "formal_inference", "runtime_frame", "world_entry",
            ],
            "evidence": {
                "inactiveConfig": binding(CONFIG_PATH),
                "cpuReport": binding(REPORT_PATH),
                "supportContract": binding(SUPPORT_PATH),
            },
        }
        write_json_exclusive(OWNER_REQUEST_PATH, owner_request)
        terminal = {
            "schemaVersion": "ai-painter-stage4-structure-fact-first-cpu-terminal-v1",
            "status": "stage4_structure_fact_first_dual_stage_cpu_support_completed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "architectureId": compiler.ARCHITECTURE_ID,
            "inactiveConfig": binding(CONFIG_PATH),
            "cpuReport": binding(REPORT_PATH),
            "supportContract": binding(SUPPORT_PATH),
            "ownerActionRequest": binding(OWNER_REQUEST_PATH),
            "nextLegalAction": "owner_may_authorize_one_readonly_gpu_forward_and_autograd_grad_route_diagnostic",
            "checkpointReadOrLoaded": False,
            "optimizerCreated": False,
            "backwardMethodExecuted": False,
            "modelWeightsModified": False,
            "gpuUsed": False,
            "trainingStarted": False,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(TERMINAL_PATH, terminal)
        capsule = {
            "schemaVersion": "ai-painter-local-task-capsule-v1",
            "capsuleId": "ai-painter-stage4-structure-fact-first-cpu-20260810-215503422",
            "module": "AI Painter R5",
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "currentStage": 4,
            "candidateTerminal": terminal["status"],
            "latestBlocker": "new_architecture_has_cpu_support_but_has_not_yet_passed_readonly_gpu_gradient_routing_phase0_or_visual_smoke",
            "nextLegalAction": terminal["nextLegalAction"],
            "forbiddenActions": owner_request["forbiddenSideEffects"],
            "evidence": {
                **terminal,
                "terminal": binding(TERMINAL_PATH),
            },
            "planPath": "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
            **timestamps("recordedAt"),
        }
        write_json_exclusive(CAPSULE_PATH, capsule)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(TERMINAL_PATH),
            "terminalSha256": sha256_file(resolve(TERMINAL_PATH)),
            "capsulePath": project_path(CAPSULE_PATH),
            "capsuleSha256": sha256_file(resolve(CAPSULE_PATH)),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal_path = resolve(TERMINAL_PATH)
        if not terminal_path.exists():
            terminal = {
                "schemaVersion": "ai-painter-stage4-structure-fact-first-cpu-terminal-v1",
                "status": "stage4_structure_fact_first_dual_stage_cpu_support_failed_closed",
                **timestamps("recordedAt"),
                "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
                "failureType": type(error).__name__,
                "failureMessage": str(error),
                "traceback": traceback.format_exc(),
                "checkpointReadOrLoaded": False,
                "optimizerCreated": False,
                "backwardMethodExecuted": False,
                "modelWeightsModified": False,
                "gpuUsed": False,
                "trainingStarted": False,
                "automaticRetryStarted": False,
            }
            write_json_exclusive(TERMINAL_PATH, terminal)
        print(json.dumps(read_json(terminal_path), ensure_ascii=False, indent=2))
        return 1


def run_regressions(config: dict, package: dict, source_index: dict):
    positive: dict[str, bool] = {}
    negative: dict[str, bool] = {}
    evidence: dict = {}

    def rejected(callable_value) -> bool:
        try:
            callable_value()
        except (ValueError, FileNotFoundError, PermissionError):
            return True
        return False

    trainer.validate_training_inputs(config, package)
    mode = resolve_stage_mode(config)
    capacity_rows = [
        row for row in source_index.get("samples", [])
        if row.get("v7CapacityContributionRegistered") is True
    ]
    split_counts = {
        split: sum(row.get("split") == split for row in capacity_rows)
        for split in EXPECTED_SPLITS
    }
    sample_rows = [row for row in capacity_rows if row.get("sampleId") == compiler.SAMPLE_ID]
    positive.update({
        "trainingInputContractValid": True,
        "inactiveModeResolved": mode.mode_id == "structure_fact_first_stage4_inactive",
        "inactiveModeCannotExecute": mode.active_execution is False and mode.execution_kind == "cpu_inactive",
        "conditionChannelCountPreserved": config.get("conditionChannels") == 23,
        "conditionChannelOrderPreserved": len(config.get("conditionChannelOrder", [])) == 23,
        "datasetCapacityPreserved": len(capacity_rows) == 64,
        "datasetSplitPreserved": split_counts == EXPECTED_SPLITS,
        "sample194RemainsValidation": len(sample_rows) == 1 and sample_rows[0].get("split") == "validation",
        "autoencoderContractFrozen": config["training"]["stage4StructureFactFirstDualStage"]["autoencoderWeightsChanged"] is False,
        "oldCheckpointCompatibilityClosed": config["training"]["stage4StructureFactFirstDualStage"]["oldDenoiserCheckpointCompatible"] is False,
        "freeHyperparametersNotSelected": config["training"]["stage4StructureFactFirstDualStage"]["hyperparameterSelections"] == [],
        "previewIdentityContractInactive": config["training"]["stage4StructureFactFirstDualStage"]["previewReproductionIdentity"]["configurationActiveNow"] is False,
    })

    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    denoiser_hash_before = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_hash_before = state_dict_sha256(model.autoencoder.state_dict())
    latent_channels = int(config["latentChannels"])
    noisy_latent = torch.randn(1, latent_channels, 8, 8, requires_grad=True)
    timestep = torch.tensor([999], dtype=torch.long)
    conditions = torch.rand(1, 23, 32, 32)
    discrete_indices, _ = trainer.condition_type_indices(config)
    conditions[:, discrete_indices] = (conditions[:, discrete_indices] > 0.5).to(conditions.dtype)
    velocity, alignment = model.predict_velocity_with_stage4_structure_fact(
        noisy_latent, timestep, conditions
    )
    layout = alignment["structureLayout"]
    head_outputs = alignment["structureHeadOutputs"]
    positive.update({
        "latentOutputShapeUnchanged": tuple(velocity.shape) == tuple(noisy_latent.shape),
        "stageALayoutShapeValid": tuple(layout.shape) == (1, len(compiler.STRUCTURE_CHANNELS), 8, 8),
        "stageAChannelOrderValid": list(alignment["structureChannelOrder"]) == compiler.STRUCTURE_CHANNELS,
        "stageBInjectionScalesValid": list(alignment["stageBInjectionScales"]) == compiler.STAGE_B_INJECTION_SCALES,
        "modelChannelOrderApiValid": list(model.stage4_structure_fact_channel_order()) == compiler.STRUCTURE_CHANNELS,
    })

    tree_index = config["conditionChannelOrder"].index("object_tree")
    perturbed = conditions.clone()
    perturbed[:, tree_index] = 1.0 - perturbed[:, tree_index]
    perturbed_velocity, perturbed_alignment = model.predict_velocity_with_stage4_structure_fact(
        noisy_latent, timestep, perturbed
    )
    positive["stageARespondsToConditionChange"] = not torch.equal(
        layout.detach(), perturbed_alignment["structureLayout"].detach()
    )
    positive["stageBOutputRespondsToConditionChange"] = not torch.equal(
        velocity.detach(), perturbed_velocity.detach()
    )

    stage_a_parameter = next(model.denoiser.structure_fact_shared_trunk.parameters())
    stage_b_parameter = next(model.denoiser.structure_fact_stage_b_adapters["up0"].parameters())
    base_parameter = model.denoiser.latent_stem.weight
    coupling_grads = torch.autograd.grad(
        velocity.square().mean(),
        (stage_a_parameter, stage_b_parameter, base_parameter),
        retain_graph=True,
        create_graph=False,
        allow_unused=True,
    )
    positive["stageAToStageBGradientCoupling"] = finite_nonzero(coupling_grads[0])
    positive["stageBAdapterGradientAvailable"] = finite_nonzero(coupling_grads[1])
    positive["baseDenoiserGradientAvailable"] = finite_nonzero(coupling_grads[2])

    object_head_name = "object_footprints"
    all_head_parameters = []
    head_slices = {}
    for name in compiler.STRUCTURE_CHANNELS:
        start = len(all_head_parameters)
        all_head_parameters.extend(model.denoiser.structure_fact_heads[name].parameters())
        head_slices[name] = slice(start, len(all_head_parameters))
    head_loss = head_outputs[compiler.STRUCTURE_CHANNELS.index(object_head_name)].mean()
    head_grads = torch.autograd.grad(
        head_loss,
        tuple(all_head_parameters),
        retain_graph=True,
        create_graph=False,
        allow_unused=True,
    )
    selected_grads = head_grads[head_slices[object_head_name]]
    other_grads = [
        grad
        for name in compiler.STRUCTURE_CHANNELS
        if name != object_head_name
        for grad in head_grads[head_slices[name]]
    ]
    positive["independentTypedHeadReceivesGradient"] = any(finite_nonzero(grad) for grad in selected_grads)
    positive["unselectedTypedHeadsRemainGradientIsolated"] = all(
        grad is None or torch.count_nonzero(grad).item() == 0 for grad in other_grads
    )

    predicted_clean = noisy_latent - velocity * 0.1
    predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
    target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
    predicted_rgb = model.autoencoder.decode(predicted_clean)
    target_rgb = torch.rand_like(predicted_rgb)
    target_velocity = torch.randn_like(velocity)
    metrics = trainer.composite_denoiser_losses_structure_fact_first_stage4(
        velocity,
        target_velocity,
        predicted_clean,
        torch.zeros_like(predicted_clean),
        predicted_conditions,
        target_conditions,
        predicted_rgb,
        target_rgb,
        conditions,
        alignment,
        config,
    )
    diagnostic_fields = sorted(
        key for key in metrics if key.startswith("stage4Diagnostic")
    )
    expected_diagnostics = sorted(trainer.STRUCTURE_FACT_FIRST_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
    row = trainer.register_v9_stage4_diagnostic_manifest_fields({}, metrics, 1, config)
    positive.update({
        "legalSupervisionLossFinite": math.isfinite(float(metrics["compositeLossTensor"].detach())),
        "exact17DiagnosticsProduced": diagnostic_fields == expected_diagnostics,
        "exact17DiagnosticsManifestRegistered": sorted(key for key in row if key.startswith("stage4Diagnostic")) == expected_diagnostics,
        "diagnosticsFiniteNonnegative": all(math.isfinite(float(metrics[key])) and float(metrics[key]) >= 0.0 for key in expected_diagnostics),
        "noParameterGradFieldsWritten": all(parameter.grad is None for parameter in model.parameters()),
    })
    denoiser_hash_after = state_dict_sha256(model.denoiser.state_dict())
    autoencoder_hash_after = state_dict_sha256(model.autoencoder.state_dict())
    positive["denoiserStateHashUnchanged"] = denoiser_hash_before == denoiser_hash_after
    positive["autoencoderStateHashUnchanged"] = autoencoder_hash_before == autoencoder_hash_after

    registry_modes = FORMAL_MODE_REGISTRY.snapshot()
    positive.update({
        "legacyV7ModesPreserved": all(key in registry_modes for key in (
            "owner_authorized_v7_r5_single_sample_overfit_smoke",
            "owner_authorized_v7_r5_stage4_full_training",
        )),
        "legacyV8ModesPreserved": "v8_stage4_shared_readout_training_loss_supported_inactive" in registry_modes,
        "legacyV9ModesPreserved": "v9_stage4_object_semantic_decoder_alignment_cpu_supported_inactive" in registry_modes,
        "newModeRegisteredOnce": sum(spec.mode_id == "structure_fact_first_stage4_inactive" for spec in registry_modes.values()) == 1,
        "newCpuFilesContainNoOptimizerOrBackwardCall": no_forbidden_calls((COMPILER_PATH, CHECKER_PATH)),
    })

    def invalid(mutator, package_mutator=None):
        mutated = deepcopy(config)
        mutated_package = deepcopy(package)
        mutator(mutated)
        if package_mutator is not None:
            package_mutator(mutated_package)
        trainer.validate_training_inputs(mutated, mutated_package)

    negative.update({
        "unknownModeRejected": rejected(lambda: invalid(lambda value: value["training"].update(trainingAuthorizationStatus="unknown_structure_mode"))),
        "architectureMismatchRejected": rejected(lambda: invalid(lambda value: value.update(denoiserArchitecture="multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"))),
        "conditionCountMutationRejected": rejected(lambda: invalid(lambda value: value.update(conditionChannels=22))),
        "conditionOrderMutationRejected": rejected(lambda: invalid(lambda value: value["conditionChannelOrder"].pop())),
        "failedPreviewTrainingSourceRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["legalSupervision"]["allowedSources"].append("failed_preview_pixels"))),
        "failedPreviewTargetFlagRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["legalSupervision"].update(failedPreviewPixelsUsedAsTrainingTargets=True))),
        "reviewThresholdTargetRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["legalSupervision"].update(machineReviewThresholdsUsedAsTrainingTargets=True))),
        "legacyCheckpointCompatibilityRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"].update(oldDenoiserCheckpointCompatible=True))),
        "checkpointReadActivationRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["activationGate"].update(checkpointReadNow=True))),
        "trainingActivationRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["activationGate"].update(trainingNow=True))),
        "freeHyperparameterRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["hyperparameterSelections"].append({"name": "learningRate", "value": 1e-4}))),
        "stageAChannelRemovalRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["stageA"]["outputChannels"].pop())),
        "stageBScaleRemovalRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["stageB"]["injectionScales"].pop())),
        "unknownDiagnosticFieldRejected": rejected(lambda: invalid(lambda value: value["training"]["stage4StructureFactFirstDualStage"]["diagnosticManifestRegistry"]["exactFields"].append("stage4DiagnosticUnknown"))),
        "datasetCapacityMutationRejected": rejected(lambda: invalid(lambda value: None, lambda value: value.update(v7CapacityContributionCount=63))),
        "duplicateModeRejected": rejected(lambda: ModeRegistry((
            ModeSpec("duplicate_a", "duplicate_status", compiler.ARCHITECTURE_ID, 4, "cpu_inactive", "duplicate_a_adapter", "validation", False),
            ModeSpec("duplicate_b", "duplicate_status", compiler.ARCHITECTURE_ID, 4, "cpu_inactive", "duplicate_b_adapter", "validation", False),
        ))),
        "wrongConditionTensorRejectedByModel": rejected(lambda: model.predict_velocity_with_stage4_structure_fact(noisy_latent, timestep, conditions[:, :22])),
    })
    evidence.update({
        "actualSplitCounts": split_counts,
        "sample194Split": sample_rows[0].get("split"),
        "conditionChannelOrder": list(config["conditionChannelOrder"]),
        "structureChannelOrder": list(alignment["structureChannelOrder"]),
        "stageBInjectionScales": list(alignment["stageBInjectionScales"]),
        "latentShape": list(noisy_latent.shape),
        "predictedVelocityShape": list(velocity.shape),
        "structureLayoutShape": list(layout.shape),
        "diagnosticManifestFields": expected_diagnostics,
        "denoiserStateSha256Before": denoiser_hash_before,
        "denoiserStateSha256After": denoiser_hash_after,
        "autoencoderStateSha256Before": autoencoder_hash_before,
        "autoencoderStateSha256After": autoencoder_hash_after,
        "autogradGradUsed": True,
        "backwardMethodExecuted": False,
    })
    return positive, negative, evidence


def no_forbidden_calls(paths: tuple[Path, ...]) -> bool:
    for path in paths:
        tree = ast.parse(resolve(path).read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if isinstance(node.func, ast.Attribute) and node.func.attr == "backward":
                return False
            if isinstance(node.func, ast.Name) and node.func.id.lower().endswith("optimizer"):
                return False
            if isinstance(node.func, ast.Attribute) and node.func.attr.lower() in {"adam", "adamw", "sgd"}:
                return False
    return True


def finite_nonzero(value) -> bool:
    return value is not None and torch.isfinite(value).all().item() and torch.count_nonzero(value).item() > 0


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for key in sorted(state_dict):
        tensor = state_dict[key].detach().cpu().contiguous()
        digest.update(key.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(str(tuple(tensor.shape)).encode("ascii"))
        digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def timestamps(prefix: str) -> dict:
    utc = datetime.now(timezone.utc)
    shanghai = utc.astimezone(timezone(timedelta(hours=8)))
    return {
        f"{prefix}Utc": utc.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": shanghai.isoformat(),
    }


def resolve(path: Path) -> Path:
    return compiler.resolve(path)


def project_path(path: Path) -> str:
    return compiler.project_path(path)


def sha256_file(path: Path) -> str:
    return compiler.sha256_file(path)


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(resolve(path))}


def read_json(path: Path) -> dict:
    return json.loads(resolve(path).read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

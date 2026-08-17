from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path.cwd().resolve()
CONTRACT_KEY = "stage4PerClassFinalVisibleReferenceFeatureStructureObligation"
GATE_FIELDS = (
    "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
    "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
    "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
    "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
)
ALLOWED_ACTIONS = [
    "extend_existing_trainer_with_inactive_reference_feature_structure_obligation",
    "extend_existing_inactive_configuration_compilation_chain",
    "extend_cpu_positive_negative_contract_checker",
    "execute_cpu_positive_negative_regression_and_configuration_audit",
    "write_inactive_config_support_contract_cpu_report_owner_request_terminal_and_local_records",
]
INACTIVE_SOURCE_IDENTITY_SEPARATION_CONTRACT_ID = (
    "stage4_reference_feature_structure_smoke_inactive_source_identity_separation_v1"
)
INACTIVE_SOURCE_IDENTITY_SEPARATION_SCHEMA = (
    "owner-authorized-stage4-reference-feature-structure-smoke-inactive-source-identity-separation-v1"
)
INACTIVE_SOURCE_IDENTITY_SEPARATION_SCOPE = (
    "one_bounded_reference_feature_structure_smoke_inactive_source_identity_separation_cpu_preflight_and_fresh_gpu_smoke"
)
INACTIVE_SOURCE_IDENTITY_SEPARATION_ALLOWED_ACTIONS = [
    "preserve_current_smoke_entry_partial_implementation",
    "compile_new_traceable_inactive_smoke_source_config",
    "separate_source_architecture_identity_from_execution_activation_identity",
    "synchronize_existing_stage4_runner_trainer_gate_and_cpu_checker",
    "execute_cpu_positive_negative_authorization_gate",
    "execute_real_node_and_trainer_readonly_preflight",
    "execute_python_cuda_disk_preflight",
    "materialize_and_atomically_consume_one_fresh_gpu_smoke_authorization",
    "create_optimizer",
    "execute_backward",
    "modify_bounded_smoke_model_weights",
    "write_smoke_previews_diagnostics_review_checkpoint_manifest_finalization_terminal_and_local_records",
]
INACTIVE_SOURCE_EXECUTION_ONLY_KEYS = (
    "factConditionedSemanticMixtureStage4SingleSampleSmokeContract",
    "stage4UnifiedTrainingPreviewSamplingContract",
    "factConditionedSemanticMixtureStage4SmokeExecution",
)


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


def validate_authorization(
    authorization_path: Path,
    authorization_sha256: str,
    consumption_path: Path,
    consumption_sha256: str,
) -> dict:
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    request_id = authorization.get("requestId")
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("schemaVersion")
        != "owner-authorized-stage4-per-class-final-visible-reference-feature-structure-cpu-implementation-v1"
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or not isinstance(request_id, str)
        or authorization.get("commandRef") != request_id
        or authorization.get("scope")
        != "one_cpu_only_inactive_per_class_final_visible_reference_feature_structure_obligation_implementation"
        or authorization.get("allowedActions") != ALLOWED_ACTIONS
        or authorization.get("checkpointWeightsReadAuthorized") is not False
        or authorization.get("optimizerCreationAuthorized") is not False
        or authorization.get("backwardExecutionAuthorized") is not False
        or authorization.get("gpuAuthorized") is not False
        or authorization.get("trainingAuthorized") is not False
        or authorization.get("oneTimeConsumptionRequired") is not True
    ):
        raise ValueError("reference-feature CPU implementation authorization is invalid")
    if (
        consumption.get("status") != "consumed_once"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != authorization.get("scope")
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("reference-feature CPU implementation consumption is invalid")
    for name, binding in authorization.get("sourceEvidence", {}).items():
        source = ROOT / binding["path"]
        if not source.is_file() or sha256_file(source) != binding["sha256"]:
            raise ValueError(f"reference-feature source evidence changed: {name}")
    return authorization


def validate_inactive_source_identity_separation_authorization(
    authorization_path: Path,
    authorization_sha256: str,
    consumption_path: Path,
    consumption_sha256: str,
) -> dict:
    authorization = read_json(authorization_path)
    consumption = read_json(consumption_path)
    request_id = authorization.get("requestId")
    if (
        sha256_file(authorization_path) != authorization_sha256
        or sha256_file(consumption_path) != consumption_sha256
        or authorization.get("schemaVersion")
        != INACTIVE_SOURCE_IDENTITY_SEPARATION_SCHEMA
        or authorization.get("status") != "resolved_owner_authorized_not_consumed"
        or not isinstance(request_id, str)
        or authorization.get("commandRef") != request_id
        or authorization.get("scope")
        != INACTIVE_SOURCE_IDENTITY_SEPARATION_SCOPE
        or authorization.get("allowedActions")
        != INACTIVE_SOURCE_IDENTITY_SEPARATION_ALLOWED_ACTIONS
        or authorization.get("oneTimeConsumptionRequired") is not True
        or authorization.get("automaticRetryAuthorized") is not False
    ):
        raise ValueError("reference-feature inactive source separation authorization is invalid")
    if (
        consumption.get("status")
        != "owner_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != request_id
        or consumption.get("commandRef") != request_id
        or consumption.get("scope") != authorization.get("scope")
        or consumption.get("authorizationSha256") != authorization_sha256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("reference-feature inactive source separation consumption is invalid")
    for group_name in ("failureEvidence", "sourceEvidence", "implementationBefore"):
        for name, binding in authorization.get(group_name, {}).items():
            source = ROOT / binding["path"]
            if not source.is_file() or sha256_file(source) != binding["sha256"]:
                raise ValueError(
                    f"reference-feature inactive source separation evidence changed: {group_name}.{name}"
                )
    return authorization


def _disable_all_activation_gates(value) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "activationGate":
                if not isinstance(child, dict) or not child:
                    raise ValueError("reference-feature activation gate shape changed")
                for gate_name in child:
                    child[gate_name] = False
            else:
                _disable_all_activation_gates(child)
    elif isinstance(value, list):
        for child in value:
            _disable_all_activation_gates(child)


def _all_activation_gates_are_false(value) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "activationGate":
                if not isinstance(child, dict) or not child or any(
                    gate_value is not False for gate_value in child.values()
                ):
                    return False
            elif not _all_activation_gates_are_false(child):
                return False
    elif isinstance(value, list):
        return all(_all_activation_gates_are_false(child) for child in value)
    return True


def compile_inactive_smoke_source_identity(
    source: dict,
    *,
    source_path: Path,
    source_sha256: str,
    authorization: dict,
    authorization_path: Path,
    authorization_sha256: str,
    consumption_path: Path,
    consumption_sha256: str,
) -> dict:
    result = deepcopy(source)
    training = result["training"]
    if (
        source.get("denoiserArchitecture")
        != "stage4_fact_conditioned_semantic_mixture_decoder_v1"
        or training.get("trainingAuthorizationStatus")
        != "owner_authorized_stage4_fact_conditioned_semantic_mixture_single_sample_gpu_smoke"
        or not any(
            gate_value is True
            for value in training.values()
            if isinstance(value, dict)
            for gate_name, gate in value.items()
            if gate_name == "activationGate" and isinstance(gate, dict)
            for gate_value in gate.values()
        )
        or "factConditionedSemanticMixtureStage4SmokeExecution" not in training
    ):
        raise ValueError("reference-feature historical active source identity is not the bound conflict")
    training["trainingAuthorizationStatus"] = (
        trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_CPU_INACTIVE_STATUS
    )
    for key in INACTIVE_SOURCE_EXECUTION_ONLY_KEYS:
        training.pop(key, None)
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": authorization_sha256,
        "implementationConsumptionPath": project_path(consumption_path),
        "implementationConsumptionSha256": consumption_sha256,
        "status": "not_authorized_cpu_support_only",
        **{key: False for key in (
            "checkpointLoadingAuthorized", "optimizerCreationAuthorized",
            "backwardExecutionAuthorized", "modelWeightMutationAuthorized",
            "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
            "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized",
            "strictRevalidationAuthorized", "validationAuthorized",
            "formalInferenceAuthorized", "checkpointPromotionAuthorized",
            "runtimeFrameAuthorized", "worldEntryAuthorized",
            "automaticRetryAuthorized",
        )},
    }
    architecture = training["stage4FactConditionedSemanticMixture"]
    architecture["enabled"] = False
    architecture["status"] = "cpu_support_verified_not_active"
    architecture.get("diagnosticManifestRegistry", {}).pop("fixedEpochs", None)
    diagnostics = training["stage4FailureDiagnostics"]
    diagnostics["status"] = (
        "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
    )
    for key in (
        "executionValuesSelected", "trainingConfigApplied", "checkpointFileReadAuthorized",
        "gpuUseAuthorized", "trainingAuthorized",
    ):
        if key in diagnostics:
            diagnostics[key] = False
    if isinstance(diagnostics.get("semanticMixtureDiagnostics"), dict):
        diagnostics["semanticMixtureDiagnostics"]["changesTrainingWeightsNow"] = False
    for value in training.values():
        if (
            isinstance(value, dict)
            and "activationGate" in value
            and value.get("status") == "training_loss_active_owner_authorized"
        ):
            value["status"] = "cpu_support_verified_inactive"
    _disable_all_activation_gates(training)
    training["stage4ReferenceFeatureStructureSmokeInactiveSourceIdentity"] = {
        "contractId": INACTIVE_SOURCE_IDENTITY_SEPARATION_CONTRACT_ID,
        "status": "cpu_support_verified_inactive",
        "sourceArchitectureConfig": {
            "path": project_path(source_path),
            "sha256": source_sha256,
            "executionUseAllowed": False,
        },
        "implementationAuthorization": {
            "path": project_path(authorization_path),
            "sha256": authorization_sha256,
        },
        "implementationConsumption": {
            "path": project_path(consumption_path),
            "sha256": consumption_sha256,
        },
        "historicalActiveExecutionLineageRemoved": True,
        "allActivationGatesFalse": True,
        "formalActivationRequiresFreshGpuAuthorization": True,
        "modelLossDataCheckpointAndReviewContractsChanged": False,
    }
    if (
        training["trainingAuthorizationStatus"]
        != trainer.FACT_CONDITIONED_SEMANTIC_MIXTURE_STAGE4_CPU_INACTIVE_STATUS
        or any(key in training for key in INACTIVE_SOURCE_EXECUTION_ONLY_KEYS)
        or not _all_activation_gates_are_false(training)
        or architecture.get("diagnosticManifestRegistry", {}).get("fixedEpochs") is not None
    ):
        raise ValueError("reference-feature inactive source identity separation failed closed")
    trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
        result
    )
    return result


def compile_config(source: dict) -> dict:
    result = deepcopy(source)
    training = result["training"]
    source_contract = (
        trainer.validate_stage4_full_rollout_worst_sample_class_reference_luminance_obligation(
            result
        )
    )
    rollout = trainer.validate_stage4_full_rollout_final_visible_consistency(result)
    required_classes = list(trainer.STAGE4_OBJECT_VISIBLE_STRUCTURE_CHANNELS)
    training[CONTRACT_KEY] = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": (
            trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_OBLIGATION_ID
        ),
        "sourceContract": {
            "contractId": (
                trainer.STAGE4_FULL_ROLLOUT_WORST_SAMPLE_CLASS_REFERENCE_LUMINANCE_OBLIGATION_ID
            ),
            "derivedClassWeights": deepcopy(
                source_contract["sourceContract"]["derivedWeights"]
            ),
            "classWeightSource": (
                "training.stage4FullRolloutWorstSampleClassReferenceLuminanceObligation."
                "sourceContract.derivedWeights"
            ),
            "rolloutWeight": float(rollout["weight"]),
            "rolloutWeightSource": "training.stage4FullRolloutFinalVisibleConsistency.weight",
            "freeNumericalWeightSelectionAllowed": False,
        },
        "requiredClasses": required_classes,
        "featureExtraction": {
            "autoencoderSource": "frozen_project_autoencoder",
            "encoderPath": "existing_project_autoencoder_encoder_sequential",
            "spatialStageSelection": (
                "ordered_unique_spatial_shapes_after_each_existing_encoder_module"
            ),
            "stageAggregation": "arithmetic_mean_over_all_unique_existing_spatial_stages",
            "predictionInput": (
                "final_decoded_rgb_inside_bound_class_mask_reference_rgb_outside_mask"
            ),
            "targetInput": "original_owner_approved_reference_rgb",
            "targetFeaturesDetached": True,
            "autoencoderParametersFrozen": True,
            "freeFeatureScaleOrWeightSelectionAllowed": False,
        },
        "rolloutBinding": {
            "parentContractId": "stage4_full_rollout_final_visible_consistency_v1",
            "decodedRgbSource": "same_50_step_final_decoded_rgb_before_detach",
            "rolloutSteps": int(result["inferenceSteps"]),
            "gradientTailSteps": int(rollout["gradientTailSteps"]),
            "entersExistingFullRolloutLossSlot": True,
        },
        "aggregation": {
            "perSample": "preserve_batch_samples_before_class_aggregation",
            "perClass": "one_independent_reference_feature_structure_obligation",
            "withinClassStages": (
                "arithmetic_mean_over_all_unique_existing_autoencoder_spatial_stages"
            ),
            "crossClass": "sum_existing_derived_weighted_object_obligations",
            "rolloutWeight": float(rollout["weight"]),
            "freeNumericalWeightSelectionAllowed": False,
        },
        "legalSupervision": {
            "reference": "original_owner_approved_reference_rgb",
            "conditionPack": "original_compiled_23_channel_condition_pack",
            "maskChannels": required_classes,
            "featureSource": "frozen_project_autoencoder_features",
            "failedPreviewPixelsUsedAsTargets": False,
            "machineReviewThresholdsUsedAsTargets": False,
            "machineReviewResultsUsedAsTargets": False,
        },
        "checkpointQualification": {
            "metric": "validationCheckpointSelectionScore",
            "source": "same_final_rollout_per_class_reference_feature_structure_obligation",
            "sameDerivedClassWeightsRequired": True,
            "sameRolloutWeightRequired": True,
            "entersQualificationScore": True,
        },
        "compatibility": {
            "modelArchitectureChanged": False,
            "existingLossValuesOrWeightsChanged": False,
            "datasetOrSplitChanged": False,
            "checkpointFormatChanged": False,
            "reviewThresholdsChanged": False,
            "oldModesWithoutContractPreserved": True,
        },
        "evidenceBindings": deepcopy(
            trainer.STAGE4_PER_CLASS_FINAL_VISIBLE_REFERENCE_FEATURE_STRUCTURE_EVIDENCE_BINDINGS
        ),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    trainer.validate_stage4_per_class_final_visible_reference_feature_structure_obligation(
        result
    )
    return result


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--consumption-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--smoke-inactive-source-identity-separation", action="store_true"
    )
    args = parser.parse_args()
    source_path = (ROOT / args.source).resolve()
    output_path = (ROOT / args.output).resolve()
    authorization_path = (ROOT / args.authorization).resolve()
    consumption_path = (ROOT / args.consumption).resolve()
    if output_path.exists():
        raise ValueError("reference-feature inactive configuration output already exists")
    if sha256_file(source_path) != args.source_sha256:
        raise ValueError("reference-feature source configuration identity changed")
    if args.smoke_inactive_source_identity_separation:
        authorization = validate_inactive_source_identity_separation_authorization(
            authorization_path, args.authorization_sha256,
            consumption_path, args.consumption_sha256,
        )
        configured_source = (
            ROOT / authorization["sourceEvidence"]["originalInactiveConfig"]["path"]
        ).resolve()
        if (
            source_path != configured_source
            or args.source_sha256
            != authorization["sourceEvidence"]["originalInactiveConfig"]["sha256"]
        ):
            raise ValueError("reference-feature separation source authorization changed")
        configured_output = (
            ROOT / authorization["outputNamespace"] / "inactive-smoke-source-config.json"
        ).resolve()
        if output_path != configured_output:
            raise ValueError("reference-feature separation output path changed")
        output_path.parent.mkdir(parents=True, exist_ok=False)
        output_path.write_text(
            json.dumps(
                compile_inactive_smoke_source_identity(
                    read_json(source_path),
                    source_path=source_path,
                    source_sha256=args.source_sha256,
                    authorization=authorization,
                    authorization_path=authorization_path,
                    authorization_sha256=args.authorization_sha256,
                    consumption_path=consumption_path,
                    consumption_sha256=args.consumption_sha256,
                ),
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
        print(json.dumps({
            "status": "stage4_reference_feature_structure_smoke_inactive_source_identity_separated",
            "path": project_path(output_path),
            "sha256": sha256_file(output_path),
        }))
        return 0
    authorization = validate_authorization(
        authorization_path, args.authorization_sha256,
        consumption_path, args.consumption_sha256,
    )
    configured_source = (ROOT / authorization["sourceConfig"]["path"]).resolve()
    if (
        source_path != configured_source
        or args.source_sha256 != authorization["sourceConfig"]["sha256"]
    ):
        raise ValueError("reference-feature source authorization changed")
    configured_output = (
        ROOT / authorization["outputNamespace"] / "inactive-config.json"
    ).resolve()
    if output_path != configured_output:
        raise ValueError("reference-feature output path changed")
    output_path.parent.mkdir(parents=True, exist_ok=False)
    output_path.write_text(
        json.dumps(compile_config(read_json(source_path)), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "stage4_per_class_final_visible_reference_feature_structure_inactive_config_compiled",
        "path": project_path(output_path),
        "sha256": sha256_file(output_path),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

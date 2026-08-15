from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
from types import SimpleNamespace


GPU_REQUEST_PREFIX = "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-"
MULTISCALE_GPU_REQUEST_PREFIX = (
    "owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-"
)
RETIRED_GPU_REQUEST_IDS = {
    "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-050000000",
    "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-054500000",
}
CURRENT_IMPLEMENTATION_ATTESTATION_STATUS = (
    "stage4_object_visible_structure_phase0_fresh_gpu_command_identity_implemented_cpu_verified"
)
PHASE0_MODE_ID = "stage4_object_visible_structure_phase0_engineering"
PHASE0_AUTHORIZATION_STATUS = "owner_authorized_stage4_object_visible_structure_phase0_engineering"
PHASE0_ADAPTER_BINDING = "object_visible_structure_phase0_adapter"
MULTISCALE_IDENTITY_SCHEMA = (
    "ai-painter-stage4-object-reference-multiscale-phase0-execution-identity-v1"
)
MULTISCALE_AUTHORIZATION_SCHEMA = (
    "ai-painter-owner-stage4-object-reference-multiscale-phase0-gpu-execution-v2"
)
MULTISCALE_CONSUMPTION_STATUS = (
    "stage4_object_reference_multiscale_phase0_gpu_authorization_atomically_consumed"
)
MULTISCALE_IMPLEMENTATION_ATTESTATION_STATUS = (
    "stage4_object_reference_multiscale_phase0_false_positive_contract_corrected_cpu_verified"
)
MULTISCALE_MODE_ID = "stage4_object_reference_multiscale_phase0_engineering"
MULTISCALE_AUTHORIZATION_STATUS = (
    "owner_authorized_stage4_object_reference_multiscale_phase0_engineering"
)
MULTISCALE_TRAINING_OBJECTIVE = (
    "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
)


def is_multiscale_identity(identity: dict) -> bool:
    return identity.get("schemaVersion") == MULTISCALE_IDENTITY_SCHEMA


def phase0_profile(identity: dict) -> dict:
    multiscale = is_multiscale_identity(identity)
    return {
        "multiscale": multiscale,
        "identitySchema": MULTISCALE_IDENTITY_SCHEMA if multiscale else (
            "ai-painter-stage4-object-visible-structure-phase0-execution-identity-v1"
        ),
        "authorizationSchema": MULTISCALE_AUTHORIZATION_SCHEMA if multiscale else (
            "ai-painter-owner-stage4-object-visible-structure-phase0-gpu-execution-v1"
        ),
        "requestPrefix": MULTISCALE_GPU_REQUEST_PREFIX if multiscale else GPU_REQUEST_PREFIX,
        "consumptionStatus": MULTISCALE_CONSUMPTION_STATUS if multiscale else (
            "stage4_object_visible_structure_phase0_gpu_authorization_atomically_consumed"
        ),
        "attestationStatus": MULTISCALE_IMPLEMENTATION_ATTESTATION_STATUS if multiscale else (
            CURRENT_IMPLEMENTATION_ATTESTATION_STATUS
        ),
        "modeId": MULTISCALE_MODE_ID if multiscale else PHASE0_MODE_ID,
        "authorizationStatus": MULTISCALE_AUTHORIZATION_STATUS if multiscale else (
            PHASE0_AUTHORIZATION_STATUS
        ),
        "policyVersion": (
            "stage4-object-reference-multiscale-phase0-command-policy-v1"
            if multiscale else "stage4-object-visible-structure-phase0-command-policy-v1"
        ),
    }


def contract_only() -> int:
    print(json.dumps({
        "schemaVersion": "ai-painter-stage4-object-visible-structure-phase0-python-entry-contract-v1",
        "status": "stage4_object_visible_structure_phase0_python_entry_contract_valid_cpu_only",
        "trainerImported": False,
        "torchImported": False,
        "cudaInitialized": False,
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
    }, indent=2))
    return 0


def object_reference_multiscale_contract_only() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") not in (None, ""):
        raise ValueError("multiscale Phase0 CPU contract requires CUDA_VISIBLE_DEVICES empty")
    print(json.dumps({
        "schemaVersion": (
            "ai-painter-stage4-object-reference-multiscale-phase0-python-entry-contract-v1"
        ),
        "status": (
            "stage4_object_reference_multiscale_phase0_python_entry_contract_valid_cpu_only"
        ),
        "trainingObjectiveContractId": MULTISCALE_TRAINING_OBJECTIVE,
        "diagnosticManifestMetricCount": 48,
        "pyramidScales": [1.0, 0.5, 0.25],
        "trainerImported": False,
        "torchImported": False,
        "cudaInitialized": False,
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
    }, indent=2))
    return 0


def validate_object_reference_multiscale_phase0_update_evidence(
    report: dict, expected_fields: list[str] | None = None,
) -> dict:
    if (
        report.get("status") != "phase0_single_cuda_optimizer_step_passed_closed"
        or report.get("optimizerStepCount") != 1
        or report.get("backwardCallCount") != 1
        or report.get("replayOptimizerStepCount") != 0
        or report.get("parameterGradientsCleared") is not True
        or report.get("lossFinite") is not True
        or report.get("gradientFinite") is not True
        or report.get("gradientNonzero") is not True
        or report.get("weightsChanged") is not True
        or report.get("autoencoderWeightsChanged") is not False
    ):
        raise ValueError("object-reference-multiscale Phase0 update count or integrity gate failed")
    manifest = report.get("diagnosticManifest", {})
    fields = manifest.get("fields")
    values = manifest.get("values")
    if (
        manifest.get("fieldCount") != 48
        or not isinstance(fields, list)
        or len(fields) != 48
        or len(set(fields)) != 48
        or not isinstance(values, dict)
        or list(values) != fields
        or (expected_fields is not None and fields != expected_fields)
        or any(
            not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or float(value) < 0.0
            for value in values.values()
        )
    ):
        raise ValueError("object-reference-multiscale Phase0 exact 48 metric gate failed")
    groups = report.get("requiredGradientGroups", {})
    expected_groups = {"footprints", "tree", "rock", "vegetation", "combined"}
    if set(groups) != expected_groups:
        raise ValueError("object-reference-multiscale Phase0 gradient group set changed")
    for identity in ("footprints", "tree", "rock", "vegetation"):
        group = groups[identity]
        denoiser = group.get("denoiserGradient", {})
        matching = group.get("matchingSemanticMixtureExpertGradient", {})
        if (
            group.get("finiteAndStrictlyNonzero") is not True
            or denoiser.get("finite") is not True
            or not isinstance(denoiser.get("absoluteSum"), (int, float))
            or not math.isfinite(float(denoiser["absoluteSum"]))
            or float(denoiser["absoluteSum"]) <= 0.0
            or matching.get("finite") is not True
            or not isinstance(matching.get("absoluteSum"), (int, float))
            or not math.isfinite(float(matching["absoluteSum"]))
            or float(matching["absoluteSum"]) <= 0.0
        ):
            raise ValueError(
                f"object-reference-multiscale Phase0 object gradient gate failed:{identity}"
            )
    combined = groups["combined"]
    combined_gradient = combined.get("denoiserGradient", {})
    if (
        combined.get("finiteAndStrictlyNonzero") is not True
        or combined_gradient.get("finite") is not True
        or not isinstance(combined_gradient.get("absoluteSum"), (int, float))
        or not math.isfinite(float(combined_gradient["absoluteSum"]))
        or float(combined_gradient["absoluteSum"]) <= 0.0
    ):
        raise ValueError("object-reference-multiscale Phase0 combined gradient gate failed")
    return {
        "status": "object_reference_multiscale_phase0_update_evidence_contract_valid",
        "optimizerStepCount": 1,
        "backwardCallCount": 1,
        "replayOptimizerStepCount": 0,
        "diagnosticManifestMetricCount": 48,
        "requiredGradientGroupCount": 5,
        "parameterGradientsCleared": True,
    }


def install_phase0_visible_structure_validator(trainer):
    def validate_current_visible_structure(config):
        contract = config.get("training", {}).get("stage4ObjectVisibleStructureSupervision", {})
        gate = contract.get("activationGate", {})
        required_true = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
        }
        if (
            contract.get("enabled") is not True
            or contract.get("status") != "training_loss_active_owner_authorized"
            or contract.get("contractId") != "stage4_four_typed_object_visible_structure_supervision_v1"
            or set(gate) != {
                "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
                "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
                "smokeNow", "stage4FullTrainingNow", "stage5Now", "formalInferenceNow",
                "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
            }
            or any(gate.get(key) is not (key in required_true) for key in gate)
        ):
            raise ValueError("object-visible-structure Phase0 activation gate changed")
        return {
            "status": "stage4_object_visible_structure_supervision_contract_valid_phase0_active",
            "sourceChannels": contract["sourceChannels"],
            "derivedWeights": contract["derivedWeights"],
        }

    trainer.validate_stage4_object_visible_structure_supervision = validate_current_visible_structure


def install_phase0_object_reference_multiscale_validator(trainer):
    def validate_current_multiscale(config):
        contract = config.get("training", {}).get(
            "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision", {}
        )
        gate = contract.get("activationGate", {})
        required_true = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
        }
        expected_gate = {
            "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
            "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
            "smokeNow", "stage4FullTrainingNow", "stage5Now", "formalInferenceNow",
            "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
        }
        if (
            contract.get("enabled") is not True
            or contract.get("status") != "training_loss_active_owner_authorized"
            or contract.get("contractId") != MULTISCALE_TRAINING_OBJECTIVE
            or contract.get("sourceChannels") != [
                "object_footprints", "object_tree", "object_rock", "object_vegetation",
            ]
            or contract.get("pyramidScales") != [1.0, 0.5, 0.25]
            or contract.get("aggregation", {}).get("freeNumericalWeightSelectionAllowed") is not False
            or contract.get("noveltyBoundary", {}).get("failedSingleScaleContractReuseAllowed") is not False
            or set(gate) != expected_gate
            or any(gate.get(key) is not (key in required_true) for key in gate)
        ):
            raise ValueError("object-reference-multiscale Phase0 activation gate changed")
        return {
            "status": (
                "stage4_object_reference_multiscale_supervision_contract_valid_phase0_active"
            ),
            "sourceChannels": contract["sourceChannels"],
            "pyramidScales": contract["pyramidScales"],
            "derivedWeights": contract["derivedWeights"],
        }

    trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision = (
        validate_current_multiscale
    )


def install_phase0_mode_and_execution_grant(
    trainer, identity, prospective_current_python_entry=False, mutation=None,
):
    from ai_painter_execution_grant import ExecutionAction, issue_execution_grant, sha256_json
    from ai_painter_stage_mode_registry import ModeSpec

    authorization, consumption, _ = validate_phase0_authorization_lineage(
        trainer,
        identity,
        prospective_current_python_entry=prospective_current_python_entry,
    )
    profile = phase0_profile(identity)
    actions = authorization.get("executionActions", {})
    required_true = {
        "projectAutoencoderCheckpointReadAndLoadFrozen",
        "fixedRandomDenoiserInitialization",
        "singleSample194ValidationRead",
        "exactlyOneOptimizerCreation",
        "exactlyOneBackwardAndOptimizerStep",
        "boundedDenoiserWeightModification",
        "nonPromotableDiagnosticCheckpointWrite",
        "diagnosticCheckpointReloadInTwoFreshProcesses",
        "modelConditionRgbAndPngByteIdentityComparison",
    }
    required_false = {
        "failedDenoiserCheckpointReadOrLoad",
        "moreThanOneOptimizerStep",
        "modelSmoke",
        "formalStage0Training",
        "stage1OrStage2",
        "validation",
        "formalInference",
        "checkpointPromotion",
        "runtimeFrame",
        "worldEntry",
        "reviewThresholdChange",
        "automaticRetry",
    }
    if any(actions.get(name) is not True for name in required_true) or any(
        actions.get(name) is not False for name in required_false
    ):
        raise ValueError("object-visible-structure Phase0 action authorization changed")

    mode = ModeSpec(
        mode_id=profile["modeId"],
        authorization_status=profile["authorizationStatus"],
        architecture="stage4_fact_conditioned_semantic_mixture_decoder_v1",
        stage=0,
        execution_kind="phase0_engineering",
        adapter_binding=(
            "fact_conditioned_semantic_mixture_full_training_adapter"
            if mutation == "formal_adapter"
            else PHASE0_ADAPTER_BINDING
        ),
        sample_split="validation",
        active_execution=True,
    )
    allowed_actions = {
        ExecutionAction.SELECT_BOUND_SAMPLE,
        ExecutionAction.INSPECT_AUTOENCODER_IDENTITY,
        ExecutionAction.LOAD_AUTOENCODER,
        ExecutionAction.INSPECT_CHECKPOINT_IDENTITY,
        ExecutionAction.CREATE_OPTIMIZER,
        ExecutionAction.EXECUTE_BACKWARD,
        ExecutionAction.MUTATE_MODEL_WEIGHTS,
        ExecutionAction.WRITE_DIAGNOSTIC_CHECKPOINT,
    }
    if mutation == "formal_stage_action":
        allowed_actions.add(ExecutionAction.RUN_STAGE0)
    selected_split = "train" if mutation == "selected_split" else "validation"
    fixed = authorization["taskIdentity"]
    dataset_constraints = {
        "capacity": 64,
        "splitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
        "selectedSplit": selected_split,
        "sampleId": fixed["sampleId"],
        "requiredBoundarySides": fixed["requiredBoundarySides"],
        "sampleMustRemainInRegisteredSplit": True,
    }
    checkpoint_constraints = {
        "parentDenoiserAllowed": False,
        "failedDenoiserCheckpointAllowed": False,
        "projectAutoencoderLoadAllowed": True,
        "diagnosticCheckpointWriteAllowed": True,
        "diagnosticCheckpointReloadAllowed": True,
        "diagnosticCheckpointPromotable": False,
        "reproductionProcessCount": 2,
    }
    preview_constraints = {
        "enabled": True,
        "freshProcessReproductionCount": 2,
        "conditionRgbAndPngByteIdentityRequired": True,
        "formalPromotionAllowed": False,
    }
    authorization_identity = {
        "requestId": identity["requestId"],
        "commandRef": identity["commandRef"],
        "scope": identity["scope"],
        "authorizationPath": identity["authorizationPath"],
        "authorizationSha256": identity["authorizationSha256"],
        "consumptionPath": identity["phase0ConsumptionPath"],
        "consumptionSha256": identity["phase0ConsumptionSha256"],
        "consumptionStatus": consumption["status"],
        "modeId": profile["modeId"],
    }
    input_payload = {
        "mode": PHASE0_MODE_ID,
        "architecture": mode.architecture,
        "datasetConstraints": dataset_constraints,
        "checkpointConstraints": checkpoint_constraints,
        "previewConstraints": preview_constraints,
        "authorizationIdentity": authorization_identity,
    }
    grant = issue_execution_grant(
        allowed_actions=allowed_actions,
        dataset_constraints=dataset_constraints,
        checkpoint_constraints=checkpoint_constraints,
        preview_constraints=preview_constraints,
        authorization_identity=authorization_identity,
        policy_version=profile["policyVersion"],
        input_digest=sha256_json(input_payload),
    )
    forbidden_actions = {
        ExecutionAction.LOAD_PARENT_DENOISER,
        ExecutionAction.WRITE_SMOKE_CHECKPOINT,
        ExecutionAction.RUN_STAGE0,
        ExecutionAction.RUN_STAGE1,
        ExecutionAction.RUN_STAGE2,
        ExecutionAction.RUN_STRICT_REVALIDATION,
        ExecutionAction.RUN_FORMAL_INFERENCE,
        ExecutionAction.PROMOTE_CHECKPOINT,
        ExecutionAction.CREATE_RUNTIME_FRAME,
        ExecutionAction.ENTER_WORLD,
        ExecutionAction.AUTOMATIC_RETRY,
    }
    if (
        mode.mode_id != profile["modeId"]
        or mode.authorization_status != profile["authorizationStatus"]
        or mode.adapter_binding != PHASE0_ADAPTER_BINDING
        or mode.execution_kind != "phase0_engineering"
        or mode.sample_split != "validation"
        or mode.active_execution is not True
        or grant.dataset_constraints.get("selectedSplit") != "validation"
        or any(grant.permits(action) for action in forbidden_actions)
    ):
        raise ValueError("object-visible-structure dedicated Phase0 mode or grant is invalid")

    original_validate_training_inputs = trainer.validate_training_inputs
    original_resolve_stage_mode = trainer.resolve_stage_mode
    state = {
        "immutableFormalSourceValidated": False,
        "dedicatedModeInstalled": False,
        "dispatchModeResolutionCount": 0,
        "mode": mode,
        "grant": grant,
    }

    def validate_formal_source_then_install(config, package):
        if mutation == "source_validation_bypass":
            result = None
        else:
            result = original_validate_training_inputs(config, package)
            state["immutableFormalSourceValidated"] = True
        if state["immutableFormalSourceValidated"] is not True:
            raise ValueError("object-visible-structure Phase0 cannot bypass immutable formal source validation")
        if config.get("denoiserArchitecture") != mode.architecture:
            raise ValueError("object-visible-structure Phase0 architecture changed")
        def resolve_one_shot_phase0_dispatch(candidate_config):
            if mutation == "persistent_dispatch_mode":
                return mode
            if state["dispatchModeResolutionCount"] == 0:
                state["dispatchModeResolutionCount"] += 1
                return mode
            return original_resolve_stage_mode(candidate_config)

        trainer.resolve_stage_mode = resolve_one_shot_phase0_dispatch
        trainer.resolve_stage_execution_grant = lambda _config, **_kwargs: grant
        state["dedicatedModeInstalled"] = True
        return result

    trainer.validate_training_inputs = validate_formal_source_then_install
    return state


def derived_config_contract_only() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("derived config CPU contract requires CUDA_VISIBLE_DEVICES to be empty")
    config_index = sys.argv.index("--config") + 1
    package_index = sys.argv.index("--dataset-package") + 1
    script_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_root))
    import train_ai_assisted_conditional_denoiser as trainer
    install_phase0_visible_structure_validator(trainer)
    config = trainer.read_json(Path(sys.argv[config_index]))
    package = trainer.read_json(Path(sys.argv[package_index]))
    trainer.validate_training_inputs(config, package)
    expected = list(trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config))
    registry = config["training"]["stage4FactConditionedSemanticMixture"]["diagnosticManifestRegistry"]
    report = {
        "schemaVersion": "ai-painter-stage4-object-visible-structure-phase0-derived-config-trainer-preflight-v1",
        "status": "stage4_object_visible_structure_phase0_derived_config_real_trainer_input_contract_passed_cpu_only",
        "diagnosticFieldCount": len(expected),
        "diagnosticFieldsExact": registry.get("exactFields") == expected,
        "trainerImported": True,
        "torchImported": "torch" in sys.modules,
        "cudaInitialized": bool(trainer.torch.cuda.is_initialized()),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "weightsModified": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }
    if report["diagnosticFieldCount"] != 32 or report["diagnosticFieldsExact"] is not True or report["cudaInitialized"] is not False:
        raise ValueError("derived config trainer contract report is invalid")
    print(json.dumps(report, indent=2))
    return 0


def object_reference_multiscale_derived_config_contract_only() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") not in (None, ""):
        raise ValueError("multiscale derived config CPU contract requires CUDA_VISIBLE_DEVICES empty")
    config_index = sys.argv.index("--config") + 1
    package_index = sys.argv.index("--dataset-package") + 1
    script_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_root))
    import train_ai_assisted_conditional_denoiser as trainer
    install_phase0_object_reference_multiscale_validator(trainer)
    config = trainer.read_json(Path(sys.argv[config_index]))
    package = trainer.read_json(Path(sys.argv[package_index]))
    trainer.validate_training_inputs(config, package)
    validation = (
        trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
            config
        )
    )
    expected = list(trainer.fact_conditioned_semantic_mixture_diagnostic_fields(config))
    registry = config["training"]["stage4FactConditionedSemanticMixture"][
        "diagnosticManifestRegistry"
    ]
    report = {
        "schemaVersion": (
            "ai-painter-stage4-object-reference-multiscale-phase0-derived-config-"
            "trainer-preflight-v1"
        ),
        "status": (
            "stage4_object_reference_multiscale_phase0_derived_config_real_trainer_"
            "input_contract_passed_cpu_only"
        ),
        "diagnosticFieldCount": len(expected),
        "diagnosticFieldsExact": registry.get("exactFields") == expected,
        "multiscaleContractStatus": validation.get("status"),
        "pyramidScales": validation.get("pyramidScales"),
        "trainerImported": True,
        "torchImported": "torch" in sys.modules,
        "cudaInitialized": bool(trainer.torch.cuda.is_initialized()),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "weightsModified": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }
    if (
        report["diagnosticFieldCount"] != 48
        or report["diagnosticFieldsExact"] is not True
        or report["pyramidScales"] != [1.0, 0.5, 0.25]
        or report["cudaInitialized"] is not False
    ):
        raise ValueError("multiscale derived config trainer contract report is invalid")
    print(json.dumps(report, indent=2))
    return 0


def validate_phase0_authorization_lineage(
    trainer, identity, mutation=None, prospective_current_python_entry=False,
    prospective_request_id=None,
):
    identity = json.loads(json.dumps(identity))
    profile = phase0_profile(identity)
    current_python_sha = trainer.sha256_file(Path(__file__).resolve())
    if prospective_current_python_entry:
        identity["pythonEntrySha256"] = current_python_sha
    if prospective_request_id is not None:
        identity["requestId"] = prospective_request_id
        identity["commandRef"] = prospective_request_id
        identity["runId"] = (
            f"{prospective_request_id.removeprefix(profile['requestPrefix'])}-phase0"
        )
    if identity.get("schemaVersion") != profile["identitySchema"]:
        raise ValueError("object-visible-structure Phase0 identity schema is invalid")
    if identity.get("status") != "phase0_execution_identity_active_not_completed":
        raise ValueError("object-visible-structure Phase0 identity is not active")
    bound = (
        ("authorizationPath", "authorizationSha256"),
        ("phase0ConsumptionPath", "phase0ConsumptionSha256"),
        ("implementationAttestationPath", "implementationAttestationSha256"),
        ("sourceInactiveConfigPath", "sourceInactiveConfigSha256"),
        ("datasetManifestPath", "datasetManifestSha256"),
        ("autoencoderCheckpointPath", "autoencoderCheckpointSha256"),
        ("trainerPath", "trainerSha256"),
        ("pythonEntryPath", "pythonEntrySha256"),
    )
    for path_key, sha_key in bound:
        candidate = Path(str(identity.get(path_key, "")))
        if not candidate.is_file() or trainer.sha256_file(candidate) != identity.get(sha_key):
            raise ValueError(f"object-visible-structure Phase0 bound file changed:{path_key}")
    authorization = trainer.read_json(Path(identity["authorizationPath"]))
    consumption = trainer.read_json(Path(identity["phase0ConsumptionPath"]))
    attestation = trainer.read_json(Path(identity["implementationAttestationPath"]))
    if prospective_current_python_entry:
        authorization["bindings"]["phase0PythonEntry"]["sha256"] = current_python_sha
        attestation["pythonEntrySha256"] = current_python_sha
        attestation["status"] = profile["attestationStatus"]
    if prospective_request_id is not None:
        authorization["requestId"] = prospective_request_id
        authorization["commandRef"] = prospective_request_id
        consumption["requestId"] = prospective_request_id
        consumption["commandRef"] = prospective_request_id
        consumption["runId"] = identity["runId"]
    if mutation == "authorization_request_id":
        authorization["requestId"] = "mutated"
    elif mutation == "consumption_authorization_sha":
        consumption["authorizationSha256"] = "0" * 64
    elif mutation == "consumption_run_id":
        consumption["runId"] = "mutated"
    elif mutation == "attestation_status":
        attestation["status"] = "stage4_object_visible_structure_phase0_execution_entry_implemented_cpu_verified"
    elif mutation == "attestation_trainer_sha":
        attestation["trainerSha256"] = "0" * 64
    elif mutation is not None:
        raise ValueError("unknown Phase0 lineage mutation")
    if (
        authorization.get("schemaVersion") != profile["authorizationSchema"]
        or authorization.get("status") != "owner_authorized_unconsumed"
        or not str(authorization.get("requestId", "")).startswith(profile["requestPrefix"])
        or (
            not profile["multiscale"]
            and authorization.get("requestId") in RETIRED_GPU_REQUEST_IDS
        )
        or authorization.get("requestId") != identity.get("requestId")
        or authorization.get("commandRef") != identity.get("commandRef")
        or consumption.get("status") != profile["consumptionStatus"]
        or consumption.get("requestId") != identity.get("requestId")
        or consumption.get("commandRef") != identity.get("commandRef")
        or consumption.get("authorizationSha256") != identity.get("authorizationSha256")
        or consumption.get("runId") != identity.get("runId")
        or attestation.get("status") != profile["attestationStatus"]
        or authorization.get("bindings", {}).get("phase0PythonEntry", {}).get("sha256") != identity.get("pythonEntrySha256")
        or attestation.get("pythonEntrySha256") != identity.get("pythonEntrySha256")
        or attestation.get("trainerSha256") != trainer.sha256_file(Path(__file__).resolve().parent / "train_ai_assisted_conditional_denoiser.py")
    ):
        raise ValueError("object-visible-structure Phase0 authorization lineage is invalid")
    return authorization, consumption, attestation


def lineage_contract_only() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("lineage CPU contract requires CUDA_VISIBLE_DEVICES to be empty")
    identity_index = sys.argv.index("--phase0-execution-identity") + 1
    mutation = None
    if "--lineage-mutation" in sys.argv:
        mutation = sys.argv[sys.argv.index("--lineage-mutation") + 1]
    prospective_request_id = None
    if "--prospective-request-id" in sys.argv:
        prospective_request_id = sys.argv[sys.argv.index("--prospective-request-id") + 1]
    script_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_root))
    import train_ai_assisted_conditional_denoiser as trainer
    identity = trainer.read_json(Path(sys.argv[identity_index]))
    profile = phase0_profile(identity)
    validate_phase0_authorization_lineage(
        trainer, identity, mutation, prospective_current_python_entry=True,
        prospective_request_id=prospective_request_id,
    )
    report = {
        "schemaVersion": (
            "ai-painter-stage4-object-reference-multiscale-phase0-lineage-status-contract-v1"
            if profile["multiscale"] else
            "ai-painter-stage4-object-visible-structure-phase0-lineage-status-contract-v1"
        ),
        "status": (
            "stage4_object_reference_multiscale_phase0_current_attestation_status_"
            "lineage_contract_passed_cpu_only"
            if profile["multiscale"] else
            "stage4_object_visible_structure_phase0_current_attestation_status_"
            "lineage_contract_passed_cpu_only"
        ),
        "implementationAttestationStatus": profile["attestationStatus"],
        "prospectiveCurrentPythonEntryIdentityAdjustedInMemory": True,
        "currentPythonEntrySha256": trainer.sha256_file(Path(__file__).resolve()),
        "prospectiveRequestId": prospective_request_id,
        "trainerImported": True,
        "torchImported": "torch" in sys.modules,
        "cudaInitialized": bool(trainer.torch.cuda.is_initialized()),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "weightsModified": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }
    if report["cudaInitialized"] is not False:
        raise ValueError("lineage CPU contract initialized CUDA")
    print(json.dumps(report, indent=2))
    return 0


def validate_current_phase0_cli_contract(
    trainer, args, config, package, prospective_current_python_entry=False,
):
    identity_path = args.phase0_execution_identity
    if identity_path is None or not identity_path.is_file():
        raise ValueError("object-visible-structure Phase0 execution identity is required")
    identity = trainer.read_json(identity_path)
    profile = phase0_profile(identity)
    if identity.get("schemaVersion") != profile["identitySchema"]:
        raise ValueError("object-visible-structure Phase0 identity schema is invalid")
    if identity.get("status") != "phase0_execution_identity_active_not_completed":
        raise ValueError("object-visible-structure Phase0 identity is not active")
    expected_part = "single_optimizer_step" if args.stage4_validation_kernel_phase0_update else "fresh_process_checkpoint_preview_reproduction"
    if identity.get("executionPart") != expected_part:
        raise ValueError("object-visible-structure Phase0 execution part changed")
    authorization, _, _ = validate_phase0_authorization_lineage(
        trainer, identity,
        prospective_current_python_entry=prospective_current_python_entry,
    )
    fixed = authorization.get("taskIdentity", {})
    if (
        fixed.get("architectureId") != config.get("denoiserArchitecture")
        or fixed.get("sampleId") != args.overfit_sample_id
        or fixed.get("sampleSplit") != "validation"
        or fixed.get("seed") != int(config.get("training", {}).get("seed", -1))
        or fixed.get("timestep") != 999
        or fixed.get("resolution") != {"width": 256, "height": 192}
        or fixed.get("requiredBoundarySides") != ["west"]
        or (
            profile["multiscale"]
            and (
                fixed.get("trainingObjectiveContractId") != MULTISCALE_TRAINING_OBJECTIVE
                or fixed.get("pyramidScales") != [1.0, 0.5, 0.25]
                or fixed.get("diagnosticManifestMetricCount") != 48
            )
        )
    ):
        raise ValueError("object-visible-structure Phase0 fixed identity changed")
    if args.config.resolve() != Path(identity["sourceInactiveConfigPath"]).resolve():
        raise ValueError("object-visible-structure Phase0 config CLI path changed")
    if args.dataset_package.resolve() != Path(identity["datasetManifestPath"]).resolve():
        raise ValueError("object-visible-structure Phase0 dataset CLI path changed")
    if args.autoencoder_checkpoint.resolve() != Path(identity["autoencoderCheckpointPath"]).resolve():
        raise ValueError("object-visible-structure Phase0 Autoencoder CLI path changed")
    if args.initial_denoiser_checkpoint is not None:
        raise ValueError("object-visible-structure Phase0 forbids old Denoiser Checkpoint")
    if expected_part == "fresh_process_checkpoint_preview_reproduction":
        checkpoint = args.phase0_diagnostic_checkpoint
        if checkpoint is None or not checkpoint.is_file():
            raise ValueError("object-visible-structure Phase0 reproduction Checkpoint is required")
        if trainer.project_path(checkpoint) != identity.get("diagnosticCheckpointPath") or trainer.sha256_file(checkpoint) != identity.get("diagnosticCheckpointSha256"):
            raise ValueError("object-visible-structure Phase0 diagnostic Checkpoint identity changed")
    elif args.phase0_diagnostic_checkpoint is not None:
        raise ValueError("object-visible-structure Phase0 update cannot load a Denoiser Checkpoint")
    return identity


def full_cli_contract_only() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("full CLI CPU contract requires CUDA_VISIBLE_DEVICES to be empty")
    identity_path = Path(sys.argv[sys.argv.index("--phase0-execution-identity") + 1])
    mutation = None
    if "--full-cli-mutation" in sys.argv:
        mutation = sys.argv[sys.argv.index("--full-cli-mutation") + 1]
    script_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_root))
    import train_ai_assisted_conditional_denoiser as trainer
    identity = trainer.read_json(identity_path)
    profile = phase0_profile(identity)
    config_path = Path(identity["sourceInactiveConfigPath"])
    dataset_path = Path(identity["datasetManifestPath"])
    autoencoder_path = Path(identity["autoencoderCheckpointPath"])
    authorization = trainer.read_json(Path(identity["authorizationPath"]))
    args = SimpleNamespace(
        phase0_execution_identity=identity_path,
        stage4_validation_kernel_phase0_update=True,
        config=config_path,
        dataset_package=dataset_path,
        autoencoder_checkpoint=autoencoder_path,
        initial_denoiser_checkpoint=None,
        phase0_diagnostic_checkpoint=None,
        overfit_sample_id=authorization["taskIdentity"]["sampleId"],
    )
    if mutation == "fixed_sample_id":
        args.overfit_sample_id = "mutated"
    elif mutation == "config_path":
        args.config = Path("mutated-config.json")
    elif mutation == "dataset_path":
        args.dataset_package = Path("mutated-dataset.json")
    elif mutation == "autoencoder_path":
        args.autoencoder_checkpoint = Path("mutated-autoencoder.pt")
    elif mutation == "initial_denoiser_checkpoint":
        args.initial_denoiser_checkpoint = Path("forbidden-denoiser.pt")
    elif mutation is not None:
        raise ValueError("unknown full CLI mutation")
    validate_current_phase0_cli_contract(
        trainer, args, trainer.read_json(config_path), trainer.read_json(dataset_path),
        prospective_current_python_entry=True,
    )
    report = {
        "schemaVersion": (
            "ai-painter-stage4-object-reference-multiscale-phase0-full-cli-contract-v1"
            if profile["multiscale"] else
            "ai-painter-stage4-object-visible-structure-phase0-full-cli-contract-v1"
        ),
        "status": (
            "stage4_object_reference_multiscale_phase0_full_cli_contract_passed_cpu_only"
            if profile["multiscale"] else
            "stage4_object_visible_structure_phase0_full_cli_contract_passed_cpu_only"
        ),
        "postLineageFixedIdentityChecked": True,
        "postLineageCliPathsChecked": True,
        "failedDenoiserCheckpointForbidden": True,
        "trainerImported": True,
        "torchImported": "torch" in sys.modules,
        "cudaInitialized": bool(trainer.torch.cuda.is_initialized()),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "weightsModified": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }
    if report["cudaInitialized"] is not False:
        raise ValueError("full CLI CPU contract initialized CUDA")
    print(json.dumps(report, indent=2))
    return 0


def trainer_pre_model_control_flow_contract_only() -> int:
    if os.environ.get("CUDA_VISIBLE_DEVICES") != "":
        raise ValueError("Trainer control-flow CPU contract requires CUDA_VISIBLE_DEVICES to be empty")
    identity_path = Path(sys.argv[sys.argv.index("--phase0-execution-identity") + 1])
    mutation = None
    if "--control-flow-mutation" in sys.argv:
        index = sys.argv.index("--control-flow-mutation")
        mutation = sys.argv[index + 1]
        del sys.argv[index:index + 2]
    sys.argv.remove("--trainer-pre-model-control-flow-contract-only")
    script_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_root))
    import train_ai_assisted_conditional_denoiser as trainer

    identity = trainer.read_json(identity_path)
    profile = phase0_profile(identity)
    if profile["multiscale"]:
        install_phase0_object_reference_multiscale_validator(trainer)
    else:
        install_phase0_visible_structure_validator(trainer)

    def validate_current_phase0_cli(args, config, package):
        return validate_current_phase0_cli_contract(
            trainer, args, config, package, prospective_current_python_entry=True,
        )

    trainer.validate_stage4_validation_kernel_phase0_cli = validate_current_phase0_cli
    state = install_phase0_mode_and_execution_grant(
        trainer, identity, prospective_current_python_entry=True, mutation=mutation,
    )

    class PreDatasetSentinel(RuntimeError):
        pass

    def stop_before_dataset_materialization(*_args, **_kwargs):
        raise PreDatasetSentinel("trainer_reached_dataset_constructor_without_materialization")

    trainer.AiAssistedConditionalDenoiserDataset = stop_before_dataset_materialization
    reached_sentinel = False
    try:
        trainer.main()
    except PreDatasetSentinel:
        reached_sentinel = True
    if not reached_sentinel:
        raise ValueError("Trainer did not reach the pre-dataset Phase0 sentinel")
    config = trainer.read_json(Path(identity["sourceInactiveConfigPath"]))
    package = trainer.read_json(Path(identity["datasetManifestPath"]))
    nested_mode_id = trainer.resolve_stage_mode(config).mode_id
    nested_contract_checks = {
        "semanticMixture": trainer.validate_fact_conditioned_semantic_mixture_stage4_cpu_contract(
            config, package,
        ),
        "perClassFinalVisibleRgb": trainer.validate_stage4_per_class_final_visible_rgb_obligation(config),
        "distributionAware": trainer.validate_stage4_distribution_aware_visible_spatial_semantic_obligation(config),
        "epochWorstReplay": trainer.validate_stage4_epoch_worst_sample_class_replay(config),
        "vegetationFinalVisible": trainer.validate_stage4_vegetation_final_visible_semantic_repair(config),
        "fullRollout": trainer.validate_stage4_full_rollout_final_visible_consistency(config),
        "diagnosticManifest": trainer.validate_fact_conditioned_semantic_mixture_stage4_diagnostic_manifest_support_contract(config),
    }
    if profile["multiscale"]:
        nested_contract_checks["objectReferenceMultiscale"] = (
            trainer.validate_stage4_object_reference_multiscale_luminance_structure_supervision(
                config
            )
        )
    else:
        nested_contract_checks["objectVisibleStructure"] = (
            trainer.validate_stage4_object_visible_structure_supervision(config)
        )
    grant = state["grant"]
    report = {
        "schemaVersion": (
            "ai-painter-stage4-object-reference-multiscale-phase0-trainer-pre-model-"
            "control-flow-v1"
            if profile["multiscale"] else
            "ai-painter-stage4-object-visible-structure-phase0-trainer-pre-model-"
            "control-flow-v1"
        ),
        "status": (
            "stage4_object_reference_multiscale_phase0_real_trainer_pre_model_"
            "control_flow_passed_cpu_only"
            if profile["multiscale"] else
            "stage4_object_visible_structure_phase0_real_trainer_pre_model_"
            "control_flow_passed_cpu_only"
        ),
        "immutableFormalSourceValidatedFirst": state["immutableFormalSourceValidated"],
        "dedicatedModeInstalledAfterSourceValidation": state["dedicatedModeInstalled"],
        "resolvedModeId": state["mode"].mode_id,
        "resolvedAdapterBinding": state["mode"].adapter_binding,
        "resolvedExecutionKind": state["mode"].execution_kind,
        "dispatchModeResolutionCount": state["dispatchModeResolutionCount"],
        "nestedValidatorModeId": nested_mode_id,
        "nestedFormalContractCheckCount": len(nested_contract_checks),
        "nestedFormalContractsValidatedAfterDispatch": True,
        "selectedSplit": grant.dataset_constraints.get("selectedSplit"),
        "formalStage0ActionDenied": not grant.permits("run_stage0"),
        "smokeCheckpointActionDenied": not grant.permits("write_smoke_checkpoint"),
        "automaticRetryDenied": not grant.permits("automatic_retry"),
        "datasetConstructorInterceptedBeforeMaterialization": reached_sentinel,
        "datasetMaterialized": False,
        "trainerImported": True,
        "torchImported": "torch" in sys.modules,
        "cudaInitialized": bool(trainer.torch.cuda.is_initialized()),
        "checkpointRead": False,
        "modelLoaded": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "weightsModified": False,
        "trainingStarted": False,
        "validationStarted": False,
        "smokeStarted": False,
    }
    if (
        report["immutableFormalSourceValidatedFirst"] is not True
        or report["dedicatedModeInstalledAfterSourceValidation"] is not True
        or report["dispatchModeResolutionCount"] != 1
        or report["nestedValidatorModeId"] != "fact_conditioned_semantic_mixture_stage0_full_training"
        or report["nestedFormalContractCheckCount"] != 8
        or report["nestedFormalContractsValidatedAfterDispatch"] is not True
        or report["formalStage0ActionDenied"] is not True
        or report["datasetMaterialized"] is not False
        or report["cudaInitialized"] is not False
    ):
        raise ValueError("Trainer pre-model control-flow report is invalid")
    print(json.dumps(report, indent=2))
    return 0


def main() -> int:
    if "--object-reference-multiscale-contract-only" in sys.argv:
        return object_reference_multiscale_contract_only()

    if "--contract-only" in sys.argv:
        return contract_only()

    if "--object-reference-multiscale-derived-config-contract-only" in sys.argv:
        return object_reference_multiscale_derived_config_contract_only()

    if "--derived-config-contract-only" in sys.argv:
        return derived_config_contract_only()

    if "--lineage-contract-only" in sys.argv:
        return lineage_contract_only()

    if "--full-cli-contract-only" in sys.argv:
        return full_cli_contract_only()

    if "--trainer-pre-model-control-flow-contract-only" in sys.argv:
        return trainer_pre_model_control_flow_contract_only()

    script_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_root))
    import train_ai_assisted_conditional_denoiser as trainer

    def validate_current_phase0_cli(args, config, package):
        return validate_current_phase0_cli_contract(trainer, args, config, package)

    trainer.validate_stage4_validation_kernel_phase0_cli = validate_current_phase0_cli
    identity_index = sys.argv.index("--phase0-execution-identity") + 1
    identity = trainer.read_json(Path(sys.argv[identity_index]))
    if is_multiscale_identity(identity):
        install_phase0_object_reference_multiscale_validator(trainer)
    else:
        install_phase0_visible_structure_validator(trainer)
    install_phase0_mode_and_execution_grant(trainer, identity)
    return int(trainer.main())


if __name__ == "__main__":
    raise SystemExit(main())

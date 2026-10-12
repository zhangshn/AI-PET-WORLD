"""Managed-entry profile for the inactive V24 core-priority training candidate."""
from __future__ import annotations

from contextlib import ExitStack, contextmanager, nullcontext
from copy import deepcopy
import io
import json
import sys
from unittest.mock import patch

import torch

import painter_stage4_v21_object_core_fidelity_probe as object_core
import painter_stage4_v23_complete_support_partition_probe as v23
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import (
    train_object_core_fidelity_candidate_objective,
)
from ai_painter.complete_world.object_head_core_priority_update_v24 import (
    CANDIDATE_ID, EXPERIMENT_TYPE,
    commit_generator_step, compute_v24_generator_candidate_gradients,
    generator_full_fp32_backend,
)


core = object_core.core
ORIGINAL_AUTOCAST = torch.autocast
BASE_RUN = core.run
WORKER = "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"
TESTS = "ml/ai-painter/tests/test_stage4_v24_object_head_core_priority_probe.py"
HISTORICAL_CONTROLLER_TESTS = "scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"
CONTROLLER_TESTS = "scripts/tests/test-ai-painter-v24-critic-mode-controller.mjs"
CONTROLLER = "scripts/run-ai-painter-learning-capacity-experiment.mjs"
HISTORICAL_POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v1.json"
HISTORICAL_IEEE_POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v2.json"
HISTORICAL_CRITIC_MODE_POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v3.json"
HISTORICAL_CHECKER_BOUND_POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v4.json"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v5.json"
POLICY_SCHEMA = "stage4-mvp-v24-object-head-core-priority-policy-v5"
SCOPE = "object_head_core_priority_resource_bound_critic_mode_v5_train_only_no_generalization_or_causal_claim"
V5_RESOURCES = {**core.RESOURCES, "maxWallSeconds": 2700}
UPDATE = "ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py"
UPDATE_TEST = "ml/ai-painter/tests/test_object_head_core_priority_update_v24.py"
CPU_REFERENCE = "ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py"
CPU_REFERENCE_TEST = "ml/ai-painter/tests/test_object_head_core_priority_update_v24_cpu.py"
CPU_REFERENCE_RESULT = ".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/result.json"
CPU_REFERENCE_ACCEPTANCE = ".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/controller-acceptance.json"
FROZEN_SPEC_125 = ".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/frozen-formal-spec-1.25.md"
FROZEN_SPEC_124 = (".runtime/ai-painter/learning-capacity-experiments/"
    "v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/"
    "frozen-formal-spec-1.24.md")
CURRENT_SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"
FROZEN_SPEC_127 = ".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/frozen-formal-spec-1.27.md"
NUMERIC_TASK = ".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/task.json"
NUMERIC_RESULT = ".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/result.json"
NUMERIC_REPAIR = ".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/repair-result.json"
NUMERIC_ACCEPTANCE = ".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/controller-acceptance.json"
OLD_INTEGRATION_EVIDENCE = ".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/result.json"
OLD_INTEGRATION_ACCEPTANCE = ".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/controller-acceptance.json"
FROZEN_SPEC_128 = ".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/frozen-formal-spec-1.28.md"
INTEGRATION_ROOT = ".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu"
INTEGRATION_DIAGNOSTIC = INTEGRATION_ROOT + "/diagnose-v24-critic-mode-integration-cpu.py"
INTEGRATION_DIAGNOSTIC_TEST = INTEGRATION_ROOT + "/test-diagnose-v24-critic-mode-integration-cpu.py"
INTEGRATION_EVIDENCE = INTEGRATION_ROOT + "/result.json"
INTEGRATION_ACCEPTANCE = INTEGRATION_ROOT + "/controller-acceptance.json"
FROZEN_SPEC_129 = INTEGRATION_ROOT + "/frozen-formal-spec-1.29.md"
FROZEN_CONTROLLER_129 = INTEGRATION_ROOT + "/frozen-controller-1.29.mjs"
FROZEN_CONTROLLER_TESTS_129 = INTEGRATION_ROOT + "/frozen-controller-tests-1.29.mjs"
FROZEN_PROFILE_129 = INTEGRATION_ROOT + "/frozen-profile-1.29.py"
FROZEN_PROFILE_TESTS_129 = INTEGRATION_ROOT + "/frozen-profile-tests-1.29.py"
CHECKER_PROGRAM = INTEGRATION_ROOT + "/rebind-v24-checker-evidence.py"
CHECKER_TESTS = INTEGRATION_ROOT + "/test-rebind-v24-checker-evidence.py"
CHECKER_RESULT = INTEGRATION_ROOT + "/checker-binding-result.json"
CHECKER_ACCEPTANCE = INTEGRATION_ROOT + "/checker-binding-acceptance.json"
RESOURCE_ROOT = ".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu"
FROZEN_SPEC_130 = RESOURCE_ROOT + "/frozen-formal-spec-1.30.md"
FROZEN_CONTROLLER_130 = RESOURCE_ROOT + "/frozen-controller-1.30.mjs"
FROZEN_CONTROLLER_TESTS_130 = RESOURCE_ROOT + "/frozen-controller-tests-1.30.mjs"
FROZEN_PROFILE_130 = RESOURCE_ROOT + "/frozen-profile-1.30.py"
FROZEN_PROFILE_TESTS_130 = RESOURCE_ROOT + "/frozen-profile-tests-1.30.py"
FROZEN_EXPOSURE_WORKER_130 = RESOURCE_ROOT + "/frozen-exposure-worker-1.30.py"
RESOURCE_CHECKER_PROGRAM = RESOURCE_ROOT + "/rebind-v24-resource-evidence.py"
RESOURCE_CHECKER_TESTS = RESOURCE_ROOT + "/test-rebind-v24-resource-evidence.py"
RESOURCE_CHECKER_RESULT = RESOURCE_ROOT + "/resource-binding-result.json"
RESOURCE_CHECKER_ACCEPTANCE = RESOURCE_ROOT + "/resource-binding-acceptance.json"
EXPOSURE_WORKER = "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"
V23_RUN = (".runtime/ai-painter/learning-capacity-experiments/"
    "v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6")


def historical_v23_representation_plan():
    plan = v23.representation_plan()
    plan["formalSpecification"] = {
        "path": CURRENT_SPEC,
        "sha256": "2940cb51701ad75dc180ca7c73f1497b096f3abefe1b6e6f5b6706ac6c4c559b",
        "version": "AI-PAINTER-SPEC-1.24", "section": "9.6.8"}
    plan["formalSpecificationSnapshot"] = {**core.bind(FROZEN_SPEC_124),
        "version": "AI-PAINTER-SPEC-1.24", "historicalEvidenceOnly": True}
    return plan


def precision_plan():
    return {"generatorForward": "explicit_ieee_fp32_matmul_and_convolution_no_autocast",
        "generatorObjective": "explicit_ieee_fp32_matmul_and_convolution_frozen_critic_no_autocast",
        "actualTotalGradient": "explicit_ieee_fp32_complete_model_independent_autograd_grad",
        "auxiliaryGradients": "explicit_ieee_fp32_actual_four_heads_only_three_autograd_grad_calls",
        "generatorPrecisionContext": "current_fp32_precision_api_scoped_and_restored_on_success_or_failure",
        "projection": "cpu_float64_fixed_v24_reference_then_fp32_return",
        "discriminatorUpdate": "inherited_cuda_bfloat16_autocast_original_objective_and_order",
        "observation": "native_fp32_no_autocast",
        "oldStudyPrecisionDiffers": True, "singleFactorCausalClaimAllowed": False}


def critic_state_plan():
    return {
        "pairEntryCapture": {
            "submoduleTrainingFlags": "all_critic_modules_exact",
            "parameterRequiresGradFlags": "all_critic_parameters_exact"},
        "discriminatorPhase": {
            "mode": "critic_train_all_submodules",
            "parameters": "all_requires_grad_true",
            "precision": "inherited_cuda_bfloat16_autocast_original_objective_and_order"},
        "generatorPhase": {
            "mode": "critic_eval_all_submodules",
            "parameters": "all_requires_grad_false",
            "scope": ["generator_forward", "frozen_critic_objective",
                      "four_autograd_grad_calls", "generator_commit"],
            "criticParametersBuffersGradients": "unchanged_from_post_discriminator_zero_grad"},
        "restoration": {
            "normal": True,
            "discriminatorObjectiveFailure": True,
            "discriminatorResourceFailure": True,
            "discriminatorCommitFailure": True,
            "generatorObjectiveFailure": True,
            "generatorResourceFailure": True,
            "generatorGradientFailure": True,
            "generatorCommitFailure": True,
            "completedOptimizerStepsPreserved": True,
            "completedOptimizerStepsNotRolledBack": True}}


def update_plan():
    return {"candidateId": CANDIDATE_ID, "experimentType": EXPERIMENT_TYPE,
        "program": core.bind(UPDATE), "tests": core.bind(UPDATE_TEST),
        "cpuReference": core.bind(CPU_REFERENCE), "cpuReferenceTests": core.bind(CPU_REFERENCE_TEST),
        "cpuReferenceEvidence": core.bind(CPU_REFERENCE_RESULT),
        "cpuReferenceAcceptance": core.bind(CPU_REFERENCE_ACCEPTANCE),
        "cpuReferenceFormalSpecification": {**core.bind(FROZEN_SPEC_125),
            "version": "AI-PAINTER-SPEC-1.25", "section": "9.6.9"},
        "numericDiagnosisTask": core.bind(NUMERIC_TASK),
        "numericDiagnosisEvidence": core.bind(NUMERIC_RESULT),
        "numericRepairEvidence": core.bind(NUMERIC_REPAIR),
        "numericControllerAcceptance": core.bind(NUMERIC_ACCEPTANCE),
        "numericFormalSpecificationSnapshot": {**core.bind(FROZEN_SPEC_127),
            "version": "AI-PAINTER-SPEC-1.27", "section": "9.6.11"},
        "currentFormalSpecification": {**core.bind(CURRENT_SPEC),
            "version": "AI-PAINTER-SPEC-1.31", "section": "9.6.15"},
        "formula": "per_actual_object_rgb_head_remove_only_negative_other_component",
        "actualTotalIndependentFullModelGradient": True,
        "auxiliaryGradientsActualHeadParametersOnly": True,
        "objectHeadParameterTensorCount": 16, "objectHeadParameterElementCount": 4876,
        "nonHeadParameterTensorCount": 90, "lossAndCoefficientsChanged": False,
        "historicalCheckpointLoaded": False, "qualificationGranted": False}


def quality_comparison_plan(inputs):
    selection = inputs.get("trainSelectionSha256")
    if selection is None:
        baseline_package = json.loads(core.cpu.project_file(core.ROOT, V23_RUN + "/package.json")
                                      .read_bytes())
        selection = baseline_package["inputs"]["trainSelectionSha256"]
    return {"baselineRunId": V23_RUN.rsplit("/", 1)[1],
        "baselineResult": core.bind(V23_RUN + "/result.json"),
        "baselineEndpointCpuReview": core.bind(V23_RUN + "/controller-endpoint-cpu-review.json"),
        "baselineQualityReview": core.bind(V23_RUN + "/controller-quality-review.json"),
        "trainSelectionSha256": selection, "selectedRowCount": 48,
        "measurementPrecision": "cpu_fp32",
        "requiredStrictMeanDecreases": ["fullRgbMae", "object_footprintsCoreRgbMae",
            "object_treeCoreRgbMae", "object_rockCoreRgbMae", "object_vegetationCoreRgbMae"],
        "improvementOffsetAllowed": False, "semanticReadabilityRequiredForQualification": True,
        "missingTrustedSemanticCriterionResult": "unverified_not_qualified",
        "singleFactorCausalClaimAllowed": False}


def integration_plan():
    return {"controller": core.bind(CONTROLLER),
        "worker": core.bind(WORKER), "workerTests": core.bind(TESTS),
        "exposureWorker": core.bind(EXPOSURE_WORKER),
        "controllerTests": core.bind(CONTROLLER_TESTS),
        "historicalControllerTests": core.bind(HISTORICAL_CONTROLLER_TESTS),
        "diagnosticProgram": core.bind(INTEGRATION_DIAGNOSTIC),
        "diagnosticTests": core.bind(INTEGRATION_DIAGNOSTIC_TEST),
        "originalEvidence": core.bind(INTEGRATION_EVIDENCE),
        "originalControllerAcceptance": core.bind(INTEGRATION_ACCEPTANCE),
        "predecessorCheckerResult": core.bind(CHECKER_RESULT),
        "predecessorCheckerControllerAcceptance": core.bind(CHECKER_ACCEPTANCE),
        "checkerProgram": core.bind(RESOURCE_CHECKER_PROGRAM),
        "checkerTests": core.bind(RESOURCE_CHECKER_TESTS),
        "checkerResult": core.bind(RESOURCE_CHECKER_RESULT),
        "checkerControllerAcceptance": core.bind(RESOURCE_CHECKER_ACCEPTANCE),
        "frozenSourceSnapshots": {
            "formalSpecification": core.bind(FROZEN_SPEC_130),
            "controller": core.bind(FROZEN_CONTROLLER_130),
            "controllerTests": core.bind(FROZEN_CONTROLLER_TESTS_130),
            "worker": core.bind(FROZEN_PROFILE_130),
            "workerTests": core.bind(FROZEN_PROFILE_TESTS_130),
            "exposureWorker": core.bind(FROZEN_EXPOSURE_WORKER_130)},
        "formalSpecification": {**core.bind(CURRENT_SPEC),
            "version": "AI-PAINTER-SPEC-1.31", "section": "9.6.15"},
        "historicalFormalSpecificationSnapshot": {**core.bind(FROZEN_SPEC_130),
            "version": "AI-PAINTER-SPEC-1.30", "section": "9.6.14",
            "historicalEvidenceOnly": True},
        "predecessorFormalSpecificationSnapshot": {**core.bind(FROZEN_SPEC_128),
            "version": "AI-PAINTER-SPEC-1.28", "section": "9.6.12",
            "historicalEvidenceOnly": True},
        "criticStatePlan": critic_state_plan(),
        "resourceRevisionPlan": {"predecessorMaxWallSeconds": 1800,
            "maxWallSeconds": 2700, "onlyChangedResourceField": "maxWallSeconds",
            "predecessorRunStatus": "experiment_failed_closed",
            "predecessorFailureCode": "ValueError('free VRAM below floor')",
            "predecessorOptimizerSteps": {"generator": 1945, "discriminator": 1946},
            "oldWeightsReusable": False},
        "gpuQualified": False, "trainingAllowed": False}


def validate_numeric_repair_evidence(reader, plan):
    diagnosis = reader.json(plan["numericDiagnosisEvidence"])
    repair = reader.json(plan["numericRepairEvidence"])
    acceptance = reader.json(plan["numericControllerAcceptance"])
    core.require(diagnosis.get("status")
        == "gpu_numeric_diagnosis_completed_not_training_or_gpu_qualified"
        and diagnosis.get("conclusion")
        == "default_mismatch_explicit_ieee_fp32_passed_supports_backend_context_fix"
        and diagnosis.get("sourceFixSupported") is True
        and diagnosis.get("callCounts") == {"generatorForwardsAttempted": 2,
            "generatorForwardsCompleted": 2, "autogradGradCallsAttempted": 8,
            "autogradGradCallsCompleted": 8}
        and diagnosis.get("boundary", {}).get("optimizerSteps") == 0,
        "V24 numeric diagnosis evidence differs")
    core.require(repair.get("status")
        == "evidence_supported_explicit_ieee_fp32_context_fix_cpu_regression_passed_not_gpu_or_training_qualified"
        and repair.get("diagnosis") == plan["numericDiagnosisEvidence"]
        and repair.get("boundary", {}).get("additionalGpuRuns") == 0
        and repair.get("boundary", {}).get("trainingStarted") is False,
        "V24 numeric repair evidence differs")
    core.require(acceptance.get("status")
        == "bounded_gpu_numeric_diagnosis_and_source_fix_independently_verified_not_training_entry_integrated"
        and acceptance.get("sourceResult") == plan["numericDiagnosisEvidence"]
        and acceptance.get("sourceTask") == plan["numericDiagnosisTask"]
        and acceptance.get("sourceRepairResult") == plan["numericRepairEvidence"]
        and acceptance.get("decision", {}).get("sourceFixAccepted") is True
        and acceptance.get("decision", {}).get("trainingEntryIntegrated") is False
        and acceptance.get("decision", {}).get("gpuQualified") is False,
        "V24 numeric controller acceptance differs")


def validate_reference_evidence(reader, plan):
    evidence = reader.json(plan["cpuReferenceEvidence"])
    acceptance = reader.json(plan["cpuReferenceAcceptance"])
    core.require(evidence.get("status")
        == "cpu_candidate_formula_and_real_zero_update_comparison_completed_not_training_qualified"
        and evidence.get("candidateId") == "stage4_mvp_v24_object_head_core_priority_update_cpu_candidate_v1"
        and evidence.get("design", {}).get("actualGeneratorForwards") == 4
        and evidence.get("design", {}).get("actualAutogradGradCalls") == 16
        and evidence.get("boundary", {}).get("optimizerCreated") is False
        and evidence.get("boundary", {}).get("trainingStarted") is False,
        "V24 CPU reference evidence differs")
    core.require(acceptance.get("status")
        == "inactive_cpu_candidate_independently_reviewed_not_training_qualified"
        and acceptance.get("candidateId")
        == "stage4_mvp_v24_object_head_core_priority_update_cpu_candidate_v1"
        and {key: acceptance.get("evidence", {}).get(key) for key in ("path", "sha256")}
            == plan["cpuReferenceEvidence"]
        and acceptance.get("boundaries", {}).get("gpuTrainingStarted") is False
        and acceptance.get("boundaries", {}).get("realModelOptimizerSteps") == 0
        and acceptance.get("boundaries", {}).get("trainingUpdateIntegrationImplemented") is False
        and acceptance.get("boundaries", {}).get("currentCandidateGpuQualified") is False,
        "V24 CPU reference acceptance differs")


def validate_integration_evidence(reader, plan, inputs=None):
    evidence = reader.json(plan["originalEvidence"])
    acceptance = reader.json(plan["originalControllerAcceptance"])
    historical_hashes = {
        CONTROLLER: "5017c2a606475966761b25bc7725a52a9be0cf8667981f22a58fab6240d25506",
        WORKER: "4834ad78600e9cad2669f6707c9bdb2c46fd71d22f02dd269f01366f3cef08a4",
        TESTS: "644d011fac53ebd350b5fe8a714f88f8ff3372b09e708d5f1550f5efc5e8fc7b",
        CONTROLLER_TESTS: "72b59b4c2570df3548dadab111d7a445da8bce5af660fba1dfd451756e3edbb8"}
    historical_paths = (CONTROLLER, WORKER, TESTS, CONTROLLER_TESTS,
        HISTORICAL_CONTROLLER_TESTS, UPDATE, UPDATE_TEST,
        INTEGRATION_DIAGNOSTIC, INTEGRATION_DIAGNOSTIC_TEST)
    expected_programs = [{"path": path, "sha256": historical_hashes[path]}
        if path in historical_hashes else core.bind(path) for path in historical_paths]
    historical_update = update_plan()
    historical_update["currentFormalSpecification"] = {"path": CURRENT_SPEC,
        "sha256": "19c61f721f82de0f76dbc350f736459389a8ef43da3d4c0e5fbc17cb5d633bfd",
        "version": "AI-PAINTER-SPEC-1.29", "section": "9.6.13"}
    expected_plans = {"modelPlan": v23.model_plan(), "precisionExecutionPlan": precision_plan(),
        "updatePlan": historical_update, "criticStatePlan": critic_state_plan(),
        "currentFormalSpecification": {
            "path": CURRENT_SPEC,
            "sha256": "19c61f721f82de0f76dbc350f736459389a8ef43da3d4c0e5fbc17cb5d633bfd",
            "version": "AI-PAINTER-SPEC-1.29", "section": "9.6.13"},
        "predecessorFormalSpecificationSnapshot": {
            **core.bind(FROZEN_SPEC_128), "version": "AI-PAINTER-SPEC-1.28",
            "section": "9.6.12", "historicalEvidenceOnly": True}}
    data_identity = evidence.get("dataIdentity", {})
    core.require(evidence.get("status")
        == "v24_critic_mode_integration_cpu_completed_not_gpu_or_training_qualified"
        and evidence.get("candidateId") == CANDIDATE_ID
        and evidence.get("design", {}).get("actualGeneratorForwards") == 2
        and evidence.get("design", {}).get("actualAutogradGradCalls") == 4
        and evidence.get("design", {}).get("actualDiscriminatorBackwardCalls") == 1
        and evidence.get("design", {}).get("actualOptimizerSteps")
            == {"generator": 1, "discriminator": 1}
        and evidence.get("boundary", {}).get("gpuStarted") is False
        and evidence.get("boundary", {}).get("optimizerCreated") is True
        and evidence.get("boundary", {}).get("checkpointRead") is False
        and evidence.get("boundary", {}).get("checkpointWritten") is False
        and evidence.get("boundary", {}).get("holdoutRead") is False
        and evidence.get("boundary", {}).get("registryWritten") is False
        and evidence.get("criticStateEvidence", {}).get("generatorPhaseCriticUnchanged") is True
        and evidence.get("criticStateEvidence", {}).get("entryFlagsRestored") is True
        and evidence.get("programBindings") == expected_programs
        and evidence.get("plans") == expected_plans
        and data_identity.get("selectedRowCount") == 48
        and data_identity.get("trainOrdinals") == [30]
        and isinstance(data_identity.get("trainSelectionSha256"), str),
        "V24 integration CPU evidence differs")
    if inputs is not None:
        expected_samples = [{key: inputs["selectedRows"][ordinal][key] for key in
                             ("sampleId", "split", "trainOrdinal", "image", "conditionPack")}
                            for ordinal in (30,)]
        actual_samples = [{key: row[key] for key in
                           ("sampleId", "split", "trainOrdinal", "image", "conditionPack")}
                          for row in data_identity.get("sampleInputs", [])]
        core.require(data_identity.get("datasetManifest") == inputs.get("datasetManifest")
            and data_identity.get("sourceIndex") == inputs.get("sourceIndex")
            and data_identity.get("trainSplit") == inputs.get("trainSplit")
            and data_identity.get("conditionContract") == inputs.get("conditionContract")
            and data_identity.get("trainSelectionSha256") == inputs.get("trainSelectionSha256")
            and actual_samples == expected_samples,
            "V24 integration evidence data identity differs from current inputs")
    core.require(acceptance.get("status")
        == "v24_critic_mode_integration_cpu_independently_verified_not_gpu_or_training_qualified"
        and acceptance.get("candidateId") == CANDIDATE_ID
        and acceptance.get("sourceResult") == plan["originalEvidence"]
        and acceptance.get("verifiedProgramBindings") == expected_programs
        and acceptance.get("verifiedPlans") == expected_plans
        and acceptance.get("verifiedDataIdentity") == data_identity
        and acceptance.get("qualification") == {"gpu": False, "training": False,
            "visual": False, "stage4Advanced": False},
        "V24 integration controller acceptance differs")
    predecessor_checker = reader.json(plan["predecessorCheckerResult"])
    predecessor_acceptance = reader.json(plan["predecessorCheckerControllerAcceptance"])
    core.require(predecessor_checker.get("status")
        == "v24_checker_binding_recomputed_no_model_execution"
        and predecessor_checker.get("candidateId") == CANDIDATE_ID
        and predecessor_checker.get("actualExecutionCounts", {}).get("trainingRuns") == 0
        and predecessor_acceptance.get("status")
        == "v24_checker_binding_independently_verified_not_gpu_or_training_qualified"
        and predecessor_acceptance.get("sourceResult") == plan["predecessorCheckerResult"]
        and predecessor_acceptance.get("qualification") == {"gpu": False, "training": False,
            "visual": False, "stage4Advanced": False},
        "V24 predecessor checker chain differs")
    checker = reader.json(plan["checkerResult"])
    checker_acceptance = reader.json(plan["checkerControllerAcceptance"])
    current_bindings = [core.bind(path) for path in
        (CONTROLLER, WORKER, TESTS, CONTROLLER_TESTS, EXPOSURE_WORKER,
         RESOURCE_CHECKER_PROGRAM, RESOURCE_CHECKER_TESTS, CURRENT_SPEC)]
    resource_revision = plan["resourceRevisionPlan"]
    core.require(checker.get("schemaVersion") == "ai-painter-v24-resource-binding-result-v1"
        and checker.get("status") == "v24_resource_binding_recomputed_no_model_execution"
        and checker.get("candidateId") == CANDIDATE_ID
        and checker.get("currentProgramBindings") == current_bindings
        and checker.get("historicalSnapshots") == plan["frozenSourceSnapshots"]
        and checker.get("predecessorCheckerResult") == plan["predecessorCheckerResult"]
        and checker.get("predecessorCheckerAcceptance")
            == plan["predecessorCheckerControllerAcceptance"]
        and checker.get("resourceRevisionPlan") == resource_revision
        and checker.get("protectedFacts") == {
            "trainingAlgorithmAstIdentical": True,
            "updateSourceSha256":
                "b8c0e84732d4911a667c41c27bf927b65bff4ae1a78f7a5644e599c193dacab0",
            "changedExposureWorkerChecks": 3}
        and checker.get("actualExecutionCounts") == {"modelForwards": 0,
            "autogradGradCalls": 0, "backwardCalls": 0, "optimizerSteps": 0,
            "decodes": 0, "gpuQueries": 0, "checkpointReads": 0,
            "checkpointWrites": 0, "pngWrites": 0, "trainingRuns": 0}
        and checker.get("boundary") == {"modelImported": False, "modelExecuted": False,
            "gpuQueried": False, "trainingStarted": False, "registryWritten": False,
            "policyWritten": False, "packagePrepared": False},
        "V24 resource binding evidence differs")
    core.require(checker_acceptance.get("schemaVersion")
        == "ai-painter-v24-resource-binding-controller-acceptance-v1"
        and checker_acceptance.get("status")
        == "v24_resource_binding_independently_verified_not_gpu_or_training_qualified"
        and checker_acceptance.get("candidateId") == CANDIDATE_ID
        and checker_acceptance.get("sourceResult") == plan["checkerResult"]
        and checker_acceptance.get("verifiedCurrentProgramBindings") == current_bindings
        and checker_acceptance.get("verifiedHistoricalSnapshots") == plan["frozenSourceSnapshots"]
        and checker_acceptance.get("verifiedResourceRevisionPlan") == resource_revision
        and checker_acceptance.get("qualification") == {"gpu": False, "training": False,
            "visual": False, "stage4Advanced": False},
        "V24 resource binding controller acceptance differs")


def collect_inputs(registry=None):
    context = object_core.collect_inputs(registry)
    reader, inputs = context["reader"], context["inputs"]
    representation = historical_v23_representation_plan()
    v23.validate_cpu_acceptance(reader.json(representation["cpuEvidence"]),
                                reader.json(representation["controllerAcceptance"]), representation)
    for binding in (representation["program"], representation["tests"],
                    representation["cpuEvidence"], representation["controllerAcceptance"],
                    representation["formalSpecificationSnapshot"]):
        reader.read(binding)
    update = update_plan(); validate_reference_evidence(reader, update)
    validate_numeric_repair_evidence(reader, update)
    integration = integration_plan(); validate_integration_evidence(reader, integration, inputs)
    for binding in (update["program"], update["tests"], update["cpuReference"],
                    update["cpuReferenceTests"], update["cpuReferenceFormalSpecification"],
                    update["numericDiagnosisTask"], update["numericDiagnosisEvidence"],
                    update["numericRepairEvidence"], update["numericControllerAcceptance"],
                    update["numericFormalSpecificationSnapshot"],
                    update["currentFormalSpecification"], integration["controller"], integration["worker"],
                    integration["workerTests"], integration["controllerTests"],
                    integration["historicalControllerTests"], integration["diagnosticProgram"],
                    integration["diagnosticTests"], integration["originalEvidence"],
                    integration["originalControllerAcceptance"],
                    integration["predecessorCheckerResult"],
                    integration["predecessorCheckerControllerAcceptance"],
                    integration["exposureWorker"], integration["checkerProgram"],
                    integration["checkerTests"], integration["checkerResult"],
                    integration["checkerControllerAcceptance"],
                    integration["formalSpecification"],
                    integration["historicalFormalSpecificationSnapshot"],
                    integration["predecessorFormalSpecificationSnapshot"]):
        reader.read(binding)
    for binding in integration["frozenSourceSnapshots"].values():
        reader.read(binding)
    inputs["modelPlan"] = v23.model_plan()
    inputs["representationPlan"] = representation
    inputs["sourcePlan"] = v23.source_plan(inputs)
    inputs["dataPlan"] = v23.data_plan(inputs)
    inputs["precisionExecutionPlan"] = precision_plan()
    inputs["updatePlan"] = update
    inputs["criticStatePlan"] = critic_state_plan()
    inputs["integrationPlan"] = integration
    inputs["qualityComparisonPlan"] = quality_comparison_plan(inputs)
    for binding in inputs["qualityComparisonPlan"].values():
        if isinstance(binding, dict) and set(binding) >= {"path", "sha256"}:
            reader.read(binding)
    inputs["inputReceipts"] = [{"path": path, "sha256": digest}
        for path, digest in sorted(reader.observed.items())]
    reader.unchanged()
    return context


def validate_policy(policy, inputs):
    object_core.validate_policy(policy, inputs)
    core.require(inputs.get("modelPlan") == v23.model_plan()
        and inputs.get("representationPlan") == historical_v23_representation_plan()
        and inputs.get("sourcePlan") == v23.source_plan(inputs)
        and inputs.get("dataPlan") == v23.data_plan(inputs)
        and inputs.get("precisionExecutionPlan") == precision_plan()
        and inputs.get("updatePlan") == update_plan()
        and inputs.get("criticStatePlan") == critic_state_plan()
        and inputs.get("integrationPlan") == integration_plan()
        and inputs.get("qualityComparisonPlan") == quality_comparison_plan(inputs),
        "V24 frozen plans differ")


def package_from_inputs(inputs, policy_binding, manifest):
    package = object_core.package_from_inputs(inputs, policy_binding, manifest)
    identity = package["experimentIdentity"].replace(
        "v21-object-core-fidelity-", "v24-resource-bound-core-priority-", 1)
    package.update(experimentIdentity=identity, experimentType=EXPERIMENT_TYPE,
                   outputRoot=core.OUTPUT_PARENT + "/" + identity)
    for key in ("modelPlan", "representationPlan", "sourcePlan", "dataPlan",
                "precisionExecutionPlan", "updatePlan", "integrationPlan",
                "criticStatePlan", "qualityComparisonPlan"):
        package["config"][key] = inputs[key]
    return package


def observation_evidence(*args):
    return {**object_core.observation_evidence(*args),
        "modelPlan": v23.model_plan(), "representationPlan": historical_v23_representation_plan(),
        "precisionExecutionPlan": precision_plan(), "updatePlan": update_plan(),
        "criticStatePlan": critic_state_plan(),
        "integrationPlan": integration_plan(),
        "qualityComparisonPlan": quality_comparison_plan({})}


def validate_result_contract(result, package):
    for key, expected in (("modelPlan", v23.model_plan()),
                          ("representationPlan", historical_v23_representation_plan()),
                          ("precisionExecutionPlan", precision_plan()),
                          ("updatePlan", update_plan()),
                          ("criticStatePlan", critic_state_plan()),
                          ("integrationPlan", integration_plan())):
        core.require(result.get(key) == package["inputs"].get(key)
                     == package["config"].get(key) == expected,
                     "V24 result " + key + " differs")
    core.require(package["inputs"].get("qualityComparisonPlan")
        == package["config"].get("qualityComparisonPlan")
        == quality_comparison_plan(package["inputs"]), "V24 quality comparison plan differs")
    object_core.validate_result_contract(result, package)


def fresh_networks(order, acceptance=None):
    return v23.fresh_networks(order, acceptance)


def generator_candidate_for_sample(model, critic, sample, order, forward, kind):
    """Keep the generator forward, frozen-critic objective and four grads together."""
    with generator_full_fp32_backend():
        prediction = forward(kind, sample)
        total, parts = train_object_core_fidelity_candidate_objective(
            critic, prediction, sample, sample["objectInstanceTable"], order)
        candidate, facts = compute_v24_generator_candidate_gradients(
            model=model, critic=critic, sample=sample, actual_total=total,
            structured_objective=parts["v21UnchangedTotal"],
            whole_frame_fidelity=parts["wholeFrameFidelity"],
            object_core_rgb=parts["objectCoreRgbWeighted"])
    return prediction, total, parts, candidate, facts


def _critic_mode_snapshot(critic):
    return {
        "modules": tuple((module, bool(module.training)) for module in critic.modules()),
        "parameters": tuple((parameter, bool(parameter.requires_grad))
                            for parameter in critic.parameters())}


def _restore_critic_mode_snapshot(snapshot):
    for module, training in snapshot["modules"]:
        module.training = training
    for parameter, requires_grad in snapshot["parameters"]:
        parameter.requires_grad_(requires_grad)


def _require_critic_phase(critic, *, training, trainable):
    modules = tuple(critic.modules())
    parameters = tuple(critic.parameters())
    core.require(modules and all(module.training is training for module in modules),
                 "critic submodule training mode boundary differs")
    core.require(parameters and all(parameter.requires_grad is trainable
                                    for parameter in parameters),
                 "critic requires_grad boundary differs")


def _critic_gradient_snapshot(critic):
    return tuple(None if parameter.grad is None else core.cpu.tensor_hash(parameter.grad)
                 for parameter in critic.parameters())


def _critic_tensor_versions(critic):
    return tuple((name, int(value._version))
                 for name, value in tuple(critic.named_parameters())
                 + tuple(critic.named_buffers()))


def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
                 counts, ledger_row, resource, forward, after_update=lambda name, loss: None):
    from ai_painter.complete_world.native_rgb_structured_object_objective_cpu_v17 import (
        train_structured_object_objective,
    )
    core.require(sample["split"] == "train" and sample["sampleId"] == ledger_row["sampleId"],
                 "update source differs")
    device = next(model.parameters()).device
    bound = {**sample, "conditions": sample["conditions"].detach().to(device),
             "image": sample["image"].detach().to(device)}

    def discriminator_update():
        before = counts["discriminator"]
        try:
            core.v21.update_network(critic_optimizer, d_loss, critic, bound, "discriminator",
                                    counts, 2304, resource)
        finally:
            ledger_row["discriminator"] += counts["discriminator"] - before
            after_update("discriminator", float(d_loss.detach()))

    entry = _critic_mode_snapshot(critic)
    try:
        generator_optimizer.zero_grad(set_to_none=True)
        critic.train().requires_grad_(True)
        _require_critic_phase(critic, training=True, trainable=True)
        with torch.no_grad(), (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                               if device.type == "cuda" else nullcontext()):
            detached = forward("training", bound)
        with (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
              if device.type == "cuda" else nullcontext()):
            d_loss, _ = core.gpu.detached_discriminator_objective(critic, detached, bound)
        discriminator_update()
        core.require(all(parameter.grad is None for parameter in model.parameters()),
                     "discriminator leaked generator gradient")
        critic_optimizer.zero_grad(set_to_none=True)

        critic.eval().requires_grad_(False)
        _require_critic_phase(critic, training=False, trainable=False)
        critic_before_generator = core.cpu.state_hash(critic)
        critic_gradients_before_generator = _critic_gradient_snapshot(critic)
        critic_versions_before_generator = _critic_tensor_versions(critic)
        core.require(all(value is None for value in critic_gradients_before_generator),
                     "generator phase requires cleared critic gradients")
        try:
            prediction, g_loss, parts, candidate, facts = generator_candidate_for_sample(
                model, critic, bound, order, forward, "training")
            before = counts["generator"]
            try:
                commit_generator_step(optimizer=generator_optimizer, model=model,
                    candidate_gradients=candidate, sample=bound, counts=counts, limit=2304,
                    check_resource=resource, gradient_validator=core.gpu.gradient_facts)
            finally:
                ledger_row["generator"] += counts["generator"] - before
                after_update("generator", float(g_loss.detach()))
        finally:
            core.require(core.cpu.state_hash(critic) == critic_before_generator
                and _critic_gradient_snapshot(critic) == critic_gradients_before_generator
                and _critic_tensor_versions(critic) == critic_versions_before_generator,
                "generator phase changed critic parameters, buffers, or gradients")
        core.require(all(parameter.grad is None for parameter in critic.parameters()),
                     "generator leaked frozen critic gradient")
        branches = {key: value["branch"] for key, value in facts["headDiagnostics"].items()}
        return {"generatorLoss": float(g_loss.detach()),
                "discriminatorLoss": float(d_loss.detach()),
                "corePriorityConflictHeadCount": sum(value == "conflict_projected"
                                                      for value in branches.values()),
                "corePriorityHeadBranches": branches,
                "criticStatePlan": critic_state_plan(),
                "criticGeneratorPhaseUnchanged": True}
    finally:
        _restore_critic_mode_snapshot(entry)
        core.require(all(module.training is training for module, training in entry["modules"])
            and all(parameter.requires_grad is requires_grad
                    for parameter, requires_grad in entry["parameters"]),
            "critic entry mode/trainability restoration failed")


def _zero_update_probe(model, critic, sample, order, resource, forward):
    import random
    import numpy as np
    before = {name: core.cpu.state_hash(network) for name, network in (("Model", model), ("Critic", critic))}
    input_hashes = {key: core.cpu.tensor_hash(sample[key].detach().cpu())
                    for key in ("image", "conditions")}
    rng_before = {"torch": torch.get_rng_state().clone(), "python": random.getstate(),
                  "numpy": np.random.get_state()}
    enabled = [(value, value.requires_grad) for network in (model, critic)
               for value in network.parameters()]
    core.require(all(value.grad is None for value, _ in enabled), "probe requires clean gradients")
    with core.preserve_rng_and_modes(model, critic), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("probe optimizer prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("probe checkpoint load prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("probe checkpoint write prohibited")):
        try:
            model.eval(); critic.eval().requires_grad_(False)
            _require_critic_phase(critic, training=False, trainable=False)
            prediction, total, parts, candidate, facts = generator_candidate_for_sample(
                model, critic, sample, order, forward, "probe")
            core.require(all(bool(torch.isfinite(value).all()) for value in candidate),
                         "nonfinite generator probe candidate")
            gradient_facts = facts["generatorGradientFacts"]
            core.require(gradient_facts["nonzeroTensorCount"] > 0
                and gradient_facts["nonzeroElementCount"] > 0
                and all(value > 0 for value in gradient_facts["headCandidateL2"].values())
                and not facts["unusedGradientIndexes"]["actualTotal"]
                and facts["nonHeadActualTotalIdentityPreserved"] is True
                and facts["nonConflictHeadActualTotalBytesPreserved"] is True,
                "generator probe gradient reachability/preservation failed")
            core.require(all(value.grad is None for value in critic.parameters()),
                         "generator probe leaked frozen critic gradients")
            resource()
            critic.train().requires_grad_(True)
            _require_critic_phase(critic, training=True, trainable=True)
            with torch.no_grad(), (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                                   if next(model.parameters()).is_cuda else nullcontext()):
                detached = forward("probe", sample)
            with (ORIGINAL_AUTOCAST("cuda", dtype=torch.bfloat16)
                  if next(model.parameters()).is_cuda else nullcontext()):
                d_loss, _ = core.gpu.detached_discriminator_objective(critic, detached, sample)
            critic_gradients = torch.autograd.grad(d_loss, tuple(critic.parameters()),
                                                   create_graph=False, allow_unused=True)
            critic_nonzero_tensors = sum(value is not None and bool(torch.count_nonzero(value))
                                         for value in critic_gradients)
            critic_nonzero_elements = sum(0 if value is None else int(torch.count_nonzero(value))
                                          for value in critic_gradients)
            core.require(all(value is not None and bool(torch.isfinite(value).all())
                             for value in critic_gradients)
                and critic_nonzero_tensors > 0 and critic_nonzero_elements > 0,
                "discriminator probe gradient reachability failed")
            core.require(all(value.grad is None for value in model.parameters()),
                         "discriminator probe leaked generator gradients")
            resource()
        finally:
            model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
            for value, flag in enabled:
                value.requires_grad_(flag)
            core.require(before == {name: core.cpu.state_hash(network)
                         for name, network in (("Model", model), ("Critic", critic))},
                         "V24 zero-update probe changed state")
    rng_after = {"torch": torch.get_rng_state(), "python": random.getstate(),
                 "numpy": np.random.get_state()}
    rng_restored = (torch.equal(rng_before["torch"], rng_after["torch"])
        and rng_before["python"] == rng_after["python"]
        and rng_before["numpy"][0] == rng_after["numpy"][0]
        and np.array_equal(rng_before["numpy"][1], rng_after["numpy"][1])
        and rng_before["numpy"][2:] == rng_after["numpy"][2:])
    source_unchanged = input_hashes == {key: core.cpu.tensor_hash(sample[key].detach().cpu())
                                       for key in ("image", "conditions")}
    core.require(rng_restored and source_unchanged, "probe RNG or input tensors not restored")
    return {"passed": True, "optimizerCreated": False,
        "optimizerSteps": {"generator": 0, "discriminator": 0},
        "initialStateSha256": before, "finalStateSha256": before,
        "candidateId": CANDIDATE_ID, "precisionExecutionPlan": precision_plan(),
        "criticStatePlan": critic_state_plan(),
        "generatorCandidate": facts,
        "discriminatorGradientFacts": {"tensorCount": len(critic_gradients),
            "nonzeroTensorCount": critic_nonzero_tensors,
            "nonzeroElementCount": critic_nonzero_elements, "allFinite": True},
        "criticFrozenDuringGenerator": True, "criticGradientLeakDuringGenerator": False,
        "generatorGradientLeakDuringDiscriminator": False,
        "targetAndConditionsDetached": True, "sourceTensorHashesBeforeAndAfter": input_hashes,
        "sourceTensorsUnchanged": source_unchanged, "rngRestored": rng_restored,
        "gradFieldsCleared": all(value.grad is None for value, _ in enabled),
        "objectiveId": object_core.CANDIDATE_ID,
        "objectiveTerms": {key: float(parts[key].detach()) for key in
            ("v21UnchangedTotal", "wholeFrameFidelity", "objectCoreRgbWeighted", "total")}}


def zero_update_probe(model, critic, sample, order, resource, forward):
    captured = []
    original = model.forward
    def instrumented(conditions, instance_table, *args, **kwargs):
        core.require(not args and not kwargs, "V24 probe forward contract differs")
        rgb, evidence = original(conditions, instance_table, return_evidence=True)
        captured.append(v23._ownership_facts(evidence))
        return rgb
    with patch.object(model, "forward", instrumented):
        result = _zero_update_probe(model, critic, sample, order, resource, forward)
    core.require(len(captured) == 2 and captured[0] == captured[1],
                 "V24 ownership evidence differs across probe forwards")
    return {**result, "capabilityVersion": v23.CAPABILITY,
        "architectureId": v23.ARCHITECTURE, "representationId": v23.OWNERSHIP_RULE,
        "ownershipFacts": captured[0],
        "conditionTensorSha256": core.cpu.tensor_hash(sample["conditions"].detach().cpu())}


def reload_final_cpu(payload_bytes, expected, order, package_binding, identity):
    saved = torch.load(io.BytesIO(payload_bytes), map_location="cpu", weights_only=True)
    core.require(saved.get("schemaVersion") == "ai-painter-learning-capacity-experiment-checkpoint-v1"
        and saved.get("experimentType") == EXPERIMENT_TYPE
        and saved.get("experimentIdentity") == identity
        and saved.get("executionPackage") == package_binding and saved.get("epoch") == 48
        and saved.get("optimizerSteps") == {"generator": 2304, "discriminator": 2304}
        and saved.get("finalStateSha256") == expected and saved.get("checkpointPromotable") is False
        and saved.get("automaticResumeAllowed") is False, "V24 final checkpoint metadata differs")
    with core.preserve_rng_and_modes():
        model, critic = fresh_networks(order)
        model.load_state_dict(saved["modelState"], strict=True)
        critic.load_state_dict(saved["criticState"], strict=True)
    core.require({"Model": core.cpu.state_hash(model), "Critic": core.cpu.state_hash(critic)} == expected,
                 "V24 final checkpoint state differs")
    return True


def freeze_policy():
    context = collect_inputs()
    policy = {"schemaVersion": POLICY_SCHEMA,
        "status": "active_single_bounded_train_only_exposure_experiment",
        "scope": SCOPE, "inputs": context["inputs"], "maxAttempts": 1, "automaticRetries": 0}
    validate_policy(policy, context["inputs"])
    target = core.cpu.project_file(core.ROOT, POLICY_PATH)
    if target.exists():
        core.require(json.loads(target.read_bytes()) == policy, "V24 policy already differs")
    else:
        core.v21.write_exclusive(target, policy)
    return core.bind(POLICY_PATH)


def run(*args, **kwargs):
    # The inherited run function uses torch.autocast only around observations;
    # V24 observations are native FP32.  D updates/probes call ORIGINAL_AUTOCAST
    # explicitly in the functions above.
    with patch.object(torch, "autocast", side_effect=lambda *a, **k: nullcontext()):
        return BASE_RUN(*args, **kwargs)


@contextmanager
def successor_profile():
    qualification = deepcopy(core.QUALIFICATION); qualification["scope"] = SCOPE
    paths = sorted(set(core.IMPLEMENTATION_PATHS + [WORKER, TESTS, CONTROLLER_TESTS,
        HISTORICAL_CONTROLLER_TESTS,
        UPDATE, UPDATE_TEST, CPU_REFERENCE, CPU_REFERENCE_TEST, CPU_REFERENCE_RESULT,
        CPU_REFERENCE_ACCEPTANCE, FROZEN_SPEC_125, FROZEN_SPEC_124, CURRENT_SPEC,
        FROZEN_SPEC_127, FROZEN_SPEC_128, FROZEN_SPEC_129, FROZEN_CONTROLLER_129,
        FROZEN_CONTROLLER_TESTS_129, FROZEN_PROFILE_129, FROZEN_PROFILE_TESTS_129,
        CHECKER_PROGRAM, CHECKER_TESTS, CHECKER_RESULT, CHECKER_ACCEPTANCE,
        FROZEN_SPEC_130, FROZEN_CONTROLLER_130, FROZEN_CONTROLLER_TESTS_130,
        FROZEN_PROFILE_130, FROZEN_PROFILE_TESTS_130, FROZEN_EXPOSURE_WORKER_130,
        RESOURCE_CHECKER_PROGRAM, RESOURCE_CHECKER_TESTS, RESOURCE_CHECKER_RESULT,
        RESOURCE_CHECKER_ACCEPTANCE, EXPOSURE_WORKER,
        NUMERIC_TASK, NUMERIC_RESULT, NUMERIC_REPAIR, NUMERIC_ACCEPTANCE,
        v23.RENDERER, v23.RENDERER_TEST, v23.CPU_EVIDENCE, v23.CONTROLLER_ACCEPTANCE,
        INTEGRATION_DIAGNOSTIC, INTEGRATION_DIAGNOSTIC_TEST,
        INTEGRATION_EVIDENCE, INTEGRATION_ACCEPTANCE]))
    changes = {"WORKER": WORKER, "TESTS": TESTS, "POLICY_PATH": POLICY_PATH,
        "POLICY_SCHEMA": POLICY_SCHEMA, "EXPERIMENT_TYPE": EXPERIMENT_TYPE, "SCOPE": SCOPE,
        "QUALIFICATION": qualification, "RESOURCES": V5_RESOURCES,
        "IMPLEMENTATION_PATHS": paths,
        "collect_inputs": collect_inputs, "validate_policy": validate_policy,
        "package_from_inputs": package_from_inputs, "observation_evidence": observation_evidence,
        "validate_result_contract": validate_result_contract, "fresh_networks": fresh_networks,
        "reload_final_cpu": reload_final_cpu, "zero_update_probe": zero_update_probe,
        "perform_pair": perform_pair, "run": run}
    with ExitStack() as stack:
        for name, value in changes.items():
            stack.enter_context(patch.object(core, name, value))
        yield core


if __name__ == "__main__":
    with successor_profile():
        if sys.argv[1:] == ["freeze-policy"]:
            print(json.dumps(freeze_policy()))
        else:
            core.main()

import assert from "node:assert/strict"

export const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-design-20260815-035000000"
export const AUTHORIZATION_SHA256 = "290a3a7fd1db568c8c34807c02bffc86926cc75752a9e466cc2582ad13f82399"
export const CONSUMPTION_SHA256 = "e33a7dbfa17c49380243e6a69aa1b0817a0c73836c51849a6688515c208a5e39"
export const AUTHORIZATION_SCOPE = "one_cpu_only_phase0_design_and_inactive_execution_contract_for_four_object_visible_structure_candidate"
export const PERMITTED_ACTIONS = Object.freeze([
  "design_one_bounded_phase0_contract_for_current_four_object_candidate",
  "define_fixed_sample_seed_resolution_and_reproducibility_gates",
  "define_cpu_positive_negative_contract_regressions",
  "write_inactive_phase0_contract_design_report_terminal_capsule_and_execution_owner_request",
  "synchronize_event_ledger_and_sqlite_index",
])
export const FORBIDDEN_ACTIONS = Object.freeze([
  "gpu",
  "cuda",
  "autograd",
  "checkpoint_read_or_load",
  "model_load",
  "optimizer",
  "backward",
  "weight_modification",
  "training",
  "validation",
  "smoke",
  "automatic_retry",
  "stage1",
  "stage2",
  "formal_inference",
  "checkpoint_promotion",
  "runtime_frame",
  "world_entry",
  "review_threshold_change",
])
export const OBJECT_CHANNELS = Object.freeze([
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
])
export const FIXED_IDENTITY = Object.freeze({
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "stage4_four_typed_object_visible_structure_supervision_v1",
  sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  sampleSplit: "validation",
  seed: 20263722,
  timestep: 999,
  resolution: { width: 256, height: 192 },
  requiredBoundarySides: ["west"],
  objectSemanticChannels: [...OBJECT_CHANNELS],
  diagnosticManifestMetricCount: 32,
  denoiserInitialization: "fixed_random_seed_20263722",
  autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
})

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export function validateAuthorizationAndConsumption({ authorization, consumption }) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-design-v1")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.equal(authorization.requestId, REQUEST_ID)
  assert.equal(authorization.commandRef, REQUEST_ID)
  assert.equal(authorization.scope, AUTHORIZATION_SCOPE)
  assert.equal(same(authorization.permittedActions, PERMITTED_ACTIONS), true, "permitted_actions_changed")
  assert.equal(same(authorization.forbiddenActions, FORBIDDEN_ACTIONS), true, "forbidden_actions_changed")
  assert.equal(authorization.execution.consumeBeforeFirstWrite, true)
  assert.equal(authorization.failurePolicy.stopImmediately, true)
  assert.equal(authorization.failurePolicy.automaticRetry, false)
  assert.equal(authorization.failurePolicy.preserveEvidence, true)
  assert.equal(authorization.failurePolicy.noGpuEscalation, true)

  assert.equal(consumption.schemaVersion, "ai-painter-stage4-object-visible-structure-phase0-design-consumption-v1")
  assert.equal(consumption.status, "stage4_object_visible_structure_phase0_design_authorization_atomically_consumed")
  assert.equal(consumption.requestId, REQUEST_ID)
  assert.equal(consumption.commandRef, REQUEST_ID)
  assert.equal(consumption.scope, AUTHORIZATION_SCOPE)
  assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
  assert.equal(consumption.oneTimeConsumption, true)
  assert.equal(consumption.firstAuthorizedWrite, true)
  for (const key of [
    "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded",
    "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted",
  ]) assert.equal(consumption[key], false, `${key}_must_be_false`)
  return true
}

export function validatePhase0DesignSource({ gpuTerminal, diagnosticReport, finalizationReport, finalizationTerminal }) {
  assert.equal(gpuTerminal.status, "stage4_four_object_visible_structure_gpu_qualification_passed_closed")
  assert.equal(diagnosticReport.status, "passed_readonly_stage4_four_object_visible_structure_gpu_gradient_qualification")
  assert.equal(same(diagnosticReport.identity, FIXED_IDENTITY), true, "fixed_identity_changed")
  assert.equal(diagnosticReport.diagnosticManifest.fieldCount, 32)
  assert.equal(diagnosticReport.diagnosticManifest.fields.length, 32)

  const gradients = diagnosticReport.gradientEvidence.fourObjectVisibleStructure
  for (const objectName of ["footprints", "tree", "rock", "vegetation", "combined"]) {
    assert.equal(gradients[objectName].finiteAndStrictlyNonzero, true, `${objectName}_gradient_not_qualified`)
    assert.ok(Number.isFinite(gradients[objectName].denoiserGradientNorm))
    assert.ok(gradients[objectName].denoiserGradientNorm > 0)
  }
  assert.equal(diagnosticReport.integrity.denoiserStateSha256Before, diagnosticReport.integrity.denoiserStateSha256After)
  assert.equal(diagnosticReport.integrity.autoencoderStateSha256Before, diagnosticReport.integrity.autoencoderStateSha256After)
  assert.equal(diagnosticReport.integrity.parameterGradFieldsAbsent, true)
  assert.equal(diagnosticReport.oldDenoiserCheckpointRead, false)
  assert.equal(diagnosticReport.optimizerCreated, false)
  assert.equal(diagnosticReport.backwardMethodExecuted, false)
  assert.equal(diagnosticReport.modelWeightsModified, false)
  assert.equal(diagnosticReport.checkpointWritten, false)
  assert.equal(diagnosticReport.trainingStarted, false)

  assert.equal(finalizationReport.status, "four_object_visible_structure_gpu_qualification_evidence_verified_and_index_ready")
  assert.equal(finalizationReport.qualification.status, "passed")
  assert.equal(same(finalizationReport.qualification.objectChannels, OBJECT_CHANNELS), true)
  assert.equal(finalizationReport.qualification.diagnosticManifestMetricCount, 32)
  assert.equal(finalizationReport.qualification.denoiserStateUnchanged, true)
  assert.equal(finalizationReport.qualification.autoencoderStateUnchanged, true)
  assert.equal(finalizationReport.qualification.parameterGradFieldsAbsent, true)
  assert.deepEqual(finalizationReport.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })

  assert.equal(finalizationTerminal.status, "four_object_visible_structure_gpu_qualification_formally_finalized_closed")
  assert.equal(finalizationTerminal.nextLegalAction, "owner_create_bound_cpu_only_phase0_design_authorization_or_exit")
  assert.deepEqual(finalizationTerminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.equal(finalizationTerminal.gpuUsedNow, false)
  assert.equal(finalizationTerminal.checkpointReadNow, false)
  assert.equal(finalizationTerminal.trainingStartedNow, false)
  return true
}

export function buildInactivePhase0Design(source) {
  validatePhase0DesignSource(source)
  return {
    schemaVersion: "stage4-object-visible-structure-phase0-design-v1",
    status: "bounded_phase0_engineering_qualification_design_completed_inactive",
    candidate: {
      architectureId: FIXED_IDENTITY.architectureId,
      trainingObjectiveContractId: FIXED_IDENTITY.trainingObjectiveContractId,
      objectSemanticChannels: [...OBJECT_CHANNELS],
      sourceGpuQualificationPassed: true,
    },
    fixedExecutionIdentity: structuredClone(FIXED_IDENTITY),
    purpose: "prove_one_weight_update_and_checkpoint_to_fixed_preview_reproduction_chain_before_any_smoke",
    executionSequence: [
      "cpu_authorization_binding_and_entry_contract_preflight",
      "atomic_owner_authorization_consumption_before_first_evidence_write",
      "one_gpu_forward_four_object_and_combined_gradient_gate",
      "exactly_one_backward_and_optimizer_step",
      "write_one_non_promotable_diagnostic_checkpoint",
      "reload_diagnostic_checkpoint_in_two_fresh_processes",
      "compare_model_condition_rgb_and_png_byte_identities",
      "write_terminal_capsule_ledger_and_sqlite_index_then_stop",
    ],
    updateGates: {
      exactOptimizerSteps: 1,
      gradientsFiniteAndStrictlyNonzeroBeforeStep: true,
      denoiserStateMustChangeAfterStep: true,
      autoencoderMustRemainFrozenAndUnchanged: true,
      parameterGradientsMustBeClearedBeforeFinalization: true,
      oldFailedDenoiserCheckpointReadForbidden: true,
      sourceConfigurationMutationForbidden: true,
    },
    reproducibilityGates: {
      freshProcessCount: 2,
      diagnosticCheckpointModelStateSha256ExactMatch: true,
      normalizedConditionTensorSha256ExactMatch: true,
      decodedRgbTensorSha256ExactMatch: true,
      pngBytesSha256ExactMatch: true,
      pngDynamicMetadataForbidden: true,
      sameFixedSampleSeedTimestepResolutionAndWestBoundaryRequired: true,
    },
    evidenceRequirements: {
      immutableAuthorizationAndConsumption: true,
      cpuPositiveAndNegativeContractReport: true,
      pythonAndCudaResourcePreflightBeforeConsumption: true,
      stepTelemetry: true,
      diagnosticCheckpointIdentityOnlyAfterWrite: true,
      twoFreshProcessReports: true,
      successOrFailureTerminal: true,
      localTaskCapsuleEventLedgerAndSqliteIndex: true,
    },
    qualificationBoundary: {
      phase0EngineeringQualificationOnly: true,
      visualQualityQualificationPerformed: false,
      reviewThresholdsRemainUnchanged: true,
      smokeAuthorized: false,
      formalStage0Authorized: false,
      stage1Authorized: false,
      stage2Authorized: false,
      checkpointPromotionAuthorized: false,
      automaticRetryAuthorized: false,
    },
    currentExecution: {
      contractActive: false,
      gpuUsed: false,
      cudaInitialized: false,
      autogradExecuted: false,
      checkpointReadOrWritten: false,
      modelLoaded: false,
      optimizerCreated: false,
      backwardExecuted: false,
      weightModified: false,
      trainingStarted: false,
      validationStarted: false,
      smokeStarted: false,
    },
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "owner_authorize_cpu_only_phase0_execution_entry_implementation_or_exit",
  }
}

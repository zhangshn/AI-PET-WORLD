import assert from "node:assert/strict"

export const IMPLEMENTATION_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000"
export const IMPLEMENTATION_AUTHORIZATION_SHA256 = "eb0af89a1d613b88131c629cb74ffddf1b4d368edc963c337aa3326703c4ad07"
export const IMPLEMENTATION_CONSUMPTION_SHA256 = "5fa86c0879152213f45931f450865a0b1ab66a24d3ec5a535407b3441be5c2b9"
export const GPU_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-064500000"
export const GPU_EXECUTION_ID = "20260815-064500000"
export const GPU_REQUEST_PREFIX = "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-"
export const RETIRED_GPU_REQUEST_IDS = Object.freeze([
  "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-050000000",
  "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-054500000",
])
export const GPU_SCOPE = "one_four_object_visible_structure_phase0_gpu_single_update_and_dual_process_reproduction_only"
export const FIXED_TASK_IDENTITY = Object.freeze({
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "stage4_four_typed_object_visible_structure_supervision_v1",
  sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  sampleSplit: "validation",
  seed: 20263722,
  timestep: 999,
  resolution: { width: 256, height: 192 },
  requiredBoundarySides: ["west"],
  objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
  diagnosticManifestMetricCount: 32,
  denoiserInitialization: "fixed_random_seed_20263722",
  autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
})
export const GPU_ACTIONS = Object.freeze({
  cpuContractAndBindingPreflight: true,
  cudaResourcePreflightBeforeConsumption: true,
  atomicAuthorizationConsumptionBeforeFirstEvidenceWrite: true,
  deriveActivePhase0ConfigWithoutMutatingSource: true,
  projectAutoencoderCheckpointReadAndLoadFrozen: true,
  fixedRandomDenoiserInitialization: true,
  singleSample194ValidationRead: true,
  exactlyOneOptimizerCreation: true,
  exactlyOneBackwardAndOptimizerStep: true,
  boundedDenoiserWeightModification: true,
  nonPromotableDiagnosticCheckpointWrite: true,
  diagnosticCheckpointReloadInTwoFreshProcesses: true,
  modelConditionRgbAndPngByteIdentityComparison: true,
  terminalCapsuleEventLedgerSqliteSync: true,
  failedDenoiserCheckpointReadOrLoad: false,
  moreThanOneOptimizerStep: false,
  modelSmoke: false,
  formalStage0Training: false,
  stage1OrStage2: false,
  validation: false,
  formalInference: false,
  checkpointPromotion: false,
  runtimeFrame: false,
  worldEntry: false,
  reviewThresholdChange: false,
  automaticRetry: false,
})
export const REQUIRED_GPU_BINDINGS = Object.freeze([
  "implementationAuthorization",
  "implementationConsumption",
  "implementationReport",
  "implementationAttestation",
  "implementationTerminal",
  "phase0DesignReport",
  "inactivePhase0ExecutionContract",
  "phase0Runner",
  "phase0PythonEntry",
  "phase0CpuChecker",
  "phase0SharedLibrary",
  "sourceConfig",
  "inactiveConfigFragment",
  "datasetManifest",
  "datasetSourceIndex",
  "projectAutoencoderCheckpoint",
  "model",
  "trainer",
  "readonlyGpuTerminal",
  "readonlyGpuFinalizationReport",
])

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export const OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS = Object.freeze([
  ...["Route", "Footprints", "Tree", "Rock", "Vegetation"].flatMap((prefix) => [
    `stage4SemanticMixture${prefix}ParticipationBce`,
    `stage4SemanticMixture${prefix}ContributionAbsMean`,
    `stage4SemanticMixture${prefix}GatedContributionAbsMean`,
    `stage4SemanticMixture${prefix}CounterfactualRgbMae`,
    `stage4SemanticMixture${prefix}FinalTypedRgbMae`,
  ]),
  "stage4SemanticMixtureFinalResponseMae",
  "stage4SemanticMixtureTypedIdentityCount",
  "stage4SemanticMixtureVegetationFinalTypedEdgeMae",
  ...["Footprints", "Tree", "Rock", "Vegetation"].map(
    (prefix) => `stage4SemanticMixture${prefix}FinalTypedLuminanceCorrelationLoss`,
  ),
])

export function compilePhase0DerivedConfig(sourceConfig, inactiveFragment) {
  const effectiveConfig = structuredClone(sourceConfig)
  const training = effectiveConfig.training
  assert.ok(training && typeof training === "object", "source_training_contract_missing")
  assert.ok(inactiveFragment?.trainingPatch?.stage4ObjectVisibleStructureSupervision, "object_visible_structure_fragment_missing")
  delete training.stage4VegetationLuminanceSpatialStructureSupervision
  training.stage4ObjectVisibleStructureSupervision = structuredClone(
    inactiveFragment.trainingPatch.stage4ObjectVisibleStructureSupervision,
  )
  const contract = training.stage4ObjectVisibleStructureSupervision
  contract.status = "training_loss_active_owner_authorized"
  const active = new Set([
    "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
    "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow",
  ])
  for (const key of Object.keys(contract.activationGate)) contract.activationGate[key] = active.has(key)

  const registry = training.stage4FactConditionedSemanticMixture?.diagnosticManifestRegistry
  assert.ok(registry && typeof registry === "object", "semantic_mixture_diagnostic_registry_missing")
  registry.exactFields = [...OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS]
  registry.exactFieldCount = OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS.length
  assert.equal(registry.exactFieldCount, 32, "object_visible_structure_diagnostic_field_count_changed")
  validatePhase0DerivedConfig(effectiveConfig, sourceConfig)
  return effectiveConfig
}

export function validatePhase0DerivedConfig(effectiveConfig, sourceConfig) {
  const training = effectiveConfig?.training ?? {}
  const registry = training.stage4FactConditionedSemanticMixture?.diagnosticManifestRegistry ?? {}
  assert.equal(training.stage4VegetationLuminanceSpatialStructureSupervision, undefined, "replaced_single_object_contract_retained")
  assert.equal(training.stage4ObjectVisibleStructureSupervision?.status, "training_loss_active_owner_authorized")
  assert.deepEqual(registry.exactFields, [...OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS], "derived_diagnostic_exact_fields_changed")
  assert.equal(registry.exactFieldCount, OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS.length, "derived_diagnostic_exact_count_changed")
  assert.deepEqual(
    training.stage4FailureDiagnostics?.semanticMixtureDiagnostics?.manifestFields,
    sourceConfig?.training?.stage4FailureDiagnostics?.semanticMixtureDiagnostics?.manifestFields,
    "diagnostic_support_manifest_fields_must_remain_base_contract",
  )
  return true
}

export function validateImplementationSource({ authorization, consumption, designReport, inactiveContract, designTerminal }) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-execution-entry-implementation-v1")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.equal(authorization.requestId, IMPLEMENTATION_REQUEST_ID)
  assert.equal(authorization.commandRef, IMPLEMENTATION_REQUEST_ID)
  assert.equal(authorization.scope, "one_cpu_only_implementation_of_inactive_four_object_phase0_execution_entry_and_contract_regression")
  assert.equal(consumption.status, "stage4_object_visible_structure_phase0_execution_entry_implementation_authorization_atomically_consumed")
  assert.equal(consumption.authorizationSha256, IMPLEMENTATION_AUTHORIZATION_SHA256)
  assert.equal(consumption.requestId, IMPLEMENTATION_REQUEST_ID)
  assert.equal(consumption.commandRef, IMPLEMENTATION_REQUEST_ID)
  assert.equal(consumption.oneTimeConsumption, true)
  for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) assert.equal(consumption[key], false, `${key}_must_be_false`)
  assert.equal(designReport.status, "bounded_phase0_engineering_qualification_design_completed_inactive")
  assert.equal(same(designReport.fixedExecutionIdentity, FIXED_TASK_IDENTITY), true, "fixed_task_identity_changed")
  assert.equal(designReport.updateGates.exactOptimizerSteps, 1)
  assert.equal(designReport.reproducibilityGates.freshProcessCount, 2)
  assert.equal(designReport.qualificationBoundary.visualQualityQualificationPerformed, false)
  assert.equal(designReport.qualificationBoundary.smokeAuthorized, false)
  assert.equal(Object.values(designReport.currentExecution).every((value) => value === false), true)
  assert.equal(inactiveContract.status, "inactive_separate_entry_implementation_and_gpu_authorizations_required")
  assert.equal(inactiveContract.activation.activeNow, false)
  assert.equal(inactiveContract.activation.gpuAuthorizedNow, false)
  assert.equal(designTerminal.status, "stage4_object_visible_structure_phase0_design_completed_inactive_closed")
  assert.deepEqual(designTerminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  return true
}

export function validateGpuAuthorizationDocument(authorization) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-gpu-execution-v1")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.match(authorization.requestId, /^owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-\d{8}-\d{9}$/)
  assert.equal(authorization.commandRef, authorization.requestId)
  assert.equal(RETIRED_GPU_REQUEST_IDS.includes(authorization.requestId), false, "retired_gpu_request_identity_rejected")
  assert.equal(authorization.scope, GPU_SCOPE)
  assert.equal(same(authorization.taskIdentity, FIXED_TASK_IDENTITY), true, "gpu_task_identity_changed")
  assert.equal(same(authorization.executionActions, GPU_ACTIONS), true, "gpu_execution_actions_changed")
  assert.deepEqual(Object.keys(authorization.bindings), REQUIRED_GPU_BINDINGS, "gpu_binding_set_changed")
  for (const binding of Object.values(authorization.bindings)) {
    assert.equal(typeof binding.path, "string")
    assert.match(binding.sha256, /^[a-f0-9]{64}$/)
  }
  assert.equal(authorization.execution.maximumExecutions, 1)
  assert.equal(authorization.execution.consumeBeforeFirstEvidenceWrite, true)
  const executionId = authorization.requestId.slice(GPU_REQUEST_PREFIX.length)
  assert.equal(authorization.execution.runId, `${executionId}-phase0`)
  assert.equal(authorization.execution.consumptionPath, `.runtime/ai-painter/owner-action-requests/${authorization.requestId}/consumption.json`)
  assert.equal(authorization.execution.outputDirectory, `.runtime/ai-painter/stage4-object-visible-structure-phase0-executions/${executionId}`)
  assert.equal(authorization.failurePolicy.stopImmediately, true)
  assert.equal(authorization.failurePolicy.automaticRetry, false)
  assert.equal(authorization.failurePolicy.preserveEvidence, true)
  assert.equal(authorization.failurePolicy.noSmokeOrTrainingEscalation, true)
  return true
}

export function buildGpuAuthorizationFixture(bindings) {
  return {
    schemaVersion: "ai-painter-owner-stage4-object-visible-structure-phase0-gpu-execution-v1",
    status: "owner_authorized_unconsumed",
    requestId: GPU_REQUEST_ID,
    commandRef: GPU_REQUEST_ID,
    scope: GPU_SCOPE,
    taskIdentity: structuredClone(FIXED_TASK_IDENTITY),
    executionActions: structuredClone(GPU_ACTIONS),
    bindings,
    execution: {
      consumptionPath: `.runtime/ai-painter/owner-action-requests/${GPU_REQUEST_ID}/consumption.json`,
      outputDirectory: `.runtime/ai-painter/stage4-object-visible-structure-phase0-executions/${GPU_EXECUTION_ID}`,
      runId: `${GPU_EXECUTION_ID}-phase0`,
      maximumExecutions: 1,
      consumeBeforeFirstEvidenceWrite: true,
    },
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noSmokeOrTrainingEscalation: true },
  }
}

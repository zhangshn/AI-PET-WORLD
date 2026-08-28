import assert from "node:assert/strict"

import {
  adjudicateStagedSuccessorStructureUniqueDerivationReview,
  buildStagedSuccessorReviewFixtures,
  deriveStagedSuccessorStructureCandidateAudit,
  STAGED_SUCCESSOR_REVIEW_DECISIONS,
} from "./lib/ai-painter-stage4-staged-successor-unique-derivation-review-v1.mjs"

const clone = (value) => JSON.parse(JSON.stringify(value))
const positives = []
const negatives = []

const fixtures = buildStagedSuccessorReviewFixtures()
assert.equal(
  adjudicateStagedSuccessorStructureUniqueDerivationReview(fixtures.currentEvidence),
  STAGED_SUCCESSOR_REVIEW_DECISIONS.PAUSE,
)
positives.push("current_bound_evidence_pauses_without_inventing_a_successor")
assert.equal(fixtures.currentEvidence.currentRegistryEvidence.activeExecution, null)
positives.push("current_registry_has_no_active_successor_execution")
assert.equal(
  fixtures.currentEvidence.componentFamilyContract.designBoundary
    .sharedTrainableSubstrateAllowed,
  false,
)
positives.push("previous_shared_substrate_alternative_remains_evidence_rejected")
const derivedAudit = deriveStagedSuccessorStructureCandidateAudit(fixtures.currentEvidence)
assert.equal(derivedAudit.candidateEnumeration.derivationStatus, "no_derivable_candidate")
assert.equal(derivedAudit.candidateEnumeration.viableCandidateCount, 0)
assert.deepEqual(derivedAudit.candidateEnumeration.unresolvedAxes, [
  "conditionInjectionPerPhase",
  "finalRgbSemanticPreservationMechanism",
])
positives.push("candidate_count_and_unresolved_axes_are_program_derived")

for (const [name, mutate] of [
  ["rejects_fixed40_failure_count_change", (value) => { value.fixed40Evidence.failureCounts[3] = 1 }],
  ["rejects_terminal_regression_fact_rewrite", (value) => { value.fixed40Evidence.noTerminalRegression = true }],
  ["rejects_epoch40_required_west_issue_omission", (value) => { value.fixed40Evidence.epoch40IssueCodes.shift() }],
  ["rejects_epoch40_rock_issue_omission", (value) => { value.fixed40Evidence.epoch40IssueCodes.pop() }],
  ["rejects_three_component_decision_substitution", (value) => { value.retiredThreeComponentEvidence.selectedCause = "B" }],
  ["rejects_three_component_route_reactivation", (value) => { value.retiredThreeComponentEvidence.candidateRouteExited = false }],
  ["rejects_formal_stage_omission", (value) => { value.formalStagedInterface.phases.pop() }],
  ["rejects_formal_stage_reorder", (value) => { value.formalStagedInterface.phases.reverse() }],
  ["rejects_formal_condition_channel_change", (value) => { value.formalStagedInterface.commonExecutionIdentity.conditionChannelCount = 24 }],
  ["rejects_registry_revision_change", (value) => { value.currentRegistryEvidence.registryRevision = 39 }],
  ["rejects_registry_sequence_change", (value) => { value.currentRegistryEvidence.eventSequence = 39 }],
  ["rejects_registry_capability_change", (value) => { value.currentRegistryEvidence.capabilityVersion = "replacement" }],
  ["rejects_registry_run_change", (value) => { value.currentRegistryEvidence.runId = "replacement" }],
  ["rejects_registry_task_change", (value) => { value.currentRegistryEvidence.taskId = "replacement" }],
  ["rejects_registry_lifecycle_reactivation", (value) => { value.currentRegistryEvidence.lifecycleStage = "qualified" }],
  ["rejects_registry_execution_state_change", (value) => { value.currentRegistryEvidence.executionState = "completed" }],
  ["rejects_registry_activity_change", (value) => { value.currentRegistryEvidence.activity = "running" }],
  ["rejects_registry_active_execution", (value) => { value.currentRegistryEvidence.activeExecution = {} }],
  ["rejects_unverified_successor_candidate_injection", (value) => { value.currentRegistryEvidence.successorStructureCandidate = { structureIdentity: "forged" } }],
  ["rejects_unverified_successor_contract_injection", (value) => { value.currentRegistryEvidence.successorStructureContract = { sha256: "0".repeat(64) } }],
  ["rejects_component_family_decision_change", (value) => { value.componentFamilyDecision.selectedDecision = "replacement" }],
  ["rejects_shared_substrate_rejection_loss", (value) => { value.componentFamilyDecision.alternativesRejected.bounded_shared_substrate_with_phase_isolated_outputs_supported = "none" }],
  ["rejects_shared_substrate_reactivation", (value) => { value.componentFamilyContract.designBoundary.sharedTrainableSubstrateAllowed = true }],
  ["rejects_component_parameter_sharing", (value) => { value.componentFamilyContract.components[0].parameterNamespaceIsolated = false }],
  ["rejects_component_topology_change", (value) => { value.componentFamilyContract.components[0].structureDerivation.topology = "replacement" }],
  ["rejects_free_model_name", (value) => { value.parameterSourceAudit.freeModelNameChosen = true }],
  ["rejects_free_width", (value) => { value.parameterSourceAudit.freeWidthChosen = true }],
  ["rejects_free_layer_count", (value) => { value.parameterSourceAudit.freeLayerCountChosen = true }],
  ["rejects_free_loss", (value) => { value.parameterSourceAudit.freeLossChosen = true }],
  ["rejects_free_loss_weight", (value) => { value.parameterSourceAudit.freeLossWeightChosen = true }],
  ["rejects_free_hyperparameter", (value) => { value.parameterSourceAudit.freeHyperparameterChosen = true }],
  ["rejects_parameter_source_omission", (value) => { value.parameterSourceAudit.sources.pop() }],
]) {
  const value = clone(fixtures.currentEvidence)
  mutate(value)
  assert.throws(
    () => adjudicateStagedSuccessorStructureUniqueDerivationReview(value),
    name,
  )
  negatives.push(name)
}

const report = {
  schemaVersion:
    "stage4-staged-generation-responsibility-successor-structure-unique-derivation-review-cpu-report-v1",
  status: "passed",
  currentEvidenceDecision: STAGED_SUCCESSOR_REVIEW_DECISIONS.PAUSE,
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  executionBoundary: {
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelModified: false,
    lossModified: false,
    dataModified: false,
    reviewThresholdsModified: false,
    trainingStarted: false,
  },
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

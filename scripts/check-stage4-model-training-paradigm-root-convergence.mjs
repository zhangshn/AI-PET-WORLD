import assert from "node:assert/strict"
import { DECISION_D, adjudicateModelTrainingRootConvergence } from "./lib/ai-painter-stage4-model-training-paradigm-root-convergence.mjs"

function fixture() {
  return {
    original64: { contractSatisfied: true, dataDefectProven: false },
    ownerSelection: "retain_original_64_and_authorize_new_model_or_training_paradigm_design",
    history: ["v8", "v9", "structure_fact_first", "semantic_renderer", "semantic_mixture"].map((id) => ({ id, failedVisualQualification: true, materialMechanismChanged: true })),
    smoke: { singleSampleQualified: true, fixedPreviewReproduced: true },
    stage0: { epochs: 40, optimizerSteps: 5760, sampleCount: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, weightsChanged: true, machineReviewPassCount: 0, failedObjectClasses: ["footprints", "tree", "rock", "vegetation"], objectivesActiveAndImproving: true },
    model: { conditionChannels: 23, typedContributionsReachFinalVelocity: true, finalRgbPassesFrozenAutoencoder: true, latentChannels: 12, latentDownsampleFactor: 4 },
    training: { rolloutSteps: 50, gradientTailSteps: 5, stage0CompletedWithoutResourceFailure: true },
    discriminatingEvidence: { architectureCapacityControlledComparison: false, trainingParadigmControlledComparison: false, autoencoderSemanticRetentionAuditAcross64: false, stage1OrStage2ResourceEvidence: false },
  }
}

const positive = []
const negative = []
const pass = (name, fn) => { fn(); positive.push({ name, passed: true }) }
const reject = (name, mutate, pattern) => {
  const value = structuredClone(fixture())
  mutate(value)
  assert.throws(() => adjudicateModelTrainingRootConvergence(value), pattern)
  negative.push({ name, passed: true })
}

pass("selects_evidence_insufficient_owner_decision", () => assert.equal(adjudicateModelTrainingRootConvergence(fixture()).selectedDecision, DECISION_D))
pass("retains_original_64", () => assert.equal(adjudicateModelTrainingRootConvergence(fixture()).provenFacts.original64ProductRetained, true))
pass("distinguishes_single_sample_expression_from_multisample_generalization", () => {
  const value = adjudicateModelTrainingRootConvergence(fixture()).provenFacts
  assert.equal(value.singleSampleExpressivityProven, true)
  assert.equal(value.multiSampleStage0GeneralizationFailed, true)
})
pass("requires_ordered_discriminating_evidence", () => assert.equal(adjudicateModelTrainingRootConvergence(fixture()).nextEvidenceDependencyOrder.length, 3))

reject("rejects_reintroduced_data_defect", (v) => { v.original64.dataDefectProven = true }, /data_defect/)
reject("rejects_wrong_owner_selection", (v) => { v.ownerSelection = "other" }, /owner_selection/)
reject("rejects_missing_historical_route", (v) => { v.history.pop() }, /five_exited/)
reject("rejects_unbound_historical_failure", (v) => { v.history[0].failedVisualQualification = false }, /historical_failure/)
reject("rejects_missing_single_sample_qualification", (v) => { v.smoke.singleSampleQualified = false }, /single_sample/)
reject("rejects_changed_epoch_count", (v) => { v.stage0.epochs = 39 }, /epoch_count/)
reject("rejects_changed_optimizer_steps", (v) => { v.stage0.optimizerSteps = 5759 }, /optimizer_step/)
reject("rejects_changed_split", (v) => { v.stage0.splitCounts.validation = 7 }, /split/)
reject("rejects_changed_visual_result", (v) => { v.stage0.machineReviewPassCount = 1 }, /visual_result/)
reject("rejects_missing_objective_evidence", (v) => { v.stage0.objectivesActiveAndImproving = false }, /objective_evidence/)
reject("rejects_condition_channel_change", (v) => { v.model.conditionChannels = 22 }, /condition_channel/)
reject("rejects_missing_final_velocity_path", (v) => { v.model.typedContributionsReachFinalVelocity = false }, /condition_to_velocity/)
reject("rejects_autoencoder_boundary_change", (v) => { v.model.finalRgbPassesFrozenAutoencoder = false }, /autoencoder_boundary/)
reject("rejects_rollout_change", (v) => { v.training.rolloutSteps = 49 }, /rollout_step/)
reject("rejects_invented_architecture_control", (v) => { v.discriminatingEvidence.architectureCapacityControlledComparison = true }, /unexpected_architecture/)
reject("rejects_invented_training_control", (v) => { v.discriminatingEvidence.trainingParadigmControlledComparison = true }, /unexpected_training/)
reject("rejects_invented_autoencoder_audit", (v) => { v.discriminatingEvidence.autoencoderSemanticRetentionAuditAcross64 = true }, /unexpected_autoencoder/)

console.log(JSON.stringify({
  schemaVersion: "stage4-model-training-paradigm-root-convergence-cpu-report-v1",
  status: "passed",
  selectedDecision: DECISION_D,
  positive: { passed: positive.length, total: positive.length, cases: positive },
  negative: { passed: negative.length, total: negative.length, cases: negative },
  dataModified: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))

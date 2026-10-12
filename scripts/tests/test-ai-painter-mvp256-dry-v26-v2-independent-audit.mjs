import assert from "node:assert/strict"
import test from "node:test"
import { validateV26Review } from "../run-ai-painter-mvp256-dry-v26-v2-independent-audit.mjs"

function fixture() {
  const binding = name => ({ path: `evidence/${name}`, sha256: "a".repeat(64) })
  const identity = { capabilityVersion: "stage4_mvp256_dry_object_local_context_isolation_v26_v2",
    runId: "v26-v2-run", packageId: "v26-v2-package" }
  const subject = { sampleId: "slot-189", worldId: "world", regionId: "region",
    tick: 0, factHash: "fact", conditionPack: binding("conditions") }
  const parent = { frozenBindings: { numericReview: binding("numeric"), detailReview: binding("detail") } }
  const ids = Array.from({ length: 8 }, (_, i) => `sample-${i}`)
  const report = { ...identity, schemaVersion: "ai-painter-mvp256-dry-v26-v2-cpu-review-v1",
    status: "cpu_comparison_completed_visual_review_pending", selectedCheckpoint: binding("checkpoint"),
    selectedEpoch: 24, candidateContract: binding("policy"), sourceDataCandidate: binding("parent"),
    trainingTerminal: binding("terminal"), workerTerminal: binding("worker"),
    executionPackage: binding("execution"), subject: { ...subject, split: "validation" },
    optimizerSteps: 0, gpuStarted: false, weightsModified: false, challengeContentRead: false,
    regressionContentRead: false, formalStage4QualificationGranted: false, runtimePublicationGranted: false,
    validationSampleIds: ids, measurements: Object.fromEntries(["v24", "v26"].map(label =>
      [label, { rows: ids.map(sampleId => ({ sampleId })) }])) }
  const execution = { ...identity, candidateContract: report.candidateContract,
    sourceDataCandidate: report.sourceDataCandidate, execution: { reviewPlan: {
      boundedDryReviewAllowed: true, formalStage4QualificationAllowed: false, runtimePublicationAllowed: false,
      numericThresholdContract: parent.frozenBindings.numericReview,
      detailThresholdContract: parent.frozenBindings.detailReview } } }
  const terminal = { ...identity, status: "training_completed_review_pending",
    workerTerminal: report.workerTerminal, executionPackage: report.executionPackage }
  const worker = { ...identity, status: terminal.status, completedEpochs: 48,
    optimizerStepsGenerator: 2304, optimizerStepsDiscriminator: 2304, checkpointReloadVerified: true,
    selectedCheckpoint: report.selectedCheckpoint, selectedEpoch: report.selectedEpoch }
  return { report, execution, terminal, worker, parent,
    registry: { activeExecution: null, latestTrainingTerminal: { runId: identity.runId, ...report.trainingTerminal } },
    policy: { executionVersion: "context_isolation_deterministic_aggregation_v2", predecessorCandidate: report.sourceDataCandidate },
    scope: { preselectedSubject: subject } }
}

test("V26 bounded review keeps its own identity and the same V24 thresholds", () => {
  assert.equal(validateV26Review(fixture()), true)
})
test("active execution, incomplete result, alternate image identity and changed thresholds rejected", () => {
  for (const mutate of [
    value => { value.registry.activeExecution = {} },
    value => { value.worker.completedEpochs = 47 },
    value => { value.worker.optimizerStepsDiscriminator = 2303 },
    value => { value.report.selectedCheckpoint = { path: "other", sha256: "b".repeat(64) } },
    value => { value.report.subject.factHash = "other" },
    value => { value.report.subject.split = "train" },
    value => { value.report.challengeContentRead = true },
    value => { value.report.measurements.v26.rows.pop() },
    value => { value.execution.execution.reviewPlan.numericThresholdContract = {} },
    value => { value.policy.executionVersion = "unknown" },
    value => { value.report.formalStage4QualificationGranted = true },
  ]) {
    const value = fixture()
    mutate(value)
    assert.throws(() => validateV26Review(value))
  }
})

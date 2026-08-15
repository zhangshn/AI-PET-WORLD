import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { adjudicateSustainedLateStability, validateSustainedLateStabilityEvidence } from "./lib/ai-painter-stage4-sustained-late-stability-qualification.mjs"

const root = process.cwd()
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}
const smokeRoot = path.resolve(root, argument("--smoke-root", ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-071500000"))
const finalizationDir = argument("--finalization-dir", "finalization-continuation-20260815-065500000")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const input = {
  terminal: read(path.join(smokeRoot, finalizationDir, "phase-terminal.json")),
  finalization: read(path.join(smokeRoot, finalizationDir, "finalization-report.json")),
  manifest: read(path.join(smokeRoot, "training-output", "manifest.json")),
  review: read(path.join(smokeRoot, "training-output", "fixed-preview-reviews.json")),
}
const passes = (fn) => { try { fn(); return true } catch { return false } }
const rejects = (mutate) => {
  const candidate = structuredClone(input)
  mutate(candidate)
  return !passes(() => adjudicateSustainedLateStability(candidate)) || adjudicateSustainedLateStability(candidate).qualified === false
}
const decision = adjudicateSustainedLateStability(input)
const positive = {
  boundEvidenceValid: passes(() => validateSustainedLateStabilityEvidence(input)),
  epochs10To30AllPass: decision.rowPasses.every(Boolean),
  threeConsecutiveLatePasses: decision.consecutiveLatePassCount === 3,
  terminalEpochPasses: decision.finalEpochPassed,
  previewBytesReproduced: decision.previewBytesReproduced,
  modelStateReproduced: decision.modelStateIdentityReproduced,
  weightsChanged: decision.weightsChanged,
  thresholdsUnchanged: decision.machineReviewThresholdsChanged === false,
  sourceEvidenceUnmodified: decision.sourceEvidenceModified === false,
  qualificationPassed: decision.qualified,
}
const negative = {
  missingEpochRejected: rejects((v) => { v.review.reviews = v.review.reviews.filter((r) => r.epoch !== 20) }),
  reorderedEpochRejected: rejects((v) => { [v.review.reviews[2], v.review.reviews[3]] = [v.review.reviews[3], v.review.reviews[2]] }),
  wrongPassCountRejected: rejects((v) => { v.review.previewPassCount = 4 }),
  thresholdChangeRejected: rejects((v) => { v.review.reviewThresholdsChanged = true }),
  epoch10FailureRejected: rejects((v) => { v.review.reviews[2].passed = false }),
  epoch20IssueRejected: rejects((v) => { v.review.reviews[3].issueCodes = ["new_issue"] }),
  epoch30ConditionFailureRejected: rejects((v) => { v.review.reviews[4].conditionAlignment.passed = false }),
  channelFailureRejected: rejects((v) => { v.review.reviews[3].conditionAlignment.channelAudits[0].passed = false }),
  objectFailureRejected: rejects((v) => { v.review.reviews[3].conditionAlignment.objectSemanticAudits[0].passed = false }),
  aestheticFailureRejected: rejects((v) => { v.review.reviews[3].professionalAesthetic.passed = false }),
  previewReproductionMismatchRejected: rejects((v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.previewSha256Matches = false }),
  stateReproductionMismatchRejected: rejects((v) => { v.manifest.stage4UnifiedTrainingPreviewSampling.denoiserStateIdentityMatches = false }),
  unchangedWeightsRejected: rejects((v) => { v.manifest.modelStateHashEvidence.weightsChanged = false }),
}
assert.ok(Object.values(positive).every(Boolean), `failedPositive=${Object.entries(positive).filter(([,v]) => !v).map(([k]) => k)}`)
assert.ok(Object.values(negative).every(Boolean), `failedNegative=${Object.entries(negative).filter(([,v]) => !v).map(([k]) => k)}`)
console.log(JSON.stringify({ schemaVersion: "ai-painter-stage4-object-visible-structure-sustained-late-stability-cpu-report-v1", status: "stage4_object_visible_structure_sustained_late_stability_cpu_contract_passed", positive, negative, positivePassed: Object.keys(positive).length, positiveTotal: Object.keys(positive).length, negativePassed: Object.keys(negative).length, negativeTotal: Object.keys(negative).length, decision, executionBoundary: { checkpointWeightsRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false } }, null, 2))

import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  compileR3CandidateOverlay,
  evaluateTailStability,
  readR3SmokeManifestMetrics,
  R3_SMOKE_MANIFEST_METRIC_FIELDS,
} from "./lib/ai-assisted-v7-r3-candidate.mjs"

const root = process.cwd()
const r2Path = path.join(root, "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json")
const phase1Pointer = readJson(".runtime/ai-painter/local-ai-failure-learning/latest.json")
const r2 = JSON.parse(fs.readFileSync(r2Path, "utf8"))
const phase1 = readJson(phase1Pointer.runPath)
const candidate = compileR3CandidateOverlay({
  r2Overlay: r2,
  failureLearningReport: phase1,
  sourceEvidence: {
    r2Overlay: { path: "r2", sha256: "a".repeat(64) },
    failureLearningReport: { path: "phase1", sha256: "b".repeat(64) },
  },
})

assert.equal(candidate.patch.training.boundedRepairVersion, "v7_bounded_repair_r3_candidate")
assert.equal(candidate.patch.training.trainingAuthorizationStatus, "not_authorized_candidate_only")
assert.equal(candidate.patch.training.ownerTrainingAuthorization.gpuTrainingAuthorizedNow, false)
assert.deepEqual(candidate.patch.training.smokeStabilityGate.tailEpochs, [100, 110, 120])
assert.equal(candidate.patch.training.smokeStabilityGate.preserveReviewThresholds, true)
assert(candidate.patch.training.semanticRgbConditionChannels.includes("object_tree"))
assert(candidate.patch.training.semanticRgbConditionChannels.includes("object_rock"))
assert(candidate.patch.training.semanticRgbConditionChannels.includes("object_vegetation"))
assert(candidate.patch.training.denoiserLossWeights.pathInteriorRgb > 0)
assert(candidate.patch.training.denoiserLossWeights.pathForbiddenBoundaryRgb > 0)
assert(candidate.patch.training.denoiserLossWeights.objectSemanticRgb > 0)

const gate = candidate.patch.training.smokeStabilityGate
assert.equal(evaluateTailStability([
  { epoch: 100, passed: true, issueCodes: [] },
  { epoch: 110, passed: true, issueCodes: [] },
  { epoch: 120, passed: true, issueCodes: [] },
], gate).passed, true)
assert.equal(evaluateTailStability([
  { epoch: 100, passed: true, issueCodes: [] },
  { epoch: 110, passed: false, issueCodes: ["failure"] },
  { epoch: 120, passed: true, issueCodes: [] },
], gate).passed, false)
assert.equal(evaluateTailStability(phase1.timeline, gate).passed, false)

assert.deepEqual(R3_SMOKE_MANIFEST_METRIC_FIELDS, {
  objectTreeRgbMae: "trainObjectTreeRgbMae",
  objectRockRgbMae: "trainObjectRockRgbMae",
  objectVegetationRgbMae: "trainObjectVegetationRgbMae",
  pathInteriorRgbMae: "trainPathInteriorRgbMae",
  pathForbiddenBoundaryRgbMae: "trainPathForbiddenBoundaryRgbMae",
})
assert.deepEqual(readR3SmokeManifestMetrics({
  trainObjectTreeRgbMae: 0.1,
  trainObjectRockRgbMae: 0.2,
  trainObjectVegetationRgbMae: 0.3,
  trainPathInteriorRgbMae: 0.4,
  trainPathForbiddenBoundaryRgbMae: 0.5,
}), {
  values: {
    objectTreeRgbMae: 0.1,
    objectRockRgbMae: 0.2,
    objectVegetationRgbMae: 0.3,
    pathInteriorRgbMae: 0.4,
    pathForbiddenBoundaryRgbMae: 0.5,
  },
  missing: [],
})
assert.deepEqual(readR3SmokeManifestMetrics({ objectTreeRgbMae: 0.1 }).missing, [
  "objectTreeRgbMae",
  "objectRockRgbMae",
  "objectVegetationRgbMae",
  "pathInteriorRgbMae",
  "pathForbiddenBoundaryRgbMae",
])

const trainer = fs.readFileSync(path.join(root, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"), "utf8")
for (const token of [
  "objectTreeRgbMae",
  "objectRockRgbMae",
  "objectVegetationRgbMae",
  "pathInteriorRgbMae",
  "pathForbiddenBoundaryRgbMae",
  "V7 R3 candidate is isolated and is not authorized for training",
]) assert(trainer.includes(token), `trainer token missing: ${token}`)

const durableCandidatePath = path.join(root, "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json")
assert(fs.existsSync(durableCandidatePath))
const durableCandidate = JSON.parse(fs.readFileSync(durableCandidatePath, "utf8"))
assert.equal(durableCandidate.status, "isolated_candidate_cpu_preflight_required_training_not_authorized")
assert.equal(durableCandidate.promotionBoundary.gpuTrainingAuthorized, false)
assert.equal(durableCandidate.reviewThresholdPolicy, "preserved_unchanged")
assert.equal(sha256File(r2Path), "888393b34fe24e588c83be7e9981f08739f2c6b85228584af57135d5889d7a6d")

const phase2Pointer = readJson(".runtime/ai-painter/local-ai-failure-learning-r3-candidates/latest.json")
const phase2Terminal = readJson(phase2Pointer.runPath)
assert.equal(phase2Terminal.status, "r3_candidate_cpu_verified_waiting_independent_gpu_smoke_authorization")
assert.equal(phase2Terminal.candidate.sha256, sha256File(durableCandidatePath))
assert.equal(phase2Terminal.closure.cpuRegressionPassed, true)
assert.equal(phase2Terminal.closure.gpuTrainingStarted, false)
assert.equal(phase2Terminal.tailStabilityRegression.sourceR2Evidence.passed, false)
assert.equal(phase2Terminal.tailStabilityRegression.positiveSynthetic.passed, true)
assert.equal(phase2Terminal.tailStabilityRegression.negativeSynthetic.passed, false)

console.log("local AI V7 R3 candidate phase2: durable candidate, CPU regression and terminal checks passed")

function readJson(value) {
  return JSON.parse(fs.readFileSync(path.resolve(root, value), "utf8"))
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

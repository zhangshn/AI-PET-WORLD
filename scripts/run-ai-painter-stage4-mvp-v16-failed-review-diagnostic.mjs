import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
import { readBound } from "./lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
import { auditV16FrozenReview, V16_CAPABILITY, V16_REVIEW_CONTRACT_PATH,
  validateV16CandidateContract } from "./lib/ai-painter-stage4-mvp-v16-review-lineage.mjs"
import { verifyV16FormalReviewContract } from "./run-ai-painter-stage4-mvp-v16-stage0-machine-review.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = ".runtime/ai-painter/stage4-mvp-native-rgb-conditional-texture-bf16-v16-formal-executions/mvp-v16-stage0-batch-16ed86cdb9bc7f4beba9961a5b71e87cb2c7ea88/stages/mvp-v16-stage0-16ed86cdb9bc7f4beba9961a5b71e87cb2c7ea8864c754a4/review-candidates/manifest.json"
const failurePath = ".runtime/ai-painter/stage4-mvp-native-rgb-conditional-texture-bf16-v16-formal-executions/mvp-v16-stage0-batch-16ed86cdb9bc7f4beba9961a5b71e87cb2c7ea88/stages/mvp-v16-stage0-16ed86cdb9bc7f4beba9961a5b71e87cb2c7ea8864c754a4/failure.json"
const outputPath = ".runtime/ai-painter/stage4-mvp-native-rgb-conditional-texture-bf16-v16-formal-executions/mvp-v16-stage0-batch-16ed86cdb9bc7f4beba9961a5b71e87cb2c7ea88/stages/mvp-v16-stage0-16ed86cdb9bc7f4beba9961a5b71e87cb2c7ea8864c754a4/review/failed-closed-quality-diagnostic-v1.json"

function bind(logical) {
  const full = path.resolve(root, logical)
  assert.ok(full.startsWith(`${root}${path.sep}`))
  return { path: logical, sha256: crypto.createHash("sha256")
    .update(fs.readFileSync(full)).digest("hex") }
}
function boundJson(binding) { return JSON.parse(readBound(root, binding).toString("utf8")) }

async function main() {
  const manifestBinding = bind(manifestPath)
  const failureBinding = bind(failurePath)
  const reviewBinding = bind(V16_REVIEW_CONTRACT_PATH)
  const reviewContract = verifyV16FormalReviewContract(root, reviewBinding)
  const registry = await readCurrentExecutionRegistry(root)
  assert.equal(registry.ok, true)
  assert.equal(registry.registry.activeExecution, null)
  const failure = boundJson(failureBinding)
  const manifest = boundJson(manifestBinding)
  const execution = boundJson(manifest.executionPackage)
  const terminal = boundJson(manifest.trainingTerminal)
  const candidate = boundJson(execution.candidateContract)
  validateV16CandidateContract(candidate, reviewBinding)
  assert.equal(execution.reviewContract.sha256, reviewBinding.sha256)
  assert.equal(execution.capabilityVersion, V16_CAPABILITY)
  assert.equal(manifest.architectureId, V16_CAPABILITY)
  assert.equal(manifest.runId, execution.runId)
  assert.equal(manifest.executionPackageIdentity, execution.packageId)
  assert.equal(failure.runId, execution.runId)
  assert.equal(failure.packageId, execution.packageId)
  assert.equal(failure.status, "failed_closed")
  assert.equal(failure.workerTerminal.sha256, manifest.trainingTerminal.sha256)
  assert.match(failure.error, /review-candidate-pack-v1/u)
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(terminal.checkpointReloadVerified, true)
  assert.equal(terminal.optimizerStepsGenerator, 1152)
  assert.equal(terminal.optimizerStepsDiscriminator, 1152)
  assert.equal(registry.registry.latestTrainingTerminal.runId, execution.runId)
  assert.equal(registry.registry.latestTrainingTerminal.sha256, manifest.trainingTerminal.sha256)
  assert.equal(manifest.candidateCount, 8)
  assert.equal(manifest.candidateSplit, "validation")
  assert.equal(manifest.candidates.length, 8)
  assert.equal(manifest.executionBoundary.weightsModified, false)
  assert.equal(manifest.executionBoundary.machineReviewExecuted, false)
  for (const item of [manifest.executionPackage, manifest.trainingTerminal,
    manifest.datasetManifest, manifest.checkpoint, execution.candidateContract,
    execution.reviewContract, ...execution.programBindings]) readBound(root, item)
  for (const item of manifest.candidates) {
    assert.equal(item.split, "validation")
    for (const bound of [item.candidateRgb, item.referenceRgb,
      item.conditionPack, ...item.objectMasks]) readBound(root, bound)
  }
  const audit = await auditV16FrozenReview({ projectRoot: root, validated: { manifest } })
  const summary = {
    candidateCount: audit.candidateCount,
    semanticAndAestheticPassCount: audit.semanticAndAestheticPassCount,
    minimumDetailPassCount: audit.minimumDetailPassCount,
    shorelineApplicableCount: audit.shorelineReview.positiveSampleCount,
    shorelinePassed: audit.shorelineReview.passed,
    allFrozenGatesWouldPass: audit.semanticAndAestheticPassCount === 8
      && audit.minimumDetailPassCount === 8 && audit.shorelineReview.passed,
  }
  assert.equal(bind(manifestPath).sha256, manifestBinding.sha256)
  assert.equal(bind(failurePath).sha256, failureBinding.sha256)
  const after = await readCurrentExecutionRegistry(root)
  assert.equal(after.ok, true)
  assert.equal(after.registrySha256, registry.registrySha256)
  const report = {
    schemaVersion: "stage4-mvp-v16-failed-closed-quality-diagnostic-v1",
    status: "diagnostic_completed_not_formal_qualification",
    capabilityVersion: V16_CAPABILITY,
    runId: execution.runId, executionPackage: manifest.executionPackage,
    candidateManifest: manifestBinding, controllerFailure: failureBinding,
    frozenReviewContract: reviewBinding, frozenThresholds: audit.frozenThresholds,
    frozenMinimumDetail: audit.frozenMinimumDetail,
    summary, reviews: audit.reviews, shorelineReview: audit.shorelineReview,
    formalQualificationGranted: false, checkpointPromotionEligible: false,
    runtimePublicationAllowed: false, trainingStartedByDiagnostic: false,
    weightsModifiedByDiagnostic: false, registryRevision: registry.registry.registryRevision,
    registrySha256: registry.registrySha256, recordedAtUtc: new Date().toISOString(),
  }
  const destination = path.resolve(root, outputPath)
  assert.ok(destination.startsWith(`${root}${path.sep}`))
  const fd = fs.openSync(destination, "wx")
  try { fs.writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`); fs.fsyncSync(fd) }
  finally { fs.closeSync(fd) }
  process.stdout.write(`${JSON.stringify({ report: bind(outputPath), summary })}\n`)
}

await main()

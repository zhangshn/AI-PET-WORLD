import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { adjudicateLateReviewRows } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"

const ROOT = process.cwd()
const REVIEW_EPOCHS = Object.freeze([5, 10, 15, 20, 24])
const LATE_EPOCHS = Object.freeze([15, 20, 24])
const EXPECTED_DATASET_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const EXPECTED_SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
const EXPECTED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const EXPECTED_SPLIT_COUNTS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
const DATASET_MANIFEST = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const SOURCE_INDEX = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"

const args = parseArgs(process.argv.slice(2))
const runId = requireArg(args, "run-id")
assert.match(runId, /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/)

const executionRoot = inside(`.runtime/ai-painter/stage4-spatial-affine-full-data-screens/${runId}`)
const activeConfigPath = inside(`.runtime/ai-painter/stage4-spatial-affine-full-data-screen-preflights/${runId}/active-config.json`)
const manifestPath = path.join(executionRoot, "manifest.json")
const checkpointPath = path.join(executionRoot, "complete-world-ai-assisted-conditional-denoiser.pt")
const reviewPath = path.join(executionRoot, "machine-review.json")
const qualificationPath = path.join(executionRoot, "late-stability-qualification.json")
const finalizationPath = path.join(executionRoot, "finalization.json")
const terminalPath = path.join(executionRoot, "phase-terminal.json")

for (const output of [reviewPath, qualificationPath, finalizationPath, terminalPath]) {
  assert.equal(fs.existsSync(output), false, `${path.basename(output)} already exists`)
}

const activeConfig = readJson(activeConfigPath)
const manifest = readJson(manifestPath)
validateExecutionBindings(activeConfig, manifest)
const sample = loadFormalValidationSample194()
const conditionPack = readJson(inside(sample.conditionPackPath))
assert.equal(conditionPack.worldId, sample.conditionWorldId, "sample194 condition world identity mismatch")
assert.equal(conditionPack.channels?.length, 23, "sample194 condition pack must contain 23 channels")

const reviews = []
const progressPath = path.join(executionRoot, "review-progress.json")
writeProgress("running", null)
for (const epoch of REVIEW_EPOCHS) {
  writeProgress("running", epoch)
  const row = manifest.metrics.find((value) => value.epoch === epoch)
  assert.ok(row, `Epoch ${epoch} metric row is missing`)
  const source = row.validationPreviewArtifact
  const reproduction = row.validationPreviewReproductionArtifact
  assert.equal(source?.epoch, epoch, `Epoch ${epoch} source preview identity mismatch`)
  assert.equal(source?.sampleId, sample.sampleId, `Epoch ${epoch} sample identity mismatch`)
  assert.equal(reproduction?.status, "fixed_epoch_preview_reproduced_exactly", `Epoch ${epoch} reproduction status mismatch`)
  for (const key of ["modelStateSha256Matches", "conditionTensorSha256Matches", "rgbTensorSha256Matches", "pngByteSha256Matches"]) {
    assert.equal(reproduction?.[key], true, `Epoch ${epoch} ${key} is false`)
  }
  const sourcePath = inside(source.previewPath)
  const repeatedPath = inside(reproduction.repeatedPreview.previewPath)
  assert.equal(sha256File(sourcePath), source.previewSha256, `Epoch ${epoch} source preview hash mismatch`)
  assert.equal(sha256File(repeatedPath), reproduction.repeatedPreview.previewSha256, `Epoch ${epoch} reproduced preview hash mismatch`)
  assert.equal(sha256File(sourcePath), sha256File(repeatedPath), `Epoch ${epoch} preview bytes differ`)

  const normalizedPath = path.join(executionRoot, "review-assets", `epoch-${String(epoch).padStart(3, "0")}.png`)
  const normalized = await normalizePreviewWithWindowsSafeIo({
    sourcePath,
    finalAssetPath: normalizedPath,
    workRoot: inside(".runtime/ai-painter/stage4-spatial-affine-screen-review-work"),
    workId: sha256Text(runId).slice(0, 16),
    epoch,
  })
  const record = {
    recordId: `${runId}-${epoch}`,
    conditionBinding: {
      conditionPackPath: sample.conditionPackPath,
      worldId: conditionPack.worldId,
      tick: conditionPack.tick,
    },
    classification: sample.classification,
  }
  const [professionalAesthetic, conditionAlignment] = await Promise.all([
    auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
    auditAiAssistedConditionAlignment({
      record,
      imagePath: normalized.shortOutputPath,
      referenceImagePath: sample.imagePath,
    }),
  ])
  const issueCodes = [...professionalAesthetic.issues, ...conditionAlignment.issues].map((issue) => issue.code)
  reviews.push({
    epoch,
    previewPath: projectPath(sourcePath),
    previewSha256: sha256File(sourcePath),
    reproducedPreviewPath: projectPath(repeatedPath),
    reproducedPreviewSha256: sha256File(repeatedPath),
    normalizedPath: projectPath(normalizedPath),
    normalizedSha256: sha256File(normalizedPath),
    fixedPreviewReproducedExactly: true,
    passed: professionalAesthetic.passed && conditionAlignment.passed,
    issueCodes,
    professionalAesthetic,
    conditionAlignment,
  })
  writeProgress("running", epoch)
}

const review = {
  schemaVersion: "stage4-spatial-affine-full-data-screen-machine-review-v1",
  status: reviews.every((value) => value.passed) ? "machine_reviews_passed" : "machine_reviews_completed_with_visual_failures",
  candidateArchitecture: "stage4_multiscale_spatial_affine_conditioned_decoder_v1",
  runId,
  requiredPreviewEpochs: REVIEW_EPOCHS,
  diagnosticEpochs: REVIEW_EPOCHS.filter((epoch) => !LATE_EPOCHS.includes(epoch)),
  qualificationEpochs: LATE_EPOCHS,
  reviewThresholdsChanged: false,
  evidenceBindings: {
    activeConfig: bind(activeConfigPath),
    trainingManifest: bind(manifestPath),
    datasetManifest: bind(inside(DATASET_MANIFEST)),
    sourceIndex: bind(inside(SOURCE_INDEX)),
    formalValidationSample: {
      sampleId: sample.sampleId,
      split: sample.split,
      imagePath: sample.imagePath,
      imageSha256: sample.imageSha256,
      conditionPackPath: sample.conditionPackPath,
      conditionPackSha256: sha256File(inside(sample.conditionPackPath)),
    },
  },
  previewCount: reviews.length,
  previewPassCount: reviews.filter((value) => value.passed).length,
  previewFailCount: reviews.filter((value) => !value.passed).length,
  reviews,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(reviewPath, review)

const trajectory = adjudicateLateReviewRows(reviews, {
  requiredEpochs: REVIEW_EPOCHS,
  lateEpochs: LATE_EPOCHS,
})
const weightsChanged = manifest.modelStateHashEvidence?.weightsChanged === true
const qualified = trajectory.qualified && weightsChanged
const qualification = {
  schemaVersion: "stage4-spatial-affine-full-data-screen-late-stability-qualification-v1",
  status: qualified ? "screen_late_stability_qualified" : "screen_late_stability_not_qualified",
  runId,
  ...trajectory,
  fixedPreviewByteReproduction: reviews.every((value) => value.fixedPreviewReproducedExactly),
  diagnosticEpochs: trajectory.diagnosticEpochs,
  qualificationEpochs: trajectory.qualificationEpochs,
  weightsChanged,
  machineReviewThresholdsChanged: false,
  evidenceBindings: {
    activeConfig: bind(activeConfigPath),
    trainingManifest: bind(manifestPath),
    machineReview: bind(reviewPath),
  },
  screenCheckpointPromotable: false,
  screenCheckpointStage0InitializationEligible: false,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(qualificationPath, qualification)

const terminalStatus = qualified
  ? "stage4_spatial_affine_full_data_screen_qualified"
  : "stage4_spatial_affine_full_data_screen_real_visual_failure"
const finalization = {
  schemaVersion: "stage4-spatial-affine-full-data-screen-finalization-v1",
  executionState: "completed",
  status: terminalStatus,
  runId,
  manifest: bind(manifestPath),
  machineReview: bind(reviewPath),
  lateStabilityQualification: bind(qualificationPath),
  activeConfig: bind(activeConfigPath),
  checkpoint: {
    path: projectPath(checkpointPath),
    sha256: sha256File(checkpointPath),
    promotable: false,
    stage0InitializationEligible: false,
  },
  nextAction: qualified
    ? "autonomous_compile_and_execute_fresh_spatial_affine_stage0"
    : "fail_closed_no_retry_or_threshold_change",
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(finalizationPath, finalization)
const terminal = {
  schemaVersion: "stage4-spatial-affine-full-data-screen-terminal-v1",
  executionState: "completed",
  status: terminalStatus,
  runId,
  finalization: bind(finalizationPath),
  manifest: bind(manifestPath),
  machineReview: bind(reviewPath),
  lateStabilityQualification: bind(qualificationPath),
  activeConfig: bind(activeConfigPath),
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(terminalPath, terminal)
writeProgress("completed", null)
process.stdout.write(`${JSON.stringify({
  status: terminalStatus,
  qualified,
  terminal: bind(terminalPath),
  machineReview: bind(reviewPath),
  lateStabilityQualification: bind(qualificationPath),
}, null, 2)}\n`)

function validateExecutionBindings(config, value) {
  assert.equal(sha256File(inside(DATASET_MANIFEST)), EXPECTED_DATASET_SHA256, "dataset manifest SHA-256 changed")
  assert.equal(config.denoiserArchitecture, "stage4_multiscale_spatial_affine_conditioned_decoder_v1")
  assert.equal(config.status, "full_data_screen_active")
  assert.equal(config.training?.denoiserEpochs, 24)
  assert.deepEqual(config.training?.fullDataScreenContract?.reviewEpochs, REVIEW_EPOCHS)
  assert.equal(config.training?.fullDataScreenContract?.fixedPreviewByteReproductionRequired, true)
  assert.equal(config.training?.localAiCapabilityTicket?.runId, runId)
  assert.equal(inside(config.training.localAiCapabilityTicket.outputNamespace), executionRoot)
  assert.equal(value.status, "stage4_spatial_affine_screen_training_completed_awaiting_automatic_machine_review")
  assert.equal(value.trainingStage, "stage4_spatial_affine_full_data_screen")
  assert.equal(value.modelId, config.modelId)
  assert.equal(value.seed, 20263722)
  assert.deepEqual(value.resolutionStage, { width: 256, height: 192 })
  assert.equal(value.actualLoadedConditionalSampleCount, 64)
  assert.deepEqual(value.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(value.datasetManifestSha256, EXPECTED_DATASET_SHA256)
  assert.equal(value.sourceIndexSha256, EXPECTED_SOURCE_INDEX_SHA256)
  assert.equal(value.parentDenoiserCheckpointPath, null)
  assert.equal(value.parentDenoiserCheckpointSha256, null)
  assert.equal(value.machineReviewPending, true)
  assert.equal(value.checkpointPromotionEligible, false)
  assert.equal(value.stage0InitializationEligible, false)
  assert.equal(value.metrics?.length, 24)
  assert.equal(sha256File(inside(value.checkpointPath)), value.checkpointSha256)
  assert.equal(inside(value.checkpointPath), checkpointPath)
  const scheduled = value.metrics.filter((row) => row.validationPreviewArtifact).map((row) => row.epoch)
  assert.deepEqual(scheduled, REVIEW_EPOCHS)
}

function loadFormalValidationSample194() {
  const sourcePath = inside(SOURCE_INDEX)
  assert.equal(sha256File(sourcePath), EXPECTED_SOURCE_INDEX_SHA256, "source-index SHA-256 changed")
  const source = readJson(sourcePath)
  assert.equal(source.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.ok(Array.isArray(source.samples), "source-index samples are missing")
  const formallyEligible = source.samples.filter(isFormalV7CapacityRow)
  const splitCounts = formallyEligible.reduce((counts, value) => {
    counts[value.split] = (counts[value.split] ?? 0) + 1
    return counts
  }, {})
  assert.equal(formallyEligible.length, 64, "formal V7 capacity must contain exactly 64 records")
  assert.deepEqual(splitCounts, EXPECTED_SPLIT_COUNTS, "formal V7 capacity split must be 48/8/4/4")
  assert.equal(new Set(formallyEligible.map((value) => value.recordId)).size, 64, "formal V7 record identities must be unique")
  assert.equal(new Set(formallyEligible.map((value) => value.v7CapacitySlotId)).size, 64, "formal V7 slot identities must be unique")
  const samples = formallyEligible.filter((value) => value.sampleId === EXPECTED_SAMPLE_ID)
  assert.equal(samples.length, 1, "formal sample194 identity must be exact and unique")
  const sample = samples[0]
  assert.equal(sample.split, "validation")
  assert.equal(sample.formalConditionalTrainingEligible, true)
  assert.equal(sha256File(inside(sample.imagePath)), sample.imageSha256)
  return sample
}

function isFormalV7CapacityRow(value) {
  return ["train", "validation", "challenge", "regression"].includes(value.split)
    && value.categoryId === "complete-maps"
    && value.trainingRoles?.includes("conditional_denoiser")
    && value.formalConditionalTrainingEligible === true
    && value.conditionBound === true
    && value.v7CapacityContributionRegistered === true
    && value.ownerReviewStatus === "owner_approved"
    && value.machineReviewStatus === "passed"
    && value.aiAssistedColdStartEligible === true
    && value.independentTrainingEligible === false
}

function writeProgress(status, currentEpoch) {
  writeJsonAtomic(progressPath, {
    schemaVersion: "stage4-spatial-affine-full-data-screen-review-progress-v1",
    status,
    phase: "automatic_machine_review",
    runId,
    previewCount: REVIEW_EPOCHS.length,
    completedPreviewCount: reviews.length,
    previewPassCount: reviews.filter((value) => value.passed).length,
    previewFailCount: reviews.filter((value) => !value.passed).length,
    currentEpoch,
    ownerAuthorizationRequired: false,
    updatedAtUtc: new Date().toISOString(),
  })
}

function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--"), "invalid review argument")
    assert.ok(values[index + 1] && !values[index + 1].startsWith("--"), `missing value for ${values[index]}`)
    parsed.set(values[index].slice(2), values[index + 1])
  }
  return parsed
}
function requireArg(values, name) {
  const value = values.get(name)
  assert.ok(value, `--${name} is required`)
  return value
}
function inside(relativePath) {
  assert.equal(path.isAbsolute(relativePath), false, "project-relative path required")
  const resolved = path.resolve(ROOT, relativePath)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), "path escapes project")
  return resolved
}
function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
}
function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}
function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}
function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}
function bind(value) {
  return { path: projectPath(value), sha256: sha256File(value) }
}
function writeExclusiveJson(valuePath, value) {
  fs.mkdirSync(path.dirname(valuePath), { recursive: true })
  fs.writeFileSync(valuePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}
function writeJsonAtomic(valuePath, value) {
  fs.mkdirSync(path.dirname(valuePath), { recursive: true })
  const temporary = `${valuePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  fs.renameSync(temporary, valuePath)
}

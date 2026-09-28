import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { auditProfessionalAestheticFromFrozenContract } from "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"


const ROOT = process.cwd()
const V2_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const V3_CAPABILITY = "stage4_mvp_object_semantic_closure_v3"
const V4_CAPABILITY = "stage4_mvp_object_trajectory_closure_v4"
const V5_CAPABILITY = "stage4_mvp_short_trajectory_closure_v5"
const V6_CAPABILITY = "stage4_mvp_native_complete_rgb_renderer_v6"
const V7_CAPABILITY = "stage4_mvp_native_complete_rgb_detail_renderer_v7"
const V8_CAPABILITY = "stage4_mvp_native_complete_rgb_object_crop_renderer_v8"
const V10_CAPABILITY = "stage4_mvp_native_complete_rgb_aperiodic_detail_renderer_v10"
const V11_CAPABILITY = "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
const V12_CAPABILITY = "stage4_mvp_native_complete_rgb_local_texture_renderer_v12"
const V9_CAPABILITY = "stage4_mvp_native_complete_rgb_detail_recovery_renderer_v9"
const SUPPORTED_CAPABILITIES = new Set([V2_CAPABILITY, V3_CAPABILITY, V4_CAPABILITY, V5_CAPABILITY, V6_CAPABILITY, V7_CAPABILITY, V8_CAPABILITY, V9_CAPABILITY, V10_CAPABILITY, V11_CAPABILITY, V12_CAPABILITY])
const THRESHOLD_PATH = "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json"
const THRESHOLD_SHA256 = "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df"
const CONDITION_AUDITOR = {
  path: "scripts/lib/ai-assisted-condition-alignment.mjs",
  sha256: "c01ea4efba9835e488e42c7ed44d2aef434ee3db21b06e84e70379722bcc145e",
}
const PROFESSIONAL_AUDITOR = {
  path: "scripts/lib/ai-assisted-professional-aesthetic.mjs",
  sha256: "d07af489c4398e05abe94060fa773a65710ed9e57a72df2514352075fdf2e7e8",
}


const args = parseArgs(process.argv.slice(2))
const candidateManifestBinding = {
  path: required(args, "candidate-manifest").replaceAll("\\", "/"),
  sha256: required(args, "candidate-manifest-sha256"),
}
const capability = args.get("capability-version") ?? V2_CAPABILITY
assert.equal(SUPPORTED_CAPABILITIES.has(capability), true, "unsupported capability identity")
const outputPath = inside(required(args, "output").replaceAll("\\", "/"))
assert.equal(fs.existsSync(outputPath), false, "machine review output already exists")

const manifest = readBoundJson(candidateManifestBinding, "candidateManifest")
assert.equal(manifest.schemaVersion, "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1")
assert.equal(manifest.status, "candidate_pack_materialized_review_pending")
assert.equal(manifest.architectureId, capability)
assert.deepEqual(manifest.stage, { stage: 0, width: 256, height: 192,
  epochCount: (capability === V9_CAPABILITY || capability === V10_CAPABILITY || capability === V11_CAPABILITY || capability === V12_CAPABILITY) ? 24 : 40 })
assert.equal(manifest.candidateCount, 8)
assert.equal(manifest.candidateSplit, "validation")
assert.equal(manifest.executionBoundary?.machineReviewExecuted, false)
assert.equal(manifest.executionBoundary?.weightsModified, false)
assert.equal(manifest.executionBoundary?.challengeRead, false)
assert.equal(manifest.executionBoundary?.regressionRead, false)

const executionPackage = readBoundJson(manifest.executionPackage, "executionPackage")
const trainingTerminal = readBoundJson(manifest.trainingTerminal, "trainingTerminal")
assert.equal(executionPackage.packageId, manifest.executionPackageIdentity)
assert.equal(executionPackage.runId, manifest.runId)
assert.equal(trainingTerminal.packageId, manifest.executionPackageIdentity)
assert.equal(trainingTerminal.runId, manifest.runId)
assert.deepEqual(trainingTerminal.checkpoint, manifest.checkpoint)
assert.equal(trainingTerminal.selectedEpoch, manifest.selectedEpoch)
if (capability === V6_CAPABILITY || capability === V7_CAPABILITY || capability === V8_CAPABILITY || capability === V9_CAPABILITY || capability === V10_CAPABILITY || capability === V11_CAPABILITY || capability === V12_CAPABILITY) {
  assert.equal(trainingTerminal.modelStateSha256, manifest.modelStateSha256)
} else {
  assert.equal(trainingTerminal.denoiserStateSha256, manifest.denoiserStateSha256)
}
verifyBinding(manifest.datasetManifest, "datasetManifest")
verifyBinding(manifest.checkpoint, "checkpoint")

const thresholdBinding = { path: THRESHOLD_PATH, sha256: THRESHOLD_SHA256 }
const threshold = readBoundJson(thresholdBinding, "thresholdContract")
assert.equal(threshold.schemaVersion, "ai-painter-stage4-v2-machine-review-threshold-contract-v1")
assert.equal(threshold.architectureId, V2_CAPABILITY)
assert.equal(threshold.immutable, true)
assert.equal(threshold.reviewTrainingSeparation?.thresholdLoweringAllowed, false)
assert.equal(threshold.reviewTrainingSeparation?.reviewResultsUsedAsTrainingTarget, false)
const formalReviewDispatchable = threshold.activation?.formalReviewExecutionAllowed === true
  && threshold.formalReviewBoundary?.dispatchable === true
verifyBinding(CONDITION_AUDITOR, "conditionAlignmentProgram")
verifyBinding(PROFESSIONAL_AUDITOR, "professionalAestheticProgram")
const styleFingerprint = threshold.styleFingerprint
verifyBinding(styleFingerprint, "styleFingerprint")

const allowedConditionCodes = new Set([
  ...threshold.failureCodes.waterAndPath,
  ...threshold.failureCodes.objects,
  ...threshold.failureCodes.hydrology,
])
const outputRoot = path.dirname(outputPath)
const assetRoot = path.join(outputRoot, "review-assets")
const workRoot = inside(".runtime/ai-painter/stage4-mvp-stage0-review-work")
const workId = sha256Text(`${manifest.runId}:${candidateManifestBinding.sha256}`).slice(0, 20)
const reviews = []

for (const candidate of manifest.candidates) {
  assert.equal(candidate.split, "validation")
  assert.equal(candidate.candidateRgb.width, 256)
  assert.equal(candidate.candidateRgb.height, 192)
  verifyBinding(candidate.candidateRgb, `candidateRgb_${candidate.sampleIndex}`)
  verifyBinding(candidate.referenceRgb, `referenceRgb_${candidate.sampleIndex}`)
  const conditionPack = readBoundJson(candidate.conditionPack, `conditionPack_${candidate.sampleIndex}`)
  assert.equal(conditionPack.channels?.length, 23)
  assert.deepEqual(candidate.objectMasks.map((item) => item.role), [
    "object_footprints", "object_tree", "object_rock", "object_vegetation",
  ])
  for (const mask of candidate.objectMasks) verifyBinding(mask, `${mask.role}_${candidate.sampleIndex}`)
  const normalizedPath = path.join(assetRoot, `validation-${String(candidate.sampleIndex).padStart(2, "0")}-1024x768.png`)
  const normalized = await normalizePreviewWithWindowsSafeIo({
    sourcePath: inside(candidate.candidateRgb.path),
    finalAssetPath: normalizedPath,
    workRoot,
    workId,
    epoch: candidate.sampleIndex + 1,
  })
  const professional = await auditProfessionalAestheticFromFrozenContract({
    imagePath: normalized.shortOutputPath,
    thresholdContract: threshold,
    styleFingerprintPath: inside(styleFingerprint.path),
    expectedStyleFingerprintSha256: styleFingerprint.sha256,
  })
  const subject = conditionPack.reviewSubject ?? {}
  const alignmentRaw = await auditAiAssistedConditionAlignment({
    record: {
      recordId: `${manifest.runId}-validation-${candidate.sampleIndex}`,
      conditionBinding: {
        conditionPackPath: candidate.conditionPack.path,
        worldId: conditionPack.worldId,
        tick: conditionPack.tick,
      },
      rebuild64Sequence: subject.rebuild64SequenceSeriesId
        ? { seriesId: subject.rebuild64SequenceSeriesId }
        : undefined,
      classification: {
        regionalLandscapeType: subject.regionalLandscapeType ?? null,
        monsoonSeason: subject.monsoonSeason ?? conditionPack.classification?.monsoonSeason ?? null,
      },
    },
    imagePath: normalized.shortOutputPath,
    referenceImagePath: inside(candidate.referenceRgb.path),
  })
  const conditionIssues = (alignmentRaw.issues ?? []).filter((item) => allowedConditionCodes.has(item.code))
  const alignment = {
    ...alignmentRaw,
    status: conditionIssues.length === 0 ? "condition_alignment_passed" : "condition_alignment_failed",
    passed: conditionIssues.length === 0,
    objectSemanticAudits: (alignmentRaw.objectSemanticAudits ?? [])
      .filter((item) => candidate.objectMasks.some((mask) => mask.role === item.channelId)),
    auxiliaryDiagnostics: (alignmentRaw.objectSemanticAudits ?? [])
      .filter((item) => item.channelId === "focal_area"),
    issues: conditionIssues,
  }
  const issueCodes = [...new Set([
    ...(professional.issues ?? []).map((item) => item.code),
    ...conditionIssues.map((item) => item.code),
  ])].sort()
  reviews.push({
    sampleIndex: candidate.sampleIndex,
    sampleId: candidate.sampleId,
    candidateRgb: candidate.candidateRgb,
    normalizedCandidateRgb: bind(normalizedPath),
    passed: professional.passed === true && alignment.passed === true,
    issueCodes,
    professionalAesthetic: professional,
    conditionAlignment: alignment,
  })
  verifyBinding(candidate.candidateRgb, `candidateRgb_${candidate.sampleIndex}_after_review`)
  verifyBinding(candidate.referenceRgb, `referenceRgb_${candidate.sampleIndex}_after_review`)
  verifyBinding(candidate.conditionPack, `conditionPack_${candidate.sampleIndex}_after_review`)
}

const passCount = reviews.filter((item) => item.passed).length
const issueHistogram = {}
for (const review of reviews) {
  for (const code of review.issueCodes) issueHistogram[code] = (issueHistogram[code] ?? 0) + 1
}
const report = {
  schemaVersion: "ai-painter-stage4-mvp-stage0-machine-review-v1",
  status: passCount === reviews.length
    ? "stage4_mvp_stage0_machine_review_passed"
    : "stage4_mvp_stage0_machine_review_failed",
  executionState: "completed",
  architectureId: capability,
  executionPackageIdentity: manifest.executionPackageIdentity,
  runId: manifest.runId,
  stage: manifest.stage,
  candidateManifest: candidateManifestBinding,
  executionPackage: manifest.executionPackage,
  trainingTerminal: manifest.trainingTerminal,
  checkpoint: manifest.checkpoint,
  thresholdContract: thresholdBinding,
  reviewPrograms: {
    conditionAlignment: CONDITION_AUDITOR,
    professionalAesthetic: PROFESSIONAL_AUDITOR,
  },
  styleFingerprint,
  candidateCount: reviews.length,
  candidatePassCount: passCount,
  candidateFailCount: reviews.length - passCount,
  issueHistogram,
  reviews,
  reviewTrainingSeparation: {
    reviewResultsUsedAsTrainingTarget: false,
    failureCodesUsedAsLoss: false,
    failedPreviewPixelsUsedAsTrainingTarget: false,
    thresholdAdaptationDuringReview: false,
    thresholdLoweringAllowed: false,
  },
  reviewAuthority: {
    thresholdContractStatus: threshold.status,
    formalReviewRunnerState: threshold.formalReviewBoundary?.runnerState ?? null,
    formalReviewDispatchable,
    diagnosticReviewOnly: !formalReviewDispatchable,
  },
  gpuStartedByReview: false,
  optimizerCreatedByReview: false,
  backwardExecutedByReview: false,
  weightsModifiedByReview: false,
  trainingStartedByReview: false,
  formalQualificationGranted: passCount === reviews.length && formalReviewDispatchable,
  checkpointPromotionEligible: passCount === reviews.length && formalReviewDispatchable,
  stage1InitializationEligible: passCount === reviews.length && formalReviewDispatchable,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(outputPath, report)
process.stdout.write(`${JSON.stringify({
  status: report.status,
  candidatePassCount: report.candidatePassCount,
  candidateFailCount: report.candidateFailCount,
  issueHistogram: report.issueHistogram,
  report: bind(outputPath),
}, null, 2)}\n`)


function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--"), "invalid argument")
    assert.ok(values[index + 1] && !values[index + 1].startsWith("--"), `missing value for ${values[index]}`)
    parsed.set(values[index].slice(2), values[index + 1])
  }
  return parsed
}

function required(values, name) {
  const value = values.get(name)
  assert.ok(value, `--${name} is required`)
  return value
}

function inside(logicalPath) {
  assert.equal(path.isAbsolute(logicalPath), false, "project-relative path required")
  const resolved = path.resolve(ROOT, logicalPath)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), "path escapes project")
  return resolved
}

function readBoundJson(binding, role) {
  const absolute = verifyBinding(binding, role)
  return JSON.parse(fs.readFileSync(absolute, "utf8"))
}

function verifyBinding(binding, role) {
  assert.ok(binding && typeof binding === "object", `${role} binding missing`)
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`)
  const absolute = inside(binding.path)
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`)
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`)
  return absolute
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
}

function bind(value) {
  return { path: projectPath(value), sha256: sha256File(value) }
}

function writeExclusiveJson(valuePath, value) {
  fs.mkdirSync(path.dirname(valuePath), { recursive: true })
  fs.writeFileSync(valuePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

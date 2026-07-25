import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const DATASET_POINTER_PATH = "data/world-samples/ai-assisted-v7-engineering-pretraining-datasets/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-preset-home-site-reclassifications"
const AUTHORIZATION_ID = "owner-authorized-no-preset-home-site-engineering-rebuild-24-20260724"
const FORBIDDEN_PATTERNS = [
  /home[_ -]?center/i,
  /activity[_ -]?center/i,
  /construction[_ -]?clearing/i,
  /building[_ -]?candidate/i,
  /route[_ -]?convergence[_ -]?platform/i,
  /playable[_ -]?natural[_ -]?home[_ -]?center/i,
]

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-preset-home-site-reclassification-${createdAtUtc.replace(/[:.]/g, "-")}`

const datasetPointer = readJson(DATASET_POINTER_PATH)
verifyFileHash(datasetPointer.manifestPath, datasetPointer.manifestSha256, "engineering dataset manifest hash mismatch")
const datasetManifest = readJson(datasetPointer.manifestPath)
const sourceIndex = readJson(datasetManifest.sourceIndexPath)

assert(datasetManifest.sampleCount === 26, `expected 26 engineering samples, received ${datasetManifest.sampleCount}`)
assert(sourceIndex.samples?.length === 26, `expected 26 source-index samples, received ${sourceIndex.samples?.length}`)

const auditedRecords = sourceIndex.samples
  .map((sample) => auditSample(sample))
  .sort((left, right) => left.recordId.localeCompare(right.recordId))
const incompatibleRecords = auditedRecords.filter((entry) => entry.presetHomeSiteSemanticsDetected)
const retainedRecords = auditedRecords.filter((entry) => !entry.presetHomeSiteSemanticsDetected)

assert(incompatibleRecords.length === 24, `expected 24 preset-home-site records, received ${incompatibleRecords.length}`)
assert(retainedRecords.length === 2, `expected 2 autonomous-world-compatible records, received ${retainedRecords.length}`)
assert(
  retainedRecords.every((entry) => ["v7-capacity-slot-033", "v7-capacity-slot-034"].includes(entry.capacitySlotId)),
  "retained autonomous-world records are not the expected slots 033 and 034",
)

const record = {
  schemaVersion: "ai-assisted-v7-preset-home-site-engineering-reclassification-v1",
  runId,
  status: "owner_suspended_preset_home_site_engineering_training_eligibility",
  createdAtUtc,
  createdAtAsiaShanghai,
  authorization: {
    authorizationId: AUTHORIZATION_ID,
    authorizedBy: "project_owner",
    decision: "retain immutable history but suspend engineering training eligibility for 24 records that predate the no-preset-home-site rule",
  },
  sourceDataset: {
    packageId: datasetManifest.packageId,
    manifestPath: datasetPointer.manifestPath,
    manifestSha256: datasetPointer.manifestSha256,
    sourceIndexPath: datasetManifest.sourceIndexPath,
    sourceIndexSha256: sha256File(datasetManifest.sourceIndexPath),
    sourceSampleCount: sourceIndex.samples.length,
  },
  auditRule: {
    ruleId: "initial-natural-world-no-preset-home-site-v1",
    focalAreaMustBeAllZero: true,
    forbiddenSemanticPatterns: FORBIDDEN_PATTERNS.map((pattern) => pattern.source),
    historicalSourceMutationAllowed: false,
  },
  reclassification: {
    incompatibleRecordCount: incompatibleRecords.length,
    retainedCompatibleRecordCount: retainedRecords.length,
    incompatibleEngineeringTrainingEligible: false,
    incompatibleFormalV7TrainingEligible: false,
    historicalEvidenceRetained: true,
    sourceImagesDeleted: false,
    sourceRecordsModified: false,
    previousCheckpointRetainedAsHistoricalEvidence: true,
  },
  incompatibleRecords,
  retainedCompatibleRecords: retainedRecords,
  executionBoundary: {
    imagesGenerated: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    trainingStarted: false,
    runtimeEligibilityGranted: false,
    formalInferenceEligibilityGranted: false,
  },
  nextRequiredAction: "build_24_new_complete_map_world_facts_director_tasks_and_23_channels_without_preset_home_site",
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "reclassification.json",
  record,
  latest: {
    updatedAtAsiaShanghai: createdAtAsiaShanghai,
    authorizationId: AUTHORIZATION_ID,
    sourcePackageId: datasetManifest.packageId,
    incompatibleRecordCount: incompatibleRecords.length,
    retainedCompatibleRecordCount: retainedRecords.length,
    incompatibleRecordIds: incompatibleRecords.map((entry) => entry.recordId),
    retainedCompatibleRecordIds: retainedRecords.map((entry) => entry.recordId),
    engineeringTrainingMayResume: false,
    v7GpuTrainingMayStart: false,
  },
})
const evidenceSha256 = sha256File(written.runPath)

appendAiPainterProgramEvent({
  status: "blocked",
  stage: "ai_assisted_v7_preset_home_site_engineering_reclassification",
  action: "suspend_preset_home_site_engineering_training_eligibility",
  runId,
  titleZh: "程序已暂停24条旧固定家园中心数据的后续工程训练资格",
  titleEn: "The program suspended future engineering-training eligibility for 24 legacy preset-home-site records",
  summaryZh: "旧图片、审核、训练和哈希证据全部保留且未改写；24条旧规则记录不再进入后续工程训练。2条符合自主自然世界规则的记录继续保留。未生成图片，未启动GPU训练。",
  summaryEn: "All historical images, reviews, training evidence, and hashes remain immutable. The 24 legacy records are excluded from future engineering training, while two autonomous-world-compatible records remain. No image generation or GPU training started.",
  evidence: [written.runPath, datasetPointer.manifestPath, datasetManifest.sourceIndexPath],
  evidencePath: written.runPath,
  evidenceSha256,
  errorCode: "preset_home_site_engineering_records_suspended_pending_24_record_rebuild",
})

console.log(JSON.stringify({
  status: record.status,
  runId,
  reclassificationPath: written.runPath,
  reclassificationSha256: evidenceSha256,
  incompatibleRecordCount: incompatibleRecords.length,
  retainedCompatibleRecordCount: retainedRecords.length,
  retainedCompatibleRecordIds: retainedRecords.map((entry) => entry.recordId),
  imagesGenerated: 0,
  gpuTrainingStarted: false,
}, null, 2))

function auditSample(sample) {
  verifyFileHash(sample.imagePath, sample.imageSha256, `image hash mismatch: ${sample.recordId}`)
  verifyFileHash(sample.sourceRecordPath, sample.sourceRecordSha256, `source record hash mismatch: ${sample.recordId}`)
  verifyFileHash(sample.sourceConditionPackPath, sample.sourceConditionPackSha256, `source condition hash mismatch: ${sample.recordId}`)

  const sourceConditionPack = readJson(sample.sourceConditionPackPath)
  const taskPackagePath = path.join(path.dirname(path.dirname(resolveProjectPath(sample.sourceConditionPackPath))), "task-package.json")
  assert(fs.existsSync(taskPackagePath), `task package missing: ${projectPath(taskPackagePath)}`)
  const taskPackage = readJson(taskPackagePath)
  const focalArea = sourceConditionPack.channels?.find((entry) => entry.id === "focal_area")
  assert(focalArea, `focal_area channel missing: ${sample.recordId}`)

  const matchedPatterns = collectActiveSemanticMatches(taskPackage)
  const focalAreaNonZeroCount = Number(focalArea.statistics?.nonZeroCount ?? 0)
  const presetHomeSiteSemanticsDetected = matchedPatterns.length > 0 || focalAreaNonZeroCount > 0

  return {
    recordId: sample.recordId,
    capacitySlotId: sample.v7CapacitySlotId ?? null,
    split: sample.split,
    currentConditionSource: sample.currentConditionSource,
    imagePath: sample.imagePath,
    imageSha256: sample.imageSha256,
    sourceRecordPath: sample.sourceRecordPath,
    sourceRecordSha256: sample.sourceRecordSha256,
    taskPackagePath: projectPath(taskPackagePath),
    taskPackageSha256: sha256File(taskPackagePath),
    sourceConditionPackPath: sample.sourceConditionPackPath,
    sourceConditionPackSha256: sample.sourceConditionPackSha256,
    focalAreaNonZeroCount,
    matchedForbiddenSemanticPatterns: matchedPatterns,
    presetHomeSiteSemanticsDetected,
    historicalEvidenceRetained: true,
    currentEngineeringTrainingEligible: !presetHomeSiteSemanticsDetected,
    currentFormalV7TrainingEligible: false,
  }
}

function collectActiveSemanticMatches(value, keyPath = "") {
  if (value === null || value === undefined) return []
  if (typeof value === "string") {
    if (/(^|\.)(mustNotShow|forbidden|forbiddenLayouts)(\.|$)/i.test(keyPath)) return []
    return FORBIDDEN_PATTERNS
      .filter((pattern) => pattern.test(value))
      .map((pattern) => `${keyPath}:${pattern.source}`)
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectActiveSemanticMatches(entry, `${keyPath}.${index}`))
  }
  if (typeof value !== "object") return []
  return Object.entries(value).flatMap(([key, entry]) => (
    collectActiveSemanticMatches(entry, keyPath ? `${keyPath}.${key}` : key)
  ))
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function verifyFileHash(value, expected, message) {
  assert(sha256File(value) === expected, message)
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveProjectPath(value))).digest("hex")
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  assert(fs.existsSync(resolved), `required file is missing: ${value}`)
  return resolved
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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
const AUDIT_LATEST_PATH = ".runtime/ai-painter/ai-assisted-v7-transform-duplicate-audits/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-capacity-reclassifications"
const AUTHORIZATION_ID = "owner-authorized-transform-derived-capacity-suspension-and-sakaerat-engineering-pretrain-20260724"

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `ai-assisted-v7-capacity-reclassification-${createdAtUtc.replace(/[:.]/g, "-")}`

const auditLatest = readJson(AUDIT_LATEST_PATH)
assert(auditLatest.status === "blocked_pending_owner_duplicate_reclassification", "transform audit is not waiting for reclassification")
assert(fileSha256(auditLatest.reportPath) === auditLatest.reportSha256, "transform audit report hash mismatch")

const audit = readJson(auditLatest.reportPath)
const suspendedRecords = audit.transformDerivedRecords
  .filter((record) => record.status === "ai_assisted_cold_start_eligible")
  .map((record) => verifyRegisteredContribution(record))
  .sort((left, right) => left.capacitySlotId.localeCompare(right.capacitySlotId))

assert(suspendedRecords.length === 17, `expected 17 owner-approved transform-derived records, received ${suspendedRecords.length}`)
assert(new Set(suspendedRecords.map((record) => record.recordId)).size === suspendedRecords.length, "duplicate suspended record identity")
assert(new Set(suspendedRecords.map((record) => record.capacitySlotId)).size === suspendedRecords.length, "duplicate suspended capacity slot identity")

const record = {
  schemaVersion: "ai-assisted-v7-capacity-reclassification-v1",
  runId,
  status: "owner_suspended_transform_derived_capacity_contributions",
  createdAtUtc,
  createdAtAsiaShanghai,
  authorization: {
    authorizationId: AUTHORIZATION_ID,
    authorizedBy: "project_owner",
    decision: "retain immutable history but suspend formal V7 capacity contribution eligibility for every previously owner-approved transform-derived record",
  },
  sourceAudit: {
    runId: auditLatest.runId,
    reportPath: auditLatest.reportPath,
    reportSha256: auditLatest.reportSha256,
    transformDerivedOwnerAcceptedCount: audit.summary.transformDerivedOwnerAcceptedCount,
  },
  reclassification: {
    suspendedRecordCount: suspendedRecords.length,
    suspendedCapacitySlotCount: suspendedRecords.length,
    capacityContributionAllowed: false,
    formalV7TrainingEligible: false,
    engineeringPretrainingEligible: false,
    historicalEvidenceRetained: true,
    ownerReviewHistoryRetained: true,
    sourceImagesDeleted: false,
    sourceRecordsModified: false,
  },
  suspendedRecords,
  executionBoundary: {
    imagesGenerated: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    trainingStarted: false,
    runtimeEligibilityGranted: false,
    formalInferenceEligibilityGranted: false,
  },
  nextRequiredAction: "rebuild_capacity_plan_from_21_current_pairs_plus_independent_v7_slots_001_002_003_033_034",
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
    suspendedRecordCount: suspendedRecords.length,
    suspendedCapacitySlotIds: suspendedRecords.map((entry) => entry.capacitySlotId),
    sourceAuditPath: auditLatest.reportPath,
    sourceAuditSha256: auditLatest.reportSha256,
    capacityContributionAllowed: false,
    formalV7TrainingEligible: false,
    currentBatchMayResume: false,
    v7GpuTrainingMayStart: false,
  },
})

const evidenceSha256 = fileSha256(written.runPath)
appendAiPainterProgramEvent({
  status: "blocked",
  stage: "ai_assisted_v7_capacity_reclassification",
  action: "suspend_transform_derived_capacity_contributions",
  runId,
  titleZh: "17 条共享骨架或镜像变换派生记录已由程序暂停 V7 容量资格",
  titleEn: "The program suspended V7 capacity eligibility for 17 shared-skeleton or mirror-derived records",
  summaryZh: "历史图片、审核和容量登记证据全部保留且未改写；17 条记录不再计入正式 V7 容量，也不进入 26 图工程预训练集。未生成图片，未启动 GPU 训练。",
  summaryEn: "All historical images, reviews, and contribution evidence remain immutable. The 17 records no longer count toward formal V7 capacity and are excluded from the 26-map engineering pretraining set. No image generation or GPU training started.",
  evidence: [written.runPath, auditLatest.reportPath],
  evidencePath: written.runPath,
  evidenceSha256,
  errorCode: "transform_derived_capacity_contributions_suspended",
})

console.log(JSON.stringify({
  status: record.status,
  runId,
  reclassificationPath: written.runPath,
  reclassificationSha256: evidenceSha256,
  suspendedRecordCount: suspendedRecords.length,
  suspendedCapacitySlotIds: suspendedRecords.map((entry) => entry.capacitySlotId),
  imagesGenerated: 0,
  gpuTrainingStarted: false,
}, null, 2))

function verifyRegisteredContribution(record) {
  const contributionPath = findContributionPath(record.capacitySlotId)
  const contribution = readJson(contributionPath)
  assert(contribution.recordId === record.recordId, `contribution record mismatch: ${record.recordId}`)
  assert(contribution.capacitySlotId === record.capacitySlotId, `contribution slot mismatch: ${record.capacitySlotId}`)
  assert(contribution.imageSha256 === record.imageSha256, `contribution image mismatch: ${record.recordId}`)
  return {
    recordId: record.recordId,
    capacitySlotId: record.capacitySlotId,
    imagePath: record.imagePath,
    imageSha256: record.imageSha256,
    taskPackagePath: record.taskPackagePath,
    transformDerivations: record.transformDerivations,
    contributionPath,
    contributionSha256: fileSha256(contributionPath),
    previousOwnerReviewStatus: "owner_approved",
    historicalCapacityRegistrationRetained: true,
    currentCapacityContributionAllowed: false,
    currentFormalV7TrainingEligible: false,
  }
}

function findContributionPath(capacitySlotId) {
  const root = path.resolve(ROOT, ".runtime", "ai-painter", "ai-assisted-v7-capacity-contributions")
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(`contribution-${capacitySlotId}-`))
    .map((entry) => path.join(root, entry.name, "contribution.json"))
    .filter((entry) => fs.existsSync(entry))
  assert(candidates.length === 1, `expected one immutable contribution for ${capacitySlotId}, received ${candidates.length}`)
  return projectPath(candidates[0])
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function fileSha256(value) {
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

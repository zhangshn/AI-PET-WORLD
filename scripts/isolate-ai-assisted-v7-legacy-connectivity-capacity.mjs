import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const AUDIT_LATEST_PATH =
  ".runtime/ai-painter/ai-assisted-v7-qualified-condition-topology-audits/latest.json"
const DIAGNOSIS_LATEST_PATH =
  ".runtime/ai-painter/ai-assisted-v7-qualified-topology-diagnostics/latest.json"
const OUTPUT_ROOT =
  ".runtime/ai-painter/ai-assisted-v7-legacy-connectivity-capacity-isolations"
const AUTHORIZATION_ID =
  "owner-authorized-isolate-legacy40-and-rebuild-thailand-mvp64-20260729"

const auditLatest = readJson(AUDIT_LATEST_PATH)
const audit = readJson(auditLatest.runPath)
const diagnosisLatest = readJson(DIAGNOSIS_LATEST_PATH)
const diagnosis = readJson(diagnosisLatest.runPath)
const isolatedRecordIds = audit.results.map((entry) => entry.recordId)

assert(
  audit.schemaVersion ===
    "ai-assisted-v7-qualified-connectivity-theme-detail-audit-v2",
  "structural re-audit schema mismatch",
)
assert(
  audit.summary.auditedRecordCount === 40 &&
    audit.summary.passedRecordCount === 0 &&
    audit.summary.structurallyReverifiedTrainingTruthCount === 0,
  "structural re-audit result does not authorize legacy40 isolation",
)
assert(
  isolatedRecordIds.length === 40 &&
    new Set(isolatedRecordIds).size === 40,
  "legacy isolation identities must contain exactly 40 unique records",
)
assert(
  diagnosis.summary?.diagnosedFindingRecordCount === 40 &&
    diagnosis.summary?.ownerDecisionRequired === true,
  "RGB diagnosis does not match the authorized owner decision",
)

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId =
  `ai-assisted-v7-legacy-connectivity-capacity-isolation-` +
  createdAtUtc.replace(/[:.]/g, "-")
const report = {
  schemaVersion:
    "ai-assisted-v7-legacy-connectivity-capacity-isolation-v1",
  runId,
  status:
    "owner_isolated_legacy40_from_current_v7_training_capacity",
  createdAtUtc,
  createdAtAsiaShanghai,
  authorization: {
    authorizationId: AUTHORIZATION_ID,
    authorizedBy: "project_owner",
    command: "允许",
    commandContext:
      "isolate all historical 40 records as history/failure learning and rebuild 64 compliant capacity records from the Thailand MVP real-Earth source package; RGB remains individually authorized",
    authorizedAtUtc: createdAtUtc,
    authorizedAtAsiaShanghai: createdAtAsiaShanghai,
  },
  sourceAudit: {
    runId: audit.runId,
    path: auditLatest.runPath,
    sha256: sha256File(auditLatest.runPath),
    auditedRecordCount: audit.summary.auditedRecordCount,
    passedRecordCount: audit.summary.passedRecordCount,
  },
  sourceRgbDiagnosis: {
    runId: diagnosis.runId,
    path: diagnosisLatest.runPath,
    sha256: sha256File(diagnosisLatest.runPath),
    diagnosedFindingRecordCount:
      diagnosis.summary.diagnosedFindingRecordCount,
    currentQualifiedDuplicateExcessCount:
      diagnosis.summary.currentQualifiedDuplicateExcessCount,
  },
  isolation: {
    isolatedRecordCount: isolatedRecordIds.length,
    isolatedRecordIds,
    currentTrainingCapacityContributionAllowed: false,
    currentFormalV7TrainingEligible: false,
    historicalImagesRetained: true,
    historicalReviewsRetained: true,
    historicalHashesRetained: true,
    historicalCapacityContributionsRetainedAsEvidence: true,
    failureLearningEligible: true,
    sourceRecordsModified: false,
    ownerReviewsModified: false,
    historicalContributionFilesModified: false,
  },
  replacementPlan: {
    requiredCompliantRecordCount: 64,
    slotRange: {
      first: "v7-capacity-slot-146",
      last: "v7-capacity-slot-209",
    },
    sourceScope:
      "Thailand / Sakaerat-Wang Nam Khiao / MVP only",
    realEarthRegionSourcePackageRequired: true,
    independentRegionConnectivityRequired: true,
    perWindowWorldFactDerivationRequired: true,
    themeArchitectureIdentityRequired: true,
    instanceDetailIdentityRequired: true,
    rgbAuthorizationMode: "one_record_at_a_time_owner_authorization",
  },
  executionBoundary: {
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    trainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
  automaticStorage: true,
}

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "isolation-report.json",
  record: report,
  latest: {
    status: report.status,
    authorizationId: AUTHORIZATION_ID,
    isolatedRecordCount: isolatedRecordIds.length,
    structurallyReverifiedTrainingTruthCount: 0,
    requiredCompliantRecordCount: 64,
    firstReplacementSlotId: "v7-capacity-slot-146",
    lastReplacementSlotId: "v7-capacity-slot-209",
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
})
const reportSha256 = sha256File(stored.runPath)

appendAiPainterProgramEvent({
  action: "isolate_v7_legacy_connectivity_capacity",
  runId,
  kind: "capacity_reclassification_completed",
  status: "success",
  stage: "legacy40_isolated_rebuild64_authorized",
  title:
    "The legacy 40 records were isolated from current V7 training capacity",
  titleZh: "历史40条记录已退出当前V7训练容量",
  detail:
    "All original files, reviews, hashes, and historical contributions were retained. A new 64-record Thailand MVP rebuild is authorized without batch RGB or GPU training.",
  detailZh:
    "原图、审核、哈希和历史贡献全部保留；已授权基于泰国MVP数据重建64条，但未授权批量RGB或GPU训练。",
  evidencePath: stored.runPath,
  evidenceSha256: reportSha256,
  evidence: [
    stored.runPath,
    auditLatest.runPath,
    diagnosisLatest.runPath,
  ],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  runId,
  status: report.status,
  reportPath: stored.runPath,
  reportSha256,
  authorizationId: AUTHORIZATION_ID,
  isolatedRecordCount: isolatedRecordIds.length,
  structurallyReverifiedTrainingTruthCount: 0,
  requiredCompliantRecordCount: 64,
  replacementSlotRange: "v7-capacity-slot-146..209",
  imageGenerationStarted: false,
  rgbCreated: false,
  gpuTrainingStarted: false,
}, null, 2))

function readJson(value) {
  return JSON.parse(
    fs.readFileSync(resolveProjectPath(value), "utf8"),
  )
}

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolveProjectPath(value)))
    .digest("hex")
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(
    resolved === ROOT ||
      resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${value}`,
  )
  return resolved
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

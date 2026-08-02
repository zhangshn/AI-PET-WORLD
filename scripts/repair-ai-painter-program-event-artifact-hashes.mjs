import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  closeStorageCatalog,
  indexArtifact,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const OWNER_COMMAND_REF =
  "project-owner-authorized-slot-123-pre-rgb-gate-sqlite-sha256-repair-20260728"
const REPAIR_ROOT =
  ".runtime/ai-painter/ai-painter-program-event-artifact-hash-repairs"
const AUDIT_LATEST_PATH =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits/latest.json"
const PREPARATION_FAILURE_LATEST_PATH =
  ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/preparation-failures/latest.json"

const auditLatest = readJson(AUDIT_LATEST_PATH)
const preparationFailureLatest = readJson(
  PREPARATION_FAILURE_LATEST_PATH,
)
assert(
  auditLatest.sourceRecordId === "v7-capacity-slot-123" &&
    auditLatest.passed === false &&
    auditLatest.matchedRecordIds?.includes(
      "ai-cold-start-v7-v7-capacity-slot-122-river-floodplain-v2",
    ),
  "the expected slot-123 pre-RGB duplicate audit is not latest",
)
assert(
  preparationFailureLatest.sourceRecordId ===
    "v7-capacity-slot-123",
  "the expected slot-123 preparation failure is not latest",
)

const targets = [
  {
    logicalPath: auditLatest.runPath,
    runId: auditLatest.runId,
  },
  {
    logicalPath: AUDIT_LATEST_PATH,
    runId: auditLatest.runId,
  },
  {
    logicalPath: preparationFailureLatest.runPath,
    runId: preparationFailureLatest.runId,
  },
]
const database = openStorageCatalog()
const selectArtifact = database.prepare(
  "SELECT logical_path, run_id, byte_size, modified_at_utc, sha256 " +
    "FROM artifacts WHERE logical_path = ?",
)
const before = targets.map((target) => {
  const row = selectArtifact.get(target.logicalPath)
  assert(row, `SQLite artifact is missing: ${target.logicalPath}`)
  return row
})
assert(
  before.every((entry) => !entry.sha256),
  "one of the bounded repair targets already has a SHA-256",
)

const immutableFileHashesBefore = Object.fromEntries(
  targets.map((target) => [
    target.logicalPath,
    sha256File(resolveProjectPath(target.logicalPath)),
  ]),
)
for (const target of targets) {
  const filePath = resolveProjectPath(target.logicalPath)
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: target.runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: immutableFileHashesBefore[target.logicalPath],
  })
}
const after = targets.map((target) =>
  selectArtifact.get(target.logicalPath),
)
for (const row of after) {
  assert(
    row.sha256 === immutableFileHashesBefore[row.logical_path],
    `SQLite SHA-256 backfill failed: ${row.logical_path}`,
  )
}
const immutableFileHashesAfter = Object.fromEntries(
  targets.map((target) => [
    target.logicalPath,
    sha256File(resolveProjectPath(target.logicalPath)),
  ]),
)
assert(
  JSON.stringify(immutableFileHashesBefore) ===
    JSON.stringify(immutableFileHashesAfter),
  "bounded evidence files changed during SQLite backfill",
)

const createdAtUtc = new Date().toISOString()
const runId =
  `ai-painter-program-event-artifact-hash-repair-slot-123-` +
  createdAtUtc.replace(/[:.]/g, "-")
const report = {
  schemaVersion:
    "ai-painter-program-event-artifact-hash-repair-v1",
  runId,
  status: "completed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: OWNER_COMMAND_REF,
  repairedTargetCount: targets.length,
  targets,
  before,
  after,
  immutableFileHashesBefore,
  immutableFileHashesAfter,
  rootCause:
    "ai-painter-program-event-store indexWrittenArtifact omitted the sha256 field.",
  rootCauseZh:
    "ai-painter-program-event-store的indexWrittenArtifact未传入sha256字段。",
  repairScope: {
    commonWriterNowComputesSha256: true,
    boundedExistingRowsBackfilled: true,
    historicalBulkScanPerformed: false,
    artifactFilesModified: false,
    mapConditionsModified: false,
    reviewThresholdsModified: false,
    imageGenerated: false,
    gpuTrainingStarted: false,
  },
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: REPAIR_ROOT,
  runId,
  fileName: "repair-report.json",
  record: report,
  latest: {
    repairedTargetCount: targets.length,
    sourceRecordId: "v7-capacity-slot-123",
  },
})
const event = appendAiPainterProgramEvent({
  action: "repair_ai_painter_program_event_artifact_hashes",
  runId,
  kind: "storage_index_repair",
  status: "success",
  title: "The bounded missing SQLite artifact hashes were repaired",
  titleZh: "本次有界SQLite产物缺失哈希已修复",
  detail:
    "Three exact slot-123 pre-RGB gate evidence rows were backfilled without modifying their files.",
  detailZh:
    "已精确回填slot-123生成前门禁的3条证据索引，未修改证据文件。",
  script:
    "scripts/repair-ai-painter-program-event-artifact-hashes.mjs",
  currentStep: "sqlite_artifact_sha256_backfill_completed",
  evidencePath: written.runPath,
  evidence: [written.runPath, ...targets.map((entry) => entry.logicalPath)],
})

const repairReportRow = selectArtifact.get(written.runPath)
assert(
  repairReportRow?.sha256 ===
    sha256File(resolveProjectPath(written.runPath)),
  "the repaired common writer did not index the repair report hash",
)

console.log(
  JSON.stringify(
    {
      status: report.status,
      runId,
      repairedTargetCount: targets.length,
      repairedPaths: targets.map((entry) => entry.logicalPath),
      reportPath: written.runPath,
      reportSha256: repairReportRow.sha256,
      ledgerEventId: event.id,
      imageGenerated: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
)
closeStorageCatalog()

function readJson(value) {
  return JSON.parse(
    fs.readFileSync(resolveProjectPath(value), "utf8"),
  )
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

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(value))
    .digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(
  ROOT,
  "data",
  "world-samples",
  "original-image-library",
  "natural-home-v1",
)
const INDEX_PATH = path.join(LIBRARY_ROOT, "index.json")
const V7_RECORD_PATTERN = /^ai-cold-start-v7-v7-capacity-slot-(\d{3})(?:-|$)/
const timestamp = new Date().toISOString()
const runId = `ai-assisted-v7-original-image-catalog-repair-${timestamp.replace(/[:.]/g, "-")}`

const index = readJson(INDEX_PATH)
const records = index.records ?? []
const existingSequences = records
  .map((record) => record.autonomousGenerationTrainingOriginal?.sequenceNumber)
  .filter((value) => Number.isInteger(value) && value > 0)
const usedSequences = new Set(existingSequences)
let nextSequence = Math.max(0, ...existingSequences) + 1

const repairTargets = records
  .filter((record) => V7_RECORD_PATTERN.test(record.recordId))
  .filter((record) => record.status !== "rejected")
  .filter((record) => record.reviews?.ownerReviewStatus === "owner_approved")
  .filter((record) => !record.autonomousGenerationTrainingOriginal?.sequenceNumber)
  .sort((left, right) => slotNumber(left.recordId) - slotNumber(right.recordId))

const repaired = []
for (const indexedRecord of repairTargets) {
  while (usedSequences.has(nextSequence)) nextSequence += 1
  const sequenceNumber = nextSequence
  usedSequences.add(sequenceNumber)
  nextSequence += 1

  const recordPath = resolveProjectPath(indexedRecord.recordPath)
  const record = readJson(recordPath)
  assert(record.recordId === indexedRecord.recordId, `record identity mismatch: ${indexedRecord.recordId}`)
  assert(record.reviews?.ownerReviewStatus === "owner_approved", `owner review is not approved: ${record.recordId}`)

  const ownerReviewPath = record.reviews?.ownerReviewPath ?? null
  const ownerReview = ownerReviewPath ? readJson(resolveProjectPath(ownerReviewPath)) : null
  const sequenceLabel = autonomousSequenceLabel(sequenceNumber)
  const autonomousMetadata = {
    contractVersion: "autonomous-generation-training-original-v1",
    sequenceNumber,
    sequenceLabel,
    ownerReviewDecision: "owner_approved",
    ownerCommandRef: ownerReview?.ownerCommandRef ?? "program-catalog-repair-existing-owner-review",
    ownerReviewPath,
  }
  const updatedRecord = {
    ...record,
    title: `${sequenceLabel}: ${record.classification?.regionalLandscapeType ?? record.recordId}`,
    classification: {
      ...record.classification,
      knowledgeRole: "autonomous_generation_complete_game_map_training_original",
    },
    autonomousGenerationTrainingOriginal: autonomousMetadata,
    updatedAtUtc: timestamp,
    updatedAtAsiaShanghai: formatShanghai(timestamp),
  }
  writeJsonAtomic(recordPath, updatedRecord)

  const indexPosition = records.findIndex((item) => item.recordId === record.recordId)
  records[indexPosition] = {
    ...records[indexPosition],
    title: updatedRecord.title,
    classification: updatedRecord.classification,
    autonomousGenerationTrainingOriginal: autonomousMetadata,
    updatedAtUtc: updatedRecord.updatedAtUtc,
    updatedAtAsiaShanghai: updatedRecord.updatedAtAsiaShanghai,
  }
  repaired.push({
    recordId: record.recordId,
    capacitySlotId: `v7-capacity-slot-${String(slotNumber(record.recordId)).padStart(3, "0")}`,
    sequenceNumber,
    recordPath: projectPath(recordPath),
    recordSha256: sha256File(recordPath),
    ownerReviewPath,
  })
}

writeJsonAtomic(INDEX_PATH, {
  ...index,
  updatedAt: timestamp,
  records,
})

const report = {
  schemaVersion: "ai-assisted-v7-original-image-catalog-repair-v1",
  runId,
  status: "completed",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  v7RecordCount: records.filter((record) => V7_RECORD_PATTERN.test(record.recordId)).length,
  repairedRecordCount: repaired.length,
  repaired,
  indexPath: projectPath(INDEX_PATH),
  indexSha256: sha256File(INDEX_PATH),
  automaticStorage: true,
  generatedImages: 0,
  gpuTrainingStarted: false,
}
const run = writeImmutableProgramRun({
  root: ".runtime/ai-painter/ai-assisted-v7-original-image-catalog-repairs",
  runId,
  fileName: "repair-report.json",
  record: report,
  latest: {
    status: report.status,
    repairedRecordCount: report.repairedRecordCount,
    indexPath: report.indexPath,
    indexSha256: report.indexSha256,
  },
})
appendAiPainterProgramEvent({
  runId,
  status: "success",
  stage: "ai_assisted_v7_original_image_catalog_repair",
  action: "repair_v7_original_image_catalog",
  kind: "catalog_repair",
  titleZh: "V7 原图目录历史序号与索引已由程序修复",
  titleEn: "The program repaired the V7 original-image historical sequences and index",
  summaryZh: `程序为 ${repaired.length} 条已通过但缺少自主序号的 V7 原图补齐元数据；未生成图片，也未启动 GPU 训练。`,
  summaryEn: `The program backfilled metadata for ${repaired.length} owner-approved V7 originals that lacked autonomous sequence numbers. No image was generated and no GPU training was started.`,
  evidence: [run.runPath, report.indexPath],
})

console.log(JSON.stringify({ ...report, reportPath: run.runPath }, null, 2))

function autonomousSequenceLabel(sequenceNumber) {
  return `\u81ea\u4e3b\u751f\u6210\u8bad\u7ec3\u539f\u56fe\u7b2c${String(sequenceNumber).padStart(3, "0")}\u5f20`
}
function slotNumber(recordId) {
  const match = recordId.match(V7_RECORD_PATTERN)
  assert(match, `V7 capacity slot identity missing: ${recordId}`)
  return Number(match[1])
}
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  return resolved
}
function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}
function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}
function writeJsonAtomic(value, body) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const temporary = `${value}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(body, null, 2)}\n`)
  fs.renameSync(temporary, value)
}
function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const recordId = argumentValue("--record-id")
const categoryId = argumentValue("--category-id") ?? "complete-maps"
const decision = argumentValue("--decision")
const ownerCommandRef = argumentValue("--owner-command-ref")
const comment = argumentValue("--comment") ?? ""

assert(recordId && /^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "--record-id is required")
assert(["approved", "rejected"].includes(decision), "--decision must be approved or rejected")
assert(ownerCommandRef, "--owner-command-ref is required")

const recordPath = findRecordPath(categoryId, recordId)
assert(fs.existsSync(recordPath), "AI cold-start original image record is missing")
const record = readJson(recordPath)
assert(record.categoryId === categoryId, "record category mismatch")
assert(record.aiAssistedColdStart?.policyVersion === "owner-authorized-ai-assisted-cold-start-v1", "record is not in the authorized AI cold-start lane")
assert(record.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", "owner approval requires a passed machine contract review")

const timestamp = new Date().toISOString()
const approved = decision === "approved"
const review = {
  schemaVersion: "ai-assisted-cold-start-owner-review-v1",
  reviewId: `ai-cold-start-owner-review-${recordId}-${timestamp.replace(/[:.]/g, "-")}`,
  recordId,
  reviewerRole: "project_owner",
  decision: approved ? "owner_approved" : "owner_rejected",
  ownerCommandRef,
  comment,
  imagePath: `${record.relativeDirectory}/source/original.png`,
  imageSha256: record.originalImage.sha256,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  aiAssistedColdStartEligible: approved,
  independentTrainingEligible: false,
  gameUseContract: {
    role: "rgb_visual_training_original",
    directWorldDisplayAllowed: false,
    directRuntimeFrameUseAllowed: false,
    requiresWorldFactsAnd23ChannelBinding: true,
    requiresWalkableCollisionAndObjectIdentityLayers: true,
  },
  automaticStorage: true,
}
const reviewPath = path.join(path.dirname(recordPath), "reviews", "owner-review.json")
writeJsonAtomic(reviewPath, review)

const updatedRecord = {
  ...record,
  status: approved ? "ai_assisted_cold_start_eligible" : "rejected",
  blockReasons: approved ? [] : ["owner_visual_review_rejected"],
  reviews: {
    ...record.reviews,
    ownerReviewStatus: review.decision,
    ownerReviewPath: projectPath(reviewPath),
    ipReviewStatus: approved ? "owner_authorized_ai_cold_start_approved" : record.reviews.ipReviewStatus,
  },
  copiedArtifacts: {
    ...record.copiedArtifacts,
    reviews: [
      ...(record.copiedArtifacts?.reviews ?? []).filter((item) => item.path !== projectPath(reviewPath)),
      { path: projectPath(reviewPath), sha256: sha256File(reviewPath) },
    ],
  },
  trainingEligibility: approved ? "ai_assisted_cold_start_eligible" : "owner_rejected",
  aiAssistedColdStartEligible: approved,
  independentTrainingEligible: false,
  gameUseContract: review.gameUseContract,
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: formatShanghai(timestamp),
}
writeJsonAtomic(recordPath, updatedRecord)
updateIndex(updatedRecord)
appendJsonLine(path.join(LIBRARY_ROOT, "events.jsonl"), {
  schemaVersion: "original-image-library-event-v1",
  action: "ai_assisted_cold_start_owner_review_recorded",
  recordId,
  categoryId: updatedRecord.categoryId,
  decision: review.decision,
  status: updatedRecord.status,
  ownerCommandRef,
  reviewPath: projectPath(reviewPath),
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
})

console.log(JSON.stringify({ review, record: updatedRecord }, null, 2))

function updateIndex(value) {
  const indexPath = path.join(LIBRARY_ROOT, "index.json")
  const index = readJson(indexPath)
  const records = index.records.map((item) => item.recordId === value.recordId ? {
    ...item,
    status: value.status,
    blockReasons: value.blockReasons,
    reviews: value.reviews,
    trainingEligibility: value.trainingEligibility,
    aiAssistedColdStartEligible: value.aiAssistedColdStartEligible,
    independentTrainingEligible: false,
    updatedAtUtc: value.updatedAtUtc,
    updatedAtAsiaShanghai: value.updatedAtAsiaShanghai,
  } : item)
  writeJsonAtomic(indexPath, { ...index, updatedAt: value.updatedAtUtc, records })
}

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function findRecordPath(targetCategoryId, targetRecordId) {
  if (targetCategoryId === "complete-maps") return path.join(LIBRARY_ROOT, targetCategoryId, targetRecordId, "record.json")
  const categoryRoot = path.join(LIBRARY_ROOT, targetCategoryId)
  assert(fs.existsSync(categoryRoot), `original image category directory is missing: ${targetCategoryId}`)
  const matches = []
  collectRecordMatches(categoryRoot, targetRecordId, matches)
  assert(matches.length === 1, `expected one record for ${targetCategoryId}/${targetRecordId}, found ${matches.length}`)
  return matches[0]
}
function collectRecordMatches(directory, targetRecordId, matches) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    const child = path.join(directory, entry.name)
    if (entry.name === targetRecordId && fs.existsSync(path.join(child, "record.json"))) matches.push(path.join(child, "record.json"))
    else collectRecordMatches(child, targetRecordId, matches)
  }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJsonAtomic(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const temp = `${value}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`); fs.renameSync(temp, value) }
function appendJsonLine(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.appendFileSync(value, `${JSON.stringify(body)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }

import crypto from "node:crypto"
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const blueprintPointerPath = path.join(root, "data/world-samples/dataset-blueprints/latest-natural-home-complete-map.json")
const dictionaryPointerPath = path.join(root, "data/world-visual-data-dictionary/latest.json")
const auditRoot = path.join(root, "data/world-samples/dataset-blueprints/natural-home-complete-map-v0.2")
const auditPath = path.join(auditRoot, "data-sufficiency-audit.json")
const latestAuditPath = path.join(root, "data/world-samples/dataset-blueprints/latest-natural-home-complete-map-audit.json")

const sourcePaths = {
  ownerApprovedCompleteFrames: "data/world-approved-frames",
  ownerRejectedCompleteFrames: "data/world-rejected-frames",
  worldSamples: "data/world-samples",
  worldVisualCandidates: "data/world-visual-candidates",
  reviewDiagnostics: ".runtime/game-map-review-diagnostics",
  runtimeFrameRecords: ".runtime/game-map-runtime-frame",
  runtimeFrameCandidates: ".runtime/game-map-runtime-frame-candidates",
  materialSlotInferenceRuns: ".runtime/game-map-material-slot-inference-runs",
  trainingArchive: ".runtime/ai-painter/training-run-archive",
  routedExistingEvidence: "data/world-samples/routed-existing-evidence/natural-home-complete-map-v0.2",
  transitionCandidateCrops: "data/world-samples/transition-candidates/natural-home-complete-map-v0.2",
}

const minimums = {
  completeMapPositive: 20,
  completeMapNegative: 40,
  grassToPathPositive: 40,
  grassToPathNegative: 40,
  grassToWaterPositive: 40,
  grassToWaterNegative: 40,
  objectToGroundPositive: 30,
  objectToGroundNegative: 30,
  judgeGapRecords: 20,
}

const blueprintPointer = await readJsonIfExists(blueprintPointerPath)
const dictionaryPointer = await readJsonIfExists(dictionaryPointerPath)
assert(dictionaryPointer?.dictionaryVersionId, "current world visual dictionary pointer is missing")
const currentDictionaryVersion = dictionaryPointer.dictionaryVersionId

const allSourceCounts = {}
const sourceFiles = {}
for (const [key, relativePath] of Object.entries(sourcePaths)) {
  const files = await walkFiles(path.join(root, relativePath))
  sourceFiles[key] = files
  allSourceCounts[key] = {
    path: relativePath,
    files: files.length,
    images: files.filter(isImage).length,
    json: files.filter((file) => file.endsWith(".json")).length,
  }
}

const candidateRecordFiles = unique([
  ...sourceFiles.ownerApprovedCompleteFrames,
  ...sourceFiles.ownerRejectedCompleteFrames,
  ...sourceFiles.worldSamples,
  ...sourceFiles.reviewDiagnostics,
]).filter((file) => file.endsWith(".json"))

const validation = {
  completeMapPositive: [],
  completeMapNegative: [],
  grassToPathPositive: [],
  grassToPathNegative: [],
  grassToWaterPositive: [],
  grassToWaterNegative: [],
  objectToGroundPositive: [],
  objectToGroundNegative: [],
  judgeGapRecords: [],
}
const rejectedRecords = []

for (const file of candidateRecordFiles) {
  const record = await readJsonIfExists(file)
  if (!record) continue
  const classifications = classifyRecord(record)
  if (classifications.length === 0) continue
  const checked = await validateSampleRecord(record, file, currentDictionaryVersion)
  for (const classification of classifications) {
    if (checked.valid) {
      validation[classification].push({
        sampleId: checked.sampleId,
        imageSha256: checked.imageSha256,
        imagePath: checked.imagePath,
        recordPath: projectPath(file),
      })
    } else {
      rejectedRecords.push({
        classification,
        recordPath: projectPath(file),
        sampleId: checked.sampleId,
        reasons: checked.reasons,
      })
    }
  }
}

for (const key of Object.keys(validation)) {
  validation[key] = dedupeValidatedSamples(validation[key])
}

const observed = Object.fromEntries(Object.entries(validation).map(([key, records]) => [key, records.length]))
const gates = Object.entries(minimums).map(([key, minimum]) => {
  const current = observed[key] ?? 0
  return { gate: key, current, minimum, missing: Math.max(0, minimum - current), passed: current >= minimum }
})
const blockingGates = gates.filter((gate) => !gate.passed)
const generatedAt = new Date().toISOString()
const audit = {
  schemaVersion: "complete-map-data-sufficiency-audit-v2",
  auditId: `natural-home-complete-map-v0.2-${generatedAt.replace(/[:.]/g, "-")}`,
  generatedAt,
  timestampLocal: formatShanghai(generatedAt),
  blueprint: blueprintPointer,
  dictionaryVersionId: currentDictionaryVersion,
  countingContract: {
    mode: "unique_reviewed_image_sample_records",
    requires: [
      "unique_sample_id",
      "existing_image",
      "matching_image_sha256",
      "formal_sample_type",
      "required_labels",
      "review_status",
      "current_dictionary_version",
    ],
    forbiddenCounters: ["raw_file_count", "json_file_count", "path_keyword_match", "latest_alias_count"],
  },
  status: blockingGates.length === 0 ? "training_data_sufficient" : "blocked_insufficient_training_data",
  conclusion: blockingGates.length === 0
    ? "The complete-map dataset meets the strict unique reviewed image-sample minimums."
    : "The complete-map dataset is insufficient under strict image, hash, label, review, and dictionary-version validation.",
  sourceCounts: allSourceCounts,
  observed,
  validatedSamples: validation,
  invalidSampleRecordCount: rejectedRecords.length,
  invalidSampleRecords: rejectedRecords.slice(0, 200),
  gates,
  blockingGates,
  importantNotes: [
    "A JSON record without a retained image and matching image hash is not a visual training sample.",
    "Aliases, latest pointers, and historical copies are deduplicated by sample id and image hash.",
    "Path names are never used as transition or judge-gap labels.",
    "Material-slot images and pending candidates are not complete-map positives.",
  ],
}

await mkdir(auditRoot, { recursive: true })
await writeJson(auditPath, audit)
await writeJson(latestAuditPath, {
  schemaVersion: "complete-map-data-sufficiency-audit-latest-pointer-v2",
  auditId: audit.auditId,
  status: audit.status,
  generatedAt,
  auditPath: projectPath(auditPath),
  dictionaryVersionId: currentDictionaryVersion,
  blockingGateCount: blockingGates.length,
})

console.log(`Complete map data sufficiency audit written: ${projectPath(auditPath)}`)
console.log(`status=${audit.status}`)
console.log(`completeMapPositive=${observed.completeMapPositive}`)
console.log(`completeMapNegative=${observed.completeMapNegative}`)
console.log(`blockingGates=${blockingGates.length}`)

function classifyRecord(record) {
  const type = record.sampleType
  if (type === "complete_map_positive") return ["completeMapPositive"]
  if (type === "negative_sample" && record.sampleScope === "complete_map") return ["completeMapNegative"]
  if (type === "judge_gap_record") return ["judgeGapRecords"]
  if (type !== "transition_sample") return []
  const suffix = record.polarity === "positive" ? "Positive" : record.polarity === "negative" ? "Negative" : null
  if (!suffix) return []
  if (record.transitionId === "grass_to_path") return [`grassToPath${suffix}`]
  if (record.transitionId === "grass_to_water") return [`grassToWater${suffix}`]
  if (record.transitionId === "object_to_ground") return [`objectToGround${suffix}`]
  return []
}

async function validateSampleRecord(record, recordPath, dictionaryVersionId) {
  const reasons = []
  const sampleId = stringValue(record.sampleId)
  const imageRef = stringValue(record.imagePath)
  const expectedHash = stringValue(record.imageSha256 ?? record.sha256)
  const recordDictionary = stringValue(record.dictionaryVersionId ?? record.dictionaryVersion)
  if (!sampleId) reasons.push("sample_id_missing")
  if (!imageRef || !isImage(imageRef)) reasons.push("image_path_missing_or_not_image")
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) reasons.push("image_sha256_missing_or_invalid")
  if (recordDictionary !== dictionaryVersionId) reasons.push("dictionary_version_not_current")
  if (!hasRequiredReview(record)) reasons.push("required_review_status_missing")
  if (!hasRequiredLabels(record)) reasons.push("required_labels_missing")

  let imagePath = null
  if (imageRef && isImage(imageRef)) {
    imagePath = resolveEvidencePath(imageRef, recordPath)
    if (!(await fileExists(imagePath))) {
      reasons.push("image_file_missing")
    } else if (/^[a-f0-9]{64}$/i.test(expectedHash)) {
      const actualHash = crypto.createHash("sha256").update(await readFile(imagePath)).digest("hex")
      if (actualHash !== expectedHash.toLowerCase()) reasons.push("image_sha256_mismatch")
    }
  }
  return {
    valid: reasons.length === 0,
    sampleId,
    imageSha256: expectedHash.toLowerCase(),
    imagePath: imagePath ? projectPath(imagePath) : null,
    reasons,
  }
}

function hasRequiredReview(record) {
  if (record.sampleType === "complete_map_positive") return record.ownerApproval?.status === "approved"
  if (record.sampleType === "negative_sample") {
    return Boolean(record.rejectedBy) && record.mustNotTrainAsPositive === true && nonEmpty(record.failureCodes)
  }
  if (record.sampleType === "transition_sample") return ["approved", "rejected"].includes(record.reviewStatus)
  if (record.sampleType === "judge_gap_record") return record.machineDecision === "passed" && record.ownerDecision === "rejected"
  return false
}

function hasRequiredLabels(record) {
  if (record.sampleType === "complete_map_positive") return nonEmpty(record.visualTags) && nonEmpty(record.qualityTags)
  if (record.sampleType === "negative_sample") {
    return nonEmpty(record.failureCodes) && nonEmpty(record.failureRegions) && nonEmpty(record.rootCauses) && Boolean(record.nextTrainingTask)
  }
  if (record.sampleType === "transition_sample") return Boolean(record.transitionId) && nonEmpty(record.failureCodes ?? record.qualityTags)
  if (record.sampleType === "judge_gap_record") return nonEmpty(record.failureCodes) && Boolean(record.sourceReviewRecordId)
  return false
}

function dedupeValidatedSamples(records) {
  const seenIds = new Set()
  const seenHashes = new Set()
  return records.filter((record) => {
    if (seenIds.has(record.sampleId) || seenHashes.has(record.imageSha256)) return false
    seenIds.add(record.sampleId)
    seenHashes.add(record.imageSha256)
    return true
  })
}

function resolveEvidencePath(imageRef, recordPath) {
  if (path.isAbsolute(imageRef)) return path.normalize(imageRef)
  const fromRoot = path.resolve(root, imageRef)
  const fromRecord = path.resolve(path.dirname(recordPath), imageRef)
  return path.normalize(fromRoot === recordPath ? fromRecord : fromRoot)
}

async function walkFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name)
      if (entry.isDirectory()) files.push(...await walkFiles(filePath))
      else if (entry.isFile()) files.push(filePath)
    }
    return files
  } catch {
    return []
  }
}

async function readJsonIfExists(filePath) {
  try { return JSON.parse(await readFile(filePath, "utf8")) } catch { return null }
}

async function fileExists(filePath) {
  try { await access(filePath); return true } catch { return false }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function projectPath(filePath) {
  return path.relative(root, path.resolve(filePath)).replaceAll("\\", "/")
}

function isImage(name) {
  return /\.(png|jpg|jpeg)$/i.test(name)
}

function nonEmpty(value) {
  return Array.isArray(value) && value.length > 0
}

function stringValue(value) {
  return typeof value === "string" ? value : ""
}

function unique(values) {
  return [...new Set(values)]
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

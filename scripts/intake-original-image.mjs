import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  ORIGINAL_IMAGE_COLLECTION_ID,
  ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION,
  ORIGINAL_IMAGE_RECORD_SCHEMA_VERSION,
  directorySegmentsForRequest,
  isBlockedOriginalImageSource,
  isOwnerAuthorizedAiAssistedColdStartSource,
  isSafeOriginalImageId,
  validateOriginalImageIntakeRequest,
} from "./lib/original-image-library-contract.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", ORIGINAL_IMAGE_COLLECTION_ID)
const FAILURE_ROOT = path.join(ROOT, ".runtime", "ai-painter", "original-image-intake-rejections")
const startedAtUtc = new Date().toISOString()
let activeRequestPath = null
let activeRequest = null
let activeStagingDirectory = null
let activeFinalDirectory = null
let indexCommitted = false

let handlingFatalError = false
function handleFatalError(error) {
  if (handlingFatalError) process.exit(1)
  handlingFatalError = true
  if (activeStagingDirectory && fs.existsSync(activeStagingDirectory)) fs.rmSync(activeStagingDirectory, { recursive: true, force: true })
  if (!indexCommitted && activeFinalDirectory && fs.existsSync(activeFinalDirectory)) fs.rmSync(activeFinalDirectory, { recursive: true, force: true })
  const rejectionId = `original-image-intake-rejected-${startedAtUtc.replace(/[:.]/g, "-")}`
  const rejection = {
    schemaVersion: "original-image-intake-rejection-v1",
    rejectionId,
    status: "rejected_or_failed",
    timestampUtc: startedAtUtc,
    timestampAsiaShanghai: formatShanghai(startedAtUtc),
    requestPath: activeRequestPath ? projectPath(activeRequestPath) : null,
    requestedCategoryId: activeRequest?.categoryId ?? null,
    requestedTitle: activeRequest?.title ?? null,
    reason: error instanceof Error ? error.message : String(error),
    recordCreated: indexCommitted,
    indexUpdated: indexCommitted,
    automaticStorage: true,
  }
  const rejectionPath = path.join(FAILURE_ROOT, `${rejectionId}.json`)
  writeJson(rejectionPath, rejection)
  writeJson(path.join(FAILURE_ROOT, "latest.json"), { ...rejection, rejectionPath: projectPath(rejectionPath) })
  console.error(JSON.stringify(rejection, null, 2))
  process.exit(1)
}
process.on("uncaughtException", handleFatalError)
process.on("unhandledRejection", handleFatalError)

const requestArg = argumentValue("--request")
assert(requestArg, "usage: npm run intake:original-image -- --request <original-image-intake-request-v1.json>")
const requestPath = resolveProjectPath(requestArg)
const request = readJson(requestPath)
activeRequestPath = requestPath
activeRequest = request

const failures = validateOriginalImageIntakeRequest(request)
assert(failures.length === 0, `original image intake rejected: ${failures.join(", ")}`)

const visualSnapshotPath = resolveProjectPath(request.worldBinding.snapshotPath)
assert(fs.existsSync(visualSnapshotPath) && fs.statSync(visualSnapshotPath).isFile(), "visual snapshot does not exist")
const visualSnapshot = readJson(visualSnapshotPath)
assert(visualSnapshot.snapshotId === request.worldBinding.snapshotId, "visual snapshotId does not match request")
assert(visualSnapshot.worldProfileId === request.worldBinding.worldProfileId, "visual snapshot worldProfileId does not match request")
assert(visualSnapshot.biomeType === request.worldBinding.biomeType, "visual snapshot biomeType does not match request")
assert(visualSnapshot.isFinal === request.worldBinding.snapshotIsFinal, "visual snapshot finality does not match request")
if (isOwnerAuthorizedAiAssistedColdStartSource(request)) {
  const promptEvidencePath = resolveProjectPath(request.aiAssistedColdStart.promptEvidencePath)
  assert(fs.existsSync(promptEvidencePath) && fs.statSync(promptEvidencePath).isFile(), "AI cold-start prompt evidence does not exist")
}

const sourceImagePath = resolveProjectPath(request.imagePath)
assert(fs.existsSync(sourceImagePath) && fs.statSync(sourceImagePath).isFile(), "source image does not exist")
const imageBytes = fs.readFileSync(sourceImagePath)
const metadata = await sharp(imageBytes, { failOn: "error" }).metadata()
assert(metadata.width && metadata.height && metadata.format, "source image metadata is incomplete")
if (request.categoryId === "complete-maps") {
  const blockedSource = isBlockedOriginalImageSource(request)
  if (blockedSource) {
    assert(metadata.width * 3 === metadata.height * 4, "blocked complete-map concept reference must use a 4:3 canvas")
  } else {
    assert(metadata.width === 1024 && metadata.height === 768, "formal high-resolution pixel-style complete-map original must be exactly 1024x768")
  }
}

const imageSha256 = sha256(imageBytes)
const recordId = request.recordId ?? `${request.categoryId.replace(/s$/, "")}-${imageSha256.slice(0, 16)}`
assert(isSafeOriginalImageId(recordId), "recordId contains unsupported characters or length")
const segments = directorySegmentsForRequest(request)
for (const segment of segments) assert(isSafeOriginalImageId(segment), `unsafe directory segment: ${segment}`)

const categoryDirectory = path.join(LIBRARY_ROOT, ...segments)
const recordDirectory = path.join(categoryDirectory, recordId)
const stagingDirectory = path.join(categoryDirectory, `.${recordId}-${process.pid}.tmp`)
const recordPath = path.join(recordDirectory, "record.json")
const archivedRequestPath = path.join(recordDirectory, "request.json")
const imageExtension = normalizeImageExtension(sourceImagePath)
const storedImagePath = path.join(recordDirectory, "source", `original${imageExtension}`)
const stagingRecordPath = path.join(stagingDirectory, "record.json")
const stagingRequestPath = path.join(stagingDirectory, "request.json")
const stagingImagePath = path.join(stagingDirectory, "source", `original${imageExtension}`)
const indexPath = path.join(LIBRARY_ROOT, "index.json")
const libraryManifestPath = path.join(LIBRARY_ROOT, "library.json")
const existingIndex = readIndex(indexPath)
const duplicate = existingIndex.records.find((record) => record.originalImage?.sha256 === imageSha256)
if (duplicate) {
  const storedRecord = readJson(resolveProjectPath(duplicate.recordPath))
  const hydratedRecords = existingIndex.records.map((item) => item.recordId === duplicate.recordId
    ? hydrateIndexRecord(item, storedRecord)
    : item)
  const hydratedIndex = { ...existingIndex, updatedAt: startedAtUtc, records: hydratedRecords }
  writeJsonAtomic(indexPath, hydratedIndex)
  updateLibraryManifest(libraryManifestPath, hydratedRecords, startedAtUtc)
  console.log(JSON.stringify({ status: "already_intaked", recordId: duplicate.recordId, recordPath: duplicate.recordPath, imageSha256 }, null, 2))
  process.exit(0)
}
assert(!fs.existsSync(recordDirectory), `record directory already exists: ${projectPath(recordDirectory)}`)
assert(!fs.existsSync(stagingDirectory), `staging directory already exists: ${projectPath(stagingDirectory)}`)
activeStagingDirectory = stagingDirectory
activeFinalDirectory = recordDirectory

const copiedArtifacts = {
  layers: copyEvidenceFiles(request.layerFiles, path.join(stagingDirectory, "layers"), path.join(recordDirectory, "layers")),
  conditions: copyEvidenceFiles(request.conditionFiles, path.join(stagingDirectory, "conditions"), path.join(recordDirectory, "conditions")),
  rights: copyEvidenceFiles(request.rightsFiles, path.join(stagingDirectory, "rights"), path.join(recordDirectory, "rights")),
  reviews: copyEvidenceFiles(request.reviewFiles, path.join(stagingDirectory, "reviews"), path.join(recordDirectory, "reviews")),
}
fs.mkdirSync(path.dirname(stagingImagePath), { recursive: true })
fs.copyFileSync(sourceImagePath, stagingImagePath, fs.constants.COPYFILE_EXCL)
fs.copyFileSync(requestPath, stagingRequestPath, fs.constants.COPYFILE_EXCL)

const createdAtUtc = new Date().toISOString()
const blocked = isBlockedOriginalImageSource(request)
const aiAssistedColdStart = isOwnerAuthorizedAiAssistedColdStartSource(request)
const record = {
  schemaVersion: ORIGINAL_IMAGE_RECORD_SCHEMA_VERSION,
  recordId,
  collectionId: ORIGINAL_IMAGE_COLLECTION_ID,
  categoryId: request.categoryId,
  title: request.title.trim(),
  status: blocked ? "blocked" : aiAssistedColdStart ? "ai_assisted_cold_start_intake" : "intake",
  blockReasons: blocked ? sourceBlockReasons(request) : [],
  originalImage: {
    path: projectRelativeTo(recordDirectory, storedImagePath),
    fileName: path.basename(sourceImagePath),
    sha256: imageSha256,
    mediaType: mediaTypeForExtension(imageExtension),
    width: metadata.width,
    height: metadata.height,
    byteLength: imageBytes.length,
    originalInputPath: projectPath(sourceImagePath),
  },
  source: request.source,
  aiAssistedColdStart: request.aiAssistedColdStart ?? null,
  conditionBinding: request.conditionBinding ?? null,
  rebuild64Sequence: request.rebuild64Sequence ?? null,
  worldBinding: request.worldBinding ?? {},
  classification: request.classification,
  reviews: {
    machineReviewStatus: "not_started",
    ownerReviewStatus: "pending_review",
    ipReviewStatus: blocked ? "blocked_by_source" : aiAssistedColdStart ? "owner_authorized_ai_cold_start_pending_review" : "pending_review",
  },
  copiedArtifacts,
  requestPath: projectPath(archivedRequestPath),
  recordPath: projectPath(recordPath),
  relativeDirectory: projectPath(recordDirectory),
  trainingEligibility: aiAssistedColdStart ? "ai_assisted_cold_start_pending_review" : "not_yet_registered",
  independentTrainingEligible: false,
  aiAssistedColdStartEligible: false,
  registeredSampleId: null,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  updatedAtUtc: createdAtUtc,
  updatedAtAsiaShanghai: formatShanghai(createdAtUtc),
  automaticStorage: true,
}
writeJson(stagingRecordPath, record)

const indexRecord = {
  recordId: record.recordId,
  categoryId: record.categoryId,
  title: record.title,
  status: record.status,
  originalImage: record.originalImage,
  source: record.source,
  aiAssistedColdStart: record.aiAssistedColdStart,
  conditionBinding: record.conditionBinding,
  rebuild64Sequence: record.rebuild64Sequence,
  worldBinding: record.worldBinding,
  classification: record.classification,
  createdAtUtc: record.createdAtUtc,
  createdAtAsiaShanghai: record.createdAtAsiaShanghai,
  updatedAtUtc: record.updatedAtUtc,
  updatedAtAsiaShanghai: record.updatedAtAsiaShanghai,
  relativeDirectory: record.relativeDirectory,
  recordPath: record.recordPath,
}

function hydrateIndexRecord(indexRecord, storedRecord) {
  return {
    ...indexRecord,
    source: storedRecord.source ?? null,
    aiAssistedColdStart: storedRecord.aiAssistedColdStart ?? null,
    conditionBinding: storedRecord.conditionBinding ?? null,
    rebuild64Sequence: storedRecord.rebuild64Sequence ?? null,
    worldBinding: storedRecord.worldBinding ?? {},
    classification: storedRecord.classification ?? {},
  }
}
const nextIndex = {
  schemaVersion: ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION,
  collectionId: ORIGINAL_IMAGE_COLLECTION_ID,
  updatedAt: createdAtUtc,
  records: [...existingIndex.records, indexRecord],
}
commitStagingDirectory(stagingDirectory, recordDirectory)
activeStagingDirectory = null
writeJsonAtomic(indexPath, nextIndex)
updateLibraryManifest(libraryManifestPath, nextIndex.records, createdAtUtc)
indexCommitted = true
activeFinalDirectory = null
appendJsonLine(path.join(LIBRARY_ROOT, "events.jsonl"), {
  schemaVersion: "original-image-library-event-v1",
  action: "original_image_intaked",
  recordId,
  categoryId: record.categoryId,
  status: record.status,
  imageSha256,
  recordPath: record.recordPath,
  createdAtUtc,
  createdAtAsiaShanghai: record.createdAtAsiaShanghai,
})

console.log(JSON.stringify({
  status: "original_image_intaked",
  recordId,
  intakeStatus: record.status,
  recordPath: record.recordPath,
  imagePath: projectPath(storedImagePath),
  imageSha256,
  indexPath: projectPath(indexPath),
  formalTrainingSampleCreated: false,
}, null, 2))

function readIndex(filePath) {
  if (!fs.existsSync(filePath)) return { schemaVersion: ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION, collectionId: ORIGINAL_IMAGE_COLLECTION_ID, records: [] }
  const value = readJson(filePath)
  assert(value.schemaVersion === ORIGINAL_IMAGE_INDEX_SCHEMA_VERSION, "original image index schema is invalid")
  assert(value.collectionId === ORIGINAL_IMAGE_COLLECTION_ID, "original image index collection is invalid")
  assert(Array.isArray(value.records), "original image index records are invalid")
  return value
}

function updateLibraryManifest(filePath, records, updatedAt) {
  const manifest = readJson(filePath)
  const aiColdStartCount = records.filter((item) => item.status === "ai_assisted_cold_start_intake" || item.status === "ai_assisted_cold_start_eligible").length
  writeJsonAtomic(filePath, {
    ...manifest,
    status: records.length === 0
      ? "empty_awaiting_high_resolution_pixel_style_original_records"
      : aiColdStartCount > 0
        ? "active_with_ai_assisted_cold_start_records"
        : "active_with_original_records",
    updatedAt,
    recordCount: records.length,
    aiAssistedColdStartRecordCount: aiColdStartCount,
  })
}

function copyEvidenceFiles(values, stagingRoot, finalRoot) {
  if (!values?.length) return []
  fs.mkdirSync(stagingRoot, { recursive: true })
  return values.map((value, index) => {
    const sourcePath = resolveProjectPath(value)
    assert(fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile(), `evidence file does not exist: ${value}`)
    const bytes = fs.readFileSync(sourcePath)
    const safeName = `${String(index + 1).padStart(3, "0")}-${path.basename(sourcePath)}`
    const stagingPath = path.join(stagingRoot, safeName)
    const finalPath = path.join(finalRoot, safeName)
    fs.copyFileSync(sourcePath, stagingPath, fs.constants.COPYFILE_EXCL)
    return { path: projectPath(finalPath), originalPath: projectPath(sourcePath), sha256: sha256(bytes), byteLength: bytes.length }
  })
}

function sourceBlockReasons(request) {
  const reasons = []
  if (request.source.thirdPartyContentUsed) reasons.push("third_party_content_used")
  if (request.source.thirdPartyGenerativeModelUsed) reasons.push("third_party_generative_model_used")
  if (request.source.copiedFromExistingWork) reasons.push("copied_from_existing_work")
  if (["external_unreviewed", "external_model_generated", "online_model_generated", "openai_generated", "unknown"].includes(request.source.sourceType)) {
    reasons.push(`blocked_source_type:${request.source.sourceType}`)
  }
  return reasons
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`)
  fs.renameSync(temporaryPath, filePath)
}

function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`)
}

function commitStagingDirectory(stagingDirectory, recordDirectory) {
  try {
    fs.renameSync(stagingDirectory, recordDirectory)
    return
  } catch (error) {
    if (!error || !["EPERM", "EBUSY"].includes(error.code)) throw error
  }

  assert(!fs.existsSync(recordDirectory), `record directory already exists: ${projectPath(recordDirectory)}`)
  fs.cpSync(stagingDirectory, recordDirectory, { recursive: true, errorOnExist: true, force: false })
  fs.rmSync(stagingDirectory, { recursive: true, force: true })
}

function normalizeImageExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return extension === ".jpeg" ? ".jpg" : extension
}

function mediaTypeForExtension(extension) {
  return { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" }[extension] ?? "application/octet-stream"
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function projectRelativeTo(parent, child) {
  return path.relative(parent, child).replace(/\\/g, "/")
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

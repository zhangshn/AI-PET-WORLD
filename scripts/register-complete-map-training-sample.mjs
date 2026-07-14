import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  REGISTRATION_REQUEST_SCHEMA_VERSION,
  SAMPLE_SCHEMA_VERSION,
  validateRegistrationRequest,
  validateRegisteredSampleRecord,
} from "./lib/complete-map-training-sample-contract.mjs"

const ROOT = process.cwd()
const registrationStartedAt = new Date().toISOString()
let activeRequestPath = null
let activeRequest = null
process.on("uncaughtException", (error) => {
  const rejectionId = `sample-registration-rejected-${registrationStartedAt.replace(/[:.]/g, "-")}`
  const record = {
    schemaVersion: "complete-map-sample-registration-rejection-v1",
    status: "rejected_or_failed",
    rejectionId,
    timestampUtc: registrationStartedAt,
    timestampAsiaShanghai: formatShanghai(registrationStartedAt),
    requestPath: activeRequestPath ? projectPath(activeRequestPath) : null,
    sampleType: activeRequest?.sampleType ?? null,
    sourceType: activeRequest?.sourceType ?? null,
    independentTrainingEligible: activeRequest?.independentTrainingEligible === true,
    reason: error instanceof Error ? error.message : String(error),
    registeredSampleCreated: false,
    automaticStorage: true,
  }
  const failureRoot = path.join(ROOT, ".runtime", "ai-painter", "sample-registration-rejections")
  const failurePath = path.join(failureRoot, `${rejectionId}.json`)
  writeJson(failurePath, record)
  writeJson(path.join(failureRoot, "latest.json"), { ...record, failurePath: projectPath(failurePath) })
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
})
const requestArg = argumentValue("--request")
assert(requestArg, `usage: node scripts/register-complete-map-training-sample.mjs --request <${REGISTRATION_REQUEST_SCHEMA_VERSION}.json>`)
const requestPath = resolveProjectPath(requestArg)
const request = readJson(requestPath)
activeRequestPath = requestPath
activeRequest = request
const dictionaryPointer = readJson(resolveProjectPath("data/world-visual-data-dictionary/latest.json"))
const dictionaryVersionId = dictionaryPointer.dictionaryVersionId
const requestFailures = validateRegistrationRequest(request, dictionaryVersionId)
assert(requestFailures.length === 0, `sample registration rejected: ${requestFailures.join(", ")}`)
const independentEvidence = request.independentTrainingEligible === true
  ? validateAndHashIndependentEvidence(request, dictionaryVersionId)
  : null

const sourceImagePath = resolveProjectPath(request.imagePath)
assert(fs.existsSync(sourceImagePath) && fs.statSync(sourceImagePath).isFile(), "source image does not exist")
const imageBytes = fs.readFileSync(sourceImagePath)
const imageSha256 = sha256(imageBytes)
const imagePerceptualHash = await differenceHash(imageBytes)
const extension = path.extname(sourceImagePath).toLowerCase() === ".jpeg" ? ".jpg" : path.extname(sourceImagePath).toLowerCase()
const sampleId = request.sampleId ?? `sample-${request.sampleType}-${imageSha256.slice(0, 16)}`
assert(/^[a-z0-9][a-z0-9._-]{5,127}$/i.test(sampleId), "sampleId contains unsupported characters or length")

const registryRoot = path.join(ROOT, "data", "world-samples", "registry", dictionaryVersionId)
const imagePath = path.join(registryRoot, "images", `${imageSha256}${extension}`)
const recordPath = path.join(registryRoot, "records", `${sampleId}.json`)
const requestArchivePath = path.join(registryRoot, "requests", `${sampleId}.json`)
const createdAtUtc = new Date().toISOString()
const record = {
  ...request,
  schemaVersion: SAMPLE_SCHEMA_VERSION,
  sampleId,
  dictionaryVersionId,
  sourceRegistrationRequestOriginalPath: projectPath(requestPath),
  sourceRegistrationRequestPath: projectPath(requestArchivePath),
  sourceImageOriginalPath: projectPath(sourceImagePath),
  imagePath: projectPath(imagePath),
  imageSha256,
  imagePerceptualHash,
  recordPath: projectPath(recordPath),
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  registeredByProgram: true,
  manualRecordFabrication: false,
  ...(independentEvidence ?? {}),
}
delete record.imagePathOriginal

const recordFailures = validateRegisteredSampleRecord(record, dictionaryVersionId)
assert(recordFailures.length === 0, `normalized sample record rejected: ${recordFailures.join(", ")}`)

if (fs.existsSync(recordPath)) {
  const existing = readJson(recordPath)
  assert(existing.imageSha256 === imageSha256, "sampleId already exists with a different image")
  assert(existing.sampleType === record.sampleType, "sampleId already exists with a different sample type")
  for (const field of ["sourceType", "split", "trainingUsage", "ownerReviewStatus", "machineReviewStatus", "blueprintHash", "taskPackageId", "directorPlanId"]) {
    assert(JSON.stringify(existing[field]) === JSON.stringify(record[field]), `sampleId already exists with different immutable field: ${field}`)
  }
  assert(JSON.stringify(existing.conditionHashes) === JSON.stringify(record.conditionHashes), "sampleId already exists with different condition hashes")
  console.log(JSON.stringify({ status: "already_registered", sampleId, recordPath: projectPath(recordPath), imageSha256 }, null, 2))
  process.exit(0)
}

for (const existingRecordPath of walkJson(path.join(registryRoot, "records"))) {
  const existing = readJson(existingRecordPath)
  assert(existing.imageSha256 !== imageSha256, `image already registered as sampleId=${existing.sampleId}`)
  const existingImagePath = resolveProjectPath(existing.imagePath)
  if (!fs.existsSync(existingImagePath)) continue
  const existingPerceptualHash = existing.imagePerceptualHash ?? await differenceHash(fs.readFileSync(existingImagePath))
  const distance = hammingDistance(imagePerceptualHash, existingPerceptualHash)
  const normalizedDifference = await normalizedThumbnailDifference(imageBytes, fs.readFileSync(existingImagePath))
  if (distance <= 6 || normalizedDifference <= 4) {
    console.log(JSON.stringify({ status: "near_duplicate_not_registered", sampleId, imageSha256, imagePerceptualHash, duplicateOfSampleId: existing.sampleId, duplicateOfImageSha256: existing.imageSha256, perceptualDistance: distance, normalizedThumbnailDifference }, null, 2))
    process.exit(0)
  }
}

fs.mkdirSync(path.dirname(imagePath), { recursive: true })
fs.mkdirSync(path.dirname(recordPath), { recursive: true })
fs.mkdirSync(path.dirname(requestArchivePath), { recursive: true })
if (!fs.existsSync(imagePath)) fs.copyFileSync(sourceImagePath, imagePath, fs.constants.COPYFILE_EXCL)
fs.copyFileSync(requestPath, requestArchivePath, fs.constants.COPYFILE_EXCL)
writeJson(recordPath, record)
appendJsonLine(path.join(registryRoot, "events.jsonl"), {
  schemaVersion: "complete-map-sample-registry-event-v1",
  action: "sample_registered",
  sampleId,
  sampleType: record.sampleType,
  imageSha256,
  recordPath: projectPath(recordPath),
  createdAtUtc,
  createdAtAsiaShanghai: record.createdAtAsiaShanghai,
})
writeJson(path.join(registryRoot, "latest.json"), {
  schemaVersion: "complete-map-sample-registry-latest-v1",
  sampleId,
  imageSha256,
  recordPath: projectPath(recordPath),
  createdAtUtc,
})

console.log(JSON.stringify({ status: "sample_registered", sampleId, recordPath: projectPath(recordPath), imagePath: projectPath(imagePath), imageSha256 }, null, 2))

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

function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`)
}

function walkJson(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkJson(filePath))
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(filePath)
  }
  return files
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

async function differenceHash(bytes) {
  const { data } = await sharp(bytes, { failOn: "error" }).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true })
  let bits = ""
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0"
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0")
}

function hammingDistance(left, right) {
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`)
  let distance = 0
  while (value > 0n) {
    distance += Number(value & 1n)
    value >>= 1n
  }
  return distance
}

async function normalizedThumbnailDifference(leftBytes, rightBytes) {
  const left = await sharp(leftBytes, { failOn: "error" }).greyscale().resize(64, 48, { fit: "fill" }).raw().toBuffer()
  const right = await sharp(rightBytes, { failOn: "error" }).greyscale().resize(64, 48, { fit: "fill" }).raw().toBuffer()
  let total = 0
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index])
  return Math.round((total / left.length) * 10000) / 10000
}

function validateAndHashIndependentEvidence(value, currentDictionaryVersion) {
  const conditionPackPath = resolveProjectPath(value.conditionPackPath)
  assert(fs.existsSync(conditionPackPath) && fs.statSync(conditionPackPath).isFile(), "independent condition pack does not exist")
  const conditionPackBytes = fs.readFileSync(conditionPackPath)
  const conditionPack = JSON.parse(conditionPackBytes.toString("utf8"))
  assert(conditionPack.schemaVersion === "complete-world-visual-condition-pack-v1", "independent condition pack schema is invalid")
  assert(conditionPack.dictionaryVersionId === currentDictionaryVersion, "independent condition pack dictionary is stale")
  assert(conditionPack.taskId === value.taskPackageId, "independent condition pack task mismatch")
  const actualConditionHashes = conditionPack.channels?.map((channel) => channel.sha256) ?? []
  assert(JSON.stringify(actualConditionHashes) === JSON.stringify(value.conditionHashes), "independent condition hashes do not match condition pack")
  for (const channel of conditionPack.channels ?? []) {
    const channelPath = resolveProjectPath(channel.path)
    assert(fs.existsSync(channelPath) && fs.statSync(channelPath).isFile(), `condition channel missing: ${channel.id}`)
    assert(sha256(fs.readFileSync(channelPath)) === channel.sha256, `condition channel hash mismatch: ${channel.id}`)
  }

  const sourcePath = resolveProjectPath(value.sourcePath)
  assert(fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile(), "original visual source evidence does not exist")
  const evidencePaths = [...new Set([
    ...(value.ipProvenance.evidencePaths ?? []),
    ...(value.ipProvenance.assignmentAgreementPath ? [value.ipProvenance.assignmentAgreementPath] : []),
  ])]
  const ipEvidenceHashes = evidencePaths.map((evidencePath) => {
    const resolved = resolveProjectPath(evidencePath)
    assert(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), `IP evidence file does not exist: ${evidencePath}`)
    const bytes = fs.readFileSync(resolved)
    return { path: projectPath(resolved), sha256: sha256(bytes), bytes: bytes.length }
  })
  return {
    sourceFileSha256: sha256(fs.readFileSync(sourcePath)),
    conditionPackFileSha256: sha256(conditionPackBytes),
    ipEvidenceHashes,
    ipProvenanceVerifiedByProgram: true,
  }
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

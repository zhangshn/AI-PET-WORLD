import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { validateRegisteredSampleRecord } from "./lib/complete-map-training-sample-contract.mjs"

const ROOT = process.cwd()
const dictionaryPointer = readJson("data/world-visual-data-dictionary/latest.json")
const dictionaryVersionId = dictionaryPointer?.dictionaryVersionId
const registryRoot = path.join(ROOT, "data", "world-samples", "registry", dictionaryVersionId ?? "missing")
const recordRoot = path.join(registryRoot, "records")
const failures = []
const records = []
const seenIds = new Set()
const seenHashes = new Set()

check(Boolean(dictionaryVersionId), "current_dictionary_missing")
for (const recordPath of walkJson(recordRoot)) {
  const record = readJson(recordPath)
  if (!record) {
    failures.push(`record_unreadable:${projectPath(recordPath)}`)
    continue
  }
  const recordFailures = validateRegisteredSampleRecord(record, dictionaryVersionId)
  for (const failure of recordFailures) failures.push(`${record.sampleId ?? projectPath(recordPath)}:${failure}`)
  check(record.recordPath === projectPath(recordPath), `${record.sampleId}:record_path_mismatch`)
  check(fs.existsSync(resolveProjectPath(record.sourceRegistrationRequestPath)), `${record.sampleId}:registration_request_archive_missing`)
  const imagePath = resolveProjectPath(record.imagePath)
  check(fs.existsSync(imagePath), `${record.sampleId}:image_missing`)
  if (fs.existsSync(imagePath)) check(sha256(fs.readFileSync(imagePath)) === record.imageSha256, `${record.sampleId}:image_hash_mismatch`)
  if (record.independentTrainingEligible === true) validateIndependentEvidence(record)
  check(!seenIds.has(record.sampleId), `${record.sampleId}:duplicate_sample_id`)
  check(!seenHashes.has(record.imageSha256), `${record.sampleId}:duplicate_image_hash`)
  seenIds.add(record.sampleId)
  seenHashes.add(record.imageSha256)
  records.push(record)
}

function validateIndependentEvidence(record) {
  const sourcePath = resolveProjectPath(record.sourcePath)
  check(fs.existsSync(sourcePath), `${record.sampleId}:ip_source_file_missing`)
  if (fs.existsSync(sourcePath)) check(sha256(fs.readFileSync(sourcePath)) === record.sourceFileSha256, `${record.sampleId}:ip_source_file_hash_mismatch`)

  const conditionPackPath = resolveProjectPath(record.conditionPackPath)
  check(fs.existsSync(conditionPackPath), `${record.sampleId}:condition_pack_missing`)
  if (fs.existsSync(conditionPackPath)) {
    const conditionBytes = fs.readFileSync(conditionPackPath)
    check(sha256(conditionBytes) === record.conditionPackFileSha256, `${record.sampleId}:condition_pack_file_hash_mismatch`)
    const conditionPack = JSON.parse(conditionBytes.toString("utf8"))
    check(conditionPack.taskId === record.taskPackageId, `${record.sampleId}:condition_pack_task_mismatch`)
    check(conditionPack.dictionaryVersionId === record.dictionaryVersionId, `${record.sampleId}:condition_pack_dictionary_mismatch`)
    check(JSON.stringify(conditionPack.channels?.map((channel) => channel.sha256) ?? []) === JSON.stringify(record.conditionHashes), `${record.sampleId}:condition_hashes_mismatch`)
  }

  for (const evidence of record.ipEvidenceHashes ?? []) {
    const evidencePath = resolveProjectPath(evidence.path)
    check(fs.existsSync(evidencePath), `${record.sampleId}:ip_evidence_missing:${evidence.path}`)
    if (fs.existsSync(evidencePath)) check(sha256(fs.readFileSync(evidencePath)) === evidence.sha256, `${record.sampleId}:ip_evidence_hash_mismatch:${evidence.path}`)
  }
}

const counts = records.reduce((result, record) => {
  result[record.sampleType] = (result[record.sampleType] ?? 0) + 1
  return result
}, {})
const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "complete_map_sample_registry_check_passed" : "complete_map_sample_registry_check_failed",
  dictionaryVersionId,
  registryRoot: projectPath(registryRoot),
  sampleCount: records.length,
  counts,
  emptyRegistryAllowed: true,
  trainingDataSufficient: null,
  sufficiencyDeterminedBy: "npm run audit:complete-map-data-sufficiency",
  failures,
}

console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

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

function readJson(value) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
  } catch {
    return null
  }
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${value}`)
  return resolved
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/")
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

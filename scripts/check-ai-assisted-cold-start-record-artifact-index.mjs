import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { catalogPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const POINTER_PATH = ".runtime/ai-painter/ai-assisted-cold-start-record-artifact-index-repairs/latest.json"
const recordId = argumentValue("--record-id")
assert(recordId, "--record-id is required")

const pointer = readJson(POINTER_PATH)
assert(pointer.recordId === recordId, "latest repair pointer record mismatch")
const report = readJson(pointer.runPath)
assert(report.schemaVersion === "ai-assisted-cold-start-record-artifact-index-repair-v1", "repair report schema mismatch")
assert(report.status === "storage_catalog_artifact_index_repaired", "repair report status mismatch")
assert(report.recordId === recordId, "repair report record mismatch")
assert(report.sourceFilesModified === false, "repair changed source files")
assert(report.imageGenerated === false, "repair generated an image")
assert(report.machineReviewRerun === false, "repair reran machine review")
assert(report.ownerReviewChanged === false, "repair changed owner review")
assert(report.capacityChanged === false, "repair changed capacity")
assert(report.gpuTrainingStarted === false, "repair started GPU training")
assert(report.runtimeAdvanced === false && report.worldPageAdvanced === false, "repair advanced runtime or world page")
assert(report.missingAfterCount === 0 && report.mismatchedAfterCount === 0, "repair report contains unresolved index failures")

const database = new DatabaseSync(catalogPath, { readOnly: true })
const artifactLookup = database.prepare(`
  SELECT logical_path, physical_uri, run_id, artifact_type, byte_size, modified_at_utc, sha256, indexed_at_utc
  FROM artifacts
  WHERE logical_path = ?
`)
const failures = []
for (const artifact of report.artifacts ?? []) {
  const filePath = resolveProjectPath(artifact.logicalPath)
  if (!fs.existsSync(filePath)) {
    failures.push(`file_missing:${artifact.logicalPath}`)
    continue
  }
  const row = artifactLookup.get(artifact.logicalPath)
  if (!row) {
    failures.push(`catalog_row_missing:${artifact.logicalPath}`)
    continue
  }
  if (sha256File(filePath) !== artifact.sha256) failures.push(`file_sha256_mismatch:${artifact.logicalPath}`)
  if (row.sha256 !== artifact.sha256) failures.push(`catalog_sha256_mismatch:${artifact.logicalPath}`)
  if (Number(row.byte_size) !== artifact.byteSize) failures.push(`catalog_byte_size_mismatch:${artifact.logicalPath}`)
  if (path.resolve(row.physical_uri) !== path.resolve(fs.realpathSync(filePath))) failures.push(`catalog_physical_uri_mismatch:${artifact.logicalPath}`)
}
for (const required of report.requiredArtifacts ?? []) {
  const row = artifactLookup.get(required.path)
  if (!row) failures.push(`required_catalog_row_missing:${required.path}`)
  else if (row.sha256 !== required.sha256) failures.push(`required_catalog_sha256_mismatch:${required.path}`)
}
const events = database.prepare(`
  SELECT event_id, title, title_zh, evidence_path
  FROM program_events
  WHERE run_id = ? AND action = ?
`).all(report.runId, "repair_ai_assisted_cold_start_record_artifact_index")
if (events.length !== 1) failures.push(`repair_event_count_invalid:${events.length}`)
for (const event of events) {
  if (!event.title || !event.title_zh) failures.push(`repair_event_bilingual_title_missing:${event.event_id}`)
  if (event.evidence_path !== pointer.runPath) failures.push(`repair_event_evidence_path_mismatch:${event.event_id}`)
}
database.close()

const result = {
  ok: failures.length === 0,
  status: failures.length === 0
    ? "ai_assisted_cold_start_record_artifact_index_check_passed"
    : "ai_assisted_cold_start_record_artifact_index_check_failed",
  repairRunId: report.runId,
  recordId,
  artifactCount: report.artifactCount,
  requiredArtifactCount: report.requiredArtifacts?.length ?? 0,
  repairEventCount: events.length,
  sourceFilesModified: report.sourceFilesModified,
  imageGenerated: report.imageGenerated,
  gpuTrainingStarted: report.gpuTrainingStarted,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}
function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}
function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}
function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

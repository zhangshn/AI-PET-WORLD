import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  closeStorageCatalog,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const REPAIR_LATEST_PATH =
  ".runtime/ai-painter/ai-painter-program-event-artifact-hash-repairs/latest.json"
const latest = readJson(REPAIR_LATEST_PATH)
const report = readJson(latest.runPath)
const database = openStorageCatalog()
const selectArtifact = database.prepare(
  "SELECT logical_path, run_id, byte_size, sha256 FROM artifacts WHERE logical_path = ?",
)
const failures = []
check(report.status === "completed", "repair_not_completed")
check(report.repairedTargetCount === 3, "repaired_target_count_mismatch")
for (const target of report.targets ?? []) {
  const row = selectArtifact.get(target.logicalPath)
  check(Boolean(row), `artifact_missing:${target.logicalPath}`)
  check(
    row?.sha256 ===
      sha256File(resolveProjectPath(target.logicalPath)),
    `artifact_hash_mismatch:${target.logicalPath}`,
  )
}
for (const evidencePath of [latest.runPath, REPAIR_LATEST_PATH]) {
  const row = selectArtifact.get(evidencePath)
  check(Boolean(row?.sha256), `repair_evidence_hash_missing:${evidencePath}`)
  check(
    row?.sha256 === sha256File(resolveProjectPath(evidencePath)),
    `repair_evidence_hash_mismatch:${evidencePath}`,
  )
}
const events = database
  .prepare(
    "SELECT event_id,status,title,title_zh,evidence_path " +
      "FROM program_events WHERE run_id = ?",
  )
  .all(report.runId)
check(
  events.some(
    (entry) =>
      entry.status === "success" &&
      entry.title &&
      entry.title_zh &&
      entry.evidence_path === latest.runPath,
  ),
  "repair_bilingual_event_missing",
)
const ok = failures.length === 0
console[ok ? "log" : "error"](
  JSON.stringify(
    {
      ok,
      status: ok
        ? "ai_painter_program_event_artifact_hash_check_passed"
        : "ai_painter_program_event_artifact_hash_check_failed",
      repairRunId: report.runId,
      repairedTargetCount: report.repairedTargetCount,
      checkedRepairEvidenceCount: 2,
      imageGenerated: false,
      gpuTrainingStarted: false,
      failures,
    },
    null,
    2,
  ),
)
closeStorageCatalog()
process.exit(ok ? 0 : 1)

function readJson(value) {
  return JSON.parse(
    fs.readFileSync(resolveProjectPath(value), "utf8"),
  )
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (
    resolved !== ROOT &&
    !resolved.startsWith(`${ROOT}${path.sep}`)
  ) {
    throw new Error(`path escapes project: ${value}`)
  }
  return resolved
}

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(value))
    .digest("hex")
}

function check(condition, failure) {
  if (!condition) failures.push(failure)
}

import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "task-capsule-store.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "task-capsule-projection.ts")
const routerSourcePath = path.join(projectRoot, "src", "server", "ai-console", "evidence-projection.ts")
const catalogSourcePath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-workspace-catalog.ts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-task-capsule-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "evidence", "task-capsule-index-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, projectionSourcePath, routerSourcePath, catalogSourcePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}

if (failures.length === 0) {
  const productSource = [storeSourcePath, projectionSourcePath, routerSourcePath, catalogSourcePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only",
    "ai_console_task_capsule_writer_v1",
    "ai_console_task_registry",
    "BEGIN IMMEDIATE",
    "task_id TEXT NOT NULL UNIQUE",
    "content_blob BLOB NOT NULL",
    "ai_console_task_capsule_task_identity_conflict",
    "queryAiConsoleTaskCapsuleProjection",
  ]) {
    if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Task Capsule V1" || schema.additionalProperties !== false) failures.push("schema_contract_invalid")
  for (const field of ["capsuleId", "taskId", "taskGoalSha256", "terminalEventId", "contentSha256", "capsuleRecordSha256"]) {
    if (!schema.required?.includes(field) || !schema.properties?.[field]) failures.push(`schema_field_missing:${field}`)
  }
}

let actualCapsuleCount = null
if (!existsSync(storePath)) {
  failures.push("task_capsule_store_not_initialized")
} else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("task_capsule_store_integrity_failed")
    const metadataRows = database.prepare("SELECT * FROM metadata").all()
    if (metadataRows.length !== 1) failures.push("task_capsule_metadata_cardinality_invalid")
    const metadata = metadataRows[0]
    actualCapsuleCount = Number(database.prepare("SELECT COUNT(*) AS count FROM task_capsules").get().count)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_task_capsule_writer_v1") failures.push("task_capsule_metadata_identity_invalid")
    if (Number(metadata?.capsule_count) !== actualCapsuleCount || Number(metadata?.store_revision) !== actualCapsuleCount) failures.push("task_capsule_metadata_count_invalid")
  } finally {
    database.close()
  }
}

let dynamicWriterTest = false
if (failures.length === 0) {
  const storeModule = await import(pathToFileURL(storeSourcePath).href)
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-task-capsule-check-"))
  try {
    process.chdir(temporaryRoot)
    const initialized = storeModule.initializeAiConsoleTaskCapsuleStore()
    if (initialized.storeRevision !== 0 || initialized.capsuleCount !== 0) failures.push("temporary_store_initial_state_invalid")
    const fixture = {
      taskId: sha256("task"),
      taskGoal: "验证新平台任务胶囊写入器的严格身份、幂等和冲突关闭。",
      capabilityDomain: "text_and_language",
      capabilityVersionId: null,
      inputEvidenceIds: [sha256("input-a"), sha256("input-b")].sort(),
      executionId: sha256("execution"),
      executionSummary: "确定性临时目录测试完成；未接入任何旧平台来源。",
      terminalStatus: "succeeded",
      terminalEventId: sha256("terminal-event"),
      resultEvidenceIds: [sha256("result-a")],
      policyBoundaryReportId: null,
      startedAtUtc: "2026-08-28T00:00:00.000Z",
      terminalAtUtc: "2026-08-28T00:01:00.000Z",
      sourceTaskRegistryIdentity: "ai_console_task_registry",
      sourceTaskRegistryRevision: 1,
    }
    const first = storeModule.writeAiConsoleTaskCapsule(fixture)
    const duplicate = storeModule.writeAiConsoleTaskCapsule(fixture)
    if (first.capsuleId !== duplicate.capsuleId || first.capsuleSequence !== 1) failures.push("task_capsule_idempotency_invalid")

    let conflictClosed = false
    try {
      storeModule.writeAiConsoleTaskCapsule({ ...fixture, taskGoal: `${fixture.taskGoal}冲突` })
    } catch (error) {
      conflictClosed = error instanceof Error && error.message === "ai_console_task_capsule_task_identity_conflict"
    }
    if (!conflictClosed) failures.push("task_capsule_identity_conflict_not_closed")

    let legacySourceClosed = false
    try {
      storeModule.writeAiConsoleTaskCapsule({ ...fixture, taskId: sha256("legacy-task"), sourceTaskRegistryIdentity: "legacy_task_registry" })
    } catch (error) {
      legacySourceClosed = error instanceof Error && error.message === "ai_console_task_capsule_source_registry_invalid"
    }
    if (!legacySourceClosed) failures.push("task_capsule_legacy_source_not_closed")

    const read = storeModule.readAiConsoleTaskCapsuleStore()
    dynamicWriterTest = read.status === "connected" && read.records.length === 1 && read.records[0].integrityStatus === "verified"
    if (!dynamicWriterTest) failures.push("task_capsule_dynamic_readback_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolvedTemporaryRoot = path.resolve(temporaryRoot)
    if (resolvedTemporaryRoot.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolvedTemporaryRoot, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  storeIdentity: "ai_console_task_capsule_store",
  actualCapsuleCount,
  dynamicWriterTest,
  failures,
}, null, 2))

if (failures.length > 0) process.exitCode = 1

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

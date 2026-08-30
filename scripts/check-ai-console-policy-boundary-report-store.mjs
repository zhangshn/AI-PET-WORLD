import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const projectRoot = process.cwd()
const storeSourcePath = path.join(projectRoot, "src", "server", "ai-console-control", "policy-boundary-report-store.ts")
const projectionSourcePath = path.join(projectRoot, "src", "server", "ai-console", "policy-boundary-report-projection.ts")
const routerSourcePath = path.join(projectRoot, "src", "server", "ai-console", "evidence-projection.ts")
const catalogSourcePath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-workspace-catalog.ts")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-policy-boundary-report-v1.schema.json")
const storePath = path.join(projectRoot, ".runtime", "ai-console", "evidence", "policy-boundary-report-index-v1.sqlite")
const failures = []

for (const sourcePath of [storeSourcePath, projectionSourcePath, routerSourcePath, catalogSourcePath, schemaPath]) {
  if (!existsSync(sourcePath)) failures.push(`missing_file:${path.relative(projectRoot, sourcePath)}`)
}

if (failures.length === 0) {
  const productSource = [storeSourcePath, projectionSourcePath, routerSourcePath, catalogSourcePath].map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n")
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(productSource)) failures.push("legacy_source_coupling")
  for (const marker of [
    "new_ai_console_only",
    "ai_console_policy_boundary_report_writer_v1",
    "ai_console_policy_boundary_engine",
    "BEGIN IMMEDIATE",
    "boundary_event_id TEXT NOT NULL UNIQUE",
    "content_blob BLOB NOT NULL",
    "blocked_policy_boundary",
    "ai_console_policy_boundary_event_identity_conflict",
    "queryAiConsolePolicyBoundaryReportProjection",
    "正式边界报告",
  ]) {
    if (!productSource.includes(marker)) failures.push(`missing_marker:${marker}`)
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  if (schema.title !== "AI Console Policy Boundary Report V1" || schema.additionalProperties !== false) failures.push("schema_contract_invalid")
  for (const field of ["policyBoundaryReportId", "boundaryEventId", "boundaryCategory", "failureCode", "terminalStatus", "contentSha256", "policyBoundaryReportRecordSha256"]) {
    if (!schema.required?.includes(field) || !schema.properties?.[field]) failures.push(`schema_field_missing:${field}`)
  }
}

let actualReportCount = null
if (!existsSync(storePath)) {
  failures.push("policy_boundary_report_store_not_initialized")
} else {
  const database = new DatabaseSync(storePath, { open: true, readOnly: true })
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()
    if (!integrity || !Object.values(integrity).includes("ok")) failures.push("policy_boundary_report_store_integrity_failed")
    const metadataRows = database.prepare("SELECT * FROM metadata").all()
    if (metadataRows.length !== 1) failures.push("policy_boundary_report_metadata_cardinality_invalid")
    const metadata = metadataRows[0]
    actualReportCount = Number(database.prepare("SELECT COUNT(*) AS count FROM policy_boundary_reports").get().count)
    if (metadata?.source_boundary !== "new_ai_console_only" || metadata?.writer_identity !== "ai_console_policy_boundary_report_writer_v1") failures.push("policy_boundary_report_metadata_identity_invalid")
    if (Number(metadata?.report_count) !== actualReportCount || Number(metadata?.store_revision) !== actualReportCount) failures.push("policy_boundary_report_metadata_count_invalid")
  } finally {
    database.close()
  }
}

let dynamicWriterTest = false
if (failures.length === 0) {
  const storeModule = await import(pathToFileURL(storeSourcePath).href)
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ai-console-policy-boundary-check-"))
  try {
    process.chdir(temporaryRoot)
    const initialized = storeModule.initializeAiConsolePolicyBoundaryReportStore()
    if (initialized.storeRevision !== 0 || initialized.reportCount !== 0) failures.push("temporary_store_initial_state_invalid")
    const fixture = {
      boundaryEventId: sha256("boundary-event"),
      boundaryCategory: "source_and_license",
      prohibitedAction: "use_unregistered_source_license",
      failureCode: "policy.source_license_unregistered",
      affectedScope: "ai_console_task:fixture",
      affectedTaskId: sha256("task"),
      affectedExecutionId: null,
      detectionEvidenceIds: [sha256("detection-a"), sha256("detection-b")].sort(),
      preservedStateEvidenceIds: [sha256("preserved-a")],
      preservationRequirement: "preserve_current_formal_state_and_all_failure_evidence",
      safeAlternativeRequirement: "select_registered_licensed_input",
      terminalStatus: "blocked_policy_boundary",
      occurredAtUtc: "2026-08-28T00:00:00.000Z",
      sourcePolicyEngineIdentity: "ai_console_policy_boundary_engine",
      sourcePolicyRevision: 1,
    }
    const first = storeModule.writeAiConsolePolicyBoundaryReport(fixture)
    const duplicate = storeModule.writeAiConsolePolicyBoundaryReport(fixture)
    if (first.policyBoundaryReportId !== duplicate.policyBoundaryReportId || first.reportSequence !== 1) failures.push("policy_boundary_report_idempotency_invalid")

    let conflictClosed = false
    try {
      storeModule.writeAiConsolePolicyBoundaryReport({ ...fixture, failureCode: "policy.source_license_conflict" })
    } catch (error) {
      conflictClosed = error instanceof Error && error.message === "ai_console_policy_boundary_event_identity_conflict"
    }
    if (!conflictClosed) failures.push("policy_boundary_report_identity_conflict_not_closed")

    let sourceClosed = false
    try {
      storeModule.writeAiConsolePolicyBoundaryReport({ ...fixture, boundaryEventId: sha256("source-conflict"), sourcePolicyEngineIdentity: "external_policy_engine" })
    } catch (error) {
      sourceClosed = error instanceof Error && error.message === "ai_console_policy_boundary_source_engine_invalid"
    }
    if (!sourceClosed) failures.push("policy_boundary_report_external_source_not_closed")

    let terminalClosed = false
    try {
      storeModule.writeAiConsolePolicyBoundaryReport({ ...fixture, boundaryEventId: sha256("terminal-conflict"), terminalStatus: "succeeded" })
    } catch (error) {
      terminalClosed = error instanceof Error && error.message === "ai_console_policy_boundary_terminal_status_invalid"
    }
    if (!terminalClosed) failures.push("policy_boundary_report_terminal_not_closed")

    const read = storeModule.readAiConsolePolicyBoundaryReportStore()
    dynamicWriterTest = read.status === "connected" && read.records.length === 1 && read.records[0].integrityStatus === "verified"
    if (!dynamicWriterTest) failures.push("policy_boundary_report_dynamic_readback_invalid")
  } finally {
    process.chdir(projectRoot)
    const resolvedTemporaryRoot = path.resolve(temporaryRoot)
    if (resolvedTemporaryRoot.startsWith(path.resolve(tmpdir()) + path.sep)) rmSync(resolvedTemporaryRoot, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  storeIdentity: "ai_console_policy_boundary_report_store",
  actualReportCount,
  dynamicWriterTest,
  failures,
}, null, 2))

if (failures.length > 0) process.exitCode = 1

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

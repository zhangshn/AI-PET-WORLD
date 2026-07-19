import fs from "node:fs"
import path from "node:path"
import { auditCompleteMapScope } from "./lib/complete-map-scope-gate.mjs"

const ROOT = process.cwd()
const selectedSourceRecordId = argumentValue("--source-record-id")
const summaryOnly = process.argv.includes("--summary")
const batchPointer = readJson(".runtime/ai-painter/ai-assisted-conditional-world-facts/latest.json")
const batch = readJson(batchPointer.manifestPath)
const rows = selectedSourceRecordId
  ? (batch.rows ?? []).filter((entry) => entry.sourceRecordId === selectedSourceRecordId)
  : (batch.rows ?? [])
if (selectedSourceRecordId && rows.length === 0) throw new Error(`condition blueprint row missing: ${selectedSourceRecordId}`)

const results = []
for (const row of rows) {
  const blueprint = readJson(row.blueprintPath)
  const directorOutput = readJson(row.directorOutputPath)
  const task = readJson(row.taskPackagePath)
  const conditionPack = readJson(row.conditionPackPath)
  const connectivityBlueprint = readJson(blueprint.connectivityBlueprintPath)
  const audit = await auditCompleteMapScope({ blueprint, directorOutput, task, conditionPack, connectivityBlueprint })
  results.push({
    sourceRecordId: row.sourceRecordId,
    passed: audit.passed,
    status: audit.status,
    failureCode: audit.failureCode,
    issues: audit.issues,
    evidence: audit.evidence,
  })
}

const failed = results.filter((entry) => !entry.passed)
const report = {
  schemaVersion: "ai-assisted-complete-map-scope-check-v1",
  auditedAtUtc: new Date().toISOString(),
  batchId: batch.batchId,
  status: failed.length === 0 ? "passed" : "blocked",
  checkedCount: results.length,
  passedCount: results.length - failed.length,
  failedCount: failed.length,
  results: summaryOnly
    ? results.map(({ sourceRecordId, passed, status, failureCode, issues }) => ({
        sourceRecordId,
        passed,
        status,
        failureCode,
        issues,
      }))
    : results,
  automaticStorage: true,
}
writeJson(path.join(path.dirname(resolveProjectPath(batchPointer.manifestPath)), "complete-map-scope-audit.json"), report)
console[failed.length === 0 ? "log" : "error"](JSON.stringify(report, null, 2))
process.exit(failed.length === 0 ? 0 : 1)

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project: ${value}`); return resolved }

import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import { formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = "20260821-021100000"
const output = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-terminal-pass-late-convergence-qualifications",
  runId,
)
const files = {
  terminal: path.join(output, "phase-terminal.json"),
  report: path.join(output, "timeline-qualification-report.json"),
  decision: path.join(output, "qualification-decision.json"),
  request: path.join(output, "stage0-owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  cpuRegression: path.join(
    root,
    ".runtime",
    "ai-painter",
    "stage4-terminal-pass-late-convergence-qualification-implementations",
    "20260821-021000000",
    "cpu-report.json",
  ),
  checker: path.join(root, "scripts", "check-stage4-terminal-pass-late-convergence-qualification.mjs"),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
  planSync: path.join(output, "plan-sync-record.json"),
}
for (const file of Object.values(files).filter((value) => value !== files.planSync)) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
if (fs.existsSync(files.planSync)) throw new Error("immutable plan sync already exists")
const terminal = JSON.parse(fs.readFileSync(files.terminal, "utf8"))
const cpuRegression = JSON.parse(fs.readFileSync(files.cpuRegression, "utf8"))
if (
  terminal.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed"
  || terminal.stage0EntryPermitted !== true
  || cpuRegression.positivePassed !== 17
  || cpuRegression.positiveTotal !== 17
  || cpuRegression.negativePassed !== 27
  || cpuRegression.negativeTotal !== 27
  || cpuRegression.decision?.qualificationRoute !== "strict_decrease_then_stable_zero"
) throw new Error("qualification plan-sync evidence is invalid")
const timestamp = new Date().toISOString()
writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId,
  uniqueModulePlan: bind(files.plan),
  terminal: bind(files.terminal),
  qualificationReport: bind(files.report),
  qualificationDecision: bind(files.decision),
  cpuRegressionReport: bind(files.cpuRegression),
  stage0OwnerActionRequest: bind(files.request),
  nextLegalAction: "compile_and_atomically_authorize_stage0_full_training",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
for (const file of Object.values(files)) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: file === files.plan
      ? "ai_painter_unique_module_plan"
      : "stage4_late_convergence_qualification",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}
console.log(JSON.stringify({
  status: "synchronized",
  terminal: bind(files.terminal),
  plan: bind(files.plan),
  planSyncRecord: bind(files.planSync),
}, null, 2))

function hash(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}
function projectPath(file) {
  return path.relative(root, file).replace(/\\/g, "/")
}
function bind(file) {
  return { path: projectPath(file), sha256: hash(file) }
}

import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const argument = (name) => {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`)
  return process.argv[index + 1]
}
const runId = argument("--run-id")
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId)) throw new Error("runId is invalid")
const smokeRoot = path.resolve(root, argument("--smoke-root"))
const cpuReportPath = path.resolve(root, argument("--cpu-report"))
const authorizationRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  `owner-authorized-stage4-general-late-convergence-qualification-${runId}`,
)
const authorizationPath = path.join(authorizationRoot, "implementation-authorization.json")
const runnerPath = path.join(root, "scripts", "run-stage4-general-late-convergence-qualification.mjs")
const files = {
  terminal: path.join(smokeRoot, "finalization", "phase-terminal.json"),
  finalization: path.join(smokeRoot, "finalization", "finalization-report.json"),
  manifest: path.join(smokeRoot, "training-output", "manifest.json"),
  review: path.join(smokeRoot, "training-output", "fixed-preview-reviews.json"),
}
for (const file of [...Object.values(files), cpuReportPath, runnerPath]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
if (fs.existsSync(authorizationRoot)) throw new Error("authorization namespace already exists")
const cpuReport = JSON.parse(fs.readFileSync(cpuReportPath, "utf8"))
if (
  cpuReport.status !== "stage4_terminal_pass_late_convergence_cpu_contract_passed"
  || cpuReport.positivePassed !== cpuReport.positiveTotal
  || cpuReport.negativePassed !== cpuReport.negativeTotal
  || cpuReport.decision?.qualificationRoute !== "strict_decrease_then_stable_zero"
  || JSON.stringify(cpuReport.decision?.failureCounts) !== JSON.stringify([1, 0, 0])
) throw new Error("bound CPU regression report is not eligible")

const requestId = `owner-authorized-stage4-general-late-convergence-qualification-${runId}`
const authorization = {
  schemaVersion: "ai-painter-owner-implementation-authorization-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  scope: "cpu_readonly_qualify_bound_smoke_terminal_pass_late_convergence_then_stage0_entry_only",
  implementationActions: [
    "run_cpu_positive_negative_timeline_contract",
    "adjudicate_bound_epoch_1_5_10_20_30_reviews",
    "write_stage0_entry_qualification",
    "record_local_evidence",
  ],
  explicitlyDeniedActions: [
    "modify_source_smoke",
    "change_review_thresholds",
    "rerun_smoke",
    "read_checkpoint_weights",
    "start_gpu",
    "start_training",
  ],
  sourceEvidence: Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, bind(file)]),
  ),
  cpuRegressionReport: bind(cpuReportPath),
  runner: bind(runnerPath),
  oneTimeConsumption: true,
  issuedAtUtc: new Date().toISOString(),
}
fs.mkdirSync(authorizationRoot, { recursive: false })
const handle = fs.openSync(authorizationPath, "wx")
try {
  fs.writeFileSync(handle, `${JSON.stringify(authorization, null, 2)}\n`, "utf8")
  fs.fsyncSync(handle)
} finally {
  fs.closeSync(handle)
}
console.log(JSON.stringify({
  status: "created",
  authorization: bind(authorizationPath),
  cpuRegressionReport: bind(cpuReportPath),
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

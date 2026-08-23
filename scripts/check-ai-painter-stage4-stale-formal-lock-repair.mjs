import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { repairStaleFormalStageLock } from "./repair-ai-painter-stage4-stale-formal-lock.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "run_id_required")
const fixtureRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/${runId}`)
assert.equal(fs.existsSync(fixtureRoot), false, "fixture_root_exists")
fs.mkdirSync(fixtureRoot, { recursive: true })
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
let slot = 0
function fixture({ pid = 999999, lockRunId = `fixture-old-${runId}`, terminalStatus = "host_session_closed_training_interrupted_closed", progressPathRunId = null, embeddedRunId = undefined, malformedProgressPath = false } = {}) {
  slot += 1
  const root = path.join(fixtureRoot, `fixture-${slot}`)
  fs.mkdirSync(root, { recursive: true })
  const lock = path.join(root, ".formal-stage.lock")
  const resolvedPathRunId = progressPathRunId ?? lockRunId
  const progress = malformedProgressPath
    ? path.join(root, "progress.json")
    : path.join(root, "stage4-semantic-mixture-formal-training", resolvedPathRunId, "training-output", "progress.json")
  const terminal = path.join(root, "interruption-terminal.json")
  fs.mkdirSync(path.dirname(progress), { recursive: true })
  fs.writeFileSync(lock, JSON.stringify({ pid, runId: lockRunId, stage: 0 }))
  const progressBody = {
    schemaVersion: "project-owned-ai-assisted-conditional-denoiser-progress-v1",
    status: "running",
    currentEpoch: 19,
    liveProgress: { epoch: 19, optimizerStep: 2736, optimizerStepTarget: 5760 },
  }
  if (embeddedRunId !== undefined) progressBody.runId = embeddedRunId
  fs.writeFileSync(progress, JSON.stringify(progressBody))
  fs.writeFileSync(terminal, JSON.stringify({ status: terminalStatus, formalTrainingFailure: false, oldRunIdReusable: false, oldProgress: { path: rel(progress), sha256: sha(progress) } }))
  return { root, lock, progress, terminal }
}
function call(value, name) {
  const packageId = `fixture-package-${runId}-${name}`
  const quarantineRoot = `${rel(value.root)}/quarantine-parent/${packageId}`
  assert.equal(fs.existsSync(path.dirname(path.resolve(ROOT, quarantineRoot))), false, "quarantine_parent_must_start_absent")
  const result = repairStaleFormalStageLock({ root: ROOT, packageId, lockPath: rel(value.lock), lockSha256: sha(value.lock), interruptionTerminalPath: rel(value.terminal), interruptionTerminalSha256: sha(value.terminal), quarantineRoot, fixtureMode: true })
  assert.equal(fs.existsSync(path.dirname(path.resolve(ROOT, quarantineRoot))), true, "quarantine_parent_not_created")
  return result
}
const positiveFixture = fixture()
const positive = call(positiveFixture, "real-schema-without-run-id")
assert.equal(positive.status, "stale_formal_stage_lock_quarantined_closed")
assert.equal(fs.existsSync(positiveFixture.lock), false)
const embeddedPositiveFixture = fixture({ embeddedRunId: `fixture-old-${runId}` })
const embeddedPositive = call(embeddedPositiveFixture, "matching-embedded-run-id")
assert.equal(embeddedPositive.status, "stale_formal_stage_lock_quarantined_closed")
assert.equal(fs.existsSync(embeddedPositiveFixture.lock), false)
const negatives = {}
function reject(name, prepare, mutate) { const value = prepare(); try { const packageId = `fixture-package-${runId}-${name}`; const input = { root: ROOT, packageId, lockPath: rel(value.lock), lockSha256: sha(value.lock), interruptionTerminalPath: rel(value.terminal), interruptionTerminalSha256: sha(value.terminal), quarantineRoot: `${rel(value.root)}/quarantine-parent/${packageId}`, fixtureMode: true }; mutate(input, value); repairStaleFormalStageLock(input); negatives[name] = false } catch { negatives[name] = true } }
reject("active_pid_rejected", () => fixture({ pid: process.pid }), () => {})
reject("path_run_identity_mismatch_rejected", () => fixture({ progressPathRunId: "different-run" }), () => {})
reject("embedded_run_identity_mismatch_rejected", () => fixture({ embeddedRunId: "different-run" }), () => {})
reject("malformed_progress_path_rejected", () => fixture({ malformedProgressPath: true }), () => {})
reject("lock_hash_mismatch_rejected", () => fixture(), (input) => { input.lockSha256 = "0".repeat(64) })
reject("terminal_status_rejected", () => fixture({ terminalStatus: "running" }), () => {})
reject("quarantine_injection_rejected", () => fixture(), (input) => { input.quarantineRoot = ".runtime/ai-painter/outside" })
reject("historical_quarantine_output_rejected", () => fixture(), (input) => { fs.mkdirSync(path.resolve(ROOT, input.quarantineRoot), { recursive: true }) })
assert.equal(Object.values(negatives).every(Boolean), true)
const report = { schemaVersion: "ai-painter-stage4-stale-formal-lock-repair-cpu-report-v3", status: "passed_stage4_stale_formal_lock_parent_namespace_and_real_progress_identity_cpu_regression", runId, positivePassed: 2, positiveTotal: 2, negativePassed: Object.values(negatives).filter(Boolean).length, negativeTotal: Object.keys(negatives).length, missingFixedParentCreatedPassed: true, freshPackageDirectoryNonOverwritingPassed: true, realProgressSchemaWithoutRunIdPassed: true, embeddedAndPathIdentityAgreementPassed: true, negative: negatives, realFormalLockRead: false, realFormalLockModified: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: new Date().toISOString() }
fs.writeFileSync(path.join(fixtureRoot, "cpu-report.json"), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
console.log(JSON.stringify(report, null, 2))

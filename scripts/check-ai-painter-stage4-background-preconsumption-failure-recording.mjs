import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { recordBackgroundPreconsumptionFailure } from "./run-ai-painter-stage4-stage0-to-80-background.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "run_id_required")
const fixtureRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-background-preconsumption-failure-cpu-regressions/${runId}`)
assert.equal(fs.existsSync(fixtureRoot), false, "fixture_root_exists")
fs.mkdirSync(fixtureRoot, { recursive: true })
let slot = 0

function fixture() {
  slot += 1
  const root = path.join(fixtureRoot, `fixture-${slot}`)
  fs.mkdirSync(root, { recursive: true })
  const packageId = `fixture-stage4-package-${runId}-${slot}`
  const authorizationPaths = {}
  for (const role of ["coordinator", "stage0", "stage1", "stage2"]) {
    const requestPath = path.join(root, role, "request.json")
    fs.mkdirSync(path.dirname(requestPath), { recursive: true })
    fs.writeFileSync(requestPath, `${JSON.stringify({ schemaVersion: "project-owner-write-authorization-v2", authorizationId: `${packageId}-${role}`, status: "authorized" })}\n`)
    authorizationPaths[role] = rel(requestPath)
  }
  const packagePath = path.join(root, "package.json")
  const packageValue = {
    packageId,
    coordinator: { authorization: { path: authorizationPaths.coordinator } },
    steps: ["stage0", "stage1", "stage2"].map((role) => ({ role, authorization: { path: authorizationPaths[role] } })),
  }
  fs.writeFileSync(packagePath, `${JSON.stringify(packageValue)}\n`)
  return { root, packageId, packagePath, packageValue, consumptionRoot: path.join(root, "consumptions"), failureRoot: path.join(root, "failure") }
}

const positiveFixture = fixture()
const positive = recordBackgroundPreconsumptionFailure({
  root: ROOT,
  packageValue: positiveFixture.packageValue,
  packagePath: rel(positiveFixture.packagePath),
  packageSha256: sha(positiveFixture.packagePath),
  phase: "stale_formal_lock_recovery",
  error: new Error("fixture_preconsumption_failure"),
  failureRootOverride: rel(positiveFixture.failureRoot),
  consumptionRootOverride: rel(positiveFixture.consumptionRoot),
  appendEvent: false,
})
assert.equal(positive.status, "stage4_background_start_failed_before_authorization_consumption_closed")
const terminal = read(path.resolve(ROOT, positive.terminal.path))
assert.equal(terminal.coordinatorAuthorizationConsumed, false)
assert.equal(terminal.stageAuthorizationsConsumed, false)
assert.equal(terminal.gpuStarted, false)
assert.equal(terminal.trainingStarted, false)
assert.equal(terminal.authorizationStates.length, 4)
assert.equal(terminal.authorizationStates.every((entry) => entry.consumed === false), true)

const negatives = {}
function reject(name, callback) { try { callback(); negatives[name] = false } catch { negatives[name] = true } }
reject("output_reuse_rejected", () => recordBackgroundPreconsumptionFailure({ root: ROOT, packageValue: positiveFixture.packageValue, packagePath: rel(positiveFixture.packagePath), packageSha256: sha(positiveFixture.packagePath), phase: "background_process_broker", error: new Error("repeat"), failureRootOverride: rel(positiveFixture.failureRoot), consumptionRootOverride: rel(positiveFixture.consumptionRoot), appendEvent: false }))
const consumedFixture = fixture()
fs.mkdirSync(path.join(consumedFixture.consumptionRoot, `${consumedFixture.packageId}-coordinator`), { recursive: true })
reject("consumed_authorization_rejected", () => recordBackgroundPreconsumptionFailure({ root: ROOT, packageValue: consumedFixture.packageValue, packagePath: rel(consumedFixture.packagePath), packageSha256: sha(consumedFixture.packagePath), phase: "stale_formal_lock_recovery", error: new Error("consumed"), failureRootOverride: rel(consumedFixture.failureRoot), consumptionRootOverride: rel(consumedFixture.consumptionRoot), appendEvent: false }))
const injectionFixture = fixture()
reject("package_path_injection_rejected", () => recordBackgroundPreconsumptionFailure({ root: ROOT, packageValue: injectionFixture.packageValue, packagePath: "../outside.json", packageSha256: "0".repeat(64), phase: "stale_formal_lock_recovery", error: new Error("injection"), failureRootOverride: rel(injectionFixture.failureRoot), consumptionRootOverride: rel(injectionFixture.consumptionRoot), appendEvent: false }))
const hashFixture = fixture()
reject("package_hash_mismatch_rejected", () => recordBackgroundPreconsumptionFailure({ root: ROOT, packageValue: hashFixture.packageValue, packagePath: rel(hashFixture.packagePath), packageSha256: "0".repeat(64), phase: "stale_formal_lock_recovery", error: new Error("hash"), failureRootOverride: rel(hashFixture.failureRoot), consumptionRootOverride: rel(hashFixture.consumptionRoot), appendEvent: false }))
assert.equal(Object.values(negatives).every(Boolean), true)

const report = {
  schemaVersion: "ai-painter-stage4-background-preconsumption-failure-recording-cpu-report-v1",
  status: "passed_background_preconsumption_failure_recording_cpu_regression",
  runId,
  positivePassed: 1,
  positiveTotal: 1,
  negativePassed: Object.values(negatives).filter(Boolean).length,
  negativeTotal: Object.keys(negatives).length,
  negative: negatives,
  coordinatorAuthorizationConsumed: false,
  stageAuthorizationsConsumed: false,
  realExecutionOutputCreated: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
}
fs.writeFileSync(path.join(fixtureRoot, "cpu-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" })
console.log(JSON.stringify(report, null, 2))

function rel(value) { return path.relative(ROOT, value).replaceAll("\\", "/") }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }

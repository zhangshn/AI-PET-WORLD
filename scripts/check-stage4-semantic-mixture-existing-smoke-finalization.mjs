import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { validateExistingSemanticMixtureSmokeFinalizationAuthorization } from "./run-ai-assisted-v8-r5-stage4-smoke.mjs"

const ROOT = process.cwd()
const AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-semantic-mixture-existing-smoke-finalization-20260813-033000000/implementation-authorization.json"
const REPORT = argument("--output-report") ?? ".runtime/ai-painter/stage4-semantic-mixture-existing-smoke-finalization-support/20260813-033000000/cpu-report.json"
const auth = readJson(AUTH)
const authSha256 = sha256File(AUTH)
const positive = []
const negative = []

positive.push(run("bound_completed_smoke_accepts_readonly_finalization", () => {
  const context = validateExistingSemanticMixtureSmokeFinalizationAuthorization(AUTH, auth, authSha256)
  assert.equal(context.progress.currentEpoch, 30)
  assert.equal(context.progress.liveProgress.optimizerStep, 90)
  assert.equal(context.manifest.modelStateHashEvidence.weightsChanged, true)
}))

for (const [name, mutate, expected] of [
  ["wrong_authorization_hash_rejected", () => [AUTH, auth, "0".repeat(64)], "authorization_hash_invalid"],
  ["trainer_action_injection_rejected", (copy) => { copy.implementationActions.push("trainer_start"); return [AUTH, copy, authSha256] }, "actions_invalid"],
  ["missing_trainer_denial_rejected", (copy) => { copy.explicitlyDeniedActions = copy.explicitlyDeniedActions.filter((x) => x !== "trainer_start"); return [AUTH, copy, authSha256] }, "denial_missing"],
  ["checkpoint_weight_read_activation_rejected", (copy) => { copy.sourceEvidence.smokeCheckpoint.readWeightsAuthorized = true; return [AUTH, copy, authSha256] }, "checkpoint_boundary_invalid"],
]) {
  negative.push(runReject(name, () => {
    const copy = structuredClone(auth)
    const args = mutate(copy)
    return validateExistingSemanticMixtureSmokeFinalizationAuthorization(...args)
  }, expected))
}

const report = {
  schemaVersion: "ai-painter-stage4-semantic-mixture-existing-smoke-finalization-cpu-report-v1",
  status: positive.every((row) => row.passed) && negative.every((row) => row.passed) ? "passed" : "failed_closed",
  recordedAtUtc: new Date().toISOString(),
  authorization: { path: AUTH, sha256: authSha256 },
  sourceSmokeRunId: "20260813-032500000",
  positive,
  negative,
  boundaries: { trainerStarted: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, checkpointWeightsRead: false, smokeRerun: false },
}
writeImmutableJson(REPORT, report)
console.log(JSON.stringify({ ...report, reportPath: REPORT, reportSha256: sha256File(REPORT) }, null, 2))
process.exit(report.status === "passed" ? 0 : 1)

function run(key, fn) { try { fn(); return { key, passed: true } } catch (error) { return { key, passed: false, error: String(error?.message ?? error) } } }
function runReject(key, fn, expected) { try { fn(); return { key, passed: false, error: "unexpected_accept" } } catch (error) { const message = String(error?.message ?? error); return { key, passed: message.includes(expected), error: message } } }
function argument(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function writeImmutableJson(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); const handle = fs.openSync(absolute, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }

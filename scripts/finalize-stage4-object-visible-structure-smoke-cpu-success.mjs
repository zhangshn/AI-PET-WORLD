import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-smoke-cpu-success-finalization-20260815-071000000"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const AUTHORIZATION_SHA256 = "1052fea60392ff036987101869999bebe7c49e3377f9bbb60f930de858502849"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const CONSUMPTION_SHA256 = "3e3602e65b59cd875d28304eb333cc08bf2cbd4972fdacd707f13c6a479ee3be"
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-smoke-cpu-success-finalizations/20260815-071000000"
const RUNNER = "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"

const authorization = readVerifiedJson(AUTHORIZATION_PATH, AUTHORIZATION_SHA256)
const consumption = readVerifiedJson(CONSUMPTION_PATH, CONSUMPTION_SHA256)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(consumption.status, "stage4_object_visible_structure_smoke_cpu_success_finalization_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.oneTimeConsumption, true)
for (const [name, item] of Object.entries(authorization.bindings)) assert.equal(sha256File(item.path), item.sha256, `binding changed: ${name}`)
assert.equal(fs.existsSync(resolve(OUTPUT_ROOT)), false, "finalization output already exists")
const cpuReport = readJson(authorization.bindings.cpuReport.path)
const attestation = readJson(authorization.bindings.implementationAttestation.path)
assert.equal(cpuReport.status, "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)
assert.equal(cpuReport.positive.trainerActiveObjectQualificationPassedBeforeModelEntry, true)
assert.equal(cpuReport.negative.trainerChangedObjectQualificationRejected, true)
assert.equal(attestation.trainerSha256, sha256File(TRAINER))
assert.equal(attestation.runnerSha256, sha256File(RUNNER))
assert.equal(attestation.cpuCheckerSha256, sha256File(CHECKER))
fs.mkdirSync(resolve(OUTPUT_ROOT), { recursive: true })

const proposedAuthorization = structuredClone(readJson(authorization.bindings.sourceOwnerRequest.path).proposedAuthorization)
const smokeId = "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260815-071500000"
proposedAuthorization.requestId = smokeId
proposedAuthorization.commandRef = smokeId
proposedAuthorization.bindings.implementationAuthorization = binding(authorization.bindings.implementationAuthorization.path)
proposedAuthorization.bindings.implementationConsumption = binding(authorization.bindings.implementationConsumption.path)
proposedAuthorization.bindings.cpuReport = binding(authorization.bindings.cpuReport.path)
proposedAuthorization.bindings.implementationAttestation = binding(authorization.bindings.implementationAttestation.path)
proposedAuthorization.codeBindings.runner = binding(RUNNER)
proposedAuthorization.codeBindings.cpuChecker = binding(CHECKER)
proposedAuthorization.codeBindings.trainer = binding(TRAINER)
for (const [key, suffix] of Object.entries({
  consumptionPath: "execution-consumption.json",
  activeConfigPath: "active-config.json",
  trainingOutputDirectory: "training-output",
  finalizationDirectory: "finalization",
  preflightReportPath: "preflight-report.json",
})) proposedAuthorization.execution[key] = `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-071500000/${suffix}`

const reportPath = `${OUTPUT_ROOT}/finalization-report.json`
writeImmutableJson(reportPath, {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-cpu-success-finalization-report-v1",
  status: "stage4_object_visible_structure_smoke_cpu_success_formally_finalized",
  recordedAtUtc: new Date().toISOString(),
  authorization: binding(AUTHORIZATION_PATH),
  consumption: binding(CONSUMPTION_PATH),
  cpuReport: binding(authorization.bindings.cpuReport.path),
  implementationAttestation: binding(authorization.bindings.implementationAttestation.path),
  implementationAuthorization: binding(authorization.bindings.implementationAuthorization.path),
  implementationConsumption: binding(authorization.bindings.implementationConsumption.path),
  previousRecorderFailure: binding(authorization.bindings.recorderFailureTerminal.path),
  cpuRegressionRerun: false,
  gpuStarted: false,
  trainingStarted: false,
})
const ownerRequestPath = `${OUTPUT_ROOT}/owner-action-request.json`
writeImmutableJson(ownerRequestPath, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "awaiting_owner_authorization_not_active",
  requestId: smokeId,
  commandRef: smokeId,
  requestedAction: "execute_one_fresh_independent_object_visible_structure_30_epoch_semantic_mixture_gpu_smoke",
  finalizationReport: binding(reportPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  proposedAuthorization,
  generatedBy: "local_ai_painter_governance_program",
  externalEmployeeDecisionAuthority: false,
})
const terminalPath = `${OUTPUT_ROOT}/phase-terminal.json`
writeImmutableJson(terminalPath, {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-cpu-success-finalization-terminal-v1",
  status: "stage4_object_visible_structure_smoke_cpu_success_finalized_closed",
  recordedAtUtc: new Date().toISOString(),
  finalizationReport: binding(reportPath),
  ownerActionRequest: binding(ownerRequestPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "materialize_and_execute_fresh_independent_30_epoch_smoke_once",
  gpuStarted: false,
  trainingStarted: false,
  automaticRetryStarted: false,
})
writeImmutableJson(`${OUTPUT_ROOT}/local-task-capsule.json`, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_object_visible_structure_smoke_cpu_success_finalized_closed",
  recordedAtUtc: new Date().toISOString(),
  currentStep: "fresh_independent_30_epoch_smoke_ready_not_started",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: binding(terminalPath),
  ownerActionRequest: binding(ownerRequestPath),
  nextLegalAction: "materialize_and_execute_fresh_independent_30_epoch_smoke_once",
})
appendAiPainterProgramEvent({
  action: "finalize_stage4_object_visible_structure_smoke_cpu_success",
  runId: "20260815-071000000",
  kind: "stage4_object_visible_structure_smoke_cpu_success_finalized",
  status: "success",
  title: "Stage 4 object visible-structure Smoke CPU success finalized",
  titleZh: "Stage 4 四对象 Smoke CPU 成功证据已续结",
  detail: `CPU ${cpuReport.positivePassed}/${cpuReport.positiveTotal} positive and ${cpuReport.negativePassed}/${cpuReport.negativeTotal} negative retained without rerun`,
  detailZh: `保留 CPU 正向 ${cpuReport.positivePassed}/${cpuReport.positiveTotal}、反向 ${cpuReport.negativePassed}/${cpuReport.negativeTotal}，未重复回归`,
  script: projectPath(import.meta.filename),
  currentStep: "fresh_independent_30_epoch_smoke_ready_not_started",
  evidencePath: terminalPath,
  nextAction: "materialize_and_execute_fresh_independent_30_epoch_smoke_once",
  nextActionZh: "生成并执行一次全新独立 30 Epoch Smoke",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({ status: "stage4_object_visible_structure_smoke_cpu_success_finalized_closed", terminal: binding(terminalPath), ownerActionRequest: binding(ownerRequestPath) }, null, 2))

function resolve(value) { return path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function readVerifiedJson(value, expected) { assert.equal(sha256File(value), expected, `SHA-256 changed: ${value}`); return readJson(value) }
function binding(value) { return { path: projectPath(value), sha256: sha256File(value) } }
function writeImmutableJson(value, body) {
  const absolute = resolve(value)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}

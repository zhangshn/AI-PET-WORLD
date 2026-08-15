import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-smoke-unique-scope-correction-20260815-064500000"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const AUTHORIZATION_SHA256 = "ebac8f16b9d1ef5282e061c70f5785e2a6d21bd8129123484aa564a937b3b5d0"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const CONSUMPTION_SHA256 = "5c5f48b426310b3a46c6b2dd09d75b8d6bcb05118d68285f2f114c55be1697b8"
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-smoke-unique-scope-corrections/20260815-064500000"
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const RUNNER = "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const SOURCE_OWNER_REQUEST = ".runtime/ai-painter/stage4-object-visible-structure-smoke-integrations/20260815-061900000/owner-action-request.json"
const FAILED_TERMINAL = ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-063000000/finalization/phase-terminal.json"

const authorization = readVerifiedJson(AUTHORIZATION_PATH, AUTHORIZATION_SHA256)
const consumption = readVerifiedJson(CONSUMPTION_PATH, CONSUMPTION_SHA256)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(consumption.status, "stage4_object_visible_structure_smoke_unique_scope_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.oneTimeConsumption, true)
for (const [name, item] of Object.entries(authorization.bindings)) {
  if (["cpuCheckerBefore", "recorderBefore"].includes(name)) continue
  assert.equal(sha256File(item.path), item.sha256, `binding changed: ${name}`)
}
assert.equal(readJson(FAILED_TERMINAL).automaticRetryStarted, false)
assert.equal(fs.existsSync(resolve(OUTPUT_ROOT)), false, "correction output already exists")
fs.mkdirSync(resolve(OUTPUT_ROOT), { recursive: true })

appendAiPainterProgramEvent({
  action: "record_stage4_object_visible_structure_smoke_trainer_lineage_correction",
  runId: "20260815-064500000",
  kind: "stage4_object_visible_structure_smoke_trainer_lineage_correction_started",
  status: "running",
  title: "Stage 4 object visible-structure Smoke Trainer lineage correction started",
  titleZh: "Stage 4 四对象 Smoke Trainer 血缘修正已开始",
  detail: "CPU-only bounded correction after pre-CUDA Smoke contract failure",
  detailZh: "仅对 CUDA 启动前的 Smoke 合同失败执行 CPU 有界修正",
  script: projectPath(import.meta.filename),
  currentStep: "cpu_contract_regression",
  evidencePath: FAILED_TERMINAL,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

for (const [command, args] of [
  ["node", ["--check", resolve(RUNNER)]],
  ["node", ["--check", resolve(import.meta.filename)]],
  [resolve(PYTHON), ["-m", "py_compile", resolve(TRAINER), resolve(CHECKER)]],
]) {
  const check = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", windowsHide: true })
  if (check.status !== 0) throw new Error(`syntax check failed: ${check.stderr || check.stdout}`)
}

const cpuReportPath = `${OUTPUT_ROOT}/cpu-report.json`
const implementationAttestationPath = `${OUTPUT_ROOT}/implementation-attestation.json`
const cpu = spawnSync(resolve(PYTHON), [
  resolve(CHECKER),
  "--fact-conditioned-semantic-mixture-stage4-smoke-contract",
  "--report", resolve(cpuReportPath),
  "--implementation-attestation", resolve(implementationAttestationPath),
  "--implementation-authorization", resolve(AUTHORIZATION_PATH),
  "--implementation-consumption", resolve(CONSUMPTION_PATH),
], { cwd: ROOT, encoding: "utf8", windowsHide: true })
if (cpu.status !== 0) throw new Error(`CPU contract failed: ${cpu.stderr || cpu.stdout}`)
const cpuReport = readJson(cpuReportPath)
const attestation = readJson(implementationAttestationPath)
assert.equal(cpuReport.status, "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)
assert.equal(cpuReport.positive.trainerActiveObjectQualificationPassedBeforeModelEntry, true)
assert.equal(cpuReport.negative.trainerChangedObjectQualificationRejected, true)
assert.equal(attestation.trainerSha256, sha256File(TRAINER))
assert.equal(attestation.cpuCheckerSha256, sha256File(CHECKER))

const reportPath = `${OUTPUT_ROOT}/correction-report.json`
writeImmutableJson(reportPath, {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-trainer-lineage-correction-report-v1",
  status: "stage4_object_visible_structure_smoke_trainer_lineage_correction_cpu_passed",
  recordedAtUtc: new Date().toISOString(),
  authorization: binding(AUTHORIZATION_PATH),
  consumption: binding(CONSUMPTION_PATH),
  failedSmokeTerminal: binding(FAILED_TERMINAL),
  cpuReport: binding(cpuReportPath),
  implementationAttestation: binding(implementationAttestationPath),
  code: { trainer: binding(TRAINER), runner: binding(RUNNER), cpuChecker: binding(CHECKER) },
  rootCause: "runner accepted object visible-structure Phase0 while Trainer Smoke lineage omitted that qualification branch",
  correction: "Trainer now validates the same immutable Phase0 terminal, finalization equality, CUDA update report, CPU report, and inactive object contract",
  gpuStarted: false,
  trainingStarted: false,
  automaticRetryStarted: false,
})

const oldProposal = readJson(SOURCE_OWNER_REQUEST).proposedAuthorization
const proposedAuthorization = structuredClone(oldProposal)
const newSmokeId = "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260815-070000000"
proposedAuthorization.requestId = newSmokeId
proposedAuthorization.commandRef = newSmokeId
proposedAuthorization.bindings.implementationAuthorization = binding(AUTHORIZATION_PATH)
proposedAuthorization.bindings.implementationConsumption = binding(CONSUMPTION_PATH)
proposedAuthorization.bindings.cpuReport = binding(cpuReportPath)
proposedAuthorization.bindings.implementationAttestation = binding(implementationAttestationPath)
proposedAuthorization.codeBindings.trainer = binding(TRAINER)
proposedAuthorization.codeBindings.runner = binding(RUNNER)
proposedAuthorization.codeBindings.cpuChecker = binding(CHECKER)
for (const [key, suffix] of Object.entries({
  consumptionPath: "execution-consumption.json",
  activeConfigPath: "active-config.json",
  trainingOutputDirectory: "training-output",
  finalizationDirectory: "finalization",
  preflightReportPath: "preflight-report.json",
})) proposedAuthorization.execution[key] = `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-070000000/${suffix}`

const ownerRequestPath = `${OUTPUT_ROOT}/owner-action-request.json`
writeImmutableJson(ownerRequestPath, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "awaiting_owner_authorization_not_active",
  requestId: newSmokeId,
  commandRef: newSmokeId,
  requestedAction: "execute_one_fresh_independent_object_visible_structure_30_epoch_semantic_mixture_gpu_smoke",
  retiredFailedAuthorization: binding(authorization.bindings.failedSmokeAuthorization.path),
  correctionReport: binding(reportPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  proposedAuthorization,
  generatedBy: "local_ai_painter_governance_program",
  externalEmployeeDecisionAuthority: false,
})

const terminalPath = `${OUTPUT_ROOT}/phase-terminal.json`
writeImmutableJson(terminalPath, {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-trainer-lineage-correction-terminal-v1",
  status: "stage4_object_visible_structure_smoke_trainer_lineage_correction_succeeded_closed",
  recordedAtUtc: new Date().toISOString(),
  correctionReport: binding(reportPath),
  ownerActionRequest: binding(ownerRequestPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "materialize_fresh_smoke_authorization_and_execute_once",
  gpuStarted: false,
  trainingStarted: false,
  automaticRetryStarted: false,
})
writeImmutableJson(`${OUTPUT_ROOT}/local-task-capsule.json`, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_object_visible_structure_smoke_trainer_lineage_correction_succeeded_closed",
  recordedAtUtc: new Date().toISOString(),
  currentStep: "fresh_independent_30_epoch_smoke_ready_not_started",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: binding(terminalPath),
  ownerActionRequest: binding(ownerRequestPath),
  nextLegalAction: "materialize_fresh_smoke_authorization_and_execute_once",
})

appendAiPainterProgramEvent({
  action: "record_stage4_object_visible_structure_smoke_trainer_lineage_correction",
  runId: "20260815-064500000",
  kind: "stage4_object_visible_structure_smoke_trainer_lineage_correction_completed",
  status: "success",
  title: "Stage 4 object visible-structure Smoke Trainer lineage correction completed",
  titleZh: "Stage 4 四对象 Smoke Trainer 血缘修正已完成",
  detail: `CPU ${cpuReport.positivePassed}/${cpuReport.positiveTotal} positive and ${cpuReport.negativePassed}/${cpuReport.negativeTotal} negative passed`,
  detailZh: `CPU 正向 ${cpuReport.positivePassed}/${cpuReport.positiveTotal}、反向 ${cpuReport.negativePassed}/${cpuReport.negativeTotal} 通过`,
  script: projectPath(import.meta.filename),
  currentStep: "fresh_independent_30_epoch_smoke_ready_not_started",
  evidencePath: terminalPath,
  nextAction: "materialize_fresh_smoke_authorization_and_execute_once",
  nextActionZh: "生成全新 Smoke 授权并执行一次",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  status: "stage4_object_visible_structure_smoke_trainer_lineage_correction_succeeded_closed",
  cpu: { positive: `${cpuReport.positivePassed}/${cpuReport.positiveTotal}`, negative: `${cpuReport.negativePassed}/${cpuReport.negativeTotal}` },
  terminal: binding(terminalPath),
  ownerActionRequest: binding(ownerRequestPath),
}, null, 2))

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

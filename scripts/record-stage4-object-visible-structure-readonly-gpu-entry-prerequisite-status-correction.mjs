import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-entry-prerequisite-status-correction-20260815-012000000"
const SCOPE = "correct_one_cpu_prerequisite_terminal_status_literal_and_regress_only"
const AUTH_SHA = "f2b12d0ae31d18f879f3115ce5525c1366b49c529a7c50945078bfc73edf757c"
const CONSUMPTION_SHA = "da3801eac2f39a26850423ea279706e97778610e2cc9ef19a4fd5d2b55f8ddc6"
const RUNNER = "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py"
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py"
const TARGET = "scripts/record-stage4-object-visible-structure-readonly-gpu-entry-prerequisite-status-correction.mjs"
const OLD = "stage4_object_visible_structure_supervision_cpu_implementation_succeeded_closed"
const CURRENT = "stage4_object_visible_structure_supervision_cpu_succeeded_closed"
const STALE_GPU_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-010000000/gpu-execution-authorization.json"
const STALE_GPU_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-010000000/gpu-execution-consumption.json"
const OLD_IMPLEMENTATION_REPORT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-entry-implementations/20260815-005000000/implementation-report.json"
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-entry-prerequisite-status-corrections/20260815-012000000"

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationPath = resolveProject(arg("--authorization"))
const consumptionPath = resolveProject(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(consumption.status, "cpu_prerequisite_status_correction_authorization_atomically_consumed")
assert.equal(consumption.oneTimeConsumption, true)
assert.equal(consumption.staleGpuAuthorizationConsumed, false)
for (const field of ["gpuUsed", "autogradExecuted", "checkpointFileRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) {
  assert.equal(consumption[field], false, `${field}_opened`)
}
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  if (name === "runnerPreimage") {
    assert.deepEqual(binding, { path: RUNNER, sha256: "53b4b0f4f2162c10e6289c5b7a741569b9ba2f930816c3ac958989d38fdc2e17" })
    continue
  }
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(fs.existsSync(resolveProject(STALE_GPU_CONSUMPTION)), false, "stale_gpu_authorization_consumed")

const runnerPath = resolveProject(RUNNER)
const checkerPath = resolveProject(CHECKER)
const source = fs.readFileSync(runnerPath, "utf8")
assert.equal(source.split(OLD).length - 1, 0, "old_status_literal_remains")
assert.equal(source.split(CURRENT).length - 1, 1, "corrected_status_literal_count_invalid")
assert.equal(sha(checkerPath), authorization.sourceEvidence.cpuChecker.sha256, "cpu_checker_changed")

const python = resolveProject("ml/ai-painter/.venv/Scripts/python.exe")
const safeEnvironment = { ...process.env, CUDA_VISIBLE_DEVICES: "" }
const syntax = spawnSync(python, ["-m", "py_compile", runnerPath], { cwd: ROOT, encoding: "utf8", env: safeEnvironment })
assert.equal(syntax.status, 0, `syntax_failed:${syntax.stderr}`)
const regression = spawnSync(python, [
  checkerPath,
  "--object-visible-structure-implementation-contract",
  "--implementation-authorization", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/authorization.json",
  "--implementation-consumption", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/implementation-consumption.json",
], { cwd: ROOT, encoding: "utf8", env: safeEnvironment })
assert.equal(regression.status, 0, `cpu_regression_failed:${regression.stderr}`)
const cpu = JSON.parse(regression.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

const actualTerminal = read(resolveProject(authorization.sourceEvidence.actualCpuTerminal.path))
assert.equal(actualTerminal.status, CURRENT)
const oldImplementation = read(resolveProject(OLD_IMPLEMENTATION_REPORT))
const currentRunnerSha = sha(runnerPath)
const attestationLineageStale = oldImplementation.runnerSha256 !== currentRunnerSha
assert.equal(attestationLineageStale, true, "expected_attestation_lineage_blocker_missing")

const output = resolveProject(OUTPUT)
assert.equal(fs.existsSync(output), false, "correction_output_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "correction-report.json"),
  retirement: path.join(output, "stale-gpu-authorization-retirement.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
writeJsonAtomic(files.cpu, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-prerequisite-status-correction-cpu-report-v1",
  status: "status_literal_correction_cpu_contract_passed",
  positivePassed: cpu.positivePassed,
  positiveTotal: cpu.positiveTotal,
  negativePassed: cpu.negativePassed,
  negativeTotal: cpu.negativeTotal,
  checks: {
    authorizationAndConsumptionBound: true,
    oldLiteralAbsent: true,
    correctedLiteralOccursExactlyOnce: true,
    actualImmutableTerminalMatchesCorrectedLiteral: true,
    pythonSyntaxPassed: true,
    staleGpuAuthorizationUnconsumed: true,
  },
  executionBoundary: {
    gpuUsed: false,
    autogradExecuted: false,
    checkpointFileRead: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-prerequisite-status-correction-report-v1",
  status: "authorized_status_literal_corrected_cpu_verified",
  runId: "20260814-154900000-stage0",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  runner: bind(runnerPath),
  cpuChecker: bind(checkerPath),
  cpuReport: bind(files.cpu),
  correction: {
    file: RUNNER,
    oldLiteral: OLD,
    newLiteral: CURRENT,
    replacementCount: 1,
  },
  newlyDiscoveredBlocker: {
    code: "entry_implementation_attestation_runner_sha_stale_after_authorized_correction",
    oldImplementationReport: bind(resolveProject(OLD_IMPLEMENTATION_REPORT)),
    attestedRunnerSha256: oldImplementation.runnerSha256,
    currentRunnerSha256: currentRunnerSha,
    impact: "a_new_gpu_authorization_would_fail_implementation_attestation_before_gpu_consumption",
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.retirement, {
  schemaVersion: "stage4-object-visible-structure-stale-gpu-authorization-retirement-v1",
  status: "stale_unconsumed_authorization_retired_without_consumption",
  staleAuthorization: bind(resolveProject(STALE_GPU_AUTH)),
  consumptionPath: STALE_GPU_CONSUMPTION,
  consumptionExists: false,
  reason: "runner_binding_and_implementation_attestation_predate_authorized_status_correction",
  reusable: false,
  gpuUsed: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-prerequisite-status-correction-terminal-v1",
  status: "status_literal_correction_succeeded_gpu_request_blocked_by_stale_attestation_lineage",
  runId: "20260814-154900000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  correctionReport: bind(files.report),
  cpuReport: bind(files.cpu),
  staleGpuAuthorizationRetirement: bind(files.retirement),
  nextLegalAction: "owner_authorize_bounded_entry_implementation_attestation_lineage_correction_or_exit",
  gpuUsed: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  modelLoaded: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_authorize_bounded_entry_implementation_attestation_lineage_correction_or_exit",
  requestedScope: "accept_one_new_immutable_correction_attestation_path_and_regress_cpu_only",
  boundCorrectionReport: bind(files.report),
  boundCorrectionTerminal: bind(files.terminal),
  boundStaleGpuAuthorizationRetirement: bind(files.retirement),
  allowedProposedActions: [
    "bind_a_new_immutable_correction_attestation_in_future_gpu_authorization",
    "update_only_object_visible_structure_attestation_path_contract",
    "run_python_syntax_and_cpu_positive_negative_contract_regression",
    "write_new_inactive_gpu_owner_request_terminal_capsule_ledger_and_sqlite",
  ],
  gpuRequestedNow: false,
  trainingRequested: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 four-object GPU entry prerequisite status corrected; attestation lineage correction not authorized",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "entry_implementation_attestation_runner_sha_stale_after_authorized_correction",
  nextLegalAction: "owner_authorize_bounded_entry_implementation_attestation_lineage_correction_or_exit",
  forbiddenActions: authorization.deniedActions,
  evidence: {
    correctionReport: bind(files.report),
    cpuReport: bind(files.cpu),
    staleGpuAuthorizationRetirement: bind(files.retirement),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsed: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, runnerPath, resolveProject(TARGET), ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-entry-status-correction-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_gpu_entry_prerequisite_status_correction",
  runId: REQUEST_ID,
  kind: "cpu_contract_correction",
  status: "success",
  title: "Stage4 GPU entry prerequisite status corrected; attestation lineage blocker recorded",
  titleZh: "Stage4 GPU 入口前置终态已修正，实施证明血缘阻断已登记",
  detailZh: `唯一状态字符串已修正，CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；旧 GPU 授权未消费，未启动 GPU、autograd、Checkpoint 读取、模型加载或训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  correctionReport: bind(files.report),
  cpuReport: bind(files.cpu),
  staleGpuAuthorizationRetirement: bind(files.retirement),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))

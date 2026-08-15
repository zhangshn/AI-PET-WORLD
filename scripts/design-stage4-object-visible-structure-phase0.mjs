import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  AUTHORIZATION_SHA256,
  CONSUMPTION_SHA256,
  FORBIDDEN_ACTIONS,
  REQUEST_ID,
  buildInactivePhase0Design,
  validateAuthorizationAndConsumption,
  validatePhase0DesignSource,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-design.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const CORRECTION_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-design-output-parent-correction-20260815-041500000"
const CORRECTION_AUTHORIZATION_SHA256 = "6fa49fa03264e0bd0d0a4d6dac4b43ed75df5aa7c174fb6e2b766ec35a125e1f"
const CORRECTION_CONSUMPTION_SHA256 = "4a7aacebfd9c8efc58d7578fa0355428af1223a4c391799596449adddae24be2"
const PRE_CORRECTION_RUNNER_SHA256 = "e7bcc56c5e591aa57ce7c0a2befe80206eab309e97d4d5ff7cca0ede30f9f620"
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-designs/20260815-041500000"
const NEXT_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-execution-entry-implementation-20260815-043000000"
const NEXT_OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-execution-entry-implementations/20260815-043000000"
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.ok(value, "path_argument_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })

const authorizationPath = projectFile(arg("--authorization"))
const consumptionPath = projectFile(arg("--consumption"))
assert.equal(shaFile(authorizationPath), CORRECTION_AUTHORIZATION_SHA256, "authorization_sha256_mismatch")
assert.equal(shaFile(consumptionPath), CORRECTION_CONSUMPTION_SHA256, "consumption_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-phase0-design-output-parent-correction-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, CORRECTION_REQUEST_ID)
assert.equal(authorization.commandRef, CORRECTION_REQUEST_ID)
assert.equal(authorization.scope, "one_cpu_only_output_parent_creation_correction_and_fresh_phase0_design_execution")
assert.equal(consumption.schemaVersion, "ai-painter-stage4-object-visible-structure-phase0-design-output-parent-correction-consumption-v1")
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_design_output_parent_correction_authorization_atomically_consumed")
assert.equal(consumption.requestId, CORRECTION_REQUEST_ID)
assert.equal(consumption.commandRef, CORRECTION_REQUEST_ID)
assert.equal(consumption.scope, authorization.scope)
assert.equal(consumption.authorizationSha256, CORRECTION_AUTHORIZATION_SHA256)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) assert.equal(consumption[key], false, `${key}_must_be_false`)
assert.equal(relative(consumptionPath), authorization.execution.consumptionPath)
assert.equal(authorization.execution.outputDirectory, OUTPUT)
assert.equal(fs.existsSync(projectFile(OUTPUT)), false, "phase0_design_output_already_exists")

for (const [name, binding] of Object.entries(authorization.bindings)) {
  const file = projectFile(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_binding_missing`)
  if (name === "failedRunner") assert.equal(binding.sha256, PRE_CORRECTION_RUNNER_SHA256, "failed_runner_identity_changed")
  else assert.equal(shaFile(file), binding.sha256, `${name}_binding_changed`)
}
const failureReport = read(projectFile(authorization.bindings.failureReport.path))
assert.equal(failureReport.status, "phase0_design_output_namespace_creation_failed_closed")
assert.equal(failureReport.failureCode, "output_parent_missing_non_recursive_mkdir")
assert.equal(failureReport.failedRunner.sha256, PRE_CORRECTION_RUNNER_SHA256)
const failureTerminal = read(projectFile(authorization.bindings.failureTerminal.path))
assert.equal(failureTerminal.status, "stage4_object_visible_structure_phase0_design_output_registration_failed_closed")
assert.equal(failureTerminal.automaticRetryStarted, false)

const priorAuthorizationPath = projectFile(authorization.bindings.priorAuthorization.path)
const priorConsumptionPath = projectFile(authorization.bindings.priorConsumption.path)
assert.equal(shaFile(priorAuthorizationPath), AUTHORIZATION_SHA256)
assert.equal(shaFile(priorConsumptionPath), CONSUMPTION_SHA256)
const sourceAuthorization = read(priorAuthorizationPath)
const sourceConsumption = read(priorConsumptionPath)
validateAuthorizationAndConsumption({ authorization: sourceAuthorization, consumption: sourceConsumption })
for (const [name, binding] of Object.entries(sourceAuthorization.bindings)) {
  assert.equal(shaFile(projectFile(binding.path)), binding.sha256, `${name}_source_binding_changed`)
}
const source = {
  gpuTerminal: read(projectFile(sourceAuthorization.bindings.gpuTerminal.path)),
  diagnosticReport: read(projectFile(sourceAuthorization.bindings.diagnosticReport.path)),
  finalizationReport: read(projectFile(sourceAuthorization.bindings.finalizationReport.path)),
  finalizationTerminal: read(projectFile(sourceAuthorization.bindings.finalizationTerminal.path)),
}
validatePhase0DesignSource(source)

const runnerPath = path.join(ROOT, "scripts", "design-stage4-object-visible-structure-phase0.mjs")
const checkerPath = path.join(ROOT, "scripts", "check-stage4-object-visible-structure-phase0-design.mjs")
const libraryPath = path.join(ROOT, "scripts", "lib", "ai-painter-stage4-object-visible-structure-phase0-design.mjs")
for (const file of [runnerPath, checkerPath, libraryPath]) {
  const syntax = spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" } })
  assert.equal(syntax.status, 0, `syntax_check_failed:${relative(file)}:${syntax.stderr}`)
}
const cpuRun = spawnSync(process.execPath, [
  checkerPath,
  "--authorization", relative(priorAuthorizationPath),
  "--consumption", relative(priorConsumptionPath),
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "" } })
assert.equal(cpuRun.status, 0, `cpu_contract_failed:${cpuRun.stderr}`)
const cpu = JSON.parse(cpuRun.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(Object.values(cpu.currentExecution).every((value) => value === false), true)

const design = buildInactivePhase0Design(source)
const output = projectFile(OUTPUT)
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-contract-report.json"),
  report: path.join(output, "phase0-design-report.json"),
  contract: path.join(output, "inactive-phase0-execution-contract.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
const recordedAtAsiaShanghai = formatShanghai(now)
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  priorAuthorization: bind(priorAuthorizationPath),
  priorConsumption: bind(priorConsumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai,
})
writeJsonAtomic(files.report, {
  ...design,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceEvidence: sourceAuthorization.bindings,
  correctionLineage: {
    priorFailureReport: bind(projectFile(authorization.bindings.failureReport.path)),
    priorFailureTerminal: bind(projectFile(authorization.bindings.failureTerminal.path)),
    preCorrectionRunnerSha256: PRE_CORRECTION_RUNNER_SHA256,
  },
  cpuContractReport: bind(files.cpu),
  codeIdentity: { runner: bind(runnerPath), checker: bind(checkerPath), library: bind(libraryPath) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai,
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-visible-structure-phase0-execution-inactive-contract-v1",
  status: "inactive_separate_entry_implementation_and_gpu_authorizations_required",
  designReport: bind(files.report),
  fixedExecutionIdentity: design.fixedExecutionIdentity,
  executionSequence: design.executionSequence,
  updateGates: design.updateGates,
  reproducibilityGates: design.reproducibilityGates,
  evidenceRequirements: design.evidenceRequirements,
  qualificationBoundary: design.qualificationBoundary,
  activation: {
    activeNow: false,
    entryImplementedNow: false,
    gpuAuthorizedNow: false,
    phase0ExecutionAuthorizedNow: false,
    smokeAuthorizedNow: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-design-terminal-v1",
  status: "stage4_object_visible_structure_phase0_design_completed_inactive_closed",
  designReport: bind(files.report),
  inactiveExecutionContract: bind(files.contract),
  cpuContractReport: bind(files.cpu),
  fixedTotalProgress: design.fixedTotalProgress,
  nextLegalAction: design.nextLegalAction,
  gpuUsedNow: false,
  cudaInitializedNow: false,
  autogradExecutedNow: false,
  checkpointReadOrWrittenNow: false,
  modelLoadedNow: false,
  optimizerCreatedNow: false,
  backwardExecutedNow: false,
  weightModifiedNow: false,
  trainingStartedNow: false,
  validationStartedNow: false,
  smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai,
})

const proposedAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-visible-structure-phase0-execution-entry-implementation-v1",
  status: "owner_authorized_unconsumed",
  requestId: NEXT_REQUEST_ID,
  commandRef: NEXT_REQUEST_ID,
  scope: "one_cpu_only_implementation_of_inactive_four_object_phase0_execution_entry_and_contract_regression",
  bindings: {
    phase0DesignCorrectionAuthorization: bind(authorizationPath),
    phase0DesignCorrectionConsumption: bind(consumptionPath),
    priorPhase0DesignAuthorization: bind(priorAuthorizationPath),
    priorPhase0DesignConsumption: bind(priorConsumptionPath),
    phase0DesignReport: bind(files.report),
    inactivePhase0ExecutionContract: bind(files.contract),
    phase0DesignTerminal: bind(files.terminal),
    phase0DesignRunner: bind(runnerPath),
    phase0DesignChecker: bind(checkerPath),
    phase0DesignLibrary: bind(libraryPath),
  },
  permittedActions: [
    "implement_one_bounded_phase0_execution_entry_shared_contract_and_cpu_checker",
    "bind_fixed_sample_seed_timestep_resolution_west_boundary_and_four_object_identity",
    "execute_node_syntax_cpu_positive_negative_and_inactive_entry_contract_regressions",
    "write_implementation_report_terminal_capsule_and_inactive_gpu_phase0_owner_request",
    "synchronize_event_ledger_and_sqlite_index",
  ],
  forbiddenActions: [...FORBIDDEN_ACTIONS],
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/consumption.json`,
    outputDirectory: NEXT_OUTPUT,
    consumeBeforeFirstWrite: true,
  },
  failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noGpuEscalation: true },
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: design.nextLegalAction,
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/authorization.json`,
  proposedAuthorization,
  boundDesignReport: bind(files.report),
  boundInactiveExecutionContract: bind(files.contract),
  boundTerminal: bind(files.terminal),
  gpuOrPhase0ExecutionRequestedNow: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: design.fixedTotalProgress,
  currentStage: "Four-object visible-structure Phase0 engineering qualification designed but inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "immutable_owner_phase0_execution_entry_implementation_authorization_not_created_or_consumed",
  nextLegalAction: design.nextLegalAction,
  forbiddenActions: [...FORBIDDEN_ACTIONS],
  evidence: {
    designReport: bind(files.report),
    inactiveExecutionContract: bind(files.contract),
    cpuContractReport: bind(files.cpu),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsedNow: false,
  checkpointReadOrWrittenNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai,
})

const indexed = [
  authorizationPath,
  consumptionPath,
  priorAuthorizationPath,
  priorConsumptionPath,
  runnerPath,
  checkerPath,
  libraryPath,
  ...Object.values(authorization.bindings).map((binding) => projectFile(binding.path)),
  ...Object.values(sourceAuthorization.bindings).map((binding) => projectFile(binding.path)),
  ...Object.values(files),
]
for (const file of indexed) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: CORRECTION_REQUEST_ID,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: shaFile(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-phase0-design-${CORRECTION_REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_phase0_design",
  runId: CORRECTION_REQUEST_ID,
  kind: "cpu_only_phase0_design",
  status: "success",
  title: "Four-object visible-structure Phase0 engineering qualification designed inactive",
  titleZh: "四对象可见结构Phase0工程资格设计完成并保持未激活",
  detailZh: `固定样本194、种子20263722、时间步999和256×192分辨率；CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}。本次未启动GPU、未读取Checkpoint、未加载模型或训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: design.fixedTotalProgress,
})

console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu),
  designReport: bind(files.report),
  inactiveExecutionContract: bind(files.contract),
  terminal: bind(files.terminal),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))

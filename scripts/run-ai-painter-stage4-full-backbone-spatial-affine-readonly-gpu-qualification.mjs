import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
  indexProgramEvent,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
const CURRENT_TASK = "qualify_stage4_full_backbone_spatial_affine_readonly_gpu"
const NEXT_TASK = "compile_stage4_full_backbone_spatial_affine_controlled_smoke_contract"
const FAILURE_NEXT_TASK = "classify_stage4_full_backbone_spatial_affine_readonly_gpu_failure"
const RUN_ID = newRunId()
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const TRANSACTION_PARENT = inside(
  ".runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-transactions",
)
const TRANSACTION_ROOT = transactionRootFor(RUN_ID)
const TRANSACTION_JOURNAL = path.join(TRANSACTION_ROOT, "transaction.json")
const CPU_TIMEOUT_MS = 10 * 60 * 1000
const GPU_GATE_TIMEOUT_MS = 45 * 60 * 1000
let activeJournalPath = null

const FILES = Object.freeze({
  currentRegistry: inside(".runtime/ai-painter/current-execution-registry/current.json"),
  cpuTerminal: inside(
    ".runtime/ai-painter/stage4-full-backbone-spatial-affine-cpu-supports/"
      + "stage4-full-backbone-spatial-affine-cpu-support-20260829002039-"
      + "4237acc7-b88f-49e3-b043-95aeeaf6cd9c/phase-terminal.json",
  ),
  uniquePlan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  model: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  policy: inside("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
  contract: inside("ml/ai-painter/scripts/ai_painter_full_backbone_spatial_affine_contract.py"),
  checker: inside("ml/ai-painter/scripts/check_stage4_full_backbone_spatial_affine_cpu.py"),
  modelTest: inside("ml/ai-painter/tests/test_stage4_full_backbone_spatial_affine_conditioned_denoiser.py"),
  gpuRunner: inside("ml/ai-painter/scripts/run_stage4_full_backbone_spatial_affine_readonly_gpu_qualification.py"),
  gpuRunnerTest: inside("ml/ai-painter/tests/test_stage4_full_backbone_spatial_affine_readonly_gpu_runner.py"),
  gpuGate: inside("ml/ai-painter/scripts/execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate.py"),
  gpuGateTest: inside("ml/ai-painter/tests/test_stage4_full_backbone_spatial_affine_readonly_gpu_gate.py"),
  runner: inside("scripts/run-ai-painter-stage4-full-backbone-spatial-affine-readonly-gpu-qualification.mjs"),
})

const EXPECTED = Object.freeze({
  currentRegistry: "40aa4e89e074ac9485e90f043c63f358b406fdb12dec4a748ec7144b77f463c7",
  cpuTerminal: "d872eae0b03b0be8742d4aa7ad5a75163224f07de291086ce47eb0561cfd2d7d",
  uniquePlan: "909847a166ed6532cff9c70c8c2a0a25659f5b932a313d48ad2e94a69bd0ff7c",
  gpuGate: "6e70603b58d80c779ed72a39b0b52d99a324ea4925dbda5120386b16160bb7f6",
  qualificationSamples: "f72f118c94d16030051dd1a35942ee5981c279dafd47093c046996dbf4a20e23",
  firstTrainSampleId: "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3",
  fixedValidationSampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
})

const EXECUTION_FILE_ROLES = Object.freeze([
  "model",
  "modeRegistry",
  "policy",
  "contract",
  "checker",
  "modelTest",
  "gpuRunner",
  "gpuRunnerTest",
  "gpuGate",
  "gpuGateTest",
  "runner",
])

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  main().catch((error) => {
    recordUnexpectedFailure(error)
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}

async function main() {
  const recovered = await recoverIncompleteTransactions()
  if (recovered.length > 0) {
    const activeRecovery = recovered.find((item) => item.state === "gate_running")
    process.stdout.write(`${JSON.stringify({
      status: activeRecovery
        ? "readonly_gpu_gate_in_progress_existing_process_not_restarted"
        : "recovered_incomplete_readonly_gpu_formal_transaction",
      recovered,
      ownerAuthorizationRequired: false,
      automaticRetryPerformed: false,
      trainingStarted: false,
    }, null, 2)}\n`)
    return
  }
  const journal = await prepareNewTransaction()
  const completed = await executePreparedTransaction(journal, TRANSACTION_JOURNAL)
  activeJournalPath = null
  process.stdout.write(`${JSON.stringify({
    status: completed.resultStatus,
    runId: completed.runId,
    terminal: completed.terminal,
    currentRegistrySha256: completed.registryCommit?.registrySha256 ?? null,
    currentFixedProgress: progress(),
    nextLegalAction: completed.nextLegalAction,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
  if (completed.qualificationOutcome === "failed_closed") process.exitCode = 1
}

async function prepareNewTransaction() {
  const formalOutputRoot = formalOutputRootFor(RUN_ID)
  const failureOutputRoot = failureOutputRootFor(RUN_ID)
  const gateAttemptRoot = gateAttemptRootFor(RUN_ID)
  const gateOutputRoot = gateOutputRootFor(RUN_ID)
  for (const [role, file] of Object.entries(FILES)) {
    assert.equal(fs.existsSync(file), true, `${projectPath(file)} is missing`)
    if (Object.hasOwn(EXPECTED, role)) {
      assert.equal(sha(file), EXPECTED[role], `${role} SHA-256 mismatch`)
    }
  }
  assert.equal(fs.existsSync(TRANSACTION_ROOT), false, "formal transaction reuse is forbidden")
  assert.equal(fs.existsSync(formalOutputRoot), false, "formal output reuse is forbidden")
  assert.equal(fs.existsSync(failureOutputRoot), false, "formal failure output reuse is forbidden")
  assert.equal(fs.existsSync(gateAttemptRoot), false, "GPU gate attempt reuse is forbidden")
  assert.equal(fs.existsSync(gateOutputRoot), false, "GPU qualification output reuse is forbidden")

  const current = await verifyCurrentRegistry()
  const cpuTerminal = verifyCpuTerminal()
  const codeIdentity = freezeExecutionCodeIdentity()
  const recordedAtUtc = new Date().toISOString()
  fs.mkdirSync(TRANSACTION_PARENT, { recursive: true })
  fs.mkdirSync(TRANSACTION_ROOT, { recursive: false })
  const journal = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-transaction-v1",
    transactionId: RUN_ID,
    runId: RUN_ID,
    capabilityVersion: CAPABILITY,
    state: "prepared",
    recordedAtUtc,
    currentRegistry: {
      registryRevision: current.registry.registryRevision,
      eventSequence: current.registry.eventSequence,
      sha256: current.registrySha256,
      taskId: current.registry.taskId,
    },
    cpuSupportTerminal: bind(FILES.cpuTerminal),
    cpuSupportStatus: cpuTerminal.status,
    codeIdentity,
    gateAttemptRoot: projectPath(gateAttemptRoot),
    gateOutputRoot: projectPath(gateOutputRoot),
  }
  writeJournal(journal)
  return readJournal(TRANSACTION_JOURNAL)
}

async function executePreparedTransaction(initialJournal, journalPath) {
  activeJournalPath = journalPath
  let journal = initialJournal
  if (journal.state === "prepared") {
    await verifyCurrentRegistry()
    assertExecutionCodeIdentityUnchanged(journal.codeIdentity)
    const syntax = runSyntaxChecks()
    const checker = runPythonJson([FILES.checker])
    validateCpuChecker(checker)
    const tests = runUnitTests([
      FILES.modelTest,
      FILES.gpuRunnerTest,
      FILES.gpuGateTest,
    ])
    journal = transitionJournal(journalPath, journal, "prechecks_passed", {
      prechecks: { syntax, checker, tests },
    })
  }
  if (journal.state === "prechecks_passed") {
    await verifyCurrentRegistry()
    assertExecutionCodeIdentityUnchanged(journal.codeIdentity)
    journal = transitionJournal(journalPath, journal, "gate_running", {
      gateStartedAtUtc: new Date().toISOString(),
    })
    const gate = invokeGpuGate(journal.runId)
    journal = transitionJournal(journalPath, journal, gate.ok ? "gate_succeeded" : "gate_failed", {
      gateResult: gate.result,
      gateExitCode: gate.exitCode,
      gateStdoutSha256: shaText(gate.stdout),
      gateStderrSha256: shaText(gate.stderr),
    })
  }
  if (journal.state === "gate_running") {
    journal = recoverGateTerminal(journalPath, journal)
    if (journal.state === "gate_running") {
      return {
        ...journal,
        resultStatus: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_in_progress",
        qualificationOutcome: "in_progress",
        nextLegalAction: CURRENT_TASK,
      }
    }
  }
  if (journal.state === "gate_failed") {
    journal = prepareFailureArtifacts(journalPath, journal)
  }
  if (journal.state === "gate_succeeded") {
    await verifyCurrentRegistry()
    assertExecutionCodeIdentityUnchanged(journal.codeIdentity)
    const verified = validateGateSuccessResult(journal.gateResult, {
      root: ROOT,
      runId: journal.runId,
    })
    journal = prepareSuccessArtifacts(journalPath, journal, verified)
  }
  if (["artifacts_ready", "registry_committed", "plan_committed", "event_committed"].includes(journal.state)) {
    journal = await completeProjectionTransaction(journal, journalPath)
  }
  assert.equal(journal.state, "complete")
  return journal
}

function invokeGpuGate(runId) {
  validateRunId(runId)
  const completed = spawnSync(PYTHON, ["-B", FILES.gpuGate, "--run-id", runId], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment({ cudaVisible: true }),
    maxBuffer: 64 * 1024 * 1024,
    timeout: GPU_GATE_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  const stdout = completed.stdout ?? ""
  const stderr = completed.stderr ?? ""
  const result = parseJsonOutput(stdout, "GPU gate")
  validateGateResultEnvelope(result, runId)
  return {
    ok: completed.status === 0,
    exitCode: completed.status,
    stdout,
    stderr,
    result,
  }
}

function recoverGateTerminal(journalPath, journal) {
  const terminalPath = path.join(inside(journal.gateAttemptRoot), "phase-terminal.json")
  if (!fs.existsSync(terminalPath)) {
    return recoverInterruptedGateWithoutTerminal(journalPath, journal)
  }
  const terminal = read(terminalPath)
  assert.equal(terminal.runId, journal.runId)
  const attemptTerminal = bind(terminalPath)
  let gateResult
  let state
  if (terminal.executionState === "completed") {
    gateResult = {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
      executionState: "completed",
      status: terminal.status,
      runId: journal.runId,
      outputNamespace: terminal.outputNamespace,
      attemptTerminal,
      gpuQualificationTerminal: terminal.gpuQualificationTerminal,
      gpuDiagnosticReport: terminal.gpuDiagnosticReport,
      ownerAuthorizationRequired: false,
    }
    state = "gate_succeeded"
  } else {
    gateResult = {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
      executionState: "failed_closed",
      status: terminal.status,
      runId: journal.runId,
      failedStep: terminal.failedStep,
      error: "recovered_failed_gate_terminal",
      attemptTerminal,
      failureReport: terminal.failureReport,
      ownerAuthorizationRequired: false,
    }
    state = "gate_failed"
  }
  validateGateResultEnvelope(gateResult, journal.runId)
  return transitionJournal(journalPath, journal, state, {
    gateResult,
    gateRecoveredWithoutRetry: true,
  })
}

function recoverInterruptedGateWithoutTerminal(journalPath, journal, processProbe = detectActiveGateProcess) {
  const attemptRoot = inside(journal.gateAttemptRoot)
  const claimPath = path.join(attemptRoot, "execution-claim.json")
  const startedPath = path.join(attemptRoot, "execution-started.json")
  const consumptionPath = path.join(attemptRoot, "execution-claim-consumption.json")
  const claimEvidence = safeReadRecoveryEvidence(claimPath)
  const startedEvidence = safeReadRecoveryEvidence(startedPath)
  const consumptionEvidence = safeReadRecoveryEvidence(consumptionPath)
  const recoveryEvidence = [claimEvidence, startedEvidence, consumptionEvidence]
  const parseErrors = recoveryEvidence
    .filter(({ parseError }) => parseError !== null)
    .map(({ path: evidencePath, sha256, parseError }) => ({ path: evidencePath, sha256, parseError }))
  const gateProgram = bind(FILES.gpuGate)
  const runnerProgram = bind(FILES.gpuRunner)
  let decision
  try {
    if (parseErrors.length > 0) throw new Error("corrupt_interrupted_evidence")
    decision = decideGateRunningRecoveryForMock({
      runId: journal.runId,
      outputNamespace: gateOutputProjectPath(journal.runId),
      executionClaim: claimEvidence.value,
      executionClaimBinding: claimEvidence.binding,
      executionStarted: startedEvidence.value,
      executionStartedBinding: startedEvidence.binding,
      claimConsumption: consumptionEvidence.value,
      gateProgram,
      runnerProgram,
      processProbe,
    })
  } catch (error) {
    decision = decideCorruptGateRecoveryForMock({
      runId: journal.runId,
      gateProgram,
      runnerProgram,
      processProbe,
      evidenceError: error instanceof Error ? error.message : String(error),
    })
  }
  if (decision.status === "in_progress") {
    return transitionJournal(journalPath, journal, "gate_running", {
      gateRecovery: {
        status: "in_progress_existing_process_not_restarted",
        ...decision,
        recoveryEvidence: recoveryEvidence.map(recoveryEvidenceProjection),
        observedAtUtc: new Date().toISOString(),
      },
    })
  }
  return writeInterruptedGateFailure(journalPath, journal, {
    decision,
    claimEvidence,
    startedEvidence,
    consumptionEvidence,
    parseErrors,
  })
}

function safeReadRecoveryEvidence(file) {
  if (!fs.existsSync(file)) {
    return { path: projectPath(file), sha256: null, binding: null, value: null, parseError: null }
  }
  const bytes = fs.readFileSync(file)
  const binding = { path: projectPath(file), sha256: shaBytes(bytes) }
  try {
    return {
      ...binding,
      binding,
      value: JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/u, "")),
      parseError: null,
    }
  } catch (error) {
    return {
      ...binding,
      binding,
      value: null,
      parseError: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export function readRecoveryEvidenceForMock(file) {
  return safeReadRecoveryEvidence(file)
}

function recoveryEvidenceProjection(evidence) {
  return {
    path: evidence.path,
    sha256: evidence.sha256,
    exists: evidence.binding !== null,
    parseError: evidence.parseError,
  }
}

export function decideCorruptGateRecoveryForMock({
  runId,
  gateProgram,
  runnerProgram,
  processProbe,
  evidenceError,
}) {
  const candidates = [
    { role: "gate", processId: null, program: gateProgram },
    { role: "runner", processId: null, program: runnerProgram },
  ]
  const states = candidates.map((candidate) => ({
    ...candidate,
    processState: processProbe({ ...candidate, runId }),
  }))
  assert.equal(states.every(({ processState }) => ["active", "dead", "indeterminate"].includes(processState)), true)
  const active = states.find(({ processState }) => processState === "active")
  const uncertain = states.find(({ processState }) => processState === "indeterminate")
  if (active || uncertain) {
    const selected = active ?? uncertain
    return {
      status: "in_progress",
      activeRole: selected.role,
      processId: null,
      processProbeState: selected.processState,
      evidenceStatus: "corrupt_or_semantically_invalid_waiting_for_process_exit",
      evidenceError,
      automaticRetryAllowed: false,
      newRunAllowed: false,
      shouldWriteInterruptedFailure: false,
    }
  }
  return {
    status: "interrupted_failed_closed",
    activeRole: null,
    processId: null,
    processProbeState: "dead",
    failureCode: "corrupt_interrupted_evidence",
    evidenceError,
    automaticRetryAllowed: false,
    newRunAllowed: false,
    shouldWriteInterruptedFailure: true,
  }
}

export function decideGateRunningRecoveryForMock({
  runId,
  outputNamespace,
  executionClaim,
  executionClaimBinding,
  executionStarted,
  executionStartedBinding,
  claimConsumption,
  gateProgram,
  runnerProgram,
  processProbe,
}) {
  validateRunId(runId)
  const candidates = []
  if (executionClaim === null) {
    candidates.push({ role: "gate", processId: null, program: gateProgram })
  }
  if (executionClaim !== null) {
    assert.equal(executionClaim.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-v1")
    assert.equal(executionClaim.status, "claimed_once")
    assert.equal(executionClaim.runId, runId)
    assert.equal(executionClaim.outputNamespace, outputNamespace)
    assert.deepEqual(executionClaim.launcher, gateProgram)
    assert.deepEqual(executionClaim.gpuRunner, runnerProgram)
    assert.equal(executionClaim.ownerAuthorizationRequired, false)
    assert.equal(executionClaim.automaticRetryAllowed, false)
    assert.ok(Number.isInteger(executionClaim.launcherProcessId) && executionClaim.launcherProcessId > 0)
    candidates.push({ role: "gate", processId: executionClaim.launcherProcessId, program: gateProgram })
  }
  if (executionStarted !== null) {
    assert.notEqual(executionClaim, null)
    assert.equal(executionStarted.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-execution-started-v1")
    assert.equal(executionStarted.status, "runner_claimed_not_replayable")
    assert.equal(executionStarted.runId, runId)
    assert.equal(executionStarted.outputNamespace, outputNamespace)
    assert.deepEqual(executionStarted.bindings?.executionClaim, executionClaimBinding)
    assert.deepEqual(executionStarted.gpuRunner, runnerProgram)
    assert.equal(executionStarted.ownerAuthorizationRequired, false)
    assert.equal(executionStarted.automaticRetryAllowed, false)
    if (claimConsumption === null) {
      candidates.push({ role: "runner", processId: null, program: runnerProgram })
    }
  }
  if (claimConsumption !== null) {
    assert.notEqual(executionStarted, null)
    assert.equal(claimConsumption.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-execution-claim-consumption-v1")
    assert.equal(claimConsumption.status, "consumed_once")
    assert.equal(claimConsumption.runId, runId)
    assert.equal(claimConsumption.outputNamespace, outputNamespace)
    assert.deepEqual(claimConsumption.executionClaim, executionStartedBinding)
    assert.deepEqual(claimConsumption.consumerProgram, runnerProgram)
    assert.ok(Number.isInteger(claimConsumption.processId) && claimConsumption.processId > 0)
    candidates.push({ role: "runner", processId: claimConsumption.processId, program: runnerProgram })
  }
  const indeterminate = []
  for (const candidate of candidates) {
    const processState = processProbe({ ...candidate, runId })
    assert.ok(["active", "dead", "indeterminate"].includes(processState))
    if (processState === "active") {
      return {
        status: "in_progress",
        activeRole: candidate.role,
        processId: candidate.processId,
        processProbeState: "active",
        automaticRetryAllowed: false,
        newRunAllowed: false,
        shouldWriteInterruptedFailure: false,
      }
    }
    if (processState === "indeterminate") indeterminate.push(candidate)
  }
  if (indeterminate.length > 0) {
    return {
      status: "in_progress",
      activeRole: indeterminate[0].role,
      processId: indeterminate[0].processId,
      processProbeState: "indeterminate",
      automaticRetryAllowed: false,
      newRunAllowed: false,
      shouldWriteInterruptedFailure: false,
    }
  }
  return {
    status: "interrupted_failed_closed",
    activeRole: null,
    processId: null,
    processProbeState: "dead",
    automaticRetryAllowed: false,
    newRunAllowed: false,
    shouldWriteInterruptedFailure: true,
  }
}

function detectActiveGateProcess({ processId, program, runId, role }) {
  if (processId !== null && (!Number.isInteger(processId) || processId <= 0)) return "indeterminate"
  if (!isBinding(program) || !["gate", "runner"].includes(role)) return "indeterminate"
  const programFile = resolveInsideRoot(ROOT, program.path)
  const windowsScript = processId === null
    ? "$ErrorActionPreference='Stop'; $p=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop | Select-Object ProcessId,CommandLine); ConvertTo-Json -InputObject @($p) -Compress"
    : `$ErrorActionPreference='Stop'; $p=@(Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${processId}\" -ErrorAction Stop | Select-Object ProcessId,CommandLine); ConvertTo-Json -InputObject @($p) -Compress`
  const command = process.platform === "win32"
    ? ["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", windowsScript]]
    : ["ps", processId === null ? ["-eo", "pid=,args="] : ["-p", String(processId), "-o", "pid=,args="]]
  const result = spawnSync(command[0], command[1], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error !== undefined) return "indeterminate"
  if (result.status !== 0) {
    if (process.platform !== "win32" && processId !== null && result.status === 1) return "dead"
    return "indeterminate"
  }
  try {
    const records = process.platform === "win32"
      ? parseWindowsProcessRecords(result.stdout)
      : parsePosixProcessRecords(result.stdout)
    return matchRecoveredProcessRecordsForMock(records, {
      processId,
      programPath: programFile,
      runId,
      role,
    })
  } catch {
    return "indeterminate"
  }
}

function parseWindowsProcessRecords(stdout) {
  const source = String(stdout ?? "").trim()
  if (source === "") throw new Error("windows_process_json_empty")
  const value = JSON.parse(source.replace(/^\uFEFF/u, ""))
  return Array.isArray(value) ? value : [value]
}

function parsePosixProcessRecords(stdout) {
  const source = String(stdout ?? "")
  if (source.trim() === "") return []
  return source.split(/\r?\n/u).filter((line) => line.trim() !== "").map((line) => {
    const match = line.match(/^\s*(\d+)\s+([\s\S]+)$/u)
    if (match === null) throw new Error("posix_process_record_invalid")
    return { ProcessId: Number(match[1]), CommandLine: match[2] }
  })
}

export function matchRecoveredProcessRecordsForMock(records, {
  processId,
  programPath,
  runId,
  role,
}) {
  if (!Array.isArray(records)) return "indeterminate"
  const normalizedProgram = String(programPath).replaceAll("\\", "/").toLowerCase()
  const normalizedRunId = String(runId).toLowerCase()
  for (const record of records) {
    if (!record || !Number.isInteger(Number(record.ProcessId))) return "indeterminate"
    if (processId !== null && Number(record.ProcessId) !== processId) continue
    if (record.CommandLine === null || record.CommandLine === undefined) {
      if (processId !== null) return "indeterminate"
      continue
    }
    if (typeof record.CommandLine !== "string") return "indeterminate"
    const commandLine = record.CommandLine.replaceAll("\\", "/").toLowerCase()
    const programMatches = commandLine.includes(normalizedProgram)
    const runMatches = commandLine.includes(normalizedRunId)
    const roleArgumentsMatch = role === "gate"
      ? commandLine.includes("--run-id")
      : commandLine.includes("--config")
        && commandLine.includes("--execution-claim")
        && commandLine.includes("--output-dir")
    if (programMatches && runMatches && roleArgumentsMatch) return "active"
  }
  return "dead"
}

function writeInterruptedGateFailure(journalPath, journal, evidence) {
  const attemptRoot = inside(journal.gateAttemptRoot)
  const outputRoot = gateOutputRootFor(journal.runId)
  const failurePath = path.join(attemptRoot, "interrupted-failure-report.json")
  const terminalPath = path.join(attemptRoot, "phase-terminal.json")
  const failureCode = evidence.decision.failureCode ?? "gate_running_interrupted_without_terminal"
  const failureStatus = failureCode === "corrupt_interrupted_evidence"
    ? "corrupt_interrupted_evidence"
    : "interrupted_gate_process_not_active"
  let recordedAtUtc
  if (fs.existsSync(failurePath)) {
    const existing = read(failurePath)
    assert.equal(existing.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-interrupted-failure-v1")
    assert.equal(existing.runId, journal.runId)
    assert.equal(existing.executionState, "failed_closed")
    assert.equal(existing.automaticRetryAllowed, false)
    recordedAtUtc = existing.recordedAtUtc
  } else {
    recordedAtUtc = new Date().toISOString()
    writeExclusive(failurePath, {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-interrupted-failure-v1",
      executionState: "failed_closed",
      status: failureStatus,
      runId: journal.runId,
      failedStep: failureCode,
      executionClaim: evidence.claimEvidence.binding,
      executionStarted: evidence.startedEvidence.binding,
      executionClaimConsumption: evidence.consumptionEvidence.binding,
      recoveryEvidence: [
        evidence.claimEvidence,
        evidence.startedEvidence,
        evidence.consumptionEvidence,
      ].map(recoveryEvidenceProjection),
      parseErrors: evidence.parseErrors,
      evidenceError: evidence.decision.evidenceError ?? null,
      automaticRetryAllowed: false,
      newRunAllowed: false,
      controlledSmokeAdmissionAllowed: false,
      ownerAuthorizationRequired: false,
      recordedAtUtc,
    })
  }
  let outputFailureTerminal = null
  if (fs.existsSync(outputRoot)) {
    const outputTerminal = path.join(outputRoot, "phase-terminal.json")
    if (!fs.existsSync(outputTerminal)) {
      try {
        writeExclusive(outputTerminal, {
          schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-terminal-v1",
          executionState: "failed_closed",
          status: failureCode === "corrupt_interrupted_evidence"
            ? "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_corrupt_interrupted_evidence"
            : "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_interrupted",
          runId: journal.runId,
          failureReport: bind(failurePath),
          ownerAuthorizationRequired: false,
          automaticRetryAllowed: false,
          recordedAtUtc,
        })
        outputFailureTerminal = bind(outputTerminal)
      } catch (error) {
        if (error?.code !== "EEXIST") throw error
      }
    } else {
      const existingOutput = read(outputTerminal)
      if (
        existingOutput.runId === journal.runId
        && existingOutput.executionState === "failed_closed"
        && existingOutput.failureReport?.path === projectPath(failurePath)
      ) outputFailureTerminal = bind(outputTerminal)
    }
  }
  if (fs.existsSync(terminalPath)) return recoverGateTerminal(journalPath, journal)
  const interruptedTerminal = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-terminal-v1",
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed",
    runId: journal.runId,
    failedStep: failureCode,
    recoveryFailureCode: failureCode,
    failureReport: bind(failurePath),
    outputFailureTerminal,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    recordedAtUtc,
  }
  try {
    writeExclusive(terminalPath, interruptedTerminal)
  } catch (error) {
    if (error?.code !== "EEXIST") throw error
    return recoverGateTerminal(journalPath, journal)
  }
  const gateResult = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed",
    runId: journal.runId,
    failedStep: failureCode,
    recoveryFailureCode: failureCode,
    error: failureCode === "corrupt_interrupted_evidence"
      ? "corrupt_interrupted_evidence_and_all_bound_processes_are_dead"
      : "recorded_gate_and_runner_processes_are_not_active",
    attemptTerminal: bind(terminalPath),
    failureReport: bind(failurePath),
    ownerAuthorizationRequired: false,
  }
  return transitionJournal(journalPath, journal, "gate_failed", {
    gateResult,
    gateRecoveredWithoutRetry: true,
    interruptedRecovery: evidence.decision,
  })
}

export function validateRunId(runId) {
  assert.match(
    runId,
    /^full-backbone-spatial-affine-readonly-gpu-[0-9]{8}-[0-9]{9}-[0-9a-f]{8}$/u,
    "readonly GPU runId is invalid",
  )
  return runId
}

export function validateGateResultEnvelope(result, runId) {
  assert.equal(result.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1")
  assert.equal(result.runId, runId)
  assert.equal(result.ownerAuthorizationRequired, false)
  assert.ok(["completed", "failed_closed"].includes(result.executionState))
  assert.equal(isBinding(result.attemptTerminal), true)
  if (result.executionState === "completed") {
    assert.equal(result.status, "stage4_full_backbone_spatial_affine_readonly_gpu_gate_completed")
    assert.equal(result.outputNamespace, gateOutputProjectPath(runId))
    assert.equal(isBinding(result.gpuQualificationTerminal), true)
    assert.equal(isBinding(result.gpuDiagnosticReport), true)
    assert.equal(result.failureReport, undefined)
  } else {
    assert.equal(result.status, "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed")
    assert.equal(typeof result.failedStep, "string")
    assert.equal(isBinding(result.failureReport), true)
    assert.equal(result.gpuQualificationTerminal, undefined)
  }
  return result
}

export function validateGateSuccessResult(result, { root, runId }) {
  validateGateResultEnvelope(result, runId)
  assert.equal(result.executionState, "completed")
  const attemptTerminal = verifyBinding(result.attemptTerminal, root)
  const gpuTerminal = verifyBinding(result.gpuQualificationTerminal, root)
  const gpuReport = verifyBinding(result.gpuDiagnosticReport, root)
  assert.equal(
    attemptTerminal.file,
    path.resolve(root, ".runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts", runId, "phase-terminal.json"),
  )
  assert.equal(
    gpuTerminal.file,
    path.resolve(root, gateOutputProjectPath(runId), "phase-terminal.json"),
  )
  assert.equal(
    gpuReport.file,
    path.resolve(root, gateOutputProjectPath(runId), "gpu-diagnostic-report.json"),
  )
  const attempt = attemptTerminal.value
  assert.equal(attempt.executionState, "completed")
  assert.equal(attempt.status, result.status)
  assert.equal(attempt.runId, runId)
  assert.equal(attempt.ownerAuthorizationRequired, false)
  assert.equal(attempt.automaticRetryAllowed, false)
  assert.deepEqual(attempt.gpuQualificationTerminal, result.gpuQualificationTerminal)
  assert.deepEqual(attempt.gpuDiagnosticReport, result.gpuDiagnosticReport)

  const terminal = gpuTerminal.value
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.status, "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_passed")
  assert.equal(terminal.runId, runId)
  assert.equal(terminal.ownerAuthorizationRequired, false)
  assert.deepEqual(terminal.gpuDiagnosticReport, result.gpuDiagnosticReport)

  const report = gpuReport.value
  const evidence = validateQualificationEvidencePayload(report, {
    runId,
    readBound: (binding) => verifyBinding(binding, root),
  })
  return {
    attemptTerminal: result.attemptTerminal,
    gpuQualificationTerminal: result.gpuQualificationTerminal,
    gpuDiagnosticReport: result.gpuDiagnosticReport,
    activeConfig: attempt.evidence?.activeConfig,
    internalTicket: attempt.evidence?.ticket,
    ticketConsumption: attempt.evidence?.consumption,
    executionStarted: attempt.evidence?.executionStarted,
    executionClaimConsumption: attempt.evidence?.executionClaimConsumption,
    ...evidence,
  }
}

export function validateQualificationEvidencePayload(report, { runId, readBound }) {
  assert.equal(report.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-report-v1")
  assert.equal(report.status, "passed")
  assert.equal(report.runId, runId)
  assert.equal(report.architectureId, CAPABILITY)
  assert.equal(report.capabilityVersion, CAPABILITY)
  assert.equal(report.seed, 20263722)
  assert.deepEqual(report.resolution, { width: 256, height: 192 })
  assert.equal(report.conditionChannels, 23)
  assert.equal(report.latentChannels, 12)
  assert.equal(report.firstFormalTrainSampleId, EXPECTED.firstTrainSampleId)
  assert.equal(report.fixedValidationSampleId, EXPECTED.fixedValidationSampleId)
  assert.deepEqual(report.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(Object.values(report.safety ?? {}).every((value) => value === false), true)
  const samples = report.executionGrant?.datasetConstraints?.qualificationSamples
  assert.equal(samples?.identitySha256, EXPECTED.qualificationSamples)
  assert.equal(samples?.preboundReadOnlySamples, true)
  assert.equal(samples?.freeSelectionAllowed, false)
  assert.equal(samples?.selectBoundSampleActionRequired, false)
  assert.equal(samples?.firstTrain?.sampleId, EXPECTED.firstTrainSampleId)
  assert.equal(samples?.fixedValidation?.sampleId, EXPECTED.fixedValidationSampleId)
  assert.equal(report.executionGrant?.datasetConstraints?.freeSampleSelectionAllowed, false)
  assert.equal(report.executionGrant?.datasetConstraints?.selectBoundSampleActionRequired, false)
  assert.equal(report.executionGrant?.allowedActions?.includes("select_bound_sample"), false)
  for (const forbidden of [
    "create_optimizer",
    "execute_backward",
    "mutate_model_weights",
    "write_diagnostic_checkpoint",
    "write_smoke_checkpoint",
    "run_stage0",
    "run_stage1",
    "run_stage2",
    "run_formal_inference",
    "create_runtime_frame",
    "enter_world",
  ]) {
    assert.equal(report.executionGrant?.explicitlyDeniedActions?.includes(forbidden), true)
  }
  const gradient = readBound(report.gradientEvidence).value
  assert.equal(gradient.status, "passed")
  assert.equal(gradient.samples?.length, 2)
  const expectedRoles = ["first_formal_train_record", "fixed_validation_sample_194"]
  const expectedIds = [EXPECTED.firstTrainSampleId, EXPECTED.fixedValidationSampleId]
  for (const [index, sample] of gradient.samples.entries()) {
    assert.equal(sample.role, expectedRoles[index])
    assert.equal(sample.sampleId, expectedIds[index])
    assert.equal(sample.conditionGradient?.all23ChannelsFiniteNonzero, true)
    assert.equal(sample.conditionGradient?.perChannelMaximumAbsoluteGradient?.length, 23)
    assert.equal(sample.affineParameterTensorCount, 24)
    assert.equal(sample.affineParameterCount, 745472)
    assert.equal(sample.affineParameterObjectIdentityCount, 24)
    assert.equal(sample.affineParameterGradients?.length, 24)
    assert.equal(sample.affineParameterGradients.every((item) => (
      item.finite === true
      && item.nonzero === true
      && item.gammaFiniteNonzero === true
      && item.betaFiniteNonzero === true
    )), true)
    assert.equal(sample.allParameterGradFieldsRemainNone, true)
  }
  const state = readBound(report.modelStateHashes).value
  assert.equal(state.denoiserUnchanged, true)
  assert.equal(state.autoencoderUnchanged, true)
  assert.equal(state.allParameterGradFieldsRemainNone, true)
  const telemetry = readBound(report.cudaTelemetry).value
  assert.equal(telemetry.status, "completed")
  assert.ok(telemetry.peakGpuMemoryBytes > 0)
  return {
    qualificationSamples: samples,
    gradientEvidence: report.gradientEvidence,
    modelStateHashes: report.modelStateHashes,
    cudaTelemetry: report.cudaTelemetry,
  }
}

function prepareSuccessArtifacts(journalPath, journal, verified) {
  const formalOutputRoot = formalOutputRootFor(journal.runId)
  const stagedPlan = path.join(path.dirname(journalPath), "next-plan.md")
  assert.equal(fs.existsSync(formalOutputRoot), false)
  fs.mkdirSync(path.dirname(formalOutputRoot), { recursive: true })
  fs.mkdirSync(formalOutputRoot, { recursive: false })
  const outputs = {
    frozenInputs: path.join(formalOutputRoot, "code-and-input-freeze.json"),
    cpu: path.join(formalOutputRoot, "cpu-preflight-report.json"),
    tests: path.join(formalOutputRoot, "cpu-test-report.json"),
    result: path.join(formalOutputRoot, "formal-qualification-result.json"),
    nextAction: path.join(formalOutputRoot, "local-next-action.json"),
    planSync: path.join(formalOutputRoot, "plan-sync-record.json"),
    terminal: path.join(formalOutputRoot, "phase-terminal.json"),
    capsule: path.join(formalOutputRoot, "local-task-capsule.json"),
  }
  const receipt = path.join(formalOutputRoot, "plan-commit-receipt.json")
  const recordedAtUtc = new Date().toISOString()
  writeExclusive(outputs.frozenInputs, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-code-input-freeze-v1",
    status: "verified_unchanged",
    runId: journal.runId,
    codeIdentity: journal.codeIdentity,
    cpuSupportTerminal: journal.cpuSupportTerminal,
    currentRegistry: journal.currentRegistry,
    gateAttemptTerminal: verified.attemptTerminal,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.cpu, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-cpu-report-v1",
    status: "passed",
    runId: journal.runId,
    checker: journal.prechecks.checker,
    syntax: journal.prechecks.syntax,
    executionBoundary: {
      gpuStartedByCpuChecks: false,
      optimizerCreated: false,
      backwardExecuted: false,
      trainingStarted: false,
    },
    recordedAtUtc,
  })
  writeExclusive(outputs.tests, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-test-report-v1",
    status: "passed",
    runId: journal.runId,
    tests: journal.prechecks.tests,
    gpuStartedByTests: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.result, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-result-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_qualified",
    runId: journal.runId,
    capabilityVersion: CAPABILITY,
    gateResult: journal.gateResult,
    verifiedEvidence: verified,
    qualificationCriteria: {
      fixedTrainAndValidationIdentityBound: true,
      all23ConditionChannelsFiniteNonzeroGradient: true,
      all24AffineParameterTensorsFiniteNonzeroGradient: true,
      denoiserAndAutoencoderStateUnchanged: true,
      parameterGradFieldsRemainNone: true,
      readonlyCudaTelemetryPresent: true,
    },
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    checkpointWritten: false,
    smokeStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.nextAction, {
    schemaVersion: "ai-painter-local-next-action-v1",
    status: "ready",
    capabilityVersion: CAPABILITY,
    nextAction: NEXT_TASK,
    scope: "compile_one_new_unexecuted_controlled_smoke_contract_from_the_qualified_full_backbone_candidate",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticExecutionAllowed: true,
    forbiddenActions: [
      "start_smoke_before_contract_compilation",
      "start_stage0",
      "reuse_historical_or_failed_checkpoint",
      "change_model_loss_data_or_review_threshold",
    ],
    recordedAtUtc,
  })

  const planBeforeSha256 = sha(FILES.uniquePlan)
  assert.equal(planBeforeSha256, EXPECTED.uniquePlan)
  const nextPlan = updateUniquePlan(fs.readFileSync(FILES.uniquePlan, "utf8"), recordedAtUtc)
  const planAfterSha256 = shaText(nextPlan)
  const receiptRecord = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-plan-commit-receipt-v1",
    status: "plan_committed",
    runId: journal.runId,
    capabilityVersion: CAPABILITY,
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    expectedPreviousRegistryRevision: 42,
    expectedCommittedRegistryRevision: 43,
    recordedAtUtc,
  }
  const receiptBinding = { path: projectPath(receipt), sha256: shaJson(receiptRecord) }
  writeExclusive(outputs.planSync, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-plan-sync-v1",
    status: "prepared_for_atomic_projection_after_registry_commit",
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    nextLegalAction: NEXT_TASK,
    currentFixedProgress: progress(),
    recordedAtUtc,
  })
  writeExclusive(outputs.terminal, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-terminal-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_qualified",
    runId: journal.runId,
    capabilityVersion: CAPABILITY,
    formalResult: bind(outputs.result),
    cpuReport: bind(outputs.cpu),
    testReport: bind(outputs.tests),
    codeAndInputFreeze: bind(outputs.frozenInputs),
    nextAction: bind(outputs.nextAction),
    planSyncRecord: bind(outputs.planSync),
    planCommitReceipt: receiptBinding,
    gateAttemptTerminal: verified.attemptTerminal,
    gpuQualificationTerminal: verified.gpuQualificationTerminal,
    gpuDiagnosticReport: verified.gpuDiagnosticReport,
    currentFixedProgress: progress(),
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    smokeStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  const evidence = Object.entries(outputs)
    .filter(([role]) => role !== "capsule")
    .map(([kind, file]) => ({
      kind,
      labelZh: kind,
      ...bind(file),
      expectedSha256: sha(file),
      sha256Verified: true,
    }))
  writeExclusive(outputs.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${journal.runId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage 0→Stage 1→Stage 2完整训练",
      status: "full_backbone_spatial_affine_readonly_gpu_qualified",
    },
    latestBlocker: {
      code: "controlled_smoke_contract_not_yet_compiled",
      summaryZh: "全主干空间仿射只读GPU资格已通过；尚需编译一个全新、未执行的受控Smoke合同。",
    },
    nextAllowedAction: {
      code: NEXT_TASK,
      labelZh: "编译全主干空间仿射候选的受控Smoke合同。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "start_smoke_before_contract_compilation",
      "reuse_failed_checkpoint",
      "start_stage0",
      "lower_review_thresholds",
    ],
    taskIdentity: { modelId: CAPABILITY, runId: journal.runId, seed: 20263722 },
    evidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  assertExecutionCodeIdentityUnchanged(journal.codeIdentity)
  writeExclusiveText(stagedPlan, nextPlan)
  const registryAdvance = buildRegistryAdvanceForMock({
    runId: journal.runId,
    capsulePath: projectPath(outputs.capsule),
    terminalPath: projectPath(outputs.terminal),
  })
  const programEvent = {
    id: `stage4-full-backbone-spatial-affine-readonly-gpu-qualified-${journal.runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_full_backbone_spatial_affine_readonly_gpu_qualified",
    runId: journal.runId,
    kind: "readonly_gpu_qualification",
    status: "success",
    title: "Stage4 full-backbone spatial-affine readonly GPU qualification passed",
    titleZh: "Stage4全主干空间仿射只读GPU资格通过",
    detailZh: "固定train146与validation194、23通道梯度、24个仿射参数张量梯度、模型状态和CUDA遥测已完成只读验证。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  }
  const nextJournal = {
    ...journal,
    state: "artifacts_ready",
    updatedAtUtc: new Date().toISOString(),
    outputRoot: projectPath(formalOutputRoot),
    artifacts: Object.values(outputs).map((file) => bind(file)),
    verifiedGpuEvidence: verified,
    registryAdvance,
    plan: {
      path: projectPath(FILES.uniquePlan),
      stagedPath: projectPath(stagedPlan),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receiptPath: projectPath(receipt),
      receiptSha256: receiptBinding.sha256,
      receiptRecord,
    },
    programEvent,
    catalogFiles: [
      ...Object.values(outputs).map(projectPath),
      projectPath(receipt),
    ],
    terminal: bind(outputs.terminal),
    resultStatus: "stage4_full_backbone_spatial_affine_readonly_gpu_qualified",
    qualificationOutcome: "passed",
    nextLegalAction: NEXT_TASK,
  }
  writeJournal(nextJournal, journalPath)
  return readJournal(journalPath)
}

async function completeProjectionTransaction(initialJournal, journalPath) {
  let journal = initialJournal
  verifyJournalArtifacts(journal, { requirePlanReceipt: false })
  if (journal.state === "artifacts_ready") {
    assertExecutionCodeIdentityUnchanged(journal.codeIdentity)
    const registryCommit = await ensureRegistryCommitted(journal)
    journal = transitionJournal(journalPath, journal, "registry_committed", { registryCommit })
  }
  if (journal.state === "registry_committed") {
    await verifyRegistryCommit(journal)
    const planCommit = ensurePlanCommitted(journal)
    journal = transitionJournal(journalPath, journal, "plan_committed", { planCommit })
  }
  if (journal.state === "plan_committed") {
    await verifyRegistryCommit(journal)
    verifyPlanCommitted(journal)
    const eventCommit = ensureProgramEventCommitted(journal)
    for (const logicalPath of journal.catalogFiles) index(inside(logicalPath), journal.runId)
    journal = transitionJournal(journalPath, journal, "event_committed", {
      eventCommit,
      catalogCommit: { status: "indexed_idempotently", artifactCount: journal.catalogFiles.length },
    })
  }
  if (journal.state === "event_committed") {
    await verifyRegistryCommit(journal)
    verifyPlanCommitted(journal)
    verifyProgramEventCommitted(journal)
    verifyJournalArtifacts(journal, { requirePlanReceipt: true })
    journal = transitionJournal(journalPath, journal, "complete", {
      completedAtUtc: new Date().toISOString(),
      resultStatus: journal.resultStatus,
      qualificationOutcome: journal.qualificationOutcome,
      nextLegalAction: journal.nextLegalAction,
    })
  }
  assert.equal(journal.state, "complete")
  return journal
}

async function ensureRegistryCommitted(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  if (
    current.registry.runId === journal.runId
    && current.registry.terminalEvidence.path === journal.registryAdvance.terminalEvidencePath
  ) {
    const terminal = journal.artifacts.find(({ path: value }) => value === journal.registryAdvance.terminalEvidencePath)
    assert.notEqual(terminal, undefined)
    assert.equal(current.registry.terminalEvidence.sha256, terminal.sha256)
    return registryCommitIdentity(current)
  }
  assert.equal(current.registry.registryRevision, journal.registryAdvance.expectedPreviousRegistryRevision)
  assert.equal(current.registrySha256, journal.registryAdvance.expectedPreviousRegistrySha256)
  const advanced = await advanceCurrentExecutionRegistry({
    ...journal.registryAdvance,
    projectRoot: ROOT,
  })
  assert.equal(advanced.ok, true, advanced.errorCode)
  return registryCommitIdentity(advanced)
}

async function verifyRegistryCommit(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(current.registry.registryRevision, journal.registryCommit.registryRevision)
  assert.equal(current.registry.transactionId, journal.registryCommit.transactionId)
  assert.equal(current.registry.runId, journal.runId)
  assert.equal(current.registry.terminalEvidence.path, journal.registryAdvance.terminalEvidencePath)
}

function registryCommitIdentity(current) {
  return {
    registryRevision: current.registry.registryRevision,
    eventSequence: current.registry.eventSequence,
    registrySha256: current.registrySha256,
    transactionId: current.registry.transactionId,
    terminalEvidence: current.registry.terminalEvidence,
  }
}

function ensurePlanCommitted(journal) {
  const staged = inside(journal.plan.stagedPath)
  const plan = inside(journal.plan.path)
  assert.equal(sha(staged), journal.plan.afterSha256)
  const current = sha(plan)
  if (current === journal.plan.beforeSha256) {
    writeAtomic(plan, fs.readFileSync(staged, "utf8"))
  } else {
    assert.equal(current, journal.plan.afterSha256, "unique plan changed outside transaction")
  }
  const receipt = inside(journal.plan.receiptPath)
  if (!fs.existsSync(receipt)) writeExclusive(receipt, journal.plan.receiptRecord)
  assert.equal(sha(receipt), journal.plan.receiptSha256)
  return {
    status: "plan_committed",
    receiptPath: journal.plan.receiptPath,
    receiptSha256: journal.plan.receiptSha256,
    committedPlanSha256: journal.plan.afterSha256,
  }
}

function verifyPlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.path)), journal.plan.afterSha256)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

function ensureProgramEventCommitted(journal) {
  const existing = findProgramEvent(journal.programEvent.id)
  if (existing === null) {
    const appended = appendAiPainterProgramEvent(journal.programEvent)
    verifyProgramEventIdentity(appended, journal.programEvent)
  } else {
    verifyProgramEventIdentity(existing, journal.programEvent)
    indexProgramEvent(existing)
  }
  return { status: "event_committed", eventId: journal.programEvent.id }
}

function verifyProgramEventCommitted(journal) {
  const event = findProgramEvent(journal.programEvent.id)
  assert.notEqual(event, null)
  verifyProgramEventIdentity(event, journal.programEvent)
}

function findProgramEvent(eventId) {
  const ledger = inside(".runtime/ai-painter/training-process-ledger/events.jsonl")
  if (!fs.existsSync(ledger)) return null
  const matches = fs.readFileSync(ledger, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/^\uFEFF/u, "")))
    .filter((event) => event.id === eventId)
  assert.ok(matches.length <= 1, `duplicate program event: ${eventId}`)
  return matches[0] ?? null
}

function verifyProgramEventIdentity(actual, expected) {
  for (const key of ["id", "timestamp", "action", "runId", "kind", "status", "evidencePath", "evidenceSha256"]) {
    assert.deepEqual(actual[key], expected[key], `program event mismatch: ${key}`)
  }
}

async function recoverIncompleteTransactions() {
  if (!fs.existsSync(TRANSACTION_PARENT)) return []
  const recovered = []
  const directories = fs.readdirSync(TRANSACTION_PARENT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(TRANSACTION_PARENT, entry.name))
    .sort()
  for (const directory of directories) {
    const journalPath = path.join(directory, "transaction.json")
    if (!fs.existsSync(journalPath)) continue
    const journal = readJournal(journalPath)
    if (
      journal.schemaVersion !== "stage4-full-backbone-spatial-affine-readonly-gpu-formal-transaction-v1"
      || ["complete", "failed_closed"].includes(journal.state)
    ) continue
    const completed = await executePreparedTransaction(journal, journalPath)
    recovered.push({
      runId: completed.runId,
      state: completed.state,
      recoveryStatus: completed.resultStatus ?? completed.gateRecovery?.status ?? null,
      activeRole: completed.gateRecovery?.activeRole ?? null,
      activeProcessId: completed.gateRecovery?.processId ?? null,
      registryCommit: completed.registryCommit ?? null,
      automaticRetryPerformed: false,
    })
  }
  return recovered
}

function prepareFailureArtifacts(journalPath, journal) {
  validateGateResultEnvelope(journal.gateResult, journal.runId)
  assert.equal(journal.gateResult.executionState, "failed_closed")
  const attempt = verifyBinding(journal.gateResult.attemptTerminal, ROOT)
  const gateFailure = verifyBinding(journal.gateResult.failureReport, ROOT)
  assert.equal(
    attempt.file,
    path.resolve(ROOT, gateAttemptProjectPath(journal.runId), "phase-terminal.json"),
  )
  assert.equal(attempt.value.executionState, "failed_closed")
  assert.equal(attempt.value.runId, journal.runId)
  assert.equal(attempt.value.ownerAuthorizationRequired, false)
  assert.equal(attempt.value.automaticRetryAllowed, false)
  assert.deepEqual(attempt.value.failureReport, journal.gateResult.failureReport)
  assert.ok(
    gateFailure.value.executionState === "failed_closed"
      || gateFailure.value.status === "failed_closed",
  )
  assert.equal(gateFailure.value.runId, journal.runId)

  const failureOutputRoot = failureOutputRootFor(journal.runId)
  const stagedPlan = path.join(path.dirname(journalPath), "next-plan.md")
  assert.equal(fs.existsSync(failureOutputRoot), false)
  fs.mkdirSync(path.dirname(failureOutputRoot), { recursive: true })
  fs.mkdirSync(failureOutputRoot, { recursive: false })
  const recordedAtUtc = new Date().toISOString()
  const outputs = {
    failure: path.join(failureOutputRoot, "failure-report.json"),
    nextAction: path.join(failureOutputRoot, "local-next-action.json"),
    planSync: path.join(failureOutputRoot, "plan-sync-record.json"),
    terminal: path.join(failureOutputRoot, "phase-terminal.json"),
    capsule: path.join(failureOutputRoot, "local-task-capsule.json"),
  }
  const receipt = path.join(failureOutputRoot, "plan-commit-receipt.json")
  writeExclusive(outputs.failure, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-failure-v1",
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_not_qualified",
    runId: journal.runId,
    failedStep: journal.gateResult.failedStep,
    gateFailure: journal.gateResult,
    currentRegistryWillAdvanceToFailureClassification: true,
    controlledSmokeAdmissionAllowed: false,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.nextAction, {
    schemaVersion: "ai-painter-local-next-action-v1",
    status: "ready",
    capabilityVersion: CAPABILITY,
    nextAction: FAILURE_NEXT_TASK,
    scope: "classify_the_bound_readonly_gpu_failure_without_retry_or_smoke_admission",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticExecutionAllowed: true,
    forbiddenActions: [
      "automatic_retry",
      "compile_smoke_from_failed_gpu_qualification",
      "start_smoke",
      "start_stage0",
      "change_model_loss_data_or_review_threshold",
    ],
    recordedAtUtc,
  })

  const planBeforeSha256 = sha(FILES.uniquePlan)
  assert.equal(planBeforeSha256, EXPECTED.uniquePlan)
  const nextPlan = updateUniquePlanForQualificationFailure(
    fs.readFileSync(FILES.uniquePlan, "utf8"),
    recordedAtUtc,
    journal.gateResult.failedStep,
  )
  const planAfterSha256 = shaText(nextPlan)
  const receiptRecord = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-plan-commit-receipt-v1",
    status: "plan_committed",
    qualificationOutcome: "failed_closed",
    runId: journal.runId,
    capabilityVersion: CAPABILITY,
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    expectedPreviousRegistryRevision: 42,
    expectedCommittedRegistryRevision: 43,
    recordedAtUtc,
  }
  const receiptBinding = { path: projectPath(receipt), sha256: shaJson(receiptRecord) }
  writeExclusive(outputs.planSync, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-plan-sync-v1",
    status: "prepared_for_atomic_failure_projection_after_registry_commit",
    qualificationOutcome: "failed_closed",
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    nextLegalAction: FAILURE_NEXT_TASK,
    currentFixedProgress: progress(),
    recordedAtUtc,
  })
  writeExclusive(outputs.terminal, {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-formal-terminal-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_failure_recorded_smoke_denied",
    qualificationExecutionState: "failed_closed",
    runId: journal.runId,
    capabilityVersion: CAPABILITY,
    failureReport: bind(outputs.failure),
    gateAttemptTerminal: journal.gateResult.attemptTerminal,
    gateFailureReport: journal.gateResult.failureReport,
    nextAction: bind(outputs.nextAction),
    planSyncRecord: bind(outputs.planSync),
    planCommitReceipt: receiptBinding,
    currentFixedProgress: progress(),
    nextLegalAction: FAILURE_NEXT_TASK,
    controlledSmokeAdmissionAllowed: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticRetryAllowed: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  const evidence = Object.entries(outputs)
    .filter(([role]) => role !== "capsule")
    .map(([kind, file]) => ({
      kind,
      labelZh: kind,
      ...bind(file),
      expectedSha256: sha(file),
      sha256Verified: true,
    }))
  writeExclusive(outputs.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${journal.runId}-failed`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, status: "readonly_gpu_qualification_failed_closed" },
    latestBlocker: {
      code: journal.gateResult.failedStep,
      summaryZh: "只读GPU资格未通过；受控Smoke准入保持关闭。",
    },
    nextAllowedAction: {
      code: FAILURE_NEXT_TASK,
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: ["compile_smoke_from_failed_gpu_qualification", "automatic_retry", "start_training"],
    taskIdentity: { modelId: CAPABILITY, runId: journal.runId, seed: 20263722 },
    evidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  writeExclusiveText(stagedPlan, nextPlan)
  const registryAdvance = buildFailureRegistryAdvanceForMock({
    runId: journal.runId,
    capsulePath: projectPath(outputs.capsule),
    terminalPath: projectPath(outputs.terminal),
  })
  const programEvent = {
    id: `stage4-full-backbone-spatial-affine-readonly-gpu-failed-${journal.runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_full_backbone_spatial_affine_readonly_gpu_failed_closed",
    runId: journal.runId,
    kind: "readonly_gpu_qualification",
    status: "failed",
    title: "Stage4 full-backbone spatial-affine readonly GPU qualification failed",
    titleZh: "Stage4全主干空间仿射只读GPU资格失败关闭",
    detailZh: "只读GPU资格失败已由本地程序正式收口；受控Smoke准入关闭，下一步仅允许对绑定失败证据分类。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  }
  const nextJournal = {
    ...journal,
    state: "artifacts_ready",
    updatedAtUtc: new Date().toISOString(),
    outputRoot: projectPath(failureOutputRoot),
    artifacts: Object.values(outputs).map((file) => bind(file)),
    registryAdvance,
    plan: {
      path: projectPath(FILES.uniquePlan),
      stagedPath: projectPath(stagedPlan),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receiptPath: projectPath(receipt),
      receiptSha256: receiptBinding.sha256,
      receiptRecord,
    },
    programEvent,
    catalogFiles: [
      ...Object.values(outputs).map(projectPath),
      projectPath(receipt),
    ],
    terminal: bind(outputs.terminal),
    resultStatus: "stage4_full_backbone_spatial_affine_readonly_gpu_failure_recorded_smoke_denied",
    qualificationOutcome: "failed_closed",
    nextLegalAction: FAILURE_NEXT_TASK,
  }
  writeJournal(nextJournal, journalPath)
  return readJournal(journalPath)
}

async function verifyCurrentRegistry() {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, EXPECTED.currentRegistry)
  assert.equal(current.registry.registryRevision, 42)
  assert.equal(current.registry.eventSequence, 42)
  assert.equal(current.registry.capabilityVersion, CAPABILITY)
  assert.equal(current.registry.taskId, CURRENT_TASK)
  assert.equal(current.registry.taskKind, "readonly_gpu_qualification")
  assert.equal(current.registry.lifecycleStage, "cpu_contract_verified")
  assert.equal(current.registry.activeExecution, null)
  assert.equal(current.registry.terminalEvidence.sha256, EXPECTED.cpuTerminal)
  return current
}

function verifyCpuTerminal() {
  assert.equal(sha(FILES.cpuTerminal), EXPECTED.cpuTerminal)
  const terminal = read(FILES.cpuTerminal)
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.status, "stage4_full_backbone_spatial_affine_cpu_support_succeeded_inactive")
  assert.equal(terminal.capabilityVersion, CAPABILITY)
  assert.equal(terminal.nextLegalAction, CURRENT_TASK)
  assert.equal(terminal.ownerAuthorizationRequired, false)
  assert.equal(terminal.ownerResponseRequired, false)
  for (const key of ["checkpointWeightsRead", "optimizerCreated", "backwardExecuted", "gpuStarted", "trainingStarted"]) {
    assert.equal(terminal[key], false)
  }
  return terminal
}

function validateCpuChecker(checker) {
  assert.equal(checker.status, "passed")
  assert.equal(checker.positivePassed, checker.positiveTotal)
  assert.equal(checker.negativePassed, checker.negativeTotal)
  assert.ok(checker.positivePassed >= 8)
  assert.ok(checker.negativePassed >= 50)
  assert.equal(checker.actualImplementation.parameterTensorCount, 24)
  assert.equal(checker.actualImplementation.parameterCount, 745472)
  assert.equal(checker.modeAndPolicy.readonlyGpuQualification.ownerAuthorizationRequired, false)
  assert.equal(
    checker.modeAndPolicy.readonlyGpuQualification.qualificationSamples.identitySha256,
    EXPECTED.qualificationSamples,
  )
  assert.equal(Object.values(checker.executionBoundary).every((value) => value === false), true)
}

function runSyntaxChecks() {
  const pythonFiles = [
    FILES.model,
    FILES.modeRegistry,
    FILES.policy,
    FILES.contract,
    FILES.checker,
    FILES.modelTest,
    FILES.gpuRunner,
    FILES.gpuRunnerTest,
    FILES.gpuGate,
    FILES.gpuGateTest,
  ]
  const code = "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]"
  const python = spawnSync(PYTHON, ["-B", "-c", code, ...pythonFiles], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment({ cudaVisible: false }),
    timeout: CPU_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(python, "Python syntax check")
  const node = spawnSync(process.execPath, ["--check", FILES.runner], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: CPU_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(node, "Node syntax check")
  return { status: "passed", pythonAstFiles: pythonFiles.map(projectPath), nodeSyntaxFile: projectPath(FILES.runner) }
}

function runPythonJson(args) {
  const result = spawnSync(PYTHON, ["-B", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment({ cudaVisible: false }),
    maxBuffer: 64 * 1024 * 1024,
    timeout: CPU_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(result, "Python JSON check")
  return parseJsonOutput(result.stdout, "Python JSON check")
}

function runUnitTests(files) {
  const result = spawnSync(PYTHON, ["-B", "-m", "unittest", ...files], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment({ cudaVisible: false }),
    maxBuffer: 64 * 1024 * 1024,
    timeout: CPU_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  assertChildSucceeded(result, "Python unittest")
  const transcript = `${result.stdout}\n${result.stderr}`
  const match = transcript.match(/Ran\s+(\d+)\s+tests?/u)
  assert.notEqual(match, null)
  assert.match(transcript, /\bOK\b/u)
  return { status: "passed", testCount: Number(match[1]), files: files.map(projectPath) }
}

export function updateUniquePlan(source, timestamp) {
  let output = source
  output = replaceOnce(
    output,
    /^更新时间：.*$/mu,
    `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`,
  )
  output = replaceOnce(
    output,
    /^状态：.*$/mu,
    "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射只读GPU资格已通过，受控Smoke合同待编译",
  )
  output = replaceOnce(
    output,
    /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；全主干空间仿射候选CPU支持及只读GPU资格已通过，固定双样本、23通道与24个仿射参数张量梯度、模型状态和资源证据完整 | 下一步由本地程序编译一个全新、未执行的受控Smoke合同；合同完成前不得启动Smoke或Stage 0 |",
  )
  output = replaceOnce(
    output,
    /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    "## 5. 当前阻断与后续实施顺序\n\n全主干空间仿射候选已经通过CPU未激活支持和一次全新只读GPU资格。资格使用固定种子20263722、正式选择后的首条train记录与固定validation样本194；真实CUDA前向证明23通道条件和24个正式仿射参数张量均具有有限非零梯度，Denoiser与冻结Autoencoder前后状态哈希不变，所有参数`.grad`保持为空。资格过程未创建优化器、未执行`.backward()`、未修改权重、未写Checkpoint，也未启动Smoke或训练。\n\n当前唯一阻断是尚未编译该候选的受控Smoke合同。下一步只允许物化一个全新、未执行的Smoke合同，固定数据、条件、Loss、审核阈值、种子、样本与证据隔离边界；合同及CPU正反门通过后才允许启动受控Smoke。不得复用历史Denoiser、失败Checkpoint、旧Run或旧输出。\n",
  )
  return output
}

export function updateUniquePlanForQualificationFailure(source, timestamp, failedStep) {
  assert.equal(typeof failedStep, "string")
  assert.notEqual(failedStep.trim(), "")
  let output = source
  output = replaceOnce(
    output,
    /^更新时间：.*$/mu,
    `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`,
  )
  output = replaceOnce(
    output,
    /^状态：.*$/mu,
    "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射只读GPU资格失败已收口，失败分类待执行",
  )
  output = replaceOnce(
    output,
    /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    `| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；全主干空间仿射候选只读GPU资格在\`${failedStep}\`失败，失败终态、程序证据和当前执行身份已正式收口，Smoke准入关闭 | 下一步由本地程序只读分类本次固定失败证据；不得自动重试、编译Smoke或启动Stage 0 |`,
  )
  output = replaceOnce(
    output,
    /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    `## 5. 当前阻断与后续实施顺序\n\n全主干空间仿射候选的只读GPU资格已经执行并在\`${failedStep}\`失败关闭。失败终态、失败报告、固定代码身份、Gate尝试身份及本地任务胶囊已经绑定；当前执行登记和本计划必须指向该失败分类任务，不能回退投影到旧CPU终态。受控Smoke准入保持关闭。\n\n下一步仅允许本地程序对本次不可变失败证据执行CPU只读分类，区分资源、基础设施、身份合同或真实CUDA资格失败，并形成唯一后续动作。不得自动重试GPU资格、不得编译或启动Smoke、不得创建优化器、执行\`.backward()\`、写Checkpoint或启动Stage 0。\n`,
  )
  return output
}

export function buildRegistryAdvanceForMock({ runId, capsulePath, terminalPath }) {
  validateRunId(runId)
  return {
    capabilityVersion: CAPABILITY,
    packageId: runId,
    taskId: NEXT_TASK,
    taskKind: "controlled_smoke_contract_compilation",
    runId,
    lifecycleStage: "readonly_gpu_qualified",
    executionState: "completed",
    activity: "readonly_gpu_qualification_passed",
    taskCapsulePath: capsulePath,
    terminalEvidencePath: terminalPath,
    expectedPreviousRegistryRevision: 42,
    expectedPreviousRegistrySha256: EXPECTED.currentRegistry,
  }
}

export function buildFailureRegistryAdvanceForMock({ runId, capsulePath, terminalPath }) {
  validateRunId(runId)
  return {
    capabilityVersion: CAPABILITY,
    packageId: runId,
    taskId: FAILURE_NEXT_TASK,
    taskKind: "readonly_gpu_failure_classification",
    runId,
    lifecycleStage: "readonly_gpu_qualification_failed_closed",
    executionState: "failed_closed",
    activity: "readonly_gpu_failure_recorded_smoke_denied",
    taskCapsulePath: capsulePath,
    terminalEvidencePath: terminalPath,
    expectedPreviousRegistryRevision: 42,
    expectedPreviousRegistrySha256: EXPECTED.currentRegistry,
  }
}

function verifyJournalArtifacts(journal, { requirePlanReceipt }) {
  for (const binding of journal.artifacts) {
    const file = inside(binding.path)
    assert.equal(fs.existsSync(file), true)
    assert.equal(sha(file), binding.sha256)
  }
  if (requirePlanReceipt) {
    assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
  }
}

function transitionJournal(journalPath, journal, state, additions = {}) {
  const next = { ...journal, ...additions, state, updatedAtUtc: new Date().toISOString() }
  writeJournal(next, journalPath)
  return readJournal(journalPath)
}

function freezeExecutionCodeIdentity() {
  return Object.fromEntries(EXECUTION_FILE_ROLES.map((role) => [role, bind(FILES[role])]))
}

function assertExecutionCodeIdentityUnchanged(identity) {
  assert.deepEqual(freezeExecutionCodeIdentity(), identity, "readonly GPU execution code changed during run")
}

function verifyBinding(value, root) {
  assert.equal(isBinding(value), true)
  const file = resolveInsideRoot(root, value.path)
  assert.equal(fs.existsSync(file), true, `bound evidence missing: ${value.path}`)
  assert.equal(sha(file), value.sha256, `bound evidence SHA mismatch: ${value.path}`)
  return { file, value: read(file), binding: value }
}

function isBinding(value) {
  return Boolean(
    value
    && typeof value === "object"
    && typeof value.path === "string"
    && /^[a-f0-9]{64}$/u.test(value.sha256),
  )
}

function resolveInsideRoot(root, relative) {
  assert.equal(path.isAbsolute(relative), false)
  assert.ok(!relative.split(/[\\/]/u).some((part) => part === ".."))
  const candidate = path.resolve(root, relative)
  assert.ok(candidate.startsWith(`${path.resolve(root)}${path.sep}`))
  return candidate
}

function gateOutputProjectPath(runId) {
  return `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${runId}`
}

function gateAttemptProjectPath(runId) {
  validateRunId(runId)
  return `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${runId}`
}

function transactionRootFor(runId) {
  validateRunId(runId)
  return path.join(TRANSACTION_PARENT, runId)
}

function formalOutputRootFor(runId) {
  validateRunId(runId)
  return inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-results/${runId}`)
}

function failureOutputRootFor(runId) {
  validateRunId(runId)
  return inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-failures/${runId}`)
}

function gateAttemptRootFor(runId) {
  return inside(gateAttemptProjectPath(runId))
}

function gateOutputRootFor(runId) {
  return inside(gateOutputProjectPath(runId))
}

export function buildRunPathsForMock(runId) {
  return {
    transactionRoot: projectPath(transactionRootFor(runId)),
    formalOutputRoot: projectPath(formalOutputRootFor(runId)),
    failureOutputRoot: projectPath(failureOutputRootFor(runId)),
    gateAttemptRoot: projectPath(gateAttemptRootFor(runId)),
    gateOutputRoot: projectPath(gateOutputRootFor(runId)),
  }
}

function parseJsonOutput(value, label) {
  const source = String(value ?? "").trim()
  assert.notEqual(source, "", `${label} output is empty`)
  return JSON.parse(source.replace(/^\uFEFF/u, ""))
}

function pythonEnvironment({ cudaVisible }) {
  const pythonPath = [
    inside("ml/ai-painter/src"),
    inside("ml/ai-painter/scripts"),
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter)
  const env = { ...process.env, PYTHONPATH: pythonPath }
  if (!cudaVisible) env.CUDA_VISIBLE_DEVICES = ""
  return env
}

function assertChildSucceeded(result, label) {
  assert.equal(
    result.error,
    undefined,
    `${label} failed to start: ${result.error?.message ?? "unknown"}`,
  )
  assert.equal(
    result.status,
    0,
    `${label} failed (${result.status})\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`,
  )
}

function newRunId() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll("-", "")
  const time = now.toISOString().slice(11, 23).replaceAll(":", "").replace(".", "")
  return `full-backbone-spatial-affine-readonly-gpu-${date}-${time}-${crypto.randomUUID().slice(0, 8)}`
}

function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaBytes(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function shaJson(value) { return shaText(`${JSON.stringify(value, null, 2)}\n`) }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function writeExclusiveText(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" }) }
function writeAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file) }
function writeJournal(value, journalPath = TRANSACTION_JOURNAL) { fs.mkdirSync(path.dirname(journalPath), { recursive: true }); writeAtomic(journalPath, `${JSON.stringify(value, null, 2)}\n`) }
function readJournal(journalPath) { return read(journalPath) }
function replaceOnce(source, pattern, replacement) { assert.match(source, pattern); const output = source.replace(pattern, replacement); assert.notEqual(output, source); return output }
function inside(relative) { assert.equal(path.isAbsolute(relative), false); const candidate = path.resolve(ROOT, relative); assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`)); return candidate }
function index(file, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }

function recordUnexpectedFailure(error) {
  try {
    const journalPath = activeJournalPath ?? TRANSACTION_JOURNAL
    const journal = fs.existsSync(journalPath) ? readJournal(journalPath) : null
    if (journal?.state === "complete") return
    const runId = journal?.runId ?? RUN_ID
    const failureOutputRoot = failureOutputRootFor(runId)
    fs.mkdirSync(path.dirname(failureOutputRoot), { recursive: true })
    if (!fs.existsSync(failureOutputRoot)) fs.mkdirSync(failureOutputRoot, { recursive: false })
    const failure = path.join(failureOutputRoot, "orchestrator-failure.json")
    if (fs.existsSync(failure)) return
    writeExclusive(failure, {
      schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-orchestrator-failure-v1",
      executionState: "failed_closed",
      status: "orchestrator_failed_without_smoke_admission",
      runId,
      transactionState: journal?.state ?? null,
      error: error instanceof Error ? error.stack : String(error),
      controlledSmokeAdmissionAllowed: false,
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
      recordedAtUtc: new Date().toISOString(),
    })
    index(failure, runId)
  } catch (recordingError) {
    process.stderr.write(`failure evidence recording also failed: ${recordingError}\n`)
  }
}

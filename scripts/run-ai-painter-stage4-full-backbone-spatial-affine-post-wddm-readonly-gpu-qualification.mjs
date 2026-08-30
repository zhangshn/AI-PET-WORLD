import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  finalizePreparedCurrentExecutionRegistryAdvance,
  prepareCurrentExecutionRegistryAdvance,
  readCurrentExecutionRegistry,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
const CURRENT_TASK = "qualify_stage4_full_backbone_spatial_affine_readonly_gpu_after_wddm_correction"
const SUCCESS_NEXT_TASK = "compile_stage4_full_backbone_spatial_affine_controlled_smoke_contract"
const FAILURE_NEXT_TASK = "classify_stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_failure"
const SOURCE_CLASSIFICATION = "wddm_resource_preflight_process_classification_defect_confirmed_and_corrected"
const SOURCE_TERMINAL_SCHEMA = "stage4-windows-wddm-resource-preflight-failure-classification-terminal-v1"
const SOURCE_TERMINAL_STATUS = "stage4_windows_wddm_resource_preflight_failure_classified_and_corrected"
const RETIRED_FAILED_RUN_ID = "full-backbone-spatial-affine-readonly-gpu-20260829-022348295-bd7c317d"
const EXPECTED_GATE_SHA256 = "60ee0cf985528f87e1c1103f94eb31c12f97cb7156d90e5f21e6f3203da29701"
const EXPECTED_PREVIOUS_REGISTRY_REVISION = 44
const FIRST_TRAIN_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const FIXED_VALIDATION_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const GPU_GATE_TIMEOUT_MS = 45 * 60 * 1000
const TRANSACTION_SCHEMA = "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-transaction-v1"
const TRANSACTION_PARENT = inside(
  ".runtime/ai-painter/stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-transactions",
)
const SUCCESS_PARENT = inside(
  ".runtime/ai-painter/stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-qualifications",
)
const FAILURE_PARENT = inside(
  ".runtime/ai-painter/stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-failures",
)
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")

const FILES = Object.freeze({
  registry: inside(".runtime/ai-painter/current-execution-registry/current.json"),
  plan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  gate: inside("ml/ai-painter/scripts/execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate.py"),
  eventStore: inside("scripts/lib/ai-painter-program-event-store.mjs"),
  registryHelper: inside("src/server/ai-painter-current-execution-registry.mjs"),
  runner: inside("scripts/run-ai-painter-stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-qualification.mjs"),
  test: inside("scripts/tests/test-ai-painter-stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-qualification.mjs"),
})

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}

async function main() {
  const sourceBinding = parseArguments(process.argv.slice(2))
  const recovered = await recoverIncompleteTransactions(sourceBinding)
  if (recovered !== null) {
    process.stdout.write(`${JSON.stringify(recovered, null, 2)}\n`)
    if (recovered.qualificationOutcome === "failed_closed") process.exitCode = 1
    return
  }

  const current = await verifyRevision44Source(sourceBinding)
  const runId = newRunId()
  const paths = runPaths(runId)
  assertFreshRun(paths, runId, current.registry.runId)
  fs.mkdirSync(TRANSACTION_PARENT, { recursive: true })
  fs.mkdirSync(paths.transactionRoot, { recursive: false })
  const journalPath = paths.journal
  let journal = {
    schemaVersion: TRANSACTION_SCHEMA,
    transactionId: runId,
    runId,
    journalPath: projectPath(journalPath),
    state: "prepared",
    capabilityVersion: CAPABILITY,
    sourceCorrection: sourceBinding,
    sourceCorrectionRunId: current.registry.runId,
    sourceRegistry: {
      registryRevision: current.registry.registryRevision,
      eventSequence: current.registry.eventSequence,
      sha256: current.registrySha256,
      taskId: current.registry.taskId,
      taskKind: current.registry.taskKind,
    },
    codeIdentity: freezeCodeIdentity(),
    gateAttemptRoot: projectPath(paths.gateAttemptRoot),
    gateOutputRoot: projectPath(paths.gateOutputRoot),
    createdAtUtc: new Date().toISOString(),
  }
  writeJournal(journalPath, journal)
  journal = await executeTransaction(journalPath, read(journalPath))
  process.stdout.write(`${JSON.stringify(resultProjection(journal), null, 2)}\n`)
  if (journal.qualificationOutcome === "failed_closed") process.exitCode = 1
}

function parseArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    assert.ok([
      "--expected-registry-sha256",
      "--correction-terminal-path",
      "--correction-terminal-sha256",
      "--expected-plan-sha256",
    ].includes(flag), `unknown argument: ${flag}`)
    assert.equal(typeof value, "string", `${flag} requires a value`)
    assert.equal(values.has(flag), false, `${flag} supplied more than once`)
    values.set(flag, value)
  }
  assert.equal(values.size, 4, "registry, correction terminal, and plan bindings are all required")
  const source = {
    path: normalizeProjectRelative(values.get("--correction-terminal-path")),
    sha256: values.get("--correction-terminal-sha256"),
    registrySha256: values.get("--expected-registry-sha256"),
    planSha256: values.get("--expected-plan-sha256"),
  }
  for (const role of ["sha256", "registrySha256", "planSha256"]) {
    assert.match(source[role], /^[0-9a-f]{64}$/u)
  }
  assert.match(
    source.path,
    /^\.runtime\/ai-painter\/stage4-windows-wddm-resource-preflight-failure-classifications\/stage4-wddm-resource-classification-[0-9]{17}-[0-9a-f]{8}\/phase-terminal\.json$/u,
  )
  assert.doesNotMatch(source.path, new RegExp(RETIRED_FAILED_RUN_ID, "u"))
  return source
}

export function parseArgumentsForMock(args) {
  return parseArguments(args)
}

async function verifyRevision44Source(sourceBinding) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  validateRevision44SourceForMock({
    registry: current.registry,
    registrySha256: current.registrySha256,
    terminal: current.currentTaskTerminal,
    sourceBinding,
  })
  assert.equal(current.registrySha256, sourceBinding.registrySha256, "rev44 registry SHA-256 mismatch")
  assert.equal(sha(FILES.plan), sourceBinding.planSha256, "post-correction plan SHA-256 mismatch")
  verifyBinding(sourceBinding, ROOT)
  validateCorrectionTerminalBindings(current.currentTaskTerminal, ROOT)
  validateCommittedCorrectionOuterTransaction(current.currentTaskTerminal, current, ROOT)
  return current
}

export function validateRevision44SourceForMock({
  registry,
  registrySha256,
  terminal,
  sourceBinding,
}) {
  assert.match(registrySha256, /^[0-9a-f]{64}$/u)
  assert.match(sourceBinding.registrySha256, /^[0-9a-f]{64}$/u)
  assert.match(sourceBinding.planSha256, /^[0-9a-f]{64}$/u)
  assert.equal(registrySha256, sourceBinding.registrySha256)
  assert.match(
    sourceBinding.path,
    /^\.runtime\/ai-painter\/stage4-windows-wddm-resource-preflight-failure-classifications\/stage4-wddm-resource-classification-[0-9]{17}-[0-9a-f]{8}\/phase-terminal\.json$/u,
  )
  assert.doesNotMatch(sourceBinding.path, new RegExp(RETIRED_FAILED_RUN_ID, "u"))
  assert.equal(registry.registryRevision, EXPECTED_PREVIOUS_REGISTRY_REVISION)
  assert.equal(registry.eventSequence, EXPECTED_PREVIOUS_REGISTRY_REVISION)
  assert.equal(registry.capabilityVersion, CAPABILITY)
  assert.equal(registry.taskId, CURRENT_TASK)
  assert.equal(registry.taskKind, "readonly_gpu_qualification")
  assert.equal(registry.lifecycleStage, "readonly_gpu_qualification_ready_after_wddm_correction")
  assert.equal(registry.executionState, "completed")
  assert.equal(registry.activity, "windows_wddm_resource_preflight_defect_confirmed_and_corrected")
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.terminalEvidence.path, sourceBinding.path)
  assert.equal(registry.terminalEvidence.sha256, sourceBinding.sha256)
  assert.equal(registry.terminalEvidence.status, SOURCE_TERMINAL_STATUS)
  assert.notEqual(registry.runId, RETIRED_FAILED_RUN_ID)
  assert.notEqual(registry.packageId, RETIRED_FAILED_RUN_ID)
  assert.match(registry.runId, /^stage4-wddm-resource-classification-[0-9]{17}-[0-9a-f]{8}$/u)
  assert.equal(registry.supersedes?.registryRevision, 43)
  assert.equal(registry.supersedes?.taskId, "classify_stage4_full_backbone_spatial_affine_readonly_gpu_failure")
  assert.equal(registry.supersedes?.runId, RETIRED_FAILED_RUN_ID)

  assert.equal(terminal.schemaVersion, SOURCE_TERMINAL_SCHEMA)
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.status, SOURCE_TERMINAL_STATUS)
  assert.equal(terminal.runId, registry.runId)
  assert.equal(terminal.sourceRunId, RETIRED_FAILED_RUN_ID)
  assert.equal(terminal.classification, SOURCE_CLASSIFICATION)
  assert.equal(terminal.nextLegalAction, CURRENT_TASK)
  assert.equal(terminal.ownerAuthorizationRequired, false)
  assert.equal(terminal.ownerResponseRequired, false)
  assert.equal(terminal.automaticQualificationReplayAllowed, false)
  assert.equal(terminal.controlledSmokeAdmissionAllowed, false)
  assert.equal(terminal.gpuStarted, false)
  assert.equal(terminal.trainingStarted, false)
  assert.equal(isBinding(terminal.correctionAction), true)
  assert.equal(isBinding(terminal.cpuValidation), true)
  assert.equal(isBinding(terminal.failureClassification), true)
  assert.equal(terminal.outerTransaction?.requiredState, "complete")
  assert.match(
    terminal.outerTransaction?.path,
    /^\.runtime\/ai-painter\/stage4-windows-wddm-resource-preflight-failure-classification-transactions\/stage4-wddm-resource-classification-[0-9]{17}-[0-9a-f]{8}\/transaction\.json$/u,
  )
  assert.match(
    terminal.outerTransaction?.commitMarker?.path,
    /^\.runtime\/ai-painter\/stage4-windows-wddm-resource-preflight-failure-classifications\/stage4-wddm-resource-classification-[0-9]{17}-[0-9a-f]{8}\/transaction-commit-marker\.json$/u,
  )
  assert.equal(
    terminal.outerTransaction?.commitMarker?.schemaVersion,
    "stage4-windows-wddm-resource-preflight-classification-commit-marker-v1",
  )
  return true
}

function validateCommittedCorrectionOuterTransaction(terminal, current, root) {
  const outer = verifyBinding({
    path: terminal.outerTransaction.path,
    sha256: sha(resolveInsideRoot(root, terminal.outerTransaction.path)),
  }, root).value
  assert.equal(outer.state, "complete")
  assert.equal(outer.runId, terminal.runId)
  assert.equal(outer.terminal.path, current.registry.terminalEvidence.path)
  assert.equal(outer.terminal.sha256, current.registry.terminalEvidence.sha256)
  assert.equal(outer.registryCommit.registryRevision, 44)
  assert.equal(outer.registryCommit.registrySha256, current.registrySha256)
  assert.equal(outer.commitMarker.path, terminal.outerTransaction.commitMarker.path)
  const marker = verifyBinding(outer.commitMarker, root).value
  assert.equal(marker.schemaVersion, terminal.outerTransaction.commitMarker.schemaVersion)
  assert.equal(marker.status, "committed")
  assert.equal(marker.transactionId, outer.transactionId)
  assert.equal(marker.runId, terminal.runId)
  assert.equal(marker.registry.registryRevision, 44)
  assert.equal(marker.registry.registrySha256, current.registrySha256)
  assert.equal(marker.terminal.path, current.registry.terminalEvidence.path)
  assert.equal(marker.terminal.sha256, current.registry.terminalEvidence.sha256)
  assert.equal(marker.programContinuity?.immutableClassificationArtifactsReverified, true)
}

function validateCorrectionTerminalBindings(terminal, root) {
  const classification = verifyBinding(terminal.failureClassification, root).value
  assert.equal(classification.status, "classified")
  assert.equal(classification.classification, SOURCE_CLASSIFICATION)
  assert.equal(classification.sourceRunId, RETIRED_FAILED_RUN_ID)
  assert.equal(classification.correctionImplementedAndCpuVerified, true)
  assert.equal(classification.onlyLegalNextAction, CURRENT_TASK)
  assert.equal(classification.automaticQualificationReplayAllowed, false)
  assert.equal(classification.controlledSmokeAdmissionAllowed, false)
  assert.equal(classification.ownerAuthorizationRequired, false)

  const correction = verifyBinding(terminal.correctionAction, root).value
  assert.equal(correction.status, "cpu_correction_implemented_and_verified")
  assert.equal(correction.classification, SOURCE_CLASSIFICATION)
  assert.equal(correction.sourceRunId, RETIRED_FAILED_RUN_ID)
  assert.equal(correction.automaticQualificationReplayAllowed, false)
  assert.equal(correction.ownerAuthorizationRequired, false)
  assert.equal(correction.gpuStarted, false)

  const cpuValidation = verifyBinding(terminal.cpuValidation, root).value
  assert.equal(cpuValidation.status, "passed")
  assert.equal(cpuValidation.gpuWorkloadStarted, false)
  assert.equal(cpuValidation.ownerAuthorizationRequired, false)
}

async function executeTransaction(journalPath, initialJournal) {
  let journal = initialJournal
  if (journal.state === "prepared") {
    await reverifyPreparedSource(journal)
    assertCodeIdentityUnchanged(journal.codeIdentity)
    journal = transition(journalPath, journal, "gate_running", {
      gateStartedAtUtc: new Date().toISOString(),
      automaticRetryAllowed: false,
    })
    const gate = invokeGpuGate(journal.runId)
    journal = transition(journalPath, journal, gate.ok ? "gate_succeeded" : "gate_failed", {
      gateResult: gate.result,
      gateExitCode: gate.exitCode,
      gateStdoutSha256: shaText(gate.stdout),
      gateStderrSha256: shaText(gate.stderr),
    })
  }
  if (journal.state === "gate_running") {
    journal = recoverGateState(journalPath, journal)
    if (journal.state === "gate_running") return journal
  }
  if (journal.state === "gate_succeeded") {
    await reverifyPreparedSource(journal)
    assertCodeIdentityUnchanged(journal.codeIdentity)
    const evidence = validateGateSuccess(journal.gateResult, journal.runId, ROOT)
    journal = prepareArtifacts(journalPath, journal, { passed: true, evidence })
  }
  if (journal.state === "gate_failed") {
    validateGateEnvelope(journal.gateResult, journal.runId)
    journal = prepareArtifacts(journalPath, journal, { passed: false, evidence: null })
  }
  if ([
    "artifacts_ready",
    "plan_committed",
    "event_committed",
    "dependencies_committed",
    "registry_prepared",
    "registry_committed",
  ].includes(journal.state)) {
    journal = await completeProjectionTransaction(journalPath, journal)
  }
  assert.equal(journal.state, "complete")
  return journal
}

async function reverifyPreparedSource(journal) {
  const current = await verifyRevision44Source(journal.sourceCorrection)
  assert.equal(current.registrySha256, journal.sourceRegistry.sha256)
  assert.equal(current.registry.runId, journal.sourceCorrectionRunId)
}

function invokeGpuGate(runId) {
  const invocation = buildGateInvocationForMock(runId)
  const completed = spawnSync(invocation.command, invocation.args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
    timeout: GPU_GATE_TIMEOUT_MS,
    killSignal: "SIGKILL",
  })
  const stdout = completed.stdout ?? ""
  const stderr = completed.stderr ?? ""
  if (completed.error) throw completed.error
  const result = parseJsonOutput(stdout, "post-WDDM readonly GPU gate")
  validateGateEnvelope(result, runId)
  return {
    ok: completed.status === 0,
    exitCode: completed.status,
    stdout,
    stderr,
    result,
  }
}

export function buildGateInvocationForMock(runId) {
  validateRunId(runId)
  assert.notEqual(runId, RETIRED_FAILED_RUN_ID)
  return {
    command: PYTHON,
    args: ["-B", FILES.gate, "--run-id", runId],
    gateSha256: EXPECTED_GATE_SHA256,
    automaticRetryAllowed: false,
  }
}

function recoverGateState(journalPath, journal) {
  const attemptTerminal = path.join(runPaths(journal.runId).gateAttemptRoot, "phase-terminal.json")
  if (fs.existsSync(attemptTerminal)) {
    const terminal = read(attemptTerminal)
    assert.equal(terminal.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-gate-terminal-v1")
    assert.equal(terminal.runId, journal.runId)
    assert.equal(terminal.ownerAuthorizationRequired, false)
    assert.equal(terminal.automaticRetryAllowed, false)
    const attemptBinding = bind(attemptTerminal)
    let gateResult
    if (terminal.executionState === "completed") {
      gateResult = {
        schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
        executionState: "completed",
        status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_completed",
        runId: journal.runId,
        outputNamespace: gateOutputProjectPath(journal.runId),
        attemptTerminal: attemptBinding,
        gpuQualificationTerminal: terminal.gpuQualificationTerminal,
        gpuDiagnosticReport: terminal.gpuDiagnosticReport,
        ownerAuthorizationRequired: false,
      }
    } else {
      assert.equal(terminal.executionState, "failed_closed")
      gateResult = {
        schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
        executionState: "failed_closed",
        status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed",
        runId: journal.runId,
        failedStep: terminal.failedStep,
        error: "recovered_failed_gate_terminal",
        attemptTerminal: attemptBinding,
        failureReport: terminal.failureReport,
        ownerAuthorizationRequired: false,
      }
    }
    validateGateEnvelope(gateResult, journal.runId)
    return transition(journalPath, journal, gateResult.executionState === "completed" ? "gate_succeeded" : "gate_failed", {
      gateResult,
      gateRecoveredFromTerminal: true,
    })
  }

  const processState = detectGateProcess(journal.runId)
  const decision = decideGateRecoveryForMock({ terminalExists: false, processState })
  if (decision.status === "in_progress") {
    return transition(journalPath, journal, "gate_running", {
      gateRecovery: decision,
    })
  }
  const interrupted = path.join(runPaths(journal.runId).transactionRoot, "interrupted-gate-failure.json")
  if (!fs.existsSync(interrupted)) {
    writeExclusive(interrupted, {
      schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-interrupted-gate-failure-v1",
      executionState: "failed_closed",
      status: "post_wddm_readonly_gpu_gate_interrupted_without_terminal",
      runId: journal.runId,
      failedStep: "gate_interrupted_without_terminal",
      processState,
      automaticRetryAllowed: false,
      ownerAuthorizationRequired: false,
      recordedAtUtc: new Date().toISOString(),
    })
  }
  const gateResult = {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1",
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed",
    runId: journal.runId,
    failedStep: "gate_interrupted_without_terminal",
    error: "gate process is absent and no immutable terminal exists; replay forbidden",
    attemptTerminal: bind(interrupted),
    failureReport: bind(interrupted),
    ownerAuthorizationRequired: false,
  }
  return transition(journalPath, journal, "gate_failed", {
    gateResult,
    gateRecoveredAsInterruptedFailure: true,
  })
}

export function decideGateRecoveryForMock({ terminalExists, processState }) {
  if (terminalExists) {
    return { status: "recover_terminal", automaticRetryAllowed: false, newRunAllowed: false }
  }
  assert.ok(["active", "dead", "indeterminate"].includes(processState))
  if (processState !== "dead") {
    return {
      status: "in_progress",
      processState,
      automaticRetryAllowed: false,
      newRunAllowed: false,
    }
  }
  return {
    status: "interrupted_failed_closed",
    processState,
    automaticRetryAllowed: false,
    newRunAllowed: false,
  }
}

function detectGateProcess(runId) {
  const command = process.platform === "win32"
    ? ["powershell.exe", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"]]
    : ["ps", ["-eo", "pid=,args="]]
  const completed = spawnSync(command[0], command[1], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  })
  if (completed.status !== 0) return "indeterminate"
  try {
    if (process.platform === "win32") {
      const parsed = JSON.parse(completed.stdout || "[]")
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      return rows.some((row) => typeof row?.CommandLine === "string"
        && row.CommandLine.includes(projectPath(FILES.gate).replaceAll("/", "\\"))
        && row.CommandLine.includes(runId)) ? "active" : "dead"
    }
    return completed.stdout.split(/\r?\n/u).some((line) => line.includes(projectPath(FILES.gate)) && line.includes(runId))
      ? "active"
      : "dead"
  } catch {
    return "indeterminate"
  }
}

function validateGateEnvelope(result, runId) {
  validateRunId(runId)
  assert.equal(result.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-gate-result-v1")
  assert.equal(result.runId, runId)
  assert.equal(result.ownerAuthorizationRequired, false)
  assert.notEqual(result.runId, RETIRED_FAILED_RUN_ID)
  assert.equal(isBinding(result.attemptTerminal), true)
  if (result.executionState === "completed") {
    assert.equal(result.status, "stage4_full_backbone_spatial_affine_readonly_gpu_gate_completed")
    assert.equal(result.outputNamespace, gateOutputProjectPath(runId))
    assert.equal(result.attemptTerminal.path, `${gateAttemptProjectPath(runId)}/phase-terminal.json`)
    assert.equal(result.gpuQualificationTerminal.path, `${gateOutputProjectPath(runId)}/phase-terminal.json`)
    assert.equal(result.gpuDiagnosticReport.path, `${gateOutputProjectPath(runId)}/gpu-diagnostic-report.json`)
    assert.equal(result.failureReport, undefined)
  } else {
    assert.equal(result.executionState, "failed_closed")
    assert.equal(result.status, "stage4_full_backbone_spatial_affine_readonly_gpu_gate_failed")
    assert.equal(typeof result.failedStep, "string")
    assert.equal(isBinding(result.failureReport), true)
    assert.equal(result.gpuQualificationTerminal, undefined)
    if (result.failedStep === "gate_interrupted_without_terminal") {
      const transactionPrefix = projectPath(runPaths(runId).transactionRoot)
      assert.match(result.attemptTerminal.path, new RegExp(`^${escapeRegExp(transactionPrefix)}/`, "u"))
      assert.match(result.failureReport.path, new RegExp(`^${escapeRegExp(transactionPrefix)}/`, "u"))
    } else {
      assert.equal(result.attemptTerminal.path, `${gateAttemptProjectPath(runId)}/phase-terminal.json`)
      assert.equal(result.failureReport.path, `${gateAttemptProjectPath(runId)}/failure-report.json`)
    }
  }
  return result
}

export function validateGateEnvelopeForMock(result, runId) {
  return validateGateEnvelope(result, runId)
}

function validateGateSuccess(result, runId, root) {
  validateGateEnvelope(result, runId)
  const attempt = verifyBinding(result.attemptTerminal, root).value
  assert.equal(attempt.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-gate-terminal-v1")
  assert.equal(attempt.executionState, "completed")
  assert.equal(attempt.status, result.status)
  assert.equal(attempt.runId, runId)
  assert.deepEqual(attempt.gpuQualificationTerminal, result.gpuQualificationTerminal)
  assert.deepEqual(attempt.gpuDiagnosticReport, result.gpuDiagnosticReport)

  const terminal = verifyBinding(result.gpuQualificationTerminal, root).value
  assert.equal(terminal.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-terminal-v1")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.status, "stage4_full_backbone_spatial_affine_readonly_gpu_qualification_passed")
  assert.equal(terminal.runId, runId)
  assert.equal(terminal.ownerAuthorizationRequired, false)
  assert.deepEqual(terminal.gpuDiagnosticReport, result.gpuDiagnosticReport)

  const report = verifyBinding(result.gpuDiagnosticReport, root).value
  assert.equal(report.schemaVersion, "stage4-full-backbone-spatial-affine-readonly-gpu-report-v1")
  assert.equal(report.status, "passed")
  assert.equal(report.runId, runId)
  assert.equal(report.capabilityVersion, CAPABILITY)
  assert.equal(report.conditionChannels, 23)
  assert.equal(report.latentChannels, 12)
  assert.equal(report.firstFormalTrainSampleId, FIRST_TRAIN_SAMPLE_ID)
  assert.equal(report.fixedValidationSampleId, FIXED_VALIDATION_SAMPLE_ID)
  assert.deepEqual(report.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(report.safety?.optimizerCreated, false)
  assert.equal(report.safety?.backwardExecuted, false)
  assert.equal(report.safety?.weightsModified, false)
  assert.equal(report.safety?.checkpointWritten, false)
  assert.equal(report.safety?.smokeStarted, false)
  assert.equal(report.safety?.trainingStarted, false)

  const state = verifyBinding(terminal.modelStateHashes, root).value
  assert.equal(state.denoiserUnchanged, true)
  assert.equal(state.autoencoderUnchanged, true)
  assert.equal(state.allParameterGradFieldsRemainNone, true)
  const gradients = verifyBinding(terminal.gradientEvidence, root).value
  assert.equal(gradients.status, "passed")
  assert.equal(Array.isArray(gradients.samples), true)
  assert.equal(gradients.samples.length, 2)
  const expectedSamples = [
    ["first_formal_train_record", FIRST_TRAIN_SAMPLE_ID],
    ["fixed_validation_sample_194", FIXED_VALIDATION_SAMPLE_ID],
  ]
  for (const [index, sample] of gradients.samples.entries()) {
    assert.equal(sample.role, expectedSamples[index][0])
    assert.equal(sample.sampleId, expectedSamples[index][1])
    assert.equal(sample.conditionGradient?.all23ChannelsFiniteNonzero, true)
    assert.equal(sample.conditionGradient?.perChannelMaximumAbsoluteGradient?.length, 23)
    assert.equal(sample.conditionGradient.perChannelMaximumAbsoluteGradient.every(
      (value) => Number.isFinite(value) && value > 0,
    ), true)
    assert.equal(sample.affineParameterTensorCount, 24)
    assert.equal(sample.affineParameterGradients?.length, 24)
    assert.equal(sample.affineParameterGradients.every(
      (item) => item.finite && item.nonzero && item.gammaFiniteNonzero && item.betaFiniteNonzero,
    ), true)
    assert.equal(sample.allParameterGradFieldsRemainNone, true)
  }
  const telemetry = verifyBinding(terminal.cudaTelemetry, root).value
  assert.equal(telemetry.status, "completed")
  assert.ok(telemetry.peakGpuMemoryBytes > 0)
  return {
    attemptTerminal: result.attemptTerminal,
    qualificationTerminal: result.gpuQualificationTerminal,
    gpuDiagnosticReport: result.gpuDiagnosticReport,
    gradientEvidence: terminal.gradientEvidence,
    modelStateHashes: terminal.modelStateHashes,
    cudaTelemetry: terminal.cudaTelemetry,
  }
}

function prepareArtifacts(journalPath, journal, outcome) {
  const outputRoot = outcome.passed ? runPaths(journal.runId).successRoot : runPaths(journal.runId).failureRoot
  assert.equal(fs.existsSync(outputRoot), false)
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true })
  fs.mkdirSync(outputRoot, { recursive: false })
  const recordedAtUtc = new Date().toISOString()
  const commitMarkerPath = path.join(outputRoot, "transaction-commit-marker.json")
  const outputs = {
    freeze: path.join(outputRoot, "input-and-program-freeze.json"),
    result: path.join(outputRoot, outcome.passed ? "formal-qualification-result.json" : "formal-failure-report.json"),
    nextAction: path.join(outputRoot, "local-next-action.json"),
    planSync: path.join(outputRoot, "plan-sync-record.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
  }
  const receipt = path.join(outputRoot, "plan-commit-receipt.json")
  writeExclusive(outputs.freeze, {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-freeze-v1",
    status: "verified",
    runId: journal.runId,
    sourceCorrectionRunId: journal.sourceCorrectionRunId,
    sourceCorrection: journal.sourceCorrection,
    sourceRegistry: journal.sourceRegistry,
    codeIdentity: journal.codeIdentity,
    retiredFailedRunReusable: false,
    ownerAuthorizationRequired: false,
    automaticRetryAllowed: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.result, outcome.passed ? {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-result-v1",
    executionState: "completed",
    status: "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_qualified",
    runId: journal.runId,
    sourceCorrection: journal.sourceCorrection,
    gateResult: journal.gateResult,
    verifiedEvidence: outcome.evidence,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    checkpointWritten: false,
    smokeStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  } : {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-failure-v1",
    executionState: "failed_closed",
    status: "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_failed_closed",
    runId: journal.runId,
    sourceCorrection: journal.sourceCorrection,
    gateResult: journal.gateResult,
    failedStep: journal.gateResult.failedStep,
    oldFailedRunReplayed: false,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    checkpointWritten: false,
    smokeStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  const nextTask = outcome.passed ? SUCCESS_NEXT_TASK : FAILURE_NEXT_TASK
  writeExclusive(outputs.nextAction, {
    schemaVersion: "ai-painter-local-next-action-v1",
    status: "ready",
    nextAction: nextTask,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticExecutionAllowed: true,
    automaticRetryAllowed: false,
    oldFailedRunReusable: false,
    controlledSmokeAdmissionAllowed: outcome.passed ? false : false,
    recordedAtUtc,
  })

  const planBeforeSha256 = sha(FILES.plan)
  const planText = fs.readFileSync(FILES.plan, "utf8")
  const nextPlan = outcome.passed
    ? updateUniquePlanForSuccess(planText, recordedAtUtc)
    : updateUniquePlanForFailure(planText, recordedAtUtc, journal.gateResult.failedStep)
  const planAfterSha256 = shaText(nextPlan)
  const stagedPlan = path.join(runPaths(journal.runId).transactionRoot, "next-plan.md")
  writeExclusiveText(stagedPlan, nextPlan)
  const receiptRecord = {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-plan-receipt-v1",
    status: "plan_committed",
    runId: journal.runId,
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    expectedPreviousRegistryRevision: 44,
    expectedCommittedRegistryRevision: 45,
    recordedAtUtc,
  }
  const receiptBinding = { path: projectPath(receipt), sha256: shaJson(receiptRecord) }
  writeExclusive(outputs.planSync, {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-plan-sync-v1",
    status: "prepared_for_atomic_projection",
    planPath: projectPath(FILES.plan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    nextLegalAction: nextTask,
    currentFixedProgress: progress(),
    recordedAtUtc,
  })
  writeExclusive(outputs.terminal, {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-terminal-v1",
    executionState: "completed",
    qualificationOutcome: outcome.passed ? "passed" : "failed_closed",
    status: outcome.passed
      ? "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_qualified"
      : "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_failure_recorded_smoke_denied",
    runId: journal.runId,
    sourceCorrectionRunId: journal.sourceCorrectionRunId,
    sourceCorrection: journal.sourceCorrection,
    formalResult: bind(outputs.result),
    inputFreeze: bind(outputs.freeze),
    nextAction: bind(outputs.nextAction),
    planSyncRecord: bind(outputs.planSync),
    planCommitReceipt: receiptBinding,
    outerTransaction: {
      path: projectPath(journalPath),
      requiredState: "complete",
      commitMarker: {
        path: projectPath(commitMarkerPath),
        schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-commit-marker-v1",
      },
    },
    gateAttemptTerminal: journal.gateResult.attemptTerminal,
    gpuQualificationTerminal: outcome.evidence?.qualificationTerminal ?? null,
    gpuDiagnosticReport: outcome.evidence?.gpuDiagnosticReport ?? null,
    currentFixedProgress: progress(),
    nextLegalAction: nextTask,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticRetryAllowed: false,
    oldFailedRunReplayed: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    checkpointWritten: false,
    smokeStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  const evidence = Object.entries(outputs)
    .filter(([role]) => role !== "capsule")
    .map(([kind, file]) => ({ kind, ...bind(file), expectedSha256: sha(file), sha256Verified: true }))
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
      status: outcome.passed ? "post_wddm_readonly_gpu_qualified" : "post_wddm_readonly_gpu_failed_closed",
    },
    latestBlocker: outcome.passed ? {
      code: "controlled_smoke_contract_not_yet_compiled",
      summaryZh: "修正后的全新只读GPU资格已通过；尚未编译或执行受控Smoke。",
    } : {
      code: journal.gateResult.failedStep,
      summaryZh: "修正后的全新只读GPU资格失败关闭；需对本次全新Run执行CPU只读失败分类。",
    },
    nextAllowedAction: {
      code: nextTask,
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: ["reuse_retired_failed_run", "automatic_retry", "start_smoke_before_contract", "start_stage0"],
    taskIdentity: {
      modelId: CAPABILITY,
      runId: journal.runId,
      sourceCorrectionRunId: journal.sourceCorrectionRunId,
    },
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

  const registryAdvance = buildRegistryAdvanceForMock({
    passed: outcome.passed,
    runId: journal.runId,
    capsulePath: projectPath(outputs.capsule),
    terminalPath: projectPath(outputs.terminal),
    previousRegistrySha256: journal.sourceRegistry.sha256,
  })
  const programEvent = {
    id: `stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-${outcome.passed ? "qualified" : "failed"}-${journal.runId}`,
    timestamp: recordedAtUtc,
    action: outcome.passed
      ? "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_qualified"
      : "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_failed_closed",
    runId: journal.runId,
    kind: "readonly_gpu_qualification",
    status: outcome.passed ? "success" : "failed",
    title: outcome.passed
      ? "Stage4 post-WDDM readonly GPU qualification passed"
      : "Stage4 post-WDDM readonly GPU qualification failed closed",
    titleZh: outcome.passed ? "Stage4修正后只读GPU资格通过" : "Stage4修正后只读GPU资格失败关闭",
    detailZh: outcome.passed
      ? "全新Run完成只读CUDA资格并绑定修正终态；旧失败Run未复用。"
      : "全新Run失败证据已收口并转入CPU只读失败分类；未自动重试。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  }
  const nextJournal = {
    ...journal,
    state: "artifacts_ready",
    outputRoot: projectPath(outputRoot),
    artifacts: Object.values(outputs).map(bind),
    registryAdvance,
    plan: {
      path: projectPath(FILES.plan),
      stagedPath: projectPath(stagedPlan),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receiptPath: projectPath(receipt),
      receiptSha256: receiptBinding.sha256,
      receiptRecord,
    },
    programEvent,
    catalogFiles: [...Object.values(outputs).map(projectPath), projectPath(receipt)],
    terminal: bind(outputs.terminal),
    qualificationOutcome: outcome.passed ? "passed" : "failed_closed",
    resultStatus: outcome.passed
      ? "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_qualified"
      : "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_failure_recorded_smoke_denied",
    nextLegalAction: nextTask,
  }
  writeJournal(journalPath, nextJournal)
  return read(journalPath)
}

async function completeProjectionTransaction(journalPath, initialJournal) {
  let journal = initialJournal
  verifyProjectionJournalIdentity(journal, journalPath)
  verifyJournalArtifacts(journal, false)
  if (journal.state === "artifacts_ready") {
    assertCodeIdentityUnchanged(journal.codeIdentity)
    const planCommit = ensurePlanCommitted(journal)
    journal = transition(journalPath, journal, "plan_committed", { planCommit })
  }
  if (journal.state === "plan_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = ensureProgramEventCommitted(journal)
    journal = transition(journalPath, journal, "event_committed", {
      programEvent: eventCommit.event,
      eventCommit: eventCommit.receipt,
    })
  }
  if (journal.state === "event_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = verifyProgramEventCommitted(journal)
    for (const file of journal.catalogFiles) index(inside(file), journal.runId)
    const catalogCommit = verifyIndexedCatalogFiles(journal)
    journal = transition(journalPath, journal, "dependencies_committed", { eventCommit, catalogCommit })
  }
  if (journal.state === "dependencies_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = verifyProgramEventCommitted(journal)
    verifyIndexedCatalogFiles(journal)
    const registryPrepare = await ensureRegistryPrepared({ ...journal, eventCommit })
    journal = transition(journalPath, journal, "registry_prepared", { eventCommit, registryPrepare })
  }
  if (journal.state === "registry_prepared") {
    verifyPlanCommitted(journal)
    verifyProgramEventCommitted(journal)
    verifyIndexedCatalogFiles(journal)
    const registryCommit = await ensureRegistryPublished(journal)
    const commitMarkerPath = read(inside(journal.terminal.path)).outerTransaction.commitMarker.path
    const commitMarkerRecord = buildProjectionCommitMarker(journal, registryCommit)
    journal = transition(journalPath, journal, "registry_committed", {
      registryCommit,
      commitMarkerPath,
      commitMarkerRecord,
    })
  }
  if (journal.state === "registry_committed") {
    await verifyRegistryCommitted(journal)
    verifyPlanCommitted(journal)
    verifyProgramEventCommitted(journal)
    verifyIndexedCatalogFiles(journal)
    verifyJournalArtifacts(journal, true)
    const commitMarker = ensureProjectionCommitMarker(journal)
    journal = transition(journalPath, journal, "complete", {
      commitMarker,
      completedAtUtc: new Date().toISOString(),
    })
  }
  assert.equal(journal.state, "complete")
  verifyProjectionCommitMarker(journal)
  return journal
}

async function ensureRegistryPrepared(journal) {
  const recovered = readMatchingPreparedRegistryClaim(journal)
  if (recovered !== null) return recovered
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, 44)
  assert.equal(current.registrySha256, journal.sourceRegistry.sha256)
  return prepareCurrentExecutionRegistryAdvance({
    ...journal.registryAdvance,
    projectRoot: ROOT,
    dependencyManifest: buildRegistryDependencyManifest(journal),
  })
}

async function ensureRegistryPublished(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  if (
    current.ok === true
    && current.registry.runId === journal.runId
    && current.registry.terminalEvidence.path === journal.registryAdvance.terminalEvidencePath
  ) return registryIdentity(current)
  assert.equal(typeof journal.registryPrepare?.transactionId, "string")
  try {
    const published = await finalizePreparedCurrentExecutionRegistryAdvance({
      projectRoot: ROOT,
      transactionId: journal.registryPrepare.transactionId,
    })
    assert.equal(published.ok, true, published.errorCode)
    return registryIdentity(published)
  } catch (error) {
    const message = String(error?.message ?? error)
    if (!message.includes("registry_writer_claim_not_owned_by_current_process") && !message.includes("registry_writer_claim_process_identity_mismatch")) throw error
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: ROOT,
      transactionId: journal.registryPrepare.transactionId,
    })
    assert.equal(recovered.ok, true, recovered.errorCode)
    return registryIdentity(recovered)
  }
}

async function verifyRegistryCommitted(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, 45)
  assert.equal(current.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(current.registry.transactionId, journal.registryCommit.transactionId)
  assert.equal(current.registry.runId, journal.runId)
  assert.equal(current.registry.taskId, journal.registryAdvance.taskId)
  assert.equal(current.registry.terminalEvidence.path, journal.registryAdvance.terminalEvidencePath)
  assert.equal(current.registry.terminalEvidence.sha256, journal.terminal.sha256)
}

function verifyProjectionJournalIdentity(journal, journalPath) {
  assert.equal(journal.schemaVersion, TRANSACTION_SCHEMA)
  validateRunId(journal.runId)
  assert.equal(journal.transactionId, journal.runId)
  assert.equal(journal.journalPath, projectPath(journalPath))
  assert.equal(path.resolve(journalPath), path.resolve(runPaths(journal.runId).journal))
  assert.deepEqual(journal.sourceCorrection, {
    path: journal.sourceCorrection.path,
    sha256: journal.sourceCorrection.sha256,
    registrySha256: journal.sourceCorrection.registrySha256,
    planSha256: journal.sourceCorrection.planSha256,
  })
  assert.equal(journal.sourceRegistry.registryRevision, 44)
  assert.equal(journal.sourceRegistry.eventSequence, 44)
  assert.equal(journal.sourceRegistry.sha256, journal.sourceCorrection.registrySha256)
  assert.equal(journal.registryAdvance.expectedPreviousRegistryRevision, 44)
  assert.equal(journal.registryAdvance.expectedPreviousRegistrySha256, journal.sourceRegistry.sha256)
  assert.equal(journal.registryAdvance.runId, journal.runId)
  assert.equal(journal.registryAdvance.packageId, journal.runId)
  assert.equal(journal.registryAdvance.terminalEvidencePath, journal.terminal.path)
  assert.equal(journal.plan.path, projectPath(FILES.plan))
  assert.equal(journal.plan.beforeSha256, journal.sourceCorrection.planSha256)

  const expectedOutputRoot = journal.qualificationOutcome === "passed"
    ? runPaths(journal.runId).successRoot
    : runPaths(journal.runId).failureRoot
  assert.equal(journal.outputRoot, projectPath(expectedOutputRoot))
  const artifactPaths = new Set()
  for (const binding of journal.artifacts) {
    verifyBinding(binding, ROOT)
    assertPathInside(binding.path, journal.outputRoot)
    assert.equal(artifactPaths.has(binding.path), false, `duplicate projection artifact: ${binding.path}`)
    artifactPaths.add(binding.path)
  }
  assert.equal(artifactPaths.has(journal.terminal.path), true)
  assert.equal(artifactPaths.has(journal.registryAdvance.taskCapsulePath), true)
  assert.deepEqual([...journal.catalogFiles].sort(), [...artifactPaths, journal.plan.receiptPath].sort())
  assert.equal(journal.programEvent.runId, journal.runId)
  assert.equal(journal.programEvent.evidencePath, journal.terminal.path)
  assert.equal(journal.programEvent.evidenceSha256, journal.terminal.sha256)
  const terminal = read(inside(journal.terminal.path))
  assert.equal(terminal.runId, journal.runId)
  assert.equal(terminal.outerTransaction.path, journal.journalPath)
  assert.equal(terminal.outerTransaction.requiredState, "complete")
  assert.equal(
    terminal.outerTransaction.commitMarker.path,
    projectPath(path.join(expectedOutputRoot, "transaction-commit-marker.json")),
  )
  assert.equal(
    terminal.outerTransaction.commitMarker.schemaVersion,
    "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-commit-marker-v1",
  )
}

function assertPathInside(candidate, parent) {
  const candidatePath = inside(candidate)
  const parentPath = inside(parent)
  const relative = path.relative(parentPath, candidatePath)
  assert.equal(relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)), true)
}

function readMatchingPreparedRegistryClaim(journal) {
  const claimPath = inside(".runtime/ai-painter/current-execution-registry/writer.claim.json")
  if (!fs.existsSync(claimPath)) return null
  const claim = read(claimPath)
  assert.equal(claim.schemaVersion, "ai-painter-current-execution-registry-writer-claim-v1")
  assert.match(claim.transactionId, /^current-execution-registry-advance-[A-Za-z0-9-]+$/u)
  const transactionRoot = `.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}`
  const pending = read(inside(`${transactionRoot}/transaction.pending.json`))
  assert.equal(pending.schemaVersion, "ai-painter-current-execution-registry-transaction-v1")
  assert.equal(pending.status, "pending")
  assert.equal(pending.transactionId, claim.transactionId)
  assert.equal(pending.registryRevision, 45)
  assert.equal(pending.eventSequence, 45)
  assert.equal(pending.previousRegistryRevision, 44)
  assert.equal(pending.previousCurrentSha256, journal.sourceRegistry.sha256)
  for (const binding of [pending.currentStaged, pending.registryEventStaged, pending.dependencyManifest]) {
    assert.equal(sha(inside(binding.path)), binding.sha256)
  }
  assert.equal(pending.currentSha256, pending.currentStaged.sha256)
  const staged = read(inside(pending.currentStaged.path))
  assert.equal(staged.runId, journal.runId)
  assert.equal(staged.packageId, journal.runId)
  assert.equal(staged.taskId, journal.registryAdvance.taskId)
  assert.equal(staged.taskKind, journal.registryAdvance.taskKind)
  assert.equal(staged.registryRevision, 45)
  assert.equal(staged.eventSequence, 45)
  assert.equal(staged.terminalEvidence.path, journal.terminal.path)
  assert.equal(staged.terminalEvidence.sha256, journal.terminal.sha256)
  const manifest = read(inside(pending.dependencyManifest.path))
  assert.equal(manifest.outerJournal.path, journal.journalPath)
  assert.equal(manifest.outerJournal.requiredState, "registry_prepared")
  assert.equal(manifest.programEvent.eventId, journal.programEvent.id)
  return {
    ok: true,
    status: "prepared_not_published",
    transactionId: claim.transactionId,
    registryRevision: pending.registryRevision,
    eventSequence: pending.eventSequence,
    currentSha256: pending.currentSha256,
    previousCurrentSha256: pending.previousCurrentSha256,
    transactionRoot,
    writerClaim: claim,
    recoveredFromDurablePrepare: true,
  }
}

function buildRegistryDependencyManifest(journal) {
  const bindings = [
    { role: "committed_plan", path: journal.plan.path, sha256: journal.plan.afterSha256 },
    { role: "plan_commit_receipt", path: journal.plan.receiptPath, sha256: journal.plan.receiptSha256 },
    ...journal.artifacts.map((binding, index) => ({ role: `qualification_artifact_${index}`, ...binding })),
  ]
  const catalogArtifacts = new Map()
  for (const artifact of journal.catalogCommit.artifacts) catalogArtifacts.set(artifact.logicalPath, artifact)
  for (const artifact of [journal.eventCommit.catalog.ledgerArtifact, journal.eventCommit.catalog.latestArtifact]) {
    catalogArtifacts.set(artifact.path, { logicalPath: artifact.path, sha256: artifact.sha256 })
  }
  return {
    schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
    mode: "external",
    outerJournal: { path: journal.journalPath, requiredState: "registry_prepared" },
    bindings,
    programEvent: {
      eventId: journal.programEvent.id,
      event: journal.programEvent,
      ledgerPath: journal.eventCommit.ledger.path,
      latestPath: journal.eventCommit.latest.path,
      catalogDatabasePath: path.resolve(catalogPath),
    },
    catalogArtifacts: [...catalogArtifacts.values()].map((artifact) => ({
      logicalPath: artifact.logicalPath,
      sha256: artifact.sha256,
    })),
  }
}

function verifyIndexedCatalogFiles(journal) {
  const database = openStorageCatalog()
  const artifacts = []
  for (const sourcePath of journal.catalogFiles) {
    const file = inside(sourcePath)
    const logicalPath = logicalProjectPath(file)
    const stat = fs.statSync(file)
    const digest = sha(file)
    const row = database.prepare("SELECT byte_size, sha256 FROM artifacts WHERE logical_path = ?").get(logicalPath)
    assert.notEqual(row, undefined, `catalog artifact missing: ${logicalPath}`)
    assert.equal(Number(row.byte_size), stat.size)
    assert.equal(row.sha256, digest)
    artifacts.push({ logicalPath, byteSize: stat.size, sha256: digest })
  }
  return {
    status: "verified",
    catalogDatabasePath: path.resolve(catalogPath),
    artifactCount: artifacts.length,
    artifacts,
  }
}

function buildProjectionCommitMarker(journal, registryCommit) {
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-post-wddm-readonly-gpu-commit-marker-v1",
    status: "committed",
    transactionId: journal.transactionId,
    runId: journal.runId,
    journalPath: journal.journalPath,
    qualificationOutcome: journal.qualificationOutcome,
    terminal: journal.terminal,
    plan: { path: journal.plan.path, sha256: journal.plan.afterSha256 },
    programEvent: { id: journal.programEvent.id, evidencePath: journal.programEvent.evidencePath, evidenceSha256: journal.programEvent.evidenceSha256 },
    registry: registryCommit,
    codeIdentity: journal.codeIdentity,
    nextLegalAction: journal.nextLegalAction,
    ownerAuthorizationRequired: false,
    automaticRetryPerformed: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

function ensureProjectionCommitMarker(journal) {
  const markerPath = inside(journal.commitMarkerPath)
  if (!fs.existsSync(markerPath)) writeExclusive(markerPath, journal.commitMarkerRecord)
  assert.equal(sha(markerPath), shaJson(journal.commitMarkerRecord))
  index(markerPath, journal.runId)
  const database = openStorageCatalog()
  const logicalPath = logicalProjectPath(markerPath)
  const stat = fs.statSync(markerPath)
  const row = database.prepare("SELECT byte_size, sha256 FROM artifacts WHERE logical_path = ?").get(logicalPath)
  assert.notEqual(row, undefined)
  assert.equal(Number(row.byte_size), stat.size)
  assert.equal(row.sha256, sha(markerPath))
  return { path: journal.commitMarkerPath, byteSize: stat.size, sha256: sha(markerPath) }
}

function verifyProjectionCommitMarker(journal) {
  assert.equal(journal.state, "complete")
  assert.equal(journal.commitMarker.path, journal.commitMarkerPath)
  assert.equal(sha(inside(journal.commitMarkerPath)), journal.commitMarker.sha256)
  assert.equal(sha(inside(journal.commitMarkerPath)), shaJson(journal.commitMarkerRecord))
  const marker = read(inside(journal.commitMarkerPath))
  assert.deepEqual(marker, journal.commitMarkerRecord)
  assert.equal(marker.registry.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(marker.terminal.sha256, journal.terminal.sha256)
  assert.deepEqual(marker.codeIdentity, journal.codeIdentity)
}

function ensurePlanCommitted(journal) {
  const source = inside(journal.plan.path)
  const staged = inside(journal.plan.stagedPath)
  assert.equal(sha(staged), journal.plan.afterSha256)
  const current = sha(source)
  if (current === journal.plan.beforeSha256) {
    writeAtomic(source, fs.readFileSync(staged, "utf8"))
  } else {
    assert.equal(current, journal.plan.afterSha256, "plan changed outside the transaction")
  }
  const receipt = inside(journal.plan.receiptPath)
  if (!fs.existsSync(receipt)) writeExclusive(receipt, journal.plan.receiptRecord)
  assert.equal(sha(receipt), journal.plan.receiptSha256)
  return { status: "plan_committed", sha256: journal.plan.afterSha256 }
}

function verifyPlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.path)), journal.plan.afterSha256)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

function ensureProgramEventCommitted(journal) {
  const event = ensureAiPainterProgramEventCommitted(journal.programEvent)
  verifyEvent(event, journal.programEvent)
  const receipt = verifyAiPainterProgramEventCommitted(event)
  assert.deepEqual(receipt.event, event)
  return { event, receipt }
}

function verifyProgramEventCommitted(journal) {
  const receipt = verifyAiPainterProgramEventCommitted(journal.programEvent)
  assert.deepEqual(receipt.event, journal.programEvent)
  assert.equal(receipt.catalog.programEventId, journal.programEvent.id)
  return receipt
}

async function recoverIncompleteTransactions(sourceBinding) {
  if (!fs.existsSync(TRANSACTION_PARENT)) return null
  const journals = fs.readdirSync(TRANSACTION_PARENT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(TRANSACTION_PARENT, entry.name, "transaction.json"))
    .filter((file) => fs.existsSync(file))
    .map((file) => ({ file, value: read(file) }))
    .filter(({ value }) => value.schemaVersion === TRANSACTION_SCHEMA && value.state !== "complete")
  assert.ok(journals.length <= 1, "multiple incomplete post-WDDM qualification transactions")
  if (journals.length === 0) return null
  const [{ file, value }] = journals
  assert.deepEqual(value.sourceCorrection, sourceBinding)
  const completed = await executeTransaction(file, value)
  return resultProjection(completed)
}

export function buildRegistryAdvanceForMock({
  passed,
  runId,
  capsulePath,
  terminalPath,
  previousRegistrySha256,
}) {
  validateRunId(runId)
  assert.notEqual(runId, RETIRED_FAILED_RUN_ID)
  assert.match(previousRegistrySha256, /^[0-9a-f]{64}$/u)
  return {
    capabilityVersion: CAPABILITY,
    packageId: runId,
    taskId: passed ? SUCCESS_NEXT_TASK : FAILURE_NEXT_TASK,
    taskKind: passed ? "controlled_smoke_contract_compilation" : "readonly_gpu_failure_classification",
    runId,
    lifecycleStage: passed ? "readonly_gpu_qualified_smoke_contract_pending" : "readonly_gpu_qualification_failed_closed",
    executionState: passed ? "completed" : "failed_closed",
    activity: passed ? "post_wddm_readonly_gpu_qualified" : "post_wddm_readonly_gpu_failure_recorded_smoke_denied",
    taskCapsulePath: capsulePath,
    terminalEvidencePath: terminalPath,
    expectedPreviousRegistryRevision: 44,
    expectedPreviousRegistrySha256: previousRegistrySha256,
  }
}

export function updateUniquePlanForSuccess(source, timestamp) {
  let output = updatePlanHeader(source, timestamp,
    "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射修正后只读GPU资格通过，受控Smoke合同待编译")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；Windows WDDM资源分类修正后使用全新Run完成只读GPU资格，旧失败Run未复用 | 下一步仅编译一个全新、未执行的受控Smoke合同；不得直接启动Smoke或Stage 0 |")
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    "## 5. 当前阻断与后续实施顺序\n\nWindows WDDM资源预检进程分类缺陷已完成CPU修正与证据绑定。修正后的只读GPU资格使用全新Run自然完成，23通道条件梯度、24个空间仿射参数张量梯度、模型状态不变和CUDA遥测均通过；旧失败Run未被复用或重放。\n\n下一步仅允许编译一个全新、未执行的受控Smoke合同。合同编译前不得启动Smoke；不得读取历史或失败Checkpoint、创建优化器、执行`.backward()`、修改权重或启动Stage 0。\n")
  return output
}

export function updateUniquePlanForFailure(source, timestamp, failedStep) {
  let output = updatePlanHeader(source, timestamp,
    "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射修正后只读GPU资格失败关闭，本次失败分类待执行")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    `| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；Windows WDDM资源分类修正后使用全新Run执行只读GPU资格，并在\`${failedStep}\`失败关闭 | 下一步仅分类本次全新Run失败证据；不得自动重试、复用旧Run、编译Smoke或启动Stage 0 |`)
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u,
    `## 5. 当前阻断与后续实施顺序\n\nWindows WDDM资源预检进程分类缺陷已完成CPU修正。修正后的只读GPU资格使用全新Run执行，并在\`${failedStep}\`失败关闭；旧失败Run未被复用或重放，Smoke准入保持关闭。\n\n下一步仅允许本地程序对本次全新Run的不可变失败证据执行CPU只读分类。不得自动重试GPU资格、不得复用任一失败Run、编译或启动Smoke、创建优化器、执行\`.backward()\`、写Checkpoint或启动Stage 0。\n`)
  return output
}

function updatePlanHeader(source, timestamp, status) {
  let output = replaceOnce(source, /^更新时间：.*$/mu,
    `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`)
  output = replaceOnce(output, /^状态：.*$/mu, status)
  return output
}

export function buildRunPathsForMock(runId) {
  const paths = runPaths(runId)
  return Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, projectPath(value)]))
}

function runPaths(runId) {
  validateRunId(runId)
  return {
    transactionRoot: path.join(TRANSACTION_PARENT, runId),
    journal: path.join(TRANSACTION_PARENT, runId, "transaction.json"),
    successRoot: path.join(SUCCESS_PARENT, runId),
    failureRoot: path.join(FAILURE_PARENT, runId),
    gateAttemptRoot: inside(gateAttemptProjectPath(runId)),
    gateOutputRoot: inside(gateOutputProjectPath(runId)),
  }
}

function assertFreshRun(paths, runId, sourceCorrectionRunId) {
  assert.notEqual(runId, RETIRED_FAILED_RUN_ID)
  assert.notEqual(runId, sourceCorrectionRunId)
  for (const file of Object.values(paths)) {
    assert.doesNotMatch(projectPath(file), new RegExp(RETIRED_FAILED_RUN_ID, "u"))
  }
  for (const root of [paths.transactionRoot, paths.successRoot, paths.failureRoot, paths.gateAttemptRoot, paths.gateOutputRoot]) {
    assert.equal(fs.existsSync(root), false, `run namespace reuse forbidden: ${projectPath(root)}`)
  }
}

export function validateRunId(runId) {
  assert.match(runId, /^full-backbone-spatial-affine-readonly-gpu-[0-9]{8}-[0-9]{9}-[0-9a-f]{8}$/u)
  return runId
}

function newRunId() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll("-", "")
  const time = now.toISOString().slice(11, 23).replaceAll(":", "").replace(".", "")
  return validateRunId(`full-backbone-spatial-affine-readonly-gpu-${date}-${time}-${crypto.randomUUID().slice(0, 8)}`)
}

function gateAttemptProjectPath(runId) {
  return `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${validateRunId(runId)}`
}

function gateOutputProjectPath(runId) {
  return `.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/${validateRunId(runId)}`
}

function freezeCodeIdentity() {
  assert.equal(sha(FILES.gate), EXPECTED_GATE_SHA256, "corrected Gate SHA-256 mismatch")
  for (const file of Object.values(FILES)) assert.equal(fs.existsSync(file), true, `${projectPath(file)} missing`)
  return {
    gate: bind(FILES.gate),
    eventStore: bind(FILES.eventStore),
    registryHelper: bind(FILES.registryHelper),
    runner: bind(FILES.runner),
    test: bind(FILES.test),
  }
}

function assertCodeIdentityUnchanged(identity) {
  assert.deepEqual(freezeCodeIdentity(), identity)
}

function verifyBinding(binding, root) {
  assert.equal(isBinding(binding), true)
  const file = resolveInsideRoot(root, binding.path)
  assert.equal(fs.existsSync(file), true, `bound file missing: ${binding.path}`)
  assert.equal(sha(file), binding.sha256, `bound SHA-256 mismatch: ${binding.path}`)
  return { file, value: read(file) }
}

function isBinding(value) {
  return value !== null
    && typeof value === "object"
    && typeof value.path === "string"
    && /^[0-9a-f]{64}$/u.test(value.sha256)
}

function resolveInsideRoot(root, relative) {
  const normalized = normalizeProjectRelative(relative)
  const candidate = path.resolve(root, normalized)
  const resolvedRoot = path.resolve(root)
  assert.ok(candidate.startsWith(`${resolvedRoot}${path.sep}`))
  return candidate
}

function normalizeProjectRelative(value) {
  assert.equal(typeof value, "string")
  assert.equal(path.isAbsolute(value), false)
  assert.doesNotMatch(value, /(^|[\\/])\.\.([\\/]|$)/u)
  return value.replaceAll("\\", "/")
}

function resultProjection(journal) {
  return {
    status: journal.resultStatus ?? "post_wddm_readonly_gpu_gate_in_progress",
    runId: journal.runId,
    transactionState: journal.state,
    terminal: journal.terminal ?? null,
    qualificationOutcome: journal.qualificationOutcome ?? "in_progress",
    currentFixedProgress: progress(),
    nextLegalAction: journal.nextLegalAction ?? CURRENT_TASK,
    sourceCorrection: journal.sourceCorrection,
    sourceCorrectionRunId: journal.sourceCorrectionRunId,
    retiredFailedRunReplayed: false,
    automaticRetryPerformed: false,
    ownerAuthorizationRequired: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }
}

function verifyJournalArtifacts(journal, includeReceipt) {
  for (const binding of journal.artifacts) verifyBinding(binding, ROOT)
  if (includeReceipt) verifyBinding({ path: journal.plan.receiptPath, sha256: journal.plan.receiptSha256 }, ROOT)
}

function registryIdentity(current) {
  return {
    registryRevision: current.registry.registryRevision,
    eventSequence: current.registry.eventSequence,
    registrySha256: current.registrySha256,
    transactionId: current.registry.transactionId,
    terminalEvidence: current.registry.terminalEvidence,
  }
}

function verifyEvent(actual, expected) {
  assert.notEqual(actual, null)
  for (const key of ["id", "timestamp", "action", "runId", "kind", "status", "evidencePath", "evidenceSha256"]) {
    assert.deepEqual(actual[key], expected[key])
  }
}

function transition(journalPath, journal, state, additions = {}) {
  const next = { ...journal, ...additions, state, updatedAtUtc: new Date().toISOString() }
  writeJournal(journalPath, next)
  return read(journalPath)
}

function parseJsonOutput(stdout, label) {
  const trimmed = stdout.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  assert.ok(start >= 0 && end >= start, `${label} did not return JSON`)
  return JSON.parse(trimmed.slice(start, end + 1))
}

function pythonEnvironment() {
  const env = { ...process.env }
  const entries = [
    inside("ml/ai-painter/src"),
    inside("ml/ai-painter/scripts"),
  ]
  if (env.PYTHONPATH) entries.push(env.PYTHONPATH)
  env.PYTHONPATH = entries.join(path.delimiter)
  return env
}

function progress() {
  return { completedStages: 3, totalStages: 5, percent: 60 }
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""))
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function shaText(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex")
}

function shaJson(value) {
  return shaText(`${JSON.stringify(value, null, 2)}\n`)
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function inside(relative) {
  assert.equal(path.isAbsolute(relative), false)
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`))
  return candidate
}

function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function writeExclusiveText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" })
}

function writeAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporary, value, "utf8")
  fs.renameSync(temporary, file)
}

function writeJournal(journalPath, value) {
  fs.mkdirSync(path.dirname(journalPath), { recursive: true })
  writeAtomic(journalPath, `${JSON.stringify(value, null, 2)}\n`)
}

function replaceOnce(source, pattern, replacement) {
  const match = source.match(pattern)
  assert.notEqual(match, null)
  if (match[0] === replacement) return source
  const output = source.replace(pattern, replacement)
  assert.notEqual(output, source)
  return output
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

function index(file, runId) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_full_backbone_spatial_affine_post_wddm_readonly_gpu_qualification_v1",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}

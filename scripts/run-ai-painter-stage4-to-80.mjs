import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  consumeOwnerAuthorization,
} from "../src/server/project-owner-authorization-core.mjs"
import {
  assertStage4ContinuousStepPredecessor,
  materializeStage4ContinuousRuntimeEvidence,
  resolveStage4ContinuousArguments,
  sha256File,
  verifyStage4ContinuousAuthorizationPackage,
  verifyStage4ContinuousCoordinatorAuthorization,
  verifyStage4ContinuousStepAuthorization,
} from "../src/server/project-owner-delegated-authorization-package-core.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
const packagePath = required(args.package, "--package is required")
const packageSha256 = required(args.packageSha256, "--package-sha256 is required").toLowerCase()
const trustRegistrySha256 = required(args.trustRegistrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256, "--trust-registry-sha256 is required").toLowerCase()
const verifiedPackage = verifyStage4ContinuousAuthorizationPackage({
  root: ROOT,
  packagePath,
  packageSha256,
  trustRegistrySha256,
})

if (args.preflightOnly) {
  console.log(JSON.stringify({
    schemaVersion: "ai-painter-stage4-continuous-execution-static-preflight-v1",
    status: "passed_readonly_static_preflight",
    packageId: verifiedPackage.packageId,
    packageSha256: verifiedPackage.packageSha256,
    candidateIdentity: verifiedPackage.candidateIdentity,
    coordinatorAuthorizationConsumed: false,
    stepAuthorizationsConsumed: false,
    gpuStarted: false,
    trainingStarted: false,
    steps: verifiedPackage.steps.map((step) => ({
      role: step.role,
      runId: step.runId,
      runner: step.runner,
      outputNamespace: step.outputNamespace,
    })),
    recordedAtUtc: new Date().toISOString(),
  }, null, 2))
  process.exit(0)
}

const executionRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-continuous-executions/${verifiedPackage.packageId}`)
if (fs.existsSync(executionRoot)) fail("continuous_execution_run_already_exists")

const coordinator = verifyStage4ContinuousCoordinatorAuthorization({
  root: ROOT,
  coordinator: verifiedPackage.coordinator,
  trustRegistrySha256,
})
const coordinatorConsumptionPath = consumeOwnerAuthorization(coordinator, { root: ROOT })
fs.mkdirSync(executionRoot, { recursive: true })

let activeChild = null
let previousTerminal = null
let previousStep = null
let qualificationStep = null
let qualificationTerminal = null
const completedSteps = []
const startedAtUtc = new Date().toISOString()
const statePath = path.join(executionRoot, "execution-state.json")

installSignalHandlers()
recordEvent("stage4_continuous_execution_started", "running", "Stage4持续执行开始", `package=${verifiedPackage.packageId}`)
writeState("running", null)

try {
  for (const step of verifiedPackage.steps) {
    assertStage4ContinuousStepPredecessor(step, previousTerminal)
    const materialized = materializeStage4ContinuousRuntimeEvidence({
      root: ROOT,
      executionRoot,
      step,
      previousStep,
      previousTerminal,
      qualificationStep,
      qualificationTerminal,
    })
    const bindings = materialized.bindings
    const preflightArgs = resolveStage4ContinuousArguments(step.preflightArgs, bindings)
    const executeArgs = resolveStage4ContinuousArguments(step.executeArgs, bindings)
    recordEvent("stage4_continuous_step_preflight_started", "running", `${step.role}只读预检开始`, step.runner.path, step.role)
    const preflight = step.preflightMode === "embedded_cpu_readonly"
      ? writeEmbeddedPreflight(step, materialized)
      : await runNode(step, preflightArgs, { phase: "preflight", monitor: false })
    const preflightPath = path.join(executionRoot, "preflights", `${step.role}.json`)
    writeAndIndex(preflightPath, {
      schemaVersion: "ai-painter-stage4-continuous-step-preflight-v1",
      status: preflight.exitCode === 0 ? "passed_readonly_preflight" : "failed_readonly_preflight_closed",
      packageId: verifiedPackage.packageId,
      role: step.role,
      runId: step.runId,
      exitCode: preflight.exitCode,
      signal: preflight.signal,
      stdoutPath: preflight.stdoutPath,
      stdoutSha256: preflight.stdoutSha256,
      stderrPath: preflight.stderrPath,
      stderrSha256: preflight.stderrSha256,
      runtimeEvidence: materialized.runtimeEvidence,
      runnerAuthorization: materialized.runnerAuthorization,
      stepAuthorizationConsumed: false,
      recordedAtUtc: new Date().toISOString(),
    }, verifiedPackage.packageId)
    if (preflight.exitCode !== 0) throw stepError(step, `preflight_exit_${preflight.exitCode}`)

    const verifiedStepAuthorization = verifyStage4ContinuousStepAuthorization({
      root: ROOT,
      step,
      trustRegistrySha256,
    })
    const consumptionPath = consumeOwnerAuthorization(verifiedStepAuthorization, { root: ROOT })
    recordEvent("stage4_continuous_step_authorization_consumed", "success", `${step.role}独立授权已消费`, consumptionPath, step.role)
    writeState("running", step.role, { activeStepConsumptionPath: consumptionPath })

    const execution = await runNode(step, executeArgs, { phase: "execution", monitor: true })
    const terminalAbsolute = path.resolve(ROOT, step.terminal.path)
    const terminalExists = fs.existsSync(terminalAbsolute)
    const terminal = terminalExists ? readJson(terminalAbsolute) : null
    const terminalSha256 = terminalExists ? sha256File(terminalAbsolute) : null
    if (!terminal || terminal.status !== step.terminal.requiredStatus) throw stepError(step, "required_success_terminal_missing_or_invalid")
    const boundedQualificationTransition = execution.exitCode !== 0
      && step.boundTerminalMayProceedOnlyToCpuQualification === true
      && verifiedPackage.steps[step.index + 1]?.role === "late_stability_qualification"
    if (execution.exitCode !== 0 && !boundedQualificationTransition) throw stepError(step, `execution_exit_${execution.exitCode}`)
    const terminalRecord = {
      role: step.role,
      status: terminal.status,
      path: step.terminal.path,
      sha256: terminalSha256,
      checkpoint: terminal.checkpoint ?? null,
    }
    completedSteps.push({
      role: step.role,
      runId: step.runId,
      authorizationConsumptionPath: consumptionPath,
      terminal: terminalRecord,
      stdoutPath: execution.stdoutPath,
      stdoutSha256: execution.stdoutSha256,
      stderrPath: execution.stderrPath,
      stderrSha256: execution.stderrSha256,
      runtimeEvidence: materialized.runtimeEvidence,
      runnerAuthorization: materialized.runnerAuthorization,
      boundedQualificationTransition,
      completedAtUtc: new Date().toISOString(),
    })
    previousTerminal = terminalRecord
    previousStep = step
    if (step.role === "late_stability_qualification") {
      qualificationStep = step
      qualificationTerminal = terminalRecord
    }
    recordEvent("stage4_continuous_step_completed", "success", `${step.role}正式成功`, terminalRecord.path, step.role)
    writeState("running", null)
  }

  const terminalPath = finalize("stage4_continuous_execution_completed_at_4_of_5_closed", [], 80)
  recordEvent("stage4_continuous_execution_completed", "success", "Stage4持续执行完成并达到4/5（80%）", terminalPath)
  console.log(JSON.stringify({ status: "stage4_continuous_execution_completed_at_4_of_5_closed", terminalPath, terminalSha256: sha256File(path.resolve(ROOT, terminalPath)) }, null, 2))
} catch (error) {
  const blocker = String(error?.message ?? error)
  const terminalPath = finalize("stage4_continuous_execution_failed_closed", [blocker], 60)
  recordEvent("stage4_continuous_execution_failed", "failed", "Stage4持续执行失败关闭", blocker, error?.role ?? null, terminalPath)
  console.error(JSON.stringify({ status: "stage4_continuous_execution_failed_closed", blocker, terminalPath, terminalSha256: sha256File(path.resolve(ROOT, terminalPath)) }, null, 2))
  process.exitCode = 1
}

function writeEmbeddedPreflight(step, materialized) {
  const logRoot = path.join(executionRoot, "process-logs", step.role)
  fs.mkdirSync(logRoot, { recursive: true })
  const stdoutAbsolute = path.join(logRoot, "preflight.stdout.log")
  const stderrAbsolute = path.join(logRoot, "preflight.stderr.log")
  const record = {
    status: "passed_embedded_cpu_readonly_preflight",
    role: step.role,
    runtimeEvidence: materialized.runtimeEvidence,
    runnerAuthorization: materialized.runnerAuthorization,
    checkpointRead: false,
    gpuStarted: false,
    trainingStarted: false,
  }
  fs.writeFileSync(stdoutAbsolute, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "wx" })
  fs.writeFileSync(stderrAbsolute, "", { encoding: "utf8", flag: "wx" })
  return {
    exitCode: 0,
    signal: null,
    stdoutPath: projectPath(stdoutAbsolute),
    stdoutSha256: sha256File(stdoutAbsolute),
    stderrPath: projectPath(stderrAbsolute),
    stderrSha256: sha256File(stderrAbsolute),
  }
}

function runNode(step, childArgs, { phase, monitor }) {
  return new Promise((resolve) => {
    const logRoot = path.join(executionRoot, "process-logs", step.role)
    fs.mkdirSync(logRoot, { recursive: true })
    const stdoutAbsolute = path.join(logRoot, `${phase}.stdout.log`)
    const stderrAbsolute = path.join(logRoot, `${phase}.stderr.log`)
    const stdoutStream = fs.createWriteStream(stdoutAbsolute, { flags: "wx" })
    const stderrStream = fs.createWriteStream(stderrAbsolute, { flags: "wx" })
    activeChild = spawn(process.execPath, [path.resolve(ROOT, step.runner.path), ...childArgs], {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    activeChild.stdout.on("data", (chunk) => {
      stdoutStream.write(chunk)
      process.stdout.write(chunk)
    })
    activeChild.stderr.on("data", (chunk) => {
      stderrStream.write(chunk)
      process.stderr.write(chunk)
    })
    const timer = monitor ? setInterval(() => {
      const progress = readJsonSafe(path.resolve(ROOT, step.progressPath))
      console.log(JSON.stringify({
        kind: "stage4_continuous_progress",
        packageId: verifiedPackage.packageId,
        role: step.role,
        runId: step.runId,
        progress: progress?.liveProgress ?? progress ?? null,
        recordedAtUtc: new Date().toISOString(),
        recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      }))
    }, 20_000) : null
    activeChild.on("close", (exitCode, signal) => {
      if (timer) clearInterval(timer)
      activeChild = null
      stdoutStream.end(() => {
        stderrStream.end(() => resolve({
          exitCode,
          signal,
          stdoutPath: projectPath(stdoutAbsolute),
          stdoutSha256: sha256File(stdoutAbsolute),
          stderrPath: projectPath(stderrAbsolute),
          stderrSha256: sha256File(stderrAbsolute),
        }))
      })
    })
  })
}

function finalize(status, blockers, progressPercent) {
  const finalizationRoot = path.join(executionRoot, "finalization")
  const terminalPath = path.join(finalizationRoot, "phase-terminal.json")
  const terminal = {
    schemaVersion: "ai-painter-stage4-continuous-execution-terminal-v1",
    status,
    packageId: verifiedPackage.packageId,
    package: { path: verifiedPackage.packagePath, sha256: verifiedPackage.packageSha256 },
    coordinatorConsumptionPath,
    fixedTotalProgress: { completedStages: progressPercent === 80 ? 4 : 3, totalStages: 5, percent: progressPercent },
    completedSteps,
    blockers,
    automaticRetry: false,
    stage5Started: false,
    formalInferenceStarted: false,
    checkpointPromoted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
    startedAtUtc,
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
  }
  writeAndIndex(terminalPath, terminal, verifiedPackage.packageId)
  const capsulePath = path.join(finalizationRoot, "local-task-capsule.json")
  writeAndIndex(capsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    module: "AI Painter Stage4",
    currentStage: status.includes("completed") ? "Stage4 completed" : "Stage4 stopped on a real blocker",
    fixedTotalProgress: terminal.fixedTotalProgress,
    candidateTerminal: { path: projectPath(terminalPath), sha256: sha256File(terminalPath) },
    latestBlocker: blockers[0] ?? null,
    completedStepRoles: completedSteps.map((step) => step.role),
    nextLegalAction: status.includes("completed") ? "owner_may_separately_authorize_stage5" : "owner_business_decision_or_new_bounded_contract_required",
    recordedAtUtc: terminal.recordedAtUtc,
  }, verifiedPackage.packageId)
  writeState(status, null)
  return projectPath(terminalPath)
}

function writeState(status, activeRole, extra = {}) {
  writeAndIndex(statePath, {
    schemaVersion: "ai-painter-stage4-continuous-execution-state-v1",
    status,
    packageId: verifiedPackage.packageId,
    packagePath: verifiedPackage.packagePath,
    packageSha256: verifiedPackage.packageSha256,
    coordinatorConsumptionPath,
    activeRole,
    completedSteps,
    automaticRetry: false,
    ...extra,
    updatedAtUtc: new Date().toISOString(),
  }, verifiedPackage.packageId)
}

function writeAndIndex(value, record, runId) {
  writeJsonAtomic(value, record)
  const info = fs.statSync(value)
  indexArtifact({
    logicalPath: projectPath(value),
    physicalUri: fs.realpathSync(value),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(value),
  })
}

function recordEvent(kind, status, titleZh, detailZh, role = null, evidencePath = null) {
  const stage4Completed = completedSteps.some((step) => step.role === "stage2")
  appendAiPainterProgramEvent({
    action: "stage4_continuous_execution_to_80",
    runId: verifiedPackage.packageId,
    kind,
    status,
    title: titleZh,
    titleZh,
    detail: detailZh,
    detailZh,
    script: "scripts/run-ai-painter-stage4-to-80.mjs",
    currentStep: role ?? "stage4_continuous_execution",
    evidencePath,
    fixedTotalProgress: { completedStages: stage4Completed ? 4 : 3, totalStages: 5, percent: stage4Completed ? 80 : 60 },
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function installSignalHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (activeChild && !activeChild.killed) activeChild.kill(signal)
    })
  }
}

function stepError(step, message) {
  const error = new Error(`${step.role}:${message}`)
  error.role = step.role
  return error
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === "--preflight-only") result.preflightOnly = true
    else if (value.startsWith("--")) {
      const key = value.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())
      result[key] = values[index + 1]
      index += 1
    } else fail(`unexpected_argument:${value}`)
  }
  return result
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}

function readJsonSafe(value) {
  try { return readJson(value) } catch { return null }
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
}

function required(value, message) {
  if (typeof value !== "string" || !value.trim()) fail(message)
  return value.trim()
}

function fail(message) {
  throw new Error(message)
}

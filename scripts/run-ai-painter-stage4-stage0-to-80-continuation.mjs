import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { consumeOwnerAuthorization } from "../src/server/project-owner-authorization-core.mjs"
import { materializeStage4ContinuationStep, resolveStage4ContinuationArgs, sha256File, verifyStage4ContinuationCoordinator, verifyStage4ContinuationPackage, verifyStage4ContinuationStep } from "../src/server/project-owner-stage4-continuation-package-core.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
const packagePath = required(args.package, "--package is required")
const packageSha256 = required(args.packageSha256, "--package-sha256 is required").toLowerCase()
const trustRegistrySha256 = required(args.trustRegistrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256, "--trust-registry-sha256 is required").toLowerCase()
const verifiedPackage = verifyStage4ContinuationPackage({ root: ROOT, packagePath, packageSha256, trustRegistrySha256 })

if (args.preflightOnly) {
  console.log(JSON.stringify({ schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-static-preflight-v1", status: "passed_readonly_static_preflight", packageId: verifiedPackage.packageId, packageSha256, candidateIdentity: verifiedPackage.candidateIdentity, qualificationTerminal: verifiedPackage.qualificationTerminal, stepRoles: verifiedPackage.steps.map((step) => step.role), coordinatorAuthorizationConsumed: false, stepAuthorizationsConsumed: false, smokeRerunStarted: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: new Date().toISOString() }, null, 2))
  process.exit(0)
}

const executionRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${verifiedPackage.packageId}`)
if (fs.existsSync(executionRoot)) fail("continuation_execution_output_exists")
const coordinator = verifyStage4ContinuationCoordinator({ root: ROOT, packageValue: verifiedPackage, trustRegistrySha256 })
const coordinatorConsumptionPath = consumeOwnerAuthorization(coordinator, { root: ROOT })
fs.mkdirSync(executionRoot, { recursive: true })
const statePath = path.join(executionRoot, "execution-state.json")
const completedSteps = []
const startedAtUtc = new Date().toISOString()
let previousTerminal = null
let activeChild = null
installSignalHandlers()
recordEvent("stage4_continuation_started", "running", "Stage4 Stage 0至Stage 2持续执行开始", `package=${verifiedPackage.packageId}`)
writeState("running", null)

try {
  for (const step of verifiedPackage.steps) {
    const materialized = materializeStage4ContinuationStep({ root: ROOT, executionRoot, packageValue: verifiedPackage, step, previousTerminal })
    const preflightArgs = resolveStage4ContinuationArgs(step.preflightArgs, materialized.bindings)
    const executeArgs = resolveStage4ContinuationArgs(step.executeArgs, materialized.bindings)
    recordEvent("stage4_continuation_step_preflight_started", "running", `${step.role}只读预检开始`, step.runner.path, step.role)
    const preflight = await runNode(step, preflightArgs, { phase: "preflight", monitor: false })
    const preflightPath = path.join(executionRoot, "preflights", `${step.role}.json`)
    writeAndIndex(preflightPath, { schemaVersion: "ai-painter-stage4-continuation-step-preflight-v1", status: preflight.exitCode === 0 ? "passed_readonly_preflight" : "failed_readonly_preflight_closed", packageId: verifiedPackage.packageId, role: step.role, runId: step.runId, exitCode: preflight.exitCode, signal: preflight.signal, stdoutPath: preflight.stdoutPath, stdoutSha256: preflight.stdoutSha256, stderrPath: preflight.stderrPath, stderrSha256: preflight.stderrSha256, runtimeEvidence: materialized.runtimeEvidence, runnerAuthorization: materialized.runnerAuthorization, stepAuthorizationConsumed: false, recordedAtUtc: new Date().toISOString() })
    if (preflight.exitCode !== 0) throw stepError(step, `preflight_exit_${preflight.exitCode}`)
    const verifiedStep = verifyStage4ContinuationStep({ root: ROOT, step, trustRegistrySha256 })
    const consumptionPath = consumeOwnerAuthorization(verifiedStep, { root: ROOT })
    recordEvent("stage4_continuation_step_authorization_consumed", "success", `${step.role}独立授权已消费`, consumptionPath, step.role)
    writeState("running", step.role, { activeStepConsumptionPath: consumptionPath })
    const execution = await runNode(step, executeArgs, { phase: "execution", monitor: true })
    const terminalPath = path.resolve(ROOT, step.terminal.path)
    const terminal = fs.existsSync(terminalPath) ? readJson(terminalPath) : null
    if (execution.exitCode !== 0) throw stepError(step, `execution_exit_${execution.exitCode}`)
    if (!terminal || terminal.status !== step.terminal.requiredStatus || terminal.stage !== step.stage) throw stepError(step, "required_success_terminal_missing_or_invalid")
    if (terminal.machineReview?.passCount !== 6 || terminal.machineReview?.failCount !== 0) throw stepError(step, "machine_review_not_six_of_six")
    if (!terminal.checkpoint?.path || !terminal.checkpoint?.sha256 || !fileBindingValid(terminal.checkpoint)) throw stepError(step, "checkpoint_identity_invalid")
    const terminalRecord = { role: step.role, stage: step.stage, status: terminal.status, path: step.terminal.path, sha256: sha256File(terminalPath), checkpoint: terminal.checkpoint, machineReview: terminal.machineReview }
    completedSteps.push({ role: step.role, runId: step.runId, authorizationConsumptionPath: consumptionPath, terminal: terminalRecord, stdoutPath: execution.stdoutPath, stdoutSha256: execution.stdoutSha256, stderrPath: execution.stderrPath, stderrSha256: execution.stderrSha256, runtimeEvidence: materialized.runtimeEvidence, runnerAuthorization: materialized.runnerAuthorization, completedAtUtc: new Date().toISOString() })
    previousTerminal = terminalRecord
    recordEvent("stage4_continuation_step_completed", "success", `${step.role}正式训练与机器审核通过`, terminalRecord.path, step.role)
    writeState("running", null)
  }
  const planUpdate = updateUniquePlanTo80()
  const terminalPath = finalize("stage4_stage0_to_80_continuation_completed_at_4_of_5_closed", [], 80, planUpdate)
  recordEvent("stage4_continuation_completed", "success", "Stage4完成并达到4/5（80%）", terminalPath)
  console.log(JSON.stringify({ status: "stage4_stage0_to_80_continuation_completed_at_4_of_5_closed", terminalPath, terminalSha256: sha256File(path.resolve(ROOT, terminalPath)), uniquePlan: planUpdate }, null, 2))
} catch (error) {
  const blocker = String(error?.message ?? error)
  const terminalPath = finalize("stage4_stage0_to_80_continuation_failed_closed", [blocker], 60, null)
  recordEvent("stage4_continuation_failed", "failed", "Stage4 Stage 0至Stage 2持续执行失败关闭", blocker, error?.role ?? null, terminalPath)
  console.error(JSON.stringify({ status: "stage4_stage0_to_80_continuation_failed_closed", blocker, terminalPath, terminalSha256: sha256File(path.resolve(ROOT, terminalPath)) }, null, 2))
  process.exitCode = 1
}

function runNode(step, childArgs, { phase, monitor }) {
  return new Promise((resolve) => {
    const logRoot = path.join(executionRoot, "process-logs", step.role)
    fs.mkdirSync(logRoot, { recursive: true })
    const stdoutAbsolute = path.join(logRoot, `${phase}.stdout.log`)
    const stderrAbsolute = path.join(logRoot, `${phase}.stderr.log`)
    const stdoutStream = fs.createWriteStream(stdoutAbsolute, { flags: "wx" })
    const stderrStream = fs.createWriteStream(stderrAbsolute, { flags: "wx" })
    activeChild = spawn(process.execPath, [path.resolve(ROOT, step.runner.path), ...childArgs], { cwd: ROOT, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    activeChild.stdout.on("data", (chunk) => { stdoutStream.write(chunk); process.stdout.write(chunk) })
    activeChild.stderr.on("data", (chunk) => { stderrStream.write(chunk); process.stderr.write(chunk) })
    const timer = monitor ? setInterval(() => {
      const progress = readJsonSafe(path.resolve(ROOT, step.progressPath))
      console.log(JSON.stringify({ kind: "stage4_continuation_progress", packageId: verifiedPackage.packageId, role: step.role, runId: step.runId, progress: progress?.liveProgress ?? progress ?? null, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()) }))
    }, 20_000) : null
    activeChild.on("close", (exitCode, signal) => {
      if (timer) clearInterval(timer)
      activeChild = null
      stdoutStream.end(() => stderrStream.end(() => resolve({ exitCode, signal, stdoutPath: project(stdoutAbsolute), stdoutSha256: sha256File(stdoutAbsolute), stderrPath: project(stderrAbsolute), stderrSha256: sha256File(stderrAbsolute) })))
    })
  })
}

function updateUniquePlanTo80() {
  const file = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const beforeSha256 = sha256File(file)
  let text = fs.readFileSync(file, "utf8")
  const original = text
  text = text.replace(/^状态：active-module-plan \/ AI Painter固定进度3\/5（60%）；.*$/mu, "状态：active-module-plan / AI Painter固定进度4/5（80%）；Stage4 Stage 0/1/2完整训练、复现及机器审核已完成；Stage5严格独立复验尚未开始")
  text = text.replace("固定进度3/5（60%）；Stage4进行中", "固定进度4/5（80%）；Stage4已完成")
  text = text.replace(/4\. Stage 0→1→2完整训练：([^\r\n]*?)；进行中，固定进度仍为60%。/u, "4. Stage 0→1→2完整训练：$1；已完成。")
  text = text.replace(/### 3\.2 当前尚未完成的业务门[\s\S]*?## 4\. 当前边界/u, `### 3.2 当前尚未完成的业务门

1. Stage4已完成，固定总进度为4/5（80%）；
2. Stage5独立严格复验尚未开始，必须另行授权；
3. 正式推理、Checkpoint晋级、Owner正式画面验收、RuntimeFrame和进入/world仍未授权。

### 3.3 下一条执行路线

\`\`\`text
Owner另行授权Stage5严格独立复验
-> 使用未参与训练和Checkpoint选择的challenge轨迹执行多种子复验
-> 通过后才可更新为5/5（100%）
\`\`\`

## 4. 当前边界`)
  if (text === original || !text.includes("固定进度4/5（80%）") || text.includes("固定进度3/5（60%）；Stage4进行中")) throw new Error("unique_plan_update_contract_not_matched")
  writeTextAtomic(file, text)
  return { path: project(file), beforeSha256, sha256: sha256File(file) }
}

function finalize(status, blockers, percent, planUpdate) {
  const root = path.join(executionRoot, "finalization")
  const terminalPath = path.join(root, "phase-terminal.json")
  const terminal = { schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-terminal-v1", status, packageId: verifiedPackage.packageId, package: { path: verifiedPackage.packagePath, sha256: verifiedPackage.packageSha256 }, coordinatorConsumptionPath, fixedTotalProgress: { completedStages: percent === 80 ? 4 : 3, totalStages: 5, percent }, completedSteps, uniquePlan: planUpdate, blockers, automaticRetry: false, smokeRerunStarted: false, stage5Started: false, formalInferenceStarted: false, checkpointPromoted: false, runtimeFrameStarted: false, worldEntered: false, startedAtUtc, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()) }
  writeAndIndex(terminalPath, terminal)
  const capsulePath = path.join(root, "local-task-capsule.json")
  writeAndIndex(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: percent === 80 ? "Stage4 completed at 4/5" : "Stage4 continuation stopped on real blocker", fixedTotalProgress: terminal.fixedTotalProgress, candidateTerminal: { path: project(terminalPath), sha256: sha256File(terminalPath) }, latestBlocker: blockers[0] ?? null, completedStepRoles: completedSteps.map((step) => step.role), nextLegalAction: percent === 80 ? "owner_may_separately_authorize_stage5" : "owner_business_decision_or_new_bounded_contract_required", recordedAtUtc: terminal.recordedAtUtc })
  writeState(status, null)
  return project(terminalPath)
}

function writeState(status, activeRole, extra = {}) { writeAndIndex(statePath, { schemaVersion: "ai-painter-stage4-stage0-to-80-continuation-state-v1", status, packageId: verifiedPackage.packageId, packagePath: verifiedPackage.packagePath, packageSha256: verifiedPackage.packageSha256, coordinatorConsumptionPath, activeRole, completedSteps, automaticRetry: false, ...extra, updatedAtUtc: new Date().toISOString() }) }
function writeAndIndex(file, body) { writeJsonAtomic(file, body); const stat = fs.statSync(file); indexArtifact({ logicalPath: project(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: verifiedPackage.packageId, artifactType: "stage4_stage0_to_80_continuation", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }) }
function recordEvent(kind, status, titleZh, detailZh, role = null, evidencePath = null) { const done = completedSteps.some((step) => step.role === "stage2"); appendAiPainterProgramEvent({ action: "stage4_stage0_to_80_continuation", runId: verifiedPackage.packageId, kind, status, title: titleZh, titleZh, detail: detailZh, detailZh, script: "scripts/run-ai-painter-stage4-stage0-to-80-continuation.mjs", currentStep: role ?? "stage4_continuation", evidencePath, fixedTotalProgress: { completedStages: done ? 4 : 3, totalStages: 5, percent: done ? 80 : 60 }, finalGameMapSuccess: false, canEnterWorld: false }) }
function writeTextAtomic(file, text) { const temp = `${file}.${process.pid}.tmp`; const handle = fs.openSync(temp, "wx"); try { fs.writeFileSync(handle, text, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }; fs.renameSync(temp, file) }
function fileBindingValid(value) { return typeof value?.path === "string" && typeof value?.sha256 === "string" && fs.existsSync(path.resolve(ROOT, value.path)) && sha256File(path.resolve(ROOT, value.path)) === value.sha256 }
function installSignalHandlers() { for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { if (activeChild && !activeChild.killed) activeChild.kill(signal) }) }
function stepError(step, message) { const error = new Error(`${step.role}:${message}`); error.role = step.role; return error }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function readJsonSafe(value) { try { return readJson(value) } catch { return null } }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function required(value, message) { if (typeof value !== "string" || !value.trim()) fail(message); return value.trim() }
function fail(message) { throw new Error(message) }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (value === "--preflight-only") result.preflightOnly = true; else if (value.startsWith("--") && values[index + 1]) { result[value.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = values[index + 1]; index += 1 } else fail(`unexpected_argument:${value}`) } return result }

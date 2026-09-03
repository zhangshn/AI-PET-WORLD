import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

const PLAN_SCHEMA = "ai-painter-stage4-v2-formal-stage0-to-stage2-plan-v1"
const TERMINAL_SCHEMA = "ai-painter-stage4-v2-formal-stage0-to-stage2-execution-terminal-v1"
const EXECUTION_SCHEMA = "ai-painter-stage4-v2-formal-stage0-to-stage2-execution-state-v1"
const ACTION = "run:ai-painter-stage4-v2-formal-stage0-to-stage2"
const STAGES = Object.freeze([
  Object.freeze({ stage: 0, width: 256, height: 192 }),
  Object.freeze({ stage: 1, width: 512, height: 384 }),
  Object.freeze({ stage: 2, width: 1024, height: 768 }),
])

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  executeStage4V2FormalStage0ToStage2({
    projectRoot: process.cwd(),
    planPath: parseArg("--plan"),
    planSha256: parseArg("--plan-sha256"),
    stageInputs: readStageInputs(),
  }).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status === "blocked" || result.status === "failed_closed") process.exitCode = 2
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}

/**
 * Execute the materialized Stage 0 -> Stage 1 -> Stage 2 plan in order.
 * Missing GPU/authorization/runtime inputs produce a persisted BLOCKED
 * terminal; the executor never fabricates a successful training result.
 */
export async function executeStage4V2FormalStage0ToStage2({
  projectRoot = process.cwd(),
  planPath,
  planSha256,
  stageInputs = [],
  commandRunner = runNodeStage,
  now = () => new Date(),
} = {}) {
  const root = path.resolve(projectRoot)
  const resolvedPlan = resolveProjectFile(root, planPath)
  const plan = readJson(resolvedPlan)
  assert.equal(sha256File(resolvedPlan), planSha256, "formal execution plan SHA-256 mismatch")
  validatePlan(plan)
  const executionRoot = path.join(root, ".runtime", "ai-painter", "stage4-v2-formal-executions", plan.runId)
  const statePath = path.join(executionRoot, "execution-state.json")
  const terminalPath = path.join(executionRoot, "phase-terminal.json")
  if (fs.existsSync(statePath) || fs.existsSync(terminalPath)) {
    throw new Error("formal stage execution identity already exists")
  }
  fs.mkdirSync(executionRoot, { recursive: true })

  const startedAtUtc = now().toISOString()
  const base = {
    schemaVersion: EXECUTION_SCHEMA,
    status: "running",
    action: ACTION,
    capabilityVersion: plan.capabilityVersion,
    packageId: plan.packageId,
    runId: plan.runId,
    currentStage: null,
    completedStages: [],
    gpuStarted: false,
    trainingStarted: false,
    startedAtUtc,
  }
  writeJsonAtomic(statePath, base)

  const normalizedInputs = normalizeStageInputs(stageInputs)
  const inputError = validateStageInputs(normalizedInputs, plan, root)
  if (inputError) {
    const terminal = closeTerminal({
      executionRoot,
      root,
      statePath,
      terminalPath,
      base,
      status: "blocked",
      blocker: inputError,
      completedStages: [],
      gpuStarted: false,
      trainingStarted: false,
      now,
    })
    return terminal
  }

  const completedStages = []
  let gpuStarted = false
  let trainingStarted = false
  let parent = null
  try {
    for (const stage of STAGES) {
      const input = normalizedInputs[stage.stage]
      writeJsonAtomic(statePath, {
        ...base,
        status: "running",
        currentStage: stage.stage,
        completedStages,
        gpuStarted,
        trainingStarted,
      })
      const result = await commandRunner({
        root,
        stage,
        input,
        parent,
      })
      if (!result || result.exitCode !== 0 || result.terminal?.status !== "semantic_mixture_stage4_formal_stage_completed_closed") {
        throw new Error(`stage_${stage.stage}_failed_closed`)
      }
      // A child exit code is not proof that CUDA or training ran. Only the
      // stage terminal's independently recorded evidence may set these flags.
      gpuStarted = gpuStarted || result.terminal?.gpuStarted === true
      trainingStarted = trainingStarted || result.terminal?.trainingStarted === true
      completedStages.push({ stage: stage.stage, terminal: result.terminal })
      parent = result.terminal
    }
    return closeTerminal({
      executionRoot, statePath, terminalPath, base,
      root,
      status: "completed", blocker: null, completedStages,
      gpuStarted, trainingStarted, now,
    })
  } catch (error) {
    return closeTerminal({
      executionRoot, statePath, terminalPath, base,
      root,
      status: "failed_closed",
      blocker: error instanceof Error ? error.message : String(error),
      completedStages, gpuStarted, trainingStarted, now,
    })
  }
}

function validatePlan(plan) {
  assert.equal(plan.schemaVersion, PLAN_SCHEMA, "formal execution plan schema mismatch")
  assert.equal(plan.status, "materialized_not_executed", "formal execution plan is not executable")
  assert.equal(plan.ownerAuthorizationRequired, false, "formal execution plan reintroduced Owner approval")
  assert.deepEqual(plan.orderedStages, [
    { stage: 0, width: 256, height: 192, epochCount: 40 },
    { stage: 1, width: 512, height: 384, epochCount: 40 },
    { stage: 2, width: 1024, height: 768, epochCount: 40 },
  ], "formal stage order or resolution contract changed")
  assert.equal(typeof plan.packageId, "string")
  assert.equal(typeof plan.runId, "string")
}

function normalizeStageInputs(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map((item) => [item.stage, item]))
  if (value && typeof value === "object") return value
  return {}
}

function validateStageInputs(inputs, plan, root) {
  const runIds = new Set()
  for (const stage of STAGES) {
    const input = inputs[stage.stage] ?? inputs[String(stage.stage)]
    if (!input || typeof input.authorizationPath !== "string" || !/^[a-f0-9]{64}$/u.test(input.authorizationSha256 ?? "")) {
      return `stage_${stage.stage}_authorization_input_missing`
    }
    if (input.stage !== stage.stage || input.packageId !== plan.packageId || typeof input.runId !== "string" || input.runId.length === 0 || runIds.has(input.runId)) {
      return `stage_${stage.stage}_authorization_identity_mismatch`
    }
    runIds.add(input.runId)
    const authorizationPathError = validateBoundFile(root, input.authorizationPath, input.authorizationSha256)
    if (authorizationPathError) return `stage_${stage.stage}_authorization_${authorizationPathError}`
    if (stage.stage > 0 && (!input.parentCheckpointPath || !input.parentCheckpointSha256 || !input.parentTerminalPath || !input.parentTerminalSha256)) {
      return `stage_${stage.stage}_parent_terminal_input_missing`
    }
    if (stage.stage > 0) {
      const checkpointError = validateBoundFile(root, input.parentCheckpointPath, input.parentCheckpointSha256)
      if (checkpointError) return `stage_${stage.stage}_parent_checkpoint_${checkpointError}`
      const terminalError = validateBoundFile(root, input.parentTerminalPath, input.parentTerminalSha256)
      if (terminalError) return `stage_${stage.stage}_parent_terminal_${terminalError}`
    }
  }
  return null
}

function validateBoundFile(root, filePath, expectedSha256) {
  try {
    const resolved = resolveProjectFile(root, filePath)
    return sha256File(resolved) === expectedSha256 ? null : "hash_mismatch"
  } catch {
    return "path_invalid"
  }
}

async function runNodeStage({ root, stage, input, parent }) {
  const runner = path.resolve(root, input.runnerPath ?? "scripts/run-stage4-semantic-mixture-formal-stage.mjs")
  const args = [runner, "--stage", String(stage.stage), "--authorization", resolveProjectFile(root, input.authorizationPath), "--authorization-sha256", input.authorizationSha256, "--runId", input.runId]
  if (stage.stage > 0) args.push("--parent-checkpoint", resolveProjectFile(root, input.parentCheckpointPath), "--parent-checkpoint-sha256", input.parentCheckpointSha256, "--parent-terminal", resolveProjectFile(root, input.parentTerminalPath), "--parent-terminal-sha256", input.parentTerminalSha256)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, shell: false })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", reject)
    child.on("close", (exitCode) => {
      const terminalPath = path.join(root, ".runtime", "ai-painter", "stage4-semantic-mixture-formal-training", input.runId, "finalization", "phase-terminal.json")
      resolve({ exitCode, stdout, stderr, terminal: fs.existsSync(terminalPath) ? readJson(terminalPath) : null })
    })
  })
}

function closeTerminal({ executionRoot, root, statePath, terminalPath, base, status, blocker, completedStages, gpuStarted, trainingStarted, now }) {
  const terminal = {
    schemaVersion: TERMINAL_SCHEMA,
    status,
    action: ACTION,
    capabilityVersion: base.capabilityVersion,
    packageId: base.packageId,
    runId: base.runId,
    blocker,
    completedStages,
    gpuStarted,
    trainingStarted,
    executionState: "closed",
    recordedAtUtc: now().toISOString(),
  }
  writeJsonAtomic(statePath, { ...base, status, currentStage: null, completedStages, gpuStarted, trainingStarted, finishedAtUtc: terminal.recordedAtUtc })
  writeJsonAtomic(terminalPath, terminal)
  return { ...terminal, executionStatePath: projectPath(statePath, root), terminalPath: projectPath(terminalPath, root), terminalSha256: sha256File(terminalPath) }
}

function resolveProjectFile(root, value) {
  assert.equal(typeof value, "string", "project file path is missing")
  const resolved = path.resolve(root, value)
  const relative = path.relative(root, resolved)
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "project path escapes repository")
  assert.equal(fs.existsSync(resolved), true, `project file is missing: ${value}`)
  assert.equal(fs.statSync(resolved).isFile(), true, `project path is not a file: ${value}`)
  return resolved
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }
function writeJsonAtomic(filePath, value) {
  const temp = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  const fd = fs.openSync(temp, "r+")
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, filePath)
}
function projectPath(filePath, root) { return path.relative(root, filePath).replaceAll("\\", "/") }
function parseArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
function readStageInputs() {
  const value = parseArg("--stage-inputs")
  return value ? JSON.parse(fs.readFileSync(value, "utf8")) : []
}

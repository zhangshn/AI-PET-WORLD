import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

import { launchProjectCommandBackground } from "./lib/ai-painter-autonomous-background-launcher-v1.mjs"

const ROOT = path.resolve(process.cwd())
const RECEIPT_ROOT = ".runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smoke-background-launches"
const REGISTRY_PATH = ".runtime/ai-painter/current-execution-registry/current.json"
const RUNNER_PATH = "scripts/run-ai-painter-stage4-full-backbone-spatial-affine-controlled-smoke.mjs"
const CPU_CHECKER_PATH = "ml/ai-painter/scripts/check_stage4_full_backbone_spatial_affine_controlled_smoke_cpu.py"
const PYTHON_PATH = "ml/ai-painter/.venv/Scripts/python.exe"
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

export function launchFullBackboneSpatialAffineControlledSmokeBackground() {
  assert(process.platform === "win32", "controlled Smoke background launch requires Windows WMI")
  const registryPath = existingFile(REGISTRY_PATH)
  const registrySha256 = sha256(registryPath)
  const registry = readJson(registryPath)
  assert(registry.schemaVersion === "ai-painter-current-execution-registry-v1", "current registry schema changed")
  assert(Number.isInteger(registry.registryRevision) && registry.registryRevision >= 46, "current registry revision invalid")
  assert(registry.eventSequence === registry.registryRevision, "current registry event sequence changed")
  assert(registry.capabilityVersion === "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1", "current registry capability changed")
  assert(registry.taskId === "implement_and_execute_stage4_full_backbone_spatial_affine_controlled_smoke", "current registry task changed")
  assert(registry.taskKind === "controlled_smoke_implementation_and_execution", "current registry task kind changed")
  assert(registry.lifecycleStage === "controlled_smoke_contract_compiled_training_path_pending", "current registry lifecycle changed")
  assert(registry.executionState === "completed" && registry.activity === "controlled_smoke_contract_compiled_not_started", "current registry execution state changed")
  assert(registry.activeExecution === null, "another AI Painter execution is active")

  const terminalPath = existingFile(registry.terminalEvidence.path)
  assert(sha256(terminalPath) === registry.terminalEvidence.sha256, "compiled contract terminal SHA-256 changed")
  const terminal = readJson(terminalPath)
  assert(terminal.executionState === "completed", "compiled contract terminal is incomplete")
  assert(terminal.status === "stage4_full_backbone_spatial_affine_controlled_smoke_contract_compiled", "compiled contract terminal status changed")
  const reservedRunId = terminal.reservedSmokeRunId
  assert(/^stage4-full-backbone-spatial-affine-controlled-smoke-[0-9]{8}-[0-9]{9}-[0-9a-f]{8}$/u.test(reservedRunId), "reserved controlled Smoke run changed")
  assert(terminal.ownerAuthorizationRequired === false && terminal.ownerResponseRequired === false, "compiled contract cannot require Owner")
  assert(terminal.gpuStarted === false && terminal.optimizerCreated === false && terminal.backwardExecuted === false && terminal.trainingStarted === false, "compiled contract terminal contains training side effects")

  const contractPath = existingFile(terminal.contract.path)
  assert(sha256(contractPath) === terminal.contract.sha256, "compiled controlled Smoke contract SHA-256 changed")
  const contract = readJson(contractPath)
  assert(contract.schemaVersion === "stage4-full-backbone-spatial-affine-controlled-smoke-contract-v1", "compiled controlled Smoke schema changed")
  assert(contract.status === "compiled_not_started" && contract.authority === "local_ai_pet_world_program", "compiled controlled Smoke authority changed")
  assert(contract.executionIdentity?.runId === reservedRunId, "compiled controlled Smoke run identity changed")
  const reservedOutput = `.runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes/${reservedRunId}`
  assert(contract.futureEvidenceNamespace?.outputDirectory === reservedOutput, "compiled controlled Smoke output identity changed")
  assert(contract.internalCapability?.ownerAuthorizationRequired === false && contract.internalCapability?.ownerResponseRequired === false, "compiled controlled Smoke cannot wait for Owner")
  assert(contract.internalCapability?.issueOnlyAfterAllPreflightChecksPass === true, "compiled controlled Smoke preflight order changed")

  const reservedOutputPath = inside(reservedOutput)
  assert(!fs.existsSync(reservedOutputPath), "reserved controlled Smoke output already exists")
  const suffix = reservedRunId.slice("stage4-full-backbone-spatial-affine-controlled-smoke-".length)
  const launchIdentity = `full-backbone-spatial-affine-smoke-${suffix}`
  const receiptPath = inside(`${RECEIPT_ROOT}/${launchIdentity}`)
  assert(!fs.existsSync(receiptPath), "controlled Smoke background launch identity already exists")

  const runner = existingFile(RUNNER_PATH)
  runChecked(process.execPath, ["--check", runner], "controlled Smoke runner Node syntax check")
  const cpu = runJson(existingFile(PYTHON_PATH), [existingFile(CPU_CHECKER_PATH)], "controlled Smoke CPU checker")
  assert(cpu.status === "stage4_full_backbone_spatial_affine_controlled_smoke_cpu_gate_passed", "controlled Smoke CPU checker did not pass")
  assert(cpu.cpuOnly === true && cpu.gpuStarted === false && cpu.trainingStarted === false, "controlled Smoke CPU checker crossed execution boundary")
  assert(cpu.ownerAuthorizationRequired === false, "controlled Smoke CPU checker cannot require Owner")

  const receipt = launchProjectCommandBackground({
    root: ROOT,
    launchIdentity,
    receiptRoot: RECEIPT_ROOT,
    runnerPath: RUNNER_PATH,
    runnerArgs: ["--background"],
  })
  assert(receipt.launchMethod === "windows_wmi_win32_process_create", "controlled Smoke was not launched through WMI")
  return {
    ...receipt,
    registry: { path: REGISTRY_PATH, sha256: registrySha256, registryRevision: registry.registryRevision, eventSequence: registry.eventSequence },
    compiledContract: { path: terminal.contract.path, sha256: terminal.contract.sha256 },
    reservedRunId,
    reservedOutput,
    cpuStatus: cpu.status,
    ownerAuthorizationRequired: false,
  }
}

if (isMain) {
  const result = launchFullBackboneSpatialAffineControlledSmokeBackground()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

function runChecked(executable, args, label) {
  const result = spawnSync(executable, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
  })
  assert(result.error == null && result.status === 0, `${label} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`)
}

function runJson(executable, args, label) {
  const result = spawnSync(executable, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
  })
  assert(result.error == null && result.status === 0, `${label} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`)
  try { return JSON.parse(result.stdout) } catch { throw new Error(`${label} returned invalid JSON`) }
}

function pythonEnvironment() {
  const additions = [
    path.join(ROOT, "ml/ai-painter/scripts"),
    path.join(ROOT, "ml/ai-painter/src"),
  ]
  return {
    ...process.env,
    PYTHONPATH: [...additions, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  }
}

function existingFile(relativePath) {
  const file = inside(relativePath)
  assert(fs.existsSync(file) && fs.statSync(file).isFile(), `file is missing: ${relativePath}`)
  return file
}

function inside(relativePath) {
  assert(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath), "path must be project-relative")
  const absolute = path.resolve(ROOT, relativePath)
  assert(absolute.startsWith(`${ROOT}${path.sep}`), "path escapes project root")
  return absolute
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }

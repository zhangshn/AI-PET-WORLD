import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { evaluateV7TrainingGpuResourceGate } from "./lib/ai-assisted-v7-training-resource-gate.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-v8-stage4-file-backed-resource-gate-and-smoke-20260809"
const SCOPE = "one_file_backed_cuda_resource_and_disk_preflight_then_one_v8_30_epoch_gpu_smoke_only"

function main(argv = process.argv.slice(2)) {
  const authorizationPath = argument(argv, "--authorization")
  if (!authorizationPath) throw new Error("resource_preflight_authorization_argument_required")
  const authorization = validateAuthorization(authorizationPath)
  const outputRoot = resolve(authorization.outputPaths.resourcePreflightRoot)
  if (fs.existsSync(outputRoot)) throw new Error("resource_preflight_output_root_already_exists")
  fs.mkdirSync(outputRoot, { recursive: true })

  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = [...evaluateV7TrainingGpuResourceGate(hardware.gpu)]
  if (!disk.passed) blockers.push("disk_budget_insufficient")

  const reportPath = path.join(outputRoot, "resource-disk-report.json")
  const terminalPath = path.join(outputRoot, "phase-terminal.json")
  const checkerPath = projectPath(import.meta.filename)
  const report = {
    schemaVersion: "ai-painter-r5-stage4-v8-file-backed-resource-disk-preflight-v1",
    status: blockers.length === 0
      ? "cuda_resource_and_disk_preflight_passed_gpu_not_authorized"
      : "cuda_resource_or_disk_preflight_failed_closed",
    recordedAtUtc: new Date().toISOString(),
    authorization: binding(authorizationPath),
    consumption: binding(authorization.consumptionPaths.resourcePreflight),
    successfulPythonPreflight: binding(authorization.bindings.successfulPythonPreflightReport.path),
    cpuTerminal: binding(authorization.bindings.cpuTerminal.path),
    checker: binding(checkerPath),
    hardware,
    disk,
    blockers: [...new Set(blockers)],
    inlineJavascriptUsed: false,
    checkpointReadOrLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    trainingStarted: false,
    automaticRetryStarted: false,
  }
  writeImmutableJson(reportPath, report)
  const terminal = {
    schemaVersion: "ai-painter-r5-stage4-v8-resource-disk-preflight-terminal-v1",
    status: blockers.length === 0
      ? "v8_stage4_resource_disk_preflight_passed_closed_gpu_not_authorized"
      : "v8_stage4_resource_disk_preflight_failed_closed",
    recordedAtUtc: new Date().toISOString(),
    reportPath: projectPath(reportPath),
    reportSha256: sha256File(reportPath),
    blockers: report.blockers,
    gpuAuthorizationCreated: false,
    gpuExecutionConsumed: false,
    checkpointReadOrLoaded: false,
    optimizerCreated: false,
    trainingStarted: false,
    automaticRetryStarted: false,
  }
  writeImmutableJson(terminalPath, terminal)
  console.log(JSON.stringify({
    ...terminal,
    terminalPath: projectPath(terminalPath),
    terminalSha256: sha256File(terminalPath),
  }, null, 2))
  return blockers.length === 0 ? 0 : 1
}

function validateAuthorization(authorizationPath) {
  const authorization = readJsonRequired(authorizationPath)
  if (authorization.requestId !== REQUEST_ID || authorization.status !== "resolved_owner_authorized") {
    throw new Error("resource_preflight_authorization_identity_invalid")
  }
  if (authorization.ownerDecision?.commandRef !== REQUEST_ID || authorization.ownerDecision?.scope !== SCOPE) {
    throw new Error("resource_preflight_command_scope_invalid")
  }
  const actions = authorization.authorizedActions ?? {}
  for (const key of ["fileBackedReadonlyResourceGateImplementation", "oneCudaResourceAndDiskPreflight", "resourcePreflightEvidenceWrite"]) {
    if (actions[key] !== true) throw new Error(`resource_preflight_authorized_action_closed:${key}`)
  }
  for (const key of ["inlineJavascriptPreflight", "oldDenoiserCheckpointReadOrLoad", "stage4FullTraining", "stage1OrStage2", "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame", "worldEntry", "automaticRetry"]) {
    if (actions[key] !== false) throw new Error(`resource_preflight_forbidden_action_open:${key}`)
  }
  for (const [key, value] of Object.entries(authorization.bindings ?? {})) {
    if (!value?.path || !value?.sha256 || !fileHashMatches(value.path, value.sha256)) {
      throw new Error(`resource_preflight_binding_missing_or_changed:${key}`)
    }
  }
  const previousTerminal = readJsonRequired(authorization.bindings.previousPreflightFailureTerminal.path)
  const rootCause = readJsonRequired(authorization.bindings.previousPreflightRootCauseReport.path)
  const python = readJsonRequired(authorization.bindings.successfulPythonPreflightReport.path)
  const cpuTerminal = readJsonRequired(authorization.bindings.cpuTerminal.path)
  if (previousTerminal.status !== "v8_stage4_smoke_resource_disk_preflight_launcher_failed_closed") {
    throw new Error("previous_resource_preflight_failure_terminal_invalid")
  }
  if (rootCause.status !== "resource_disk_preflight_launcher_failed_closed" || rootCause.cudaResourceInspectionExecuted !== false || rootCause.diskBudgetInspectionExecuted !== false) {
    throw new Error("previous_resource_preflight_root_cause_invalid")
  }
  if (python.status !== "python_preflight_passed_cuda_disk_pending" || python.python?.exitCode !== 0) {
    throw new Error("successful_python_preflight_binding_invalid")
  }
  if (cpuTerminal.status !== "v8_stage4_training_loss_smoke_cpu_passed_closed") {
    throw new Error("successful_cpu_terminal_binding_invalid")
  }
  const consumption = readJsonRequired(authorization.consumptionPaths.resourcePreflight)
  if (consumption.status !== "resource_preflight_authorization_atomically_consumed") {
    throw new Error("resource_preflight_authorization_not_consumed")
  }
  if (consumption.authorizationSha256 !== sha256File(authorizationPath)) {
    throw new Error("resource_preflight_consumption_authorization_hash_changed")
  }
  return authorization
}

function hardwareSnapshot() {
  const gpu = spawnSync("nvidia-smi", [
    "--query-gpu=index,name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu",
    "--format=csv,noheader,nounits",
  ], { encoding: "utf8", windowsHide: true })
  const processes = spawnSync("nvidia-smi", [
    "--query-compute-apps=pid,process_name",
    "--format=csv,noheader,nounits",
  ], { encoding: "utf8", windowsHide: true })
  const rows = processes.status === 0 ? processes.stdout.split(/\r?\n/).filter(Boolean) : []
  const values = gpu.status === 0 ? gpu.stdout.trim().split(",").map((value) => value.trim()) : []
  return {
    recordedAtUtc: new Date().toISOString(),
    cpu: { model: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length },
    memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() },
    gpu: {
      available: gpu.status === 0,
      deviceIndex: Number(values[0] ?? -1),
      name: values[1] ?? null,
      driverVersion: values[2] ?? null,
      memoryTotalMiB: Number(values[3] ?? 0),
      memoryUsedMiB: Number(values[4] ?? 0),
      utilizationPercent: Number(values[5] ?? 0),
      temperatureC: Number(values[6] ?? 0),
      pythonComputeProcessCount: rows.filter((row) => /python/i.test(row)).length,
      computeProcesses: rows,
    },
  }
}

function diskBudgetSnapshot() {
  const requiredFreeBytes = 4 * 1024 ** 3
  const stat = fs.statfsSync(ROOT)
  const freeBytes = Number(stat.bavail) * Number(stat.bsize)
  return { requiredFreeBytes, freeBytes, passed: freeBytes >= requiredFreeBytes }
}

function argument(argv, name) {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : null
}

function resolve(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value)
}

function projectPath(value) {
  return path.relative(ROOT, resolve(value)).replaceAll("\\", "/")
}

function readJsonRequired(value) {
  const absolute = resolve(value)
  if (!fs.existsSync(absolute)) throw new Error(`json_missing:${projectPath(value)}`)
  return JSON.parse(fs.readFileSync(absolute, "utf8"))
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex")
}

function fileHashMatches(value, expected) {
  return fs.existsSync(resolve(value)) && sha256File(value) === expected
}

function binding(value) {
  return { path: projectPath(value), sha256: sha256File(value) }
}

function writeImmutableJson(value, body) {
  const absolute = resolve(value)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error?.stack ?? String(error))
  process.exitCode = 1
}

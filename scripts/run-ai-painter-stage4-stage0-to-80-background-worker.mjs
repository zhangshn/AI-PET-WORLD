import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
installBootstrapFailureRecorder()
const SCRIPT_PATH = fileURLToPath(import.meta.url)
const JOB_PREFIX = ".runtime/ai-painter/stage4-background-continuation-jobs/"
const args = parseArgs(process.argv.slice(2))
const jobPath = normalizeProjectPath(required(args.job, "--job is required"))
const jobSha256 = requiredSha(args.jobSha256, "--job-sha256 is required")
if (!jobPath.startsWith(JOB_PREFIX) || !jobPath.endsWith("/job.json")) fail("background_job_path_invalid")
const jobAbsolute = path.resolve(ROOT, jobPath)
if (sha256File(jobAbsolute) !== jobSha256) fail("background_job_sha256_mismatch")
const job = readJson(jobAbsolute)
if (job.schemaVersion !== "ai-painter-stage4-background-continuation-job-v1" || job.status !== "ready_to_start") fail("background_job_identity_invalid")
if (job.worker?.path !== project(SCRIPT_PATH) || job.worker?.sha256 !== sha256File(SCRIPT_PATH)) fail("background_worker_identity_mismatch")
const runnerAbsolute = path.resolve(ROOT, normalizeProjectPath(job.runner.path))
if (job.runner.sha256 !== sha256File(runnerAbsolute)) fail("background_continuation_runner_identity_mismatch")
const jobRoot = path.dirname(jobAbsolute)
const statePath = path.join(jobRoot, "worker-state.json")
const heartbeatPath = path.join(jobRoot, "heartbeat.json")
const terminalPath = path.join(jobRoot, "phase-terminal.json")
const stdoutPath = path.join(jobRoot, "coordinator.stdout.log")
const stderrPath = path.join(jobRoot, "coordinator.stderr.log")
for (const target of [statePath, heartbeatPath, terminalPath, stdoutPath, stderrPath]) if (fs.existsSync(target)) fail(`background_worker_output_exists:${project(target)}`)

const stdoutFd = fs.openSync(stdoutPath, "wx")
const stderrFd = fs.openSync(stderrPath, "wx")
const startedAtUtc = new Date().toISOString()
const child = spawn(process.execPath, [runnerAbsolute, ...job.runnerArgs], {
  cwd: ROOT,
  env: process.env,
  windowsHide: true,
  stdio: ["ignore", stdoutFd, stderrFd],
})
fs.closeSync(stdoutFd)
fs.closeSync(stderrFd)
writeJsonAtomic(statePath, state("running", { coordinatorPid: child.pid, exitCode: null, signal: null }))
appendAiPainterProgramEvent({
  action: "stage4_background_continuation",
  runId: job.packageId,
  kind: "background_worker_started",
  status: "running",
  title: "Stage4 background continuation started",
  titleZh: "Stage4独立后台持续执行已启动",
  detailZh: `Windows任务计划程序已托管连续执行；coordinatorPid=${child.pid}`,
  evidencePath: project(statePath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
writeHeartbeat()
const timer = setInterval(writeHeartbeat, 10_000)

child.on("error", (error) => finish(null, null, error))
child.on("close", (exitCode, signal) => finish(exitCode, signal, null))

let finished = false
function finish(exitCode, signal, error) {
  if (finished) return
  finished = true
  clearInterval(timer)
  const success = exitCode === 0 && !error
  const recordedAtUtc = new Date().toISOString()
  const terminal = {
    schemaVersion: "ai-painter-stage4-background-continuation-terminal-v1",
    status: success ? "stage4_background_continuation_process_completed_closed" : "stage4_background_continuation_process_failed_closed",
    packageId: job.packageId,
    taskName: job.taskName,
    coordinatorPid: child.pid,
    exitCode,
    signal,
    error: error ? String(error.message ?? error) : null,
    coordinatorTerminal: readCoordinatorTerminalBinding(),
    stdout: bind(stdoutPath),
    stderr: bind(stderrPath),
    startedAtUtc,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  }
  writeJsonAtomic(terminalPath, terminal)
  writeJsonAtomic(statePath, state(terminal.status, { coordinatorPid: child.pid, exitCode, signal, terminal: bind(terminalPath) }))
  appendAiPainterProgramEvent({
    action: "stage4_background_continuation",
    runId: job.packageId,
    kind: "background_worker_completed",
    status: success ? "success" : "failed",
    title: terminal.status,
    titleZh: success ? "Stage4独立后台持续执行自然退出" : "Stage4独立后台持续执行失败关闭",
    detailZh: error ? String(error.message ?? error) : `exitCode=${exitCode}; signal=${signal ?? "none"}`,
    evidencePath: project(terminalPath),
    evidenceSha256: sha256File(terminalPath),
    fixedTotalProgress: { completedStages: terminal.coordinatorTerminal?.status?.includes("completed_at_4_of_5") ? 4 : 3, totalStages: 5, percent: terminal.coordinatorTerminal?.status?.includes("completed_at_4_of_5") ? 80 : 60 },
  })
}

function writeHeartbeat() {
  const now = new Date().toISOString()
  const coordinatorState = readJsonSafe(path.resolve(ROOT, job.executionStatePath))
  const activeRole = coordinatorState?.activeRole ?? null
  const progressPath = activeRole ? job.progressPaths?.[activeRole] : null
  const progress = progressPath ? readJsonSafe(path.resolve(ROOT, progressPath)) : null
  writeJsonAtomic(heartbeatPath, {
    schemaVersion: "ai-painter-stage4-background-continuation-heartbeat-v1",
    status: "running",
    packageId: job.packageId,
    taskName: job.taskName,
    workerPid: process.pid,
    coordinatorPid: child.pid,
    activeRole,
    coordinatorState: coordinatorState?.status ?? "starting",
    liveProgress: progress?.liveProgress ?? progress ?? null,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
}

function readCoordinatorTerminalBinding() {
  const target = path.resolve(ROOT, job.coordinatorTerminalPath)
  if (!fs.existsSync(target)) return null
  const value = readJsonSafe(target)
  return { ...bind(target), status: value?.status ?? null }
}
function state(status, extra) { const now = new Date().toISOString(); return { schemaVersion: "ai-painter-stage4-background-continuation-worker-state-v1", status, packageId: job.packageId, taskName: job.taskName, workerPid: process.pid, job: { path: jobPath, sha256: jobSha256 }, startedAtUtc, updatedAtUtc: now, updatedAtAsiaShanghai: formatShanghai(now), ...extra } }
function bind(value) { return { path: project(value), sha256: sha256File(value) } }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function readJsonSafe(value) { try { return readJson(value) } catch { return null } }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function normalizeProjectPath(value) { const result = String(value).replaceAll("\\", "/"); if (path.isAbsolute(result) || result.startsWith("../") || result.includes("/../")) fail("project_path_invalid"); return result }
function required(value, message) { if (typeof value !== "string" || !value.trim()) fail(message); return value.trim() }
function requiredSha(value, message) { const result = required(value, message).toLowerCase(); if (!/^[a-f0-9]{64}$/u.test(result)) fail(message); return result }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) { const key = values[index]; const value = values[index + 1]; if (!key?.startsWith("--") || !value) fail("unexpected_argument"); result[key.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = value } return result }
function fail(message) { throw new Error(message) }

function installBootstrapFailureRecorder() {
  process.on("uncaughtException", (error) => {
    try {
      const index = process.argv.indexOf("--job")
      const raw = index >= 0 ? process.argv[index + 1] : null
      if (raw) {
        const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(ROOT, raw)
        if (absolute.startsWith(`${ROOT}${path.sep}`)) {
          const target = path.join(path.dirname(absolute), "worker-bootstrap-failure.json")
          if (!fs.existsSync(target)) fs.writeFileSync(target, `${JSON.stringify({ schemaVersion: "ai-painter-stage4-background-worker-bootstrap-failure-v1", status: "background_worker_bootstrap_failed_closed", message: String(error?.message ?? error), stack: String(error?.stack ?? ""), cwd: ROOT, processId: process.pid, recordedAtUtc: new Date().toISOString() }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
        }
      }
    } finally {
      process.exit(1)
    }
  })
}

import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SCRIPT_PATH = fileURLToPath(import.meta.url)
const LOCK_PATH = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/.formal-stage.lock"
const QUARANTINE_PREFIX = ".runtime/ai-painter/stage4-stale-formal-lock-quarantines/"

export function repairStaleFormalStageLock({ root = ROOT, packageId, lockPath, lockSha256, interruptionTerminalPath, interruptionTerminalSha256, quarantineRoot, fixtureMode = false }) {
  const projectRoot = path.resolve(root)
  assert.equal(lockPath === LOCK_PATH || (fixtureMode && lockPath.startsWith(".runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/")), true, "formal_lock_path_invalid")
  assert.match(lockSha256, /^[a-f0-9]{64}$/u, "formal_lock_sha256_invalid")
  assert.match(packageId, /^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/u, "package_id_invalid")
  const expectedQuarantine = fixtureMode
    ? `${path.posix.dirname(lockPath)}/quarantine-parent/${packageId}`
    : `${QUARANTINE_PREFIX}${packageId}`
  assert.equal(quarantineRoot, expectedQuarantine, "quarantine_identity_invalid")
  const lockAbsolute = resolveProject(projectRoot, lockPath)
  const terminalAbsolute = resolveProject(projectRoot, interruptionTerminalPath)
  const quarantineAbsolute = resolveProject(projectRoot, quarantineRoot)
  assert.equal(fs.existsSync(lockAbsolute), true, "formal_lock_missing")
  assert.equal(sha(lockAbsolute), lockSha256, "formal_lock_hash_mismatch")
  assert.equal(fs.existsSync(terminalAbsolute), true, "interruption_terminal_missing")
  assert.equal(sha(terminalAbsolute), interruptionTerminalSha256, "interruption_terminal_hash_mismatch")
  assert.equal(fs.existsSync(quarantineAbsolute), false, "quarantine_output_exists")
  const lock = read(lockAbsolute)
  const terminal = read(terminalAbsolute)
  assert.equal(terminal.status, "host_session_closed_training_interrupted_closed", "interruption_terminal_status_invalid")
  assert.equal(terminal.formalTrainingFailure, false, "interruption_misclassified_as_training_failure")
  assert.equal(terminal.oldRunIdReusable, false, "interrupted_run_reuse_forbidden")
  const progressAbsolute = resolveProject(projectRoot, terminal.oldProgress.path)
  const progress = read(progressAbsolute)
  assert.equal(sha(progressAbsolute), terminal.oldProgress.sha256, "interrupted_progress_hash_mismatch")
  const pathRunId = progressRunIdFromPath(terminal.oldProgress.path, fixtureMode)
  const embeddedRunIds = [progress.runId, progress.taskIdentity?.runId, progress.liveProgress?.runId].filter((value) => value !== undefined && value !== null)
  for (const value of embeddedRunIds) assert.equal(typeof value === "string" && value.length > 0, true, "interrupted_progress_embedded_run_id_invalid")
  for (const value of embeddedRunIds) assert.equal(value, pathRunId, "interrupted_progress_embedded_and_path_run_id_mismatch")
  assert.equal(pathRunId, lock.runId, "lock_run_id_not_bound_to_interruption")
  assert.equal(Number.isInteger(lock.pid) && lock.pid > 0, true, "lock_pid_invalid")
  assert.equal(isPidAlive(lock.pid), false, "formal_lock_owner_process_still_alive")
  fs.mkdirSync(path.dirname(quarantineAbsolute), { recursive: true })
  fs.mkdirSync(quarantineAbsolute, { recursive: false })
  const quarantinedLockPath = path.join(quarantineAbsolute, "stale-formal-stage.lock.json")
  fs.renameSync(lockAbsolute, quarantinedLockPath)
  const now = new Date().toISOString()
  const terminalPath = path.join(quarantineAbsolute, "phase-terminal.json")
  writeJsonAtomic(terminalPath, {
    schemaVersion: "ai-painter-stage4-stale-formal-lock-repair-terminal-v1",
    status: "stale_formal_stage_lock_quarantined_closed",
    packageId,
    staleLock: { originalPath: lockPath, quarantinedPath: project(projectRoot, quarantinedLockPath), sha256: sha(quarantinedLockPath), pid: lock.pid, runId: lock.runId, stage: lock.stage },
    interruptionTerminal: { path: interruptionTerminalPath, sha256: interruptionTerminalSha256 },
    oldProcessAlive: false,
    lockDeleted: false,
    lockOverwritten: false,
    automaticRetry: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  appendAiPainterProgramEvent({ id: `stage4-stale-formal-lock-${packageId}`, timestamp: now, action: "stage4_stale_formal_lock_quarantine", runId: packageId, kind: "host_interruption_lock_recovery", status: "success", title: "Stale formal Stage4 lock quarantined", titleZh: "Stage4宿主中断遗留锁已隔离", detailZh: `旧锁runId=${lock.runId}, pid=${lock.pid}；PID不存在且宿主中断证据匹配，锁已原子移入不可变隔离目录。`, evidencePath: project(projectRoot, terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  return { status: "stale_formal_stage_lock_quarantined_closed", terminal: { path: project(projectRoot, terminalPath), sha256: sha(terminalPath) }, quarantinedLock: { path: project(projectRoot, quarantinedLockPath), sha256: sha(quarantinedLockPath) } }
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  const args = parseArgs(process.argv.slice(2))
  const result = repairStaleFormalStageLock({ packageId: required(args.packageId), lockPath: required(args.lockPath), lockSha256: required(args.lockSha256).toLowerCase(), interruptionTerminalPath: required(args.interruptionTerminal), interruptionTerminalSha256: required(args.interruptionTerminalSha256).toLowerCase(), quarantineRoot: required(args.quarantineRoot) })
  console.log(JSON.stringify(result, null, 2))
}

function isPidAlive(pid) { const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$p = Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\" -ErrorAction SilentlyContinue; if ($p) { 'alive' } else { 'absent' }`], { encoding: "utf8", windowsHide: true }); assert.equal(result.status, 0, "pid_query_failed"); return result.stdout.trim() === "alive" }
function progressRunIdFromPath(value, fixtureMode) {
  assert.equal(typeof value, "string", "interrupted_progress_path_invalid")
  const pattern = fixtureMode
    ? /^\.runtime\/ai-painter\/stage4-stale-formal-lock-cpu-regressions\/\d{8}-\d{9}\/fixture-\d+\/stage4-semantic-mixture-formal-training\/([A-Za-z0-9._-]+)\/training-output\/progress\.json$/u
    : /^\.runtime\/ai-painter\/stage4-semantic-mixture-formal-training\/([A-Za-z0-9._-]+)\/training-output\/progress\.json$/u
  const match = pattern.exec(value)
  assert.ok(match, "interrupted_progress_formal_path_identity_invalid")
  return match[1]
}
function resolveProject(root, value) { assert.equal(typeof value, "string"); assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); assert.equal(value.startsWith("../") || value.includes("/../") || value.includes("\\"), false, "project_path_invalid"); const target = path.resolve(root, value); assert.equal(target.startsWith(`${root}${path.sep}`), true, "project_boundary_required"); return target }
function project(root, value) { return path.relative(root, value).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function required(value) { assert.ok(typeof value === "string" && value.trim(), "argument_required"); return value.trim() }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) { const key = values[index]; const value = values[index + 1]; assert.ok(key?.startsWith("--") && value, "unexpected_argument"); result[key.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = value } return result }

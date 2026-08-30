import fs from "node:fs"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { isDeepStrictEqual } from "node:util"
import { enrichTrainingProcessLedgerEvent } from "./ai-painter-training-ledger-event-analysis.mjs"
import {
  indexArtifact,
  indexProgramEvent,
  openStorageCatalog,
} from "./ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const LEDGER_DIR = path.join(ROOT, ".runtime", "ai-painter", "training-process-ledger")
const LEDGER_PATH = path.join(LEDGER_DIR, "events.jsonl")
const LATEST_LEDGER_PATH = path.join(LEDGER_DIR, "latest.json")
const LEDGER_LOCK_PATH = path.join(LEDGER_DIR, ".program-event-commit.lock")
const LEDGER_LOCK_ARCHIVE_DIR = path.join(LEDGER_DIR, "dead-lock-archive")
const LOCK_TIMEOUT_MS = 30_000
const LOCK_RETRY_MS = 25
const MALFORMED_LOCK_GRACE_MS = 5_000
const DEAD_PROCESS_CONFIRMATION_GRACE_MS = 5_000
const LOCK_WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(4))

let programEventStoreTestHooks = null
let currentProcessStartIdentityCache = null

export function appendAiPainterProgramEvent(input) {
  return ensureAiPainterProgramEventCommitted(input)
}

export function ensureAiPainterProgramEventCommitted(input) {
  assertEventInput(input)
  return withLedgerCommitLock(() => {
    const ledger = readLedgerSnapshot()
    const events = ledger.events
    const requestedId = input.id ?? randomUUID()
    const matches = events.filter((event) => event.id === requestedId)
    if (matches.length > 1) throw new Error(`duplicate program event id in ledger: ${requestedId}`)

    let event = matches[0] ?? null
    if (event === null) {
      event = enrichTrainingProcessLedgerEvent({
        id: requestedId,
        timestamp: input.timestamp ?? new Date().toISOString(),
        ...input,
      })
      events.push(event)
      writeLedgerAppendAtomic(ledger.raw, event)
      invokeProgramEventStoreTestHook("afterLedgerCommit", { event, events })
    } else {
      assertIdempotentEventInput(event, input)
    }

    reconcileLatestProjection(events)
    invokeProgramEventStoreTestHook("afterLatestCommit", { event, events })
    reconcileCatalogProjections(event)
    invokeProgramEventStoreTestHook("afterCatalogCommit", { event, events })
    verifyProgramEventCommitUnlocked(event, events)
    return event
  })
}

export function verifyAiPainterProgramEventCommitted(expected) {
  const expectedInput = typeof expected === "string" ? { id: expected } : expected
  assertEventInput(expectedInput, { requireId: true })
  return withLedgerCommitLock(() => {
    const events = readLedgerSnapshot().events
    const matches = events.filter((event) => event.id === expectedInput.id)
    if (matches.length !== 1) {
      throw new Error(`program event ledger identity count is ${matches.length}: ${expectedInput.id}`)
    }
    const event = matches[0]
    assertIdempotentEventInput(event, expectedInput)
    return verifyProgramEventCommitUnlocked(event, events)
  })
}

export function setAiPainterProgramEventStoreTestHooks(hooks) {
  if (hooks !== null && (typeof hooks !== "object" || Array.isArray(hooks))) {
    throw new TypeError("program event store test hooks must be an object or null")
  }
  programEventStoreTestHooks = hooks
}

export function writeImmutableProgramRun({ root, runId, fileName, record, latest = {} }) {
  const runRoot = path.resolve(ROOT, root, runId)
  const runPath = path.join(runRoot, fileName)
  if (fs.existsSync(runPath)) throw new Error(`immutable program run already exists: ${projectPath(runPath)}`)
  writeJsonAtomic(runPath, record)
  writeJsonAtomic(path.resolve(ROOT, root, "latest.json"), {
    schemaVersion: `${record.schemaVersion}-latest-pointer`,
    runId,
    status: record.status,
    updatedAtUtc: record.updatedAtUtc ?? record.createdAtUtc ?? new Date().toISOString(),
    runPath: projectPath(runPath),
    ...latest,
  })
  indexWrittenArtifact(runPath, runId)
  indexWrittenArtifact(path.resolve(ROOT, root, "latest.json"), runId)
  return { runPath: projectPath(runPath), runRoot: projectPath(runRoot) }
}

export function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

export function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

export function writeJsonAtomic(value, body) {
  writeTextAtomic(value, `${JSON.stringify(body, null, 2)}\n`)
}

function readLedgerSnapshot() {
  if (!fs.existsSync(LEDGER_PATH)) return { events: [], raw: Buffer.alloc(0) }
  const raw = fs.readFileSync(LEDGER_PATH)
  const text = raw.toString("utf8")
  if (!text.trim()) return { events: [], raw }
  const events = text
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line, index) => parseLedgerLine(line, index))
  const ids = new Set()
  for (const event of events) {
    if (typeof event?.id !== "string" || event.id.trim() === "") {
      // Historical ledger rows predate the mandatory event-id contract. Preserve
      // their original bytes and exclude them from idempotency matching; every
      // newly appended event is still assigned and verified with a nonempty id.
      continue
    }
    if (ids.has(event.id)) throw new Error(`duplicate program event id in ledger: ${event.id}`)
    ids.add(event.id)
  }
  return { events, raw }
}

function buildLedgerSummary(events) {
  const summary = {
    total: events.length,
    running: 0,
    success: 0,
    failed: 0,
    error: 0,
    blocked: 0,
    info: 0,
    lastEvent: events.at(-1) ?? null,
  }
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(summary, event.status)) summary[event.status] += 1
  }
  return summary
}

function indexWrittenArtifact(filePath, runId = null) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: createHash("sha256")
      .update(fs.readFileSync(filePath))
      .digest("hex"),
  })
}

function assertEventInput(input, { requireId = false } = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("program event input must be an object")
  }
  if (requireId && (typeof input.id !== "string" || input.id.trim() === "")) {
    throw new TypeError("program event id is required")
  }
  if (input.id !== undefined && (typeof input.id !== "string" || input.id.trim() === "")) {
    throw new TypeError("program event id must be a non-empty string")
  }
}

function assertIdempotentEventInput(existing, input) {
  const candidate = enrichTrainingProcessLedgerEvent({
    id: existing.id,
    timestamp: input.timestamp ?? existing.timestamp,
    ...input,
  })
  const keys = new Set(["id", ...Object.keys(input).filter((key) => input[key] !== undefined)])
  for (const key of keys) {
    if (!isDeepStrictEqual(existing[key], candidate[key])) {
      throw new Error(`program event id collision with different ${key}: ${existing.id}`)
    }
  }
}

function parseLedgerLine(line, index) {
  try {
    return JSON.parse(line.replace(/^\uFEFF/u, ""))
  } catch (error) {
    throw new Error(`program event ledger contains invalid JSON at line ${index + 1}: ${error.message}`)
  }
}

function writeLedgerAppendAtomic(raw, event) {
  const separator = raw.length > 0 && raw.at(-1) !== 0x0a ? Buffer.from("\n", "utf8") : Buffer.alloc(0)
  const eventLine = Buffer.from(`${JSON.stringify(event)}\n`, "utf8")
  writeTextAtomic(LEDGER_PATH, Buffer.concat([raw, separator, eventLine]), "beforeLedgerRename")
}

function reconcileLatestProjection(events) {
  const expected = buildLatestLedger(events)
  const current = readJsonIfValid(LATEST_LEDGER_PATH)
  if (!isDeepStrictEqual(current, expected)) writeJsonAtomic(LATEST_LEDGER_PATH, expected)
  const persisted = readJsonIfValid(LATEST_LEDGER_PATH)
  if (!isDeepStrictEqual(persisted, expected)) {
    throw new Error("program event latest.json projection read-back mismatch")
  }
}

function buildLatestLedger(events) {
  return {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: events.slice(-120).reverse(),
    summary: buildLedgerSummary(events),
  }
}

function reconcileCatalogProjections(event) {
  const db = openStorageCatalog()
  db.exec("BEGIN IMMEDIATE")
  try {
    const existing = readCatalogProgramEvent(db, event.id)
    if (existing === null) indexProgramEvent(event)
    else assertCatalogProgramEvent(existing, event)
    indexWrittenArtifact(LEDGER_PATH)
    indexWrittenArtifact(LATEST_LEDGER_PATH)
    db.exec("COMMIT")
  } catch (error) {
    try {
      db.exec("ROLLBACK")
    } catch {
      // Preserve the original transaction error.
    }
    throw error
  }
}

function verifyProgramEventCommitUnlocked(event, events) {
  const ledgerMatches = events.filter((candidate) => candidate.id === event.id)
  if (ledgerMatches.length !== 1 || !isDeepStrictEqual(ledgerMatches[0], event)) {
    throw new Error(`program event ledger read-back mismatch: ${event.id}`)
  }

  const latest = readJsonIfValid(LATEST_LEDGER_PATH)
  const expectedLatest = buildLatestLedger(events)
  if (!isDeepStrictEqual(latest, expectedLatest)) {
    throw new Error(`program event latest.json read-back mismatch: ${event.id}`)
  }

  const db = openStorageCatalog()
  const catalogEvent = readCatalogProgramEvent(db, event.id)
  if (catalogEvent === null) throw new Error(`program event SQLite projection is missing: ${event.id}`)
  assertCatalogProgramEvent(catalogEvent, event)
  const ledgerArtifact = verifyCatalogArtifact(db, LEDGER_PATH)
  const latestArtifact = verifyCatalogArtifact(db, LATEST_LEDGER_PATH)

  return {
    event,
    ledger: fileBinding(LEDGER_PATH),
    latest: fileBinding(LATEST_LEDGER_PATH),
    legacyIdlessEventCount: events.filter((candidate) => typeof candidate?.id !== "string" || candidate.id.trim() === "").length,
    catalog: {
      programEventId: event.id,
      ledgerArtifact,
      latestArtifact,
    },
  }
}

function readCatalogProgramEvent(db, eventId) {
  return db.prepare(`
    SELECT event_id, timestamp_utc, action, run_id, kind, status, title, title_zh, evidence_path, event_json
    FROM program_events
    WHERE event_id = ?
  `).get(eventId) ?? null
}

function assertCatalogProgramEvent(row, event) {
  let persisted
  try {
    persisted = JSON.parse(row.event_json)
  } catch (error) {
    throw new Error(`program event SQLite JSON is invalid for ${event.id}: ${error.message}`)
  }
  const expectedColumns = {
    event_id: event.id,
    timestamp_utc: event.timestamp,
    action: event.action ?? null,
    run_id: event.runId ?? null,
    kind: event.kind ?? null,
    status: event.status ?? null,
    title: event.title ?? null,
    title_zh: event.titleZh ?? null,
    evidence_path: event.evidencePath ?? null,
  }
  for (const [key, value] of Object.entries(expectedColumns)) {
    if (!isDeepStrictEqual(row[key], value)) {
      throw new Error(`program event SQLite ${key} mismatch: ${event.id}`)
    }
  }
  if (!isDeepStrictEqual(persisted, event)) {
    throw new Error(`program event SQLite payload mismatch: ${event.id}`)
  }
}

function verifyCatalogArtifact(db, filePath) {
  const binding = fileBinding(filePath)
  const logicalPath = logicalProjectPath(filePath)
  const row = db.prepare(`
    SELECT logical_path, physical_uri, storage_layer, run_id, byte_size, sha256
    FROM artifacts
    WHERE logical_path = ?
  `).get(logicalPath)
  if (!row) throw new Error(`program event artifact catalog row is missing: ${logicalPath}`)
  const expected = {
    logical_path: logicalPath,
    physical_uri: fs.realpathSync(filePath),
    storage_layer: "hot",
    run_id: null,
    byte_size: binding.byteSize,
    sha256: binding.sha256,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(row[key], value)) {
      throw new Error(`program event artifact catalog ${key} mismatch: ${logicalPath}`)
    }
  }
  return binding
}

function fileBinding(filePath) {
  const stat = fs.statSync(filePath)
  return {
    path: projectPath(filePath),
    byteSize: stat.size,
    sha256: createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
  }
}

function readJsonIfValid(filePath) {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""))
  } catch {
    return null
  }
}

function writeTextAtomic(filePath, text, testHook = null) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  let descriptor = null
  try {
    descriptor = fs.openSync(temp, "wx")
    fs.writeFileSync(descriptor, text, "utf8")
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = null
    if (testHook) invokeProgramEventStoreTestHook(testHook, { filePath, temp })
    fs.renameSync(temp, filePath)
    fsyncDirectoryBestEffort(path.dirname(filePath))
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor)
    if (fs.existsSync(temp)) fs.unlinkSync(temp)
    throw error
  }
}

function withLedgerCommitLock(callback) {
  fs.mkdirSync(LEDGER_DIR, { recursive: true })
  const token = randomUUID()
  const startedAt = Date.now()
  const processStartIdentity = currentProcessStartIdentity()
  acquireLedgerCommitLock(token, startedAt, processStartIdentity)
  try {
    return callback()
  } finally {
    releaseLedgerCommitLock(token, processStartIdentity)
  }
}

function acquireLedgerCommitLock(token, startedAt, processStartIdentity) {
  while (true) {
    let descriptor = null
    let lockCreated = false
    try {
      descriptor = fs.openSync(LEDGER_LOCK_PATH, "wx")
      lockCreated = true
      fs.writeFileSync(descriptor, `${JSON.stringify({
        schemaVersion: "ai-painter-program-event-commit-lock-v2",
        token,
        pid: process.pid,
        processStartIdentity,
        createdAtUtc: new Date().toISOString(),
      })}\n`, "utf8")
      fs.fsyncSync(descriptor)
      fs.closeSync(descriptor)
      fsyncDirectoryBestEffort(LEDGER_DIR)
      return
    } catch (error) {
      if (descriptor !== null) fs.closeSync(descriptor)
      if (lockCreated && fs.existsSync(LEDGER_LOCK_PATH)) fs.unlinkSync(LEDGER_LOCK_PATH)
      if (error.code !== "EEXIST") throw error
      const probe = probeLedgerCommitLock()
      if (probe.state === "dead") {
        if (probe.lockMissing === true || archiveDeadLedgerCommitLock(probe)) continue
      } else if (probe.state === "indeterminate") {
        throw new Error(`program event commit lock process identity is indeterminate: ${probe.reason}`)
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(`timed out waiting for program event commit lock: ${projectPath(LEDGER_LOCK_PATH)}`)
      }
      Atomics.wait(LOCK_WAIT_ARRAY, 0, 0, LOCK_RETRY_MS)
    }
  }
}

function probeLedgerCommitLock() {
  let stat
  let record = null
  try {
    stat = fs.statSync(LEDGER_LOCK_PATH)
    record = JSON.parse(fs.readFileSync(LEDGER_LOCK_PATH, "utf8"))
  } catch (error) {
    if (error.code === "ENOENT") return { state: "dead", reason: "lock_missing", lockMissing: true }
    if (!stat || Date.now() - stat.mtimeMs < MALFORMED_LOCK_GRACE_MS) {
      return { state: "active", reason: "lock_initialization_in_progress" }
    }
    return { state: "indeterminate", reason: "lock_record_unreadable" }
  }

  if (!isValidLedgerLockRecord(record)) {
    return { state: "indeterminate", reason: "lock_record_identity_invalid", record }
  }
  const probe = probeBoundProcessStartIdentity(record)
  const createdAtMs = Date.parse(record.createdAtUtc)
  if (probe.state === "dead" && Number.isFinite(createdAtMs) && Date.now() - createdAtMs < DEAD_PROCESS_CONFIRMATION_GRACE_MS) {
    return {
      state: "active",
      reason: "dead_process_probe_waiting_for_confirmation_grace",
      record,
      stat,
    }
  }
  return { ...probe, record, stat }
}

function archiveDeadLedgerCommitLock(probe) {
  if (probe.state !== "dead" || probe.lockMissing === true) {
    throw new Error("only a dead bound process lock may be archived")
  }
  fs.mkdirSync(LEDGER_LOCK_ARCHIVE_DIR, { recursive: true })
  const reason = String(probe.reason ?? "dead").replace(/[^a-z0-9_-]+/giu, "-").slice(0, 80)
  const archivedPath = path.join(
    LEDGER_LOCK_ARCHIVE_DIR,
    `${Date.now()}-${reason}-${randomUUID()}.json`,
  )
  try {
    fs.renameSync(LEDGER_LOCK_PATH, archivedPath)
    fsyncDirectoryBestEffort(LEDGER_DIR)
    fsyncDirectoryBestEffort(LEDGER_LOCK_ARCHIVE_DIR)
    return true
  } catch (error) {
    if (["ENOENT", "EACCES", "EPERM"].includes(error.code)) return false
    throw error
  }
}

function releaseLedgerCommitLock(token, processStartIdentity) {
  if (!fs.existsSync(LEDGER_LOCK_PATH)) return
  let record
  try {
    record = JSON.parse(fs.readFileSync(LEDGER_LOCK_PATH, "utf8"))
  } catch {
    throw new Error("program event commit lock became unreadable while held")
  }
  if (
    record.token !== token
    || record.pid !== process.pid
    || !isDeepStrictEqual(record.processStartIdentity, processStartIdentity)
  ) {
    throw new Error(`program event commit lock ownership changed while held: ${JSON.stringify({
      expectedToken: token,
      observedToken: record.token,
      expectedPid: process.pid,
      observedPid: record.pid,
      processIdentityMatches: isDeepStrictEqual(record.processStartIdentity, processStartIdentity),
      archivedLockNames: fs.existsSync(LEDGER_LOCK_ARCHIVE_DIR) ? fs.readdirSync(LEDGER_LOCK_ARCHIVE_DIR) : [],
    })}`)
  }
  fs.unlinkSync(LEDGER_LOCK_PATH)
  fsyncDirectoryBestEffort(LEDGER_DIR)
}

function isValidLedgerLockRecord(record) {
  return record?.schemaVersion === "ai-painter-program-event-commit-lock-v2"
    && typeof record.token === "string"
    && record.token.length > 0
    && Number.isInteger(record.pid)
    && record.pid > 0
    && typeof record.createdAtUtc === "string"
    && Number.isFinite(Date.parse(record.createdAtUtc))
    && isValidProcessStartIdentity(record.processStartIdentity)
}

function currentProcessStartIdentity() {
  const injected = programEventStoreTestHooks?.currentProcessStartIdentity?.()
  if (injected !== undefined) {
    if (!isValidProcessStartIdentity(injected)) throw new Error("injected current process identity is invalid")
    return injected
  }
  if (currentProcessStartIdentityCache !== null) return currentProcessStartIdentityCache
  const probe = queryProcessStartIdentity(process.pid)
  if (probe.state !== "active" || !isValidProcessStartIdentity(probe.identity)) {
    throw new Error(`cannot establish current process start identity: ${probe.reason}`)
  }
  currentProcessStartIdentityCache = probe.identity
  return currentProcessStartIdentityCache
}

function probeBoundProcessStartIdentity(record) {
  const injected = programEventStoreTestHooks?.probeBoundProcessStartIdentity?.(record)
  if (injected !== undefined) return validateProcessProbe(injected)
  const observed = queryProcessStartIdentity(record.pid)
  if (observed.state === "active" && observed.reason === "windows_process_present_without_cim_identity") {
    return {
      state: "active",
      reason: "windows_cim_transient_miss_get_process_still_active",
      identity: record.processStartIdentity,
    }
  }
  if (observed.state !== "active") return observed
  if (isDeepStrictEqual(observed.identity, record.processStartIdentity)) {
    return { state: "active", reason: "bound_process_identity_matches", identity: observed.identity }
  }
  return {
    state: "dead",
    reason: "bound_process_identity_mismatch_pid_reused",
    expectedIdentity: record.processStartIdentity,
    observedIdentity: observed.identity,
  }
}

function validateProcessProbe(probe) {
  if (!probe || !["active", "dead", "indeterminate"].includes(probe.state)) {
    throw new Error("injected process identity probe is invalid")
  }
  if (typeof probe.reason !== "string" || probe.reason === "") {
    throw new Error("injected process identity probe reason is required")
  }
  return probe
}

function queryProcessStartIdentity(pid) {
  if (process.platform === "win32") return queryWindowsProcessStartIdentity(pid)
  if (process.platform === "linux") return queryLinuxProcessStartIdentity(pid)
  return queryPosixProcessStartIdentity(pid)
}

function queryWindowsProcessStartIdentity(pid) {
  const script = [
    "& {",
    "param([int]$TargetPid)",
    "$ErrorActionPreference='Stop'",
    "try {",
    "  $Process=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $TargetPid) -ErrorAction Stop",
    "  if ($null -eq $Process) {",
    "    $Fallback=Get-Process -Id $TargetPid -ErrorAction SilentlyContinue",
    "    if ($null -eq $Fallback) { exit 3 }",
    "    [ordered]@{ pid=[int]$Fallback.Id; identityAvailable=$false } | ConvertTo-Json -Compress",
    "    exit 0",
    "  }",
    "  [ordered]@{ pid=[int]$Process.ProcessId; identityAvailable=$true; creationDateUtc=$Process.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress",
    "} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 4 }",
    "}",
  ].join("\n")
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script, String(pid)],
    { encoding: "utf8", windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 },
  )
  if (result.status === 3) return { state: "dead", reason: "windows_process_not_found" }
  if (result.error || result.status !== 0) {
    return {
      state: "indeterminate",
      reason: `windows_creation_date_probe_failed:${result.error?.code ?? result.status ?? "unknown"}`,
    }
  }
  try {
    const value = JSON.parse(String(result.stdout).replace(/^\uFEFF/u, "").trim())
    if (value.pid !== pid) {
      return { state: "indeterminate", reason: "windows_creation_date_probe_invalid_output" }
    }
    if (value.identityAvailable === false) {
      return { state: "active", reason: "windows_process_present_without_cim_identity", identity: null }
    }
    if (value.identityAvailable !== true || typeof value.creationDateUtc !== "string" || value.creationDateUtc === "") {
      return { state: "indeterminate", reason: "windows_creation_date_probe_invalid_output" }
    }
    return {
      state: "active",
      reason: "windows_creation_date_observed",
      identity: {
        source: "windows_cim_win32_process_creation_date_v1",
        creationDateUtc: value.creationDateUtc,
      },
    }
  } catch {
    return { state: "indeterminate", reason: "windows_creation_date_probe_invalid_json" }
  }
}

function queryLinuxProcessStartIdentity(pid) {
  const statPath = `/proc/${pid}/stat`
  try {
    const raw = fs.readFileSync(statPath, "utf8")
    const commandEnd = raw.lastIndexOf(")")
    if (commandEnd < 0) return { state: "indeterminate", reason: "linux_proc_stat_invalid" }
    const fields = raw.slice(commandEnd + 2).trim().split(/\s+/u)
    const startTicks = fields[19]
    const bootId = fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()
    if (!startTicks || !bootId) return { state: "indeterminate", reason: "linux_proc_identity_missing" }
    return {
      state: "active",
      reason: "linux_proc_identity_observed",
      identity: { source: "linux_procfs_boot_id_start_ticks_v1", bootId, startTicks },
    }
  } catch (error) {
    if (error.code === "ENOENT") return { state: "dead", reason: "linux_process_not_found" }
    return { state: "indeterminate", reason: `linux_process_probe_failed:${error.code ?? "unknown"}` }
  }
}

function queryPosixProcessStartIdentity(pid) {
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
  if (result.status === 1 && String(result.stdout).trim() === "") {
    return { state: "dead", reason: "posix_process_not_found" }
  }
  if (result.error || result.status !== 0) {
    return { state: "indeterminate", reason: `posix_process_probe_failed:${result.error?.code ?? result.status ?? "unknown"}` }
  }
  const startedAt = String(result.stdout).trim()
  if (!startedAt) return { state: "indeterminate", reason: "posix_process_start_identity_missing" }
  return {
    state: "active",
    reason: "posix_process_start_identity_observed",
    identity: { source: "posix_ps_lstart_v1", startedAt },
  }
}

function isValidProcessStartIdentity(identity) {
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) return false
  if (identity.source === "windows_cim_win32_process_creation_date_v1") {
    return typeof identity.creationDateUtc === "string" && identity.creationDateUtc.length > 0
  }
  if (identity.source === "linux_procfs_boot_id_start_ticks_v1") {
    return typeof identity.bootId === "string" && identity.bootId.length > 0
      && typeof identity.startTicks === "string" && identity.startTicks.length > 0
  }
  if (identity.source === "posix_ps_lstart_v1") {
    return typeof identity.startedAt === "string" && identity.startedAt.length > 0
  }
  return identity.source === "test_process_start_identity_v1"
    && typeof identity.value === "string"
    && identity.value.length > 0
}

function fsyncDirectoryBestEffort(directory) {
  let descriptor = null
  try {
    descriptor = fs.openSync(directory, "r")
    fs.fsyncSync(descriptor)
  } catch (error) {
    if (!["EACCES", "EBADF", "EINVAL", "EISDIR", "EPERM"].includes(error.code)) throw error
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor)
  }
}

function invokeProgramEventStoreTestHook(name, context) {
  const hook = programEventStoreTestHooks?.[name]
  if (typeof hook === "function") hook(context)
}

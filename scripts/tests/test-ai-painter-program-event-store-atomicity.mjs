import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

const STORE_URL = pathToFileURL(
  path.resolve("scripts/lib/ai-painter-program-event-store.mjs"),
).href

test("production scripts cannot bypass the shared AI Painter program event store", () => {
  const offenders = []
  for (const filePath of listModuleFiles(path.resolve("scripts"))) {
    if (filePath.includes(`${path.sep}tests${path.sep}`)) continue
    const source = fs.readFileSync(filePath, "utf8")
    if (!source.includes("training-process-ledger")) continue
    if (/appendFileSync\s*\(/u.test(source)) offenders.push(path.relative(process.cwd(), filePath))
    if (/latestLedgerPath/u.test(source) && /writeFileSync\s*\(/u.test(source)) {
      offenders.push(path.relative(process.cwd(), filePath))
    }
  }
  assert.deepEqual([...new Set(offenders)].sort(), [])
})

test("legacy id-less ledger rows remain byte-identical while a new id-bearing event commits", (t) => {
  const fixture = createFixture(t)
  const legacy = {
    schemaVersion: "legacy-program-event-v0",
    timestamp: "2026-07-09T23:47:52.625Z",
    action: "legacy_action_without_id",
    status: "blocked",
  }
  fs.mkdirSync(path.dirname(fixture.ledgerPath), { recursive: true })
  const legacyLine = `${JSON.stringify(legacy)}\n`
  fs.writeFileSync(fixture.ledgerPath, legacyLine, "utf8")
  const current = event("post-legacy-event", "post_legacy_commit")

  runStore(fixture, `
    const committed = store.ensureAiPainterProgramEventCommitted(${JSON.stringify(current)})
    const receipt = store.verifyAiPainterProgramEventCommitted(committed)
    if (receipt.legacyIdlessEventCount !== 1) throw new Error('legacy row count mismatch')
  `)
  const raw = fs.readFileSync(fixture.ledgerPath, "utf8")
  assert.equal(raw.startsWith(legacyLine), true)
  assert.deepEqual(readLedger(fixture)[0], legacy)
  assert.equal(readLedger(fixture).filter((item) => item.id === current.id).length, 1)
  assert.equal(readCatalogEvent(fixture, current.id)?.event_id, current.id)
})

test("power loss before the ledger rename leaves the previous JSONL intact and retry commits once", (t) => {
  const fixture = createFixture(t)
  const first = event("atomic-event-1", "atomic_first")
  const second = event("atomic-event-2", "atomic_second")
  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(first)})`)

  const crashed = runStore(
    fixture,
    `
      store.setAiPainterProgramEventStoreTestHooks({ beforeLedgerRename: () => process.exit(87) })
      store.ensureAiPainterProgramEventCommitted(${JSON.stringify(second)})
    `,
    { expectedStatus: 87 },
  )
  assert.equal(crashed.status, 87)
  assert.deepEqual(readLedger(fixture).map((item) => item.id), [first.id])

  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(second)})`)
  const committed = readLedger(fixture)
  assert.deepEqual(committed.map((item) => item.id), [first.id, second.id])
  assert.equal(new Set(committed.map((item) => item.id)).size, 2)
  runStore(fixture, `store.verifyAiPainterProgramEventCommitted(${JSON.stringify(second)})`)
})

test("power loss after the ledger commit is recovered into latest.json and every SQLite projection", (t) => {
  const fixture = createFixture(t)
  const first = event("projection-event-1", "projection_first")
  const second = event("projection-event-2", "projection_second")
  const third = event("projection-event-3", "projection_third")
  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(first)})`)

  runStore(
    fixture,
    `
      store.setAiPainterProgramEventStoreTestHooks({ afterLedgerCommit: () => process.exit(88) })
      store.ensureAiPainterProgramEventCommitted(${JSON.stringify(second)})
    `,
    { expectedStatus: 88 },
  )

  assert.deepEqual(readLedger(fixture).map((item) => item.id), [first.id, second.id])
  assert.equal(readLatest(fixture).events.some((item) => item.id === second.id), false)
  assert.equal(readCatalogEvent(fixture, second.id), null)

  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(second)})`)
  assert.equal(readLatest(fixture).events[0].id, second.id)
  assert.equal(readCatalogEvent(fixture, second.id)?.event_id, second.id)
  assertCatalogArtifacts(fixture)

  runStore(
    fixture,
    `
      store.setAiPainterProgramEventStoreTestHooks({ afterLatestCommit: () => process.exit(89) })
      store.ensureAiPainterProgramEventCommitted(${JSON.stringify(third)})
    `,
    { expectedStatus: 89 },
  )
  assert.equal(readLatest(fixture).events[0].id, third.id)
  assert.equal(readCatalogEvent(fixture, third.id), null)
  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(third)})`)
  assert.equal(readCatalogEvent(fixture, third.id)?.event_id, third.id)

  fs.unlinkSync(fixture.latestPath)
  const database = new DatabaseSync(fixture.catalogPath)
  database.prepare("DELETE FROM program_events WHERE event_id = ?").run(third.id)
  database.prepare("DELETE FROM artifacts WHERE logical_path IN (?, ?)").run(
    ".runtime/ai-painter/training-process-ledger/events.jsonl",
    ".runtime/ai-painter/training-process-ledger/latest.json",
  )
  database.close()

  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(third)})`)
  assert.equal(readLedger(fixture).filter((item) => item.id === third.id).length, 1)
  assert.equal(readLatest(fixture).events[0].id, third.id)
  assert.equal(readCatalogEvent(fixture, third.id)?.event_id, third.id)
  assertCatalogArtifacts(fixture)
  runStore(fixture, `store.verifyAiPainterProgramEventCommitted(${JSON.stringify(third)})`)
})

test("concurrent repeated commits are serialized and one event id produces one ledger line", async (t) => {
  const fixture = createFixture(t)
  const repeated = event("concurrent-event", "concurrent_commit")
  const source = storeSource(`store.ensureAiPainterProgramEventCommitted(${JSON.stringify(repeated)})`)
  const results = await Promise.all(
    Array.from({ length: 6 }, () => spawnStore(fixture, source)),
  )
  for (const result of results) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  }
  assert.equal(readLedger(fixture).filter((item) => item.id === repeated.id).length, 1)
  assert.equal(readLatest(fixture).events.filter((item) => item.id === repeated.id).length, 1)
  assert.equal(readCatalogEvent(fixture, repeated.id)?.event_id, repeated.id)
  assertCatalogArtifacts(fixture)

  const conflict = { ...repeated, action: "different_action" }
  const failed = runStore(
    fixture,
    `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(conflict)})`,
    { expectedFailure: true },
  )
  assert.match(failed.stderr, /program event id collision/u)
  assert.equal(readLedger(fixture).filter((item) => item.id === repeated.id).length, 1)
})

test("a conflicting SQLite event payload fails closed instead of being overwritten", (t) => {
  const fixture = createFixture(t)
  const original = event("catalog-conflict-event", "catalog_conflict")
  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(original)})`)

  const database = new DatabaseSync(fixture.catalogPath)
  const row = database.prepare("SELECT event_json FROM program_events WHERE event_id = ?").get(original.id)
  const changed = { ...JSON.parse(row.event_json), action: "tampered_action" }
  database.prepare("UPDATE program_events SET action = ?, event_json = ? WHERE event_id = ?").run(
    changed.action,
    JSON.stringify(changed),
    original.id,
  )
  database.close()

  const failed = runStore(
    fixture,
    `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(original)})`,
    { expectedFailure: true },
  )
  assert.match(failed.stderr, /program event SQLite (?:action|payload) mismatch/u)
  assert.equal(readLedger(fixture).filter((item) => item.id === original.id).length, 1)
})

test("an alive reused PID with a different process start identity is treated as the dead original owner", (t) => {
  const fixture = createFixture(t)
  const record = lockRecord({
    token: "pid-reuse-lock",
    pid: process.pid,
    processStartIdentity: mismatchedProcessIdentity(),
  })
  writeLock(fixture, record)
  const committed = event("pid-reuse-event", "pid_reuse_recovery")

  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(committed)})`)
  assert.equal(fs.existsSync(fixture.lockPath), false)
  assert.equal(readArchivedLocks(fixture).some((item) => item.token === record.token), true)
  assert.equal(readLedger(fixture).filter((item) => item.id === committed.id).length, 1)
})

test("an indeterminate process identity probe fails closed and preserves the lock", (t) => {
  const fixture = createFixture(t)
  const record = lockRecord({
    token: "indeterminate-lock",
    pid: process.pid,
    processStartIdentity: mismatchedProcessIdentity(),
  })
  writeLock(fixture, record)
  const blocked = event("indeterminate-event", "indeterminate_probe")
  const result = runStore(
    fixture,
    `
      store.setAiPainterProgramEventStoreTestHooks({
        probeBoundProcessStartIdentity: () => ({ state: "indeterminate", reason: "test_probe_unavailable" }),
      })
      store.ensureAiPainterProgramEventCommitted(${JSON.stringify(blocked)})
    `,
    { expectedFailure: true },
  )
  assert.match(result.stderr, /process identity is indeterminate: test_probe_unavailable/u)
  assert.equal(JSON.parse(fs.readFileSync(fixture.lockPath, "utf8")).token, record.token)
  assert.equal(readArchivedLocks(fixture).length, 0)
  assert.equal(fs.existsSync(fixture.ledgerPath), false)
})

test("a missing bound process is classified dead and its lock is atomically archived", (t) => {
  const fixture = createFixture(t)
  const record = lockRecord({
    token: "dead-process-lock",
    pid: 2_000_000_000,
    processStartIdentity: mismatchedProcessIdentity(),
  })
  writeLock(fixture, record)
  const committed = event("dead-process-event", "dead_process_recovery")

  runStore(fixture, `store.ensureAiPainterProgramEventCommitted(${JSON.stringify(committed)})`)
  assert.equal(fs.existsSync(fixture.lockPath), false)
  assert.equal(readArchivedLocks(fixture).some((item) => item.token === record.token), true)
  assert.equal(readLedger(fixture).filter((item) => item.id === committed.id).length, 1)
})

function event(id, action) {
  return {
    id,
    timestamp: "2026-08-29T03:00:00.000Z",
    action,
    runId: "program-event-store-test-run",
    kind: "cpu_readonly_test",
    status: "success",
    title: `Program event ${id}`,
    titleZh: `程序事件${id}`,
    evidencePath: `.runtime/ai-painter/tests/${id}.json`,
    evidenceSha256: "a".repeat(64),
  }
}

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-program-event-store-"))
  const dataRoot = path.join(root, "data")
  const ledgerDir = path.join(root, ".runtime", "ai-painter", "training-process-ledger")
  const fixture = {
    root,
    dataRoot,
    ledgerPath: path.join(ledgerDir, "events.jsonl"),
    latestPath: path.join(ledgerDir, "latest.json"),
    lockPath: path.join(ledgerDir, ".program-event-commit.lock"),
    lockArchivePath: path.join(ledgerDir, "dead-lock-archive"),
    catalogPath: path.join(dataRoot, "catalog", "ai-pet-world-catalog.sqlite"),
  }
  t.after(() => {
    const relative = path.relative(os.tmpdir(), root)
    assert.equal(relative.startsWith("..") || path.isAbsolute(relative), false)
    fs.rmSync(root, { recursive: true, force: true })
  })
  return fixture
}

function lockRecord({ token, pid, processStartIdentity }) {
  return {
    schemaVersion: "ai-painter-program-event-commit-lock-v2",
    token,
    pid,
    processStartIdentity,
    createdAtUtc: "2026-08-29T03:00:00.000Z",
  }
}

function mismatchedProcessIdentity() {
  if (process.platform === "win32") {
    return {
      source: "windows_cim_win32_process_creation_date_v1",
      creationDateUtc: "1900-01-01T00:00:00.0000000Z",
    }
  }
  if (process.platform === "linux") {
    return {
      source: "linux_procfs_boot_id_start_ticks_v1",
      bootId: "00000000-0000-0000-0000-000000000000",
      startTicks: "1",
    }
  }
  return {
    source: "posix_ps_lstart_v1",
    startedAt: "Mon Jan  1 00:00:00 1900",
  }
}

function writeLock(fixture, record) {
  fs.mkdirSync(path.dirname(fixture.lockPath), { recursive: true })
  fs.writeFileSync(fixture.lockPath, `${JSON.stringify(record)}\n`, "utf8")
}

function readArchivedLocks(fixture) {
  if (!fs.existsSync(fixture.lockArchivePath)) return []
  return fs.readdirSync(fixture.lockArchivePath)
    .map((name) => JSON.parse(fs.readFileSync(path.join(fixture.lockArchivePath, name), "utf8")))
}

function runStore(fixture, body, { expectedStatus = 0, expectedFailure = false } = {}) {
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", storeSource(body)], {
    cwd: fixture.root,
    encoding: "utf8",
    windowsHide: true,
    env: storeEnvironment(fixture),
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  assert.equal(result.error, undefined)
  if (expectedFailure) assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
  else assert.equal(result.status, expectedStatus, `${result.stdout}\n${result.stderr}`)
  return result
}

function spawnStore(fixture, source) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: fixture.root,
      windowsHide: true,
      env: storeEnvironment(fixture),
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (status) => resolve({ status, stdout, stderr }))
  })
}

function storeSource(body) {
  return `
    const store = await import(${JSON.stringify(STORE_URL)})
    ${body}
  `
}

function storeEnvironment(fixture) {
  return {
    ...process.env,
    AI_PET_WORLD_DATA_ROOT: fixture.dataRoot,
    NODE_NO_WARNINGS: "1",
  }
}

function readLedger(fixture) {
  return fs.readFileSync(fixture.ledgerPath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function readLatest(fixture) {
  return JSON.parse(fs.readFileSync(fixture.latestPath, "utf8"))
}

function readCatalogEvent(fixture, eventId) {
  const database = new DatabaseSync(fixture.catalogPath, { readOnly: true })
  const row = database.prepare("SELECT * FROM program_events WHERE event_id = ?").get(eventId) ?? null
  database.close()
  return row
}

function assertCatalogArtifacts(fixture) {
  const database = new DatabaseSync(fixture.catalogPath, { readOnly: true })
  const rows = database.prepare(`
    SELECT logical_path, byte_size, sha256
    FROM artifacts
    WHERE logical_path IN (?, ?)
    ORDER BY logical_path
  `).all(
    ".runtime/ai-painter/training-process-ledger/events.jsonl",
    ".runtime/ai-painter/training-process-ledger/latest.json",
  )
  database.close()
  assert.equal(rows.length, 2)
  const expected = new Map([
    [".runtime/ai-painter/training-process-ledger/events.jsonl", fixture.ledgerPath],
    [".runtime/ai-painter/training-process-ledger/latest.json", fixture.latestPath],
  ])
  for (const row of rows) {
    const filePath = expected.get(row.logical_path)
    assert.equal(row.byte_size, fs.statSync(filePath).size)
    assert.match(row.sha256, /^[0-9a-f]{64}$/u)
  }
}

function listModuleFiles(root) {
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listModuleFiles(entryPath))
    else if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(entryPath)
  }
  return files
}

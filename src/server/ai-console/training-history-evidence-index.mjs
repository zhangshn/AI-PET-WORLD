// V23's independent, read-only-to-training discovery source. This module never
// writes producer evidence. A separate bounded worker calls scanHistoryEvidence;
// request handlers only call readHistoryEvidenceIndex.
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { bytes } from './training-history-safe-bytes.mjs'

export const HISTORY_INDEX_PATH = '.runtime/ai-console/training/history-index-v1.sqlite'
const SHA = /^[a-f0-9]{64}$/u
const RUN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/u
const SCAN_ROOTS = ['.runtime/ai-painter', 'cold/runs']
const within = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) }

function openIndex(root, readOnly) {
  const file = path.join(root, HISTORY_INDEX_PATH)
  if (readOnly && !existsSync(file)) return null
  if (!readOnly) mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file, { readOnly })
  db.exec(readOnly ? 'PRAGMA query_only=ON; PRAGMA busy_timeout=5000' : `PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1), schema TEXT NOT NULL, revision INTEGER NOT NULL, scanned_at TEXT, lease_until INTEGER NOT NULL DEFAULT 0, complete INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS queue(logical_path TEXT PRIMARY KEY, cursor TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS directories(logical_path TEXT PRIMARY KEY, last_scanned INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sources(logical_path TEXT PRIMARY KEY, content_sha TEXT NOT NULL, run_id TEXT NOT NULL, kind TEXT NOT NULL, terminal_path TEXT, terminal_sha TEXT, parent_path TEXT, parent_sha TEXT, status TEXT NOT NULL, reason_code TEXT, discovered_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sources_run ON sources(run_id,kind);
    INSERT OR IGNORE INTO meta(id,schema,revision,lease_until,complete) VALUES(1,'ai_console_training_history_index_v1',0,0,0);`)
  if (!readOnly && !db.prepare('PRAGMA table_info(queue)').all().some(column => column.name === 'priority')) db.exec('ALTER TABLE queue ADD COLUMN priority INTEGER NOT NULL DEFAULT 0')
  return db
}

function validBinding(value) { return value && typeof value.path === 'string' && SHA.test(value.sha256) }
function candidateKind(value) {
  if (!value || !RUN.test(value.runId ?? '')) return null
  if (validBinding(value.trainingTerminal)) return 'materialization'
  if (validBinding(value.materialization)) return 'review'
  return null
}

async function validateSource(root, logical, sourceBytes, digest) {
  let value
  try { value = JSON.parse(sourceBytes.toString('utf8')) } catch { return null }
  const kind = candidateKind(value)
  if (!kind) return null
  const parent = kind === 'materialization' ? value.trainingTerminal : value.materialization
  const result = { logical, contentSha: digest, runId: value.runId, kind,
    terminalPath: kind === 'materialization' ? parent.path : null,
    terminalSha: kind === 'materialization' ? parent.sha256 : null,
    parentPath: parent.path, parentSha: parent.sha256, status: 'verified', reasonCode: null }
  if (kind === 'materialization' && (!value.schemaVersion || !validBinding(value.workerTerminal)
      || !validBinding(value.checkpoint) || !validBinding(value.candidate?.referenceRgb)
      || !validBinding(value.candidate?.candidateRgb) || typeof value.candidate?.sampleId !== 'string'
      || value.candidate?.split !== 'validation' || !value.artifacts || Array.isArray(value.artifacts))
    || kind === 'review' && (!value.schemaVersion || !Array.isArray(value.issueCodes)
      || !validBinding(value.candidateRgb))) {
    result.status = 'partial'; result.reasonCode = 'history_source_schema_unsupported'
  }
  try {
    const verified = await bytes(root, parent.path, 8 * 1024 * 1024, parent.sha256)
    const ancestor = JSON.parse(verified.value.toString('utf8'))
    if (ancestor.runId !== value.runId) throw new Error('history_source_parent_run_conflict')
    if (kind === 'review' && !validBinding(ancestor.trainingTerminal)) throw new Error('history_review_materialization_unsupported')
  } catch (error) { result.status = 'partial'; result.reasonCode = error instanceof Error ? error.message : 'history_source_parent_unavailable' }
  return result
}

export async function scanHistoryEvidence({ root = process.cwd(), maxEntries = 2000, maxMs = 5000, now = Date.now } = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 2000 || !Number.isInteger(maxMs) || maxMs < 1 || maxMs > 5000) throw new Error('history_index_budget_invalid')
  const db = openIndex(root, false), began = now()
  try {
    db.exec('BEGIN IMMEDIATE')
    const meta = db.prepare('SELECT * FROM meta WHERE id=1').get()
    if (meta.lease_until > began) { db.exec('COMMIT'); return { status: 'busy', indexRevision: meta.revision } }
    db.prepare('UPDATE meta SET lease_until=? WHERE id=1').run(began + 15_000)
    for (const entry of SCAN_ROOTS) {
      if (existsSync(path.join(root, entry))) db.prepare(`INSERT INTO queue(logical_path,cursor,priority) VALUES(?,?,?)
        ON CONFLICT(logical_path) DO UPDATE SET priority=excluded.priority`).run(entry, '', Number.MAX_SAFE_INTEGER)
    }
    let migrationExamined = 0
    for (const pending of db.prepare('SELECT logical_path FROM queue WHERE priority=0 AND logical_path NOT IN (?,?) LIMIT 2000').all(...SCAN_ROOTS)) {
      if (migrationExamined >= maxEntries || now() - began >= maxMs) break
      migrationExamined++
      try { db.prepare('UPDATE queue SET priority=? WHERE logical_path=?').run(Math.trunc((await stat(path.join(root, pending.logical_path))).mtimeMs), pending.logical_path) }
      catch { /* An inaccessible queued directory is removed by the scanner. */ }
    }
    db.exec('COMMIT')
    let examined = migrationExamined, changed = 0
    while (examined < maxEntries && now() - began < maxMs) {
      const job = db.prepare('SELECT * FROM queue ORDER BY priority DESC,logical_path LIMIT 1').get()
      if (!job) break
      let directory
      try { directory = await realpath(path.join(root, job.logical_path)) } catch {
        db.prepare('DELETE FROM queue WHERE logical_path=?').run(job.logical_path); continue
      }
      // The registered runtime junction is accepted only through safePath;
      // entries and descendants cannot escape its physical directory.
      let rootPhysical
      try { rootPhysical = await realpath(path.join(root, job.logical_path.split('/').slice(0, 2).join('/'))) } catch {
        db.prepare('DELETE FROM queue WHERE logical_path=?').run(job.logical_path); continue
      }
      if (!within(rootPhysical, directory)) { db.prepare('DELETE FROM queue WHERE logical_path=?').run(job.logical_path); continue }
      let entries
      try { entries = (await readdir(directory, { withFileTypes: true })).filter(entry => !entry.isSymbolicLink()).sort((a, b) => a.name.localeCompare(b.name)) }
      catch { db.prepare('DELETE FROM queue WHERE logical_path=?').run(job.logical_path); continue }
      const remaining = maxEntries - examined, selected = entries.filter(entry => entry.name > job.cursor).slice(0, remaining)
      let last = null
      for (const entry of selected) {
        examined++
        last = entry.name
        const logical = `${job.logical_path}/${entry.name}`
        if (entry.isDirectory()) {
          const priority = Math.trunc((await stat(path.join(directory, entry.name))).mtimeMs)
          db.prepare('INSERT OR IGNORE INTO queue(logical_path,cursor,priority) VALUES(?,?,?)').run(logical, '', priority)
          db.prepare('INSERT OR IGNORE INTO directories(logical_path) VALUES(?)').run(logical)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          try {
            const data = await bytes(root, logical, 8 * 1024 * 1024)
            const source = await validateSource(root, logical, data.value, data.sha256)
            if (source) {
              const old = db.prepare('SELECT content_sha,status,reason_code FROM sources WHERE logical_path=?').get(logical)
              if (!old || old.content_sha !== source.contentSha || old.status !== source.status || old.reason_code !== source.reasonCode) changed++
              db.prepare(`INSERT INTO sources VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(logical_path) DO UPDATE SET
                content_sha=excluded.content_sha,run_id=excluded.run_id,kind=excluded.kind,terminal_path=excluded.terminal_path,terminal_sha=excluded.terminal_sha,
                parent_path=excluded.parent_path,parent_sha=excluded.parent_sha,status=excluded.status,reason_code=excluded.reason_code,discovered_at=excluded.discovered_at`)
                .run(logical, source.contentSha, source.runId, source.kind, source.terminalPath, source.terminalSha,
                  source.parentPath, source.parentSha, source.status, source.reasonCode, new Date(now()).toISOString())
            }
          } catch { /* A changed, over-limit or inaccessible source remains untrusted. */ }
        }
        if (now() - began >= maxMs) break
      }
      if (!last || entries.every(entry => entry.name <= last)) {
        db.prepare('DELETE FROM queue WHERE logical_path=?').run(job.logical_path)
        db.prepare('INSERT INTO directories(logical_path,last_scanned) VALUES(?,?) ON CONFLICT(logical_path) DO UPDATE SET last_scanned=excluded.last_scanned').run(job.logical_path, now())
      } else db.prepare('UPDATE queue SET cursor=? WHERE logical_path=?').run(last, job.logical_path)
    }
    db.exec('BEGIN IMMEDIATE')
    const complete = db.prepare('SELECT COUNT(*) AS n FROM queue').get().n === 0
    db.prepare('UPDATE meta SET revision=revision+?,scanned_at=?,lease_until=0,complete=? WHERE id=1')
      .run(changed ? 1 : 0, new Date(now()).toISOString(), complete ? 1 : 0)
    db.exec('COMMIT')
    return { status: 'scanned', examined, changed, complete, elapsedMs: now() - began }
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    db.prepare('UPDATE meta SET lease_until=0 WHERE id=1').run()
    throw error
  } finally { db.close() }
}

export function readHistoryEvidenceIndex(root = process.cwd(), runId = null) {
  const db = openIndex(root, true)
  if (!db) return { dataStatus: 'not_connected', reasonCode: 'history_index_not_started', indexRevision: null, sources: [],
    coverage: { scope: 'registered_hot_and_cold_roots_only', roots: SCAN_ROOTS, complete: false, scannedAtUtc: null } }
  try {
    const meta = db.prepare('SELECT * FROM meta WHERE id=1').get()
    if (!meta || meta.schema !== 'ai_console_training_history_index_v1') throw new Error('history_index_schema_conflict')
    const rows = runId ? db.prepare('SELECT * FROM sources WHERE run_id=? ORDER BY kind,logical_path LIMIT 129').all(runId)
      : db.prepare('SELECT * FROM sources ORDER BY discovered_at DESC LIMIT 2049').all()
    if (runId && rows.length > 128) throw new Error('history_index_run_source_limit')
    const listLimitReached = !runId && rows.length > 2048
    const partialSourceCount = db.prepare('SELECT COUNT(*) AS n FROM sources WHERE status<>?').get('verified').n
    return { dataStatus: listLimitReached || partialSourceCount ? 'partial' : 'connected',
      reasonCode: listLimitReached ? 'history_index_list_limit' : partialSourceCount ? 'history_index_partial_sources' : null, indexRevision: meta.revision,
      sources: rows.slice(0, 2048).map(row => ({ logicalPath: row.logical_path, sha256: row.content_sha, runId: row.run_id, kind: row.kind,
        terminalBinding: row.terminal_path ? { path: row.terminal_path, sha256: row.terminal_sha } : null,
        parentBinding: { path: row.parent_path, sha256: row.parent_sha }, status: row.status, reasonCode: row.reason_code,
        discoveredAtUtc: row.discovered_at })),
      coverage: { scope: 'registered_hot_and_cold_roots_only', roots: SCAN_ROOTS.filter(entry => existsSync(path.join(root, entry))),
        complete: meta.complete === 1 && !listLimitReached && partialSourceCount === 0,
        partialSourceCount, scannedAtUtc: meta.scanned_at } }
  } finally { db.close() }
}

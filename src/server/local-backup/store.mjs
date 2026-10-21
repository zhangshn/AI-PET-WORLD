import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ModuleError, need, hash, parseJournal, dateKey, pageQuery, identity } from './contracts.mjs'

const schema = 'local_backup_store_v1'
const tableNames = ['backup_entries', 'backup_runs', 'daily_record_revisions', 'daily_records', 'module_meta', 'work_events']
export function safeFile(file, maxBytes) {
  const s = fs.lstatSync(file)
  need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= maxBytes, 'store_file_boundary', 409)
  return s
}
export function checkDirectory(root) {
  const s = fs.lstatSync(root)
  need(s.isDirectory() && !s.isSymbolicLink() && path.resolve(fs.realpathSync(root)).toLowerCase() === path.resolve(root).toLowerCase(), 'store_root_boundary', 409)
}
export function initializeStore(root, inventory) {
  need(!fs.existsSync(root), 'store_already_exists', 409)
  fs.mkdirSync(root, { recursive: false })
  try {
    checkDirectory(root)
    fs.mkdirSync(path.join(root, 'inventory'))
    const bytes = Buffer.from(JSON.stringify(inventory))
    need(bytes.length <= 256 * 1024, 'inventory_limit')
    fs.writeFileSync(path.join(root, 'inventory', 'initial-v1.json'), bytes, { flag: 'wx' })
    const db = new DatabaseSync(path.join(root, 'module.sqlite'))
    try {
      db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
        CREATE TABLE module_meta (id INTEGER PRIMARY KEY CHECK(id=1), schema_version TEXT NOT NULL, revision INTEGER NOT NULL, inventory_sha TEXT NOT NULL, created_at_utc TEXT NOT NULL);
        CREATE TABLE backup_runs (backup_id TEXT PRIMARY KEY, state TEXT NOT NULL, started_at_utc TEXT, finished_at_utc TEXT, elapsed_ms REAL, coverage TEXT NOT NULL, verification_status TEXT NOT NULL, restorability_status TEXT NOT NULL, failure_code TEXT);
        CREATE TABLE backup_entries (backup_id TEXT NOT NULL REFERENCES backup_runs(backup_id), root_id TEXT NOT NULL, relative_path TEXT NOT NULL, byte_size INTEGER, capture_status TEXT NOT NULL, PRIMARY KEY(backup_id,root_id,relative_path));
        CREATE TABLE daily_records (record_date TEXT PRIMARY KEY, revision INTEGER NOT NULL, completed_text TEXT NOT NULL, plan_text TEXT NOT NULL, backup_id TEXT REFERENCES backup_runs(backup_id), updated_at_utc TEXT NOT NULL, sha TEXT NOT NULL);
        CREATE TABLE daily_record_revisions (record_date TEXT NOT NULL, revision INTEGER NOT NULL, completed_text TEXT NOT NULL, plan_text TEXT NOT NULL, backup_id TEXT, updated_at_utc TEXT NOT NULL, previous_sha TEXT, sha TEXT NOT NULL, PRIMARY KEY(record_date,revision));
        CREATE TABLE work_events (event_id TEXT PRIMARY KEY, producer_id TEXT NOT NULL, producer_sequence INTEGER NOT NULL, module_id TEXT NOT NULL, task_id TEXT NOT NULL, event_at_utc TEXT, work_date TEXT, payload_json TEXT NOT NULL, sha TEXT NOT NULL, UNIQUE(producer_id,producer_sequence));
        CREATE INDEX work_date_module ON work_events(work_date,module_id);`)
      db.prepare('INSERT INTO module_meta VALUES (1,?,?,?,?)').run(schema, 0, hash(bytes), new Date().toISOString())
    } finally { db.close() }
  } catch {
    // Keep failed initialization bytes for diagnosis; never erase or silently reinitialize.
    throw new ModuleError('store_initialization_failed', 409)
  }
}
export function createStore(root) {
  function open(write = false) {
    if (!fs.existsSync(root)) throw new ModuleError('module_store_not_initialized', 503)
    checkDirectory(root)
    const file = path.join(root, 'module.sqlite')
    safeFile(file, 128 * 1024 * 1024)
    for (const name of ['module.sqlite-journal', 'module.sqlite-wal', 'module.sqlite-shm']) {
      const f = path.join(root, name)
      // This module uses rollback journaling; outstanding journal recovery requires an explicit writer.
      need(!fs.existsSync(f), 'store_recovery_required', 409)
    }
    let db
    try {
      db = new DatabaseSync(file, { readOnly: !write })
      db.exec('PRAGMA busy_timeout=1500; PRAGMA foreign_keys=ON;')
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(x => x.name)
      need(JSON.stringify(names) === JSON.stringify(tableNames), 'store_schema_conflict', 409)
      need(db.prepare('PRAGMA quick_check').get().quick_check === 'ok', 'store_integrity_conflict', 409)
      const meta = db.prepare('SELECT * FROM module_meta WHERE id=1').get()
      need(meta?.schema_version === schema && Number.isSafeInteger(meta.revision) && meta.revision >= 0, 'store_metadata_conflict', 409)
      return db
    } catch (e) { db?.close(); if (e instanceof ModuleError) throw e; throw new ModuleError('module_store_unreadable', 503) }
  }
  function read(fn) {
    const db = open()
    try { db.exec('BEGIN'); const meta = db.prepare('SELECT * FROM module_meta WHERE id=1').get(); return fn(db, meta) }
    finally { db.close() }
  }
  function write(fn) {
    const db = open(true)
    try { db.exec('BEGIN IMMEDIATE'); const result = fn(db); db.exec('COMMIT'); return result }
    catch (e) { try { db.exec('ROLLBACK') } catch {} throw e }
    finally { db.close() }
  }
  function journalFrom(db, date) {
    const row = db.prepare('SELECT * FROM daily_records WHERE record_date=?').get(date)
    if (!row) return null
    const revisions = db.prepare('SELECT * FROM daily_record_revisions WHERE record_date=? ORDER BY revision').all(date)
    need(revisions.length === row.revision, 'journal_integrity_conflict', 409)
    let previousSha = null
    for (let i=0;i<revisions.length;i++) {
      const item=revisions[i]
      need(item.revision===i+1 && item.previous_sha===previousSha && journalHash(item)===item.sha, 'journal_integrity_conflict',409)
      previousSha=item.sha
    }
    const latest = revisions.at(-1)
    need(latest && journalHash(latest) === row.sha && latest.sha === row.sha, 'journal_integrity_conflict', 409)
    for (const key of ['completed_text', 'plan_text', 'backup_id', 'updated_at_utc']) need(row[key] === latest[key], 'journal_integrity_conflict', 409)
    return { date, revision: row.revision, completedText: row.completed_text, planText: row.plan_text, backupId: row.backup_id, updatedAtUtc: row.updated_at_utc, sourceCategory: 'human' }
  }
  return {
    read, write,
    inventory() { return read((db, meta) => {
      const folder = path.join(root, 'inventory'); checkDirectory(folder)
      const f = path.join(folder, 'initial-v1.json'); safeFile(f, 256 * 1024)
      const bytes = fs.readFileSync(f)
      need(hash(bytes) === meta.inventory_sha, 'inventory_hash_conflict', 409)
      let value
      try { value = JSON.parse(bytes.toString()) } catch { throw new ModuleError('inventory_invalid', 409) }
      need(value.schemaVersion === 'local_backup_inventory_v1', 'inventory_schema_conflict', 409)
      return { ...value, inventorySha256: meta.inventory_sha, moduleRevision: meta.revision }
    }) },
    journal(date) { dateKey(date); return read(db => journalFrom(db, date)) },
    saveJournal(raw) {
      const input = parseJournal(raw)
      return write(db => {
        const previous = journalFrom(db, input.date)
        need((previous?.revision ?? 0) === input.expectedRevision, 'journal_revision_conflict', 409)
        if (input.backupId !== null) need(db.prepare('SELECT backup_id FROM backup_runs WHERE backup_id=?').get(input.backupId), 'backup_association_missing', 409)
        const previousSha = db.prepare('SELECT sha FROM daily_records WHERE record_date=?').get(input.date)?.sha ?? null
        const row = { record_date: input.date, revision: input.expectedRevision + 1, completed_text: input.completedText, plan_text: input.planText, backup_id: input.backupId, updated_at_utc: new Date().toISOString(), previous_sha: previousSha }
        const sha = journalHash(row)
        db.prepare('INSERT INTO daily_record_revisions VALUES (?,?,?,?,?,?,?,?)').run(row.record_date, row.revision, row.completed_text, row.plan_text, row.backup_id, row.updated_at_utc, previousSha, sha)
        db.prepare('INSERT INTO daily_records VALUES (?,?,?,?,?,?,?) ON CONFLICT(record_date) DO UPDATE SET revision=excluded.revision,completed_text=excluded.completed_text,plan_text=excluded.plan_text,backup_id=excluded.backup_id,updated_at_utc=excluded.updated_at_utc,sha=excluded.sha').run(row.record_date, row.revision, row.completed_text, row.plan_text, row.backup_id, row.updated_at_utc, sha)
        db.exec('UPDATE module_meta SET revision=revision+1 WHERE id=1')
        return journalFrom(db, input.date)
      })
    },
    runs(search) { return read((db, meta) => {
      const page = pageQuery(search, [], meta.revision, 'runs')
      const total = db.prepare('SELECT COUNT(*) AS n FROM backup_runs').get().n
      const records = db.prepare('SELECT * FROM backup_runs ORDER BY backup_id LIMIT ? OFFSET ?').all(page.limit, page.offset)
      return { records, total, revision: meta.revision, nextCursor: page.offset + records.length < total ? page.next(page.offset + records.length) : null }
    }) },
    run(id) { identity(id); return read(db => db.prepare('SELECT * FROM backup_runs WHERE backup_id=?').get(id) ?? null) },
    entries(id, search) { identity(id); return read((db, meta) => {
      need(db.prepare('SELECT backup_id FROM backup_runs WHERE backup_id=?').get(id), 'backup_not_found', 404)
      const page = pageQuery(search, [], meta.revision, `entries:${id}`)
      const total = db.prepare('SELECT COUNT(*) AS n FROM backup_entries WHERE backup_id=?').get(id).n
      const records = db.prepare('SELECT * FROM backup_entries WHERE backup_id=? ORDER BY root_id,relative_path LIMIT ? OFFSET ?').all(id, page.limit, page.offset)
      return { records, total, revision: meta.revision, nextCursor: page.offset + records.length < total ? page.next(page.offset + records.length) : null }
    }) },
  }
}
function journalHash(row) {
  return hash([row.record_date, row.revision, row.completed_text, row.plan_text, row.backup_id, row.updated_at_utc, row.previous_sha])
}

import { createRequire } from "node:module"
import { readdir, realpath, stat } from "node:fs/promises"
import path from "node:path"
import {
  aiPetWorldCatalogPath,
  aiPetWorldPhysicalRuntimeRoot,
  aiPetWorldRuntimeRoot,
} from "@/server/ai-pet-world-storage"

type SqliteStatement = {
  all: (...parameters: unknown[]) => Array<Record<string, unknown>>
  get: (...parameters: unknown[]) => Record<string, unknown> | undefined
  run: (...parameters: unknown[]) => unknown
}

type SqliteDatabase = {
  close: () => void
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
}

const require = createRequire(import.meta.url)

function openCatalog(readOnly = true): SqliteDatabase | null {
  let database: SqliteDatabase | null = null
  try {
    const sqlite = require("node:sqlite") as {
      DatabaseSync: new (fileName: string, options?: { readOnly?: boolean }) => SqliteDatabase
    }
    database = new sqlite.DatabaseSync(aiPetWorldCatalogPath, { readOnly })
    database.exec("PRAGMA busy_timeout=5000")
    return database
  } catch {
    try { database?.close() } catch { /* Preserve the existing unavailable-catalog fallback. */ }
    return null
  }
}

export function readIndexedTrainingProcessLedger(limit = 80) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("training_ledger_limit_invalid")
  const database = openCatalog()
  if (!database) return null
  try {
    database.exec("BEGIN")
    const countRows = database.prepare(`
      SELECT status, COUNT(*) AS count
      FROM program_events
      GROUP BY status
    `).all()
    const totalRow = database.prepare(`SELECT COUNT(*) AS count FROM program_events`).get()
    const latestRows = database.prepare(`
      SELECT event_json
      FROM program_events
      ORDER BY timestamp_utc DESC
      LIMIT ?
    `).all(limit)
    const latestEventRow = database.prepare(`
      SELECT timestamp_utc, event_json
      FROM program_events
      ORDER BY timestamp_utc DESC
      LIMIT 1
    `).get()
    const events = latestRows.flatMap((row) => parseEvent(row.event_json))
    const lastEvent = latestEventRow ? parseEvent(latestEventRow.event_json)[0] ?? null : null
    const invalidIndexedEvent = events.length !== latestRows.length || Boolean(latestEventRow && !lastEvent)
    const summary = {
      total: numberValue(totalRow?.count),
      running: 0,
      success: 0,
      failed: 0,
      error: 0,
      blocked: 0,
      info: 0,
      lastEvent,
    }
    let invalidIndexedStatus = false
    for (const row of countRows) {
      const status = String(row.status ?? "") as keyof typeof summary
      if (Object.hasOwn(summary, status) && status !== "lastEvent" && status !== "total") summary[status] = numberValue(row.count) as never
      else invalidIndexedStatus = true
    }
    const integrityError = invalidIndexedEvent ? "training_ledger_index_event_invalid"
      : invalidIndexedStatus ? "training_ledger_index_status_invalid" : null
    database.exec("COMMIT")
    return {
      schemaVersion: "ai-painter-training-process-ledger-v1" as const,
      updatedAt: typeof latestEventRow?.timestamp_utc === "string" ? latestEventRow.timestamp_utc : null,
      events,
      summary,
      integrityStatus: integrityError ? "degraded" as const : "complete" as const,
      integrityError,
    }
  } finally {
    database.close()
  }
}

export function indexTrainingProcessEvent(event: Record<string, unknown>) {
  if (typeof event.id !== "string" || typeof event.timestamp !== "string") return false
  const database = openCatalog(false)
  if (!database) return false
  try {
    database.prepare(`
      INSERT INTO program_events(event_id, timestamp_utc, action, run_id, kind, status, title, title_zh, evidence_path, event_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET
        timestamp_utc=excluded.timestamp_utc,
        action=excluded.action,
        run_id=excluded.run_id,
        kind=excluded.kind,
        status=excluded.status,
        title=excluded.title,
        title_zh=excluded.title_zh,
        evidence_path=excluded.evidence_path,
        event_json=excluded.event_json
    `).run(
      event.id,
      event.timestamp,
      stringOrNull(event.action),
      stringOrNull(event.runId),
      stringOrNull(event.kind),
      stringOrNull(event.status),
      stringOrNull(event.title),
      stringOrNull(event.titleZh),
      stringOrNull(event.evidencePath),
      JSON.stringify(event),
    )
    return true
  } finally {
    database.close()
  }
}

export async function indexRuntimeArtifactPaths(inputs: string[], runId: string | null = null) {
  const database = openCatalog(false)
  if (!database) return { indexed: 0, skipped: inputs.length }
  let indexed = 0
  let skipped = 0
  try {
    const statement = database.prepare(`
      INSERT INTO artifacts(logical_path, physical_uri, storage_layer, run_id, artifact_type, byte_size, modified_at_utc, sha256, migration_id, indexed_at_utc)
      VALUES (?, ?, 'hot', ?, ?, ?, ?, NULL, NULL, ?)
      ON CONFLICT(logical_path) DO UPDATE SET
        physical_uri=excluded.physical_uri,
        storage_layer=excluded.storage_layer,
        run_id=COALESCE(excluded.run_id, artifacts.run_id),
        artifact_type=excluded.artifact_type,
        byte_size=excluded.byte_size,
        modified_at_utc=excluded.modified_at_utc,
        sha256=NULL,
        indexed_at_utc=excluded.indexed_at_utc
    `)
    for (const input of inputs) {
      const files = await collectRuntimeFiles(input)
      if (files.length === 0) skipped += 1
      for (const file of files) {
        const info = await runtimeArtifactStat(file)
        const relative = path.relative(aiPetWorldRuntimeRoot, file)
        const logicalPath = path.posix.join(".runtime", relative.split(path.sep).join("/"))
        const physicalUri = path.join(aiPetWorldPhysicalRuntimeRoot, relative)
        statement.run(
          logicalPath,
          physicalUri,
          runId,
          artifactType(file),
          info.size,
          info.mtime.toISOString(),
          new Date().toISOString(),
        )
        indexed += 1
      }
    }
    return { indexed, skipped }
  } finally {
    database.close()
  }
}

export function listIndexedChildDirectories(logicalRoot: string, limit = 200) {
  const database = openCatalog()
  if (!database) return null
  const prefix = `${logicalRoot.replace(/\\/g, "/").replace(/\/$/, "")}/`
  const upperBound = `${prefix}\uffff`
  try {
    return database.prepare(`
      WITH scoped AS (
        SELECT substr(logical_path, ? + 1) AS rest, modified_at_utc
        FROM artifacts
        WHERE logical_path >= ? AND logical_path < ?
      )
      SELECT substr(rest, 1, instr(rest, '/') - 1) AS name,
             MAX(modified_at_utc) AS modified_at_utc
      FROM scoped
      WHERE instr(rest, '/') > 0
      GROUP BY name
      ORDER BY modified_at_utc DESC
      LIMIT ?
    `).all(prefix.length, prefix, upperBound, limit).flatMap((row) => {
      if (typeof row.name !== "string" || typeof row.modified_at_utc !== "string") return []
      return [{ name: row.name, modifiedAt: row.modified_at_utc }]
    })
  } finally {
    database.close()
  }
}

export function listLatestIndexedArtifacts(logicalRoot: string, limit = 500) {
  const database = openCatalog()
  if (!database) return null
  const prefix = `${logicalRoot.replace(/\\/g, "/").replace(/\/$/, "")}/`
  const upperBound = `${prefix}\uffff`
  try {
    return database.prepare(`
      SELECT logical_path, modified_at_utc
      FROM artifacts
      WHERE logical_path >= ? AND logical_path < ?
      ORDER BY modified_at_utc DESC
      LIMIT ?
    `).all(prefix, upperBound, limit).flatMap((row) => {
      if (typeof row.logical_path !== "string" || typeof row.modified_at_utc !== "string") return []
      return [{ path: row.logical_path, name: path.posix.basename(row.logical_path), modifiedAt: row.modified_at_utc }]
    })
  } finally {
    database.close()
  }
}

function parseEvent(value: unknown): Record<string, unknown>[] {
  if (typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? [parsed as Record<string, unknown>] : []
  } catch {
    return []
  }
}

function numberValue(value: unknown) {
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : Number(value ?? 0)
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null
}

async function runtimeArtifactStat(absolute: string) {
  const relative = path.relative(aiPetWorldRuntimeRoot, absolute)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("runtime_artifact_path_outside_root")
  }
  const physicalRoot = await realpath(aiPetWorldPhysicalRuntimeRoot)
  const expected = path.join(physicalRoot, relative)
  if (path.relative(physicalRoot, await realpath(aiPetWorldRuntimeRoot)) !== ""
    || path.relative(expected, await realpath(absolute)) !== "") {
    throw new Error("runtime_artifact_path_redirected")
  }
  const info = await stat(absolute)
  if (path.relative(expected, await realpath(absolute)) !== "") {
    throw new Error("runtime_artifact_path_redirected")
  }
  return info
}

async function collectRuntimeFiles(input: string): Promise<string[]> {
  const absolute = path.resolve(input)
  const relative = path.relative(aiPetWorldRuntimeRoot, absolute)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return []
  try {
    const info = await runtimeArtifactStat(absolute)
    if (info.isFile()) return [absolute]
    if (!info.isDirectory()) return []
    const files: string[] = []
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const child = path.join(absolute, entry.name)
      if (entry.isSymbolicLink()) throw new Error("runtime_artifact_path_redirected")
      if (entry.isFile()) files.push(child)
      else if (entry.isDirectory()) files.push(...await collectRuntimeFiles(child))
    }
    return files
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return []
    throw error
  }
}

function artifactType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image"
  if ([".pt", ".pth", ".ckpt", ".safetensors"].includes(extension)) return "checkpoint"
  if ([".json", ".jsonl"].includes(extension)) return "record"
  if ([".log", ".txt"].includes(extension)) return "log"
  return "file"
}

import { createRequire } from "node:module"
import { readdir, stat } from "node:fs/promises"
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
  try {
    const sqlite = require("node:sqlite") as {
      DatabaseSync: new (fileName: string, options?: { readOnly?: boolean }) => SqliteDatabase
    }
    const database = new sqlite.DatabaseSync(aiPetWorldCatalogPath, { readOnly })
    database.exec("PRAGMA busy_timeout=5000")
    return database
  } catch {
    return null
  }
}

export function readIndexedTrainingProcessLedger(limit = 80) {
  const database = openCatalog()
  if (!database) return null
  try {
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
    for (const row of countRows) {
      const status = String(row.status ?? "") as keyof typeof summary
      if (status in summary && status !== "lastEvent" && status !== "total") summary[status] = numberValue(row.count) as never
    }
    return {
      schemaVersion: "ai-painter-training-process-ledger-v1" as const,
      updatedAt: typeof latestEventRow?.timestamp_utc === "string" ? latestEventRow.timestamp_utc : null,
      events,
      summary,
    }
  } finally {
    database.close()
  }
}

export function indexTrainingProcessEvent(event: Record<string, unknown>) {
  const database = openCatalog(false)
  if (!database || typeof event.id !== "string" || typeof event.timestamp !== "string") return false
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
        indexed_at_utc=excluded.indexed_at_utc
    `)
    for (const input of inputs) {
      const files = await collectRuntimeFiles(input)
      if (files.length === 0) skipped += 1
      for (const file of files) {
        const info = await stat(file)
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
    return parsed && typeof parsed === "object" ? [parsed as Record<string, unknown>] : []
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

async function collectRuntimeFiles(input: string): Promise<string[]> {
  const absolute = path.resolve(input)
  const relative = path.relative(aiPetWorldRuntimeRoot, absolute)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return []
  try {
    const info = await stat(absolute)
    if (info.isFile()) return [absolute]
    if (!info.isDirectory()) return []
    const files: string[] = []
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const child = path.join(absolute, entry.name)
      if (entry.isFile()) files.push(child)
      else if (entry.isDirectory()) files.push(...await collectRuntimeFiles(child))
    }
    return files
  } catch {
    return []
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

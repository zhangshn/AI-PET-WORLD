import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { catalogPath, ensureStorageRoots } from "./ai-pet-world-storage.mjs"

let database = null

export function openStorageCatalog() {
  if (database) return database
  ensureStorageRoots()
  database = new DatabaseSync(catalogPath)
  database.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS storage_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migration_runs (
      migration_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      source_root TEXT NOT NULL,
      destination_root TEXT NOT NULL,
      started_at_utc TEXT NOT NULL,
      finished_at_utc TEXT,
      source_file_count INTEGER NOT NULL DEFAULT 0,
      source_bytes INTEGER NOT NULL DEFAULT 0,
      destination_file_count INTEGER NOT NULL DEFAULT 0,
      destination_bytes INTEGER NOT NULL DEFAULT 0,
      verified_file_count INTEGER NOT NULL DEFAULT 0,
      mismatch_count INTEGER NOT NULL DEFAULT 0,
      manifest_sha256 TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      run_type TEXT,
      status TEXT,
      logical_root TEXT,
      physical_root TEXT,
      started_at_utc TEXT,
      finished_at_utc TEXT,
      storage_layer TEXT NOT NULL DEFAULT 'hot',
      updated_at_utc TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      logical_path TEXT PRIMARY KEY,
      physical_uri TEXT NOT NULL,
      storage_layer TEXT NOT NULL,
      run_id TEXT,
      artifact_type TEXT,
      byte_size INTEGER NOT NULL,
      modified_at_utc TEXT NOT NULL,
      sha256 TEXT,
      migration_id TEXT,
      indexed_at_utc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS artifacts_run_id_idx ON artifacts(run_id);
    CREATE INDEX IF NOT EXISTS artifacts_modified_idx ON artifacts(modified_at_utc DESC);
    CREATE INDEX IF NOT EXISTS artifacts_storage_layer_idx ON artifacts(storage_layer);
    CREATE TABLE IF NOT EXISTS program_events (
      event_id TEXT PRIMARY KEY,
      timestamp_utc TEXT NOT NULL,
      action TEXT,
      run_id TEXT,
      kind TEXT,
      status TEXT,
      title TEXT,
      title_zh TEXT,
      evidence_path TEXT,
      event_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS program_events_timestamp_idx ON program_events(timestamp_utc DESC);
    CREATE INDEX IF NOT EXISTS program_events_run_id_idx ON program_events(run_id);
    CREATE INDEX IF NOT EXISTS program_events_status_idx ON program_events(status);
    CREATE TABLE IF NOT EXISTS migration_file_checks (
      migration_id TEXT NOT NULL,
      logical_path TEXT NOT NULL,
      source_bytes INTEGER NOT NULL,
      source_modified_ms INTEGER NOT NULL,
      source_sha256 TEXT NOT NULL,
      destination_bytes INTEGER,
      destination_modified_ms INTEGER,
      destination_sha256 TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      PRIMARY KEY (migration_id, logical_path)
    );
    CREATE INDEX IF NOT EXISTS migration_checks_verified_idx ON migration_file_checks(migration_id, verified);
  `)
  upsertStorageMeta("schema_version", "ai-pet-world-storage-catalog-v1")
  upsertStorageMeta("catalog_path", path.resolve(catalogPath))
  return database
}

export function upsertStorageMeta(key, value) {
  const db = database ?? openStorageCatalog()
  db.prepare(`
    INSERT INTO storage_meta(key, value, updated_at_utc) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at_utc=excluded.updated_at_utc
  `).run(key, String(value), new Date().toISOString())
}

export function indexProgramEvent(event) {
  const db = openStorageCatalog()
  db.prepare(`
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
    event.action ?? null,
    event.runId ?? null,
    event.kind ?? null,
    event.status ?? null,
    event.title ?? null,
    event.titleZh ?? null,
    event.evidencePath ?? null,
    JSON.stringify(event),
  )
}

export function indexArtifact(input) {
  const db = openStorageCatalog()
  db.prepare(`
    INSERT INTO artifacts(logical_path, physical_uri, storage_layer, run_id, artifact_type, byte_size, modified_at_utc, sha256, migration_id, indexed_at_utc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(logical_path) DO UPDATE SET
      physical_uri=excluded.physical_uri,
      storage_layer=excluded.storage_layer,
      run_id=excluded.run_id,
      artifact_type=excluded.artifact_type,
      byte_size=excluded.byte_size,
      modified_at_utc=excluded.modified_at_utc,
      sha256=COALESCE(excluded.sha256, artifacts.sha256),
      migration_id=COALESCE(excluded.migration_id, artifacts.migration_id),
      indexed_at_utc=excluded.indexed_at_utc
  `).run(
    input.logicalPath,
    input.physicalUri,
    input.storageLayer ?? "hot",
    input.runId ?? null,
    input.artifactType ?? artifactType(input.logicalPath),
    input.byteSize,
    input.modifiedAtUtc,
    input.sha256 ?? null,
    input.migrationId ?? null,
    new Date().toISOString(),
  )
}

export function closeStorageCatalog() {
  if (!database) return
  database.close()
  database = null
}

export function inferRunId(logicalPath) {
  const parts = logicalPath.replace(/\\/g, "/").split("/")
  const runtimeIndex = parts.indexOf("ai-painter")
  if (runtimeIndex >= 0 && parts.length > runtimeIndex + 2) return parts[runtimeIndex + 2]
  return null
}

function artifactType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image"
  if ([".pt", ".pth", ".ckpt", ".safetensors"].includes(extension)) return "checkpoint"
  if ([".json", ".jsonl"].includes(extension)) return "record"
  if ([".log", ".txt"].includes(extension)) return "log"
  return "file"
}

export function catalogFileExists() {
  return fs.existsSync(catalogPath)
}

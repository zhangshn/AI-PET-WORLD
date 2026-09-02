/**
 * Explicit production Runtime Store.
 *
 * This adapter is file-backed on purpose: the physical root is supplied by
 * deployment configuration, while all callers still use the Runtime Store
 * protocol. It provides exclusive per-world writes, compare-and-set ticks,
 * atomic fsync+rename records and a hash-bound latest index.
 */
import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import { mkdir, open, readFile, rename, rm } from "node:fs/promises"
import path from "node:path"

import type {
  WorldRuntimeSaveRecord,
  WorldRuntimeStoreAdapter,
  WorldRuntimeStoreReadResult,
  WorldRuntimeStoreWriteResult,
} from "./world-runtime-schema"
import {
  assertRuntimePath,
  assertRuntimePathSegment,
} from "./runtime-path-security"

const LATEST_FILE = "latest-world.json"

export function createProductionWorldRuntimeStore(runtimeRoot: string): WorldRuntimeStoreAdapter {
  const root = path.resolve(runtimeRoot)
  return {
    kind: "configured_file_runtime_store",
    getDefaultSavePath: () => path.join(root, LATEST_FILE),
    read: async (input) => readRecord(root, input?.filePath),
    write: async (input) => writeRecord(root, input),
  }
}

async function readRecord(root: string, requestedPath?: string): Promise<WorldRuntimeStoreReadResult> {
  let recordPath: string | null
  try {
    recordPath = requestedPath
      ? await assertRuntimePath(requestedPath, root)
      : await readLatestPath(root)
  } catch (error) {
    return failureRead(requestedPath ?? path.join(root, LATEST_FILE), "invalid", "runtime_path_rejected", error)
  }
  if (!recordPath) {
    return {
      status: "empty", record: null, path: path.join(root, LATEST_FILE),
      message: "No runtime save record found.", warnings: [],
      tags: ["world_runtime_store_read", "empty"],
    }
  }
  try {
    const parsed = JSON.parse(await readFile(recordPath, "utf8")) as Partial<WorldRuntimeSaveRecord>
    if (!isRuntimeRecord(parsed)) {
      return failureRead(recordPath, "invalid", "runtime_record_schema_invalid")
    }
    return {
      status: "found", record: parsed, path: recordPath,
      message: "Runtime save record loaded from configured production store.", warnings: [],
      tags: ["world_runtime_store_read", "found", "configured_production_store"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return { status: "empty", record: null, path: recordPath, message: "No runtime save record found.", warnings: [], tags: ["world_runtime_store_read", "empty"] }
    }
    return failureRead(recordPath, "failed", "runtime_store_read_failed", error)
  }
}

async function writeRecord(root: string, input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
  expectedTick?: number
}): Promise<WorldRuntimeStoreWriteResult> {
  // Resolve both explicit and derived paths through the same physical-root
  // guard.  The derived per-world path is also attacker-controlled through
  // persisted identity fields, and must not bypass symlink/reparse checks.
  const candidatePath = input.filePath
    ? input.filePath
    : recordPathFor(root, input.record)
  const recordPath = await assertRuntimePath(candidatePath, root)
  const lockPath = `${recordPath}.lock`
  let lock: Awaited<ReturnType<typeof open>> | null = null
  try {
    validateRecord(input.record)
    await mkdir(path.dirname(recordPath), { recursive: true })
    try {
      lock = await open(lockPath, "wx")
      await lock.writeFile(`${JSON.stringify({
        schemaVersion: "world-runtime-write-lock-v1", pid: process.pid,
        host: hostname(), worldId: input.record.worldId, ownerId: input.record.ownerId,
        createdAtUtc: new Date().toISOString(),
      })}\n`, "utf8")
      await lock.sync()
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
        return { ok: false, code: "conflict", path: recordPath,
          message: "Another runtime writer owns this world.", warnings: ["runtime_write_lock_exists"],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict"] }
      }
      throw error
    }
    if (input.expectedTick !== undefined) {
      const current = await readExisting(recordPath)
      if (current && current.tick !== input.expectedTick) {
        return { ok: false, code: "conflict", path: recordPath,
          message: "Runtime tick compare-and-set rejected a stale writer.",
          warnings: [`expected_tick:${input.expectedTick}`, `actual_tick:${current.tick}`],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict", "runtime_tick_cas_rejected"] }
      }
    }
    await writeAtomic(recordPath, input.record)
    if (!input.filePath) await writeAtomic(path.join(root, LATEST_FILE), {
      schemaVersion: "world-runtime-latest-index-v1", ownerId: input.record.ownerId,
      worldId: input.record.worldId, tick: input.record.tick,
      path: recordPath, recordSha256: sha256Json(input.record), updatedAtUtc: input.record.savedAt,
    })
    return { ok: true, path: recordPath, message: "Runtime save record written.", warnings: [], tags: ["world_runtime_store_write", "ok", "configured_production_store"] }
  } catch (error) {
    return { ok: false, code: "persistence_error", path: recordPath,
      message: "Runtime save record was not written.", warnings: [message(error)], tags: ["world_runtime_store_write", "failed", "old_save_preserved"] }
  } finally {
    if (lock) await lock.close().catch(() => {})
    await rm(lockPath, { force: true }).catch(() => {})
  }
}

async function readLatestPath(root: string): Promise<string | null> {
  try {
    const index = JSON.parse(await readFile(path.join(root, LATEST_FILE), "utf8")) as Partial<{
      path: string; ownerId: string; worldId: string; tick: number; recordSha256: string
    }>
    if (typeof index.path !== "string" || typeof index.ownerId !== "string" || typeof index.worldId !== "string" || !/^[a-f0-9]{64}$/u.test(index.recordSha256 ?? "")) return null
    const target = await assertRuntimePath(index.path, root)
    if (target !== recordPathFor(root, { ownerId: index.ownerId, worldId: index.worldId } as WorldRuntimeSaveRecord)) throw new Error("latest index identity mismatch")
    const parsed = await readExisting(target)
    if (!parsed || sha256Json(parsed) !== index.recordSha256 || parsed.tick !== index.tick) throw new Error("latest index record hash mismatch")
    return target
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function readExisting(filePath: string): Promise<WorldRuntimeSaveRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<WorldRuntimeSaveRecord>
    return isRuntimeRecord(parsed) ? parsed : null
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function writeAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  const handle = await open(temp, "wx")
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8"); await handle.sync() }
  finally { await handle.close().catch(() => {}) }
  await rename(temp, filePath)
}

function recordPathFor(root: string, record: Pick<WorldRuntimeSaveRecord, "ownerId" | "worldId">): string {
  assertRuntimePathSegment(record.ownerId, "ownerId"); assertRuntimePathSegment(record.worldId, "worldId")
  return path.resolve(root, record.ownerId, `${record.worldId}.json`)
}

function validateRecord(record: WorldRuntimeSaveRecord): void {
  if (!isRuntimeRecord(record)) throw new Error("runtime record schema invalid")
  if (record.homeMapState.worldId !== record.worldId || record.homeMapState.ownerId !== record.ownerId) throw new Error("runtime identity mismatch")
}

function isRuntimeRecord(value: Partial<WorldRuntimeSaveRecord>): value is WorldRuntimeSaveRecord {
  return value.version === "v2.6-runtime-00" && typeof value.worldId === "string" && typeof value.ownerId === "string" && typeof value.tick === "number" && Number.isInteger(value.tick) && value.tick >= 0 && typeof value.savedAt === "string" && Boolean(value.homeMapState) && Array.isArray(value.recentEvents) && Array.isArray(value.tags)
}

function sha256Json(value: unknown): string { return createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`, "utf8").digest("hex") }
function failureRead(filePath: string, status: "invalid" | "failed", tag: string, error?: unknown): WorldRuntimeStoreReadResult { return { status, record: null, path: filePath, message: tag, warnings: error ? [message(error)] : [], tags: ["world_runtime_store_read", status, tag] } }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function isNodeFileError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error }

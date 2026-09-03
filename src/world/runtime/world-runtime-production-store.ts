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
import { mkdir, open, readFile, rename, rm, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
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
    read: async (input) => readRecord(root, input),
    write: async (input) => writeRecord(root, input),
  }
}

async function readRecord(root: string, input?: { filePath?: string; ownerId?: string; worldId?: string }): Promise<WorldRuntimeStoreReadResult> {
  const requestedPath = input?.filePath
  let recordPath: string | null
  try {
    recordPath = requestedPath
      ? await assertRuntimePath(requestedPath, root)
      : input?.ownerId && input?.worldId
      ? await assertRuntimePath(recordPathFor(root, { ownerId: input.ownerId, worldId: input.worldId }), root)
        : input?.worldId
          ? await resolveWorldRuntimeSavePathByWorldId(root, input.worldId)
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
    const transaction = await readTransactionJournal(`${recordPath}.transaction.json`)
    if (transaction?.state === "prepared") {
      return failureRead(recordPath, "invalid", "runtime_transaction_incomplete")
    }
    const parsed = JSON.parse(await readFile(recordPath, "utf8")) as Partial<WorldRuntimeSaveRecord>
    if (!isRuntimeRecord(parsed)) {
      return failureRead(recordPath, "invalid", "runtime_record_schema_invalid")
    }
    if ((input?.worldId && parsed.worldId !== input.worldId) || (input?.ownerId && parsed.ownerId !== input.ownerId)) {
      return failureRead(recordPath, "invalid", "runtime_requested_identity_mismatch")
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

async function resolveWorldRuntimeSavePathByWorldId(root: string, worldId: string): Promise<string | null> {
  assertRuntimePathSegment(worldId, "worldId")
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, `${worldId}.json`))
    .filter((candidate) => existsSync(candidate))
  if (matches.length > 1) throw new Error("runtime_world_id_ambiguous")
  return matches[0] ? assertRuntimePath(matches[0], root) : null
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
  const lockToken = randomUUID()
  try {
    validateRecord(input.record)
    await mkdir(path.dirname(recordPath), { recursive: true })
    try {
      lock = await open(lockPath, "wx")
      await lock.writeFile(`${JSON.stringify({
        schemaVersion: "world-runtime-write-lock-v1", pid: process.pid,
        host: hostname(), worldId: input.record.worldId, ownerId: input.record.ownerId,
        lockToken,
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
    const transactionPath = `${recordPath}.transaction.json`
    await writeAtomic(transactionPath, {
      schemaVersion: "world-runtime-transaction-v1", state: "prepared",
      recordPath, latestPath: input.filePath ? null : path.join(root, LATEST_FILE),
      worldId: input.record.worldId, tick: input.record.tick,
      createdAtUtc: new Date().toISOString(),
    })
    await writeAtomic(recordPath, input.record)
    if (!input.filePath) await writeAtomic(path.join(root, LATEST_FILE), {
      schemaVersion: "world-runtime-latest-index-v1", ownerId: input.record.ownerId,
      worldId: input.record.worldId, tick: input.record.tick,
      path: recordPath, recordSha256: sha256Json(input.record), updatedAtUtc: input.record.savedAt,
    })
    await writeAtomic(transactionPath, {
      schemaVersion: "world-runtime-transaction-v1", state: "committed",
      recordPath, latestPath: input.filePath ? null : path.join(root, LATEST_FILE),
      worldId: input.record.worldId, tick: input.record.tick,
      committedAtUtc: new Date().toISOString(),
    })
    await rm(transactionPath, { force: true })
    return { ok: true, path: recordPath, message: "Runtime save record written.", warnings: [], tags: ["world_runtime_store_write", "ok", "configured_production_store"] }
  } catch (error) {
    return { ok: false, code: "persistence_error", path: recordPath,
      message: "Runtime save record was not written.", warnings: [message(error)], tags: ["world_runtime_store_write", "failed", "old_save_preserved"] }
  } finally {
    if (lock) await lock.close().catch(() => {})
    if (lock) await releaseOwnedLock(lockPath, lockToken)
  }
}

async function releaseOwnedLock(lockPath: string, lockToken: string): Promise<void> {
  try {
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as { lockToken?: unknown }
    if (lock.lockToken === lockToken) await rm(lockPath, { force: true })
  } catch (error) {
    if (!(isNodeFileError(error) && error.code === "ENOENT")) return
  }
}

async function readTransactionJournal(filePath: string): Promise<{ state?: string } | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as { state?: string }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
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
  const tick = value.tick
  if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0) return false
  const homeMapState = value.homeMapState
  if (!isHomeMapStateShape(homeMapState)) return false
  const recentEvents = value.recentEvents
  if (!isWorldRuntimeEventLogArray(recentEvents)) return false
  return value.version === "v2.6-runtime-00" && isNonEmptyIdentity(value.worldId) && isNonEmptyIdentity(value.ownerId) && isIsoTimestamp(value.savedAt) && Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string") && homeMapState.worldId === value.worldId && homeMapState.ownerId === value.ownerId && recentEvents.every((event) => event.tick >= 0 && event.tick <= tick)
}

function isNonEmptyIdentity(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 }
function isIsoTimestamp(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)) }
function isHomeMapStateShape(value: unknown): value is WorldRuntimeSaveRecord["homeMapState"] {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<WorldRuntimeSaveRecord["homeMapState"]>
  return isNonEmptyIdentity(record.worldId) && isNonEmptyIdentity(record.ownerId) && isNonEmptyIdentity(record.seed) && Boolean(record.mapSize) && Array.isArray(record.zones) && Array.isArray(record.placements) && Boolean(record.resources) && Array.isArray(record.constructionPlans) && Array.isArray(record.mapDiffs) && typeof record.createdAt === "number" && typeof record.updatedAt === "number" && Number.isFinite(record.createdAt) && Number.isFinite(record.updatedAt) && record.updatedAt >= record.createdAt && Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string")
}
function isWorldRuntimeEventLogArray(value: unknown): value is WorldRuntimeSaveRecord["recentEvents"] {
  return Array.isArray(value) && value.every((event) => Boolean(event) && typeof event === "object" && typeof (event as { id?: unknown }).id === "string" && Number.isInteger((event as { tick?: unknown }).tick) && (event as { tick: number }).tick >= 0 && typeof (event as { title?: unknown }).title === "string" && typeof (event as { body?: unknown }).body === "string" && ["runtime", "butler", "construction", "safe_apply", "audit"].includes(String((event as { source?: unknown }).source)) && isIsoTimestamp((event as { createdAt?: unknown }).createdAt) && Array.isArray((event as { tags?: unknown }).tags) && (event as { tags: unknown[] }).tags.every((tag) => typeof tag === "string"))
}

function sha256Json(value: unknown): string { return createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`, "utf8").digest("hex") }
function failureRead(filePath: string, status: "invalid" | "failed", tag: string, error?: unknown): WorldRuntimeStoreReadResult { return { status, record: null, path: filePath, message: tag, warnings: error ? [message(error)] : [], tags: ["world_runtime_store_read", status, tag] } }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function isNodeFileError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error }

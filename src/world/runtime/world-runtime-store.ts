/**
 * Local runtime-only file store for the live world runtime.
 *
 * Server-side adapter implementation. Formal runtime code should import
 * world-runtime-store-adapter instead of depending on this implementation.
 */

import { mkdir, open, readFile, rename, rm, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import path from "node:path"

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  WorldRuntimeEventLog,
  WorldRuntimeSaveRecord,
  WorldRuntimeStoreAdapter,
  WorldRuntimeStoreReadResult,
  WorldRuntimeStoreWriteResult,
} from "./world-runtime-schema"
import {
  assertRuntimePath,
  assertRuntimePathSegment,
} from "./runtime-path-security"

const RUNTIME_DIR = path.join(
  process.cwd(),
  "data",
  "world-runtime"
)
const LATEST_WORLD_FILE = "latest-world.json"

export const localFileRuntimeStore: WorldRuntimeStoreAdapter = {
  kind: "local_file_runtime_store",
  read: (input) => readLocalFileWorldRuntimeSaveRecord(input),
  write: (input) => writeLocalFileWorldRuntimeSaveRecord(input),
  getDefaultSavePath: () => getDefaultLocalFileWorldRuntimeSavePath(),
}

export function getDefaultWorldRuntimeSavePath(): string {
  return localFileRuntimeStore.getDefaultSavePath()
}

export async function readWorldRuntimeSaveRecord(
  input?: { filePath?: string; ownerId?: string; worldId?: string }
): Promise<WorldRuntimeStoreReadResult> {
  return localFileRuntimeStore.read(input)
}

export async function writeWorldRuntimeSaveRecord(input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
  expectedTick?: number
}): Promise<WorldRuntimeStoreWriteResult> {
  return localFileRuntimeStore.write(input)
}

function getDefaultLocalFileWorldRuntimeSavePath(): string {
  return path.join(RUNTIME_DIR, LATEST_WORLD_FILE)
}

async function readLocalFileWorldRuntimeSaveRecord(
  input?: { filePath?: string; ownerId?: string; worldId?: string }
): Promise<WorldRuntimeStoreReadResult> {
  const resolvedFilePath = input?.filePath
    ? await assertRuntimePath(input.filePath, RUNTIME_DIR)
    : input?.ownerId && input?.worldId
      ? await assertRuntimePath(getWorldRuntimeSavePath({ ownerId: input.ownerId, worldId: input.worldId } as WorldRuntimeSaveRecord), RUNTIME_DIR)
      : input?.worldId
        ? await resolveWorldRuntimeSavePathByWorldId(input.worldId)
      : await resolveLatestWorldRuntimeSavePath()

  if (!resolvedFilePath) {
    return {
      status: "empty",
      record: null,
      path: getDefaultLocalFileWorldRuntimeSavePath(),
      message: "No runtime save record found.",
      warnings: [],
      tags: ["world_runtime_store_read", "empty"],
    }
  }

  try {
    const transactionPath = `${resolvedFilePath}.transaction.json`
    const transaction = await readTransactionJournal(transactionPath)
    if (transaction?.state === "prepared") {
      return {
        status: "invalid",
        record: null,
        path: resolvedFilePath,
        message: "Runtime save has an unfinished multi-file transaction.",
        warnings: ["runtime_transaction_incomplete"],
        tags: ["world_runtime_store_read", "invalid", "runtime_transaction_incomplete"],
      }
    }
    const raw = await readFile(resolvedFilePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<WorldRuntimeSaveRecord>

    if (!isWorldRuntimeSaveRecord(parsed)) {
      return {
        status: "invalid",
        record: null,
        path: resolvedFilePath,
        message: "Runtime save record exists but is not valid.",
        warnings: ["Invalid runtime save record shape."],
        tags: ["world_runtime_store_read", "invalid"],
      }
    }
    if ((input?.worldId && parsed.worldId !== input.worldId) || (input?.ownerId && parsed.ownerId !== input.ownerId)) {
      return {
        status: "invalid",
        record: null,
        path: resolvedFilePath,
        message: "Runtime save identity does not match the requested world.",
        warnings: ["runtime_requested_identity_mismatch"],
        tags: ["world_runtime_store_read", "invalid", "runtime_requested_identity_mismatch"],
      }
    }

    return {
      status: "found",
      record: parsed,
      path: resolvedFilePath,
      message: "Runtime save record loaded.",
      warnings: [],
      tags: ["world_runtime_store_read", "found"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: resolvedFilePath,
        message: "No runtime save record found.",
        warnings: [],
        tags: ["world_runtime_store_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: resolvedFilePath,
      message: "Runtime save record could not be read.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_runtime_store_read", "failed"],
    }
  }
}

async function resolveWorldRuntimeSavePathByWorldId(worldId: string): Promise<string | null> {
  assertRuntimePathSegment(worldId, "worldId")
  let entries
  try {
    entries = await readdir(RUNTIME_DIR, { withFileTypes: true })
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(RUNTIME_DIR, entry.name, `${worldId}.json`))
    .filter((candidate) => existsSync(candidate))
  if (matches.length > 1) throw new Error("runtime_world_id_ambiguous")
  return matches[0] ? assertRuntimePath(matches[0], RUNTIME_DIR) : null
}

async function writeLocalFileWorldRuntimeSaveRecord(input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
  expectedTick?: number
}): Promise<WorldRuntimeStoreWriteResult> {
  const filePath = await assertRuntimePath(
    input.filePath ?? getWorldRuntimeSavePath(input.record),
    RUNTIME_DIR,
  )
  const lockPath = `${filePath}.lock`
  let lock: Awaited<ReturnType<typeof open>> | null = null
  const lockToken = randomUUID()

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    try {
      lock = await open(lockPath, "wx")
      await lock.writeFile(`${JSON.stringify({
        schemaVersion: "world-runtime-write-lock-v1",
        pid: process.pid,
        host: hostname(),
        ownerId: input.record.ownerId,
        worldId: input.record.worldId,
        lockToken,
        createdAtUtc: new Date().toISOString(),
      })}\n`, "utf8")
      await lock.sync()
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
        return {
          ok: false,
          code: "conflict",
          path: filePath,
          message: "Another runtime writer currently owns this world.",
          warnings: ["runtime_write_lock_exists"],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict"],
        }
      }
      throw error
    }
    if (input.expectedTick !== undefined) {
      const existing = await readExistingRuntimeRecord(filePath)
      if (existing && existing.tick !== input.expectedTick) {
        return {
          ok: false,
          code: "conflict",
          path: filePath,
          message: "Runtime tick compare-and-set rejected the stale writer.",
          warnings: [`expected_tick:${input.expectedTick}`, `actual_tick:${existing.tick}`],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict", "runtime_tick_cas_rejected"],
        }
      }
    }
    const transactionPath = `${filePath}.transaction.json`
    await writeTransactionJournal(transactionPath, {
      schemaVersion: "world-runtime-transaction-v1",
      state: "prepared",
      recordPath: filePath,
      latestPath: input.filePath ? null : getDefaultLocalFileWorldRuntimeSavePath(),
      worldId: input.record.worldId,
      tick: input.record.tick,
      createdAtUtc: new Date().toISOString(),
    })
    await writeJsonAtomic(filePath, input.record)
    if (!input.filePath) {
      await writeLatestWorldRuntimeIndex({
        record: input.record,
        filePath,
      })
    }
    await writeTransactionJournal(transactionPath, {
      schemaVersion: "world-runtime-transaction-v1",
      state: "committed",
      recordPath: filePath,
      latestPath: input.filePath ? null : getDefaultLocalFileWorldRuntimeSavePath(),
      worldId: input.record.worldId,
      tick: input.record.tick,
      committedAtUtc: new Date().toISOString(),
    })
    await rm(transactionPath, { force: true })

    return {
      ok: true,
      path: filePath,
      message: "Runtime save record written.",
      warnings: [],
      tags: ["world_runtime_store_write", "ok"],
    }
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      message: "Runtime save record was not overwritten.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_runtime_store_write", "failed", "old_save_preserved"],
    }
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

async function writeTransactionJournal(filePath: string, value: unknown): Promise<void> {
  await writeJsonAtomic(filePath, value)
}

async function readTransactionJournal(filePath: string): Promise<{ state?: string } | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as { state?: string }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function readExistingRuntimeRecord(filePath: string): Promise<WorldRuntimeSaveRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<WorldRuntimeSaveRecord>
    return isWorldRuntimeSaveRecord(parsed) ? parsed : null
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await mkdir(path.dirname(filePath), { recursive: true })
  const handle = await open(tempPath, "wx")
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    await handle.sync()
  } finally {
    await handle.close().catch(() => {})
  }
  await rename(tempPath, filePath)
}

function getWorldRuntimeSavePath(record: WorldRuntimeSaveRecord): string {
  return path.join(RUNTIME_DIR, record.ownerId, `${record.worldId}.json`)
}

async function resolveLatestWorldRuntimeSavePath(): Promise<string | null> {
  try {
    const indexPath = await assertRuntimePath(
      getDefaultLocalFileWorldRuntimeSavePath(),
      RUNTIME_DIR,
    )
    const raw = await readFile(indexPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<{
      path: string
      ownerId: string
      worldId: string
      tick: number
      recordSha256: string
    }>

    if (
      typeof parsed.path !== "string" ||
      typeof parsed.ownerId !== "string" ||
      typeof parsed.worldId !== "string" ||
      !Number.isInteger(parsed.tick) ||
      !/^[a-f0-9]{64}$/u.test(parsed.recordSha256 ?? "")
    ) return null

    assertRuntimePathSegment(parsed.ownerId, "ownerId")
    assertRuntimePathSegment(parsed.worldId, "worldId")
    const resolved = await assertRuntimePath(parsed.path, RUNTIME_DIR)
    if (resolved !== getWorldRuntimeSavePath({ ownerId: parsed.ownerId, worldId: parsed.worldId } as WorldRuntimeSaveRecord)) return null
    const record = await readExistingRuntimeRecord(resolved)
    if (!record || record.ownerId !== parsed.ownerId || record.worldId !== parsed.worldId || record.tick !== parsed.tick || sha256Json(record) !== parsed.recordSha256) return null
    return resolved
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return null
    }

    throw error
  }
}

async function writeLatestWorldRuntimeIndex(input: {
  record: WorldRuntimeSaveRecord
  filePath: string
}): Promise<void> {
  const indexPath = await assertRuntimePath(
    getDefaultLocalFileWorldRuntimeSavePath(),
    RUNTIME_DIR,
  )
  const index = {
    schemaVersion: "world-runtime-latest-index-v1",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    tick: input.record.tick,
    path: input.filePath,
    recordSha256: sha256Json(input.record),
    updatedAt: input.record.savedAt,
  }

  await writeJsonAtomic(indexPath, index)
}

function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    .digest("hex")
}

function isWorldRuntimeSaveRecord(
  value: Partial<WorldRuntimeSaveRecord>
): value is WorldRuntimeSaveRecord {
  const tick = value.tick
  if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0) return false
  const homeMapState = value.homeMapState
  if (!isHomeMapStateShape(homeMapState)) return false
  const recentEvents = value.recentEvents
  if (!isWorldRuntimeEventLogArray(recentEvents)) return false
  return (
    value.version === "v2.6-runtime-00" &&
    isNonEmptyIdentity(value.worldId) &&
    isNonEmptyIdentity(value.ownerId) &&
    Number.isInteger(tick) && tick >= 0 &&
    isIsoTimestamp(value.savedAt) &&
    Boolean(value.butlerProfile) &&
    Boolean(value.butlerRuntimeProfile) &&
    Boolean(value.butlerBirthInput) &&
    typeof value.butlerMappingMode === "string" &&
    Boolean(value.butlerConstructionStyle) &&
    typeof value.worldCreationStyleSource === "string" &&
    isHomeMapStateShape(homeMapState) &&
    isWorldRuntimeEventLogArray(recentEvents) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    homeMapState.worldId === value.worldId &&
    homeMapState.ownerId === value.ownerId &&
    recentEvents.every((event) => event.tick >= 0 && event.tick <= tick)
  )
}

function isNonEmptyIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function isHomeMapStateShape(value: unknown): value is HomeMapState {
  if (!value || typeof value !== "object") return false

  const record = value as Partial<HomeMapState>

  return (
    typeof record.worldId === "string" &&
    typeof record.ownerId === "string" &&
    typeof record.seed === "string" &&
    isHomeMapSizeShape(record.mapSize) &&
    Array.isArray(record.zones) &&
    Array.isArray(record.placements) &&
    isHomeResourceStateShape(record.resources) &&
    Array.isArray(record.constructionPlans) &&
    Array.isArray(record.mapDiffs) &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.createdAt) &&
    Number.isFinite(record.updatedAt) &&
    record.updatedAt >= record.createdAt &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string")
  )
}

function isHomeMapSizeShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false

  const record = value as Partial<HomeMapState["mapSize"]>

  return (
    typeof record.columns === "number" &&
    typeof record.rows === "number" &&
    typeof record.tileSize === "number"
  )
}

function isHomeResourceStateShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false

  const record = value as Partial<HomeMapState["resources"]>

  return (
    typeof record.groundHealth === "number" &&
    typeof record.naturalGrowth === "number" &&
    typeof record.materialReadiness === "number" &&
    typeof record.careReadiness === "number" &&
    typeof record.spacePressure === "number" &&
    Array.isArray(record.tags)
  )
}

function isWorldRuntimeEventLogArray(
  value: unknown
): value is WorldRuntimeEventLog[] {
  return Array.isArray(value) && value.every(isWorldRuntimeEventLogShape)
}

function isWorldRuntimeEventLogShape(
  value: unknown
): value is WorldRuntimeEventLog {
  if (!value || typeof value !== "object") return false

  const record = value as Partial<WorldRuntimeEventLog>

  return (
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.tick === "number" && Number.isInteger(record.tick) && record.tick >= 0 &&
    typeof record.title === "string" &&
    typeof record.body === "string" &&
    (record.source === "runtime" || record.source === "butler" || record.source === "construction" || record.source === "safe_apply" || record.source === "audit") &&
    isIsoTimestamp(record.createdAt) &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string")
  )
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

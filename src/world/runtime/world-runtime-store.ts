/**
 * Local runtime-only file store for the live world runtime.
 *
 * Server-side adapter implementation. Formal runtime code should import
 * world-runtime-store-adapter instead of depending on this implementation.
 */

import { mkdir, open, readFile, rename, rm } from "node:fs/promises"
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
  read: (input) => readLocalFileWorldRuntimeSaveRecord(input?.filePath),
  write: (input) => writeLocalFileWorldRuntimeSaveRecord(input),
  getDefaultSavePath: () => getDefaultLocalFileWorldRuntimeSavePath(),
}

export function getDefaultWorldRuntimeSavePath(): string {
  return localFileRuntimeStore.getDefaultSavePath()
}

export async function readWorldRuntimeSaveRecord(
  filePath?: string
): Promise<WorldRuntimeStoreReadResult> {
  return localFileRuntimeStore.read({ filePath })
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
  filePath?: string
): Promise<WorldRuntimeStoreReadResult> {
  const resolvedFilePath = filePath
    ? await assertRuntimePath(filePath, RUNTIME_DIR)
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
    await writeJsonAtomic(filePath, input.record)
    if (!input.filePath) {
      await writeLatestWorldRuntimeIndex({
        record: input.record,
        filePath,
      })
    }

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
    await rm(lockPath, { force: true }).catch(() => {})
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
  return (
    value.version === "v2.6-runtime-00" &&
    typeof value.worldId === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.tick === "number" &&
    typeof value.savedAt === "string" &&
    Boolean(value.butlerProfile) &&
    Boolean(value.butlerRuntimeProfile) &&
    Boolean(value.butlerBirthInput) &&
    typeof value.butlerMappingMode === "string" &&
    Boolean(value.butlerConstructionStyle) &&
    typeof value.worldCreationStyleSource === "string" &&
    isHomeMapStateShape(value.homeMapState) &&
    isWorldRuntimeEventLogArray(value.recentEvents) &&
    Array.isArray(value.tags)
  )
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
    Array.isArray(record.tags)
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
    typeof record.id === "string" &&
    typeof record.tick === "number" &&
    typeof record.title === "string" &&
    typeof record.body === "string" &&
    typeof record.source === "string" &&
    typeof record.createdAt === "string" &&
    Array.isArray(record.tags)
  )
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

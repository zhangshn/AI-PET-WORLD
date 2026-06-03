/**
 * Local runtime-only file store for the live world runtime.
 *
 * Server-side adapter implementation. Formal runtime code should import
 * world-runtime-store-adapter instead of depending on this implementation.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  WorldRuntimeEventLog,
  WorldRuntimeSaveRecord,
  WorldRuntimeStoreAdapter,
  WorldRuntimeStoreReadResult,
  WorldRuntimeStoreWriteResult,
} from "./world-runtime-schema"

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
}): Promise<WorldRuntimeStoreWriteResult> {
  return localFileRuntimeStore.write(input)
}

function getDefaultLocalFileWorldRuntimeSavePath(): string {
  return path.join(RUNTIME_DIR, LATEST_WORLD_FILE)
}

async function readLocalFileWorldRuntimeSaveRecord(
  filePath?: string
): Promise<WorldRuntimeStoreReadResult> {
  const resolvedFilePath = filePath ?? (await resolveLatestWorldRuntimeSavePath())

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
}): Promise<WorldRuntimeStoreWriteResult> {
  const filePath = input.filePath ?? getWorldRuntimeSavePath(input.record)
  const tempPath = `${filePath}.tmp`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(input.record, null, 2)}\n`, "utf8")
    await rename(tempPath, filePath)
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
  }
}

function getWorldRuntimeSavePath(record: WorldRuntimeSaveRecord): string {
  return path.join(RUNTIME_DIR, record.ownerId, `${record.worldId}.json`)
}

async function resolveLatestWorldRuntimeSavePath(): Promise<string | null> {
  try {
    const raw = await readFile(getDefaultLocalFileWorldRuntimeSavePath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<{
      path: string
      ownerId: string
      worldId: string
    }>

    if (typeof parsed.path !== "string") return null

    return parsed.path
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
  const indexPath = getDefaultLocalFileWorldRuntimeSavePath()
  const tempPath = `${indexPath}.tmp`
  const index = {
    version: "v2.6-runtime-00",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    path: input.filePath,
    updatedAt: input.record.savedAt,
    tags: ["world_runtime_latest_index"],
  }

  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")
  await rename(tempPath, indexPath)
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

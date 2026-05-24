/**
 * Local MVP-only file store for the live world runtime.
 *
 * Server-side only. Do not import this module from Client Components.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  WorldRuntimeSaveRecord,
  WorldRuntimeStoreReadResult,
  WorldRuntimeStoreWriteResult,
} from "./world-runtime-schema"

const RUNTIME_DIR = path.join(process.cwd(), ".runtime", "world-state")
const DEFAULT_WORLD_FILE = "default-world.json"

export function getDefaultWorldRuntimeSavePath(): string {
  return path.join(RUNTIME_DIR, DEFAULT_WORLD_FILE)
}

export async function readWorldRuntimeSaveRecord(
  filePath = getDefaultWorldRuntimeSavePath()
): Promise<WorldRuntimeStoreReadResult> {
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<WorldRuntimeSaveRecord>

    if (!isWorldRuntimeSaveRecord(parsed)) {
      return {
        status: "invalid",
        record: null,
        path: filePath,
        message: "Runtime save record exists but is not valid.",
        warnings: ["Invalid runtime save record shape."],
        tags: ["world_runtime_store_read", "invalid"],
      }
    }

    return {
      status: "found",
      record: parsed,
      path: filePath,
      message: "Runtime save record loaded.",
      warnings: [],
      tags: ["world_runtime_store_read", "found"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: filePath,
        message: "No runtime save record found.",
        warnings: [],
        tags: ["world_runtime_store_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: filePath,
      message: "Runtime save record could not be read.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_runtime_store_read", "failed"],
    }
  }
}

export async function writeWorldRuntimeSaveRecord(input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
}): Promise<WorldRuntimeStoreWriteResult> {
  const filePath = input.filePath ?? getDefaultWorldRuntimeSavePath()
  const tempPath = `${filePath}.tmp`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(input.record, null, 2)}\n`, "utf8")
    await rename(tempPath, filePath)

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

function isWorldRuntimeSaveRecord(
  value: Partial<WorldRuntimeSaveRecord>
): value is WorldRuntimeSaveRecord {
  return (
    value.version === "v2.6-runtime-00" &&
    typeof value.worldId === "string" &&
    typeof value.ownerId === "string" &&
    typeof value.tick === "number" &&
    typeof value.savedAt === "string" &&
    Boolean(value.homeMapState) &&
    Array.isArray(value.recentEvents) &&
    Array.isArray(value.tags)
  )
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

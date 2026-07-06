import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { GameMapRuntimeFrame } from "./game-map-runtime-frame-schema"
import { isGameMapRuntimeFrame } from "./game-map-runtime-frame-schema"

export type GameMapRuntimeFrameRecord = {
  recordId: string
  ownerId: string
  worldId: string
  tick: number
  sourceFactIds: string[]
  createdAt: string
  runtimeFrame: GameMapRuntimeFrame
  canShowInWorld: boolean
  tags: string[]
}

export type GameMapRuntimeFrameReadResult = {
  status: "found" | "empty" | "invalid" | "failed"
  record: GameMapRuntimeFrameRecord | null
  path: string
  warnings: string[]
  tags: string[]
}

export type GameMapRuntimeFrameWriteResult = {
  status: "written" | "blocked_invalid_runtime_frame" | "failed"
  record: GameMapRuntimeFrameRecord | null
  recordPath: string | null
  latestPath: string
  warnings: string[]
  tags: string[]
}

export async function writeGameMapRuntimeFrameRecord(input: {
  runtimeFrame: GameMapRuntimeFrame
  createdAt?: string
  outputRoot?: string
}): Promise<GameMapRuntimeFrameWriteResult> {
  const latestPath = getLatestGameMapRuntimeFramePath(input.outputRoot)
  if (!isGameMapRuntimeFrame(input.runtimeFrame)) {
    return {
      status: "blocked_invalid_runtime_frame",
      record: null,
      recordPath: null,
      latestPath,
      warnings: ["runtime_frame_schema_invalid"],
      tags: ["game_map_runtime_frame_write", "blocked"],
    }
  }

  const createdAt = input.createdAt ?? new Date().toISOString()
  const record: GameMapRuntimeFrameRecord = {
    recordId: `game-map-runtime-frame-record-${input.runtimeFrame.worldId}-${input.runtimeFrame.tick}-${safeTimestamp(createdAt)}`,
    ownerId: input.runtimeFrame.ownerId,
    worldId: input.runtimeFrame.worldId,
    tick: input.runtimeFrame.tick,
    sourceFactIds: input.runtimeFrame.sourceFactIds,
    createdAt,
    runtimeFrame: input.runtimeFrame,
    canShowInWorld: input.runtimeFrame.worldPageContract.canShowInWorld,
    tags: [
      "game_map_runtime_frame_record",
      input.runtimeFrame.worldPageContract.canShowInWorld
        ? "world_page_ready"
        : "world_page_blocked_until_composite_map",
      "written_from_game_map_runtime_frame",
    ],
  }

  const recordPath = getGameMapRuntimeFrameRecordPath(record, input.outputRoot)

  try {
    await mkdir(getGameMapRuntimeFrameRecordDir(record, input.outputRoot), {
      recursive: true,
    })
    await mkdir(getGameMapRuntimeFrameRoot(input.outputRoot), {
      recursive: true,
    })
    await writeFile(
      /* turbopackIgnore: true */ recordPath,
      JSON.stringify(record, null, 2),
      "utf8"
    )
    await writeFile(
      /* turbopackIgnore: true */ latestPath,
      JSON.stringify(record, null, 2),
      "utf8"
    )

    return {
      status: "written",
      record,
      recordPath,
      latestPath,
      warnings: [],
      tags: ["game_map_runtime_frame_write", "written"],
    }
  } catch (error) {
    return {
      status: "failed",
      record,
      recordPath,
      latestPath,
      warnings: [`game_map_runtime_frame_write_failed:${readErrorCode(error) ?? "unknown"}`],
      tags: ["game_map_runtime_frame_write", "failed"],
    }
  }
}

export async function readLatestGameMapRuntimeFrameRecord(input?: {
  ownerId?: string
  worldId?: string
  currentTick?: number
  currentSourceFactIds?: string[]
  filePath?: string
}): Promise<GameMapRuntimeFrameReadResult> {
  const filePath = input?.filePath ?? getLatestGameMapRuntimeFramePath()

  try {
    const raw = await readFile(/* turbopackIgnore: true */ filePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<GameMapRuntimeFrameRecord>
    const record = normalizeGameMapRuntimeFrameRecord(parsed)

    if (!record) {
      return invalid(filePath, ["game_map_runtime_frame_record_schema_invalid"])
    }

    const warnings = validateCurrentRuntimeFrameRecord(record, input)
    if (warnings.length > 0) {
      return {
        status: "invalid",
        record,
        path: filePath,
        warnings,
        tags: ["game_map_runtime_frame_read", "invalid"],
      }
    }

    return {
      status: "found",
      record,
      path: filePath,
      warnings: [],
      tags: ["game_map_runtime_frame_read", "found"],
    }
  } catch (error) {
    const code = readErrorCode(error)
    if (code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: filePath,
        warnings: ["game_map_runtime_frame_record_missing"],
        tags: ["game_map_runtime_frame_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: filePath,
      warnings: [`game_map_runtime_frame_read_failed:${code ?? "unknown"}`],
      tags: ["game_map_runtime_frame_read", "failed"],
    }
  }
}

function normalizeGameMapRuntimeFrameRecord(
  value: Partial<GameMapRuntimeFrameRecord>
): GameMapRuntimeFrameRecord | null {
  if (
    typeof value.recordId !== "string" ||
    typeof value.ownerId !== "string" ||
    typeof value.worldId !== "string" ||
    !Number.isInteger(value.tick) ||
    !Array.isArray(value.sourceFactIds) ||
    typeof value.createdAt !== "string" ||
    typeof value.canShowInWorld !== "boolean" ||
    !Array.isArray(value.tags) ||
    !isGameMapRuntimeFrame(value.runtimeFrame)
  ) {
    return null
  }

  return value as GameMapRuntimeFrameRecord
}

function validateCurrentRuntimeFrameRecord(
  record: GameMapRuntimeFrameRecord,
  input?: {
    ownerId?: string
    worldId?: string
    currentTick?: number
    currentSourceFactIds?: string[]
  }
): string[] {
  const warnings: string[] = []
  if (input?.ownerId && record.ownerId !== input.ownerId) {
    warnings.push("owner_id_mismatch")
  }
  if (input?.worldId && record.worldId !== input.worldId) {
    warnings.push("world_id_mismatch")
  }
  if (typeof input?.currentTick === "number" && record.tick !== input.currentTick) {
    warnings.push("tick_mismatch")
  }
  if (
    input?.currentSourceFactIds &&
    !sameStringSet(record.sourceFactIds, input.currentSourceFactIds)
  ) {
    warnings.push("source_fact_ids_mismatch")
  }
  if (!record.runtimeFrame.worldPageContract.canShowInWorld) {
    warnings.push("world_page_contract_blocked")
  }
  if (!record.runtimeFrame.tags.includes("composite_game_map_runtime_frame")) {
    warnings.push("composite_game_map_runtime_frame_tag_missing")
  }
  if (!record.runtimeFrame.composition.compositionStatus.canEnterWorld) {
    warnings.push("composition_status_blocks_world")
  }
  if (
    !record.runtimeFrame.composition.tags.includes("composite_game_map_runtime_frame")
  ) {
    warnings.push("composition_manifest_world_tag_missing")
  }
  if (record.runtimeFrame.composition.compositeOutput === null) {
    warnings.push("composition_composite_output_missing")
  }
  if (record.runtimeFrame.worldPageContract.page !== "/world") {
    warnings.push("world_page_contract_mismatch")
  }
  return warnings
}

function invalid(filePath: string, warnings: string[]): GameMapRuntimeFrameReadResult {
  return {
    status: "invalid",
    record: null,
    path: filePath,
    warnings,
    tags: ["game_map_runtime_frame_read", "invalid"],
  }
}

function getGameMapRuntimeFrameRoot(outputRoot?: string): string {
  return outputRoot
    ? outputRoot
    : join(
        /* turbopackIgnore: true */ process.cwd(),
        ".runtime",
        "game-map-runtime-frame"
      )
}

function getLatestGameMapRuntimeFramePath(outputRoot?: string): string {
  return join(
    getGameMapRuntimeFrameRoot(outputRoot),
    "latest-runtime-frame.json"
  )
}

function getGameMapRuntimeFrameRecordDir(
  record: Pick<GameMapRuntimeFrameRecord, "worldId" | "tick">,
  outputRoot?: string
): string {
  return join(getGameMapRuntimeFrameRoot(outputRoot), "records", record.worldId, String(record.tick))
}

function getGameMapRuntimeFrameRecordPath(
  record: Pick<GameMapRuntimeFrameRecord, "worldId" | "tick" | "recordId">,
  outputRoot?: string
): string {
  return join(getGameMapRuntimeFrameRecordDir(record, outputRoot), `${record.recordId}.json`)
}

function readErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === "string" ? code : null
  }
  return null
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function safeTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}

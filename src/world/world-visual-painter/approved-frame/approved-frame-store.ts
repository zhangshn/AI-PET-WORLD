import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  WorldVisualApprovedFrame,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

const APPROVED_FRAME_DIR = path.join(
  process.cwd(),
  "data",
  "world-approved-frames"
)

export type WorldVisualApprovedFrameRecord = {
  version: "world-approved-frame-v1"
  ownerId: string
  worldId: string
  tick: number
  savedAt: string
  approvedFrame: WorldVisualApprovedFrame
  reviewReport: WorldVisualReviewReport
  canShowToPlayer: true
  tags: string[]
}

export type WorldVisualApprovedFrameStoreWriteResult = {
  ok: boolean
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export type WorldVisualApprovedFrameStoreReadResult = {
  status: "found" | "empty" | "invalid" | "failed"
  record: WorldVisualApprovedFrameRecord | null
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export async function writeWorldVisualApprovedFrameRecord(input: {
  ownerId: string
  worldId: string
  tick: number
  approvedFrame: WorldVisualApprovedFrame
  reviewReport: WorldVisualReviewReport
}): Promise<WorldVisualApprovedFrameStoreWriteResult> {
  const record: WorldVisualApprovedFrameRecord = {
    version: "world-approved-frame-v1",
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    savedAt: new Date().toISOString(),
    approvedFrame: input.approvedFrame,
    reviewReport: input.reviewReport,
    canShowToPlayer: true,
    tags: [
      "world_visual_approved_frame_record",
      "player_visible_allowed",
      "visual_review_passed",
    ],
  }
  const filePath = getWorldVisualApprovedFrameRecordPath(record)
  const tempPath = `${filePath}.tmp`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    await rename(tempPath, filePath)
    await writeLatestWorldVisualApprovedFrameIndex({ record, filePath })

    return {
      ok: true,
      path: filePath,
      message: "Approved frame record written.",
      warnings: [],
      tags: ["world_visual_approved_frame_store_write", "ok"],
    }
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      message: "Approved frame record could not be written.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_visual_approved_frame_store_write", "failed"],
    }
  }
}

export async function readLatestWorldVisualApprovedFrameRecord(input: {
  ownerId: string
  worldId: string
}): Promise<WorldVisualApprovedFrameStoreReadResult> {
  const indexPath = getLatestWorldVisualApprovedFrameIndexPath(input)

  try {
    const indexRaw = await readFile(indexPath, "utf8")
    const index = JSON.parse(indexRaw) as Partial<{ path: string }>
    if (typeof index.path !== "string") {
      return invalidRead(indexPath, "Latest approved frame index is invalid.")
    }

    const raw = await readFile(index.path, "utf8")
    const parsed = JSON.parse(raw) as Partial<WorldVisualApprovedFrameRecord>
    if (!isWorldVisualApprovedFrameRecord(parsed)) {
      return invalidRead(index.path, "Approved frame record shape is invalid.")
    }

    return {
      status: "found",
      record: parsed,
      path: index.path,
      message: "Approved frame record loaded.",
      warnings: [],
      tags: ["world_visual_approved_frame_store_read", "found"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: indexPath,
        message: "No approved frame record found.",
        warnings: [],
        tags: ["world_visual_approved_frame_store_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: indexPath,
      message: "Approved frame record could not be read.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_visual_approved_frame_store_read", "failed"],
    }
  }
}

function getWorldVisualApprovedFrameRecordPath(
  record: WorldVisualApprovedFrameRecord
): string {
  return path.join(
    APPROVED_FRAME_DIR,
    record.ownerId,
    record.worldId,
    `approved-frame-${record.tick}-${safeFileToken(record.approvedFrame.frameId)}.json`
  )
}

function getLatestWorldVisualApprovedFrameIndexPath(input: {
  ownerId: string
  worldId: string
}): string {
  return path.join(
    APPROVED_FRAME_DIR,
    input.ownerId,
    input.worldId,
    "latest-approved-frame.json"
  )
}

async function writeLatestWorldVisualApprovedFrameIndex(input: {
  record: WorldVisualApprovedFrameRecord
  filePath: string
}): Promise<void> {
  const indexPath = getLatestWorldVisualApprovedFrameIndexPath(input.record)
  const tempPath = `${indexPath}.tmp`
  const index = {
    version: "world-approved-frame-index-v1",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    tick: input.record.tick,
    frameId: input.record.approvedFrame.frameId,
    path: input.filePath,
    updatedAt: input.record.savedAt,
    tags: ["world_visual_approved_frame_latest_index"],
  }

  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")
  await rename(tempPath, indexPath)
}

function invalidRead(
  filePath: string,
  message: string
): WorldVisualApprovedFrameStoreReadResult {
  return {
    status: "invalid",
    record: null,
    path: filePath,
    message,
    warnings: [message],
    tags: ["world_visual_approved_frame_store_read", "invalid"],
  }
}

function isWorldVisualApprovedFrameRecord(
  value: Partial<WorldVisualApprovedFrameRecord>
): value is WorldVisualApprovedFrameRecord {
  return (
    value.version === "world-approved-frame-v1" &&
    typeof value.ownerId === "string" &&
    typeof value.worldId === "string" &&
    typeof value.tick === "number" &&
    typeof value.savedAt === "string" &&
    Boolean(value.approvedFrame) &&
    Boolean(value.reviewReport) &&
    value.canShowToPlayer === true &&
    Array.isArray(value.tags)
  )
}

function safeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 96)
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  WorldVisualApprovedFrame,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"
import type { WorldVisualCandidateRecord } from "../ai-image-candidate"

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
  sourceCandidateRecord: WorldVisualCandidateRecord
  sourceAiImageCandidateId: string
  sourcePromptPackageId: string
  sourceAiImageGenerationRequestId: string | null
  sourceControlSketchId: string | null
  sourceVisualFixPlanId: string | null
  sourceVisualFixHintCount: number
  sourceFactIds: string[]
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
  sourceCandidateRecord: WorldVisualCandidateRecord
}): Promise<WorldVisualApprovedFrameStoreWriteResult> {
  const request = input.sourceCandidateRecord.aiImageGenerationRequest
  const record: WorldVisualApprovedFrameRecord = {
    version: "world-approved-frame-v1",
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    savedAt: new Date().toISOString(),
    approvedFrame: input.approvedFrame,
    reviewReport: input.reviewReport,
    sourceCandidateRecord: input.sourceCandidateRecord,
    sourceAiImageCandidateId: input.sourceCandidateRecord.candidate.candidateId,
    sourcePromptPackageId: input.sourceCandidateRecord.promptPackage.packageId,
    sourceAiImageGenerationRequestId: request?.requestId ?? null,
    sourceControlSketchId: request?.body.controlSketch.controlSketchId ?? null,
    sourceVisualFixPlanId: request?.body.metadata.visualFixPlanId ?? null,
    sourceVisualFixHintCount: request?.body.visualFixHints.length ?? 0,
    sourceFactIds: input.sourceCandidateRecord.sourceFactIds,
    canShowToPlayer: true,
    tags: [
      "world_visual_approved_frame_record",
      "player_visible_allowed",
      "visual_review_passed",
      "source_candidate_record_bound",
      request
        ? "ai_image_generation_request_bound"
        : "no_ai_image_generation_request",
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
    const normalized = normalizeWorldVisualApprovedFrameRecord(parsed)
    if (!normalized) {
      return invalidRead(index.path, "Approved frame record shape is invalid.")
    }

    return {
      status: "found",
      record: normalized,
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
    sourceAiImageCandidateId: input.record.sourceAiImageCandidateId,
    sourcePromptPackageId: input.record.sourcePromptPackageId,
    sourceAiImageGenerationRequestId:
      input.record.sourceAiImageGenerationRequestId,
    sourceControlSketchId: input.record.sourceControlSketchId,
    sourceVisualFixPlanId: input.record.sourceVisualFixPlanId,
    sourceVisualFixHintCount: input.record.sourceVisualFixHintCount,
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

function normalizeWorldVisualApprovedFrameRecord(
  value: Partial<WorldVisualApprovedFrameRecord>
): WorldVisualApprovedFrameRecord | null {
  if (
    value.version !== "world-approved-frame-v1" ||
    typeof value.ownerId !== "string" ||
    typeof value.worldId !== "string" ||
    typeof value.tick !== "number" ||
    typeof value.savedAt !== "string" ||
    !value.approvedFrame ||
    !value.reviewReport ||
    !value.sourceCandidateRecord ||
    typeof value.sourceAiImageCandidateId !== "string" ||
    typeof value.sourcePromptPackageId !== "string" ||
    !Array.isArray(value.sourceFactIds) ||
    value.canShowToPlayer !== true ||
    !Array.isArray(value.tags)
  ) {
    return null
  }

  return {
    version: value.version,
    ownerId: value.ownerId,
    worldId: value.worldId,
    tick: value.tick,
    savedAt: value.savedAt,
    approvedFrame: value.approvedFrame,
    reviewReport: value.reviewReport,
    sourceCandidateRecord: value.sourceCandidateRecord,
    sourceAiImageCandidateId: value.sourceAiImageCandidateId,
    sourcePromptPackageId: value.sourcePromptPackageId,
    sourceAiImageGenerationRequestId:
      value.sourceAiImageGenerationRequestId ?? null,
    sourceControlSketchId: value.sourceControlSketchId ?? null,
    sourceVisualFixPlanId: value.sourceVisualFixPlanId ?? null,
    sourceVisualFixHintCount: value.sourceVisualFixHintCount ?? 0,
    sourceFactIds: value.sourceFactIds,
    canShowToPlayer: value.canShowToPlayer,
    tags: value.tags,
  }
}

function safeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 96)
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
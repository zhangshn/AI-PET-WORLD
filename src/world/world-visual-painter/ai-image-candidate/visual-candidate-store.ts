import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  WorldVisualAiImageCandidate,
  WorldVisualFactManifest,
  WorldVisualPromptPackage,
} from "../world-visual-painter-schema"

const VISUAL_CANDIDATE_DIR = path.join(
  process.cwd(),
  "data",
  "world-visual-candidates"
)

export type WorldVisualCandidateRecord = {
  version: "world-visual-candidate-v1"
  ownerId: string
  worldId: string
  tick: number
  savedAt: string
  candidate: WorldVisualAiImageCandidate
  promptPackage: WorldVisualPromptPackage
  sourceFactIds: string[]
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualCandidateStoreWriteResult = {
  ok: boolean
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export type WorldVisualCandidateStoreReadResult = {
  status: "found" | "empty" | "invalid" | "failed"
  record: WorldVisualCandidateRecord | null
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export async function writeWorldVisualCandidateRecord(input: {
  ownerId: string
  worldId: string
  tick: number
  candidate: WorldVisualAiImageCandidate
  promptPackage: WorldVisualPromptPackage
  factManifest: WorldVisualFactManifest
}): Promise<WorldVisualCandidateStoreWriteResult> {
  const record: WorldVisualCandidateRecord = {
    version: "world-visual-candidate-v1",
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    savedAt: new Date().toISOString(),
    candidate: input.candidate,
    promptPackage: input.promptPackage,
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_visual_candidate_record",
      "hidden_candidate",
      "approved_frame_required",
    ],
  }
  const filePath = getWorldVisualCandidateRecordPath(record)
  const tempPath = `${filePath}.tmp`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    await rename(tempPath, filePath)
    await writeLatestWorldVisualCandidateIndex({
      record,
      filePath,
    })

    return {
      ok: true,
      path: filePath,
      message: "Visual candidate record written.",
      warnings: [],
      tags: ["world_visual_candidate_store_write", "ok"],
    }
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      message: "Visual candidate record could not be written.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_visual_candidate_store_write", "failed"],
    }
  }
}

export async function readLatestWorldVisualCandidateRecord(input: {
  ownerId: string
  worldId: string
}): Promise<WorldVisualCandidateStoreReadResult> {
  const indexPath = getLatestWorldVisualCandidateIndexPath(input)

  try {
    const indexRaw = await readFile(indexPath, "utf8")
    const index = JSON.parse(indexRaw) as Partial<{ path: string }>
    if (typeof index.path !== "string") {
      return invalidRead(indexPath, "Latest visual candidate index is invalid.")
    }

    const raw = await readFile(index.path, "utf8")
    const parsed = JSON.parse(raw) as Partial<WorldVisualCandidateRecord>
    if (!isWorldVisualCandidateRecord(parsed)) {
      return invalidRead(index.path, "Visual candidate record shape is invalid.")
    }

    return {
      status: "found",
      record: parsed,
      path: index.path,
      message: "Visual candidate record loaded.",
      warnings: [],
      tags: ["world_visual_candidate_store_read", "found"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: indexPath,
        message: "No visual candidate record found.",
        warnings: [],
        tags: ["world_visual_candidate_store_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: indexPath,
      message: "Visual candidate record could not be read.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_visual_candidate_store_read", "failed"],
    }
  }
}

function getWorldVisualCandidateRecordPath(
  record: WorldVisualCandidateRecord
): string {
  return path.join(
    VISUAL_CANDIDATE_DIR,
    record.ownerId,
    record.worldId,
    `candidate-${record.tick}-${safeFileToken(record.candidate.candidateId)}.json`
  )
}

function getLatestWorldVisualCandidateIndexPath(input: {
  ownerId: string
  worldId: string
}): string {
  return path.join(
    VISUAL_CANDIDATE_DIR,
    input.ownerId,
    input.worldId,
    "latest-candidate.json"
  )
}

async function writeLatestWorldVisualCandidateIndex(input: {
  record: WorldVisualCandidateRecord
  filePath: string
}): Promise<void> {
  const indexPath = getLatestWorldVisualCandidateIndexPath(input.record)
  const tempPath = `${indexPath}.tmp`
  const index = {
    version: "world-visual-candidate-index-v1",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    tick: input.record.tick,
    candidateId: input.record.candidate.candidateId,
    path: input.filePath,
    updatedAt: input.record.savedAt,
    tags: ["world_visual_candidate_latest_index"],
  }

  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")
  await rename(tempPath, indexPath)
}

function invalidRead(
  filePath: string,
  message: string
): WorldVisualCandidateStoreReadResult {
  return {
    status: "invalid",
    record: null,
    path: filePath,
    message,
    warnings: [message],
    tags: ["world_visual_candidate_store_read", "invalid"],
  }
}

function isWorldVisualCandidateRecord(
  value: Partial<WorldVisualCandidateRecord>
): value is WorldVisualCandidateRecord {
  return (
    value.version === "world-visual-candidate-v1" &&
    typeof value.ownerId === "string" &&
    typeof value.worldId === "string" &&
    typeof value.tick === "number" &&
    typeof value.savedAt === "string" &&
    Boolean(value.candidate) &&
    Boolean(value.promptPackage) &&
    Array.isArray(value.sourceFactIds) &&
    value.canShowToPlayer === false &&
    Array.isArray(value.tags)
  )
}

function safeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 96)
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

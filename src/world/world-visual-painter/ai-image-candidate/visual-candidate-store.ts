import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageGenerationRequest,
  WorldVisualFactManifest,
  WorldVisualGenerationCondition,
} from "../world-visual-painter-schema"

const VISUAL_CANDIDATE_DIR = path.join(
  process.cwd(),
  "data",
  "world-visual-candidates"
)

type RuntimeBoundCandidate = WorldVisualAiImageCandidate & {
  worldId: string
  tick: number
}

export type WorldVisualCandidateRecord = {
  version: "world-visual-candidate-v2"
  ownerId: string
  worldId: string
  tick: number
  savedAt: string
  candidate: WorldVisualAiImageCandidate
  generationCondition: WorldVisualGenerationCondition
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
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
  generationCondition: WorldVisualGenerationCondition
  factManifest: WorldVisualFactManifest
  aiImageGenerationRequest?: WorldVisualAiImageGenerationRequest | null
}): Promise<WorldVisualCandidateStoreWriteResult> {
  const aiImageGenerationRequest = input.aiImageGenerationRequest ?? null
  const candidate = bindCandidateToRuntime({
    candidate: input.candidate,
    worldId: input.worldId,
    tick: input.tick,
  })
  const validation = validateCandidateRecordInput({
    ...input,
    candidate,
    aiImageGenerationRequest,
  })
  const filePath = getWorldVisualCandidateRecordPath({
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    candidate,
  })

  if (!validation.ok) {
    return {
      ok: false,
      path: filePath,
      message: "Visual candidate record was blocked by VJ-0 candidate store gate.",
      warnings: validation.warnings,
      tags: [
        "world_visual_candidate_store_write",
        "blocked_by_vj_0_candidate_gate",
        ...validation.tags,
      ],
    }
  }

  const record: WorldVisualCandidateRecord = {
    version: "world-visual-candidate-v2",
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    savedAt: new Date().toISOString(),
    candidate,
    generationCondition: input.generationCondition,
    aiImageGenerationRequest,
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_visual_candidate_record",
      "hidden_candidate",
      "vj_0_candidate_store_gate_passed",
      aiImageGenerationRequest
        ? "ai_image_generation_request_bound"
        : "no_ai_image_generation_request",
      "approved_frame_required",
    ],
  }
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
      tags: [
        "world_visual_candidate_store_write",
        "ok",
        "vj_0_candidate_store_gate_passed",
      ],
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
    const normalized = normalizeWorldVisualCandidateRecord(parsed)
    if (!normalized) {
      return invalidRead(index.path, "Visual candidate record shape is invalid.")
    }

    return {
      status: "found",
      record: normalized,
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

function bindCandidateToRuntime(input: {
  candidate: WorldVisualAiImageCandidate
  worldId: string
  tick: number
}): RuntimeBoundCandidate {
  const tagSet = new Set(input.candidate.tags)
  tagSet.add(`world_id:${input.worldId}`)
  tagSet.add(`tick:${input.tick}`)
  tagSet.add("runtime_bound_candidate")

  return {
    ...input.candidate,
    worldId: input.worldId,
    tick: input.tick,
    tags: Array.from(tagSet),
  }
}

function validateCandidateRecordInput(input: {
  ownerId: string
  worldId: string
  tick: number
  candidate: RuntimeBoundCandidate
  generationCondition: WorldVisualGenerationCondition
  factManifest: WorldVisualFactManifest
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
}): { ok: boolean; warnings: string[]; tags: string[] } {
  const warnings: string[] = []
  const tags = ["vj_0_candidate_store_gate"]

  if (input.ownerId.length === 0) warnings.push("ownerId is required.")
  if (input.worldId.length === 0) warnings.push("worldId is required.")
  if (!Number.isInteger(input.tick) || input.tick < 0) warnings.push("tick must be a non-negative integer.")
  if (input.candidate.canShowToPlayer !== false) warnings.push("candidate.canShowToPlayer must be false.")
  if (input.candidate.worldId !== input.worldId) warnings.push("candidate.worldId must match record worldId.")
  if (input.candidate.tick !== input.tick) warnings.push("candidate.tick must match record tick.")
  if (input.generationCondition.worldId !== input.worldId) warnings.push("generationCondition.worldId must match record worldId.")
  if (input.generationCondition.tick !== input.tick) warnings.push("generationCondition.tick must match record tick.")
  if (input.factManifest.worldId !== input.worldId) warnings.push("factManifest.worldId must match record worldId.")
  if (input.factManifest.tick !== input.tick) warnings.push("factManifest.tick must match record tick.")
  if (input.candidate.conditionId !== input.generationCondition.conditionId) {
    warnings.push("candidate.conditionId must match generationCondition.conditionId.")
  }
  if (!sameStringSet(input.candidate.sourceFactIds, input.factManifest.sourceFactIds)) {
    warnings.push("candidate.sourceFactIds must match factManifest.sourceFactIds.")
  }
  if (!sameStringSet(input.candidate.sourceFactIds, input.generationCondition.sourceFactIds)) {
    warnings.push("candidate.sourceFactIds must match generationCondition.sourceFactIds.")
  }

  if (input.candidate.sourceKind === "project_model_generated") {
    if (!input.candidate.modelVersion) warnings.push("project_model_generated candidate requires modelVersion.")
    if (!input.aiImageGenerationRequest) warnings.push("project_model_generated candidate requires aiImageGenerationRequest.")
    if (
      input.aiImageGenerationRequest &&
      input.aiImageGenerationRequest.condition.conditionId !== input.generationCondition.conditionId
    ) {
      warnings.push("aiImageGenerationRequest.condition must match generationCondition.")
    }
  }

  if (
    input.candidate.sourceKind === "development_test_asset" &&
    process.env.NODE_ENV === "production"
  ) {
    warnings.push("development_test_asset cannot be written in production.")
  }

  return {
    ok: warnings.length === 0,
    warnings,
    tags: [...tags, warnings.length === 0 ? "passed" : "failed"],
  }
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function getWorldVisualCandidateRecordPath(input: {
  ownerId: string
  worldId: string
  tick: number
  candidate: WorldVisualAiImageCandidate
}): string {
  return path.join(
    VISUAL_CANDIDATE_DIR,
    input.ownerId,
    input.worldId,
    `candidate-${input.tick}-${safeFileToken(input.candidate.candidateId)}.json`
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
    candidateWorldId: readRuntimeBoundCandidate(input.record.candidate).worldId,
    candidateTick: readRuntimeBoundCandidate(input.record.candidate).tick,
    hasAiImageGenerationRequest: Boolean(input.record.aiImageGenerationRequest),
    path: input.filePath,
    updatedAt: input.record.savedAt,
    tags: [
      "world_visual_candidate_latest_index",
      "vj_0_candidate_store_gate_passed",
    ],
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

function normalizeWorldVisualCandidateRecord(
  value: Partial<WorldVisualCandidateRecord>
): WorldVisualCandidateRecord | null {
  if (
    value.version !== "world-visual-candidate-v2" ||
    typeof value.ownerId !== "string" ||
    typeof value.worldId !== "string" ||
    typeof value.tick !== "number" ||
    typeof value.savedAt !== "string" ||
    !value.candidate ||
    !value.generationCondition ||
    !Array.isArray(value.sourceFactIds) ||
    value.canShowToPlayer !== false ||
    !Array.isArray(value.tags)
  ) {
    return null
  }

  const candidate = bindCandidateToRuntime({
    candidate: value.candidate,
    worldId: value.worldId,
    tick: value.tick,
  })

  return {
    version: value.version,
    ownerId: value.ownerId,
    worldId: value.worldId,
    tick: value.tick,
    savedAt: value.savedAt,
    candidate,
    generationCondition: value.generationCondition,
    aiImageGenerationRequest: value.aiImageGenerationRequest ?? null,
    sourceFactIds: value.sourceFactIds,
    canShowToPlayer: value.canShowToPlayer,
    tags: value.tags,
  }
}

function readRuntimeBoundCandidate(
  candidate: WorldVisualAiImageCandidate
): RuntimeBoundCandidate {
  return candidate as RuntimeBoundCandidate
}

function safeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 96)
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

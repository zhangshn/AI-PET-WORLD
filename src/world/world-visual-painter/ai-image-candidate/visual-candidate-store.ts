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
      "current_runtime_gate_required_on_read",
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
    await writeLatestWorldVisualCandidateIndex({ record, filePath })

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
  currentTick: number
  currentSourceFactIds: string[]
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

    const validation = validateCandidateRecordRead(normalized)
    const currentGateWarnings = validateCurrentRuntimeBinding(normalized, input)
    const warnings = [...validation.warnings, ...currentGateWarnings]
    if (!validation.ok || currentGateWarnings.length > 0) {
      return invalidRead(
        index.path,
        "Visual candidate record failed VJ-0 read gate.",
        warnings,
        [
          ...validation.tags,
          currentGateWarnings.length > 0
            ? "current_runtime_binding_failed"
            : "record_shape_binding_failed",
        ]
      )
    }

    return {
      status: "found",
      record: normalized,
      path: index.path,
      message: "Visual candidate record loaded.",
      warnings: [],
      tags: [
        "world_visual_candidate_store_read",
        "found",
        "vj_0_candidate_read_gate_passed",
        "current_tick_gate_passed",
        "current_source_facts_gate_passed",
      ],
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
  if (!input.candidate.tags.includes(`world_id:${input.worldId}`)) warnings.push("candidate must include world_id tag.")
  if (!input.candidate.tags.includes(`tick:${input.tick}`)) warnings.push("candidate must include tick tag.")
  if (!input.candidate.tags.includes("runtime_bound_candidate")) warnings.push("candidate must include runtime_bound_candidate tag.")
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
  if (input.generationCondition.canShowToPlayer !== false) warnings.push("generationCondition.canShowToPlayer must be false.")
  if (input.generationCondition.safetyCondition.preserveWorldFacts !== true) warnings.push("generationCondition must preserve world facts.")
  if (input.generationCondition.safetyCondition.requireVisualJudge !== true) warnings.push("generationCondition must require VisualJudge.")
  if (input.generationCondition.safetyCondition.forbidProgrammaticFinalFrame !== true) warnings.push("generationCondition must forbid programmatic final frames.")
  if (input.generationCondition.safetyCondition.forbidPlaceholderFrame !== true) warnings.push("generationCondition must forbid placeholder frames.")
  if (input.generationCondition.safetyCondition.forbidUnlicensedCopy !== true) warnings.push("generationCondition must forbid unlicensed copy.")

  if (input.candidate.sourceKind === "project_model_generated") {
    if (!input.candidate.modelVersion) warnings.push("project_model_generated candidate requires modelVersion.")
    if (!input.aiImageGenerationRequest) warnings.push("project_model_generated candidate requires aiImageGenerationRequest.")
    if (input.candidate.modelVersion !== input.generationCondition.modelVersion) {
      warnings.push("candidate.modelVersion must match generationCondition.modelVersion.")
    }
    if (input.aiImageGenerationRequest) {
      if (input.aiImageGenerationRequest.canShowToPlayer !== false) warnings.push("aiImageGenerationRequest.canShowToPlayer must be false.")
      if (input.aiImageGenerationRequest.modelVersion !== input.candidate.modelVersion) warnings.push("aiImageGenerationRequest.modelVersion must match candidate.modelVersion.")
      if (input.aiImageGenerationRequest.condition.conditionId !== input.generationCondition.conditionId) warnings.push("aiImageGenerationRequest.condition must match generationCondition.")
      if (input.aiImageGenerationRequest.condition.worldId !== input.worldId) warnings.push("aiImageGenerationRequest.condition.worldId must match record worldId.")
      if (input.aiImageGenerationRequest.condition.tick !== input.tick) warnings.push("aiImageGenerationRequest.condition.tick must match record tick.")
      if (!sameStringSet(input.aiImageGenerationRequest.condition.sourceFactIds, input.generationCondition.sourceFactIds)) warnings.push("aiImageGenerationRequest.condition sourceFactIds must match generationCondition.")
      if (input.aiImageGenerationRequest.output.width !== input.candidate.width) warnings.push("aiImageGenerationRequest.output.width must match candidate.width.")
      if (input.aiImageGenerationRequest.output.height !== input.candidate.height) warnings.push("aiImageGenerationRequest.output.height must match candidate.height.")
      if (input.aiImageGenerationRequest.output.imageFormat !== input.candidate.imageFormat) warnings.push("aiImageGenerationRequest.output.imageFormat must match candidate.imageFormat.")
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

function validateCandidateRecordRead(record: WorldVisualCandidateRecord): {
  ok: boolean
  warnings: string[]
  tags: string[]
} {
  const warnings: string[] = []
  const tags = ["vj_0_candidate_read_gate"]
  const candidate = readRuntimeBoundCandidate(record.candidate)

  if (record.ownerId.length === 0) warnings.push("record.ownerId is required.")
  if (record.worldId.length === 0) warnings.push("record.worldId is required.")
  if (!Number.isInteger(record.tick) || record.tick < 0) warnings.push("record.tick must be a non-negative integer.")
  if (record.canShowToPlayer !== false) warnings.push("record.canShowToPlayer must be false.")
  if (record.candidate.canShowToPlayer !== false) warnings.push("candidate.canShowToPlayer must be false.")
  if (candidate.worldId !== record.worldId) warnings.push("candidate.worldId must match record worldId.")
  if (candidate.tick !== record.tick) warnings.push("candidate.tick must match record tick.")
  if (!record.candidate.tags.includes(`world_id:${record.worldId}`)) warnings.push("candidate must include world_id tag.")
  if (!record.candidate.tags.includes(`tick:${record.tick}`)) warnings.push("candidate must include tick tag.")
  if (!record.candidate.tags.includes("runtime_bound_candidate")) warnings.push("candidate must include runtime_bound_candidate tag.")
  if (record.generationCondition.worldId !== record.worldId) warnings.push("generationCondition.worldId must match record worldId.")
  if (record.generationCondition.tick !== record.tick) warnings.push("generationCondition.tick must match record tick.")
  if (record.generationCondition.canShowToPlayer !== false) warnings.push("generationCondition.canShowToPlayer must be false.")
  if (record.generationCondition.safetyCondition.requireVisualJudge !== true) warnings.push("generationCondition must require VisualJudge.")
  if (record.generationCondition.safetyCondition.preserveWorldFacts !== true) warnings.push("generationCondition must preserve world facts.")
  if (record.generationCondition.safetyCondition.forbidProgrammaticFinalFrame !== true) warnings.push("generationCondition must forbid programmatic final frames.")
  if (record.generationCondition.safetyCondition.forbidPlaceholderFrame !== true) warnings.push("generationCondition must forbid placeholder frames.")
  if (record.generationCondition.safetyCondition.forbidUnlicensedCopy !== true) warnings.push("generationCondition must forbid unlicensed copy.")
  if (record.candidate.conditionId !== record.generationCondition.conditionId) warnings.push("candidate.conditionId must match generationCondition.conditionId.")
  if (!sameStringSet(record.sourceFactIds, record.generationCondition.sourceFactIds)) warnings.push("record.sourceFactIds must match generationCondition.sourceFactIds.")
  if (!sameStringSet(record.candidate.sourceFactIds, record.sourceFactIds)) warnings.push("candidate.sourceFactIds must match record.sourceFactIds.")

  if (record.candidate.sourceKind === "project_model_generated") {
    if (!record.candidate.modelVersion) warnings.push("project_model_generated candidate requires modelVersion.")
    if (record.candidate.modelVersion !== record.generationCondition.modelVersion) warnings.push("candidate.modelVersion must match generationCondition.modelVersion.")
    if (!record.aiImageGenerationRequest) warnings.push("project_model_generated candidate requires aiImageGenerationRequest.")
    if (record.aiImageGenerationRequest) {
      if (record.aiImageGenerationRequest.canShowToPlayer !== false) warnings.push("aiImageGenerationRequest.canShowToPlayer must be false.")
      if (record.aiImageGenerationRequest.modelVersion !== record.candidate.modelVersion) warnings.push("aiImageGenerationRequest.modelVersion must match candidate.modelVersion.")
      if (record.aiImageGenerationRequest.condition.conditionId !== record.generationCondition.conditionId) warnings.push("aiImageGenerationRequest.condition must match generationCondition.")
      if (record.aiImageGenerationRequest.condition.worldId !== record.worldId) warnings.push("aiImageGenerationRequest.condition.worldId must match record worldId.")
      if (record.aiImageGenerationRequest.condition.tick !== record.tick) warnings.push("aiImageGenerationRequest.condition.tick must match record tick.")
      if (!sameStringSet(record.aiImageGenerationRequest.condition.sourceFactIds, record.generationCondition.sourceFactIds)) warnings.push("aiImageGenerationRequest.condition sourceFactIds must match generationCondition.")
      if (record.aiImageGenerationRequest.output.width !== record.candidate.width) warnings.push("aiImageGenerationRequest.output.width must match candidate.width.")
      if (record.aiImageGenerationRequest.output.height !== record.candidate.height) warnings.push("aiImageGenerationRequest.output.height must match candidate.height.")
      if (record.aiImageGenerationRequest.output.imageFormat !== record.candidate.imageFormat) warnings.push("aiImageGenerationRequest.output.imageFormat must match candidate.imageFormat.")
    }
  }

  if (
    record.candidate.sourceKind === "development_test_asset" &&
    process.env.NODE_ENV === "production"
  ) {
    warnings.push("development_test_asset cannot be read in production.")
  }

  return {
    ok: warnings.length === 0,
    warnings,
    tags: [...tags, warnings.length === 0 ? "passed" : "failed"],
  }
}

function validateCurrentRuntimeBinding(
  record: WorldVisualCandidateRecord,
  input: {
    currentTick: number
    currentSourceFactIds: string[]
  }
): string[] {
  const warnings: string[] = []

  if (record.tick !== input.currentTick) warnings.push("current_tick_mismatch")
  if (record.generationCondition.tick !== input.currentTick) warnings.push("current_condition_tick_mismatch")
  if (readRuntimeBoundCandidate(record.candidate).tick !== input.currentTick) warnings.push("current_candidate_tick_mismatch")
  if (!sameStringSet(record.sourceFactIds, input.currentSourceFactIds)) warnings.push("current_source_facts_mismatch")
  if (!sameStringSet(record.candidate.sourceFactIds, input.currentSourceFactIds)) warnings.push("current_candidate_source_facts_mismatch")
  if (!sameStringSet(record.generationCondition.sourceFactIds, input.currentSourceFactIds)) warnings.push("current_condition_source_facts_mismatch")

  return warnings
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
  message: string,
  warnings: string[] = [message],
  tags: string[] = []
): WorldVisualCandidateStoreReadResult {
  return {
    status: "invalid",
    record: null,
    path: filePath,
    message,
    warnings,
    tags: ["world_visual_candidate_store_read", "invalid", ...tags],
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

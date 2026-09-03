import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
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
const FORMAL_WORLD_FRAME_MIN_WIDTH = 1024
const FORMAL_WORLD_FRAME_MIN_HEIGHT = 768
const PARTIAL_FRAME_TOKENS = ["crop", "partial", "patch", "tile", "sprite"]
type RuntimeBoundApprovedFrame = WorldVisualApprovedFrame & {
  worldId: string
  tick: number
}

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
  sourceGenerationConditionId: string
  sourceAiImageGenerationRequestId: string | null
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
  const runtimeApprovedFrame = bindApprovedFrameToRuntime({
    approvedFrame: input.approvedFrame,
    worldId: input.worldId,
    tick: input.tick,
  })
  const record: WorldVisualApprovedFrameRecord = {
    version: "world-approved-frame-v1",
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    savedAt: new Date().toISOString(),
    approvedFrame: runtimeApprovedFrame,
    reviewReport: input.reviewReport,
    sourceCandidateRecord: input.sourceCandidateRecord,
    sourceAiImageCandidateId: input.sourceCandidateRecord.candidate.candidateId,
    sourceGenerationConditionId:
      input.sourceCandidateRecord.generationCondition.conditionId,
    sourceAiImageGenerationRequestId: request?.requestId ?? null,
    sourceVisualFixPlanId: null,
    sourceVisualFixHintCount:
      input.sourceCandidateRecord.generationCondition.fixConditions.length,
    sourceFactIds: input.sourceCandidateRecord.sourceFactIds,
    canShowToPlayer: true,
    tags: buildApprovedFrameRecordTags({
      approvedFrame: runtimeApprovedFrame,
      worldId: input.worldId,
      tick: input.tick,
      hasRequest: Boolean(request),
    }),
  }
  const filePath = getWorldVisualApprovedFrameRecordPath(record)
  const gateWarnings = validateApprovedFrameRecord(record)
  if (gateWarnings.length > 0) {
    return {
      ok: false,
      path: filePath,
      message: "Approved frame record failed VJ-0 store gate.",
      warnings: gateWarnings,
      tags: [
        "world_visual_approved_frame_store_write",
        "vj_0_approved_frame_record_gate_failed",
      ],
    }
  }
  const indexPath = getLatestWorldVisualApprovedFrameIndexPath(record)
  const transactionPath = `${indexPath}.transaction.json`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeAtomic(transactionPath, {
      schemaVersion: "world-approved-frame-transaction-v1",
      state: "prepared",
      recordPath: filePath,
      indexPath,
      ownerId: record.ownerId,
      worldId: record.worldId,
      tick: record.tick,
      createdAtUtc: new Date().toISOString(),
    })
    await writeAtomic(filePath, record)
    await writeLatestWorldVisualApprovedFrameIndex({ record, filePath })
    await writeAtomic(transactionPath, {
      schemaVersion: "world-approved-frame-transaction-v1",
      state: "committed",
      recordPath: filePath,
      indexPath,
      ownerId: record.ownerId,
      worldId: record.worldId,
      tick: record.tick,
      committedAtUtc: new Date().toISOString(),
    })
    await rm(transactionPath, { force: true })

    return {
      ok: true,
      path: filePath,
      message: "Controlled MVP approved frame record written.",
      warnings: [],
      tags: [
        "world_visual_approved_frame_store_write",
        "ok",
        "vj_0_approved_frame_record_gate_passed",
        input.approvedFrame.approvalScope,
        "not_approved_for_production",
      ],
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
  currentTick: number
  currentSourceFactIds: string[]
}): Promise<WorldVisualApprovedFrameStoreReadResult> {
  const indexPath = getLatestWorldVisualApprovedFrameIndexPath(input)

  try {
    const transaction = await readTransactionJournal(`${indexPath}.transaction.json`)
    if (transaction?.state === "prepared") {
      return invalidRead(indexPath, "Approved frame transaction is incomplete.")
    }
    const indexRaw = await readFile(indexPath, "utf8")
    const index = JSON.parse(indexRaw) as Partial<{
      path: string
      ownerId: string
      worldId: string
      tick: number
      recordSha256: string
    }>
    if (
      typeof index.path !== "string" ||
      index.ownerId !== input.ownerId ||
      index.worldId !== input.worldId ||
      index.tick !== input.currentTick ||
      !/^[a-f0-9]{64}$/u.test(index.recordSha256 ?? "")
    ) {
      return invalidRead(indexPath, "Latest approved frame index is invalid.")
    }

    const expectedRecordRoot = path.dirname(indexPath)
    const recordPath = path.resolve(index.path)
    if (path.dirname(recordPath) !== expectedRecordRoot) {
      return invalidRead(indexPath, "Latest approved frame index path escapes its world namespace.")
    }
    const raw = await readFile(recordPath, "utf8")
    if (sha256Text(raw) !== index.recordSha256) {
      return invalidRead(recordPath, "Approved frame record hash does not match its index.")
    }
    const parsed = JSON.parse(raw) as Partial<WorldVisualApprovedFrameRecord>
    const normalized = normalizeWorldVisualApprovedFrameRecord(parsed)
    if (!normalized) {
      return invalidRead(index.path, "Approved frame record shape is invalid.")
    }

    const readGateWarnings = validateApprovedFrameRecord(normalized)
    const currentGateWarnings = validateCurrentRuntimeBinding(normalized, input)
    const warnings = [...readGateWarnings, ...currentGateWarnings]
    if (warnings.length > 0) {
      return {
        status: "invalid",
        record: null,
        path: recordPath,
        message: "Approved frame record failed VJ-0 read gate.",
        warnings,
        tags: [
          "world_visual_approved_frame_store_read",
          "vj_0_approved_frame_record_gate_failed",
          currentGateWarnings.length > 0
            ? "current_runtime_binding_failed"
            : "record_shape_binding_failed",
          "invalid",
        ],
      }
    }

    return {
      status: "found",
      record: normalized,
      path: recordPath,
      message: "Approved frame record loaded.",
      warnings: [],
      tags: [
        "world_visual_approved_frame_store_read",
        "found",
        "vj_0_approved_frame_record_gate_passed",
        normalized.approvedFrame.approvalScope,
        normalized.approvedFrame.vj2Status,
        "not_approved_for_production",
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

function bindApprovedFrameToRuntime(input: {
  approvedFrame: WorldVisualApprovedFrame
  worldId: string
  tick: number
}): RuntimeBoundApprovedFrame {
  const tagSet = new Set(input.approvedFrame.tags)
  tagSet.add(`world_id:${input.worldId}`)
  tagSet.add(`tick:${input.tick}`)
  tagSet.add("runtime_bound_approved_frame")

  return {
    ...input.approvedFrame,
    worldId: input.worldId,
    tick: input.tick,
    tags: Array.from(tagSet),
  }
}

function buildApprovedFrameRecordTags(input: {
  approvedFrame: WorldVisualApprovedFrame
  worldId: string
  tick: number
  hasRequest: boolean
}): string[] {
  const tagSet = new Set([
    "world_visual_approved_frame_record",
    `world_id:${input.worldId}`,
    `tick:${input.tick}`,
    "vj_0_passed",
    "vj_1_passed",
    input.approvedFrame.vj2Status,
    input.approvedFrame.approvalScope,
    "not_approved_for_production",
    "source_candidate_record_bound",
    "vj_0_approved_frame_record_gate_passed",
    "current_runtime_required_on_read",
    input.hasRequest
      ? "ai_image_generation_request_bound"
      : "no_ai_image_generation_request",
    ...input.approvedFrame.tags,
  ])

  if (input.approvedFrame.approvalScope === "approved_for_controlled_mvp") {
    tagSet.add("controlled_mvp_player_visible_allowed")
  }

  if (input.approvedFrame.approvalScope === "approved_for_game_world") {
    tagSet.add("game_world_ready_for_player")
    tagSet.add("formal_full_world_frame")
  }

  return Array.from(tagSet)
}

function validateApprovedFrameRecord(
  record: WorldVisualApprovedFrameRecord
): string[] {
  const warnings: string[] = []
  const sourceRecord = record.sourceCandidateRecord
  const candidate = sourceRecord.candidate
  const runtimeCandidate = candidate as typeof candidate & {
    worldId?: unknown
    tick?: unknown
  }
  const condition = sourceRecord.generationCondition
  const request = sourceRecord.aiImageGenerationRequest
  const frame = record.approvedFrame
  const runtimeFrame = frame as RuntimeBoundApprovedFrame
  const review = record.reviewReport
  const summary = review.imageInspectionSummary
  const controlledMvpProtocolPassed =
    review.vj2Status === "vj_2_not_implemented" &&
    review.approvalScope === "approved_for_controlled_mvp" &&
    frame.vj2Status === "vj_2_not_implemented" &&
    frame.approvalScope === "approved_for_controlled_mvp"
  const gameWorldProtocolPassed =
    review.vj2Status === "vj_2_passed" &&
    review.approvalScope === "approved_for_game_world" &&
    frame.vj2Status === "vj_2_passed" &&
    frame.approvalScope === "approved_for_game_world" &&
    frame.tags.includes("game_world_ready_for_player") &&
    frame.tags.includes("formal_full_world_frame") &&
    !frame.tags.includes("controlled_mvp_player_visible_allowed")

  pushIf(warnings, sourceRecord.ownerId !== record.ownerId, "source_owner")
  pushIf(warnings, sourceRecord.worldId !== record.worldId, "source_world")
  pushIf(warnings, sourceRecord.tick !== record.tick, "source_tick")
  pushIf(warnings, condition.worldId !== record.worldId, "condition_world")
  pushIf(warnings, condition.tick !== record.tick, "condition_tick")
  pushIf(warnings, runtimeCandidate.worldId !== record.worldId, "candidate_world")
  pushIf(warnings, runtimeCandidate.tick !== record.tick, "candidate_tick")
  pushIf(warnings, runtimeFrame.worldId !== record.worldId, "frame_world")
  pushIf(warnings, runtimeFrame.tick !== record.tick, "frame_tick")
  pushIf(warnings, !frame.tags.includes(`world_id:${record.worldId}`), "frame_world_tag")
  pushIf(warnings, !frame.tags.includes(`tick:${record.tick}`), "frame_tick_tag")
  pushIf(warnings, !frame.tags.includes("runtime_bound_approved_frame"), "frame_runtime_bound_tag")
  pushIf(warnings, !candidate.tags.includes(`world_id:${record.worldId}`), "candidate_world_tag")
  pushIf(warnings, !candidate.tags.includes(`tick:${record.tick}`), "candidate_tick_tag")
  pushIf(warnings, !candidate.tags.includes("runtime_bound_candidate"), "candidate_runtime_bound_tag")
  pushIf(warnings, record.sourceAiImageCandidateId !== candidate.candidateId, "candidate_id")
  pushIf(warnings, frame.sourceImageCandidateId !== candidate.candidateId, "frame_candidate_id")
  pushIf(warnings, record.sourceGenerationConditionId !== condition.conditionId, "condition_id")
  pushIf(warnings, candidate.conditionId !== condition.conditionId, "candidate_condition")
  pushIf(warnings, !sameStringSet(record.sourceFactIds, sourceRecord.sourceFactIds), "source_facts")
  pushIf(warnings, !sameStringSet(record.sourceFactIds, candidate.sourceFactIds), "candidate_facts")
  pushIf(warnings, !sameStringSet(record.sourceFactIds, condition.sourceFactIds), "condition_facts")
  pushIf(warnings, !sameStringSet(record.sourceFactIds, frame.sourceFactIds), "frame_facts")
  pushIf(warnings, frame.imageUrl !== candidate.imageUrl, "image_url")
  pushIf(warnings, frame.imageFormat !== candidate.imageFormat, "image_format")
  pushIf(warnings, frame.width !== candidate.width, "width")
  pushIf(warnings, frame.height !== candidate.height, "height")
  pushIf(
    warnings,
    frame.width < FORMAL_WORLD_FRAME_MIN_WIDTH ||
      frame.height < FORMAL_WORLD_FRAME_MIN_HEIGHT ||
      candidate.width < FORMAL_WORLD_FRAME_MIN_WIDTH ||
      candidate.height < FORMAL_WORLD_FRAME_MIN_HEIGHT,
    "formal_world_frame_size"
  )
  pushIf(
    warnings,
    hasPartialFrameToken([
      candidate.candidateId,
      candidate.sourceDescription.zh,
      candidate.sourceDescription.en,
      candidate.generationNotes.zh,
      candidate.generationNotes.en,
      candidate.modelVersion ?? "",
      ...candidate.tags,
      ...frame.tags,
    ]),
    "partial_or_crop_candidate"
  )
  pushIf(warnings, frame.reviewScore !== review.score, "review_score")
  pushIf(warnings, review.status !== "vj_1_passed", "review_status")
  pushIf(warnings, review.vj0Status !== "vj_0_passed", "review_vj0_status")
  pushIf(warnings, review.vj1Status !== "vj_1_passed", "review_vj1_status")
  pushIf(warnings, !controlledMvpProtocolPassed && !gameWorldProtocolPassed, "approval_protocol")
  pushIf(warnings, review.productionApprovalStatus !== "not_approved_for_production", "review_production_status")
  pushIf(warnings, review.canShowToPlayer !== false, "review_visibility")
  pushIf(warnings, summary.ok !== true, "review_summary_ok")
  pushIf(warnings, summary.sha256 !== frame.sourceImageSha256, "review_summary_sha256")
  pushIf(warnings, summary.byteLength !== frame.sourceImageByteLength, "review_summary_byte_length")
  pushIf(warnings, summary.contentType !== frame.sourceImageContentType, "review_summary_content_type")
  pushIf(warnings, summary.format !== frame.imageFormat, "review_summary_format")
  pushIf(warnings, summary.width !== frame.width, "review_summary_width")
  pushIf(warnings, summary.height !== frame.height, "review_summary_height")
  pushIf(warnings, summary.payloadQualityPassed !== frame.sourceImagePayloadQualityPassed, "review_summary_payload_quality")
  pushIf(warnings, frame.canShowToPlayer !== true, "frame_visibility")
  pushIf(warnings, !controlledMvpProtocolPassed && !gameWorldProtocolPassed, "frame_approval_scope")
  pushIf(warnings, frame.productionApprovalStatus !== "not_approved_for_production", "frame_production_status")
  pushIf(warnings, frame.approvedForProduction !== false, "frame_production_flag")
  pushIf(warnings, frame.vj0Status !== "vj_0_passed", "frame_vj0_status")
  pushIf(warnings, frame.vj1Status !== "vj_1_passed", "frame_vj1_status")
  pushIf(warnings, gameWorldProtocolPassed && !record.tags.includes("game_world_ready_for_player"), "record_game_world_tag")
  pushIf(warnings, gameWorldProtocolPassed && !record.tags.includes("formal_full_world_frame"), "record_formal_world_frame_tag")
  pushIf(warnings, sourceRecord.canShowToPlayer !== false, "source_visibility")
  pushIf(warnings, candidate.canShowToPlayer !== false, "candidate_visibility")
  pushIf(warnings, frame.sourceImageSha256.length !== 64, "sha256")
  pushIf(warnings, frame.sourceImageByteLength <= 0, "byte_length")
  pushIf(warnings, !isAllowedApprovedContentType(frame.sourceImageContentType, frame.imageFormat), "content_type")
  pushIf(warnings, frame.sourceImagePayloadQualityPassed !== true, "payload_quality")
  pushIf(warnings, candidate.sourceKind !== "project_model_generated", "source_kind")
  pushIf(warnings, !candidate.modelVersion, "model_version")
  pushIf(warnings, candidate.modelVersion !== condition.modelVersion, "condition_model")
  pushIf(warnings, candidate.tags.includes("development_test_asset"), "development_test_asset")
  pushIf(warnings, condition.canShowToPlayer !== false, "condition_visibility")
  pushIf(warnings, condition.safetyCondition.preserveWorldFacts !== true, "preserve_world_facts")
  pushIf(warnings, condition.safetyCondition.requireVisualJudge !== true, "require_visual_judge")
  pushIf(warnings, condition.safetyCondition.forbidProgrammaticFinalFrame !== true, "forbid_programmatic_frame")
  pushIf(warnings, condition.safetyCondition.forbidPlaceholderFrame !== true, "forbid_placeholder")
  pushIf(warnings, condition.safetyCondition.forbidUnlicensedCopy !== true, "forbid_unlicensed_copy")

  if (!request) {
    warnings.push("request")
  } else {
    pushIf(warnings, record.sourceAiImageGenerationRequestId !== request.requestId, "request_id")
    pushIf(warnings, request.canShowToPlayer !== false, "request_visibility")
    pushIf(warnings, request.modelVersion !== candidate.modelVersion, "request_model")
    pushIf(warnings, request.condition.conditionId !== condition.conditionId, "request_condition")
    pushIf(warnings, request.condition.worldId !== record.worldId, "request_world")
    pushIf(warnings, request.condition.tick !== record.tick, "request_tick")
    pushIf(warnings, request.condition.modelVersion !== condition.modelVersion, "request_condition_model")
    pushIf(warnings, !sameStringSet(request.condition.sourceFactIds, condition.sourceFactIds), "request_source_facts")
    pushIf(warnings, request.output.width !== candidate.width, "request_width")
    pushIf(warnings, request.output.height !== candidate.height, "request_height")
    pushIf(warnings, request.output.imageFormat !== candidate.imageFormat, "request_format")
  }

  return warnings
}

function validateCurrentRuntimeBinding(
  record: WorldVisualApprovedFrameRecord,
  input: {
    currentTick: number
    currentSourceFactIds: string[]
  }
): string[] {
  const warnings: string[] = []
  const runtimeFrame = record.approvedFrame as RuntimeBoundApprovedFrame

  pushIf(warnings, record.tick !== input.currentTick, "current_tick_mismatch")
  pushIf(warnings, runtimeFrame.tick !== input.currentTick, "current_frame_tick_mismatch")
  pushIf(warnings, record.approvedFrame.frameId !== `approved-frame-${record.worldId}-${input.currentTick}`, "current_frame_id_mismatch")
  pushIf(
    warnings,
    !sameStringSet(record.sourceFactIds, input.currentSourceFactIds),
    "current_source_facts_mismatch"
  )
  pushIf(
    warnings,
    !sameStringSet(record.approvedFrame.sourceFactIds, input.currentSourceFactIds),
    "current_frame_source_facts_mismatch"
  )

  return warnings
}

function pushIf(warnings: string[], failed: boolean, warning: string): void {
  if (failed) warnings.push(warning)
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function isAllowedApprovedContentType(
  contentType: string | null,
  imageFormat: WorldVisualApprovedFrame["imageFormat"]
): boolean {
  if (imageFormat === "png") return contentType === "image/png"
  if (imageFormat === "webp") return contentType === "image/webp"
  return contentType === "image/jpeg"
}

function hasPartialFrameToken(values: string[]): boolean {
  return values.some((value) => {
    const normalized = value.toLowerCase()
    return PARTIAL_FRAME_TOKENS.some((token) => normalized.includes(token))
  })
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
  const runtimeFrame = input.record.approvedFrame as RuntimeBoundApprovedFrame
  const index = {
    version: "world-approved-frame-index-v1",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    tick: input.record.tick,
    frameWorldId: runtimeFrame.worldId,
    frameTick: runtimeFrame.tick,
    frameId: input.record.approvedFrame.frameId,
    approvalScope: input.record.approvedFrame.approvalScope,
    productionApprovalStatus: input.record.approvedFrame.productionApprovalStatus,
    approvedForProduction: input.record.approvedFrame.approvedForProduction,
    vj0Status: input.record.approvedFrame.vj0Status,
    vj1Status: input.record.approvedFrame.vj1Status,
    vj2Status: input.record.approvedFrame.vj2Status,
    sourceAiImageCandidateId: input.record.sourceAiImageCandidateId,
    sourceGenerationConditionId: input.record.sourceGenerationConditionId,
    sourceAiImageGenerationRequestId:
      input.record.sourceAiImageGenerationRequestId,
    sourceVisualFixPlanId: input.record.sourceVisualFixPlanId,
    sourceVisualFixHintCount: input.record.sourceVisualFixHintCount,
    sourceImageSha256: input.record.approvedFrame.sourceImageSha256,
    sourceImageByteLength: input.record.approvedFrame.sourceImageByteLength,
    sourceImageContentType: input.record.approvedFrame.sourceImageContentType,
    sourceImagePayloadQualityPassed:
      input.record.approvedFrame.sourceImagePayloadQualityPassed,
    path: input.filePath,
    recordSha256: sha256Text(`${JSON.stringify(input.record, null, 2)}\n`),
    updatedAt: input.record.savedAt,
    tags: [
      "world_visual_approved_frame_latest_index",
      "image_byte_fingerprint_bound",
      "vj_0_approved_frame_record_gate_passed",
      input.record.approvedFrame.approvalScope,
      input.record.approvedFrame.vj2Status,
      "not_approved_for_production",
      ...input.record.approvedFrame.tags.filter((tag) =>
        [
          "controlled_mvp_player_visible_allowed",
          "game_world_ready_for_player",
          "formal_full_world_frame",
        ].includes(tag)
      ),
    ],
  }

  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeAtomic(indexPath, index)
}

async function writeAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(tempPath, filePath)
}

async function readTransactionJournal(filePath: string): Promise<{ state?: string } | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as { state?: string }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null
    throw error
  }
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
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
    typeof value.sourceGenerationConditionId !== "string" ||
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
    approvedFrame: bindApprovedFrameToRuntime({
      approvedFrame: value.approvedFrame,
      worldId: value.worldId,
      tick: value.tick,
    }),
    reviewReport: value.reviewReport,
    sourceCandidateRecord: value.sourceCandidateRecord,
    sourceAiImageCandidateId: value.sourceAiImageCandidateId,
    sourceGenerationConditionId: value.sourceGenerationConditionId,
    sourceAiImageGenerationRequestId:
      value.sourceAiImageGenerationRequestId ?? null,
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

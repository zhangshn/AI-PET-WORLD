import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldGameRuntimeFrame,
  buildWorldRuntimeFrameGate,
  buildWorldVisualFactManifest,
  readLatestWorldVisualApprovedFrameRecord,
} from "@/world/world-visual-painter"
import type {
  WorldVisualApprovedFrame,
  WorldVisualReviewReport,
} from "@/world/world-visual-painter"

type ApprovedReadBlockedStatus = "empty" | "invalid" | "failed"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取 ApprovedFrame。",
        messageEn:
          "Runtime world has not been created, so no ApprovedFrame can be read.",
        readStatus: readResult.status,
        tags: ["world_visual_approved_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const factManifest = buildWorldVisualFactManifest({
    saveRecord: readResult.record,
  })
  const approvedFrameReadResult = await readLatestWorldVisualApprovedFrameRecord({
    ownerId: readResult.record.ownerId,
    worldId: readResult.record.worldId,
    currentTick: readResult.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })

  if (
    approvedFrameReadResult.status !== "found" ||
    !approvedFrameReadResult.record
  ) {
    const blockedStatus = normalizeApprovedReadBlockedStatus(
      approvedFrameReadResult.status
    )
    const blockedState = buildApprovedFrameBlockedState(blockedStatus)

    return NextResponse.json(
      {
        ok: false,
        status: approvedFrameReadResult.status,
        apiState: blockedState.apiState,
        vj0Blocked: blockedState.vj0Blocked,
        message: blockedState.message,
        messageEn: blockedState.messageEn,
        canShowToPlayer: false,
        canShowToPlayerScope: "blocked",
        currentRuntimeGate: {
          worldId: readResult.record.worldId,
          tick: readResult.record.tick,
          sourceFactIds: factManifest.sourceFactIds,
          sourceFactIdCount: factManifest.sourceFactIds.length,
        },
        runtimeRenderGate: {
          canRuntimeRender: false,
          reason: blockedState.reason,
          tags: blockedState.tags,
        },
        approvalBoundary: {
          approvalScope: "not_approved",
          productionApprovalStatus: "not_approved_for_production",
          approvedForProduction: false,
          vj1Status: "vj_1_failed",
          vj2Status: "vj_2_not_implemented",
          productionDisplayAllowed: false,
        },
        readAudit: {
          status: approvedFrameReadResult.status,
          path: approvedFrameReadResult.path,
          warnings: approvedFrameReadResult.warnings,
          tags: approvedFrameReadResult.tags,
        },
        displayRule: blockedState.displayRule,
        displayRuleEn: blockedState.displayRuleEn,
        nextStep: blockedState.nextStep,
        tags: [
          "world_visual_approved_api",
          "approved_frame_read_not_found_or_blocked",
          "current_tick_gate_checked",
          "current_source_facts_gate_checked",
          "production_display_blocked",
          ...blockedState.tags,
          ...approvedFrameReadResult.tags,
        ],
      },
      { status: blockedState.httpStatus }
    )
  }

  const record = approvedFrameReadResult.record
  const request = record.sourceCandidateRecord.aiImageGenerationRequest
  const condition = record.sourceCandidateRecord.generationCondition
  const runtimeFrameBuild = buildWorldGameRuntimeFrame({
    ownerId: readResult.record.ownerId,
    currentWorldId: readResult.record.worldId,
    currentTick: readResult.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
    approvedFrame: record.approvedFrame,
    reviewReport: record.reviewReport,
    recordWorldId: record.worldId,
    recordTick: record.tick,
    recordSourceFactIds: record.sourceFactIds,
  })
  const runtimeRenderGate = buildRuntimeRenderGate({
    approvedFrame: record.approvedFrame,
    approvedFrameRecordCanShowToPlayer: record.canShowToPlayer,
    recordWorldId: record.worldId,
    recordTick: record.tick,
    currentWorldId: readResult.record.worldId,
    currentTick: readResult.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
    recordSourceFactIds: record.sourceFactIds,
    reviewReport: record.reviewReport,
    runtimeFrameReady: runtimeFrameBuild.runtimeFrameReady,
    runtimeFrameId: runtimeFrameBuild.runtimeFrame?.frameId ?? null,
    runtimeFrameBlockedReasons: runtimeFrameBuild.blockedReasons,
  })

  return NextResponse.json(
    {
      ok: runtimeRenderGate.canRuntimeRender,
      status: approvedFrameReadResult.status,
      apiState: runtimeRenderGate.canRuntimeRender
        ? "game_ready_approved_frame_current_runtime_matched"
        : "approved_frame_runtime_gate_blocked",
      vj0Blocked: !runtimeRenderGate.canRuntimeRender,
      record,
      runtimeFrameStatus: runtimeFrameBuild.status,
      runtimeFrame: runtimeFrameBuild.runtimeFrame,
      runtimeRenderGate,
      approvalBoundary: {
        approvalScope: record.approvedFrame.approvalScope,
        productionApprovalStatus: record.approvedFrame.productionApprovalStatus,
        approvedForProduction: record.approvedFrame.approvedForProduction,
        vj0Status: record.approvedFrame.vj0Status,
        vj1Status: record.approvedFrame.vj1Status,
        vj2Status: record.approvedFrame.vj2Status,
        gameWorldDisplayAllowed: runtimeRenderGate.canRuntimeRender,
        productionDisplayAllowed: false,
      },
      currentRuntimeGate: {
        worldId: readResult.record.worldId,
        tick: readResult.record.tick,
        sourceFactIds: factManifest.sourceFactIds,
        sourceFactIdCount: factManifest.sourceFactIds.length,
      },
      provenance: {
        frameId: record.approvedFrame.frameId,
        sourceAiImageCandidateId: record.sourceAiImageCandidateId,
        sourceGenerationConditionId: record.sourceGenerationConditionId,
        sourceAiImageGenerationRequestId:
          record.sourceAiImageGenerationRequestId,
        sourceVisualFixPlanId: record.sourceVisualFixPlanId,
        sourceVisualFixHintCount: record.sourceVisualFixHintCount,
        sourceFactIds: record.sourceFactIds,
        reviewScore: record.approvedFrame.reviewScore,
        imageUrl: record.approvedFrame.imageUrl,
        imageUrlAudit: buildImageUrlAudit(record.approvedFrame.imageUrl),
        imageFormat: record.approvedFrame.imageFormat,
        width: record.approvedFrame.width,
        height: record.approvedFrame.height,
        sourceImageSha256: record.approvedFrame.sourceImageSha256,
        sourceImageByteLength: record.approvedFrame.sourceImageByteLength,
        sourceImageContentType: record.approvedFrame.sourceImageContentType,
        sourceImagePayloadQualityPassed:
          record.approvedFrame.sourceImagePayloadQualityPassed,
      },
      sourceCandidateAudit: {
        candidateId: record.sourceCandidateRecord.candidate.candidateId,
        candidateCanShowToPlayer:
          record.sourceCandidateRecord.candidate.canShowToPlayer,
        candidateSourceKind:
          record.sourceCandidateRecord.candidate.sourceKind,
        candidateModelVersion:
          record.sourceCandidateRecord.candidate.modelVersion,
        candidateLicense: record.sourceCandidateRecord.candidate.license,
        originalityConfirmed:
          record.sourceCandidateRecord.candidate.originalityConfirmed,
        hasGenerationCondition: Boolean(condition),
        hasAiImageGenerationRequest: Boolean(request),
        conditionId: condition.conditionId,
        conditionVersion: condition.version,
        conditionWorldId: condition.worldId,
        conditionTick: condition.tick,
        sourceFactIds: condition.sourceFactIds,
        safetyCondition: condition.safetyCondition,
        fixConditions: condition.fixConditions,
      },
      reviewAudit: {
        status: record.reviewReport.status,
        vj0Status: record.reviewReport.vj0Status,
        vj1Status: record.reviewReport.vj1Status,
        vj2Status: record.reviewReport.vj2Status,
        approvalScope: record.reviewReport.approvalScope,
        productionApprovalStatus: record.reviewReport.productionApprovalStatus,
        score: record.reviewReport.score,
        canShowToPlayer: record.reviewReport.canShowToPlayer,
        imageInspectionSummary: record.reviewReport.imageInspectionSummary,
        failedChecks: record.reviewReport.checks
          .filter((check) => !check.passed)
          .map((check) => ({
            id: check.id,
            score: check.score,
            label: check.label,
            evidence: check.evidence,
            tags: check.tags,
          })),
        passedCheckCount: record.reviewReport.checks.filter(
          (check) => check.passed
        ).length,
        totalCheckCount: record.reviewReport.checks.length,
      },
      canShowToPlayer: runtimeRenderGate.canRuntimeRender,
      canShowToPlayerScope: "game_runtime_frame_only",
      nextStep: runtimeRenderGate.canRuntimeRender
        ? {
            zh: "完整游戏 RuntimeFrame 已通过当前 runtime 闸门，/world 可以展示游戏界面合成层。",
            en: "The complete game RuntimeFrame passed the current runtime gate, so /world may display the composed game interface.",
          }
        : {
            zh: "ApprovedFrame 只能作为视觉层凭证。当前还没有完整游戏 RuntimeFrame / 游戏界面合成层，/world 必须继续阻断。",
            en: "ApprovedFrame is only a visual-layer credential. A complete game RuntimeFrame / game interface composition layer does not exist yet, so /world must remain blocked.",
          },
      tags: [
        "world_visual_approved_api",
        "game_world_approved_frame_only",
        "not_approved_for_production",
        "provenance_exposed_for_audit",
        "runtime_render_gate_checked",
        "current_tick_gate_checked",
        "current_source_facts_gate_checked",
        runtimeRenderGate.canRuntimeRender
          ? "game_runtime_frame_render_allowed"
          : "runtime_render_blocked",
        runtimeRenderGate.runtimeGameInterfaceReady
          ? "runtime_game_interface_ready"
          : "runtime_game_interface_not_implemented",
        "production_display_blocked",
        ...approvedFrameReadResult.tags,
      ],
    },
    { status: runtimeRenderGate.canRuntimeRender ? 200 : 409 }
  )
}

function normalizeApprovedReadBlockedStatus(
  status: "found" | ApprovedReadBlockedStatus
): ApprovedReadBlockedStatus {
  return status === "found" ? "failed" : status
}

function buildApprovedFrameBlockedState(status: ApprovedReadBlockedStatus) {
  if (status === "empty") {
    return {
      httpStatus: 404,
      apiState: "approved_frame_empty",
      vj0Blocked: false,
      reason: "approved_frame_empty",
      message: "还没有受控 MVP ApprovedFrame。需要先生成候选图并通过 VJ-0。",
      messageEn:
        "No controlled MVP ApprovedFrame exists yet. Generate a candidate and pass VJ-0 first.",
      displayRule: "没有受控 MVP ApprovedFrame 时，/world 必须继续阻断。",
      displayRuleEn:
        "/world must remain blocked while no controlled MVP ApprovedFrame exists.",
      nextStep: {
        zh: "继续等待正式 AI 位图候选图通过 VJ-0，再生成受控 MVP ApprovedFrame。",
        en: "Wait for a formal AI bitmap candidate to pass VJ-0 before creating a controlled MVP ApprovedFrame.",
      },
      tags: ["approved_frame_empty", "runtime_render_blocked"],
    }
  }

  if (status === "invalid") {
    return {
      httpStatus: 409,
      apiState: "approved_frame_blocked_by_vj_0_read_gate",
      vj0Blocked: true,
      reason: "vj_0_approved_frame_read_gate_failed",
      message: "ApprovedFrameRecord 已被 VJ-0 读取闸门阻断，不能展示。",
      messageEn:
        "The ApprovedFrameRecord was blocked by the VJ-0 read gate and cannot be displayed.",
      displayRule:
        "读取到 invalid ApprovedFrameRecord 时，/world 必须继续阻断，不能展示旧图或坏图。",
      displayRuleEn:
        "When an invalid ApprovedFrameRecord is read, /world must remain blocked and must not display stale or invalid imagery.",
      nextStep: {
        zh: "需要重新生成候选图，并重新通过 VJ-0 与 ApprovedFrame 写入闸门。",
        en: "Generate a new candidate and pass VJ-0 plus the ApprovedFrame write gate again.",
      },
      tags: [
        "approved_frame_invalid",
        "vj_0_read_gate_blocked",
        "runtime_render_blocked",
      ],
    }
  }

  return {
    httpStatus: 500,
    apiState: "approved_frame_read_failed",
    vj0Blocked: true,
    reason: "approved_frame_read_failed",
    message: "ApprovedFrameRecord 读取失败，不能展示。",
    messageEn: "ApprovedFrameRecord read failed and cannot be displayed.",
    displayRule: "读取失败时，/world 必须继续阻断。",
    displayRuleEn: "/world must remain blocked when reading fails.",
    nextStep: {
      zh: "需要检查本地 ApprovedFrame 存储或重新生成 ApprovedFrame。",
      en: "Check the local ApprovedFrame storage or regenerate the ApprovedFrame.",
    },
    tags: [
      "approved_frame_read_failed",
      "vj_0_read_gate_unresolved",
      "runtime_render_blocked",
    ],
  }
}

function buildRuntimeRenderGate(input: {
  approvedFrame: WorldVisualApprovedFrame
  approvedFrameRecordCanShowToPlayer: boolean
  recordWorldId: string
  recordTick: number
  currentWorldId: string
  currentTick: number
  currentSourceFactIds: string[]
  recordSourceFactIds: string[]
  reviewReport: WorldVisualReviewReport
  runtimeFrameReady: boolean
  runtimeFrameId: string | null
  runtimeFrameBlockedReasons: string[]
}) {
  const hardFieldsValid = approvedFrameHardFieldsValid(input.approvedFrame)
  const currentWorldMatched = input.recordWorldId === input.currentWorldId
  const currentTickMatched = input.recordTick === input.currentTick
  const currentSourceFactsMatched = sameStringSet(
    input.currentSourceFactIds,
    input.recordSourceFactIds
  )
  const controlledMvpBoundaryPassed =
    input.approvedFrame.approvalScope === "approved_for_controlled_mvp" &&
    input.approvedFrame.productionApprovalStatus === "not_approved_for_production" &&
    input.approvedFrame.approvedForProduction === false &&
    input.approvedFrame.vj0Status === "vj_0_passed" &&
    input.approvedFrame.vj1Status === "vj_1_passed" &&
    input.approvedFrame.vj2Status === "vj_2_not_implemented"
  const gameWorldDisplayBoundaryPassed =
    approvedFrameGameWorldDisplayBoundaryPassed(input.approvedFrame)
  const runtimeFrameGate = buildWorldRuntimeFrameGate({
    approvedFrame: input.approvedFrame,
    reviewReport: input.reviewReport,
    recordWorldId: input.recordWorldId,
    recordTick: input.recordTick,
    recordSourceFactIds: input.recordSourceFactIds,
    recordCanShowToPlayer: input.approvedFrameRecordCanShowToPlayer,
    currentWorldId: input.currentWorldId,
    currentTick: input.currentTick,
    currentSourceFactIds: input.currentSourceFactIds,
    runtimeFrameReady: input.runtimeFrameReady,
    runtimeFrameId: input.runtimeFrameId,
    runtimeFrameBlockedReasons: input.runtimeFrameBlockedReasons,
  })
  const canRuntimeRender = runtimeFrameGate.canRuntimeRender

  return {
    approvedFrameRecordCanShowToPlayer: input.approvedFrameRecordCanShowToPlayer,
    approvedFrameCanShowToPlayer: input.approvedFrame.canShowToPlayer,
    hardFieldsValid,
    controlledMvpBoundaryPassed,
    gameWorldDisplayBoundaryPassed,
    runtimeGameInterfaceReady: runtimeFrameGate.runtimeGameInterfaceReady,
    reviewReportGameWorldPassed: runtimeFrameGate.reviewReportGameWorldPassed,
    ownerFinalWorldApprovalPassed:
      runtimeFrameGate.ownerFinalWorldApprovalPassed,
    productionDisplayAllowed: false,
    currentWorldMatched,
    currentTickMatched,
    currentSourceFactsMatched,
    sourceImageSha256Bound:
      typeof input.approvedFrame.sourceImageSha256 === "string" &&
      input.approvedFrame.sourceImageSha256.length === 64,
    sourceImageByteLengthBound:
      typeof input.approvedFrame.sourceImageByteLength === "number" &&
      input.approvedFrame.sourceImageByteLength > 0,
    sourceImageContentTypeBound:
      typeof input.approvedFrame.sourceImageContentType === "string" &&
      isApprovedContentType(input.approvedFrame.sourceImageContentType),
    sourceImagePayloadQualityPassed:
      input.approvedFrame.sourceImagePayloadQualityPassed === true,
    canRuntimeRender,
    canShowToPlayerScope: "game_runtime_frame_only",
    blockedReasons: runtimeFrameGate.blockedReasons,
    displayRule: runtimeFrameGate.displayRule,
    displayRuleEn: runtimeFrameGate.displayRuleEn,
    tags: [
      "runtime_render_gate",
      "runtime_frame_required_for_world",
      "single_approved_frame_direct_display_blocked",
      runtimeFrameGate.runtimeGameInterfaceReady
        ? "runtime_game_interface_ready"
        : "runtime_game_interface_not_implemented",
      hardFieldsValid ? "hard_fields_valid" : "hard_fields_invalid",
      controlledMvpBoundaryPassed
        ? "controlled_mvp_boundary_passed"
        : "controlled_mvp_boundary_failed",
      gameWorldDisplayBoundaryPassed
        ? "game_world_display_boundary_passed"
        : "game_world_display_boundary_failed",
      currentWorldMatched ? "current_world_matched" : "current_world_mismatch",
      currentTickMatched ? "current_tick_matched" : "current_tick_mismatch",
      currentSourceFactsMatched
        ? "current_source_facts_matched"
        : "current_source_facts_mismatch",
      canRuntimeRender
        ? "game_runtime_frame_render_allowed"
        : "runtime_render_blocked",
      ...runtimeFrameGate.tags,
      "production_display_blocked",
    ],
  }
}

function approvedFrameHardFieldsValid(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  return (
    approvedFrame.canShowToPlayer === true &&
    typeof approvedFrame.sourceImageSha256 === "string" &&
    approvedFrame.sourceImageSha256.length === 64 &&
    typeof approvedFrame.sourceImageByteLength === "number" &&
    approvedFrame.sourceImageByteLength > 0 &&
    typeof approvedFrame.sourceImageContentType === "string" &&
    isApprovedContentType(approvedFrame.sourceImageContentType) &&
    approvedFrame.sourceImagePayloadQualityPassed === true
  )
}

function approvedFrameGameWorldDisplayBoundaryPassed(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  const tags = new Set(approvedFrame.tags)

  return (
    approvedFrame.approvalScope === "approved_for_game_world" &&
    approvedFrame.productionApprovalStatus === "not_approved_for_production" &&
    approvedFrame.approvedForProduction === false &&
    approvedFrame.vj0Status === "vj_0_passed" &&
    approvedFrame.vj1Status === "vj_1_passed" &&
    String(approvedFrame.vj2Status) === "vj_2_passed" &&
    tags.has("game_world_ready_for_player") &&
    tags.has("formal_full_world_frame") &&
    !tags.has("controlled_mvp_player_visible_allowed") &&
    !tags.has("training_candidate") &&
    !tags.has("partial_or_crop_candidate")
  )
}

function isApprovedContentType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpeg"
  )
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function buildImageUrlAudit(imageUrl: string) {
  if (imageUrl.startsWith("data:image/")) {
    return {
      scheme: "data:image",
      allowed: true,
      canBeFetchedByRuntimeRender: true,
      reason: "data_image_url_allowed",
      reasonZh: "ApprovedFrame 使用 data:image URL，Runtime Render 可以展示。",
      reasonEn:
        "The ApprovedFrame uses a data:image URL. Runtime Render can display it.",
      tags: ["image_url_audit", "data_image_url_allowed"],
    }
  }

  try {
    const url = new URL(imageUrl)
    const allowed = url.protocol === "http:" || url.protocol === "https:"

    return {
      scheme: url.protocol.replace(":", ""),
      allowed,
      canBeFetchedByRuntimeRender: allowed,
      reason: allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      reasonZh: allowed
        ? "ApprovedFrame 使用 http/https URL，Runtime Render 可以尝试展示。"
        : "ApprovedFrame imageUrl 协议不被允许。",
      reasonEn: allowed
        ? "The ApprovedFrame uses an http/https URL. Runtime Render can try displaying it."
        : "The ApprovedFrame imageUrl uses a disallowed scheme.",
      tags: [
        "image_url_audit",
        allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      ],
    }
  } catch {
    return {
      scheme: "invalid",
      allowed: false,
      canBeFetchedByRuntimeRender: false,
      reason: "invalid_image_url",
      reasonZh: "ApprovedFrame imageUrl 不是有效 URL。",
      reasonEn: "The ApprovedFrame imageUrl is not a valid URL.",
      tags: ["image_url_audit", "invalid_image_url"],
    }
  }
}

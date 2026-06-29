import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldGameRuntimeFrame,
  buildWorldRuntimeFrameGate,
  buildWorldVisualFactManifest,
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"
import type {
  WorldVisualApprovedFrame,
  WorldVisualReviewReport,
} from "@/world/world-visual-painter"

type ApprovedFrameReadStatus = "found" | "empty" | "invalid" | "failed"

type RuntimeBoundApprovedFrame = WorldVisualApprovedFrame & {
  worldId?: unknown
  tick?: unknown
}

export async function GET() {
  const runtime = await readWorldRuntimeSaveRecord()

  if (runtime.status !== "found" || !runtime.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_required",
        canShowToPlayer: false,
        canShowToPlayerScope: "blocked",
        approvalBoundary: {
          approvalScope: "not_approved",
          productionApprovalStatus: "not_approved_for_production",
          approvedForProduction: false,
          vj1Status: "vj_1_failed",
          vj2Status: "vj_2_not_implemented",
          productionDisplayAllowed: false,
        },
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtime.record,
  })
  const factManifest = buildWorldVisualFactManifest({
    saveRecord: runtime.record,
  })
  const [candidate, approved] = await Promise.all([
    readLatestWorldVisualCandidateRecord({
      ownerId: runtime.record.ownerId,
      worldId: runtime.record.worldId,
      currentTick: runtime.record.tick,
      currentSourceFactIds: factManifest.sourceFactIds,
    }),
    readLatestWorldVisualApprovedFrameRecord({
      ownerId: runtime.record.ownerId,
      worldId: runtime.record.worldId,
      currentTick: runtime.record.tick,
      currentSourceFactIds: factManifest.sourceFactIds,
    }),
  ])
  const runtimeFrameBuild = buildWorldGameRuntimeFrame({
    ownerId: runtime.record.ownerId,
    currentWorldId: runtime.record.worldId,
    currentTick: runtime.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
    approvedFrame: approved.record?.approvedFrame ?? null,
    reviewReport: approved.record?.reviewReport ?? null,
    recordWorldId: approved.record?.worldId ?? null,
    recordTick: approved.record?.tick ?? null,
    recordSourceFactIds: approved.record?.sourceFactIds ?? [],
  })
  const approvedFrameGate = buildApprovedFrameGateSummary({
    status: approved.status,
    path: approved.path,
    warnings: approved.warnings,
    tags: approved.tags,
    currentWorldId: runtime.record.worldId,
    currentTick: runtime.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
    recordWorldId: approved.record?.worldId ?? null,
    recordTick: approved.record?.tick ?? null,
    recordSourceFactIds: approved.record?.sourceFactIds ?? [],
    recordCanShowToPlayer: approved.record?.canShowToPlayer ?? false,
    approvedFrame: approved.record?.approvedFrame ?? null,
    reviewReport: approved.record?.reviewReport ?? null,
    runtimeFrameReady: runtimeFrameBuild.runtimeFrameReady,
    runtimeFrameId: runtimeFrameBuild.runtimeFrame?.frameId ?? null,
    runtimeFrameBlockedReasons: runtimeFrameBuild.blockedReasons,
  })

  return NextResponse.json({
    ok: true,
    world: {
      worldId: runtime.record.worldId,
      tick: runtime.record.tick,
      sourceFactIdCount: factManifest.sourceFactIds.length,
    },
    imageModel: decision.imageModelStatus,
    conditionStage: "world_generation_condition_ready",
    candidateStatus: candidate.status,
    candidateReadAudit: {
      path: candidate.path,
      warnings: candidate.warnings,
      tags: candidate.tags,
    },
    approvedFrameStatus: approved.status,
    runtimeFrameStatus: runtimeFrameBuild.status,
    runtimeFrame: runtimeFrameBuild.runtimeFrame,
    approvedFrameGate,
    approvalBoundary: approvedFrameGate.approvalBoundary,
    canShowToPlayer: approvedFrameGate.canRuntimeRender,
    canShowToPlayerScope: "game_runtime_frame_only",
    productionDisplayAllowed: false,
    currentStage: approvedFrameGate.canRuntimeRender
      ? "runtime_frame"
      : decision.currentStage,
    nextStage: approvedFrameGate.canRuntimeRender
      ? "AI-PAINTER P5: complete game RuntimeFrame ready"
      : "AI-PAINTER P5: RuntimeFrame game interface required before /world display",
    tags: [
      "world_visual_status_api",
      "internal_model_only",
      "no_third_party_drawing_api_route",
      "game_world_scope",
      approvedFrameGate.approvalBoundary.vj0Status,
      approvedFrameGate.approvalBoundary.vj1Status,
      approvedFrameGate.approvalBoundary.vj2Status,
      approvedFrameGate.canRuntimeRender
        ? "approved_for_game_world"
        : "not_approved",
      "not_approved_for_production",
      "production_display_blocked",
      "current_tick_gate_checked",
      "current_source_facts_gate_checked",
      approvedFrameGate.canRuntimeRender
        ? "game_runtime_frame_render_allowed"
        : "runtime_render_blocked",
      approvedFrameGate.runtimeGameInterfaceReady
        ? "runtime_game_interface_ready"
        : "runtime_game_interface_not_implemented",
      approvedFrameGate.vj0Blocked
        ? "vj_0_approved_frame_blocked"
        : "vj_0_approved_frame_not_blocked",
    ],
  })
}

function buildApprovedFrameGateSummary(input: {
  status: ApprovedFrameReadStatus
  path: string
  warnings: string[]
  tags: string[]
  currentWorldId: string
  currentTick: number
  currentSourceFactIds: string[]
  recordWorldId: string | null
  recordTick: number | null
  recordSourceFactIds: string[]
  recordCanShowToPlayer: boolean
  approvedFrame: WorldVisualApprovedFrame | null
  reviewReport: WorldVisualReviewReport | null
  runtimeFrameReady: boolean
  runtimeFrameId: string | null
  runtimeFrameBlockedReasons: string[]
}) {
  const runtimeFrame = input.approvedFrame as RuntimeBoundApprovedFrame | null
  const hardFieldsValid = input.approvedFrame
    ? approvedFrameHardFieldsValid(input.approvedFrame)
    : false
  const gameWorldDisplayBoundaryPassed = input.approvedFrame
    ? approvedFrameGameWorldDisplayBoundaryPassed(input.approvedFrame)
    : false
  const currentWorldMatched = input.recordWorldId === input.currentWorldId
  const currentTickMatched = input.recordTick === input.currentTick
  const currentFrameWorldMatched = runtimeFrame?.worldId === input.currentWorldId
  const currentFrameTickMatched = runtimeFrame?.tick === input.currentTick
  const currentSourceFactsMatched = sameStringSet(
    input.currentSourceFactIds,
    input.recordSourceFactIds
  )
  const currentFrameSourceFactsMatched = input.approvedFrame
    ? sameStringSet(input.currentSourceFactIds, input.approvedFrame.sourceFactIds)
    : false
  const runtimeFrameGate = buildWorldRuntimeFrameGate({
    approvedFrame: input.approvedFrame,
    reviewReport: input.reviewReport,
    recordWorldId: input.recordWorldId,
    recordTick: input.recordTick,
    recordSourceFactIds: input.recordSourceFactIds,
    recordCanShowToPlayer: input.recordCanShowToPlayer,
    currentWorldId: input.currentWorldId,
    currentTick: input.currentTick,
    currentSourceFactIds: input.currentSourceFactIds,
    runtimeFrameReady: input.runtimeFrameReady,
    runtimeFrameId: input.runtimeFrameId,
    runtimeFrameBlockedReasons: input.runtimeFrameBlockedReasons,
  })
  const canRuntimeRender = input.status === "found" && runtimeFrameGate.canRuntimeRender

  return {
    status: input.status,
    apiState: buildApprovedFrameApiState(input.status, canRuntimeRender),
    vj0Blocked: input.status === "invalid" || input.status === "failed" || !canRuntimeRender,
    canRuntimeRender,
    canShowToPlayer: canRuntimeRender,
    canShowToPlayerScope: "game_runtime_frame_only",
    productionDisplayAllowed: false,
    runtimeGameInterfaceReady: runtimeFrameGate.runtimeGameInterfaceReady,
    blockedReasons: runtimeFrameGate.blockedReasons,
    displayRule: runtimeFrameGate.displayRule,
    displayRuleEn: runtimeFrameGate.displayRuleEn,
    approvalBoundary: {
      approvalScope: input.approvedFrame?.approvalScope ?? "not_approved",
      productionApprovalStatus:
        input.approvedFrame?.productionApprovalStatus ?? "not_approved_for_production",
      approvedForProduction: input.approvedFrame?.approvedForProduction ?? false,
      vj0Status: input.approvedFrame?.vj0Status ?? "vj_0_failed",
      vj1Status: input.approvedFrame?.vj1Status ?? "vj_1_failed",
      vj2Status: input.approvedFrame?.vj2Status ?? "vj_2_not_implemented",
      gameWorldDisplayBoundaryPassed,
      reviewReportGameWorldPassed: runtimeFrameGate.reviewReportGameWorldPassed,
      ownerFinalWorldApprovalPassed:
        runtimeFrameGate.ownerFinalWorldApprovalPassed,
      productionDisplayAllowed: false,
    },
    recordCanShowToPlayer: input.recordCanShowToPlayer,
    approvedFrameCanShowToPlayer: input.approvedFrame?.canShowToPlayer ?? false,
    hardFieldsValid,
    gameWorldDisplayBoundaryPassed,
    currentWorldMatched,
    currentTickMatched,
    currentFrameWorldMatched,
    currentFrameTickMatched,
    currentSourceFactsMatched,
    currentFrameSourceFactsMatched,
    reviewReportGameWorldPassed: runtimeFrameGate.reviewReportGameWorldPassed,
    ownerFinalWorldApprovalPassed:
      runtimeFrameGate.ownerFinalWorldApprovalPassed,
    sourceImageSha256Bound:
      typeof input.approvedFrame?.sourceImageSha256 === "string" &&
      input.approvedFrame.sourceImageSha256.length === 64,
    sourceImageByteLengthBound:
      typeof input.approvedFrame?.sourceImageByteLength === "number" &&
      input.approvedFrame.sourceImageByteLength > 0,
    sourceImageContentTypeBound:
      typeof input.approvedFrame?.sourceImageContentType === "string" &&
      isApprovedContentType(input.approvedFrame.sourceImageContentType),
    sourceImagePayloadQualityPassed:
      input.approvedFrame?.sourceImagePayloadQualityPassed === true,
    path: input.path,
    warnings: input.warnings,
    tags: [
      "approved_frame_gate_summary",
      canRuntimeRender
        ? "game_runtime_frame_render_allowed"
        : "runtime_render_blocked",
      runtimeFrameGate.runtimeGameInterfaceReady
        ? "runtime_game_interface_ready"
        : "runtime_game_interface_not_implemented",
      "runtime_frame_required_for_world",
      "single_approved_frame_direct_display_blocked",
      gameWorldDisplayBoundaryPassed
        ? "game_world_display_boundary_passed"
        : "game_world_display_boundary_failed",
      ...runtimeFrameGate.tags,
      "production_display_blocked",
      input.status === "invalid" ? "vj_0_read_gate_blocked" : "vj_0_read_gate_not_invalid",
      currentWorldMatched ? "current_world_matched" : "current_world_mismatch",
      currentTickMatched ? "current_tick_matched" : "current_tick_mismatch",
      currentFrameWorldMatched ? "current_frame_world_matched" : "current_frame_world_mismatch",
      currentFrameTickMatched ? "current_frame_tick_matched" : "current_frame_tick_mismatch",
      currentSourceFactsMatched
        ? "current_source_facts_matched"
        : "current_source_facts_mismatch",
      currentFrameSourceFactsMatched
        ? "current_frame_source_facts_matched"
        : "current_frame_source_facts_mismatch",
      ...input.tags,
    ],
  }
}

function buildApprovedFrameApiState(
  status: ApprovedFrameReadStatus,
  canRuntimeRender: boolean
): string {
  if (canRuntimeRender) return "game_ready_approved_frame_ready_for_world"
  if (status === "empty") return "approved_frame_empty"
  if (status === "invalid") return "approved_frame_blocked_by_vj_0_read_gate"
  if (status === "failed") return "approved_frame_read_failed"
  return "approved_frame_found_but_current_runtime_gate_blocked"
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

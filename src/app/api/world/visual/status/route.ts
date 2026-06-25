import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualFactManifest,
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"
import type { WorldVisualApprovedFrame } from "@/world/world-visual-painter"
import { isControlledMvpDisplayEnvironmentAllowed } from "@/world/world-visual-painter/approved-frame/controlled-mvp-display-policy"

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
    approvedFrameGate,
    approvalBoundary: approvedFrameGate.approvalBoundary,
    canShowToPlayer: approvedFrameGate.canRuntimeRender,
    canShowToPlayerScope: "controlled_mvp_only",
    productionDisplayAllowed: false,
    currentStage: decision.currentStage,
    nextStage: "AI-PAINTER B: VJ-0 hard gate",
    tags: [
      "world_visual_status_api",
      "internal_model_only",
      "no_third_party_drawing_api_route",
      "vj_0_only",
      "vj_1_failed",
      "vj_2_not_implemented",
      approvedFrameGate.canRuntimeRender
        ? "approved_for_controlled_mvp"
        : "not_approved",
      "not_approved_for_production",
      "production_display_blocked",
      "current_tick_gate_checked",
      "current_source_facts_gate_checked",
      approvedFrameGate.canRuntimeRender
        ? "controlled_mvp_runtime_render_allowed"
        : "runtime_render_blocked",
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
}) {
  const runtimeFrame = input.approvedFrame as RuntimeBoundApprovedFrame | null
  const hardFieldsValid = input.approvedFrame
    ? approvedFrameHardFieldsValid(input.approvedFrame)
    : false
  const controlledMvpBoundaryPassed = input.approvedFrame
    ? approvedFrameControlledMvpBoundaryPassed(input.approvedFrame)
    : false
  const controlledMvpDisplayEnvironmentAllowed =
    isControlledMvpDisplayEnvironmentAllowed()
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
  const canRuntimeRender =
    input.status === "found" &&
    input.recordCanShowToPlayer === true &&
    input.approvedFrame?.canShowToPlayer === true &&
    controlledMvpDisplayEnvironmentAllowed &&
    hardFieldsValid &&
    controlledMvpBoundaryPassed &&
    currentWorldMatched &&
    currentTickMatched &&
    currentFrameWorldMatched &&
    currentFrameTickMatched &&
    currentSourceFactsMatched &&
    currentFrameSourceFactsMatched

  return {
    status: input.status,
    apiState: buildApprovedFrameApiState(input.status, canRuntimeRender),
    vj0Blocked: input.status === "invalid" || input.status === "failed" || !canRuntimeRender,
    canRuntimeRender,
    canShowToPlayer: canRuntimeRender,
    canShowToPlayerScope: "controlled_mvp_only",
    productionDisplayAllowed: false,
    approvalBoundary: {
      approvalScope: input.approvedFrame?.approvalScope ?? "not_approved",
      productionApprovalStatus:
        input.approvedFrame?.productionApprovalStatus ?? "not_approved_for_production",
      approvedForProduction: input.approvedFrame?.approvedForProduction ?? false,
      vj0Status: input.approvedFrame?.vj0Status ?? "vj_0_failed",
      vj1Status: input.approvedFrame?.vj1Status ?? "vj_1_failed",
      vj2Status: input.approvedFrame?.vj2Status ?? "vj_2_not_implemented",
      controlledMvpBoundaryPassed,
      productionDisplayAllowed: false,
    },
    recordCanShowToPlayer: input.recordCanShowToPlayer,
    approvedFrameCanShowToPlayer: input.approvedFrame?.canShowToPlayer ?? false,
    hardFieldsValid,
    controlledMvpBoundaryPassed,
    controlledMvpDisplayEnvironmentAllowed,
    currentWorldMatched,
    currentTickMatched,
    currentFrameWorldMatched,
    currentFrameTickMatched,
    currentSourceFactsMatched,
    currentFrameSourceFactsMatched,
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
      canRuntimeRender ? "controlled_mvp_runtime_render_allowed" : "runtime_render_blocked",
      controlledMvpBoundaryPassed
        ? "controlled_mvp_boundary_passed"
        : "controlled_mvp_boundary_failed",
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
  if (canRuntimeRender) return "controlled_mvp_approved_frame_ready_for_world"
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

function approvedFrameControlledMvpBoundaryPassed(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  return (
    approvedFrame.approvalScope === "approved_for_controlled_mvp" &&
    approvedFrame.productionApprovalStatus === "not_approved_for_production" &&
    approvedFrame.approvedForProduction === false &&
    approvedFrame.vj0Status === "vj_0_passed" &&
    approvedFrame.vj1Status === "vj_1_passed" &&
    approvedFrame.vj2Status === "vj_2_not_implemented"
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

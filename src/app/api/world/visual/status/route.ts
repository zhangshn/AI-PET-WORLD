import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"
import type { WorldVisualApprovedFrame } from "@/world/world-visual-painter"

type ApprovedFrameReadStatus = "found" | "empty" | "invalid" | "failed"

export async function GET() {
  const runtime = await readWorldRuntimeSaveRecord()

  if (runtime.status !== "found" || !runtime.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_required",
        canShowToPlayer: false,
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtime.record,
  })
  const [candidate, approved] = await Promise.all([
    readLatestWorldVisualCandidateRecord({
      ownerId: runtime.record.ownerId,
      worldId: runtime.record.worldId,
    }),
    readLatestWorldVisualApprovedFrameRecord({
      ownerId: runtime.record.ownerId,
      worldId: runtime.record.worldId,
    }),
  ])
  const approvedFrameGate = buildApprovedFrameGateSummary({
    status: approved.status,
    path: approved.path,
    warnings: approved.warnings,
    tags: approved.tags,
    recordCanShowToPlayer: approved.record?.canShowToPlayer ?? false,
    approvedFrame: approved.record?.approvedFrame ?? null,
  })

  return NextResponse.json({
    ok: true,
    world: {
      worldId: runtime.record.worldId,
      tick: runtime.record.tick,
    },
    imageModel: decision.imageModelStatus,
    conditionStage: "world_generation_condition_not_implemented",
    candidateStatus: candidate.status,
    approvedFrameStatus: approved.status,
    approvedFrameGate,
    canShowToPlayer: approvedFrameGate.canRuntimeRender,
    currentStage: decision.currentStage,
    nextStage: "AI-PAINTER A3: VJ-0 display gate",
    tags: [
      "world_visual_status_api",
      "internal_model_only",
      "no_provider_route",
      approvedFrameGate.canRuntimeRender
        ? "runtime_render_allowed"
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
  recordCanShowToPlayer: boolean
  approvedFrame: WorldVisualApprovedFrame | null
}) {
  const hardFieldsValid = input.approvedFrame
    ? approvedFrameHardFieldsValid(input.approvedFrame)
    : false
  const canRuntimeRender =
    input.status === "found" &&
    input.recordCanShowToPlayer === true &&
    input.approvedFrame?.canShowToPlayer === true &&
    hardFieldsValid

  return {
    status: input.status,
    apiState: buildApprovedFrameApiState(input.status, canRuntimeRender),
    vj0Blocked: input.status === "invalid" || input.status === "failed",
    canRuntimeRender,
    canShowToPlayer: canRuntimeRender,
    recordCanShowToPlayer: input.recordCanShowToPlayer,
    approvedFrameCanShowToPlayer: input.approvedFrame?.canShowToPlayer ?? false,
    hardFieldsValid,
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
      canRuntimeRender ? "runtime_render_allowed" : "runtime_render_blocked",
      input.status === "invalid" ? "vj_0_read_gate_blocked" : "vj_0_read_gate_not_invalid",
      ...input.tags,
    ],
  }
}

function buildApprovedFrameApiState(
  status: ApprovedFrameReadStatus,
  canRuntimeRender: boolean
): string {
  if (canRuntimeRender) return "approved_frame_ready_for_world"
  if (status === "empty") return "approved_frame_empty"
  if (status === "invalid") return "approved_frame_blocked_by_vj_0_read_gate"
  if (status === "failed") return "approved_frame_read_failed"
  return "approved_frame_found_but_runtime_gate_blocked"
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

function isApprovedContentType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpeg"
  )
}

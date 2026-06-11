import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"

export async function GET() {
  const runtime = await readWorldRuntimeSaveRecord()

  if (runtime.status !== "found" || !runtime.record) {
    return NextResponse.json({
      ok: false,
      status: "runtime_world_required",
      canShowToPlayer: false,
    }, { status: 409 })
  }

  const decision = await buildWorldVisualPainterDecision({ saveRecord: runtime.record })
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
    canShowToPlayer:
      approved.status === "found" && approved.record?.canShowToPlayer === true,
    currentStage: decision.currentStage,
    nextStage: "AI-PAINTER A3: VJ-0 display gate",
    tags: [
      "world_visual_status_api",
      "internal_model_only",
      "no_provider_route",
    ],
  })
}

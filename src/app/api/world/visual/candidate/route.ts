import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { readLatestWorldVisualCandidateRecord } from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取世界画面候选图。",
        messageEn:
          "Runtime world has not been created, so no world image candidate can be read.",
        readStatus: readResult.status,
        tags: ["world_visual_candidate_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const candidateReadResult = await readLatestWorldVisualCandidateRecord({
    ownerId: readResult.record.ownerId,
    worldId: readResult.record.worldId,
  })

  if (candidateReadResult.status !== "found" || !candidateReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: candidateReadResult.status,
        message: "还没有隐藏候选图。需要先调用 /api/world/visual/generate。",
        messageEn:
          "No hidden candidate exists yet. Call /api/world/visual/generate first.",
        canShowToPlayer: false,
        tags: ["world_visual_candidate_api", ...candidateReadResult.tags],
      },
      { status: candidateReadResult.status === "empty" ? 404 : 500 }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      status: candidateReadResult.status,
      record: candidateReadResult.record,
      canShowToPlayer: false,
      displayRule: "候选图只供 VisualJudge 审核，不允许直接展示。",
      displayRuleEn:
        "The candidate is only for VisualJudge review and cannot be displayed directly.",
      tags: ["world_visual_candidate_api", ...candidateReadResult.tags],
    },
    { status: 200 }
  )
}

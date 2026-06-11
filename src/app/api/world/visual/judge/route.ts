import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualApprovedFrame,
  buildWorldVisualFactManifest,
  buildWorldVisualFixPlan,
  buildWorldVisualReviewReport,
  readLatestWorldVisualCandidateRecord,
  writeWorldVisualApprovedFrameRecord,
  writeWorldVisualFixPlanRecord,
} from "@/world/world-visual-painter"

export async function POST() {
  const runtimeReadResult = await readWorldRuntimeSaveRecord()

  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能执行视觉审核。",
        tags: ["world_visual_judge_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const candidateReadResult = await readLatestWorldVisualCandidateRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
  })

  if (candidateReadResult.status !== "found" || !candidateReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "还没有隐藏候选图，不能执行视觉审核。",
        candidateStatus: candidateReadResult.status,
        tags: ["world_visual_judge_api", ...candidateReadResult.tags],
      },
      { status: candidateReadResult.status === "empty" ? 404 : 500 }
    )
  }

  const candidateRecord = candidateReadResult.record
  const factManifest = buildWorldVisualFactManifest({
    saveRecord: runtimeReadResult.record,
  })
  const reviewReport = await buildWorldVisualReviewReport({
    factManifest,
    generationCondition: candidateRecord.generationCondition,
    aiImageGenerationRequest: candidateRecord.aiImageGenerationRequest,
    aiImageCandidate: candidateRecord.candidate,
  })
  const approvedFrame = buildWorldVisualApprovedFrame({
    factManifest,
    generationCondition: candidateRecord.generationCondition,
    aiImageGenerationRequest: candidateRecord.aiImageGenerationRequest,
    aiImageCandidate: candidateRecord.candidate,
    reviewReport,
  })
  const fixPlan = buildWorldVisualFixPlan({
    factManifest,
    reviewReport,
  })
  const fixPlanWriteResult = await writeWorldVisualFixPlanRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
    tick: runtimeReadResult.record.tick,
    fixPlan,
    reviewReport,
    factManifest,
  })
  const writeResult = approvedFrame
    ? await writeWorldVisualApprovedFrameRecord({
        ownerId: runtimeReadResult.record.ownerId,
        worldId: runtimeReadResult.record.worldId,
        tick: runtimeReadResult.record.tick,
        approvedFrame,
        reviewReport,
        sourceCandidateRecord: candidateRecord,
      })
    : null

  return NextResponse.json(
    {
      ok: Boolean(approvedFrame && writeResult?.ok),
      reviewReport,
      approvedFrame,
      fixPlan,
      fixPlanPersisted: fixPlanWriteResult.ok,
      fixPlanPath: fixPlanWriteResult.path,
      persisted: writeResult?.ok ?? false,
      approvedFramePath: writeResult?.path ?? null,
      canShowToPlayer: Boolean(approvedFrame && writeResult?.ok),
      tags: [
        "world_visual_judge_api",
        "vj_0_hard_gate",
        ...(writeResult?.tags ?? []),
        ...fixPlanWriteResult.tags,
        ...reviewReport.tags,
      ],
    },
    { status: approvedFrame && writeResult?.ok !== false ? 200 : 422 }
  )
}

import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualApprovedFrame,
  buildWorldVisualFactManifest,
  buildWorldVisualFixPlan,
  buildWorldVisualReviewReport,
  readLatestWorldVisualCandidateRecord,
  writeWorldVisualApprovedFrameRecord,
} from "@/world/world-visual-painter"

export async function POST() {
  const runtimeReadResult = await readWorldRuntimeSaveRecord()

  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能执行视觉审核。",
        messageEn:
          "Runtime world has not been created, so VisualJudge cannot run.",
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
        messageEn: "No hidden candidate exists, so VisualJudge cannot run.",
        candidateStatus: candidateReadResult.status,
        tags: ["world_visual_judge_api", ...candidateReadResult.tags],
      },
      { status: candidateReadResult.status === "empty" ? 404 : 500 }
    )
  }

  const factManifest = buildWorldVisualFactManifest({
    saveRecord: runtimeReadResult.record,
  })
  const reviewReport = buildWorldVisualReviewReport({
    factManifest,
    aiImageCandidate: candidateReadResult.record.candidate,
  })
  const approvedFrame = buildWorldVisualApprovedFrame({
    factManifest,
    aiImageCandidate: candidateReadResult.record.candidate,
    reviewReport,
  })
  const fixPlan = buildWorldVisualFixPlan({
    factManifest,
    reviewReport,
  })
  const writeResult = approvedFrame
    ? await writeWorldVisualApprovedFrameRecord({
        ownerId: runtimeReadResult.record.ownerId,
        worldId: runtimeReadResult.record.worldId,
        tick: runtimeReadResult.record.tick,
        approvedFrame,
        reviewReport,
      })
    : null

  return NextResponse.json(
    {
      ok: Boolean(approvedFrame && writeResult?.ok),
      reviewReport,
      approvedFrame,
      fixPlan,
      persisted: writeResult?.ok ?? false,
      approvedFramePath: writeResult?.path ?? null,
      persistenceWarnings: writeResult?.warnings ?? [],
      canShowToPlayer: Boolean(approvedFrame && writeResult?.ok),
      displayRule: approvedFrame
        ? "ApprovedFrame 已生成，可以进入 /world 展示阶段。"
        : "审核未通过，禁止展示，必须按 VisualFix 修正后重新生成候选图。",
      displayRuleEn: approvedFrame
        ? "ApprovedFrame exists and may enter /world display."
        : "Review failed. Display is blocked until VisualFix is applied and a new candidate passes review.",
      tags: [
        "world_visual_judge_api",
        ...(writeResult?.tags ?? []),
        ...reviewReport.tags,
      ],
    },
    { status: approvedFrame && writeResult?.ok !== false ? 200 : 422 }
  )
}

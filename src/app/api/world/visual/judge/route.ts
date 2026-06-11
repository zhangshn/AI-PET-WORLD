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
        messageEn:
          "Runtime world has not been created, so visual review cannot run.",
        canShowToPlayer: false,
        tags: ["world_visual_judge_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const factManifest = buildWorldVisualFactManifest({
    saveRecord: runtimeReadResult.record,
  })
  const candidateReadResult = await readLatestWorldVisualCandidateRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
    currentTick: runtimeReadResult.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })

  if (candidateReadResult.status !== "found" || !candidateReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message:
          candidateReadResult.status === "invalid"
            ? "隐藏候选图没有通过当前 VJ-0 读取闸门，不能执行视觉审核。"
            : "还没有隐藏候选图，不能执行视觉审核。",
        messageEn:
          candidateReadResult.status === "invalid"
            ? "The hidden candidate did not pass the current VJ-0 read gate, so visual review cannot run."
            : "No hidden candidate exists yet, so visual review cannot run.",
        candidateStatus: candidateReadResult.status,
        currentRuntimeGate: {
          worldId: runtimeReadResult.record.worldId,
          tick: runtimeReadResult.record.tick,
          sourceFactIds: factManifest.sourceFactIds,
          sourceFactIdCount: factManifest.sourceFactIds.length,
        },
        readAudit: {
          path: candidateReadResult.path,
          warnings: candidateReadResult.warnings,
          tags: candidateReadResult.tags,
        },
        canShowToPlayer: false,
        tags: [
          "world_visual_judge_api",
          "candidate_read_gate_required",
          "current_tick_gate_checked",
          "current_source_facts_gate_checked",
          ...candidateReadResult.tags,
        ],
      },
      {
        status:
          candidateReadResult.status === "empty"
            ? 404
            : candidateReadResult.status === "invalid"
              ? 409
              : 500,
      }
    )
  }

  const candidateRecord = candidateReadResult.record
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
  const approvedPersisted = Boolean(approvedFrame && writeResult?.ok)

  return NextResponse.json(
    {
      ok: approvedPersisted,
      reviewReport,
      approvedFrame,
      fixPlan,
      currentRuntimeGate: {
        worldId: runtimeReadResult.record.worldId,
        tick: runtimeReadResult.record.tick,
        sourceFactIds: factManifest.sourceFactIds,
        sourceFactIdCount: factManifest.sourceFactIds.length,
      },
      fixPlanPersisted: fixPlanWriteResult.ok,
      fixPlanPath: fixPlanWriteResult.path,
      persisted: writeResult?.ok ?? false,
      approvedFramePath: writeResult?.path ?? null,
      approvedFrameWriteWarnings: writeResult?.warnings ?? [],
      canShowToPlayer: approvedPersisted,
      displayRule: approvedPersisted
        ? "ApprovedFrame 已写入，但 /world 仍会在读取时再次校验当前 tick/sourceFactIds。"
        : "审核或 ApprovedFrame 写入未通过时，禁止展示世界画面。",
      displayRuleEn: approvedPersisted
        ? "ApprovedFrame has been written, but /world will still re-check current tick/sourceFactIds when reading it."
        : "When review or ApprovedFrame persistence fails, the world image must remain hidden.",
      tags: [
        "world_visual_judge_api",
        "vj_0_hard_gate",
        "current_tick_gate_checked",
        "current_source_facts_gate_checked",
        ...(writeResult?.tags ?? []),
        ...fixPlanWriteResult.tags,
        ...reviewReport.tags,
      ],
    },
    { status: approvedPersisted ? 200 : 422 }
  )
}

import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"
import {
  buildWorldVisualApprovedFrame,
  buildWorldVisualFactManifest,
  buildWorldVisualFixPlan,
  buildWorldVisualReviewReport,
  readLatestWorldVisualCandidateRecord,
  writeWorldVisualApprovedFrameRecord,
  writeWorldVisualFixPlanRecord,
} from "@/world/world-visual-painter"
import { runCurrentWorldRuntimeFramePipeline } from "@/world/game-map-frame"

export async function POST(request: Request) {
  const operatorSession = verifyLocalOperatorMutation(request)
  if (!operatorSession.ok) {
    return NextResponse.json({ ok: false, code: operatorSession.errorCode, message: "需要本机 AI Console 操作会话。" }, { status: operatorSession.status })
  }
  const worldId = new URL(request.url).searchParams.get("worldId")
  if (!worldId) {
    return NextResponse.json({ ok: false, status: "world_id_required" }, { status: 400 })
  }
  const runtimeReadResult = await readWorldRuntimeSaveRecord({ worldId })

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
  const controlledMvpApproved = Boolean(
    approvedFrame &&
      writeResult?.ok &&
      reviewReport.status === "vj_1_passed" &&
      reviewReport.approvalScope === "approved_for_controlled_mvp" &&
      reviewReport.productionApprovalStatus === "not_approved_for_production" &&
      approvedFrame.approvalScope === "approved_for_controlled_mvp" &&
      approvedFrame.approvedForProduction === false
  )
  const runtimeFramePipeline =
    approvedFrame &&
    writeResult?.ok &&
    approvedFrame.approvalScope === "approved_for_game_world" &&
    approvedFrame.vj2Status === "vj_2_passed"
      ? await runCurrentWorldRuntimeFramePipeline({
          saveRecord: runtimeReadResult.record,
          sourceFactIds: factManifest.sourceFactIds,
          approvedFrameRecord: {
            ownerId: runtimeReadResult.record.ownerId,
            worldId: runtimeReadResult.record.worldId,
            tick: runtimeReadResult.record.tick,
            sourceFactIds: factManifest.sourceFactIds,
            tags: candidateRecord.tags,
            approvedFrame: {
              ...approvedFrame,
              approvedForProduction: false,
            },
          },
        })
      : null

  return NextResponse.json(
    {
      ok: controlledMvpApproved,
      reviewReport,
      approvedFrame,
      fixPlan,
      approvalBoundary: {
        vj0Status: reviewReport.vj0Status,
        vj1Status: reviewReport.vj1Status,
        vj2Status: reviewReport.vj2Status,
        approvalScope: reviewReport.approvalScope,
        productionApprovalStatus: reviewReport.productionApprovalStatus,
        controlledMvpDisplayAllowed: controlledMvpApproved,
        approvedForProduction: false,
        productionDisplayAllowed: false,
        noteZh:
          "VJ-0 与 VJ-1 均通过后才允许生成受控 MVP ApprovedFrame；VJ-2 未实现前不得标记为生产批准。",
        noteEn:
          "Passing both VJ-0 and VJ-1 allows a controlled MVP ApprovedFrame. It must not be marked production approved before VJ-2 is implemented.",
      },
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
      canShowToPlayer: controlledMvpApproved,
      canShowToPlayerScope: "controlled_mvp_only",
      displayRule: controlledMvpApproved
        ? "受控 MVP ApprovedFrame 已写入，但 /world 仍会在读取时再次校验当前 tick/sourceFactIds；该帧不是 production approved。"
        : "VJ-0、ApprovedFrame 写入或受控 MVP 边界未通过时，禁止展示世界画面。",
      displayRuleEn: controlledMvpApproved
        ? "A controlled MVP ApprovedFrame has been written, but /world will still re-check current tick/sourceFactIds when reading it; this frame is not production approved."
        : "When VJ-0, ApprovedFrame persistence, or the controlled MVP boundary fails, the world image must remain hidden.",
      runtimeFramePipeline: runtimeFramePipeline
        ? {
            status: runtimeFramePipeline.status,
            passed: runtimeFramePipeline.passed,
            blockedReasons: runtimeFramePipeline.blockedReasons,
            writeStatus: runtimeFramePipeline.writeResult?.status ?? null,
          }
        : {
            status: "not_started_until_game_world_vj2_passed",
            passed: false,
            blockedReasons: ["vj_2_not_implemented_or_controlled_mvp_scope"],
            writeStatus: null,
          },
      tags: [
        "world_visual_judge_api",
        "vj_0_hard_gate",
        reviewReport.status,
        reviewReport.vj1Status,
        reviewReport.vj2Status,
        reviewReport.approvalScope,
        reviewReport.productionApprovalStatus,
        controlledMvpApproved
          ? "controlled_mvp_approved_frame_written"
          : "controlled_mvp_approved_frame_blocked",
        "production_display_blocked",
        `local_operator:${operatorSession.session.actorIdentity}`,
        "current_tick_gate_checked",
        "current_source_facts_gate_checked",
        ...(writeResult?.tags ?? []),
        ...fixPlanWriteResult.tags,
        ...reviewReport.tags,
        runtimeFramePipeline?.passed
          ? "runtime_frame_pipeline_written"
          : "runtime_frame_pipeline_not_started_or_blocked",
      ],
    },
    { status: controlledMvpApproved ? 200 : 422 }
  )
}

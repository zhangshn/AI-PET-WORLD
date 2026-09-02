import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { verifyLocalOperatorMutation } from "@/server/ai-console-control/operator-session"
import {
  buildWorldVisualPainterDecision,
  writeWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"

export async function POST(request: Request) {
  const operatorSession = verifyLocalOperatorMutation(request)
  if (!operatorSession.ok) {
    return NextResponse.json({ ok: false, code: operatorSession.errorCode, message: "需要本机 AI Console 操作会话。" }, { status: operatorSession.status })
  }
  const runtime = await readWorldRuntimeSaveRecord()

  if (runtime.status !== "found" || !runtime.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_required",
        message: "世界尚未创建，不能生成世界画面候选图。",
        messageEn:
          "The runtime world has not been created, so no world image candidate can be generated.",
        canShowToPlayer: false,
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtime.record,
  })

  if (!decision.imageModelStatus.canGenerate) {
    return NextResponse.json(
      {
        ok: false,
        status: decision.imageModelStatus.status,
        message: decision.imageModelStatus.reason.zh,
        messageEn: decision.imageModelStatus.reason.en,
        imageModel: decision.imageModelStatus,
        worldGenerationConditionStatus: "ready_but_generation_blocked",
        nextStage: "AI-PAINTER B: VJ-0 hard gate",
        canShowToPlayer: false,
        displayRule:
          "内部模型产生真实候选图并通过 VisualJudge 前，禁止展示世界画面。",
        displayRuleEn:
          "The world image remains hidden until the internal model produces a real candidate that passes VisualJudge.",
        tags: [
          "world_visual_generate_api",
          "internal_model_only",
          "generation_blocked",
          "no_third_party_drawing_api_fallback",
        ],
      },
      { status: 501 }
    )
  }

  if (!decision.aiImageCandidate) {
    return NextResponse.json(
      {
        ok: false,
        status: "internal_model_source_not_compatible_with_world_facts",
        message:
          "内部模型已就绪，但当前模型资产包缺少本次世界事实所需的结构通道，因此不能生成候选图。",
        messageEn:
          "The internal model is ready, but the current model asset pack lacks the structure channels required by this world's facts, so no candidate can be generated.",
        imageModel: decision.imageModelStatus,
        requiredWorldFacts: {
          worldId: decision.factManifest.worldId,
          tick: decision.factManifest.tick,
          sceneType: decision.generationCondition.sceneCondition.sceneType,
          sourceFactIdCount: decision.factManifest.sourceFactIds.length,
        },
        canShowToPlayer: false,
        displayRule:
          "模型资产包不能表达当前世界事实时，禁止生成替代图，也禁止展示世界画面。",
        displayRuleEn:
          "If the model asset pack cannot express current world facts, no substitute image may be generated or displayed.",
        tags: [
          "world_visual_generate_api",
          "internal_model_only",
          "source_fact_expression_gate_failed",
          "model_asset_pack_not_compatible_with_world_facts",
          "no_fake_candidate",
        ],
      },
      { status: 422 }
    )
  }

  const candidateWriteResult = await writeWorldVisualCandidateRecord({
    ownerId: runtime.record.ownerId,
    worldId: runtime.record.worldId,
    tick: runtime.record.tick,
    candidate: decision.aiImageCandidate,
    generationCondition: decision.generationCondition,
    factManifest: decision.factManifest,
    aiImageGenerationRequest: decision.aiImageGenerationRequest,
  })

  if (!candidateWriteResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: "candidate_write_failed",
        message: "AI 候选图已生成，但写入隐藏候选图记录失败。",
        messageEn:
          "The AI image candidate was generated, but the hidden candidate record could not be written.",
        imageModel: decision.imageModelStatus,
        candidateWrite: candidateWriteResult,
        canShowToPlayer: false,
        displayRule:
          "候选图写入失败时，禁止进入 VisualJudge，也禁止展示世界画面。",
        displayRuleEn:
          "If candidate persistence fails, VisualJudge cannot run and the world image must stay hidden.",
        tags: [
          "world_visual_generate_api",
          "candidate_write_failed",
          "hidden_candidate_required",
          ...candidateWriteResult.tags,
        ],
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      status: "candidate_written_pending_visual_judge",
      message: "AI 候选图已写入隐藏候选记录，下一步必须交给 VisualJudge 审核。",
      messageEn:
        "The AI image candidate has been written as a hidden candidate record. The next step must be VisualJudge review.",
      imageModel: decision.imageModelStatus,
      candidateWrite: candidateWriteResult,
      candidate: {
        candidateId: decision.aiImageCandidate.candidateId,
        sourceKind: decision.aiImageCandidate.sourceKind,
        modelVersion: decision.aiImageCandidate.modelVersion,
        conditionId: decision.aiImageCandidate.conditionId,
        width: decision.aiImageCandidate.width,
        height: decision.aiImageCandidate.height,
        imageFormat: decision.aiImageCandidate.imageFormat,
        canShowToPlayer: decision.aiImageCandidate.canShowToPlayer,
      },
      nextStage: "AI-PAINTER B: VisualJudge VJ-0 review",
      canShowToPlayer: false,
      displayRule: "候选图只允许作为隐藏审核输入，不能直接展示给玩家。",
      displayRuleEn:
        "The candidate may only be used as hidden review input and cannot be shown directly to the player.",
      tags: [
        "world_visual_generate_api",
        "hidden_candidate_written",
        "visual_judge_required",
        "approved_frame_required",
        `local_operator:${operatorSession.session.actorIdentity}`,
        ...candidateWriteResult.tags,
      ],
    },
    { status: 202 }
  )
}

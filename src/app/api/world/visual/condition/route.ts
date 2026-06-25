import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { buildWorldVisualPainterDecision } from "@/world/world-visual-painter"

export async function GET() {
  const runtime = await readWorldRuntimeSaveRecord()

  if (runtime.status !== "found" || !runtime.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能构建 WorldGenerationCondition。",
        messageEn:
          "The runtime world has not been created, so WorldGenerationCondition cannot be built.",
        canShowToPlayer: false,
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtime.record,
  })
  const condition = decision.generationCondition

  return NextResponse.json({
    ok: true,
    generationCondition: condition,
    audit: {
      conditionId: condition.conditionId,
      version: condition.version,
      worldIdMatches: condition.worldId === runtime.record.worldId,
      tickMatches: condition.tick === runtime.record.tick,
      sourceFactIdCount: condition.sourceFactIds.length,
      ruleDataIdCount: condition.ruleDataIds.length,
      fixConditionCount: condition.fixConditions.length,
      preserveWorldFacts: condition.safetyCondition.preserveWorldFacts,
      requireVisualJudge: condition.safetyCondition.requireVisualJudge,
      canShowToPlayer: condition.canShowToPlayer,
    },
    imageModel: decision.imageModelStatus,
    nextStep: {
      zh: "WorldGenerationCondition 已就绪。下一步执行内部模型训练与推理请求。",
      en: "WorldGenerationCondition is ready. Next implement internal model training and inference requests.",
    },
    canShowToPlayer: false,
    tags: [
      "world_visual_condition_api",
      "structured_model_input",
      "world_facts_locked",
      "not_player_visible",
    ],
  })
}

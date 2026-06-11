import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { buildWorldVisualPainterDecision } from "@/world/world-visual-painter"

export async function POST() {
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
        worldGenerationConditionStatus: "not_implemented",
        nextStage: "AI-PAINTER A3: VJ-0 display gate",
        canShowToPlayer: false,
        displayRule: "内部模型产生真实候选图并通过 VisualJudge 前，禁止展示世界画面。",
        displayRuleEn:
          "The world image remains hidden until the internal model produces a real candidate that passes VisualJudge.",
        tags: [
          "world_visual_generate_api",
          "internal_model_only",
          "generation_blocked",
          "no_provider_fallback",
        ],
      },
      { status: 501 }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      status: "internal_inference_not_implemented",
      message: "内部模型配置存在，但项目推理实现尚未完成，不能生成候选图。",
      messageEn:
        "Internal model configuration exists, but project inference is not implemented and cannot generate a candidate.",
      imageModel: decision.imageModelStatus,
      canShowToPlayer: false,
      tags: [
        "world_visual_generate_api",
        "internal_model_only",
        "inference_not_implemented",
        "no_fake_candidate",
      ],
    },
    { status: 501 }
  )
}

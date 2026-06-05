import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  runWorldVisualAiImageGenerationRequest,
} from "@/world/world-visual-painter"

export async function POST() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能生成世界画面候选图。",
        messageEn:
          "Runtime world has not been created, so no world image candidate can be generated.",
        readStatus: readResult.status,
        tags: ["world_visual_generate_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const decision = buildWorldVisualPainterDecision({
    saveRecord: readResult.record,
  })

  if (!decision.aiImageGenerationRequest || !decision.promptPackage) {
    return NextResponse.json(
      {
        ok: false,
        message: decision.aiImageProviderStatus.reason.zh,
        messageEn: decision.aiImageProviderStatus.reason.en,
        provider: decision.aiImageProviderStatus,
        displayRule: "没有 ApprovedFrame 前禁止展示。",
        displayRuleEn: "Display is blocked until ApprovedFrame exists.",
        tags: ["world_visual_generate_api", "provider_not_ready"],
      },
      { status: 409 }
    )
  }

  const generationResult = await runWorldVisualAiImageGenerationRequest({
    request: decision.aiImageGenerationRequest,
    factManifest: decision.factManifest,
    promptPackage: decision.promptPackage,
  })

  return NextResponse.json(
    {
      ok: generationResult.ok,
      candidate: generationResult.candidate,
      error: generationResult.error,
      canShowToPlayer: false,
      displayRule: "候选图仍然隐藏，必须通过 Visual Judge 后才能生成 ApprovedFrame。",
      displayRuleEn:
        "The candidate remains hidden and must pass Visual Judge before ApprovedFrame can be created.",
      tags: ["world_visual_generate_api", ...generationResult.tags],
    },
    { status: generationResult.ok ? 200 : 502 }
  )
}

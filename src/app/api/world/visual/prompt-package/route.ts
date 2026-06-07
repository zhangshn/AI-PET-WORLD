import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { buildWorldVisualPainterDecision } from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取 PromptPackage。",
        messageEn:
          "Runtime world has not been created, so no PromptPackage can be read.",
        readStatus: readResult.status,
        canShowToPlayer: false,
        tags: ["world_visual_prompt_package_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: readResult.record,
  })

  if (!decision.promptPackage) {
    return NextResponse.json(
      {
        ok: false,
        message: "PromptPackage 尚未生成。",
        messageEn: "PromptPackage has not been generated.",
        currentStage: decision.currentStage,
        provider: decision.aiImageProviderStatus,
        canShowToPlayer: false,
        tags: ["world_visual_prompt_package_api", "prompt_package_missing"],
      },
      { status: 409 }
    )
  }

  const promptPackage = decision.promptPackage

  return NextResponse.json(
    {
      ok: true,
      promptPackage,
      promptAudit: {
        packageId: promptPackage.packageId,
        modelRole: promptPackage.modelRole,
        hasPositivePromptZh: promptPackage.positivePrompt.zh.trim().length > 0,
        hasPositivePromptEn: promptPackage.positivePrompt.en.trim().length > 0,
        hasNegativePromptZh: promptPackage.negativePrompt.zh.trim().length > 0,
        hasNegativePromptEn: promptPackage.negativePrompt.en.trim().length > 0,
        ruleDataIdCount: promptPackage.ruleDataIds.length,
        sourceFactIdCount: promptPackage.sourceFactIds.length,
        canShowToPlayer: promptPackage.canShowToPlayer,
        tags: promptPackage.tags,
      },
      sceneIntent: {
        sceneType: decision.sceneIntent.sceneType,
        title: decision.sceneIntent.title,
        mainStory: decision.sceneIntent.mainStory,
        mustShow: decision.sceneIntent.mustShow,
        mayShow: decision.sceneIntent.mayShow,
        mustNotShow: decision.sceneIntent.mustNotShow,
        sourceFactIds: decision.sceneIntent.sourceFactIds,
        tags: decision.sceneIntent.tags,
      },
      painterGuides: {
        compositionGuide: promptPackage.compositionGuide,
        terrainGuide: promptPackage.terrainGuide,
        assetGuide: promptPackage.assetGuide,
        motionGuide: promptPackage.motionGuide,
      },
      sourceFacts: {
        worldId: decision.factManifest.worldId,
        tick: decision.factManifest.tick,
        primaryFacts: decision.factManifest.primaryFacts,
        supportingFacts: decision.factManifest.supportingFacts,
        ambientFacts: decision.factManifest.ambientFacts,
        sourceFactIds: decision.factManifest.sourceFactIds,
      },
      safetyAudit: {
        canShowToPlayer: false,
        displayRule:
          "PromptPackage 只是 AI Image Generation Model 的输入，不能作为世界画面展示。",
        displayRuleEn:
          "PromptPackage is only input for the AI Image Generation Model and must not be displayed as the world frame.",
        noWorldFactRewrite:
          "PromptPackage 只能翻译世界事实和视觉约束，不能改写 WorldRuntimeSaveRecord。",
        noWorldFactRewriteEn:
          "PromptPackage may only translate world facts and visual constraints, and must not rewrite WorldRuntimeSaveRecord.",
      },
      nextStep: {
        zh: "下一步调用 POST /api/world/visual/generate，让 PromptPackage 进入 AiImageGenerationRequest。",
        en: "Next call POST /api/world/visual/generate so PromptPackage enters AiImageGenerationRequest.",
        endpoint: "POST /api/world/visual/generate",
      },
      canShowToPlayer: false,
      tags: [
        "world_visual_prompt_package_api",
        "prompt_package_read_only",
        "ai_image_model_input_only",
        "not_player_visible",
        "does_not_generate",
        "does_not_modify_world_facts",
      ],
    },
    { status: 200 }
  )
}